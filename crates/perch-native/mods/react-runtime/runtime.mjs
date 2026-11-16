function sc(n, a) {
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
const x0 = /* @__PURE__ */ new Set(["hover", "focus", "focus-visible", "focus-within", "active", "disabled", "enabled", "checked"]), w0 = /* @__PURE__ */ new Set(["not", "is", "where", "has", "nth-child"]), k0 = /* @__PURE__ */ new Set(["first-child", "last-child", "only-child", "root", ...x0]);
function Ho(n) {
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
  if (r === a) throw new ot(`expected a name at ${a} in ${JSON.stringify(n)}`);
  return [Ho(n.slice(a, r)), r];
}
function _0(n, a) {
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
function oc(n) {
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
function S0(n, a) {
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
      if (c < 0) throw new ot(`unclosed [ in ${JSON.stringify(n)}`);
      const f = n.slice(a + 1, c).trim(), d = /^([^\s~^$*|=]+)\s*(?:([~^$*|]?=)\s*(?:"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'|([^\s"'\]]+)))?\s*(i)?$/.exec(f);
      if (!d) throw new ot(`cannot read the attribute selector [${f}]`);
      const m = d[3] ?? d[4] ?? d[5];
      r.attrs.push({ name: Ho(d[1]).toLowerCase(), op: d[2] ?? null, value: m === void 0 ? null : Ho(m) }), a = c + 1, i = !0;
      continue;
    }
    if (s === ":") {
      if (n[a + 1] === ":") {
        const [m, g] = Ol(n, a + 2), y = m.toLowerCase();
        if (y !== "before" && y !== "after") throw new ot(`::${y} is not supported`);
        if (r.pseudoElement = y, a = g, i = !0, a < n.length && !/[\s>]/.test(n[a])) throw new ot(`nothing may follow ::${y} in ${JSON.stringify(n)}`);
        break;
      }
      const [c, f] = Ol(n, a + 1);
      a = f;
      const d = c.toLowerCase();
      if ((d === "before" || d === "after") && n[a] !== "(") {
        if (r.pseudoElement = d, i = !0, a < n.length && !/[\s>]/.test(n[a])) throw new ot(`nothing may follow :${d} in ${JSON.stringify(n)}`);
        break;
      }
      if (n[a] === "(") {
        if (!w0.has(d)) throw new ot(`:${d}() is not supported`);
        const m = _0(n, a + 1), g = n.slice(a + 1, m).trim();
        if (a = m + 1, d === "nth-child") {
          if (!/^\d+$/.test(g)) throw new ot(`:nth-child(${g}) is not supported (only a number)`);
          r.pseudos.push({ name: d, n: Number(g) });
        } else {
          const y = oc(g).map(cc);
          if (d === "has" && y.some((v) => v.length !== 1)) throw new ot(`:has(${g}) is not supported (only a compound selector)`);
          r.pseudos.push({ name: d, list: y });
        }
      } else {
        if (!k0.has(d)) throw new ot(`:${d} is not supported`);
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
  if (!i) throw new ot(`empty compound selector at ${a} in ${JSON.stringify(n)}`);
  return [r, a];
}
function cc(n) {
  const a = [];
  let r = 0, i = null;
  for (n = n.trim(); r < n.length; ) {
    const [s, c] = S0(n, r);
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
const Nf = /* @__PURE__ */ new Map();
function ji(n) {
  let a = Nf.get(n);
  return a || (a = oc(n).map(cc), Nf.set(n, a)), a;
}
function Mp(n) {
  const a = [0, 0, 0], r = (i) => {
    a[0] += i[0], a[1] += i[1], a[2] += i[2];
  };
  for (const { compound: i } of n) {
    i.id && a[0]++, a[1] += i.classes.length + i.attrs.length, i.tag && i.tag !== "*" && a[2]++, i.pseudoElement && a[2]++;
    for (const s of i.pseudos)
      if (s.name !== "where")
        if (s.list) {
          const c = s.list.map(Mp).sort((f, d) => d[0] - f[0] || d[1] - f[1] || d[2] - f[2])[0];
          r(c);
        } else a[1]++;
  }
  return a;
}
function E0(n, { name: a, op: r, value: i }) {
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
function Fr(n) {
  return n.parentElement ? n.parentElement.children : [n];
}
function Rp(n, a) {
  for (const r of n.children) if (a(r) || Rp(r, a)) return !0;
  return !1;
}
function jp(n, a, r, i) {
  if ((a.pseudoElement ?? null) !== (i ? r.pseudo ?? null : null) || a.tag && a.tag !== "*" && n.tagName !== a.tag || a.id && n.getAttribute("id") !== a.id) return !1;
  if (a.classes.length) {
    const s = n.classSet ?? new Set(n.classList ?? []);
    for (const c of a.classes) if (!s.has(c)) return !1;
  }
  for (const s of a.attrs) if (!E0(n, s)) return !1;
  for (const s of a.pseudos)
    switch (s.name) {
      case "first-child":
        if (Fr(n)[0] !== n) return !1;
        break;
      case "only-child":
        if (Fr(n).length !== 1) return !1;
        break;
      case "last-child": {
        const c = Fr(n);
        if (c[c.length - 1] !== n) return !1;
        break;
      }
      case "nth-child":
        if (Fr(n).indexOf(n) !== s.n - 1) return !1;
        break;
      case "root":
        if (!n.isDocumentRoot) return !1;
        break;
      case "not":
        if (s.list.some((c) => tl(n, c, r, i))) return !1;
        break;
      case "has":
        if (n.watchesDescendants = !0, !s.list.some(([{ compound: c }]) => Rp(n, (f) => jp(f, c, r, !1)))) return !1;
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
    if (!jp(c, m, r, d)) return !1;
    if (f === 0) return !0;
    if (g === ">") return !!c.parentElement && s(c.parentElement, f - 1, !1);
    for (let y = c.parentElement; y; y = y.parentElement) if (s(y, f - 1, !1)) return !0;
    return !1;
  };
  return s(n, a.length - 1, i);
}
function z0(n, a, r = {}) {
  return (typeof a == "string" ? ji(a) : a).some((s) => tl(n, s, r));
}
function Uo(n, a, r = {}) {
  return tl(n, a, r);
}
function Vl(n, a, r = {}) {
  const i = ji(a), s = [], c = (f) => {
    for (const d of f.children)
      i.some((m) => tl(d, m, r)) && s.push(d), c(d);
  };
  return c(n), s;
}
function Op(n, a, r = {}) {
  const i = ji(a);
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
let N0 = 1;
class qo {
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
class uc {
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
let T0 = 0;
const Lo = () => ++T0;
class Oi {
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
class Xe extends uc {
  constructor(a, r = {}, i = null) {
    super(), this.nodeType = 1, this.id = `n${N0++}`, this.tagName = a.toLowerCase(), this.props = r, this.childNodes = [], this.parentNode = null, this.ownerDocument = i, this.hidden = !1, this.state = { hover: !1, focus: !1, active: !1 }, this.bounds = null, this.version = 0, this.attrStamp = 0, this.stamp = 0;
  }
  /** Its props, attributes or state changed. */
  touch() {
    this.version++, this.attrStamp = Lo(), this.mark();
  }
  /** Its subtree changed: it and its ancestors are described again (their styles are kept unless they changed). */
  mark() {
    const a = Lo();
    for (let r = this; r instanceof Xe; r = r.parentNode) r.stamp = a;
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
    return this.parentNode instanceof Xe ? this.parentNode : null;
  }
  get children() {
    return this.childNodes.filter((a) => a instanceof Xe);
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
    return z0(this, a);
  }
  closest(a) {
    return Op(this, a);
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
    return a ? new qo(a.x, a.y, a.width, a.height) : new qo();
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
    return Tf(this);
  }
  /** `outerHTML` without the attributes named in `omit` (by their DOM names), as the web's drag strips its copy. */
  copyMarkup(a = []) {
    return Tf(this, a);
  }
}
const Dp = Symbol("perch.stale-layout"), Bp = 3;
let di = !1;
function Hp(n) {
  return () => {
    let a, r = !1;
    const i = (s) => {
      const c = di;
      di = s < Bp;
      try {
        a = n();
      } catch (f) {
        const d = f?.[Dp];
        if (!d) throw f;
        d.retries.push(() => {
          r || i(s + 1);
        });
      } finally {
        di = c;
      }
    };
    return i(0), () => {
      r = !0, typeof a == "function" && a();
    };
  };
}
const Go = "perch-dom:", C0 = /* @__PURE__ */ new Set(["children", "key", "ref", "dangerouslySetInnerHTML"]), A0 = { class: "className", for: "htmlFor", tabindex: "tabIndex" };
function Tf(n, a = []) {
  const r = new Set(a.map((s) => A0[s] ?? s)), i = (s) => {
    if (!(s instanceof Xe)) return { x: s.data, ...s.hidden ? { h: 1 } : {} };
    const c = {};
    for (const [f, d] of Object.entries(s.props))
      C0.has(f) || r.has(f) || d == null || typeof d == "function" || typeof d == "symbol" || (c[f] = d);
    return { t: s.tagName, p: c, c: s.childNodes.map(i), ...s.hidden ? { h: 1 } : {} };
  };
  return Go + JSON.stringify(i(n));
}
function M0(n, a) {
  if (typeof n != "string" || !n.startsWith(Go)) return null;
  let r;
  try {
    r = JSON.parse(n.slice(Go.length));
  } catch {
    return null;
  }
  const i = (c) => !!c && typeof c == "object" && !Array.isArray(c), s = (c) => {
    if (!i(c)) throw new Error("not a node");
    let f;
    if (typeof c.x == "string") f = new Oi(c.x);
    else {
      if (typeof c.t != "string" || !/^[a-z][a-z0-9-]*$/i.test(c.t) || !i(c.p) || !Array.isArray(c.c)) throw new Error("not an element");
      f = new Xe(c.t, c.p, a);
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
class R0 {
  observe() {
  }
  unobserve() {
  }
  disconnect() {
  }
}
class j0 {
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
function Cf(n) {
  for (let a = n; a instanceof Xe; a = a.parentElement) a.touch();
}
class O0 extends uc {
  constructor(a) {
    super(), this.perch = a, this.documentElement = new Xe("html", {}, this), this.body = new Xe("body", {}, this), this.documentElement.appendChild(this.body), this.activeElement = this.body, this.retries = [];
  }
  createElement(a) {
    return new Xe(a, {}, this);
  }
  /** `element`'s box as the engine last laid it out, or null before its first layout or without an engine that
   * reports boxes (`perch.bounds`). The first ask marks the element to be measured from the next frame on. Inside an
   * effect (`measured`) a box older than the tree, or none yet, puts the effect off until the next frame. */
  measure(a) {
    const r = this.perch?.bounds;
    if (typeof r != "function" || !this.measureKey) return null;
    a.measured || (a.measured = !0, a.touch(), this.restyled());
    const i = r(this.measureKey(a));
    if (di && (!i || this.stale?.())) throw { [Dp]: this };
    return i ?? null;
  }
  /** An element's `style` was written: the tree is described again once the writing script is done. */
  restyled() {
    this.restyling || (this.restyling = !0, queueMicrotask(() => {
      this.restyling = !1, this.afterCommit?.();
    }));
  }
  focus(a) {
    this.activeElement && this.activeElement !== a && this.blur(this.activeElement), this.activeElement = a, a.state.focus = !0, a.state.pointerFocus = !1, Cf(a), this.perch?.focused?.(a);
  }
  blur(a) {
    a.state.focus = !1, Cf(a), this.activeElement === a && (this.activeElement = this.body);
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
class D0 extends uc {
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
function Up(n) {
  return {
    setTimeout: (a, r = 0, ...i) => n.setTimeout(() => a(...i), Math.max(0, Number(r) || 0)),
    clearTimeout: (a) => {
      a != null && n.clearTimeout(a);
    }
  };
}
const Af = Symbol.for("perch.react.globals");
function Pt(n, a, r) {
  Object.defineProperty(n, a, { value: r, configurable: !0, writable: !0, enumerable: !1 });
}
function B0(n, a = globalThis) {
  const r = new O0(n), i = new D0(n, r);
  r.defaultView = i;
  const s = n.storage ?? new j0();
  if (typeof a.setTimeout != "function") {
    if (typeof n.setTimeout != "function") throw new Error("the engine has no setTimeout and the perch host gives none (perch.setTimeout)");
    const d = Up(n);
    Pt(a, "setTimeout", d.setTimeout), Pt(a, "clearTimeout", d.clearTimeout);
  }
  typeof a.queueMicrotask != "function" && Pt(a, "queueMicrotask", (d) => {
    Promise.resolve().then(d);
  }), Pt(a, "requestAnimationFrame", (d) => a.setTimeout(() => d(Date.now()), 0)), Pt(a, "cancelAnimationFrame", (d) => a.clearTimeout(d));
  const c = { document: r, window: i, localStorage: s, HTMLElement: Xe, Element: Xe };
  for (const d of Object.keys(c))
    Object.defineProperty(a, d, { get: () => a[Af]?.[d], configurable: !0, enumerable: !1 });
  a[Af] = c, Pt(a, "DOMRect", qo), Pt(a, "getComputedStyle", H0), typeof a.ResizeObserver != "function" && Pt(a, "ResizeObserver", R0);
  const f = a.navigator && typeof a.navigator == "object" ? a.navigator : {};
  if (!f.clipboard && n.clipboard)
    try {
      Pt(f, "clipboard", n.clipboard);
    } catch {
    }
  return a.navigator || Pt(a, "navigator", f), { document: r, window: i, globals: c };
}
function H0(n) {
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
function Yo(n, a = !1) {
  if (!(a ? n?.tagName === "input" && qp(n) : n?.tagName === "button" && !/^(button|reset)$/.test(String(n.props.type ?? "submit")) && !n.props.disabled)) return null;
  for (let i = n.parentElement; i; i = i.parentElement) if (i.tagName === "form") return i;
  return null;
}
const qp = (n) => n?.tagName === "textarea" || n?.tagName === "input" && /^(text|search|url|email|tel|password|number|)$/.test(String(n.props.type ?? ""));
//! Evaluated before anything else in the runtime bundle: React's scheduler reads `setTimeout` and `queueMicrotask`
//! once, when it loads, so an engine without them (QuickJS) gets the host's (`perch.setTimeout`) first.
const Mf = globalThis.perch;
if (typeof globalThis.setTimeout != "function" && typeof Mf?.setTimeout == "function") {
  const n = Up(Mf);
  globalThis.setTimeout = n.setTimeout, globalThis.clearTimeout = n.clearTimeout;
}
typeof globalThis.queueMicrotask != "function" && (globalThis.queueMicrotask = (n) => {
  Promise.resolve().then(n);
});
function dc(n) {
  return n && n.__esModule && Object.prototype.hasOwnProperty.call(n, "default") ? n.default : n;
}
function U0(n) {
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
var So = { exports: {} }, me = {};
/**
 * @license React
 * react.production.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var Rf;
function q0() {
  if (Rf) return me;
  Rf = 1;
  var n = Symbol.for("react.transitional.element"), a = Symbol.for("react.portal"), r = Symbol.for("react.fragment"), i = Symbol.for("react.strict_mode"), s = Symbol.for("react.profiler"), c = Symbol.for("react.consumer"), f = Symbol.for("react.context"), d = Symbol.for("react.forward_ref"), m = Symbol.for("react.suspense"), g = Symbol.for("react.memo"), y = Symbol.for("react.lazy"), v = Symbol.for("react.activity"), b = Symbol.iterator;
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
  }, j = Object.assign, z = {};
  function R(A, J, ae) {
    this.props = A, this.context = J, this.refs = z, this.updater = ae || E;
  }
  R.prototype.isReactComponent = {}, R.prototype.setState = function(A, J) {
    if (typeof A != "object" && typeof A != "function" && A != null)
      throw Error(
        "takes an object of state variables to update or a function which returns an object of state variables."
      );
    this.updater.enqueueSetState(this, A, J, "setState");
  }, R.prototype.forceUpdate = function(A) {
    this.updater.enqueueForceUpdate(this, A, "forceUpdate");
  };
  function O() {
  }
  O.prototype = R.prototype;
  function H(A, J, ae) {
    this.props = A, this.context = J, this.refs = z, this.updater = ae || E;
  }
  var X = H.prototype = new O();
  X.constructor = H, j(X, R.prototype), X.isPureReactComponent = !0;
  var $ = Array.isArray;
  function T() {
  }
  var h = { H: null, A: null, T: null, S: null }, w = Object.prototype.hasOwnProperty;
  function k(A, J, ae) {
    var oe = ae.ref;
    return {
      $$typeof: n,
      type: A,
      key: J,
      ref: oe !== void 0 ? oe : null,
      props: ae
    };
  }
  function _(A, J) {
    return k(A.type, J, A.props);
  }
  function C(A) {
    return typeof A == "object" && A !== null && A.$$typeof === n;
  }
  function N(A) {
    var J = { "=": "=0", ":": "=2" };
    return "$" + A.replace(/[=:]/g, function(ae) {
      return J[ae];
    });
  }
  var D = /\/+/g;
  function L(A, J) {
    return typeof A == "object" && A !== null && A.key != null ? N("" + A.key) : J.toString(36);
  }
  function W(A) {
    switch (A.status) {
      case "fulfilled":
        return A.value;
      case "rejected":
        throw A.reason;
      default:
        switch (typeof A.status == "string" ? A.then(T, T) : (A.status = "pending", A.then(
          function(J) {
            A.status === "pending" && (A.status = "fulfilled", A.value = J);
          },
          function(J) {
            A.status === "pending" && (A.status = "rejected", A.reason = J);
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
  function q(A, J, ae, oe, ce) {
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
            case y:
              return Ee = A._init, q(
                Ee(A._payload),
                J,
                ae,
                oe,
                ce
              );
          }
      }
    if (Ee)
      return ce = ce(A), Ee = oe === "" ? "." + L(A, 0) : oe, $(ce) ? (ae = "", Ee != null && (ae = Ee.replace(D, "$&/") + "/"), q(ce, J, ae, "", function(Wn) {
        return Wn;
      })) : ce != null && (C(ce) && (ce = _(
        ce,
        ae + (ce.key == null || A && A.key === ce.key ? "" : ("" + ce.key).replace(
          D,
          "$&/"
        ) + "/") + Ee
      )), J.push(ce)), 1;
    Ee = 0;
    var Pe = oe === "" ? "." : oe + ":";
    if ($(A))
      for (var he = 0; he < A.length; he++)
        oe = A[he], ue = Pe + L(oe, he), Ee += q(
          oe,
          J,
          ae,
          ue,
          ce
        );
    else if (he = S(A), typeof he == "function")
      for (A = he.call(A), he = 0; !(oe = A.next()).done; )
        oe = oe.value, ue = Pe + L(oe, he++), Ee += q(
          oe,
          J,
          ae,
          ue,
          ce
        );
    else if (ue === "object") {
      if (typeof A.then == "function")
        return q(
          W(A),
          J,
          ae,
          oe,
          ce
        );
      throw J = String(A), Error(
        "Objects are not valid as a React child (found: " + (J === "[object Object]" ? "object with keys {" + Object.keys(A).join(", ") + "}" : J) + "). If you meant to render a collection of children, use an array instead."
      );
    }
    return Ee;
  }
  function Z(A, J, ae) {
    if (A == null) return A;
    var oe = [], ce = 0;
    return q(A, oe, "", "", function(ue) {
      return J.call(ae, ue, ce++);
    }), oe;
  }
  function I(A) {
    if (A._status === -1) {
      var J = A._result;
      J = J(), J.then(
        function(ae) {
          (A._status === 0 || A._status === -1) && (A._status = 1, A._result = ae);
        },
        function(ae) {
          (A._status === 0 || A._status === -1) && (A._status = 2, A._result = ae);
        }
      ), A._status === -1 && (A._status = 0, A._result = J);
    }
    if (A._status === 1) return A._result.default;
    throw A._result;
  }
  var V = typeof reportError == "function" ? reportError : function(A) {
    if (typeof window == "object" && typeof window.ErrorEvent == "function") {
      var J = new window.ErrorEvent("error", {
        bubbles: !0,
        cancelable: !0,
        message: typeof A == "object" && A !== null && typeof A.message == "string" ? String(A.message) : String(A),
        error: A
      });
      if (!window.dispatchEvent(J)) return;
    } else if (typeof process == "object" && typeof process.emit == "function") {
      process.emit("uncaughtException", A);
      return;
    }
    console.error(A);
  }, K = {
    map: Z,
    forEach: function(A, J, ae) {
      Z(
        A,
        function() {
          J.apply(this, arguments);
        },
        ae
      );
    },
    count: function(A) {
      var J = 0;
      return Z(A, function() {
        J++;
      }), J;
    },
    toArray: function(A) {
      return Z(A, function(J) {
        return J;
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
  return me.Activity = v, me.Children = K, me.Component = R, me.Fragment = r, me.Profiler = s, me.PureComponent = H, me.StrictMode = i, me.Suspense = m, me.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE = h, me.__COMPILER_RUNTIME = {
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
  }, me.cloneElement = function(A, J, ae) {
    if (A == null)
      throw Error(
        "The argument must be a React element, but you passed " + A + "."
      );
    var oe = j({}, A.props), ce = A.key;
    if (J != null)
      for (ue in J.key !== void 0 && (ce = "" + J.key), J)
        !w.call(J, ue) || ue === "key" || ue === "__self" || ue === "__source" || ue === "ref" && J.ref === void 0 || (oe[ue] = J[ue]);
    var ue = arguments.length - 2;
    if (ue === 1) oe.children = ae;
    else if (1 < ue) {
      for (var Ee = Array(ue), Pe = 0; Pe < ue; Pe++)
        Ee[Pe] = arguments[Pe + 2];
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
  }, me.createElement = function(A, J, ae) {
    var oe, ce = {}, ue = null;
    if (J != null)
      for (oe in J.key !== void 0 && (ue = "" + J.key), J)
        w.call(J, oe) && oe !== "key" && oe !== "__self" && oe !== "__source" && (ce[oe] = J[oe]);
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
    return k(A, ue, ce);
  }, me.createRef = function() {
    return { current: null };
  }, me.forwardRef = function(A) {
    return { $$typeof: d, render: A };
  }, me.isValidElement = C, me.lazy = function(A) {
    return {
      $$typeof: y,
      _payload: { _status: -1, _result: A },
      _init: I
    };
  }, me.memo = function(A, J) {
    return {
      $$typeof: g,
      type: A,
      compare: J === void 0 ? null : J
    };
  }, me.startTransition = function(A) {
    var J = h.T, ae = {};
    h.T = ae;
    try {
      var oe = A(), ce = h.S;
      ce !== null && ce(ae, oe), typeof oe == "object" && oe !== null && typeof oe.then == "function" && oe.then(T, V);
    } catch (ue) {
      V(ue);
    } finally {
      J !== null && ae.types !== null && (J.types = ae.types), h.T = J;
    }
  }, me.unstable_useCacheRefresh = function() {
    return h.H.useCacheRefresh();
  }, me.use = function(A) {
    return h.H.use(A);
  }, me.useActionState = function(A, J, ae) {
    return h.H.useActionState(A, J, ae);
  }, me.useCallback = function(A, J) {
    return h.H.useCallback(A, J);
  }, me.useContext = function(A) {
    return h.H.useContext(A);
  }, me.useDebugValue = function() {
  }, me.useDeferredValue = function(A, J) {
    return h.H.useDeferredValue(A, J);
  }, me.useEffect = function(A, J) {
    return h.H.useEffect(A, J);
  }, me.useEffectEvent = function(A) {
    return h.H.useEffectEvent(A);
  }, me.useId = function() {
    return h.H.useId();
  }, me.useImperativeHandle = function(A, J, ae) {
    return h.H.useImperativeHandle(A, J, ae);
  }, me.useInsertionEffect = function(A, J) {
    return h.H.useInsertionEffect(A, J);
  }, me.useLayoutEffect = function(A, J) {
    return h.H.useLayoutEffect(A, J);
  }, me.useMemo = function(A, J) {
    return h.H.useMemo(A, J);
  }, me.useOptimistic = function(A, J) {
    return h.H.useOptimistic(A, J);
  }, me.useReducer = function(A, J, ae) {
    return h.H.useReducer(A, J, ae);
  }, me.useRef = function(A) {
    return h.H.useRef(A);
  }, me.useState = function(A) {
    return h.H.useState(A);
  }, me.useSyncExternalStore = function(A, J, ae) {
    return h.H.useSyncExternalStore(
      A,
      J,
      ae
    );
  }, me.useTransition = function() {
    return h.H.useTransition();
  }, me.version = "19.2.8", me;
}
var jf;
function L0() {
  return jf || (jf = 1, So.exports = q0()), So.exports;
}
var Q = L0();
const Lp = /* @__PURE__ */ dc(Q), G0 = /* @__PURE__ */ sc({
  __proto__: null,
  default: Lp
}, [Q]);
//! "react" as the runtime bundles it, for its own code, the stock screens and every screen's `react` import: React
//! itself, with `useEffect` and `useLayoutEffect` run through `measured` (`dom.mjs`), so an effect that measures a
//! box the engine has not laid out yet runs again once it has (layout readback).
const Y0 = Lp ?? G0;
function Ie(n, a) {
  return Q.useEffect(Hp(n), a);
}
function gi(n, a) {
  return Q.useLayoutEffect(Hp(n), a);
}
const Q0 = /* @__PURE__ */ sc({
  __proto__: null,
  default: Y0,
  useEffect: Ie,
  useLayoutEffect: gi
}, [Q]);
var Eo = { exports: {} }, Dl = {};
/**
 * @license React
 * react-jsx-runtime.production.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var Of;
function V0() {
  if (Of) return Dl;
  Of = 1;
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
var Df;
function K0() {
  return Df || (Df = 1, Eo.exports = V0()), Eo.exports;
}
var te = K0();
const Z0 = /* @__PURE__ */ dc(te), b4 = /* @__PURE__ */ sc({
  __proto__: null,
  default: Z0
}, [te]);
var zo = { exports: {} }, No = { exports: {} };
const X0 = /* @__PURE__ */ U0(Q0);
var To = { exports: {} }, Co = {};
/**
 * @license React
 * scheduler.production.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var Bf;
function J0() {
  return Bf || (Bf = 1, (function(n) {
    function a(q, Z) {
      var I = q.length;
      q.push(Z);
      e: for (; 0 < I; ) {
        var V = I - 1 >>> 1, K = q[V];
        if (0 < s(K, Z))
          q[V] = Z, q[I] = K, I = V;
        else break e;
      }
    }
    function r(q) {
      return q.length === 0 ? null : q[0];
    }
    function i(q) {
      if (q.length === 0) return null;
      var Z = q[0], I = q.pop();
      if (I !== Z) {
        q[0] = I;
        e: for (var V = 0, K = q.length, A = K >>> 1; V < A; ) {
          var J = 2 * (V + 1) - 1, ae = q[J], oe = J + 1, ce = q[oe];
          if (0 > s(ae, I))
            oe < K && 0 > s(ce, ae) ? (q[V] = ce, q[oe] = I, V = oe) : (q[V] = ae, q[J] = I, V = J);
          else if (oe < K && 0 > s(ce, I))
            q[V] = ce, q[oe] = I, V = oe;
          else break e;
        }
      }
      return Z;
    }
    function s(q, Z) {
      var I = q.sortIndex - Z.sortIndex;
      return I !== 0 ? I : q.id - Z.id;
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
    var m = [], g = [], y = 1, v = null, b = 3, S = !1, E = !1, j = !1, z = !1, R = typeof setTimeout == "function" ? setTimeout : null, O = typeof clearTimeout == "function" ? clearTimeout : null, H = typeof setImmediate < "u" ? setImmediate : null;
    function X(q) {
      for (var Z = r(g); Z !== null; ) {
        if (Z.callback === null) i(g);
        else if (Z.startTime <= q)
          i(g), Z.sortIndex = Z.expirationTime, a(m, Z);
        else break;
        Z = r(g);
      }
    }
    function $(q) {
      if (j = !1, X(q), !E)
        if (r(m) !== null)
          E = !0, T || (T = !0, N());
        else {
          var Z = r(g);
          Z !== null && W($, Z.startTime - q);
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
        var Z = !0;
        try {
          e: {
            E = !1, j && (j = !1, O(h), h = -1), S = !0;
            var I = b;
            try {
              t: {
                for (X(q), v = r(m); v !== null && !(v.expirationTime > q && _()); ) {
                  var V = v.callback;
                  if (typeof V == "function") {
                    v.callback = null, b = v.priorityLevel;
                    var K = V(
                      v.expirationTime <= q
                    );
                    if (q = n.unstable_now(), typeof K == "function") {
                      v.callback = K, X(q), Z = !0;
                      break t;
                    }
                    v === r(m) && i(m), X(q);
                  } else i(m);
                  v = r(m);
                }
                if (v !== null) Z = !0;
                else {
                  var A = r(g);
                  A !== null && W(
                    $,
                    A.startTime - q
                  ), Z = !1;
                }
              }
              break e;
            } finally {
              v = null, b = I, S = !1;
            }
            Z = void 0;
          }
        } finally {
          Z ? N() : T = !1;
        }
      }
    }
    var N;
    if (typeof H == "function")
      N = function() {
        H(C);
      };
    else if (typeof MessageChannel < "u") {
      var D = new MessageChannel(), L = D.port2;
      D.port1.onmessage = C, N = function() {
        L.postMessage(null);
      };
    } else
      N = function() {
        R(C, 0);
      };
    function W(q, Z) {
      h = R(function() {
        q(n.unstable_now());
      }, Z);
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
          var Z = 3;
          break;
        default:
          Z = b;
      }
      var I = b;
      b = Z;
      try {
        return q();
      } finally {
        b = I;
      }
    }, n.unstable_requestPaint = function() {
      z = !0;
    }, n.unstable_runWithPriority = function(q, Z) {
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
        return Z();
      } finally {
        b = I;
      }
    }, n.unstable_scheduleCallback = function(q, Z, I) {
      var V = n.unstable_now();
      switch (typeof I == "object" && I !== null ? (I = I.delay, I = typeof I == "number" && 0 < I ? V + I : V) : I = V, q) {
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
      return K = I + K, q = {
        id: y++,
        callback: Z,
        priorityLevel: q,
        startTime: I,
        expirationTime: K,
        sortIndex: -1
      }, I > V ? (q.sortIndex = I, a(g, q), r(m) === null && q === r(g) && (j ? (O(h), h = -1) : j = !0, W($, I - V))) : (q.sortIndex = K, a(m, q), E || S || (E = !0, T || (T = !0, N()))), q;
    }, n.unstable_shouldYield = _, n.unstable_wrapCallback = function(q) {
      var Z = b;
      return function() {
        var I = b;
        b = Z;
        try {
          return q.apply(this, arguments);
        } finally {
          b = I;
        }
      };
    };
  })(Co)), Co;
}
var Hf;
function $0() {
  return Hf || (Hf = 1, To.exports = J0()), To.exports;
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
var Uf;
function W0() {
  return Uf || (Uf = 1, (function(n) {
    n.exports = function(a) {
      function r(e, t, l, o) {
        return new Eh(e, t, l, o);
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
            for (var x = !1, M = u.child; M; ) {
              if (M === l) {
                x = !0, l = u, o = p;
                break;
              }
              if (M === o) {
                x = !0, o = u, l = p;
                break;
              }
              M = M.sibling;
            }
            if (!x) {
              for (M = p.child; M; ) {
                if (M === l) {
                  x = !0, l = p, o = u;
                  break;
                }
                if (M === o) {
                  x = !0, o = p, l = u;
                  break;
                }
                M = M.sibling;
              }
              if (!x) throw Error(s(189));
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
      function y(e) {
        return e === null || typeof e != "object" ? null : (e = Kd && e[Kd] || e["@@iterator"], typeof e == "function" ? e : null);
      }
      function v(e) {
        if (e == null) return null;
        if (typeof e == "function")
          return e.$$typeof === Ah ? null : e.displayName || e.name || null;
        if (typeof e == "string") return e;
        switch (e) {
          case Ra:
            return "Fragment";
          case Qs:
            return "Profiler";
          case Qd:
            return "StrictMode";
          case Ks:
            return "Suspense";
          case Zs:
            return "SuspenseList";
          case Js:
            return "Activity";
        }
        if (typeof e == "object")
          switch (e.$$typeof) {
            case Ma:
              return "Portal";
            case An:
              return e.displayName || "Context";
            case Vd:
              return (e._context.displayName || "Context") + ".Consumer";
            case Vs:
              var t = e.render;
              return e = e.displayName, e || (e = t.displayName || t.name || "", e = e !== "" ? "ForwardRef(" + e + ")" : "ForwardRef"), e;
            case Xs:
              return t = e.displayName || null, t !== null ? t : v(e.type) || "Memo";
            case Mn:
              t = e._payload, e = e._init;
              try {
                return v(e(t));
              } catch {
              }
          }
        return null;
      }
      function b(e) {
        return { current: e };
      }
      function S(e) {
        0 > Da || (e.current = eo[Da], eo[Da] = null, Da--);
      }
      function E(e, t) {
        Da++, eo[Da] = e.current, e.current = t;
      }
      function j(e) {
        return e >>>= 0, e === 0 ? 32 : 31 - (l0(e) / r0 | 0) | 0;
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
      function R(e, t, l) {
        var o = e.pendingLanes;
        if (o === 0) return 0;
        var u = 0, p = e.suspendedLanes, x = e.pingedLanes;
        e = e.warmLanes;
        var M = o & 134217727;
        return M !== 0 ? (o = M & ~p, o !== 0 ? u = z(o) : (x &= M, x !== 0 ? u = z(x) : l || (l = M & ~e, l !== 0 && (u = z(l))))) : (M = o & ~p, M !== 0 ? u = z(M) : x !== 0 ? u = z(x) : l || (l = o & ~e, l !== 0 && (u = z(l)))), u === 0 ? 0 : t !== 0 && t !== u && (t & p) === 0 && (p = u & -u, l = t & -t, p >= l || p === 32 && (l & 4194048) !== 0) ? t : u;
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
      function X() {
        var e = Rr;
        return Rr <<= 1, (Rr & 62914560) === 0 && (Rr = 4194304), e;
      }
      function $(e) {
        for (var t = [], l = 0; 31 > l; l++) t.push(e);
        return t;
      }
      function T(e, t) {
        e.pendingLanes |= t, t !== 268435456 && (e.suspendedLanes = 0, e.pingedLanes = 0, e.warmLanes = 0);
      }
      function h(e, t, l, o, u, p) {
        var x = e.pendingLanes;
        e.pendingLanes = l, e.suspendedLanes = 0, e.pingedLanes = 0, e.warmLanes = 0, e.expiredLanes &= l, e.entangledLanes &= l, e.errorRecoveryDisabledLanes &= l, e.shellSuspendCounter = 0;
        var M = e.entanglements, Y = e.expirationTimes, F = e.hiddenUpdates;
        for (l = x & ~l; 0 < l; ) {
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
        o !== 0 && w(e, o, 0), p !== 0 && u === 0 && e.tag !== 0 && (e.suspendedLanes |= p & ~(x & ~t));
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
        if (typeof u0 == "function" && d0(e), Et && typeof Et.setStrictMode == "function")
          try {
            Et.setStrictMode(kl, e);
          } catch {
          }
      }
      function L(e, t) {
        return e === t && (e !== 0 || 1 / e === 1 / t) || e !== e && t !== t;
      }
      function W(e) {
        if (ao === void 0)
          try {
            throw Error();
          } catch (l) {
            var t = l.stack.trim().match(/\n( *(at )?)/);
            ao = t && t[1] || "", vf = -1 < l.stack.indexOf(`
    at`) ? " (<anonymous>)" : -1 < l.stack.indexOf("@") ? "@unknown:0:0" : "";
          }
        return `
` + ao + e + vf;
      }
      function q(e, t) {
        if (!e || lo) return "";
        lo = !0;
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
          var p = o.DetermineComponentFrameRoot(), x = p[0], M = p[1];
          if (x && M) {
            var Y = x.split(`
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
          lo = !1, Error.prepareStackTrace = l;
        }
        return (l = e ? e.displayName || e.name : "") ? W(l) : "";
      }
      function Z(e, t) {
        switch (e.tag) {
          case 26:
          case 27:
          case 5:
            return W(e.type);
          case 16:
            return W("Lazy");
          case 13:
            return e.child !== t && t !== null ? W("Suspense Fallback") : W("Suspense");
          case 19:
            return W("SuspenseList");
          case 0:
          case 15:
            return q(e.type, !1);
          case 11:
            return q(e.type.render, !1);
          case 1:
            return q(e.type, !0);
          case 31:
            return W("Activity");
          default:
            return "";
        }
      }
      function I(e) {
        try {
          var t = "", l = null;
          do
            t += Z(e, l), l = e, e = e.return;
          while (e);
          return t;
        } catch (o) {
          return `
Error generating stack: ` + o.message + `
` + o.stack;
        }
      }
      function V(e, t) {
        if (typeof e == "object" && e !== null) {
          var l = yf.get(e);
          return l !== void 0 ? l : (t = {
            value: e,
            source: t,
            stack: I(t)
          }, yf.set(e, t), t);
        }
        return {
          value: e,
          source: t,
          stack: I(t)
        };
      }
      function K(e, t) {
        Ha[Ua++] = _l, Ha[Ua++] = Or, Or = e, _l = t;
      }
      function A(e, t, l) {
        Rt[jt++] = Ft, Rt[jt++] = It, Rt[jt++] = Rn, Rn = e;
        var o = Ft;
        e = It;
        var u = 32 - St(o) - 1;
        o &= ~(1 << u), l += 1;
        var p = 32 - St(t) + u;
        if (30 < p) {
          var x = u - u % 5;
          p = (o & (1 << x) - 1).toString(32), o >>= x, u -= x, Ft = 1 << 32 - St(t) + u | l << u | o, It = p + e;
        } else
          Ft = 1 << p | l << u | o, It = e;
      }
      function J(e) {
        e.return !== null && (K(e, 1), A(e, 1, 0));
      }
      function ae(e) {
        for (; e === Or; )
          Or = Ha[--Ua], Ha[Ua] = null, _l = Ha[--Ua], Ha[Ua] = null;
        for (; e === Rn; )
          Rn = Rt[--jt], Rt[jt] = null, It = Rt[--jt], Rt[jt] = null, Ft = Rt[--jt], Rt[jt] = null;
      }
      function oe(e, t) {
        Rt[jt++] = Ft, Rt[jt++] = It, Rt[jt++] = Rn, Ft = t.id, It = t.overflow, Rn = e;
      }
      function ce(e, t) {
        E(jn, t), E(Sl, e), E(rt, null), e = jh(t), S(rt), E(rt, e);
      }
      function ue() {
        S(rt), S(Sl), S(jn);
      }
      function Ee(e) {
        e.memoizedState !== null && E(Dr, e);
        var t = rt.current, l = Oh(t, e.type);
        t !== l && (E(Sl, e), E(rt, l));
      }
      function Pe(e) {
        Sl.current === e && (S(rt), S(Sl)), Dr.current === e && (S(Dr), fn ? ia._currentValue = ja : ia._currentValue2 = ja);
      }
      function he(e) {
        var t = Error(
          s(
            418,
            1 < arguments.length && arguments[1] !== void 0 && arguments[1] ? "text" : "HTML",
            ""
          )
        );
        throw ll(V(t, e)), ro;
      }
      function Wn(e, t) {
        if (!ft) throw Error(s(175));
        Og(
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
        if ($e ? t !== 3 && t !== 27 && (t !== 5 || lf(e.type) && !Cr(e.type, e.memoizedProps)) && Be && he(e) : t !== 3 && (t !== 5 || lf(e.type) && !Cr(e.type, e.memoizedProps)) && Be && he(e), Fn(e), t === 13) {
          if (!ft) throw Error(s(316));
          if (e = e.memoizedState, e = e !== null ? e.dehydrated : null, !e) throw Error(s(317));
          Be = qg(e);
        } else if (t === 31) {
          if (e = e.memoizedState, e = e !== null ? e.dehydrated : null, !e) throw Error(s(317));
          Be = Ug(e);
        } else
          Be = $e && t === 27 ? Sg(
            e.type,
            Be
          ) : it ? af(e.stateNode) : null;
        return !0;
      }
      function Lt() {
        ft && (Be = it = null, Se = !1);
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
        fn ? (E(Br, t._currentValue), t._currentValue = l) : (E(Br, t._currentValue2), t._currentValue2 = l);
      }
      function rn(e) {
        var t = Br.current;
        fn ? e._currentValue = t : e._currentValue2 = t, S(Br);
      }
      function Li(e, t, l) {
        for (; e !== null; ) {
          var o = e.alternate;
          if ((e.childLanes & t) !== t ? (e.childLanes |= t, o !== null && (o.childLanes |= t)) : o !== null && (o.childLanes & t) !== t && (o.childLanes |= t), e === l) break;
          e = e.return;
        }
      }
      function Gi(e, t, l, o) {
        var u = e.child;
        for (u !== null && (u.return = e); u !== null; ) {
          var p = u.dependencies;
          if (p !== null) {
            var x = u.child;
            p = p.firstContext;
            e: for (; p !== null; ) {
              var M = p;
              p = u;
              for (var Y = 0; Y < t.length; Y++)
                if (M.context === t[Y]) {
                  p.lanes |= l, M = p.alternate, M !== null && (M.lanes |= l), Li(
                    p.return,
                    l,
                    e
                  ), o || (x = null);
                  break e;
                }
              p = M.next;
            }
          } else if (u.tag === 18) {
            if (x = u.return, x === null) throw Error(s(341));
            x.lanes |= l, p = x.alternate, p !== null && (p.lanes |= l), Li(x, l, e), x = null;
          } else x = u.child;
          if (x !== null) x.return = u;
          else
            for (x = u; x !== null; ) {
              if (x === e) {
                x = null;
                break;
              }
              if (u = x.sibling, u !== null) {
                u.return = x.return, x = u;
                break;
              }
              x = x.return;
            }
          u = x;
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
            var x = u.alternate;
            if (x === null) throw Error(s(387));
            if (x = x.memoizedProps, x !== null) {
              var M = u.type;
              zt(u.pendingProps.value, x.value) || (e !== null ? e.push(M) : e = [M]);
            }
          } else if (u === Dr.current) {
            if (x = u.alternate, x === null) throw Error(s(387));
            x.memoizedState.memoizedState !== u.memoizedState.memoizedState && (e !== null ? e.push(ia) : e = [ia]);
          }
          u = u.return;
        }
        e !== null && Gi(
          t,
          e,
          l,
          o
        ), t.flags |= 262144;
      }
      function Il(e) {
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
      function at(e) {
        return Mc(sa, e);
      }
      function Pl(e, t) {
        return sa === null && In(e), Mc(e, t);
      }
      function Mc(e, t) {
        var l = fn ? t._currentValue : t._currentValue2;
        if (t = { context: t, memoizedValue: l, next: null }, mn === null) {
          if (e === null) throw Error(s(308));
          mn = t, e.dependencies = { lanes: 0, firstContext: t }, e.flags |= 524288;
        } else mn = mn.next = t;
        return l;
      }
      function Yi() {
        return {
          controller: new p0(),
          data: /* @__PURE__ */ new Map(),
          refCount: 0
        };
      }
      function rl(e) {
        e.refCount--, e.refCount === 0 && m0(h0, function() {
          e.controller.abort();
        });
      }
      function er() {
      }
      function Jt(e) {
        e !== qa && e.next === null && (qa === null ? Hr = qa = e : qa = qa.next = e), Ur = !0, io || (io = !0, th());
      }
      function za(e, t) {
        if (!so && Ur) {
          so = !0;
          do
            for (var l = !1, o = Hr; o !== null; ) {
              if (e !== 0) {
                var u = o.pendingLanes;
                if (u === 0) var p = 0;
                else {
                  var x = o.suspendedLanes, M = o.pingedLanes;
                  p = (1 << 31 - St(42 | e) + 1) - 1, p &= u & ~(x & ~M), p = p & 201326741 ? p & 201326741 | 1 : p ? p | 2 : 0;
                }
                p !== 0 && (l = !0, Bc(o, p));
              } else
                p = _e, p = R(
                  o,
                  o === je ? p : 0,
                  o.cancelPendingCommit !== null || o.timeoutHandle !== ra
                ), (p & 3) === 0 || O(o, p) || (l = !0, Bc(o, p));
              o = o.next;
            }
          while (l);
          so = !1;
        }
      }
      function Rc() {
        jc();
      }
      function jc() {
        Ur = io = !1;
        var e = 0;
        oa !== 0 && Qh() && (e = oa);
        for (var t = vt(), l = null, o = Hr; o !== null; ) {
          var u = o.next, p = Oc(o, t);
          p === 0 ? (o.next = null, l === null ? Hr = u : l.next = u, u === null && (qa = l)) : (l = o, (e !== 0 || (p & 3) !== 0) && (Ur = !0)), o = u;
        }
        We !== 0 && We !== 5 || za(e), oa !== 0 && (oa = 0);
      }
      function Oc(e, t) {
        for (var l = e.suspendedLanes, o = e.pingedLanes, u = e.expirationTimes, p = e.pendingLanes & -62914561; 0 < p; ) {
          var x = 31 - St(p), M = 1 << x, Y = u[x];
          Y === -1 ? ((M & l) === 0 || (M & o) !== 0) && (u[x] = H(M, t)) : Y <= t && (e.expiredLanes |= M), p &= ~M;
        }
        if (t = je, l = _e, l = R(
          e,
          e === t ? l : 0,
          e.cancelPendingCommit !== null || e.timeoutHandle !== ra
        ), o = e.callbackNode, l === 0 || e === t && (Ae === 2 || Ae === 9) || e.cancelPendingCommit !== null)
          return o !== null && o !== null && to(o), e.callbackNode = null, e.callbackPriority = 0;
        if ((l & 3) === 0 || O(e, l)) {
          if (t = l & -l, t === e.callbackPriority) return t;
          switch (o !== null && to(o), N(l)) {
            case 2:
            case 8:
              l = o0;
              break;
            case 32:
              l = no;
              break;
            case 268435456:
              l = c0;
              break;
            default:
              l = no;
          }
          return o = Dc.bind(null, e), l = jr(l, o), e.callbackPriority = t, e.callbackNode = l, t;
        }
        return o !== null && o !== null && to(o), e.callbackPriority = 2, e.callbackNode = null, 2;
      }
      function Dc(e, t) {
        if (We !== 0 && We !== 5)
          return e.callbackNode = null, e.callbackPriority = 0, null;
        var l = e.callbackNode;
        if (vl() && e.callbackNode !== l)
          return null;
        var o = _e;
        return o = R(
          e,
          e === je ? o : 0,
          e.cancelPendingCommit !== null || e.timeoutHandle !== ra
        ), o === 0 ? null : (vd(e, o, t), Oc(e, vt()), e.callbackNode != null && e.callbackNode === l ? Dc.bind(null, e) : null);
      }
      function Bc(e, t) {
        if (vl()) return null;
        vd(e, t, !0);
      }
      function th() {
        Wh ? Fh(function() {
          (xe & 6) !== 0 ? jr(
            gf,
            Rc
          ) : jc();
        }) : jr(
          gf,
          Rc
        );
      }
      function Qi() {
        if (oa === 0) {
          var e = La;
          e === 0 && (e = Ar, Ar <<= 1, (Ar & 261888) === 0 && (Ar = 256)), oa = e;
        }
        return oa;
      }
      function nh(e, t) {
        if (El === null) {
          var l = El = [];
          oo = 0, La = Qi(), Ga = {
            status: "pending",
            value: void 0,
            then: function(o) {
              l.push(o);
            }
          };
        }
        return oo++, t.then(Hc, Hc), t;
      }
      function Hc() {
        if (--oo === 0 && El !== null) {
          Ga !== null && (Ga.status = "fulfilled");
          var e = El;
          El = null, La = 0, Ga = null;
          for (var t = 0; t < e.length; t++) (0, e[t])();
        }
      }
      function ah(e, t) {
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
      function Vi() {
        var e = ca.current;
        return e !== null ? e : je.pooledCache;
      }
      function tr(e, t) {
        t === null ? E(ca, ca.current) : E(ca, t.pool);
      }
      function Uc() {
        var e = Vi();
        return e === null ? null : {
          parent: fn ? He._currentValue : He._currentValue2,
          pool: e
        };
      }
      function nr(e, t) {
        if (zt(e, t)) return !0;
        if (typeof e != "object" || e === null || typeof t != "object" || t === null)
          return !1;
        var l = Object.keys(e), o = Object.keys(t);
        if (l.length !== o.length) return !1;
        for (o = 0; o < l.length; o++) {
          var u = l[o];
          if (!f0.call(t, u) || !zt(e[u], t[u]))
            return !1;
        }
        return !0;
      }
      function qc(e) {
        return e = e.status, e === "fulfilled" || e === "rejected";
      }
      function Lc(e, t, l) {
        switch (l = e[l], l === void 0 ? e.push(t) : l !== t && (t.then(er, er), t = l), t.status) {
          case "fulfilled":
            return t.value;
          case "rejected":
            throw e = t.reason, Yc(e), e;
          default:
            if (typeof t.status == "string") t.then(er, er);
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
                throw e = t.reason, Yc(e), e;
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
      function Gc() {
        if (ua === null) throw Error(s(459));
        var e = ua;
        return ua = null, e;
      }
      function Yc(e) {
        if (e === Ya || e === qr)
          throw Error(s(483));
      }
      function ar(e) {
        var t = zl;
        return zl += 1, Qa === null && (Qa = []), Lc(Qa, e, t);
      }
      function il(e, t) {
        t = t.props.ref, e.ref = t !== void 0 ? t : null;
      }
      function lr(e, t) {
        throw t.$$typeof === Th ? Error(s(525)) : (e = Object.prototype.toString.call(t), Error(
          s(
            31,
            e === "[object Object]" ? "object with keys {" + Object.keys(t).join(", ") + "}" : e
          )
        ));
      }
      function Qc(e) {
        function t(U, B) {
          if (e) {
            var G = U.deletions;
            G === null ? (U.deletions = [B], U.flags |= 16) : G.push(B);
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
        function p(U, B, G) {
          return U.index = G, e ? (G = U.alternate, G !== null ? (G = G.index, G < B ? (U.flags |= 67108866, B) : G) : (U.flags |= 67108866, B)) : (U.flags |= 1048576, B);
        }
        function x(U) {
          return e && U.alternate === null && (U.flags |= 67108866), U;
        }
        function M(U, B, G, ee) {
          return B === null || B.tag !== 6 ? (B = qs(G, U.mode, ee), B.return = U, B) : (B = u(B, G), B.return = U, B);
        }
        function Y(U, B, G, ee) {
          var fe = G.type;
          return fe === Ra ? ne(
            U,
            B,
            G.props.children,
            ee,
            G.key
          ) : B !== null && (B.elementType === fe || typeof fe == "object" && fe !== null && fe.$$typeof === Mn && Pn(fe) === B.type) ? (B = u(B, G.props), il(B, G), B.return = U, B) : (B = zr(
            G.type,
            G.key,
            G.props,
            null,
            U.mode,
            ee
          ), il(B, G), B.return = U, B);
        }
        function F(U, B, G, ee) {
          return B === null || B.tag !== 4 || B.stateNode.containerInfo !== G.containerInfo || B.stateNode.implementation !== G.implementation ? (B = Ls(G, U.mode, ee), B.return = U, B) : (B = u(B, G.children || []), B.return = U, B);
        }
        function ne(U, B, G, ee, fe) {
          return B === null || B.tag !== 7 ? (B = la(
            G,
            U.mode,
            ee,
            fe
          ), B.return = U, B) : (B = u(B, G), B.return = U, B);
        }
        function P(U, B, G) {
          if (typeof B == "string" && B !== "" || typeof B == "number" || typeof B == "bigint")
            return B = qs(
              "" + B,
              U.mode,
              G
            ), B.return = U, B;
          if (typeof B == "object" && B !== null) {
            switch (B.$$typeof) {
              case Nr:
                return G = zr(
                  B.type,
                  B.key,
                  B.props,
                  null,
                  U.mode,
                  G
                ), il(G, B), G.return = U, G;
              case Ma:
                return B = Ls(
                  B,
                  U.mode,
                  G
                ), B.return = U, B;
              case Mn:
                return B = Pn(B), P(U, B, G);
            }
            if (Tr(B) || y(B))
              return B = la(
                B,
                U.mode,
                G,
                null
              ), B.return = U, B;
            if (typeof B.then == "function")
              return P(U, ar(B), G);
            if (B.$$typeof === An)
              return P(
                U,
                Pl(U, B),
                G
              );
            lr(U, B);
          }
          return null;
        }
        function le(U, B, G, ee) {
          var fe = B !== null ? B.key : null;
          if (typeof G == "string" && G !== "" || typeof G == "number" || typeof G == "bigint")
            return fe !== null ? null : M(U, B, "" + G, ee);
          if (typeof G == "object" && G !== null) {
            switch (G.$$typeof) {
              case Nr:
                return G.key === fe ? Y(U, B, G, ee) : null;
              case Ma:
                return G.key === fe ? F(U, B, G, ee) : null;
              case Mn:
                return G = Pn(G), le(U, B, G, ee);
            }
            if (Tr(G) || y(G))
              return fe !== null ? null : ne(U, B, G, ee, null);
            if (typeof G.then == "function")
              return le(
                U,
                B,
                ar(G),
                ee
              );
            if (G.$$typeof === An)
              return le(
                U,
                B,
                Pl(U, G),
                ee
              );
            lr(U, G);
          }
          return null;
        }
        function ge(U, B, G, ee, fe) {
          if (typeof ee == "string" && ee !== "" || typeof ee == "number" || typeof ee == "bigint")
            return U = U.get(G) || null, M(B, U, "" + ee, fe);
          if (typeof ee == "object" && ee !== null) {
            switch (ee.$$typeof) {
              case Nr:
                return U = U.get(
                  ee.key === null ? G : ee.key
                ) || null, Y(B, U, ee, fe);
              case Ma:
                return U = U.get(
                  ee.key === null ? G : ee.key
                ) || null, F(B, U, ee, fe);
              case Mn:
                return ee = Pn(ee), ge(
                  U,
                  B,
                  G,
                  ee,
                  fe
                );
            }
            if (Tr(ee) || y(ee))
              return U = U.get(G) || null, ne(B, U, ee, fe, null);
            if (typeof ee.then == "function")
              return ge(
                U,
                B,
                G,
                ar(ee),
                fe
              );
            if (ee.$$typeof === An)
              return ge(
                U,
                B,
                G,
                Pl(B, ee),
                fe
              );
            lr(B, ee);
          }
          return null;
        }
        function st(U, B, G, ee) {
          for (var fe = null, Ue = null, pe = B, Te = B = 0, nt = null; pe !== null && Te < G.length; Te++) {
            pe.index > Te ? (nt = pe, pe = null) : nt = pe.sibling;
            var Ce = le(
              U,
              pe,
              G[Te],
              ee
            );
            if (Ce === null) {
              pe === null && (pe = nt);
              break;
            }
            e && pe && Ce.alternate === null && t(U, pe), B = p(Ce, B, Te), Ue === null ? fe = Ce : Ue.sibling = Ce, Ue = Ce, pe = nt;
          }
          if (Te === G.length)
            return l(U, pe), Se && K(U, Te), fe;
          if (pe === null) {
            for (; Te < G.length; Te++)
              pe = P(U, G[Te], ee), pe !== null && (B = p(
                pe,
                B,
                Te
              ), Ue === null ? fe = pe : Ue.sibling = pe, Ue = pe);
            return Se && K(U, Te), fe;
          }
          for (pe = o(pe); Te < G.length; Te++)
            nt = ge(
              pe,
              U,
              Te,
              G[Te],
              ee
            ), nt !== null && (e && nt.alternate !== null && pe.delete(
              nt.key === null ? Te : nt.key
            ), B = p(
              nt,
              B,
              Te
            ), Ue === null ? fe = nt : Ue.sibling = nt, Ue = nt);
          return e && pe.forEach(function(Ln) {
            return t(U, Ln);
          }), Se && K(U, Te), fe;
        }
        function jl(U, B, G, ee) {
          if (G == null) throw Error(s(151));
          for (var fe = null, Ue = null, pe = B, Te = B = 0, nt = null, Ce = G.next(); pe !== null && !Ce.done; Te++, Ce = G.next()) {
            pe.index > Te ? (nt = pe, pe = null) : nt = pe.sibling;
            var Ln = le(U, pe, Ce.value, ee);
            if (Ln === null) {
              pe === null && (pe = nt);
              break;
            }
            e && pe && Ln.alternate === null && t(U, pe), B = p(Ln, B, Te), Ue === null ? fe = Ln : Ue.sibling = Ln, Ue = Ln, pe = nt;
          }
          if (Ce.done)
            return l(U, pe), Se && K(U, Te), fe;
          if (pe === null) {
            for (; !Ce.done; Te++, Ce = G.next())
              Ce = P(U, Ce.value, ee), Ce !== null && (B = p(
                Ce,
                B,
                Te
              ), Ue === null ? fe = Ce : Ue.sibling = Ce, Ue = Ce);
            return Se && K(U, Te), fe;
          }
          for (pe = o(pe); !Ce.done; Te++, Ce = G.next())
            Ce = ge(
              pe,
              U,
              Te,
              Ce.value,
              ee
            ), Ce !== null && (e && Ce.alternate !== null && pe.delete(Ce.key === null ? Te : Ce.key), B = p(Ce, B, Te), Ue === null ? fe = Ce : Ue.sibling = Ce, Ue = Ce);
          return e && pe.forEach(function(y0) {
            return t(U, y0);
          }), Se && K(U, Te), fe;
        }
        function ma(U, B, G, ee) {
          if (typeof G == "object" && G !== null && G.type === Ra && G.key === null && (G = G.props.children), typeof G == "object" && G !== null) {
            switch (G.$$typeof) {
              case Nr:
                e: {
                  for (var fe = G.key; B !== null; ) {
                    if (B.key === fe) {
                      if (fe = G.type, fe === Ra) {
                        if (B.tag === 7) {
                          l(
                            U,
                            B.sibling
                          ), ee = u(
                            B,
                            G.props.children
                          ), ee.return = U, U = ee;
                          break e;
                        }
                      } else if (B.elementType === fe || typeof fe == "object" && fe !== null && fe.$$typeof === Mn && Pn(fe) === B.type) {
                        l(
                          U,
                          B.sibling
                        ), ee = u(B, G.props), il(ee, G), ee.return = U, U = ee;
                        break e;
                      }
                      l(U, B);
                      break;
                    } else t(U, B);
                    B = B.sibling;
                  }
                  G.type === Ra ? (ee = la(
                    G.props.children,
                    U.mode,
                    ee,
                    G.key
                  ), ee.return = U, U = ee) : (ee = zr(
                    G.type,
                    G.key,
                    G.props,
                    null,
                    U.mode,
                    ee
                  ), il(ee, G), ee.return = U, U = ee);
                }
                return x(U);
              case Ma:
                e: {
                  for (fe = G.key; B !== null; ) {
                    if (B.key === fe)
                      if (B.tag === 4 && B.stateNode.containerInfo === G.containerInfo && B.stateNode.implementation === G.implementation) {
                        l(
                          U,
                          B.sibling
                        ), ee = u(
                          B,
                          G.children || []
                        ), ee.return = U, U = ee;
                        break e;
                      } else {
                        l(U, B);
                        break;
                      }
                    else t(U, B);
                    B = B.sibling;
                  }
                  ee = Ls(G, U.mode, ee), ee.return = U, U = ee;
                }
                return x(U);
              case Mn:
                return G = Pn(G), ma(
                  U,
                  B,
                  G,
                  ee
                );
            }
            if (Tr(G))
              return st(
                U,
                B,
                G,
                ee
              );
            if (y(G)) {
              if (fe = y(G), typeof fe != "function")
                throw Error(s(150));
              return G = fe.call(G), jl(
                U,
                B,
                G,
                ee
              );
            }
            if (typeof G.then == "function")
              return ma(
                U,
                B,
                ar(G),
                ee
              );
            if (G.$$typeof === An)
              return ma(
                U,
                B,
                Pl(U, G),
                ee
              );
            lr(U, G);
          }
          return typeof G == "string" && G !== "" || typeof G == "number" || typeof G == "bigint" ? (G = "" + G, B !== null && B.tag === 6 ? (l(U, B.sibling), ee = u(B, G), ee.return = U, U = ee) : (l(U, B), ee = qs(G, U.mode, ee), ee.return = U, U = ee), x(U)) : l(U, B);
        }
        return function(U, B, G, ee) {
          try {
            zl = 0;
            var fe = ma(
              U,
              B,
              G,
              ee
            );
            return Qa = null, fe;
          } catch (pe) {
            if (pe === Ya || pe === qr) throw pe;
            var Ue = r(29, pe, null, U.mode);
            return Ue.lanes = ee, Ue.return = U, Ue;
          } finally {
          }
        };
      }
      function rr() {
        for (var e = Va, t = uo = Va = 0; t < e; ) {
          var l = Dt[t];
          Dt[t++] = null;
          var o = Dt[t];
          Dt[t++] = null;
          var u = Dt[t];
          Dt[t++] = null;
          var p = Dt[t];
          if (Dt[t++] = null, o !== null && u !== null) {
            var x = o.pending;
            x === null ? u.next = u : (u.next = x.next, x.next = u), o.pending = u;
          }
          p !== 0 && Vc(l, u, p);
        }
      }
      function ir(e, t, l, o) {
        Dt[Va++] = e, Dt[Va++] = t, Dt[Va++] = l, Dt[Va++] = o, uo |= o, e.lanes |= o, e = e.alternate, e !== null && (e.lanes |= o);
      }
      function Ki(e, t, l, o) {
        return ir(e, t, l, o), sr(e);
      }
      function ea(e, t) {
        return ir(e, null, null, t), sr(e);
      }
      function Vc(e, t, l) {
        e.lanes |= l;
        var o = e.alternate;
        o !== null && (o.lanes |= l);
        for (var u = !1, p = e.return; p !== null; )
          p.childLanes |= l, o = p.alternate, o !== null && (o.childLanes |= l), p.tag === 22 && (e = p.stateNode, e === null || e._visibility & 1 || (u = !0)), e = p, p = p.return;
        return e.tag === 3 ? (p = e.stateNode, u && t !== null && (u = 31 - St(l), e = p.hiddenUpdates, o = e[u], o === null ? e[u] = [t] : o.push(t), t.lane = l | 536870912), p) : null;
      }
      function sr(e) {
        if (50 < Rl)
          throw Rl = 0, _o = null, Error(s(185));
        for (var t = e.return; t !== null; )
          e = t, t = e.return;
        return e.tag === 3 ? e.stateNode : null;
      }
      function Zi(e) {
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
          return u === null ? t.next = t : (t.next = u.next, u.next = t), o.pending = t, t = sr(e), Vc(e, null, l), t;
        }
        return ir(e, o, t, l), sr(e);
      }
      function sl(e, t, l) {
        if (t = t.updateQueue, t !== null && (t = t.shared, (l & 4194048) !== 0)) {
          var o = t.lanes;
          o &= e.pendingLanes, l |= o, t.lanes = l, k(e, l);
        }
      }
      function Ji(e, t) {
        var l = e.updateQueue, o = e.alternate;
        if (o !== null && (o = o.updateQueue, l === o)) {
          var u = null, p = null;
          if (l = l.firstBaseUpdate, l !== null) {
            do {
              var x = {
                lane: l.lane,
                tag: l.tag,
                payload: l.payload,
                callback: null,
                next: null
              };
              p === null ? u = p = x : p = p.next = x, l = l.next;
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
        if (fo) {
          var e = Ga;
          if (e !== null) throw e;
        }
      }
      function cl(e, t, l, o) {
        fo = !1;
        var u = e.updateQueue;
        Dn = !1;
        var p = u.firstBaseUpdate, x = u.lastBaseUpdate, M = u.shared.pending;
        if (M !== null) {
          u.shared.pending = null;
          var Y = M, F = Y.next;
          Y.next = null, x === null ? p = F : x.next = F, x = Y;
          var ne = e.alternate;
          ne !== null && (ne = ne.updateQueue, M = ne.lastBaseUpdate, M !== x && (M === null ? ne.firstBaseUpdate = F : M.next = F, ne.lastBaseUpdate = Y));
        }
        if (p !== null) {
          var P = u.baseState;
          x = 0, ne = F = Y = null, M = p;
          do {
            var le = M.lane & -536870913, ge = le !== M.lane;
            if (ge ? (_e & le) === le : (o & le) === le) {
              le !== 0 && le === La && (fo = !0), ne !== null && (ne = ne.next = {
                lane: 0,
                tag: M.tag,
                payload: M.payload,
                callback: null,
                next: null
              });
              e: {
                var st = e, jl = M;
                le = t;
                var ma = l;
                switch (jl.tag) {
                  case 1:
                    if (st = jl.payload, typeof st == "function") {
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
                    if (st = jl.payload, le = typeof st == "function" ? st.call(ma, P, le) : st, le == null) break e;
                    P = Ys({}, P, le);
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
              }, ne === null ? (F = ne = ge, Y = P) : ne = ne.next = ge, x |= le;
            if (M = M.next, M === null) {
              if (M = u.shared.pending, M === null)
                break;
              ge = M, M = ge.next, ge.next = null, u.lastBaseUpdate = ge, u.shared.pending = null;
            }
          } while (!0);
          ne === null && (Y = P), u.baseState = Y, u.firstBaseUpdate = F, u.lastBaseUpdate = ne, p === null && (u.shared.lanes = 0), Hn |= x, e.lanes = x, e.memoizedState = P;
        }
      }
      function Kc(e, t) {
        if (typeof e != "function")
          throw Error(s(191, e));
        e.call(t);
      }
      function Zc(e, t) {
        var l = e.callbacks;
        if (l !== null)
          for (e.callbacks = null, e = 0; e < l.length; e++)
            Kc(l[e], t);
      }
      function Xc(e, t) {
        e = bn, E(Gr, e), E(Ka, t), bn = e | t.baseLanes;
      }
      function $i() {
        E(Gr, bn), E(Ka, Ka.current);
      }
      function Wi() {
        bn = Gr.current, S(Ka), S(Gr);
      }
      function zn(e) {
        var t = e.alternate;
        E(Ye, Ye.current & 1), E(Nt, e), Bt === null && (t === null || Ka.current !== null || t.memoizedState !== null) && (Bt = e);
      }
      function Fi(e) {
        E(Ye, Ye.current), E(Nt, e), Bt === null && (Bt = e);
      }
      function Jc(e) {
        e.tag === 22 ? (E(Ye, Ye.current), E(Nt, e), Bt === null && (Bt = e)) : Nn();
      }
      function Nn() {
        E(Ye, Ye.current), E(Nt, Nt.current);
      }
      function wt(e) {
        S(Nt), Bt === e && (Bt = null), S(Ye);
      }
      function or(e) {
        for (var t = e; t !== null; ) {
          if (t.tag === 13) {
            var l = t.memoizedState;
            if (l !== null && (l = l.dehydrated, l === null || Fs(l) || Is(l)))
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
      function Ii(e, t) {
        if (t === null) return !1;
        for (var l = 0; l < t.length && l < e.length; l++)
          if (!zt(e[l], t[l])) return !1;
        return !0;
      }
      function Pi(e, t, l, o, u, p) {
        return hn = p, be = t, t.memoizedState = null, t.updateQueue = null, t.lanes = 0, de.H = e === null || e.memoizedState === null ? kf : po, fa = !1, p = l(o, u), fa = !1, Za && (p = Wc(
          t,
          l,
          o,
          u
        )), $c(e), p;
      }
      function $c(e) {
        de.H = Tl;
        var t = Me !== null && Me.next !== null;
        if (hn = 0, Qe = Me = be = null, Yr = !1, Nl = 0, Xa = null, t) throw Error(s(300));
        e === null || Ve || (e = e.dependencies, e !== null && Il(e) && (Ve = !0));
      }
      function Wc(e, t, l, o) {
        be = e;
        var u = 0;
        do {
          if (Za && (Xa = null), Nl = 0, Za = !1, 25 <= u) throw Error(s(301));
          if (u += 1, Qe = Me = null, e.updateQueue != null) {
            var p = e.updateQueue;
            p.lastEffect = null, p.events = null, p.stores = null, p.memoCache != null && (p.memoCache.index = 0);
          }
          de.H = _f, p = t(l, o);
        } while (Za);
        return p;
      }
      function lh() {
        var e = de.H, t = e.useState()[0];
        return t = typeof t.then == "function" ? ul(t) : t, e = e.useState()[0], (Me !== null ? Me.memoizedState : null) !== e && (be.flags |= 1024), t;
      }
      function es() {
        var e = Qr !== 0;
        return Qr = 0, e;
      }
      function ts(e, t, l) {
        t.updateQueue = e.updateQueue, t.flags &= -2053, e.lanes &= ~l;
      }
      function ns(e) {
        if (Yr) {
          for (e = e.memoizedState; e !== null; ) {
            var t = e.queue;
            t !== null && (t.pending = null), e = e.next;
          }
          Yr = !1;
        }
        hn = 0, Qe = Me = be = null, Za = !1, Nl = Qr = 0, Xa = null;
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
      function Ge() {
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
      function cr() {
        return { lastEffect: null, events: null, stores: null, memoCache: null };
      }
      function ul(e) {
        var t = Nl;
        return Nl += 1, Xa === null && (Xa = []), e = Lc(Xa, e, t), t = be, (Qe === null ? t.memoizedState : Qe.next) === null && (t = t.alternate, de.H = t === null || t.memoizedState === null ? kf : po), e;
      }
      function ur(e) {
        if (e !== null && typeof e == "object") {
          if (typeof e.then == "function") return ul(e);
          if (e.$$typeof === An) return at(e);
        }
        throw Error(s(438, String(e)));
      }
      function as(e) {
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
        if (t == null && (t = { data: [], index: 0 }), l === null && (l = cr(), be.updateQueue = l), l.memoCache = t, l = t.data[t.index], l === void 0)
          for (l = t.data[t.index] = Array(e), o = 0; o < e; o++)
            l[o] = Ch;
        return t.index++, l;
      }
      function sn(e, t) {
        return typeof t == "function" ? t(e) : t;
      }
      function dr(e) {
        var t = Ge();
        return ls(t, Me, e);
      }
      function ls(e, t, l) {
        var o = e.queue;
        if (o === null) throw Error(s(311));
        o.lastRenderedReducer = l;
        var u = e.baseQueue, p = o.pending;
        if (p !== null) {
          if (u !== null) {
            var x = u.next;
            u.next = p.next, p.next = x;
          }
          t.baseQueue = u = p, o.pending = null;
        }
        if (p = e.baseState, u === null) e.memoizedState = p;
        else {
          t = u.next;
          var M = x = null, Y = null, F = t, ne = !1;
          do {
            var P = F.lane & -536870913;
            if (P !== F.lane ? (_e & P) === P : (hn & P) === P) {
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
                }), P === La && (ne = !0);
              else if ((hn & le) === le) {
                F = F.next, le === La && (ne = !0);
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
                }, Y === null ? (M = Y = P, x = p) : Y = Y.next = P, be.lanes |= le, Hn |= le;
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
              }, Y === null ? (M = Y = le, x = p) : Y = Y.next = le, be.lanes |= P, Hn |= P;
            F = F.next;
          } while (F !== null && F !== t);
          if (Y === null ? x = p : Y.next = M, !zt(p, e.memoizedState) && (Ve = !0, ne && (l = Ga, l !== null)))
            throw l;
          e.memoizedState = p, e.baseState = x, e.baseQueue = Y, o.lastRenderedState = p;
        }
        return u === null && (o.lanes = 0), [e.memoizedState, o.dispatch];
      }
      function rs(e) {
        var t = Ge(), l = t.queue;
        if (l === null) throw Error(s(311));
        l.lastRenderedReducer = e;
        var o = l.dispatch, u = l.pending, p = t.memoizedState;
        if (u !== null) {
          l.pending = null;
          var x = u = u.next;
          do
            p = e(p, x.action), x = x.next;
          while (x !== u);
          zt(p, t.memoizedState) || (Ve = !0), t.memoizedState = p, t.baseQueue === null && (t.baseState = p), l.lastRenderedState = p;
        }
        return [p, o];
      }
      function Fc(e, t, l) {
        var o = be, u = Ge(), p = Se;
        if (p) {
          if (l === void 0)
            throw Error(s(407));
          l = l();
        } else l = t();
        var x = !zt(
          (Me || u).memoizedState,
          l
        );
        if (x && (u.memoizedState = l, Ve = !0), u = u.queue, os(eu.bind(null, o, u, e), [
          e
        ]), u.getSnapshot !== t || x || Qe !== null && Qe.memoizedState.tag & 1) {
          if (o.flags |= 2048, Na(
            9,
            { destroy: void 0 },
            Pc.bind(
              null,
              o,
              u,
              l,
              t
            ),
            null
          ), je === null) throw Error(s(349));
          p || (hn & 127) !== 0 || Ic(o, t, l);
        }
        return l;
      }
      function Ic(e, t, l) {
        e.flags |= 16384, e = { getSnapshot: t, value: l }, t = be.updateQueue, t === null ? (t = cr(), be.updateQueue = t, t.stores = [e]) : (l = t.stores, l === null ? t.stores = [e] : l.push(e));
      }
      function Pc(e, t, l, o) {
        t.value = l, t.getSnapshot = o, tu(t) && nu(e);
      }
      function eu(e, t, l) {
        return l(function() {
          tu(t) && nu(e);
        });
      }
      function tu(e) {
        var t = e.getSnapshot;
        e = e.value;
        try {
          var l = t();
          return !zt(e, l);
        } catch {
          return !0;
        }
      }
      function nu(e) {
        var t = ea(e, 2);
        t !== null && bt(t, e, 2);
      }
      function is(e) {
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
      function au(e, t, l, o) {
        return e.baseState = l, ls(
          e,
          Me,
          typeof o == "function" ? o : sn
        );
      }
      function rh(e, t, l, o, u) {
        if (mr(e)) throw Error(s(485));
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
            then: function(x) {
              p.listeners.push(x);
            }
          };
          de.T !== null ? l(!0) : p.isTransition = !1, o(p), l = t.pending, l === null ? (p.next = t.pending = p, lu(t, p)) : (p.next = l.next, t.pending = l.next = p);
        }
      }
      function lu(e, t) {
        var l = t.action, o = t.payload, u = e.state;
        if (t.isTransition) {
          var p = de.T, x = {};
          de.T = x;
          try {
            var M = l(u, o), Y = de.S;
            Y !== null && Y(x, M), ru(e, t, M);
          } catch (F) {
            ss(e, t, F);
          } finally {
            p !== null && x.types !== null && (p.types = x.types), de.T = p;
          }
        } else
          try {
            p = l(u, o), ru(e, t, p);
          } catch (F) {
            ss(e, t, F);
          }
      }
      function ru(e, t, l) {
        l !== null && typeof l == "object" && typeof l.then == "function" ? l.then(
          function(o) {
            iu(e, t, o);
          },
          function(o) {
            return ss(e, t, o);
          }
        ) : iu(e, t, l);
      }
      function iu(e, t, l) {
        t.status = "fulfilled", t.value = l, su(t), e.state = l, t = e.pending, t !== null && (l = t.next, l === t ? e.pending = null : (l = l.next, t.next = l, lu(e, l)));
      }
      function ss(e, t, l) {
        var o = e.pending;
        if (e.pending = null, o !== null) {
          o = o.next;
          do
            t.status = "rejected", t.reason = l, su(t), t = t.next;
          while (t !== o);
        }
        e.action = null;
      }
      function su(e) {
        e = e.listeners;
        for (var t = 0; t < e.length; t++) (0, e[t])();
      }
      function ou(e, t) {
        return t;
      }
      function cu(e, t) {
        if (Se) {
          var l = je.formState;
          if (l !== null) {
            e: {
              var o = be;
              if (Se) {
                if (Be) {
                  var u = kg(
                    Be,
                    Ot
                  );
                  if (u) {
                    Be = af(u), o = _g(u);
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
          lastRenderedReducer: ou,
          lastRenderedState: t
        }, l.queue = o, l = Nu.bind(
          null,
          be,
          o
        ), o.dispatch = l, o = is(!1);
        var p = fs.bind(
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
        }, o.queue = u, l = rh.bind(
          null,
          be,
          u,
          p,
          l
        ), u.dispatch = l, o.memoizedState = e, [t, l, !1];
      }
      function uu(e) {
        var t = Ge();
        return du(t, Me, e);
      }
      function du(e, t, l) {
        if (t = ls(
          e,
          t,
          ou
        )[0], e = dr(sn)[0], typeof t == "object" && t !== null && typeof t.then == "function")
          try {
            var o = ul(t);
          } catch (x) {
            throw x === Ya ? qr : x;
          }
        else o = t;
        t = Ge();
        var u = t.queue, p = u.dispatch;
        return l !== t.memoizedState && (be.flags |= 2048, Na(
          9,
          { destroy: void 0 },
          ih.bind(null, u, l),
          null
        )), [o, p, e];
      }
      function ih(e, t) {
        e.action = t;
      }
      function fu(e) {
        var t = Ge(), l = Me;
        if (l !== null)
          return du(t, l, e);
        Ge(), t = t.memoizedState, l = Ge();
        var o = l.queue.dispatch;
        return l.memoizedState = e, [t, o, !1];
      }
      function Na(e, t, l, o) {
        return e = { tag: e, create: l, deps: o, inst: t, next: null }, t = be.updateQueue, t === null && (t = cr(), be.updateQueue = t), l = t.lastEffect, l === null ? t.lastEffect = e.next = e : (o = l.next, l.next = e, e.next = o, t.lastEffect = e), e;
      }
      function pu() {
        return Ge().memoizedState;
      }
      function fr(e, t, l, o) {
        var u = ht();
        be.flags |= e, u.memoizedState = Na(
          1 | t,
          { destroy: void 0 },
          l,
          o === void 0 ? null : o
        );
      }
      function pr(e, t, l, o) {
        var u = Ge();
        o = o === void 0 ? null : o;
        var p = u.memoizedState.inst;
        Me !== null && o !== null && Ii(o, Me.memoizedState.deps) ? u.memoizedState = Na(t, p, l, o) : (be.flags |= e, u.memoizedState = Na(
          1 | t,
          p,
          l,
          o
        ));
      }
      function mu(e, t) {
        fr(8390656, 8, e, t);
      }
      function os(e, t) {
        pr(2048, 8, e, t);
      }
      function sh(e) {
        be.flags |= 4;
        var t = be.updateQueue;
        if (t === null)
          t = cr(), be.updateQueue = t, t.events = [e];
        else {
          var l = t.events;
          l === null ? t.events = [e] : l.push(e);
        }
      }
      function hu(e) {
        var t = Ge().memoizedState;
        return sh({ ref: t, nextImpl: e }), function() {
          if ((xe & 2) !== 0)
            throw Error(s(440));
          return t.impl.apply(void 0, arguments);
        };
      }
      function gu(e, t) {
        return pr(4, 2, e, t);
      }
      function bu(e, t) {
        return pr(4, 4, e, t);
      }
      function vu(e, t) {
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
      function yu(e, t, l) {
        l = l != null ? l.concat([e]) : null, pr(
          4,
          4,
          vu.bind(null, t, e),
          l
        );
      }
      function cs() {
      }
      function xu(e, t) {
        var l = Ge();
        t = t === void 0 ? null : t;
        var o = l.memoizedState;
        return t !== null && Ii(t, o[1]) ? o[0] : (l.memoizedState = [e, t], e);
      }
      function wu(e, t) {
        var l = Ge();
        t = t === void 0 ? null : t;
        var o = l.memoizedState;
        if (t !== null && Ii(t, o[1]))
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
      function us(e, t, l) {
        return l === void 0 || (hn & 1073741824) !== 0 && (_e & 261930) === 0 ? e.memoizedState = t : (e.memoizedState = l, e = bd(), be.lanes |= e, Hn |= e, l);
      }
      function ku(e, t, l, o) {
        return zt(l, t) ? l : Ka.current !== null ? (e = us(e, l, o), zt(e, t) || (Ve = !0), e) : (hn & 42) === 0 || (hn & 1073741824) !== 0 && (_e & 261930) === 0 ? (Ve = !0, e.memoizedState = l) : (e = bd(), be.lanes |= e, Hn |= e, t);
      }
      function _u(e, t, l, o, u) {
        var p = pn();
        et(
          p !== 0 && 8 > p ? p : 8
        );
        var x = de.T, M = {};
        de.T = M, fs(e, !1, t, l);
        try {
          var Y = u(), F = de.S;
          if (F !== null && F(M, Y), Y !== null && typeof Y == "object" && typeof Y.then == "function") {
            var ne = ah(
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
          et(p), x !== null && M.types !== null && (x.types = M.types), de.T = x;
        }
      }
      function Su(e) {
        var t = e.memoizedState;
        if (t !== null) return t;
        t = {
          memoizedState: ja,
          baseState: ja,
          baseQueue: null,
          queue: {
            pending: null,
            lanes: 0,
            dispatch: null,
            lastRenderedReducer: sn,
            lastRenderedState: ja
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
      function ds() {
        return at(ia);
      }
      function Eu() {
        return Ge().memoizedState;
      }
      function zu() {
        return Ge().memoizedState;
      }
      function oh(e) {
        for (var t = e.return; t !== null; ) {
          switch (t.tag) {
            case 24:
            case 3:
              var l = kt();
              e = Sn(l);
              var o = En(t, e, l);
              o !== null && (bt(o, t, l), sl(o, t, l)), t = { cache: Yi() }, e.payload = t;
              return;
          }
          t = t.return;
        }
      }
      function ch(e, t, l) {
        var o = kt();
        l = {
          lane: o,
          revertLane: 0,
          gesture: null,
          action: l,
          hasEagerState: !1,
          eagerState: null,
          next: null
        }, mr(e) ? Tu(t, l) : (l = Ki(e, t, l, o), l !== null && (bt(l, e, o), Cu(l, t, o)));
      }
      function Nu(e, t, l) {
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
        if (mr(e)) Tu(t, u);
        else {
          var p = e.alternate;
          if (e.lanes === 0 && (p === null || p.lanes === 0) && (p = t.lastRenderedReducer, p !== null))
            try {
              var x = t.lastRenderedState, M = p(x, l);
              if (u.hasEagerState = !0, u.eagerState = M, zt(M, x))
                return ir(e, t, u, 0), je === null && rr(), !1;
            } catch {
            } finally {
            }
          if (l = Ki(e, t, u, o), l !== null)
            return bt(l, e, o), Cu(l, t, o), !0;
        }
        return !1;
      }
      function fs(e, t, l, o) {
        if (o = {
          lane: 2,
          revertLane: Qi(),
          gesture: null,
          action: o,
          hasEagerState: !1,
          eagerState: null,
          next: null
        }, mr(e)) {
          if (t) throw Error(s(479));
        } else
          t = Ki(
            e,
            l,
            o,
            2
          ), t !== null && bt(t, e, 2);
      }
      function mr(e) {
        var t = e.alternate;
        return e === be || t !== null && t === be;
      }
      function Tu(e, t) {
        Za = Yr = !0;
        var l = e.pending;
        l === null ? t.next = t : (t.next = l.next, l.next = t), e.pending = t;
      }
      function Cu(e, t, l) {
        if ((l & 4194048) !== 0) {
          var o = t.lanes;
          o &= e.pendingLanes, l |= o, t.lanes = l, k(e, l);
        }
      }
      function ps(e, t, l, o) {
        t = e.memoizedState, l = l(o, t), l = l == null ? t : Ys({}, t, l), e.memoizedState = l, e.lanes === 0 && (e.updateQueue.baseState = l);
      }
      function Au(e, t, l, o, u, p, x) {
        return e = e.stateNode, typeof e.shouldComponentUpdate == "function" ? e.shouldComponentUpdate(o, p, x) : t.prototype && t.prototype.isPureReactComponent ? !nr(l, o) || !nr(u, p) : !0;
      }
      function Mu(e, t, l, o) {
        e = t.state, typeof t.componentWillReceiveProps == "function" && t.componentWillReceiveProps(l, o), typeof t.UNSAFE_componentWillReceiveProps == "function" && t.UNSAFE_componentWillReceiveProps(l, o), t.state !== e && mo.enqueueReplaceState(t, t.state, null);
      }
      function ta(e, t) {
        var l = t;
        if ("ref" in t) {
          l = {};
          for (var o in t)
            o !== "ref" && (l[o] = t[o]);
        }
        if (e = e.defaultProps) {
          l === t && (l = Ys({}, l));
          for (var u in e)
            l[u] === void 0 && (l[u] = e[u]);
        }
        return l;
      }
      function hr(e, t) {
        try {
          var l = e.onUncaughtError;
          l(t.value, { componentStack: t.stack });
        } catch (o) {
          setTimeout(function() {
            throw o;
          });
        }
      }
      function Ru(e, t, l) {
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
      function ms(e, t, l) {
        return l = Sn(l), l.tag = 3, l.payload = { element: null }, l.callback = function() {
          hr(e, t);
        }, l;
      }
      function ju(e) {
        return e = Sn(e), e.tag = 3, e;
      }
      function Ou(e, t, l, o) {
        var u = l.type.getDerivedStateFromError;
        if (typeof u == "function") {
          var p = o.value;
          e.payload = function() {
            return u(p);
          }, e.callback = function() {
            Ru(t, l, o);
          };
        }
        var x = l.stateNode;
        x !== null && typeof x.componentDidCatch == "function" && (e.callback = function() {
          Ru(t, l, o), typeof u != "function" && (Un === null ? Un = /* @__PURE__ */ new Set([this]) : Un.add(this));
          var M = o.stack;
          this.componentDidCatch(o.value, {
            componentStack: M !== null ? M : ""
          });
        });
      }
      function uh(e, t, l, o, u) {
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
                return Bt === null ? Sr() : l.alternate === null && Le === 0 && (Le = 3), l.flags &= -257, l.flags |= 65536, l.lanes = u, o === Lr ? l.flags |= 16384 : (t = l.updateQueue, t === null ? l.updateQueue = /* @__PURE__ */ new Set([o]) : t.add(o), Hs(e, o, u)), !1;
              case 22:
                return l.flags |= 65536, o === Lr ? l.flags |= 16384 : (t = l.updateQueue, t === null ? (t = {
                  transitions: null,
                  markerInstances: null,
                  retryQueue: /* @__PURE__ */ new Set([o])
                }, l.updateQueue = t) : (l = t.retryQueue, l === null ? t.retryQueue = /* @__PURE__ */ new Set([o]) : l.add(o)), Hs(e, o, u)), !1;
            }
            throw Error(s(435, l.tag));
          }
          return Hs(e, o, u), Sr(), !1;
        }
        if (Se)
          return t = Nt.current, t !== null ? ((t.flags & 65536) === 0 && (t.flags |= 256), t.flags |= 65536, t.lanes = u, o !== ro && (e = Error(s(422), { cause: o }), ll(
            V(e, l)
          ))) : (o !== ro && (t = Error(s(423), {
            cause: o
          }), ll(
            V(t, l)
          )), e = e.current.alternate, e.flags |= 65536, u &= -u, e.lanes |= u, o = V(o, l), u = ms(
            e.stateNode,
            o,
            u
          ), Ji(e, u), Le !== 4 && (Le = 2)), !1;
        var p = Error(s(520), { cause: o });
        if (p = V(p, l), Al === null ? Al = [p] : Al.push(p), Le !== 4 && (Le = 2), t === null) return !0;
        o = V(o, l), l = t;
        do {
          switch (l.tag) {
            case 3:
              return l.flags |= 65536, e = u & -u, l.lanes |= e, e = ms(l.stateNode, o, e), Ji(l, e), !1;
            case 1:
              if (t = l.type, p = l.stateNode, (l.flags & 128) === 0 && (typeof t.getDerivedStateFromError == "function" || p !== null && typeof p.componentDidCatch == "function" && (Un === null || !Un.has(
                p
              ))))
                return l.flags |= 65536, u &= -u, l.lanes |= u, u = ju(u), Ou(
                  u,
                  e,
                  l,
                  o
                ), Ji(l, u), !1;
          }
          l = l.return;
        } while (l !== null);
        return !1;
      }
      function lt(e, t, l, o) {
        t.child = e === null ? wf(t, null, l, o) : da(
          t,
          e.child,
          l,
          o
        );
      }
      function Du(e, t, l, o, u) {
        l = l.render;
        var p = t.ref;
        if ("ref" in o) {
          var x = {};
          for (var M in o)
            M !== "ref" && (x[M] = o[M]);
        } else x = o;
        return In(t), o = Pi(
          e,
          t,
          l,
          x,
          p,
          u
        ), M = es(), e !== null && !Ve ? (ts(e, t, u), on(e, t, u)) : (Se && M && J(t), t.flags |= 1, lt(e, t, o, u), t.child);
      }
      function Bu(e, t, l, o, u) {
        if (e === null) {
          var p = l.type;
          return typeof p == "function" && !Us(p) && p.defaultProps === void 0 && l.compare === null ? (t.tag = 15, t.type = p, Hu(
            e,
            t,
            p,
            o,
            u
          )) : (e = zr(
            l.type,
            null,
            o,
            t,
            t.mode,
            u
          ), e.ref = t.ref, e.return = t, t.child = e);
        }
        if (p = e.child, !ws(e, u)) {
          var x = p.memoizedProps;
          if (l = l.compare, l = l !== null ? l : nr, l(x, o) && e.ref === t.ref)
            return on(
              e,
              t,
              u
            );
        }
        return t.flags |= 1, e = dn(p, o), e.ref = t.ref, e.return = t, t.child = e;
      }
      function Hu(e, t, l, o, u) {
        if (e !== null) {
          var p = e.memoizedProps;
          if (nr(p, o) && e.ref === t.ref)
            if (Ve = !1, t.pendingProps = o = p, ws(e, u))
              (e.flags & 131072) !== 0 && (Ve = !0);
            else
              return t.lanes = e.lanes, on(e, t, u);
        }
        return hs(
          e,
          t,
          l,
          o,
          u
        );
      }
      function Uu(e, t, l, o) {
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
            return qu(
              e,
              t,
              p,
              l,
              o
            );
          }
          if ((l & 536870912) !== 0)
            t.memoizedState = { baseLanes: 0, cachePool: null }, e !== null && tr(
              t,
              p !== null ? p.cachePool : null
            ), p !== null ? Xc(t, p) : $i(), Jc(t);
          else
            return o = t.lanes = 536870912, qu(
              e,
              t,
              p !== null ? p.baseLanes | l : l,
              l,
              o
            );
        } else
          p !== null ? (tr(t, p.cachePool), Xc(t, p), Nn(), t.memoizedState = null) : (e !== null && tr(t, null), $i(), Nn());
        return lt(e, t, u, l), t.child;
      }
      function fl(e, t) {
        return e !== null && e.tag === 22 || t.stateNode !== null || (t.stateNode = {
          _visibility: 1,
          _pendingMarkers: null,
          _retryCache: null,
          _transitions: null
        }), t.sibling;
      }
      function qu(e, t, l, o, u) {
        var p = Vi();
        return p = p === null ? null : {
          parent: fn ? He._currentValue : He._currentValue2,
          pool: p
        }, t.memoizedState = {
          baseLanes: l,
          cachePool: p
        }, e !== null && tr(t, null), $i(), Jc(t), e !== null && Ea(e, t, o, !0), t.childLanes = u, null;
      }
      function gr(e, t) {
        return t = vr(
          { mode: t.mode, children: t.children },
          e.mode
        ), t.ref = e.ref, e.child = t, t.return = e, t;
      }
      function Lu(e, t, l) {
        return da(t, e.child, null, l), e = gr(
          t,
          t.pendingProps
        ), e.flags |= 2, wt(t), t.memoizedState = null, e;
      }
      function dh(e, t, l) {
        var o = t.pendingProps, u = (t.flags & 128) !== 0;
        if (t.flags &= -129, e === null) {
          if (Se) {
            if (o.mode === "hidden")
              return e = gr(t, o), t.lanes = 536870912, fl(null, e);
            if (Fi(t), (e = Be) ? (e = Rg(
              e,
              Ot
            ), e !== null && (t.memoizedState = {
              dehydrated: e,
              treeContext: Rn !== null ? { id: Ft, overflow: It } : null,
              retryLane: 536870912,
              hydrationErrors: null
            }, l = Hd(e), l.return = t, t.child = l, it = t, Be = null)) : e = null, e === null) throw he(t);
            return t.lanes = 536870912, null;
          }
          return gr(t, o);
        }
        var p = e.memoizedState;
        if (p !== null) {
          var x = p.dehydrated;
          if (Fi(t), u)
            if (t.flags & 256)
              t.flags &= -257, t = Lu(
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
            if (o = je, o !== null && (x = _(o, l), x !== 0 && x !== p.retryLane))
              throw p.retryLane = x, ea(e, x), bt(o, e, x), ho;
            Sr(), t = Lu(
              e,
              t,
              l
            );
          } else
            e = p.treeContext, ft && (Be = Ng(x), it = t, Se = !0, On = null, Ot = !1, e !== null && oe(t, e)), t = gr(t, o), t.flags |= 4096;
          return t;
        }
        return e = dn(e.child, {
          mode: o.mode,
          children: o.children
        }), e.ref = t.ref, t.child = e, e.return = t, e;
      }
      function br(e, t) {
        var l = t.ref;
        if (l === null)
          e !== null && e.ref !== null && (t.flags |= 4194816);
        else {
          if (typeof l != "function" && typeof l != "object")
            throw Error(s(284));
          (e === null || e.ref !== l) && (t.flags |= 4194816);
        }
      }
      function hs(e, t, l, o, u) {
        return In(t), l = Pi(
          e,
          t,
          l,
          o,
          void 0,
          u
        ), o = es(), e !== null && !Ve ? (ts(e, t, u), on(e, t, u)) : (Se && o && J(t), t.flags |= 1, lt(e, t, l, u), t.child);
      }
      function Gu(e, t, l, o, u, p) {
        return In(t), t.updateQueue = null, l = Wc(
          t,
          o,
          l,
          u
        ), $c(e), o = es(), e !== null && !Ve ? (ts(e, t, p), on(e, t, p)) : (Se && o && J(t), t.flags |= 1, lt(e, t, l, p), t.child);
      }
      function Yu(e, t, l, o, u) {
        if (In(t), t.stateNode === null) {
          var p = Ba, x = l.contextType;
          typeof x == "object" && x !== null && (p = at(x)), p = new l(o, p), t.memoizedState = p.state !== null && p.state !== void 0 ? p.state : null, p.updater = mo, t.stateNode = p, p._reactInternals = t, p = t.stateNode, p.props = o, p.state = t.memoizedState, p.refs = {}, Zi(t), x = l.contextType, p.context = typeof x == "object" && x !== null ? at(x) : Ba, p.state = t.memoizedState, x = l.getDerivedStateFromProps, typeof x == "function" && (ps(
            t,
            l,
            x,
            o
          ), p.state = t.memoizedState), typeof l.getDerivedStateFromProps == "function" || typeof p.getSnapshotBeforeUpdate == "function" || typeof p.UNSAFE_componentWillMount != "function" && typeof p.componentWillMount != "function" || (x = p.state, typeof p.componentWillMount == "function" && p.componentWillMount(), typeof p.UNSAFE_componentWillMount == "function" && p.UNSAFE_componentWillMount(), x !== p.state && mo.enqueueReplaceState(
            p,
            p.state,
            null
          ), cl(t, o, p, u), ol(), p.state = t.memoizedState), typeof p.componentDidMount == "function" && (t.flags |= 4194308), o = !0;
        } else if (e === null) {
          p = t.stateNode;
          var M = t.memoizedProps, Y = ta(l, M);
          p.props = Y;
          var F = p.context, ne = l.contextType;
          x = Ba, typeof ne == "object" && ne !== null && (x = at(ne));
          var P = l.getDerivedStateFromProps;
          ne = typeof P == "function" || typeof p.getSnapshotBeforeUpdate == "function", M = t.pendingProps !== M, ne || typeof p.UNSAFE_componentWillReceiveProps != "function" && typeof p.componentWillReceiveProps != "function" || (M || F !== x) && Mu(
            t,
            p,
            o,
            x
          ), Dn = !1;
          var le = t.memoizedState;
          p.state = le, cl(t, o, p, u), ol(), F = t.memoizedState, M || le !== F || Dn ? (typeof P == "function" && (ps(
            t,
            l,
            P,
            o
          ), F = t.memoizedState), (Y = Dn || Au(
            t,
            l,
            Y,
            o,
            le,
            F,
            x
          )) ? (ne || typeof p.UNSAFE_componentWillMount != "function" && typeof p.componentWillMount != "function" || (typeof p.componentWillMount == "function" && p.componentWillMount(), typeof p.UNSAFE_componentWillMount == "function" && p.UNSAFE_componentWillMount()), typeof p.componentDidMount == "function" && (t.flags |= 4194308)) : (typeof p.componentDidMount == "function" && (t.flags |= 4194308), t.memoizedProps = o, t.memoizedState = F), p.props = o, p.state = F, p.context = x, o = Y) : (typeof p.componentDidMount == "function" && (t.flags |= 4194308), o = !1);
        } else {
          p = t.stateNode, Xi(e, t), x = t.memoizedProps, ne = ta(l, x), p.props = ne, P = t.pendingProps, le = p.context, F = l.contextType, Y = Ba, typeof F == "object" && F !== null && (Y = at(F)), M = l.getDerivedStateFromProps, (F = typeof M == "function" || typeof p.getSnapshotBeforeUpdate == "function") || typeof p.UNSAFE_componentWillReceiveProps != "function" && typeof p.componentWillReceiveProps != "function" || (x !== P || le !== Y) && Mu(
            t,
            p,
            o,
            Y
          ), Dn = !1, le = t.memoizedState, p.state = le, cl(t, o, p, u), ol();
          var ge = t.memoizedState;
          x !== P || le !== ge || Dn || e !== null && e.dependencies !== null && Il(e.dependencies) ? (typeof M == "function" && (ps(
            t,
            l,
            M,
            o
          ), ge = t.memoizedState), (ne = Dn || Au(
            t,
            l,
            ne,
            o,
            le,
            ge,
            Y
          ) || e !== null && e.dependencies !== null && Il(e.dependencies)) ? (F || typeof p.UNSAFE_componentWillUpdate != "function" && typeof p.componentWillUpdate != "function" || (typeof p.componentWillUpdate == "function" && p.componentWillUpdate(o, ge, Y), typeof p.UNSAFE_componentWillUpdate == "function" && p.UNSAFE_componentWillUpdate(
            o,
            ge,
            Y
          )), typeof p.componentDidUpdate == "function" && (t.flags |= 4), typeof p.getSnapshotBeforeUpdate == "function" && (t.flags |= 1024)) : (typeof p.componentDidUpdate != "function" || x === e.memoizedProps && le === e.memoizedState || (t.flags |= 4), typeof p.getSnapshotBeforeUpdate != "function" || x === e.memoizedProps && le === e.memoizedState || (t.flags |= 1024), t.memoizedProps = o, t.memoizedState = ge), p.props = o, p.state = ge, p.context = Y, o = ne) : (typeof p.componentDidUpdate != "function" || x === e.memoizedProps && le === e.memoizedState || (t.flags |= 4), typeof p.getSnapshotBeforeUpdate != "function" || x === e.memoizedProps && le === e.memoizedState || (t.flags |= 1024), o = !1);
        }
        return p = o, br(e, t), o = (t.flags & 128) !== 0, p || o ? (p = t.stateNode, l = o && typeof l.getDerivedStateFromError != "function" ? null : p.render(), t.flags |= 1, e !== null && o ? (t.child = da(
          t,
          e.child,
          null,
          u
        ), t.child = da(
          t,
          null,
          l,
          u
        )) : lt(e, t, l, u), t.memoizedState = p.state, e = t.child) : e = on(
          e,
          t,
          u
        ), e;
      }
      function Qu(e, t, l, o) {
        return Lt(), t.flags |= 256, lt(e, t, l, o), t.child;
      }
      function gs(e) {
        return { baseLanes: e, cachePool: Uc() };
      }
      function bs(e, t, l) {
        return e = e !== null ? e.childLanes & ~l : 0, t && (e |= Ct), e;
      }
      function Vu(e, t, l) {
        var o = t.pendingProps, u = !1, p = (t.flags & 128) !== 0, x;
        if ((x = p) || (x = e !== null && e.memoizedState === null ? !1 : (Ye.current & 2) !== 0), x && (u = !0, t.flags &= -129), x = (t.flags & 32) !== 0, t.flags &= -33, e === null) {
          if (Se) {
            if (u ? zn(t) : Nn(), (e = Be) ? (e = jg(
              e,
              Ot
            ), e !== null && (t.memoizedState = {
              dehydrated: e,
              treeContext: Rn !== null ? { id: Ft, overflow: It } : null,
              retryLane: 536870912,
              hydrationErrors: null
            }, l = Hd(e), l.return = t, t.child = l, it = t, Be = null)) : e = null, e === null) throw he(t);
            return Is(e) ? t.lanes = 32 : t.lanes = 536870912, null;
          }
          var M = o.children;
          return o = o.fallback, u ? (Nn(), u = t.mode, M = vr(
            { mode: "hidden", children: M },
            u
          ), o = la(
            o,
            u,
            l,
            null
          ), M.return = t, o.return = t, M.sibling = o, t.child = M, o = t.child, o.memoizedState = gs(l), o.childLanes = bs(
            e,
            x,
            l
          ), t.memoizedState = go, fl(null, o)) : (zn(t), vs(t, M));
        }
        var Y = e.memoizedState;
        if (Y !== null && (M = Y.dehydrated, M !== null)) {
          if (p)
            t.flags & 256 ? (zn(t), t.flags &= -257, t = ys(
              e,
              t,
              l
            )) : t.memoizedState !== null ? (Nn(), t.child = e.child, t.flags |= 128, t = null) : (Nn(), M = o.fallback, u = t.mode, o = vr(
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
            ), o = t.child, o.memoizedState = gs(l), o.childLanes = bs(
              e,
              x,
              l
            ), t.memoizedState = go, t = fl(null, o));
          else if (zn(t), Is(M))
            x = xg(M).digest, o = Error(s(419)), o.stack = "", o.digest = x, ll({ value: o, source: null, stack: null }), t = ys(
              e,
              t,
              l
            );
          else if (Ve || Ea(
            e,
            t,
            l,
            !1
          ), x = (l & e.childLanes) !== 0, Ve || x) {
            if (x = je, x !== null && (o = _(
              x,
              l
            ), o !== 0 && o !== Y.retryLane))
              throw Y.retryLane = o, ea(e, o), bt(x, e, o), ho;
            Fs(M) || Sr(), t = ys(
              e,
              t,
              l
            );
          } else
            Fs(M) ? (t.flags |= 192, t.child = e.child, t = null) : (e = Y.treeContext, ft && (Be = Tg(
              M
            ), it = t, Se = !0, On = null, Ot = !1, e !== null && oe(t, e)), t = vs(
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
        ), M.flags |= 2), M.return = t, o.return = t, o.sibling = M, t.child = o, fl(null, o), o = t.child, M = e.child.memoizedState, M === null ? M = gs(l) : (u = M.cachePool, u !== null ? (Y = fn ? He._currentValue : He._currentValue2, u = u.parent !== Y ? { parent: Y, pool: Y } : u) : u = Uc(), M = {
          baseLanes: M.baseLanes | l,
          cachePool: u
        }), o.memoizedState = M, o.childLanes = bs(
          e,
          x,
          l
        ), t.memoizedState = go, fl(e.child, o)) : (zn(t), l = e.child, e = l.sibling, l = dn(l, {
          mode: "visible",
          children: o.children
        }), l.return = t, l.sibling = null, e !== null && (x = t.deletions, x === null ? (t.deletions = [e], t.flags |= 16) : x.push(e)), t.child = l, t.memoizedState = null, l);
      }
      function vs(e, t) {
        return t = vr(
          { mode: "visible", children: t },
          e.mode
        ), t.return = e, e.child = t;
      }
      function vr(e, t) {
        return e = r(22, e, null, t), e.lanes = 0, e;
      }
      function ys(e, t, l) {
        return da(t, e.child, null, l), e = vs(
          t,
          t.pendingProps.children
        ), e.flags |= 2, t.memoizedState = null, e;
      }
      function Ku(e, t, l) {
        e.lanes |= t;
        var o = e.alternate;
        o !== null && (o.lanes |= t), Li(e.return, t, l);
      }
      function xs(e, t, l, o, u, p) {
        var x = e.memoizedState;
        x === null ? e.memoizedState = {
          isBackwards: t,
          rendering: null,
          renderingStartTime: 0,
          last: o,
          tail: l,
          tailMode: u,
          treeForkCount: p
        } : (x.isBackwards = t, x.rendering = null, x.renderingStartTime = 0, x.last = o, x.tail = l, x.tailMode = u, x.treeForkCount = p);
      }
      function Zu(e, t, l) {
        var o = t.pendingProps, u = o.revealOrder, p = o.tail;
        o = o.children;
        var x = Ye.current, M = (x & 2) !== 0;
        if (M ? (x = x & 1 | 2, t.flags |= 128) : x &= 1, E(Ye, x), lt(e, t, o, l), o = Se ? _l : 0, !M && e !== null && (e.flags & 128) !== 0)
          e: for (e = t.child; e !== null; ) {
            if (e.tag === 13)
              e.memoizedState !== null && Ku(e, l, t);
            else if (e.tag === 19)
              Ku(e, l, t);
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
              e = l.alternate, e !== null && or(e) === null && (u = l), l = l.sibling;
            l = u, l === null ? (u = t.child, t.child = null) : (u = l.sibling, l.sibling = null), xs(
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
              if (e = u.alternate, e !== null && or(e) === null) {
                t.child = u;
                break;
              }
              e = u.sibling, u.sibling = l, l = u, u = e;
            }
            xs(
              t,
              !0,
              l,
              null,
              p,
              o
            );
            break;
          case "together":
            xs(
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
      function ws(e, t) {
        return (e.lanes & t) !== 0 ? !0 : (e = e.dependencies, !!(e !== null && Il(e)));
      }
      function fh(e, t, l) {
        switch (t.tag) {
          case 3:
            ce(
              t,
              t.stateNode.containerInfo
            ), _n(t, He, e.memoizedState.cache), Lt();
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
              return t.flags |= 128, Fi(t), null;
            break;
          case 13:
            var o = t.memoizedState;
            if (o !== null)
              return o.dehydrated !== null ? (zn(t), t.flags |= 128, null) : (l & t.child.childLanes) !== 0 ? Vu(
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
                return Zu(
                  e,
                  t,
                  l
                );
              t.flags |= 128;
            }
            if (u = t.memoizedState, u !== null && (u.rendering = null, u.tail = null, u.lastEffect = null), E(Ye, Ye.current), o) break;
            return null;
          case 22:
            return t.lanes = 0, Uu(
              e,
              t,
              l,
              t.pendingProps
            );
          case 24:
            _n(t, He, e.memoizedState.cache);
        }
        return on(e, t, l);
      }
      function Xu(e, t, l) {
        if (e !== null)
          if (e.memoizedProps !== t.pendingProps)
            Ve = !0;
          else {
            if (!ws(e, l) && (t.flags & 128) === 0)
              return Ve = !1, fh(
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
                Us(e) ? (o = ta(e, o), t.tag = 1, t = Yu(
                  null,
                  t,
                  e,
                  o,
                  l
                )) : (t.tag = 0, t = hs(
                  null,
                  t,
                  e,
                  o,
                  l
                ));
              else {
                if (e != null) {
                  var u = e.$$typeof;
                  if (u === Vs) {
                    t.tag = 11, t = Du(
                      null,
                      t,
                      e,
                      o,
                      l
                    );
                    break e;
                  } else if (u === Xs) {
                    t.tag = 14, t = Bu(
                      null,
                      t,
                      e,
                      o,
                      l
                    );
                    break e;
                  }
                }
                throw t = v(e) || e, Error(s(306, t, ""));
              }
            }
            return t;
          case 0:
            return hs(
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
            ), Yu(
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
              var x = t.memoizedState;
              if (p = x.cache, _n(t, He, p), p !== u.cache && Gi(
                t,
                [He],
                l,
                !0
              ), ol(), p = x.element, ft && u.isDehydrated)
                if (u = {
                  element: p,
                  isDehydrated: !1,
                  cache: x.cache
                }, t.updateQueue.baseState = u, t.memoizedState = u, t.flags & 256) {
                  t = Qu(
                    e,
                    t,
                    p,
                    l
                  );
                  break e;
                } else if (p !== o) {
                  o = V(
                    Error(s(424)),
                    t
                  ), ll(o), t = Qu(
                    e,
                    t,
                    p,
                    l
                  );
                  break e;
                } else
                  for (ft && (Be = zg(
                    t.stateNode.containerInfo
                  ), it = t, Se = !0, On = null, Ot = !0), l = wf(
                    t,
                    null,
                    p,
                    l
                  ), t.child = l; l; )
                    l.flags = l.flags & -3 | 4096, l = l.sibling;
              else {
                if (Lt(), p === o) {
                  t = on(
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
              return br(e, t), e === null ? (l = sf(
                t.type,
                null,
                t.pendingProps,
                null
              )) ? t.memoizedState = l : Se || (t.stateNode = Pg(
                t.type,
                t.pendingProps,
                jn.current,
                t
              )) : t.memoizedState = sf(
                t.type,
                e.memoizedProps,
                t.pendingProps,
                e.memoizedState
              ), null;
          case 27:
            if ($e)
              return Ee(t), e === null && $e && Se && (o = t.stateNode = pf(
                t.type,
                t.pendingProps,
                jn.current,
                rt.current,
                !1
              ), it = t, Ot = !0, Be = Cg(
                t.type,
                o,
                Be
              )), lt(
                e,
                t,
                t.pendingProps.children,
                l
              ), br(e, t), e === null && (t.flags |= 4194304), t.child;
          case 5:
            return e === null && Se && (Wg(
              t.type,
              t.pendingProps,
              rt.current
            ), (u = o = Be) && (o = Ag(
              o,
              t.type,
              t.pendingProps,
              Ot
            ), o !== null ? (t.stateNode = o, it = t, Be = Eg(o), Ot = !1, u = !0) : u = !1), u || he(t)), Ee(t), u = t.type, p = t.pendingProps, x = e !== null ? e.memoizedProps : null, o = p.children, Cr(u, p) ? o = null : x !== null && Cr(u, x) && (t.flags |= 32), t.memoizedState !== null && (u = Pi(
              e,
              t,
              lh,
              null,
              null,
              l
            ), fn ? ia._currentValue = u : ia._currentValue2 = u), br(e, t), lt(e, t, o, l), t.child;
          case 6:
            return e === null && Se && (Fg(
              t.pendingProps,
              rt.current
            ), (e = l = Be) && (l = Mg(
              l,
              t.pendingProps,
              Ot
            ), l !== null ? (t.stateNode = l, it = t, Be = null, e = !0) : e = !1), e || he(t)), null;
          case 13:
            return Vu(e, t, l);
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
            return Du(
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
            return o = t.pendingProps, _n(t, t.type, o.value), lt(
              e,
              t,
              o.children,
              l
            ), t.child;
          case 9:
            return u = t.type._context, o = t.pendingProps.children, In(t), u = at(u), o = o(u), t.flags |= 1, lt(e, t, o, l), t.child;
          case 14:
            return Bu(
              e,
              t,
              t.type,
              t.pendingProps,
              l
            );
          case 15:
            return Hu(
              e,
              t,
              t.type,
              t.pendingProps,
              l
            );
          case 19:
            return Zu(
              e,
              t,
              l
            );
          case 31:
            return dh(e, t, l);
          case 22:
            return Uu(
              e,
              t,
              l,
              t.pendingProps
            );
          case 24:
            return In(t), o = at(He), e === null ? (u = Vi(), u === null && (u = je, p = Yi(), u.pooledCache = p, p.refCount++, p !== null && (u.pooledCacheLanes |= l), u = p), t.memoizedState = {
              parent: o,
              cache: u
            }, Zi(t), _n(t, He, u)) : ((e.lanes & l) !== 0 && (Xi(e, t), cl(t, null, null, l), ol()), u = e.memoizedState, p = t.memoizedState, u.parent !== o ? (u = { parent: o, cache: o }, t.memoizedState = u, t.lanes === 0 && (t.memoizedState = t.updateQueue.baseState = u), _n(t, He, o)) : (o = p.cache, _n(t, He, o), o !== u.cache && Gi(
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
      function yr(e) {
        Wt && (e.flags |= 8);
      }
      function Ju(e, t) {
        if (e !== null && e.child === t.child) return !1;
        if ((t.flags & 16) !== 0) return !0;
        for (e = t.child; e !== null; ) {
          if ((e.flags & 8218) !== 0 || (e.subtreeFlags & 8218) !== 0)
            return !0;
          e = e.sibling;
        }
        return !1;
      }
      function ks(e, t, l, o) {
        if (dt)
          for (l = t.child; l !== null; ) {
            if (l.tag === 5 || l.tag === 6)
              $s(e, l.stateNode);
            else if (!(l.tag === 4 || $e && l.tag === 27) && l.child !== null) {
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
        else if (Wt)
          for (var u = t.child; u !== null; ) {
            if (u.tag === 5) {
              var p = u.stateNode;
              l && o && (p = tf(
                p,
                u.type,
                u.memoizedProps
              )), $s(e, p);
            } else if (u.tag === 6)
              p = u.stateNode, l && o && (p = nf(
                p,
                u.memoizedProps
              )), $s(e, p);
            else if (u.tag !== 4) {
              if (u.tag === 22 && u.memoizedState !== null)
                p = u.child, p !== null && (p.return = u), ks(e, u, !0, !0);
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
      function $u(e, t, l, o) {
        var u = !1;
        if (Wt)
          for (var p = t.child; p !== null; ) {
            if (p.tag === 5) {
              var x = p.stateNode;
              l && o && (x = tf(
                x,
                p.type,
                p.memoizedProps
              )), Pd(e, x);
            } else if (p.tag === 6)
              x = p.stateNode, l && o && (x = nf(
                x,
                p.memoizedProps
              )), Pd(e, x);
            else if (p.tag !== 4) {
              if (p.tag === 22 && p.memoizedState !== null)
                u = p.child, u !== null && (u.return = p), $u(e, p, !0, !0), u = !0;
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
      function Wu(e, t) {
        if (Wt && Ju(e, t)) {
          e = t.stateNode;
          var l = e.containerInfo, o = Id();
          $u(o, t, !1, !1), e.pendingChildren = o, Gt(t), yg(l, o);
        }
      }
      function _s(e, t, l, o) {
        if (dt)
          e.memoizedProps !== o && Gt(t);
        else if (Wt) {
          var u = e.stateNode, p = e.memoizedProps;
          if ((e = Ju(e, t)) || p !== o) {
            var x = rt.current;
            p = vg(
              u,
              l,
              p,
              o,
              !e,
              null
            ), p === u ? t.stateNode = u : (yr(t), Xd(
              p,
              l,
              o,
              x
            ) && Gt(t), t.stateNode = p, e && ks(p, t, !1, !1));
          } else t.stateNode = u;
        }
      }
      function Ss(e, t, l, o, u) {
        if ((e.mode & 32) !== 0 && (l === null ? Kh(t, o) : Zh(t, l, o))) {
          if (e.flags |= 16777216, (u & 335544128) === u || Ws(t, o))
            if ($d(e.stateNode, t, o))
              e.flags |= 8192;
            else if (kd()) e.flags |= 8192;
            else
              throw ua = Lr, co;
        } else e.flags &= -16777217;
      }
      function Fu(e, t) {
        if (t0(t)) {
          if (e.flags |= 16777216, !ff(t))
            if (kd()) e.flags |= 8192;
            else
              throw ua = Lr, co;
        } else e.flags &= -16777217;
      }
      function xr(e, t) {
        t !== null && (e.flags |= 4), e.flags & 16384 && (t = e.tag !== 22 ? X() : 536870912, e.lanes |= t, Wa |= t);
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
      function De(e) {
        var t = e.alternate !== null && e.alternate.child === e.child, l = 0, o = 0;
        if (t)
          for (var u = e.child; u !== null; )
            l |= u.lanes | u.childLanes, o |= u.subtreeFlags & 65011712, o |= u.flags & 65011712, u.return = e, u = u.sibling;
        else
          for (u = e.child; u !== null; )
            l |= u.lanes | u.childLanes, o |= u.subtreeFlags, o |= u.flags, u.return = e, u = u.sibling;
        return e.subtreeFlags |= o, e.childLanes = l, t;
      }
      function ph(e, t, l) {
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
            return l = t.stateNode, o = null, e !== null && (o = e.memoizedState.cache), t.memoizedState.cache !== o && (t.flags |= 2048), rn(He), ue(), l.pendingContext && (l.context = l.pendingContext, l.pendingContext = null), (e === null || e.child === null) && (qt(t) ? Gt(t) : e === null || e.memoizedState.isDehydrated && (t.flags & 256) === 0 || (t.flags |= 1024, kn())), Wu(e, t), De(t), null;
          case 26:
            if (Vt) {
              var u = t.type, p = t.memoizedState;
              return e === null ? (Gt(t), p !== null ? (De(t), Fu(
                t,
                p
              )) : (De(t), Ss(
                t,
                u,
                null,
                o,
                l
              ))) : p ? p !== e.memoizedState ? (Gt(t), De(t), Fu(
                t,
                p
              )) : (De(t), t.flags &= -16777217) : (p = e.memoizedProps, dt ? p !== o && Gt(t) : _s(
                e,
                t,
                u,
                o
              ), De(t), Ss(
                t,
                u,
                p,
                o,
                l
              )), null;
            }
          case 27:
            if ($e) {
              if (Pe(t), l = jn.current, u = t.type, e !== null && t.stateNode != null)
                dt ? e.memoizedProps !== o && Gt(t) : _s(e, t, u, o);
              else {
                if (!o) {
                  if (t.stateNode === null)
                    throw Error(s(166));
                  return De(t), null;
                }
                e = rt.current, qt(t) ? Wn(t, e) : (e = pf(
                  u,
                  o,
                  l,
                  e,
                  !0
                ), t.stateNode = e, Gt(t));
              }
              return De(t), null;
            }
          case 5:
            if (Pe(t), u = t.type, e !== null && t.stateNode != null)
              _s(e, t, u, o);
            else {
              if (!o) {
                if (t.stateNode === null)
                  throw Error(s(166));
                return De(t), null;
              }
              if (p = rt.current, qt(t))
                Wn(t, p), Vg(
                  t.stateNode,
                  u,
                  o,
                  p
                ) && (t.flags |= 64);
              else {
                var x = Hh(
                  u,
                  o,
                  jn.current,
                  p,
                  t
                );
                yr(t), ks(x, t, !1, !1), t.stateNode = x, Xd(
                  x,
                  u,
                  o,
                  p
                ) && Gt(t);
              }
            }
            return De(t), Ss(
              t,
              t.type,
              e === null ? null : e.memoizedProps,
              t.pendingProps,
              l
            ), null;
          case 6:
            if (e && t.stateNode != null)
              l = e.memoizedProps, dt ? l !== o && Gt(t) : Wt && (l !== o ? (e = jn.current, l = rt.current, yr(t), t.stateNode = Jd(
                o,
                e,
                l,
                t
              )) : t.stateNode = e.stateNode);
            else {
              if (typeof o != "string" && t.stateNode === null)
                throw Error(s(166));
              if (e = jn.current, l = rt.current, qt(t)) {
                if (!ft) throw Error(s(176));
                if (e = t.stateNode, l = t.memoizedProps, o = null, u = it, u !== null)
                  switch (u.tag) {
                    case 27:
                    case 5:
                      o = u.memoizedProps;
                  }
                Dg(
                  e,
                  l,
                  t,
                  o
                ) || he(t, !0);
              } else
                yr(t), t.stateNode = Jd(
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
                  Bg(e, t);
                } else
                  Lt(), (t.flags & 128) === 0 && (t.memoizedState = null), t.flags |= 4;
                De(t), e = !1;
              } else
                l = kn(), e !== null && e.memoizedState !== null && (e.memoizedState.hydrationErrors = l), e = !0;
              if (!e)
                return t.flags & 256 ? (wt(t), t) : (wt(t), null);
              if ((t.flags & 128) !== 0)
                throw Error(s(558));
            }
            return De(t), null;
          case 13:
            if (o = t.memoizedState, e === null || e.memoizedState !== null && e.memoizedState.dehydrated !== null) {
              if (u = qt(t), o !== null && o.dehydrated !== null) {
                if (e === null) {
                  if (!u) throw Error(s(318));
                  if (!ft) throw Error(s(344));
                  if (u = t.memoizedState, u = u !== null ? u.dehydrated : null, !u) throw Error(s(317));
                  Hg(u, t);
                } else
                  Lt(), (t.flags & 128) === 0 && (t.memoizedState = null), t.flags |= 4;
                De(t), u = !1;
              } else
                u = kn(), e !== null && e.memoizedState !== null && (e.memoizedState.hydrationErrors = u), u = !0;
              if (!u)
                return t.flags & 256 ? (wt(t), t) : (wt(t), null);
            }
            return wt(t), (t.flags & 128) !== 0 ? (t.lanes = l, t) : (l = o !== null, e = e !== null && e.memoizedState !== null, l && (o = t.child, u = null, o.alternate !== null && o.alternate.memoizedState !== null && o.alternate.memoizedState.cachePool !== null && (u = o.alternate.memoizedState.cachePool.pool), p = null, o.memoizedState !== null && o.memoizedState.cachePool !== null && (p = o.memoizedState.cachePool.pool), p !== u && (o.flags |= 2048)), l !== e && l && (t.child.flags |= 8192), xr(t, t.updateQueue), De(t), null);
          case 4:
            return ue(), Wu(e, t), e === null && Gh(t.stateNode.containerInfo), De(t), null;
          case 10:
            return rn(t.type), De(t), null;
          case 19:
            if (S(Ye), o = t.memoizedState, o === null) return De(t), null;
            if (u = (t.flags & 128) !== 0, p = o.rendering, p === null)
              if (u) pl(o, !1);
              else {
                if (Le !== 0 || e !== null && (e.flags & 128) !== 0)
                  for (e = t.child; e !== null; ) {
                    if (p = or(e), p !== null) {
                      for (t.flags |= 128, pl(o, !1), e = p.updateQueue, t.updateQueue = e, xr(t, e), t.subtreeFlags = 0, e = l, l = t.child; l !== null; )
                        Bd(l, e), l = l.sibling;
                      return E(
                        Ye,
                        Ye.current & 1 | 2
                      ), Se && K(t, o.treeForkCount), t.child;
                    }
                    e = e.sibling;
                  }
                o.tail !== null && vt() > Ml && (t.flags |= 128, u = !0, pl(o, !1), t.lanes = 4194304);
              }
            else {
              if (!u)
                if (e = or(p), e !== null) {
                  if (t.flags |= 128, u = !0, e = e.updateQueue, t.updateQueue = e, xr(t, e), pl(o, !0), o.tail === null && o.tailMode === "hidden" && !p.alternate && !Se)
                    return De(t), null;
                } else
                  2 * vt() - o.renderingStartTime > Ml && l !== 536870912 && (t.flags |= 128, u = !0, pl(o, !1), t.lanes = 4194304);
              o.isBackwards ? (p.sibling = t.child, t.child = p) : (e = o.last, e !== null ? e.sibling = p : t.child = p, o.last = p);
            }
            return o.tail !== null ? (e = o.tail, o.rendering = e, o.tail = e.sibling, o.renderingStartTime = vt(), e.sibling = null, l = Ye.current, E(
              Ye,
              u ? l & 1 | 2 : l & 1
            ), Se && K(t, o.treeForkCount), e) : (De(t), null);
          case 22:
          case 23:
            return wt(t), Wi(), o = t.memoizedState !== null, e !== null ? e.memoizedState !== null !== o && (t.flags |= 8192) : o && (t.flags |= 8192), o ? (l & 536870912) !== 0 && (t.flags & 128) === 0 && (De(t), t.subtreeFlags & 6 && (t.flags |= 8192)) : De(t), l = t.updateQueue, l !== null && xr(t, l.retryQueue), l = null, e !== null && e.memoizedState !== null && e.memoizedState.cachePool !== null && (l = e.memoizedState.cachePool.pool), o = null, t.memoizedState !== null && t.memoizedState.cachePool !== null && (o = t.memoizedState.cachePool.pool), o !== l && (t.flags |= 2048), e !== null && S(ca), null;
          case 24:
            return l = null, e !== null && (l = e.memoizedState.cache), t.memoizedState.cache !== l && (t.flags |= 2048), rn(He), De(t), null;
          case 25:
            return null;
          case 30:
            return null;
        }
        throw Error(s(156, t.tag));
      }
      function mh(e, t) {
        switch (ae(t), t.tag) {
          case 1:
            return e = t.flags, e & 65536 ? (t.flags = e & -65537 | 128, t) : null;
          case 3:
            return rn(He), ue(), e = t.flags, (e & 65536) !== 0 && (e & 128) === 0 ? (t.flags = e & -65537 | 128, t) : null;
          case 26:
          case 27:
          case 5:
            return Pe(t), null;
          case 31:
            if (t.memoizedState !== null) {
              if (wt(t), t.alternate === null)
                throw Error(s(340));
              Lt();
            }
            return e = t.flags, e & 65536 ? (t.flags = e & -65537 | 128, t) : null;
          case 13:
            if (wt(t), e = t.memoizedState, e !== null && e.dehydrated !== null) {
              if (t.alternate === null)
                throw Error(s(340));
              Lt();
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
            return wt(t), Wi(), e !== null && S(ca), e = t.flags, e & 65536 ? (t.flags = e & -65537 | 128, t) : null;
          case 24:
            return rn(He), null;
          case 25:
            return null;
          default:
            return null;
        }
      }
      function Iu(e, t) {
        switch (ae(t), t.tag) {
          case 3:
            rn(He), ue();
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
            wt(t), Wi(), e !== null && S(ca);
            break;
          case 24:
            rn(He);
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
                var p = l.create, x = l.inst;
                o = p(), x.destroy = o;
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
                var x = o.inst, M = x.destroy;
                if (M !== void 0) {
                  x.destroy = void 0, u = t;
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
      function Pu(e) {
        var t = e.updateQueue;
        if (t !== null) {
          var l = e.stateNode;
          try {
            Zc(t, l);
          } catch (o) {
            Ne(e, e.return, o);
          }
        }
      }
      function ed(e, t, l) {
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
      function $t(e, t) {
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
      function td(e) {
        var t = e.type, l = e.memoizedProps, o = e.stateNode;
        try {
          sg(o, t, l, e);
        } catch (u) {
          Ne(e, e.return, u);
        }
      }
      function Es(e, t, l) {
        try {
          og(
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
      function nd(e) {
        return e.tag === 5 || e.tag === 3 || (Vt ? e.tag === 26 : !1) || ($e ? e.tag === 27 && Oa(e.type) : !1) || e.tag === 4;
      }
      function zs(e) {
        e: for (; ; ) {
          for (; e.sibling === null; ) {
            if (e.return === null || nd(e.return)) return null;
            e = e.return;
          }
          for (e.sibling.return = e.return, e = e.sibling; e.tag !== 5 && e.tag !== 6 && e.tag !== 18; ) {
            if ($e && e.tag === 27 && Oa(e.type) || e.flags & 2 || e.child === null || e.tag === 4) continue e;
            e.child.return = e, e = e.child;
          }
          if (!(e.flags & 2)) return e.stateNode;
        }
      }
      function Ns(e, t, l) {
        var o = e.tag;
        if (o === 5 || o === 6)
          e = e.stateNode, t ? ug(l, e, t) : rg(l, e);
        else if (o !== 4 && ($e && o === 27 && Oa(e.type) && (l = e.stateNode, t = null), e = e.child, e !== null))
          for (Ns(e, t, l), e = e.sibling; e !== null; )
            Ns(e, t, l), e = e.sibling;
      }
      function wr(e, t, l) {
        var o = e.tag;
        if (o === 5 || o === 6)
          e = e.stateNode, t ? cg(l, e, t) : lg(l, e);
        else if (o !== 4 && ($e && o === 27 && Oa(e.type) && (l = e.stateNode), e = e.child, e !== null))
          for (wr(e, t, l), e = e.sibling; e !== null; )
            wr(e, t, l), e = e.sibling;
      }
      function ad(e, t, l) {
        e = e.containerInfo;
        try {
          ef(e, l);
        } catch (o) {
          Ne(t, t.return, o);
        }
      }
      function ld(e) {
        var t = e.stateNode, l = e.memoizedProps;
        try {
          a0(
            e.type,
            l,
            t,
            e
          );
        } catch (o) {
          Ne(e, e.return, o);
        }
      }
      function hh(e, t) {
        for (Dh(e.containerInfo), tt = t; tt !== null; )
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
                      var x = ta(
                        o.type,
                        u
                      );
                      t = p.getSnapshotBeforeUpdate(
                        x,
                        l
                      ), p.__reactInternalSnapshotBeforeUpdate = t;
                    } catch (M) {
                      Ne(o, o.return, M);
                    }
                  }
                  break;
                case 3:
                  (t & 1024) !== 0 && dt && bg(e.stateNode.containerInfo);
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
      function rd(e, t, l) {
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
                } catch (x) {
                  Ne(l, l.return, x);
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
                } catch (x) {
                  Ne(
                    l,
                    l.return,
                    x
                  );
                }
              }
            o & 64 && Pu(l), o & 512 && hl(l, l.return);
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
                Zc(o, e);
              } catch (x) {
                Ne(l, l.return, x);
              }
            }
            break;
          case 27:
            $e && t === null && o & 4 && ld(l);
          case 26:
          case 5:
            if (cn(e, l), t === null) {
              if (o & 4) td(l);
              else if (o & 64) {
                e = l.type, t = l.memoizedProps, u = l.stateNode;
                try {
                  Lg(
                    u,
                    e,
                    t,
                    l
                  );
                } catch (x) {
                  Ne(l, l.return, x);
                }
              }
            }
            o & 512 && hl(l, l.return);
            break;
          case 12:
            cn(e, l);
            break;
          case 31:
            cn(e, l), o & 4 && sd(e, l);
            break;
          case 13:
            cn(e, l), o & 4 && od(e, l), o & 64 && (o = l.memoizedState, o !== null && (o = o.dehydrated, o !== null && (l = kh.bind(
              null,
              l
            ), wg(o, l))));
            break;
          case 22:
            if (o = l.memoizedState !== null || gn, !o) {
              t = t !== null && t.memoizedState !== null || Ke, u = gn;
              var p = Ke;
              gn = o, (Ke = t) && !p ? un(
                e,
                l,
                (l.subtreeFlags & 8772) !== 0
              ) : cn(e, l), gn = u, Ke = p;
            }
            break;
          case 30:
            break;
          default:
            cn(e, l);
        }
      }
      function id(e) {
        var t = e.alternate;
        t !== null && (e.alternate = null, id(t)), e.child = null, e.deletions = null, e.sibling = null, e.tag === 5 && (t = e.stateNode, t !== null && Vh(t)), e.stateNode = null, e.return = null, e.dependencies = null, e.memoizedProps = null, e.memoizedState = null, e.pendingProps = null, e.stateNode = null, e.updateQueue = null;
      }
      function Yt(e, t, l) {
        for (l = l.child; l !== null; )
          Ts(
            e,
            t,
            l
          ), l = l.sibling;
      }
      function Ts(e, t, l) {
        if (Et && typeof Et.onCommitFiberUnmount == "function")
          try {
            Et.onCommitFiberUnmount(kl, l);
          } catch {
          }
        switch (l.tag) {
          case 26:
            if (Vt) {
              Ke || $t(l, t), Yt(
                e,
                t,
                l
              ), l.memoizedState ? cf(l.memoizedState) : l.stateNode && df(l.stateNode);
              break;
            }
          case 27:
            if ($e) {
              Ke || $t(l, t);
              var o = Ze, u = yt;
              Oa(l.type) && (Ze = l.stateNode, yt = !1), Yt(
                e,
                t,
                l
              ), mf(l.stateNode), Ze = o, yt = u;
              break;
            }
          case 5:
            Ke || $t(l, t);
          case 6:
            if (dt) {
              if (o = Ze, u = yt, Ze = null, Yt(
                e,
                t,
                l
              ), Ze = o, yt = u, Ze !== null)
                if (yt)
                  try {
                    fg(Ze, l.stateNode);
                  } catch (p) {
                    Ne(
                      l,
                      t,
                      p
                    );
                  }
                else
                  try {
                    dg(Ze, l.stateNode);
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
            dt && Ze !== null && (yt ? Xg(
              Ze,
              l.stateNode
            ) : Zg(Ze, l.stateNode));
            break;
          case 4:
            dt ? (o = Ze, u = yt, Ze = l.stateNode.containerInfo, yt = !0, Yt(
              e,
              t,
              l
            ), Ze = o, yt = u) : (Wt && ad(
              l.stateNode,
              l,
              Id()
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
            Tn(2, l, t), Ke || Tn(4, l, t), Yt(
              e,
              t,
              l
            );
            break;
          case 1:
            Ke || ($t(l, t), o = l.stateNode, typeof o.componentWillUnmount == "function" && ed(
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
            Ke = (o = Ke) || l.memoizedState !== null, Yt(
              e,
              t,
              l
            ), Ke = o;
            break;
          default:
            Yt(
              e,
              t,
              l
            );
        }
      }
      function sd(e, t) {
        if (ft && t.memoizedState === null && (e = t.alternate, e !== null && (e = e.memoizedState, e !== null))) {
          e = e.dehydrated;
          try {
            Yg(e);
          } catch (l) {
            Ne(t, t.return, l);
          }
        }
      }
      function od(e, t) {
        if (ft && t.memoizedState === null && (e = t.alternate, e !== null && (e = e.memoizedState, e !== null && (e = e.dehydrated, e !== null))))
          try {
            Qg(e);
          } catch (l) {
            Ne(t, t.return, l);
          }
      }
      function gh(e) {
        switch (e.tag) {
          case 31:
          case 13:
          case 19:
            var t = e.stateNode;
            return t === null && (t = e.stateNode = new Sf()), t;
          case 22:
            return e = e.stateNode, t = e._retryCache, t === null && (t = e._retryCache = new Sf()), t;
          default:
            throw Error(s(435, e.tag));
        }
      }
      function kr(e, t) {
        var l = gh(e);
        t.forEach(function(o) {
          if (!l.has(o)) {
            l.add(o);
            var u = _h.bind(null, e, o);
            o.then(u, u);
          }
        });
      }
      function ut(e, t) {
        var l = t.deletions;
        if (l !== null)
          for (var o = 0; o < l.length; o++) {
            var u = l[o], p = e, x = t;
            if (dt) {
              var M = x;
              e: for (; M !== null; ) {
                switch (M.tag) {
                  case 27:
                    if ($e) {
                      if (Oa(M.type)) {
                        Ze = M.stateNode, yt = !1;
                        break e;
                      }
                      break;
                    }
                  case 5:
                    Ze = M.stateNode, yt = !1;
                    break e;
                  case 3:
                  case 4:
                    Ze = M.stateNode.containerInfo, yt = !0;
                    break e;
                }
                M = M.return;
              }
              if (Ze === null) throw Error(s(160));
              Ts(p, x, u), Ze = null, yt = !1;
            } else Ts(p, x, u);
            p = u.alternate, p !== null && (p.return = null), u.return = null;
          }
        if (t.subtreeFlags & 13886)
          for (t = t.child; t !== null; )
            cd(t, e), t = t.sibling;
      }
      function cd(e, t) {
        var l = e.alternate, o = e.flags;
        switch (e.tag) {
          case 0:
          case 11:
          case 14:
          case 15:
            ut(t, e), gt(e), o & 4 && (Tn(3, e, e.return), ml(3, e), Tn(5, e, e.return));
            break;
          case 1:
            ut(t, e), gt(e), o & 512 && (Ke || l === null || $t(l, l.return)), o & 64 && gn && (e = e.updateQueue, e !== null && (o = e.callbacks, o !== null && (l = e.shared.hiddenCallbacks, e.shared.hiddenCallbacks = l === null ? o : l.concat(o))));
            break;
          case 26:
            if (Vt) {
              var u = Kt;
              if (ut(t, e), gt(e), o & 512 && (Ke || l === null || $t(l, l.return)), o & 4) {
                o = l !== null ? l.memoizedState : null;
                var p = e.memoizedState;
                l === null ? p === null ? e.stateNode === null ? e.stateNode = Ig(
                  u,
                  e.type,
                  e.memoizedProps,
                  e
                ) : uf(
                  u,
                  e.type,
                  e.stateNode
                ) : e.stateNode = of(
                  u,
                  p,
                  e.memoizedProps
                ) : o !== p ? (o === null ? l.stateNode !== null && df(l.stateNode) : cf(o), p === null ? uf(
                  u,
                  e.type,
                  e.stateNode
                ) : of(
                  u,
                  p,
                  e.memoizedProps
                )) : p === null && e.stateNode !== null && Es(
                  e,
                  e.memoizedProps,
                  l.memoizedProps
                );
              }
              break;
            }
          case 27:
            if ($e) {
              ut(t, e), gt(e), o & 512 && (Ke || l === null || $t(l, l.return)), l !== null && o & 4 && Es(
                e,
                e.memoizedProps,
                l.memoizedProps
              );
              break;
            }
          case 5:
            if (ut(t, e), gt(e), o & 512 && (Ke || l === null || $t(l, l.return)), dt) {
              if (e.flags & 32) {
                u = e.stateNode;
                try {
                  Fd(u);
                } catch (P) {
                  Ne(e, e.return, P);
                }
              }
              o & 4 && e.stateNode != null && (u = e.memoizedProps, Es(
                e,
                u,
                l !== null ? l.memoizedProps : u
              )), o & 1024 && (bo = !0);
            } else
              Wt && e.alternate !== null && (e.alternate.stateNode = e.stateNode);
            break;
          case 6:
            if (ut(t, e), gt(e), o & 4 && dt) {
              if (e.stateNode === null)
                throw Error(s(162));
              o = e.memoizedProps, l = l !== null ? l.memoizedProps : o, u = e.stateNode;
              try {
                ig(u, l, o);
              } catch (P) {
                Ne(e, e.return, P);
              }
            }
            break;
          case 3:
            if (Vt ? (e0(), u = Kt, Kt = Ps(t.containerInfo), ut(t, e), Kt = u) : ut(t, e), gt(e), o & 4) {
              if (dt && ft && l !== null && l.memoizedState.isDehydrated)
                try {
                  Gg(t.containerInfo);
                } catch (P) {
                  Ne(e, e.return, P);
                }
              if (Wt) {
                o = t.containerInfo, l = t.pendingChildren;
                try {
                  ef(o, l);
                } catch (P) {
                  Ne(e, e.return, P);
                }
              }
            }
            bo && (bo = !1, ud(e));
            break;
          case 4:
            Vt ? (l = Kt, Kt = Ps(
              e.stateNode.containerInfo
            ), ut(t, e), gt(e), Kt = l) : (ut(t, e), gt(e)), o & 4 && Wt && ad(
              e.stateNode,
              e,
              e.stateNode.pendingChildren
            );
            break;
          case 12:
            ut(t, e), gt(e);
            break;
          case 31:
            ut(t, e), gt(e), o & 4 && (o = e.updateQueue, o !== null && (e.updateQueue = null, kr(e, o)));
            break;
          case 13:
            ut(t, e), gt(e), e.child.flags & 8192 && e.memoizedState !== null != (l !== null && l.memoizedState !== null) && ($r = vt()), o & 4 && (o = e.updateQueue, o !== null && (e.updateQueue = null, kr(e, o)));
            break;
          case 22:
            u = e.memoizedState !== null;
            var x = l !== null && l.memoizedState !== null, M = gn, Y = Ke;
            if (gn = M || u, Ke = Y || x, ut(t, e), Ke = Y, gn = M, gt(e), o & 8192 && (t = e.stateNode, t._visibility = u ? t._visibility & -2 : t._visibility | 1, u && (l === null || x || gn || Ke || na(e)), dt)) {
              e: if (l = null, dt)
                for (t = e; ; ) {
                  if (t.tag === 5 || Vt && t.tag === 26) {
                    if (l === null) {
                      x = l = t;
                      try {
                        p = x.stateNode, u ? pg(p) : hg(
                          x.stateNode,
                          x.memoizedProps
                        );
                      } catch (P) {
                        Ne(x, x.return, P);
                      }
                    }
                  } else if (t.tag === 6) {
                    if (l === null) {
                      x = t;
                      try {
                        var F = x.stateNode;
                        u ? mg(F) : gg(F, x.memoizedProps);
                      } catch (P) {
                        Ne(x, x.return, P);
                      }
                    }
                  } else if (t.tag === 18) {
                    if (l === null) {
                      x = t;
                      try {
                        var ne = x.stateNode;
                        u ? Jg(ne) : $g(x.stateNode);
                      } catch (P) {
                        Ne(x, x.return, P);
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
            o & 4 && (o = e.updateQueue, o !== null && (l = o.retryQueue, l !== null && (o.retryQueue = null, kr(e, l))));
            break;
          case 19:
            ut(t, e), gt(e), o & 4 && (o = e.updateQueue, o !== null && (e.updateQueue = null, kr(e, o)));
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
              if (nd(o)) {
                l = o;
                break;
              }
              o = o.return;
            }
            if (dt) {
              if (l == null) throw Error(s(160));
              switch (l.tag) {
                case 27:
                  if ($e) {
                    var u = l.stateNode, p = zs(e);
                    wr(e, p, u);
                    break;
                  }
                case 5:
                  var x = l.stateNode;
                  l.flags & 32 && (Fd(x), l.flags &= -33);
                  var M = zs(e);
                  wr(e, M, x);
                  break;
                case 3:
                case 4:
                  var Y = l.stateNode.containerInfo, F = zs(e);
                  Ns(
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
      function ud(e) {
        if (e.subtreeFlags & 1024)
          for (e = e.child; e !== null; ) {
            var t = e;
            ud(t), t.tag === 5 && t.flags & 1024 && $h(t.stateNode), e = e.sibling;
          }
      }
      function cn(e, t) {
        if (t.subtreeFlags & 8772)
          for (t = t.child; t !== null; )
            rd(e, t.alternate, t), t = t.sibling;
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
              $t(t, t.return);
              var l = t.stateNode;
              typeof l.componentWillUnmount == "function" && ed(
                t,
                t.return,
                l
              ), na(t);
              break;
            case 27:
              $e && mf(t.stateNode);
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
      function un(e, t, l) {
        for (l = l && (t.subtreeFlags & 8772) !== 0, t = t.child; t !== null; ) {
          var o = t.alternate, u = e, p = t, x = p.flags;
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
                      Kc(Y[u], M);
                } catch (F) {
                  Ne(o, o.return, F);
                }
              }
              l && x & 64 && Pu(p), hl(p, p.return);
              break;
            case 27:
              $e && ld(p);
            case 26:
            case 5:
              un(
                u,
                p,
                l
              ), l && o === null && x & 4 && td(p), hl(p, p.return);
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
              ), l && x & 4 && sd(u, p);
              break;
            case 13:
              un(
                u,
                p,
                l
              ), l && x & 4 && od(u, p);
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
      function Cs(e, t) {
        var l = null;
        e !== null && e.memoizedState !== null && e.memoizedState.cachePool !== null && (l = e.memoizedState.cachePool.pool), e = null, t.memoizedState !== null && t.memoizedState.cachePool !== null && (e = t.memoizedState.cachePool.pool), e !== l && (e != null && e.refCount++, l != null && rl(l));
      }
      function As(e, t) {
        e = null, t.alternate !== null && (e = t.alternate.memoizedState.cache), t = t.memoizedState.cache, t !== e && (t.refCount++, e != null && rl(e));
      }
      function Qt(e, t, l, o) {
        if (t.subtreeFlags & 10256)
          for (t = t.child; t !== null; )
            dd(
              e,
              t,
              l,
              o
            ), t = t.sibling;
      }
      function dd(e, t, l, o) {
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
                var p = t.memoizedProps, x = p.id, M = p.onPostCommit;
                typeof M == "function" && M(
                  x,
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
            p = t.stateNode, x = t.alternate, t.memoizedState !== null ? p._visibility & 2 ? Qt(
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
            )), u & 2048 && Cs(x, t);
            break;
          case 24:
            Qt(
              e,
              t,
              l,
              o
            ), u & 2048 && As(t.alternate, t);
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
          var p = e, x = t, M = l, Y = o, F = x.flags;
          switch (x.tag) {
            case 0:
            case 11:
            case 15:
              Ta(
                p,
                x,
                M,
                Y,
                u
              ), ml(8, x);
              break;
            case 23:
              break;
            case 22:
              var ne = x.stateNode;
              x.memoizedState !== null ? ne._visibility & 2 ? Ta(
                p,
                x,
                M,
                Y,
                u
              ) : gl(
                p,
                x
              ) : (ne._visibility |= 2, Ta(
                p,
                x,
                M,
                Y,
                u
              )), u && F & 2048 && Cs(
                x.alternate,
                x
              );
              break;
            case 24:
              Ta(
                p,
                x,
                M,
                Y,
                u
              ), u && F & 2048 && As(x.alternate, x);
              break;
            default:
              Ta(
                p,
                x,
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
                gl(l, o), u & 2048 && Cs(
                  o.alternate,
                  o
                );
                break;
              case 24:
                gl(l, o), u & 2048 && As(
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
            fd(
              e,
              t,
              l
            ), e = e.sibling;
      }
      function fd(e, t, l) {
        switch (e.tag) {
          case 26:
            if (aa(
              e,
              t,
              l
            ), e.flags & Ja)
              if (e.memoizedState !== null)
                n0(
                  l,
                  Kt,
                  e.memoizedState,
                  e.memoizedProps
                );
              else {
                var o = e.stateNode, u = e.type;
                e = e.memoizedProps, ((t & 335544128) === t || Ws(u, e)) && Wd(l, o, u, e);
              }
            break;
          case 5:
            aa(
              e,
              t,
              l
            ), e.flags & Ja && (o = e.stateNode, u = e.type, e = e.memoizedProps, ((t & 335544128) === t || Ws(u, e)) && Wd(l, o, u, e));
            break;
          case 3:
          case 4:
            Vt ? (o = Kt, Kt = Ps(
              e.stateNode.containerInfo
            ), aa(
              e,
              t,
              l
            ), Kt = o) : aa(
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
      function pd(e) {
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
              tt = o, hd(
                o,
                e
              );
            }
          pd(e);
        }
        if (e.subtreeFlags & 10256)
          for (e = e.child; e !== null; )
            md(e), e = e.sibling;
      }
      function md(e) {
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
            e.memoizedState !== null && t._visibility & 2 && (e.return === null || e.return.tag !== 13) ? (t._visibility &= -3, _r(e)) : bl(e);
            break;
          default:
            bl(e);
        }
      }
      function _r(e) {
        var t = e.deletions;
        if ((e.flags & 16) !== 0) {
          if (t !== null)
            for (var l = 0; l < t.length; l++) {
              var o = t[l];
              tt = o, hd(
                o,
                e
              );
            }
          pd(e);
        }
        for (e = e.child; e !== null; ) {
          switch (t = e, t.tag) {
            case 0:
            case 11:
            case 15:
              Tn(8, t, t.return), _r(t);
              break;
            case 22:
              l = t.stateNode, l._visibility & 2 && (l._visibility &= -3, _r(t));
              break;
            default:
              _r(t);
          }
          e = e.sibling;
        }
      }
      function hd(e, t) {
        for (; tt !== null; ) {
          var l = tt;
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
          if (o = l.child, o !== null) o.return = l, tt = o;
          else
            e: for (l = e; tt !== null; ) {
              o = tt;
              var u = o.sibling, p = o.return;
              if (id(o), o === l) {
                tt = null;
                break e;
              }
              if (u !== null) {
                u.return = p, tt = u;
                break e;
              }
              tt = p;
            }
        }
      }
      function Ms(e) {
        var t = Lh(e);
        if (t != null) {
          if (typeof t.memoizedProps["data-testname"] != "string")
            throw Error(s(364));
          return t;
        }
        if (e = Ih(e), e === null) throw Error(s(362));
        return e.stateNode.current;
      }
      function Rs(e, t) {
        var l = e.tag;
        switch (t.$$typeof) {
          case Vr:
            if (e.type === t.value) return !0;
            break;
          case Kr:
            e: {
              for (t = t.value, e = [e, 0], l = 0; l < e.length; ) {
                var o = e[l++], u = o.tag, p = e[l++], x = t[p];
                if (u !== 5 && u !== 26 && u !== 27 || !wl(o)) {
                  for (; x != null && Rs(o, x); )
                    p++, x = t[p];
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
          case Zr:
            if ((l === 5 || l === 26 || l === 27) && tg(e.stateNode, t.value))
              return !0;
            break;
          case Jr:
            if ((l === 5 || l === 6 || l === 26 || l === 27) && (e = eg(e), e !== null && 0 <= e.indexOf(t.value)))
              return !0;
            break;
          case Xr:
            if ((l === 5 || l === 26 || l === 27) && (e = e.memoizedProps["data-testname"], typeof e == "string" && e.toLowerCase() === t.value.toLowerCase()))
              return !0;
            break;
          default:
            throw Error(s(365));
        }
        return !1;
      }
      function js(e) {
        switch (e.$$typeof) {
          case Vr:
            return "<" + (v(e.value) || "Unknown") + ">";
          case Kr:
            return ":has(" + (js(e) || "") + ")";
          case Zr:
            return '[role="' + e.value + '"]';
          case Jr:
            return '"' + e.value + '"';
          case Xr:
            return '[data-testname="' + e.value + '"]';
          default:
            throw Error(s(365));
        }
      }
      function gd(e, t) {
        var l = [];
        e = [e, 0];
        for (var o = 0; o < e.length; ) {
          var u = e[o++], p = u.tag, x = e[o++], M = t[x];
          if (p !== 5 && p !== 26 && p !== 27 || !wl(u)) {
            for (; M != null && Rs(u, M); )
              x++, M = t[x];
            if (x === t.length) l.push(u);
            else
              for (u = u.child; u !== null; )
                e.push(u, x), u = u.sibling;
          }
        }
        return l;
      }
      function Os(e, t) {
        if (!xl) throw Error(s(363));
        e = Ms(e), e = gd(e, t), t = [], e = Array.from(e);
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
        return (xe & 2) !== 0 && _e !== 0 ? _e & -_e : de.T !== null ? Qi() : Yh();
      }
      function bd() {
        if (Ct === 0)
          if ((_e & 536870912) === 0 || Se) {
            var e = Mr;
            Mr <<= 1, (Mr & 3932160) === 0 && (Mr = 262144), Ct = e;
          } else Ct = 536870912;
        return e = Nt.current, e !== null && (e.flags |= 32), Ct;
      }
      function bt(e, t, l) {
        (e === je && (Ae === 2 || Ae === 9) || e.cancelPendingCommit !== null) && (Ca(e, 0), Cn(
          e,
          _e,
          Ct,
          !1
        )), T(e, l), ((xe & 2) === 0 || e !== je) && (e === je && ((xe & 2) === 0 && (pa |= l), Le === 4 && Cn(
          e,
          _e,
          Ct,
          !1
        )), Jt(e));
      }
      function vd(e, t, l) {
        if ((xe & 6) !== 0) throw Error(s(327));
        var o = !l && (t & 127) === 0 && (t & e.expiredLanes) === 0 || O(e, t), u = o ? yh(e, t) : Bs(e, t, !0), p = o;
        do {
          if (u === 0) {
            $a && !o && Cn(e, t, 0, !1);
            break;
          } else {
            if (l = e.current.alternate, p && !bh(l)) {
              u = Bs(e, t, !1), p = !1;
              continue;
            }
            if (u === 2) {
              if (p = t, e.errorRecoveryDisabledLanes & p)
                var x = 0;
              else
                x = e.pendingLanes & -536870913, x = x !== 0 ? x : x & 536870912 ? 536870912 : 0;
              if (x !== 0) {
                t = x;
                e: {
                  var M = e;
                  u = Al;
                  var Y = ft && M.current.memoizedState.isDehydrated;
                  if (Y && (Ca(M, x).flags |= 256), x = Bs(
                    M,
                    x,
                    !1
                  ), x !== 2) {
                    if (vo && !Y) {
                      M.errorRecoveryDisabledLanes |= p, pa |= p, u = 4;
                      break e;
                    }
                    p = xt, xt = u, p !== null && (xt === null ? xt = p : xt.push.apply(
                      xt,
                      p
                    ));
                  }
                  u = x;
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
              if ((t & 62914560) === t && (u = $r + 300 - vt(), 10 < u)) {
                if (Cn(
                  o,
                  t,
                  Ct,
                  !Bn
                ), R(o, 0, !0) !== 0) break e;
                vn = t, o.timeoutHandle = Uh(
                  yd.bind(
                    null,
                    o,
                    l,
                    xt,
                    Wr,
                    xo,
                    t,
                    Ct,
                    pa,
                    Wa,
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
              yd(
                o,
                l,
                xt,
                Wr,
                xo,
                t,
                Ct,
                pa,
                Wa,
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
      function yd(e, t, l, o, u, p, x, M, Y, F, ne, P, le, ge) {
        if (e.timeoutHandle = ra, P = t.subtreeFlags, P & 8192 || (P & 16785408) === 16785408) {
          P = Xh(), fd(
            t,
            p,
            P
          );
          var st = (p & 62914560) === p ? $r - vt() : (p & 4194048) === p ? Ef - vt() : 0;
          if (st = Jh(
            P,
            st
          ), st !== null) {
            vn = p, e.cancelPendingCommit = st(
              Td.bind(
                null,
                e,
                t,
                p,
                l,
                o,
                u,
                x,
                M,
                Y,
                ne,
                P,
                null,
                le,
                ge
              )
            ), Cn(e, p, x, !F);
            return;
          }
        }
        Td(
          e,
          t,
          p,
          l,
          o,
          u,
          x,
          M,
          Y
        );
      }
      function bh(e) {
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
        t &= ~yo, t &= ~pa, e.suspendedLanes |= t, e.pingedLanes &= ~t, o && (e.warmLanes |= t), o = e.expirationTimes;
        for (var u = t; 0 < u; ) {
          var p = 31 - St(u), x = 1 << p;
          o[p] = -1, u &= ~x;
        }
        l !== 0 && w(e, l, t);
      }
      function xd() {
        return (xe & 6) === 0 ? (za(0), !1) : !0;
      }
      function Ds() {
        if (we !== null) {
          if (Ae === 0)
            var e = we.return;
          else
            e = we, mn = sa = null, ns(e), Qa = null, zl = 0, e = we;
          for (; e !== null; )
            Iu(e.alternate, e), e = e.return;
          we = null;
        }
      }
      function Ca(e, t) {
        var l = e.timeoutHandle;
        l !== ra && (e.timeoutHandle = ra, qh(l)), l = e.cancelPendingCommit, l !== null && (e.cancelPendingCommit = null, l()), vn = 0, Ds(), je = e, we = l = dn(e.current, null), _e = t, Ae = 0, Tt = null, Bn = !1, $a = O(e, t), vo = !1, Wa = Ct = yo = pa = Hn = Le = 0, xt = Al = null, xo = !1, (t & 8) !== 0 && (t |= t & 32);
        var o = e.entangledLanes;
        if (o !== 0)
          for (e = e.entanglements, o &= t; 0 < o; ) {
            var u = 31 - St(o), p = 1 << u;
            t |= e[u], o &= ~p;
          }
        return bn = t, rr(), l;
      }
      function wd(e, t) {
        be = null, de.H = Tl, t === Ya || t === qr ? (t = Gc(), Ae = 3) : t === co ? (t = Gc(), Ae = 4) : Ae = t === ho ? 8 : t !== null && typeof t == "object" && typeof t.then == "function" ? 6 : 1, Tt = t, we === null && (Le = 1, hr(
          e,
          V(t, e.current)
        ));
      }
      function kd() {
        var e = Nt.current;
        return e === null ? !0 : (_e & 4194048) === _e ? Bt === null : (_e & 62914560) === _e || (_e & 536870912) !== 0 ? e === Bt : !1;
      }
      function _d() {
        var e = de.H;
        return de.H = Tl, e === null ? Tl : e;
      }
      function Sd() {
        var e = de.A;
        return de.A = b0, e;
      }
      function Sr() {
        Le = 4, Bn || (_e & 4194048) !== _e && Nt.current !== null || ($a = !0), (Hn & 134217727) === 0 && (pa & 134217727) === 0 || je === null || Cn(
          je,
          _e,
          Ct,
          !1
        );
      }
      function Bs(e, t, l) {
        var o = xe;
        xe |= 2;
        var u = _d(), p = Sd();
        (je !== e || _e !== t) && (Wr = null, Ca(e, t)), t = !1;
        var x = Le;
        e: do
          try {
            if (Ae !== 0 && we !== null) {
              var M = we, Y = Tt;
              switch (Ae) {
                case 8:
                  Ds(), x = 6;
                  break e;
                case 3:
                case 2:
                case 9:
                case 6:
                  Nt.current === null && (t = !0);
                  var F = Ae;
                  if (Ae = 0, Tt = null, Aa(e, M, Y, F), l && $a) {
                    x = 0;
                    break e;
                  }
                  break;
                default:
                  F = Ae, Ae = 0, Tt = null, Aa(e, M, Y, F);
              }
            }
            vh(), x = Le;
            break;
          } catch (ne) {
            wd(e, ne);
          }
        while (!0);
        return t && e.shellSuspendCounter++, mn = sa = null, xe = o, de.H = u, de.A = p, we === null && (je = null, _e = 0, rr()), x;
      }
      function vh() {
        for (; we !== null; ) Ed(we);
      }
      function yh(e, t) {
        var l = xe;
        xe |= 2;
        var o = _d(), u = Sd();
        je !== e || _e !== t ? (Wr = null, Ml = vt() + 500, Ca(e, t)) : $a = O(
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
                  if (qc(p)) {
                    Ae = 0, Tt = null, zd(t);
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
                  qc(p) ? (Ae = 0, Tt = null, zd(t)) : (Ae = 0, Tt = null, Aa(e, t, p, 7));
                  break;
                case 5:
                  var x = null;
                  switch (we.tag) {
                    case 26:
                      x = we.memoizedState;
                    case 5:
                    case 27:
                      var M = we, Y = M.type, F = M.pendingProps;
                      if (x ? ff(x) : $d(M.stateNode, Y, F)) {
                        Ae = 0, Tt = null;
                        var ne = M.sibling;
                        if (ne !== null) we = ne;
                        else {
                          var P = M.return;
                          P !== null ? (we = P, Er(P)) : we = null;
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
                  Ds(), Le = 6;
                  break e;
                default:
                  throw Error(s(462));
              }
            }
            xh();
            break;
          } catch (le) {
            wd(e, le);
          }
        while (!0);
        return mn = sa = null, de.H = o, de.A = u, xe = l, we !== null ? 0 : (je = null, _e = 0, rr(), Le);
      }
      function xh() {
        for (; we !== null && !i0(); )
          Ed(we);
      }
      function Ed(e) {
        var t = Xu(
          e.alternate,
          e,
          bn
        );
        e.memoizedProps = e.pendingProps, t === null ? Er(e) : we = t;
      }
      function zd(e) {
        var t = e, l = t.alternate;
        switch (t.tag) {
          case 15:
          case 0:
            t = Gu(
              l,
              t,
              t.pendingProps,
              t.type,
              void 0,
              _e
            );
            break;
          case 11:
            t = Gu(
              l,
              t,
              t.pendingProps,
              t.type.render,
              t.ref,
              _e
            );
            break;
          case 5:
            ns(t);
          default:
            Iu(l, t), t = we = Bd(t, bn), t = Xu(l, t, bn);
        }
        e.memoizedProps = e.pendingProps, t === null ? Er(e) : we = t;
      }
      function Aa(e, t, l, o) {
        mn = sa = null, ns(t), Qa = null, zl = 0;
        var u = t.return;
        try {
          if (uh(
            e,
            u,
            t,
            l,
            _e
          )) {
            Le = 1, hr(
              e,
              V(l, e.current)
            ), we = null;
            return;
          }
        } catch (p) {
          if (u !== null) throw we = u, p;
          Le = 1, hr(
            e,
            V(l, e.current)
          ), we = null;
          return;
        }
        t.flags & 32768 ? (Se || o === 1 ? e = !0 : $a || (_e & 536870912) !== 0 ? e = !1 : (Bn = e = !0, (o === 2 || o === 9 || o === 3 || o === 6) && (o = Nt.current, o !== null && o.tag === 13 && (o.flags |= 16384))), Nd(t, e)) : Er(t);
      }
      function Er(e) {
        var t = e;
        do {
          if ((t.flags & 32768) !== 0) {
            Nd(
              t,
              Bn
            );
            return;
          }
          e = t.return;
          var l = ph(
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
        Le === 0 && (Le = 5);
      }
      function Nd(e, t) {
        do {
          var l = mh(e.alternate, e);
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
        Le = 6, we = null;
      }
      function Td(e, t, l, o, u, p, x, M, Y) {
        e.cancelPendingCommit = null;
        do
          vl();
        while (We !== 0);
        if ((xe & 6) !== 0) throw Error(s(327));
        if (t !== null) {
          if (t === e.current)
            throw Error(s(177));
          if (p = t.lanes | t.childLanes, p |= uo, h(
            e,
            l,
            p,
            x,
            M,
            Y
          ), e === je && (we = je = null, _e = 0), Fa = t, qn = e, vn = l, wo = p, ko = u, zf = o, (t.subtreeFlags & 10256) !== 0 || (t.flags & 10256) !== 0 ? (e.callbackNode = null, e.callbackPriority = 0, Sh(no, function() {
            return jd(), null;
          })) : (e.callbackNode = null, e.callbackPriority = 0), o = (t.flags & 13878) !== 0, (t.subtreeFlags & 13878) !== 0 || o) {
            o = de.T, de.T = null, u = pn(), et(2), x = xe, xe |= 4;
            try {
              hh(e, t, l);
            } finally {
              xe = x, et(u), de.T = o;
            }
          }
          We = 1, Cd(), Ad(), Md();
        }
      }
      function Cd() {
        if (We === 1) {
          We = 0;
          var e = qn, t = Fa, l = (t.flags & 13878) !== 0;
          if ((t.subtreeFlags & 13878) !== 0 || l) {
            l = de.T, de.T = null;
            var o = pn();
            et(2);
            var u = xe;
            xe |= 4;
            try {
              cd(t, e), Bh(e.containerInfo);
            } finally {
              xe = u, et(o), de.T = l;
            }
          }
          e.current = t, We = 2;
        }
      }
      function Ad() {
        if (We === 2) {
          We = 0;
          var e = qn, t = Fa, l = (t.flags & 8772) !== 0;
          if ((t.subtreeFlags & 8772) !== 0 || l) {
            l = de.T, de.T = null;
            var o = pn();
            et(2);
            var u = xe;
            xe |= 4;
            try {
              rd(e, t.alternate, t);
            } finally {
              xe = u, et(o), de.T = l;
            }
          }
          We = 3;
        }
      }
      function Md() {
        if (We === 4 || We === 3) {
          We = 0, s0();
          var e = qn, t = Fa, l = vn, o = zf;
          (t.subtreeFlags & 10256) !== 0 || (t.flags & 10256) !== 0 ? We = 5 : (We = 0, Fa = qn = null, Rd(e, e.pendingLanes));
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
            t = de.T, u = pn(), et(2), de.T = null;
            try {
              for (var p = e.onRecoverableError, x = 0; x < o.length; x++) {
                var M = o[x];
                p(M.value, {
                  componentStack: M.stack
                });
              }
            } finally {
              de.T = t, et(u);
            }
          }
          (vn & 3) !== 0 && vl(), Jt(e), u = e.pendingLanes, (l & 261930) !== 0 && (u & 42) !== 0 ? e === _o ? Rl++ : (Rl = 0, _o = e) : Rl = 0, ft && Kg(), za(0);
        }
      }
      function Rd(e, t) {
        (e.pooledCacheLanes &= t) === 0 && (t = e.pooledCache, t != null && (e.pooledCache = null, rl(t)));
      }
      function vl() {
        return Cd(), Ad(), Md(), jd();
      }
      function jd() {
        if (We !== 5) return !1;
        var e = qn, t = wo;
        wo = 0;
        var l = N(vn), o = 32 > l ? 32 : l;
        l = de.T;
        var u = pn();
        try {
          et(o), de.T = null, o = ko, ko = null;
          var p = qn, x = vn;
          if (We = 0, Fa = qn = null, vn = 0, (xe & 6) !== 0)
            throw Error(s(331));
          var M = xe;
          if (xe |= 4, md(p.current), dd(
            p,
            p.current,
            x,
            o
          ), xe = M, za(0, !1), Et && typeof Et.onPostCommitFiberRoot == "function")
            try {
              Et.onPostCommitFiberRoot(kl, p);
            } catch {
            }
          return !0;
        } finally {
          et(u), de.T = l, Rd(e, t);
        }
      }
      function Od(e, t, l) {
        t = V(l, t), t = ms(e.stateNode, t, 2), e = En(e, t, 2), e !== null && (T(e, 2), Jt(e));
      }
      function Ne(e, t, l) {
        if (e.tag === 3)
          Od(e, e, l);
        else
          for (; t !== null; ) {
            if (t.tag === 3) {
              Od(
                t,
                e,
                l
              );
              break;
            } else if (t.tag === 1) {
              var o = t.stateNode;
              if (typeof t.type.getDerivedStateFromError == "function" || typeof o.componentDidCatch == "function" && (Un === null || !Un.has(o))) {
                e = V(l, e), l = ju(2), o = En(t, l, 2), o !== null && (Ou(
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
      function Hs(e, t, l) {
        var o = e.pingCache;
        if (o === null) {
          o = e.pingCache = new v0();
          var u = /* @__PURE__ */ new Set();
          o.set(t, u);
        } else
          u = o.get(t), u === void 0 && (u = /* @__PURE__ */ new Set(), o.set(t, u));
        u.has(l) || (vo = !0, u.add(l), e = wh.bind(null, e, t, l), t.then(e, e));
      }
      function wh(e, t, l) {
        var o = e.pingCache;
        o !== null && o.delete(t), e.pingedLanes |= e.suspendedLanes & l, e.warmLanes &= ~l, je === e && (_e & l) === l && (Le === 4 || Le === 3 && (_e & 62914560) === _e && 300 > vt() - $r ? (xe & 2) === 0 && Ca(e, 0) : yo |= l, Wa === _e && (Wa = 0)), Jt(e);
      }
      function Dd(e, t) {
        t === 0 && (t = X()), e = ea(e, t), e !== null && (T(e, t), Jt(e));
      }
      function kh(e) {
        var t = e.memoizedState, l = 0;
        t !== null && (l = t.retryLane), Dd(e, l);
      }
      function _h(e, t) {
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
        o !== null && o.delete(t), Dd(e, l);
      }
      function Sh(e, t) {
        return jr(e, t);
      }
      function Eh(e, t, l, o) {
        this.tag = e, this.key = l, this.sibling = this.child = this.return = this.stateNode = this.type = this.elementType = null, this.index = 0, this.refCleanup = this.ref = null, this.pendingProps = t, this.dependencies = this.memoizedState = this.updateQueue = this.memoizedProps = null, this.mode = o, this.subtreeFlags = this.flags = 0, this.deletions = null, this.childLanes = this.lanes = 0, this.alternate = null;
      }
      function Us(e) {
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
      function Bd(e, t) {
        e.flags &= 65011714;
        var l = e.alternate;
        return l === null ? (e.childLanes = 0, e.lanes = t, e.child = null, e.subtreeFlags = 0, e.memoizedProps = null, e.memoizedState = null, e.updateQueue = null, e.dependencies = null, e.stateNode = null) : (e.childLanes = l.childLanes, e.lanes = l.lanes, e.child = l.child, e.subtreeFlags = 0, e.deletions = null, e.memoizedProps = l.memoizedProps, e.memoizedState = l.memoizedState, e.updateQueue = l.updateQueue, e.type = l.type, t = l.dependencies, e.dependencies = t === null ? null : {
          lanes: t.lanes,
          firstContext: t.firstContext
        }), e;
      }
      function zr(e, t, l, o, u, p) {
        var x = 0;
        if (o = e, typeof e == "function") Us(e) && (x = 1);
        else if (typeof e == "string")
          x = Vt && $e ? rf(e, l, rt.current) ? 26 : hf(e) ? 27 : 5 : Vt ? rf(
            e,
            l,
            rt.current
          ) ? 26 : 5 : $e && hf(e) ? 27 : 5;
        else
          e: switch (e) {
            case Js:
              return e = r(31, l, t, u), e.elementType = Js, e.lanes = p, e;
            case Ra:
              return la(
                l.children,
                u,
                p,
                t
              );
            case Qd:
              x = 8, u |= 24;
              break;
            case Qs:
              return e = r(12, l, t, u | 2), e.elementType = Qs, e.lanes = p, e;
            case Ks:
              return e = r(13, l, t, u), e.elementType = Ks, e.lanes = p, e;
            case Zs:
              return e = r(19, l, t, u), e.elementType = Zs, e.lanes = p, e;
            default:
              if (typeof e == "object" && e !== null)
                switch (e.$$typeof) {
                  case An:
                    x = 10;
                    break e;
                  case Vd:
                    x = 9;
                    break e;
                  case Vs:
                    x = 11;
                    break e;
                  case Xs:
                    x = 14;
                    break e;
                  case Mn:
                    x = 16, o = null;
                    break e;
                }
              x = 29, l = Error(
                s(
                  130,
                  e === null ? "null" : typeof e,
                  ""
                )
              ), o = null;
          }
        return t = r(x, l, t, u), t.elementType = e, t.type = o, t.lanes = p, t;
      }
      function la(e, t, l, o) {
        return e = r(7, e, o, t), e.lanes = l, e;
      }
      function qs(e, t, l) {
        return e = r(6, e, null, t), e.lanes = l, e;
      }
      function Hd(e) {
        var t = r(18, null, null, 0);
        return t.stateNode = e, t;
      }
      function Ls(e, t, l) {
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
      function zh(e, t, l, o, u, p, x, M, Y) {
        this.tag = 1, this.containerInfo = e, this.pingCache = this.current = this.pendingChildren = null, this.timeoutHandle = ra, this.callbackNode = this.next = this.pendingContext = this.context = this.cancelPendingCommit = null, this.callbackPriority = 0, this.expirationTimes = $(-1), this.entangledLanes = this.shellSuspendCounter = this.errorRecoveryDisabledLanes = this.expiredLanes = this.warmLanes = this.pingedLanes = this.suspendedLanes = this.pendingLanes = 0, this.entanglements = $(0), this.hiddenUpdates = $(null), this.identifierPrefix = o, this.onUncaughtError = u, this.onCaughtError = p, this.onRecoverableError = x, this.pooledCache = null, this.pooledCacheLanes = 0, this.formState = Y, this.incompleteTransitions = /* @__PURE__ */ new Map();
      }
      function Ud(e, t, l, o, u, p, x, M, Y, F, ne, P) {
        return e = new zh(
          e,
          t,
          l,
          x,
          Y,
          F,
          ne,
          P,
          M
        ), t = 1, p === !0 && (t |= 24), p = r(3, null, null, t), e.current = p, p.stateNode = e, t = Yi(), t.refCount++, e.pooledCache = t, t.refCount++, p.memoizedState = {
          element: o,
          isDehydrated: l,
          cache: t
        }, Zi(p), e;
      }
      function qd(e) {
        return e ? (e = Ba, e) : Ba;
      }
      function Ld(e) {
        var t = e._reactInternals;
        if (t === void 0)
          throw typeof e.render == "function" ? Error(s(188)) : (e = Object.keys(e).join(","), Error(s(268, e)));
        return e = d(t), e = e !== null ? m(e) : null, e === null ? null : yl(e.stateNode);
      }
      function Gd(e, t, l, o, u, p) {
        u = qd(u), o.context === null ? o.context = u : o.pendingContext = u, o = Sn(t), o.payload = { element: l }, p = p === void 0 ? null : p, p !== null && (o.callback = p), l = En(e, o, t), l !== null && (bt(l, e, t), sl(l, e, t));
      }
      function Yd(e, t) {
        if (e = e.memoizedState, e !== null && e.dehydrated !== null) {
          var l = e.retryLane;
          e.retryLane = l !== 0 && l < t ? l : t;
        }
      }
      function Gs(e, t) {
        Yd(e, t), (e = e.alternate) && Yd(e, t);
      }
      var ye = {}, Nh = X0, _t = $0(), Ys = Object.assign, Th = Symbol.for("react.element"), Nr = Symbol.for("react.transitional.element"), Ma = Symbol.for("react.portal"), Ra = Symbol.for("react.fragment"), Qd = Symbol.for("react.strict_mode"), Qs = Symbol.for("react.profiler"), Vd = Symbol.for("react.consumer"), An = Symbol.for("react.context"), Vs = Symbol.for("react.forward_ref"), Ks = Symbol.for("react.suspense"), Zs = Symbol.for("react.suspense_list"), Xs = Symbol.for("react.memo"), Mn = Symbol.for("react.lazy"), Js = Symbol.for("react.activity"), Ch = Symbol.for("react.memo_cache_sentinel"), Kd = Symbol.iterator, Ah = Symbol.for("react.client.reference"), Tr = Array.isArray, de = Nh.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE, Mh = a.rendererVersion, Rh = a.rendererPackageName, Zd = a.extraDevToolsConfig, yl = a.getPublicInstance, jh = a.getRootHostContext, Oh = a.getChildHostContext, Dh = a.prepareForCommit, Bh = a.resetAfterCommit, Hh = a.createInstance;
      a.cloneMutableInstance;
      var $s = a.appendInitialChild, Xd = a.finalizeInitialChildren, Cr = a.shouldSetTextContent, Jd = a.createTextInstance;
      a.cloneMutableTextInstance;
      var Uh = a.scheduleTimeout, qh = a.cancelTimeout, ra = a.noTimeout, fn = a.isPrimaryRenderer;
      a.warnsIfNotActing;
      var dt = a.supportsMutation, Wt = a.supportsPersistence, ft = a.supportsHydration, Lh = a.getInstanceFromNode;
      a.beforeActiveInstanceBlur;
      var Gh = a.preparePortalMount;
      a.prepareScopeUpdate, a.getInstanceFromScope;
      var et = a.setCurrentUpdatePriority, pn = a.getCurrentUpdatePriority, Yh = a.resolveUpdatePriority;
      a.trackSchedulerEvent, a.resolveEventType, a.resolveEventTimeStamp;
      var Qh = a.shouldAttemptEagerTransition, Vh = a.detachDeletedInstance;
      a.requestPostPaintCallback;
      var Kh = a.maySuspendCommit, Zh = a.maySuspendCommitOnUpdate, Ws = a.maySuspendCommitInSyncRender, $d = a.preloadInstance, Xh = a.startSuspendingCommit, Wd = a.suspendInstance;
      a.suspendOnActiveViewTransition;
      var Jh = a.waitForCommitToBeReady;
      a.getSuspendedCommitReason;
      var ja = a.NotPendingTransition, ia = a.HostTransitionContext, $h = a.resetFormInstance;
      a.bindToConsole;
      var Wh = a.supportsMicrotasks, Fh = a.scheduleMicrotask, xl = a.supportsTestSelectors, Ih = a.findFiberRoot, Ph = a.getBoundingRect, eg = a.getTextContent, wl = a.isHiddenSubtree, tg = a.matchAccessibilityRole, ng = a.setFocusIfFocusable, ag = a.setupIntersectionObserver, lg = a.appendChild, rg = a.appendChildToContainer, ig = a.commitTextUpdate, sg = a.commitMount, og = a.commitUpdate, cg = a.insertBefore, ug = a.insertInContainerBefore, dg = a.removeChild, fg = a.removeChildFromContainer, Fd = a.resetTextContent, pg = a.hideInstance, mg = a.hideTextInstance, hg = a.unhideInstance, gg = a.unhideTextInstance;
      a.cancelViewTransitionName, a.cancelRootViewTransitionName, a.restoreRootViewTransitionName, a.cloneRootViewTransitionContainer, a.removeRootViewTransitionClone, a.measureClonedInstance, a.hasInstanceChanged, a.hasInstanceAffectedParent, a.startViewTransition, a.startGestureTransition, a.stopViewTransition, a.getCurrentGestureOffset, a.createViewTransitionInstance;
      var bg = a.clearContainer;
      a.createFragmentInstance, a.updateFragmentInstanceFiber, a.commitNewChildToFragmentInstance, a.deleteChildFromFragmentInstance;
      var vg = a.cloneInstance, Id = a.createContainerChildSet, Pd = a.appendChildToContainerChildSet, yg = a.finalizeContainerChildren, ef = a.replaceContainerChildren, tf = a.cloneHiddenInstance, nf = a.cloneHiddenTextInstance, Fs = a.isSuspenseInstancePending, Is = a.isSuspenseInstanceFallback, xg = a.getSuspenseInstanceFallbackErrorDetails, wg = a.registerSuspenseInstanceRetry, kg = a.canHydrateFormStateMarker, _g = a.isFormStateMarkerMatching, af = a.getNextHydratableSibling, Sg = a.getNextHydratableSiblingAfterSingleton, Eg = a.getFirstHydratableChild, zg = a.getFirstHydratableChildWithinContainer, Ng = a.getFirstHydratableChildWithinActivityInstance, Tg = a.getFirstHydratableChildWithinSuspenseInstance, Cg = a.getFirstHydratableChildWithinSingleton, Ag = a.canHydrateInstance, Mg = a.canHydrateTextInstance, Rg = a.canHydrateActivityInstance, jg = a.canHydrateSuspenseInstance, Og = a.hydrateInstance, Dg = a.hydrateTextInstance, Bg = a.hydrateActivityInstance, Hg = a.hydrateSuspenseInstance, Ug = a.getNextHydratableInstanceAfterActivityInstance, qg = a.getNextHydratableInstanceAfterSuspenseInstance, Lg = a.commitHydratedInstance, Gg = a.commitHydratedContainer, Yg = a.commitHydratedActivityInstance, Qg = a.commitHydratedSuspenseInstance, Vg = a.finalizeHydratedChildren, Kg = a.flushHydrationEvents;
      a.clearActivityBoundary;
      var Zg = a.clearSuspenseBoundary;
      a.clearActivityBoundaryFromContainer;
      var Xg = a.clearSuspenseBoundaryFromContainer, Jg = a.hideDehydratedBoundary, $g = a.unhideDehydratedBoundary, lf = a.shouldDeleteUnhydratedTailInstances;
      a.diffHydratedPropsForDevWarnings, a.diffHydratedTextForDevWarnings, a.describeHydratableInstanceForDevWarnings;
      var Wg = a.validateHydratableInstance, Fg = a.validateHydratableTextInstance, Vt = a.supportsResources, rf = a.isHostHoistableType, Ps = a.getHoistableRoot, sf = a.getResource, of = a.acquireResource, cf = a.releaseResource, Ig = a.hydrateHoistable, uf = a.mountHoistable, df = a.unmountHoistable, Pg = a.createHoistableInstance, e0 = a.prepareToCommitHoistables, t0 = a.mayResourceSuspendCommit, ff = a.preloadResource, n0 = a.suspendResource, $e = a.supportsSingletons, pf = a.resolveSingletonInstance, a0 = a.acquireSingletonInstance, mf = a.releaseSingletonInstance, hf = a.isHostSingletonType, Oa = a.isSingletonScope, eo = [], Da = -1, Ba = {}, St = Math.clz32 ? Math.clz32 : j, l0 = Math.log, r0 = Math.LN2, Ar = 256, Mr = 262144, Rr = 4194304, jr = _t.unstable_scheduleCallback, to = _t.unstable_cancelCallback, i0 = _t.unstable_shouldYield, s0 = _t.unstable_requestPaint, vt = _t.unstable_now, gf = _t.unstable_ImmediatePriority, o0 = _t.unstable_UserBlockingPriority, no = _t.unstable_NormalPriority, c0 = _t.unstable_IdlePriority, u0 = _t.log, d0 = _t.unstable_setDisableYieldValue, kl = null, Et = null, zt = typeof Object.is == "function" ? Object.is : L, bf = typeof reportError == "function" ? reportError : function(e) {
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
      }, f0 = Object.prototype.hasOwnProperty, ao, vf, lo = !1, yf = /* @__PURE__ */ new WeakMap(), Ha = [], Ua = 0, Or = null, _l = 0, Rt = [], jt = 0, Rn = null, Ft = 1, It = "", rt = b(null), Sl = b(null), jn = b(null), Dr = b(null), it = null, Be = null, Se = !1, On = null, Ot = !1, ro = Error(s(519)), Br = b(null), sa = null, mn = null, p0 = typeof AbortController < "u" ? AbortController : function() {
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
      }, m0 = _t.unstable_scheduleCallback, h0 = _t.unstable_NormalPriority, He = {
        $$typeof: An,
        Consumer: null,
        Provider: null,
        _currentValue: null,
        _currentValue2: null,
        _threadCount: 0
      }, Hr = null, qa = null, io = !1, Ur = !1, so = !1, oa = 0, El = null, oo = 0, La = 0, Ga = null, xf = de.S;
      de.S = function(e, t) {
        Ef = vt(), typeof t == "object" && t !== null && typeof t.then == "function" && nh(e, t), xf !== null && xf(e, t);
      };
      var ca = b(null), Ya = Error(s(460)), co = Error(s(474)), qr = Error(s(542)), Lr = { then: function() {
      } }, ua = null, Qa = null, zl = 0, da = Qc(!0), wf = Qc(!1), Dt = [], Va = 0, uo = 0, Dn = !1, fo = !1, Ka = b(null), Gr = b(0), Nt = b(null), Bt = null, Ye = b(0), hn = 0, be = null, Me = null, Qe = null, Yr = !1, Za = !1, fa = !1, Qr = 0, Nl = 0, Xa = null, g0 = 0, Tl = {
        readContext: at,
        use: ur,
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
      Tl.useEffectEvent = qe;
      var kf = {
        readContext: at,
        use: ur,
        useCallback: function(e, t) {
          return ht().memoizedState = [
            e,
            t === void 0 ? null : t
          ], e;
        },
        useContext: at,
        useEffect: mu,
        useImperativeHandle: function(e, t, l) {
          l = l != null ? l.concat([e]) : null, fr(
            4194308,
            4,
            vu.bind(null, t, e),
            l
          );
        },
        useLayoutEffect: function(e, t) {
          return fr(4194308, 4, e, t);
        },
        useInsertionEffect: function(e, t) {
          fr(4, 2, e, t);
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
          }, o.queue = e, e = e.dispatch = ch.bind(
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
          e = is(e);
          var t = e.queue, l = Nu.bind(
            null,
            be,
            t
          );
          return t.dispatch = l, [e.memoizedState, l];
        },
        useDebugValue: cs,
        useDeferredValue: function(e, t) {
          var l = ht();
          return us(l, e, t);
        },
        useTransition: function() {
          var e = is(!1);
          return e = _u.bind(
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
            (_e & 127) !== 0 || Ic(o, t, l);
          }
          u.memoizedState = l;
          var p = { value: l, getSnapshot: t };
          return u.queue = p, mu(eu.bind(null, o, p, e), [
            e
          ]), o.flags |= 2048, Na(
            9,
            { destroy: void 0 },
            Pc.bind(
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
            var l = It, o = Ft;
            l = (o & ~(1 << 32 - St(o) - 1)).toString(32) + l, t = "_" + t + "R_" + l, l = Qr++, 0 < l && (t += "H" + l.toString(32)), t += "_";
          } else
            l = g0++, t = "_" + t + "r_" + l.toString(32) + "_";
          return e.memoizedState = t;
        },
        useHostTransitionStatus: ds,
        useFormState: cu,
        useActionState: cu,
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
          return t.queue = l, t = fs.bind(
            null,
            be,
            !0,
            l
          ), l.dispatch = t, [e, t];
        },
        useMemoCache: as,
        useCacheRefresh: function() {
          return ht().memoizedState = oh.bind(
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
      }, po = {
        readContext: at,
        use: ur,
        useCallback: xu,
        useContext: at,
        useEffect: os,
        useImperativeHandle: yu,
        useInsertionEffect: gu,
        useLayoutEffect: bu,
        useMemo: wu,
        useReducer: dr,
        useRef: pu,
        useState: function() {
          return dr(sn);
        },
        useDebugValue: cs,
        useDeferredValue: function(e, t) {
          var l = Ge();
          return ku(
            l,
            Me.memoizedState,
            e,
            t
          );
        },
        useTransition: function() {
          var e = dr(sn)[0], t = Ge().memoizedState;
          return [
            typeof e == "boolean" ? e : ul(e),
            t
          ];
        },
        useSyncExternalStore: Fc,
        useId: Eu,
        useHostTransitionStatus: ds,
        useFormState: uu,
        useActionState: uu,
        useOptimistic: function(e, t) {
          var l = Ge();
          return au(l, Me, e, t);
        },
        useMemoCache: as,
        useCacheRefresh: zu
      };
      po.useEffectEvent = hu;
      var _f = {
        readContext: at,
        use: ur,
        useCallback: xu,
        useContext: at,
        useEffect: os,
        useImperativeHandle: yu,
        useInsertionEffect: gu,
        useLayoutEffect: bu,
        useMemo: wu,
        useReducer: rs,
        useRef: pu,
        useState: function() {
          return rs(sn);
        },
        useDebugValue: cs,
        useDeferredValue: function(e, t) {
          var l = Ge();
          return Me === null ? us(l, e, t) : ku(
            l,
            Me.memoizedState,
            e,
            t
          );
        },
        useTransition: function() {
          var e = rs(sn)[0], t = Ge().memoizedState;
          return [
            typeof e == "boolean" ? e : ul(e),
            t
          ];
        },
        useSyncExternalStore: Fc,
        useId: Eu,
        useHostTransitionStatus: ds,
        useFormState: fu,
        useActionState: fu,
        useOptimistic: function(e, t) {
          var l = Ge();
          return Me !== null ? au(l, Me, e, t) : (l.baseState = e, [e, l.queue.dispatch]);
        },
        useMemoCache: as,
        useCacheRefresh: zu
      };
      _f.useEffectEvent = hu;
      var mo = {
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
      }, ho = Error(s(461)), Ve = !1, go = {
        dehydrated: null,
        treeContext: null,
        retryLane: 0,
        hydrationErrors: null
      }, gn = !1, Ke = !1, bo = !1, Sf = typeof WeakSet == "function" ? WeakSet : Set, tt = null, Ze = null, yt = !1, Kt = null, Ja = 8192, b0 = {
        getCacheForType: function(e) {
          var t = at(He), l = t.data.get(e);
          return l === void 0 && (l = e(), t.data.set(e, l)), l;
        },
        cacheSignal: function() {
          return at(He).controller.signal;
        }
      }, Vr = 0, Kr = 1, Zr = 2, Xr = 3, Jr = 4;
      if (typeof Symbol == "function" && Symbol.for) {
        var Cl = Symbol.for;
        Vr = Cl("selector.component"), Kr = Cl("selector.has_pseudo_class"), Zr = Cl("selector.role"), Xr = Cl("selector.test_id"), Jr = Cl("selector.text");
      }
      var v0 = typeof WeakMap == "function" ? WeakMap : Map, xe = 0, je = null, we = null, _e = 0, Ae = 0, Tt = null, Bn = !1, $a = !1, vo = !1, bn = 0, Le = 0, Hn = 0, pa = 0, yo = 0, Ct = 0, Wa = 0, Al = null, xt = null, xo = !1, $r = 0, Ef = 0, Ml = 1 / 0, Wr = null, Un = null, We = 0, qn = null, Fa = null, vn = 0, wo = 0, ko = null, zf = null, Rl = 0, _o = null;
      return ye.attemptContinuousHydration = function(e) {
        if (e.tag === 13 || e.tag === 31) {
          var t = ea(e, 67108864);
          t !== null && bt(t, e, 67108864), Gs(e, 67108864);
        }
      }, ye.attemptHydrationAtCurrentPriority = function(e) {
        if (e.tag === 13 || e.tag === 31) {
          var t = kt();
          t = C(t);
          var l = ea(e, t);
          l !== null && bt(l, e, t), Gs(e, t);
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
            t = ea(e, 2), t !== null && bt(t, e, 2), xd(), Gs(e, 2);
        }
      }, ye.batchedUpdates = function(e, t) {
        return e(t);
      }, ye.createComponentSelector = function(e) {
        return { $$typeof: Vr, value: e };
      }, ye.createContainer = function(e, t, l, o, u, p, x, M, Y, F) {
        return Ud(
          e,
          t,
          !1,
          null,
          l,
          o,
          p,
          null,
          x,
          M,
          Y,
          F
        );
      }, ye.createHasPseudoClassSelector = function(e) {
        return { $$typeof: Kr, value: e };
      }, ye.createHydrationContainer = function(e, t, l, o, u, p, x, M, Y, F, ne, P, le, ge) {
        return e = Ud(
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
        ), e.context = qd(null), l = e.current, o = kt(), o = C(o), u = Sn(o), u.callback = t ?? null, En(l, u, o), t = o, e.current.lanes = t, T(e, t), Jt(e), e;
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
        return { $$typeof: Zr, value: e };
      }, ye.createTestNameSelector = function(e) {
        return { $$typeof: Xr, value: e };
      }, ye.createTextSelector = function(e) {
        return { $$typeof: Jr, value: e };
      }, ye.defaultOnCaughtError = function(e) {
        console.error(e);
      }, ye.defaultOnRecoverableError = function(e) {
        bf(e);
      }, ye.defaultOnUncaughtError = function(e) {
        bf(e);
      }, ye.deferredUpdates = function(e) {
        var t = de.T, l = pn();
        try {
          return et(32), de.T = null, e();
        } finally {
          et(l), de.T = t;
        }
      }, ye.discreteUpdates = function(e, t, l, o, u) {
        var p = de.T, x = pn();
        try {
          return et(2), de.T = null, e(t, l, o, u);
        } finally {
          et(x), de.T = p, xe === 0 && (Ml = vt() + 500);
        }
      }, ye.findAllNodes = Os, ye.findBoundingRects = function(e, t) {
        if (!xl) throw Error(s(363));
        t = Os(e, t), e = [];
        for (var l = 0; l < t.length; l++)
          e.push(Ph(t[l]));
        for (t = e.length - 1; 0 < t; t--) {
          l = e[t];
          for (var o = l.x, u = o + l.width, p = l.y, x = p + l.height, M = t - 1; 0 <= M; M--)
            if (t !== M) {
              var Y = e[M], F = Y.x, ne = F + Y.width, P = Y.y, le = P + Y.height;
              if (o >= F && p >= P && u <= ne && x <= le) {
                e.splice(t, 1);
                break;
              } else if (o !== F || l.width !== Y.width || le < p || P > x) {
                if (!(p !== P || l.height !== Y.height || ne < o || F > u)) {
                  F > o && (Y.width += F - o, Y.x = o), ne < u && (Y.width = u - F), e.splice(t, 1);
                  break;
                }
              } else {
                P > p && (Y.height += P - p, Y.y = p), le < x && (Y.height = x - P), e.splice(t, 1);
                break;
              }
            }
        }
        return e;
      }, ye.findHostInstance = Ld, ye.findHostInstanceWithNoPortals = function(e) {
        return e = d(e), e = e !== null ? g(e) : null, e === null ? null : yl(e.stateNode);
      }, ye.findHostInstanceWithWarning = function(e) {
        return Ld(e);
      }, ye.flushPassiveEffects = vl, ye.flushSyncFromReconciler = function(e) {
        var t = xe;
        xe |= 1;
        var l = de.T, o = pn();
        try {
          if (et(2), de.T = null, e)
            return e();
        } finally {
          et(o), de.T = l, xe = t, (xe & 6) === 0 && za(0);
        }
      }, ye.flushSyncWork = xd, ye.focusWithin = function(e, t) {
        if (!xl) throw Error(s(363));
        for (e = Ms(e), t = gd(e, t), t = Array.from(t), e = 0; e < t.length; ) {
          var l = t[e++], o = l.tag;
          if (!wl(l)) {
            if ((o === 5 || o === 26 || o === 27) && ng(l.stateNode))
              return !0;
            for (l = l.child; l !== null; )
              t.push(l), l = l.sibling;
          }
        }
        return !1;
      }, ye.getFindAllNodesFailureDescription = function(e, t) {
        if (!xl) throw Error(s(363));
        var l = 0, o = [];
        e = [Ms(e), 0];
        for (var u = 0; u < e.length; ) {
          var p = e[u++], x = p.tag, M = e[u++], Y = t[M];
          if ((x !== 5 && x !== 26 && x !== 27 || !wl(p)) && (Rs(p, Y) && (o.push(js(Y)), M++, M > l && (l = M)), M < t.length))
            for (p = p.child; p !== null; )
              e.push(p, M), p = p.sibling;
        }
        if (l < t.length) {
          for (e = []; l < t.length; l++)
            e.push(js(t[l]));
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
          version: Mh,
          rendererPackageName: Rh,
          currentDispatcherRef: de,
          reconcilerVersion: "19.2.0"
        };
        if (Zd !== null && (e.rendererConfig = Zd), typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ > "u") e = !1;
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
        e = Os(e, t);
        var u = ag(
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
        var u = Su(e).queue;
        _u(
          e,
          u,
          t,
          ja,
          l === null ? i : function() {
            var p = Su(e);
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
        return Gd(
          u,
          p,
          e,
          t,
          l,
          o
        ), p;
      }, ye.updateContainerSync = function(e, t, l, o) {
        return Gd(
          t.current,
          2,
          e,
          t,
          l,
          o
        ), 2;
      }, ye;
    }, n.exports.default = n.exports, Object.defineProperty(n.exports, "__esModule", { value: !0 });
  })(No)), No.exports;
}
var qf;
function F0() {
  return qf || (qf = 1, zo.exports = W0()), zo.exports;
}
var I0 = F0();
const P0 = /* @__PURE__ */ dc(I0);
var Ao = { exports: {} }, yn = {};
/**
 * @license React
 * react-reconciler-constants.production.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var Lf;
function eb() {
  return Lf || (Lf = 1, yn.ConcurrentRoot = 1, yn.ContinuousEventPriority = 8, yn.DefaultEventPriority = 32, yn.DiscreteEventPriority = 2, yn.IdleEventPriority = 268435456, yn.LegacyRoot = 0, yn.NoEventPriority = 0), yn;
}
var Gf;
function tb() {
  return Gf || (Gf = 1, Ao.exports = eb()), Ao.exports;
}
var Kl = tb();
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
const Gp = ["accent", "panel-bg", "surface-0", "surface-1", "surface-dim", "overlay-0", "overlay-1", "text", "subtext-0", "mauve", "green", "yellow", "red", "blue", "teal", "peach", "backdrop", "card-bg"], Qo = 16, Di = /* @__PURE__ */ new Set(["hover", "focus", "focus-visible", "focus-within", "active"]), nb = [
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
], Yf = {
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
}, ab = /* @__PURE__ */ new Set([
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
]), Yp = {
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
}, Qp = {
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
}, Vo = ["font-size", "color", ...new Set([...Object.keys(Yp), ...Object.keys(Qp)].filter((n) => n !== "font-size" && n !== "color"))], lb = new Set(Vo);
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
function Ko(n, a, r = 0) {
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
    const m = n.slice(c + 4, d - 1), g = ct(m, ","), y = g[0].trim(), v = g.length > 1 ? m.slice(m.indexOf(",") + 1).trim() : null;
    let b = a(y);
    if ((b == null || b === "initial") && (b = v), b == null) return null;
    const S = Ko(b, a, r + 1);
    if (S === null) return null;
    i += S, s = d;
  }
}
function rb(n) {
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
function Xn(n, a) {
  const r = rb(n.trim().replace(/env\(\s*safe-area-inset-(?:top|right|bottom|left)\s*(?:,[^()]*)?\)/gi, "0px"));
  if (!r) return null;
  let i = 0;
  const s = ({ num: b, unit: S }) => {
    switch (S) {
      case "":
        return { px: 0, pct: 0, num: b, unitless: !0 };
      case "px":
        return { px: b, pct: 0, num: 0 };
      case "rem":
        return { px: b * Qo, pct: 0, num: 0 };
      case "em":
        return { px: b * (a.fontSize ?? Qo), pct: 0, num: 0 };
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
      const S = y();
      return r[i]?.op !== ")" ? null : (i++, S);
    }
    if (b.op === "-" || b.op === "+") {
      const S = m();
      return b.op === "-" ? f(S, -1) : S;
    }
    if (b.fn) {
      const S = [];
      for (; ; ) {
        S.push(y());
        const z = r[i++];
        if (!z) return null;
        if (z.op === ")") break;
        if (z.op !== ",") return null;
      }
      if (S.some((z) => !z)) return null;
      if (b.fn === "calc") return S[0];
      if (!(S.every((z) => !z.pct) || S.every((z) => !z.px && !z.num))) return null;
      const j = (z) => z.px + z.pct + z.num;
      return b.fn === "min" ? S.reduce((z, R) => j(R) < j(z) ? R : z) : b.fn === "max" ? S.reduce((z, R) => j(R) > j(z) ? R : z) : b.fn === "clamp" && S.length === 3 ? j(S[1]) < j(S[0]) ? S[0] : j(S[1]) > j(S[2]) ? S[2] : S[1] : null;
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
  function y() {
    let b = g();
    for (; r[i] && (r[i].op === "+" || r[i].op === "-"); ) {
      const S = r[i++].op;
      b = c(b, g(), S === "-" ? -1 : 1);
    }
    return b;
  }
  const v = y();
  return i !== r.length || !v ? null : v;
}
function Zo(n, a) {
  const r = n.trim().toLowerCase();
  if (/^(auto|none|normal|fit-content|max-content|min-content|medium|thin|thick)$/.test(r))
    return r === "thin" ? { px: 1 } : r === "medium" ? { px: 3 } : r === "thick" ? { px: 5 } : r;
  const i = Xn(r, a);
  return i ? i.unitless ? i.num === 0 ? { px: 0 } : { expr: n.trim() } : i.pct && (i.px || i.num) ? { expr: n.trim() } : i.pct ? { pct: i.pct } : { px: ib(i.px) } : { expr: n.trim() };
}
const ib = (n) => Number.isFinite(n) ? n : n > 0 ? 34e37 : -34e37, Ir = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0"), sb = ([n, a, r, i]) => `#${Ir(n)}${Ir(a)}${Ir(r)}${Ir(i * 255)}`;
function Qf(n) {
  const a = n.slice(1), r = a.length <= 4 ? a.split("").map((s) => s + s).join("") : a;
  if (!/^[0-9a-f]{6}([0-9a-f]{2})?$/i.test(r)) return null;
  const i = (s) => parseInt(r.slice(s, s + 2), 16);
  return [i(0), i(2), i(4), r.length === 8 ? i(6) / 255 : 1];
}
function bi(n, a) {
  const r = n.trim().toLowerCase();
  if (r === "currentcolor") return "currentcolor";
  const i = /^perchtoken\(([a-z0-9-]+)\)$/.exec(r);
  if (i) {
    const g = a(i[1]), y = g && Qf(g);
    return y ? { rgba: y, token: i[1] } : null;
  }
  if (r.startsWith("#")) {
    const g = Qf(r);
    return g ? { rgba: g, token: null } : null;
  }
  if (Yf[r]) return { rgba: [...Yf[r]], token: null };
  const s = /^(rgba?|color-mix)\((.*)\)$/s.exec(r);
  if (!s) return null;
  if (s[1] === "color-mix") {
    const g = ct(s[2], ",");
    if (g.length !== 3 || !/^in\s+(srgb|srgb-linear|oklab|lab|oklch|lch|hsl|xyz)/.test(g[0])) return null;
    const y = (D) => {
      const L = ct(D), W = L.findIndex((I) => /%$/.test(I)), q = W >= 0 ? parseFloat(L[W]) / 100 : null;
      return { color: bi(L.filter((I, V) => V !== W).join(" "), a), pct: q };
    }, v = y(g[1]), b = y(g[2]);
    if (!v.color || !b.color || v.color === "currentcolor" || b.color === "currentcolor") return null;
    let S = v.pct, E = b.pct;
    S === null && E === null ? (S = 0.5, E = 0.5) : S === null ? S = 1 - E : E === null && (E = 1 - S);
    const j = S + E, z = j < 1 ? j : 1;
    S /= j, E /= j;
    const [R, O, H, X] = v.color.rgba, [$, T, h, w] = b.color.rgba, k = X * S + w * E, _ = (D, L) => k === 0 ? 0 : (D * X * S + L * w * E) / k, C = [_(R, $), _(O, T), _(H, h), k * z], N = w === 0 ? v.color.token : X === 0 ? b.color.token : null;
    return { rgba: C, token: N };
  }
  const c = s[2].includes(",") ? ct(s[2], ",") : ct(s[2].replace("/", " / ")).filter((g) => g !== "/");
  if (c.length < 3) return null;
  const f = (g) => g.endsWith("%") ? parseFloat(g) / 100 * 255 : parseFloat(g), d = c[3] === void 0 ? 1 : c[3].endsWith("%") ? parseFloat(c[3]) / 100 : parseFloat(c[3]), m = [f(c[0]), f(c[1]), f(c[2]), d];
  return m.some((g) => Number.isNaN(g)) ? null : { rgba: m, token: null };
}
const ql = ["top", "right", "bottom", "left"], ob = ["top-left", "top-right", "bottom-right", "bottom-left"], Pr = (n) => [n[0], n[1] ?? n[0], n[2] ?? n[0], n[3] ?? n[1] ?? n[0]], Vf = /* @__PURE__ */ new Set(["none", "hidden", "solid", "dashed", "dotted", "double", "groove", "ridge", "inset", "outset"]);
function Xo(n, a) {
  const r = a.trim(), i = () => ct(r);
  switch (n) {
    case "padding":
    case "margin": {
      const s = Pr(i());
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
      const s = Pr(i());
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
      const s = n.split("-")[1], c = Pr(i());
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
          Vf.has(m) ? f = m : /^(thin|medium|thick|-?[\d.]|calc\()/.test(m) ? c = m : d = m;
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
      const s = Pr(ct(r.split("/")[0]));
      return ob.map((c, f) => [`border-${c}-radius`, s[f]]);
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
      return r === "none" ? [["background-color", "transparent"], ["background-image", "none"]] : bi(r, () => "#000000") ? [["background-color", r], ["background-image", "none"]] : [["background-color", "transparent"], ["background-image", r]];
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
      return Xo("gap", r);
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
        Vf.has(d) || d === "auto" ? c = d : /^(thin|medium|thick|-?[\d.]|calc\()/.test(d) ? s = d : f = d;
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
function cb(n, a) {
  return n ? ct(n, ",").some((r) => {
    let i = r.trim().toLowerCase(), s = !1;
    i.startsWith("not ") && (s = !0, i = i.slice(4)), i.startsWith("only ") && (i = i.slice(5));
    const c = i.split(/\s+and\s+/).every((f) => {
      if (f = f.trim(), f === "all" || f === "screen") return !0;
      if (f === "print") return !1;
      const d = /^\((.+)\)$/.exec(f);
      if (!d) return !1;
      const m = d[1].trim(), g = /^([a-z-]+)\s*:\s*(.+)$/.exec(m);
      if (g) {
        const [, v, b] = g, S = (E) => {
          const j = Zo(E, { viewport: a });
          return typeof j == "object" && "px" in j ? j.px : NaN;
        };
        switch (v) {
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
      const y = /^(width|height)\s*(>=|<=|>|<|=)\s*(.+)$/.exec(m);
      if (y) {
        const v = y[1] === "width" ? a.width : a.height, b = Zo(y[3], { viewport: a }), S = typeof b == "object" && "px" in b ? b.px : NaN;
        switch (y[2]) {
          case ">=":
            return v >= S;
          case "<=":
            return v <= S;
          case ">":
            return v > S;
          case "<":
            return v < S;
          default:
            return v === S;
        }
      }
      return !1;
    });
    return s ? !c : c;
  }) : !0;
}
function ub(n, a) {
  const r = a[a.length - 1].compound;
  return fc(r)[0] ?? n;
}
function db(n) {
  const a = (r) => r.some((i) => Di.has(i.name) || (i.list ?? []).some((s) => s.some(({ compound: c }) => a(c.pseudos))));
  return a(n[n.length - 1].compound.pseudos);
}
function fb(n) {
  const a = /* @__PURE__ */ new Set(), r = /* @__PURE__ */ new Set(), i = (s, c) => {
    s.forEach(({ compound: f }, d) => {
      const m = c && d === s.length - 1;
      for (const g of f.pseudos)
        if (Di.has(g.name) && (m ? a : r).add(g.name), g.list && g.name !== "not") for (const y of g.list) i(y, m);
    });
  };
  return i(n, !0), { subject: a, ancestor: r };
}
function fc(n) {
  const a = [...n.classes];
  for (const r of n.pseudos)
    if (!(r.name !== "is" && r.name !== "where"))
      for (const i of r.list) i.length === 1 && a.push(...fc(i[0].compound));
  return a;
}
function pb(n, a) {
  const r = (i, s) => {
    i.forEach(({ compound: c }, f) => {
      const d = s && f === i.length - 1, m = c.pseudos.filter((g) => Di.has(g.name)).map((g) => g.name);
      if (!d) for (const g of m) for (const y of fc(c)) a.add(`${g}:${y}`);
      for (const g of c.pseudos) if (g.list && g.name !== "not") for (const y of g.list) r(y, d);
    });
  };
  r(n, !0);
}
class mb {
  constructor(a) {
    this.properties = a.properties ?? {}, this.rules = [], this.skipped = 0, this.index = /* @__PURE__ */ new Map(), this.trackedStates = /* @__PURE__ */ new Set(), this.dependsCache = /* @__PURE__ */ new Map(), this.candidateCache = /* @__PURE__ */ new Map();
    const r = (c, f) => {
      const d = f[f.length - 1].compound, m = d.classes.length ? `.${d.classes[0]}` : d.tag && d.tag !== "*" ? d.tag : "*";
      this.index.has(m) || this.index.set(m, []), this.index.get(m).push(c);
    };
    let i = 0;
    const s = (c, f) => {
      for (const [d, m, g, y] of c)
        for (const v of oc(d)) {
          let b;
          try {
            b = cc(v);
          } catch (z) {
            if (z instanceof ot) {
              this.skipped++;
              continue;
            }
            throw z;
          }
          const S = fb(b);
          pb(b, this.trackedStates);
          const E = b[b.length - 1].compound.pseudoElement, j = { steps: b, media: m, layer: g, origin: f, order: i++, specificity: Mp(b), decls: y, states: S, pseudo: E, own: vb(b), assumed: db(b), above: gb(b), source: f === 0 ? `ua:${b[b.length - 1].compound.tag ?? "*"}` : ub(v, b) };
          this.rules.push(j), r(j, b);
        }
    };
    s(nb.map(([c, f]) => [c, null, 0, Object.entries(f)]), 0), s(a.rules, 1);
  }
  /** Rules that may match `element` (by its classes, its tag, and the universal ones), or its `pseudo` box
   * (`before`, `after`). */
  candidates(a, r = null) {
    const i = `${a.tagName} ${a.className}|${r ?? ""}`, s = this.candidateCache.get(i);
    if (s) return s;
    const c = [], f = /* @__PURE__ */ new Set(), d = new Set(a.classList), m = (g) => {
      if (g) for (const y of g) !f.has(y) && y.pseudo === r && (f.add(y), Vp(y.steps[y.steps.length - 1].compound, a.tagName, d) && c.push(y));
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
        const m = d.reads ??= Zp(d.steps);
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
function Vp(n, a, r) {
  if (n.tag && n.tag !== "*" && n.tag !== a) return !1;
  for (const i of n.classes) if (!r.has(i)) return !1;
  for (const i of n.pseudos) {
    if (i.name === "has") return !0;
    if (i.name === "root" && a !== "html" || (i.name === "where" || i.name === "is") && i.list.every((s) => s.length === 1 && !Vp(s[0].compound, a, r))) return !1;
  }
  return !0;
}
const hb = /* @__PURE__ */ new Set(["first-child", "last-child", "only-child", "nth-child"]);
function gb(n) {
  const a = [];
  for (let r = n.length - 1; r > 0 && !(n[r].combinator !== " " && n[r].combinator !== ">"); r--)
    a.push(...n[r - 1].compound.classes);
  return a;
}
function Kp(n) {
  const a = n.parentElement;
  if (!a) return bb;
  const r = Kp(a), i = n.aboveCache;
  if (i && i.parent === a && i.name === a.className && i.base === r) return i.set;
  const s = a.classSet, c = s.size === 0 ? r : /* @__PURE__ */ new Set([...r, ...s]);
  return n.aboveCache = { parent: a, name: a.className, base: r, set: c }, c;
}
const bb = /* @__PURE__ */ new Set();
function vb(n) {
  if (n.length !== 1) return !1;
  const { compound: a } = n[0];
  return !a.id && !a.attrs.length && a.pseudos.every((r) => Di.has(r.name) && r.name !== "focus-within");
}
function Zp(n, a = !0, r = { anc: !1, pos: !1, nth: !1, ancPos: !1 }) {
  return n.forEach((i, s) => {
    const c = a && s === n.length - 1;
    c || (r.anc = !0);
    for (const f of i.compound.pseudos)
      if (hb.has(f.name) && (c ? r.pos = !0 : r.ancPos = !0, f.name === "nth-child" && c && (r.nth = !0)), f.list && f.name !== "has") for (const d of f.list) Zp(d, c, r);
  }), r;
}
const yb = /* @__PURE__ */ new Set(["opacity", "z-index", "flex-grow", "flex-shrink", "font-weight", "line-height", "flex", "order", "-webkit-line-clamp", "zoom"]);
function xb(n) {
  if (!n || typeof n != "object") return [];
  const a = [];
  for (const [r, i] of Object.entries(n)) {
    if (i == null || i === "" || typeof i == "boolean") continue;
    const s = r.startsWith("--") ? r : r.replace(/[A-Z]/g, (f) => `-${f.toLowerCase()}`).replace(/^(webkit|moz|ms)-/, "-$1-"), c = typeof i == "number" && i !== 0 && !yb.has(s) && !s.startsWith("--") ? `${i}px` : String(i);
    a.push([s, c]);
  }
  return a;
}
function wb(n) {
  if (n.tagName !== "svg") return [];
  const a = [];
  for (const r of ["width", "height"]) {
    const i = n.getAttribute(r);
    i !== null && a.push([r, /^[\d.]+$/.test(i) ? `${i}px` : i]);
  }
  return a;
}
const kb = (n, a) => n.important - a.important || n.origin - a.origin || n.layer - a.layer || n.specificity[0] - a.specificity[0] || n.specificity[1] - a.specificity[1] || n.specificity[2] - a.specificity[2] || n.order - a.order;
class _b {
  constructor(a, { theme: r, viewport: i }) {
    this.sheet = a, this.theme = r, this.viewport = i, this.parsed = /* @__PURE__ */ new Map(), this.computed = /* @__PURE__ */ new WeakMap(), this.rootComputed = /* @__PURE__ */ new Map(), this.media = /* @__PURE__ */ new Map(), this.ownMatches = /* @__PURE__ */ new Map();
  }
  mediaHolds(a) {
    if (!a.media) return !0;
    for (const r of a.media) {
      let i = this.media.get(r);
      if (i === void 0 && this.media.set(r, i = cb(r, this.viewport)), !i) return !1;
    }
    return !0;
  }
  themeHex(a) {
    return this.theme?.[a] ?? null;
  }
  /** Rules matching `element`; `assume` is the set of interaction states assumed on the element itself
   * (`"*"`: any, for finding variant rules). Ancestors use their real state. */
  matching(a, r, i = null, s = null) {
    const f = { state: (E, j, z) => {
      if (j === "disabled") return !!E.props?.disabled && ["button", "input", "select", "textarea", "fieldset"].includes(E.tagName);
      if (j === "enabled") return !E.props?.disabled && ["button", "input", "select", "textarea"].includes(E.tagName);
      if (j === "checked") return !!E.props?.checked;
      if (r === "*") return !0;
      if (j === "focus-within") {
        const R = E.ownerDocument?.activeElement;
        return !!R && R !== E.ownerDocument.body && typeof E.contains == "function" && E.contains(R);
      }
      return z ? r.has(j) : j === "focus-visible" ? !!E.state?.focus && !E.state?.pointerFocus : !!E.state?.[j];
    }, pseudo: i }, d = this.sheet.candidates(a, i), m = `${a.tagName} ${a.className}|${i ?? ""}|${r === "*" ? "*" : [...r].sort().join(",")}`;
    let g = this.ownMatches.get(m);
    g || (g = new Set(d.filter((E) => E.own && this.mediaHolds(E) && Uo(a, E.steps, f))), this.ownMatches.set(m, g));
    let y = null;
    const v = (E) => E.above.length ? (y ??= Kp(a), E.above.every((j) => y.has(j))) : !0, b = s && r !== "*" ? s[i ?? ""] ??= /* @__PURE__ */ new Map() : null, S = (E) => this.mediaHolds(E) && v(E) && Uo(a, E.steps, f);
    return d.filter((E) => {
      if (E.own) return g.has(E);
      if (!b || E.assumed) return S(E);
      let j = b.get(E);
      return j === void 0 && b.set(E, j = S(E)), j;
    });
  }
  /** `element`'s computed style, or with `pseudo` (`before`, `after`) that of its pseudo-element's box, whose parent
   * is the element (pass the element's own computed style as `parent`). */
  compute(a, r, i = /* @__PURE__ */ new Set(), s = null, c = null) {
    const f = this.matching(a, i, s, c), d = s ? [] : wb(a), m = s ? [] : xb(a.inlineStyle ?? a.props?.style);
    let g = this.rootComputed;
    r && (g = this.computed.get(r.values), g || this.computed.set(r.values, g = /* @__PURE__ */ new Map()));
    const y = `${f.map((b) => b.order).join(",")}|${d.length ? JSON.stringify(d) : ""}|${m.length ? JSON.stringify(m) : ""}`;
    let v = g.get(y);
    return v || g.set(y, v = this.cascade(f, d, m, r)), { ...v, rules: f, element: a, shared: v };
  }
  /** The computed style from the matched `rules`, presentational `attrs`, `inline` declarations and the parent's. */
  cascade(a, r, i, s) {
    const c = [];
    for (const h of a)
      for (const [w, k, _] of h.decls) c.push({ prop: w, value: k, important: _ ? 1 : 0, origin: h.origin === 0 ? 0 : 2, layer: h.layer, specificity: h.specificity, order: h.order, source: h.source });
    for (const [h, w] of r) c.push({ prop: h, value: w, important: 0, origin: 1, layer: 0, specificity: [0, 0, 0], order: 0, source: `attr:${h}` });
    for (const [h, w] of i) c.push({ prop: h, value: w, important: 0, origin: 3, layer: 0, specificity: [1, 0, 0], order: 0, source: "style" });
    c.sort(kb);
    const f = this.sheet.properties, d = Object.create(s?.customs ?? null), m = /* @__PURE__ */ new Map(), g = /* @__PURE__ */ new Map();
    for (const h of c) h.prop.startsWith("--") && g.set(h.prop, h.value);
    if (!s && this.theme) for (const h of Gp) this.theme[h] && g.set(`--${h}`, `perchtoken(${h})`);
    const y = (h) => {
      if (m.has(h)) return m.get(h);
      const w = f[h];
      return w && !w.inherits ? w.initial ?? null : h in d ? d[h] : w?.initial ?? null;
    }, v = /* @__PURE__ */ new Set(), b = (h) => {
      if (!g.has(h)) return y(h);
      if (v.has(h)) return null;
      v.add(h);
      const w = Ko(g.get(h), b);
      return v.delete(h), g.delete(h), m.set(h, w), (!f[h] || f[h].inherits) && (d[h] = w), w;
    };
    for (const h of [...g.keys()]) b(h);
    const S = /* @__PURE__ */ new Map();
    for (const h of c) {
      if (h.prop.startsWith("--")) continue;
      const w = Ko(h.value, y);
      if (w === null) {
        for (const [k] of Xo(h.prop, "unset")) S.set(k, { value: "unset", source: h.source, origin: h.origin });
        continue;
      }
      for (const [k, _] of Xo(h.prop, w)) S.set(k, { value: _, source: h.source, origin: h.origin });
    }
    const E = {}, j = {}, z = /* @__PURE__ */ new Set(), R = /* @__PURE__ */ new Set(), O = s?.values, H = { fontSize: O?.["font-size"] ?? Qo, viewport: this.viewport }, X = (h, w) => {
      if (/currentcolor/i.test(w)) return this.parseValue(h, w, H, E, O);
      const k = `${h}\0${w}\0${H.fontSize}`;
      let _ = this.parsed.get(k);
      return _ === void 0 && this.parsed.set(k, _ = this.parseValue(h, w, H, E, O)), _;
    }, $ = S.size ? [...Vo, ...[...S.keys()].filter((h) => !lb.has(h))] : Vo;
    for (const h of $) {
      const w = S.get(h);
      let k = w?.value;
      const _ = ab.has(h);
      if ((k === void 0 || k === "unset" || k === "revert" || k === "revert-layer") && (k = _ ? "inherit" : "initial"), w && (j[h] = w.source, w.origin !== 0 && z.add(h)), k === "inherit" && O && h in O) {
        E[h] = O[h], R.add(h);
        continue;
      }
      (k === "inherit" || k === "initial") && (k = _ ? Qp[h] : Yp[h]), E[h] = X(h, k), h === "font-size" && (H.fontSize = E["font-size"]);
    }
    for (const h of ql) {
      const w = E[`border-${h}-style`];
      (w === "none" || w === "hidden") && (E[`border-${h}-width`] = { px: 0 });
    }
    E["outline-style"] === "none" && (E["outline-width"] = { px: 0 });
    const T = O?.display;
    return (T === "flex" || T === "inline-flex" || T === "grid" || T === "inline-grid") && E.position !== "absolute" && E.position !== "fixed" && (E.display = Kf(E.display)), (E.position === "absolute" || E.position === "fixed") && (E.display = Kf(E.display)), { values: E, sources: j, own: z, inherited: R, customs: d };
  }
  parseValue(a, r, i, s, c) {
    const f = String(r).trim();
    switch (a) {
      case "font-size": {
        const d = f.toLowerCase(), m = { "xx-small": 9, "x-small": 10, small: 13, medium: 16, large: 18, "x-large": 24, "xx-large": 32 };
        if (m[d]) return m[d];
        if (d === "smaller") return i.fontSize / 1.2;
        if (d === "larger") return i.fontSize * 1.2;
        const g = Xn(d, { fontSize: i.fontSize, viewport: i.viewport });
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
        const m = Xn(d, { fontSize: i.fontSize, viewport: i.viewport });
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
        const d = bi(f, (m) => this.themeHex(m));
        return d === "currentcolor" || !d ? c?.color ?? { rgba: [0, 0, 0, 1], token: null } : d;
      }
      case "background-color":
      case "border-top-color":
      case "border-right-color":
      case "border-bottom-color":
      case "border-left-color":
      case "outline-color": {
        const d = bi(f, (m) => this.themeHex(m));
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
        return Zo(f, i);
      default:
        return f.toLowerCase().startsWith("var(") ? f : /^[a-z-]+$/i.test(f) ? f.toLowerCase() : f;
    }
  }
}
function Kf(n) {
  return n === "inline" || n === "inline-block" || n === "contents" ? "block" : n === "inline-flex" ? "flex" : n === "inline-grid" ? "grid" : n;
}
const vi = (n) => n && n.rgba ? { value: sb(n.rgba), token: n.token ?? null } : null, Sb = { 9.28: 11, 9.92: 12, 10.4: 12, 10.88: 13, 11: 13, 11.2: 13, 11.52: 13, 12: 15, 12.5: 15, 13: 16, 14: 17, 16: 19 };
function Eb(n, a) {
  const r = a?.(n);
  if (Number.isFinite(r)) return r;
  const i = Math.round(n * 100) / 100;
  return Sb[i] ?? Math.round(n * 1.2);
}
function Yl(n, a) {
  const r = n["line-height"], i = n["font-size"];
  return r.normal ? Eb(i, a) : r.factor !== void 0 ? r.factor * i : r.px;
}
const zb = (n) => ct(n, ",").map((a) => a.trim().replace(/^["']|["']$/g, "")).join(", ");
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
const Nb = "perch-native-description/1", nn = Symbol("display"), yi = {
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
}, Tb = ["w", "h", "min_w", "min_h", "max_w", "max_h", "top", "right", "bottom", "left", "pt", "pr", "pb", "pl", "mt", "mr", "mb", "ml", "gap_x", "gap_y", "border_t", "border_r", "border_b", "border_l", "rounded_tl", "rounded_tr", "rounded_br", "rounded_bl"];
for (const n of Tb) yi[n] = /^(w|h|min_|max_|top|right|bottom|left)/.test(n) ? "auto" : 0;
yi.rounded = 0;
const Cb = /* @__PURE__ */ new Set([
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
]), Ab = /(-apple-system|blinkmacsystemfont|system-ui|segoe ui|sans-serif|times)/i, Mb = /(ui-monospace|sfmono|sf mono|menlo|monospace)/i, Rb = (n) => Mb.test(n) ? "Menlo" : /^\s*system-ui\s*$/i.test(n ?? "") ? ".AppleSystemUIFont" : Ab.test(n) ? ".SystemUIFont" : zb(n).split(",")[0].trim(), jb = {
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
}, Zf = { pointerdown: "mouse_down", mousedown: "mouse_down", click: "click", keydown: "key_down", pointerup: "mouse_up", mouseup: "mouse_up" }, pc = (n) => {
  const a = n.props["data-testid"];
  if (a) return `${n.tagName}[data-testid="${a}"]`;
  if (n.props.id) return `${n.tagName}#${n.props.id}`;
  const r = n.classList.find((s) => !s.includes(":") && !s.includes("[")) ?? n.classList[0];
  if (r) return `${n.tagName}.${r}`;
  const i = n.parentElement;
  return i && i.tagName !== "body" ? `${pc(i)} > ${n.tagName}` : n.tagName;
};
class Ob {
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
}, Db = /^(text|search|url|email|tel|password|number)$/, Bb = 162.13 / 12.8;
function Hb(n, a) {
  const r = typeof n == "object" && /^min\((.*)\)$/.exec(String(n?.expr ?? "").trim());
  if (!r) return;
  const i = ct(r[1], ",").map((s) => Xn(s.trim(), { fontSize: a })).filter((s) => s && !s.pct && !s.num).map((s) => s.px);
  return i.length ? Math.min(...i) : void 0;
}
function Ub(n, a) {
  if (typeof n != "object" || !n?.expr) return !1;
  const r = Xn(n.expr, { fontSize: a["font-size"] }), i = (a["margin-left"]?.px ?? NaN) + (a["margin-right"]?.px ?? NaN);
  return !!r && !r.num && r.pct === 100 && Math.abs(r.px + i) < 0.01;
}
function Xp(n) {
  const a = n.transform;
  if (a && a !== "none") {
    const i = /^\s*translate(X|Y)?\(([^]*)\)\s*$/.exec(a), s = i && ct(i[2], ",").map((c) => c.trim());
    return !s || s.length > (i[1] ? 1 : 2) ? null : i[1] === "X" ? [s[0], "0"] : i[1] === "Y" ? ["0", s[0]] : [s[0], s[1] ?? "0"];
  }
  const r = n.translate;
  if (r && r !== "none") {
    const i = ct(String(r).trim(), " ").filter(Boolean);
    return i.length > 3 || i[2] !== void 0 && Xn(i[2], {})?.px ? null : [i[0], i[1] ?? "0"];
  }
  return [];
}
function Xf(n, a, r, i = !1) {
  const s = n.values, c = Xp(s);
  if (c?.length === 0) return;
  const f = s.transform && s.transform !== "none" ? "transform" : "translate", d = { fontSize: s["font-size"] }, m = (v, b) => {
    const S = Xn(v, d);
    if (!(!S || S.unitless && S.num))
      return S.pct ? typeof b == "number" ? S.px + S.pct / 100 * b : void 0 : S.px;
  }, g = c ? m(c[0], a.w) : void 0, y = c ? m(c[1], a.h) : void 0;
  if (g === void 0 || y === void 0) {
    const v = !i && c ? c.map((b) => Xn(b, d)) : null;
    if (v?.every((b) => b && !(b.unitless && b.num))) {
      a[Jp] = v.map((b) => [b.px, b.pct ?? 0]);
      return;
    }
    r("unsupported", f, s[f], n.sources[f]);
    return;
  }
  if (i) {
    g && (a.left = g), y && (a.top = y);
    return;
  }
  g && (a.ml = (a.ml ?? 0) + g), y && (a.mt = (a.mt ?? 0) + y);
}
const Jp = Symbol("perch.shift");
function qb(n, a, r) {
  const i = n.ownerDocument, s = i?.measure?.(n) ?? null;
  if (s) {
    const [[f, d], [m, g]] = r, y = f + d / 100 * s.width, v = m + g / 100 * s.height;
    y && (a.ml = (typeof a.ml == "number" ? a.ml : 0) + y), v && (a.mt = (typeof a.mt == "number" ? a.mt : 0) + v);
  }
  const c = s ? `${s.width}x${s.height}` : "";
  c === n.shiftSeen ? n.shiftTries = 0 : (n.shiftTries ?? 0) < Bp && i?.retries && (n.shiftSeen = c, n.shiftTries = (n.shiftTries ?? 0) + 1, i.retries.push(() => i.afterCommit?.()));
}
function xi(n, a, r = null) {
  const i = n.values, s = {}, c = (H) => n.sources[H], f = (H) => n.sources[H] !== void 0, d = i.display;
  d === "none" ? s.display = "hidden" : d === "flex" || d === "inline-flex" ? s.display = "flex" : (d === "grid" || d === "inline-grid") && (s.display = "flex", s.flex_direction = "col", a("approximated", "display", d, c("display"), "one-column flex column"), i["grid-template-columns"] && i["grid-template-columns"] !== "none" && a("unsupported", "grid-template-columns", i["grid-template-columns"], c("grid-template-columns"))), n.element.hidden && (s.display = "hidden");
  const m = s.display === "flex";
  if (m && s.flex_direction !== "col") {
    const H = { row: "row", column: "col", "row-reverse": "row_reverse", "column-reverse": "col_reverse" }[i["flex-direction"]] ?? "row";
    s.flex_direction = H;
  }
  if (m) {
    (i["flex-wrap"] === "wrap" || i["flex-wrap"] === "wrap-reverse") && (s.flex_wrap = "wrap");
    const H = d === "grid" || d === "inline-grid", X = { "flex-start": "start", start: "start", "self-start": "start", "flex-end": "end", end: "end", "self-end": "end", center: "center", baseline: "baseline", "first baseline": "baseline" }[i["align-items"]];
    X && (s.items = X);
    let $ = { "flex-start": "start", start: "start", "flex-end": "end", end: "end", center: "center", "space-between": "between", "space-around": "around", "space-evenly": "evenly" }[i["justify-content"]];
    if (H) {
      const w = { center: "center", end: "end", "flex-end": "end", start: "start", "flex-start": "start" }[i["justify-items"]];
      w && (s.items = w), i["align-items"] === "center" && ($ = "center");
    }
    $ && (s.justify = $);
    const T = wn(i["row-gap"]), h = wn(i["column-gap"]);
    typeof T == "number" && T && (s.gap_y = T), typeof h == "number" && h && !H && (s.gap_x = h);
  }
  i["flex-grow"] && (s.flex_grow = i["flex-grow"]), i["flex-shrink"] !== 1 && (s.flex_shrink = i["flex-shrink"]);
  const g = wn(i["flex-basis"]);
  g !== void 0 && g !== "auto" && (s.flex_basis = g);
  const y = { "flex-start": "start", start: "start", "flex-end": "end", end: "end", center: "center", baseline: "baseline", stretch: "stretch" }[i["align-self"]];
  y && (s.self = y);
  for (const [H, X] of [["w", "width"], ["h", "height"], ["min_w", "min-width"], ["min_h", "min-height"], ["max_w", "max-width"], ["max_h", "max-height"]]) {
    const $ = i[X], T = wn($);
    if (T === void 0 && X === "width" && Ub($, i)) {
      s.self = "stretch", a("approximated", X, $.expr, c(X), "stretched across its parent, inside its margins");
      continue;
    }
    const h = T === void 0 && /^max-/.test(X) ? Hb($, i["font-size"]) : void 0;
    if (h !== void 0) {
      s[H] = h, a("approximated", X, $.expr, c(X), "the fixed bound of min()");
      continue;
    }
    if (T === void 0) {
      typeof $ == "object" && $.expr ? a("unsupported", X, $.expr, c(X), "no calc() in the engine") : typeof $ == "string" && !["auto", "none"].includes($) && a("unsupported", X, $, c(X));
      continue;
    }
    T !== "auto" && (s[H] = T);
  }
  const v = ["top", "right", "bottom", "left"];
  for (const H of v) {
    const X = H[0];
    for (const [$, T] of [["p", "padding"], ["m", "margin"]]) {
      const h = i[`${T}-${H}`], w = wn(h);
      if (w === void 0) {
        h?.expr && a("unsupported", `${T}-${H}`, h.expr, c(`${T}-${H}`), "no calc() in the engine");
        continue;
      }
      w !== 0 && (s[`${$}${X}`] = w);
    }
  }
  const b = i.position;
  if (b === "absolute" || b === "fixed") {
    s.position = "absolute", b === "fixed" && a("approximated", "position", "fixed", c("position"), "absolute in the overlay layer");
    for (const H of v) {
      const X = wn(i[H]);
      X !== void 0 && X !== "auto" && (s[H] = X);
    }
    if (b === "fixed" && r && s.w === void 0 && s.right === void 0 && typeof s.left == "number") {
      const H = r.width - s.left - (typeof s.ml == "number" ? s.ml : 0) - (typeof s.mr == "number" ? s.mr : 0);
      s.max_w = typeof s.max_w == "number" ? Math.min(s.max_w, H) : H;
    }
    Xf(n, s, a);
  } else b === "sticky" ? a("unsupported", "position", "sticky", c("position")) : Xp(i)?.length !== 0 && (s.position = "relative", Xf(n, s, a, !0));
  i["z-index"] !== "auto" && f("z-index") && a("unsupported", "z-index", i["z-index"], c("z-index"), "paint order is tree order");
  for (const [H, X] of [["overflow_x", "overflow-x"], ["overflow_y", "overflow-y"]]) {
    const $ = i[X];
    $ === "hidden" || $ === "clip" ? s[H] = "hidden" : ($ === "auto" || $ === "scroll") && (s[H] = "scroll");
  }
  (i.visibility === "hidden" || i.visibility === "collapse") && (s.visibility = "invisible");
  const S = i["background-color"];
  S?.unreadable ? a("unsupported", "background-color", S.unreadable, c("background-color")) : S?.rgba && S.rgba[3] > 0 && (s.bg = vi(S)), i["background-image"] && i["background-image"] !== "none" && a("unsupported", "background-image", i["background-image"], c("background-image"));
  const E = v.map((H) => wn(i[`border-${H}-width`]) || 0), j = [];
  v.forEach((H, X) => {
    if (!E[X]) return;
    s[`border_${H[0]}`] = E[X];
    const $ = i[`border-${H}-style`];
    $ !== "solid" && a("approximated", `border-${H}-style`, $, c(`border-${H}-style`), "drawn solid");
    const T = vi(i[`border-${H}-color`]);
    T && j.push(T);
  }), j.length && (s.border_color = j[0], j.some((H) => H.value !== j[0].value) && a("approximated", "border-color", j.map((H) => H.value).join(" "), c("border-top-color"), "one border colour"));
  const z = (H) => {
    const X = wn(i[`border-${H}-radius`]) || 0;
    if (typeof X != "string") return X;
    const $ = parseFloat(X) / 100, T = [s.w, s.h].filter((h) => typeof h == "number");
    return X === "auto" || !($ > 0) ? 0 : T.length ? Math.round(Math.min($, 0.5) * Math.min(...T) * 100) / 100 : 9999;
  }, R = ["top-left", "top-right", "bottom-right", "bottom-left"].map(z);
  R.every((H) => H === R[0]) ? R[0] && (s.rounded = R[0]) : ["tl", "tr", "br", "bl"].forEach((H, X) => {
    R[X] && (s[`rounded_${H}`] = R[X]);
  }), i.opacity !== 1 && (s.opacity = Math.round(i.opacity * 1e3) / 1e3);
  const O = i["box-shadow"];
  if (O && O !== "none" && ct(O, ",").some((H) => !/^0(px)?\s+0(px)?\s+(0(px)?\s+)?(0(px)?\s+)?(#0000|transparent|rgba?\(0,\s*0,\s*0,\s*0\))/.test(H.trim())) && (s.shadow = "lg", a("approximated", "box-shadow", O, c("box-shadow"), "the engine's large shadow preset")), i.cursor && i.cursor !== "auto" && !n.inherited.has("cursor")) {
    const H = { pointer: "pointer", default: "default", text: "text", move: "move", "not-allowed": "not_allowed", grab: "move", grabbing: "move" }[i.cursor];
    H ? s.cursor = H : a("unsupported", "cursor", i.cursor, c("cursor"));
  }
  return i["text-overflow"] === "ellipsis" && (s.text_ellipsis = !0), i["text-decoration-line"] === "underline" ? s.underline = !0 : i["text-decoration-line"] && i["text-decoration-line"] !== "none" && a("unsupported", "text-decoration-line", i["text-decoration-line"], c("text-decoration-line")), s;
}
const Lb = { "tabular-nums": "tnum", "proportional-nums": "pnum", "lining-nums": "lnum", "oldstyle-nums": "onum", "slashed-zero": "zero", "diagonal-fractions": "frac", "stacked-fractions": "afrc", ordinal: "ordn" };
function $p(n) {
  if (!n || n === "normal") return "";
  const a = String(n).trim().split(/\s+/).map((r) => Lb[r]);
  return a.every(Boolean) ? a.join(",") : null;
}
function wi(n, a) {
  const r = n.values, i = r["line-height"];
  return {
    text_color: vi(r.color),
    text_size: Math.round(r["font-size"] * 1e3) / 1e3,
    font_features: $p(r["font-variant-numeric"]) ?? "",
    font_weight: r["font-weight"],
    line_height: i.factor !== void 0 ? { factor: i.factor } : { px: Math.round(Yl(r, a) * 1e3) / 1e3 },
    font_family: Rb(r["font-family"]),
    italic: r["font-style"] === "italic" || r["font-style"] === "oblique",
    whitespace: r["white-space"] === "nowrap" || r["white-space"] === "pre" ? "nowrap" : "normal",
    text_align: { center: "center", right: "right", end: "right" }[r["text-align"]] ?? "left"
  };
}
const Jf = (n, a) => n.factor !== void 0 ? n.factor * a : n.px, mc = (n, a) => JSON.stringify(n) === JSON.stringify(a);
function ki(n, a, r) {
  const i = {}, s = (d, m) => m.some((g) => !n.inherited.has(g));
  for (const [d, m] of [["text_color", ["color"]], ["text_size", ["font-size"]], ["font_weight", ["font-weight"]], ["font_family", ["font-family"]], ["italic", ["font-style"]], ["whitespace", ["white-space"]], ["text_align", ["text-align"]], ["font_features", ["font-variant-numeric"]]])
    (s(d, m) || !mc(a[d], r[d])) && (i[d] = a[d]);
  const c = Jf(a.line_height, a.text_size), f = r.line_height ? Jf(r.line_height, a.text_size) : NaN;
  return (s("line_height", ["line-height"]) || !(Math.abs(c - f) <= 1e-3)) && (i.line_height = a.line_height), i;
}
const Gb = (n, a) => ({ ...n, ...a });
function _i(n, a) {
  const r = {};
  for (const [i, s] of Object.entries(n))
    s && typeof s == "object" && "value" in s ? (r[i] = s.value, s.token && (a[i] = s.token)) : i === "line_height" ? r[i] = s.factor !== void 0 ? Math.round(s.factor * 1e3) / 1e3 : `${s.px}px` : i === "italic" ? s && (r.italic = !0) : r[i] = s;
  return r.italic === !1 && delete r.italic, r;
}
function Wp(n, a) {
  const r = {};
  for (const i of /* @__PURE__ */ new Set([...Object.keys(n), ...Object.keys(a)])) {
    const s = n[i], c = a[i];
    mc(s, c) || (r[i] = c === void 0 ? i in yi ? yi[i] : null : c);
  }
  return r;
}
function $f(n, a) {
  const r = n.values;
  for (const [i, s] of Object.entries(n.sources)) {
    if (i.startsWith("--") || Cb.has(i) || s.startsWith("ua:")) continue;
    const c = r[i];
    switch (i) {
      case "letter-spacing":
        c !== "normal" && c?.px !== 0 && a("approximated", i, c?.px !== void 0 ? `${Math.round(c.px * 1e3) / 1e3}px` : c, s, c?.px < 0 ? "the run's box is as wide as with the spacing (the glyphs reach past it; where the element clips, the run is drawn smaller to fit)" : "the run is as wide as with the spacing (room after it), the letters are not spread");
        break;
      case "font-variant-numeric":
        c !== "normal" && $p(c) === null && a("unsupported", i, c, s);
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
        r["outline-style"] !== "none" && i === "outline-style" && a("unsupported", "outline", `${wn(r["outline-width"])}px ${r["outline-style"]} ${vi(r["outline-color"])?.value ?? ""}`.trim(), s, "no outline in the engine (no focus ring)");
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
function Yb(n, a, r, i) {
  const s = pc(n), c = {}, f = i.cascade.compute(n, a, /* @__PURE__ */ new Set(), null, c), d = i.cascade.matching(n, "*").filter((O) => O.states.subject.size), m = [];
  for (const [O, H] of Qb)
    d.some((X) => H.some(($) => X.states.subject.has($))) && m.push([O, i.cascade.compute(n, a, new Set(H), null, c)]);
  const g = `${Mo(f.shared)}|${Mo(r)}|${+!!f.element.hidden}|${m.map(([O, H]) => `${O}${Mo(H.shared)}`).join(",")}`;
  let y = (i.cascade.styled ??= /* @__PURE__ */ new Map()).get(g);
  y || i.cascade.styled.set(g, y = Kb(f, m, r, i));
  const { style: v, tokens: b, shift: S, childText: E } = y, j = y.reports.map(([O, H, X, $, T]) => [O, H, X, $, s, T]), z = { ...y.extra };
  if (i.cascade.sheet.tracks(n, "hover") && (z.group = Ff(n), z.track_hover = !0), i.cascade.sheet.readsAncestor(n, "hover"))
    for (let O = n.parentNode; O?.state; O = O.parentNode) {
      if (!i.cascade.sheet.tracks(O, "hover")) continue;
      const H = O.state.hover;
      O.state.hover = !0;
      let X;
      try {
        X = i.cascade.compute(n, a);
      } finally {
        O.state.hover = H;
      }
      const $ = {}, T = _i({ ...xi(X, () => {
      }), ...ki(X, wi(X, i.measure), r) }, $), h = Wp(v, T);
      if (!Object.keys(h).length) continue;
      const w = Object.fromEntries(Object.entries($).filter(([k]) => k in h));
      (z.group_hover ??= []).push({ group: Ff(O), style: h, ...Object.keys(w).length ? { tokens: w } : {} });
    }
  if (/tabular/.test(String(f.values["font-variant-numeric"] ?? "")) && (z.tabular = !0), /^(anywhere|break-word)$/.test(String(f.values["overflow-wrap"] ?? "")) && (z.break_anywhere = !0), y.scrolls) {
    const O = Number.parseFloat(f.customs?.["--scrollbar-size"] ?? "");
    O > 0 && (z.scrollbar = O);
  }
  f.values["pointer-events"] !== "none" && a?.values["pointer-events"] === "none" && (z.blocks_pointer = !0), f.values["pointer-events"] === "none" && (z.pointer_none = !0);
  const R = Object.entries(jb).filter(([, O]) => O.some((H) => typeof n.props[H] == "function")).map(([O]) => O);
  return !R.includes("click") && Yo(n) && R.push("click"), R.length && (z.events = R), { computed: f, style: v, tokens: b, extra: z, meta: e1(n), reports: j, childText: E, where: s, shift: S };
}
const Qb = [["hover", ["hover"]], ["focus", ["focus", "focus-visible"]], ["active", ["active", "hover"]]], Wf = /* @__PURE__ */ new WeakMap();
let Vb = 0;
function Mo(n) {
  let a = Wf.get(n);
  return a === void 0 && Wf.set(n, a = ++Vb), a;
}
function Kb(n, a, r, i) {
  const s = [], c = (b, S, E, j, z) => s.push([b, S, E, j ?? "(user agent)", z]), f = {}, d = xi(n, c, i.viewport);
  $f(n, c);
  const m = wi(n, i.measure), g = ki(n, m, r), y = _i({ ...d, ...g }, f), v = {};
  for (const [b, S] of a) {
    const E = {}, j = _i({ ...xi(S, () => {
    }), ...ki(S, wi(S, i.measure), r) }, E);
    b === "focus" && $f(S, c);
    const z = Wp(y, j);
    if (Object.keys(z).length) {
      v[b] = z;
      const R = Object.fromEntries(Object.entries(E).filter(([O]) => O in z));
      Object.keys(R).length && (v[`${b}_tokens`] = R);
    }
  }
  return { style: y, tokens: f, shift: d[Jp], childText: Gb(r, g), extra: v, scrolls: d.overflow_y === "scroll", reports: s };
}
function Zb(n, a, r, i) {
  const s = { before: null, after: null };
  for (const c of ["before", "after"]) {
    if (!i.cascade.matching(n, /* @__PURE__ */ new Set(), c).length) continue;
    const f = i.cascade.compute(n, a, /* @__PURE__ */ new Set(), c), d = String(f.values.content ?? "none").trim();
    if (d === "none" || d === "normal") continue;
    const m = /^(["'])(.*)\1$/.exec(d)?.[2] ?? "", g = (E, j, z, R, O) => i.add(E, j, z, R ?? "(user agent)", `${pc(n)}::${c}`, O), y = {}, v = xi(f, g, i.viewport), S = { kind: "div", style: _i({ ...v, ...ki(f, wi(f, i.measure), r) }, y), tokens: y, children: m ? [{ kind: "text", text: m }] : [] };
    Object.defineProperty(S, nn, { value: f.values.display }), s[c] = S;
  }
  return s;
}
const Ff = (n) => `~g${n.id}`, Xb = ["pt", "pr", "pb", "pl", "mt", "mr", "mb", "ml", "border_t", "border_r", "border_b", "border_l", "bg"];
function Jb(n) {
  return n.kind === "div" && n[nn] === "inline" && !n.events?.length && !n.meta?.attrs?.["data-testid"] && !Xb.some((a) => n.style?.[a]) && n.children?.every((a) => a.kind === "text");
}
function ei(n, a) {
  const r = n[a], i = { ...r, style: { ...r.style } };
  return Object.defineProperty(i, nn, { value: r[nn] }), n[a] = i, i;
}
function $b(n) {
  const a = [];
  for (let r = n.parentElement; r?.parentElement; r = r.parentElement) {
    const i = r.parentElement.children;
    a.push(`${+(i[0] === r)}${+(i[i.length - 1] === r)}`);
  }
  return a.join("");
}
function Fp(n, a, r, i, s = 0, c = !0, f = !0, d = 0) {
  const m = i.cascade.sheet.depends(n), g = m.pos ? `${+c}${+f}${m.nth ? `:${d}` : ""}` : "", y = m.ancPos ? $b(n) : "";
  let v = i.cache.get(n);
  const b = v && v.version === n.version && v.parentValues === a?.values && v.inheritedText === r && v.pos === g && v.ancPos === y && (!m.anc || s <= v.at);
  if (b && v.node && v.stamp === n.stamp && !v.volatile && (!v.subAnc || s <= v.subAt)) {
    for (const z of v.log) i.add(...z);
    return v.node;
  }
  if (!b) {
    const z = Yb(n, a, r, i);
    v && mc(v.part.childText, z.childText) && (z.childText = v.part.childText), v = { version: n.version, parentValues: a?.values, inheritedText: r, pos: g, ancPos: y, at: i.now, part: z }, i.cache.set(n, v);
  }
  const S = i.log.length, E = { volatile: !!v.part.shift || m.ancPos, subAnc: m.anc }, j = Wb(n, v, i, Math.max(s, n.attrStamp), E);
  return Object.assign(v, { node: j, stamp: n.stamp, subAt: i.now, log: i.log.slice(S), volatile: E.volatile, subAnc: E.subAnc }), j;
}
function Wb(n, a, r, i, s) {
  const { computed: c, tokens: f, extra: d, reports: m, childText: g, where: y } = a.part;
  for (const k of m) r.add(...k);
  const v = (k, _, C, N, D) => r.add(k, _, C, N, y, D), b = { ...a.part.style };
  a.part.shift && qb(n, b, a.part.shift);
  const S = { kind: "div", id: n.id, style: b, tokens: f, meta: a.part.meta, ...d };
  Object.defineProperty(S, nn, { value: c.values.display }), n.measured && n.ownerDocument?.measureKey && (S.measure = n.ownerDocument.measureKey(n));
  const E = n.tagName;
  if (n.props["data-perch-engine"] != null)
    return S.kind = "engine", S.engine = String(n.props["data-perch-engine"]), S.key = String(n.props["data-perch-key"] ?? ""), S;
  if (E === "svg")
    return S.kind = n.props["data-perch-image"] ? "image" : "svg", S.markup = n1(n), S;
  if (E === "input" || E === "textarea" || E === "select") {
    S.kind = "input", S.input_type = E === "input" ? String(n.props.type ?? "text") : E;
    for (const C of ["placeholder", "checked", "disabled"]) n.props[C] !== void 0 && (S[C] = n.props[C]);
    if (/^(checkbox|radio)$/.test(S.input_type) && (S.checked = n.checked), E !== "select" && (S.value = n.value), E === "input" && Db.test(S.input_type) && (S.field_w = Bb * c.values["font-size"]), E === "textarea" && b.h === void 0) {
      const C = c.values, N = (W) => W && typeof W == "object" && "px" in W ? W.px : 0, D = (W) => C[`border-${W}-style`] === "none" ? 0 : N(C[`border-${W}-width`]), L = Number(n.props.rows) > 0 ? Math.floor(Number(n.props.rows)) : 2;
      b.h = L * Yl(C, r.measure) + N(C["padding-top"]) + N(C["padding-bottom"]) + D("top") + D("bottom");
    }
    const { before: k, after: _ } = Zb(n, c, g, r);
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
  const j = c.values["text-transform"], z = [];
  let R = !1, O = !1;
  const H = n.childNodes.reduce((k, _) => k + (_ instanceof Xe ? 1 : 0), 0);
  let X = 0;
  for (const k of n.childNodes) {
    if (k instanceof Oi) {
      if (k.hidden || k.data === "") continue;
      R = !0;
      const D = z[z.length - 1];
      if (D?.kind === "text")
        D.source = (D.source ?? D.text) + k.data, D.text = If(D.source, j), D.text === D.source && delete D.source;
      else {
        const L = If(k.data, j);
        z.push(L === k.data ? { kind: "text", text: L } : { kind: "text", text: L, source: k.data });
      }
      continue;
    }
    if (!(k instanceof Xe)) continue;
    const _ = Fp(k, c, g, r, i, X === 0, X === H - 1, X);
    X++;
    const C = r.cache.get(k);
    s.volatile ||= C.volatile, s.subAnc ||= C.subAnc;
    const N = _[nn];
    N === "inline" || N === "inline-block" || N === "inline-flex" ? R = !0 : N !== "none" && (O = !0), z.push(_);
  }
  if (/(^|\s)inline-flex(\s|$)/.test(String(n.props?.className ?? "")) && b.w === void 0) {
    for (let k = 0; k < z.length; k++)
      if (z[k].style?.flex_grow && z[k].style.min_w === 0 && z[k].style.overflow_x === "hidden") {
        const _ = ei(z, k);
        delete _.style.min_w, delete _.style.flex_grow, delete _.style.flex_basis, delete _.style.overflow_x, delete _.style.overflow_y;
      }
  }
  if (!b.display && R && z.some((k) => k.kind !== "text") && z.every((k) => k.kind === "text" || Jb(k))) {
    const k = z.map((_) => _.kind === "text" ? _.text : _.children.map((C) => C.text).join("")).join("");
    v("approximated", "display", "inline text elements in a line of text", "(inline formatting)", "their text joined to the line, in its font"), z.splice(0, z.length, { kind: "text", text: k });
  }
  const $ = z.some((k) => k.kind !== "text");
  let T = z.length === 1 && z[0].kind !== "text" && /^inline-(block|flex)$/.test(z[0][nn]) ? z[0] : null;
  if (!b.display && T) {
    T = ei(z, 0);
    const k = r.cache.get(n.childNodes.find((C) => C.id === T.id))?.part.computed, _ = k ? Ei(c.values, r.measure) - Pb(k.values, r.measure, T) : 0;
    b.display = "flex", b.flex_direction = "col", b.items = "start", _ > 0 && (T.style.mt = Math.round(((T.style.mt ?? 0) + _) * 100) / 100), v("approximated", "display", `${c.values.display} holding one ${T[nn]} box`, "(inline formatting)", "a column, the box lowered to the line's baseline");
  } else if (!b.display && z.length === 1 && (z[0].kind === "svg" || z[0].kind === "image") && z[0][nn] === "inline" && typeof z[0].style.h == "number") {
    const k = ei(z, 0), _ = Ei(c.values, r.measure), C = Yl(c.values, r.measure) - _, N = (D) => Math.round(D * 100) / 100;
    b.display = "flex", b.flex_direction = "col", b.items = "start", _ > k.style.h && (k.style.mt = N((k.style.mt ?? 0) + _ - k.style.h)), C > 0 && (k.style.mb = N((k.style.mb ?? 0) + C)), v("approximated", "display", `${c.values.display} holding one inline image`, "(inline formatting)", "a column, the image on the line's baseline");
  } else if (!b.display && R && $) {
    if (b.display = "flex", b.flex_direction = O ? "col" : "row", !O) b.items = "baseline";
    else for (let k = 0; k < z.length; k++) z[k].kind !== "text" && /^inline-(block|flex)$/.test(z[k][nn]) && !z[k].style.self && (ei(z, k).style.self = "start");
    v("approximated", "display", `${c.values.display} with inline content`, "(inline formatting)", O ? "a column of its children" : "a row on the text baseline");
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
      const N = c.values["font-size"], D = Math.max(0.8, 1 + h / (0.55 * N)), L = Math.round(Yl(c.values, r.measure) * 1e3) / 1e3;
      z[k] = { kind: "div", style: { text_size: Math.round(N * D * 1e3) / 1e3, line_height: `${L}px` }, tokens: {}, children: [_] };
    }
  return S.children = z, S;
}
function Fb(n, a) {
  if (!a) return null;
  let i = (a.self ? n : a.closest ? Op(n, a.closest) : a.find ? Vl(n, a.find)[0] : null)?.getAttribute(a.attr) ?? null;
  return i && a.strip && i.startsWith(a.strip) && (i = i.slice(a.strip.length)), i;
}
function Ib(n, a, r) {
  const i = a.map((f) => [f, ji(f.selector)]), s = /* @__PURE__ */ new Map(), c = (f) => {
    for (const d of f.children) {
      const m = r.get(d.id);
      if (m)
        for (const [g, y] of i) {
          const v = g.textRange ? "range_name" : "name";
          if (g.textRange && m[v] != null || !y.some((j) => Uo(d, j))) continue;
          const b = Fb(d, g.key), S = b == null ? s.get(g.name) ?? 0 : 0;
          b == null && s.set(g.name, S + 1);
          const E = b != null ? `${g.name}:${b}` : S ? `${g.name}@${S}` : g.name;
          m[v] == null ? m[v] = E : (m.also ??= []).push(E);
        }
      c(d);
    }
  };
  c(n.documentElement);
}
const Si = 0.9521, Ip = 0.2256, Ei = (n, a) => (Yl(n, a) - (Si + Ip) * n["font-size"]) / 2 + Si * n["font-size"];
function Pb(n, a, r) {
  const i = (m) => m && typeof m == "object" && "px" in m ? m.px : 0, s = n["border-top-style"] === "none" ? 0 : i(n["border-top-width"]), c = r?.children ?? [], f = c.length === 1 && (c[0].kind === "svg" || c[0].kind === "image") && typeof c[0].style.h == "number" ? c[0] : null, d = f ? Math.max(Ei(n, a), (f.style.mt ?? 0) + f.style.h) : Ei(n, a);
  return i(n["padding-top"]) + s + d;
}
const If = (n, a) => a === "uppercase" ? n.toUpperCase() : a === "lowercase" ? n.toLowerCase() : a === "capitalize" ? n.replace(/\b\p{L}/gu, (r) => r.toUpperCase()) : n, Pp = /* @__PURE__ */ new Set(["children", "style", "className", "key", "ref", "dangerouslySetInnerHTML"]);
function e1(n) {
  const a = {};
  for (const [r, i] of Object.entries(n.props)) {
    if (Pp.has(r) || typeof i == "function" || i === void 0 || i === null || typeof i == "object") continue;
    const s = r.startsWith("aria-") || r.startsWith("data-");
    if (i === !1 && !s) continue;
    const c = r === "htmlFor" ? "for" : r === "tabIndex" ? "tabindex" : r;
    a[c] = typeof i == "boolean" ? s ? String(i) : "" : String(i);
  }
  return { tag: n.tagName, classes: n.classList, attrs: a };
}
const t1 = (n) => n === "className" ? "class" : /^(viewBox|preserveAspectRatio|gradientUnits|gradientTransform|patternUnits|xmlns)$/.test(n) ? n : n.replace(/[A-Z]/g, (a) => `-${a.toLowerCase()}`), Pf = (n) => String(n).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
function n1(n) {
  if (n.props["data-perch-markup"]) return String(n.props["data-perch-markup"]);
  const a = (r) => {
    const i = [];
    for (const [c, f] of Object.entries(r.props))
      Pp.has(c) || typeof f == "function" || f === void 0 || f === null || f === !1 || typeof f == "object" || c.startsWith("data-") || c.startsWith("aria-") || c === "focusable" || c === "role" || c === "title" || i.push(`${t1(c)}="${Pf(f === !0 ? "" : f)}"`);
    r.tagName === "svg" && !r.props.xmlns && i.unshift('xmlns="http://www.w3.org/2000/svg"');
    const s = r.childNodes.map((c) => c instanceof Oi ? Pf(c.data) : a(c)).join("");
    return `<${r.tagName}${i.length ? ` ${i.join(" ")}` : ""}>${s}</${r.tagName}>`;
  };
  return a(n);
}
function a1(n) {
  const a = n.theme?.() ?? {}, r = {};
  for (const i of Gp) a[i] && (r[i] = a[i]);
  return r;
}
const l1 = { font_features: "" };
function r1(n, a, r, i = {}, s = null) {
  const c = a1(a), f = a.viewport?.() ?? { width: 1e3, height: 800 }, d = JSON.stringify([c, f]);
  (i.look !== d || i.sheet !== r) && Object.assign(i, { look: d, sheet: r, cache: /* @__PURE__ */ new WeakMap(), cascade: new _b(r, { theme: c, viewport: f }), top: null });
  const { cascade: m, cache: g } = i, y = new Ob(), v = [], S = { cascade: m, cache: g, viewport: f, findings: y, log: v, add: (...R) => {
    v.push(R), y.add(...R);
  }, now: Lo(), measure: a.lineHeight ? (R) => a.lineHeight(R) : null };
  i.top ??= m.compute(n.body, m.compute(n.documentElement, null));
  const E = n.body.children, j = E.map((R, O) => Fp(R, i.top, l1, S, 0, O === 0, O === E.length - 1, O));
  if (s?.length) {
    const R = /* @__PURE__ */ new Map(), O = (H) => {
      H.id && (R.set(H.id, H), delete H.name, delete H.range_name, delete H.also);
      for (const X of H.children ?? []) O(X);
    };
    j.forEach(O), Ib(n, s, R);
  }
  const z = /* @__PURE__ */ new Set();
  for (const R of [n, n.defaultView])
    for (const { type: O } of R?.listeners ?? []) Zf[O] && z.add(Zf[O]);
  return { schema: Nb, root: j[0] ?? null, overlays: j.slice(1), document_events: [...z].sort(), unsupported: S.findings.list() };
}
const Ia = { layers: ["properties", "theme", "base", "utilities"], properties: { "--tw-translate-x": { inherits: !1, initial: "0" }, "--tw-translate-y": { inherits: !1, initial: "0" }, "--tw-translate-z": { inherits: !1, initial: "0" }, "--tw-rotate-x": { inherits: !1, initial: null }, "--tw-rotate-y": { inherits: !1, initial: null }, "--tw-rotate-z": { inherits: !1, initial: null }, "--tw-skew-x": { inherits: !1, initial: null }, "--tw-skew-y": { inherits: !1, initial: null }, "--tw-space-y-reverse": { inherits: !1, initial: "0" }, "--tw-border-style": { inherits: !1, initial: "solid" }, "--tw-leading": { inherits: !1, initial: null }, "--tw-font-weight": { inherits: !1, initial: null }, "--tw-tracking": { inherits: !1, initial: null }, "--tw-ordinal": { inherits: !1, initial: null }, "--tw-slashed-zero": { inherits: !1, initial: null }, "--tw-numeric-figure": { inherits: !1, initial: null }, "--tw-numeric-spacing": { inherits: !1, initial: null }, "--tw-numeric-fraction": { inherits: !1, initial: null }, "--tw-shadow": { inherits: !1, initial: "0 0 #0000" }, "--tw-shadow-color": { inherits: !1, initial: null }, "--tw-shadow-alpha": { inherits: !1, initial: "100%" }, "--tw-inset-shadow": { inherits: !1, initial: "0 0 #0000" }, "--tw-inset-shadow-color": { inherits: !1, initial: null }, "--tw-inset-shadow-alpha": { inherits: !1, initial: "100%" }, "--tw-ring-color": { inherits: !1, initial: null }, "--tw-ring-shadow": { inherits: !1, initial: "0 0 #0000" }, "--tw-inset-ring-color": { inherits: !1, initial: null }, "--tw-inset-ring-shadow": { inherits: !1, initial: "0 0 #0000" }, "--tw-ring-inset": { inherits: !1, initial: null }, "--tw-ring-offset-width": { inherits: !1, initial: "0" }, "--tw-ring-offset-color": { inherits: !1, initial: "#fff" }, "--tw-ring-offset-shadow": { inherits: !1, initial: "0 0 #0000" }, "--tw-outline-style": { inherits: !1, initial: "solid" }, "--tw-blur": { inherits: !1, initial: null }, "--tw-brightness": { inherits: !1, initial: null }, "--tw-contrast": { inherits: !1, initial: null }, "--tw-grayscale": { inherits: !1, initial: null }, "--tw-hue-rotate": { inherits: !1, initial: null }, "--tw-invert": { inherits: !1, initial: null }, "--tw-opacity": { inherits: !1, initial: null }, "--tw-saturate": { inherits: !1, initial: null }, "--tw-sepia": { inherits: !1, initial: null }, "--tw-drop-shadow": { inherits: !1, initial: null }, "--tw-drop-shadow-color": { inherits: !1, initial: null }, "--tw-drop-shadow-alpha": { inherits: !1, initial: "100%" }, "--tw-drop-shadow-size": { inherits: !1, initial: null }, "--tw-backdrop-blur": { inherits: !1, initial: null }, "--tw-backdrop-brightness": { inherits: !1, initial: null }, "--tw-backdrop-contrast": { inherits: !1, initial: null }, "--tw-backdrop-grayscale": { inherits: !1, initial: null }, "--tw-backdrop-hue-rotate": { inherits: !1, initial: null }, "--tw-backdrop-invert": { inherits: !1, initial: null }, "--tw-backdrop-opacity": { inherits: !1, initial: null }, "--tw-backdrop-saturate": { inherits: !1, initial: null }, "--tw-backdrop-sepia": { inherits: !1, initial: null }, "--tw-duration": { inherits: !1, initial: null }, "--tw-ease": { inherits: !1, initial: null }, "--tw-content": { inherits: !1, initial: '""' } }, rules: [[":root, :host", null, 2, [["--spacing", ".25rem"], ["--text-xs", ".75rem"], ["--text-xs--line-height", "calc(1 / .75)"], ["--text-sm", ".875rem"], ["--text-sm--line-height", "calc(1.25 / .875)"], ["--font-weight-normal", "400"], ["--font-weight-medium", "500"], ["--font-weight-semibold", "600"], ["--font-weight-bold", "700"], ["--tracking-normal", "0em"], ["--tracking-wide", ".025em"], ["--leading-tight", "1.25"], ["--leading-relaxed", "1.625"], ["--ease-out", "cubic-bezier(0, 0, .2, 1)"], ["--animate-pulse", "pulse 2s cubic-bezier(.4, 0, .6, 1) infinite"], ["--blur-xl", "24px"], ["--default-transition-duration", ".15s"], ["--default-transition-timing-function", "cubic-bezier(.4, 0, .2, 1)"], ["--animate-toast-in", "toast-in .2s cubic-bezier(.22, 1, .36, 1)"], ["--animate-host-pulse", "host-connecting-pulse 1.4s ease-in-out infinite"], ["--animate-drop-zone", "drop-zone-in .14s ease-out, drop-zone-pulse 1.2s ease-in-out .14s infinite"]]], ["::selection", null, 3, [["background", "var(--accent)"], ["color", "var(--panel-bg)"]]], [":where(input, textarea)::placeholder", null, 3, [["color", "var(--subtext-0)"], ["opacity", "1"]]], [":where(button, input, select, textarea)", null, 3, [["border", "0"]]], [':where(button, a[href], select, summary, [role="button"], [role="menuitem"]):focus-visible', null, 3, [["outline", "2px solid var(--accent)"], ["outline-offset", "-2px"]]], ["::-webkit-scrollbar", null, 3, [["width", "var(--scrollbar-size)"], ["height", "var(--scrollbar-size)"]]], ["::-webkit-scrollbar-track", null, 3, [["background", "none"]]], ["::-webkit-scrollbar-corner", null, 3, [["background", "none"]]], ["::-webkit-scrollbar-thumb", null, 3, [["background", "var(--text)"]]], ["::-webkit-scrollbar-thumb", null, 3, [["background", "color-mix(in srgb, var(--text) 20%, transparent)"]]], ["::-webkit-scrollbar-thumb", null, 3, [["border-radius", "var(--scrollbar-size)"]]], ["::-webkit-scrollbar-thumb:hover", null, 3, [["background", "var(--text)"]]], ["::-webkit-scrollbar-thumb:hover", null, 3, [["background", "color-mix(in srgb, var(--text) 40%, transparent)"]]], [".xterm .xterm-scrollable-element > .xterm-scrollbar > .xterm-slider", null, 3, [["border-radius", "var(--scrollbar-size)"]]], [".\\@container, .\\[container-type\\:inline-size\\]", null, 4, [["container-type", "inline-size"]]], [".pointer-events-auto", null, 4, [["pointer-events", "auto"]]], [".pointer-events-none", null, 4, [["pointer-events", "none"]]], [".collapse", null, 4, [["visibility", "collapse"]]], [".invisible", null, 4, [["visibility", "hidden"]]], [".visible", null, 4, [["visibility", "visible"]]], [".sr-only", null, 4, [["clip-path", "inset(50%)"], ["white-space", "nowrap"], ["border-width", "0"], ["width", "1px"], ["height", "1px"], ["margin", "-1px"], ["padding", "0"], ["position", "absolute"], ["overflow", "hidden"]]], [".absolute", null, 4, [["position", "absolute"]]], [".fixed", null, 4, [["position", "fixed"]]], [".relative", null, 4, [["position", "relative"]]], [".static", null, 4, [["position", "static"]]], [".sticky", null, 4, [["position", "sticky"]]], [".inset-0", null, 4, [["inset", "0"]]], [".inset-x-0", null, 4, [["inset-inline", "0"]]], [".inset-x-2", null, 4, [["inset-inline", "calc(var(--spacing) * 2)"]]], [".-top-1", null, 4, [["top", "calc(var(--spacing) * -1)"]]], [".-top-1\\.5", null, 4, [["top", "calc(var(--spacing) * -1.5)"]]], [".top-0", null, 4, [["top", "0"]]], [".top-1", null, 4, [["top", "var(--spacing)"]]], [".top-1\\.5", null, 4, [["top", "calc(var(--spacing) * 1.5)"]]], [".top-1\\/2", null, 4, [["top", "50%"]]], [".top-2", null, 4, [["top", "calc(var(--spacing) * 2)"]]], [".top-4", null, 4, [["top", "calc(var(--spacing) * 4)"]]], [".top-\\[0\\.1rem\\]", null, 4, [["top", ".1rem"]]], [".top-\\[7px\\]", null, 4, [["top", "7px"]]], [".top-\\[max\\(0\\.75rem\\,env\\(safe-area-inset-top\\)\\)\\]", null, 4, [["top", "max(.75rem, env(safe-area-inset-top))"]]], [".top-full", null, 4, [["top", "100%"]]], [".top-px", null, 4, [["top", "1px"]]], [".-right-1", null, 4, [["right", "calc(var(--spacing) * -1)"]]], [".-right-1\\.5", null, 4, [["right", "calc(var(--spacing) * -1.5)"]]], [".right-0", null, 4, [["right", "0"]]], [".right-1", null, 4, [["right", "var(--spacing)"]]], [".right-3", null, 4, [["right", "calc(var(--spacing) * 3)"]]], [".right-4", null, 4, [["right", "calc(var(--spacing) * 4)"]]], [".right-\\[0\\.8rem\\]", null, 4, [["right", ".8rem"]]], [".right-\\[0\\.25rem\\]", null, 4, [["right", ".25rem"]]], [".right-\\[max\\(0\\.75rem\\,env\\(safe-area-inset-right\\)\\)\\]", null, 4, [["right", "max(.75rem, env(safe-area-inset-right))"]]], [".right-full", null, 4, [["right", "100%"]]], [".bottom-0", null, 4, [["bottom", "0"]]], [".bottom-2", null, 4, [["bottom", "calc(var(--spacing) * 2)"]]], [".bottom-3", null, 4, [["bottom", "calc(var(--spacing) * 3)"]]], [".bottom-\\[0\\.8rem\\]", null, 4, [["bottom", ".8rem"]]], [".bottom-full", null, 4, [["bottom", "100%"]]], [".-left-8", null, 4, [["left", "calc(var(--spacing) * -8)"]]], [".-left-\\[2px\\]", null, 4, [["left", "-2px"]]], [".left-0", null, 4, [["left", "0"]]], [".left-2", null, 4, [["left", "calc(var(--spacing) * 2)"]]], [".left-\\[0\\.1rem\\]", null, 4, [["left", ".1rem"]]], [".left-\\[max\\(0\\.75rem\\,env\\(safe-area-inset-left\\)\\)\\]", null, 4, [["left", "max(.75rem, env(safe-area-inset-left))"]]], [".left-full", null, 4, [["left", "100%"]]], [".left-px", null, 4, [["left", "1px"]]], [".isolate", null, 4, [["isolation", "isolate"]]], [".z-4", null, 4, [["z-index", "4"]]], [".z-5", null, 4, [["z-index", "5"]]], [".z-10", null, 4, [["z-index", "10"]]], [".z-20", null, 4, [["z-index", "20"]]], [".z-30", null, 4, [["z-index", "30"]]], [".z-40", null, 4, [["z-index", "40"]]], [".z-50", null, 4, [["z-index", "50"]]], [".z-\\[2\\]", null, 4, [["z-index", "2"]]], [".z-\\[3\\]", null, 4, [["z-index", "3"]]], [".z-\\[5\\]", null, 4, [["z-index", "5"]]], [".z-\\[1000\\]", null, 4, [["z-index", "1000"]]], [".z-\\[2000\\]", null, 4, [["z-index", "2000"]]], [".z-\\[2100\\]", null, 4, [["z-index", "2100"]]], [".z-\\[2200\\]", null, 4, [["z-index", "2200"]]], [".z-\\[3000\\]", null, 4, [["z-index", "3000"]]], [".z-\\[3100\\]", null, 4, [["z-index", "3100"]]], [".z-\\[4000\\]", null, 4, [["z-index", "4000"]]], [".z-\\[9998\\]", null, 4, [["z-index", "9998"]]], [".z-\\[9999\\]", null, 4, [["z-index", "9999"]]], [".z-\\[10000\\]", null, 4, [["z-index", "10000"]]], [".z-auto", null, 4, [["z-index", "auto"]]], [".order-last", null, 4, [["order", "9999"]]], [".col-\\[1\\/-1\\]", null, 4, [["grid-column", "1 / -1"]]], [".container", null, 4, [["width", "100%"]]], [".container", ["(min-width: 40rem)"], 4, [["max-width", "40rem"]]], [".container", ["(min-width: 48rem)"], 4, [["max-width", "48rem"]]], [".container", ["(min-width: 64rem)"], 4, [["max-width", "64rem"]]], [".container", ["(min-width: 80rem)"], 4, [["max-width", "80rem"]]], [".container", ["(min-width: 96rem)"], 4, [["max-width", "96rem"]]], [".m-0", null, 4, [["margin", "0"]]], [".m-2", null, 4, [["margin", "calc(var(--spacing) * 2)"]]], [".m-\\[0\\.7rem\\]", null, 4, [["margin", ".7rem"]]], [".m-auto", null, 4, [["margin", "auto"]]], [".mx-0", null, 4, [["margin-inline", "0"]]], [".mx-0\\.5", null, 4, [["margin-inline", "calc(var(--spacing) * .5)"]]], [".mx-2", null, 4, [["margin-inline", "calc(var(--spacing) * 2)"]]], [".mx-3", null, 4, [["margin-inline", "calc(var(--spacing) * 3)"]]], [".mx-4", null, 4, [["margin-inline", "calc(var(--spacing) * 4)"]]], [".mx-\\[0\\.3rem\\]", null, 4, [["margin-inline", ".3rem"]]], [".mx-\\[0\\.7rem\\]", null, 4, [["margin-inline", ".7rem"]]], [".mx-\\[0\\.65rem\\]", null, 4, [["margin-inline", ".65rem"]]], [".mx-\\[3px\\]", null, 4, [["margin-inline", "3px"]]], [".mx-\\[11px\\]", null, 4, [["margin-inline", "11px"]]], [".mx-auto", null, 4, [["margin-inline", "auto"]]], [".my-0\\.5", null, 4, [["margin-block", "calc(var(--spacing) * .5)"]]], [".my-1", null, 4, [["margin-block", "var(--spacing)"]]], [".my-2", null, 4, [["margin-block", "calc(var(--spacing) * 2)"]]], [".my-\\[0\\.2rem\\]", null, 4, [["margin-block", ".2rem"]]], [".my-\\[0\\.3rem\\]", null, 4, [["margin-block", ".3rem"]]], [".my-\\[0\\.6rem\\]", null, 4, [["margin-block", ".6rem"]]], [".my-\\[0\\.28rem\\]", null, 4, [["margin-block", ".28rem"]]], [".my-\\[0\\.45rem\\]", null, 4, [["margin-block", ".45rem"]]], [".my-\\[0\\.55rem\\]", null, 4, [["margin-block", ".55rem"]]], [".my-\\[3px\\]", null, 4, [["margin-block", "3px"]]], [".-mt-\\[2px\\]", null, 4, [["margin-top", "-2px"]]], [".mt-0", null, 4, [["margin-top", "0"]]], [".mt-0\\.5", null, 4, [["margin-top", "calc(var(--spacing) * .5)"]]], [".mt-1", null, 4, [["margin-top", "var(--spacing)"]]], [".mt-1\\.5", null, 4, [["margin-top", "calc(var(--spacing) * 1.5)"]]], [".mt-2", null, 4, [["margin-top", "calc(var(--spacing) * 2)"]]], [".mt-3", null, 4, [["margin-top", "calc(var(--spacing) * 3)"]]], [".mt-4", null, 4, [["margin-top", "calc(var(--spacing) * 4)"]]], [".mt-\\[0\\.1rem\\]", null, 4, [["margin-top", ".1rem"]]], [".mt-\\[0\\.2rem\\]", null, 4, [["margin-top", ".2rem"]]], [".mt-\\[0\\.3rem\\]", null, 4, [["margin-top", ".3rem"]]], [".mt-\\[0\\.4rem\\]", null, 4, [["margin-top", ".4rem"]]], [".mt-\\[0\\.5rem\\]", null, 4, [["margin-top", ".5rem"]]], [".mt-\\[0\\.15rem\\]", null, 4, [["margin-top", ".15rem"]]], [".mt-\\[0\\.35rem\\]", null, 4, [["margin-top", ".35rem"]]], [".mr-1", null, 4, [["margin-right", "var(--spacing)"]]], [".mr-1\\.5", null, 4, [["margin-right", "calc(var(--spacing) * 1.5)"]]], [".mr-\\[0\\.3rem\\]", null, 4, [["margin-right", ".3rem"]]], [".mr-\\[0\\.7rem\\]", null, 4, [["margin-right", ".7rem"]]], [".mr-auto", null, 4, [["margin-right", "auto"]]], [".mb-0", null, 4, [["margin-bottom", "0"]]], [".mb-0\\.5", null, 4, [["margin-bottom", "calc(var(--spacing) * .5)"]]], [".mb-1", null, 4, [["margin-bottom", "var(--spacing)"]]], [".mb-2", null, 4, [["margin-bottom", "calc(var(--spacing) * 2)"]]], [".mb-3", null, 4, [["margin-bottom", "calc(var(--spacing) * 3)"]]], [".mb-4", null, 4, [["margin-bottom", "calc(var(--spacing) * 4)"]]], [".mb-8", null, 4, [["margin-bottom", "calc(var(--spacing) * 8)"]]], [".mb-\\[0\\.2rem\\]", null, 4, [["margin-bottom", ".2rem"]]], [".mb-\\[0\\.3rem\\]", null, 4, [["margin-bottom", ".3rem"]]], [".mb-\\[0\\.4rem\\]", null, 4, [["margin-bottom", ".4rem"]]], [".mb-\\[0\\.6rem\\]", null, 4, [["margin-bottom", ".6rem"]]], [".mb-\\[0\\.7rem\\]", null, 4, [["margin-bottom", ".7rem"]]], [".mb-\\[0\\.9rem\\]", null, 4, [["margin-bottom", ".9rem"]]], [".mb-\\[0\\.15rem\\]", null, 4, [["margin-bottom", ".15rem"]]], [".mb-\\[0\\.35rem\\]", null, 4, [["margin-bottom", ".35rem"]]], [".mb-\\[0\\.55rem\\]", null, 4, [["margin-bottom", ".55rem"]]], [".mb-\\[1\\.1rem\\]", null, 4, [["margin-bottom", "1.1rem"]]], [".-ml-0\\.5", null, 4, [["margin-left", "calc(var(--spacing) * -.5)"]]], [".-ml-1", null, 4, [["margin-left", "calc(var(--spacing) * -1)"]]], [".-ml-2", null, 4, [["margin-left", "calc(var(--spacing) * -2)"]]], [".ml-1", null, 4, [["margin-left", "var(--spacing)"]]], [".ml-2", null, 4, [["margin-left", "calc(var(--spacing) * 2)"]]], [".ml-\\[0\\.4rem\\]", null, 4, [["margin-left", ".4rem"]]], [".ml-\\[0\\.5rem\\]", null, 4, [["margin-left", ".5rem"]]], [".ml-\\[0\\.9rem\\]", null, 4, [["margin-left", ".9rem"]]], [".ml-\\[0\\.35rem\\]", null, 4, [["margin-left", ".35rem"]]], [".ml-\\[0\\.55rem\\]", null, 4, [["margin-left", ".55rem"]]], [".ml-\\[1\\.15rem\\]", null, 4, [["margin-left", "1.15rem"]]], [".ml-\\[1\\.45rem\\]", null, 4, [["margin-left", "1.45rem"]]], [".ml-\\[2\\.025rem\\]", null, 4, [["margin-left", "2.025rem"]]], [".ml-\\[2\\.375rem\\]", null, 4, [["margin-left", "2.375rem"]]], [".ml-\\[6\\.1rem\\]", null, 4, [["margin-left", "6.1rem"]]], [".ml-auto", null, 4, [["margin-left", "auto"]]], [".box-border", null, 4, [["box-sizing", "border-box"]]], [".\\!hidden", null, 4, [["display", "none", 1]]], [".\\[display\\:-webkit-box\\]", null, 4, [["display", "-webkit-box"]]], [".\\[display\\:var\\(--pane-grip\\,flex\\)\\]", null, 4, [["display", "var(--pane-grip, flex)"]]], [".block", null, 4, [["display", "block"]]], [".contents", null, 4, [["display", "contents"]]], [".flex", null, 4, [["display", "flex"]]], [".grid", null, 4, [["display", "grid"]]], [".hidden", null, 4, [["display", "none"]]], [".inline", null, 4, [["display", "inline"]]], [".inline-block", null, 4, [["display", "inline-block"]]], [".inline-flex", null, 4, [["display", "inline-flex"]]], [".table", null, 4, [["display", "table"]]], [".size-1", null, 4, [["width", "var(--spacing)"], ["height", "var(--spacing)"]]], [".size-1\\.5", null, 4, [["width", "calc(var(--spacing) * 1.5)"], ["height", "calc(var(--spacing) * 1.5)"]]], [".size-2", null, 4, [["width", "calc(var(--spacing) * 2)"], ["height", "calc(var(--spacing) * 2)"]]], [".size-3", null, 4, [["width", "calc(var(--spacing) * 3)"], ["height", "calc(var(--spacing) * 3)"]]], [".size-5", null, 4, [["width", "calc(var(--spacing) * 5)"], ["height", "calc(var(--spacing) * 5)"]]], [".size-6", null, 4, [["width", "calc(var(--spacing) * 6)"], ["height", "calc(var(--spacing) * 6)"]]], [".size-7", null, 4, [["width", "calc(var(--spacing) * 7)"], ["height", "calc(var(--spacing) * 7)"]]], [".size-8", null, 4, [["width", "calc(var(--spacing) * 8)"], ["height", "calc(var(--spacing) * 8)"]]], [".size-11", null, 4, [["width", "calc(var(--spacing) * 11)"], ["height", "calc(var(--spacing) * 11)"]]], [".size-14", null, 4, [["width", "calc(var(--spacing) * 14)"], ["height", "calc(var(--spacing) * 14)"]]], [".size-\\[0\\.6rem\\]", null, 4, [["width", ".6rem"], ["height", ".6rem"]]], [".size-\\[1\\.2rem\\]", null, 4, [["width", "1.2rem"], ["height", "1.2rem"]]], [".size-\\[5px\\]", null, 4, [["width", "5px"], ["height", "5px"]]], [".size-\\[14px\\]", null, 4, [["width", "14px"], ["height", "14px"]]], [".size-\\[calc\\(14px\\*var\\(--zoom\\,1\\)\\)\\]", null, 4, [["width", "calc(14px * var(--zoom, 1))"], ["height", "calc(14px * var(--zoom, 1))"]]], [".size-full", null, 4, [["width", "100%"], ["height", "100%"]]], [".h-1", null, 4, [["height", "var(--spacing)"]]], [".h-1\\.5", null, 4, [["height", "calc(var(--spacing) * 1.5)"]]], [".h-2", null, 4, [["height", "calc(var(--spacing) * 2)"]]], [".h-3", null, 4, [["height", "calc(var(--spacing) * 3)"]]], [".h-4", null, 4, [["height", "calc(var(--spacing) * 4)"]]], [".h-5", null, 4, [["height", "calc(var(--spacing) * 5)"]]], [".h-6", null, 4, [["height", "calc(var(--spacing) * 6)"]]], [".h-7", null, 4, [["height", "calc(var(--spacing) * 7)"]]], [".h-8", null, 4, [["height", "calc(var(--spacing) * 8)"]]], [".h-9", null, 4, [["height", "calc(var(--spacing) * 9)"]]], [".h-11", null, 4, [["height", "calc(var(--spacing) * 11)"]]], [".h-12", null, 4, [["height", "calc(var(--spacing) * 12)"]]], [".h-44", null, 4, [["height", "calc(var(--spacing) * 44)"]]], [".h-\\[1\\.1rem\\]", null, 4, [["height", "1.1rem"]]], [".h-\\[1\\.3rem\\]", null, 4, [["height", "1.3rem"]]], [".h-\\[1\\.4rem\\]", null, 4, [["height", "1.4rem"]]], [".h-\\[1\\.25rem\\]", null, 4, [["height", "1.25rem"]]], [".h-\\[2px\\]", null, 4, [["height", "2px"]]], [".h-\\[14px\\]", null, 4, [["height", "14px"]]], [".h-\\[18px\\]", null, 4, [["height", "18px"]]], [".h-\\[43px\\]", null, 4, [["height", "43px"]]], [".h-\\[calc\\(100\\%-max\\(0\\.5rem\\,env\\(safe-area-inset-top\\)\\)\\)\\]", null, 4, [["height", "calc(100% - max(.5rem, env(safe-area-inset-top)))"]]], [".h-full", null, 4, [["height", "100%"]]], [".h-px", null, 4, [["height", "1px"]]], [".max-h-40", null, 4, [["max-height", "calc(var(--spacing) * 40)"]]], [".max-h-56", null, 4, [["max-height", "calc(var(--spacing) * 56)"]]], [".max-h-72", null, 4, [["max-height", "calc(var(--spacing) * 72)"]]], [".max-h-\\[8rem\\]", null, 4, [["max-height", "8rem"]]], [".max-h-\\[13rem\\]", null, 4, [["max-height", "13rem"]]], [".max-h-\\[30\\%\\]", null, 4, [["max-height", "30%"]]], [".max-h-\\[30vh\\]", null, 4, [["max-height", "30vh"]]], [".max-h-\\[35vh\\]", null, 4, [["max-height", "35vh"]]], [".max-h-\\[40\\%\\]", null, 4, [["max-height", "40%"]]], [".max-h-\\[50dvh\\]", null, 4, [["max-height", "50dvh"]]], [".max-h-\\[60\\%\\]", null, 4, [["max-height", "60%"]]], [".max-h-\\[70\\%\\]", null, 4, [["max-height", "70%"]]], [".max-h-\\[85vh\\]", null, 4, [["max-height", "85vh"]]], [".max-h-\\[90\\%\\]", null, 4, [["max-height", "90%"]]], [".max-h-\\[190px\\]", null, 4, [["max-height", "190px"]]], [".max-h-\\[240px\\]", null, 4, [["max-height", "240px"]]], [".max-h-\\[260px\\]", null, 4, [["max-height", "260px"]]], [".max-h-\\[calc\\(85vh-4rem\\)\\]", null, 4, [["max-height", "calc(85vh - 4rem)"]]], [".max-h-\\[calc\\(100dvh_-_4rem\\)\\]", null, 4, [["max-height", "calc(100dvh - 4rem)"]]], [".max-h-\\[min\\(420px\\,calc\\(100dvh_-_16vh_-_2rem\\)\\)\\]", null, 4, [["max-height", "min(420px, 100dvh - 16vh - 2rem)"]]], [".max-h-\\[min\\(480px\\,calc\\(100dvh_-_16vh_-_2rem\\)\\)\\]", null, 4, [["max-height", "min(480px, 100dvh - 16vh - 2rem)"]]], [".max-h-full", null, 4, [["max-height", "100%"]]], [".min-h-0", null, 4, [["min-height", "0"]]], [".min-h-6", null, 4, [["min-height", "calc(var(--spacing) * 6)"]]], [".min-h-7", null, 4, [["min-height", "calc(var(--spacing) * 7)"]]], [".min-h-8", null, 4, [["min-height", "calc(var(--spacing) * 8)"]]], [".min-h-9", null, 4, [["min-height", "calc(var(--spacing) * 9)"]]], [".min-h-10", null, 4, [["min-height", "calc(var(--spacing) * 10)"]]], [".min-h-11", null, 4, [["min-height", "calc(var(--spacing) * 11)"]]], [".min-h-20", null, 4, [["min-height", "calc(var(--spacing) * 20)"]]], [".min-h-40", null, 4, [["min-height", "calc(var(--spacing) * 40)"]]], [".min-h-\\[1\\.5em\\]", null, 4, [["min-height", "1.5em"]]], [".min-h-\\[1\\.8rem\\]", null, 4, [["min-height", "1.8rem"]]], [".min-h-\\[2\\.5rem\\]", null, 4, [["min-height", "2.5rem"]]], [".min-h-\\[3\\.2rem\\]", null, 4, [["min-height", "3.2rem"]]], [".min-h-\\[3\\.25rem\\]", null, 4, [["min-height", "3.25rem"]]], [".min-h-\\[6rem\\]", null, 4, [["min-height", "6rem"]]], [".min-h-\\[8rem\\]", null, 4, [["min-height", "8rem"]]], [".min-h-\\[10rem\\]", null, 4, [["min-height", "10rem"]]], [".min-h-\\[12rem\\]", null, 4, [["min-height", "12rem"]]], [".min-h-\\[13rem\\]", null, 4, [["min-height", "13rem"]]], [".min-h-\\[32px\\]", null, 4, [["min-height", "32px"]]], [".min-h-\\[44px\\]", null, 4, [["min-height", "44px"]]], [".min-h-\\[60px\\]", null, 4, [["min-height", "60px"]]], [".min-h-\\[100dvh\\]", null, 4, [["min-height", "100dvh"]]], [".min-h-\\[calc\\(22px\\*var\\(--zoom\\,1\\)\\)\\]", null, 4, [["min-height", "calc(22px * var(--zoom, 1))"]]], [".min-h-full", null, 4, [["min-height", "100%"]]], [".w-2", null, 4, [["width", "calc(var(--spacing) * 2)"]]], [".w-2\\.5", null, 4, [["width", "calc(var(--spacing) * 2.5)"]]], [".w-3", null, 4, [["width", "calc(var(--spacing) * 3)"]]], [".w-4", null, 4, [["width", "calc(var(--spacing) * 4)"]]], [".w-5", null, 4, [["width", "calc(var(--spacing) * 5)"]]], [".w-7", null, 4, [["width", "calc(var(--spacing) * 7)"]]], [".w-8", null, 4, [["width", "calc(var(--spacing) * 8)"]]], [".w-9", null, 4, [["width", "calc(var(--spacing) * 9)"]]], [".w-10", null, 4, [["width", "calc(var(--spacing) * 10)"]]], [".w-20", null, 4, [["width", "calc(var(--spacing) * 20)"]]], [".w-40", null, 4, [["width", "calc(var(--spacing) * 40)"]]], [".w-44", null, 4, [["width", "calc(var(--spacing) * 44)"]]], [".w-60", null, 4, [["width", "calc(var(--spacing) * 60)"]]], [".w-\\[1\\.1rem\\]", null, 4, [["width", "1.1rem"]]], [".w-\\[1\\.4rem\\]", null, 4, [["width", "1.4rem"]]], [".w-\\[1\\.6rem\\]", null, 4, [["width", "1.6rem"]]], [".w-\\[1\\.25rem\\]", null, 4, [["width", "1.25rem"]]], [".w-\\[2\\.4rem\\]", null, 4, [["width", "2.4rem"]]], [".w-\\[2\\.25rem\\]", null, 4, [["width", "2.25rem"]]], [".w-\\[6rem\\]", null, 4, [["width", "6rem"]]], [".w-\\[7rem\\]", null, 4, [["width", "7rem"]]], [".w-\\[11rem\\]", null, 4, [["width", "11rem"]]], [".w-\\[15rem\\]", null, 4, [["width", "15rem"]]], [".w-\\[16rem\\]", null, 4, [["width", "16rem"]]], [".w-\\[18px\\]", null, 4, [["width", "18px"]]], [".w-\\[100cqi\\]", null, 4, [["width", "100cqi"]]], [".w-\\[calc\\(\\(100\\%-0\\.875rem\\)\\/8\\)\\]", null, 4, [["width", "calc(12.5% - .109375rem)"]]], [".w-\\[calc\\(100\\%_-_0\\.6rem\\)\\]", null, 4, [["width", "calc(100% - .6rem)"]]], [".w-\\[calc\\(100\\%_-_1rem\\)\\]", null, 4, [["width", "calc(100% - 1rem)"]]], [".w-\\[min\\(22rem\\,calc\\(100vw-3rem\\)\\)\\]", null, 4, [["width", "min(22rem, 100vw - 3rem)"]]], [".w-\\[min\\(26rem\\,100\\%\\)\\]", null, 4, [["width", "min(26rem, 100%)"]]], [".w-\\[min\\(28rem\\,calc\\(100vw-2\\.5rem\\)\\)\\]", null, 4, [["width", "min(28rem, 100vw - 2.5rem)"]]], [".w-\\[min\\(30rem\\,92vw\\)\\]", null, 4, [["width", "min(30rem, 92vw)"]]], [".w-\\[min\\(32rem\\,100\\%\\)\\]", null, 4, [["width", "min(32rem, 100%)"]]], [".w-\\[min\\(340px\\,calc\\(100vw-16px\\)\\)\\]", null, 4, [["width", "min(340px, 100vw - 16px)"]]], [".w-\\[min\\(360px\\,calc\\(100vw_-_2rem\\)\\)\\]", null, 4, [["width", "min(360px, 100vw - 2rem)"]]], [".w-\\[min\\(420px\\,calc\\(100vw_-_16px\\)\\)\\]", null, 4, [["width", "min(420px, 100vw - 16px)"]]], [".w-\\[min\\(480px\\,calc\\(100vw_-_2rem\\)\\)\\]", null, 4, [["width", "min(480px, 100vw - 2rem)"]]], [".w-\\[min\\(560px\\,calc\\(100vw_-_2rem\\)\\)\\]", null, 4, [["width", "min(560px, 100vw - 2rem)"]]], [".w-\\[var\\(--sidebar-width\\,240px\\)\\]", null, 4, [["width", "var(--sidebar-width, 240px)"]]], [".w-\\[var\\(--tools-width\\)\\]", null, 4, [["width", "var(--tools-width)"]]], [".w-auto", null, 4, [["width", "auto"]]], [".w-full", null, 4, [["width", "100%"]]], [".w-px", null, 4, [["width", "1px"]]], [".max-w-24", null, 4, [["max-width", "calc(var(--spacing) * 24)"]]], [".max-w-32", null, 4, [["max-width", "calc(var(--spacing) * 32)"]]], [".max-w-\\[9rem\\]", null, 4, [["max-width", "9rem"]]], [".max-w-\\[10rem\\]", null, 4, [["max-width", "10rem"]]], [".max-w-\\[14rem\\]", null, 4, [["max-width", "14rem"]]], [".max-w-\\[16rem\\]", null, 4, [["max-width", "16rem"]]], [".max-w-\\[24rem\\]", null, 4, [["max-width", "24rem"]]], [".max-w-\\[25\\%\\]", null, 4, [["max-width", "25%"]]], [".max-w-\\[26rem\\]", null, 4, [["max-width", "26rem"]]], [".max-w-\\[28rem\\]", null, 4, [["max-width", "28rem"]]], [".max-w-\\[35\\%\\]", null, 4, [["max-width", "35%"]]], [".max-w-\\[38\\%\\]", null, 4, [["max-width", "38%"]]], [".max-w-\\[45\\%\\]", null, 4, [["max-width", "45%"]]], [".max-w-\\[46rem\\]", null, 4, [["max-width", "46rem"]]], [".max-w-\\[55\\%\\]", null, 4, [["max-width", "55%"]]], [".max-w-\\[56rem\\]", null, 4, [["max-width", "56rem"]]], [".max-w-\\[85\\%\\]", null, 4, [["max-width", "85%"]]], [".max-w-\\[140px\\]", null, 4, [["max-width", "140px"]]], [".max-w-\\[320px\\]", null, 4, [["max-width", "320px"]]], [".max-w-\\[min\\(22rem\\,calc\\(100\\%-1\\.5rem\\)\\)\\]", null, 4, [["max-width", "min(22rem, 100% - 1.5rem)"]]], [".max-w-\\[min\\(30rem\\,calc\\(100\\%-1\\.6rem\\)\\)\\]", null, 4, [["max-width", "min(30rem, 100% - 1.6rem)"]]], [".max-w-\\[min\\(34rem\\,calc\\(100\\%-1\\.5rem\\)\\)\\]", null, 4, [["max-width", "min(34rem, 100% - 1.5rem)"]]], [".max-w-\\[min\\(320px\\,calc\\(100vw_-_24px\\)\\)\\]", null, 4, [["max-width", "min(320px, 100vw - 24px)"]]], [".max-w-full", null, 4, [["max-width", "100%"]]], [".max-w-none", null, 4, [["max-width", "none"]]], [".min-w-0", null, 4, [["min-width", "0"]]], [".min-w-6", null, 4, [["min-width", "calc(var(--spacing) * 6)"]]], [".min-w-8", null, 4, [["min-width", "calc(var(--spacing) * 8)"]]], [".min-w-12", null, 4, [["min-width", "calc(var(--spacing) * 12)"]]], [".min-w-24", null, 4, [["min-width", "calc(var(--spacing) * 24)"]]], [".min-w-36", null, 4, [["min-width", "calc(var(--spacing) * 36)"]]], [".min-w-56", null, 4, [["min-width", "calc(var(--spacing) * 56)"]]], [".min-w-\\[5\\.5rem\\]", null, 4, [["min-width", "5.5rem"]]], [".min-w-\\[7rem\\]", null, 4, [["min-width", "7rem"]]], [".min-w-\\[12rem\\]", null, 4, [["min-width", "12rem"]]], [".min-w-\\[14px\\]", null, 4, [["min-width", "14px"]]], [".min-w-\\[200px\\]", null, 4, [["min-width", "200px"]]], [".min-w-fit", null, 4, [["min-width", "fit-content"]]], [".min-w-max", null, 4, [["min-width", "max-content"]]], [".flex-1", null, 4, [["flex", "1"]]], [".flex-\\[0_0_5rem\\]", null, 4, [["flex", "0 0 5rem"]]], [".flex-\\[0_0_8px\\]", null, 4, [["flex", "0 0 8px"]]], [".flex-\\[0_1_40\\%\\]", null, 4, [["flex", "0 40%"]]], [".flex-\\[1_1_100\\%\\]", null, 4, [["flex", "100%"]]], [".flex-\\[2\\]", null, 4, [["flex", "2"]]], [".flex-initial", null, 4, [["flex", "0 auto"]]], [".flex-none", null, 4, [["flex", "none"]]], [".shrink", null, 4, [["flex-shrink", "1"]]], [".shrink-0", null, 4, [["flex-shrink", "0"]]], [".shrink-\\[0\\.001\\]", null, 4, [["flex-shrink", ".001"]]], [".shrink-\\[2\\]", null, 4, [["flex-shrink", "2"]]], [".shrink-\\[3\\]", null, 4, [["flex-shrink", "3"]]], [".grow", null, 4, [["flex-grow", "1"]]], [".basis-0", null, 4, [["flex-basis", "0"]]], [".basis-\\[14rem\\]", null, 4, [["flex-basis", "14rem"]]], [".-translate-y-1\\/2", null, 4, [["--tw-translate-y", "calc(calc(1 / 2 * 100%) * -1)"], ["translate", "var(--tw-translate-x) var(--tw-translate-y)"]]], [".\\[transform\\:translateY\\(-50\\%\\)\\]", null, 4, [["transform", "translateY(-50%)"]]], [".transform", null, 4, [["transform", "var(--tw-rotate-x, ) var(--tw-rotate-y, ) var(--tw-rotate-z, ) var(--tw-skew-x, ) var(--tw-skew-y, )"]]], [".animate-drop-zone", null, 4, [["animation", "var(--animate-drop-zone)"]]], [".animate-host-pulse", null, 4, [["animation", "var(--animate-host-pulse)"]]], [".animate-pulse", null, 4, [["animation", "var(--animate-pulse)"]]], [".animate-toast-in", null, 4, [["animation", "var(--animate-toast-in)"]]], [".cursor-col-resize", null, 4, [["cursor", "col-resize"]]], [".cursor-default", null, 4, [["cursor", "default"]]], [".cursor-grab", null, 4, [["cursor", "grab"]]], [".cursor-grabbing", null, 4, [["cursor", "grabbing"]]], [".cursor-pointer", null, 4, [["cursor", "pointer"]]], [".cursor-row-resize", null, 4, [["cursor", "row-resize"]]], [".touch-none", null, 4, [["touch-action", "none"]]], [".resize", null, 4, [["resize", "both"]]], [".resize-none", null, 4, [["resize", "none"]]], [".resize-y", null, 4, [["resize", "vertical"]]], [".\\[scrollbar-width\\:none\\]", null, 4, [["scrollbar-width", "none"]]], [".list-disc", null, 4, [["list-style-type", "disc"]]], [".list-none", null, 4, [["list-style-type", "none"]]], [".appearance-none", null, 4, [["appearance", "none"]]], [".grid-cols-8", null, 4, [["grid-template-columns", "repeat(8, minmax(0, 1fr))"]]], [".grid-cols-\\[1fr_auto_1fr\\]", null, 4, [["grid-template-columns", "1fr auto 1fr"]]], [".grid-cols-\\[2\\.5rem_2\\.5rem_0\\.9rem_minmax\\(0\\,1fr\\)\\]", null, 4, [["grid-template-columns", "2.5rem 2.5rem .9rem minmax(0, 1fr)"]]], [".grid-cols-\\[auto_minmax\\(0\\,1fr\\)\\]", null, 4, [["grid-template-columns", "auto minmax(0, 1fr)"]]], [".grid-cols-\\[minmax\\(4rem\\,10rem\\)_1fr_auto\\]", null, 4, [["grid-template-columns", "minmax(4rem, 10rem) 1fr auto"]]], [".grid-cols-\\[repeat\\(2\\,minmax\\(0\\,1fr\\)\\)\\]", null, 4, [["grid-template-columns", "repeat(2, minmax(0, 1fr))"]]], [".grid-cols-\\[repeat\\(auto-fit\\,minmax\\(8rem\\,1fr\\)\\)\\]", null, 4, [["grid-template-columns", "repeat(auto-fit, minmax(8rem, 1fr))"]]], [".flex-col", null, 4, [["flex-direction", "column"]]], [".flex-row", null, 4, [["flex-direction", "row"]]], [".flex-wrap", null, 4, [["flex-wrap", "wrap"]]], [".place-items-center", null, 4, [["place-items", "center"]]], [".content-center", null, 4, [["align-content", "center"]]], [".items-baseline", null, 4, [["align-items", "baseline"]]], [".items-center", null, 4, [["align-items", "center"]]], [".items-end", null, 4, [["align-items", "flex-end"]]], [".items-start", null, 4, [["align-items", "flex-start"]]], [".items-stretch", null, 4, [["align-items", "stretch"]]], [".justify-between", null, 4, [["justify-content", "space-between"]]], [".justify-center", null, 4, [["justify-content", "center"]]], [".justify-end", null, 4, [["justify-content", "flex-end"]]], [".justify-start", null, 4, [["justify-content", "flex-start"]]], [".justify-items-center", null, 4, [["justify-items", "center"]]], [".justify-items-start", null, 4, [["justify-items", "start"]]], [".gap-0", null, 4, [["gap", "0"]]], [".gap-0\\.5", null, 4, [["gap", "calc(var(--spacing) * .5)"]]], [".gap-1", null, 4, [["gap", "var(--spacing)"]]], [".gap-1\\.5", null, 4, [["gap", "calc(var(--spacing) * 1.5)"]]], [".gap-2", null, 4, [["gap", "calc(var(--spacing) * 2)"]]], [".gap-3", null, 4, [["gap", "calc(var(--spacing) * 3)"]]], [".gap-4", null, 4, [["gap", "calc(var(--spacing) * 4)"]]], [".gap-6", null, 4, [["gap", "calc(var(--spacing) * 6)"]]], [".gap-\\[0\\.1rem\\]", null, 4, [["gap", ".1rem"]]], [".gap-\\[0\\.3rem\\]", null, 4, [["gap", ".3rem"]]], [".gap-\\[0\\.4rem\\]", null, 4, [["gap", ".4rem"]]], [".gap-\\[0\\.05rem\\]", null, 4, [["gap", ".05rem"]]], [".gap-\\[0\\.6rem\\]", null, 4, [["gap", ".6rem"]]], [".gap-\\[0\\.8rem\\]", null, 4, [["gap", ".8rem"]]], [".gap-\\[0\\.16rem\\]", null, 4, [["gap", ".16rem"]]], [".gap-\\[0\\.32rem\\]", null, 4, [["gap", ".32rem"]]], [".gap-\\[0\\.35rem\\]", null, 4, [["gap", ".35rem"]]], [".gap-\\[0\\.45rem\\]", null, 4, [["gap", ".45rem"]]], [".gap-\\[0\\.55rem\\]", null, 4, [["gap", ".55rem"]]], [".gap-\\[0\\.65rem\\]", null, 4, [["gap", ".65rem"]]], [".gap-\\[0\\.85rem\\]", null, 4, [["gap", ".85rem"]]], [".gap-\\[1px\\]", null, 4, [["gap", "1px"]]], [".gap-\\[2px\\]", null, 4, [["gap", "2px"]]], [".gap-\\[3px\\]", null, 4, [["gap", "3px"]]], [".gap-\\[7px\\]", null, 4, [["gap", "7px"]]], [".gap-\\[13px\\]", null, 4, [["gap", "13px"]]], [":where(.space-y-0\\.5 > :not(:last-child))", null, 4, [["--tw-space-y-reverse", "0"], ["margin-block-start", "calc(calc(var(--spacing) * .5) * var(--tw-space-y-reverse))"], ["margin-block-end", "calc(calc(var(--spacing) * .5) * calc(1 - var(--tw-space-y-reverse)))"]]], [".gap-x-3", null, 4, [["column-gap", "calc(var(--spacing) * 3)"]]], [".gap-x-4", null, 4, [["column-gap", "calc(var(--spacing) * 4)"]]], [".gap-x-\\[0\\.7rem\\]", null, 4, [["column-gap", ".7rem"]]], [".gap-x-\\[0\\.9rem\\]", null, 4, [["column-gap", ".9rem"]]], [".gap-y-1", null, 4, [["row-gap", "var(--spacing)"]]], [".gap-y-\\[0\\.3rem\\]", null, 4, [["row-gap", ".3rem"]]], [".self-center", null, 4, [["align-self", "center"]]], [".self-end", null, 4, [["align-self", "flex-end"]]], [".self-start", null, 4, [["align-self", "flex-start"]]], [".self-stretch", null, 4, [["align-self", "stretch"]]], [".justify-self-start", null, 4, [["justify-self", "flex-start"]]], [".truncate", null, 4, [["text-overflow", "ellipsis"], ["white-space", "nowrap"], ["overflow", "hidden"]]], [".overflow-auto", null, 4, [["overflow", "auto"]]], [".overflow-hidden", null, 4, [["overflow", "hidden"]]], [".overflow-visible", null, 4, [["overflow", "visible"]]], [".overflow-x-auto", null, 4, [["overflow-x", "auto"]]], [".overflow-y-auto", null, 4, [["overflow-y", "auto"]]], [".overscroll-contain", null, 4, [["overscroll-behavior", "contain"]]], [".rounded, .rounded-\\[0\\.25rem\\]", null, 4, [["border-radius", ".25rem"]]], [".rounded-\\[1\\.5rem\\]", null, 4, [["border-radius", "1.5rem"]]], [".rounded-\\[2px\\]", null, 4, [["border-radius", "2px"]]], [".rounded-\\[3px\\]", null, 4, [["border-radius", "3px"]]], [".rounded-\\[12px\\]", null, 4, [["border-radius", "12px"]]], [".rounded-\\[50\\%\\]", null, 4, [["border-radius", "50%"]]], [".rounded-\\[999px\\]", null, 4, [["border-radius", "999px"]]], [".rounded-\\[calc\\(var\\(--radius\\)\\*2\\)\\]", null, 4, [["border-radius", "calc(var(--radius) * 2)"]]], [".rounded-\\[var\\(--card-radius\\,8px\\)\\]", null, 4, [["border-radius", "var(--card-radius, 8px)"]]], [".rounded-\\[var\\(--card-radius\\,12px\\)\\]", null, 4, [["border-radius", "var(--card-radius, 12px)"]]], [".rounded-full", null, 4, [["border-radius", "3.40282e38px"]]], [".rounded-none", null, 4, [["border-radius", "0"]]], [".rounded-soft", null, 4, [["border-radius", "var(--radius-pane)"]]], [".rounded-ui", null, 4, [["border-radius", "var(--radius)"]]], [".rounded-t-\\[12px\\]", null, 4, [["border-top-left-radius", "12px"], ["border-top-right-radius", "12px"]]], [".rounded-t-none", null, 4, [["border-top-left-radius", "0"], ["border-top-right-radius", "0"]]], [".rounded-bl-\\[6px\\]", null, 4, [["border-bottom-left-radius", "6px"]]], [".border", null, 4, [["border-style", "var(--tw-border-style)"], ["border-width", "1px"]]], [".border-0", null, 4, [["border-style", "var(--tw-border-style)"], ["border-width", "0"]]], [".border-\\[1\\.5px\\]", null, 4, [["border-style", "var(--tw-border-style)"], ["border-width", "1.5px"]]], [".border-b", null, 4, [["border-bottom-style", "var(--tw-border-style)"], ["border-bottom-width", "1px"]]], [".border-l", null, 4, [["border-left-style", "var(--tw-border-style)"], ["border-left-width", "1px"]]], [".border-l-\\[3px\\]", null, 4, [["border-left-style", "var(--tw-border-style)"], ["border-left-width", "3px"]]], [".border-solid", null, 4, [["--tw-border-style", "solid"], ["border-style", "solid"]]], [".border-accent", null, 4, [["border-color", "var(--accent)"]]], [".border-overlay-0", null, 4, [["border-color", "var(--overlay-0)"]]], [".border-overlay-1", null, 4, [["border-color", "var(--overlay-1)"]]], [".border-red", null, 4, [["border-color", "var(--red)"]]], [".border-subtext-0", null, 4, [["border-color", "var(--subtext-0)"]]], [".border-surface-1", null, 4, [["border-color", "var(--surface-1)"]]], [".border-teal", null, 4, [["border-color", "var(--teal)"]]], [".border-yellow", null, 4, [["border-color", "var(--yellow)"]]], [".border-l-accent", null, 4, [["border-left-color", "var(--accent)"]]], [".border-l-green", null, 4, [["border-left-color", "var(--green)"]]], [".border-l-red", null, 4, [["border-left-color", "var(--red)"]]], [".border-l-yellow", null, 4, [["border-left-color", "var(--yellow)"]]], [".bg-\\[\\#161616\\]", null, 4, [["background-color", "#161616"]]], [".bg-\\[\\#fff\\]", null, 4, [["background-color", "#fff"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_8\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "var(--accent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_8\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--accent) 8%,var(--panel-bg))"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_12\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--accent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_12\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--accent) 12%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--accent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--accent) 15%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--blue\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--blue)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--blue\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--blue) 15%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--green\\)_9\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--green)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--green\\)_9\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--green) 9%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--red\\)_7\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--red)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--red\\)_7\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--red) 7%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--red\\)_9\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--red)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--red\\)_9\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--red) 9%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--surface-1\\)_42\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--surface-1\\)_42\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--surface-1) 42%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--surface-1\\)_70\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--surface-1\\)_70\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--surface-1) 70%,var(--panel-bg))"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--text\\)_10\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "var(--text)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--text\\)_10\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--text) 10%,var(--panel-bg))"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--yellow\\)_8\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--yellow)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--yellow\\)_8\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--yellow) 8%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--yellow\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--yellow)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--yellow\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--yellow) 15%,transparent)"]]], [".bg-\\[rgba\\(0\\,0\\,0\\,0\\.5\\)\\]", null, 4, [["background-color", "#00000080"]]], [".bg-\\[rgba\\(0\\,0\\,0\\,0\\.7\\)\\]", null, 4, [["background-color", "#000000b3"]]], [".bg-\\[rgba\\(0\\,0\\,0\\,0\\.55\\)\\]", null, 4, [["background-color", "#0000008c"]]], [".bg-\\[rgba\\(0\\,0\\,0\\,0\\.62\\)\\]", null, 4, [["background-color", "#0000009e"]]], [".bg-\\[var\\(--accent\\)\\]", null, 4, [["background-color", "var(--accent)"]]], [".bg-\\[var\\(--backdrop\\)\\]", null, 4, [["background-color", "var(--backdrop)"]]], [".bg-\\[var\\(--bg\\)\\]", null, 4, [["background-color", "var(--bg)"]]], [".bg-\\[var\\(--card-bg\\)\\]", null, 4, [["background-color", "var(--card-bg)"]]], [".bg-\\[var\\(--picker-bg\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "var(--picker-bg, var(--panel-bg))"]]], [".bg-\\[var\\(--surface-1\\)\\]", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-\\[var\\(--workspace-tools-bg\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "var(--workspace-tools-bg, var(--panel-bg))"]]], [".bg-accent, .bg-accent\\/10", null, 4, [["background-color", "var(--accent)"]]], [".bg-accent\\/10", null, 4, [["background-color", "color-mix(in oklab, var(--accent) 10%, transparent)"]]], [".bg-accent\\/35", null, 4, [["background-color", "var(--accent)"]]], [".bg-accent\\/35", null, 4, [["background-color", "color-mix(in oklab, var(--accent) 35%, transparent)"]]], [".bg-fg", null, 4, [["background-color", "var(--text)"]]], [".bg-green, .bg-green\\/15", null, 4, [["background-color", "var(--green)"]]], [".bg-green\\/15", null, 4, [["background-color", "color-mix(in oklab, var(--green) 15%, transparent)"]]], [".bg-overlay-0", null, 4, [["background-color", "var(--overlay-0)"]]], [".bg-overlay-1", null, 4, [["background-color", "var(--overlay-1)"]]], [".bg-panel-bg", null, 4, [["background-color", "var(--panel-bg)"]]], [".bg-red, .bg-red\\/15", null, 4, [["background-color", "var(--red)"]]], [".bg-red\\/15", null, 4, [["background-color", "color-mix(in oklab, var(--red) 15%, transparent)"]]], [".bg-subtext-0", null, 4, [["background-color", "var(--subtext-0)"]]], [".bg-surface-0", null, 4, [["background-color", "var(--surface-0)"]]], [".bg-surface-1, .bg-surface-1\\/30", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-surface-1\\/30", null, 4, [["background-color", "color-mix(in oklab, var(--surface-1) 30%, transparent)"]]], [".bg-surface-1\\/60", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-surface-1\\/60", null, 4, [["background-color", "color-mix(in oklab, var(--surface-1) 60%, transparent)"]]], [".bg-surface-1\\/70", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-surface-1\\/70", null, 4, [["background-color", "color-mix(in oklab, var(--surface-1) 70%, transparent)"]]], [".bg-transparent", null, 4, [["background-color", "#0000"]]], [".bg-yellow", null, 4, [["background-color", "var(--yellow)"]]], [".object-contain", null, 4, [["object-fit", "contain"]]], [".object-cover", null, 4, [["object-fit", "cover"]]], [".p-0", null, 4, [["padding", "0"]]], [".p-0\\.5", null, 4, [["padding", "calc(var(--spacing) * .5)"]]], [".p-1", null, 4, [["padding", "var(--spacing)"]]], [".p-2", null, 4, [["padding", "calc(var(--spacing) * 2)"]]], [".p-3", null, 4, [["padding", "calc(var(--spacing) * 3)"]]], [".p-4", null, 4, [["padding", "calc(var(--spacing) * 4)"]]], [".p-5", null, 4, [["padding", "calc(var(--spacing) * 5)"]]], [".p-6", null, 4, [["padding", "calc(var(--spacing) * 6)"]]], [".p-\\[0\\.2rem\\]", null, 4, [["padding", ".2rem"]]], [".p-\\[0\\.4rem\\]", null, 4, [["padding", ".4rem"]]], [".p-\\[0\\.5rem\\]", null, 4, [["padding", ".5rem"]]], [".p-\\[0\\.9rem\\]", null, 4, [["padding", ".9rem"]]], [".p-\\[0\\.45rem\\]", null, 4, [["padding", ".45rem"]]], [".p-\\[0\\.55rem\\]", null, 4, [["padding", ".55rem"]]], [".p-\\[0\\.65rem\\]", null, 4, [["padding", ".65rem"]]], [".p-\\[2px\\]", null, 4, [["padding", "2px"]]], [".px-0", null, 4, [["padding-inline", "0"]]], [".px-1", null, 4, [["padding-inline", "var(--spacing)"]]], [".px-1\\.5", null, 4, [["padding-inline", "calc(var(--spacing) * 1.5)"]]], [".px-2", null, 4, [["padding-inline", "calc(var(--spacing) * 2)"]]], [".px-3", null, 4, [["padding-inline", "calc(var(--spacing) * 3)"]]], [".px-3\\.5", null, 4, [["padding-inline", "calc(var(--spacing) * 3.5)"]]], [".px-4", null, 4, [["padding-inline", "calc(var(--spacing) * 4)"]]], [".px-8", null, 4, [["padding-inline", "calc(var(--spacing) * 8)"]]], [".px-\\[0\\.2rem\\]", null, 4, [["padding-inline", ".2rem"]]], [".px-\\[0\\.3rem\\]", null, 4, [["padding-inline", ".3rem"]]], [".px-\\[0\\.4rem\\]", null, 4, [["padding-inline", ".4rem"]]], [".px-\\[0\\.5rem\\]", null, 4, [["padding-inline", ".5rem"]]], [".px-\\[0\\.6rem\\]", null, 4, [["padding-inline", ".6rem"]]], [".px-\\[0\\.7rem\\]", null, 4, [["padding-inline", ".7rem"]]], [".px-\\[0\\.8rem\\]", null, 4, [["padding-inline", ".8rem"]]], [".px-\\[0\\.9rem\\]", null, 4, [["padding-inline", ".9rem"]]], [".px-\\[0\\.26rem\\]", null, 4, [["padding-inline", ".26rem"]]], [".px-\\[0\\.28rem\\]", null, 4, [["padding-inline", ".28rem"]]], [".px-\\[0\\.35rem\\]", null, 4, [["padding-inline", ".35rem"]]], [".px-\\[0\\.42rem\\]", null, 4, [["padding-inline", ".42rem"]]], [".px-\\[0\\.45rem\\]", null, 4, [["padding-inline", ".45rem"]]], [".px-\\[0\\.48rem\\]", null, 4, [["padding-inline", ".48rem"]]], [".px-\\[0\\.55rem\\]", null, 4, [["padding-inline", ".55rem"]]], [".px-\\[0\\.65rem\\]", null, 4, [["padding-inline", ".65rem"]]], [".px-\\[0\\.75rem\\]", null, 4, [["padding-inline", ".75rem"]]], [".px-\\[0\\.85rem\\]", null, 4, [["padding-inline", ".85rem"]]], [".px-\\[1\\.4rem\\]", null, 4, [["padding-inline", "1.4rem"]]], [".px-\\[3px\\]", null, 4, [["padding-inline", "3px"]]], [".px-\\[10px\\]", null, 4, [["padding-inline", "10px"]]], [".py-0", null, 4, [["padding-block", "0"]]], [".py-0\\.5", null, 4, [["padding-block", "calc(var(--spacing) * .5)"]]], [".py-1", null, 4, [["padding-block", "var(--spacing)"]]], [".py-1\\.5", null, 4, [["padding-block", "calc(var(--spacing) * 1.5)"]]], [".py-2", null, 4, [["padding-block", "calc(var(--spacing) * 2)"]]], [".py-3", null, 4, [["padding-block", "calc(var(--spacing) * 3)"]]], [".py-4", null, 4, [["padding-block", "calc(var(--spacing) * 4)"]]], [".py-8", null, 4, [["padding-block", "calc(var(--spacing) * 8)"]]], [".py-\\[0\\.1rem\\]", null, 4, [["padding-block", ".1rem"]]], [".py-\\[0\\.2rem\\]", null, 4, [["padding-block", ".2rem"]]], [".py-\\[0\\.3rem\\]", null, 4, [["padding-block", ".3rem"]]], [".py-\\[0\\.4rem\\]", null, 4, [["padding-block", ".4rem"]]], [".py-\\[0\\.05rem\\]", null, 4, [["padding-block", ".05rem"]]], [".py-\\[0\\.6rem\\]", null, 4, [["padding-block", ".6rem"]]], [".py-\\[0\\.8rem\\]", null, 4, [["padding-block", ".8rem"]]], [".py-\\[0\\.12rem\\]", null, 4, [["padding-block", ".12rem"]]], [".py-\\[0\\.14rem\\]", null, 4, [["padding-block", ".14rem"]]], [".py-\\[0\\.15rem\\]", null, 4, [["padding-block", ".15rem"]]], [".py-\\[0\\.18rem\\]", null, 4, [["padding-block", ".18rem"]]], [".py-\\[0\\.25rem\\]", null, 4, [["padding-block", ".25rem"]]], [".py-\\[0\\.28rem\\]", null, 4, [["padding-block", ".28rem"]]], [".py-\\[0\\.32rem\\]", null, 4, [["padding-block", ".32rem"]]], [".py-\\[0\\.35rem\\]", null, 4, [["padding-block", ".35rem"]]], [".py-\\[0\\.42rem\\]", null, 4, [["padding-block", ".42rem"]]], [".py-\\[0\\.45rem\\]", null, 4, [["padding-block", ".45rem"]]], [".py-\\[0\\.55rem\\]", null, 4, [["padding-block", ".55rem"]]], [".py-\\[0\\.65rem\\]", null, 4, [["padding-block", ".65rem"]]], [".py-\\[2px\\]", null, 4, [["padding-block", "2px"]]], [".py-\\[3px\\]", null, 4, [["padding-block", "3px"]]], [".py-\\[6px\\]", null, 4, [["padding-block", "6px"]]], [".py-px", null, 4, [["padding-block", "1px"]]], [".pt-1", null, 4, [["padding-top", "var(--spacing)"]]], [".pt-2", null, 4, [["padding-top", "calc(var(--spacing) * 2)"]]], [".pt-2\\.5", null, 4, [["padding-top", "calc(var(--spacing) * 2.5)"]]], [".pt-3", null, 4, [["padding-top", "calc(var(--spacing) * 3)"]]], [".pt-4", null, 4, [["padding-top", "calc(var(--spacing) * 4)"]]], [".pt-5", null, 4, [["padding-top", "calc(var(--spacing) * 5)"]]], [".pt-\\[0\\.2rem\\]", null, 4, [["padding-top", ".2rem"]]], [".pt-\\[0\\.4rem\\]", null, 4, [["padding-top", ".4rem"]]], [".pt-\\[0\\.6rem\\]", null, 4, [["padding-top", ".6rem"]]], [".pt-\\[0\\.85rem\\]", null, 4, [["padding-top", ".85rem"]]], [".pt-\\[2px\\]", null, 4, [["padding-top", "2px"]]], [".pt-\\[12vh\\]", null, 4, [["padding-top", "12vh"]]], [".pt-\\[max\\(0\\.5rem\\,env\\(safe-area-inset-top\\)\\)\\]", null, 4, [["padding-top", "max(.5rem, env(safe-area-inset-top))"]]], [".pr-0\\.5", null, 4, [["padding-right", "calc(var(--spacing) * .5)"]]], [".pr-1", null, 4, [["padding-right", "var(--spacing)"]]], [".pr-1\\.5", null, 4, [["padding-right", "calc(var(--spacing) * 1.5)"]]], [".pr-2", null, 4, [["padding-right", "calc(var(--spacing) * 2)"]]], [".pr-3", null, 4, [["padding-right", "calc(var(--spacing) * 3)"]]], [".pr-12", null, 4, [["padding-right", "calc(var(--spacing) * 12)"]]], [".pr-\\[0\\.3rem\\]", null, 4, [["padding-right", ".3rem"]]], [".pr-\\[0\\.6rem\\]", null, 4, [["padding-right", ".6rem"]]], [".pr-\\[0\\.35rem\\]", null, 4, [["padding-right", ".35rem"]]], [".pr-\\[0\\.45rem\\]", null, 4, [["padding-right", ".45rem"]]], [".pr-\\[0\\.55rem\\]", null, 4, [["padding-right", ".55rem"]]], [".pr-\\[1\\.6rem\\]", null, 4, [["padding-right", "1.6rem"]]], [".pr-\\[3px\\]", null, 4, [["padding-right", "3px"]]], [".pr-\\[env\\(safe-area-inset-right\\)\\]", null, 4, [["padding-right", "env(safe-area-inset-right)"]]], [".pr-\\[max\\(0\\.5rem\\,env\\(safe-area-inset-right\\)\\)\\]", null, 4, [["padding-right", "max(.5rem, env(safe-area-inset-right))"]]], [".pb-1", null, 4, [["padding-bottom", "var(--spacing)"]]], [".pb-2", null, 4, [["padding-bottom", "calc(var(--spacing) * 2)"]]], [".pb-3", null, 4, [["padding-bottom", "calc(var(--spacing) * 3)"]]], [".pb-4", null, 4, [["padding-bottom", "calc(var(--spacing) * 4)"]]], [".pb-8", null, 4, [["padding-bottom", "calc(var(--spacing) * 8)"]]], [".pb-\\[0\\.3rem\\]", null, 4, [["padding-bottom", ".3rem"]]], [".pb-\\[0\\.4rem\\]", null, 4, [["padding-bottom", ".4rem"]]], [".pb-\\[0\\.25rem\\]", null, 4, [["padding-bottom", ".25rem"]]], [".pb-\\[0\\.55rem\\]", null, 4, [["padding-bottom", ".55rem"]]], [".pb-\\[1\\.4rem\\]", null, 4, [["padding-bottom", "1.4rem"]]], [".pb-\\[calc\\(1\\.5rem\\+env\\(safe-area-inset-bottom\\)\\)\\]", null, 4, [["padding-bottom", "calc(1.5rem + env(safe-area-inset-bottom))"]]], [".pb-\\[calc\\(1rem\\+env\\(safe-area-inset-bottom\\)\\)\\]", null, 4, [["padding-bottom", "calc(1rem + env(safe-area-inset-bottom))"]]], [".pb-\\[env\\(safe-area-inset-bottom\\)\\]", null, 4, [["padding-bottom", "env(safe-area-inset-bottom)"]]], [".pb-\\[max\\(0\\.5rem\\,env\\(safe-area-inset-bottom\\)\\)\\]", null, 4, [["padding-bottom", "max(.5rem, env(safe-area-inset-bottom))"]]], [".pl-1", null, 4, [["padding-left", "var(--spacing)"]]], [".pl-1\\.5", null, 4, [["padding-left", "calc(var(--spacing) * 1.5)"]]], [".pl-2", null, 4, [["padding-left", "calc(var(--spacing) * 2)"]]], [".pl-3", null, 4, [["padding-left", "calc(var(--spacing) * 3)"]]], [".pl-4", null, 4, [["padding-left", "calc(var(--spacing) * 4)"]]], [".pl-5", null, 4, [["padding-left", "calc(var(--spacing) * 5)"]]], [".pl-6", null, 4, [["padding-left", "calc(var(--spacing) * 6)"]]], [".pl-\\[0\\.4rem\\]", null, 4, [["padding-left", ".4rem"]]], [".pl-\\[0\\.45rem\\]", null, 4, [["padding-left", ".45rem"]]], [".pl-\\[0\\.75rem\\]", null, 4, [["padding-left", ".75rem"]]], [".pl-\\[0\\.85rem\\]", null, 4, [["padding-left", ".85rem"]]], [".pl-\\[1\\.2rem\\]", null, 4, [["padding-left", "1.2rem"]]], [".pl-\\[1\\.55rem\\]", null, 4, [["padding-left", "1.55rem"]]], [".pl-\\[1\\.075rem\\]", null, 4, [["padding-left", "1.075rem"]]], [".pl-\\[1\\.525rem\\]", null, 4, [["padding-left", "1.525rem"]]], [".pl-\\[1\\.875rem\\]", null, 4, [["padding-left", "1.875rem"]]], [".pl-\\[85px\\]", null, 4, [["padding-left", "85px"]]], [".pl-\\[max\\(0\\.5rem\\,env\\(safe-area-inset-left\\)\\)\\]", null, 4, [["padding-left", "max(.5rem, env(safe-area-inset-left))"]]], [".pl-\\[max\\(0\\.25rem\\,env\\(safe-area-inset-left\\)\\)\\]", null, 4, [["padding-left", "max(.25rem, env(safe-area-inset-left))"]]], [".text-center", null, 4, [["text-align", "center"]]], [".text-left", null, 4, [["text-align", "left"]]], [".text-right", null, 4, [["text-align", "right"]]], [".\\[font-family\\:inherit\\]", null, 4, [["font-family", "inherit"]]], [".\\[font-family\\:ui-monospace\\,SFMono-Regular\\,Menlo\\,monospace\\]", null, 4, [["font-family", "ui-monospace, SFMono-Regular, Menlo, monospace"]]], [".\\[font-family\\:var\\(--font-mono\\)\\]", null, 4, [["font-family", "var(--font-mono)"]]], [".text-sm", null, 4, [["font-size", "var(--text-sm)"], ["line-height", "var(--tw-leading, var(--text-sm--line-height))"]]], [".text-xs", null, 4, [["font-size", "var(--text-xs)"], ["line-height", "var(--tw-leading, var(--text-xs--line-height))"]]], [".\\[font-size\\:inherit\\]", null, 4, [["font-size", "inherit"]]], [".text-\\[0\\.6rem\\]", null, 4, [["font-size", ".6rem"]]], [".text-\\[0\\.7rem\\]", null, 4, [["font-size", ".7rem"]]], [".text-\\[0\\.8em\\]", null, 4, [["font-size", ".8em"]]], [".text-\\[0\\.8rem\\]", null, 4, [["font-size", ".8rem"]]], [".text-\\[0\\.9em\\]", null, 4, [["font-size", ".9em"]]], [".text-\\[0\\.9rem\\]", null, 4, [["font-size", ".9rem"]]], [".text-\\[0\\.54rem\\]", null, 4, [["font-size", ".54rem"]]], [".text-\\[0\\.58rem\\]", null, 4, [["font-size", ".58rem"]]], [".text-\\[0\\.62rem\\]", null, 4, [["font-size", ".62rem"]]], [".text-\\[0\\.63rem\\]", null, 4, [["font-size", ".63rem"]]], [".text-\\[0\\.64rem\\]", null, 4, [["font-size", ".64rem"]]], [".text-\\[0\\.65rem\\]", null, 4, [["font-size", ".65rem"]]], [".text-\\[0\\.66rem\\]", null, 4, [["font-size", ".66rem"]]], [".text-\\[0\\.66rem\\]\\!", null, 4, [["font-size", ".66rem", 1]]], [".text-\\[0\\.68rem\\]", null, 4, [["font-size", ".68rem"]]], [".text-\\[0\\.72rem\\]", null, 4, [["font-size", ".72rem"]]], [".text-\\[0\\.74rem\\]", null, 4, [["font-size", ".74rem"]]], [".text-\\[0\\.75rem\\]", null, 4, [["font-size", ".75rem"]]], [".text-\\[0\\.76rem\\]", null, 4, [["font-size", ".76rem"]]], [".text-\\[0\\.77rem\\]", null, 4, [["font-size", ".77rem"]]], [".text-\\[0\\.78rem\\]", null, 4, [["font-size", ".78rem"]]], [".text-\\[0\\.82rem\\]", null, 4, [["font-size", ".82rem"]]], [".text-\\[0\\.83rem\\]", null, 4, [["font-size", ".83rem"]]], [".text-\\[0\\.85rem\\]", null, 4, [["font-size", ".85rem"]]], [".text-\\[0\\.88rem\\]", null, 4, [["font-size", ".88rem"]]], [".text-\\[0\\.95rem\\]", null, 4, [["font-size", ".95rem"]]], [".text-\\[0\\.875rem\\]", null, 4, [["font-size", ".875rem"]]], [".text-\\[1\\.1rem\\]", null, 4, [["font-size", "1.1rem"]]], [".text-\\[1\\.4em\\]", null, 4, [["font-size", "1.4em"]]], [".text-\\[1\\.6rem\\]", null, 4, [["font-size", "1.6rem"]]], [".text-\\[1\\.15rem\\]", null, 4, [["font-size", "1.15rem"]]], [".text-\\[1rem\\]", null, 4, [["font-size", "1rem"]]], [".text-\\[2\\.4rem\\]", null, 4, [["font-size", "2.4rem"]]], [".text-\\[9px\\]", null, 4, [["font-size", "9px"]]], [".text-\\[10px\\]", null, 4, [["font-size", "10px"]]], [".text-\\[11px\\]", null, 4, [["font-size", "11px"]]], [".text-\\[12\\.5px\\]", null, 4, [["font-size", "12.5px"]]], [".text-\\[12px\\]", null, 4, [["font-size", "12px"]]], [".text-\\[13px\\]", null, 4, [["font-size", "13px"]]], [".text-\\[14px\\]", null, 4, [["font-size", "14px"]]], [".text-\\[calc\\(0\\.95rem\\*var\\(--chat-font-scale\\,1\\)\\)\\]", null, 4, [["font-size", "calc(.95rem * var(--chat-font-scale, 1))"]]], [".text-\\[length\\:calc\\(11px\\*var\\(--zoom\\,1\\)\\)\\]", null, 4, [["font-size", "calc(11px * var(--zoom, 1))"]]], [".text-\\[length\\:calc\\(13px\\*var\\(--zoom\\,1\\)\\)\\]", null, 4, [["font-size", "calc(13px * var(--zoom, 1))"]]], [".leading-4", null, 4, [["--tw-leading", "calc(var(--spacing) * 4)"], ["line-height", "calc(var(--spacing) * 4)"]]], [".leading-\\[1\\.1\\]", null, 4, [["--tw-leading", "1.1"], ["line-height", "1.1"]]], [".leading-\\[1\\.2\\]", null, 4, [["--tw-leading", "1.2"], ["line-height", "1.2"]]], [".leading-\\[1\\.3\\]", null, 4, [["--tw-leading", "1.3"], ["line-height", "1.3"]]], [".leading-\\[1\\.4\\]", null, 4, [["--tw-leading", "1.4"], ["line-height", "1.4"]]], [".leading-\\[1\\.5\\]", null, 4, [["--tw-leading", "1.5"], ["line-height", "1.5"]]], [".leading-\\[1\\.6\\]", null, 4, [["--tw-leading", "1.6"], ["line-height", "1.6"]]], [".leading-\\[1\\.45\\]", null, 4, [["--tw-leading", "1.45"], ["line-height", "1.45"]]], [".leading-\\[18px\\]", null, 4, [["--tw-leading", "18px"], ["line-height", "18px"]]], [".leading-none", null, 4, [["--tw-leading", "1"], ["line-height", "1"]]], [".leading-relaxed", null, 4, [["--tw-leading", "var(--leading-relaxed)"], ["line-height", "var(--leading-relaxed)"]]], [".leading-tight", null, 4, [["--tw-leading", "var(--leading-tight)"], ["line-height", "var(--leading-tight)"]]], [".\\[line-height\\:inherit\\]", null, 4, [["line-height", "inherit"]]], [".font-bold", null, 4, [["--tw-font-weight", "var(--font-weight-bold)"], ["font-weight", "var(--font-weight-bold)"]]], [".font-medium", null, 4, [["--tw-font-weight", "var(--font-weight-medium)"], ["font-weight", "var(--font-weight-medium)"]]], [".font-normal", null, 4, [["--tw-font-weight", "var(--font-weight-normal)"], ["font-weight", "var(--font-weight-normal)"]]], [".font-semibold", null, 4, [["--tw-font-weight", "var(--font-weight-semibold)"], ["font-weight", "var(--font-weight-semibold)"]]], [".\\[font-weight\\:inherit\\]", null, 4, [["font-weight", "inherit"]]], [".tracking-\\[-0\\.02em\\]", null, 4, [["--tw-tracking", "-.02em"], ["letter-spacing", "-.02em"]]], [".tracking-\\[0\\.03em\\]", null, 4, [["--tw-tracking", ".03em"], ["letter-spacing", ".03em"]]], [".tracking-\\[0\\.04em\\]", null, 4, [["--tw-tracking", ".04em"], ["letter-spacing", ".04em"]]], [".tracking-\\[0\\.06em\\]", null, 4, [["--tw-tracking", ".06em"], ["letter-spacing", ".06em"]]], [".tracking-\\[0\\.08em\\]", null, 4, [["--tw-tracking", ".08em"], ["letter-spacing", ".08em"]]], [".tracking-\\[0\\.09em\\]", null, 4, [["--tw-tracking", ".09em"], ["letter-spacing", ".09em"]]], [".tracking-\\[0\\.22em\\]", null, 4, [["--tw-tracking", ".22em"], ["letter-spacing", ".22em"]]], [".tracking-normal", null, 4, [["--tw-tracking", "var(--tracking-normal)"], ["letter-spacing", "var(--tracking-normal)"]]], [".tracking-wide", null, 4, [["--tw-tracking", "var(--tracking-wide)"], ["letter-spacing", "var(--tracking-wide)"]]], [".\\[overflow-wrap\\:anywhere\\]", null, 4, [["overflow-wrap", "anywhere"]]], [".break-words", null, 4, [["overflow-wrap", "break-word"]]], [".\\[word-break\\:break-word\\]", null, 4, [["word-break", "break-word"]]], [".text-ellipsis", null, 4, [["text-overflow", "ellipsis"]]], [".whitespace-normal", null, 4, [["white-space", "normal"]]], [".whitespace-nowrap", null, 4, [["white-space", "nowrap"]]], [".whitespace-pre", null, 4, [["white-space", "pre"]]], [".whitespace-pre-wrap", null, 4, [["white-space", "pre-wrap"]]], [".\\[tab-size\\:2\\]", null, 4, [["tab-size", "2"]]], [".text-\\[color\\:var\\(--git-muted\\)\\]", null, 4, [["color", "var(--git-muted)"]]], [".text-\\[var\\(--subtext-0\\)\\]", null, 4, [["color", "var(--subtext-0)"]]], [".text-\\[var\\(--text\\)\\]", null, 4, [["color", "var(--text)"]]], [".text-accent", null, 4, [["color", "var(--accent)"]]], [".text-blue", null, 4, [["color", "var(--blue)"]]], [".text-current", null, 4, [["color", "currentColor"]]], [".text-fg", null, 4, [["color", "var(--text)"]]], [".text-green", null, 4, [["color", "var(--green)"]]], [".text-inherit", null, 4, [["color", "inherit"]]], [".text-mauve", null, 4, [["color", "var(--mauve)"]]], [".text-overlay-0", null, 4, [["color", "var(--overlay-0)"]]], [".text-overlay-1", null, 4, [["color", "var(--overlay-1)"]]], [".text-panel-bg", null, 4, [["color", "var(--panel-bg)"]]], [".text-peach", null, 4, [["color", "var(--peach)"]]], [".text-red", null, 4, [["color", "var(--red)"]]], [".text-red\\!", null, 4, [["color", "var(--red)", 1]]], [".text-subtext-0", null, 4, [["color", "var(--subtext-0)"]]], [".text-yellow", null, 4, [["color", "var(--yellow)"]]], [".capitalize", null, 4, [["text-transform", "capitalize"]]], [".normal-case", null, 4, [["text-transform", "none"]]], [".uppercase", null, 4, [["text-transform", "uppercase"]]], [".italic", null, 4, [["font-style", "italic"]]], [".not-italic", null, 4, [["font-style", "normal"]]], [".tabular-nums", null, 4, [["--tw-numeric-spacing", "tabular-nums"], ["font-variant-numeric", "var(--tw-ordinal, ) var(--tw-slashed-zero, ) var(--tw-numeric-figure, ) var(--tw-numeric-spacing, ) var(--tw-numeric-fraction, )"]]], [".line-through", null, 4, [["text-decoration-line", "line-through"]]], [".no-underline", null, 4, [["text-decoration-line", "none"]]], [".underline", null, 4, [["text-decoration-line", "underline"]]], [".opacity-0", null, 4, [["opacity", "0"]]], [".opacity-40", null, 4, [["opacity", ".4"]]], [".opacity-60", null, 4, [["opacity", ".6"]]], [".opacity-70", null, 4, [["opacity", ".7"]]], [".opacity-75", null, 4, [["opacity", ".75"]]], [".opacity-80", null, 4, [["opacity", ".8"]]], [".opacity-100", null, 4, [["opacity", "1"]]], [".opacity-\\[0\\.72\\]", null, 4, [["opacity", ".72"]]], [".shadow", null, 4, [["--tw-shadow", "0 1px 3px 0 var(--tw-shadow-color, #0000001a), 0 1px 2px -1px var(--tw-shadow-color, #0000001a)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_1px_4px_rgba\\(0\\,0\\,0\\,0\\.4\\)\\]", null, 4, [["--tw-shadow", "0 1px 4px var(--tw-shadow-color, #0006)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_2px_8px_rgba\\(0\\,0\\,0\\,0\\.4\\)\\]", null, 4, [["--tw-shadow", "0 2px 8px var(--tw-shadow-color, #0006)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_2px_8px_rgba\\(0\\,0\\,0\\,0\\.35\\)\\]", null, 4, [["--tw-shadow", "0 2px 8px var(--tw-shadow-color, #00000059)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_6px_20px_rgba\\(0\\,0\\,0\\,0\\.3\\)\\]", null, 4, [["--tw-shadow", "0 6px 20px var(--tw-shadow-color, #0000004d)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_8px_24px_rgba\\(0\\,0\\,0\\,0\\.35\\)\\]", null, 4, [["--tw-shadow", "0 8px 24px var(--tw-shadow-color, #00000059)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_8px_24px_rgba\\(0\\,0\\,0\\,0\\.45\\)\\]", null, 4, [["--tw-shadow", "0 8px 24px var(--tw-shadow-color, #00000073)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_8px_32px_rgba\\(0\\,0\\,0\\,0\\.5\\)\\]", null, 4, [["--tw-shadow", "0 8px 32px var(--tw-shadow-color, #00000080)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_12px_32px_rgba\\(0\\,0\\,0\\,0\\.5\\)\\]", null, 4, [["--tw-shadow", "0 12px 32px var(--tw-shadow-color, #00000080)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_16px_48px_rgba\\(0\\,0\\,0\\,0\\.55\\)\\]", null, 4, [["--tw-shadow", "0 16px 48px var(--tw-shadow-color, #0000008c)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[inset_0_0_24px_var\\(--accent\\)\\]", null, 4, [["--tw-shadow", "inset 0 0 24px var(--tw-shadow-color, var(--accent))"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-lg", null, 4, [["--tw-shadow", "0 10px 15px -3px var(--tw-shadow-color, #0000001a), 0 4px 6px -4px var(--tw-shadow-color, #0000001a)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".ring", null, 4, [["--tw-ring-shadow", "var(--tw-ring-inset, ) 0 0 0 calc(1px + var(--tw-ring-offset-width)) var(--tw-ring-color, currentcolor)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".\\[box-shadow\\:0_1px_2px_rgba\\(0\\,0\\,0\\,0\\.3\\)\\]", null, 4, [["box-shadow", "0 1px 2px #0000004d"]]], [".\\[box-shadow\\:0_4px_14px_rgba\\(0\\,0\\,0\\,0\\.35\\)\\]", null, 4, [["box-shadow", "0 4px 14px #00000059"]]], [".\\[box-shadow\\:none\\]", null, 4, [["box-shadow", "none"]]], [".\\[outline\\:none\\]", null, 4, [["outline", "none"]]], [".outline, .outline-1", null, 4, [["outline-style", "var(--tw-outline-style)"], ["outline-width", "1px"]]], [".outline-2", null, 4, [["outline-style", "var(--tw-outline-style)"], ["outline-width", "2px"]]], [".outline-accent", null, 4, [["outline-color", "var(--accent)"]]], [".blur", null, 4, [["--tw-blur", "blur(8px)"], ["filter", "var(--tw-blur, ) var(--tw-brightness, ) var(--tw-contrast, ) var(--tw-grayscale, ) var(--tw-hue-rotate, ) var(--tw-invert, ) var(--tw-saturate, ) var(--tw-sepia, ) var(--tw-drop-shadow, )"]]], [".\\!filter", null, 4, [["filter", "var(--tw-blur, ) var(--tw-brightness, ) var(--tw-contrast, ) var(--tw-grayscale, ) var(--tw-hue-rotate, ) var(--tw-invert, ) var(--tw-saturate, ) var(--tw-sepia, ) var(--tw-drop-shadow, )", 1]]], [".\\[filter\\:drop-shadow\\(0_6px_10px_rgba\\(0\\,0\\,0\\,0\\.45\\)\\)\\]", null, 4, [["filter", "drop-shadow(0 6px 10px #00000073)"]]], [".filter", null, 4, [["filter", "var(--tw-blur, ) var(--tw-brightness, ) var(--tw-contrast, ) var(--tw-grayscale, ) var(--tw-hue-rotate, ) var(--tw-invert, ) var(--tw-saturate, ) var(--tw-sepia, ) var(--tw-drop-shadow, )"]]], [".backdrop-blur-xl", null, 4, [["--tw-backdrop-blur", "blur(var(--blur-xl))"], ["-webkit-backdrop-filter", "var(--tw-backdrop-blur, ) var(--tw-backdrop-brightness, ) var(--tw-backdrop-contrast, ) var(--tw-backdrop-grayscale, ) var(--tw-backdrop-hue-rotate, ) var(--tw-backdrop-invert, ) var(--tw-backdrop-opacity, ) var(--tw-backdrop-saturate, ) var(--tw-backdrop-sepia, )"], ["backdrop-filter", "var(--tw-backdrop-blur, ) var(--tw-backdrop-brightness, ) var(--tw-backdrop-contrast, ) var(--tw-backdrop-grayscale, ) var(--tw-backdrop-hue-rotate, ) var(--tw-backdrop-invert, ) var(--tw-backdrop-opacity, ) var(--tw-backdrop-saturate, ) var(--tw-backdrop-sepia, )"]]], [".backdrop-saturate-150", null, 4, [["--tw-backdrop-saturate", "saturate(150%)"], ["-webkit-backdrop-filter", "var(--tw-backdrop-blur, ) var(--tw-backdrop-brightness, ) var(--tw-backdrop-contrast, ) var(--tw-backdrop-grayscale, ) var(--tw-backdrop-hue-rotate, ) var(--tw-backdrop-invert, ) var(--tw-backdrop-opacity, ) var(--tw-backdrop-saturate, ) var(--tw-backdrop-sepia, )"], ["backdrop-filter", "var(--tw-backdrop-blur, ) var(--tw-backdrop-brightness, ) var(--tw-backdrop-contrast, ) var(--tw-backdrop-grayscale, ) var(--tw-backdrop-hue-rotate, ) var(--tw-backdrop-invert, ) var(--tw-backdrop-opacity, ) var(--tw-backdrop-saturate, ) var(--tw-backdrop-sepia, )"]]], [".transition", null, 4, [["transition-property", "color, background-color, border-color, outline-color, text-decoration-color, fill, stroke, --tw-gradient-from, --tw-gradient-via, --tw-gradient-to, opacity, box-shadow, transform, translate, scale, rotate, filter, -webkit-backdrop-filter, backdrop-filter, display, content-visibility, overlay, pointer-events"], ["transition-timing-function", "var(--tw-ease, var(--default-transition-timing-function))"], ["transition-duration", "var(--tw-duration, var(--default-transition-duration))"]]], [".transition-\\[left\\,top\\,width\\,height\\]", null, 4, [["transition-property", "left, top, width, height"], ["transition-timing-function", "var(--tw-ease, var(--default-transition-timing-function))"], ["transition-duration", "var(--tw-duration, var(--default-transition-duration))"]]], [".transition-opacity", null, 4, [["transition-property", "opacity"], ["transition-timing-function", "var(--tw-ease, var(--default-transition-timing-function))"], ["transition-duration", "var(--tw-duration, var(--default-transition-duration))"]]], [".duration-150", null, 4, [["--tw-duration", ".15s"], ["transition-duration", ".15s"]]], [".ease-out", null, 4, [["--tw-ease", "var(--ease-out)"], ["transition-timing-function", "var(--ease-out)"]]], [".outline-none", null, 4, [["--tw-outline-style", "none"], ["outline-style", "none"]]], [".outline-solid", null, 4, [["--tw-outline-style", "solid"], ["outline-style", "solid"]]], [".select-none", null, 4, [["-webkit-user-select", "none"], ["user-select", "none"]]], [".select-text", null, 4, [["-webkit-user-select", "text"], ["user-select", "text"]]], [".\\[--panel-bg\\:var\\(--surface-dim\\)\\]", null, 4, [["--panel-bg", "var(--surface-dim)"]]], [".\\[--picker-bg\\:var\\(--surface-0\\)\\]", null, 4, [["--picker-bg", "var(--surface-0)"]]], [".\\[--radius\\:var\\(--radius-pane\\)\\]", null, 4, [["--radius", "var(--radius-pane)"]]], [".\\[--workspace-tools-bg\\:transparent\\]", null, 4, [["--workspace-tools-bg", "transparent"]]], [".\\[-webkit-box-orient\\:vertical\\]", null, 4, [["-webkit-box-orient", "vertical"]]], [".\\[-webkit-line-clamp\\:3\\]", null, 4, [["-webkit-line-clamp", "3"]]], [".\\[-webkit-touch-callout\\:none\\]", null, 4, [["-webkit-touch-callout", "none"]]], [".\\[background\\:none\\]", null, 4, [["background", "none"]]], [".\\[border-right\\:1px_solid_var\\(--git-border\\)\\]", null, 4, [["border-right", "1px solid var(--git-border)"]]], [".\\[border-top\\:1px_solid_var\\(--git-border\\)\\]", null, 4, [["border-top", "1px solid var(--git-border)"]]], [".\\[border\\:0\\]", null, 4, [["border", "0"]]], [".\\[border\\:none\\]", null, 4, [["border", "none"]]], [".\\[font\\:1\\.15rem\\/1_var\\(--font-mono\\)\\]", null, 4, [["font", "1.15rem/1 var(--font-mono)"]]], [".\\[font\\:1rem\\/1\\.2_var\\(--font-mono\\)\\]", null, 4, [["font", "1rem/1.2 var(--font-mono)"]]], [".\\[font\\:inherit\\]", null, 4, [["font", "inherit"]]], [".\\[transition\\:background_0\\.1s_ease\\]", null, 4, [["transition", "background .1s"]]], [".\\[transition\\:background_0\\.12s_ease\\]", null, 4, [["transition", "background .12s"]]], [".\\[transition\\:background_0\\.15s_ease\\]", null, 4, [["transition", "background .15s"]]], [".\\[transition\\:color_0\\.1s_ease\\,background_0\\.1s_ease\\]", null, 4, [["transition", "color .1s, background .1s"]]], [".\\[transition\\:color_0\\.12s_ease\\,background_0\\.12s_ease\\]", null, 4, [["transition", "color .12s, background .12s"]]], [".\\[transition\\:color_0\\.15s_ease\\]", null, 4, [["transition", "color .15s"]]], [".\\[transition\\:opacity_0\\.12s_ease\\]", null, 4, [["transition", "opacity .12s"]]], [".\\[transition\\:transform_0\\.15s_ease\\,background_0\\.15s_ease\\]", null, 4, [["transition", "transform .15s, background .15s"]]], [".not-has-\\[\\[data-setting-row\\]\\]\\:hidden:not(:has([data-setting-row]))", null, 4, [["display", "none"]]], [".group-focus-within\\:flex:is(:where(.group):focus-within *)", null, 4, [["display", "flex"]]], [".group-focus-within\\/row\\:opacity-100:is(:where(.group\\/row):focus-within *)", null, 4, [["opacity", "1"]]], [".group-hover\\:flex:is(:where(.group):hover *)", null, 4, [["display", "flex"]]], [".group-hover\\:opacity-100:is(:where(.group):hover *)", null, 4, [["opacity", "1"]]], [".group-hover\\/line\\:opacity-90:is(:where(.group\\/line):hover *)", null, 4, [["opacity", ".9"]]], [".group-hover\\/ph\\:opacity-100:is(:where(.group\\/ph):hover *), .group-hover\\/row\\:opacity-100:is(:where(.group\\/row):hover *)", null, 4, [["opacity", "1"]]], [".group-hover\\/submenu\\:block:is(:where(.group\\/submenu):hover *)", null, 4, [["display", "block"]]], [".group-focus\\/tree\\:ring-1:is(:where(.group\\/tree):focus *)", null, 4, [["--tw-ring-shadow", "var(--tw-ring-inset, ) 0 0 0 calc(1px + var(--tw-ring-offset-width)) var(--tw-ring-color, currentcolor)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".group-focus\\/tree\\:ring-overlay-1:is(:where(.group\\/tree):focus *)", null, 4, [["--tw-ring-color", "var(--overlay-1)"]]], [".group-focus\\/tree\\:ring-inset:is(:where(.group\\/tree):focus *)", null, 4, [["--tw-ring-inset", "inset"]]], ['.group-aria-checked\\:\\[transform\\:translateX\\(1\\.1rem\\)\\]:is(:where(.group)[aria-checked="true"] *)', null, 4, [["transform", "translateX(1.1rem)"]]], ['.group-aria-checked\\:border-accent:is(:where(.group)[aria-checked="true"] *)', null, 4, [["border-color", "var(--accent)"]]], ['.group-aria-checked\\:bg-accent:is(:where(.group)[aria-checked="true"] *)', null, 4, [["background-color", "var(--accent)"]]], ['.group-aria-checked\\:bg-panel-bg:is(:where(.group)[aria-checked="true"] *)', null, 4, [["background-color", "var(--panel-bg)"]]], ['.group-aria-checked\\:text-accent:is(:where(.group)[aria-checked="true"] *), .group-aria-\\[checked\\=false\\]\\:text-accent:is(:where(.group)[aria-checked="false"] *)', null, 4, [["color", "var(--accent)"]]], [".placeholder\\:text-subtext-0::placeholder", null, 4, [["color", "var(--subtext-0)"]]], [".before\\:absolute:before", null, 4, [["content", "var(--tw-content)"], ["position", "absolute"]]], [".before\\:top-\\[0\\.15rem\\]:before", null, 4, [["content", "var(--tw-content)"], ["top", ".15rem"]]], [".before\\:left-\\[0\\.15rem\\]:before", null, 4, [["content", "var(--tw-content)"], ["left", ".15rem"]]], [".before\\:h-\\[0\\.95rem\\]:before", null, 4, [["content", "var(--tw-content)"], ["height", ".95rem"]]], [".before\\:w-\\[0\\.95rem\\]:before", null, 4, [["content", "var(--tw-content)"], ["width", ".95rem"]]], [".before\\:rounded-full:before", null, 4, [["content", "var(--tw-content)"], ["border-radius", "3.40282e38px"]]], [".before\\:bg-fg:before", null, 4, [["content", "var(--tw-content)"], ["background-color", "var(--text)"]]], [".before\\:content-\\[\\'\\'\\]:before", null, 4, [["--tw-content", '""'], ["content", "var(--tw-content)"]]], [".before\\:\\[transition\\:transform_0\\.12s_ease\\]:before", null, 4, [["content", "var(--tw-content)"], ["transition", "transform .12s"]]], [".after\\:absolute:after", null, 4, [["content", "var(--tw-content)"], ["position", "absolute"]]], [".after\\:inset-0:after", null, 4, [["content", "var(--tw-content)"], ["inset", "0"]]], [".after\\:inset-x-0:after", null, 4, [["content", "var(--tw-content)"], ["inset-inline", "0"]]], [".after\\:-inset-y-2:after", null, 4, [["content", "var(--tw-content)"], ["inset-block", "calc(var(--spacing) * -2)"]]], [".after\\:m-auto:after", null, 4, [["content", "var(--tw-content)"], ["margin", "auto"]]], [".after\\:h-8:after", null, 4, [["content", "var(--tw-content)"], ["height", "calc(var(--spacing) * 8)"]]], [".after\\:h-12:after", null, 4, [["content", "var(--tw-content)"], ["height", "calc(var(--spacing) * 12)"]]], [".after\\:h-\\[3px\\]:after", null, 4, [["content", "var(--tw-content)"], ["height", "3px"]]], [".after\\:w-8:after", null, 4, [["content", "var(--tw-content)"], ["width", "calc(var(--spacing) * 8)"]]], [".after\\:w-\\[3px\\]:after", null, 4, [["content", "var(--tw-content)"], ["width", "3px"]]], [".after\\:rounded-full:after", null, 4, [["content", "var(--tw-content)"], ["border-radius", "3.40282e38px"]]], [".after\\:bg-transparent:after", null, 4, [["content", "var(--tw-content)"], ["background-color", "#0000"]]], [".after\\:content-\\[\\'\\'\\]:after", null, 4, [["--tw-content", '""'], ["content", "var(--tw-content)"]]], [".last\\:border-b-0:last-child", null, 4, [["border-bottom-style", "var(--tw-border-style)"], ["border-bottom-width", "0"]]], [".checked\\:bg-accent:checked", null, 4, [["background-color", "var(--accent)"]]], [".checked\\:before\\:translate-x-\\[1rem\\]:checked:before", null, 4, [["content", "var(--tw-content)"], ["--tw-translate-x", "1rem"], ["translate", "var(--tw-translate-x) var(--tw-translate-y)"]]], [".checked\\:before\\:bg-panel-bg:checked:before", null, 4, [["content", "var(--tw-content)"], ["background-color", "var(--panel-bg)"]]], [".focus-within\\:bg-surface-1:focus-within", null, 4, [["background-color", "var(--surface-1)"]]], [".focus-within\\:outline:focus-within, .focus-within\\:outline-1:focus-within", null, 4, [["outline-style", "var(--tw-outline-style)"], ["outline-width", "1px"]]], [".focus-within\\:outline-fg:focus-within", null, 4, [["outline-color", "var(--text)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_12\\%\\,transparent\\)\\]:hover", null, 4, [["background-color", "var(--accent)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_12\\%\\,transparent\\)\\]:hover", null, 4, [["background-color", "color-mix(in srgb,var(--accent) 12%,transparent)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_15\\%\\,transparent\\)\\]:hover", null, 4, [["background-color", "var(--accent)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_15\\%\\,transparent\\)\\]:hover", null, 4, [["background-color", "color-mix(in srgb,var(--accent) 15%,transparent)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--text\\)_10\\%\\,var\\(--panel-bg\\)\\)\\]:hover", null, 4, [["background-color", "var(--text)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--text\\)_10\\%\\,var\\(--panel-bg\\)\\)\\]:hover", null, 4, [["background-color", "color-mix(in srgb,var(--text) 10%,var(--panel-bg))"]]], [".hover\\:bg-\\[var\\(--surface-0\\)\\]:hover", null, 4, [["background-color", "var(--surface-0)"]]], [".hover\\:bg-accent:hover", null, 4, [["background-color", "var(--accent)"]]], [".hover\\:bg-overlay-0:hover", null, 4, [["background-color", "var(--overlay-0)"]]], [".hover\\:bg-panel-bg:hover", null, 4, [["background-color", "var(--panel-bg)"]]], [".hover\\:bg-surface-0:hover", null, 4, [["background-color", "var(--surface-0)"]]], [".hover\\:bg-surface-1:hover", null, 4, [["background-color", "var(--surface-1)"]]], [".hover\\:bg-transparent:hover", null, 4, [["background-color", "#0000"]]], [".hover\\:text-accent:hover", null, 4, [["color", "var(--accent)"]]], [".hover\\:text-fg:hover", null, 4, [["color", "var(--text)"]]], [".hover\\:text-inherit:hover", null, 4, [["color", "inherit"]]], [".hover\\:text-overlay-0:hover", null, 4, [["color", "var(--overlay-0)"]]], [".hover\\:text-panel-bg:hover", null, 4, [["color", "var(--panel-bg)"]]], [".hover\\:text-red:hover", null, 4, [["color", "var(--red)"]]], [".hover\\:text-subtext-0:hover", null, 4, [["color", "var(--subtext-0)"]]], [".hover\\:text-yellow:hover", null, 4, [["color", "var(--yellow)"]]], [".hover\\:underline:hover", null, 4, [["text-decoration-line", "underline"]]], [".hover\\:opacity-60:hover", null, 4, [["opacity", ".6"]]], [".hover\\:opacity-100\\!:hover", null, 4, [["opacity", "1", 1]]], [".hover\\:opacity-\\[0\\.85\\]:hover", null, 4, [["opacity", ".85"]]], [".hover\\:brightness-110:hover", null, 4, [["--tw-brightness", "brightness(110%)"], ["filter", "var(--tw-blur, ) var(--tw-brightness, ) var(--tw-contrast, ) var(--tw-grayscale, ) var(--tw-hue-rotate, ) var(--tw-invert, ) var(--tw-saturate, ) var(--tw-sepia, ) var(--tw-drop-shadow, )"]]], [".hover\\:\\[filter\\:brightness\\(1\\.08\\)\\]:hover", null, 4, [["filter", "brightness(1.08)"]]], [".hover\\:after\\:bg-overlay-1:hover:after", null, 4, [["content", "var(--tw-content)"], ["background-color", "var(--overlay-1)"]]], [".focus\\:\\[outline\\:1px_solid_var\\(--accent\\)\\]:focus", null, 4, [["outline", "1px solid var(--accent)"]]], [".focus\\:outline-2:focus", null, 4, [["outline-style", "var(--tw-outline-style)"], ["outline-width", "2px"]]], [".focus\\:outline-none:focus", null, 4, [["--tw-outline-style", "none"], ["outline-style", "none"]]], [".focus-visible\\:bg-accent:focus-visible", null, 4, [["background-color", "var(--accent)"]]], [".focus-visible\\:bg-surface-0:focus-visible", null, 4, [["background-color", "var(--surface-0)"]]], [".focus-visible\\:bg-surface-1:focus-visible", null, 4, [["background-color", "var(--surface-1)"]]], [".focus-visible\\:text-accent:focus-visible", null, 4, [["color", "var(--accent)"]]], [".focus-visible\\:text-fg:focus-visible", null, 4, [["color", "var(--text)"]]], [".focus-visible\\:text-panel-bg:focus-visible", null, 4, [["color", "var(--panel-bg)"]]], [".focus-visible\\:text-red:focus-visible", null, 4, [["color", "var(--red)"]]], [".focus-visible\\:text-yellow:focus-visible", null, 4, [["color", "var(--yellow)"]]], [".focus-visible\\:underline:focus-visible", null, 4, [["text-decoration-line", "underline"]]], [".focus-visible\\:opacity-100:focus-visible", null, 4, [["opacity", "1"]]], [".focus-visible\\:\\[outline\\:1px_solid_var\\(--accent\\)\\]:focus-visible", null, 4, [["outline", "1px solid var(--accent)"]]], [".focus-visible\\:\\[outline\\:1px_solid_var\\(--overlay-1\\)\\]:focus-visible", null, 4, [["outline", "1px solid var(--overlay-1)"]]], [".focus-visible\\:\\[outline\\:2px_solid_var\\(--accent\\)\\]:focus-visible", null, 4, [["outline", "2px solid var(--accent)"]]], [".focus-visible\\:outline:focus-visible, .focus-visible\\:outline-1:focus-visible", null, 4, [["outline-style", "var(--tw-outline-style)"], ["outline-width", "1px"]]], [".focus-visible\\:\\[outline-offset\\:-1px\\]:focus-visible", null, 4, [["outline-offset", "-1px"]]], [".focus-visible\\:\\[outline-offset\\:-2px\\]:focus-visible", null, 4, [["outline-offset", "-2px"]]], [".focus-visible\\:\\[outline-offset\\:2px\\]:focus-visible", null, 4, [["outline-offset", "2px"]]], [".focus-visible\\:outline-offset-1:focus-visible", null, 4, [["outline-offset", "1px"]]], [".focus-visible\\:outline-fg:focus-visible", null, 4, [["outline-color", "var(--text)"]]], [".focus-visible\\:after\\:bg-accent:focus-visible:after", null, 4, [["content", "var(--tw-content)"], ["background-color", "var(--accent)"]]], [".active\\:cursor-grabbing:active", null, 4, [["cursor", "grabbing"]]], [".active\\:bg-surface-1:active", null, 4, [["background-color", "var(--surface-1)"]]], [".active\\:text-fg:active", null, 4, [["color", "var(--text)"]]], [".active\\:after\\:bg-accent:active:after", null, 4, [["content", "var(--tw-content)"], ["background-color", "var(--accent)"]]], [".enabled\\:hover\\:bg-surface-1:enabled:hover", null, 4, [["background-color", "var(--surface-1)"]]], [".enabled\\:hover\\:text-fg:enabled:hover", null, 4, [["color", "var(--text)"]]], [".disabled\\:cursor-default:disabled", null, 4, [["cursor", "default"]]], [".disabled\\:cursor-not-allowed:disabled", null, 4, [["cursor", "not-allowed"]]], [".disabled\\:cursor-not-allowed\\!:disabled", null, 4, [["cursor", "not-allowed", 1]]], [".disabled\\:cursor-wait:disabled", null, 4, [["cursor", "wait"]]], [".disabled\\:bg-transparent:disabled", null, 4, [["background-color", "#0000"]]], [".disabled\\:text-fg:disabled", null, 4, [["color", "var(--text)"]]], [".disabled\\:opacity-40:disabled", null, 4, [["opacity", ".4"]]], [".disabled\\:opacity-50:disabled", null, 4, [["opacity", ".5"]]], [".disabled\\:opacity-\\[0\\.45\\]:disabled", null, 4, [["opacity", ".45"]]], [".disabled\\:opacity-\\[0\\.55\\]:disabled", null, 4, [["opacity", ".55"]]], [":where(.app--mac-desktop) .in-\\[\\.app--mac-desktop\\]\\:pl-\\[84px\\]", null, 4, [["padding-left", "84px"]]], [".has-\\[\\:checked\\]\\:bg-surface-0:has(:checked)", null, 4, [["background-color", "var(--surface-0)"]]], [".has-\\[\\:checked\\]\\:text-fg:has(:checked)", null, 4, [["color", "var(--text)"]]], [".has-\\[\\:focus-visible\\]\\:bg-surface-0:has(:focus-visible)", null, 4, [["background-color", "var(--surface-0)"]]], ['.aria-disabled\\:cursor-not-allowed[aria-disabled="true"]', null, 4, [["cursor", "not-allowed"]]], ['.aria-disabled\\:opacity-40[aria-disabled="true"]', null, 4, [["opacity", ".4"]]], ['.aria-expanded\\:opacity-100[aria-expanded="true"]', null, 4, [["opacity", "1"]]], ['.aria-pressed\\:bg-surface-0[aria-pressed="true"]', null, 4, [["background-color", "var(--surface-0)"]]], ['.aria-pressed\\:text-fg[aria-pressed="true"]', null, 4, [["color", "var(--text)"]]], [".motion-reduce\\:animate-none", ["(prefers-reduced-motion: reduce)"], 4, [["animation", "none"]]], [".max-\\[900px\\]\\:hidden", ["not all and (min-width: 900px)"], 4, [["display", "none"]]], [".max-\\[700px\\]\\:hidden", ["not all and (min-width: 700px)"], 4, [["display", "none"]]], [".max-\\[700px\\]\\:size-11", ["not all and (min-width: 700px)"], 4, [["width", "calc(var(--spacing) * 11)"], ["height", "calc(var(--spacing) * 11)"]]], [".max-\\[700px\\]\\:h-9", ["not all and (min-width: 700px)"], 4, [["height", "calc(var(--spacing) * 9)"]]], [".max-\\[700px\\]\\:h-12", ["not all and (min-width: 700px)"], 4, [["height", "calc(var(--spacing) * 12)"]]], [".max-\\[700px\\]\\:min-h-9", ["not all and (min-width: 700px)"], 4, [["min-height", "calc(var(--spacing) * 9)"]]], [".max-\\[700px\\]\\:min-h-11", ["not all and (min-width: 700px)"], 4, [["min-height", "calc(var(--spacing) * 11)"]]], [".max-\\[700px\\]\\:w-24", ["not all and (min-width: 700px)"], 4, [["width", "calc(var(--spacing) * 24)"]]], [".max-\\[700px\\]\\:min-w-11", ["not all and (min-width: 700px)"], 4, [["min-width", "calc(var(--spacing) * 11)"]]], [".max-\\[700px\\]\\:flex-1", ["not all and (min-width: 700px)"], 4, [["flex", "1"]]], [".max-\\[700px\\]\\:flex-\\[1_1_6rem\\]", ["not all and (min-width: 700px)"], 4, [["flex", "6rem"]]], [".max-\\[700px\\]\\:flex-\\[1_1_100\\%\\]", ["not all and (min-width: 700px)"], 4, [["flex", "100%"]]], [".max-\\[700px\\]\\:basis-56", ["not all and (min-width: 700px)"], 4, [["flex-basis", "calc(var(--spacing) * 56)"]]], [".max-\\[700px\\]\\:basis-full", ["not all and (min-width: 700px)"], 4, [["flex-basis", "100%"]]], [".max-\\[700px\\]\\:flex-wrap", ["not all and (min-width: 700px)"], 4, [["flex-wrap", "wrap"]]], [".max-\\[700px\\]\\:gap-y-2", ["not all and (min-width: 700px)"], 4, [["row-gap", "calc(var(--spacing) * 2)"]]], [".min-\\[701px\\]\\:left-auto", ["(min-width: 701px)"], 4, [["left", "auto"]]], [".min-\\[701px\\]\\:my-\\[3px\\]", ["(min-width: 701px)"], 4, [["margin-block", "3px"]]], [".min-\\[701px\\]\\:block", ["(min-width: 701px)"], 4, [["display", "block"]]], [".min-\\[701px\\]\\:hidden", ["(min-width: 701px)"], 4, [["display", "none"]]], [".min-\\[701px\\]\\:min-h-6", ["(min-width: 701px)"], 4, [["min-height", "calc(var(--spacing) * 6)"]]], [".min-\\[701px\\]\\:w-80", ["(min-width: 701px)"], 4, [["width", "calc(var(--spacing) * 80)"]]], [".min-\\[701px\\]\\:rounded-ui", ["(min-width: 701px)"], 4, [["border-radius", "var(--radius)"]]], [".min-\\[701px\\]\\:px-3", ["(min-width: 701px)"], 4, [["padding-inline", "calc(var(--spacing) * 3)"]]], [".min-\\[701px\\]\\:px-4", ["(min-width: 701px)"], 4, [["padding-inline", "calc(var(--spacing) * 4)"]]], [".min-\\[701px\\]\\:pr-\\[3px\\]", ["(min-width: 701px)"], 4, [["padding-right", "3px"]]], [".min-\\[701px\\]\\:pl-4", ["(min-width: 701px)"], 4, [["padding-left", "calc(var(--spacing) * 4)"]]], [".min-\\[701px\\]\\:text-\\[0\\.62rem\\]", ["(min-width: 701px)"], 4, [["font-size", ".62rem"]]], [".min-\\[701px\\]\\:text-\\[12\\.5px\\]", ["(min-width: 701px)"], 4, [["font-size", "12.5px"]]], [".min-\\[701px\\]\\:text-\\[12px\\]", ["(min-width: 701px)"], 4, [["font-size", "12px"]]], [".min-\\[701px\\]\\:font-medium", ["(min-width: 701px)"], 4, [["--tw-font-weight", "var(--font-weight-medium)"], ["font-weight", "var(--font-weight-medium)"]]], [".min-\\[701px\\]\\:font-semibold", ["(min-width: 701px)"], 4, [["--tw-font-weight", "var(--font-weight-semibold)"], ["font-weight", "var(--font-weight-semibold)"]]], [".min-\\[701px\\]\\:tracking-\\[0\\.045em\\]", ["(min-width: 701px)"], 4, [["--tw-tracking", ".045em"], ["letter-spacing", ".045em"]]], [".min-\\[701px\\]\\:text-subtext-0", ["(min-width: 701px)"], 4, [["color", "var(--subtext-0)"]]], [".min-\\[701px\\]\\:uppercase", ["(min-width: 701px)"], 4, [["text-transform", "uppercase"]]], [".min-\\[900px\\]\\:inline", ["(min-width: 900px)"], 4, [["display", "inline"]]], [".pointer-coarse\\:opacity-100", ["(pointer: coarse)"], 4, [["opacity", "1"]]], [".\\[\\&_\\.mode-switch\\]\\:ml-0 .mode-switch", null, 4, [["margin-left", "0"]]], [".max-\\[700px\\]\\:\\[\\&_button\\]\\:min-h-11 button", ["not all and (min-width: 700px)"], 4, [["min-height", "calc(var(--spacing) * 11)"]]], [".\\[\\&_pre\\]\\:m-\\[0\\.2rem_0_0\\.3rem_1\\.2rem\\] pre", null, 4, [["margin", ".2rem 0 .3rem 1.2rem"]]], [".\\[\\&_pre\\]\\:max-h-72 pre", null, 4, [["max-height", "calc(var(--spacing) * 72)"]]], [".\\[\\&_pre\\]\\:overflow-auto pre", null, 4, [["overflow", "auto"]]], [".\\[\\&_pre\\]\\:rounded-ui pre", null, 4, [["border-radius", "var(--radius)"]]], [".\\[\\&_pre\\]\\:bg-surface-0 pre", null, 4, [["background-color", "var(--surface-0)"]]], [".\\[\\&_pre\\]\\:p-2 pre", null, 4, [["padding", "calc(var(--spacing) * 2)"]]], [".\\[\\&_pre\\]\\:text-\\[0\\.78rem\\] pre", null, 4, [["font-size", ".78rem"]]], [".\\[\\&_pre\\]\\:\\[overflow-wrap\\:anywhere\\] pre", null, 4, [["overflow-wrap", "anywhere"]]], [".\\[\\&_pre\\]\\:whitespace-pre-wrap pre", null, 4, [["white-space", "pre-wrap"]]], [".\\[\\&_pre\\]\\:text-fg pre, .\\[\\&_strong\\]\\:text-fg strong", null, 4, [["color", "var(--text)"]]], [".\\[\\&_summary\\]\\:cursor-pointer summary", null, 4, [["cursor", "pointer"]]], [".\\[\\&\\:hover\\:not\\(\\:disabled\\)\\]\\:bg-surface-1:hover:not(:disabled)", null, 4, [["background-color", "var(--surface-1)"]]], [".\\[\\&\\:hover\\:not\\(\\:disabled\\)\\]\\:text-accent:hover:not(:disabled)", null, 4, [["color", "var(--accent)"]]], [".\\[\\&\\:hover\\:not\\(\\:disabled\\)\\]\\:text-red:hover:not(:disabled)", null, 4, [["color", "var(--red)"]]], [".\\[\\&\\:not\\(\\:has\\(\\[data-setting-row\\]\\)\\)\\>\\[data-none\\]\\]\\:block:not(:has([data-setting-row])) > [data-none]", null, 4, [["display", "block"]]], [".\\[\\&\\>\\*\\]\\:min-h-0 > *", null, 4, [["min-height", "0"]]], [".\\[\\&\\>\\*\\]\\:min-w-0 > *", null, 4, [["min-width", "0"]]], [".\\[\\&\\>\\*\\]\\:flex-1 > *", null, 4, [["flex", "1"]]], [".\\[\\&\\>\\*\\]\\:shrink-0 > *", null, 4, [["flex-shrink", "0"]]], [".\\[\\&\\>li\\]\\:text-\\[0\\.85rem\\] > li", null, 4, [["font-size", ".85rem"]]], [".\\[\\&\\>li\\]\\:leading-\\[1\\.5\\] > li", null, 4, [["--tw-leading", "1.5"], ["line-height", "1.5"]]], [".\\[\\&\\>li\\]\\:text-fg > li", null, 4, [["color", "var(--text)"]]], [".\\[\\&\\>summary\\]\\:flex > summary", null, 4, [["display", "flex"]]], [".\\[\\&\\>summary\\]\\:cursor-pointer > summary", null, 4, [["cursor", "pointer"]]], [".\\[\\&\\>summary\\]\\:list-none > summary", null, 4, [["list-style-type", "none"]]], [".\\[\\&\\>summary\\]\\:items-center > summary", null, 4, [["align-items", "center"]]], [".\\[\\&\\>summary\\]\\:gap-\\[0\\.4rem\\] > summary", null, 4, [["gap", ".4rem"]]], [".\\[\\&\\>summary\\]\\:rounded-ui > summary", null, 4, [["border-radius", "var(--radius)"]]], [".\\[\\&\\>summary\\]\\:px-\\[0\\.4rem\\] > summary", null, 4, [["padding-inline", ".4rem"]]], [".\\[\\&\\>summary\\]\\:py-\\[0\\.25rem\\] > summary", null, 4, [["padding-block", ".25rem"]]], [".\\[\\&\\>summary\\]\\:select-none > summary", null, 4, [["-webkit-user-select", "none"], ["user-select", "none"]]], [".\\[\\&\\>summary\\]\\:before\\:inline-block > summary:before", null, 4, [["content", "var(--tw-content)"], ["display", "inline-block"]]], [".\\[\\&\\>summary\\]\\:before\\:size-\\[0\\.4rem\\] > summary:before", null, 4, [["content", "var(--tw-content)"], ["width", ".4rem"], ["height", ".4rem"]]], [".\\[\\&\\>summary\\]\\:before\\:shrink-0 > summary:before", null, 4, [["content", "var(--tw-content)"], ["flex-shrink", "0"]]], [".\\[\\&\\>summary\\]\\:before\\:\\[transform\\:rotate\\(-45deg\\)\\] > summary:before", null, 4, [["content", "var(--tw-content)"], ["transform", "rotate(-45deg)"]]], [".\\[\\&\\>summary\\]\\:before\\:content-\\[\\'\\'\\] > summary:before", null, 4, [["--tw-content", '""'], ["content", "var(--tw-content)"]]], [".\\[\\&\\>summary\\]\\:before\\:\\[border-bottom\\:1\\.3px_solid_currentColor\\] > summary:before", null, 4, [["content", "var(--tw-content)"], ["border-bottom", "1.3px solid"]]], [".\\[\\&\\>summary\\]\\:before\\:\\[border-right\\:1\\.3px_solid_currentColor\\] > summary:before", null, 4, [["content", "var(--tw-content)"], ["border-right", "1.3px solid"]]], [".\\[\\&\\>summary\\]\\:before\\:\\[transition\\:transform_0\\.15s_ease\\] > summary:before", null, 4, [["content", "var(--tw-content)"], ["transition", "transform .15s"]]], [".\\[\\&\\>summary\\:hover\\]\\:bg-surface-1 > summary:hover", null, 4, [["background-color", "var(--surface-1)"]]], [".\\[\\&\\>summary\\:hover\\]\\:text-fg > summary:hover", null, 4, [["color", "var(--text)"]]], [".\\[\\&\\[open\\]\\>summary\\]\\:before\\:\\[transform\\:rotate\\(45deg\\)\\][open] > summary:before", null, 4, [["content", "var(--tw-content)"], ["transform", "rotate(45deg)"]]], [".app--mobile .\\[\\.app--mobile_\\&\\]\\:min-h-11", null, 4, [["min-height", "calc(var(--spacing) * 11)"]]], [".app--mobile .\\[\\.app--mobile_\\&\\]\\:min-h-\\[44px\\]", null, 4, [["min-height", "44px"]]], [".\\[\\@media\\(hover\\:none\\)\\]\\:opacity-60", ["(hover: none)"], 4, [["opacity", ".6"]]], [".\\[\\@media\\(hover\\:none\\)\\]\\:opacity-100", ["(hover: none)"], 4, [["opacity", "1"]]], [".\\[\\@media\\(max-width\\:700px\\)\\]\\:h-\\[2\\.75rem\\]", ["(max-width: 700px)"], 4, [["height", "2.75rem"]]], [".\\[\\@media\\(max-width\\:700px\\)\\]\\:min-h-\\[2\\.75rem\\]", ["(max-width: 700px)"], 4, [["min-height", "2.75rem"]]], [".\\[\\@media\\(max-width\\:700px\\)\\]\\:w-\\[2\\.75rem\\]", ["(max-width: 700px)"], 4, [["width", "2.75rem"]]], [".\\[\\@media\\(max-width\\:700px\\)\\]\\:min-w-\\[2\\.75rem\\]", ["(max-width: 700px)"], 4, [["min-width", "2.75rem"]]], [".\\[\\@media\\(max-width\\:700px\\)\\]\\:px-\\[0\\.65rem\\]", ["(max-width: 700px)"], 4, [["padding-inline", ".65rem"]]], ["div:hover > .\\[div\\:hover\\>\\&\\]\\:opacity-100", null, 4, [["opacity", "1"]]], [":root", null, 1e3, [["color-scheme", "dark"], ["--scrollbar-size", "6px"], ["--accent", "#c8c8c8"], ["--panel-bg", "#161616"], ["--surface-0", "#262626"], ["--surface-1", "#333"], ["--surface-dim", "#1c1c1c"], ["--backdrop", "#050505"], ["--overlay-0", "#3a3a3a"], ["--overlay-1", "#9b9b9b"], ["--text", "#d8d8d8"], ["--subtext-0", "#9b9b9b"], ["--mauve", "#a993c9"], ["--green", "#7fb685"], ["--yellow", "#d3b46a"], ["--red", "#df8c8c"], ["--blue", "#7aa2d7"], ["--teal", "#7fb8b8"], ["--peach", "#d39a6a"], ["--bg", "var(--panel-bg)"], ["--surface", "var(--surface-0)"], ["--surface-alt", "var(--surface-1)"], ["--border", "var(--overlay-0)"], ["--muted", "var(--subtext-0)"], ["--danger", "var(--red)"], ["--radius", "8px"], ["--radius-pane", "8px"], ["accent-color", "var(--accent)"], ["--font-ui", '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif'], ["--font-mono", `ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono",
    monospace`], ["font-family", "var(--font-ui)"]]], ["code, pre, kbd, samp", null, 1e3, [["font-family", "var(--font-mono)"]]], ["*", null, 1e3, [["box-sizing", "border-box"]]], ["html, body, #root", null, 1e3, [["height", "100%"], ["margin", "0"]]], ["html", null, 1e3, [["overscroll-behavior", "none"], ["--shell-bg", "var(--panel-bg)"]]], ["html[data-glass]", null, 1e3, [["--shell-bg", "var(--panel-bg)"]]], ["html[data-glass]", null, 1e3, [["--shell-bg", "color-mix(in srgb, var(--panel-bg) 86%, transparent)"]]], ["html", null, 1e3, [["--backdrop-bg", "var(--backdrop)"], ["--card-bg", "var(--panel-bg)"]]], ["html[data-glass]", null, 1e3, [["--backdrop-bg", "var(--backdrop)"]]], ["html[data-glass]", null, 1e3, [["--backdrop-bg", "color-mix(in srgb, var(--backdrop) 86%, transparent)"]]], ["html[data-glass]", null, 1e3, [["--card-bg", "var(--panel-bg)"]]], ["html[data-glass]", null, 1e3, [["--card-bg", "color-mix(in srgb, var(--panel-bg) 86%, transparent)"]]], ['body:has(.app--cards, .app--mobile), .app--cards .dock-area:has([data-testid="split-canvas"]:not([data-split="0"]))', null, 1e3, [["background", "var(--backdrop-bg)"]]], ["body", null, 1e3, [["background", "var(--shell-bg)"], ["color", "var(--text)"], ["overscroll-behavior", "none"], ["-webkit-tap-highlight-color", "transparent"], ["line-height", "1.3"]]], [".app", null, 1e3, [["flex-direction", "column"], ["height", "100dvh"], ["display", "flex"]]], [".app--mobile", null, 1e3, [["inset", "var(--visible-top, 0px) 0 auto 0"], ["height", "var(--visible-height, 100dvh)"], ["position", "fixed"]]], [".mobile-drawer-backdrop", null, 1e3, [["animation", ".15s ease-out mobile-fade"]]], [".mobile-drawer--left", null, 1e3, [["animation", ".2s cubic-bezier(.2, .8, .2, 1) mobile-slide-left"]]], [".mobile-drawer--right", null, 1e3, [["animation", ".2s cubic-bezier(.2, .8, .2, 1) mobile-slide-right"]]], [".mobile-sheet", null, 1e3, [["animation", ".22s cubic-bezier(.2, .8, .2, 1) mobile-rise"]]], [".mobile-drawer-backdrop, .mobile-drawer, .mobile-sheet", ["(prefers-reduced-motion: reduce)"], 1e3, [["animation", "none"]]], [".layout-drawer", null, 1e3, [["transform", "translateX(var(--float-hide, 0))"], ["transition", "transform .18s"]]], [".layout-drawer:hover, .layout-drawer:focus-within", null, 1e3, [["--float-hide", "0px"]]], [".dockview-theme-perch", null, 1e3, [["--dv-color-abyss-dark", "var(--panel-bg)"], ["--dv-color-abyss", "var(--surface-0)"], ["--dv-color-abyss-light", "var(--surface-1)"], ["--dv-color-abyss-lighter", "var(--overlay-0)"], ["--dv-color-abyss-accent", "var(--accent)"], ["--dv-color-abyss-primary-text", "var(--text)"], ["--dv-color-abyss-secondary-text", "var(--subtext-0)"], ["--dv-group-view-background-color", "var(--panel-bg)"], ["--dv-tabs-and-actions-container-background-color", "var(--surface-0)"], ["--dv-activegroup-visiblepanel-tab-background-color", "var(--panel-bg)"], ["--dv-activegroup-hiddenpanel-tab-background-color", "var(--surface-0)"], ["--dv-inactivegroup-visiblepanel-tab-background-color", "var(--panel-bg)"], ["--dv-inactivegroup-hiddenpanel-tab-background-color", "var(--surface-0)"], ["--dv-tab-divider-color", "var(--overlay-0)"], ["--dv-activegroup-visiblepanel-tab-color", "var(--text)"], ["--dv-activegroup-hiddenpanel-tab-color", "var(--subtext-0)"], ["--dv-inactivegroup-visiblepanel-tab-color", "var(--subtext-0)"], ["--dv-inactivegroup-hiddenpanel-tab-color", "var(--subtext-0)"], ["--dv-separator-border", "var(--overlay-0)"], ["--dv-paneview-header-border-color", "var(--overlay-0)"], ["--dv-tabs-and-actions-container-font-size", ".82rem"], ["--dv-tabs-and-actions-container-height", "2.1rem"]]], [".dockview-theme-perch .dv-tabs-and-actions-container", null, 1e3, [["z-index", "1"], ["position", "relative"]]], [".pane-tab", null, 1e3, [["align-items", "center"], ["width", "100%"], ["height", "100%"], ["display", "flex"]]], [".pane-tab__agent-badge", null, 1e3, [["color", "var(--subtext-0)"], ["white-space", "nowrap"], ["flex-shrink", "0"], ["margin-right", ".4rem"], ["font-size", ".78em"]]], ['.pane-tab[data-testid="pane-tab-chat"] .dv-default-tab-action', null, 1e3, [["display", "none"]]], [".dockview-group-action", null, 1e3, [["border-radius", "var(--radius)"], ["width", "1.5rem"], ["height", "1.5rem"], ["color", "var(--subtext-0)"], ["cursor", "pointer"], ["background", "none"], ["border", "none"], ["justify-content", "center"], ["align-self", "center"], ["align-items", "center"], ["margin", "0 .15rem"], ["font-size", "1rem"], ["line-height", "1"], ["transition", "color .1s, background .1s"], ["display", "flex"]]], [".dockview-group-action:hover", null, 1e3, [["color", "var(--text)"], ["background", "var(--surface-1)"]]], [".dockview-theme-perch .dv-view-container > .dv-view:has(.dv-inactive-group)", ["(max-width: 700px)"], 1e3, [["display", "none"]]], [".dockview-theme-perch .dv-view-container > .dv-view:has(.dv-active-group)", ["(max-width: 700px)"], 1e3, [["width", "100%", 1], ["left", "0", 1]]], [".chat", null, 1e3, [["isolation", "isolate"], ["flex-direction", "column"], ["flex", "1"], ["height", "100%"], ["min-height", "0"], ["display", "flex"]]], [".message__markdown p", null, 1e3, [["margin", "0 0 .5em"]]], [".message__markdown p:last-child", null, 1e3, [["margin-bottom", "0"]]], [".message__markdown h1, .message__markdown h2, .message__markdown h3, .message__markdown h4", null, 1e3, [["margin", ".6em 0 .3em"], ["line-height", "1.25"]]], [".message__markdown h1", null, 1e3, [["font-size", "1.25em"]]], [".message__markdown h2", null, 1e3, [["font-size", "1.12em"]]], [".message__markdown h3", null, 1e3, [["font-size", "1em"]]], [".message__markdown > * + *", null, 1e3, [["margin-top", ".5em"]]], [".message__markdown table, .md-table", null, 1e3, [["border-collapse", "separate"], ["border-spacing", "0"], ["background", "var(--surface-0)"], ["border-radius", "var(--radius)"], ["max-width", "100%"], ["margin", ".5em 0"], ["font-size", ".92em"], ["display", "block"], ["overflow-x", "auto"]]], [".md-table", null, 1e3, [["width", "100%"], ["margin", "0"], ["display", "table"]]], [".message__markdown th, .message__markdown td, .md-table th, .md-table td", null, 1e3, [["text-align", "left"], ["vertical-align", "top"], ["border-bottom", "1px solid var(--surface-1)"], ["padding", ".35em .75em"]]], [".message__markdown th, .md-table th", null, 1e3, [["color", "var(--subtext-0)"], ["white-space", "nowrap"], ["background", "var(--surface-1)"], ["font-weight", "600"]]], [".message__markdown tbody tr:last-child td, .md-table tbody tr:last-child td", null, 1e3, [["border-bottom", "0"]]], [".message__markdown tbody tr:hover td, .md-table tbody tr:hover td", null, 1e3, [["background", "var(--surface-1)"]]], [".md-table caption", null, 1e3, [["text-align", "left"], ["color", "var(--subtext-0)"], ["padding", ".4em .75em"]]], [".md-code", null, 1e3, [["background", "var(--surface-0)"], ["border-radius", "var(--radius)"], ["overflow", "hidden"]]], [".md-code__bar", null, 1e3, [["color", "var(--subtext-0)"], ["background", "var(--surface-1)"], ["justify-content", "space-between"], ["align-items", "center"], ["padding", ".1rem .4rem .1rem .75rem"], ["font-size", ".75em"], ["display", "flex"]]], [".message__markdown .md-code pre", null, 1e3, [["background", "none"], ["border-radius", "0"], ["margin", "0"]]], [".hl-keyword", null, 1e3, [["color", "var(--mauve)"]]], [".hl-string", null, 1e3, [["color", "var(--green)"]]], [".hl-number", null, 1e3, [["color", "var(--peach)"]]], [".hl-function", null, 1e3, [["color", "var(--blue)"]]], [".hl-type", null, 1e3, [["color", "var(--yellow)"]]], [".hl-tag", null, 1e3, [["color", "var(--teal)"]]], [".hl-comment", null, 1e3, [["color", "var(--overlay-1)"], ["font-style", "italic"]]], [".message__markdown ul, .message__markdown ol", null, 1e3, [["margin", ".3em 0 .5em 1.3em"], ["padding", "0"]]], [".message__markdown li", null, 1e3, [["margin-bottom", ".2em"]]], [".message__markdown code", null, 1e3, [["background", "var(--surface-0)"], ["border-radius", ".25rem"], ["padding", ".1em .35em"], ["font-family", "ui-monospace, SFMono-Regular, SF Mono, Menlo, Consolas, monospace"], ["font-size", ".88em"]]], [".message__markdown pre", null, 1e3, [["background", "var(--surface-0)"], ["border-radius", "var(--radius)"], ["margin", ".4em 0"], ["padding", ".6rem .75rem"], ["position", "relative"], ["overflow-x", "auto"]]], [".message__markdown pre code", null, 1e3, [["background", "none"], ["border", "none"], ["padding", "0"], ["font-size", ".85em"]]], [".message__markdown a", null, 1e3, [["color", "var(--accent)"], ["text-decoration", "underline"]]], [".message__markdown blockquote", null, 1e3, [["border-left", "3px solid var(--overlay-0)"], ["color", "var(--subtext-0)"], ["margin", ".4em 0"], ["padding", ".1em .6em"]]], [".message__markdown hr", null, 1e3, [["border", "none"], ["border-top", "1px solid var(--overlay-0)"], ["margin", ".75em 0"]]], [".file-markdown", null, 1e3, [["overflow-wrap", "anywhere"]]], [".file-markdown img", null, 1e3, [["max-width", "100%"]]], [".file-markdown table", null, 1e3, [["border-collapse", "collapse"], ["margin", ".4em 0"], ["display", "block"], ["overflow-x", "auto"]]], [".file-markdown th, .file-markdown td", null, 1e3, [["border", "1px solid var(--overlay-0)"], ["padding", ".2em .5em"]]], [".file-markdown .md-placeholder", null, 1e3, [["color", "var(--subtext-0)"], ["border", "1px dashed var(--overlay-0)"], ["border-radius", ".25rem"], ["padding", ".05em .35em"], ["font-size", ".9em"]]], [".terminal", null, 1e3, [["min-width", "0"], ["min-height", "0"], ["padding", "var(--terminal-padding, 0)"], ["opacity", "var(--terminal-opacity, 1)"], ["flex", "1"], ["display", "flex"], ["position", "relative"]]], [".terminal__surface", null, 1e3, [["flex", "1"], ["min-width", "0"], ["min-height", "0"], ["overflow", "hidden"]]], [".terminal__surface .xterm", null, 1e3, [["height", "100%"]]], [".terminal__surface .xterm:not(.allow-transparency) .xterm-viewport", null, 1e3, [["background-color", "#0000"]]], [".terminal__surface .xterm-scrollable-element", null, 1e3, [["position", "static", 1]]], [".terminal__surface .xterm-decoration-overview-ruler, .no-pane-scrollbars .terminal__surface .xterm-scrollable-element > .xterm-scrollbar", null, 1e3, [["display", "none"]]], [".terminal--persistent", null, 1e3, [["flex-direction", "column"]]], [".terminal__toolbar", null, 1e3, [["color", "var(--subtext-0)"], ["align-items", "center"], ["gap", ".5rem"], ["padding", ".25rem 1.5rem .25rem .5rem"], ["font-size", ".8rem"], ["display", "flex"]]], [".terminal__toolbar button", null, 1e3, [["border-radius", "var(--radius)"], ["min-height", "32px"], ["color", "var(--text)"], ["background", "var(--surface-0)"], ["border", "0"], ["padding", ".25rem .5rem"]]], [".terminal__toolbar--overlay", null, 1e3, [["z-index", "2"], ["border-radius", "var(--radius)"], ["background", "var(--surface-1)"], ["padding", ".2rem .3rem .2rem .6rem"], ["position", "absolute"], ["top", ".4rem"], ["right", ".9rem"], ["box-shadow", "0 2px 8px #00000040"]]], [".terminal__connection", null, 1e3, [["margin-right", "auto"]]], [".terminal__toolbar button:disabled", null, 1e3, [["opacity", ".5"]]], [".terminal__notice", null, 1e3, [["color", "var(--subtext-0)"], ["padding", ".75rem"], ["font-size", ".85rem"]]], [".app--mobile .terminal__toolbar button", null, 1e3, [["min-height", "44px"]]], [".app--mobile .terminal__connection", null, 1e3, [["display", "none"]]], [".app--mobile .terminal__toolbar", null, 1e3, [["padding-right", ".5rem"]]], [".terminal__exited", null, 1e3, [["background", "var(--surface-1)"], ["border-radius", "var(--radius)"], ["color", "var(--subtext-0)"], ["padding", ".35rem .75rem"], ["font-size", ".85rem"], ["position", "absolute"], ["bottom", ".75rem"], ["left", "50%"], ["transform", "translateX(-50%)"]]], [".terminal__exited--cli", null, 1e3, [["background", "var(--panel-bg)"], ["flex-direction", "column"], ["align-items", "center"], ["gap", ".6rem"], ["padding", ".9rem 1.1rem"], ["display", "flex"], ["top", "50%"], ["bottom", "auto"], ["transform", "translate(-50%, -50%)"], ["box-shadow", "0 6px 24px #00000059"]]], [".terminal__exited-actions", null, 1e3, [["gap", ".5rem"], ["display", "flex"]]], [".terminal__cli-error", null, 1e3, [["background", "var(--red)"], ["position", "absolute"], ["bottom", ".75rem"], ["left", "50%"], ["transform", "translateX(-50%)"]]], [".terminal__cli-error", null, 1e3, [["background", "color-mix(in srgb, var(--red) 20%, var(--panel-bg))"]]], [".terminal__cli-error", null, 1e3, [["border-radius", "var(--radius)"], ["color", "var(--red)"], ["text-align", "center"], ["white-space", "pre-wrap"], ["word-break", "break-word"], ["max-width", "90%"], ["padding", ".35rem .75rem"], ["font-size", ".85rem"]]], [".mobile-pane-shell__content > .chat, .mobile-pane-shell__content > .terminal, .mobile-pane-shell__content > .workspace-files, .mobile-pane-shell__content > .workspace-git", null, 1e3, [["flex", "1"], ["width", "100%"], ["min-width", "0"], ["height", "100%"], ["min-height", "0"]]], [".terminal__host", null, 1e3, [["width", "100%"], ["height", "100%"], ["overflow", "hidden"]]], [".workspace-git", null, 1e3, [["--git-border", "var(--overlay-0)"]]], [".workspace-git", null, 1e3, [["--git-border", "color-mix(in srgb, var(--overlay-0) 72%, transparent)"]]], [".workspace-git", null, 1e3, [["--git-muted", "var(--subtext-0)"], ["width", "100%"], ["min-width", "0"], ["height", "100%"], ["min-height", "0"], ["color", "var(--text)"], ["background", "var(--workspace-tools-bg, var(--panel-bg))"], ["flex-direction", "column"], ["font-size", ".78rem"], ["display", "flex"], ["position", "relative"], ["overflow", "hidden"], ["container-type", "inline-size"]]], [".workspace-git button, .workspace-git input, .workspace-git textarea", null, 1e3, [["font", "inherit"]]], [".workspace-git button", null, 1e3, [["cursor", "pointer"]]], ['.workspace-git button:focus-visible, .workspace-git input:focus-visible, .workspace-git textarea:focus-visible, .workspace-git [role="button"]:focus-visible', null, 1e3, [["outline", "2px solid var(--accent)"], ["outline-offset", "1px"]]], [".workspace-git__diff", null, 1e3, [["container-type", "inline-size"]]], [".workspace-git__line-comment-thread", null, 1e3, [["max-width", "max(0px, min(42rem, 100cqi - 6.9rem))"], ["position", "sticky"], ["left", "0"]]], [".workspace-git__comment-composer", null, 1e3, [["max-width", "max(0px, 100cqi - 1.4rem)"], ["position", "sticky"], ["left", "0"]]], [".dockview-group-action--split-session", null, 1e3, [["font-size", "13px"]]], [".session-split-popover", null, 1e3, [["display", "flex"], ["flex-direction", "column"], ["background", "var(--surface-1)"], ["border-radius", "var(--radius)"], ["box-shadow", "0 8px 24px rgba(0, 0, 0, 0.45)"], ["padding", "4px"], ["font-size", "12.5px"], ["color", "var(--text)"], ["overflow", "hidden"]]], [".session-split-popover__header", null, 1e3, [["padding", "6px 8px 4px"], ["font-size", "11px"], ["text-transform", "uppercase"], ["letter-spacing", "0.04em"], ["color", "var(--subtext-0)"]]], [".session-split-popover__empty", null, 1e3, [["padding", "8px"], ["color", "var(--subtext-0)"]]], [".session-split-popover__list", null, 1e3, [["overflow-y", "auto"]]], [".session-split-popover__item", null, 1e3, [["display", "flex"], ["flex-direction", "column"], ["align-items", "flex-start"], ["gap", "1px"], ["width", "100%"], ["padding", "6px 8px"], ["border", "none"], ["border-radius", "4px"], ["background", "transparent"], ["color", "inherit"], ["text-align", "left"], ["cursor", "grab"]]], [".session-split-popover__item:hover", null, 1e3, [["background", "var(--surface-0)"]]], [".session-split-popover__item-title", null, 1e3, [["font-weight", "500"], ["white-space", "nowrap"], ["overflow", "hidden"], ["text-overflow", "ellipsis"], ["max-width", "100%"]]], [".session-split-popover__item-cwd", null, 1e3, [["font-size", "11px"], ["color", "var(--subtext-0)"], ["white-space", "nowrap"], ["overflow", "hidden"], ["text-overflow", "ellipsis"], ["max-width", "100%"]]], [".session-split-popover__item-badge", null, 1e3, [["align-self", "flex-end"], ["font-size", "10px"], ["color", "var(--accent)"], ["margin-top", "-14px"]]], [".inactive-session-pane", null, 1e3, [["display", "flex"], ["flex-direction", "column"], ["align-items", "center"], ["justify-content", "center"], ["gap", "10px"], ["height", "100%"], ["padding", "24px"], ["text-align", "center"], ["color", "var(--subtext-0)"]]], [".inactive-session-pane__title", null, 1e3, [["font-size", "14px"], ["font-weight", "500"], ["color", "var(--text)"]]], [".inactive-session-pane__cwd", null, 1e3, [["font-size", "12px"], ["color", "var(--subtext-0)"], ["word-break", "break-all"]]], [".inactive-session-pane__note", null, 1e3, [["font-size", "12px"], ["max-width", "320px"], ["line-height", "1.5"]]], [".inactive-session-pane__switch", null, 1e3, [["margin-top", "4px"], ["padding", "6px 14px"], ["border-radius", "var(--radius)"], ["border", "0"], ["background", "var(--surface-0)"], ["color", "var(--text)"], ["cursor", "pointer"], ["font-size", "12.5px"]]], [".inactive-session-pane__switch:hover", null, 1e3, [["background", "var(--surface-1)"]]]], skipped: { "@supports evaluated false": 2, "@container": 6, "@keyframes": 9 }, digest: "1b693a483c1992d8" };
//! The app's compiled stylesheet as a table (`build.mjs` writes it from Vite + Tailwind's output and bundles it as
//! `virtual:perch-css-table`), parsed once on first use.
const Pa = globalThis[Symbol.for("perch.styleSheets")] ??= /* @__PURE__ */ new Map();
let Bl = null;
function i1() {
  return Bl || (Bl = Ia.digest && Pa.get(Ia.digest) || new mb(Ia), Ia.digest && !Pa.has(Ia.digest) && (Pa.size >= 4 && Pa.delete(Pa.keys().next().value), Pa.set(Ia.digest, Bl)), Bl);
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
let xa = Kl.NoEventPriority;
function s1(n, a) {
  const r = /* @__PURE__ */ new Set([...Object.keys(n), ...Object.keys(a)]);
  for (const i of r) {
    if (i === "children") continue;
    const s = n[i], c = a[i];
    if (!(s === c || typeof s == "function" && typeof c == "function") && !(i === "style" && s && c && typeof s == "object" && typeof c == "object" && [.../* @__PURE__ */ new Set([...Object.keys(s), ...Object.keys(c)])].every((d) => s[d] === c[d])))
      return !0;
  }
  return !1;
}
const o1 = (n) => !n.props.disabled && (/^(button|input|select|textarea)$/.test(n.tagName) || n.tagName === "a" && n.props.href != null || n.props.tabIndex != null);
function ep(n, a) {
  for (const r of M0(a.dangerouslySetInnerHTML?.__html, n.ownerDocument) ?? []) n.appendChild(r);
  return n;
}
const c1 = {
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
  createInstance: (n, a, r) => ep(new Xe(n, a, r.ownerDocument), a),
  createTextInstance: (n, a) => new Oi(n),
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
      ep(n, i);
    }
    s1(r, i) && n.touch();
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
  resolveUpdatePriority: () => xa !== Kl.NoEventPriority ? xa : Kl.DefaultEventPriority,
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
}, At = P0(c1), Jl = (n, a, r = null) => At.createPortal(n, a, null, r), u1 = {
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
}, d1 = /* @__PURE__ */ new Set(["click", "dblclick", "mousedown", "mouseup"]), f1 = /* @__PURE__ */ new Set(["button", "input", "select", "textarea", "fieldset"]), p1 = (n) => {
  for (let a = n; a instanceof Xe; a = a.parentNode) if (a.props.disabled && f1.has(a.tagName)) return !0;
  return !1;
};
class m1 {
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
function ti(n, a, r) {
  a.currentTarget = n;
  for (const { type: i, listener: s, capture: c } of [...n.listeners ?? []])
    i === a.type && c === r && s.call(n, a);
  if (n instanceof Xe) {
    const i = u1[a.type], s = i && n.props[r ? `${i}Capture` : i];
    typeof s == "function" && s(a);
  }
}
function v4(n, a, r = {}) {
  const { document: i, window: s, globals: c } = B0(n), f = new Xe("div", { id: "root", style: r.container ?? {} }, i);
  i.body.appendChild(f);
  const d = [];
  let m = null;
  const g = () => [i, s].map((T) => T.listeners.map((h) => `${h.type}:${h.capture}`).sort().join(",")).join("|");
  let y = "";
  const v = {}, b = `m${Math.random().toString(36).slice(2, 10)}:`;
  let S = 0, E = -1;
  i.measureKey = (T) => b + T.id, i.stale = () => E !== S, i.computed = (T) => {
    if (!v.cascade || !v.top) return null;
    const h = [];
    for (let k = T; k instanceof Xe && k !== i.body; k = k.parentNode) h.unshift(k);
    let w = v.top;
    for (const k of h) w = v.cascade.compute(k, w);
    return w.values;
  };
  const j = () => (S += 1, m = r1(i, n, i1(), v, r.names), y = g(), n.render?.(m), m), z = () => {
    At.flushPassiveEffects(), At.flushSyncWork(), g() !== y && j();
  };
  i.afterCommit = j;
  const R = (T) => {
    d.push(T), n.error?.(T);
  }, O = At.createContainer(f, Kl.ConcurrentRoot, null, !1, null, "", R, R, R, null);
  At.updateContainerSync(Q.createElement(a, r.props ?? {}), O, null, null), At.flushSyncWork(), z();
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
  }, X = (T) => {
    const h = xa;
    xa = Kl.DiscreteEventPriority;
    try {
      return T();
    } finally {
      xa = h, At.flushSyncWork(), z();
    }
  }, $ = {
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
    describe: j,
    /** Runs a DOM event of `type` at node `id`; false when the node is gone. */
    dispatch(T, h, w = {}) {
      const k = typeof T == "string" ? H(T) : T;
      if (!k || d1.has(h) && p1(k)) return !1;
      const _ = new m1(h, w, k), C = [];
      for (let L = k; L; L = h === "scroll" ? null : L.parentNode) C.push(L);
      const N = [...C, i, s];
      X(() => {
        for (let L = N.length - 1; L > 0 && !_.propagationStopped; L--) ti(N[L], _, !0);
        _.propagationStopped || (ti(k, _, !0), _.propagationStopped || ti(k, _, !1));
        for (let L = 1; L < N.length && !_.propagationStopped; L++) ti(N[L], _, !1);
      });
      const D = h === "click" && !_.defaultPrevented ? Yo(k) : null;
      if (D && $.dispatch(D, "submit", {}), h === "click" && !_.defaultPrevented)
        for (let L = k; L; L = L.parentNode) {
          if (L.tagName !== "a") continue;
          const W = L.props?.href;
          typeof W == "string" && /^https:\/\/\S+$/.test(W) && n.openLink?.(W);
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
      if (!$.dispatch(h, "keydown", T)) return !0;
      const k = T.key === "Enter" && !T.isComposing ? Yo(h, !0) : null;
      if (k)
        return $.dispatch(k, "submit", {}), !0;
      if (!qp(h) || h.props.disabled || h.props.readOnly) return !1;
      if ((T.ctrlKey || T.metaKey) && !T.altKey && !T.shiftKey && T.key.toLowerCase() === "a")
        return h.selectedAll = !0, !0;
      if (T.ctrlKey || T.metaKey) return !1;
      const _ = h.selectedAll;
      h.selectedAll = !1;
      const C = h.value, D = T.key === "Backspace" || _ && T.key === "Delete" ? _ ? "" : C.slice(0, -1) : [...T.key].length === 1 ? (_ ? "" : C) + T.key : C;
      return D === C ? !1 : (h.value = D, $.dispatch(h, "input", { data: T.key }), $.dispatch(h, "change", {}), h.props.value !== void 0 && delete h.edit, h.touch(), j(), !0);
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
      if (!h || h.props.disabled || !$.dispatch(T, "click", { button: 0, detail: 1 })) return;
      const w = h.props.type === "radio";
      w && h.checked || (h.checked = w ? !0 : !h.checked, $.dispatch(T, "input", {}), $.dispatch(T, "change", {}), h.props.checked !== void 0 && delete h.ticked, h.touch(), j());
    },
    /** A left click as the engine reports one: press then release on the same node. */
    click(T, h = {}) {
      const w = { button: 0, buttons: 1, pointerType: "mouse", ...h };
      for (const k of ["pointerdown", "mousedown", "pointerup", "mouseup", "click"]) $.dispatch(T, k, w);
    },
    /** The pointer entered (`on`) or left node `id` (one the description marks `track_hover`): its `:hover` state,
     * which a descendant's group variant reads. The element's own `hover:` styles are the engine's hover style. */
    /** Whether the pointer is over node `id`, as `hover` last said. */
    hovered: (T) => !!H(T)?.state.hover,
    hover(T, h) {
      const w = H(T);
      !w || w.state.hover === h || (w.state.hover = h, w.touch(), j());
    },
    focus(T) {
      const h = H(T);
      h && (X(() => {
        const w = i.activeElement;
        w && w !== h && w !== i.body && $.dispatch(w, "blur"), i.focus(h), $.dispatch(h, "focus");
      }), j());
    },
    /** A press at node `id` that nothing prevented: the browser's default focuses the element pressed. Only an element
     * that listens for keys (`onKeyDown`) is focused, so a press elsewhere leaves the keyboard where it was; the focus
     * is not `:focus-visible`, as after a pointer press in a browser. */
    // ponytail: a browser focuses every focusable element pressed; here only one with its own key handler, so a
    // screen's ordinary buttons do not take the keyboard from a terminal.
    pressFocus(T) {
      let w = typeof T == "string" ? H(T) : T;
      for (; w && !(w instanceof Xe && typeof w.props.onKeyDown == "function" && o1(w)); ) w = w.parentNode;
      !w || w === i.activeElement || ($.focus(w.id), w.state.pointerFocus = !0, w.touch(), j());
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
      At.updateContainerSync(Q.createElement(a, T ?? {}), O, null, null), At.flushSyncWork(), z();
    },
    unmount() {
      At.updateContainerSync(null, O, null, null), At.flushSyncWork(), At.flushPassiveEffects(), i.afterCommit = null, i.retries.length = 0, n.forgetBounds?.(b);
    }
  };
  return $;
}
//! `react-dom` for a screen on the native renderer: `createPortal` (into `document.body`, the overlay layer) and
//! `flushSync`. Nothing of the browser renderer.
const em = (n) => At.flushSyncFromReconciler(n), h1 = { createPortal: Jl, flushSync: em }, y4 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  createPortal: Jl,
  default: h1,
  flushSync: em
}, Symbol.toStringTag, { value: "Module" }));
function tm(n) {
  var a, r, i = "";
  if (typeof n == "string" || typeof n == "number") i += n;
  else if (typeof n == "object") if (Array.isArray(n)) {
    var s = n.length;
    for (a = 0; a < s; a++) n[a] && (r = tm(n[a])) && (i && (i += " "), i += r);
  } else for (r in n) n[r] && (i && (i += " "), i += r);
  return i;
}
function nm() {
  for (var n, a, r = 0, i = "", s = arguments.length; r < s; r++) (n = arguments[r]) && (a = tm(n)) && (i && (i += " "), i += a);
  return i;
}
const g1 = (n, a) => {
  const r = new Array(n.length + a.length);
  for (let i = 0; i < n.length; i++)
    r[i] = n[i];
  for (let i = 0; i < a.length; i++)
    r[n.length + i] = a[i];
  return r;
}, b1 = (n, a) => ({
  classGroupId: n,
  validator: a
}), am = (n = /* @__PURE__ */ new Map(), a = null, r) => ({
  nextPart: n,
  validators: a,
  classGroupId: r
}), zi = "-", tp = [], v1 = "arbitrary..", y1 = (n) => {
  const a = w1(n), {
    conflictingClassGroups: r,
    conflictingClassGroupModifiers: i
  } = n;
  return {
    getClassGroupId: (f) => {
      if (f.startsWith("[") && f.endsWith("]"))
        return x1(f);
      const d = f.split(zi), m = d[0] === "" && d.length > 1 ? 1 : 0;
      return lm(d, m, a);
    },
    getConflictingClassGroupIds: (f, d) => {
      if (d) {
        const m = i[f], g = r[f];
        return m ? g ? g1(g, m) : m : g || tp;
      }
      return r[f] || tp;
    }
  };
}, lm = (n, a, r) => {
  if (n.length - a === 0)
    return r.classGroupId;
  const s = n[a], c = r.nextPart.get(s);
  if (c) {
    const g = lm(n, a + 1, c);
    if (g) return g;
  }
  const f = r.validators;
  if (f === null)
    return;
  const d = a === 0 ? n.join(zi) : n.slice(a).join(zi), m = f.length;
  for (let g = 0; g < m; g++) {
    const y = f[g];
    if (y.validator(d))
      return y.classGroupId;
  }
}, x1 = (n) => n.slice(1, -1).indexOf(":") === -1 ? void 0 : (() => {
  const a = n.slice(1, -1), r = a.indexOf(":"), i = a.slice(0, r);
  return i ? v1 + i : void 0;
})(), w1 = (n) => {
  const {
    theme: a,
    classGroups: r
  } = n;
  return k1(r, a);
}, k1 = (n, a) => {
  const r = am();
  for (const i in n) {
    const s = n[i];
    hc(s, r, i, a);
  }
  return r;
}, hc = (n, a, r, i) => {
  const s = n.length;
  for (let c = 0; c < s; c++) {
    const f = n[c];
    _1(f, a, r, i);
  }
}, _1 = (n, a, r, i) => {
  if (typeof n == "string") {
    S1(n, a, r);
    return;
  }
  if (typeof n == "function") {
    E1(n, a, r, i);
    return;
  }
  z1(n, a, r, i);
}, S1 = (n, a, r) => {
  const i = n === "" ? a : rm(a, n);
  i.classGroupId = r;
}, E1 = (n, a, r, i) => {
  if (N1(n)) {
    hc(n(i), a, r, i);
    return;
  }
  a.validators === null && (a.validators = []), a.validators.push(b1(r, n));
}, z1 = (n, a, r, i) => {
  const s = Object.entries(n), c = s.length;
  for (let f = 0; f < c; f++) {
    const [d, m] = s[f];
    hc(m, rm(a, d), r, i);
  }
}, rm = (n, a) => {
  let r = n;
  const i = a.split(zi), s = i.length;
  for (let c = 0; c < s; c++) {
    const f = i[c];
    let d = r.nextPart.get(f);
    d || (d = am(), r.nextPart.set(f, d)), r = d;
  }
  return r;
}, N1 = (n) => "isThemeGetter" in n && n.isThemeGetter === !0, T1 = (n) => {
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
}, Jo = "!", np = ":", C1 = [], ap = (n, a, r, i, s) => ({
  modifiers: n,
  hasImportantModifier: a,
  baseClassName: r,
  maybePostfixModifierPosition: i,
  isExternal: s
}), A1 = (n) => {
  const {
    prefix: a,
    experimentalParseClassName: r
  } = n;
  let i = (s) => {
    const c = [];
    let f = 0, d = 0, m = 0, g;
    const y = s.length;
    for (let j = 0; j < y; j++) {
      const z = s[j];
      if (f === 0 && d === 0) {
        if (z === np) {
          c.push(s.slice(m, j)), m = j + 1;
          continue;
        }
        if (z === "/") {
          g = j;
          continue;
        }
      }
      z === "[" ? f++ : z === "]" ? f-- : z === "(" ? d++ : z === ")" && d--;
    }
    const v = c.length === 0 ? s : s.slice(m);
    let b = v, S = !1;
    v.endsWith(Jo) ? (b = v.slice(0, -1), S = !0) : (
      /**
       * In Tailwind CSS v3 the important modifier was at the start of the base class name. This is still supported for legacy reasons.
       * @see https://github.com/dcastil/tailwind-merge/issues/513#issuecomment-2614029864
       */
      v.startsWith(Jo) && (b = v.slice(1), S = !0)
    );
    const E = g && g > m ? g - m : void 0;
    return ap(c, S, b, E);
  };
  if (a) {
    const s = a + np, c = i;
    i = (f) => f.startsWith(s) ? c(f.slice(s.length)) : ap(C1, !1, f, void 0, !0);
  }
  if (r) {
    const s = i;
    i = (c) => r({
      className: c,
      parseClassName: s
    });
  }
  return i;
}, M1 = (n) => {
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
}, R1 = (n) => ({
  cache: T1(n.cacheSize),
  parseClassName: A1(n),
  sortModifiers: M1(n),
  postfixLookupClassGroupIds: j1(n),
  ...y1(n)
}), j1 = (n) => {
  const a = /* @__PURE__ */ Object.create(null), r = n.postfixLookupClassGroups;
  if (r)
    for (let i = 0; i < r.length; i++)
      a[r[i]] = !0;
  return a;
}, O1 = /\s+/, D1 = (n, a) => {
  const {
    parseClassName: r,
    getClassGroupId: i,
    getConflictingClassGroupIds: s,
    sortModifiers: c,
    postfixLookupClassGroupIds: f
  } = a, d = [], m = n.trim().split(O1);
  let g = "";
  for (let y = m.length - 1; y >= 0; y -= 1) {
    const v = m[y], {
      isExternal: b,
      modifiers: S,
      hasImportantModifier: E,
      baseClassName: j,
      maybePostfixModifierPosition: z
    } = r(v);
    if (b) {
      g = v + (g.length > 0 ? " " + g : g);
      continue;
    }
    let R = !!z, O;
    if (R) {
      const h = j.substring(0, z);
      O = i(h);
      const w = O && f[O] ? i(j) : void 0;
      w && w !== O && (O = w, R = !1);
    } else
      O = i(j);
    if (!O) {
      if (!R) {
        g = v + (g.length > 0 ? " " + g : g);
        continue;
      }
      if (O = i(j), !O) {
        g = v + (g.length > 0 ? " " + g : g);
        continue;
      }
      R = !1;
    }
    const H = S.length === 0 ? "" : S.length === 1 ? S[0] : c(S).join(":"), X = E ? H + Jo : H, $ = X + O;
    if (d.indexOf($) > -1)
      continue;
    d.push($);
    const T = s(O, R);
    for (let h = 0; h < T.length; ++h) {
      const w = T[h];
      d.push(X + w);
    }
    g = v + (g.length > 0 ? " " + g : g);
  }
  return g;
}, B1 = (...n) => {
  let a = 0, r, i, s = "";
  for (; a < n.length; )
    (r = n[a++]) && (i = im(r)) && (s && (s += " "), s += i);
  return s;
}, im = (n) => {
  if (typeof n == "string")
    return n;
  let a, r = "";
  for (let i = 0; i < n.length; i++)
    n[i] && (a = im(n[i])) && (r && (r += " "), r += a);
  return r;
}, H1 = (n, ...a) => {
  let r, i, s, c;
  const f = (m) => {
    const g = a.reduce((y, v) => v(y), n());
    return r = R1(g), i = r.cache.get, s = r.cache.set, c = d, d(m);
  }, d = (m) => {
    const g = i(m);
    if (g)
      return g;
    const y = D1(m, r);
    return s(m, y), y;
  };
  return c = f, (...m) => c(B1(...m));
}, U1 = [], Fe = (n) => {
  const a = (r) => r[n] || U1;
  return a.isThemeGetter = !0, a.themeKey = n, a;
}, sm = /^\[(?:(\w[\w-]*):)?(.+)\]$/i, om = /^\((?:(\w[\w-]*):)?(.+)\)$/i, q1 = /^\d+(?:\.\d+)?\/\d+(?:\.\d+)?$/, L1 = /^(\d+(\.\d+)?)?(xs|sm|md|lg|xl)$/, G1 = /\d+(%|px|r?em|[sdl]?v([hwib]|min|max)|pt|pc|in|cm|mm|cap|ch|ex|r?lh|cq(w|h|i|b|min|max))|\b(calc|min|max|clamp)\(.+\)|^0$/, Y1 = /^(rgba?|hsla?|hwb|(ok)?(lab|lch)|color-mix|color|light-dark)\(.+\)$/, Q1 = /^(inset_)?-?((\d+)?\.?(\d+)[a-z]+|0)_-?((\d+)?\.?(\d+)[a-z]+|0)/, V1 = /^(url|image|image-set|cross-fade|element|(repeating-)?(linear|radial|conic)-gradient)\(.+\)$/, Gn = (n) => q1.test(n), ve = (n) => !!n && !Number.isNaN(Number(n)), en = (n) => !!n && Number.isInteger(Number(n)), Ro = (n) => n.endsWith("%") && ve(n.slice(0, -1)), xn = (n) => L1.test(n), cm = () => !0, K1 = (n) => (
  // `colorFunctionRegex` check is necessary because color functions can have percentages in them which which would be incorrectly classified as lengths.
  // For example, `hsl(0 0% 0%)` would be classified as a length without this check.
  // I could also use lookbehind assertion in `lengthUnitRegex` but that isn't supported widely enough.
  G1.test(n) && !Y1.test(n)
), gc = () => !1, Z1 = (n) => Q1.test(n), X1 = (n) => V1.test(n), J1 = (n) => !re(n) && !ie(n), $1 = (n) => n.startsWith("@container") && (n[10] === "/" && n[11] !== void 0 || n[11] === "s" && n[16] !== void 0 && n.startsWith("-size/", 10) || n[11] === "n" && n[18] !== void 0 && n.startsWith("-normal/", 10)), W1 = (n) => Jn(n, fm, gc), re = (n) => sm.test(n), ha = (n) => Jn(n, pm, K1), lp = (n) => Jn(n, lv, ve), F1 = (n) => Jn(n, hm, cm), I1 = (n) => Jn(n, mm, gc), rp = (n) => Jn(n, um, gc), P1 = (n) => Jn(n, dm, X1), ni = (n) => Jn(n, gm, Z1), ie = (n) => om.test(n), Hl = (n) => _a(n, pm), ev = (n) => _a(n, mm), ip = (n) => _a(n, um), tv = (n) => _a(n, fm), nv = (n) => _a(n, dm), ai = (n) => _a(n, gm, !0), av = (n) => _a(n, hm, !0), Jn = (n, a, r) => {
  const i = sm.exec(n);
  return i ? i[1] ? a(i[1]) : r(i[2]) : !1;
}, _a = (n, a, r = !1) => {
  const i = om.exec(n);
  return i ? i[1] ? a(i[1]) : r : !1;
}, um = (n) => n === "position" || n === "percentage", dm = (n) => n === "image" || n === "url", fm = (n) => n === "length" || n === "size" || n === "bg-size", pm = (n) => n === "length", lv = (n) => n === "number", mm = (n) => n === "family-name", hm = (n) => n === "number" || n === "weight", gm = (n) => n === "shadow", rv = () => {
  const n = Fe("color"), a = Fe("font"), r = Fe("text"), i = Fe("font-weight"), s = Fe("tracking"), c = Fe("leading"), f = Fe("breakpoint"), d = Fe("container"), m = Fe("spacing"), g = Fe("radius"), y = Fe("shadow"), v = Fe("inset-shadow"), b = Fe("text-shadow"), S = Fe("drop-shadow"), E = Fe("blur"), j = Fe("perspective"), z = Fe("aspect"), R = Fe("ease"), O = Fe("animate"), H = () => ["auto", "avoid", "all", "avoid-page", "page", "left", "right", "column"], X = () => [
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
  ], $ = () => [...X(), ie, re], T = () => ["auto", "hidden", "clip", "visible", "scroll"], h = () => ["auto", "contain", "none"], w = () => [ie, re, m], k = () => [Gn, "full", "auto", ...w()], _ = () => [en, "none", "subgrid", ie, re], C = () => ["auto", {
    span: ["full", en, ie, re]
  }, en, ie, re], N = () => [en, "auto", ie, re], D = () => ["auto", "min", "max", "fr", ie, re], L = () => ["start", "end", "center", "between", "around", "evenly", "stretch", "baseline", "center-safe", "end-safe"], W = () => ["start", "end", "center", "stretch", "center-safe", "end-safe"], q = () => ["auto", ...w()], Z = () => [Gn, "auto", "full", "dvw", "dvh", "lvw", "lvh", "svw", "svh", "min", "max", "fit", ...w()], I = () => [d, Gn, "screen", "full", "dvw", "lvw", "svw", "min", "max", "fit", ...w()], V = () => [Gn, "screen", "full", "lh", "dvh", "lvh", "svh", "min", "max", "fit", ...w()], K = () => [n, ie, re], A = () => [...X(), ip, rp, {
    position: [ie, re]
  }], J = () => ["no-repeat", {
    repeat: ["", "x", "y", "space", "round"]
  }], ae = () => ["auto", "cover", "contain", tv, W1, {
    size: [ie, re]
  }], oe = () => [Ro, Hl, ha], ce = () => [
    // Deprecated since Tailwind CSS v4.0.0
    "",
    "none",
    "full",
    g,
    ie,
    re
  ], ue = () => ["", ve, Hl, ha], Ee = () => ["solid", "dashed", "dotted", "double"], Pe = () => ["normal", "multiply", "screen", "overlay", "darken", "lighten", "color-dodge", "color-burn", "hard-light", "soft-light", "difference", "exclusion", "hue", "saturation", "color", "luminosity"], he = () => [ve, Ro, ip, rp], Wn = () => [
    // Deprecated since Tailwind CSS v4.0.0
    "",
    "none",
    E,
    ie,
    re
  ], Fn = () => ["none", ve, ie, re], qt = () => ["none", ve, ie, re], Lt = () => [ve, ie, re], kn = () => [Gn, "full", ...w()];
  return {
    cacheSize: 500,
    theme: {
      animate: ["spin", "ping", "pulse", "bounce"],
      aspect: ["video"],
      blur: [xn],
      breakpoint: [xn],
      color: [cm],
      container: [xn],
      "drop-shadow": [xn],
      ease: ["in", "out", "in-out"],
      font: [J1],
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
        aspect: ["auto", "square", Gn, re, ie, z]
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
      "container-named": [$1],
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
        object: $()
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
        justify: [...L(), "normal"]
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
        content: ["normal", ...L()]
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
        "place-content": L()
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
        size: Z()
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
        block: ["auto", ...V()]
      }],
      /**
       * Min-Block Size
       * @see https://tailwindcss.com/docs/min-block-size
       */
      "min-block-size": [{
        "min-block": ["auto", ...V()]
      }],
      /**
       * Max-Block Size
       * @see https://tailwindcss.com/docs/max-block-size
       */
      "max-block-size": [{
        "max-block": ["none", ...V()]
      }],
      /**
       * Width
       * @see https://tailwindcss.com/docs/width
       */
      w: [{
        w: [d, "screen", ...Z()]
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
          ...Z()
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
        font: [i, av, F1]
      }],
      /**
       * Font Stretch
       * @see https://tailwindcss.com/docs/font-stretch
       */
      "font-stretch": [{
        "font-stretch": ["ultra-condensed", "extra-condensed", "condensed", "semi-condensed", "normal", "semi-expanded", "expanded", "extra-expanded", "ultra-expanded", Ro, re]
      }],
      /**
       * Font Family
       * @see https://tailwindcss.com/docs/font-family
       */
      "font-family": [{
        font: [ev, I1, a]
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
        "line-clamp": [ve, "none", ie, lp]
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
        decoration: K()
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
        }, nv, P1]
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
          y,
          ai,
          ni
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
        "inset-shadow": ["none", v, ai, ni]
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
        ring: K()
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
        "ring-offset": K()
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
        "inset-ring": K()
      }],
      /**
       * Text Shadow
       * @see https://tailwindcss.com/docs/text-shadow
       */
      "text-shadow": [{
        "text-shadow": ["none", b, ai, ni]
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
        opacity: [ve, ie, re]
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
        "mask-linear": [ve]
      }],
      "mask-image-linear-from-pos": [{
        "mask-linear-from": he()
      }],
      "mask-image-linear-to-pos": [{
        "mask-linear-to": he()
      }],
      "mask-image-linear-from-color": [{
        "mask-linear-from": K()
      }],
      "mask-image-linear-to-color": [{
        "mask-linear-to": K()
      }],
      "mask-image-t-from-pos": [{
        "mask-t-from": he()
      }],
      "mask-image-t-to-pos": [{
        "mask-t-to": he()
      }],
      "mask-image-t-from-color": [{
        "mask-t-from": K()
      }],
      "mask-image-t-to-color": [{
        "mask-t-to": K()
      }],
      "mask-image-r-from-pos": [{
        "mask-r-from": he()
      }],
      "mask-image-r-to-pos": [{
        "mask-r-to": he()
      }],
      "mask-image-r-from-color": [{
        "mask-r-from": K()
      }],
      "mask-image-r-to-color": [{
        "mask-r-to": K()
      }],
      "mask-image-b-from-pos": [{
        "mask-b-from": he()
      }],
      "mask-image-b-to-pos": [{
        "mask-b-to": he()
      }],
      "mask-image-b-from-color": [{
        "mask-b-from": K()
      }],
      "mask-image-b-to-color": [{
        "mask-b-to": K()
      }],
      "mask-image-l-from-pos": [{
        "mask-l-from": he()
      }],
      "mask-image-l-to-pos": [{
        "mask-l-to": he()
      }],
      "mask-image-l-from-color": [{
        "mask-l-from": K()
      }],
      "mask-image-l-to-color": [{
        "mask-l-to": K()
      }],
      "mask-image-x-from-pos": [{
        "mask-x-from": he()
      }],
      "mask-image-x-to-pos": [{
        "mask-x-to": he()
      }],
      "mask-image-x-from-color": [{
        "mask-x-from": K()
      }],
      "mask-image-x-to-color": [{
        "mask-x-to": K()
      }],
      "mask-image-y-from-pos": [{
        "mask-y-from": he()
      }],
      "mask-image-y-to-pos": [{
        "mask-y-to": he()
      }],
      "mask-image-y-from-color": [{
        "mask-y-from": K()
      }],
      "mask-image-y-to-color": [{
        "mask-y-to": K()
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
        mask: A()
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
          S,
          ai,
          ni
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
        ease: ["linear", "initial", R, ie, re]
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
        perspective: [j, ie, re]
      }],
      /**
       * Perspective Origin
       * @see https://tailwindcss.com/docs/perspective-origin
       */
      "perspective-origin": [{
        "perspective-origin": $()
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
        origin: $()
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
        fill: ["none", ...K()]
      }],
      /**
       * Stroke Width
       * @see https://tailwindcss.com/docs/stroke-width
       */
      "stroke-w": [{
        stroke: [ve, Hl, ha, lp]
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
}, iv = /* @__PURE__ */ H1(rv);
function Oe(...n) {
  return iv(nm(n));
}
function sv(n, a, r) {
  return n.filter((i, s) => s !== a && (i.start + i.end) / 2 < r).length;
}
function ov(n, a, r, i) {
  const s = n.map(() => 0), c = n[a];
  if (!c) return s;
  const f = n[a + 1], d = n[a - 1], m = c.end - c.start + (f ? f.start - c.end : d ? c.start - d.end : 0);
  return n.forEach((g, y) => {
    a < r && y > a && y <= r ? s[y] = -m : r < a && y >= r && y < a && (s[y] = m);
  }), s[a] = Math.min(Math.max(i, n[0].start - c.start), n[n.length - 1].end - c.end), s;
}
const sp = ["transform", "transition", "zIndex", "filter", "pointerEvents", "position"];
function cv(n, a) {
  for (let r = n.parentElement; r; r = r.parentElement) {
    const i = getComputedStyle(r)[a === "x" ? "overflowX" : "overflowY"];
    if ((i === "auto" || i === "scroll") && (a === "x" ? r.scrollWidth > r.clientWidth : r.scrollHeight > r.clientHeight)) return r;
  }
  return null;
}
function uv(n, a, r, i) {
  const s = n[a] ? cv(n[a], r) : null, c = () => s ? r === "x" ? s.scrollLeft : s.scrollTop : 0, f = (z) => (r === "x" ? z.clientX : z.clientY) + c(), d = f(i), m = c(), g = n.map((z) => {
    const R = z.getBoundingClientRect();
    return r === "x" ? { start: R.left + m, end: R.right + m } : { start: R.top + m, end: R.bottom + m };
  }), y = n.map((z) => sp.map((R) => z.style[R])), v = typeof matchMedia == "function" && matchMedia("(prefers-reduced-motion: reduce)").matches, b = r === "x" ? "translateX" : "translateY";
  let S = !1;
  const E = { to: a };
  n.forEach((z, R) => {
    if (z.style.pointerEvents = "none", R !== a) {
      v || (z.style.transition = "transform 160ms cubic-bezier(0.2, 0.8, 0.2, 1)");
      return;
    }
    getComputedStyle(z).position === "static" && (z.style.position = "relative"), z.style.zIndex = "30", z.style.filter = "drop-shadow(0 6px 10px rgba(0, 0, 0, 0.45))";
  });
  const j = (z, R) => {
    E.to = z, ov(g, a, z, R).forEach((O, H) => {
      n[H].style.transform = O ? `${b}(${O}px)` : "";
    });
  };
  return {
    from: a,
    get to() {
      return E.to;
    },
    slot: (z) => sv(g, a, f(z)),
    apply: (z, R) => {
      S || j(z, f(R) - d);
    },
    rest: () => {
      S || j(a, 0);
    },
    end: () => {
      S || (S = !0, n.forEach((z, R) => sp.forEach((O, H) => {
        z.style[O] = y[R][H];
      })));
    }
  };
}
const dv = 5;
let jo = !1;
function fv(n, a) {
  if (n.button !== 0 || jo) return;
  const r = { clientX: n.clientX, clientY: n.clientY }, i = n.currentTarget, s = n.pointerId;
  let c = null, f, d = !1;
  const m = { cursor: document.body.style.cursor, userSelect: document.body.style.userSelect }, g = (E) => {
    if (d) return;
    d = !0, window.removeEventListener("pointermove", y), window.removeEventListener("pointerup", v), window.removeEventListener("pointercancel", b), window.removeEventListener("keydown", S, !0), window.removeEventListener("blur", b), i.removeEventListener("lostpointercapture", b);
    try {
      i.releasePointerCapture(s);
    } catch {
    }
    if (!c) return;
    jo = !1, document.body.style.cursor = m.cursor, document.body.style.userSelect = m.userSelect, c.end();
    const j = (z) => z.stopPropagation();
    window.addEventListener("click", j, { capture: !0, once: !0 }), setTimeout(() => window.removeEventListener("click", j, !0), 0), f?.(), a.onEnd(E, c);
  }, y = (E) => {
    if (!c) {
      if (Math.hypot(E.clientX - r.clientX, E.clientY - r.clientY) < dv) return;
      const j = a.items();
      c = uv(j, a.from(j), a.axis, r), jo = !0, document.body.style.cursor = "grabbing", document.body.style.userSelect = "none";
      try {
        i.setPointerCapture(s);
      } catch {
      }
      i.addEventListener("lostpointercapture", b);
      const z = a.onStart?.();
      f = typeof z == "function" ? z : void 0;
    }
    a.onMove(E, c);
  }, v = () => g(!0), b = () => g(!1), S = (E) => {
    E.key === "Escape" && (E.stopPropagation(), g(!1));
  };
  window.addEventListener("pointermove", y), window.addEventListener("pointerup", v), window.addEventListener("pointercancel", b), window.addEventListener("keydown", S, !0), window.addEventListener("blur", b);
}
const bm = typeof navigator < "u" && /Mac/i.test(navigator.platform), Ni = {
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
for (let n = 1; n <= 12; n++) Ni[`f${n}`] = `F${n}`;
const pv = Object.fromEntries(Object.entries(Ni).map(([n, a]) => [a, n])), mv = {
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
function hv(n) {
  const a = /^Key([A-Z])$/.exec(n) ?? /^Digit(\d)$/.exec(n);
  return a ? a[1].toLowerCase() : pv[n];
}
const op = /* @__PURE__ */ new Map();
function vm(n, a = bm) {
  const r = `${a}|${n}`, i = op.get(r);
  if (i) return i;
  const s = { cmd: !1, ctrl: !1, shift: !1, alt: !1, code: "" };
  for (const c of n.split("+"))
    if (c === "mod")
      a ? s.cmd = !0 : (s.ctrl = !0, s.shift = !0);
    else if (c === "cmd" || c === "ctrl" || c === "shift" || c === "alt") s[c] = !0;
    else if (/^[a-z]$/.test(c))
      s.code = `Key${c.toUpperCase()}`, s.letter = c;
    else if (/^[0-9]$/.test(c)) s.code = `Digit${c}`;
    else if (Ni[c]) s.code = Ni[c];
    else throw new Error(`unknown key "${c}" in "${n}"`);
  if (!s.code) throw new Error(`no key in "${n}"`);
  return op.set(r, s), s;
}
new Set(["cmd+q", "cmd+h", "cmd+alt+h", "cmd+m", "cmd+ctrl+f", "cmd+z", "cmd+shift+z", "cmd+x", "cmd+c", "cmd+v", "cmd+a"].map((n) => {
  const a = vm(n, !0);
  return [a.cmd && "cmd", a.ctrl && "ctrl", a.alt && "alt", a.shift && "shift", a.code].filter(Boolean).join("+");
}));
function gv(n, a = bm) {
  const r = vm(n, a), i = bv(hv(r.code) ?? "");
  return a ? `${r.ctrl ? "⌃" : ""}${r.alt ? "⌥" : ""}${r.shift ? "⇧" : ""}${r.cmd ? "⌘" : ""}${i}` : [r.ctrl && "Ctrl", r.alt && "Alt", r.shift && "Shift", i].filter(Boolean).join("+");
}
const bv = (n) => mv[n] ?? n.toUpperCase(), cp = (n) => typeof n == "boolean" ? `${n}` : n === 0 ? "0" : n, up = nm, Bi = (n, a) => (r) => {
  var i;
  if (a?.variants == null) return up(n, r?.class, r?.className);
  const { variants: s, defaultVariants: c } = a, f = Object.keys(s).map((g) => {
    const y = r?.[g], v = c?.[g];
    if (y === null) return null;
    const b = cp(y) || cp(v);
    return s[g][b];
  }), d = r && Object.entries(r).reduce((g, y) => {
    let [v, b] = y;
    return b === void 0 || (g[v] = b), g;
  }, {}), m = a == null || (i = a.compoundVariants) === null || i === void 0 ? void 0 : i.reduce((g, y) => {
    let { class: v, className: b, ...S } = y;
    return Object.entries(S).every((E) => {
      let [j, z] = E;
      return Array.isArray(z) ? z.includes({
        ...c,
        ...d
      }[j]) : {
        ...c,
        ...d
      }[j] === z;
    }) ? [
      ...g,
      v,
      b
    ] : g;
  }, []);
  return up(n, f, m, r?.class, r?.className);
}, vv = Bi(
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
), yv = Bi(
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
function xv({ className: n, ...a } = {}) {
  return Oe(yv(a), n);
}
const ym = "shrink-0 cursor-pointer rounded-ui bg-transparent px-[0.2rem] py-[0.1rem] text-[0.8rem] leading-none text-subtext-0 [font-family:inherit] [border:none] [transition:color_0.1s_ease,background_0.1s_ease] hover:bg-surface-1 hover:text-accent", $l = "cursor-pointer rounded-ui bg-transparent text-subtext-0 [border:0] [font-family:inherit] [transition:color_0.1s_ease,background_0.1s_ease] hover:bg-surface-1 hover:text-fg focus-visible:bg-surface-1 focus-visible:text-fg disabled:cursor-not-allowed disabled:opacity-40", wv = Bi(`${$l} shrink-0 focus-visible:[outline:2px_solid_var(--accent)] focus-visible:[outline-offset:-2px]`, {
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
function kv({ className: n, ...a } = {}) {
  return Oe(wv(a), n);
}
const Hi = "overflow-hidden rounded-ui bg-surface-1 py-[0.3rem] shadow-[0_8px_24px_rgba(0,0,0,0.45)]", $o = Bi(
  "pane-context-menu__item block w-full cursor-pointer bg-transparent px-[0.9rem] py-[0.45rem] text-left text-[0.82rem] [border:none] [font-family:inherit] [transition:background_0.1s_ease] hover:bg-surface-0 disabled:cursor-not-allowed disabled:bg-transparent disabled:opacity-40",
  { variants: { danger: { true: "text-red", false: "text-fg" } }, defaultVariants: { danger: !1 } }
), _v = "my-1 h-px bg-overlay-0";
function Sv({ size: n = 14, className: a }) {
  return /* @__PURE__ */ te.jsxs("svg", { className: a, width: n, height: n, viewBox: "0 0 16 16", fill: "currentColor", "aria-hidden": "true", children: [
    /* @__PURE__ */ te.jsx("circle", { cx: "3.5", cy: "8", r: "1.1" }),
    /* @__PURE__ */ te.jsx("circle", { cx: "8", cy: "8", r: "1.1" }),
    /* @__PURE__ */ te.jsx("circle", { cx: "12.5", cy: "8", r: "1.1" })
  ] });
}
function Ev({ size: n = 16, className: a }) {
  return /* @__PURE__ */ te.jsxs("svg", { className: a, width: n, height: n, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: "1.3", strokeLinejoin: "round", "aria-hidden": "true", children: [
    /* @__PURE__ */ te.jsx("path", { d: "M6.6 1.8h2.8l.4 1.6 1.1.6 1.5-.6 1.4 2.4-1.2 1.1v1.3l1.2 1.1-1.4 2.4-1.5-.6-1.1.6-.4 1.6H6.6l-.4-1.6-1.1-.6-1.5.6-1.4-2.4 1.2-1.1V7.3L2.2 6.2l1.4-2.4 1.5.6 1.1-.6z" }),
    /* @__PURE__ */ te.jsx("circle", { cx: "8", cy: "8", r: "2" })
  ] });
}
function zv({ size: n = 14, className: a }) {
  return /* @__PURE__ */ te.jsx("svg", { className: a, width: n, height: n, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round", "aria-hidden": "true", children: /* @__PURE__ */ te.jsx("path", { d: "M3.5 3.5l9 9M12.5 3.5l-9 9" }) });
}
function xm({ size: n = 14, className: a }) {
  return /* @__PURE__ */ te.jsx("svg", { className: a, width: n, height: n, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round", "aria-hidden": "true", children: /* @__PURE__ */ te.jsx("path", { d: "M8 2.5v11M2.5 8h11" }) });
}
const dp = {
  connected: "host-state--connected bg-accent",
  connecting: "host-state--connecting animate-host-pulse bg-yellow",
  error: "host-state--error bg-red",
  disabled: "host-state--disabled bg-subtext-0"
};
function Nv({ state: n, error: a }) {
  return /* @__PURE__ */ te.jsx(
    "span",
    {
      className: Oe("host-state inline-block h-2 w-2 shrink-0 rounded-[50%]", dp[n] ?? dp.disabled),
      title: n === "error" && a ? a : n
    }
  );
}
function Tv({ title: n, onClose: a, children: r, testId: i }) {
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
function bc() {
  return { async: !1, breaks: !1, extensions: null, gfm: !0, hooks: null, pedantic: !1, renderer: null, silent: !1, tokenizer: null, walkTokens: null };
}
var Sa = bc();
function wm(n) {
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
var Cv = ((n = "") => {
  try {
    return !!new RegExp("(?<=1)(?<!1)" + n);
  } catch {
    return !1;
  }
})(), mt = { codeRemoveIndent: /^(?: {1,4}| {0,3}\t)/gm, outputLinkReplace: /\\([\[\]])/g, indentCodeCompensation: /^(\s+)(?:```)/, beginningSpace: /^\s+/, endingHash: /#$/, startingSpaceChar: /^ /, endingSpaceChar: / $/, nonSpaceChar: /[^ ]/, newLineCharGlobal: /\n/g, tabCharGlobal: /\t/g, multipleSpaceGlobal: /\s+/g, blankLine: /^[ \t]*$/, doubleBlankLine: /\n[ \t]*\n[ \t]*$/, blockquoteStart: /^ {0,3}>/, blockquoteSetextReplace: /\n {0,3}((?:=+|-+) *)(?=\n|$)/g, blockquoteSetextReplace2: /^ {0,3}>[ \t]?/gm, listReplaceNesting: /^ {1,4}(?=( {4})*[^ ])/g, listIsTask: /^\[[ xX]\] +\S/, listReplaceTask: /^\[[ xX]\] +/, listTaskCheckbox: /\[[ xX]\]/, anyLine: /\n.*\n/, hrefBrackets: /^<(.*)>$/, tableDelimiter: /[:|]/, tableAlignChars: /^\||\| *$/g, tableRowBlankLine: /\n[ \t]*$/, tableAlignRight: /^ *-+: *$/, tableAlignCenter: /^ *:-+: *$/, tableAlignLeft: /^ *:-+ *$/, startATag: /^<a /i, endATag: /^<\/a>/i, startPreScriptTag: /^<(pre|code|kbd|script)(\s|>)/i, endPreScriptTag: /^<\/(pre|code|kbd|script)(\s|>)/i, startAngleBracket: /^</, endAngleBracket: />$/, pedanticHrefTitle: /^([^'"]*[^\s])\s+(['"])(.*)\2/, unicodeAlphaNumeric: /[\p{L}\p{N}]/u, escapeTest: /[&<>"']/, escapeReplace: /[&<>"']/g, escapeTestNoEncode: /[<>"']|&(?!(#\d{1,7}|#[Xx][a-fA-F0-9]{1,6}|\w+);)/, escapeReplaceNoEncode: /[<>"']|&(?!(#\d{1,7}|#[Xx][a-fA-F0-9]{1,6}|\w+);)/g, caret: /(^|[^\[])\^/g, percentDecode: /%25/g, findPipe: /\|/g, splitPipe: / \|/, slashPipe: /\\\|/g, carriageReturn: /\r\n|\r/g, spaceLine: /^ +$/gm, notSpaceStart: /^\S*/, endingNewline: /\n$/, listItemRegex: (n) => new RegExp(`^( {0,3}${n})((?:[	 ][^\\n]*)?(?:\\n|$))`), nextBulletRegex: el((n) => new RegExp(`^ {0,${n}}(?:[*+-]|\\d{1,9}[.)])((?:[ 	][^\\n]*)?(?:\\n|$))`)), hrRegex: el((n) => new RegExp(`^ {0,${n}}((?:- *){3,}|(?:_ *){3,}|(?:\\* *){3,})(?:\\n+|$)`)), fencesBeginRegex: el((n) => new RegExp(`^ {0,${n}}(?:\`\`\`|~~~)`)), headingBeginRegex: el((n) => new RegExp(`^ {0,${n}}#`)), htmlBeginRegex: el((n) => new RegExp(`^ {0,${n}}<(?:[a-z].*>|!--)`, "i")), blockquoteBeginRegex: el((n) => new RegExp(`^ {0,${n}}>`)) }, Av = /^(?:[ \t]*(?:\n|$))+/, Mv = /^((?: {4}| {0,3}\t)[^\n]+(?:\n(?:[ \t]*(?:\n|$))*)?)+/, Rv = /^ {0,3}(`{3,}(?=[^`\n]*(?:\n|$))|~{3,})([^\n]*)(?:\n|$)(?:|([\s\S]*?)(?:\n|$))(?: {0,3}\1[~`]* *(?=\n|$)|$)/, Wl = /^ {0,3}((?:-[\t ]*){3,}|(?:_[ \t]*){3,}|(?:\*[ \t]*){3,})(?:\n+|$)/, jv = /^ {0,3}(#{1,6})(?=\s|$)(.*)(?:\n+|$)/, vc = / {0,3}(?:[*+-]|\d{1,9}[.)])/, km = /^(?!bull |blockCode|fences|blockquote|heading|html|table)((?:.|\n(?!\s*?\n|bull |blockCode|fences|blockquote|heading|html|table))+?)\n {0,3}(=+|-+) *(?:\n+|$)/, _m = ze(km).replace(/bull/g, vc).replace(/blockCode/g, /(?: {4}| {0,3}\t)/).replace(/fences/g, / {0,3}(?:`{3,}|~{3,})/).replace(/blockquote/g, / {0,3}>/).replace(/heading/g, / {0,3}#{1,6}(?:\s|$)/).replace(/html/g, / {0,3}<[^\n>]+>\n/).replace(/\|table/g, "").getRegex(), Ov = ze(km).replace(/bull/g, vc).replace(/blockCode/g, /(?: {4}| {0,3}\t)/).replace(/fences/g, / {0,3}(?:`{3,}|~{3,})/).replace(/blockquote/g, / {0,3}>/).replace(/heading/g, / {0,3}#{1,6}(?:\s|$)/).replace(/html/g, / {0,3}<[^\n>]+>\n/).replace(/table/g, / {0,3}\|?(?:[:\- ]*\|)+[\:\- ]*\n/).getRegex(), yc = /^([^\n]+(?:\n(?!hr|heading|lheading|blockquote|fences|list|html|table|[ \t]+\n)[^\n]+)*)/, Dv = /^[^\n]+/, xc = /(?!\s*\])(?:\\[\s\S]|[^\[\]\\])+/, Bv = ze(/^ {0,3}\[(label)\]: *(?:\n[ \t]*)?([^<\s][^\s]*|<.*?>)(?:(?: +(?:\n[ \t]*)?| *\n[ \t]*)(title))? *(?:\n+|$)/).replace("label", xc).replace("title", /(?:"(?:\\"?|[^"\\])*"|'[^'\n]*(?:\n[^'\n]+)*\n?'|\([^()]*\))/).getRegex(), Hv = ze(/^(bull)([ \t][^\n]*?)?(?:\n|$)/).replace(/bull/g, vc).getRegex(), Ui = "address|article|aside|base|basefont|blockquote|body|caption|center|col|colgroup|dd|details|dialog|dir|div|dl|dt|fieldset|figcaption|figure|footer|form|frame|frameset|h[1-6]|head|header|hr|html|iframe|legend|li|link|main|menu|menuitem|meta|nav|noframes|ol|optgroup|option|p|param|search|section|summary|table|tbody|td|tfoot|th|thead|title|tr|track|ul", wc = /<!--(?:-?>|[\s\S]*?(?:-->|$))/, Uv = ze("^ {0,3}(?:<(script|pre|style|textarea)[\\s>][\\s\\S]*?(?:</\\1>[^\\n]*\\n*|$)|comment[^\\n]*(\\n+|$)|<\\?[\\s\\S]*?(?:\\?>[^\\n]*\\n*|$)|<![A-Z][\\s\\S]*?(?:>[^\\n]*\\n*|$)|<!\\[CDATA\\[[\\s\\S]*?(?:\\]\\]>[^\\n]*\\n*|$)|</?(tag)(?: +|\\n|/?>)[\\s\\S]*?(?:(?:\\n[ 	]*)+\\n|$)|<(?!script|pre|style|textarea)([a-z][\\w-]*)(?:attribute)*? */?>(?=[ \\t]*(?:\\n|$))[\\s\\S]*?(?:(?:\\n[ 	]*)+\\n|$)|</(?!script|pre|style|textarea)[a-z][\\w-]*\\s*>(?=[ \\t]*(?:\\n|$))[\\s\\S]*?(?:(?:\\n[ 	]*)+\\n|$))", "i").replace("comment", wc).replace("tag", Ui).replace("attribute", / +[a-zA-Z:_][\w.:-]*(?: *= *"[^"\n]*"| *= *'[^'\n]*'| *= *[^\s"'=<>`]+)?/).getRegex(), Sm = (n) => ze(yc).replace("hr", Wl).replace("heading", " {0,3}#{1,6}(?:\\s|$)").replace("|lheading", "").replace("|table", "").replace("blockquote", " {0,3}>").replace("fences", " {0,3}(?:`{3,}(?=[^`\\n]*\\n)|~~~)[^\\n]*\\n").replace("list", n).replace("html", "</?(?:tag)(?: +|\\n|/?>)|<(?:script|pre|style|textarea|!--)").replace("tag", Ui).getRegex(), qv = Sm(/ {0,3}(?:[*+-]|1[.)])[ \t]+[^ \t\n]/), Lv = Sm(/ {0,3}(?:[*+-]|\d{1,9}[.)])(?:[ \t]|\n|$)/), Gv = ze(/^( {0,3}> ?(paragraph|[^\n]*)(?:\n|$))+/).replace("paragraph", Lv).getRegex(), kc = { blockquote: Gv, code: Mv, def: Bv, fences: Rv, heading: jv, hr: Wl, html: Uv, lheading: _m, list: Hv, newline: Av, paragraph: qv, table: va, text: Dv }, fp = ze("^ *([^\\n ].*)\\n {0,3}((?:\\| *)?:?-+:? *(?:\\| *:?-+:? *)*(?:\\| *)?)(?:\\n((?:(?! *\\n|hr|heading|blockquote|code|fences|list|html).*(?:\\n|$))*)\\n*|$)").replace("hr", Wl).replace("heading", " {0,3}#{1,6}(?:\\s|$)").replace("blockquote", " {0,3}>").replace("code", "(?: {4}| {0,3}	)[^\\n]").replace("fences", " {0,3}(?:`{3,}(?=[^`\\n]*\\n)|~~~)[^\\n]*\\n").replace("list", " {0,3}(?:[*+-]|1[.)])[ \\t]").replace("html", "</?(?:tag)(?: +|\\n|/?>)|<(?:script|pre|style|textarea|!--)").replace("tag", Ui).getRegex(), Yv = { ...kc, lheading: Ov, table: fp, paragraph: ze(yc).replace("hr", Wl).replace("heading", " {0,3}#{1,6}(?:\\s|$)").replace("|lheading", "").replace("table", fp).replace("blockquote", " {0,3}>").replace("fences", " {0,3}(?:`{3,}(?=[^`\\n]*\\n)|~~~)[^\\n]*\\n").replace("list", " {0,3}(?:[*+-]|1[.)])[ \\t]+[^ \\t\\n]").replace("html", "</?(?:tag)(?: +|\\n|/?>)|<(?:script|pre|style|textarea|!--)").replace("tag", Ui).getRegex() }, Qv = { ...kc, html: ze(`^ *(?:comment *(?:\\n|\\s*$)|<(tag)[\\s\\S]+?</\\1> *(?:\\n{2,}|\\s*$)|<tag(?:"[^"]*"|'[^']*'|\\s[^'"/>\\s]*)*?/?> *(?:\\n{2,}|\\s*$))`).replace("comment", wc).replace(/tag/g, "(?!(?:a|em|strong|small|s|cite|q|dfn|abbr|data|time|code|var|samp|kbd|sub|sup|i|b|u|mark|ruby|rt|rp|bdi|bdo|span|br|wbr|ins|del|img)\\b)\\w+(?!:|[^\\w\\s@]*@)\\b").getRegex(), def: /^ *\[([^\]]+)\]: *<?([^\s>]+)>?(?: +(["(][^\n]+[")]))? *(?:\n+|$)/, heading: /^(#{1,6})(.*)(?:\n+|$)/, fences: va, lheading: /^(.+?)\n {0,3}(=+|-+) *(?:\n+|$)/, paragraph: ze(yc).replace("hr", Wl).replace("heading", ` *#{1,6} *[^
]`).replace("lheading", _m).replace("|table", "").replace("blockquote", " {0,3}>").replace("|fences", "").replace("|list", "").replace("|html", "").replace("|tag", "").getRegex() }, Vv = /^\\([!"#$%&'()*+,\-./:;<=>?@\[\]\\^_`{|}~])/, Kv = /^(`+)([^`]|[^`][\s\S]*?[^`])\1(?!`)/, Em = /^( {2,}|\\)\n(?!\s*$)/, Zv = /^(`+|[^`])(?:(?= {2,}\n)|[\s\S]*?(?:(?=[\\<!\[`*_]|\b_|$)|[^ ](?= {2,}\n)))/, nl = /[\p{P}\p{S}]/u, qi = /[\s\p{P}\p{S}]/u, _c = /[^\s\p{P}\p{S}]/u, Xv = ze(/^((?![*_])punctSpace)/, "u").replace(/punctSpace/g, qi).getRegex(), zm = /(?!~)[\p{P}\p{S}]/u, Jv = /(?!~)[\s\p{P}\p{S}]/u, $v = /(?:[^\s\p{P}\p{S}]|~)/u, Wv = ze(/link|precode-code|html/, "g").replace("link", /\[(?:[^\[\]`]|(?<a>`+)[^`]+\k<a>(?!`))*?\]\((?:\\[\s\S]|[^\\\(\)]|\((?:\\[\s\S]|[^\\\(\)])*\))*\)/).replace("precode-", Cv ? "(?<!`)()" : "(^^|[^`])").replace("code", /(?<b>`+)[^`]+\k<b>(?!`)/).replace("html", /<(?! )[^<>]*?>/).getRegex(), Nm = /^(?:\*+(?:((?!\*)punct)|([^\s*]))?)|^_+(?:((?!_)punct)|([^\s_]))?/, Fv = ze(Nm, "u").replace(/punct/g, nl).getRegex(), Iv = ze(Nm, "u").replace(/punct/g, zm).getRegex(), Tm = "^[^_*]*?__[^_*]*?\\*[^_*]*?(?=__)|[^*]+(?=[^*])|(?!\\*)punct(\\*+)(?=[\\s]|$)|notPunctSpace(\\*+)(?!\\*)(?=punctSpace|$)|(?!\\*)punctSpace(\\*+)(?=notPunctSpace)|[\\s](\\*+)(?!\\*)(?=punct)|(?!\\*)punct(\\*+)(?!\\*)(?=punct)|notPunctSpace(\\*+)(?=notPunctSpace)", Pv = ze(Tm, "gu").replace(/notPunctSpace/g, _c).replace(/punctSpace/g, qi).replace(/punct/g, nl).getRegex(), ey = ze(Tm, "gu").replace(/notPunctSpace/g, $v).replace(/punctSpace/g, Jv).replace(/punct/g, zm).getRegex(), ty = ze("^[^_*]*?\\*\\*[^_*]*?_[^_*]*?(?=\\*\\*)|[^_]+(?=[^_])|(?!_)punct(_+)(?=[\\s]|$)|notPunctSpace(_+)(?!_)(?=punctSpace|$)|(?!_)punctSpace(_+)(?=notPunctSpace)|[\\s](_+)(?!_)(?=punct)|(?!_)punct(_+)(?!_)(?=punct)", "gu").replace(/notPunctSpace/g, _c).replace(/punctSpace/g, qi).replace(/punct/g, nl).getRegex(), ny = ze(/^~~?(?:((?!~)punct)|[^\s~])/, "u").replace(/punct/g, nl).getRegex(), ay = "^[^~]+(?=[^~])|(?!~)punct(~~?)(?=[\\s]|$)|notPunctSpace(~~?)(?!~)(?=punctSpace|$)|(?!~)punctSpace(~~?)(?=notPunctSpace)|[\\s](~~?)(?!~)(?=punct)|(?!~)punct(~~?)(?!~)(?=punct)|notPunctSpace(~~?)(?=notPunctSpace)", ly = ze(ay, "gu").replace(/notPunctSpace/g, _c).replace(/punctSpace/g, qi).replace(/punct/g, nl).getRegex(), ry = ze(/\\(punct)/, "gu").replace(/punct/g, nl).getRegex(), iy = ze(/^<(scheme:[^\s\x00-\x1f<>]*|email)>/).replace("scheme", /[a-zA-Z][a-zA-Z0-9+.-]{1,31}/).replace("email", /[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+(@)[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+(?![-_])/).getRegex(), sy = ze(wc).replace("(?:-->|$)", "-->").getRegex(), oy = ze("^comment|^</[a-zA-Z][\\w:-]*\\s*>|^<[a-zA-Z][\\w-]*(?:attribute)*?\\s*/?>|^<\\?[\\s\\S]*?\\?>|^<![a-zA-Z]+\\s[\\s\\S]*?>|^<!\\[CDATA\\[[\\s\\S]*?\\]\\]>").replace("comment", sy).replace("attribute", /\s+[a-zA-Z:_][\w.:-]*(?:\s*=\s*"[^"]*"|\s*=\s*'[^']*'|\s*=\s*[^\s"'=<>`]+)?/).getRegex(), Ti = /(?:\[(?:\\[\s\S]|[^\[\]\\])*\]|\\[\s\S]|`+(?!`)[^`]*?`+(?!`)|``+(?=\])|[^\[\]\\`])*?/, cy = ze(/^!?\[(label)\]\(\s*(href)(?:(?:[ \t]+(?:\n[ \t]*)?|\n[ \t]*)(title))?\s*\)/).replace("label", Ti).replace("href", /<(?:\\.|[^\n<>\\])+>|[^ \t\n\x00-\x1f]+|(?=\))/).replace("title", /"(?:\\"?|[^"\\])*"|'(?:\\'?|[^'\\])*'|\((?:\\\)?|[^)\\])*\)/).getRegex(), Cm = ze(/^!?\[(label)\]\[(ref)\]/).replace("label", Ti).replace("ref", xc).getRegex(), Am = ze(/^!?\[(ref)\](?:\[\])?/).replace("ref", xc).getRegex(), uy = ze("reflink|nolink(?!\\()", "g").replace("reflink", Cm).replace("nolink", Am).getRegex(), pp = /[hH][tT][tT][pP][sS]?|[fF][tT][pP]/, Sc = { _backpedal: va, anyPunctuation: ry, autolink: iy, blockSkip: Wv, br: Em, code: Kv, del: va, delLDelim: va, delRDelim: va, emStrongLDelim: Fv, emStrongRDelimAst: Pv, emStrongRDelimUnd: ty, escape: Vv, link: cy, nolink: Am, punctuation: Xv, reflink: Cm, reflinkSearch: uy, tag: oy, text: Zv, url: va }, dy = { ...Sc, link: ze(/^!?\[(label)\]\((.*?)\)/).replace("label", Ti).getRegex(), reflink: ze(/^!?\[(label)\]\s*\[([^\]]*)\]/).replace("label", Ti).getRegex() }, Wo = { ...Sc, emStrongRDelimAst: ey, emStrongLDelim: Iv, delLDelim: ny, delRDelim: ly, url: ze(/^((?:protocol):\/\/|www\.)(?:[a-zA-Z0-9\-]+\.?)+[^\s<]*|^email/).replace("protocol", pp).replace("email", /[A-Za-z0-9._+-]+(@)[a-zA-Z0-9-_]+(?:\.[a-zA-Z0-9-_]*[a-zA-Z0-9])+(?![-_])/).getRegex(), _backpedal: /(?:[^?!.,:;*_'"~()&]+|\([^)]*\)|&(?![a-zA-Z0-9]+;$)|[?!.,:;*_'"~)]+(?!$))+/, del: /^(~~?)(?=[^\s~])((?:\\[\s\S]|[^\\])*?(?:\\[\s\S]|[^\s~\\]))\1(?=[^~]|$)/, text: ze(/^(`+|~+|[^`~])(?:(?=[`~])|(?= {2,}\n)|(?=[a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-]+@)|[\s\S]*?(?:(?=[\\<!\[`*~_]|\b_|protocol:\/\/|www\.|$)|[^ ](?= {2,}\n)|[^a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-](?=[a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-]+@)))/).replace("protocol", pp).getRegex() }, fy = { ...Wo, br: ze(Em).replace("{2,}", "*").getRegex(), text: ze(Wo.text).replace("\\b_", "\\b_| {2,}\\n").replace(/\{2,\}/g, "*").getRegex() }, li = { normal: kc, gfm: Yv, pedantic: Qv }, Ul = { normal: Sc, gfm: Wo, breaks: fy, pedantic: dy }, py = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }, mp = (n) => py[n];
function tn(n, a) {
  if (a) {
    if (mt.escapeTest.test(n)) return n.replace(mt.escapeReplace, mp);
  } else if (mt.escapeTestNoEncode.test(n)) return n.replace(mt.escapeReplaceNoEncode, mp);
  return n;
}
function hp(n) {
  try {
    n = encodeURI(n).replace(mt.percentDecode, "%");
  } catch {
    return null;
  }
  return n;
}
function gp(n, a) {
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
function bp(n) {
  let a = n.split(`
`), r = a.length - 1;
  for (; r >= 0 && mt.blankLine.test(a[r]); ) r--;
  return a.length - r <= 2 ? n : a.slice(0, r + 1).join(`
`);
}
function my(n, a) {
  if (n.indexOf(a[1]) === -1) return -1;
  let r = 0;
  for (let i = 0; i < n.length; i++) if (n[i] === "\\") i++;
  else if (n[i] === a[0]) r++;
  else if (n[i] === a[1] && (r--, r < 0)) return i;
  return r > 0 ? -2 : -1;
}
function hy(n, a = 0) {
  let r = a, i = "";
  for (let s of n) if (s === "	") {
    let c = 4 - r % 4;
    i += " ".repeat(c), r += c;
  } else i += s, r++;
  return i;
}
function vp(n, a, r, i, s) {
  let c = a.href, f = a.title || null, d = n[1].replace(s.other.outputLinkReplace, "$1");
  i.state.inLink = !0;
  let m = { type: n[0].charAt(0) === "!" ? "image" : "link", raw: r, href: c, title: f, text: d, tokens: i.inlineTokens(d) };
  return i.state.inLink = !1, m;
}
function gy(n, a, r) {
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
var Ci = class {
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
      let r = this.options.pedantic ? a[0] : bp(a[0]), i = r.replace(this.rules.other.codeRemoveIndent, "");
      return { type: "code", raw: r, codeBlockStyle: "indented", text: i };
    }
  }
  fences(n) {
    let a = this.rules.block.fences.exec(n);
    if (a) {
      let r = a[0], i = gy(r, a[3] || "", this.rules);
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
`), y = g.replace(this.rules.other.blockquoteSetextReplace, `
    $1`).replace(this.rules.other.blockquoteSetextReplace2, "");
        i = i ? `${i}
${g}` : g, s = s ? `${s}
${y}` : y;
        let v = this.lexer.state.top;
        if (this.lexer.state.top = !0, this.lexer.blockTokens(y, c, !0), this.lexer.state.top = v, r.length === 0) break;
        let b = c.at(-1);
        if (b?.type === "code") break;
        if (b?.type === "blockquote") {
          let S = b, E = S.raw + `
` + r.join(`
`), j = this.blockquote(E);
          c[c.length - 1] = j, i = i.substring(0, i.length - S.raw.length) + j.raw, s = s.substring(0, s.length - S.text.length) + j.text;
          break;
        } else if (b?.type === "list") {
          let S = b, E = S.raw + `
` + r.join(`
`), j = this.list(E);
          c[c.length - 1] = j, i = i.substring(0, i.length - b.raw.length) + j.raw, s = s.substring(0, s.length - S.raw.length) + j.raw, r = E.substring(c.at(-1).raw.length).split(`
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
        let m = !1, g = "", y = "";
        if (!(a = c.exec(n)) || this.rules.block.hr.test(n)) break;
        g = a[0], n = n.substring(g.length);
        let v = hy(a[2].split(`
`, 1)[0], a[1].length), b = n.split(`
`, 1)[0], S = !v.trim(), E = 0;
        if (this.options.pedantic ? (E = 2, y = v.trimStart()) : S ? E = a[1].length + 1 : (E = v.search(this.rules.other.nonSpaceChar), E = E > 4 ? 1 : E, y = v.slice(E), E += a[1].length), S && this.rules.other.blankLine.test(b) && (g += b + `
`, n = n.substring(b.length + 1), m = !0), !m) {
          let j = this.rules.other.nextBulletRegex(E), z = this.rules.other.hrRegex(E), R = this.rules.other.fencesBeginRegex(E), O = this.rules.other.headingBeginRegex(E), H = this.rules.other.htmlBeginRegex(E), X = this.rules.other.blockquoteBeginRegex(E);
          for (; n; ) {
            let $ = n.split(`
`, 1)[0], T;
            if (b = $, this.options.pedantic ? (b = b.replace(this.rules.other.listReplaceNesting, "  "), T = b) : T = b.replace(this.rules.other.tabCharGlobal, "    "), R.test(b) || O.test(b) || H.test(b) || X.test(b) || j.test(b) || z.test(b)) break;
            if (T.search(this.rules.other.nonSpaceChar) >= E || !b.trim()) y += `
` + T.slice(E);
            else {
              if (S || v.replace(this.rules.other.tabCharGlobal, "    ").search(this.rules.other.nonSpaceChar) >= 4 || R.test(v) || O.test(v) || z.test(v)) break;
              y += `
` + b;
            }
            S = !b.trim(), g += $ + `
`, n = n.substring($.length + 1), v = T.slice(E);
          }
        }
        s.loose || (f ? s.loose = !0 : this.rules.other.doubleBlankLine.test(g) && (f = !0)), s.items.push({ type: "list_item", raw: g, task: !!this.options.gfm && this.rules.other.listIsTask.test(y), loose: !1, text: y, tokens: [] }), s.raw += g;
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
          for (let v = this.lexer.inlineQueue.length - 1; v >= 0; v--) if (this.rules.other.listIsTask.test(this.lexer.inlineQueue[v].src)) {
            this.lexer.inlineQueue[v].src = this.lexer.inlineQueue[v].src.replace(this.rules.other.listReplaceTask, "");
            break;
          }
          let y = this.rules.other.listTaskCheckbox.exec(m.raw);
          if (y) {
            let v = { type: "checkbox", raw: y[0] + " ", checked: y[0] !== "[ ]" };
            m.checked = v.checked, s.loose ? m.tokens[0] && ["paragraph", "text"].includes(m.tokens[0].type) && "tokens" in m.tokens[0] && m.tokens[0].tokens ? (m.tokens[0].raw = v.raw + m.tokens[0].raw, m.tokens[0].text = v.raw + m.tokens[0].text, m.tokens[0].tokens.unshift(v)) : m.tokens.unshift({ type: "paragraph", raw: v.raw, text: v.raw, tokens: [v] }) : m.tokens.unshift(v);
          }
        } else m.task && (m.task = !1);
        if (!s.loose) {
          let y = m.tokens.filter((b) => b.type === "space"), v = y.length > 0 && y.some((b) => this.rules.other.anyLine.test(b.raw));
          s.loose = v;
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
      let r = bp(a[0]);
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
    let r = gp(a[1]), i = a[2].replace(this.rules.other.tableAlignChars, "").split("|"), s = a[3]?.trim() ? a[3].replace(this.rules.other.tableRowBlankLine, "").split(`
`) : [], c = { type: "table", raw: Yn(a[0], `
`), header: [], align: [], rows: [] };
    if (r.length === i.length) {
      for (let f of i) this.rules.other.tableAlignRight.test(f) ? c.align.push("right") : this.rules.other.tableAlignCenter.test(f) ? c.align.push("center") : this.rules.other.tableAlignLeft.test(f) ? c.align.push("left") : c.align.push(null);
      for (let f = 0; f < r.length; f++) c.header.push({ text: r[f], tokens: this.lexer.inline(r[f]), header: !0, align: c.align[f] });
      for (let f of s) c.rows.push(gp(f, c.header.length).map((d, m) => ({ text: d, tokens: this.lexer.inline(d), header: !1, align: c.align[m] })));
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
        let c = my(a[2], "()");
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
      return i = i.trim(), this.rules.other.startAngleBracket.test(i) && (this.options.pedantic && !this.rules.other.endAngleBracket.test(r) ? i = i.slice(1) : i = i.slice(1, -1)), vp(a, { href: i && i.replace(this.rules.inline.anyPunctuation, "$1"), title: s && s.replace(this.rules.inline.anyPunctuation, "$1") }, a[0], this.lexer, this.rules);
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
      return vp(r, s, r[0], this.lexer, this.rules);
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
        let y = [...i[0]][0].length, v = n.slice(0, s + i.index + y + f);
        if (Math.min(s, f) % 2) {
          let S = v.slice(1, -1);
          return { type: "em", raw: v, text: S, tokens: this.lexer.inlineTokens(S) };
        }
        let b = v.slice(2, -2);
        return { type: "strong", raw: v, text: b, tokens: this.lexer.inlineTokens(b) };
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
        let g = [...i[0]][0].length, y = n.slice(0, s + i.index + g + f), v = y.slice(s, -s);
        return { type: "del", raw: y, text: v, tokens: this.lexer.inlineTokens(v) };
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
}, Ht = class Fo {
  tokens;
  options;
  state;
  inlineQueue;
  tokenizer;
  constructor(a) {
    this.tokens = [], this.tokens.links = /* @__PURE__ */ Object.create(null), this.options = a || Sa, this.options.tokenizer = this.options.tokenizer || new Ci(), this.tokenizer = this.options.tokenizer, this.tokenizer.options = this.options, this.tokenizer.lexer = this, this.inlineQueue = [], this.state = { inLink: !1, inRawBlock: !1, top: !0 };
    let r = { other: mt, block: li.normal, inline: Ul.normal };
    this.options.pedantic ? (r.block = li.pedantic, r.inline = Ul.pedantic) : this.options.gfm && (r.block = li.gfm, this.options.breaks ? r.inline = Ul.breaks : r.inline = Ul.gfm), this.tokenizer.rules = r;
  }
  static get rules() {
    return { block: li, inline: Ul };
  }
  static lex(a, r) {
    return new Fo(r).lex(a);
  }
  static lexInline(a, r) {
    return new Fo(r).inlineTokens(a);
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
        this.options.extensions.startBlock.forEach((y) => {
          g = y.call({ lexer: this }, m), typeof g == "number" && g >= 0 && (d = Math.min(d, g));
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
      let y = g ? g.length : 0;
      return d.slice(0, y) + "[" + "a".repeat(d.length - y - 2) + "]";
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
        let g = 1 / 0, y = a.slice(1), v;
        this.options.extensions.startInline.forEach((b) => {
          v = b.call({ lexer: this }, y), typeof v == "number" && v >= 0 && (g = Math.min(g, v));
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
}, Ai = class {
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
    let i = this.parser.parseInline(r), s = hp(n);
    if (s === null) return i;
    n = s;
    let c = '<a href="' + n + '"';
    return a && (c += ' title="' + tn(a) + '"'), c += ">" + i + "</a>", c;
  }
  image({ href: n, title: a, text: r, tokens: i }) {
    i && (r = this.parser.parseInline(i, this.parser.textRenderer));
    let s = hp(n);
    if (s === null) return tn(r);
    n = s;
    let c = `<img src="${n}" alt="${tn(r)}"`;
    return a && (c += ` title="${tn(a)}"`), c += ">", c;
  }
  text(n) {
    return "tokens" in n && n.tokens ? this.parser.parseInline(n.tokens) : "escaped" in n && n.escaped ? n.text : tn(n.text);
  }
}, Ec = class {
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
}, Zt = class Io {
  options;
  renderer;
  textRenderer;
  constructor(a) {
    this.options = a || Sa, this.options.renderer = this.options.renderer || new Ai(), this.renderer = this.options.renderer, this.renderer.options = this.options, this.renderer.parser = this, this.textRenderer = new Ec();
  }
  static parse(a, r) {
    return new Io(r).parse(a);
  }
  static parseInline(a, r) {
    return new Io(r).parseInline(a);
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
}, Ll = class {
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
    return n ? Zt.parse : Zt.parseInline;
  }
}, by = class {
  defaults = bc();
  options = this.setOptions;
  parse = this.parseMarkdown(!0);
  parseInline = this.parseMarkdown(!1);
  Parser = Zt;
  Renderer = Ai;
  TextRenderer = Ec;
  Lexer = Ht;
  Tokenizer = Ci;
  Hooks = Ll;
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
        let s = this.defaults.renderer || new Ai(this.defaults);
        for (let c in r.renderer) {
          if (!(c in s)) throw new Error(`renderer '${c}' does not exist`);
          if (["options", "parser"].includes(c)) continue;
          let f = c, d = r.renderer[f], m = s[f];
          s[f] = (...g) => {
            let y = d.apply(s, g);
            return y === !1 && (y = m.apply(s, g)), y || "";
          };
        }
        i.renderer = s;
      }
      if (r.tokenizer) {
        let s = this.defaults.tokenizer || new Ci(this.defaults);
        for (let c in r.tokenizer) {
          if (!(c in s)) throw new Error(`tokenizer '${c}' does not exist`);
          if (["options", "rules", "lexer"].includes(c)) continue;
          let f = c, d = r.tokenizer[f], m = s[f];
          s[f] = (...g) => {
            let y = d.apply(s, g);
            return y === !1 && (y = m.apply(s, g)), y;
          };
        }
        i.tokenizer = s;
      }
      if (r.hooks) {
        let s = this.defaults.hooks || new Ll();
        for (let c in r.hooks) {
          if (!(c in s)) throw new Error(`hook '${c}' does not exist`);
          if (["options", "block"].includes(c)) continue;
          let f = c, d = r.hooks[f], m = s[f];
          Ll.passThroughHooks.has(c) ? s[f] = (g) => {
            if (this.defaults.async && Ll.passThroughHooksRespectAsync.has(c)) return (async () => {
              let v = await d.call(s, g);
              return m.call(s, v);
            })();
            let y = d.call(s, g);
            return m.call(s, y);
          } : s[f] = (...g) => {
            if (this.defaults.async) return (async () => {
              let v = await d.apply(s, g);
              return v === !1 && (v = await m.apply(s, g)), v;
            })();
            let y = d.apply(s, g);
            return y === !1 && (y = m.apply(s, g)), y;
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
        let g = await (s.hooks ? await s.hooks.provideParser(n) : n ? Zt.parse : Zt.parseInline)(m, s);
        return s.hooks ? await s.hooks.postprocess(g) : g;
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
}, ka = new by();
function Re(n, a) {
  return ka.parse(n, a);
}
Re.options = Re.setOptions = function(n) {
  return ka.setOptions(n), Re.defaults = ka.defaults, wm(Re.defaults), Re;
};
Re.getDefaults = bc;
Re.defaults = Sa;
Re.use = function(...n) {
  return ka.use(...n), Re.defaults = ka.defaults, wm(Re.defaults), Re;
};
Re.walkTokens = function(n, a) {
  return ka.walkTokens(n, a);
};
Re.parseInline = ka.parseInline;
Re.Parser = Zt;
Re.parser = Zt.parse;
Re.Renderer = Ai;
Re.TextRenderer = Ec;
Re.Lexer = Ht;
Re.lexer = Ht.lex;
Re.Tokenizer = Ci;
Re.Hooks = Ll;
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
const fi = 2e5;
function vy(n) {
  if (n.length <= fi) return { source: n, truncated: !1 };
  const a = n.lastIndexOf(`
`, fi);
  return { source: n.slice(0, a > 0 ? a : fi), truncated: !0 };
}
const yy = (n, a, r) => {
  const i = r.startsWith("data:") ? "data URL" : r.length > 200 ? `${r.slice(0, 200)}…` : r;
  return `[${n}${a ? `: ${a}` : ""}]${i ? ` ${i}` : ""}`;
};
function ya(n, a) {
  return (n ?? []).map((r, i) => xy(r, i, a));
}
function ga(n, a) {
  return n.tokens ? ya(n.tokens, a) : n.text;
}
function xy(n, a, r) {
  switch (n.type) {
    case "space":
      return null;
    case "heading":
      return Q.createElement(`h${n.depth}`, { key: a }, ga(n, r));
    case "paragraph":
      return Q.createElement("p", { key: a }, ga(n, r));
    case "text":
      return n.tokens ? Q.createElement(Q.Fragment, { key: a }, ya(n.tokens, r)) : n.text;
    case "escape":
      return n.text;
    case "strong":
      return Q.createElement("strong", { key: a }, ga(n, r));
    case "em":
      return Q.createElement("em", { key: a }, ga(n, r));
    case "del":
      return Q.createElement("del", { key: a }, ga(n, r));
    case "codespan":
      return Q.createElement("code", { key: a }, n.text);
    case "br":
      return Q.createElement("br", { key: a });
    case "hr":
      return Q.createElement("hr", { key: a });
    case "code": {
      const i = /^[\w#+.-]+$/.test(n.lang ?? "") ? `language-${n.lang}` : void 0;
      return Q.createElement("pre", { key: a }, Q.createElement("code", i ? { className: i } : null, n.text));
    }
    case "blockquote":
      return Q.createElement("blockquote", { key: a }, ya(n.tokens, r));
    case "list": {
      const i = n.items.map((s, c) => Q.createElement(
        "li",
        { key: c },
        s.task ? Q.createElement("input", { type: "checkbox", checked: !!s.checked, disabled: !0, readOnly: !0 }) : null,
        s.task ? " " : null,
        ya(s.tokens, r)
      ));
      return n.ordered ? Q.createElement("ol", { key: a, start: n.start === "" || n.start === 1 ? void 0 : n.start }, i) : Q.createElement("ul", { key: a }, i);
    }
    case "table": {
      const i = (s) => n.align[s] ? { textAlign: n.align[s] } : void 0;
      return Q.createElement(
        "table",
        { key: a },
        Q.createElement("thead", null, Q.createElement("tr", null, n.header.map((s, c) => Q.createElement("th", { key: c, style: i(c) }, ya(s.tokens, r))))),
        Q.createElement("tbody", null, n.rows.map((s, c) => Q.createElement("tr", { key: c }, s.map((f, d) => Q.createElement("td", { key: d, style: i(d) }, ya(f.tokens, r))))))
      );
    }
    case "link": {
      const i = n.href ?? "";
      if (!/^https?:\/\//i.test(i)) return Q.createElement("a", { key: a, title: i || void 0 }, ga(n, r));
      const s = (c) => {
        c.preventDefault?.(), r(i);
      };
      return Q.createElement("a", { key: a, href: i, rel: "noopener noreferrer", onClick: s }, ga(n, r));
    }
    case "image":
      return Q.createElement("span", { key: a, className: "md-placeholder" }, yy("image", n.text, n.href ?? ""));
    // Raw HTML is never parsed: it is drawn as written.
    case "html":
      return n.block ? Q.createElement("p", { key: a }, n.text) : n.text;
    default:
      return n.raw ?? null;
  }
}
function wy(n, a) {
  return ya(Ht.lex(n, { gfm: !0 }), a);
}
const ri = 4, Qn = 8, ky = "flex w-full cursor-pointer items-center justify-between gap-3 px-[0.9rem] py-[0.4rem] text-left text-[0.82rem] text-fg max-[700px]:min-h-11 aria-disabled:cursor-not-allowed aria-disabled:opacity-40", yp = (n) => n.text ?? (typeof n.label == "string" ? n.label : n.value);
function _y({ value: n, onChange: a, options: r, className: i, ariaLabel: s, testId: c, id: f, title: d, disabled: m, placeholder: g, freeText: y, onKeyDown: v }) {
  const b = Q.useId(), [S, E] = Q.useState(!1), [j, z] = Q.useState(-1), [R, O] = Q.useState(!1), H = Q.useRef(null), X = Q.useRef(null), [$, T] = Q.useState({}), h = Q.useRef({ text: "", at: 0 }), w = y && R && n ? r.filter((V) => yp(V).toLowerCase().includes(n.toLowerCase()) || V.value.toLowerCase().includes(n.toLowerCase())) : r, k = r.find((V) => V.value === n), _ = (V) => `${b}-${V}`;
  function C(V) {
    m || (z(V), E(!0));
  }
  function N() {
    E(!1), O(!1), z(-1);
  }
  function D(V) {
    !V || V.disabled || (a(V.value), N());
  }
  function L(V, K) {
    for (let A = 1; A <= w.length; A++) {
      const J = (V + K * A + w.length * A) % w.length;
      if (!w[J].disabled) return J;
    }
    return V;
  }
  const W = () => w.findIndex((V) => !V.disabled), q = () => w.length - 1 - [...w].reverse().findIndex((V) => !V.disabled);
  gi(() => {
    if (!S || !H.current) {
      T((ae) => ae.left === void 0 ? ae : {});
      return;
    }
    const V = H.current.getBoundingClientRect(), K = window.innerHeight - V.bottom - ri - Qn, A = V.top - ri - Qn, J = K < 160 && A > K;
    T({
      position: "fixed",
      left: Math.min(Math.max(Qn, V.left), Math.max(Qn, window.innerWidth - V.width - Qn)),
      // As wide as its longest label (a session title, a path), never wider than the window.
      width: "max-content",
      minWidth: V.width,
      maxWidth: window.innerWidth - 2 * Qn,
      maxHeight: Math.min(J ? A : K, 320),
      ...J ? { bottom: window.innerHeight - V.top + ri } : { top: V.bottom + ri },
      overflowY: "auto"
    });
  }, [S, w.length]), gi(() => {
    const V = X.current;
    if (!S || !V || $.left === void 0) return;
    const K = V.getBoundingClientRect().right, A = window.innerWidth - Qn;
    K > A && T((J) => ({ ...J, left: Math.max(Qn, Number(J.left) - (K - A)) }));
  }, [S, $]), Ie(() => {
    if (!S) return;
    const V = (K) => {
      const A = K.target;
      (A === document || A instanceof Node && H.current && A.contains(H.current)) && N();
    };
    return window.addEventListener("resize", N), window.addEventListener("scroll", V, !0), () => {
      window.removeEventListener("resize", N), window.removeEventListener("scroll", V, !0);
    };
  }, [S]), Ie(() => {
    const V = S && j >= 0 ? document.getElementById(_(j)) : null, K = X.current;
    !V || !K || (V.offsetTop < K.scrollTop ? K.scrollTop = V.offsetTop : V.offsetTop + V.offsetHeight > K.scrollTop + K.clientHeight && (K.scrollTop = V.offsetTop + V.offsetHeight - K.clientHeight));
  }, [S, j]), jm(S, (V) => {
    V || N();
  }, H, X);
  function Z(V) {
    if (V.nativeEvent.isComposing) return;
    const K = () => {
      V.preventDefault(), V.stopPropagation();
    }, { key: A } = V;
    if (S) {
      if (A === "Escape") {
        K(), N();
        return;
      } else if (A === "Tab")
        N();
      else if (A === "ArrowDown" || A === "ArrowUp") {
        K(), w.length && z(j < 0 ? A === "ArrowDown" ? W() : q() : L(j, A === "ArrowDown" ? 1 : -1));
        return;
      } else if (A === "Home" && !y) {
        K(), z(W());
        return;
      } else if (A === "End" && !y) {
        K(), z(q());
        return;
      } else if (A === "Enter" || A === " " && !y) {
        if (j >= 0 && w[j]) {
          K(), D(w[j]);
          return;
        }
        if (!y) {
          K(), N();
          return;
        }
      } else if (!y && A.length === 1 && !V.metaKey && !V.ctrlKey && !V.altKey) {
        const J = Date.now();
        h.current = { text: (J - h.current.at > 600 ? "" : h.current.text) + A.toLowerCase(), at: J };
        const ae = Math.max(j, 0), oe = [...w.slice(ae + (h.current.text.length === 1 ? 1 : 0)), ...w.slice(0, ae + 1)].find((ce) => !ce.disabled && yp(ce).toLowerCase().startsWith(h.current.text));
        oe && (K(), z(w.indexOf(oe)));
        return;
      }
    } else if (A === "ArrowDown" || A === "ArrowUp" || !y && (A === "Enter" || A === " ")) {
      K(), C(Math.max(0, w.findIndex((J) => J.value === n)));
      return;
    }
    v?.(V);
  }
  const I = {
    ref: (V) => {
      H.current = V;
    },
    id: f,
    title: d,
    disabled: m,
    "aria-label": s,
    "aria-expanded": S,
    "aria-controls": S ? b : void 0,
    "aria-activedescendant": S && j >= 0 ? _(j) : void 0,
    "data-testid": c,
    onKeyDown: Z
  };
  return /* @__PURE__ */ te.jsxs(te.Fragment, { children: [
    y ? /* @__PURE__ */ te.jsx(
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
        onChange: (V) => {
          a(V.target.value), O(!0), S ? z(-1) : (z(-1), E(!0));
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
        className: Oe("inline-flex items-center justify-between gap-2 text-left [font-family:inherit] cursor-pointer disabled:cursor-not-allowed disabled:opacity-50", i),
        onClick: () => S ? N() : C(Math.max(0, w.findIndex((V) => V.value === n))),
        children: [
          /* @__PURE__ */ te.jsx("span", { className: "min-w-0 flex-1 truncate", children: k ? k.label : g ?? "" }),
          /* @__PURE__ */ te.jsx(Tc, { open: !0, className: "shrink-0 text-subtext-0" })
        ]
      }
    ),
    S && w.length > 0 && Jl(
      /* @__PURE__ */ te.jsx(
        "div",
        {
          ref: X,
          id: b,
          role: "listbox",
          "aria-label": s,
          className: Oe("z-[9999]", Hi),
          style: $,
          onMouseDown: (V) => {
            V.preventDefault(), V.stopPropagation();
          },
          onClick: (V) => V.stopPropagation(),
          children: w.map((V, K) => /* @__PURE__ */ te.jsxs(
            "div",
            {
              id: _(K),
              role: "option",
              "aria-selected": V.value === n,
              "aria-disabled": V.disabled || void 0,
              "data-value": V.value,
              className: Oe(ky, K === j && !V.disabled && "bg-surface-0"),
              onMouseEnter: () => {
                V.disabled || z(K);
              },
              onClick: () => D(V),
              children: [
                /* @__PURE__ */ te.jsx("span", { className: "min-w-0 truncate", children: V.label }),
                V.value === n && /* @__PURE__ */ te.jsx("span", { "aria-hidden": "true", className: "shrink-0 text-accent", children: "✓" })
              ]
            },
            V.value
          ))
        }
      ),
      document.body
    )
  ] });
}
const xp = 230, Sy = 370;
function Ey({ x: n, y: a, readOnly: r, canUndo: i, canRedo: s, hasSelection: c, onClose: f, actions: d }) {
  const m = Q.useRef(null);
  Ie(() => {
    const b = (E) => {
      m.current?.contains(E.target) || f();
    }, S = (E) => {
      E.key === "Escape" && (E.preventDefault(), f());
    };
    return document.addEventListener("mousedown", b), document.addEventListener("keydown", S), window.addEventListener("blur", f), window.addEventListener("resize", f), () => {
      document.removeEventListener("mousedown", b), document.removeEventListener("keydown", S), window.removeEventListener("blur", f), window.removeEventListener("resize", f);
    };
  }, [f]);
  const g = (b, S) => nc(Um ? b : S), y = (b, S, E, j, z = !1) => /* @__PURE__ */ te.jsxs("button", { type: "button", className: Oe(qm(), "flex items-center justify-between gap-6"), "data-testid": E, disabled: z, onClick: S, children: [
    /* @__PURE__ */ te.jsx("span", { children: b }),
    /* @__PURE__ */ te.jsx("span", { className: "text-[0.72rem] text-subtext-0", children: j })
  ] }), v = d.askAgent;
  return Jl(
    /* @__PURE__ */ te.jsxs(
      "div",
      {
        ref: m,
        className: Hi,
        "data-testid": "editor-context-menu",
        style: {
          position: "fixed",
          top: Math.max(8, Math.min(a, window.innerHeight - Sy - 8)),
          left: Math.max(8, Math.min(n, window.innerWidth - xp - 8)),
          zIndex: 9999,
          minWidth: xp
        },
        onContextMenu: (b) => b.preventDefault(),
        children: [
          v && /* @__PURE__ */ te.jsxs(te.Fragment, { children: [
            y(c ? "Ask agent about selection…" : "Ask agent about file…", v, "editor-menu-ask-agent", ""),
            /* @__PURE__ */ te.jsx("div", { className: mi })
          ] }),
          y("Undo", d.undo, "editor-menu-undo", g("cmd+z", "ctrl+z"), r || !i),
          y("Redo", d.redo, "editor-menu-redo", g("cmd+shift+z", "ctrl+y"), r || !s),
          /* @__PURE__ */ te.jsx("div", { className: mi }),
          y("Cut", d.cut, "editor-menu-cut", g("cmd+x", "ctrl+x"), r || !c),
          y("Copy", d.copy, "editor-menu-copy", g("cmd+c", "ctrl+c"), !c),
          y("Paste", d.paste, "editor-menu-paste", g("cmd+v", "ctrl+v"), r),
          y("Select All", d.selectAll, "editor-menu-select-all", g("cmd+a", "ctrl+a")),
          /* @__PURE__ */ te.jsx("div", { className: mi }),
          y("Find…", d.find, "editor-menu-find", g("cmd+f", "ctrl+f")),
          !r && y("Replace…", d.replace, "editor-menu-replace", g("cmd+alt+f", "ctrl+h")),
          y("Go to Line…", d.gotoLine, "editor-menu-goto", nc("ctrl+g"))
        ]
      }
    ),
    document.body
  );
}
const zy = "box-border min-h-[44px] cursor-pointer rounded-ui bg-transparent px-[0.7rem] py-[0.45rem] text-subtext-0 no-underline [border:0] [font-family:inherit] [font-weight:inherit] [line-height:inherit] text-[0.85rem] hover:bg-surface-1 hover:text-fg focus-visible:[outline:2px_solid_var(--accent)] focus-visible:[outline-offset:2px] disabled:cursor-default disabled:opacity-[0.55]", Ny = "m-0 mt-[0.4rem] text-[0.78rem] text-subtext-0", Ty = "m-0 mb-2 text-[0.82rem] text-subtext-0", Mm = "rounded-ui bg-surface-1 text-fg [font-family:inherit]", zc = `${Mm} px-2 py-[0.3rem] text-[0.8rem] max-[700px]:min-h-11 focus:[outline:1px_solid_var(--accent)]`, Cy = `${zc} min-w-[5.5rem] shrink-0`, Nc = `${Mm} min-w-0 px-[0.55rem] py-[0.35rem] text-[0.82rem] max-[700px]:min-h-11 focus:[outline:1px_solid_var(--accent)]`, Ay = `${Nc} flex-1 max-[700px]:flex-[1_1_100%]`, My = `${Nc} w-20 flex-[0_0_5rem] max-[700px]:w-24 max-[700px]:flex-[1_1_6rem]`, Ry = `${Nc} flex-[1_1_100%]`, jy = "flex flex-wrap items-center gap-[0.4rem]", Oy = "m-0 mb-2 flex list-none flex-col gap-[0.3rem] p-0", Dy = "flex items-center gap-2 max-[700px]:flex-wrap rounded-ui bg-surface-1 px-2 py-[0.35rem] text-[0.82rem]", By = `settings-modal__host-row ${Dy}`, Hy = "min-w-0 overflow-hidden font-semibold text-ellipsis whitespace-nowrap text-fg", Uy = "min-w-0 flex-1 max-[700px]:basis-full overflow-hidden text-[0.78rem] text-ellipsis whitespace-nowrap text-subtext-0", Rm = "shrink-0 cursor-pointer rounded-ui px-[0.7rem] py-[0.35rem] max-[700px]:min-h-11 text-[0.82rem] font-semibold text-panel-bg [border:none] [font-family:inherit] [transition:opacity_0.12s_ease] hover:opacity-[0.85]", qy = `${Rm} bg-accent`, Ly = `${Rm} ml-auto bg-red`;
function Tc({ open: n, size: a = 12, className: r }) {
  return /* @__PURE__ */ te.jsx("svg", { className: r, width: a, height: a, viewBox: "0 0 12 12", fill: "none", stroke: "currentColor", strokeWidth: "1.3", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true", children: /* @__PURE__ */ te.jsx("path", { d: n ? "M2.5 4.5 6 8l3.5-3.5" : "M4.5 2.5 8 6l-3.5 3.5" }) });
}
function Gy({ label: n, items: a, testId: r, side: i = "right", up: s = !1, maxHeight: c = 320 }) {
  const [f, d] = Q.useState(!1), [m, g] = Q.useState(!1), y = Q.useRef(null), v = Q.useRef(null), b = () => [...v.current?.querySelectorAll('[role="menuitem"]') ?? []];
  Ie(() => {
    f && m && (b()[0]?.focus(), g(!1));
  }, [f, m]);
  const S = () => {
    d(!0), g(!0);
  }, E = (z) => {
    (z.key === "ArrowRight" || z.key === "Enter" || z.key === " ") && (z.preventDefault(), S());
  }, j = (z) => {
    const R = b(), O = R.findIndex((H) => H === document.activeElement);
    z.key === "ArrowDown" || z.key === "ArrowUp" ? (z.preventDefault(), R[(O + (z.key === "ArrowDown" ? 1 : R.length - 1)) % R.length]?.focus()) : (z.key === "ArrowLeft" || z.key === "Escape") && (z.preventDefault(), z.stopPropagation(), d(!1), y.current?.focus());
  };
  return /* @__PURE__ */ te.jsxs("div", { className: "group/submenu relative", children: [
    /* @__PURE__ */ te.jsxs(
      "button",
      {
        ref: y,
        type: "button",
        role: "menuitem",
        "aria-haspopup": "menu",
        "aria-expanded": f,
        className: Oe($o(), "flex items-center justify-between gap-2"),
        "data-testid": r,
        onClick: () => f ? d(!1) : S(),
        onKeyDown: E,
        children: [
          /* @__PURE__ */ te.jsx("span", { className: "truncate", children: n }),
          /* @__PURE__ */ te.jsx(Tc, { open: !1, size: 10 })
        ]
      }
    ),
    /* @__PURE__ */ te.jsx(
      "div",
      {
        ref: v,
        role: "menu",
        "aria-label": n,
        className: Oe(
          Hi,
          "absolute z-10 w-60 overflow-y-auto",
          i === "right" ? "left-full" : "right-full",
          s ? "bottom-0" : "top-0",
          f ? "block" : "hidden group-hover/submenu:block"
        ),
        style: { maxHeight: c },
        onKeyDown: j,
        children: a.map((z) => /* @__PURE__ */ te.jsx("button", { type: "button", role: "menuitem", className: $o(), "data-testid": z.testId, onClick: z.onSelect, children: /* @__PURE__ */ te.jsx("span", { className: "block truncate", children: z.label }) }, z.key))
      }
    )
  ] });
}
function Yy(n) {
  return n.blocked && !n.stale ? "blocked" : n.status === "running" && !n.stale ? "working" : n.unseen ? "done" : "idle";
}
const Po = {
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
function ec(n, a) {
  return !!n.parentSessionId && n.parentSessionId !== n.id && a.some((r) => r.id === n.parentSessionId);
}
function Qy(n) {
  const a = /* @__PURE__ */ new Map();
  for (const r of n)
    ec(r, n) && a.set(r.parentSessionId, [...a.get(r.parentSessionId) ?? [], r]);
  return a.size ? n.filter((r) => !ec(r, n)).flatMap((r) => [r, ...a.get(r.id) ?? []]) : n;
}
const ii = 6, wp = 8;
function Vy(n, a = {}) {
  const { minWidth: r = 220, align: i = "right", minSpaceAbove: s = 100 } = a, c = n.getBoundingClientRect(), f = window.innerWidth, d = window.innerHeight, m = i === "right" ? { right: Math.max(0, f - c.right) } : { left: Math.max(0, c.left) }, g = c.top - ii - wp, y = d - c.bottom - ii - wp;
  return g >= s ? {
    position: "fixed",
    bottom: d - c.top + ii,
    ...m,
    minWidth: r,
    maxHeight: Math.min(g, d * 0.75),
    overflowY: "auto"
  } : {
    position: "fixed",
    top: c.bottom + ii,
    ...m,
    minWidth: r,
    maxHeight: Math.min(y, d * 0.75),
    overflowY: "auto"
  };
}
function jm(n, a, r, i) {
  Ie(() => {
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
function Ky({ icon: n, fallback: a }) {
  const [r, i] = Q.useState(!1);
  return Ie(() => i(!1), [n]), !n || r ? /* @__PURE__ */ te.jsx(te.Fragment, { children: a }) : /* @__PURE__ */ te.jsx("img", { src: n, alt: "", width: 14, height: 14, className: "size-[14px] rounded-[2px] object-contain", referrerPolicy: "no-referrer", onError: () => i(!0) });
}
const Zy = ["application/zip", "application/x-tar", "application/gzip"];
function Om(n) {
  const a = n ?? "";
  if (a.startsWith("image/")) return "image";
  if (a.startsWith("video/")) return "video";
  if (a.startsWith("audio/")) return "audio";
  if (a === "application/pdf") return "pdf";
  if (Zy.includes(a)) return "archive";
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
const Xy = 50 * 1024 * 1024, kp = 1.25, Jy = 0.05, $y = 16384, Wy = "inline-flex items-center justify-center", si = Oe($l, Wy, "min-h-8 min-w-8 px-2 text-[0.75rem] max-[700px]:min-h-11 max-[700px]:min-w-11"), Oo = Oe($l, "inline-flex min-h-8 items-center px-2"), Fy = { pdf: "PDF document", audio: "Audio", video: "Video" };
let Iy = 0;
function Py(n) {
  return n < 1024 ? `${n} B` : n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
function ex(n, a, r) {
  const i = a ? Math.min(8, $y / Math.max(a.width, a.height)) : 1, s = r === "in" ? n * kp : r === "out" ? n / kp : 1;
  return Math.min(i, Math.max(Math.min(Jy, i), s));
}
function tx(n, a) {
  return typeof n != "string" || !n.startsWith("/") ? null : `${n.replace(/\/+$/, "")}/${a.replace(/^\/+/, "")}`;
}
function nx({ media: n, workspaceId: a, metadata: r, onFail: i }) {
  const s = Q.useMemo(() => `media-${++Iy}`, []), [c, f] = Q.useState(null), [d, m] = Q.useState("fit");
  Ie(() => {
    let E = !0;
    return n.open(s, { workspaceId: a, path: r.path, mediaType: r.mediaType ?? "", size: r.size }).then((j) => {
      E && f(j ?? { width: 0, height: 0 });
    }, (j) => {
      E && i(String(j?.message ?? j));
    }), () => {
      E = !1, n.release(s);
    };
  }, [s]), Ie(() => {
    n.setZoom(s, d === "fit" ? null : d);
  }, [s, d]);
  const g = c !== null && c.width > 0 && c.height > 0, y = () => d !== "fit" ? d : n.fitScale(s) ?? 1, v = (E) => m(ex(y(), c, E)), b = (E) => {
    if (!(E.metaKey || E.ctrlKey || E.altKey || !g)) {
      if (E.key === "+" || E.key === "=") v("in");
      else if (E.key === "-") v("out");
      else if (E.key === "0") v("actual");
      else return;
      E.preventDefault();
    }
  }, S = d === "fit" ? "Fit" : `${Math.round(d * 100)}%`;
  return Q.createElement(
    "div",
    { className: "flex min-h-0 min-w-0 flex-1 flex-col", "data-testid": "workspace-image-viewer" },
    Q.createElement(
      "div",
      { className: "flex shrink-0 flex-wrap items-center gap-1 px-3 py-1 text-[0.72rem] text-subtext-0", role: "toolbar", "aria-label": "Image view" },
      Q.createElement("button", { type: "button", className: si, "aria-label": "Zoom out", title: "Zoom out (-)", disabled: !g, onClick: () => v("out") }, "−"),
      Q.createElement("button", { type: "button", className: si, "aria-label": "Zoom in", title: "Zoom in (+)", disabled: !g, onClick: () => v("in") }, "+"),
      Q.createElement("button", { type: "button", className: Oe(si, d === "fit" && "text-fg"), "aria-pressed": d === "fit", onClick: () => m("fit") }, "Fit"),
      Q.createElement("button", { type: "button", className: Oe(si, d === 1 && "text-fg"), "aria-pressed": d === 1, title: "Actual size (0)", disabled: !g, onClick: () => v("actual") }, "100%"),
      Q.createElement("span", { role: "status", className: "px-1", "data-testid": "workspace-image-info" }, g ? `${c.width} × ${c.height} · ${S}` : "")
    ),
    Q.createElement("div", {
      className: "flex min-h-0 min-w-0 flex-1",
      tabIndex: 0,
      "aria-label": `${r.name} image. Plus and minus zoom, 0 shows actual size, arrow keys pan.`,
      onKeyDown: b
    }, c === null ? Q.createElement("span", { className: "m-auto text-[0.8rem] text-subtext-0", role: "status" }, "Loading…") : Q.createElement("div", { className: "relative min-h-0 min-w-0 flex-1", "data-perch-engine": "image", "data-perch-key": s, "data-testid": "workspace-file-image" }))
  );
}
function ax({ workspaceId: n, metadata: a, perch: r }) {
  const [i, s] = Q.useState(!1), c = r.mediaFile?.(n, a.path) ?? { root: null, extraction: null }, f = c.extraction, d = Om(a.mediaType), m = tx(c.root, a.path), g = m === null, y = d === "archive", v = d === "image" && a.size > Xy, b = d !== void 0 && !y && !g && !v;
  let S = "Open this file in Quick Look or its default app.";
  g ? S = "Use your SSH tools to download this file. Perch will not open a remote path on this machine." : y && (S = "Extract into a new folder beside this archive. Existing files are never overwritten.");
  let E = "No preview for this file type";
  g ? E = "Remote media is not available yet" : y ? E = "Compressed archive" : v ? (E = "Image too large to preview", S = `This image is ${Math.round(a.size / 1048576)} MB. Open it in Quick Look or its default app.`) : i && (E = "Preview unavailable", d === "image" && (S = "The image may be corrupt or in a format Perch cannot decode. Open it in Quick Look or its default app."));
  const j = (R) => {
    try {
      r.media[R](m);
    } catch (O) {
      console.error(`perch-media ${R}: ${O?.message ?? O}`);
    }
  }, z = d === "pdf" || d === "audio" || d === "video";
  return Q.createElement(
    "section",
    { className: "flex min-h-0 min-w-0 flex-1 flex-col", "aria-label": `Previewing ${a.path}`, "data-testid": "workspace-file-asset" },
    Q.createElement(
      "header",
      { className: "flex shrink-0 flex-wrap items-center gap-2 px-3 py-2 text-[0.75rem]" },
      Q.createElement("strong", { className: "min-w-0 flex-1 truncate", title: a.path }, a.path),
      y && Q.createElement(
        "button",
        { type: "button", className: Oo, disabled: f?.state === "loading", onClick: () => r.command("files.extract", { workspaceId: n, path: a.path }) },
        f?.state === "loading" ? "Extracting…" : "Extract"
      ),
      !g && Q.createElement("button", { type: "button", className: Oo, onClick: () => j("quickLook") }, "Quick Look"),
      !g && Q.createElement("button", { type: "button", className: Oo, onClick: () => j("openDefault") }, "Open with Default App")
    ),
    f?.state === "ready" && Q.createElement("p", { role: "status", className: "m-0 px-3 py-2 text-[0.75rem] text-subtext-0" }, `Extracted to ${f.destination}. Find it in the file tree.`),
    f?.state === "error" && Q.createElement("p", { role: "alert", className: "m-0 px-3 py-2 text-[0.75rem] text-red" }, f.error),
    !b || i ? Q.createElement(
      "div",
      { className: "grid flex-1 content-center justify-items-center gap-2 p-5 text-center text-[0.8rem] text-subtext-0" },
      Q.createElement("strong", { className: "text-fg" }, E),
      Q.createElement("span", null, S)
    ) : d === "image" ? Q.createElement(nx, { media: r.media, workspaceId: n, metadata: a, onFail: () => s(!0) }) : z && Q.createElement(
      "div",
      { className: "grid flex-1 content-center justify-items-center gap-2 p-5 text-center text-[0.8rem] text-subtext-0", "data-testid": "workspace-file-card" },
      Q.createElement("strong", { className: "text-fg" }, a.name),
      Q.createElement("span", null, `${Fy[d]} · ${Py(a.size)}`),
      Q.createElement("span", null, "Perch does not play or render this file. Open it in Quick Look or its default app.")
    )
  );
}
function lx(n, a = !1) {
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
const rx = {
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
function ix({ name: n, directory: a = !1, open: r = !1 }) {
  const { kind: i, tone: s, text: c } = lx(n, a);
  return /* @__PURE__ */ te.jsxs("svg", { className: Oe("size-[calc(14px*var(--zoom,1))] shrink-0", s), "data-file-icon": i, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: "1.25", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true", children: [
    i === "react" ? /* @__PURE__ */ te.jsxs(te.Fragment, { children: [
      /* @__PURE__ */ te.jsx("ellipse", { cx: "8", cy: "8", rx: "7", ry: "2.5" }),
      /* @__PURE__ */ te.jsx("ellipse", { cx: "8", cy: "8", rx: "7", ry: "2.5", transform: "rotate(60 8 8)" }),
      /* @__PURE__ */ te.jsx("ellipse", { cx: "8", cy: "8", rx: "7", ry: "2.5", transform: "rotate(120 8 8)" }),
      /* @__PURE__ */ te.jsx("circle", { cx: "8", cy: "8", r: "1" })
    ] }) : c ? /* @__PURE__ */ te.jsx("text", { x: "8", y: "11", textAnchor: "middle", fill: "currentColor", stroke: "none", fontSize: "8", fontWeight: "600", fontFamily: "var(--font-mono)", children: c }) : /* @__PURE__ */ te.jsx("path", { d: i === "folder" && r ? "M2 5V3h4l2 2h5v2M2 7h13l-2 6H2z" : rx[i] }),
    i === "branch" && /* @__PURE__ */ te.jsxs(te.Fragment, { children: [
      /* @__PURE__ */ te.jsx("circle", { cx: "4", cy: "3", r: "1.5" }),
      /* @__PURE__ */ te.jsx("circle", { cx: "4", cy: "13", r: "1.5" }),
      /* @__PURE__ */ te.jsx("circle", { cx: "12", cy: "3", r: "1.5" })
    ] }),
    i === "image" && /* @__PURE__ */ te.jsx("circle", { cx: "10.5", cy: "5", r: "1" })
  ] });
}
const sx = { unmodified: "", modified: "M", added: "A", deleted: "D", renamed: "R", copied: "C", typeChanged: "T", untracked: "U", ignored: "I", conflicted: "!" }, _p = (n) => typeof n == "string" ? sx[n] ?? "?" : "?", Sp = (n) => typeof n == "string" ? n === "unmodified" ? "unmodified" : n === "typeChanged" ? "type changed" : n : `unknown (${n.unknown})`;
function ox(n) {
  const a = _p(n.index), r = _p(n.worktree), i = a === "!" || r === "!", s = i ? "!" : n.staged && n.unstaged ? `${a || "?"}/${r || "?"}` : n.staged ? a : r || a, c = `Git · Index: ${Sp(n.index)}; working tree: ${Sp(n.worktree)}${n.originalPath ? `; from ${n.originalPath}` : ""}`, f = i || s.includes("D") ? "text-red" : s === "U" || s === "A" || s === "C" ? "text-green" : s.includes("?") || s === "I" ? "text-subtext-0" : "text-yellow";
  return { label: s, title: c, tone: f };
}
function cx({ decoration: n, directory: a = !1 }) {
  if (!n) return null;
  if (a && n.containsChanges) return /* @__PURE__ */ te.jsx("span", { className: Oe("ml-1 size-1 shrink-0 rounded-full", n.conflicted ? "bg-red" : "bg-yellow"), role: "img", "aria-label": n.conflicted ? "Contains Git conflicts" : "Contains Git changes", title: n.conflicted ? "Contains Git conflicts" : "Contains Git changes", "data-testid": "file-git-summary" });
  if (!n.entry) return null;
  const { label: r, title: i, tone: s } = ox(n.entry);
  return r ? /* @__PURE__ */ te.jsx("span", { className: Oe("ml-1 shrink-0 text-[10px] tabular-nums [font-family:var(--font-mono)]", s), "aria-label": i, title: i, "data-testid": "file-git-marker", children: r }) : null;
}
const ux = "mode-switch group ml-auto flex items-center gap-[0.4rem] bg-transparent p-[0.2rem] [border:none] [font-family:inherit]", Dm = "text-[0.72rem] font-semibold tracking-[0.03em] text-overlay-1 uppercase [transition:color_0.15s_ease]", dx = `${Dm} group-aria-[checked=false]:text-accent`, fx = `${Dm} group-aria-checked:text-accent`, px = "relative h-[1.3rem] w-[2.4rem] shrink-0 rounded-[999px] border border-overlay-0 bg-surface-1 [transition:background_0.15s_ease] group-aria-checked:border-accent group-aria-checked:bg-panel-bg", mx = "absolute top-px left-px h-[1.1rem] w-[1.1rem] rounded-[50%] bg-fg [box-shadow:0_1px_2px_rgba(0,0,0,0.3)] [transition:transform_0.15s_ease,background_0.15s_ease] group-aria-checked:bg-accent group-aria-checked:[transform:translateX(1.1rem)]";
function hx({
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
      className: ux,
      "data-testid": r,
      role: "switch",
      "aria-checked": s,
      "aria-label": "Toggle UI / CLI mode",
      disabled: i,
      onClick: () => a(s ? "ui" : "cli"),
      children: [
        /* @__PURE__ */ te.jsx("span", { className: Oe("mode-switch__label mode-switch__label--ui", dx), children: "UI" }),
        /* @__PURE__ */ te.jsx("span", { className: Oe("mode-switch__track", px), children: /* @__PURE__ */ te.jsx("span", { className: Oe("mode-switch__thumb", mx) }) }),
        /* @__PURE__ */ te.jsx("span", { className: Oe("mode-switch__label mode-switch__label--cli", fx), children: "CLI" })
      ]
    }
  );
}
const al = function(n, a) {
  let s = n;
  const c = Gl[a];
  let f = null, d = 0, m = null;
  const g = [], y = {}, v = function(h, w) {
    d = s * 4 + 17, f = (function(k) {
      const _ = new Array(k);
      for (let C = 0; C < k; C += 1) {
        _[C] = new Array(k);
        for (let N = 0; N < k; N += 1)
          _[C][N] = null;
      }
      return _;
    })(d), b(0, 0), b(d - 7, 0), b(0, d - 7), j(), E(), R(h, w), s >= 7 && z(h), m == null && (m = X(s, c, g)), O(m, w);
  }, b = function(h, w) {
    for (let k = -1; k <= 7; k += 1)
      if (!(h + k <= -1 || d <= h + k))
        for (let _ = -1; _ <= 7; _ += 1)
          w + _ <= -1 || d <= w + _ || (0 <= k && k <= 6 && (_ == 0 || _ == 6) || 0 <= _ && _ <= 6 && (k == 0 || k == 6) || 2 <= k && k <= 4 && 2 <= _ && _ <= 4 ? f[h + k][w + _] = !0 : f[h + k][w + _] = !1);
  }, S = function() {
    let h = 0, w = 0;
    for (let k = 0; k < 8; k += 1) {
      v(!0, k);
      const _ = Kn.getLostPoint(y);
      (k == 0 || h > _) && (h = _, w = k);
    }
    return w;
  }, E = function() {
    for (let h = 8; h < d - 8; h += 1)
      f[h][6] == null && (f[h][6] = h % 2 == 0);
    for (let h = 8; h < d - 8; h += 1)
      f[6][h] == null && (f[6][h] = h % 2 == 0);
  }, j = function() {
    const h = Kn.getPatternPosition(s);
    for (let w = 0; w < h.length; w += 1)
      for (let k = 0; k < h.length; k += 1) {
        const _ = h[w], C = h[k];
        if (f[_][C] == null)
          for (let N = -2; N <= 2; N += 1)
            for (let D = -2; D <= 2; D += 1)
              N == -2 || N == 2 || D == -2 || D == 2 || N == 0 && D == 0 ? f[_ + N][C + D] = !0 : f[_ + N][C + D] = !1;
      }
  }, z = function(h) {
    const w = Kn.getBCHTypeNumber(s);
    for (let k = 0; k < 18; k += 1) {
      const _ = !h && (w >> k & 1) == 1;
      f[Math.floor(k / 3)][k % 3 + d - 8 - 3] = _;
    }
    for (let k = 0; k < 18; k += 1) {
      const _ = !h && (w >> k & 1) == 1;
      f[k % 3 + d - 8 - 3][Math.floor(k / 3)] = _;
    }
  }, R = function(h, w) {
    const k = c << 3 | w, _ = Kn.getBCHTypeInfo(k);
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
    const D = Kn.getMaskFunction(w);
    for (let L = d - 1; L > 0; L -= 2)
      for (L == 6 && (L -= 1); ; ) {
        for (let W = 0; W < 2; W += 1)
          if (f[_][L - W] == null) {
            let q = !1;
            N < h.length && (q = (h[N] >>> C & 1) == 1), D(_, L - W) && (q = !q), f[_][L - W] = q, C -= 1, C == -1 && (N += 1, C = 7);
          }
        if (_ += k, _ < 0 || d <= _) {
          _ -= k, k = -k;
          break;
        }
      }
  }, H = function(h, w) {
    let k = 0, _ = 0, C = 0;
    const N = new Array(w.length), D = new Array(w.length);
    for (let Z = 0; Z < w.length; Z += 1) {
      const I = w[Z].dataCount, V = w[Z].totalCount - I;
      _ = Math.max(_, I), C = Math.max(C, V), N[Z] = new Array(I);
      for (let ae = 0; ae < N[Z].length; ae += 1)
        N[Z][ae] = 255 & h.getBuffer()[ae + k];
      k += I;
      const K = Kn.getErrorCorrectPolynomial(V), J = Zl(N[Z], K.getLength() - 1).mod(K);
      D[Z] = new Array(K.getLength() - 1);
      for (let ae = 0; ae < D[Z].length; ae += 1) {
        const oe = ae + J.getLength() - D[Z].length;
        D[Z][ae] = oe >= 0 ? J.getAt(oe) : 0;
      }
    }
    let L = 0;
    for (let Z = 0; Z < w.length; Z += 1)
      L += w[Z].totalCount;
    const W = new Array(L);
    let q = 0;
    for (let Z = 0; Z < _; Z += 1)
      for (let I = 0; I < w.length; I += 1)
        Z < N[I].length && (W[q] = N[I][Z], q += 1);
    for (let Z = 0; Z < C; Z += 1)
      for (let I = 0; I < w.length; I += 1)
        Z < D[I].length && (W[q] = D[I][Z], q += 1);
    return W;
  }, X = function(h, w, k) {
    const _ = Ep.getRSBlocks(h, w), C = zp();
    for (let D = 0; D < k.length; D += 1) {
      const L = k[D];
      C.put(L.getMode(), 4), C.put(L.getLength(), Kn.getLengthInBits(L.getMode(), h)), L.write(C);
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
  y.addData = function(h, w) {
    w = w || "Byte";
    let k = null;
    switch (w) {
      case "Numeric":
        k = gx(h);
        break;
      case "Alphanumeric":
        k = bx(h);
        break;
      case "Byte":
        k = vx(h);
        break;
      case "Kanji":
        k = yx(h);
        break;
      default:
        throw "mode:" + w;
    }
    g.push(k), m = null;
  }, y.isDark = function(h, w) {
    if (h < 0 || d <= h || w < 0 || d <= w)
      throw h + "," + w;
    return f[h][w];
  }, y.getModuleCount = function() {
    return d;
  }, y.make = function() {
    if (s < 1) {
      let h = 1;
      for (; h < 40; h++) {
        const w = Ep.getRSBlocks(h, c), k = zp();
        for (let C = 0; C < g.length; C++) {
          const N = g[C];
          k.put(N.getMode(), 4), k.put(N.getLength(), Kn.getLengthInBits(N.getMode(), h)), N.write(k);
        }
        let _ = 0;
        for (let C = 0; C < w.length; C++)
          _ += w[C].dataCount;
        if (k.getLengthInBits() <= _ * 8)
          break;
      }
      s = h;
    }
    v(!1, S());
  }, y.createTableTag = function(h, w) {
    h = h || 2, w = typeof w > "u" ? h * 4 : w;
    let k = "";
    k += '<table style="', k += " border-width: 0px; border-style: none;", k += " border-collapse: collapse;", k += " padding: 0px; margin: " + w + "px;", k += '">', k += "<tbody>";
    for (let _ = 0; _ < y.getModuleCount(); _ += 1) {
      k += "<tr>";
      for (let C = 0; C < y.getModuleCount(); C += 1)
        k += '<td style="', k += " border-width: 0px; border-style: none;", k += " border-collapse: collapse;", k += " padding: 0px; margin: 0px;", k += " width: " + h + "px;", k += " height: " + h + "px;", k += " background-color: ", k += y.isDark(_, C) ? "#000000" : "#ffffff", k += ";", k += '"/>';
      k += "</tr>";
    }
    return k += "</tbody>", k += "</table>", k;
  }, y.createSvgTag = function(h, w, k, _) {
    let C = {};
    typeof arguments[0] == "object" && (C = arguments[0], h = C.cellSize, w = C.margin, k = C.alt, _ = C.title), h = h || 2, w = typeof w > "u" ? h * 4 : w, k = typeof k == "string" ? { text: k } : k || {}, k.text = k.text || null, k.id = k.text ? k.id || "qrcode-description" : null, _ = typeof _ == "string" ? { text: _ } : _ || {}, _.text = _.text || null, _.id = _.text ? _.id || "qrcode-title" : null;
    const N = y.getModuleCount() * h + w * 2;
    let D, L, W, q, Z = "", I;
    for (I = "l" + h + ",0 0," + h + " -" + h + ",0 0,-" + h + "z ", Z += '<svg version="1.1" xmlns="http://www.w3.org/2000/svg"', Z += C.scalable ? "" : ' width="' + N + 'px" height="' + N + 'px"', Z += ' viewBox="0 0 ' + N + " " + N + '" ', Z += ' preserveAspectRatio="xMinYMin meet"', Z += _.text || k.text ? ' role="img" aria-labelledby="' + $([_.id, k.id].join(" ").trim()) + '"' : "", Z += ">", Z += _.text ? '<title id="' + $(_.id) + '">' + $(_.text) + "</title>" : "", Z += k.text ? '<description id="' + $(k.id) + '">' + $(k.text) + "</description>" : "", Z += '<rect width="100%" height="100%" fill="white" cx="0" cy="0"/>', Z += '<path d="', W = 0; W < y.getModuleCount(); W += 1)
      for (q = W * h + w, D = 0; D < y.getModuleCount(); D += 1)
        y.isDark(W, D) && (L = D * h + w, Z += "M" + L + "," + q + I);
    return Z += '" stroke="transparent" fill="black"/>', Z += "</svg>", Z;
  }, y.createDataURL = function(h, w) {
    h = h || 2, w = typeof w > "u" ? h * 4 : w;
    const k = y.getModuleCount() * h + w * 2, _ = w, C = k - w;
    return _x(k, k, function(N, D) {
      if (_ <= N && N < C && _ <= D && D < C) {
        const L = Math.floor((N - _) / h), W = Math.floor((D - _) / h);
        return y.isDark(W, L) ? 0 : 1;
      } else
        return 1;
    });
  }, y.createImgTag = function(h, w, k) {
    h = h || 2, w = typeof w > "u" ? h * 4 : w;
    const _ = y.getModuleCount() * h + w * 2;
    let C = "";
    return C += "<img", C += ' src="', C += y.createDataURL(h, w), C += '"', C += ' width="', C += _, C += '"', C += ' height="', C += _, C += '"', k && (C += ' alt="', C += $(k), C += '"'), C += "/>", C;
  };
  const $ = function(h) {
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
    const k = y.getModuleCount() * 1 + h * 2, _ = h, C = k - h;
    let N, D, L, W, q;
    const Z = {
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
    let V = "";
    for (N = 0; N < k; N += 2) {
      for (L = Math.floor((N - _) / 1), W = Math.floor((N + 1 - _) / 1), D = 0; D < k; D += 1)
        q = "█", _ <= D && D < C && _ <= N && N < C && y.isDark(L, Math.floor((D - _) / 1)) && (q = " "), _ <= D && D < C && _ <= N + 1 && N + 1 < C && y.isDark(W, Math.floor((D - _) / 1)) ? q += " " : q += "█", V += h < 1 && N + 1 >= C ? I[q] : Z[q];
      V += `
`;
    }
    return k % 2 && h > 0 ? V.substring(0, V.length - k - 1) + Array(k + 1).join("▀") : V.substring(0, V.length - 1);
  };
  return y.createASCII = function(h, w) {
    if (h = h || 1, h < 2)
      return T(w);
    h -= 1, w = typeof w > "u" ? h * 2 : w;
    const k = y.getModuleCount() * h + w * 2, _ = w, C = k - w;
    let N, D, L, W;
    const q = Array(h + 1).join("██"), Z = Array(h + 1).join("  ");
    let I = "", V = "";
    for (N = 0; N < k; N += 1) {
      for (L = Math.floor((N - _) / h), V = "", D = 0; D < k; D += 1)
        W = 1, _ <= D && D < C && _ <= N && N < C && y.isDark(L, Math.floor((D - _) / h)) && (W = 0), V += W ? q : Z;
      for (L = 0; L < h; L += 1)
        I += V + `
`;
    }
    return I.substring(0, I.length - 1);
  }, y.renderTo2dContext = function(h, w) {
    w = w || 2;
    const k = y.getModuleCount();
    for (let _ = 0; _ < k; _++)
      for (let C = 0; C < k; C++)
        h.fillStyle = y.isDark(_, C) ? "black" : "white", h.fillRect(C * w, _ * w, w, w);
  }, y;
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
    const s = wx(n), c = function() {
      const m = s.read();
      if (m == -1) throw "eof";
      return m;
    };
    let f = 0;
    const d = {};
    for (; ; ) {
      const m = s.read();
      if (m == -1) break;
      const g = c(), y = c(), v = c(), b = String.fromCharCode(m << 8 | g), S = y << 8 | v;
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
}, Gl = {
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
}, Kn = (function() {
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
    let d = Zl([1], 0);
    for (let m = 0; m < f; m += 1)
      d = d.multiply(Zl([1, Zn.gexp(m)], 0));
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
    for (let v = 0; v < d; v += 1)
      for (let b = 0; b < d; b += 1) {
        let S = 0;
        const E = f.isDark(v, b);
        for (let j = -1; j <= 1; j += 1)
          if (!(v + j < 0 || d <= v + j))
            for (let z = -1; z <= 1; z += 1)
              b + z < 0 || d <= b + z || j == 0 && z == 0 || E == f.isDark(v + j, b + z) && (S += 1);
        S > 5 && (m += 3 + S - 5);
      }
    for (let v = 0; v < d - 1; v += 1)
      for (let b = 0; b < d - 1; b += 1) {
        let S = 0;
        f.isDark(v, b) && (S += 1), f.isDark(v + 1, b) && (S += 1), f.isDark(v, b + 1) && (S += 1), f.isDark(v + 1, b + 1) && (S += 1), (S == 0 || S == 4) && (m += 3);
      }
    for (let v = 0; v < d; v += 1)
      for (let b = 0; b < d - 6; b += 1)
        f.isDark(v, b) && !f.isDark(v, b + 1) && f.isDark(v, b + 2) && f.isDark(v, b + 3) && f.isDark(v, b + 4) && !f.isDark(v, b + 5) && f.isDark(v, b + 6) && (m += 40);
    for (let v = 0; v < d; v += 1)
      for (let b = 0; b < d - 6; b += 1)
        f.isDark(b, v) && !f.isDark(b + 1, v) && f.isDark(b + 2, v) && f.isDark(b + 3, v) && f.isDark(b + 4, v) && !f.isDark(b + 5, v) && f.isDark(b + 6, v) && (m += 40);
    let g = 0;
    for (let v = 0; v < d; v += 1)
      for (let b = 0; b < d; b += 1)
        f.isDark(b, v) && (g += 1);
    const y = Math.abs(100 * g / d / d - 50) / 5;
    return m += y * 10, m;
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
})(), Zl = function(n, a) {
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
        c[f + d] ^= Zn.gexp(Zn.glog(i.getAt(f)) + Zn.glog(s.getAt(d)));
    return Zl(c, 0);
  }, i.mod = function(s) {
    if (i.getLength() - s.getLength() < 0)
      return i;
    const c = Zn.glog(i.getAt(0)) - Zn.glog(s.getAt(0)), f = new Array(i.getLength());
    for (let d = 0; d < i.getLength(); d += 1)
      f[d] = i.getAt(d);
    for (let d = 0; d < s.getLength(); d += 1)
      f[d] ^= Zn.gexp(Zn.glog(s.getAt(d)) + c);
    return Zl(f, 0).mod(s);
  }, i;
}, Ep = (function() {
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
      case Gl.L:
        return n[(s - 1) * 4 + 0];
      case Gl.M:
        return n[(s - 1) * 4 + 1];
      case Gl.Q:
        return n[(s - 1) * 4 + 2];
      case Gl.H:
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
      const y = f[g * 3 + 0], v = f[g * 3 + 1], b = f[g * 3 + 2];
      for (let S = 0; S < y; S += 1)
        m.push(a(v, b));
    }
    return m;
  }, r;
})(), zp = function() {
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
}, gx = function(n) {
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
}, bx = function(n) {
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
}, vx = function(n) {
  const a = pt.MODE_8BIT_BYTE, r = al.stringToBytes(n), i = {};
  return i.getMode = function() {
    return a;
  }, i.getLength = function(s) {
    return r.length;
  }, i.write = function(s) {
    for (let c = 0; c < r.length; c += 1)
      s.put(r[c], 8);
  }, i;
}, yx = function(n) {
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
}, Bm = function() {
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
}, xx = function() {
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
}, wx = function(n) {
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
}, kx = function(n, a) {
  const r = n, i = a, s = new Array(n * a), c = {};
  c.setPixel = function(g, y, v) {
    s[y * r + g] = v;
  }, c.write = function(g) {
    g.writeString("GIF87a"), g.writeShort(r), g.writeShort(i), g.writeByte(128), g.writeByte(0), g.writeByte(0), g.writeByte(0), g.writeByte(0), g.writeByte(0), g.writeByte(255), g.writeByte(255), g.writeByte(255), g.writeString(","), g.writeShort(0), g.writeShort(0), g.writeShort(r), g.writeShort(i), g.writeByte(0);
    const y = 2, v = d(y);
    g.writeByte(y);
    let b = 0;
    for (; v.length - b > 255; )
      g.writeByte(255), g.writeBytes(v, b, 255), b += 255;
    g.writeByte(v.length - b), g.writeBytes(v, b, v.length - b), g.writeByte(0), g.writeString(";");
  };
  const f = function(g) {
    const y = g;
    let v = 0, b = 0;
    const S = {};
    return S.write = function(E, j) {
      if (E >>> j)
        throw "length over";
      for (; v + j >= 8; )
        y.writeByte(255 & (E << v | b)), j -= 8 - v, E >>>= 8 - v, b = 0, v = 0;
      b = E << v | b, v = v + j;
    }, S.flush = function() {
      v > 0 && y.writeByte(b);
    }, S;
  }, d = function(g) {
    const y = 1 << g, v = (1 << g) + 1;
    let b = g + 1;
    const S = m();
    for (let O = 0; O < y; O += 1)
      S.add(String.fromCharCode(O));
    S.add(String.fromCharCode(y)), S.add(String.fromCharCode(v));
    const E = Bm(), j = f(E);
    j.write(y, b);
    let z = 0, R = String.fromCharCode(s[z]);
    for (z += 1; z < s.length; ) {
      const O = String.fromCharCode(s[z]);
      z += 1, S.contains(R + O) ? R = R + O : (j.write(S.indexOf(R), b), S.size() < 4095 && (S.size() == 1 << b && (b += 1), S.add(R + O)), R = O);
    }
    return j.write(S.indexOf(R), b), j.write(v, b), j.flush(), E.toByteArray();
  }, m = function() {
    const g = {};
    let y = 0;
    const v = {};
    return v.add = function(b) {
      if (v.contains(b))
        throw "dup key:" + b;
      g[b] = y, y += 1;
    }, v.size = function() {
      return y;
    }, v.indexOf = function(b) {
      return g[b];
    }, v.contains = function(b) {
      return typeof g[b] < "u";
    }, v;
  };
  return c;
}, _x = function(n, a, r) {
  const i = kx(n, a);
  for (let d = 0; d < a; d += 1)
    for (let m = 0; m < n; m += 1)
      i.setPixel(m, d, r(m, d));
  const s = Bm();
  i.write(s);
  const c = xx(), f = s.toByteArray();
  for (let d = 0; d < f.length; d += 1)
    c.writeByte(f[d]);
  return c.flush(), "data:image/gif;base64," + c;
};
al.stringToBytes;
function Sx({ text: n }) {
  const { size: a, path: r } = Q.useMemo(() => {
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
const Xl = Q.createContext(""), tc = (n, a) => typeof n == "string" && n.toLowerCase().includes(a);
function Ex({ title: n, children: a, testId: r, ariaLabel: i }) {
  const s = Q.useContext(Xl), c = s !== "" && tc(n, s);
  return (
    // While searching, a group with no matching row (and no matching title) hides itself.
    /* @__PURE__ */ te.jsxs("section", { className: s && !c ? "mb-8 not-has-[[data-setting-row]]:hidden" : "mb-8", "data-testid": r, "aria-label": i, children: [
      n && /* @__PURE__ */ te.jsx("h3", { className: "m-0 mb-3 text-[0.9rem] font-medium text-fg", children: n }),
      /* @__PURE__ */ te.jsx("div", { className: "rounded-ui bg-surface-0 px-4", children: /* @__PURE__ */ te.jsx(Xl.Provider, { value: c ? "" : s, children: a }) })
    ] })
  );
}
function zx({ title: n, description: a, children: r, testId: i }) {
  const s = Q.useContext(Xl);
  return s && !tc(n, s) && !tc(a, s) ? null : /* @__PURE__ */ te.jsxs("div", { "data-setting-row": !0, "data-testid": i, className: "flex items-center justify-between gap-6 py-[0.8rem] max-[700px]:flex-wrap max-[700px]:gap-y-2", children: [
    /* @__PURE__ */ te.jsxs("div", { className: "min-w-0 max-[700px]:flex-1 max-[700px]:basis-56", children: [
      /* @__PURE__ */ te.jsx("div", { className: "text-[0.85rem] text-fg", children: n }),
      a && /* @__PURE__ */ te.jsx("div", { className: "mt-[0.15rem] text-[0.75rem] text-subtext-0", children: a })
    ] }),
    r && /* @__PURE__ */ te.jsx("div", { className: "flex shrink-0 items-center gap-2", children: r })
  ] });
}
function Nx({ checked: n, onChange: a, testId: r, label: i }) {
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
const Tx = () => Q.useContext(Xl), Cx = {
  select: zc,
  selectHost: Cy,
  input: Ay,
  inputPort: My,
  inputWide: Ry,
  addRow: jy,
  list: Oy,
  hostRow: By,
  name: Hy,
  addr: Uy,
  muted: Ny,
  empty: Ty,
  primary: qy,
  danger: Ly,
  catalogToggle: zy
};
//! State the host keeps for a resource rather than for one view of it (`useResourceState`, `@perch/sdk` 1.4): a
//! review's unsent commit message and comment, its pending batch and its operation id, keyed by the screen's
//! own name for the resource (`review:<workspace>:commit`). Every view and copy that names the same key shares the
//! value, and it outlives a reload or swap of the screen's code, a released hidden copy and the phone/desktop
//! layouts trading places. In memory: a page reload starts empty (durable drafts live in their own services).
const Ax = 512, ln = /* @__PURE__ */ new Map(), Ql = /* @__PURE__ */ new Map();
function Hm(n, a) {
  ln.delete(n), ln.set(n, a);
  for (const r of ln.keys()) {
    if (ln.size <= Ax) break;
    Ql.get(r)?.size || ln.delete(r);
  }
}
function Mx(n, a) {
  return ln.has(n) ? ln.get(n) : a;
}
function Rx(n, a, r) {
  const i = Mx(n, r), s = typeof a == "function" ? a(i) : a;
  if (!(ln.has(n) && Object.is(s, i))) {
    Hm(n, s);
    for (const c of [...Ql.get(n) ?? []]) c();
  }
}
function jx(n, a) {
  if (typeof n != "string" || !n) throw new Error("useResourceState needs a non-empty key.");
  ln.has(n) || Hm(n, a);
  const r = Q.useCallback((c) => {
    const f = Ql.get(n) ?? /* @__PURE__ */ new Set();
    return Ql.set(n, f), f.add(c), () => {
      f.delete(c), f.size || Ql.delete(n);
    };
  }, [n]), i = Q.useSyncExternalStore(r, () => ln.get(n)), s = Q.useCallback((c) => Rx(n, c, a), [n]);
  return [i, s];
}
const Ox = "[--radius:var(--radius-pane)] rounded-soft bg-surface-1/70 shadow-[0_6px_20px_rgba(0,0,0,0.3)] backdrop-blur-xl backdrop-saturate-150", Dx = "hover:bg-transparent hover:text-subtext-0 active:bg-surface-1 active:text-fg";
//! `@perch/sdk` for the native client: the surface a stock screen imports (the navigation part, 1.3), with every
//! call going to one abstract host object, `globalThis.perch`, read when called (so a host or a test sets it before
//! mounting). Class helpers, icons, `cn`, `keyLabel` and the host dot are the app's own modules, compiled in, so the
//! classes are the web's to the character. Data hooks subscribe to `perch.subscribe` and read the host's snapshots
//! (`perch.navigation(options)`, `perch.hosts()`, ...), which must return the same object until the data changes.
//! Menus and dialogs Perch draws itself (session menu, new session menu, confirm, select, folder browser,
//! instructions, memory) open through `perch.openOverlay(kind, props)`; their callbacks are plain functions.
const Bx = "1.3.0";
let pi = null;
const Hx = (n) => {
  pi = n;
};
function ke() {
  const n = (typeof pi == "function" ? pi() : pi) ?? globalThis.perch;
  if (!n) throw new Error("@perch/sdk: no perch host (globalThis.perch) is set");
  return n;
}
const Ux = (n) => ke().subscribe?.(n) ?? (() => {
}), qx = Vy;
function Lx() {
  return typeof globalThis.crypto?.randomUUID == "function" ? globalThis.crypto.randomUUID() : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (n) => {
    const a = Math.floor(Math.random() * 16);
    return (n === "x" ? a : a & 3 | 8).toString(16);
  });
}
const Um = globalThis.perch?.isMac !== !1, nc = (n) => gv(n, ke().isMac !== !1), Gx = (n) => vv(n), Yx = ({ className: n, ...a } = {}) => Oe(xv(a), n), Qx = kv, qm = (n) => $o(n), mi = _v, Vx = $l, Kx = ym, Zx = (n) => Po[n].color, Xx = (n, a) => ke().shortcutFor?.(n, a) ?? null, Jx = (n) => ke().shortcutLabel?.(n) ?? null, Fl = (n, a) => ke().command(n, a ?? {}) !== !1, $x = (n, a, r) => ke().startSession?.(n, a, r), Wx = globalThis.perch?.pickFolder ? (n) => ke().pickFolder(n) : null;
function Je(n) {
  const a = Q.useRef(n);
  return a.current = n, Q.useSyncExternalStore(Ux, () => a.current(ke()));
}
const Lm = (n = {}) => Je((a) => a.navigation({ showTerminals: !!n.showTerminals, sortByAttention: !!n.sortByAttention })), Fx = () => Je((n) => n.hosts()), Ix = () => Je((n) => n.sessionFolders());
function Px() {
  const n = Je((a) => a.addProject?.() ?? ew);
  return {
    status: n.status ?? "idle",
    error: n.error,
    hostId: n.hostId,
    add: (a, r, i) => {
      a.trim() && n.status !== "pending" && ke().addProjectFolder?.(a, r, i);
    },
    clear: () => ke().clearAddProject?.()
  };
}
const ew = Object.freeze({ status: "idle" }), Gm = "perch.lastAgentChoice", tw = Object.freeze({ connected: !1, discovery: !1, state: "ready", choices: [] }), nw = () => {
  const n = ke().storage?.getItem(Gm);
  return n === "claude" || n === "codex" ? n : "claude";
}, aw = Object.freeze({ items: [] });
function lw() {
  const n = Je((a) => a.notifications?.() ?? aw);
  return Q.useMemo(() => ({
    items: n.items ?? [],
    open: (a) => ke().command("notification.open", { id: a }),
    dismiss: (a) => ke().command("notification.dismiss", { id: a })
  }), [n]);
}
function rw(n) {
  const a = Je((s) => s.agentChoices?.(n) ?? tw), [r, i] = Q.useState(nw);
  return Q.useMemo(() => ({
    connected: !!a.connected,
    discovery: !!a.discovery,
    choices: a.choices ?? [],
    lastChoice: r,
    state: a.state ?? "ready",
    error: a.state === "error" ? a.error : void 0,
    rememberChoice: (s) => {
      s !== "claude" && s !== "codex" || (ke().storage?.setItem(Gm, s), i(s));
    },
    manage: () => ke().command("agents.manage", {})
  }), [a, r]);
}
function iw(n) {
  Ie(() => ke().onRequest?.("add-project", n) ?? void 0, [n]);
}
function sw(n) {
  const a = n.map((r) => ({ id: r.id, parentSessionId: r.parentId, session: r }));
  return Qy(a).map((r) => ({ session: r.session, nested: ec(r, a) }));
}
function ow({ id: n, plain: a, className: r }) {
  const i = Je((g) => g.session(n));
  if (!i) return null;
  const s = i.state ?? Yy(i), c = Po[s]?.color ?? Po.unknown.color, f = i.provider, d = f === "claude" || f === "claude-agent-teams" || f === "omp", m = a ? Oe("agent-mark", "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full leading-none", r) : Oe("agent-status-dot", `agent-status-dot--${s}`, "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-[1.5px] bg-panel-bg leading-none", r);
  return Q.createElement(
    "span",
    { className: m, style: a ? void 0 : { borderColor: c }, "data-provider": f ?? "unknown", title: a ? f ?? "Agent" : `${f ?? "Agent"} · ${s}`, "aria-hidden": "true" },
    Q.createElement("span", { className: Oe("inline-flex text-fg", d && "rounded-full bg-[#161616]") }, Q.createElement(Ym, { provider: f, size: 14 }))
  );
}
function Ym({ provider: n, size: a = 14 }) {
  const r = ke().agentIcon?.(n, a) ?? null, i = r?.markup ?? '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><circle cx="8" cy="8" r="5" fill="currentColor"/></svg>';
  return Q.createElement("svg", { width: a, height: a, "aria-hidden": "true", "data-agent-icon": n ?? "unknown", "data-perch-markup": i, ...r && r.tint === !1 ? { "data-perch-image": "true" } : {} });
}
const cw = ({ children: n }) => Q.createElement(Q.Fragment, null, n);
function uw(n, a) {
  const r = Q.useRef(a);
  return r.current = a, Ie(() => {
    const i = ke();
    if (!i.openOverlay) throw new Error(`@perch/sdk: the host draws no overlays (perch.openOverlay), so ${n} cannot open`);
    const s = {};
    for (const [f, d] of Object.entries(r.current))
      s[f] = typeof d == "function" ? (...m) => r.current[f]?.(...m) : d;
    const c = i.openOverlay(n, s);
    return () => i.closeOverlay?.(c);
  }, [n]), null;
}
const $n = (n) => function(r) {
  return uw(n, r);
}, dw = $n("session-menu"), fw = $n("new-session-menu"), pw = $n("confirm");
let Qm = null;
const mw = (n) => {
  Qm = n;
};
function hw(n) {
  return Q.createElement(Qm ?? pw, n);
}
function gw({ className: n = zc, ...a }) {
  return Q.createElement(_y, { ...a, className: n });
}
let ac = null;
const bw = (n) => {
  ac = n;
}, vw = $n("folder-browser");
function yw(n) {
  return ac ? Q.createElement(ac, { ...n, browse: (a) => ke().browse(n.hostId, a) }) : Q.createElement(vw, n);
}
const xw = $n("instructions"), ww = $n("memory"), kw = Tv;
let Cc = null;
const _w = (n) => {
  Cc = n;
};
function Sw(n) {
  if (Cc) return Q.createElement(zw, n);
  const { hostId: a, path: r, className: i } = n, s = Q.useRef(null);
  return Q.createElement(
    "button",
    {
      type: "button",
      ref: s,
      className: Oe("worktree-menu__btn", ym, i),
      "data-testid": `worktree-menu-${a}-${r}`,
      title: "New workspace (a git worktree)",
      "aria-label": "New workspace",
      "aria-expanded": !1,
      onClick: () => ke().openOverlay?.("worktree", { hostId: a, cwd: r, anchor: s.current?.getBoundingClientRect() })
    },
    Q.createElement(xm, null)
  );
}
const Vm = "Perch did not answer.";
function oi(n) {
  return n ? n.type === "worktree.error" ? { error: n.message, dirty: !!n.dirty } : n.error ? { error: String(n.error) } : {} : { error: Vm };
}
function Ew(n, a, r = ke()) {
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
const Np = 5 * 6e4;
function Km(n, a, r, i = ke()) {
  const s = Date.now() + Np;
  let c = !1, f = () => {
  };
  const d = () => {
    c = !0, f(), clearTimeout(g);
  }, m = () => {
    if (!c) {
      if (Date.now() >= s) return d();
      Ew(n, a, i) && (d(), i.startSession?.(n, a, r));
    }
  }, g = setTimeout(d, Np);
  f = i.subscribe?.(m) ?? (() => {
  }), m();
}
function zw({ hostId: n, path: a, className: r, worktrees: i, request: s, parentChoices: c, emptyAgent: f, ...d }) {
  const [m, g] = Q.useState(i), y = (_) => !!ke().coreCan?.(_, n), v = Lm(), b = `${n}:${a}`, S = Q.useMemo(() => {
    if (Array.isArray(c)) return c;
    if (!y("workspace.nest")) return [];
    const _ = v?.projects?.find((D) => D.hostId === n && D.repoPath === a), C = [], N = (D, L) => {
      for (const W of D ?? [])
        L && C.push({ id: W.id, name: W.name, path: W.path }), N(W.children, !0);
    };
    return N(_?.workspaces, !1), C;
  }, [c, v, n, a]), E = n === "local" && y("worktree.job"), j = d.deleteSupported ?? y("worktree.delete"), z = d.startFromSupported ?? y("worktree.startFrom"), R = Je((_) => _.emptyWorkspaceAgent?.() ?? void 0), O = f ?? R ?? void 0, H = Je((_) => _.worktreeMenuRequest?.() ?? null), X = H?.projectKey === b ? H.nonce : null, $ = Q.useMemo(() => s ?? (X == null ? null : H), [s, X]), [T, h] = Q.useState($);
  Ie(() => {
    $ && h($);
  }, [$]);
  const w = Q.useRef({});
  w.current = { background: E, deleteSupported: j };
  const k = Q.useMemo(() => {
    const _ = (C, N) => ke().ask(C, { hostId: n, repoPath: a, ...N });
    return {
      list: async () => {
        const C = await _("worktree.list", {});
        return C?.type === "worktree.list.result" && g({ worktrees: C.worktrees ?? [], defaultRoot: C.defaultRoot ?? "", baseRef: C.baseRef, refs: C.refs ?? [] }), oi(C);
      },
      create: async ({ branch: C, newBranch: N, path: D, extra: L, agent: W }) => {
        const q = { branch: C, newBranch: !!N, path: D ?? null, name: L?.name ?? null, startFrom: L?.startFrom ?? null, parentWorkspaceId: L?.parentWorkspaceId ?? null }, { background: Z } = w.current, I = await _(Z ? "worktree.job.start" : "worktree.create", q), V = Z ? "worktree.job.started" : "worktree.done";
        if (I?.type !== V) return { error: oi(I).error ?? Vm };
        const K = Z ? I.job?.path : I.path;
        return W && K && Km(n, K, W), { background: Z };
      },
      remove: async (C, N) => {
        const D = await _("worktree.remove", { path: C, force: !!N, deleteBranch: w.current.deleteSupported });
        return { ...oi(D), preservedBranch: D?.type === "worktree.done" ? D.preservedBranch ?? void 0 : void 0 };
      },
      deleteBranch: async (C, N) => oi(await _("worktree.branch.delete", { branch: C, expectedHead: N })),
      open: (C) => ke().startSession?.(n, C, "terminal"),
      // The window forgets the request; the screen keeps it until a newer one, as clearing it would re-run (and so
      // cancel) the screen's effect that a measurement put off until the next frame (`measured`).
      takeRequest: () => ke().takeWorktreeRequest?.()
    };
  }, [n, a]);
  return Q.createElement(Cc, {
    hostId: n,
    cwd: a,
    projectKey: b,
    className: r,
    worktrees: m,
    background: E,
    startFromSupported: z,
    deleteSupported: j,
    parentChoices: S,
    emptyAgent: O,
    request: T,
    actions: k
  });
}
const Nw = (n, a) => {
  if (!ke().followPointer?.(n)) return;
  const r = a.items();
  for (const i of r) i.getBoundingClientRect();
  r[0]?.parentElement?.getBoundingClientRect(), fv(n, a);
}, Tw = () => Je((n) => n.workspaceTabs());
function Cw({ path: n, content: a }) {
  const { source: r, truncated: i } = vy(a ?? ""), s = Q.useMemo(() => wy(r, (c) => Fl("link.open", { url: c })), [r]);
  return Q.createElement(
    "div",
    { className: "min-h-0 min-w-0 flex-1 overflow-auto px-4 py-3 text-[0.8rem]", tabIndex: 0, role: "region", "aria-label": `Rendered preview of ${n}`, "data-testid": "workspace-markdown-preview" },
    i && Q.createElement(
      "p",
      { role: "status", className: "mt-0 text-[0.7rem] text-yellow", "data-testid": "workspace-markdown-truncated" },
      `This document is large: only the first ${fi.toLocaleString()} characters are rendered. Switch to Source to see all of it.`
    ),
    Q.createElement("div", { className: "message__markdown file-markdown" }, s)
  );
}
const Aw = $n("file-menu"), Mw = /* @__PURE__ */ new Map(), Rw = ["requestTree", "searchFiles", "openFile", "reloadFile", "requestPreview", "updateDraft", "saveFile", "overwriteFile", "setWrap"];
function jw(n, a = {}) {
  const r = Je((d) => d.workspaceFiles(n)), i = !!a.git, s = r.git?.decorations, c = Q.useMemo(() => i && s?.length ? new Map(s) : Mw, [s, i]), f = Q.useMemo(() => Object.fromEntries(Rw.map((d) => [d, (...m) => (ke().filesDo(d, n, ...m), null)])), [n]);
  return Q.useMemo(() => ({
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
const Ow = () => Je((n) => n.statusLine()), Dw = () => Je((n) => n.zoom()), Bw = () => Je((n) => n.paneLook()), Hw = () => Je((n) => n.keybindings?.() ?? []), Uw = Object.freeze({ usage: Object.freeze([]), updatedAt: 0, spend: null, redeemResult: null });
function qw(n) {
  const a = !!n?.keepFresh, r = Je((s) => s.statusLine?.().connected ?? !1), i = Je((s) => s.planUsage?.() ?? Uw);
  return Ie(() => {
    if (!a || !r) return;
    let s;
    const c = () => {
      ke().command("usage.get"), s = setTimeout(c, 18e4);
    };
    return c(), () => clearTimeout(s);
  }, [a, r]), i;
}
const Lw = () => ke().command("usage.get", { force: !0 }), Gw = (n) => ke().command("usage.redeemReset", { accountId: n }), Yw = () => Fl("app.zoom_reset"), Qw = {
  focused: "bg-[color-mix(in_srgb,var(--text)_10%,var(--panel-bg))] hover:bg-[color-mix(in_srgb,var(--text)_10%,var(--panel-bg))] text-fg font-semibold",
  visible: "bg-transparent text-subtext-0 hover:bg-surface-0 hover:text-fg",
  hidden: "bg-transparent text-subtext-0 hover:bg-surface-0 hover:text-fg"
}, Vw = (n, a, r) => ke().beginTabDrag?.(n, a, r);
function Kw(n) {
  Ie(() => ke().onRequest?.("new-tab", n) ?? void 0, [n]);
}
const Zw = (n) => Fl("browser.open", { workspaceId: n }), Xw = (n, a) => Fl("file.open", { workspaceId: n, path: a }), Jw = () => null, $w = () => null, Ww = $n("new-file");
function Fw(n) {
  return Q.createElement(ax, { ...n, perch: ke() });
}
function Iw(n, a) {
  const r = n.selection(a);
  if (r) return r;
  const i = n.value(a), s = i.split(`
`).length - (i.endsWith(`
`) && i.length ? 1 : 0);
  return { text: i, startLine: 1, endLine: Math.max(1, s) };
}
function Pw({ onGo: n, onClose: a }) {
  const [r, i] = Q.useState(""), s = (c) => {
    c?.preventDefault?.();
    const [f, d] = r.split(":").map((m) => Number.parseInt(m, 10));
    Number.isFinite(f) ? n(f, Number.isFinite(d) ? d : 1) : a();
  };
  return Q.createElement(
    "div",
    { className: "flex shrink-0 items-center gap-2 border-b border-border px-3 py-1 text-[0.75rem] text-subtext-0", "data-testid": "editor-goto" },
    Q.createElement("label", { htmlFor: "perch-editor-goto" }, "Go to line"),
    Q.createElement("input", {
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
    Q.createElement("button", { type: "button", className: $l, onClick: s }, "OK")
  );
}
function e4({ value: n, onChange: a, onSave: r, onCaret: i, readOnly: s, wrap: c, label: f, path: d, docKey: m, onAskAgent: g, ref: y }) {
  const v = ke().editor, b = Q.useRef(null);
  b.current = { onChange: a, onSave: r, onCaret: i, onAskAgent: g };
  const [S, , E] = String(m).split("\0"), j = !!v && E !== void 0 && /^\d+$/.test(E), z = Je((k) => j ? k.workspaceFiles(S)?.carets?.[m] ?? null : null);
  Ie(() => {
    z && b.current.onCaret?.({ line: z.line, col: z.col });
  }, [z?.line, z?.col]);
  const R = Q.useRef(n), [O, H] = Q.useState(null), [X, $] = Q.useState(!1), T = () => {
    if (!v || !b.current.onAskAgent) return;
    const { text: k, startLine: _, endLine: C } = Iw(v, m);
    b.current.onAskAgent(k, _, C);
  };
  if (Q.useImperativeHandle(y, () => ({
    openGoto: () => $(!0),
    focus: () => v?.focus(m),
    askAgent: T
  }), [m]), gi(() => {
    if (!v) return;
    v.open(m, { path: d, value: n, readonly: !!s, wrap: !!c, label: f }), R.current = n;
    const k = v.watch(m, (_) => {
      for (const C of _)
        if (C.type === "change") {
          const N = v.value(m);
          R.current = N, b.current.onChange?.(N);
        } else C.type === "caret" ? b.current.onCaret?.({ line: C.line, col: C.col }) : C.type === "save" ? b.current.onSave?.() : C.type === "goto" ? $(!0) : C.type === "contextmenu" && H({ x: C.x, y: C.y });
    });
    return () => {
      k(), v.park(m);
    };
  }, [m]), Ie(() => {
    !v || j || n === R.current || (R.current = n, v.setValue(m, n, { external: !0 }));
  }, [m, n]), Ie(() => {
    v?.setReadonly(m, !!s);
  }, [m, s]), Ie(() => {
    v?.setWrap(m, !!c);
  }, [m, c]), !v)
    return Q.createElement("textarea", { className: "h-full min-h-0 w-full flex-1 bg-transparent font-mono text-text", "aria-label": f, value: n, readOnly: s, onChange: (k) => a?.(k.target.value) });
  const h = (k) => () => {
    H(null), k(), v.focus(m);
  }, w = O ? !!v.selection(m) : !1;
  return Q.createElement(
    "div",
    { className: "relative flex h-full min-h-0 min-w-0 flex-1 flex-col", "aria-label": f },
    X && Q.createElement(Pw, {
      onGo: (k, _) => {
        $(!1), v.goTo(m, k, _), v.focus(m);
      },
      onClose: () => {
        $(!1), v.focus(m);
      }
    }),
    Q.createElement("div", { "data-perch-engine": "editor", "data-perch-key": m, className: "min-h-0 min-w-0 flex-1" }),
    O && Q.createElement(Ey, {
      x: O.x,
      y: O.y,
      readOnly: !!s,
      canUndo: v.canUndo(m),
      canRedo: v.canRedo(m),
      hasSelection: w,
      onClose: () => H(null),
      actions: {
        undo: h(() => v.undo(m)),
        redo: h(() => v.redo(m)),
        cut: h(() => v.cut(m)),
        copy: h(() => v.copy(m)),
        paste: h(() => v.paste(m)),
        selectAll: h(() => v.selectAll(m)),
        find: h(() => v.openSearch(m, !1)),
        replace: h(() => v.openSearch(m, !0)),
        gotoLine: () => {
          H(null), $(!0);
        },
        ...g ? { askAgent: () => {
          H(null), T();
        } } : {}
      }
    })
  );
}
const t4 = Object.freeze({ pages: [], shownId: null, tabCount: 0 });
function n4(n) {
  const a = Je((r) => r.browserPages?.(n) ?? t4);
  return Q.useMemo(() => {
    const r = (i, s) => ke().command(i, { workspaceId: n, ...s });
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
function a4({ pageId: n, active: a }) {
  const r = `drawer
${n}`;
  return Ie(() => {
    a && ke().command("browser.focus", { key: r });
  }, [a, r]), Q.createElement("div", {
    "data-perch-engine": "browser",
    "data-perch-key": r,
    "data-testid": "browser-page",
    style: { display: "flex", flex: "1 1 0%", minHeight: 0, minWidth: 0 }
  });
}
const x4 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  AgentIcon: Ym,
  BrowserPage: a4,
  Chevron: Tc,
  CloseIcon: zv,
  CodeEditor: e4,
  ConfirmDialog: hw,
  Dialog: kw,
  EllipsisIcon: Sv,
  FileAsset: Fw,
  FileEntryMenu: Aw,
  FileIcon: ix,
  FolderBrowser: yw,
  GearIcon: Ev,
  GitMarker: cx,
  HostStateDot: Nv,
  InstructionsDialog: xw,
  MarkdownPreview: Cw,
  MemoryDialog: ww,
  ModeSwitch: hx,
  NewFilePrompt: Ww,
  NewSessionMenu: fw,
  PageIcon: Ky,
  PlusIcon: xm,
  QrCode: Sx,
  Select: gw,
  SessionDot: ow,
  SessionMenu: dw,
  SettingRow: zx,
  SettingsGroup: Ex,
  SettingsQuery: Xl,
  Slot: cw,
  Submenu: Gy,
  Switch: Nx,
  TabDragLayer: $w,
  TabMenu: Jw,
  WorktreeMenu: Sw,
  agentStateColor: Zx,
  anchoredPopoverStyle: qx,
  assetKind: Om,
  beginReorderDrag: Nw,
  beginTabDrag: Vw,
  bindHost: Hx,
  buttonClass: Qx,
  cn: Oe,
  drawConfirmationsInPlace: mw,
  drawFolderBrowserInPlace: bw,
  drawWorktreeInPlace: _w,
  ghostButton: Vx,
  glassClass: Ox,
  iconButton: Kx,
  isMac: Um,
  keyLabel: nc,
  menuDividerClass: mi,
  menuItemClass: qm,
  menuPanel: Hi,
  nestSessions: sw,
  newId: Lx,
  openBrowserTab: Zw,
  openFileTab: Xw,
  pickFolder: Wx,
  redeemUsageReset: Gw,
  refreshUsage: Lw,
  resetZoom: Yw,
  rowActionClass: Yx,
  runCommand: Fl,
  segmentClass: Gx,
  settingsClass: Cx,
  shortcutFor: Xx,
  shortcutLabel: Jx,
  startPaneWhenReady: Km,
  startSession: $x,
  tabStateClass: Qw,
  tapButtonClass: Dx,
  useAddProject: Px,
  useAddProjectRequest: iw,
  useAgentChoices: rw,
  useBrowserPages: n4,
  useDismissOnOutsideClick: jm,
  useHostSnapshot: Je,
  useHosts: Fx,
  useKeybindings: Hw,
  useNavigation: Lm,
  useNewTabRequest: Kw,
  useNotifications: lw,
  usePaneLook: Bw,
  usePlanUsage: qw,
  useResourceState: jx,
  useSessionFolders: Ix,
  useSettingsQuery: Tx,
  useStatusLine: Ow,
  useWorkspaceFiles: jw,
  useWorkspaceTabs: Tw,
  useZoom: Dw,
  version: Bx
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
const Ac = {
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
  Ac[n] = (a, r) => a[n](r);
const w4 = Object.keys(Ac);
function Do(n, a) {
  for (const [r, i] of Object.entries(a)) {
    const s = Ac[r];
    if (!s) throw new Error(`the description key ${r} has no GPUI builder`);
    i != null && (n = s(n, i));
  }
  return n;
}
const ba = (n) => ({ clientX: n?.position?.x ?? 0, clientY: n?.position?.y ?? 0 }), lc = /* @__PURE__ */ new WeakSet(), hi = /* @__PURE__ */ new WeakSet();
function Tp(n, a, r) {
  const i = n.pressed, s = ba(r);
  return i && i.x === s.clientX && i.y === s.clientY ? i.id : a;
}
function l4(n, a, r) {
  if (n.name) return n.name;
  if (!(a.size || n.hover || n.focus || n.active || n.track_hover && Mi.has(n.group) || r)) return null;
  const i = n.meta?.attrs["data-testid"];
  return i ? `~${n.id}:${i}` : `~${n.id}`;
}
const Zm = (n, a = !1) => (n.children ?? []).some((r) => r.kind === "text" ? !a || /\s/.test(String(r.text ?? "").trim()) : r.kind === "div" && r.style?.flex_direction !== "row" && r.style?.whitespace !== "nowrap" && Zm(r, !0)), Mt = (n) => n.style?.display !== "hidden";
let Mi = /* @__PURE__ */ new Set(), rc = null;
const Cp = /* @__PURE__ */ new WeakMap();
function Xm(n, a = /* @__PURE__ */ new Set()) {
  let r = Cp.get(n);
  if (!r) {
    r = /* @__PURE__ */ new Set();
    for (const { group: i, style: s } of n.group_hover ?? []) "display" in s && r.add(i);
    for (const i of n.children ?? []) if (i.kind !== "text") for (const s of Xm(i)) r.add(s);
    Cp.set(n, r);
  }
  for (const i of r) a.add(i);
  return a;
}
let an = null;
const r4 = (n, a, r, i, s, c, f) => `${+a}|${r}|${i.text_size}|${i.line_height}|${i.whitespace}|${i.text_ellipsis}|${+s}|${c ? `${c.group}|${c.color}` : ""}|${+lc.has(n)}|${+hi.has(n)}|${f.get(n)?.flex_basis ?? ""}`, Ap = /* @__PURE__ */ new WeakMap();
function Jm(n) {
  let a = Ap.get(n);
  return a === void 0 && (a = n.style.overflow_x === "scroll" || n.style.overflow_y === "scroll" || (n.children ?? []).some((r) => r.kind !== "text" && Jm(r)), Ap.set(n, a)), a;
}
function $m(n, a, r, i) {
  let s = i4(a.get(n), r.get(n));
  if (n.kind === "text") return s;
  for (const c of n.children ?? []) $m(c, a, r, i) || (s = !1);
  return s && i.add(n), s;
}
function i4(n, a) {
  if (n === a) return !0;
  if (!n || !a) return !1;
  const r = Object.keys(n);
  if (r.length !== Object.keys(a).length) return !1;
  for (const i of r) if (n[i] !== a[i]) return !1;
  return !0;
}
function ic(n, a, r, i, s = !1, c = !1, f = null, d = {}, m = !1, g = /* @__PURE__ */ new Map(), y = null) {
  if (n.kind === "text") return g.get(n)?.text ?? n.text;
  const v = an && !s && !Jm(n) ? r4(n, c, f, d, m, y, g) : null;
  if (v !== null && an.clean.has(n)) {
    const S = an.from.get(n), E = S?.key === v ? a.reuse(S.id, an.generation) : null;
    if (E)
      return an.next.set(n, { id: E.__id, key: v }), E;
  }
  const b = s4(n, a, r, i, s, c, f, d, m, g, y);
  return v !== null && an.next.set(n, { id: b.__id, key: v }), b;
}
function s4(n, a, r, i, s, c, f, d, m, g, y) {
  const v = lc.has(n);
  c ||= n.style.opacity === 0 || n.style.visibility === "invisible" || n.style.display === "hidden", c && (n.name || n.range_name) && (n = { ...n, name: void 0, range_name: void 0, also: void 0 }), n.style.text_color !== void 0 && (y = null), f = n.style.text_color ?? f;
  const b = !!n.hover?.text_color && Pm(n), S = n.group ?? (b ? `~g${n.id}` : null);
  b && (y = { group: S, color: n.hover.text_color }), d = { ...d };
  for (const N of ["text_size", "line_height", "whitespace", "text_ellipsis"]) n.style[N] !== void 0 && (d[N] = n.style[N]);
  const E = new Set(n.events ?? []), j = s ? { count: 0, hits: /* @__PURE__ */ new Set(), at: null } : !c && !n.pointer_none && n.style.position === "absolute" ? rc : null, z = j ? j.count++ : -1;
  s && (rc = j);
  let R;
  if (n.kind === "image" && !n.markup ? R = a.image(n.src) : R = a.div(), n.kind === "engine" && (R = R.child(i.engine ? i.engine(n.engine, n.key) : a.div())), n.markup && n.kind === "svg" && y && y.color !== f) {
    const { group: N, color: D } = y, L = () => a.div().absolute().top(0).left(0).size_full();
    R = R.child(L().group_hover(N, (W) => W.invisible()).child(i.icon(`~icon-${n.id}`, n.markup, f))).child(L().invisible().group_hover(N, (W) => W.visible()).child(i.icon(`~icon-${n.id}-hover`, n.markup, D)));
  } else n.markup && (R = R.child(i.icon(`~icon-${n.id}`, n.markup, n.kind === "svg" ? f : "")));
  const O = l4(n, E, !!j);
  if (O && (R = R.id(O)), n.measure && (R = R.measure(n.measure)), n.name && R.also_named) for (const N of n.also ?? []) R = R.also_named(N);
  R = Do(R, { ...n.style, ...g.get(n) });
  const H = d.whitespace !== "nowrap" && !d.text_ellipsis;
  m && H && n.style.flex_shrink !== 0 && n.style.min_w === void 0 && Zm(n) && (R = R.min_w(0));
  for (const N of ["hover", "focus", "active"]) n[N] && (R = R[N]((D) => Do(D, n[N])));
  S && (R = R.group(S));
  for (const { group: N, style: D } of n.group_hover ?? []) {
    const { display: L, ...W } = D;
    Object.keys(W).length && (R = R.group_hover(N, (q) => Do(q, W)));
  }
  if (a.scroll && (n.style.overflow_x === "scroll" || n.style.overflow_y === "scroll")) {
    const N = r.document?.scrollTarget, D = N ? (n.children ?? []).filter(Mt).findIndex((L) => Im(L, N.id)) : -1;
    if (D >= 0 && (r.scroller ?? n.id) === n.id && (r.document.scrollTarget = null, r.scroller = n.id, a.scroll.scroll_to_item(D)), r.scroller ??= n.id, r.scroller === n.id && r.document) {
      R = R.track_scroll(a.scroll);
      const L = (n.children ?? []).filter(Mt).map((W) => W.id);
      r.document.itemBounds = (W) => L.includes(W) ? a.scroll.item_bounds?.(L.indexOf(W)) ?? null : null;
    }
  }
  const X = n.style.overflow_x === "scroll" || n.style.overflow_y === "scroll", $ = s && !n.pointer_none || n.blocks_pointer;
  if ((X && hi.has(n) || $) && (R = R.on_scroll_wheel((N, D) => D.stop_propagation?.())), X && E.has("scroll") && (R = R.on_scroll_wheel((N, D) => {
    r.dispatch(n.id, "scroll", {}), D.notify();
  })), X || hi.has(n)) for (const N of n.children ?? []) N.kind !== "text" && hi.add(N);
  n.kind === "input" && !n.disabled && (R = R.on_mouse_down("left", (N, D) => {
    N.bounds && r.setBounds(n.id, N.bounds), r.focus(n.id), D.notify();
  }));
  const T = n.kind === "input" ? n : n.meta?.tag === "label" ? Fm(n) : null;
  T && !T.disabled && /^(checkbox|radio)$/.test(T.input_type) && (R = R.on_click((N, D) => {
    D.stop_propagation?.(), r.toggle(T.id), D.notify();
  }));
  const h = ["click", "double_click", "context_menu", "mouse_down", "mouse_up"].some((N) => E.has(N));
  if (h || v) for (const N of n.children ?? []) N.kind !== "text" && lc.add(N);
  if (h && (R = R.on_mouse_down("left", (N, D) => {
    D.stop_propagation?.(), N.bounds && r.setBounds(n.id, N.bounds);
    const L = { ...ba(N), button: 0, buttons: 1, detail: N.click_count }, W = Tp(r, n.id, N);
    r.pressed = null, r.dispatch(W, "pointerdown", { ...L, pointerType: "mouse" }), r.dispatch(W, "mousedown", L) && r.pressFocus?.(W), D.notify();
  }), R = R.on_mouse_down("right", (N, D) => {
    D.stop_propagation?.(), N.bounds && r.setBounds(n.id, N.bounds);
    const L = Tp(r, n.id, N);
    r.pressed = null, r.dispatch(L, "contextmenu", { ...ba(N), button: 2 }), D.notify();
  }), R = R.on_mouse_up("left", (N, D) => {
    D.stop_propagation?.();
    const L = { ...ba(N), button: 0 };
    r.dispatch(n.id, "pointerup", { ...L, pointerType: "mouse" }), r.dispatch(n.id, "mouseup", L), D.notify();
  }), R = R.on_click((N, D) => {
    r.dispatch(n.id, N.click_count === 2 && E.has("double_click") ? "dblclick" : "click", { detail: N.click_count, button: 0 }), D.notify();
  })), n.blocks_pointer && !h)
    for (const N of ["left", "right"]) R = R.on_mouse_down(N, (D, L) => L.stop_propagation?.());
  else if (v && !h)
    for (const N of ["left", "right"])
      R = R.on_mouse_down(N, (D) => {
        const L = ba(D);
        (r.pressed?.x !== L.clientX || r.pressed?.y !== L.clientY) && (r.pressed = { id: n.id, x: L.clientX, y: L.clientY });
      });
  if (E.has("mouse_move") && (R = R.on_mouse_move((N) => {
    r.dispatch(n.id, "pointermove", { ...ba(N), pointerType: "mouse" });
  })), n.track_hover && Mi.has(n.group) && (R = R.on_hover((N, D) => {
    r.hover(n.id, N), D.notify();
  })), j && (R = R.on_mouse_down_out((N, D) => {
    const L = ba(N), W = `${L.clientX},${L.clientY}`;
    j.at !== W && (j.at = W, j.hits = /* @__PURE__ */ new Set()), j.hits.add(z), !(j.hits.size < j.count) && (j.at = null, r.dispatch(r.document.body.id, "pointerdown", { ...L, pointerType: "mouse" }), r.dispatch(r.document.body.id, "mousedown", L), D.notify());
  })), n.kind === "input" && !/^(checkbox|radio|range|color|file|select)$/.test(n.input_type)) {
    const N = n.value ? String(n.value) : String(n.placeholder ?? "");
    let D = a.div().whitespace_nowrap().overflow_x_hidden();
    const L = wa(d);
    L && (D = D.h(L)), !n.value && f && (D = D.text_color(c4(f))), N && (R = R.child(D.child(n.input_type === "password" && n.value ? "•".repeat([...N].length) : N))), n.field_w && (R = R.child(a.div().w(n.field_w).h(0)));
  }
  const w = d.whitespace === "nowrap" ? wa(d) : null, k = n.style.display === "flex" && !String(n.style.flex_direction ?? "row").startsWith("col");
  let _ = !n.range_name;
  const C = n.style.display === "flex" && String(n.style.flex_direction ?? "row").startsWith("col") && (n.style.h === void 0 || n.style.h === "auto") && typeof n.style.max_h == "number";
  for (const N of (n.children ?? []).filter(Mt)) {
    const D = N.style?.flex_basis;
    C && N.style.flex_grow > 0 && (D === 0 || typeof D == "string" && D.endsWith("%")) && g.set(N, { ...g.get(N), flex_basis: "auto" });
    let L = ic(N, a, r, i, !1, c, f, d, k && N.style?.position !== "absolute", g, y);
    const W = !_ && (N.kind === "text" || !N.meta), q = N.kind === "text" ? g.get(N)?.h ?? w : null, Z = N.kind === "text" ? g.get(N)?.w : void 0;
    if (W || q || Z !== void 0) {
      let I = a.div();
      W && (I = I.id(n.range_name)), W && !k && n.style.display === "flex" && (I = I[`self_${o4[d.text_align] ?? "start"}`]().max_w("100%")), q && (I = I.h(q)), Z !== void 0 && (I = I.w(Z).flex_none().whitespace_nowrap()), L = I.child(L), _ ||= W;
    }
    R = R.child(L);
  }
  return R;
}
const o4 = { center: "center", right: "end", end: "end" };
function c4(n) {
  const a = String(n);
  if (!/^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(a)) return n;
  const r = a.length === 9 ? Number.parseInt(a.slice(7), 16) : 255;
  return `${a.slice(0, 7)}${Math.round(r / 2).toString(16).padStart(2, "0")}`;
}
const Wm = /^(?:[!-,.-~]+|\S)$/u, Fm = (n) => {
  for (const a of n.children ?? []) {
    if (a.kind === "input" && /^(checkbox|radio)$/.test(a.input_type)) return a;
    const r = a.kind === "text" ? null : Fm(a);
    if (r) return r;
  }
  return null;
}, Im = (n, a) => n.id === a || (n.children ?? []).some((r) => r.kind !== "text" && Im(r, a)), Pm = (n) => !!n.markup || (n.children ?? []).some((a) => a.kind !== "text" && Pm(a));
function wa(n) {
  const a = n.line_height;
  return typeof a == "string" && a.endsWith("px") ? Number.parseFloat(a) : typeof a == "number" && typeof n.text_size == "number" ? a * n.text_size : null;
}
function k4(n, a, r, i, s = 0, c = !1) {
  const f = [n.root, ...n.overlays];
  Mi = /* @__PURE__ */ new Set(), rc = null;
  for (const b of f) Xm(b, Mi);
  const d = s > 0 ? g4(f, s) : /* @__PURE__ */ new Map();
  s > 0 && i.measure && u4(f, s, i.measure, d), m4(f, d), p4(f, d), i.measure && f4(f, i.measure, d);
  const m = a.reuse && a.renderGeneration ? r.retained ??= { built: /* @__PURE__ */ new Map(), overrides: /* @__PURE__ */ new Map(), generation: -1 } : null, g = new Map(d);
  m && n.root && (an = { from: m.built, generation: m.generation, clean: /* @__PURE__ */ new Set(), next: /* @__PURE__ */ new Map() }, $m(n.root, d, m.overrides, an.clean));
  let y;
  try {
    y = a.div().relative().size_full().child(ic(n.root, a, r, i, !1, !1, null, {}, !1, d)), m && Object.assign(m, { built: an?.next ?? /* @__PURE__ */ new Map(), overrides: g, generation: a.renderGeneration() ?? -1 });
  } finally {
    an = null;
  }
  let v = c && n.overlays.length ? a.div().relative().size_full().window_layer() : y;
  for (const b of n.overlays) v = v.child(ic(b, a, r, i, !0, !1, null, {}, !1, d));
  return v === y ? y : y.child(v);
}
function u4(n, a, r, i) {
  (ci.scale !== a || ci.measure !== r) && (ci = { scale: a, measure: r, widths: /* @__PURE__ */ new WeakMap(), fonts: /* @__PURE__ */ new WeakMap(), keys: /* @__PURE__ */ new WeakMap(), visits: /* @__PURE__ */ new WeakMap() });
  const { widths: s, fonts: c, keys: f, visits: d } = ci, m = [], g = (O, H) => i.set(O, { ...i.get(O), ...H }), y = (O, H) => {
    m.push(O, H), g(O, H);
  }, v = ["text_size", "font_weight", "font_family", "italic", "whitespace", "text_ellipsis"];
  function b(O, H, X) {
    if (O.kind === "text") {
      if (!(H.whitespace === "nowrap" || Wm.test(O.text)) || H.text_ellipsis || X || typeof H.text_size != "number") return NaN;
      const N = r(O.text, { size: H.text_size, weight: H.font_weight ?? 400, family: H.font_family ?? ".SystemUIFont", italic: !!H.italic });
      return Number.isFinite(N) ? N : NaN;
    }
    if (!Mt(O) || O.kind === "input" || O.kind === "engine" || O.markup) return S(O);
    const $ = `${H.text_size}|${H.font_weight}|${H.font_family}|${H.italic}|${H.whitespace}|${H.text_ellipsis}|${+X}`;
    if (f.get(O) === $ && s.has(O)) return s.get(O);
    f.set(O, $);
    const T = { ...H };
    for (const C of v) O.style[C] !== void 0 && (T[C] = O.style[C]);
    T.text_ellipsis = !!O.style.text_ellipsis, c.set(O, T);
    const h = O.style, w = (O.children ?? []).filter(Xt), k = w.map((C) => b(C, T, X || !!O.tabular));
    let _ = S(O);
    if (!Number.isFinite(_) && h.w === void 0) {
      const C = w.map((D, L) => k[L] + (D.kind === "text" ? 0 : se(D.style.ml) + se(D.style.mr)));
      let N;
      w.length ? Ut(O) ? N = w.some((D) => D.kind !== "text" && D.style.flex_grow > 0) || h.flex_wrap === "wrap" ? NaN : C.reduce((D, L) => D + L, 0) + se(h.gap_x) * (w.length - 1) : N = Math.max(...C) : N = 0, _ = N + se(h.pl) + se(h.pr) + se(h.border_l) + se(h.border_r), typeof h.min_w == "number" && (_ = Math.max(_, h.min_w)), typeof h.max_w == "number" && (_ = Math.min(_, h.max_w));
    }
    return s.set(O, _), _;
  }
  const S = (O) => typeof O.style?.w == "number" ? O.style.w : NaN, E = () => ({ exact: 0, laid: 0 }), j = (O, H) => {
    if (!Number.isFinite(H))
      return Object.assign(O, E()), NaN;
    O.exact += H;
    const X = Math.round(O.exact * a + 1e-9) / a, $ = X - O.laid;
    return O.laid = X, $;
  }, z = (O) => Ut(O) && O.style.flex_wrap !== "wrap" && (O.style.justify ?? "start") === "start";
  function R(O) {
    if (!O || O.kind === "text" || !Mt(O)) return;
    const H = f.get(O), X = d.get(O);
    if (X && H !== void 0 && X.key === H) {
      for (let h = 0; h < X.log.length; h += 2)
        m.push(X.log[h], X.log[h + 1]), g(X.log[h], X.log[h + 1]);
      return;
    }
    const $ = m.length, T = (O.children ?? []).filter(Xt);
    if (z(O) && T.length > 1) {
      const h = se(O.style.gap_x), w = E(), k = !(h && T.some((_) => _.kind === "text" || !Number.isFinite(se(_.style.ml))));
      y(O, { border_l: j(w, se(O.style.border_l)), pl: j(w, se(O.style.pl)) }), k && h && y(O, { gap_x: 0 }), T.forEach((_, C) => {
        const N = (C && k ? h : 0) + (_.kind === "text" ? 0 : se(_.style.ml));
        if (_.kind === "text")
          N && Object.assign(w, E());
        else {
          const q = j(w, N);
          Number.isFinite(q) && y(_, { ml: q });
        }
        const D = _.kind === "text" ? c.get(O) ?? {} : null, L = _.kind === "text" ? b(_, D, !!O.tabular) : s.get(_);
        if ((_.kind === "text" || !(_.style.flex_grow > 0)) && Number.isFinite(L)) {
          const q = { w: j(w, L) };
          _.kind !== "text" && typeof _.style.w != "number" && _.style.min_w === void 0 && (q.whitespace = "nowrap", q.flex_shrink = 0), y(_, q);
        } else Object.assign(w, E());
        if (_.kind !== "text") {
          const q = j(w, se(_.style.mr));
          Number.isFinite(q) && y(_, { mr: q });
        }
      });
    }
    for (const h of O.children ?? []) h.kind !== "text" && R(h);
    H !== void 0 && d.set(O, { key: H, log: m.slice($) });
  }
  for (const O of n)
    O && (b(O, {}, !1), R(O));
}
let ci = { scale: 0, measure: null };
const d4 = /(?<= +)(?=[^ ])|(?<=[\p{L}\p{N}]-)(?=[\p{L}\p{N}])/u;
function f4(n, a, r) {
  const i = ["text_size", "font_weight", "font_family", "italic", "line_height"], s = (y) => typeof y == "number" ? y : 0, c = (y, v) => v && Ri(v) && !Ut(v) && y.style.position !== "absolute" && !["start", "center", "end"].includes(y.style.self) && !["start", "center", "end"].includes(v.style.items);
  ui.measure !== a && (ui = { measure: a, walks: /* @__PURE__ */ new WeakMap() });
  const f = [], d = (y, v) => {
    f.push(y, v), r.set(y, { ...r.get(y), ...v });
  }, m = (y, v, b, S) => {
    if (!y || y.kind === "text" || !Mt(y)) return;
    const E = `${b}|${+c(y, v)}|${S.text_size}|${S.font_weight}|${S.font_family}|${S.italic}|${S.line_height}`, j = ui.walks.get(y);
    if (j?.key === E) {
      for (let R = 0; R < j.log.length; R += 2) d(j.log[R], j.log[R + 1]);
      return;
    }
    const z = f.length;
    g(y, v, b, S), ui.walks.set(y, { key: E, log: f.slice(z) });
  }, g = (y, v, b, S) => {
    const E = y.style;
    let j = typeof E.w == "number" ? E.w : E.w === "100%" ? b : c(y, v) ? b - s(E.ml) - s(E.mr) : NaN;
    typeof E.max_w == "number" && (j = Math.min(j, E.max_w));
    const z = j - s(E.pl) - s(E.pr) - s(E.border_l) - s(E.border_r), R = { ...S };
    for (const H of i) E[H] !== void 0 && (R[H] = E[H]);
    const O = y.children ?? [];
    if (y.break_anywhere && Number.isFinite(z) && z > 0 && typeof R.text_size == "number" && O.length && O.every((H) => H.kind === "text")) {
      const H = { size: R.text_size, weight: R.font_weight ?? 400, family: R.font_family ?? ".SystemUIFont", italic: !!R.italic }, X = (h) => a(h.trimEnd(), H) <= z + 0.01;
      let $ = 0;
      for (const h of O) {
        const w = [];
        for (const _ of h.text.split(`
`)) {
          let C = "";
          for (const N of _.split(d4)) {
            if (X(C + N)) {
              C += N;
              continue;
            }
            C && w.push(C.trimEnd()), C = "";
            for (const D of N)
              C && !X(C + D) && (w.push(C), C = ""), C += D;
          }
          w.push(C.trimEnd());
        }
        const k = w.join(`
`);
        w.every((_) => !_ || X(_)) ? k !== h.text && d(h, { text: k }) : $ = NaN, $ += w.length;
      }
      const T = wa(R);
      Number.isFinite($) && T && E.h === void 0 && O.length === 1 && d(y, { h: $ * T + s(E.pt) + s(E.pb) + s(E.border_t) + s(E.border_b) });
    }
    for (const H of O) m(H, y, Ut(y) ? NaN : z, R);
  };
  for (const y of n) m(y, null, NaN, {});
}
let ui = { measure: null };
function p4(n, a) {
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
function m4(n, a) {
  const r = a.heights ?? /* @__PURE__ */ new Map(), i = (m) => r.get(m), s = (m) => {
    const g = i(m);
    if (Number.isFinite(g)) return g;
    if (m.kind === "text" || !Mt(m)) return 0;
    const y = m.style, v = typeof y.min_h == "number" ? y.min_h : 0, b = (m.children ?? []).filter(Xt), S = b.map((z) => s(z) + (z.kind === "text" ? 0 : Math.max(0, se(z.style.mt) || 0) + Math.max(0, se(z.style.mb) || 0))), E = b.length ? Ut(m) ? Math.max(...S) : S.reduce((z, R) => z + R, 0) + (y.display === "flex" ? (se(y.gap_y) || 0) * (b.length - 1) : 0) : 0, j = [y.pt, y.pb, y.border_t, y.border_b].reduce((z, R) => z + (se(R) || 0), 0);
    return Math.max(v, E + j);
  }, c = (m) => !(m.children ?? []).filter(Xt).length || Ut(m) ? NaN : s({ ...m, style: { ...m.style, h: void 0, max_h: void 0, min_h: void 0 } }), f = (m, g) => {
    const y = m.style;
    if (typeof y.h == "number") return y.h;
    if (typeof y.max_h == "number") return y.max_h;
    if (!g || !Ri(g) || Ut(g)) return NaN;
    const v = g.style, b = typeof v.h == "number" ? v.h : typeof v.max_h == "number" ? v.max_h : NaN, S = (g.children ?? []).filter(Xt);
    let E = 0;
    for (const z of S) {
      if (z === m) continue;
      const R = i(z);
      if (!Number.isFinite(R)) return NaN;
      E += R + (z.kind === "text" ? 0 : se(z.style.mt) + se(z.style.mb));
    }
    const j = v.display === "flex" ? se(v.gap_y) * Math.max(0, S.length - 1) : 0;
    return b - se(v.pt) - se(v.pb) - se(v.border_t) - se(v.border_b) - E - j - se(y.mt) - se(y.mb);
  }, d = (m, g) => {
    if (!(!m || m.kind === "text" || !Mt(m))) {
      if (m.scrollbar > 0 && m.style.overflow_y === "scroll") {
        const y = c(m), v = f(m, g);
        Number.isFinite(y) && Number.isFinite(v) && y > v + 0.01 && a.set(m, { ...a.get(m), pr: se(m.style.pr) + m.scrollbar });
      }
      for (const y of m.children ?? []) d(y, m);
    }
  };
  for (const m of n) d(m, null);
}
const h4 = ["text_size", "line_height", "whitespace", "text_ellipsis"], se = (n) => n == null ? 0 : typeof n == "number" ? n : NaN, Ri = (n) => n.style.display === "flex" ? n.style.flex_direction === "col" : !0, Ut = (n) => n.style.display === "flex" && (n.style.flex_direction ?? "row") === "row", Xt = (n) => n.kind === "text" || Mt(n) && n.style.position !== "absolute";
function g4(n, a) {
  Bo.scale !== a && (Bo = eh(a));
  const { heights: r, texts: i, textKeys: s, visits: c, places: f } = Bo, d = /* @__PURE__ */ new Map(), m = [], g = (T, h) => {
    const w = d.get(T);
    d.set(T, w ? { ...w, ...h } : h);
  }, y = (T, h) => {
    let w = null;
    for (const k in h)
      Number.isFinite(h[k]) && ((w ??= {})[k] = h[k]);
    w && (m.push(T, w), g(T, w));
  }, v = (T) => {
    for (let h = 0; h < T.length; h += 2)
      m.push(T[h], T[h + 1]), g(T[h], T[h + 1]);
  };
  function b(T, h) {
    if (T.kind === "text") return h.whitespace === "nowrap" || Wm.test(T.text) ? wa(h) ?? NaN : NaN;
    const w = `${h.text_size}|${h.line_height}|${h.whitespace}|${h.text_ellipsis}`;
    if (s.get(T) === w && r.has(T)) return r.get(T);
    let k = h;
    for (const L of h4) T.style[L] !== void 0 && T.style[L] !== k[L] && (k === h && (k = { ...h }), k[L] = T.style[L]);
    s.set(T, w), i.set(T, k);
    const _ = T.style, C = (T.children ?? []).filter(Xt), N = C.map((L) => b(L, k));
    let D;
    if (_.h !== void 0 && _.h !== "auto") D = se(_.h);
    else if (T.kind === "engine") D = NaN;
    else if (T.kind === "input")
      D = (T.input_type === "textarea" || T.input_type === "select" ? NaN : wa(k) ?? NaN) + se(_.pt) + se(_.pb) + se(_.border_t) + se(_.border_b), _.min_h !== void 0 && (D = Math.max(D, se(_.min_h)));
    else {
      const L = C.map((q, Z) => (q.kind === "text" ? 0 : se(q.style.mt) + se(q.style.mb)) + N[Z]);
      let W;
      if (Ut(T)) W = _.flex_wrap === "wrap" ? NaN : _.items === "baseline" ? E(C, N, k) : Math.max(0, ...L);
      else if (Ri(T)) {
        const q = C.some((I) => I.kind !== "text" && (I.style.flex_grow > 0 || I.style.flex_basis !== void 0)), Z = _.display !== "flex" && C.some((I) => I.kind !== "text" && (se(I.style.mt) || se(I.style.mb)));
        W = q || Z ? NaN : L.reduce((I, V) => I + V, 0) + (_.display === "flex" ? se(_.gap_y) * Math.max(0, C.length - 1) : 0);
      } else W = NaN;
      D = W + se(_.pt) + se(_.pb) + se(_.border_t) + se(_.border_b), _.min_h !== void 0 && (D = Math.max(D, se(_.min_h))), _.max_h !== void 0 && (D = Math.min(D, se(_.max_h)));
    }
    return r.set(T, D), D;
  }
  const S = (T) => (wa(T) - (Si + Ip) * T.text_size) / 2 + Si * T.text_size;
  function E(T, h, w) {
    let k = 0, _ = 0;
    for (const [C, N] of T.entries()) {
      const D = N.kind === "text" ? w : i.get(N);
      if (!(N.kind === "text" || (N.children ?? []).filter(Xt).every((Z) => Z.kind === "text")) || !Number.isFinite(h[C]) || typeof D.text_size != "number") return NaN;
      const W = N.kind === "text" ? {} : N.style, q = se(W.mt) + se(W.border_t) + se(W.pt) + S(D);
      k = Math.max(k, q), _ = Math.max(_, se(W.mt) + h[C] + se(W.mb) - q);
    }
    return k + _;
  }
  const j = () => ({ exact: 0, laid: 0 }), z = (T, h) => {
    if (!Number.isFinite(h))
      return Object.assign(T, j()), NaN;
    T.exact += h;
    const w = Math.round(T.exact * a + 1e-9) / a, k = w - T.laid;
    return T.laid = w, k;
  };
  function R(T) {
    if (T.kind === "text" || !Mt(T)) return;
    const h = s.get(T), w = c.get(T);
    if (w && h !== void 0 && w.key === h) return v(w.log);
    const k = m.length;
    for (const _ of (T.children ?? []).filter((C) => C.kind !== "text" && Mt(C) && C.style.position === "absolute")) R(_);
    if (Ri(T) && !Ut(T)) {
      const _ = j();
      y(T, { border_t: z(_, se(T.style.border_t)), pt: z(_, se(T.style.pt)) }), O(T, _);
    } else for (const _ of (T.children ?? []).filter(Xt)) _.kind !== "text" && R(_);
    h !== void 0 && c.set(T, { key: h, log: m.slice(k) });
  }
  function O(T, h) {
    const w = (T.children ?? []).filter(Xt), k = T.style.display === "flex" ? se(T.style.gap_y) : 0;
    if (k && w.some((_) => _.kind === "text")) {
      for (const _ of w) _.kind !== "text" && R(_);
      return !1;
    }
    return k && y(T, { gap_y: 0 }), w.forEach((_, C) => {
      if (_.kind === "text") {
        const N = b(_, i.get(T) ?? {});
        Number.isFinite(N) ? y(_, { h: z(h, N) }) : Object.assign(h, j());
        return;
      }
      if (y(_, { mt: z(h, (C ? k : 0) + se(_.style.mt)) }), Number.isFinite(r.get(_))) X(_, h);
      else if (H(_)) {
        const N = _.style;
        y(_, { border_t: z(h, se(N.border_t)), pt: z(h, se(N.pt)) }), y(_, { pb: z(h, se(N.pb)), border_b: z(h, se(N.border_b)) });
      } else
        R(_), Object.assign(h, j());
      y(_, { mb: z(h, se(_.style.mb)) });
    }), !0;
  }
  function H(T) {
    const h = T.style, w = (T.children ?? []).filter(Xt), k = wa(i.get(T) ?? {});
    return T.kind === "div" && !Ut(T) && w.length > 0 && w.every((_) => _.kind === "text") && Number.isInteger(k) && [h.h, h.min_h, h.max_h].every((_) => _ === void 0 || _ === "auto");
  }
  function X(T, h) {
    const w = `${s.get(T)}|${Math.round((h.exact - h.laid) * 1e6)}`, k = f.get(T);
    if (k && k.key === w) {
      v(k.log), h.exact += k.exact, h.laid += k.laid;
      return;
    }
    const _ = m.length, [C, N] = [h.exact, h.laid];
    $(T, h), f.set(T, { key: w, log: m.slice(_), exact: h.exact - C, laid: h.laid - N });
  }
  function $(T, h) {
    const w = T.style;
    for (const D of (T.children ?? []).filter((L) => L.kind !== "text" && Mt(L) && L.style.position === "absolute")) R(D);
    const k = h.laid, _ = h.exact;
    y(T, { border_t: z(h, se(w.border_t)), pt: z(h, se(w.pt)) });
    const C = w.h !== void 0 && w.h !== "auto", N = r.get(T) - se(w.pt) - se(w.pb) - se(w.border_t) - se(w.border_b);
    if (T.kind === "input")
      C || z(h, N);
    else if (Ut(T) || C && (w.justify ?? "start") !== "start") {
      for (const D of (T.children ?? []).filter(Xt)) D.kind !== "text" && R(D);
      C || z(h, N);
    } else !O(T, h) && !C && z(h, N);
    if (C) {
      h.exact = _ + r.get(T), h.laid = Math.round(h.exact * a + 1e-9) / a, y(T, { h: h.laid - k });
      return;
    }
    y(T, { pb: z(h, se(w.pb)), border_b: z(h, se(w.border_b)) }), y(T, { h: h.laid - k });
  }
  for (const T of n)
    b(T, {}), R(T);
  return Object.defineProperty(d, "heights", { value: r }), d;
}
const eh = (n) => ({ scale: n, heights: /* @__PURE__ */ new WeakMap(), texts: /* @__PURE__ */ new WeakMap(), textKeys: /* @__PURE__ */ new WeakMap(), visits: /* @__PURE__ */ new WeakMap(), places: /* @__PURE__ */ new WeakMap() });
let Bo = eh(0);
const _4 = { sidebar: [{ name: "sidebar-root", selector: "aside.sidebar" }, { name: "sidebar-content", selector: "aside.sidebar > div:first-child" }, { name: "host-switcher", selector: '[data-testid="host-switcher"]' }, { name: "host-chip", selector: '[data-testid="host-switcher"] > div' }, { name: "host-badge", selector: ".sidebar__env-badge" }, { name: "host-name", selector: ".sidebar__env-host" }, { name: "host-meta", selector: '[data-testid="host-switcher"] > div > div:first-child > span:nth-child(3)' }, { name: "host-line", selector: ".sidebar__env-cwd" }, { name: "host-caret", selector: '[data-testid="host-switcher"] > span[aria-hidden="true"]' }, { name: "new-session-button", selector: 'button[data-testid^="new-session-"]', key: { self: !0, attr: "data-testid", strip: "new-session-" } }, { name: "new-session-icon", selector: 'button[data-testid^="new-session-"] > svg' }, { name: "new-session-label", selector: 'button[data-testid^="new-session-"]', textRange: !0 }, { name: "new-session-shortcut", selector: 'button[data-testid^="new-session-"] > span' }, { name: "overview", selector: '[data-testid="workspace-overview"]' }, { name: "overview-header", selector: '[data-testid="workspace-overview"] > div:first-child' }, { name: "overview-title", selector: '[data-testid="workspace-overview"] > div:first-child > div:first-child > span:first-child' }, { name: "needs-you-button", selector: '[data-testid="workspace-needs-you"]' }, { name: "organize-button", selector: '[data-testid="workspace-organize"]' }, { name: "organize-icon", selector: '[data-testid="workspace-organize"] > svg' }, { name: "add-project-button", selector: '[data-testid="workspace-add-project"]' }, { name: "add-project-icon", selector: '[data-testid="workspace-add-project"] > svg' }, { name: "add-project-label", selector: '[data-testid="workspace-add-project"]', textRange: !0 }, { name: "project-list", selector: '[data-testid="project-list"]' }, { name: "project", selector: ".workspace-project", key: { self: !0, attr: "data-testid", strip: "workspace-project-" } }, { name: "project-header", selector: ".workspace-project > div:first-child", key: { closest: ".workspace-project", attr: "data-testid", strip: "workspace-project-" } }, { name: "project-toggle", selector: '[data-testid^="project-toggle-"]', key: { self: !0, attr: "data-testid", strip: "project-toggle-" } }, { name: "project-chevron", selector: '[data-testid^="project-toggle-"] > svg:not([data-testid])', key: { closest: '[data-testid^="project-toggle-"]', attr: "data-testid", strip: "project-toggle-" } }, { name: "project-folder-icon", selector: '[data-testid="project-folder-icon"]', key: { closest: '[data-testid^="project-toggle-"]', attr: "data-testid", strip: "project-toggle-" } }, { name: "project-name", selector: '[data-testid^="project-toggle-"] strong', key: { closest: '[data-testid^="project-toggle-"]', attr: "data-testid", strip: "project-toggle-" } }, { name: "project-branch", selector: '[data-testid^="project-toggle-"] > span.whitespace-nowrap', key: { closest: '[data-testid^="project-toggle-"]', attr: "data-testid", strip: "project-toggle-" } }, { name: "project-dirty-mark", selector: '[data-testid^="project-toggle-"] > span[title="Uncommitted changes"]', key: { closest: '[data-testid^="project-toggle-"]', attr: "data-testid", strip: "project-toggle-" } }, { name: "project-rollup", selector: '[data-testid^="project-rollup-"]', key: { self: !0, attr: "data-testid", strip: "project-rollup-" } }, { name: "project-rollup-badge", selector: '[data-testid^="project-rollup-"] > span', key: { closest: '[data-testid^="project-rollup-"]', attr: "data-testid", strip: "project-rollup-" } }, { name: "project-menu-button", selector: '[data-testid^="workspace-project-menu-"]', key: { self: !0, attr: "data-testid", strip: "workspace-project-menu-" } }, { name: "project-add-button", selector: ".workspace-project > div:first-child .worktree-menu__btn", key: { closest: ".workspace-project", attr: "data-testid", strip: "workspace-project-" } }, { name: "project-workspaces", selector: ".workspace-project__workspaces", key: { closest: ".workspace-project", attr: "data-testid", strip: "workspace-project-" } }, { name: "workspace", selector: '[data-testid="workspace-tree-root"] [data-testid^="workspace-entry-"]', key: { self: !0, attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-button", selector: '[data-testid="workspace-tree-root"] button.workspace-entry__button', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-icon", selector: '[data-testid="workspace-tree-root"] [data-testid="workspace-checkout-icon"]', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-name", selector: '[data-testid="workspace-tree-root"] strong[title="Double-click to rename"]', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-branch", selector: '[data-testid="workspace-tree-root"] button.workspace-entry__button > span.items-baseline > span', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-dirty-mark", selector: '[data-testid="workspace-tree-root"] button.workspace-entry__button > span[title="Uncommitted changes"]', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-pinned-label", selector: '[data-testid="workspace-tree-root"] button.workspace-entry__button > span.shrink-0:not([title])', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "hidden-worktrees-button", selector: '[data-testid^="workspace-hidden-"]', key: { self: !0, attr: "data-testid", strip: "workspace-hidden-" } }, { name: "session-row", selector: 'div[class~="group/row"]', key: { find: 'button[data-testid^="workspace-session-"]:not([data-testid^="workspace-session-close-"])', attr: "data-testid", strip: "workspace-session-" } }, { name: "session-button", selector: 'button[data-testid^="workspace-session-"]:not([data-testid^="workspace-session-close-"])', key: { self: !0, attr: "data-testid", strip: "workspace-session-" } }, { name: "session-mark", selector: ".agent-mark", key: { closest: 'button[data-testid^="workspace-session-"]', attr: "data-testid", strip: "workspace-session-" } }, { name: "session-mark-icon", selector: ".agent-mark > span > *", key: { closest: 'button[data-testid^="workspace-session-"]', attr: "data-testid", strip: "workspace-session-" } }, { name: "session-title", selector: 'button[data-testid^="workspace-session-"] > span.whitespace-nowrap', key: { closest: 'button[data-testid^="workspace-session-"]', attr: "data-testid", strip: "workspace-session-" } }, { name: "status-row-title", selector: "button[data-session] span.truncate:not([data-testid])", key: { closest: 'button[data-testid^="workspace-session-"]', attr: "data-testid", strip: "workspace-session-" } }, { name: "status-row-detail", selector: '[data-testid="status-row-detail"]', key: { closest: 'button[data-testid^="workspace-session-"]', attr: "data-testid", strip: "workspace-session-" } }, { name: "session-state-badge", selector: '[data-testid^="session-state-"]', key: { self: !0, attr: "data-testid", strip: "session-state-" } }, { name: "session-menu-button", selector: '[data-testid^="session-menu-button-"]', key: { self: !0, attr: "data-testid", strip: "session-menu-button-" } }, { name: "session-fold-button", selector: '[data-testid^="session-fold-"]', key: { self: !0, attr: "data-testid", strip: "session-fold-" } }, { name: "session-elbow", selector: '[data-testid^="session-elbow-"]', key: { self: !0, attr: "data-testid", strip: "session-elbow-" } }, { name: "session-rollup", selector: '[data-testid^="session-rollup-"]', key: { self: !0, attr: "data-testid", strip: "session-rollup-" } }, { name: "chats", selector: '[data-testid="workspace-chats"]' }, { name: "chats-header", selector: '[data-testid="workspace-chats"] > div:first-child' }, { name: "chats-toggle", selector: '[data-testid="workspace-chats-collapse"]' }, { name: "chats-label", selector: '[data-testid="workspace-chats-collapse"]', textRange: !0 }, { name: "chats-chevron", selector: '[data-testid="workspace-chats-collapse"] > svg' }, { name: "chats-menu-button", selector: '[data-testid="workspace-chats-menu"]' }, { name: "chats-new-button", selector: '[data-testid="workspace-chats-new"]' }, { name: "chats-new-icon", selector: '[data-testid="workspace-chats-new"] > svg' }, { name: "status-view", selector: '[data-testid="workspace-status-view"]' }, { name: "status-section", selector: '[data-testid^="status-section-"]:not([data-testid^="status-section-title-"])', key: { self: !0, attr: "data-testid", strip: "status-section-" } }, { name: "status-heading", selector: '[data-testid^="status-section-title-"], [data-testid="status-no-sessions-title"]', key: { self: !0, attr: "data-testid" } }, { name: "status-heading-dot", selector: '[data-testid^="status-section-title-"] > span:first-child, [data-testid="status-no-sessions-title"] > span:first-child', key: { closest: '[data-testid^="status-section-title-"], [data-testid="status-no-sessions-title"]', attr: "data-testid" } }, { name: "status-heading-label", selector: '[data-testid^="status-section-title-"] > span:nth-child(2), [data-testid="status-no-sessions-title"] > span:nth-child(2)', key: { closest: '[data-testid^="status-section-title-"], [data-testid="status-no-sessions-title"]', attr: "data-testid" } }, { name: "status-heading-count", selector: '[data-testid^="status-section-title-"] > span[aria-label], [data-testid="status-no-sessions-title"] > span[aria-label]', key: { closest: '[data-testid^="status-section-title-"], [data-testid="status-no-sessions-title"]', attr: "data-testid" } }, { name: "status-heading-note", selector: '[data-testid^="status-section-title-"] > span.truncate, [data-testid="status-no-sessions-title"] > span.truncate', key: { closest: '[data-testid^="status-section-title-"], [data-testid="status-no-sessions-title"]', attr: "data-testid" } }, { name: "status-project", selector: 'div[data-testid^="status-project-"]', key: { self: !0, attr: "data-testid", strip: "status-project-" } }, { name: "status-project-header", selector: 'div[data-testid^="status-project-"] > div:first-child', key: { closest: 'div[data-testid^="status-project-"]', attr: "data-testid", strip: "status-project-" } }, { name: "status-project-icon", selector: 'div[data-testid^="status-project-"] > div:first-child > svg', key: { closest: 'div[data-testid^="status-project-"]', attr: "data-testid", strip: "status-project-" } }, { name: "status-project-title", selector: '[data-testid="status-project-title"]', key: { closest: 'div[data-testid^="status-project-"]', attr: "data-testid", strip: "status-project-" } }, { name: "status-empty-project", selector: '[data-testid^="status-empty-project-"]', key: { self: !0, attr: "data-testid", strip: "status-empty-project-" } }, { name: "status-empty-project-icon", selector: '[data-testid^="status-empty-project-"] > button:first-child > svg', key: { closest: '[data-testid^="status-empty-project-"]', attr: "data-testid", strip: "status-empty-project-" } }, { name: "status-empty-project-title", selector: '[data-testid^="status-empty-project-"] > button > span.whitespace-nowrap', key: { closest: '[data-testid^="status-empty-project-"]', attr: "data-testid", strip: "status-empty-project-" } }, { name: "settings-bar", selector: "aside.sidebar > div:last-child" }, { name: "settings-gear", selector: '[data-testid="settings-gear"]' }, { name: "settings-gear-icon", selector: '[data-testid="settings-gear"] > svg' }], tabs: [{ name: "tab-strip", selector: '[data-testid="tab-bar"]' }, { name: "tab-slot", selector: "[data-tab-entry]", key: { self: !0, attr: "data-tab-entry" } }, { name: "tab-separator", selector: '[data-testid="tab-separator"]', key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab", selector: "button.tab-bar__tab", key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-icon", selector: 'button.tab-bar__tab > span[aria-hidden="true"]', key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-icon-glyph", selector: 'button.tab-bar__tab > span[aria-hidden="true"] > *', key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-label", selector: "button.tab-bar__tab > span.truncate", key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-dirty", selector: 'button.tab-bar__tab > span[aria-label="unsaved changes"]', key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-close", selector: '[data-tab-entry] > button[aria-label^="Close"]', key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-close-glyph", selector: '[data-tab-entry] > button[aria-label^="Close"] > svg', key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-new", selector: '[data-testid="tab-new"]' }, { name: "tab-new-glyph", selector: '[data-testid="tab-new"] > svg' }], status: [{ name: "status-bar", selector: "footer.status-bar" }, { name: "status-location", selector: ".status-bar__location" }, { name: "status-dot", selector: ".status-bar__location > span:first-child" }, { name: "status-host", selector: '[data-testid="status-host"]' }, { name: "status-cwd", selector: ".status-item--cwd" }, { name: "status-branch", selector: ".status-bar__branch" }, { name: "status-branch-icon", selector: ".status-bar__branch > svg" }, { name: "status-branch-name", selector: ".status-bar__branch > span" }, { name: "status-details", selector: ".status-bar__details" }, { name: "zoom-indicator", selector: '[data-testid="zoom-indicator"]' }, { name: "status-detail", selector: ".status-bar__details > span" }, { name: "status-usage", selector: ".status-bar__usage" }, { name: "usage-summary", selector: '[data-testid="usage-summary"]' }, { name: "usage-unavailable", selector: '[data-testid="usage-summary"] > span:only-child' }, { name: "usage-account", selector: '[data-testid="usage-summary"] > span.flex' }, { name: "usage-account-name", selector: '[data-testid="usage-summary"] > span.flex > span:first-child' }, { name: "usage-window", selector: '[data-testid="usage-summary"] > span.flex > span:not(:first-child)' }, { name: "status-connection", selector: '[data-testid="status-connection"]' }, { name: "status-connection-glyph", selector: '[data-testid="status-connection"] > svg' }], navigator: [{ name: "navigator-scrim", selector: "body > div.fixed.inset-0" }, { name: "navigator-panel", selector: '[data-testid="navigator"]' }, { name: "navigator-input", selector: '[data-testid="navigator-input"]' }, { name: "navigator-chips", selector: '[data-testid="navigator"] > div:nth-child(2)' }, { name: "navigator-chip", selector: '[data-testid^="navigator-filter-"]', key: { self: !0, attr: "data-testid", strip: "navigator-filter-" } }, { name: "navigator-list", selector: '[data-testid="navigator"] > div:nth-child(3)' }, { name: "navigator-notice", selector: '[data-testid="navigator"] > div:nth-child(3) > p[role]' }, { name: "navigator-empty", selector: '[data-testid="navigator"] div.text-center' }, { name: "navigator-command", selector: '[data-testid^="navigator-command-"]', key: { self: !0, attr: "data-testid", strip: "navigator-command-" } }, { name: "navigator-command-title", selector: '[data-testid^="navigator-command-"] > span:first-child', key: { closest: '[data-testid^="navigator-command-"]', attr: "data-testid", strip: "navigator-command-" } }, { name: "navigator-command-detail", selector: '[data-testid^="navigator-command-"] > span:last-child', key: { closest: '[data-testid^="navigator-command-"]', attr: "data-testid", strip: "navigator-command-" } }, { name: "navigator-row", selector: '[data-testid^="navigator-row-"]', key: { self: !0, attr: "data-testid", strip: "navigator-row-" } }, { name: "navigator-row-dot", selector: '[data-testid^="navigator-row-"] > :first-child', key: { closest: '[data-testid^="navigator-row-"]', attr: "data-testid", strip: "navigator-row-" } }, { name: "navigator-row-title", selector: '[data-testid^="navigator-row-"] > span:nth-child(2)', key: { closest: '[data-testid^="navigator-row-"]', attr: "data-testid", strip: "navigator-row-" } }, { name: "navigator-row-detail", selector: '[data-testid^="navigator-row-"] > span:last-child', key: { closest: '[data-testid^="navigator-row-"]', attr: "data-testid", strip: "navigator-row-" } }, { name: "navigator-note", selector: '[data-testid="navigator"] > p:last-child' }], "pane-menu": [{ name: "pane-menu", selector: '[data-testid="pane-context-menu"]' }, { name: "pane-menu-item", selector: '[data-testid="pane-context-menu"] > button', key: { self: !0, attr: "data-testid", strip: "pane-menu-" } }, { name: "pane-menu-divider", selector: '[data-testid="pane-context-menu"] > div.h-px' }, { name: "pane-menu-rename-row", selector: '[data-testid="pane-context-menu"] > div.flex' }, { name: "pane-menu-rename-input", selector: '[data-testid="pane-menu-rename-input"]' }, { name: "pane-menu-rename-confirm", selector: '[data-testid="pane-menu-rename-confirm"]' }], confirm: [{ name: "confirm-scrim", selector: "body > div.fixed.inset-0" }, { name: "confirm-panel", selector: '[data-testid="confirm-dialog"]' }, { name: "confirm-message", selector: ".confirm-dialog__message" }, { name: "confirm-extra", selector: '[data-testid="confirm-dialog"] > :not(.confirm-dialog__message):not(div.flex)' }, { name: "confirm-buttons", selector: '[data-testid="confirm-dialog"] > div.flex' }, { name: "confirm-cancel", selector: '[data-testid="confirm-cancel"]' }, { name: "confirm-accept", selector: '[data-testid="confirm-accept"]' }], dialog: [{ name: "dialog-scrim", selector: "body > div.fixed.inset-0" }, { name: "dialog-panel", selector: '[data-testid="file-name-dialog"]' }, { name: "dialog-title", selector: '[data-testid="file-name-dialog"] > h2' }, { name: "dialog-input", selector: '[data-testid="file-name-input"]' }, { name: "dialog-hint", selector: '[data-testid="file-name-dialog"] > p:not([role])' }, { name: "dialog-error", selector: '[data-testid="file-name-dialog"] > p[role="alert"]' }, { name: "dialog-buttons", selector: '[data-testid="file-name-dialog"] > div.flex' }, { name: "dialog-cancel", selector: '[data-testid="file-name-dialog"] > div.flex > button:first-child' }, { name: "dialog-confirm", selector: '[data-testid="file-name-confirm"]' }], toast: [{ name: "toast-stack", selector: '[data-testid="toast"]' }, { name: "toast-card", selector: '[data-testid="toast"] .animate-toast-in' }, { name: "toast-open", selector: '[data-testid^="toast-"]:not([data-testid^="toast-dismiss-"])' }, { name: "toast-mark", selector: '[data-testid^="toast-"]:not([data-testid^="toast-dismiss-"]) > :first-child' }, { name: "toast-heading", selector: '[data-testid^="toast-"]:not([data-testid^="toast-dismiss-"]) > span.min-w-0 > span:first-child' }, { name: "toast-detail", selector: '[data-testid^="toast-"]:not([data-testid^="toast-dismiss-"]) > span.min-w-0 > span:nth-child(2)' }, { name: "toast-dismiss", selector: '[data-testid^="toast-dismiss-"]' }, { name: "toast-dismiss-glyph", selector: '[data-testid^="toast-dismiss-"] > svg' }], "pane-header": [{ name: "pane-header", selector: '[data-testid^="pane-header-"]', key: { self: !0, attr: "data-testid", strip: "pane-header-" } }, { name: "pane-header-icon", selector: '[data-testid^="pane-header-"] > span.shrink-0:not([data-testid])', key: { closest: '[data-testid^="pane-header-"]', attr: "data-testid", strip: "pane-header-" } }, { name: "pane-header-icon-glyph", selector: '[data-testid^="pane-header-"] > span.shrink-0:not([data-testid]) > *', key: { closest: '[data-testid^="pane-header-"]', attr: "data-testid", strip: "pane-header-" } }, { name: "pane-header-name", selector: '[data-testid^="pane-header-"] > span.truncate', key: { closest: '[data-testid^="pane-header-"]', attr: "data-testid", strip: "pane-header-" } }, { name: "pane-header-state", selector: '[data-testid^="pane-header-"] > span.flex[title]', key: { closest: '[data-testid^="pane-header-"]', attr: "data-testid", strip: "pane-header-" } }, { name: "pane-header-state-dot", selector: '[data-testid^="pane-header-"] > span.flex[title] > span.rounded-full', key: { closest: '[data-testid^="pane-header-"]', attr: "data-testid", strip: "pane-header-" } }, { name: "pane-header-state-word", selector: '[data-testid^="pane-header-"] > span.flex[title] > span.truncate', key: { closest: '[data-testid^="pane-header-"]', attr: "data-testid", strip: "pane-header-" } }, { name: "pane-controls", selector: '[data-testid^="tile-controls-"]', key: { self: !0, attr: "data-testid", strip: "tile-controls-" } }, { name: "pane-expand", selector: '[data-testid^="tile-expand-"]', key: { self: !0, attr: "data-testid", strip: "tile-expand-" } }, { name: "pane-expand-glyph", selector: '[data-testid^="tile-expand-"] > svg', key: { closest: '[data-testid^="tile-expand-"]', attr: "data-testid", strip: "tile-expand-" } }, { name: "pane-close", selector: '[data-testid^="tile-close-"]', key: { self: !0, attr: "data-testid", strip: "tile-close-" } }, { name: "pane-close-glyph", selector: '[data-testid^="tile-close-"] > svg', key: { closest: '[data-testid^="tile-close-"]', attr: "data-testid", strip: "tile-close-" } }, { name: "pane-corner", selector: "div.pointer-events-auto.absolute" }], "new-session": [{ name: "launcher", selector: ".new-session-popover" }, { name: "launcher-filter", selector: '[data-testid="new-tab-filter"]' }, { name: "launcher-list", selector: "#new-tab-launcher-list" }, { name: "launcher-option", selector: '[role="option"]', key: { self: !0, attr: "data-testid" } }, { name: "launcher-option-icon", selector: '[role="option"] > :first-child:not(span.flex-1):not(kbd)', key: { closest: '[role="option"]', attr: "data-testid" } }, { name: "launcher-option-label", selector: '[role="option"] > span.flex-1', key: { closest: '[role="option"]', attr: "data-testid" } }, { name: "launcher-option-key", selector: '[role="option"] > kbd', key: { closest: '[role="option"]', attr: "data-testid" } }, { name: "launcher-note", selector: ".new-session-popover p[role]" }, { name: "agent-select", selector: '[data-testid="new-session-popover-agent"]' }, { name: "agent-manage", selector: ".new-session-popover > div:first-child > button:not([data-testid])" }, { name: "project-option", selector: '[data-testid^="project-option-"]', key: { self: !0, attr: "data-testid", strip: "project-option-" } }, { name: "project-option-name", selector: '[data-testid^="project-option-"]', key: { closest: '[data-testid^="project-option-"]', attr: "data-testid", strip: "project-option-" }, textRange: !0 }, { name: "project-option-path", selector: '[data-testid^="project-option-"] > span', key: { closest: '[data-testid^="project-option-"]', attr: "data-testid", strip: "project-option-" } }], "tab-menu": [{ name: "tab-menu", selector: '[data-testid="tab-split-menu"]' }, { name: "tab-menu-item", selector: '[data-testid="tab-split-menu"] > button', key: { self: !0, attr: "data-testid" } }, { name: "tab-menu-show-beside", selector: '[data-testid="tab-menu-show-beside"]' }, { name: "tab-menu-beside-list", selector: '[data-testid="tab-split-menu"] [role="menu"]' }, { name: "tab-menu-beside-item", selector: '[data-testid="tab-split-menu"] [role="menu"] > button', key: { self: !0, attr: "data-testid" } }, { name: "tab-menu-item-label", selector: '[data-testid="tab-split-menu"] [role="menu"] > button > span.block', key: { closest: '[data-testid="tab-split-menu"] [role="menu"] > button', attr: "data-testid" } }, { name: "tab-menu-empty", selector: '[data-testid="tab-menu-empty"]' }, { name: "tab-menu-divider", selector: '[data-testid="tab-split-menu"] > div.h-px' }, { name: "tab-menu-rename-form", selector: '[data-testid="tab-split-menu"] > form' }, { name: "tab-menu-rename-input", selector: '[data-testid="tab-menu-rename-input"]' }, { name: "tab-menu-rename-save", selector: '[data-testid="tab-split-menu"] > form > button' }], select: [{ name: "select-field", selector: '[data-testid="select-demo"]' }, { name: "select-field-label", selector: '[data-testid="select-demo"] > span.truncate' }, { name: "select-chevron", selector: '[data-testid="select-demo"] > svg' }, { name: "select-list", selector: '[role="listbox"]' }, { name: "select-option", selector: '[role="listbox"] > [role="option"]', key: { self: !0, attr: "data-value" } }, { name: "select-option-label", selector: '[role="listbox"] > [role="option"] > span.truncate', key: { closest: '[role="option"]', attr: "data-value" } }, { name: "select-option-check", selector: '[role="listbox"] > [role="option"] > span[aria-hidden]', key: { closest: '[role="option"]', attr: "data-value" } }], "keybind-help": [{ name: "keybind-help-scrim", selector: "body > div.fixed.inset-0" }, { name: "keybind-help-panel", selector: '[data-testid="keybind-help"]' }, { name: "keybind-help-header", selector: '[data-testid="keybind-help"] > div:first-child' }, { name: "keybind-help-title", selector: '[data-testid="keybind-help"] h2' }, { name: "keybind-help-close", selector: '[aria-label="Close keybind help"]' }, { name: "keybind-help-close-glyph", selector: '[aria-label="Close keybind help"] > svg' }, { name: "keybind-help-search", selector: '[data-testid="keybind-help-search"]' }, { name: "keybind-help-list", selector: '[data-testid="keybind-help"] > div:last-child' }, { name: "keybind-help-empty", selector: '[data-testid="keybind-help"] div.text-center' }, { name: "keybind-help-group", selector: '[data-testid="keybind-help"] section' }, { name: "keybind-help-group-title", selector: '[data-testid="keybind-help"] section > h3' }, { name: "keybind-help-row", selector: '[data-testid="keybind-help"] li' }, { name: "keybind-help-keys", selector: '[data-testid="keybind-help"] li > kbd' }, { name: "keybind-help-description", selector: '[data-testid="keybind-help"] li > span' }], launcher: [{ name: "launcher-scrim", selector: "body > div.fixed.inset-0" }, { name: "launcher-panel", selector: '[data-testid="new-session-dialog"]' }, { name: "launcher-title", selector: '[data-testid="new-session-dialog"] > p' }, { name: "launcher-filter", selector: '[data-testid="new-session-filter"]' }, { name: "launcher-list", selector: "#new-session-list" }, { name: "launcher-row", selector: '[data-testid^="new-session-row-"]', key: { self: !0, attr: "data-testid", strip: "new-session-row-" } }, { name: "launcher-row-icon", selector: '[data-testid^="new-session-row-"] > :first-child:not(span):not(kbd)', key: { closest: '[data-testid^="new-session-row-"]', attr: "data-testid", strip: "new-session-row-" } }, { name: "launcher-row-label", selector: '[data-testid^="new-session-row-"] > span.shrink-0', key: { closest: '[data-testid^="new-session-row-"]', attr: "data-testid", strip: "new-session-row-" } }, { name: "launcher-row-detail", selector: '[data-testid^="new-session-row-"] > span.ml-auto', key: { closest: '[data-testid^="new-session-row-"]', attr: "data-testid", strip: "new-session-row-" } }, { name: "launcher-row-key", selector: '[data-testid^="new-session-row-"] > kbd', key: { closest: '[data-testid^="new-session-row-"]', attr: "data-testid", strip: "new-session-row-" } }, { name: "launcher-note", selector: "#new-session-list > p" }], "session-menu": [{ name: "tab-menu", selector: '[data-testid="tab-split-menu"]' }, { name: "tab-menu-item", selector: '[data-testid="tab-split-menu"] > button', key: { self: !0, attr: "data-testid" } }, { name: "tab-menu-show-beside", selector: '[data-testid="tab-menu-show-beside"]' }, { name: "tab-menu-beside-list", selector: '[data-testid="tab-split-menu"] [role="menu"]' }, { name: "tab-menu-beside-item", selector: '[data-testid="tab-split-menu"] [role="menu"] > button', key: { self: !0, attr: "data-testid" } }, { name: "tab-menu-item-label", selector: '[data-testid="tab-split-menu"] [role="menu"] > button > span.block', key: { closest: '[data-testid="tab-split-menu"] [role="menu"] > button', attr: "data-testid" } }, { name: "tab-menu-empty", selector: '[data-testid="tab-menu-empty"]' }, { name: "tab-menu-divider", selector: '[data-testid="tab-split-menu"] > div.h-px' }], "tab-drag": [{ name: "tab-drag-layer", selector: '[data-testid="tab-drag-layer"]' }, { name: "tab-drag-pane", selector: '[data-testid="tab-drag-layer"] > div.bg-surface-1\\/30' }, { name: "tab-drop-zone", selector: '[data-testid="tab-drop-zone"]', key: { self: !0, attr: "data-zone" } }, { name: "tab-drop-label", selector: '[data-testid="tab-drop-zone"] > span' }, { name: "tab-drag-ghost", selector: '[data-testid="tab-drag-ghost"]' }], start: [{ name: "start-panel", selector: '[data-testid="no-session-panel"], [data-testid="cli-start-panel"]' }, { name: "start-column", selector: '[data-testid$="-panel"] > div' }, { name: "start-logo", selector: '[data-testid="no-session-panel"] img' }, { name: "start-name", selector: '[data-testid$="-panel"] h1, [data-testid="no-session-panel"] h1, [data-testid="no-session-panel"] h2' }, { name: "start-hint", selector: '[data-testid$="-panel"] p' }, { name: "start-target", selector: '[data-testid="workspace-start-target"], [data-testid="cli-start-target"]' }, { name: "start-action", selector: '[data-testid="home-add-project"], [data-testid="no-session-create"], [data-testid^="workspace-start-"]:not([data-testid="workspace-start-target"]), [data-testid^="cli-start-agent-"]', key: { self: !0, attr: "data-testid" } }, { name: "start-status", selector: '[role="status"], [role="alert"]' }, { name: "start-status-action", selector: '[role="status"] > button, [role="alert"] > button' }, { name: "start-link", selector: '[data-testid$="-panel"] button.text-subtext-0' }, { name: "start-shortcut-row", selector: '[data-testid="no-session-panel"] dl > div' }, { name: "start-shortcut-label", selector: '[data-testid="no-session-panel"] dl dt' }, { name: "start-shortcut-key", selector: '[data-testid="no-session-panel"] dl kbd' }], "folder-browser": [{ name: "folder-browser", selector: '[data-testid="dir-browser"]' }, { name: "folder-browser-mode-toggle", selector: '[data-testid="dir-browser-mode-toggle"]' }, { name: "folder-browser-up", selector: '[data-testid="dir-browser-up"]' }, { name: "folder-browser-crumbs", selector: '[data-testid="dir-browser"] span.min-w-0.flex-1' }, { name: "folder-browser-crumb", selector: '[data-testid="dir-browser"] span.min-w-0.flex-1 button' }, { name: "folder-browser-filter", selector: '[data-testid="dir-browser-filter"]' }, { name: "folder-browser-list", selector: '[data-testid="dir-browser"] div.overflow-y-auto' }, { name: "folder-browser-entry", selector: '[data-testid^="dir-browser-entry-"]', key: { self: !0, attr: "data-testid", strip: "dir-browser-entry-" } }, { name: "folder-browser-entry-name", selector: '[data-testid^="dir-browser-entry-"] > span:first-child', key: { closest: '[data-testid^="dir-browser-entry-"]', attr: "data-testid", strip: "dir-browser-entry-" } }, { name: "folder-browser-git", selector: '[data-testid^="dir-browser-entry-"] > span:last-child:not(:first-child)', key: { closest: '[data-testid^="dir-browser-entry-"]', attr: "data-testid", strip: "dir-browser-entry-" } }, { name: "folder-browser-note", selector: '[data-testid="dir-browser"] div.overflow-y-auto > div' }, { name: "folder-browser-use", selector: '[data-testid="dir-browser-use"]' }, { name: "folder-browser-path-input", selector: '[data-testid="project-path-input"]' }], instructions: [{ name: "instructions-scrim", selector: "body > div.fixed.inset-0" }, { name: "instructions-panel", selector: '[data-testid="instructions-dialog"]' }, { name: "instructions-title", selector: '[data-testid="instructions-dialog"] > h2' }, { name: "instructions-intro", selector: '[data-testid="instructions-dialog"] > p' }, { name: "instructions-label", selector: '[data-testid="instructions-dialog"] > label > span:first-child' }, { name: "instructions-count", selector: '[data-testid="instructions-count"]' }, { name: "instructions-text", selector: '[data-testid="instructions-text"]' }, { name: "instructions-folders", selector: '[data-testid="instructions-folders"]' }, { name: "instructions-error", selector: '[data-testid="instructions-error"]' }, { name: "instructions-cancel", selector: '[data-testid="instructions-dialog"] > div.flex.justify-end > button:first-child' }, { name: "instructions-save", selector: '[data-testid="instructions-save"]' }], memory: [{ name: "memory-scrim", selector: "body > div.fixed.inset-0", key: { self: !0, attr: "data-testid" } }, { name: "memory-panel", selector: '[data-testid="memory-dialog"]' }, { name: "memory-title", selector: '[data-testid="memory-dialog"] > h2' }, { name: "memory-intro", selector: '[data-testid="memory-dialog"] > p' }, { name: "memory-caps", selector: '[data-testid="memory-caps"]' }, { name: "memory-new", selector: '[data-testid="memory-new"]' }, { name: "memory-enabled", selector: '[data-testid="memory-enabled"]' }, { name: "memory-enabled-label", selector: '[data-testid="memory-dialog"] > label.flex > span' }, { name: "memory-note", selector: '[data-testid="memory-dialog"] > span.text-subtext-0' }, { name: "memory-row", selector: '[data-testid^="memory-row-"]', key: { self: !0, attr: "data-testid", strip: "memory-row-" } }, { name: "memory-open", selector: '[data-testid^="memory-open-"]', key: { self: !0, attr: "data-testid", strip: "memory-open-" } }, { name: "memory-file-title", selector: '[data-testid^="memory-row-"] button > span:first-child', key: { closest: '[data-testid^="memory-row-"]', attr: "data-testid", strip: "memory-row-" } }, { name: "memory-file-summary", selector: '[data-testid^="memory-row-"] button > span.truncate', key: { closest: '[data-testid^="memory-row-"]', attr: "data-testid", strip: "memory-row-" } }, { name: "memory-file-meta", selector: '[data-testid^="memory-row-"] button > span:last-child', key: { closest: '[data-testid^="memory-row-"]', attr: "data-testid", strip: "memory-row-" } }, { name: "memory-delete", selector: '[data-testid^="memory-delete-"]', key: { self: !0, attr: "data-testid", strip: "memory-delete-" } }, { name: "memory-error", selector: '[data-testid="memory-error"]' }, { name: "memory-close", selector: '[data-testid="memory-dialog"] > div.flex.justify-end > button' }, { name: "memory-file-name", selector: '[data-testid="memory-file-name"]' }, { name: "memory-name", selector: '[data-testid="memory-name"]' }, { name: "memory-count", selector: '[data-testid="memory-count"]' }, { name: "memory-text", selector: '[data-testid="memory-text"]' }, { name: "memory-conflict", selector: '[data-testid="memory-conflict"]' }, { name: "memory-reload", selector: '[data-testid="memory-reload"]' }, { name: "memory-back", selector: '[data-testid="memory-back"]' }, { name: "memory-save", selector: '[data-testid="memory-save"]' }, { name: "memory-confirm", selector: '[data-testid="confirm-dialog"]' }, { name: "memory-confirm-message", selector: ".confirm-dialog__message" }], worktree: [{ name: "worktree-plus", selector: '[data-testid^="worktree-menu-"]' }, { name: "worktree-popover", selector: '[role="dialog"][aria-label="Git worktrees"]' }, { name: "worktree-heading", selector: '[role="dialog"][aria-label="Git worktrees"] > div:first-child > span:first-child' }, { name: "worktree-project", selector: '[role="dialog"][aria-label="Git worktrees"] > div:first-child > span:last-child' }, { name: "worktree-list", selector: '[role="dialog"][aria-label="Git worktrees"] > div.overflow-y-auto' }, { name: "worktree-note", selector: '[role="dialog"][aria-label="Git worktrees"] > div.overflow-y-auto > div:not(.worktree-menu__entry)' }, { name: "worktree-entry", selector: '[data-testid^="worktree-entry-"]', key: { self: !0, attr: "data-testid", strip: "worktree-entry-" } }, { name: "worktree-entry-branch", selector: ".worktree-menu__entry-branch", key: { closest: '[data-testid^="worktree-entry-"]', attr: "data-testid", strip: "worktree-entry-" } }, { name: "worktree-badge", selector: '[data-testid^="worktree-entry-"] .worktree-menu__entry-branch > span', key: { closest: '[data-testid^="worktree-entry-"]', attr: "data-testid", strip: "worktree-entry-" } }, { name: "worktree-entry-path", selector: ".worktree-menu__entry-path", key: { closest: '[data-testid^="worktree-entry-"]', attr: "data-testid", strip: "worktree-entry-" } }, { name: "worktree-open", selector: '[data-testid^="worktree-open-"]', key: { self: !0, attr: "data-testid", strip: "worktree-open-" } }, { name: "worktree-remove", selector: '[data-testid^="worktree-remove-"]', key: { self: !0, attr: "data-testid", strip: "worktree-remove-" } }, { name: "worktree-error", selector: '[data-testid="worktree-error"]' }, { name: "worktree-new", selector: '[data-testid="worktree-new"]' }, { name: "worktree-name-input", selector: '[data-testid="worktree-name-input"]' }, { name: "worktree-start-input", selector: '[data-testid="worktree-start-input"]' }, { name: "worktree-branch-input", selector: '[data-testid="worktree-branch-input"]' }, { name: "worktree-parent-select", selector: '[data-testid="worktree-parent-select"]' }, { name: "worktree-new-branch", selector: '[data-testid="worktree-new-branch"]' }, { name: "worktree-path-input", selector: '[data-testid="worktree-path-input"]' }, { name: "worktree-agent-select", selector: '[data-testid="worktree-agent-select"]' }, { name: "worktree-create-cancel", selector: '[data-testid="worktree-create-cancel"]' }, { name: "worktree-create-submit", selector: '[data-testid="worktree-create-submit"]' }, { name: "worktree-confirm", selector: '[data-testid="confirm-dialog"]' }, { name: "worktree-confirm-message", selector: ".confirm-dialog__message" }, { name: "worktree-confirm-accept", selector: '[data-testid="confirm-accept"]' }, { name: "worktree-confirm-cancel", selector: '[data-testid="confirm-cancel"]' }], "terminal-search": [{ name: "terminal-frame", selector: '[data-testid="persistent-agent-terminal"]' }, { name: "term-search", selector: '[data-testid="term-search"]' }, { name: "term-search-input", selector: '[data-testid="term-search-input"]' }, { name: "term-search-button", selector: '[data-testid="term-search"] > button', key: { self: !0, attr: "title" } }], "agent-control": [{ name: "terminal-frame", selector: '[data-testid="persistent-agent-terminal"]' }, { name: "agent-control-chip", selector: '[data-testid="agent-control-chip"]' }, { name: "agent-control-label", selector: '[data-testid="agent-control-chip"] > span' }, { name: "agent-control-button", selector: '[data-testid="agent-control-chip"] > button' }, { name: "agent-control-error", selector: ".terminal__cli-error" }, { name: "agent-control-ended", selector: ".terminal__exited", key: { self: !0, attr: "data-testid" } }, { name: "agent-control-ended-text", selector: ".terminal__exited-text" }, { name: "agent-control-ended-button", selector: ".terminal__exited-actions > button", key: { self: !0, attr: "data-testid" } }], "phone-size": [{ name: "terminal-frame", selector: '[data-testid="persistent-agent-terminal"]' }, { name: "phone-size-notice", selector: '[data-testid="phone-size-notice"]' }, { name: "phone-size-chip", selector: '[data-testid="phone-size-chip"]' }, { name: "phone-size-heading", selector: '[data-testid="phone-size-notice"] span.font-semibold' }, { name: "phone-size-text", selector: '[data-testid="phone-size-notice"] span:not(.font-semibold)' }, { name: "phone-size-fold", selector: '[aria-label="Keep phone size and hide this"]' }, { name: "phone-size-button", selector: '[data-testid="phone-size-notice"] div.flex.flex-wrap > button, [data-testid="phone-size-chip"] > button' }], window: [{ name: "sidebar-card", selector: '[data-testid="sidebar-card"]' }, { name: "main-card", selector: '[data-testid="main-card"]' }, { name: "tools-card", selector: '[data-testid="tools-card"]' }, { name: "sidebar-toggle", selector: '[data-testid="sidebar-collapse-toggle"]' }, { name: "drawer-toggle", selector: '[data-testid="workspace-tools-toggle"]' }, { name: "resize-sidebar", selector: '[data-testid="resize-sidebar"]' }, { name: "resize-tools", selector: '[data-testid="resize-tools"]' }, { name: "tools-tab", selector: 'nav[aria-label="Files, Git and Browser"] > button' }, { name: "status-bar", selector: "footer.status-bar" }], settings: [{ name: "settings-modal", selector: '[data-testid="settings-modal"]' }, { name: "settings-nav-card", selector: '[data-testid="settings-modal"] > nav' }, { name: "settings-close", selector: '[data-testid="settings-close"]' }, { name: "settings-nav", selector: 'nav [data-testid^="settings-nav-"]', key: { self: !0, attr: "data-testid", strip: "settings-nav-" } }, { name: "settings-main-card", selector: '[data-testid="settings-modal"] > main' }, { name: "settings-search", selector: '[data-testid="settings-search"]' }, { name: "settings-title", selector: '[data-testid="settings-modal"] > main h1' }, { name: "settings-body", selector: '[data-testid="settings-modal"] .settings-modal__body' }, { name: "settings-group-title", selector: '[data-testid="settings-modal"] > main h3' }, { name: "settings-group-card", selector: '[data-testid="settings-modal"] > main section > div.rounded-ui' }, { name: "settings-row", selector: '[data-testid="settings-modal"] [data-setting-row]' }, { name: "settings-row-title", selector: '[data-testid="settings-modal"] [data-setting-row] > div:first-child > div:first-child' }, { name: "settings-row-description", selector: '[data-testid="settings-modal"] [data-setting-row] > div:first-child > div:nth-child(2)' }, { name: "settings-result-title", selector: '[data-testid^="settings-result-"] > h2' }], files: [{ name: "files-explorer", selector: '[data-testid="workspace-files-view"]' }, { name: "files-tree", selector: '[data-testid="workspace-file-tree-scroll"]' }, { name: "files-entry", selector: '[data-testid^="workspace-file-entry-"]', key: { self: !0, attr: "data-testid", strip: "workspace-file-entry-" } }, { name: "files-entry-icon", selector: '[data-testid^="workspace-file-entry-"] > svg[data-file-icon]', key: { closest: '[data-testid^="workspace-file-entry-"]', attr: "data-testid", strip: "workspace-file-entry-" } }, { name: "files-entry-name", selector: '[data-testid^="workspace-file-entry-"] > span.flex-1', key: { closest: '[data-testid^="workspace-file-entry-"]', attr: "data-testid", strip: "workspace-file-entry-" } }, { name: "files-pane", selector: '[data-testid="workspace-file-pane"]' }, { name: "files-file-title", selector: ".workspace-files__file-title > span:first-child" }, { name: "files-dirty", selector: '.workspace-files__file-title > span[title="Unsaved changes"]' }, { name: "files-save", selector: ".workspace-files__save" }, { name: "files-conflict", selector: '[data-testid="workspace-file-conflict"]' }, { name: "files-conflict-title", selector: '[data-testid="workspace-file-conflict"] > strong' }, { name: "files-conflict-action", selector: '[data-testid="workspace-file-conflict"] button' }, { name: "files-editor", selector: '[data-testid="workspace-file-editor-area"]' }, { name: "files-asset", selector: '[data-testid="workspace-file-asset"]' }, { name: "files-asset-header", selector: '[data-testid="workspace-file-asset"] > header' }, { name: "files-asset-title", selector: '[data-testid="workspace-file-asset"] > header > strong' }, { name: "files-image-viewer", selector: '[data-testid="workspace-image-viewer"]' }, { name: "files-image-toolbar", selector: '[data-testid="workspace-image-viewer"] > [role="toolbar"]' }, { name: "files-image-status", selector: '[data-testid="workspace-image-info"]' }] };
export {
  _4 as NAMED_ELEMENTS,
  Q0 as React,
  Nb as SCHEMA,
  w4 as STYLE_KEYS,
  k4 as describeToGpui,
  b4 as jsxRuntime,
  v4 as mount,
  y4 as reactDom,
  x4 as sdk
};
