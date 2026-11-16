function gs(n, l) {
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
class ae extends Error {
}
const Zh = /* @__PURE__ */ new Set(["hover", "focus", "focus-visible", "focus-within", "active", "disabled", "enabled", "checked"]), Jh = /* @__PURE__ */ new Set(["not", "is", "where", "has", "nth-child"]), Wh = /* @__PURE__ */ new Set(["first-child", "last-child", "only-child", "root", ...Zh]);
function $o(n) {
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
  if (i === l) throw new ae(`expected a name at ${l} in ${JSON.stringify(n)}`);
  return [$o(n.slice(l, i)), i];
}
function Fh(n, l) {
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
  throw new ae(`unbalanced parenthesis in ${JSON.stringify(n)}`);
}
function bs(n) {
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
function Ih(n, l) {
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
      if (d < 0) throw new ae(`unclosed [ in ${JSON.stringify(n)}`);
      const m = n.slice(l + 1, d).trim(), f = /^([^\s~^$*|=]+)\s*(?:([~^$*|]?=)\s*(?:"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'|([^\s"'\]]+)))?\s*(i)?$/.exec(m);
      if (!f) throw new ae(`cannot read the attribute selector [${m}]`);
      const p = f[3] ?? f[4] ?? f[5];
      i.attrs.push({ name: $o(f[1]).toLowerCase(), op: f[2] ?? null, value: p === void 0 ? null : $o(p) }), l = d + 1, o = !0;
      continue;
    }
    if (s === ":") {
      if (n[l + 1] === ":") {
        const [p, y] = bl(n, l + 2), E = p.toLowerCase();
        if (E !== "before" && E !== "after") throw new ae(`::${E} is not supported`);
        if (i.pseudoElement = E, l = y, o = !0, l < n.length && !/[\s>]/.test(n[l])) throw new ae(`nothing may follow ::${E} in ${JSON.stringify(n)}`);
        break;
      }
      const [d, m] = bl(n, l + 1);
      l = m;
      const f = d.toLowerCase();
      if ((f === "before" || f === "after") && n[l] !== "(") {
        if (i.pseudoElement = f, o = !0, l < n.length && !/[\s>]/.test(n[l])) throw new ae(`nothing may follow :${f} in ${JSON.stringify(n)}`);
        break;
      }
      if (n[l] === "(") {
        if (!Jh.has(f)) throw new ae(`:${f}() is not supported`);
        const p = Fh(n, l + 1), y = n.slice(l + 1, p).trim();
        if (l = p + 1, f === "nth-child") {
          if (!/^\d+$/.test(y)) throw new ae(`:nth-child(${y}) is not supported (only a number)`);
          i.pseudos.push({ name: f, n: Number(y) });
        } else {
          const E = bs(y).map(vs);
          if (f === "has" && E.some((w) => w.length !== 1)) throw new ae(`:has(${y}) is not supported (only a compound selector)`);
          i.pseudos.push({ name: f, list: E });
        }
      } else {
        if (!Wh.has(f)) throw new ae(`:${f} is not supported`);
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
  if (!o) throw new ae(`empty compound selector at ${l} in ${JSON.stringify(n)}`);
  return [i, l];
}
function vs(n) {
  const l = [];
  let i = 0, o = null;
  for (n = n.trim(); i < n.length; ) {
    const [s, d] = Ih(n, i);
    if (l.at(-1)?.compound.pseudoElement) throw new ae(`::${l.at(-1).compound.pseudoElement} must end ${JSON.stringify(n)}`);
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
      if (f === "+" || f === "~") throw new ae(`the ${f} combinator is not supported`);
      if (m) o = " ";
      else throw new ae(`unexpected ${JSON.stringify(f)} in ${JSON.stringify(n)}`);
    }
  }
  if (!l.length) throw new ae("empty selector");
  return l;
}
const zd = /* @__PURE__ */ new Map();
function $r(n) {
  let l = zd.get(n);
  return l || (l = bs(n).map(vs), zd.set(n, l)), l;
}
function yf(n) {
  const l = [0, 0, 0], i = (o) => {
    l[0] += o[0], l[1] += o[1], l[2] += o[2];
  };
  for (const { compound: o } of n) {
    o.id && l[0]++, l[1] += o.classes.length + o.attrs.length, o.tag && o.tag !== "*" && l[2]++, o.pseudoElement && l[2]++;
    for (const s of o.pseudos)
      if (s.name !== "where")
        if (s.list) {
          const d = s.list.map(yf).sort((m, f) => f[0] - m[0] || f[1] - m[1] || f[2] - m[2])[0];
          i(d);
        } else l[1]++;
  }
  return l;
}
function $h(n, { name: l, op: i, value: o }) {
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
function Nr(n) {
  return n.parentElement ? n.parentElement.children : [n];
}
function xf(n, l) {
  for (const i of n.children) if (l(i) || xf(i, l)) return !0;
  return !1;
}
function wf(n, l, i, o) {
  if ((l.pseudoElement ?? null) !== (o ? i.pseudo ?? null : null) || l.tag && l.tag !== "*" && n.tagName !== l.tag || l.id && n.getAttribute("id") !== l.id) return !1;
  if (l.classes.length) {
    const s = n.classSet ?? new Set(n.classList ?? []);
    for (const d of l.classes) if (!s.has(d)) return !1;
  }
  for (const s of l.attrs) if (!$h(n, s)) return !1;
  for (const s of l.pseudos)
    switch (s.name) {
      case "first-child":
        if (Nr(n)[0] !== n) return !1;
        break;
      case "only-child":
        if (Nr(n).length !== 1) return !1;
        break;
      case "last-child": {
        const d = Nr(n);
        if (d[d.length - 1] !== n) return !1;
        break;
      }
      case "nth-child":
        if (Nr(n).indexOf(n) !== s.n - 1) return !1;
        break;
      case "root":
        if (!n.isDocumentRoot) return !1;
        break;
      case "not":
        if (s.list.some((d) => qa(n, d, i, o))) return !1;
        break;
      case "has":
        if (n.watchesDescendants = !0, !s.list.some(([{ compound: d }]) => xf(n, (m) => wf(m, d, i, !1)))) return !1;
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
    if (!wf(d, p, i, f)) return !1;
    if (m === 0) return !0;
    if (y === ">") return !!d.parentElement && s(d.parentElement, m - 1, !1);
    for (let E = d.parentElement; E; E = E.parentElement) if (s(E, m - 1, !1)) return !0;
    return !1;
  };
  return s(n, l.length - 1, o);
}
function Ph(n, l, i = {}) {
  return (typeof l == "string" ? $r(l) : l).some((s) => qa(n, s, i));
}
function Po(n, l, i = {}) {
  return qa(n, l, i);
}
function kl(n, l, i = {}) {
  const o = $r(l), s = [], d = (m) => {
    for (const f of m.children)
      o.some((p) => qa(f, p, i)) && s.push(f), d(f);
  };
  return d(n), s;
}
function _f(n, l, i = {}) {
  const o = $r(l);
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
let t0 = 1;
class ts {
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
class ys {
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
let e0 = 0;
const es = () => ++e0;
class Pr {
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
class Vt extends ys {
  constructor(l, i = {}, o = null) {
    super(), this.nodeType = 1, this.id = `n${t0++}`, this.tagName = l.toLowerCase(), this.props = i, this.childNodes = [], this.parentNode = null, this.ownerDocument = o, this.hidden = !1, this.state = { hover: !1, focus: !1, active: !1 }, this.bounds = null, this.version = 0, this.attrStamp = 0, this.stamp = 0;
  }
  /** Its props, attributes or state changed. */
  touch() {
    this.version++, this.attrStamp = es(), this.mark();
  }
  /** Its subtree changed: it and its ancestors are described again (their styles are kept unless they changed). */
  mark() {
    const l = es();
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
    return Ph(this, l);
  }
  closest(l) {
    return _f(this, l);
  }
  querySelectorAll(l) {
    return kl(this, l);
  }
  querySelector(l) {
    return kl(this, l)[0] ?? null;
  }
  /** Where the engine last laid this element out (`HostDocument.measure`); else, before its first layout, a box the
   * engine reported another way (the direct children of a scroll area, a pressed element); else a zero box. */
  getBoundingClientRect() {
    const l = this.ownerDocument?.measure?.(this) ?? this.ownerDocument?.itemBounds?.(this.id) ?? this.bounds;
    return l ? new ts(l.x, l.y, l.width, l.height) : new ts();
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
    return Nd(this);
  }
  /** `outerHTML` without the attributes named in `omit` (by their DOM names), as the web's drag strips its copy. */
  copyMarkup(l = []) {
    return Nd(this, l);
  }
}
const Sf = Symbol("perch.stale-layout"), kf = 3;
let Br = !1;
function Ef(n) {
  return () => {
    let l, i = !1;
    const o = (s) => {
      const d = Br;
      Br = s < kf;
      try {
        l = n();
      } catch (m) {
        const f = m?.[Sf];
        if (!f) throw m;
        f.retries.push(() => {
          i || o(s + 1);
        });
      } finally {
        Br = d;
      }
    };
    return o(0), () => {
      i = !0, typeof l == "function" && l();
    };
  };
}
const ns = "perch-dom:", n0 = /* @__PURE__ */ new Set(["children", "key", "ref", "dangerouslySetInnerHTML"]), a0 = { class: "className", for: "htmlFor", tabindex: "tabIndex" };
function Nd(n, l = []) {
  const i = new Set(l.map((s) => a0[s] ?? s)), o = (s) => {
    if (!(s instanceof Vt)) return { x: s.data, ...s.hidden ? { h: 1 } : {} };
    const d = {};
    for (const [m, f] of Object.entries(s.props))
      n0.has(m) || i.has(m) || f == null || typeof f == "function" || typeof f == "symbol" || (d[m] = f);
    return { t: s.tagName, p: d, c: s.childNodes.map(o), ...s.hidden ? { h: 1 } : {} };
  };
  return ns + JSON.stringify(o(n));
}
function l0(n, l) {
  if (typeof n != "string" || !n.startsWith(ns)) return null;
  let i;
  try {
    i = JSON.parse(n.slice(ns.length));
  } catch {
    return null;
  }
  const o = (d) => !!d && typeof d == "object" && !Array.isArray(d), s = (d) => {
    if (!o(d)) throw new Error("not a node");
    let m;
    if (typeof d.x == "string") m = new Pr(d.x);
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
class r0 {
  observe() {
  }
  unobserve() {
  }
  disconnect() {
  }
}
class i0 {
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
function Td(n) {
  for (let l = n; l instanceof Vt; l = l.parentElement) l.touch();
}
class o0 extends ys {
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
    if (Br && (!o || this.stale?.())) throw { [Sf]: this };
    return o ?? null;
  }
  /** An element's `style` was written: the tree is described again once the writing script is done. */
  restyled() {
    this.restyling || (this.restyling = !0, queueMicrotask(() => {
      this.restyling = !1, this.afterCommit?.();
    }));
  }
  focus(l) {
    this.activeElement && this.activeElement !== l && this.blur(this.activeElement), this.activeElement = l, l.state.focus = !0, l.state.pointerFocus = !1, Td(l), this.perch?.focused?.(l);
  }
  blur(l) {
    l.state.focus = !1, Td(l), this.activeElement === l && (this.activeElement = this.body);
  }
  querySelectorAll(l) {
    return kl(this.documentElement, l);
  }
  querySelector(l) {
    return this.querySelectorAll(l)[0] ?? null;
  }
  /** The element whose `id` prop is `id` (React's `useId` ids are not selectors). */
  getElementById(l) {
    return kl(this.documentElement, "*").find((i) => i.props?.id === l) ?? null;
  }
}
class s0 extends ys {
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
function zf(n) {
  return {
    setTimeout: (l, i = 0, ...o) => n.setTimeout(() => l(...o), Math.max(0, Number(i) || 0)),
    clearTimeout: (l) => {
      l != null && n.clearTimeout(l);
    }
  };
}
const Cd = Symbol.for("perch.react.globals");
function Ze(n, l, i) {
  Object.defineProperty(n, l, { value: i, configurable: !0, writable: !0, enumerable: !1 });
}
function c0(n, l = globalThis) {
  const i = new o0(n), o = new s0(n, i);
  i.defaultView = o;
  const s = n.storage ?? new i0();
  if (typeof l.setTimeout != "function") {
    if (typeof n.setTimeout != "function") throw new Error("the engine has no setTimeout and the perch host gives none (perch.setTimeout)");
    const f = zf(n);
    Ze(l, "setTimeout", f.setTimeout), Ze(l, "clearTimeout", f.clearTimeout);
  }
  typeof l.queueMicrotask != "function" && Ze(l, "queueMicrotask", (f) => {
    Promise.resolve().then(f);
  }), Ze(l, "requestAnimationFrame", (f) => l.setTimeout(() => f(Date.now()), 0)), Ze(l, "cancelAnimationFrame", (f) => l.clearTimeout(f));
  const d = { document: i, window: o, localStorage: s, HTMLElement: Vt, Element: Vt };
  for (const f of Object.keys(d))
    Object.defineProperty(l, f, { get: () => l[Cd]?.[f], configurable: !0, enumerable: !1 });
  l[Cd] = d, Ze(l, "DOMRect", ts), Ze(l, "getComputedStyle", u0), typeof l.ResizeObserver != "function" && Ze(l, "ResizeObserver", r0);
  const m = l.navigator && typeof l.navigator == "object" ? l.navigator : {};
  if (!m.clipboard && n.clipboard)
    try {
      Ze(m, "clipboard", n.clipboard);
    } catch {
    }
  return l.navigator || Ze(l, "navigator", m), { document: i, window: o, globals: d };
}
function u0(n) {
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
function as(n, l = !1) {
  if (!(l ? n?.tagName === "input" && Nf(n) : n?.tagName === "button" && !/^(button|reset)$/.test(String(n.props.type ?? "submit")) && !n.props.disabled)) return null;
  for (let o = n.parentElement; o; o = o.parentElement) if (o.tagName === "form") return o;
  return null;
}
const Nf = (n) => n?.tagName === "textarea" || n?.tagName === "input" && /^(text|search|url|email|tel|password|number|)$/.test(String(n.props.type ?? ""));
//! Evaluated before anything else in the runtime bundle: React's scheduler reads `setTimeout` and `queueMicrotask`
//! once, when it loads, so an engine without them (QuickJS) gets the host's (`perch.setTimeout`) first.
const Md = globalThis.perch;
if (typeof globalThis.setTimeout != "function" && typeof Md?.setTimeout == "function") {
  const n = zf(Md);
  globalThis.setTimeout = n.setTimeout, globalThis.clearTimeout = n.clearTimeout;
}
typeof globalThis.queueMicrotask != "function" && (globalThis.queueMicrotask = (n) => {
  Promise.resolve().then(n);
});
function xs(n) {
  return n && n.__esModule && Object.prototype.hasOwnProperty.call(n, "default") ? n.default : n;
}
function d0(n) {
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
var Go = { exports: {} }, pt = {};
/**
 * @license React
 * react.production.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var Ad;
function f0() {
  if (Ad) return pt;
  Ad = 1;
  var n = Symbol.for("react.transitional.element"), l = Symbol.for("react.portal"), i = Symbol.for("react.fragment"), o = Symbol.for("react.strict_mode"), s = Symbol.for("react.profiler"), d = Symbol.for("react.consumer"), m = Symbol.for("react.context"), f = Symbol.for("react.forward_ref"), p = Symbol.for("react.suspense"), y = Symbol.for("react.memo"), E = Symbol.for("react.lazy"), w = Symbol.for("react.activity"), v = Symbol.iterator;
  function z(C) {
    return C === null || typeof C != "object" ? null : (C = v && C[v] || C["@@iterator"], typeof C == "function" ? C : null);
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
  }, S = Object.assign, k = {};
  function j(C, X, et) {
    this.props = C, this.context = X, this.refs = k, this.updater = et || N;
  }
  j.prototype.isReactComponent = {}, j.prototype.setState = function(C, X) {
    if (typeof C != "object" && typeof C != "function" && C != null)
      throw Error(
        "takes an object of state variables to update or a function which returns an object of state variables."
      );
    this.updater.enqueueSetState(this, C, X, "setState");
  }, j.prototype.forceUpdate = function(C) {
    this.updater.enqueueForceUpdate(this, C, "forceUpdate");
  };
  function H() {
  }
  H.prototype = j.prototype;
  function A(C, X, et) {
    this.props = C, this.context = X, this.refs = k, this.updater = et || N;
  }
  var L = A.prototype = new H();
  L.constructor = A, S(L, j.prototype), L.isPureReactComponent = !0;
  var U = Array.isArray;
  function R() {
  }
  var h = { H: null, A: null, T: null, S: null }, b = Object.prototype.hasOwnProperty;
  function x(C, X, et) {
    var it = et.ref;
    return {
      $$typeof: n,
      type: C,
      key: X,
      ref: it !== void 0 ? it : null,
      props: et
    };
  }
  function _(C, X) {
    return x(C.type, X, C.props);
  }
  function T(C) {
    return typeof C == "object" && C !== null && C.$$typeof === n;
  }
  function D(C) {
    var X = { "=": "=0", ":": "=2" };
    return "$" + C.replace(/[=:]/g, function(et) {
      return X[et];
    });
  }
  var G = /\/+/g;
  function I(C, X) {
    return typeof C == "object" && C !== null && C.key != null ? D("" + C.key) : X.toString(36);
  }
  function tt(C) {
    switch (C.status) {
      case "fulfilled":
        return C.value;
      case "rejected":
        throw C.reason;
      default:
        switch (typeof C.status == "string" ? C.then(R, R) : (C.status = "pending", C.then(
          function(X) {
            C.status === "pending" && (C.status = "fulfilled", C.value = X);
          },
          function(X) {
            C.status === "pending" && (C.status = "rejected", C.reason = X);
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
  function Q(C, X, et, it, ot) {
    var st = typeof C;
    (st === "undefined" || st === "boolean") && (C = null);
    var kt = !1;
    if (C === null) kt = !0;
    else
      switch (st) {
        case "bigint":
        case "string":
        case "number":
          kt = !0;
          break;
        case "object":
          switch (C.$$typeof) {
            case n:
            case l:
              kt = !0;
              break;
            case E:
              return kt = C._init, Q(
                kt(C._payload),
                X,
                et,
                it,
                ot
              );
          }
      }
    if (kt)
      return ot = ot(C), kt = it === "" ? "." + I(C, 0) : it, U(ot) ? (et = "", kt != null && (et = kt.replace(G, "$&/") + "/"), Q(ot, X, et, "", function(Kn) {
        return Kn;
      })) : ot != null && (T(ot) && (ot = _(
        ot,
        et + (ot.key == null || C && C.key === ot.key ? "" : ("" + ot.key).replace(
          G,
          "$&/"
        ) + "/") + kt
      )), X.push(ot)), 1;
    kt = 0;
    var Jt = it === "" ? "." : it + ":";
    if (U(C))
      for (var ht = 0; ht < C.length; ht++)
        it = C[ht], st = Jt + I(it, ht), kt += Q(
          it,
          X,
          et,
          st,
          ot
        );
    else if (ht = z(C), typeof ht == "function")
      for (C = ht.call(C), ht = 0; !(it = C.next()).done; )
        it = it.value, st = Jt + I(it, ht++), kt += Q(
          it,
          X,
          et,
          st,
          ot
        );
    else if (st === "object") {
      if (typeof C.then == "function")
        return Q(
          tt(C),
          X,
          et,
          it,
          ot
        );
      throw X = String(C), Error(
        "Objects are not valid as a React child (found: " + (X === "[object Object]" ? "object with keys {" + Object.keys(C).join(", ") + "}" : X) + "). If you meant to render a collection of children, use an array instead."
      );
    }
    return kt;
  }
  function Z(C, X, et) {
    if (C == null) return C;
    var it = [], ot = 0;
    return Q(C, it, "", "", function(st) {
      return X.call(et, st, ot++);
    }), it;
  }
  function $(C) {
    if (C._status === -1) {
      var X = C._result;
      X = X(), X.then(
        function(et) {
          (C._status === 0 || C._status === -1) && (C._status = 1, C._result = et);
        },
        function(et) {
          (C._status === 0 || C._status === -1) && (C._status = 2, C._result = et);
        }
      ), C._status === -1 && (C._status = 0, C._result = X);
    }
    if (C._status === 1) return C._result.default;
    throw C._result;
  }
  var K = typeof reportError == "function" ? reportError : function(C) {
    if (typeof window == "object" && typeof window.ErrorEvent == "function") {
      var X = new window.ErrorEvent("error", {
        bubbles: !0,
        cancelable: !0,
        message: typeof C == "object" && C !== null && typeof C.message == "string" ? String(C.message) : String(C),
        error: C
      });
      if (!window.dispatchEvent(X)) return;
    } else if (typeof process == "object" && typeof process.emit == "function") {
      process.emit("uncaughtException", C);
      return;
    }
    console.error(C);
  }, V = {
    map: Z,
    forEach: function(C, X, et) {
      Z(
        C,
        function() {
          X.apply(this, arguments);
        },
        et
      );
    },
    count: function(C) {
      var X = 0;
      return Z(C, function() {
        X++;
      }), X;
    },
    toArray: function(C) {
      return Z(C, function(X) {
        return X;
      }) || [];
    },
    only: function(C) {
      if (!T(C))
        throw Error(
          "React.Children.only expected to receive a single React element child."
        );
      return C;
    }
  };
  return pt.Activity = w, pt.Children = V, pt.Component = j, pt.Fragment = i, pt.Profiler = s, pt.PureComponent = A, pt.StrictMode = o, pt.Suspense = p, pt.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE = h, pt.__COMPILER_RUNTIME = {
    __proto__: null,
    c: function(C) {
      return h.H.useMemoCache(C);
    }
  }, pt.cache = function(C) {
    return function() {
      return C.apply(null, arguments);
    };
  }, pt.cacheSignal = function() {
    return null;
  }, pt.cloneElement = function(C, X, et) {
    if (C == null)
      throw Error(
        "The argument must be a React element, but you passed " + C + "."
      );
    var it = S({}, C.props), ot = C.key;
    if (X != null)
      for (st in X.key !== void 0 && (ot = "" + X.key), X)
        !b.call(X, st) || st === "key" || st === "__self" || st === "__source" || st === "ref" && X.ref === void 0 || (it[st] = X[st]);
    var st = arguments.length - 2;
    if (st === 1) it.children = et;
    else if (1 < st) {
      for (var kt = Array(st), Jt = 0; Jt < st; Jt++)
        kt[Jt] = arguments[Jt + 2];
      it.children = kt;
    }
    return x(C.type, ot, it);
  }, pt.createContext = function(C) {
    return C = {
      $$typeof: m,
      _currentValue: C,
      _currentValue2: C,
      _threadCount: 0,
      Provider: null,
      Consumer: null
    }, C.Provider = C, C.Consumer = {
      $$typeof: d,
      _context: C
    }, C;
  }, pt.createElement = function(C, X, et) {
    var it, ot = {}, st = null;
    if (X != null)
      for (it in X.key !== void 0 && (st = "" + X.key), X)
        b.call(X, it) && it !== "key" && it !== "__self" && it !== "__source" && (ot[it] = X[it]);
    var kt = arguments.length - 2;
    if (kt === 1) ot.children = et;
    else if (1 < kt) {
      for (var Jt = Array(kt), ht = 0; ht < kt; ht++)
        Jt[ht] = arguments[ht + 2];
      ot.children = Jt;
    }
    if (C && C.defaultProps)
      for (it in kt = C.defaultProps, kt)
        ot[it] === void 0 && (ot[it] = kt[it]);
    return x(C, st, ot);
  }, pt.createRef = function() {
    return { current: null };
  }, pt.forwardRef = function(C) {
    return { $$typeof: f, render: C };
  }, pt.isValidElement = T, pt.lazy = function(C) {
    return {
      $$typeof: E,
      _payload: { _status: -1, _result: C },
      _init: $
    };
  }, pt.memo = function(C, X) {
    return {
      $$typeof: y,
      type: C,
      compare: X === void 0 ? null : X
    };
  }, pt.startTransition = function(C) {
    var X = h.T, et = {};
    h.T = et;
    try {
      var it = C(), ot = h.S;
      ot !== null && ot(et, it), typeof it == "object" && it !== null && typeof it.then == "function" && it.then(R, K);
    } catch (st) {
      K(st);
    } finally {
      X !== null && et.types !== null && (X.types = et.types), h.T = X;
    }
  }, pt.unstable_useCacheRefresh = function() {
    return h.H.useCacheRefresh();
  }, pt.use = function(C) {
    return h.H.use(C);
  }, pt.useActionState = function(C, X, et) {
    return h.H.useActionState(C, X, et);
  }, pt.useCallback = function(C, X) {
    return h.H.useCallback(C, X);
  }, pt.useContext = function(C) {
    return h.H.useContext(C);
  }, pt.useDebugValue = function() {
  }, pt.useDeferredValue = function(C, X) {
    return h.H.useDeferredValue(C, X);
  }, pt.useEffect = function(C, X) {
    return h.H.useEffect(C, X);
  }, pt.useEffectEvent = function(C) {
    return h.H.useEffectEvent(C);
  }, pt.useId = function() {
    return h.H.useId();
  }, pt.useImperativeHandle = function(C, X, et) {
    return h.H.useImperativeHandle(C, X, et);
  }, pt.useInsertionEffect = function(C, X) {
    return h.H.useInsertionEffect(C, X);
  }, pt.useLayoutEffect = function(C, X) {
    return h.H.useLayoutEffect(C, X);
  }, pt.useMemo = function(C, X) {
    return h.H.useMemo(C, X);
  }, pt.useOptimistic = function(C, X) {
    return h.H.useOptimistic(C, X);
  }, pt.useReducer = function(C, X, et) {
    return h.H.useReducer(C, X, et);
  }, pt.useRef = function(C) {
    return h.H.useRef(C);
  }, pt.useState = function(C) {
    return h.H.useState(C);
  }, pt.useSyncExternalStore = function(C, X, et) {
    return h.H.useSyncExternalStore(
      C,
      X,
      et
    );
  }, pt.useTransition = function() {
    return h.H.useTransition();
  }, pt.version = "19.2.8", pt;
}
var jd;
function m0() {
  return jd || (jd = 1, Go.exports = f0()), Go.exports;
}
var dt = m0();
const Tf = /* @__PURE__ */ xs(dt), p0 = /* @__PURE__ */ gs({
  __proto__: null,
  default: Tf
}, [dt]);
//! "react" as the runtime bundles it, for its own code, the stock screens and every screen's `react` import: React
//! itself, with `useEffect` and `useLayoutEffect` run through `measured` (`dom.mjs`), so an effect that measures a
//! box the engine has not laid out yet runs again once it has (layout readback).
const h0 = Tf ?? p0;
function Ie(n, l) {
  return dt.useEffect(Ef(n), l);
}
function ls(n, l) {
  return dt.useLayoutEffect(Ef(n), l);
}
const g0 = /* @__PURE__ */ gs({
  __proto__: null,
  default: h0,
  useEffect: Ie,
  useLayoutEffect: ls
}, [dt]);
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
var Od;
function b0() {
  if (Od) return vl;
  Od = 1;
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
var Rd;
function v0() {
  return Rd || (Rd = 1, Ko.exports = b0()), Ko.exports;
}
var ft = v0();
const y0 = /* @__PURE__ */ xs(ft), vy = /* @__PURE__ */ gs({
  __proto__: null,
  default: y0
}, [ft]);
var Qo = { exports: {} }, Vo = { exports: {} };
const x0 = /* @__PURE__ */ d0(g0);
var Lo = { exports: {} }, Xo = {};
/**
 * @license React
 * scheduler.production.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var Dd;
function w0() {
  return Dd || (Dd = 1, (function(n) {
    function l(Q, Z) {
      var $ = Q.length;
      Q.push(Z);
      t: for (; 0 < $; ) {
        var K = $ - 1 >>> 1, V = Q[K];
        if (0 < s(V, Z))
          Q[K] = Z, Q[$] = V, $ = K;
        else break t;
      }
    }
    function i(Q) {
      return Q.length === 0 ? null : Q[0];
    }
    function o(Q) {
      if (Q.length === 0) return null;
      var Z = Q[0], $ = Q.pop();
      if ($ !== Z) {
        Q[0] = $;
        t: for (var K = 0, V = Q.length, C = V >>> 1; K < C; ) {
          var X = 2 * (K + 1) - 1, et = Q[X], it = X + 1, ot = Q[it];
          if (0 > s(et, $))
            it < V && 0 > s(ot, et) ? (Q[K] = ot, Q[it] = $, K = it) : (Q[K] = et, Q[X] = $, K = X);
          else if (it < V && 0 > s(ot, $))
            Q[K] = ot, Q[it] = $, K = it;
          else break t;
        }
      }
      return Z;
    }
    function s(Q, Z) {
      var $ = Q.sortIndex - Z.sortIndex;
      return $ !== 0 ? $ : Q.id - Z.id;
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
    var p = [], y = [], E = 1, w = null, v = 3, z = !1, N = !1, S = !1, k = !1, j = typeof setTimeout == "function" ? setTimeout : null, H = typeof clearTimeout == "function" ? clearTimeout : null, A = typeof setImmediate < "u" ? setImmediate : null;
    function L(Q) {
      for (var Z = i(y); Z !== null; ) {
        if (Z.callback === null) o(y);
        else if (Z.startTime <= Q)
          o(y), Z.sortIndex = Z.expirationTime, l(p, Z);
        else break;
        Z = i(y);
      }
    }
    function U(Q) {
      if (S = !1, L(Q), !N)
        if (i(p) !== null)
          N = !0, R || (R = !0, D());
        else {
          var Z = i(y);
          Z !== null && tt(U, Z.startTime - Q);
        }
    }
    var R = !1, h = -1, b = 5, x = -1;
    function _() {
      return k ? !0 : !(n.unstable_now() - x < b);
    }
    function T() {
      if (k = !1, R) {
        var Q = n.unstable_now();
        x = Q;
        var Z = !0;
        try {
          t: {
            N = !1, S && (S = !1, H(h), h = -1), z = !0;
            var $ = v;
            try {
              e: {
                for (L(Q), w = i(p); w !== null && !(w.expirationTime > Q && _()); ) {
                  var K = w.callback;
                  if (typeof K == "function") {
                    w.callback = null, v = w.priorityLevel;
                    var V = K(
                      w.expirationTime <= Q
                    );
                    if (Q = n.unstable_now(), typeof V == "function") {
                      w.callback = V, L(Q), Z = !0;
                      break e;
                    }
                    w === i(p) && o(p), L(Q);
                  } else o(p);
                  w = i(p);
                }
                if (w !== null) Z = !0;
                else {
                  var C = i(y);
                  C !== null && tt(
                    U,
                    C.startTime - Q
                  ), Z = !1;
                }
              }
              break t;
            } finally {
              w = null, v = $, z = !1;
            }
            Z = void 0;
          }
        } finally {
          Z ? D() : R = !1;
        }
      }
    }
    var D;
    if (typeof A == "function")
      D = function() {
        A(T);
      };
    else if (typeof MessageChannel < "u") {
      var G = new MessageChannel(), I = G.port2;
      G.port1.onmessage = T, D = function() {
        I.postMessage(null);
      };
    } else
      D = function() {
        j(T, 0);
      };
    function tt(Q, Z) {
      h = j(function() {
        Q(n.unstable_now());
      }, Z);
    }
    n.unstable_IdlePriority = 5, n.unstable_ImmediatePriority = 1, n.unstable_LowPriority = 4, n.unstable_NormalPriority = 3, n.unstable_Profiling = null, n.unstable_UserBlockingPriority = 2, n.unstable_cancelCallback = function(Q) {
      Q.callback = null;
    }, n.unstable_forceFrameRate = function(Q) {
      0 > Q || 125 < Q ? console.error(
        "forceFrameRate takes a positive int between 0 and 125, forcing frame rates higher than 125 fps is not supported"
      ) : b = 0 < Q ? Math.floor(1e3 / Q) : 5;
    }, n.unstable_getCurrentPriorityLevel = function() {
      return v;
    }, n.unstable_next = function(Q) {
      switch (v) {
        case 1:
        case 2:
        case 3:
          var Z = 3;
          break;
        default:
          Z = v;
      }
      var $ = v;
      v = Z;
      try {
        return Q();
      } finally {
        v = $;
      }
    }, n.unstable_requestPaint = function() {
      k = !0;
    }, n.unstable_runWithPriority = function(Q, Z) {
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
        return Z();
      } finally {
        v = $;
      }
    }, n.unstable_scheduleCallback = function(Q, Z, $) {
      var K = n.unstable_now();
      switch (typeof $ == "object" && $ !== null ? ($ = $.delay, $ = typeof $ == "number" && 0 < $ ? K + $ : K) : $ = K, Q) {
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
        id: E++,
        callback: Z,
        priorityLevel: Q,
        startTime: $,
        expirationTime: V,
        sortIndex: -1
      }, $ > K ? (Q.sortIndex = $, l(y, Q), i(p) === null && Q === i(y) && (S ? (H(h), h = -1) : S = !0, tt(U, $ - K))) : (Q.sortIndex = V, l(p, Q), N || z || (N = !0, R || (R = !0, D()))), Q;
    }, n.unstable_shouldYield = _, n.unstable_wrapCallback = function(Q) {
      var Z = v;
      return function() {
        var $ = v;
        v = Z;
        try {
          return Q.apply(this, arguments);
        } finally {
          v = $;
        }
      };
    };
  })(Xo)), Xo;
}
var Hd;
function _0() {
  return Hd || (Hd = 1, Lo.exports = w0()), Lo.exports;
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
var Bd;
function S0() {
  return Bd || (Bd = 1, (function(n) {
    n.exports = function(l) {
      function i(t, e, a, r) {
        return new $m(t, e, a, r);
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
      function E(t) {
        return t === null || typeof t != "object" ? null : (t = Lu && t[Lu] || t["@@iterator"], typeof t == "function" ? t : null);
      }
      function w(t) {
        if (t == null) return null;
        if (typeof t == "function")
          return t.$$typeof === ap ? null : t.displayName || t.name || null;
        if (typeof t == "string") return t;
        switch (t) {
          case ya:
            return "Fragment";
          case io:
            return "Profiler";
          case Qu:
            return "StrictMode";
          case so:
            return "Suspense";
          case co:
            return "SuspenseList";
          case fo:
            return "Activity";
        }
        if (typeof t == "object")
          switch (t.$$typeof) {
            case va:
              return "Portal";
            case Sn:
              return t.displayName || "Context";
            case Vu:
              return (t._context.displayName || "Context") + ".Consumer";
            case oo:
              var e = t.render;
              return t = t.displayName, t || (t = e.displayName || e.name || "", t = t !== "" ? "ForwardRef(" + t + ")" : "ForwardRef"), t;
            case uo:
              return e = t.displayName || null, e !== null ? e : w(t.type) || "Memo";
            case kn:
              e = t._payload, t = t._init;
              try {
                return w(t(e));
              } catch {
              }
          }
        return null;
      }
      function v(t) {
        return { current: t };
      }
      function z(t) {
        0 > _a || (t.current = vo[_a], vo[_a] = null, _a--);
      }
      function N(t, e) {
        _a++, vo[_a] = t.current, t.current = e;
      }
      function S(t) {
        return t >>>= 0, t === 0 ? 32 : 31 - (Ah(t) / jh | 0) | 0;
      }
      function k(t) {
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
        var M = r & 134217727;
        return M !== 0 ? (r = M & ~u, r !== 0 ? c = k(r) : (g &= M, g !== 0 ? c = k(g) : a || (a = M & ~t, a !== 0 && (c = k(a))))) : (M = r & ~u, M !== 0 ? c = k(M) : g !== 0 ? c = k(g) : a || (a = r & ~t, a !== 0 && (c = k(a)))), c === 0 ? 0 : e !== 0 && e !== c && (e & u) === 0 && (u = c & -c, a = e & -e, u >= a || u === 32 && (a & 4194048) !== 0) ? e : c;
      }
      function H(t, e) {
        return (t.pendingLanes & ~(t.suspendedLanes & ~t.pingedLanes) & e) === 0;
      }
      function A(t, e) {
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
      function L() {
        var t = sr;
        return sr <<= 1, (sr & 62914560) === 0 && (sr = 4194304), t;
      }
      function U(t) {
        for (var e = [], a = 0; 31 > a; a++) e.push(t);
        return e;
      }
      function R(t, e) {
        t.pendingLanes |= e, e !== 268435456 && (t.suspendedLanes = 0, t.pingedLanes = 0, t.warmLanes = 0);
      }
      function h(t, e, a, r, c, u) {
        var g = t.pendingLanes;
        t.pendingLanes = a, t.suspendedLanes = 0, t.pingedLanes = 0, t.warmLanes = 0, t.expiredLanes &= a, t.entangledLanes &= a, t.errorRecoveryDisabledLanes &= a, t.shellSuspendCounter = 0;
        var M = t.entanglements, Y = t.expirationTimes, J = t.hiddenUpdates;
        for (a = g & ~a; 0 < a; ) {
          var P = 31 - xe(a), W = 1 << P;
          M[P] = 0, Y[P] = -1;
          var nt = J[P];
          if (nt !== null)
            for (J[P] = null, P = 0; P < nt.length; P++) {
              var gt = nt[P];
              gt !== null && (gt.lane &= -536870913);
            }
          a &= ~W;
        }
        r !== 0 && b(t, r, 0), u !== 0 && c === 0 && t.tag !== 0 && (t.suspendedLanes |= u & ~(g & ~e));
      }
      function b(t, e, a) {
        t.pendingLanes |= e, t.suspendedLanes &= ~e;
        var r = 31 - xe(e);
        t.entangledLanes |= e, t.entanglements[r] = t.entanglements[r] | 1073741824 | a & 261930;
      }
      function x(t, e) {
        var a = t.entangledLanes |= e;
        for (t = t.entanglements; a; ) {
          var r = 31 - xe(a), c = 1 << r;
          c & e | t[r] & e && (t[r] |= e), a &= ~c;
        }
      }
      function _(t, e) {
        var a = e & -e;
        return a = (a & 42) !== 0 ? 1 : T(a), (a & (t.suspendedLanes | e)) !== 0 ? 0 : a;
      }
      function T(t) {
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
      function D(t) {
        return t &= -t, 2 < t ? 8 < t ? (t & 134217727) !== 0 ? 32 : 268435456 : 8 : 2;
      }
      function G(t) {
        if (typeof Bh == "function" && Uh(t), we && typeof we.setStrictMode == "function")
          try {
            we.setStrictMode(rl, t);
          } catch {
          }
      }
      function I(t, e) {
        return t === e && (t !== 0 || 1 / t === 1 / e) || t !== t && e !== e;
      }
      function tt(t) {
        if (wo === void 0)
          try {
            throw Error();
          } catch (a) {
            var e = a.stack.trim().match(/\n( *(at )?)/);
            wo = e && e[1] || "", bd = -1 < a.stack.indexOf(`
    at`) ? " (<anonymous>)" : -1 < a.stack.indexOf("@") ? "@unknown:0:0" : "";
          }
        return `
` + wo + t + bd;
      }
      function Q(t, e) {
        if (!t || _o) return "";
        _o = !0;
        var a = Error.prepareStackTrace;
        Error.prepareStackTrace = void 0;
        try {
          var r = {
            DetermineComponentFrameRoot: function() {
              try {
                if (e) {
                  var W = function() {
                    throw Error();
                  };
                  if (Object.defineProperty(W.prototype, "props", {
                    set: function() {
                      throw Error();
                    }
                  }), typeof Reflect == "object" && Reflect.construct) {
                    try {
                      Reflect.construct(W, []);
                    } catch (gt) {
                      var nt = gt;
                    }
                    Reflect.construct(t, [], W);
                  } else {
                    try {
                      W.call();
                    } catch (gt) {
                      nt = gt;
                    }
                    t.call(W.prototype);
                  }
                } else {
                  try {
                    throw Error();
                  } catch (gt) {
                    nt = gt;
                  }
                  (W = t()) && typeof W.catch == "function" && W.catch(function() {
                  });
                }
              } catch (gt) {
                if (gt && nt && typeof gt.stack == "string")
                  return [gt.stack, nt.stack];
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
            var Y = g.split(`
`), J = M.split(`
`);
            for (c = r = 0; r < Y.length && !Y[r].includes("DetermineComponentFrameRoot"); )
              r++;
            for (; c < J.length && !J[c].includes(
              "DetermineComponentFrameRoot"
            ); )
              c++;
            if (r === Y.length || c === J.length)
              for (r = Y.length - 1, c = J.length - 1; 1 <= r && 0 <= c && Y[r] !== J[c]; )
                c--;
            for (; 1 <= r && 0 <= c; r--, c--)
              if (Y[r] !== J[c]) {
                if (r !== 1 || c !== 1)
                  do
                    if (r--, c--, 0 > c || Y[r] !== J[c]) {
                      var P = `
` + Y[r].replace(" at new ", " at ");
                      return t.displayName && P.includes("<anonymous>") && (P = P.replace("<anonymous>", t.displayName)), P;
                    }
                  while (1 <= r && 0 <= c);
                break;
              }
          }
        } finally {
          _o = !1, Error.prepareStackTrace = a;
        }
        return (a = t ? t.displayName || t.name : "") ? tt(a) : "";
      }
      function Z(t, e) {
        switch (t.tag) {
          case 26:
          case 27:
          case 5:
            return tt(t.type);
          case 16:
            return tt("Lazy");
          case 13:
            return t.child !== e && e !== null ? tt("Suspense Fallback") : tt("Suspense");
          case 19:
            return tt("SuspenseList");
          case 0:
          case 15:
            return Q(t.type, !1);
          case 11:
            return Q(t.type.render, !1);
          case 1:
            return Q(t.type, !0);
          case 31:
            return tt("Activity");
          default:
            return "";
        }
      }
      function $(t) {
        try {
          var e = "", a = null;
          do
            e += Z(t, a), a = t, t = t.return;
          while (t);
          return e;
        } catch (r) {
          return `
Error generating stack: ` + r.message + `
` + r.stack;
        }
      }
      function K(t, e) {
        if (typeof t == "object" && t !== null) {
          var a = vd.get(t);
          return a !== void 0 ? a : (e = {
            value: t,
            source: e,
            stack: $(e)
          }, vd.set(t, e), e);
        }
        return {
          value: t,
          source: e,
          stack: $(e)
        };
      }
      function V(t, e) {
        ka[Ea++] = il, ka[Ea++] = ur, ur = t, il = e;
      }
      function C(t, e, a) {
        Te[Ce++] = Le, Te[Ce++] = Xe, Te[Ce++] = En, En = t;
        var r = Le;
        t = Xe;
        var c = 32 - xe(r) - 1;
        r &= ~(1 << c), a += 1;
        var u = 32 - xe(e) + c;
        if (30 < u) {
          var g = c - c % 5;
          u = (r & (1 << g) - 1).toString(32), r >>= g, c -= g, Le = 1 << 32 - xe(e) + c | a << c | r, Xe = u + t;
        } else
          Le = 1 << u | a << c | r, Xe = t;
      }
      function X(t) {
        t.return !== null && (V(t, 1), C(t, 1, 0));
      }
      function et(t) {
        for (; t === ur; )
          ur = ka[--Ea], ka[Ea] = null, il = ka[--Ea], ka[Ea] = null;
        for (; t === En; )
          En = Te[--Ce], Te[Ce] = null, Xe = Te[--Ce], Te[Ce] = null, Le = Te[--Ce], Te[Ce] = null;
      }
      function it(t, e) {
        Te[Ce++] = Le, Te[Ce++] = Xe, Te[Ce++] = En, Le = e.id, Xe = e.overflow, En = t;
      }
      function ot(t, e) {
        N(zn, e), N(ol, t), N(te, null), t = ip(e), z(te), N(te, t);
      }
      function st() {
        z(te), z(ol), z(zn);
      }
      function kt(t) {
        t.memoizedState !== null && N(dr, t);
        var e = te.current, a = op(e, t.type);
        e !== a && (N(ol, t), N(te, a));
      }
      function Jt(t) {
        ol.current === t && (z(te), z(ol)), dr.current === t && (z(dr), ln ? $n._currentValue = xa : $n._currentValue2 = xa);
      }
      function ht(t) {
        var e = Error(
          s(
            418,
            1 < arguments.length && arguments[1] !== void 0 && arguments[1] ? "text" : "HTML",
            ""
          )
        );
        throw Ga(K(e, t)), So;
      }
      function Kn(t, e) {
        if (!se) throw Error(s(175));
        oh(
          t.stateNode,
          t.type,
          t.memoizedProps,
          e,
          t
        ) || ht(t, !0);
      }
      function Qn(t) {
        for (ee = t.return; ee; )
          switch (ee.tag) {
            case 5:
            case 31:
            case 13:
              Me = !1;
              return;
            case 27:
            case 3:
              Me = !0;
              return;
            default:
              ee = ee.return;
          }
      }
      function Re(t) {
        if (!se || t !== ee) return !1;
        if (!St) return Qn(t), St = !0, !1;
        var e = t.tag;
        if (Lt ? e !== 3 && e !== 27 && (e !== 5 || ld(t.type) && !rr(t.type, t.memoizedProps)) && Ot && ht(t) : e !== 3 && (e !== 5 || ld(t.type) && !rr(t.type, t.memoizedProps)) && Ot && ht(t), Qn(t), e === 13) {
          if (!se) throw Error(s(316));
          if (t = t.memoizedState, t = t !== null ? t.dehydrated : null, !t) throw Error(s(317));
          Ot = fh(t);
        } else if (e === 31) {
          if (t = t.memoizedState, t = t !== null ? t.dehydrated : null, !t) throw Error(s(317));
          Ot = dh(t);
        } else
          Ot = Lt && e === 27 ? Ip(
            t.type,
            Ot
          ) : ee ? ad(t.stateNode) : null;
        return !0;
      }
      function De() {
        se && (Ot = ee = null, St = !1);
      }
      function hn() {
        var t = Nn;
        return t !== null && (ge === null ? ge = t : ge.push.apply(
          ge,
          t
        ), Nn = null), t;
      }
      function Ga(t) {
        Nn === null ? Nn = [t] : Nn.push(t);
      }
      function gn(t, e, a) {
        ln ? (N(fr, e._currentValue), e._currentValue = a) : (N(fr, e._currentValue2), e._currentValue2 = a);
      }
      function $e(t) {
        var e = fr.current;
        ln ? t._currentValue = e : t._currentValue2 = e, z(fr);
      }
      function ai(t, e, a) {
        for (; t !== null; ) {
          var r = t.alternate;
          if ((t.childLanes & e) !== e ? (t.childLanes |= e, r !== null && (r.childLanes |= e)) : r !== null && (r.childLanes & e) !== e && (r.childLanes |= e), t === a) break;
          t = t.return;
        }
      }
      function li(t, e, a, r) {
        var c = t.child;
        for (c !== null && (c.return = t); c !== null; ) {
          var u = c.dependencies;
          if (u !== null) {
            var g = c.child;
            u = u.firstContext;
            t: for (; u !== null; ) {
              var M = u;
              u = c;
              for (var Y = 0; Y < e.length; Y++)
                if (M.context === e[Y]) {
                  u.lanes |= a, M = u.alternate, M !== null && (M.lanes |= a), ai(
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
            g.lanes |= a, u = g.alternate, u !== null && (u.lanes |= a), ai(g, a, t), g = null;
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
              _e(c.pendingProps.value, g.value) || (t !== null ? t.push(M) : t = [M]);
            }
          } else if (c === dr.current) {
            if (g = c.alternate, g === null) throw Error(s(387));
            g.memoizedState.memoizedState !== c.memoizedState.memoizedState && (t !== null ? t.push($n) : t = [$n]);
          }
          c = c.return;
        }
        t !== null && li(
          e,
          t,
          a,
          r
        ), e.flags |= 262144;
      }
      function Tl(t) {
        for (t = t.firstContext; t !== null; ) {
          var e = t.context;
          if (!_e(
            ln ? e._currentValue : e._currentValue2,
            t.memoizedValue
          ))
            return !0;
          t = t.next;
        }
        return !1;
      }
      function Vn(t) {
        Pn = t, on = null, t = t.dependencies, t !== null && (t.firstContext = null);
      }
      function $t(t) {
        return As(Pn, t);
      }
      function Cl(t, e) {
        return Pn === null && Vn(t), As(t, e);
      }
      function As(t, e) {
        var a = ln ? e._currentValue : e._currentValue2;
        if (e = { context: e, memoizedValue: a, next: null }, on === null) {
          if (t === null) throw Error(s(308));
          on = e, t.dependencies = { lanes: 0, firstContext: e }, t.flags |= 524288;
        } else on = on.next = e;
        return a;
      }
      function ri() {
        return {
          controller: new Yh(),
          data: /* @__PURE__ */ new Map(),
          refCount: 0
        };
      }
      function Ka(t) {
        t.refCount--, t.refCount === 0 && Gh(Kh, function() {
          t.controller.abort();
        });
      }
      function Ml() {
      }
      function Ke(t) {
        t !== za && t.next === null && (za === null ? mr = za = t : za = za.next = t), pr = !0, ko || (ko = !0, Tm());
      }
      function ma(t, e) {
        if (!Eo && pr) {
          Eo = !0;
          do
            for (var a = !1, r = mr; r !== null; ) {
              if (t !== 0) {
                var c = r.pendingLanes;
                if (c === 0) var u = 0;
                else {
                  var g = r.suspendedLanes, M = r.pingedLanes;
                  u = (1 << 31 - xe(42 | t) + 1) - 1, u &= c & ~(g & ~M), u = u & 201326741 ? u & 201326741 | 1 : u ? u | 2 : 0;
                }
                u !== 0 && (a = !0, Hs(r, u));
              } else
                u = _t, u = j(
                  r,
                  r === At ? u : 0,
                  r.cancelPendingCommit !== null || r.timeoutHandle !== In
                ), (u & 3) === 0 || H(r, u) || (a = !0, Hs(r, u));
              r = r.next;
            }
          while (a);
          Eo = !1;
        }
      }
      function js() {
        Os();
      }
      function Os() {
        pr = ko = !1;
        var t = 0;
        ta !== 0 && gp() && (t = ta);
        for (var e = pe(), a = null, r = mr; r !== null; ) {
          var c = r.next, u = Rs(r, e);
          u === 0 ? (r.next = null, a === null ? mr = c : a.next = c, c === null && (za = a)) : (a = r, (t !== 0 || (u & 3) !== 0) && (pr = !0)), r = c;
        }
        Xt !== 0 && Xt !== 5 || ma(t), ta !== 0 && (ta = 0);
      }
      function Rs(t, e) {
        for (var a = t.suspendedLanes, r = t.pingedLanes, c = t.expirationTimes, u = t.pendingLanes & -62914561; 0 < u; ) {
          var g = 31 - xe(u), M = 1 << g, Y = c[g];
          Y === -1 ? ((M & a) === 0 || (M & r) !== 0) && (c[g] = A(M, e)) : Y <= e && (t.expiredLanes |= M), u &= ~M;
        }
        if (e = At, a = _t, a = j(
          t,
          t === e ? a : 0,
          t.cancelPendingCommit !== null || t.timeoutHandle !== In
        ), r = t.callbackNode, a === 0 || t === e && (Ct === 2 || Ct === 9) || t.cancelPendingCommit !== null)
          return r !== null && r !== null && yo(r), t.callbackNode = null, t.callbackPriority = 0;
        if ((a & 3) === 0 || H(t, a)) {
          if (e = a & -a, e === t.callbackPriority) return e;
          switch (r !== null && yo(r), D(a)) {
            case 2:
            case 8:
              a = Dh;
              break;
            case 32:
              a = xo;
              break;
            case 268435456:
              a = Hh;
              break;
            default:
              a = xo;
          }
          return r = Ds.bind(null, t), a = cr(a, r), t.callbackPriority = e, t.callbackNode = a, e;
        }
        return r !== null && r !== null && yo(r), t.callbackPriority = 2, t.callbackNode = null, 2;
      }
      function Ds(t, e) {
        if (Xt !== 0 && Xt !== 5)
          return t.callbackNode = null, t.callbackPriority = 0, null;
        var a = t.callbackNode;
        if (el() && t.callbackNode !== a)
          return null;
        var r = _t;
        return r = j(
          t,
          t === At ? r : 0,
          t.cancelPendingCommit !== null || t.timeoutHandle !== In
        ), r === 0 ? null : (vu(t, r, e), Rs(t, pe()), t.callbackNode != null && t.callbackNode === a ? Ds.bind(null, t) : null);
      }
      function Hs(t, e) {
        if (el()) return null;
        vu(t, e, !0);
      }
      function Tm() {
        Sp ? kp(function() {
          (xt & 6) !== 0 ? cr(
            hd,
            js
          ) : Os();
        }) : cr(
          hd,
          js
        );
      }
      function ii() {
        if (ta === 0) {
          var t = Na;
          t === 0 && (t = ir, ir <<= 1, (ir & 261888) === 0 && (ir = 256)), ta = t;
        }
        return ta;
      }
      function Cm(t, e) {
        if (sl === null) {
          var a = sl = [];
          zo = 0, Na = ii(), Ta = {
            status: "pending",
            value: void 0,
            then: function(r) {
              a.push(r);
            }
          };
        }
        return zo++, e.then(Bs, Bs), e;
      }
      function Bs() {
        if (--zo === 0 && sl !== null) {
          Ta !== null && (Ta.status = "fulfilled");
          var t = sl;
          sl = null, Na = 0, Ta = null;
          for (var e = 0; e < t.length; e++) (0, t[e])();
        }
      }
      function Mm(t, e) {
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
      function oi() {
        var t = ea.current;
        return t !== null ? t : At.pooledCache;
      }
      function Al(t, e) {
        e === null ? N(ea, ea.current) : N(ea, e.pool);
      }
      function Us() {
        var t = oi();
        return t === null ? null : {
          parent: ln ? Rt._currentValue : Rt._currentValue2,
          pool: t
        };
      }
      function jl(t, e) {
        if (_e(t, e)) return !0;
        if (typeof t != "object" || t === null || typeof e != "object" || e === null)
          return !1;
        var a = Object.keys(t), r = Object.keys(e);
        if (a.length !== r.length) return !1;
        for (r = 0; r < a.length; r++) {
          var c = a[r];
          if (!qh.call(e, c) || !_e(t[c], e[c]))
            return !1;
        }
        return !0;
      }
      function qs(t) {
        return t = t.status, t === "fulfilled" || t === "rejected";
      }
      function Ys(t, e, a) {
        switch (a = t[a], a === void 0 ? t.push(e) : a !== e && (e.then(Ml, Ml), e = a), e.status) {
          case "fulfilled":
            return e.value;
          case "rejected":
            throw t = e.reason, Ks(t), t;
          default:
            if (typeof e.status == "string") e.then(Ml, Ml);
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
                throw t = e.reason, Ks(t), t;
            }
            throw na = e, Ca;
        }
      }
      function Ln(t) {
        try {
          var e = t._init;
          return e(t._payload);
        } catch (a) {
          throw a !== null && typeof a == "object" && typeof a.then == "function" ? (na = a, Ca) : a;
        }
      }
      function Gs() {
        if (na === null) throw Error(s(459));
        var t = na;
        return na = null, t;
      }
      function Ks(t) {
        if (t === Ca || t === hr)
          throw Error(s(483));
      }
      function Ol(t) {
        var e = cl;
        return cl += 1, Ma === null && (Ma = []), Ys(Ma, t, e);
      }
      function Qa(t, e) {
        e = e.props.ref, t.ref = e !== void 0 ? e : null;
      }
      function Rl(t, e) {
        throw e.$$typeof === ep ? Error(s(525)) : (t = Object.prototype.toString.call(e), Error(
          s(
            31,
            t === "[object Object]" ? "object with keys {" + Object.keys(e).join(", ") + "}" : t
          )
        ));
      }
      function Qs(t) {
        function e(B, O) {
          if (t) {
            var q = B.deletions;
            q === null ? (B.deletions = [O], B.flags |= 16) : q.push(O);
          }
        }
        function a(B, O) {
          if (!t) return null;
          for (; O !== null; )
            e(B, O), O = O.sibling;
          return null;
        }
        function r(B) {
          for (var O = /* @__PURE__ */ new Map(); B !== null; )
            B.key !== null ? O.set(B.key, B) : O.set(B.index, B), B = B.sibling;
          return O;
        }
        function c(B, O) {
          return B = an(B, O), B.index = 0, B.sibling = null, B;
        }
        function u(B, O, q) {
          return B.index = q, t ? (q = B.alternate, q !== null ? (q = q.index, q < O ? (B.flags |= 67108866, O) : q) : (B.flags |= 67108866, O)) : (B.flags |= 1048576, O);
        }
        function g(B) {
          return t && B.alternate === null && (B.flags |= 67108866), B;
        }
        function M(B, O, q, F) {
          return O === null || O.tag !== 6 ? (O = no(q, B.mode, F), O.return = B, O) : (O = c(O, q), O.return = B, O);
        }
        function Y(B, O, q, F) {
          var ut = q.type;
          return ut === ya ? P(
            B,
            O,
            q.props.children,
            F,
            q.key
          ) : O !== null && (O.elementType === ut || typeof ut == "object" && ut !== null && ut.$$typeof === kn && Ln(ut) === O.type) ? (O = c(O, q.props), Qa(O, q), O.return = B, O) : (O = nr(
            q.type,
            q.key,
            q.props,
            null,
            B.mode,
            F
          ), Qa(O, q), O.return = B, O);
        }
        function J(B, O, q, F) {
          return O === null || O.tag !== 4 || O.stateNode.containerInfo !== q.containerInfo || O.stateNode.implementation !== q.implementation ? (O = ao(q, B.mode, F), O.return = B, O) : (O = c(O, q.children || []), O.return = B, O);
        }
        function P(B, O, q, F, ut) {
          return O === null || O.tag !== 7 ? (O = Fn(
            q,
            B.mode,
            F,
            ut
          ), O.return = B, O) : (O = c(O, q), O.return = B, O);
        }
        function W(B, O, q) {
          if (typeof O == "string" && O !== "" || typeof O == "number" || typeof O == "bigint")
            return O = no(
              "" + O,
              B.mode,
              q
            ), O.return = B, O;
          if (typeof O == "object" && O !== null) {
            switch (O.$$typeof) {
              case ar:
                return q = nr(
                  O.type,
                  O.key,
                  O.props,
                  null,
                  B.mode,
                  q
                ), Qa(q, O), q.return = B, q;
              case va:
                return O = ao(
                  O,
                  B.mode,
                  q
                ), O.return = B, O;
              case kn:
                return O = Ln(O), W(B, O, q);
            }
            if (lr(O) || E(O))
              return O = Fn(
                O,
                B.mode,
                q,
                null
              ), O.return = B, O;
            if (typeof O.then == "function")
              return W(B, Ol(O), q);
            if (O.$$typeof === Sn)
              return W(
                B,
                Cl(B, O),
                q
              );
            Rl(B, O);
          }
          return null;
        }
        function nt(B, O, q, F) {
          var ut = O !== null ? O.key : null;
          if (typeof q == "string" && q !== "" || typeof q == "number" || typeof q == "bigint")
            return ut !== null ? null : M(B, O, "" + q, F);
          if (typeof q == "object" && q !== null) {
            switch (q.$$typeof) {
              case ar:
                return q.key === ut ? Y(B, O, q, F) : null;
              case va:
                return q.key === ut ? J(B, O, q, F) : null;
              case kn:
                return q = Ln(q), nt(B, O, q, F);
            }
            if (lr(q) || E(q))
              return ut !== null ? null : P(B, O, q, F, null);
            if (typeof q.then == "function")
              return nt(
                B,
                O,
                Ol(q),
                F
              );
            if (q.$$typeof === Sn)
              return nt(
                B,
                O,
                Cl(B, q),
                F
              );
            Rl(B, q);
          }
          return null;
        }
        function gt(B, O, q, F, ut) {
          if (typeof F == "string" && F !== "" || typeof F == "number" || typeof F == "bigint")
            return B = B.get(q) || null, M(O, B, "" + F, ut);
          if (typeof F == "object" && F !== null) {
            switch (F.$$typeof) {
              case ar:
                return B = B.get(
                  F.key === null ? q : F.key
                ) || null, Y(O, B, F, ut);
              case va:
                return B = B.get(
                  F.key === null ? q : F.key
                ) || null, J(O, B, F, ut);
              case kn:
                return F = Ln(F), gt(
                  B,
                  O,
                  q,
                  F,
                  ut
                );
            }
            if (lr(F) || E(F))
              return B = B.get(q) || null, P(O, B, F, ut, null);
            if (typeof F.then == "function")
              return gt(
                B,
                O,
                q,
                Ol(F),
                ut
              );
            if (F.$$typeof === Sn)
              return gt(
                B,
                O,
                q,
                Cl(O, F),
                ut
              );
            Rl(O, F);
          }
          return null;
        }
        function ne(B, O, q, F) {
          for (var ut = null, Dt = null, mt = O, zt = O = 0, It = null; mt !== null && zt < q.length; zt++) {
            mt.index > zt ? (It = mt, mt = null) : It = mt.sibling;
            var Nt = nt(
              B,
              mt,
              q[zt],
              F
            );
            if (Nt === null) {
              mt === null && (mt = It);
              break;
            }
            t && mt && Nt.alternate === null && e(B, mt), O = u(Nt, O, zt), Dt === null ? ut = Nt : Dt.sibling = Nt, Dt = Nt, mt = It;
          }
          if (zt === q.length)
            return a(B, mt), St && V(B, zt), ut;
          if (mt === null) {
            for (; zt < q.length; zt++)
              mt = W(B, q[zt], F), mt !== null && (O = u(
                mt,
                O,
                zt
              ), Dt === null ? ut = mt : Dt.sibling = mt, Dt = mt);
            return St && V(B, zt), ut;
          }
          for (mt = r(mt); zt < q.length; zt++)
            It = gt(
              mt,
              B,
              zt,
              q[zt],
              F
            ), It !== null && (t && It.alternate !== null && mt.delete(
              It.key === null ? zt : It.key
            ), O = u(
              It,
              O,
              zt
            ), Dt === null ? ut = It : Dt.sibling = It, Dt = It);
          return t && mt.forEach(function(On) {
            return e(B, On);
          }), St && V(B, zt), ut;
        }
        function gl(B, O, q, F) {
          if (q == null) throw Error(s(151));
          for (var ut = null, Dt = null, mt = O, zt = O = 0, It = null, Nt = q.next(); mt !== null && !Nt.done; zt++, Nt = q.next()) {
            mt.index > zt ? (It = mt, mt = null) : It = mt.sibling;
            var On = nt(B, mt, Nt.value, F);
            if (On === null) {
              mt === null && (mt = It);
              break;
            }
            t && mt && On.alternate === null && e(B, mt), O = u(On, O, zt), Dt === null ? ut = On : Dt.sibling = On, Dt = On, mt = It;
          }
          if (Nt.done)
            return a(B, mt), St && V(B, zt), ut;
          if (mt === null) {
            for (; !Nt.done; zt++, Nt = q.next())
              Nt = W(B, Nt.value, F), Nt !== null && (O = u(
                Nt,
                O,
                zt
              ), Dt === null ? ut = Nt : Dt.sibling = Nt, Dt = Nt);
            return St && V(B, zt), ut;
          }
          for (mt = r(mt); !Nt.done; zt++, Nt = q.next())
            Nt = gt(
              mt,
              B,
              zt,
              Nt.value,
              F
            ), Nt !== null && (t && Nt.alternate !== null && mt.delete(Nt.key === null ? zt : Nt.key), O = u(Nt, O, zt), Dt === null ? ut = Nt : Dt.sibling = Nt, Dt = Nt);
          return t && mt.forEach(function(Xh) {
            return e(B, Xh);
          }), St && V(B, zt), ut;
        }
        function ia(B, O, q, F) {
          if (typeof q == "object" && q !== null && q.type === ya && q.key === null && (q = q.props.children), typeof q == "object" && q !== null) {
            switch (q.$$typeof) {
              case ar:
                t: {
                  for (var ut = q.key; O !== null; ) {
                    if (O.key === ut) {
                      if (ut = q.type, ut === ya) {
                        if (O.tag === 7) {
                          a(
                            B,
                            O.sibling
                          ), F = c(
                            O,
                            q.props.children
                          ), F.return = B, B = F;
                          break t;
                        }
                      } else if (O.elementType === ut || typeof ut == "object" && ut !== null && ut.$$typeof === kn && Ln(ut) === O.type) {
                        a(
                          B,
                          O.sibling
                        ), F = c(O, q.props), Qa(F, q), F.return = B, B = F;
                        break t;
                      }
                      a(B, O);
                      break;
                    } else e(B, O);
                    O = O.sibling;
                  }
                  q.type === ya ? (F = Fn(
                    q.props.children,
                    B.mode,
                    F,
                    q.key
                  ), F.return = B, B = F) : (F = nr(
                    q.type,
                    q.key,
                    q.props,
                    null,
                    B.mode,
                    F
                  ), Qa(F, q), F.return = B, B = F);
                }
                return g(B);
              case va:
                t: {
                  for (ut = q.key; O !== null; ) {
                    if (O.key === ut)
                      if (O.tag === 4 && O.stateNode.containerInfo === q.containerInfo && O.stateNode.implementation === q.implementation) {
                        a(
                          B,
                          O.sibling
                        ), F = c(
                          O,
                          q.children || []
                        ), F.return = B, B = F;
                        break t;
                      } else {
                        a(B, O);
                        break;
                      }
                    else e(B, O);
                    O = O.sibling;
                  }
                  F = ao(q, B.mode, F), F.return = B, B = F;
                }
                return g(B);
              case kn:
                return q = Ln(q), ia(
                  B,
                  O,
                  q,
                  F
                );
            }
            if (lr(q))
              return ne(
                B,
                O,
                q,
                F
              );
            if (E(q)) {
              if (ut = E(q), typeof ut != "function")
                throw Error(s(150));
              return q = ut.call(q), gl(
                B,
                O,
                q,
                F
              );
            }
            if (typeof q.then == "function")
              return ia(
                B,
                O,
                Ol(q),
                F
              );
            if (q.$$typeof === Sn)
              return ia(
                B,
                O,
                Cl(B, q),
                F
              );
            Rl(B, q);
          }
          return typeof q == "string" && q !== "" || typeof q == "number" || typeof q == "bigint" ? (q = "" + q, O !== null && O.tag === 6 ? (a(B, O.sibling), F = c(O, q), F.return = B, B = F) : (a(B, O), F = no(q, B.mode, F), F.return = B, B = F), g(B)) : a(B, O);
        }
        return function(B, O, q, F) {
          try {
            cl = 0;
            var ut = ia(
              B,
              O,
              q,
              F
            );
            return Ma = null, ut;
          } catch (mt) {
            if (mt === Ca || mt === hr) throw mt;
            var Dt = i(29, mt, null, B.mode);
            return Dt.lanes = F, Dt.return = B, Dt;
          } finally {
          }
        };
      }
      function Dl() {
        for (var t = Aa, e = To = Aa = 0; e < t; ) {
          var a = Ae[e];
          Ae[e++] = null;
          var r = Ae[e];
          Ae[e++] = null;
          var c = Ae[e];
          Ae[e++] = null;
          var u = Ae[e];
          if (Ae[e++] = null, r !== null && c !== null) {
            var g = r.pending;
            g === null ? c.next = c : (c.next = g.next, g.next = c), r.pending = c;
          }
          u !== 0 && Vs(a, c, u);
        }
      }
      function Hl(t, e, a, r) {
        Ae[Aa++] = t, Ae[Aa++] = e, Ae[Aa++] = a, Ae[Aa++] = r, To |= r, t.lanes |= r, t = t.alternate, t !== null && (t.lanes |= r);
      }
      function si(t, e, a, r) {
        return Hl(t, e, a, r), Bl(t);
      }
      function Xn(t, e) {
        return Hl(t, null, null, e), Bl(t);
      }
      function Vs(t, e, a) {
        t.lanes |= a;
        var r = t.alternate;
        r !== null && (r.lanes |= a);
        for (var c = !1, u = t.return; u !== null; )
          u.childLanes |= a, r = u.alternate, r !== null && (r.childLanes |= a), u.tag === 22 && (t = u.stateNode, t === null || t._visibility & 1 || (c = !0)), t = u, u = u.return;
        return t.tag === 3 ? (u = t.stateNode, c && e !== null && (c = 31 - xe(a), t = u.hiddenUpdates, r = t[c], r === null ? t[c] = [e] : r.push(e), e.lane = a | 536870912), u) : null;
      }
      function Bl(t) {
        if (50 < hl)
          throw hl = 0, Yo = null, Error(s(185));
        for (var e = t.return; e !== null; )
          t = e, e = t.return;
        return t.tag === 3 ? t.stateNode : null;
      }
      function ci(t) {
        t.updateQueue = {
          baseState: t.memoizedState,
          firstBaseUpdate: null,
          lastBaseUpdate: null,
          shared: { pending: null, lanes: 0, hiddenCallbacks: null },
          callbacks: null
        };
      }
      function ui(t, e) {
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
          return c === null ? e.next = e : (e.next = c.next, c.next = e), r.pending = e, e = Bl(t), Vs(t, null, a), e;
        }
        return Hl(t, r, e, a), Bl(t);
      }
      function Va(t, e, a) {
        if (e = e.updateQueue, e !== null && (e = e.shared, (a & 4194048) !== 0)) {
          var r = e.lanes;
          r &= t.pendingLanes, a |= r, e.lanes = a, x(t, a);
        }
      }
      function di(t, e) {
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
      function La() {
        if (Co) {
          var t = Ta;
          if (t !== null) throw t;
        }
      }
      function Xa(t, e, a, r) {
        Co = !1;
        var c = t.updateQueue;
        Tn = !1;
        var u = c.firstBaseUpdate, g = c.lastBaseUpdate, M = c.shared.pending;
        if (M !== null) {
          c.shared.pending = null;
          var Y = M, J = Y.next;
          Y.next = null, g === null ? u = J : g.next = J, g = Y;
          var P = t.alternate;
          P !== null && (P = P.updateQueue, M = P.lastBaseUpdate, M !== g && (M === null ? P.firstBaseUpdate = J : M.next = J, P.lastBaseUpdate = Y));
        }
        if (u !== null) {
          var W = c.baseState;
          g = 0, P = J = Y = null, M = u;
          do {
            var nt = M.lane & -536870913, gt = nt !== M.lane;
            if (gt ? (_t & nt) === nt : (r & nt) === nt) {
              nt !== 0 && nt === Na && (Co = !0), P !== null && (P = P.next = {
                lane: 0,
                tag: M.tag,
                payload: M.payload,
                callback: null,
                next: null
              });
              t: {
                var ne = t, gl = M;
                nt = e;
                var ia = a;
                switch (gl.tag) {
                  case 1:
                    if (ne = gl.payload, typeof ne == "function") {
                      W = ne.call(
                        ia,
                        W,
                        nt
                      );
                      break t;
                    }
                    W = ne;
                    break t;
                  case 3:
                    ne.flags = ne.flags & -65537 | 128;
                  case 0:
                    if (ne = gl.payload, nt = typeof ne == "function" ? ne.call(ia, W, nt) : ne, nt == null) break t;
                    W = ro({}, W, nt);
                    break t;
                  case 2:
                    Tn = !0;
                }
              }
              nt = M.callback, nt !== null && (t.flags |= 64, gt && (t.flags |= 8192), gt = c.callbacks, gt === null ? c.callbacks = [nt] : gt.push(nt));
            } else
              gt = {
                lane: nt,
                tag: M.tag,
                payload: M.payload,
                callback: M.callback,
                next: null
              }, P === null ? (J = P = gt, Y = W) : P = P.next = gt, g |= nt;
            if (M = M.next, M === null) {
              if (M = c.shared.pending, M === null)
                break;
              gt = M, M = gt.next, gt.next = null, c.lastBaseUpdate = gt, c.shared.pending = null;
            }
          } while (!0);
          P === null && (Y = W), c.baseState = Y, c.firstBaseUpdate = J, c.lastBaseUpdate = P, u === null && (c.shared.lanes = 0), Mn |= g, t.lanes = g, t.memoizedState = W;
        }
      }
      function Ls(t, e) {
        if (typeof t != "function")
          throw Error(s(191, t));
        t.call(e);
      }
      function Xs(t, e) {
        var a = t.callbacks;
        if (a !== null)
          for (t.callbacks = null, t = 0; t < a.length; t++)
            Ls(a[t], e);
      }
      function Zs(t, e) {
        t = un, N(br, t), N(ja, e), un = t | e.baseLanes;
      }
      function fi() {
        N(br, un), N(ja, ja.current);
      }
      function mi() {
        un = br.current, z(ja), z(br);
      }
      function yn(t) {
        var e = t.alternate;
        N(qt, qt.current & 1), N(Se, t), je === null && (e === null || ja.current !== null || e.memoizedState !== null) && (je = t);
      }
      function pi(t) {
        N(qt, qt.current), N(Se, t), je === null && (je = t);
      }
      function Js(t) {
        t.tag === 22 ? (N(qt, qt.current), N(Se, t), je === null && (je = t)) : xn();
      }
      function xn() {
        N(qt, qt.current), N(Se, Se.current);
      }
      function be(t) {
        z(Se), je === t && (je = null), z(qt);
      }
      function Ul(t) {
        for (var e = t; e !== null; ) {
          if (e.tag === 13) {
            var a = e.memoizedState;
            if (a !== null && (a = a.dehydrated, a === null || ho(a) || go(a)))
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
      function hi(t, e) {
        if (e === null) return !1;
        for (var a = 0; a < e.length && a < t.length; a++)
          if (!_e(t[a], e[a])) return !1;
        return !0;
      }
      function gi(t, e, a, r, c, u) {
        return sn = u, bt = e, e.memoizedState = null, e.updateQueue = null, e.lanes = 0, ct.H = t === null || t.memoizedState === null ? wd : Mo, la = !1, u = a(r, c), la = !1, Oa && (u = Fs(
          e,
          a,
          r,
          c
        )), Ws(t), u;
      }
      function Ws(t) {
        ct.H = dl;
        var e = Mt !== null && Mt.next !== null;
        if (sn = 0, Yt = Mt = bt = null, vr = !1, ul = 0, Ra = null, e) throw Error(s(300));
        t === null || Gt || (t = t.dependencies, t !== null && Tl(t) && (Gt = !0));
      }
      function Fs(t, e, a, r) {
        bt = t;
        var c = 0;
        do {
          if (Oa && (Ra = null), ul = 0, Oa = !1, 25 <= c) throw Error(s(301));
          if (c += 1, Yt = Mt = null, t.updateQueue != null) {
            var u = t.updateQueue;
            u.lastEffect = null, u.events = null, u.stores = null, u.memoCache != null && (u.memoCache.index = 0);
          }
          ct.H = _d, u = e(a, r);
        } while (Oa);
        return u;
      }
      function Am() {
        var t = ct.H, e = t.useState()[0];
        return e = typeof e.then == "function" ? Za(e) : e, t = t.useState()[0], (Mt !== null ? Mt.memoizedState : null) !== t && (bt.flags |= 1024), e;
      }
      function bi() {
        var t = yr !== 0;
        return yr = 0, t;
      }
      function vi(t, e, a) {
        e.updateQueue = t.updateQueue, e.flags &= -2053, t.lanes &= ~a;
      }
      function yi(t) {
        if (vr) {
          for (t = t.memoizedState; t !== null; ) {
            var e = t.queue;
            e !== null && (e.pending = null), t = t.next;
          }
          vr = !1;
        }
        sn = 0, Yt = Mt = bt = null, Oa = !1, ul = yr = 0, Ra = null;
      }
      function de() {
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
      function ql() {
        return { lastEffect: null, events: null, stores: null, memoCache: null };
      }
      function Za(t) {
        var e = ul;
        return ul += 1, Ra === null && (Ra = []), t = Ys(Ra, t, e), e = bt, (Yt === null ? e.memoizedState : Yt.next) === null && (e = e.alternate, ct.H = e === null || e.memoizedState === null ? wd : Mo), t;
      }
      function Yl(t) {
        if (t !== null && typeof t == "object") {
          if (typeof t.then == "function") return Za(t);
          if (t.$$typeof === Sn) return $t(t);
        }
        throw Error(s(438, String(t)));
      }
      function xi(t) {
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
        if (e == null && (e = { data: [], index: 0 }), a === null && (a = ql(), bt.updateQueue = a), a.memoCache = e, a = e.data[e.index], a === void 0)
          for (a = e.data[e.index] = Array(t), r = 0; r < t; r++)
            a[r] = np;
        return e.index++, a;
      }
      function Pe(t, e) {
        return typeof e == "function" ? e(t) : e;
      }
      function Gl(t) {
        var e = Ut();
        return wi(e, Mt, t);
      }
      function wi(t, e, a) {
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
          var M = g = null, Y = null, J = e, P = !1;
          do {
            var W = J.lane & -536870913;
            if (W !== J.lane ? (_t & W) === W : (sn & W) === W) {
              var nt = J.revertLane;
              if (nt === 0)
                Y !== null && (Y = Y.next = {
                  lane: 0,
                  revertLane: 0,
                  gesture: null,
                  action: J.action,
                  hasEagerState: J.hasEagerState,
                  eagerState: J.eagerState,
                  next: null
                }), W === Na && (P = !0);
              else if ((sn & nt) === nt) {
                J = J.next, nt === Na && (P = !0);
                continue;
              } else
                W = {
                  lane: 0,
                  revertLane: J.revertLane,
                  gesture: null,
                  action: J.action,
                  hasEagerState: J.hasEagerState,
                  eagerState: J.eagerState,
                  next: null
                }, Y === null ? (M = Y = W, g = u) : Y = Y.next = W, bt.lanes |= nt, Mn |= nt;
              W = J.action, la && a(u, W), u = J.hasEagerState ? J.eagerState : a(u, W);
            } else
              nt = {
                lane: W,
                revertLane: J.revertLane,
                gesture: J.gesture,
                action: J.action,
                hasEagerState: J.hasEagerState,
                eagerState: J.eagerState,
                next: null
              }, Y === null ? (M = Y = nt, g = u) : Y = Y.next = nt, bt.lanes |= W, Mn |= W;
            J = J.next;
          } while (J !== null && J !== e);
          if (Y === null ? g = u : Y.next = M, !_e(u, t.memoizedState) && (Gt = !0, P && (a = Ta, a !== null)))
            throw a;
          t.memoizedState = u, t.baseState = g, t.baseQueue = Y, r.lastRenderedState = u;
        }
        return c === null && (r.lanes = 0), [t.memoizedState, r.dispatch];
      }
      function _i(t) {
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
          _e(u, e.memoizedState) || (Gt = !0), e.memoizedState = u, e.baseQueue === null && (e.baseState = u), a.lastRenderedState = u;
        }
        return [u, r];
      }
      function Is(t, e, a) {
        var r = bt, c = Ut(), u = St;
        if (u) {
          if (a === void 0)
            throw Error(s(407));
          a = a();
        } else a = e();
        var g = !_e(
          (Mt || c).memoizedState,
          a
        );
        if (g && (c.memoizedState = a, Gt = !0), c = c.queue, Ei(tc.bind(null, r, c, t), [
          t
        ]), c.getSnapshot !== e || g || Yt !== null && Yt.memoizedState.tag & 1) {
          if (r.flags |= 2048, pa(
            9,
            { destroy: void 0 },
            Ps.bind(
              null,
              r,
              c,
              a,
              e
            ),
            null
          ), At === null) throw Error(s(349));
          u || (sn & 127) !== 0 || $s(r, e, a);
        }
        return a;
      }
      function $s(t, e, a) {
        t.flags |= 16384, t = { getSnapshot: e, value: a }, e = bt.updateQueue, e === null ? (e = ql(), bt.updateQueue = e, e.stores = [t]) : (a = e.stores, a === null ? e.stores = [t] : a.push(t));
      }
      function Ps(t, e, a, r) {
        e.value = a, e.getSnapshot = r, ec(e) && nc(t);
      }
      function tc(t, e, a) {
        return a(function() {
          ec(e) && nc(t);
        });
      }
      function ec(t) {
        var e = t.getSnapshot;
        t = t.value;
        try {
          var a = e();
          return !_e(t, a);
        } catch {
          return !0;
        }
      }
      function nc(t) {
        var e = Xn(t, 2);
        e !== null && me(e, t, 2);
      }
      function Si(t) {
        var e = de();
        if (typeof t == "function") {
          var a = t;
          if (t = a(), la) {
            G(!0);
            try {
              a();
            } finally {
              G(!1);
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
      function ac(t, e, a, r) {
        return t.baseState = a, wi(
          t,
          Mt,
          typeof r == "function" ? r : Pe
        );
      }
      function jm(t, e, a, r, c) {
        if (Vl(t)) throw Error(s(485));
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
          ct.T !== null ? a(!0) : u.isTransition = !1, r(u), a = e.pending, a === null ? (u.next = e.pending = u, lc(e, u)) : (u.next = a.next, e.pending = a.next = u);
        }
      }
      function lc(t, e) {
        var a = e.action, r = e.payload, c = t.state;
        if (e.isTransition) {
          var u = ct.T, g = {};
          ct.T = g;
          try {
            var M = a(c, r), Y = ct.S;
            Y !== null && Y(g, M), rc(t, e, M);
          } catch (J) {
            ki(t, e, J);
          } finally {
            u !== null && g.types !== null && (u.types = g.types), ct.T = u;
          }
        } else
          try {
            u = a(c, r), rc(t, e, u);
          } catch (J) {
            ki(t, e, J);
          }
      }
      function rc(t, e, a) {
        a !== null && typeof a == "object" && typeof a.then == "function" ? a.then(
          function(r) {
            ic(t, e, r);
          },
          function(r) {
            return ki(t, e, r);
          }
        ) : ic(t, e, a);
      }
      function ic(t, e, a) {
        e.status = "fulfilled", e.value = a, oc(e), t.state = a, e = t.pending, e !== null && (a = e.next, a === e ? t.pending = null : (a = a.next, e.next = a, lc(t, a)));
      }
      function ki(t, e, a) {
        var r = t.pending;
        if (t.pending = null, r !== null) {
          r = r.next;
          do
            e.status = "rejected", e.reason = a, oc(e), e = e.next;
          while (e !== r);
        }
        t.action = null;
      }
      function oc(t) {
        t = t.listeners;
        for (var e = 0; e < t.length; e++) (0, t[e])();
      }
      function sc(t, e) {
        return e;
      }
      function cc(t, e) {
        if (St) {
          var a = At.formState;
          if (a !== null) {
            t: {
              var r = bt;
              if (St) {
                if (Ot) {
                  var c = Wp(
                    Ot,
                    Me
                  );
                  if (c) {
                    Ot = ad(c), r = Fp(c);
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
        a = de(), a.memoizedState = a.baseState = e, r = {
          pending: null,
          lanes: 0,
          dispatch: null,
          lastRenderedReducer: sc,
          lastRenderedState: e
        }, a.queue = r, a = Nc.bind(
          null,
          bt,
          r
        ), r.dispatch = a, r = Si(!1);
        var u = Ci.bind(
          null,
          bt,
          !1,
          r.queue
        );
        return r = de(), c = {
          state: e,
          dispatch: null,
          action: t,
          pending: null
        }, r.queue = c, a = jm.bind(
          null,
          bt,
          c,
          u,
          a
        ), c.dispatch = a, r.memoizedState = t, [e, a, !1];
      }
      function uc(t) {
        var e = Ut();
        return dc(e, Mt, t);
      }
      function dc(t, e, a) {
        if (e = wi(
          t,
          e,
          sc
        )[0], t = Gl(Pe)[0], typeof e == "object" && e !== null && typeof e.then == "function")
          try {
            var r = Za(e);
          } catch (g) {
            throw g === Ca ? hr : g;
          }
        else r = e;
        e = Ut();
        var c = e.queue, u = c.dispatch;
        return a !== e.memoizedState && (bt.flags |= 2048, pa(
          9,
          { destroy: void 0 },
          Om.bind(null, c, a),
          null
        )), [r, u, t];
      }
      function Om(t, e) {
        t.action = e;
      }
      function fc(t) {
        var e = Ut(), a = Mt;
        if (a !== null)
          return dc(e, a, t);
        Ut(), e = e.memoizedState, a = Ut();
        var r = a.queue.dispatch;
        return a.memoizedState = t, [e, r, !1];
      }
      function pa(t, e, a, r) {
        return t = { tag: t, create: a, deps: r, inst: e, next: null }, e = bt.updateQueue, e === null && (e = ql(), bt.updateQueue = e), a = e.lastEffect, a === null ? e.lastEffect = t.next = t : (r = a.next, a.next = t, t.next = r, e.lastEffect = t), t;
      }
      function mc() {
        return Ut().memoizedState;
      }
      function Kl(t, e, a, r) {
        var c = de();
        bt.flags |= t, c.memoizedState = pa(
          1 | e,
          { destroy: void 0 },
          a,
          r === void 0 ? null : r
        );
      }
      function Ql(t, e, a, r) {
        var c = Ut();
        r = r === void 0 ? null : r;
        var u = c.memoizedState.inst;
        Mt !== null && r !== null && hi(r, Mt.memoizedState.deps) ? c.memoizedState = pa(e, u, a, r) : (bt.flags |= t, c.memoizedState = pa(
          1 | e,
          u,
          a,
          r
        ));
      }
      function pc(t, e) {
        Kl(8390656, 8, t, e);
      }
      function Ei(t, e) {
        Ql(2048, 8, t, e);
      }
      function Rm(t) {
        bt.flags |= 4;
        var e = bt.updateQueue;
        if (e === null)
          e = ql(), bt.updateQueue = e, e.events = [t];
        else {
          var a = e.events;
          a === null ? e.events = [t] : a.push(t);
        }
      }
      function hc(t) {
        var e = Ut().memoizedState;
        return Rm({ ref: e, nextImpl: t }), function() {
          if ((xt & 2) !== 0)
            throw Error(s(440));
          return e.impl.apply(void 0, arguments);
        };
      }
      function gc(t, e) {
        return Ql(4, 2, t, e);
      }
      function bc(t, e) {
        return Ql(4, 4, t, e);
      }
      function vc(t, e) {
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
      function yc(t, e, a) {
        a = a != null ? a.concat([t]) : null, Ql(
          4,
          4,
          vc.bind(null, e, t),
          a
        );
      }
      function zi() {
      }
      function xc(t, e) {
        var a = Ut();
        e = e === void 0 ? null : e;
        var r = a.memoizedState;
        return e !== null && hi(e, r[1]) ? r[0] : (a.memoizedState = [t, e], t);
      }
      function wc(t, e) {
        var a = Ut();
        e = e === void 0 ? null : e;
        var r = a.memoizedState;
        if (e !== null && hi(e, r[1]))
          return r[0];
        if (r = t(), la) {
          G(!0);
          try {
            t();
          } finally {
            G(!1);
          }
        }
        return a.memoizedState = [r, e], r;
      }
      function Ni(t, e, a) {
        return a === void 0 || (sn & 1073741824) !== 0 && (_t & 261930) === 0 ? t.memoizedState = e : (t.memoizedState = a, t = bu(), bt.lanes |= t, Mn |= t, a);
      }
      function _c(t, e, a, r) {
        return _e(a, e) ? a : ja.current !== null ? (t = Ni(t, a, r), _e(t, e) || (Gt = !0), t) : (sn & 42) === 0 || (sn & 1073741824) !== 0 && (_t & 261930) === 0 ? (Gt = !0, t.memoizedState = a) : (t = bu(), bt.lanes |= t, Mn |= t, e);
      }
      function Sc(t, e, a, r, c) {
        var u = rn();
        Wt(
          u !== 0 && 8 > u ? u : 8
        );
        var g = ct.T, M = {};
        ct.T = M, Ci(t, !1, e, a);
        try {
          var Y = c(), J = ct.S;
          if (J !== null && J(M, Y), Y !== null && typeof Y == "object" && typeof Y.then == "function") {
            var P = Mm(
              Y,
              r
            );
            Ja(
              t,
              e,
              P,
              ve(t)
            );
          } else
            Ja(
              t,
              e,
              r,
              ve(t)
            );
        } catch (W) {
          Ja(
            t,
            e,
            { then: function() {
            }, status: "rejected", reason: W },
            ve()
          );
        } finally {
          Wt(u), g !== null && M.types !== null && (g.types = M.types), ct.T = g;
        }
      }
      function kc(t) {
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
      function Ti() {
        return $t($n);
      }
      function Ec() {
        return Ut().memoizedState;
      }
      function zc() {
        return Ut().memoizedState;
      }
      function Dm(t) {
        for (var e = t.return; e !== null; ) {
          switch (e.tag) {
            case 24:
            case 3:
              var a = ve();
              t = bn(a);
              var r = vn(e, t, a);
              r !== null && (me(r, e, a), Va(r, e, a)), e = { cache: ri() }, t.payload = e;
              return;
          }
          e = e.return;
        }
      }
      function Hm(t, e, a) {
        var r = ve();
        a = {
          lane: r,
          revertLane: 0,
          gesture: null,
          action: a,
          hasEagerState: !1,
          eagerState: null,
          next: null
        }, Vl(t) ? Tc(e, a) : (a = si(t, e, a, r), a !== null && (me(a, t, r), Cc(a, e, r)));
      }
      function Nc(t, e, a) {
        var r = ve();
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
        if (Vl(t)) Tc(e, c);
        else {
          var u = t.alternate;
          if (t.lanes === 0 && (u === null || u.lanes === 0) && (u = e.lastRenderedReducer, u !== null))
            try {
              var g = e.lastRenderedState, M = u(g, a);
              if (c.hasEagerState = !0, c.eagerState = M, _e(M, g))
                return Hl(t, e, c, 0), At === null && Dl(), !1;
            } catch {
            } finally {
            }
          if (a = si(t, e, c, r), a !== null)
            return me(a, t, r), Cc(a, e, r), !0;
        }
        return !1;
      }
      function Ci(t, e, a, r) {
        if (r = {
          lane: 2,
          revertLane: ii(),
          gesture: null,
          action: r,
          hasEagerState: !1,
          eagerState: null,
          next: null
        }, Vl(t)) {
          if (e) throw Error(s(479));
        } else
          e = si(
            t,
            a,
            r,
            2
          ), e !== null && me(e, t, 2);
      }
      function Vl(t) {
        var e = t.alternate;
        return t === bt || e !== null && e === bt;
      }
      function Tc(t, e) {
        Oa = vr = !0;
        var a = t.pending;
        a === null ? e.next = e : (e.next = a.next, a.next = e), t.pending = e;
      }
      function Cc(t, e, a) {
        if ((a & 4194048) !== 0) {
          var r = e.lanes;
          r &= t.pendingLanes, a |= r, e.lanes = a, x(t, a);
        }
      }
      function Mi(t, e, a, r) {
        e = t.memoizedState, a = a(r, e), a = a == null ? e : ro({}, e, a), t.memoizedState = a, t.lanes === 0 && (t.updateQueue.baseState = a);
      }
      function Mc(t, e, a, r, c, u, g) {
        return t = t.stateNode, typeof t.shouldComponentUpdate == "function" ? t.shouldComponentUpdate(r, u, g) : e.prototype && e.prototype.isPureReactComponent ? !jl(a, r) || !jl(c, u) : !0;
      }
      function Ac(t, e, a, r) {
        t = e.state, typeof e.componentWillReceiveProps == "function" && e.componentWillReceiveProps(a, r), typeof e.UNSAFE_componentWillReceiveProps == "function" && e.UNSAFE_componentWillReceiveProps(a, r), e.state !== t && Ao.enqueueReplaceState(e, e.state, null);
      }
      function Zn(t, e) {
        var a = e;
        if ("ref" in e) {
          a = {};
          for (var r in e)
            r !== "ref" && (a[r] = e[r]);
        }
        if (t = t.defaultProps) {
          a === e && (a = ro({}, a));
          for (var c in t)
            a[c] === void 0 && (a[c] = t[c]);
        }
        return a;
      }
      function Ll(t, e) {
        try {
          var a = t.onUncaughtError;
          a(e.value, { componentStack: e.stack });
        } catch (r) {
          setTimeout(function() {
            throw r;
          });
        }
      }
      function jc(t, e, a) {
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
      function Ai(t, e, a) {
        return a = bn(a), a.tag = 3, a.payload = { element: null }, a.callback = function() {
          Ll(t, e);
        }, a;
      }
      function Oc(t) {
        return t = bn(t), t.tag = 3, t;
      }
      function Rc(t, e, a, r) {
        var c = a.type.getDerivedStateFromError;
        if (typeof c == "function") {
          var u = r.value;
          t.payload = function() {
            return c(u);
          }, t.callback = function() {
            jc(e, a, r);
          };
        }
        var g = a.stateNode;
        g !== null && typeof g.componentDidCatch == "function" && (t.callback = function() {
          jc(e, a, r), typeof c != "function" && (An === null ? An = /* @__PURE__ */ new Set([this]) : An.add(this));
          var M = r.stack;
          this.componentDidCatch(r.value, {
            componentStack: M !== null ? M : ""
          });
        });
      }
      function Bm(t, e, a, r, c) {
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
                return je === null ? tr() : a.alternate === null && Bt === 0 && (Bt = 3), a.flags &= -257, a.flags |= 65536, a.lanes = c, r === gr ? a.flags |= 16384 : (e = a.updateQueue, e === null ? a.updateQueue = /* @__PURE__ */ new Set([r]) : e.add(r), to(t, r, c)), !1;
              case 22:
                return a.flags |= 65536, r === gr ? a.flags |= 16384 : (e = a.updateQueue, e === null ? (e = {
                  transitions: null,
                  markerInstances: null,
                  retryQueue: /* @__PURE__ */ new Set([r])
                }, a.updateQueue = e) : (a = e.retryQueue, a === null ? e.retryQueue = /* @__PURE__ */ new Set([r]) : a.add(r)), to(t, r, c)), !1;
            }
            throw Error(s(435, a.tag));
          }
          return to(t, r, c), tr(), !1;
        }
        if (St)
          return e = Se.current, e !== null ? ((e.flags & 65536) === 0 && (e.flags |= 256), e.flags |= 65536, e.lanes = c, r !== So && (t = Error(s(422), { cause: r }), Ga(
            K(t, a)
          ))) : (r !== So && (e = Error(s(423), {
            cause: r
          }), Ga(
            K(e, a)
          )), t = t.current.alternate, t.flags |= 65536, c &= -c, t.lanes |= c, r = K(r, a), c = Ai(
            t.stateNode,
            r,
            c
          ), di(t, c), Bt !== 4 && (Bt = 2)), !1;
        var u = Error(s(520), { cause: r });
        if (u = K(u, a), ml === null ? ml = [u] : ml.push(u), Bt !== 4 && (Bt = 2), e === null) return !0;
        r = K(r, a), a = e;
        do {
          switch (a.tag) {
            case 3:
              return a.flags |= 65536, t = c & -c, a.lanes |= t, t = Ai(a.stateNode, r, t), di(a, t), !1;
            case 1:
              if (e = a.type, u = a.stateNode, (a.flags & 128) === 0 && (typeof e.getDerivedStateFromError == "function" || u !== null && typeof u.componentDidCatch == "function" && (An === null || !An.has(
                u
              ))))
                return a.flags |= 65536, c &= -c, a.lanes |= c, c = Oc(c), Rc(
                  c,
                  t,
                  a,
                  r
                ), di(a, c), !1;
          }
          a = a.return;
        } while (a !== null);
        return !1;
      }
      function Pt(t, e, a, r) {
        e.child = t === null ? xd(e, null, a, r) : aa(
          e,
          t.child,
          a,
          r
        );
      }
      function Dc(t, e, a, r, c) {
        a = a.render;
        var u = e.ref;
        if ("ref" in r) {
          var g = {};
          for (var M in r)
            M !== "ref" && (g[M] = r[M]);
        } else g = r;
        return Vn(e), r = gi(
          t,
          e,
          a,
          g,
          u,
          c
        ), M = bi(), t !== null && !Gt ? (vi(t, e, c), tn(t, e, c)) : (St && M && X(e), e.flags |= 1, Pt(t, e, r, c), e.child);
      }
      function Hc(t, e, a, r, c) {
        if (t === null) {
          var u = a.type;
          return typeof u == "function" && !eo(u) && u.defaultProps === void 0 && a.compare === null ? (e.tag = 15, e.type = u, Bc(
            t,
            e,
            u,
            r,
            c
          )) : (t = nr(
            a.type,
            null,
            r,
            e,
            e.mode,
            c
          ), t.ref = e.ref, t.return = e, e.child = t);
        }
        if (u = t.child, !Ui(t, c)) {
          var g = u.memoizedProps;
          if (a = a.compare, a = a !== null ? a : jl, a(g, r) && t.ref === e.ref)
            return tn(
              t,
              e,
              c
            );
        }
        return e.flags |= 1, t = an(u, r), t.ref = e.ref, t.return = e, e.child = t;
      }
      function Bc(t, e, a, r, c) {
        if (t !== null) {
          var u = t.memoizedProps;
          if (jl(u, r) && t.ref === e.ref)
            if (Gt = !1, e.pendingProps = r = u, Ui(t, c))
              (t.flags & 131072) !== 0 && (Gt = !0);
            else
              return e.lanes = t.lanes, tn(t, e, c);
        }
        return ji(
          t,
          e,
          a,
          r,
          c
        );
      }
      function Uc(t, e, a, r) {
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
            return qc(
              t,
              e,
              u,
              a,
              r
            );
          }
          if ((a & 536870912) !== 0)
            e.memoizedState = { baseLanes: 0, cachePool: null }, t !== null && Al(
              e,
              u !== null ? u.cachePool : null
            ), u !== null ? Zs(e, u) : fi(), Js(e);
          else
            return r = e.lanes = 536870912, qc(
              t,
              e,
              u !== null ? u.baseLanes | a : a,
              a,
              r
            );
        } else
          u !== null ? (Al(e, u.cachePool), Zs(e, u), xn(), e.memoizedState = null) : (t !== null && Al(e, null), fi(), xn());
        return Pt(t, e, c, a), e.child;
      }
      function Wa(t, e) {
        return t !== null && t.tag === 22 || e.stateNode !== null || (e.stateNode = {
          _visibility: 1,
          _pendingMarkers: null,
          _retryCache: null,
          _transitions: null
        }), e.sibling;
      }
      function qc(t, e, a, r, c) {
        var u = oi();
        return u = u === null ? null : {
          parent: ln ? Rt._currentValue : Rt._currentValue2,
          pool: u
        }, e.memoizedState = {
          baseLanes: a,
          cachePool: u
        }, t !== null && Al(e, null), fi(), Js(e), t !== null && fa(t, e, r, !0), e.childLanes = c, null;
      }
      function Xl(t, e) {
        return e = Jl(
          { mode: e.mode, children: e.children },
          t.mode
        ), e.ref = t.ref, t.child = e, e.return = t, e;
      }
      function Yc(t, e, a) {
        return aa(e, t.child, null, a), t = Xl(
          e,
          e.pendingProps
        ), t.flags |= 2, be(e), e.memoizedState = null, t;
      }
      function Um(t, e, a) {
        var r = e.pendingProps, c = (e.flags & 128) !== 0;
        if (e.flags &= -129, t === null) {
          if (St) {
            if (r.mode === "hidden")
              return t = Xl(e, r), e.lanes = 536870912, Wa(null, t);
            if (pi(e), (t = Ot) ? (t = rh(
              t,
              Me
            ), t !== null && (e.memoizedState = {
              dehydrated: t,
              treeContext: En !== null ? { id: Le, overflow: Xe } : null,
              retryLane: 536870912,
              hydrationErrors: null
            }, a = Bu(t), a.return = e, e.child = a, ee = e, Ot = null)) : t = null, t === null) throw ht(e);
            return e.lanes = 536870912, null;
          }
          return Xl(e, r);
        }
        var u = t.memoizedState;
        if (u !== null) {
          var g = u.dehydrated;
          if (pi(e), c)
            if (e.flags & 256)
              e.flags &= -257, e = Yc(
                t,
                e,
                a
              );
            else if (e.memoizedState !== null)
              e.child = t.child, e.flags |= 128, e = null;
            else throw Error(s(558));
          else if (Gt || fa(
            t,
            e,
            a,
            !1
          ), c = (a & t.childLanes) !== 0, Gt || c) {
            if (r = At, r !== null && (g = _(r, a), g !== 0 && g !== u.retryLane))
              throw u.retryLane = g, Xn(t, g), me(r, t, g), jo;
            tr(), e = Yc(
              t,
              e,
              a
            );
          } else
            t = u.treeContext, se && (Ot = th(g), ee = e, St = !0, Nn = null, Me = !1, t !== null && it(e, t)), e = Xl(e, r), e.flags |= 4096;
          return e;
        }
        return t = an(t.child, {
          mode: r.mode,
          children: r.children
        }), t.ref = e.ref, e.child = t, t.return = e, t;
      }
      function Zl(t, e) {
        var a = e.ref;
        if (a === null)
          t !== null && t.ref !== null && (e.flags |= 4194816);
        else {
          if (typeof a != "function" && typeof a != "object")
            throw Error(s(284));
          (t === null || t.ref !== a) && (e.flags |= 4194816);
        }
      }
      function ji(t, e, a, r, c) {
        return Vn(e), a = gi(
          t,
          e,
          a,
          r,
          void 0,
          c
        ), r = bi(), t !== null && !Gt ? (vi(t, e, c), tn(t, e, c)) : (St && r && X(e), e.flags |= 1, Pt(t, e, a, c), e.child);
      }
      function Gc(t, e, a, r, c, u) {
        return Vn(e), e.updateQueue = null, a = Fs(
          e,
          r,
          a,
          c
        ), Ws(t), r = bi(), t !== null && !Gt ? (vi(t, e, u), tn(t, e, u)) : (St && r && X(e), e.flags |= 1, Pt(t, e, a, u), e.child);
      }
      function Kc(t, e, a, r, c) {
        if (Vn(e), e.stateNode === null) {
          var u = Sa, g = a.contextType;
          typeof g == "object" && g !== null && (u = $t(g)), u = new a(r, u), e.memoizedState = u.state !== null && u.state !== void 0 ? u.state : null, u.updater = Ao, e.stateNode = u, u._reactInternals = e, u = e.stateNode, u.props = r, u.state = e.memoizedState, u.refs = {}, ci(e), g = a.contextType, u.context = typeof g == "object" && g !== null ? $t(g) : Sa, u.state = e.memoizedState, g = a.getDerivedStateFromProps, typeof g == "function" && (Mi(
            e,
            a,
            g,
            r
          ), u.state = e.memoizedState), typeof a.getDerivedStateFromProps == "function" || typeof u.getSnapshotBeforeUpdate == "function" || typeof u.UNSAFE_componentWillMount != "function" && typeof u.componentWillMount != "function" || (g = u.state, typeof u.componentWillMount == "function" && u.componentWillMount(), typeof u.UNSAFE_componentWillMount == "function" && u.UNSAFE_componentWillMount(), g !== u.state && Ao.enqueueReplaceState(
            u,
            u.state,
            null
          ), Xa(e, r, u, c), La(), u.state = e.memoizedState), typeof u.componentDidMount == "function" && (e.flags |= 4194308), r = !0;
        } else if (t === null) {
          u = e.stateNode;
          var M = e.memoizedProps, Y = Zn(a, M);
          u.props = Y;
          var J = u.context, P = a.contextType;
          g = Sa, typeof P == "object" && P !== null && (g = $t(P));
          var W = a.getDerivedStateFromProps;
          P = typeof W == "function" || typeof u.getSnapshotBeforeUpdate == "function", M = e.pendingProps !== M, P || typeof u.UNSAFE_componentWillReceiveProps != "function" && typeof u.componentWillReceiveProps != "function" || (M || J !== g) && Ac(
            e,
            u,
            r,
            g
          ), Tn = !1;
          var nt = e.memoizedState;
          u.state = nt, Xa(e, r, u, c), La(), J = e.memoizedState, M || nt !== J || Tn ? (typeof W == "function" && (Mi(
            e,
            a,
            W,
            r
          ), J = e.memoizedState), (Y = Tn || Mc(
            e,
            a,
            Y,
            r,
            nt,
            J,
            g
          )) ? (P || typeof u.UNSAFE_componentWillMount != "function" && typeof u.componentWillMount != "function" || (typeof u.componentWillMount == "function" && u.componentWillMount(), typeof u.UNSAFE_componentWillMount == "function" && u.UNSAFE_componentWillMount()), typeof u.componentDidMount == "function" && (e.flags |= 4194308)) : (typeof u.componentDidMount == "function" && (e.flags |= 4194308), e.memoizedProps = r, e.memoizedState = J), u.props = r, u.state = J, u.context = g, r = Y) : (typeof u.componentDidMount == "function" && (e.flags |= 4194308), r = !1);
        } else {
          u = e.stateNode, ui(t, e), g = e.memoizedProps, P = Zn(a, g), u.props = P, W = e.pendingProps, nt = u.context, J = a.contextType, Y = Sa, typeof J == "object" && J !== null && (Y = $t(J)), M = a.getDerivedStateFromProps, (J = typeof M == "function" || typeof u.getSnapshotBeforeUpdate == "function") || typeof u.UNSAFE_componentWillReceiveProps != "function" && typeof u.componentWillReceiveProps != "function" || (g !== W || nt !== Y) && Ac(
            e,
            u,
            r,
            Y
          ), Tn = !1, nt = e.memoizedState, u.state = nt, Xa(e, r, u, c), La();
          var gt = e.memoizedState;
          g !== W || nt !== gt || Tn || t !== null && t.dependencies !== null && Tl(t.dependencies) ? (typeof M == "function" && (Mi(
            e,
            a,
            M,
            r
          ), gt = e.memoizedState), (P = Tn || Mc(
            e,
            a,
            P,
            r,
            nt,
            gt,
            Y
          ) || t !== null && t.dependencies !== null && Tl(t.dependencies)) ? (J || typeof u.UNSAFE_componentWillUpdate != "function" && typeof u.componentWillUpdate != "function" || (typeof u.componentWillUpdate == "function" && u.componentWillUpdate(r, gt, Y), typeof u.UNSAFE_componentWillUpdate == "function" && u.UNSAFE_componentWillUpdate(
            r,
            gt,
            Y
          )), typeof u.componentDidUpdate == "function" && (e.flags |= 4), typeof u.getSnapshotBeforeUpdate == "function" && (e.flags |= 1024)) : (typeof u.componentDidUpdate != "function" || g === t.memoizedProps && nt === t.memoizedState || (e.flags |= 4), typeof u.getSnapshotBeforeUpdate != "function" || g === t.memoizedProps && nt === t.memoizedState || (e.flags |= 1024), e.memoizedProps = r, e.memoizedState = gt), u.props = r, u.state = gt, u.context = Y, r = P) : (typeof u.componentDidUpdate != "function" || g === t.memoizedProps && nt === t.memoizedState || (e.flags |= 4), typeof u.getSnapshotBeforeUpdate != "function" || g === t.memoizedProps && nt === t.memoizedState || (e.flags |= 1024), r = !1);
        }
        return u = r, Zl(t, e), r = (e.flags & 128) !== 0, u || r ? (u = e.stateNode, a = r && typeof a.getDerivedStateFromError != "function" ? null : u.render(), e.flags |= 1, t !== null && r ? (e.child = aa(
          e,
          t.child,
          null,
          c
        ), e.child = aa(
          e,
          null,
          a,
          c
        )) : Pt(t, e, a, c), e.memoizedState = u.state, t = e.child) : t = tn(
          t,
          e,
          c
        ), t;
      }
      function Qc(t, e, a, r) {
        return De(), e.flags |= 256, Pt(t, e, a, r), e.child;
      }
      function Oi(t) {
        return { baseLanes: t, cachePool: Us() };
      }
      function Ri(t, e, a) {
        return t = t !== null ? t.childLanes & ~a : 0, e && (t |= Ee), t;
      }
      function Vc(t, e, a) {
        var r = e.pendingProps, c = !1, u = (e.flags & 128) !== 0, g;
        if ((g = u) || (g = t !== null && t.memoizedState === null ? !1 : (qt.current & 2) !== 0), g && (c = !0, e.flags &= -129), g = (e.flags & 32) !== 0, e.flags &= -33, t === null) {
          if (St) {
            if (c ? yn(e) : xn(), (t = Ot) ? (t = ih(
              t,
              Me
            ), t !== null && (e.memoizedState = {
              dehydrated: t,
              treeContext: En !== null ? { id: Le, overflow: Xe } : null,
              retryLane: 536870912,
              hydrationErrors: null
            }, a = Bu(t), a.return = e, e.child = a, ee = e, Ot = null)) : t = null, t === null) throw ht(e);
            return go(t) ? e.lanes = 32 : e.lanes = 536870912, null;
          }
          var M = r.children;
          return r = r.fallback, c ? (xn(), c = e.mode, M = Jl(
            { mode: "hidden", children: M },
            c
          ), r = Fn(
            r,
            c,
            a,
            null
          ), M.return = e, r.return = e, M.sibling = r, e.child = M, r = e.child, r.memoizedState = Oi(a), r.childLanes = Ri(
            t,
            g,
            a
          ), e.memoizedState = Oo, Wa(null, r)) : (yn(e), Di(e, M));
        }
        var Y = t.memoizedState;
        if (Y !== null && (M = Y.dehydrated, M !== null)) {
          if (u)
            e.flags & 256 ? (yn(e), e.flags &= -257, e = Hi(
              t,
              e,
              a
            )) : e.memoizedState !== null ? (xn(), e.child = t.child, e.flags |= 128, e = null) : (xn(), M = r.fallback, c = e.mode, r = Jl(
              { mode: "visible", children: r.children },
              c
            ), M = Fn(
              M,
              c,
              a,
              null
            ), M.flags |= 2, r.return = e, M.return = e, r.sibling = M, e.child = r, aa(
              e,
              t.child,
              null,
              a
            ), r = e.child, r.memoizedState = Oi(a), r.childLanes = Ri(
              t,
              g,
              a
            ), e.memoizedState = Oo, e = Wa(null, r));
          else if (yn(e), go(M))
            g = Zp(M).digest, r = Error(s(419)), r.stack = "", r.digest = g, Ga({ value: r, source: null, stack: null }), e = Hi(
              t,
              e,
              a
            );
          else if (Gt || fa(
            t,
            e,
            a,
            !1
          ), g = (a & t.childLanes) !== 0, Gt || g) {
            if (g = At, g !== null && (r = _(
              g,
              a
            ), r !== 0 && r !== Y.retryLane))
              throw Y.retryLane = r, Xn(t, r), me(g, t, r), jo;
            ho(M) || tr(), e = Hi(
              t,
              e,
              a
            );
          } else
            ho(M) ? (e.flags |= 192, e.child = t.child, e = null) : (t = Y.treeContext, se && (Ot = eh(
              M
            ), ee = e, St = !0, Nn = null, Me = !1, t !== null && it(e, t)), e = Di(
              e,
              r.children
            ), e.flags |= 4096);
          return e;
        }
        return c ? (xn(), M = r.fallback, c = e.mode, Y = t.child, u = Y.sibling, r = an(Y, {
          mode: "hidden",
          children: r.children
        }), r.subtreeFlags = Y.subtreeFlags & 65011712, u !== null ? M = an(
          u,
          M
        ) : (M = Fn(
          M,
          c,
          a,
          null
        ), M.flags |= 2), M.return = e, r.return = e, r.sibling = M, e.child = r, Wa(null, r), r = e.child, M = t.child.memoizedState, M === null ? M = Oi(a) : (c = M.cachePool, c !== null ? (Y = ln ? Rt._currentValue : Rt._currentValue2, c = c.parent !== Y ? { parent: Y, pool: Y } : c) : c = Us(), M = {
          baseLanes: M.baseLanes | a,
          cachePool: c
        }), r.memoizedState = M, r.childLanes = Ri(
          t,
          g,
          a
        ), e.memoizedState = Oo, Wa(t.child, r)) : (yn(e), a = t.child, t = a.sibling, a = an(a, {
          mode: "visible",
          children: r.children
        }), a.return = e, a.sibling = null, t !== null && (g = e.deletions, g === null ? (e.deletions = [t], e.flags |= 16) : g.push(t)), e.child = a, e.memoizedState = null, a);
      }
      function Di(t, e) {
        return e = Jl(
          { mode: "visible", children: e },
          t.mode
        ), e.return = t, t.child = e;
      }
      function Jl(t, e) {
        return t = i(22, t, null, e), t.lanes = 0, t;
      }
      function Hi(t, e, a) {
        return aa(e, t.child, null, a), t = Di(
          e,
          e.pendingProps.children
        ), t.flags |= 2, e.memoizedState = null, t;
      }
      function Lc(t, e, a) {
        t.lanes |= e;
        var r = t.alternate;
        r !== null && (r.lanes |= e), ai(t.return, e, a);
      }
      function Bi(t, e, a, r, c, u) {
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
      function Xc(t, e, a) {
        var r = e.pendingProps, c = r.revealOrder, u = r.tail;
        r = r.children;
        var g = qt.current, M = (g & 2) !== 0;
        if (M ? (g = g & 1 | 2, e.flags |= 128) : g &= 1, N(qt, g), Pt(t, e, r, a), r = St ? il : 0, !M && t !== null && (t.flags & 128) !== 0)
          t: for (t = e.child; t !== null; ) {
            if (t.tag === 13)
              t.memoizedState !== null && Lc(t, a, e);
            else if (t.tag === 19)
              Lc(t, a, e);
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
              t = a.alternate, t !== null && Ul(t) === null && (c = a), a = a.sibling;
            a = c, a === null ? (c = e.child, e.child = null) : (c = a.sibling, a.sibling = null), Bi(
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
              if (t = c.alternate, t !== null && Ul(t) === null) {
                e.child = c;
                break;
              }
              t = c.sibling, c.sibling = a, a = c, c = t;
            }
            Bi(
              e,
              !0,
              a,
              null,
              u,
              r
            );
            break;
          case "together":
            Bi(
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
      function Ui(t, e) {
        return (t.lanes & e) !== 0 ? !0 : (t = t.dependencies, !!(t !== null && Tl(t)));
      }
      function qm(t, e, a) {
        switch (e.tag) {
          case 3:
            ot(
              e,
              e.stateNode.containerInfo
            ), gn(e, Rt, t.memoizedState.cache), De();
            break;
          case 27:
          case 5:
            kt(e);
            break;
          case 4:
            ot(
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
              return e.flags |= 128, pi(e), null;
            break;
          case 13:
            var r = e.memoizedState;
            if (r !== null)
              return r.dehydrated !== null ? (yn(e), e.flags |= 128, null) : (a & e.child.childLanes) !== 0 ? Vc(
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
                return Xc(
                  t,
                  e,
                  a
                );
              e.flags |= 128;
            }
            if (c = e.memoizedState, c !== null && (c.rendering = null, c.tail = null, c.lastEffect = null), N(qt, qt.current), r) break;
            return null;
          case 22:
            return e.lanes = 0, Uc(
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
      function Zc(t, e, a) {
        if (t !== null)
          if (t.memoizedProps !== e.pendingProps)
            Gt = !0;
          else {
            if (!Ui(t, a) && (e.flags & 128) === 0)
              return Gt = !1, qm(
                t,
                e,
                a
              );
            Gt = (t.flags & 131072) !== 0;
          }
        else
          Gt = !1, St && (e.flags & 1048576) !== 0 && C(e, il, e.index);
        switch (e.lanes = 0, e.tag) {
          case 16:
            t: {
              var r = e.pendingProps;
              if (t = Ln(e.elementType), e.type = t, typeof t == "function")
                eo(t) ? (r = Zn(t, r), e.tag = 1, e = Kc(
                  null,
                  e,
                  t,
                  r,
                  a
                )) : (e.tag = 0, e = ji(
                  null,
                  e,
                  t,
                  r,
                  a
                ));
              else {
                if (t != null) {
                  var c = t.$$typeof;
                  if (c === oo) {
                    e.tag = 11, e = Dc(
                      null,
                      e,
                      t,
                      r,
                      a
                    );
                    break t;
                  } else if (c === uo) {
                    e.tag = 14, e = Hc(
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
            return ji(
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
            ), Kc(
              t,
              e,
              r,
              c,
              a
            );
          case 3:
            t: {
              if (ot(
                e,
                e.stateNode.containerInfo
              ), t === null) throw Error(s(387));
              var u = e.pendingProps;
              c = e.memoizedState, r = c.element, ui(t, e), Xa(e, u, null, a);
              var g = e.memoizedState;
              if (u = g.cache, gn(e, Rt, u), u !== c.cache && li(
                e,
                [Rt],
                a,
                !0
              ), La(), u = g.element, se && c.isDehydrated)
                if (c = {
                  element: u,
                  isDehydrated: !1,
                  cache: g.cache
                }, e.updateQueue.baseState = c, e.memoizedState = c, e.flags & 256) {
                  e = Qc(
                    t,
                    e,
                    u,
                    a
                  );
                  break t;
                } else if (u !== r) {
                  r = K(
                    Error(s(424)),
                    e
                  ), Ga(r), e = Qc(
                    t,
                    e,
                    u,
                    a
                  );
                  break t;
                } else
                  for (se && (Ot = Pp(
                    e.stateNode.containerInfo
                  ), ee = e, St = !0, Nn = null, Me = !0), a = xd(
                    e,
                    null,
                    u,
                    a
                  ), e.child = a; a; )
                    a.flags = a.flags & -3 | 4096, a = a.sibling;
              else {
                if (De(), u === r) {
                  e = tn(
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
            if (qe)
              return Zl(t, e), t === null ? (a = id(
                e.type,
                null,
                e.pendingProps,
                null
              )) ? e.memoizedState = a : St || (e.stateNode = zh(
                e.type,
                e.pendingProps,
                zn.current,
                e
              )) : e.memoizedState = id(
                e.type,
                t.memoizedProps,
                e.pendingProps,
                t.memoizedState
              ), null;
          case 27:
            if (Lt)
              return kt(e), t === null && Lt && St && (r = e.stateNode = fd(
                e.type,
                e.pendingProps,
                zn.current,
                te.current,
                !1
              ), ee = e, Me = !0, Ot = nh(
                e.type,
                r,
                Ot
              )), Pt(
                t,
                e,
                e.pendingProps.children,
                a
              ), Zl(t, e), t === null && (e.flags |= 4194304), e.child;
          case 5:
            return t === null && St && (Sh(
              e.type,
              e.pendingProps,
              te.current
            ), (c = r = Ot) && (r = ah(
              r,
              e.type,
              e.pendingProps,
              Me
            ), r !== null ? (e.stateNode = r, ee = e, Ot = $p(r), Me = !1, c = !0) : c = !1), c || ht(e)), kt(e), c = e.type, u = e.pendingProps, g = t !== null ? t.memoizedProps : null, r = u.children, rr(c, u) ? r = null : g !== null && rr(c, g) && (e.flags |= 32), e.memoizedState !== null && (c = gi(
              t,
              e,
              Am,
              null,
              null,
              a
            ), ln ? $n._currentValue = c : $n._currentValue2 = c), Zl(t, e), Pt(t, e, r, a), e.child;
          case 6:
            return t === null && St && (kh(
              e.pendingProps,
              te.current
            ), (t = a = Ot) && (a = lh(
              a,
              e.pendingProps,
              Me
            ), a !== null ? (e.stateNode = a, ee = e, Ot = null, t = !0) : t = !1), t || ht(e)), null;
          case 13:
            return Vc(t, e, a);
          case 4:
            return ot(
              e,
              e.stateNode.containerInfo
            ), r = e.pendingProps, t === null ? e.child = aa(
              e,
              null,
              r,
              a
            ) : Pt(t, e, r, a), e.child;
          case 11:
            return Dc(
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
            return r = e.pendingProps, gn(e, e.type, r.value), Pt(
              t,
              e,
              r.children,
              a
            ), e.child;
          case 9:
            return c = e.type._context, r = e.pendingProps.children, Vn(e), c = $t(c), r = r(c), e.flags |= 1, Pt(t, e, r, a), e.child;
          case 14:
            return Hc(
              t,
              e,
              e.type,
              e.pendingProps,
              a
            );
          case 15:
            return Bc(
              t,
              e,
              e.type,
              e.pendingProps,
              a
            );
          case 19:
            return Xc(
              t,
              e,
              a
            );
          case 31:
            return Um(t, e, a);
          case 22:
            return Uc(
              t,
              e,
              a,
              e.pendingProps
            );
          case 24:
            return Vn(e), r = $t(Rt), t === null ? (c = oi(), c === null && (c = At, u = ri(), c.pooledCache = u, u.refCount++, u !== null && (c.pooledCacheLanes |= a), c = u), e.memoizedState = {
              parent: r,
              cache: c
            }, ci(e), gn(e, Rt, c)) : ((t.lanes & a) !== 0 && (ui(t, e), Xa(e, null, null, a), La()), c = t.memoizedState, u = e.memoizedState, c.parent !== r ? (c = { parent: r, cache: r }, e.memoizedState = c, e.lanes === 0 && (e.memoizedState = e.updateQueue.baseState = c), gn(e, Rt, r)) : (r = u.cache, gn(e, Rt, r), r !== c.cache && li(
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
      function Wl(t) {
        Ve && (t.flags |= 8);
      }
      function Jc(t, e) {
        if (t !== null && t.child === e.child) return !1;
        if ((e.flags & 16) !== 0) return !0;
        for (t = e.child; t !== null; ) {
          if ((t.flags & 8218) !== 0 || (t.subtreeFlags & 8218) !== 0)
            return !0;
          t = t.sibling;
        }
        return !1;
      }
      function qi(t, e, a, r) {
        if (oe)
          for (a = e.child; a !== null; ) {
            if (a.tag === 5 || a.tag === 6)
              mo(t, a.stateNode);
            else if (!(a.tag === 4 || Lt && a.tag === 27) && a.child !== null) {
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
        else if (Ve)
          for (var c = e.child; c !== null; ) {
            if (c.tag === 5) {
              var u = c.stateNode;
              a && r && (u = ed(
                u,
                c.type,
                c.memoizedProps
              )), mo(t, u);
            } else if (c.tag === 6)
              u = c.stateNode, a && r && (u = nd(
                u,
                c.memoizedProps
              )), mo(t, u);
            else if (c.tag !== 4) {
              if (c.tag === 22 && c.memoizedState !== null)
                u = c.child, u !== null && (u.return = c), qi(t, c, !0, !0);
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
      function Wc(t, e, a, r) {
        var c = !1;
        if (Ve)
          for (var u = e.child; u !== null; ) {
            if (u.tag === 5) {
              var g = u.stateNode;
              a && r && (g = ed(
                g,
                u.type,
                u.memoizedProps
              )), Pu(t, g);
            } else if (u.tag === 6)
              g = u.stateNode, a && r && (g = nd(
                g,
                u.memoizedProps
              )), Pu(t, g);
            else if (u.tag !== 4) {
              if (u.tag === 22 && u.memoizedState !== null)
                c = u.child, c !== null && (c.return = u), Wc(t, u, !0, !0), c = !0;
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
      function Fc(t, e) {
        if (Ve && Jc(t, e)) {
          t = e.stateNode;
          var a = t.containerInfo, r = $u();
          Wc(r, e, !1, !1), t.pendingChildren = r, He(e), Xp(a, r);
        }
      }
      function Yi(t, e, a, r) {
        if (oe)
          t.memoizedProps !== r && He(e);
        else if (Ve) {
          var c = t.stateNode, u = t.memoizedProps;
          if ((t = Jc(t, e)) || u !== r) {
            var g = te.current;
            u = Lp(
              c,
              a,
              u,
              r,
              !t,
              null
            ), u === c ? e.stateNode = c : (Wl(e), Zu(
              u,
              a,
              r,
              g
            ) && He(e), e.stateNode = u, t && qi(u, e, !1, !1));
          } else e.stateNode = c;
        }
      }
      function Gi(t, e, a, r, c) {
        if ((t.mode & 32) !== 0 && (a === null ? vp(e, r) : yp(e, a, r))) {
          if (t.flags |= 16777216, (c & 335544128) === c || po(e, r))
            if (Wu(t.stateNode, e, r))
              t.flags |= 8192;
            else if (_u()) t.flags |= 8192;
            else
              throw na = gr, No;
        } else t.flags &= -16777217;
      }
      function Ic(t, e) {
        if (Th(e)) {
          if (t.flags |= 16777216, !dd(e))
            if (_u()) t.flags |= 8192;
            else
              throw na = gr, No;
        } else t.flags &= -16777217;
      }
      function Fl(t, e) {
        e !== null && (t.flags |= 4), t.flags & 16384 && (e = t.tag !== 22 ? L() : 536870912, t.lanes |= e, Ba |= e);
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
      function Ym(t, e, a) {
        var r = e.pendingProps;
        switch (et(e), e.tag) {
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
            return a = e.stateNode, r = null, t !== null && (r = t.memoizedState.cache), e.memoizedState.cache !== r && (e.flags |= 2048), $e(Rt), st(), a.pendingContext && (a.context = a.pendingContext, a.pendingContext = null), (t === null || t.child === null) && (Re(e) ? He(e) : t === null || t.memoizedState.isDehydrated && (e.flags & 256) === 0 || (e.flags |= 1024, hn())), Fc(t, e), jt(e), null;
          case 26:
            if (qe) {
              var c = e.type, u = e.memoizedState;
              return t === null ? (He(e), u !== null ? (jt(e), Ic(
                e,
                u
              )) : (jt(e), Gi(
                e,
                c,
                null,
                r,
                a
              ))) : u ? u !== t.memoizedState ? (He(e), jt(e), Ic(
                e,
                u
              )) : (jt(e), e.flags &= -16777217) : (u = t.memoizedProps, oe ? u !== r && He(e) : Yi(
                t,
                e,
                c,
                r
              ), jt(e), Gi(
                e,
                c,
                u,
                r,
                a
              )), null;
            }
          case 27:
            if (Lt) {
              if (Jt(e), a = zn.current, c = e.type, t !== null && e.stateNode != null)
                oe ? t.memoizedProps !== r && He(e) : Yi(t, e, c, r);
              else {
                if (!r) {
                  if (e.stateNode === null)
                    throw Error(s(166));
                  return jt(e), null;
                }
                t = te.current, Re(e) ? Kn(e, t) : (t = fd(
                  c,
                  r,
                  a,
                  t,
                  !0
                ), e.stateNode = t, He(e));
              }
              return jt(e), null;
            }
          case 5:
            if (Jt(e), c = e.type, t !== null && e.stateNode != null)
              Yi(t, e, c, r);
            else {
              if (!r) {
                if (e.stateNode === null)
                  throw Error(s(166));
                return jt(e), null;
              }
              if (u = te.current, Re(e))
                Kn(e, u), bh(
                  e.stateNode,
                  c,
                  r,
                  u
                ) && (e.flags |= 64);
              else {
                var g = up(
                  c,
                  r,
                  zn.current,
                  u,
                  e
                );
                Wl(e), qi(g, e, !1, !1), e.stateNode = g, Zu(
                  g,
                  c,
                  r,
                  u
                ) && He(e);
              }
            }
            return jt(e), Gi(
              e,
              e.type,
              t === null ? null : t.memoizedProps,
              e.pendingProps,
              a
            ), null;
          case 6:
            if (t && e.stateNode != null)
              a = t.memoizedProps, oe ? a !== r && He(e) : Ve && (a !== r ? (t = zn.current, a = te.current, Wl(e), e.stateNode = Ju(
                r,
                t,
                a,
                e
              )) : e.stateNode = t.stateNode);
            else {
              if (typeof r != "string" && e.stateNode === null)
                throw Error(s(166));
              if (t = zn.current, a = te.current, Re(e)) {
                if (!se) throw Error(s(176));
                if (t = e.stateNode, a = e.memoizedProps, r = null, c = ee, c !== null)
                  switch (c.tag) {
                    case 27:
                    case 5:
                      r = c.memoizedProps;
                  }
                sh(
                  t,
                  a,
                  e,
                  r
                ) || ht(e, !0);
              } else
                Wl(e), e.stateNode = Ju(
                  r,
                  t,
                  a,
                  e
                );
            }
            return jt(e), null;
          case 31:
            if (a = e.memoizedState, t === null || t.memoizedState !== null) {
              if (r = Re(e), a !== null) {
                if (t === null) {
                  if (!r) throw Error(s(318));
                  if (!se) throw Error(s(556));
                  if (t = e.memoizedState, t = t !== null ? t.dehydrated : null, !t) throw Error(s(557));
                  ch(t, e);
                } else
                  De(), (e.flags & 128) === 0 && (e.memoizedState = null), e.flags |= 4;
                jt(e), t = !1;
              } else
                a = hn(), t !== null && t.memoizedState !== null && (t.memoizedState.hydrationErrors = a), t = !0;
              if (!t)
                return e.flags & 256 ? (be(e), e) : (be(e), null);
              if ((e.flags & 128) !== 0)
                throw Error(s(558));
            }
            return jt(e), null;
          case 13:
            if (r = e.memoizedState, t === null || t.memoizedState !== null && t.memoizedState.dehydrated !== null) {
              if (c = Re(e), r !== null && r.dehydrated !== null) {
                if (t === null) {
                  if (!c) throw Error(s(318));
                  if (!se) throw Error(s(344));
                  if (c = e.memoizedState, c = c !== null ? c.dehydrated : null, !c) throw Error(s(317));
                  uh(c, e);
                } else
                  De(), (e.flags & 128) === 0 && (e.memoizedState = null), e.flags |= 4;
                jt(e), c = !1;
              } else
                c = hn(), t !== null && t.memoizedState !== null && (t.memoizedState.hydrationErrors = c), c = !0;
              if (!c)
                return e.flags & 256 ? (be(e), e) : (be(e), null);
            }
            return be(e), (e.flags & 128) !== 0 ? (e.lanes = a, e) : (a = r !== null, t = t !== null && t.memoizedState !== null, a && (r = e.child, c = null, r.alternate !== null && r.alternate.memoizedState !== null && r.alternate.memoizedState.cachePool !== null && (c = r.alternate.memoizedState.cachePool.pool), u = null, r.memoizedState !== null && r.memoizedState.cachePool !== null && (u = r.memoizedState.cachePool.pool), u !== c && (r.flags |= 2048)), a !== t && a && (e.child.flags |= 8192), Fl(e, e.updateQueue), jt(e), null);
          case 4:
            return st(), Fc(t, e), t === null && pp(e.stateNode.containerInfo), jt(e), null;
          case 10:
            return $e(e.type), jt(e), null;
          case 19:
            if (z(qt), r = e.memoizedState, r === null) return jt(e), null;
            if (c = (e.flags & 128) !== 0, u = r.rendering, u === null)
              if (c) Fa(r, !1);
              else {
                if (Bt !== 0 || t !== null && (t.flags & 128) !== 0)
                  for (t = e.child; t !== null; ) {
                    if (u = Ul(t), u !== null) {
                      for (e.flags |= 128, Fa(r, !1), t = u.updateQueue, e.updateQueue = t, Fl(e, t), e.subtreeFlags = 0, t = a, a = e.child; a !== null; )
                        Hu(a, t), a = a.sibling;
                      return N(
                        qt,
                        qt.current & 1 | 2
                      ), St && V(e, r.treeForkCount), e.child;
                    }
                    t = t.sibling;
                  }
                r.tail !== null && pe() > pl && (e.flags |= 128, c = !0, Fa(r, !1), e.lanes = 4194304);
              }
            else {
              if (!c)
                if (t = Ul(u), t !== null) {
                  if (e.flags |= 128, c = !0, t = t.updateQueue, e.updateQueue = t, Fl(e, t), Fa(r, !0), r.tail === null && r.tailMode === "hidden" && !u.alternate && !St)
                    return jt(e), null;
                } else
                  2 * pe() - r.renderingStartTime > pl && a !== 536870912 && (e.flags |= 128, c = !0, Fa(r, !1), e.lanes = 4194304);
              r.isBackwards ? (u.sibling = e.child, e.child = u) : (t = r.last, t !== null ? t.sibling = u : e.child = u, r.last = u);
            }
            return r.tail !== null ? (t = r.tail, r.rendering = t, r.tail = t.sibling, r.renderingStartTime = pe(), t.sibling = null, a = qt.current, N(
              qt,
              c ? a & 1 | 2 : a & 1
            ), St && V(e, r.treeForkCount), t) : (jt(e), null);
          case 22:
          case 23:
            return be(e), mi(), r = e.memoizedState !== null, t !== null ? t.memoizedState !== null !== r && (e.flags |= 8192) : r && (e.flags |= 8192), r ? (a & 536870912) !== 0 && (e.flags & 128) === 0 && (jt(e), e.subtreeFlags & 6 && (e.flags |= 8192)) : jt(e), a = e.updateQueue, a !== null && Fl(e, a.retryQueue), a = null, t !== null && t.memoizedState !== null && t.memoizedState.cachePool !== null && (a = t.memoizedState.cachePool.pool), r = null, e.memoizedState !== null && e.memoizedState.cachePool !== null && (r = e.memoizedState.cachePool.pool), r !== a && (e.flags |= 2048), t !== null && z(ea), null;
          case 24:
            return a = null, t !== null && (a = t.memoizedState.cache), e.memoizedState.cache !== a && (e.flags |= 2048), $e(Rt), jt(e), null;
          case 25:
            return null;
          case 30:
            return null;
        }
        throw Error(s(156, e.tag));
      }
      function Gm(t, e) {
        switch (et(e), e.tag) {
          case 1:
            return t = e.flags, t & 65536 ? (e.flags = t & -65537 | 128, e) : null;
          case 3:
            return $e(Rt), st(), t = e.flags, (t & 65536) !== 0 && (t & 128) === 0 ? (e.flags = t & -65537 | 128, e) : null;
          case 26:
          case 27:
          case 5:
            return Jt(e), null;
          case 31:
            if (e.memoizedState !== null) {
              if (be(e), e.alternate === null)
                throw Error(s(340));
              De();
            }
            return t = e.flags, t & 65536 ? (e.flags = t & -65537 | 128, e) : null;
          case 13:
            if (be(e), t = e.memoizedState, t !== null && t.dehydrated !== null) {
              if (e.alternate === null)
                throw Error(s(340));
              De();
            }
            return t = e.flags, t & 65536 ? (e.flags = t & -65537 | 128, e) : null;
          case 19:
            return z(qt), null;
          case 4:
            return st(), null;
          case 10:
            return $e(e.type), null;
          case 22:
          case 23:
            return be(e), mi(), t !== null && z(ea), t = e.flags, t & 65536 ? (e.flags = t & -65537 | 128, e) : null;
          case 24:
            return $e(Rt), null;
          case 25:
            return null;
          default:
            return null;
        }
      }
      function $c(t, e) {
        switch (et(e), e.tag) {
          case 3:
            $e(Rt), st();
            break;
          case 26:
          case 27:
          case 5:
            Jt(e);
            break;
          case 4:
            st();
            break;
          case 31:
            e.memoizedState !== null && be(e);
            break;
          case 13:
            be(e);
            break;
          case 19:
            z(qt);
            break;
          case 10:
            $e(e.type);
            break;
          case 22:
          case 23:
            be(e), mi(), t !== null && z(ea);
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
        } catch (M) {
          Et(e, e.return, M);
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
                  var Y = a, J = M;
                  try {
                    J();
                  } catch (P) {
                    Et(
                      c,
                      Y,
                      P
                    );
                  }
                }
              }
              r = r.next;
            } while (r !== u);
          }
        } catch (P) {
          Et(e, e.return, P);
        }
      }
      function Pc(t) {
        var e = t.updateQueue;
        if (e !== null) {
          var a = t.stateNode;
          try {
            Xs(e, a);
          } catch (r) {
            Et(t, t.return, r);
          }
        }
      }
      function tu(t, e, a) {
        a.props = Zn(
          t.type,
          t.memoizedProps
        ), a.state = t.memoizedState;
        try {
          a.componentWillUnmount();
        } catch (r) {
          Et(t, e, r);
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
          Et(t, e, c);
        }
      }
      function Qe(t, e) {
        var a = t.ref, r = t.refCleanup;
        if (a !== null)
          if (typeof r == "function")
            try {
              r();
            } catch (c) {
              Et(t, e, c);
            } finally {
              t.refCleanup = null, t = t.alternate, t != null && (t.refCleanup = null);
            }
          else if (typeof a == "function")
            try {
              a(null);
            } catch (c) {
              Et(t, e, c);
            }
          else a.current = null;
      }
      function eu(t) {
        var e = t.type, a = t.memoizedProps, r = t.stateNode;
        try {
          Rp(r, e, a, t);
        } catch (c) {
          Et(t, t.return, c);
        }
      }
      function Ki(t, e, a) {
        try {
          Dp(
            t.stateNode,
            t.type,
            a,
            e,
            t
          );
        } catch (r) {
          Et(t, t.return, r);
        }
      }
      function nu(t) {
        return t.tag === 5 || t.tag === 3 || (qe ? t.tag === 26 : !1) || (Lt ? t.tag === 27 && wa(t.type) : !1) || t.tag === 4;
      }
      function Qi(t) {
        t: for (; ; ) {
          for (; t.sibling === null; ) {
            if (t.return === null || nu(t.return)) return null;
            t = t.return;
          }
          for (t.sibling.return = t.return, t = t.sibling; t.tag !== 5 && t.tag !== 6 && t.tag !== 18; ) {
            if (Lt && t.tag === 27 && wa(t.type) || t.flags & 2 || t.child === null || t.tag === 4) continue t;
            t.child.return = t, t = t.child;
          }
          if (!(t.flags & 2)) return t.stateNode;
        }
      }
      function Vi(t, e, a) {
        var r = t.tag;
        if (r === 5 || r === 6)
          t = t.stateNode, e ? Bp(a, t, e) : jp(a, t);
        else if (r !== 4 && (Lt && r === 27 && wa(t.type) && (a = t.stateNode, e = null), t = t.child, t !== null))
          for (Vi(t, e, a), t = t.sibling; t !== null; )
            Vi(t, e, a), t = t.sibling;
      }
      function Il(t, e, a) {
        var r = t.tag;
        if (r === 5 || r === 6)
          t = t.stateNode, e ? Hp(a, t, e) : Ap(a, t);
        else if (r !== 4 && (Lt && r === 27 && wa(t.type) && (a = t.stateNode), t = t.child, t !== null))
          for (Il(t, e, a), t = t.sibling; t !== null; )
            Il(t, e, a), t = t.sibling;
      }
      function au(t, e, a) {
        t = t.containerInfo;
        try {
          td(t, a);
        } catch (r) {
          Et(e, e.return, r);
        }
      }
      function lu(t) {
        var e = t.stateNode, a = t.memoizedProps;
        try {
          Mh(
            t.type,
            a,
            e,
            t
          );
        } catch (r) {
          Et(t, t.return, r);
        }
      }
      function Km(t, e) {
        for (sp(t.containerInfo), Ft = e; Ft !== null; )
          if (t = Ft, e = t.child, (t.subtreeFlags & 1028) !== 0 && e !== null)
            e.return = t, Ft = e;
          else
            for (; Ft !== null; ) {
              t = Ft;
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
                    } catch (M) {
                      Et(r, r.return, M);
                    }
                  }
                  break;
                case 3:
                  (e & 1024) !== 0 && oe && Vp(t.stateNode.containerInfo);
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
                e.return = t.return, Ft = e;
                break;
              }
              Ft = t.return;
            }
      }
      function ru(t, e, a) {
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
                  Et(a, a.return, g);
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
                  Et(
                    a,
                    a.return,
                    g
                  );
                }
              }
            r & 64 && Pc(a), r & 512 && $a(a, a.return);
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
                Xs(r, t);
              } catch (g) {
                Et(a, a.return, g);
              }
            }
            break;
          case 27:
            Lt && e === null && r & 4 && lu(a);
          case 26:
          case 5:
            if (en(t, a), e === null) {
              if (r & 4) eu(a);
              else if (r & 64) {
                t = a.type, e = a.memoizedProps, c = a.stateNode;
                try {
                  mh(
                    c,
                    t,
                    e,
                    a
                  );
                } catch (g) {
                  Et(a, a.return, g);
                }
              }
            }
            r & 512 && $a(a, a.return);
            break;
          case 12:
            en(t, a);
            break;
          case 31:
            en(t, a), r & 4 && ou(t, a);
            break;
          case 13:
            en(t, a), r & 4 && su(t, a), r & 64 && (r = a.memoizedState, r !== null && (r = r.dehydrated, r !== null && (a = Wm.bind(
              null,
              a
            ), Jp(r, a))));
            break;
          case 22:
            if (r = a.memoizedState !== null || cn, !r) {
              e = e !== null && e.memoizedState !== null || Kt, c = cn;
              var u = Kt;
              cn = r, (Kt = e) && !u ? nn(
                t,
                a,
                (a.subtreeFlags & 8772) !== 0
              ) : en(t, a), cn = c, Kt = u;
            }
            break;
          case 30:
            break;
          default:
            en(t, a);
        }
      }
      function iu(t) {
        var e = t.alternate;
        e !== null && (t.alternate = null, iu(e)), t.child = null, t.deletions = null, t.sibling = null, t.tag === 5 && (e = t.stateNode, e !== null && bp(e)), t.stateNode = null, t.return = null, t.dependencies = null, t.memoizedProps = null, t.memoizedState = null, t.pendingProps = null, t.stateNode = null, t.updateQueue = null;
      }
      function Be(t, e, a) {
        for (a = a.child; a !== null; )
          Li(
            t,
            e,
            a
          ), a = a.sibling;
      }
      function Li(t, e, a) {
        if (we && typeof we.onCommitFiberUnmount == "function")
          try {
            we.onCommitFiberUnmount(rl, a);
          } catch {
          }
        switch (a.tag) {
          case 26:
            if (qe) {
              Kt || Qe(a, e), Be(
                t,
                e,
                a
              ), a.memoizedState ? sd(a.memoizedState) : a.stateNode && ud(a.stateNode);
              break;
            }
          case 27:
            if (Lt) {
              Kt || Qe(a, e);
              var r = Qt, c = he;
              wa(a.type) && (Qt = a.stateNode, he = !1), Be(
                t,
                e,
                a
              ), md(a.stateNode), Qt = r, he = c;
              break;
            }
          case 5:
            Kt || Qe(a, e);
          case 6:
            if (oe) {
              if (r = Qt, c = he, Qt = null, Be(
                t,
                e,
                a
              ), Qt = r, he = c, Qt !== null)
                if (he)
                  try {
                    qp(Qt, a.stateNode);
                  } catch (u) {
                    Et(
                      a,
                      e,
                      u
                    );
                  }
                else
                  try {
                    Up(Qt, a.stateNode);
                  } catch (u) {
                    Et(
                      a,
                      e,
                      u
                    );
                  }
            } else
              Be(
                t,
                e,
                a
              );
            break;
          case 18:
            oe && Qt !== null && (he ? xh(
              Qt,
              a.stateNode
            ) : yh(Qt, a.stateNode));
            break;
          case 4:
            oe ? (r = Qt, c = he, Qt = a.stateNode.containerInfo, he = !0, Be(
              t,
              e,
              a
            ), Qt = r, he = c) : (Ve && au(
              a.stateNode,
              a,
              $u()
            ), Be(
              t,
              e,
              a
            ));
            break;
          case 0:
          case 11:
          case 14:
          case 15:
            wn(2, a, e), Kt || wn(4, a, e), Be(
              t,
              e,
              a
            );
            break;
          case 1:
            Kt || (Qe(a, e), r = a.stateNode, typeof r.componentWillUnmount == "function" && tu(
              a,
              e,
              r
            )), Be(
              t,
              e,
              a
            );
            break;
          case 21:
            Be(
              t,
              e,
              a
            );
            break;
          case 22:
            Kt = (r = Kt) || a.memoizedState !== null, Be(
              t,
              e,
              a
            ), Kt = r;
            break;
          default:
            Be(
              t,
              e,
              a
            );
        }
      }
      function ou(t, e) {
        if (se && e.memoizedState === null && (t = e.alternate, t !== null && (t = t.memoizedState, t !== null))) {
          t = t.dehydrated;
          try {
            hh(t);
          } catch (a) {
            Et(e, e.return, a);
          }
        }
      }
      function su(t, e) {
        if (se && e.memoizedState === null && (t = e.alternate, t !== null && (t = t.memoizedState, t !== null && (t = t.dehydrated, t !== null))))
          try {
            gh(t);
          } catch (a) {
            Et(e, e.return, a);
          }
      }
      function Qm(t) {
        switch (t.tag) {
          case 31:
          case 13:
          case 19:
            var e = t.stateNode;
            return e === null && (e = t.stateNode = new Sd()), e;
          case 22:
            return t = t.stateNode, e = t._retryCache, e === null && (e = t._retryCache = new Sd()), e;
          default:
            throw Error(s(435, t.tag));
        }
      }
      function $l(t, e) {
        var a = Qm(t);
        e.forEach(function(r) {
          if (!a.has(r)) {
            a.add(r);
            var c = Fm.bind(null, t, r);
            r.then(c, c);
          }
        });
      }
      function ie(t, e) {
        var a = e.deletions;
        if (a !== null)
          for (var r = 0; r < a.length; r++) {
            var c = a[r], u = t, g = e;
            if (oe) {
              var M = g;
              t: for (; M !== null; ) {
                switch (M.tag) {
                  case 27:
                    if (Lt) {
                      if (wa(M.type)) {
                        Qt = M.stateNode, he = !1;
                        break t;
                      }
                      break;
                    }
                  case 5:
                    Qt = M.stateNode, he = !1;
                    break t;
                  case 3:
                  case 4:
                    Qt = M.stateNode.containerInfo, he = !0;
                    break t;
                }
                M = M.return;
              }
              if (Qt === null) throw Error(s(160));
              Li(u, g, c), Qt = null, he = !1;
            } else Li(u, g, c);
            u = c.alternate, u !== null && (u.return = null), c.return = null;
          }
        if (e.subtreeFlags & 13886)
          for (e = e.child; e !== null; )
            cu(e, t), e = e.sibling;
      }
      function cu(t, e) {
        var a = t.alternate, r = t.flags;
        switch (t.tag) {
          case 0:
          case 11:
          case 14:
          case 15:
            ie(e, t), fe(t), r & 4 && (wn(3, t, t.return), Ia(3, t), wn(5, t, t.return));
            break;
          case 1:
            ie(e, t), fe(t), r & 512 && (Kt || a === null || Qe(a, a.return)), r & 64 && cn && (t = t.updateQueue, t !== null && (r = t.callbacks, r !== null && (a = t.shared.hiddenCallbacks, t.shared.hiddenCallbacks = a === null ? r : a.concat(r))));
            break;
          case 26:
            if (qe) {
              var c = Ye;
              if (ie(e, t), fe(t), r & 512 && (Kt || a === null || Qe(a, a.return)), r & 4) {
                r = a !== null ? a.memoizedState : null;
                var u = t.memoizedState;
                a === null ? u === null ? t.stateNode === null ? t.stateNode = Eh(
                  c,
                  t.type,
                  t.memoizedProps,
                  t
                ) : cd(
                  c,
                  t.type,
                  t.stateNode
                ) : t.stateNode = od(
                  c,
                  u,
                  t.memoizedProps
                ) : r !== u ? (r === null ? a.stateNode !== null && ud(a.stateNode) : sd(r), u === null ? cd(
                  c,
                  t.type,
                  t.stateNode
                ) : od(
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
            if (Lt) {
              ie(e, t), fe(t), r & 512 && (Kt || a === null || Qe(a, a.return)), a !== null && r & 4 && Ki(
                t,
                t.memoizedProps,
                a.memoizedProps
              );
              break;
            }
          case 5:
            if (ie(e, t), fe(t), r & 512 && (Kt || a === null || Qe(a, a.return)), oe) {
              if (t.flags & 32) {
                c = t.stateNode;
                try {
                  Iu(c);
                } catch (W) {
                  Et(t, t.return, W);
                }
              }
              r & 4 && t.stateNode != null && (c = t.memoizedProps, Ki(
                t,
                c,
                a !== null ? a.memoizedProps : c
              )), r & 1024 && (Ro = !0);
            } else
              Ve && t.alternate !== null && (t.alternate.stateNode = t.stateNode);
            break;
          case 6:
            if (ie(e, t), fe(t), r & 4 && oe) {
              if (t.stateNode === null)
                throw Error(s(162));
              r = t.memoizedProps, a = a !== null ? a.memoizedProps : r, c = t.stateNode;
              try {
                Op(c, a, r);
              } catch (W) {
                Et(t, t.return, W);
              }
            }
            break;
          case 3:
            if (qe ? (Nh(), c = Ye, Ye = bo(e.containerInfo), ie(e, t), Ye = c) : ie(e, t), fe(t), r & 4) {
              if (oe && se && a !== null && a.memoizedState.isDehydrated)
                try {
                  ph(e.containerInfo);
                } catch (W) {
                  Et(t, t.return, W);
                }
              if (Ve) {
                r = e.containerInfo, a = e.pendingChildren;
                try {
                  td(r, a);
                } catch (W) {
                  Et(t, t.return, W);
                }
              }
            }
            Ro && (Ro = !1, uu(t));
            break;
          case 4:
            qe ? (a = Ye, Ye = bo(
              t.stateNode.containerInfo
            ), ie(e, t), fe(t), Ye = a) : (ie(e, t), fe(t)), r & 4 && Ve && au(
              t.stateNode,
              t,
              t.stateNode.pendingChildren
            );
            break;
          case 12:
            ie(e, t), fe(t);
            break;
          case 31:
            ie(e, t), fe(t), r & 4 && (r = t.updateQueue, r !== null && (t.updateQueue = null, $l(t, r)));
            break;
          case 13:
            ie(e, t), fe(t), t.child.flags & 8192 && t.memoizedState !== null != (a !== null && a.memoizedState !== null) && (Er = pe()), r & 4 && (r = t.updateQueue, r !== null && (t.updateQueue = null, $l(t, r)));
            break;
          case 22:
            c = t.memoizedState !== null;
            var g = a !== null && a.memoizedState !== null, M = cn, Y = Kt;
            if (cn = M || c, Kt = Y || g, ie(e, t), Kt = Y, cn = M, fe(t), r & 8192 && (e = t.stateNode, e._visibility = c ? e._visibility & -2 : e._visibility | 1, c && (a === null || g || cn || Kt || Jn(t)), oe)) {
              t: if (a = null, oe)
                for (e = t; ; ) {
                  if (e.tag === 5 || qe && e.tag === 26) {
                    if (a === null) {
                      g = a = e;
                      try {
                        u = g.stateNode, c ? Yp(u) : Kp(
                          g.stateNode,
                          g.memoizedProps
                        );
                      } catch (W) {
                        Et(g, g.return, W);
                      }
                    }
                  } else if (e.tag === 6) {
                    if (a === null) {
                      g = e;
                      try {
                        var J = g.stateNode;
                        c ? Gp(J) : Qp(J, g.memoizedProps);
                      } catch (W) {
                        Et(g, g.return, W);
                      }
                    }
                  } else if (e.tag === 18) {
                    if (a === null) {
                      g = e;
                      try {
                        var P = g.stateNode;
                        c ? wh(P) : _h(g.stateNode);
                      } catch (W) {
                        Et(g, g.return, W);
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
            r & 4 && (r = t.updateQueue, r !== null && (a = r.retryQueue, a !== null && (r.retryQueue = null, $l(t, a))));
            break;
          case 19:
            ie(e, t), fe(t), r & 4 && (r = t.updateQueue, r !== null && (t.updateQueue = null, $l(t, r)));
            break;
          case 30:
            break;
          case 21:
            break;
          default:
            ie(e, t), fe(t);
        }
      }
      function fe(t) {
        var e = t.flags;
        if (e & 2) {
          try {
            for (var a, r = t.return; r !== null; ) {
              if (nu(r)) {
                a = r;
                break;
              }
              r = r.return;
            }
            if (oe) {
              if (a == null) throw Error(s(160));
              switch (a.tag) {
                case 27:
                  if (Lt) {
                    var c = a.stateNode, u = Qi(t);
                    Il(t, u, c);
                    break;
                  }
                case 5:
                  var g = a.stateNode;
                  a.flags & 32 && (Iu(g), a.flags &= -33);
                  var M = Qi(t);
                  Il(t, M, g);
                  break;
                case 3:
                case 4:
                  var Y = a.stateNode.containerInfo, J = Qi(t);
                  Vi(
                    t,
                    J,
                    Y
                  );
                  break;
                default:
                  throw Error(s(161));
              }
            }
          } catch (P) {
            Et(t, t.return, P);
          }
          t.flags &= -3;
        }
        e & 4096 && (t.flags &= -4097);
      }
      function uu(t) {
        if (t.subtreeFlags & 1024)
          for (t = t.child; t !== null; ) {
            var e = t;
            uu(e), e.tag === 5 && e.flags & 1024 && _p(e.stateNode), t = t.sibling;
          }
      }
      function en(t, e) {
        if (e.subtreeFlags & 8772)
          for (e = e.child; e !== null; )
            ru(t, e.alternate, e), e = e.sibling;
      }
      function Jn(t) {
        for (t = t.child; t !== null; ) {
          var e = t;
          switch (e.tag) {
            case 0:
            case 11:
            case 14:
            case 15:
              wn(4, e, e.return), Jn(e);
              break;
            case 1:
              Qe(e, e.return);
              var a = e.stateNode;
              typeof a.componentWillUnmount == "function" && tu(
                e,
                e.return,
                a
              ), Jn(e);
              break;
            case 27:
              Lt && md(e.stateNode);
            case 26:
            case 5:
              Qe(e, e.return), Jn(e);
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
                } catch (J) {
                  Et(r, r.return, J);
                }
              if (r = u, c = r.updateQueue, c !== null) {
                var M = r.stateNode;
                try {
                  var Y = c.shared.hiddenCallbacks;
                  if (Y !== null)
                    for (c.shared.hiddenCallbacks = null, c = 0; c < Y.length; c++)
                      Ls(Y[c], M);
                } catch (J) {
                  Et(r, r.return, J);
                }
              }
              a && g & 64 && Pc(u), $a(u, u.return);
              break;
            case 27:
              Lt && lu(u);
            case 26:
            case 5:
              nn(
                c,
                u,
                a
              ), a && r === null && g & 4 && eu(u), $a(u, u.return);
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
              ), a && g & 4 && ou(c, u);
              break;
            case 13:
              nn(
                c,
                u,
                a
              ), a && g & 4 && su(c, u);
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
      function Xi(t, e) {
        var a = null;
        t !== null && t.memoizedState !== null && t.memoizedState.cachePool !== null && (a = t.memoizedState.cachePool.pool), t = null, e.memoizedState !== null && e.memoizedState.cachePool !== null && (t = e.memoizedState.cachePool.pool), t !== a && (t != null && t.refCount++, a != null && Ka(a));
      }
      function Zi(t, e) {
        t = null, e.alternate !== null && (t = e.alternate.memoizedState.cache), e = e.memoizedState.cache, e !== t && (e.refCount++, t != null && Ka(t));
      }
      function Ue(t, e, a, r) {
        if (e.subtreeFlags & 10256)
          for (e = e.child; e !== null; )
            du(
              t,
              e,
              a,
              r
            ), e = e.sibling;
      }
      function du(t, e, a, r) {
        var c = e.flags;
        switch (e.tag) {
          case 0:
          case 11:
          case 15:
            Ue(
              t,
              e,
              a,
              r
            ), c & 2048 && Ia(9, e);
            break;
          case 1:
            Ue(
              t,
              e,
              a,
              r
            );
            break;
          case 3:
            Ue(
              t,
              e,
              a,
              r
            ), c & 2048 && (t = null, e.alternate !== null && (t = e.alternate.memoizedState.cache), e = e.memoizedState.cache, e !== t && (e.refCount++, t != null && Ka(t)));
            break;
          case 12:
            if (c & 2048) {
              Ue(
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
              } catch (Y) {
                Et(e, e.return, Y);
              }
            } else
              Ue(
                t,
                e,
                a,
                r
              );
            break;
          case 31:
            Ue(
              t,
              e,
              a,
              r
            );
            break;
          case 13:
            Ue(
              t,
              e,
              a,
              r
            );
            break;
          case 23:
            break;
          case 22:
            u = e.stateNode, g = e.alternate, e.memoizedState !== null ? u._visibility & 2 ? Ue(
              t,
              e,
              a,
              r
            ) : Pa(
              t,
              e
            ) : u._visibility & 2 ? Ue(
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
            )), c & 2048 && Xi(g, e);
            break;
          case 24:
            Ue(
              t,
              e,
              a,
              r
            ), c & 2048 && Zi(e.alternate, e);
            break;
          default:
            Ue(
              t,
              e,
              a,
              r
            );
        }
      }
      function ha(t, e, a, r, c) {
        for (c = c && ((e.subtreeFlags & 10256) !== 0 || !1), e = e.child; e !== null; ) {
          var u = t, g = e, M = a, Y = r, J = g.flags;
          switch (g.tag) {
            case 0:
            case 11:
            case 15:
              ha(
                u,
                g,
                M,
                Y,
                c
              ), Ia(8, g);
              break;
            case 23:
              break;
            case 22:
              var P = g.stateNode;
              g.memoizedState !== null ? P._visibility & 2 ? ha(
                u,
                g,
                M,
                Y,
                c
              ) : Pa(
                u,
                g
              ) : (P._visibility |= 2, ha(
                u,
                g,
                M,
                Y,
                c
              )), c && J & 2048 && Xi(
                g.alternate,
                g
              );
              break;
            case 24:
              ha(
                u,
                g,
                M,
                Y,
                c
              ), c && J & 2048 && Zi(g.alternate, g);
              break;
            default:
              ha(
                u,
                g,
                M,
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
                Pa(a, r), c & 2048 && Xi(
                  r.alternate,
                  r
                );
                break;
              case 24:
                Pa(a, r), c & 2048 && Zi(
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
      function Wn(t, e, a) {
        if (t.subtreeFlags & Da)
          for (t = t.child; t !== null; )
            fu(
              t,
              e,
              a
            ), t = t.sibling;
      }
      function fu(t, e, a) {
        switch (t.tag) {
          case 26:
            if (Wn(
              t,
              e,
              a
            ), t.flags & Da)
              if (t.memoizedState !== null)
                Ch(
                  a,
                  Ye,
                  t.memoizedState,
                  t.memoizedProps
                );
              else {
                var r = t.stateNode, c = t.type;
                t = t.memoizedProps, ((e & 335544128) === e || po(c, t)) && Fu(a, r, c, t);
              }
            break;
          case 5:
            Wn(
              t,
              e,
              a
            ), t.flags & Da && (r = t.stateNode, c = t.type, t = t.memoizedProps, ((e & 335544128) === e || po(c, t)) && Fu(a, r, c, t));
            break;
          case 3:
          case 4:
            qe ? (r = Ye, Ye = bo(
              t.stateNode.containerInfo
            ), Wn(
              t,
              e,
              a
            ), Ye = r) : Wn(
              t,
              e,
              a
            );
            break;
          case 22:
            t.memoizedState === null && (r = t.alternate, r !== null && r.memoizedState !== null ? (r = Da, Da = 16777216, Wn(
              t,
              e,
              a
            ), Da = r) : Wn(
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
      function mu(t) {
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
              Ft = r, hu(
                r,
                t
              );
            }
          mu(t);
        }
        if (t.subtreeFlags & 10256)
          for (t = t.child; t !== null; )
            pu(t), t = t.sibling;
      }
      function pu(t) {
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
            t.memoizedState !== null && e._visibility & 2 && (t.return === null || t.return.tag !== 13) ? (e._visibility &= -3, Pl(t)) : tl(t);
            break;
          default:
            tl(t);
        }
      }
      function Pl(t) {
        var e = t.deletions;
        if ((t.flags & 16) !== 0) {
          if (e !== null)
            for (var a = 0; a < e.length; a++) {
              var r = e[a];
              Ft = r, hu(
                r,
                t
              );
            }
          mu(t);
        }
        for (t = t.child; t !== null; ) {
          switch (e = t, e.tag) {
            case 0:
            case 11:
            case 15:
              wn(8, e, e.return), Pl(e);
              break;
            case 22:
              a = e.stateNode, a._visibility & 2 && (a._visibility &= -3, Pl(e));
              break;
            default:
              Pl(e);
          }
          t = t.sibling;
        }
      }
      function hu(t, e) {
        for (; Ft !== null; ) {
          var a = Ft;
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
              Ka(a.memoizedState.cache);
          }
          if (r = a.child, r !== null) r.return = a, Ft = r;
          else
            t: for (a = t; Ft !== null; ) {
              r = Ft;
              var c = r.sibling, u = r.return;
              if (iu(r), r === a) {
                Ft = null;
                break t;
              }
              if (c !== null) {
                c.return = u, Ft = c;
                break t;
              }
              Ft = u;
            }
        }
      }
      function Ji(t) {
        var e = mp(t);
        if (e != null) {
          if (typeof e.memoizedProps["data-testname"] != "string")
            throw Error(s(364));
          return e;
        }
        if (t = Ep(t), t === null) throw Error(s(362));
        return t.stateNode.current;
      }
      function Wi(t, e) {
        var a = t.tag;
        switch (e.$$typeof) {
          case xr:
            if (t.type === e.value) return !0;
            break;
          case wr:
            t: {
              for (e = e.value, t = [t, 0], a = 0; a < t.length; ) {
                var r = t[a++], c = r.tag, u = t[a++], g = e[u];
                if (c !== 5 && c !== 26 && c !== 27 || !ll(r)) {
                  for (; g != null && Wi(r, g); )
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
          case _r:
            if ((a === 5 || a === 26 || a === 27) && Tp(t.stateNode, e.value))
              return !0;
            break;
          case kr:
            if ((a === 5 || a === 6 || a === 26 || a === 27) && (t = Np(t), t !== null && 0 <= t.indexOf(e.value)))
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
      function Fi(t) {
        switch (t.$$typeof) {
          case xr:
            return "<" + (w(t.value) || "Unknown") + ">";
          case wr:
            return ":has(" + (Fi(t) || "") + ")";
          case _r:
            return '[role="' + t.value + '"]';
          case kr:
            return '"' + t.value + '"';
          case Sr:
            return '[data-testname="' + t.value + '"]';
          default:
            throw Error(s(365));
        }
      }
      function gu(t, e) {
        var a = [];
        t = [t, 0];
        for (var r = 0; r < t.length; ) {
          var c = t[r++], u = c.tag, g = t[r++], M = e[g];
          if (u !== 5 && u !== 26 && u !== 27 || !ll(c)) {
            for (; M != null && Wi(c, M); )
              g++, M = e[g];
            if (g === e.length) a.push(c);
            else
              for (c = c.child; c !== null; )
                t.push(c, g), c = c.sibling;
          }
        }
        return a;
      }
      function Ii(t, e) {
        if (!al) throw Error(s(363));
        t = Ji(t), t = gu(t, e), e = [], t = Array.from(t);
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
      function ve() {
        return (xt & 2) !== 0 && _t !== 0 ? _t & -_t : ct.T !== null ? ii() : hp();
      }
      function bu() {
        if (Ee === 0)
          if ((_t & 536870912) === 0 || St) {
            var t = or;
            or <<= 1, (or & 3932160) === 0 && (or = 262144), Ee = t;
          } else Ee = 536870912;
        return t = Se.current, t !== null && (t.flags |= 32), Ee;
      }
      function me(t, e, a) {
        (t === At && (Ct === 2 || Ct === 9) || t.cancelPendingCommit !== null) && (ga(t, 0), _n(
          t,
          _t,
          Ee,
          !1
        )), R(t, a), ((xt & 2) === 0 || t !== At) && (t === At && ((xt & 2) === 0 && (ra |= a), Bt === 4 && _n(
          t,
          _t,
          Ee,
          !1
        )), Ke(t));
      }
      function vu(t, e, a) {
        if ((xt & 6) !== 0) throw Error(s(327));
        var r = !a && (e & 127) === 0 && (e & t.expiredLanes) === 0 || H(t, e), c = r ? Xm(t, e) : Pi(t, e, !0), u = r;
        do {
          if (c === 0) {
            Ha && !r && _n(t, e, 0, !1);
            break;
          } else {
            if (a = t.current.alternate, u && !Vm(a)) {
              c = Pi(t, e, !1), u = !1;
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
                  var Y = se && M.current.memoizedState.isDehydrated;
                  if (Y && (ga(M, g).flags |= 256), g = Pi(
                    M,
                    g,
                    !1
                  ), g !== 2) {
                    if (Do && !Y) {
                      M.errorRecoveryDisabledLanes |= u, ra |= u, c = 4;
                      break t;
                    }
                    u = ge, ge = c, u !== null && (ge === null ? ge = u : ge.push.apply(
                      ge,
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
                    Ee,
                    !Cn
                  );
                  break t;
                case 2:
                  ge = null;
                  break;
                case 3:
                case 5:
                  break;
                default:
                  throw Error(s(329));
              }
              if ((e & 62914560) === e && (c = Er + 300 - pe(), 10 < c)) {
                if (_n(
                  r,
                  e,
                  Ee,
                  !Cn
                ), j(r, 0, !0) !== 0) break t;
                dn = e, r.timeoutHandle = dp(
                  yu.bind(
                    null,
                    r,
                    a,
                    ge,
                    zr,
                    Bo,
                    e,
                    Ee,
                    ra,
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
              yu(
                r,
                a,
                ge,
                zr,
                Bo,
                e,
                Ee,
                ra,
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
        Ke(t);
      }
      function yu(t, e, a, r, c, u, g, M, Y, J, P, W, nt, gt) {
        if (t.timeoutHandle = In, W = e.subtreeFlags, W & 8192 || (W & 16785408) === 16785408) {
          W = xp(), fu(
            e,
            u,
            W
          );
          var ne = (u & 62914560) === u ? Er - pe() : (u & 4194048) === u ? kd - pe() : 0;
          if (ne = wp(
            W,
            ne
          ), ne !== null) {
            dn = u, t.cancelPendingCommit = ne(
              Tu.bind(
                null,
                t,
                e,
                u,
                a,
                r,
                c,
                g,
                M,
                Y,
                P,
                W,
                null,
                nt,
                gt
              )
            ), _n(t, u, g, !J);
            return;
          }
        }
        Tu(
          t,
          e,
          u,
          a,
          r,
          c,
          g,
          M,
          Y
        );
      }
      function Vm(t) {
        for (var e = t; ; ) {
          var a = e.tag;
          if ((a === 0 || a === 11 || a === 15) && e.flags & 16384 && (a = e.updateQueue, a !== null && (a = a.stores, a !== null)))
            for (var r = 0; r < a.length; r++) {
              var c = a[r], u = c.getSnapshot;
              c = c.value;
              try {
                if (!_e(u(), c)) return !1;
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
        e &= ~Ho, e &= ~ra, t.suspendedLanes |= e, t.pingedLanes &= ~e, r && (t.warmLanes |= e), r = t.expirationTimes;
        for (var c = e; 0 < c; ) {
          var u = 31 - xe(c), g = 1 << u;
          r[u] = -1, c &= ~g;
        }
        a !== 0 && b(t, a, e);
      }
      function xu() {
        return (xt & 6) === 0 ? (ma(0), !1) : !0;
      }
      function $i() {
        if (wt !== null) {
          if (Ct === 0)
            var t = wt.return;
          else
            t = wt, on = Pn = null, yi(t), Ma = null, cl = 0, t = wt;
          for (; t !== null; )
            $c(t.alternate, t), t = t.return;
          wt = null;
        }
      }
      function ga(t, e) {
        var a = t.timeoutHandle;
        a !== In && (t.timeoutHandle = In, fp(a)), a = t.cancelPendingCommit, a !== null && (t.cancelPendingCommit = null, a()), dn = 0, $i(), At = t, wt = a = an(t.current, null), _t = e, Ct = 0, ke = null, Cn = !1, Ha = H(t, e), Do = !1, Ba = Ee = Ho = ra = Mn = Bt = 0, ge = ml = null, Bo = !1, (e & 8) !== 0 && (e |= e & 32);
        var r = t.entangledLanes;
        if (r !== 0)
          for (t = t.entanglements, r &= e; 0 < r; ) {
            var c = 31 - xe(r), u = 1 << c;
            e |= t[c], r &= ~u;
          }
        return un = e, Dl(), a;
      }
      function wu(t, e) {
        bt = null, ct.H = dl, e === Ca || e === hr ? (e = Gs(), Ct = 3) : e === No ? (e = Gs(), Ct = 4) : Ct = e === jo ? 8 : e !== null && typeof e == "object" && typeof e.then == "function" ? 6 : 1, ke = e, wt === null && (Bt = 1, Ll(
          t,
          K(e, t.current)
        ));
      }
      function _u() {
        var t = Se.current;
        return t === null ? !0 : (_t & 4194048) === _t ? je === null : (_t & 62914560) === _t || (_t & 536870912) !== 0 ? t === je : !1;
      }
      function Su() {
        var t = ct.H;
        return ct.H = dl, t === null ? dl : t;
      }
      function ku() {
        var t = ct.A;
        return ct.A = Vh, t;
      }
      function tr() {
        Bt = 4, Cn || (_t & 4194048) !== _t && Se.current !== null || (Ha = !0), (Mn & 134217727) === 0 && (ra & 134217727) === 0 || At === null || _n(
          At,
          _t,
          Ee,
          !1
        );
      }
      function Pi(t, e, a) {
        var r = xt;
        xt |= 2;
        var c = Su(), u = ku();
        (At !== t || _t !== e) && (zr = null, ga(t, e)), e = !1;
        var g = Bt;
        t: do
          try {
            if (Ct !== 0 && wt !== null) {
              var M = wt, Y = ke;
              switch (Ct) {
                case 8:
                  $i(), g = 6;
                  break t;
                case 3:
                case 2:
                case 9:
                case 6:
                  Se.current === null && (e = !0);
                  var J = Ct;
                  if (Ct = 0, ke = null, ba(t, M, Y, J), a && Ha) {
                    g = 0;
                    break t;
                  }
                  break;
                default:
                  J = Ct, Ct = 0, ke = null, ba(t, M, Y, J);
              }
            }
            Lm(), g = Bt;
            break;
          } catch (P) {
            wu(t, P);
          }
        while (!0);
        return e && t.shellSuspendCounter++, on = Pn = null, xt = r, ct.H = c, ct.A = u, wt === null && (At = null, _t = 0, Dl()), g;
      }
      function Lm() {
        for (; wt !== null; ) Eu(wt);
      }
      function Xm(t, e) {
        var a = xt;
        xt |= 2;
        var r = Su(), c = ku();
        At !== t || _t !== e ? (zr = null, pl = pe() + 500, ga(t, e)) : Ha = H(
          t,
          e
        );
        t: do
          try {
            if (Ct !== 0 && wt !== null) {
              e = wt;
              var u = ke;
              e: switch (Ct) {
                case 1:
                  Ct = 0, ke = null, ba(t, e, u, 1);
                  break;
                case 2:
                case 9:
                  if (qs(u)) {
                    Ct = 0, ke = null, zu(e);
                    break;
                  }
                  e = function() {
                    Ct !== 2 && Ct !== 9 || At !== t || (Ct = 7), Ke(t);
                  }, u.then(e, e);
                  break t;
                case 3:
                  Ct = 7;
                  break t;
                case 4:
                  Ct = 5;
                  break t;
                case 7:
                  qs(u) ? (Ct = 0, ke = null, zu(e)) : (Ct = 0, ke = null, ba(t, e, u, 7));
                  break;
                case 5:
                  var g = null;
                  switch (wt.tag) {
                    case 26:
                      g = wt.memoizedState;
                    case 5:
                    case 27:
                      var M = wt, Y = M.type, J = M.pendingProps;
                      if (g ? dd(g) : Wu(M.stateNode, Y, J)) {
                        Ct = 0, ke = null;
                        var P = M.sibling;
                        if (P !== null) wt = P;
                        else {
                          var W = M.return;
                          W !== null ? (wt = W, er(W)) : wt = null;
                        }
                        break e;
                      }
                  }
                  Ct = 0, ke = null, ba(t, e, u, 5);
                  break;
                case 6:
                  Ct = 0, ke = null, ba(t, e, u, 6);
                  break;
                case 8:
                  $i(), Bt = 6;
                  break t;
                default:
                  throw Error(s(462));
              }
            }
            Zm();
            break;
          } catch (nt) {
            wu(t, nt);
          }
        while (!0);
        return on = Pn = null, ct.H = r, ct.A = c, xt = a, wt !== null ? 0 : (At = null, _t = 0, Dl(), Bt);
      }
      function Zm() {
        for (; wt !== null && !Oh(); )
          Eu(wt);
      }
      function Eu(t) {
        var e = Zc(
          t.alternate,
          t,
          un
        );
        t.memoizedProps = t.pendingProps, e === null ? er(t) : wt = e;
      }
      function zu(t) {
        var e = t, a = e.alternate;
        switch (e.tag) {
          case 15:
          case 0:
            e = Gc(
              a,
              e,
              e.pendingProps,
              e.type,
              void 0,
              _t
            );
            break;
          case 11:
            e = Gc(
              a,
              e,
              e.pendingProps,
              e.type.render,
              e.ref,
              _t
            );
            break;
          case 5:
            yi(e);
          default:
            $c(a, e), e = wt = Hu(e, un), e = Zc(a, e, un);
        }
        t.memoizedProps = t.pendingProps, e === null ? er(t) : wt = e;
      }
      function ba(t, e, a, r) {
        on = Pn = null, yi(e), Ma = null, cl = 0;
        var c = e.return;
        try {
          if (Bm(
            t,
            c,
            e,
            a,
            _t
          )) {
            Bt = 1, Ll(
              t,
              K(a, t.current)
            ), wt = null;
            return;
          }
        } catch (u) {
          if (c !== null) throw wt = c, u;
          Bt = 1, Ll(
            t,
            K(a, t.current)
          ), wt = null;
          return;
        }
        e.flags & 32768 ? (St || r === 1 ? t = !0 : Ha || (_t & 536870912) !== 0 ? t = !1 : (Cn = t = !0, (r === 2 || r === 9 || r === 3 || r === 6) && (r = Se.current, r !== null && r.tag === 13 && (r.flags |= 16384))), Nu(e, t)) : er(e);
      }
      function er(t) {
        var e = t;
        do {
          if ((e.flags & 32768) !== 0) {
            Nu(
              e,
              Cn
            );
            return;
          }
          t = e.return;
          var a = Ym(
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
      function Nu(t, e) {
        do {
          var a = Gm(t.alternate, t);
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
      function Tu(t, e, a, r, c, u, g, M, Y) {
        t.cancelPendingCommit = null;
        do
          el();
        while (Xt !== 0);
        if ((xt & 6) !== 0) throw Error(s(327));
        if (e !== null) {
          if (e === t.current)
            throw Error(s(177));
          if (u = e.lanes | e.childLanes, u |= To, h(
            t,
            a,
            u,
            g,
            M,
            Y
          ), t === At && (wt = At = null, _t = 0), Ua = e, jn = t, dn = a, Uo = u, qo = c, Ed = r, (e.subtreeFlags & 10256) !== 0 || (e.flags & 10256) !== 0 ? (t.callbackNode = null, t.callbackPriority = 0, Im(xo, function() {
            return Ou(), null;
          })) : (t.callbackNode = null, t.callbackPriority = 0), r = (e.flags & 13878) !== 0, (e.subtreeFlags & 13878) !== 0 || r) {
            r = ct.T, ct.T = null, c = rn(), Wt(2), g = xt, xt |= 4;
            try {
              Km(t, e, a);
            } finally {
              xt = g, Wt(c), ct.T = r;
            }
          }
          Xt = 1, Cu(), Mu(), Au();
        }
      }
      function Cu() {
        if (Xt === 1) {
          Xt = 0;
          var t = jn, e = Ua, a = (e.flags & 13878) !== 0;
          if ((e.subtreeFlags & 13878) !== 0 || a) {
            a = ct.T, ct.T = null;
            var r = rn();
            Wt(2);
            var c = xt;
            xt |= 4;
            try {
              cu(e, t), cp(t.containerInfo);
            } finally {
              xt = c, Wt(r), ct.T = a;
            }
          }
          t.current = e, Xt = 2;
        }
      }
      function Mu() {
        if (Xt === 2) {
          Xt = 0;
          var t = jn, e = Ua, a = (e.flags & 8772) !== 0;
          if ((e.subtreeFlags & 8772) !== 0 || a) {
            a = ct.T, ct.T = null;
            var r = rn();
            Wt(2);
            var c = xt;
            xt |= 4;
            try {
              ru(t, e.alternate, e);
            } finally {
              xt = c, Wt(r), ct.T = a;
            }
          }
          Xt = 3;
        }
      }
      function Au() {
        if (Xt === 4 || Xt === 3) {
          Xt = 0, Rh();
          var t = jn, e = Ua, a = dn, r = Ed;
          (e.subtreeFlags & 10256) !== 0 || (e.flags & 10256) !== 0 ? Xt = 5 : (Xt = 0, Ua = jn = null, ju(t, t.pendingLanes));
          var c = t.pendingLanes;
          if (c === 0 && (An = null), D(a), e = e.stateNode, we && typeof we.onCommitFiberRoot == "function")
            try {
              we.onCommitFiberRoot(
                rl,
                e,
                void 0,
                (e.current.flags & 128) === 128
              );
            } catch {
            }
          if (r !== null) {
            e = ct.T, c = rn(), Wt(2), ct.T = null;
            try {
              for (var u = t.onRecoverableError, g = 0; g < r.length; g++) {
                var M = r[g];
                u(M.value, {
                  componentStack: M.stack
                });
              }
            } finally {
              ct.T = e, Wt(c);
            }
          }
          (dn & 3) !== 0 && el(), Ke(t), c = t.pendingLanes, (a & 261930) !== 0 && (c & 42) !== 0 ? t === Yo ? hl++ : (hl = 0, Yo = t) : hl = 0, se && vh(), ma(0);
        }
      }
      function ju(t, e) {
        (t.pooledCacheLanes &= e) === 0 && (e = t.pooledCache, e != null && (t.pooledCache = null, Ka(e)));
      }
      function el() {
        return Cu(), Mu(), Au(), Ou();
      }
      function Ou() {
        if (Xt !== 5) return !1;
        var t = jn, e = Uo;
        Uo = 0;
        var a = D(dn), r = 32 > a ? 32 : a;
        a = ct.T;
        var c = rn();
        try {
          Wt(r), ct.T = null, r = qo, qo = null;
          var u = jn, g = dn;
          if (Xt = 0, Ua = jn = null, dn = 0, (xt & 6) !== 0)
            throw Error(s(331));
          var M = xt;
          if (xt |= 4, pu(u.current), du(
            u,
            u.current,
            g,
            r
          ), xt = M, ma(0, !1), we && typeof we.onPostCommitFiberRoot == "function")
            try {
              we.onPostCommitFiberRoot(rl, u);
            } catch {
            }
          return !0;
        } finally {
          Wt(c), ct.T = a, ju(t, e);
        }
      }
      function Ru(t, e, a) {
        e = K(a, e), e = Ai(t.stateNode, e, 2), t = vn(t, e, 2), t !== null && (R(t, 2), Ke(t));
      }
      function Et(t, e, a) {
        if (t.tag === 3)
          Ru(t, t, a);
        else
          for (; e !== null; ) {
            if (e.tag === 3) {
              Ru(
                e,
                t,
                a
              );
              break;
            } else if (e.tag === 1) {
              var r = e.stateNode;
              if (typeof e.type.getDerivedStateFromError == "function" || typeof r.componentDidCatch == "function" && (An === null || !An.has(r))) {
                t = K(a, t), a = Oc(2), r = vn(e, a, 2), r !== null && (Rc(
                  a,
                  r,
                  e,
                  t
                ), R(r, 2), Ke(r));
                break;
              }
            }
            e = e.return;
          }
      }
      function to(t, e, a) {
        var r = t.pingCache;
        if (r === null) {
          r = t.pingCache = new Lh();
          var c = /* @__PURE__ */ new Set();
          r.set(e, c);
        } else
          c = r.get(e), c === void 0 && (c = /* @__PURE__ */ new Set(), r.set(e, c));
        c.has(a) || (Do = !0, c.add(a), t = Jm.bind(null, t, e, a), e.then(t, t));
      }
      function Jm(t, e, a) {
        var r = t.pingCache;
        r !== null && r.delete(e), t.pingedLanes |= t.suspendedLanes & a, t.warmLanes &= ~a, At === t && (_t & a) === a && (Bt === 4 || Bt === 3 && (_t & 62914560) === _t && 300 > pe() - Er ? (xt & 2) === 0 && ga(t, 0) : Ho |= a, Ba === _t && (Ba = 0)), Ke(t);
      }
      function Du(t, e) {
        e === 0 && (e = L()), t = Xn(t, e), t !== null && (R(t, e), Ke(t));
      }
      function Wm(t) {
        var e = t.memoizedState, a = 0;
        e !== null && (a = e.retryLane), Du(t, a);
      }
      function Fm(t, e) {
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
        r !== null && r.delete(e), Du(t, a);
      }
      function Im(t, e) {
        return cr(t, e);
      }
      function $m(t, e, a, r) {
        this.tag = t, this.key = a, this.sibling = this.child = this.return = this.stateNode = this.type = this.elementType = null, this.index = 0, this.refCleanup = this.ref = null, this.pendingProps = e, this.dependencies = this.memoizedState = this.updateQueue = this.memoizedProps = null, this.mode = r, this.subtreeFlags = this.flags = 0, this.deletions = null, this.childLanes = this.lanes = 0, this.alternate = null;
      }
      function eo(t) {
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
      function Hu(t, e) {
        t.flags &= 65011714;
        var a = t.alternate;
        return a === null ? (t.childLanes = 0, t.lanes = e, t.child = null, t.subtreeFlags = 0, t.memoizedProps = null, t.memoizedState = null, t.updateQueue = null, t.dependencies = null, t.stateNode = null) : (t.childLanes = a.childLanes, t.lanes = a.lanes, t.child = a.child, t.subtreeFlags = 0, t.deletions = null, t.memoizedProps = a.memoizedProps, t.memoizedState = a.memoizedState, t.updateQueue = a.updateQueue, t.type = a.type, e = a.dependencies, t.dependencies = e === null ? null : {
          lanes: e.lanes,
          firstContext: e.firstContext
        }), t;
      }
      function nr(t, e, a, r, c, u) {
        var g = 0;
        if (r = t, typeof t == "function") eo(t) && (g = 1);
        else if (typeof t == "string")
          g = qe && Lt ? rd(t, a, te.current) ? 26 : pd(t) ? 27 : 5 : qe ? rd(
            t,
            a,
            te.current
          ) ? 26 : 5 : Lt && pd(t) ? 27 : 5;
        else
          t: switch (t) {
            case fo:
              return t = i(31, a, e, c), t.elementType = fo, t.lanes = u, t;
            case ya:
              return Fn(
                a.children,
                c,
                u,
                e
              );
            case Qu:
              g = 8, c |= 24;
              break;
            case io:
              return t = i(12, a, e, c | 2), t.elementType = io, t.lanes = u, t;
            case so:
              return t = i(13, a, e, c), t.elementType = so, t.lanes = u, t;
            case co:
              return t = i(19, a, e, c), t.elementType = co, t.lanes = u, t;
            default:
              if (typeof t == "object" && t !== null)
                switch (t.$$typeof) {
                  case Sn:
                    g = 10;
                    break t;
                  case Vu:
                    g = 9;
                    break t;
                  case oo:
                    g = 11;
                    break t;
                  case uo:
                    g = 14;
                    break t;
                  case kn:
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
      function no(t, e, a) {
        return t = i(6, t, null, e), t.lanes = a, t;
      }
      function Bu(t) {
        var e = i(18, null, null, 0);
        return e.stateNode = t, e;
      }
      function ao(t, e, a) {
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
      function Pm(t, e, a, r, c, u, g, M, Y) {
        this.tag = 1, this.containerInfo = t, this.pingCache = this.current = this.pendingChildren = null, this.timeoutHandle = In, this.callbackNode = this.next = this.pendingContext = this.context = this.cancelPendingCommit = null, this.callbackPriority = 0, this.expirationTimes = U(-1), this.entangledLanes = this.shellSuspendCounter = this.errorRecoveryDisabledLanes = this.expiredLanes = this.warmLanes = this.pingedLanes = this.suspendedLanes = this.pendingLanes = 0, this.entanglements = U(0), this.hiddenUpdates = U(null), this.identifierPrefix = r, this.onUncaughtError = c, this.onCaughtError = u, this.onRecoverableError = g, this.pooledCache = null, this.pooledCacheLanes = 0, this.formState = Y, this.incompleteTransitions = /* @__PURE__ */ new Map();
      }
      function Uu(t, e, a, r, c, u, g, M, Y, J, P, W) {
        return t = new Pm(
          t,
          e,
          a,
          g,
          Y,
          J,
          P,
          W,
          M
        ), e = 1, u === !0 && (e |= 24), u = i(3, null, null, e), t.current = u, u.stateNode = t, e = ri(), e.refCount++, t.pooledCache = e, e.refCount++, u.memoizedState = {
          element: r,
          isDehydrated: a,
          cache: e
        }, ci(u), t;
      }
      function qu(t) {
        return t ? (t = Sa, t) : Sa;
      }
      function Yu(t) {
        var e = t._reactInternals;
        if (e === void 0)
          throw typeof t.render == "function" ? Error(s(188)) : (t = Object.keys(t).join(","), Error(s(268, t)));
        return t = f(e), t = t !== null ? p(t) : null, t === null ? null : nl(t.stateNode);
      }
      function Gu(t, e, a, r, c, u) {
        c = qu(c), r.context === null ? r.context = c : r.pendingContext = c, r = bn(e), r.payload = { element: a }, u = u === void 0 ? null : u, u !== null && (r.callback = u), a = vn(t, r, e), a !== null && (me(a, t, e), Va(a, t, e));
      }
      function Ku(t, e) {
        if (t = t.memoizedState, t !== null && t.dehydrated !== null) {
          var a = t.retryLane;
          t.retryLane = a !== 0 && a < e ? a : e;
        }
      }
      function lo(t, e) {
        Ku(t, e), (t = t.alternate) && Ku(t, e);
      }
      var yt = {}, tp = x0, ye = _0(), ro = Object.assign, ep = Symbol.for("react.element"), ar = Symbol.for("react.transitional.element"), va = Symbol.for("react.portal"), ya = Symbol.for("react.fragment"), Qu = Symbol.for("react.strict_mode"), io = Symbol.for("react.profiler"), Vu = Symbol.for("react.consumer"), Sn = Symbol.for("react.context"), oo = Symbol.for("react.forward_ref"), so = Symbol.for("react.suspense"), co = Symbol.for("react.suspense_list"), uo = Symbol.for("react.memo"), kn = Symbol.for("react.lazy"), fo = Symbol.for("react.activity"), np = Symbol.for("react.memo_cache_sentinel"), Lu = Symbol.iterator, ap = Symbol.for("react.client.reference"), lr = Array.isArray, ct = tp.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE, lp = l.rendererVersion, rp = l.rendererPackageName, Xu = l.extraDevToolsConfig, nl = l.getPublicInstance, ip = l.getRootHostContext, op = l.getChildHostContext, sp = l.prepareForCommit, cp = l.resetAfterCommit, up = l.createInstance;
      l.cloneMutableInstance;
      var mo = l.appendInitialChild, Zu = l.finalizeInitialChildren, rr = l.shouldSetTextContent, Ju = l.createTextInstance;
      l.cloneMutableTextInstance;
      var dp = l.scheduleTimeout, fp = l.cancelTimeout, In = l.noTimeout, ln = l.isPrimaryRenderer;
      l.warnsIfNotActing;
      var oe = l.supportsMutation, Ve = l.supportsPersistence, se = l.supportsHydration, mp = l.getInstanceFromNode;
      l.beforeActiveInstanceBlur;
      var pp = l.preparePortalMount;
      l.prepareScopeUpdate, l.getInstanceFromScope;
      var Wt = l.setCurrentUpdatePriority, rn = l.getCurrentUpdatePriority, hp = l.resolveUpdatePriority;
      l.trackSchedulerEvent, l.resolveEventType, l.resolveEventTimeStamp;
      var gp = l.shouldAttemptEagerTransition, bp = l.detachDeletedInstance;
      l.requestPostPaintCallback;
      var vp = l.maySuspendCommit, yp = l.maySuspendCommitOnUpdate, po = l.maySuspendCommitInSyncRender, Wu = l.preloadInstance, xp = l.startSuspendingCommit, Fu = l.suspendInstance;
      l.suspendOnActiveViewTransition;
      var wp = l.waitForCommitToBeReady;
      l.getSuspendedCommitReason;
      var xa = l.NotPendingTransition, $n = l.HostTransitionContext, _p = l.resetFormInstance;
      l.bindToConsole;
      var Sp = l.supportsMicrotasks, kp = l.scheduleMicrotask, al = l.supportsTestSelectors, Ep = l.findFiberRoot, zp = l.getBoundingRect, Np = l.getTextContent, ll = l.isHiddenSubtree, Tp = l.matchAccessibilityRole, Cp = l.setFocusIfFocusable, Mp = l.setupIntersectionObserver, Ap = l.appendChild, jp = l.appendChildToContainer, Op = l.commitTextUpdate, Rp = l.commitMount, Dp = l.commitUpdate, Hp = l.insertBefore, Bp = l.insertInContainerBefore, Up = l.removeChild, qp = l.removeChildFromContainer, Iu = l.resetTextContent, Yp = l.hideInstance, Gp = l.hideTextInstance, Kp = l.unhideInstance, Qp = l.unhideTextInstance;
      l.cancelViewTransitionName, l.cancelRootViewTransitionName, l.restoreRootViewTransitionName, l.cloneRootViewTransitionContainer, l.removeRootViewTransitionClone, l.measureClonedInstance, l.hasInstanceChanged, l.hasInstanceAffectedParent, l.startViewTransition, l.startGestureTransition, l.stopViewTransition, l.getCurrentGestureOffset, l.createViewTransitionInstance;
      var Vp = l.clearContainer;
      l.createFragmentInstance, l.updateFragmentInstanceFiber, l.commitNewChildToFragmentInstance, l.deleteChildFromFragmentInstance;
      var Lp = l.cloneInstance, $u = l.createContainerChildSet, Pu = l.appendChildToContainerChildSet, Xp = l.finalizeContainerChildren, td = l.replaceContainerChildren, ed = l.cloneHiddenInstance, nd = l.cloneHiddenTextInstance, ho = l.isSuspenseInstancePending, go = l.isSuspenseInstanceFallback, Zp = l.getSuspenseInstanceFallbackErrorDetails, Jp = l.registerSuspenseInstanceRetry, Wp = l.canHydrateFormStateMarker, Fp = l.isFormStateMarkerMatching, ad = l.getNextHydratableSibling, Ip = l.getNextHydratableSiblingAfterSingleton, $p = l.getFirstHydratableChild, Pp = l.getFirstHydratableChildWithinContainer, th = l.getFirstHydratableChildWithinActivityInstance, eh = l.getFirstHydratableChildWithinSuspenseInstance, nh = l.getFirstHydratableChildWithinSingleton, ah = l.canHydrateInstance, lh = l.canHydrateTextInstance, rh = l.canHydrateActivityInstance, ih = l.canHydrateSuspenseInstance, oh = l.hydrateInstance, sh = l.hydrateTextInstance, ch = l.hydrateActivityInstance, uh = l.hydrateSuspenseInstance, dh = l.getNextHydratableInstanceAfterActivityInstance, fh = l.getNextHydratableInstanceAfterSuspenseInstance, mh = l.commitHydratedInstance, ph = l.commitHydratedContainer, hh = l.commitHydratedActivityInstance, gh = l.commitHydratedSuspenseInstance, bh = l.finalizeHydratedChildren, vh = l.flushHydrationEvents;
      l.clearActivityBoundary;
      var yh = l.clearSuspenseBoundary;
      l.clearActivityBoundaryFromContainer;
      var xh = l.clearSuspenseBoundaryFromContainer, wh = l.hideDehydratedBoundary, _h = l.unhideDehydratedBoundary, ld = l.shouldDeleteUnhydratedTailInstances;
      l.diffHydratedPropsForDevWarnings, l.diffHydratedTextForDevWarnings, l.describeHydratableInstanceForDevWarnings;
      var Sh = l.validateHydratableInstance, kh = l.validateHydratableTextInstance, qe = l.supportsResources, rd = l.isHostHoistableType, bo = l.getHoistableRoot, id = l.getResource, od = l.acquireResource, sd = l.releaseResource, Eh = l.hydrateHoistable, cd = l.mountHoistable, ud = l.unmountHoistable, zh = l.createHoistableInstance, Nh = l.prepareToCommitHoistables, Th = l.mayResourceSuspendCommit, dd = l.preloadResource, Ch = l.suspendResource, Lt = l.supportsSingletons, fd = l.resolveSingletonInstance, Mh = l.acquireSingletonInstance, md = l.releaseSingletonInstance, pd = l.isHostSingletonType, wa = l.isSingletonScope, vo = [], _a = -1, Sa = {}, xe = Math.clz32 ? Math.clz32 : S, Ah = Math.log, jh = Math.LN2, ir = 256, or = 262144, sr = 4194304, cr = ye.unstable_scheduleCallback, yo = ye.unstable_cancelCallback, Oh = ye.unstable_shouldYield, Rh = ye.unstable_requestPaint, pe = ye.unstable_now, hd = ye.unstable_ImmediatePriority, Dh = ye.unstable_UserBlockingPriority, xo = ye.unstable_NormalPriority, Hh = ye.unstable_IdlePriority, Bh = ye.log, Uh = ye.unstable_setDisableYieldValue, rl = null, we = null, _e = typeof Object.is == "function" ? Object.is : I, gd = typeof reportError == "function" ? reportError : function(t) {
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
      }, qh = Object.prototype.hasOwnProperty, wo, bd, _o = !1, vd = /* @__PURE__ */ new WeakMap(), ka = [], Ea = 0, ur = null, il = 0, Te = [], Ce = 0, En = null, Le = 1, Xe = "", te = v(null), ol = v(null), zn = v(null), dr = v(null), ee = null, Ot = null, St = !1, Nn = null, Me = !1, So = Error(s(519)), fr = v(null), Pn = null, on = null, Yh = typeof AbortController < "u" ? AbortController : function() {
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
      }, Gh = ye.unstable_scheduleCallback, Kh = ye.unstable_NormalPriority, Rt = {
        $$typeof: Sn,
        Consumer: null,
        Provider: null,
        _currentValue: null,
        _currentValue2: null,
        _threadCount: 0
      }, mr = null, za = null, ko = !1, pr = !1, Eo = !1, ta = 0, sl = null, zo = 0, Na = 0, Ta = null, yd = ct.S;
      ct.S = function(t, e) {
        kd = pe(), typeof e == "object" && e !== null && typeof e.then == "function" && Cm(t, e), yd !== null && yd(t, e);
      };
      var ea = v(null), Ca = Error(s(460)), No = Error(s(474)), hr = Error(s(542)), gr = { then: function() {
      } }, na = null, Ma = null, cl = 0, aa = Qs(!0), xd = Qs(!1), Ae = [], Aa = 0, To = 0, Tn = !1, Co = !1, ja = v(null), br = v(0), Se = v(null), je = null, qt = v(0), sn = 0, bt = null, Mt = null, Yt = null, vr = !1, Oa = !1, la = !1, yr = 0, ul = 0, Ra = null, Qh = 0, dl = {
        readContext: $t,
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
      var wd = {
        readContext: $t,
        use: Yl,
        useCallback: function(t, e) {
          return de().memoizedState = [
            t,
            e === void 0 ? null : e
          ], t;
        },
        useContext: $t,
        useEffect: pc,
        useImperativeHandle: function(t, e, a) {
          a = a != null ? a.concat([t]) : null, Kl(
            4194308,
            4,
            vc.bind(null, e, t),
            a
          );
        },
        useLayoutEffect: function(t, e) {
          return Kl(4194308, 4, t, e);
        },
        useInsertionEffect: function(t, e) {
          Kl(4, 2, t, e);
        },
        useMemo: function(t, e) {
          var a = de();
          e = e === void 0 ? null : e;
          var r = t();
          if (la) {
            G(!0);
            try {
              t();
            } finally {
              G(!1);
            }
          }
          return a.memoizedState = [r, e], r;
        },
        useReducer: function(t, e, a) {
          var r = de();
          if (a !== void 0) {
            var c = a(e);
            if (la) {
              G(!0);
              try {
                a(e);
              } finally {
                G(!1);
              }
            }
          } else c = e;
          return r.memoizedState = r.baseState = c, t = {
            pending: null,
            lanes: 0,
            dispatch: null,
            lastRenderedReducer: t,
            lastRenderedState: c
          }, r.queue = t, t = t.dispatch = Hm.bind(
            null,
            bt,
            t
          ), [r.memoizedState, t];
        },
        useRef: function(t) {
          var e = de();
          return t = { current: t }, e.memoizedState = t;
        },
        useState: function(t) {
          t = Si(t);
          var e = t.queue, a = Nc.bind(
            null,
            bt,
            e
          );
          return e.dispatch = a, [t.memoizedState, a];
        },
        useDebugValue: zi,
        useDeferredValue: function(t, e) {
          var a = de();
          return Ni(a, t, e);
        },
        useTransition: function() {
          var t = Si(!1);
          return t = Sc.bind(
            null,
            bt,
            t.queue,
            !0,
            !1
          ), de().memoizedState = t, [!1, t];
        },
        useSyncExternalStore: function(t, e, a) {
          var r = bt, c = de();
          if (St) {
            if (a === void 0)
              throw Error(s(407));
            a = a();
          } else {
            if (a = e(), At === null)
              throw Error(s(349));
            (_t & 127) !== 0 || $s(r, e, a);
          }
          c.memoizedState = a;
          var u = { value: a, getSnapshot: e };
          return c.queue = u, pc(tc.bind(null, r, u, t), [
            t
          ]), r.flags |= 2048, pa(
            9,
            { destroy: void 0 },
            Ps.bind(
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
          var t = de(), e = At.identifierPrefix;
          if (St) {
            var a = Xe, r = Le;
            a = (r & ~(1 << 32 - xe(r) - 1)).toString(32) + a, e = "_" + e + "R_" + a, a = yr++, 0 < a && (e += "H" + a.toString(32)), e += "_";
          } else
            a = Qh++, e = "_" + e + "r_" + a.toString(32) + "_";
          return t.memoizedState = e;
        },
        useHostTransitionStatus: Ti,
        useFormState: cc,
        useActionState: cc,
        useOptimistic: function(t) {
          var e = de();
          e.memoizedState = e.baseState = t;
          var a = {
            pending: null,
            lanes: 0,
            dispatch: null,
            lastRenderedReducer: null,
            lastRenderedState: null
          };
          return e.queue = a, e = Ci.bind(
            null,
            bt,
            !0,
            a
          ), a.dispatch = e, [t, e];
        },
        useMemoCache: xi,
        useCacheRefresh: function() {
          return de().memoizedState = Dm.bind(
            null,
            bt
          );
        },
        useEffectEvent: function(t) {
          var e = de(), a = { impl: t };
          return e.memoizedState = a, function() {
            if ((xt & 2) !== 0)
              throw Error(s(440));
            return a.impl.apply(void 0, arguments);
          };
        }
      }, Mo = {
        readContext: $t,
        use: Yl,
        useCallback: xc,
        useContext: $t,
        useEffect: Ei,
        useImperativeHandle: yc,
        useInsertionEffect: gc,
        useLayoutEffect: bc,
        useMemo: wc,
        useReducer: Gl,
        useRef: mc,
        useState: function() {
          return Gl(Pe);
        },
        useDebugValue: zi,
        useDeferredValue: function(t, e) {
          var a = Ut();
          return _c(
            a,
            Mt.memoizedState,
            t,
            e
          );
        },
        useTransition: function() {
          var t = Gl(Pe)[0], e = Ut().memoizedState;
          return [
            typeof t == "boolean" ? t : Za(t),
            e
          ];
        },
        useSyncExternalStore: Is,
        useId: Ec,
        useHostTransitionStatus: Ti,
        useFormState: uc,
        useActionState: uc,
        useOptimistic: function(t, e) {
          var a = Ut();
          return ac(a, Mt, t, e);
        },
        useMemoCache: xi,
        useCacheRefresh: zc
      };
      Mo.useEffectEvent = hc;
      var _d = {
        readContext: $t,
        use: Yl,
        useCallback: xc,
        useContext: $t,
        useEffect: Ei,
        useImperativeHandle: yc,
        useInsertionEffect: gc,
        useLayoutEffect: bc,
        useMemo: wc,
        useReducer: _i,
        useRef: mc,
        useState: function() {
          return _i(Pe);
        },
        useDebugValue: zi,
        useDeferredValue: function(t, e) {
          var a = Ut();
          return Mt === null ? Ni(a, t, e) : _c(
            a,
            Mt.memoizedState,
            t,
            e
          );
        },
        useTransition: function() {
          var t = _i(Pe)[0], e = Ut().memoizedState;
          return [
            typeof t == "boolean" ? t : Za(t),
            e
          ];
        },
        useSyncExternalStore: Is,
        useId: Ec,
        useHostTransitionStatus: Ti,
        useFormState: fc,
        useActionState: fc,
        useOptimistic: function(t, e) {
          var a = Ut();
          return Mt !== null ? ac(a, Mt, t, e) : (a.baseState = t, [t, a.queue.dispatch]);
        },
        useMemoCache: xi,
        useCacheRefresh: zc
      };
      _d.useEffectEvent = hc;
      var Ao = {
        enqueueSetState: function(t, e, a) {
          t = t._reactInternals;
          var r = ve(), c = bn(r);
          c.payload = e, a != null && (c.callback = a), e = vn(t, c, r), e !== null && (me(e, t, r), Va(e, t, r));
        },
        enqueueReplaceState: function(t, e, a) {
          t = t._reactInternals;
          var r = ve(), c = bn(r);
          c.tag = 1, c.payload = e, a != null && (c.callback = a), e = vn(t, c, r), e !== null && (me(e, t, r), Va(e, t, r));
        },
        enqueueForceUpdate: function(t, e) {
          t = t._reactInternals;
          var a = ve(), r = bn(a);
          r.tag = 2, e != null && (r.callback = e), e = vn(t, r, a), e !== null && (me(e, t, a), Va(e, t, a));
        }
      }, jo = Error(s(461)), Gt = !1, Oo = {
        dehydrated: null,
        treeContext: null,
        retryLane: 0,
        hydrationErrors: null
      }, cn = !1, Kt = !1, Ro = !1, Sd = typeof WeakSet == "function" ? WeakSet : Set, Ft = null, Qt = null, he = !1, Ye = null, Da = 8192, Vh = {
        getCacheForType: function(t) {
          var e = $t(Rt), a = e.data.get(t);
          return a === void 0 && (a = t(), e.data.set(t, a)), a;
        },
        cacheSignal: function() {
          return $t(Rt).controller.signal;
        }
      }, xr = 0, wr = 1, _r = 2, Sr = 3, kr = 4;
      if (typeof Symbol == "function" && Symbol.for) {
        var fl = Symbol.for;
        xr = fl("selector.component"), wr = fl("selector.has_pseudo_class"), _r = fl("selector.role"), Sr = fl("selector.test_id"), kr = fl("selector.text");
      }
      var Lh = typeof WeakMap == "function" ? WeakMap : Map, xt = 0, At = null, wt = null, _t = 0, Ct = 0, ke = null, Cn = !1, Ha = !1, Do = !1, un = 0, Bt = 0, Mn = 0, ra = 0, Ho = 0, Ee = 0, Ba = 0, ml = null, ge = null, Bo = !1, Er = 0, kd = 0, pl = 1 / 0, zr = null, An = null, Xt = 0, jn = null, Ua = null, dn = 0, Uo = 0, qo = null, Ed = null, hl = 0, Yo = null;
      return yt.attemptContinuousHydration = function(t) {
        if (t.tag === 13 || t.tag === 31) {
          var e = Xn(t, 67108864);
          e !== null && me(e, t, 67108864), lo(t, 67108864);
        }
      }, yt.attemptHydrationAtCurrentPriority = function(t) {
        if (t.tag === 13 || t.tag === 31) {
          var e = ve();
          e = T(e);
          var a = Xn(t, e);
          a !== null && me(a, t, e), lo(t, e);
        }
      }, yt.attemptSynchronousHydration = function(t) {
        switch (t.tag) {
          case 3:
            if (t = t.stateNode, t.current.memoizedState.isDehydrated) {
              var e = k(t.pendingLanes);
              if (e !== 0) {
                for (t.pendingLanes |= 2, t.entangledLanes |= 2; e; ) {
                  var a = 1 << 31 - xe(e);
                  t.entanglements[1] |= a, e &= ~a;
                }
                Ke(t), (xt & 6) === 0 && (pl = pe() + 500, ma(0));
              }
            }
            break;
          case 31:
          case 13:
            e = Xn(t, 2), e !== null && me(e, t, 2), xu(), lo(t, 2);
        }
      }, yt.batchedUpdates = function(t, e) {
        return t(e);
      }, yt.createComponentSelector = function(t) {
        return { $$typeof: xr, value: t };
      }, yt.createContainer = function(t, e, a, r, c, u, g, M, Y, J) {
        return Uu(
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
          Y,
          J
        );
      }, yt.createHasPseudoClassSelector = function(t) {
        return { $$typeof: wr, value: t };
      }, yt.createHydrationContainer = function(t, e, a, r, c, u, g, M, Y, J, P, W, nt, gt) {
        return t = Uu(
          a,
          r,
          !0,
          t,
          c,
          u,
          M,
          gt,
          Y,
          J,
          P,
          W
        ), t.context = qu(null), a = t.current, r = ve(), r = T(r), c = bn(r), c.callback = e ?? null, vn(a, c, r), e = r, t.current.lanes = e, R(t, e), Ke(t), t;
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
        return { $$typeof: _r, value: t };
      }, yt.createTestNameSelector = function(t) {
        return { $$typeof: Sr, value: t };
      }, yt.createTextSelector = function(t) {
        return { $$typeof: kr, value: t };
      }, yt.defaultOnCaughtError = function(t) {
        console.error(t);
      }, yt.defaultOnRecoverableError = function(t) {
        gd(t);
      }, yt.defaultOnUncaughtError = function(t) {
        gd(t);
      }, yt.deferredUpdates = function(t) {
        var e = ct.T, a = rn();
        try {
          return Wt(32), ct.T = null, t();
        } finally {
          Wt(a), ct.T = e;
        }
      }, yt.discreteUpdates = function(t, e, a, r, c) {
        var u = ct.T, g = rn();
        try {
          return Wt(2), ct.T = null, t(e, a, r, c);
        } finally {
          Wt(g), ct.T = u, xt === 0 && (pl = pe() + 500);
        }
      }, yt.findAllNodes = Ii, yt.findBoundingRects = function(t, e) {
        if (!al) throw Error(s(363));
        e = Ii(t, e), t = [];
        for (var a = 0; a < e.length; a++)
          t.push(zp(e[a]));
        for (e = t.length - 1; 0 < e; e--) {
          a = t[e];
          for (var r = a.x, c = r + a.width, u = a.y, g = u + a.height, M = e - 1; 0 <= M; M--)
            if (e !== M) {
              var Y = t[M], J = Y.x, P = J + Y.width, W = Y.y, nt = W + Y.height;
              if (r >= J && u >= W && c <= P && g <= nt) {
                t.splice(e, 1);
                break;
              } else if (r !== J || a.width !== Y.width || nt < u || W > g) {
                if (!(u !== W || a.height !== Y.height || P < r || J > c)) {
                  J > r && (Y.width += J - r, Y.x = r), P < c && (Y.width = c - J), t.splice(e, 1);
                  break;
                }
              } else {
                W > u && (Y.height += W - u, Y.y = u), nt < g && (Y.height = g - W), t.splice(e, 1);
                break;
              }
            }
        }
        return t;
      }, yt.findHostInstance = Yu, yt.findHostInstanceWithNoPortals = function(t) {
        return t = f(t), t = t !== null ? y(t) : null, t === null ? null : nl(t.stateNode);
      }, yt.findHostInstanceWithWarning = function(t) {
        return Yu(t);
      }, yt.flushPassiveEffects = el, yt.flushSyncFromReconciler = function(t) {
        var e = xt;
        xt |= 1;
        var a = ct.T, r = rn();
        try {
          if (Wt(2), ct.T = null, t)
            return t();
        } finally {
          Wt(r), ct.T = a, xt = e, (xt & 6) === 0 && ma(0);
        }
      }, yt.flushSyncWork = xu, yt.focusWithin = function(t, e) {
        if (!al) throw Error(s(363));
        for (t = Ji(t), e = gu(t, e), e = Array.from(e), t = 0; t < e.length; ) {
          var a = e[t++], r = a.tag;
          if (!ll(a)) {
            if ((r === 5 || r === 26 || r === 27) && Cp(a.stateNode))
              return !0;
            for (a = a.child; a !== null; )
              e.push(a), a = a.sibling;
          }
        }
        return !1;
      }, yt.getFindAllNodesFailureDescription = function(t, e) {
        if (!al) throw Error(s(363));
        var a = 0, r = [];
        t = [Ji(t), 0];
        for (var c = 0; c < t.length; ) {
          var u = t[c++], g = u.tag, M = t[c++], Y = e[M];
          if ((g !== 5 && g !== 26 && g !== 27 || !ll(u)) && (Wi(u, Y) && (r.push(Fi(Y)), M++, M > a && (a = M)), M < e.length))
            for (u = u.child; u !== null; )
              t.push(u, M), u = u.sibling;
        }
        if (a < e.length) {
          for (t = []; a < e.length; a++)
            t.push(Fi(e[a]));
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
          version: lp,
          rendererPackageName: rp,
          currentDispatcherRef: ct,
          reconcilerVersion: "19.2.0"
        };
        if (Xu !== null && (t.rendererConfig = Xu), typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ > "u") t = !1;
        else {
          var e = __REACT_DEVTOOLS_GLOBAL_HOOK__;
          if (e.isDisabled || !e.supportsFiber) t = !0;
          else {
            try {
              rl = e.inject(t), we = e;
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
        t = Ii(t, e);
        var c = Mp(
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
        var c = kc(t).queue;
        Sc(
          t,
          c,
          e,
          xa,
          a === null ? o : function() {
            var u = kc(t);
            return u.next === null && (u = t.alternate.memoizedState), Ja(
              t,
              u.next.queue,
              {},
              ve()
            ), a(r);
          }
        );
      }, yt.updateContainer = function(t, e, a, r) {
        var c = e.current, u = ve();
        return Gu(
          c,
          u,
          t,
          e,
          a,
          r
        ), u;
      }, yt.updateContainerSync = function(t, e, a, r) {
        return Gu(
          e.current,
          2,
          t,
          e,
          a,
          r
        ), 2;
      }, yt;
    }, n.exports.default = n.exports, Object.defineProperty(n.exports, "__esModule", { value: !0 });
  })(Vo)), Vo.exports;
}
var Ud;
function k0() {
  return Ud || (Ud = 1, Qo.exports = S0()), Qo.exports;
}
var E0 = k0();
const z0 = /* @__PURE__ */ xs(E0);
var Zo = { exports: {} }, fn = {};
/**
 * @license React
 * react-reconciler-constants.production.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var qd;
function N0() {
  return qd || (qd = 1, fn.ConcurrentRoot = 1, fn.ContinuousEventPriority = 8, fn.DefaultEventPriority = 32, fn.DiscreteEventPriority = 2, fn.IdleEventPriority = 268435456, fn.LegacyRoot = 0, fn.NoEventPriority = 0), fn;
}
var Yd;
function T0() {
  return Yd || (Yd = 1, Zo.exports = N0()), Zo.exports;
}
var El = T0();
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
const Cf = ["accent", "panel-bg", "surface-0", "surface-1", "surface-dim", "overlay-0", "overlay-1", "text", "subtext-0", "mauve", "green", "yellow", "red", "blue", "teal", "peach", "backdrop", "card-bg"], rs = 16, ws = /* @__PURE__ */ new Set(["hover", "focus", "focus-visible", "focus-within", "active"]), C0 = [
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
], Gd = {
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
}, M0 = /* @__PURE__ */ new Set([
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
]), Mf = {
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
}, Af = {
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
}, is = ["font-size", "color", ...new Set([...Object.keys(Mf), ...Object.keys(Af)].filter((n) => n !== "font-size" && n !== "color"))], A0 = new Set(is);
function le(n, l = " ") {
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
function os(n, l, i = 0) {
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
    const p = n.slice(d + 4, f - 1), y = le(p, ","), E = y[0].trim(), w = y.length > 1 ? p.slice(p.indexOf(",") + 1).trim() : null;
    let v = l(E);
    if ((v == null || v === "initial") && (v = w), v == null) return null;
    const z = os(v, l, i + 1);
    if (z === null) return null;
    o += z, s = f;
  }
}
function j0(n) {
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
  const i = j0(n.trim().replace(/env\(\s*safe-area-inset-(?:top|right|bottom|left)\s*(?:,[^()]*)?\)/gi, "0px"));
  if (!i) return null;
  let o = 0;
  const s = ({ num: v, unit: z }) => {
    switch (z) {
      case "":
        return { px: 0, pct: 0, num: v, unitless: !0 };
      case "px":
        return { px: v, pct: 0, num: 0 };
      case "rem":
        return { px: v * rs, pct: 0, num: 0 };
      case "em":
        return { px: v * (l.fontSize ?? rs), pct: 0, num: 0 };
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
  }, d = (v, z, N) => v && z ? { px: v.px + N * z.px, pct: v.pct + N * z.pct, num: v.num + N * z.num, unitless: v.unitless && z.unitless } : null, m = (v, z) => v ? { px: v.px * z, pct: v.pct * z, num: v.num * z, unitless: v.unitless } : null, f = (v) => v && v.unitless;
  function p() {
    const v = i[o++];
    if (!v) return null;
    if (v.num !== void 0) return s(v);
    if (v.op === "(") {
      const z = E();
      return i[o]?.op !== ")" ? null : (o++, z);
    }
    if (v.op === "-" || v.op === "+") {
      const z = p();
      return v.op === "-" ? m(z, -1) : z;
    }
    if (v.fn) {
      const z = [];
      for (; ; ) {
        z.push(E());
        const k = i[o++];
        if (!k) return null;
        if (k.op === ")") break;
        if (k.op !== ",") return null;
      }
      if (z.some((k) => !k)) return null;
      if (v.fn === "calc") return z[0];
      if (!(z.every((k) => !k.pct) || z.every((k) => !k.px && !k.num))) return null;
      const S = (k) => k.px + k.pct + k.num;
      return v.fn === "min" ? z.reduce((k, j) => S(j) < S(k) ? j : k) : v.fn === "max" ? z.reduce((k, j) => S(j) > S(k) ? j : k) : v.fn === "clamp" && z.length === 3 ? S(z[1]) < S(z[0]) ? z[0] : S(z[1]) > S(z[2]) ? z[2] : z[1] : null;
    }
    return null;
  }
  function y() {
    let v = p();
    for (; i[o] && (i[o].op === "*" || i[o].op === "/"); ) {
      const z = i[o++].op, N = p();
      if (!v || !N) return null;
      z === "*" ? v = f(N) ? m(v, N.num) : f(v) ? m(N, v.num) : null : v = f(N) && N.num !== 0 ? m(v, 1 / N.num) : null;
    }
    return v;
  }
  function E() {
    let v = y();
    for (; i[o] && (i[o].op === "+" || i[o].op === "-"); ) {
      const z = i[o++].op;
      v = d(v, y(), z === "-" ? -1 : 1);
    }
    return v;
  }
  const w = E();
  return o !== i.length || !w ? null : w;
}
function ss(n, l) {
  const i = n.trim().toLowerCase();
  if (/^(auto|none|normal|fit-content|max-content|min-content|medium|thin|thick)$/.test(i))
    return i === "thin" ? { px: 1 } : i === "medium" ? { px: 3 } : i === "thick" ? { px: 5 } : i;
  const o = Yn(i, l);
  return o ? o.unitless ? o.num === 0 ? { px: 0 } : { expr: n.trim() } : o.pct && (o.px || o.num) ? { expr: n.trim() } : o.pct ? { pct: o.pct } : { px: O0(o.px) } : { expr: n.trim() };
}
const O0 = (n) => Number.isFinite(n) ? n : n > 0 ? 34e37 : -34e37, Tr = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0"), R0 = ([n, l, i, o]) => `#${Tr(n)}${Tr(l)}${Tr(i)}${Tr(o * 255)}`;
function Kd(n) {
  const l = n.slice(1), i = l.length <= 4 ? l.split("").map((s) => s + s).join("") : l;
  if (!/^[0-9a-f]{6}([0-9a-f]{2})?$/i.test(i)) return null;
  const o = (s) => parseInt(i.slice(s, s + 2), 16);
  return [o(0), o(2), o(4), i.length === 8 ? o(6) / 255 : 1];
}
function Qr(n, l) {
  const i = n.trim().toLowerCase();
  if (i === "currentcolor") return "currentcolor";
  const o = /^perchtoken\(([a-z0-9-]+)\)$/.exec(i);
  if (o) {
    const y = l(o[1]), E = y && Kd(y);
    return E ? { rgba: E, token: o[1] } : null;
  }
  if (i.startsWith("#")) {
    const y = Kd(i);
    return y ? { rgba: y, token: null } : null;
  }
  if (Gd[i]) return { rgba: [...Gd[i]], token: null };
  const s = /^(rgba?|color-mix)\((.*)\)$/s.exec(i);
  if (!s) return null;
  if (s[1] === "color-mix") {
    const y = le(s[2], ",");
    if (y.length !== 3 || !/^in\s+(srgb|srgb-linear|oklab|lab|oklch|lch|hsl|xyz)/.test(y[0])) return null;
    const E = (G) => {
      const I = le(G), tt = I.findIndex(($) => /%$/.test($)), Q = tt >= 0 ? parseFloat(I[tt]) / 100 : null;
      return { color: Qr(I.filter(($, K) => K !== tt).join(" "), l), pct: Q };
    }, w = E(y[1]), v = E(y[2]);
    if (!w.color || !v.color || w.color === "currentcolor" || v.color === "currentcolor") return null;
    let z = w.pct, N = v.pct;
    z === null && N === null ? (z = 0.5, N = 0.5) : z === null ? z = 1 - N : N === null && (N = 1 - z);
    const S = z + N, k = S < 1 ? S : 1;
    z /= S, N /= S;
    const [j, H, A, L] = w.color.rgba, [U, R, h, b] = v.color.rgba, x = L * z + b * N, _ = (G, I) => x === 0 ? 0 : (G * L * z + I * b * N) / x, T = [_(j, U), _(H, R), _(A, h), x * k], D = b === 0 ? w.color.token : L === 0 ? v.color.token : null;
    return { rgba: T, token: D };
  }
  const d = s[2].includes(",") ? le(s[2], ",") : le(s[2].replace("/", " / ")).filter((y) => y !== "/");
  if (d.length < 3) return null;
  const m = (y) => y.endsWith("%") ? parseFloat(y) / 100 * 255 : parseFloat(y), f = d[3] === void 0 ? 1 : d[3].endsWith("%") ? parseFloat(d[3]) / 100 : parseFloat(d[3]), p = [m(d[0]), m(d[1]), m(d[2]), f];
  return p.some((y) => Number.isNaN(y)) ? null : { rgba: p, token: null };
}
const xl = ["top", "right", "bottom", "left"], D0 = ["top-left", "top-right", "bottom-right", "bottom-left"], Cr = (n) => [n[0], n[1] ?? n[0], n[2] ?? n[0], n[3] ?? n[1] ?? n[0]], Qd = /* @__PURE__ */ new Set(["none", "hidden", "solid", "dashed", "dotted", "double", "groove", "ridge", "inset", "outset"]);
function cs(n, l) {
  const i = l.trim(), o = () => le(i);
  switch (n) {
    case "padding":
    case "margin": {
      const s = Cr(o());
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
      const s = Cr(o());
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
      const s = n.split("-")[1], d = Cr(o());
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
          Qd.has(p) ? m = p : /^(thin|medium|thick|-?[\d.]|calc\()/.test(p) ? d = p : f = p;
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
      const s = Cr(le(i.split("/")[0]));
      return D0.map((d, m) => [`border-${d}-radius`, s[m]]);
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
      return i === "none" ? [["background-color", "transparent"], ["background-image", "none"]] : Qr(i, () => "#000000") ? [["background-color", i], ["background-image", "none"]] : [["background-color", "transparent"], ["background-image", i]];
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
      return cs("gap", i);
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
        Qd.has(f) || f === "auto" ? d = f : /^(thin|medium|thick|-?[\d.]|calc\()/.test(f) ? s = f : m = f;
      return [["outline-width", s], ["outline-style", d], ["outline-color", m]];
    }
    case "transition": {
      if (i === "none") return [["transition-property", "none"], ["transition-duration", "0s"]];
      const s = le(i, ","), d = s.map((f) => le(f).find((p) => !/^[\d.]+m?s$/.test(p) && !/^(ease|linear|step|cubic)/.test(p)) ?? "all"), m = s.map((f) => le(f).find((p) => /^[\d.]+m?s$/.test(p)) ?? "0s");
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
function H0(n, l) {
  return n ? le(n, ",").some((i) => {
    let o = i.trim().toLowerCase(), s = !1;
    o.startsWith("not ") && (s = !0, o = o.slice(4)), o.startsWith("only ") && (o = o.slice(5));
    const d = o.split(/\s+and\s+/).every((m) => {
      if (m = m.trim(), m === "all" || m === "screen") return !0;
      if (m === "print") return !1;
      const f = /^\((.+)\)$/.exec(m);
      if (!f) return !1;
      const p = f[1].trim(), y = /^([a-z-]+)\s*:\s*(.+)$/.exec(p);
      if (y) {
        const [, w, v] = y, z = (N) => {
          const S = ss(N, { viewport: l });
          return typeof S == "object" && "px" in S ? S.px : NaN;
        };
        switch (w) {
          case "min-width":
            return l.width >= z(v);
          case "max-width":
            return l.width <= z(v);
          case "min-height":
            return l.height >= z(v);
          case "max-height":
            return l.height <= z(v);
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
      const E = /^(width|height)\s*(>=|<=|>|<|=)\s*(.+)$/.exec(p);
      if (E) {
        const w = E[1] === "width" ? l.width : l.height, v = ss(E[3], { viewport: l }), z = typeof v == "object" && "px" in v ? v.px : NaN;
        switch (E[2]) {
          case ">=":
            return w >= z;
          case "<=":
            return w <= z;
          case ">":
            return w > z;
          case "<":
            return w < z;
          default:
            return w === z;
        }
      }
      return !1;
    });
    return s ? !d : d;
  }) : !0;
}
function B0(n, l) {
  const i = l[l.length - 1].compound;
  return _s(i)[0] ?? n;
}
function U0(n) {
  const l = /* @__PURE__ */ new Set(), i = /* @__PURE__ */ new Set(), o = (s, d) => {
    s.forEach(({ compound: m }, f) => {
      const p = d && f === s.length - 1;
      for (const y of m.pseudos)
        if (ws.has(y.name) && (p ? l : i).add(y.name), y.list && y.name !== "not") for (const E of y.list) o(E, p);
    });
  };
  return o(n, !0), { subject: l, ancestor: i };
}
function _s(n) {
  const l = [...n.classes];
  for (const i of n.pseudos)
    if (!(i.name !== "is" && i.name !== "where"))
      for (const o of i.list) o.length === 1 && l.push(..._s(o[0].compound));
  return l;
}
function q0(n, l) {
  const i = (o, s) => {
    o.forEach(({ compound: d }, m) => {
      const f = s && m === o.length - 1, p = d.pseudos.filter((y) => ws.has(y.name)).map((y) => y.name);
      if (!f) for (const y of p) for (const E of _s(d)) l.add(`${y}:${E}`);
      for (const y of d.pseudos) if (y.list && y.name !== "not") for (const E of y.list) i(E, f);
    });
  };
  i(n, !0);
}
class Y0 {
  constructor(l) {
    this.properties = l.properties ?? {}, this.rules = [], this.skipped = 0, this.index = /* @__PURE__ */ new Map(), this.trackedStates = /* @__PURE__ */ new Set(), this.dependsCache = /* @__PURE__ */ new Map(), this.candidateCache = /* @__PURE__ */ new Map();
    const i = (d, m) => {
      const f = m[m.length - 1].compound, p = f.classes.length ? `.${f.classes[0]}` : f.tag && f.tag !== "*" ? f.tag : "*";
      this.index.has(p) || this.index.set(p, []), this.index.get(p).push(d);
    };
    let o = 0;
    const s = (d, m) => {
      for (const [f, p, y, E] of d)
        for (const w of bs(f)) {
          let v;
          try {
            v = vs(w);
          } catch (k) {
            if (k instanceof ae) {
              this.skipped++;
              continue;
            }
            throw k;
          }
          const z = U0(v);
          q0(v, this.trackedStates);
          const N = v[v.length - 1].compound.pseudoElement, S = { steps: v, media: p, layer: y, origin: m, order: o++, specificity: yf(v), decls: E, states: z, pseudo: N, own: V0(v), above: K0(v), source: m === 0 ? `ua:${v[v.length - 1].compound.tag ?? "*"}` : B0(w, v) };
          this.rules.push(S), i(S, v);
        }
    };
    s(C0.map(([d, m]) => [d, null, 0, Object.entries(m)]), 0), s(l.rules, 1);
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
        const p = f.reads ??= Of(f.steps);
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
const G0 = /* @__PURE__ */ new Set(["first-child", "last-child", "only-child", "nth-child"]);
function K0(n) {
  const l = [];
  for (let i = n.length - 1; i > 0 && !(n[i].combinator !== " " && n[i].combinator !== ">"); i--)
    l.push(...n[i - 1].compound.classes);
  return l;
}
function jf(n) {
  const l = n.parentElement;
  if (!l) return Q0;
  const i = jf(l), o = n.aboveCache;
  if (o && o.parent === l && o.name === l.className && o.base === i) return o.set;
  const s = l.classSet, d = s.size === 0 ? i : /* @__PURE__ */ new Set([...i, ...s]);
  return n.aboveCache = { parent: l, name: l.className, base: i, set: d }, d;
}
const Q0 = /* @__PURE__ */ new Set();
function V0(n) {
  if (n.length !== 1) return !1;
  const { compound: l } = n[0];
  return !l.id && !l.attrs.length && l.pseudos.every((i) => ws.has(i.name) && i.name !== "focus-within");
}
function Of(n, l = !0, i = { anc: !1, pos: !1, nth: !1, ancPos: !1 }) {
  return n.forEach((o, s) => {
    const d = l && s === n.length - 1;
    d || (i.anc = !0);
    for (const m of o.compound.pseudos)
      if (G0.has(m.name) && (d ? i.pos = !0 : i.ancPos = !0, m.name === "nth-child" && d && (i.nth = !0)), m.list && m.name !== "has") for (const f of m.list) Of(f, d, i);
  }), i;
}
const L0 = /* @__PURE__ */ new Set(["opacity", "z-index", "flex-grow", "flex-shrink", "font-weight", "line-height", "flex", "order", "-webkit-line-clamp", "zoom"]);
function X0(n) {
  if (!n || typeof n != "object") return [];
  const l = [];
  for (const [i, o] of Object.entries(n)) {
    if (o == null || o === "" || typeof o == "boolean") continue;
    const s = i.startsWith("--") ? i : i.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`).replace(/^(webkit|moz|ms)-/, "-$1-"), d = typeof o == "number" && o !== 0 && !L0.has(s) && !s.startsWith("--") ? `${o}px` : String(o);
    l.push([s, d]);
  }
  return l;
}
function Z0(n) {
  if (n.tagName !== "svg") return [];
  const l = [];
  for (const i of ["width", "height"]) {
    const o = n.getAttribute(i);
    o !== null && l.push([i, /^[\d.]+$/.test(o) ? `${o}px` : o]);
  }
  return l;
}
const J0 = (n, l) => n.important - l.important || n.origin - l.origin || n.layer - l.layer || n.specificity[0] - l.specificity[0] || n.specificity[1] - l.specificity[1] || n.specificity[2] - l.specificity[2] || n.order - l.order;
class W0 {
  constructor(l, { theme: i, viewport: o }) {
    this.sheet = l, this.theme = i, this.viewport = o, this.parsed = /* @__PURE__ */ new Map(), this.computed = /* @__PURE__ */ new WeakMap(), this.rootComputed = /* @__PURE__ */ new Map(), this.media = /* @__PURE__ */ new Map(), this.ownMatches = /* @__PURE__ */ new Map();
  }
  mediaHolds(l) {
    if (!l.media) return !0;
    for (const i of l.media) {
      let o = this.media.get(i);
      if (o === void 0 && this.media.set(i, o = H0(i, this.viewport)), !o) return !1;
    }
    return !0;
  }
  themeHex(l) {
    return this.theme?.[l] ?? null;
  }
  /** Rules matching `element`; `assume` is the set of interaction states assumed on the element itself
   * (`"*"`: any, for finding variant rules). Ancestors use their real state. */
  matching(l, i, o = null) {
    const d = { state: (w, v, z) => {
      if (v === "disabled") return !!w.props?.disabled && ["button", "input", "select", "textarea", "fieldset"].includes(w.tagName);
      if (v === "enabled") return !w.props?.disabled && ["button", "input", "select", "textarea"].includes(w.tagName);
      if (v === "checked") return !!w.props?.checked;
      if (i === "*") return !0;
      if (v === "focus-within") {
        const N = w.ownerDocument?.activeElement;
        return !!N && N !== w.ownerDocument.body && typeof w.contains == "function" && w.contains(N);
      }
      return z ? i.has(v) : v === "focus-visible" ? !!w.state?.focus && !w.state?.pointerFocus : !!w.state?.[v];
    }, pseudo: o }, m = this.sheet.candidates(l, o), f = `${l.tagName} ${l.className}|${o ?? ""}|${i === "*" ? "*" : [...i].sort().join(",")}`;
    let p = this.ownMatches.get(f);
    p || (p = new Set(m.filter((w) => w.own && this.mediaHolds(w) && Po(l, w.steps, d))), this.ownMatches.set(f, p));
    let y = null;
    const E = (w) => w.above.length ? (y ??= jf(l), w.above.every((v) => y.has(v))) : !0;
    return m.filter((w) => w.own ? p.has(w) : this.mediaHolds(w) && E(w) && Po(l, w.steps, d));
  }
  /** `element`'s computed style, or with `pseudo` (`before`, `after`) that of its pseudo-element's box, whose parent
   * is the element (pass the element's own computed style as `parent`). */
  compute(l, i, o = /* @__PURE__ */ new Set(), s = null) {
    const d = this.matching(l, o, s), m = s ? [] : Z0(l), f = s ? [] : X0(l.inlineStyle ?? l.props?.style);
    let p = this.rootComputed;
    i && (p = this.computed.get(i.values), p || this.computed.set(i.values, p = /* @__PURE__ */ new Map()));
    const y = `${d.map((w) => w.order).join(",")}|${m.length ? JSON.stringify(m) : ""}|${f.length ? JSON.stringify(f) : ""}`;
    let E = p.get(y);
    return E || p.set(y, E = this.cascade(d, m, f, i)), { ...E, rules: d, element: l };
  }
  /** The computed style from the matched `rules`, presentational `attrs`, `inline` declarations and the parent's. */
  cascade(l, i, o, s) {
    const d = [];
    for (const h of l)
      for (const [b, x, _] of h.decls) d.push({ prop: b, value: x, important: _ ? 1 : 0, origin: h.origin === 0 ? 0 : 2, layer: h.layer, specificity: h.specificity, order: h.order, source: h.source });
    for (const [h, b] of i) d.push({ prop: h, value: b, important: 0, origin: 1, layer: 0, specificity: [0, 0, 0], order: 0, source: `attr:${h}` });
    for (const [h, b] of o) d.push({ prop: h, value: b, important: 0, origin: 3, layer: 0, specificity: [1, 0, 0], order: 0, source: "style" });
    d.sort(J0);
    const m = this.sheet.properties, f = Object.create(s?.customs ?? null), p = /* @__PURE__ */ new Map(), y = /* @__PURE__ */ new Map();
    for (const h of d) h.prop.startsWith("--") && y.set(h.prop, h.value);
    if (!s && this.theme) for (const h of Cf) this.theme[h] && y.set(`--${h}`, `perchtoken(${h})`);
    const E = (h) => {
      if (p.has(h)) return p.get(h);
      const b = m[h];
      return b && !b.inherits ? b.initial ?? null : h in f ? f[h] : b?.initial ?? null;
    }, w = /* @__PURE__ */ new Set(), v = (h) => {
      if (!y.has(h)) return E(h);
      if (w.has(h)) return null;
      w.add(h);
      const b = os(y.get(h), v);
      return w.delete(h), y.delete(h), p.set(h, b), (!m[h] || m[h].inherits) && (f[h] = b), b;
    };
    for (const h of [...y.keys()]) v(h);
    const z = /* @__PURE__ */ new Map();
    for (const h of d) {
      if (h.prop.startsWith("--")) continue;
      const b = os(h.value, E);
      if (b === null) {
        for (const [x] of cs(h.prop, "unset")) z.set(x, { value: "unset", source: h.source, origin: h.origin });
        continue;
      }
      for (const [x, _] of cs(h.prop, b)) z.set(x, { value: _, source: h.source, origin: h.origin });
    }
    const N = {}, S = {}, k = /* @__PURE__ */ new Set(), j = /* @__PURE__ */ new Set(), H = s?.values, A = { fontSize: H?.["font-size"] ?? rs, viewport: this.viewport }, L = (h, b) => {
      if (/currentcolor/i.test(b)) return this.parseValue(h, b, A, N, H);
      const x = `${h}\0${b}\0${A.fontSize}`;
      let _ = this.parsed.get(x);
      return _ === void 0 && this.parsed.set(x, _ = this.parseValue(h, b, A, N, H)), _;
    }, U = z.size ? [...is, ...[...z.keys()].filter((h) => !A0.has(h))] : is;
    for (const h of U) {
      const b = z.get(h);
      let x = b?.value;
      const _ = M0.has(h);
      if ((x === void 0 || x === "unset" || x === "revert" || x === "revert-layer") && (x = _ ? "inherit" : "initial"), b && (S[h] = b.source, b.origin !== 0 && k.add(h)), x === "inherit" && H && h in H) {
        N[h] = H[h], j.add(h);
        continue;
      }
      (x === "inherit" || x === "initial") && (x = _ ? Af[h] : Mf[h]), N[h] = L(h, x), h === "font-size" && (A.fontSize = N["font-size"]);
    }
    for (const h of xl) {
      const b = N[`border-${h}-style`];
      (b === "none" || b === "hidden") && (N[`border-${h}-width`] = { px: 0 });
    }
    N["outline-style"] === "none" && (N["outline-width"] = { px: 0 });
    const R = H?.display;
    return (R === "flex" || R === "inline-flex" || R === "grid" || R === "inline-grid") && N.position !== "absolute" && N.position !== "fixed" && (N.display = Vd(N.display)), (N.position === "absolute" || N.position === "fixed") && (N.display = Vd(N.display)), { values: N, sources: S, own: k, inherited: j, customs: f };
  }
  parseValue(l, i, o, s, d) {
    const m = String(i).trim();
    switch (l) {
      case "font-size": {
        const f = m.toLowerCase(), p = { "xx-small": 9, "x-small": 10, small: 13, medium: 16, large: 18, "x-large": 24, "xx-large": 32 };
        if (p[f]) return p[f];
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
        const p = parseFloat(f);
        return Number.isFinite(p) ? p : 400;
      }
      case "line-height": {
        const f = m.toLowerCase();
        if (f === "normal") return { normal: !0 };
        const p = Yn(f, { fontSize: o.fontSize, viewport: o.viewport });
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
        const f = Qr(m, (p) => this.themeHex(p));
        return f === "currentcolor" || !f ? d?.color ?? { rgba: [0, 0, 0, 1], token: null } : f;
      }
      case "background-color":
      case "border-top-color":
      case "border-right-color":
      case "border-bottom-color":
      case "border-left-color":
      case "outline-color": {
        const f = Qr(m, (p) => this.themeHex(p));
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
        return ss(m, o);
      default:
        return m.toLowerCase().startsWith("var(") ? m : /^[a-z-]+$/i.test(m) ? m.toLowerCase() : m;
    }
  }
}
function Vd(n) {
  return n === "inline" || n === "inline-block" || n === "contents" ? "block" : n === "inline-flex" ? "flex" : n === "inline-grid" ? "grid" : n;
}
const Vr = (n) => n && n.rgba ? { value: R0(n.rgba), token: n.token ?? null } : null, F0 = { 9.28: 11, 9.92: 12, 10.4: 12, 10.88: 13, 11: 13, 11.2: 13, 11.52: 13, 12: 15, 12.5: 15, 13: 16, 14: 17, 16: 19 };
function I0(n, l) {
  const i = l?.(n);
  if (Number.isFinite(i)) return i;
  const o = Math.round(n * 100) / 100;
  return F0[o] ?? Math.round(n * 1.2);
}
function _l(n, l) {
  const i = n["line-height"], o = n["font-size"];
  return i.normal ? I0(o, l) : i.factor !== void 0 ? i.factor * o : i.px;
}
const $0 = (n) => le(n, ",").map((l) => l.trim().replace(/^["']|["']$/g, "")).join(", ");
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
const P0 = "perch-native-description/1", We = Symbol("display"), Lr = {
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
}, tg = ["w", "h", "min_w", "min_h", "max_w", "max_h", "top", "right", "bottom", "left", "pt", "pr", "pb", "pl", "mt", "mr", "mb", "ml", "gap_x", "gap_y", "border_t", "border_r", "border_b", "border_l", "rounded_tl", "rounded_tr", "rounded_br", "rounded_bl"];
for (const n of tg) Lr[n] = /^(w|h|min_|max_|top|right|bottom|left)/.test(n) ? "auto" : 0;
Lr.rounded = 0;
const eg = /* @__PURE__ */ new Set([
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
]), ng = /(-apple-system|blinkmacsystemfont|system-ui|segoe ui|sans-serif|times)/i, ag = /(ui-monospace|sfmono|sf mono|menlo|monospace)/i, lg = (n) => ag.test(n) ? "Menlo" : /^\s*system-ui\s*$/i.test(n ?? "") ? ".AppleSystemUIFont" : ng.test(n) ? ".SystemUIFont" : $0(n).split(",")[0].trim(), rg = {
  click: ["onClick", "onClickCapture"],
  double_click: ["onDoubleClick"],
  context_menu: ["onContextMenu"],
  mouse_down: ["onPointerDown", "onMouseDown", "onPointerDownCapture", "onMouseDownCapture"],
  mouse_up: ["onPointerUp", "onMouseUp", "onPointerCancel"],
  mouse_move: ["onPointerMove", "onMouseMove"],
  key_down: ["onKeyDown", "onKeyUp"],
  focus: ["onFocus", "onBlur"],
  input: ["onChange", "onInput"]
}, Ld = { pointerdown: "mouse_down", mousedown: "mouse_down", click: "click", keydown: "key_down", pointerup: "mouse_up", mouseup: "mouse_up" }, Ss = (n) => {
  const l = n.props["data-testid"];
  if (l) return `${n.tagName}[data-testid="${l}"]`;
  if (n.props.id) return `${n.tagName}#${n.props.id}`;
  const i = n.classList.find((s) => !s.includes(":") && !s.includes("[")) ?? n.classList[0];
  if (i) return `${n.tagName}.${i}`;
  const o = n.parentElement;
  return o && o.tagName !== "body" ? `${Ss(o)} > ${n.tagName}` : n.tagName;
};
class ig {
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
}, og = /^(text|search|url|email|tel|password|number)$/, sg = 162.13 / 12.8;
function cg(n, l) {
  const i = typeof n == "object" && /^min\((.*)\)$/.exec(String(n?.expr ?? "").trim());
  if (!i) return;
  const o = le(i[1], ",").map((s) => Yn(s.trim(), { fontSize: l })).filter((s) => s && !s.pct && !s.num).map((s) => s.px);
  return o.length ? Math.min(...o) : void 0;
}
function ug(n, l) {
  if (typeof n != "object" || !n?.expr) return !1;
  const i = Yn(n.expr, { fontSize: l["font-size"] }), o = (l["margin-left"]?.px ?? NaN) + (l["margin-right"]?.px ?? NaN);
  return !!i && !i.num && i.pct === 100 && Math.abs(i.px + o) < 0.01;
}
function Rf(n) {
  const l = n.transform;
  if (l && l !== "none") {
    const o = /^\s*translate(X|Y)?\(([^]*)\)\s*$/.exec(l), s = o && le(o[2], ",").map((d) => d.trim());
    return !s || s.length > (o[1] ? 1 : 2) ? null : o[1] === "X" ? [s[0], "0"] : o[1] === "Y" ? ["0", s[0]] : [s[0], s[1] ?? "0"];
  }
  const i = n.translate;
  if (i && i !== "none") {
    const o = le(String(i).trim(), " ").filter(Boolean);
    return o.length > 3 || o[2] !== void 0 && Yn(o[2], {})?.px ? null : [o[0], o[1] ?? "0"];
  }
  return [];
}
function Xd(n, l, i, o = !1) {
  const s = n.values, d = Rf(s);
  if (d?.length === 0) return;
  const m = s.transform && s.transform !== "none" ? "transform" : "translate", f = { fontSize: s["font-size"] }, p = (w, v) => {
    const z = Yn(w, f);
    if (!(!z || z.unitless && z.num))
      return z.pct ? typeof v == "number" ? z.px + z.pct / 100 * v : void 0 : z.px;
  }, y = d ? p(d[0], l.w) : void 0, E = d ? p(d[1], l.h) : void 0;
  if (y === void 0 || E === void 0) {
    const w = !o && d ? d.map((v) => Yn(v, f)) : null;
    if (w?.every((v) => v && !(v.unitless && v.num))) {
      l[Df] = w.map((v) => [v.px, v.pct ?? 0]);
      return;
    }
    i("unsupported", m, s[m], n.sources[m]);
    return;
  }
  if (o) {
    y && (l.left = y), E && (l.top = E);
    return;
  }
  y && (l.ml = (l.ml ?? 0) + y), E && (l.mt = (l.mt ?? 0) + E);
}
const Df = Symbol("perch.shift");
function dg(n, l, i) {
  const o = n.ownerDocument, s = o?.measure?.(n) ?? null;
  if (s) {
    const [[m, f], [p, y]] = i, E = m + f / 100 * s.width, w = p + y / 100 * s.height;
    E && (l.ml = (typeof l.ml == "number" ? l.ml : 0) + E), w && (l.mt = (typeof l.mt == "number" ? l.mt : 0) + w);
  }
  const d = s ? `${s.width}x${s.height}` : "";
  d === n.shiftSeen ? n.shiftTries = 0 : (n.shiftTries ?? 0) < kf && o?.retries && (n.shiftSeen = d, n.shiftTries = (n.shiftTries ?? 0) + 1, o.retries.push(() => o.afterCommit?.()));
}
function Ur(n, l, i = null) {
  const o = n.values, s = {}, d = (A) => n.sources[A], m = (A) => n.sources[A] !== void 0, f = o.display;
  f === "none" ? s.display = "hidden" : f === "flex" || f === "inline-flex" ? s.display = "flex" : (f === "grid" || f === "inline-grid") && (s.display = "flex", s.flex_direction = "col", l("approximated", "display", f, d("display"), "one-column flex column"), o["grid-template-columns"] && o["grid-template-columns"] !== "none" && l("unsupported", "grid-template-columns", o["grid-template-columns"], d("grid-template-columns"))), n.element.hidden && (s.display = "hidden");
  const p = s.display === "flex";
  if (p && s.flex_direction !== "col") {
    const A = { row: "row", column: "col", "row-reverse": "row_reverse", "column-reverse": "col_reverse" }[o["flex-direction"]] ?? "row";
    s.flex_direction = A;
  }
  if (p) {
    (o["flex-wrap"] === "wrap" || o["flex-wrap"] === "wrap-reverse") && (s.flex_wrap = "wrap");
    const A = f === "grid" || f === "inline-grid", L = { "flex-start": "start", start: "start", "self-start": "start", "flex-end": "end", end: "end", "self-end": "end", center: "center", baseline: "baseline", "first baseline": "baseline" }[o["align-items"]];
    L && (s.items = L);
    let U = { "flex-start": "start", start: "start", "flex-end": "end", end: "end", center: "center", "space-between": "between", "space-around": "around", "space-evenly": "evenly" }[o["justify-content"]];
    if (A) {
      const b = { center: "center", end: "end", "flex-end": "end", start: "start", "flex-start": "start" }[o["justify-items"]];
      b && (s.items = b), o["align-items"] === "center" && (U = "center");
    }
    U && (s.justify = U);
    const R = pn(o["row-gap"]), h = pn(o["column-gap"]);
    typeof R == "number" && R && (s.gap_y = R), typeof h == "number" && h && !A && (s.gap_x = h);
  }
  o["flex-grow"] && (s.flex_grow = o["flex-grow"]), o["flex-shrink"] !== 1 && (s.flex_shrink = o["flex-shrink"]);
  const y = pn(o["flex-basis"]);
  y !== void 0 && y !== "auto" && (s.flex_basis = y);
  const E = { "flex-start": "start", start: "start", "flex-end": "end", end: "end", center: "center", baseline: "baseline", stretch: "stretch" }[o["align-self"]];
  E && (s.self = E);
  for (const [A, L] of [["w", "width"], ["h", "height"], ["min_w", "min-width"], ["min_h", "min-height"], ["max_w", "max-width"], ["max_h", "max-height"]]) {
    const U = o[L], R = pn(U);
    if (R === void 0 && L === "width" && ug(U, o)) {
      s.self = "stretch", l("approximated", L, U.expr, d(L), "stretched across its parent, inside its margins");
      continue;
    }
    const h = R === void 0 && /^max-/.test(L) ? cg(U, o["font-size"]) : void 0;
    if (h !== void 0) {
      s[A] = h, l("approximated", L, U.expr, d(L), "the fixed bound of min()");
      continue;
    }
    if (R === void 0) {
      typeof U == "object" && U.expr ? l("unsupported", L, U.expr, d(L), "no calc() in the engine") : typeof U == "string" && !["auto", "none"].includes(U) && l("unsupported", L, U, d(L));
      continue;
    }
    R !== "auto" && (s[A] = R);
  }
  const w = ["top", "right", "bottom", "left"];
  for (const A of w) {
    const L = A[0];
    for (const [U, R] of [["p", "padding"], ["m", "margin"]]) {
      const h = o[`${R}-${A}`], b = pn(h);
      if (b === void 0) {
        h?.expr && l("unsupported", `${R}-${A}`, h.expr, d(`${R}-${A}`), "no calc() in the engine");
        continue;
      }
      b !== 0 && (s[`${U}${L}`] = b);
    }
  }
  const v = o.position;
  if (v === "absolute" || v === "fixed") {
    s.position = "absolute", v === "fixed" && l("approximated", "position", "fixed", d("position"), "absolute in the overlay layer");
    for (const A of w) {
      const L = pn(o[A]);
      L !== void 0 && L !== "auto" && (s[A] = L);
    }
    if (v === "fixed" && i && s.w === void 0 && s.right === void 0 && typeof s.left == "number") {
      const A = i.width - s.left - (typeof s.ml == "number" ? s.ml : 0) - (typeof s.mr == "number" ? s.mr : 0);
      s.max_w = typeof s.max_w == "number" ? Math.min(s.max_w, A) : A;
    }
    Xd(n, s, l);
  } else v === "sticky" ? l("unsupported", "position", "sticky", d("position")) : Rf(o)?.length !== 0 && (s.position = "relative", Xd(n, s, l, !0));
  o["z-index"] !== "auto" && m("z-index") && l("unsupported", "z-index", o["z-index"], d("z-index"), "paint order is tree order");
  for (const [A, L] of [["overflow_x", "overflow-x"], ["overflow_y", "overflow-y"]]) {
    const U = o[L];
    U === "hidden" || U === "clip" ? s[A] = "hidden" : (U === "auto" || U === "scroll") && (s[A] = "scroll");
  }
  (o.visibility === "hidden" || o.visibility === "collapse") && (s.visibility = "invisible");
  const z = o["background-color"];
  z?.unreadable ? l("unsupported", "background-color", z.unreadable, d("background-color")) : z?.rgba && z.rgba[3] > 0 && (s.bg = Vr(z)), o["background-image"] && o["background-image"] !== "none" && l("unsupported", "background-image", o["background-image"], d("background-image"));
  const N = w.map((A) => pn(o[`border-${A}-width`]) || 0), S = [];
  w.forEach((A, L) => {
    if (!N[L]) return;
    s[`border_${A[0]}`] = N[L];
    const U = o[`border-${A}-style`];
    U !== "solid" && l("approximated", `border-${A}-style`, U, d(`border-${A}-style`), "drawn solid");
    const R = Vr(o[`border-${A}-color`]);
    R && S.push(R);
  }), S.length && (s.border_color = S[0], S.some((A) => A.value !== S[0].value) && l("approximated", "border-color", S.map((A) => A.value).join(" "), d("border-top-color"), "one border colour"));
  const k = (A) => {
    const L = pn(o[`border-${A}-radius`]) || 0;
    if (typeof L != "string") return L;
    const U = parseFloat(L) / 100, R = [s.w, s.h].filter((h) => typeof h == "number");
    return L === "auto" || !(U > 0) ? 0 : R.length ? Math.round(Math.min(U, 0.5) * Math.min(...R) * 100) / 100 : 9999;
  }, j = ["top-left", "top-right", "bottom-right", "bottom-left"].map(k);
  j.every((A) => A === j[0]) ? j[0] && (s.rounded = j[0]) : ["tl", "tr", "br", "bl"].forEach((A, L) => {
    j[L] && (s[`rounded_${A}`] = j[L]);
  }), o.opacity !== 1 && (s.opacity = Math.round(o.opacity * 1e3) / 1e3);
  const H = o["box-shadow"];
  if (H && H !== "none" && le(H, ",").some((A) => !/^0(px)?\s+0(px)?\s+(0(px)?\s+)?(0(px)?\s+)?(#0000|transparent|rgba?\(0,\s*0,\s*0,\s*0\))/.test(A.trim())) && (s.shadow = "lg", l("approximated", "box-shadow", H, d("box-shadow"), "the engine's large shadow preset")), o.cursor && o.cursor !== "auto" && !n.inherited.has("cursor")) {
    const A = { pointer: "pointer", default: "default", text: "text", move: "move", "not-allowed": "not_allowed", grab: "move", grabbing: "move" }[o.cursor];
    A ? s.cursor = A : l("unsupported", "cursor", o.cursor, d("cursor"));
  }
  return o["text-overflow"] === "ellipsis" && (s.text_ellipsis = !0), o["text-decoration-line"] === "underline" ? s.underline = !0 : o["text-decoration-line"] && o["text-decoration-line"] !== "none" && l("unsupported", "text-decoration-line", o["text-decoration-line"], d("text-decoration-line")), s;
}
const fg = { "tabular-nums": "tnum", "proportional-nums": "pnum", "lining-nums": "lnum", "oldstyle-nums": "onum", "slashed-zero": "zero", "diagonal-fractions": "frac", "stacked-fractions": "afrc", ordinal: "ordn" };
function Hf(n) {
  if (!n || n === "normal") return "";
  const l = String(n).trim().split(/\s+/).map((i) => fg[i]);
  return l.every(Boolean) ? l.join(",") : null;
}
function qr(n, l) {
  const i = n.values, o = i["line-height"];
  return {
    text_color: Vr(i.color),
    text_size: Math.round(i["font-size"] * 1e3) / 1e3,
    font_features: Hf(i["font-variant-numeric"]) ?? "",
    font_weight: i["font-weight"],
    line_height: o.factor !== void 0 ? { factor: o.factor } : { px: Math.round(_l(i, l) * 1e3) / 1e3 },
    font_family: lg(i["font-family"]),
    italic: i["font-style"] === "italic" || i["font-style"] === "oblique",
    whitespace: i["white-space"] === "nowrap" || i["white-space"] === "pre" ? "nowrap" : "normal",
    text_align: { center: "center", right: "right", end: "right" }[i["text-align"]] ?? "left"
  };
}
const Zd = (n, l) => n.factor !== void 0 ? n.factor * l : n.px, ks = (n, l) => JSON.stringify(n) === JSON.stringify(l);
function Yr(n, l, i) {
  const o = {}, s = (f, p) => p.some((y) => !n.inherited.has(y));
  for (const [f, p] of [["text_color", ["color"]], ["text_size", ["font-size"]], ["font_weight", ["font-weight"]], ["font_family", ["font-family"]], ["italic", ["font-style"]], ["whitespace", ["white-space"]], ["text_align", ["text-align"]], ["font_features", ["font-variant-numeric"]]])
    (s(f, p) || !ks(l[f], i[f])) && (o[f] = l[f]);
  const d = Zd(l.line_height, l.text_size), m = i.line_height ? Zd(i.line_height, l.text_size) : NaN;
  return (s("line_height", ["line-height"]) || !(Math.abs(d - m) <= 1e-3)) && (o.line_height = l.line_height), o;
}
const mg = (n, l) => ({ ...n, ...l });
function Gr(n, l) {
  const i = {};
  for (const [o, s] of Object.entries(n))
    s && typeof s == "object" && "value" in s ? (i[o] = s.value, s.token && (l[o] = s.token)) : o === "line_height" ? i[o] = s.factor !== void 0 ? Math.round(s.factor * 1e3) / 1e3 : `${s.px}px` : o === "italic" ? s && (i.italic = !0) : i[o] = s;
  return i.italic === !1 && delete i.italic, i;
}
function Jd(n, l) {
  const i = {};
  for (const o of /* @__PURE__ */ new Set([...Object.keys(n), ...Object.keys(l)])) {
    const s = n[o], d = l[o];
    ks(s, d) || (i[o] = d === void 0 ? o in Lr ? Lr[o] : null : d);
  }
  return i;
}
function Wd(n, l) {
  const i = n.values;
  for (const [o, s] of Object.entries(n.sources)) {
    if (o.startsWith("--") || eg.has(o) || s.startsWith("ua:")) continue;
    const d = i[o];
    switch (o) {
      case "letter-spacing":
        d !== "normal" && d?.px !== 0 && l("approximated", o, d?.px !== void 0 ? `${Math.round(d.px * 1e3) / 1e3}px` : d, s, d?.px < 0 ? "the run's box is as wide as with the spacing (the glyphs reach past it; where the element clips, the run is drawn smaller to fit)" : "the run is as wide as with the spacing (room after it), the letters are not spread");
        break;
      case "font-variant-numeric":
        d !== "normal" && Hf(d) === null && l("unsupported", o, d, s);
        break;
      case "text-transform":
        d !== "none" && l("approximated", o, d, s, "applied to the text in JS");
        break;
      case "transition-property":
      case "transition-duration": {
        const m = i["transition-duration"];
        o === "transition-property" && m && le(m, ",").some((f) => parseFloat(f) > 0) && i["transition-property"] !== "none" && l("unsupported", "transition", `${i["transition-property"]} ${m}`, s, "changes are instant (the engine animates only opacity and size)");
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
        i["outline-style"] !== "none" && o === "outline-style" && l("unsupported", "outline", `${pn(i["outline-width"])}px ${i["outline-style"]} ${Vr(i["outline-color"])?.value ?? ""}`.trim(), s, "no outline in the engine (no focus ring)");
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
function pg(n, l, i, o) {
  const s = Ss(n), d = [], m = (j, H, A, L, U) => d.push([j, H, A, L ?? "(user agent)", s, U]), f = o.cascade.compute(n, l), p = {}, y = Ur(f, m, o.viewport), E = y[Df];
  Wd(f, m);
  const w = qr(f, o.measure), v = Yr(f, w, i), z = Gr({ ...y, ...v }, p), N = {}, S = o.cascade.matching(n, "*").filter((j) => j.states.subject.size);
  for (const [j, H] of [["hover", ["hover"]], ["focus", ["focus", "focus-visible"]], ["active", ["active", "hover"]]]) {
    if (!S.some((h) => H.some((b) => h.states.subject.has(b)))) continue;
    const A = o.cascade.compute(n, l, new Set(H)), L = {}, U = Gr({ ...Ur(A, () => {
    }), ...Yr(A, qr(A, o.measure), i) }, L);
    j === "focus" && Wd(A, m);
    const R = Jd(z, U);
    if (Object.keys(R).length) {
      N[j] = R;
      const h = Object.fromEntries(Object.entries(L).filter(([b]) => b in R));
      Object.keys(h).length && (N[`${j}_tokens`] = h);
    }
  }
  if (o.cascade.sheet.tracks(n, "hover") && (N.group = Fd(n), N.track_hover = !0), o.cascade.sheet.readsAncestor(n, "hover"))
    for (let j = n.parentNode; j?.state; j = j.parentNode) {
      if (!o.cascade.sheet.tracks(j, "hover")) continue;
      const H = j.state.hover;
      j.state.hover = !0;
      let A;
      try {
        A = o.cascade.compute(n, l);
      } finally {
        j.state.hover = H;
      }
      const L = {}, U = Gr({ ...Ur(A, () => {
      }), ...Yr(A, qr(A, o.measure), i) }, L), R = Jd(z, U);
      if (!Object.keys(R).length) continue;
      const h = Object.fromEntries(Object.entries(L).filter(([b]) => b in R));
      (N.group_hover ??= []).push({ group: Fd(j), style: R, ...Object.keys(h).length ? { tokens: h } : {} });
    }
  if (/tabular/.test(String(f.values["font-variant-numeric"] ?? "")) && (N.tabular = !0), /^(anywhere|break-word)$/.test(String(f.values["overflow-wrap"] ?? "")) && (N.break_anywhere = !0), y.overflow_y === "scroll") {
    const j = Number.parseFloat(f.customs?.["--scrollbar-size"] ?? "");
    j > 0 && (N.scrollbar = j);
  }
  f.values["pointer-events"] !== "none" && l?.values["pointer-events"] === "none" && (N.blocks_pointer = !0), f.values["pointer-events"] === "none" && (N.pointer_none = !0);
  const k = Object.entries(rg).filter(([, j]) => j.some((H) => typeof n.props[H] == "function")).map(([j]) => j);
  return !k.includes("click") && as(n) && k.push("click"), k.length && (N.events = k), { computed: f, style: z, tokens: p, extra: N, meta: Sg(n), reports: d, childText: mg(i, v), where: s, shift: E };
}
function hg(n, l, i, o) {
  const s = { before: null, after: null };
  for (const d of ["before", "after"]) {
    if (!o.cascade.matching(n, /* @__PURE__ */ new Set(), d).length) continue;
    const m = o.cascade.compute(n, l, /* @__PURE__ */ new Set(), d), f = String(m.values.content ?? "none").trim();
    if (f === "none" || f === "normal") continue;
    const p = /^(["'])(.*)\1$/.exec(f)?.[2] ?? "", y = (N, S, k, j, H) => o.add(N, S, k, j ?? "(user agent)", `${Ss(n)}::${d}`, H), E = {}, w = Ur(m, y, o.viewport), z = { kind: "div", style: Gr({ ...w, ...Yr(m, qr(m, o.measure), i) }, E), tokens: E, children: p ? [{ kind: "text", text: p }] : [] };
    Object.defineProperty(z, We, { value: m.values.display }), s[d] = z;
  }
  return s;
}
const Fd = (n) => `~g${n.id}`, gg = ["pt", "pr", "pb", "pl", "mt", "mr", "mb", "ml", "border_t", "border_r", "border_b", "border_l", "bg"];
function bg(n) {
  return n.kind === "div" && n[We] === "inline" && !n.events?.length && !n.meta?.attrs?.["data-testid"] && !gg.some((l) => n.style?.[l]) && n.children?.every((l) => l.kind === "text");
}
function Mr(n, l) {
  const i = n[l], o = { ...i, style: { ...i.style } };
  return Object.defineProperty(o, We, { value: i[We] }), n[l] = o, o;
}
function vg(n) {
  const l = [];
  for (let i = n.parentElement; i?.parentElement; i = i.parentElement) {
    const o = i.parentElement.children;
    l.push(`${+(o[0] === i)}${+(o[o.length - 1] === i)}`);
  }
  return l.join("");
}
function Bf(n, l, i, o, s = 0, d = !0, m = !0, f = 0) {
  const p = o.cascade.sheet.depends(n), y = p.pos ? `${+d}${+m}${p.nth ? `:${f}` : ""}` : "", E = p.ancPos ? vg(n) : "";
  let w = o.cache.get(n);
  const v = w && w.version === n.version && w.parentValues === l?.values && w.inheritedText === i && w.pos === y && w.ancPos === E && (!p.anc || s <= w.at);
  if (v && w.node && w.stamp === n.stamp && !w.volatile && (!w.subAnc || s <= w.subAt)) {
    for (const k of w.log) o.add(...k);
    return w.node;
  }
  if (!v) {
    const k = pg(n, l, i, o);
    w && ks(w.part.childText, k.childText) && (k.childText = w.part.childText), w = { version: n.version, parentValues: l?.values, inheritedText: i, pos: y, ancPos: E, at: o.now, part: k }, o.cache.set(n, w);
  }
  const z = o.log.length, N = { volatile: !!w.part.shift || p.ancPos, subAnc: p.anc }, S = yg(n, w, o, Math.max(s, n.attrStamp), N);
  return Object.assign(w, { node: S, stamp: n.stamp, subAt: o.now, log: o.log.slice(z), volatile: N.volatile, subAnc: N.subAnc }), S;
}
function yg(n, l, i, o, s) {
  const { computed: d, tokens: m, extra: f, reports: p, childText: y, where: E } = l.part;
  for (const x of p) i.add(...x);
  const w = (x, _, T, D, G) => i.add(x, _, T, D, E, G), v = { ...l.part.style };
  l.part.shift && dg(n, v, l.part.shift);
  const z = { kind: "div", id: n.id, style: v, tokens: m, meta: l.part.meta, ...f };
  Object.defineProperty(z, We, { value: d.values.display }), n.measured && n.ownerDocument?.measureKey && (z.measure = n.ownerDocument.measureKey(n));
  const N = n.tagName;
  if (n.props["data-perch-engine"] != null)
    return z.kind = "engine", z.engine = String(n.props["data-perch-engine"]), z.key = String(n.props["data-perch-key"] ?? ""), z;
  if (N === "svg")
    return z.kind = n.props["data-perch-image"] ? "image" : "svg", z.markup = Eg(n), z;
  if (N === "input" || N === "textarea" || N === "select") {
    z.kind = "input", z.input_type = N === "input" ? String(n.props.type ?? "text") : N;
    for (const T of ["placeholder", "checked", "disabled"]) n.props[T] !== void 0 && (z[T] = n.props[T]);
    if (/^(checkbox|radio)$/.test(z.input_type) && (z.checked = n.checked), N !== "select" && (z.value = n.value), N === "input" && og.test(z.input_type) && (z.field_w = sg * d.values["font-size"]), N === "textarea" && v.h === void 0) {
      const T = d.values, D = (tt) => tt && typeof tt == "object" && "px" in tt ? tt.px : 0, G = (tt) => T[`border-${tt}-style`] === "none" ? 0 : D(T[`border-${tt}-width`]), I = Number(n.props.rows) > 0 ? Math.floor(Number(n.props.rows)) : 2;
      v.h = I * _l(T, i.measure) + D(T["padding-top"]) + D(T["padding-bottom"]) + G("top") + G("bottom");
    }
    const { before: x, after: _ } = hg(n, d, y, i);
    return (x || _) && (z.children = [x, _].filter(Boolean)), z;
  }
  if (N === "img") {
    z.kind = "image", z.src = n.props.src ?? null;
    for (const [x, _] of [["width", "w"], ["height", "h"]]) {
      const T = Number(n.props[x]);
      v[_] === void 0 && n.props[x] != null && Number.isFinite(T) && (v[_] = T);
    }
    return z;
  }
  const S = d.values["text-transform"], k = [];
  let j = !1, H = !1;
  const A = n.childNodes.reduce((x, _) => x + (_ instanceof Vt ? 1 : 0), 0);
  let L = 0;
  for (const x of n.childNodes) {
    if (x instanceof Pr) {
      if (x.hidden || x.data === "") continue;
      j = !0;
      const G = k[k.length - 1];
      if (G?.kind === "text")
        G.source = (G.source ?? G.text) + x.data, G.text = Id(G.source, S), G.text === G.source && delete G.source;
      else {
        const I = Id(x.data, S);
        k.push(I === x.data ? { kind: "text", text: I } : { kind: "text", text: I, source: x.data });
      }
      continue;
    }
    if (!(x instanceof Vt)) continue;
    const _ = Bf(x, d, y, i, o, L === 0, L === A - 1, L);
    L++;
    const T = i.cache.get(x);
    s.volatile ||= T.volatile, s.subAnc ||= T.subAnc;
    const D = _[We];
    D === "inline" || D === "inline-block" || D === "inline-flex" ? j = !0 : D !== "none" && (H = !0), k.push(_);
  }
  if (/(^|\s)inline-flex(\s|$)/.test(String(n.props?.className ?? "")) && v.w === void 0) {
    for (let x = 0; x < k.length; x++)
      if (k[x].style?.flex_grow && k[x].style.min_w === 0 && k[x].style.overflow_x === "hidden") {
        const _ = Mr(k, x);
        delete _.style.min_w, delete _.style.flex_grow, delete _.style.flex_basis, delete _.style.overflow_x, delete _.style.overflow_y;
      }
  }
  if (!v.display && j && k.some((x) => x.kind !== "text") && k.every((x) => x.kind === "text" || bg(x))) {
    const x = k.map((_) => _.kind === "text" ? _.text : _.children.map((T) => T.text).join("")).join("");
    w("approximated", "display", "inline text elements in a line of text", "(inline formatting)", "their text joined to the line, in its font"), k.splice(0, k.length, { kind: "text", text: x });
  }
  const U = k.some((x) => x.kind !== "text");
  let R = k.length === 1 && k[0].kind !== "text" && /^inline-(block|flex)$/.test(k[0][We]) ? k[0] : null;
  if (!v.display && R) {
    R = Mr(k, 0);
    const x = i.cache.get(n.childNodes.find((T) => T.id === R.id))?.part.computed, _ = x ? Zr(d.values, i.measure) - _g(x.values, i.measure, R) : 0;
    v.display = "flex", v.flex_direction = "col", v.items = "start", _ > 0 && (R.style.mt = Math.round(((R.style.mt ?? 0) + _) * 100) / 100), w("approximated", "display", `${d.values.display} holding one ${R[We]} box`, "(inline formatting)", "a column, the box lowered to the line's baseline");
  } else if (!v.display && k.length === 1 && (k[0].kind === "svg" || k[0].kind === "image") && k[0][We] === "inline" && typeof k[0].style.h == "number") {
    const x = Mr(k, 0), _ = Zr(d.values, i.measure), T = _l(d.values, i.measure) - _, D = (G) => Math.round(G * 100) / 100;
    v.display = "flex", v.flex_direction = "col", v.items = "start", _ > x.style.h && (x.style.mt = D((x.style.mt ?? 0) + _ - x.style.h)), T > 0 && (x.style.mb = D((x.style.mb ?? 0) + T)), w("approximated", "display", `${d.values.display} holding one inline image`, "(inline formatting)", "a column, the image on the line's baseline");
  } else if (!v.display && j && U) {
    if (v.display = "flex", v.flex_direction = H ? "col" : "row", !H) v.items = "baseline";
    else for (let x = 0; x < k.length; x++) k[x].kind !== "text" && /^inline-(block|flex)$/.test(k[x][We]) && !k[x].style.self && (Mr(k, x).style.self = "start");
    w("approximated", "display", `${d.values.display} with inline content`, "(inline formatting)", H ? "a column of its children" : "a row on the text baseline");
  }
  const h = d.values["letter-spacing"]?.px, b = d.values["overflow-x"] !== "visible";
  if (h)
    for (let x = 0; x < k.length; x++) {
      const _ = k[x];
      if (_.kind !== "text") continue;
      const T = Math.round(h * [..._.text].length * 1e3) / 1e3;
      if (h > 0 || !b) {
        k[x] = { kind: "div", style: { pr: T }, tokens: {}, children: [_] };
        continue;
      }
      const D = d.values["font-size"], G = Math.max(0.8, 1 + h / (0.55 * D)), I = Math.round(_l(d.values, i.measure) * 1e3) / 1e3;
      k[x] = { kind: "div", style: { text_size: Math.round(D * G * 1e3) / 1e3, line_height: `${I}px` }, tokens: {}, children: [_] };
    }
  return z.children = k, z;
}
function xg(n, l) {
  if (!l) return null;
  let o = (l.self ? n : l.closest ? _f(n, l.closest) : l.find ? kl(n, l.find)[0] : null)?.getAttribute(l.attr) ?? null;
  return o && l.strip && o.startsWith(l.strip) && (o = o.slice(l.strip.length)), o;
}
function wg(n, l, i) {
  const o = l.map((m) => [m, $r(m.selector)]), s = /* @__PURE__ */ new Map(), d = (m) => {
    for (const f of m.children) {
      const p = i.get(f.id);
      if (p)
        for (const [y, E] of o) {
          const w = y.textRange ? "range_name" : "name";
          if (y.textRange && p[w] != null || !E.some((S) => Po(f, S))) continue;
          const v = xg(f, y.key), z = v == null ? s.get(y.name) ?? 0 : 0;
          v == null && s.set(y.name, z + 1);
          const N = v != null ? `${y.name}:${v}` : z ? `${y.name}@${z}` : y.name;
          p[w] == null ? p[w] = N : (p.also ??= []).push(N);
        }
      d(f);
    }
  };
  d(n.documentElement);
}
const Xr = 0.9521, Uf = 0.2256, Zr = (n, l) => (_l(n, l) - (Xr + Uf) * n["font-size"]) / 2 + Xr * n["font-size"];
function _g(n, l, i) {
  const o = (p) => p && typeof p == "object" && "px" in p ? p.px : 0, s = n["border-top-style"] === "none" ? 0 : o(n["border-top-width"]), d = i?.children ?? [], m = d.length === 1 && (d[0].kind === "svg" || d[0].kind === "image") && typeof d[0].style.h == "number" ? d[0] : null, f = m ? Math.max(Zr(n, l), (m.style.mt ?? 0) + m.style.h) : Zr(n, l);
  return o(n["padding-top"]) + s + f;
}
const Id = (n, l) => l === "uppercase" ? n.toUpperCase() : l === "lowercase" ? n.toLowerCase() : l === "capitalize" ? n.replace(/\b\p{L}/gu, (i) => i.toUpperCase()) : n, qf = /* @__PURE__ */ new Set(["children", "style", "className", "key", "ref", "dangerouslySetInnerHTML"]);
function Sg(n) {
  const l = {};
  for (const [i, o] of Object.entries(n.props)) {
    if (qf.has(i) || typeof o == "function" || o === void 0 || o === null || typeof o == "object") continue;
    const s = i.startsWith("aria-") || i.startsWith("data-");
    if (o === !1 && !s) continue;
    const d = i === "htmlFor" ? "for" : i === "tabIndex" ? "tabindex" : i;
    l[d] = typeof o == "boolean" ? s ? String(o) : "" : String(o);
  }
  return { tag: n.tagName, classes: n.classList, attrs: l };
}
const kg = (n) => n === "className" ? "class" : /^(viewBox|preserveAspectRatio|gradientUnits|gradientTransform|patternUnits|xmlns)$/.test(n) ? n : n.replace(/[A-Z]/g, (l) => `-${l.toLowerCase()}`), $d = (n) => String(n).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
function Eg(n) {
  if (n.props["data-perch-markup"]) return String(n.props["data-perch-markup"]);
  const l = (i) => {
    const o = [];
    for (const [d, m] of Object.entries(i.props))
      qf.has(d) || typeof m == "function" || m === void 0 || m === null || m === !1 || typeof m == "object" || d.startsWith("data-") || d.startsWith("aria-") || d === "focusable" || d === "role" || d === "title" || o.push(`${kg(d)}="${$d(m === !0 ? "" : m)}"`);
    i.tagName === "svg" && !i.props.xmlns && o.unshift('xmlns="http://www.w3.org/2000/svg"');
    const s = i.childNodes.map((d) => d instanceof Pr ? $d(d.data) : l(d)).join("");
    return `<${i.tagName}${o.length ? ` ${o.join(" ")}` : ""}>${s}</${i.tagName}>`;
  };
  return l(n);
}
function zg(n) {
  const l = n.theme?.() ?? {}, i = {};
  for (const o of Cf) l[o] && (i[o] = l[o]);
  return i;
}
const Ng = { font_features: "" };
function Tg(n, l, i, o = {}, s = null) {
  const d = zg(l), m = l.viewport?.() ?? { width: 1e3, height: 800 }, f = JSON.stringify([d, m]);
  (o.look !== f || o.sheet !== i) && Object.assign(o, { look: f, sheet: i, cache: /* @__PURE__ */ new WeakMap(), cascade: new W0(i, { theme: d, viewport: m }), top: null });
  const { cascade: p, cache: y } = o, E = new ig(), w = [], z = { cascade: p, cache: y, viewport: m, findings: E, log: w, add: (...j) => {
    w.push(j), E.add(...j);
  }, now: es(), measure: l.lineHeight ? (j) => l.lineHeight(j) : null };
  o.top ??= p.compute(n.body, p.compute(n.documentElement, null));
  const N = n.body.children, S = N.map((j, H) => Bf(j, o.top, Ng, z, 0, H === 0, H === N.length - 1, H));
  if (s?.length) {
    const j = /* @__PURE__ */ new Map(), H = (A) => {
      A.id && (j.set(A.id, A), delete A.name, delete A.range_name, delete A.also);
      for (const L of A.children ?? []) H(L);
    };
    S.forEach(H), wg(n, s, j);
  }
  const k = /* @__PURE__ */ new Set();
  for (const j of [n, n.defaultView])
    for (const { type: H } of j?.listeners ?? []) Ld[H] && k.add(Ld[H]);
  return { schema: P0, root: S[0] ?? null, overlays: S.slice(1), document_events: [...k].sort(), unsupported: z.findings.list() };
}
const Cg = { layers: ["properties", "theme", "base", "utilities"], properties: { "--tw-translate-x": { inherits: !1, initial: "0" }, "--tw-translate-y": { inherits: !1, initial: "0" }, "--tw-translate-z": { inherits: !1, initial: "0" }, "--tw-rotate-x": { inherits: !1, initial: null }, "--tw-rotate-y": { inherits: !1, initial: null }, "--tw-rotate-z": { inherits: !1, initial: null }, "--tw-skew-x": { inherits: !1, initial: null }, "--tw-skew-y": { inherits: !1, initial: null }, "--tw-space-y-reverse": { inherits: !1, initial: "0" }, "--tw-border-style": { inherits: !1, initial: "solid" }, "--tw-leading": { inherits: !1, initial: null }, "--tw-font-weight": { inherits: !1, initial: null }, "--tw-tracking": { inherits: !1, initial: null }, "--tw-ordinal": { inherits: !1, initial: null }, "--tw-slashed-zero": { inherits: !1, initial: null }, "--tw-numeric-figure": { inherits: !1, initial: null }, "--tw-numeric-spacing": { inherits: !1, initial: null }, "--tw-numeric-fraction": { inherits: !1, initial: null }, "--tw-shadow": { inherits: !1, initial: "0 0 #0000" }, "--tw-shadow-color": { inherits: !1, initial: null }, "--tw-shadow-alpha": { inherits: !1, initial: "100%" }, "--tw-inset-shadow": { inherits: !1, initial: "0 0 #0000" }, "--tw-inset-shadow-color": { inherits: !1, initial: null }, "--tw-inset-shadow-alpha": { inherits: !1, initial: "100%" }, "--tw-ring-color": { inherits: !1, initial: null }, "--tw-ring-shadow": { inherits: !1, initial: "0 0 #0000" }, "--tw-inset-ring-color": { inherits: !1, initial: null }, "--tw-inset-ring-shadow": { inherits: !1, initial: "0 0 #0000" }, "--tw-ring-inset": { inherits: !1, initial: null }, "--tw-ring-offset-width": { inherits: !1, initial: "0" }, "--tw-ring-offset-color": { inherits: !1, initial: "#fff" }, "--tw-ring-offset-shadow": { inherits: !1, initial: "0 0 #0000" }, "--tw-outline-style": { inherits: !1, initial: "solid" }, "--tw-blur": { inherits: !1, initial: null }, "--tw-brightness": { inherits: !1, initial: null }, "--tw-contrast": { inherits: !1, initial: null }, "--tw-grayscale": { inherits: !1, initial: null }, "--tw-hue-rotate": { inherits: !1, initial: null }, "--tw-invert": { inherits: !1, initial: null }, "--tw-opacity": { inherits: !1, initial: null }, "--tw-saturate": { inherits: !1, initial: null }, "--tw-sepia": { inherits: !1, initial: null }, "--tw-drop-shadow": { inherits: !1, initial: null }, "--tw-drop-shadow-color": { inherits: !1, initial: null }, "--tw-drop-shadow-alpha": { inherits: !1, initial: "100%" }, "--tw-drop-shadow-size": { inherits: !1, initial: null }, "--tw-backdrop-blur": { inherits: !1, initial: null }, "--tw-backdrop-brightness": { inherits: !1, initial: null }, "--tw-backdrop-contrast": { inherits: !1, initial: null }, "--tw-backdrop-grayscale": { inherits: !1, initial: null }, "--tw-backdrop-hue-rotate": { inherits: !1, initial: null }, "--tw-backdrop-invert": { inherits: !1, initial: null }, "--tw-backdrop-opacity": { inherits: !1, initial: null }, "--tw-backdrop-saturate": { inherits: !1, initial: null }, "--tw-backdrop-sepia": { inherits: !1, initial: null }, "--tw-duration": { inherits: !1, initial: null }, "--tw-ease": { inherits: !1, initial: null }, "--tw-content": { inherits: !1, initial: '""' } }, rules: [[":root, :host", null, 2, [["--spacing", ".25rem"], ["--text-xs", ".75rem"], ["--text-xs--line-height", "calc(1 / .75)"], ["--text-sm", ".875rem"], ["--text-sm--line-height", "calc(1.25 / .875)"], ["--font-weight-normal", "400"], ["--font-weight-medium", "500"], ["--font-weight-semibold", "600"], ["--font-weight-bold", "700"], ["--tracking-normal", "0em"], ["--tracking-wide", ".025em"], ["--leading-tight", "1.25"], ["--leading-relaxed", "1.625"], ["--ease-out", "cubic-bezier(0, 0, .2, 1)"], ["--animate-pulse", "pulse 2s cubic-bezier(.4, 0, .6, 1) infinite"], ["--blur-xl", "24px"], ["--default-transition-duration", ".15s"], ["--default-transition-timing-function", "cubic-bezier(.4, 0, .2, 1)"], ["--animate-toast-in", "toast-in .2s cubic-bezier(.22, 1, .36, 1)"], ["--animate-host-pulse", "host-connecting-pulse 1.4s ease-in-out infinite"], ["--animate-drop-zone", "drop-zone-in .14s ease-out, drop-zone-pulse 1.2s ease-in-out .14s infinite"]]], ["::selection", null, 3, [["background", "var(--accent)"], ["color", "var(--panel-bg)"]]], [":where(input, textarea)::placeholder", null, 3, [["color", "var(--subtext-0)"], ["opacity", "1"]]], [":where(button, input, select, textarea)", null, 3, [["border", "0"]]], [':where(button, a[href], select, summary, [role="button"], [role="menuitem"]):focus-visible', null, 3, [["outline", "2px solid var(--accent)"], ["outline-offset", "-2px"]]], ["::-webkit-scrollbar", null, 3, [["width", "var(--scrollbar-size)"], ["height", "var(--scrollbar-size)"]]], ["::-webkit-scrollbar-track", null, 3, [["background", "none"]]], ["::-webkit-scrollbar-corner", null, 3, [["background", "none"]]], ["::-webkit-scrollbar-thumb", null, 3, [["background", "var(--text)"]]], ["::-webkit-scrollbar-thumb", null, 3, [["background", "color-mix(in srgb, var(--text) 20%, transparent)"]]], ["::-webkit-scrollbar-thumb", null, 3, [["border-radius", "var(--scrollbar-size)"]]], ["::-webkit-scrollbar-thumb:hover", null, 3, [["background", "var(--text)"]]], ["::-webkit-scrollbar-thumb:hover", null, 3, [["background", "color-mix(in srgb, var(--text) 40%, transparent)"]]], [".xterm .xterm-scrollable-element > .xterm-scrollbar > .xterm-slider", null, 3, [["border-radius", "var(--scrollbar-size)"]]], [".\\@container, .\\[container-type\\:inline-size\\]", null, 4, [["container-type", "inline-size"]]], [".pointer-events-auto", null, 4, [["pointer-events", "auto"]]], [".pointer-events-none", null, 4, [["pointer-events", "none"]]], [".collapse", null, 4, [["visibility", "collapse"]]], [".invisible", null, 4, [["visibility", "hidden"]]], [".visible", null, 4, [["visibility", "visible"]]], [".sr-only", null, 4, [["clip-path", "inset(50%)"], ["white-space", "nowrap"], ["border-width", "0"], ["width", "1px"], ["height", "1px"], ["margin", "-1px"], ["padding", "0"], ["position", "absolute"], ["overflow", "hidden"]]], [".absolute", null, 4, [["position", "absolute"]]], [".fixed", null, 4, [["position", "fixed"]]], [".relative", null, 4, [["position", "relative"]]], [".static", null, 4, [["position", "static"]]], [".sticky", null, 4, [["position", "sticky"]]], [".inset-0", null, 4, [["inset", "0"]]], [".inset-x-0", null, 4, [["inset-inline", "0"]]], [".inset-x-2", null, 4, [["inset-inline", "calc(var(--spacing) * 2)"]]], [".-top-1", null, 4, [["top", "calc(var(--spacing) * -1)"]]], [".-top-1\\.5", null, 4, [["top", "calc(var(--spacing) * -1.5)"]]], [".top-0", null, 4, [["top", "0"]]], [".top-1", null, 4, [["top", "var(--spacing)"]]], [".top-1\\.5", null, 4, [["top", "calc(var(--spacing) * 1.5)"]]], [".top-1\\/2", null, 4, [["top", "50%"]]], [".top-2", null, 4, [["top", "calc(var(--spacing) * 2)"]]], [".top-4", null, 4, [["top", "calc(var(--spacing) * 4)"]]], [".top-\\[0\\.1rem\\]", null, 4, [["top", ".1rem"]]], [".top-\\[7px\\]", null, 4, [["top", "7px"]]], [".top-\\[max\\(0\\.75rem\\,env\\(safe-area-inset-top\\)\\)\\]", null, 4, [["top", "max(.75rem, env(safe-area-inset-top))"]]], [".top-full", null, 4, [["top", "100%"]]], [".top-px", null, 4, [["top", "1px"]]], [".-right-1", null, 4, [["right", "calc(var(--spacing) * -1)"]]], [".-right-1\\.5", null, 4, [["right", "calc(var(--spacing) * -1.5)"]]], [".right-0", null, 4, [["right", "0"]]], [".right-1", null, 4, [["right", "var(--spacing)"]]], [".right-3", null, 4, [["right", "calc(var(--spacing) * 3)"]]], [".right-4", null, 4, [["right", "calc(var(--spacing) * 4)"]]], [".right-\\[0\\.8rem\\]", null, 4, [["right", ".8rem"]]], [".right-\\[0\\.25rem\\]", null, 4, [["right", ".25rem"]]], [".right-\\[max\\(0\\.75rem\\,env\\(safe-area-inset-right\\)\\)\\]", null, 4, [["right", "max(.75rem, env(safe-area-inset-right))"]]], [".bottom-0", null, 4, [["bottom", "0"]]], [".bottom-2", null, 4, [["bottom", "calc(var(--spacing) * 2)"]]], [".bottom-3", null, 4, [["bottom", "calc(var(--spacing) * 3)"]]], [".bottom-\\[0\\.8rem\\]", null, 4, [["bottom", ".8rem"]]], [".bottom-full", null, 4, [["bottom", "100%"]]], [".-left-8", null, 4, [["left", "calc(var(--spacing) * -8)"]]], [".-left-\\[2px\\]", null, 4, [["left", "-2px"]]], [".left-0", null, 4, [["left", "0"]]], [".left-2", null, 4, [["left", "calc(var(--spacing) * 2)"]]], [".left-\\[0\\.1rem\\]", null, 4, [["left", ".1rem"]]], [".left-\\[max\\(0\\.75rem\\,env\\(safe-area-inset-left\\)\\)\\]", null, 4, [["left", "max(.75rem, env(safe-area-inset-left))"]]], [".left-px", null, 4, [["left", "1px"]]], [".isolate", null, 4, [["isolation", "isolate"]]], [".z-4", null, 4, [["z-index", "4"]]], [".z-5", null, 4, [["z-index", "5"]]], [".z-10", null, 4, [["z-index", "10"]]], [".z-20", null, 4, [["z-index", "20"]]], [".z-30", null, 4, [["z-index", "30"]]], [".z-40", null, 4, [["z-index", "40"]]], [".z-50", null, 4, [["z-index", "50"]]], [".z-\\[2\\]", null, 4, [["z-index", "2"]]], [".z-\\[3\\]", null, 4, [["z-index", "3"]]], [".z-\\[5\\]", null, 4, [["z-index", "5"]]], [".z-\\[1000\\]", null, 4, [["z-index", "1000"]]], [".z-\\[2000\\]", null, 4, [["z-index", "2000"]]], [".z-\\[2100\\]", null, 4, [["z-index", "2100"]]], [".z-\\[2200\\]", null, 4, [["z-index", "2200"]]], [".z-\\[3000\\]", null, 4, [["z-index", "3000"]]], [".z-\\[3100\\]", null, 4, [["z-index", "3100"]]], [".z-\\[4000\\]", null, 4, [["z-index", "4000"]]], [".z-\\[9998\\]", null, 4, [["z-index", "9998"]]], [".z-\\[9999\\]", null, 4, [["z-index", "9999"]]], [".z-\\[10000\\]", null, 4, [["z-index", "10000"]]], [".z-auto", null, 4, [["z-index", "auto"]]], [".order-last", null, 4, [["order", "9999"]]], [".col-\\[1\\/-1\\]", null, 4, [["grid-column", "1 / -1"]]], [".container", null, 4, [["width", "100%"]]], [".container", ["(min-width: 40rem)"], 4, [["max-width", "40rem"]]], [".container", ["(min-width: 48rem)"], 4, [["max-width", "48rem"]]], [".container", ["(min-width: 64rem)"], 4, [["max-width", "64rem"]]], [".container", ["(min-width: 80rem)"], 4, [["max-width", "80rem"]]], [".container", ["(min-width: 96rem)"], 4, [["max-width", "96rem"]]], [".m-0", null, 4, [["margin", "0"]]], [".m-2", null, 4, [["margin", "calc(var(--spacing) * 2)"]]], [".m-\\[0\\.7rem\\]", null, 4, [["margin", ".7rem"]]], [".m-auto", null, 4, [["margin", "auto"]]], [".mx-0", null, 4, [["margin-inline", "0"]]], [".mx-0\\.5", null, 4, [["margin-inline", "calc(var(--spacing) * .5)"]]], [".mx-2", null, 4, [["margin-inline", "calc(var(--spacing) * 2)"]]], [".mx-3", null, 4, [["margin-inline", "calc(var(--spacing) * 3)"]]], [".mx-4", null, 4, [["margin-inline", "calc(var(--spacing) * 4)"]]], [".mx-\\[0\\.3rem\\]", null, 4, [["margin-inline", ".3rem"]]], [".mx-\\[0\\.7rem\\]", null, 4, [["margin-inline", ".7rem"]]], [".mx-\\[0\\.65rem\\]", null, 4, [["margin-inline", ".65rem"]]], [".mx-\\[3px\\]", null, 4, [["margin-inline", "3px"]]], [".mx-\\[11px\\]", null, 4, [["margin-inline", "11px"]]], [".mx-auto", null, 4, [["margin-inline", "auto"]]], [".my-0\\.5", null, 4, [["margin-block", "calc(var(--spacing) * .5)"]]], [".my-1", null, 4, [["margin-block", "var(--spacing)"]]], [".my-2", null, 4, [["margin-block", "calc(var(--spacing) * 2)"]]], [".my-\\[0\\.2rem\\]", null, 4, [["margin-block", ".2rem"]]], [".my-\\[0\\.3rem\\]", null, 4, [["margin-block", ".3rem"]]], [".my-\\[0\\.6rem\\]", null, 4, [["margin-block", ".6rem"]]], [".my-\\[0\\.28rem\\]", null, 4, [["margin-block", ".28rem"]]], [".my-\\[0\\.45rem\\]", null, 4, [["margin-block", ".45rem"]]], [".my-\\[0\\.55rem\\]", null, 4, [["margin-block", ".55rem"]]], [".my-\\[3px\\]", null, 4, [["margin-block", "3px"]]], [".-mt-\\[2px\\]", null, 4, [["margin-top", "-2px"]]], [".mt-0", null, 4, [["margin-top", "0"]]], [".mt-0\\.5", null, 4, [["margin-top", "calc(var(--spacing) * .5)"]]], [".mt-1", null, 4, [["margin-top", "var(--spacing)"]]], [".mt-1\\.5", null, 4, [["margin-top", "calc(var(--spacing) * 1.5)"]]], [".mt-2", null, 4, [["margin-top", "calc(var(--spacing) * 2)"]]], [".mt-3", null, 4, [["margin-top", "calc(var(--spacing) * 3)"]]], [".mt-4", null, 4, [["margin-top", "calc(var(--spacing) * 4)"]]], [".mt-\\[0\\.1rem\\]", null, 4, [["margin-top", ".1rem"]]], [".mt-\\[0\\.2rem\\]", null, 4, [["margin-top", ".2rem"]]], [".mt-\\[0\\.3rem\\]", null, 4, [["margin-top", ".3rem"]]], [".mt-\\[0\\.4rem\\]", null, 4, [["margin-top", ".4rem"]]], [".mt-\\[0\\.5rem\\]", null, 4, [["margin-top", ".5rem"]]], [".mt-\\[0\\.15rem\\]", null, 4, [["margin-top", ".15rem"]]], [".mt-\\[0\\.35rem\\]", null, 4, [["margin-top", ".35rem"]]], [".mr-1", null, 4, [["margin-right", "var(--spacing)"]]], [".mr-1\\.5", null, 4, [["margin-right", "calc(var(--spacing) * 1.5)"]]], [".mr-\\[0\\.3rem\\]", null, 4, [["margin-right", ".3rem"]]], [".mr-\\[0\\.7rem\\]", null, 4, [["margin-right", ".7rem"]]], [".mr-auto", null, 4, [["margin-right", "auto"]]], [".mb-0", null, 4, [["margin-bottom", "0"]]], [".mb-0\\.5", null, 4, [["margin-bottom", "calc(var(--spacing) * .5)"]]], [".mb-1", null, 4, [["margin-bottom", "var(--spacing)"]]], [".mb-2", null, 4, [["margin-bottom", "calc(var(--spacing) * 2)"]]], [".mb-3", null, 4, [["margin-bottom", "calc(var(--spacing) * 3)"]]], [".mb-4", null, 4, [["margin-bottom", "calc(var(--spacing) * 4)"]]], [".mb-8", null, 4, [["margin-bottom", "calc(var(--spacing) * 8)"]]], [".mb-\\[0\\.2rem\\]", null, 4, [["margin-bottom", ".2rem"]]], [".mb-\\[0\\.3rem\\]", null, 4, [["margin-bottom", ".3rem"]]], [".mb-\\[0\\.4rem\\]", null, 4, [["margin-bottom", ".4rem"]]], [".mb-\\[0\\.6rem\\]", null, 4, [["margin-bottom", ".6rem"]]], [".mb-\\[0\\.7rem\\]", null, 4, [["margin-bottom", ".7rem"]]], [".mb-\\[0\\.9rem\\]", null, 4, [["margin-bottom", ".9rem"]]], [".mb-\\[0\\.15rem\\]", null, 4, [["margin-bottom", ".15rem"]]], [".mb-\\[0\\.35rem\\]", null, 4, [["margin-bottom", ".35rem"]]], [".mb-\\[0\\.55rem\\]", null, 4, [["margin-bottom", ".55rem"]]], [".mb-\\[1\\.1rem\\]", null, 4, [["margin-bottom", "1.1rem"]]], [".-ml-0\\.5", null, 4, [["margin-left", "calc(var(--spacing) * -.5)"]]], [".-ml-1", null, 4, [["margin-left", "calc(var(--spacing) * -1)"]]], [".-ml-2", null, 4, [["margin-left", "calc(var(--spacing) * -2)"]]], [".ml-1", null, 4, [["margin-left", "var(--spacing)"]]], [".ml-2", null, 4, [["margin-left", "calc(var(--spacing) * 2)"]]], [".ml-\\[0\\.4rem\\]", null, 4, [["margin-left", ".4rem"]]], [".ml-\\[0\\.5rem\\]", null, 4, [["margin-left", ".5rem"]]], [".ml-\\[0\\.9rem\\]", null, 4, [["margin-left", ".9rem"]]], [".ml-\\[0\\.35rem\\]", null, 4, [["margin-left", ".35rem"]]], [".ml-\\[0\\.55rem\\]", null, 4, [["margin-left", ".55rem"]]], [".ml-\\[1\\.15rem\\]", null, 4, [["margin-left", "1.15rem"]]], [".ml-\\[1\\.45rem\\]", null, 4, [["margin-left", "1.45rem"]]], [".ml-\\[2\\.025rem\\]", null, 4, [["margin-left", "2.025rem"]]], [".ml-\\[2\\.375rem\\]", null, 4, [["margin-left", "2.375rem"]]], [".ml-\\[6\\.1rem\\]", null, 4, [["margin-left", "6.1rem"]]], [".ml-auto", null, 4, [["margin-left", "auto"]]], [".box-border", null, 4, [["box-sizing", "border-box"]]], [".\\!hidden", null, 4, [["display", "none", 1]]], [".\\[display\\:-webkit-box\\]", null, 4, [["display", "-webkit-box"]]], [".\\[display\\:var\\(--pane-grip\\,flex\\)\\]", null, 4, [["display", "var(--pane-grip, flex)"]]], [".block", null, 4, [["display", "block"]]], [".contents", null, 4, [["display", "contents"]]], [".flex", null, 4, [["display", "flex"]]], [".grid", null, 4, [["display", "grid"]]], [".hidden", null, 4, [["display", "none"]]], [".inline", null, 4, [["display", "inline"]]], [".inline-block", null, 4, [["display", "inline-block"]]], [".inline-flex", null, 4, [["display", "inline-flex"]]], [".table", null, 4, [["display", "table"]]], [".size-1", null, 4, [["width", "var(--spacing)"], ["height", "var(--spacing)"]]], [".size-1\\.5", null, 4, [["width", "calc(var(--spacing) * 1.5)"], ["height", "calc(var(--spacing) * 1.5)"]]], [".size-2", null, 4, [["width", "calc(var(--spacing) * 2)"], ["height", "calc(var(--spacing) * 2)"]]], [".size-3", null, 4, [["width", "calc(var(--spacing) * 3)"], ["height", "calc(var(--spacing) * 3)"]]], [".size-5", null, 4, [["width", "calc(var(--spacing) * 5)"], ["height", "calc(var(--spacing) * 5)"]]], [".size-6", null, 4, [["width", "calc(var(--spacing) * 6)"], ["height", "calc(var(--spacing) * 6)"]]], [".size-7", null, 4, [["width", "calc(var(--spacing) * 7)"], ["height", "calc(var(--spacing) * 7)"]]], [".size-8", null, 4, [["width", "calc(var(--spacing) * 8)"], ["height", "calc(var(--spacing) * 8)"]]], [".size-11", null, 4, [["width", "calc(var(--spacing) * 11)"], ["height", "calc(var(--spacing) * 11)"]]], [".size-14", null, 4, [["width", "calc(var(--spacing) * 14)"], ["height", "calc(var(--spacing) * 14)"]]], [".size-\\[0\\.6rem\\]", null, 4, [["width", ".6rem"], ["height", ".6rem"]]], [".size-\\[1\\.2rem\\]", null, 4, [["width", "1.2rem"], ["height", "1.2rem"]]], [".size-\\[5px\\]", null, 4, [["width", "5px"], ["height", "5px"]]], [".size-\\[14px\\]", null, 4, [["width", "14px"], ["height", "14px"]]], [".size-\\[calc\\(14px\\*var\\(--zoom\\,1\\)\\)\\]", null, 4, [["width", "calc(14px * var(--zoom, 1))"], ["height", "calc(14px * var(--zoom, 1))"]]], [".size-full", null, 4, [["width", "100%"], ["height", "100%"]]], [".h-1", null, 4, [["height", "var(--spacing)"]]], [".h-1\\.5", null, 4, [["height", "calc(var(--spacing) * 1.5)"]]], [".h-2", null, 4, [["height", "calc(var(--spacing) * 2)"]]], [".h-3", null, 4, [["height", "calc(var(--spacing) * 3)"]]], [".h-4", null, 4, [["height", "calc(var(--spacing) * 4)"]]], [".h-5", null, 4, [["height", "calc(var(--spacing) * 5)"]]], [".h-6", null, 4, [["height", "calc(var(--spacing) * 6)"]]], [".h-7", null, 4, [["height", "calc(var(--spacing) * 7)"]]], [".h-8", null, 4, [["height", "calc(var(--spacing) * 8)"]]], [".h-9", null, 4, [["height", "calc(var(--spacing) * 9)"]]], [".h-11", null, 4, [["height", "calc(var(--spacing) * 11)"]]], [".h-12", null, 4, [["height", "calc(var(--spacing) * 12)"]]], [".h-44", null, 4, [["height", "calc(var(--spacing) * 44)"]]], [".h-\\[1\\.1rem\\]", null, 4, [["height", "1.1rem"]]], [".h-\\[1\\.3rem\\]", null, 4, [["height", "1.3rem"]]], [".h-\\[1\\.4rem\\]", null, 4, [["height", "1.4rem"]]], [".h-\\[1\\.25rem\\]", null, 4, [["height", "1.25rem"]]], [".h-\\[2px\\]", null, 4, [["height", "2px"]]], [".h-\\[14px\\]", null, 4, [["height", "14px"]]], [".h-\\[18px\\]", null, 4, [["height", "18px"]]], [".h-\\[43px\\]", null, 4, [["height", "43px"]]], [".h-\\[calc\\(100\\%-max\\(0\\.5rem\\,env\\(safe-area-inset-top\\)\\)\\)\\]", null, 4, [["height", "calc(100% - max(.5rem, env(safe-area-inset-top)))"]]], [".h-full", null, 4, [["height", "100%"]]], [".h-px", null, 4, [["height", "1px"]]], [".max-h-40", null, 4, [["max-height", "calc(var(--spacing) * 40)"]]], [".max-h-56", null, 4, [["max-height", "calc(var(--spacing) * 56)"]]], [".max-h-72", null, 4, [["max-height", "calc(var(--spacing) * 72)"]]], [".max-h-\\[8rem\\]", null, 4, [["max-height", "8rem"]]], [".max-h-\\[13rem\\]", null, 4, [["max-height", "13rem"]]], [".max-h-\\[30\\%\\]", null, 4, [["max-height", "30%"]]], [".max-h-\\[30vh\\]", null, 4, [["max-height", "30vh"]]], [".max-h-\\[35vh\\]", null, 4, [["max-height", "35vh"]]], [".max-h-\\[40\\%\\]", null, 4, [["max-height", "40%"]]], [".max-h-\\[50dvh\\]", null, 4, [["max-height", "50dvh"]]], [".max-h-\\[60\\%\\]", null, 4, [["max-height", "60%"]]], [".max-h-\\[70\\%\\]", null, 4, [["max-height", "70%"]]], [".max-h-\\[85vh\\]", null, 4, [["max-height", "85vh"]]], [".max-h-\\[90\\%\\]", null, 4, [["max-height", "90%"]]], [".max-h-\\[190px\\]", null, 4, [["max-height", "190px"]]], [".max-h-\\[240px\\]", null, 4, [["max-height", "240px"]]], [".max-h-\\[260px\\]", null, 4, [["max-height", "260px"]]], [".max-h-\\[calc\\(85vh-4rem\\)\\]", null, 4, [["max-height", "calc(85vh - 4rem)"]]], [".max-h-\\[calc\\(100dvh_-_4rem\\)\\]", null, 4, [["max-height", "calc(100dvh - 4rem)"]]], [".max-h-\\[min\\(420px\\,calc\\(100dvh_-_16vh_-_2rem\\)\\)\\]", null, 4, [["max-height", "min(420px, 100dvh - 16vh - 2rem)"]]], [".max-h-\\[min\\(480px\\,calc\\(100dvh_-_16vh_-_2rem\\)\\)\\]", null, 4, [["max-height", "min(480px, 100dvh - 16vh - 2rem)"]]], [".max-h-full", null, 4, [["max-height", "100%"]]], [".min-h-0", null, 4, [["min-height", "0"]]], [".min-h-6", null, 4, [["min-height", "calc(var(--spacing) * 6)"]]], [".min-h-7", null, 4, [["min-height", "calc(var(--spacing) * 7)"]]], [".min-h-8", null, 4, [["min-height", "calc(var(--spacing) * 8)"]]], [".min-h-9", null, 4, [["min-height", "calc(var(--spacing) * 9)"]]], [".min-h-10", null, 4, [["min-height", "calc(var(--spacing) * 10)"]]], [".min-h-11", null, 4, [["min-height", "calc(var(--spacing) * 11)"]]], [".min-h-20", null, 4, [["min-height", "calc(var(--spacing) * 20)"]]], [".min-h-40", null, 4, [["min-height", "calc(var(--spacing) * 40)"]]], [".min-h-\\[1\\.5em\\]", null, 4, [["min-height", "1.5em"]]], [".min-h-\\[1\\.8rem\\]", null, 4, [["min-height", "1.8rem"]]], [".min-h-\\[2\\.5rem\\]", null, 4, [["min-height", "2.5rem"]]], [".min-h-\\[3\\.2rem\\]", null, 4, [["min-height", "3.2rem"]]], [".min-h-\\[3\\.25rem\\]", null, 4, [["min-height", "3.25rem"]]], [".min-h-\\[6rem\\]", null, 4, [["min-height", "6rem"]]], [".min-h-\\[8rem\\]", null, 4, [["min-height", "8rem"]]], [".min-h-\\[10rem\\]", null, 4, [["min-height", "10rem"]]], [".min-h-\\[12rem\\]", null, 4, [["min-height", "12rem"]]], [".min-h-\\[13rem\\]", null, 4, [["min-height", "13rem"]]], [".min-h-\\[32px\\]", null, 4, [["min-height", "32px"]]], [".min-h-\\[44px\\]", null, 4, [["min-height", "44px"]]], [".min-h-\\[60px\\]", null, 4, [["min-height", "60px"]]], [".min-h-\\[100dvh\\]", null, 4, [["min-height", "100dvh"]]], [".min-h-\\[calc\\(22px\\*var\\(--zoom\\,1\\)\\)\\]", null, 4, [["min-height", "calc(22px * var(--zoom, 1))"]]], [".min-h-full", null, 4, [["min-height", "100%"]]], [".w-2", null, 4, [["width", "calc(var(--spacing) * 2)"]]], [".w-2\\.5", null, 4, [["width", "calc(var(--spacing) * 2.5)"]]], [".w-3", null, 4, [["width", "calc(var(--spacing) * 3)"]]], [".w-4", null, 4, [["width", "calc(var(--spacing) * 4)"]]], [".w-5", null, 4, [["width", "calc(var(--spacing) * 5)"]]], [".w-7", null, 4, [["width", "calc(var(--spacing) * 7)"]]], [".w-8", null, 4, [["width", "calc(var(--spacing) * 8)"]]], [".w-9", null, 4, [["width", "calc(var(--spacing) * 9)"]]], [".w-10", null, 4, [["width", "calc(var(--spacing) * 10)"]]], [".w-20", null, 4, [["width", "calc(var(--spacing) * 20)"]]], [".w-40", null, 4, [["width", "calc(var(--spacing) * 40)"]]], [".w-44", null, 4, [["width", "calc(var(--spacing) * 44)"]]], [".w-\\[1\\.1rem\\]", null, 4, [["width", "1.1rem"]]], [".w-\\[1\\.4rem\\]", null, 4, [["width", "1.4rem"]]], [".w-\\[1\\.6rem\\]", null, 4, [["width", "1.6rem"]]], [".w-\\[1\\.25rem\\]", null, 4, [["width", "1.25rem"]]], [".w-\\[2\\.4rem\\]", null, 4, [["width", "2.4rem"]]], [".w-\\[2\\.25rem\\]", null, 4, [["width", "2.25rem"]]], [".w-\\[6rem\\]", null, 4, [["width", "6rem"]]], [".w-\\[7rem\\]", null, 4, [["width", "7rem"]]], [".w-\\[11rem\\]", null, 4, [["width", "11rem"]]], [".w-\\[15rem\\]", null, 4, [["width", "15rem"]]], [".w-\\[16rem\\]", null, 4, [["width", "16rem"]]], [".w-\\[18px\\]", null, 4, [["width", "18px"]]], [".w-\\[100cqi\\]", null, 4, [["width", "100cqi"]]], [".w-\\[calc\\(\\(100\\%-0\\.875rem\\)\\/8\\)\\]", null, 4, [["width", "calc(12.5% - .109375rem)"]]], [".w-\\[calc\\(100\\%_-_0\\.6rem\\)\\]", null, 4, [["width", "calc(100% - .6rem)"]]], [".w-\\[calc\\(100\\%_-_1rem\\)\\]", null, 4, [["width", "calc(100% - 1rem)"]]], [".w-\\[min\\(22rem\\,calc\\(100vw-3rem\\)\\)\\]", null, 4, [["width", "min(22rem, 100vw - 3rem)"]]], [".w-\\[min\\(26rem\\,100\\%\\)\\]", null, 4, [["width", "min(26rem, 100%)"]]], [".w-\\[min\\(28rem\\,calc\\(100vw-2\\.5rem\\)\\)\\]", null, 4, [["width", "min(28rem, 100vw - 2.5rem)"]]], [".w-\\[min\\(30rem\\,92vw\\)\\]", null, 4, [["width", "min(30rem, 92vw)"]]], [".w-\\[min\\(32rem\\,100\\%\\)\\]", null, 4, [["width", "min(32rem, 100%)"]]], [".w-\\[min\\(340px\\,calc\\(100vw-16px\\)\\)\\]", null, 4, [["width", "min(340px, 100vw - 16px)"]]], [".w-\\[min\\(360px\\,calc\\(100vw_-_2rem\\)\\)\\]", null, 4, [["width", "min(360px, 100vw - 2rem)"]]], [".w-\\[min\\(420px\\,calc\\(100vw_-_16px\\)\\)\\]", null, 4, [["width", "min(420px, 100vw - 16px)"]]], [".w-\\[min\\(480px\\,calc\\(100vw_-_2rem\\)\\)\\]", null, 4, [["width", "min(480px, 100vw - 2rem)"]]], [".w-\\[min\\(560px\\,calc\\(100vw_-_2rem\\)\\)\\]", null, 4, [["width", "min(560px, 100vw - 2rem)"]]], [".w-\\[var\\(--sidebar-width\\,240px\\)\\]", null, 4, [["width", "var(--sidebar-width, 240px)"]]], [".w-\\[var\\(--tools-width\\)\\]", null, 4, [["width", "var(--tools-width)"]]], [".w-auto", null, 4, [["width", "auto"]]], [".w-full", null, 4, [["width", "100%"]]], [".w-px", null, 4, [["width", "1px"]]], [".max-w-24", null, 4, [["max-width", "calc(var(--spacing) * 24)"]]], [".max-w-32", null, 4, [["max-width", "calc(var(--spacing) * 32)"]]], [".max-w-\\[9rem\\]", null, 4, [["max-width", "9rem"]]], [".max-w-\\[10rem\\]", null, 4, [["max-width", "10rem"]]], [".max-w-\\[14rem\\]", null, 4, [["max-width", "14rem"]]], [".max-w-\\[16rem\\]", null, 4, [["max-width", "16rem"]]], [".max-w-\\[24rem\\]", null, 4, [["max-width", "24rem"]]], [".max-w-\\[25\\%\\]", null, 4, [["max-width", "25%"]]], [".max-w-\\[26rem\\]", null, 4, [["max-width", "26rem"]]], [".max-w-\\[28rem\\]", null, 4, [["max-width", "28rem"]]], [".max-w-\\[35\\%\\]", null, 4, [["max-width", "35%"]]], [".max-w-\\[38\\%\\]", null, 4, [["max-width", "38%"]]], [".max-w-\\[45\\%\\]", null, 4, [["max-width", "45%"]]], [".max-w-\\[46rem\\]", null, 4, [["max-width", "46rem"]]], [".max-w-\\[55\\%\\]", null, 4, [["max-width", "55%"]]], [".max-w-\\[56rem\\]", null, 4, [["max-width", "56rem"]]], [".max-w-\\[85\\%\\]", null, 4, [["max-width", "85%"]]], [".max-w-\\[140px\\]", null, 4, [["max-width", "140px"]]], [".max-w-\\[320px\\]", null, 4, [["max-width", "320px"]]], [".max-w-\\[min\\(22rem\\,calc\\(100\\%-1\\.5rem\\)\\)\\]", null, 4, [["max-width", "min(22rem, 100% - 1.5rem)"]]], [".max-w-\\[min\\(30rem\\,calc\\(100\\%-1\\.6rem\\)\\)\\]", null, 4, [["max-width", "min(30rem, 100% - 1.6rem)"]]], [".max-w-\\[min\\(34rem\\,calc\\(100\\%-1\\.5rem\\)\\)\\]", null, 4, [["max-width", "min(34rem, 100% - 1.5rem)"]]], [".max-w-\\[min\\(320px\\,calc\\(100vw_-_24px\\)\\)\\]", null, 4, [["max-width", "min(320px, 100vw - 24px)"]]], [".max-w-full", null, 4, [["max-width", "100%"]]], [".max-w-none", null, 4, [["max-width", "none"]]], [".min-w-0", null, 4, [["min-width", "0"]]], [".min-w-6", null, 4, [["min-width", "calc(var(--spacing) * 6)"]]], [".min-w-8", null, 4, [["min-width", "calc(var(--spacing) * 8)"]]], [".min-w-12", null, 4, [["min-width", "calc(var(--spacing) * 12)"]]], [".min-w-24", null, 4, [["min-width", "calc(var(--spacing) * 24)"]]], [".min-w-36", null, 4, [["min-width", "calc(var(--spacing) * 36)"]]], [".min-w-56", null, 4, [["min-width", "calc(var(--spacing) * 56)"]]], [".min-w-\\[5\\.5rem\\]", null, 4, [["min-width", "5.5rem"]]], [".min-w-\\[7rem\\]", null, 4, [["min-width", "7rem"]]], [".min-w-\\[12rem\\]", null, 4, [["min-width", "12rem"]]], [".min-w-\\[14px\\]", null, 4, [["min-width", "14px"]]], [".min-w-\\[200px\\]", null, 4, [["min-width", "200px"]]], [".min-w-fit", null, 4, [["min-width", "fit-content"]]], [".min-w-max", null, 4, [["min-width", "max-content"]]], [".flex-1", null, 4, [["flex", "1"]]], [".flex-\\[0_0_5rem\\]", null, 4, [["flex", "0 0 5rem"]]], [".flex-\\[0_0_8px\\]", null, 4, [["flex", "0 0 8px"]]], [".flex-\\[0_1_40\\%\\]", null, 4, [["flex", "0 40%"]]], [".flex-\\[1_1_100\\%\\]", null, 4, [["flex", "100%"]]], [".flex-\\[2\\]", null, 4, [["flex", "2"]]], [".flex-initial", null, 4, [["flex", "0 auto"]]], [".flex-none", null, 4, [["flex", "none"]]], [".shrink", null, 4, [["flex-shrink", "1"]]], [".shrink-0", null, 4, [["flex-shrink", "0"]]], [".shrink-\\[0\\.001\\]", null, 4, [["flex-shrink", ".001"]]], [".shrink-\\[2\\]", null, 4, [["flex-shrink", "2"]]], [".shrink-\\[3\\]", null, 4, [["flex-shrink", "3"]]], [".grow", null, 4, [["flex-grow", "1"]]], [".basis-0", null, 4, [["flex-basis", "0"]]], [".basis-\\[14rem\\]", null, 4, [["flex-basis", "14rem"]]], [".-translate-y-1\\/2", null, 4, [["--tw-translate-y", "calc(calc(1 / 2 * 100%) * -1)"], ["translate", "var(--tw-translate-x) var(--tw-translate-y)"]]], [".\\[transform\\:translateY\\(-50\\%\\)\\]", null, 4, [["transform", "translateY(-50%)"]]], [".transform", null, 4, [["transform", "var(--tw-rotate-x, ) var(--tw-rotate-y, ) var(--tw-rotate-z, ) var(--tw-skew-x, ) var(--tw-skew-y, )"]]], [".animate-drop-zone", null, 4, [["animation", "var(--animate-drop-zone)"]]], [".animate-host-pulse", null, 4, [["animation", "var(--animate-host-pulse)"]]], [".animate-pulse", null, 4, [["animation", "var(--animate-pulse)"]]], [".animate-toast-in", null, 4, [["animation", "var(--animate-toast-in)"]]], [".cursor-col-resize", null, 4, [["cursor", "col-resize"]]], [".cursor-default", null, 4, [["cursor", "default"]]], [".cursor-grab", null, 4, [["cursor", "grab"]]], [".cursor-grabbing", null, 4, [["cursor", "grabbing"]]], [".cursor-pointer", null, 4, [["cursor", "pointer"]]], [".cursor-row-resize", null, 4, [["cursor", "row-resize"]]], [".touch-none", null, 4, [["touch-action", "none"]]], [".resize", null, 4, [["resize", "both"]]], [".resize-none", null, 4, [["resize", "none"]]], [".resize-y", null, 4, [["resize", "vertical"]]], [".\\[scrollbar-width\\:none\\]", null, 4, [["scrollbar-width", "none"]]], [".list-disc", null, 4, [["list-style-type", "disc"]]], [".list-none", null, 4, [["list-style-type", "none"]]], [".appearance-none", null, 4, [["appearance", "none"]]], [".grid-cols-8", null, 4, [["grid-template-columns", "repeat(8, minmax(0, 1fr))"]]], [".grid-cols-\\[1fr_auto_1fr\\]", null, 4, [["grid-template-columns", "1fr auto 1fr"]]], [".grid-cols-\\[2\\.5rem_2\\.5rem_0\\.9rem_minmax\\(0\\,1fr\\)\\]", null, 4, [["grid-template-columns", "2.5rem 2.5rem .9rem minmax(0, 1fr)"]]], [".grid-cols-\\[auto_minmax\\(0\\,1fr\\)\\]", null, 4, [["grid-template-columns", "auto minmax(0, 1fr)"]]], [".grid-cols-\\[minmax\\(4rem\\,10rem\\)_1fr_auto\\]", null, 4, [["grid-template-columns", "minmax(4rem, 10rem) 1fr auto"]]], [".grid-cols-\\[repeat\\(2\\,minmax\\(0\\,1fr\\)\\)\\]", null, 4, [["grid-template-columns", "repeat(2, minmax(0, 1fr))"]]], [".grid-cols-\\[repeat\\(auto-fit\\,minmax\\(8rem\\,1fr\\)\\)\\]", null, 4, [["grid-template-columns", "repeat(auto-fit, minmax(8rem, 1fr))"]]], [".flex-col", null, 4, [["flex-direction", "column"]]], [".flex-row", null, 4, [["flex-direction", "row"]]], [".flex-wrap", null, 4, [["flex-wrap", "wrap"]]], [".place-items-center", null, 4, [["place-items", "center"]]], [".content-center", null, 4, [["align-content", "center"]]], [".items-baseline", null, 4, [["align-items", "baseline"]]], [".items-center", null, 4, [["align-items", "center"]]], [".items-end", null, 4, [["align-items", "flex-end"]]], [".items-start", null, 4, [["align-items", "flex-start"]]], [".items-stretch", null, 4, [["align-items", "stretch"]]], [".justify-between", null, 4, [["justify-content", "space-between"]]], [".justify-center", null, 4, [["justify-content", "center"]]], [".justify-end", null, 4, [["justify-content", "flex-end"]]], [".justify-start", null, 4, [["justify-content", "flex-start"]]], [".justify-items-center", null, 4, [["justify-items", "center"]]], [".justify-items-start", null, 4, [["justify-items", "start"]]], [".gap-0", null, 4, [["gap", "0"]]], [".gap-0\\.5", null, 4, [["gap", "calc(var(--spacing) * .5)"]]], [".gap-1", null, 4, [["gap", "var(--spacing)"]]], [".gap-1\\.5", null, 4, [["gap", "calc(var(--spacing) * 1.5)"]]], [".gap-2", null, 4, [["gap", "calc(var(--spacing) * 2)"]]], [".gap-3", null, 4, [["gap", "calc(var(--spacing) * 3)"]]], [".gap-4", null, 4, [["gap", "calc(var(--spacing) * 4)"]]], [".gap-6", null, 4, [["gap", "calc(var(--spacing) * 6)"]]], [".gap-\\[0\\.1rem\\]", null, 4, [["gap", ".1rem"]]], [".gap-\\[0\\.3rem\\]", null, 4, [["gap", ".3rem"]]], [".gap-\\[0\\.4rem\\]", null, 4, [["gap", ".4rem"]]], [".gap-\\[0\\.05rem\\]", null, 4, [["gap", ".05rem"]]], [".gap-\\[0\\.6rem\\]", null, 4, [["gap", ".6rem"]]], [".gap-\\[0\\.8rem\\]", null, 4, [["gap", ".8rem"]]], [".gap-\\[0\\.16rem\\]", null, 4, [["gap", ".16rem"]]], [".gap-\\[0\\.32rem\\]", null, 4, [["gap", ".32rem"]]], [".gap-\\[0\\.35rem\\]", null, 4, [["gap", ".35rem"]]], [".gap-\\[0\\.45rem\\]", null, 4, [["gap", ".45rem"]]], [".gap-\\[0\\.55rem\\]", null, 4, [["gap", ".55rem"]]], [".gap-\\[0\\.65rem\\]", null, 4, [["gap", ".65rem"]]], [".gap-\\[0\\.85rem\\]", null, 4, [["gap", ".85rem"]]], [".gap-\\[1px\\]", null, 4, [["gap", "1px"]]], [".gap-\\[2px\\]", null, 4, [["gap", "2px"]]], [".gap-\\[3px\\]", null, 4, [["gap", "3px"]]], [".gap-\\[7px\\]", null, 4, [["gap", "7px"]]], [".gap-\\[13px\\]", null, 4, [["gap", "13px"]]], [":where(.space-y-0\\.5 > :not(:last-child))", null, 4, [["--tw-space-y-reverse", "0"], ["margin-block-start", "calc(calc(var(--spacing) * .5) * var(--tw-space-y-reverse))"], ["margin-block-end", "calc(calc(var(--spacing) * .5) * calc(1 - var(--tw-space-y-reverse)))"]]], [".gap-x-3", null, 4, [["column-gap", "calc(var(--spacing) * 3)"]]], [".gap-x-4", null, 4, [["column-gap", "calc(var(--spacing) * 4)"]]], [".gap-x-\\[0\\.7rem\\]", null, 4, [["column-gap", ".7rem"]]], [".gap-x-\\[0\\.9rem\\]", null, 4, [["column-gap", ".9rem"]]], [".gap-y-1", null, 4, [["row-gap", "var(--spacing)"]]], [".gap-y-\\[0\\.3rem\\]", null, 4, [["row-gap", ".3rem"]]], [".self-center", null, 4, [["align-self", "center"]]], [".self-end", null, 4, [["align-self", "flex-end"]]], [".self-start", null, 4, [["align-self", "flex-start"]]], [".self-stretch", null, 4, [["align-self", "stretch"]]], [".justify-self-start", null, 4, [["justify-self", "flex-start"]]], [".truncate", null, 4, [["text-overflow", "ellipsis"], ["white-space", "nowrap"], ["overflow", "hidden"]]], [".overflow-auto", null, 4, [["overflow", "auto"]]], [".overflow-hidden", null, 4, [["overflow", "hidden"]]], [".overflow-visible", null, 4, [["overflow", "visible"]]], [".overflow-x-auto", null, 4, [["overflow-x", "auto"]]], [".overflow-y-auto", null, 4, [["overflow-y", "auto"]]], [".overscroll-contain", null, 4, [["overscroll-behavior", "contain"]]], [".rounded, .rounded-\\[0\\.25rem\\]", null, 4, [["border-radius", ".25rem"]]], [".rounded-\\[1\\.5rem\\]", null, 4, [["border-radius", "1.5rem"]]], [".rounded-\\[2px\\]", null, 4, [["border-radius", "2px"]]], [".rounded-\\[3px\\]", null, 4, [["border-radius", "3px"]]], [".rounded-\\[12px\\]", null, 4, [["border-radius", "12px"]]], [".rounded-\\[50\\%\\]", null, 4, [["border-radius", "50%"]]], [".rounded-\\[999px\\]", null, 4, [["border-radius", "999px"]]], [".rounded-\\[calc\\(var\\(--radius\\)\\*2\\)\\]", null, 4, [["border-radius", "calc(var(--radius) * 2)"]]], [".rounded-\\[var\\(--card-radius\\,8px\\)\\]", null, 4, [["border-radius", "var(--card-radius, 8px)"]]], [".rounded-\\[var\\(--card-radius\\,12px\\)\\]", null, 4, [["border-radius", "var(--card-radius, 12px)"]]], [".rounded-full", null, 4, [["border-radius", "3.40282e38px"]]], [".rounded-none", null, 4, [["border-radius", "0"]]], [".rounded-soft", null, 4, [["border-radius", "var(--radius-pane)"]]], [".rounded-ui", null, 4, [["border-radius", "var(--radius)"]]], [".rounded-t-\\[12px\\]", null, 4, [["border-top-left-radius", "12px"], ["border-top-right-radius", "12px"]]], [".rounded-t-none", null, 4, [["border-top-left-radius", "0"], ["border-top-right-radius", "0"]]], [".rounded-bl-\\[6px\\]", null, 4, [["border-bottom-left-radius", "6px"]]], [".border", null, 4, [["border-style", "var(--tw-border-style)"], ["border-width", "1px"]]], [".border-0", null, 4, [["border-style", "var(--tw-border-style)"], ["border-width", "0"]]], [".border-\\[1\\.5px\\]", null, 4, [["border-style", "var(--tw-border-style)"], ["border-width", "1.5px"]]], [".border-b", null, 4, [["border-bottom-style", "var(--tw-border-style)"], ["border-bottom-width", "1px"]]], [".border-l", null, 4, [["border-left-style", "var(--tw-border-style)"], ["border-left-width", "1px"]]], [".border-l-\\[3px\\]", null, 4, [["border-left-style", "var(--tw-border-style)"], ["border-left-width", "3px"]]], [".border-solid", null, 4, [["--tw-border-style", "solid"], ["border-style", "solid"]]], [".border-accent", null, 4, [["border-color", "var(--accent)"]]], [".border-overlay-0", null, 4, [["border-color", "var(--overlay-0)"]]], [".border-overlay-1", null, 4, [["border-color", "var(--overlay-1)"]]], [".border-red", null, 4, [["border-color", "var(--red)"]]], [".border-subtext-0", null, 4, [["border-color", "var(--subtext-0)"]]], [".border-surface-1", null, 4, [["border-color", "var(--surface-1)"]]], [".border-teal", null, 4, [["border-color", "var(--teal)"]]], [".border-yellow", null, 4, [["border-color", "var(--yellow)"]]], [".border-l-accent", null, 4, [["border-left-color", "var(--accent)"]]], [".border-l-green", null, 4, [["border-left-color", "var(--green)"]]], [".border-l-red", null, 4, [["border-left-color", "var(--red)"]]], [".border-l-yellow", null, 4, [["border-left-color", "var(--yellow)"]]], [".bg-\\[\\#161616\\]", null, 4, [["background-color", "#161616"]]], [".bg-\\[\\#fff\\]", null, 4, [["background-color", "#fff"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_8\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "var(--accent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_8\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--accent) 8%,var(--panel-bg))"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_12\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--accent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_12\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--accent) 12%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--accent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--accent) 15%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--blue\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--blue)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--blue\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--blue) 15%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--green\\)_9\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--green)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--green\\)_9\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--green) 9%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--red\\)_7\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--red)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--red\\)_7\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--red) 7%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--red\\)_9\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--red)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--red\\)_9\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--red) 9%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--surface-1\\)_42\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--surface-1\\)_42\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--surface-1) 42%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--surface-1\\)_70\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--surface-1\\)_70\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--surface-1) 70%,var(--panel-bg))"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--text\\)_10\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "var(--text)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--text\\)_10\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--text) 10%,var(--panel-bg))"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--yellow\\)_8\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--yellow)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--yellow\\)_8\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--yellow) 8%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--yellow\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--yellow)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--yellow\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--yellow) 15%,transparent)"]]], [".bg-\\[rgba\\(0\\,0\\,0\\,0\\.5\\)\\]", null, 4, [["background-color", "#00000080"]]], [".bg-\\[rgba\\(0\\,0\\,0\\,0\\.7\\)\\]", null, 4, [["background-color", "#000000b3"]]], [".bg-\\[rgba\\(0\\,0\\,0\\,0\\.55\\)\\]", null, 4, [["background-color", "#0000008c"]]], [".bg-\\[rgba\\(0\\,0\\,0\\,0\\.62\\)\\]", null, 4, [["background-color", "#0000009e"]]], [".bg-\\[var\\(--accent\\)\\]", null, 4, [["background-color", "var(--accent)"]]], [".bg-\\[var\\(--backdrop\\)\\]", null, 4, [["background-color", "var(--backdrop)"]]], [".bg-\\[var\\(--bg\\)\\]", null, 4, [["background-color", "var(--bg)"]]], [".bg-\\[var\\(--card-bg\\)\\]", null, 4, [["background-color", "var(--card-bg)"]]], [".bg-\\[var\\(--picker-bg\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "var(--picker-bg, var(--panel-bg))"]]], [".bg-\\[var\\(--surface-1\\)\\]", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-\\[var\\(--workspace-tools-bg\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "var(--workspace-tools-bg, var(--panel-bg))"]]], [".bg-accent, .bg-accent\\/10", null, 4, [["background-color", "var(--accent)"]]], [".bg-accent\\/10", null, 4, [["background-color", "color-mix(in oklab, var(--accent) 10%, transparent)"]]], [".bg-accent\\/35", null, 4, [["background-color", "var(--accent)"]]], [".bg-accent\\/35", null, 4, [["background-color", "color-mix(in oklab, var(--accent) 35%, transparent)"]]], [".bg-fg", null, 4, [["background-color", "var(--text)"]]], [".bg-green, .bg-green\\/15", null, 4, [["background-color", "var(--green)"]]], [".bg-green\\/15", null, 4, [["background-color", "color-mix(in oklab, var(--green) 15%, transparent)"]]], [".bg-overlay-0", null, 4, [["background-color", "var(--overlay-0)"]]], [".bg-overlay-1", null, 4, [["background-color", "var(--overlay-1)"]]], [".bg-panel-bg", null, 4, [["background-color", "var(--panel-bg)"]]], [".bg-red, .bg-red\\/15", null, 4, [["background-color", "var(--red)"]]], [".bg-red\\/15", null, 4, [["background-color", "color-mix(in oklab, var(--red) 15%, transparent)"]]], [".bg-subtext-0", null, 4, [["background-color", "var(--subtext-0)"]]], [".bg-surface-0", null, 4, [["background-color", "var(--surface-0)"]]], [".bg-surface-1, .bg-surface-1\\/30", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-surface-1\\/30", null, 4, [["background-color", "color-mix(in oklab, var(--surface-1) 30%, transparent)"]]], [".bg-surface-1\\/60", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-surface-1\\/60", null, 4, [["background-color", "color-mix(in oklab, var(--surface-1) 60%, transparent)"]]], [".bg-surface-1\\/70", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-surface-1\\/70", null, 4, [["background-color", "color-mix(in oklab, var(--surface-1) 70%, transparent)"]]], [".bg-transparent", null, 4, [["background-color", "#0000"]]], [".bg-yellow", null, 4, [["background-color", "var(--yellow)"]]], [".object-contain", null, 4, [["object-fit", "contain"]]], [".object-cover", null, 4, [["object-fit", "cover"]]], [".p-0", null, 4, [["padding", "0"]]], [".p-0\\.5", null, 4, [["padding", "calc(var(--spacing) * .5)"]]], [".p-1", null, 4, [["padding", "var(--spacing)"]]], [".p-2", null, 4, [["padding", "calc(var(--spacing) * 2)"]]], [".p-3", null, 4, [["padding", "calc(var(--spacing) * 3)"]]], [".p-4", null, 4, [["padding", "calc(var(--spacing) * 4)"]]], [".p-5", null, 4, [["padding", "calc(var(--spacing) * 5)"]]], [".p-6", null, 4, [["padding", "calc(var(--spacing) * 6)"]]], [".p-\\[0\\.2rem\\]", null, 4, [["padding", ".2rem"]]], [".p-\\[0\\.4rem\\]", null, 4, [["padding", ".4rem"]]], [".p-\\[0\\.5rem\\]", null, 4, [["padding", ".5rem"]]], [".p-\\[0\\.9rem\\]", null, 4, [["padding", ".9rem"]]], [".p-\\[0\\.45rem\\]", null, 4, [["padding", ".45rem"]]], [".p-\\[0\\.55rem\\]", null, 4, [["padding", ".55rem"]]], [".p-\\[0\\.65rem\\]", null, 4, [["padding", ".65rem"]]], [".p-\\[2px\\]", null, 4, [["padding", "2px"]]], [".px-0", null, 4, [["padding-inline", "0"]]], [".px-1", null, 4, [["padding-inline", "var(--spacing)"]]], [".px-1\\.5", null, 4, [["padding-inline", "calc(var(--spacing) * 1.5)"]]], [".px-2", null, 4, [["padding-inline", "calc(var(--spacing) * 2)"]]], [".px-3", null, 4, [["padding-inline", "calc(var(--spacing) * 3)"]]], [".px-3\\.5", null, 4, [["padding-inline", "calc(var(--spacing) * 3.5)"]]], [".px-4", null, 4, [["padding-inline", "calc(var(--spacing) * 4)"]]], [".px-8", null, 4, [["padding-inline", "calc(var(--spacing) * 8)"]]], [".px-\\[0\\.2rem\\]", null, 4, [["padding-inline", ".2rem"]]], [".px-\\[0\\.3rem\\]", null, 4, [["padding-inline", ".3rem"]]], [".px-\\[0\\.4rem\\]", null, 4, [["padding-inline", ".4rem"]]], [".px-\\[0\\.5rem\\]", null, 4, [["padding-inline", ".5rem"]]], [".px-\\[0\\.6rem\\]", null, 4, [["padding-inline", ".6rem"]]], [".px-\\[0\\.7rem\\]", null, 4, [["padding-inline", ".7rem"]]], [".px-\\[0\\.8rem\\]", null, 4, [["padding-inline", ".8rem"]]], [".px-\\[0\\.9rem\\]", null, 4, [["padding-inline", ".9rem"]]], [".px-\\[0\\.26rem\\]", null, 4, [["padding-inline", ".26rem"]]], [".px-\\[0\\.28rem\\]", null, 4, [["padding-inline", ".28rem"]]], [".px-\\[0\\.35rem\\]", null, 4, [["padding-inline", ".35rem"]]], [".px-\\[0\\.42rem\\]", null, 4, [["padding-inline", ".42rem"]]], [".px-\\[0\\.45rem\\]", null, 4, [["padding-inline", ".45rem"]]], [".px-\\[0\\.48rem\\]", null, 4, [["padding-inline", ".48rem"]]], [".px-\\[0\\.55rem\\]", null, 4, [["padding-inline", ".55rem"]]], [".px-\\[0\\.65rem\\]", null, 4, [["padding-inline", ".65rem"]]], [".px-\\[0\\.75rem\\]", null, 4, [["padding-inline", ".75rem"]]], [".px-\\[0\\.85rem\\]", null, 4, [["padding-inline", ".85rem"]]], [".px-\\[1\\.4rem\\]", null, 4, [["padding-inline", "1.4rem"]]], [".px-\\[3px\\]", null, 4, [["padding-inline", "3px"]]], [".px-\\[10px\\]", null, 4, [["padding-inline", "10px"]]], [".py-0", null, 4, [["padding-block", "0"]]], [".py-0\\.5", null, 4, [["padding-block", "calc(var(--spacing) * .5)"]]], [".py-1", null, 4, [["padding-block", "var(--spacing)"]]], [".py-1\\.5", null, 4, [["padding-block", "calc(var(--spacing) * 1.5)"]]], [".py-2", null, 4, [["padding-block", "calc(var(--spacing) * 2)"]]], [".py-3", null, 4, [["padding-block", "calc(var(--spacing) * 3)"]]], [".py-4", null, 4, [["padding-block", "calc(var(--spacing) * 4)"]]], [".py-8", null, 4, [["padding-block", "calc(var(--spacing) * 8)"]]], [".py-\\[0\\.1rem\\]", null, 4, [["padding-block", ".1rem"]]], [".py-\\[0\\.2rem\\]", null, 4, [["padding-block", ".2rem"]]], [".py-\\[0\\.3rem\\]", null, 4, [["padding-block", ".3rem"]]], [".py-\\[0\\.4rem\\]", null, 4, [["padding-block", ".4rem"]]], [".py-\\[0\\.05rem\\]", null, 4, [["padding-block", ".05rem"]]], [".py-\\[0\\.6rem\\]", null, 4, [["padding-block", ".6rem"]]], [".py-\\[0\\.8rem\\]", null, 4, [["padding-block", ".8rem"]]], [".py-\\[0\\.12rem\\]", null, 4, [["padding-block", ".12rem"]]], [".py-\\[0\\.14rem\\]", null, 4, [["padding-block", ".14rem"]]], [".py-\\[0\\.15rem\\]", null, 4, [["padding-block", ".15rem"]]], [".py-\\[0\\.18rem\\]", null, 4, [["padding-block", ".18rem"]]], [".py-\\[0\\.25rem\\]", null, 4, [["padding-block", ".25rem"]]], [".py-\\[0\\.28rem\\]", null, 4, [["padding-block", ".28rem"]]], [".py-\\[0\\.32rem\\]", null, 4, [["padding-block", ".32rem"]]], [".py-\\[0\\.35rem\\]", null, 4, [["padding-block", ".35rem"]]], [".py-\\[0\\.42rem\\]", null, 4, [["padding-block", ".42rem"]]], [".py-\\[0\\.45rem\\]", null, 4, [["padding-block", ".45rem"]]], [".py-\\[0\\.55rem\\]", null, 4, [["padding-block", ".55rem"]]], [".py-\\[0\\.65rem\\]", null, 4, [["padding-block", ".65rem"]]], [".py-\\[2px\\]", null, 4, [["padding-block", "2px"]]], [".py-\\[3px\\]", null, 4, [["padding-block", "3px"]]], [".py-\\[6px\\]", null, 4, [["padding-block", "6px"]]], [".py-px", null, 4, [["padding-block", "1px"]]], [".pt-1", null, 4, [["padding-top", "var(--spacing)"]]], [".pt-2", null, 4, [["padding-top", "calc(var(--spacing) * 2)"]]], [".pt-2\\.5", null, 4, [["padding-top", "calc(var(--spacing) * 2.5)"]]], [".pt-3", null, 4, [["padding-top", "calc(var(--spacing) * 3)"]]], [".pt-4", null, 4, [["padding-top", "calc(var(--spacing) * 4)"]]], [".pt-5", null, 4, [["padding-top", "calc(var(--spacing) * 5)"]]], [".pt-\\[0\\.2rem\\]", null, 4, [["padding-top", ".2rem"]]], [".pt-\\[0\\.4rem\\]", null, 4, [["padding-top", ".4rem"]]], [".pt-\\[0\\.6rem\\]", null, 4, [["padding-top", ".6rem"]]], [".pt-\\[0\\.85rem\\]", null, 4, [["padding-top", ".85rem"]]], [".pt-\\[2px\\]", null, 4, [["padding-top", "2px"]]], [".pt-\\[12vh\\]", null, 4, [["padding-top", "12vh"]]], [".pt-\\[max\\(0\\.5rem\\,env\\(safe-area-inset-top\\)\\)\\]", null, 4, [["padding-top", "max(.5rem, env(safe-area-inset-top))"]]], [".pr-0\\.5", null, 4, [["padding-right", "calc(var(--spacing) * .5)"]]], [".pr-1", null, 4, [["padding-right", "var(--spacing)"]]], [".pr-1\\.5", null, 4, [["padding-right", "calc(var(--spacing) * 1.5)"]]], [".pr-2", null, 4, [["padding-right", "calc(var(--spacing) * 2)"]]], [".pr-3", null, 4, [["padding-right", "calc(var(--spacing) * 3)"]]], [".pr-12", null, 4, [["padding-right", "calc(var(--spacing) * 12)"]]], [".pr-\\[0\\.3rem\\]", null, 4, [["padding-right", ".3rem"]]], [".pr-\\[0\\.6rem\\]", null, 4, [["padding-right", ".6rem"]]], [".pr-\\[0\\.35rem\\]", null, 4, [["padding-right", ".35rem"]]], [".pr-\\[0\\.45rem\\]", null, 4, [["padding-right", ".45rem"]]], [".pr-\\[0\\.55rem\\]", null, 4, [["padding-right", ".55rem"]]], [".pr-\\[1\\.6rem\\]", null, 4, [["padding-right", "1.6rem"]]], [".pr-\\[3px\\]", null, 4, [["padding-right", "3px"]]], [".pr-\\[env\\(safe-area-inset-right\\)\\]", null, 4, [["padding-right", "env(safe-area-inset-right)"]]], [".pr-\\[max\\(0\\.5rem\\,env\\(safe-area-inset-right\\)\\)\\]", null, 4, [["padding-right", "max(.5rem, env(safe-area-inset-right))"]]], [".pb-1", null, 4, [["padding-bottom", "var(--spacing)"]]], [".pb-2", null, 4, [["padding-bottom", "calc(var(--spacing) * 2)"]]], [".pb-3", null, 4, [["padding-bottom", "calc(var(--spacing) * 3)"]]], [".pb-4", null, 4, [["padding-bottom", "calc(var(--spacing) * 4)"]]], [".pb-8", null, 4, [["padding-bottom", "calc(var(--spacing) * 8)"]]], [".pb-\\[0\\.3rem\\]", null, 4, [["padding-bottom", ".3rem"]]], [".pb-\\[0\\.4rem\\]", null, 4, [["padding-bottom", ".4rem"]]], [".pb-\\[0\\.25rem\\]", null, 4, [["padding-bottom", ".25rem"]]], [".pb-\\[0\\.55rem\\]", null, 4, [["padding-bottom", ".55rem"]]], [".pb-\\[1\\.4rem\\]", null, 4, [["padding-bottom", "1.4rem"]]], [".pb-\\[calc\\(1\\.5rem\\+env\\(safe-area-inset-bottom\\)\\)\\]", null, 4, [["padding-bottom", "calc(1.5rem + env(safe-area-inset-bottom))"]]], [".pb-\\[calc\\(1rem\\+env\\(safe-area-inset-bottom\\)\\)\\]", null, 4, [["padding-bottom", "calc(1rem + env(safe-area-inset-bottom))"]]], [".pb-\\[env\\(safe-area-inset-bottom\\)\\]", null, 4, [["padding-bottom", "env(safe-area-inset-bottom)"]]], [".pb-\\[max\\(0\\.5rem\\,env\\(safe-area-inset-bottom\\)\\)\\]", null, 4, [["padding-bottom", "max(.5rem, env(safe-area-inset-bottom))"]]], [".pl-1", null, 4, [["padding-left", "var(--spacing)"]]], [".pl-1\\.5", null, 4, [["padding-left", "calc(var(--spacing) * 1.5)"]]], [".pl-2", null, 4, [["padding-left", "calc(var(--spacing) * 2)"]]], [".pl-3", null, 4, [["padding-left", "calc(var(--spacing) * 3)"]]], [".pl-4", null, 4, [["padding-left", "calc(var(--spacing) * 4)"]]], [".pl-5", null, 4, [["padding-left", "calc(var(--spacing) * 5)"]]], [".pl-6", null, 4, [["padding-left", "calc(var(--spacing) * 6)"]]], [".pl-\\[0\\.4rem\\]", null, 4, [["padding-left", ".4rem"]]], [".pl-\\[0\\.45rem\\]", null, 4, [["padding-left", ".45rem"]]], [".pl-\\[0\\.75rem\\]", null, 4, [["padding-left", ".75rem"]]], [".pl-\\[0\\.85rem\\]", null, 4, [["padding-left", ".85rem"]]], [".pl-\\[1\\.2rem\\]", null, 4, [["padding-left", "1.2rem"]]], [".pl-\\[1\\.55rem\\]", null, 4, [["padding-left", "1.55rem"]]], [".pl-\\[1\\.075rem\\]", null, 4, [["padding-left", "1.075rem"]]], [".pl-\\[1\\.525rem\\]", null, 4, [["padding-left", "1.525rem"]]], [".pl-\\[1\\.875rem\\]", null, 4, [["padding-left", "1.875rem"]]], [".pl-\\[85px\\]", null, 4, [["padding-left", "85px"]]], [".pl-\\[max\\(0\\.5rem\\,env\\(safe-area-inset-left\\)\\)\\]", null, 4, [["padding-left", "max(.5rem, env(safe-area-inset-left))"]]], [".pl-\\[max\\(0\\.25rem\\,env\\(safe-area-inset-left\\)\\)\\]", null, 4, [["padding-left", "max(.25rem, env(safe-area-inset-left))"]]], [".text-center", null, 4, [["text-align", "center"]]], [".text-left", null, 4, [["text-align", "left"]]], [".text-right", null, 4, [["text-align", "right"]]], [".\\[font-family\\:inherit\\]", null, 4, [["font-family", "inherit"]]], [".\\[font-family\\:ui-monospace\\,SFMono-Regular\\,Menlo\\,monospace\\]", null, 4, [["font-family", "ui-monospace, SFMono-Regular, Menlo, monospace"]]], [".\\[font-family\\:var\\(--font-mono\\)\\]", null, 4, [["font-family", "var(--font-mono)"]]], [".text-sm", null, 4, [["font-size", "var(--text-sm)"], ["line-height", "var(--tw-leading, var(--text-sm--line-height))"]]], [".text-xs", null, 4, [["font-size", "var(--text-xs)"], ["line-height", "var(--tw-leading, var(--text-xs--line-height))"]]], [".\\[font-size\\:inherit\\]", null, 4, [["font-size", "inherit"]]], [".text-\\[0\\.6rem\\]", null, 4, [["font-size", ".6rem"]]], [".text-\\[0\\.7rem\\]", null, 4, [["font-size", ".7rem"]]], [".text-\\[0\\.8em\\]", null, 4, [["font-size", ".8em"]]], [".text-\\[0\\.8rem\\]", null, 4, [["font-size", ".8rem"]]], [".text-\\[0\\.9em\\]", null, 4, [["font-size", ".9em"]]], [".text-\\[0\\.9rem\\]", null, 4, [["font-size", ".9rem"]]], [".text-\\[0\\.54rem\\]", null, 4, [["font-size", ".54rem"]]], [".text-\\[0\\.58rem\\]", null, 4, [["font-size", ".58rem"]]], [".text-\\[0\\.62rem\\]", null, 4, [["font-size", ".62rem"]]], [".text-\\[0\\.63rem\\]", null, 4, [["font-size", ".63rem"]]], [".text-\\[0\\.64rem\\]", null, 4, [["font-size", ".64rem"]]], [".text-\\[0\\.65rem\\]", null, 4, [["font-size", ".65rem"]]], [".text-\\[0\\.66rem\\]", null, 4, [["font-size", ".66rem"]]], [".text-\\[0\\.66rem\\]\\!", null, 4, [["font-size", ".66rem", 1]]], [".text-\\[0\\.68rem\\]", null, 4, [["font-size", ".68rem"]]], [".text-\\[0\\.72rem\\]", null, 4, [["font-size", ".72rem"]]], [".text-\\[0\\.74rem\\]", null, 4, [["font-size", ".74rem"]]], [".text-\\[0\\.75rem\\]", null, 4, [["font-size", ".75rem"]]], [".text-\\[0\\.76rem\\]", null, 4, [["font-size", ".76rem"]]], [".text-\\[0\\.77rem\\]", null, 4, [["font-size", ".77rem"]]], [".text-\\[0\\.78rem\\]", null, 4, [["font-size", ".78rem"]]], [".text-\\[0\\.82rem\\]", null, 4, [["font-size", ".82rem"]]], [".text-\\[0\\.83rem\\]", null, 4, [["font-size", ".83rem"]]], [".text-\\[0\\.85rem\\]", null, 4, [["font-size", ".85rem"]]], [".text-\\[0\\.88rem\\]", null, 4, [["font-size", ".88rem"]]], [".text-\\[0\\.95rem\\]", null, 4, [["font-size", ".95rem"]]], [".text-\\[0\\.875rem\\]", null, 4, [["font-size", ".875rem"]]], [".text-\\[1\\.1rem\\]", null, 4, [["font-size", "1.1rem"]]], [".text-\\[1\\.4em\\]", null, 4, [["font-size", "1.4em"]]], [".text-\\[1\\.6rem\\]", null, 4, [["font-size", "1.6rem"]]], [".text-\\[1\\.15rem\\]", null, 4, [["font-size", "1.15rem"]]], [".text-\\[1rem\\]", null, 4, [["font-size", "1rem"]]], [".text-\\[2\\.4rem\\]", null, 4, [["font-size", "2.4rem"]]], [".text-\\[9px\\]", null, 4, [["font-size", "9px"]]], [".text-\\[10px\\]", null, 4, [["font-size", "10px"]]], [".text-\\[11px\\]", null, 4, [["font-size", "11px"]]], [".text-\\[12\\.5px\\]", null, 4, [["font-size", "12.5px"]]], [".text-\\[12px\\]", null, 4, [["font-size", "12px"]]], [".text-\\[13px\\]", null, 4, [["font-size", "13px"]]], [".text-\\[14px\\]", null, 4, [["font-size", "14px"]]], [".text-\\[calc\\(0\\.95rem\\*var\\(--chat-font-scale\\,1\\)\\)\\]", null, 4, [["font-size", "calc(.95rem * var(--chat-font-scale, 1))"]]], [".text-\\[length\\:calc\\(11px\\*var\\(--zoom\\,1\\)\\)\\]", null, 4, [["font-size", "calc(11px * var(--zoom, 1))"]]], [".text-\\[length\\:calc\\(13px\\*var\\(--zoom\\,1\\)\\)\\]", null, 4, [["font-size", "calc(13px * var(--zoom, 1))"]]], [".leading-4", null, 4, [["--tw-leading", "calc(var(--spacing) * 4)"], ["line-height", "calc(var(--spacing) * 4)"]]], [".leading-\\[1\\.1\\]", null, 4, [["--tw-leading", "1.1"], ["line-height", "1.1"]]], [".leading-\\[1\\.2\\]", null, 4, [["--tw-leading", "1.2"], ["line-height", "1.2"]]], [".leading-\\[1\\.3\\]", null, 4, [["--tw-leading", "1.3"], ["line-height", "1.3"]]], [".leading-\\[1\\.4\\]", null, 4, [["--tw-leading", "1.4"], ["line-height", "1.4"]]], [".leading-\\[1\\.5\\]", null, 4, [["--tw-leading", "1.5"], ["line-height", "1.5"]]], [".leading-\\[1\\.6\\]", null, 4, [["--tw-leading", "1.6"], ["line-height", "1.6"]]], [".leading-\\[1\\.45\\]", null, 4, [["--tw-leading", "1.45"], ["line-height", "1.45"]]], [".leading-\\[18px\\]", null, 4, [["--tw-leading", "18px"], ["line-height", "18px"]]], [".leading-none", null, 4, [["--tw-leading", "1"], ["line-height", "1"]]], [".leading-relaxed", null, 4, [["--tw-leading", "var(--leading-relaxed)"], ["line-height", "var(--leading-relaxed)"]]], [".leading-tight", null, 4, [["--tw-leading", "var(--leading-tight)"], ["line-height", "var(--leading-tight)"]]], [".\\[line-height\\:inherit\\]", null, 4, [["line-height", "inherit"]]], [".font-bold", null, 4, [["--tw-font-weight", "var(--font-weight-bold)"], ["font-weight", "var(--font-weight-bold)"]]], [".font-medium", null, 4, [["--tw-font-weight", "var(--font-weight-medium)"], ["font-weight", "var(--font-weight-medium)"]]], [".font-normal", null, 4, [["--tw-font-weight", "var(--font-weight-normal)"], ["font-weight", "var(--font-weight-normal)"]]], [".font-semibold", null, 4, [["--tw-font-weight", "var(--font-weight-semibold)"], ["font-weight", "var(--font-weight-semibold)"]]], [".\\[font-weight\\:inherit\\]", null, 4, [["font-weight", "inherit"]]], [".tracking-\\[-0\\.02em\\]", null, 4, [["--tw-tracking", "-.02em"], ["letter-spacing", "-.02em"]]], [".tracking-\\[0\\.03em\\]", null, 4, [["--tw-tracking", ".03em"], ["letter-spacing", ".03em"]]], [".tracking-\\[0\\.04em\\]", null, 4, [["--tw-tracking", ".04em"], ["letter-spacing", ".04em"]]], [".tracking-\\[0\\.06em\\]", null, 4, [["--tw-tracking", ".06em"], ["letter-spacing", ".06em"]]], [".tracking-\\[0\\.08em\\]", null, 4, [["--tw-tracking", ".08em"], ["letter-spacing", ".08em"]]], [".tracking-\\[0\\.09em\\]", null, 4, [["--tw-tracking", ".09em"], ["letter-spacing", ".09em"]]], [".tracking-\\[0\\.22em\\]", null, 4, [["--tw-tracking", ".22em"], ["letter-spacing", ".22em"]]], [".tracking-normal", null, 4, [["--tw-tracking", "var(--tracking-normal)"], ["letter-spacing", "var(--tracking-normal)"]]], [".tracking-wide", null, 4, [["--tw-tracking", "var(--tracking-wide)"], ["letter-spacing", "var(--tracking-wide)"]]], [".\\[overflow-wrap\\:anywhere\\]", null, 4, [["overflow-wrap", "anywhere"]]], [".break-words", null, 4, [["overflow-wrap", "break-word"]]], [".\\[word-break\\:break-word\\]", null, 4, [["word-break", "break-word"]]], [".text-ellipsis", null, 4, [["text-overflow", "ellipsis"]]], [".whitespace-normal", null, 4, [["white-space", "normal"]]], [".whitespace-nowrap", null, 4, [["white-space", "nowrap"]]], [".whitespace-pre", null, 4, [["white-space", "pre"]]], [".whitespace-pre-wrap", null, 4, [["white-space", "pre-wrap"]]], [".\\[tab-size\\:2\\]", null, 4, [["tab-size", "2"]]], [".text-\\[color\\:var\\(--git-muted\\)\\]", null, 4, [["color", "var(--git-muted)"]]], [".text-\\[var\\(--subtext-0\\)\\]", null, 4, [["color", "var(--subtext-0)"]]], [".text-\\[var\\(--text\\)\\]", null, 4, [["color", "var(--text)"]]], [".text-accent", null, 4, [["color", "var(--accent)"]]], [".text-blue", null, 4, [["color", "var(--blue)"]]], [".text-current", null, 4, [["color", "currentColor"]]], [".text-fg", null, 4, [["color", "var(--text)"]]], [".text-green", null, 4, [["color", "var(--green)"]]], [".text-inherit", null, 4, [["color", "inherit"]]], [".text-mauve", null, 4, [["color", "var(--mauve)"]]], [".text-overlay-0", null, 4, [["color", "var(--overlay-0)"]]], [".text-overlay-1", null, 4, [["color", "var(--overlay-1)"]]], [".text-panel-bg", null, 4, [["color", "var(--panel-bg)"]]], [".text-peach", null, 4, [["color", "var(--peach)"]]], [".text-red", null, 4, [["color", "var(--red)"]]], [".text-red\\!", null, 4, [["color", "var(--red)", 1]]], [".text-subtext-0", null, 4, [["color", "var(--subtext-0)"]]], [".text-yellow", null, 4, [["color", "var(--yellow)"]]], [".capitalize", null, 4, [["text-transform", "capitalize"]]], [".normal-case", null, 4, [["text-transform", "none"]]], [".uppercase", null, 4, [["text-transform", "uppercase"]]], [".italic", null, 4, [["font-style", "italic"]]], [".not-italic", null, 4, [["font-style", "normal"]]], [".tabular-nums", null, 4, [["--tw-numeric-spacing", "tabular-nums"], ["font-variant-numeric", "var(--tw-ordinal, ) var(--tw-slashed-zero, ) var(--tw-numeric-figure, ) var(--tw-numeric-spacing, ) var(--tw-numeric-fraction, )"]]], [".line-through", null, 4, [["text-decoration-line", "line-through"]]], [".no-underline", null, 4, [["text-decoration-line", "none"]]], [".underline", null, 4, [["text-decoration-line", "underline"]]], [".opacity-0", null, 4, [["opacity", "0"]]], [".opacity-40", null, 4, [["opacity", ".4"]]], [".opacity-60", null, 4, [["opacity", ".6"]]], [".opacity-70", null, 4, [["opacity", ".7"]]], [".opacity-75", null, 4, [["opacity", ".75"]]], [".opacity-80", null, 4, [["opacity", ".8"]]], [".opacity-100", null, 4, [["opacity", "1"]]], [".opacity-\\[0\\.72\\]", null, 4, [["opacity", ".72"]]], [".shadow", null, 4, [["--tw-shadow", "0 1px 3px 0 var(--tw-shadow-color, #0000001a), 0 1px 2px -1px var(--tw-shadow-color, #0000001a)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_1px_4px_rgba\\(0\\,0\\,0\\,0\\.4\\)\\]", null, 4, [["--tw-shadow", "0 1px 4px var(--tw-shadow-color, #0006)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_2px_8px_rgba\\(0\\,0\\,0\\,0\\.4\\)\\]", null, 4, [["--tw-shadow", "0 2px 8px var(--tw-shadow-color, #0006)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_2px_8px_rgba\\(0\\,0\\,0\\,0\\.35\\)\\]", null, 4, [["--tw-shadow", "0 2px 8px var(--tw-shadow-color, #00000059)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_6px_20px_rgba\\(0\\,0\\,0\\,0\\.3\\)\\]", null, 4, [["--tw-shadow", "0 6px 20px var(--tw-shadow-color, #0000004d)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_8px_24px_rgba\\(0\\,0\\,0\\,0\\.35\\)\\]", null, 4, [["--tw-shadow", "0 8px 24px var(--tw-shadow-color, #00000059)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_8px_24px_rgba\\(0\\,0\\,0\\,0\\.45\\)\\]", null, 4, [["--tw-shadow", "0 8px 24px var(--tw-shadow-color, #00000073)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_8px_32px_rgba\\(0\\,0\\,0\\,0\\.5\\)\\]", null, 4, [["--tw-shadow", "0 8px 32px var(--tw-shadow-color, #00000080)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_12px_32px_rgba\\(0\\,0\\,0\\,0\\.5\\)\\]", null, 4, [["--tw-shadow", "0 12px 32px var(--tw-shadow-color, #00000080)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_16px_48px_rgba\\(0\\,0\\,0\\,0\\.55\\)\\]", null, 4, [["--tw-shadow", "0 16px 48px var(--tw-shadow-color, #0000008c)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[inset_0_0_24px_var\\(--accent\\)\\]", null, 4, [["--tw-shadow", "inset 0 0 24px var(--tw-shadow-color, var(--accent))"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-lg", null, 4, [["--tw-shadow", "0 10px 15px -3px var(--tw-shadow-color, #0000001a), 0 4px 6px -4px var(--tw-shadow-color, #0000001a)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".ring", null, 4, [["--tw-ring-shadow", "var(--tw-ring-inset, ) 0 0 0 calc(1px + var(--tw-ring-offset-width)) var(--tw-ring-color, currentcolor)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".\\[box-shadow\\:0_1px_2px_rgba\\(0\\,0\\,0\\,0\\.3\\)\\]", null, 4, [["box-shadow", "0 1px 2px #0000004d"]]], [".\\[box-shadow\\:0_4px_14px_rgba\\(0\\,0\\,0\\,0\\.35\\)\\]", null, 4, [["box-shadow", "0 4px 14px #00000059"]]], [".\\[box-shadow\\:none\\]", null, 4, [["box-shadow", "none"]]], [".\\[outline\\:none\\]", null, 4, [["outline", "none"]]], [".outline, .outline-1", null, 4, [["outline-style", "var(--tw-outline-style)"], ["outline-width", "1px"]]], [".outline-2", null, 4, [["outline-style", "var(--tw-outline-style)"], ["outline-width", "2px"]]], [".outline-accent", null, 4, [["outline-color", "var(--accent)"]]], [".blur", null, 4, [["--tw-blur", "blur(8px)"], ["filter", "var(--tw-blur, ) var(--tw-brightness, ) var(--tw-contrast, ) var(--tw-grayscale, ) var(--tw-hue-rotate, ) var(--tw-invert, ) var(--tw-saturate, ) var(--tw-sepia, ) var(--tw-drop-shadow, )"]]], [".\\!filter", null, 4, [["filter", "var(--tw-blur, ) var(--tw-brightness, ) var(--tw-contrast, ) var(--tw-grayscale, ) var(--tw-hue-rotate, ) var(--tw-invert, ) var(--tw-saturate, ) var(--tw-sepia, ) var(--tw-drop-shadow, )", 1]]], [".\\[filter\\:drop-shadow\\(0_6px_10px_rgba\\(0\\,0\\,0\\,0\\.45\\)\\)\\]", null, 4, [["filter", "drop-shadow(0 6px 10px #00000073)"]]], [".filter", null, 4, [["filter", "var(--tw-blur, ) var(--tw-brightness, ) var(--tw-contrast, ) var(--tw-grayscale, ) var(--tw-hue-rotate, ) var(--tw-invert, ) var(--tw-saturate, ) var(--tw-sepia, ) var(--tw-drop-shadow, )"]]], [".backdrop-blur-xl", null, 4, [["--tw-backdrop-blur", "blur(var(--blur-xl))"], ["-webkit-backdrop-filter", "var(--tw-backdrop-blur, ) var(--tw-backdrop-brightness, ) var(--tw-backdrop-contrast, ) var(--tw-backdrop-grayscale, ) var(--tw-backdrop-hue-rotate, ) var(--tw-backdrop-invert, ) var(--tw-backdrop-opacity, ) var(--tw-backdrop-saturate, ) var(--tw-backdrop-sepia, )"], ["backdrop-filter", "var(--tw-backdrop-blur, ) var(--tw-backdrop-brightness, ) var(--tw-backdrop-contrast, ) var(--tw-backdrop-grayscale, ) var(--tw-backdrop-hue-rotate, ) var(--tw-backdrop-invert, ) var(--tw-backdrop-opacity, ) var(--tw-backdrop-saturate, ) var(--tw-backdrop-sepia, )"]]], [".backdrop-saturate-150", null, 4, [["--tw-backdrop-saturate", "saturate(150%)"], ["-webkit-backdrop-filter", "var(--tw-backdrop-blur, ) var(--tw-backdrop-brightness, ) var(--tw-backdrop-contrast, ) var(--tw-backdrop-grayscale, ) var(--tw-backdrop-hue-rotate, ) var(--tw-backdrop-invert, ) var(--tw-backdrop-opacity, ) var(--tw-backdrop-saturate, ) var(--tw-backdrop-sepia, )"], ["backdrop-filter", "var(--tw-backdrop-blur, ) var(--tw-backdrop-brightness, ) var(--tw-backdrop-contrast, ) var(--tw-backdrop-grayscale, ) var(--tw-backdrop-hue-rotate, ) var(--tw-backdrop-invert, ) var(--tw-backdrop-opacity, ) var(--tw-backdrop-saturate, ) var(--tw-backdrop-sepia, )"]]], [".transition", null, 4, [["transition-property", "color, background-color, border-color, outline-color, text-decoration-color, fill, stroke, --tw-gradient-from, --tw-gradient-via, --tw-gradient-to, opacity, box-shadow, transform, translate, scale, rotate, filter, -webkit-backdrop-filter, backdrop-filter, display, content-visibility, overlay, pointer-events"], ["transition-timing-function", "var(--tw-ease, var(--default-transition-timing-function))"], ["transition-duration", "var(--tw-duration, var(--default-transition-duration))"]]], [".transition-\\[left\\,top\\,width\\,height\\]", null, 4, [["transition-property", "left, top, width, height"], ["transition-timing-function", "var(--tw-ease, var(--default-transition-timing-function))"], ["transition-duration", "var(--tw-duration, var(--default-transition-duration))"]]], [".transition-opacity", null, 4, [["transition-property", "opacity"], ["transition-timing-function", "var(--tw-ease, var(--default-transition-timing-function))"], ["transition-duration", "var(--tw-duration, var(--default-transition-duration))"]]], [".duration-150", null, 4, [["--tw-duration", ".15s"], ["transition-duration", ".15s"]]], [".ease-out", null, 4, [["--tw-ease", "var(--ease-out)"], ["transition-timing-function", "var(--ease-out)"]]], [".outline-none", null, 4, [["--tw-outline-style", "none"], ["outline-style", "none"]]], [".outline-solid", null, 4, [["--tw-outline-style", "solid"], ["outline-style", "solid"]]], [".select-none", null, 4, [["-webkit-user-select", "none"], ["user-select", "none"]]], [".select-text", null, 4, [["-webkit-user-select", "text"], ["user-select", "text"]]], [".\\[--panel-bg\\:var\\(--surface-dim\\)\\]", null, 4, [["--panel-bg", "var(--surface-dim)"]]], [".\\[--picker-bg\\:var\\(--surface-0\\)\\]", null, 4, [["--picker-bg", "var(--surface-0)"]]], [".\\[--radius\\:var\\(--radius-pane\\)\\]", null, 4, [["--radius", "var(--radius-pane)"]]], [".\\[--workspace-tools-bg\\:transparent\\]", null, 4, [["--workspace-tools-bg", "transparent"]]], [".\\[-webkit-box-orient\\:vertical\\]", null, 4, [["-webkit-box-orient", "vertical"]]], [".\\[-webkit-line-clamp\\:3\\]", null, 4, [["-webkit-line-clamp", "3"]]], [".\\[-webkit-touch-callout\\:none\\]", null, 4, [["-webkit-touch-callout", "none"]]], [".\\[background\\:none\\]", null, 4, [["background", "none"]]], [".\\[border-right\\:1px_solid_var\\(--git-border\\)\\]", null, 4, [["border-right", "1px solid var(--git-border)"]]], [".\\[border-top\\:1px_solid_var\\(--git-border\\)\\]", null, 4, [["border-top", "1px solid var(--git-border)"]]], [".\\[border\\:0\\]", null, 4, [["border", "0"]]], [".\\[border\\:none\\]", null, 4, [["border", "none"]]], [".\\[font\\:1\\.15rem\\/1_var\\(--font-mono\\)\\]", null, 4, [["font", "1.15rem/1 var(--font-mono)"]]], [".\\[font\\:1rem\\/1\\.2_var\\(--font-mono\\)\\]", null, 4, [["font", "1rem/1.2 var(--font-mono)"]]], [".\\[font\\:inherit\\]", null, 4, [["font", "inherit"]]], [".\\[transition\\:background_0\\.1s_ease\\]", null, 4, [["transition", "background .1s"]]], [".\\[transition\\:background_0\\.12s_ease\\]", null, 4, [["transition", "background .12s"]]], [".\\[transition\\:background_0\\.15s_ease\\]", null, 4, [["transition", "background .15s"]]], [".\\[transition\\:color_0\\.1s_ease\\,background_0\\.1s_ease\\]", null, 4, [["transition", "color .1s, background .1s"]]], [".\\[transition\\:color_0\\.12s_ease\\,background_0\\.12s_ease\\]", null, 4, [["transition", "color .12s, background .12s"]]], [".\\[transition\\:color_0\\.15s_ease\\]", null, 4, [["transition", "color .15s"]]], [".\\[transition\\:opacity_0\\.12s_ease\\]", null, 4, [["transition", "opacity .12s"]]], [".\\[transition\\:transform_0\\.15s_ease\\,background_0\\.15s_ease\\]", null, 4, [["transition", "transform .15s, background .15s"]]], [".not-has-\\[\\[data-setting-row\\]\\]\\:hidden:not(:has([data-setting-row]))", null, 4, [["display", "none"]]], [".group-focus-within\\:flex:is(:where(.group):focus-within *)", null, 4, [["display", "flex"]]], [".group-focus-within\\/row\\:opacity-100:is(:where(.group\\/row):focus-within *)", null, 4, [["opacity", "1"]]], [".group-hover\\:flex:is(:where(.group):hover *)", null, 4, [["display", "flex"]]], [".group-hover\\:opacity-100:is(:where(.group):hover *)", null, 4, [["opacity", "1"]]], [".group-hover\\/line\\:opacity-90:is(:where(.group\\/line):hover *)", null, 4, [["opacity", ".9"]]], [".group-hover\\/ph\\:opacity-100:is(:where(.group\\/ph):hover *), .group-hover\\/row\\:opacity-100:is(:where(.group\\/row):hover *)", null, 4, [["opacity", "1"]]], [".group-focus\\/tree\\:ring-1:is(:where(.group\\/tree):focus *)", null, 4, [["--tw-ring-shadow", "var(--tw-ring-inset, ) 0 0 0 calc(1px + var(--tw-ring-offset-width)) var(--tw-ring-color, currentcolor)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".group-focus\\/tree\\:ring-overlay-1:is(:where(.group\\/tree):focus *)", null, 4, [["--tw-ring-color", "var(--overlay-1)"]]], [".group-focus\\/tree\\:ring-inset:is(:where(.group\\/tree):focus *)", null, 4, [["--tw-ring-inset", "inset"]]], ['.group-aria-checked\\:\\[transform\\:translateX\\(1\\.1rem\\)\\]:is(:where(.group)[aria-checked="true"] *)', null, 4, [["transform", "translateX(1.1rem)"]]], ['.group-aria-checked\\:border-accent:is(:where(.group)[aria-checked="true"] *)', null, 4, [["border-color", "var(--accent)"]]], ['.group-aria-checked\\:bg-accent:is(:where(.group)[aria-checked="true"] *)', null, 4, [["background-color", "var(--accent)"]]], ['.group-aria-checked\\:bg-panel-bg:is(:where(.group)[aria-checked="true"] *)', null, 4, [["background-color", "var(--panel-bg)"]]], ['.group-aria-checked\\:text-accent:is(:where(.group)[aria-checked="true"] *), .group-aria-\\[checked\\=false\\]\\:text-accent:is(:where(.group)[aria-checked="false"] *)', null, 4, [["color", "var(--accent)"]]], [".placeholder\\:text-subtext-0::placeholder", null, 4, [["color", "var(--subtext-0)"]]], [".before\\:absolute:before", null, 4, [["content", "var(--tw-content)"], ["position", "absolute"]]], [".before\\:top-\\[0\\.15rem\\]:before", null, 4, [["content", "var(--tw-content)"], ["top", ".15rem"]]], [".before\\:left-\\[0\\.15rem\\]:before", null, 4, [["content", "var(--tw-content)"], ["left", ".15rem"]]], [".before\\:h-\\[0\\.95rem\\]:before", null, 4, [["content", "var(--tw-content)"], ["height", ".95rem"]]], [".before\\:w-\\[0\\.95rem\\]:before", null, 4, [["content", "var(--tw-content)"], ["width", ".95rem"]]], [".before\\:rounded-full:before", null, 4, [["content", "var(--tw-content)"], ["border-radius", "3.40282e38px"]]], [".before\\:bg-fg:before", null, 4, [["content", "var(--tw-content)"], ["background-color", "var(--text)"]]], [".before\\:content-\\[\\'\\'\\]:before", null, 4, [["--tw-content", '""'], ["content", "var(--tw-content)"]]], [".before\\:\\[transition\\:transform_0\\.12s_ease\\]:before", null, 4, [["content", "var(--tw-content)"], ["transition", "transform .12s"]]], [".after\\:absolute:after", null, 4, [["content", "var(--tw-content)"], ["position", "absolute"]]], [".after\\:inset-0:after", null, 4, [["content", "var(--tw-content)"], ["inset", "0"]]], [".after\\:inset-x-0:after", null, 4, [["content", "var(--tw-content)"], ["inset-inline", "0"]]], [".after\\:-inset-y-2:after", null, 4, [["content", "var(--tw-content)"], ["inset-block", "calc(var(--spacing) * -2)"]]], [".after\\:m-auto:after", null, 4, [["content", "var(--tw-content)"], ["margin", "auto"]]], [".after\\:h-8:after", null, 4, [["content", "var(--tw-content)"], ["height", "calc(var(--spacing) * 8)"]]], [".after\\:h-12:after", null, 4, [["content", "var(--tw-content)"], ["height", "calc(var(--spacing) * 12)"]]], [".after\\:h-\\[3px\\]:after", null, 4, [["content", "var(--tw-content)"], ["height", "3px"]]], [".after\\:w-8:after", null, 4, [["content", "var(--tw-content)"], ["width", "calc(var(--spacing) * 8)"]]], [".after\\:w-\\[3px\\]:after", null, 4, [["content", "var(--tw-content)"], ["width", "3px"]]], [".after\\:rounded-full:after", null, 4, [["content", "var(--tw-content)"], ["border-radius", "3.40282e38px"]]], [".after\\:bg-transparent:after", null, 4, [["content", "var(--tw-content)"], ["background-color", "#0000"]]], [".after\\:content-\\[\\'\\'\\]:after", null, 4, [["--tw-content", '""'], ["content", "var(--tw-content)"]]], [".last\\:border-b-0:last-child", null, 4, [["border-bottom-style", "var(--tw-border-style)"], ["border-bottom-width", "0"]]], [".checked\\:bg-accent:checked", null, 4, [["background-color", "var(--accent)"]]], [".checked\\:before\\:translate-x-\\[1rem\\]:checked:before", null, 4, [["content", "var(--tw-content)"], ["--tw-translate-x", "1rem"], ["translate", "var(--tw-translate-x) var(--tw-translate-y)"]]], [".checked\\:before\\:bg-panel-bg:checked:before", null, 4, [["content", "var(--tw-content)"], ["background-color", "var(--panel-bg)"]]], [".focus-within\\:bg-surface-1:focus-within", null, 4, [["background-color", "var(--surface-1)"]]], [".focus-within\\:outline:focus-within, .focus-within\\:outline-1:focus-within", null, 4, [["outline-style", "var(--tw-outline-style)"], ["outline-width", "1px"]]], [".focus-within\\:outline-fg:focus-within", null, 4, [["outline-color", "var(--text)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_12\\%\\,transparent\\)\\]:hover", null, 4, [["background-color", "var(--accent)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_12\\%\\,transparent\\)\\]:hover", null, 4, [["background-color", "color-mix(in srgb,var(--accent) 12%,transparent)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_15\\%\\,transparent\\)\\]:hover", null, 4, [["background-color", "var(--accent)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_15\\%\\,transparent\\)\\]:hover", null, 4, [["background-color", "color-mix(in srgb,var(--accent) 15%,transparent)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--text\\)_10\\%\\,var\\(--panel-bg\\)\\)\\]:hover", null, 4, [["background-color", "var(--text)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--text\\)_10\\%\\,var\\(--panel-bg\\)\\)\\]:hover", null, 4, [["background-color", "color-mix(in srgb,var(--text) 10%,var(--panel-bg))"]]], [".hover\\:bg-\\[var\\(--surface-0\\)\\]:hover", null, 4, [["background-color", "var(--surface-0)"]]], [".hover\\:bg-accent:hover", null, 4, [["background-color", "var(--accent)"]]], [".hover\\:bg-overlay-0:hover", null, 4, [["background-color", "var(--overlay-0)"]]], [".hover\\:bg-panel-bg:hover", null, 4, [["background-color", "var(--panel-bg)"]]], [".hover\\:bg-surface-0:hover", null, 4, [["background-color", "var(--surface-0)"]]], [".hover\\:bg-surface-1:hover", null, 4, [["background-color", "var(--surface-1)"]]], [".hover\\:bg-transparent:hover", null, 4, [["background-color", "#0000"]]], [".hover\\:text-accent:hover", null, 4, [["color", "var(--accent)"]]], [".hover\\:text-fg:hover", null, 4, [["color", "var(--text)"]]], [".hover\\:text-inherit:hover", null, 4, [["color", "inherit"]]], [".hover\\:text-overlay-0:hover", null, 4, [["color", "var(--overlay-0)"]]], [".hover\\:text-panel-bg:hover", null, 4, [["color", "var(--panel-bg)"]]], [".hover\\:text-red:hover", null, 4, [["color", "var(--red)"]]], [".hover\\:text-subtext-0:hover", null, 4, [["color", "var(--subtext-0)"]]], [".hover\\:text-yellow:hover", null, 4, [["color", "var(--yellow)"]]], [".hover\\:underline:hover", null, 4, [["text-decoration-line", "underline"]]], [".hover\\:opacity-60:hover", null, 4, [["opacity", ".6"]]], [".hover\\:opacity-100\\!:hover", null, 4, [["opacity", "1", 1]]], [".hover\\:opacity-\\[0\\.85\\]:hover", null, 4, [["opacity", ".85"]]], [".hover\\:brightness-110:hover", null, 4, [["--tw-brightness", "brightness(110%)"], ["filter", "var(--tw-blur, ) var(--tw-brightness, ) var(--tw-contrast, ) var(--tw-grayscale, ) var(--tw-hue-rotate, ) var(--tw-invert, ) var(--tw-saturate, ) var(--tw-sepia, ) var(--tw-drop-shadow, )"]]], [".hover\\:\\[filter\\:brightness\\(1\\.08\\)\\]:hover", null, 4, [["filter", "brightness(1.08)"]]], [".hover\\:after\\:bg-overlay-1:hover:after", null, 4, [["content", "var(--tw-content)"], ["background-color", "var(--overlay-1)"]]], [".focus\\:\\[outline\\:1px_solid_var\\(--accent\\)\\]:focus", null, 4, [["outline", "1px solid var(--accent)"]]], [".focus\\:outline-2:focus", null, 4, [["outline-style", "var(--tw-outline-style)"], ["outline-width", "2px"]]], [".focus\\:outline-none:focus", null, 4, [["--tw-outline-style", "none"], ["outline-style", "none"]]], [".focus-visible\\:bg-accent:focus-visible", null, 4, [["background-color", "var(--accent)"]]], [".focus-visible\\:bg-surface-0:focus-visible", null, 4, [["background-color", "var(--surface-0)"]]], [".focus-visible\\:bg-surface-1:focus-visible", null, 4, [["background-color", "var(--surface-1)"]]], [".focus-visible\\:text-accent:focus-visible", null, 4, [["color", "var(--accent)"]]], [".focus-visible\\:text-fg:focus-visible", null, 4, [["color", "var(--text)"]]], [".focus-visible\\:text-panel-bg:focus-visible", null, 4, [["color", "var(--panel-bg)"]]], [".focus-visible\\:text-red:focus-visible", null, 4, [["color", "var(--red)"]]], [".focus-visible\\:text-yellow:focus-visible", null, 4, [["color", "var(--yellow)"]]], [".focus-visible\\:underline:focus-visible", null, 4, [["text-decoration-line", "underline"]]], [".focus-visible\\:opacity-100:focus-visible", null, 4, [["opacity", "1"]]], [".focus-visible\\:\\[outline\\:1px_solid_var\\(--accent\\)\\]:focus-visible", null, 4, [["outline", "1px solid var(--accent)"]]], [".focus-visible\\:\\[outline\\:1px_solid_var\\(--overlay-1\\)\\]:focus-visible", null, 4, [["outline", "1px solid var(--overlay-1)"]]], [".focus-visible\\:\\[outline\\:2px_solid_var\\(--accent\\)\\]:focus-visible", null, 4, [["outline", "2px solid var(--accent)"]]], [".focus-visible\\:outline:focus-visible, .focus-visible\\:outline-1:focus-visible", null, 4, [["outline-style", "var(--tw-outline-style)"], ["outline-width", "1px"]]], [".focus-visible\\:\\[outline-offset\\:-1px\\]:focus-visible", null, 4, [["outline-offset", "-1px"]]], [".focus-visible\\:\\[outline-offset\\:-2px\\]:focus-visible", null, 4, [["outline-offset", "-2px"]]], [".focus-visible\\:\\[outline-offset\\:2px\\]:focus-visible", null, 4, [["outline-offset", "2px"]]], [".focus-visible\\:outline-offset-1:focus-visible", null, 4, [["outline-offset", "1px"]]], [".focus-visible\\:outline-fg:focus-visible", null, 4, [["outline-color", "var(--text)"]]], [".focus-visible\\:after\\:bg-accent:focus-visible:after", null, 4, [["content", "var(--tw-content)"], ["background-color", "var(--accent)"]]], [".active\\:cursor-grabbing:active", null, 4, [["cursor", "grabbing"]]], [".active\\:bg-surface-1:active", null, 4, [["background-color", "var(--surface-1)"]]], [".active\\:text-fg:active", null, 4, [["color", "var(--text)"]]], [".active\\:after\\:bg-accent:active:after", null, 4, [["content", "var(--tw-content)"], ["background-color", "var(--accent)"]]], [".enabled\\:hover\\:bg-surface-1:enabled:hover", null, 4, [["background-color", "var(--surface-1)"]]], [".enabled\\:hover\\:text-fg:enabled:hover", null, 4, [["color", "var(--text)"]]], [".disabled\\:cursor-default:disabled", null, 4, [["cursor", "default"]]], [".disabled\\:cursor-not-allowed:disabled", null, 4, [["cursor", "not-allowed"]]], [".disabled\\:cursor-not-allowed\\!:disabled", null, 4, [["cursor", "not-allowed", 1]]], [".disabled\\:cursor-wait:disabled", null, 4, [["cursor", "wait"]]], [".disabled\\:bg-transparent:disabled", null, 4, [["background-color", "#0000"]]], [".disabled\\:text-fg:disabled", null, 4, [["color", "var(--text)"]]], [".disabled\\:opacity-40:disabled", null, 4, [["opacity", ".4"]]], [".disabled\\:opacity-50:disabled", null, 4, [["opacity", ".5"]]], [".disabled\\:opacity-\\[0\\.45\\]:disabled", null, 4, [["opacity", ".45"]]], [".disabled\\:opacity-\\[0\\.55\\]:disabled", null, 4, [["opacity", ".55"]]], [":where(.app--mac-desktop) .in-\\[\\.app--mac-desktop\\]\\:pl-\\[84px\\]", null, 4, [["padding-left", "84px"]]], [".has-\\[\\:checked\\]\\:bg-surface-0:has(:checked)", null, 4, [["background-color", "var(--surface-0)"]]], [".has-\\[\\:checked\\]\\:text-fg:has(:checked)", null, 4, [["color", "var(--text)"]]], [".has-\\[\\:focus-visible\\]\\:bg-surface-0:has(:focus-visible)", null, 4, [["background-color", "var(--surface-0)"]]], ['.aria-disabled\\:cursor-not-allowed[aria-disabled="true"]', null, 4, [["cursor", "not-allowed"]]], ['.aria-disabled\\:opacity-40[aria-disabled="true"]', null, 4, [["opacity", ".4"]]], ['.aria-expanded\\:opacity-100[aria-expanded="true"]', null, 4, [["opacity", "1"]]], ['.aria-pressed\\:bg-surface-0[aria-pressed="true"]', null, 4, [["background-color", "var(--surface-0)"]]], ['.aria-pressed\\:text-fg[aria-pressed="true"]', null, 4, [["color", "var(--text)"]]], [".motion-reduce\\:animate-none", ["(prefers-reduced-motion: reduce)"], 4, [["animation", "none"]]], [".max-\\[900px\\]\\:hidden", ["not all and (min-width: 900px)"], 4, [["display", "none"]]], [".max-\\[700px\\]\\:hidden", ["not all and (min-width: 700px)"], 4, [["display", "none"]]], [".max-\\[700px\\]\\:size-11", ["not all and (min-width: 700px)"], 4, [["width", "calc(var(--spacing) * 11)"], ["height", "calc(var(--spacing) * 11)"]]], [".max-\\[700px\\]\\:h-9", ["not all and (min-width: 700px)"], 4, [["height", "calc(var(--spacing) * 9)"]]], [".max-\\[700px\\]\\:h-12", ["not all and (min-width: 700px)"], 4, [["height", "calc(var(--spacing) * 12)"]]], [".max-\\[700px\\]\\:min-h-9", ["not all and (min-width: 700px)"], 4, [["min-height", "calc(var(--spacing) * 9)"]]], [".max-\\[700px\\]\\:min-h-11", ["not all and (min-width: 700px)"], 4, [["min-height", "calc(var(--spacing) * 11)"]]], [".max-\\[700px\\]\\:w-24", ["not all and (min-width: 700px)"], 4, [["width", "calc(var(--spacing) * 24)"]]], [".max-\\[700px\\]\\:min-w-11", ["not all and (min-width: 700px)"], 4, [["min-width", "calc(var(--spacing) * 11)"]]], [".max-\\[700px\\]\\:flex-1", ["not all and (min-width: 700px)"], 4, [["flex", "1"]]], [".max-\\[700px\\]\\:flex-\\[1_1_6rem\\]", ["not all and (min-width: 700px)"], 4, [["flex", "6rem"]]], [".max-\\[700px\\]\\:flex-\\[1_1_100\\%\\]", ["not all and (min-width: 700px)"], 4, [["flex", "100%"]]], [".max-\\[700px\\]\\:basis-56", ["not all and (min-width: 700px)"], 4, [["flex-basis", "calc(var(--spacing) * 56)"]]], [".max-\\[700px\\]\\:basis-full", ["not all and (min-width: 700px)"], 4, [["flex-basis", "100%"]]], [".max-\\[700px\\]\\:flex-wrap", ["not all and (min-width: 700px)"], 4, [["flex-wrap", "wrap"]]], [".max-\\[700px\\]\\:gap-y-2", ["not all and (min-width: 700px)"], 4, [["row-gap", "calc(var(--spacing) * 2)"]]], [".min-\\[701px\\]\\:left-auto", ["(min-width: 701px)"], 4, [["left", "auto"]]], [".min-\\[701px\\]\\:my-\\[3px\\]", ["(min-width: 701px)"], 4, [["margin-block", "3px"]]], [".min-\\[701px\\]\\:block", ["(min-width: 701px)"], 4, [["display", "block"]]], [".min-\\[701px\\]\\:hidden", ["(min-width: 701px)"], 4, [["display", "none"]]], [".min-\\[701px\\]\\:min-h-6", ["(min-width: 701px)"], 4, [["min-height", "calc(var(--spacing) * 6)"]]], [".min-\\[701px\\]\\:w-80", ["(min-width: 701px)"], 4, [["width", "calc(var(--spacing) * 80)"]]], [".min-\\[701px\\]\\:rounded-ui", ["(min-width: 701px)"], 4, [["border-radius", "var(--radius)"]]], [".min-\\[701px\\]\\:px-3", ["(min-width: 701px)"], 4, [["padding-inline", "calc(var(--spacing) * 3)"]]], [".min-\\[701px\\]\\:px-4", ["(min-width: 701px)"], 4, [["padding-inline", "calc(var(--spacing) * 4)"]]], [".min-\\[701px\\]\\:pr-\\[3px\\]", ["(min-width: 701px)"], 4, [["padding-right", "3px"]]], [".min-\\[701px\\]\\:pl-4", ["(min-width: 701px)"], 4, [["padding-left", "calc(var(--spacing) * 4)"]]], [".min-\\[701px\\]\\:text-\\[0\\.62rem\\]", ["(min-width: 701px)"], 4, [["font-size", ".62rem"]]], [".min-\\[701px\\]\\:text-\\[12\\.5px\\]", ["(min-width: 701px)"], 4, [["font-size", "12.5px"]]], [".min-\\[701px\\]\\:text-\\[12px\\]", ["(min-width: 701px)"], 4, [["font-size", "12px"]]], [".min-\\[701px\\]\\:font-medium", ["(min-width: 701px)"], 4, [["--tw-font-weight", "var(--font-weight-medium)"], ["font-weight", "var(--font-weight-medium)"]]], [".min-\\[701px\\]\\:font-semibold", ["(min-width: 701px)"], 4, [["--tw-font-weight", "var(--font-weight-semibold)"], ["font-weight", "var(--font-weight-semibold)"]]], [".min-\\[701px\\]\\:tracking-\\[0\\.045em\\]", ["(min-width: 701px)"], 4, [["--tw-tracking", ".045em"], ["letter-spacing", ".045em"]]], [".min-\\[701px\\]\\:text-subtext-0", ["(min-width: 701px)"], 4, [["color", "var(--subtext-0)"]]], [".min-\\[701px\\]\\:uppercase", ["(min-width: 701px)"], 4, [["text-transform", "uppercase"]]], [".min-\\[900px\\]\\:inline", ["(min-width: 900px)"], 4, [["display", "inline"]]], [".pointer-coarse\\:opacity-100", ["(pointer: coarse)"], 4, [["opacity", "1"]]], [".\\[\\&_\\.mode-switch\\]\\:ml-0 .mode-switch", null, 4, [["margin-left", "0"]]], [".max-\\[700px\\]\\:\\[\\&_button\\]\\:min-h-11 button", ["not all and (min-width: 700px)"], 4, [["min-height", "calc(var(--spacing) * 11)"]]], [".\\[\\&_pre\\]\\:m-\\[0\\.2rem_0_0\\.3rem_1\\.2rem\\] pre", null, 4, [["margin", ".2rem 0 .3rem 1.2rem"]]], [".\\[\\&_pre\\]\\:max-h-72 pre", null, 4, [["max-height", "calc(var(--spacing) * 72)"]]], [".\\[\\&_pre\\]\\:overflow-auto pre", null, 4, [["overflow", "auto"]]], [".\\[\\&_pre\\]\\:rounded-ui pre", null, 4, [["border-radius", "var(--radius)"]]], [".\\[\\&_pre\\]\\:bg-surface-0 pre", null, 4, [["background-color", "var(--surface-0)"]]], [".\\[\\&_pre\\]\\:p-2 pre", null, 4, [["padding", "calc(var(--spacing) * 2)"]]], [".\\[\\&_pre\\]\\:text-\\[0\\.78rem\\] pre", null, 4, [["font-size", ".78rem"]]], [".\\[\\&_pre\\]\\:\\[overflow-wrap\\:anywhere\\] pre", null, 4, [["overflow-wrap", "anywhere"]]], [".\\[\\&_pre\\]\\:whitespace-pre-wrap pre", null, 4, [["white-space", "pre-wrap"]]], [".\\[\\&_pre\\]\\:text-fg pre, .\\[\\&_strong\\]\\:text-fg strong", null, 4, [["color", "var(--text)"]]], [".\\[\\&_summary\\]\\:cursor-pointer summary", null, 4, [["cursor", "pointer"]]], [".\\[\\&\\:hover\\:not\\(\\:disabled\\)\\]\\:bg-surface-1:hover:not(:disabled)", null, 4, [["background-color", "var(--surface-1)"]]], [".\\[\\&\\:hover\\:not\\(\\:disabled\\)\\]\\:text-accent:hover:not(:disabled)", null, 4, [["color", "var(--accent)"]]], [".\\[\\&\\:hover\\:not\\(\\:disabled\\)\\]\\:text-red:hover:not(:disabled)", null, 4, [["color", "var(--red)"]]], [".\\[\\&\\:not\\(\\:has\\(\\[data-setting-row\\]\\)\\)\\>\\[data-none\\]\\]\\:block:not(:has([data-setting-row])) > [data-none]", null, 4, [["display", "block"]]], [".\\[\\&\\>\\*\\]\\:min-h-0 > *", null, 4, [["min-height", "0"]]], [".\\[\\&\\>\\*\\]\\:min-w-0 > *", null, 4, [["min-width", "0"]]], [".\\[\\&\\>\\*\\]\\:flex-1 > *", null, 4, [["flex", "1"]]], [".\\[\\&\\>\\*\\]\\:shrink-0 > *", null, 4, [["flex-shrink", "0"]]], [".\\[\\&\\>li\\]\\:text-\\[0\\.85rem\\] > li", null, 4, [["font-size", ".85rem"]]], [".\\[\\&\\>li\\]\\:leading-\\[1\\.5\\] > li", null, 4, [["--tw-leading", "1.5"], ["line-height", "1.5"]]], [".\\[\\&\\>li\\]\\:text-fg > li", null, 4, [["color", "var(--text)"]]], [".\\[\\&\\>summary\\]\\:flex > summary", null, 4, [["display", "flex"]]], [".\\[\\&\\>summary\\]\\:cursor-pointer > summary", null, 4, [["cursor", "pointer"]]], [".\\[\\&\\>summary\\]\\:list-none > summary", null, 4, [["list-style-type", "none"]]], [".\\[\\&\\>summary\\]\\:items-center > summary", null, 4, [["align-items", "center"]]], [".\\[\\&\\>summary\\]\\:gap-\\[0\\.4rem\\] > summary", null, 4, [["gap", ".4rem"]]], [".\\[\\&\\>summary\\]\\:rounded-ui > summary", null, 4, [["border-radius", "var(--radius)"]]], [".\\[\\&\\>summary\\]\\:px-\\[0\\.4rem\\] > summary", null, 4, [["padding-inline", ".4rem"]]], [".\\[\\&\\>summary\\]\\:py-\\[0\\.25rem\\] > summary", null, 4, [["padding-block", ".25rem"]]], [".\\[\\&\\>summary\\]\\:select-none > summary", null, 4, [["-webkit-user-select", "none"], ["user-select", "none"]]], [".\\[\\&\\>summary\\]\\:before\\:inline-block > summary:before", null, 4, [["content", "var(--tw-content)"], ["display", "inline-block"]]], [".\\[\\&\\>summary\\]\\:before\\:size-\\[0\\.4rem\\] > summary:before", null, 4, [["content", "var(--tw-content)"], ["width", ".4rem"], ["height", ".4rem"]]], [".\\[\\&\\>summary\\]\\:before\\:shrink-0 > summary:before", null, 4, [["content", "var(--tw-content)"], ["flex-shrink", "0"]]], [".\\[\\&\\>summary\\]\\:before\\:\\[transform\\:rotate\\(-45deg\\)\\] > summary:before", null, 4, [["content", "var(--tw-content)"], ["transform", "rotate(-45deg)"]]], [".\\[\\&\\>summary\\]\\:before\\:content-\\[\\'\\'\\] > summary:before", null, 4, [["--tw-content", '""'], ["content", "var(--tw-content)"]]], [".\\[\\&\\>summary\\]\\:before\\:\\[border-bottom\\:1\\.3px_solid_currentColor\\] > summary:before", null, 4, [["content", "var(--tw-content)"], ["border-bottom", "1.3px solid"]]], [".\\[\\&\\>summary\\]\\:before\\:\\[border-right\\:1\\.3px_solid_currentColor\\] > summary:before", null, 4, [["content", "var(--tw-content)"], ["border-right", "1.3px solid"]]], [".\\[\\&\\>summary\\]\\:before\\:\\[transition\\:transform_0\\.15s_ease\\] > summary:before", null, 4, [["content", "var(--tw-content)"], ["transition", "transform .15s"]]], [".\\[\\&\\>summary\\:hover\\]\\:bg-surface-1 > summary:hover", null, 4, [["background-color", "var(--surface-1)"]]], [".\\[\\&\\>summary\\:hover\\]\\:text-fg > summary:hover", null, 4, [["color", "var(--text)"]]], [".\\[\\&\\[open\\]\\>summary\\]\\:before\\:\\[transform\\:rotate\\(45deg\\)\\][open] > summary:before", null, 4, [["content", "var(--tw-content)"], ["transform", "rotate(45deg)"]]], [".app--mobile .\\[\\.app--mobile_\\&\\]\\:min-h-11", null, 4, [["min-height", "calc(var(--spacing) * 11)"]]], [".app--mobile .\\[\\.app--mobile_\\&\\]\\:min-h-\\[44px\\]", null, 4, [["min-height", "44px"]]], [".\\[\\@media\\(hover\\:none\\)\\]\\:opacity-60", ["(hover: none)"], 4, [["opacity", ".6"]]], [".\\[\\@media\\(hover\\:none\\)\\]\\:opacity-100", ["(hover: none)"], 4, [["opacity", "1"]]], [".\\[\\@media\\(max-width\\:700px\\)\\]\\:h-\\[2\\.75rem\\]", ["(max-width: 700px)"], 4, [["height", "2.75rem"]]], [".\\[\\@media\\(max-width\\:700px\\)\\]\\:min-h-\\[2\\.75rem\\]", ["(max-width: 700px)"], 4, [["min-height", "2.75rem"]]], [".\\[\\@media\\(max-width\\:700px\\)\\]\\:w-\\[2\\.75rem\\]", ["(max-width: 700px)"], 4, [["width", "2.75rem"]]], [".\\[\\@media\\(max-width\\:700px\\)\\]\\:min-w-\\[2\\.75rem\\]", ["(max-width: 700px)"], 4, [["min-width", "2.75rem"]]], [".\\[\\@media\\(max-width\\:700px\\)\\]\\:px-\\[0\\.65rem\\]", ["(max-width: 700px)"], 4, [["padding-inline", ".65rem"]]], ["div:hover > .\\[div\\:hover\\>\\&\\]\\:opacity-100", null, 4, [["opacity", "1"]]], [":root", null, 1e3, [["color-scheme", "dark"], ["--scrollbar-size", "6px"], ["--accent", "#c8c8c8"], ["--panel-bg", "#161616"], ["--surface-0", "#262626"], ["--surface-1", "#333"], ["--surface-dim", "#1c1c1c"], ["--backdrop", "#050505"], ["--overlay-0", "#3a3a3a"], ["--overlay-1", "#9b9b9b"], ["--text", "#d8d8d8"], ["--subtext-0", "#9b9b9b"], ["--mauve", "#a993c9"], ["--green", "#7fb685"], ["--yellow", "#d3b46a"], ["--red", "#df8c8c"], ["--blue", "#7aa2d7"], ["--teal", "#7fb8b8"], ["--peach", "#d39a6a"], ["--bg", "var(--panel-bg)"], ["--surface", "var(--surface-0)"], ["--surface-alt", "var(--surface-1)"], ["--border", "var(--overlay-0)"], ["--muted", "var(--subtext-0)"], ["--danger", "var(--red)"], ["--radius", "8px"], ["--radius-pane", "8px"], ["accent-color", "var(--accent)"], ["--font-ui", '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif'], ["--font-mono", `ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono",
    monospace`], ["font-family", "var(--font-ui)"]]], ["code, pre, kbd, samp", null, 1e3, [["font-family", "var(--font-mono)"]]], ["*", null, 1e3, [["box-sizing", "border-box"]]], ["html, body, #root", null, 1e3, [["height", "100%"], ["margin", "0"]]], ["html", null, 1e3, [["overscroll-behavior", "none"], ["--shell-bg", "var(--panel-bg)"]]], ["html[data-glass]", null, 1e3, [["--shell-bg", "var(--panel-bg)"]]], ["html[data-glass]", null, 1e3, [["--shell-bg", "color-mix(in srgb, var(--panel-bg) 86%, transparent)"]]], ["html", null, 1e3, [["--backdrop-bg", "var(--backdrop)"], ["--card-bg", "var(--panel-bg)"]]], ["html[data-glass]", null, 1e3, [["--backdrop-bg", "var(--backdrop)"]]], ["html[data-glass]", null, 1e3, [["--backdrop-bg", "color-mix(in srgb, var(--backdrop) 86%, transparent)"]]], ["html[data-glass]", null, 1e3, [["--card-bg", "var(--panel-bg)"]]], ["html[data-glass]", null, 1e3, [["--card-bg", "color-mix(in srgb, var(--panel-bg) 86%, transparent)"]]], ['body:has(.app--cards, .app--mobile), .app--cards .dock-area:has([data-testid="split-canvas"]:not([data-split="0"]))', null, 1e3, [["background", "var(--backdrop-bg)"]]], ["body", null, 1e3, [["background", "var(--shell-bg)"], ["color", "var(--text)"], ["overscroll-behavior", "none"], ["-webkit-tap-highlight-color", "transparent"], ["line-height", "1.3"]]], [".app", null, 1e3, [["flex-direction", "column"], ["height", "100dvh"], ["display", "flex"]]], [".app--mobile", null, 1e3, [["inset", "var(--visible-top, 0px) 0 auto 0"], ["height", "var(--visible-height, 100dvh)"], ["position", "fixed"]]], [".mobile-drawer-backdrop", null, 1e3, [["animation", ".15s ease-out mobile-fade"]]], [".mobile-drawer--left", null, 1e3, [["animation", ".2s cubic-bezier(.2, .8, .2, 1) mobile-slide-left"]]], [".mobile-drawer--right", null, 1e3, [["animation", ".2s cubic-bezier(.2, .8, .2, 1) mobile-slide-right"]]], [".mobile-sheet", null, 1e3, [["animation", ".22s cubic-bezier(.2, .8, .2, 1) mobile-rise"]]], [".mobile-drawer-backdrop, .mobile-drawer, .mobile-sheet", ["(prefers-reduced-motion: reduce)"], 1e3, [["animation", "none"]]], [".layout-drawer", null, 1e3, [["transform", "translateX(var(--float-hide, 0))"], ["transition", "transform .18s"]]], [".layout-drawer:hover, .layout-drawer:focus-within", null, 1e3, [["--float-hide", "0px"]]], [".dockview-theme-perch", null, 1e3, [["--dv-color-abyss-dark", "var(--panel-bg)"], ["--dv-color-abyss", "var(--surface-0)"], ["--dv-color-abyss-light", "var(--surface-1)"], ["--dv-color-abyss-lighter", "var(--overlay-0)"], ["--dv-color-abyss-accent", "var(--accent)"], ["--dv-color-abyss-primary-text", "var(--text)"], ["--dv-color-abyss-secondary-text", "var(--subtext-0)"], ["--dv-group-view-background-color", "var(--panel-bg)"], ["--dv-tabs-and-actions-container-background-color", "var(--surface-0)"], ["--dv-activegroup-visiblepanel-tab-background-color", "var(--panel-bg)"], ["--dv-activegroup-hiddenpanel-tab-background-color", "var(--surface-0)"], ["--dv-inactivegroup-visiblepanel-tab-background-color", "var(--panel-bg)"], ["--dv-inactivegroup-hiddenpanel-tab-background-color", "var(--surface-0)"], ["--dv-tab-divider-color", "var(--overlay-0)"], ["--dv-activegroup-visiblepanel-tab-color", "var(--text)"], ["--dv-activegroup-hiddenpanel-tab-color", "var(--subtext-0)"], ["--dv-inactivegroup-visiblepanel-tab-color", "var(--subtext-0)"], ["--dv-inactivegroup-hiddenpanel-tab-color", "var(--subtext-0)"], ["--dv-separator-border", "var(--overlay-0)"], ["--dv-paneview-header-border-color", "var(--overlay-0)"], ["--dv-tabs-and-actions-container-font-size", ".82rem"], ["--dv-tabs-and-actions-container-height", "2.1rem"]]], [".dockview-theme-perch .dv-tabs-and-actions-container", null, 1e3, [["z-index", "1"], ["position", "relative"]]], [".pane-tab", null, 1e3, [["align-items", "center"], ["width", "100%"], ["height", "100%"], ["display", "flex"]]], [".pane-tab__agent-badge", null, 1e3, [["color", "var(--subtext-0)"], ["white-space", "nowrap"], ["flex-shrink", "0"], ["margin-right", ".4rem"], ["font-size", ".78em"]]], ['.pane-tab[data-testid="pane-tab-chat"] .dv-default-tab-action', null, 1e3, [["display", "none"]]], [".dockview-group-action", null, 1e3, [["border-radius", "var(--radius)"], ["width", "1.5rem"], ["height", "1.5rem"], ["color", "var(--subtext-0)"], ["cursor", "pointer"], ["background", "none"], ["border", "none"], ["justify-content", "center"], ["align-self", "center"], ["align-items", "center"], ["margin", "0 .15rem"], ["font-size", "1rem"], ["line-height", "1"], ["transition", "color .1s, background .1s"], ["display", "flex"]]], [".dockview-group-action:hover", null, 1e3, [["color", "var(--text)"], ["background", "var(--surface-1)"]]], [".dockview-theme-perch .dv-view-container > .dv-view:has(.dv-inactive-group)", ["(max-width: 700px)"], 1e3, [["display", "none"]]], [".dockview-theme-perch .dv-view-container > .dv-view:has(.dv-active-group)", ["(max-width: 700px)"], 1e3, [["width", "100%", 1], ["left", "0", 1]]], [".chat", null, 1e3, [["isolation", "isolate"], ["flex-direction", "column"], ["flex", "1"], ["height", "100%"], ["min-height", "0"], ["display", "flex"]]], [".message__markdown p", null, 1e3, [["margin", "0 0 .5em"]]], [".message__markdown p:last-child", null, 1e3, [["margin-bottom", "0"]]], [".message__markdown h1, .message__markdown h2, .message__markdown h3, .message__markdown h4", null, 1e3, [["margin", ".6em 0 .3em"], ["line-height", "1.25"]]], [".message__markdown h1", null, 1e3, [["font-size", "1.25em"]]], [".message__markdown h2", null, 1e3, [["font-size", "1.12em"]]], [".message__markdown h3", null, 1e3, [["font-size", "1em"]]], [".message__markdown > * + *", null, 1e3, [["margin-top", ".5em"]]], [".message__markdown table, .md-table", null, 1e3, [["border-collapse", "separate"], ["border-spacing", "0"], ["background", "var(--surface-0)"], ["border-radius", "var(--radius)"], ["max-width", "100%"], ["margin", ".5em 0"], ["font-size", ".92em"], ["display", "block"], ["overflow-x", "auto"]]], [".md-table", null, 1e3, [["width", "100%"], ["margin", "0"], ["display", "table"]]], [".message__markdown th, .message__markdown td, .md-table th, .md-table td", null, 1e3, [["text-align", "left"], ["vertical-align", "top"], ["border-bottom", "1px solid var(--surface-1)"], ["padding", ".35em .75em"]]], [".message__markdown th, .md-table th", null, 1e3, [["color", "var(--subtext-0)"], ["white-space", "nowrap"], ["background", "var(--surface-1)"], ["font-weight", "600"]]], [".message__markdown tbody tr:last-child td, .md-table tbody tr:last-child td", null, 1e3, [["border-bottom", "0"]]], [".message__markdown tbody tr:hover td, .md-table tbody tr:hover td", null, 1e3, [["background", "var(--surface-1)"]]], [".md-table caption", null, 1e3, [["text-align", "left"], ["color", "var(--subtext-0)"], ["padding", ".4em .75em"]]], [".md-code", null, 1e3, [["background", "var(--surface-0)"], ["border-radius", "var(--radius)"], ["overflow", "hidden"]]], [".md-code__bar", null, 1e3, [["color", "var(--subtext-0)"], ["background", "var(--surface-1)"], ["justify-content", "space-between"], ["align-items", "center"], ["padding", ".1rem .4rem .1rem .75rem"], ["font-size", ".75em"], ["display", "flex"]]], [".message__markdown .md-code pre", null, 1e3, [["background", "none"], ["border-radius", "0"], ["margin", "0"]]], [".hl-keyword", null, 1e3, [["color", "var(--mauve)"]]], [".hl-string", null, 1e3, [["color", "var(--green)"]]], [".hl-number", null, 1e3, [["color", "var(--peach)"]]], [".hl-function", null, 1e3, [["color", "var(--blue)"]]], [".hl-type", null, 1e3, [["color", "var(--yellow)"]]], [".hl-tag", null, 1e3, [["color", "var(--teal)"]]], [".hl-comment", null, 1e3, [["color", "var(--overlay-1)"], ["font-style", "italic"]]], [".message__markdown ul, .message__markdown ol", null, 1e3, [["margin", ".3em 0 .5em 1.3em"], ["padding", "0"]]], [".message__markdown li", null, 1e3, [["margin-bottom", ".2em"]]], [".message__markdown code", null, 1e3, [["background", "var(--surface-0)"], ["border-radius", ".25rem"], ["padding", ".1em .35em"], ["font-family", "ui-monospace, SFMono-Regular, SF Mono, Menlo, Consolas, monospace"], ["font-size", ".88em"]]], [".message__markdown pre", null, 1e3, [["background", "var(--surface-0)"], ["border-radius", "var(--radius)"], ["margin", ".4em 0"], ["padding", ".6rem .75rem"], ["position", "relative"], ["overflow-x", "auto"]]], [".message__markdown pre code", null, 1e3, [["background", "none"], ["border", "none"], ["padding", "0"], ["font-size", ".85em"]]], [".message__markdown a", null, 1e3, [["color", "var(--accent)"], ["text-decoration", "underline"]]], [".message__markdown blockquote", null, 1e3, [["border-left", "3px solid var(--overlay-0)"], ["color", "var(--subtext-0)"], ["margin", ".4em 0"], ["padding", ".1em .6em"]]], [".message__markdown hr", null, 1e3, [["border", "none"], ["border-top", "1px solid var(--overlay-0)"], ["margin", ".75em 0"]]], [".file-markdown", null, 1e3, [["overflow-wrap", "anywhere"]]], [".file-markdown img", null, 1e3, [["max-width", "100%"]]], [".file-markdown table", null, 1e3, [["border-collapse", "collapse"], ["margin", ".4em 0"], ["display", "block"], ["overflow-x", "auto"]]], [".file-markdown th, .file-markdown td", null, 1e3, [["border", "1px solid var(--overlay-0)"], ["padding", ".2em .5em"]]], [".file-markdown .md-placeholder", null, 1e3, [["color", "var(--subtext-0)"], ["border", "1px dashed var(--overlay-0)"], ["border-radius", ".25rem"], ["padding", ".05em .35em"], ["font-size", ".9em"]]], [".terminal", null, 1e3, [["min-width", "0"], ["min-height", "0"], ["padding", "var(--terminal-padding, 0)"], ["opacity", "var(--terminal-opacity, 1)"], ["flex", "1"], ["display", "flex"], ["position", "relative"]]], [".terminal__surface", null, 1e3, [["flex", "1"], ["min-width", "0"], ["min-height", "0"], ["overflow", "hidden"]]], [".terminal__surface .xterm", null, 1e3, [["height", "100%"]]], [".terminal__surface .xterm:not(.allow-transparency) .xterm-viewport", null, 1e3, [["background-color", "#0000"]]], [".terminal__surface .xterm-scrollable-element", null, 1e3, [["position", "static", 1]]], [".terminal__surface .xterm-decoration-overview-ruler, .no-pane-scrollbars .terminal__surface .xterm-scrollable-element > .xterm-scrollbar", null, 1e3, [["display", "none"]]], [".terminal--persistent", null, 1e3, [["flex-direction", "column"]]], [".terminal__toolbar", null, 1e3, [["color", "var(--subtext-0)"], ["align-items", "center"], ["gap", ".5rem"], ["padding", ".25rem 1.5rem .25rem .5rem"], ["font-size", ".8rem"], ["display", "flex"]]], [".terminal__toolbar button", null, 1e3, [["border-radius", "var(--radius)"], ["min-height", "32px"], ["color", "var(--text)"], ["background", "var(--surface-0)"], ["border", "0"], ["padding", ".25rem .5rem"]]], [".terminal__toolbar--overlay", null, 1e3, [["z-index", "2"], ["border-radius", "var(--radius)"], ["background", "var(--surface-1)"], ["padding", ".2rem .3rem .2rem .6rem"], ["position", "absolute"], ["top", ".4rem"], ["right", ".9rem"], ["box-shadow", "0 2px 8px #00000040"]]], [".terminal__connection", null, 1e3, [["margin-right", "auto"]]], [".terminal__toolbar button:disabled", null, 1e3, [["opacity", ".5"]]], [".terminal__notice", null, 1e3, [["color", "var(--subtext-0)"], ["padding", ".75rem"], ["font-size", ".85rem"]]], [".app--mobile .terminal__toolbar button", null, 1e3, [["min-height", "44px"]]], [".app--mobile .terminal__connection", null, 1e3, [["display", "none"]]], [".app--mobile .terminal__toolbar", null, 1e3, [["padding-right", ".5rem"]]], [".terminal__exited", null, 1e3, [["background", "var(--surface-1)"], ["border-radius", "var(--radius)"], ["color", "var(--subtext-0)"], ["padding", ".35rem .75rem"], ["font-size", ".85rem"], ["position", "absolute"], ["bottom", ".75rem"], ["left", "50%"], ["transform", "translateX(-50%)"]]], [".terminal__exited--cli", null, 1e3, [["background", "var(--panel-bg)"], ["flex-direction", "column"], ["align-items", "center"], ["gap", ".6rem"], ["padding", ".9rem 1.1rem"], ["display", "flex"], ["top", "50%"], ["bottom", "auto"], ["transform", "translate(-50%, -50%)"], ["box-shadow", "0 6px 24px #00000059"]]], [".terminal__exited-actions", null, 1e3, [["gap", ".5rem"], ["display", "flex"]]], [".terminal__cli-error", null, 1e3, [["background", "var(--red)"], ["position", "absolute"], ["bottom", ".75rem"], ["left", "50%"], ["transform", "translateX(-50%)"]]], [".terminal__cli-error", null, 1e3, [["background", "color-mix(in srgb, var(--red) 20%, var(--panel-bg))"]]], [".terminal__cli-error", null, 1e3, [["border-radius", "var(--radius)"], ["color", "var(--red)"], ["text-align", "center"], ["white-space", "pre-wrap"], ["word-break", "break-word"], ["max-width", "90%"], ["padding", ".35rem .75rem"], ["font-size", ".85rem"]]], [".mobile-pane-shell__content > .chat, .mobile-pane-shell__content > .terminal, .mobile-pane-shell__content > .workspace-files, .mobile-pane-shell__content > .workspace-git", null, 1e3, [["flex", "1"], ["width", "100%"], ["min-width", "0"], ["height", "100%"], ["min-height", "0"]]], [".terminal__host", null, 1e3, [["width", "100%"], ["height", "100%"], ["overflow", "hidden"]]], [".workspace-git", null, 1e3, [["--git-border", "var(--overlay-0)"]]], [".workspace-git", null, 1e3, [["--git-border", "color-mix(in srgb, var(--overlay-0) 72%, transparent)"]]], [".workspace-git", null, 1e3, [["--git-muted", "var(--subtext-0)"], ["width", "100%"], ["min-width", "0"], ["height", "100%"], ["min-height", "0"], ["color", "var(--text)"], ["background", "var(--workspace-tools-bg, var(--panel-bg))"], ["flex-direction", "column"], ["font-size", ".78rem"], ["display", "flex"], ["position", "relative"], ["overflow", "hidden"], ["container-type", "inline-size"]]], [".workspace-git button, .workspace-git input, .workspace-git textarea", null, 1e3, [["font", "inherit"]]], [".workspace-git button", null, 1e3, [["cursor", "pointer"]]], ['.workspace-git button:focus-visible, .workspace-git input:focus-visible, .workspace-git textarea:focus-visible, .workspace-git [role="button"]:focus-visible', null, 1e3, [["outline", "2px solid var(--accent)"], ["outline-offset", "1px"]]], [".workspace-git__diff", null, 1e3, [["container-type", "inline-size"]]], [".workspace-git__line-comment-thread", null, 1e3, [["max-width", "max(0px, min(42rem, 100cqi - 6.9rem))"], ["position", "sticky"], ["left", "0"]]], [".workspace-git__comment-composer", null, 1e3, [["max-width", "max(0px, 100cqi - 1.4rem)"], ["position", "sticky"], ["left", "0"]]], [".dockview-group-action--split-session", null, 1e3, [["font-size", "13px"]]], [".session-split-popover", null, 1e3, [["display", "flex"], ["flex-direction", "column"], ["background", "var(--surface-1)"], ["border-radius", "var(--radius)"], ["box-shadow", "0 8px 24px rgba(0, 0, 0, 0.45)"], ["padding", "4px"], ["font-size", "12.5px"], ["color", "var(--text)"], ["overflow", "hidden"]]], [".session-split-popover__header", null, 1e3, [["padding", "6px 8px 4px"], ["font-size", "11px"], ["text-transform", "uppercase"], ["letter-spacing", "0.04em"], ["color", "var(--subtext-0)"]]], [".session-split-popover__empty", null, 1e3, [["padding", "8px"], ["color", "var(--subtext-0)"]]], [".session-split-popover__list", null, 1e3, [["overflow-y", "auto"]]], [".session-split-popover__item", null, 1e3, [["display", "flex"], ["flex-direction", "column"], ["align-items", "flex-start"], ["gap", "1px"], ["width", "100%"], ["padding", "6px 8px"], ["border", "none"], ["border-radius", "4px"], ["background", "transparent"], ["color", "inherit"], ["text-align", "left"], ["cursor", "grab"]]], [".session-split-popover__item:hover", null, 1e3, [["background", "var(--surface-0)"]]], [".session-split-popover__item-title", null, 1e3, [["font-weight", "500"], ["white-space", "nowrap"], ["overflow", "hidden"], ["text-overflow", "ellipsis"], ["max-width", "100%"]]], [".session-split-popover__item-cwd", null, 1e3, [["font-size", "11px"], ["color", "var(--subtext-0)"], ["white-space", "nowrap"], ["overflow", "hidden"], ["text-overflow", "ellipsis"], ["max-width", "100%"]]], [".session-split-popover__item-badge", null, 1e3, [["align-self", "flex-end"], ["font-size", "10px"], ["color", "var(--accent)"], ["margin-top", "-14px"]]], [".inactive-session-pane", null, 1e3, [["display", "flex"], ["flex-direction", "column"], ["align-items", "center"], ["justify-content", "center"], ["gap", "10px"], ["height", "100%"], ["padding", "24px"], ["text-align", "center"], ["color", "var(--subtext-0)"]]], [".inactive-session-pane__title", null, 1e3, [["font-size", "14px"], ["font-weight", "500"], ["color", "var(--text)"]]], [".inactive-session-pane__cwd", null, 1e3, [["font-size", "12px"], ["color", "var(--subtext-0)"], ["word-break", "break-all"]]], [".inactive-session-pane__note", null, 1e3, [["font-size", "12px"], ["max-width", "320px"], ["line-height", "1.5"]]], [".inactive-session-pane__switch", null, 1e3, [["margin-top", "4px"], ["padding", "6px 14px"], ["border-radius", "var(--radius)"], ["border", "0"], ["background", "var(--surface-0)"], ["color", "var(--text)"], ["cursor", "pointer"], ["font-size", "12.5px"]]], [".inactive-session-pane__switch:hover", null, 1e3, [["background", "var(--surface-1)"]]]], skipped: { "@supports evaluated false": 2, "@container": 6, "@keyframes": 9 } };
//! The app's compiled stylesheet as a table (`build.mjs` writes it from Vite + Tailwind's output and bundles it as
//! `virtual:perch-css-table`), parsed once on first use.
let Mg = null;
const Ag = () => Mg ??= new Y0(Cg);
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
function jg(n, l) {
  const i = /* @__PURE__ */ new Set([...Object.keys(n), ...Object.keys(l)]);
  for (const o of i) {
    if (o === "children") continue;
    const s = n[o], d = l[o];
    if (!(s === d || typeof s == "function" && typeof d == "function") && !(o === "style" && s && d && typeof s == "object" && typeof d == "object" && [.../* @__PURE__ */ new Set([...Object.keys(s), ...Object.keys(d)])].every((f) => s[f] === d[f])))
      return !0;
  }
  return !1;
}
const Og = (n) => !n.props.disabled && (/^(button|input|select|textarea)$/.test(n.tagName) || n.tagName === "a" && n.props.href != null || n.props.tabIndex != null);
function Pd(n, l) {
  for (const i of l0(l.dangerouslySetInnerHTML?.__html, n.ownerDocument) ?? []) n.appendChild(i);
  return n;
}
const Rg = {
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
  createInstance: (n, l, i) => Pd(new Vt(n, l, i.ownerDocument), l),
  createTextInstance: (n, l) => new Pr(n),
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
      Pd(n, o);
    }
    jg(i, o) && n.touch();
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
}, ze = z0(Rg), ti = (n, l, i = null) => ze.createPortal(n, l, null, i), Dg = {
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
}, Hg = /* @__PURE__ */ new Set(["click", "dblclick", "mousedown", "mouseup"]), Bg = /* @__PURE__ */ new Set(["button", "input", "select", "textarea", "fieldset"]), Ug = (n) => {
  for (let l = n; l instanceof Vt; l = l.parentNode) if (l.props.disabled && Bg.has(l.tagName)) return !0;
  return !1;
};
class qg {
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
function Ar(n, l, i) {
  l.currentTarget = n;
  for (const { type: o, listener: s, capture: d } of [...n.listeners ?? []])
    o === l.type && d === i && s.call(n, l);
  if (n instanceof Vt) {
    const o = Dg[l.type], s = o && n.props[i ? `${o}Capture` : o];
    typeof s == "function" && s(l);
  }
}
function yy(n, l, i = {}) {
  const { document: o, window: s, globals: d } = c0(n), m = new Vt("div", { id: "root", style: i.container ?? {} }, o);
  o.body.appendChild(m);
  const f = [];
  let p = null;
  const y = () => [o, s].map((R) => R.listeners.map((h) => `${h.type}:${h.capture}`).sort().join(",")).join("|");
  let E = "";
  const w = {}, v = `m${Math.random().toString(36).slice(2, 10)}:`;
  let z = 0, N = -1;
  o.measureKey = (R) => v + R.id, o.stale = () => N !== z, o.computed = (R) => {
    if (!w.cascade || !w.top) return null;
    const h = [];
    for (let x = R; x instanceof Vt && x !== o.body; x = x.parentNode) h.unshift(x);
    let b = w.top;
    for (const x of h) b = w.cascade.compute(x, b);
    return b.values;
  };
  const S = () => (z += 1, p = Tg(o, n, Ag(), w, i.names), E = y(), n.render?.(p), p), k = () => {
    ze.flushPassiveEffects(), ze.flushSyncWork(), y() !== E && S();
  };
  o.afterCommit = S;
  const j = (R) => {
    f.push(R), n.error?.(R);
  }, H = ze.createContainer(m, El.ConcurrentRoot, null, !1, null, "", j, j, j, null);
  ze.updateContainerSync(dt.createElement(l, i.props ?? {}), H, null, null), ze.flushSyncWork(), k();
  const A = (R) => {
    const h = (b) => {
      if (b.id === R) return b;
      for (const x of b.children) {
        const _ = h(x);
        if (_) return _;
      }
      return null;
    };
    return h(o.documentElement);
  }, L = (R) => {
    const h = sa;
    sa = El.DiscreteEventPriority;
    try {
      return R();
    } finally {
      sa = h, ze.flushSyncWork(), k();
    }
  }, U = {
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
    describe: S,
    /** Runs a DOM event of `type` at node `id`; false when the node is gone. */
    dispatch(R, h, b = {}) {
      const x = typeof R == "string" ? A(R) : R;
      if (!x || Hg.has(h) && Ug(x)) return !1;
      const _ = new qg(h, b, x), T = [];
      for (let I = x; I; I = I.parentNode) T.push(I);
      const D = [...T, o, s];
      L(() => {
        for (let I = D.length - 1; I > 0 && !_.propagationStopped; I--) Ar(D[I], _, !0);
        _.propagationStopped || (Ar(x, _, !0), _.propagationStopped || Ar(x, _, !1));
        for (let I = 1; I < D.length && !_.propagationStopped; I++) Ar(D[I], _, !1);
      });
      const G = h === "click" && !_.defaultPrevented ? as(x) : null;
      if (G && U.dispatch(G, "submit", {}), h === "click" && !_.defaultPrevented)
        for (let I = x; I; I = I.parentNode) {
          if (I.tagName !== "a") continue;
          const tt = I.props?.href;
          typeof tt == "string" && /^https:\/\/\S+$/.test(tt) && n.openLink?.(tt);
          break;
        }
      return !_.defaultPrevented;
    },
    /** Whether the source listens for `type` on `window` or `document` (a page recording a key press does). */
    listensFor: (R) => [o, s].some((h) => h.listeners.some((b) => b.type === R)),
    /** A key pressed while the screen has the keyboard (`init`: the DOM's `key`, modifiers, `repeat`), at the
     * focused element. When nothing prevented it and that element is a text field, the key edits the field as a
     * browser would: a character is typed at the end (or replaces the text when all of it is selected), Backspace
     * deletes the last one, and the field gets `input` and `change` events with its new `value`. Returns whether the
     * source took the key (prevented it, or a field changed). */
    key(R) {
      const h = o.activeElement && o.activeElement !== o.body ? o.activeElement : o.body;
      if (!U.dispatch(h, "keydown", R)) return !0;
      const x = R.key === "Enter" && !R.isComposing ? as(h, !0) : null;
      if (x)
        return U.dispatch(x, "submit", {}), !0;
      if (!Nf(h) || h.props.disabled || h.props.readOnly) return !1;
      if ((R.ctrlKey || R.metaKey) && !R.altKey && !R.shiftKey && R.key.toLowerCase() === "a")
        return h.selectedAll = !0, !0;
      if (R.ctrlKey || R.metaKey) return !1;
      const _ = h.selectedAll;
      h.selectedAll = !1;
      const T = h.value, G = R.key === "Backspace" || _ && R.key === "Delete" ? _ ? "" : T.slice(0, -1) : [...R.key].length === 1 ? (_ ? "" : T) + R.key : T;
      return G === T ? !1 : (h.value = G, U.dispatch(h, "input", { data: R.key }), U.dispatch(h, "change", {}), h.props.value !== void 0 && delete h.edit, h.touch(), S(), !0);
    },
    /** The engine's box for node `id` (window coordinates, logical px), for `getBoundingClientRect`. */
    setBounds(R, h) {
      const b = A(R);
      b && (b.bounds = { x: h.x, y: h.y, width: h.width, height: h.height });
    },
    /** A click on a check box or radio button (`id`): the `click` event, then, unless the source prevented it, the
     * box ticked as a browser ticks it (a radio button only on), with `input` and `change` events. */
    toggle(R) {
      const h = A(R);
      if (!h || h.props.disabled || !U.dispatch(R, "click", { button: 0, detail: 1 })) return;
      const b = h.props.type === "radio";
      b && h.checked || (h.checked = b ? !0 : !h.checked, U.dispatch(R, "input", {}), U.dispatch(R, "change", {}), h.props.checked !== void 0 && delete h.ticked, h.touch(), S());
    },
    /** A left click as the engine reports one: press then release on the same node. */
    click(R, h = {}) {
      const b = { button: 0, buttons: 1, pointerType: "mouse", ...h };
      for (const x of ["pointerdown", "mousedown", "pointerup", "mouseup", "click"]) U.dispatch(R, x, b);
    },
    /** The pointer entered (`on`) or left node `id` (one the description marks `track_hover`): its `:hover` state,
     * which a descendant's group variant reads. The element's own `hover:` styles are the engine's hover style. */
    /** Whether the pointer is over node `id`, as `hover` last said. */
    hovered: (R) => !!A(R)?.state.hover,
    hover(R, h) {
      const b = A(R);
      !b || b.state.hover === h || (b.state.hover = h, b.touch(), S());
    },
    focus(R) {
      const h = A(R);
      h && (L(() => {
        const b = o.activeElement;
        b && b !== h && b !== o.body && U.dispatch(b, "blur"), o.focus(h), U.dispatch(h, "focus");
      }), S());
    },
    /** A press at node `id` that nothing prevented: the browser's default focuses the element pressed. Only an element
     * that listens for keys (`onKeyDown`) is focused, so a press elsewhere leaves the keyboard where it was; the focus
     * is not `:focus-visible`, as after a pointer press in a browser. */
    // ponytail: a browser focuses every focusable element pressed; here only one with its own key handler, so a
    // screen's ordinary buttons do not take the keyboard from a terminal.
    pressFocus(R) {
      let b = typeof R == "string" ? A(R) : R;
      for (; b && !(b instanceof Vt && typeof b.props.onKeyDown == "function" && Og(b)); ) b = b.parentNode;
      !b || b === o.activeElement || (U.focus(b.id), b.state.pointerFocus = !0, b.touch(), S());
    },
    /** The engine is drawing the latest description: the boxes measured in this frame's layout are the tree's.
     * Returns whether effects wait for that layout (`measured`); run them with `retry` once the frame is drawn. */
    drawing() {
      return N = z, o.retries.length > 0;
    },
    /** Runs the effects that waited for a fresh layout. */
    retry() {
      const R = o.retries.splice(0);
      for (const h of R) h();
    },
    /** Runs effects React has scheduled (the engine calls it after a frame). */
    flush: k,
    update(R) {
      ze.updateContainerSync(dt.createElement(l, R ?? {}), H, null, null), ze.flushSyncWork(), k();
    },
    unmount() {
      ze.updateContainerSync(null, H, null, null), ze.flushSyncWork(), ze.flushPassiveEffects(), o.afterCommit = null, o.retries.length = 0, n.forgetBounds?.(v);
    }
  };
  return U;
}
//! `react-dom` for a screen on the native renderer: `createPortal` (into `document.body`, the overlay layer) and
//! `flushSync`. Nothing of the browser renderer.
const Yf = (n) => ze.flushSyncFromReconciler(n), Yg = { createPortal: ti, flushSync: Yf }, xy = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  createPortal: ti,
  default: Yg,
  flushSync: Yf
}, Symbol.toStringTag, { value: "Module" }));
function Gf(n) {
  var l, i, o = "";
  if (typeof n == "string" || typeof n == "number") o += n;
  else if (typeof n == "object") if (Array.isArray(n)) {
    var s = n.length;
    for (l = 0; l < s; l++) n[l] && (i = Gf(n[l])) && (o && (o += " "), o += i);
  } else for (i in n) n[i] && (o && (o += " "), o += i);
  return o;
}
function Kf() {
  for (var n, l, i = 0, o = "", s = arguments.length; i < s; i++) (n = arguments[i]) && (l = Gf(n)) && (o && (o += " "), o += l);
  return o;
}
const Gg = (n, l) => {
  const i = new Array(n.length + l.length);
  for (let o = 0; o < n.length; o++)
    i[o] = n[o];
  for (let o = 0; o < l.length; o++)
    i[n.length + o] = l[o];
  return i;
}, Kg = (n, l) => ({
  classGroupId: n,
  validator: l
}), Qf = (n = /* @__PURE__ */ new Map(), l = null, i) => ({
  nextPart: n,
  validators: l,
  classGroupId: i
}), Jr = "-", tf = [], Qg = "arbitrary..", Vg = (n) => {
  const l = Xg(n), {
    conflictingClassGroups: i,
    conflictingClassGroupModifiers: o
  } = n;
  return {
    getClassGroupId: (m) => {
      if (m.startsWith("[") && m.endsWith("]"))
        return Lg(m);
      const f = m.split(Jr), p = f[0] === "" && f.length > 1 ? 1 : 0;
      return Vf(f, p, l);
    },
    getConflictingClassGroupIds: (m, f) => {
      if (f) {
        const p = o[m], y = i[m];
        return p ? y ? Gg(y, p) : p : y || tf;
      }
      return i[m] || tf;
    }
  };
}, Vf = (n, l, i) => {
  if (n.length - l === 0)
    return i.classGroupId;
  const s = n[l], d = i.nextPart.get(s);
  if (d) {
    const y = Vf(n, l + 1, d);
    if (y) return y;
  }
  const m = i.validators;
  if (m === null)
    return;
  const f = l === 0 ? n.join(Jr) : n.slice(l).join(Jr), p = m.length;
  for (let y = 0; y < p; y++) {
    const E = m[y];
    if (E.validator(f))
      return E.classGroupId;
  }
}, Lg = (n) => n.slice(1, -1).indexOf(":") === -1 ? void 0 : (() => {
  const l = n.slice(1, -1), i = l.indexOf(":"), o = l.slice(0, i);
  return o ? Qg + o : void 0;
})(), Xg = (n) => {
  const {
    theme: l,
    classGroups: i
  } = n;
  return Zg(i, l);
}, Zg = (n, l) => {
  const i = Qf();
  for (const o in n) {
    const s = n[o];
    Es(s, i, o, l);
  }
  return i;
}, Es = (n, l, i, o) => {
  const s = n.length;
  for (let d = 0; d < s; d++) {
    const m = n[d];
    Jg(m, l, i, o);
  }
}, Jg = (n, l, i, o) => {
  if (typeof n == "string") {
    Wg(n, l, i);
    return;
  }
  if (typeof n == "function") {
    Fg(n, l, i, o);
    return;
  }
  Ig(n, l, i, o);
}, Wg = (n, l, i) => {
  const o = n === "" ? l : Lf(l, n);
  o.classGroupId = i;
}, Fg = (n, l, i, o) => {
  if ($g(n)) {
    Es(n(o), l, i, o);
    return;
  }
  l.validators === null && (l.validators = []), l.validators.push(Kg(i, n));
}, Ig = (n, l, i, o) => {
  const s = Object.entries(n), d = s.length;
  for (let m = 0; m < d; m++) {
    const [f, p] = s[m];
    Es(p, Lf(l, f), i, o);
  }
}, Lf = (n, l) => {
  let i = n;
  const o = l.split(Jr), s = o.length;
  for (let d = 0; d < s; d++) {
    const m = o[d];
    let f = i.nextPart.get(m);
    f || (f = Qf(), i.nextPart.set(m, f)), i = f;
  }
  return i;
}, $g = (n) => "isThemeGetter" in n && n.isThemeGetter === !0, Pg = (n) => {
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
}, us = "!", ef = ":", tb = [], nf = (n, l, i, o, s) => ({
  modifiers: n,
  hasImportantModifier: l,
  baseClassName: i,
  maybePostfixModifierPosition: o,
  isExternal: s
}), eb = (n) => {
  const {
    prefix: l,
    experimentalParseClassName: i
  } = n;
  let o = (s) => {
    const d = [];
    let m = 0, f = 0, p = 0, y;
    const E = s.length;
    for (let S = 0; S < E; S++) {
      const k = s[S];
      if (m === 0 && f === 0) {
        if (k === ef) {
          d.push(s.slice(p, S)), p = S + 1;
          continue;
        }
        if (k === "/") {
          y = S;
          continue;
        }
      }
      k === "[" ? m++ : k === "]" ? m-- : k === "(" ? f++ : k === ")" && f--;
    }
    const w = d.length === 0 ? s : s.slice(p);
    let v = w, z = !1;
    w.endsWith(us) ? (v = w.slice(0, -1), z = !0) : (
      /**
       * In Tailwind CSS v3 the important modifier was at the start of the base class name. This is still supported for legacy reasons.
       * @see https://github.com/dcastil/tailwind-merge/issues/513#issuecomment-2614029864
       */
      w.startsWith(us) && (v = w.slice(1), z = !0)
    );
    const N = y && y > p ? y - p : void 0;
    return nf(d, z, v, N);
  };
  if (l) {
    const s = l + ef, d = o;
    o = (m) => m.startsWith(s) ? d(m.slice(s.length)) : nf(tb, !1, m, void 0, !0);
  }
  if (i) {
    const s = o;
    o = (d) => i({
      className: d,
      parseClassName: s
    });
  }
  return o;
}, nb = (n) => {
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
}, ab = (n) => ({
  cache: Pg(n.cacheSize),
  parseClassName: eb(n),
  sortModifiers: nb(n),
  postfixLookupClassGroupIds: lb(n),
  ...Vg(n)
}), lb = (n) => {
  const l = /* @__PURE__ */ Object.create(null), i = n.postfixLookupClassGroups;
  if (i)
    for (let o = 0; o < i.length; o++)
      l[i[o]] = !0;
  return l;
}, rb = /\s+/, ib = (n, l) => {
  const {
    parseClassName: i,
    getClassGroupId: o,
    getConflictingClassGroupIds: s,
    sortModifiers: d,
    postfixLookupClassGroupIds: m
  } = l, f = [], p = n.trim().split(rb);
  let y = "";
  for (let E = p.length - 1; E >= 0; E -= 1) {
    const w = p[E], {
      isExternal: v,
      modifiers: z,
      hasImportantModifier: N,
      baseClassName: S,
      maybePostfixModifierPosition: k
    } = i(w);
    if (v) {
      y = w + (y.length > 0 ? " " + y : y);
      continue;
    }
    let j = !!k, H;
    if (j) {
      const h = S.substring(0, k);
      H = o(h);
      const b = H && m[H] ? o(S) : void 0;
      b && b !== H && (H = b, j = !1);
    } else
      H = o(S);
    if (!H) {
      if (!j) {
        y = w + (y.length > 0 ? " " + y : y);
        continue;
      }
      if (H = o(S), !H) {
        y = w + (y.length > 0 ? " " + y : y);
        continue;
      }
      j = !1;
    }
    const A = z.length === 0 ? "" : z.length === 1 ? z[0] : d(z).join(":"), L = N ? A + us : A, U = L + H;
    if (f.indexOf(U) > -1)
      continue;
    f.push(U);
    const R = s(H, j);
    for (let h = 0; h < R.length; ++h) {
      const b = R[h];
      f.push(L + b);
    }
    y = w + (y.length > 0 ? " " + y : y);
  }
  return y;
}, ob = (...n) => {
  let l = 0, i, o, s = "";
  for (; l < n.length; )
    (i = n[l++]) && (o = Xf(i)) && (s && (s += " "), s += o);
  return s;
}, Xf = (n) => {
  if (typeof n == "string")
    return n;
  let l, i = "";
  for (let o = 0; o < n.length; o++)
    n[o] && (l = Xf(n[o])) && (i && (i += " "), i += l);
  return i;
}, sb = (n, ...l) => {
  let i, o, s, d;
  const m = (p) => {
    const y = l.reduce((E, w) => w(E), n());
    return i = ab(y), o = i.cache.get, s = i.cache.set, d = f, f(p);
  }, f = (p) => {
    const y = o(p);
    if (y)
      return y;
    const E = ib(p, i);
    return s(p, E), E;
  };
  return d = m, (...p) => d(ob(...p));
}, cb = [], Zt = (n) => {
  const l = (i) => i[n] || cb;
  return l.isThemeGetter = !0, l.themeKey = n, l;
}, Zf = /^\[(?:(\w[\w-]*):)?(.+)\]$/i, Jf = /^\((?:(\w[\w-]*):)?(.+)\)$/i, ub = /^\d+(?:\.\d+)?\/\d+(?:\.\d+)?$/, db = /^(\d+(\.\d+)?)?(xs|sm|md|lg|xl)$/, fb = /\d+(%|px|r?em|[sdl]?v([hwib]|min|max)|pt|pc|in|cm|mm|cap|ch|ex|r?lh|cq(w|h|i|b|min|max))|\b(calc|min|max|clamp)\(.+\)|^0$/, mb = /^(rgba?|hsla?|hwb|(ok)?(lab|lch)|color-mix|color|light-dark)\(.+\)$/, pb = /^(inset_)?-?((\d+)?\.?(\d+)[a-z]+|0)_-?((\d+)?\.?(\d+)[a-z]+|0)/, hb = /^(url|image|image-set|cross-fade|element|(repeating-)?(linear|radial|conic)-gradient)\(.+\)$/, Rn = (n) => ub.test(n), vt = (n) => !!n && !Number.isNaN(Number(n)), Je = (n) => !!n && Number.isInteger(Number(n)), Jo = (n) => n.endsWith("%") && vt(n.slice(0, -1)), mn = (n) => db.test(n), Wf = () => !0, gb = (n) => (
  // `colorFunctionRegex` check is necessary because color functions can have percentages in them which which would be incorrectly classified as lengths.
  // For example, `hsl(0 0% 0%)` would be classified as a length without this check.
  // I could also use lookbehind assertion in `lengthUnitRegex` but that isn't supported widely enough.
  fb.test(n) && !mb.test(n)
), zs = () => !1, bb = (n) => pb.test(n), vb = (n) => hb.test(n), yb = (n) => !at(n) && !lt(n), xb = (n) => n.startsWith("@container") && (n[10] === "/" && n[11] !== void 0 || n[11] === "s" && n[16] !== void 0 && n.startsWith("-size/", 10) || n[11] === "n" && n[18] !== void 0 && n.startsWith("-normal/", 10)), wb = (n) => Gn(n, $f, zs), at = (n) => Zf.test(n), oa = (n) => Gn(n, Pf, gb), af = (n) => Gn(n, Cb, vt), _b = (n) => Gn(n, em, Wf), Sb = (n) => Gn(n, tm, zs), lf = (n) => Gn(n, Ff, zs), kb = (n) => Gn(n, If, vb), jr = (n) => Gn(n, nm, bb), lt = (n) => Jf.test(n), yl = (n) => ua(n, Pf), Eb = (n) => ua(n, tm), rf = (n) => ua(n, Ff), zb = (n) => ua(n, $f), Nb = (n) => ua(n, If), Or = (n) => ua(n, nm, !0), Tb = (n) => ua(n, em, !0), Gn = (n, l, i) => {
  const o = Zf.exec(n);
  return o ? o[1] ? l(o[1]) : i(o[2]) : !1;
}, ua = (n, l, i = !1) => {
  const o = Jf.exec(n);
  return o ? o[1] ? l(o[1]) : i : !1;
}, Ff = (n) => n === "position" || n === "percentage", If = (n) => n === "image" || n === "url", $f = (n) => n === "length" || n === "size" || n === "bg-size", Pf = (n) => n === "length", Cb = (n) => n === "number", tm = (n) => n === "family-name", em = (n) => n === "number" || n === "weight", nm = (n) => n === "shadow", Mb = () => {
  const n = Zt("color"), l = Zt("font"), i = Zt("text"), o = Zt("font-weight"), s = Zt("tracking"), d = Zt("leading"), m = Zt("breakpoint"), f = Zt("container"), p = Zt("spacing"), y = Zt("radius"), E = Zt("shadow"), w = Zt("inset-shadow"), v = Zt("text-shadow"), z = Zt("drop-shadow"), N = Zt("blur"), S = Zt("perspective"), k = Zt("aspect"), j = Zt("ease"), H = Zt("animate"), A = () => ["auto", "avoid", "all", "avoid-page", "page", "left", "right", "column"], L = () => [
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
  ], U = () => [...L(), lt, at], R = () => ["auto", "hidden", "clip", "visible", "scroll"], h = () => ["auto", "contain", "none"], b = () => [lt, at, p], x = () => [Rn, "full", "auto", ...b()], _ = () => [Je, "none", "subgrid", lt, at], T = () => ["auto", {
    span: ["full", Je, lt, at]
  }, Je, lt, at], D = () => [Je, "auto", lt, at], G = () => ["auto", "min", "max", "fr", lt, at], I = () => ["start", "end", "center", "between", "around", "evenly", "stretch", "baseline", "center-safe", "end-safe"], tt = () => ["start", "end", "center", "stretch", "center-safe", "end-safe"], Q = () => ["auto", ...b()], Z = () => [Rn, "auto", "full", "dvw", "dvh", "lvw", "lvh", "svw", "svh", "min", "max", "fit", ...b()], $ = () => [f, Rn, "screen", "full", "dvw", "lvw", "svw", "min", "max", "fit", ...b()], K = () => [Rn, "screen", "full", "lh", "dvh", "lvh", "svh", "min", "max", "fit", ...b()], V = () => [n, lt, at], C = () => [...L(), rf, lf, {
    position: [lt, at]
  }], X = () => ["no-repeat", {
    repeat: ["", "x", "y", "space", "round"]
  }], et = () => ["auto", "cover", "contain", zb, wb, {
    size: [lt, at]
  }], it = () => [Jo, yl, oa], ot = () => [
    // Deprecated since Tailwind CSS v4.0.0
    "",
    "none",
    "full",
    y,
    lt,
    at
  ], st = () => ["", vt, yl, oa], kt = () => ["solid", "dashed", "dotted", "double"], Jt = () => ["normal", "multiply", "screen", "overlay", "darken", "lighten", "color-dodge", "color-burn", "hard-light", "soft-light", "difference", "exclusion", "hue", "saturation", "color", "luminosity"], ht = () => [vt, Jo, rf, lf], Kn = () => [
    // Deprecated since Tailwind CSS v4.0.0
    "",
    "none",
    N,
    lt,
    at
  ], Qn = () => ["none", vt, lt, at], Re = () => ["none", vt, lt, at], De = () => [vt, lt, at], hn = () => [Rn, "full", ...b()];
  return {
    cacheSize: 500,
    theme: {
      animate: ["spin", "ping", "pulse", "bounce"],
      aspect: ["video"],
      blur: [mn],
      breakpoint: [mn],
      color: [Wf],
      container: [mn],
      "drop-shadow": [mn],
      ease: ["in", "out", "in-out"],
      font: [yb],
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
        aspect: ["auto", "square", Rn, at, lt, k]
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
        "@container": ["", "normal", "size", lt, at]
      }],
      /**
       * Container Name
       * @see https://tailwindcss.com/docs/responsive-design#named-containers
       */
      "container-named": [xb],
      /**
       * Columns
       * @see https://tailwindcss.com/docs/columns
       */
      columns: [{
        columns: [vt, "auto", at, lt, f]
      }],
      /**
       * Break After
       * @see https://tailwindcss.com/docs/break-after
       */
      "break-after": [{
        "break-after": A()
      }],
      /**
       * Break Before
       * @see https://tailwindcss.com/docs/break-before
       */
      "break-before": [{
        "break-before": A()
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
        z: [Je, "auto", lt, at]
      }],
      // ------------------------
      // --- Flexbox and Grid ---
      // ------------------------
      /**
       * Flex Basis
       * @see https://tailwindcss.com/docs/flex-basis
       */
      basis: [{
        basis: [Rn, "full", "auto", f, ...b()]
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
        flex: [vt, Rn, "auto", "initial", "none", at]
      }],
      /**
       * Flex Grow
       * @see https://tailwindcss.com/docs/flex-grow
       */
      grow: [{
        grow: ["", vt, lt, at]
      }],
      /**
       * Flex Shrink
       * @see https://tailwindcss.com/docs/flex-shrink
       */
      shrink: [{
        shrink: ["", vt, lt, at]
      }],
      /**
       * Order
       * @see https://tailwindcss.com/docs/order
       */
      order: [{
        order: [Je, "first", "last", "none", lt, at]
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
        col: T()
      }],
      /**
       * Grid Column Start
       * @see https://tailwindcss.com/docs/grid-column
       */
      "col-start": [{
        "col-start": D()
      }],
      /**
       * Grid Column End
       * @see https://tailwindcss.com/docs/grid-column
       */
      "col-end": [{
        "col-end": D()
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
        row: T()
      }],
      /**
       * Grid Row Start
       * @see https://tailwindcss.com/docs/grid-row
       */
      "row-start": [{
        "row-start": D()
      }],
      /**
       * Grid Row End
       * @see https://tailwindcss.com/docs/grid-row
       */
      "row-end": [{
        "row-end": D()
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
        "auto-cols": G()
      }],
      /**
       * Grid Auto Rows
       * @see https://tailwindcss.com/docs/grid-auto-rows
       */
      "auto-rows": [{
        "auto-rows": G()
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
        justify: [...I(), "normal"]
      }],
      /**
       * Justify Items
       * @see https://tailwindcss.com/docs/justify-items
       */
      "justify-items": [{
        "justify-items": [...tt(), "normal"]
      }],
      /**
       * Justify Self
       * @see https://tailwindcss.com/docs/justify-self
       */
      "justify-self": [{
        "justify-self": ["auto", ...tt()]
      }],
      /**
       * Align Content
       * @see https://tailwindcss.com/docs/align-content
       */
      "align-content": [{
        content: ["normal", ...I()]
      }],
      /**
       * Align Items
       * @see https://tailwindcss.com/docs/align-items
       */
      "align-items": [{
        items: [...tt(), {
          baseline: ["", "last"]
        }]
      }],
      /**
       * Align Self
       * @see https://tailwindcss.com/docs/align-self
       */
      "align-self": [{
        self: ["auto", ...tt(), {
          baseline: ["", "last"]
        }]
      }],
      /**
       * Place Content
       * @see https://tailwindcss.com/docs/place-content
       */
      "place-content": [{
        "place-content": I()
      }],
      /**
       * Place Items
       * @see https://tailwindcss.com/docs/place-items
       */
      "place-items": [{
        "place-items": [...tt(), "baseline"]
      }],
      /**
       * Place Self
       * @see https://tailwindcss.com/docs/place-self
       */
      "place-self": [{
        "place-self": ["auto", ...tt()]
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
        size: Z()
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
        block: ["auto", ...K()]
      }],
      /**
       * Min-Block Size
       * @see https://tailwindcss.com/docs/min-block-size
       */
      "min-block-size": [{
        "min-block": ["auto", ...K()]
      }],
      /**
       * Max-Block Size
       * @see https://tailwindcss.com/docs/max-block-size
       */
      "max-block-size": [{
        "max-block": ["none", ...K()]
      }],
      /**
       * Width
       * @see https://tailwindcss.com/docs/width
       */
      w: [{
        w: [f, "screen", ...Z()]
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
          ...Z()
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
          ...Z()
        ]
      }],
      /**
       * Height
       * @see https://tailwindcss.com/docs/height
       */
      h: [{
        h: ["screen", "lh", ...Z()]
      }],
      /**
       * Min-Height
       * @see https://tailwindcss.com/docs/min-height
       */
      "min-h": [{
        "min-h": ["screen", "lh", "none", ...Z()]
      }],
      /**
       * Max-Height
       * @see https://tailwindcss.com/docs/max-height
       */
      "max-h": [{
        "max-h": ["screen", "lh", "none", ...Z()]
      }],
      // ------------------
      // --- Typography ---
      // ------------------
      /**
       * Font Size
       * @see https://tailwindcss.com/docs/font-size
       */
      "font-size": [{
        text: ["base", i, yl, oa]
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
        font: [o, Tb, _b]
      }],
      /**
       * Font Stretch
       * @see https://tailwindcss.com/docs/font-stretch
       */
      "font-stretch": [{
        "font-stretch": ["ultra-condensed", "extra-condensed", "condensed", "semi-condensed", "normal", "semi-expanded", "expanded", "extra-expanded", "ultra-expanded", Jo, at]
      }],
      /**
       * Font Family
       * @see https://tailwindcss.com/docs/font-family
       */
      "font-family": [{
        font: [Eb, Sb, l]
      }],
      /**
       * Font Feature Settings
       * @see https://tailwindcss.com/docs/font-feature-settings
       */
      "font-features": [{
        "font-features": [at]
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
        tracking: [s, lt, at]
      }],
      /**
       * Line Clamp
       * @see https://tailwindcss.com/docs/line-clamp
       */
      "line-clamp": [{
        "line-clamp": [vt, "none", lt, af]
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
        "list-image": ["none", lt, at]
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
        list: ["disc", "decimal", "none", lt, at]
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
        decoration: [...kt(), "wavy"]
      }],
      /**
       * Text Decoration Thickness
       * @see https://tailwindcss.com/docs/text-decoration-thickness
       */
      "text-decoration-thickness": [{
        decoration: [vt, "from-font", "auto", lt, oa]
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
        "underline-offset": [vt, "auto", lt, at]
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
        tab: [Je, lt, at]
      }],
      /**
       * Vertical Alignment
       * @see https://tailwindcss.com/docs/vertical-align
       */
      "vertical-align": [{
        align: ["baseline", "top", "middle", "bottom", "text-top", "text-bottom", "sub", "super", lt, at]
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
        content: ["none", lt, at]
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
        bg: X()
      }],
      /**
       * Background Size
       * @see https://tailwindcss.com/docs/background-size
       */
      "bg-size": [{
        bg: et()
      }],
      /**
       * Background Image
       * @see https://tailwindcss.com/docs/background-image
       */
      "bg-image": [{
        bg: ["none", {
          linear: [{
            to: ["t", "tr", "r", "br", "b", "bl", "l", "tl"]
          }, Je, lt, at],
          radial: ["", lt, at],
          conic: ["", Je, lt, at]
        }, Nb, kb]
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
        from: it()
      }],
      /**
       * Gradient Color Stops Via Position
       * @see https://tailwindcss.com/docs/gradient-color-stops
       */
      "gradient-via-pos": [{
        via: it()
      }],
      /**
       * Gradient Color Stops To Position
       * @see https://tailwindcss.com/docs/gradient-color-stops
       */
      "gradient-to-pos": [{
        to: it()
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
        rounded: ot()
      }],
      /**
       * Border Radius Start
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-s": [{
        "rounded-s": ot()
      }],
      /**
       * Border Radius End
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-e": [{
        "rounded-e": ot()
      }],
      /**
       * Border Radius Top
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-t": [{
        "rounded-t": ot()
      }],
      /**
       * Border Radius Right
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-r": [{
        "rounded-r": ot()
      }],
      /**
       * Border Radius Bottom
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-b": [{
        "rounded-b": ot()
      }],
      /**
       * Border Radius Left
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-l": [{
        "rounded-l": ot()
      }],
      /**
       * Border Radius Start Start
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-ss": [{
        "rounded-ss": ot()
      }],
      /**
       * Border Radius Start End
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-se": [{
        "rounded-se": ot()
      }],
      /**
       * Border Radius End End
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-ee": [{
        "rounded-ee": ot()
      }],
      /**
       * Border Radius End Start
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-es": [{
        "rounded-es": ot()
      }],
      /**
       * Border Radius Top Left
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-tl": [{
        "rounded-tl": ot()
      }],
      /**
       * Border Radius Top Right
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-tr": [{
        "rounded-tr": ot()
      }],
      /**
       * Border Radius Bottom Right
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-br": [{
        "rounded-br": ot()
      }],
      /**
       * Border Radius Bottom Left
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-bl": [{
        "rounded-bl": ot()
      }],
      /**
       * Border Width
       * @see https://tailwindcss.com/docs/border-width
       */
      "border-w": [{
        border: st()
      }],
      /**
       * Border Width Inline
       * @see https://tailwindcss.com/docs/border-width
       */
      "border-w-x": [{
        "border-x": st()
      }],
      /**
       * Border Width Block
       * @see https://tailwindcss.com/docs/border-width
       */
      "border-w-y": [{
        "border-y": st()
      }],
      /**
       * Border Width Inline Start
       * @see https://tailwindcss.com/docs/border-width
       */
      "border-w-s": [{
        "border-s": st()
      }],
      /**
       * Border Width Inline End
       * @see https://tailwindcss.com/docs/border-width
       */
      "border-w-e": [{
        "border-e": st()
      }],
      /**
       * Border Width Block Start
       * @see https://tailwindcss.com/docs/border-width
       */
      "border-w-bs": [{
        "border-bs": st()
      }],
      /**
       * Border Width Block End
       * @see https://tailwindcss.com/docs/border-width
       */
      "border-w-be": [{
        "border-be": st()
      }],
      /**
       * Border Width Top
       * @see https://tailwindcss.com/docs/border-width
       */
      "border-w-t": [{
        "border-t": st()
      }],
      /**
       * Border Width Right
       * @see https://tailwindcss.com/docs/border-width
       */
      "border-w-r": [{
        "border-r": st()
      }],
      /**
       * Border Width Bottom
       * @see https://tailwindcss.com/docs/border-width
       */
      "border-w-b": [{
        "border-b": st()
      }],
      /**
       * Border Width Left
       * @see https://tailwindcss.com/docs/border-width
       */
      "border-w-l": [{
        "border-l": st()
      }],
      /**
       * Divide Width X
       * @see https://tailwindcss.com/docs/border-width#between-children
       */
      "divide-x": [{
        "divide-x": st()
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
        "divide-y": st()
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
        border: [...kt(), "hidden", "none"]
      }],
      /**
       * Divide Style
       * @see https://tailwindcss.com/docs/border-style#setting-the-divider-style
       */
      "divide-style": [{
        divide: [...kt(), "hidden", "none"]
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
        outline: [...kt(), "none", "hidden"]
      }],
      /**
       * Outline Offset
       * @see https://tailwindcss.com/docs/outline-offset
       */
      "outline-offset": [{
        "outline-offset": [vt, lt, at]
      }],
      /**
       * Outline Width
       * @see https://tailwindcss.com/docs/outline-width
       */
      "outline-w": [{
        outline: ["", vt, yl, oa]
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
          E,
          Or,
          jr
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
        "inset-shadow": ["none", w, Or, jr]
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
        ring: st()
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
        "inset-ring": st()
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
        "text-shadow": ["none", v, Or, jr]
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
        opacity: [vt, lt, at]
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
        "mask-radial": [lt, at]
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
        "mask-radial-at": L()
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
        mask: C()
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
        mask: et()
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
        mask: ["none", lt, at]
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
          lt,
          at
        ]
      }],
      /**
       * Blur
       * @see https://tailwindcss.com/docs/blur
       */
      blur: [{
        blur: Kn()
      }],
      /**
       * Brightness
       * @see https://tailwindcss.com/docs/brightness
       */
      brightness: [{
        brightness: [vt, lt, at]
      }],
      /**
       * Contrast
       * @see https://tailwindcss.com/docs/contrast
       */
      contrast: [{
        contrast: [vt, lt, at]
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
          z,
          Or,
          jr
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
        grayscale: ["", vt, lt, at]
      }],
      /**
       * Hue Rotate
       * @see https://tailwindcss.com/docs/hue-rotate
       */
      "hue-rotate": [{
        "hue-rotate": [vt, lt, at]
      }],
      /**
       * Invert
       * @see https://tailwindcss.com/docs/invert
       */
      invert: [{
        invert: ["", vt, lt, at]
      }],
      /**
       * Saturate
       * @see https://tailwindcss.com/docs/saturate
       */
      saturate: [{
        saturate: [vt, lt, at]
      }],
      /**
       * Sepia
       * @see https://tailwindcss.com/docs/sepia
       */
      sepia: [{
        sepia: ["", vt, lt, at]
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
          lt,
          at
        ]
      }],
      /**
       * Backdrop Blur
       * @see https://tailwindcss.com/docs/backdrop-blur
       */
      "backdrop-blur": [{
        "backdrop-blur": Kn()
      }],
      /**
       * Backdrop Brightness
       * @see https://tailwindcss.com/docs/backdrop-brightness
       */
      "backdrop-brightness": [{
        "backdrop-brightness": [vt, lt, at]
      }],
      /**
       * Backdrop Contrast
       * @see https://tailwindcss.com/docs/backdrop-contrast
       */
      "backdrop-contrast": [{
        "backdrop-contrast": [vt, lt, at]
      }],
      /**
       * Backdrop Grayscale
       * @see https://tailwindcss.com/docs/backdrop-grayscale
       */
      "backdrop-grayscale": [{
        "backdrop-grayscale": ["", vt, lt, at]
      }],
      /**
       * Backdrop Hue Rotate
       * @see https://tailwindcss.com/docs/backdrop-hue-rotate
       */
      "backdrop-hue-rotate": [{
        "backdrop-hue-rotate": [vt, lt, at]
      }],
      /**
       * Backdrop Invert
       * @see https://tailwindcss.com/docs/backdrop-invert
       */
      "backdrop-invert": [{
        "backdrop-invert": ["", vt, lt, at]
      }],
      /**
       * Backdrop Opacity
       * @see https://tailwindcss.com/docs/backdrop-opacity
       */
      "backdrop-opacity": [{
        "backdrop-opacity": [vt, lt, at]
      }],
      /**
       * Backdrop Saturate
       * @see https://tailwindcss.com/docs/backdrop-saturate
       */
      "backdrop-saturate": [{
        "backdrop-saturate": [vt, lt, at]
      }],
      /**
       * Backdrop Sepia
       * @see https://tailwindcss.com/docs/backdrop-sepia
       */
      "backdrop-sepia": [{
        "backdrop-sepia": ["", vt, lt, at]
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
        transition: ["", "all", "colors", "opacity", "shadow", "transform", "none", lt, at]
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
        duration: [vt, "initial", lt, at]
      }],
      /**
       * Transition Timing Function
       * @see https://tailwindcss.com/docs/transition-timing-function
       */
      ease: [{
        ease: ["linear", "initial", j, lt, at]
      }],
      /**
       * Transition Delay
       * @see https://tailwindcss.com/docs/transition-delay
       */
      delay: [{
        delay: [vt, lt, at]
      }],
      /**
       * Animation
       * @see https://tailwindcss.com/docs/animation
       */
      animate: [{
        animate: ["none", H, lt, at]
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
        perspective: [S, lt, at]
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
        scale: Re()
      }],
      /**
       * Scale X
       * @see https://tailwindcss.com/docs/scale
       */
      "scale-x": [{
        "scale-x": Re()
      }],
      /**
       * Scale Y
       * @see https://tailwindcss.com/docs/scale
       */
      "scale-y": [{
        "scale-y": Re()
      }],
      /**
       * Scale Z
       * @see https://tailwindcss.com/docs/scale
       */
      "scale-z": [{
        "scale-z": Re()
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
        skew: De()
      }],
      /**
       * Skew X
       * @see https://tailwindcss.com/docs/skew
       */
      "skew-x": [{
        "skew-x": De()
      }],
      /**
       * Skew Y
       * @see https://tailwindcss.com/docs/skew
       */
      "skew-y": [{
        "skew-y": De()
      }],
      /**
       * Transform
       * @see https://tailwindcss.com/docs/transform
       */
      transform: [{
        transform: [lt, at, "", "none", "gpu", "cpu"]
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
        zoom: [Je, lt, at]
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
        cursor: ["auto", "default", "pointer", "wait", "text", "move", "help", "not-allowed", "none", "context-menu", "progress", "cell", "crosshair", "vertical-text", "alias", "copy", "no-drop", "grab", "grabbing", "all-scroll", "col-resize", "row-resize", "n-resize", "e-resize", "s-resize", "w-resize", "ne-resize", "nw-resize", "se-resize", "sw-resize", "ew-resize", "ns-resize", "nesw-resize", "nwse-resize", "zoom-in", "zoom-out", lt, at]
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
        "will-change": ["auto", "scroll", "contents", "transform", lt, at]
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
        stroke: [vt, yl, oa, af]
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
}, Ab = /* @__PURE__ */ sb(Mb);
function ue(...n) {
  return Ab(Kf(n));
}
function jb(n, l, i) {
  return n.filter((o, s) => s !== l && (o.start + o.end) / 2 < i).length;
}
function Ob(n, l, i, o) {
  const s = n.map(() => 0), d = n[l];
  if (!d) return s;
  const m = n[l + 1], f = n[l - 1], p = d.end - d.start + (m ? m.start - d.end : f ? d.start - f.end : 0);
  return n.forEach((y, E) => {
    l < i && E > l && E <= i ? s[E] = -p : i < l && E >= i && E < l && (s[E] = p);
  }), s[l] = Math.min(Math.max(o, n[0].start - d.start), n[n.length - 1].end - d.end), s;
}
const of = ["transform", "transition", "zIndex", "filter", "pointerEvents", "position"];
function Rb(n, l) {
  for (let i = n.parentElement; i; i = i.parentElement) {
    const o = getComputedStyle(i)[l === "x" ? "overflowX" : "overflowY"];
    if ((o === "auto" || o === "scroll") && (l === "x" ? i.scrollWidth > i.clientWidth : i.scrollHeight > i.clientHeight)) return i;
  }
  return null;
}
function Db(n, l, i, o) {
  const s = n[l] ? Rb(n[l], i) : null, d = () => s ? i === "x" ? s.scrollLeft : s.scrollTop : 0, m = (k) => (i === "x" ? k.clientX : k.clientY) + d(), f = m(o), p = d(), y = n.map((k) => {
    const j = k.getBoundingClientRect();
    return i === "x" ? { start: j.left + p, end: j.right + p } : { start: j.top + p, end: j.bottom + p };
  }), E = n.map((k) => of.map((j) => k.style[j])), w = typeof matchMedia == "function" && matchMedia("(prefers-reduced-motion: reduce)").matches, v = i === "x" ? "translateX" : "translateY";
  let z = !1;
  const N = { to: l };
  n.forEach((k, j) => {
    if (k.style.pointerEvents = "none", j !== l) {
      w || (k.style.transition = "transform 160ms cubic-bezier(0.2, 0.8, 0.2, 1)");
      return;
    }
    getComputedStyle(k).position === "static" && (k.style.position = "relative"), k.style.zIndex = "30", k.style.filter = "drop-shadow(0 6px 10px rgba(0, 0, 0, 0.45))";
  });
  const S = (k, j) => {
    N.to = k, Ob(y, l, k, j).forEach((H, A) => {
      n[A].style.transform = H ? `${v}(${H}px)` : "";
    });
  };
  return {
    from: l,
    get to() {
      return N.to;
    },
    slot: (k) => jb(y, l, m(k)),
    apply: (k, j) => {
      z || S(k, m(j) - f);
    },
    rest: () => {
      z || S(l, 0);
    },
    end: () => {
      z || (z = !0, n.forEach((k, j) => of.forEach((H, A) => {
        k.style[H] = E[j][A];
      })));
    }
  };
}
const Hb = 5;
let Wo = !1;
function Bb(n, l) {
  if (n.button !== 0 || Wo) return;
  const i = { clientX: n.clientX, clientY: n.clientY }, o = n.currentTarget, s = n.pointerId;
  let d = null, m, f = !1;
  const p = { cursor: document.body.style.cursor, userSelect: document.body.style.userSelect }, y = (N) => {
    if (f) return;
    f = !0, window.removeEventListener("pointermove", E), window.removeEventListener("pointerup", w), window.removeEventListener("pointercancel", v), window.removeEventListener("keydown", z, !0), window.removeEventListener("blur", v), o.removeEventListener("lostpointercapture", v);
    try {
      o.releasePointerCapture(s);
    } catch {
    }
    if (!d) return;
    Wo = !1, document.body.style.cursor = p.cursor, document.body.style.userSelect = p.userSelect, d.end();
    const S = (k) => k.stopPropagation();
    window.addEventListener("click", S, { capture: !0, once: !0 }), setTimeout(() => window.removeEventListener("click", S, !0), 0), m?.(), l.onEnd(N, d);
  }, E = (N) => {
    if (!d) {
      if (Math.hypot(N.clientX - i.clientX, N.clientY - i.clientY) < Hb) return;
      const S = l.items();
      d = Db(S, l.from(S), l.axis, i), Wo = !0, document.body.style.cursor = "grabbing", document.body.style.userSelect = "none";
      try {
        o.setPointerCapture(s);
      } catch {
      }
      o.addEventListener("lostpointercapture", v);
      const k = l.onStart?.();
      m = typeof k == "function" ? k : void 0;
    }
    l.onMove(N, d);
  }, w = () => y(!0), v = () => y(!1), z = (N) => {
    N.key === "Escape" && (N.stopPropagation(), y(!1));
  };
  window.addEventListener("pointermove", E), window.addEventListener("pointerup", w), window.addEventListener("pointercancel", v), window.addEventListener("keydown", z, !0), window.addEventListener("blur", v);
}
const am = typeof navigator < "u" && /Mac/i.test(navigator.platform), Wr = {
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
for (let n = 1; n <= 12; n++) Wr[`f${n}`] = `F${n}`;
const Ub = Object.fromEntries(Object.entries(Wr).map(([n, l]) => [l, n])), qb = {
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
function Yb(n) {
  const l = /^Key([A-Z])$/.exec(n) ?? /^Digit(\d)$/.exec(n);
  return l ? l[1].toLowerCase() : Ub[n];
}
const sf = /* @__PURE__ */ new Map();
function lm(n, l = am) {
  const i = `${l}|${n}`, o = sf.get(i);
  if (o) return o;
  const s = { cmd: !1, ctrl: !1, shift: !1, alt: !1, code: "" };
  for (const d of n.split("+"))
    if (d === "mod")
      l ? s.cmd = !0 : (s.ctrl = !0, s.shift = !0);
    else if (d === "cmd" || d === "ctrl" || d === "shift" || d === "alt") s[d] = !0;
    else if (/^[a-z]$/.test(d))
      s.code = `Key${d.toUpperCase()}`, s.letter = d;
    else if (/^[0-9]$/.test(d)) s.code = `Digit${d}`;
    else if (Wr[d]) s.code = Wr[d];
    else throw new Error(`unknown key "${d}" in "${n}"`);
  if (!s.code) throw new Error(`no key in "${n}"`);
  return sf.set(i, s), s;
}
new Set(["cmd+q", "cmd+h", "cmd+alt+h", "cmd+m", "cmd+ctrl+f", "cmd+z", "cmd+shift+z", "cmd+x", "cmd+c", "cmd+v", "cmd+a"].map((n) => {
  const l = lm(n, !0);
  return [l.cmd && "cmd", l.ctrl && "ctrl", l.alt && "alt", l.shift && "shift", l.code].filter(Boolean).join("+");
}));
function Gb(n, l = am) {
  const i = lm(n, l), o = Kb(Yb(i.code) ?? "");
  return l ? `${i.ctrl ? "⌃" : ""}${i.alt ? "⌥" : ""}${i.shift ? "⇧" : ""}${i.cmd ? "⌘" : ""}${o}` : [i.ctrl && "Ctrl", i.alt && "Alt", i.shift && "Shift", o].filter(Boolean).join("+");
}
const Kb = (n) => qb[n] ?? n.toUpperCase(), cf = (n) => typeof n == "boolean" ? `${n}` : n === 0 ? "0" : n, uf = Kf, ei = (n, l) => (i) => {
  var o;
  if (l?.variants == null) return uf(n, i?.class, i?.className);
  const { variants: s, defaultVariants: d } = l, m = Object.keys(s).map((y) => {
    const E = i?.[y], w = d?.[y];
    if (E === null) return null;
    const v = cf(E) || cf(w);
    return s[y][v];
  }), f = i && Object.entries(i).reduce((y, E) => {
    let [w, v] = E;
    return v === void 0 || (y[w] = v), y;
  }, {}), p = l == null || (o = l.compoundVariants) === null || o === void 0 ? void 0 : o.reduce((y, E) => {
    let { class: w, className: v, ...z } = E;
    return Object.entries(z).every((N) => {
      let [S, k] = N;
      return Array.isArray(k) ? k.includes({
        ...d,
        ...f
      }[S]) : {
        ...d,
        ...f
      }[S] === k;
    }) ? [
      ...y,
      w,
      v
    ] : y;
  }, []);
  return uf(n, m, p, i?.class, i?.className);
}, Qb = ei(
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
), Vb = ei(
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
function Lb({ className: n, ...l } = {}) {
  return ue(Vb(l), n);
}
const rm = "shrink-0 cursor-pointer rounded-ui bg-transparent px-[0.2rem] py-[0.1rem] text-[0.8rem] leading-none text-subtext-0 [font-family:inherit] [border:none] [transition:color_0.1s_ease,background_0.1s_ease] hover:bg-surface-1 hover:text-accent", im = "cursor-pointer rounded-ui bg-transparent text-subtext-0 [border:0] [font-family:inherit] [transition:color_0.1s_ease,background_0.1s_ease] hover:bg-surface-1 hover:text-fg focus-visible:bg-surface-1 focus-visible:text-fg disabled:cursor-not-allowed disabled:opacity-40", Xb = ei(`${im} shrink-0 focus-visible:[outline:2px_solid_var(--accent)] focus-visible:[outline-offset:-2px]`, {
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
function Zb({ className: n, ...l } = {}) {
  return ue(Xb(l), n);
}
const om = "overflow-hidden rounded-ui bg-surface-1 py-[0.3rem] shadow-[0_8px_24px_rgba(0,0,0,0.45)]", Jb = ei(
  "pane-context-menu__item block w-full cursor-pointer bg-transparent px-[0.9rem] py-[0.45rem] text-left text-[0.82rem] [border:none] [font-family:inherit] [transition:background_0.1s_ease] hover:bg-surface-0 disabled:cursor-not-allowed disabled:bg-transparent disabled:opacity-40",
  { variants: { danger: { true: "text-red", false: "text-fg" } }, defaultVariants: { danger: !1 } }
), Wb = "my-1 h-px bg-overlay-0";
function Fb({ size: n = 14, className: l }) {
  return /* @__PURE__ */ ft.jsxs("svg", { className: l, width: n, height: n, viewBox: "0 0 16 16", fill: "currentColor", "aria-hidden": "true", children: [
    /* @__PURE__ */ ft.jsx("circle", { cx: "3.5", cy: "8", r: "1.1" }),
    /* @__PURE__ */ ft.jsx("circle", { cx: "8", cy: "8", r: "1.1" }),
    /* @__PURE__ */ ft.jsx("circle", { cx: "12.5", cy: "8", r: "1.1" })
  ] });
}
function Ib({ size: n = 16, className: l }) {
  return /* @__PURE__ */ ft.jsxs("svg", { className: l, width: n, height: n, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: "1.3", strokeLinejoin: "round", "aria-hidden": "true", children: [
    /* @__PURE__ */ ft.jsx("path", { d: "M6.6 1.8h2.8l.4 1.6 1.1.6 1.5-.6 1.4 2.4-1.2 1.1v1.3l1.2 1.1-1.4 2.4-1.5-.6-1.1.6-.4 1.6H6.6l-.4-1.6-1.1-.6-1.5.6-1.4-2.4 1.2-1.1V7.3L2.2 6.2l1.4-2.4 1.5.6 1.1-.6z" }),
    /* @__PURE__ */ ft.jsx("circle", { cx: "8", cy: "8", r: "2" })
  ] });
}
function $b({ size: n = 14, className: l }) {
  return /* @__PURE__ */ ft.jsx("svg", { className: l, width: n, height: n, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round", "aria-hidden": "true", children: /* @__PURE__ */ ft.jsx("path", { d: "M3.5 3.5l9 9M12.5 3.5l-9 9" }) });
}
function sm({ size: n = 14, className: l }) {
  return /* @__PURE__ */ ft.jsx("svg", { className: l, width: n, height: n, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round", "aria-hidden": "true", children: /* @__PURE__ */ ft.jsx("path", { d: "M8 2.5v11M2.5 8h11" }) });
}
const df = {
  connected: "host-state--connected bg-accent",
  connecting: "host-state--connecting animate-host-pulse bg-yellow",
  error: "host-state--error bg-red",
  disabled: "host-state--disabled bg-subtext-0"
};
function Pb({ state: n, error: l }) {
  return /* @__PURE__ */ ft.jsx(
    "span",
    {
      className: ue("host-state inline-block h-2 w-2 shrink-0 rounded-[50%]", df[n] ?? df.disabled),
      title: n === "error" && l ? l : n
    }
  );
}
function tv({ title: n, onClose: l, children: i, testId: o }) {
  return ti(
    /* @__PURE__ */ ft.jsx(
      "div",
      {
        className: "fixed inset-0 z-[2100] flex items-center justify-center bg-[rgba(0,0,0,0.55)]",
        onMouseDown: (s) => {
          s.target === s.currentTarget && l();
        },
        onKeyDown: (s) => {
          s.key === "Escape" && l();
        },
        children: /* @__PURE__ */ ft.jsxs(
          "div",
          {
            className: "grid max-h-[85vh] w-[min(30rem,92vw)] gap-[0.6rem] overflow-y-auto rounded-ui bg-panel-bg p-4 shadow-[0_8px_32px_rgba(0,0,0,0.5)]",
            role: "dialog",
            "aria-modal": "true",
            "aria-label": n,
            "data-testid": o,
            children: [
              /* @__PURE__ */ ft.jsx("h2", { className: "m-0 text-[0.9rem] font-semibold text-fg", children: n }),
              i
            ]
          }
        )
      }
    ),
    document.body
  );
}
const Rr = 4, Dn = 8, ev = "flex w-full cursor-pointer items-center justify-between gap-3 px-[0.9rem] py-[0.4rem] text-left text-[0.82rem] text-fg max-[700px]:min-h-11 aria-disabled:cursor-not-allowed aria-disabled:opacity-40", ff = (n) => n.text ?? (typeof n.label == "string" ? n.label : n.value);
function nv({ value: n, onChange: l, options: i, className: o, ariaLabel: s, testId: d, id: m, title: f, disabled: p, placeholder: y, freeText: E, onKeyDown: w }) {
  const v = dt.useId(), [z, N] = dt.useState(!1), [S, k] = dt.useState(-1), [j, H] = dt.useState(!1), A = dt.useRef(null), L = dt.useRef(null), [U, R] = dt.useState({}), h = dt.useRef({ text: "", at: 0 }), b = E && j && n ? i.filter((K) => ff(K).toLowerCase().includes(n.toLowerCase()) || K.value.toLowerCase().includes(n.toLowerCase())) : i, x = i.find((K) => K.value === n), _ = (K) => `${v}-${K}`;
  function T(K) {
    p || (k(K), N(!0));
  }
  function D() {
    N(!1), H(!1), k(-1);
  }
  function G(K) {
    !K || K.disabled || (l(K.value), D());
  }
  function I(K, V) {
    for (let C = 1; C <= b.length; C++) {
      const X = (K + V * C + b.length * C) % b.length;
      if (!b[X].disabled) return X;
    }
    return K;
  }
  const tt = () => b.findIndex((K) => !K.disabled), Q = () => b.length - 1 - [...b].reverse().findIndex((K) => !K.disabled);
  ls(() => {
    if (!z || !A.current) {
      R((et) => et.left === void 0 ? et : {});
      return;
    }
    const K = A.current.getBoundingClientRect(), V = window.innerHeight - K.bottom - Rr - Dn, C = K.top - Rr - Dn, X = V < 160 && C > V;
    R({
      position: "fixed",
      left: Math.min(Math.max(Dn, K.left), Math.max(Dn, window.innerWidth - K.width - Dn)),
      // As wide as its longest label (a session title, a path), never wider than the window.
      width: "max-content",
      minWidth: K.width,
      maxWidth: window.innerWidth - 2 * Dn,
      maxHeight: Math.min(X ? C : V, 320),
      ...X ? { bottom: window.innerHeight - K.top + Rr } : { top: K.bottom + Rr },
      overflowY: "auto"
    });
  }, [z, b.length]), ls(() => {
    const K = L.current;
    if (!z || !K || U.left === void 0) return;
    const V = K.getBoundingClientRect().right, C = window.innerWidth - Dn;
    V > C && R((X) => ({ ...X, left: Math.max(Dn, Number(X.left) - (V - C)) }));
  }, [z, U]), Ie(() => {
    if (!z) return;
    const K = (V) => {
      const C = V.target;
      (C === document || C instanceof Node && A.current && C.contains(A.current)) && D();
    };
    return window.addEventListener("resize", D), window.addEventListener("scroll", K, !0), () => {
      window.removeEventListener("resize", D), window.removeEventListener("scroll", K, !0);
    };
  }, [z]), Ie(() => {
    const K = z && S >= 0 ? document.getElementById(_(S)) : null, V = L.current;
    !K || !V || (K.offsetTop < V.scrollTop ? V.scrollTop = K.offsetTop : K.offsetTop + K.offsetHeight > V.scrollTop + V.clientHeight && (V.scrollTop = K.offsetTop + K.offsetHeight - V.clientHeight));
  }, [z, S]), fm(z, (K) => {
    K || D();
  }, A, L);
  function Z(K) {
    if (K.nativeEvent.isComposing) return;
    const V = () => {
      K.preventDefault(), K.stopPropagation();
    }, { key: C } = K;
    if (z) {
      if (C === "Escape") {
        V(), D();
        return;
      } else if (C === "Tab")
        D();
      else if (C === "ArrowDown" || C === "ArrowUp") {
        V(), b.length && k(S < 0 ? C === "ArrowDown" ? tt() : Q() : I(S, C === "ArrowDown" ? 1 : -1));
        return;
      } else if (C === "Home" && !E) {
        V(), k(tt());
        return;
      } else if (C === "End" && !E) {
        V(), k(Q());
        return;
      } else if (C === "Enter" || C === " " && !E) {
        if (S >= 0 && b[S]) {
          V(), G(b[S]);
          return;
        }
        if (!E) {
          V(), D();
          return;
        }
      } else if (!E && C.length === 1 && !K.metaKey && !K.ctrlKey && !K.altKey) {
        const X = Date.now();
        h.current = { text: (X - h.current.at > 600 ? "" : h.current.text) + C.toLowerCase(), at: X };
        const et = Math.max(S, 0), it = [...b.slice(et + (h.current.text.length === 1 ? 1 : 0)), ...b.slice(0, et + 1)].find((ot) => !ot.disabled && ff(ot).toLowerCase().startsWith(h.current.text));
        it && (V(), k(b.indexOf(it)));
        return;
      }
    } else if (C === "ArrowDown" || C === "ArrowUp" || !E && (C === "Enter" || C === " ")) {
      V(), T(Math.max(0, b.findIndex((X) => X.value === n)));
      return;
    }
    w?.(K);
  }
  const $ = {
    ref: (K) => {
      A.current = K;
    },
    id: m,
    title: f,
    disabled: p,
    "aria-label": s,
    "aria-expanded": z,
    "aria-controls": z ? v : void 0,
    "aria-activedescendant": z && S >= 0 ? _(S) : void 0,
    "data-testid": d,
    onKeyDown: Z
  };
  return /* @__PURE__ */ ft.jsxs(ft.Fragment, { children: [
    E ? /* @__PURE__ */ ft.jsx(
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
        onChange: (K) => {
          l(K.target.value), H(!0), z ? k(-1) : (k(-1), N(!0));
        },
        onBlur: () => D()
      }
    ) : /* @__PURE__ */ ft.jsxs(
      "button",
      {
        ...$,
        type: "button",
        role: "combobox",
        "aria-haspopup": "listbox",
        "data-value": n,
        className: ue("inline-flex items-center justify-between gap-2 text-left [font-family:inherit] cursor-pointer disabled:cursor-not-allowed disabled:opacity-50", o),
        onClick: () => z ? D() : T(Math.max(0, b.findIndex((K) => K.value === n))),
        children: [
          /* @__PURE__ */ ft.jsx("span", { className: "min-w-0 flex-1 truncate", children: x ? x.label : y ?? "" }),
          /* @__PURE__ */ ft.jsx(dm, { open: !0, className: "shrink-0 text-subtext-0" })
        ]
      }
    ),
    z && b.length > 0 && ti(
      /* @__PURE__ */ ft.jsx(
        "div",
        {
          ref: L,
          id: v,
          role: "listbox",
          "aria-label": s,
          className: ue("z-[9999]", om),
          style: U,
          onMouseDown: (K) => {
            K.preventDefault(), K.stopPropagation();
          },
          onClick: (K) => K.stopPropagation(),
          children: b.map((K, V) => /* @__PURE__ */ ft.jsxs(
            "div",
            {
              id: _(V),
              role: "option",
              "aria-selected": K.value === n,
              "aria-disabled": K.disabled || void 0,
              "data-value": K.value,
              className: ue(ev, V === S && !K.disabled && "bg-surface-0"),
              onMouseEnter: () => {
                K.disabled || k(V);
              },
              onClick: () => G(K),
              children: [
                /* @__PURE__ */ ft.jsx("span", { className: "min-w-0 truncate", children: K.label }),
                K.value === n && /* @__PURE__ */ ft.jsx("span", { "aria-hidden": "true", className: "shrink-0 text-accent", children: "✓" })
              ]
            },
            K.value
          ))
        }
      ),
      document.body
    )
  ] });
}
const av = "box-border min-h-[44px] cursor-pointer rounded-ui bg-transparent px-[0.7rem] py-[0.45rem] text-subtext-0 no-underline [border:0] [font-family:inherit] [font-weight:inherit] [line-height:inherit] text-[0.85rem] hover:bg-surface-1 hover:text-fg focus-visible:[outline:2px_solid_var(--accent)] focus-visible:[outline-offset:2px] disabled:cursor-default disabled:opacity-[0.55]", lv = "m-0 mt-[0.4rem] text-[0.78rem] text-subtext-0", rv = "m-0 mb-2 text-[0.82rem] text-subtext-0", cm = "rounded-ui bg-surface-1 text-fg [font-family:inherit]", Ns = `${cm} px-2 py-[0.3rem] text-[0.8rem] max-[700px]:min-h-11 focus:[outline:1px_solid_var(--accent)]`, iv = `${Ns} min-w-[5.5rem] shrink-0`, Ts = `${cm} min-w-0 px-[0.55rem] py-[0.35rem] text-[0.82rem] max-[700px]:min-h-11 focus:[outline:1px_solid_var(--accent)]`, ov = `${Ts} flex-1 max-[700px]:flex-[1_1_100%]`, sv = `${Ts} w-20 flex-[0_0_5rem] max-[700px]:w-24 max-[700px]:flex-[1_1_6rem]`, cv = `${Ts} flex-[1_1_100%]`, uv = "flex flex-wrap items-center gap-[0.4rem]", dv = "m-0 mb-2 flex list-none flex-col gap-[0.3rem] p-0", fv = "flex items-center gap-2 max-[700px]:flex-wrap rounded-ui bg-surface-1 px-2 py-[0.35rem] text-[0.82rem]", mv = `settings-modal__host-row ${fv}`, pv = "min-w-0 overflow-hidden font-semibold text-ellipsis whitespace-nowrap text-fg", hv = "min-w-0 flex-1 max-[700px]:basis-full overflow-hidden text-[0.78rem] text-ellipsis whitespace-nowrap text-subtext-0", um = "shrink-0 cursor-pointer rounded-ui px-[0.7rem] py-[0.35rem] max-[700px]:min-h-11 text-[0.82rem] font-semibold text-panel-bg [border:none] [font-family:inherit] [transition:opacity_0.12s_ease] hover:opacity-[0.85]", gv = `${um} bg-accent`, bv = `${um} ml-auto bg-red`;
function dm({ open: n, size: l = 12, className: i }) {
  return /* @__PURE__ */ ft.jsx("svg", { className: i, width: l, height: l, viewBox: "0 0 12 12", fill: "none", stroke: "currentColor", strokeWidth: "1.3", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true", children: /* @__PURE__ */ ft.jsx("path", { d: n ? "M2.5 4.5 6 8l3.5-3.5" : "M4.5 2.5 8 6l-3.5 3.5" }) });
}
function vv(n) {
  return n.blocked && !n.stale ? "blocked" : n.status === "running" && !n.stale ? "working" : n.unseen ? "done" : "idle";
}
const ds = {
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
function fs(n, l) {
  return !!n.parentSessionId && n.parentSessionId !== n.id && l.some((i) => i.id === n.parentSessionId);
}
function yv(n) {
  const l = /* @__PURE__ */ new Map();
  for (const i of n)
    fs(i, n) && l.set(i.parentSessionId, [...l.get(i.parentSessionId) ?? [], i]);
  return l.size ? n.filter((i) => !fs(i, n)).flatMap((i) => [i, ...l.get(i.id) ?? []]) : n;
}
const Dr = 6, mf = 8;
function xv(n, l = {}) {
  const { minWidth: i = 220, align: o = "right", minSpaceAbove: s = 100 } = l, d = n.getBoundingClientRect(), m = window.innerWidth, f = window.innerHeight, p = o === "right" ? { right: Math.max(0, m - d.right) } : { left: Math.max(0, d.left) }, y = d.top - Dr - mf, E = f - d.bottom - Dr - mf;
  return y >= s ? {
    position: "fixed",
    bottom: f - d.top + Dr,
    ...p,
    minWidth: i,
    maxHeight: Math.min(y, f * 0.75),
    overflowY: "auto"
  } : {
    position: "fixed",
    top: d.bottom + Dr,
    ...p,
    minWidth: i,
    maxHeight: Math.min(E, f * 0.75),
    overflowY: "auto"
  };
}
function fm(n, l, i, o) {
  Ie(() => {
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
function wv({ icon: n, fallback: l }) {
  const [i, o] = dt.useState(!1);
  return Ie(() => o(!1), [n]), !n || i ? /* @__PURE__ */ ft.jsx(ft.Fragment, { children: l }) : /* @__PURE__ */ ft.jsx("img", { src: n, alt: "", width: 14, height: 14, className: "size-[14px] rounded-[2px] object-contain", referrerPolicy: "no-referrer", onError: () => o(!0) });
}
const _v = "mode-switch group ml-auto flex items-center gap-[0.4rem] bg-transparent p-[0.2rem] [border:none] [font-family:inherit]", mm = "text-[0.72rem] font-semibold tracking-[0.03em] text-overlay-1 uppercase [transition:color_0.15s_ease]", Sv = `${mm} group-aria-[checked=false]:text-accent`, kv = `${mm} group-aria-checked:text-accent`, Ev = "relative h-[1.3rem] w-[2.4rem] shrink-0 rounded-[999px] border border-overlay-0 bg-surface-1 [transition:background_0.15s_ease] group-aria-checked:border-accent group-aria-checked:bg-panel-bg", zv = "absolute top-px left-px h-[1.1rem] w-[1.1rem] rounded-[50%] bg-fg [box-shadow:0_1px_2px_rgba(0,0,0,0.3)] [transition:transform_0.15s_ease,background_0.15s_ease] group-aria-checked:bg-accent group-aria-checked:[transform:translateX(1.1rem)]";
function Nv({
  mode: n,
  onChange: l,
  testId: i = "mode-switch",
  disabled: o = !1
}) {
  const s = n === "cli";
  return /* @__PURE__ */ ft.jsxs(
    "button",
    {
      type: "button",
      className: _v,
      "data-testid": i,
      role: "switch",
      "aria-checked": s,
      "aria-label": "Toggle UI / CLI mode",
      disabled: o,
      onClick: () => l(s ? "ui" : "cli"),
      children: [
        /* @__PURE__ */ ft.jsx("span", { className: ue("mode-switch__label mode-switch__label--ui", Sv), children: "UI" }),
        /* @__PURE__ */ ft.jsx("span", { className: ue("mode-switch__track", Ev), children: /* @__PURE__ */ ft.jsx("span", { className: ue("mode-switch__thumb", zv) }) }),
        /* @__PURE__ */ ft.jsx("span", { className: ue("mode-switch__label mode-switch__label--cli", kv), children: "CLI" })
      ]
    }
  );
}
const Ya = function(n, l) {
  let s = n;
  const d = wl[l];
  let m = null, f = 0, p = null;
  const y = [], E = {}, w = function(h, b) {
    f = s * 4 + 17, m = (function(x) {
      const _ = new Array(x);
      for (let T = 0; T < x; T += 1) {
        _[T] = new Array(x);
        for (let D = 0; D < x; D += 1)
          _[T][D] = null;
      }
      return _;
    })(f), v(0, 0), v(f - 7, 0), v(0, f - 7), S(), N(), j(h, b), s >= 7 && k(h), p == null && (p = L(s, d, y)), H(p, b);
  }, v = function(h, b) {
    for (let x = -1; x <= 7; x += 1)
      if (!(h + x <= -1 || f <= h + x))
        for (let _ = -1; _ <= 7; _ += 1)
          b + _ <= -1 || f <= b + _ || (0 <= x && x <= 6 && (_ == 0 || _ == 6) || 0 <= _ && _ <= 6 && (x == 0 || x == 6) || 2 <= x && x <= 4 && 2 <= _ && _ <= 4 ? m[h + x][b + _] = !0 : m[h + x][b + _] = !1);
  }, z = function() {
    let h = 0, b = 0;
    for (let x = 0; x < 8; x += 1) {
      w(!0, x);
      const _ = Bn.getLostPoint(E);
      (x == 0 || h > _) && (h = _, b = x);
    }
    return b;
  }, N = function() {
    for (let h = 8; h < f - 8; h += 1)
      m[h][6] == null && (m[h][6] = h % 2 == 0);
    for (let h = 8; h < f - 8; h += 1)
      m[6][h] == null && (m[6][h] = h % 2 == 0);
  }, S = function() {
    const h = Bn.getPatternPosition(s);
    for (let b = 0; b < h.length; b += 1)
      for (let x = 0; x < h.length; x += 1) {
        const _ = h[b], T = h[x];
        if (m[_][T] == null)
          for (let D = -2; D <= 2; D += 1)
            for (let G = -2; G <= 2; G += 1)
              D == -2 || D == 2 || G == -2 || G == 2 || D == 0 && G == 0 ? m[_ + D][T + G] = !0 : m[_ + D][T + G] = !1;
      }
  }, k = function(h) {
    const b = Bn.getBCHTypeNumber(s);
    for (let x = 0; x < 18; x += 1) {
      const _ = !h && (b >> x & 1) == 1;
      m[Math.floor(x / 3)][x % 3 + f - 8 - 3] = _;
    }
    for (let x = 0; x < 18; x += 1) {
      const _ = !h && (b >> x & 1) == 1;
      m[x % 3 + f - 8 - 3][Math.floor(x / 3)] = _;
    }
  }, j = function(h, b) {
    const x = d << 3 | b, _ = Bn.getBCHTypeInfo(x);
    for (let T = 0; T < 15; T += 1) {
      const D = !h && (_ >> T & 1) == 1;
      T < 6 ? m[T][8] = D : T < 8 ? m[T + 1][8] = D : m[f - 15 + T][8] = D;
    }
    for (let T = 0; T < 15; T += 1) {
      const D = !h && (_ >> T & 1) == 1;
      T < 8 ? m[8][f - T - 1] = D : T < 9 ? m[8][15 - T - 1 + 1] = D : m[8][15 - T - 1] = D;
    }
    m[f - 8][8] = !h;
  }, H = function(h, b) {
    let x = -1, _ = f - 1, T = 7, D = 0;
    const G = Bn.getMaskFunction(b);
    for (let I = f - 1; I > 0; I -= 2)
      for (I == 6 && (I -= 1); ; ) {
        for (let tt = 0; tt < 2; tt += 1)
          if (m[_][I - tt] == null) {
            let Q = !1;
            D < h.length && (Q = (h[D] >>> T & 1) == 1), G(_, I - tt) && (Q = !Q), m[_][I - tt] = Q, T -= 1, T == -1 && (D += 1, T = 7);
          }
        if (_ += x, _ < 0 || f <= _) {
          _ -= x, x = -x;
          break;
        }
      }
  }, A = function(h, b) {
    let x = 0, _ = 0, T = 0;
    const D = new Array(b.length), G = new Array(b.length);
    for (let Z = 0; Z < b.length; Z += 1) {
      const $ = b[Z].dataCount, K = b[Z].totalCount - $;
      _ = Math.max(_, $), T = Math.max(T, K), D[Z] = new Array($);
      for (let et = 0; et < D[Z].length; et += 1)
        D[Z][et] = 255 & h.getBuffer()[et + x];
      x += $;
      const V = Bn.getErrorCorrectPolynomial(K), X = zl(D[Z], V.getLength() - 1).mod(V);
      G[Z] = new Array(V.getLength() - 1);
      for (let et = 0; et < G[Z].length; et += 1) {
        const it = et + X.getLength() - G[Z].length;
        G[Z][et] = it >= 0 ? X.getAt(it) : 0;
      }
    }
    let I = 0;
    for (let Z = 0; Z < b.length; Z += 1)
      I += b[Z].totalCount;
    const tt = new Array(I);
    let Q = 0;
    for (let Z = 0; Z < _; Z += 1)
      for (let $ = 0; $ < b.length; $ += 1)
        Z < D[$].length && (tt[Q] = D[$][Z], Q += 1);
    for (let Z = 0; Z < T; Z += 1)
      for (let $ = 0; $ < b.length; $ += 1)
        Z < G[$].length && (tt[Q] = G[$][Z], Q += 1);
    return tt;
  }, L = function(h, b, x) {
    const _ = pf.getRSBlocks(h, b), T = hf();
    for (let G = 0; G < x.length; G += 1) {
      const I = x[G];
      T.put(I.getMode(), 4), T.put(I.getLength(), Bn.getLengthInBits(I.getMode(), h)), I.write(T);
    }
    let D = 0;
    for (let G = 0; G < _.length; G += 1)
      D += _[G].dataCount;
    if (T.getLengthInBits() > D * 8)
      throw "code length overflow. (" + T.getLengthInBits() + ">" + D * 8 + ")";
    for (T.getLengthInBits() + 4 <= D * 8 && T.put(0, 4); T.getLengthInBits() % 8 != 0; )
      T.putBit(!1);
    for (; !(T.getLengthInBits() >= D * 8 || (T.put(236, 8), T.getLengthInBits() >= D * 8)); )
      T.put(17, 8);
    return A(T, _);
  };
  E.addData = function(h, b) {
    b = b || "Byte";
    let x = null;
    switch (b) {
      case "Numeric":
        x = Tv(h);
        break;
      case "Alphanumeric":
        x = Cv(h);
        break;
      case "Byte":
        x = Mv(h);
        break;
      case "Kanji":
        x = Av(h);
        break;
      default:
        throw "mode:" + b;
    }
    y.push(x), p = null;
  }, E.isDark = function(h, b) {
    if (h < 0 || f <= h || b < 0 || f <= b)
      throw h + "," + b;
    return m[h][b];
  }, E.getModuleCount = function() {
    return f;
  }, E.make = function() {
    if (s < 1) {
      let h = 1;
      for (; h < 40; h++) {
        const b = pf.getRSBlocks(h, d), x = hf();
        for (let T = 0; T < y.length; T++) {
          const D = y[T];
          x.put(D.getMode(), 4), x.put(D.getLength(), Bn.getLengthInBits(D.getMode(), h)), D.write(x);
        }
        let _ = 0;
        for (let T = 0; T < b.length; T++)
          _ += b[T].dataCount;
        if (x.getLengthInBits() <= _ * 8)
          break;
      }
      s = h;
    }
    w(!1, z());
  }, E.createTableTag = function(h, b) {
    h = h || 2, b = typeof b > "u" ? h * 4 : b;
    let x = "";
    x += '<table style="', x += " border-width: 0px; border-style: none;", x += " border-collapse: collapse;", x += " padding: 0px; margin: " + b + "px;", x += '">', x += "<tbody>";
    for (let _ = 0; _ < E.getModuleCount(); _ += 1) {
      x += "<tr>";
      for (let T = 0; T < E.getModuleCount(); T += 1)
        x += '<td style="', x += " border-width: 0px; border-style: none;", x += " border-collapse: collapse;", x += " padding: 0px; margin: 0px;", x += " width: " + h + "px;", x += " height: " + h + "px;", x += " background-color: ", x += E.isDark(_, T) ? "#000000" : "#ffffff", x += ";", x += '"/>';
      x += "</tr>";
    }
    return x += "</tbody>", x += "</table>", x;
  }, E.createSvgTag = function(h, b, x, _) {
    let T = {};
    typeof arguments[0] == "object" && (T = arguments[0], h = T.cellSize, b = T.margin, x = T.alt, _ = T.title), h = h || 2, b = typeof b > "u" ? h * 4 : b, x = typeof x == "string" ? { text: x } : x || {}, x.text = x.text || null, x.id = x.text ? x.id || "qrcode-description" : null, _ = typeof _ == "string" ? { text: _ } : _ || {}, _.text = _.text || null, _.id = _.text ? _.id || "qrcode-title" : null;
    const D = E.getModuleCount() * h + b * 2;
    let G, I, tt, Q, Z = "", $;
    for ($ = "l" + h + ",0 0," + h + " -" + h + ",0 0,-" + h + "z ", Z += '<svg version="1.1" xmlns="http://www.w3.org/2000/svg"', Z += T.scalable ? "" : ' width="' + D + 'px" height="' + D + 'px"', Z += ' viewBox="0 0 ' + D + " " + D + '" ', Z += ' preserveAspectRatio="xMinYMin meet"', Z += _.text || x.text ? ' role="img" aria-labelledby="' + U([_.id, x.id].join(" ").trim()) + '"' : "", Z += ">", Z += _.text ? '<title id="' + U(_.id) + '">' + U(_.text) + "</title>" : "", Z += x.text ? '<description id="' + U(x.id) + '">' + U(x.text) + "</description>" : "", Z += '<rect width="100%" height="100%" fill="white" cx="0" cy="0"/>', Z += '<path d="', tt = 0; tt < E.getModuleCount(); tt += 1)
      for (Q = tt * h + b, G = 0; G < E.getModuleCount(); G += 1)
        E.isDark(tt, G) && (I = G * h + b, Z += "M" + I + "," + Q + $);
    return Z += '" stroke="transparent" fill="black"/>', Z += "</svg>", Z;
  }, E.createDataURL = function(h, b) {
    h = h || 2, b = typeof b > "u" ? h * 4 : b;
    const x = E.getModuleCount() * h + b * 2, _ = b, T = x - b;
    return Dv(x, x, function(D, G) {
      if (_ <= D && D < T && _ <= G && G < T) {
        const I = Math.floor((D - _) / h), tt = Math.floor((G - _) / h);
        return E.isDark(tt, I) ? 0 : 1;
      } else
        return 1;
    });
  }, E.createImgTag = function(h, b, x) {
    h = h || 2, b = typeof b > "u" ? h * 4 : b;
    const _ = E.getModuleCount() * h + b * 2;
    let T = "";
    return T += "<img", T += ' src="', T += E.createDataURL(h, b), T += '"', T += ' width="', T += _, T += '"', T += ' height="', T += _, T += '"', x && (T += ' alt="', T += U(x), T += '"'), T += "/>", T;
  };
  const U = function(h) {
    let b = "";
    for (let x = 0; x < h.length; x += 1) {
      const _ = h.charAt(x);
      switch (_) {
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
          b += _;
          break;
      }
    }
    return b;
  }, R = function(h) {
    h = typeof h > "u" ? 2 : h;
    const x = E.getModuleCount() * 1 + h * 2, _ = h, T = x - h;
    let D, G, I, tt, Q;
    const Z = {
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
    let K = "";
    for (D = 0; D < x; D += 2) {
      for (I = Math.floor((D - _) / 1), tt = Math.floor((D + 1 - _) / 1), G = 0; G < x; G += 1)
        Q = "█", _ <= G && G < T && _ <= D && D < T && E.isDark(I, Math.floor((G - _) / 1)) && (Q = " "), _ <= G && G < T && _ <= D + 1 && D + 1 < T && E.isDark(tt, Math.floor((G - _) / 1)) ? Q += " " : Q += "█", K += h < 1 && D + 1 >= T ? $[Q] : Z[Q];
      K += `
`;
    }
    return x % 2 && h > 0 ? K.substring(0, K.length - x - 1) + Array(x + 1).join("▀") : K.substring(0, K.length - 1);
  };
  return E.createASCII = function(h, b) {
    if (h = h || 1, h < 2)
      return R(b);
    h -= 1, b = typeof b > "u" ? h * 2 : b;
    const x = E.getModuleCount() * h + b * 2, _ = b, T = x - b;
    let D, G, I, tt;
    const Q = Array(h + 1).join("██"), Z = Array(h + 1).join("  ");
    let $ = "", K = "";
    for (D = 0; D < x; D += 1) {
      for (I = Math.floor((D - _) / h), K = "", G = 0; G < x; G += 1)
        tt = 1, _ <= G && G < T && _ <= D && D < T && E.isDark(I, Math.floor((G - _) / h)) && (tt = 0), K += tt ? Q : Z;
      for (I = 0; I < h; I += 1)
        $ += K + `
`;
    }
    return $.substring(0, $.length - 1);
  }, E.renderTo2dContext = function(h, b) {
    b = b || 2;
    const x = E.getModuleCount();
    for (let _ = 0; _ < x; _++)
      for (let T = 0; T < x; T++)
        h.fillStyle = E.isDark(_, T) ? "black" : "white", h.fillRect(T * b, _ * b, b, b);
  }, E;
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
    const s = Ov(n), d = function() {
      const p = s.read();
      if (p == -1) throw "eof";
      return p;
    };
    let m = 0;
    const f = {};
    for (; ; ) {
      const p = s.read();
      if (p == -1) break;
      const y = d(), E = d(), w = d(), v = String.fromCharCode(p << 8 | y), z = E << 8 | w;
      f[v] = z, m += 1;
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
const ce = {
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
        case ce.MODE_NUMBER:
          return 10;
        case ce.MODE_ALPHA_NUM:
          return 9;
        case ce.MODE_8BIT_BYTE:
          return 8;
        case ce.MODE_KANJI:
          return 8;
        default:
          throw "mode:" + m;
      }
    else if (f < 27)
      switch (m) {
        case ce.MODE_NUMBER:
          return 12;
        case ce.MODE_ALPHA_NUM:
          return 11;
        case ce.MODE_8BIT_BYTE:
          return 16;
        case ce.MODE_KANJI:
          return 10;
        default:
          throw "mode:" + m;
      }
    else if (f < 41)
      switch (m) {
        case ce.MODE_NUMBER:
          return 14;
        case ce.MODE_ALPHA_NUM:
          return 13;
        case ce.MODE_8BIT_BYTE:
          return 16;
        case ce.MODE_KANJI:
          return 12;
        default:
          throw "mode:" + m;
      }
    else
      throw "type:" + f;
  }, s.getLostPoint = function(m) {
    const f = m.getModuleCount();
    let p = 0;
    for (let w = 0; w < f; w += 1)
      for (let v = 0; v < f; v += 1) {
        let z = 0;
        const N = m.isDark(w, v);
        for (let S = -1; S <= 1; S += 1)
          if (!(w + S < 0 || f <= w + S))
            for (let k = -1; k <= 1; k += 1)
              v + k < 0 || f <= v + k || S == 0 && k == 0 || N == m.isDark(w + S, v + k) && (z += 1);
        z > 5 && (p += 3 + z - 5);
      }
    for (let w = 0; w < f - 1; w += 1)
      for (let v = 0; v < f - 1; v += 1) {
        let z = 0;
        m.isDark(w, v) && (z += 1), m.isDark(w + 1, v) && (z += 1), m.isDark(w, v + 1) && (z += 1), m.isDark(w + 1, v + 1) && (z += 1), (z == 0 || z == 4) && (p += 3);
      }
    for (let w = 0; w < f; w += 1)
      for (let v = 0; v < f - 6; v += 1)
        m.isDark(w, v) && !m.isDark(w, v + 1) && m.isDark(w, v + 2) && m.isDark(w, v + 3) && m.isDark(w, v + 4) && !m.isDark(w, v + 5) && m.isDark(w, v + 6) && (p += 40);
    for (let w = 0; w < f; w += 1)
      for (let v = 0; v < f - 6; v += 1)
        m.isDark(v, w) && !m.isDark(v + 1, w) && m.isDark(v + 2, w) && m.isDark(v + 3, w) && m.isDark(v + 4, w) && !m.isDark(v + 5, w) && m.isDark(v + 6, w) && (p += 40);
    let y = 0;
    for (let w = 0; w < f; w += 1)
      for (let v = 0; v < f; v += 1)
        m.isDark(v, w) && (y += 1);
    const E = Math.abs(100 * y / f / f - 50) / 5;
    return p += E * 10, p;
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
}, pf = (function() {
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
      const E = m[y * 3 + 0], w = m[y * 3 + 1], v = m[y * 3 + 2];
      for (let z = 0; z < E; z += 1)
        p.push(l(w, v));
    }
    return p;
  }, i;
})(), hf = function() {
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
}, Tv = function(n) {
  const l = ce.MODE_NUMBER, i = n, o = {};
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
}, Cv = function(n) {
  const l = ce.MODE_ALPHA_NUM, i = n, o = {};
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
}, Mv = function(n) {
  const l = ce.MODE_8BIT_BYTE, i = Ya.stringToBytes(n), o = {};
  return o.getMode = function() {
    return l;
  }, o.getLength = function(s) {
    return i.length;
  }, o.write = function(s) {
    for (let d = 0; d < i.length; d += 1)
      s.put(i[d], 8);
  }, o;
}, Av = function(n) {
  const l = ce.MODE_KANJI, i = Ya.stringToBytes;
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
}, pm = function() {
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
}, jv = function() {
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
}, Ov = function(n) {
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
}, Rv = function(n, l) {
  const i = n, o = l, s = new Array(n * l), d = {};
  d.setPixel = function(y, E, w) {
    s[E * i + y] = w;
  }, d.write = function(y) {
    y.writeString("GIF87a"), y.writeShort(i), y.writeShort(o), y.writeByte(128), y.writeByte(0), y.writeByte(0), y.writeByte(0), y.writeByte(0), y.writeByte(0), y.writeByte(255), y.writeByte(255), y.writeByte(255), y.writeString(","), y.writeShort(0), y.writeShort(0), y.writeShort(i), y.writeShort(o), y.writeByte(0);
    const E = 2, w = f(E);
    y.writeByte(E);
    let v = 0;
    for (; w.length - v > 255; )
      y.writeByte(255), y.writeBytes(w, v, 255), v += 255;
    y.writeByte(w.length - v), y.writeBytes(w, v, w.length - v), y.writeByte(0), y.writeString(";");
  };
  const m = function(y) {
    const E = y;
    let w = 0, v = 0;
    const z = {};
    return z.write = function(N, S) {
      if (N >>> S)
        throw "length over";
      for (; w + S >= 8; )
        E.writeByte(255 & (N << w | v)), S -= 8 - w, N >>>= 8 - w, v = 0, w = 0;
      v = N << w | v, w = w + S;
    }, z.flush = function() {
      w > 0 && E.writeByte(v);
    }, z;
  }, f = function(y) {
    const E = 1 << y, w = (1 << y) + 1;
    let v = y + 1;
    const z = p();
    for (let H = 0; H < E; H += 1)
      z.add(String.fromCharCode(H));
    z.add(String.fromCharCode(E)), z.add(String.fromCharCode(w));
    const N = pm(), S = m(N);
    S.write(E, v);
    let k = 0, j = String.fromCharCode(s[k]);
    for (k += 1; k < s.length; ) {
      const H = String.fromCharCode(s[k]);
      k += 1, z.contains(j + H) ? j = j + H : (S.write(z.indexOf(j), v), z.size() < 4095 && (z.size() == 1 << v && (v += 1), z.add(j + H)), j = H);
    }
    return S.write(z.indexOf(j), v), S.write(w, v), S.flush(), N.toByteArray();
  }, p = function() {
    const y = {};
    let E = 0;
    const w = {};
    return w.add = function(v) {
      if (w.contains(v))
        throw "dup key:" + v;
      y[v] = E, E += 1;
    }, w.size = function() {
      return E;
    }, w.indexOf = function(v) {
      return y[v];
    }, w.contains = function(v) {
      return typeof y[v] < "u";
    }, w;
  };
  return d;
}, Dv = function(n, l, i) {
  const o = Rv(n, l);
  for (let f = 0; f < l; f += 1)
    for (let p = 0; p < n; p += 1)
      o.setPixel(p, f, i(p, f));
  const s = pm();
  o.write(s);
  const d = jv(), m = s.toByteArray();
  for (let f = 0; f < m.length; f += 1)
    d.writeByte(m[f]);
  return d.flush(), "data:image/gif;base64," + d;
};
Ya.stringToBytes;
function Hv({ text: n }) {
  const { size: l, path: i } = dt.useMemo(() => {
    const o = Ya(0, "M");
    o.addData(n), o.make();
    const s = o.getModuleCount();
    let d = "";
    for (let m = 0; m < s; m++)
      for (let f = 0; f < s; f++) o.isDark(m, f) && (d += `M${f} ${m}h1v1h-1z`);
    return { size: s, path: d };
  }, [n]);
  return /* @__PURE__ */ ft.jsxs(
    "svg",
    {
      viewBox: `-4 -4 ${l + 8} ${l + 8}`,
      shapeRendering: "crispEdges",
      role: "img",
      "aria-label": "Pairing QR code",
      "data-testid": "pair-qr",
      className: "h-44 w-44 shrink-0 rounded-ui",
      children: [
        /* @__PURE__ */ ft.jsx("rect", { x: -4, y: -4, width: l + 8, height: l + 8, fill: "#fff" }),
        /* @__PURE__ */ ft.jsx("path", { d: i, fill: "#000" })
      ]
    }
  );
}
const Nl = dt.createContext(""), ms = (n, l) => typeof n == "string" && n.toLowerCase().includes(l);
function Bv({ title: n, children: l, testId: i, ariaLabel: o }) {
  const s = dt.useContext(Nl), d = s !== "" && ms(n, s);
  return (
    // While searching, a group with no matching row (and no matching title) hides itself.
    /* @__PURE__ */ ft.jsxs("section", { className: s && !d ? "mb-8 not-has-[[data-setting-row]]:hidden" : "mb-8", "data-testid": i, "aria-label": o, children: [
      n && /* @__PURE__ */ ft.jsx("h3", { className: "m-0 mb-3 text-[0.9rem] font-medium text-fg", children: n }),
      /* @__PURE__ */ ft.jsx("div", { className: "rounded-ui bg-surface-0 px-4", children: /* @__PURE__ */ ft.jsx(Nl.Provider, { value: d ? "" : s, children: l }) })
    ] })
  );
}
function Uv({ title: n, description: l, children: i, testId: o }) {
  const s = dt.useContext(Nl);
  return s && !ms(n, s) && !ms(l, s) ? null : /* @__PURE__ */ ft.jsxs("div", { "data-setting-row": !0, "data-testid": o, className: "flex items-center justify-between gap-6 py-[0.8rem] max-[700px]:flex-wrap max-[700px]:gap-y-2", children: [
    /* @__PURE__ */ ft.jsxs("div", { className: "min-w-0 max-[700px]:flex-1 max-[700px]:basis-56", children: [
      /* @__PURE__ */ ft.jsx("div", { className: "text-[0.85rem] text-fg", children: n }),
      l && /* @__PURE__ */ ft.jsx("div", { className: "mt-[0.15rem] text-[0.75rem] text-subtext-0", children: l })
    ] }),
    i && /* @__PURE__ */ ft.jsx("div", { className: "flex shrink-0 items-center gap-2", children: i })
  ] });
}
function qv({ checked: n, onChange: l, testId: i, label: o }) {
  return /* @__PURE__ */ ft.jsx(
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
const Yv = () => dt.useContext(Nl), Gv = {
  select: Ns,
  selectHost: iv,
  input: ov,
  inputPort: sv,
  inputWide: cv,
  addRow: uv,
  list: dv,
  hostRow: mv,
  name: pv,
  addr: hv,
  muted: lv,
  empty: rv,
  primary: gv,
  danger: bv,
  catalogToggle: av
};
//! State the host keeps for a resource rather than for one view of it (`useResourceState`, `@perch/sdk` 1.4): a
//! review's unsent commit message and comment, its pending batch and its operation id, keyed by the screen's
//! own name for the resource (`review:<workspace>:commit`). Every view and copy that names the same key shares the
//! value, and it outlives a reload or swap of the screen's code, a released hidden copy and the phone/desktop
//! layouts trading places. In memory: a page reload starts empty (durable drafts live in their own services).
const Kv = 512, Fe = /* @__PURE__ */ new Map(), Sl = /* @__PURE__ */ new Map();
function hm(n, l) {
  Fe.delete(n), Fe.set(n, l);
  for (const i of Fe.keys()) {
    if (Fe.size <= Kv) break;
    Sl.get(i)?.size || Fe.delete(i);
  }
}
function Qv(n, l) {
  return Fe.has(n) ? Fe.get(n) : l;
}
function Vv(n, l, i) {
  const o = Qv(n, i), s = typeof l == "function" ? l(o) : l;
  if (!(Fe.has(n) && Object.is(s, o))) {
    hm(n, s);
    for (const d of [...Sl.get(n) ?? []]) d();
  }
}
function Lv(n, l) {
  if (typeof n != "string" || !n) throw new Error("useResourceState needs a non-empty key.");
  Fe.has(n) || hm(n, l);
  const i = dt.useCallback((d) => {
    const m = Sl.get(n) ?? /* @__PURE__ */ new Set();
    return Sl.set(n, m), m.add(d), () => {
      m.delete(d), m.size || Sl.delete(n);
    };
  }, [n]), o = dt.useSyncExternalStore(i, () => Fe.get(n)), s = dt.useCallback((d) => Vv(n, d, l), [n]);
  return [o, s];
}
const Xv = "[--radius:var(--radius-pane)] rounded-soft bg-surface-1/70 shadow-[0_6px_20px_rgba(0,0,0,0.3)] backdrop-blur-xl backdrop-saturate-150", Zv = "hover:bg-transparent hover:text-subtext-0 active:bg-surface-1 active:text-fg";
//! `@perch/sdk` for the native client: the surface a stock screen imports (the navigation part, 1.3), with every
//! call going to one abstract host object, `globalThis.perch`, read when called (so a host or a test sets it before
//! mounting). Class helpers, icons, `cn`, `keyLabel` and the host dot are the app's own modules, compiled in, so the
//! classes are the web's to the character. Data hooks subscribe to `perch.subscribe` and read the host's snapshots
//! (`perch.navigation(options)`, `perch.hosts()`, ...), which must return the same object until the data changes.
//! Menus and dialogs Perch draws itself (session menu, new session menu, confirm, select, folder browser,
//! instructions, memory) open through `perch.openOverlay(kind, props)`; their callbacks are plain functions.
const Jv = "1.3.0";
let Kr = null;
const Wv = (n) => {
  Kr = n;
};
function Tt() {
  const n = (typeof Kr == "function" ? Kr() : Kr) ?? globalThis.perch;
  if (!n) throw new Error("@perch/sdk: no perch host (globalThis.perch) is set");
  return n;
}
const Fv = (n) => Tt().subscribe?.(n) ?? (() => {
}), Iv = xv;
function $v() {
  return typeof globalThis.crypto?.randomUUID == "function" ? globalThis.crypto.randomUUID() : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (n) => {
    const l = Math.floor(Math.random() * 16);
    return (n === "x" ? l : l & 3 | 8).toString(16);
  });
}
const Pv = globalThis.perch?.isMac !== !1, t1 = (n) => Gb(n, Tt().isMac !== !1), e1 = (n) => Qb(n), n1 = ({ className: n, ...l } = {}) => ue(Lb(l), n), a1 = Zb, l1 = (n) => Jb(n), r1 = Wb, i1 = im, o1 = rm, s1 = (n) => ds[n].color, c1 = (n, l) => Tt().shortcutFor?.(n, l) ?? null, u1 = (n) => Tt().shortcutLabel?.(n) ?? null, ni = (n, l) => Tt().command(n, l ?? {}) !== !1, d1 = (n, l, i) => Tt().startSession?.(n, l, i), f1 = globalThis.perch?.pickFolder ? (n) => Tt().pickFolder(n) : null;
function re(n) {
  const l = dt.useRef(n);
  return l.current = n, dt.useSyncExternalStore(Fv, () => l.current(Tt()));
}
const gm = (n = {}) => re((l) => l.navigation({ showTerminals: !!n.showTerminals, sortByAttention: !!n.sortByAttention })), m1 = () => re((n) => n.hosts()), p1 = () => re((n) => n.sessionFolders());
function h1() {
  const n = re((l) => l.addProject?.() ?? g1);
  return {
    status: n.status ?? "idle",
    error: n.error,
    hostId: n.hostId,
    add: (l, i, o) => {
      l.trim() && n.status !== "pending" && Tt().addProjectFolder?.(l, i, o);
    },
    clear: () => Tt().clearAddProject?.()
  };
}
const g1 = Object.freeze({ status: "idle" }), bm = "perch.lastAgentChoice", b1 = Object.freeze({ connected: !1, discovery: !1, state: "ready", choices: [] }), v1 = () => {
  const n = Tt().storage?.getItem(bm);
  return n === "claude" || n === "codex" ? n : "claude";
}, y1 = Object.freeze({ items: [] });
function x1() {
  const n = re((l) => l.notifications?.() ?? y1);
  return dt.useMemo(() => ({
    items: n.items ?? [],
    open: (l) => Tt().command("notification.open", { id: l }),
    dismiss: (l) => Tt().command("notification.dismiss", { id: l })
  }), [n]);
}
function w1(n) {
  const l = re((s) => s.agentChoices?.(n) ?? b1), [i, o] = dt.useState(v1);
  return dt.useMemo(() => ({
    connected: !!l.connected,
    discovery: !!l.discovery,
    choices: l.choices ?? [],
    lastChoice: i,
    state: l.state ?? "ready",
    error: l.state === "error" ? l.error : void 0,
    rememberChoice: (s) => {
      s !== "claude" && s !== "codex" || (Tt().storage?.setItem(bm, s), o(s));
    },
    manage: () => Tt().command("agents.manage", {})
  }), [l, i]);
}
function _1(n) {
  Ie(() => Tt().onRequest?.("add-project", n) ?? void 0, [n]);
}
function S1(n) {
  const l = n.map((i) => ({ id: i.id, parentSessionId: i.parentId, session: i }));
  return yv(l).map((i) => ({ session: i.session, nested: fs(i, l) }));
}
function k1({ id: n, plain: l, className: i }) {
  const o = re((y) => y.session(n));
  if (!o) return null;
  const s = o.state ?? vv(o), d = ds[s]?.color ?? ds.unknown.color, m = o.provider, f = m === "claude" || m === "claude-agent-teams" || m === "omp", p = l ? ue("agent-mark", "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full leading-none", i) : ue("agent-status-dot", `agent-status-dot--${s}`, "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-[1.5px] bg-panel-bg leading-none", i);
  return dt.createElement(
    "span",
    { className: p, style: l ? void 0 : { borderColor: d }, "data-provider": m ?? "unknown", title: l ? m ?? "Agent" : `${m ?? "Agent"} · ${s}`, "aria-hidden": "true" },
    dt.createElement("span", { className: ue("inline-flex text-fg", f && "rounded-full bg-[#161616]") }, dt.createElement(vm, { provider: m, size: 14 }))
  );
}
function vm({ provider: n, size: l = 14 }) {
  const i = Tt().agentIcon?.(n, l) ?? null, o = i?.markup ?? '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><circle cx="8" cy="8" r="5" fill="currentColor"/></svg>';
  return dt.createElement("svg", { width: l, height: l, "aria-hidden": "true", "data-agent-icon": n ?? "unknown", "data-perch-markup": o, ...i && i.tint === !1 ? { "data-perch-image": "true" } : {} });
}
const E1 = ({ children: n }) => dt.createElement(dt.Fragment, null, n);
function z1(n, l) {
  const i = dt.useRef(l);
  return i.current = l, Ie(() => {
    const o = Tt();
    if (!o.openOverlay) throw new Error(`@perch/sdk: the host draws no overlays (perch.openOverlay), so ${n} cannot open`);
    const s = {};
    for (const [m, f] of Object.entries(i.current))
      s[m] = typeof f == "function" ? (...p) => i.current[m]?.(...p) : f;
    const d = o.openOverlay(n, s);
    return () => o.closeOverlay?.(d);
  }, [n]), null;
}
const da = (n) => function(i) {
  return z1(n, i);
}, N1 = da("session-menu"), T1 = da("new-session-menu"), C1 = da("confirm");
let ym = null;
const M1 = (n) => {
  ym = n;
};
function A1(n) {
  return dt.createElement(ym ?? C1, n);
}
function j1({ className: n = Ns, ...l }) {
  return dt.createElement(nv, { ...l, className: n });
}
let ps = null;
const O1 = (n) => {
  ps = n;
}, R1 = da("folder-browser");
function D1(n) {
  return ps ? dt.createElement(ps, { ...n, browse: (l) => Tt().browse(n.hostId, l) }) : dt.createElement(R1, n);
}
const H1 = da("instructions"), B1 = da("memory"), U1 = tv;
let Cs = null;
const q1 = (n) => {
  Cs = n;
};
function Y1(n) {
  if (Cs) return dt.createElement(K1, n);
  const { hostId: l, path: i, className: o } = n, s = dt.useRef(null);
  return dt.createElement(
    "button",
    {
      type: "button",
      ref: s,
      className: ue("worktree-menu__btn", rm, o),
      "data-testid": `worktree-menu-${l}-${i}`,
      title: "New workspace (a git worktree)",
      "aria-label": "New workspace",
      "aria-expanded": !1,
      onClick: () => Tt().openOverlay?.("worktree", { hostId: l, cwd: i, anchor: s.current?.getBoundingClientRect() })
    },
    dt.createElement(sm, null)
  );
}
const xm = "Perch did not answer.";
function Hr(n) {
  return n ? n.type === "worktree.error" ? { error: n.message, dirty: !!n.dirty } : n.error ? { error: String(n.error) } : {} : { error: xm };
}
function G1(n, l, i = Tt()) {
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
const gf = 5 * 6e4;
function wm(n, l, i, o = Tt()) {
  const s = Date.now() + gf;
  let d = !1, m = () => {
  };
  const f = () => {
    d = !0, m(), clearTimeout(y);
  }, p = () => {
    if (!d) {
      if (Date.now() >= s) return f();
      G1(n, l, o) && (f(), o.startSession?.(n, l, i));
    }
  }, y = setTimeout(f, gf);
  m = o.subscribe?.(p) ?? (() => {
  }), p();
}
function K1({ hostId: n, path: l, className: i, worktrees: o, request: s, parentChoices: d, emptyAgent: m, ...f }) {
  const [p, y] = dt.useState(o), E = (_) => !!Tt().coreCan?.(_, n), w = gm(), v = `${n}:${l}`, z = dt.useMemo(() => {
    if (Array.isArray(d)) return d;
    if (!E("workspace.nest")) return [];
    const _ = w?.projects?.find((G) => G.hostId === n && G.repoPath === l), T = [], D = (G, I) => {
      for (const tt of G ?? [])
        I && T.push({ id: tt.id, name: tt.name, path: tt.path }), D(tt.children, !0);
    };
    return D(_?.workspaces, !1), T;
  }, [d, w, n, l]), N = n === "local" && E("worktree.job"), S = f.deleteSupported ?? E("worktree.delete"), k = f.startFromSupported ?? E("worktree.startFrom"), j = re((_) => _.emptyWorkspaceAgent?.() ?? void 0), H = m ?? j ?? void 0, A = re((_) => _.worktreeMenuRequest?.() ?? null), L = A?.projectKey === v ? A.nonce : null, U = dt.useMemo(() => s ?? (L == null ? null : A), [s, L]), [R, h] = dt.useState(U);
  Ie(() => {
    U && h(U);
  }, [U]);
  const b = dt.useRef({});
  b.current = { background: N, deleteSupported: S };
  const x = dt.useMemo(() => {
    const _ = (T, D) => Tt().ask(T, { hostId: n, repoPath: l, ...D });
    return {
      list: async () => {
        const T = await _("worktree.list", {});
        return T?.type === "worktree.list.result" && y({ worktrees: T.worktrees ?? [], defaultRoot: T.defaultRoot ?? "", baseRef: T.baseRef, refs: T.refs ?? [] }), Hr(T);
      },
      create: async ({ branch: T, newBranch: D, path: G, extra: I, agent: tt }) => {
        const Q = { branch: T, newBranch: !!D, path: G ?? null, name: I?.name ?? null, startFrom: I?.startFrom ?? null, parentWorkspaceId: I?.parentWorkspaceId ?? null }, { background: Z } = b.current, $ = await _(Z ? "worktree.job.start" : "worktree.create", Q), K = Z ? "worktree.job.started" : "worktree.done";
        if ($?.type !== K) return { error: Hr($).error ?? xm };
        const V = Z ? $.job?.path : $.path;
        return tt && V && wm(n, V, tt), { background: Z };
      },
      remove: async (T, D) => {
        const G = await _("worktree.remove", { path: T, force: !!D, deleteBranch: b.current.deleteSupported });
        return { ...Hr(G), preservedBranch: G?.type === "worktree.done" ? G.preservedBranch ?? void 0 : void 0 };
      },
      deleteBranch: async (T, D) => Hr(await _("worktree.branch.delete", { branch: T, expectedHead: D })),
      open: (T) => Tt().startSession?.(n, T, "terminal"),
      // The window forgets the request; the screen keeps it until a newer one, as clearing it would re-run (and so
      // cancel) the screen's effect that a measurement put off until the next frame (`measured`).
      takeRequest: () => Tt().takeWorktreeRequest?.()
    };
  }, [n, l]);
  return dt.createElement(Cs, {
    hostId: n,
    cwd: l,
    projectKey: v,
    className: i,
    worktrees: p,
    background: N,
    startFromSupported: k,
    deleteSupported: S,
    parentChoices: z,
    emptyAgent: H,
    request: R,
    actions: x
  });
}
const Q1 = (n, l) => {
  if (!Tt().followPointer?.(n)) return;
  const i = l.items();
  for (const o of i) o.getBoundingClientRect();
  i[0]?.parentElement?.getBoundingClientRect(), Bb(n, l);
}, V1 = () => re((n) => n.workspaceTabs()), L1 = () => re((n) => n.statusLine()), X1 = () => re((n) => n.zoom()), Z1 = () => re((n) => n.paneLook()), J1 = () => re((n) => n.keybindings?.() ?? []), W1 = Object.freeze({ usage: Object.freeze([]), updatedAt: 0, spend: null, redeemResult: null });
function F1(n) {
  const l = !!n?.keepFresh, i = re((s) => s.statusLine?.().connected ?? !1), o = re((s) => s.planUsage?.() ?? W1);
  return Ie(() => {
    if (!l || !i) return;
    let s;
    const d = () => {
      Tt().command("usage.get"), s = setTimeout(d, 18e4);
    };
    return d(), () => clearTimeout(s);
  }, [l, i]), o;
}
const I1 = () => Tt().command("usage.get", { force: !0 }), $1 = (n) => Tt().command("usage.redeemReset", { accountId: n }), P1 = () => ni("app.zoom_reset"), ty = {
  focused: "bg-[color-mix(in_srgb,var(--text)_10%,var(--panel-bg))] hover:bg-[color-mix(in_srgb,var(--text)_10%,var(--panel-bg))] text-fg font-semibold",
  visible: "bg-transparent text-subtext-0 hover:bg-surface-0 hover:text-fg",
  hidden: "bg-transparent text-subtext-0 hover:bg-surface-0 hover:text-fg"
}, ey = (n, l, i) => Tt().beginTabDrag?.(n, l, i);
function ny(n) {
  Ie(() => Tt().onRequest?.("new-tab", n) ?? void 0, [n]);
}
const ay = (n) => ni("browser.open", { workspaceId: n }), ly = (n, l) => ni("file.open", { workspaceId: n, path: l }), ry = () => null, iy = () => null, oy = da("new-file"), wy = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  AgentIcon: vm,
  Chevron: dm,
  CloseIcon: $b,
  ConfirmDialog: A1,
  Dialog: U1,
  EllipsisIcon: Fb,
  FolderBrowser: D1,
  GearIcon: Ib,
  HostStateDot: Pb,
  InstructionsDialog: H1,
  MemoryDialog: B1,
  ModeSwitch: Nv,
  NewFilePrompt: oy,
  NewSessionMenu: T1,
  PageIcon: wv,
  PlusIcon: sm,
  QrCode: Hv,
  Select: j1,
  SessionDot: k1,
  SessionMenu: N1,
  SettingRow: Uv,
  SettingsGroup: Bv,
  SettingsQuery: Nl,
  Slot: E1,
  Switch: qv,
  TabDragLayer: iy,
  TabMenu: ry,
  WorktreeMenu: Y1,
  agentStateColor: s1,
  anchoredPopoverStyle: Iv,
  beginReorderDrag: Q1,
  beginTabDrag: ey,
  bindHost: Wv,
  buttonClass: a1,
  cn: ue,
  drawConfirmationsInPlace: M1,
  drawFolderBrowserInPlace: O1,
  drawWorktreeInPlace: q1,
  ghostButton: i1,
  glassClass: Xv,
  iconButton: o1,
  isMac: Pv,
  keyLabel: t1,
  menuDividerClass: r1,
  menuItemClass: l1,
  menuPanel: om,
  nestSessions: S1,
  newId: $v,
  openBrowserTab: ay,
  openFileTab: ly,
  pickFolder: f1,
  redeemUsageReset: $1,
  refreshUsage: I1,
  resetZoom: P1,
  rowActionClass: n1,
  runCommand: ni,
  segmentClass: e1,
  settingsClass: Gv,
  shortcutFor: c1,
  shortcutLabel: u1,
  startPaneWhenReady: wm,
  startSession: d1,
  tabStateClass: ty,
  tapButtonClass: Zv,
  useAddProject: h1,
  useAddProjectRequest: _1,
  useAgentChoices: w1,
  useDismissOnOutsideClick: fm,
  useHostSnapshot: re,
  useHosts: m1,
  useKeybindings: J1,
  useNavigation: gm,
  useNewTabRequest: ny,
  useNotifications: x1,
  usePaneLook: Z1,
  usePlanUsage: F1,
  useResourceState: Lv,
  useSessionFolders: p1,
  useSettingsQuery: Yv,
  useStatusLine: L1,
  useWorkspaceTabs: V1,
  useZoom: X1,
  version: Jv
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
//! `kit` is `{ div, image }` from `gpui-kit`; `files.engine(engine, key)` gives the host's native element for an
//! engine slot (`perch-engine`); `files.icon(id, markup, color)` gives the element that draws an icon's
//! markup (`currentColor` as `color`; the mod's `perch-react` `Icon`), as gpui-kit's `svg()` and `image()` read
//! files through an asset source the host may not have. An icon is drawn once per colour it is described with; one
//! under a node whose own `hover:` changes the text colour is drawn twice, the hover copy shown by the engine while the
//! pointer is over that node (a hover group), so a hover never calls back into the script.
const Ms = {
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
  Ms[n] = (l, i) => l[n](i);
const _y = Object.keys(Ms);
function Fo(n, l) {
  for (const [i, o] of Object.entries(l)) {
    const s = Ms[i];
    if (!s) throw new Error(`the description key ${i} has no GPUI builder`);
    o != null && (n = s(n, o));
  }
  return n;
}
const qn = (n) => ({ clientX: n?.position?.x ?? 0, clientY: n?.position?.y ?? 0 }), bf = /* @__PURE__ */ new WeakSet(), Io = /* @__PURE__ */ new WeakSet();
function vf(n, l, i) {
  const o = n.pressed, s = qn(i);
  return o && o.x === s.clientX && o.y === s.clientY ? o.id : l;
}
function sy(n, l, i) {
  if (n.name) return n.name;
  if (!(l.size || n.hover || n.focus || n.active || n.track_hover && Fr.has(n.group) || i)) return null;
  const o = n.meta?.attrs["data-testid"];
  return o ? `~${n.id}:${o}` : `~${n.id}`;
}
const _m = (n, l = !1) => (n.children ?? []).some((i) => i.kind === "text" ? !l || /\s/.test(String(i.text ?? "").trim()) : i.kind === "div" && i.style?.flex_direction !== "row" && i.style?.whitespace !== "nowrap" && _m(i, !0)), Ne = (n) => n.style?.display !== "hidden";
let Fr = /* @__PURE__ */ new Set();
function Sm(n, l = /* @__PURE__ */ new Set()) {
  for (const { group: i, style: o } of n.group_hover ?? []) "display" in o && l.add(i);
  for (const i of n.children ?? []) i.kind !== "text" && Sm(i, l);
  return l;
}
function hs(n, l, i, o, s = !1, d = !1, m = null, f = {}, p = !1, y = /* @__PURE__ */ new Map(), E = null) {
  if (n.kind === "text") return y.get(n)?.text ?? n.text;
  const w = bf.has(n);
  d ||= n.style.opacity === 0 || n.style.visibility === "invisible" || n.style.display === "hidden", d && (n.name || n.range_name) && (n = { ...n, name: void 0, range_name: void 0, also: void 0 }), n.style.text_color !== void 0 && (E = null), m = n.style.text_color ?? m;
  const v = !!n.hover?.text_color && Nm(n), z = n.group ?? (v ? `~g${n.id}` : null);
  v && (E = { group: z, color: n.hover.text_color }), f = { ...f };
  for (const _ of ["text_size", "line_height", "whitespace", "text_ellipsis"]) n.style[_] !== void 0 && (f[_] = n.style[_]);
  const N = new Set(n.events ?? []);
  let S;
  if (n.kind === "image" && !n.markup ? S = l.image(n.src) : S = l.div(), n.kind === "engine" && (S = S.child(o.engine ? o.engine(n.engine, n.key) : l.div())), n.markup && n.kind === "svg" && E && E.color !== m) {
    const { group: _, color: T } = E, D = () => l.div().absolute().top(0).left(0).size_full();
    S = S.child(D().group_hover(_, (G) => G.invisible()).child(o.icon(`~icon-${n.id}`, n.markup, m))).child(D().invisible().group_hover(_, (G) => G.visible()).child(o.icon(`~icon-${n.id}-hover`, n.markup, T)));
  } else n.markup && (S = S.child(o.icon(`~icon-${n.id}`, n.markup, n.kind === "svg" ? m : "")));
  const k = sy(n, N, s);
  if (k && (S = S.id(k)), n.measure && (S = S.measure(n.measure)), n.name && S.also_named) for (const _ of n.also ?? []) S = S.also_named(_);
  S = Fo(S, { ...n.style, ...y.get(n) });
  const j = f.whitespace !== "nowrap" && !f.text_ellipsis;
  p && j && n.style.flex_shrink !== 0 && n.style.min_w === void 0 && _m(n) && (S = S.min_w(0));
  for (const _ of ["hover", "focus", "active"]) n[_] && (S = S[_]((T) => Fo(T, n[_])));
  z && (S = S.group(z));
  for (const { group: _, style: T } of n.group_hover ?? []) {
    const { display: D, ...G } = T;
    Object.keys(G).length && (S = S.group_hover(_, (I) => Fo(I, G)));
  }
  if (l.scroll && (n.style.overflow_x === "scroll" || n.style.overflow_y === "scroll")) {
    const _ = i.document?.scrollTarget, T = _ ? (n.children ?? []).filter(Ne).findIndex((D) => zm(D, _.id)) : -1;
    if (T >= 0 && (i.scroller ?? n.id) === n.id && (i.document.scrollTarget = null, i.scroller = n.id, l.scroll.scroll_to_item(T)), i.scroller ??= n.id, i.scroller === n.id && i.document) {
      S = S.track_scroll(l.scroll);
      const D = (n.children ?? []).filter(Ne).map((G) => G.id);
      i.document.itemBounds = (G) => D.includes(G) ? l.scroll.item_bounds?.(D.indexOf(G)) ?? null : null;
    }
  }
  const H = n.style.overflow_x === "scroll" || n.style.overflow_y === "scroll", A = s && !n.pointer_none || n.blocks_pointer;
  if ((H && Io.has(n) || A) && (S = S.on_scroll_wheel((_, T) => T.stop_propagation?.())), H || Io.has(n)) for (const _ of n.children ?? []) _.kind !== "text" && Io.add(_);
  n.kind === "input" && !n.disabled && (S = S.on_mouse_down("left", (_, T) => {
    _.bounds && i.setBounds(n.id, _.bounds), i.focus(n.id), T.notify();
  }));
  const L = n.kind === "input" ? n : n.meta?.tag === "label" ? Em(n) : null;
  L && !L.disabled && /^(checkbox|radio)$/.test(L.input_type) && (S = S.on_click((_, T) => {
    T.stop_propagation?.(), i.toggle(L.id), T.notify();
  }));
  const U = ["click", "double_click", "context_menu", "mouse_down", "mouse_up"].some((_) => N.has(_));
  if (U || w) for (const _ of n.children ?? []) _.kind !== "text" && bf.add(_);
  if (U && (S = S.on_mouse_down("left", (_, T) => {
    T.stop_propagation?.(), _.bounds && i.setBounds(n.id, _.bounds);
    const D = { ...qn(_), button: 0, buttons: 1, detail: _.click_count }, G = vf(i, n.id, _);
    i.pressed = null, i.dispatch(G, "pointerdown", { ...D, pointerType: "mouse" }), i.dispatch(G, "mousedown", D) && i.pressFocus?.(G), T.notify();
  }), S = S.on_mouse_down("right", (_, T) => {
    T.stop_propagation?.(), _.bounds && i.setBounds(n.id, _.bounds);
    const D = vf(i, n.id, _);
    i.pressed = null, i.dispatch(D, "contextmenu", { ...qn(_), button: 2 }), T.notify();
  }), S = S.on_mouse_up("left", (_, T) => {
    T.stop_propagation?.();
    const D = { ...qn(_), button: 0 };
    i.dispatch(n.id, "pointerup", { ...D, pointerType: "mouse" }), i.dispatch(n.id, "mouseup", D), T.notify();
  }), S = S.on_click((_, T) => {
    i.dispatch(n.id, _.click_count === 2 && N.has("double_click") ? "dblclick" : "click", { detail: _.click_count, button: 0 }), T.notify();
  })), n.blocks_pointer && !U)
    for (const _ of ["left", "right"]) S = S.on_mouse_down(_, (T, D) => D.stop_propagation?.());
  else if (w && !U)
    for (const _ of ["left", "right"])
      S = S.on_mouse_down(_, (T) => {
        const D = qn(T);
        (i.pressed?.x !== D.clientX || i.pressed?.y !== D.clientY) && (i.pressed = { id: n.id, x: D.clientX, y: D.clientY });
      });
  if (N.has("mouse_move") && (S = S.on_mouse_move((_) => {
    i.dispatch(n.id, "pointermove", { ...qn(_), pointerType: "mouse" });
  })), n.track_hover && Fr.has(n.group) && (S = S.on_hover((_, T) => {
    i.hover(n.id, _), T.notify();
  })), s && (S = S.on_mouse_down_out((_, T) => {
    i.dispatch(i.document.body.id, "pointerdown", { ...qn(_), pointerType: "mouse" }), i.dispatch(i.document.body.id, "mousedown", qn(_)), T.notify();
  })), n.kind === "input" && !/^(checkbox|radio|range|color|file|select)$/.test(n.input_type)) {
    const _ = n.value ? String(n.value) : String(n.placeholder ?? "");
    let T = l.div().whitespace_nowrap().overflow_x_hidden();
    const D = ca(f);
    D && (T = T.h(D)), !n.value && m && (T = T.text_color(uy(m))), _ && (S = S.child(T.child(n.input_type === "password" && n.value ? "•".repeat([..._].length) : _))), n.field_w && (S = S.child(l.div().w(n.field_w).h(0)));
  }
  const R = f.whitespace === "nowrap" ? ca(f) : null, h = n.style.display === "flex" && !String(n.style.flex_direction ?? "row").startsWith("col");
  let b = !n.range_name;
  const x = n.style.display === "flex" && String(n.style.flex_direction ?? "row").startsWith("col") && (n.style.h === void 0 || n.style.h === "auto") && typeof n.style.max_h == "number";
  for (const _ of (n.children ?? []).filter(Ne)) {
    const T = _.style?.flex_basis;
    x && _.style.flex_grow > 0 && (T === 0 || typeof T == "string" && T.endsWith("%")) && y.set(_, { ...y.get(_), flex_basis: "auto" });
    let D = hs(_, l, i, o, !1, d, m, f, h && _.style?.position !== "absolute", y, E);
    const G = !b && (_.kind === "text" || !_.meta), I = _.kind === "text" ? y.get(_)?.h ?? R : null, tt = _.kind === "text" ? y.get(_)?.w : void 0;
    if (G || I || tt !== void 0) {
      let Q = l.div();
      G && (Q = Q.id(n.range_name)), G && !h && n.style.display === "flex" && (Q = Q[`self_${cy[f.text_align] ?? "start"}`]().max_w("100%")), I && (Q = Q.h(I)), tt !== void 0 && (Q = Q.w(tt).flex_none().whitespace_nowrap()), D = Q.child(D), b ||= G;
    }
    S = S.child(D);
  }
  return S;
}
const cy = { center: "center", right: "end", end: "end" };
function uy(n) {
  const l = String(n);
  if (!/^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(l)) return n;
  const i = l.length === 9 ? Number.parseInt(l.slice(7), 16) : 255;
  return `${l.slice(0, 7)}${Math.round(i / 2).toString(16).padStart(2, "0")}`;
}
const km = /^(?:[!-,.-~]+|\S)$/u, Em = (n) => {
  for (const l of n.children ?? []) {
    if (l.kind === "input" && /^(checkbox|radio)$/.test(l.input_type)) return l;
    const i = l.kind === "text" ? null : Em(l);
    if (i) return i;
  }
  return null;
}, zm = (n, l) => n.id === l || (n.children ?? []).some((i) => i.kind !== "text" && zm(i, l)), Nm = (n) => !!n.markup || (n.children ?? []).some((l) => l.kind !== "text" && Nm(l));
function ca(n) {
  const l = n.line_height;
  return typeof l == "string" && l.endsWith("px") ? Number.parseFloat(l) : typeof l == "number" && typeof n.text_size == "number" ? l * n.text_size : null;
}
function Sy(n, l, i, o, s = 0, d = !1) {
  const m = [n.root, ...n.overlays];
  Fr = /* @__PURE__ */ new Set();
  for (const E of m) Sm(E, Fr);
  const f = s > 0 ? by(m, s) : /* @__PURE__ */ new Map();
  s > 0 && o.measure && dy(m, s, o.measure, f), hy(m, f), py(m, f), o.measure && my(m, o.measure, f);
  let p = l.div().relative().size_full().child(hs(n.root, l, i, o, !1, !1, null, {}, !1, f)), y = d && n.overlays.length ? l.div().relative().size_full().window_layer() : p;
  for (const E of n.overlays) y = y.child(hs(E, l, i, o, !0, !1, null, {}, !1, f));
  return y === p ? p : p.child(y);
}
function dy(n, l, i, o) {
  const s = (N, S) => o.set(N, { ...o.get(N), ...S }), d = /* @__PURE__ */ new Map(), m = /* @__PURE__ */ new Map(), f = ["text_size", "font_weight", "font_family", "italic", "whitespace", "text_ellipsis"];
  function p(N, S, k) {
    if (N.kind === "text") {
      if (!(S.whitespace === "nowrap" || km.test(N.text)) || S.text_ellipsis || k || typeof S.text_size != "number") return NaN;
      const h = i(N.text, { size: S.text_size, weight: S.font_weight ?? 400, family: S.font_family ?? ".SystemUIFont", italic: !!S.italic });
      return Number.isFinite(h) ? h : NaN;
    }
    if (!Ne(N) || N.kind === "input" || N.kind === "engine" || N.markup) return y(N);
    const j = { ...S };
    for (const R of f) N.style[R] !== void 0 && (j[R] = N.style[R]);
    j.text_ellipsis = !!N.style.text_ellipsis, m.set(N, j);
    const H = N.style, A = (N.children ?? []).filter(Ge), L = A.map((R) => p(R, j, k || !!N.tabular));
    let U = y(N);
    if (!Number.isFinite(U) && H.w === void 0) {
      const R = A.map((b, x) => L[x] + (b.kind === "text" ? 0 : rt(b.style.ml) + rt(b.style.mr)));
      let h;
      A.length ? Oe(N) ? h = A.some((b) => b.kind !== "text" && b.style.flex_grow > 0) || H.flex_wrap === "wrap" ? NaN : R.reduce((b, x) => b + x, 0) + rt(H.gap_x) * (A.length - 1) : h = Math.max(...R) : h = 0, U = h + rt(H.pl) + rt(H.pr) + rt(H.border_l) + rt(H.border_r), typeof H.min_w == "number" && (U = Math.max(U, H.min_w)), typeof H.max_w == "number" && (U = Math.min(U, H.max_w));
    }
    return d.set(N, U), U;
  }
  const y = (N) => typeof N.style?.w == "number" ? N.style.w : NaN, E = () => ({ exact: 0, laid: 0 }), w = (N, S) => {
    if (!Number.isFinite(S))
      return Object.assign(N, E()), NaN;
    N.exact += S;
    const k = Math.round(N.exact * l + 1e-9) / l, j = k - N.laid;
    return N.laid = k, j;
  }, v = (N) => Oe(N) && N.style.flex_wrap !== "wrap" && (N.style.justify ?? "start") === "start";
  function z(N) {
    if (!N || N.kind === "text" || !Ne(N)) return;
    const S = (N.children ?? []).filter(Ge);
    if (v(N) && S.length > 1) {
      const k = rt(N.style.gap_x), j = E(), H = !(k && S.some((A) => A.kind === "text" || !Number.isFinite(rt(A.style.ml))));
      s(N, { border_l: w(j, rt(N.style.border_l)), pl: w(j, rt(N.style.pl)) }), H && k && s(N, { gap_x: 0 }), S.forEach((A, L) => {
        const U = (L && H ? k : 0) + (A.kind === "text" ? 0 : rt(A.style.ml));
        if (A.kind === "text")
          U && Object.assign(j, E());
        else {
          const x = w(j, U);
          Number.isFinite(x) && s(A, { ml: x });
        }
        const R = A.kind === "text" ? m.get(N) ?? {} : null, h = A.kind === "text" ? p(A, R, !!N.tabular) : d.get(A);
        if ((A.kind === "text" || !(A.style.flex_grow > 0)) && Number.isFinite(h)) {
          const x = { w: w(j, h) };
          A.kind !== "text" && typeof A.style.w != "number" && A.style.min_w === void 0 && (x.whitespace = "nowrap", x.flex_shrink = 0), s(A, x);
        } else Object.assign(j, E());
        if (A.kind !== "text") {
          const x = w(j, rt(A.style.mr));
          Number.isFinite(x) && s(A, { mr: x });
        }
      });
    }
    for (const k of N.children ?? []) k.kind !== "text" && z(k);
  }
  for (const N of n)
    N && (p(N, {}, !1), z(N));
}
const fy = /(?<= +)(?=[^ ])|(?<=[\p{L}\p{N}]-)(?=[\p{L}\p{N}])/u;
function my(n, l, i) {
  const o = ["text_size", "font_weight", "font_family", "italic", "line_height"], s = (f) => typeof f == "number" ? f : 0, d = (f, p) => p && Ir(p) && !Oe(p) && f.style.position !== "absolute" && !["start", "center", "end"].includes(f.style.self) && !["start", "center", "end"].includes(p.style.items), m = (f, p, y, E) => {
    if (!f || f.kind === "text" || !Ne(f)) return;
    const w = f.style;
    let v = typeof w.w == "number" ? w.w : w.w === "100%" ? y : d(f, p) ? y - s(w.ml) - s(w.mr) : NaN;
    typeof w.max_w == "number" && (v = Math.min(v, w.max_w));
    const z = v - s(w.pl) - s(w.pr) - s(w.border_l) - s(w.border_r), N = { ...E };
    for (const k of o) w[k] !== void 0 && (N[k] = w[k]);
    const S = f.children ?? [];
    if (f.break_anywhere && Number.isFinite(z) && z > 0 && typeof N.text_size == "number" && S.length && S.every((k) => k.kind === "text")) {
      const k = { size: N.text_size, weight: N.font_weight ?? 400, family: N.font_family ?? ".SystemUIFont", italic: !!N.italic }, j = (L) => l(L.trimEnd(), k) <= z + 0.01;
      let H = 0;
      for (const L of S) {
        const U = [];
        for (const h of L.text.split(`
`)) {
          let b = "";
          for (const x of h.split(fy)) {
            if (j(b + x)) {
              b += x;
              continue;
            }
            b && U.push(b.trimEnd()), b = "";
            for (const _ of x)
              b && !j(b + _) && (U.push(b), b = ""), b += _;
          }
          U.push(b.trimEnd());
        }
        const R = U.join(`
`);
        U.every((h) => !h || j(h)) ? R !== L.text && i.set(L, { ...i.get(L), text: R }) : H = NaN, H += U.length;
      }
      const A = ca(N);
      Number.isFinite(H) && A && w.h === void 0 && S.length === 1 && i.set(f, { ...i.get(f), h: H * A + s(w.pt) + s(w.pb) + s(w.border_t) + s(w.border_b) });
    }
    for (const k of S) m(k, f, Oe(f) ? NaN : z, N);
  };
  for (const f of n) m(f, null, NaN, {});
}
function py(n, l) {
  const i = (o, s) => {
    if (!o || o.kind === "text" || !Ne(o)) return;
    const d = o.style, m = d.position === "absolute" ? d.w === void 0 && (d.left === void 0 || d.right === void 0) : s && typeof d.w != "number";
    if (m && Oe(o))
      for (const f of o.children ?? []) {
        const p = f.kind === "text" ? void 0 : f.style.flex_basis;
        f.kind !== "text" && f.style.flex_grow > 0 && (p === 0 || typeof p == "string" && p.endsWith("%")) && l.set(f, { ...l.get(f), flex_basis: "auto" });
      }
    for (const f of o.children ?? []) i(f, m);
  };
  for (const o of n) i(o, !1);
}
function hy(n, l) {
  const i = l.heights ?? /* @__PURE__ */ new Map(), o = (p) => i.get(p), s = (p) => {
    const y = o(p);
    if (Number.isFinite(y)) return y;
    if (p.kind === "text" || !Ne(p)) return 0;
    const E = p.style, w = typeof E.min_h == "number" ? E.min_h : 0, v = (p.children ?? []).filter(Ge), z = v.map((k) => s(k) + (k.kind === "text" ? 0 : Math.max(0, rt(k.style.mt) || 0) + Math.max(0, rt(k.style.mb) || 0))), N = v.length ? Oe(p) ? Math.max(...z) : z.reduce((k, j) => k + j, 0) + (E.display === "flex" ? (rt(E.gap_y) || 0) * (v.length - 1) : 0) : 0, S = [E.pt, E.pb, E.border_t, E.border_b].reduce((k, j) => k + (rt(j) || 0), 0);
    return Math.max(w, N + S);
  }, d = (p) => !(p.children ?? []).filter(Ge).length || Oe(p) ? NaN : s({ ...p, style: { ...p.style, h: void 0, max_h: void 0, min_h: void 0 } }), m = (p, y) => {
    const E = p.style;
    if (typeof E.h == "number") return E.h;
    if (typeof E.max_h == "number") return E.max_h;
    if (!y || !Ir(y) || Oe(y)) return NaN;
    const w = y.style, v = typeof w.h == "number" ? w.h : typeof w.max_h == "number" ? w.max_h : NaN, z = (y.children ?? []).filter(Ge);
    let N = 0;
    for (const k of z) {
      if (k === p) continue;
      const j = o(k);
      if (!Number.isFinite(j)) return NaN;
      N += j + (k.kind === "text" ? 0 : rt(k.style.mt) + rt(k.style.mb));
    }
    const S = w.display === "flex" ? rt(w.gap_y) * Math.max(0, z.length - 1) : 0;
    return v - rt(w.pt) - rt(w.pb) - rt(w.border_t) - rt(w.border_b) - N - S - rt(E.mt) - rt(E.mb);
  }, f = (p, y) => {
    if (!(!p || p.kind === "text" || !Ne(p))) {
      if (p.scrollbar > 0 && p.style.overflow_y === "scroll") {
        const E = d(p), w = m(p, y);
        Number.isFinite(E) && Number.isFinite(w) && E > w + 0.01 && l.set(p, { ...l.get(p), pr: rt(p.style.pr) + p.scrollbar });
      }
      for (const E of p.children ?? []) f(E, p);
    }
  };
  for (const p of n) f(p, null);
}
const gy = ["text_size", "line_height", "whitespace", "text_ellipsis"], rt = (n) => n == null ? 0 : typeof n == "number" ? n : NaN, Ir = (n) => n.style.display === "flex" ? n.style.flex_direction === "col" : !0, Oe = (n) => n.style.display === "flex" && (n.style.flex_direction ?? "row") === "row", Ge = (n) => n.kind === "text" || Ne(n) && n.style.position !== "absolute";
function by(n, l) {
  const i = /* @__PURE__ */ new Map(), o = (S, k) => i.set(S, { ...i.get(S), ...Object.fromEntries(Object.entries(k).filter(([, j]) => Number.isFinite(j))) }), s = /* @__PURE__ */ new Map(), d = /* @__PURE__ */ new Map();
  function m(S, k) {
    if (S.kind === "text") return k.whitespace === "nowrap" || km.test(S.text) ? ca(k) ?? NaN : NaN;
    const j = { ...k };
    for (const R of gy) S.style[R] !== void 0 && (j[R] = S.style[R]);
    d.set(S, j);
    const H = S.style, A = (S.children ?? []).filter(Ge), L = A.map((R) => m(R, j));
    let U;
    if (H.h !== void 0 && H.h !== "auto") U = rt(H.h);
    else if (S.kind === "engine") U = NaN;
    else if (S.kind === "input")
      U = (S.input_type === "textarea" || S.input_type === "select" ? NaN : ca(j) ?? NaN) + rt(H.pt) + rt(H.pb) + rt(H.border_t) + rt(H.border_b), H.min_h !== void 0 && (U = Math.max(U, rt(H.min_h)));
    else {
      const R = A.map((b, x) => (b.kind === "text" ? 0 : rt(b.style.mt) + rt(b.style.mb)) + L[x]);
      let h;
      if (Oe(S)) h = H.flex_wrap === "wrap" ? NaN : H.items === "baseline" ? p(A, L, j) : Math.max(0, ...R);
      else if (Ir(S)) {
        const b = A.some((_) => _.kind !== "text" && (_.style.flex_grow > 0 || _.style.flex_basis !== void 0)), x = H.display !== "flex" && A.some((_) => _.kind !== "text" && (rt(_.style.mt) || rt(_.style.mb)));
        h = b || x ? NaN : R.reduce((_, T) => _ + T, 0) + (H.display === "flex" ? rt(H.gap_y) * Math.max(0, A.length - 1) : 0);
      } else h = NaN;
      U = h + rt(H.pt) + rt(H.pb) + rt(H.border_t) + rt(H.border_b), H.min_h !== void 0 && (U = Math.max(U, rt(H.min_h))), H.max_h !== void 0 && (U = Math.min(U, rt(H.max_h)));
    }
    return s.set(S, U), U;
  }
  const f = (S) => (ca(S) - (Xr + Uf) * S.text_size) / 2 + Xr * S.text_size;
  function p(S, k, j) {
    let H = 0, A = 0;
    for (const [L, U] of S.entries()) {
      const R = U.kind === "text" ? j : d.get(U);
      if (!(U.kind === "text" || (U.children ?? []).filter(Ge).every((_) => _.kind === "text")) || !Number.isFinite(k[L]) || typeof R.text_size != "number") return NaN;
      const b = U.kind === "text" ? {} : U.style, x = rt(b.mt) + rt(b.border_t) + rt(b.pt) + f(R);
      H = Math.max(H, x), A = Math.max(A, rt(b.mt) + k[L] + rt(b.mb) - x);
    }
    return H + A;
  }
  const y = () => ({ exact: 0, laid: 0 }), E = (S, k) => {
    if (!Number.isFinite(k))
      return Object.assign(S, y()), NaN;
    S.exact += k;
    const j = Math.round(S.exact * l + 1e-9) / l, H = j - S.laid;
    return S.laid = j, H;
  };
  function w(S) {
    if (!(S.kind === "text" || !Ne(S))) {
      for (const k of (S.children ?? []).filter((j) => j.kind !== "text" && Ne(j) && j.style.position === "absolute")) w(k);
      if (Ir(S) && !Oe(S)) {
        const k = y();
        o(S, { border_t: E(k, rt(S.style.border_t)), pt: E(k, rt(S.style.pt)) }), v(S, k);
      } else for (const k of (S.children ?? []).filter(Ge)) k.kind !== "text" && w(k);
    }
  }
  function v(S, k) {
    const j = (S.children ?? []).filter(Ge), H = S.style.display === "flex" ? rt(S.style.gap_y) : 0;
    if (H && j.some((A) => A.kind === "text")) {
      for (const A of j) A.kind !== "text" && w(A);
      return !1;
    }
    return H && o(S, { gap_y: 0 }), j.forEach((A, L) => {
      if (A.kind === "text") {
        const U = s.get(A) ?? m(A, d.get(S) ?? {});
        Number.isFinite(U) ? o(A, { h: E(k, U) }) : Object.assign(k, y());
        return;
      }
      if (o(A, { mt: E(k, (L ? H : 0) + rt(A.style.mt)) }), Number.isFinite(s.get(A))) N(A, k);
      else if (z(A)) {
        const U = A.style;
        o(A, { border_t: E(k, rt(U.border_t)), pt: E(k, rt(U.pt)) }), o(A, { pb: E(k, rt(U.pb)), border_b: E(k, rt(U.border_b)) });
      } else
        w(A), Object.assign(k, y());
      o(A, { mb: E(k, rt(A.style.mb)) });
    }), !0;
  }
  function z(S) {
    const k = S.style, j = (S.children ?? []).filter(Ge), H = ca(d.get(S) ?? {});
    return S.kind === "div" && !Oe(S) && j.length > 0 && j.every((A) => A.kind === "text") && Number.isInteger(H) && [k.h, k.min_h, k.max_h].every((A) => A === void 0 || A === "auto");
  }
  function N(S, k) {
    const j = S.style;
    for (const R of (S.children ?? []).filter((h) => h.kind !== "text" && Ne(h) && h.style.position === "absolute")) w(R);
    const H = k.laid, A = k.exact;
    o(S, { border_t: E(k, rt(j.border_t)), pt: E(k, rt(j.pt)) });
    const L = j.h !== void 0 && j.h !== "auto", U = s.get(S) - rt(j.pt) - rt(j.pb) - rt(j.border_t) - rt(j.border_b);
    if (S.kind === "input")
      L || E(k, U);
    else if (Oe(S) || L && (j.justify ?? "start") !== "start") {
      for (const R of (S.children ?? []).filter(Ge)) R.kind !== "text" && w(R);
      L || E(k, U);
    } else !v(S, k) && !L && E(k, U);
    if (L) {
      k.exact = A + s.get(S), k.laid = Math.round(k.exact * l + 1e-9) / l, o(S, { h: k.laid - H });
      return;
    }
    o(S, { pb: E(k, rt(j.pb)), border_b: E(k, rt(j.border_b)) }), o(S, { h: k.laid - H });
  }
  for (const S of n)
    m(S, {}), w(S);
  return Object.defineProperty(i, "heights", { value: s }), i;
}
const ky = { sidebar: [{ name: "sidebar-root", selector: "aside.sidebar" }, { name: "sidebar-content", selector: "aside.sidebar > div:first-child" }, { name: "host-switcher", selector: '[data-testid="host-switcher"]' }, { name: "host-chip", selector: '[data-testid="host-switcher"] > div' }, { name: "host-badge", selector: ".sidebar__env-badge" }, { name: "host-name", selector: ".sidebar__env-host" }, { name: "host-meta", selector: '[data-testid="host-switcher"] > div > div:first-child > span:nth-child(3)' }, { name: "host-line", selector: ".sidebar__env-cwd" }, { name: "host-caret", selector: '[data-testid="host-switcher"] > span[aria-hidden="true"]' }, { name: "new-session-button", selector: 'button[data-testid^="new-session-"]', key: { self: !0, attr: "data-testid", strip: "new-session-" } }, { name: "new-session-icon", selector: 'button[data-testid^="new-session-"] > svg' }, { name: "new-session-label", selector: 'button[data-testid^="new-session-"]', textRange: !0 }, { name: "new-session-shortcut", selector: 'button[data-testid^="new-session-"] > span' }, { name: "overview", selector: '[data-testid="workspace-overview"]' }, { name: "overview-header", selector: '[data-testid="workspace-overview"] > div:first-child' }, { name: "overview-title", selector: '[data-testid="workspace-overview"] > div:first-child > div:first-child > span:first-child' }, { name: "needs-you-button", selector: '[data-testid="workspace-needs-you"]' }, { name: "organize-button", selector: '[data-testid="workspace-organize"]' }, { name: "organize-icon", selector: '[data-testid="workspace-organize"] > svg' }, { name: "add-project-button", selector: '[data-testid="workspace-add-project"]' }, { name: "add-project-icon", selector: '[data-testid="workspace-add-project"] > svg' }, { name: "add-project-label", selector: '[data-testid="workspace-add-project"]', textRange: !0 }, { name: "project-list", selector: '[data-testid="project-list"]' }, { name: "project", selector: ".workspace-project", key: { self: !0, attr: "data-testid", strip: "workspace-project-" } }, { name: "project-header", selector: ".workspace-project > div:first-child", key: { closest: ".workspace-project", attr: "data-testid", strip: "workspace-project-" } }, { name: "project-toggle", selector: '[data-testid^="project-toggle-"]', key: { self: !0, attr: "data-testid", strip: "project-toggle-" } }, { name: "project-chevron", selector: '[data-testid^="project-toggle-"] > svg:not([data-testid])', key: { closest: '[data-testid^="project-toggle-"]', attr: "data-testid", strip: "project-toggle-" } }, { name: "project-folder-icon", selector: '[data-testid="project-folder-icon"]', key: { closest: '[data-testid^="project-toggle-"]', attr: "data-testid", strip: "project-toggle-" } }, { name: "project-name", selector: '[data-testid^="project-toggle-"] strong', key: { closest: '[data-testid^="project-toggle-"]', attr: "data-testid", strip: "project-toggle-" } }, { name: "project-branch", selector: '[data-testid^="project-toggle-"] > span.whitespace-nowrap', key: { closest: '[data-testid^="project-toggle-"]', attr: "data-testid", strip: "project-toggle-" } }, { name: "project-dirty-mark", selector: '[data-testid^="project-toggle-"] > span[title="Uncommitted changes"]', key: { closest: '[data-testid^="project-toggle-"]', attr: "data-testid", strip: "project-toggle-" } }, { name: "project-rollup", selector: '[data-testid^="project-rollup-"]', key: { self: !0, attr: "data-testid", strip: "project-rollup-" } }, { name: "project-rollup-badge", selector: '[data-testid^="project-rollup-"] > span', key: { closest: '[data-testid^="project-rollup-"]', attr: "data-testid", strip: "project-rollup-" } }, { name: "project-menu-button", selector: '[data-testid^="workspace-project-menu-"]', key: { self: !0, attr: "data-testid", strip: "workspace-project-menu-" } }, { name: "project-add-button", selector: ".workspace-project > div:first-child .worktree-menu__btn", key: { closest: ".workspace-project", attr: "data-testid", strip: "workspace-project-" } }, { name: "project-workspaces", selector: ".workspace-project__workspaces", key: { closest: ".workspace-project", attr: "data-testid", strip: "workspace-project-" } }, { name: "workspace", selector: '[data-testid="workspace-tree-root"] [data-testid^="workspace-entry-"]', key: { self: !0, attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-button", selector: '[data-testid="workspace-tree-root"] button.workspace-entry__button', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-icon", selector: '[data-testid="workspace-tree-root"] [data-testid="workspace-checkout-icon"]', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-name", selector: '[data-testid="workspace-tree-root"] strong[title="Double-click to rename"]', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-branch", selector: '[data-testid="workspace-tree-root"] button.workspace-entry__button > span.items-baseline > span', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-dirty-mark", selector: '[data-testid="workspace-tree-root"] button.workspace-entry__button > span[title="Uncommitted changes"]', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-pinned-label", selector: '[data-testid="workspace-tree-root"] button.workspace-entry__button > span.shrink-0:not([title])', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "hidden-worktrees-button", selector: '[data-testid^="workspace-hidden-"]', key: { self: !0, attr: "data-testid", strip: "workspace-hidden-" } }, { name: "session-row", selector: 'div[class~="group/row"]', key: { find: 'button[data-testid^="workspace-session-"]:not([data-testid^="workspace-session-close-"])', attr: "data-testid", strip: "workspace-session-" } }, { name: "session-button", selector: 'button[data-testid^="workspace-session-"]:not([data-testid^="workspace-session-close-"])', key: { self: !0, attr: "data-testid", strip: "workspace-session-" } }, { name: "session-mark", selector: ".agent-mark", key: { closest: 'button[data-testid^="workspace-session-"]', attr: "data-testid", strip: "workspace-session-" } }, { name: "session-mark-icon", selector: ".agent-mark > span > *", key: { closest: 'button[data-testid^="workspace-session-"]', attr: "data-testid", strip: "workspace-session-" } }, { name: "session-title", selector: 'button[data-testid^="workspace-session-"] > span.whitespace-nowrap', key: { closest: 'button[data-testid^="workspace-session-"]', attr: "data-testid", strip: "workspace-session-" } }, { name: "status-row-title", selector: "button[data-session] span.truncate:not([data-testid])", key: { closest: 'button[data-testid^="workspace-session-"]', attr: "data-testid", strip: "workspace-session-" } }, { name: "status-row-detail", selector: '[data-testid="status-row-detail"]', key: { closest: 'button[data-testid^="workspace-session-"]', attr: "data-testid", strip: "workspace-session-" } }, { name: "session-state-badge", selector: '[data-testid^="session-state-"]', key: { self: !0, attr: "data-testid", strip: "session-state-" } }, { name: "session-menu-button", selector: '[data-testid^="session-menu-button-"]', key: { self: !0, attr: "data-testid", strip: "session-menu-button-" } }, { name: "session-fold-button", selector: '[data-testid^="session-fold-"]', key: { self: !0, attr: "data-testid", strip: "session-fold-" } }, { name: "session-elbow", selector: '[data-testid^="session-elbow-"]', key: { self: !0, attr: "data-testid", strip: "session-elbow-" } }, { name: "session-rollup", selector: '[data-testid^="session-rollup-"]', key: { self: !0, attr: "data-testid", strip: "session-rollup-" } }, { name: "chats", selector: '[data-testid="workspace-chats"]' }, { name: "chats-header", selector: '[data-testid="workspace-chats"] > div:first-child' }, { name: "chats-toggle", selector: '[data-testid="workspace-chats-collapse"]' }, { name: "chats-label", selector: '[data-testid="workspace-chats-collapse"]', textRange: !0 }, { name: "chats-chevron", selector: '[data-testid="workspace-chats-collapse"] > svg' }, { name: "chats-menu-button", selector: '[data-testid="workspace-chats-menu"]' }, { name: "chats-new-button", selector: '[data-testid="workspace-chats-new"]' }, { name: "chats-new-icon", selector: '[data-testid="workspace-chats-new"] > svg' }, { name: "status-view", selector: '[data-testid="workspace-status-view"]' }, { name: "status-section", selector: '[data-testid^="status-section-"]:not([data-testid^="status-section-title-"])', key: { self: !0, attr: "data-testid", strip: "status-section-" } }, { name: "status-heading", selector: '[data-testid^="status-section-title-"], [data-testid="status-no-sessions-title"]', key: { self: !0, attr: "data-testid" } }, { name: "status-heading-dot", selector: '[data-testid^="status-section-title-"] > span:first-child, [data-testid="status-no-sessions-title"] > span:first-child', key: { closest: '[data-testid^="status-section-title-"], [data-testid="status-no-sessions-title"]', attr: "data-testid" } }, { name: "status-heading-label", selector: '[data-testid^="status-section-title-"] > span:nth-child(2), [data-testid="status-no-sessions-title"] > span:nth-child(2)', key: { closest: '[data-testid^="status-section-title-"], [data-testid="status-no-sessions-title"]', attr: "data-testid" } }, { name: "status-heading-count", selector: '[data-testid^="status-section-title-"] > span[aria-label], [data-testid="status-no-sessions-title"] > span[aria-label]', key: { closest: '[data-testid^="status-section-title-"], [data-testid="status-no-sessions-title"]', attr: "data-testid" } }, { name: "status-heading-note", selector: '[data-testid^="status-section-title-"] > span.truncate, [data-testid="status-no-sessions-title"] > span.truncate', key: { closest: '[data-testid^="status-section-title-"], [data-testid="status-no-sessions-title"]', attr: "data-testid" } }, { name: "status-project", selector: 'div[data-testid^="status-project-"]', key: { self: !0, attr: "data-testid", strip: "status-project-" } }, { name: "status-project-header", selector: 'div[data-testid^="status-project-"] > div:first-child', key: { closest: 'div[data-testid^="status-project-"]', attr: "data-testid", strip: "status-project-" } }, { name: "status-project-icon", selector: 'div[data-testid^="status-project-"] > div:first-child > svg', key: { closest: 'div[data-testid^="status-project-"]', attr: "data-testid", strip: "status-project-" } }, { name: "status-project-title", selector: '[data-testid="status-project-title"]', key: { closest: 'div[data-testid^="status-project-"]', attr: "data-testid", strip: "status-project-" } }, { name: "status-empty-project", selector: '[data-testid^="status-empty-project-"]', key: { self: !0, attr: "data-testid", strip: "status-empty-project-" } }, { name: "status-empty-project-icon", selector: '[data-testid^="status-empty-project-"] > button:first-child > svg', key: { closest: '[data-testid^="status-empty-project-"]', attr: "data-testid", strip: "status-empty-project-" } }, { name: "status-empty-project-title", selector: '[data-testid^="status-empty-project-"] > button > span.whitespace-nowrap', key: { closest: '[data-testid^="status-empty-project-"]', attr: "data-testid", strip: "status-empty-project-" } }, { name: "settings-bar", selector: "aside.sidebar > div:last-child" }, { name: "settings-gear", selector: '[data-testid="settings-gear"]' }, { name: "settings-gear-icon", selector: '[data-testid="settings-gear"] > svg' }], tabs: [{ name: "tab-strip", selector: '[data-testid="tab-bar"]' }, { name: "tab-slot", selector: "[data-tab-entry]", key: { self: !0, attr: "data-tab-entry" } }, { name: "tab-separator", selector: '[data-testid="tab-separator"]', key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab", selector: "button.tab-bar__tab", key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-icon", selector: 'button.tab-bar__tab > span[aria-hidden="true"]', key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-icon-glyph", selector: 'button.tab-bar__tab > span[aria-hidden="true"] > *', key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-label", selector: "button.tab-bar__tab > span.truncate", key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-dirty", selector: 'button.tab-bar__tab > span[aria-label="unsaved changes"]', key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-close", selector: '[data-tab-entry] > button[aria-label^="Close"]', key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-close-glyph", selector: '[data-tab-entry] > button[aria-label^="Close"] > svg', key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-new", selector: '[data-testid="tab-new"]' }, { name: "tab-new-glyph", selector: '[data-testid="tab-new"] > svg' }], status: [{ name: "status-bar", selector: "footer.status-bar" }, { name: "status-location", selector: ".status-bar__location" }, { name: "status-dot", selector: ".status-bar__location > span:first-child" }, { name: "status-host", selector: '[data-testid="status-host"]' }, { name: "status-cwd", selector: ".status-item--cwd" }, { name: "status-branch", selector: ".status-bar__branch" }, { name: "status-branch-icon", selector: ".status-bar__branch > svg" }, { name: "status-branch-name", selector: ".status-bar__branch > span" }, { name: "status-details", selector: ".status-bar__details" }, { name: "zoom-indicator", selector: '[data-testid="zoom-indicator"]' }, { name: "status-detail", selector: ".status-bar__details > span" }, { name: "status-usage", selector: ".status-bar__usage" }, { name: "usage-summary", selector: '[data-testid="usage-summary"]' }, { name: "usage-unavailable", selector: '[data-testid="usage-summary"] > span:only-child' }, { name: "usage-account", selector: '[data-testid="usage-summary"] > span.flex' }, { name: "usage-account-name", selector: '[data-testid="usage-summary"] > span.flex > span:first-child' }, { name: "usage-window", selector: '[data-testid="usage-summary"] > span.flex > span:not(:first-child)' }, { name: "status-connection", selector: '[data-testid="status-connection"]' }, { name: "status-connection-glyph", selector: '[data-testid="status-connection"] > svg' }], navigator: [{ name: "navigator-scrim", selector: "body > div.fixed.inset-0" }, { name: "navigator-panel", selector: '[data-testid="navigator"]' }, { name: "navigator-input", selector: '[data-testid="navigator-input"]' }, { name: "navigator-chips", selector: '[data-testid="navigator"] > div:nth-child(2)' }, { name: "navigator-chip", selector: '[data-testid^="navigator-filter-"]', key: { self: !0, attr: "data-testid", strip: "navigator-filter-" } }, { name: "navigator-list", selector: '[data-testid="navigator"] > div:nth-child(3)' }, { name: "navigator-notice", selector: '[data-testid="navigator"] > div:nth-child(3) > p[role]' }, { name: "navigator-empty", selector: '[data-testid="navigator"] div.text-center' }, { name: "navigator-command", selector: '[data-testid^="navigator-command-"]', key: { self: !0, attr: "data-testid", strip: "navigator-command-" } }, { name: "navigator-command-title", selector: '[data-testid^="navigator-command-"] > span:first-child', key: { closest: '[data-testid^="navigator-command-"]', attr: "data-testid", strip: "navigator-command-" } }, { name: "navigator-command-detail", selector: '[data-testid^="navigator-command-"] > span:last-child', key: { closest: '[data-testid^="navigator-command-"]', attr: "data-testid", strip: "navigator-command-" } }, { name: "navigator-row", selector: '[data-testid^="navigator-row-"]', key: { self: !0, attr: "data-testid", strip: "navigator-row-" } }, { name: "navigator-row-dot", selector: '[data-testid^="navigator-row-"] > :first-child', key: { closest: '[data-testid^="navigator-row-"]', attr: "data-testid", strip: "navigator-row-" } }, { name: "navigator-row-title", selector: '[data-testid^="navigator-row-"] > span:nth-child(2)', key: { closest: '[data-testid^="navigator-row-"]', attr: "data-testid", strip: "navigator-row-" } }, { name: "navigator-row-detail", selector: '[data-testid^="navigator-row-"] > span:last-child', key: { closest: '[data-testid^="navigator-row-"]', attr: "data-testid", strip: "navigator-row-" } }, { name: "navigator-note", selector: '[data-testid="navigator"] > p:last-child' }], "pane-menu": [{ name: "pane-menu", selector: '[data-testid="pane-context-menu"]' }, { name: "pane-menu-item", selector: '[data-testid="pane-context-menu"] > button', key: { self: !0, attr: "data-testid", strip: "pane-menu-" } }, { name: "pane-menu-divider", selector: '[data-testid="pane-context-menu"] > div.h-px' }, { name: "pane-menu-rename-row", selector: '[data-testid="pane-context-menu"] > div.flex' }, { name: "pane-menu-rename-input", selector: '[data-testid="pane-menu-rename-input"]' }, { name: "pane-menu-rename-confirm", selector: '[data-testid="pane-menu-rename-confirm"]' }], confirm: [{ name: "confirm-scrim", selector: "body > div.fixed.inset-0" }, { name: "confirm-panel", selector: '[data-testid="confirm-dialog"]' }, { name: "confirm-message", selector: ".confirm-dialog__message" }, { name: "confirm-extra", selector: '[data-testid="confirm-dialog"] > :not(.confirm-dialog__message):not(div.flex)' }, { name: "confirm-buttons", selector: '[data-testid="confirm-dialog"] > div.flex' }, { name: "confirm-cancel", selector: '[data-testid="confirm-cancel"]' }, { name: "confirm-accept", selector: '[data-testid="confirm-accept"]' }], dialog: [{ name: "dialog-scrim", selector: "body > div.fixed.inset-0" }, { name: "dialog-panel", selector: '[data-testid="file-name-dialog"]' }, { name: "dialog-title", selector: '[data-testid="file-name-dialog"] > h2' }, { name: "dialog-input", selector: '[data-testid="file-name-input"]' }, { name: "dialog-hint", selector: '[data-testid="file-name-dialog"] > p:not([role])' }, { name: "dialog-error", selector: '[data-testid="file-name-dialog"] > p[role="alert"]' }, { name: "dialog-buttons", selector: '[data-testid="file-name-dialog"] > div.flex' }, { name: "dialog-cancel", selector: '[data-testid="file-name-dialog"] > div.flex > button:first-child' }, { name: "dialog-confirm", selector: '[data-testid="file-name-confirm"]' }], toast: [{ name: "toast-stack", selector: '[data-testid="toast"]' }, { name: "toast-card", selector: '[data-testid="toast"] .animate-toast-in' }, { name: "toast-open", selector: '[data-testid^="toast-"]:not([data-testid^="toast-dismiss-"])' }, { name: "toast-mark", selector: '[data-testid^="toast-"]:not([data-testid^="toast-dismiss-"]) > :first-child' }, { name: "toast-heading", selector: '[data-testid^="toast-"]:not([data-testid^="toast-dismiss-"]) > span.min-w-0 > span:first-child' }, { name: "toast-detail", selector: '[data-testid^="toast-"]:not([data-testid^="toast-dismiss-"]) > span.min-w-0 > span:nth-child(2)' }, { name: "toast-dismiss", selector: '[data-testid^="toast-dismiss-"]' }, { name: "toast-dismiss-glyph", selector: '[data-testid^="toast-dismiss-"] > svg' }], "pane-header": [{ name: "pane-header", selector: '[data-testid^="pane-header-"]', key: { self: !0, attr: "data-testid", strip: "pane-header-" } }, { name: "pane-header-icon", selector: '[data-testid^="pane-header-"] > span.shrink-0:not([data-testid])', key: { closest: '[data-testid^="pane-header-"]', attr: "data-testid", strip: "pane-header-" } }, { name: "pane-header-icon-glyph", selector: '[data-testid^="pane-header-"] > span.shrink-0:not([data-testid]) > *', key: { closest: '[data-testid^="pane-header-"]', attr: "data-testid", strip: "pane-header-" } }, { name: "pane-header-name", selector: '[data-testid^="pane-header-"] > span.truncate', key: { closest: '[data-testid^="pane-header-"]', attr: "data-testid", strip: "pane-header-" } }, { name: "pane-header-state", selector: '[data-testid^="pane-header-"] > span.flex[title]', key: { closest: '[data-testid^="pane-header-"]', attr: "data-testid", strip: "pane-header-" } }, { name: "pane-header-state-dot", selector: '[data-testid^="pane-header-"] > span.flex[title] > span.rounded-full', key: { closest: '[data-testid^="pane-header-"]', attr: "data-testid", strip: "pane-header-" } }, { name: "pane-header-state-word", selector: '[data-testid^="pane-header-"] > span.flex[title] > span.truncate', key: { closest: '[data-testid^="pane-header-"]', attr: "data-testid", strip: "pane-header-" } }, { name: "pane-controls", selector: '[data-testid^="tile-controls-"]', key: { self: !0, attr: "data-testid", strip: "tile-controls-" } }, { name: "pane-expand", selector: '[data-testid^="tile-expand-"]', key: { self: !0, attr: "data-testid", strip: "tile-expand-" } }, { name: "pane-expand-glyph", selector: '[data-testid^="tile-expand-"] > svg', key: { closest: '[data-testid^="tile-expand-"]', attr: "data-testid", strip: "tile-expand-" } }, { name: "pane-close", selector: '[data-testid^="tile-close-"]', key: { self: !0, attr: "data-testid", strip: "tile-close-" } }, { name: "pane-close-glyph", selector: '[data-testid^="tile-close-"] > svg', key: { closest: '[data-testid^="tile-close-"]', attr: "data-testid", strip: "tile-close-" } }, { name: "pane-corner", selector: "div.pointer-events-auto.absolute" }], "new-session": [{ name: "launcher", selector: ".new-session-popover" }, { name: "launcher-filter", selector: '[data-testid="new-tab-filter"]' }, { name: "launcher-list", selector: "#new-tab-launcher-list" }, { name: "launcher-option", selector: '[role="option"]', key: { self: !0, attr: "data-testid" } }, { name: "launcher-option-icon", selector: '[role="option"] > :first-child:not(span.flex-1):not(kbd)', key: { closest: '[role="option"]', attr: "data-testid" } }, { name: "launcher-option-label", selector: '[role="option"] > span.flex-1', key: { closest: '[role="option"]', attr: "data-testid" } }, { name: "launcher-option-key", selector: '[role="option"] > kbd', key: { closest: '[role="option"]', attr: "data-testid" } }, { name: "launcher-note", selector: ".new-session-popover p[role]" }, { name: "agent-select", selector: '[data-testid="new-session-popover-agent"]' }, { name: "agent-manage", selector: ".new-session-popover > div:first-child > button:not([data-testid])" }, { name: "project-option", selector: '[data-testid^="project-option-"]', key: { self: !0, attr: "data-testid", strip: "project-option-" } }, { name: "project-option-name", selector: '[data-testid^="project-option-"]', key: { closest: '[data-testid^="project-option-"]', attr: "data-testid", strip: "project-option-" }, textRange: !0 }, { name: "project-option-path", selector: '[data-testid^="project-option-"] > span', key: { closest: '[data-testid^="project-option-"]', attr: "data-testid", strip: "project-option-" } }], "tab-menu": [{ name: "tab-menu", selector: '[data-testid="tab-split-menu"]' }, { name: "tab-menu-item", selector: '[data-testid="tab-split-menu"] > button', key: { self: !0, attr: "data-testid" } }, { name: "tab-menu-item-label", selector: '[data-testid="tab-split-menu"] > button > span.block', key: { closest: '[data-testid="tab-split-menu"] > button', attr: "data-testid" } }, { name: "tab-menu-heading", selector: '[data-testid="tab-split-menu"] > p' }, { name: "tab-menu-empty", selector: '[data-testid="tab-split-menu"] > div:not(.h-px)' }, { name: "tab-menu-divider", selector: '[data-testid="tab-split-menu"] > div.h-px' }, { name: "tab-menu-rename-form", selector: '[data-testid="tab-split-menu"] > form' }, { name: "tab-menu-rename-input", selector: '[data-testid="tab-menu-rename-input"]' }, { name: "tab-menu-rename-save", selector: '[data-testid="tab-split-menu"] > form > button' }], select: [{ name: "select-field", selector: '[data-testid="select-demo"]' }, { name: "select-field-label", selector: '[data-testid="select-demo"] > span.truncate' }, { name: "select-chevron", selector: '[data-testid="select-demo"] > svg' }, { name: "select-list", selector: '[role="listbox"]' }, { name: "select-option", selector: '[role="listbox"] > [role="option"]', key: { self: !0, attr: "data-value" } }, { name: "select-option-label", selector: '[role="listbox"] > [role="option"] > span.truncate', key: { closest: '[role="option"]', attr: "data-value" } }, { name: "select-option-check", selector: '[role="listbox"] > [role="option"] > span[aria-hidden]', key: { closest: '[role="option"]', attr: "data-value" } }], "keybind-help": [{ name: "keybind-help-scrim", selector: "body > div.fixed.inset-0" }, { name: "keybind-help-panel", selector: '[data-testid="keybind-help"]' }, { name: "keybind-help-header", selector: '[data-testid="keybind-help"] > div:first-child' }, { name: "keybind-help-title", selector: '[data-testid="keybind-help"] h2' }, { name: "keybind-help-close", selector: '[aria-label="Close keybind help"]' }, { name: "keybind-help-close-glyph", selector: '[aria-label="Close keybind help"] > svg' }, { name: "keybind-help-search", selector: '[data-testid="keybind-help-search"]' }, { name: "keybind-help-list", selector: '[data-testid="keybind-help"] > div:last-child' }, { name: "keybind-help-empty", selector: '[data-testid="keybind-help"] div.text-center' }, { name: "keybind-help-group", selector: '[data-testid="keybind-help"] section' }, { name: "keybind-help-group-title", selector: '[data-testid="keybind-help"] section > h3' }, { name: "keybind-help-row", selector: '[data-testid="keybind-help"] li' }, { name: "keybind-help-keys", selector: '[data-testid="keybind-help"] li > kbd' }, { name: "keybind-help-description", selector: '[data-testid="keybind-help"] li > span' }], launcher: [{ name: "launcher-scrim", selector: "body > div.fixed.inset-0" }, { name: "launcher-panel", selector: '[data-testid="new-session-dialog"]' }, { name: "launcher-title", selector: '[data-testid="new-session-dialog"] > p' }, { name: "launcher-filter", selector: '[data-testid="new-session-filter"]' }, { name: "launcher-list", selector: "#new-session-list" }, { name: "launcher-row", selector: '[data-testid^="new-session-row-"]', key: { self: !0, attr: "data-testid", strip: "new-session-row-" } }, { name: "launcher-row-icon", selector: '[data-testid^="new-session-row-"] > :first-child:not(span):not(kbd)', key: { closest: '[data-testid^="new-session-row-"]', attr: "data-testid", strip: "new-session-row-" } }, { name: "launcher-row-label", selector: '[data-testid^="new-session-row-"] > span.shrink-0', key: { closest: '[data-testid^="new-session-row-"]', attr: "data-testid", strip: "new-session-row-" } }, { name: "launcher-row-detail", selector: '[data-testid^="new-session-row-"] > span.ml-auto', key: { closest: '[data-testid^="new-session-row-"]', attr: "data-testid", strip: "new-session-row-" } }, { name: "launcher-row-key", selector: '[data-testid^="new-session-row-"] > kbd', key: { closest: '[data-testid^="new-session-row-"]', attr: "data-testid", strip: "new-session-row-" } }, { name: "launcher-note", selector: "#new-session-list > p" }], "session-menu": [{ name: "tab-menu", selector: '[data-testid="tab-split-menu"]' }, { name: "tab-menu-item", selector: '[data-testid="tab-split-menu"] > button', key: { self: !0, attr: "data-testid" } }, { name: "tab-menu-item-label", selector: '[data-testid="tab-split-menu"] > button > span.block', key: { closest: '[data-testid="tab-split-menu"] > button', attr: "data-testid" } }, { name: "tab-menu-heading", selector: '[data-testid="tab-split-menu"] > p' }, { name: "tab-menu-empty", selector: '[data-testid="tab-split-menu"] > div:not(.h-px)' }, { name: "tab-menu-divider", selector: '[data-testid="tab-split-menu"] > div.h-px' }], "tab-drag": [{ name: "tab-drag-layer", selector: '[data-testid="tab-drag-layer"]' }, { name: "tab-drag-pane", selector: '[data-testid="tab-drag-layer"] > div.bg-surface-1\\/30' }, { name: "tab-drop-zone", selector: '[data-testid="tab-drop-zone"]', key: { self: !0, attr: "data-zone" } }, { name: "tab-drop-label", selector: '[data-testid="tab-drop-zone"] > span' }, { name: "tab-drag-ghost", selector: '[data-testid="tab-drag-ghost"]' }], start: [{ name: "start-panel", selector: '[data-testid="no-session-panel"], [data-testid="cli-start-panel"]' }, { name: "start-column", selector: '[data-testid$="-panel"] > div' }, { name: "start-logo", selector: '[data-testid="no-session-panel"] img' }, { name: "start-name", selector: '[data-testid$="-panel"] h1, [data-testid="no-session-panel"] h1, [data-testid="no-session-panel"] h2' }, { name: "start-hint", selector: '[data-testid$="-panel"] p' }, { name: "start-target", selector: '[data-testid="workspace-start-target"], [data-testid="cli-start-target"]' }, { name: "start-action", selector: '[data-testid="home-add-project"], [data-testid="no-session-create"], [data-testid^="workspace-start-"]:not([data-testid="workspace-start-target"]), [data-testid^="cli-start-agent-"]', key: { self: !0, attr: "data-testid" } }, { name: "start-status", selector: '[role="status"], [role="alert"]' }, { name: "start-status-action", selector: '[role="status"] > button, [role="alert"] > button' }, { name: "start-link", selector: '[data-testid$="-panel"] button.text-subtext-0' }, { name: "start-shortcut-row", selector: '[data-testid="no-session-panel"] dl > div' }, { name: "start-shortcut-label", selector: '[data-testid="no-session-panel"] dl dt' }, { name: "start-shortcut-key", selector: '[data-testid="no-session-panel"] dl kbd' }], "folder-browser": [{ name: "folder-browser", selector: '[data-testid="dir-browser"]' }, { name: "folder-browser-mode-toggle", selector: '[data-testid="dir-browser-mode-toggle"]' }, { name: "folder-browser-up", selector: '[data-testid="dir-browser-up"]' }, { name: "folder-browser-crumbs", selector: '[data-testid="dir-browser"] span.min-w-0.flex-1' }, { name: "folder-browser-crumb", selector: '[data-testid="dir-browser"] span.min-w-0.flex-1 button' }, { name: "folder-browser-filter", selector: '[data-testid="dir-browser-filter"]' }, { name: "folder-browser-list", selector: '[data-testid="dir-browser"] div.overflow-y-auto' }, { name: "folder-browser-entry", selector: '[data-testid^="dir-browser-entry-"]', key: { self: !0, attr: "data-testid", strip: "dir-browser-entry-" } }, { name: "folder-browser-entry-name", selector: '[data-testid^="dir-browser-entry-"] > span:first-child', key: { closest: '[data-testid^="dir-browser-entry-"]', attr: "data-testid", strip: "dir-browser-entry-" } }, { name: "folder-browser-git", selector: '[data-testid^="dir-browser-entry-"] > span:last-child:not(:first-child)', key: { closest: '[data-testid^="dir-browser-entry-"]', attr: "data-testid", strip: "dir-browser-entry-" } }, { name: "folder-browser-note", selector: '[data-testid="dir-browser"] div.overflow-y-auto > div' }, { name: "folder-browser-use", selector: '[data-testid="dir-browser-use"]' }, { name: "folder-browser-path-input", selector: '[data-testid="project-path-input"]' }], instructions: [{ name: "instructions-scrim", selector: "body > div.fixed.inset-0" }, { name: "instructions-panel", selector: '[data-testid="instructions-dialog"]' }, { name: "instructions-title", selector: '[data-testid="instructions-dialog"] > h2' }, { name: "instructions-intro", selector: '[data-testid="instructions-dialog"] > p' }, { name: "instructions-label", selector: '[data-testid="instructions-dialog"] > label > span:first-child' }, { name: "instructions-count", selector: '[data-testid="instructions-count"]' }, { name: "instructions-text", selector: '[data-testid="instructions-text"]' }, { name: "instructions-folders", selector: '[data-testid="instructions-folders"]' }, { name: "instructions-error", selector: '[data-testid="instructions-error"]' }, { name: "instructions-cancel", selector: '[data-testid="instructions-dialog"] > div.flex.justify-end > button:first-child' }, { name: "instructions-save", selector: '[data-testid="instructions-save"]' }], memory: [{ name: "memory-scrim", selector: "body > div.fixed.inset-0", key: { self: !0, attr: "data-testid" } }, { name: "memory-panel", selector: '[data-testid="memory-dialog"]' }, { name: "memory-title", selector: '[data-testid="memory-dialog"] > h2' }, { name: "memory-intro", selector: '[data-testid="memory-dialog"] > p' }, { name: "memory-caps", selector: '[data-testid="memory-caps"]' }, { name: "memory-new", selector: '[data-testid="memory-new"]' }, { name: "memory-enabled", selector: '[data-testid="memory-enabled"]' }, { name: "memory-enabled-label", selector: '[data-testid="memory-dialog"] > label.flex > span' }, { name: "memory-note", selector: '[data-testid="memory-dialog"] > span.text-subtext-0' }, { name: "memory-row", selector: '[data-testid^="memory-row-"]', key: { self: !0, attr: "data-testid", strip: "memory-row-" } }, { name: "memory-open", selector: '[data-testid^="memory-open-"]', key: { self: !0, attr: "data-testid", strip: "memory-open-" } }, { name: "memory-file-title", selector: '[data-testid^="memory-row-"] button > span:first-child', key: { closest: '[data-testid^="memory-row-"]', attr: "data-testid", strip: "memory-row-" } }, { name: "memory-file-summary", selector: '[data-testid^="memory-row-"] button > span.truncate', key: { closest: '[data-testid^="memory-row-"]', attr: "data-testid", strip: "memory-row-" } }, { name: "memory-file-meta", selector: '[data-testid^="memory-row-"] button > span:last-child', key: { closest: '[data-testid^="memory-row-"]', attr: "data-testid", strip: "memory-row-" } }, { name: "memory-delete", selector: '[data-testid^="memory-delete-"]', key: { self: !0, attr: "data-testid", strip: "memory-delete-" } }, { name: "memory-error", selector: '[data-testid="memory-error"]' }, { name: "memory-close", selector: '[data-testid="memory-dialog"] > div.flex.justify-end > button' }, { name: "memory-file-name", selector: '[data-testid="memory-file-name"]' }, { name: "memory-name", selector: '[data-testid="memory-name"]' }, { name: "memory-count", selector: '[data-testid="memory-count"]' }, { name: "memory-text", selector: '[data-testid="memory-text"]' }, { name: "memory-conflict", selector: '[data-testid="memory-conflict"]' }, { name: "memory-reload", selector: '[data-testid="memory-reload"]' }, { name: "memory-back", selector: '[data-testid="memory-back"]' }, { name: "memory-save", selector: '[data-testid="memory-save"]' }, { name: "memory-confirm", selector: '[data-testid="confirm-dialog"]' }, { name: "memory-confirm-message", selector: ".confirm-dialog__message" }], worktree: [{ name: "worktree-plus", selector: '[data-testid^="worktree-menu-"]' }, { name: "worktree-popover", selector: '[role="dialog"][aria-label="Git worktrees"]' }, { name: "worktree-heading", selector: '[role="dialog"][aria-label="Git worktrees"] > div:first-child > span:first-child' }, { name: "worktree-project", selector: '[role="dialog"][aria-label="Git worktrees"] > div:first-child > span:last-child' }, { name: "worktree-list", selector: '[role="dialog"][aria-label="Git worktrees"] > div.overflow-y-auto' }, { name: "worktree-note", selector: '[role="dialog"][aria-label="Git worktrees"] > div.overflow-y-auto > div:not(.worktree-menu__entry)' }, { name: "worktree-entry", selector: '[data-testid^="worktree-entry-"]', key: { self: !0, attr: "data-testid", strip: "worktree-entry-" } }, { name: "worktree-entry-branch", selector: ".worktree-menu__entry-branch", key: { closest: '[data-testid^="worktree-entry-"]', attr: "data-testid", strip: "worktree-entry-" } }, { name: "worktree-badge", selector: '[data-testid^="worktree-entry-"] .worktree-menu__entry-branch > span', key: { closest: '[data-testid^="worktree-entry-"]', attr: "data-testid", strip: "worktree-entry-" } }, { name: "worktree-entry-path", selector: ".worktree-menu__entry-path", key: { closest: '[data-testid^="worktree-entry-"]', attr: "data-testid", strip: "worktree-entry-" } }, { name: "worktree-open", selector: '[data-testid^="worktree-open-"]', key: { self: !0, attr: "data-testid", strip: "worktree-open-" } }, { name: "worktree-remove", selector: '[data-testid^="worktree-remove-"]', key: { self: !0, attr: "data-testid", strip: "worktree-remove-" } }, { name: "worktree-error", selector: '[data-testid="worktree-error"]' }, { name: "worktree-new", selector: '[data-testid="worktree-new"]' }, { name: "worktree-name-input", selector: '[data-testid="worktree-name-input"]' }, { name: "worktree-start-input", selector: '[data-testid="worktree-start-input"]' }, { name: "worktree-branch-input", selector: '[data-testid="worktree-branch-input"]' }, { name: "worktree-parent-select", selector: '[data-testid="worktree-parent-select"]' }, { name: "worktree-new-branch", selector: '[data-testid="worktree-new-branch"]' }, { name: "worktree-path-input", selector: '[data-testid="worktree-path-input"]' }, { name: "worktree-agent-select", selector: '[data-testid="worktree-agent-select"]' }, { name: "worktree-create-cancel", selector: '[data-testid="worktree-create-cancel"]' }, { name: "worktree-create-submit", selector: '[data-testid="worktree-create-submit"]' }, { name: "worktree-confirm", selector: '[data-testid="confirm-dialog"]' }, { name: "worktree-confirm-message", selector: ".confirm-dialog__message" }, { name: "worktree-confirm-accept", selector: '[data-testid="confirm-accept"]' }, { name: "worktree-confirm-cancel", selector: '[data-testid="confirm-cancel"]' }], "terminal-search": [{ name: "terminal-frame", selector: '[data-testid="persistent-agent-terminal"]' }, { name: "term-search", selector: '[data-testid="term-search"]' }, { name: "term-search-input", selector: '[data-testid="term-search-input"]' }, { name: "term-search-button", selector: '[data-testid="term-search"] > button', key: { self: !0, attr: "title" } }], "agent-control": [{ name: "terminal-frame", selector: '[data-testid="persistent-agent-terminal"]' }, { name: "agent-control-chip", selector: '[data-testid="agent-control-chip"]' }, { name: "agent-control-label", selector: '[data-testid="agent-control-chip"] > span' }, { name: "agent-control-button", selector: '[data-testid="agent-control-chip"] > button' }, { name: "agent-control-error", selector: ".terminal__cli-error" }, { name: "agent-control-ended", selector: ".terminal__exited", key: { self: !0, attr: "data-testid" } }, { name: "agent-control-ended-text", selector: ".terminal__exited-text" }, { name: "agent-control-ended-button", selector: ".terminal__exited-actions > button", key: { self: !0, attr: "data-testid" } }], "phone-size": [{ name: "terminal-frame", selector: '[data-testid="persistent-agent-terminal"]' }, { name: "phone-size-notice", selector: '[data-testid="phone-size-notice"]' }, { name: "phone-size-chip", selector: '[data-testid="phone-size-chip"]' }, { name: "phone-size-heading", selector: '[data-testid="phone-size-notice"] span.font-semibold' }, { name: "phone-size-text", selector: '[data-testid="phone-size-notice"] span:not(.font-semibold)' }, { name: "phone-size-fold", selector: '[aria-label="Keep phone size and hide this"]' }, { name: "phone-size-button", selector: '[data-testid="phone-size-notice"] div.flex.flex-wrap > button, [data-testid="phone-size-chip"] > button' }], window: [{ name: "sidebar-card", selector: '[data-testid="sidebar-card"]' }, { name: "main-card", selector: '[data-testid="main-card"]' }, { name: "tools-card", selector: '[data-testid="tools-card"]' }, { name: "sidebar-toggle", selector: '[data-testid="sidebar-collapse-toggle"]' }, { name: "drawer-toggle", selector: '[data-testid="workspace-tools-toggle"]' }, { name: "resize-sidebar", selector: '[data-testid="resize-sidebar"]' }, { name: "resize-tools", selector: '[data-testid="resize-tools"]' }, { name: "tools-tab", selector: 'nav[aria-label="Files, Git and Browser"] > button' }, { name: "status-bar", selector: "footer.status-bar" }], settings: [{ name: "settings-modal", selector: '[data-testid="settings-modal"]' }, { name: "settings-nav-card", selector: '[data-testid="settings-modal"] > nav' }, { name: "settings-close", selector: '[data-testid="settings-close"]' }, { name: "settings-nav", selector: 'nav [data-testid^="settings-nav-"]', key: { self: !0, attr: "data-testid", strip: "settings-nav-" } }, { name: "settings-main-card", selector: '[data-testid="settings-modal"] > main' }, { name: "settings-search", selector: '[data-testid="settings-search"]' }, { name: "settings-title", selector: '[data-testid="settings-modal"] > main h1' }, { name: "settings-body", selector: '[data-testid="settings-modal"] .settings-modal__body' }, { name: "settings-group-title", selector: '[data-testid="settings-modal"] > main h3' }, { name: "settings-group-card", selector: '[data-testid="settings-modal"] > main section > div.rounded-ui' }, { name: "settings-row", selector: '[data-testid="settings-modal"] [data-setting-row]' }, { name: "settings-row-title", selector: '[data-testid="settings-modal"] [data-setting-row] > div:first-child > div:first-child' }, { name: "settings-row-description", selector: '[data-testid="settings-modal"] [data-setting-row] > div:first-child > div:nth-child(2)' }, { name: "settings-result-title", selector: '[data-testid^="settings-result-"] > h2' }] };
export {
  ky as NAMED_ELEMENTS,
  g0 as React,
  P0 as SCHEMA,
  _y as STYLE_KEYS,
  Sy as describeToGpui,
  vy as jsxRuntime,
  yy as mount,
  xy as reactDom,
  wy as sdk
};
