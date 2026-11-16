function Hs(n, l) {
  for (var i = 0; i < l.length; i++) {
    const o = l[i];
    if (typeof o != "string" && !Array.isArray(o)) {
      for (const s in o)
        if (s !== "default" && !(s in n)) {
          const u = Object.getOwnPropertyDescriptor(o, s);
          u && Object.defineProperty(n, s, u.get ? u : {
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
const N0 = /* @__PURE__ */ new Set(["hover", "focus", "focus-visible", "focus-within", "active", "disabled", "enabled", "checked"]), T0 = /* @__PURE__ */ new Set(["not", "is", "where", "has", "nth-child"]), M0 = /* @__PURE__ */ new Set(["first-child", "last-child", "only-child", "root", ...N0]);
function ps(n) {
  return n.replace(/\\(?:([0-9a-fA-F]{1,6})\s?|([\s\S]))/g, (l, i, o) => i ? String.fromCodePoint(parseInt(i, 16)) : o);
}
function wl(n, l) {
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
  return [ps(n.slice(l, i)), i];
}
function C0(n, l) {
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
function Bs(n) {
  const l = [];
  let i = 0, o = 0;
  for (let s = 0; s < n.length; s++) {
    const u = n[s];
    if (u === "\\") {
      s++;
      continue;
    }
    if (u === '"' || u === "'") {
      if (s = n.indexOf(u, s + 1), s < 0) break;
      continue;
    }
    u === "(" || u === "[" ? i++ : u === ")" || u === "]" ? i-- : u === "," && i === 0 && (l.push(n.slice(o, s).trim()), o = s + 1);
  }
  return l.push(n.slice(o).trim()), l.filter(Boolean);
}
function A0(n, l) {
  const i = { tag: null, id: null, classes: [], attrs: [], pseudos: [], pseudoElement: null };
  let o = !1;
  for (; l < n.length; ) {
    const s = n[l];
    if (s === "*") {
      i.tag = "*", l++, o = !0;
      continue;
    }
    if (s === ".") {
      const [u, m] = wl(n, l + 1);
      i.classes.push(u), l = m, o = !0;
      continue;
    }
    if (s === "#") {
      const [u, m] = wl(n, l + 1);
      i.id = u, l = m, o = !0;
      continue;
    }
    if (s === "[") {
      const u = n.indexOf("]", l);
      if (u < 0) throw new ie(`unclosed [ in ${JSON.stringify(n)}`);
      const m = n.slice(l + 1, u).trim(), f = /^([^\s~^$*|=]+)\s*(?:([~^$*|]?=)\s*(?:"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'|([^\s"'\]]+)))?\s*(i)?$/.exec(m);
      if (!f) throw new ie(`cannot read the attribute selector [${m}]`);
      const p = f[3] ?? f[4] ?? f[5];
      i.attrs.push({ name: ps(f[1]).toLowerCase(), op: f[2] ?? null, value: p === void 0 ? null : ps(p) }), l = u + 1, o = !0;
      continue;
    }
    if (s === ":") {
      if (n[l + 1] === ":") {
        const [p, x] = wl(n, l + 2), _ = p.toLowerCase();
        if (_ !== "before" && _ !== "after") throw new ie(`::${_} is not supported`);
        if (i.pseudoElement = _, l = x, o = !0, l < n.length && !/[\s>]/.test(n[l])) throw new ie(`nothing may follow ::${_} in ${JSON.stringify(n)}`);
        break;
      }
      const [u, m] = wl(n, l + 1);
      l = m;
      const f = u.toLowerCase();
      if ((f === "before" || f === "after") && n[l] !== "(") {
        if (i.pseudoElement = f, o = !0, l < n.length && !/[\s>]/.test(n[l])) throw new ie(`nothing may follow :${f} in ${JSON.stringify(n)}`);
        break;
      }
      if (n[l] === "(") {
        if (!T0.has(f)) throw new ie(`:${f}() is not supported`);
        const p = C0(n, l + 1), x = n.slice(l + 1, p).trim();
        if (l = p + 1, f === "nth-child") {
          if (!/^\d+$/.test(x)) throw new ie(`:nth-child(${x}) is not supported (only a number)`);
          i.pseudos.push({ name: f, n: Number(x) });
        } else {
          const _ = Bs(x).map(Us);
          if (f === "has" && _.some((k) => k.length !== 1)) throw new ie(`:has(${x}) is not supported (only a compound selector)`);
          i.pseudos.push({ name: f, list: _ });
        }
      } else {
        if (!M0.has(f)) throw new ie(`:${f} is not supported`);
        i.pseudos.push({ name: f });
      }
      o = !0;
      continue;
    }
    if (/[A-Za-z_\-\\]/.test(s) && !o) {
      const [u, m] = wl(n, l);
      i.tag = u.toLowerCase(), l = m, o = !0;
      continue;
    }
    break;
  }
  if (!o) throw new ie(`empty compound selector at ${l} in ${JSON.stringify(n)}`);
  return [i, l];
}
function Us(n) {
  const l = [];
  let i = 0, o = null;
  for (n = n.trim(); i < n.length; ) {
    const [s, u] = A0(n, i);
    if (l.at(-1)?.compound.pseudoElement) throw new ie(`::${l.at(-1).compound.pseudoElement} must end ${JSON.stringify(n)}`);
    l.push({ compound: s, combinator: o }), i = u;
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
const Xd = /* @__PURE__ */ new Map();
function di(n) {
  let l = Xd.get(n);
  return l || (l = Bs(n).map(Us), Xd.set(n, l)), l;
}
function Xf(n) {
  const l = [0, 0, 0], i = (o) => {
    l[0] += o[0], l[1] += o[1], l[2] += o[2];
  };
  for (const { compound: o } of n) {
    o.id && l[0]++, l[1] += o.classes.length + o.attrs.length, o.tag && o.tag !== "*" && l[2]++, o.pseudoElement && l[2]++;
    for (const s of o.pseudos)
      if (s.name !== "where")
        if (s.list) {
          const u = s.list.map(Xf).sort((m, f) => f[0] - m[0] || f[1] - m[1] || f[2] - m[2])[0];
          i(u);
        } else l[1]++;
  }
  return l;
}
function j0(n, { name: l, op: i, value: o }) {
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
function Dr(n) {
  return n.parentElement ? n.parentElement.children : [n];
}
function Zf(n, l) {
  for (const i of n.children) if (l(i) || Zf(i, l)) return !0;
  return !1;
}
function Jf(n, l, i, o) {
  if ((l.pseudoElement ?? null) !== (o ? i.pseudo ?? null : null) || l.tag && l.tag !== "*" && n.tagName !== l.tag || l.id && n.getAttribute("id") !== l.id) return !1;
  if (l.classes.length) {
    const s = n.classSet ?? new Set(n.classList ?? []);
    for (const u of l.classes) if (!s.has(u)) return !1;
  }
  for (const s of l.attrs) if (!j0(n, s)) return !1;
  for (const s of l.pseudos)
    switch (s.name) {
      case "first-child":
        if (Dr(n)[0] !== n) return !1;
        break;
      case "only-child":
        if (Dr(n).length !== 1) return !1;
        break;
      case "last-child": {
        const u = Dr(n);
        if (u[u.length - 1] !== n) return !1;
        break;
      }
      case "nth-child":
        if (Dr(n).indexOf(n) !== s.n - 1) return !1;
        break;
      case "root":
        if (!n.isDocumentRoot) return !1;
        break;
      case "not":
        if (s.list.some((u) => La(n, u, i, o))) return !1;
        break;
      case "has":
        if (n.watchesDescendants = !0, !s.list.some(([{ compound: u }]) => Zf(n, (m) => Jf(m, u, i, !1)))) return !1;
        break;
      case "is":
      case "where":
        if (!s.list.some((u) => La(n, u, i, o))) return !1;
        break;
      default:
        if (!i.state || !i.state(n, s.name, o)) return !1;
    }
  return !0;
}
function La(n, l, i, o = !0) {
  const s = (u, m, f) => {
    const { compound: p, combinator: x } = l[m];
    if (!Jf(u, p, i, f)) return !1;
    if (m === 0) return !0;
    if (x === ">") return !!u.parentElement && s(u.parentElement, m - 1, !1);
    for (let _ = u.parentElement; _; _ = _.parentElement) if (s(_, m - 1, !1)) return !0;
    return !1;
  };
  return s(n, l.length - 1, o);
}
function O0(n, l, i = {}) {
  return (typeof l == "string" ? di(l) : l).some((s) => La(n, s, i));
}
function hs(n, l, i = {}) {
  return La(n, l, i);
}
function Cl(n, l, i = {}) {
  const o = di(l), s = [], u = (m) => {
    for (const f of m.children)
      o.some((p) => La(f, p, i)) && s.push(f), u(f);
  };
  return u(n), s;
}
function Wf(n, l, i = {}) {
  const o = di(l);
  for (let s = n; s; s = s.parentElement) if (o.some((u) => La(s, u, i))) return s;
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
let R0 = 1;
class gs {
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
class Gs {
  constructor() {
    this.listeners = [];
  }
  addEventListener(l, i, o) {
    const s = o === !0 || !!o?.capture;
    this.listeners.some((u) => u.type === l && u.listener === i && u.capture === s) || this.listeners.push({ type: l, listener: i, capture: s });
  }
  removeEventListener(l, i, o) {
    const s = o === !0 || !!o?.capture;
    this.listeners = this.listeners.filter((u) => !(u.type === l && u.listener === i && u.capture === s));
  }
}
let D0 = 0;
const bs = () => ++D0;
class fi {
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
class Zt extends Gs {
  constructor(l, i = {}, o = null) {
    super(), this.nodeType = 1, this.id = `n${R0++}`, this.tagName = l.toLowerCase(), this.props = i, this.childNodes = [], this.parentNode = null, this.ownerDocument = o, this.hidden = !1, this.state = { hover: !1, focus: !1, active: !1 }, this.bounds = null, this.version = 0, this.attrStamp = 0, this.stamp = 0;
  }
  /** Its props, attributes or state changed. */
  touch() {
    this.version++, this.attrStamp = bs(), this.mark();
  }
  /** Its subtree changed: it and its ancestors are described again (their styles are kept unless they changed). */
  mark() {
    const l = bs();
    for (let i = this; i instanceof Zt; i = i.parentNode) i.stamp = l;
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
    return this.parentNode instanceof Zt ? this.parentNode : null;
  }
  get children() {
    return this.childNodes.filter((l) => l instanceof Zt);
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
      i.startsWith("data-") && o != null && o !== !1 && (l[i.slice(5).replace(/-([a-z])/g, (s, u) => u.toUpperCase())] = String(o));
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
      const u = l.replace(/-([a-z])/g, (m, f) => f.toUpperCase());
      s = i[u];
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
    return O0(this, l);
  }
  closest(l) {
    return Wf(this, l);
  }
  querySelectorAll(l) {
    return Cl(this, l);
  }
  querySelector(l) {
    return Cl(this, l)[0] ?? null;
  }
  /** Where the engine last laid this element out (`HostDocument.measure`); else, before its first layout, a box the
   * engine reported another way (the direct children of a scroll area, a pressed element); else a zero box. */
  getBoundingClientRect() {
    const l = this.ownerDocument?.measure?.(this) ?? this.ownerDocument?.itemBounds?.(this.id) ?? this.bounds;
    return l ? new gs(l.x, l.y, l.width, l.height) : new gs();
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
    }, s = (m) => l.inline && m in l.inline ? l.inline[m] : o(m), u = (m, f) => {
      const p = f == null ? "" : String(f);
      s(m) !== p && (l.inline ??= {}, p === o(m) ? delete l.inline[m] : l.inline[m] = p, l.touch(), l.ownerDocument?.restyled());
    };
    return this.styleView = new Proxy({}, {
      get: (m, f) => {
        if (typeof f == "string")
          return f === "setProperty" ? (p, x) => u(i(p), x) : f === "removeProperty" ? (p) => {
            const x = s(i(p));
            return u(i(p), ""), x;
          } : f === "getPropertyValue" ? (p) => s(i(p)) : s(f);
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
    return Zd(this);
  }
  /** `outerHTML` without the attributes named in `omit` (by their DOM names), as the web's drag strips its copy. */
  copyMarkup(l = []) {
    return Zd(this, l);
  }
}
const Ff = Symbol("perch.stale-layout"), $f = 3;
let Jr = !1;
function If(n) {
  return () => {
    let l, i = !1;
    const o = (s) => {
      const u = Jr;
      Jr = s < $f;
      try {
        l = n();
      } catch (m) {
        const f = m?.[Ff];
        if (!f) throw m;
        f.retries.push(() => {
          i || o(s + 1);
        });
      } finally {
        Jr = u;
      }
    };
    return o(0), () => {
      i = !0, typeof l == "function" && l();
    };
  };
}
const vs = "perch-dom:", H0 = /* @__PURE__ */ new Set(["children", "key", "ref", "dangerouslySetInnerHTML"]), B0 = { class: "className", for: "htmlFor", tabindex: "tabIndex" };
function Zd(n, l = []) {
  const i = new Set(l.map((s) => B0[s] ?? s)), o = (s) => {
    if (!(s instanceof Zt)) return { x: s.data, ...s.hidden ? { h: 1 } : {} };
    const u = {};
    for (const [m, f] of Object.entries(s.props))
      H0.has(m) || i.has(m) || f == null || typeof f == "function" || typeof f == "symbol" || (u[m] = f);
    return { t: s.tagName, p: u, c: s.childNodes.map(o), ...s.hidden ? { h: 1 } : {} };
  };
  return vs + JSON.stringify(o(n));
}
function U0(n, l) {
  if (typeof n != "string" || !n.startsWith(vs)) return null;
  let i;
  try {
    i = JSON.parse(n.slice(vs.length));
  } catch {
    return null;
  }
  const o = (u) => !!u && typeof u == "object" && !Array.isArray(u), s = (u) => {
    if (!o(u)) throw new Error("not a node");
    let m;
    if (typeof u.x == "string") m = new fi(u.x);
    else {
      if (typeof u.t != "string" || !/^[a-z][a-z0-9-]*$/i.test(u.t) || !o(u.p) || !Array.isArray(u.c)) throw new Error("not an element");
      m = new Zt(u.t, u.p, l);
      for (const f of u.c) m.appendChild(s(f));
    }
    return m.hidden = u.h === 1, m;
  };
  try {
    return [s(i)];
  } catch {
    return null;
  }
}
class G0 {
  observe() {
  }
  unobserve() {
  }
  disconnect() {
  }
}
class Y0 {
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
function Jd(n) {
  for (let l = n; l instanceof Zt; l = l.parentElement) l.touch();
}
class q0 extends Gs {
  constructor(l) {
    super(), this.perch = l, this.documentElement = new Zt("html", {}, this), this.body = new Zt("body", {}, this), this.documentElement.appendChild(this.body), this.activeElement = this.body, this.retries = [];
  }
  createElement(l) {
    return new Zt(l, {}, this);
  }
  /** `element`'s box as the engine last laid it out, or null before its first layout or without an engine that
   * reports boxes (`perch.bounds`). The first ask marks the element to be measured from the next frame on. Inside an
   * effect (`measured`) a box older than the tree, or none yet, puts the effect off until the next frame. */
  measure(l) {
    const i = this.perch?.bounds;
    if (typeof i != "function" || !this.measureKey) return null;
    l.measured || (l.measured = !0, l.touch(), this.restyled());
    const o = i(this.measureKey(l));
    if (Jr && (!o || this.stale?.())) throw { [Ff]: this };
    return o ?? null;
  }
  /** An element's `style` was written: the tree is described again once the writing script is done. */
  restyled() {
    this.restyling || (this.restyling = !0, queueMicrotask(() => {
      this.restyling = !1, this.afterCommit?.();
    }));
  }
  focus(l) {
    this.activeElement && this.activeElement !== l && this.blur(this.activeElement), this.activeElement = l, l.state.focus = !0, l.state.pointerFocus = !1, Jd(l), this.perch?.focused?.(l);
  }
  blur(l) {
    l.state.focus = !1, Jd(l), this.activeElement === l && (this.activeElement = this.body);
  }
  querySelectorAll(l) {
    return Cl(this.documentElement, l);
  }
  querySelector(l) {
    return this.querySelectorAll(l)[0] ?? null;
  }
  /** The element whose `id` prop is `id` (React's `useId` ids are not selectors). */
  getElementById(l) {
    return Cl(this.documentElement, "*").find((i) => i.props?.id === l) ?? null;
  }
}
class L0 extends Gs {
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
function Pf(n) {
  return {
    setTimeout: (l, i = 0, ...o) => n.setTimeout(() => l(...o), Math.max(0, Number(i) || 0)),
    clearTimeout: (l) => {
      l != null && n.clearTimeout(l);
    }
  };
}
const Wd = Symbol.for("perch.react.globals");
function We(n, l, i) {
  Object.defineProperty(n, l, { value: i, configurable: !0, writable: !0, enumerable: !1 });
}
function Q0(n, l = globalThis) {
  const i = new q0(n), o = new L0(n, i);
  i.defaultView = o;
  const s = n.storage ?? new Y0();
  if (typeof l.setTimeout != "function") {
    if (typeof n.setTimeout != "function") throw new Error("the engine has no setTimeout and the perch host gives none (perch.setTimeout)");
    const f = Pf(n);
    We(l, "setTimeout", f.setTimeout), We(l, "clearTimeout", f.clearTimeout);
  }
  typeof l.queueMicrotask != "function" && We(l, "queueMicrotask", (f) => {
    Promise.resolve().then(f);
  }), We(l, "requestAnimationFrame", (f) => l.setTimeout(() => f(Date.now()), 0)), We(l, "cancelAnimationFrame", (f) => l.clearTimeout(f));
  const u = { document: i, window: o, localStorage: s, HTMLElement: Zt, Element: Zt };
  for (const f of Object.keys(u))
    Object.defineProperty(l, f, { get: () => l[Wd]?.[f], configurable: !0, enumerable: !1 });
  l[Wd] = u, We(l, "DOMRect", gs), We(l, "getComputedStyle", V0), typeof l.ResizeObserver != "function" && We(l, "ResizeObserver", G0);
  const m = l.navigator && typeof l.navigator == "object" ? l.navigator : {};
  if (!m.clipboard && n.clipboard)
    try {
      We(m, "clipboard", n.clipboard);
    } catch {
    }
  return l.navigator || We(l, "navigator", m), { document: i, window: o, globals: u };
}
function V0(n) {
  const l = n?.ownerDocument?.computed?.(n) ?? {}, i = (o) => {
    const s = l[o];
    return typeof s == "string" || typeof s == "number" ? String(s) : "";
  };
  return new Proxy({}, {
    get: (o, s) => {
      if (typeof s == "string")
        return s === "getPropertyValue" ? (u) => i(String(u)) : i(s.replace(/[A-Z]/g, (u) => `-${u.toLowerCase()}`));
    }
  });
}
function ys(n, l = !1) {
  if (!(l ? n?.tagName === "input" && tm(n) : n?.tagName === "button" && !/^(button|reset)$/.test(String(n.props.type ?? "submit")) && !n.props.disabled)) return null;
  for (let o = n.parentElement; o; o = o.parentElement) if (o.tagName === "form") return o;
  return null;
}
const tm = (n) => n?.tagName === "textarea" || n?.tagName === "input" && /^(text|search|url|email|tel|password|number|)$/.test(String(n.props.type ?? ""));
//! Evaluated before anything else in the runtime bundle: React's scheduler reads `setTimeout` and `queueMicrotask`
//! once, when it loads, so an engine without them (QuickJS) gets the host's (`perch.setTimeout`) first.
const Fd = globalThis.perch;
if (typeof globalThis.setTimeout != "function" && typeof Fd?.setTimeout == "function") {
  const n = Pf(Fd);
  globalThis.setTimeout = n.setTimeout, globalThis.clearTimeout = n.clearTimeout;
}
typeof globalThis.queueMicrotask != "function" && (globalThis.queueMicrotask = (n) => {
  Promise.resolve().then(n);
});
function Ys(n) {
  return n && n.__esModule && Object.prototype.hasOwnProperty.call(n, "default") ? n.default : n;
}
function K0(n) {
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
var es = { exports: {} }, pt = {};
/**
 * @license React
 * react.production.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var $d;
function X0() {
  if ($d) return pt;
  $d = 1;
  var n = Symbol.for("react.transitional.element"), l = Symbol.for("react.portal"), i = Symbol.for("react.fragment"), o = Symbol.for("react.strict_mode"), s = Symbol.for("react.profiler"), u = Symbol.for("react.consumer"), m = Symbol.for("react.context"), f = Symbol.for("react.forward_ref"), p = Symbol.for("react.suspense"), x = Symbol.for("react.memo"), _ = Symbol.for("react.lazy"), k = Symbol.for("react.activity"), y = Symbol.iterator;
  function S(M) {
    return M === null || typeof M != "object" ? null : (M = y && M[y] || M["@@iterator"], typeof M == "function" ? M : null);
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
  }, j = Object.assign, T = {};
  function A(M, X, at) {
    this.props = M, this.context = X, this.refs = T, this.updater = at || z;
  }
  A.prototype.isReactComponent = {}, A.prototype.setState = function(M, X) {
    if (typeof M != "object" && typeof M != "function" && M != null)
      throw Error(
        "takes an object of state variables to update or a function which returns an object of state variables."
      );
    this.updater.enqueueSetState(this, M, X, "setState");
  }, A.prototype.forceUpdate = function(M) {
    this.updater.enqueueForceUpdate(this, M, "forceUpdate");
  };
  function R() {
  }
  R.prototype = A.prototype;
  function B(M, X, at) {
    this.props = M, this.context = X, this.refs = T, this.updater = at || z;
  }
  var Z = B.prototype = new R();
  Z.constructor = B, j(Z, A.prototype), Z.isPureReactComponent = !0;
  var F = Array.isArray;
  function D() {
  }
  var h = { H: null, A: null, T: null, S: null }, b = Object.prototype.hasOwnProperty;
  function g(M, X, at) {
    var st = at.ref;
    return {
      $$typeof: n,
      type: M,
      key: X,
      ref: st !== void 0 ? st : null,
      props: at
    };
  }
  function w(M, X) {
    return g(M.type, X, M.props);
  }
  function N(M) {
    return typeof M == "object" && M !== null && M.$$typeof === n;
  }
  function E(M) {
    var X = { "=": "=0", ":": "=2" };
    return "$" + M.replace(/[=:]/g, function(at) {
      return X[at];
    });
  }
  var O = /\/+/g;
  function Q(M, X) {
    return typeof M == "object" && M !== null && M.key != null ? E("" + M.key) : X.toString(36);
  }
  function W(M) {
    switch (M.status) {
      case "fulfilled":
        return M.value;
      case "rejected":
        throw M.reason;
      default:
        switch (typeof M.status == "string" ? M.then(D, D) : (M.status = "pending", M.then(
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
  function U(M, X, at, st, ct) {
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
              return Et = M._init, U(
                Et(M._payload),
                X,
                at,
                st,
                ct
              );
          }
      }
    if (Et)
      return ct = ct(M), Et = st === "" ? "." + Q(M, 0) : st, F(ct) ? (at = "", Et != null && (at = Et.replace(O, "$&/") + "/"), U(ct, X, at, "", function(Vn) {
        return Vn;
      })) : ct != null && (N(ct) && (ct = w(
        ct,
        at + (ct.key == null || M && M.key === ct.key ? "" : ("" + ct.key).replace(
          O,
          "$&/"
        ) + "/") + Et
      )), X.push(ct)), 1;
    Et = 0;
    var $t = st === "" ? "." : st + ":";
    if (F(M))
      for (var ht = 0; ht < M.length; ht++)
        st = M[ht], ut = $t + Q(st, ht), Et += U(
          st,
          X,
          at,
          ut,
          ct
        );
    else if (ht = S(M), typeof ht == "function")
      for (M = ht.call(M), ht = 0; !(st = M.next()).done; )
        st = st.value, ut = $t + Q(st, ht++), Et += U(
          st,
          X,
          at,
          ut,
          ct
        );
    else if (ut === "object") {
      if (typeof M.then == "function")
        return U(
          W(M),
          X,
          at,
          st,
          ct
        );
      throw X = String(M), Error(
        "Objects are not valid as a React child (found: " + (X === "[object Object]" ? "object with keys {" + Object.keys(M).join(", ") + "}" : X) + "). If you meant to render a collection of children, use an array instead."
      );
    }
    return Et;
  }
  function V(M, X, at) {
    if (M == null) return M;
    var st = [], ct = 0;
    return U(M, st, "", "", function(ut) {
      return X.call(at, ut, ct++);
    }), st;
  }
  function I(M) {
    if (M._status === -1) {
      var X = M._result;
      X = X(), X.then(
        function(at) {
          (M._status === 0 || M._status === -1) && (M._status = 1, M._result = at);
        },
        function(at) {
          (M._status === 0 || M._status === -1) && (M._status = 2, M._result = at);
        }
      ), M._status === -1 && (M._status = 0, M._result = X);
    }
    if (M._status === 1) return M._result.default;
    throw M._result;
  }
  var L = typeof reportError == "function" ? reportError : function(M) {
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
  }, K = {
    map: V,
    forEach: function(M, X, at) {
      V(
        M,
        function() {
          X.apply(this, arguments);
        },
        at
      );
    },
    count: function(M) {
      var X = 0;
      return V(M, function() {
        X++;
      }), X;
    },
    toArray: function(M) {
      return V(M, function(X) {
        return X;
      }) || [];
    },
    only: function(M) {
      if (!N(M))
        throw Error(
          "React.Children.only expected to receive a single React element child."
        );
      return M;
    }
  };
  return pt.Activity = k, pt.Children = K, pt.Component = A, pt.Fragment = i, pt.Profiler = s, pt.PureComponent = B, pt.StrictMode = o, pt.Suspense = p, pt.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE = h, pt.__COMPILER_RUNTIME = {
    __proto__: null,
    c: function(M) {
      return h.H.useMemoCache(M);
    }
  }, pt.cache = function(M) {
    return function() {
      return M.apply(null, arguments);
    };
  }, pt.cacheSignal = function() {
    return null;
  }, pt.cloneElement = function(M, X, at) {
    if (M == null)
      throw Error(
        "The argument must be a React element, but you passed " + M + "."
      );
    var st = j({}, M.props), ct = M.key;
    if (X != null)
      for (ut in X.key !== void 0 && (ct = "" + X.key), X)
        !b.call(X, ut) || ut === "key" || ut === "__self" || ut === "__source" || ut === "ref" && X.ref === void 0 || (st[ut] = X[ut]);
    var ut = arguments.length - 2;
    if (ut === 1) st.children = at;
    else if (1 < ut) {
      for (var Et = Array(ut), $t = 0; $t < ut; $t++)
        Et[$t] = arguments[$t + 2];
      st.children = Et;
    }
    return g(M.type, ct, st);
  }, pt.createContext = function(M) {
    return M = {
      $$typeof: m,
      _currentValue: M,
      _currentValue2: M,
      _threadCount: 0,
      Provider: null,
      Consumer: null
    }, M.Provider = M, M.Consumer = {
      $$typeof: u,
      _context: M
    }, M;
  }, pt.createElement = function(M, X, at) {
    var st, ct = {}, ut = null;
    if (X != null)
      for (st in X.key !== void 0 && (ut = "" + X.key), X)
        b.call(X, st) && st !== "key" && st !== "__self" && st !== "__source" && (ct[st] = X[st]);
    var Et = arguments.length - 2;
    if (Et === 1) ct.children = at;
    else if (1 < Et) {
      for (var $t = Array(Et), ht = 0; ht < Et; ht++)
        $t[ht] = arguments[ht + 2];
      ct.children = $t;
    }
    if (M && M.defaultProps)
      for (st in Et = M.defaultProps, Et)
        ct[st] === void 0 && (ct[st] = Et[st]);
    return g(M, ut, ct);
  }, pt.createRef = function() {
    return { current: null };
  }, pt.forwardRef = function(M) {
    return { $$typeof: f, render: M };
  }, pt.isValidElement = N, pt.lazy = function(M) {
    return {
      $$typeof: _,
      _payload: { _status: -1, _result: M },
      _init: I
    };
  }, pt.memo = function(M, X) {
    return {
      $$typeof: x,
      type: M,
      compare: X === void 0 ? null : X
    };
  }, pt.startTransition = function(M) {
    var X = h.T, at = {};
    h.T = at;
    try {
      var st = M(), ct = h.S;
      ct !== null && ct(at, st), typeof st == "object" && st !== null && typeof st.then == "function" && st.then(D, L);
    } catch (ut) {
      L(ut);
    } finally {
      X !== null && at.types !== null && (X.types = at.types), h.T = X;
    }
  }, pt.unstable_useCacheRefresh = function() {
    return h.H.useCacheRefresh();
  }, pt.use = function(M) {
    return h.H.use(M);
  }, pt.useActionState = function(M, X, at) {
    return h.H.useActionState(M, X, at);
  }, pt.useCallback = function(M, X) {
    return h.H.useCallback(M, X);
  }, pt.useContext = function(M) {
    return h.H.useContext(M);
  }, pt.useDebugValue = function() {
  }, pt.useDeferredValue = function(M, X) {
    return h.H.useDeferredValue(M, X);
  }, pt.useEffect = function(M, X) {
    return h.H.useEffect(M, X);
  }, pt.useEffectEvent = function(M) {
    return h.H.useEffectEvent(M);
  }, pt.useId = function() {
    return h.H.useId();
  }, pt.useImperativeHandle = function(M, X, at) {
    return h.H.useImperativeHandle(M, X, at);
  }, pt.useInsertionEffect = function(M, X) {
    return h.H.useInsertionEffect(M, X);
  }, pt.useLayoutEffect = function(M, X) {
    return h.H.useLayoutEffect(M, X);
  }, pt.useMemo = function(M, X) {
    return h.H.useMemo(M, X);
  }, pt.useOptimistic = function(M, X) {
    return h.H.useOptimistic(M, X);
  }, pt.useReducer = function(M, X, at) {
    return h.H.useReducer(M, X, at);
  }, pt.useRef = function(M) {
    return h.H.useRef(M);
  }, pt.useState = function(M) {
    return h.H.useState(M);
  }, pt.useSyncExternalStore = function(M, X, at) {
    return h.H.useSyncExternalStore(
      M,
      X,
      at
    );
  }, pt.useTransition = function() {
    return h.H.useTransition();
  }, pt.version = "19.2.8", pt;
}
var Id;
function Z0() {
  return Id || (Id = 1, es.exports = X0()), es.exports;
}
var J = Z0();
const em = /* @__PURE__ */ Ys(J), J0 = /* @__PURE__ */ Hs({
  __proto__: null,
  default: em
}, [J]);
//! "react" as the runtime bundles it, for its own code, the stock screens and every screen's `react` import: React
//! itself, with `useEffect` and `useLayoutEffect` run through `measured` (`dom.mjs`), so an effect that measures a
//! box the engine has not laid out yet runs again once it has (layout readback).
const W0 = em ?? J0;
function Xt(n, l) {
  return J.useEffect(If(n), l);
}
function Al(n, l) {
  return J.useLayoutEffect(If(n), l);
}
const F0 = /* @__PURE__ */ Hs({
  __proto__: null,
  default: W0,
  useEffect: Xt,
  useLayoutEffect: Al
}, [J]);
var ns = { exports: {} }, _l = {};
/**
 * @license React
 * react-jsx-runtime.production.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var Pd;
function $0() {
  if (Pd) return _l;
  Pd = 1;
  var n = Symbol.for("react.transitional.element"), l = Symbol.for("react.fragment");
  function i(o, s, u) {
    var m = null;
    if (u !== void 0 && (m = "" + u), s.key !== void 0 && (m = "" + s.key), "key" in s) {
      u = {};
      for (var f in s)
        f !== "key" && (u[f] = s[f]);
    } else u = s;
    return s = u.ref, {
      $$typeof: n,
      type: o,
      key: m,
      ref: s !== void 0 ? s : null,
      props: u
    };
  }
  return _l.Fragment = l, _l.jsx = i, _l.jsxs = i, _l;
}
var tf;
function I0() {
  return tf || (tf = 1, ns.exports = $0()), ns.exports;
}
var et = I0();
const P0 = /* @__PURE__ */ Ys(et), Ax = /* @__PURE__ */ Hs({
  __proto__: null,
  default: P0
}, [et]);
var as = { exports: {} }, ls = { exports: {} };
const tg = /* @__PURE__ */ K0(F0);
var rs = { exports: {} }, is = {};
/**
 * @license React
 * scheduler.production.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var ef;
function eg() {
  return ef || (ef = 1, (function(n) {
    function l(U, V) {
      var I = U.length;
      U.push(V);
      t: for (; 0 < I; ) {
        var L = I - 1 >>> 1, K = U[L];
        if (0 < s(K, V))
          U[L] = V, U[I] = K, I = L;
        else break t;
      }
    }
    function i(U) {
      return U.length === 0 ? null : U[0];
    }
    function o(U) {
      if (U.length === 0) return null;
      var V = U[0], I = U.pop();
      if (I !== V) {
        U[0] = I;
        t: for (var L = 0, K = U.length, M = K >>> 1; L < M; ) {
          var X = 2 * (L + 1) - 1, at = U[X], st = X + 1, ct = U[st];
          if (0 > s(at, I))
            st < K && 0 > s(ct, at) ? (U[L] = ct, U[st] = I, L = st) : (U[L] = at, U[X] = I, L = X);
          else if (st < K && 0 > s(ct, I))
            U[L] = ct, U[st] = I, L = st;
          else break t;
        }
      }
      return V;
    }
    function s(U, V) {
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
    var p = [], x = [], _ = 1, k = null, y = 3, S = !1, z = !1, j = !1, T = !1, A = typeof setTimeout == "function" ? setTimeout : null, R = typeof clearTimeout == "function" ? clearTimeout : null, B = typeof setImmediate < "u" ? setImmediate : null;
    function Z(U) {
      for (var V = i(x); V !== null; ) {
        if (V.callback === null) o(x);
        else if (V.startTime <= U)
          o(x), V.sortIndex = V.expirationTime, l(p, V);
        else break;
        V = i(x);
      }
    }
    function F(U) {
      if (j = !1, Z(U), !z)
        if (i(p) !== null)
          z = !0, D || (D = !0, E());
        else {
          var V = i(x);
          V !== null && W(F, V.startTime - U);
        }
    }
    var D = !1, h = -1, b = 5, g = -1;
    function w() {
      return T ? !0 : !(n.unstable_now() - g < b);
    }
    function N() {
      if (T = !1, D) {
        var U = n.unstable_now();
        g = U;
        var V = !0;
        try {
          t: {
            z = !1, j && (j = !1, R(h), h = -1), S = !0;
            var I = y;
            try {
              e: {
                for (Z(U), k = i(p); k !== null && !(k.expirationTime > U && w()); ) {
                  var L = k.callback;
                  if (typeof L == "function") {
                    k.callback = null, y = k.priorityLevel;
                    var K = L(
                      k.expirationTime <= U
                    );
                    if (U = n.unstable_now(), typeof K == "function") {
                      k.callback = K, Z(U), V = !0;
                      break e;
                    }
                    k === i(p) && o(p), Z(U);
                  } else o(p);
                  k = i(p);
                }
                if (k !== null) V = !0;
                else {
                  var M = i(x);
                  M !== null && W(
                    F,
                    M.startTime - U
                  ), V = !1;
                }
              }
              break t;
            } finally {
              k = null, y = I, S = !1;
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
      var O = new MessageChannel(), Q = O.port2;
      O.port1.onmessage = N, E = function() {
        Q.postMessage(null);
      };
    } else
      E = function() {
        A(N, 0);
      };
    function W(U, V) {
      h = A(function() {
        U(n.unstable_now());
      }, V);
    }
    n.unstable_IdlePriority = 5, n.unstable_ImmediatePriority = 1, n.unstable_LowPriority = 4, n.unstable_NormalPriority = 3, n.unstable_Profiling = null, n.unstable_UserBlockingPriority = 2, n.unstable_cancelCallback = function(U) {
      U.callback = null;
    }, n.unstable_forceFrameRate = function(U) {
      0 > U || 125 < U ? console.error(
        "forceFrameRate takes a positive int between 0 and 125, forcing frame rates higher than 125 fps is not supported"
      ) : b = 0 < U ? Math.floor(1e3 / U) : 5;
    }, n.unstable_getCurrentPriorityLevel = function() {
      return y;
    }, n.unstable_next = function(U) {
      switch (y) {
        case 1:
        case 2:
        case 3:
          var V = 3;
          break;
        default:
          V = y;
      }
      var I = y;
      y = V;
      try {
        return U();
      } finally {
        y = I;
      }
    }, n.unstable_requestPaint = function() {
      T = !0;
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
      var I = y;
      y = U;
      try {
        return V();
      } finally {
        y = I;
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
        id: _++,
        callback: V,
        priorityLevel: U,
        startTime: I,
        expirationTime: K,
        sortIndex: -1
      }, I > L ? (U.sortIndex = I, l(x, U), i(p) === null && U === i(x) && (j ? (R(h), h = -1) : j = !0, W(F, I - L))) : (U.sortIndex = K, l(p, U), z || S || (z = !0, D || (D = !0, E()))), U;
    }, n.unstable_shouldYield = w, n.unstable_wrapCallback = function(U) {
      var V = y;
      return function() {
        var I = y;
        y = V;
        try {
          return U.apply(this, arguments);
        } finally {
          y = I;
        }
      };
    };
  })(is)), is;
}
var nf;
function ng() {
  return nf || (nf = 1, rs.exports = eg()), rs.exports;
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
var af;
function ag() {
  return af || (af = 1, (function(n) {
    n.exports = function(l) {
      function i(t, e, a, r) {
        return new jp(t, e, a, r);
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
      function u(t) {
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
        if (u(t) !== t)
          throw Error(s(188));
      }
      function f(t) {
        var e = t.alternate;
        if (!e) {
          if (e = u(t), e === null) throw Error(s(188));
          return e !== t ? null : t;
        }
        for (var a = t, r = e; ; ) {
          var c = a.return;
          if (c === null) break;
          var d = c.alternate;
          if (d === null) {
            if (r = c.return, r !== null) {
              a = r;
              continue;
            }
            break;
          }
          if (c.child === d.child) {
            for (d = c.child; d; ) {
              if (d === a) return m(c), t;
              if (d === r) return m(c), e;
              d = d.sibling;
            }
            throw Error(s(188));
          }
          if (a.return !== r.return) a = c, r = d;
          else {
            for (var v = !1, C = c.child; C; ) {
              if (C === a) {
                v = !0, a = c, r = d;
                break;
              }
              if (C === r) {
                v = !0, r = c, a = d;
                break;
              }
              C = C.sibling;
            }
            if (!v) {
              for (C = d.child; C; ) {
                if (C === a) {
                  v = !0, a = d, r = c;
                  break;
                }
                if (C === r) {
                  v = !0, r = d, a = c;
                  break;
                }
                C = C.sibling;
              }
              if (!v) throw Error(s(189));
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
      function _(t) {
        return t === null || typeof t != "object" ? null : (t = dd && t[dd] || t["@@iterator"], typeof t == "function" ? t : null);
      }
      function k(t) {
        if (t == null) return null;
        if (typeof t == "function")
          return t.$$typeof === Bp ? null : t.displayName || t.name || null;
        if (typeof t == "string") return t;
        switch (t) {
          case xa:
            return "Fragment";
          case wo:
            return "Profiler";
          case cd:
            return "StrictMode";
          case ko:
            return "Suspense";
          case So:
            return "SuspenseList";
          case zo:
            return "Activity";
        }
        if (typeof t == "object")
          switch (t.$$typeof) {
            case ya:
              return "Portal";
            case Sn:
              return t.displayName || "Context";
            case ud:
              return (t._context.displayName || "Context") + ".Consumer";
            case _o:
              var e = t.render;
              return t = t.displayName, t || (t = e.displayName || e.name || "", t = t !== "" ? "ForwardRef(" + t + ")" : "ForwardRef"), t;
            case Eo:
              return e = t.displayName || null, e !== null ? e : k(t.type) || "Memo";
            case En:
              e = t._payload, t = t._init;
              try {
                return k(t(e));
              } catch {
              }
          }
        return null;
      }
      function y(t) {
        return { current: t };
      }
      function S(t) {
        0 > ka || (t.current = jo[ka], jo[ka] = null, ka--);
      }
      function z(t, e) {
        ka++, jo[ka] = t.current, t.current = e;
      }
      function j(t) {
        return t >>>= 0, t === 0 ? 32 : 31 - (d0(t) / f0 | 0) | 0;
      }
      function T(t) {
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
      function A(t, e, a) {
        var r = t.pendingLanes;
        if (r === 0) return 0;
        var c = 0, d = t.suspendedLanes, v = t.pingedLanes;
        t = t.warmLanes;
        var C = r & 134217727;
        return C !== 0 ? (r = C & ~d, r !== 0 ? c = T(r) : (v &= C, v !== 0 ? c = T(v) : a || (a = C & ~t, a !== 0 && (c = T(a))))) : (C = r & ~d, C !== 0 ? c = T(C) : v !== 0 ? c = T(v) : a || (a = r & ~t, a !== 0 && (c = T(a)))), c === 0 ? 0 : e !== 0 && e !== c && (e & d) === 0 && (d = c & -c, a = e & -e, d >= a || d === 32 && (a & 4194048) !== 0) ? e : c;
      }
      function R(t, e) {
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
      function Z() {
        var t = gr;
        return gr <<= 1, (gr & 62914560) === 0 && (gr = 4194304), t;
      }
      function F(t) {
        for (var e = [], a = 0; 31 > a; a++) e.push(t);
        return e;
      }
      function D(t, e) {
        t.pendingLanes |= e, e !== 268435456 && (t.suspendedLanes = 0, t.pingedLanes = 0, t.warmLanes = 0);
      }
      function h(t, e, a, r, c, d) {
        var v = t.pendingLanes;
        t.pendingLanes = a, t.suspendedLanes = 0, t.pingedLanes = 0, t.warmLanes = 0, t.expiredLanes &= a, t.entangledLanes &= a, t.errorRecoveryDisabledLanes &= a, t.shellSuspendCounter = 0;
        var C = t.entanglements, q = t.expirationTimes, $ = t.hiddenUpdates;
        for (a = v & ~a; 0 < a; ) {
          var nt = 31 - _e(a), P = 1 << nt;
          C[nt] = 0, q[nt] = -1;
          var lt = $[nt];
          if (lt !== null)
            for ($[nt] = null, nt = 0; nt < lt.length; nt++) {
              var gt = lt[nt];
              gt !== null && (gt.lane &= -536870913);
            }
          a &= ~P;
        }
        r !== 0 && b(t, r, 0), d !== 0 && c === 0 && t.tag !== 0 && (t.suspendedLanes |= d & ~(v & ~e));
      }
      function b(t, e, a) {
        t.pendingLanes |= e, t.suspendedLanes &= ~e;
        var r = 31 - _e(e);
        t.entangledLanes |= e, t.entanglements[r] = t.entanglements[r] | 1073741824 | a & 261930;
      }
      function g(t, e) {
        var a = t.entangledLanes |= e;
        for (t = t.entanglements; a; ) {
          var r = 31 - _e(a), c = 1 << r;
          c & e | t[r] & e && (t[r] |= e), a &= ~c;
        }
      }
      function w(t, e) {
        var a = e & -e;
        return a = (a & 42) !== 0 ? 1 : N(a), (a & (t.suspendedLanes | e)) !== 0 ? 0 : a;
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
      function O(t) {
        if (typeof b0 == "function" && v0(t), ke && typeof ke.setStrictMode == "function")
          try {
            ke.setStrictMode(cl, t);
          } catch {
          }
      }
      function Q(t, e) {
        return t === e && (t !== 0 || 1 / t === 1 / e) || t !== t && e !== e;
      }
      function W(t) {
        if (Do === void 0)
          try {
            throw Error();
          } catch (a) {
            var e = a.stack.trim().match(/\n( *(at )?)/);
            Do = e && e[1] || "", Bd = -1 < a.stack.indexOf(`
    at`) ? " (<anonymous>)" : -1 < a.stack.indexOf("@") ? "@unknown:0:0" : "";
          }
        return `
` + Do + t + Bd;
      }
      function U(t, e) {
        if (!t || Ho) return "";
        Ho = !0;
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
          var d = r.DetermineComponentFrameRoot(), v = d[0], C = d[1];
          if (v && C) {
            var q = v.split(`
`), $ = C.split(`
`);
            for (c = r = 0; r < q.length && !q[r].includes("DetermineComponentFrameRoot"); )
              r++;
            for (; c < $.length && !$[c].includes(
              "DetermineComponentFrameRoot"
            ); )
              c++;
            if (r === q.length || c === $.length)
              for (r = q.length - 1, c = $.length - 1; 1 <= r && 0 <= c && q[r] !== $[c]; )
                c--;
            for (; 1 <= r && 0 <= c; r--, c--)
              if (q[r] !== $[c]) {
                if (r !== 1 || c !== 1)
                  do
                    if (r--, c--, 0 > c || q[r] !== $[c]) {
                      var nt = `
` + q[r].replace(" at new ", " at ");
                      return t.displayName && nt.includes("<anonymous>") && (nt = nt.replace("<anonymous>", t.displayName)), nt;
                    }
                  while (1 <= r && 0 <= c);
                break;
              }
          }
        } finally {
          Ho = !1, Error.prepareStackTrace = a;
        }
        return (a = t ? t.displayName || t.name : "") ? W(a) : "";
      }
      function V(t, e) {
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
            return U(t.type, !1);
          case 11:
            return U(t.type.render, !1);
          case 1:
            return U(t.type, !0);
          case 31:
            return W("Activity");
          default:
            return "";
        }
      }
      function I(t) {
        try {
          var e = "", a = null;
          do
            e += V(t, a), a = t, t = t.return;
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
          var a = Ud.get(t);
          return a !== void 0 ? a : (e = {
            value: t,
            source: e,
            stack: I(e)
          }, Ud.set(t, e), e);
        }
        return {
          value: t,
          source: e,
          stack: I(e)
        };
      }
      function K(t, e) {
        Ea[za++] = ul, Ea[za++] = vr, vr = t, ul = e;
      }
      function M(t, e, a) {
        Me[Ce++] = Ze, Me[Ce++] = Je, Me[Ce++] = zn, zn = t;
        var r = Ze;
        t = Je;
        var c = 32 - _e(r) - 1;
        r &= ~(1 << c), a += 1;
        var d = 32 - _e(e) + c;
        if (30 < d) {
          var v = c - c % 5;
          d = (r & (1 << v) - 1).toString(32), r >>= v, c -= v, Ze = 1 << 32 - _e(e) + c | a << c | r, Je = d + t;
        } else
          Ze = 1 << d | a << c | r, Je = t;
      }
      function X(t) {
        t.return !== null && (K(t, 1), M(t, 1, 0));
      }
      function at(t) {
        for (; t === vr; )
          vr = Ea[--za], Ea[za] = null, ul = Ea[--za], Ea[za] = null;
        for (; t === zn; )
          zn = Me[--Ce], Me[Ce] = null, Je = Me[--Ce], Me[Ce] = null, Ze = Me[--Ce], Me[Ce] = null;
      }
      function st(t, e) {
        Me[Ce++] = Ze, Me[Ce++] = Je, Me[Ce++] = zn, Ze = e.id, Je = e.overflow, zn = t;
      }
      function ct(t, e) {
        z(Nn, e), z(dl, t), z(ae, null), t = Yp(e), S(ae), z(ae, t);
      }
      function ut() {
        S(ae), S(dl), S(Nn);
      }
      function Et(t) {
        t.memoizedState !== null && z(yr, t);
        var e = ae.current, a = qp(e, t.type);
        e !== a && (z(dl, t), z(ae, a));
      }
      function $t(t) {
        dl.current === t && (S(ae), S(dl)), yr.current === t && (S(yr), rn ? ta._currentValue = wa : ta._currentValue2 = wa);
      }
      function ht(t) {
        var e = Error(
          s(
            418,
            1 < arguments.length && arguments[1] !== void 0 && arguments[1] ? "text" : "HTML",
            ""
          )
        );
        throw Ka(L(e, t)), Bo;
      }
      function Vn(t, e) {
        if (!ue) throw Error(s(175));
        qh(
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
        if (Jt ? e !== 3 && e !== 27 && (e !== 5 || Sd(t.type) && !mr(t.type, t.memoizedProps)) && Rt && ht(t) : e !== 3 && (e !== 5 || Sd(t.type) && !mr(t.type, t.memoizedProps)) && Rt && ht(t), Kn(t), e === 13) {
          if (!ue) throw Error(s(316));
          if (t = t.memoizedState, t = t !== null ? t.dehydrated : null, !t) throw Error(s(317));
          Rt = Xh(t);
        } else if (e === 31) {
          if (t = t.memoizedState, t = t !== null ? t.dehydrated : null, !t) throw Error(s(317));
          Rt = Kh(t);
        } else
          Rt = Jt && e === 27 ? Ah(
            t.type,
            Rt
          ) : le ? kd(t.stateNode) : null;
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
      function bn(t, e, a) {
        rn ? (z(xr, e._currentValue), e._currentValue = a) : (z(xr, e._currentValue2), e._currentValue2 = a);
      }
      function Pe(t) {
        var e = xr.current;
        rn ? t._currentValue = e : t._currentValue2 = e, S(xr);
      }
      function bi(t, e, a) {
        for (; t !== null; ) {
          var r = t.alternate;
          if ((t.childLanes & e) !== e ? (t.childLanes |= e, r !== null && (r.childLanes |= e)) : r !== null && (r.childLanes & e) !== e && (r.childLanes |= e), t === a) break;
          t = t.return;
        }
      }
      function vi(t, e, a, r) {
        var c = t.child;
        for (c !== null && (c.return = t); c !== null; ) {
          var d = c.dependencies;
          if (d !== null) {
            var v = c.child;
            d = d.firstContext;
            t: for (; d !== null; ) {
              var C = d;
              d = c;
              for (var q = 0; q < e.length; q++)
                if (C.context === e[q]) {
                  d.lanes |= a, C = d.alternate, C !== null && (C.lanes |= a), bi(
                    d.return,
                    a,
                    t
                  ), r || (v = null);
                  break t;
                }
              d = C.next;
            }
          } else if (c.tag === 18) {
            if (v = c.return, v === null) throw Error(s(341));
            v.lanes |= a, d = v.alternate, d !== null && (d.lanes |= a), bi(v, a, t), v = null;
          } else v = c.child;
          if (v !== null) v.return = c;
          else
            for (v = c; v !== null; ) {
              if (v === t) {
                v = null;
                break;
              }
              if (c = v.sibling, c !== null) {
                c.return = v.return, v = c;
                break;
              }
              v = v.return;
            }
          c = v;
        }
      }
      function ma(t, e, a, r) {
        t = null;
        for (var c = e, d = !1; c !== null; ) {
          if (!d) {
            if ((c.flags & 524288) !== 0) d = !0;
            else if ((c.flags & 262144) !== 0) break;
          }
          if (c.tag === 10) {
            var v = c.alternate;
            if (v === null) throw Error(s(387));
            if (v = v.memoizedProps, v !== null) {
              var C = c.type;
              Se(c.pendingProps.value, v.value) || (t !== null ? t.push(C) : t = [C]);
            }
          } else if (c === yr.current) {
            if (v = c.alternate, v === null) throw Error(s(387));
            v.memoizedState.memoizedState !== c.memoizedState.memoizedState && (t !== null ? t.push(ta) : t = [ta]);
          }
          c = c.return;
        }
        t !== null && vi(
          e,
          t,
          a,
          r
        ), e.flags |= 262144;
      }
      function Hl(t) {
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
        ea = t, sn = null, t = t.dependencies, t !== null && (t.firstContext = null);
      }
      function ee(t) {
        return $s(ea, t);
      }
      function Bl(t, e) {
        return ea === null && Xn(t), $s(t, e);
      }
      function $s(t, e) {
        var a = rn ? e._currentValue : e._currentValue2;
        if (e = { context: e, memoizedValue: a, next: null }, sn === null) {
          if (t === null) throw Error(s(308));
          sn = e, t.dependencies = { lanes: 0, firstContext: e }, t.flags |= 524288;
        } else sn = sn.next = e;
        return a;
      }
      function yi() {
        return {
          controller: new x0(),
          data: /* @__PURE__ */ new Map(),
          refCount: 0
        };
      }
      function Xa(t) {
        t.refCount--, t.refCount === 0 && w0(_0, function() {
          t.controller.abort();
        });
      }
      function Ul() {
      }
      function Ve(t) {
        t !== Na && t.next === null && (Na === null ? wr = Na = t : Na = Na.next = t), _r = !0, Uo || (Uo = !0, sp());
      }
      function pa(t, e) {
        if (!Go && _r) {
          Go = !0;
          do
            for (var a = !1, r = wr; r !== null; ) {
              if (t !== 0) {
                var c = r.pendingLanes;
                if (c === 0) var d = 0;
                else {
                  var v = r.suspendedLanes, C = r.pingedLanes;
                  d = (1 << 31 - _e(42 | t) + 1) - 1, d &= c & ~(v & ~C), d = d & 201326741 ? d & 201326741 | 1 : d ? d | 2 : 0;
                }
                d !== 0 && (a = !0, nc(r, d));
              } else
                d = kt, d = A(
                  r,
                  r === At ? d : 0,
                  r.cancelPendingCommit !== null || r.timeoutHandle !== Pn
                ), (d & 3) === 0 || R(r, d) || (a = !0, nc(r, d));
              r = r.next;
            }
          while (a);
          Go = !1;
        }
      }
      function Is() {
        Ps();
      }
      function Ps() {
        _r = Uo = !1;
        var t = 0;
        na !== 0 && Fp() && (t = na);
        for (var e = ge(), a = null, r = wr; r !== null; ) {
          var c = r.next, d = tc(r, e);
          d === 0 ? (r.next = null, a === null ? wr = c : a.next = c, c === null && (Na = a)) : (a = r, (t !== 0 || (d & 3) !== 0) && (_r = !0)), r = c;
        }
        Wt !== 0 && Wt !== 5 || pa(t), na !== 0 && (na = 0);
      }
      function tc(t, e) {
        for (var a = t.suspendedLanes, r = t.pingedLanes, c = t.expirationTimes, d = t.pendingLanes & -62914561; 0 < d; ) {
          var v = 31 - _e(d), C = 1 << v, q = c[v];
          q === -1 ? ((C & a) === 0 || (C & r) !== 0) && (c[v] = B(C, e)) : q <= e && (t.expiredLanes |= C), d &= ~C;
        }
        if (e = At, a = kt, a = A(
          t,
          t === e ? a : 0,
          t.cancelPendingCommit !== null || t.timeoutHandle !== Pn
        ), r = t.callbackNode, a === 0 || t === e && (Mt === 2 || Mt === 9) || t.cancelPendingCommit !== null)
          return r !== null && r !== null && Oo(r), t.callbackNode = null, t.callbackPriority = 0;
        if ((a & 3) === 0 || R(t, a)) {
          if (e = a & -a, e === t.callbackPriority) return e;
          switch (r !== null && Oo(r), E(a)) {
            case 2:
            case 8:
              a = h0;
              break;
            case 32:
              a = Ro;
              break;
            case 268435456:
              a = g0;
              break;
            default:
              a = Ro;
          }
          return r = ec.bind(null, t), a = br(a, r), t.callbackPriority = e, t.callbackNode = a, e;
        }
        return r !== null && r !== null && Oo(r), t.callbackPriority = 2, t.callbackNode = null, 2;
      }
      function ec(t, e) {
        if (Wt !== 0 && Wt !== 5)
          return t.callbackNode = null, t.callbackPriority = 0, null;
        var a = t.callbackNode;
        if (rl() && t.callbackNode !== a)
          return null;
        var r = kt;
        return r = A(
          t,
          t === At ? r : 0,
          t.cancelPendingCommit !== null || t.timeoutHandle !== Pn
        ), r === 0 ? null : (Uu(t, r, e), tc(t, ge()), t.callbackNode != null && t.callbackNode === a ? ec.bind(null, t) : null);
      }
      function nc(t, e) {
        if (rl()) return null;
        Uu(t, e, !0);
      }
      function sp() {
        ah ? lh(function() {
          (wt & 6) !== 0 ? br(
            Dd,
            Is
          ) : Ps();
        }) : br(
          Dd,
          Is
        );
      }
      function xi() {
        if (na === 0) {
          var t = Ta;
          t === 0 && (t = pr, pr <<= 1, (pr & 261888) === 0 && (pr = 256)), na = t;
        }
        return na;
      }
      function cp(t, e) {
        if (fl === null) {
          var a = fl = [];
          Yo = 0, Ta = xi(), Ma = {
            status: "pending",
            value: void 0,
            then: function(r) {
              a.push(r);
            }
          };
        }
        return Yo++, e.then(ac, ac), e;
      }
      function ac() {
        if (--Yo === 0 && fl !== null) {
          Ma !== null && (Ma.status = "fulfilled");
          var t = fl;
          fl = null, Ta = 0, Ma = null;
          for (var e = 0; e < t.length; e++) (0, t[e])();
        }
      }
      function up(t, e) {
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
      function wi() {
        var t = aa.current;
        return t !== null ? t : At.pooledCache;
      }
      function Gl(t, e) {
        e === null ? z(aa, aa.current) : z(aa, e.pool);
      }
      function lc() {
        var t = wi();
        return t === null ? null : {
          parent: rn ? Dt._currentValue : Dt._currentValue2,
          pool: t
        };
      }
      function Yl(t, e) {
        if (Se(t, e)) return !0;
        if (typeof t != "object" || t === null || typeof e != "object" || e === null)
          return !1;
        var a = Object.keys(t), r = Object.keys(e);
        if (a.length !== r.length) return !1;
        for (r = 0; r < a.length; r++) {
          var c = a[r];
          if (!y0.call(e, c) || !Se(t[c], e[c]))
            return !1;
        }
        return !0;
      }
      function rc(t) {
        return t = t.status, t === "fulfilled" || t === "rejected";
      }
      function ic(t, e, a) {
        switch (a = t[a], a === void 0 ? t.push(e) : a !== e && (e.then(Ul, Ul), e = a), e.status) {
          case "fulfilled":
            return e.value;
          case "rejected":
            throw t = e.reason, sc(t), t;
          default:
            if (typeof e.status == "string") e.then(Ul, Ul);
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
                throw t = e.reason, sc(t), t;
            }
            throw la = e, Ca;
        }
      }
      function Zn(t) {
        try {
          var e = t._init;
          return e(t._payload);
        } catch (a) {
          throw a !== null && typeof a == "object" && typeof a.then == "function" ? (la = a, Ca) : a;
        }
      }
      function oc() {
        if (la === null) throw Error(s(459));
        var t = la;
        return la = null, t;
      }
      function sc(t) {
        if (t === Ca || t === kr)
          throw Error(s(483));
      }
      function ql(t) {
        var e = ml;
        return ml += 1, Aa === null && (Aa = []), ic(Aa, t, e);
      }
      function Za(t, e) {
        e = e.props.ref, t.ref = e !== void 0 ? e : null;
      }
      function Ll(t, e) {
        throw e.$$typeof === Dp ? Error(s(525)) : (t = Object.prototype.toString.call(e), Error(
          s(
            31,
            t === "[object Object]" ? "object with keys {" + Object.keys(e).join(", ") + "}" : t
          )
        ));
      }
      function cc(t) {
        function e(G, H) {
          if (t) {
            var Y = G.deletions;
            Y === null ? (G.deletions = [H], G.flags |= 16) : Y.push(H);
          }
        }
        function a(G, H) {
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
        function d(G, H, Y) {
          return G.index = Y, t ? (Y = G.alternate, Y !== null ? (Y = Y.index, Y < H ? (G.flags |= 67108866, H) : Y) : (G.flags |= 67108866, H)) : (G.flags |= 1048576, H);
        }
        function v(G) {
          return t && G.alternate === null && (G.flags |= 67108866), G;
        }
        function C(G, H, Y, tt) {
          return H === null || H.tag !== 6 ? (H = bo(Y, G.mode, tt), H.return = G, H) : (H = c(H, Y), H.return = G, H);
        }
        function q(G, H, Y, tt) {
          var ft = Y.type;
          return ft === xa ? nt(
            G,
            H,
            Y.props.children,
            tt,
            Y.key
          ) : H !== null && (H.elementType === ft || typeof ft == "object" && ft !== null && ft.$$typeof === En && Zn(ft) === H.type) ? (H = c(H, Y.props), Za(H, Y), H.return = G, H) : (H = ur(
            Y.type,
            Y.key,
            Y.props,
            null,
            G.mode,
            tt
          ), Za(H, Y), H.return = G, H);
        }
        function $(G, H, Y, tt) {
          return H === null || H.tag !== 4 || H.stateNode.containerInfo !== Y.containerInfo || H.stateNode.implementation !== Y.implementation ? (H = vo(Y, G.mode, tt), H.return = G, H) : (H = c(H, Y.children || []), H.return = G, H);
        }
        function nt(G, H, Y, tt, ft) {
          return H === null || H.tag !== 7 ? (H = In(
            Y,
            G.mode,
            tt,
            ft
          ), H.return = G, H) : (H = c(H, Y), H.return = G, H);
        }
        function P(G, H, Y) {
          if (typeof H == "string" && H !== "" || typeof H == "number" || typeof H == "bigint")
            return H = bo(
              "" + H,
              G.mode,
              Y
            ), H.return = G, H;
          if (typeof H == "object" && H !== null) {
            switch (H.$$typeof) {
              case dr:
                return Y = ur(
                  H.type,
                  H.key,
                  H.props,
                  null,
                  G.mode,
                  Y
                ), Za(Y, H), Y.return = G, Y;
              case ya:
                return H = vo(
                  H,
                  G.mode,
                  Y
                ), H.return = G, H;
              case En:
                return H = Zn(H), P(G, H, Y);
            }
            if (fr(H) || _(H))
              return H = In(
                H,
                G.mode,
                Y,
                null
              ), H.return = G, H;
            if (typeof H.then == "function")
              return P(G, ql(H), Y);
            if (H.$$typeof === Sn)
              return P(
                G,
                Bl(G, H),
                Y
              );
            Ll(G, H);
          }
          return null;
        }
        function lt(G, H, Y, tt) {
          var ft = H !== null ? H.key : null;
          if (typeof Y == "string" && Y !== "" || typeof Y == "number" || typeof Y == "bigint")
            return ft !== null ? null : C(G, H, "" + Y, tt);
          if (typeof Y == "object" && Y !== null) {
            switch (Y.$$typeof) {
              case dr:
                return Y.key === ft ? q(G, H, Y, tt) : null;
              case ya:
                return Y.key === ft ? $(G, H, Y, tt) : null;
              case En:
                return Y = Zn(Y), lt(G, H, Y, tt);
            }
            if (fr(Y) || _(Y))
              return ft !== null ? null : nt(G, H, Y, tt, null);
            if (typeof Y.then == "function")
              return lt(
                G,
                H,
                ql(Y),
                tt
              );
            if (Y.$$typeof === Sn)
              return lt(
                G,
                H,
                Bl(G, Y),
                tt
              );
            Ll(G, Y);
          }
          return null;
        }
        function gt(G, H, Y, tt, ft) {
          if (typeof tt == "string" && tt !== "" || typeof tt == "number" || typeof tt == "bigint")
            return G = G.get(Y) || null, C(H, G, "" + tt, ft);
          if (typeof tt == "object" && tt !== null) {
            switch (tt.$$typeof) {
              case dr:
                return G = G.get(
                  tt.key === null ? Y : tt.key
                ) || null, q(H, G, tt, ft);
              case ya:
                return G = G.get(
                  tt.key === null ? Y : tt.key
                ) || null, $(H, G, tt, ft);
              case En:
                return tt = Zn(tt), gt(
                  G,
                  H,
                  Y,
                  tt,
                  ft
                );
            }
            if (fr(tt) || _(tt))
              return G = G.get(Y) || null, nt(H, G, tt, ft, null);
            if (typeof tt.then == "function")
              return gt(
                G,
                H,
                Y,
                ql(tt),
                ft
              );
            if (tt.$$typeof === Sn)
              return gt(
                G,
                H,
                Y,
                Bl(H, tt),
                ft
              );
            Ll(H, tt);
          }
          return null;
        }
        function re(G, H, Y, tt) {
          for (var ft = null, Ht = null, mt = H, Nt = H = 0, te = null; mt !== null && Nt < Y.length; Nt++) {
            mt.index > Nt ? (te = mt, mt = null) : te = mt.sibling;
            var Tt = lt(
              G,
              mt,
              Y[Nt],
              tt
            );
            if (Tt === null) {
              mt === null && (mt = te);
              break;
            }
            t && mt && Tt.alternate === null && e(G, mt), H = d(Tt, H, Nt), Ht === null ? ft = Tt : Ht.sibling = Tt, Ht = Tt, mt = te;
          }
          if (Nt === Y.length)
            return a(G, mt), St && K(G, Nt), ft;
          if (mt === null) {
            for (; Nt < Y.length; Nt++)
              mt = P(G, Y[Nt], tt), mt !== null && (H = d(
                mt,
                H,
                Nt
              ), Ht === null ? ft = mt : Ht.sibling = mt, Ht = mt);
            return St && K(G, Nt), ft;
          }
          for (mt = r(mt); Nt < Y.length; Nt++)
            te = gt(
              mt,
              G,
              Nt,
              Y[Nt],
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
        function xl(G, H, Y, tt) {
          if (Y == null) throw Error(s(151));
          for (var ft = null, Ht = null, mt = H, Nt = H = 0, te = null, Tt = Y.next(); mt !== null && !Tt.done; Nt++, Tt = Y.next()) {
            mt.index > Nt ? (te = mt, mt = null) : te = mt.sibling;
            var Rn = lt(G, mt, Tt.value, tt);
            if (Rn === null) {
              mt === null && (mt = te);
              break;
            }
            t && mt && Rn.alternate === null && e(G, mt), H = d(Rn, H, Nt), Ht === null ? ft = Rn : Ht.sibling = Rn, Ht = Rn, mt = te;
          }
          if (Tt.done)
            return a(G, mt), St && K(G, Nt), ft;
          if (mt === null) {
            for (; !Tt.done; Nt++, Tt = Y.next())
              Tt = P(G, Tt.value, tt), Tt !== null && (H = d(
                Tt,
                H,
                Nt
              ), Ht === null ? ft = Tt : Ht.sibling = Tt, Ht = Tt);
            return St && K(G, Nt), ft;
          }
          for (mt = r(mt); !Tt.done; Nt++, Tt = Y.next())
            Tt = gt(
              mt,
              G,
              Nt,
              Tt.value,
              tt
            ), Tt !== null && (t && Tt.alternate !== null && mt.delete(Tt.key === null ? Nt : Tt.key), H = d(Tt, H, Nt), Ht === null ? ft = Tt : Ht.sibling = Tt, Ht = Tt);
          return t && mt.forEach(function(z0) {
            return e(G, z0);
          }), St && K(G, Nt), ft;
        }
        function sa(G, H, Y, tt) {
          if (typeof Y == "object" && Y !== null && Y.type === xa && Y.key === null && (Y = Y.props.children), typeof Y == "object" && Y !== null) {
            switch (Y.$$typeof) {
              case dr:
                t: {
                  for (var ft = Y.key; H !== null; ) {
                    if (H.key === ft) {
                      if (ft = Y.type, ft === xa) {
                        if (H.tag === 7) {
                          a(
                            G,
                            H.sibling
                          ), tt = c(
                            H,
                            Y.props.children
                          ), tt.return = G, G = tt;
                          break t;
                        }
                      } else if (H.elementType === ft || typeof ft == "object" && ft !== null && ft.$$typeof === En && Zn(ft) === H.type) {
                        a(
                          G,
                          H.sibling
                        ), tt = c(H, Y.props), Za(tt, Y), tt.return = G, G = tt;
                        break t;
                      }
                      a(G, H);
                      break;
                    } else e(G, H);
                    H = H.sibling;
                  }
                  Y.type === xa ? (tt = In(
                    Y.props.children,
                    G.mode,
                    tt,
                    Y.key
                  ), tt.return = G, G = tt) : (tt = ur(
                    Y.type,
                    Y.key,
                    Y.props,
                    null,
                    G.mode,
                    tt
                  ), Za(tt, Y), tt.return = G, G = tt);
                }
                return v(G);
              case ya:
                t: {
                  for (ft = Y.key; H !== null; ) {
                    if (H.key === ft)
                      if (H.tag === 4 && H.stateNode.containerInfo === Y.containerInfo && H.stateNode.implementation === Y.implementation) {
                        a(
                          G,
                          H.sibling
                        ), tt = c(
                          H,
                          Y.children || []
                        ), tt.return = G, G = tt;
                        break t;
                      } else {
                        a(G, H);
                        break;
                      }
                    else e(G, H);
                    H = H.sibling;
                  }
                  tt = vo(Y, G.mode, tt), tt.return = G, G = tt;
                }
                return v(G);
              case En:
                return Y = Zn(Y), sa(
                  G,
                  H,
                  Y,
                  tt
                );
            }
            if (fr(Y))
              return re(
                G,
                H,
                Y,
                tt
              );
            if (_(Y)) {
              if (ft = _(Y), typeof ft != "function")
                throw Error(s(150));
              return Y = ft.call(Y), xl(
                G,
                H,
                Y,
                tt
              );
            }
            if (typeof Y.then == "function")
              return sa(
                G,
                H,
                ql(Y),
                tt
              );
            if (Y.$$typeof === Sn)
              return sa(
                G,
                H,
                Bl(G, Y),
                tt
              );
            Ll(G, Y);
          }
          return typeof Y == "string" && Y !== "" || typeof Y == "number" || typeof Y == "bigint" ? (Y = "" + Y, H !== null && H.tag === 6 ? (a(G, H.sibling), tt = c(H, Y), tt.return = G, G = tt) : (a(G, H), tt = bo(Y, G.mode, tt), tt.return = G, G = tt), v(G)) : a(G, H);
        }
        return function(G, H, Y, tt) {
          try {
            ml = 0;
            var ft = sa(
              G,
              H,
              Y,
              tt
            );
            return Aa = null, ft;
          } catch (mt) {
            if (mt === Ca || mt === kr) throw mt;
            var Ht = i(29, mt, null, G.mode);
            return Ht.lanes = tt, Ht.return = G, Ht;
          } finally {
          }
        };
      }
      function Ql() {
        for (var t = ja, e = Lo = ja = 0; e < t; ) {
          var a = je[e];
          je[e++] = null;
          var r = je[e];
          je[e++] = null;
          var c = je[e];
          je[e++] = null;
          var d = je[e];
          if (je[e++] = null, r !== null && c !== null) {
            var v = r.pending;
            v === null ? c.next = c : (c.next = v.next, v.next = c), r.pending = c;
          }
          d !== 0 && uc(a, c, d);
        }
      }
      function Vl(t, e, a, r) {
        je[ja++] = t, je[ja++] = e, je[ja++] = a, je[ja++] = r, Lo |= r, t.lanes |= r, t = t.alternate, t !== null && (t.lanes |= r);
      }
      function _i(t, e, a, r) {
        return Vl(t, e, a, r), Kl(t);
      }
      function Jn(t, e) {
        return Vl(t, null, null, e), Kl(t);
      }
      function uc(t, e, a) {
        t.lanes |= a;
        var r = t.alternate;
        r !== null && (r.lanes |= a);
        for (var c = !1, d = t.return; d !== null; )
          d.childLanes |= a, r = d.alternate, r !== null && (r.childLanes |= a), d.tag === 22 && (t = d.stateNode, t === null || t._visibility & 1 || (c = !0)), t = d, d = d.return;
        return t.tag === 3 ? (d = t.stateNode, c && e !== null && (c = 31 - _e(a), t = d.hiddenUpdates, r = t[c], r === null ? t[c] = [e] : r.push(e), e.lane = a | 536870912), d) : null;
      }
      function Kl(t) {
        if (50 < yl)
          throw yl = 0, ts = null, Error(s(185));
        for (var e = t.return; e !== null; )
          t = e, e = t.return;
        return t.tag === 3 ? t.stateNode : null;
      }
      function ki(t) {
        t.updateQueue = {
          baseState: t.memoizedState,
          firstBaseUpdate: null,
          lastBaseUpdate: null,
          shared: { pending: null, lanes: 0, hiddenCallbacks: null },
          callbacks: null
        };
      }
      function Si(t, e) {
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
        if (r = r.shared, (wt & 2) !== 0) {
          var c = r.pending;
          return c === null ? e.next = e : (e.next = c.next, c.next = e), r.pending = e, e = Kl(t), uc(t, null, a), e;
        }
        return Vl(t, r, e, a), Kl(t);
      }
      function Ja(t, e, a) {
        if (e = e.updateQueue, e !== null && (e = e.shared, (a & 4194048) !== 0)) {
          var r = e.lanes;
          r &= t.pendingLanes, a |= r, e.lanes = a, g(t, a);
        }
      }
      function Ei(t, e) {
        var a = t.updateQueue, r = t.alternate;
        if (r !== null && (r = r.updateQueue, a === r)) {
          var c = null, d = null;
          if (a = a.firstBaseUpdate, a !== null) {
            do {
              var v = {
                lane: a.lane,
                tag: a.tag,
                payload: a.payload,
                callback: null,
                next: null
              };
              d === null ? c = d = v : d = d.next = v, a = a.next;
            } while (a !== null);
            d === null ? c = d = e : d = d.next = e;
          } else c = d = e;
          a = {
            baseState: r.baseState,
            firstBaseUpdate: c,
            lastBaseUpdate: d,
            shared: r.shared,
            callbacks: r.callbacks
          }, t.updateQueue = a;
          return;
        }
        t = a.lastBaseUpdate, t === null ? a.firstBaseUpdate = e : t.next = e, a.lastBaseUpdate = e;
      }
      function Wa() {
        if (Qo) {
          var t = Ma;
          if (t !== null) throw t;
        }
      }
      function Fa(t, e, a, r) {
        Qo = !1;
        var c = t.updateQueue;
        Mn = !1;
        var d = c.firstBaseUpdate, v = c.lastBaseUpdate, C = c.shared.pending;
        if (C !== null) {
          c.shared.pending = null;
          var q = C, $ = q.next;
          q.next = null, v === null ? d = $ : v.next = $, v = q;
          var nt = t.alternate;
          nt !== null && (nt = nt.updateQueue, C = nt.lastBaseUpdate, C !== v && (C === null ? nt.firstBaseUpdate = $ : C.next = $, nt.lastBaseUpdate = q));
        }
        if (d !== null) {
          var P = c.baseState;
          v = 0, nt = $ = q = null, C = d;
          do {
            var lt = C.lane & -536870913, gt = lt !== C.lane;
            if (gt ? (kt & lt) === lt : (r & lt) === lt) {
              lt !== 0 && lt === Ta && (Qo = !0), nt !== null && (nt = nt.next = {
                lane: 0,
                tag: C.tag,
                payload: C.payload,
                callback: null,
                next: null
              });
              t: {
                var re = t, xl = C;
                lt = e;
                var sa = a;
                switch (xl.tag) {
                  case 1:
                    if (re = xl.payload, typeof re == "function") {
                      P = re.call(
                        sa,
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
                    if (re = xl.payload, lt = typeof re == "function" ? re.call(sa, P, lt) : re, lt == null) break t;
                    P = xo({}, P, lt);
                    break t;
                  case 2:
                    Mn = !0;
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
              }, nt === null ? ($ = nt = gt, q = P) : nt = nt.next = gt, v |= lt;
            if (C = C.next, C === null) {
              if (C = c.shared.pending, C === null)
                break;
              gt = C, C = gt.next, gt.next = null, c.lastBaseUpdate = gt, c.shared.pending = null;
            }
          } while (!0);
          nt === null && (q = P), c.baseState = q, c.firstBaseUpdate = $, c.lastBaseUpdate = nt, d === null && (c.shared.lanes = 0), An |= v, t.lanes = v, t.memoizedState = P;
        }
      }
      function dc(t, e) {
        if (typeof t != "function")
          throw Error(s(191, t));
        t.call(e);
      }
      function fc(t, e) {
        var a = t.callbacks;
        if (a !== null)
          for (t.callbacks = null, t = 0; t < a.length; t++)
            dc(a[t], e);
      }
      function mc(t, e) {
        t = dn, z(Er, t), z(Oa, e), dn = t | e.baseLanes;
      }
      function zi() {
        z(Er, dn), z(Oa, Oa.current);
      }
      function Ni() {
        dn = Er.current, S(Oa), S(Er);
      }
      function xn(t) {
        var e = t.alternate;
        z(Yt, Yt.current & 1), z(Ee, t), Oe === null && (e === null || Oa.current !== null || e.memoizedState !== null) && (Oe = t);
      }
      function Ti(t) {
        z(Yt, Yt.current), z(Ee, t), Oe === null && (Oe = t);
      }
      function pc(t) {
        t.tag === 22 ? (z(Yt, Yt.current), z(Ee, t), Oe === null && (Oe = t)) : wn();
      }
      function wn() {
        z(Yt, Yt.current), z(Ee, Ee.current);
      }
      function ye(t) {
        S(Ee), Oe === t && (Oe = null), S(Yt);
      }
      function Xl(t) {
        for (var e = t; e !== null; ) {
          if (e.tag === 13) {
            var a = e.memoizedState;
            if (a !== null && (a = a.dehydrated, a === null || Mo(a) || Co(a)))
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
      function Mi(t, e) {
        if (e === null) return !1;
        for (var a = 0; a < e.length && a < t.length; a++)
          if (!Se(t[a], e[a])) return !1;
        return !0;
      }
      function Ci(t, e, a, r, c, d) {
        return cn = d, bt = e, e.memoizedState = null, e.updateQueue = null, e.lanes = 0, dt.H = t === null || t.memoizedState === null ? qd : Vo, ia = !1, d = a(r, c), ia = !1, Ra && (d = gc(
          e,
          a,
          r,
          c
        )), hc(t), d;
      }
      function hc(t) {
        dt.H = hl;
        var e = Ct !== null && Ct.next !== null;
        if (cn = 0, Lt = Ct = bt = null, zr = !1, pl = 0, Da = null, e) throw Error(s(300));
        t === null || Qt || (t = t.dependencies, t !== null && Hl(t) && (Qt = !0));
      }
      function gc(t, e, a, r) {
        bt = t;
        var c = 0;
        do {
          if (Ra && (Da = null), pl = 0, Ra = !1, 25 <= c) throw Error(s(301));
          if (c += 1, Lt = Ct = null, t.updateQueue != null) {
            var d = t.updateQueue;
            d.lastEffect = null, d.events = null, d.stores = null, d.memoCache != null && (d.memoCache.index = 0);
          }
          dt.H = Ld, d = e(a, r);
        } while (Ra);
        return d;
      }
      function dp() {
        var t = dt.H, e = t.useState()[0];
        return e = typeof e.then == "function" ? $a(e) : e, t = t.useState()[0], (Ct !== null ? Ct.memoizedState : null) !== t && (bt.flags |= 1024), e;
      }
      function Ai() {
        var t = Nr !== 0;
        return Nr = 0, t;
      }
      function ji(t, e, a) {
        e.updateQueue = t.updateQueue, e.flags &= -2053, t.lanes &= ~a;
      }
      function Oi(t) {
        if (zr) {
          for (t = t.memoizedState; t !== null; ) {
            var e = t.queue;
            e !== null && (e.pending = null), t = t.next;
          }
          zr = !1;
        }
        cn = 0, Lt = Ct = bt = null, Ra = !1, pl = Nr = 0, Da = null;
      }
      function fe() {
        var t = {
          memoizedState: null,
          baseState: null,
          baseQueue: null,
          queue: null,
          next: null
        };
        return Lt === null ? bt.memoizedState = Lt = t : Lt = Lt.next = t, Lt;
      }
      function Gt() {
        if (Ct === null) {
          var t = bt.alternate;
          t = t !== null ? t.memoizedState : null;
        } else t = Ct.next;
        var e = Lt === null ? bt.memoizedState : Lt.next;
        if (e !== null)
          Lt = e, Ct = t;
        else {
          if (t === null)
            throw bt.alternate === null ? Error(s(467)) : Error(s(310));
          Ct = t, t = {
            memoizedState: Ct.memoizedState,
            baseState: Ct.baseState,
            baseQueue: Ct.baseQueue,
            queue: Ct.queue,
            next: null
          }, Lt === null ? bt.memoizedState = Lt = t : Lt = Lt.next = t;
        }
        return Lt;
      }
      function Zl() {
        return { lastEffect: null, events: null, stores: null, memoCache: null };
      }
      function $a(t) {
        var e = pl;
        return pl += 1, Da === null && (Da = []), t = ic(Da, t, e), e = bt, (Lt === null ? e.memoizedState : Lt.next) === null && (e = e.alternate, dt.H = e === null || e.memoizedState === null ? qd : Vo), t;
      }
      function Jl(t) {
        if (t !== null && typeof t == "object") {
          if (typeof t.then == "function") return $a(t);
          if (t.$$typeof === Sn) return ee(t);
        }
        throw Error(s(438, String(t)));
      }
      function Ri(t) {
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
        if (e == null && (e = { data: [], index: 0 }), a === null && (a = Zl(), bt.updateQueue = a), a.memoCache = e, a = e.data[e.index], a === void 0)
          for (a = e.data[e.index] = Array(t), r = 0; r < t; r++)
            a[r] = Hp;
        return e.index++, a;
      }
      function tn(t, e) {
        return typeof e == "function" ? e(t) : e;
      }
      function Wl(t) {
        var e = Gt();
        return Di(e, Ct, t);
      }
      function Di(t, e, a) {
        var r = t.queue;
        if (r === null) throw Error(s(311));
        r.lastRenderedReducer = a;
        var c = t.baseQueue, d = r.pending;
        if (d !== null) {
          if (c !== null) {
            var v = c.next;
            c.next = d.next, d.next = v;
          }
          e.baseQueue = c = d, r.pending = null;
        }
        if (d = t.baseState, c === null) t.memoizedState = d;
        else {
          e = c.next;
          var C = v = null, q = null, $ = e, nt = !1;
          do {
            var P = $.lane & -536870913;
            if (P !== $.lane ? (kt & P) === P : (cn & P) === P) {
              var lt = $.revertLane;
              if (lt === 0)
                q !== null && (q = q.next = {
                  lane: 0,
                  revertLane: 0,
                  gesture: null,
                  action: $.action,
                  hasEagerState: $.hasEagerState,
                  eagerState: $.eagerState,
                  next: null
                }), P === Ta && (nt = !0);
              else if ((cn & lt) === lt) {
                $ = $.next, lt === Ta && (nt = !0);
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
                }, q === null ? (C = q = P, v = d) : q = q.next = P, bt.lanes |= lt, An |= lt;
              P = $.action, ia && a(d, P), d = $.hasEagerState ? $.eagerState : a(d, P);
            } else
              lt = {
                lane: P,
                revertLane: $.revertLane,
                gesture: $.gesture,
                action: $.action,
                hasEagerState: $.hasEagerState,
                eagerState: $.eagerState,
                next: null
              }, q === null ? (C = q = lt, v = d) : q = q.next = lt, bt.lanes |= P, An |= P;
            $ = $.next;
          } while ($ !== null && $ !== e);
          if (q === null ? v = d : q.next = C, !Se(d, t.memoizedState) && (Qt = !0, nt && (a = Ma, a !== null)))
            throw a;
          t.memoizedState = d, t.baseState = v, t.baseQueue = q, r.lastRenderedState = d;
        }
        return c === null && (r.lanes = 0), [t.memoizedState, r.dispatch];
      }
      function Hi(t) {
        var e = Gt(), a = e.queue;
        if (a === null) throw Error(s(311));
        a.lastRenderedReducer = t;
        var r = a.dispatch, c = a.pending, d = e.memoizedState;
        if (c !== null) {
          a.pending = null;
          var v = c = c.next;
          do
            d = t(d, v.action), v = v.next;
          while (v !== c);
          Se(d, e.memoizedState) || (Qt = !0), e.memoizedState = d, e.baseQueue === null && (e.baseState = d), a.lastRenderedState = d;
        }
        return [d, r];
      }
      function bc(t, e, a) {
        var r = bt, c = Gt(), d = St;
        if (d) {
          if (a === void 0)
            throw Error(s(407));
          a = a();
        } else a = e();
        var v = !Se(
          (Ct || c).memoizedState,
          a
        );
        if (v && (c.memoizedState = a, Qt = !0), c = c.queue, Gi(xc.bind(null, r, c, t), [
          t
        ]), c.getSnapshot !== e || v || Lt !== null && Lt.memoizedState.tag & 1) {
          if (r.flags |= 2048, ha(
            9,
            { destroy: void 0 },
            yc.bind(
              null,
              r,
              c,
              a,
              e
            ),
            null
          ), At === null) throw Error(s(349));
          d || (cn & 127) !== 0 || vc(r, e, a);
        }
        return a;
      }
      function vc(t, e, a) {
        t.flags |= 16384, t = { getSnapshot: e, value: a }, e = bt.updateQueue, e === null ? (e = Zl(), bt.updateQueue = e, e.stores = [t]) : (a = e.stores, a === null ? e.stores = [t] : a.push(t));
      }
      function yc(t, e, a, r) {
        e.value = a, e.getSnapshot = r, wc(e) && _c(t);
      }
      function xc(t, e, a) {
        return a(function() {
          wc(e) && _c(t);
        });
      }
      function wc(t) {
        var e = t.getSnapshot;
        t = t.value;
        try {
          var a = e();
          return !Se(t, a);
        } catch {
          return !0;
        }
      }
      function _c(t) {
        var e = Jn(t, 2);
        e !== null && he(e, t, 2);
      }
      function Bi(t) {
        var e = fe();
        if (typeof t == "function") {
          var a = t;
          if (t = a(), ia) {
            O(!0);
            try {
              a();
            } finally {
              O(!1);
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
      function kc(t, e, a, r) {
        return t.baseState = a, Di(
          t,
          Ct,
          typeof r == "function" ? r : tn
        );
      }
      function fp(t, e, a, r, c) {
        if (Il(t)) throw Error(s(485));
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
            then: function(v) {
              d.listeners.push(v);
            }
          };
          dt.T !== null ? a(!0) : d.isTransition = !1, r(d), a = e.pending, a === null ? (d.next = e.pending = d, Sc(e, d)) : (d.next = a.next, e.pending = a.next = d);
        }
      }
      function Sc(t, e) {
        var a = e.action, r = e.payload, c = t.state;
        if (e.isTransition) {
          var d = dt.T, v = {};
          dt.T = v;
          try {
            var C = a(c, r), q = dt.S;
            q !== null && q(v, C), Ec(t, e, C);
          } catch ($) {
            Ui(t, e, $);
          } finally {
            d !== null && v.types !== null && (d.types = v.types), dt.T = d;
          }
        } else
          try {
            d = a(c, r), Ec(t, e, d);
          } catch ($) {
            Ui(t, e, $);
          }
      }
      function Ec(t, e, a) {
        a !== null && typeof a == "object" && typeof a.then == "function" ? a.then(
          function(r) {
            zc(t, e, r);
          },
          function(r) {
            return Ui(t, e, r);
          }
        ) : zc(t, e, a);
      }
      function zc(t, e, a) {
        e.status = "fulfilled", e.value = a, Nc(e), t.state = a, e = t.pending, e !== null && (a = e.next, a === e ? t.pending = null : (a = a.next, e.next = a, Sc(t, a)));
      }
      function Ui(t, e, a) {
        var r = t.pending;
        if (t.pending = null, r !== null) {
          r = r.next;
          do
            e.status = "rejected", e.reason = a, Nc(e), e = e.next;
          while (e !== r);
        }
        t.action = null;
      }
      function Nc(t) {
        t = t.listeners;
        for (var e = 0; e < t.length; e++) (0, t[e])();
      }
      function Tc(t, e) {
        return e;
      }
      function Mc(t, e) {
        if (St) {
          var a = At.formState;
          if (a !== null) {
            t: {
              var r = bt;
              if (St) {
                if (Rt) {
                  var c = Mh(
                    Rt,
                    Ae
                  );
                  if (c) {
                    Rt = kd(c), r = Ch(c);
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
          lastRenderedReducer: Tc,
          lastRenderedState: e
        }, a.queue = r, a = Zc.bind(
          null,
          bt,
          r
        ), r.dispatch = a, r = Bi(!1);
        var d = Qi.bind(
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
        }, r.queue = c, a = fp.bind(
          null,
          bt,
          c,
          d,
          a
        ), c.dispatch = a, r.memoizedState = t, [e, a, !1];
      }
      function Cc(t) {
        var e = Gt();
        return Ac(e, Ct, t);
      }
      function Ac(t, e, a) {
        if (e = Di(
          t,
          e,
          Tc
        )[0], t = Wl(tn)[0], typeof e == "object" && e !== null && typeof e.then == "function")
          try {
            var r = $a(e);
          } catch (v) {
            throw v === Ca ? kr : v;
          }
        else r = e;
        e = Gt();
        var c = e.queue, d = c.dispatch;
        return a !== e.memoizedState && (bt.flags |= 2048, ha(
          9,
          { destroy: void 0 },
          mp.bind(null, c, a),
          null
        )), [r, d, t];
      }
      function mp(t, e) {
        t.action = e;
      }
      function jc(t) {
        var e = Gt(), a = Ct;
        if (a !== null)
          return Ac(e, a, t);
        Gt(), e = e.memoizedState, a = Gt();
        var r = a.queue.dispatch;
        return a.memoizedState = t, [e, r, !1];
      }
      function ha(t, e, a, r) {
        return t = { tag: t, create: a, deps: r, inst: e, next: null }, e = bt.updateQueue, e === null && (e = Zl(), bt.updateQueue = e), a = e.lastEffect, a === null ? e.lastEffect = t.next = t : (r = a.next, a.next = t, t.next = r, e.lastEffect = t), t;
      }
      function Oc() {
        return Gt().memoizedState;
      }
      function Fl(t, e, a, r) {
        var c = fe();
        bt.flags |= t, c.memoizedState = ha(
          1 | e,
          { destroy: void 0 },
          a,
          r === void 0 ? null : r
        );
      }
      function $l(t, e, a, r) {
        var c = Gt();
        r = r === void 0 ? null : r;
        var d = c.memoizedState.inst;
        Ct !== null && r !== null && Mi(r, Ct.memoizedState.deps) ? c.memoizedState = ha(e, d, a, r) : (bt.flags |= t, c.memoizedState = ha(
          1 | e,
          d,
          a,
          r
        ));
      }
      function Rc(t, e) {
        Fl(8390656, 8, t, e);
      }
      function Gi(t, e) {
        $l(2048, 8, t, e);
      }
      function pp(t) {
        bt.flags |= 4;
        var e = bt.updateQueue;
        if (e === null)
          e = Zl(), bt.updateQueue = e, e.events = [t];
        else {
          var a = e.events;
          a === null ? e.events = [t] : a.push(t);
        }
      }
      function Dc(t) {
        var e = Gt().memoizedState;
        return pp({ ref: e, nextImpl: t }), function() {
          if ((wt & 2) !== 0)
            throw Error(s(440));
          return e.impl.apply(void 0, arguments);
        };
      }
      function Hc(t, e) {
        return $l(4, 2, t, e);
      }
      function Bc(t, e) {
        return $l(4, 4, t, e);
      }
      function Uc(t, e) {
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
      function Gc(t, e, a) {
        a = a != null ? a.concat([t]) : null, $l(
          4,
          4,
          Uc.bind(null, e, t),
          a
        );
      }
      function Yi() {
      }
      function Yc(t, e) {
        var a = Gt();
        e = e === void 0 ? null : e;
        var r = a.memoizedState;
        return e !== null && Mi(e, r[1]) ? r[0] : (a.memoizedState = [t, e], t);
      }
      function qc(t, e) {
        var a = Gt();
        e = e === void 0 ? null : e;
        var r = a.memoizedState;
        if (e !== null && Mi(e, r[1]))
          return r[0];
        if (r = t(), ia) {
          O(!0);
          try {
            t();
          } finally {
            O(!1);
          }
        }
        return a.memoizedState = [r, e], r;
      }
      function qi(t, e, a) {
        return a === void 0 || (cn & 1073741824) !== 0 && (kt & 261930) === 0 ? t.memoizedState = e : (t.memoizedState = a, t = Bu(), bt.lanes |= t, An |= t, a);
      }
      function Lc(t, e, a, r) {
        return Se(a, e) ? a : Oa.current !== null ? (t = qi(t, a, r), Se(t, e) || (Qt = !0), t) : (cn & 42) === 0 || (cn & 1073741824) !== 0 && (kt & 261930) === 0 ? (Qt = !0, t.memoizedState = a) : (t = Bu(), bt.lanes |= t, An |= t, e);
      }
      function Qc(t, e, a, r, c) {
        var d = on();
        It(
          d !== 0 && 8 > d ? d : 8
        );
        var v = dt.T, C = {};
        dt.T = C, Qi(t, !1, e, a);
        try {
          var q = c(), $ = dt.S;
          if ($ !== null && $(C, q), q !== null && typeof q == "object" && typeof q.then == "function") {
            var nt = up(
              q,
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
          It(d), v !== null && C.types !== null && (v.types = C.types), dt.T = v;
        }
      }
      function Vc(t) {
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
      function Li() {
        return ee(ta);
      }
      function Kc() {
        return Gt().memoizedState;
      }
      function Xc() {
        return Gt().memoizedState;
      }
      function hp(t) {
        for (var e = t.return; e !== null; ) {
          switch (e.tag) {
            case 24:
            case 3:
              var a = xe();
              t = vn(a);
              var r = yn(e, t, a);
              r !== null && (he(r, e, a), Ja(r, e, a)), e = { cache: yi() }, t.payload = e;
              return;
          }
          e = e.return;
        }
      }
      function gp(t, e, a) {
        var r = xe();
        a = {
          lane: r,
          revertLane: 0,
          gesture: null,
          action: a,
          hasEagerState: !1,
          eagerState: null,
          next: null
        }, Il(t) ? Jc(e, a) : (a = _i(t, e, a, r), a !== null && (he(a, t, r), Wc(a, e, r)));
      }
      function Zc(t, e, a) {
        var r = xe();
        Ia(t, e, a, r);
      }
      function Ia(t, e, a, r) {
        var c = {
          lane: r,
          revertLane: 0,
          gesture: null,
          action: a,
          hasEagerState: !1,
          eagerState: null,
          next: null
        };
        if (Il(t)) Jc(e, c);
        else {
          var d = t.alternate;
          if (t.lanes === 0 && (d === null || d.lanes === 0) && (d = e.lastRenderedReducer, d !== null))
            try {
              var v = e.lastRenderedState, C = d(v, a);
              if (c.hasEagerState = !0, c.eagerState = C, Se(C, v))
                return Vl(t, e, c, 0), At === null && Ql(), !1;
            } catch {
            } finally {
            }
          if (a = _i(t, e, c, r), a !== null)
            return he(a, t, r), Wc(a, e, r), !0;
        }
        return !1;
      }
      function Qi(t, e, a, r) {
        if (r = {
          lane: 2,
          revertLane: xi(),
          gesture: null,
          action: r,
          hasEagerState: !1,
          eagerState: null,
          next: null
        }, Il(t)) {
          if (e) throw Error(s(479));
        } else
          e = _i(
            t,
            a,
            r,
            2
          ), e !== null && he(e, t, 2);
      }
      function Il(t) {
        var e = t.alternate;
        return t === bt || e !== null && e === bt;
      }
      function Jc(t, e) {
        Ra = zr = !0;
        var a = t.pending;
        a === null ? e.next = e : (e.next = a.next, a.next = e), t.pending = e;
      }
      function Wc(t, e, a) {
        if ((a & 4194048) !== 0) {
          var r = e.lanes;
          r &= t.pendingLanes, a |= r, e.lanes = a, g(t, a);
        }
      }
      function Vi(t, e, a, r) {
        e = t.memoizedState, a = a(r, e), a = a == null ? e : xo({}, e, a), t.memoizedState = a, t.lanes === 0 && (t.updateQueue.baseState = a);
      }
      function Fc(t, e, a, r, c, d, v) {
        return t = t.stateNode, typeof t.shouldComponentUpdate == "function" ? t.shouldComponentUpdate(r, d, v) : e.prototype && e.prototype.isPureReactComponent ? !Yl(a, r) || !Yl(c, d) : !0;
      }
      function $c(t, e, a, r) {
        t = e.state, typeof e.componentWillReceiveProps == "function" && e.componentWillReceiveProps(a, r), typeof e.UNSAFE_componentWillReceiveProps == "function" && e.UNSAFE_componentWillReceiveProps(a, r), e.state !== t && Ko.enqueueReplaceState(e, e.state, null);
      }
      function Wn(t, e) {
        var a = e;
        if ("ref" in e) {
          a = {};
          for (var r in e)
            r !== "ref" && (a[r] = e[r]);
        }
        if (t = t.defaultProps) {
          a === e && (a = xo({}, a));
          for (var c in t)
            a[c] === void 0 && (a[c] = t[c]);
        }
        return a;
      }
      function Pl(t, e) {
        try {
          var a = t.onUncaughtError;
          a(e.value, { componentStack: e.stack });
        } catch (r) {
          setTimeout(function() {
            throw r;
          });
        }
      }
      function Ic(t, e, a) {
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
      function Ki(t, e, a) {
        return a = vn(a), a.tag = 3, a.payload = { element: null }, a.callback = function() {
          Pl(t, e);
        }, a;
      }
      function Pc(t) {
        return t = vn(t), t.tag = 3, t;
      }
      function tu(t, e, a, r) {
        var c = a.type.getDerivedStateFromError;
        if (typeof c == "function") {
          var d = r.value;
          t.payload = function() {
            return c(d);
          }, t.callback = function() {
            Ic(e, a, r);
          };
        }
        var v = a.stateNode;
        v !== null && typeof v.componentDidCatch == "function" && (t.callback = function() {
          Ic(e, a, r), typeof c != "function" && (jn === null ? jn = /* @__PURE__ */ new Set([this]) : jn.add(this));
          var C = r.stack;
          this.componentDidCatch(r.value, {
            componentStack: C !== null ? C : ""
          });
        });
      }
      function bp(t, e, a, r, c) {
        if (a.flags |= 32768, r !== null && typeof r == "object" && typeof r.then == "function") {
          if (e = a.alternate, e !== null && ma(
            e,
            a,
            c,
            !0
          ), a = Ee.current, a !== null) {
            switch (a.tag) {
              case 31:
              case 13:
                return Oe === null ? sr() : a.alternate === null && Ut === 0 && (Ut = 3), a.flags &= -257, a.flags |= 65536, a.lanes = c, r === Sr ? a.flags |= 16384 : (e = a.updateQueue, e === null ? a.updateQueue = /* @__PURE__ */ new Set([r]) : e.add(r), ho(t, r, c)), !1;
              case 22:
                return a.flags |= 65536, r === Sr ? a.flags |= 16384 : (e = a.updateQueue, e === null ? (e = {
                  transitions: null,
                  markerInstances: null,
                  retryQueue: /* @__PURE__ */ new Set([r])
                }, a.updateQueue = e) : (a = e.retryQueue, a === null ? e.retryQueue = /* @__PURE__ */ new Set([r]) : a.add(r)), ho(t, r, c)), !1;
            }
            throw Error(s(435, a.tag));
          }
          return ho(t, r, c), sr(), !1;
        }
        if (St)
          return e = Ee.current, e !== null ? ((e.flags & 65536) === 0 && (e.flags |= 256), e.flags |= 65536, e.lanes = c, r !== Bo && (t = Error(s(422), { cause: r }), Ka(
            L(t, a)
          ))) : (r !== Bo && (e = Error(s(423), {
            cause: r
          }), Ka(
            L(e, a)
          )), t = t.current.alternate, t.flags |= 65536, c &= -c, t.lanes |= c, r = L(r, a), c = Ki(
            t.stateNode,
            r,
            c
          ), Ei(t, c), Ut !== 4 && (Ut = 2)), !1;
        var d = Error(s(520), { cause: r });
        if (d = L(d, a), bl === null ? bl = [d] : bl.push(d), Ut !== 4 && (Ut = 2), e === null) return !0;
        r = L(r, a), a = e;
        do {
          switch (a.tag) {
            case 3:
              return a.flags |= 65536, t = c & -c, a.lanes |= t, t = Ki(a.stateNode, r, t), Ei(a, t), !1;
            case 1:
              if (e = a.type, d = a.stateNode, (a.flags & 128) === 0 && (typeof e.getDerivedStateFromError == "function" || d !== null && typeof d.componentDidCatch == "function" && (jn === null || !jn.has(
                d
              ))))
                return a.flags |= 65536, c &= -c, a.lanes |= c, c = Pc(c), tu(
                  c,
                  t,
                  a,
                  r
                ), Ei(a, c), !1;
          }
          a = a.return;
        } while (a !== null);
        return !1;
      }
      function ne(t, e, a, r) {
        e.child = t === null ? Yd(e, null, a, r) : ra(
          e,
          t.child,
          a,
          r
        );
      }
      function eu(t, e, a, r, c) {
        a = a.render;
        var d = e.ref;
        if ("ref" in r) {
          var v = {};
          for (var C in r)
            C !== "ref" && (v[C] = r[C]);
        } else v = r;
        return Xn(e), r = Ci(
          t,
          e,
          a,
          v,
          d,
          c
        ), C = Ai(), t !== null && !Qt ? (ji(t, e, c), en(t, e, c)) : (St && C && X(e), e.flags |= 1, ne(t, e, r, c), e.child);
      }
      function nu(t, e, a, r, c) {
        if (t === null) {
          var d = a.type;
          return typeof d == "function" && !go(d) && d.defaultProps === void 0 && a.compare === null ? (e.tag = 15, e.type = d, au(
            t,
            e,
            d,
            r,
            c
          )) : (t = ur(
            a.type,
            null,
            r,
            e,
            e.mode,
            c
          ), t.ref = e.ref, t.return = e, e.child = t);
        }
        if (d = t.child, !Ii(t, c)) {
          var v = d.memoizedProps;
          if (a = a.compare, a = a !== null ? a : Yl, a(v, r) && t.ref === e.ref)
            return en(
              t,
              e,
              c
            );
        }
        return e.flags |= 1, t = ln(d, r), t.ref = e.ref, t.return = e, e.child = t;
      }
      function au(t, e, a, r, c) {
        if (t !== null) {
          var d = t.memoizedProps;
          if (Yl(d, r) && t.ref === e.ref)
            if (Qt = !1, e.pendingProps = r = d, Ii(t, c))
              (t.flags & 131072) !== 0 && (Qt = !0);
            else
              return e.lanes = t.lanes, en(t, e, c);
        }
        return Xi(
          t,
          e,
          a,
          r,
          c
        );
      }
      function lu(t, e, a, r) {
        var c = r.children, d = t !== null ? t.memoizedState : null;
        if (t === null && e.stateNode === null && (e.stateNode = {
          _visibility: 1,
          _pendingMarkers: null,
          _retryCache: null,
          _transitions: null
        }), r.mode === "hidden") {
          if ((e.flags & 128) !== 0) {
            if (d = d !== null ? d.baseLanes | a : a, t !== null) {
              for (r = e.child = t.child, c = 0; r !== null; )
                c = c | r.lanes | r.childLanes, r = r.sibling;
              r = c & ~d;
            } else r = 0, e.child = null;
            return ru(
              t,
              e,
              d,
              a,
              r
            );
          }
          if ((a & 536870912) !== 0)
            e.memoizedState = { baseLanes: 0, cachePool: null }, t !== null && Gl(
              e,
              d !== null ? d.cachePool : null
            ), d !== null ? mc(e, d) : zi(), pc(e);
          else
            return r = e.lanes = 536870912, ru(
              t,
              e,
              d !== null ? d.baseLanes | a : a,
              a,
              r
            );
        } else
          d !== null ? (Gl(e, d.cachePool), mc(e, d), wn(), e.memoizedState = null) : (t !== null && Gl(e, null), zi(), wn());
        return ne(t, e, c, a), e.child;
      }
      function Pa(t, e) {
        return t !== null && t.tag === 22 || e.stateNode !== null || (e.stateNode = {
          _visibility: 1,
          _pendingMarkers: null,
          _retryCache: null,
          _transitions: null
        }), e.sibling;
      }
      function ru(t, e, a, r, c) {
        var d = wi();
        return d = d === null ? null : {
          parent: rn ? Dt._currentValue : Dt._currentValue2,
          pool: d
        }, e.memoizedState = {
          baseLanes: a,
          cachePool: d
        }, t !== null && Gl(e, null), zi(), pc(e), t !== null && ma(t, e, r, !0), e.childLanes = c, null;
      }
      function tr(t, e) {
        return e = nr(
          { mode: e.mode, children: e.children },
          t.mode
        ), e.ref = t.ref, t.child = e, e.return = t, e;
      }
      function iu(t, e, a) {
        return ra(e, t.child, null, a), t = tr(
          e,
          e.pendingProps
        ), t.flags |= 2, ye(e), e.memoizedState = null, t;
      }
      function vp(t, e, a) {
        var r = e.pendingProps, c = (e.flags & 128) !== 0;
        if (e.flags &= -129, t === null) {
          if (St) {
            if (r.mode === "hidden")
              return t = tr(e, r), e.lanes = 536870912, Pa(null, t);
            if (Ti(e), (t = Rt) ? (t = Gh(
              t,
              Ae
            ), t !== null && (e.memoizedState = {
              dehydrated: t,
              treeContext: zn !== null ? { id: Ze, overflow: Je } : null,
              retryLane: 536870912,
              hydrationErrors: null
            }, a = ad(t), a.return = e, e.child = a, le = e, Rt = null)) : t = null, t === null) throw ht(e);
            return e.lanes = 536870912, null;
          }
          return tr(e, r);
        }
        var d = t.memoizedState;
        if (d !== null) {
          var v = d.dehydrated;
          if (Ti(e), c)
            if (e.flags & 256)
              e.flags &= -257, e = iu(
                t,
                e,
                a
              );
            else if (e.memoizedState !== null)
              e.child = t.child, e.flags |= 128, e = null;
            else throw Error(s(558));
          else if (Qt || ma(
            t,
            e,
            a,
            !1
          ), c = (a & t.childLanes) !== 0, Qt || c) {
            if (r = At, r !== null && (v = w(r, a), v !== 0 && v !== d.retryLane))
              throw d.retryLane = v, Jn(t, v), he(r, t, v), Xo;
            sr(), e = iu(
              t,
              e,
              a
            );
          } else
            t = d.treeContext, ue && (Rt = Rh(v), le = e, St = !0, Tn = null, Ae = !1, t !== null && st(e, t)), e = tr(e, r), e.flags |= 4096;
          return e;
        }
        return t = ln(t.child, {
          mode: r.mode,
          children: r.children
        }), t.ref = e.ref, e.child = t, t.return = e, t;
      }
      function er(t, e) {
        var a = e.ref;
        if (a === null)
          t !== null && t.ref !== null && (e.flags |= 4194816);
        else {
          if (typeof a != "function" && typeof a != "object")
            throw Error(s(284));
          (t === null || t.ref !== a) && (e.flags |= 4194816);
        }
      }
      function Xi(t, e, a, r, c) {
        return Xn(e), a = Ci(
          t,
          e,
          a,
          r,
          void 0,
          c
        ), r = Ai(), t !== null && !Qt ? (ji(t, e, c), en(t, e, c)) : (St && r && X(e), e.flags |= 1, ne(t, e, a, c), e.child);
      }
      function ou(t, e, a, r, c, d) {
        return Xn(e), e.updateQueue = null, a = gc(
          e,
          r,
          a,
          c
        ), hc(t), r = Ai(), t !== null && !Qt ? (ji(t, e, d), en(t, e, d)) : (St && r && X(e), e.flags |= 1, ne(t, e, a, d), e.child);
      }
      function su(t, e, a, r, c) {
        if (Xn(e), e.stateNode === null) {
          var d = Sa, v = a.contextType;
          typeof v == "object" && v !== null && (d = ee(v)), d = new a(r, d), e.memoizedState = d.state !== null && d.state !== void 0 ? d.state : null, d.updater = Ko, e.stateNode = d, d._reactInternals = e, d = e.stateNode, d.props = r, d.state = e.memoizedState, d.refs = {}, ki(e), v = a.contextType, d.context = typeof v == "object" && v !== null ? ee(v) : Sa, d.state = e.memoizedState, v = a.getDerivedStateFromProps, typeof v == "function" && (Vi(
            e,
            a,
            v,
            r
          ), d.state = e.memoizedState), typeof a.getDerivedStateFromProps == "function" || typeof d.getSnapshotBeforeUpdate == "function" || typeof d.UNSAFE_componentWillMount != "function" && typeof d.componentWillMount != "function" || (v = d.state, typeof d.componentWillMount == "function" && d.componentWillMount(), typeof d.UNSAFE_componentWillMount == "function" && d.UNSAFE_componentWillMount(), v !== d.state && Ko.enqueueReplaceState(
            d,
            d.state,
            null
          ), Fa(e, r, d, c), Wa(), d.state = e.memoizedState), typeof d.componentDidMount == "function" && (e.flags |= 4194308), r = !0;
        } else if (t === null) {
          d = e.stateNode;
          var C = e.memoizedProps, q = Wn(a, C);
          d.props = q;
          var $ = d.context, nt = a.contextType;
          v = Sa, typeof nt == "object" && nt !== null && (v = ee(nt));
          var P = a.getDerivedStateFromProps;
          nt = typeof P == "function" || typeof d.getSnapshotBeforeUpdate == "function", C = e.pendingProps !== C, nt || typeof d.UNSAFE_componentWillReceiveProps != "function" && typeof d.componentWillReceiveProps != "function" || (C || $ !== v) && $c(
            e,
            d,
            r,
            v
          ), Mn = !1;
          var lt = e.memoizedState;
          d.state = lt, Fa(e, r, d, c), Wa(), $ = e.memoizedState, C || lt !== $ || Mn ? (typeof P == "function" && (Vi(
            e,
            a,
            P,
            r
          ), $ = e.memoizedState), (q = Mn || Fc(
            e,
            a,
            q,
            r,
            lt,
            $,
            v
          )) ? (nt || typeof d.UNSAFE_componentWillMount != "function" && typeof d.componentWillMount != "function" || (typeof d.componentWillMount == "function" && d.componentWillMount(), typeof d.UNSAFE_componentWillMount == "function" && d.UNSAFE_componentWillMount()), typeof d.componentDidMount == "function" && (e.flags |= 4194308)) : (typeof d.componentDidMount == "function" && (e.flags |= 4194308), e.memoizedProps = r, e.memoizedState = $), d.props = r, d.state = $, d.context = v, r = q) : (typeof d.componentDidMount == "function" && (e.flags |= 4194308), r = !1);
        } else {
          d = e.stateNode, Si(t, e), v = e.memoizedProps, nt = Wn(a, v), d.props = nt, P = e.pendingProps, lt = d.context, $ = a.contextType, q = Sa, typeof $ == "object" && $ !== null && (q = ee($)), C = a.getDerivedStateFromProps, ($ = typeof C == "function" || typeof d.getSnapshotBeforeUpdate == "function") || typeof d.UNSAFE_componentWillReceiveProps != "function" && typeof d.componentWillReceiveProps != "function" || (v !== P || lt !== q) && $c(
            e,
            d,
            r,
            q
          ), Mn = !1, lt = e.memoizedState, d.state = lt, Fa(e, r, d, c), Wa();
          var gt = e.memoizedState;
          v !== P || lt !== gt || Mn || t !== null && t.dependencies !== null && Hl(t.dependencies) ? (typeof C == "function" && (Vi(
            e,
            a,
            C,
            r
          ), gt = e.memoizedState), (nt = Mn || Fc(
            e,
            a,
            nt,
            r,
            lt,
            gt,
            q
          ) || t !== null && t.dependencies !== null && Hl(t.dependencies)) ? ($ || typeof d.UNSAFE_componentWillUpdate != "function" && typeof d.componentWillUpdate != "function" || (typeof d.componentWillUpdate == "function" && d.componentWillUpdate(r, gt, q), typeof d.UNSAFE_componentWillUpdate == "function" && d.UNSAFE_componentWillUpdate(
            r,
            gt,
            q
          )), typeof d.componentDidUpdate == "function" && (e.flags |= 4), typeof d.getSnapshotBeforeUpdate == "function" && (e.flags |= 1024)) : (typeof d.componentDidUpdate != "function" || v === t.memoizedProps && lt === t.memoizedState || (e.flags |= 4), typeof d.getSnapshotBeforeUpdate != "function" || v === t.memoizedProps && lt === t.memoizedState || (e.flags |= 1024), e.memoizedProps = r, e.memoizedState = gt), d.props = r, d.state = gt, d.context = q, r = nt) : (typeof d.componentDidUpdate != "function" || v === t.memoizedProps && lt === t.memoizedState || (e.flags |= 4), typeof d.getSnapshotBeforeUpdate != "function" || v === t.memoizedProps && lt === t.memoizedState || (e.flags |= 1024), r = !1);
        }
        return d = r, er(t, e), r = (e.flags & 128) !== 0, d || r ? (d = e.stateNode, a = r && typeof a.getDerivedStateFromError != "function" ? null : d.render(), e.flags |= 1, t !== null && r ? (e.child = ra(
          e,
          t.child,
          null,
          c
        ), e.child = ra(
          e,
          null,
          a,
          c
        )) : ne(t, e, a, c), e.memoizedState = d.state, t = e.child) : t = en(
          t,
          e,
          c
        ), t;
      }
      function cu(t, e, a, r) {
        return He(), e.flags |= 256, ne(t, e, a, r), e.child;
      }
      function Zi(t) {
        return { baseLanes: t, cachePool: lc() };
      }
      function Ji(t, e, a) {
        return t = t !== null ? t.childLanes & ~a : 0, e && (t |= Ne), t;
      }
      function uu(t, e, a) {
        var r = e.pendingProps, c = !1, d = (e.flags & 128) !== 0, v;
        if ((v = d) || (v = t !== null && t.memoizedState === null ? !1 : (Yt.current & 2) !== 0), v && (c = !0, e.flags &= -129), v = (e.flags & 32) !== 0, e.flags &= -33, t === null) {
          if (St) {
            if (c ? xn(e) : wn(), (t = Rt) ? (t = Yh(
              t,
              Ae
            ), t !== null && (e.memoizedState = {
              dehydrated: t,
              treeContext: zn !== null ? { id: Ze, overflow: Je } : null,
              retryLane: 536870912,
              hydrationErrors: null
            }, a = ad(t), a.return = e, e.child = a, le = e, Rt = null)) : t = null, t === null) throw ht(e);
            return Co(t) ? e.lanes = 32 : e.lanes = 536870912, null;
          }
          var C = r.children;
          return r = r.fallback, c ? (wn(), c = e.mode, C = nr(
            { mode: "hidden", children: C },
            c
          ), r = In(
            r,
            c,
            a,
            null
          ), C.return = e, r.return = e, C.sibling = r, e.child = C, r = e.child, r.memoizedState = Zi(a), r.childLanes = Ji(
            t,
            v,
            a
          ), e.memoizedState = Zo, Pa(null, r)) : (xn(e), Wi(e, C));
        }
        var q = t.memoizedState;
        if (q !== null && (C = q.dehydrated, C !== null)) {
          if (d)
            e.flags & 256 ? (xn(e), e.flags &= -257, e = Fi(
              t,
              e,
              a
            )) : e.memoizedState !== null ? (wn(), e.child = t.child, e.flags |= 128, e = null) : (wn(), C = r.fallback, c = e.mode, r = nr(
              { mode: "visible", children: r.children },
              c
            ), C = In(
              C,
              c,
              a,
              null
            ), C.flags |= 2, r.return = e, C.return = e, r.sibling = C, e.child = r, ra(
              e,
              t.child,
              null,
              a
            ), r = e.child, r.memoizedState = Zi(a), r.childLanes = Ji(
              t,
              v,
              a
            ), e.memoizedState = Zo, e = Pa(null, r));
          else if (xn(e), Co(C))
            v = Nh(C).digest, r = Error(s(419)), r.stack = "", r.digest = v, Ka({ value: r, source: null, stack: null }), e = Fi(
              t,
              e,
              a
            );
          else if (Qt || ma(
            t,
            e,
            a,
            !1
          ), v = (a & t.childLanes) !== 0, Qt || v) {
            if (v = At, v !== null && (r = w(
              v,
              a
            ), r !== 0 && r !== q.retryLane))
              throw q.retryLane = r, Jn(t, r), he(v, t, r), Xo;
            Mo(C) || sr(), e = Fi(
              t,
              e,
              a
            );
          } else
            Mo(C) ? (e.flags |= 192, e.child = t.child, e = null) : (t = q.treeContext, ue && (Rt = Dh(
              C
            ), le = e, St = !0, Tn = null, Ae = !1, t !== null && st(e, t)), e = Wi(
              e,
              r.children
            ), e.flags |= 4096);
          return e;
        }
        return c ? (wn(), C = r.fallback, c = e.mode, q = t.child, d = q.sibling, r = ln(q, {
          mode: "hidden",
          children: r.children
        }), r.subtreeFlags = q.subtreeFlags & 65011712, d !== null ? C = ln(
          d,
          C
        ) : (C = In(
          C,
          c,
          a,
          null
        ), C.flags |= 2), C.return = e, r.return = e, r.sibling = C, e.child = r, Pa(null, r), r = e.child, C = t.child.memoizedState, C === null ? C = Zi(a) : (c = C.cachePool, c !== null ? (q = rn ? Dt._currentValue : Dt._currentValue2, c = c.parent !== q ? { parent: q, pool: q } : c) : c = lc(), C = {
          baseLanes: C.baseLanes | a,
          cachePool: c
        }), r.memoizedState = C, r.childLanes = Ji(
          t,
          v,
          a
        ), e.memoizedState = Zo, Pa(t.child, r)) : (xn(e), a = t.child, t = a.sibling, a = ln(a, {
          mode: "visible",
          children: r.children
        }), a.return = e, a.sibling = null, t !== null && (v = e.deletions, v === null ? (e.deletions = [t], e.flags |= 16) : v.push(t)), e.child = a, e.memoizedState = null, a);
      }
      function Wi(t, e) {
        return e = nr(
          { mode: "visible", children: e },
          t.mode
        ), e.return = t, t.child = e;
      }
      function nr(t, e) {
        return t = i(22, t, null, e), t.lanes = 0, t;
      }
      function Fi(t, e, a) {
        return ra(e, t.child, null, a), t = Wi(
          e,
          e.pendingProps.children
        ), t.flags |= 2, e.memoizedState = null, t;
      }
      function du(t, e, a) {
        t.lanes |= e;
        var r = t.alternate;
        r !== null && (r.lanes |= e), bi(t.return, e, a);
      }
      function $i(t, e, a, r, c, d) {
        var v = t.memoizedState;
        v === null ? t.memoizedState = {
          isBackwards: e,
          rendering: null,
          renderingStartTime: 0,
          last: r,
          tail: a,
          tailMode: c,
          treeForkCount: d
        } : (v.isBackwards = e, v.rendering = null, v.renderingStartTime = 0, v.last = r, v.tail = a, v.tailMode = c, v.treeForkCount = d);
      }
      function fu(t, e, a) {
        var r = e.pendingProps, c = r.revealOrder, d = r.tail;
        r = r.children;
        var v = Yt.current, C = (v & 2) !== 0;
        if (C ? (v = v & 1 | 2, e.flags |= 128) : v &= 1, z(Yt, v), ne(t, e, r, a), r = St ? ul : 0, !C && t !== null && (t.flags & 128) !== 0)
          t: for (t = e.child; t !== null; ) {
            if (t.tag === 13)
              t.memoizedState !== null && du(t, a, e);
            else if (t.tag === 19)
              du(t, a, e);
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
              t = a.alternate, t !== null && Xl(t) === null && (c = a), a = a.sibling;
            a = c, a === null ? (c = e.child, e.child = null) : (c = a.sibling, a.sibling = null), $i(
              e,
              !1,
              c,
              a,
              d,
              r
            );
            break;
          case "backwards":
          case "unstable_legacy-backwards":
            for (a = null, c = e.child, e.child = null; c !== null; ) {
              if (t = c.alternate, t !== null && Xl(t) === null) {
                e.child = c;
                break;
              }
              t = c.sibling, c.sibling = a, a = c, c = t;
            }
            $i(
              e,
              !0,
              a,
              null,
              d,
              r
            );
            break;
          case "together":
            $i(
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
      function Ii(t, e) {
        return (t.lanes & e) !== 0 ? !0 : (t = t.dependencies, !!(t !== null && Hl(t)));
      }
      function yp(t, e, a) {
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
              return e.flags |= 128, Ti(e), null;
            break;
          case 13:
            var r = e.memoizedState;
            if (r !== null)
              return r.dehydrated !== null ? (xn(e), e.flags |= 128, null) : (a & e.child.childLanes) !== 0 ? uu(
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
                return fu(
                  t,
                  e,
                  a
                );
              e.flags |= 128;
            }
            if (c = e.memoizedState, c !== null && (c.rendering = null, c.tail = null, c.lastEffect = null), z(Yt, Yt.current), r) break;
            return null;
          case 22:
            return e.lanes = 0, lu(
              t,
              e,
              a,
              e.pendingProps
            );
          case 24:
            bn(e, Dt, t.memoizedState.cache);
        }
        return en(t, e, a);
      }
      function mu(t, e, a) {
        if (t !== null)
          if (t.memoizedProps !== e.pendingProps)
            Qt = !0;
          else {
            if (!Ii(t, a) && (e.flags & 128) === 0)
              return Qt = !1, yp(
                t,
                e,
                a
              );
            Qt = (t.flags & 131072) !== 0;
          }
        else
          Qt = !1, St && (e.flags & 1048576) !== 0 && M(e, ul, e.index);
        switch (e.lanes = 0, e.tag) {
          case 16:
            t: {
              var r = e.pendingProps;
              if (t = Zn(e.elementType), e.type = t, typeof t == "function")
                go(t) ? (r = Wn(t, r), e.tag = 1, e = su(
                  null,
                  e,
                  t,
                  r,
                  a
                )) : (e.tag = 0, e = Xi(
                  null,
                  e,
                  t,
                  r,
                  a
                ));
              else {
                if (t != null) {
                  var c = t.$$typeof;
                  if (c === _o) {
                    e.tag = 11, e = eu(
                      null,
                      e,
                      t,
                      r,
                      a
                    );
                    break t;
                  } else if (c === Eo) {
                    e.tag = 14, e = nu(
                      null,
                      e,
                      t,
                      r,
                      a
                    );
                    break t;
                  }
                }
                throw e = k(t) || t, Error(s(306, e, ""));
              }
            }
            return e;
          case 0:
            return Xi(
              t,
              e,
              e.type,
              e.pendingProps,
              a
            );
          case 1:
            return r = e.type, c = Wn(
              r,
              e.pendingProps
            ), su(
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
              var d = e.pendingProps;
              c = e.memoizedState, r = c.element, Si(t, e), Fa(e, d, null, a);
              var v = e.memoizedState;
              if (d = v.cache, bn(e, Dt, d), d !== c.cache && vi(
                e,
                [Dt],
                a,
                !0
              ), Wa(), d = v.element, ue && c.isDehydrated)
                if (c = {
                  element: d,
                  isDehydrated: !1,
                  cache: v.cache
                }, e.updateQueue.baseState = c, e.memoizedState = c, e.flags & 256) {
                  e = cu(
                    t,
                    e,
                    d,
                    a
                  );
                  break t;
                } else if (d !== r) {
                  r = L(
                    Error(s(424)),
                    e
                  ), Ka(r), e = cu(
                    t,
                    e,
                    d,
                    a
                  );
                  break t;
                } else
                  for (ue && (Rt = Oh(
                    e.stateNode.containerInfo
                  ), le = e, St = !0, Tn = null, Ae = !0), a = Yd(
                    e,
                    null,
                    d,
                    a
                  ), e.child = a; a; )
                    a.flags = a.flags & -3 | 4096, a = a.sibling;
              else {
                if (He(), d === r) {
                  e = en(
                    t,
                    e,
                    a
                  );
                  break t;
                }
                ne(t, e, d, a);
              }
              e = e.child;
            }
            return e;
          case 26:
            if (Ye)
              return er(t, e), t === null ? (a = zd(
                e.type,
                null,
                e.pendingProps,
                null
              )) ? e.memoizedState = a : St || (e.stateNode = i0(
                e.type,
                e.pendingProps,
                Nn.current,
                e
              )) : e.memoizedState = zd(
                e.type,
                t.memoizedProps,
                e.pendingProps,
                t.memoizedState
              ), null;
          case 27:
            if (Jt)
              return Et(e), t === null && Jt && St && (r = e.stateNode = jd(
                e.type,
                e.pendingProps,
                Nn.current,
                ae.current,
                !1
              ), le = e, Ae = !0, Rt = Hh(
                e.type,
                r,
                Rt
              )), ne(
                t,
                e,
                e.pendingProps.children,
                a
              ), er(t, e), t === null && (e.flags |= 4194304), e.child;
          case 5:
            return t === null && St && (a0(
              e.type,
              e.pendingProps,
              ae.current
            ), (c = r = Rt) && (r = Bh(
              r,
              e.type,
              e.pendingProps,
              Ae
            ), r !== null ? (e.stateNode = r, le = e, Rt = jh(r), Ae = !1, c = !0) : c = !1), c || ht(e)), Et(e), c = e.type, d = e.pendingProps, v = t !== null ? t.memoizedProps : null, r = d.children, mr(c, d) ? r = null : v !== null && mr(c, v) && (e.flags |= 32), e.memoizedState !== null && (c = Ci(
              t,
              e,
              dp,
              null,
              null,
              a
            ), rn ? ta._currentValue = c : ta._currentValue2 = c), er(t, e), ne(t, e, r, a), e.child;
          case 6:
            return t === null && St && (l0(
              e.pendingProps,
              ae.current
            ), (t = a = Rt) && (a = Uh(
              a,
              e.pendingProps,
              Ae
            ), a !== null ? (e.stateNode = a, le = e, Rt = null, t = !0) : t = !1), t || ht(e)), null;
          case 13:
            return uu(t, e, a);
          case 4:
            return ct(
              e,
              e.stateNode.containerInfo
            ), r = e.pendingProps, t === null ? e.child = ra(
              e,
              null,
              r,
              a
            ) : ne(t, e, r, a), e.child;
          case 11:
            return eu(
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
            return r = e.pendingProps, bn(e, e.type, r.value), ne(
              t,
              e,
              r.children,
              a
            ), e.child;
          case 9:
            return c = e.type._context, r = e.pendingProps.children, Xn(e), c = ee(c), r = r(c), e.flags |= 1, ne(t, e, r, a), e.child;
          case 14:
            return nu(
              t,
              e,
              e.type,
              e.pendingProps,
              a
            );
          case 15:
            return au(
              t,
              e,
              e.type,
              e.pendingProps,
              a
            );
          case 19:
            return fu(
              t,
              e,
              a
            );
          case 31:
            return vp(t, e, a);
          case 22:
            return lu(
              t,
              e,
              a,
              e.pendingProps
            );
          case 24:
            return Xn(e), r = ee(Dt), t === null ? (c = wi(), c === null && (c = At, d = yi(), c.pooledCache = d, d.refCount++, d !== null && (c.pooledCacheLanes |= a), c = d), e.memoizedState = {
              parent: r,
              cache: c
            }, ki(e), bn(e, Dt, c)) : ((t.lanes & a) !== 0 && (Si(t, e), Fa(e, null, null, a), Wa()), c = t.memoizedState, d = e.memoizedState, c.parent !== r ? (c = { parent: r, cache: r }, e.memoizedState = c, e.lanes === 0 && (e.memoizedState = e.updateQueue.baseState = c), bn(e, Dt, r)) : (r = d.cache, bn(e, Dt, r), r !== c.cache && vi(
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
      function ar(t) {
        Xe && (t.flags |= 8);
      }
      function pu(t, e) {
        if (t !== null && t.child === e.child) return !1;
        if ((e.flags & 16) !== 0) return !0;
        for (t = e.child; t !== null; ) {
          if ((t.flags & 8218) !== 0 || (t.subtreeFlags & 8218) !== 0)
            return !0;
          t = t.sibling;
        }
        return !1;
      }
      function Pi(t, e, a, r) {
        if (ce)
          for (a = e.child; a !== null; ) {
            if (a.tag === 5 || a.tag === 6)
              No(t, a.stateNode);
            else if (!(a.tag === 4 || Jt && a.tag === 27) && a.child !== null) {
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
        else if (Xe)
          for (var c = e.child; c !== null; ) {
            if (c.tag === 5) {
              var d = c.stateNode;
              a && r && (d = wd(
                d,
                c.type,
                c.memoizedProps
              )), No(t, d);
            } else if (c.tag === 6)
              d = c.stateNode, a && r && (d = _d(
                d,
                c.memoizedProps
              )), No(t, d);
            else if (c.tag !== 4) {
              if (c.tag === 22 && c.memoizedState !== null)
                d = c.child, d !== null && (d.return = c), Pi(t, c, !0, !0);
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
      function hu(t, e, a, r) {
        var c = !1;
        if (Xe)
          for (var d = e.child; d !== null; ) {
            if (d.tag === 5) {
              var v = d.stateNode;
              a && r && (v = wd(
                v,
                d.type,
                d.memoizedProps
              )), yd(t, v);
            } else if (d.tag === 6)
              v = d.stateNode, a && r && (v = _d(
                v,
                d.memoizedProps
              )), yd(t, v);
            else if (d.tag !== 4) {
              if (d.tag === 22 && d.memoizedState !== null)
                c = d.child, c !== null && (c.return = d), hu(t, d, !0, !0), c = !0;
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
      function gu(t, e) {
        if (Xe && pu(t, e)) {
          t = e.stateNode;
          var a = t.containerInfo, r = vd();
          hu(r, e, !1, !1), t.pendingChildren = r, Be(e), zh(a, r);
        }
      }
      function to(t, e, a, r) {
        if (ce)
          t.memoizedProps !== r && Be(e);
        else if (Xe) {
          var c = t.stateNode, d = t.memoizedProps;
          if ((t = pu(t, e)) || d !== r) {
            var v = ae.current;
            d = Eh(
              c,
              a,
              d,
              r,
              !t,
              null
            ), d === c ? e.stateNode = c : (ar(e), md(
              d,
              a,
              r,
              v
            ) && Be(e), e.stateNode = d, t && Pi(d, e, !1, !1));
          } else e.stateNode = c;
        }
      }
      function eo(t, e, a, r, c) {
        if ((t.mode & 32) !== 0 && (a === null ? Ip(e, r) : Pp(e, a, r))) {
          if (t.flags |= 16777216, (c & 335544128) === c || To(e, r))
            if (hd(t.stateNode, e, r))
              t.flags |= 8192;
            else if (Lu()) t.flags |= 8192;
            else
              throw la = Sr, qo;
        } else t.flags &= -16777217;
      }
      function bu(t, e) {
        if (s0(e)) {
          if (t.flags |= 16777216, !Ad(e))
            if (Lu()) t.flags |= 8192;
            else
              throw la = Sr, qo;
        } else t.flags &= -16777217;
      }
      function lr(t, e) {
        e !== null && (t.flags |= 4), t.flags & 16384 && (e = t.tag !== 22 ? Z() : 536870912, t.lanes |= e, Ua |= e);
      }
      function tl(t, e) {
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
      function xp(t, e, a) {
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
            return a = e.stateNode, r = null, t !== null && (r = t.memoizedState.cache), e.memoizedState.cache !== r && (e.flags |= 2048), Pe(Dt), ut(), a.pendingContext && (a.context = a.pendingContext, a.pendingContext = null), (t === null || t.child === null) && (De(e) ? Be(e) : t === null || t.memoizedState.isDehydrated && (e.flags & 256) === 0 || (e.flags |= 1024, gn())), gu(t, e), Ot(e), null;
          case 26:
            if (Ye) {
              var c = e.type, d = e.memoizedState;
              return t === null ? (Be(e), d !== null ? (Ot(e), bu(
                e,
                d
              )) : (Ot(e), eo(
                e,
                c,
                null,
                r,
                a
              ))) : d ? d !== t.memoizedState ? (Be(e), Ot(e), bu(
                e,
                d
              )) : (Ot(e), e.flags &= -16777217) : (d = t.memoizedProps, ce ? d !== r && Be(e) : to(
                t,
                e,
                c,
                r
              ), Ot(e), eo(
                e,
                c,
                d,
                r,
                a
              )), null;
            }
          case 27:
            if (Jt) {
              if ($t(e), a = Nn.current, c = e.type, t !== null && e.stateNode != null)
                ce ? t.memoizedProps !== r && Be(e) : to(t, e, c, r);
              else {
                if (!r) {
                  if (e.stateNode === null)
                    throw Error(s(166));
                  return Ot(e), null;
                }
                t = ae.current, De(e) ? Vn(e, t) : (t = jd(
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
            if ($t(e), c = e.type, t !== null && e.stateNode != null)
              to(t, e, c, r);
            else {
              if (!r) {
                if (e.stateNode === null)
                  throw Error(s(166));
                return Ot(e), null;
              }
              if (d = ae.current, De(e))
                Vn(e, d), $h(
                  e.stateNode,
                  c,
                  r,
                  d
                ) && (e.flags |= 64);
              else {
                var v = Vp(
                  c,
                  r,
                  Nn.current,
                  d,
                  e
                );
                ar(e), Pi(v, e, !1, !1), e.stateNode = v, md(
                  v,
                  c,
                  r,
                  d
                ) && Be(e);
              }
            }
            return Ot(e), eo(
              e,
              e.type,
              t === null ? null : t.memoizedProps,
              e.pendingProps,
              a
            ), null;
          case 6:
            if (t && e.stateNode != null)
              a = t.memoizedProps, ce ? a !== r && Be(e) : Xe && (a !== r ? (t = Nn.current, a = ae.current, ar(e), e.stateNode = pd(
                r,
                t,
                a,
                e
              )) : e.stateNode = t.stateNode);
            else {
              if (typeof r != "string" && e.stateNode === null)
                throw Error(s(166));
              if (t = Nn.current, a = ae.current, De(e)) {
                if (!ue) throw Error(s(176));
                if (t = e.stateNode, a = e.memoizedProps, r = null, c = le, c !== null)
                  switch (c.tag) {
                    case 27:
                    case 5:
                      r = c.memoizedProps;
                  }
                Lh(
                  t,
                  a,
                  e,
                  r
                ) || ht(e, !0);
              } else
                ar(e), e.stateNode = pd(
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
                  Qh(t, e);
                } else
                  He(), (e.flags & 128) === 0 && (e.memoizedState = null), e.flags |= 4;
                Ot(e), t = !1;
              } else
                a = gn(), t !== null && t.memoizedState !== null && (t.memoizedState.hydrationErrors = a), t = !0;
              if (!t)
                return e.flags & 256 ? (ye(e), e) : (ye(e), null);
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
                  Vh(c, e);
                } else
                  He(), (e.flags & 128) === 0 && (e.memoizedState = null), e.flags |= 4;
                Ot(e), c = !1;
              } else
                c = gn(), t !== null && t.memoizedState !== null && (t.memoizedState.hydrationErrors = c), c = !0;
              if (!c)
                return e.flags & 256 ? (ye(e), e) : (ye(e), null);
            }
            return ye(e), (e.flags & 128) !== 0 ? (e.lanes = a, e) : (a = r !== null, t = t !== null && t.memoizedState !== null, a && (r = e.child, c = null, r.alternate !== null && r.alternate.memoizedState !== null && r.alternate.memoizedState.cachePool !== null && (c = r.alternate.memoizedState.cachePool.pool), d = null, r.memoizedState !== null && r.memoizedState.cachePool !== null && (d = r.memoizedState.cachePool.pool), d !== c && (r.flags |= 2048)), a !== t && a && (e.child.flags |= 8192), lr(e, e.updateQueue), Ot(e), null);
          case 4:
            return ut(), gu(t, e), t === null && Jp(e.stateNode.containerInfo), Ot(e), null;
          case 10:
            return Pe(e.type), Ot(e), null;
          case 19:
            if (S(Yt), r = e.memoizedState, r === null) return Ot(e), null;
            if (c = (e.flags & 128) !== 0, d = r.rendering, d === null)
              if (c) tl(r, !1);
              else {
                if (Ut !== 0 || t !== null && (t.flags & 128) !== 0)
                  for (t = e.child; t !== null; ) {
                    if (d = Xl(t), d !== null) {
                      for (e.flags |= 128, tl(r, !1), t = d.updateQueue, e.updateQueue = t, lr(e, t), e.subtreeFlags = 0, t = a, a = e.child; a !== null; )
                        nd(a, t), a = a.sibling;
                      return z(
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
                if (t = Xl(d), t !== null) {
                  if (e.flags |= 128, c = !0, t = t.updateQueue, e.updateQueue = t, lr(e, t), tl(r, !0), r.tail === null && r.tailMode === "hidden" && !d.alternate && !St)
                    return Ot(e), null;
                } else
                  2 * ge() - r.renderingStartTime > vl && a !== 536870912 && (e.flags |= 128, c = !0, tl(r, !1), e.lanes = 4194304);
              r.isBackwards ? (d.sibling = e.child, e.child = d) : (t = r.last, t !== null ? t.sibling = d : e.child = d, r.last = d);
            }
            return r.tail !== null ? (t = r.tail, r.rendering = t, r.tail = t.sibling, r.renderingStartTime = ge(), t.sibling = null, a = Yt.current, z(
              Yt,
              c ? a & 1 | 2 : a & 1
            ), St && K(e, r.treeForkCount), t) : (Ot(e), null);
          case 22:
          case 23:
            return ye(e), Ni(), r = e.memoizedState !== null, t !== null ? t.memoizedState !== null !== r && (e.flags |= 8192) : r && (e.flags |= 8192), r ? (a & 536870912) !== 0 && (e.flags & 128) === 0 && (Ot(e), e.subtreeFlags & 6 && (e.flags |= 8192)) : Ot(e), a = e.updateQueue, a !== null && lr(e, a.retryQueue), a = null, t !== null && t.memoizedState !== null && t.memoizedState.cachePool !== null && (a = t.memoizedState.cachePool.pool), r = null, e.memoizedState !== null && e.memoizedState.cachePool !== null && (r = e.memoizedState.cachePool.pool), r !== a && (e.flags |= 2048), t !== null && S(aa), null;
          case 24:
            return a = null, t !== null && (a = t.memoizedState.cache), e.memoizedState.cache !== a && (e.flags |= 2048), Pe(Dt), Ot(e), null;
          case 25:
            return null;
          case 30:
            return null;
        }
        throw Error(s(156, e.tag));
      }
      function wp(t, e) {
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
                throw Error(s(340));
              He();
            }
            return t = e.flags, t & 65536 ? (e.flags = t & -65537 | 128, e) : null;
          case 13:
            if (ye(e), t = e.memoizedState, t !== null && t.dehydrated !== null) {
              if (e.alternate === null)
                throw Error(s(340));
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
            return ye(e), Ni(), t !== null && S(aa), t = e.flags, t & 65536 ? (e.flags = t & -65537 | 128, e) : null;
          case 24:
            return Pe(Dt), null;
          case 25:
            return null;
          default:
            return null;
        }
      }
      function vu(t, e) {
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
            ye(e), Ni(), t !== null && S(aa);
            break;
          case 24:
            Pe(Dt);
        }
      }
      function el(t, e) {
        try {
          var a = e.updateQueue, r = a !== null ? a.lastEffect : null;
          if (r !== null) {
            var c = r.next;
            a = c;
            do {
              if ((a.tag & t) === t) {
                r = void 0;
                var d = a.create, v = a.inst;
                r = d(), v.destroy = r;
              }
              a = a.next;
            } while (a !== c);
          }
        } catch (C) {
          zt(e, e.return, C);
        }
      }
      function _n(t, e, a) {
        try {
          var r = e.updateQueue, c = r !== null ? r.lastEffect : null;
          if (c !== null) {
            var d = c.next;
            r = d;
            do {
              if ((r.tag & t) === t) {
                var v = r.inst, C = v.destroy;
                if (C !== void 0) {
                  v.destroy = void 0, c = e;
                  var q = a, $ = C;
                  try {
                    $();
                  } catch (nt) {
                    zt(
                      c,
                      q,
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
      function yu(t) {
        var e = t.updateQueue;
        if (e !== null) {
          var a = t.stateNode;
          try {
            fc(e, a);
          } catch (r) {
            zt(t, t.return, r);
          }
        }
      }
      function xu(t, e, a) {
        a.props = Wn(
          t.type,
          t.memoizedProps
        ), a.state = t.memoizedState;
        try {
          a.componentWillUnmount();
        } catch (r) {
          zt(t, e, r);
        }
      }
      function nl(t, e) {
        try {
          var a = t.ref;
          if (a !== null) {
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
            typeof a == "function" ? t.refCleanup = a(r) : a.current = r;
          }
        } catch (c) {
          zt(t, e, c);
        }
      }
      function Ke(t, e) {
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
      function wu(t) {
        var e = t.type, a = t.memoizedProps, r = t.stateNode;
        try {
          ph(r, e, a, t);
        } catch (c) {
          zt(t, t.return, c);
        }
      }
      function no(t, e, a) {
        try {
          hh(
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
      function _u(t) {
        return t.tag === 5 || t.tag === 3 || (Ye ? t.tag === 26 : !1) || (Jt ? t.tag === 27 && _a(t.type) : !1) || t.tag === 4;
      }
      function ao(t) {
        t: for (; ; ) {
          for (; t.sibling === null; ) {
            if (t.return === null || _u(t.return)) return null;
            t = t.return;
          }
          for (t.sibling.return = t.return, t = t.sibling; t.tag !== 5 && t.tag !== 6 && t.tag !== 18; ) {
            if (Jt && t.tag === 27 && _a(t.type) || t.flags & 2 || t.child === null || t.tag === 4) continue t;
            t.child.return = t, t = t.child;
          }
          if (!(t.flags & 2)) return t.stateNode;
        }
      }
      function lo(t, e, a) {
        var r = t.tag;
        if (r === 5 || r === 6)
          t = t.stateNode, e ? bh(a, t, e) : fh(a, t);
        else if (r !== 4 && (Jt && r === 27 && _a(t.type) && (a = t.stateNode, e = null), t = t.child, t !== null))
          for (lo(t, e, a), t = t.sibling; t !== null; )
            lo(t, e, a), t = t.sibling;
      }
      function rr(t, e, a) {
        var r = t.tag;
        if (r === 5 || r === 6)
          t = t.stateNode, e ? gh(a, t, e) : dh(a, t);
        else if (r !== 4 && (Jt && r === 27 && _a(t.type) && (a = t.stateNode), t = t.child, t !== null))
          for (rr(t, e, a), t = t.sibling; t !== null; )
            rr(t, e, a), t = t.sibling;
      }
      function ku(t, e, a) {
        t = t.containerInfo;
        try {
          xd(t, a);
        } catch (r) {
          zt(e, e.return, r);
        }
      }
      function Su(t) {
        var e = t.stateNode, a = t.memoizedProps;
        try {
          u0(
            t.type,
            a,
            e,
            t
          );
        } catch (r) {
          zt(t, t.return, r);
        }
      }
      function _p(t, e) {
        for (Lp(t.containerInfo), Pt = e; Pt !== null; )
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
                    var d = r.stateNode;
                    try {
                      var v = Wn(
                        r.type,
                        c
                      );
                      e = d.getSnapshotBeforeUpdate(
                        v,
                        a
                      ), d.__reactInternalSnapshotBeforeUpdate = e;
                    } catch (C) {
                      zt(r, r.return, C);
                    }
                  }
                  break;
                case 3:
                  (e & 1024) !== 0 && ce && Sh(t.stateNode.containerInfo);
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
      function Eu(t, e, a) {
        var r = a.flags;
        switch (a.tag) {
          case 0:
          case 11:
          case 15:
            nn(t, a), r & 4 && el(5, a);
            break;
          case 1:
            if (nn(t, a), r & 4)
              if (t = a.stateNode, e === null)
                try {
                  t.componentDidMount();
                } catch (v) {
                  zt(a, a.return, v);
                }
              else {
                var c = Wn(
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
                } catch (v) {
                  zt(
                    a,
                    a.return,
                    v
                  );
                }
              }
            r & 64 && yu(a), r & 512 && nl(a, a.return);
            break;
          case 3:
            if (nn(t, a), r & 64 && (r = a.updateQueue, r !== null)) {
              if (t = null, a.child !== null)
                switch (a.child.tag) {
                  case 27:
                  case 5:
                    t = il(a.child.stateNode);
                    break;
                  case 1:
                    t = a.child.stateNode;
                }
              try {
                fc(r, t);
              } catch (v) {
                zt(a, a.return, v);
              }
            }
            break;
          case 27:
            Jt && e === null && r & 4 && Su(a);
          case 26:
          case 5:
            if (nn(t, a), e === null) {
              if (r & 4) wu(a);
              else if (r & 64) {
                t = a.type, e = a.memoizedProps, c = a.stateNode;
                try {
                  Zh(
                    c,
                    t,
                    e,
                    a
                  );
                } catch (v) {
                  zt(a, a.return, v);
                }
              }
            }
            r & 512 && nl(a, a.return);
            break;
          case 12:
            nn(t, a);
            break;
          case 31:
            nn(t, a), r & 4 && Nu(t, a);
            break;
          case 13:
            nn(t, a), r & 4 && Tu(t, a), r & 64 && (r = a.memoizedState, r !== null && (r = r.dehydrated, r !== null && (a = Mp.bind(
              null,
              a
            ), Th(r, a))));
            break;
          case 22:
            if (r = a.memoizedState !== null || un, !r) {
              e = e !== null && e.memoizedState !== null || Vt, c = un;
              var d = Vt;
              un = r, (Vt = e) && !d ? an(
                t,
                a,
                (a.subtreeFlags & 8772) !== 0
              ) : nn(t, a), un = c, Vt = d;
            }
            break;
          case 30:
            break;
          default:
            nn(t, a);
        }
      }
      function zu(t) {
        var e = t.alternate;
        e !== null && (t.alternate = null, zu(e)), t.child = null, t.deletions = null, t.sibling = null, t.tag === 5 && (e = t.stateNode, e !== null && $p(e)), t.stateNode = null, t.return = null, t.dependencies = null, t.memoizedProps = null, t.memoizedState = null, t.pendingProps = null, t.stateNode = null, t.updateQueue = null;
      }
      function Ue(t, e, a) {
        for (a = a.child; a !== null; )
          ro(
            t,
            e,
            a
          ), a = a.sibling;
      }
      function ro(t, e, a) {
        if (ke && typeof ke.onCommitFiberUnmount == "function")
          try {
            ke.onCommitFiberUnmount(cl, a);
          } catch {
          }
        switch (a.tag) {
          case 26:
            if (Ye) {
              Vt || Ke(a, e), Ue(
                t,
                e,
                a
              ), a.memoizedState ? Td(a.memoizedState) : a.stateNode && Cd(a.stateNode);
              break;
            }
          case 27:
            if (Jt) {
              Vt || Ke(a, e);
              var r = Kt, c = be;
              _a(a.type) && (Kt = a.stateNode, be = !1), Ue(
                t,
                e,
                a
              ), Od(a.stateNode), Kt = r, be = c;
              break;
            }
          case 5:
            Vt || Ke(a, e);
          case 6:
            if (ce) {
              if (r = Kt, c = be, Kt = null, Ue(
                t,
                e,
                a
              ), Kt = r, be = c, Kt !== null)
                if (be)
                  try {
                    yh(Kt, a.stateNode);
                  } catch (d) {
                    zt(
                      a,
                      e,
                      d
                    );
                  }
                else
                  try {
                    vh(Kt, a.stateNode);
                  } catch (d) {
                    zt(
                      a,
                      e,
                      d
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
            ce && Kt !== null && (be ? t0(
              Kt,
              a.stateNode
            ) : Ph(Kt, a.stateNode));
            break;
          case 4:
            ce ? (r = Kt, c = be, Kt = a.stateNode.containerInfo, be = !0, Ue(
              t,
              e,
              a
            ), Kt = r, be = c) : (Xe && ku(
              a.stateNode,
              a,
              vd()
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
            _n(2, a, e), Vt || _n(4, a, e), Ue(
              t,
              e,
              a
            );
            break;
          case 1:
            Vt || (Ke(a, e), r = a.stateNode, typeof r.componentWillUnmount == "function" && xu(
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
            Vt = (r = Vt) || a.memoizedState !== null, Ue(
              t,
              e,
              a
            ), Vt = r;
            break;
          default:
            Ue(
              t,
              e,
              a
            );
        }
      }
      function Nu(t, e) {
        if (ue && e.memoizedState === null && (t = e.alternate, t !== null && (t = t.memoizedState, t !== null))) {
          t = t.dehydrated;
          try {
            Wh(t);
          } catch (a) {
            zt(e, e.return, a);
          }
        }
      }
      function Tu(t, e) {
        if (ue && e.memoizedState === null && (t = e.alternate, t !== null && (t = t.memoizedState, t !== null && (t = t.dehydrated, t !== null))))
          try {
            Fh(t);
          } catch (a) {
            zt(e, e.return, a);
          }
      }
      function kp(t) {
        switch (t.tag) {
          case 31:
          case 13:
          case 19:
            var e = t.stateNode;
            return e === null && (e = t.stateNode = new Qd()), e;
          case 22:
            return t = t.stateNode, e = t._retryCache, e === null && (e = t._retryCache = new Qd()), e;
          default:
            throw Error(s(435, t.tag));
        }
      }
      function ir(t, e) {
        var a = kp(t);
        e.forEach(function(r) {
          if (!a.has(r)) {
            a.add(r);
            var c = Cp.bind(null, t, r);
            r.then(c, c);
          }
        });
      }
      function se(t, e) {
        var a = e.deletions;
        if (a !== null)
          for (var r = 0; r < a.length; r++) {
            var c = a[r], d = t, v = e;
            if (ce) {
              var C = v;
              t: for (; C !== null; ) {
                switch (C.tag) {
                  case 27:
                    if (Jt) {
                      if (_a(C.type)) {
                        Kt = C.stateNode, be = !1;
                        break t;
                      }
                      break;
                    }
                  case 5:
                    Kt = C.stateNode, be = !1;
                    break t;
                  case 3:
                  case 4:
                    Kt = C.stateNode.containerInfo, be = !0;
                    break t;
                }
                C = C.return;
              }
              if (Kt === null) throw Error(s(160));
              ro(d, v, c), Kt = null, be = !1;
            } else ro(d, v, c);
            d = c.alternate, d !== null && (d.return = null), c.return = null;
          }
        if (e.subtreeFlags & 13886)
          for (e = e.child; e !== null; )
            Mu(e, t), e = e.sibling;
      }
      function Mu(t, e) {
        var a = t.alternate, r = t.flags;
        switch (t.tag) {
          case 0:
          case 11:
          case 14:
          case 15:
            se(e, t), me(t), r & 4 && (_n(3, t, t.return), el(3, t), _n(5, t, t.return));
            break;
          case 1:
            se(e, t), me(t), r & 512 && (Vt || a === null || Ke(a, a.return)), r & 64 && un && (t = t.updateQueue, t !== null && (r = t.callbacks, r !== null && (a = t.shared.hiddenCallbacks, t.shared.hiddenCallbacks = a === null ? r : a.concat(r))));
            break;
          case 26:
            if (Ye) {
              var c = qe;
              if (se(e, t), me(t), r & 512 && (Vt || a === null || Ke(a, a.return)), r & 4) {
                r = a !== null ? a.memoizedState : null;
                var d = t.memoizedState;
                a === null ? d === null ? t.stateNode === null ? t.stateNode = r0(
                  c,
                  t.type,
                  t.memoizedProps,
                  t
                ) : Md(
                  c,
                  t.type,
                  t.stateNode
                ) : t.stateNode = Nd(
                  c,
                  d,
                  t.memoizedProps
                ) : r !== d ? (r === null ? a.stateNode !== null && Cd(a.stateNode) : Td(r), d === null ? Md(
                  c,
                  t.type,
                  t.stateNode
                ) : Nd(
                  c,
                  d,
                  t.memoizedProps
                )) : d === null && t.stateNode !== null && no(
                  t,
                  t.memoizedProps,
                  a.memoizedProps
                );
              }
              break;
            }
          case 27:
            if (Jt) {
              se(e, t), me(t), r & 512 && (Vt || a === null || Ke(a, a.return)), a !== null && r & 4 && no(
                t,
                t.memoizedProps,
                a.memoizedProps
              );
              break;
            }
          case 5:
            if (se(e, t), me(t), r & 512 && (Vt || a === null || Ke(a, a.return)), ce) {
              if (t.flags & 32) {
                c = t.stateNode;
                try {
                  bd(c);
                } catch (P) {
                  zt(t, t.return, P);
                }
              }
              r & 4 && t.stateNode != null && (c = t.memoizedProps, no(
                t,
                c,
                a !== null ? a.memoizedProps : c
              )), r & 1024 && (Jo = !0);
            } else
              Xe && t.alternate !== null && (t.alternate.stateNode = t.stateNode);
            break;
          case 6:
            if (se(e, t), me(t), r & 4 && ce) {
              if (t.stateNode === null)
                throw Error(s(162));
              r = t.memoizedProps, a = a !== null ? a.memoizedProps : r, c = t.stateNode;
              try {
                mh(c, a, r);
              } catch (P) {
                zt(t, t.return, P);
              }
            }
            break;
          case 3:
            if (Ye ? (o0(), c = qe, qe = Ao(e.containerInfo), se(e, t), qe = c) : se(e, t), me(t), r & 4) {
              if (ce && ue && a !== null && a.memoizedState.isDehydrated)
                try {
                  Jh(e.containerInfo);
                } catch (P) {
                  zt(t, t.return, P);
                }
              if (Xe) {
                r = e.containerInfo, a = e.pendingChildren;
                try {
                  xd(r, a);
                } catch (P) {
                  zt(t, t.return, P);
                }
              }
            }
            Jo && (Jo = !1, Cu(t));
            break;
          case 4:
            Ye ? (a = qe, qe = Ao(
              t.stateNode.containerInfo
            ), se(e, t), me(t), qe = a) : (se(e, t), me(t)), r & 4 && Xe && ku(
              t.stateNode,
              t,
              t.stateNode.pendingChildren
            );
            break;
          case 12:
            se(e, t), me(t);
            break;
          case 31:
            se(e, t), me(t), r & 4 && (r = t.updateQueue, r !== null && (t.updateQueue = null, ir(t, r)));
            break;
          case 13:
            se(e, t), me(t), t.child.flags & 8192 && t.memoizedState !== null != (a !== null && a.memoizedState !== null) && (Or = ge()), r & 4 && (r = t.updateQueue, r !== null && (t.updateQueue = null, ir(t, r)));
            break;
          case 22:
            c = t.memoizedState !== null;
            var v = a !== null && a.memoizedState !== null, C = un, q = Vt;
            if (un = C || c, Vt = q || v, se(e, t), Vt = q, un = C, me(t), r & 8192 && (e = t.stateNode, e._visibility = c ? e._visibility & -2 : e._visibility | 1, c && (a === null || v || un || Vt || Fn(t)), ce)) {
              t: if (a = null, ce)
                for (e = t; ; ) {
                  if (e.tag === 5 || Ye && e.tag === 26) {
                    if (a === null) {
                      v = a = e;
                      try {
                        d = v.stateNode, c ? xh(d) : _h(
                          v.stateNode,
                          v.memoizedProps
                        );
                      } catch (P) {
                        zt(v, v.return, P);
                      }
                    }
                  } else if (e.tag === 6) {
                    if (a === null) {
                      v = e;
                      try {
                        var $ = v.stateNode;
                        c ? wh($) : kh($, v.memoizedProps);
                      } catch (P) {
                        zt(v, v.return, P);
                      }
                    }
                  } else if (e.tag === 18) {
                    if (a === null) {
                      v = e;
                      try {
                        var nt = v.stateNode;
                        c ? e0(nt) : n0(v.stateNode);
                      } catch (P) {
                        zt(v, v.return, P);
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
            r & 4 && (r = t.updateQueue, r !== null && (a = r.retryQueue, a !== null && (r.retryQueue = null, ir(t, a))));
            break;
          case 19:
            se(e, t), me(t), r & 4 && (r = t.updateQueue, r !== null && (t.updateQueue = null, ir(t, r)));
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
              if (_u(r)) {
                a = r;
                break;
              }
              r = r.return;
            }
            if (ce) {
              if (a == null) throw Error(s(160));
              switch (a.tag) {
                case 27:
                  if (Jt) {
                    var c = a.stateNode, d = ao(t);
                    rr(t, d, c);
                    break;
                  }
                case 5:
                  var v = a.stateNode;
                  a.flags & 32 && (bd(v), a.flags &= -33);
                  var C = ao(t);
                  rr(t, C, v);
                  break;
                case 3:
                case 4:
                  var q = a.stateNode.containerInfo, $ = ao(t);
                  lo(
                    t,
                    $,
                    q
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
      function Cu(t) {
        if (t.subtreeFlags & 1024)
          for (t = t.child; t !== null; ) {
            var e = t;
            Cu(e), e.tag === 5 && e.flags & 1024 && nh(e.stateNode), t = t.sibling;
          }
      }
      function nn(t, e) {
        if (e.subtreeFlags & 8772)
          for (e = e.child; e !== null; )
            Eu(t, e.alternate, e), e = e.sibling;
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
              var a = e.stateNode;
              typeof a.componentWillUnmount == "function" && xu(
                e,
                e.return,
                a
              ), Fn(e);
              break;
            case 27:
              Jt && Od(e.stateNode);
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
      function an(t, e, a) {
        for (a = a && (e.subtreeFlags & 8772) !== 0, e = e.child; e !== null; ) {
          var r = e.alternate, c = t, d = e, v = d.flags;
          switch (d.tag) {
            case 0:
            case 11:
            case 15:
              an(
                c,
                d,
                a
              ), el(4, d);
              break;
            case 1:
              if (an(
                c,
                d,
                a
              ), r = d, c = r.stateNode, typeof c.componentDidMount == "function")
                try {
                  c.componentDidMount();
                } catch ($) {
                  zt(r, r.return, $);
                }
              if (r = d, c = r.updateQueue, c !== null) {
                var C = r.stateNode;
                try {
                  var q = c.shared.hiddenCallbacks;
                  if (q !== null)
                    for (c.shared.hiddenCallbacks = null, c = 0; c < q.length; c++)
                      dc(q[c], C);
                } catch ($) {
                  zt(r, r.return, $);
                }
              }
              a && v & 64 && yu(d), nl(d, d.return);
              break;
            case 27:
              Jt && Su(d);
            case 26:
            case 5:
              an(
                c,
                d,
                a
              ), a && r === null && v & 4 && wu(d), nl(d, d.return);
              break;
            case 12:
              an(
                c,
                d,
                a
              );
              break;
            case 31:
              an(
                c,
                d,
                a
              ), a && v & 4 && Nu(c, d);
              break;
            case 13:
              an(
                c,
                d,
                a
              ), a && v & 4 && Tu(c, d);
              break;
            case 22:
              d.memoizedState === null && an(
                c,
                d,
                a
              ), nl(d, d.return);
              break;
            case 30:
              break;
            default:
              an(
                c,
                d,
                a
              );
          }
          e = e.sibling;
        }
      }
      function io(t, e) {
        var a = null;
        t !== null && t.memoizedState !== null && t.memoizedState.cachePool !== null && (a = t.memoizedState.cachePool.pool), t = null, e.memoizedState !== null && e.memoizedState.cachePool !== null && (t = e.memoizedState.cachePool.pool), t !== a && (t != null && t.refCount++, a != null && Xa(a));
      }
      function oo(t, e) {
        t = null, e.alternate !== null && (t = e.alternate.memoizedState.cache), e = e.memoizedState.cache, e !== t && (e.refCount++, t != null && Xa(t));
      }
      function Ge(t, e, a, r) {
        if (e.subtreeFlags & 10256)
          for (e = e.child; e !== null; )
            Au(
              t,
              e,
              a,
              r
            ), e = e.sibling;
      }
      function Au(t, e, a, r) {
        var c = e.flags;
        switch (e.tag) {
          case 0:
          case 11:
          case 15:
            Ge(
              t,
              e,
              a,
              r
            ), c & 2048 && el(9, e);
            break;
          case 1:
            Ge(
              t,
              e,
              a,
              r
            );
            break;
          case 3:
            Ge(
              t,
              e,
              a,
              r
            ), c & 2048 && (t = null, e.alternate !== null && (t = e.alternate.memoizedState.cache), e = e.memoizedState.cache, e !== t && (e.refCount++, t != null && Xa(t)));
            break;
          case 12:
            if (c & 2048) {
              Ge(
                t,
                e,
                a,
                r
              ), t = e.stateNode;
              try {
                var d = e.memoizedProps, v = d.id, C = d.onPostCommit;
                typeof C == "function" && C(
                  v,
                  e.alternate === null ? "mount" : "update",
                  t.passiveEffectDuration,
                  -0
                );
              } catch (q) {
                zt(e, e.return, q);
              }
            } else
              Ge(
                t,
                e,
                a,
                r
              );
            break;
          case 31:
            Ge(
              t,
              e,
              a,
              r
            );
            break;
          case 13:
            Ge(
              t,
              e,
              a,
              r
            );
            break;
          case 23:
            break;
          case 22:
            d = e.stateNode, v = e.alternate, e.memoizedState !== null ? d._visibility & 2 ? Ge(
              t,
              e,
              a,
              r
            ) : al(
              t,
              e
            ) : d._visibility & 2 ? Ge(
              t,
              e,
              a,
              r
            ) : (d._visibility |= 2, ga(
              t,
              e,
              a,
              r,
              (e.subtreeFlags & 10256) !== 0 || !1
            )), c & 2048 && io(v, e);
            break;
          case 24:
            Ge(
              t,
              e,
              a,
              r
            ), c & 2048 && oo(e.alternate, e);
            break;
          default:
            Ge(
              t,
              e,
              a,
              r
            );
        }
      }
      function ga(t, e, a, r, c) {
        for (c = c && ((e.subtreeFlags & 10256) !== 0 || !1), e = e.child; e !== null; ) {
          var d = t, v = e, C = a, q = r, $ = v.flags;
          switch (v.tag) {
            case 0:
            case 11:
            case 15:
              ga(
                d,
                v,
                C,
                q,
                c
              ), el(8, v);
              break;
            case 23:
              break;
            case 22:
              var nt = v.stateNode;
              v.memoizedState !== null ? nt._visibility & 2 ? ga(
                d,
                v,
                C,
                q,
                c
              ) : al(
                d,
                v
              ) : (nt._visibility |= 2, ga(
                d,
                v,
                C,
                q,
                c
              )), c && $ & 2048 && io(
                v.alternate,
                v
              );
              break;
            case 24:
              ga(
                d,
                v,
                C,
                q,
                c
              ), c && $ & 2048 && oo(v.alternate, v);
              break;
            default:
              ga(
                d,
                v,
                C,
                q,
                c
              );
          }
          e = e.sibling;
        }
      }
      function al(t, e) {
        if (e.subtreeFlags & 10256)
          for (e = e.child; e !== null; ) {
            var a = t, r = e, c = r.flags;
            switch (r.tag) {
              case 22:
                al(a, r), c & 2048 && io(
                  r.alternate,
                  r
                );
                break;
              case 24:
                al(a, r), c & 2048 && oo(
                  r.alternate,
                  r
                );
                break;
              default:
                al(a, r);
            }
            e = e.sibling;
          }
      }
      function $n(t, e, a) {
        if (t.subtreeFlags & Ha)
          for (t = t.child; t !== null; )
            ju(
              t,
              e,
              a
            ), t = t.sibling;
      }
      function ju(t, e, a) {
        switch (t.tag) {
          case 26:
            if ($n(
              t,
              e,
              a
            ), t.flags & Ha)
              if (t.memoizedState !== null)
                c0(
                  a,
                  qe,
                  t.memoizedState,
                  t.memoizedProps
                );
              else {
                var r = t.stateNode, c = t.type;
                t = t.memoizedProps, ((e & 335544128) === e || To(c, t)) && gd(a, r, c, t);
              }
            break;
          case 5:
            $n(
              t,
              e,
              a
            ), t.flags & Ha && (r = t.stateNode, c = t.type, t = t.memoizedProps, ((e & 335544128) === e || To(c, t)) && gd(a, r, c, t));
            break;
          case 3:
          case 4:
            Ye ? (r = qe, qe = Ao(
              t.stateNode.containerInfo
            ), $n(
              t,
              e,
              a
            ), qe = r) : $n(
              t,
              e,
              a
            );
            break;
          case 22:
            t.memoizedState === null && (r = t.alternate, r !== null && r.memoizedState !== null ? (r = Ha, Ha = 16777216, $n(
              t,
              e,
              a
            ), Ha = r) : $n(
              t,
              e,
              a
            ));
            break;
          default:
            $n(
              t,
              e,
              a
            );
        }
      }
      function Ou(t) {
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
            for (var a = 0; a < e.length; a++) {
              var r = e[a];
              Pt = r, Du(
                r,
                t
              );
            }
          Ou(t);
        }
        if (t.subtreeFlags & 10256)
          for (t = t.child; t !== null; )
            Ru(t), t = t.sibling;
      }
      function Ru(t) {
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
            t.memoizedState !== null && e._visibility & 2 && (t.return === null || t.return.tag !== 13) ? (e._visibility &= -3, or(t)) : ll(t);
            break;
          default:
            ll(t);
        }
      }
      function or(t) {
        var e = t.deletions;
        if ((t.flags & 16) !== 0) {
          if (e !== null)
            for (var a = 0; a < e.length; a++) {
              var r = e[a];
              Pt = r, Du(
                r,
                t
              );
            }
          Ou(t);
        }
        for (t = t.child; t !== null; ) {
          switch (e = t, e.tag) {
            case 0:
            case 11:
            case 15:
              _n(8, e, e.return), or(e);
              break;
            case 22:
              a = e.stateNode, a._visibility & 2 && (a._visibility &= -3, or(e));
              break;
            default:
              or(e);
          }
          t = t.sibling;
        }
      }
      function Du(t, e) {
        for (; Pt !== null; ) {
          var a = Pt;
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
              Xa(a.memoizedState.cache);
          }
          if (r = a.child, r !== null) r.return = a, Pt = r;
          else
            t: for (a = t; Pt !== null; ) {
              r = Pt;
              var c = r.sibling, d = r.return;
              if (zu(r), r === a) {
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
      function so(t) {
        var e = Zp(t);
        if (e != null) {
          if (typeof e.memoizedProps["data-testname"] != "string")
            throw Error(s(364));
          return e;
        }
        if (t = rh(t), t === null) throw Error(s(362));
        return t.stateNode.current;
      }
      function co(t, e) {
        var a = t.tag;
        switch (e.$$typeof) {
          case Tr:
            if (t.type === e.value) return !0;
            break;
          case Mr:
            t: {
              for (e = e.value, t = [t, 0], a = 0; a < t.length; ) {
                var r = t[a++], c = r.tag, d = t[a++], v = e[d];
                if (c !== 5 && c !== 26 && c !== 27 || !sl(r)) {
                  for (; v != null && co(r, v); )
                    d++, v = e[d];
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
          case Cr:
            if ((a === 5 || a === 26 || a === 27) && sh(t.stateNode, e.value))
              return !0;
            break;
          case jr:
            if ((a === 5 || a === 6 || a === 26 || a === 27) && (t = oh(t), t !== null && 0 <= t.indexOf(e.value)))
              return !0;
            break;
          case Ar:
            if ((a === 5 || a === 26 || a === 27) && (t = t.memoizedProps["data-testname"], typeof t == "string" && t.toLowerCase() === e.value.toLowerCase()))
              return !0;
            break;
          default:
            throw Error(s(365));
        }
        return !1;
      }
      function uo(t) {
        switch (t.$$typeof) {
          case Tr:
            return "<" + (k(t.value) || "Unknown") + ">";
          case Mr:
            return ":has(" + (uo(t) || "") + ")";
          case Cr:
            return '[role="' + t.value + '"]';
          case jr:
            return '"' + t.value + '"';
          case Ar:
            return '[data-testname="' + t.value + '"]';
          default:
            throw Error(s(365));
        }
      }
      function Hu(t, e) {
        var a = [];
        t = [t, 0];
        for (var r = 0; r < t.length; ) {
          var c = t[r++], d = c.tag, v = t[r++], C = e[v];
          if (d !== 5 && d !== 26 && d !== 27 || !sl(c)) {
            for (; C != null && co(c, C); )
              v++, C = e[v];
            if (v === e.length) a.push(c);
            else
              for (c = c.child; c !== null; )
                t.push(c, v), c = c.sibling;
          }
        }
        return a;
      }
      function fo(t, e) {
        if (!ol) throw Error(s(363));
        t = so(t), t = Hu(t, e), e = [], t = Array.from(t);
        for (var a = 0; a < t.length; ) {
          var r = t[a++], c = r.tag;
          if (c === 5 || c === 26 || c === 27)
            sl(r) || e.push(r.stateNode);
          else
            for (r = r.child; r !== null; )
              t.push(r), r = r.sibling;
        }
        return e;
      }
      function xe() {
        return (wt & 2) !== 0 && kt !== 0 ? kt & -kt : dt.T !== null ? xi() : Wp();
      }
      function Bu() {
        if (Ne === 0)
          if ((kt & 536870912) === 0 || St) {
            var t = hr;
            hr <<= 1, (hr & 3932160) === 0 && (hr = 262144), Ne = t;
          } else Ne = 536870912;
        return t = Ee.current, t !== null && (t.flags |= 32), Ne;
      }
      function he(t, e, a) {
        (t === At && (Mt === 2 || Mt === 9) || t.cancelPendingCommit !== null) && (ba(t, 0), kn(
          t,
          kt,
          Ne,
          !1
        )), D(t, a), ((wt & 2) === 0 || t !== At) && (t === At && ((wt & 2) === 0 && (oa |= a), Ut === 4 && kn(
          t,
          kt,
          Ne,
          !1
        )), Ve(t));
      }
      function Uu(t, e, a) {
        if ((wt & 6) !== 0) throw Error(s(327));
        var r = !a && (e & 127) === 0 && (e & t.expiredLanes) === 0 || R(t, e), c = r ? zp(t, e) : po(t, e, !0), d = r;
        do {
          if (c === 0) {
            Ba && !r && kn(t, e, 0, !1);
            break;
          } else {
            if (a = t.current.alternate, d && !Sp(a)) {
              c = po(t, e, !1), d = !1;
              continue;
            }
            if (c === 2) {
              if (d = e, t.errorRecoveryDisabledLanes & d)
                var v = 0;
              else
                v = t.pendingLanes & -536870913, v = v !== 0 ? v : v & 536870912 ? 536870912 : 0;
              if (v !== 0) {
                e = v;
                t: {
                  var C = t;
                  c = bl;
                  var q = ue && C.current.memoizedState.isDehydrated;
                  if (q && (ba(C, v).flags |= 256), v = po(
                    C,
                    v,
                    !1
                  ), v !== 2) {
                    if (Wo && !q) {
                      C.errorRecoveryDisabledLanes |= d, oa |= d, c = 4;
                      break t;
                    }
                    d = ve, ve = c, d !== null && (ve === null ? ve = d : ve.push.apply(
                      ve,
                      d
                    ));
                  }
                  c = v;
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
                  throw Error(s(345));
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
                  throw Error(s(329));
              }
              if ((e & 62914560) === e && (c = Or + 300 - ge(), 10 < c)) {
                if (kn(
                  r,
                  e,
                  Ne,
                  !Cn
                ), A(r, 0, !0) !== 0) break t;
                fn = e, r.timeoutHandle = Kp(
                  Gu.bind(
                    null,
                    r,
                    a,
                    ve,
                    Rr,
                    $o,
                    e,
                    Ne,
                    oa,
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
              Gu(
                r,
                a,
                ve,
                Rr,
                $o,
                e,
                Ne,
                oa,
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
      function Gu(t, e, a, r, c, d, v, C, q, $, nt, P, lt, gt) {
        if (t.timeoutHandle = Pn, P = e.subtreeFlags, P & 8192 || (P & 16785408) === 16785408) {
          P = th(), ju(
            e,
            d,
            P
          );
          var re = (d & 62914560) === d ? Or - ge() : (d & 4194048) === d ? Vd - ge() : 0;
          if (re = eh(
            P,
            re
          ), re !== null) {
            fn = d, t.cancelPendingCommit = re(
              Ju.bind(
                null,
                t,
                e,
                d,
                a,
                r,
                c,
                v,
                C,
                q,
                nt,
                P,
                null,
                lt,
                gt
              )
            ), kn(t, d, v, !$);
            return;
          }
        }
        Ju(
          t,
          e,
          d,
          a,
          r,
          c,
          v,
          C,
          q
        );
      }
      function Sp(t) {
        for (var e = t; ; ) {
          var a = e.tag;
          if ((a === 0 || a === 11 || a === 15) && e.flags & 16384 && (a = e.updateQueue, a !== null && (a = a.stores, a !== null)))
            for (var r = 0; r < a.length; r++) {
              var c = a[r], d = c.getSnapshot;
              c = c.value;
              try {
                if (!Se(d(), c)) return !1;
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
        e &= ~Fo, e &= ~oa, t.suspendedLanes |= e, t.pingedLanes &= ~e, r && (t.warmLanes |= e), r = t.expirationTimes;
        for (var c = e; 0 < c; ) {
          var d = 31 - _e(c), v = 1 << d;
          r[d] = -1, c &= ~v;
        }
        a !== 0 && b(t, a, e);
      }
      function Yu() {
        return (wt & 6) === 0 ? (pa(0), !1) : !0;
      }
      function mo() {
        if (_t !== null) {
          if (Mt === 0)
            var t = _t.return;
          else
            t = _t, sn = ea = null, Oi(t), Aa = null, ml = 0, t = _t;
          for (; t !== null; )
            vu(t.alternate, t), t = t.return;
          _t = null;
        }
      }
      function ba(t, e) {
        var a = t.timeoutHandle;
        a !== Pn && (t.timeoutHandle = Pn, Xp(a)), a = t.cancelPendingCommit, a !== null && (t.cancelPendingCommit = null, a()), fn = 0, mo(), At = t, _t = a = ln(t.current, null), kt = e, Mt = 0, ze = null, Cn = !1, Ba = R(t, e), Wo = !1, Ua = Ne = Fo = oa = An = Ut = 0, ve = bl = null, $o = !1, (e & 8) !== 0 && (e |= e & 32);
        var r = t.entangledLanes;
        if (r !== 0)
          for (t = t.entanglements, r &= e; 0 < r; ) {
            var c = 31 - _e(r), d = 1 << c;
            e |= t[c], r &= ~d;
          }
        return dn = e, Ql(), a;
      }
      function qu(t, e) {
        bt = null, dt.H = hl, e === Ca || e === kr ? (e = oc(), Mt = 3) : e === qo ? (e = oc(), Mt = 4) : Mt = e === Xo ? 8 : e !== null && typeof e == "object" && typeof e.then == "function" ? 6 : 1, ze = e, _t === null && (Ut = 1, Pl(
          t,
          L(e, t.current)
        ));
      }
      function Lu() {
        var t = Ee.current;
        return t === null ? !0 : (kt & 4194048) === kt ? Oe === null : (kt & 62914560) === kt || (kt & 536870912) !== 0 ? t === Oe : !1;
      }
      function Qu() {
        var t = dt.H;
        return dt.H = hl, t === null ? hl : t;
      }
      function Vu() {
        var t = dt.A;
        return dt.A = S0, t;
      }
      function sr() {
        Ut = 4, Cn || (kt & 4194048) !== kt && Ee.current !== null || (Ba = !0), (An & 134217727) === 0 && (oa & 134217727) === 0 || At === null || kn(
          At,
          kt,
          Ne,
          !1
        );
      }
      function po(t, e, a) {
        var r = wt;
        wt |= 2;
        var c = Qu(), d = Vu();
        (At !== t || kt !== e) && (Rr = null, ba(t, e)), e = !1;
        var v = Ut;
        t: do
          try {
            if (Mt !== 0 && _t !== null) {
              var C = _t, q = ze;
              switch (Mt) {
                case 8:
                  mo(), v = 6;
                  break t;
                case 3:
                case 2:
                case 9:
                case 6:
                  Ee.current === null && (e = !0);
                  var $ = Mt;
                  if (Mt = 0, ze = null, va(t, C, q, $), a && Ba) {
                    v = 0;
                    break t;
                  }
                  break;
                default:
                  $ = Mt, Mt = 0, ze = null, va(t, C, q, $);
              }
            }
            Ep(), v = Ut;
            break;
          } catch (nt) {
            qu(t, nt);
          }
        while (!0);
        return e && t.shellSuspendCounter++, sn = ea = null, wt = r, dt.H = c, dt.A = d, _t === null && (At = null, kt = 0, Ql()), v;
      }
      function Ep() {
        for (; _t !== null; ) Ku(_t);
      }
      function zp(t, e) {
        var a = wt;
        wt |= 2;
        var r = Qu(), c = Vu();
        At !== t || kt !== e ? (Rr = null, vl = ge() + 500, ba(t, e)) : Ba = R(
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
                  if (rc(d)) {
                    Mt = 0, ze = null, Xu(e);
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
                  rc(d) ? (Mt = 0, ze = null, Xu(e)) : (Mt = 0, ze = null, va(t, e, d, 7));
                  break;
                case 5:
                  var v = null;
                  switch (_t.tag) {
                    case 26:
                      v = _t.memoizedState;
                    case 5:
                    case 27:
                      var C = _t, q = C.type, $ = C.pendingProps;
                      if (v ? Ad(v) : hd(C.stateNode, q, $)) {
                        Mt = 0, ze = null;
                        var nt = C.sibling;
                        if (nt !== null) _t = nt;
                        else {
                          var P = C.return;
                          P !== null ? (_t = P, cr(P)) : _t = null;
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
                  mo(), Ut = 6;
                  break t;
                default:
                  throw Error(s(462));
              }
            }
            Np();
            break;
          } catch (lt) {
            qu(t, lt);
          }
        while (!0);
        return sn = ea = null, dt.H = r, dt.A = c, wt = a, _t !== null ? 0 : (At = null, kt = 0, Ql(), Ut);
      }
      function Np() {
        for (; _t !== null && !m0(); )
          Ku(_t);
      }
      function Ku(t) {
        var e = mu(
          t.alternate,
          t,
          dn
        );
        t.memoizedProps = t.pendingProps, e === null ? cr(t) : _t = e;
      }
      function Xu(t) {
        var e = t, a = e.alternate;
        switch (e.tag) {
          case 15:
          case 0:
            e = ou(
              a,
              e,
              e.pendingProps,
              e.type,
              void 0,
              kt
            );
            break;
          case 11:
            e = ou(
              a,
              e,
              e.pendingProps,
              e.type.render,
              e.ref,
              kt
            );
            break;
          case 5:
            Oi(e);
          default:
            vu(a, e), e = _t = nd(e, dn), e = mu(a, e, dn);
        }
        t.memoizedProps = t.pendingProps, e === null ? cr(t) : _t = e;
      }
      function va(t, e, a, r) {
        sn = ea = null, Oi(e), Aa = null, ml = 0;
        var c = e.return;
        try {
          if (bp(
            t,
            c,
            e,
            a,
            kt
          )) {
            Ut = 1, Pl(
              t,
              L(a, t.current)
            ), _t = null;
            return;
          }
        } catch (d) {
          if (c !== null) throw _t = c, d;
          Ut = 1, Pl(
            t,
            L(a, t.current)
          ), _t = null;
          return;
        }
        e.flags & 32768 ? (St || r === 1 ? t = !0 : Ba || (kt & 536870912) !== 0 ? t = !1 : (Cn = t = !0, (r === 2 || r === 9 || r === 3 || r === 6) && (r = Ee.current, r !== null && r.tag === 13 && (r.flags |= 16384))), Zu(e, t)) : cr(e);
      }
      function cr(t) {
        var e = t;
        do {
          if ((e.flags & 32768) !== 0) {
            Zu(
              e,
              Cn
            );
            return;
          }
          t = e.return;
          var a = xp(
            e.alternate,
            e,
            dn
          );
          if (a !== null) {
            _t = a;
            return;
          }
          if (e = e.sibling, e !== null) {
            _t = e;
            return;
          }
          _t = e = t;
        } while (e !== null);
        Ut === 0 && (Ut = 5);
      }
      function Zu(t, e) {
        do {
          var a = wp(t.alternate, t);
          if (a !== null) {
            a.flags &= 32767, _t = a;
            return;
          }
          if (a = t.return, a !== null && (a.flags |= 32768, a.subtreeFlags = 0, a.deletions = null), !e && (t = t.sibling, t !== null)) {
            _t = t;
            return;
          }
          _t = t = a;
        } while (t !== null);
        Ut = 6, _t = null;
      }
      function Ju(t, e, a, r, c, d, v, C, q) {
        t.cancelPendingCommit = null;
        do
          rl();
        while (Wt !== 0);
        if ((wt & 6) !== 0) throw Error(s(327));
        if (e !== null) {
          if (e === t.current)
            throw Error(s(177));
          if (d = e.lanes | e.childLanes, d |= Lo, h(
            t,
            a,
            d,
            v,
            C,
            q
          ), t === At && (_t = At = null, kt = 0), Ga = e, On = t, fn = a, Io = d, Po = c, Kd = r, (e.subtreeFlags & 10256) !== 0 || (e.flags & 10256) !== 0 ? (t.callbackNode = null, t.callbackPriority = 0, Ap(Ro, function() {
            return Pu(), null;
          })) : (t.callbackNode = null, t.callbackPriority = 0), r = (e.flags & 13878) !== 0, (e.subtreeFlags & 13878) !== 0 || r) {
            r = dt.T, dt.T = null, c = on(), It(2), v = wt, wt |= 4;
            try {
              _p(t, e, a);
            } finally {
              wt = v, It(c), dt.T = r;
            }
          }
          Wt = 1, Wu(), Fu(), $u();
        }
      }
      function Wu() {
        if (Wt === 1) {
          Wt = 0;
          var t = On, e = Ga, a = (e.flags & 13878) !== 0;
          if ((e.subtreeFlags & 13878) !== 0 || a) {
            a = dt.T, dt.T = null;
            var r = on();
            It(2);
            var c = wt;
            wt |= 4;
            try {
              Mu(e, t), Qp(t.containerInfo);
            } finally {
              wt = c, It(r), dt.T = a;
            }
          }
          t.current = e, Wt = 2;
        }
      }
      function Fu() {
        if (Wt === 2) {
          Wt = 0;
          var t = On, e = Ga, a = (e.flags & 8772) !== 0;
          if ((e.subtreeFlags & 8772) !== 0 || a) {
            a = dt.T, dt.T = null;
            var r = on();
            It(2);
            var c = wt;
            wt |= 4;
            try {
              Eu(t, e.alternate, e);
            } finally {
              wt = c, It(r), dt.T = a;
            }
          }
          Wt = 3;
        }
      }
      function $u() {
        if (Wt === 4 || Wt === 3) {
          Wt = 0, p0();
          var t = On, e = Ga, a = fn, r = Kd;
          (e.subtreeFlags & 10256) !== 0 || (e.flags & 10256) !== 0 ? Wt = 5 : (Wt = 0, Ga = On = null, Iu(t, t.pendingLanes));
          var c = t.pendingLanes;
          if (c === 0 && (jn = null), E(a), e = e.stateNode, ke && typeof ke.onCommitFiberRoot == "function")
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
            e = dt.T, c = on(), It(2), dt.T = null;
            try {
              for (var d = t.onRecoverableError, v = 0; v < r.length; v++) {
                var C = r[v];
                d(C.value, {
                  componentStack: C.stack
                });
              }
            } finally {
              dt.T = e, It(c);
            }
          }
          (fn & 3) !== 0 && rl(), Ve(t), c = t.pendingLanes, (a & 261930) !== 0 && (c & 42) !== 0 ? t === ts ? yl++ : (yl = 0, ts = t) : yl = 0, ue && Ih(), pa(0);
        }
      }
      function Iu(t, e) {
        (t.pooledCacheLanes &= e) === 0 && (e = t.pooledCache, e != null && (t.pooledCache = null, Xa(e)));
      }
      function rl() {
        return Wu(), Fu(), $u(), Pu();
      }
      function Pu() {
        if (Wt !== 5) return !1;
        var t = On, e = Io;
        Io = 0;
        var a = E(fn), r = 32 > a ? 32 : a;
        a = dt.T;
        var c = on();
        try {
          It(r), dt.T = null, r = Po, Po = null;
          var d = On, v = fn;
          if (Wt = 0, Ga = On = null, fn = 0, (wt & 6) !== 0)
            throw Error(s(331));
          var C = wt;
          if (wt |= 4, Ru(d.current), Au(
            d,
            d.current,
            v,
            r
          ), wt = C, pa(0, !1), ke && typeof ke.onPostCommitFiberRoot == "function")
            try {
              ke.onPostCommitFiberRoot(cl, d);
            } catch {
            }
          return !0;
        } finally {
          It(c), dt.T = a, Iu(t, e);
        }
      }
      function td(t, e, a) {
        e = L(a, e), e = Ki(t.stateNode, e, 2), t = yn(t, e, 2), t !== null && (D(t, 2), Ve(t));
      }
      function zt(t, e, a) {
        if (t.tag === 3)
          td(t, t, a);
        else
          for (; e !== null; ) {
            if (e.tag === 3) {
              td(
                e,
                t,
                a
              );
              break;
            } else if (e.tag === 1) {
              var r = e.stateNode;
              if (typeof e.type.getDerivedStateFromError == "function" || typeof r.componentDidCatch == "function" && (jn === null || !jn.has(r))) {
                t = L(a, t), a = Pc(2), r = yn(e, a, 2), r !== null && (tu(
                  a,
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
      function ho(t, e, a) {
        var r = t.pingCache;
        if (r === null) {
          r = t.pingCache = new E0();
          var c = /* @__PURE__ */ new Set();
          r.set(e, c);
        } else
          c = r.get(e), c === void 0 && (c = /* @__PURE__ */ new Set(), r.set(e, c));
        c.has(a) || (Wo = !0, c.add(a), t = Tp.bind(null, t, e, a), e.then(t, t));
      }
      function Tp(t, e, a) {
        var r = t.pingCache;
        r !== null && r.delete(e), t.pingedLanes |= t.suspendedLanes & a, t.warmLanes &= ~a, At === t && (kt & a) === a && (Ut === 4 || Ut === 3 && (kt & 62914560) === kt && 300 > ge() - Or ? (wt & 2) === 0 && ba(t, 0) : Fo |= a, Ua === kt && (Ua = 0)), Ve(t);
      }
      function ed(t, e) {
        e === 0 && (e = Z()), t = Jn(t, e), t !== null && (D(t, e), Ve(t));
      }
      function Mp(t) {
        var e = t.memoizedState, a = 0;
        e !== null && (a = e.retryLane), ed(t, a);
      }
      function Cp(t, e) {
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
        r !== null && r.delete(e), ed(t, a);
      }
      function Ap(t, e) {
        return br(t, e);
      }
      function jp(t, e, a, r) {
        this.tag = t, this.key = a, this.sibling = this.child = this.return = this.stateNode = this.type = this.elementType = null, this.index = 0, this.refCleanup = this.ref = null, this.pendingProps = e, this.dependencies = this.memoizedState = this.updateQueue = this.memoizedProps = null, this.mode = r, this.subtreeFlags = this.flags = 0, this.deletions = null, this.childLanes = this.lanes = 0, this.alternate = null;
      }
      function go(t) {
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
      function nd(t, e) {
        t.flags &= 65011714;
        var a = t.alternate;
        return a === null ? (t.childLanes = 0, t.lanes = e, t.child = null, t.subtreeFlags = 0, t.memoizedProps = null, t.memoizedState = null, t.updateQueue = null, t.dependencies = null, t.stateNode = null) : (t.childLanes = a.childLanes, t.lanes = a.lanes, t.child = a.child, t.subtreeFlags = 0, t.deletions = null, t.memoizedProps = a.memoizedProps, t.memoizedState = a.memoizedState, t.updateQueue = a.updateQueue, t.type = a.type, e = a.dependencies, t.dependencies = e === null ? null : {
          lanes: e.lanes,
          firstContext: e.firstContext
        }), t;
      }
      function ur(t, e, a, r, c, d) {
        var v = 0;
        if (r = t, typeof t == "function") go(t) && (v = 1);
        else if (typeof t == "string")
          v = Ye && Jt ? Ed(t, a, ae.current) ? 26 : Rd(t) ? 27 : 5 : Ye ? Ed(
            t,
            a,
            ae.current
          ) ? 26 : 5 : Jt && Rd(t) ? 27 : 5;
        else
          t: switch (t) {
            case zo:
              return t = i(31, a, e, c), t.elementType = zo, t.lanes = d, t;
            case xa:
              return In(
                a.children,
                c,
                d,
                e
              );
            case cd:
              v = 8, c |= 24;
              break;
            case wo:
              return t = i(12, a, e, c | 2), t.elementType = wo, t.lanes = d, t;
            case ko:
              return t = i(13, a, e, c), t.elementType = ko, t.lanes = d, t;
            case So:
              return t = i(19, a, e, c), t.elementType = So, t.lanes = d, t;
            default:
              if (typeof t == "object" && t !== null)
                switch (t.$$typeof) {
                  case Sn:
                    v = 10;
                    break t;
                  case ud:
                    v = 9;
                    break t;
                  case _o:
                    v = 11;
                    break t;
                  case Eo:
                    v = 14;
                    break t;
                  case En:
                    v = 16, r = null;
                    break t;
                }
              v = 29, a = Error(
                s(
                  130,
                  t === null ? "null" : typeof t,
                  ""
                )
              ), r = null;
          }
        return e = i(v, a, e, c), e.elementType = t, e.type = r, e.lanes = d, e;
      }
      function In(t, e, a, r) {
        return t = i(7, t, r, e), t.lanes = a, t;
      }
      function bo(t, e, a) {
        return t = i(6, t, null, e), t.lanes = a, t;
      }
      function ad(t) {
        var e = i(18, null, null, 0);
        return e.stateNode = t, e;
      }
      function vo(t, e, a) {
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
      function Op(t, e, a, r, c, d, v, C, q) {
        this.tag = 1, this.containerInfo = t, this.pingCache = this.current = this.pendingChildren = null, this.timeoutHandle = Pn, this.callbackNode = this.next = this.pendingContext = this.context = this.cancelPendingCommit = null, this.callbackPriority = 0, this.expirationTimes = F(-1), this.entangledLanes = this.shellSuspendCounter = this.errorRecoveryDisabledLanes = this.expiredLanes = this.warmLanes = this.pingedLanes = this.suspendedLanes = this.pendingLanes = 0, this.entanglements = F(0), this.hiddenUpdates = F(null), this.identifierPrefix = r, this.onUncaughtError = c, this.onCaughtError = d, this.onRecoverableError = v, this.pooledCache = null, this.pooledCacheLanes = 0, this.formState = q, this.incompleteTransitions = /* @__PURE__ */ new Map();
      }
      function ld(t, e, a, r, c, d, v, C, q, $, nt, P) {
        return t = new Op(
          t,
          e,
          a,
          v,
          q,
          $,
          nt,
          P,
          C
        ), e = 1, d === !0 && (e |= 24), d = i(3, null, null, e), t.current = d, d.stateNode = t, e = yi(), e.refCount++, t.pooledCache = e, e.refCount++, d.memoizedState = {
          element: r,
          isDehydrated: a,
          cache: e
        }, ki(d), t;
      }
      function rd(t) {
        return t ? (t = Sa, t) : Sa;
      }
      function id(t) {
        var e = t._reactInternals;
        if (e === void 0)
          throw typeof t.render == "function" ? Error(s(188)) : (t = Object.keys(t).join(","), Error(s(268, t)));
        return t = f(e), t = t !== null ? p(t) : null, t === null ? null : il(t.stateNode);
      }
      function od(t, e, a, r, c, d) {
        c = rd(c), r.context === null ? r.context = c : r.pendingContext = c, r = vn(e), r.payload = { element: a }, d = d === void 0 ? null : d, d !== null && (r.callback = d), a = yn(t, r, e), a !== null && (he(a, t, e), Ja(a, t, e));
      }
      function sd(t, e) {
        if (t = t.memoizedState, t !== null && t.dehydrated !== null) {
          var a = t.retryLane;
          t.retryLane = a !== 0 && a < e ? a : e;
        }
      }
      function yo(t, e) {
        sd(t, e), (t = t.alternate) && sd(t, e);
      }
      var xt = {}, Rp = tg, we = ng(), xo = Object.assign, Dp = Symbol.for("react.element"), dr = Symbol.for("react.transitional.element"), ya = Symbol.for("react.portal"), xa = Symbol.for("react.fragment"), cd = Symbol.for("react.strict_mode"), wo = Symbol.for("react.profiler"), ud = Symbol.for("react.consumer"), Sn = Symbol.for("react.context"), _o = Symbol.for("react.forward_ref"), ko = Symbol.for("react.suspense"), So = Symbol.for("react.suspense_list"), Eo = Symbol.for("react.memo"), En = Symbol.for("react.lazy"), zo = Symbol.for("react.activity"), Hp = Symbol.for("react.memo_cache_sentinel"), dd = Symbol.iterator, Bp = Symbol.for("react.client.reference"), fr = Array.isArray, dt = Rp.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE, Up = l.rendererVersion, Gp = l.rendererPackageName, fd = l.extraDevToolsConfig, il = l.getPublicInstance, Yp = l.getRootHostContext, qp = l.getChildHostContext, Lp = l.prepareForCommit, Qp = l.resetAfterCommit, Vp = l.createInstance;
      l.cloneMutableInstance;
      var No = l.appendInitialChild, md = l.finalizeInitialChildren, mr = l.shouldSetTextContent, pd = l.createTextInstance;
      l.cloneMutableTextInstance;
      var Kp = l.scheduleTimeout, Xp = l.cancelTimeout, Pn = l.noTimeout, rn = l.isPrimaryRenderer;
      l.warnsIfNotActing;
      var ce = l.supportsMutation, Xe = l.supportsPersistence, ue = l.supportsHydration, Zp = l.getInstanceFromNode;
      l.beforeActiveInstanceBlur;
      var Jp = l.preparePortalMount;
      l.prepareScopeUpdate, l.getInstanceFromScope;
      var It = l.setCurrentUpdatePriority, on = l.getCurrentUpdatePriority, Wp = l.resolveUpdatePriority;
      l.trackSchedulerEvent, l.resolveEventType, l.resolveEventTimeStamp;
      var Fp = l.shouldAttemptEagerTransition, $p = l.detachDeletedInstance;
      l.requestPostPaintCallback;
      var Ip = l.maySuspendCommit, Pp = l.maySuspendCommitOnUpdate, To = l.maySuspendCommitInSyncRender, hd = l.preloadInstance, th = l.startSuspendingCommit, gd = l.suspendInstance;
      l.suspendOnActiveViewTransition;
      var eh = l.waitForCommitToBeReady;
      l.getSuspendedCommitReason;
      var wa = l.NotPendingTransition, ta = l.HostTransitionContext, nh = l.resetFormInstance;
      l.bindToConsole;
      var ah = l.supportsMicrotasks, lh = l.scheduleMicrotask, ol = l.supportsTestSelectors, rh = l.findFiberRoot, ih = l.getBoundingRect, oh = l.getTextContent, sl = l.isHiddenSubtree, sh = l.matchAccessibilityRole, ch = l.setFocusIfFocusable, uh = l.setupIntersectionObserver, dh = l.appendChild, fh = l.appendChildToContainer, mh = l.commitTextUpdate, ph = l.commitMount, hh = l.commitUpdate, gh = l.insertBefore, bh = l.insertInContainerBefore, vh = l.removeChild, yh = l.removeChildFromContainer, bd = l.resetTextContent, xh = l.hideInstance, wh = l.hideTextInstance, _h = l.unhideInstance, kh = l.unhideTextInstance;
      l.cancelViewTransitionName, l.cancelRootViewTransitionName, l.restoreRootViewTransitionName, l.cloneRootViewTransitionContainer, l.removeRootViewTransitionClone, l.measureClonedInstance, l.hasInstanceChanged, l.hasInstanceAffectedParent, l.startViewTransition, l.startGestureTransition, l.stopViewTransition, l.getCurrentGestureOffset, l.createViewTransitionInstance;
      var Sh = l.clearContainer;
      l.createFragmentInstance, l.updateFragmentInstanceFiber, l.commitNewChildToFragmentInstance, l.deleteChildFromFragmentInstance;
      var Eh = l.cloneInstance, vd = l.createContainerChildSet, yd = l.appendChildToContainerChildSet, zh = l.finalizeContainerChildren, xd = l.replaceContainerChildren, wd = l.cloneHiddenInstance, _d = l.cloneHiddenTextInstance, Mo = l.isSuspenseInstancePending, Co = l.isSuspenseInstanceFallback, Nh = l.getSuspenseInstanceFallbackErrorDetails, Th = l.registerSuspenseInstanceRetry, Mh = l.canHydrateFormStateMarker, Ch = l.isFormStateMarkerMatching, kd = l.getNextHydratableSibling, Ah = l.getNextHydratableSiblingAfterSingleton, jh = l.getFirstHydratableChild, Oh = l.getFirstHydratableChildWithinContainer, Rh = l.getFirstHydratableChildWithinActivityInstance, Dh = l.getFirstHydratableChildWithinSuspenseInstance, Hh = l.getFirstHydratableChildWithinSingleton, Bh = l.canHydrateInstance, Uh = l.canHydrateTextInstance, Gh = l.canHydrateActivityInstance, Yh = l.canHydrateSuspenseInstance, qh = l.hydrateInstance, Lh = l.hydrateTextInstance, Qh = l.hydrateActivityInstance, Vh = l.hydrateSuspenseInstance, Kh = l.getNextHydratableInstanceAfterActivityInstance, Xh = l.getNextHydratableInstanceAfterSuspenseInstance, Zh = l.commitHydratedInstance, Jh = l.commitHydratedContainer, Wh = l.commitHydratedActivityInstance, Fh = l.commitHydratedSuspenseInstance, $h = l.finalizeHydratedChildren, Ih = l.flushHydrationEvents;
      l.clearActivityBoundary;
      var Ph = l.clearSuspenseBoundary;
      l.clearActivityBoundaryFromContainer;
      var t0 = l.clearSuspenseBoundaryFromContainer, e0 = l.hideDehydratedBoundary, n0 = l.unhideDehydratedBoundary, Sd = l.shouldDeleteUnhydratedTailInstances;
      l.diffHydratedPropsForDevWarnings, l.diffHydratedTextForDevWarnings, l.describeHydratableInstanceForDevWarnings;
      var a0 = l.validateHydratableInstance, l0 = l.validateHydratableTextInstance, Ye = l.supportsResources, Ed = l.isHostHoistableType, Ao = l.getHoistableRoot, zd = l.getResource, Nd = l.acquireResource, Td = l.releaseResource, r0 = l.hydrateHoistable, Md = l.mountHoistable, Cd = l.unmountHoistable, i0 = l.createHoistableInstance, o0 = l.prepareToCommitHoistables, s0 = l.mayResourceSuspendCommit, Ad = l.preloadResource, c0 = l.suspendResource, Jt = l.supportsSingletons, jd = l.resolveSingletonInstance, u0 = l.acquireSingletonInstance, Od = l.releaseSingletonInstance, Rd = l.isHostSingletonType, _a = l.isSingletonScope, jo = [], ka = -1, Sa = {}, _e = Math.clz32 ? Math.clz32 : j, d0 = Math.log, f0 = Math.LN2, pr = 256, hr = 262144, gr = 4194304, br = we.unstable_scheduleCallback, Oo = we.unstable_cancelCallback, m0 = we.unstable_shouldYield, p0 = we.unstable_requestPaint, ge = we.unstable_now, Dd = we.unstable_ImmediatePriority, h0 = we.unstable_UserBlockingPriority, Ro = we.unstable_NormalPriority, g0 = we.unstable_IdlePriority, b0 = we.log, v0 = we.unstable_setDisableYieldValue, cl = null, ke = null, Se = typeof Object.is == "function" ? Object.is : Q, Hd = typeof reportError == "function" ? reportError : function(t) {
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
      }, y0 = Object.prototype.hasOwnProperty, Do, Bd, Ho = !1, Ud = /* @__PURE__ */ new WeakMap(), Ea = [], za = 0, vr = null, ul = 0, Me = [], Ce = 0, zn = null, Ze = 1, Je = "", ae = y(null), dl = y(null), Nn = y(null), yr = y(null), le = null, Rt = null, St = !1, Tn = null, Ae = !1, Bo = Error(s(519)), xr = y(null), ea = null, sn = null, x0 = typeof AbortController < "u" ? AbortController : function() {
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
      }, w0 = we.unstable_scheduleCallback, _0 = we.unstable_NormalPriority, Dt = {
        $$typeof: Sn,
        Consumer: null,
        Provider: null,
        _currentValue: null,
        _currentValue2: null,
        _threadCount: 0
      }, wr = null, Na = null, Uo = !1, _r = !1, Go = !1, na = 0, fl = null, Yo = 0, Ta = 0, Ma = null, Gd = dt.S;
      dt.S = function(t, e) {
        Vd = ge(), typeof e == "object" && e !== null && typeof e.then == "function" && cp(t, e), Gd !== null && Gd(t, e);
      };
      var aa = y(null), Ca = Error(s(460)), qo = Error(s(474)), kr = Error(s(542)), Sr = { then: function() {
      } }, la = null, Aa = null, ml = 0, ra = cc(!0), Yd = cc(!1), je = [], ja = 0, Lo = 0, Mn = !1, Qo = !1, Oa = y(null), Er = y(0), Ee = y(null), Oe = null, Yt = y(0), cn = 0, bt = null, Ct = null, Lt = null, zr = !1, Ra = !1, ia = !1, Nr = 0, pl = 0, Da = null, k0 = 0, hl = {
        readContext: ee,
        use: Jl,
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
      hl.useEffectEvent = Bt;
      var qd = {
        readContext: ee,
        use: Jl,
        useCallback: function(t, e) {
          return fe().memoizedState = [
            t,
            e === void 0 ? null : e
          ], t;
        },
        useContext: ee,
        useEffect: Rc,
        useImperativeHandle: function(t, e, a) {
          a = a != null ? a.concat([t]) : null, Fl(
            4194308,
            4,
            Uc.bind(null, e, t),
            a
          );
        },
        useLayoutEffect: function(t, e) {
          return Fl(4194308, 4, t, e);
        },
        useInsertionEffect: function(t, e) {
          Fl(4, 2, t, e);
        },
        useMemo: function(t, e) {
          var a = fe();
          e = e === void 0 ? null : e;
          var r = t();
          if (ia) {
            O(!0);
            try {
              t();
            } finally {
              O(!1);
            }
          }
          return a.memoizedState = [r, e], r;
        },
        useReducer: function(t, e, a) {
          var r = fe();
          if (a !== void 0) {
            var c = a(e);
            if (ia) {
              O(!0);
              try {
                a(e);
              } finally {
                O(!1);
              }
            }
          } else c = e;
          return r.memoizedState = r.baseState = c, t = {
            pending: null,
            lanes: 0,
            dispatch: null,
            lastRenderedReducer: t,
            lastRenderedState: c
          }, r.queue = t, t = t.dispatch = gp.bind(
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
          t = Bi(t);
          var e = t.queue, a = Zc.bind(
            null,
            bt,
            e
          );
          return e.dispatch = a, [t.memoizedState, a];
        },
        useDebugValue: Yi,
        useDeferredValue: function(t, e) {
          var a = fe();
          return qi(a, t, e);
        },
        useTransition: function() {
          var t = Bi(!1);
          return t = Qc.bind(
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
            (kt & 127) !== 0 || vc(r, e, a);
          }
          c.memoizedState = a;
          var d = { value: a, getSnapshot: e };
          return c.queue = d, Rc(xc.bind(null, r, d, t), [
            t
          ]), r.flags |= 2048, ha(
            9,
            { destroy: void 0 },
            yc.bind(
              null,
              r,
              d,
              a,
              e
            ),
            null
          ), a;
        },
        useId: function() {
          var t = fe(), e = At.identifierPrefix;
          if (St) {
            var a = Je, r = Ze;
            a = (r & ~(1 << 32 - _e(r) - 1)).toString(32) + a, e = "_" + e + "R_" + a, a = Nr++, 0 < a && (e += "H" + a.toString(32)), e += "_";
          } else
            a = k0++, e = "_" + e + "r_" + a.toString(32) + "_";
          return t.memoizedState = e;
        },
        useHostTransitionStatus: Li,
        useFormState: Mc,
        useActionState: Mc,
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
          return e.queue = a, e = Qi.bind(
            null,
            bt,
            !0,
            a
          ), a.dispatch = e, [t, e];
        },
        useMemoCache: Ri,
        useCacheRefresh: function() {
          return fe().memoizedState = hp.bind(
            null,
            bt
          );
        },
        useEffectEvent: function(t) {
          var e = fe(), a = { impl: t };
          return e.memoizedState = a, function() {
            if ((wt & 2) !== 0)
              throw Error(s(440));
            return a.impl.apply(void 0, arguments);
          };
        }
      }, Vo = {
        readContext: ee,
        use: Jl,
        useCallback: Yc,
        useContext: ee,
        useEffect: Gi,
        useImperativeHandle: Gc,
        useInsertionEffect: Hc,
        useLayoutEffect: Bc,
        useMemo: qc,
        useReducer: Wl,
        useRef: Oc,
        useState: function() {
          return Wl(tn);
        },
        useDebugValue: Yi,
        useDeferredValue: function(t, e) {
          var a = Gt();
          return Lc(
            a,
            Ct.memoizedState,
            t,
            e
          );
        },
        useTransition: function() {
          var t = Wl(tn)[0], e = Gt().memoizedState;
          return [
            typeof t == "boolean" ? t : $a(t),
            e
          ];
        },
        useSyncExternalStore: bc,
        useId: Kc,
        useHostTransitionStatus: Li,
        useFormState: Cc,
        useActionState: Cc,
        useOptimistic: function(t, e) {
          var a = Gt();
          return kc(a, Ct, t, e);
        },
        useMemoCache: Ri,
        useCacheRefresh: Xc
      };
      Vo.useEffectEvent = Dc;
      var Ld = {
        readContext: ee,
        use: Jl,
        useCallback: Yc,
        useContext: ee,
        useEffect: Gi,
        useImperativeHandle: Gc,
        useInsertionEffect: Hc,
        useLayoutEffect: Bc,
        useMemo: qc,
        useReducer: Hi,
        useRef: Oc,
        useState: function() {
          return Hi(tn);
        },
        useDebugValue: Yi,
        useDeferredValue: function(t, e) {
          var a = Gt();
          return Ct === null ? qi(a, t, e) : Lc(
            a,
            Ct.memoizedState,
            t,
            e
          );
        },
        useTransition: function() {
          var t = Hi(tn)[0], e = Gt().memoizedState;
          return [
            typeof t == "boolean" ? t : $a(t),
            e
          ];
        },
        useSyncExternalStore: bc,
        useId: Kc,
        useHostTransitionStatus: Li,
        useFormState: jc,
        useActionState: jc,
        useOptimistic: function(t, e) {
          var a = Gt();
          return Ct !== null ? kc(a, Ct, t, e) : (a.baseState = t, [t, a.queue.dispatch]);
        },
        useMemoCache: Ri,
        useCacheRefresh: Xc
      };
      Ld.useEffectEvent = Dc;
      var Ko = {
        enqueueSetState: function(t, e, a) {
          t = t._reactInternals;
          var r = xe(), c = vn(r);
          c.payload = e, a != null && (c.callback = a), e = yn(t, c, r), e !== null && (he(e, t, r), Ja(e, t, r));
        },
        enqueueReplaceState: function(t, e, a) {
          t = t._reactInternals;
          var r = xe(), c = vn(r);
          c.tag = 1, c.payload = e, a != null && (c.callback = a), e = yn(t, c, r), e !== null && (he(e, t, r), Ja(e, t, r));
        },
        enqueueForceUpdate: function(t, e) {
          t = t._reactInternals;
          var a = xe(), r = vn(a);
          r.tag = 2, e != null && (r.callback = e), e = yn(t, r, a), e !== null && (he(e, t, a), Ja(e, t, a));
        }
      }, Xo = Error(s(461)), Qt = !1, Zo = {
        dehydrated: null,
        treeContext: null,
        retryLane: 0,
        hydrationErrors: null
      }, un = !1, Vt = !1, Jo = !1, Qd = typeof WeakSet == "function" ? WeakSet : Set, Pt = null, Kt = null, be = !1, qe = null, Ha = 8192, S0 = {
        getCacheForType: function(t) {
          var e = ee(Dt), a = e.data.get(t);
          return a === void 0 && (a = t(), e.data.set(t, a)), a;
        },
        cacheSignal: function() {
          return ee(Dt).controller.signal;
        }
      }, Tr = 0, Mr = 1, Cr = 2, Ar = 3, jr = 4;
      if (typeof Symbol == "function" && Symbol.for) {
        var gl = Symbol.for;
        Tr = gl("selector.component"), Mr = gl("selector.has_pseudo_class"), Cr = gl("selector.role"), Ar = gl("selector.test_id"), jr = gl("selector.text");
      }
      var E0 = typeof WeakMap == "function" ? WeakMap : Map, wt = 0, At = null, _t = null, kt = 0, Mt = 0, ze = null, Cn = !1, Ba = !1, Wo = !1, dn = 0, Ut = 0, An = 0, oa = 0, Fo = 0, Ne = 0, Ua = 0, bl = null, ve = null, $o = !1, Or = 0, Vd = 0, vl = 1 / 0, Rr = null, jn = null, Wt = 0, On = null, Ga = null, fn = 0, Io = 0, Po = null, Kd = null, yl = 0, ts = null;
      return xt.attemptContinuousHydration = function(t) {
        if (t.tag === 13 || t.tag === 31) {
          var e = Jn(t, 67108864);
          e !== null && he(e, t, 67108864), yo(t, 67108864);
        }
      }, xt.attemptHydrationAtCurrentPriority = function(t) {
        if (t.tag === 13 || t.tag === 31) {
          var e = xe();
          e = N(e);
          var a = Jn(t, e);
          a !== null && he(a, t, e), yo(t, e);
        }
      }, xt.attemptSynchronousHydration = function(t) {
        switch (t.tag) {
          case 3:
            if (t = t.stateNode, t.current.memoizedState.isDehydrated) {
              var e = T(t.pendingLanes);
              if (e !== 0) {
                for (t.pendingLanes |= 2, t.entangledLanes |= 2; e; ) {
                  var a = 1 << 31 - _e(e);
                  t.entanglements[1] |= a, e &= ~a;
                }
                Ve(t), (wt & 6) === 0 && (vl = ge() + 500, pa(0));
              }
            }
            break;
          case 31:
          case 13:
            e = Jn(t, 2), e !== null && he(e, t, 2), Yu(), yo(t, 2);
        }
      }, xt.batchedUpdates = function(t, e) {
        return t(e);
      }, xt.createComponentSelector = function(t) {
        return { $$typeof: Tr, value: t };
      }, xt.createContainer = function(t, e, a, r, c, d, v, C, q, $) {
        return ld(
          t,
          e,
          !1,
          null,
          a,
          r,
          d,
          null,
          v,
          C,
          q,
          $
        );
      }, xt.createHasPseudoClassSelector = function(t) {
        return { $$typeof: Mr, value: t };
      }, xt.createHydrationContainer = function(t, e, a, r, c, d, v, C, q, $, nt, P, lt, gt) {
        return t = ld(
          a,
          r,
          !0,
          t,
          c,
          d,
          C,
          gt,
          q,
          $,
          nt,
          P
        ), t.context = rd(null), a = t.current, r = xe(), r = N(r), c = vn(r), c.callback = e ?? null, yn(a, c, r), e = r, t.current.lanes = e, D(t, e), Ve(t), t;
      }, xt.createPortal = function(t, e, a) {
        var r = 3 < arguments.length && arguments[3] !== void 0 ? arguments[3] : null;
        return {
          $$typeof: ya,
          key: r == null ? null : "" + r,
          children: t,
          containerInfo: e,
          implementation: a
        };
      }, xt.createRoleSelector = function(t) {
        return { $$typeof: Cr, value: t };
      }, xt.createTestNameSelector = function(t) {
        return { $$typeof: Ar, value: t };
      }, xt.createTextSelector = function(t) {
        return { $$typeof: jr, value: t };
      }, xt.defaultOnCaughtError = function(t) {
        console.error(t);
      }, xt.defaultOnRecoverableError = function(t) {
        Hd(t);
      }, xt.defaultOnUncaughtError = function(t) {
        Hd(t);
      }, xt.deferredUpdates = function(t) {
        var e = dt.T, a = on();
        try {
          return It(32), dt.T = null, t();
        } finally {
          It(a), dt.T = e;
        }
      }, xt.discreteUpdates = function(t, e, a, r, c) {
        var d = dt.T, v = on();
        try {
          return It(2), dt.T = null, t(e, a, r, c);
        } finally {
          It(v), dt.T = d, wt === 0 && (vl = ge() + 500);
        }
      }, xt.findAllNodes = fo, xt.findBoundingRects = function(t, e) {
        if (!ol) throw Error(s(363));
        e = fo(t, e), t = [];
        for (var a = 0; a < e.length; a++)
          t.push(ih(e[a]));
        for (e = t.length - 1; 0 < e; e--) {
          a = t[e];
          for (var r = a.x, c = r + a.width, d = a.y, v = d + a.height, C = e - 1; 0 <= C; C--)
            if (e !== C) {
              var q = t[C], $ = q.x, nt = $ + q.width, P = q.y, lt = P + q.height;
              if (r >= $ && d >= P && c <= nt && v <= lt) {
                t.splice(e, 1);
                break;
              } else if (r !== $ || a.width !== q.width || lt < d || P > v) {
                if (!(d !== P || a.height !== q.height || nt < r || $ > c)) {
                  $ > r && (q.width += $ - r, q.x = r), nt < c && (q.width = c - $), t.splice(e, 1);
                  break;
                }
              } else {
                P > d && (q.height += P - d, q.y = d), lt < v && (q.height = v - P), t.splice(e, 1);
                break;
              }
            }
        }
        return t;
      }, xt.findHostInstance = id, xt.findHostInstanceWithNoPortals = function(t) {
        return t = f(t), t = t !== null ? x(t) : null, t === null ? null : il(t.stateNode);
      }, xt.findHostInstanceWithWarning = function(t) {
        return id(t);
      }, xt.flushPassiveEffects = rl, xt.flushSyncFromReconciler = function(t) {
        var e = wt;
        wt |= 1;
        var a = dt.T, r = on();
        try {
          if (It(2), dt.T = null, t)
            return t();
        } finally {
          It(r), dt.T = a, wt = e, (wt & 6) === 0 && pa(0);
        }
      }, xt.flushSyncWork = Yu, xt.focusWithin = function(t, e) {
        if (!ol) throw Error(s(363));
        for (t = so(t), e = Hu(t, e), e = Array.from(e), t = 0; t < e.length; ) {
          var a = e[t++], r = a.tag;
          if (!sl(a)) {
            if ((r === 5 || r === 26 || r === 27) && ch(a.stateNode))
              return !0;
            for (a = a.child; a !== null; )
              e.push(a), a = a.sibling;
          }
        }
        return !1;
      }, xt.getFindAllNodesFailureDescription = function(t, e) {
        if (!ol) throw Error(s(363));
        var a = 0, r = [];
        t = [so(t), 0];
        for (var c = 0; c < t.length; ) {
          var d = t[c++], v = d.tag, C = t[c++], q = e[C];
          if ((v !== 5 && v !== 26 && v !== 27 || !sl(d)) && (co(d, q) && (r.push(uo(q)), C++, C > a && (a = C)), C < e.length))
            for (d = d.child; d !== null; )
              t.push(d, C), d = d.sibling;
        }
        if (a < e.length) {
          for (t = []; a < e.length; a++)
            t.push(uo(e[a]));
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
          version: Up,
          rendererPackageName: Gp,
          currentDispatcherRef: dt,
          reconcilerVersion: "19.2.0"
        };
        if (fd !== null && (t.rendererConfig = fd), typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ > "u") t = !1;
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
      }, xt.observeVisibleRects = function(t, e, a, r) {
        if (!ol) throw Error(s(363));
        t = fo(t, e);
        var c = uh(
          t,
          a,
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
      }, xt.startHostTransition = function(t, e, a, r) {
        if (t.tag !== 5) throw Error(s(476));
        var c = Vc(t).queue;
        Qc(
          t,
          c,
          e,
          wa,
          a === null ? o : function() {
            var d = Vc(t);
            return d.next === null && (d = t.alternate.memoizedState), Ia(
              t,
              d.next.queue,
              {},
              xe()
            ), a(r);
          }
        );
      }, xt.updateContainer = function(t, e, a, r) {
        var c = e.current, d = xe();
        return od(
          c,
          d,
          t,
          e,
          a,
          r
        ), d;
      }, xt.updateContainerSync = function(t, e, a, r) {
        return od(
          e.current,
          2,
          t,
          e,
          a,
          r
        ), 2;
      }, xt;
    }, n.exports.default = n.exports, Object.defineProperty(n.exports, "__esModule", { value: !0 });
  })(ls)), ls.exports;
}
var lf;
function lg() {
  return lf || (lf = 1, as.exports = ag()), as.exports;
}
var rg = lg();
const nm = /* @__PURE__ */ Ys(rg);
var os = { exports: {} }, mn = {};
/**
 * @license React
 * react-reconciler-constants.production.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var rf;
function ig() {
  return rf || (rf = 1, mn.ConcurrentRoot = 1, mn.ContinuousEventPriority = 8, mn.DefaultEventPriority = 32, mn.DiscreteEventPriority = 2, mn.IdleEventPriority = 268435456, mn.LegacyRoot = 0, mn.NoEventPriority = 0), mn;
}
var of;
function og() {
  return of || (of = 1, os.exports = ig()), os.exports;
}
var Qa = og();
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
const am = ["accent", "panel-bg", "surface-0", "surface-1", "surface-dim", "overlay-0", "overlay-1", "text", "subtext-0", "mauve", "green", "yellow", "red", "blue", "teal", "peach", "backdrop", "card-bg"], xs = 16, mi = /* @__PURE__ */ new Set(["hover", "focus", "focus-visible", "focus-within", "active"]), sg = [
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
], sf = {
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
}, cg = /* @__PURE__ */ new Set([
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
]), lm = {
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
}, rm = {
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
}, ws = ["font-size", "color", ...new Set([...Object.keys(lm), ...Object.keys(rm)].filter((n) => n !== "font-size" && n !== "color"))], ug = new Set(ws);
function oe(n, l = " ") {
  const i = [];
  let o = 0, s = "";
  for (let u = 0; u < n.length; u++) {
    const m = n[u];
    if (m === "(" ? o++ : m === ")" && o--, o === 0 && (l === " " ? /\s/.test(m) : m === l)) {
      (s.trim() || l !== " ") && i.push(s.trim()), s = "";
      continue;
    }
    s += m;
  }
  return (s.trim() || l !== " " && i.length) && i.push(s.trim()), i;
}
function _s(n, l, i = 0) {
  if (i > 32) return null;
  let o = "", s = 0;
  for (; ; ) {
    const u = n.indexOf("var(", s);
    if (u < 0)
      return o += n.slice(s), o;
    o += n.slice(s, u);
    let m = 1, f = u + 4;
    for (; f < n.length && m; f++)
      n[f] === "(" ? m++ : n[f] === ")" && m--;
    const p = n.slice(u + 4, f - 1), x = oe(p, ","), _ = x[0].trim(), k = x.length > 1 ? p.slice(p.indexOf(",") + 1).trim() : null;
    let y = l(_);
    if ((y == null || y === "initial") && (y = k), y == null) return null;
    const S = _s(y, l, i + 1);
    if (S === null) return null;
    o += S, s = f;
  }
}
function dg(n) {
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
  const i = dg(n.trim().replace(/env\(\s*safe-area-inset-(?:top|right|bottom|left)\s*(?:,[^()]*)?\)/gi, "0px"));
  if (!i) return null;
  let o = 0;
  const s = ({ num: y, unit: S }) => {
    switch (S) {
      case "":
        return { px: 0, pct: 0, num: y, unitless: !0 };
      case "px":
        return { px: y, pct: 0, num: 0 };
      case "rem":
        return { px: y * xs, pct: 0, num: 0 };
      case "em":
        return { px: y * (l.fontSize ?? xs), pct: 0, num: 0 };
      case "%":
        return { px: 0, pct: y, num: 0 };
      case "vh":
      case "dvh":
      case "svh":
      case "lvh":
        return { px: y / 100 * (l.viewport?.height ?? 800), pct: 0, num: 0 };
      case "vw":
      case "dvw":
      case "svw":
      case "lvw":
        return { px: y / 100 * (l.viewport?.width ?? 1e3), pct: 0, num: 0 };
      case "pt":
        return { px: y * (4 / 3), pct: 0, num: 0 };
      default:
        return null;
    }
  }, u = (y, S, z) => y && S ? { px: y.px + z * S.px, pct: y.pct + z * S.pct, num: y.num + z * S.num, unitless: y.unitless && S.unitless } : null, m = (y, S) => y ? { px: y.px * S, pct: y.pct * S, num: y.num * S, unitless: y.unitless } : null, f = (y) => y && y.unitless;
  function p() {
    const y = i[o++];
    if (!y) return null;
    if (y.num !== void 0) return s(y);
    if (y.op === "(") {
      const S = _();
      return i[o]?.op !== ")" ? null : (o++, S);
    }
    if (y.op === "-" || y.op === "+") {
      const S = p();
      return y.op === "-" ? m(S, -1) : S;
    }
    if (y.fn) {
      const S = [];
      for (; ; ) {
        S.push(_());
        const T = i[o++];
        if (!T) return null;
        if (T.op === ")") break;
        if (T.op !== ",") return null;
      }
      if (S.some((T) => !T)) return null;
      if (y.fn === "calc") return S[0];
      if (!(S.every((T) => !T.pct) || S.every((T) => !T.px && !T.num))) return null;
      const j = (T) => T.px + T.pct + T.num;
      return y.fn === "min" ? S.reduce((T, A) => j(A) < j(T) ? A : T) : y.fn === "max" ? S.reduce((T, A) => j(A) > j(T) ? A : T) : y.fn === "clamp" && S.length === 3 ? j(S[1]) < j(S[0]) ? S[0] : j(S[1]) > j(S[2]) ? S[2] : S[1] : null;
    }
    return null;
  }
  function x() {
    let y = p();
    for (; i[o] && (i[o].op === "*" || i[o].op === "/"); ) {
      const S = i[o++].op, z = p();
      if (!y || !z) return null;
      S === "*" ? y = f(z) ? m(y, z.num) : f(y) ? m(z, y.num) : null : y = f(z) && z.num !== 0 ? m(y, 1 / z.num) : null;
    }
    return y;
  }
  function _() {
    let y = x();
    for (; i[o] && (i[o].op === "+" || i[o].op === "-"); ) {
      const S = i[o++].op;
      y = u(y, x(), S === "-" ? -1 : 1);
    }
    return y;
  }
  const k = _();
  return o !== i.length || !k ? null : k;
}
function ks(n, l) {
  const i = n.trim().toLowerCase();
  if (/^(auto|none|normal|fit-content|max-content|min-content|medium|thin|thick)$/.test(i))
    return i === "thin" ? { px: 1 } : i === "medium" ? { px: 3 } : i === "thick" ? { px: 5 } : i;
  const o = qn(i, l);
  return o ? o.unitless ? o.num === 0 ? { px: 0 } : { expr: n.trim() } : o.pct && (o.px || o.num) ? { expr: n.trim() } : o.pct ? { pct: o.pct } : { px: fg(o.px) } : { expr: n.trim() };
}
const fg = (n) => Number.isFinite(n) ? n : n > 0 ? 34e37 : -34e37, Hr = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0"), mg = ([n, l, i, o]) => `#${Hr(n)}${Hr(l)}${Hr(i)}${Hr(o * 255)}`;
function cf(n) {
  const l = n.slice(1), i = l.length <= 4 ? l.split("").map((s) => s + s).join("") : l;
  if (!/^[0-9a-f]{6}([0-9a-f]{2})?$/i.test(i)) return null;
  const o = (s) => parseInt(i.slice(s, s + 2), 16);
  return [o(0), o(2), o(4), i.length === 8 ? o(6) / 255 : 1];
}
function Pr(n, l) {
  const i = n.trim().toLowerCase();
  if (i === "currentcolor") return "currentcolor";
  const o = /^perchtoken\(([a-z0-9-]+)\)$/.exec(i);
  if (o) {
    const x = l(o[1]), _ = x && cf(x);
    return _ ? { rgba: _, token: o[1] } : null;
  }
  if (i.startsWith("#")) {
    const x = cf(i);
    return x ? { rgba: x, token: null } : null;
  }
  if (sf[i]) return { rgba: [...sf[i]], token: null };
  const s = /^(rgba?|color-mix)\((.*)\)$/s.exec(i);
  if (!s) return null;
  if (s[1] === "color-mix") {
    const x = oe(s[2], ",");
    if (x.length !== 3 || !/^in\s+(srgb|srgb-linear|oklab|lab|oklch|lch|hsl|xyz)/.test(x[0])) return null;
    const _ = (O) => {
      const Q = oe(O), W = Q.findIndex((I) => /%$/.test(I)), U = W >= 0 ? parseFloat(Q[W]) / 100 : null;
      return { color: Pr(Q.filter((I, L) => L !== W).join(" "), l), pct: U };
    }, k = _(x[1]), y = _(x[2]);
    if (!k.color || !y.color || k.color === "currentcolor" || y.color === "currentcolor") return null;
    let S = k.pct, z = y.pct;
    S === null && z === null ? (S = 0.5, z = 0.5) : S === null ? S = 1 - z : z === null && (z = 1 - S);
    const j = S + z, T = j < 1 ? j : 1;
    S /= j, z /= j;
    const [A, R, B, Z] = k.color.rgba, [F, D, h, b] = y.color.rgba, g = Z * S + b * z, w = (O, Q) => g === 0 ? 0 : (O * Z * S + Q * b * z) / g, N = [w(A, F), w(R, D), w(B, h), g * T], E = b === 0 ? k.color.token : Z === 0 ? y.color.token : null;
    return { rgba: N, token: E };
  }
  const u = s[2].includes(",") ? oe(s[2], ",") : oe(s[2].replace("/", " / ")).filter((x) => x !== "/");
  if (u.length < 3) return null;
  const m = (x) => x.endsWith("%") ? parseFloat(x) / 100 * 255 : parseFloat(x), f = u[3] === void 0 ? 1 : u[3].endsWith("%") ? parseFloat(u[3]) / 100 : parseFloat(u[3]), p = [m(u[0]), m(u[1]), m(u[2]), f];
  return p.some((x) => Number.isNaN(x)) ? null : { rgba: p, token: null };
}
const El = ["top", "right", "bottom", "left"], pg = ["top-left", "top-right", "bottom-right", "bottom-left"], Br = (n) => [n[0], n[1] ?? n[0], n[2] ?? n[0], n[3] ?? n[1] ?? n[0]], uf = /* @__PURE__ */ new Set(["none", "hidden", "solid", "dashed", "dotted", "double", "groove", "ridge", "inset", "outset"]);
function Ss(n, l) {
  const i = l.trim(), o = () => oe(i);
  switch (n) {
    case "padding":
    case "margin": {
      const s = Br(o());
      return El.map((u, m) => [`${n}-${u}`, s[m]]);
    }
    case "padding-inline":
    case "margin-inline": {
      const s = o(), u = n.split("-")[0];
      return [[`${u}-left`, s[0]], [`${u}-right`, s[1] ?? s[0]]];
    }
    case "padding-block":
    case "margin-block": {
      const s = o(), u = n.split("-")[0];
      return [[`${u}-top`, s[0]], [`${u}-bottom`, s[1] ?? s[0]]];
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
      const s = Br(o());
      return El.map((u, m) => [u, s[m]]);
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
      const s = n.split("-")[1], u = Br(o());
      return El.map((m, f) => [`border-${m}-${s}`, u[f]]);
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
      const s = n === "border" ? El : n === "border-inline" ? ["left", "right"] : n === "border-block" ? ["top", "bottom"] : n === "border-inline-start" ? ["left"] : n === "border-inline-end" ? ["right"] : [n.slice(7)];
      let u = "medium", m = "none", f = "currentcolor";
      if (i !== "none" && i !== "0")
        for (const p of o())
          uf.has(p) ? m = p : /^(thin|medium|thick|-?[\d.]|calc\()/.test(p) ? u = p : f = p;
      else i === "0" && (u = "0");
      return s.flatMap((p) => [[`border-${p}-width`, u], [`border-${p}-style`, m], [`border-${p}-color`, f]]);
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
      const s = Br(oe(i.split("/")[0]));
      return pg.map((u, m) => [`border-${u}-radius`, s[m]]);
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
      return i === "none" ? [["background-color", "transparent"], ["background-image", "none"]] : Pr(i, () => "#000000") ? [["background-color", i], ["background-image", "none"]] : [["background-color", "transparent"], ["background-image", i]];
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
      return Ss("gap", i);
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
      const s = o(), u = s.filter((f) => /^[\d.]+$/.test(f)), m = s.find((f) => !/^[\d.]+$/.test(f));
      return [["flex-grow", u[0] ?? "1"], ["flex-shrink", u[1] ?? "1"], ["flex-basis", m ?? (u.length ? "0%" : "auto")]];
    }
    case "flex-flow": {
      const s = [];
      for (const u of o()) s.push(/wrap/.test(u) ? ["flex-wrap", u] : ["flex-direction", u]);
      return s;
    }
    case "outline": {
      if (i === "none" || i === "0") return [["outline-style", "none"], ["outline-width", "medium"], ["outline-color", "currentcolor"]];
      let s = "medium", u = "none", m = "currentcolor";
      for (const f of o())
        uf.has(f) || f === "auto" ? u = f : /^(thin|medium|thick|-?[\d.]|calc\()/.test(f) ? s = f : m = f;
      return [["outline-width", s], ["outline-style", u], ["outline-color", m]];
    }
    case "transition": {
      if (i === "none") return [["transition-property", "none"], ["transition-duration", "0s"]];
      const s = oe(i, ","), u = s.map((f) => oe(f).find((p) => !/^[\d.]+m?s$/.test(p) && !/^(ease|linear|step|cubic)/.test(p)) ?? "all"), m = s.map((f) => oe(f).find((p) => /^[\d.]+m?s$/.test(p)) ?? "0s");
      return [["transition-property", u.join(", ")], ["transition-duration", m.join(", ")]];
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
function hg(n, l) {
  return n ? oe(n, ",").some((i) => {
    let o = i.trim().toLowerCase(), s = !1;
    o.startsWith("not ") && (s = !0, o = o.slice(4)), o.startsWith("only ") && (o = o.slice(5));
    const u = o.split(/\s+and\s+/).every((m) => {
      if (m = m.trim(), m === "all" || m === "screen") return !0;
      if (m === "print") return !1;
      const f = /^\((.+)\)$/.exec(m);
      if (!f) return !1;
      const p = f[1].trim(), x = /^([a-z-]+)\s*:\s*(.+)$/.exec(p);
      if (x) {
        const [, k, y] = x, S = (z) => {
          const j = ks(z, { viewport: l });
          return typeof j == "object" && "px" in j ? j.px : NaN;
        };
        switch (k) {
          case "min-width":
            return l.width >= S(y);
          case "max-width":
            return l.width <= S(y);
          case "min-height":
            return l.height >= S(y);
          case "max-height":
            return l.height <= S(y);
          case "hover":
          case "any-hover":
            return y.trim() === "hover";
          case "pointer":
          case "any-pointer":
            return y.trim() === "fine";
          case "prefers-reduced-motion":
            return y.trim() === "no-preference";
          case "prefers-color-scheme":
            return y.trim() === (l.dark === !1 ? "light" : "dark");
          default:
            return !1;
        }
      }
      const _ = /^(width|height)\s*(>=|<=|>|<|=)\s*(.+)$/.exec(p);
      if (_) {
        const k = _[1] === "width" ? l.width : l.height, y = ks(_[3], { viewport: l }), S = typeof y == "object" && "px" in y ? y.px : NaN;
        switch (_[2]) {
          case ">=":
            return k >= S;
          case "<=":
            return k <= S;
          case ">":
            return k > S;
          case "<":
            return k < S;
          default:
            return k === S;
        }
      }
      return !1;
    });
    return s ? !u : u;
  }) : !0;
}
function gg(n, l) {
  const i = l[l.length - 1].compound;
  return qs(i)[0] ?? n;
}
function bg(n) {
  const l = (i) => i.some((o) => mi.has(o.name) || (o.list ?? []).some((s) => s.some(({ compound: u }) => l(u.pseudos))));
  return l(n[n.length - 1].compound.pseudos);
}
function vg(n) {
  const l = /* @__PURE__ */ new Set(), i = /* @__PURE__ */ new Set(), o = (s, u) => {
    s.forEach(({ compound: m }, f) => {
      const p = u && f === s.length - 1;
      for (const x of m.pseudos)
        if (mi.has(x.name) && (p ? l : i).add(x.name), x.list && x.name !== "not") for (const _ of x.list) o(_, p);
    });
  };
  return o(n, !0), { subject: l, ancestor: i };
}
function qs(n) {
  const l = [...n.classes];
  for (const i of n.pseudos)
    if (!(i.name !== "is" && i.name !== "where"))
      for (const o of i.list) o.length === 1 && l.push(...qs(o[0].compound));
  return l;
}
function yg(n, l) {
  const i = (o, s) => {
    o.forEach(({ compound: u }, m) => {
      const f = s && m === o.length - 1, p = u.pseudos.filter((x) => mi.has(x.name)).map((x) => x.name);
      if (!f) for (const x of p) for (const _ of qs(u)) l.add(`${x}:${_}`);
      for (const x of u.pseudos) if (x.list && x.name !== "not") for (const _ of x.list) i(_, f);
    });
  };
  i(n, !0);
}
class xg {
  constructor(l) {
    this.properties = l.properties ?? {}, this.rules = [], this.skipped = 0, this.index = /* @__PURE__ */ new Map(), this.trackedStates = /* @__PURE__ */ new Set(), this.dependsCache = /* @__PURE__ */ new Map(), this.candidateCache = /* @__PURE__ */ new Map();
    const i = (u, m) => {
      const f = m[m.length - 1].compound, p = f.classes.length ? `.${f.classes[0]}` : f.tag && f.tag !== "*" ? f.tag : "*";
      this.index.has(p) || this.index.set(p, []), this.index.get(p).push(u);
    };
    let o = 0;
    const s = (u, m) => {
      for (const [f, p, x, _] of u)
        for (const k of Bs(f)) {
          let y;
          try {
            y = Us(k);
          } catch (T) {
            if (T instanceof ie) {
              this.skipped++;
              continue;
            }
            throw T;
          }
          const S = vg(y);
          yg(y, this.trackedStates);
          const z = y[y.length - 1].compound.pseudoElement, j = { steps: y, media: p, layer: x, origin: m, order: o++, specificity: Xf(y), decls: _, states: S, pseudo: z, own: Sg(y), assumed: bg(y), above: _g(y), source: m === 0 ? `ua:${y[y.length - 1].compound.tag ?? "*"}` : gg(k, y) };
          this.rules.push(j), i(j, y);
        }
    };
    s(sg.map(([u, m]) => [u, null, 0, Object.entries(m)]), 0), s(l.rules, 1);
  }
  /** Rules that may match `element` (by its classes, its tag, and the universal ones), or its `pseudo` box
   * (`before`, `after`). */
  candidates(l, i = null) {
    const o = `${l.tagName} ${l.className}|${i ?? ""}`, s = this.candidateCache.get(o);
    if (s) return s;
    const u = [], m = /* @__PURE__ */ new Set(), f = new Set(l.classList), p = (x) => {
      if (x) for (const _ of x) !m.has(_) && _.pseudo === i && (m.add(_), im(_.steps[_.steps.length - 1].compound, l.tagName, f) && u.push(_));
    };
    for (const x of l.classList) p(this.index.get(`.${x}`));
    return p(this.index.get(l.tagName)), p(this.index.get("*")), this.candidateCache.set(o, u), u;
  }
  /** What the rules that may match `element` (any pseudo-element) read besides the element and its parent's computed
   * style: `anc`, an ancestor's attributes or state; `pos`, whether it is its parent's first or last child; `nth`, its
   * index; `ancPos`, an ancestor's position. The description's cache keys on exactly these (`describe.mjs`). */
  depends(l) {
    const i = `${l.tagName} ${l.className}`;
    let o = this.dependsCache.get(i);
    if (o) return o;
    o = { anc: !1, pos: !1, nth: !1, ancPos: !1 };
    const s = /* @__PURE__ */ new Set(), u = (m) => {
      for (const f of m ?? []) {
        if (s.has(f)) continue;
        s.add(f);
        const p = f.reads ??= sm(f.steps);
        o.anc ||= p.anc, o.pos ||= p.pos, o.nth ||= p.nth, o.ancPos ||= p.ancPos;
      }
    };
    for (const m of l.classList) u(this.index.get(`.${m}`));
    return u(this.index.get(l.tagName)), u(this.index.get("*")), this.dependsCache.set(i, o), o;
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
function im(n, l, i) {
  if (n.tag && n.tag !== "*" && n.tag !== l) return !1;
  for (const o of n.classes) if (!i.has(o)) return !1;
  for (const o of n.pseudos) {
    if (o.name === "has") return !0;
    if (o.name === "root" && l !== "html" || (o.name === "where" || o.name === "is") && o.list.every((s) => s.length === 1 && !im(s[0].compound, l, i))) return !1;
  }
  return !0;
}
const wg = /* @__PURE__ */ new Set(["first-child", "last-child", "only-child", "nth-child"]);
function _g(n) {
  const l = [];
  for (let i = n.length - 1; i > 0 && !(n[i].combinator !== " " && n[i].combinator !== ">"); i--)
    l.push(...n[i - 1].compound.classes);
  return l;
}
function om(n) {
  const l = n.parentElement;
  if (!l) return kg;
  const i = om(l), o = n.aboveCache;
  if (o && o.parent === l && o.name === l.className && o.base === i) return o.set;
  const s = l.classSet, u = s.size === 0 ? i : /* @__PURE__ */ new Set([...i, ...s]);
  return n.aboveCache = { parent: l, name: l.className, base: i, set: u }, u;
}
const kg = /* @__PURE__ */ new Set();
function Sg(n) {
  if (n.length !== 1) return !1;
  const { compound: l } = n[0];
  return !l.id && !l.attrs.length && l.pseudos.every((i) => mi.has(i.name) && i.name !== "focus-within");
}
function sm(n, l = !0, i = { anc: !1, pos: !1, nth: !1, ancPos: !1 }) {
  return n.forEach((o, s) => {
    const u = l && s === n.length - 1;
    u || (i.anc = !0);
    for (const m of o.compound.pseudos)
      if (wg.has(m.name) && (u ? i.pos = !0 : i.ancPos = !0, m.name === "nth-child" && u && (i.nth = !0)), m.list && m.name !== "has") for (const f of m.list) sm(f, u, i);
  }), i;
}
const Eg = /* @__PURE__ */ new Set(["opacity", "z-index", "flex-grow", "flex-shrink", "font-weight", "line-height", "flex", "order", "-webkit-line-clamp", "zoom"]);
function zg(n) {
  if (!n || typeof n != "object") return [];
  const l = [];
  for (const [i, o] of Object.entries(n)) {
    if (o == null || o === "" || typeof o == "boolean") continue;
    const s = i.startsWith("--") ? i : i.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`).replace(/^(webkit|moz|ms)-/, "-$1-"), u = typeof o == "number" && o !== 0 && !Eg.has(s) && !s.startsWith("--") ? `${o}px` : String(o);
    l.push([s, u]);
  }
  return l;
}
function Ng(n) {
  if (n.tagName !== "svg") return [];
  const l = [];
  for (const i of ["width", "height"]) {
    const o = n.getAttribute(i);
    o !== null && l.push([i, /^[\d.]+$/.test(o) ? `${o}px` : o]);
  }
  return l;
}
const Tg = (n, l) => n.important - l.important || n.origin - l.origin || n.layer - l.layer || n.specificity[0] - l.specificity[0] || n.specificity[1] - l.specificity[1] || n.specificity[2] - l.specificity[2] || n.order - l.order;
class Mg {
  constructor(l, { theme: i, viewport: o }) {
    this.sheet = l, this.theme = i, this.viewport = o, this.parsed = /* @__PURE__ */ new Map(), this.computed = /* @__PURE__ */ new WeakMap(), this.rootComputed = /* @__PURE__ */ new Map(), this.media = /* @__PURE__ */ new Map(), this.ownMatches = /* @__PURE__ */ new Map();
  }
  mediaHolds(l) {
    if (!l.media) return !0;
    for (const i of l.media) {
      let o = this.media.get(i);
      if (o === void 0 && this.media.set(i, o = hg(i, this.viewport)), !o) return !1;
    }
    return !0;
  }
  themeHex(l) {
    return this.theme?.[l] ?? null;
  }
  /** Rules matching `element`; `assume` is the set of interaction states assumed on the element itself
   * (`"*"`: any, for finding variant rules). Ancestors use their real state. */
  matching(l, i, o = null, s = null) {
    const m = { state: (z, j, T) => {
      if (j === "disabled") return !!z.props?.disabled && ["button", "input", "select", "textarea", "fieldset"].includes(z.tagName);
      if (j === "enabled") return !z.props?.disabled && ["button", "input", "select", "textarea"].includes(z.tagName);
      if (j === "checked") return !!z.props?.checked;
      if (i === "*") return !0;
      if (j === "focus-within") {
        const A = z.ownerDocument?.activeElement;
        return !!A && A !== z.ownerDocument.body && typeof z.contains == "function" && z.contains(A);
      }
      return T ? i.has(j) : j === "focus-visible" ? !!z.state?.focus && !z.state?.pointerFocus : !!z.state?.[j];
    }, pseudo: o }, f = this.sheet.candidates(l, o), p = `${l.tagName} ${l.className}|${o ?? ""}|${i === "*" ? "*" : [...i].sort().join(",")}`;
    let x = this.ownMatches.get(p);
    x || (x = new Set(f.filter((z) => z.own && this.mediaHolds(z) && hs(l, z.steps, m))), this.ownMatches.set(p, x));
    let _ = null;
    const k = (z) => z.above.length ? (_ ??= om(l), z.above.every((j) => _.has(j))) : !0, y = s && i !== "*" ? s[o ?? ""] ??= /* @__PURE__ */ new Map() : null, S = (z) => this.mediaHolds(z) && k(z) && hs(l, z.steps, m);
    return f.filter((z) => {
      if (z.own) return x.has(z);
      if (!y || z.assumed) return S(z);
      let j = y.get(z);
      return j === void 0 && y.set(z, j = S(z)), j;
    });
  }
  /** `element`'s computed style, or with `pseudo` (`before`, `after`) that of its pseudo-element's box, whose parent
   * is the element (pass the element's own computed style as `parent`). */
  compute(l, i, o = /* @__PURE__ */ new Set(), s = null, u = null) {
    const m = this.matching(l, o, s, u), f = s ? [] : Ng(l), p = s ? [] : zg(l.inlineStyle ?? l.props?.style);
    let x = this.rootComputed;
    i && (x = this.computed.get(i.values), x || this.computed.set(i.values, x = /* @__PURE__ */ new Map()));
    const _ = `${m.map((y) => y.order).join(",")}|${f.length ? JSON.stringify(f) : ""}|${p.length ? JSON.stringify(p) : ""}`;
    let k = x.get(_);
    return k || x.set(_, k = this.cascade(m, f, p, i)), { ...k, rules: m, element: l, shared: k };
  }
  /** The computed style from the matched `rules`, presentational `attrs`, `inline` declarations and the parent's. */
  cascade(l, i, o, s) {
    const u = [];
    for (const h of l)
      for (const [b, g, w] of h.decls) u.push({ prop: b, value: g, important: w ? 1 : 0, origin: h.origin === 0 ? 0 : 2, layer: h.layer, specificity: h.specificity, order: h.order, source: h.source });
    for (const [h, b] of i) u.push({ prop: h, value: b, important: 0, origin: 1, layer: 0, specificity: [0, 0, 0], order: 0, source: `attr:${h}` });
    for (const [h, b] of o) u.push({ prop: h, value: b, important: 0, origin: 3, layer: 0, specificity: [1, 0, 0], order: 0, source: "style" });
    u.sort(Tg);
    const m = this.sheet.properties, f = Object.create(s?.customs ?? null), p = /* @__PURE__ */ new Map(), x = /* @__PURE__ */ new Map();
    for (const h of u) h.prop.startsWith("--") && x.set(h.prop, h.value);
    if (!s && this.theme) for (const h of am) this.theme[h] && x.set(`--${h}`, `perchtoken(${h})`);
    const _ = (h) => {
      if (p.has(h)) return p.get(h);
      const b = m[h];
      return b && !b.inherits ? b.initial ?? null : h in f ? f[h] : b?.initial ?? null;
    }, k = /* @__PURE__ */ new Set(), y = (h) => {
      if (!x.has(h)) return _(h);
      if (k.has(h)) return null;
      k.add(h);
      const b = _s(x.get(h), y);
      return k.delete(h), x.delete(h), p.set(h, b), (!m[h] || m[h].inherits) && (f[h] = b), b;
    };
    for (const h of [...x.keys()]) y(h);
    const S = /* @__PURE__ */ new Map();
    for (const h of u) {
      if (h.prop.startsWith("--")) continue;
      const b = _s(h.value, _);
      if (b === null) {
        for (const [g] of Ss(h.prop, "unset")) S.set(g, { value: "unset", source: h.source, origin: h.origin });
        continue;
      }
      for (const [g, w] of Ss(h.prop, b)) S.set(g, { value: w, source: h.source, origin: h.origin });
    }
    const z = {}, j = {}, T = /* @__PURE__ */ new Set(), A = /* @__PURE__ */ new Set(), R = s?.values, B = { fontSize: R?.["font-size"] ?? xs, viewport: this.viewport }, Z = (h, b) => {
      if (/currentcolor/i.test(b)) return this.parseValue(h, b, B, z, R);
      const g = `${h}\0${b}\0${B.fontSize}`;
      let w = this.parsed.get(g);
      return w === void 0 && this.parsed.set(g, w = this.parseValue(h, b, B, z, R)), w;
    }, F = S.size ? [...ws, ...[...S.keys()].filter((h) => !ug.has(h))] : ws;
    for (const h of F) {
      const b = S.get(h);
      let g = b?.value;
      const w = cg.has(h);
      if ((g === void 0 || g === "unset" || g === "revert" || g === "revert-layer") && (g = w ? "inherit" : "initial"), b && (j[h] = b.source, b.origin !== 0 && T.add(h)), g === "inherit" && R && h in R) {
        z[h] = R[h], A.add(h);
        continue;
      }
      (g === "inherit" || g === "initial") && (g = w ? rm[h] : lm[h]), z[h] = Z(h, g), h === "font-size" && (B.fontSize = z["font-size"]);
    }
    for (const h of El) {
      const b = z[`border-${h}-style`];
      (b === "none" || b === "hidden") && (z[`border-${h}-width`] = { px: 0 });
    }
    z["outline-style"] === "none" && (z["outline-width"] = { px: 0 });
    const D = R?.display;
    return (D === "flex" || D === "inline-flex" || D === "grid" || D === "inline-grid") && z.position !== "absolute" && z.position !== "fixed" && (z.display = df(z.display)), (z.position === "absolute" || z.position === "fixed") && (z.display = df(z.display)), { values: z, sources: j, own: T, inherited: A, customs: f };
  }
  parseValue(l, i, o, s, u) {
    const m = String(i).trim();
    switch (l) {
      case "font-size": {
        const f = m.toLowerCase(), p = { "xx-small": 9, "x-small": 10, small: 13, medium: 16, large: 18, "x-large": 24, "xx-large": 32 };
        if (p[f]) return p[f];
        if (f === "smaller") return o.fontSize / 1.2;
        if (f === "larger") return o.fontSize * 1.2;
        const x = qn(f, { fontSize: o.fontSize, viewport: o.viewport });
        return !x || x.num ? o.fontSize : x.px + x.pct / 100 * o.fontSize;
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
        const f = Pr(m, (p) => this.themeHex(p));
        return f === "currentcolor" || !f ? u?.color ?? { rgba: [0, 0, 0, 1], token: null } : f;
      }
      case "background-color":
      case "border-top-color":
      case "border-right-color":
      case "border-bottom-color":
      case "border-left-color":
      case "outline-color": {
        const f = Pr(m, (p) => this.themeHex(p));
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
        return ks(m, o);
      default:
        return m.toLowerCase().startsWith("var(") ? m : /^[a-z-]+$/i.test(m) ? m.toLowerCase() : m;
    }
  }
}
function df(n) {
  return n === "inline" || n === "inline-block" || n === "contents" ? "block" : n === "inline-flex" ? "flex" : n === "inline-grid" ? "grid" : n;
}
const ti = (n) => n && n.rgba ? { value: mg(n.rgba), token: n.token ?? null } : null, Cg = { 9.28: 11, 9.92: 12, 10.4: 12, 10.88: 13, 11: 13, 11.2: 13, 11.52: 13, 12: 15, 12.5: 15, 13: 16, 14: 17, 16: 19 };
function Ag(n, l) {
  const i = l?.(n);
  if (Number.isFinite(i)) return i;
  const o = Math.round(n * 100) / 100;
  return Cg[o] ?? Math.round(n * 1.2);
}
function Nl(n, l) {
  const i = n["line-height"], o = n["font-size"];
  return i.normal ? Ag(o, l) : i.factor !== void 0 ? i.factor * o : i.px;
}
const jg = (n) => oe(n, ",").map((l) => l.trim().replace(/^["']|["']$/g, "")).join(", ");
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
const Og = "perch-native-description/1", Le = Symbol("display"), ei = {
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
}, Rg = ["w", "h", "min_w", "min_h", "max_w", "max_h", "top", "right", "bottom", "left", "pt", "pr", "pb", "pl", "mt", "mr", "mb", "ml", "gap_x", "gap_y", "border_t", "border_r", "border_b", "border_l", "rounded_tl", "rounded_tr", "rounded_br", "rounded_bl"];
for (const n of Rg) ei[n] = /^(w|h|min_|max_|top|right|bottom|left)/.test(n) ? "auto" : 0;
ei.rounded = 0;
const Dg = /* @__PURE__ */ new Set([
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
]), Hg = /(-apple-system|blinkmacsystemfont|system-ui|segoe ui|sans-serif|times)/i, Bg = /(ui-monospace|sfmono|sf mono|menlo|monospace)/i, Ug = /^\s*["']?(ui-monospace|sfmono-regular|sf mono)["']?\s*(,|$)/i, Gg = (n) => Ug.test(n ?? "") ? ".AppleSystemUIFontMonospaced" : Bg.test(n) ? "Menlo" : /^\s*system-ui\s*$/i.test(n ?? "") ? ".AppleSystemUIFont" : Hg.test(n) ? ".SystemUIFont" : jg(n).split(",")[0].trim(), Yg = {
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
}, ff = { pointerdown: "mouse_down", mousedown: "mouse_down", click: "click", keydown: "key_down", pointerup: "mouse_up", mouseup: "mouse_up" }, Ls = (n) => {
  const l = n.props["data-testid"];
  if (l) return `${n.tagName}[data-testid="${l}"]`;
  if (n.props.id) return `${n.tagName}#${n.props.id}`;
  const i = n.classList.find((s) => !s.includes(":") && !s.includes("[")) ?? n.classList[0];
  if (i) return `${n.tagName}.${i}`;
  const o = n.parentElement;
  return o && o.tagName !== "body" ? `${Ls(o)} > ${n.tagName}` : n.tagName;
};
class qg {
  constructor() {
    this.map = /* @__PURE__ */ new Map();
  }
  add(l, i, o, s, u, m = "") {
    const f = `${l}|${i}|${o}|${s}`, p = this.map.get(f);
    if (p) {
      !p.elements.includes(u) && p.elements.length < 4 && p.elements.push(u), p.count++;
      return;
    }
    this.map.set(f, { kind: l, property: i, value: String(o), class: s ?? null, elements: [u], count: 1, ...m ? { note: m } : {} });
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
}, Lg = /^(text|search|url|email|tel|password|number)$/, Qg = 162.13 / 12.8;
function Vg(n, l) {
  const i = typeof n == "object" && /^min\((.*)\)$/.exec(String(n?.expr ?? "").trim());
  if (!i) return;
  const o = oe(i[1], ",").map((s) => qn(s.trim(), { fontSize: l })).filter((s) => s && !s.pct && !s.num).map((s) => s.px);
  return o.length ? Math.min(...o) : void 0;
}
function Kg(n, l) {
  if (typeof n != "object" || !n?.expr) return !1;
  const i = qn(n.expr, { fontSize: l["font-size"] }), o = (l["margin-left"]?.px ?? NaN) + (l["margin-right"]?.px ?? NaN);
  return !!i && !i.num && i.pct === 100 && Math.abs(i.px + o) < 0.01;
}
function cm(n) {
  const l = n.transform;
  if (l && l !== "none") {
    const o = /^\s*translate(X|Y)?\(([^]*)\)\s*$/.exec(l), s = o && oe(o[2], ",").map((u) => u.trim());
    return !s || s.length > (o[1] ? 1 : 2) ? null : o[1] === "X" ? [s[0], "0"] : o[1] === "Y" ? ["0", s[0]] : [s[0], s[1] ?? "0"];
  }
  const i = n.translate;
  if (i && i !== "none") {
    const o = oe(String(i).trim(), " ").filter(Boolean);
    return o.length > 3 || o[2] !== void 0 && qn(o[2], {})?.px ? null : [o[0], o[1] ?? "0"];
  }
  return [];
}
function mf(n, l, i, o = !1) {
  const s = n.values, u = cm(s);
  if (u?.length === 0) return;
  const m = s.transform && s.transform !== "none" ? "transform" : "translate", f = { fontSize: s["font-size"] }, p = (k, y) => {
    const S = qn(k, f);
    if (!(!S || S.unitless && S.num))
      return S.pct ? typeof y == "number" ? S.px + S.pct / 100 * y : void 0 : S.px;
  }, x = u ? p(u[0], l.w) : void 0, _ = u ? p(u[1], l.h) : void 0;
  if (x === void 0 || _ === void 0) {
    const k = !o && u ? u.map((y) => qn(y, f)) : null;
    if (k?.every((y) => y && !(y.unitless && y.num))) {
      l[um] = k.map((y) => [y.px, y.pct ?? 0]);
      return;
    }
    i("unsupported", m, s[m], n.sources[m]);
    return;
  }
  if (o) {
    x && (l.left = x), _ && (l.top = _);
    return;
  }
  x && (l.ml = (l.ml ?? 0) + x), _ && (l.mt = (l.mt ?? 0) + _);
}
const um = Symbol("perch.shift");
function Xg(n, l, i) {
  const o = n.ownerDocument, s = o?.measure?.(n) ?? null;
  if (s) {
    const [[m, f], [p, x]] = i, _ = m + f / 100 * s.width, k = p + x / 100 * s.height;
    _ && (l.ml = (typeof l.ml == "number" ? l.ml : 0) + _), k && (l.mt = (typeof l.mt == "number" ? l.mt : 0) + k);
  }
  const u = s ? `${s.width}x${s.height}` : "";
  u === n.shiftSeen ? n.shiftTries = 0 : (n.shiftTries ?? 0) < $f && o?.retries && (n.shiftSeen = u, n.shiftTries = (n.shiftTries ?? 0) + 1, o.retries.push(() => o.afterCommit?.()));
}
function ni(n, l, i = null) {
  const o = n.values, s = {}, u = (B) => n.sources[B], m = (B) => n.sources[B] !== void 0, f = o.display;
  f === "none" ? s.display = "hidden" : f === "flex" || f === "inline-flex" ? s.display = "flex" : (f === "grid" || f === "inline-grid") && (s.display = "flex", s.flex_direction = "col", l("approximated", "display", f, u("display"), "one-column flex column"), o["grid-template-columns"] && o["grid-template-columns"] !== "none" && l("unsupported", "grid-template-columns", o["grid-template-columns"], u("grid-template-columns"))), n.element.hidden && (s.display = "hidden");
  const p = s.display === "flex";
  if (p && s.flex_direction !== "col") {
    const B = { row: "row", column: "col", "row-reverse": "row_reverse", "column-reverse": "col_reverse" }[o["flex-direction"]] ?? "row";
    s.flex_direction = B;
  }
  if (p) {
    (o["flex-wrap"] === "wrap" || o["flex-wrap"] === "wrap-reverse") && (s.flex_wrap = "wrap");
    const B = f === "grid" || f === "inline-grid", Z = { "flex-start": "start", start: "start", "self-start": "start", "flex-end": "end", end: "end", "self-end": "end", center: "center", baseline: "baseline", "first baseline": "baseline" }[o["align-items"]];
    Z && (s.items = Z);
    let F = { "flex-start": "start", start: "start", "flex-end": "end", end: "end", center: "center", "space-between": "between", "space-around": "around", "space-evenly": "evenly" }[o["justify-content"]];
    if (B) {
      const b = { center: "center", end: "end", "flex-end": "end", start: "start", "flex-start": "start" }[o["justify-items"]];
      b && (s.items = b), o["align-items"] === "center" && (F = "center");
    }
    F && (s.justify = F);
    const D = hn(o["row-gap"]), h = hn(o["column-gap"]);
    typeof D == "number" && D && (s.gap_y = D), typeof h == "number" && h && !B && (s.gap_x = h);
  }
  o["flex-grow"] && (s.flex_grow = o["flex-grow"]), o["flex-shrink"] !== 1 && (s.flex_shrink = o["flex-shrink"]);
  const x = hn(o["flex-basis"]);
  x !== void 0 && x !== "auto" && (s.flex_basis = x);
  const _ = { "flex-start": "start", start: "start", "flex-end": "end", end: "end", center: "center", baseline: "baseline", stretch: "stretch" }[o["align-self"]];
  _ && (s.self = _);
  for (const [B, Z] of [["w", "width"], ["h", "height"], ["min_w", "min-width"], ["min_h", "min-height"], ["max_w", "max-width"], ["max_h", "max-height"]]) {
    const F = o[Z], D = hn(F);
    if (D === void 0 && Z === "width" && Kg(F, o)) {
      s.self = "stretch", l("approximated", Z, F.expr, u(Z), "stretched across its parent, inside its margins");
      continue;
    }
    const h = D === void 0 && /^max-/.test(Z) ? Vg(F, o["font-size"]) : void 0;
    if (h !== void 0) {
      s[B] = h, l("approximated", Z, F.expr, u(Z), "the fixed bound of min()");
      continue;
    }
    if (D === void 0) {
      typeof F == "object" && F.expr ? l("unsupported", Z, F.expr, u(Z), "no calc() in the engine") : typeof F == "string" && !["auto", "none"].includes(F) && l("unsupported", Z, F, u(Z));
      continue;
    }
    D !== "auto" && (s[B] = D);
  }
  const k = ["top", "right", "bottom", "left"];
  for (const B of k) {
    const Z = B[0];
    for (const [F, D] of [["p", "padding"], ["m", "margin"]]) {
      const h = o[`${D}-${B}`], b = hn(h);
      if (b === void 0) {
        h?.expr && l("unsupported", `${D}-${B}`, h.expr, u(`${D}-${B}`), "no calc() in the engine");
        continue;
      }
      b !== 0 && (s[`${F}${Z}`] = b);
    }
  }
  const y = o.position;
  if (y === "absolute" || y === "fixed") {
    s.position = "absolute", y === "fixed" && l("approximated", "position", "fixed", u("position"), "absolute in the overlay layer");
    for (const B of k) {
      const Z = hn(o[B]);
      Z !== void 0 && Z !== "auto" && (s[B] = Z);
    }
    if (y === "fixed" && i && s.w === void 0 && s.right === void 0 && typeof s.left == "number") {
      const B = i.width - s.left - (typeof s.ml == "number" ? s.ml : 0) - (typeof s.mr == "number" ? s.mr : 0);
      s.max_w = typeof s.max_w == "number" ? Math.min(s.max_w, B) : B;
    }
    mf(n, s, l);
  } else y === "sticky" ? l("unsupported", "position", "sticky", u("position")) : cm(o)?.length !== 0 && (s.position = "relative", mf(n, s, l, !0));
  o["z-index"] !== "auto" && m("z-index") && l("unsupported", "z-index", o["z-index"], u("z-index"), "paint order is tree order");
  for (const [B, Z] of [["overflow_x", "overflow-x"], ["overflow_y", "overflow-y"]]) {
    const F = o[Z];
    F === "hidden" || F === "clip" ? s[B] = "hidden" : (F === "auto" || F === "scroll") && (s[B] = "scroll");
  }
  (o.visibility === "hidden" || o.visibility === "collapse") && (s.visibility = "invisible");
  const S = o["background-color"];
  S?.unreadable ? l("unsupported", "background-color", S.unreadable, u("background-color")) : S?.rgba && S.rgba[3] > 0 && (s.bg = ti(S)), o["background-image"] && o["background-image"] !== "none" && l("unsupported", "background-image", o["background-image"], u("background-image"));
  const z = k.map((B) => hn(o[`border-${B}-width`]) || 0), j = [];
  k.forEach((B, Z) => {
    if (!z[Z]) return;
    s[`border_${B[0]}`] = z[Z];
    const F = o[`border-${B}-style`];
    F !== "solid" && l("approximated", `border-${B}-style`, F, u(`border-${B}-style`), "drawn solid");
    const D = ti(o[`border-${B}-color`]);
    D && j.push(D);
  }), j.length && (s.border_color = j[0], j.some((B) => B.value !== j[0].value) && l("approximated", "border-color", j.map((B) => B.value).join(" "), u("border-top-color"), "one border colour"));
  const T = (B) => {
    const Z = hn(o[`border-${B}-radius`]) || 0;
    if (typeof Z != "string") return Z;
    const F = parseFloat(Z) / 100, D = [s.w, s.h].filter((h) => typeof h == "number");
    return Z === "auto" || !(F > 0) ? 0 : D.length ? Math.round(Math.min(F, 0.5) * Math.min(...D) * 100) / 100 : 9999;
  }, A = ["top-left", "top-right", "bottom-right", "bottom-left"].map(T);
  A.every((B) => B === A[0]) ? A[0] && (s.rounded = A[0]) : ["tl", "tr", "br", "bl"].forEach((B, Z) => {
    A[Z] && (s[`rounded_${B}`] = A[Z]);
  }), o.opacity !== 1 && (s.opacity = Math.round(o.opacity * 1e3) / 1e3);
  const R = o["box-shadow"];
  if (R && R !== "none" && oe(R, ",").some((B) => !/^0(px)?\s+0(px)?\s+(0(px)?\s+)?(0(px)?\s+)?(#0000|transparent|rgba?\(0,\s*0,\s*0,\s*0\))/.test(B.trim())) && (s.shadow = "lg", l("approximated", "box-shadow", R, u("box-shadow"), "the engine's large shadow preset")), o.cursor && o.cursor !== "auto" && !n.inherited.has("cursor")) {
    const B = { pointer: "pointer", default: "default", text: "text", move: "move", "not-allowed": "not_allowed", grab: "move", grabbing: "move" }[o.cursor];
    B ? s.cursor = B : l("unsupported", "cursor", o.cursor, u("cursor"));
  }
  return o["text-overflow"] === "ellipsis" && (s.text_ellipsis = !0), o["text-decoration-line"] === "underline" ? s.underline = !0 : o["text-decoration-line"] && o["text-decoration-line"] !== "none" && l("unsupported", "text-decoration-line", o["text-decoration-line"], u("text-decoration-line")), s;
}
const Zg = { "tabular-nums": "tnum", "proportional-nums": "pnum", "lining-nums": "lnum", "oldstyle-nums": "onum", "slashed-zero": "zero", "diagonal-fractions": "frac", "stacked-fractions": "afrc", ordinal: "ordn" };
function dm(n) {
  if (!n || n === "normal") return "";
  const l = String(n).trim().split(/\s+/).map((i) => Zg[i]);
  return l.every(Boolean) ? l.join(",") : null;
}
function ai(n, l) {
  const i = n.values, o = i["line-height"];
  return {
    text_color: ti(i.color),
    text_size: Math.round(i["font-size"] * 1e3) / 1e3,
    font_features: dm(i["font-variant-numeric"]) ?? "",
    font_weight: i["font-weight"],
    line_height: o.factor !== void 0 ? { factor: o.factor } : { px: Math.round(Nl(i, l) * 1e3) / 1e3 },
    font_family: Gg(i["font-family"]),
    italic: i["font-style"] === "italic" || i["font-style"] === "oblique",
    whitespace: i["white-space"] === "nowrap" || i["white-space"] === "pre" ? "nowrap" : "normal",
    text_align: { center: "center", right: "right", end: "right" }[i["text-align"]] ?? "left"
  };
}
const pf = (n, l) => n.factor !== void 0 ? n.factor * l : n.px, Qs = (n, l) => JSON.stringify(n) === JSON.stringify(l);
function li(n, l, i) {
  const o = {}, s = (f, p) => p.some((x) => !n.inherited.has(x));
  for (const [f, p] of [["text_color", ["color"]], ["text_size", ["font-size"]], ["font_weight", ["font-weight"]], ["font_family", ["font-family"]], ["italic", ["font-style"]], ["whitespace", ["white-space"]], ["text_align", ["text-align"]], ["font_features", ["font-variant-numeric"]]])
    (s(f, p) || !Qs(l[f], i[f])) && (o[f] = l[f]);
  const u = pf(l.line_height, l.text_size), m = i.line_height ? pf(i.line_height, l.text_size) : NaN;
  return (s("line_height", ["line-height"]) || !(Math.abs(u - m) <= 1e-3)) && (o.line_height = l.line_height), o;
}
const Jg = (n, l) => ({ ...n, ...l });
function ri(n, l) {
  const i = {};
  for (const [o, s] of Object.entries(n))
    s && typeof s == "object" && "value" in s ? (i[o] = s.value, s.token && (l[o] = s.token)) : o === "line_height" ? i[o] = s.factor !== void 0 ? Math.round(s.factor * 1e3) / 1e3 : `${s.px}px` : o === "italic" ? s && (i.italic = !0) : i[o] = s;
  return i.italic === !1 && delete i.italic, i;
}
function fm(n, l) {
  const i = {};
  for (const o of /* @__PURE__ */ new Set([...Object.keys(n), ...Object.keys(l)])) {
    const s = n[o], u = l[o];
    Qs(s, u) || (i[o] = u === void 0 ? o in ei ? ei[o] : null : u);
  }
  return i;
}
function hf(n, l) {
  const i = n.values;
  for (const [o, s] of Object.entries(n.sources)) {
    if (o.startsWith("--") || Dg.has(o) || s.startsWith("ua:")) continue;
    const u = i[o];
    switch (o) {
      case "letter-spacing":
        u !== "normal" && u?.px !== 0 && l("approximated", o, u?.px !== void 0 ? `${Math.round(u.px * 1e3) / 1e3}px` : u, s, u?.px < 0 ? "the run's box is as wide as with the spacing (the glyphs reach past it; where the element clips, the run is drawn smaller to fit)" : "the run is as wide as with the spacing (room after it), the letters are not spread");
        break;
      case "font-variant-numeric":
        u !== "normal" && dm(u) === null && l("unsupported", o, u, s);
        break;
      case "text-transform":
        u !== "none" && l("approximated", o, u, s, "applied to the text in JS");
        break;
      case "transition-property":
      case "transition-duration": {
        const m = i["transition-duration"];
        o === "transition-property" && m && oe(m, ",").some((f) => parseFloat(f) > 0) && i["transition-property"] !== "none" && l("unsupported", "transition", `${i["transition-property"]} ${m}`, s, "changes are instant (the engine animates only opacity and size)");
        break;
      }
      case "-webkit-line-clamp":
        u !== "none" && l("unsupported", o, u, s, "no line clamp in the engine");
        break;
      case "-webkit-box-orient":
      case "overflow-wrap":
        o === "overflow-wrap" && u !== "normal" && l("approximated", o, u, s, "lines broken by the translator where the box's width is known (`break_anywhere`)");
        break;
      case "outline-style":
      case "outline-width":
      case "outline-color":
        i["outline-style"] !== "none" && o === "outline-style" && l("unsupported", "outline", `${hn(i["outline-width"])}px ${i["outline-style"]} ${ti(i["outline-color"])?.value ?? ""}`.trim(), s, "no outline in the engine (no focus ring)");
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
        u && u !== "none" && u !== "auto" && u !== "normal" && u !== "initial" && l("unsupported", o, u, s);
        break;
    }
  }
}
function Wg(n, l, i, o) {
  const s = Ls(n), u = {}, m = o.cascade.compute(n, l, /* @__PURE__ */ new Set(), null, u), f = o.cascade.matching(n, "*").filter((R) => R.states.subject.size), p = [];
  for (const [R, B] of Fg)
    f.some((Z) => B.some((F) => Z.states.subject.has(F))) && p.push([R, o.cascade.compute(n, l, new Set(B), null, u)]);
  const x = `${ss(m.shared)}|${ss(i)}|${+!!m.element.hidden}|${p.map(([R, B]) => `${R}${ss(B.shared)}`).join(",")}`;
  let _ = (o.cascade.styled ??= /* @__PURE__ */ new Map()).get(x);
  _ || o.cascade.styled.set(x, _ = Ig(m, p, i, o));
  const { style: k, tokens: y, shift: S, childText: z } = _, j = _.reports.map(([R, B, Z, F, D]) => [R, B, Z, F, s, D]), T = { ..._.extra };
  if (o.cascade.sheet.tracks(n, "hover") && (T.group = bf(n), T.track_hover = !0), o.cascade.sheet.readsAncestor(n, "hover"))
    for (let R = n.parentNode; R?.state; R = R.parentNode) {
      if (!o.cascade.sheet.tracks(R, "hover")) continue;
      const B = R.state.hover;
      R.state.hover = !0;
      let Z;
      try {
        Z = o.cascade.compute(n, l);
      } finally {
        R.state.hover = B;
      }
      const F = {}, D = ri({ ...ni(Z, () => {
      }), ...li(Z, ai(Z, o.measure), i) }, F), h = fm(k, D);
      if (!Object.keys(h).length) continue;
      const b = Object.fromEntries(Object.entries(F).filter(([g]) => g in h));
      (T.group_hover ??= []).push({ group: bf(R), style: h, ...Object.keys(b).length ? { tokens: b } : {} });
    }
  if (/tabular/.test(String(m.values["font-variant-numeric"] ?? "")) && (T.tabular = !0), /^(anywhere|break-word)$/.test(String(m.values["overflow-wrap"] ?? "")) && (T.break_anywhere = !0), _.scrolls) {
    const R = Number.parseFloat(m.customs?.["--scrollbar-size"] ?? "");
    R > 0 && (T.scrollbar = R);
  }
  m.values["pointer-events"] !== "none" && l?.values["pointer-events"] === "none" && (T.blocks_pointer = !0), m.values["pointer-events"] === "none" && (T.pointer_none = !0);
  const A = Object.entries(Yg).filter(([, R]) => R.some((B) => typeof n.props[B] == "function")).map(([R]) => R);
  return !A.includes("click") && ys(n) && A.push("click"), A.length && (T.events = A), { computed: m, style: k, tokens: y, extra: T, meta: ib(n), reports: j, childText: z, where: s, shift: S };
}
const Fg = [["hover", ["hover"]], ["focus", ["focus", "focus-visible"]], ["active", ["active", "hover"]]], gf = /* @__PURE__ */ new WeakMap();
let $g = 0;
function ss(n) {
  let l = gf.get(n);
  return l === void 0 && gf.set(n, l = ++$g), l;
}
function Ig(n, l, i, o) {
  const s = [], u = (y, S, z, j, T) => s.push([y, S, z, j ?? "(user agent)", T]), m = {}, f = ni(n, u, o.viewport);
  hf(n, u);
  const p = ai(n, o.measure), x = li(n, p, i), _ = ri({ ...f, ...x }, m), k = {};
  for (const [y, S] of l) {
    const z = {}, j = ri({ ...ni(S, () => {
    }), ...li(S, ai(S, o.measure), i) }, z);
    y === "focus" && hf(S, u);
    const T = fm(_, j);
    if (Object.keys(T).length) {
      k[y] = T;
      const A = Object.fromEntries(Object.entries(z).filter(([R]) => R in T));
      Object.keys(A).length && (k[`${y}_tokens`] = A);
    }
  }
  return { style: _, tokens: m, shift: f[um], childText: Jg(i, x), extra: k, scrolls: f.overflow_y === "scroll", reports: s };
}
function Pg(n, l, i, o) {
  const s = { before: null, after: null };
  for (const u of ["before", "after"]) {
    if (!o.cascade.matching(n, /* @__PURE__ */ new Set(), u).length) continue;
    const m = o.cascade.compute(n, l, /* @__PURE__ */ new Set(), u), f = String(m.values.content ?? "none").trim();
    if (f === "none" || f === "normal") continue;
    const p = /^(["'])(.*)\1$/.exec(f)?.[2] ?? "", x = (z, j, T, A, R) => o.add(z, j, T, A ?? "(user agent)", `${Ls(n)}::${u}`, R), _ = {}, k = ni(m, x, o.viewport), S = { kind: "div", style: ri({ ...k, ...li(m, ai(m, o.measure), i) }, _), tokens: _, children: p ? [{ kind: "text", text: p }] : [] };
    Object.defineProperty(S, Le, { value: m.values.display }), s[u] = S;
  }
  return s;
}
const bf = (n) => `~g${n.id}`, tb = ["pt", "pr", "pb", "pl", "mt", "mr", "mb", "ml", "border_t", "border_r", "border_b", "border_l", "bg"];
function eb(n) {
  return n.kind === "div" && n[Le] === "inline" && !n.events?.length && !n.meta?.attrs?.["data-testid"] && !tb.some((l) => n.style?.[l]) && n.children?.every((l) => l.kind === "text");
}
function Ur(n, l) {
  const i = n[l], o = { ...i, style: { ...i.style } };
  return Object.defineProperty(o, Le, { value: i[Le] }), n[l] = o, o;
}
function nb(n) {
  const l = [];
  for (let i = n.parentElement; i?.parentElement; i = i.parentElement) {
    const o = i.parentElement.children;
    l.push(`${+(o[0] === i)}${+(o[o.length - 1] === i)}`);
  }
  return l.join("");
}
function mm(n, l, i, o, s = 0, u = !0, m = !0, f = 0) {
  const p = o.cascade.sheet.depends(n), x = p.pos ? `${+u}${+m}${p.nth ? `:${f}` : ""}` : "", _ = p.ancPos ? nb(n) : "";
  let k = o.cache.get(n);
  const y = k && k.version === n.version && k.parentValues === l?.values && k.inheritedText === i && k.pos === x && k.ancPos === _ && (!p.anc || s <= k.at);
  if (y && k.node && k.stamp === n.stamp && !k.volatile && (!k.subAnc || s <= k.subAt)) {
    for (const T of k.log) o.add(...T);
    return k.node;
  }
  if (!y) {
    const T = Wg(n, l, i, o);
    k && Qs(k.part.childText, T.childText) && (T.childText = k.part.childText), k = { version: n.version, parentValues: l?.values, inheritedText: i, pos: x, ancPos: _, at: o.now, part: T }, o.cache.set(n, k);
  }
  const S = o.log.length, z = { volatile: !!k.part.shift || p.ancPos, subAnc: p.anc }, j = ab(n, k, o, Math.max(s, n.attrStamp), z);
  return Object.assign(k, { node: j, stamp: n.stamp, subAt: o.now, log: o.log.slice(S), volatile: z.volatile, subAnc: z.subAnc }), j;
}
function ab(n, l, i, o, s) {
  const { computed: u, tokens: m, extra: f, reports: p, childText: x, where: _ } = l.part;
  for (const g of p) i.add(...g);
  const k = (g, w, N, E, O) => i.add(g, w, N, E, _, O), y = { ...l.part.style };
  l.part.shift && Xg(n, y, l.part.shift);
  const S = { kind: "div", id: n.id, style: y, tokens: m, meta: l.part.meta, ...f };
  Object.defineProperty(S, Le, { value: u.values.display }), n.measured && n.ownerDocument?.measureKey && (S.measure = n.ownerDocument.measureKey(n));
  const z = n.tagName;
  if (n.props["data-perch-engine"] != null)
    return S.kind = "engine", S.engine = String(n.props["data-perch-engine"]), S.key = String(n.props["data-perch-key"] ?? ""), S;
  if (z === "svg")
    return S.kind = n.props["data-perch-image"] ? "image" : "svg", S.markup = sb(n), S;
  if (z === "input" || z === "textarea" || z === "select") {
    S.kind = "input", S.input_type = z === "input" ? String(n.props.type ?? "text") : z;
    for (const N of ["placeholder", "checked", "disabled"]) n.props[N] !== void 0 && (S[N] = n.props[N]);
    if (/^(checkbox|radio)$/.test(S.input_type) && (S.checked = n.checked), z !== "select" && (S.value = n.value), z === "input" && Lg.test(S.input_type) && (S.field_w = Qg * u.values["font-size"]), z === "textarea" && y.h === void 0) {
      const N = u.values, E = (W) => W && typeof W == "object" && "px" in W ? W.px : 0, O = (W) => N[`border-${W}-style`] === "none" ? 0 : E(N[`border-${W}-width`]), Q = Number(n.props.rows) > 0 ? Math.floor(Number(n.props.rows)) : 2;
      y.h = Q * Nl(N, i.measure) + E(N["padding-top"]) + E(N["padding-bottom"]) + O("top") + O("bottom");
    }
    const { before: g, after: w } = Pg(n, u, x, i);
    return (g || w) && (S.children = [g, w].filter(Boolean)), S;
  }
  if (z === "img") {
    S.kind = "image", S.src = n.props.src ?? null;
    for (const [g, w] of [["width", "w"], ["height", "h"]]) {
      const N = Number(n.props[g]);
      y[w] === void 0 && n.props[g] != null && Number.isFinite(N) && (y[w] = N);
    }
    return S;
  }
  const j = u.values["text-transform"], T = [];
  let A = !1, R = !1;
  const B = n.childNodes.reduce((g, w) => g + (w instanceof Zt ? 1 : 0), 0);
  let Z = 0;
  for (const g of n.childNodes) {
    if (g instanceof fi) {
      if (g.hidden || g.data === "") continue;
      A = !0;
      const O = T[T.length - 1];
      if (O?.kind === "text")
        O.source = (O.source ?? O.text) + g.data, O.text = yf(O.source, j), O.text === O.source && delete O.source;
      else {
        const Q = yf(g.data, j);
        T.push(Q === g.data ? { kind: "text", text: Q } : { kind: "text", text: Q, source: g.data });
      }
      continue;
    }
    if (!(g instanceof Zt)) continue;
    const w = mm(g, u, x, i, o, Z === 0, Z === B - 1, Z);
    Z++;
    const N = i.cache.get(g);
    s.volatile ||= N.volatile, s.subAnc ||= N.subAnc;
    const E = w[Le];
    E === "inline" || E === "inline-block" || E === "inline-flex" ? A = !0 : E !== "none" && (R = !0), T.push(w);
  }
  if (/(^|\s)inline-flex(\s|$)/.test(String(n.props?.className ?? "")) && y.w === void 0) {
    for (let g = 0; g < T.length; g++)
      if (T[g].style?.flex_grow && T[g].style.min_w === 0 && T[g].style.overflow_x === "hidden") {
        const w = Ur(T, g);
        delete w.style.min_w, delete w.style.flex_grow, delete w.style.flex_basis, delete w.style.overflow_x, delete w.style.overflow_y;
      }
  }
  if (!y.display && A && T.some((g) => g.kind !== "text") && T.every((g) => g.kind === "text" || eb(g))) {
    const g = T.map((w) => w.kind === "text" ? w.text : w.children.map((N) => N.text).join("")).join("");
    k("approximated", "display", "inline text elements in a line of text", "(inline formatting)", "their text joined to the line, in its font"), T.splice(0, T.length, { kind: "text", text: g });
  }
  const F = T.some((g) => g.kind !== "text");
  let D = T.length === 1 && T[0].kind !== "text" && /^inline-(block|flex)$/.test(T[0][Le]) ? T[0] : null;
  if (!y.display && D) {
    D = Ur(T, 0);
    const g = i.cache.get(n.childNodes.find((N) => N.id === D.id))?.part.computed, w = g ? Tl(u.values, i.measure) - vf(g.values, i.measure, D) : 0;
    y.display = "flex", y.flex_direction = "col", y.items = "start", w > 0 && (D.style.mt = Math.round(((D.style.mt ?? 0) + w) * 100) / 100), k("approximated", "display", `${u.values.display} holding one ${D[Le]} box`, "(inline formatting)", "a column, the box lowered to the line's baseline");
  } else if (!y.display && T.length === 1 && (T[0].kind === "svg" || T[0].kind === "image") && T[0][Le] === "inline" && typeof T[0].style.h == "number") {
    const g = Ur(T, 0), w = Tl(u.values, i.measure), N = Nl(u.values, i.measure) - w, E = (O) => Math.round(O * 100) / 100;
    y.display = "flex", y.flex_direction = "col", y.items = "start", w > g.style.h && (g.style.mt = E((g.style.mt ?? 0) + w - g.style.h)), N > 0 && (g.style.mb = E((g.style.mb ?? 0) + N)), k("approximated", "display", `${u.values.display} holding one inline image`, "(inline formatting)", "a column, the image on the line's baseline");
  } else if (!y.display && A && F) {
    if (y.display = "flex", y.flex_direction = R ? "col" : "row", !R) y.items = "baseline";
    else {
      const g = (w) => T[w] && (T[w].kind === "text" || !/^(block|flex|grid|table|list-item)$/.test(T[w][Le] ?? "block"));
      for (let w = 0; w < T.length; w++) {
        if (T[w].kind === "text" || !/^inline-(block|flex)$/.test(T[w][Le])) continue;
        const N = Ur(T, w);
        if (N.style.self ??= "start", g(w - 1) || g(w + 1)) continue;
        const E = i.cache.get(n.childNodes.find((Q) => Q.id === N.id))?.part.computed, O = E ? Tl(u.values, i.measure) - vf(E.values, i.measure, N) : 0;
        O > 0 && (N.style.mt = Math.round(((N.style.mt ?? 0) + O) * 100) / 100);
      }
    }
    k("approximated", "display", `${u.values.display} with inline content`, "(inline formatting)", R ? "a column of its children" : "a row on the text baseline");
  }
  const h = u.values["letter-spacing"]?.px, b = u.values["overflow-x"] !== "visible";
  if (h)
    for (let g = 0; g < T.length; g++) {
      const w = T[g];
      if (w.kind !== "text") continue;
      const N = Math.round(h * [...w.text].length * 1e3) / 1e3;
      if (h > 0 || !b) {
        T[g] = { kind: "div", style: { pr: N }, tokens: {}, children: [w] };
        continue;
      }
      const E = u.values["font-size"], O = Math.max(0.8, 1 + h / (0.55 * E)), Q = Math.round(Nl(u.values, i.measure) * 1e3) / 1e3;
      T[g] = { kind: "div", style: { text_size: Math.round(E * O * 1e3) / 1e3, line_height: `${Q}px` }, tokens: {}, children: [w] };
    }
  return S.children = T, S;
}
function lb(n, l) {
  if (!l) return null;
  let o = (l.self ? n : l.closest ? Wf(n, l.closest) : l.find ? Cl(n, l.find)[0] : null)?.getAttribute(l.attr) ?? null;
  return o && l.strip && o.startsWith(l.strip) && (o = o.slice(l.strip.length)), o;
}
function rb(n, l, i) {
  const o = l.map((m) => [m, di(m.selector)]), s = /* @__PURE__ */ new Map(), u = (m) => {
    for (const f of m.children) {
      const p = i.get(f.id);
      if (p)
        for (const [x, _] of o) {
          const k = x.textRange ? "range_name" : "name";
          if (x.textRange && p[k] != null || !_.some((j) => hs(f, j))) continue;
          const y = lb(f, x.key), S = y == null ? s.get(x.name) ?? 0 : 0;
          y == null && s.set(x.name, S + 1);
          const z = y != null ? `${x.name}:${y}` : S ? `${x.name}@${S}` : x.name;
          p[k] == null ? p[k] = z : (p.also ??= []).push(z);
        }
      u(f);
    }
  };
  u(n.documentElement);
}
const ii = 0.9521, pm = 0.2256, Tl = (n, l) => (Nl(n, l) - (ii + pm) * n["font-size"]) / 2 + ii * n["font-size"];
function vf(n, l, i) {
  const o = (p) => p && typeof p == "object" && "px" in p ? p.px : 0, s = n["border-top-style"] === "none" ? 0 : o(n["border-top-width"]), u = i?.children ?? [], m = u.length === 1 && (u[0].kind === "svg" || u[0].kind === "image") && typeof u[0].style.h == "number" ? u[0] : null, f = m ? Math.max(Tl(n, l), (m.style.mt ?? 0) + m.style.h) : Tl(n, l);
  return o(n["padding-top"]) + s + f;
}
const yf = (n, l) => l === "uppercase" ? n.toUpperCase() : l === "lowercase" ? n.toLowerCase() : l === "capitalize" ? n.replace(/\b\p{L}/gu, (i) => i.toUpperCase()) : n, hm = /* @__PURE__ */ new Set(["children", "style", "className", "key", "ref", "dangerouslySetInnerHTML"]);
function ib(n) {
  const l = {};
  for (const [i, o] of Object.entries(n.props)) {
    if (hm.has(i) || typeof o == "function" || o === void 0 || o === null || typeof o == "object") continue;
    const s = i.startsWith("aria-") || i.startsWith("data-");
    if (o === !1 && !s) continue;
    const u = i === "htmlFor" ? "for" : i === "tabIndex" ? "tabindex" : i;
    l[u] = typeof o == "boolean" ? s ? String(o) : "" : String(o);
  }
  return { tag: n.tagName, classes: n.classList, attrs: l };
}
const ob = (n) => n === "className" ? "class" : /^(viewBox|preserveAspectRatio|gradientUnits|gradientTransform|patternUnits|xmlns)$/.test(n) ? n : n.replace(/[A-Z]/g, (l) => `-${l.toLowerCase()}`), xf = (n) => String(n).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
function sb(n) {
  if (n.props["data-perch-markup"]) return String(n.props["data-perch-markup"]);
  const l = (i) => {
    const o = [];
    for (const [u, m] of Object.entries(i.props))
      hm.has(u) || typeof m == "function" || m === void 0 || m === null || m === !1 || typeof m == "object" || u.startsWith("data-") || u.startsWith("aria-") || u === "focusable" || u === "role" || u === "title" || o.push(`${ob(u)}="${xf(m === !0 ? "" : m)}"`);
    i.tagName === "svg" && !i.props.xmlns && o.unshift('xmlns="http://www.w3.org/2000/svg"');
    const s = i.childNodes.map((u) => u instanceof fi ? xf(u.data) : l(u)).join("");
    return `<${i.tagName}${o.length ? ` ${o.join(" ")}` : ""}>${s}</${i.tagName}>`;
  };
  return l(n);
}
function cb(n) {
  const l = n.theme?.() ?? {}, i = {};
  for (const o of am) l[o] && (i[o] = l[o]);
  return i;
}
const ub = { font_features: "" };
function db(n, l, i, o = {}, s = null) {
  const u = cb(l), m = l.viewport?.() ?? { width: 1e3, height: 800 }, f = JSON.stringify([u, m]);
  (o.look !== f || o.sheet !== i) && Object.assign(o, { look: f, sheet: i, cache: /* @__PURE__ */ new WeakMap(), cascade: new Mg(i, { theme: u, viewport: m }), top: null });
  const { cascade: p, cache: x } = o, _ = new qg(), k = [], S = { cascade: p, cache: x, viewport: m, findings: _, log: k, add: (...A) => {
    k.push(A), _.add(...A);
  }, now: bs(), measure: l.lineHeight ? (A) => l.lineHeight(A) : null };
  o.top ??= p.compute(n.body, p.compute(n.documentElement, null));
  const z = n.body.children, j = z.map((A, R) => mm(A, o.top, ub, S, 0, R === 0, R === z.length - 1, R));
  if (s?.length) {
    const A = /* @__PURE__ */ new Map(), R = (B) => {
      B.id && (A.set(B.id, B), delete B.name, delete B.range_name, delete B.also);
      for (const Z of B.children ?? []) R(Z);
    };
    j.forEach(R), rb(n, s, A);
  }
  const T = /* @__PURE__ */ new Set();
  for (const A of [n, n.defaultView])
    for (const { type: R } of A?.listeners ?? []) ff[R] && T.add(ff[R]);
  return { schema: Og, root: j[0] ?? null, overlays: j.slice(1), document_events: [...T].sort(), unsupported: S.findings.list() };
}
const Ya = { layers: ["properties", "theme", "base", "utilities"], properties: { "--tw-translate-x": { inherits: !1, initial: "0" }, "--tw-translate-y": { inherits: !1, initial: "0" }, "--tw-translate-z": { inherits: !1, initial: "0" }, "--tw-rotate-x": { inherits: !1, initial: null }, "--tw-rotate-y": { inherits: !1, initial: null }, "--tw-rotate-z": { inherits: !1, initial: null }, "--tw-skew-x": { inherits: !1, initial: null }, "--tw-skew-y": { inherits: !1, initial: null }, "--tw-space-y-reverse": { inherits: !1, initial: "0" }, "--tw-border-style": { inherits: !1, initial: "solid" }, "--tw-leading": { inherits: !1, initial: null }, "--tw-font-weight": { inherits: !1, initial: null }, "--tw-tracking": { inherits: !1, initial: null }, "--tw-ordinal": { inherits: !1, initial: null }, "--tw-slashed-zero": { inherits: !1, initial: null }, "--tw-numeric-figure": { inherits: !1, initial: null }, "--tw-numeric-spacing": { inherits: !1, initial: null }, "--tw-numeric-fraction": { inherits: !1, initial: null }, "--tw-shadow": { inherits: !1, initial: "0 0 #0000" }, "--tw-shadow-color": { inherits: !1, initial: null }, "--tw-shadow-alpha": { inherits: !1, initial: "100%" }, "--tw-inset-shadow": { inherits: !1, initial: "0 0 #0000" }, "--tw-inset-shadow-color": { inherits: !1, initial: null }, "--tw-inset-shadow-alpha": { inherits: !1, initial: "100%" }, "--tw-ring-color": { inherits: !1, initial: null }, "--tw-ring-shadow": { inherits: !1, initial: "0 0 #0000" }, "--tw-inset-ring-color": { inherits: !1, initial: null }, "--tw-inset-ring-shadow": { inherits: !1, initial: "0 0 #0000" }, "--tw-ring-inset": { inherits: !1, initial: null }, "--tw-ring-offset-width": { inherits: !1, initial: "0" }, "--tw-ring-offset-color": { inherits: !1, initial: "#fff" }, "--tw-ring-offset-shadow": { inherits: !1, initial: "0 0 #0000" }, "--tw-outline-style": { inherits: !1, initial: "solid" }, "--tw-blur": { inherits: !1, initial: null }, "--tw-brightness": { inherits: !1, initial: null }, "--tw-contrast": { inherits: !1, initial: null }, "--tw-grayscale": { inherits: !1, initial: null }, "--tw-hue-rotate": { inherits: !1, initial: null }, "--tw-invert": { inherits: !1, initial: null }, "--tw-opacity": { inherits: !1, initial: null }, "--tw-saturate": { inherits: !1, initial: null }, "--tw-sepia": { inherits: !1, initial: null }, "--tw-drop-shadow": { inherits: !1, initial: null }, "--tw-drop-shadow-color": { inherits: !1, initial: null }, "--tw-drop-shadow-alpha": { inherits: !1, initial: "100%" }, "--tw-drop-shadow-size": { inherits: !1, initial: null }, "--tw-backdrop-blur": { inherits: !1, initial: null }, "--tw-backdrop-brightness": { inherits: !1, initial: null }, "--tw-backdrop-contrast": { inherits: !1, initial: null }, "--tw-backdrop-grayscale": { inherits: !1, initial: null }, "--tw-backdrop-hue-rotate": { inherits: !1, initial: null }, "--tw-backdrop-invert": { inherits: !1, initial: null }, "--tw-backdrop-opacity": { inherits: !1, initial: null }, "--tw-backdrop-saturate": { inherits: !1, initial: null }, "--tw-backdrop-sepia": { inherits: !1, initial: null }, "--tw-duration": { inherits: !1, initial: null }, "--tw-ease": { inherits: !1, initial: null }, "--tw-content": { inherits: !1, initial: '""' } }, rules: [[":root, :host", null, 2, [["--spacing", ".25rem"], ["--text-xs", ".75rem"], ["--text-xs--line-height", "calc(1 / .75)"], ["--text-sm", ".875rem"], ["--text-sm--line-height", "calc(1.25 / .875)"], ["--font-weight-normal", "400"], ["--font-weight-medium", "500"], ["--font-weight-semibold", "600"], ["--font-weight-bold", "700"], ["--tracking-normal", "0em"], ["--tracking-wide", ".025em"], ["--leading-tight", "1.25"], ["--leading-relaxed", "1.625"], ["--ease-out", "cubic-bezier(0, 0, .2, 1)"], ["--animate-pulse", "pulse 2s cubic-bezier(.4, 0, .6, 1) infinite"], ["--blur-xl", "24px"], ["--default-transition-duration", ".15s"], ["--default-transition-timing-function", "cubic-bezier(.4, 0, .2, 1)"], ["--animate-toast-in", "toast-in .2s cubic-bezier(.22, 1, .36, 1)"], ["--animate-host-pulse", "host-connecting-pulse 1.4s ease-in-out infinite"], ["--animate-drop-zone", "drop-zone-in .14s ease-out, drop-zone-pulse 1.2s ease-in-out .14s infinite"]]], ["::selection", null, 3, [["background", "var(--accent)"], ["color", "var(--panel-bg)"]]], [":where(input, textarea)::placeholder", null, 3, [["color", "var(--subtext-0)"], ["opacity", "1"]]], [":where(button, input, select, textarea)", null, 3, [["border", "0"]]], [':where(button, a[href], select, summary, [role="button"], [role="menuitem"]):focus-visible', null, 3, [["outline", "2px solid var(--accent)"], ["outline-offset", "-2px"]]], ["::-webkit-scrollbar", null, 3, [["width", "var(--scrollbar-size)"], ["height", "var(--scrollbar-size)"]]], ["::-webkit-scrollbar-track", null, 3, [["background", "none"]]], ["::-webkit-scrollbar-corner", null, 3, [["background", "none"]]], ["::-webkit-scrollbar-thumb", null, 3, [["background", "var(--text)"]]], ["::-webkit-scrollbar-thumb", null, 3, [["background", "color-mix(in srgb, var(--text) 20%, transparent)"]]], ["::-webkit-scrollbar-thumb", null, 3, [["border-radius", "var(--scrollbar-size)"]]], ["::-webkit-scrollbar-thumb:hover", null, 3, [["background", "var(--text)"]]], ["::-webkit-scrollbar-thumb:hover", null, 3, [["background", "color-mix(in srgb, var(--text) 40%, transparent)"]]], [".xterm .xterm-scrollable-element > .xterm-scrollbar > .xterm-slider", null, 3, [["border-radius", "var(--scrollbar-size)"]]], [".\\@container, .\\[container-type\\:inline-size\\]", null, 4, [["container-type", "inline-size"]]], [".pointer-events-auto", null, 4, [["pointer-events", "auto"]]], [".pointer-events-none", null, 4, [["pointer-events", "none"]]], [".collapse", null, 4, [["visibility", "collapse"]]], [".invisible", null, 4, [["visibility", "hidden"]]], [".visible", null, 4, [["visibility", "visible"]]], [".sr-only", null, 4, [["clip-path", "inset(50%)"], ["white-space", "nowrap"], ["border-width", "0"], ["width", "1px"], ["height", "1px"], ["margin", "-1px"], ["padding", "0"], ["position", "absolute"], ["overflow", "hidden"]]], [".absolute", null, 4, [["position", "absolute"]]], [".fixed", null, 4, [["position", "fixed"]]], [".relative", null, 4, [["position", "relative"]]], [".static", null, 4, [["position", "static"]]], [".sticky", null, 4, [["position", "sticky"]]], [".inset-0", null, 4, [["inset", "0"]]], [".inset-x-0", null, 4, [["inset-inline", "0"]]], [".inset-x-2", null, 4, [["inset-inline", "calc(var(--spacing) * 2)"]]], [".-top-1", null, 4, [["top", "calc(var(--spacing) * -1)"]]], [".-top-1\\.5", null, 4, [["top", "calc(var(--spacing) * -1.5)"]]], [".top-0", null, 4, [["top", "0"]]], [".top-1", null, 4, [["top", "var(--spacing)"]]], [".top-1\\.5", null, 4, [["top", "calc(var(--spacing) * 1.5)"]]], [".top-1\\/2", null, 4, [["top", "50%"]]], [".top-2", null, 4, [["top", "calc(var(--spacing) * 2)"]]], [".top-4", null, 4, [["top", "calc(var(--spacing) * 4)"]]], [".top-\\[0\\.1rem\\]", null, 4, [["top", ".1rem"]]], [".top-\\[7px\\]", null, 4, [["top", "7px"]]], [".top-\\[max\\(0\\.75rem\\,env\\(safe-area-inset-top\\)\\)\\]", null, 4, [["top", "max(.75rem, env(safe-area-inset-top))"]]], [".top-full", null, 4, [["top", "100%"]]], [".top-px", null, 4, [["top", "1px"]]], [".-right-1", null, 4, [["right", "calc(var(--spacing) * -1)"]]], [".-right-1\\.5", null, 4, [["right", "calc(var(--spacing) * -1.5)"]]], [".right-0", null, 4, [["right", "0"]]], [".right-1", null, 4, [["right", "var(--spacing)"]]], [".right-3", null, 4, [["right", "calc(var(--spacing) * 3)"]]], [".right-4", null, 4, [["right", "calc(var(--spacing) * 4)"]]], [".right-\\[0\\.8rem\\]", null, 4, [["right", ".8rem"]]], [".right-\\[0\\.25rem\\]", null, 4, [["right", ".25rem"]]], [".right-\\[max\\(0\\.75rem\\,env\\(safe-area-inset-right\\)\\)\\]", null, 4, [["right", "max(.75rem, env(safe-area-inset-right))"]]], [".right-full", null, 4, [["right", "100%"]]], [".bottom-0", null, 4, [["bottom", "0"]]], [".bottom-2", null, 4, [["bottom", "calc(var(--spacing) * 2)"]]], [".bottom-3", null, 4, [["bottom", "calc(var(--spacing) * 3)"]]], [".bottom-\\[0\\.8rem\\]", null, 4, [["bottom", ".8rem"]]], [".bottom-full", null, 4, [["bottom", "100%"]]], [".-left-8", null, 4, [["left", "calc(var(--spacing) * -8)"]]], [".-left-\\[2px\\]", null, 4, [["left", "-2px"]]], [".left-0", null, 4, [["left", "0"]]], [".left-2", null, 4, [["left", "calc(var(--spacing) * 2)"]]], [".left-\\[0\\.1rem\\]", null, 4, [["left", ".1rem"]]], [".left-\\[max\\(0\\.75rem\\,env\\(safe-area-inset-left\\)\\)\\]", null, 4, [["left", "max(.75rem, env(safe-area-inset-left))"]]], [".left-full", null, 4, [["left", "100%"]]], [".left-px", null, 4, [["left", "1px"]]], [".isolate", null, 4, [["isolation", "isolate"]]], [".z-4", null, 4, [["z-index", "4"]]], [".z-5", null, 4, [["z-index", "5"]]], [".z-10", null, 4, [["z-index", "10"]]], [".z-20", null, 4, [["z-index", "20"]]], [".z-30", null, 4, [["z-index", "30"]]], [".z-40", null, 4, [["z-index", "40"]]], [".z-50", null, 4, [["z-index", "50"]]], [".z-\\[2\\]", null, 4, [["z-index", "2"]]], [".z-\\[3\\]", null, 4, [["z-index", "3"]]], [".z-\\[5\\]", null, 4, [["z-index", "5"]]], [".z-\\[1000\\]", null, 4, [["z-index", "1000"]]], [".z-\\[2000\\]", null, 4, [["z-index", "2000"]]], [".z-\\[2100\\]", null, 4, [["z-index", "2100"]]], [".z-\\[2200\\]", null, 4, [["z-index", "2200"]]], [".z-\\[3000\\]", null, 4, [["z-index", "3000"]]], [".z-\\[3100\\]", null, 4, [["z-index", "3100"]]], [".z-\\[4000\\]", null, 4, [["z-index", "4000"]]], [".z-\\[9998\\]", null, 4, [["z-index", "9998"]]], [".z-\\[9999\\]", null, 4, [["z-index", "9999"]]], [".z-\\[10000\\]", null, 4, [["z-index", "10000"]]], [".z-auto", null, 4, [["z-index", "auto"]]], [".order-last", null, 4, [["order", "9999"]]], [".col-\\[1\\/-1\\]", null, 4, [["grid-column", "1 / -1"]]], [".container", null, 4, [["width", "100%"]]], [".container", ["(min-width: 40rem)"], 4, [["max-width", "40rem"]]], [".container", ["(min-width: 48rem)"], 4, [["max-width", "48rem"]]], [".container", ["(min-width: 64rem)"], 4, [["max-width", "64rem"]]], [".container", ["(min-width: 80rem)"], 4, [["max-width", "80rem"]]], [".container", ["(min-width: 96rem)"], 4, [["max-width", "96rem"]]], [".m-0", null, 4, [["margin", "0"]]], [".m-2", null, 4, [["margin", "calc(var(--spacing) * 2)"]]], [".m-\\[0\\.7rem\\]", null, 4, [["margin", ".7rem"]]], [".m-auto", null, 4, [["margin", "auto"]]], [".mx-0", null, 4, [["margin-inline", "0"]]], [".mx-0\\.5", null, 4, [["margin-inline", "calc(var(--spacing) * .5)"]]], [".mx-2", null, 4, [["margin-inline", "calc(var(--spacing) * 2)"]]], [".mx-3", null, 4, [["margin-inline", "calc(var(--spacing) * 3)"]]], [".mx-4", null, 4, [["margin-inline", "calc(var(--spacing) * 4)"]]], [".mx-\\[0\\.3rem\\]", null, 4, [["margin-inline", ".3rem"]]], [".mx-\\[0\\.7rem\\]", null, 4, [["margin-inline", ".7rem"]]], [".mx-\\[0\\.65rem\\]", null, 4, [["margin-inline", ".65rem"]]], [".mx-\\[3px\\]", null, 4, [["margin-inline", "3px"]]], [".mx-\\[11px\\]", null, 4, [["margin-inline", "11px"]]], [".mx-auto", null, 4, [["margin-inline", "auto"]]], [".my-0\\.5", null, 4, [["margin-block", "calc(var(--spacing) * .5)"]]], [".my-1", null, 4, [["margin-block", "var(--spacing)"]]], [".my-2", null, 4, [["margin-block", "calc(var(--spacing) * 2)"]]], [".my-\\[0\\.2rem\\]", null, 4, [["margin-block", ".2rem"]]], [".my-\\[0\\.3rem\\]", null, 4, [["margin-block", ".3rem"]]], [".my-\\[0\\.6rem\\]", null, 4, [["margin-block", ".6rem"]]], [".my-\\[0\\.28rem\\]", null, 4, [["margin-block", ".28rem"]]], [".my-\\[0\\.45rem\\]", null, 4, [["margin-block", ".45rem"]]], [".my-\\[0\\.55rem\\]", null, 4, [["margin-block", ".55rem"]]], [".my-\\[3px\\]", null, 4, [["margin-block", "3px"]]], [".-mt-\\[2px\\]", null, 4, [["margin-top", "-2px"]]], [".mt-0", null, 4, [["margin-top", "0"]]], [".mt-0\\.5", null, 4, [["margin-top", "calc(var(--spacing) * .5)"]]], [".mt-1", null, 4, [["margin-top", "var(--spacing)"]]], [".mt-1\\.5", null, 4, [["margin-top", "calc(var(--spacing) * 1.5)"]]], [".mt-2", null, 4, [["margin-top", "calc(var(--spacing) * 2)"]]], [".mt-3", null, 4, [["margin-top", "calc(var(--spacing) * 3)"]]], [".mt-4", null, 4, [["margin-top", "calc(var(--spacing) * 4)"]]], [".mt-\\[0\\.1rem\\]", null, 4, [["margin-top", ".1rem"]]], [".mt-\\[0\\.2rem\\]", null, 4, [["margin-top", ".2rem"]]], [".mt-\\[0\\.3rem\\]", null, 4, [["margin-top", ".3rem"]]], [".mt-\\[0\\.4rem\\]", null, 4, [["margin-top", ".4rem"]]], [".mt-\\[0\\.5rem\\]", null, 4, [["margin-top", ".5rem"]]], [".mt-\\[0\\.15rem\\]", null, 4, [["margin-top", ".15rem"]]], [".mt-\\[0\\.35rem\\]", null, 4, [["margin-top", ".35rem"]]], [".mr-1", null, 4, [["margin-right", "var(--spacing)"]]], [".mr-1\\.5", null, 4, [["margin-right", "calc(var(--spacing) * 1.5)"]]], [".mr-\\[0\\.3rem\\]", null, 4, [["margin-right", ".3rem"]]], [".mr-\\[0\\.7rem\\]", null, 4, [["margin-right", ".7rem"]]], [".mr-auto", null, 4, [["margin-right", "auto"]]], [".mb-0", null, 4, [["margin-bottom", "0"]]], [".mb-0\\.5", null, 4, [["margin-bottom", "calc(var(--spacing) * .5)"]]], [".mb-1", null, 4, [["margin-bottom", "var(--spacing)"]]], [".mb-2", null, 4, [["margin-bottom", "calc(var(--spacing) * 2)"]]], [".mb-3", null, 4, [["margin-bottom", "calc(var(--spacing) * 3)"]]], [".mb-4", null, 4, [["margin-bottom", "calc(var(--spacing) * 4)"]]], [".mb-8", null, 4, [["margin-bottom", "calc(var(--spacing) * 8)"]]], [".mb-\\[0\\.2rem\\]", null, 4, [["margin-bottom", ".2rem"]]], [".mb-\\[0\\.3rem\\]", null, 4, [["margin-bottom", ".3rem"]]], [".mb-\\[0\\.4rem\\]", null, 4, [["margin-bottom", ".4rem"]]], [".mb-\\[0\\.6rem\\]", null, 4, [["margin-bottom", ".6rem"]]], [".mb-\\[0\\.7rem\\]", null, 4, [["margin-bottom", ".7rem"]]], [".mb-\\[0\\.9rem\\]", null, 4, [["margin-bottom", ".9rem"]]], [".mb-\\[0\\.15rem\\]", null, 4, [["margin-bottom", ".15rem"]]], [".mb-\\[0\\.35rem\\]", null, 4, [["margin-bottom", ".35rem"]]], [".mb-\\[0\\.55rem\\]", null, 4, [["margin-bottom", ".55rem"]]], [".mb-\\[1\\.1rem\\]", null, 4, [["margin-bottom", "1.1rem"]]], [".-ml-0\\.5", null, 4, [["margin-left", "calc(var(--spacing) * -.5)"]]], [".-ml-1", null, 4, [["margin-left", "calc(var(--spacing) * -1)"]]], [".-ml-2", null, 4, [["margin-left", "calc(var(--spacing) * -2)"]]], [".ml-1", null, 4, [["margin-left", "var(--spacing)"]]], [".ml-2", null, 4, [["margin-left", "calc(var(--spacing) * 2)"]]], [".ml-\\[0\\.4rem\\]", null, 4, [["margin-left", ".4rem"]]], [".ml-\\[0\\.5rem\\]", null, 4, [["margin-left", ".5rem"]]], [".ml-\\[0\\.9rem\\]", null, 4, [["margin-left", ".9rem"]]], [".ml-\\[0\\.35rem\\]", null, 4, [["margin-left", ".35rem"]]], [".ml-\\[0\\.55rem\\]", null, 4, [["margin-left", ".55rem"]]], [".ml-\\[1\\.15rem\\]", null, 4, [["margin-left", "1.15rem"]]], [".ml-\\[1\\.45rem\\]", null, 4, [["margin-left", "1.45rem"]]], [".ml-\\[2\\.025rem\\]", null, 4, [["margin-left", "2.025rem"]]], [".ml-\\[2\\.375rem\\]", null, 4, [["margin-left", "2.375rem"]]], [".ml-\\[6\\.1rem\\]", null, 4, [["margin-left", "6.1rem"]]], [".ml-auto", null, 4, [["margin-left", "auto"]]], [".box-border", null, 4, [["box-sizing", "border-box"]]], [".\\!hidden", null, 4, [["display", "none", 1]]], [".\\[display\\:-webkit-box\\]", null, 4, [["display", "-webkit-box"]]], [".\\[display\\:var\\(--pane-grip\\,flex\\)\\]", null, 4, [["display", "var(--pane-grip, flex)"]]], [".block", null, 4, [["display", "block"]]], [".contents", null, 4, [["display", "contents"]]], [".flex", null, 4, [["display", "flex"]]], [".grid", null, 4, [["display", "grid"]]], [".hidden", null, 4, [["display", "none"]]], [".inline", null, 4, [["display", "inline"]]], [".inline-block", null, 4, [["display", "inline-block"]]], [".inline-flex", null, 4, [["display", "inline-flex"]]], [".table", null, 4, [["display", "table"]]], [".size-1", null, 4, [["width", "var(--spacing)"], ["height", "var(--spacing)"]]], [".size-1\\.5", null, 4, [["width", "calc(var(--spacing) * 1.5)"], ["height", "calc(var(--spacing) * 1.5)"]]], [".size-2", null, 4, [["width", "calc(var(--spacing) * 2)"], ["height", "calc(var(--spacing) * 2)"]]], [".size-3", null, 4, [["width", "calc(var(--spacing) * 3)"], ["height", "calc(var(--spacing) * 3)"]]], [".size-5", null, 4, [["width", "calc(var(--spacing) * 5)"], ["height", "calc(var(--spacing) * 5)"]]], [".size-6", null, 4, [["width", "calc(var(--spacing) * 6)"], ["height", "calc(var(--spacing) * 6)"]]], [".size-7", null, 4, [["width", "calc(var(--spacing) * 7)"], ["height", "calc(var(--spacing) * 7)"]]], [".size-8", null, 4, [["width", "calc(var(--spacing) * 8)"], ["height", "calc(var(--spacing) * 8)"]]], [".size-11", null, 4, [["width", "calc(var(--spacing) * 11)"], ["height", "calc(var(--spacing) * 11)"]]], [".size-14", null, 4, [["width", "calc(var(--spacing) * 14)"], ["height", "calc(var(--spacing) * 14)"]]], [".size-\\[0\\.6rem\\]", null, 4, [["width", ".6rem"], ["height", ".6rem"]]], [".size-\\[1\\.2rem\\]", null, 4, [["width", "1.2rem"], ["height", "1.2rem"]]], [".size-\\[5px\\]", null, 4, [["width", "5px"], ["height", "5px"]]], [".size-\\[14px\\]", null, 4, [["width", "14px"], ["height", "14px"]]], [".size-\\[calc\\(14px\\*var\\(--zoom\\,1\\)\\)\\]", null, 4, [["width", "calc(14px * var(--zoom, 1))"], ["height", "calc(14px * var(--zoom, 1))"]]], [".size-full", null, 4, [["width", "100%"], ["height", "100%"]]], [".h-1", null, 4, [["height", "var(--spacing)"]]], [".h-1\\.5", null, 4, [["height", "calc(var(--spacing) * 1.5)"]]], [".h-2", null, 4, [["height", "calc(var(--spacing) * 2)"]]], [".h-3", null, 4, [["height", "calc(var(--spacing) * 3)"]]], [".h-4", null, 4, [["height", "calc(var(--spacing) * 4)"]]], [".h-5", null, 4, [["height", "calc(var(--spacing) * 5)"]]], [".h-6", null, 4, [["height", "calc(var(--spacing) * 6)"]]], [".h-7", null, 4, [["height", "calc(var(--spacing) * 7)"]]], [".h-8", null, 4, [["height", "calc(var(--spacing) * 8)"]]], [".h-9", null, 4, [["height", "calc(var(--spacing) * 9)"]]], [".h-11", null, 4, [["height", "calc(var(--spacing) * 11)"]]], [".h-12", null, 4, [["height", "calc(var(--spacing) * 12)"]]], [".h-44", null, 4, [["height", "calc(var(--spacing) * 44)"]]], [".h-\\[1\\.1rem\\]", null, 4, [["height", "1.1rem"]]], [".h-\\[1\\.3rem\\]", null, 4, [["height", "1.3rem"]]], [".h-\\[1\\.4rem\\]", null, 4, [["height", "1.4rem"]]], [".h-\\[1\\.25rem\\]", null, 4, [["height", "1.25rem"]]], [".h-\\[2px\\]", null, 4, [["height", "2px"]]], [".h-\\[14px\\]", null, 4, [["height", "14px"]]], [".h-\\[18px\\]", null, 4, [["height", "18px"]]], [".h-\\[43px\\]", null, 4, [["height", "43px"]]], [".h-\\[calc\\(100\\%-max\\(0\\.5rem\\,env\\(safe-area-inset-top\\)\\)\\)\\]", null, 4, [["height", "calc(100% - max(.5rem, env(safe-area-inset-top)))"]]], [".h-full", null, 4, [["height", "100%"]]], [".h-px", null, 4, [["height", "1px"]]], [".max-h-40", null, 4, [["max-height", "calc(var(--spacing) * 40)"]]], [".max-h-56", null, 4, [["max-height", "calc(var(--spacing) * 56)"]]], [".max-h-72", null, 4, [["max-height", "calc(var(--spacing) * 72)"]]], [".max-h-\\[8rem\\]", null, 4, [["max-height", "8rem"]]], [".max-h-\\[13rem\\]", null, 4, [["max-height", "13rem"]]], [".max-h-\\[30\\%\\]", null, 4, [["max-height", "30%"]]], [".max-h-\\[30vh\\]", null, 4, [["max-height", "30vh"]]], [".max-h-\\[35vh\\]", null, 4, [["max-height", "35vh"]]], [".max-h-\\[40\\%\\]", null, 4, [["max-height", "40%"]]], [".max-h-\\[50dvh\\]", null, 4, [["max-height", "50dvh"]]], [".max-h-\\[60\\%\\]", null, 4, [["max-height", "60%"]]], [".max-h-\\[70\\%\\]", null, 4, [["max-height", "70%"]]], [".max-h-\\[85vh\\]", null, 4, [["max-height", "85vh"]]], [".max-h-\\[90\\%\\]", null, 4, [["max-height", "90%"]]], [".max-h-\\[190px\\]", null, 4, [["max-height", "190px"]]], [".max-h-\\[240px\\]", null, 4, [["max-height", "240px"]]], [".max-h-\\[260px\\]", null, 4, [["max-height", "260px"]]], [".max-h-\\[calc\\(85vh-4rem\\)\\]", null, 4, [["max-height", "calc(85vh - 4rem)"]]], [".max-h-\\[calc\\(100dvh_-_4rem\\)\\]", null, 4, [["max-height", "calc(100dvh - 4rem)"]]], [".max-h-\\[min\\(420px\\,calc\\(100dvh_-_16vh_-_2rem\\)\\)\\]", null, 4, [["max-height", "min(420px, 100dvh - 16vh - 2rem)"]]], [".max-h-\\[min\\(480px\\,calc\\(100dvh_-_16vh_-_2rem\\)\\)\\]", null, 4, [["max-height", "min(480px, 100dvh - 16vh - 2rem)"]]], [".max-h-full", null, 4, [["max-height", "100%"]]], [".min-h-0", null, 4, [["min-height", "0"]]], [".min-h-6", null, 4, [["min-height", "calc(var(--spacing) * 6)"]]], [".min-h-7", null, 4, [["min-height", "calc(var(--spacing) * 7)"]]], [".min-h-8", null, 4, [["min-height", "calc(var(--spacing) * 8)"]]], [".min-h-9", null, 4, [["min-height", "calc(var(--spacing) * 9)"]]], [".min-h-10", null, 4, [["min-height", "calc(var(--spacing) * 10)"]]], [".min-h-11", null, 4, [["min-height", "calc(var(--spacing) * 11)"]]], [".min-h-20", null, 4, [["min-height", "calc(var(--spacing) * 20)"]]], [".min-h-40", null, 4, [["min-height", "calc(var(--spacing) * 40)"]]], [".min-h-\\[1\\.5em\\]", null, 4, [["min-height", "1.5em"]]], [".min-h-\\[1\\.8rem\\]", null, 4, [["min-height", "1.8rem"]]], [".min-h-\\[2\\.5rem\\]", null, 4, [["min-height", "2.5rem"]]], [".min-h-\\[3\\.2rem\\]", null, 4, [["min-height", "3.2rem"]]], [".min-h-\\[3\\.25rem\\]", null, 4, [["min-height", "3.25rem"]]], [".min-h-\\[6rem\\]", null, 4, [["min-height", "6rem"]]], [".min-h-\\[8rem\\]", null, 4, [["min-height", "8rem"]]], [".min-h-\\[10rem\\]", null, 4, [["min-height", "10rem"]]], [".min-h-\\[12rem\\]", null, 4, [["min-height", "12rem"]]], [".min-h-\\[13rem\\]", null, 4, [["min-height", "13rem"]]], [".min-h-\\[32px\\]", null, 4, [["min-height", "32px"]]], [".min-h-\\[44px\\]", null, 4, [["min-height", "44px"]]], [".min-h-\\[60px\\]", null, 4, [["min-height", "60px"]]], [".min-h-\\[100dvh\\]", null, 4, [["min-height", "100dvh"]]], [".min-h-\\[calc\\(22px\\*var\\(--zoom\\,1\\)\\)\\]", null, 4, [["min-height", "calc(22px * var(--zoom, 1))"]]], [".min-h-full", null, 4, [["min-height", "100%"]]], [".w-2", null, 4, [["width", "calc(var(--spacing) * 2)"]]], [".w-2\\.5", null, 4, [["width", "calc(var(--spacing) * 2.5)"]]], [".w-3", null, 4, [["width", "calc(var(--spacing) * 3)"]]], [".w-4", null, 4, [["width", "calc(var(--spacing) * 4)"]]], [".w-5", null, 4, [["width", "calc(var(--spacing) * 5)"]]], [".w-7", null, 4, [["width", "calc(var(--spacing) * 7)"]]], [".w-8", null, 4, [["width", "calc(var(--spacing) * 8)"]]], [".w-9", null, 4, [["width", "calc(var(--spacing) * 9)"]]], [".w-10", null, 4, [["width", "calc(var(--spacing) * 10)"]]], [".w-20", null, 4, [["width", "calc(var(--spacing) * 20)"]]], [".w-40", null, 4, [["width", "calc(var(--spacing) * 40)"]]], [".w-44", null, 4, [["width", "calc(var(--spacing) * 44)"]]], [".w-60", null, 4, [["width", "calc(var(--spacing) * 60)"]]], [".w-\\[1\\.1rem\\]", null, 4, [["width", "1.1rem"]]], [".w-\\[1\\.4rem\\]", null, 4, [["width", "1.4rem"]]], [".w-\\[1\\.6rem\\]", null, 4, [["width", "1.6rem"]]], [".w-\\[1\\.25rem\\]", null, 4, [["width", "1.25rem"]]], [".w-\\[2\\.4rem\\]", null, 4, [["width", "2.4rem"]]], [".w-\\[2\\.25rem\\]", null, 4, [["width", "2.25rem"]]], [".w-\\[6rem\\]", null, 4, [["width", "6rem"]]], [".w-\\[7rem\\]", null, 4, [["width", "7rem"]]], [".w-\\[11rem\\]", null, 4, [["width", "11rem"]]], [".w-\\[15rem\\]", null, 4, [["width", "15rem"]]], [".w-\\[16rem\\]", null, 4, [["width", "16rem"]]], [".w-\\[18px\\]", null, 4, [["width", "18px"]]], [".w-\\[100cqi\\]", null, 4, [["width", "100cqi"]]], [".w-\\[calc\\(\\(100\\%-0\\.875rem\\)\\/8\\)\\]", null, 4, [["width", "calc(12.5% - .109375rem)"]]], [".w-\\[calc\\(100\\%_-_0\\.6rem\\)\\]", null, 4, [["width", "calc(100% - .6rem)"]]], [".w-\\[calc\\(100\\%_-_1rem\\)\\]", null, 4, [["width", "calc(100% - 1rem)"]]], [".w-\\[min\\(22rem\\,calc\\(100vw-3rem\\)\\)\\]", null, 4, [["width", "min(22rem, 100vw - 3rem)"]]], [".w-\\[min\\(26rem\\,100\\%\\)\\]", null, 4, [["width", "min(26rem, 100%)"]]], [".w-\\[min\\(28rem\\,calc\\(100vw-2\\.5rem\\)\\)\\]", null, 4, [["width", "min(28rem, 100vw - 2.5rem)"]]], [".w-\\[min\\(30rem\\,92vw\\)\\]", null, 4, [["width", "min(30rem, 92vw)"]]], [".w-\\[min\\(32rem\\,100\\%\\)\\]", null, 4, [["width", "min(32rem, 100%)"]]], [".w-\\[min\\(340px\\,calc\\(100vw-16px\\)\\)\\]", null, 4, [["width", "min(340px, 100vw - 16px)"]]], [".w-\\[min\\(360px\\,calc\\(100vw_-_2rem\\)\\)\\]", null, 4, [["width", "min(360px, 100vw - 2rem)"]]], [".w-\\[min\\(420px\\,calc\\(100vw_-_16px\\)\\)\\]", null, 4, [["width", "min(420px, 100vw - 16px)"]]], [".w-\\[min\\(480px\\,calc\\(100vw_-_2rem\\)\\)\\]", null, 4, [["width", "min(480px, 100vw - 2rem)"]]], [".w-\\[min\\(560px\\,calc\\(100vw_-_2rem\\)\\)\\]", null, 4, [["width", "min(560px, 100vw - 2rem)"]]], [".w-\\[var\\(--sidebar-width\\,240px\\)\\]", null, 4, [["width", "var(--sidebar-width, 240px)"]]], [".w-\\[var\\(--tools-width\\)\\]", null, 4, [["width", "var(--tools-width)"]]], [".w-auto", null, 4, [["width", "auto"]]], [".w-full", null, 4, [["width", "100%"]]], [".w-px", null, 4, [["width", "1px"]]], [".max-w-24", null, 4, [["max-width", "calc(var(--spacing) * 24)"]]], [".max-w-32", null, 4, [["max-width", "calc(var(--spacing) * 32)"]]], [".max-w-\\[9rem\\]", null, 4, [["max-width", "9rem"]]], [".max-w-\\[10rem\\]", null, 4, [["max-width", "10rem"]]], [".max-w-\\[14rem\\]", null, 4, [["max-width", "14rem"]]], [".max-w-\\[16rem\\]", null, 4, [["max-width", "16rem"]]], [".max-w-\\[24rem\\]", null, 4, [["max-width", "24rem"]]], [".max-w-\\[25\\%\\]", null, 4, [["max-width", "25%"]]], [".max-w-\\[26rem\\]", null, 4, [["max-width", "26rem"]]], [".max-w-\\[28rem\\]", null, 4, [["max-width", "28rem"]]], [".max-w-\\[35\\%\\]", null, 4, [["max-width", "35%"]]], [".max-w-\\[38\\%\\]", null, 4, [["max-width", "38%"]]], [".max-w-\\[45\\%\\]", null, 4, [["max-width", "45%"]]], [".max-w-\\[46rem\\]", null, 4, [["max-width", "46rem"]]], [".max-w-\\[55\\%\\]", null, 4, [["max-width", "55%"]]], [".max-w-\\[56rem\\]", null, 4, [["max-width", "56rem"]]], [".max-w-\\[85\\%\\]", null, 4, [["max-width", "85%"]]], [".max-w-\\[140px\\]", null, 4, [["max-width", "140px"]]], [".max-w-\\[320px\\]", null, 4, [["max-width", "320px"]]], [".max-w-\\[min\\(22rem\\,calc\\(100\\%-1\\.5rem\\)\\)\\]", null, 4, [["max-width", "min(22rem, 100% - 1.5rem)"]]], [".max-w-\\[min\\(30rem\\,calc\\(100\\%-1\\.6rem\\)\\)\\]", null, 4, [["max-width", "min(30rem, 100% - 1.6rem)"]]], [".max-w-\\[min\\(34rem\\,calc\\(100\\%-1\\.5rem\\)\\)\\]", null, 4, [["max-width", "min(34rem, 100% - 1.5rem)"]]], [".max-w-\\[min\\(320px\\,calc\\(100vw_-_24px\\)\\)\\]", null, 4, [["max-width", "min(320px, 100vw - 24px)"]]], [".max-w-full", null, 4, [["max-width", "100%"]]], [".max-w-none", null, 4, [["max-width", "none"]]], [".min-w-0", null, 4, [["min-width", "0"]]], [".min-w-6", null, 4, [["min-width", "calc(var(--spacing) * 6)"]]], [".min-w-8", null, 4, [["min-width", "calc(var(--spacing) * 8)"]]], [".min-w-12", null, 4, [["min-width", "calc(var(--spacing) * 12)"]]], [".min-w-24", null, 4, [["min-width", "calc(var(--spacing) * 24)"]]], [".min-w-36", null, 4, [["min-width", "calc(var(--spacing) * 36)"]]], [".min-w-56", null, 4, [["min-width", "calc(var(--spacing) * 56)"]]], [".min-w-\\[5\\.5rem\\]", null, 4, [["min-width", "5.5rem"]]], [".min-w-\\[7rem\\]", null, 4, [["min-width", "7rem"]]], [".min-w-\\[12rem\\]", null, 4, [["min-width", "12rem"]]], [".min-w-\\[14px\\]", null, 4, [["min-width", "14px"]]], [".min-w-\\[200px\\]", null, 4, [["min-width", "200px"]]], [".min-w-fit", null, 4, [["min-width", "fit-content"]]], [".min-w-max", null, 4, [["min-width", "max-content"]]], [".flex-1", null, 4, [["flex", "1"]]], [".flex-\\[0_0_5rem\\]", null, 4, [["flex", "0 0 5rem"]]], [".flex-\\[0_0_8px\\]", null, 4, [["flex", "0 0 8px"]]], [".flex-\\[0_1_40\\%\\]", null, 4, [["flex", "0 40%"]]], [".flex-\\[1_1_100\\%\\]", null, 4, [["flex", "100%"]]], [".flex-\\[2\\]", null, 4, [["flex", "2"]]], [".flex-initial", null, 4, [["flex", "0 auto"]]], [".flex-none", null, 4, [["flex", "none"]]], [".shrink", null, 4, [["flex-shrink", "1"]]], [".shrink-0", null, 4, [["flex-shrink", "0"]]], [".shrink-\\[0\\.001\\]", null, 4, [["flex-shrink", ".001"]]], [".shrink-\\[2\\]", null, 4, [["flex-shrink", "2"]]], [".shrink-\\[3\\]", null, 4, [["flex-shrink", "3"]]], [".grow", null, 4, [["flex-grow", "1"]]], [".basis-0", null, 4, [["flex-basis", "0"]]], [".basis-\\[14rem\\]", null, 4, [["flex-basis", "14rem"]]], [".-translate-y-1\\/2", null, 4, [["--tw-translate-y", "calc(calc(1 / 2 * 100%) * -1)"], ["translate", "var(--tw-translate-x) var(--tw-translate-y)"]]], [".\\[transform\\:translateY\\(-50\\%\\)\\]", null, 4, [["transform", "translateY(-50%)"]]], [".transform", null, 4, [["transform", "var(--tw-rotate-x, ) var(--tw-rotate-y, ) var(--tw-rotate-z, ) var(--tw-skew-x, ) var(--tw-skew-y, )"]]], [".animate-drop-zone", null, 4, [["animation", "var(--animate-drop-zone)"]]], [".animate-host-pulse", null, 4, [["animation", "var(--animate-host-pulse)"]]], [".animate-pulse", null, 4, [["animation", "var(--animate-pulse)"]]], [".animate-toast-in", null, 4, [["animation", "var(--animate-toast-in)"]]], [".cursor-col-resize", null, 4, [["cursor", "col-resize"]]], [".cursor-default", null, 4, [["cursor", "default"]]], [".cursor-grab", null, 4, [["cursor", "grab"]]], [".cursor-grabbing", null, 4, [["cursor", "grabbing"]]], [".cursor-pointer", null, 4, [["cursor", "pointer"]]], [".cursor-row-resize", null, 4, [["cursor", "row-resize"]]], [".touch-none", null, 4, [["touch-action", "none"]]], [".resize", null, 4, [["resize", "both"]]], [".resize-none", null, 4, [["resize", "none"]]], [".resize-y", null, 4, [["resize", "vertical"]]], [".\\[scrollbar-width\\:none\\]", null, 4, [["scrollbar-width", "none"]]], [".list-disc", null, 4, [["list-style-type", "disc"]]], [".list-none", null, 4, [["list-style-type", "none"]]], [".appearance-none", null, 4, [["appearance", "none"]]], [".grid-cols-8", null, 4, [["grid-template-columns", "repeat(8, minmax(0, 1fr))"]]], [".grid-cols-\\[1fr_auto_1fr\\]", null, 4, [["grid-template-columns", "1fr auto 1fr"]]], [".grid-cols-\\[2\\.5rem_2\\.5rem_0\\.9rem_minmax\\(0\\,1fr\\)\\]", null, 4, [["grid-template-columns", "2.5rem 2.5rem .9rem minmax(0, 1fr)"]]], [".grid-cols-\\[auto_minmax\\(0\\,1fr\\)\\]", null, 4, [["grid-template-columns", "auto minmax(0, 1fr)"]]], [".grid-cols-\\[minmax\\(4rem\\,10rem\\)_1fr_auto\\]", null, 4, [["grid-template-columns", "minmax(4rem, 10rem) 1fr auto"]]], [".grid-cols-\\[repeat\\(2\\,minmax\\(0\\,1fr\\)\\)\\]", null, 4, [["grid-template-columns", "repeat(2, minmax(0, 1fr))"]]], [".grid-cols-\\[repeat\\(auto-fit\\,minmax\\(8rem\\,1fr\\)\\)\\]", null, 4, [["grid-template-columns", "repeat(auto-fit, minmax(8rem, 1fr))"]]], [".flex-col", null, 4, [["flex-direction", "column"]]], [".flex-row", null, 4, [["flex-direction", "row"]]], [".flex-wrap", null, 4, [["flex-wrap", "wrap"]]], [".place-items-center", null, 4, [["place-items", "center"]]], [".content-center", null, 4, [["align-content", "center"]]], [".items-baseline", null, 4, [["align-items", "baseline"]]], [".items-center", null, 4, [["align-items", "center"]]], [".items-end", null, 4, [["align-items", "flex-end"]]], [".items-start", null, 4, [["align-items", "flex-start"]]], [".items-stretch", null, 4, [["align-items", "stretch"]]], [".justify-between", null, 4, [["justify-content", "space-between"]]], [".justify-center", null, 4, [["justify-content", "center"]]], [".justify-end", null, 4, [["justify-content", "flex-end"]]], [".justify-start", null, 4, [["justify-content", "flex-start"]]], [".justify-items-center", null, 4, [["justify-items", "center"]]], [".justify-items-start", null, 4, [["justify-items", "start"]]], [".gap-0", null, 4, [["gap", "0"]]], [".gap-0\\.5", null, 4, [["gap", "calc(var(--spacing) * .5)"]]], [".gap-1", null, 4, [["gap", "var(--spacing)"]]], [".gap-1\\.5", null, 4, [["gap", "calc(var(--spacing) * 1.5)"]]], [".gap-2", null, 4, [["gap", "calc(var(--spacing) * 2)"]]], [".gap-3", null, 4, [["gap", "calc(var(--spacing) * 3)"]]], [".gap-4", null, 4, [["gap", "calc(var(--spacing) * 4)"]]], [".gap-6", null, 4, [["gap", "calc(var(--spacing) * 6)"]]], [".gap-\\[0\\.1rem\\]", null, 4, [["gap", ".1rem"]]], [".gap-\\[0\\.3rem\\]", null, 4, [["gap", ".3rem"]]], [".gap-\\[0\\.4rem\\]", null, 4, [["gap", ".4rem"]]], [".gap-\\[0\\.05rem\\]", null, 4, [["gap", ".05rem"]]], [".gap-\\[0\\.6rem\\]", null, 4, [["gap", ".6rem"]]], [".gap-\\[0\\.8rem\\]", null, 4, [["gap", ".8rem"]]], [".gap-\\[0\\.16rem\\]", null, 4, [["gap", ".16rem"]]], [".gap-\\[0\\.32rem\\]", null, 4, [["gap", ".32rem"]]], [".gap-\\[0\\.35rem\\]", null, 4, [["gap", ".35rem"]]], [".gap-\\[0\\.45rem\\]", null, 4, [["gap", ".45rem"]]], [".gap-\\[0\\.55rem\\]", null, 4, [["gap", ".55rem"]]], [".gap-\\[0\\.65rem\\]", null, 4, [["gap", ".65rem"]]], [".gap-\\[0\\.85rem\\]", null, 4, [["gap", ".85rem"]]], [".gap-\\[1px\\]", null, 4, [["gap", "1px"]]], [".gap-\\[2px\\]", null, 4, [["gap", "2px"]]], [".gap-\\[3px\\]", null, 4, [["gap", "3px"]]], [".gap-\\[7px\\]", null, 4, [["gap", "7px"]]], [".gap-\\[13px\\]", null, 4, [["gap", "13px"]]], [":where(.space-y-0\\.5 > :not(:last-child))", null, 4, [["--tw-space-y-reverse", "0"], ["margin-block-start", "calc(calc(var(--spacing) * .5) * var(--tw-space-y-reverse))"], ["margin-block-end", "calc(calc(var(--spacing) * .5) * calc(1 - var(--tw-space-y-reverse)))"]]], [".gap-x-3", null, 4, [["column-gap", "calc(var(--spacing) * 3)"]]], [".gap-x-4", null, 4, [["column-gap", "calc(var(--spacing) * 4)"]]], [".gap-x-\\[0\\.7rem\\]", null, 4, [["column-gap", ".7rem"]]], [".gap-x-\\[0\\.9rem\\]", null, 4, [["column-gap", ".9rem"]]], [".gap-y-1", null, 4, [["row-gap", "var(--spacing)"]]], [".gap-y-\\[0\\.3rem\\]", null, 4, [["row-gap", ".3rem"]]], [".self-center", null, 4, [["align-self", "center"]]], [".self-end", null, 4, [["align-self", "flex-end"]]], [".self-start", null, 4, [["align-self", "flex-start"]]], [".self-stretch", null, 4, [["align-self", "stretch"]]], [".justify-self-start", null, 4, [["justify-self", "flex-start"]]], [".truncate", null, 4, [["text-overflow", "ellipsis"], ["white-space", "nowrap"], ["overflow", "hidden"]]], [".overflow-auto", null, 4, [["overflow", "auto"]]], [".overflow-hidden", null, 4, [["overflow", "hidden"]]], [".overflow-visible", null, 4, [["overflow", "visible"]]], [".overflow-x-auto", null, 4, [["overflow-x", "auto"]]], [".overflow-y-auto", null, 4, [["overflow-y", "auto"]]], [".overscroll-contain", null, 4, [["overscroll-behavior", "contain"]]], [".rounded, .rounded-\\[0\\.25rem\\]", null, 4, [["border-radius", ".25rem"]]], [".rounded-\\[1\\.5rem\\]", null, 4, [["border-radius", "1.5rem"]]], [".rounded-\\[2px\\]", null, 4, [["border-radius", "2px"]]], [".rounded-\\[3px\\]", null, 4, [["border-radius", "3px"]]], [".rounded-\\[12px\\]", null, 4, [["border-radius", "12px"]]], [".rounded-\\[50\\%\\]", null, 4, [["border-radius", "50%"]]], [".rounded-\\[999px\\]", null, 4, [["border-radius", "999px"]]], [".rounded-\\[calc\\(var\\(--radius\\)\\*2\\)\\]", null, 4, [["border-radius", "calc(var(--radius) * 2)"]]], [".rounded-\\[var\\(--card-radius\\,8px\\)\\]", null, 4, [["border-radius", "var(--card-radius, 8px)"]]], [".rounded-\\[var\\(--card-radius\\,12px\\)\\]", null, 4, [["border-radius", "var(--card-radius, 12px)"]]], [".rounded-full", null, 4, [["border-radius", "3.40282e38px"]]], [".rounded-none", null, 4, [["border-radius", "0"]]], [".rounded-soft", null, 4, [["border-radius", "var(--radius-pane)"]]], [".rounded-ui", null, 4, [["border-radius", "var(--radius)"]]], [".rounded-t-\\[12px\\]", null, 4, [["border-top-left-radius", "12px"], ["border-top-right-radius", "12px"]]], [".rounded-t-none", null, 4, [["border-top-left-radius", "0"], ["border-top-right-radius", "0"]]], [".rounded-bl-\\[6px\\]", null, 4, [["border-bottom-left-radius", "6px"]]], [".border", null, 4, [["border-style", "var(--tw-border-style)"], ["border-width", "1px"]]], [".border-0", null, 4, [["border-style", "var(--tw-border-style)"], ["border-width", "0"]]], [".border-\\[1\\.5px\\]", null, 4, [["border-style", "var(--tw-border-style)"], ["border-width", "1.5px"]]], [".border-b", null, 4, [["border-bottom-style", "var(--tw-border-style)"], ["border-bottom-width", "1px"]]], [".border-l", null, 4, [["border-left-style", "var(--tw-border-style)"], ["border-left-width", "1px"]]], [".border-l-\\[3px\\]", null, 4, [["border-left-style", "var(--tw-border-style)"], ["border-left-width", "3px"]]], [".border-solid", null, 4, [["--tw-border-style", "solid"], ["border-style", "solid"]]], [".border-accent", null, 4, [["border-color", "var(--accent)"]]], [".border-overlay-0", null, 4, [["border-color", "var(--overlay-0)"]]], [".border-overlay-1", null, 4, [["border-color", "var(--overlay-1)"]]], [".border-red", null, 4, [["border-color", "var(--red)"]]], [".border-subtext-0", null, 4, [["border-color", "var(--subtext-0)"]]], [".border-surface-1", null, 4, [["border-color", "var(--surface-1)"]]], [".border-teal", null, 4, [["border-color", "var(--teal)"]]], [".border-yellow", null, 4, [["border-color", "var(--yellow)"]]], [".border-l-accent", null, 4, [["border-left-color", "var(--accent)"]]], [".border-l-green", null, 4, [["border-left-color", "var(--green)"]]], [".border-l-red", null, 4, [["border-left-color", "var(--red)"]]], [".border-l-yellow", null, 4, [["border-left-color", "var(--yellow)"]]], [".bg-\\[\\#161616\\]", null, 4, [["background-color", "#161616"]]], [".bg-\\[\\#fff\\]", null, 4, [["background-color", "#fff"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_8\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "var(--accent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_8\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--accent) 8%,var(--panel-bg))"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_12\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--accent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_12\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--accent) 12%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--accent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--accent) 15%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--blue\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--blue)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--blue\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--blue) 15%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--green\\)_9\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--green)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--green\\)_9\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--green) 9%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--red\\)_7\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--red)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--red\\)_7\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--red) 7%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--red\\)_9\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--red)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--red\\)_9\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--red) 9%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--surface-1\\)_42\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--surface-1\\)_42\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--surface-1) 42%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--surface-1\\)_70\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--surface-1\\)_70\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--surface-1) 70%,var(--panel-bg))"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--text\\)_10\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "var(--text)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--text\\)_10\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--text) 10%,var(--panel-bg))"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--yellow\\)_8\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--yellow)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--yellow\\)_8\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--yellow) 8%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--yellow\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--yellow)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--yellow\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--yellow) 15%,transparent)"]]], [".bg-\\[rgba\\(0\\,0\\,0\\,0\\.5\\)\\]", null, 4, [["background-color", "#00000080"]]], [".bg-\\[rgba\\(0\\,0\\,0\\,0\\.7\\)\\]", null, 4, [["background-color", "#000000b3"]]], [".bg-\\[rgba\\(0\\,0\\,0\\,0\\.55\\)\\]", null, 4, [["background-color", "#0000008c"]]], [".bg-\\[rgba\\(0\\,0\\,0\\,0\\.62\\)\\]", null, 4, [["background-color", "#0000009e"]]], [".bg-\\[var\\(--accent\\)\\]", null, 4, [["background-color", "var(--accent)"]]], [".bg-\\[var\\(--backdrop\\)\\]", null, 4, [["background-color", "var(--backdrop)"]]], [".bg-\\[var\\(--bg\\)\\]", null, 4, [["background-color", "var(--bg)"]]], [".bg-\\[var\\(--card-bg\\)\\]", null, 4, [["background-color", "var(--card-bg)"]]], [".bg-\\[var\\(--picker-bg\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "var(--picker-bg, var(--panel-bg))"]]], [".bg-\\[var\\(--surface-1\\)\\]", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-\\[var\\(--workspace-tools-bg\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "var(--workspace-tools-bg, var(--panel-bg))"]]], [".bg-accent, .bg-accent\\/10", null, 4, [["background-color", "var(--accent)"]]], [".bg-accent\\/10", null, 4, [["background-color", "color-mix(in oklab, var(--accent) 10%, transparent)"]]], [".bg-accent\\/35", null, 4, [["background-color", "var(--accent)"]]], [".bg-accent\\/35", null, 4, [["background-color", "color-mix(in oklab, var(--accent) 35%, transparent)"]]], [".bg-fg", null, 4, [["background-color", "var(--text)"]]], [".bg-green, .bg-green\\/15", null, 4, [["background-color", "var(--green)"]]], [".bg-green\\/15", null, 4, [["background-color", "color-mix(in oklab, var(--green) 15%, transparent)"]]], [".bg-overlay-0", null, 4, [["background-color", "var(--overlay-0)"]]], [".bg-overlay-1", null, 4, [["background-color", "var(--overlay-1)"]]], [".bg-panel-bg", null, 4, [["background-color", "var(--panel-bg)"]]], [".bg-red, .bg-red\\/15", null, 4, [["background-color", "var(--red)"]]], [".bg-red\\/15", null, 4, [["background-color", "color-mix(in oklab, var(--red) 15%, transparent)"]]], [".bg-subtext-0", null, 4, [["background-color", "var(--subtext-0)"]]], [".bg-surface-0", null, 4, [["background-color", "var(--surface-0)"]]], [".bg-surface-1, .bg-surface-1\\/30", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-surface-1\\/30", null, 4, [["background-color", "color-mix(in oklab, var(--surface-1) 30%, transparent)"]]], [".bg-surface-1\\/60", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-surface-1\\/60", null, 4, [["background-color", "color-mix(in oklab, var(--surface-1) 60%, transparent)"]]], [".bg-surface-1\\/70", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-surface-1\\/70", null, 4, [["background-color", "color-mix(in oklab, var(--surface-1) 70%, transparent)"]]], [".bg-transparent", null, 4, [["background-color", "#0000"]]], [".bg-yellow", null, 4, [["background-color", "var(--yellow)"]]], [".object-contain", null, 4, [["object-fit", "contain"]]], [".object-cover", null, 4, [["object-fit", "cover"]]], [".p-0", null, 4, [["padding", "0"]]], [".p-0\\.5", null, 4, [["padding", "calc(var(--spacing) * .5)"]]], [".p-1", null, 4, [["padding", "var(--spacing)"]]], [".p-2", null, 4, [["padding", "calc(var(--spacing) * 2)"]]], [".p-3", null, 4, [["padding", "calc(var(--spacing) * 3)"]]], [".p-4", null, 4, [["padding", "calc(var(--spacing) * 4)"]]], [".p-5", null, 4, [["padding", "calc(var(--spacing) * 5)"]]], [".p-6", null, 4, [["padding", "calc(var(--spacing) * 6)"]]], [".p-\\[0\\.2rem\\]", null, 4, [["padding", ".2rem"]]], [".p-\\[0\\.4rem\\]", null, 4, [["padding", ".4rem"]]], [".p-\\[0\\.5rem\\]", null, 4, [["padding", ".5rem"]]], [".p-\\[0\\.9rem\\]", null, 4, [["padding", ".9rem"]]], [".p-\\[0\\.45rem\\]", null, 4, [["padding", ".45rem"]]], [".p-\\[0\\.55rem\\]", null, 4, [["padding", ".55rem"]]], [".p-\\[0\\.65rem\\]", null, 4, [["padding", ".65rem"]]], [".p-\\[2px\\]", null, 4, [["padding", "2px"]]], [".px-0", null, 4, [["padding-inline", "0"]]], [".px-1", null, 4, [["padding-inline", "var(--spacing)"]]], [".px-1\\.5", null, 4, [["padding-inline", "calc(var(--spacing) * 1.5)"]]], [".px-2", null, 4, [["padding-inline", "calc(var(--spacing) * 2)"]]], [".px-3", null, 4, [["padding-inline", "calc(var(--spacing) * 3)"]]], [".px-3\\.5", null, 4, [["padding-inline", "calc(var(--spacing) * 3.5)"]]], [".px-4", null, 4, [["padding-inline", "calc(var(--spacing) * 4)"]]], [".px-8", null, 4, [["padding-inline", "calc(var(--spacing) * 8)"]]], [".px-\\[0\\.2rem\\]", null, 4, [["padding-inline", ".2rem"]]], [".px-\\[0\\.3rem\\]", null, 4, [["padding-inline", ".3rem"]]], [".px-\\[0\\.4rem\\]", null, 4, [["padding-inline", ".4rem"]]], [".px-\\[0\\.5rem\\]", null, 4, [["padding-inline", ".5rem"]]], [".px-\\[0\\.6rem\\]", null, 4, [["padding-inline", ".6rem"]]], [".px-\\[0\\.7rem\\]", null, 4, [["padding-inline", ".7rem"]]], [".px-\\[0\\.8rem\\]", null, 4, [["padding-inline", ".8rem"]]], [".px-\\[0\\.9rem\\]", null, 4, [["padding-inline", ".9rem"]]], [".px-\\[0\\.26rem\\]", null, 4, [["padding-inline", ".26rem"]]], [".px-\\[0\\.28rem\\]", null, 4, [["padding-inline", ".28rem"]]], [".px-\\[0\\.35rem\\]", null, 4, [["padding-inline", ".35rem"]]], [".px-\\[0\\.42rem\\]", null, 4, [["padding-inline", ".42rem"]]], [".px-\\[0\\.45rem\\]", null, 4, [["padding-inline", ".45rem"]]], [".px-\\[0\\.48rem\\]", null, 4, [["padding-inline", ".48rem"]]], [".px-\\[0\\.55rem\\]", null, 4, [["padding-inline", ".55rem"]]], [".px-\\[0\\.65rem\\]", null, 4, [["padding-inline", ".65rem"]]], [".px-\\[0\\.75rem\\]", null, 4, [["padding-inline", ".75rem"]]], [".px-\\[0\\.85rem\\]", null, 4, [["padding-inline", ".85rem"]]], [".px-\\[1\\.4rem\\]", null, 4, [["padding-inline", "1.4rem"]]], [".px-\\[3px\\]", null, 4, [["padding-inline", "3px"]]], [".px-\\[10px\\]", null, 4, [["padding-inline", "10px"]]], [".py-0", null, 4, [["padding-block", "0"]]], [".py-0\\.5", null, 4, [["padding-block", "calc(var(--spacing) * .5)"]]], [".py-1", null, 4, [["padding-block", "var(--spacing)"]]], [".py-1\\.5", null, 4, [["padding-block", "calc(var(--spacing) * 1.5)"]]], [".py-2", null, 4, [["padding-block", "calc(var(--spacing) * 2)"]]], [".py-3", null, 4, [["padding-block", "calc(var(--spacing) * 3)"]]], [".py-4", null, 4, [["padding-block", "calc(var(--spacing) * 4)"]]], [".py-8", null, 4, [["padding-block", "calc(var(--spacing) * 8)"]]], [".py-\\[0\\.1rem\\]", null, 4, [["padding-block", ".1rem"]]], [".py-\\[0\\.2rem\\]", null, 4, [["padding-block", ".2rem"]]], [".py-\\[0\\.3rem\\]", null, 4, [["padding-block", ".3rem"]]], [".py-\\[0\\.4rem\\]", null, 4, [["padding-block", ".4rem"]]], [".py-\\[0\\.05rem\\]", null, 4, [["padding-block", ".05rem"]]], [".py-\\[0\\.6rem\\]", null, 4, [["padding-block", ".6rem"]]], [".py-\\[0\\.8rem\\]", null, 4, [["padding-block", ".8rem"]]], [".py-\\[0\\.12rem\\]", null, 4, [["padding-block", ".12rem"]]], [".py-\\[0\\.14rem\\]", null, 4, [["padding-block", ".14rem"]]], [".py-\\[0\\.15rem\\]", null, 4, [["padding-block", ".15rem"]]], [".py-\\[0\\.18rem\\]", null, 4, [["padding-block", ".18rem"]]], [".py-\\[0\\.25rem\\]", null, 4, [["padding-block", ".25rem"]]], [".py-\\[0\\.28rem\\]", null, 4, [["padding-block", ".28rem"]]], [".py-\\[0\\.32rem\\]", null, 4, [["padding-block", ".32rem"]]], [".py-\\[0\\.35rem\\]", null, 4, [["padding-block", ".35rem"]]], [".py-\\[0\\.42rem\\]", null, 4, [["padding-block", ".42rem"]]], [".py-\\[0\\.45rem\\]", null, 4, [["padding-block", ".45rem"]]], [".py-\\[0\\.55rem\\]", null, 4, [["padding-block", ".55rem"]]], [".py-\\[0\\.65rem\\]", null, 4, [["padding-block", ".65rem"]]], [".py-\\[2px\\]", null, 4, [["padding-block", "2px"]]], [".py-\\[3px\\]", null, 4, [["padding-block", "3px"]]], [".py-\\[6px\\]", null, 4, [["padding-block", "6px"]]], [".py-px", null, 4, [["padding-block", "1px"]]], [".pt-1", null, 4, [["padding-top", "var(--spacing)"]]], [".pt-2", null, 4, [["padding-top", "calc(var(--spacing) * 2)"]]], [".pt-2\\.5", null, 4, [["padding-top", "calc(var(--spacing) * 2.5)"]]], [".pt-3", null, 4, [["padding-top", "calc(var(--spacing) * 3)"]]], [".pt-4", null, 4, [["padding-top", "calc(var(--spacing) * 4)"]]], [".pt-5", null, 4, [["padding-top", "calc(var(--spacing) * 5)"]]], [".pt-\\[0\\.2rem\\]", null, 4, [["padding-top", ".2rem"]]], [".pt-\\[0\\.4rem\\]", null, 4, [["padding-top", ".4rem"]]], [".pt-\\[0\\.6rem\\]", null, 4, [["padding-top", ".6rem"]]], [".pt-\\[0\\.85rem\\]", null, 4, [["padding-top", ".85rem"]]], [".pt-\\[2px\\]", null, 4, [["padding-top", "2px"]]], [".pt-\\[12vh\\]", null, 4, [["padding-top", "12vh"]]], [".pt-\\[max\\(0\\.5rem\\,env\\(safe-area-inset-top\\)\\)\\]", null, 4, [["padding-top", "max(.5rem, env(safe-area-inset-top))"]]], [".pr-0\\.5", null, 4, [["padding-right", "calc(var(--spacing) * .5)"]]], [".pr-1", null, 4, [["padding-right", "var(--spacing)"]]], [".pr-1\\.5", null, 4, [["padding-right", "calc(var(--spacing) * 1.5)"]]], [".pr-2", null, 4, [["padding-right", "calc(var(--spacing) * 2)"]]], [".pr-3", null, 4, [["padding-right", "calc(var(--spacing) * 3)"]]], [".pr-12", null, 4, [["padding-right", "calc(var(--spacing) * 12)"]]], [".pr-\\[0\\.3rem\\]", null, 4, [["padding-right", ".3rem"]]], [".pr-\\[0\\.6rem\\]", null, 4, [["padding-right", ".6rem"]]], [".pr-\\[0\\.35rem\\]", null, 4, [["padding-right", ".35rem"]]], [".pr-\\[0\\.45rem\\]", null, 4, [["padding-right", ".45rem"]]], [".pr-\\[0\\.55rem\\]", null, 4, [["padding-right", ".55rem"]]], [".pr-\\[1\\.6rem\\]", null, 4, [["padding-right", "1.6rem"]]], [".pr-\\[3px\\]", null, 4, [["padding-right", "3px"]]], [".pr-\\[env\\(safe-area-inset-right\\)\\]", null, 4, [["padding-right", "env(safe-area-inset-right)"]]], [".pr-\\[max\\(0\\.5rem\\,env\\(safe-area-inset-right\\)\\)\\]", null, 4, [["padding-right", "max(.5rem, env(safe-area-inset-right))"]]], [".pb-1", null, 4, [["padding-bottom", "var(--spacing)"]]], [".pb-2", null, 4, [["padding-bottom", "calc(var(--spacing) * 2)"]]], [".pb-3", null, 4, [["padding-bottom", "calc(var(--spacing) * 3)"]]], [".pb-4", null, 4, [["padding-bottom", "calc(var(--spacing) * 4)"]]], [".pb-8", null, 4, [["padding-bottom", "calc(var(--spacing) * 8)"]]], [".pb-\\[0\\.3rem\\]", null, 4, [["padding-bottom", ".3rem"]]], [".pb-\\[0\\.4rem\\]", null, 4, [["padding-bottom", ".4rem"]]], [".pb-\\[0\\.25rem\\]", null, 4, [["padding-bottom", ".25rem"]]], [".pb-\\[0\\.55rem\\]", null, 4, [["padding-bottom", ".55rem"]]], [".pb-\\[1\\.4rem\\]", null, 4, [["padding-bottom", "1.4rem"]]], [".pb-\\[calc\\(1\\.5rem\\+env\\(safe-area-inset-bottom\\)\\)\\]", null, 4, [["padding-bottom", "calc(1.5rem + env(safe-area-inset-bottom))"]]], [".pb-\\[calc\\(1rem\\+env\\(safe-area-inset-bottom\\)\\)\\]", null, 4, [["padding-bottom", "calc(1rem + env(safe-area-inset-bottom))"]]], [".pb-\\[env\\(safe-area-inset-bottom\\)\\]", null, 4, [["padding-bottom", "env(safe-area-inset-bottom)"]]], [".pb-\\[max\\(0\\.5rem\\,env\\(safe-area-inset-bottom\\)\\)\\]", null, 4, [["padding-bottom", "max(.5rem, env(safe-area-inset-bottom))"]]], [".pl-1", null, 4, [["padding-left", "var(--spacing)"]]], [".pl-1\\.5", null, 4, [["padding-left", "calc(var(--spacing) * 1.5)"]]], [".pl-2", null, 4, [["padding-left", "calc(var(--spacing) * 2)"]]], [".pl-3", null, 4, [["padding-left", "calc(var(--spacing) * 3)"]]], [".pl-4", null, 4, [["padding-left", "calc(var(--spacing) * 4)"]]], [".pl-5", null, 4, [["padding-left", "calc(var(--spacing) * 5)"]]], [".pl-6", null, 4, [["padding-left", "calc(var(--spacing) * 6)"]]], [".pl-\\[0\\.4rem\\]", null, 4, [["padding-left", ".4rem"]]], [".pl-\\[0\\.45rem\\]", null, 4, [["padding-left", ".45rem"]]], [".pl-\\[0\\.75rem\\]", null, 4, [["padding-left", ".75rem"]]], [".pl-\\[0\\.85rem\\]", null, 4, [["padding-left", ".85rem"]]], [".pl-\\[1\\.2rem\\]", null, 4, [["padding-left", "1.2rem"]]], [".pl-\\[1\\.55rem\\]", null, 4, [["padding-left", "1.55rem"]]], [".pl-\\[1\\.075rem\\]", null, 4, [["padding-left", "1.075rem"]]], [".pl-\\[1\\.525rem\\]", null, 4, [["padding-left", "1.525rem"]]], [".pl-\\[1\\.875rem\\]", null, 4, [["padding-left", "1.875rem"]]], [".pl-\\[85px\\]", null, 4, [["padding-left", "85px"]]], [".pl-\\[max\\(0\\.5rem\\,env\\(safe-area-inset-left\\)\\)\\]", null, 4, [["padding-left", "max(.5rem, env(safe-area-inset-left))"]]], [".pl-\\[max\\(0\\.25rem\\,env\\(safe-area-inset-left\\)\\)\\]", null, 4, [["padding-left", "max(.25rem, env(safe-area-inset-left))"]]], [".text-center", null, 4, [["text-align", "center"]]], [".text-left", null, 4, [["text-align", "left"]]], [".text-right", null, 4, [["text-align", "right"]]], [".\\[font-family\\:inherit\\]", null, 4, [["font-family", "inherit"]]], [".\\[font-family\\:ui-monospace\\,SFMono-Regular\\,Menlo\\,monospace\\]", null, 4, [["font-family", "ui-monospace, SFMono-Regular, Menlo, monospace"]]], [".\\[font-family\\:var\\(--font-mono\\)\\], .font-mono", null, 4, [["font-family", "var(--font-mono)"]]], [".text-sm", null, 4, [["font-size", "var(--text-sm)"], ["line-height", "var(--tw-leading, var(--text-sm--line-height))"]]], [".text-xs", null, 4, [["font-size", "var(--text-xs)"], ["line-height", "var(--tw-leading, var(--text-xs--line-height))"]]], [".\\[font-size\\:inherit\\]", null, 4, [["font-size", "inherit"]]], [".text-\\[0\\.6rem\\]", null, 4, [["font-size", ".6rem"]]], [".text-\\[0\\.7rem\\]", null, 4, [["font-size", ".7rem"]]], [".text-\\[0\\.8em\\]", null, 4, [["font-size", ".8em"]]], [".text-\\[0\\.8rem\\]", null, 4, [["font-size", ".8rem"]]], [".text-\\[0\\.9em\\]", null, 4, [["font-size", ".9em"]]], [".text-\\[0\\.9rem\\]", null, 4, [["font-size", ".9rem"]]], [".text-\\[0\\.54rem\\]", null, 4, [["font-size", ".54rem"]]], [".text-\\[0\\.58rem\\]", null, 4, [["font-size", ".58rem"]]], [".text-\\[0\\.62rem\\]", null, 4, [["font-size", ".62rem"]]], [".text-\\[0\\.63rem\\]", null, 4, [["font-size", ".63rem"]]], [".text-\\[0\\.64rem\\]", null, 4, [["font-size", ".64rem"]]], [".text-\\[0\\.65rem\\]", null, 4, [["font-size", ".65rem"]]], [".text-\\[0\\.66rem\\]", null, 4, [["font-size", ".66rem"]]], [".text-\\[0\\.66rem\\]\\!", null, 4, [["font-size", ".66rem", 1]]], [".text-\\[0\\.68rem\\]", null, 4, [["font-size", ".68rem"]]], [".text-\\[0\\.72rem\\]", null, 4, [["font-size", ".72rem"]]], [".text-\\[0\\.74rem\\]", null, 4, [["font-size", ".74rem"]]], [".text-\\[0\\.75rem\\]", null, 4, [["font-size", ".75rem"]]], [".text-\\[0\\.76rem\\]", null, 4, [["font-size", ".76rem"]]], [".text-\\[0\\.77rem\\]", null, 4, [["font-size", ".77rem"]]], [".text-\\[0\\.78rem\\]", null, 4, [["font-size", ".78rem"]]], [".text-\\[0\\.82rem\\]", null, 4, [["font-size", ".82rem"]]], [".text-\\[0\\.83rem\\]", null, 4, [["font-size", ".83rem"]]], [".text-\\[0\\.85rem\\]", null, 4, [["font-size", ".85rem"]]], [".text-\\[0\\.88rem\\]", null, 4, [["font-size", ".88rem"]]], [".text-\\[0\\.95rem\\]", null, 4, [["font-size", ".95rem"]]], [".text-\\[0\\.875rem\\]", null, 4, [["font-size", ".875rem"]]], [".text-\\[1\\.1rem\\]", null, 4, [["font-size", "1.1rem"]]], [".text-\\[1\\.4em\\]", null, 4, [["font-size", "1.4em"]]], [".text-\\[1\\.6rem\\]", null, 4, [["font-size", "1.6rem"]]], [".text-\\[1\\.15rem\\]", null, 4, [["font-size", "1.15rem"]]], [".text-\\[1rem\\]", null, 4, [["font-size", "1rem"]]], [".text-\\[2\\.4rem\\]", null, 4, [["font-size", "2.4rem"]]], [".text-\\[9px\\]", null, 4, [["font-size", "9px"]]], [".text-\\[10px\\]", null, 4, [["font-size", "10px"]]], [".text-\\[11px\\]", null, 4, [["font-size", "11px"]]], [".text-\\[12\\.5px\\]", null, 4, [["font-size", "12.5px"]]], [".text-\\[12px\\]", null, 4, [["font-size", "12px"]]], [".text-\\[13px\\]", null, 4, [["font-size", "13px"]]], [".text-\\[14px\\]", null, 4, [["font-size", "14px"]]], [".text-\\[calc\\(0\\.95rem\\*var\\(--chat-font-scale\\,1\\)\\)\\]", null, 4, [["font-size", "calc(.95rem * var(--chat-font-scale, 1))"]]], [".text-\\[length\\:calc\\(11px\\*var\\(--zoom\\,1\\)\\)\\]", null, 4, [["font-size", "calc(11px * var(--zoom, 1))"]]], [".text-\\[length\\:calc\\(13px\\*var\\(--zoom\\,1\\)\\)\\]", null, 4, [["font-size", "calc(13px * var(--zoom, 1))"]]], [".leading-4", null, 4, [["--tw-leading", "calc(var(--spacing) * 4)"], ["line-height", "calc(var(--spacing) * 4)"]]], [".leading-\\[1\\.1\\]", null, 4, [["--tw-leading", "1.1"], ["line-height", "1.1"]]], [".leading-\\[1\\.2\\]", null, 4, [["--tw-leading", "1.2"], ["line-height", "1.2"]]], [".leading-\\[1\\.3\\]", null, 4, [["--tw-leading", "1.3"], ["line-height", "1.3"]]], [".leading-\\[1\\.4\\]", null, 4, [["--tw-leading", "1.4"], ["line-height", "1.4"]]], [".leading-\\[1\\.5\\]", null, 4, [["--tw-leading", "1.5"], ["line-height", "1.5"]]], [".leading-\\[1\\.6\\]", null, 4, [["--tw-leading", "1.6"], ["line-height", "1.6"]]], [".leading-\\[1\\.45\\]", null, 4, [["--tw-leading", "1.45"], ["line-height", "1.45"]]], [".leading-\\[18px\\]", null, 4, [["--tw-leading", "18px"], ["line-height", "18px"]]], [".leading-none", null, 4, [["--tw-leading", "1"], ["line-height", "1"]]], [".leading-relaxed", null, 4, [["--tw-leading", "var(--leading-relaxed)"], ["line-height", "var(--leading-relaxed)"]]], [".leading-tight", null, 4, [["--tw-leading", "var(--leading-tight)"], ["line-height", "var(--leading-tight)"]]], [".\\[line-height\\:inherit\\]", null, 4, [["line-height", "inherit"]]], [".font-bold", null, 4, [["--tw-font-weight", "var(--font-weight-bold)"], ["font-weight", "var(--font-weight-bold)"]]], [".font-medium", null, 4, [["--tw-font-weight", "var(--font-weight-medium)"], ["font-weight", "var(--font-weight-medium)"]]], [".font-normal", null, 4, [["--tw-font-weight", "var(--font-weight-normal)"], ["font-weight", "var(--font-weight-normal)"]]], [".font-semibold", null, 4, [["--tw-font-weight", "var(--font-weight-semibold)"], ["font-weight", "var(--font-weight-semibold)"]]], [".\\[font-weight\\:inherit\\]", null, 4, [["font-weight", "inherit"]]], [".tracking-\\[-0\\.02em\\]", null, 4, [["--tw-tracking", "-.02em"], ["letter-spacing", "-.02em"]]], [".tracking-\\[0\\.03em\\]", null, 4, [["--tw-tracking", ".03em"], ["letter-spacing", ".03em"]]], [".tracking-\\[0\\.04em\\]", null, 4, [["--tw-tracking", ".04em"], ["letter-spacing", ".04em"]]], [".tracking-\\[0\\.06em\\]", null, 4, [["--tw-tracking", ".06em"], ["letter-spacing", ".06em"]]], [".tracking-\\[0\\.08em\\]", null, 4, [["--tw-tracking", ".08em"], ["letter-spacing", ".08em"]]], [".tracking-\\[0\\.09em\\]", null, 4, [["--tw-tracking", ".09em"], ["letter-spacing", ".09em"]]], [".tracking-\\[0\\.22em\\]", null, 4, [["--tw-tracking", ".22em"], ["letter-spacing", ".22em"]]], [".tracking-normal", null, 4, [["--tw-tracking", "var(--tracking-normal)"], ["letter-spacing", "var(--tracking-normal)"]]], [".tracking-wide", null, 4, [["--tw-tracking", "var(--tracking-wide)"], ["letter-spacing", "var(--tracking-wide)"]]], [".\\[overflow-wrap\\:anywhere\\]", null, 4, [["overflow-wrap", "anywhere"]]], [".break-words", null, 4, [["overflow-wrap", "break-word"]]], [".\\[word-break\\:break-word\\]", null, 4, [["word-break", "break-word"]]], [".text-ellipsis", null, 4, [["text-overflow", "ellipsis"]]], [".whitespace-normal", null, 4, [["white-space", "normal"]]], [".whitespace-nowrap", null, 4, [["white-space", "nowrap"]]], [".whitespace-pre", null, 4, [["white-space", "pre"]]], [".whitespace-pre-wrap", null, 4, [["white-space", "pre-wrap"]]], [".\\[tab-size\\:2\\]", null, 4, [["tab-size", "2"]]], [".text-\\[color\\:var\\(--git-muted\\)\\]", null, 4, [["color", "var(--git-muted)"]]], [".text-\\[var\\(--subtext-0\\)\\]", null, 4, [["color", "var(--subtext-0)"]]], [".text-\\[var\\(--text\\)\\]", null, 4, [["color", "var(--text)"]]], [".text-accent", null, 4, [["color", "var(--accent)"]]], [".text-blue", null, 4, [["color", "var(--blue)"]]], [".text-current", null, 4, [["color", "currentColor"]]], [".text-fg", null, 4, [["color", "var(--text)"]]], [".text-green", null, 4, [["color", "var(--green)"]]], [".text-inherit", null, 4, [["color", "inherit"]]], [".text-mauve", null, 4, [["color", "var(--mauve)"]]], [".text-overlay-0", null, 4, [["color", "var(--overlay-0)"]]], [".text-overlay-1", null, 4, [["color", "var(--overlay-1)"]]], [".text-panel-bg", null, 4, [["color", "var(--panel-bg)"]]], [".text-peach", null, 4, [["color", "var(--peach)"]]], [".text-red", null, 4, [["color", "var(--red)"]]], [".text-red\\!", null, 4, [["color", "var(--red)", 1]]], [".text-subtext-0", null, 4, [["color", "var(--subtext-0)"]]], [".text-yellow", null, 4, [["color", "var(--yellow)"]]], [".capitalize", null, 4, [["text-transform", "capitalize"]]], [".normal-case", null, 4, [["text-transform", "none"]]], [".uppercase", null, 4, [["text-transform", "uppercase"]]], [".italic", null, 4, [["font-style", "italic"]]], [".not-italic", null, 4, [["font-style", "normal"]]], [".tabular-nums", null, 4, [["--tw-numeric-spacing", "tabular-nums"], ["font-variant-numeric", "var(--tw-ordinal, ) var(--tw-slashed-zero, ) var(--tw-numeric-figure, ) var(--tw-numeric-spacing, ) var(--tw-numeric-fraction, )"]]], [".line-through", null, 4, [["text-decoration-line", "line-through"]]], [".no-underline", null, 4, [["text-decoration-line", "none"]]], [".underline", null, 4, [["text-decoration-line", "underline"]]], [".opacity-0", null, 4, [["opacity", "0"]]], [".opacity-40", null, 4, [["opacity", ".4"]]], [".opacity-60", null, 4, [["opacity", ".6"]]], [".opacity-70", null, 4, [["opacity", ".7"]]], [".opacity-75", null, 4, [["opacity", ".75"]]], [".opacity-80", null, 4, [["opacity", ".8"]]], [".opacity-100", null, 4, [["opacity", "1"]]], [".opacity-\\[0\\.72\\]", null, 4, [["opacity", ".72"]]], [".shadow", null, 4, [["--tw-shadow", "0 1px 3px 0 var(--tw-shadow-color, #0000001a), 0 1px 2px -1px var(--tw-shadow-color, #0000001a)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_1px_4px_rgba\\(0\\,0\\,0\\,0\\.4\\)\\]", null, 4, [["--tw-shadow", "0 1px 4px var(--tw-shadow-color, #0006)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_2px_8px_rgba\\(0\\,0\\,0\\,0\\.4\\)\\]", null, 4, [["--tw-shadow", "0 2px 8px var(--tw-shadow-color, #0006)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_2px_8px_rgba\\(0\\,0\\,0\\,0\\.35\\)\\]", null, 4, [["--tw-shadow", "0 2px 8px var(--tw-shadow-color, #00000059)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_6px_20px_rgba\\(0\\,0\\,0\\,0\\.3\\)\\]", null, 4, [["--tw-shadow", "0 6px 20px var(--tw-shadow-color, #0000004d)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_8px_24px_rgba\\(0\\,0\\,0\\,0\\.35\\)\\]", null, 4, [["--tw-shadow", "0 8px 24px var(--tw-shadow-color, #00000059)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_8px_24px_rgba\\(0\\,0\\,0\\,0\\.45\\)\\]", null, 4, [["--tw-shadow", "0 8px 24px var(--tw-shadow-color, #00000073)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_8px_32px_rgba\\(0\\,0\\,0\\,0\\.5\\)\\]", null, 4, [["--tw-shadow", "0 8px 32px var(--tw-shadow-color, #00000080)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_12px_32px_rgba\\(0\\,0\\,0\\,0\\.5\\)\\]", null, 4, [["--tw-shadow", "0 12px 32px var(--tw-shadow-color, #00000080)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_16px_48px_rgba\\(0\\,0\\,0\\,0\\.55\\)\\]", null, 4, [["--tw-shadow", "0 16px 48px var(--tw-shadow-color, #0000008c)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[inset_0_0_24px_var\\(--accent\\)\\]", null, 4, [["--tw-shadow", "inset 0 0 24px var(--tw-shadow-color, var(--accent))"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-lg", null, 4, [["--tw-shadow", "0 10px 15px -3px var(--tw-shadow-color, #0000001a), 0 4px 6px -4px var(--tw-shadow-color, #0000001a)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".ring", null, 4, [["--tw-ring-shadow", "var(--tw-ring-inset, ) 0 0 0 calc(1px + var(--tw-ring-offset-width)) var(--tw-ring-color, currentcolor)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".\\[box-shadow\\:0_1px_2px_rgba\\(0\\,0\\,0\\,0\\.3\\)\\]", null, 4, [["box-shadow", "0 1px 2px #0000004d"]]], [".\\[box-shadow\\:0_4px_14px_rgba\\(0\\,0\\,0\\,0\\.35\\)\\]", null, 4, [["box-shadow", "0 4px 14px #00000059"]]], [".\\[box-shadow\\:none\\]", null, 4, [["box-shadow", "none"]]], [".\\[outline\\:none\\]", null, 4, [["outline", "none"]]], [".outline, .outline-1", null, 4, [["outline-style", "var(--tw-outline-style)"], ["outline-width", "1px"]]], [".outline-2", null, 4, [["outline-style", "var(--tw-outline-style)"], ["outline-width", "2px"]]], [".outline-accent", null, 4, [["outline-color", "var(--accent)"]]], [".blur", null, 4, [["--tw-blur", "blur(8px)"], ["filter", "var(--tw-blur, ) var(--tw-brightness, ) var(--tw-contrast, ) var(--tw-grayscale, ) var(--tw-hue-rotate, ) var(--tw-invert, ) var(--tw-saturate, ) var(--tw-sepia, ) var(--tw-drop-shadow, )"]]], [".\\!filter", null, 4, [["filter", "var(--tw-blur, ) var(--tw-brightness, ) var(--tw-contrast, ) var(--tw-grayscale, ) var(--tw-hue-rotate, ) var(--tw-invert, ) var(--tw-saturate, ) var(--tw-sepia, ) var(--tw-drop-shadow, )", 1]]], [".\\[filter\\:drop-shadow\\(0_6px_10px_rgba\\(0\\,0\\,0\\,0\\.45\\)\\)\\]", null, 4, [["filter", "drop-shadow(0 6px 10px #00000073)"]]], [".filter", null, 4, [["filter", "var(--tw-blur, ) var(--tw-brightness, ) var(--tw-contrast, ) var(--tw-grayscale, ) var(--tw-hue-rotate, ) var(--tw-invert, ) var(--tw-saturate, ) var(--tw-sepia, ) var(--tw-drop-shadow, )"]]], [".backdrop-blur-xl", null, 4, [["--tw-backdrop-blur", "blur(var(--blur-xl))"], ["-webkit-backdrop-filter", "var(--tw-backdrop-blur, ) var(--tw-backdrop-brightness, ) var(--tw-backdrop-contrast, ) var(--tw-backdrop-grayscale, ) var(--tw-backdrop-hue-rotate, ) var(--tw-backdrop-invert, ) var(--tw-backdrop-opacity, ) var(--tw-backdrop-saturate, ) var(--tw-backdrop-sepia, )"], ["backdrop-filter", "var(--tw-backdrop-blur, ) var(--tw-backdrop-brightness, ) var(--tw-backdrop-contrast, ) var(--tw-backdrop-grayscale, ) var(--tw-backdrop-hue-rotate, ) var(--tw-backdrop-invert, ) var(--tw-backdrop-opacity, ) var(--tw-backdrop-saturate, ) var(--tw-backdrop-sepia, )"]]], [".backdrop-saturate-150", null, 4, [["--tw-backdrop-saturate", "saturate(150%)"], ["-webkit-backdrop-filter", "var(--tw-backdrop-blur, ) var(--tw-backdrop-brightness, ) var(--tw-backdrop-contrast, ) var(--tw-backdrop-grayscale, ) var(--tw-backdrop-hue-rotate, ) var(--tw-backdrop-invert, ) var(--tw-backdrop-opacity, ) var(--tw-backdrop-saturate, ) var(--tw-backdrop-sepia, )"], ["backdrop-filter", "var(--tw-backdrop-blur, ) var(--tw-backdrop-brightness, ) var(--tw-backdrop-contrast, ) var(--tw-backdrop-grayscale, ) var(--tw-backdrop-hue-rotate, ) var(--tw-backdrop-invert, ) var(--tw-backdrop-opacity, ) var(--tw-backdrop-saturate, ) var(--tw-backdrop-sepia, )"]]], [".transition", null, 4, [["transition-property", "color, background-color, border-color, outline-color, text-decoration-color, fill, stroke, --tw-gradient-from, --tw-gradient-via, --tw-gradient-to, opacity, box-shadow, transform, translate, scale, rotate, filter, -webkit-backdrop-filter, backdrop-filter, display, content-visibility, overlay, pointer-events"], ["transition-timing-function", "var(--tw-ease, var(--default-transition-timing-function))"], ["transition-duration", "var(--tw-duration, var(--default-transition-duration))"]]], [".transition-\\[left\\,top\\,width\\,height\\]", null, 4, [["transition-property", "left, top, width, height"], ["transition-timing-function", "var(--tw-ease, var(--default-transition-timing-function))"], ["transition-duration", "var(--tw-duration, var(--default-transition-duration))"]]], [".transition-opacity", null, 4, [["transition-property", "opacity"], ["transition-timing-function", "var(--tw-ease, var(--default-transition-timing-function))"], ["transition-duration", "var(--tw-duration, var(--default-transition-duration))"]]], [".duration-150", null, 4, [["--tw-duration", ".15s"], ["transition-duration", ".15s"]]], [".ease-out", null, 4, [["--tw-ease", "var(--ease-out)"], ["transition-timing-function", "var(--ease-out)"]]], [".outline-none", null, 4, [["--tw-outline-style", "none"], ["outline-style", "none"]]], [".outline-solid", null, 4, [["--tw-outline-style", "solid"], ["outline-style", "solid"]]], [".select-none", null, 4, [["-webkit-user-select", "none"], ["user-select", "none"]]], [".select-text", null, 4, [["-webkit-user-select", "text"], ["user-select", "text"]]], [".\\[--panel-bg\\:var\\(--surface-dim\\)\\]", null, 4, [["--panel-bg", "var(--surface-dim)"]]], [".\\[--picker-bg\\:var\\(--surface-0\\)\\]", null, 4, [["--picker-bg", "var(--surface-0)"]]], [".\\[--radius\\:var\\(--radius-pane\\)\\]", null, 4, [["--radius", "var(--radius-pane)"]]], [".\\[--workspace-tools-bg\\:transparent\\]", null, 4, [["--workspace-tools-bg", "transparent"]]], [".\\[-webkit-box-orient\\:vertical\\]", null, 4, [["-webkit-box-orient", "vertical"]]], [".\\[-webkit-line-clamp\\:3\\]", null, 4, [["-webkit-line-clamp", "3"]]], [".\\[-webkit-touch-callout\\:none\\]", null, 4, [["-webkit-touch-callout", "none"]]], [".\\[background\\:none\\]", null, 4, [["background", "none"]]], [".\\[border-right\\:1px_solid_var\\(--git-border\\)\\]", null, 4, [["border-right", "1px solid var(--git-border)"]]], [".\\[border-top\\:1px_solid_var\\(--git-border\\)\\]", null, 4, [["border-top", "1px solid var(--git-border)"]]], [".\\[border\\:0\\]", null, 4, [["border", "0"]]], [".\\[border\\:none\\]", null, 4, [["border", "none"]]], [".\\[font\\:1\\.15rem\\/1_var\\(--font-mono\\)\\]", null, 4, [["font", "1.15rem/1 var(--font-mono)"]]], [".\\[font\\:1rem\\/1\\.2_var\\(--font-mono\\)\\]", null, 4, [["font", "1rem/1.2 var(--font-mono)"]]], [".\\[font\\:inherit\\]", null, 4, [["font", "inherit"]]], [".\\[transition\\:background_0\\.1s_ease\\]", null, 4, [["transition", "background .1s"]]], [".\\[transition\\:background_0\\.12s_ease\\]", null, 4, [["transition", "background .12s"]]], [".\\[transition\\:background_0\\.15s_ease\\]", null, 4, [["transition", "background .15s"]]], [".\\[transition\\:color_0\\.1s_ease\\,background_0\\.1s_ease\\]", null, 4, [["transition", "color .1s, background .1s"]]], [".\\[transition\\:color_0\\.12s_ease\\,background_0\\.12s_ease\\]", null, 4, [["transition", "color .12s, background .12s"]]], [".\\[transition\\:color_0\\.15s_ease\\]", null, 4, [["transition", "color .15s"]]], [".\\[transition\\:opacity_0\\.12s_ease\\]", null, 4, [["transition", "opacity .12s"]]], [".\\[transition\\:transform_0\\.15s_ease\\,background_0\\.15s_ease\\]", null, 4, [["transition", "transform .15s, background .15s"]]], [".not-has-\\[\\[data-setting-row\\]\\]\\:hidden:not(:has([data-setting-row]))", null, 4, [["display", "none"]]], [".group-focus-within\\:flex:is(:where(.group):focus-within *)", null, 4, [["display", "flex"]]], [".group-focus-within\\/row\\:opacity-100:is(:where(.group\\/row):focus-within *)", null, 4, [["opacity", "1"]]], [".group-hover\\:flex:is(:where(.group):hover *)", null, 4, [["display", "flex"]]], [".group-hover\\:opacity-100:is(:where(.group):hover *)", null, 4, [["opacity", "1"]]], [".group-hover\\/line\\:opacity-90:is(:where(.group\\/line):hover *)", null, 4, [["opacity", ".9"]]], [".group-hover\\/ph\\:opacity-100:is(:where(.group\\/ph):hover *), .group-hover\\/row\\:opacity-100:is(:where(.group\\/row):hover *)", null, 4, [["opacity", "1"]]], [".group-hover\\/submenu\\:block:is(:where(.group\\/submenu):hover *)", null, 4, [["display", "block"]]], [".group-focus\\/tree\\:ring-1:is(:where(.group\\/tree):focus *)", null, 4, [["--tw-ring-shadow", "var(--tw-ring-inset, ) 0 0 0 calc(1px + var(--tw-ring-offset-width)) var(--tw-ring-color, currentcolor)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".group-focus\\/tree\\:ring-overlay-1:is(:where(.group\\/tree):focus *)", null, 4, [["--tw-ring-color", "var(--overlay-1)"]]], [".group-focus\\/tree\\:ring-inset:is(:where(.group\\/tree):focus *)", null, 4, [["--tw-ring-inset", "inset"]]], ['.group-aria-checked\\:\\[transform\\:translateX\\(1\\.1rem\\)\\]:is(:where(.group)[aria-checked="true"] *)', null, 4, [["transform", "translateX(1.1rem)"]]], ['.group-aria-checked\\:border-accent:is(:where(.group)[aria-checked="true"] *)', null, 4, [["border-color", "var(--accent)"]]], ['.group-aria-checked\\:bg-accent:is(:where(.group)[aria-checked="true"] *)', null, 4, [["background-color", "var(--accent)"]]], ['.group-aria-checked\\:bg-panel-bg:is(:where(.group)[aria-checked="true"] *)', null, 4, [["background-color", "var(--panel-bg)"]]], ['.group-aria-checked\\:text-accent:is(:where(.group)[aria-checked="true"] *), .group-aria-\\[checked\\=false\\]\\:text-accent:is(:where(.group)[aria-checked="false"] *)', null, 4, [["color", "var(--accent)"]]], [".placeholder\\:text-subtext-0::placeholder", null, 4, [["color", "var(--subtext-0)"]]], [".before\\:absolute:before", null, 4, [["content", "var(--tw-content)"], ["position", "absolute"]]], [".before\\:top-\\[0\\.15rem\\]:before", null, 4, [["content", "var(--tw-content)"], ["top", ".15rem"]]], [".before\\:left-\\[0\\.15rem\\]:before", null, 4, [["content", "var(--tw-content)"], ["left", ".15rem"]]], [".before\\:h-\\[0\\.95rem\\]:before", null, 4, [["content", "var(--tw-content)"], ["height", ".95rem"]]], [".before\\:w-\\[0\\.95rem\\]:before", null, 4, [["content", "var(--tw-content)"], ["width", ".95rem"]]], [".before\\:rounded-full:before", null, 4, [["content", "var(--tw-content)"], ["border-radius", "3.40282e38px"]]], [".before\\:bg-fg:before", null, 4, [["content", "var(--tw-content)"], ["background-color", "var(--text)"]]], [".before\\:content-\\[\\'\\'\\]:before", null, 4, [["--tw-content", '""'], ["content", "var(--tw-content)"]]], [".before\\:\\[transition\\:transform_0\\.12s_ease\\]:before", null, 4, [["content", "var(--tw-content)"], ["transition", "transform .12s"]]], [".after\\:absolute:after", null, 4, [["content", "var(--tw-content)"], ["position", "absolute"]]], [".after\\:inset-0:after", null, 4, [["content", "var(--tw-content)"], ["inset", "0"]]], [".after\\:inset-x-0:after", null, 4, [["content", "var(--tw-content)"], ["inset-inline", "0"]]], [".after\\:-inset-y-2:after", null, 4, [["content", "var(--tw-content)"], ["inset-block", "calc(var(--spacing) * -2)"]]], [".after\\:m-auto:after", null, 4, [["content", "var(--tw-content)"], ["margin", "auto"]]], [".after\\:h-8:after", null, 4, [["content", "var(--tw-content)"], ["height", "calc(var(--spacing) * 8)"]]], [".after\\:h-12:after", null, 4, [["content", "var(--tw-content)"], ["height", "calc(var(--spacing) * 12)"]]], [".after\\:h-\\[3px\\]:after", null, 4, [["content", "var(--tw-content)"], ["height", "3px"]]], [".after\\:w-8:after", null, 4, [["content", "var(--tw-content)"], ["width", "calc(var(--spacing) * 8)"]]], [".after\\:w-\\[3px\\]:after", null, 4, [["content", "var(--tw-content)"], ["width", "3px"]]], [".after\\:rounded-full:after", null, 4, [["content", "var(--tw-content)"], ["border-radius", "3.40282e38px"]]], [".after\\:bg-transparent:after", null, 4, [["content", "var(--tw-content)"], ["background-color", "#0000"]]], [".after\\:content-\\[\\'\\'\\]:after", null, 4, [["--tw-content", '""'], ["content", "var(--tw-content)"]]], [".last\\:border-b-0:last-child", null, 4, [["border-bottom-style", "var(--tw-border-style)"], ["border-bottom-width", "0"]]], [".checked\\:bg-accent:checked", null, 4, [["background-color", "var(--accent)"]]], [".checked\\:before\\:translate-x-\\[1rem\\]:checked:before", null, 4, [["content", "var(--tw-content)"], ["--tw-translate-x", "1rem"], ["translate", "var(--tw-translate-x) var(--tw-translate-y)"]]], [".checked\\:before\\:bg-panel-bg:checked:before", null, 4, [["content", "var(--tw-content)"], ["background-color", "var(--panel-bg)"]]], [".focus-within\\:bg-surface-1:focus-within", null, 4, [["background-color", "var(--surface-1)"]]], [".focus-within\\:outline:focus-within, .focus-within\\:outline-1:focus-within", null, 4, [["outline-style", "var(--tw-outline-style)"], ["outline-width", "1px"]]], [".focus-within\\:outline-fg:focus-within", null, 4, [["outline-color", "var(--text)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_12\\%\\,transparent\\)\\]:hover", null, 4, [["background-color", "var(--accent)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_12\\%\\,transparent\\)\\]:hover", null, 4, [["background-color", "color-mix(in srgb,var(--accent) 12%,transparent)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_15\\%\\,transparent\\)\\]:hover", null, 4, [["background-color", "var(--accent)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_15\\%\\,transparent\\)\\]:hover", null, 4, [["background-color", "color-mix(in srgb,var(--accent) 15%,transparent)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--text\\)_10\\%\\,var\\(--panel-bg\\)\\)\\]:hover", null, 4, [["background-color", "var(--text)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--text\\)_10\\%\\,var\\(--panel-bg\\)\\)\\]:hover", null, 4, [["background-color", "color-mix(in srgb,var(--text) 10%,var(--panel-bg))"]]], [".hover\\:bg-\\[var\\(--surface-0\\)\\]:hover", null, 4, [["background-color", "var(--surface-0)"]]], [".hover\\:bg-accent:hover", null, 4, [["background-color", "var(--accent)"]]], [".hover\\:bg-overlay-0:hover", null, 4, [["background-color", "var(--overlay-0)"]]], [".hover\\:bg-panel-bg:hover", null, 4, [["background-color", "var(--panel-bg)"]]], [".hover\\:bg-surface-0:hover", null, 4, [["background-color", "var(--surface-0)"]]], [".hover\\:bg-surface-1:hover", null, 4, [["background-color", "var(--surface-1)"]]], [".hover\\:bg-transparent:hover", null, 4, [["background-color", "#0000"]]], [".hover\\:text-accent:hover", null, 4, [["color", "var(--accent)"]]], [".hover\\:text-fg:hover", null, 4, [["color", "var(--text)"]]], [".hover\\:text-inherit:hover", null, 4, [["color", "inherit"]]], [".hover\\:text-overlay-0:hover", null, 4, [["color", "var(--overlay-0)"]]], [".hover\\:text-panel-bg:hover", null, 4, [["color", "var(--panel-bg)"]]], [".hover\\:text-red:hover", null, 4, [["color", "var(--red)"]]], [".hover\\:text-subtext-0:hover", null, 4, [["color", "var(--subtext-0)"]]], [".hover\\:text-yellow:hover", null, 4, [["color", "var(--yellow)"]]], [".hover\\:underline:hover", null, 4, [["text-decoration-line", "underline"]]], [".hover\\:opacity-60:hover", null, 4, [["opacity", ".6"]]], [".hover\\:opacity-100\\!:hover", null, 4, [["opacity", "1", 1]]], [".hover\\:opacity-\\[0\\.85\\]:hover", null, 4, [["opacity", ".85"]]], [".hover\\:brightness-110:hover", null, 4, [["--tw-brightness", "brightness(110%)"], ["filter", "var(--tw-blur, ) var(--tw-brightness, ) var(--tw-contrast, ) var(--tw-grayscale, ) var(--tw-hue-rotate, ) var(--tw-invert, ) var(--tw-saturate, ) var(--tw-sepia, ) var(--tw-drop-shadow, )"]]], [".hover\\:\\[filter\\:brightness\\(1\\.08\\)\\]:hover", null, 4, [["filter", "brightness(1.08)"]]], [".hover\\:after\\:bg-overlay-1:hover:after", null, 4, [["content", "var(--tw-content)"], ["background-color", "var(--overlay-1)"]]], [".focus\\:\\[outline\\:1px_solid_var\\(--accent\\)\\]:focus", null, 4, [["outline", "1px solid var(--accent)"]]], [".focus\\:outline-2:focus", null, 4, [["outline-style", "var(--tw-outline-style)"], ["outline-width", "2px"]]], [".focus\\:outline-none:focus", null, 4, [["--tw-outline-style", "none"], ["outline-style", "none"]]], [".focus-visible\\:bg-accent:focus-visible", null, 4, [["background-color", "var(--accent)"]]], [".focus-visible\\:bg-surface-0:focus-visible", null, 4, [["background-color", "var(--surface-0)"]]], [".focus-visible\\:bg-surface-1:focus-visible", null, 4, [["background-color", "var(--surface-1)"]]], [".focus-visible\\:text-accent:focus-visible", null, 4, [["color", "var(--accent)"]]], [".focus-visible\\:text-fg:focus-visible", null, 4, [["color", "var(--text)"]]], [".focus-visible\\:text-panel-bg:focus-visible", null, 4, [["color", "var(--panel-bg)"]]], [".focus-visible\\:text-red:focus-visible", null, 4, [["color", "var(--red)"]]], [".focus-visible\\:text-yellow:focus-visible", null, 4, [["color", "var(--yellow)"]]], [".focus-visible\\:underline:focus-visible", null, 4, [["text-decoration-line", "underline"]]], [".focus-visible\\:opacity-100:focus-visible", null, 4, [["opacity", "1"]]], [".focus-visible\\:\\[outline\\:1px_solid_var\\(--accent\\)\\]:focus-visible", null, 4, [["outline", "1px solid var(--accent)"]]], [".focus-visible\\:\\[outline\\:1px_solid_var\\(--overlay-1\\)\\]:focus-visible", null, 4, [["outline", "1px solid var(--overlay-1)"]]], [".focus-visible\\:\\[outline\\:2px_solid_var\\(--accent\\)\\]:focus-visible", null, 4, [["outline", "2px solid var(--accent)"]]], [".focus-visible\\:outline:focus-visible, .focus-visible\\:outline-1:focus-visible", null, 4, [["outline-style", "var(--tw-outline-style)"], ["outline-width", "1px"]]], [".focus-visible\\:\\[outline-offset\\:-1px\\]:focus-visible", null, 4, [["outline-offset", "-1px"]]], [".focus-visible\\:\\[outline-offset\\:-2px\\]:focus-visible", null, 4, [["outline-offset", "-2px"]]], [".focus-visible\\:\\[outline-offset\\:2px\\]:focus-visible", null, 4, [["outline-offset", "2px"]]], [".focus-visible\\:outline-offset-1:focus-visible", null, 4, [["outline-offset", "1px"]]], [".focus-visible\\:outline-fg:focus-visible", null, 4, [["outline-color", "var(--text)"]]], [".focus-visible\\:after\\:bg-accent:focus-visible:after", null, 4, [["content", "var(--tw-content)"], ["background-color", "var(--accent)"]]], [".active\\:cursor-grabbing:active", null, 4, [["cursor", "grabbing"]]], [".active\\:bg-surface-1:active", null, 4, [["background-color", "var(--surface-1)"]]], [".active\\:text-fg:active", null, 4, [["color", "var(--text)"]]], [".active\\:after\\:bg-accent:active:after", null, 4, [["content", "var(--tw-content)"], ["background-color", "var(--accent)"]]], [".enabled\\:hover\\:bg-surface-1:enabled:hover", null, 4, [["background-color", "var(--surface-1)"]]], [".enabled\\:hover\\:text-fg:enabled:hover", null, 4, [["color", "var(--text)"]]], [".disabled\\:cursor-default:disabled", null, 4, [["cursor", "default"]]], [".disabled\\:cursor-not-allowed:disabled", null, 4, [["cursor", "not-allowed"]]], [".disabled\\:cursor-not-allowed\\!:disabled", null, 4, [["cursor", "not-allowed", 1]]], [".disabled\\:cursor-wait:disabled", null, 4, [["cursor", "wait"]]], [".disabled\\:bg-transparent:disabled", null, 4, [["background-color", "#0000"]]], [".disabled\\:text-fg:disabled", null, 4, [["color", "var(--text)"]]], [".disabled\\:opacity-40:disabled", null, 4, [["opacity", ".4"]]], [".disabled\\:opacity-50:disabled", null, 4, [["opacity", ".5"]]], [".disabled\\:opacity-\\[0\\.45\\]:disabled", null, 4, [["opacity", ".45"]]], [".disabled\\:opacity-\\[0\\.55\\]:disabled", null, 4, [["opacity", ".55"]]], [":where(.app--mac-desktop) .in-\\[\\.app--mac-desktop\\]\\:pl-\\[84px\\]", null, 4, [["padding-left", "84px"]]], [".has-\\[\\:checked\\]\\:bg-surface-0:has(:checked)", null, 4, [["background-color", "var(--surface-0)"]]], [".has-\\[\\:checked\\]\\:text-fg:has(:checked)", null, 4, [["color", "var(--text)"]]], [".has-\\[\\:focus-visible\\]\\:bg-surface-0:has(:focus-visible)", null, 4, [["background-color", "var(--surface-0)"]]], ['.aria-disabled\\:cursor-not-allowed[aria-disabled="true"]', null, 4, [["cursor", "not-allowed"]]], ['.aria-disabled\\:opacity-40[aria-disabled="true"]', null, 4, [["opacity", ".4"]]], ['.aria-expanded\\:opacity-100[aria-expanded="true"]', null, 4, [["opacity", "1"]]], ['.aria-pressed\\:bg-surface-0[aria-pressed="true"]', null, 4, [["background-color", "var(--surface-0)"]]], ['.aria-pressed\\:text-fg[aria-pressed="true"]', null, 4, [["color", "var(--text)"]]], [".motion-reduce\\:animate-none", ["(prefers-reduced-motion: reduce)"], 4, [["animation", "none"]]], [".max-\\[900px\\]\\:hidden", ["not all and (min-width: 900px)"], 4, [["display", "none"]]], [".max-\\[700px\\]\\:hidden", ["not all and (min-width: 700px)"], 4, [["display", "none"]]], [".max-\\[700px\\]\\:size-11", ["not all and (min-width: 700px)"], 4, [["width", "calc(var(--spacing) * 11)"], ["height", "calc(var(--spacing) * 11)"]]], [".max-\\[700px\\]\\:h-9", ["not all and (min-width: 700px)"], 4, [["height", "calc(var(--spacing) * 9)"]]], [".max-\\[700px\\]\\:h-12", ["not all and (min-width: 700px)"], 4, [["height", "calc(var(--spacing) * 12)"]]], [".max-\\[700px\\]\\:min-h-9", ["not all and (min-width: 700px)"], 4, [["min-height", "calc(var(--spacing) * 9)"]]], [".max-\\[700px\\]\\:min-h-11", ["not all and (min-width: 700px)"], 4, [["min-height", "calc(var(--spacing) * 11)"]]], [".max-\\[700px\\]\\:w-24", ["not all and (min-width: 700px)"], 4, [["width", "calc(var(--spacing) * 24)"]]], [".max-\\[700px\\]\\:min-w-11", ["not all and (min-width: 700px)"], 4, [["min-width", "calc(var(--spacing) * 11)"]]], [".max-\\[700px\\]\\:flex-1", ["not all and (min-width: 700px)"], 4, [["flex", "1"]]], [".max-\\[700px\\]\\:flex-\\[1_1_6rem\\]", ["not all and (min-width: 700px)"], 4, [["flex", "6rem"]]], [".max-\\[700px\\]\\:flex-\\[1_1_100\\%\\]", ["not all and (min-width: 700px)"], 4, [["flex", "100%"]]], [".max-\\[700px\\]\\:basis-56", ["not all and (min-width: 700px)"], 4, [["flex-basis", "calc(var(--spacing) * 56)"]]], [".max-\\[700px\\]\\:basis-full", ["not all and (min-width: 700px)"], 4, [["flex-basis", "100%"]]], [".max-\\[700px\\]\\:flex-wrap", ["not all and (min-width: 700px)"], 4, [["flex-wrap", "wrap"]]], [".max-\\[700px\\]\\:gap-y-2", ["not all and (min-width: 700px)"], 4, [["row-gap", "calc(var(--spacing) * 2)"]]], [".min-\\[701px\\]\\:left-auto", ["(min-width: 701px)"], 4, [["left", "auto"]]], [".min-\\[701px\\]\\:my-\\[3px\\]", ["(min-width: 701px)"], 4, [["margin-block", "3px"]]], [".min-\\[701px\\]\\:block", ["(min-width: 701px)"], 4, [["display", "block"]]], [".min-\\[701px\\]\\:hidden", ["(min-width: 701px)"], 4, [["display", "none"]]], [".min-\\[701px\\]\\:min-h-6", ["(min-width: 701px)"], 4, [["min-height", "calc(var(--spacing) * 6)"]]], [".min-\\[701px\\]\\:w-80", ["(min-width: 701px)"], 4, [["width", "calc(var(--spacing) * 80)"]]], [".min-\\[701px\\]\\:rounded-ui", ["(min-width: 701px)"], 4, [["border-radius", "var(--radius)"]]], [".min-\\[701px\\]\\:px-3", ["(min-width: 701px)"], 4, [["padding-inline", "calc(var(--spacing) * 3)"]]], [".min-\\[701px\\]\\:px-4", ["(min-width: 701px)"], 4, [["padding-inline", "calc(var(--spacing) * 4)"]]], [".min-\\[701px\\]\\:pr-\\[3px\\]", ["(min-width: 701px)"], 4, [["padding-right", "3px"]]], [".min-\\[701px\\]\\:pl-4", ["(min-width: 701px)"], 4, [["padding-left", "calc(var(--spacing) * 4)"]]], [".min-\\[701px\\]\\:text-\\[0\\.62rem\\]", ["(min-width: 701px)"], 4, [["font-size", ".62rem"]]], [".min-\\[701px\\]\\:text-\\[12\\.5px\\]", ["(min-width: 701px)"], 4, [["font-size", "12.5px"]]], [".min-\\[701px\\]\\:text-\\[12px\\]", ["(min-width: 701px)"], 4, [["font-size", "12px"]]], [".min-\\[701px\\]\\:font-medium", ["(min-width: 701px)"], 4, [["--tw-font-weight", "var(--font-weight-medium)"], ["font-weight", "var(--font-weight-medium)"]]], [".min-\\[701px\\]\\:font-semibold", ["(min-width: 701px)"], 4, [["--tw-font-weight", "var(--font-weight-semibold)"], ["font-weight", "var(--font-weight-semibold)"]]], [".min-\\[701px\\]\\:tracking-\\[0\\.045em\\]", ["(min-width: 701px)"], 4, [["--tw-tracking", ".045em"], ["letter-spacing", ".045em"]]], [".min-\\[701px\\]\\:text-subtext-0", ["(min-width: 701px)"], 4, [["color", "var(--subtext-0)"]]], [".min-\\[701px\\]\\:uppercase", ["(min-width: 701px)"], 4, [["text-transform", "uppercase"]]], [".min-\\[900px\\]\\:inline", ["(min-width: 900px)"], 4, [["display", "inline"]]], [".pointer-coarse\\:opacity-100", ["(pointer: coarse)"], 4, [["opacity", "1"]]], [".\\[\\&_\\.mode-switch\\]\\:ml-0 .mode-switch", null, 4, [["margin-left", "0"]]], [".max-\\[700px\\]\\:\\[\\&_button\\]\\:min-h-11 button", ["not all and (min-width: 700px)"], 4, [["min-height", "calc(var(--spacing) * 11)"]]], [".\\[\\&_pre\\]\\:m-\\[0\\.2rem_0_0\\.3rem_1\\.2rem\\] pre", null, 4, [["margin", ".2rem 0 .3rem 1.2rem"]]], [".\\[\\&_pre\\]\\:max-h-72 pre", null, 4, [["max-height", "calc(var(--spacing) * 72)"]]], [".\\[\\&_pre\\]\\:overflow-auto pre", null, 4, [["overflow", "auto"]]], [".\\[\\&_pre\\]\\:rounded-ui pre", null, 4, [["border-radius", "var(--radius)"]]], [".\\[\\&_pre\\]\\:bg-surface-0 pre", null, 4, [["background-color", "var(--surface-0)"]]], [".\\[\\&_pre\\]\\:p-2 pre", null, 4, [["padding", "calc(var(--spacing) * 2)"]]], [".\\[\\&_pre\\]\\:text-\\[0\\.78rem\\] pre", null, 4, [["font-size", ".78rem"]]], [".\\[\\&_pre\\]\\:\\[overflow-wrap\\:anywhere\\] pre", null, 4, [["overflow-wrap", "anywhere"]]], [".\\[\\&_pre\\]\\:whitespace-pre-wrap pre", null, 4, [["white-space", "pre-wrap"]]], [".\\[\\&_pre\\]\\:text-fg pre, .\\[\\&_strong\\]\\:text-fg strong", null, 4, [["color", "var(--text)"]]], [".\\[\\&_summary\\]\\:cursor-pointer summary", null, 4, [["cursor", "pointer"]]], [".\\[\\&\\:hover\\:not\\(\\:disabled\\)\\]\\:bg-surface-1:hover:not(:disabled)", null, 4, [["background-color", "var(--surface-1)"]]], [".\\[\\&\\:hover\\:not\\(\\:disabled\\)\\]\\:text-accent:hover:not(:disabled)", null, 4, [["color", "var(--accent)"]]], [".\\[\\&\\:hover\\:not\\(\\:disabled\\)\\]\\:text-red:hover:not(:disabled)", null, 4, [["color", "var(--red)"]]], [".\\[\\&\\:not\\(\\:has\\(\\[data-setting-row\\]\\)\\)\\>\\[data-none\\]\\]\\:block:not(:has([data-setting-row])) > [data-none]", null, 4, [["display", "block"]]], [".\\[\\&\\>\\*\\]\\:min-h-0 > *", null, 4, [["min-height", "0"]]], [".\\[\\&\\>\\*\\]\\:min-w-0 > *", null, 4, [["min-width", "0"]]], [".\\[\\&\\>\\*\\]\\:flex-1 > *", null, 4, [["flex", "1"]]], [".\\[\\&\\>\\*\\]\\:shrink-0 > *", null, 4, [["flex-shrink", "0"]]], [".\\[\\&\\>li\\]\\:text-\\[0\\.85rem\\] > li", null, 4, [["font-size", ".85rem"]]], [".\\[\\&\\>li\\]\\:leading-\\[1\\.5\\] > li", null, 4, [["--tw-leading", "1.5"], ["line-height", "1.5"]]], [".\\[\\&\\>li\\]\\:text-fg > li", null, 4, [["color", "var(--text)"]]], [".\\[\\&\\>summary\\]\\:flex > summary", null, 4, [["display", "flex"]]], [".\\[\\&\\>summary\\]\\:cursor-pointer > summary", null, 4, [["cursor", "pointer"]]], [".\\[\\&\\>summary\\]\\:list-none > summary", null, 4, [["list-style-type", "none"]]], [".\\[\\&\\>summary\\]\\:items-center > summary", null, 4, [["align-items", "center"]]], [".\\[\\&\\>summary\\]\\:gap-\\[0\\.4rem\\] > summary", null, 4, [["gap", ".4rem"]]], [".\\[\\&\\>summary\\]\\:rounded-ui > summary", null, 4, [["border-radius", "var(--radius)"]]], [".\\[\\&\\>summary\\]\\:px-\\[0\\.4rem\\] > summary", null, 4, [["padding-inline", ".4rem"]]], [".\\[\\&\\>summary\\]\\:py-\\[0\\.25rem\\] > summary", null, 4, [["padding-block", ".25rem"]]], [".\\[\\&\\>summary\\]\\:select-none > summary", null, 4, [["-webkit-user-select", "none"], ["user-select", "none"]]], [".\\[\\&\\>summary\\]\\:before\\:inline-block > summary:before", null, 4, [["content", "var(--tw-content)"], ["display", "inline-block"]]], [".\\[\\&\\>summary\\]\\:before\\:size-\\[0\\.4rem\\] > summary:before", null, 4, [["content", "var(--tw-content)"], ["width", ".4rem"], ["height", ".4rem"]]], [".\\[\\&\\>summary\\]\\:before\\:shrink-0 > summary:before", null, 4, [["content", "var(--tw-content)"], ["flex-shrink", "0"]]], [".\\[\\&\\>summary\\]\\:before\\:\\[transform\\:rotate\\(-45deg\\)\\] > summary:before", null, 4, [["content", "var(--tw-content)"], ["transform", "rotate(-45deg)"]]], [".\\[\\&\\>summary\\]\\:before\\:content-\\[\\'\\'\\] > summary:before", null, 4, [["--tw-content", '""'], ["content", "var(--tw-content)"]]], [".\\[\\&\\>summary\\]\\:before\\:\\[border-bottom\\:1\\.3px_solid_currentColor\\] > summary:before", null, 4, [["content", "var(--tw-content)"], ["border-bottom", "1.3px solid"]]], [".\\[\\&\\>summary\\]\\:before\\:\\[border-right\\:1\\.3px_solid_currentColor\\] > summary:before", null, 4, [["content", "var(--tw-content)"], ["border-right", "1.3px solid"]]], [".\\[\\&\\>summary\\]\\:before\\:\\[transition\\:transform_0\\.15s_ease\\] > summary:before", null, 4, [["content", "var(--tw-content)"], ["transition", "transform .15s"]]], [".\\[\\&\\>summary\\:hover\\]\\:bg-surface-1 > summary:hover", null, 4, [["background-color", "var(--surface-1)"]]], [".\\[\\&\\>summary\\:hover\\]\\:text-fg > summary:hover", null, 4, [["color", "var(--text)"]]], [".\\[\\&\\[open\\]\\>summary\\]\\:before\\:\\[transform\\:rotate\\(45deg\\)\\][open] > summary:before", null, 4, [["content", "var(--tw-content)"], ["transform", "rotate(45deg)"]]], [".app--mobile .\\[\\.app--mobile_\\&\\]\\:min-h-11", null, 4, [["min-height", "calc(var(--spacing) * 11)"]]], [".app--mobile .\\[\\.app--mobile_\\&\\]\\:min-h-\\[44px\\]", null, 4, [["min-height", "44px"]]], [".\\[\\@media\\(hover\\:none\\)\\]\\:opacity-60", ["(hover: none)"], 4, [["opacity", ".6"]]], [".\\[\\@media\\(hover\\:none\\)\\]\\:opacity-100", ["(hover: none)"], 4, [["opacity", "1"]]], [".\\[\\@media\\(max-width\\:700px\\)\\]\\:h-\\[2\\.75rem\\]", ["(max-width: 700px)"], 4, [["height", "2.75rem"]]], [".\\[\\@media\\(max-width\\:700px\\)\\]\\:min-h-\\[2\\.75rem\\]", ["(max-width: 700px)"], 4, [["min-height", "2.75rem"]]], [".\\[\\@media\\(max-width\\:700px\\)\\]\\:w-\\[2\\.75rem\\]", ["(max-width: 700px)"], 4, [["width", "2.75rem"]]], [".\\[\\@media\\(max-width\\:700px\\)\\]\\:min-w-\\[2\\.75rem\\]", ["(max-width: 700px)"], 4, [["min-width", "2.75rem"]]], [".\\[\\@media\\(max-width\\:700px\\)\\]\\:px-\\[0\\.65rem\\]", ["(max-width: 700px)"], 4, [["padding-inline", ".65rem"]]], ["div:hover > .\\[div\\:hover\\>\\&\\]\\:opacity-100", null, 4, [["opacity", "1"]]], [":root", null, 1e3, [["color-scheme", "dark"], ["--scrollbar-size", "6px"], ["--accent", "#c8c8c8"], ["--panel-bg", "#161616"], ["--surface-0", "#262626"], ["--surface-1", "#333"], ["--surface-dim", "#1c1c1c"], ["--backdrop", "#050505"], ["--overlay-0", "#3a3a3a"], ["--overlay-1", "#9b9b9b"], ["--text", "#d8d8d8"], ["--subtext-0", "#9b9b9b"], ["--mauve", "#a993c9"], ["--green", "#7fb685"], ["--yellow", "#d3b46a"], ["--red", "#df8c8c"], ["--blue", "#7aa2d7"], ["--teal", "#7fb8b8"], ["--peach", "#d39a6a"], ["--bg", "var(--panel-bg)"], ["--surface", "var(--surface-0)"], ["--surface-alt", "var(--surface-1)"], ["--border", "var(--overlay-0)"], ["--muted", "var(--subtext-0)"], ["--danger", "var(--red)"], ["--radius", "8px"], ["--radius-pane", "8px"], ["accent-color", "var(--accent)"], ["--font-ui", '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif'], ["--font-mono", `ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono",
    monospace`], ["font-family", "var(--font-ui)"]]], ["code, pre, kbd, samp", null, 1e3, [["font-family", "var(--font-mono)"]]], ["*", null, 1e3, [["box-sizing", "border-box"]]], ["html, body, #root", null, 1e3, [["height", "100%"], ["margin", "0"]]], ["html", null, 1e3, [["overscroll-behavior", "none"], ["--shell-bg", "var(--panel-bg)"]]], ["html[data-glass]", null, 1e3, [["--shell-bg", "var(--panel-bg)"]]], ["html[data-glass]", null, 1e3, [["--shell-bg", "color-mix(in srgb, var(--panel-bg) 86%, transparent)"]]], ["html", null, 1e3, [["--backdrop-bg", "var(--backdrop)"], ["--card-bg", "var(--panel-bg)"]]], ["html[data-glass]", null, 1e3, [["--backdrop-bg", "var(--backdrop)"]]], ["html[data-glass]", null, 1e3, [["--backdrop-bg", "color-mix(in srgb, var(--backdrop) 86%, transparent)"]]], ["html[data-glass]", null, 1e3, [["--card-bg", "var(--panel-bg)"]]], ["html[data-glass]", null, 1e3, [["--card-bg", "color-mix(in srgb, var(--panel-bg) 86%, transparent)"]]], ['body:has(.app--cards, .app--mobile), .app--cards .dock-area:has([data-testid="split-canvas"]:not([data-split="0"]))', null, 1e3, [["background", "var(--backdrop-bg)"]]], ["body", null, 1e3, [["background", "var(--shell-bg)"], ["color", "var(--text)"], ["overscroll-behavior", "none"], ["-webkit-tap-highlight-color", "transparent"], ["line-height", "1.3"]]], [".app", null, 1e3, [["flex-direction", "column"], ["height", "100dvh"], ["display", "flex"]]], [".app--mobile", null, 1e3, [["inset", "var(--visible-top, 0px) 0 auto 0"], ["height", "var(--visible-height, 100dvh)"], ["position", "fixed"]]], [".mobile-drawer-backdrop", null, 1e3, [["animation", ".15s ease-out mobile-fade"]]], [".mobile-drawer--left", null, 1e3, [["animation", ".2s cubic-bezier(.2, .8, .2, 1) mobile-slide-left"]]], [".mobile-drawer--right", null, 1e3, [["animation", ".2s cubic-bezier(.2, .8, .2, 1) mobile-slide-right"]]], [".mobile-sheet", null, 1e3, [["animation", ".22s cubic-bezier(.2, .8, .2, 1) mobile-rise"]]], [".mobile-drawer-backdrop, .mobile-drawer, .mobile-sheet", ["(prefers-reduced-motion: reduce)"], 1e3, [["animation", "none"]]], [".layout-drawer", null, 1e3, [["transform", "translateX(var(--float-hide, 0))"], ["transition", "transform .18s"]]], [".layout-drawer:hover, .layout-drawer:focus-within", null, 1e3, [["--float-hide", "0px"]]], [".dockview-theme-perch", null, 1e3, [["--dv-color-abyss-dark", "var(--panel-bg)"], ["--dv-color-abyss", "var(--surface-0)"], ["--dv-color-abyss-light", "var(--surface-1)"], ["--dv-color-abyss-lighter", "var(--overlay-0)"], ["--dv-color-abyss-accent", "var(--accent)"], ["--dv-color-abyss-primary-text", "var(--text)"], ["--dv-color-abyss-secondary-text", "var(--subtext-0)"], ["--dv-group-view-background-color", "var(--panel-bg)"], ["--dv-tabs-and-actions-container-background-color", "var(--surface-0)"], ["--dv-activegroup-visiblepanel-tab-background-color", "var(--panel-bg)"], ["--dv-activegroup-hiddenpanel-tab-background-color", "var(--surface-0)"], ["--dv-inactivegroup-visiblepanel-tab-background-color", "var(--panel-bg)"], ["--dv-inactivegroup-hiddenpanel-tab-background-color", "var(--surface-0)"], ["--dv-tab-divider-color", "var(--overlay-0)"], ["--dv-activegroup-visiblepanel-tab-color", "var(--text)"], ["--dv-activegroup-hiddenpanel-tab-color", "var(--subtext-0)"], ["--dv-inactivegroup-visiblepanel-tab-color", "var(--subtext-0)"], ["--dv-inactivegroup-hiddenpanel-tab-color", "var(--subtext-0)"], ["--dv-separator-border", "var(--overlay-0)"], ["--dv-paneview-header-border-color", "var(--overlay-0)"], ["--dv-tabs-and-actions-container-font-size", ".82rem"], ["--dv-tabs-and-actions-container-height", "2.1rem"]]], [".dockview-theme-perch .dv-tabs-and-actions-container", null, 1e3, [["z-index", "1"], ["position", "relative"]]], [".pane-tab", null, 1e3, [["align-items", "center"], ["width", "100%"], ["height", "100%"], ["display", "flex"]]], [".pane-tab__agent-badge", null, 1e3, [["color", "var(--subtext-0)"], ["white-space", "nowrap"], ["flex-shrink", "0"], ["margin-right", ".4rem"], ["font-size", ".78em"]]], ['.pane-tab[data-testid="pane-tab-chat"] .dv-default-tab-action', null, 1e3, [["display", "none"]]], [".dockview-group-action", null, 1e3, [["border-radius", "var(--radius)"], ["width", "1.5rem"], ["height", "1.5rem"], ["color", "var(--subtext-0)"], ["cursor", "pointer"], ["background", "none"], ["border", "none"], ["justify-content", "center"], ["align-self", "center"], ["align-items", "center"], ["margin", "0 .15rem"], ["font-size", "1rem"], ["line-height", "1"], ["transition", "color .1s, background .1s"], ["display", "flex"]]], [".dockview-group-action:hover", null, 1e3, [["color", "var(--text)"], ["background", "var(--surface-1)"]]], [".dockview-theme-perch .dv-view-container > .dv-view:has(.dv-inactive-group)", ["(max-width: 700px)"], 1e3, [["display", "none"]]], [".dockview-theme-perch .dv-view-container > .dv-view:has(.dv-active-group)", ["(max-width: 700px)"], 1e3, [["width", "100%", 1], ["left", "0", 1]]], [".chat", null, 1e3, [["isolation", "isolate"], ["flex-direction", "column"], ["flex", "1"], ["height", "100%"], ["min-height", "0"], ["display", "flex"]]], [".message__markdown p", null, 1e3, [["margin", "0 0 .5em"]]], [".message__markdown p:last-child", null, 1e3, [["margin-bottom", "0"]]], [".message__markdown h1, .message__markdown h2, .message__markdown h3, .message__markdown h4", null, 1e3, [["margin", ".6em 0 .3em"], ["line-height", "1.25"]]], [".message__markdown h1", null, 1e3, [["font-size", "1.25em"]]], [".message__markdown h2", null, 1e3, [["font-size", "1.12em"]]], [".message__markdown h3", null, 1e3, [["font-size", "1em"]]], [".message__markdown > * + *", null, 1e3, [["margin-top", ".5em"]]], [".message__markdown table, .md-table", null, 1e3, [["border-collapse", "separate"], ["border-spacing", "0"], ["background", "var(--surface-0)"], ["border-radius", "var(--radius)"], ["max-width", "100%"], ["margin", ".5em 0"], ["font-size", ".92em"], ["display", "block"], ["overflow-x", "auto"]]], [".md-table", null, 1e3, [["width", "100%"], ["margin", "0"], ["display", "table"]]], [".message__markdown th, .message__markdown td, .md-table th, .md-table td", null, 1e3, [["text-align", "left"], ["vertical-align", "top"], ["border-bottom", "1px solid var(--surface-1)"], ["padding", ".35em .75em"]]], [".message__markdown th, .md-table th", null, 1e3, [["color", "var(--subtext-0)"], ["white-space", "nowrap"], ["background", "var(--surface-1)"], ["font-weight", "600"]]], [".message__markdown tbody tr:last-child td, .md-table tbody tr:last-child td", null, 1e3, [["border-bottom", "0"]]], [".message__markdown tbody tr:hover td, .md-table tbody tr:hover td", null, 1e3, [["background", "var(--surface-1)"]]], [".md-table caption", null, 1e3, [["text-align", "left"], ["color", "var(--subtext-0)"], ["padding", ".4em .75em"]]], [".md-code", null, 1e3, [["background", "var(--surface-0)"], ["border-radius", "var(--radius)"], ["overflow", "hidden"]]], [".md-code__bar", null, 1e3, [["color", "var(--subtext-0)"], ["background", "var(--surface-1)"], ["justify-content", "space-between"], ["align-items", "center"], ["padding", ".1rem .4rem .1rem .75rem"], ["font-size", ".75em"], ["display", "flex"]]], [".message__markdown .md-code pre", null, 1e3, [["background", "none"], ["border-radius", "0"], ["margin", "0"]]], [".hl-keyword", null, 1e3, [["color", "var(--mauve)"]]], [".hl-string", null, 1e3, [["color", "var(--green)"]]], [".hl-number", null, 1e3, [["color", "var(--peach)"]]], [".hl-function", null, 1e3, [["color", "var(--blue)"]]], [".hl-type", null, 1e3, [["color", "var(--yellow)"]]], [".hl-tag", null, 1e3, [["color", "var(--teal)"]]], [".hl-comment", null, 1e3, [["color", "var(--overlay-1)"], ["font-style", "italic"]]], [".message__markdown ul, .message__markdown ol", null, 1e3, [["margin", ".3em 0 .5em 1.3em"], ["padding", "0"]]], [".message__markdown li", null, 1e3, [["margin-bottom", ".2em"]]], [".message__markdown code", null, 1e3, [["background", "var(--surface-0)"], ["border-radius", ".25rem"], ["padding", ".1em .35em"], ["font-family", "ui-monospace, SFMono-Regular, SF Mono, Menlo, Consolas, monospace"], ["font-size", ".88em"]]], [".message__markdown pre", null, 1e3, [["background", "var(--surface-0)"], ["border-radius", "var(--radius)"], ["margin", ".4em 0"], ["padding", ".6rem .75rem"], ["position", "relative"], ["overflow-x", "auto"]]], [".message__markdown pre code", null, 1e3, [["background", "none"], ["border", "none"], ["padding", "0"], ["font-size", ".85em"]]], [".message__markdown a", null, 1e3, [["color", "var(--accent)"], ["text-decoration", "underline"]]], [".message__markdown blockquote", null, 1e3, [["border-left", "3px solid var(--overlay-0)"], ["color", "var(--subtext-0)"], ["margin", ".4em 0"], ["padding", ".1em .6em"]]], [".message__markdown hr", null, 1e3, [["border", "none"], ["border-top", "1px solid var(--overlay-0)"], ["margin", ".75em 0"]]], [".file-markdown", null, 1e3, [["overflow-wrap", "anywhere"]]], [".file-markdown img", null, 1e3, [["max-width", "100%"]]], [".file-markdown table", null, 1e3, [["border-collapse", "collapse"], ["margin", ".4em 0"], ["display", "block"], ["overflow-x", "auto"]]], [".file-markdown th, .file-markdown td", null, 1e3, [["border", "1px solid var(--overlay-0)"], ["padding", ".2em .5em"]]], [".file-markdown .md-placeholder", null, 1e3, [["color", "var(--subtext-0)"], ["border", "1px dashed var(--overlay-0)"], ["border-radius", ".25rem"], ["padding", ".05em .35em"], ["font-size", ".9em"]]], [".terminal", null, 1e3, [["min-width", "0"], ["min-height", "0"], ["padding", "var(--terminal-padding, 0)"], ["opacity", "var(--terminal-opacity, 1)"], ["flex", "1"], ["display", "flex"], ["position", "relative"]]], [".terminal__surface", null, 1e3, [["flex", "1"], ["min-width", "0"], ["min-height", "0"], ["overflow", "hidden"]]], [".terminal__surface .xterm", null, 1e3, [["height", "100%"]]], [".terminal__surface .xterm:not(.allow-transparency) .xterm-viewport", null, 1e3, [["background-color", "#0000"]]], [".terminal__surface .xterm-scrollable-element", null, 1e3, [["position", "static", 1]]], [".terminal__surface .xterm-decoration-overview-ruler, .no-pane-scrollbars .terminal__surface .xterm-scrollable-element > .xterm-scrollbar", null, 1e3, [["display", "none"]]], [".terminal--persistent", null, 1e3, [["flex-direction", "column"]]], [".terminal__toolbar", null, 1e3, [["color", "var(--subtext-0)"], ["align-items", "center"], ["gap", ".5rem"], ["padding", ".25rem 1.5rem .25rem .5rem"], ["font-size", ".8rem"], ["display", "flex"]]], [".terminal__toolbar button", null, 1e3, [["border-radius", "var(--radius)"], ["min-height", "32px"], ["color", "var(--text)"], ["background", "var(--surface-0)"], ["border", "0"], ["padding", ".25rem .5rem"]]], [".terminal__toolbar--overlay", null, 1e3, [["z-index", "2"], ["border-radius", "var(--radius)"], ["background", "var(--surface-1)"], ["padding", ".2rem .3rem .2rem .6rem"], ["position", "absolute"], ["top", ".4rem"], ["right", ".9rem"], ["box-shadow", "0 2px 8px #00000040"]]], [".terminal__connection", null, 1e3, [["margin-right", "auto"]]], [".terminal__toolbar button:disabled", null, 1e3, [["opacity", ".5"]]], [".terminal__notice", null, 1e3, [["color", "var(--subtext-0)"], ["padding", ".75rem"], ["font-size", ".85rem"]]], [".app--mobile .terminal__toolbar button", null, 1e3, [["min-height", "44px"]]], [".app--mobile .terminal__connection", null, 1e3, [["display", "none"]]], [".app--mobile .terminal__toolbar", null, 1e3, [["padding-right", ".5rem"]]], [".terminal__exited", null, 1e3, [["background", "var(--surface-1)"], ["border-radius", "var(--radius)"], ["color", "var(--subtext-0)"], ["padding", ".35rem .75rem"], ["font-size", ".85rem"], ["position", "absolute"], ["bottom", ".75rem"], ["left", "50%"], ["transform", "translateX(-50%)"]]], [".terminal__exited--cli", null, 1e3, [["background", "var(--panel-bg)"], ["flex-direction", "column"], ["align-items", "center"], ["gap", ".6rem"], ["padding", ".9rem 1.1rem"], ["display", "flex"], ["top", "50%"], ["bottom", "auto"], ["transform", "translate(-50%, -50%)"], ["box-shadow", "0 6px 24px #00000059"]]], [".terminal__exited-actions", null, 1e3, [["gap", ".5rem"], ["display", "flex"]]], [".terminal__cli-error", null, 1e3, [["background", "var(--red)"], ["position", "absolute"], ["bottom", ".75rem"], ["left", "50%"], ["transform", "translateX(-50%)"]]], [".terminal__cli-error", null, 1e3, [["background", "color-mix(in srgb, var(--red) 20%, var(--panel-bg))"]]], [".terminal__cli-error", null, 1e3, [["border-radius", "var(--radius)"], ["color", "var(--red)"], ["text-align", "center"], ["white-space", "pre-wrap"], ["word-break", "break-word"], ["max-width", "90%"], ["padding", ".35rem .75rem"], ["font-size", ".85rem"]]], [".mobile-pane-shell__content > .chat, .mobile-pane-shell__content > .terminal, .mobile-pane-shell__content > .workspace-files, .mobile-pane-shell__content > .workspace-git", null, 1e3, [["flex", "1"], ["width", "100%"], ["min-width", "0"], ["height", "100%"], ["min-height", "0"]]], [".terminal__host", null, 1e3, [["width", "100%"], ["height", "100%"], ["overflow", "hidden"]]], [".workspace-git", null, 1e3, [["--git-border", "var(--overlay-0)"]]], [".workspace-git", null, 1e3, [["--git-border", "color-mix(in srgb, var(--overlay-0) 72%, transparent)"]]], [".workspace-git", null, 1e3, [["--git-muted", "var(--subtext-0)"], ["width", "100%"], ["min-width", "0"], ["height", "100%"], ["min-height", "0"], ["color", "var(--text)"], ["background", "var(--workspace-tools-bg, var(--panel-bg))"], ["flex-direction", "column"], ["font-size", ".78rem"], ["display", "flex"], ["position", "relative"], ["overflow", "hidden"], ["container-type", "inline-size"]]], [".workspace-git button, .workspace-git input, .workspace-git textarea", null, 1e3, [["font", "inherit"]]], [".workspace-git button", null, 1e3, [["cursor", "pointer"]]], ['.workspace-git button:focus-visible, .workspace-git input:focus-visible, .workspace-git textarea:focus-visible, .workspace-git [role="button"]:focus-visible', null, 1e3, [["outline", "2px solid var(--accent)"], ["outline-offset", "1px"]]], [".workspace-git__diff", null, 1e3, [["container-type", "inline-size"]]], [".workspace-git__line-comment-thread", null, 1e3, [["max-width", "max(0px, min(42rem, 100cqi - 6.9rem))"], ["position", "sticky"], ["left", "0"]]], [".workspace-git__comment-composer", null, 1e3, [["max-width", "max(0px, 100cqi - 1.4rem)"], ["position", "sticky"], ["left", "0"]]], [".dockview-group-action--split-session", null, 1e3, [["font-size", "13px"]]], [".session-split-popover", null, 1e3, [["display", "flex"], ["flex-direction", "column"], ["background", "var(--surface-1)"], ["border-radius", "var(--radius)"], ["box-shadow", "0 8px 24px rgba(0, 0, 0, 0.45)"], ["padding", "4px"], ["font-size", "12.5px"], ["color", "var(--text)"], ["overflow", "hidden"]]], [".session-split-popover__header", null, 1e3, [["padding", "6px 8px 4px"], ["font-size", "11px"], ["text-transform", "uppercase"], ["letter-spacing", "0.04em"], ["color", "var(--subtext-0)"]]], [".session-split-popover__empty", null, 1e3, [["padding", "8px"], ["color", "var(--subtext-0)"]]], [".session-split-popover__list", null, 1e3, [["overflow-y", "auto"]]], [".session-split-popover__item", null, 1e3, [["display", "flex"], ["flex-direction", "column"], ["align-items", "flex-start"], ["gap", "1px"], ["width", "100%"], ["padding", "6px 8px"], ["border", "none"], ["border-radius", "4px"], ["background", "transparent"], ["color", "inherit"], ["text-align", "left"], ["cursor", "grab"]]], [".session-split-popover__item:hover", null, 1e3, [["background", "var(--surface-0)"]]], [".session-split-popover__item-title", null, 1e3, [["font-weight", "500"], ["white-space", "nowrap"], ["overflow", "hidden"], ["text-overflow", "ellipsis"], ["max-width", "100%"]]], [".session-split-popover__item-cwd", null, 1e3, [["font-size", "11px"], ["color", "var(--subtext-0)"], ["white-space", "nowrap"], ["overflow", "hidden"], ["text-overflow", "ellipsis"], ["max-width", "100%"]]], [".session-split-popover__item-badge", null, 1e3, [["align-self", "flex-end"], ["font-size", "10px"], ["color", "var(--accent)"], ["margin-top", "-14px"]]], [".inactive-session-pane", null, 1e3, [["display", "flex"], ["flex-direction", "column"], ["align-items", "center"], ["justify-content", "center"], ["gap", "10px"], ["height", "100%"], ["padding", "24px"], ["text-align", "center"], ["color", "var(--subtext-0)"]]], [".inactive-session-pane__title", null, 1e3, [["font-size", "14px"], ["font-weight", "500"], ["color", "var(--text)"]]], [".inactive-session-pane__cwd", null, 1e3, [["font-size", "12px"], ["color", "var(--subtext-0)"], ["word-break", "break-all"]]], [".inactive-session-pane__note", null, 1e3, [["font-size", "12px"], ["max-width", "320px"], ["line-height", "1.5"]]], [".inactive-session-pane__switch", null, 1e3, [["margin-top", "4px"], ["padding", "6px 14px"], ["border-radius", "var(--radius)"], ["border", "0"], ["background", "var(--surface-0)"], ["color", "var(--text)"], ["cursor", "pointer"], ["font-size", "12.5px"]]], [".inactive-session-pane__switch:hover", null, 1e3, [["background", "var(--surface-1)"]]]], skipped: { "@supports evaluated false": 2, "@container": 6, "@keyframes": 9 }, digest: "2e058a4f3cab4539" };
//! The app's compiled stylesheet as a table (`build.mjs` writes it from Vite + Tailwind's output and bundles it as
//! `virtual:perch-css-table`), parsed once on first use.
const qa = globalThis[Symbol.for("perch.styleSheets")] ??= /* @__PURE__ */ new Map();
let kl = null;
function fb() {
  return kl || (kl = Ya.digest && qa.get(Ya.digest) || new xg(Ya), Ya.digest && !qa.has(Ya.digest) && (qa.size >= 4 && qa.delete(qa.keys().next().value), qa.set(Ya.digest, kl)), kl);
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
let Yn = Qa.NoEventPriority;
function mb(n, l) {
  const i = /* @__PURE__ */ new Set([...Object.keys(n), ...Object.keys(l)]);
  for (const o of i) {
    if (o === "children") continue;
    const s = n[o], u = l[o];
    if (!(s === u || typeof s == "function" && typeof u == "function") && !(o === "style" && s && u && typeof s == "object" && typeof u == "object" && [.../* @__PURE__ */ new Set([...Object.keys(s), ...Object.keys(u)])].every((f) => s[f] === u[f])))
      return !0;
  }
  return !1;
}
const pb = (n) => !n.props.disabled && (/^(button|input|select|textarea)$/.test(n.tagName) || n.tagName === "a" && n.props.href != null || n.props.tabIndex != null);
function wf(n, l) {
  for (const i of U0(l.dangerouslySetInnerHTML?.__html, n.ownerDocument) ?? []) n.appendChild(i);
  return n;
}
const gm = {
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
  createInstance: (n, l, i) => wf(new Zt(n, l, i.ownerDocument), l),
  createTextInstance: (n, l) => new fi(n),
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
      wf(n, o);
    }
    mb(i, o) && n.touch();
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
    Yn = n;
  },
  getCurrentUpdatePriority: () => Yn,
  resolveUpdatePriority: () => Yn !== Qa.NoEventPriority ? Yn : Qa.DefaultEventPriority,
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
};
let pe = nm(gm), Es = 0;
function _f() {
  pe.isAlreadyRendering() && (pe = nm(gm), Es += 1, Yn = Qa.NoEventPriority);
}
const Rl = (n, l, i = null) => pe.createPortal(n, l, null, i), hb = {
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
}, gb = /* @__PURE__ */ new Set(["click", "dblclick", "mousedown", "mouseup"]), bb = /* @__PURE__ */ new Set(["button", "input", "select", "textarea", "fieldset"]), vb = (n) => {
  for (let l = n; l instanceof Zt; l = l.parentNode) if (l.props.disabled && bb.has(l.tagName)) return !0;
  return !1;
};
class yb {
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
function Gr(n, l, i) {
  l.currentTarget = n;
  for (const { type: o, listener: s, capture: u } of [...n.listeners ?? []])
    o === l.type && u === i && s.call(n, l);
  if (n instanceof Zt) {
    const o = hb[l.type], s = o && n.props[i ? `${o}Capture` : o];
    typeof s == "function" && s(l);
  }
}
function jx(n, l, i = {}) {
  const { document: o, window: s, globals: u } = Q0(n), m = new Zt("div", { id: "root", style: i.container ?? {} }, o);
  o.body.appendChild(m);
  const f = [];
  let p = null;
  const x = () => [o, s].map((b) => b.listeners.map((g) => `${g.type}:${g.capture}`).sort().join(",")).join("|");
  let _ = "";
  const k = {}, y = `m${Math.random().toString(36).slice(2, 10)}:`;
  let S = 0, z = -1;
  o.measureKey = (b) => y + b.id, o.stale = () => z !== S, o.computed = (b) => {
    if (!k.cascade || !k.top) return null;
    const g = [];
    for (let N = b; N instanceof Zt && N !== o.body; N = N.parentNode) g.unshift(N);
    let w = k.top;
    for (const N of g) w = k.cascade.compute(N, w);
    return w.values;
  };
  const j = () => (S += 1, p = db(o, n, fb(), k, i.names), _ = x(), n.render?.(p), p);
  _f();
  const T = Es, A = () => (_f(), T === Es), R = () => {
    A() && (pe.flushPassiveEffects(), pe.flushSyncWork(), x() !== _ && j());
  };
  o.afterCommit = j;
  const B = (b) => {
    f.push(b), n.error?.(b);
  }, Z = pe.createContainer(m, Qa.ConcurrentRoot, null, !1, null, "", B, B, B, null);
  pe.updateContainerSync(J.createElement(l, i.props ?? {}), Z, null, null), pe.flushSyncWork(), R();
  const F = (b) => {
    const g = (w) => {
      if (w.id === b) return w;
      for (const N of w.children) {
        const E = g(N);
        if (E) return E;
      }
      return null;
    };
    return g(o.documentElement);
  }, D = (b) => {
    if (!A()) return;
    const g = Yn;
    Yn = Qa.DiscreteEventPriority;
    try {
      return b();
    } finally {
      Yn = g, pe.flushSyncWork(), R();
    }
  }, h = {
    document: o,
    window: s,
    /** What `window`, `document` and `localStorage` read while this screen runs (`dom.mjs`'s `GLOBALS`). */
    globals: u,
    container: m,
    errors: f,
    /** The latest description (after the last commit or state change). */
    get description() {
      return p;
    },
    describe: j,
    /** Runs a DOM event of `type` at node `id`; false when the node is gone. */
    dispatch(b, g, w = {}) {
      const N = typeof b == "string" ? F(b) : b;
      if (!N || gb.has(g) && vb(N)) return !1;
      const E = new yb(g, w, N), O = [];
      for (let U = N; U; U = g === "scroll" ? null : U.parentNode) O.push(U);
      const Q = [...O, o, s];
      D(() => {
        for (let U = Q.length - 1; U > 0 && !E.propagationStopped; U--) Gr(Q[U], E, !0);
        E.propagationStopped || (Gr(N, E, !0), E.propagationStopped || Gr(N, E, !1));
        for (let U = 1; U < Q.length && !E.propagationStopped; U++) Gr(Q[U], E, !1);
      });
      const W = g === "click" && !E.defaultPrevented ? ys(N) : null;
      if (W && h.dispatch(W, "submit", {}), g === "click" && !E.defaultPrevented)
        for (let U = N; U; U = U.parentNode) {
          if (U.tagName !== "a") continue;
          const V = U.props?.href;
          typeof V == "string" && /^https:\/\/\S+$/.test(V) && n.openLink?.(V);
          break;
        }
      return !E.defaultPrevented;
    },
    /** Whether the source listens for `type` on `window` or `document` (a page recording a key press does). */
    listensFor: (b) => [o, s].some((g) => g.listeners.some((w) => w.type === b)),
    /** A key pressed while the screen has the keyboard (`init`: the DOM's `key`, modifiers, `repeat`), at the
     * focused element. When nothing prevented it and that element is a text field, the key edits the field as a
     * browser would: a character is typed at the end (or replaces the text when all of it is selected), Backspace
     * deletes the last one, and the field gets `input` and `change` events with its new `value`. Returns whether the
     * source took the key (prevented it, or a field changed). */
    key(b) {
      const g = o.activeElement && o.activeElement !== o.body ? o.activeElement : o.body;
      if (!h.dispatch(g, "keydown", b)) return !0;
      const N = b.key === "Enter" && !b.isComposing ? ys(g, !0) : null;
      if (N)
        return h.dispatch(N, "submit", {}), !0;
      if (!tm(g) || g.props.disabled || g.props.readOnly) return !1;
      if ((b.ctrlKey || b.metaKey) && !b.altKey && !b.shiftKey && b.key.toLowerCase() === "a")
        return g.selectedAll = !0, !0;
      if (b.ctrlKey || b.metaKey) return !1;
      const E = g.selectedAll;
      g.selectedAll = !1;
      const O = g.value, W = b.key === "Backspace" || E && b.key === "Delete" ? E ? "" : O.slice(0, -1) : [...b.key].length === 1 ? (E ? "" : O) + b.key : O;
      return W === O ? !1 : (g.value = W, h.dispatch(g, "input", { data: b.key }), h.dispatch(g, "change", {}), g.props.value !== void 0 && delete g.edit, g.touch(), j(), !0);
    },
    /** The engine's box for node `id` (window coordinates, logical px), for `getBoundingClientRect`. */
    setBounds(b, g) {
      const w = F(b);
      w && (w.bounds = { x: g.x, y: g.y, width: g.width, height: g.height });
    },
    /** A click on a check box or radio button (`id`): the `click` event, then, unless the source prevented it, the
     * box ticked as a browser ticks it (a radio button only on), with `input` and `change` events. */
    toggle(b) {
      const g = F(b);
      if (!g || g.props.disabled || !h.dispatch(b, "click", { button: 0, detail: 1 })) return;
      const w = g.props.type === "radio";
      w && g.checked || (g.checked = w ? !0 : !g.checked, h.dispatch(b, "input", {}), h.dispatch(b, "change", {}), g.props.checked !== void 0 && delete g.ticked, g.touch(), j());
    },
    /** A left click as the engine reports one: press then release on the same node. */
    click(b, g = {}) {
      const w = { button: 0, buttons: 1, pointerType: "mouse", ...g };
      for (const N of ["pointerdown", "mousedown", "pointerup", "mouseup", "click"]) h.dispatch(b, N, w);
    },
    /** The pointer entered (`on`) or left node `id` (one the description marks `track_hover`): its `:hover` state,
     * which a descendant's group variant reads. The element's own `hover:` styles are the engine's hover style. */
    /** Whether the pointer is over node `id`, as `hover` last said. */
    hovered: (b) => !!F(b)?.state.hover,
    hover(b, g) {
      const w = F(b);
      !w || w.state.hover === g || (w.state.hover = g, w.touch(), j());
    },
    focus(b) {
      const g = F(b);
      g && (D(() => {
        const w = o.activeElement;
        w && w !== g && w !== o.body && h.dispatch(w, "blur"), o.focus(g), h.dispatch(g, "focus");
      }), j());
    },
    /** A press at node `id` that nothing prevented: the browser's default focuses the element pressed. Only an element
     * that listens for keys (`onKeyDown`) is focused, so a press elsewhere leaves the keyboard where it was; the focus
     * is not `:focus-visible`, as after a pointer press in a browser. */
    // ponytail: a browser focuses every focusable element pressed; here only one with its own key handler, so a
    // screen's ordinary buttons do not take the keyboard from a terminal.
    pressFocus(b) {
      let w = typeof b == "string" ? F(b) : b;
      for (; w && !(w instanceof Zt && typeof w.props.onKeyDown == "function" && pb(w)); ) w = w.parentNode;
      !w || w === o.activeElement || (h.focus(w.id), w.state.pointerFocus = !0, w.touch(), j());
    },
    /** The engine is drawing the latest description: the boxes measured in this frame's layout are the tree's.
     * Returns whether effects wait for that layout (`measured`); run them with `retry` once the frame is drawn. */
    drawing() {
      return z = S, o.retries.length > 0;
    },
    /** Runs the effects that waited for a fresh layout. */
    retry() {
      const b = o.retries.splice(0);
      for (const g of b) g();
    },
    /** Runs effects React has scheduled (the engine calls it after a frame). */
    flush: R,
    /** React was replaced since this tree was mounted (`fresh`): the tree is to be mounted again. */
    dead: () => !A(),
    update(b) {
      A() && (pe.updateContainerSync(J.createElement(l, b ?? {}), Z, null, null), pe.flushSyncWork(), R());
    },
    unmount() {
      A() && (pe.updateContainerSync(null, Z, null, null), pe.flushSyncWork(), pe.flushPassiveEffects()), o.afterCommit = null, o.retries.length = 0, n.forgetBounds?.(y);
    }
  };
  return h;
}
//! `react-dom` for a screen on the native renderer: `createPortal` (into `document.body`, the overlay layer) and
//! `flushSync`. Nothing of the browser renderer.
const bm = (n) => pe.flushSyncFromReconciler(n), xb = { createPortal: Rl, flushSync: bm }, Ox = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  createPortal: Rl,
  default: xb,
  flushSync: bm
}, Symbol.toStringTag, { value: "Module" }));
function vm(n) {
  var l, i, o = "";
  if (typeof n == "string" || typeof n == "number") o += n;
  else if (typeof n == "object") if (Array.isArray(n)) {
    var s = n.length;
    for (l = 0; l < s; l++) n[l] && (i = vm(n[l])) && (o && (o += " "), o += i);
  } else for (i in n) n[i] && (o && (o += " "), o += i);
  return o;
}
function ym() {
  for (var n, l, i = 0, o = "", s = arguments.length; i < s; i++) (n = arguments[i]) && (l = vm(n)) && (o && (o += " "), o += l);
  return o;
}
const wb = (n, l) => {
  const i = new Array(n.length + l.length);
  for (let o = 0; o < n.length; o++)
    i[o] = n[o];
  for (let o = 0; o < l.length; o++)
    i[n.length + o] = l[o];
  return i;
}, _b = (n, l) => ({
  classGroupId: n,
  validator: l
}), xm = (n = /* @__PURE__ */ new Map(), l = null, i) => ({
  nextPart: n,
  validators: l,
  classGroupId: i
}), oi = "-", kf = [], kb = "arbitrary..", Sb = (n) => {
  const l = zb(n), {
    conflictingClassGroups: i,
    conflictingClassGroupModifiers: o
  } = n;
  return {
    getClassGroupId: (m) => {
      if (m.startsWith("[") && m.endsWith("]"))
        return Eb(m);
      const f = m.split(oi), p = f[0] === "" && f.length > 1 ? 1 : 0;
      return wm(f, p, l);
    },
    getConflictingClassGroupIds: (m, f) => {
      if (f) {
        const p = o[m], x = i[m];
        return p ? x ? wb(x, p) : p : x || kf;
      }
      return i[m] || kf;
    }
  };
}, wm = (n, l, i) => {
  if (n.length - l === 0)
    return i.classGroupId;
  const s = n[l], u = i.nextPart.get(s);
  if (u) {
    const x = wm(n, l + 1, u);
    if (x) return x;
  }
  const m = i.validators;
  if (m === null)
    return;
  const f = l === 0 ? n.join(oi) : n.slice(l).join(oi), p = m.length;
  for (let x = 0; x < p; x++) {
    const _ = m[x];
    if (_.validator(f))
      return _.classGroupId;
  }
}, Eb = (n) => n.slice(1, -1).indexOf(":") === -1 ? void 0 : (() => {
  const l = n.slice(1, -1), i = l.indexOf(":"), o = l.slice(0, i);
  return o ? kb + o : void 0;
})(), zb = (n) => {
  const {
    theme: l,
    classGroups: i
  } = n;
  return Nb(i, l);
}, Nb = (n, l) => {
  const i = xm();
  for (const o in n) {
    const s = n[o];
    Vs(s, i, o, l);
  }
  return i;
}, Vs = (n, l, i, o) => {
  const s = n.length;
  for (let u = 0; u < s; u++) {
    const m = n[u];
    Tb(m, l, i, o);
  }
}, Tb = (n, l, i, o) => {
  if (typeof n == "string") {
    Mb(n, l, i);
    return;
  }
  if (typeof n == "function") {
    Cb(n, l, i, o);
    return;
  }
  Ab(n, l, i, o);
}, Mb = (n, l, i) => {
  const o = n === "" ? l : _m(l, n);
  o.classGroupId = i;
}, Cb = (n, l, i, o) => {
  if (jb(n)) {
    Vs(n(o), l, i, o);
    return;
  }
  l.validators === null && (l.validators = []), l.validators.push(_b(i, n));
}, Ab = (n, l, i, o) => {
  const s = Object.entries(n), u = s.length;
  for (let m = 0; m < u; m++) {
    const [f, p] = s[m];
    Vs(p, _m(l, f), i, o);
  }
}, _m = (n, l) => {
  let i = n;
  const o = l.split(oi), s = o.length;
  for (let u = 0; u < s; u++) {
    const m = o[u];
    let f = i.nextPart.get(m);
    f || (f = xm(), i.nextPart.set(m, f)), i = f;
  }
  return i;
}, jb = (n) => "isThemeGetter" in n && n.isThemeGetter === !0, Ob = (n) => {
  if (n < 1)
    return {
      get: () => {
      },
      set: () => {
      }
    };
  let l = 0, i = /* @__PURE__ */ Object.create(null), o = /* @__PURE__ */ Object.create(null);
  const s = (u, m) => {
    i[u] = m, l++, l > n && (l = 0, o = i, i = /* @__PURE__ */ Object.create(null));
  };
  return {
    get(u) {
      let m = i[u];
      if (m !== void 0)
        return m;
      if ((m = o[u]) !== void 0)
        return s(u, m), m;
    },
    set(u, m) {
      u in i ? i[u] = m : s(u, m);
    }
  };
}, zs = "!", Sf = ":", Rb = [], Ef = (n, l, i, o, s) => ({
  modifiers: n,
  hasImportantModifier: l,
  baseClassName: i,
  maybePostfixModifierPosition: o,
  isExternal: s
}), Db = (n) => {
  const {
    prefix: l,
    experimentalParseClassName: i
  } = n;
  let o = (s) => {
    const u = [];
    let m = 0, f = 0, p = 0, x;
    const _ = s.length;
    for (let j = 0; j < _; j++) {
      const T = s[j];
      if (m === 0 && f === 0) {
        if (T === Sf) {
          u.push(s.slice(p, j)), p = j + 1;
          continue;
        }
        if (T === "/") {
          x = j;
          continue;
        }
      }
      T === "[" ? m++ : T === "]" ? m-- : T === "(" ? f++ : T === ")" && f--;
    }
    const k = u.length === 0 ? s : s.slice(p);
    let y = k, S = !1;
    k.endsWith(zs) ? (y = k.slice(0, -1), S = !0) : (
      /**
       * In Tailwind CSS v3 the important modifier was at the start of the base class name. This is still supported for legacy reasons.
       * @see https://github.com/dcastil/tailwind-merge/issues/513#issuecomment-2614029864
       */
      k.startsWith(zs) && (y = k.slice(1), S = !0)
    );
    const z = x && x > p ? x - p : void 0;
    return Ef(u, S, y, z);
  };
  if (l) {
    const s = l + Sf, u = o;
    o = (m) => m.startsWith(s) ? u(m.slice(s.length)) : Ef(Rb, !1, m, void 0, !0);
  }
  if (i) {
    const s = o;
    o = (u) => i({
      className: u,
      parseClassName: s
    });
  }
  return o;
}, Hb = (n) => {
  const l = /* @__PURE__ */ new Map();
  return n.orderSensitiveModifiers.forEach((i, o) => {
    l.set(i, 1e6 + o);
  }), (i) => {
    const o = [];
    let s = [];
    for (let u = 0; u < i.length; u++) {
      const m = i[u], f = m[0] === "[", p = l.has(m);
      f || p ? (s.length > 0 && (s.sort(), o.push(...s), s = []), o.push(m)) : s.push(m);
    }
    return s.length > 0 && (s.sort(), o.push(...s)), o;
  };
}, Bb = (n) => ({
  cache: Ob(n.cacheSize),
  parseClassName: Db(n),
  sortModifiers: Hb(n),
  postfixLookupClassGroupIds: Ub(n),
  ...Sb(n)
}), Ub = (n) => {
  const l = /* @__PURE__ */ Object.create(null), i = n.postfixLookupClassGroups;
  if (i)
    for (let o = 0; o < i.length; o++)
      l[i[o]] = !0;
  return l;
}, Gb = /\s+/, Yb = (n, l) => {
  const {
    parseClassName: i,
    getClassGroupId: o,
    getConflictingClassGroupIds: s,
    sortModifiers: u,
    postfixLookupClassGroupIds: m
  } = l, f = [], p = n.trim().split(Gb);
  let x = "";
  for (let _ = p.length - 1; _ >= 0; _ -= 1) {
    const k = p[_], {
      isExternal: y,
      modifiers: S,
      hasImportantModifier: z,
      baseClassName: j,
      maybePostfixModifierPosition: T
    } = i(k);
    if (y) {
      x = k + (x.length > 0 ? " " + x : x);
      continue;
    }
    let A = !!T, R;
    if (A) {
      const h = j.substring(0, T);
      R = o(h);
      const b = R && m[R] ? o(j) : void 0;
      b && b !== R && (R = b, A = !1);
    } else
      R = o(j);
    if (!R) {
      if (!A) {
        x = k + (x.length > 0 ? " " + x : x);
        continue;
      }
      if (R = o(j), !R) {
        x = k + (x.length > 0 ? " " + x : x);
        continue;
      }
      A = !1;
    }
    const B = S.length === 0 ? "" : S.length === 1 ? S[0] : u(S).join(":"), Z = z ? B + zs : B, F = Z + R;
    if (f.indexOf(F) > -1)
      continue;
    f.push(F);
    const D = s(R, A);
    for (let h = 0; h < D.length; ++h) {
      const b = D[h];
      f.push(Z + b);
    }
    x = k + (x.length > 0 ? " " + x : x);
  }
  return x;
}, qb = (...n) => {
  let l = 0, i, o, s = "";
  for (; l < n.length; )
    (i = n[l++]) && (o = km(i)) && (s && (s += " "), s += o);
  return s;
}, km = (n) => {
  if (typeof n == "string")
    return n;
  let l, i = "";
  for (let o = 0; o < n.length; o++)
    n[o] && (l = km(n[o])) && (i && (i += " "), i += l);
  return i;
}, Lb = (n, ...l) => {
  let i, o, s, u;
  const m = (p) => {
    const x = l.reduce((_, k) => k(_), n());
    return i = Bb(x), o = i.cache.get, s = i.cache.set, u = f, f(p);
  }, f = (p) => {
    const x = o(p);
    if (x)
      return x;
    const _ = Yb(p, i);
    return s(p, _), _;
  };
  return u = m, (...p) => u(qb(...p));
}, Qb = [], Ft = (n) => {
  const l = (i) => i[n] || Qb;
  return l.isThemeGetter = !0, l.themeKey = n, l;
}, Sm = /^\[(?:(\w[\w-]*):)?(.+)\]$/i, Em = /^\((?:(\w[\w-]*):)?(.+)\)$/i, Vb = /^\d+(?:\.\d+)?\/\d+(?:\.\d+)?$/, Kb = /^(\d+(\.\d+)?)?(xs|sm|md|lg|xl)$/, Xb = /\d+(%|px|r?em|[sdl]?v([hwib]|min|max)|pt|pc|in|cm|mm|cap|ch|ex|r?lh|cq(w|h|i|b|min|max))|\b(calc|min|max|clamp)\(.+\)|^0$/, Zb = /^(rgba?|hsla?|hwb|(ok)?(lab|lch)|color-mix|color|light-dark)\(.+\)$/, Jb = /^(inset_)?-?((\d+)?\.?(\d+)[a-z]+|0)_-?((\d+)?\.?(\d+)[a-z]+|0)/, Wb = /^(url|image|image-set|cross-fade|element|(repeating-)?(linear|radial|conic)-gradient)\(.+\)$/, Dn = (n) => Vb.test(n), yt = (n) => !!n && !Number.isNaN(Number(n)), Fe = (n) => !!n && Number.isInteger(Number(n)), cs = (n) => n.endsWith("%") && yt(n.slice(0, -1)), pn = (n) => Kb.test(n), zm = () => !0, Fb = (n) => (
  // `colorFunctionRegex` check is necessary because color functions can have percentages in them which which would be incorrectly classified as lengths.
  // For example, `hsl(0 0% 0%)` would be classified as a length without this check.
  // I could also use lookbehind assertion in `lengthUnitRegex` but that isn't supported widely enough.
  Xb.test(n) && !Zb.test(n)
), Ks = () => !1, $b = (n) => Jb.test(n), Ib = (n) => Wb.test(n), Pb = (n) => !rt(n) && !it(n), tv = (n) => n.startsWith("@container") && (n[10] === "/" && n[11] !== void 0 || n[11] === "s" && n[16] !== void 0 && n.startsWith("-size/", 10) || n[11] === "n" && n[18] !== void 0 && n.startsWith("-normal/", 10)), ev = (n) => Ln(n, Mm, Ks), rt = (n) => Sm.test(n), ca = (n) => Ln(n, Cm, Fb), zf = (n) => Ln(n, cv, yt), nv = (n) => Ln(n, jm, zm), av = (n) => Ln(n, Am, Ks), Nf = (n) => Ln(n, Nm, Ks), lv = (n) => Ln(n, Tm, Ib), Yr = (n) => Ln(n, Om, $b), it = (n) => Em.test(n), Sl = (n) => fa(n, Cm), rv = (n) => fa(n, Am), Tf = (n) => fa(n, Nm), iv = (n) => fa(n, Mm), ov = (n) => fa(n, Tm), qr = (n) => fa(n, Om, !0), sv = (n) => fa(n, jm, !0), Ln = (n, l, i) => {
  const o = Sm.exec(n);
  return o ? o[1] ? l(o[1]) : i(o[2]) : !1;
}, fa = (n, l, i = !1) => {
  const o = Em.exec(n);
  return o ? o[1] ? l(o[1]) : i : !1;
}, Nm = (n) => n === "position" || n === "percentage", Tm = (n) => n === "image" || n === "url", Mm = (n) => n === "length" || n === "size" || n === "bg-size", Cm = (n) => n === "length", cv = (n) => n === "number", Am = (n) => n === "family-name", jm = (n) => n === "number" || n === "weight", Om = (n) => n === "shadow", uv = () => {
  const n = Ft("color"), l = Ft("font"), i = Ft("text"), o = Ft("font-weight"), s = Ft("tracking"), u = Ft("leading"), m = Ft("breakpoint"), f = Ft("container"), p = Ft("spacing"), x = Ft("radius"), _ = Ft("shadow"), k = Ft("inset-shadow"), y = Ft("text-shadow"), S = Ft("drop-shadow"), z = Ft("blur"), j = Ft("perspective"), T = Ft("aspect"), A = Ft("ease"), R = Ft("animate"), B = () => ["auto", "avoid", "all", "avoid-page", "page", "left", "right", "column"], Z = () => [
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
  ], F = () => [...Z(), it, rt], D = () => ["auto", "hidden", "clip", "visible", "scroll"], h = () => ["auto", "contain", "none"], b = () => [it, rt, p], g = () => [Dn, "full", "auto", ...b()], w = () => [Fe, "none", "subgrid", it, rt], N = () => ["auto", {
    span: ["full", Fe, it, rt]
  }, Fe, it, rt], E = () => [Fe, "auto", it, rt], O = () => ["auto", "min", "max", "fr", it, rt], Q = () => ["start", "end", "center", "between", "around", "evenly", "stretch", "baseline", "center-safe", "end-safe"], W = () => ["start", "end", "center", "stretch", "center-safe", "end-safe"], U = () => ["auto", ...b()], V = () => [Dn, "auto", "full", "dvw", "dvh", "lvw", "lvh", "svw", "svh", "min", "max", "fit", ...b()], I = () => [f, Dn, "screen", "full", "dvw", "lvw", "svw", "min", "max", "fit", ...b()], L = () => [Dn, "screen", "full", "lh", "dvh", "lvh", "svh", "min", "max", "fit", ...b()], K = () => [n, it, rt], M = () => [...Z(), Tf, Nf, {
    position: [it, rt]
  }], X = () => ["no-repeat", {
    repeat: ["", "x", "y", "space", "round"]
  }], at = () => ["auto", "cover", "contain", iv, ev, {
    size: [it, rt]
  }], st = () => [cs, Sl, ca], ct = () => [
    // Deprecated since Tailwind CSS v4.0.0
    "",
    "none",
    "full",
    x,
    it,
    rt
  ], ut = () => ["", yt, Sl, ca], Et = () => ["solid", "dashed", "dotted", "double"], $t = () => ["normal", "multiply", "screen", "overlay", "darken", "lighten", "color-dodge", "color-burn", "hard-light", "soft-light", "difference", "exclusion", "hue", "saturation", "color", "luminosity"], ht = () => [yt, cs, Tf, Nf], Vn = () => [
    // Deprecated since Tailwind CSS v4.0.0
    "",
    "none",
    z,
    it,
    rt
  ], Kn = () => ["none", yt, it, rt], De = () => ["none", yt, it, rt], He = () => [yt, it, rt], gn = () => [Dn, "full", ...b()];
  return {
    cacheSize: 500,
    theme: {
      animate: ["spin", "ping", "pulse", "bounce"],
      aspect: ["video"],
      blur: [pn],
      breakpoint: [pn],
      color: [zm],
      container: [pn],
      "drop-shadow": [pn],
      ease: ["in", "out", "in-out"],
      font: [Pb],
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
        aspect: ["auto", "square", Dn, rt, it, T]
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
      "container-named": [tv],
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
        object: F()
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
        inset: g()
      }],
      /**
       * Inset Inline
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       */
      "inset-x": [{
        "inset-x": g()
      }],
      /**
       * Inset Block
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       */
      "inset-y": [{
        "inset-y": g()
      }],
      /**
       * Inset Inline Start
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       * @todo class group will be renamed to `inset-s` in next major release
       */
      start: [{
        "inset-s": g(),
        /**
         * @deprecated since Tailwind CSS v4.2.0 in favor of `inset-s-*` utilities.
         * @see https://github.com/tailwindlabs/tailwindcss/pull/19613
         */
        start: g()
      }],
      /**
       * Inset Inline End
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       * @todo class group will be renamed to `inset-e` in next major release
       */
      end: [{
        "inset-e": g(),
        /**
         * @deprecated since Tailwind CSS v4.2.0 in favor of `inset-e-*` utilities.
         * @see https://github.com/tailwindlabs/tailwindcss/pull/19613
         */
        end: g()
      }],
      /**
       * Inset Block Start
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       */
      "inset-bs": [{
        "inset-bs": g()
      }],
      /**
       * Inset Block End
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       */
      "inset-be": [{
        "inset-be": g()
      }],
      /**
       * Top
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       */
      top: [{
        top: g()
      }],
      /**
       * Right
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       */
      right: [{
        right: g()
      }],
      /**
       * Bottom
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       */
      bottom: [{
        bottom: g()
      }],
      /**
       * Left
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       */
      left: [{
        left: g()
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
        basis: [Dn, "full", "auto", f, ...b()]
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
        "grid-cols": w()
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
        "grid-rows": w()
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
        "auto-cols": O()
      }],
      /**
       * Grid Auto Rows
       * @see https://tailwindcss.com/docs/grid-auto-rows
       */
      "auto-rows": [{
        "auto-rows": O()
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
        justify: [...Q(), "normal"]
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
        content: ["normal", ...Q()]
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
        "place-content": Q()
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
        font: [o, sv, nv]
      }],
      /**
       * Font Stretch
       * @see https://tailwindcss.com/docs/font-stretch
       */
      "font-stretch": [{
        "font-stretch": ["ultra-condensed", "extra-condensed", "condensed", "semi-condensed", "normal", "semi-expanded", "expanded", "extra-expanded", "ultra-expanded", cs, rt]
      }],
      /**
       * Font Family
       * @see https://tailwindcss.com/docs/font-family
       */
      "font-family": [{
        font: [rv, av, l]
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
        "line-clamp": [yt, "none", it, zf]
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
          ...b()
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
        indent: b()
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
        }, ov, lv]
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
          _,
          qr,
          Yr
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
        "inset-shadow": ["none", k, qr, Yr]
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
        "text-shadow": ["none", y, qr, Yr]
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
        "mask-radial-at": Z()
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
          qr,
          Yr
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
        ease: ["linear", "initial", A, it, rt]
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
        animate: ["none", R, it, rt]
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
        perspective: [j, it, rt]
      }],
      /**
       * Perspective Origin
       * @see https://tailwindcss.com/docs/perspective-origin
       */
      "perspective-origin": [{
        "perspective-origin": F()
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
        origin: F()
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
        stroke: [yt, Sl, ca, zf]
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
}, dv = /* @__PURE__ */ Lb(uv);
function jt(...n) {
  return dv(ym(n));
}
function fv(n, l, i) {
  return n.filter((o, s) => s !== l && (o.start + o.end) / 2 < i).length;
}
function mv(n, l, i, o) {
  const s = n.map(() => 0), u = n[l];
  if (!u) return s;
  const m = n[l + 1], f = n[l - 1], p = u.end - u.start + (m ? m.start - u.end : f ? u.start - f.end : 0);
  return n.forEach((x, _) => {
    l < i && _ > l && _ <= i ? s[_] = -p : i < l && _ >= i && _ < l && (s[_] = p);
  }), s[l] = Math.min(Math.max(o, n[0].start - u.start), n[n.length - 1].end - u.end), s;
}
const Mf = ["transform", "transition", "zIndex", "filter", "pointerEvents", "position"];
function pv(n, l) {
  for (let i = n.parentElement; i; i = i.parentElement) {
    const o = getComputedStyle(i)[l === "x" ? "overflowX" : "overflowY"];
    if ((o === "auto" || o === "scroll") && (l === "x" ? i.scrollWidth > i.clientWidth : i.scrollHeight > i.clientHeight)) return i;
  }
  return null;
}
function hv(n, l, i, o) {
  const s = n[l] ? pv(n[l], i) : null, u = () => s ? i === "x" ? s.scrollLeft : s.scrollTop : 0, m = (T) => (i === "x" ? T.clientX : T.clientY) + u(), f = m(o), p = u(), x = n.map((T) => {
    const A = T.getBoundingClientRect();
    return i === "x" ? { start: A.left + p, end: A.right + p } : { start: A.top + p, end: A.bottom + p };
  }), _ = n.map((T) => Mf.map((A) => T.style[A])), k = typeof matchMedia == "function" && matchMedia("(prefers-reduced-motion: reduce)").matches, y = i === "x" ? "translateX" : "translateY";
  let S = !1;
  const z = { to: l };
  n.forEach((T, A) => {
    if (T.style.pointerEvents = "none", A !== l) {
      k || (T.style.transition = "transform 160ms cubic-bezier(0.2, 0.8, 0.2, 1)");
      return;
    }
    getComputedStyle(T).position === "static" && (T.style.position = "relative"), T.style.zIndex = "30", T.style.filter = "drop-shadow(0 6px 10px rgba(0, 0, 0, 0.45))";
  });
  const j = (T, A) => {
    z.to = T, mv(x, l, T, A).forEach((R, B) => {
      n[B].style.transform = R ? `${y}(${R}px)` : "";
    });
  };
  return {
    from: l,
    get to() {
      return z.to;
    },
    slot: (T) => fv(x, l, m(T)),
    apply: (T, A) => {
      S || j(T, m(A) - f);
    },
    rest: () => {
      S || j(l, 0);
    },
    end: () => {
      S || (S = !0, n.forEach((T, A) => Mf.forEach((R, B) => {
        T.style[R] = _[A][B];
      })));
    }
  };
}
const gv = 5;
let us = !1;
function bv(n, l) {
  if (n.button !== 0 || us) return;
  const i = { clientX: n.clientX, clientY: n.clientY }, o = n.currentTarget, s = n.pointerId;
  let u = null, m, f = !1;
  const p = { cursor: document.body.style.cursor, userSelect: document.body.style.userSelect }, x = (z) => {
    if (f) return;
    f = !0, window.removeEventListener("pointermove", _), window.removeEventListener("pointerup", k), window.removeEventListener("pointercancel", y), window.removeEventListener("keydown", S, !0), window.removeEventListener("blur", y), o.removeEventListener("lostpointercapture", y);
    try {
      o.releasePointerCapture(s);
    } catch {
    }
    if (!u) return;
    us = !1, document.body.style.cursor = p.cursor, document.body.style.userSelect = p.userSelect, u.end();
    const j = (T) => T.stopPropagation();
    window.addEventListener("click", j, { capture: !0, once: !0 }), setTimeout(() => window.removeEventListener("click", j, !0), 0), m?.(), l.onEnd(z, u);
  }, _ = (z) => {
    if (!u) {
      if (Math.hypot(z.clientX - i.clientX, z.clientY - i.clientY) < gv) return;
      const j = l.items();
      u = hv(j, l.from(j), l.axis, i), us = !0, document.body.style.cursor = "grabbing", document.body.style.userSelect = "none";
      try {
        o.setPointerCapture(s);
      } catch {
      }
      o.addEventListener("lostpointercapture", y);
      const T = l.onStart?.();
      m = typeof T == "function" ? T : void 0;
    }
    l.onMove(z, u);
  }, k = () => x(!0), y = () => x(!1), S = (z) => {
    z.key === "Escape" && (z.stopPropagation(), x(!1));
  };
  window.addEventListener("pointermove", _), window.addEventListener("pointerup", k), window.addEventListener("pointercancel", y), window.addEventListener("keydown", S, !0), window.addEventListener("blur", y);
}
const Rm = typeof navigator < "u" && /Mac/i.test(navigator.platform), si = {
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
for (let n = 1; n <= 12; n++) si[`f${n}`] = `F${n}`;
const vv = Object.fromEntries(Object.entries(si).map(([n, l]) => [l, n])), yv = {
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
function xv(n) {
  const l = /^Key([A-Z])$/.exec(n) ?? /^Digit(\d)$/.exec(n);
  return l ? l[1].toLowerCase() : vv[n];
}
const Cf = /* @__PURE__ */ new Map();
function Dm(n, l = Rm) {
  const i = `${l}|${n}`, o = Cf.get(i);
  if (o) return o;
  const s = { cmd: !1, ctrl: !1, shift: !1, alt: !1, code: "" };
  for (const u of n.split("+"))
    if (u === "mod")
      l ? s.cmd = !0 : (s.ctrl = !0, s.shift = !0);
    else if (u === "cmd" || u === "ctrl" || u === "shift" || u === "alt") s[u] = !0;
    else if (/^[a-z]$/.test(u))
      s.code = `Key${u.toUpperCase()}`, s.letter = u;
    else if (/^[0-9]$/.test(u)) s.code = `Digit${u}`;
    else if (si[u]) s.code = si[u];
    else throw new Error(`unknown key "${u}" in "${n}"`);
  if (!s.code) throw new Error(`no key in "${n}"`);
  return Cf.set(i, s), s;
}
new Set(["cmd+q", "cmd+h", "cmd+alt+h", "cmd+m", "cmd+ctrl+f", "cmd+z", "cmd+shift+z", "cmd+x", "cmd+c", "cmd+v", "cmd+a"].map((n) => {
  const l = Dm(n, !0);
  return [l.cmd && "cmd", l.ctrl && "ctrl", l.alt && "alt", l.shift && "shift", l.code].filter(Boolean).join("+");
}));
function wv(n, l = Rm) {
  const i = Dm(n, l), o = _v(xv(i.code) ?? "");
  return l ? `${i.ctrl ? "⌃" : ""}${i.alt ? "⌥" : ""}${i.shift ? "⇧" : ""}${i.cmd ? "⌘" : ""}${o}` : [i.ctrl && "Ctrl", i.alt && "Alt", i.shift && "Shift", o].filter(Boolean).join("+");
}
const _v = (n) => yv[n] ?? n.toUpperCase(), Af = (n) => typeof n == "boolean" ? `${n}` : n === 0 ? "0" : n, jf = ym, pi = (n, l) => (i) => {
  var o;
  if (l?.variants == null) return jf(n, i?.class, i?.className);
  const { variants: s, defaultVariants: u } = l, m = Object.keys(s).map((x) => {
    const _ = i?.[x], k = u?.[x];
    if (_ === null) return null;
    const y = Af(_) || Af(k);
    return s[x][y];
  }), f = i && Object.entries(i).reduce((x, _) => {
    let [k, y] = _;
    return y === void 0 || (x[k] = y), x;
  }, {}), p = l == null || (o = l.compoundVariants) === null || o === void 0 ? void 0 : o.reduce((x, _) => {
    let { class: k, className: y, ...S } = _;
    return Object.entries(S).every((z) => {
      let [j, T] = z;
      return Array.isArray(T) ? T.includes({
        ...u,
        ...f
      }[j]) : {
        ...u,
        ...f
      }[j] === T;
    }) ? [
      ...x,
      k,
      y
    ] : x;
  }, []);
  return jf(n, m, p, i?.class, i?.className);
}, kv = pi(
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
), Sv = pi(
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
function Ev({ className: n, ...l } = {}) {
  return jt(Sv(l), n);
}
const Hm = "shrink-0 cursor-pointer rounded-ui bg-transparent px-[0.2rem] py-[0.1rem] text-[0.8rem] leading-none text-subtext-0 [font-family:inherit] [border:none] [transition:color_0.1s_ease,background_0.1s_ease] hover:bg-surface-1 hover:text-accent", Dl = "cursor-pointer rounded-ui bg-transparent text-subtext-0 [border:0] [font-family:inherit] [transition:color_0.1s_ease,background_0.1s_ease] hover:bg-surface-1 hover:text-fg focus-visible:bg-surface-1 focus-visible:text-fg disabled:cursor-not-allowed disabled:opacity-40", zv = pi(`${Dl} shrink-0 focus-visible:[outline:2px_solid_var(--accent)] focus-visible:[outline-offset:-2px]`, {
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
function Nv({ className: n, ...l } = {}) {
  return jt(zv(l), n);
}
const hi = "overflow-hidden rounded-ui bg-surface-1 py-[0.3rem] shadow-[0_8px_24px_rgba(0,0,0,0.45)]", Ns = pi(
  "pane-context-menu__item block w-full cursor-pointer bg-transparent px-[0.9rem] py-[0.45rem] text-left text-[0.82rem] [border:none] [font-family:inherit] [transition:background_0.1s_ease] hover:bg-surface-0 disabled:cursor-not-allowed disabled:bg-transparent disabled:opacity-40",
  { variants: { danger: { true: "text-red", false: "text-fg" } }, defaultVariants: { danger: !1 } }
), Tv = "my-1 h-px bg-overlay-0";
function Mv({ size: n = 14, className: l }) {
  return /* @__PURE__ */ et.jsxs("svg", { className: l, width: n, height: n, viewBox: "0 0 16 16", fill: "currentColor", "aria-hidden": "true", children: [
    /* @__PURE__ */ et.jsx("circle", { cx: "3.5", cy: "8", r: "1.1" }),
    /* @__PURE__ */ et.jsx("circle", { cx: "8", cy: "8", r: "1.1" }),
    /* @__PURE__ */ et.jsx("circle", { cx: "12.5", cy: "8", r: "1.1" })
  ] });
}
function Cv({ size: n = 16, className: l }) {
  return /* @__PURE__ */ et.jsxs("svg", { className: l, width: n, height: n, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: "1.3", strokeLinejoin: "round", "aria-hidden": "true", children: [
    /* @__PURE__ */ et.jsx("path", { d: "M6.6 1.8h2.8l.4 1.6 1.1.6 1.5-.6 1.4 2.4-1.2 1.1v1.3l1.2 1.1-1.4 2.4-1.5-.6-1.1.6-.4 1.6H6.6l-.4-1.6-1.1-.6-1.5.6-1.4-2.4 1.2-1.1V7.3L2.2 6.2l1.4-2.4 1.5.6 1.1-.6z" }),
    /* @__PURE__ */ et.jsx("circle", { cx: "8", cy: "8", r: "2" })
  ] });
}
function Av({ size: n = 14, className: l }) {
  return /* @__PURE__ */ et.jsx("svg", { className: l, width: n, height: n, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round", "aria-hidden": "true", children: /* @__PURE__ */ et.jsx("path", { d: "M3.5 3.5l9 9M12.5 3.5l-9 9" }) });
}
function Bm({ size: n = 14, className: l }) {
  return /* @__PURE__ */ et.jsx("svg", { className: l, width: n, height: n, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round", "aria-hidden": "true", children: /* @__PURE__ */ et.jsx("path", { d: "M8 2.5v11M2.5 8h11" }) });
}
const Of = {
  connected: "host-state--connected bg-accent",
  connecting: "host-state--connecting animate-host-pulse bg-yellow",
  error: "host-state--error bg-red",
  disabled: "host-state--disabled bg-subtext-0"
};
function jv({ state: n, error: l }) {
  return /* @__PURE__ */ et.jsx(
    "span",
    {
      className: jt("host-state inline-block h-2 w-2 shrink-0 rounded-[50%]", Of[n] ?? Of.disabled),
      title: n === "error" && l ? l : n
    }
  );
}
function Ov({ title: n, onClose: l, children: i, testId: o }) {
  return Rl(
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
//! markdown.mjs: how much of a Markdown file the preview renders, cut where the web cuts it (`renderFilePreview` in
//! `packages/web/src/markdown.ts`). The document itself is drawn by the window's Markdown engine (`MarkdownPreview` in
//! `sdk.mjs`, `perch-markdown`).
const Wr = 2e5;
function Rv(n) {
  if (n.length <= Wr) return { source: n, truncated: !1 };
  const l = n.lastIndexOf(`
`, Wr);
  return { source: n.slice(0, l > 0 ? l : Wr), truncated: !0 };
}
const Lr = 4, Hn = 8, Dv = "flex w-full cursor-pointer items-center justify-between gap-3 px-[0.9rem] py-[0.4rem] text-left text-[0.82rem] text-fg max-[700px]:min-h-11 aria-disabled:cursor-not-allowed aria-disabled:opacity-40", Rf = (n) => n.text ?? (typeof n.label == "string" ? n.label : n.value);
function Hv({ value: n, onChange: l, options: i, className: o, ariaLabel: s, testId: u, id: m, title: f, disabled: p, placeholder: x, freeText: _, onKeyDown: k }) {
  const y = J.useId(), [S, z] = J.useState(!1), [j, T] = J.useState(-1), [A, R] = J.useState(!1), B = J.useRef(null), Z = J.useRef(null), [F, D] = J.useState({}), h = J.useRef({ text: "", at: 0 }), b = _ && A && n ? i.filter((L) => Rf(L).toLowerCase().includes(n.toLowerCase()) || L.value.toLowerCase().includes(n.toLowerCase())) : i, g = i.find((L) => L.value === n), w = (L) => `${y}-${L}`;
  function N(L) {
    p || (T(L), z(!0));
  }
  function E() {
    z(!1), R(!1), T(-1);
  }
  function O(L) {
    !L || L.disabled || (l(L.value), E());
  }
  function Q(L, K) {
    for (let M = 1; M <= b.length; M++) {
      const X = (L + K * M + b.length * M) % b.length;
      if (!b[X].disabled) return X;
    }
    return L;
  }
  const W = () => b.findIndex((L) => !L.disabled), U = () => b.length - 1 - [...b].reverse().findIndex((L) => !L.disabled);
  Al(() => {
    if (!S || !B.current) {
      D((at) => at.left === void 0 ? at : {});
      return;
    }
    const L = B.current.getBoundingClientRect(), K = window.innerHeight - L.bottom - Lr - Hn, M = L.top - Lr - Hn, X = K < 160 && M > K;
    D({
      position: "fixed",
      left: Math.min(Math.max(Hn, L.left), Math.max(Hn, window.innerWidth - L.width - Hn)),
      // As wide as its longest label (a session title, a path), never wider than the window.
      width: "max-content",
      minWidth: L.width,
      maxWidth: window.innerWidth - 2 * Hn,
      maxHeight: Math.min(X ? M : K, 320),
      ...X ? { bottom: window.innerHeight - L.top + Lr } : { top: L.bottom + Lr },
      overflowY: "auto"
    });
  }, [S, b.length]), Al(() => {
    const L = Z.current;
    if (!S || !L || F.left === void 0) return;
    const K = L.getBoundingClientRect().right, M = window.innerWidth - Hn;
    K > M && D((X) => ({ ...X, left: Math.max(Hn, Number(X.left) - (K - M)) }));
  }, [S, F]), Xt(() => {
    if (!S) return;
    const L = (K) => {
      const M = K.target;
      (M === document || M instanceof Node && B.current && M.contains(B.current)) && E();
    };
    return window.addEventListener("resize", E), window.addEventListener("scroll", L, !0), () => {
      window.removeEventListener("resize", E), window.removeEventListener("scroll", L, !0);
    };
  }, [S]), Xt(() => {
    const L = S && j >= 0 ? document.getElementById(w(j)) : null, K = Z.current;
    !L || !K || (L.offsetTop < K.scrollTop ? K.scrollTop = L.offsetTop : L.offsetTop + L.offsetHeight > K.scrollTop + K.clientHeight && (K.scrollTop = L.offsetTop + L.offsetHeight - K.clientHeight));
  }, [S, j]), Ym(S, (L) => {
    L || E();
  }, B, Z);
  function V(L) {
    if (L.nativeEvent.isComposing) return;
    const K = () => {
      L.preventDefault(), L.stopPropagation();
    }, { key: M } = L;
    if (S) {
      if (M === "Escape") {
        K(), E();
        return;
      } else if (M === "Tab")
        E();
      else if (M === "ArrowDown" || M === "ArrowUp") {
        K(), b.length && T(j < 0 ? M === "ArrowDown" ? W() : U() : Q(j, M === "ArrowDown" ? 1 : -1));
        return;
      } else if (M === "Home" && !_) {
        K(), T(W());
        return;
      } else if (M === "End" && !_) {
        K(), T(U());
        return;
      } else if (M === "Enter" || M === " " && !_) {
        if (j >= 0 && b[j]) {
          K(), O(b[j]);
          return;
        }
        if (!_) {
          K(), E();
          return;
        }
      } else if (!_ && M.length === 1 && !L.metaKey && !L.ctrlKey && !L.altKey) {
        const X = Date.now();
        h.current = { text: (X - h.current.at > 600 ? "" : h.current.text) + M.toLowerCase(), at: X };
        const at = Math.max(j, 0), st = [...b.slice(at + (h.current.text.length === 1 ? 1 : 0)), ...b.slice(0, at + 1)].find((ct) => !ct.disabled && Rf(ct).toLowerCase().startsWith(h.current.text));
        st && (K(), T(b.indexOf(st)));
        return;
      }
    } else if (M === "ArrowDown" || M === "ArrowUp" || !_ && (M === "Enter" || M === " ")) {
      K(), N(Math.max(0, b.findIndex((X) => X.value === n)));
      return;
    }
    k?.(L);
  }
  const I = {
    ref: (L) => {
      B.current = L;
    },
    id: m,
    title: f,
    disabled: p,
    "aria-label": s,
    "aria-expanded": S,
    "aria-controls": S ? y : void 0,
    "aria-activedescendant": S && j >= 0 ? w(j) : void 0,
    "data-testid": u,
    onKeyDown: V
  };
  return /* @__PURE__ */ et.jsxs(et.Fragment, { children: [
    _ ? /* @__PURE__ */ et.jsx(
      "input",
      {
        ...I,
        type: "text",
        role: "combobox",
        "aria-autocomplete": "list",
        autoComplete: "off",
        placeholder: x,
        className: o,
        value: n,
        onChange: (L) => {
          l(L.target.value), R(!0), S ? T(-1) : (T(-1), z(!0));
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
        className: jt("inline-flex items-center justify-between gap-2 text-left [font-family:inherit] cursor-pointer disabled:cursor-not-allowed disabled:opacity-50", o),
        onClick: () => S ? E() : N(Math.max(0, b.findIndex((L) => L.value === n))),
        children: [
          /* @__PURE__ */ et.jsx("span", { className: "min-w-0 flex-1 truncate", children: g ? g.label : x ?? "" }),
          /* @__PURE__ */ et.jsx(Js, { open: !0, className: "shrink-0 text-subtext-0" })
        ]
      }
    ),
    S && b.length > 0 && Rl(
      /* @__PURE__ */ et.jsx(
        "div",
        {
          ref: Z,
          id: y,
          role: "listbox",
          "aria-label": s,
          className: jt("z-[9999]", hi),
          style: F,
          onMouseDown: (L) => {
            L.preventDefault(), L.stopPropagation();
          },
          onClick: (L) => L.stopPropagation(),
          children: b.map((L, K) => /* @__PURE__ */ et.jsxs(
            "div",
            {
              id: w(K),
              role: "option",
              "aria-selected": L.value === n,
              "aria-disabled": L.disabled || void 0,
              "data-value": L.value,
              className: jt(Dv, K === j && !L.disabled && "bg-surface-0"),
              onMouseEnter: () => {
                L.disabled || T(K);
              },
              onClick: () => O(L),
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
const Df = 230, Bv = 370;
function Uv({ x: n, y: l, readOnly: i, canUndo: o, canRedo: s, hasSelection: u, onClose: m, actions: f }) {
  const p = J.useRef(null);
  Xt(() => {
    const y = (z) => {
      p.current?.contains(z.target) || m();
    }, S = (z) => {
      z.key === "Escape" && (z.preventDefault(), m());
    };
    return document.addEventListener("mousedown", y), document.addEventListener("keydown", S), window.addEventListener("blur", m), window.addEventListener("resize", m), () => {
      document.removeEventListener("mousedown", y), document.removeEventListener("keydown", S), window.removeEventListener("blur", m), window.removeEventListener("resize", m);
    };
  }, [m]);
  const x = (y, S) => As(Km ? y : S), _ = (y, S, z, j, T = !1) => /* @__PURE__ */ et.jsxs("button", { type: "button", className: jt(Xm(), "flex items-center justify-between gap-6"), "data-testid": z, disabled: T, onClick: S, children: [
    /* @__PURE__ */ et.jsx("span", { children: y }),
    /* @__PURE__ */ et.jsx("span", { className: "text-[0.72rem] text-subtext-0", children: j })
  ] }), k = f.askAgent;
  return Rl(
    /* @__PURE__ */ et.jsxs(
      "div",
      {
        ref: p,
        className: hi,
        "data-testid": "editor-context-menu",
        style: {
          position: "fixed",
          top: Math.max(8, Math.min(l, window.innerHeight - Bv - 8)),
          left: Math.max(8, Math.min(n, window.innerWidth - Df - 8)),
          zIndex: 9999,
          minWidth: Df
        },
        onContextMenu: (y) => y.preventDefault(),
        children: [
          k && /* @__PURE__ */ et.jsxs(et.Fragment, { children: [
            _(u ? "Ask agent about selection…" : "Ask agent about file…", k, "editor-menu-ask-agent", ""),
            /* @__PURE__ */ et.jsx("div", { className: $r })
          ] }),
          _("Undo", f.undo, "editor-menu-undo", x("cmd+z", "ctrl+z"), i || !o),
          _("Redo", f.redo, "editor-menu-redo", x("cmd+shift+z", "ctrl+y"), i || !s),
          /* @__PURE__ */ et.jsx("div", { className: $r }),
          _("Cut", f.cut, "editor-menu-cut", x("cmd+x", "ctrl+x"), i || !u),
          _("Copy", f.copy, "editor-menu-copy", x("cmd+c", "ctrl+c"), !u),
          _("Paste", f.paste, "editor-menu-paste", x("cmd+v", "ctrl+v"), i),
          _("Select All", f.selectAll, "editor-menu-select-all", x("cmd+a", "ctrl+a")),
          /* @__PURE__ */ et.jsx("div", { className: $r }),
          _("Find…", f.find, "editor-menu-find", x("cmd+f", "ctrl+f")),
          !i && _("Replace…", f.replace, "editor-menu-replace", x("cmd+alt+f", "ctrl+h")),
          _("Go to Line…", f.gotoLine, "editor-menu-goto", As("ctrl+g"))
        ]
      }
    ),
    document.body
  );
}
const Gv = "box-border min-h-[44px] cursor-pointer rounded-ui bg-transparent px-[0.7rem] py-[0.45rem] text-subtext-0 no-underline [border:0] [font-family:inherit] [font-weight:inherit] [line-height:inherit] text-[0.85rem] hover:bg-surface-1 hover:text-fg focus-visible:[outline:2px_solid_var(--accent)] focus-visible:[outline-offset:2px] disabled:cursor-default disabled:opacity-[0.55]", Yv = "m-0 mt-[0.4rem] text-[0.78rem] text-subtext-0", qv = "m-0 mb-2 text-[0.82rem] text-subtext-0", Um = "rounded-ui bg-surface-1 text-fg [font-family:inherit]", Xs = `${Um} px-2 py-[0.3rem] text-[0.8rem] max-[700px]:min-h-11 focus:[outline:1px_solid_var(--accent)]`, Lv = `${Xs} min-w-[5.5rem] shrink-0`, Zs = `${Um} min-w-0 px-[0.55rem] py-[0.35rem] text-[0.82rem] max-[700px]:min-h-11 focus:[outline:1px_solid_var(--accent)]`, Qv = `${Zs} flex-1 max-[700px]:flex-[1_1_100%]`, Vv = `${Zs} w-20 flex-[0_0_5rem] max-[700px]:w-24 max-[700px]:flex-[1_1_6rem]`, Kv = `${Zs} flex-[1_1_100%]`, Xv = "flex flex-wrap items-center gap-[0.4rem]", Zv = "m-0 mb-2 flex list-none flex-col gap-[0.3rem] p-0", Jv = "flex items-center gap-2 max-[700px]:flex-wrap rounded-ui bg-surface-1 px-2 py-[0.35rem] text-[0.82rem]", Wv = `settings-modal__host-row ${Jv}`, Fv = "min-w-0 overflow-hidden font-semibold text-ellipsis whitespace-nowrap text-fg", $v = "min-w-0 flex-1 max-[700px]:basis-full overflow-hidden text-[0.78rem] text-ellipsis whitespace-nowrap text-subtext-0", Gm = "shrink-0 cursor-pointer rounded-ui px-[0.7rem] py-[0.35rem] max-[700px]:min-h-11 text-[0.82rem] font-semibold text-panel-bg [border:none] [font-family:inherit] [transition:opacity_0.12s_ease] hover:opacity-[0.85]", Iv = `${Gm} bg-accent`, Pv = `${Gm} ml-auto bg-red`;
function Js({ open: n, size: l = 12, className: i }) {
  return /* @__PURE__ */ et.jsx("svg", { className: i, width: l, height: l, viewBox: "0 0 12 12", fill: "none", stroke: "currentColor", strokeWidth: "1.3", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true", children: /* @__PURE__ */ et.jsx("path", { d: n ? "M2.5 4.5 6 8l3.5-3.5" : "M4.5 2.5 8 6l-3.5 3.5" }) });
}
function t1({ label: n, items: l, testId: i, side: o = "right", up: s = !1, maxHeight: u = 320 }) {
  const [m, f] = J.useState(!1), [p, x] = J.useState(!1), _ = J.useRef(null), k = J.useRef(null), y = () => [...k.current?.querySelectorAll('[role="menuitem"]') ?? []];
  Xt(() => {
    m && p && (y()[0]?.focus(), x(!1));
  }, [m, p]);
  const S = () => {
    f(!0), x(!0);
  }, z = (T) => {
    (T.key === "ArrowRight" || T.key === "Enter" || T.key === " ") && (T.preventDefault(), S());
  }, j = (T) => {
    const A = y(), R = A.findIndex((B) => B === document.activeElement);
    T.key === "ArrowDown" || T.key === "ArrowUp" ? (T.preventDefault(), A[(R + (T.key === "ArrowDown" ? 1 : A.length - 1)) % A.length]?.focus()) : (T.key === "ArrowLeft" || T.key === "Escape") && (T.preventDefault(), T.stopPropagation(), f(!1), _.current?.focus());
  };
  return /* @__PURE__ */ et.jsxs("div", { className: "group/submenu relative", children: [
    /* @__PURE__ */ et.jsxs(
      "button",
      {
        ref: _,
        type: "button",
        role: "menuitem",
        "aria-haspopup": "menu",
        "aria-expanded": m,
        className: jt(Ns(), "flex items-center justify-between gap-2"),
        "data-testid": i,
        onClick: () => m ? f(!1) : S(),
        onKeyDown: z,
        children: [
          /* @__PURE__ */ et.jsx("span", { className: "truncate", children: n }),
          /* @__PURE__ */ et.jsx(Js, { open: !1, size: 10 })
        ]
      }
    ),
    /* @__PURE__ */ et.jsx(
      "div",
      {
        ref: k,
        role: "menu",
        "aria-label": n,
        className: jt(
          hi,
          "absolute z-10 w-60 overflow-y-auto",
          o === "right" ? "left-full" : "right-full",
          s ? "bottom-0" : "top-0",
          m ? "block" : "hidden group-hover/submenu:block"
        ),
        style: { maxHeight: u },
        onKeyDown: j,
        children: l.map((T) => /* @__PURE__ */ et.jsx("button", { type: "button", role: "menuitem", className: Ns(), "data-testid": T.testId, onClick: T.onSelect, children: /* @__PURE__ */ et.jsx("span", { className: "block truncate", children: T.label }) }, T.key))
      }
    )
  ] });
}
function e1(n) {
  return n.blocked && !n.stale ? "blocked" : n.status === "running" && !n.stale ? "working" : n.unseen ? "done" : "idle";
}
const Ts = {
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
function Ms(n, l) {
  return !!n.parentSessionId && n.parentSessionId !== n.id && l.some((i) => i.id === n.parentSessionId);
}
function n1(n) {
  const l = /* @__PURE__ */ new Map();
  for (const i of n)
    Ms(i, n) && l.set(i.parentSessionId, [...l.get(i.parentSessionId) ?? [], i]);
  return l.size ? n.filter((i) => !Ms(i, n)).flatMap((i) => [i, ...l.get(i.id) ?? []]) : n;
}
const Qr = 6, Hf = 8;
function a1(n, l = {}) {
  const { minWidth: i = 220, align: o = "right", minSpaceAbove: s = 100 } = l, u = n.getBoundingClientRect(), m = window.innerWidth, f = window.innerHeight, p = o === "right" ? { right: Math.max(0, m - u.right) } : { left: Math.max(0, u.left) }, x = u.top - Qr - Hf, _ = f - u.bottom - Qr - Hf;
  return x >= s ? {
    position: "fixed",
    bottom: f - u.top + Qr,
    ...p,
    minWidth: i,
    maxHeight: Math.min(x, f * 0.75),
    overflowY: "auto"
  } : {
    position: "fixed",
    top: u.bottom + Qr,
    ...p,
    minWidth: i,
    maxHeight: Math.min(_, f * 0.75),
    overflowY: "auto"
  };
}
function Ym(n, l, i, o) {
  Xt(() => {
    if (!n) return;
    function s(m) {
      const f = m.target, p = i.current?.contains(f) ?? !1, x = o.current?.contains(f) ?? !1;
      !p && !x && l(!1);
    }
    function u(m) {
      m.key === "Escape" && l(!1);
    }
    return document.addEventListener("mousedown", s), document.addEventListener("keydown", u), () => {
      document.removeEventListener("mousedown", s), document.removeEventListener("keydown", u);
    };
  }, [n]);
}
function l1({ icon: n, fallback: l }) {
  const [i, o] = J.useState(!1);
  return Xt(() => o(!1), [n]), !n || i ? /* @__PURE__ */ et.jsx(et.Fragment, { children: l }) : /* @__PURE__ */ et.jsx("img", { src: n, alt: "", width: 14, height: 14, className: "size-[14px] rounded-[2px] object-contain", referrerPolicy: "no-referrer", onError: () => o(!0) });
}
const r1 = ["application/zip", "application/x-tar", "application/gzip"];
function qm(n) {
  const l = n ?? "";
  if (l.startsWith("image/")) return "image";
  if (l.startsWith("video/")) return "video";
  if (l.startsWith("audio/")) return "audio";
  if (l === "application/pdf") return "pdf";
  if (r1.includes(l)) return "archive";
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
const i1 = 50 * 1024 * 1024, Bf = 1.25, o1 = 0.05, s1 = 16384, c1 = "inline-flex items-center justify-center", Vr = jt(Dl, c1, "min-h-8 min-w-8 px-2 text-[0.75rem] max-[700px]:min-h-11 max-[700px]:min-w-11"), ds = jt(Dl, "inline-flex min-h-8 items-center px-2"), u1 = { pdf: "PDF document", audio: "Audio", video: "Video" };
let d1 = 0;
function f1(n) {
  return n < 1024 ? `${n} B` : n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
function m1(n, l, i) {
  const o = l ? Math.min(8, s1 / Math.max(l.width, l.height)) : 1, s = i === "in" ? n * Bf : i === "out" ? n / Bf : 1;
  return Math.min(o, Math.max(Math.min(o1, o), s));
}
function p1(n, l) {
  return typeof n != "string" || !n.startsWith("/") ? null : `${n.replace(/\/+$/, "")}/${l.replace(/^\/+/, "")}`;
}
function h1({ media: n, workspaceId: l, metadata: i, onFail: o }) {
  const s = J.useMemo(() => `media-${++d1}`, []), [u, m] = J.useState(null), [f, p] = J.useState("fit");
  Xt(() => {
    let z = !0;
    return n.open(s, { workspaceId: l, path: i.path, mediaType: i.mediaType ?? "", size: i.size }).then((j) => {
      z && m(j ?? { width: 0, height: 0 });
    }, (j) => {
      z && o(String(j?.message ?? j));
    }), () => {
      z = !1, n.release(s);
    };
  }, [s]), Xt(() => {
    n.setZoom(s, f === "fit" ? null : f);
  }, [s, f]);
  const x = u !== null && u.width > 0 && u.height > 0, _ = () => f !== "fit" ? f : n.fitScale(s) ?? 1, k = (z) => p(m1(_(), u, z)), y = (z) => {
    if (!(z.metaKey || z.ctrlKey || z.altKey || !x)) {
      if (z.key === "+" || z.key === "=") k("in");
      else if (z.key === "-") k("out");
      else if (z.key === "0") k("actual");
      else return;
      z.preventDefault();
    }
  }, S = f === "fit" ? "Fit" : `${Math.round(f * 100)}%`;
  return J.createElement(
    "div",
    { className: "flex min-h-0 min-w-0 flex-1 flex-col", "data-testid": "workspace-image-viewer" },
    J.createElement(
      "div",
      { className: "flex shrink-0 flex-wrap items-center gap-1 px-3 py-1 text-[0.72rem] text-subtext-0", role: "toolbar", "aria-label": "Image view" },
      J.createElement("button", { type: "button", className: Vr, "aria-label": "Zoom out", title: "Zoom out (-)", disabled: !x, onClick: () => k("out") }, "−"),
      J.createElement("button", { type: "button", className: Vr, "aria-label": "Zoom in", title: "Zoom in (+)", disabled: !x, onClick: () => k("in") }, "+"),
      J.createElement("button", { type: "button", className: jt(Vr, f === "fit" && "text-fg"), "aria-pressed": f === "fit", onClick: () => p("fit") }, "Fit"),
      J.createElement("button", { type: "button", className: jt(Vr, f === 1 && "text-fg"), "aria-pressed": f === 1, title: "Actual size (0)", disabled: !x, onClick: () => k("actual") }, "100%"),
      J.createElement("span", { role: "status", className: "px-1", "data-testid": "workspace-image-info" }, x ? `${u.width} × ${u.height} · ${S}` : "")
    ),
    J.createElement("div", {
      className: "flex min-h-0 min-w-0 flex-1",
      tabIndex: 0,
      "aria-label": `${i.name} image. Plus and minus zoom, 0 shows actual size, arrow keys pan.`,
      onKeyDown: y
    }, u === null ? J.createElement("span", { className: "m-auto text-[0.8rem] text-subtext-0", role: "status" }, "Loading…") : J.createElement("div", { className: "relative min-h-0 min-w-0 flex-1", "data-perch-engine": "image", "data-perch-key": s, "data-testid": "workspace-file-image" }))
  );
}
function g1({ workspaceId: n, metadata: l, perch: i }) {
  const [o, s] = J.useState(!1), u = i.mediaFile?.(n, l.path) ?? { root: null, extraction: null }, m = u.extraction, f = qm(l.mediaType), p = p1(u.root, l.path), x = p === null, _ = f === "archive", k = f === "image" && l.size > i1, y = f !== void 0 && !_ && !x && !k;
  let S = "Open this file in Quick Look or its default app.";
  x ? S = "Use your SSH tools to download this file. Perch will not open a remote path on this machine." : _ && (S = "Extract into a new folder beside this archive. Existing files are never overwritten.");
  let z = "No preview for this file type";
  x ? z = "Remote media is not available yet" : _ ? z = "Compressed archive" : k ? (z = "Image too large to preview", S = `This image is ${Math.round(l.size / 1048576)} MB. Open it in Quick Look or its default app.`) : o && (z = "Preview unavailable", f === "image" && (S = "The image may be corrupt or in a format Perch cannot decode. Open it in Quick Look or its default app."));
  const j = (A) => {
    try {
      i.media[A](p);
    } catch (R) {
      console.error(`perch-media ${A}: ${R?.message ?? R}`);
    }
  }, T = f === "pdf" || f === "audio" || f === "video";
  return J.createElement(
    "section",
    { className: "flex min-h-0 min-w-0 flex-1 flex-col", "aria-label": `Previewing ${l.path}`, "data-testid": "workspace-file-asset" },
    J.createElement(
      "header",
      { className: "flex shrink-0 flex-wrap items-center gap-2 px-3 py-2 text-[0.75rem]" },
      J.createElement("strong", { className: "min-w-0 flex-1 truncate", title: l.path }, l.path),
      _ && J.createElement(
        "button",
        { type: "button", className: ds, disabled: m?.state === "loading", onClick: () => i.command("files.extract", { workspaceId: n, path: l.path }) },
        m?.state === "loading" ? "Extracting…" : "Extract"
      ),
      !x && J.createElement("button", { type: "button", className: ds, onClick: () => j("quickLook") }, "Quick Look"),
      !x && J.createElement("button", { type: "button", className: ds, onClick: () => j("openDefault") }, "Open with Default App")
    ),
    m?.state === "ready" && J.createElement("p", { role: "status", className: "m-0 px-3 py-2 text-[0.75rem] text-subtext-0" }, `Extracted to ${m.destination}. Find it in the file tree.`),
    m?.state === "error" && J.createElement("p", { role: "alert", className: "m-0 px-3 py-2 text-[0.75rem] text-red" }, m.error),
    !y || o ? J.createElement(
      "div",
      { className: "grid flex-1 content-center justify-items-center gap-2 p-5 text-center text-[0.8rem] text-subtext-0" },
      J.createElement("strong", { className: "text-fg" }, z),
      J.createElement("span", null, S)
    ) : f === "image" ? J.createElement(h1, { media: i.media, workspaceId: n, metadata: l, onFail: () => s(!0) }) : T && J.createElement(
      "div",
      { className: "grid flex-1 content-center justify-items-center gap-2 p-5 text-center text-[0.8rem] text-subtext-0", "data-testid": "workspace-file-card" },
      J.createElement("strong", { className: "text-fg" }, l.name),
      J.createElement("span", null, `${u1[f]} · ${f1(l.size)}`),
      J.createElement("span", null, "Perch does not play or render this file. Open it in Quick Look or its default app.")
    )
  );
}
function b1(n, l = !1) {
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
  }, u = n.includes(".") && Object.hasOwn(s, o) ? s[o] : void 0;
  return u ? { kind: "language", tone: u[1], text: u[0] } : /\.(html?|vue|svelte)$/.test(i) ? { kind: "code", tone: "text-peach" } : { kind: "file", tone: "text-subtext-0" };
}
const v1 = {
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
function y1({ name: n, directory: l = !1, open: i = !1 }) {
  const { kind: o, tone: s, text: u } = b1(n, l);
  return /* @__PURE__ */ et.jsxs("svg", { className: jt("size-[calc(14px*var(--zoom,1))] shrink-0", s), "data-file-icon": o, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: "1.25", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true", children: [
    o === "react" ? /* @__PURE__ */ et.jsxs(et.Fragment, { children: [
      /* @__PURE__ */ et.jsx("ellipse", { cx: "8", cy: "8", rx: "7", ry: "2.5" }),
      /* @__PURE__ */ et.jsx("ellipse", { cx: "8", cy: "8", rx: "7", ry: "2.5", transform: "rotate(60 8 8)" }),
      /* @__PURE__ */ et.jsx("ellipse", { cx: "8", cy: "8", rx: "7", ry: "2.5", transform: "rotate(120 8 8)" }),
      /* @__PURE__ */ et.jsx("circle", { cx: "8", cy: "8", r: "1" })
    ] }) : u ? /* @__PURE__ */ et.jsx("text", { x: "8", y: "11", textAnchor: "middle", fill: "currentColor", stroke: "none", fontSize: "8", fontWeight: "600", fontFamily: "var(--font-mono)", children: u }) : /* @__PURE__ */ et.jsx("path", { d: o === "folder" && i ? "M2 5V3h4l2 2h5v2M2 7h13l-2 6H2z" : v1[o] }),
    o === "branch" && /* @__PURE__ */ et.jsxs(et.Fragment, { children: [
      /* @__PURE__ */ et.jsx("circle", { cx: "4", cy: "3", r: "1.5" }),
      /* @__PURE__ */ et.jsx("circle", { cx: "4", cy: "13", r: "1.5" }),
      /* @__PURE__ */ et.jsx("circle", { cx: "12", cy: "3", r: "1.5" })
    ] }),
    o === "image" && /* @__PURE__ */ et.jsx("circle", { cx: "10.5", cy: "5", r: "1" })
  ] });
}
const x1 = { unmodified: "", modified: "M", added: "A", deleted: "D", renamed: "R", copied: "C", typeChanged: "T", untracked: "U", ignored: "I", conflicted: "!" }, Uf = (n) => typeof n == "string" ? x1[n] ?? "?" : "?", Gf = (n) => typeof n == "string" ? n === "unmodified" ? "unmodified" : n === "typeChanged" ? "type changed" : n : `unknown (${n.unknown})`;
function w1(n) {
  const l = Uf(n.index), i = Uf(n.worktree), o = l === "!" || i === "!", s = o ? "!" : n.staged && n.unstaged ? `${l || "?"}/${i || "?"}` : n.staged ? l : i || l, u = `Git · Index: ${Gf(n.index)}; working tree: ${Gf(n.worktree)}${n.originalPath ? `; from ${n.originalPath}` : ""}`, m = o || s.includes("D") ? "text-red" : s === "U" || s === "A" || s === "C" ? "text-green" : s.includes("?") || s === "I" ? "text-subtext-0" : "text-yellow";
  return { label: s, title: u, tone: m };
}
function _1({ decoration: n, directory: l = !1 }) {
  if (!n) return null;
  if (l && n.containsChanges) return /* @__PURE__ */ et.jsx("span", { className: jt("ml-1 size-1 shrink-0 rounded-full", n.conflicted ? "bg-red" : "bg-yellow"), role: "img", "aria-label": n.conflicted ? "Contains Git conflicts" : "Contains Git changes", title: n.conflicted ? "Contains Git conflicts" : "Contains Git changes", "data-testid": "file-git-summary" });
  if (!n.entry) return null;
  const { label: i, title: o, tone: s } = w1(n.entry);
  return i ? /* @__PURE__ */ et.jsx("span", { className: jt("ml-1 shrink-0 text-[10px] tabular-nums [font-family:var(--font-mono)]", s), "aria-label": o, title: o, "data-testid": "file-git-marker", children: i }) : null;
}
const k1 = "mode-switch group ml-auto flex items-center gap-[0.4rem] bg-transparent p-[0.2rem] [border:none] [font-family:inherit]", Lm = "text-[0.72rem] font-semibold tracking-[0.03em] text-overlay-1 uppercase [transition:color_0.15s_ease]", S1 = `${Lm} group-aria-[checked=false]:text-accent`, E1 = `${Lm} group-aria-checked:text-accent`, z1 = "relative h-[1.3rem] w-[2.4rem] shrink-0 rounded-[999px] border border-overlay-0 bg-surface-1 [transition:background_0.15s_ease] group-aria-checked:border-accent group-aria-checked:bg-panel-bg", N1 = "absolute top-px left-px h-[1.1rem] w-[1.1rem] rounded-[50%] bg-fg [box-shadow:0_1px_2px_rgba(0,0,0,0.3)] [transition:transform_0.15s_ease,background_0.15s_ease] group-aria-checked:bg-accent group-aria-checked:[transform:translateX(1.1rem)]";
function T1({
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
      className: k1,
      "data-testid": i,
      role: "switch",
      "aria-checked": s,
      "aria-label": "Toggle UI / CLI mode",
      disabled: o,
      onClick: () => l(s ? "ui" : "cli"),
      children: [
        /* @__PURE__ */ et.jsx("span", { className: jt("mode-switch__label mode-switch__label--ui", S1), children: "UI" }),
        /* @__PURE__ */ et.jsx("span", { className: jt("mode-switch__track", z1), children: /* @__PURE__ */ et.jsx("span", { className: jt("mode-switch__thumb", N1) }) }),
        /* @__PURE__ */ et.jsx("span", { className: jt("mode-switch__label mode-switch__label--cli", E1), children: "CLI" })
      ]
    }
  );
}
const Va = function(n, l) {
  let s = n;
  const u = zl[l];
  let m = null, f = 0, p = null;
  const x = [], _ = {}, k = function(h, b) {
    f = s * 4 + 17, m = (function(g) {
      const w = new Array(g);
      for (let N = 0; N < g; N += 1) {
        w[N] = new Array(g);
        for (let E = 0; E < g; E += 1)
          w[N][E] = null;
      }
      return w;
    })(f), y(0, 0), y(f - 7, 0), y(0, f - 7), j(), z(), A(h, b), s >= 7 && T(h), p == null && (p = Z(s, u, x)), R(p, b);
  }, y = function(h, b) {
    for (let g = -1; g <= 7; g += 1)
      if (!(h + g <= -1 || f <= h + g))
        for (let w = -1; w <= 7; w += 1)
          b + w <= -1 || f <= b + w || (0 <= g && g <= 6 && (w == 0 || w == 6) || 0 <= w && w <= 6 && (g == 0 || g == 6) || 2 <= g && g <= 4 && 2 <= w && w <= 4 ? m[h + g][b + w] = !0 : m[h + g][b + w] = !1);
  }, S = function() {
    let h = 0, b = 0;
    for (let g = 0; g < 8; g += 1) {
      k(!0, g);
      const w = Un.getLostPoint(_);
      (g == 0 || h > w) && (h = w, b = g);
    }
    return b;
  }, z = function() {
    for (let h = 8; h < f - 8; h += 1)
      m[h][6] == null && (m[h][6] = h % 2 == 0);
    for (let h = 8; h < f - 8; h += 1)
      m[6][h] == null && (m[6][h] = h % 2 == 0);
  }, j = function() {
    const h = Un.getPatternPosition(s);
    for (let b = 0; b < h.length; b += 1)
      for (let g = 0; g < h.length; g += 1) {
        const w = h[b], N = h[g];
        if (m[w][N] == null)
          for (let E = -2; E <= 2; E += 1)
            for (let O = -2; O <= 2; O += 1)
              E == -2 || E == 2 || O == -2 || O == 2 || E == 0 && O == 0 ? m[w + E][N + O] = !0 : m[w + E][N + O] = !1;
      }
  }, T = function(h) {
    const b = Un.getBCHTypeNumber(s);
    for (let g = 0; g < 18; g += 1) {
      const w = !h && (b >> g & 1) == 1;
      m[Math.floor(g / 3)][g % 3 + f - 8 - 3] = w;
    }
    for (let g = 0; g < 18; g += 1) {
      const w = !h && (b >> g & 1) == 1;
      m[g % 3 + f - 8 - 3][Math.floor(g / 3)] = w;
    }
  }, A = function(h, b) {
    const g = u << 3 | b, w = Un.getBCHTypeInfo(g);
    for (let N = 0; N < 15; N += 1) {
      const E = !h && (w >> N & 1) == 1;
      N < 6 ? m[N][8] = E : N < 8 ? m[N + 1][8] = E : m[f - 15 + N][8] = E;
    }
    for (let N = 0; N < 15; N += 1) {
      const E = !h && (w >> N & 1) == 1;
      N < 8 ? m[8][f - N - 1] = E : N < 9 ? m[8][15 - N - 1 + 1] = E : m[8][15 - N - 1] = E;
    }
    m[f - 8][8] = !h;
  }, R = function(h, b) {
    let g = -1, w = f - 1, N = 7, E = 0;
    const O = Un.getMaskFunction(b);
    for (let Q = f - 1; Q > 0; Q -= 2)
      for (Q == 6 && (Q -= 1); ; ) {
        for (let W = 0; W < 2; W += 1)
          if (m[w][Q - W] == null) {
            let U = !1;
            E < h.length && (U = (h[E] >>> N & 1) == 1), O(w, Q - W) && (U = !U), m[w][Q - W] = U, N -= 1, N == -1 && (E += 1, N = 7);
          }
        if (w += g, w < 0 || f <= w) {
          w -= g, g = -g;
          break;
        }
      }
  }, B = function(h, b) {
    let g = 0, w = 0, N = 0;
    const E = new Array(b.length), O = new Array(b.length);
    for (let V = 0; V < b.length; V += 1) {
      const I = b[V].dataCount, L = b[V].totalCount - I;
      w = Math.max(w, I), N = Math.max(N, L), E[V] = new Array(I);
      for (let at = 0; at < E[V].length; at += 1)
        E[V][at] = 255 & h.getBuffer()[at + g];
      g += I;
      const K = Un.getErrorCorrectPolynomial(L), X = jl(E[V], K.getLength() - 1).mod(K);
      O[V] = new Array(K.getLength() - 1);
      for (let at = 0; at < O[V].length; at += 1) {
        const st = at + X.getLength() - O[V].length;
        O[V][at] = st >= 0 ? X.getAt(st) : 0;
      }
    }
    let Q = 0;
    for (let V = 0; V < b.length; V += 1)
      Q += b[V].totalCount;
    const W = new Array(Q);
    let U = 0;
    for (let V = 0; V < w; V += 1)
      for (let I = 0; I < b.length; I += 1)
        V < E[I].length && (W[U] = E[I][V], U += 1);
    for (let V = 0; V < N; V += 1)
      for (let I = 0; I < b.length; I += 1)
        V < O[I].length && (W[U] = O[I][V], U += 1);
    return W;
  }, Z = function(h, b, g) {
    const w = Yf.getRSBlocks(h, b), N = qf();
    for (let O = 0; O < g.length; O += 1) {
      const Q = g[O];
      N.put(Q.getMode(), 4), N.put(Q.getLength(), Un.getLengthInBits(Q.getMode(), h)), Q.write(N);
    }
    let E = 0;
    for (let O = 0; O < w.length; O += 1)
      E += w[O].dataCount;
    if (N.getLengthInBits() > E * 8)
      throw "code length overflow. (" + N.getLengthInBits() + ">" + E * 8 + ")";
    for (N.getLengthInBits() + 4 <= E * 8 && N.put(0, 4); N.getLengthInBits() % 8 != 0; )
      N.putBit(!1);
    for (; !(N.getLengthInBits() >= E * 8 || (N.put(236, 8), N.getLengthInBits() >= E * 8)); )
      N.put(17, 8);
    return B(N, w);
  };
  _.addData = function(h, b) {
    b = b || "Byte";
    let g = null;
    switch (b) {
      case "Numeric":
        g = M1(h);
        break;
      case "Alphanumeric":
        g = C1(h);
        break;
      case "Byte":
        g = A1(h);
        break;
      case "Kanji":
        g = j1(h);
        break;
      default:
        throw "mode:" + b;
    }
    x.push(g), p = null;
  }, _.isDark = function(h, b) {
    if (h < 0 || f <= h || b < 0 || f <= b)
      throw h + "," + b;
    return m[h][b];
  }, _.getModuleCount = function() {
    return f;
  }, _.make = function() {
    if (s < 1) {
      let h = 1;
      for (; h < 40; h++) {
        const b = Yf.getRSBlocks(h, u), g = qf();
        for (let N = 0; N < x.length; N++) {
          const E = x[N];
          g.put(E.getMode(), 4), g.put(E.getLength(), Un.getLengthInBits(E.getMode(), h)), E.write(g);
        }
        let w = 0;
        for (let N = 0; N < b.length; N++)
          w += b[N].dataCount;
        if (g.getLengthInBits() <= w * 8)
          break;
      }
      s = h;
    }
    k(!1, S());
  }, _.createTableTag = function(h, b) {
    h = h || 2, b = typeof b > "u" ? h * 4 : b;
    let g = "";
    g += '<table style="', g += " border-width: 0px; border-style: none;", g += " border-collapse: collapse;", g += " padding: 0px; margin: " + b + "px;", g += '">', g += "<tbody>";
    for (let w = 0; w < _.getModuleCount(); w += 1) {
      g += "<tr>";
      for (let N = 0; N < _.getModuleCount(); N += 1)
        g += '<td style="', g += " border-width: 0px; border-style: none;", g += " border-collapse: collapse;", g += " padding: 0px; margin: 0px;", g += " width: " + h + "px;", g += " height: " + h + "px;", g += " background-color: ", g += _.isDark(w, N) ? "#000000" : "#ffffff", g += ";", g += '"/>';
      g += "</tr>";
    }
    return g += "</tbody>", g += "</table>", g;
  }, _.createSvgTag = function(h, b, g, w) {
    let N = {};
    typeof arguments[0] == "object" && (N = arguments[0], h = N.cellSize, b = N.margin, g = N.alt, w = N.title), h = h || 2, b = typeof b > "u" ? h * 4 : b, g = typeof g == "string" ? { text: g } : g || {}, g.text = g.text || null, g.id = g.text ? g.id || "qrcode-description" : null, w = typeof w == "string" ? { text: w } : w || {}, w.text = w.text || null, w.id = w.text ? w.id || "qrcode-title" : null;
    const E = _.getModuleCount() * h + b * 2;
    let O, Q, W, U, V = "", I;
    for (I = "l" + h + ",0 0," + h + " -" + h + ",0 0,-" + h + "z ", V += '<svg version="1.1" xmlns="http://www.w3.org/2000/svg"', V += N.scalable ? "" : ' width="' + E + 'px" height="' + E + 'px"', V += ' viewBox="0 0 ' + E + " " + E + '" ', V += ' preserveAspectRatio="xMinYMin meet"', V += w.text || g.text ? ' role="img" aria-labelledby="' + F([w.id, g.id].join(" ").trim()) + '"' : "", V += ">", V += w.text ? '<title id="' + F(w.id) + '">' + F(w.text) + "</title>" : "", V += g.text ? '<description id="' + F(g.id) + '">' + F(g.text) + "</description>" : "", V += '<rect width="100%" height="100%" fill="white" cx="0" cy="0"/>', V += '<path d="', W = 0; W < _.getModuleCount(); W += 1)
      for (U = W * h + b, O = 0; O < _.getModuleCount(); O += 1)
        _.isDark(W, O) && (Q = O * h + b, V += "M" + Q + "," + U + I);
    return V += '" stroke="transparent" fill="black"/>', V += "</svg>", V;
  }, _.createDataURL = function(h, b) {
    h = h || 2, b = typeof b > "u" ? h * 4 : b;
    const g = _.getModuleCount() * h + b * 2, w = b, N = g - b;
    return H1(g, g, function(E, O) {
      if (w <= E && E < N && w <= O && O < N) {
        const Q = Math.floor((E - w) / h), W = Math.floor((O - w) / h);
        return _.isDark(W, Q) ? 0 : 1;
      } else
        return 1;
    });
  }, _.createImgTag = function(h, b, g) {
    h = h || 2, b = typeof b > "u" ? h * 4 : b;
    const w = _.getModuleCount() * h + b * 2;
    let N = "";
    return N += "<img", N += ' src="', N += _.createDataURL(h, b), N += '"', N += ' width="', N += w, N += '"', N += ' height="', N += w, N += '"', g && (N += ' alt="', N += F(g), N += '"'), N += "/>", N;
  };
  const F = function(h) {
    let b = "";
    for (let g = 0; g < h.length; g += 1) {
      const w = h.charAt(g);
      switch (w) {
        case "<":
          b += "&lt;";
          break;
        case ">":
          b += "&gt;";
          break;
        case "&":
          b += "&amp;";
          break;
        case '"':
          b += "&quot;";
          break;
        default:
          b += w;
          break;
      }
    }
    return b;
  }, D = function(h) {
    h = typeof h > "u" ? 2 : h;
    const g = _.getModuleCount() * 1 + h * 2, w = h, N = g - h;
    let E, O, Q, W, U;
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
    for (E = 0; E < g; E += 2) {
      for (Q = Math.floor((E - w) / 1), W = Math.floor((E + 1 - w) / 1), O = 0; O < g; O += 1)
        U = "█", w <= O && O < N && w <= E && E < N && _.isDark(Q, Math.floor((O - w) / 1)) && (U = " "), w <= O && O < N && w <= E + 1 && E + 1 < N && _.isDark(W, Math.floor((O - w) / 1)) ? U += " " : U += "█", L += h < 1 && E + 1 >= N ? I[U] : V[U];
      L += `
`;
    }
    return g % 2 && h > 0 ? L.substring(0, L.length - g - 1) + Array(g + 1).join("▀") : L.substring(0, L.length - 1);
  };
  return _.createASCII = function(h, b) {
    if (h = h || 1, h < 2)
      return D(b);
    h -= 1, b = typeof b > "u" ? h * 2 : b;
    const g = _.getModuleCount() * h + b * 2, w = b, N = g - b;
    let E, O, Q, W;
    const U = Array(h + 1).join("██"), V = Array(h + 1).join("  ");
    let I = "", L = "";
    for (E = 0; E < g; E += 1) {
      for (Q = Math.floor((E - w) / h), L = "", O = 0; O < g; O += 1)
        W = 1, w <= O && O < N && w <= E && E < N && _.isDark(Q, Math.floor((O - w) / h)) && (W = 0), L += W ? U : V;
      for (Q = 0; Q < h; Q += 1)
        I += L + `
`;
    }
    return I.substring(0, I.length - 1);
  }, _.renderTo2dContext = function(h, b) {
    b = b || 2;
    const g = _.getModuleCount();
    for (let w = 0; w < g; w++)
      for (let N = 0; N < g; N++)
        h.fillStyle = _.isDark(w, N) ? "black" : "white", h.fillRect(N * b, w * b, b, b);
  }, _;
};
Va.stringToBytes = function(n) {
  const l = [];
  for (let i = 0; i < n.length; i += 1) {
    const o = n.charCodeAt(i);
    l.push(o & 255);
  }
  return l;
};
Va.createStringToBytes = function(n, l) {
  const i = (function() {
    const s = R1(n), u = function() {
      const p = s.read();
      if (p == -1) throw "eof";
      return p;
    };
    let m = 0;
    const f = {};
    for (; ; ) {
      const p = s.read();
      if (p == -1) break;
      const x = u(), _ = u(), k = u(), y = String.fromCharCode(p << 8 | x), S = _ << 8 | k;
      f[y] = S, m += 1;
    }
    if (m != l)
      throw m + " != " + l;
    return f;
  })(), o = 63;
  return function(s) {
    const u = [];
    for (let m = 0; m < s.length; m += 1) {
      const f = s.charCodeAt(m);
      if (f < 128)
        u.push(f);
      else {
        const p = i[s.charAt(m)];
        typeof p == "number" ? (p & 255) == p ? u.push(p) : (u.push(p >>> 8), u.push(p & 255)) : u.push(o);
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
  ], l = 1335, i = 7973, o = 21522, s = {}, u = function(m) {
    let f = 0;
    for (; m != 0; )
      f += 1, m >>>= 1;
    return f;
  };
  return s.getBCHTypeInfo = function(m) {
    let f = m << 10;
    for (; u(f) - u(l) >= 0; )
      f ^= l << u(f) - u(l);
    return (m << 10 | f) ^ o;
  }, s.getBCHTypeNumber = function(m) {
    let f = m << 12;
    for (; u(f) - u(i) >= 0; )
      f ^= i << u(f) - u(i);
    return m << 12 | f;
  }, s.getPatternPosition = function(m) {
    return n[m - 1];
  }, s.getMaskFunction = function(m) {
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
  }, s.getErrorCorrectPolynomial = function(m) {
    let f = jl([1], 0);
    for (let p = 0; p < m; p += 1)
      f = f.multiply(jl([1, Gn.gexp(p)], 0));
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
    for (let k = 0; k < f; k += 1)
      for (let y = 0; y < f; y += 1) {
        let S = 0;
        const z = m.isDark(k, y);
        for (let j = -1; j <= 1; j += 1)
          if (!(k + j < 0 || f <= k + j))
            for (let T = -1; T <= 1; T += 1)
              y + T < 0 || f <= y + T || j == 0 && T == 0 || z == m.isDark(k + j, y + T) && (S += 1);
        S > 5 && (p += 3 + S - 5);
      }
    for (let k = 0; k < f - 1; k += 1)
      for (let y = 0; y < f - 1; y += 1) {
        let S = 0;
        m.isDark(k, y) && (S += 1), m.isDark(k + 1, y) && (S += 1), m.isDark(k, y + 1) && (S += 1), m.isDark(k + 1, y + 1) && (S += 1), (S == 0 || S == 4) && (p += 3);
      }
    for (let k = 0; k < f; k += 1)
      for (let y = 0; y < f - 6; y += 1)
        m.isDark(k, y) && !m.isDark(k, y + 1) && m.isDark(k, y + 2) && m.isDark(k, y + 3) && m.isDark(k, y + 4) && !m.isDark(k, y + 5) && m.isDark(k, y + 6) && (p += 40);
    for (let k = 0; k < f; k += 1)
      for (let y = 0; y < f - 6; y += 1)
        m.isDark(y, k) && !m.isDark(y + 1, k) && m.isDark(y + 2, k) && m.isDark(y + 3, k) && m.isDark(y + 4, k) && !m.isDark(y + 5, k) && m.isDark(y + 6, k) && (p += 40);
    let x = 0;
    for (let k = 0; k < f; k += 1)
      for (let y = 0; y < f; y += 1)
        m.isDark(y, k) && (x += 1);
    const _ = Math.abs(100 * x / f / f - 50) / 5;
    return p += _ * 10, p;
  }, s;
})(), Gn = (function() {
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
})(), jl = function(n, l) {
  if (typeof n.length > "u")
    throw n.length + "/" + l;
  const i = (function() {
    let s = 0;
    for (; s < n.length && n[s] == 0; )
      s += 1;
    const u = new Array(n.length - s + l);
    for (let m = 0; m < n.length - s; m += 1)
      u[m] = n[m + s];
    return u;
  })(), o = {};
  return o.getAt = function(s) {
    return i[s];
  }, o.getLength = function() {
    return i.length;
  }, o.multiply = function(s) {
    const u = new Array(o.getLength() + s.getLength() - 1);
    for (let m = 0; m < o.getLength(); m += 1)
      for (let f = 0; f < s.getLength(); f += 1)
        u[m + f] ^= Gn.gexp(Gn.glog(o.getAt(m)) + Gn.glog(s.getAt(f)));
    return jl(u, 0);
  }, o.mod = function(s) {
    if (o.getLength() - s.getLength() < 0)
      return o;
    const u = Gn.glog(o.getAt(0)) - Gn.glog(s.getAt(0)), m = new Array(o.getLength());
    for (let f = 0; f < o.getLength(); f += 1)
      m[f] = o.getAt(f);
    for (let f = 0; f < s.getLength(); f += 1)
      m[f] ^= Gn.gexp(Gn.glog(s.getAt(f)) + u);
    return jl(m, 0).mod(s);
  }, o;
}, Yf = (function() {
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
  ], l = function(s, u) {
    const m = {};
    return m.totalCount = s, m.dataCount = u, m;
  }, i = {}, o = function(s, u) {
    switch (u) {
      case zl.L:
        return n[(s - 1) * 4 + 0];
      case zl.M:
        return n[(s - 1) * 4 + 1];
      case zl.Q:
        return n[(s - 1) * 4 + 2];
      case zl.H:
        return n[(s - 1) * 4 + 3];
      default:
        return;
    }
  };
  return i.getRSBlocks = function(s, u) {
    const m = o(s, u);
    if (typeof m > "u")
      throw "bad rs block @ typeNumber:" + s + "/errorCorrectionLevel:" + u;
    const f = m.length / 3, p = [];
    for (let x = 0; x < f; x += 1) {
      const _ = m[x * 3 + 0], k = m[x * 3 + 1], y = m[x * 3 + 2];
      for (let S = 0; S < _; S += 1)
        p.push(l(k, y));
    }
    return p;
  }, i;
})(), qf = function() {
  const n = [];
  let l = 0;
  const i = {};
  return i.getBuffer = function() {
    return n;
  }, i.getAt = function(o) {
    const s = Math.floor(o / 8);
    return (n[s] >>> 7 - o % 8 & 1) == 1;
  }, i.put = function(o, s) {
    for (let u = 0; u < s; u += 1)
      i.putBit((o >>> s - u - 1 & 1) == 1);
  }, i.getLengthInBits = function() {
    return l;
  }, i.putBit = function(o) {
    const s = Math.floor(l / 8);
    n.length <= s && n.push(0), o && (n[s] |= 128 >>> l % 8), l += 1;
  }, i;
}, M1 = function(n) {
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
      f = f * 10 + u(m.charAt(p));
    return f;
  }, u = function(m) {
    if ("0" <= m && m <= "9")
      return m.charCodeAt(0) - 48;
    throw "illegal char :" + m;
  };
  return o;
}, C1 = function(n) {
  const l = de.MODE_ALPHA_NUM, i = n, o = {};
  o.getMode = function() {
    return l;
  }, o.getLength = function(u) {
    return i.length;
  }, o.write = function(u) {
    const m = i;
    let f = 0;
    for (; f + 1 < m.length; )
      u.put(
        s(m.charAt(f)) * 45 + s(m.charAt(f + 1)),
        11
      ), f += 2;
    f < m.length && u.put(s(m.charAt(f)), 6);
  };
  const s = function(u) {
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
  return o;
}, A1 = function(n) {
  const l = de.MODE_8BIT_BYTE, i = Va.stringToBytes(n), o = {};
  return o.getMode = function() {
    return l;
  }, o.getLength = function(s) {
    return i.length;
  }, o.write = function(s) {
    for (let u = 0; u < i.length; u += 1)
      s.put(i[u], 8);
  }, o;
}, j1 = function(n) {
  const l = de.MODE_KANJI, i = Va.stringToBytes;
  (function(u, m) {
    const f = i(u);
    if (f.length != 2 || (f[0] << 8 | f[1]) != m)
      throw "sjis not supported.";
  })("友", 38726);
  const o = i(n), s = {};
  return s.getMode = function() {
    return l;
  }, s.getLength = function(u) {
    return ~~(o.length / 2);
  }, s.write = function(u) {
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
      p = (p >>> 8 & 255) * 192 + (p & 255), u.put(p, 13), f += 2;
    }
    if (f < m.length)
      throw "illegal char at " + (f + 1);
  }, s;
}, Qm = function() {
  const n = [], l = {};
  return l.writeByte = function(i) {
    n.push(i & 255);
  }, l.writeShort = function(i) {
    l.writeByte(i), l.writeByte(i >>> 8);
  }, l.writeBytes = function(i, o, s) {
    o = o || 0, s = s || i.length;
    for (let u = 0; u < s; u += 1)
      l.writeByte(i[u + o]);
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
}, O1 = function() {
  let n = 0, l = 0, i = 0, o = "";
  const s = {}, u = function(f) {
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
      u(n >>> l - 6), l -= 6;
  }, s.flush = function() {
    if (l > 0 && (u(n << 6 - l), n = 0, l = 0), i % 3 != 0) {
      const f = 3 - i % 3;
      for (let p = 0; p < f; p += 1)
        o += "=";
    }
  }, s.toString = function() {
    return o;
  }, s;
}, R1 = function(n) {
  const l = n;
  let i = 0, o = 0, s = 0;
  const u = {};
  u.read = function() {
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
  return u;
}, D1 = function(n, l) {
  const i = n, o = l, s = new Array(n * l), u = {};
  u.setPixel = function(x, _, k) {
    s[_ * i + x] = k;
  }, u.write = function(x) {
    x.writeString("GIF87a"), x.writeShort(i), x.writeShort(o), x.writeByte(128), x.writeByte(0), x.writeByte(0), x.writeByte(0), x.writeByte(0), x.writeByte(0), x.writeByte(255), x.writeByte(255), x.writeByte(255), x.writeString(","), x.writeShort(0), x.writeShort(0), x.writeShort(i), x.writeShort(o), x.writeByte(0);
    const _ = 2, k = f(_);
    x.writeByte(_);
    let y = 0;
    for (; k.length - y > 255; )
      x.writeByte(255), x.writeBytes(k, y, 255), y += 255;
    x.writeByte(k.length - y), x.writeBytes(k, y, k.length - y), x.writeByte(0), x.writeString(";");
  };
  const m = function(x) {
    const _ = x;
    let k = 0, y = 0;
    const S = {};
    return S.write = function(z, j) {
      if (z >>> j)
        throw "length over";
      for (; k + j >= 8; )
        _.writeByte(255 & (z << k | y)), j -= 8 - k, z >>>= 8 - k, y = 0, k = 0;
      y = z << k | y, k = k + j;
    }, S.flush = function() {
      k > 0 && _.writeByte(y);
    }, S;
  }, f = function(x) {
    const _ = 1 << x, k = (1 << x) + 1;
    let y = x + 1;
    const S = p();
    for (let R = 0; R < _; R += 1)
      S.add(String.fromCharCode(R));
    S.add(String.fromCharCode(_)), S.add(String.fromCharCode(k));
    const z = Qm(), j = m(z);
    j.write(_, y);
    let T = 0, A = String.fromCharCode(s[T]);
    for (T += 1; T < s.length; ) {
      const R = String.fromCharCode(s[T]);
      T += 1, S.contains(A + R) ? A = A + R : (j.write(S.indexOf(A), y), S.size() < 4095 && (S.size() == 1 << y && (y += 1), S.add(A + R)), A = R);
    }
    return j.write(S.indexOf(A), y), j.write(k, y), j.flush(), z.toByteArray();
  }, p = function() {
    const x = {};
    let _ = 0;
    const k = {};
    return k.add = function(y) {
      if (k.contains(y))
        throw "dup key:" + y;
      x[y] = _, _ += 1;
    }, k.size = function() {
      return _;
    }, k.indexOf = function(y) {
      return x[y];
    }, k.contains = function(y) {
      return typeof x[y] < "u";
    }, k;
  };
  return u;
}, H1 = function(n, l, i) {
  const o = D1(n, l);
  for (let f = 0; f < l; f += 1)
    for (let p = 0; p < n; p += 1)
      o.setPixel(p, f, i(p, f));
  const s = Qm();
  o.write(s);
  const u = O1(), m = s.toByteArray();
  for (let f = 0; f < m.length; f += 1)
    u.writeByte(m[f]);
  return u.flush(), "data:image/gif;base64," + u;
};
Va.stringToBytes;
function B1({ text: n }) {
  const { size: l, path: i } = J.useMemo(() => {
    const o = Va(0, "M");
    o.addData(n), o.make();
    const s = o.getModuleCount();
    let u = "";
    for (let m = 0; m < s; m++)
      for (let f = 0; f < s; f++) o.isDark(m, f) && (u += `M${f} ${m}h1v1h-1z`);
    return { size: s, path: u };
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
const Ol = J.createContext(""), Cs = (n, l) => typeof n == "string" && n.toLowerCase().includes(l);
function U1({ title: n, children: l, testId: i, ariaLabel: o }) {
  const s = J.useContext(Ol), u = s !== "" && Cs(n, s);
  return (
    // While searching, a group with no matching row (and no matching title) hides itself.
    /* @__PURE__ */ et.jsxs("section", { className: s && !u ? "mb-8 not-has-[[data-setting-row]]:hidden" : "mb-8", "data-testid": i, "aria-label": o, children: [
      n && /* @__PURE__ */ et.jsx("h3", { className: "m-0 mb-3 text-[0.9rem] font-medium text-fg", children: n }),
      /* @__PURE__ */ et.jsx("div", { className: "rounded-ui bg-surface-0 px-4", children: /* @__PURE__ */ et.jsx(Ol.Provider, { value: u ? "" : s, children: l }) })
    ] })
  );
}
function G1({ title: n, description: l, children: i, testId: o }) {
  const s = J.useContext(Ol);
  return s && !Cs(n, s) && !Cs(l, s) ? null : /* @__PURE__ */ et.jsxs("div", { "data-setting-row": !0, "data-testid": o, className: "flex items-center justify-between gap-6 py-[0.8rem] max-[700px]:flex-wrap max-[700px]:gap-y-2", children: [
    /* @__PURE__ */ et.jsxs("div", { className: "min-w-0 max-[700px]:flex-1 max-[700px]:basis-56", children: [
      /* @__PURE__ */ et.jsx("div", { className: "text-[0.85rem] text-fg", children: n }),
      l && /* @__PURE__ */ et.jsx("div", { className: "mt-[0.15rem] text-[0.75rem] text-subtext-0", children: l })
    ] }),
    i && /* @__PURE__ */ et.jsx("div", { className: "flex shrink-0 items-center gap-2", children: i })
  ] });
}
function Y1({ checked: n, onChange: l, testId: i, label: o }) {
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
const q1 = () => J.useContext(Ol), L1 = {
  select: Xs,
  selectHost: Lv,
  input: Qv,
  inputPort: Vv,
  inputWide: Kv,
  addRow: Xv,
  list: Zv,
  hostRow: Wv,
  name: Fv,
  addr: $v,
  muted: Yv,
  empty: qv,
  primary: Iv,
  danger: Pv,
  catalogToggle: Gv
};
//! State the host keeps for a resource rather than for one view of it (`useResourceState`, `@perch/sdk` 1.4): a
//! review's unsent commit message and comment, its pending batch and its operation id, keyed by the screen's
//! own name for the resource (`review:<workspace>:commit`). Every view and copy that names the same key shares the
//! value, and it outlives a reload or swap of the screen's code, a released hidden copy and the phone/desktop
//! layouts trading places. In memory: a page reload starts empty (durable drafts live in their own services).
const Q1 = 512, Ie = /* @__PURE__ */ new Map(), Ml = /* @__PURE__ */ new Map();
function Vm(n, l) {
  Ie.delete(n), Ie.set(n, l);
  for (const i of Ie.keys()) {
    if (Ie.size <= Q1) break;
    Ml.get(i)?.size || Ie.delete(i);
  }
}
function V1(n, l) {
  return Ie.has(n) ? Ie.get(n) : l;
}
function K1(n, l, i) {
  const o = V1(n, i), s = typeof l == "function" ? l(o) : l;
  if (!(Ie.has(n) && Object.is(s, o))) {
    Vm(n, s);
    for (const u of [...Ml.get(n) ?? []]) u();
  }
}
function X1(n, l) {
  if (typeof n != "string" || !n) throw new Error("useResourceState needs a non-empty key.");
  Ie.has(n) || Vm(n, l);
  const i = J.useCallback((u) => {
    const m = Ml.get(n) ?? /* @__PURE__ */ new Set();
    return Ml.set(n, m), m.add(u), () => {
      m.delete(u), m.size || Ml.delete(n);
    };
  }, [n]), o = J.useSyncExternalStore(i, () => Ie.get(n)), s = J.useCallback((u) => K1(n, u, l), [n]);
  return [o, s];
}
const Z1 = "[--radius:var(--radius-pane)] rounded-soft bg-surface-1/70 shadow-[0_6px_20px_rgba(0,0,0,0.3)] backdrop-blur-xl backdrop-saturate-150", J1 = "hover:bg-transparent hover:text-subtext-0 active:bg-surface-1 active:text-fg";
//! `@perch/sdk` for the native client: the surface a stock screen imports (the navigation part, 1.3), with every
//! call going to one abstract host object, `globalThis.perch`, read when called (so a host or a test sets it before
//! mounting). Class helpers, icons, `cn`, `keyLabel` and the host dot are the app's own modules, compiled in, so the
//! classes are the web's to the character. Data hooks subscribe to `perch.subscribe` and read the host's snapshots
//! (`perch.navigation(options)`, `perch.hosts()`, ...), which must return the same object until the data changes.
//! Menus and dialogs Perch draws itself (session menu, new session menu, confirm, select, folder browser,
//! instructions, memory) open through `perch.openOverlay(kind, props)`; their callbacks are plain functions.
const W1 = "1.3.0";
let Fr = null;
const F1 = (n) => {
  Fr = n;
};
function vt() {
  const n = (typeof Fr == "function" ? Fr() : Fr) ?? globalThis.perch;
  if (!n) throw new Error("@perch/sdk: no perch host (globalThis.perch) is set");
  return n;
}
const $1 = (n) => vt().subscribe?.(n) ?? (() => {
}), I1 = a1;
function P1() {
  return typeof globalThis.crypto?.randomUUID == "function" ? globalThis.crypto.randomUUID() : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (n) => {
    const l = Math.floor(Math.random() * 16);
    return (n === "x" ? l : l & 3 | 8).toString(16);
  });
}
const Km = globalThis.perch?.isMac !== !1, As = (n) => wv(n, vt().isMac !== !1), ty = (n) => kv(n), ey = ({ className: n, ...l } = {}) => jt(Ev(l), n), ny = Nv, Xm = (n) => Ns(n), $r = Tv, ay = Dl, ly = Hm, ry = (n) => Ts[n].color, iy = (n, l) => vt().shortcutFor?.(n, l) ?? null, oy = (n) => vt().shortcutLabel?.(n) ?? null, gi = (n, l) => vt().command(n, l ?? {}) !== !1, sy = (n, l, i) => vt().startSession?.(n, l, i), cy = globalThis.perch?.pickFolder ? (n) => vt().pickFolder(n) : null;
function qt(n) {
  const l = J.useRef(n);
  return l.current = n, J.useSyncExternalStore($1, () => l.current(vt()));
}
const Zm = (n = {}) => qt((l) => l.navigation({ showTerminals: !!n.showTerminals, sortByAttention: !!n.sortByAttention })), uy = () => qt((n) => n.hosts()), dy = () => qt((n) => n.sessionFolders());
function fy() {
  const n = qt((l) => l.addProject?.() ?? my);
  return {
    status: n.status ?? "idle",
    error: n.error,
    hostId: n.hostId,
    add: (l, i, o) => {
      l.trim() && n.status !== "pending" && vt().addProjectFolder?.(l, i, o);
    },
    clear: () => vt().clearAddProject?.()
  };
}
const my = Object.freeze({ status: "idle" }), Jm = "perch.lastAgentChoice", py = Object.freeze({ connected: !1, discovery: !1, state: "ready", choices: [] }), hy = () => {
  const n = vt().storage?.getItem(Jm);
  return n === "claude" || n === "codex" ? n : "claude";
}, gy = Object.freeze({ items: [] });
function by() {
  const n = qt((l) => l.notifications?.() ?? gy);
  return J.useMemo(() => ({
    items: n.items ?? [],
    open: (l) => vt().command("notification.open", { id: l }),
    dismiss: (l) => vt().command("notification.dismiss", { id: l })
  }), [n]);
}
function vy(n) {
  const l = qt((s) => s.agentChoices?.(n) ?? py), [i, o] = J.useState(hy);
  return J.useMemo(() => ({
    connected: !!l.connected,
    discovery: !!l.discovery,
    choices: l.choices ?? [],
    lastChoice: i,
    state: l.state ?? "ready",
    error: l.state === "error" ? l.error : void 0,
    rememberChoice: (s) => {
      s !== "claude" && s !== "codex" || (vt().storage?.setItem(Jm, s), o(s));
    },
    manage: () => vt().command("agents.manage", {})
  }), [l, i]);
}
function yy(n) {
  Xt(() => vt().onRequest?.("add-project", n) ?? void 0, [n]);
}
function xy(n) {
  const l = n.map((i) => ({ id: i.id, parentSessionId: i.parentId, session: i }));
  return n1(l).map((i) => ({ session: i.session, nested: Ms(i, l) }));
}
function wy({ id: n, plain: l, className: i }) {
  const o = qt((x) => x.session(n));
  if (!o) return null;
  const s = o.state ?? e1(o), u = Ts[s]?.color ?? Ts.unknown.color, m = o.provider, f = m === "claude" || m === "claude-agent-teams" || m === "omp", p = l ? jt("agent-mark", "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full leading-none", i) : jt("agent-status-dot", `agent-status-dot--${s}`, "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-[1.5px] bg-panel-bg leading-none", i);
  return J.createElement(
    "span",
    { className: p, style: l ? void 0 : { borderColor: u }, "data-provider": m ?? "unknown", title: l ? m ?? "Agent" : `${m ?? "Agent"} · ${s}`, "aria-hidden": "true" },
    J.createElement("span", { className: jt("inline-flex text-fg", f && "rounded-full bg-[#161616]") }, J.createElement(Wm, { provider: m, size: 14 }))
  );
}
function Wm({ provider: n, size: l = 14 }) {
  const i = vt().agentIcon?.(n, l) ?? null, o = i?.markup ?? '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><circle cx="8" cy="8" r="5" fill="currentColor"/></svg>';
  return J.createElement("svg", { width: l, height: l, "aria-hidden": "true", "data-agent-icon": n ?? "unknown", "data-perch-markup": o, ...i && i.tint === !1 ? { "data-perch-image": "true" } : {} });
}
const _y = ({ children: n }) => J.createElement(J.Fragment, null, n);
function ky(n, l) {
  const i = J.useRef(l);
  return i.current = l, Xt(() => {
    const o = vt();
    if (!o.openOverlay) throw new Error(`@perch/sdk: the host draws no overlays (perch.openOverlay), so ${n} cannot open`);
    const s = {};
    for (const [m, f] of Object.entries(i.current))
      s[m] = typeof f == "function" ? (...p) => i.current[m]?.(...p) : f;
    const u = o.openOverlay(n, s);
    return () => o.closeOverlay?.(u);
  }, [n]), null;
}
const Qn = (n) => function(i) {
  return ky(n, i);
}, Sy = Qn("session-menu"), Ey = Qn("new-session-menu"), zy = Qn("confirm");
let Fm = null;
const Ny = (n) => {
  Fm = n;
};
function Ty(n) {
  return J.createElement(Fm ?? zy, n);
}
function My({ className: n = Xs, ...l }) {
  return J.createElement(Hv, { ...l, className: n });
}
let js = null;
const Cy = (n) => {
  js = n;
}, Ay = Qn("folder-browser");
function jy(n) {
  return js ? J.createElement(js, { ...n, browse: (l) => vt().browse(n.hostId, l) }) : J.createElement(Ay, n);
}
const Oy = Qn("instructions"), Ry = Qn("memory"), Dy = Ov;
let Ws = null;
const Hy = (n) => {
  Ws = n;
};
function By(n) {
  if (Ws) return J.createElement(Gy, n);
  const { hostId: l, path: i, className: o } = n, s = J.useRef(null);
  return J.createElement(
    "button",
    {
      type: "button",
      ref: s,
      className: jt("worktree-menu__btn", Hm, o),
      "data-testid": `worktree-menu-${l}-${i}`,
      title: "New workspace (a git worktree)",
      "aria-label": "New workspace",
      "aria-expanded": !1,
      onClick: () => vt().openOverlay?.("worktree", { hostId: l, cwd: i, anchor: s.current?.getBoundingClientRect() })
    },
    J.createElement(Bm, null)
  );
}
const $m = "Perch did not answer.";
function Kr(n) {
  return n ? n.type === "worktree.error" ? { error: n.message, dirty: !!n.dirty } : n.error ? { error: String(n.error) } : {} : { error: $m };
}
function Uy(n, l, i = vt()) {
  const o = (s) => {
    for (const u of s ?? []) {
      if (u.path === l) return u;
      const m = o(u.children);
      if (m) return m;
    }
    return null;
  };
  for (const s of i.navigation({})?.projects ?? []) {
    if (s.hostId !== n) continue;
    const u = o(s.workspaces) ?? o(s.hidden);
    if (u) return u;
  }
  return null;
}
const Lf = 5 * 6e4;
function Im(n, l, i, o = vt()) {
  const s = Date.now() + Lf;
  let u = !1, m = () => {
  };
  const f = () => {
    u = !0, m(), clearTimeout(x);
  }, p = () => {
    if (!u) {
      if (Date.now() >= s) return f();
      Uy(n, l, o) && (f(), o.startSession?.(n, l, i));
    }
  }, x = setTimeout(f, Lf);
  m = o.subscribe?.(p) ?? (() => {
  }), p();
}
function Gy({ hostId: n, path: l, className: i, worktrees: o, request: s, parentChoices: u, emptyAgent: m, ...f }) {
  const [p, x] = J.useState(o), _ = (w) => !!vt().coreCan?.(w, n), k = Zm(), y = `${n}:${l}`, S = J.useMemo(() => {
    if (Array.isArray(u)) return u;
    if (!_("workspace.nest")) return [];
    const w = k?.projects?.find((O) => O.hostId === n && O.repoPath === l), N = [], E = (O, Q) => {
      for (const W of O ?? [])
        Q && N.push({ id: W.id, name: W.name, path: W.path }), E(W.children, !0);
    };
    return E(w?.workspaces, !1), N;
  }, [u, k, n, l]), z = n === "local" && _("worktree.job"), j = f.deleteSupported ?? _("worktree.delete"), T = f.startFromSupported ?? _("worktree.startFrom"), A = qt((w) => w.emptyWorkspaceAgent?.() ?? void 0), R = m ?? A ?? void 0, B = qt((w) => w.worktreeMenuRequest?.() ?? null), Z = B?.projectKey === y ? B.nonce : null, F = J.useMemo(() => s ?? (Z == null ? null : B), [s, Z]), [D, h] = J.useState(F);
  Xt(() => {
    F && h(F);
  }, [F]);
  const b = J.useRef({});
  b.current = { background: z, deleteSupported: j };
  const g = J.useMemo(() => {
    const w = (N, E) => vt().ask(N, { hostId: n, repoPath: l, ...E });
    return {
      list: async () => {
        const N = await w("worktree.list", {});
        return N?.type === "worktree.list.result" && x({ worktrees: N.worktrees ?? [], defaultRoot: N.defaultRoot ?? "", baseRef: N.baseRef, refs: N.refs ?? [] }), Kr(N);
      },
      create: async ({ branch: N, newBranch: E, path: O, extra: Q, agent: W }) => {
        const U = { branch: N, newBranch: !!E, path: O ?? null, name: Q?.name ?? null, startFrom: Q?.startFrom ?? null, parentWorkspaceId: Q?.parentWorkspaceId ?? null }, { background: V } = b.current, I = await w(V ? "worktree.job.start" : "worktree.create", U), L = V ? "worktree.job.started" : "worktree.done";
        if (I?.type !== L) return { error: Kr(I).error ?? $m };
        const K = V ? I.job?.path : I.path;
        return W && K && Im(n, K, W), { background: V };
      },
      remove: async (N, E) => {
        const O = await w("worktree.remove", { path: N, force: !!E, deleteBranch: b.current.deleteSupported });
        return { ...Kr(O), preservedBranch: O?.type === "worktree.done" ? O.preservedBranch ?? void 0 : void 0 };
      },
      deleteBranch: async (N, E) => Kr(await w("worktree.branch.delete", { branch: N, expectedHead: E })),
      open: (N) => vt().startSession?.(n, N, "terminal"),
      // The window forgets the request; the screen keeps it until a newer one, as clearing it would re-run (and so
      // cancel) the screen's effect that a measurement put off until the next frame (`measured`).
      takeRequest: () => vt().takeWorktreeRequest?.()
    };
  }, [n, l]);
  return J.createElement(Ws, {
    hostId: n,
    cwd: l,
    projectKey: y,
    className: i,
    worktrees: p,
    background: z,
    startFromSupported: T,
    deleteSupported: j,
    parentChoices: S,
    emptyAgent: R,
    request: D,
    actions: g
  });
}
const Yy = (n, l) => {
  if (!vt().followPointer?.(n)) return;
  const i = l.items();
  for (const o of i) o.getBoundingClientRect();
  i[0]?.parentElement?.getBoundingClientRect(), bv(n, l);
}, qy = () => qt((n) => n.workspaceTabs());
let Ly = 0;
function Qy({ path: n, content: l }) {
  const { source: i, truncated: o } = Rv(l ?? ""), s = vt().markdown, u = J.useMemo(() => `markdown-${++Ly}`, []);
  return Al(() => {
    s?.show(u, i);
  }, [u, i]), Xt(() => () => s?.release(u), [u]), J.createElement(
    "div",
    { className: "min-h-0 min-w-0 flex-1 overflow-auto px-4 py-3 text-[0.8rem]", style: { display: "flex", flexDirection: "column" }, tabIndex: 0, role: "region", "aria-label": `Rendered preview of ${n}`, "data-testid": "workspace-markdown-preview" },
    o && J.createElement(
      "p",
      { role: "status", className: "mt-0 text-[0.7rem] text-yellow", "data-testid": "workspace-markdown-truncated" },
      `This document is large: only the first ${Wr.toLocaleString()} characters are rendered. Switch to Source to see all of it.`
    ),
    J.createElement(
      "div",
      { className: "message__markdown file-markdown", style: { display: "flex", flexDirection: "column", flex: "1 1 0%", minHeight: 0 } },
      J.createElement("div", { "data-perch-engine": "markdown", "data-perch-key": u, className: "min-h-0 min-w-0 flex-1" })
    )
  );
}
const Vy = Qn("file-menu"), Ky = /* @__PURE__ */ new Map(), Xy = ["requestTree", "searchFiles", "openFile", "reloadFile", "requestPreview", "updateDraft", "saveFile", "overwriteFile", "setWrap"];
function Zy(n, l = {}) {
  const i = qt((x) => x.workspaceFiles(n)), o = !!l.git, s = i.git?.decorations, u = J.useMemo(() => o && s?.length ? new Map(s) : Ky, [s, o]), m = J.useMemo(() => Object.fromEntries(Xy.map((x) => [x, (..._) => (vt().filesDo(x, n, ..._), null)])), [n]), f = qt((x) => !!x.contextBridgeAvailable?.(n)), p = J.useMemo(() => f ? (x) => {
    if (x.kind !== "editor") return vt().askAgent(n, x);
    const _ = vt().workspaceFiles(n)?.documents?.[x.path];
    return vt().askAgent(n, { ...x, dirty: _?.content !== _?.savedContent });
  } : void 0, [f, n]);
  return J.useMemo(() => ({
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
const Jy = () => qt((n) => n.statusLine()), Wy = () => qt((n) => n.zoom()), Fy = () => qt((n) => n.paneLook()), $y = () => qt((n) => n.keybindings?.() ?? []), Iy = Object.freeze({ usage: Object.freeze([]), updatedAt: 0, spend: null, redeemResult: null });
function Py(n) {
  const l = !!n?.keepFresh, i = qt((s) => s.statusLine?.().connected ?? !1), o = qt((s) => s.planUsage?.() ?? Iy);
  return Xt(() => {
    if (!l || !i) return;
    let s;
    const u = () => {
      vt().command("usage.get"), s = setTimeout(u, 18e4);
    };
    return u(), () => clearTimeout(s);
  }, [l, i]), o;
}
const tx = () => vt().command("usage.get", { force: !0 }), ex = (n) => vt().command("usage.redeemReset", { accountId: n }), nx = () => gi("app.zoom_reset"), ax = {
  focused: "bg-[color-mix(in_srgb,var(--text)_10%,var(--panel-bg))] hover:bg-[color-mix(in_srgb,var(--text)_10%,var(--panel-bg))] text-fg font-semibold",
  visible: "bg-transparent text-subtext-0 hover:bg-surface-0 hover:text-fg",
  hidden: "bg-transparent text-subtext-0 hover:bg-surface-0 hover:text-fg"
}, lx = (n, l, i) => vt().beginTabDrag?.(n, l, i);
function rx(n) {
  Xt(() => vt().onRequest?.("new-tab", n) ?? void 0, [n]);
}
const ix = (n) => gi("browser.open", { workspaceId: n }), ox = (n, l) => gi("file.open", { workspaceId: n, path: l }), sx = () => null, cx = () => null, ux = Qn("new-file");
function dx(n) {
  return J.createElement(g1, { ...n, perch: vt() });
}
function fx(n, l) {
  const i = n.selection(l);
  if (i) return i;
  const o = n.value(l), s = o.split(`
`).length - (o.endsWith(`
`) && o.length ? 1 : 0);
  return { text: o, startLine: 1, endLine: Math.max(1, s) };
}
function mx({ onGo: n, onClose: l }) {
  const [i, o] = J.useState(""), s = (u) => {
    u?.preventDefault?.();
    const [m, f] = i.split(":").map((p) => Number.parseInt(p, 10));
    Number.isFinite(m) ? n(m, Number.isFinite(f) ? f : 1) : l();
  };
  return J.createElement(
    "div",
    { className: "flex shrink-0 items-center gap-2 border-b border-border px-3 py-1 text-[0.75rem] text-subtext-0", "data-testid": "editor-goto" },
    J.createElement("label", { htmlFor: "perch-editor-goto" }, "Go to line"),
    J.createElement("input", {
      id: "perch-editor-goto",
      "data-testid": "editor-goto-line",
      autoFocus: !0,
      value: i,
      className: "min-w-0 flex-1 rounded border border-border bg-transparent px-1 text-text",
      onChange: (u) => o(u.target.value),
      onKeyDown: (u) => {
        u.key === "Escape" ? (u.preventDefault(), l()) : u.key === "Enter" && s(u);
      }
    }),
    J.createElement("button", { type: "button", className: Dl, onClick: s }, "OK")
  );
}
function px({ value: n, onChange: l, onSave: i, onCaret: o, readOnly: s, wrap: u, label: m, path: f, docKey: p, onAskAgent: x, ref: _ }) {
  const k = vt().editor, y = J.useRef(null);
  y.current = { onChange: l, onSave: i, onCaret: o, onAskAgent: x };
  const [S, , z] = String(p).split("\0"), j = !!k && z !== void 0 && /^\d+$/.test(z), T = qt((g) => j ? g.workspaceFiles(S)?.carets?.[p] ?? null : null);
  Xt(() => {
    T && y.current.onCaret?.({ line: T.line, col: T.col });
  }, [T?.line, T?.col]);
  const A = J.useRef(n), [R, B] = J.useState(null), [Z, F] = J.useState(!1), D = () => {
    if (!k || !y.current.onAskAgent) return;
    const { text: g, startLine: w, endLine: N } = fx(k, p);
    y.current.onAskAgent(g, w, N);
  };
  if (J.useImperativeHandle(_, () => ({
    openGoto: () => F(!0),
    focus: () => k?.focus(p),
    askAgent: D
  }), [p]), Al(() => {
    if (!k) return;
    k.open(p, { path: f, value: n, readonly: !!s, wrap: !!u, label: m }), A.current = n;
    const g = k.watch(p, (w) => {
      for (const N of w)
        if (N.type === "change") {
          const E = k.value(p);
          A.current = E, y.current.onChange?.(E);
        } else N.type === "caret" ? y.current.onCaret?.({ line: N.line, col: N.col }) : N.type === "save" ? y.current.onSave?.() : N.type === "goto" ? F(!0) : N.type === "contextmenu" && B({ x: N.x, y: N.y });
    });
    return () => {
      g(), k.park(p);
    };
  }, [p]), Xt(() => {
    !k || j || n === A.current || (A.current = n, k.setValue(p, n, { external: !0 }));
  }, [p, n]), Xt(() => {
    k?.setReadonly(p, !!s);
  }, [p, s]), Xt(() => {
    k?.setWrap(p, !!u);
  }, [p, u]), !k)
    return J.createElement("textarea", { className: "h-full min-h-0 w-full flex-1 bg-transparent font-mono text-text", "aria-label": m, value: n, readOnly: s, onChange: (g) => l?.(g.target.value) });
  const h = (g) => () => {
    B(null), g(), k.focus(p);
  }, b = R ? !!k.selection(p) : !1;
  return J.createElement(
    "div",
    { className: "relative flex h-full min-h-0 min-w-0 flex-1 flex-col", "aria-label": m },
    Z && J.createElement(mx, {
      onGo: (g, w) => {
        F(!1), k.goTo(p, g, w), k.focus(p);
      },
      onClose: () => {
        F(!1), k.focus(p);
      }
    }),
    J.createElement("div", { "data-perch-engine": "editor", "data-perch-key": p, className: "min-h-0 min-w-0 flex-1" }),
    R && J.createElement(Uv, {
      x: R.x,
      y: R.y,
      readOnly: !!s,
      canUndo: k.canUndo(p),
      canRedo: k.canRedo(p),
      hasSelection: b,
      onClose: () => B(null),
      actions: {
        undo: h(() => k.undo(p)),
        redo: h(() => k.redo(p)),
        cut: h(() => k.cut(p)),
        copy: h(() => k.copy(p)),
        paste: h(() => k.paste(p)),
        selectAll: h(() => k.selectAll(p)),
        find: h(() => k.openSearch(p, !1)),
        replace: h(() => k.openSearch(p, !0)),
        gotoLine: () => {
          B(null), F(!0);
        },
        ...x ? { askAgent: () => {
          B(null), D();
        } } : {}
      }
    })
  );
}
const hx = Object.freeze({ pages: [], shownId: null, tabCount: 0 });
function gx(n) {
  const l = qt((i) => i.browserPages?.(n) ?? hx);
  return J.useMemo(() => {
    const i = (o, s) => vt().command(o, { workspaceId: n, ...s });
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
function bx({ pageId: n, active: l }) {
  const i = `drawer
${n}`;
  return Xt(() => {
    l && vt().command("browser.focus", { key: i });
  }, [l, i]), J.createElement("div", {
    "data-perch-engine": "browser",
    "data-perch-key": i,
    "data-testid": "browser-page",
    style: { display: "flex", flex: "1 1 0%", minHeight: 0, minWidth: 0 }
  });
}
const Rx = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  AgentIcon: Wm,
  BrowserPage: bx,
  Chevron: Js,
  CloseIcon: Av,
  CodeEditor: px,
  ConfirmDialog: Ty,
  Dialog: Dy,
  EllipsisIcon: Mv,
  FileAsset: dx,
  FileEntryMenu: Vy,
  FileIcon: y1,
  FolderBrowser: jy,
  GearIcon: Cv,
  GitMarker: _1,
  HostStateDot: jv,
  InstructionsDialog: Oy,
  MarkdownPreview: Qy,
  MemoryDialog: Ry,
  ModeSwitch: T1,
  NewFilePrompt: ux,
  NewSessionMenu: Ey,
  PageIcon: l1,
  PlusIcon: Bm,
  QrCode: B1,
  Select: My,
  SessionDot: wy,
  SessionMenu: Sy,
  SettingRow: G1,
  SettingsGroup: U1,
  SettingsQuery: Ol,
  Slot: _y,
  Submenu: t1,
  Switch: Y1,
  TabDragLayer: cx,
  TabMenu: sx,
  WorktreeMenu: By,
  agentStateColor: ry,
  anchoredPopoverStyle: I1,
  assetKind: qm,
  beginReorderDrag: Yy,
  beginTabDrag: lx,
  bindHost: F1,
  buttonClass: ny,
  cn: jt,
  drawConfirmationsInPlace: Ny,
  drawFolderBrowserInPlace: Cy,
  drawWorktreeInPlace: Hy,
  ghostButton: ay,
  glassClass: Z1,
  iconButton: ly,
  isMac: Km,
  keyLabel: As,
  menuDividerClass: $r,
  menuItemClass: Xm,
  menuPanel: hi,
  nestSessions: xy,
  newId: P1,
  openBrowserTab: ix,
  openFileTab: ox,
  pickFolder: cy,
  redeemUsageReset: ex,
  refreshUsage: tx,
  resetZoom: nx,
  rowActionClass: ey,
  runCommand: gi,
  segmentClass: ty,
  settingsClass: L1,
  shortcutFor: iy,
  shortcutLabel: oy,
  startPaneWhenReady: Im,
  startSession: sy,
  tabStateClass: ax,
  tapButtonClass: J1,
  useAddProject: fy,
  useAddProjectRequest: yy,
  useAgentChoices: vy,
  useBrowserPages: gx,
  useDismissOnOutsideClick: Ym,
  useHostSnapshot: qt,
  useHosts: uy,
  useKeybindings: $y,
  useNavigation: Zm,
  useNewTabRequest: rx,
  useNotifications: by,
  usePaneLook: Fy,
  usePlanUsage: Py,
  useResourceState: X1,
  useSessionFolders: dy,
  useSettingsQuery: q1,
  useStatusLine: Jy,
  useWorkspaceFiles: Zy,
  useWorkspaceTabs: qy,
  useZoom: Wy,
  version: W1
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
const Fs = {
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
  Fs[n] = (l, i) => l[n](i);
const Dx = Object.keys(Fs);
function fs(n, l) {
  for (const [i, o] of Object.entries(l)) {
    const s = Fs[i];
    if (!s) throw new Error(`the description key ${i} has no GPUI builder`);
    o != null && (n = s(n, o));
  }
  return n;
}
const ua = (n) => ({ clientX: n?.position?.x ?? 0, clientY: n?.position?.y ?? 0 }), Os = /* @__PURE__ */ new WeakSet(), Ir = /* @__PURE__ */ new WeakSet();
function Qf(n, l, i) {
  const o = n.pressed, s = ua(i);
  return o && o.x === s.clientX && o.y === s.clientY ? o.id : l;
}
function vx(n, l, i) {
  if (n.name) return n.name;
  if (!(l.size || n.hover || n.focus || n.active || n.track_hover && ci.has(n.group) || i)) return null;
  const o = n.meta?.attrs["data-testid"];
  return o ? `~${n.id}:${o}` : `~${n.id}`;
}
const Pm = (n, l = !1) => (n.children ?? []).some((i) => i.kind === "text" ? !l || /\s/.test(String(i.text ?? "").trim()) : i.kind === "div" && i.style?.flex_direction !== "row" && i.style?.whitespace !== "nowrap" && Pm(i, !0)), Te = (n) => n.style?.display !== "hidden";
let ci = /* @__PURE__ */ new Set(), Rs = null;
const Vf = /* @__PURE__ */ new WeakMap();
function tp(n, l = /* @__PURE__ */ new Set()) {
  let i = Vf.get(n);
  if (!i) {
    i = /* @__PURE__ */ new Set();
    for (const { group: o, style: s } of n.group_hover ?? []) "display" in s && i.add(o);
    for (const o of n.children ?? []) if (o.kind !== "text") for (const s of tp(o)) i.add(s);
    Vf.set(n, i);
  }
  for (const o of i) l.add(o);
  return l;
}
let $e = null;
const yx = (n, l, i, o, s, u, m) => `${+l}|${i}|${o.text_size}|${o.line_height}|${o.whitespace}|${o.text_ellipsis}|${+s}|${u ? `${u.group}|${u.color}` : ""}|${+Os.has(n)}|${+Ir.has(n)}|${m.get(n)?.flex_basis ?? ""}`, Kf = /* @__PURE__ */ new WeakMap();
function ep(n) {
  let l = Kf.get(n);
  return l === void 0 && (l = n.style.overflow_x === "scroll" || n.style.overflow_y === "scroll" || (n.children ?? []).some((i) => i.kind !== "text" && ep(i)), Kf.set(n, l)), l;
}
function np(n, l, i, o) {
  let s = xx(l.get(n), i.get(n));
  if (n.kind === "text") return s;
  for (const u of n.children ?? []) np(u, l, i, o) || (s = !1);
  return s && o.add(n), s;
}
function xx(n, l) {
  if (n === l) return !0;
  if (!n || !l) return !1;
  const i = Object.keys(n);
  if (i.length !== Object.keys(l).length) return !1;
  for (const o of i) if (n[o] !== l[o]) return !1;
  return !0;
}
function Ds(n, l, i, o, s = !1, u = !1, m = null, f = {}, p = !1, x = /* @__PURE__ */ new Map(), _ = null) {
  if (n.kind === "text") return x.get(n)?.text ?? n.text;
  const k = $e && !s && !ep(n) ? yx(n, u, m, f, p, _, x) : null;
  if (k !== null && $e.clean.has(n)) {
    const S = $e.from.get(n), z = S?.key === k ? l.reuse(S.id, $e.generation) : null;
    if (z)
      return $e.next.set(n, { id: z.__id, key: k }), z;
  }
  const y = wx(n, l, i, o, s, u, m, f, p, x, _);
  return k !== null && $e.next.set(n, { id: y.__id, key: k }), y;
}
function wx(n, l, i, o, s, u, m, f, p, x, _) {
  const k = Os.has(n);
  u ||= n.style.opacity === 0 || n.style.visibility === "invisible" || n.style.display === "hidden", u && (n.name || n.range_name) && (n = { ...n, name: void 0, range_name: void 0, also: void 0 }), n.style.text_color !== void 0 && (_ = null), m = n.style.text_color ?? m;
  const y = !!n.hover?.text_color && ip(n), S = n.group ?? (y ? `~g${n.id}` : null);
  y && (_ = { group: S, color: n.hover.text_color }), f = { ...f };
  for (const E of ["text_size", "line_height", "whitespace", "text_ellipsis"]) n.style[E] !== void 0 && (f[E] = n.style[E]);
  const z = new Set(n.events ?? []), j = s ? { count: 0, hits: /* @__PURE__ */ new Set(), at: null } : !u && !n.pointer_none && n.style.position === "absolute" ? Rs : null, T = j ? j.count++ : -1;
  s && (Rs = j);
  let A;
  if (n.kind === "image" && !n.markup ? A = l.image(n.src) : A = l.div(), n.kind === "engine" && (A = A.child(o.engine ? o.engine(n.engine, n.key) : l.div())), n.markup && n.kind === "svg" && _ && _.color !== m) {
    const { group: E, color: O } = _, Q = () => l.div().absolute().top(0).left(0).size_full();
    A = A.child(Q().group_hover(E, (W) => W.invisible()).child(o.icon(`~icon-${n.id}`, n.markup, m))).child(Q().invisible().group_hover(E, (W) => W.visible()).child(o.icon(`~icon-${n.id}-hover`, n.markup, O)));
  } else n.markup && (A = A.child(o.icon(`~icon-${n.id}`, n.markup, n.kind === "svg" ? m : "")));
  const R = vx(n, z, !!j);
  if (R && (A = A.id(R)), n.measure && (A = A.measure(n.measure)), n.name && A.also_named) for (const E of n.also ?? []) A = A.also_named(E);
  A = fs(A, { ...n.style, ...x.get(n) });
  const B = f.whitespace !== "nowrap" && !f.text_ellipsis;
  p && B && n.style.flex_shrink !== 0 && n.style.min_w === void 0 && Pm(n) && (A = A.min_w(0));
  for (const E of ["hover", "focus", "active"]) n[E] && (A = A[E]((O) => fs(O, n[E])));
  S && (A = A.group(S));
  for (const { group: E, style: O } of n.group_hover ?? []) {
    const { display: Q, ...W } = O;
    Object.keys(W).length && (A = A.group_hover(E, (U) => fs(U, W)));
  }
  if (l.scroll && (n.style.overflow_x === "scroll" || n.style.overflow_y === "scroll")) {
    const E = i.document?.scrollTarget, O = E ? (n.children ?? []).filter(Te).findIndex((Q) => rp(Q, E.id)) : -1;
    if (O >= 0 && (i.scroller ?? n.id) === n.id && (i.document.scrollTarget = null, i.scroller = n.id, l.scroll.scroll_to_item(O)), i.scroller ??= n.id, i.scroller === n.id && i.document) {
      A = A.track_scroll(l.scroll);
      const Q = (n.children ?? []).filter(Te).map((W) => W.id);
      i.document.itemBounds = (W) => Q.includes(W) ? l.scroll.item_bounds?.(Q.indexOf(W)) ?? null : null;
    }
  }
  const Z = n.style.overflow_x === "scroll" || n.style.overflow_y === "scroll", F = s && !n.pointer_none || n.blocks_pointer;
  if ((Z && Ir.has(n) || F) && (A = A.on_scroll_wheel((E, O) => O.stop_propagation?.())), Z && z.has("scroll") && (A = A.on_scroll_wheel((E, O) => {
    i.dispatch(n.id, "scroll", {}), O.notify();
  })), Z || Ir.has(n)) for (const E of n.children ?? []) E.kind !== "text" && Ir.add(E);
  n.kind === "input" && !n.disabled && (A = A.on_mouse_down("left", (E, O) => {
    E.bounds && i.setBounds(n.id, E.bounds), i.focus(n.id), O.notify();
  }));
  const D = n.kind === "input" ? n : n.meta?.tag === "label" ? lp(n) : null;
  D && !D.disabled && /^(checkbox|radio)$/.test(D.input_type) && (A = A.on_click((E, O) => {
    O.stop_propagation?.(), i.toggle(D.id), O.notify();
  }));
  const h = ["click", "double_click", "context_menu", "mouse_down", "mouse_up"].some((E) => z.has(E));
  if (h || k) for (const E of n.children ?? []) E.kind !== "text" && Os.add(E);
  if (h && (A = A.on_mouse_down("left", (E, O) => {
    O.stop_propagation?.(), E.bounds && i.setBounds(n.id, E.bounds);
    const Q = { ...ua(E), button: 0, buttons: 1, detail: E.click_count }, W = Qf(i, n.id, E);
    i.pressed = null, i.dispatch(W, "pointerdown", { ...Q, pointerType: "mouse" }), i.dispatch(W, "mousedown", Q) && i.pressFocus?.(W), O.notify();
  }), A = A.on_mouse_down("right", (E, O) => {
    O.stop_propagation?.(), E.bounds && i.setBounds(n.id, E.bounds);
    const Q = Qf(i, n.id, E);
    i.pressed = null, i.dispatch(Q, "contextmenu", { ...ua(E), button: 2 }), O.notify();
  }), A = A.on_mouse_up("left", (E, O) => {
    O.stop_propagation?.();
    const Q = { ...ua(E), button: 0 };
    i.dispatch(n.id, "pointerup", { ...Q, pointerType: "mouse" }), i.dispatch(n.id, "mouseup", Q), O.notify();
  }), A = A.on_click((E, O) => {
    i.dispatch(n.id, E.click_count === 2 && z.has("double_click") ? "dblclick" : "click", { detail: E.click_count, button: 0 }), O.notify();
  })), n.blocks_pointer && !h)
    for (const E of ["left", "right"]) A = A.on_mouse_down(E, (O, Q) => Q.stop_propagation?.());
  else if (k && !h)
    for (const E of ["left", "right"])
      A = A.on_mouse_down(E, (O) => {
        const Q = ua(O);
        (i.pressed?.x !== Q.clientX || i.pressed?.y !== Q.clientY) && (i.pressed = { id: n.id, x: Q.clientX, y: Q.clientY });
      });
  if (z.has("mouse_move") && (A = A.on_mouse_move((E) => {
    i.dispatch(n.id, "pointermove", { ...ua(E), pointerType: "mouse" });
  })), n.track_hover && ci.has(n.group) && (A = A.on_hover((E, O) => {
    i.hover(n.id, E), O.notify();
  })), j && (A = A.on_mouse_down_out((E, O) => {
    const Q = ua(E), W = `${Q.clientX},${Q.clientY}`;
    j.at !== W && (j.at = W, j.hits = /* @__PURE__ */ new Set()), j.hits.add(T), !(j.hits.size < j.count) && (j.at = null, i.dispatch(i.document.body.id, "pointerdown", { ...Q, pointerType: "mouse" }), i.dispatch(i.document.body.id, "mousedown", Q), O.notify());
  })), n.kind === "input" && !/^(checkbox|radio|range|color|file|select)$/.test(n.input_type)) {
    const E = n.value ? String(n.value) : String(n.placeholder ?? "");
    let O = l.div().whitespace_nowrap().overflow_x_hidden();
    const Q = da(f);
    Q && (O = O.h(Q)), !n.value && m && (O = O.text_color(kx(m))), E && (A = A.child(O.child(n.input_type === "password" && n.value ? "•".repeat([...E].length) : E))), n.field_w && (A = A.child(l.div().w(n.field_w).h(0)));
  }
  const b = f.whitespace === "nowrap" ? da(f) : null, g = n.style.display === "flex" && !String(n.style.flex_direction ?? "row").startsWith("col");
  let w = !n.range_name;
  const N = n.style.display === "flex" && String(n.style.flex_direction ?? "row").startsWith("col") && (n.style.h === void 0 || n.style.h === "auto") && typeof n.style.max_h == "number";
  for (const E of (n.children ?? []).filter(Te)) {
    const O = E.style?.flex_basis;
    N && E.style.flex_grow > 0 && (O === 0 || typeof O == "string" && O.endsWith("%")) && x.set(E, { ...x.get(E), flex_basis: "auto" });
    let Q = Ds(E, l, i, o, !1, u, m, f, g && E.style?.position !== "absolute", x, _);
    const W = !w && (E.kind === "text" || !E.meta), U = E.kind === "text" ? x.get(E)?.h ?? b : null, V = E.kind === "text" ? x.get(E)?.w : void 0;
    if (W || U || V !== void 0) {
      let I = l.div();
      W && (I = I.id(n.range_name)), W && !g && n.style.display === "flex" && (I = I[`self_${_x[f.text_align] ?? "start"}`]().max_w("100%")), U && (I = I.h(U)), V !== void 0 && (I = I.w(V).flex_none().whitespace_nowrap()), Q = I.child(Q), w ||= W;
    }
    A = A.child(Q);
  }
  return A;
}
const _x = { center: "center", right: "end", end: "end" };
function kx(n) {
  const l = String(n);
  if (!/^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(l)) return n;
  const i = l.length === 9 ? Number.parseInt(l.slice(7), 16) : 255;
  return `${l.slice(0, 7)}${Math.round(i / 2).toString(16).padStart(2, "0")}`;
}
const ap = /^(?:[!-,.-~]+|\S)$/u, lp = (n) => {
  for (const l of n.children ?? []) {
    if (l.kind === "input" && /^(checkbox|radio)$/.test(l.input_type)) return l;
    const i = l.kind === "text" ? null : lp(l);
    if (i) return i;
  }
  return null;
}, rp = (n, l) => n.id === l || (n.children ?? []).some((i) => i.kind !== "text" && rp(i, l)), ip = (n) => !!n.markup || (n.children ?? []).some((l) => l.kind !== "text" && ip(l));
function da(n) {
  const l = n.line_height;
  return typeof l == "string" && l.endsWith("px") ? Number.parseFloat(l) : typeof l == "number" && typeof n.text_size == "number" ? l * n.text_size : null;
}
function Hx(n, l, i, o, s = 0, u = !1) {
  const m = [n.root, ...n.overlays];
  ci = /* @__PURE__ */ new Set(), Rs = null;
  for (const y of m) tp(y, ci);
  const f = s > 0 ? Cx(m, s) : /* @__PURE__ */ new Map();
  s > 0 && o.measure && Sx(m, s, o.measure, f), Tx(m, f), Nx(m, f), o.measure && zx(m, o.measure, f);
  const p = l.reuse && l.renderGeneration ? i.retained ??= { built: /* @__PURE__ */ new Map(), overrides: /* @__PURE__ */ new Map(), generation: -1 } : null, x = new Map(f);
  p && n.root && ($e = { from: p.built, generation: p.generation, clean: /* @__PURE__ */ new Set(), next: /* @__PURE__ */ new Map() }, np(n.root, f, p.overrides, $e.clean));
  let _;
  try {
    _ = l.div().relative().size_full().child(Ds(n.root, l, i, o, !1, !1, null, {}, !1, f)), p && Object.assign(p, { built: $e?.next ?? /* @__PURE__ */ new Map(), overrides: x, generation: l.renderGeneration() ?? -1 });
  } finally {
    $e = null;
  }
  let k = u && n.overlays.length ? l.div().relative().size_full().window_layer() : _;
  for (const y of n.overlays) k = k.child(Ds(y, l, i, o, !0, !1, null, {}, !1, f));
  return k === _ ? _ : _.child(k);
}
function Sx(n, l, i, o) {
  (Xr.scale !== l || Xr.measure !== i) && (Xr = { scale: l, measure: i, widths: /* @__PURE__ */ new WeakMap(), fonts: /* @__PURE__ */ new WeakMap(), keys: /* @__PURE__ */ new WeakMap(), visits: /* @__PURE__ */ new WeakMap() });
  const { widths: s, fonts: u, keys: m, visits: f } = Xr, p = [], x = (R, B) => o.set(R, { ...o.get(R), ...B }), _ = (R, B) => {
    p.push(R, B), x(R, B);
  }, k = ["text_size", "font_weight", "font_family", "italic", "whitespace", "text_ellipsis"];
  function y(R, B, Z) {
    if (R.kind === "text") {
      if (!(B.whitespace === "nowrap" || ap.test(R.text)) || B.text_ellipsis || Z || typeof B.text_size != "number") return NaN;
      const E = i(R.text, { size: B.text_size, weight: B.font_weight ?? 400, family: B.font_family ?? ".SystemUIFont", italic: !!B.italic });
      return Number.isFinite(E) ? E : NaN;
    }
    if (!Te(R) || R.kind === "input" || R.kind === "engine" || R.markup) return S(R);
    const F = `${B.text_size}|${B.font_weight}|${B.font_family}|${B.italic}|${B.whitespace}|${B.text_ellipsis}|${+Z}`;
    if (m.get(R) === F && s.has(R)) return s.get(R);
    m.set(R, F);
    const D = { ...B };
    for (const N of k) R.style[N] !== void 0 && (D[N] = R.style[N]);
    D.text_ellipsis = !!R.style.text_ellipsis, u.set(R, D);
    const h = R.style, b = (R.children ?? []).filter(Qe), g = b.map((N) => y(N, D, Z || !!R.tabular));
    let w = S(R);
    if (!Number.isFinite(w) && h.w === void 0) {
      const N = b.map((O, Q) => g[Q] + (O.kind === "text" ? 0 : ot(O.style.ml) + ot(O.style.mr)));
      let E;
      b.length ? Re(R) ? E = b.some((O) => O.kind !== "text" && O.style.flex_grow > 0) || h.flex_wrap === "wrap" ? NaN : N.reduce((O, Q) => O + Q, 0) + ot(h.gap_x) * (b.length - 1) : E = Math.max(...N) : E = 0, w = E + ot(h.pl) + ot(h.pr) + ot(h.border_l) + ot(h.border_r), typeof h.min_w == "number" && (w = Math.max(w, h.min_w)), typeof h.max_w == "number" && (w = Math.min(w, h.max_w));
    }
    return s.set(R, w), w;
  }
  const S = (R) => typeof R.style?.w == "number" ? R.style.w : NaN, z = () => ({ exact: 0, laid: 0 }), j = (R, B) => {
    if (!Number.isFinite(B))
      return Object.assign(R, z()), NaN;
    R.exact += B;
    const Z = Math.round(R.exact * l + 1e-9) / l, F = Z - R.laid;
    return R.laid = Z, F;
  }, T = (R) => Re(R) && R.style.flex_wrap !== "wrap" && (R.style.justify ?? "start") === "start";
  function A(R) {
    if (!R || R.kind === "text" || !Te(R)) return;
    const B = m.get(R), Z = f.get(R);
    if (Z && B !== void 0 && Z.key === B) {
      for (let h = 0; h < Z.log.length; h += 2)
        p.push(Z.log[h], Z.log[h + 1]), x(Z.log[h], Z.log[h + 1]);
      return;
    }
    const F = p.length, D = (R.children ?? []).filter(Qe);
    if (T(R) && D.length > 1) {
      const h = ot(R.style.gap_x), b = z(), g = !(h && D.some((w) => w.kind === "text" || !Number.isFinite(ot(w.style.ml))));
      _(R, { border_l: j(b, ot(R.style.border_l)), pl: j(b, ot(R.style.pl)) }), g && h && _(R, { gap_x: 0 }), D.forEach((w, N) => {
        const E = (N && g ? h : 0) + (w.kind === "text" ? 0 : ot(w.style.ml));
        if (w.kind === "text")
          E && Object.assign(b, z());
        else {
          const U = j(b, E);
          Number.isFinite(U) && _(w, { ml: U });
        }
        const O = w.kind === "text" ? u.get(R) ?? {} : null, Q = w.kind === "text" ? y(w, O, !!R.tabular) : s.get(w);
        if ((w.kind === "text" || !(w.style.flex_grow > 0)) && Number.isFinite(Q)) {
          const U = { w: j(b, Q) };
          w.kind !== "text" && typeof w.style.w != "number" && w.style.min_w === void 0 && (U.whitespace = "nowrap", U.flex_shrink = 0), _(w, U);
        } else Object.assign(b, z());
        if (w.kind !== "text") {
          const U = j(b, ot(w.style.mr));
          Number.isFinite(U) && _(w, { mr: U });
        }
      });
    }
    for (const h of R.children ?? []) h.kind !== "text" && A(h);
    B !== void 0 && f.set(R, { key: B, log: p.slice(F) });
  }
  for (const R of n)
    R && (y(R, {}, !1), A(R));
}
let Xr = { scale: 0, measure: null };
const Ex = /(?<= +)(?=[^ ])|(?<=[\p{L}\p{N}]-)(?=[\p{L}\p{N}])/u;
function zx(n, l, i) {
  const o = ["text_size", "font_weight", "font_family", "italic", "line_height"], s = (_) => typeof _ == "number" ? _ : 0, u = (_, k) => k && ui(k) && !Re(k) && _.style.position !== "absolute" && !["start", "center", "end"].includes(_.style.self) && !["start", "center", "end"].includes(k.style.items);
  Zr.measure !== l && (Zr = { measure: l, walks: /* @__PURE__ */ new WeakMap() });
  const m = [], f = (_, k) => {
    m.push(_, k), i.set(_, { ...i.get(_), ...k });
  }, p = (_, k, y, S) => {
    if (!_ || _.kind === "text" || !Te(_)) return;
    const z = `${y}|${+u(_, k)}|${S.text_size}|${S.font_weight}|${S.font_family}|${S.italic}|${S.line_height}`, j = Zr.walks.get(_);
    if (j?.key === z) {
      for (let A = 0; A < j.log.length; A += 2) f(j.log[A], j.log[A + 1]);
      return;
    }
    const T = m.length;
    x(_, k, y, S), Zr.walks.set(_, { key: z, log: m.slice(T) });
  }, x = (_, k, y, S) => {
    const z = _.style;
    let j = typeof z.w == "number" ? z.w : z.w === "100%" ? y : u(_, k) ? y - s(z.ml) - s(z.mr) : NaN;
    typeof z.max_w == "number" && (j = Math.min(j, z.max_w));
    const T = j - s(z.pl) - s(z.pr) - s(z.border_l) - s(z.border_r), A = { ...S };
    for (const B of o) z[B] !== void 0 && (A[B] = z[B]);
    const R = _.children ?? [];
    if (_.break_anywhere && Number.isFinite(T) && T > 0 && typeof A.text_size == "number" && R.length && R.every((B) => B.kind === "text")) {
      const B = { size: A.text_size, weight: A.font_weight ?? 400, family: A.font_family ?? ".SystemUIFont", italic: !!A.italic }, Z = (h) => l(h.trimEnd(), B) <= T + 0.01;
      let F = 0;
      for (const h of R) {
        const b = [];
        for (const w of h.text.split(`
`)) {
          let N = "";
          for (const E of w.split(Ex)) {
            if (Z(N + E)) {
              N += E;
              continue;
            }
            N && b.push(N.trimEnd()), N = "";
            for (const O of E)
              N && !Z(N + O) && (b.push(N), N = ""), N += O;
          }
          b.push(N.trimEnd());
        }
        const g = b.join(`
`);
        b.every((w) => !w || Z(w)) ? g !== h.text && f(h, { text: g }) : F = NaN, F += b.length;
      }
      const D = da(A);
      Number.isFinite(F) && D && z.h === void 0 && R.length === 1 && f(_, { h: F * D + s(z.pt) + s(z.pb) + s(z.border_t) + s(z.border_b) });
    }
    for (const B of R) p(B, _, Re(_) ? NaN : T, A);
  };
  for (const _ of n) p(_, null, NaN, {});
}
let Zr = { measure: null };
function Nx(n, l) {
  const i = (o, s) => {
    if (!o || o.kind === "text" || !Te(o)) return;
    const u = o.style, m = u.position === "absolute" ? u.w === void 0 && (u.left === void 0 || u.right === void 0) : s && typeof u.w != "number";
    if (m && Re(o))
      for (const f of o.children ?? []) {
        const p = f.kind === "text" ? void 0 : f.style.flex_basis;
        f.kind !== "text" && f.style.flex_grow > 0 && (p === 0 || typeof p == "string" && p.endsWith("%")) && l.set(f, { ...l.get(f), flex_basis: "auto" });
      }
    for (const f of o.children ?? []) i(f, m);
  };
  for (const o of n) i(o, !1);
}
function Tx(n, l) {
  const i = l.heights ?? /* @__PURE__ */ new Map(), o = (p) => i.get(p), s = (p) => {
    const x = o(p);
    if (Number.isFinite(x)) return x;
    if (p.kind === "text" || !Te(p)) return 0;
    const _ = p.style, k = typeof _.min_h == "number" ? _.min_h : 0, y = (p.children ?? []).filter(Qe), S = y.map((T) => s(T) + (T.kind === "text" ? 0 : Math.max(0, ot(T.style.mt) || 0) + Math.max(0, ot(T.style.mb) || 0))), z = y.length ? Re(p) ? Math.max(...S) : S.reduce((T, A) => T + A, 0) + (_.display === "flex" ? (ot(_.gap_y) || 0) * (y.length - 1) : 0) : 0, j = [_.pt, _.pb, _.border_t, _.border_b].reduce((T, A) => T + (ot(A) || 0), 0);
    return Math.max(k, z + j);
  }, u = (p) => !(p.children ?? []).filter(Qe).length || Re(p) ? NaN : s({ ...p, style: { ...p.style, h: void 0, max_h: void 0, min_h: void 0 } }), m = (p, x) => {
    const _ = p.style;
    if (typeof _.h == "number") return _.h;
    if (typeof _.max_h == "number") return _.max_h;
    if (!x || !ui(x) || Re(x)) return NaN;
    const k = x.style, y = typeof k.h == "number" ? k.h : typeof k.max_h == "number" ? k.max_h : NaN, S = (x.children ?? []).filter(Qe);
    let z = 0;
    for (const T of S) {
      if (T === p) continue;
      const A = o(T);
      if (!Number.isFinite(A)) return NaN;
      z += A + (T.kind === "text" ? 0 : ot(T.style.mt) + ot(T.style.mb));
    }
    const j = k.display === "flex" ? ot(k.gap_y) * Math.max(0, S.length - 1) : 0;
    return y - ot(k.pt) - ot(k.pb) - ot(k.border_t) - ot(k.border_b) - z - j - ot(_.mt) - ot(_.mb);
  }, f = (p, x) => {
    if (!(!p || p.kind === "text" || !Te(p))) {
      if (p.scrollbar > 0 && p.style.overflow_y === "scroll") {
        const _ = u(p), k = m(p, x);
        Number.isFinite(_) && Number.isFinite(k) && _ > k + 0.01 && l.set(p, { ...l.get(p), pr: ot(p.style.pr) + p.scrollbar });
      }
      for (const _ of p.children ?? []) f(_, p);
    }
  };
  for (const p of n) f(p, null);
}
const Mx = ["text_size", "line_height", "whitespace", "text_ellipsis"], ot = (n) => n == null ? 0 : typeof n == "number" ? n : NaN, ui = (n) => n.style.display === "flex" ? n.style.flex_direction === "col" : !0, Re = (n) => n.style.display === "flex" && (n.style.flex_direction ?? "row") === "row", Qe = (n) => n.kind === "text" || Te(n) && n.style.position !== "absolute";
function Cx(n, l) {
  ms.scale !== l && (ms = op(l));
  const { heights: i, texts: o, textKeys: s, visits: u, places: m } = ms, f = /* @__PURE__ */ new Map(), p = [], x = (D, h) => {
    const b = f.get(D);
    f.set(D, b ? { ...b, ...h } : h);
  }, _ = (D, h) => {
    let b = null;
    for (const g in h)
      Number.isFinite(h[g]) && ((b ??= {})[g] = h[g]);
    b && (p.push(D, b), x(D, b));
  }, k = (D) => {
    for (let h = 0; h < D.length; h += 2)
      p.push(D[h], D[h + 1]), x(D[h], D[h + 1]);
  };
  function y(D, h) {
    if (D.kind === "text") return h.whitespace === "nowrap" || ap.test(D.text) ? da(h) ?? NaN : NaN;
    const b = `${h.text_size}|${h.line_height}|${h.whitespace}|${h.text_ellipsis}`;
    if (s.get(D) === b && i.has(D)) return i.get(D);
    let g = h;
    for (const Q of Mx) D.style[Q] !== void 0 && D.style[Q] !== g[Q] && (g === h && (g = { ...h }), g[Q] = D.style[Q]);
    s.set(D, b), o.set(D, g);
    const w = D.style, N = (D.children ?? []).filter(Qe), E = N.map((Q) => y(Q, g));
    let O;
    if (w.h !== void 0 && w.h !== "auto") O = ot(w.h);
    else if (D.kind === "engine") O = NaN;
    else if (D.kind === "input")
      O = (D.input_type === "textarea" || D.input_type === "select" ? NaN : da(g) ?? NaN) + ot(w.pt) + ot(w.pb) + ot(w.border_t) + ot(w.border_b), w.min_h !== void 0 && (O = Math.max(O, ot(w.min_h)));
    else {
      const Q = N.map((U, V) => (U.kind === "text" ? 0 : ot(U.style.mt) + ot(U.style.mb)) + E[V]);
      let W;
      if (Re(D)) W = w.flex_wrap === "wrap" ? NaN : w.items === "baseline" ? z(N, E, g) : Math.max(0, ...Q);
      else if (ui(D)) {
        const U = N.some((I) => I.kind !== "text" && (I.style.flex_grow > 0 || I.style.flex_basis !== void 0)), V = w.display !== "flex" && N.some((I) => I.kind !== "text" && (ot(I.style.mt) || ot(I.style.mb)));
        W = U || V ? NaN : Q.reduce((I, L) => I + L, 0) + (w.display === "flex" ? ot(w.gap_y) * Math.max(0, N.length - 1) : 0);
      } else W = NaN;
      O = W + ot(w.pt) + ot(w.pb) + ot(w.border_t) + ot(w.border_b), w.min_h !== void 0 && (O = Math.max(O, ot(w.min_h))), w.max_h !== void 0 && (O = Math.min(O, ot(w.max_h)));
    }
    return i.set(D, O), O;
  }
  const S = (D) => (da(D) - (ii + pm) * D.text_size) / 2 + ii * D.text_size;
  function z(D, h, b) {
    let g = 0, w = 0;
    for (const [N, E] of D.entries()) {
      const O = E.kind === "text" ? b : o.get(E);
      if (!(E.kind === "text" || (E.children ?? []).filter(Qe).every((V) => V.kind === "text")) || !Number.isFinite(h[N]) || typeof O.text_size != "number") return NaN;
      const W = E.kind === "text" ? {} : E.style, U = ot(W.mt) + ot(W.border_t) + ot(W.pt) + S(O);
      g = Math.max(g, U), w = Math.max(w, ot(W.mt) + h[N] + ot(W.mb) - U);
    }
    return g + w;
  }
  const j = () => ({ exact: 0, laid: 0 }), T = (D, h) => {
    if (!Number.isFinite(h))
      return Object.assign(D, j()), NaN;
    D.exact += h;
    const b = Math.round(D.exact * l + 1e-9) / l, g = b - D.laid;
    return D.laid = b, g;
  };
  function A(D) {
    if (D.kind === "text" || !Te(D)) return;
    const h = s.get(D), b = u.get(D);
    if (b && h !== void 0 && b.key === h) return k(b.log);
    const g = p.length;
    for (const w of (D.children ?? []).filter((N) => N.kind !== "text" && Te(N) && N.style.position === "absolute")) A(w);
    if (ui(D) && !Re(D)) {
      const w = j();
      _(D, { border_t: T(w, ot(D.style.border_t)), pt: T(w, ot(D.style.pt)) }), R(D, w);
    } else for (const w of (D.children ?? []).filter(Qe)) w.kind !== "text" && A(w);
    h !== void 0 && u.set(D, { key: h, log: p.slice(g) });
  }
  function R(D, h) {
    const b = (D.children ?? []).filter(Qe), g = D.style.display === "flex" ? ot(D.style.gap_y) : 0;
    if (g && b.some((w) => w.kind === "text")) {
      for (const w of b) w.kind !== "text" && A(w);
      return !1;
    }
    return g && _(D, { gap_y: 0 }), b.forEach((w, N) => {
      if (w.kind === "text") {
        const E = y(w, o.get(D) ?? {});
        Number.isFinite(E) ? _(w, { h: T(h, E) }) : Object.assign(h, j());
        return;
      }
      if (_(w, { mt: T(h, (N ? g : 0) + ot(w.style.mt)) }), Number.isFinite(i.get(w))) Z(w, h);
      else if (B(w)) {
        const E = w.style;
        _(w, { border_t: T(h, ot(E.border_t)), pt: T(h, ot(E.pt)) }), _(w, { pb: T(h, ot(E.pb)), border_b: T(h, ot(E.border_b)) });
      } else
        A(w), Object.assign(h, j());
      _(w, { mb: T(h, ot(w.style.mb)) });
    }), !0;
  }
  function B(D) {
    const h = D.style, b = (D.children ?? []).filter(Qe), g = da(o.get(D) ?? {});
    return D.kind === "div" && !Re(D) && b.length > 0 && b.every((w) => w.kind === "text") && Number.isInteger(g) && [h.h, h.min_h, h.max_h].every((w) => w === void 0 || w === "auto");
  }
  function Z(D, h) {
    const b = `${s.get(D)}|${Math.round((h.exact - h.laid) * 1e6)}`, g = m.get(D);
    if (g && g.key === b) {
      k(g.log), h.exact += g.exact, h.laid += g.laid;
      return;
    }
    const w = p.length, [N, E] = [h.exact, h.laid];
    F(D, h), m.set(D, { key: b, log: p.slice(w), exact: h.exact - N, laid: h.laid - E });
  }
  function F(D, h) {
    const b = D.style;
    for (const O of (D.children ?? []).filter((Q) => Q.kind !== "text" && Te(Q) && Q.style.position === "absolute")) A(O);
    const g = h.laid, w = h.exact;
    _(D, { border_t: T(h, ot(b.border_t)), pt: T(h, ot(b.pt)) });
    const N = b.h !== void 0 && b.h !== "auto", E = i.get(D) - ot(b.pt) - ot(b.pb) - ot(b.border_t) - ot(b.border_b);
    if (D.kind === "input")
      N || T(h, E);
    else if (Re(D) || N && (b.justify ?? "start") !== "start") {
      for (const O of (D.children ?? []).filter(Qe)) O.kind !== "text" && A(O);
      N || T(h, E);
    } else !R(D, h) && !N && T(h, E);
    if (N) {
      h.exact = w + i.get(D), h.laid = Math.round(h.exact * l + 1e-9) / l, _(D, { h: h.laid - g });
      return;
    }
    _(D, { pb: T(h, ot(b.pb)), border_b: T(h, ot(b.border_b)) }), _(D, { h: h.laid - g });
  }
  for (const D of n)
    y(D, {}), A(D);
  return Object.defineProperty(f, "heights", { value: i }), f;
}
const op = (n) => ({ scale: n, heights: /* @__PURE__ */ new WeakMap(), texts: /* @__PURE__ */ new WeakMap(), textKeys: /* @__PURE__ */ new WeakMap(), visits: /* @__PURE__ */ new WeakMap(), places: /* @__PURE__ */ new WeakMap() });
let ms = op(0);
const Bx = { sidebar: [{ name: "sidebar-root", selector: "aside.sidebar" }, { name: "sidebar-content", selector: "aside.sidebar > div:first-child" }, { name: "host-switcher", selector: '[data-testid="host-switcher"]' }, { name: "host-chip", selector: '[data-testid="host-switcher"] > div' }, { name: "host-badge", selector: ".sidebar__env-badge" }, { name: "host-name", selector: ".sidebar__env-host" }, { name: "host-meta", selector: '[data-testid="host-switcher"] > div > div:first-child > span:nth-child(3)' }, { name: "host-line", selector: ".sidebar__env-cwd" }, { name: "host-caret", selector: '[data-testid="host-switcher"] > span[aria-hidden="true"]' }, { name: "new-session-button", selector: 'button[data-testid^="new-session-"]', key: { self: !0, attr: "data-testid", strip: "new-session-" } }, { name: "new-session-icon", selector: 'button[data-testid^="new-session-"] > svg' }, { name: "new-session-label", selector: 'button[data-testid^="new-session-"]', textRange: !0 }, { name: "new-session-shortcut", selector: 'button[data-testid^="new-session-"] > span' }, { name: "overview", selector: '[data-testid="workspace-overview"]' }, { name: "overview-header", selector: '[data-testid="workspace-overview"] > div:first-child' }, { name: "overview-title", selector: '[data-testid="workspace-overview"] > div:first-child > div:first-child > span:first-child' }, { name: "needs-you-button", selector: '[data-testid="workspace-needs-you"]' }, { name: "organize-button", selector: '[data-testid="workspace-organize"]' }, { name: "organize-icon", selector: '[data-testid="workspace-organize"] > svg' }, { name: "add-project-button", selector: '[data-testid="workspace-add-project"]' }, { name: "add-project-icon", selector: '[data-testid="workspace-add-project"] > svg' }, { name: "add-project-label", selector: '[data-testid="workspace-add-project"]', textRange: !0 }, { name: "project-list", selector: '[data-testid="project-list"]' }, { name: "project", selector: ".workspace-project", key: { self: !0, attr: "data-testid", strip: "workspace-project-" } }, { name: "project-header", selector: ".workspace-project > div:first-child", key: { closest: ".workspace-project", attr: "data-testid", strip: "workspace-project-" } }, { name: "project-toggle", selector: '[data-testid^="project-toggle-"]', key: { self: !0, attr: "data-testid", strip: "project-toggle-" } }, { name: "project-chevron", selector: '[data-testid^="project-toggle-"] > svg:not([data-testid])', key: { closest: '[data-testid^="project-toggle-"]', attr: "data-testid", strip: "project-toggle-" } }, { name: "project-folder-icon", selector: '[data-testid="project-folder-icon"]', key: { closest: '[data-testid^="project-toggle-"]', attr: "data-testid", strip: "project-toggle-" } }, { name: "project-name", selector: '[data-testid^="project-toggle-"] strong', key: { closest: '[data-testid^="project-toggle-"]', attr: "data-testid", strip: "project-toggle-" } }, { name: "project-branch", selector: '[data-testid^="project-toggle-"] > span.whitespace-nowrap', key: { closest: '[data-testid^="project-toggle-"]', attr: "data-testid", strip: "project-toggle-" } }, { name: "project-dirty-mark", selector: '[data-testid^="project-toggle-"] > span[title="Uncommitted changes"]', key: { closest: '[data-testid^="project-toggle-"]', attr: "data-testid", strip: "project-toggle-" } }, { name: "project-rollup", selector: '[data-testid^="project-rollup-"]', key: { self: !0, attr: "data-testid", strip: "project-rollup-" } }, { name: "project-rollup-badge", selector: '[data-testid^="project-rollup-"] > span', key: { closest: '[data-testid^="project-rollup-"]', attr: "data-testid", strip: "project-rollup-" } }, { name: "project-menu-button", selector: '[data-testid^="workspace-project-menu-"]', key: { self: !0, attr: "data-testid", strip: "workspace-project-menu-" } }, { name: "project-add-button", selector: ".workspace-project > div:first-child .worktree-menu__btn", key: { closest: ".workspace-project", attr: "data-testid", strip: "workspace-project-" } }, { name: "project-workspaces", selector: ".workspace-project__workspaces", key: { closest: ".workspace-project", attr: "data-testid", strip: "workspace-project-" } }, { name: "workspace", selector: '[data-testid="workspace-tree-root"] [data-testid^="workspace-entry-"]', key: { self: !0, attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-button", selector: '[data-testid="workspace-tree-root"] button.workspace-entry__button', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-icon", selector: '[data-testid="workspace-tree-root"] [data-testid="workspace-checkout-icon"]', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-name", selector: '[data-testid="workspace-tree-root"] strong[title="Double-click to rename"]', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-branch", selector: '[data-testid="workspace-tree-root"] button.workspace-entry__button > span.items-baseline > span', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-dirty-mark", selector: '[data-testid="workspace-tree-root"] button.workspace-entry__button > span[title="Uncommitted changes"]', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-pinned-label", selector: '[data-testid="workspace-tree-root"] button.workspace-entry__button > span.shrink-0:not([title])', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "hidden-worktrees-button", selector: '[data-testid^="workspace-hidden-"]', key: { self: !0, attr: "data-testid", strip: "workspace-hidden-" } }, { name: "session-row", selector: 'div[class~="group/row"]', key: { find: 'button[data-testid^="workspace-session-"]:not([data-testid^="workspace-session-close-"])', attr: "data-testid", strip: "workspace-session-" } }, { name: "session-button", selector: 'button[data-testid^="workspace-session-"]:not([data-testid^="workspace-session-close-"])', key: { self: !0, attr: "data-testid", strip: "workspace-session-" } }, { name: "session-mark", selector: ".agent-mark", key: { closest: 'button[data-testid^="workspace-session-"]', attr: "data-testid", strip: "workspace-session-" } }, { name: "session-mark-icon", selector: ".agent-mark > span > *", key: { closest: 'button[data-testid^="workspace-session-"]', attr: "data-testid", strip: "workspace-session-" } }, { name: "session-title", selector: 'button[data-testid^="workspace-session-"] > span.whitespace-nowrap', key: { closest: 'button[data-testid^="workspace-session-"]', attr: "data-testid", strip: "workspace-session-" } }, { name: "status-row-title", selector: "button[data-session] span.truncate:not([data-testid])", key: { closest: 'button[data-testid^="workspace-session-"]', attr: "data-testid", strip: "workspace-session-" } }, { name: "status-row-detail", selector: '[data-testid="status-row-detail"]', key: { closest: 'button[data-testid^="workspace-session-"]', attr: "data-testid", strip: "workspace-session-" } }, { name: "session-state-badge", selector: '[data-testid^="session-state-"]', key: { self: !0, attr: "data-testid", strip: "session-state-" } }, { name: "session-menu-button", selector: '[data-testid^="session-menu-button-"]', key: { self: !0, attr: "data-testid", strip: "session-menu-button-" } }, { name: "session-fold-button", selector: '[data-testid^="session-fold-"]', key: { self: !0, attr: "data-testid", strip: "session-fold-" } }, { name: "session-elbow", selector: '[data-testid^="session-elbow-"]', key: { self: !0, attr: "data-testid", strip: "session-elbow-" } }, { name: "session-rollup", selector: '[data-testid^="session-rollup-"]', key: { self: !0, attr: "data-testid", strip: "session-rollup-" } }, { name: "chats", selector: '[data-testid="workspace-chats"]' }, { name: "chats-header", selector: '[data-testid="workspace-chats"] > div:first-child' }, { name: "chats-toggle", selector: '[data-testid="workspace-chats-collapse"]' }, { name: "chats-label", selector: '[data-testid="workspace-chats-collapse"]', textRange: !0 }, { name: "chats-chevron", selector: '[data-testid="workspace-chats-collapse"] > svg' }, { name: "chats-menu-button", selector: '[data-testid="workspace-chats-menu"]' }, { name: "chats-new-button", selector: '[data-testid="workspace-chats-new"]' }, { name: "chats-new-icon", selector: '[data-testid="workspace-chats-new"] > svg' }, { name: "status-view", selector: '[data-testid="workspace-status-view"]' }, { name: "status-section", selector: '[data-testid^="status-section-"]:not([data-testid^="status-section-title-"])', key: { self: !0, attr: "data-testid", strip: "status-section-" } }, { name: "status-heading", selector: '[data-testid^="status-section-title-"], [data-testid="status-no-sessions-title"]', key: { self: !0, attr: "data-testid" } }, { name: "status-heading-dot", selector: '[data-testid^="status-section-title-"] > span:first-child, [data-testid="status-no-sessions-title"] > span:first-child', key: { closest: '[data-testid^="status-section-title-"], [data-testid="status-no-sessions-title"]', attr: "data-testid" } }, { name: "status-heading-label", selector: '[data-testid^="status-section-title-"] > span:nth-child(2), [data-testid="status-no-sessions-title"] > span:nth-child(2)', key: { closest: '[data-testid^="status-section-title-"], [data-testid="status-no-sessions-title"]', attr: "data-testid" } }, { name: "status-heading-count", selector: '[data-testid^="status-section-title-"] > span[aria-label], [data-testid="status-no-sessions-title"] > span[aria-label]', key: { closest: '[data-testid^="status-section-title-"], [data-testid="status-no-sessions-title"]', attr: "data-testid" } }, { name: "status-heading-note", selector: '[data-testid^="status-section-title-"] > span.truncate, [data-testid="status-no-sessions-title"] > span.truncate', key: { closest: '[data-testid^="status-section-title-"], [data-testid="status-no-sessions-title"]', attr: "data-testid" } }, { name: "status-project", selector: 'div[data-testid^="status-project-"]', key: { self: !0, attr: "data-testid", strip: "status-project-" } }, { name: "status-project-header", selector: 'div[data-testid^="status-project-"] > div:first-child', key: { closest: 'div[data-testid^="status-project-"]', attr: "data-testid", strip: "status-project-" } }, { name: "status-project-icon", selector: 'div[data-testid^="status-project-"] > div:first-child > svg', key: { closest: 'div[data-testid^="status-project-"]', attr: "data-testid", strip: "status-project-" } }, { name: "status-project-title", selector: '[data-testid="status-project-title"]', key: { closest: 'div[data-testid^="status-project-"]', attr: "data-testid", strip: "status-project-" } }, { name: "status-empty-project", selector: '[data-testid^="status-empty-project-"]', key: { self: !0, attr: "data-testid", strip: "status-empty-project-" } }, { name: "status-empty-project-icon", selector: '[data-testid^="status-empty-project-"] > button:first-child > svg', key: { closest: '[data-testid^="status-empty-project-"]', attr: "data-testid", strip: "status-empty-project-" } }, { name: "status-empty-project-title", selector: '[data-testid^="status-empty-project-"] > button > span.whitespace-nowrap', key: { closest: '[data-testid^="status-empty-project-"]', attr: "data-testid", strip: "status-empty-project-" } }, { name: "settings-bar", selector: "aside.sidebar > div:last-child" }, { name: "settings-gear", selector: '[data-testid="settings-gear"]' }, { name: "settings-gear-icon", selector: '[data-testid="settings-gear"] > svg' }], tabs: [{ name: "tab-strip", selector: '[data-testid="tab-bar"]' }, { name: "tab-slot", selector: "[data-tab-entry]", key: { self: !0, attr: "data-tab-entry" } }, { name: "tab-separator", selector: '[data-testid="tab-separator"]', key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab", selector: "button.tab-bar__tab", key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-icon", selector: 'button.tab-bar__tab > span[aria-hidden="true"]', key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-icon-glyph", selector: 'button.tab-bar__tab > span[aria-hidden="true"] > *', key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-label", selector: "button.tab-bar__tab > span.truncate", key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-dirty", selector: 'button.tab-bar__tab > span[aria-label="unsaved changes"]', key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-close", selector: '[data-tab-entry] > button[aria-label^="Close"]', key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-close-glyph", selector: '[data-tab-entry] > button[aria-label^="Close"] > svg', key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-new", selector: '[data-testid="tab-new"]' }, { name: "tab-new-glyph", selector: '[data-testid="tab-new"] > svg' }], status: [{ name: "status-bar", selector: "footer.status-bar" }, { name: "status-location", selector: ".status-bar__location" }, { name: "status-dot", selector: ".status-bar__location > span:first-child" }, { name: "status-host", selector: '[data-testid="status-host"]' }, { name: "status-cwd", selector: ".status-item--cwd" }, { name: "status-branch", selector: ".status-bar__branch" }, { name: "status-branch-icon", selector: ".status-bar__branch > svg" }, { name: "status-branch-name", selector: ".status-bar__branch > span" }, { name: "status-details", selector: ".status-bar__details" }, { name: "zoom-indicator", selector: '[data-testid="zoom-indicator"]' }, { name: "status-detail", selector: ".status-bar__details > span" }, { name: "status-usage", selector: ".status-bar__usage" }, { name: "usage-summary", selector: '[data-testid="usage-summary"]' }, { name: "usage-unavailable", selector: '[data-testid="usage-summary"] > span:only-child' }, { name: "usage-account", selector: '[data-testid="usage-summary"] > span.flex' }, { name: "usage-account-name", selector: '[data-testid="usage-summary"] > span.flex > span:first-child' }, { name: "usage-window", selector: '[data-testid="usage-summary"] > span.flex > span:not(:first-child)' }, { name: "status-connection", selector: '[data-testid="status-connection"]' }, { name: "status-connection-glyph", selector: '[data-testid="status-connection"] > svg' }], navigator: [{ name: "navigator-scrim", selector: "body > div.fixed.inset-0" }, { name: "navigator-panel", selector: '[data-testid="navigator"]' }, { name: "navigator-input", selector: '[data-testid="navigator-input"]' }, { name: "navigator-chips", selector: '[data-testid="navigator"] > div:nth-child(2)' }, { name: "navigator-chip", selector: '[data-testid^="navigator-filter-"]', key: { self: !0, attr: "data-testid", strip: "navigator-filter-" } }, { name: "navigator-list", selector: '[data-testid="navigator"] > div:nth-child(3)' }, { name: "navigator-notice", selector: '[data-testid="navigator"] > div:nth-child(3) > p[role]' }, { name: "navigator-empty", selector: '[data-testid="navigator"] div.text-center' }, { name: "navigator-command", selector: '[data-testid^="navigator-command-"]', key: { self: !0, attr: "data-testid", strip: "navigator-command-" } }, { name: "navigator-command-title", selector: '[data-testid^="navigator-command-"] > span:first-child', key: { closest: '[data-testid^="navigator-command-"]', attr: "data-testid", strip: "navigator-command-" } }, { name: "navigator-command-detail", selector: '[data-testid^="navigator-command-"] > span:last-child', key: { closest: '[data-testid^="navigator-command-"]', attr: "data-testid", strip: "navigator-command-" } }, { name: "navigator-row", selector: '[data-testid^="navigator-row-"]', key: { self: !0, attr: "data-testid", strip: "navigator-row-" } }, { name: "navigator-row-dot", selector: '[data-testid^="navigator-row-"] > :first-child', key: { closest: '[data-testid^="navigator-row-"]', attr: "data-testid", strip: "navigator-row-" } }, { name: "navigator-row-title", selector: '[data-testid^="navigator-row-"] > span:nth-child(2)', key: { closest: '[data-testid^="navigator-row-"]', attr: "data-testid", strip: "navigator-row-" } }, { name: "navigator-row-detail", selector: '[data-testid^="navigator-row-"] > span:last-child', key: { closest: '[data-testid^="navigator-row-"]', attr: "data-testid", strip: "navigator-row-" } }, { name: "navigator-note", selector: '[data-testid="navigator"] > p:last-child' }], "pane-menu": [{ name: "pane-menu", selector: '[data-testid="pane-context-menu"]' }, { name: "pane-menu-item", selector: '[data-testid="pane-context-menu"] > button', key: { self: !0, attr: "data-testid", strip: "pane-menu-" } }, { name: "pane-menu-divider", selector: '[data-testid="pane-context-menu"] > div.h-px' }, { name: "pane-menu-rename-row", selector: '[data-testid="pane-context-menu"] > div.flex' }, { name: "pane-menu-rename-input", selector: '[data-testid="pane-menu-rename-input"]' }, { name: "pane-menu-rename-confirm", selector: '[data-testid="pane-menu-rename-confirm"]' }], confirm: [{ name: "confirm-scrim", selector: "body > div.fixed.inset-0" }, { name: "confirm-panel", selector: '[data-testid="confirm-dialog"]' }, { name: "confirm-message", selector: ".confirm-dialog__message" }, { name: "confirm-extra", selector: '[data-testid="confirm-dialog"] > :not(.confirm-dialog__message):not(div.flex)' }, { name: "confirm-buttons", selector: '[data-testid="confirm-dialog"] > div.flex' }, { name: "confirm-cancel", selector: '[data-testid="confirm-cancel"]' }, { name: "confirm-accept", selector: '[data-testid="confirm-accept"]' }], dialog: [{ name: "dialog-scrim", selector: "body > div.fixed.inset-0" }, { name: "dialog-panel", selector: '[data-testid="file-name-dialog"]' }, { name: "dialog-title", selector: '[data-testid="file-name-dialog"] > h2' }, { name: "dialog-input", selector: '[data-testid="file-name-input"]' }, { name: "dialog-hint", selector: '[data-testid="file-name-dialog"] > p:not([role])' }, { name: "dialog-error", selector: '[data-testid="file-name-dialog"] > p[role="alert"]' }, { name: "dialog-buttons", selector: '[data-testid="file-name-dialog"] > div.flex' }, { name: "dialog-cancel", selector: '[data-testid="file-name-dialog"] > div.flex > button:first-child' }, { name: "dialog-confirm", selector: '[data-testid="file-name-confirm"]' }], toast: [{ name: "toast-stack", selector: '[data-testid="toast"]' }, { name: "toast-card", selector: '[data-testid="toast"] .animate-toast-in' }, { name: "toast-open", selector: '[data-testid^="toast-"]:not([data-testid^="toast-dismiss-"])' }, { name: "toast-mark", selector: '[data-testid^="toast-"]:not([data-testid^="toast-dismiss-"]) > :first-child' }, { name: "toast-heading", selector: '[data-testid^="toast-"]:not([data-testid^="toast-dismiss-"]) > span.min-w-0 > span:first-child' }, { name: "toast-detail", selector: '[data-testid^="toast-"]:not([data-testid^="toast-dismiss-"]) > span.min-w-0 > span:nth-child(2)' }, { name: "toast-dismiss", selector: '[data-testid^="toast-dismiss-"]' }, { name: "toast-dismiss-glyph", selector: '[data-testid^="toast-dismiss-"] > svg' }], "pane-header": [{ name: "pane-header", selector: '[data-testid^="pane-header-"]', key: { self: !0, attr: "data-testid", strip: "pane-header-" } }, { name: "pane-header-icon", selector: '[data-testid^="pane-header-"] > span.shrink-0:not([data-testid])', key: { closest: '[data-testid^="pane-header-"]', attr: "data-testid", strip: "pane-header-" } }, { name: "pane-header-icon-glyph", selector: '[data-testid^="pane-header-"] > span.shrink-0:not([data-testid]) > *', key: { closest: '[data-testid^="pane-header-"]', attr: "data-testid", strip: "pane-header-" } }, { name: "pane-header-name", selector: '[data-testid^="pane-header-"] > span.truncate', key: { closest: '[data-testid^="pane-header-"]', attr: "data-testid", strip: "pane-header-" } }, { name: "pane-header-state", selector: '[data-testid^="pane-header-"] > span.flex[title]', key: { closest: '[data-testid^="pane-header-"]', attr: "data-testid", strip: "pane-header-" } }, { name: "pane-header-state-dot", selector: '[data-testid^="pane-header-"] > span.flex[title] > span.rounded-full', key: { closest: '[data-testid^="pane-header-"]', attr: "data-testid", strip: "pane-header-" } }, { name: "pane-header-state-word", selector: '[data-testid^="pane-header-"] > span.flex[title] > span.truncate', key: { closest: '[data-testid^="pane-header-"]', attr: "data-testid", strip: "pane-header-" } }, { name: "pane-controls", selector: '[data-testid^="tile-controls-"]', key: { self: !0, attr: "data-testid", strip: "tile-controls-" } }, { name: "pane-expand", selector: '[data-testid^="tile-expand-"]', key: { self: !0, attr: "data-testid", strip: "tile-expand-" } }, { name: "pane-expand-glyph", selector: '[data-testid^="tile-expand-"] > svg', key: { closest: '[data-testid^="tile-expand-"]', attr: "data-testid", strip: "tile-expand-" } }, { name: "pane-close", selector: '[data-testid^="tile-close-"]', key: { self: !0, attr: "data-testid", strip: "tile-close-" } }, { name: "pane-close-glyph", selector: '[data-testid^="tile-close-"] > svg', key: { closest: '[data-testid^="tile-close-"]', attr: "data-testid", strip: "tile-close-" } }, { name: "pane-corner", selector: "div.pointer-events-auto.absolute" }], "new-session": [{ name: "launcher", selector: ".new-session-popover" }, { name: "launcher-filter", selector: '[data-testid="new-tab-filter"]' }, { name: "launcher-list", selector: "#new-tab-launcher-list" }, { name: "launcher-option", selector: '[role="option"]', key: { self: !0, attr: "data-testid" } }, { name: "launcher-option-icon", selector: '[role="option"] > :first-child:not(span.flex-1):not(kbd)', key: { closest: '[role="option"]', attr: "data-testid" } }, { name: "launcher-option-label", selector: '[role="option"] > span.flex-1', key: { closest: '[role="option"]', attr: "data-testid" } }, { name: "launcher-option-key", selector: '[role="option"] > kbd', key: { closest: '[role="option"]', attr: "data-testid" } }, { name: "launcher-note", selector: ".new-session-popover p[role]" }, { name: "agent-select", selector: '[data-testid="new-session-popover-agent"]' }, { name: "agent-manage", selector: ".new-session-popover > div:first-child > button:not([data-testid])" }, { name: "project-option", selector: '[data-testid^="project-option-"]', key: { self: !0, attr: "data-testid", strip: "project-option-" } }, { name: "project-option-name", selector: '[data-testid^="project-option-"]', key: { closest: '[data-testid^="project-option-"]', attr: "data-testid", strip: "project-option-" }, textRange: !0 }, { name: "project-option-path", selector: '[data-testid^="project-option-"] > span', key: { closest: '[data-testid^="project-option-"]', attr: "data-testid", strip: "project-option-" } }], "tab-menu": [{ name: "tab-menu", selector: '[data-testid="tab-split-menu"]' }, { name: "tab-menu-item", selector: '[data-testid="tab-split-menu"] > button', key: { self: !0, attr: "data-testid" } }, { name: "tab-menu-show-beside", selector: '[data-testid="tab-menu-show-beside"]' }, { name: "tab-menu-beside-list", selector: '[data-testid="tab-split-menu"] [role="menu"]' }, { name: "tab-menu-beside-item", selector: '[data-testid="tab-split-menu"] [role="menu"] > button', key: { self: !0, attr: "data-testid" } }, { name: "tab-menu-item-label", selector: '[data-testid="tab-split-menu"] [role="menu"] > button > span.block', key: { closest: '[data-testid="tab-split-menu"] [role="menu"] > button', attr: "data-testid" } }, { name: "tab-menu-empty", selector: '[data-testid="tab-menu-empty"]' }, { name: "tab-menu-divider", selector: '[data-testid="tab-split-menu"] > div.h-px' }, { name: "tab-menu-rename-form", selector: '[data-testid="tab-split-menu"] > form' }, { name: "tab-menu-rename-input", selector: '[data-testid="tab-menu-rename-input"]' }, { name: "tab-menu-rename-save", selector: '[data-testid="tab-split-menu"] > form > button' }], select: [{ name: "select-field", selector: '[data-testid="select-demo"]' }, { name: "select-field-label", selector: '[data-testid="select-demo"] > span.truncate' }, { name: "select-chevron", selector: '[data-testid="select-demo"] > svg' }, { name: "select-list", selector: '[role="listbox"]' }, { name: "select-option", selector: '[role="listbox"] > [role="option"]', key: { self: !0, attr: "data-value" } }, { name: "select-option-label", selector: '[role="listbox"] > [role="option"] > span.truncate', key: { closest: '[role="option"]', attr: "data-value" } }, { name: "select-option-check", selector: '[role="listbox"] > [role="option"] > span[aria-hidden]', key: { closest: '[role="option"]', attr: "data-value" } }], "keybind-help": [{ name: "keybind-help-scrim", selector: "body > div.fixed.inset-0" }, { name: "keybind-help-panel", selector: '[data-testid="keybind-help"]' }, { name: "keybind-help-header", selector: '[data-testid="keybind-help"] > div:first-child' }, { name: "keybind-help-title", selector: '[data-testid="keybind-help"] h2' }, { name: "keybind-help-close", selector: '[aria-label="Close keybind help"]' }, { name: "keybind-help-close-glyph", selector: '[aria-label="Close keybind help"] > svg' }, { name: "keybind-help-search", selector: '[data-testid="keybind-help-search"]' }, { name: "keybind-help-list", selector: '[data-testid="keybind-help"] > div:last-child' }, { name: "keybind-help-empty", selector: '[data-testid="keybind-help"] div.text-center' }, { name: "keybind-help-group", selector: '[data-testid="keybind-help"] section' }, { name: "keybind-help-group-title", selector: '[data-testid="keybind-help"] section > h3' }, { name: "keybind-help-row", selector: '[data-testid="keybind-help"] li' }, { name: "keybind-help-keys", selector: '[data-testid="keybind-help"] li > kbd' }, { name: "keybind-help-description", selector: '[data-testid="keybind-help"] li > span' }], launcher: [{ name: "launcher-scrim", selector: "body > div.fixed.inset-0" }, { name: "launcher-panel", selector: '[data-testid="new-session-dialog"]' }, { name: "launcher-title", selector: '[data-testid="new-session-dialog"] > p' }, { name: "launcher-filter", selector: '[data-testid="new-session-filter"]' }, { name: "launcher-list", selector: "#new-session-list" }, { name: "launcher-row", selector: '[data-testid^="new-session-row-"]', key: { self: !0, attr: "data-testid", strip: "new-session-row-" } }, { name: "launcher-row-icon", selector: '[data-testid^="new-session-row-"] > :first-child:not(span):not(kbd)', key: { closest: '[data-testid^="new-session-row-"]', attr: "data-testid", strip: "new-session-row-" } }, { name: "launcher-row-label", selector: '[data-testid^="new-session-row-"] > span.shrink-0', key: { closest: '[data-testid^="new-session-row-"]', attr: "data-testid", strip: "new-session-row-" } }, { name: "launcher-row-detail", selector: '[data-testid^="new-session-row-"] > span.ml-auto', key: { closest: '[data-testid^="new-session-row-"]', attr: "data-testid", strip: "new-session-row-" } }, { name: "launcher-row-key", selector: '[data-testid^="new-session-row-"] > kbd', key: { closest: '[data-testid^="new-session-row-"]', attr: "data-testid", strip: "new-session-row-" } }, { name: "launcher-note", selector: "#new-session-list > p" }], "session-menu": [{ name: "tab-menu", selector: '[data-testid="tab-split-menu"]' }, { name: "tab-menu-item", selector: '[data-testid="tab-split-menu"] > button', key: { self: !0, attr: "data-testid" } }, { name: "tab-menu-show-beside", selector: '[data-testid="tab-menu-show-beside"]' }, { name: "tab-menu-beside-list", selector: '[data-testid="tab-split-menu"] [role="menu"]' }, { name: "tab-menu-beside-item", selector: '[data-testid="tab-split-menu"] [role="menu"] > button', key: { self: !0, attr: "data-testid" } }, { name: "tab-menu-item-label", selector: '[data-testid="tab-split-menu"] [role="menu"] > button > span.block', key: { closest: '[data-testid="tab-split-menu"] [role="menu"] > button', attr: "data-testid" } }, { name: "tab-menu-empty", selector: '[data-testid="tab-menu-empty"]' }, { name: "tab-menu-divider", selector: '[data-testid="tab-split-menu"] > div.h-px' }], "tab-drag": [{ name: "tab-drag-layer", selector: '[data-testid="tab-drag-layer"]' }, { name: "tab-drag-pane", selector: '[data-testid="tab-drag-layer"] > div.bg-surface-1\\/30' }, { name: "tab-drop-zone", selector: '[data-testid="tab-drop-zone"]', key: { self: !0, attr: "data-zone" } }, { name: "tab-drop-label", selector: '[data-testid="tab-drop-zone"] > span' }, { name: "tab-drag-ghost", selector: '[data-testid="tab-drag-ghost"]' }], start: [{ name: "start-panel", selector: '[data-testid="no-session-panel"], [data-testid="cli-start-panel"]' }, { name: "start-column", selector: '[data-testid$="-panel"] > div' }, { name: "start-logo", selector: '[data-testid="no-session-panel"] img' }, { name: "start-name", selector: '[data-testid$="-panel"] h1, [data-testid="no-session-panel"] h1, [data-testid="no-session-panel"] h2' }, { name: "start-hint", selector: '[data-testid$="-panel"] p' }, { name: "start-target", selector: '[data-testid="workspace-start-target"], [data-testid="cli-start-target"]' }, { name: "start-action", selector: '[data-testid="home-add-project"], [data-testid="no-session-create"], [data-testid^="workspace-start-"]:not([data-testid="workspace-start-target"]), [data-testid^="cli-start-agent-"]', key: { self: !0, attr: "data-testid" } }, { name: "start-status", selector: '[role="status"], [role="alert"]' }, { name: "start-status-action", selector: '[role="status"] > button, [role="alert"] > button' }, { name: "start-link", selector: '[data-testid$="-panel"] button.text-subtext-0' }, { name: "start-shortcut-row", selector: '[data-testid="no-session-panel"] dl > div' }, { name: "start-shortcut-label", selector: '[data-testid="no-session-panel"] dl dt' }, { name: "start-shortcut-key", selector: '[data-testid="no-session-panel"] dl kbd' }], "folder-browser": [{ name: "folder-browser", selector: '[data-testid="dir-browser"]' }, { name: "folder-browser-mode-toggle", selector: '[data-testid="dir-browser-mode-toggle"]' }, { name: "folder-browser-up", selector: '[data-testid="dir-browser-up"]' }, { name: "folder-browser-crumbs", selector: '[data-testid="dir-browser"] span.min-w-0.flex-1' }, { name: "folder-browser-crumb", selector: '[data-testid="dir-browser"] span.min-w-0.flex-1 button' }, { name: "folder-browser-filter", selector: '[data-testid="dir-browser-filter"]' }, { name: "folder-browser-list", selector: '[data-testid="dir-browser"] div.overflow-y-auto' }, { name: "folder-browser-entry", selector: '[data-testid^="dir-browser-entry-"]', key: { self: !0, attr: "data-testid", strip: "dir-browser-entry-" } }, { name: "folder-browser-entry-name", selector: '[data-testid^="dir-browser-entry-"] > span:first-child', key: { closest: '[data-testid^="dir-browser-entry-"]', attr: "data-testid", strip: "dir-browser-entry-" } }, { name: "folder-browser-git", selector: '[data-testid^="dir-browser-entry-"] > span:last-child:not(:first-child)', key: { closest: '[data-testid^="dir-browser-entry-"]', attr: "data-testid", strip: "dir-browser-entry-" } }, { name: "folder-browser-note", selector: '[data-testid="dir-browser"] div.overflow-y-auto > div' }, { name: "folder-browser-use", selector: '[data-testid="dir-browser-use"]' }, { name: "folder-browser-path-input", selector: '[data-testid="project-path-input"]' }], instructions: [{ name: "instructions-scrim", selector: "body > div.fixed.inset-0" }, { name: "instructions-panel", selector: '[data-testid="instructions-dialog"]' }, { name: "instructions-title", selector: '[data-testid="instructions-dialog"] > h2' }, { name: "instructions-intro", selector: '[data-testid="instructions-dialog"] > p' }, { name: "instructions-label", selector: '[data-testid="instructions-dialog"] > label > span:first-child' }, { name: "instructions-count", selector: '[data-testid="instructions-count"]' }, { name: "instructions-text", selector: '[data-testid="instructions-text"]' }, { name: "instructions-folders", selector: '[data-testid="instructions-folders"]' }, { name: "instructions-error", selector: '[data-testid="instructions-error"]' }, { name: "instructions-cancel", selector: '[data-testid="instructions-dialog"] > div.flex.justify-end > button:first-child' }, { name: "instructions-save", selector: '[data-testid="instructions-save"]' }], memory: [{ name: "memory-scrim", selector: "body > div.fixed.inset-0", key: { self: !0, attr: "data-testid" } }, { name: "memory-panel", selector: '[data-testid="memory-dialog"]' }, { name: "memory-title", selector: '[data-testid="memory-dialog"] > h2' }, { name: "memory-intro", selector: '[data-testid="memory-dialog"] > p' }, { name: "memory-caps", selector: '[data-testid="memory-caps"]' }, { name: "memory-new", selector: '[data-testid="memory-new"]' }, { name: "memory-enabled", selector: '[data-testid="memory-enabled"]' }, { name: "memory-enabled-label", selector: '[data-testid="memory-dialog"] > label.flex > span' }, { name: "memory-note", selector: '[data-testid="memory-dialog"] > span.text-subtext-0' }, { name: "memory-row", selector: '[data-testid^="memory-row-"]', key: { self: !0, attr: "data-testid", strip: "memory-row-" } }, { name: "memory-open", selector: '[data-testid^="memory-open-"]', key: { self: !0, attr: "data-testid", strip: "memory-open-" } }, { name: "memory-file-title", selector: '[data-testid^="memory-row-"] button > span:first-child', key: { closest: '[data-testid^="memory-row-"]', attr: "data-testid", strip: "memory-row-" } }, { name: "memory-file-summary", selector: '[data-testid^="memory-row-"] button > span.truncate', key: { closest: '[data-testid^="memory-row-"]', attr: "data-testid", strip: "memory-row-" } }, { name: "memory-file-meta", selector: '[data-testid^="memory-row-"] button > span:last-child', key: { closest: '[data-testid^="memory-row-"]', attr: "data-testid", strip: "memory-row-" } }, { name: "memory-delete", selector: '[data-testid^="memory-delete-"]', key: { self: !0, attr: "data-testid", strip: "memory-delete-" } }, { name: "memory-error", selector: '[data-testid="memory-error"]' }, { name: "memory-close", selector: '[data-testid="memory-dialog"] > div.flex.justify-end > button' }, { name: "memory-file-name", selector: '[data-testid="memory-file-name"]' }, { name: "memory-name", selector: '[data-testid="memory-name"]' }, { name: "memory-count", selector: '[data-testid="memory-count"]' }, { name: "memory-text", selector: '[data-testid="memory-text"]' }, { name: "memory-conflict", selector: '[data-testid="memory-conflict"]' }, { name: "memory-reload", selector: '[data-testid="memory-reload"]' }, { name: "memory-back", selector: '[data-testid="memory-back"]' }, { name: "memory-save", selector: '[data-testid="memory-save"]' }, { name: "memory-confirm", selector: '[data-testid="confirm-dialog"]' }, { name: "memory-confirm-message", selector: ".confirm-dialog__message" }], worktree: [{ name: "worktree-plus", selector: '[data-testid^="worktree-menu-"]' }, { name: "worktree-popover", selector: '[role="dialog"][aria-label="Git worktrees"]' }, { name: "worktree-heading", selector: '[role="dialog"][aria-label="Git worktrees"] > div:first-child > span:first-child' }, { name: "worktree-project", selector: '[role="dialog"][aria-label="Git worktrees"] > div:first-child > span:last-child' }, { name: "worktree-list", selector: '[role="dialog"][aria-label="Git worktrees"] > div.overflow-y-auto' }, { name: "worktree-note", selector: '[role="dialog"][aria-label="Git worktrees"] > div.overflow-y-auto > div:not(.worktree-menu__entry)' }, { name: "worktree-entry", selector: '[data-testid^="worktree-entry-"]', key: { self: !0, attr: "data-testid", strip: "worktree-entry-" } }, { name: "worktree-entry-branch", selector: ".worktree-menu__entry-branch", key: { closest: '[data-testid^="worktree-entry-"]', attr: "data-testid", strip: "worktree-entry-" } }, { name: "worktree-badge", selector: '[data-testid^="worktree-entry-"] .worktree-menu__entry-branch > span', key: { closest: '[data-testid^="worktree-entry-"]', attr: "data-testid", strip: "worktree-entry-" } }, { name: "worktree-entry-path", selector: ".worktree-menu__entry-path", key: { closest: '[data-testid^="worktree-entry-"]', attr: "data-testid", strip: "worktree-entry-" } }, { name: "worktree-open", selector: '[data-testid^="worktree-open-"]', key: { self: !0, attr: "data-testid", strip: "worktree-open-" } }, { name: "worktree-remove", selector: '[data-testid^="worktree-remove-"]', key: { self: !0, attr: "data-testid", strip: "worktree-remove-" } }, { name: "worktree-error", selector: '[data-testid="worktree-error"]' }, { name: "worktree-new", selector: '[data-testid="worktree-new"]' }, { name: "worktree-name-input", selector: '[data-testid="worktree-name-input"]' }, { name: "worktree-start-input", selector: '[data-testid="worktree-start-input"]' }, { name: "worktree-branch-input", selector: '[data-testid="worktree-branch-input"]' }, { name: "worktree-parent-select", selector: '[data-testid="worktree-parent-select"]' }, { name: "worktree-new-branch", selector: '[data-testid="worktree-new-branch"]' }, { name: "worktree-path-input", selector: '[data-testid="worktree-path-input"]' }, { name: "worktree-agent-select", selector: '[data-testid="worktree-agent-select"]' }, { name: "worktree-create-cancel", selector: '[data-testid="worktree-create-cancel"]' }, { name: "worktree-create-submit", selector: '[data-testid="worktree-create-submit"]' }, { name: "worktree-confirm", selector: '[data-testid="confirm-dialog"]' }, { name: "worktree-confirm-message", selector: ".confirm-dialog__message" }, { name: "worktree-confirm-accept", selector: '[data-testid="confirm-accept"]' }, { name: "worktree-confirm-cancel", selector: '[data-testid="confirm-cancel"]' }], "terminal-search": [{ name: "terminal-frame", selector: '[data-testid="persistent-agent-terminal"]' }, { name: "term-search", selector: '[data-testid="term-search"]' }, { name: "term-search-input", selector: '[data-testid="term-search-input"]' }, { name: "term-search-button", selector: '[data-testid="term-search"] > button', key: { self: !0, attr: "title" } }], "agent-control": [{ name: "terminal-frame", selector: '[data-testid="persistent-agent-terminal"]' }, { name: "agent-control-chip", selector: '[data-testid="agent-control-chip"]' }, { name: "agent-control-label", selector: '[data-testid="agent-control-chip"] > span' }, { name: "agent-control-button", selector: '[data-testid="agent-control-chip"] > button' }, { name: "agent-control-error", selector: ".terminal__cli-error" }, { name: "agent-control-ended", selector: ".terminal__exited", key: { self: !0, attr: "data-testid" } }, { name: "agent-control-ended-text", selector: ".terminal__exited-text" }, { name: "agent-control-ended-button", selector: ".terminal__exited-actions > button", key: { self: !0, attr: "data-testid" } }], "phone-size": [{ name: "terminal-frame", selector: '[data-testid="persistent-agent-terminal"]' }, { name: "phone-size-notice", selector: '[data-testid="phone-size-notice"]' }, { name: "phone-size-chip", selector: '[data-testid="phone-size-chip"]' }, { name: "phone-size-heading", selector: '[data-testid="phone-size-notice"] span.font-semibold' }, { name: "phone-size-text", selector: '[data-testid="phone-size-notice"] span:not(.font-semibold)' }, { name: "phone-size-fold", selector: '[aria-label="Keep phone size and hide this"]' }, { name: "phone-size-button", selector: '[data-testid="phone-size-notice"] div.flex.flex-wrap > button, [data-testid="phone-size-chip"] > button' }], window: [{ name: "sidebar-card", selector: '[data-testid="sidebar-card"]' }, { name: "main-card", selector: '[data-testid="main-card"]' }, { name: "tools-card", selector: '[data-testid="tools-card"]' }, { name: "sidebar-toggle", selector: '[data-testid="sidebar-collapse-toggle"]' }, { name: "drawer-toggle", selector: '[data-testid="workspace-tools-toggle"]' }, { name: "resize-sidebar", selector: '[data-testid="resize-sidebar"]' }, { name: "resize-tools", selector: '[data-testid="resize-tools"]' }, { name: "tools-tab", selector: 'nav[aria-label="Files, Git and Browser"] > button' }, { name: "status-bar", selector: "footer.status-bar" }], settings: [{ name: "settings-modal", selector: '[data-testid="settings-modal"]' }, { name: "settings-nav-card", selector: '[data-testid="settings-modal"] > nav' }, { name: "settings-close", selector: '[data-testid="settings-close"]' }, { name: "settings-nav", selector: 'nav [data-testid^="settings-nav-"]', key: { self: !0, attr: "data-testid", strip: "settings-nav-" } }, { name: "settings-main-card", selector: '[data-testid="settings-modal"] > main' }, { name: "settings-search", selector: '[data-testid="settings-search"]' }, { name: "settings-title", selector: '[data-testid="settings-modal"] > main h1' }, { name: "settings-body", selector: '[data-testid="settings-modal"] .settings-modal__body' }, { name: "settings-group-title", selector: '[data-testid="settings-modal"] > main h3' }, { name: "settings-group-card", selector: '[data-testid="settings-modal"] > main section > div.rounded-ui' }, { name: "settings-row", selector: '[data-testid="settings-modal"] [data-setting-row]' }, { name: "settings-row-title", selector: '[data-testid="settings-modal"] [data-setting-row] > div:first-child > div:first-child' }, { name: "settings-row-description", selector: '[data-testid="settings-modal"] [data-setting-row] > div:first-child > div:nth-child(2)' }, { name: "settings-result-title", selector: '[data-testid^="settings-result-"] > h2' }], files: [{ name: "files-explorer", selector: '[data-testid="workspace-files-view"]' }, { name: "files-tree", selector: '[data-testid="workspace-file-tree-scroll"]' }, { name: "files-entry", selector: '[data-testid^="workspace-file-entry-"]', key: { self: !0, attr: "data-testid", strip: "workspace-file-entry-" } }, { name: "files-entry-icon", selector: '[data-testid^="workspace-file-entry-"] > svg[data-file-icon]', key: { closest: '[data-testid^="workspace-file-entry-"]', attr: "data-testid", strip: "workspace-file-entry-" } }, { name: "files-entry-name", selector: '[data-testid^="workspace-file-entry-"] > span.flex-1', key: { closest: '[data-testid^="workspace-file-entry-"]', attr: "data-testid", strip: "workspace-file-entry-" } }, { name: "files-pane", selector: '[data-testid="workspace-file-pane"]' }, { name: "files-file-title", selector: ".workspace-files__file-title > span:first-child" }, { name: "files-dirty", selector: '.workspace-files__file-title > span[title="Unsaved changes"]' }, { name: "files-save", selector: ".workspace-files__save" }, { name: "files-markdown-view", selector: '[aria-label="Markdown view"]' }, { name: "files-markdown-preview-button", selector: '[aria-label="Markdown view"] > button:last-child' }, { name: "files-markdown-preview", selector: '[data-testid="workspace-markdown-preview"]' }, { name: "files-conflict", selector: '[data-testid="workspace-file-conflict"]' }, { name: "files-conflict-title", selector: '[data-testid="workspace-file-conflict"] > strong' }, { name: "files-conflict-action", selector: '[data-testid="workspace-file-conflict"] button' }, { name: "files-editor", selector: '[data-testid="workspace-file-editor-area"]' }, { name: "editor-text", selector: '[data-testid="workspace-file-editor-area"] .cm-scroller' }, { name: "files-asset", selector: '[data-testid="workspace-file-asset"]' }, { name: "files-asset-header", selector: '[data-testid="workspace-file-asset"] > header' }, { name: "files-asset-title", selector: '[data-testid="workspace-file-asset"] > header > strong' }, { name: "files-image-viewer", selector: '[data-testid="workspace-image-viewer"]' }, { name: "files-image-toolbar", selector: '[data-testid="workspace-image-viewer"] > [role="toolbar"]' }, { name: "files-image-status", selector: '[data-testid="workspace-image-info"]' }] };
export {
  Bx as NAMED_ELEMENTS,
  F0 as React,
  Og as SCHEMA,
  Dx as STYLE_KEYS,
  Hx as describeToGpui,
  Ax as jsxRuntime,
  jx as mount,
  Ox as reactDom,
  Rx as sdk
};
