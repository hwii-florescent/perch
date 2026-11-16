function oc(n, a) {
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
const E0 = /* @__PURE__ */ new Set(["hover", "focus", "focus-visible", "focus-within", "active", "disabled", "enabled", "checked"]), z0 = /* @__PURE__ */ new Set(["not", "is", "where", "has", "nth-child"]), N0 = /* @__PURE__ */ new Set(["first-child", "last-child", "only-child", "root", ...E0]);
function Ho(n) {
  return n.replace(/\\(?:([0-9a-fA-F]{1,6})\s?|([\s\S]))/g, (a, r, i) => r ? String.fromCodePoint(parseInt(r, 16)) : i);
}
function Dl(n, a) {
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
function T0(n, a) {
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
function cc(n) {
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
function C0(n, a) {
  const r = { tag: null, id: null, classes: [], attrs: [], pseudos: [], pseudoElement: null };
  let i = !1;
  for (; a < n.length; ) {
    const s = n[a];
    if (s === "*") {
      r.tag = "*", a++, i = !0;
      continue;
    }
    if (s === ".") {
      const [c, f] = Dl(n, a + 1);
      r.classes.push(c), a = f, i = !0;
      continue;
    }
    if (s === "#") {
      const [c, f] = Dl(n, a + 1);
      r.id = c, a = f, i = !0;
      continue;
    }
    if (s === "[") {
      const c = n.indexOf("]", a);
      if (c < 0) throw new ot(`unclosed [ in ${JSON.stringify(n)}`);
      const f = n.slice(a + 1, c).trim(), u = /^([^\s~^$*|=]+)\s*(?:([~^$*|]?=)\s*(?:"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'|([^\s"'\]]+)))?\s*(i)?$/.exec(f);
      if (!u) throw new ot(`cannot read the attribute selector [${f}]`);
      const m = u[3] ?? u[4] ?? u[5];
      r.attrs.push({ name: Ho(u[1]).toLowerCase(), op: u[2] ?? null, value: m === void 0 ? null : Ho(m) }), a = c + 1, i = !0;
      continue;
    }
    if (s === ":") {
      if (n[a + 1] === ":") {
        const [m, h] = Dl(n, a + 2), v = m.toLowerCase();
        if (v !== "before" && v !== "after") throw new ot(`::${v} is not supported`);
        if (r.pseudoElement = v, a = h, i = !0, a < n.length && !/[\s>]/.test(n[a])) throw new ot(`nothing may follow ::${v} in ${JSON.stringify(n)}`);
        break;
      }
      const [c, f] = Dl(n, a + 1);
      a = f;
      const u = c.toLowerCase();
      if ((u === "before" || u === "after") && n[a] !== "(") {
        if (r.pseudoElement = u, i = !0, a < n.length && !/[\s>]/.test(n[a])) throw new ot(`nothing may follow :${u} in ${JSON.stringify(n)}`);
        break;
      }
      if (n[a] === "(") {
        if (!z0.has(u)) throw new ot(`:${u}() is not supported`);
        const m = T0(n, a + 1), h = n.slice(a + 1, m).trim();
        if (a = m + 1, u === "nth-child") {
          if (!/^\d+$/.test(h)) throw new ot(`:nth-child(${h}) is not supported (only a number)`);
          r.pseudos.push({ name: u, n: Number(h) });
        } else {
          const v = cc(h).map(uc);
          if (u === "has" && v.some((y) => y.length !== 1)) throw new ot(`:has(${h}) is not supported (only a compound selector)`);
          r.pseudos.push({ name: u, list: v });
        }
      } else {
        if (!N0.has(u)) throw new ot(`:${u} is not supported`);
        r.pseudos.push({ name: u });
      }
      i = !0;
      continue;
    }
    if (/[A-Za-z_\-\\]/.test(s) && !i) {
      const [c, f] = Dl(n, a);
      r.tag = c.toLowerCase(), a = f, i = !0;
      continue;
    }
    break;
  }
  if (!i) throw new ot(`empty compound selector at ${a} in ${JSON.stringify(n)}`);
  return [r, a];
}
function uc(n) {
  const a = [];
  let r = 0, i = null;
  for (n = n.trim(); r < n.length; ) {
    const [s, c] = C0(n, r);
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
const Tf = /* @__PURE__ */ new Map();
function ji(n) {
  let a = Tf.get(n);
  return a || (a = cc(n).map(uc), Tf.set(n, a)), a;
}
function Op(n) {
  const a = [0, 0, 0], r = (i) => {
    a[0] += i[0], a[1] += i[1], a[2] += i[2];
  };
  for (const { compound: i } of n) {
    i.id && a[0]++, a[1] += i.classes.length + i.attrs.length, i.tag && i.tag !== "*" && a[2]++, i.pseudoElement && a[2]++;
    for (const s of i.pseudos)
      if (s.name !== "where")
        if (s.list) {
          const c = s.list.map(Op).sort((f, u) => u[0] - f[0] || u[1] - f[1] || u[2] - f[2])[0];
          r(c);
        } else a[1]++;
  }
  return a;
}
function A0(n, { name: a, op: r, value: i }) {
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
function Ir(n) {
  return n.parentElement ? n.parentElement.children : [n];
}
function Dp(n, a) {
  for (const r of n.children) if (a(r) || Dp(r, a)) return !0;
  return !1;
}
function Bp(n, a, r, i) {
  if ((a.pseudoElement ?? null) !== (i ? r.pseudo ?? null : null) || a.tag && a.tag !== "*" && n.tagName !== a.tag || a.id && n.getAttribute("id") !== a.id) return !1;
  if (a.classes.length) {
    const s = n.classSet ?? new Set(n.classList ?? []);
    for (const c of a.classes) if (!s.has(c)) return !1;
  }
  for (const s of a.attrs) if (!A0(n, s)) return !1;
  for (const s of a.pseudos)
    switch (s.name) {
      case "first-child":
        if (Ir(n)[0] !== n) return !1;
        break;
      case "only-child":
        if (Ir(n).length !== 1) return !1;
        break;
      case "last-child": {
        const c = Ir(n);
        if (c[c.length - 1] !== n) return !1;
        break;
      }
      case "nth-child":
        if (Ir(n).indexOf(n) !== s.n - 1) return !1;
        break;
      case "root":
        if (!n.isDocumentRoot) return !1;
        break;
      case "not":
        if (s.list.some((c) => tl(n, c, r, i))) return !1;
        break;
      case "has":
        if (n.watchesDescendants = !0, !s.list.some(([{ compound: c }]) => Dp(n, (f) => Bp(f, c, r, !1)))) return !1;
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
  const s = (c, f, u) => {
    const { compound: m, combinator: h } = a[f];
    if (!Bp(c, m, r, u)) return !1;
    if (f === 0) return !0;
    if (h === ">") return !!c.parentElement && s(c.parentElement, f - 1, !1);
    for (let v = c.parentElement; v; v = v.parentElement) if (s(v, f - 1, !1)) return !0;
    return !1;
  };
  return s(n, a.length - 1, i);
}
function M0(n, a, r = {}) {
  return (typeof a == "string" ? ji(a) : a).some((s) => tl(n, s, r));
}
function Uo(n, a, r = {}) {
  return tl(n, a, r);
}
function Zl(n, a, r = {}) {
  const i = ji(a), s = [], c = (f) => {
    for (const u of f.children)
      i.some((m) => tl(u, m, r)) && s.push(u), c(u);
  };
  return c(n), s;
}
function Hp(n, a, r = {}) {
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
let R0 = 1;
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
class dc {
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
let j0 = 0;
const Lo = () => ++j0;
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
class $e extends dc {
  constructor(a, r = {}, i = null) {
    super(), this.nodeType = 1, this.id = `n${R0++}`, this.tagName = a.toLowerCase(), this.props = r, this.childNodes = [], this.parentNode = null, this.ownerDocument = i, this.hidden = !1, this.state = { hover: !1, focus: !1, active: !1 }, this.bounds = null, this.version = 0, this.attrStamp = 0, this.stamp = 0;
  }
  /** Its props, attributes or state changed. */
  touch() {
    this.version++, this.attrStamp = Lo(), this.mark();
  }
  /** Its subtree changed: it and its ancestors are described again (their styles are kept unless they changed). */
  mark() {
    const a = Lo();
    for (let r = this; r instanceof $e; r = r.parentNode) r.stamp = a;
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
    return this.parentNode instanceof $e ? this.parentNode : null;
  }
  get children() {
    return this.childNodes.filter((a) => a instanceof $e);
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
    return M0(this, a);
  }
  closest(a) {
    return Hp(this, a);
  }
  querySelectorAll(a) {
    return Zl(this, a);
  }
  querySelector(a) {
    return Zl(this, a)[0] ?? null;
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
    return Cf(this);
  }
  /** `outerHTML` without the attributes named in `omit` (by their DOM names), as the web's drag strips its copy. */
  copyMarkup(a = []) {
    return Cf(this, a);
  }
}
const Up = Symbol("perch.stale-layout"), qp = 3;
let fi = !1;
function Lp(n) {
  return () => {
    let a, r = !1;
    const i = (s) => {
      const c = fi;
      fi = s < qp;
      try {
        a = n();
      } catch (f) {
        const u = f?.[Up];
        if (!u) throw f;
        u.retries.push(() => {
          r || i(s + 1);
        });
      } finally {
        fi = c;
      }
    };
    return i(0), () => {
      r = !0, typeof a == "function" && a();
    };
  };
}
const Go = "perch-dom:", O0 = /* @__PURE__ */ new Set(["children", "key", "ref", "dangerouslySetInnerHTML"]), D0 = { class: "className", for: "htmlFor", tabindex: "tabIndex" };
function Cf(n, a = []) {
  const r = new Set(a.map((s) => D0[s] ?? s)), i = (s) => {
    if (!(s instanceof $e)) return { x: s.data, ...s.hidden ? { h: 1 } : {} };
    const c = {};
    for (const [f, u] of Object.entries(s.props))
      O0.has(f) || r.has(f) || u == null || typeof u == "function" || typeof u == "symbol" || (c[f] = u);
    return { t: s.tagName, p: c, c: s.childNodes.map(i), ...s.hidden ? { h: 1 } : {} };
  };
  return Go + JSON.stringify(i(n));
}
function B0(n, a) {
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
      f = new $e(c.t, c.p, a);
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
class H0 {
  observe() {
  }
  unobserve() {
  }
  disconnect() {
  }
}
class U0 {
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
function Af(n) {
  for (let a = n; a instanceof $e; a = a.parentElement) a.touch();
}
class q0 extends dc {
  constructor(a) {
    super(), this.perch = a, this.documentElement = new $e("html", {}, this), this.body = new $e("body", {}, this), this.documentElement.appendChild(this.body), this.activeElement = this.body, this.retries = [];
  }
  createElement(a) {
    return new $e(a, {}, this);
  }
  /** `element`'s box as the engine last laid it out, or null before its first layout or without an engine that
   * reports boxes (`perch.bounds`). The first ask marks the element to be measured from the next frame on. Inside an
   * effect (`measured`) a box older than the tree, or none yet, puts the effect off until the next frame. */
  measure(a) {
    const r = this.perch?.bounds;
    if (typeof r != "function" || !this.measureKey) return null;
    a.measured || (a.measured = !0, a.touch(), this.restyled());
    const i = r(this.measureKey(a));
    if (fi && (!i || this.stale?.())) throw { [Up]: this };
    return i ?? null;
  }
  /** An element's `style` was written: the tree is described again once the writing script is done. */
  restyled() {
    this.restyling || (this.restyling = !0, queueMicrotask(() => {
      this.restyling = !1, this.afterCommit?.();
    }));
  }
  focus(a) {
    this.activeElement && this.activeElement !== a && this.blur(this.activeElement), this.activeElement = a, a.state.focus = !0, a.state.pointerFocus = !1, Af(a), this.perch?.focused?.(a);
  }
  blur(a) {
    a.state.focus = !1, Af(a), this.activeElement === a && (this.activeElement = this.body);
  }
  querySelectorAll(a) {
    return Zl(this.documentElement, a);
  }
  querySelector(a) {
    return this.querySelectorAll(a)[0] ?? null;
  }
  /** The element whose `id` prop is `id` (React's `useId` ids are not selectors). */
  getElementById(a) {
    return Zl(this.documentElement, "*").find((r) => r.props?.id === a) ?? null;
  }
}
class L0 extends dc {
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
function Gp(n) {
  return {
    setTimeout: (a, r = 0, ...i) => n.setTimeout(() => a(...i), Math.max(0, Number(r) || 0)),
    clearTimeout: (a) => {
      a != null && n.clearTimeout(a);
    }
  };
}
const Mf = Symbol.for("perch.react.globals");
function en(n, a, r) {
  Object.defineProperty(n, a, { value: r, configurable: !0, writable: !0, enumerable: !1 });
}
function G0(n, a = globalThis) {
  const r = new q0(n), i = new L0(n, r);
  r.defaultView = i;
  const s = n.storage ?? new U0();
  if (typeof a.setTimeout != "function") {
    if (typeof n.setTimeout != "function") throw new Error("the engine has no setTimeout and the perch host gives none (perch.setTimeout)");
    const u = Gp(n);
    en(a, "setTimeout", u.setTimeout), en(a, "clearTimeout", u.clearTimeout);
  }
  typeof a.queueMicrotask != "function" && en(a, "queueMicrotask", (u) => {
    Promise.resolve().then(u);
  }), en(a, "requestAnimationFrame", (u) => a.setTimeout(() => u(Date.now()), 0)), en(a, "cancelAnimationFrame", (u) => a.clearTimeout(u));
  const c = { document: r, window: i, localStorage: s, HTMLElement: $e, Element: $e };
  for (const u of Object.keys(c))
    Object.defineProperty(a, u, { get: () => a[Mf]?.[u], configurable: !0, enumerable: !1 });
  a[Mf] = c, en(a, "DOMRect", qo), en(a, "getComputedStyle", Y0), typeof a.ResizeObserver != "function" && en(a, "ResizeObserver", H0);
  const f = a.navigator && typeof a.navigator == "object" ? a.navigator : {};
  if (!f.clipboard && n.clipboard)
    try {
      en(f, "clipboard", n.clipboard);
    } catch {
    }
  return a.navigator || en(a, "navigator", f), { document: r, window: i, globals: c };
}
function Y0(n) {
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
  if (!(a ? n?.tagName === "input" && Yp(n) : n?.tagName === "button" && !/^(button|reset)$/.test(String(n.props.type ?? "submit")) && !n.props.disabled)) return null;
  for (let i = n.parentElement; i; i = i.parentElement) if (i.tagName === "form") return i;
  return null;
}
const Yp = (n) => n?.tagName === "textarea" || n?.tagName === "input" && /^(text|search|url|email|tel|password|number|)$/.test(String(n.props.type ?? ""));
//! Evaluated before anything else in the runtime bundle: React's scheduler reads `setTimeout` and `queueMicrotask`
//! once, when it loads, so an engine without them (QuickJS) gets the host's (`perch.setTimeout`) first.
const Rf = globalThis.perch;
if (typeof globalThis.setTimeout != "function" && typeof Rf?.setTimeout == "function") {
  const n = Gp(Rf);
  globalThis.setTimeout = n.setTimeout, globalThis.clearTimeout = n.clearTimeout;
}
typeof globalThis.queueMicrotask != "function" && (globalThis.queueMicrotask = (n) => {
  Promise.resolve().then(n);
});
function fc(n) {
  return n && n.__esModule && Object.prototype.hasOwnProperty.call(n, "default") ? n.default : n;
}
function Q0(n) {
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
var jf;
function V0() {
  if (jf) return me;
  jf = 1;
  var n = Symbol.for("react.transitional.element"), a = Symbol.for("react.portal"), r = Symbol.for("react.fragment"), i = Symbol.for("react.strict_mode"), s = Symbol.for("react.profiler"), c = Symbol.for("react.consumer"), f = Symbol.for("react.context"), u = Symbol.for("react.forward_ref"), m = Symbol.for("react.suspense"), h = Symbol.for("react.memo"), v = Symbol.for("react.lazy"), y = Symbol.for("react.activity"), b = Symbol.iterator;
  function S(C) {
    return C === null || typeof C != "object" ? null : (C = b && C[b] || C["@@iterator"], typeof C == "function" ? C : null);
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
  }, R = Object.assign, N = {};
  function M(C, J, ae) {
    this.props = C, this.context = J, this.refs = N, this.updater = ae || E;
  }
  M.prototype.isReactComponent = {}, M.prototype.setState = function(C, J) {
    if (typeof C != "object" && typeof C != "function" && C != null)
      throw Error(
        "takes an object of state variables to update or a function which returns an object of state variables."
      );
    this.updater.enqueueSetState(this, C, J, "setState");
  }, M.prototype.forceUpdate = function(C) {
    this.updater.enqueueForceUpdate(this, C, "forceUpdate");
  };
  function O() {
  }
  O.prototype = M.prototype;
  function H(C, J, ae) {
    this.props = C, this.context = J, this.refs = N, this.updater = ae || E;
  }
  var X = H.prototype = new O();
  X.constructor = H, R(X, M.prototype), X.isPureReactComponent = !0;
  var W = Array.isArray;
  function D() {
  }
  var g = { H: null, A: null, T: null, S: null }, w = Object.prototype.hasOwnProperty;
  function x(C, J, ae) {
    var oe = ae.ref;
    return {
      $$typeof: n,
      type: C,
      key: J,
      ref: oe !== void 0 ? oe : null,
      props: ae
    };
  }
  function _(C, J) {
    return x(C.type, J, C.props);
  }
  function T(C) {
    return typeof C == "object" && C !== null && C.$$typeof === n;
  }
  function z(C) {
    var J = { "=": "=0", ":": "=2" };
    return "$" + C.replace(/[=:]/g, function(ae) {
      return J[ae];
    });
  }
  var j = /\/+/g;
  function V(C, J) {
    return typeof C == "object" && C !== null && C.key != null ? z("" + C.key) : J.toString(36);
  }
  function $(C) {
    switch (C.status) {
      case "fulfilled":
        return C.value;
      case "rejected":
        throw C.reason;
      default:
        switch (typeof C.status == "string" ? C.then(D, D) : (C.status = "pending", C.then(
          function(J) {
            C.status === "pending" && (C.status = "fulfilled", C.value = J);
          },
          function(J) {
            C.status === "pending" && (C.status = "rejected", C.reason = J);
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
  function U(C, J, ae, oe, ce) {
    var ue = typeof C;
    (ue === "undefined" || ue === "boolean") && (C = null);
    var Ee = !1;
    if (C === null) Ee = !0;
    else
      switch (ue) {
        case "bigint":
        case "string":
        case "number":
          Ee = !0;
          break;
        case "object":
          switch (C.$$typeof) {
            case n:
            case a:
              Ee = !0;
              break;
            case v:
              return Ee = C._init, U(
                Ee(C._payload),
                J,
                ae,
                oe,
                ce
              );
          }
      }
    if (Ee)
      return ce = ce(C), Ee = oe === "" ? "." + V(C, 0) : oe, W(ce) ? (ae = "", Ee != null && (ae = Ee.replace(j, "$&/") + "/"), U(ce, J, ae, "", function(Fn) {
        return Fn;
      })) : ce != null && (T(ce) && (ce = _(
        ce,
        ae + (ce.key == null || C && C.key === ce.key ? "" : ("" + ce.key).replace(
          j,
          "$&/"
        ) + "/") + Ee
      )), J.push(ce)), 1;
    Ee = 0;
    var Pe = oe === "" ? "." : oe + ":";
    if (W(C))
      for (var he = 0; he < C.length; he++)
        oe = C[he], ue = Pe + V(oe, he), Ee += U(
          oe,
          J,
          ae,
          ue,
          ce
        );
    else if (he = S(C), typeof he == "function")
      for (C = he.call(C), he = 0; !(oe = C.next()).done; )
        oe = oe.value, ue = Pe + V(oe, he++), Ee += U(
          oe,
          J,
          ae,
          ue,
          ce
        );
    else if (ue === "object") {
      if (typeof C.then == "function")
        return U(
          $(C),
          J,
          ae,
          oe,
          ce
        );
      throw J = String(C), Error(
        "Objects are not valid as a React child (found: " + (J === "[object Object]" ? "object with keys {" + Object.keys(C).join(", ") + "}" : J) + "). If you meant to render a collection of children, use an array instead."
      );
    }
    return Ee;
  }
  function K(C, J, ae) {
    if (C == null) return C;
    var oe = [], ce = 0;
    return U(C, oe, "", "", function(ue) {
      return J.call(ae, ue, ce++);
    }), oe;
  }
  function I(C) {
    if (C._status === -1) {
      var J = C._result;
      J = J(), J.then(
        function(ae) {
          (C._status === 0 || C._status === -1) && (C._status = 1, C._result = ae);
        },
        function(ae) {
          (C._status === 0 || C._status === -1) && (C._status = 2, C._result = ae);
        }
      ), C._status === -1 && (C._status = 0, C._result = J);
    }
    if (C._status === 1) return C._result.default;
    throw C._result;
  }
  var Q = typeof reportError == "function" ? reportError : function(C) {
    if (typeof window == "object" && typeof window.ErrorEvent == "function") {
      var J = new window.ErrorEvent("error", {
        bubbles: !0,
        cancelable: !0,
        message: typeof C == "object" && C !== null && typeof C.message == "string" ? String(C.message) : String(C),
        error: C
      });
      if (!window.dispatchEvent(J)) return;
    } else if (typeof process == "object" && typeof process.emit == "function") {
      process.emit("uncaughtException", C);
      return;
    }
    console.error(C);
  }, Z = {
    map: K,
    forEach: function(C, J, ae) {
      K(
        C,
        function() {
          J.apply(this, arguments);
        },
        ae
      );
    },
    count: function(C) {
      var J = 0;
      return K(C, function() {
        J++;
      }), J;
    },
    toArray: function(C) {
      return K(C, function(J) {
        return J;
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
  return me.Activity = y, me.Children = Z, me.Component = M, me.Fragment = r, me.Profiler = s, me.PureComponent = H, me.StrictMode = i, me.Suspense = m, me.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE = g, me.__COMPILER_RUNTIME = {
    __proto__: null,
    c: function(C) {
      return g.H.useMemoCache(C);
    }
  }, me.cache = function(C) {
    return function() {
      return C.apply(null, arguments);
    };
  }, me.cacheSignal = function() {
    return null;
  }, me.cloneElement = function(C, J, ae) {
    if (C == null)
      throw Error(
        "The argument must be a React element, but you passed " + C + "."
      );
    var oe = R({}, C.props), ce = C.key;
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
    return x(C.type, ce, oe);
  }, me.createContext = function(C) {
    return C = {
      $$typeof: f,
      _currentValue: C,
      _currentValue2: C,
      _threadCount: 0,
      Provider: null,
      Consumer: null
    }, C.Provider = C, C.Consumer = {
      $$typeof: c,
      _context: C
    }, C;
  }, me.createElement = function(C, J, ae) {
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
    if (C && C.defaultProps)
      for (oe in Ee = C.defaultProps, Ee)
        ce[oe] === void 0 && (ce[oe] = Ee[oe]);
    return x(C, ue, ce);
  }, me.createRef = function() {
    return { current: null };
  }, me.forwardRef = function(C) {
    return { $$typeof: u, render: C };
  }, me.isValidElement = T, me.lazy = function(C) {
    return {
      $$typeof: v,
      _payload: { _status: -1, _result: C },
      _init: I
    };
  }, me.memo = function(C, J) {
    return {
      $$typeof: h,
      type: C,
      compare: J === void 0 ? null : J
    };
  }, me.startTransition = function(C) {
    var J = g.T, ae = {};
    g.T = ae;
    try {
      var oe = C(), ce = g.S;
      ce !== null && ce(ae, oe), typeof oe == "object" && oe !== null && typeof oe.then == "function" && oe.then(D, Q);
    } catch (ue) {
      Q(ue);
    } finally {
      J !== null && ae.types !== null && (J.types = ae.types), g.T = J;
    }
  }, me.unstable_useCacheRefresh = function() {
    return g.H.useCacheRefresh();
  }, me.use = function(C) {
    return g.H.use(C);
  }, me.useActionState = function(C, J, ae) {
    return g.H.useActionState(C, J, ae);
  }, me.useCallback = function(C, J) {
    return g.H.useCallback(C, J);
  }, me.useContext = function(C) {
    return g.H.useContext(C);
  }, me.useDebugValue = function() {
  }, me.useDeferredValue = function(C, J) {
    return g.H.useDeferredValue(C, J);
  }, me.useEffect = function(C, J) {
    return g.H.useEffect(C, J);
  }, me.useEffectEvent = function(C) {
    return g.H.useEffectEvent(C);
  }, me.useId = function() {
    return g.H.useId();
  }, me.useImperativeHandle = function(C, J, ae) {
    return g.H.useImperativeHandle(C, J, ae);
  }, me.useInsertionEffect = function(C, J) {
    return g.H.useInsertionEffect(C, J);
  }, me.useLayoutEffect = function(C, J) {
    return g.H.useLayoutEffect(C, J);
  }, me.useMemo = function(C, J) {
    return g.H.useMemo(C, J);
  }, me.useOptimistic = function(C, J) {
    return g.H.useOptimistic(C, J);
  }, me.useReducer = function(C, J, ae) {
    return g.H.useReducer(C, J, ae);
  }, me.useRef = function(C) {
    return g.H.useRef(C);
  }, me.useState = function(C) {
    return g.H.useState(C);
  }, me.useSyncExternalStore = function(C, J, ae) {
    return g.H.useSyncExternalStore(
      C,
      J,
      ae
    );
  }, me.useTransition = function() {
    return g.H.useTransition();
  }, me.version = "19.2.8", me;
}
var Of;
function K0() {
  return Of || (Of = 1, So.exports = V0()), So.exports;
}
var L = K0();
const Qp = /* @__PURE__ */ fc(L), Z0 = /* @__PURE__ */ oc({
  __proto__: null,
  default: Qp
}, [L]);
//! "react" as the runtime bundles it, for its own code, the stock screens and every screen's `react` import: React
//! itself, with `useEffect` and `useLayoutEffect` run through `measured` (`dom.mjs`), so an effect that measures a
//! box the engine has not laid out yet runs again once it has (layout readback).
const X0 = Qp ?? Z0;
function Je(n, a) {
  return L.useEffect(Lp(n), a);
}
function bi(n, a) {
  return L.useLayoutEffect(Lp(n), a);
}
const J0 = /* @__PURE__ */ oc({
  __proto__: null,
  default: X0,
  useEffect: Je,
  useLayoutEffect: bi
}, [L]);
var Eo = { exports: {} }, Bl = {};
/**
 * @license React
 * react-jsx-runtime.production.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var Df;
function $0() {
  if (Df) return Bl;
  Df = 1;
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
  return Bl.Fragment = a, Bl.jsx = r, Bl.jsxs = r, Bl;
}
var Bf;
function W0() {
  return Bf || (Bf = 1, Eo.exports = $0()), Eo.exports;
}
var te = W0();
const F0 = /* @__PURE__ */ fc(te), w4 = /* @__PURE__ */ oc({
  __proto__: null,
  default: F0
}, [te]);
var zo = { exports: {} }, No = { exports: {} };
const I0 = /* @__PURE__ */ Q0(J0);
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
var Hf;
function P0() {
  return Hf || (Hf = 1, (function(n) {
    function a(U, K) {
      var I = U.length;
      U.push(K);
      e: for (; 0 < I; ) {
        var Q = I - 1 >>> 1, Z = U[Q];
        if (0 < s(Z, K))
          U[Q] = K, U[I] = Z, I = Q;
        else break e;
      }
    }
    function r(U) {
      return U.length === 0 ? null : U[0];
    }
    function i(U) {
      if (U.length === 0) return null;
      var K = U[0], I = U.pop();
      if (I !== K) {
        U[0] = I;
        e: for (var Q = 0, Z = U.length, C = Z >>> 1; Q < C; ) {
          var J = 2 * (Q + 1) - 1, ae = U[J], oe = J + 1, ce = U[oe];
          if (0 > s(ae, I))
            oe < Z && 0 > s(ce, ae) ? (U[Q] = ce, U[oe] = I, Q = oe) : (U[Q] = ae, U[J] = I, Q = J);
          else if (oe < Z && 0 > s(ce, I))
            U[Q] = ce, U[oe] = I, Q = oe;
          else break e;
        }
      }
      return K;
    }
    function s(U, K) {
      var I = U.sortIndex - K.sortIndex;
      return I !== 0 ? I : U.id - K.id;
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
    var m = [], h = [], v = 1, y = null, b = 3, S = !1, E = !1, R = !1, N = !1, M = typeof setTimeout == "function" ? setTimeout : null, O = typeof clearTimeout == "function" ? clearTimeout : null, H = typeof setImmediate < "u" ? setImmediate : null;
    function X(U) {
      for (var K = r(h); K !== null; ) {
        if (K.callback === null) i(h);
        else if (K.startTime <= U)
          i(h), K.sortIndex = K.expirationTime, a(m, K);
        else break;
        K = r(h);
      }
    }
    function W(U) {
      if (R = !1, X(U), !E)
        if (r(m) !== null)
          E = !0, D || (D = !0, z());
        else {
          var K = r(h);
          K !== null && $(W, K.startTime - U);
        }
    }
    var D = !1, g = -1, w = 5, x = -1;
    function _() {
      return N ? !0 : !(n.unstable_now() - x < w);
    }
    function T() {
      if (N = !1, D) {
        var U = n.unstable_now();
        x = U;
        var K = !0;
        try {
          e: {
            E = !1, R && (R = !1, O(g), g = -1), S = !0;
            var I = b;
            try {
              t: {
                for (X(U), y = r(m); y !== null && !(y.expirationTime > U && _()); ) {
                  var Q = y.callback;
                  if (typeof Q == "function") {
                    y.callback = null, b = y.priorityLevel;
                    var Z = Q(
                      y.expirationTime <= U
                    );
                    if (U = n.unstable_now(), typeof Z == "function") {
                      y.callback = Z, X(U), K = !0;
                      break t;
                    }
                    y === r(m) && i(m), X(U);
                  } else i(m);
                  y = r(m);
                }
                if (y !== null) K = !0;
                else {
                  var C = r(h);
                  C !== null && $(
                    W,
                    C.startTime - U
                  ), K = !1;
                }
              }
              break e;
            } finally {
              y = null, b = I, S = !1;
            }
            K = void 0;
          }
        } finally {
          K ? z() : D = !1;
        }
      }
    }
    var z;
    if (typeof H == "function")
      z = function() {
        H(T);
      };
    else if (typeof MessageChannel < "u") {
      var j = new MessageChannel(), V = j.port2;
      j.port1.onmessage = T, z = function() {
        V.postMessage(null);
      };
    } else
      z = function() {
        M(T, 0);
      };
    function $(U, K) {
      g = M(function() {
        U(n.unstable_now());
      }, K);
    }
    n.unstable_IdlePriority = 5, n.unstable_ImmediatePriority = 1, n.unstable_LowPriority = 4, n.unstable_NormalPriority = 3, n.unstable_Profiling = null, n.unstable_UserBlockingPriority = 2, n.unstable_cancelCallback = function(U) {
      U.callback = null;
    }, n.unstable_forceFrameRate = function(U) {
      0 > U || 125 < U ? console.error(
        "forceFrameRate takes a positive int between 0 and 125, forcing frame rates higher than 125 fps is not supported"
      ) : w = 0 < U ? Math.floor(1e3 / U) : 5;
    }, n.unstable_getCurrentPriorityLevel = function() {
      return b;
    }, n.unstable_next = function(U) {
      switch (b) {
        case 1:
        case 2:
        case 3:
          var K = 3;
          break;
        default:
          K = b;
      }
      var I = b;
      b = K;
      try {
        return U();
      } finally {
        b = I;
      }
    }, n.unstable_requestPaint = function() {
      N = !0;
    }, n.unstable_runWithPriority = function(U, K) {
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
        return K();
      } finally {
        b = I;
      }
    }, n.unstable_scheduleCallback = function(U, K, I) {
      var Q = n.unstable_now();
      switch (typeof I == "object" && I !== null ? (I = I.delay, I = typeof I == "number" && 0 < I ? Q + I : Q) : I = Q, U) {
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
      return Z = I + Z, U = {
        id: v++,
        callback: K,
        priorityLevel: U,
        startTime: I,
        expirationTime: Z,
        sortIndex: -1
      }, I > Q ? (U.sortIndex = I, a(h, U), r(m) === null && U === r(h) && (R ? (O(g), g = -1) : R = !0, $(W, I - Q))) : (U.sortIndex = Z, a(m, U), E || S || (E = !0, D || (D = !0, z()))), U;
    }, n.unstable_shouldYield = _, n.unstable_wrapCallback = function(U) {
      var K = b;
      return function() {
        var I = b;
        b = K;
        try {
          return U.apply(this, arguments);
        } finally {
          b = I;
        }
      };
    };
  })(Co)), Co;
}
var Uf;
function eb() {
  return Uf || (Uf = 1, To.exports = P0()), To.exports;
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
var qf;
function tb() {
  return qf || (qf = 1, (function(n) {
    n.exports = function(a) {
      function r(e, t, l, o) {
        return new Ah(e, t, l, o);
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
            for (var k = !1, A = d.child; A; ) {
              if (A === l) {
                k = !0, l = d, o = p;
                break;
              }
              if (A === o) {
                k = !0, o = d, l = p;
                break;
              }
              A = A.sibling;
            }
            if (!k) {
              for (A = p.child; A; ) {
                if (A === l) {
                  k = !0, l = p, o = d;
                  break;
                }
                if (A === o) {
                  k = !0, o = p, l = d;
                  break;
                }
                A = A.sibling;
              }
              if (!k) throw Error(s(189));
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
      function v(e) {
        return e === null || typeof e != "object" ? null : (e = Zd && e[Zd] || e["@@iterator"], typeof e == "function" ? e : null);
      }
      function y(e) {
        if (e == null) return null;
        if (typeof e == "function")
          return e.$$typeof === Dh ? null : e.displayName || e.name || null;
        if (typeof e == "string") return e;
        switch (e) {
          case Ra:
            return "Fragment";
          case Qs:
            return "Profiler";
          case Vd:
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
            case Kd:
              return (e._context.displayName || "Context") + ".Consumer";
            case Vs:
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
        0 > Da || (e.current = eo[Da], eo[Da] = null, Da--);
      }
      function E(e, t) {
        Da++, eo[Da] = e.current, e.current = t;
      }
      function R(e) {
        return e >>>= 0, e === 0 ? 32 : 31 - (c0(e) / u0 | 0) | 0;
      }
      function N(e) {
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
      function M(e, t, l) {
        var o = e.pendingLanes;
        if (o === 0) return 0;
        var d = 0, p = e.suspendedLanes, k = e.pingedLanes;
        e = e.warmLanes;
        var A = o & 134217727;
        return A !== 0 ? (o = A & ~p, o !== 0 ? d = N(o) : (k &= A, k !== 0 ? d = N(k) : l || (l = A & ~e, l !== 0 && (d = N(l))))) : (A = o & ~p, A !== 0 ? d = N(A) : k !== 0 ? d = N(k) : l || (l = o & ~e, l !== 0 && (d = N(l)))), d === 0 ? 0 : t !== 0 && t !== d && (t & p) === 0 && (p = d & -d, l = t & -t, p >= l || p === 32 && (l & 4194048) !== 0) ? t : d;
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
        var e = jr;
        return jr <<= 1, (jr & 62914560) === 0 && (jr = 4194304), e;
      }
      function W(e) {
        for (var t = [], l = 0; 31 > l; l++) t.push(e);
        return t;
      }
      function D(e, t) {
        e.pendingLanes |= t, t !== 268435456 && (e.suspendedLanes = 0, e.pingedLanes = 0, e.warmLanes = 0);
      }
      function g(e, t, l, o, d, p) {
        var k = e.pendingLanes;
        e.pendingLanes = l, e.suspendedLanes = 0, e.pingedLanes = 0, e.warmLanes = 0, e.expiredLanes &= l, e.entangledLanes &= l, e.errorRecoveryDisabledLanes &= l, e.shellSuspendCounter = 0;
        var A = e.entanglements, Y = e.expirationTimes, F = e.hiddenUpdates;
        for (l = k & ~l; 0 < l; ) {
          var ne = 31 - Et(l), P = 1 << ne;
          A[ne] = 0, Y[ne] = -1;
          var le = F[ne];
          if (le !== null)
            for (F[ne] = null, ne = 0; ne < le.length; ne++) {
              var ge = le[ne];
              ge !== null && (ge.lane &= -536870913);
            }
          l &= ~P;
        }
        o !== 0 && w(e, o, 0), p !== 0 && d === 0 && e.tag !== 0 && (e.suspendedLanes |= p & ~(k & ~t));
      }
      function w(e, t, l) {
        e.pendingLanes |= t, e.suspendedLanes &= ~t;
        var o = 31 - Et(t);
        e.entangledLanes |= t, e.entanglements[o] = e.entanglements[o] | 1073741824 | l & 261930;
      }
      function x(e, t) {
        var l = e.entangledLanes |= t;
        for (e = e.entanglements; l; ) {
          var o = 31 - Et(l), d = 1 << o;
          d & t | e[o] & t && (e[o] |= t), l &= ~d;
        }
      }
      function _(e, t) {
        var l = t & -t;
        return l = (l & 42) !== 0 ? 1 : T(l), (l & (e.suspendedLanes | t)) !== 0 ? 0 : l;
      }
      function T(e) {
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
      function z(e) {
        return e &= -e, 2 < e ? 8 < e ? (e & 134217727) !== 0 ? 32 : 268435456 : 8 : 2;
      }
      function j(e) {
        if (typeof h0 == "function" && g0(e), zt && typeof zt.setStrictMode == "function")
          try {
            zt.setStrictMode(_l, e);
          } catch {
          }
      }
      function V(e, t) {
        return e === t && (e !== 0 || 1 / e === 1 / t) || e !== e && t !== t;
      }
      function $(e) {
        if (ao === void 0)
          try {
            throw Error();
          } catch (l) {
            var t = l.stack.trim().match(/\n( *(at )?)/);
            ao = t && t[1] || "", yf = -1 < l.stack.indexOf(`
    at`) ? " (<anonymous>)" : -1 < l.stack.indexOf("@") ? "@unknown:0:0" : "";
          }
        return `
` + ao + e + yf;
      }
      function U(e, t) {
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
          var d = Object.getOwnPropertyDescriptor(
            o.DetermineComponentFrameRoot,
            "name"
          );
          d && d.configurable && Object.defineProperty(
            o.DetermineComponentFrameRoot,
            "name",
            { value: "DetermineComponentFrameRoot" }
          );
          var p = o.DetermineComponentFrameRoot(), k = p[0], A = p[1];
          if (k && A) {
            var Y = k.split(`
`), F = A.split(`
`);
            for (d = o = 0; o < Y.length && !Y[o].includes("DetermineComponentFrameRoot"); )
              o++;
            for (; d < F.length && !F[d].includes(
              "DetermineComponentFrameRoot"
            ); )
              d++;
            if (o === Y.length || d === F.length)
              for (o = Y.length - 1, d = F.length - 1; 1 <= o && 0 <= d && Y[o] !== F[d]; )
                d--;
            for (; 1 <= o && 0 <= d; o--, d--)
              if (Y[o] !== F[d]) {
                if (o !== 1 || d !== 1)
                  do
                    if (o--, d--, 0 > d || Y[o] !== F[d]) {
                      var ne = `
` + Y[o].replace(" at new ", " at ");
                      return e.displayName && ne.includes("<anonymous>") && (ne = ne.replace("<anonymous>", e.displayName)), ne;
                    }
                  while (1 <= o && 0 <= d);
                break;
              }
          }
        } finally {
          lo = !1, Error.prepareStackTrace = l;
        }
        return (l = e ? e.displayName || e.name : "") ? $(l) : "";
      }
      function K(e, t) {
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
            return U(e.type, !1);
          case 11:
            return U(e.type.render, !1);
          case 1:
            return U(e.type, !0);
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
            t += K(e, l), l = e, e = e.return;
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
          var l = xf.get(e);
          return l !== void 0 ? l : (t = {
            value: e,
            source: t,
            stack: I(t)
          }, xf.set(e, t), t);
        }
        return {
          value: e,
          source: t,
          stack: I(t)
        };
      }
      function Z(e, t) {
        Ha[Ua++] = Sl, Ha[Ua++] = Dr, Dr = e, Sl = t;
      }
      function C(e, t, l) {
        Rt[jt++] = It, Rt[jt++] = Pt, Rt[jt++] = Rn, Rn = e;
        var o = It;
        e = Pt;
        var d = 32 - Et(o) - 1;
        o &= ~(1 << d), l += 1;
        var p = 32 - Et(t) + d;
        if (30 < p) {
          var k = d - d % 5;
          p = (o & (1 << k) - 1).toString(32), o >>= k, d -= k, It = 1 << 32 - Et(t) + d | l << d | o, Pt = p + e;
        } else
          It = 1 << p | l << d | o, Pt = e;
      }
      function J(e) {
        e.return !== null && (Z(e, 1), C(e, 1, 0));
      }
      function ae(e) {
        for (; e === Dr; )
          Dr = Ha[--Ua], Ha[Ua] = null, Sl = Ha[--Ua], Ha[Ua] = null;
        for (; e === Rn; )
          Rn = Rt[--jt], Rt[jt] = null, Pt = Rt[--jt], Rt[jt] = null, It = Rt[--jt], Rt[jt] = null;
      }
      function oe(e, t) {
        Rt[jt++] = It, Rt[jt++] = Pt, Rt[jt++] = Rn, It = t.id, Pt = t.overflow, Rn = e;
      }
      function ce(e, t) {
        E(jn, t), E(El, e), E(rt, null), e = Uh(t), S(rt), E(rt, e);
      }
      function ue() {
        S(rt), S(El), S(jn);
      }
      function Ee(e) {
        e.memoizedState !== null && E(Br, e);
        var t = rt.current, l = qh(t, e.type);
        t !== l && (E(El, e), E(rt, l));
      }
      function Pe(e) {
        El.current === e && (S(rt), S(El)), Br.current === e && (S(Br), fn ? sa._currentValue = ja : sa._currentValue2 = ja);
      }
      function he(e) {
        var t = Error(
          s(
            418,
            1 < arguments.length && arguments[1] !== void 0 && arguments[1] ? "text" : "HTML",
            ""
          )
        );
        throw rl(Q(t, e)), ro;
      }
      function Fn(e, t) {
        if (!ft) throw Error(s(175));
        qg(
          e.stateNode,
          e.type,
          e.memoizedProps,
          t,
          e
        ) || he(e, !0);
      }
      function In(e) {
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
        if (!Se) return In(e), Se = !0, !1;
        var t = e.tag;
        if (We ? t !== 3 && t !== 27 && (t !== 5 || rf(e.type) && !Ar(e.type, e.memoizedProps)) && Be && he(e) : t !== 3 && (t !== 5 || rf(e.type) && !Ar(e.type, e.memoizedProps)) && Be && he(e), In(e), t === 13) {
          if (!ft) throw Error(s(316));
          if (e = e.memoizedState, e = e !== null ? e.dehydrated : null, !e) throw Error(s(317));
          Be = Vg(e);
        } else if (t === 31) {
          if (e = e.memoizedState, e = e !== null ? e.dehydrated : null, !e) throw Error(s(317));
          Be = Qg(e);
        } else
          Be = We && t === 27 ? Cg(
            e.type,
            Be
          ) : it ? lf(e.stateNode) : null;
        return !0;
      }
      function Lt() {
        ft && (Be = it = null, Se = !1);
      }
      function kn() {
        var e = On;
        return e !== null && (wt === null ? wt = e : wt.push.apply(
          wt,
          e
        ), On = null), e;
      }
      function rl(e) {
        On === null ? On = [e] : On.push(e);
      }
      function _n(e, t, l) {
        fn ? (E(Hr, t._currentValue), t._currentValue = l) : (E(Hr, t._currentValue2), t._currentValue2 = l);
      }
      function rn(e) {
        var t = Hr.current;
        fn ? e._currentValue = t : e._currentValue2 = t, S(Hr);
      }
      function Li(e, t, l) {
        for (; e !== null; ) {
          var o = e.alternate;
          if ((e.childLanes & t) !== t ? (e.childLanes |= t, o !== null && (o.childLanes |= t)) : o !== null && (o.childLanes & t) !== t && (o.childLanes |= t), e === l) break;
          e = e.return;
        }
      }
      function Gi(e, t, l, o) {
        var d = e.child;
        for (d !== null && (d.return = e); d !== null; ) {
          var p = d.dependencies;
          if (p !== null) {
            var k = d.child;
            p = p.firstContext;
            e: for (; p !== null; ) {
              var A = p;
              p = d;
              for (var Y = 0; Y < t.length; Y++)
                if (A.context === t[Y]) {
                  p.lanes |= l, A = p.alternate, A !== null && (A.lanes |= l), Li(
                    p.return,
                    l,
                    e
                  ), o || (k = null);
                  break e;
                }
              p = A.next;
            }
          } else if (d.tag === 18) {
            if (k = d.return, k === null) throw Error(s(341));
            k.lanes |= l, p = k.alternate, p !== null && (p.lanes |= l), Li(k, l, e), k = null;
          } else k = d.child;
          if (k !== null) k.return = d;
          else
            for (k = d; k !== null; ) {
              if (k === e) {
                k = null;
                break;
              }
              if (d = k.sibling, d !== null) {
                d.return = k.return, k = d;
                break;
              }
              k = k.return;
            }
          d = k;
        }
      }
      function Ea(e, t, l, o) {
        e = null;
        for (var d = t, p = !1; d !== null; ) {
          if (!p) {
            if ((d.flags & 524288) !== 0) p = !0;
            else if ((d.flags & 262144) !== 0) break;
          }
          if (d.tag === 10) {
            var k = d.alternate;
            if (k === null) throw Error(s(387));
            if (k = k.memoizedProps, k !== null) {
              var A = d.type;
              Nt(d.pendingProps.value, k.value) || (e !== null ? e.push(A) : e = [A]);
            }
          } else if (d === Br.current) {
            if (k = d.alternate, k === null) throw Error(s(387));
            k.memoizedState.memoizedState !== d.memoizedState.memoizedState && (e !== null ? e.push(sa) : e = [sa]);
          }
          d = d.return;
        }
        e !== null && Gi(
          t,
          e,
          l,
          o
        ), t.flags |= 262144;
      }
      function Pl(e) {
        for (e = e.firstContext; e !== null; ) {
          var t = e.context;
          if (!Nt(
            fn ? t._currentValue : t._currentValue2,
            e.memoizedValue
          ))
            return !0;
          e = e.next;
        }
        return !1;
      }
      function Pn(e) {
        oa = e, mn = null, e = e.dependencies, e !== null && (e.firstContext = null);
      }
      function at(e) {
        return Rc(oa, e);
      }
      function er(e, t) {
        return oa === null && Pn(e), Rc(e, t);
      }
      function Rc(e, t) {
        var l = fn ? t._currentValue : t._currentValue2;
        if (t = { context: t, memoizedValue: l, next: null }, mn === null) {
          if (e === null) throw Error(s(308));
          mn = t, e.dependencies = { lanes: 0, firstContext: t }, e.flags |= 524288;
        } else mn = mn.next = t;
        return l;
      }
      function Yi() {
        return {
          controller: new v0(),
          data: /* @__PURE__ */ new Map(),
          refCount: 0
        };
      }
      function il(e) {
        e.refCount--, e.refCount === 0 && y0(x0, function() {
          e.controller.abort();
        });
      }
      function tr() {
      }
      function $t(e) {
        e !== qa && e.next === null && (qa === null ? Ur = qa = e : qa = qa.next = e), qr = !0, io || (io = !0, ih());
      }
      function za(e, t) {
        if (!so && qr) {
          so = !0;
          do
            for (var l = !1, o = Ur; o !== null; ) {
              if (e !== 0) {
                var d = o.pendingLanes;
                if (d === 0) var p = 0;
                else {
                  var k = o.suspendedLanes, A = o.pingedLanes;
                  p = (1 << 31 - Et(42 | e) + 1) - 1, p &= d & ~(k & ~A), p = p & 201326741 ? p & 201326741 | 1 : p ? p | 2 : 0;
                }
                p !== 0 && (l = !0, Hc(o, p));
              } else
                p = _e, p = M(
                  o,
                  o === je ? p : 0,
                  o.cancelPendingCommit !== null || o.timeoutHandle !== ia
                ), (p & 3) === 0 || O(o, p) || (l = !0, Hc(o, p));
              o = o.next;
            }
          while (l);
          so = !1;
        }
      }
      function jc() {
        Oc();
      }
      function Oc() {
        qr = io = !1;
        var e = 0;
        ca !== 0 && Jh() && (e = ca);
        for (var t = yt(), l = null, o = Ur; o !== null; ) {
          var d = o.next, p = Dc(o, t);
          p === 0 ? (o.next = null, l === null ? Ur = d : l.next = d, d === null && (qa = l)) : (l = o, (e !== 0 || (p & 3) !== 0) && (qr = !0)), o = d;
        }
        Fe !== 0 && Fe !== 5 || za(e), ca !== 0 && (ca = 0);
      }
      function Dc(e, t) {
        for (var l = e.suspendedLanes, o = e.pingedLanes, d = e.expirationTimes, p = e.pendingLanes & -62914561; 0 < p; ) {
          var k = 31 - Et(p), A = 1 << k, Y = d[k];
          Y === -1 ? ((A & l) === 0 || (A & o) !== 0) && (d[k] = H(A, t)) : Y <= t && (e.expiredLanes |= A), p &= ~A;
        }
        if (t = je, l = _e, l = M(
          e,
          e === t ? l : 0,
          e.cancelPendingCommit !== null || e.timeoutHandle !== ia
        ), o = e.callbackNode, l === 0 || e === t && (Ae === 2 || Ae === 9) || e.cancelPendingCommit !== null)
          return o !== null && o !== null && to(o), e.callbackNode = null, e.callbackPriority = 0;
        if ((l & 3) === 0 || O(e, l)) {
          if (t = l & -l, t === e.callbackPriority) return t;
          switch (o !== null && to(o), z(l)) {
            case 2:
            case 8:
              l = p0;
              break;
            case 32:
              l = no;
              break;
            case 268435456:
              l = m0;
              break;
            default:
              l = no;
          }
          return o = Bc.bind(null, e), l = Or(l, o), e.callbackPriority = t, e.callbackNode = l, t;
        }
        return o !== null && o !== null && to(o), e.callbackPriority = 2, e.callbackNode = null, 2;
      }
      function Bc(e, t) {
        if (Fe !== 0 && Fe !== 5)
          return e.callbackNode = null, e.callbackPriority = 0, null;
        var l = e.callbackNode;
        if (yl() && e.callbackNode !== l)
          return null;
        var o = _e;
        return o = M(
          e,
          e === je ? o : 0,
          e.cancelPendingCommit !== null || e.timeoutHandle !== ia
        ), o === 0 ? null : (yd(e, o, t), Dc(e, yt()), e.callbackNode != null && e.callbackNode === l ? Bc.bind(null, e) : null);
      }
      function Hc(e, t) {
        if (yl()) return null;
        yd(e, t, !0);
      }
      function ih() {
        tg ? ng(function() {
          (we & 6) !== 0 ? Or(
            bf,
            jc
          ) : Oc();
        }) : Or(
          bf,
          jc
        );
      }
      function Qi() {
        if (ca === 0) {
          var e = La;
          e === 0 && (e = Mr, Mr <<= 1, (Mr & 261888) === 0 && (Mr = 256)), ca = e;
        }
        return ca;
      }
      function sh(e, t) {
        if (zl === null) {
          var l = zl = [];
          oo = 0, La = Qi(), Ga = {
            status: "pending",
            value: void 0,
            then: function(o) {
              l.push(o);
            }
          };
        }
        return oo++, t.then(Uc, Uc), t;
      }
      function Uc() {
        if (--oo === 0 && zl !== null) {
          Ga !== null && (Ga.status = "fulfilled");
          var e = zl;
          zl = null, La = 0, Ga = null;
          for (var t = 0; t < e.length; t++) (0, e[t])();
        }
      }
      function oh(e, t) {
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
      function Vi() {
        var e = ua.current;
        return e !== null ? e : je.pooledCache;
      }
      function nr(e, t) {
        t === null ? E(ua, ua.current) : E(ua, t.pool);
      }
      function qc() {
        var e = Vi();
        return e === null ? null : {
          parent: fn ? He._currentValue : He._currentValue2,
          pool: e
        };
      }
      function ar(e, t) {
        if (Nt(e, t)) return !0;
        if (typeof e != "object" || e === null || typeof t != "object" || t === null)
          return !1;
        var l = Object.keys(e), o = Object.keys(t);
        if (l.length !== o.length) return !1;
        for (o = 0; o < l.length; o++) {
          var d = l[o];
          if (!b0.call(t, d) || !Nt(e[d], t[d]))
            return !1;
        }
        return !0;
      }
      function Lc(e) {
        return e = e.status, e === "fulfilled" || e === "rejected";
      }
      function Gc(e, t, l) {
        switch (l = e[l], l === void 0 ? e.push(t) : l !== t && (t.then(tr, tr), t = l), t.status) {
          case "fulfilled":
            return t.value;
          case "rejected":
            throw e = t.reason, Qc(e), e;
          default:
            if (typeof t.status == "string") t.then(tr, tr);
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
                throw e = t.reason, Qc(e), e;
            }
            throw da = t, Ya;
        }
      }
      function ea(e) {
        try {
          var t = e._init;
          return t(e._payload);
        } catch (l) {
          throw l !== null && typeof l == "object" && typeof l.then == "function" ? (da = l, Ya) : l;
        }
      }
      function Yc() {
        if (da === null) throw Error(s(459));
        var e = da;
        return da = null, e;
      }
      function Qc(e) {
        if (e === Ya || e === Lr)
          throw Error(s(483));
      }
      function lr(e) {
        var t = Nl;
        return Nl += 1, Qa === null && (Qa = []), Gc(Qa, e, t);
      }
      function sl(e, t) {
        t = t.props.ref, e.ref = t !== void 0 ? t : null;
      }
      function rr(e, t) {
        throw t.$$typeof === jh ? Error(s(525)) : (e = Object.prototype.toString.call(t), Error(
          s(
            31,
            e === "[object Object]" ? "object with keys {" + Object.keys(t).join(", ") + "}" : e
          )
        ));
      }
      function Vc(e) {
        function t(q, B) {
          if (e) {
            var G = q.deletions;
            G === null ? (q.deletions = [B], q.flags |= 16) : G.push(B);
          }
        }
        function l(q, B) {
          if (!e) return null;
          for (; B !== null; )
            t(q, B), B = B.sibling;
          return null;
        }
        function o(q) {
          for (var B = /* @__PURE__ */ new Map(); q !== null; )
            q.key !== null ? B.set(q.key, q) : B.set(q.index, q), q = q.sibling;
          return B;
        }
        function d(q, B) {
          return q = dn(q, B), q.index = 0, q.sibling = null, q;
        }
        function p(q, B, G) {
          return q.index = G, e ? (G = q.alternate, G !== null ? (G = G.index, G < B ? (q.flags |= 67108866, B) : G) : (q.flags |= 67108866, B)) : (q.flags |= 1048576, B);
        }
        function k(q) {
          return e && q.alternate === null && (q.flags |= 67108866), q;
        }
        function A(q, B, G, ee) {
          return B === null || B.tag !== 6 ? (B = qs(G, q.mode, ee), B.return = q, B) : (B = d(B, G), B.return = q, B);
        }
        function Y(q, B, G, ee) {
          var fe = G.type;
          return fe === Ra ? ne(
            q,
            B,
            G.props.children,
            ee,
            G.key
          ) : B !== null && (B.elementType === fe || typeof fe == "object" && fe !== null && fe.$$typeof === Mn && ea(fe) === B.type) ? (B = d(B, G.props), sl(B, G), B.return = q, B) : (B = Nr(
            G.type,
            G.key,
            G.props,
            null,
            q.mode,
            ee
          ), sl(B, G), B.return = q, B);
        }
        function F(q, B, G, ee) {
          return B === null || B.tag !== 4 || B.stateNode.containerInfo !== G.containerInfo || B.stateNode.implementation !== G.implementation ? (B = Ls(G, q.mode, ee), B.return = q, B) : (B = d(B, G.children || []), B.return = q, B);
        }
        function ne(q, B, G, ee, fe) {
          return B === null || B.tag !== 7 ? (B = ra(
            G,
            q.mode,
            ee,
            fe
          ), B.return = q, B) : (B = d(B, G), B.return = q, B);
        }
        function P(q, B, G) {
          if (typeof B == "string" && B !== "" || typeof B == "number" || typeof B == "bigint")
            return B = qs(
              "" + B,
              q.mode,
              G
            ), B.return = q, B;
          if (typeof B == "object" && B !== null) {
            switch (B.$$typeof) {
              case Tr:
                return G = Nr(
                  B.type,
                  B.key,
                  B.props,
                  null,
                  q.mode,
                  G
                ), sl(G, B), G.return = q, G;
              case Ma:
                return B = Ls(
                  B,
                  q.mode,
                  G
                ), B.return = q, B;
              case Mn:
                return B = ea(B), P(q, B, G);
            }
            if (Cr(B) || v(B))
              return B = ra(
                B,
                q.mode,
                G,
                null
              ), B.return = q, B;
            if (typeof B.then == "function")
              return P(q, lr(B), G);
            if (B.$$typeof === An)
              return P(
                q,
                er(q, B),
                G
              );
            rr(q, B);
          }
          return null;
        }
        function le(q, B, G, ee) {
          var fe = B !== null ? B.key : null;
          if (typeof G == "string" && G !== "" || typeof G == "number" || typeof G == "bigint")
            return fe !== null ? null : A(q, B, "" + G, ee);
          if (typeof G == "object" && G !== null) {
            switch (G.$$typeof) {
              case Tr:
                return G.key === fe ? Y(q, B, G, ee) : null;
              case Ma:
                return G.key === fe ? F(q, B, G, ee) : null;
              case Mn:
                return G = ea(G), le(q, B, G, ee);
            }
            if (Cr(G) || v(G))
              return fe !== null ? null : ne(q, B, G, ee, null);
            if (typeof G.then == "function")
              return le(
                q,
                B,
                lr(G),
                ee
              );
            if (G.$$typeof === An)
              return le(
                q,
                B,
                er(q, G),
                ee
              );
            rr(q, G);
          }
          return null;
        }
        function ge(q, B, G, ee, fe) {
          if (typeof ee == "string" && ee !== "" || typeof ee == "number" || typeof ee == "bigint")
            return q = q.get(G) || null, A(B, q, "" + ee, fe);
          if (typeof ee == "object" && ee !== null) {
            switch (ee.$$typeof) {
              case Tr:
                return q = q.get(
                  ee.key === null ? G : ee.key
                ) || null, Y(B, q, ee, fe);
              case Ma:
                return q = q.get(
                  ee.key === null ? G : ee.key
                ) || null, F(B, q, ee, fe);
              case Mn:
                return ee = ea(ee), ge(
                  q,
                  B,
                  G,
                  ee,
                  fe
                );
            }
            if (Cr(ee) || v(ee))
              return q = q.get(G) || null, ne(B, q, ee, fe, null);
            if (typeof ee.then == "function")
              return ge(
                q,
                B,
                G,
                lr(ee),
                fe
              );
            if (ee.$$typeof === An)
              return ge(
                q,
                B,
                G,
                er(B, ee),
                fe
              );
            rr(B, ee);
          }
          return null;
        }
        function st(q, B, G, ee) {
          for (var fe = null, Ue = null, pe = B, Te = B = 0, nt = null; pe !== null && Te < G.length; Te++) {
            pe.index > Te ? (nt = pe, pe = null) : nt = pe.sibling;
            var Ce = le(
              q,
              pe,
              G[Te],
              ee
            );
            if (Ce === null) {
              pe === null && (pe = nt);
              break;
            }
            e && pe && Ce.alternate === null && t(q, pe), B = p(Ce, B, Te), Ue === null ? fe = Ce : Ue.sibling = Ce, Ue = Ce, pe = nt;
          }
          if (Te === G.length)
            return l(q, pe), Se && Z(q, Te), fe;
          if (pe === null) {
            for (; Te < G.length; Te++)
              pe = P(q, G[Te], ee), pe !== null && (B = p(
                pe,
                B,
                Te
              ), Ue === null ? fe = pe : Ue.sibling = pe, Ue = pe);
            return Se && Z(q, Te), fe;
          }
          for (pe = o(pe); Te < G.length; Te++)
            nt = ge(
              pe,
              q,
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
            return t(q, Ln);
          }), Se && Z(q, Te), fe;
        }
        function Ol(q, B, G, ee) {
          if (G == null) throw Error(s(151));
          for (var fe = null, Ue = null, pe = B, Te = B = 0, nt = null, Ce = G.next(); pe !== null && !Ce.done; Te++, Ce = G.next()) {
            pe.index > Te ? (nt = pe, pe = null) : nt = pe.sibling;
            var Ln = le(q, pe, Ce.value, ee);
            if (Ln === null) {
              pe === null && (pe = nt);
              break;
            }
            e && pe && Ln.alternate === null && t(q, pe), B = p(Ln, B, Te), Ue === null ? fe = Ln : Ue.sibling = Ln, Ue = Ln, pe = nt;
          }
          if (Ce.done)
            return l(q, pe), Se && Z(q, Te), fe;
          if (pe === null) {
            for (; !Ce.done; Te++, Ce = G.next())
              Ce = P(q, Ce.value, ee), Ce !== null && (B = p(
                Ce,
                B,
                Te
              ), Ue === null ? fe = Ce : Ue.sibling = Ce, Ue = Ce);
            return Se && Z(q, Te), fe;
          }
          for (pe = o(pe); !Ce.done; Te++, Ce = G.next())
            Ce = ge(
              pe,
              q,
              Te,
              Ce.value,
              ee
            ), Ce !== null && (e && Ce.alternate !== null && pe.delete(Ce.key === null ? Te : Ce.key), B = p(Ce, B, Te), Ue === null ? fe = Ce : Ue.sibling = Ce, Ue = Ce);
          return e && pe.forEach(function(S0) {
            return t(q, S0);
          }), Se && Z(q, Te), fe;
        }
        function ha(q, B, G, ee) {
          if (typeof G == "object" && G !== null && G.type === Ra && G.key === null && (G = G.props.children), typeof G == "object" && G !== null) {
            switch (G.$$typeof) {
              case Tr:
                e: {
                  for (var fe = G.key; B !== null; ) {
                    if (B.key === fe) {
                      if (fe = G.type, fe === Ra) {
                        if (B.tag === 7) {
                          l(
                            q,
                            B.sibling
                          ), ee = d(
                            B,
                            G.props.children
                          ), ee.return = q, q = ee;
                          break e;
                        }
                      } else if (B.elementType === fe || typeof fe == "object" && fe !== null && fe.$$typeof === Mn && ea(fe) === B.type) {
                        l(
                          q,
                          B.sibling
                        ), ee = d(B, G.props), sl(ee, G), ee.return = q, q = ee;
                        break e;
                      }
                      l(q, B);
                      break;
                    } else t(q, B);
                    B = B.sibling;
                  }
                  G.type === Ra ? (ee = ra(
                    G.props.children,
                    q.mode,
                    ee,
                    G.key
                  ), ee.return = q, q = ee) : (ee = Nr(
                    G.type,
                    G.key,
                    G.props,
                    null,
                    q.mode,
                    ee
                  ), sl(ee, G), ee.return = q, q = ee);
                }
                return k(q);
              case Ma:
                e: {
                  for (fe = G.key; B !== null; ) {
                    if (B.key === fe)
                      if (B.tag === 4 && B.stateNode.containerInfo === G.containerInfo && B.stateNode.implementation === G.implementation) {
                        l(
                          q,
                          B.sibling
                        ), ee = d(
                          B,
                          G.children || []
                        ), ee.return = q, q = ee;
                        break e;
                      } else {
                        l(q, B);
                        break;
                      }
                    else t(q, B);
                    B = B.sibling;
                  }
                  ee = Ls(G, q.mode, ee), ee.return = q, q = ee;
                }
                return k(q);
              case Mn:
                return G = ea(G), ha(
                  q,
                  B,
                  G,
                  ee
                );
            }
            if (Cr(G))
              return st(
                q,
                B,
                G,
                ee
              );
            if (v(G)) {
              if (fe = v(G), typeof fe != "function")
                throw Error(s(150));
              return G = fe.call(G), Ol(
                q,
                B,
                G,
                ee
              );
            }
            if (typeof G.then == "function")
              return ha(
                q,
                B,
                lr(G),
                ee
              );
            if (G.$$typeof === An)
              return ha(
                q,
                B,
                er(q, G),
                ee
              );
            rr(q, G);
          }
          return typeof G == "string" && G !== "" || typeof G == "number" || typeof G == "bigint" ? (G = "" + G, B !== null && B.tag === 6 ? (l(q, B.sibling), ee = d(B, G), ee.return = q, q = ee) : (l(q, B), ee = qs(G, q.mode, ee), ee.return = q, q = ee), k(q)) : l(q, B);
        }
        return function(q, B, G, ee) {
          try {
            Nl = 0;
            var fe = ha(
              q,
              B,
              G,
              ee
            );
            return Qa = null, fe;
          } catch (pe) {
            if (pe === Ya || pe === Lr) throw pe;
            var Ue = r(29, pe, null, q.mode);
            return Ue.lanes = ee, Ue.return = q, Ue;
          } finally {
          }
        };
      }
      function ir() {
        for (var e = Va, t = uo = Va = 0; t < e; ) {
          var l = Dt[t];
          Dt[t++] = null;
          var o = Dt[t];
          Dt[t++] = null;
          var d = Dt[t];
          Dt[t++] = null;
          var p = Dt[t];
          if (Dt[t++] = null, o !== null && d !== null) {
            var k = o.pending;
            k === null ? d.next = d : (d.next = k.next, k.next = d), o.pending = d;
          }
          p !== 0 && Kc(l, d, p);
        }
      }
      function sr(e, t, l, o) {
        Dt[Va++] = e, Dt[Va++] = t, Dt[Va++] = l, Dt[Va++] = o, uo |= o, e.lanes |= o, e = e.alternate, e !== null && (e.lanes |= o);
      }
      function Ki(e, t, l, o) {
        return sr(e, t, l, o), or(e);
      }
      function ta(e, t) {
        return sr(e, null, null, t), or(e);
      }
      function Kc(e, t, l) {
        e.lanes |= l;
        var o = e.alternate;
        o !== null && (o.lanes |= l);
        for (var d = !1, p = e.return; p !== null; )
          p.childLanes |= l, o = p.alternate, o !== null && (o.childLanes |= l), p.tag === 22 && (e = p.stateNode, e === null || e._visibility & 1 || (d = !0)), e = p, p = p.return;
        return e.tag === 3 ? (p = e.stateNode, d && t !== null && (d = 31 - Et(l), e = p.hiddenUpdates, o = e[d], o === null ? e[d] = [t] : o.push(t), t.lane = l | 536870912), p) : null;
      }
      function or(e) {
        if (50 < jl)
          throw jl = 0, _o = null, Error(s(185));
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
        if (o = o.shared, (we & 2) !== 0) {
          var d = o.pending;
          return d === null ? t.next = t : (t.next = d.next, d.next = t), o.pending = t, t = or(e), Kc(e, null, l), t;
        }
        return sr(e, o, t, l), or(e);
      }
      function ol(e, t, l) {
        if (t = t.updateQueue, t !== null && (t = t.shared, (l & 4194048) !== 0)) {
          var o = t.lanes;
          o &= e.pendingLanes, l |= o, t.lanes = l, x(e, l);
        }
      }
      function Ji(e, t) {
        var l = e.updateQueue, o = e.alternate;
        if (o !== null && (o = o.updateQueue, l === o)) {
          var d = null, p = null;
          if (l = l.firstBaseUpdate, l !== null) {
            do {
              var k = {
                lane: l.lane,
                tag: l.tag,
                payload: l.payload,
                callback: null,
                next: null
              };
              p === null ? d = p = k : p = p.next = k, l = l.next;
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
      function cl() {
        if (fo) {
          var e = Ga;
          if (e !== null) throw e;
        }
      }
      function ul(e, t, l, o) {
        fo = !1;
        var d = e.updateQueue;
        Dn = !1;
        var p = d.firstBaseUpdate, k = d.lastBaseUpdate, A = d.shared.pending;
        if (A !== null) {
          d.shared.pending = null;
          var Y = A, F = Y.next;
          Y.next = null, k === null ? p = F : k.next = F, k = Y;
          var ne = e.alternate;
          ne !== null && (ne = ne.updateQueue, A = ne.lastBaseUpdate, A !== k && (A === null ? ne.firstBaseUpdate = F : A.next = F, ne.lastBaseUpdate = Y));
        }
        if (p !== null) {
          var P = d.baseState;
          k = 0, ne = F = Y = null, A = p;
          do {
            var le = A.lane & -536870913, ge = le !== A.lane;
            if (ge ? (_e & le) === le : (o & le) === le) {
              le !== 0 && le === La && (fo = !0), ne !== null && (ne = ne.next = {
                lane: 0,
                tag: A.tag,
                payload: A.payload,
                callback: null,
                next: null
              });
              e: {
                var st = e, Ol = A;
                le = t;
                var ha = l;
                switch (Ol.tag) {
                  case 1:
                    if (st = Ol.payload, typeof st == "function") {
                      P = st.call(
                        ha,
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
                    if (st = Ol.payload, le = typeof st == "function" ? st.call(ha, P, le) : st, le == null) break e;
                    P = Ys({}, P, le);
                    break e;
                  case 2:
                    Dn = !0;
                }
              }
              le = A.callback, le !== null && (e.flags |= 64, ge && (e.flags |= 8192), ge = d.callbacks, ge === null ? d.callbacks = [le] : ge.push(le));
            } else
              ge = {
                lane: le,
                tag: A.tag,
                payload: A.payload,
                callback: A.callback,
                next: null
              }, ne === null ? (F = ne = ge, Y = P) : ne = ne.next = ge, k |= le;
            if (A = A.next, A === null) {
              if (A = d.shared.pending, A === null)
                break;
              ge = A, A = ge.next, ge.next = null, d.lastBaseUpdate = ge, d.shared.pending = null;
            }
          } while (!0);
          ne === null && (Y = P), d.baseState = Y, d.firstBaseUpdate = F, d.lastBaseUpdate = ne, p === null && (d.shared.lanes = 0), Hn |= k, e.lanes = k, e.memoizedState = P;
        }
      }
      function Zc(e, t) {
        if (typeof e != "function")
          throw Error(s(191, e));
        e.call(t);
      }
      function Xc(e, t) {
        var l = e.callbacks;
        if (l !== null)
          for (e.callbacks = null, e = 0; e < l.length; e++)
            Zc(l[e], t);
      }
      function Jc(e, t) {
        e = bn, E(Yr, e), E(Ka, t), bn = e | t.baseLanes;
      }
      function $i() {
        E(Yr, bn), E(Ka, Ka.current);
      }
      function Wi() {
        bn = Yr.current, S(Ka), S(Yr);
      }
      function zn(e) {
        var t = e.alternate;
        E(Ye, Ye.current & 1), E(Tt, e), Bt === null && (t === null || Ka.current !== null || t.memoizedState !== null) && (Bt = e);
      }
      function Fi(e) {
        E(Ye, Ye.current), E(Tt, e), Bt === null && (Bt = e);
      }
      function $c(e) {
        e.tag === 22 ? (E(Ye, Ye.current), E(Tt, e), Bt === null && (Bt = e)) : Nn();
      }
      function Nn() {
        E(Ye, Ye.current), E(Tt, Tt.current);
      }
      function kt(e) {
        S(Tt), Bt === e && (Bt = null), S(Ye);
      }
      function cr(e) {
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
          if (!Nt(e[l], t[l])) return !1;
        return !0;
      }
      function Pi(e, t, l, o, d, p) {
        return hn = p, be = t, t.memoizedState = null, t.updateQueue = null, t.lanes = 0, de.H = e === null || e.memoizedState === null ? _f : po, pa = !1, p = l(o, d), pa = !1, Za && (p = Fc(
          t,
          l,
          o,
          d
        )), Wc(e), p;
      }
      function Wc(e) {
        de.H = Cl;
        var t = Me !== null && Me.next !== null;
        if (hn = 0, Ve = Me = be = null, Qr = !1, Tl = 0, Xa = null, t) throw Error(s(300));
        e === null || Ke || (e = e.dependencies, e !== null && Pl(e) && (Ke = !0));
      }
      function Fc(e, t, l, o) {
        be = e;
        var d = 0;
        do {
          if (Za && (Xa = null), Tl = 0, Za = !1, 25 <= d) throw Error(s(301));
          if (d += 1, Ve = Me = null, e.updateQueue != null) {
            var p = e.updateQueue;
            p.lastEffect = null, p.events = null, p.stores = null, p.memoCache != null && (p.memoCache.index = 0);
          }
          de.H = Sf, p = t(l, o);
        } while (Za);
        return p;
      }
      function ch() {
        var e = de.H, t = e.useState()[0];
        return t = typeof t.then == "function" ? dl(t) : t, e = e.useState()[0], (Me !== null ? Me.memoizedState : null) !== e && (be.flags |= 1024), t;
      }
      function es() {
        var e = Vr !== 0;
        return Vr = 0, e;
      }
      function ts(e, t, l) {
        t.updateQueue = e.updateQueue, t.flags &= -2053, e.lanes &= ~l;
      }
      function ns(e) {
        if (Qr) {
          for (e = e.memoizedState; e !== null; ) {
            var t = e.queue;
            t !== null && (t.pending = null), e = e.next;
          }
          Qr = !1;
        }
        hn = 0, Ve = Me = be = null, Za = !1, Tl = Vr = 0, Xa = null;
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
      function ur() {
        return { lastEffect: null, events: null, stores: null, memoCache: null };
      }
      function dl(e) {
        var t = Tl;
        return Tl += 1, Xa === null && (Xa = []), e = Gc(Xa, e, t), t = be, (Ve === null ? t.memoizedState : Ve.next) === null && (t = t.alternate, de.H = t === null || t.memoizedState === null ? _f : po), e;
      }
      function dr(e) {
        if (e !== null && typeof e == "object") {
          if (typeof e.then == "function") return dl(e);
          if (e.$$typeof === An) return at(e);
        }
        throw Error(s(438, String(e)));
      }
      function as(e) {
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
        if (t == null && (t = { data: [], index: 0 }), l === null && (l = ur(), be.updateQueue = l), l.memoCache = t, l = t.data[t.index], l === void 0)
          for (l = t.data[t.index] = Array(e), o = 0; o < e; o++)
            l[o] = Oh;
        return t.index++, l;
      }
      function sn(e, t) {
        return typeof t == "function" ? t(e) : t;
      }
      function fr(e) {
        var t = Ge();
        return ls(t, Me, e);
      }
      function ls(e, t, l) {
        var o = e.queue;
        if (o === null) throw Error(s(311));
        o.lastRenderedReducer = l;
        var d = e.baseQueue, p = o.pending;
        if (p !== null) {
          if (d !== null) {
            var k = d.next;
            d.next = p.next, p.next = k;
          }
          t.baseQueue = d = p, o.pending = null;
        }
        if (p = e.baseState, d === null) e.memoizedState = p;
        else {
          t = d.next;
          var A = k = null, Y = null, F = t, ne = !1;
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
                }, Y === null ? (A = Y = P, k = p) : Y = Y.next = P, be.lanes |= le, Hn |= le;
              P = F.action, pa && l(p, P), p = F.hasEagerState ? F.eagerState : l(p, P);
            } else
              le = {
                lane: P,
                revertLane: F.revertLane,
                gesture: F.gesture,
                action: F.action,
                hasEagerState: F.hasEagerState,
                eagerState: F.eagerState,
                next: null
              }, Y === null ? (A = Y = le, k = p) : Y = Y.next = le, be.lanes |= P, Hn |= P;
            F = F.next;
          } while (F !== null && F !== t);
          if (Y === null ? k = p : Y.next = A, !Nt(p, e.memoizedState) && (Ke = !0, ne && (l = Ga, l !== null)))
            throw l;
          e.memoizedState = p, e.baseState = k, e.baseQueue = Y, o.lastRenderedState = p;
        }
        return d === null && (o.lanes = 0), [e.memoizedState, o.dispatch];
      }
      function rs(e) {
        var t = Ge(), l = t.queue;
        if (l === null) throw Error(s(311));
        l.lastRenderedReducer = e;
        var o = l.dispatch, d = l.pending, p = t.memoizedState;
        if (d !== null) {
          l.pending = null;
          var k = d = d.next;
          do
            p = e(p, k.action), k = k.next;
          while (k !== d);
          Nt(p, t.memoizedState) || (Ke = !0), t.memoizedState = p, t.baseQueue === null && (t.baseState = p), l.lastRenderedState = p;
        }
        return [p, o];
      }
      function Ic(e, t, l) {
        var o = be, d = Ge(), p = Se;
        if (p) {
          if (l === void 0)
            throw Error(s(407));
          l = l();
        } else l = t();
        var k = !Nt(
          (Me || d).memoizedState,
          l
        );
        if (k && (d.memoizedState = l, Ke = !0), d = d.queue, os(tu.bind(null, o, d, e), [
          e
        ]), d.getSnapshot !== t || k || Ve !== null && Ve.memoizedState.tag & 1) {
          if (o.flags |= 2048, Na(
            9,
            { destroy: void 0 },
            eu.bind(
              null,
              o,
              d,
              l,
              t
            ),
            null
          ), je === null) throw Error(s(349));
          p || (hn & 127) !== 0 || Pc(o, t, l);
        }
        return l;
      }
      function Pc(e, t, l) {
        e.flags |= 16384, e = { getSnapshot: t, value: l }, t = be.updateQueue, t === null ? (t = ur(), be.updateQueue = t, t.stores = [e]) : (l = t.stores, l === null ? t.stores = [e] : l.push(e));
      }
      function eu(e, t, l, o) {
        t.value = l, t.getSnapshot = o, nu(t) && au(e);
      }
      function tu(e, t, l) {
        return l(function() {
          nu(t) && au(e);
        });
      }
      function nu(e) {
        var t = e.getSnapshot;
        e = e.value;
        try {
          var l = t();
          return !Nt(e, l);
        } catch {
          return !0;
        }
      }
      function au(e) {
        var t = ta(e, 2);
        t !== null && vt(t, e, 2);
      }
      function is(e) {
        var t = ht();
        if (typeof e == "function") {
          var l = e;
          if (e = l(), pa) {
            j(!0);
            try {
              l();
            } finally {
              j(!1);
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
      function lu(e, t, l, o) {
        return e.baseState = l, ls(
          e,
          Me,
          typeof o == "function" ? o : sn
        );
      }
      function uh(e, t, l, o, d) {
        if (hr(e)) throw Error(s(485));
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
            then: function(k) {
              p.listeners.push(k);
            }
          };
          de.T !== null ? l(!0) : p.isTransition = !1, o(p), l = t.pending, l === null ? (p.next = t.pending = p, ru(t, p)) : (p.next = l.next, t.pending = l.next = p);
        }
      }
      function ru(e, t) {
        var l = t.action, o = t.payload, d = e.state;
        if (t.isTransition) {
          var p = de.T, k = {};
          de.T = k;
          try {
            var A = l(d, o), Y = de.S;
            Y !== null && Y(k, A), iu(e, t, A);
          } catch (F) {
            ss(e, t, F);
          } finally {
            p !== null && k.types !== null && (p.types = k.types), de.T = p;
          }
        } else
          try {
            p = l(d, o), iu(e, t, p);
          } catch (F) {
            ss(e, t, F);
          }
      }
      function iu(e, t, l) {
        l !== null && typeof l == "object" && typeof l.then == "function" ? l.then(
          function(o) {
            su(e, t, o);
          },
          function(o) {
            return ss(e, t, o);
          }
        ) : su(e, t, l);
      }
      function su(e, t, l) {
        t.status = "fulfilled", t.value = l, ou(t), e.state = l, t = e.pending, t !== null && (l = t.next, l === t ? e.pending = null : (l = l.next, t.next = l, ru(e, l)));
      }
      function ss(e, t, l) {
        var o = e.pending;
        if (e.pending = null, o !== null) {
          o = o.next;
          do
            t.status = "rejected", t.reason = l, ou(t), t = t.next;
          while (t !== o);
        }
        e.action = null;
      }
      function ou(e) {
        e = e.listeners;
        for (var t = 0; t < e.length; t++) (0, e[t])();
      }
      function cu(e, t) {
        return t;
      }
      function uu(e, t) {
        if (Se) {
          var l = je.formState;
          if (l !== null) {
            e: {
              var o = be;
              if (Se) {
                if (Be) {
                  var d = Ng(
                    Be,
                    Ot
                  );
                  if (d) {
                    Be = lf(d), o = Tg(d);
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
          lastRenderedReducer: cu,
          lastRenderedState: t
        }, l.queue = o, l = Tu.bind(
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
        return o = ht(), d = {
          state: t,
          dispatch: null,
          action: e,
          pending: null
        }, o.queue = d, l = uh.bind(
          null,
          be,
          d,
          p,
          l
        ), d.dispatch = l, o.memoizedState = e, [t, l, !1];
      }
      function du(e) {
        var t = Ge();
        return fu(t, Me, e);
      }
      function fu(e, t, l) {
        if (t = ls(
          e,
          t,
          cu
        )[0], e = fr(sn)[0], typeof t == "object" && t !== null && typeof t.then == "function")
          try {
            var o = dl(t);
          } catch (k) {
            throw k === Ya ? Lr : k;
          }
        else o = t;
        t = Ge();
        var d = t.queue, p = d.dispatch;
        return l !== t.memoizedState && (be.flags |= 2048, Na(
          9,
          { destroy: void 0 },
          dh.bind(null, d, l),
          null
        )), [o, p, e];
      }
      function dh(e, t) {
        e.action = t;
      }
      function pu(e) {
        var t = Ge(), l = Me;
        if (l !== null)
          return fu(t, l, e);
        Ge(), t = t.memoizedState, l = Ge();
        var o = l.queue.dispatch;
        return l.memoizedState = e, [t, o, !1];
      }
      function Na(e, t, l, o) {
        return e = { tag: e, create: l, deps: o, inst: t, next: null }, t = be.updateQueue, t === null && (t = ur(), be.updateQueue = t), l = t.lastEffect, l === null ? t.lastEffect = e.next = e : (o = l.next, l.next = e, e.next = o, t.lastEffect = e), e;
      }
      function mu() {
        return Ge().memoizedState;
      }
      function pr(e, t, l, o) {
        var d = ht();
        be.flags |= e, d.memoizedState = Na(
          1 | t,
          { destroy: void 0 },
          l,
          o === void 0 ? null : o
        );
      }
      function mr(e, t, l, o) {
        var d = Ge();
        o = o === void 0 ? null : o;
        var p = d.memoizedState.inst;
        Me !== null && o !== null && Ii(o, Me.memoizedState.deps) ? d.memoizedState = Na(t, p, l, o) : (be.flags |= e, d.memoizedState = Na(
          1 | t,
          p,
          l,
          o
        ));
      }
      function hu(e, t) {
        pr(8390656, 8, e, t);
      }
      function os(e, t) {
        mr(2048, 8, e, t);
      }
      function fh(e) {
        be.flags |= 4;
        var t = be.updateQueue;
        if (t === null)
          t = ur(), be.updateQueue = t, t.events = [e];
        else {
          var l = t.events;
          l === null ? t.events = [e] : l.push(e);
        }
      }
      function gu(e) {
        var t = Ge().memoizedState;
        return fh({ ref: t, nextImpl: e }), function() {
          if ((we & 2) !== 0)
            throw Error(s(440));
          return t.impl.apply(void 0, arguments);
        };
      }
      function bu(e, t) {
        return mr(4, 2, e, t);
      }
      function vu(e, t) {
        return mr(4, 4, e, t);
      }
      function yu(e, t) {
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
      function xu(e, t, l) {
        l = l != null ? l.concat([e]) : null, mr(
          4,
          4,
          yu.bind(null, t, e),
          l
        );
      }
      function cs() {
      }
      function wu(e, t) {
        var l = Ge();
        t = t === void 0 ? null : t;
        var o = l.memoizedState;
        return t !== null && Ii(t, o[1]) ? o[0] : (l.memoizedState = [e, t], e);
      }
      function ku(e, t) {
        var l = Ge();
        t = t === void 0 ? null : t;
        var o = l.memoizedState;
        if (t !== null && Ii(t, o[1]))
          return o[0];
        if (o = e(), pa) {
          j(!0);
          try {
            e();
          } finally {
            j(!1);
          }
        }
        return l.memoizedState = [o, t], o;
      }
      function us(e, t, l) {
        return l === void 0 || (hn & 1073741824) !== 0 && (_e & 261930) === 0 ? e.memoizedState = t : (e.memoizedState = l, e = vd(), be.lanes |= e, Hn |= e, l);
      }
      function _u(e, t, l, o) {
        return Nt(l, t) ? l : Ka.current !== null ? (e = us(e, l, o), Nt(e, t) || (Ke = !0), e) : (hn & 42) === 0 || (hn & 1073741824) !== 0 && (_e & 261930) === 0 ? (Ke = !0, e.memoizedState = l) : (e = vd(), be.lanes |= e, Hn |= e, t);
      }
      function Su(e, t, l, o, d) {
        var p = pn();
        et(
          p !== 0 && 8 > p ? p : 8
        );
        var k = de.T, A = {};
        de.T = A, fs(e, !1, t, l);
        try {
          var Y = d(), F = de.S;
          if (F !== null && F(A, Y), Y !== null && typeof Y == "object" && typeof Y.then == "function") {
            var ne = oh(
              Y,
              o
            );
            fl(
              e,
              t,
              ne,
              _t(e)
            );
          } else
            fl(
              e,
              t,
              o,
              _t(e)
            );
        } catch (P) {
          fl(
            e,
            t,
            { then: function() {
            }, status: "rejected", reason: P },
            _t()
          );
        } finally {
          et(p), k !== null && A.types !== null && (k.types = A.types), de.T = k;
        }
      }
      function Eu(e) {
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
        return at(sa);
      }
      function zu() {
        return Ge().memoizedState;
      }
      function Nu() {
        return Ge().memoizedState;
      }
      function ph(e) {
        for (var t = e.return; t !== null; ) {
          switch (t.tag) {
            case 24:
            case 3:
              var l = _t();
              e = Sn(l);
              var o = En(t, e, l);
              o !== null && (vt(o, t, l), ol(o, t, l)), t = { cache: Yi() }, e.payload = t;
              return;
          }
          t = t.return;
        }
      }
      function mh(e, t, l) {
        var o = _t();
        l = {
          lane: o,
          revertLane: 0,
          gesture: null,
          action: l,
          hasEagerState: !1,
          eagerState: null,
          next: null
        }, hr(e) ? Cu(t, l) : (l = Ki(e, t, l, o), l !== null && (vt(l, e, o), Au(l, t, o)));
      }
      function Tu(e, t, l) {
        var o = _t();
        fl(e, t, l, o);
      }
      function fl(e, t, l, o) {
        var d = {
          lane: o,
          revertLane: 0,
          gesture: null,
          action: l,
          hasEagerState: !1,
          eagerState: null,
          next: null
        };
        if (hr(e)) Cu(t, d);
        else {
          var p = e.alternate;
          if (e.lanes === 0 && (p === null || p.lanes === 0) && (p = t.lastRenderedReducer, p !== null))
            try {
              var k = t.lastRenderedState, A = p(k, l);
              if (d.hasEagerState = !0, d.eagerState = A, Nt(A, k))
                return sr(e, t, d, 0), je === null && ir(), !1;
            } catch {
            } finally {
            }
          if (l = Ki(e, t, d, o), l !== null)
            return vt(l, e, o), Au(l, t, o), !0;
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
        }, hr(e)) {
          if (t) throw Error(s(479));
        } else
          t = Ki(
            e,
            l,
            o,
            2
          ), t !== null && vt(t, e, 2);
      }
      function hr(e) {
        var t = e.alternate;
        return e === be || t !== null && t === be;
      }
      function Cu(e, t) {
        Za = Qr = !0;
        var l = e.pending;
        l === null ? t.next = t : (t.next = l.next, l.next = t), e.pending = t;
      }
      function Au(e, t, l) {
        if ((l & 4194048) !== 0) {
          var o = t.lanes;
          o &= e.pendingLanes, l |= o, t.lanes = l, x(e, l);
        }
      }
      function ps(e, t, l, o) {
        t = e.memoizedState, l = l(o, t), l = l == null ? t : Ys({}, t, l), e.memoizedState = l, e.lanes === 0 && (e.updateQueue.baseState = l);
      }
      function Mu(e, t, l, o, d, p, k) {
        return e = e.stateNode, typeof e.shouldComponentUpdate == "function" ? e.shouldComponentUpdate(o, p, k) : t.prototype && t.prototype.isPureReactComponent ? !ar(l, o) || !ar(d, p) : !0;
      }
      function Ru(e, t, l, o) {
        e = t.state, typeof t.componentWillReceiveProps == "function" && t.componentWillReceiveProps(l, o), typeof t.UNSAFE_componentWillReceiveProps == "function" && t.UNSAFE_componentWillReceiveProps(l, o), t.state !== e && mo.enqueueReplaceState(t, t.state, null);
      }
      function na(e, t) {
        var l = t;
        if ("ref" in t) {
          l = {};
          for (var o in t)
            o !== "ref" && (l[o] = t[o]);
        }
        if (e = e.defaultProps) {
          l === t && (l = Ys({}, l));
          for (var d in e)
            l[d] === void 0 && (l[d] = e[d]);
        }
        return l;
      }
      function gr(e, t) {
        try {
          var l = e.onUncaughtError;
          l(t.value, { componentStack: t.stack });
        } catch (o) {
          setTimeout(function() {
            throw o;
          });
        }
      }
      function ju(e, t, l) {
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
      function ms(e, t, l) {
        return l = Sn(l), l.tag = 3, l.payload = { element: null }, l.callback = function() {
          gr(e, t);
        }, l;
      }
      function Ou(e) {
        return e = Sn(e), e.tag = 3, e;
      }
      function Du(e, t, l, o) {
        var d = l.type.getDerivedStateFromError;
        if (typeof d == "function") {
          var p = o.value;
          e.payload = function() {
            return d(p);
          }, e.callback = function() {
            ju(t, l, o);
          };
        }
        var k = l.stateNode;
        k !== null && typeof k.componentDidCatch == "function" && (e.callback = function() {
          ju(t, l, o), typeof d != "function" && (Un === null ? Un = /* @__PURE__ */ new Set([this]) : Un.add(this));
          var A = o.stack;
          this.componentDidCatch(o.value, {
            componentStack: A !== null ? A : ""
          });
        });
      }
      function hh(e, t, l, o, d) {
        if (l.flags |= 32768, o !== null && typeof o == "object" && typeof o.then == "function") {
          if (t = l.alternate, t !== null && Ea(
            t,
            l,
            d,
            !0
          ), l = Tt.current, l !== null) {
            switch (l.tag) {
              case 31:
              case 13:
                return Bt === null ? Er() : l.alternate === null && Le === 0 && (Le = 3), l.flags &= -257, l.flags |= 65536, l.lanes = d, o === Gr ? l.flags |= 16384 : (t = l.updateQueue, t === null ? l.updateQueue = /* @__PURE__ */ new Set([o]) : t.add(o), Hs(e, o, d)), !1;
              case 22:
                return l.flags |= 65536, o === Gr ? l.flags |= 16384 : (t = l.updateQueue, t === null ? (t = {
                  transitions: null,
                  markerInstances: null,
                  retryQueue: /* @__PURE__ */ new Set([o])
                }, l.updateQueue = t) : (l = t.retryQueue, l === null ? t.retryQueue = /* @__PURE__ */ new Set([o]) : l.add(o)), Hs(e, o, d)), !1;
            }
            throw Error(s(435, l.tag));
          }
          return Hs(e, o, d), Er(), !1;
        }
        if (Se)
          return t = Tt.current, t !== null ? ((t.flags & 65536) === 0 && (t.flags |= 256), t.flags |= 65536, t.lanes = d, o !== ro && (e = Error(s(422), { cause: o }), rl(
            Q(e, l)
          ))) : (o !== ro && (t = Error(s(423), {
            cause: o
          }), rl(
            Q(t, l)
          )), e = e.current.alternate, e.flags |= 65536, d &= -d, e.lanes |= d, o = Q(o, l), d = ms(
            e.stateNode,
            o,
            d
          ), Ji(e, d), Le !== 4 && (Le = 2)), !1;
        var p = Error(s(520), { cause: o });
        if (p = Q(p, l), Ml === null ? Ml = [p] : Ml.push(p), Le !== 4 && (Le = 2), t === null) return !0;
        o = Q(o, l), l = t;
        do {
          switch (l.tag) {
            case 3:
              return l.flags |= 65536, e = d & -d, l.lanes |= e, e = ms(l.stateNode, o, e), Ji(l, e), !1;
            case 1:
              if (t = l.type, p = l.stateNode, (l.flags & 128) === 0 && (typeof t.getDerivedStateFromError == "function" || p !== null && typeof p.componentDidCatch == "function" && (Un === null || !Un.has(
                p
              ))))
                return l.flags |= 65536, d &= -d, l.lanes |= d, d = Ou(d), Du(
                  d,
                  e,
                  l,
                  o
                ), Ji(l, d), !1;
          }
          l = l.return;
        } while (l !== null);
        return !1;
      }
      function lt(e, t, l, o) {
        t.child = e === null ? kf(t, null, l, o) : fa(
          t,
          e.child,
          l,
          o
        );
      }
      function Bu(e, t, l, o, d) {
        l = l.render;
        var p = t.ref;
        if ("ref" in o) {
          var k = {};
          for (var A in o)
            A !== "ref" && (k[A] = o[A]);
        } else k = o;
        return Pn(t), o = Pi(
          e,
          t,
          l,
          k,
          p,
          d
        ), A = es(), e !== null && !Ke ? (ts(e, t, d), on(e, t, d)) : (Se && A && J(t), t.flags |= 1, lt(e, t, o, d), t.child);
      }
      function Hu(e, t, l, o, d) {
        if (e === null) {
          var p = l.type;
          return typeof p == "function" && !Us(p) && p.defaultProps === void 0 && l.compare === null ? (t.tag = 15, t.type = p, Uu(
            e,
            t,
            p,
            o,
            d
          )) : (e = Nr(
            l.type,
            null,
            o,
            t,
            t.mode,
            d
          ), e.ref = t.ref, e.return = t, t.child = e);
        }
        if (p = e.child, !ws(e, d)) {
          var k = p.memoizedProps;
          if (l = l.compare, l = l !== null ? l : ar, l(k, o) && e.ref === t.ref)
            return on(
              e,
              t,
              d
            );
        }
        return t.flags |= 1, e = dn(p, o), e.ref = t.ref, e.return = t, t.child = e;
      }
      function Uu(e, t, l, o, d) {
        if (e !== null) {
          var p = e.memoizedProps;
          if (ar(p, o) && e.ref === t.ref)
            if (Ke = !1, t.pendingProps = o = p, ws(e, d))
              (e.flags & 131072) !== 0 && (Ke = !0);
            else
              return t.lanes = e.lanes, on(e, t, d);
        }
        return hs(
          e,
          t,
          l,
          o,
          d
        );
      }
      function qu(e, t, l, o) {
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
            return Lu(
              e,
              t,
              p,
              l,
              o
            );
          }
          if ((l & 536870912) !== 0)
            t.memoizedState = { baseLanes: 0, cachePool: null }, e !== null && nr(
              t,
              p !== null ? p.cachePool : null
            ), p !== null ? Jc(t, p) : $i(), $c(t);
          else
            return o = t.lanes = 536870912, Lu(
              e,
              t,
              p !== null ? p.baseLanes | l : l,
              l,
              o
            );
        } else
          p !== null ? (nr(t, p.cachePool), Jc(t, p), Nn(), t.memoizedState = null) : (e !== null && nr(t, null), $i(), Nn());
        return lt(e, t, d, l), t.child;
      }
      function pl(e, t) {
        return e !== null && e.tag === 22 || t.stateNode !== null || (t.stateNode = {
          _visibility: 1,
          _pendingMarkers: null,
          _retryCache: null,
          _transitions: null
        }), t.sibling;
      }
      function Lu(e, t, l, o, d) {
        var p = Vi();
        return p = p === null ? null : {
          parent: fn ? He._currentValue : He._currentValue2,
          pool: p
        }, t.memoizedState = {
          baseLanes: l,
          cachePool: p
        }, e !== null && nr(t, null), $i(), $c(t), e !== null && Ea(e, t, o, !0), t.childLanes = d, null;
      }
      function br(e, t) {
        return t = yr(
          { mode: t.mode, children: t.children },
          e.mode
        ), t.ref = e.ref, e.child = t, t.return = e, t;
      }
      function Gu(e, t, l) {
        return fa(t, e.child, null, l), e = br(
          t,
          t.pendingProps
        ), e.flags |= 2, kt(t), t.memoizedState = null, e;
      }
      function gh(e, t, l) {
        var o = t.pendingProps, d = (t.flags & 128) !== 0;
        if (t.flags &= -129, e === null) {
          if (Se) {
            if (o.mode === "hidden")
              return e = br(t, o), t.lanes = 536870912, pl(null, e);
            if (Fi(t), (e = Be) ? (e = Hg(
              e,
              Ot
            ), e !== null && (t.memoizedState = {
              dehydrated: e,
              treeContext: Rn !== null ? { id: It, overflow: Pt } : null,
              retryLane: 536870912,
              hydrationErrors: null
            }, l = Ud(e), l.return = t, t.child = l, it = t, Be = null)) : e = null, e === null) throw he(t);
            return t.lanes = 536870912, null;
          }
          return br(t, o);
        }
        var p = e.memoizedState;
        if (p !== null) {
          var k = p.dehydrated;
          if (Fi(t), d)
            if (t.flags & 256)
              t.flags &= -257, t = Gu(
                e,
                t,
                l
              );
            else if (t.memoizedState !== null)
              t.child = e.child, t.flags |= 128, t = null;
            else throw Error(s(558));
          else if (Ke || Ea(
            e,
            t,
            l,
            !1
          ), d = (l & e.childLanes) !== 0, Ke || d) {
            if (o = je, o !== null && (k = _(o, l), k !== 0 && k !== p.retryLane))
              throw p.retryLane = k, ta(e, k), vt(o, e, k), ho;
            Er(), t = Gu(
              e,
              t,
              l
            );
          } else
            e = p.treeContext, ft && (Be = Rg(k), it = t, Se = !0, On = null, Ot = !1, e !== null && oe(t, e)), t = br(t, o), t.flags |= 4096;
          return t;
        }
        return e = dn(e.child, {
          mode: o.mode,
          children: o.children
        }), e.ref = t.ref, t.child = e, e.return = t, e;
      }
      function vr(e, t) {
        var l = t.ref;
        if (l === null)
          e !== null && e.ref !== null && (t.flags |= 4194816);
        else {
          if (typeof l != "function" && typeof l != "object")
            throw Error(s(284));
          (e === null || e.ref !== l) && (t.flags |= 4194816);
        }
      }
      function hs(e, t, l, o, d) {
        return Pn(t), l = Pi(
          e,
          t,
          l,
          o,
          void 0,
          d
        ), o = es(), e !== null && !Ke ? (ts(e, t, d), on(e, t, d)) : (Se && o && J(t), t.flags |= 1, lt(e, t, l, d), t.child);
      }
      function Yu(e, t, l, o, d, p) {
        return Pn(t), t.updateQueue = null, l = Fc(
          t,
          o,
          l,
          d
        ), Wc(e), o = es(), e !== null && !Ke ? (ts(e, t, p), on(e, t, p)) : (Se && o && J(t), t.flags |= 1, lt(e, t, l, p), t.child);
      }
      function Qu(e, t, l, o, d) {
        if (Pn(t), t.stateNode === null) {
          var p = Ba, k = l.contextType;
          typeof k == "object" && k !== null && (p = at(k)), p = new l(o, p), t.memoizedState = p.state !== null && p.state !== void 0 ? p.state : null, p.updater = mo, t.stateNode = p, p._reactInternals = t, p = t.stateNode, p.props = o, p.state = t.memoizedState, p.refs = {}, Zi(t), k = l.contextType, p.context = typeof k == "object" && k !== null ? at(k) : Ba, p.state = t.memoizedState, k = l.getDerivedStateFromProps, typeof k == "function" && (ps(
            t,
            l,
            k,
            o
          ), p.state = t.memoizedState), typeof l.getDerivedStateFromProps == "function" || typeof p.getSnapshotBeforeUpdate == "function" || typeof p.UNSAFE_componentWillMount != "function" && typeof p.componentWillMount != "function" || (k = p.state, typeof p.componentWillMount == "function" && p.componentWillMount(), typeof p.UNSAFE_componentWillMount == "function" && p.UNSAFE_componentWillMount(), k !== p.state && mo.enqueueReplaceState(
            p,
            p.state,
            null
          ), ul(t, o, p, d), cl(), p.state = t.memoizedState), typeof p.componentDidMount == "function" && (t.flags |= 4194308), o = !0;
        } else if (e === null) {
          p = t.stateNode;
          var A = t.memoizedProps, Y = na(l, A);
          p.props = Y;
          var F = p.context, ne = l.contextType;
          k = Ba, typeof ne == "object" && ne !== null && (k = at(ne));
          var P = l.getDerivedStateFromProps;
          ne = typeof P == "function" || typeof p.getSnapshotBeforeUpdate == "function", A = t.pendingProps !== A, ne || typeof p.UNSAFE_componentWillReceiveProps != "function" && typeof p.componentWillReceiveProps != "function" || (A || F !== k) && Ru(
            t,
            p,
            o,
            k
          ), Dn = !1;
          var le = t.memoizedState;
          p.state = le, ul(t, o, p, d), cl(), F = t.memoizedState, A || le !== F || Dn ? (typeof P == "function" && (ps(
            t,
            l,
            P,
            o
          ), F = t.memoizedState), (Y = Dn || Mu(
            t,
            l,
            Y,
            o,
            le,
            F,
            k
          )) ? (ne || typeof p.UNSAFE_componentWillMount != "function" && typeof p.componentWillMount != "function" || (typeof p.componentWillMount == "function" && p.componentWillMount(), typeof p.UNSAFE_componentWillMount == "function" && p.UNSAFE_componentWillMount()), typeof p.componentDidMount == "function" && (t.flags |= 4194308)) : (typeof p.componentDidMount == "function" && (t.flags |= 4194308), t.memoizedProps = o, t.memoizedState = F), p.props = o, p.state = F, p.context = k, o = Y) : (typeof p.componentDidMount == "function" && (t.flags |= 4194308), o = !1);
        } else {
          p = t.stateNode, Xi(e, t), k = t.memoizedProps, ne = na(l, k), p.props = ne, P = t.pendingProps, le = p.context, F = l.contextType, Y = Ba, typeof F == "object" && F !== null && (Y = at(F)), A = l.getDerivedStateFromProps, (F = typeof A == "function" || typeof p.getSnapshotBeforeUpdate == "function") || typeof p.UNSAFE_componentWillReceiveProps != "function" && typeof p.componentWillReceiveProps != "function" || (k !== P || le !== Y) && Ru(
            t,
            p,
            o,
            Y
          ), Dn = !1, le = t.memoizedState, p.state = le, ul(t, o, p, d), cl();
          var ge = t.memoizedState;
          k !== P || le !== ge || Dn || e !== null && e.dependencies !== null && Pl(e.dependencies) ? (typeof A == "function" && (ps(
            t,
            l,
            A,
            o
          ), ge = t.memoizedState), (ne = Dn || Mu(
            t,
            l,
            ne,
            o,
            le,
            ge,
            Y
          ) || e !== null && e.dependencies !== null && Pl(e.dependencies)) ? (F || typeof p.UNSAFE_componentWillUpdate != "function" && typeof p.componentWillUpdate != "function" || (typeof p.componentWillUpdate == "function" && p.componentWillUpdate(o, ge, Y), typeof p.UNSAFE_componentWillUpdate == "function" && p.UNSAFE_componentWillUpdate(
            o,
            ge,
            Y
          )), typeof p.componentDidUpdate == "function" && (t.flags |= 4), typeof p.getSnapshotBeforeUpdate == "function" && (t.flags |= 1024)) : (typeof p.componentDidUpdate != "function" || k === e.memoizedProps && le === e.memoizedState || (t.flags |= 4), typeof p.getSnapshotBeforeUpdate != "function" || k === e.memoizedProps && le === e.memoizedState || (t.flags |= 1024), t.memoizedProps = o, t.memoizedState = ge), p.props = o, p.state = ge, p.context = Y, o = ne) : (typeof p.componentDidUpdate != "function" || k === e.memoizedProps && le === e.memoizedState || (t.flags |= 4), typeof p.getSnapshotBeforeUpdate != "function" || k === e.memoizedProps && le === e.memoizedState || (t.flags |= 1024), o = !1);
        }
        return p = o, vr(e, t), o = (t.flags & 128) !== 0, p || o ? (p = t.stateNode, l = o && typeof l.getDerivedStateFromError != "function" ? null : p.render(), t.flags |= 1, e !== null && o ? (t.child = fa(
          t,
          e.child,
          null,
          d
        ), t.child = fa(
          t,
          null,
          l,
          d
        )) : lt(e, t, l, d), t.memoizedState = p.state, e = t.child) : e = on(
          e,
          t,
          d
        ), e;
      }
      function Vu(e, t, l, o) {
        return Lt(), t.flags |= 256, lt(e, t, l, o), t.child;
      }
      function gs(e) {
        return { baseLanes: e, cachePool: qc() };
      }
      function bs(e, t, l) {
        return e = e !== null ? e.childLanes & ~l : 0, t && (e |= At), e;
      }
      function Ku(e, t, l) {
        var o = t.pendingProps, d = !1, p = (t.flags & 128) !== 0, k;
        if ((k = p) || (k = e !== null && e.memoizedState === null ? !1 : (Ye.current & 2) !== 0), k && (d = !0, t.flags &= -129), k = (t.flags & 32) !== 0, t.flags &= -33, e === null) {
          if (Se) {
            if (d ? zn(t) : Nn(), (e = Be) ? (e = Ug(
              e,
              Ot
            ), e !== null && (t.memoizedState = {
              dehydrated: e,
              treeContext: Rn !== null ? { id: It, overflow: Pt } : null,
              retryLane: 536870912,
              hydrationErrors: null
            }, l = Ud(e), l.return = t, t.child = l, it = t, Be = null)) : e = null, e === null) throw he(t);
            return Is(e) ? t.lanes = 32 : t.lanes = 536870912, null;
          }
          var A = o.children;
          return o = o.fallback, d ? (Nn(), d = t.mode, A = yr(
            { mode: "hidden", children: A },
            d
          ), o = ra(
            o,
            d,
            l,
            null
          ), A.return = t, o.return = t, A.sibling = o, t.child = A, o = t.child, o.memoizedState = gs(l), o.childLanes = bs(
            e,
            k,
            l
          ), t.memoizedState = go, pl(null, o)) : (zn(t), vs(t, A));
        }
        var Y = e.memoizedState;
        if (Y !== null && (A = Y.dehydrated, A !== null)) {
          if (p)
            t.flags & 256 ? (zn(t), t.flags &= -257, t = ys(
              e,
              t,
              l
            )) : t.memoizedState !== null ? (Nn(), t.child = e.child, t.flags |= 128, t = null) : (Nn(), A = o.fallback, d = t.mode, o = yr(
              { mode: "visible", children: o.children },
              d
            ), A = ra(
              A,
              d,
              l,
              null
            ), A.flags |= 2, o.return = t, A.return = t, o.sibling = A, t.child = o, fa(
              t,
              e.child,
              null,
              l
            ), o = t.child, o.memoizedState = gs(l), o.childLanes = bs(
              e,
              k,
              l
            ), t.memoizedState = go, t = pl(null, o));
          else if (zn(t), Is(A))
            k = Eg(A).digest, o = Error(s(419)), o.stack = "", o.digest = k, rl({ value: o, source: null, stack: null }), t = ys(
              e,
              t,
              l
            );
          else if (Ke || Ea(
            e,
            t,
            l,
            !1
          ), k = (l & e.childLanes) !== 0, Ke || k) {
            if (k = je, k !== null && (o = _(
              k,
              l
            ), o !== 0 && o !== Y.retryLane))
              throw Y.retryLane = o, ta(e, o), vt(k, e, o), ho;
            Fs(A) || Er(), t = ys(
              e,
              t,
              l
            );
          } else
            Fs(A) ? (t.flags |= 192, t.child = e.child, t = null) : (e = Y.treeContext, ft && (Be = jg(
              A
            ), it = t, Se = !0, On = null, Ot = !1, e !== null && oe(t, e)), t = vs(
              t,
              o.children
            ), t.flags |= 4096);
          return t;
        }
        return d ? (Nn(), A = o.fallback, d = t.mode, Y = e.child, p = Y.sibling, o = dn(Y, {
          mode: "hidden",
          children: o.children
        }), o.subtreeFlags = Y.subtreeFlags & 65011712, p !== null ? A = dn(
          p,
          A
        ) : (A = ra(
          A,
          d,
          l,
          null
        ), A.flags |= 2), A.return = t, o.return = t, o.sibling = A, t.child = o, pl(null, o), o = t.child, A = e.child.memoizedState, A === null ? A = gs(l) : (d = A.cachePool, d !== null ? (Y = fn ? He._currentValue : He._currentValue2, d = d.parent !== Y ? { parent: Y, pool: Y } : d) : d = qc(), A = {
          baseLanes: A.baseLanes | l,
          cachePool: d
        }), o.memoizedState = A, o.childLanes = bs(
          e,
          k,
          l
        ), t.memoizedState = go, pl(e.child, o)) : (zn(t), l = e.child, e = l.sibling, l = dn(l, {
          mode: "visible",
          children: o.children
        }), l.return = t, l.sibling = null, e !== null && (k = t.deletions, k === null ? (t.deletions = [e], t.flags |= 16) : k.push(e)), t.child = l, t.memoizedState = null, l);
      }
      function vs(e, t) {
        return t = yr(
          { mode: "visible", children: t },
          e.mode
        ), t.return = e, e.child = t;
      }
      function yr(e, t) {
        return e = r(22, e, null, t), e.lanes = 0, e;
      }
      function ys(e, t, l) {
        return fa(t, e.child, null, l), e = vs(
          t,
          t.pendingProps.children
        ), e.flags |= 2, t.memoizedState = null, e;
      }
      function Zu(e, t, l) {
        e.lanes |= t;
        var o = e.alternate;
        o !== null && (o.lanes |= t), Li(e.return, t, l);
      }
      function xs(e, t, l, o, d, p) {
        var k = e.memoizedState;
        k === null ? e.memoizedState = {
          isBackwards: t,
          rendering: null,
          renderingStartTime: 0,
          last: o,
          tail: l,
          tailMode: d,
          treeForkCount: p
        } : (k.isBackwards = t, k.rendering = null, k.renderingStartTime = 0, k.last = o, k.tail = l, k.tailMode = d, k.treeForkCount = p);
      }
      function Xu(e, t, l) {
        var o = t.pendingProps, d = o.revealOrder, p = o.tail;
        o = o.children;
        var k = Ye.current, A = (k & 2) !== 0;
        if (A ? (k = k & 1 | 2, t.flags |= 128) : k &= 1, E(Ye, k), lt(e, t, o, l), o = Se ? Sl : 0, !A && e !== null && (e.flags & 128) !== 0)
          e: for (e = t.child; e !== null; ) {
            if (e.tag === 13)
              e.memoizedState !== null && Zu(e, l, t);
            else if (e.tag === 19)
              Zu(e, l, t);
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
              e = l.alternate, e !== null && cr(e) === null && (d = l), l = l.sibling;
            l = d, l === null ? (d = t.child, t.child = null) : (d = l.sibling, l.sibling = null), xs(
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
              if (e = d.alternate, e !== null && cr(e) === null) {
                t.child = d;
                break;
              }
              e = d.sibling, d.sibling = l, l = d, d = e;
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
        return (e.lanes & t) !== 0 ? !0 : (e = e.dependencies, !!(e !== null && Pl(e)));
      }
      function bh(e, t, l) {
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
              return o.dehydrated !== null ? (zn(t), t.flags |= 128, null) : (l & t.child.childLanes) !== 0 ? Ku(
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
            var d = (e.flags & 128) !== 0;
            if (o = (l & t.childLanes) !== 0, o || (Ea(
              e,
              t,
              l,
              !1
            ), o = (l & t.childLanes) !== 0), d) {
              if (o)
                return Xu(
                  e,
                  t,
                  l
                );
              t.flags |= 128;
            }
            if (d = t.memoizedState, d !== null && (d.rendering = null, d.tail = null, d.lastEffect = null), E(Ye, Ye.current), o) break;
            return null;
          case 22:
            return t.lanes = 0, qu(
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
      function Ju(e, t, l) {
        if (e !== null)
          if (e.memoizedProps !== t.pendingProps)
            Ke = !0;
          else {
            if (!ws(e, l) && (t.flags & 128) === 0)
              return Ke = !1, bh(
                e,
                t,
                l
              );
            Ke = (e.flags & 131072) !== 0;
          }
        else
          Ke = !1, Se && (t.flags & 1048576) !== 0 && C(t, Sl, t.index);
        switch (t.lanes = 0, t.tag) {
          case 16:
            e: {
              var o = t.pendingProps;
              if (e = ea(t.elementType), t.type = e, typeof e == "function")
                Us(e) ? (o = na(e, o), t.tag = 1, t = Qu(
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
                  var d = e.$$typeof;
                  if (d === Vs) {
                    t.tag = 11, t = Bu(
                      null,
                      t,
                      e,
                      o,
                      l
                    );
                    break e;
                  } else if (d === Xs) {
                    t.tag = 14, t = Hu(
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
            return hs(
              e,
              t,
              t.type,
              t.pendingProps,
              l
            );
          case 1:
            return o = t.type, d = na(
              o,
              t.pendingProps
            ), Qu(
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
              d = t.memoizedState, o = d.element, Xi(e, t), ul(t, p, null, l);
              var k = t.memoizedState;
              if (p = k.cache, _n(t, He, p), p !== d.cache && Gi(
                t,
                [He],
                l,
                !0
              ), cl(), p = k.element, ft && d.isDehydrated)
                if (d = {
                  element: p,
                  isDehydrated: !1,
                  cache: k.cache
                }, t.updateQueue.baseState = d, t.memoizedState = d, t.flags & 256) {
                  t = Vu(
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
                  ), rl(o), t = Vu(
                    e,
                    t,
                    p,
                    l
                  );
                  break e;
                } else
                  for (ft && (Be = Mg(
                    t.stateNode.containerInfo
                  ), it = t, Se = !0, On = null, Ot = !0), l = kf(
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
              return vr(e, t), e === null ? (l = of(
                t.type,
                null,
                t.pendingProps,
                null
              )) ? t.memoizedState = l : Se || (t.stateNode = l0(
                t.type,
                t.pendingProps,
                jn.current,
                t
              )) : t.memoizedState = of(
                t.type,
                e.memoizedProps,
                t.pendingProps,
                e.memoizedState
              ), null;
          case 27:
            if (We)
              return Ee(t), e === null && We && Se && (o = t.stateNode = mf(
                t.type,
                t.pendingProps,
                jn.current,
                rt.current,
                !1
              ), it = t, Ot = !0, Be = Og(
                t.type,
                o,
                Be
              )), lt(
                e,
                t,
                t.pendingProps.children,
                l
              ), vr(e, t), e === null && (t.flags |= 4194304), t.child;
          case 5:
            return e === null && Se && (t0(
              t.type,
              t.pendingProps,
              rt.current
            ), (d = o = Be) && (o = Dg(
              o,
              t.type,
              t.pendingProps,
              Ot
            ), o !== null ? (t.stateNode = o, it = t, Be = Ag(o), Ot = !1, d = !0) : d = !1), d || he(t)), Ee(t), d = t.type, p = t.pendingProps, k = e !== null ? e.memoizedProps : null, o = p.children, Ar(d, p) ? o = null : k !== null && Ar(d, k) && (t.flags |= 32), t.memoizedState !== null && (d = Pi(
              e,
              t,
              ch,
              null,
              null,
              l
            ), fn ? sa._currentValue = d : sa._currentValue2 = d), vr(e, t), lt(e, t, o, l), t.child;
          case 6:
            return e === null && Se && (n0(
              t.pendingProps,
              rt.current
            ), (e = l = Be) && (l = Bg(
              l,
              t.pendingProps,
              Ot
            ), l !== null ? (t.stateNode = l, it = t, Be = null, e = !0) : e = !1), e || he(t)), null;
          case 13:
            return Ku(e, t, l);
          case 4:
            return ce(
              t,
              t.stateNode.containerInfo
            ), o = t.pendingProps, e === null ? t.child = fa(
              t,
              null,
              o,
              l
            ) : lt(e, t, o, l), t.child;
          case 11:
            return Bu(
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
            return d = t.type._context, o = t.pendingProps.children, Pn(t), d = at(d), o = o(d), t.flags |= 1, lt(e, t, o, l), t.child;
          case 14:
            return Hu(
              e,
              t,
              t.type,
              t.pendingProps,
              l
            );
          case 15:
            return Uu(
              e,
              t,
              t.type,
              t.pendingProps,
              l
            );
          case 19:
            return Xu(
              e,
              t,
              l
            );
          case 31:
            return gh(e, t, l);
          case 22:
            return qu(
              e,
              t,
              l,
              t.pendingProps
            );
          case 24:
            return Pn(t), o = at(He), e === null ? (d = Vi(), d === null && (d = je, p = Yi(), d.pooledCache = p, p.refCount++, p !== null && (d.pooledCacheLanes |= l), d = p), t.memoizedState = {
              parent: o,
              cache: d
            }, Zi(t), _n(t, He, d)) : ((e.lanes & l) !== 0 && (Xi(e, t), ul(t, null, null, l), cl()), d = e.memoizedState, p = t.memoizedState, d.parent !== o ? (d = { parent: o, cache: o }, t.memoizedState = d, t.lanes === 0 && (t.memoizedState = t.updateQueue.baseState = d), _n(t, He, o)) : (o = p.cache, _n(t, He, o), o !== d.cache && Gi(
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
      function xr(e) {
        Ft && (e.flags |= 8);
      }
      function $u(e, t) {
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
              l && o && (p = nf(
                p,
                d.type,
                d.memoizedProps
              )), $s(e, p);
            } else if (d.tag === 6)
              p = d.stateNode, l && o && (p = af(
                p,
                d.memoizedProps
              )), $s(e, p);
            else if (d.tag !== 4) {
              if (d.tag === 22 && d.memoizedState !== null)
                p = d.child, p !== null && (p.return = d), ks(e, d, !0, !0);
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
      function Wu(e, t, l, o) {
        var d = !1;
        if (Ft)
          for (var p = t.child; p !== null; ) {
            if (p.tag === 5) {
              var k = p.stateNode;
              l && o && (k = nf(
                k,
                p.type,
                p.memoizedProps
              )), ef(e, k);
            } else if (p.tag === 6)
              k = p.stateNode, l && o && (k = af(
                k,
                p.memoizedProps
              )), ef(e, k);
            else if (p.tag !== 4) {
              if (p.tag === 22 && p.memoizedState !== null)
                d = p.child, d !== null && (d.return = p), Wu(e, p, !0, !0), d = !0;
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
      function Fu(e, t) {
        if (Ft && $u(e, t)) {
          e = t.stateNode;
          var l = e.containerInfo, o = Pd();
          Wu(o, t, !1, !1), e.pendingChildren = o, Gt(t), Sg(l, o);
        }
      }
      function _s(e, t, l, o) {
        if (dt)
          e.memoizedProps !== o && Gt(t);
        else if (Ft) {
          var d = e.stateNode, p = e.memoizedProps;
          if ((e = $u(e, t)) || p !== o) {
            var k = rt.current;
            p = _g(
              d,
              l,
              p,
              o,
              !e,
              null
            ), p === d ? t.stateNode = d : (xr(t), Jd(
              p,
              l,
              o,
              k
            ) && Gt(t), t.stateNode = p, e && ks(p, t, !1, !1));
          } else t.stateNode = d;
        }
      }
      function Ss(e, t, l, o, d) {
        if ((e.mode & 32) !== 0 && (l === null ? Wh(t, o) : Fh(t, l, o))) {
          if (e.flags |= 16777216, (d & 335544128) === d || Ws(t, o))
            if (Wd(e.stateNode, t, o))
              e.flags |= 8192;
            else if (_d()) e.flags |= 8192;
            else
              throw da = Gr, co;
        } else e.flags &= -16777217;
      }
      function Iu(e, t) {
        if (i0(t)) {
          if (e.flags |= 16777216, !pf(t))
            if (_d()) e.flags |= 8192;
            else
              throw da = Gr, co;
        } else e.flags &= -16777217;
      }
      function wr(e, t) {
        t !== null && (e.flags |= 4), e.flags & 16384 && (t = e.tag !== 22 ? X() : 536870912, e.lanes |= t, Wa |= t);
      }
      function ml(e, t) {
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
      function vh(e, t, l) {
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
            return l = t.stateNode, o = null, e !== null && (o = e.memoizedState.cache), t.memoizedState.cache !== o && (t.flags |= 2048), rn(He), ue(), l.pendingContext && (l.context = l.pendingContext, l.pendingContext = null), (e === null || e.child === null) && (qt(t) ? Gt(t) : e === null || e.memoizedState.isDehydrated && (t.flags & 256) === 0 || (t.flags |= 1024, kn())), Fu(e, t), De(t), null;
          case 26:
            if (Vt) {
              var d = t.type, p = t.memoizedState;
              return e === null ? (Gt(t), p !== null ? (De(t), Iu(
                t,
                p
              )) : (De(t), Ss(
                t,
                d,
                null,
                o,
                l
              ))) : p ? p !== e.memoizedState ? (Gt(t), De(t), Iu(
                t,
                p
              )) : (De(t), t.flags &= -16777217) : (p = e.memoizedProps, dt ? p !== o && Gt(t) : _s(
                e,
                t,
                d,
                o
              ), De(t), Ss(
                t,
                d,
                p,
                o,
                l
              )), null;
            }
          case 27:
            if (We) {
              if (Pe(t), l = jn.current, d = t.type, e !== null && t.stateNode != null)
                dt ? e.memoizedProps !== o && Gt(t) : _s(e, t, d, o);
              else {
                if (!o) {
                  if (t.stateNode === null)
                    throw Error(s(166));
                  return De(t), null;
                }
                e = rt.current, qt(t) ? Fn(t, e) : (e = mf(
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
              _s(e, t, d, o);
            else {
              if (!o) {
                if (t.stateNode === null)
                  throw Error(s(166));
                return De(t), null;
              }
              if (p = rt.current, qt(t))
                Fn(t, p), $g(
                  t.stateNode,
                  d,
                  o,
                  p
                ) && (t.flags |= 64);
              else {
                var k = Yh(
                  d,
                  o,
                  jn.current,
                  p,
                  t
                );
                xr(t), ks(k, t, !1, !1), t.stateNode = k, Jd(
                  k,
                  d,
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
              l = e.memoizedProps, dt ? l !== o && Gt(t) : Ft && (l !== o ? (e = jn.current, l = rt.current, xr(t), t.stateNode = $d(
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
                if (e = t.stateNode, l = t.memoizedProps, o = null, d = it, d !== null)
                  switch (d.tag) {
                    case 27:
                    case 5:
                      o = d.memoizedProps;
                  }
                Lg(
                  e,
                  l,
                  t,
                  o
                ) || he(t, !0);
              } else
                xr(t), t.stateNode = $d(
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
                  Gg(e, t);
                } else
                  Lt(), (t.flags & 128) === 0 && (t.memoizedState = null), t.flags |= 4;
                De(t), e = !1;
              } else
                l = kn(), e !== null && e.memoizedState !== null && (e.memoizedState.hydrationErrors = l), e = !0;
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
                  Yg(d, t);
                } else
                  Lt(), (t.flags & 128) === 0 && (t.memoizedState = null), t.flags |= 4;
                De(t), d = !1;
              } else
                d = kn(), e !== null && e.memoizedState !== null && (e.memoizedState.hydrationErrors = d), d = !0;
              if (!d)
                return t.flags & 256 ? (kt(t), t) : (kt(t), null);
            }
            return kt(t), (t.flags & 128) !== 0 ? (t.lanes = l, t) : (l = o !== null, e = e !== null && e.memoizedState !== null, l && (o = t.child, d = null, o.alternate !== null && o.alternate.memoizedState !== null && o.alternate.memoizedState.cachePool !== null && (d = o.alternate.memoizedState.cachePool.pool), p = null, o.memoizedState !== null && o.memoizedState.cachePool !== null && (p = o.memoizedState.cachePool.pool), p !== d && (o.flags |= 2048)), l !== e && l && (t.child.flags |= 8192), wr(t, t.updateQueue), De(t), null);
          case 4:
            return ue(), Fu(e, t), e === null && Zh(t.stateNode.containerInfo), De(t), null;
          case 10:
            return rn(t.type), De(t), null;
          case 19:
            if (S(Ye), o = t.memoizedState, o === null) return De(t), null;
            if (d = (t.flags & 128) !== 0, p = o.rendering, p === null)
              if (d) ml(o, !1);
              else {
                if (Le !== 0 || e !== null && (e.flags & 128) !== 0)
                  for (e = t.child; e !== null; ) {
                    if (p = cr(e), p !== null) {
                      for (t.flags |= 128, ml(o, !1), e = p.updateQueue, t.updateQueue = e, wr(t, e), t.subtreeFlags = 0, e = l, l = t.child; l !== null; )
                        Hd(l, e), l = l.sibling;
                      return E(
                        Ye,
                        Ye.current & 1 | 2
                      ), Se && Z(t, o.treeForkCount), t.child;
                    }
                    e = e.sibling;
                  }
                o.tail !== null && yt() > Rl && (t.flags |= 128, d = !0, ml(o, !1), t.lanes = 4194304);
              }
            else {
              if (!d)
                if (e = cr(p), e !== null) {
                  if (t.flags |= 128, d = !0, e = e.updateQueue, t.updateQueue = e, wr(t, e), ml(o, !0), o.tail === null && o.tailMode === "hidden" && !p.alternate && !Se)
                    return De(t), null;
                } else
                  2 * yt() - o.renderingStartTime > Rl && l !== 536870912 && (t.flags |= 128, d = !0, ml(o, !1), t.lanes = 4194304);
              o.isBackwards ? (p.sibling = t.child, t.child = p) : (e = o.last, e !== null ? e.sibling = p : t.child = p, o.last = p);
            }
            return o.tail !== null ? (e = o.tail, o.rendering = e, o.tail = e.sibling, o.renderingStartTime = yt(), e.sibling = null, l = Ye.current, E(
              Ye,
              d ? l & 1 | 2 : l & 1
            ), Se && Z(t, o.treeForkCount), e) : (De(t), null);
          case 22:
          case 23:
            return kt(t), Wi(), o = t.memoizedState !== null, e !== null ? e.memoizedState !== null !== o && (t.flags |= 8192) : o && (t.flags |= 8192), o ? (l & 536870912) !== 0 && (t.flags & 128) === 0 && (De(t), t.subtreeFlags & 6 && (t.flags |= 8192)) : De(t), l = t.updateQueue, l !== null && wr(t, l.retryQueue), l = null, e !== null && e.memoizedState !== null && e.memoizedState.cachePool !== null && (l = e.memoizedState.cachePool.pool), o = null, t.memoizedState !== null && t.memoizedState.cachePool !== null && (o = t.memoizedState.cachePool.pool), o !== l && (t.flags |= 2048), e !== null && S(ua), null;
          case 24:
            return l = null, e !== null && (l = e.memoizedState.cache), t.memoizedState.cache !== l && (t.flags |= 2048), rn(He), De(t), null;
          case 25:
            return null;
          case 30:
            return null;
        }
        throw Error(s(156, t.tag));
      }
      function yh(e, t) {
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
            return S(Ye), null;
          case 4:
            return ue(), null;
          case 10:
            return rn(t.type), null;
          case 22:
          case 23:
            return kt(t), Wi(), e !== null && S(ua), e = t.flags, e & 65536 ? (t.flags = e & -65537 | 128, t) : null;
          case 24:
            return rn(He), null;
          case 25:
            return null;
          default:
            return null;
        }
      }
      function Pu(e, t) {
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
            t.memoizedState !== null && kt(t);
            break;
          case 13:
            kt(t);
            break;
          case 19:
            S(Ye);
            break;
          case 10:
            rn(t.type);
            break;
          case 22:
          case 23:
            kt(t), Wi(), e !== null && S(ua);
            break;
          case 24:
            rn(He);
        }
      }
      function hl(e, t) {
        try {
          var l = t.updateQueue, o = l !== null ? l.lastEffect : null;
          if (o !== null) {
            var d = o.next;
            l = d;
            do {
              if ((l.tag & e) === e) {
                o = void 0;
                var p = l.create, k = l.inst;
                o = p(), k.destroy = o;
              }
              l = l.next;
            } while (l !== d);
          }
        } catch (A) {
          Ne(t, t.return, A);
        }
      }
      function Tn(e, t, l) {
        try {
          var o = t.updateQueue, d = o !== null ? o.lastEffect : null;
          if (d !== null) {
            var p = d.next;
            o = p;
            do {
              if ((o.tag & e) === e) {
                var k = o.inst, A = k.destroy;
                if (A !== void 0) {
                  k.destroy = void 0, d = t;
                  var Y = l, F = A;
                  try {
                    F();
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
      function ed(e) {
        var t = e.updateQueue;
        if (t !== null) {
          var l = e.stateNode;
          try {
            Xc(t, l);
          } catch (o) {
            Ne(e, e.return, o);
          }
        }
      }
      function td(e, t, l) {
        l.props = na(
          e.type,
          e.memoizedProps
        ), l.state = e.memoizedState;
        try {
          l.componentWillUnmount();
        } catch (o) {
          Ne(e, t, o);
        }
      }
      function gl(e, t) {
        try {
          var l = e.ref;
          if (l !== null) {
            switch (e.tag) {
              case 26:
              case 27:
              case 5:
                var o = xl(e.stateNode);
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
      function Wt(e, t) {
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
      function nd(e) {
        var t = e.type, l = e.memoizedProps, o = e.stateNode;
        try {
          fg(o, t, l, e);
        } catch (d) {
          Ne(e, e.return, d);
        }
      }
      function Es(e, t, l) {
        try {
          pg(
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
      function ad(e) {
        return e.tag === 5 || e.tag === 3 || (Vt ? e.tag === 26 : !1) || (We ? e.tag === 27 && Oa(e.type) : !1) || e.tag === 4;
      }
      function zs(e) {
        e: for (; ; ) {
          for (; e.sibling === null; ) {
            if (e.return === null || ad(e.return)) return null;
            e = e.return;
          }
          for (e.sibling.return = e.return, e = e.sibling; e.tag !== 5 && e.tag !== 6 && e.tag !== 18; ) {
            if (We && e.tag === 27 && Oa(e.type) || e.flags & 2 || e.child === null || e.tag === 4) continue e;
            e.child.return = e, e = e.child;
          }
          if (!(e.flags & 2)) return e.stateNode;
        }
      }
      function Ns(e, t, l) {
        var o = e.tag;
        if (o === 5 || o === 6)
          e = e.stateNode, t ? hg(l, e, t) : ug(l, e);
        else if (o !== 4 && (We && o === 27 && Oa(e.type) && (l = e.stateNode, t = null), e = e.child, e !== null))
          for (Ns(e, t, l), e = e.sibling; e !== null; )
            Ns(e, t, l), e = e.sibling;
      }
      function kr(e, t, l) {
        var o = e.tag;
        if (o === 5 || o === 6)
          e = e.stateNode, t ? mg(l, e, t) : cg(l, e);
        else if (o !== 4 && (We && o === 27 && Oa(e.type) && (l = e.stateNode), e = e.child, e !== null))
          for (kr(e, t, l), e = e.sibling; e !== null; )
            kr(e, t, l), e = e.sibling;
      }
      function ld(e, t, l) {
        e = e.containerInfo;
        try {
          tf(e, l);
        } catch (o) {
          Ne(t, t.return, o);
        }
      }
      function rd(e) {
        var t = e.stateNode, l = e.memoizedProps;
        try {
          o0(
            e.type,
            l,
            t,
            e
          );
        } catch (o) {
          Ne(e, e.return, o);
        }
      }
      function xh(e, t) {
        for (Lh(e.containerInfo), tt = t; tt !== null; )
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
                      var k = na(
                        o.type,
                        d
                      );
                      t = p.getSnapshotBeforeUpdate(
                        k,
                        l
                      ), p.__reactInternalSnapshotBeforeUpdate = t;
                    } catch (A) {
                      Ne(o, o.return, A);
                    }
                  }
                  break;
                case 3:
                  (t & 1024) !== 0 && dt && kg(e.stateNode.containerInfo);
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
      function id(e, t, l) {
        var o = l.flags;
        switch (l.tag) {
          case 0:
          case 11:
          case 15:
            cn(e, l), o & 4 && hl(5, l);
            break;
          case 1:
            if (cn(e, l), o & 4)
              if (e = l.stateNode, t === null)
                try {
                  e.componentDidMount();
                } catch (k) {
                  Ne(l, l.return, k);
                }
              else {
                var d = na(
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
                } catch (k) {
                  Ne(
                    l,
                    l.return,
                    k
                  );
                }
              }
            o & 64 && ed(l), o & 512 && gl(l, l.return);
            break;
          case 3:
            if (cn(e, l), o & 64 && (o = l.updateQueue, o !== null)) {
              if (e = null, l.child !== null)
                switch (l.child.tag) {
                  case 27:
                  case 5:
                    e = xl(l.child.stateNode);
                    break;
                  case 1:
                    e = l.child.stateNode;
                }
              try {
                Xc(o, e);
              } catch (k) {
                Ne(l, l.return, k);
              }
            }
            break;
          case 27:
            We && t === null && o & 4 && rd(l);
          case 26:
          case 5:
            if (cn(e, l), t === null) {
              if (o & 4) nd(l);
              else if (o & 64) {
                e = l.type, t = l.memoizedProps, d = l.stateNode;
                try {
                  Kg(
                    d,
                    e,
                    t,
                    l
                  );
                } catch (k) {
                  Ne(l, l.return, k);
                }
              }
            }
            o & 512 && gl(l, l.return);
            break;
          case 12:
            cn(e, l);
            break;
          case 31:
            cn(e, l), o & 4 && od(e, l);
            break;
          case 13:
            cn(e, l), o & 4 && cd(e, l), o & 64 && (o = l.memoizedState, o !== null && (o = o.dehydrated, o !== null && (l = Nh.bind(
              null,
              l
            ), zg(o, l))));
            break;
          case 22:
            if (o = l.memoizedState !== null || gn, !o) {
              t = t !== null && t.memoizedState !== null || Ze, d = gn;
              var p = Ze;
              gn = o, (Ze = t) && !p ? un(
                e,
                l,
                (l.subtreeFlags & 8772) !== 0
              ) : cn(e, l), gn = d, Ze = p;
            }
            break;
          case 30:
            break;
          default:
            cn(e, l);
        }
      }
      function sd(e) {
        var t = e.alternate;
        t !== null && (e.alternate = null, sd(t)), e.child = null, e.deletions = null, e.sibling = null, e.tag === 5 && (t = e.stateNode, t !== null && $h(t)), e.stateNode = null, e.return = null, e.dependencies = null, e.memoizedProps = null, e.memoizedState = null, e.pendingProps = null, e.stateNode = null, e.updateQueue = null;
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
        if (zt && typeof zt.onCommitFiberUnmount == "function")
          try {
            zt.onCommitFiberUnmount(_l, l);
          } catch {
          }
        switch (l.tag) {
          case 26:
            if (Vt) {
              Ze || Wt(l, t), Yt(
                e,
                t,
                l
              ), l.memoizedState ? uf(l.memoizedState) : l.stateNode && ff(l.stateNode);
              break;
            }
          case 27:
            if (We) {
              Ze || Wt(l, t);
              var o = Xe, d = xt;
              Oa(l.type) && (Xe = l.stateNode, xt = !1), Yt(
                e,
                t,
                l
              ), hf(l.stateNode), Xe = o, xt = d;
              break;
            }
          case 5:
            Ze || Wt(l, t);
          case 6:
            if (dt) {
              if (o = Xe, d = xt, Xe = null, Yt(
                e,
                t,
                l
              ), Xe = o, xt = d, Xe !== null)
                if (xt)
                  try {
                    bg(Xe, l.stateNode);
                  } catch (p) {
                    Ne(
                      l,
                      t,
                      p
                    );
                  }
                else
                  try {
                    gg(Xe, l.stateNode);
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
            dt && Xe !== null && (xt ? Ig(
              Xe,
              l.stateNode
            ) : Fg(Xe, l.stateNode));
            break;
          case 4:
            dt ? (o = Xe, d = xt, Xe = l.stateNode.containerInfo, xt = !0, Yt(
              e,
              t,
              l
            ), Xe = o, xt = d) : (Ft && ld(
              l.stateNode,
              l,
              Pd()
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
            Tn(2, l, t), Ze || Tn(4, l, t), Yt(
              e,
              t,
              l
            );
            break;
          case 1:
            Ze || (Wt(l, t), o = l.stateNode, typeof o.componentWillUnmount == "function" && td(
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
      function od(e, t) {
        if (ft && t.memoizedState === null && (e = t.alternate, e !== null && (e = e.memoizedState, e !== null))) {
          e = e.dehydrated;
          try {
            Xg(e);
          } catch (l) {
            Ne(t, t.return, l);
          }
        }
      }
      function cd(e, t) {
        if (ft && t.memoizedState === null && (e = t.alternate, e !== null && (e = e.memoizedState, e !== null && (e = e.dehydrated, e !== null))))
          try {
            Jg(e);
          } catch (l) {
            Ne(t, t.return, l);
          }
      }
      function wh(e) {
        switch (e.tag) {
          case 31:
          case 13:
          case 19:
            var t = e.stateNode;
            return t === null && (t = e.stateNode = new Ef()), t;
          case 22:
            return e = e.stateNode, t = e._retryCache, t === null && (t = e._retryCache = new Ef()), t;
          default:
            throw Error(s(435, e.tag));
        }
      }
      function _r(e, t) {
        var l = wh(e);
        t.forEach(function(o) {
          if (!l.has(o)) {
            l.add(o);
            var d = Th.bind(null, e, o);
            o.then(d, d);
          }
        });
      }
      function ut(e, t) {
        var l = t.deletions;
        if (l !== null)
          for (var o = 0; o < l.length; o++) {
            var d = l[o], p = e, k = t;
            if (dt) {
              var A = k;
              e: for (; A !== null; ) {
                switch (A.tag) {
                  case 27:
                    if (We) {
                      if (Oa(A.type)) {
                        Xe = A.stateNode, xt = !1;
                        break e;
                      }
                      break;
                    }
                  case 5:
                    Xe = A.stateNode, xt = !1;
                    break e;
                  case 3:
                  case 4:
                    Xe = A.stateNode.containerInfo, xt = !0;
                    break e;
                }
                A = A.return;
              }
              if (Xe === null) throw Error(s(160));
              Ts(p, k, d), Xe = null, xt = !1;
            } else Ts(p, k, d);
            p = d.alternate, p !== null && (p.return = null), d.return = null;
          }
        if (t.subtreeFlags & 13886)
          for (t = t.child; t !== null; )
            ud(t, e), t = t.sibling;
      }
      function ud(e, t) {
        var l = e.alternate, o = e.flags;
        switch (e.tag) {
          case 0:
          case 11:
          case 14:
          case 15:
            ut(t, e), gt(e), o & 4 && (Tn(3, e, e.return), hl(3, e), Tn(5, e, e.return));
            break;
          case 1:
            ut(t, e), gt(e), o & 512 && (Ze || l === null || Wt(l, l.return)), o & 64 && gn && (e = e.updateQueue, e !== null && (o = e.callbacks, o !== null && (l = e.shared.hiddenCallbacks, e.shared.hiddenCallbacks = l === null ? o : l.concat(o))));
            break;
          case 26:
            if (Vt) {
              var d = Kt;
              if (ut(t, e), gt(e), o & 512 && (Ze || l === null || Wt(l, l.return)), o & 4) {
                o = l !== null ? l.memoizedState : null;
                var p = e.memoizedState;
                l === null ? p === null ? e.stateNode === null ? e.stateNode = a0(
                  d,
                  e.type,
                  e.memoizedProps,
                  e
                ) : df(
                  d,
                  e.type,
                  e.stateNode
                ) : e.stateNode = cf(
                  d,
                  p,
                  e.memoizedProps
                ) : o !== p ? (o === null ? l.stateNode !== null && ff(l.stateNode) : uf(o), p === null ? df(
                  d,
                  e.type,
                  e.stateNode
                ) : cf(
                  d,
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
            if (We) {
              ut(t, e), gt(e), o & 512 && (Ze || l === null || Wt(l, l.return)), l !== null && o & 4 && Es(
                e,
                e.memoizedProps,
                l.memoizedProps
              );
              break;
            }
          case 5:
            if (ut(t, e), gt(e), o & 512 && (Ze || l === null || Wt(l, l.return)), dt) {
              if (e.flags & 32) {
                d = e.stateNode;
                try {
                  Id(d);
                } catch (P) {
                  Ne(e, e.return, P);
                }
              }
              o & 4 && e.stateNode != null && (d = e.memoizedProps, Es(
                e,
                d,
                l !== null ? l.memoizedProps : d
              )), o & 1024 && (bo = !0);
            } else
              Ft && e.alternate !== null && (e.alternate.stateNode = e.stateNode);
            break;
          case 6:
            if (ut(t, e), gt(e), o & 4 && dt) {
              if (e.stateNode === null)
                throw Error(s(162));
              o = e.memoizedProps, l = l !== null ? l.memoizedProps : o, d = e.stateNode;
              try {
                dg(d, l, o);
              } catch (P) {
                Ne(e, e.return, P);
              }
            }
            break;
          case 3:
            if (Vt ? (r0(), d = Kt, Kt = Ps(t.containerInfo), ut(t, e), Kt = d) : ut(t, e), gt(e), o & 4) {
              if (dt && ft && l !== null && l.memoizedState.isDehydrated)
                try {
                  Zg(t.containerInfo);
                } catch (P) {
                  Ne(e, e.return, P);
                }
              if (Ft) {
                o = t.containerInfo, l = t.pendingChildren;
                try {
                  tf(o, l);
                } catch (P) {
                  Ne(e, e.return, P);
                }
              }
            }
            bo && (bo = !1, dd(e));
            break;
          case 4:
            Vt ? (l = Kt, Kt = Ps(
              e.stateNode.containerInfo
            ), ut(t, e), gt(e), Kt = l) : (ut(t, e), gt(e)), o & 4 && Ft && ld(
              e.stateNode,
              e,
              e.stateNode.pendingChildren
            );
            break;
          case 12:
            ut(t, e), gt(e);
            break;
          case 31:
            ut(t, e), gt(e), o & 4 && (o = e.updateQueue, o !== null && (e.updateQueue = null, _r(e, o)));
            break;
          case 13:
            ut(t, e), gt(e), e.child.flags & 8192 && e.memoizedState !== null != (l !== null && l.memoizedState !== null) && (Wr = yt()), o & 4 && (o = e.updateQueue, o !== null && (e.updateQueue = null, _r(e, o)));
            break;
          case 22:
            d = e.memoizedState !== null;
            var k = l !== null && l.memoizedState !== null, A = gn, Y = Ze;
            if (gn = A || d, Ze = Y || k, ut(t, e), Ze = Y, gn = A, gt(e), o & 8192 && (t = e.stateNode, t._visibility = d ? t._visibility & -2 : t._visibility | 1, d && (l === null || k || gn || Ze || aa(e)), dt)) {
              e: if (l = null, dt)
                for (t = e; ; ) {
                  if (t.tag === 5 || Vt && t.tag === 26) {
                    if (l === null) {
                      k = l = t;
                      try {
                        p = k.stateNode, d ? vg(p) : xg(
                          k.stateNode,
                          k.memoizedProps
                        );
                      } catch (P) {
                        Ne(k, k.return, P);
                      }
                    }
                  } else if (t.tag === 6) {
                    if (l === null) {
                      k = t;
                      try {
                        var F = k.stateNode;
                        d ? yg(F) : wg(F, k.memoizedProps);
                      } catch (P) {
                        Ne(k, k.return, P);
                      }
                    }
                  } else if (t.tag === 18) {
                    if (l === null) {
                      k = t;
                      try {
                        var ne = k.stateNode;
                        d ? Pg(ne) : e0(k.stateNode);
                      } catch (P) {
                        Ne(k, k.return, P);
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
            o & 4 && (o = e.updateQueue, o !== null && (l = o.retryQueue, l !== null && (o.retryQueue = null, _r(e, l))));
            break;
          case 19:
            ut(t, e), gt(e), o & 4 && (o = e.updateQueue, o !== null && (e.updateQueue = null, _r(e, o)));
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
              if (ad(o)) {
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
                    var d = l.stateNode, p = zs(e);
                    kr(e, p, d);
                    break;
                  }
                case 5:
                  var k = l.stateNode;
                  l.flags & 32 && (Id(k), l.flags &= -33);
                  var A = zs(e);
                  kr(e, A, k);
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
      function dd(e) {
        if (e.subtreeFlags & 1024)
          for (e = e.child; e !== null; ) {
            var t = e;
            dd(t), t.tag === 5 && t.flags & 1024 && eg(t.stateNode), e = e.sibling;
          }
      }
      function cn(e, t) {
        if (t.subtreeFlags & 8772)
          for (t = t.child; t !== null; )
            id(e, t.alternate, t), t = t.sibling;
      }
      function aa(e) {
        for (e = e.child; e !== null; ) {
          var t = e;
          switch (t.tag) {
            case 0:
            case 11:
            case 14:
            case 15:
              Tn(4, t, t.return), aa(t);
              break;
            case 1:
              Wt(t, t.return);
              var l = t.stateNode;
              typeof l.componentWillUnmount == "function" && td(
                t,
                t.return,
                l
              ), aa(t);
              break;
            case 27:
              We && hf(t.stateNode);
            case 26:
            case 5:
              Wt(t, t.return), aa(t);
              break;
            case 22:
              t.memoizedState === null && aa(t);
              break;
            case 30:
              aa(t);
              break;
            default:
              aa(t);
          }
          e = e.sibling;
        }
      }
      function un(e, t, l) {
        for (l = l && (t.subtreeFlags & 8772) !== 0, t = t.child; t !== null; ) {
          var o = t.alternate, d = e, p = t, k = p.flags;
          switch (p.tag) {
            case 0:
            case 11:
            case 15:
              un(
                d,
                p,
                l
              ), hl(4, p);
              break;
            case 1:
              if (un(
                d,
                p,
                l
              ), o = p, d = o.stateNode, typeof d.componentDidMount == "function")
                try {
                  d.componentDidMount();
                } catch (F) {
                  Ne(o, o.return, F);
                }
              if (o = p, d = o.updateQueue, d !== null) {
                var A = o.stateNode;
                try {
                  var Y = d.shared.hiddenCallbacks;
                  if (Y !== null)
                    for (d.shared.hiddenCallbacks = null, d = 0; d < Y.length; d++)
                      Zc(Y[d], A);
                } catch (F) {
                  Ne(o, o.return, F);
                }
              }
              l && k & 64 && ed(p), gl(p, p.return);
              break;
            case 27:
              We && rd(p);
            case 26:
            case 5:
              un(
                d,
                p,
                l
              ), l && o === null && k & 4 && nd(p), gl(p, p.return);
              break;
            case 12:
              un(
                d,
                p,
                l
              );
              break;
            case 31:
              un(
                d,
                p,
                l
              ), l && k & 4 && od(d, p);
              break;
            case 13:
              un(
                d,
                p,
                l
              ), l && k & 4 && cd(d, p);
              break;
            case 22:
              p.memoizedState === null && un(
                d,
                p,
                l
              ), gl(p, p.return);
              break;
            case 30:
              break;
            default:
              un(
                d,
                p,
                l
              );
          }
          t = t.sibling;
        }
      }
      function Cs(e, t) {
        var l = null;
        e !== null && e.memoizedState !== null && e.memoizedState.cachePool !== null && (l = e.memoizedState.cachePool.pool), e = null, t.memoizedState !== null && t.memoizedState.cachePool !== null && (e = t.memoizedState.cachePool.pool), e !== l && (e != null && e.refCount++, l != null && il(l));
      }
      function As(e, t) {
        e = null, t.alternate !== null && (e = t.alternate.memoizedState.cache), t = t.memoizedState.cache, t !== e && (t.refCount++, e != null && il(e));
      }
      function Qt(e, t, l, o) {
        if (t.subtreeFlags & 10256)
          for (t = t.child; t !== null; )
            fd(
              e,
              t,
              l,
              o
            ), t = t.sibling;
      }
      function fd(e, t, l, o) {
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
            ), d & 2048 && hl(9, t);
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
            ), d & 2048 && (e = null, t.alternate !== null && (e = t.alternate.memoizedState.cache), t = t.memoizedState.cache, t !== e && (t.refCount++, e != null && il(e)));
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
                var p = t.memoizedProps, k = p.id, A = p.onPostCommit;
                typeof A == "function" && A(
                  k,
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
            p = t.stateNode, k = t.alternate, t.memoizedState !== null ? p._visibility & 2 ? Qt(
              e,
              t,
              l,
              o
            ) : bl(
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
            )), d & 2048 && Cs(k, t);
            break;
          case 24:
            Qt(
              e,
              t,
              l,
              o
            ), d & 2048 && As(t.alternate, t);
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
      function Ta(e, t, l, o, d) {
        for (d = d && ((t.subtreeFlags & 10256) !== 0 || !1), t = t.child; t !== null; ) {
          var p = e, k = t, A = l, Y = o, F = k.flags;
          switch (k.tag) {
            case 0:
            case 11:
            case 15:
              Ta(
                p,
                k,
                A,
                Y,
                d
              ), hl(8, k);
              break;
            case 23:
              break;
            case 22:
              var ne = k.stateNode;
              k.memoizedState !== null ? ne._visibility & 2 ? Ta(
                p,
                k,
                A,
                Y,
                d
              ) : bl(
                p,
                k
              ) : (ne._visibility |= 2, Ta(
                p,
                k,
                A,
                Y,
                d
              )), d && F & 2048 && Cs(
                k.alternate,
                k
              );
              break;
            case 24:
              Ta(
                p,
                k,
                A,
                Y,
                d
              ), d && F & 2048 && As(k.alternate, k);
              break;
            default:
              Ta(
                p,
                k,
                A,
                Y,
                d
              );
          }
          t = t.sibling;
        }
      }
      function bl(e, t) {
        if (t.subtreeFlags & 10256)
          for (t = t.child; t !== null; ) {
            var l = e, o = t, d = o.flags;
            switch (o.tag) {
              case 22:
                bl(l, o), d & 2048 && Cs(
                  o.alternate,
                  o
                );
                break;
              case 24:
                bl(l, o), d & 2048 && As(
                  o.alternate,
                  o
                );
                break;
              default:
                bl(l, o);
            }
            t = t.sibling;
          }
      }
      function la(e, t, l) {
        if (e.subtreeFlags & Ja)
          for (e = e.child; e !== null; )
            pd(
              e,
              t,
              l
            ), e = e.sibling;
      }
      function pd(e, t, l) {
        switch (e.tag) {
          case 26:
            if (la(
              e,
              t,
              l
            ), e.flags & Ja)
              if (e.memoizedState !== null)
                s0(
                  l,
                  Kt,
                  e.memoizedState,
                  e.memoizedProps
                );
              else {
                var o = e.stateNode, d = e.type;
                e = e.memoizedProps, ((t & 335544128) === t || Ws(d, e)) && Fd(l, o, d, e);
              }
            break;
          case 5:
            la(
              e,
              t,
              l
            ), e.flags & Ja && (o = e.stateNode, d = e.type, e = e.memoizedProps, ((t & 335544128) === t || Ws(d, e)) && Fd(l, o, d, e));
            break;
          case 3:
          case 4:
            Vt ? (o = Kt, Kt = Ps(
              e.stateNode.containerInfo
            ), la(
              e,
              t,
              l
            ), Kt = o) : la(
              e,
              t,
              l
            );
            break;
          case 22:
            e.memoizedState === null && (o = e.alternate, o !== null && o.memoizedState !== null ? (o = Ja, Ja = 16777216, la(
              e,
              t,
              l
            ), Ja = o) : la(
              e,
              t,
              l
            ));
            break;
          default:
            la(
              e,
              t,
              l
            );
        }
      }
      function md(e) {
        var t = e.alternate;
        if (t !== null && (e = t.child, e !== null)) {
          t.child = null;
          do
            t = e.sibling, e.sibling = null, e = t;
          while (e !== null);
        }
      }
      function vl(e) {
        var t = e.deletions;
        if ((e.flags & 16) !== 0) {
          if (t !== null)
            for (var l = 0; l < t.length; l++) {
              var o = t[l];
              tt = o, gd(
                o,
                e
              );
            }
          md(e);
        }
        if (e.subtreeFlags & 10256)
          for (e = e.child; e !== null; )
            hd(e), e = e.sibling;
      }
      function hd(e) {
        switch (e.tag) {
          case 0:
          case 11:
          case 15:
            vl(e), e.flags & 2048 && Tn(9, e, e.return);
            break;
          case 3:
            vl(e);
            break;
          case 12:
            vl(e);
            break;
          case 22:
            var t = e.stateNode;
            e.memoizedState !== null && t._visibility & 2 && (e.return === null || e.return.tag !== 13) ? (t._visibility &= -3, Sr(e)) : vl(e);
            break;
          default:
            vl(e);
        }
      }
      function Sr(e) {
        var t = e.deletions;
        if ((e.flags & 16) !== 0) {
          if (t !== null)
            for (var l = 0; l < t.length; l++) {
              var o = t[l];
              tt = o, gd(
                o,
                e
              );
            }
          md(e);
        }
        for (e = e.child; e !== null; ) {
          switch (t = e, t.tag) {
            case 0:
            case 11:
            case 15:
              Tn(8, t, t.return), Sr(t);
              break;
            case 22:
              l = t.stateNode, l._visibility & 2 && (l._visibility &= -3, Sr(t));
              break;
            default:
              Sr(t);
          }
          e = e.sibling;
        }
      }
      function gd(e, t) {
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
              il(l.memoizedState.cache);
          }
          if (o = l.child, o !== null) o.return = l, tt = o;
          else
            e: for (l = e; tt !== null; ) {
              o = tt;
              var d = o.sibling, p = o.return;
              if (sd(o), o === l) {
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
      function Ms(e) {
        var t = Kh(e);
        if (t != null) {
          if (typeof t.memoizedProps["data-testname"] != "string")
            throw Error(s(364));
          return t;
        }
        if (e = ag(e), e === null) throw Error(s(362));
        return e.stateNode.current;
      }
      function Rs(e, t) {
        var l = e.tag;
        switch (t.$$typeof) {
          case Kr:
            if (e.type === t.value) return !0;
            break;
          case Zr:
            e: {
              for (t = t.value, e = [e, 0], l = 0; l < e.length; ) {
                var o = e[l++], d = o.tag, p = e[l++], k = t[p];
                if (d !== 5 && d !== 26 && d !== 27 || !kl(o)) {
                  for (; k != null && Rs(o, k); )
                    p++, k = t[p];
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
            if ((l === 5 || l === 26 || l === 27) && ig(e.stateNode, t.value))
              return !0;
            break;
          case $r:
            if ((l === 5 || l === 6 || l === 26 || l === 27) && (e = rg(e), e !== null && 0 <= e.indexOf(t.value)))
              return !0;
            break;
          case Jr:
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
          case Kr:
            return "<" + (y(e.value) || "Unknown") + ">";
          case Zr:
            return ":has(" + (js(e) || "") + ")";
          case Xr:
            return '[role="' + e.value + '"]';
          case $r:
            return '"' + e.value + '"';
          case Jr:
            return '[data-testname="' + e.value + '"]';
          default:
            throw Error(s(365));
        }
      }
      function bd(e, t) {
        var l = [];
        e = [e, 0];
        for (var o = 0; o < e.length; ) {
          var d = e[o++], p = d.tag, k = e[o++], A = t[k];
          if (p !== 5 && p !== 26 && p !== 27 || !kl(d)) {
            for (; A != null && Rs(d, A); )
              k++, A = t[k];
            if (k === t.length) l.push(d);
            else
              for (d = d.child; d !== null; )
                e.push(d, k), d = d.sibling;
          }
        }
        return l;
      }
      function Os(e, t) {
        if (!wl) throw Error(s(363));
        e = Ms(e), e = bd(e, t), t = [], e = Array.from(e);
        for (var l = 0; l < e.length; ) {
          var o = e[l++], d = o.tag;
          if (d === 5 || d === 26 || d === 27)
            kl(o) || t.push(o.stateNode);
          else
            for (o = o.child; o !== null; )
              e.push(o), o = o.sibling;
        }
        return t;
      }
      function _t() {
        return (we & 2) !== 0 && _e !== 0 ? _e & -_e : de.T !== null ? Qi() : Xh();
      }
      function vd() {
        if (At === 0)
          if ((_e & 536870912) === 0 || Se) {
            var e = Rr;
            Rr <<= 1, (Rr & 3932160) === 0 && (Rr = 262144), At = e;
          } else At = 536870912;
        return e = Tt.current, e !== null && (e.flags |= 32), At;
      }
      function vt(e, t, l) {
        (e === je && (Ae === 2 || Ae === 9) || e.cancelPendingCommit !== null) && (Ca(e, 0), Cn(
          e,
          _e,
          At,
          !1
        )), D(e, l), ((we & 2) === 0 || e !== je) && (e === je && ((we & 2) === 0 && (ma |= l), Le === 4 && Cn(
          e,
          _e,
          At,
          !1
        )), $t(e));
      }
      function yd(e, t, l) {
        if ((we & 6) !== 0) throw Error(s(327));
        var o = !l && (t & 127) === 0 && (t & e.expiredLanes) === 0 || O(e, t), d = o ? Sh(e, t) : Bs(e, t, !0), p = o;
        do {
          if (d === 0) {
            $a && !o && Cn(e, t, 0, !1);
            break;
          } else {
            if (l = e.current.alternate, p && !kh(l)) {
              d = Bs(e, t, !1), p = !1;
              continue;
            }
            if (d === 2) {
              if (p = t, e.errorRecoveryDisabledLanes & p)
                var k = 0;
              else
                k = e.pendingLanes & -536870913, k = k !== 0 ? k : k & 536870912 ? 536870912 : 0;
              if (k !== 0) {
                t = k;
                e: {
                  var A = e;
                  d = Ml;
                  var Y = ft && A.current.memoizedState.isDehydrated;
                  if (Y && (Ca(A, k).flags |= 256), k = Bs(
                    A,
                    k,
                    !1
                  ), k !== 2) {
                    if (vo && !Y) {
                      A.errorRecoveryDisabledLanes |= p, ma |= p, d = 4;
                      break e;
                    }
                    p = wt, wt = d, p !== null && (wt === null ? wt = p : wt.push.apply(
                      wt,
                      p
                    ));
                  }
                  d = k;
                }
                if (p = !1, d !== 2) continue;
              }
            }
            if (d === 1) {
              Ca(e, 0), Cn(e, t, 0, !0);
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
                  Cn(
                    o,
                    t,
                    At,
                    !Bn
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
              if ((t & 62914560) === t && (d = Wr + 300 - yt(), 10 < d)) {
                if (Cn(
                  o,
                  t,
                  At,
                  !Bn
                ), M(o, 0, !0) !== 0) break e;
                vn = t, o.timeoutHandle = Qh(
                  xd.bind(
                    null,
                    o,
                    l,
                    wt,
                    Fr,
                    xo,
                    t,
                    At,
                    ma,
                    Wa,
                    Bn,
                    p,
                    "Throttled",
                    -0,
                    0
                  ),
                  d
                );
                break e;
              }
              xd(
                o,
                l,
                wt,
                Fr,
                xo,
                t,
                At,
                ma,
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
        $t(e);
      }
      function xd(e, t, l, o, d, p, k, A, Y, F, ne, P, le, ge) {
        if (e.timeoutHandle = ia, P = t.subtreeFlags, P & 8192 || (P & 16785408) === 16785408) {
          P = Ih(), pd(
            t,
            p,
            P
          );
          var st = (p & 62914560) === p ? Wr - yt() : (p & 4194048) === p ? zf - yt() : 0;
          if (st = Ph(
            P,
            st
          ), st !== null) {
            vn = p, e.cancelPendingCommit = st(
              Cd.bind(
                null,
                e,
                t,
                p,
                l,
                o,
                d,
                k,
                A,
                Y,
                ne,
                P,
                null,
                le,
                ge
              )
            ), Cn(e, p, k, !F);
            return;
          }
        }
        Cd(
          e,
          t,
          p,
          l,
          o,
          d,
          k,
          A,
          Y
        );
      }
      function kh(e) {
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
      function Cn(e, t, l, o) {
        t &= ~yo, t &= ~ma, e.suspendedLanes |= t, e.pingedLanes &= ~t, o && (e.warmLanes |= t), o = e.expirationTimes;
        for (var d = t; 0 < d; ) {
          var p = 31 - Et(d), k = 1 << p;
          o[p] = -1, d &= ~k;
        }
        l !== 0 && w(e, l, t);
      }
      function wd() {
        return (we & 6) === 0 ? (za(0), !1) : !0;
      }
      function Ds() {
        if (ke !== null) {
          if (Ae === 0)
            var e = ke.return;
          else
            e = ke, mn = oa = null, ns(e), Qa = null, Nl = 0, e = ke;
          for (; e !== null; )
            Pu(e.alternate, e), e = e.return;
          ke = null;
        }
      }
      function Ca(e, t) {
        var l = e.timeoutHandle;
        l !== ia && (e.timeoutHandle = ia, Vh(l)), l = e.cancelPendingCommit, l !== null && (e.cancelPendingCommit = null, l()), vn = 0, Ds(), je = e, ke = l = dn(e.current, null), _e = t, Ae = 0, Ct = null, Bn = !1, $a = O(e, t), vo = !1, Wa = At = yo = ma = Hn = Le = 0, wt = Ml = null, xo = !1, (t & 8) !== 0 && (t |= t & 32);
        var o = e.entangledLanes;
        if (o !== 0)
          for (e = e.entanglements, o &= t; 0 < o; ) {
            var d = 31 - Et(o), p = 1 << d;
            t |= e[d], o &= ~p;
          }
        return bn = t, ir(), l;
      }
      function kd(e, t) {
        be = null, de.H = Cl, t === Ya || t === Lr ? (t = Yc(), Ae = 3) : t === co ? (t = Yc(), Ae = 4) : Ae = t === ho ? 8 : t !== null && typeof t == "object" && typeof t.then == "function" ? 6 : 1, Ct = t, ke === null && (Le = 1, gr(
          e,
          Q(t, e.current)
        ));
      }
      function _d() {
        var e = Tt.current;
        return e === null ? !0 : (_e & 4194048) === _e ? Bt === null : (_e & 62914560) === _e || (_e & 536870912) !== 0 ? e === Bt : !1;
      }
      function Sd() {
        var e = de.H;
        return de.H = Cl, e === null ? Cl : e;
      }
      function Ed() {
        var e = de.A;
        return de.A = k0, e;
      }
      function Er() {
        Le = 4, Bn || (_e & 4194048) !== _e && Tt.current !== null || ($a = !0), (Hn & 134217727) === 0 && (ma & 134217727) === 0 || je === null || Cn(
          je,
          _e,
          At,
          !1
        );
      }
      function Bs(e, t, l) {
        var o = we;
        we |= 2;
        var d = Sd(), p = Ed();
        (je !== e || _e !== t) && (Fr = null, Ca(e, t)), t = !1;
        var k = Le;
        e: do
          try {
            if (Ae !== 0 && ke !== null) {
              var A = ke, Y = Ct;
              switch (Ae) {
                case 8:
                  Ds(), k = 6;
                  break e;
                case 3:
                case 2:
                case 9:
                case 6:
                  Tt.current === null && (t = !0);
                  var F = Ae;
                  if (Ae = 0, Ct = null, Aa(e, A, Y, F), l && $a) {
                    k = 0;
                    break e;
                  }
                  break;
                default:
                  F = Ae, Ae = 0, Ct = null, Aa(e, A, Y, F);
              }
            }
            _h(), k = Le;
            break;
          } catch (ne) {
            kd(e, ne);
          }
        while (!0);
        return t && e.shellSuspendCounter++, mn = oa = null, we = o, de.H = d, de.A = p, ke === null && (je = null, _e = 0, ir()), k;
      }
      function _h() {
        for (; ke !== null; ) zd(ke);
      }
      function Sh(e, t) {
        var l = we;
        we |= 2;
        var o = Sd(), d = Ed();
        je !== e || _e !== t ? (Fr = null, Rl = yt() + 500, Ca(e, t)) : $a = O(
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
                  Ae = 0, Ct = null, Aa(e, t, p, 1);
                  break;
                case 2:
                case 9:
                  if (Lc(p)) {
                    Ae = 0, Ct = null, Nd(t);
                    break;
                  }
                  t = function() {
                    Ae !== 2 && Ae !== 9 || je !== e || (Ae = 7), $t(e);
                  }, p.then(t, t);
                  break e;
                case 3:
                  Ae = 7;
                  break e;
                case 4:
                  Ae = 5;
                  break e;
                case 7:
                  Lc(p) ? (Ae = 0, Ct = null, Nd(t)) : (Ae = 0, Ct = null, Aa(e, t, p, 7));
                  break;
                case 5:
                  var k = null;
                  switch (ke.tag) {
                    case 26:
                      k = ke.memoizedState;
                    case 5:
                    case 27:
                      var A = ke, Y = A.type, F = A.pendingProps;
                      if (k ? pf(k) : Wd(A.stateNode, Y, F)) {
                        Ae = 0, Ct = null;
                        var ne = A.sibling;
                        if (ne !== null) ke = ne;
                        else {
                          var P = A.return;
                          P !== null ? (ke = P, zr(P)) : ke = null;
                        }
                        break t;
                      }
                  }
                  Ae = 0, Ct = null, Aa(e, t, p, 5);
                  break;
                case 6:
                  Ae = 0, Ct = null, Aa(e, t, p, 6);
                  break;
                case 8:
                  Ds(), Le = 6;
                  break e;
                default:
                  throw Error(s(462));
              }
            }
            Eh();
            break;
          } catch (le) {
            kd(e, le);
          }
        while (!0);
        return mn = oa = null, de.H = o, de.A = d, we = l, ke !== null ? 0 : (je = null, _e = 0, ir(), Le);
      }
      function Eh() {
        for (; ke !== null && !d0(); )
          zd(ke);
      }
      function zd(e) {
        var t = Ju(
          e.alternate,
          e,
          bn
        );
        e.memoizedProps = e.pendingProps, t === null ? zr(e) : ke = t;
      }
      function Nd(e) {
        var t = e, l = t.alternate;
        switch (t.tag) {
          case 15:
          case 0:
            t = Yu(
              l,
              t,
              t.pendingProps,
              t.type,
              void 0,
              _e
            );
            break;
          case 11:
            t = Yu(
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
            Pu(l, t), t = ke = Hd(t, bn), t = Ju(l, t, bn);
        }
        e.memoizedProps = e.pendingProps, t === null ? zr(e) : ke = t;
      }
      function Aa(e, t, l, o) {
        mn = oa = null, ns(t), Qa = null, Nl = 0;
        var d = t.return;
        try {
          if (hh(
            e,
            d,
            t,
            l,
            _e
          )) {
            Le = 1, gr(
              e,
              Q(l, e.current)
            ), ke = null;
            return;
          }
        } catch (p) {
          if (d !== null) throw ke = d, p;
          Le = 1, gr(
            e,
            Q(l, e.current)
          ), ke = null;
          return;
        }
        t.flags & 32768 ? (Se || o === 1 ? e = !0 : $a || (_e & 536870912) !== 0 ? e = !1 : (Bn = e = !0, (o === 2 || o === 9 || o === 3 || o === 6) && (o = Tt.current, o !== null && o.tag === 13 && (o.flags |= 16384))), Td(t, e)) : zr(t);
      }
      function zr(e) {
        var t = e;
        do {
          if ((t.flags & 32768) !== 0) {
            Td(
              t,
              Bn
            );
            return;
          }
          e = t.return;
          var l = vh(
            t.alternate,
            t,
            bn
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
      function Td(e, t) {
        do {
          var l = yh(e.alternate, e);
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
      function Cd(e, t, l, o, d, p, k, A, Y) {
        e.cancelPendingCommit = null;
        do
          yl();
        while (Fe !== 0);
        if ((we & 6) !== 0) throw Error(s(327));
        if (t !== null) {
          if (t === e.current)
            throw Error(s(177));
          if (p = t.lanes | t.childLanes, p |= uo, g(
            e,
            l,
            p,
            k,
            A,
            Y
          ), e === je && (ke = je = null, _e = 0), Fa = t, qn = e, vn = l, wo = p, ko = d, Nf = o, (t.subtreeFlags & 10256) !== 0 || (t.flags & 10256) !== 0 ? (e.callbackNode = null, e.callbackPriority = 0, Ch(no, function() {
            return Od(), null;
          })) : (e.callbackNode = null, e.callbackPriority = 0), o = (t.flags & 13878) !== 0, (t.subtreeFlags & 13878) !== 0 || o) {
            o = de.T, de.T = null, d = pn(), et(2), k = we, we |= 4;
            try {
              xh(e, t, l);
            } finally {
              we = k, et(d), de.T = o;
            }
          }
          Fe = 1, Ad(), Md(), Rd();
        }
      }
      function Ad() {
        if (Fe === 1) {
          Fe = 0;
          var e = qn, t = Fa, l = (t.flags & 13878) !== 0;
          if ((t.subtreeFlags & 13878) !== 0 || l) {
            l = de.T, de.T = null;
            var o = pn();
            et(2);
            var d = we;
            we |= 4;
            try {
              ud(t, e), Gh(e.containerInfo);
            } finally {
              we = d, et(o), de.T = l;
            }
          }
          e.current = t, Fe = 2;
        }
      }
      function Md() {
        if (Fe === 2) {
          Fe = 0;
          var e = qn, t = Fa, l = (t.flags & 8772) !== 0;
          if ((t.subtreeFlags & 8772) !== 0 || l) {
            l = de.T, de.T = null;
            var o = pn();
            et(2);
            var d = we;
            we |= 4;
            try {
              id(e, t.alternate, t);
            } finally {
              we = d, et(o), de.T = l;
            }
          }
          Fe = 3;
        }
      }
      function Rd() {
        if (Fe === 4 || Fe === 3) {
          Fe = 0, f0();
          var e = qn, t = Fa, l = vn, o = Nf;
          (t.subtreeFlags & 10256) !== 0 || (t.flags & 10256) !== 0 ? Fe = 5 : (Fe = 0, Fa = qn = null, jd(e, e.pendingLanes));
          var d = e.pendingLanes;
          if (d === 0 && (Un = null), z(l), t = t.stateNode, zt && typeof zt.onCommitFiberRoot == "function")
            try {
              zt.onCommitFiberRoot(
                _l,
                t,
                void 0,
                (t.current.flags & 128) === 128
              );
            } catch {
            }
          if (o !== null) {
            t = de.T, d = pn(), et(2), de.T = null;
            try {
              for (var p = e.onRecoverableError, k = 0; k < o.length; k++) {
                var A = o[k];
                p(A.value, {
                  componentStack: A.stack
                });
              }
            } finally {
              de.T = t, et(d);
            }
          }
          (vn & 3) !== 0 && yl(), $t(e), d = e.pendingLanes, (l & 261930) !== 0 && (d & 42) !== 0 ? e === _o ? jl++ : (jl = 0, _o = e) : jl = 0, ft && Wg(), za(0);
        }
      }
      function jd(e, t) {
        (e.pooledCacheLanes &= t) === 0 && (t = e.pooledCache, t != null && (e.pooledCache = null, il(t)));
      }
      function yl() {
        return Ad(), Md(), Rd(), Od();
      }
      function Od() {
        if (Fe !== 5) return !1;
        var e = qn, t = wo;
        wo = 0;
        var l = z(vn), o = 32 > l ? 32 : l;
        l = de.T;
        var d = pn();
        try {
          et(o), de.T = null, o = ko, ko = null;
          var p = qn, k = vn;
          if (Fe = 0, Fa = qn = null, vn = 0, (we & 6) !== 0)
            throw Error(s(331));
          var A = we;
          if (we |= 4, hd(p.current), fd(
            p,
            p.current,
            k,
            o
          ), we = A, za(0, !1), zt && typeof zt.onPostCommitFiberRoot == "function")
            try {
              zt.onPostCommitFiberRoot(_l, p);
            } catch {
            }
          return !0;
        } finally {
          et(d), de.T = l, jd(e, t);
        }
      }
      function Dd(e, t, l) {
        t = Q(l, t), t = ms(e.stateNode, t, 2), e = En(e, t, 2), e !== null && (D(e, 2), $t(e));
      }
      function Ne(e, t, l) {
        if (e.tag === 3)
          Dd(e, e, l);
        else
          for (; t !== null; ) {
            if (t.tag === 3) {
              Dd(
                t,
                e,
                l
              );
              break;
            } else if (t.tag === 1) {
              var o = t.stateNode;
              if (typeof t.type.getDerivedStateFromError == "function" || typeof o.componentDidCatch == "function" && (Un === null || !Un.has(o))) {
                e = Q(l, e), l = Ou(2), o = En(t, l, 2), o !== null && (Du(
                  l,
                  o,
                  t,
                  e
                ), D(o, 2), $t(o));
                break;
              }
            }
            t = t.return;
          }
      }
      function Hs(e, t, l) {
        var o = e.pingCache;
        if (o === null) {
          o = e.pingCache = new _0();
          var d = /* @__PURE__ */ new Set();
          o.set(t, d);
        } else
          d = o.get(t), d === void 0 && (d = /* @__PURE__ */ new Set(), o.set(t, d));
        d.has(l) || (vo = !0, d.add(l), e = zh.bind(null, e, t, l), t.then(e, e));
      }
      function zh(e, t, l) {
        var o = e.pingCache;
        o !== null && o.delete(t), e.pingedLanes |= e.suspendedLanes & l, e.warmLanes &= ~l, je === e && (_e & l) === l && (Le === 4 || Le === 3 && (_e & 62914560) === _e && 300 > yt() - Wr ? (we & 2) === 0 && Ca(e, 0) : yo |= l, Wa === _e && (Wa = 0)), $t(e);
      }
      function Bd(e, t) {
        t === 0 && (t = X()), e = ta(e, t), e !== null && (D(e, t), $t(e));
      }
      function Nh(e) {
        var t = e.memoizedState, l = 0;
        t !== null && (l = t.retryLane), Bd(e, l);
      }
      function Th(e, t) {
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
        o !== null && o.delete(t), Bd(e, l);
      }
      function Ch(e, t) {
        return Or(e, t);
      }
      function Ah(e, t, l, o) {
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
      function Hd(e, t) {
        e.flags &= 65011714;
        var l = e.alternate;
        return l === null ? (e.childLanes = 0, e.lanes = t, e.child = null, e.subtreeFlags = 0, e.memoizedProps = null, e.memoizedState = null, e.updateQueue = null, e.dependencies = null, e.stateNode = null) : (e.childLanes = l.childLanes, e.lanes = l.lanes, e.child = l.child, e.subtreeFlags = 0, e.deletions = null, e.memoizedProps = l.memoizedProps, e.memoizedState = l.memoizedState, e.updateQueue = l.updateQueue, e.type = l.type, t = l.dependencies, e.dependencies = t === null ? null : {
          lanes: t.lanes,
          firstContext: t.firstContext
        }), e;
      }
      function Nr(e, t, l, o, d, p) {
        var k = 0;
        if (o = e, typeof e == "function") Us(e) && (k = 1);
        else if (typeof e == "string")
          k = Vt && We ? sf(e, l, rt.current) ? 26 : gf(e) ? 27 : 5 : Vt ? sf(
            e,
            l,
            rt.current
          ) ? 26 : 5 : We && gf(e) ? 27 : 5;
        else
          e: switch (e) {
            case Js:
              return e = r(31, l, t, d), e.elementType = Js, e.lanes = p, e;
            case Ra:
              return ra(
                l.children,
                d,
                p,
                t
              );
            case Vd:
              k = 8, d |= 24;
              break;
            case Qs:
              return e = r(12, l, t, d | 2), e.elementType = Qs, e.lanes = p, e;
            case Ks:
              return e = r(13, l, t, d), e.elementType = Ks, e.lanes = p, e;
            case Zs:
              return e = r(19, l, t, d), e.elementType = Zs, e.lanes = p, e;
            default:
              if (typeof e == "object" && e !== null)
                switch (e.$$typeof) {
                  case An:
                    k = 10;
                    break e;
                  case Kd:
                    k = 9;
                    break e;
                  case Vs:
                    k = 11;
                    break e;
                  case Xs:
                    k = 14;
                    break e;
                  case Mn:
                    k = 16, o = null;
                    break e;
                }
              k = 29, l = Error(
                s(
                  130,
                  e === null ? "null" : typeof e,
                  ""
                )
              ), o = null;
          }
        return t = r(k, l, t, d), t.elementType = e, t.type = o, t.lanes = p, t;
      }
      function ra(e, t, l, o) {
        return e = r(7, e, o, t), e.lanes = l, e;
      }
      function qs(e, t, l) {
        return e = r(6, e, null, t), e.lanes = l, e;
      }
      function Ud(e) {
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
      function Mh(e, t, l, o, d, p, k, A, Y) {
        this.tag = 1, this.containerInfo = e, this.pingCache = this.current = this.pendingChildren = null, this.timeoutHandle = ia, this.callbackNode = this.next = this.pendingContext = this.context = this.cancelPendingCommit = null, this.callbackPriority = 0, this.expirationTimes = W(-1), this.entangledLanes = this.shellSuspendCounter = this.errorRecoveryDisabledLanes = this.expiredLanes = this.warmLanes = this.pingedLanes = this.suspendedLanes = this.pendingLanes = 0, this.entanglements = W(0), this.hiddenUpdates = W(null), this.identifierPrefix = o, this.onUncaughtError = d, this.onCaughtError = p, this.onRecoverableError = k, this.pooledCache = null, this.pooledCacheLanes = 0, this.formState = Y, this.incompleteTransitions = /* @__PURE__ */ new Map();
      }
      function qd(e, t, l, o, d, p, k, A, Y, F, ne, P) {
        return e = new Mh(
          e,
          t,
          l,
          k,
          Y,
          F,
          ne,
          P,
          A
        ), t = 1, p === !0 && (t |= 24), p = r(3, null, null, t), e.current = p, p.stateNode = e, t = Yi(), t.refCount++, e.pooledCache = t, t.refCount++, p.memoizedState = {
          element: o,
          isDehydrated: l,
          cache: t
        }, Zi(p), e;
      }
      function Ld(e) {
        return e ? (e = Ba, e) : Ba;
      }
      function Gd(e) {
        var t = e._reactInternals;
        if (t === void 0)
          throw typeof e.render == "function" ? Error(s(188)) : (e = Object.keys(e).join(","), Error(s(268, e)));
        return e = u(t), e = e !== null ? m(e) : null, e === null ? null : xl(e.stateNode);
      }
      function Yd(e, t, l, o, d, p) {
        d = Ld(d), o.context === null ? o.context = d : o.pendingContext = d, o = Sn(t), o.payload = { element: l }, p = p === void 0 ? null : p, p !== null && (o.callback = p), l = En(e, o, t), l !== null && (vt(l, e, t), ol(l, e, t));
      }
      function Qd(e, t) {
        if (e = e.memoizedState, e !== null && e.dehydrated !== null) {
          var l = e.retryLane;
          e.retryLane = l !== 0 && l < t ? l : t;
        }
      }
      function Gs(e, t) {
        Qd(e, t), (e = e.alternate) && Qd(e, t);
      }
      var xe = {}, Rh = I0, St = eb(), Ys = Object.assign, jh = Symbol.for("react.element"), Tr = Symbol.for("react.transitional.element"), Ma = Symbol.for("react.portal"), Ra = Symbol.for("react.fragment"), Vd = Symbol.for("react.strict_mode"), Qs = Symbol.for("react.profiler"), Kd = Symbol.for("react.consumer"), An = Symbol.for("react.context"), Vs = Symbol.for("react.forward_ref"), Ks = Symbol.for("react.suspense"), Zs = Symbol.for("react.suspense_list"), Xs = Symbol.for("react.memo"), Mn = Symbol.for("react.lazy"), Js = Symbol.for("react.activity"), Oh = Symbol.for("react.memo_cache_sentinel"), Zd = Symbol.iterator, Dh = Symbol.for("react.client.reference"), Cr = Array.isArray, de = Rh.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE, Bh = a.rendererVersion, Hh = a.rendererPackageName, Xd = a.extraDevToolsConfig, xl = a.getPublicInstance, Uh = a.getRootHostContext, qh = a.getChildHostContext, Lh = a.prepareForCommit, Gh = a.resetAfterCommit, Yh = a.createInstance;
      a.cloneMutableInstance;
      var $s = a.appendInitialChild, Jd = a.finalizeInitialChildren, Ar = a.shouldSetTextContent, $d = a.createTextInstance;
      a.cloneMutableTextInstance;
      var Qh = a.scheduleTimeout, Vh = a.cancelTimeout, ia = a.noTimeout, fn = a.isPrimaryRenderer;
      a.warnsIfNotActing;
      var dt = a.supportsMutation, Ft = a.supportsPersistence, ft = a.supportsHydration, Kh = a.getInstanceFromNode;
      a.beforeActiveInstanceBlur;
      var Zh = a.preparePortalMount;
      a.prepareScopeUpdate, a.getInstanceFromScope;
      var et = a.setCurrentUpdatePriority, pn = a.getCurrentUpdatePriority, Xh = a.resolveUpdatePriority;
      a.trackSchedulerEvent, a.resolveEventType, a.resolveEventTimeStamp;
      var Jh = a.shouldAttemptEagerTransition, $h = a.detachDeletedInstance;
      a.requestPostPaintCallback;
      var Wh = a.maySuspendCommit, Fh = a.maySuspendCommitOnUpdate, Ws = a.maySuspendCommitInSyncRender, Wd = a.preloadInstance, Ih = a.startSuspendingCommit, Fd = a.suspendInstance;
      a.suspendOnActiveViewTransition;
      var Ph = a.waitForCommitToBeReady;
      a.getSuspendedCommitReason;
      var ja = a.NotPendingTransition, sa = a.HostTransitionContext, eg = a.resetFormInstance;
      a.bindToConsole;
      var tg = a.supportsMicrotasks, ng = a.scheduleMicrotask, wl = a.supportsTestSelectors, ag = a.findFiberRoot, lg = a.getBoundingRect, rg = a.getTextContent, kl = a.isHiddenSubtree, ig = a.matchAccessibilityRole, sg = a.setFocusIfFocusable, og = a.setupIntersectionObserver, cg = a.appendChild, ug = a.appendChildToContainer, dg = a.commitTextUpdate, fg = a.commitMount, pg = a.commitUpdate, mg = a.insertBefore, hg = a.insertInContainerBefore, gg = a.removeChild, bg = a.removeChildFromContainer, Id = a.resetTextContent, vg = a.hideInstance, yg = a.hideTextInstance, xg = a.unhideInstance, wg = a.unhideTextInstance;
      a.cancelViewTransitionName, a.cancelRootViewTransitionName, a.restoreRootViewTransitionName, a.cloneRootViewTransitionContainer, a.removeRootViewTransitionClone, a.measureClonedInstance, a.hasInstanceChanged, a.hasInstanceAffectedParent, a.startViewTransition, a.startGestureTransition, a.stopViewTransition, a.getCurrentGestureOffset, a.createViewTransitionInstance;
      var kg = a.clearContainer;
      a.createFragmentInstance, a.updateFragmentInstanceFiber, a.commitNewChildToFragmentInstance, a.deleteChildFromFragmentInstance;
      var _g = a.cloneInstance, Pd = a.createContainerChildSet, ef = a.appendChildToContainerChildSet, Sg = a.finalizeContainerChildren, tf = a.replaceContainerChildren, nf = a.cloneHiddenInstance, af = a.cloneHiddenTextInstance, Fs = a.isSuspenseInstancePending, Is = a.isSuspenseInstanceFallback, Eg = a.getSuspenseInstanceFallbackErrorDetails, zg = a.registerSuspenseInstanceRetry, Ng = a.canHydrateFormStateMarker, Tg = a.isFormStateMarkerMatching, lf = a.getNextHydratableSibling, Cg = a.getNextHydratableSiblingAfterSingleton, Ag = a.getFirstHydratableChild, Mg = a.getFirstHydratableChildWithinContainer, Rg = a.getFirstHydratableChildWithinActivityInstance, jg = a.getFirstHydratableChildWithinSuspenseInstance, Og = a.getFirstHydratableChildWithinSingleton, Dg = a.canHydrateInstance, Bg = a.canHydrateTextInstance, Hg = a.canHydrateActivityInstance, Ug = a.canHydrateSuspenseInstance, qg = a.hydrateInstance, Lg = a.hydrateTextInstance, Gg = a.hydrateActivityInstance, Yg = a.hydrateSuspenseInstance, Qg = a.getNextHydratableInstanceAfterActivityInstance, Vg = a.getNextHydratableInstanceAfterSuspenseInstance, Kg = a.commitHydratedInstance, Zg = a.commitHydratedContainer, Xg = a.commitHydratedActivityInstance, Jg = a.commitHydratedSuspenseInstance, $g = a.finalizeHydratedChildren, Wg = a.flushHydrationEvents;
      a.clearActivityBoundary;
      var Fg = a.clearSuspenseBoundary;
      a.clearActivityBoundaryFromContainer;
      var Ig = a.clearSuspenseBoundaryFromContainer, Pg = a.hideDehydratedBoundary, e0 = a.unhideDehydratedBoundary, rf = a.shouldDeleteUnhydratedTailInstances;
      a.diffHydratedPropsForDevWarnings, a.diffHydratedTextForDevWarnings, a.describeHydratableInstanceForDevWarnings;
      var t0 = a.validateHydratableInstance, n0 = a.validateHydratableTextInstance, Vt = a.supportsResources, sf = a.isHostHoistableType, Ps = a.getHoistableRoot, of = a.getResource, cf = a.acquireResource, uf = a.releaseResource, a0 = a.hydrateHoistable, df = a.mountHoistable, ff = a.unmountHoistable, l0 = a.createHoistableInstance, r0 = a.prepareToCommitHoistables, i0 = a.mayResourceSuspendCommit, pf = a.preloadResource, s0 = a.suspendResource, We = a.supportsSingletons, mf = a.resolveSingletonInstance, o0 = a.acquireSingletonInstance, hf = a.releaseSingletonInstance, gf = a.isHostSingletonType, Oa = a.isSingletonScope, eo = [], Da = -1, Ba = {}, Et = Math.clz32 ? Math.clz32 : R, c0 = Math.log, u0 = Math.LN2, Mr = 256, Rr = 262144, jr = 4194304, Or = St.unstable_scheduleCallback, to = St.unstable_cancelCallback, d0 = St.unstable_shouldYield, f0 = St.unstable_requestPaint, yt = St.unstable_now, bf = St.unstable_ImmediatePriority, p0 = St.unstable_UserBlockingPriority, no = St.unstable_NormalPriority, m0 = St.unstable_IdlePriority, h0 = St.log, g0 = St.unstable_setDisableYieldValue, _l = null, zt = null, Nt = typeof Object.is == "function" ? Object.is : V, vf = typeof reportError == "function" ? reportError : function(e) {
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
      }, b0 = Object.prototype.hasOwnProperty, ao, yf, lo = !1, xf = /* @__PURE__ */ new WeakMap(), Ha = [], Ua = 0, Dr = null, Sl = 0, Rt = [], jt = 0, Rn = null, It = 1, Pt = "", rt = b(null), El = b(null), jn = b(null), Br = b(null), it = null, Be = null, Se = !1, On = null, Ot = !1, ro = Error(s(519)), Hr = b(null), oa = null, mn = null, v0 = typeof AbortController < "u" ? AbortController : function() {
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
      }, y0 = St.unstable_scheduleCallback, x0 = St.unstable_NormalPriority, He = {
        $$typeof: An,
        Consumer: null,
        Provider: null,
        _currentValue: null,
        _currentValue2: null,
        _threadCount: 0
      }, Ur = null, qa = null, io = !1, qr = !1, so = !1, ca = 0, zl = null, oo = 0, La = 0, Ga = null, wf = de.S;
      de.S = function(e, t) {
        zf = yt(), typeof t == "object" && t !== null && typeof t.then == "function" && sh(e, t), wf !== null && wf(e, t);
      };
      var ua = b(null), Ya = Error(s(460)), co = Error(s(474)), Lr = Error(s(542)), Gr = { then: function() {
      } }, da = null, Qa = null, Nl = 0, fa = Vc(!0), kf = Vc(!1), Dt = [], Va = 0, uo = 0, Dn = !1, fo = !1, Ka = b(null), Yr = b(0), Tt = b(null), Bt = null, Ye = b(0), hn = 0, be = null, Me = null, Ve = null, Qr = !1, Za = !1, pa = !1, Vr = 0, Tl = 0, Xa = null, w0 = 0, Cl = {
        readContext: at,
        use: dr,
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
      Cl.useEffectEvent = qe;
      var _f = {
        readContext: at,
        use: dr,
        useCallback: function(e, t) {
          return ht().memoizedState = [
            e,
            t === void 0 ? null : t
          ], e;
        },
        useContext: at,
        useEffect: hu,
        useImperativeHandle: function(e, t, l) {
          l = l != null ? l.concat([e]) : null, pr(
            4194308,
            4,
            yu.bind(null, t, e),
            l
          );
        },
        useLayoutEffect: function(e, t) {
          return pr(4194308, 4, e, t);
        },
        useInsertionEffect: function(e, t) {
          pr(4, 2, e, t);
        },
        useMemo: function(e, t) {
          var l = ht();
          t = t === void 0 ? null : t;
          var o = e();
          if (pa) {
            j(!0);
            try {
              e();
            } finally {
              j(!1);
            }
          }
          return l.memoizedState = [o, t], o;
        },
        useReducer: function(e, t, l) {
          var o = ht();
          if (l !== void 0) {
            var d = l(t);
            if (pa) {
              j(!0);
              try {
                l(t);
              } finally {
                j(!1);
              }
            }
          } else d = t;
          return o.memoizedState = o.baseState = d, e = {
            pending: null,
            lanes: 0,
            dispatch: null,
            lastRenderedReducer: e,
            lastRenderedState: d
          }, o.queue = e, e = e.dispatch = mh.bind(
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
          var t = e.queue, l = Tu.bind(
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
          return e = Su.bind(
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
            (_e & 127) !== 0 || Pc(o, t, l);
          }
          d.memoizedState = l;
          var p = { value: l, getSnapshot: t };
          return d.queue = p, hu(tu.bind(null, o, p, e), [
            e
          ]), o.flags |= 2048, Na(
            9,
            { destroy: void 0 },
            eu.bind(
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
            l = (o & ~(1 << 32 - Et(o) - 1)).toString(32) + l, t = "_" + t + "R_" + l, l = Vr++, 0 < l && (t += "H" + l.toString(32)), t += "_";
          } else
            l = w0++, t = "_" + t + "r_" + l.toString(32) + "_";
          return e.memoizedState = t;
        },
        useHostTransitionStatus: ds,
        useFormState: uu,
        useActionState: uu,
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
          return ht().memoizedState = ph.bind(
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
      }, po = {
        readContext: at,
        use: dr,
        useCallback: wu,
        useContext: at,
        useEffect: os,
        useImperativeHandle: xu,
        useInsertionEffect: bu,
        useLayoutEffect: vu,
        useMemo: ku,
        useReducer: fr,
        useRef: mu,
        useState: function() {
          return fr(sn);
        },
        useDebugValue: cs,
        useDeferredValue: function(e, t) {
          var l = Ge();
          return _u(
            l,
            Me.memoizedState,
            e,
            t
          );
        },
        useTransition: function() {
          var e = fr(sn)[0], t = Ge().memoizedState;
          return [
            typeof e == "boolean" ? e : dl(e),
            t
          ];
        },
        useSyncExternalStore: Ic,
        useId: zu,
        useHostTransitionStatus: ds,
        useFormState: du,
        useActionState: du,
        useOptimistic: function(e, t) {
          var l = Ge();
          return lu(l, Me, e, t);
        },
        useMemoCache: as,
        useCacheRefresh: Nu
      };
      po.useEffectEvent = gu;
      var Sf = {
        readContext: at,
        use: dr,
        useCallback: wu,
        useContext: at,
        useEffect: os,
        useImperativeHandle: xu,
        useInsertionEffect: bu,
        useLayoutEffect: vu,
        useMemo: ku,
        useReducer: rs,
        useRef: mu,
        useState: function() {
          return rs(sn);
        },
        useDebugValue: cs,
        useDeferredValue: function(e, t) {
          var l = Ge();
          return Me === null ? us(l, e, t) : _u(
            l,
            Me.memoizedState,
            e,
            t
          );
        },
        useTransition: function() {
          var e = rs(sn)[0], t = Ge().memoizedState;
          return [
            typeof e == "boolean" ? e : dl(e),
            t
          ];
        },
        useSyncExternalStore: Ic,
        useId: zu,
        useHostTransitionStatus: ds,
        useFormState: pu,
        useActionState: pu,
        useOptimistic: function(e, t) {
          var l = Ge();
          return Me !== null ? lu(l, Me, e, t) : (l.baseState = e, [e, l.queue.dispatch]);
        },
        useMemoCache: as,
        useCacheRefresh: Nu
      };
      Sf.useEffectEvent = gu;
      var mo = {
        enqueueSetState: function(e, t, l) {
          e = e._reactInternals;
          var o = _t(), d = Sn(o);
          d.payload = t, l != null && (d.callback = l), t = En(e, d, o), t !== null && (vt(t, e, o), ol(t, e, o));
        },
        enqueueReplaceState: function(e, t, l) {
          e = e._reactInternals;
          var o = _t(), d = Sn(o);
          d.tag = 1, d.payload = t, l != null && (d.callback = l), t = En(e, d, o), t !== null && (vt(t, e, o), ol(t, e, o));
        },
        enqueueForceUpdate: function(e, t) {
          e = e._reactInternals;
          var l = _t(), o = Sn(l);
          o.tag = 2, t != null && (o.callback = t), t = En(e, o, l), t !== null && (vt(t, e, l), ol(t, e, l));
        }
      }, ho = Error(s(461)), Ke = !1, go = {
        dehydrated: null,
        treeContext: null,
        retryLane: 0,
        hydrationErrors: null
      }, gn = !1, Ze = !1, bo = !1, Ef = typeof WeakSet == "function" ? WeakSet : Set, tt = null, Xe = null, xt = !1, Kt = null, Ja = 8192, k0 = {
        getCacheForType: function(e) {
          var t = at(He), l = t.data.get(e);
          return l === void 0 && (l = e(), t.data.set(e, l)), l;
        },
        cacheSignal: function() {
          return at(He).controller.signal;
        }
      }, Kr = 0, Zr = 1, Xr = 2, Jr = 3, $r = 4;
      if (typeof Symbol == "function" && Symbol.for) {
        var Al = Symbol.for;
        Kr = Al("selector.component"), Zr = Al("selector.has_pseudo_class"), Xr = Al("selector.role"), Jr = Al("selector.test_id"), $r = Al("selector.text");
      }
      var _0 = typeof WeakMap == "function" ? WeakMap : Map, we = 0, je = null, ke = null, _e = 0, Ae = 0, Ct = null, Bn = !1, $a = !1, vo = !1, bn = 0, Le = 0, Hn = 0, ma = 0, yo = 0, At = 0, Wa = 0, Ml = null, wt = null, xo = !1, Wr = 0, zf = 0, Rl = 1 / 0, Fr = null, Un = null, Fe = 0, qn = null, Fa = null, vn = 0, wo = 0, ko = null, Nf = null, jl = 0, _o = null;
      return xe.attemptContinuousHydration = function(e) {
        if (e.tag === 13 || e.tag === 31) {
          var t = ta(e, 67108864);
          t !== null && vt(t, e, 67108864), Gs(e, 67108864);
        }
      }, xe.attemptHydrationAtCurrentPriority = function(e) {
        if (e.tag === 13 || e.tag === 31) {
          var t = _t();
          t = T(t);
          var l = ta(e, t);
          l !== null && vt(l, e, t), Gs(e, t);
        }
      }, xe.attemptSynchronousHydration = function(e) {
        switch (e.tag) {
          case 3:
            if (e = e.stateNode, e.current.memoizedState.isDehydrated) {
              var t = N(e.pendingLanes);
              if (t !== 0) {
                for (e.pendingLanes |= 2, e.entangledLanes |= 2; t; ) {
                  var l = 1 << 31 - Et(t);
                  e.entanglements[1] |= l, t &= ~l;
                }
                $t(e), (we & 6) === 0 && (Rl = yt() + 500, za(0));
              }
            }
            break;
          case 31:
          case 13:
            t = ta(e, 2), t !== null && vt(t, e, 2), wd(), Gs(e, 2);
        }
      }, xe.batchedUpdates = function(e, t) {
        return e(t);
      }, xe.createComponentSelector = function(e) {
        return { $$typeof: Kr, value: e };
      }, xe.createContainer = function(e, t, l, o, d, p, k, A, Y, F) {
        return qd(
          e,
          t,
          !1,
          null,
          l,
          o,
          p,
          null,
          k,
          A,
          Y,
          F
        );
      }, xe.createHasPseudoClassSelector = function(e) {
        return { $$typeof: Zr, value: e };
      }, xe.createHydrationContainer = function(e, t, l, o, d, p, k, A, Y, F, ne, P, le, ge) {
        return e = qd(
          l,
          o,
          !0,
          e,
          d,
          p,
          A,
          ge,
          Y,
          F,
          ne,
          P
        ), e.context = Ld(null), l = e.current, o = _t(), o = T(o), d = Sn(o), d.callback = t ?? null, En(l, d, o), t = o, e.current.lanes = t, D(e, t), $t(e), e;
      }, xe.createPortal = function(e, t, l) {
        var o = 3 < arguments.length && arguments[3] !== void 0 ? arguments[3] : null;
        return {
          $$typeof: Ma,
          key: o == null ? null : "" + o,
          children: e,
          containerInfo: t,
          implementation: l
        };
      }, xe.createRoleSelector = function(e) {
        return { $$typeof: Xr, value: e };
      }, xe.createTestNameSelector = function(e) {
        return { $$typeof: Jr, value: e };
      }, xe.createTextSelector = function(e) {
        return { $$typeof: $r, value: e };
      }, xe.defaultOnCaughtError = function(e) {
        console.error(e);
      }, xe.defaultOnRecoverableError = function(e) {
        vf(e);
      }, xe.defaultOnUncaughtError = function(e) {
        vf(e);
      }, xe.deferredUpdates = function(e) {
        var t = de.T, l = pn();
        try {
          return et(32), de.T = null, e();
        } finally {
          et(l), de.T = t;
        }
      }, xe.discreteUpdates = function(e, t, l, o, d) {
        var p = de.T, k = pn();
        try {
          return et(2), de.T = null, e(t, l, o, d);
        } finally {
          et(k), de.T = p, we === 0 && (Rl = yt() + 500);
        }
      }, xe.findAllNodes = Os, xe.findBoundingRects = function(e, t) {
        if (!wl) throw Error(s(363));
        t = Os(e, t), e = [];
        for (var l = 0; l < t.length; l++)
          e.push(lg(t[l]));
        for (t = e.length - 1; 0 < t; t--) {
          l = e[t];
          for (var o = l.x, d = o + l.width, p = l.y, k = p + l.height, A = t - 1; 0 <= A; A--)
            if (t !== A) {
              var Y = e[A], F = Y.x, ne = F + Y.width, P = Y.y, le = P + Y.height;
              if (o >= F && p >= P && d <= ne && k <= le) {
                e.splice(t, 1);
                break;
              } else if (o !== F || l.width !== Y.width || le < p || P > k) {
                if (!(p !== P || l.height !== Y.height || ne < o || F > d)) {
                  F > o && (Y.width += F - o, Y.x = o), ne < d && (Y.width = d - F), e.splice(t, 1);
                  break;
                }
              } else {
                P > p && (Y.height += P - p, Y.y = p), le < k && (Y.height = k - P), e.splice(t, 1);
                break;
              }
            }
        }
        return e;
      }, xe.findHostInstance = Gd, xe.findHostInstanceWithNoPortals = function(e) {
        return e = u(e), e = e !== null ? h(e) : null, e === null ? null : xl(e.stateNode);
      }, xe.findHostInstanceWithWarning = function(e) {
        return Gd(e);
      }, xe.flushPassiveEffects = yl, xe.flushSyncFromReconciler = function(e) {
        var t = we;
        we |= 1;
        var l = de.T, o = pn();
        try {
          if (et(2), de.T = null, e)
            return e();
        } finally {
          et(o), de.T = l, we = t, (we & 6) === 0 && za(0);
        }
      }, xe.flushSyncWork = wd, xe.focusWithin = function(e, t) {
        if (!wl) throw Error(s(363));
        for (e = Ms(e), t = bd(e, t), t = Array.from(t), e = 0; e < t.length; ) {
          var l = t[e++], o = l.tag;
          if (!kl(l)) {
            if ((o === 5 || o === 26 || o === 27) && sg(l.stateNode))
              return !0;
            for (l = l.child; l !== null; )
              t.push(l), l = l.sibling;
          }
        }
        return !1;
      }, xe.getFindAllNodesFailureDescription = function(e, t) {
        if (!wl) throw Error(s(363));
        var l = 0, o = [];
        e = [Ms(e), 0];
        for (var d = 0; d < e.length; ) {
          var p = e[d++], k = p.tag, A = e[d++], Y = t[A];
          if ((k !== 5 && k !== 26 && k !== 27 || !kl(p)) && (Rs(p, Y) && (o.push(js(Y)), A++, A > l && (l = A)), A < t.length))
            for (p = p.child; p !== null; )
              e.push(p, A), p = p.sibling;
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
      }, xe.getPublicRootInstance = function(e) {
        if (e = e.current, !e.child) return null;
        switch (e.child.tag) {
          case 27:
          case 5:
            return xl(e.child.stateNode);
          default:
            return e.child.stateNode;
        }
      }, xe.injectIntoDevTools = function() {
        var e = {
          bundleType: 0,
          version: Bh,
          rendererPackageName: Hh,
          currentDispatcherRef: de,
          reconcilerVersion: "19.2.0"
        };
        if (Xd !== null && (e.rendererConfig = Xd), typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ > "u") e = !1;
        else {
          var t = __REACT_DEVTOOLS_GLOBAL_HOOK__;
          if (t.isDisabled || !t.supportsFiber) e = !0;
          else {
            try {
              _l = t.inject(e), zt = t;
            } catch {
            }
            e = !!t.checkDCE;
          }
        }
        return e;
      }, xe.isAlreadyRendering = function() {
        return (we & 6) !== 0;
      }, xe.observeVisibleRects = function(e, t, l, o) {
        if (!wl) throw Error(s(363));
        e = Os(e, t);
        var d = og(
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
        var d = Eu(e).queue;
        Su(
          e,
          d,
          t,
          ja,
          l === null ? i : function() {
            var p = Eu(e);
            return p.next === null && (p = e.alternate.memoizedState), fl(
              e,
              p.next.queue,
              {},
              _t()
            ), l(o);
          }
        );
      }, xe.updateContainer = function(e, t, l, o) {
        var d = t.current, p = _t();
        return Yd(
          d,
          p,
          e,
          t,
          l,
          o
        ), p;
      }, xe.updateContainerSync = function(e, t, l, o) {
        return Yd(
          t.current,
          2,
          e,
          t,
          l,
          o
        ), 2;
      }, xe;
    }, n.exports.default = n.exports, Object.defineProperty(n.exports, "__esModule", { value: !0 });
  })(No)), No.exports;
}
var Lf;
function nb() {
  return Lf || (Lf = 1, zo.exports = tb()), zo.exports;
}
var ab = nb();
const Vp = /* @__PURE__ */ fc(ab);
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
var Gf;
function lb() {
  return Gf || (Gf = 1, yn.ConcurrentRoot = 1, yn.ContinuousEventPriority = 8, yn.DefaultEventPriority = 32, yn.DiscreteEventPriority = 2, yn.IdleEventPriority = 268435456, yn.LegacyRoot = 0, yn.NoEventPriority = 0), yn;
}
var Yf;
function rb() {
  return Yf || (Yf = 1, Ao.exports = lb()), Ao.exports;
}
var nl = rb();
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
const Kp = ["accent", "panel-bg", "surface-0", "surface-1", "surface-dim", "overlay-0", "overlay-1", "text", "subtext-0", "mauve", "green", "yellow", "red", "blue", "teal", "peach", "backdrop", "card-bg"], Qo = 16, Di = /* @__PURE__ */ new Set(["hover", "focus", "focus-visible", "focus-within", "active"]), ib = [
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
], Qf = {
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
}, sb = /* @__PURE__ */ new Set([
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
]), Zp = {
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
}, Xp = {
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
}, Vo = ["font-size", "color", ...new Set([...Object.keys(Zp), ...Object.keys(Xp)].filter((n) => n !== "font-size" && n !== "color"))], ob = new Set(Vo);
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
    let f = 1, u = c + 4;
    for (; u < n.length && f; u++)
      n[u] === "(" ? f++ : n[u] === ")" && f--;
    const m = n.slice(c + 4, u - 1), h = ct(m, ","), v = h[0].trim(), y = h.length > 1 ? m.slice(m.indexOf(",") + 1).trim() : null;
    let b = a(v);
    if ((b == null || b === "initial") && (b = y), b == null) return null;
    const S = Ko(b, a, r + 1);
    if (S === null) return null;
    i += S, s = u;
  }
}
function cb(n) {
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
function Jn(n, a) {
  const r = cb(n.trim().replace(/env\(\s*safe-area-inset-(?:top|right|bottom|left)\s*(?:,[^()]*)?\)/gi, "0px"));
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
  }, c = (b, S, E) => b && S ? { px: b.px + E * S.px, pct: b.pct + E * S.pct, num: b.num + E * S.num, unitless: b.unitless && S.unitless } : null, f = (b, S) => b ? { px: b.px * S, pct: b.pct * S, num: b.num * S, unitless: b.unitless } : null, u = (b) => b && b.unitless;
  function m() {
    const b = r[i++];
    if (!b) return null;
    if (b.num !== void 0) return s(b);
    if (b.op === "(") {
      const S = v();
      return r[i]?.op !== ")" ? null : (i++, S);
    }
    if (b.op === "-" || b.op === "+") {
      const S = m();
      return b.op === "-" ? f(S, -1) : S;
    }
    if (b.fn) {
      const S = [];
      for (; ; ) {
        S.push(v());
        const N = r[i++];
        if (!N) return null;
        if (N.op === ")") break;
        if (N.op !== ",") return null;
      }
      if (S.some((N) => !N)) return null;
      if (b.fn === "calc") return S[0];
      if (!(S.every((N) => !N.pct) || S.every((N) => !N.px && !N.num))) return null;
      const R = (N) => N.px + N.pct + N.num;
      return b.fn === "min" ? S.reduce((N, M) => R(M) < R(N) ? M : N) : b.fn === "max" ? S.reduce((N, M) => R(M) > R(N) ? M : N) : b.fn === "clamp" && S.length === 3 ? R(S[1]) < R(S[0]) ? S[0] : R(S[1]) > R(S[2]) ? S[2] : S[1] : null;
    }
    return null;
  }
  function h() {
    let b = m();
    for (; r[i] && (r[i].op === "*" || r[i].op === "/"); ) {
      const S = r[i++].op, E = m();
      if (!b || !E) return null;
      S === "*" ? b = u(E) ? f(b, E.num) : u(b) ? f(E, b.num) : null : b = u(E) && E.num !== 0 ? f(b, 1 / E.num) : null;
    }
    return b;
  }
  function v() {
    let b = h();
    for (; r[i] && (r[i].op === "+" || r[i].op === "-"); ) {
      const S = r[i++].op;
      b = c(b, h(), S === "-" ? -1 : 1);
    }
    return b;
  }
  const y = v();
  return i !== r.length || !y ? null : y;
}
function Zo(n, a) {
  const r = n.trim().toLowerCase();
  if (/^(auto|none|normal|fit-content|max-content|min-content|medium|thin|thick)$/.test(r))
    return r === "thin" ? { px: 1 } : r === "medium" ? { px: 3 } : r === "thick" ? { px: 5 } : r;
  const i = Jn(r, a);
  return i ? i.unitless ? i.num === 0 ? { px: 0 } : { expr: n.trim() } : i.pct && (i.px || i.num) ? { expr: n.trim() } : i.pct ? { pct: i.pct } : { px: ub(i.px) } : { expr: n.trim() };
}
const ub = (n) => Number.isFinite(n) ? n : n > 0 ? 34e37 : -34e37, Pr = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0"), db = ([n, a, r, i]) => `#${Pr(n)}${Pr(a)}${Pr(r)}${Pr(i * 255)}`;
function Vf(n) {
  const a = n.slice(1), r = a.length <= 4 ? a.split("").map((s) => s + s).join("") : a;
  if (!/^[0-9a-f]{6}([0-9a-f]{2})?$/i.test(r)) return null;
  const i = (s) => parseInt(r.slice(s, s + 2), 16);
  return [i(0), i(2), i(4), r.length === 8 ? i(6) / 255 : 1];
}
function vi(n, a) {
  const r = n.trim().toLowerCase();
  if (r === "currentcolor") return "currentcolor";
  const i = /^perchtoken\(([a-z0-9-]+)\)$/.exec(r);
  if (i) {
    const h = a(i[1]), v = h && Vf(h);
    return v ? { rgba: v, token: i[1] } : null;
  }
  if (r.startsWith("#")) {
    const h = Vf(r);
    return h ? { rgba: h, token: null } : null;
  }
  if (Qf[r]) return { rgba: [...Qf[r]], token: null };
  const s = /^(rgba?|color-mix)\((.*)\)$/s.exec(r);
  if (!s) return null;
  if (s[1] === "color-mix") {
    const h = ct(s[2], ",");
    if (h.length !== 3 || !/^in\s+(srgb|srgb-linear|oklab|lab|oklch|lch|hsl|xyz)/.test(h[0])) return null;
    const v = (j) => {
      const V = ct(j), $ = V.findIndex((I) => /%$/.test(I)), U = $ >= 0 ? parseFloat(V[$]) / 100 : null;
      return { color: vi(V.filter((I, Q) => Q !== $).join(" "), a), pct: U };
    }, y = v(h[1]), b = v(h[2]);
    if (!y.color || !b.color || y.color === "currentcolor" || b.color === "currentcolor") return null;
    let S = y.pct, E = b.pct;
    S === null && E === null ? (S = 0.5, E = 0.5) : S === null ? S = 1 - E : E === null && (E = 1 - S);
    const R = S + E, N = R < 1 ? R : 1;
    S /= R, E /= R;
    const [M, O, H, X] = y.color.rgba, [W, D, g, w] = b.color.rgba, x = X * S + w * E, _ = (j, V) => x === 0 ? 0 : (j * X * S + V * w * E) / x, T = [_(M, W), _(O, D), _(H, g), x * N], z = w === 0 ? y.color.token : X === 0 ? b.color.token : null;
    return { rgba: T, token: z };
  }
  const c = s[2].includes(",") ? ct(s[2], ",") : ct(s[2].replace("/", " / ")).filter((h) => h !== "/");
  if (c.length < 3) return null;
  const f = (h) => h.endsWith("%") ? parseFloat(h) / 100 * 255 : parseFloat(h), u = c[3] === void 0 ? 1 : c[3].endsWith("%") ? parseFloat(c[3]) / 100 : parseFloat(c[3]), m = [f(c[0]), f(c[1]), f(c[2]), u];
  return m.some((h) => Number.isNaN(h)) ? null : { rgba: m, token: null };
}
const Ll = ["top", "right", "bottom", "left"], fb = ["top-left", "top-right", "bottom-right", "bottom-left"], ei = (n) => [n[0], n[1] ?? n[0], n[2] ?? n[0], n[3] ?? n[1] ?? n[0]], Kf = /* @__PURE__ */ new Set(["none", "hidden", "solid", "dashed", "dotted", "double", "groove", "ridge", "inset", "outset"]);
function Xo(n, a) {
  const r = a.trim(), i = () => ct(r);
  switch (n) {
    case "padding":
    case "margin": {
      const s = ei(i());
      return Ll.map((c, f) => [`${n}-${c}`, s[f]]);
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
      const s = ei(i());
      return Ll.map((c, f) => [c, s[f]]);
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
      const s = n.split("-")[1], c = ei(i());
      return Ll.map((f, u) => [`border-${f}-${s}`, c[u]]);
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
      const s = n === "border" ? Ll : n === "border-inline" ? ["left", "right"] : n === "border-block" ? ["top", "bottom"] : n === "border-inline-start" ? ["left"] : n === "border-inline-end" ? ["right"] : [n.slice(7)];
      let c = "medium", f = "none", u = "currentcolor";
      if (r !== "none" && r !== "0")
        for (const m of i())
          Kf.has(m) ? f = m : /^(thin|medium|thick|-?[\d.]|calc\()/.test(m) ? c = m : u = m;
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
      const s = ei(ct(r.split("/")[0]));
      return fb.map((c, f) => [`border-${c}-radius`, s[f]]);
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
      return r === "none" ? [["background-color", "transparent"], ["background-image", "none"]] : vi(r, () => "#000000") ? [["background-color", r], ["background-image", "none"]] : [["background-color", "transparent"], ["background-image", r]];
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
        Kf.has(u) || u === "auto" ? c = u : /^(thin|medium|thick|-?[\d.]|calc\()/.test(u) ? s = u : f = u;
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
function pb(n, a) {
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
        const [, y, b] = h, S = (E) => {
          const R = Zo(E, { viewport: a });
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
      const v = /^(width|height)\s*(>=|<=|>|<|=)\s*(.+)$/.exec(m);
      if (v) {
        const y = v[1] === "width" ? a.width : a.height, b = Zo(v[3], { viewport: a }), S = typeof b == "object" && "px" in b ? b.px : NaN;
        switch (v[2]) {
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
function mb(n, a) {
  const r = a[a.length - 1].compound;
  return pc(r)[0] ?? n;
}
function hb(n) {
  const a = (r) => r.some((i) => Di.has(i.name) || (i.list ?? []).some((s) => s.some(({ compound: c }) => a(c.pseudos))));
  return a(n[n.length - 1].compound.pseudos);
}
function gb(n) {
  const a = /* @__PURE__ */ new Set(), r = /* @__PURE__ */ new Set(), i = (s, c) => {
    s.forEach(({ compound: f }, u) => {
      const m = c && u === s.length - 1;
      for (const h of f.pseudos)
        if (Di.has(h.name) && (m ? a : r).add(h.name), h.list && h.name !== "not") for (const v of h.list) i(v, m);
    });
  };
  return i(n, !0), { subject: a, ancestor: r };
}
function pc(n) {
  const a = [...n.classes];
  for (const r of n.pseudos)
    if (!(r.name !== "is" && r.name !== "where"))
      for (const i of r.list) i.length === 1 && a.push(...pc(i[0].compound));
  return a;
}
function bb(n, a) {
  const r = (i, s) => {
    i.forEach(({ compound: c }, f) => {
      const u = s && f === i.length - 1, m = c.pseudos.filter((h) => Di.has(h.name)).map((h) => h.name);
      if (!u) for (const h of m) for (const v of pc(c)) a.add(`${h}:${v}`);
      for (const h of c.pseudos) if (h.list && h.name !== "not") for (const v of h.list) r(v, u);
    });
  };
  r(n, !0);
}
class vb {
  constructor(a) {
    this.properties = a.properties ?? {}, this.rules = [], this.skipped = 0, this.index = /* @__PURE__ */ new Map(), this.trackedStates = /* @__PURE__ */ new Set(), this.dependsCache = /* @__PURE__ */ new Map(), this.candidateCache = /* @__PURE__ */ new Map();
    const r = (c, f) => {
      const u = f[f.length - 1].compound, m = u.classes.length ? `.${u.classes[0]}` : u.tag && u.tag !== "*" ? u.tag : "*";
      this.index.has(m) || this.index.set(m, []), this.index.get(m).push(c);
    };
    let i = 0;
    const s = (c, f) => {
      for (const [u, m, h, v] of c)
        for (const y of cc(u)) {
          let b;
          try {
            b = uc(y);
          } catch (N) {
            if (N instanceof ot) {
              this.skipped++;
              continue;
            }
            throw N;
          }
          const S = gb(b);
          bb(b, this.trackedStates);
          const E = b[b.length - 1].compound.pseudoElement, R = { steps: b, media: m, layer: h, origin: f, order: i++, specificity: Op(b), decls: v, states: S, pseudo: E, own: kb(b), assumed: hb(b), above: xb(b), source: f === 0 ? `ua:${b[b.length - 1].compound.tag ?? "*"}` : mb(y, b) };
          this.rules.push(R), r(R, b);
        }
    };
    s(ib.map(([c, f]) => [c, null, 0, Object.entries(f)]), 0), s(a.rules, 1);
  }
  /** Rules that may match `element` (by its classes, its tag, and the universal ones), or its `pseudo` box
   * (`before`, `after`). */
  candidates(a, r = null) {
    const i = `${a.tagName} ${a.className}|${r ?? ""}`, s = this.candidateCache.get(i);
    if (s) return s;
    const c = [], f = /* @__PURE__ */ new Set(), u = new Set(a.classList), m = (h) => {
      if (h) for (const v of h) !f.has(v) && v.pseudo === r && (f.add(v), Jp(v.steps[v.steps.length - 1].compound, a.tagName, u) && c.push(v));
    };
    for (const h of a.classList) m(this.index.get(`.${h}`));
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
      for (const u of f ?? []) {
        if (s.has(u)) continue;
        s.add(u);
        const m = u.reads ??= Wp(u.steps);
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
function Jp(n, a, r) {
  if (n.tag && n.tag !== "*" && n.tag !== a) return !1;
  for (const i of n.classes) if (!r.has(i)) return !1;
  for (const i of n.pseudos) {
    if (i.name === "has") return !0;
    if (i.name === "root" && a !== "html" || (i.name === "where" || i.name === "is") && i.list.every((s) => s.length === 1 && !Jp(s[0].compound, a, r))) return !1;
  }
  return !0;
}
const yb = /* @__PURE__ */ new Set(["first-child", "last-child", "only-child", "nth-child"]);
function xb(n) {
  const a = [];
  for (let r = n.length - 1; r > 0 && !(n[r].combinator !== " " && n[r].combinator !== ">"); r--)
    a.push(...n[r - 1].compound.classes);
  return a;
}
function $p(n) {
  const a = n.parentElement;
  if (!a) return wb;
  const r = $p(a), i = n.aboveCache;
  if (i && i.parent === a && i.name === a.className && i.base === r) return i.set;
  const s = a.classSet, c = s.size === 0 ? r : /* @__PURE__ */ new Set([...r, ...s]);
  return n.aboveCache = { parent: a, name: a.className, base: r, set: c }, c;
}
const wb = /* @__PURE__ */ new Set();
function kb(n) {
  if (n.length !== 1) return !1;
  const { compound: a } = n[0];
  return !a.id && !a.attrs.length && a.pseudos.every((r) => Di.has(r.name) && r.name !== "focus-within");
}
function Wp(n, a = !0, r = { anc: !1, pos: !1, nth: !1, ancPos: !1 }) {
  return n.forEach((i, s) => {
    const c = a && s === n.length - 1;
    c || (r.anc = !0);
    for (const f of i.compound.pseudos)
      if (yb.has(f.name) && (c ? r.pos = !0 : r.ancPos = !0, f.name === "nth-child" && c && (r.nth = !0)), f.list && f.name !== "has") for (const u of f.list) Wp(u, c, r);
  }), r;
}
const _b = /* @__PURE__ */ new Set(["opacity", "z-index", "flex-grow", "flex-shrink", "font-weight", "line-height", "flex", "order", "-webkit-line-clamp", "zoom"]);
function Sb(n) {
  if (!n || typeof n != "object") return [];
  const a = [];
  for (const [r, i] of Object.entries(n)) {
    if (i == null || i === "" || typeof i == "boolean") continue;
    const s = r.startsWith("--") ? r : r.replace(/[A-Z]/g, (f) => `-${f.toLowerCase()}`).replace(/^(webkit|moz|ms)-/, "-$1-"), c = typeof i == "number" && i !== 0 && !_b.has(s) && !s.startsWith("--") ? `${i}px` : String(i);
    a.push([s, c]);
  }
  return a;
}
function Eb(n) {
  if (n.tagName !== "svg") return [];
  const a = [];
  for (const r of ["width", "height"]) {
    const i = n.getAttribute(r);
    i !== null && a.push([r, /^[\d.]+$/.test(i) ? `${i}px` : i]);
  }
  return a;
}
const zb = (n, a) => n.important - a.important || n.origin - a.origin || n.layer - a.layer || n.specificity[0] - a.specificity[0] || n.specificity[1] - a.specificity[1] || n.specificity[2] - a.specificity[2] || n.order - a.order;
class Nb {
  constructor(a, { theme: r, viewport: i }) {
    this.sheet = a, this.theme = r, this.viewport = i, this.parsed = /* @__PURE__ */ new Map(), this.computed = /* @__PURE__ */ new WeakMap(), this.rootComputed = /* @__PURE__ */ new Map(), this.media = /* @__PURE__ */ new Map(), this.ownMatches = /* @__PURE__ */ new Map();
  }
  mediaHolds(a) {
    if (!a.media) return !0;
    for (const r of a.media) {
      let i = this.media.get(r);
      if (i === void 0 && this.media.set(r, i = pb(r, this.viewport)), !i) return !1;
    }
    return !0;
  }
  themeHex(a) {
    return this.theme?.[a] ?? null;
  }
  /** Rules matching `element`; `assume` is the set of interaction states assumed on the element itself
   * (`"*"`: any, for finding variant rules). Ancestors use their real state. */
  matching(a, r, i = null, s = null) {
    const f = { state: (E, R, N) => {
      if (R === "disabled") return !!E.props?.disabled && ["button", "input", "select", "textarea", "fieldset"].includes(E.tagName);
      if (R === "enabled") return !E.props?.disabled && ["button", "input", "select", "textarea"].includes(E.tagName);
      if (R === "checked") return !!E.props?.checked;
      if (r === "*") return !0;
      if (R === "focus-within") {
        const M = E.ownerDocument?.activeElement;
        return !!M && M !== E.ownerDocument.body && typeof E.contains == "function" && E.contains(M);
      }
      return N ? r.has(R) : R === "focus-visible" ? !!E.state?.focus && !E.state?.pointerFocus : !!E.state?.[R];
    }, pseudo: i }, u = this.sheet.candidates(a, i), m = `${a.tagName} ${a.className}|${i ?? ""}|${r === "*" ? "*" : [...r].sort().join(",")}`;
    let h = this.ownMatches.get(m);
    h || (h = new Set(u.filter((E) => E.own && this.mediaHolds(E) && Uo(a, E.steps, f))), this.ownMatches.set(m, h));
    let v = null;
    const y = (E) => E.above.length ? (v ??= $p(a), E.above.every((R) => v.has(R))) : !0, b = s && r !== "*" ? s[i ?? ""] ??= /* @__PURE__ */ new Map() : null, S = (E) => this.mediaHolds(E) && y(E) && Uo(a, E.steps, f);
    return u.filter((E) => {
      if (E.own) return h.has(E);
      if (!b || E.assumed) return S(E);
      let R = b.get(E);
      return R === void 0 && b.set(E, R = S(E)), R;
    });
  }
  /** `element`'s computed style, or with `pseudo` (`before`, `after`) that of its pseudo-element's box, whose parent
   * is the element (pass the element's own computed style as `parent`). */
  compute(a, r, i = /* @__PURE__ */ new Set(), s = null, c = null) {
    const f = this.matching(a, i, s, c), u = s ? [] : Eb(a), m = s ? [] : Sb(a.inlineStyle ?? a.props?.style);
    let h = this.rootComputed;
    r && (h = this.computed.get(r.values), h || this.computed.set(r.values, h = /* @__PURE__ */ new Map()));
    const v = `${f.map((b) => b.order).join(",")}|${u.length ? JSON.stringify(u) : ""}|${m.length ? JSON.stringify(m) : ""}`;
    let y = h.get(v);
    return y || h.set(v, y = this.cascade(f, u, m, r)), { ...y, rules: f, element: a, shared: y };
  }
  /** The computed style from the matched `rules`, presentational `attrs`, `inline` declarations and the parent's. */
  cascade(a, r, i, s) {
    const c = [];
    for (const g of a)
      for (const [w, x, _] of g.decls) c.push({ prop: w, value: x, important: _ ? 1 : 0, origin: g.origin === 0 ? 0 : 2, layer: g.layer, specificity: g.specificity, order: g.order, source: g.source });
    for (const [g, w] of r) c.push({ prop: g, value: w, important: 0, origin: 1, layer: 0, specificity: [0, 0, 0], order: 0, source: `attr:${g}` });
    for (const [g, w] of i) c.push({ prop: g, value: w, important: 0, origin: 3, layer: 0, specificity: [1, 0, 0], order: 0, source: "style" });
    c.sort(zb);
    const f = this.sheet.properties, u = Object.create(s?.customs ?? null), m = /* @__PURE__ */ new Map(), h = /* @__PURE__ */ new Map();
    for (const g of c) g.prop.startsWith("--") && h.set(g.prop, g.value);
    if (!s && this.theme) for (const g of Kp) this.theme[g] && h.set(`--${g}`, `perchtoken(${g})`);
    const v = (g) => {
      if (m.has(g)) return m.get(g);
      const w = f[g];
      return w && !w.inherits ? w.initial ?? null : g in u ? u[g] : w?.initial ?? null;
    }, y = /* @__PURE__ */ new Set(), b = (g) => {
      if (!h.has(g)) return v(g);
      if (y.has(g)) return null;
      y.add(g);
      const w = Ko(h.get(g), b);
      return y.delete(g), h.delete(g), m.set(g, w), (!f[g] || f[g].inherits) && (u[g] = w), w;
    };
    for (const g of [...h.keys()]) b(g);
    const S = /* @__PURE__ */ new Map();
    for (const g of c) {
      if (g.prop.startsWith("--")) continue;
      const w = Ko(g.value, v);
      if (w === null) {
        for (const [x] of Xo(g.prop, "unset")) S.set(x, { value: "unset", source: g.source, origin: g.origin });
        continue;
      }
      for (const [x, _] of Xo(g.prop, w)) S.set(x, { value: _, source: g.source, origin: g.origin });
    }
    const E = {}, R = {}, N = /* @__PURE__ */ new Set(), M = /* @__PURE__ */ new Set(), O = s?.values, H = { fontSize: O?.["font-size"] ?? Qo, viewport: this.viewport }, X = (g, w) => {
      if (/currentcolor/i.test(w)) return this.parseValue(g, w, H, E, O);
      const x = `${g}\0${w}\0${H.fontSize}`;
      let _ = this.parsed.get(x);
      return _ === void 0 && this.parsed.set(x, _ = this.parseValue(g, w, H, E, O)), _;
    }, W = S.size ? [...Vo, ...[...S.keys()].filter((g) => !ob.has(g))] : Vo;
    for (const g of W) {
      const w = S.get(g);
      let x = w?.value;
      const _ = sb.has(g);
      if ((x === void 0 || x === "unset" || x === "revert" || x === "revert-layer") && (x = _ ? "inherit" : "initial"), w && (R[g] = w.source, w.origin !== 0 && N.add(g)), x === "inherit" && O && g in O) {
        E[g] = O[g], M.add(g);
        continue;
      }
      (x === "inherit" || x === "initial") && (x = _ ? Xp[g] : Zp[g]), E[g] = X(g, x), g === "font-size" && (H.fontSize = E["font-size"]);
    }
    for (const g of Ll) {
      const w = E[`border-${g}-style`];
      (w === "none" || w === "hidden") && (E[`border-${g}-width`] = { px: 0 });
    }
    E["outline-style"] === "none" && (E["outline-width"] = { px: 0 });
    const D = O?.display;
    return (D === "flex" || D === "inline-flex" || D === "grid" || D === "inline-grid") && E.position !== "absolute" && E.position !== "fixed" && (E.display = Zf(E.display)), (E.position === "absolute" || E.position === "fixed") && (E.display = Zf(E.display)), { values: E, sources: R, own: N, inherited: M, customs: u };
  }
  parseValue(a, r, i, s, c) {
    const f = String(r).trim();
    switch (a) {
      case "font-size": {
        const u = f.toLowerCase(), m = { "xx-small": 9, "x-small": 10, small: 13, medium: 16, large: 18, "x-large": 24, "xx-large": 32 };
        if (m[u]) return m[u];
        if (u === "smaller") return i.fontSize / 1.2;
        if (u === "larger") return i.fontSize * 1.2;
        const h = Jn(u, { fontSize: i.fontSize, viewport: i.viewport });
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
        const m = Jn(u, { fontSize: i.fontSize, viewport: i.viewport });
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
        const u = vi(f, (m) => this.themeHex(m));
        return u === "currentcolor" || !u ? c?.color ?? { rgba: [0, 0, 0, 1], token: null } : u;
      }
      case "background-color":
      case "border-top-color":
      case "border-right-color":
      case "border-bottom-color":
      case "border-left-color":
      case "outline-color": {
        const u = vi(f, (m) => this.themeHex(m));
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
        return Zo(f, i);
      default:
        return f.toLowerCase().startsWith("var(") ? f : /^[a-z-]+$/i.test(f) ? f.toLowerCase() : f;
    }
  }
}
function Zf(n) {
  return n === "inline" || n === "inline-block" || n === "contents" ? "block" : n === "inline-flex" ? "flex" : n === "inline-grid" ? "grid" : n;
}
const yi = (n) => n && n.rgba ? { value: db(n.rgba), token: n.token ?? null } : null, Tb = { 9.28: 11, 9.92: 12, 10.4: 12, 10.88: 13, 11: 13, 11.2: 13, 11.52: 13, 12: 15, 12.5: 15, 13: 16, 14: 17, 16: 19 };
function Cb(n, a) {
  const r = a?.(n);
  if (Number.isFinite(r)) return r;
  const i = Math.round(n * 100) / 100;
  return Tb[i] ?? Math.round(n * 1.2);
}
function Ql(n, a) {
  const r = n["line-height"], i = n["font-size"];
  return r.normal ? Cb(i, a) : r.factor !== void 0 ? r.factor * i : r.px;
}
const Ab = (n) => ct(n, ",").map((a) => a.trim().replace(/^["']|["']$/g, "")).join(", ");
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
const Mb = "perch-native-description/1", Zt = Symbol("display"), xi = {
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
}, Rb = ["w", "h", "min_w", "min_h", "max_w", "max_h", "top", "right", "bottom", "left", "pt", "pr", "pb", "pl", "mt", "mr", "mb", "ml", "gap_x", "gap_y", "border_t", "border_r", "border_b", "border_l", "rounded_tl", "rounded_tr", "rounded_br", "rounded_bl"];
for (const n of Rb) xi[n] = /^(w|h|min_|max_|top|right|bottom|left)/.test(n) ? "auto" : 0;
xi.rounded = 0;
const jb = /* @__PURE__ */ new Set([
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
]), Ob = /(-apple-system|blinkmacsystemfont|system-ui|segoe ui|sans-serif|times)/i, Db = /(ui-monospace|sfmono|sf mono|menlo|monospace)/i, Bb = /^\s*["']?(ui-monospace|sfmono-regular|sf mono)["']?\s*(,|$)/i, Hb = (n) => Bb.test(n ?? "") ? ".AppleSystemUIFontMonospaced" : Db.test(n) ? "Menlo" : /^\s*system-ui\s*$/i.test(n ?? "") ? ".AppleSystemUIFont" : Ob.test(n) ? ".SystemUIFont" : Ab(n).split(",")[0].trim(), Ub = {
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
}, Xf = { pointerdown: "mouse_down", mousedown: "mouse_down", click: "click", keydown: "key_down", pointerup: "mouse_up", mouseup: "mouse_up" }, mc = (n) => {
  const a = n.props["data-testid"];
  if (a) return `${n.tagName}[data-testid="${a}"]`;
  if (n.props.id) return `${n.tagName}#${n.props.id}`;
  const r = n.classList.find((s) => !s.includes(":") && !s.includes("[")) ?? n.classList[0];
  if (r) return `${n.tagName}.${r}`;
  const i = n.parentElement;
  return i && i.tagName !== "body" ? `${mc(i)} > ${n.tagName}` : n.tagName;
};
class qb {
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
const wn = (n) => {
  if (n != null) {
    if (typeof n == "string") return n === "auto" || n === "none" || n === "normal" ? "auto" : void 0;
    if ("px" in n) return Math.round(Math.min(Math.max(n.px, -9999), 9999) * 100) / 100;
    if ("pct" in n) return `${Math.round(n.pct * 1e3) / 1e3}%`;
  }
}, Lb = /^(text|search|url|email|tel|password|number)$/, Gb = 162.13 / 12.8;
function Yb(n, a) {
  const r = typeof n == "object" && /^min\((.*)\)$/.exec(String(n?.expr ?? "").trim());
  if (!r) return;
  const i = ct(r[1], ",").map((s) => Jn(s.trim(), { fontSize: a })).filter((s) => s && !s.pct && !s.num).map((s) => s.px);
  return i.length ? Math.min(...i) : void 0;
}
function Qb(n, a) {
  if (typeof n != "object" || !n?.expr) return !1;
  const r = Jn(n.expr, { fontSize: a["font-size"] }), i = (a["margin-left"]?.px ?? NaN) + (a["margin-right"]?.px ?? NaN);
  return !!r && !r.num && r.pct === 100 && Math.abs(r.px + i) < 0.01;
}
function Fp(n) {
  const a = n.transform;
  if (a && a !== "none") {
    const i = /^\s*translate(X|Y)?\(([^]*)\)\s*$/.exec(a), s = i && ct(i[2], ",").map((c) => c.trim());
    return !s || s.length > (i[1] ? 1 : 2) ? null : i[1] === "X" ? [s[0], "0"] : i[1] === "Y" ? ["0", s[0]] : [s[0], s[1] ?? "0"];
  }
  const r = n.translate;
  if (r && r !== "none") {
    const i = ct(String(r).trim(), " ").filter(Boolean);
    return i.length > 3 || i[2] !== void 0 && Jn(i[2], {})?.px ? null : [i[0], i[1] ?? "0"];
  }
  return [];
}
function Jf(n, a, r, i = !1) {
  const s = n.values, c = Fp(s);
  if (c?.length === 0) return;
  const f = s.transform && s.transform !== "none" ? "transform" : "translate", u = { fontSize: s["font-size"] }, m = (y, b) => {
    const S = Jn(y, u);
    if (!(!S || S.unitless && S.num))
      return S.pct ? typeof b == "number" ? S.px + S.pct / 100 * b : void 0 : S.px;
  }, h = c ? m(c[0], a.w) : void 0, v = c ? m(c[1], a.h) : void 0;
  if (h === void 0 || v === void 0) {
    const y = !i && c ? c.map((b) => Jn(b, u)) : null;
    if (y?.every((b) => b && !(b.unitless && b.num))) {
      a[Ip] = y.map((b) => [b.px, b.pct ?? 0]);
      return;
    }
    r("unsupported", f, s[f], n.sources[f]);
    return;
  }
  if (i) {
    h && (a.left = h), v && (a.top = v);
    return;
  }
  h && (a.ml = (a.ml ?? 0) + h), v && (a.mt = (a.mt ?? 0) + v);
}
const Ip = Symbol("perch.shift");
function Vb(n, a, r) {
  const i = n.ownerDocument, s = i?.measure?.(n) ?? null;
  if (s) {
    const [[f, u], [m, h]] = r, v = f + u / 100 * s.width, y = m + h / 100 * s.height;
    v && (a.ml = (typeof a.ml == "number" ? a.ml : 0) + v), y && (a.mt = (typeof a.mt == "number" ? a.mt : 0) + y);
  }
  const c = s ? `${s.width}x${s.height}` : "";
  c === n.shiftSeen ? n.shiftTries = 0 : (n.shiftTries ?? 0) < qp && i?.retries && (n.shiftSeen = c, n.shiftTries = (n.shiftTries ?? 0) + 1, i.retries.push(() => i.afterCommit?.()));
}
function wi(n, a, r = null) {
  const i = n.values, s = {}, c = (H) => n.sources[H], f = (H) => n.sources[H] !== void 0, u = i.display;
  u === "none" ? s.display = "hidden" : u === "flex" || u === "inline-flex" ? s.display = "flex" : (u === "grid" || u === "inline-grid") && (s.display = "flex", s.flex_direction = "col", a("approximated", "display", u, c("display"), "one-column flex column"), i["grid-template-columns"] && i["grid-template-columns"] !== "none" && a("unsupported", "grid-template-columns", i["grid-template-columns"], c("grid-template-columns"))), n.element.hidden && (s.display = "hidden");
  const m = s.display === "flex";
  if (m && s.flex_direction !== "col") {
    const H = { row: "row", column: "col", "row-reverse": "row_reverse", "column-reverse": "col_reverse" }[i["flex-direction"]] ?? "row";
    s.flex_direction = H;
  }
  if (m) {
    (i["flex-wrap"] === "wrap" || i["flex-wrap"] === "wrap-reverse") && (s.flex_wrap = "wrap");
    const H = u === "grid" || u === "inline-grid", X = { "flex-start": "start", start: "start", "self-start": "start", "flex-end": "end", end: "end", "self-end": "end", center: "center", baseline: "baseline", "first baseline": "baseline" }[i["align-items"]];
    X && (s.items = X);
    let W = { "flex-start": "start", start: "start", "flex-end": "end", end: "end", center: "center", "space-between": "between", "space-around": "around", "space-evenly": "evenly" }[i["justify-content"]];
    if (H) {
      const w = { center: "center", end: "end", "flex-end": "end", start: "start", "flex-start": "start" }[i["justify-items"]];
      w && (s.items = w), i["align-items"] === "center" && (W = "center");
    }
    W && (s.justify = W);
    const D = wn(i["row-gap"]), g = wn(i["column-gap"]);
    typeof D == "number" && D && (s.gap_y = D), typeof g == "number" && g && !H && (s.gap_x = g);
  }
  i["flex-grow"] && (s.flex_grow = i["flex-grow"]), i["flex-shrink"] !== 1 && (s.flex_shrink = i["flex-shrink"]);
  const h = wn(i["flex-basis"]);
  h !== void 0 && h !== "auto" && (s.flex_basis = h);
  const v = { "flex-start": "start", start: "start", "flex-end": "end", end: "end", center: "center", baseline: "baseline", stretch: "stretch" }[i["align-self"]];
  v && (s.self = v);
  for (const [H, X] of [["w", "width"], ["h", "height"], ["min_w", "min-width"], ["min_h", "min-height"], ["max_w", "max-width"], ["max_h", "max-height"]]) {
    const W = i[X], D = wn(W);
    if (D === void 0 && X === "width" && Qb(W, i)) {
      s.self = "stretch", a("approximated", X, W.expr, c(X), "stretched across its parent, inside its margins");
      continue;
    }
    const g = D === void 0 && /^max-/.test(X) ? Yb(W, i["font-size"]) : void 0;
    if (g !== void 0) {
      s[H] = g, a("approximated", X, W.expr, c(X), "the fixed bound of min()");
      continue;
    }
    if (D === void 0) {
      typeof W == "object" && W.expr ? a("unsupported", X, W.expr, c(X), "no calc() in the engine") : typeof W == "string" && !["auto", "none"].includes(W) && a("unsupported", X, W, c(X));
      continue;
    }
    D !== "auto" && (s[H] = D);
  }
  const y = ["top", "right", "bottom", "left"];
  for (const H of y) {
    const X = H[0];
    for (const [W, D] of [["p", "padding"], ["m", "margin"]]) {
      const g = i[`${D}-${H}`], w = wn(g);
      if (w === void 0) {
        g?.expr && a("unsupported", `${D}-${H}`, g.expr, c(`${D}-${H}`), "no calc() in the engine");
        continue;
      }
      w !== 0 && (s[`${W}${X}`] = w);
    }
  }
  const b = i.position;
  if (b === "absolute" || b === "fixed") {
    s.position = "absolute", b === "fixed" && a("approximated", "position", "fixed", c("position"), "absolute in the overlay layer");
    for (const H of y) {
      const X = wn(i[H]);
      X !== void 0 && X !== "auto" && (s[H] = X);
    }
    if (b === "fixed" && r && s.w === void 0 && s.right === void 0 && typeof s.left == "number") {
      const H = r.width - s.left - (typeof s.ml == "number" ? s.ml : 0) - (typeof s.mr == "number" ? s.mr : 0);
      s.max_w = typeof s.max_w == "number" ? Math.min(s.max_w, H) : H;
    }
    Jf(n, s, a);
  } else b === "sticky" ? a("unsupported", "position", "sticky", c("position")) : Fp(i)?.length !== 0 && (s.position = "relative", Jf(n, s, a, !0));
  i["z-index"] !== "auto" && f("z-index") && a("unsupported", "z-index", i["z-index"], c("z-index"), "paint order is tree order");
  for (const [H, X] of [["overflow_x", "overflow-x"], ["overflow_y", "overflow-y"]]) {
    const W = i[X];
    W === "hidden" || W === "clip" ? s[H] = "hidden" : (W === "auto" || W === "scroll") && (s[H] = "scroll");
  }
  (i.visibility === "hidden" || i.visibility === "collapse") && (s.visibility = "invisible");
  const S = i["background-color"];
  S?.unreadable ? a("unsupported", "background-color", S.unreadable, c("background-color")) : S?.rgba && S.rgba[3] > 0 && (s.bg = yi(S)), i["background-image"] && i["background-image"] !== "none" && a("unsupported", "background-image", i["background-image"], c("background-image"));
  const E = y.map((H) => wn(i[`border-${H}-width`]) || 0), R = [];
  y.forEach((H, X) => {
    if (!E[X]) return;
    s[`border_${H[0]}`] = E[X];
    const W = i[`border-${H}-style`];
    W !== "solid" && a("approximated", `border-${H}-style`, W, c(`border-${H}-style`), "drawn solid");
    const D = yi(i[`border-${H}-color`]);
    D && R.push(D);
  }), R.length && (s.border_color = R[0], R.some((H) => H.value !== R[0].value) && a("approximated", "border-color", R.map((H) => H.value).join(" "), c("border-top-color"), "one border colour"));
  const N = (H) => {
    const X = wn(i[`border-${H}-radius`]) || 0;
    if (typeof X != "string") return X;
    const W = parseFloat(X) / 100, D = [s.w, s.h].filter((g) => typeof g == "number");
    return X === "auto" || !(W > 0) ? 0 : D.length ? Math.round(Math.min(W, 0.5) * Math.min(...D) * 100) / 100 : 9999;
  }, M = ["top-left", "top-right", "bottom-right", "bottom-left"].map(N);
  M.every((H) => H === M[0]) ? M[0] && (s.rounded = M[0]) : ["tl", "tr", "br", "bl"].forEach((H, X) => {
    M[X] && (s[`rounded_${H}`] = M[X]);
  }), i.opacity !== 1 && (s.opacity = Math.round(i.opacity * 1e3) / 1e3);
  const O = i["box-shadow"];
  if (O && O !== "none" && ct(O, ",").some((H) => !/^0(px)?\s+0(px)?\s+(0(px)?\s+)?(0(px)?\s+)?(#0000|transparent|rgba?\(0,\s*0,\s*0,\s*0\))/.test(H.trim())) && (s.shadow = "lg", a("approximated", "box-shadow", O, c("box-shadow"), "the engine's large shadow preset")), i.cursor && i.cursor !== "auto" && !n.inherited.has("cursor")) {
    const H = { pointer: "pointer", default: "default", text: "text", move: "move", "not-allowed": "not_allowed", grab: "move", grabbing: "move" }[i.cursor];
    H ? s.cursor = H : a("unsupported", "cursor", i.cursor, c("cursor"));
  }
  return i["text-overflow"] === "ellipsis" && (s.text_ellipsis = !0), i["text-decoration-line"] === "underline" ? s.underline = !0 : i["text-decoration-line"] && i["text-decoration-line"] !== "none" && a("unsupported", "text-decoration-line", i["text-decoration-line"], c("text-decoration-line")), s;
}
const Kb = { "tabular-nums": "tnum", "proportional-nums": "pnum", "lining-nums": "lnum", "oldstyle-nums": "onum", "slashed-zero": "zero", "diagonal-fractions": "frac", "stacked-fractions": "afrc", ordinal: "ordn" };
function Pp(n) {
  if (!n || n === "normal") return "";
  const a = String(n).trim().split(/\s+/).map((r) => Kb[r]);
  return a.every(Boolean) ? a.join(",") : null;
}
function ki(n, a) {
  const r = n.values, i = r["line-height"];
  return {
    text_color: yi(r.color),
    text_size: Math.round(r["font-size"] * 1e3) / 1e3,
    font_features: Pp(r["font-variant-numeric"]) ?? "",
    font_weight: r["font-weight"],
    line_height: i.factor !== void 0 ? { factor: i.factor } : { px: Math.round(Ql(r, a) * 1e3) / 1e3 },
    font_family: Hb(r["font-family"]),
    italic: r["font-style"] === "italic" || r["font-style"] === "oblique",
    whitespace: r["white-space"] === "nowrap" || r["white-space"] === "pre" ? "nowrap" : "normal",
    text_align: { center: "center", right: "right", end: "right" }[r["text-align"]] ?? "left"
  };
}
const $f = (n, a) => n.factor !== void 0 ? n.factor * a : n.px, hc = (n, a) => JSON.stringify(n) === JSON.stringify(a);
function _i(n, a, r) {
  const i = {}, s = (u, m) => m.some((h) => !n.inherited.has(h));
  for (const [u, m] of [["text_color", ["color"]], ["text_size", ["font-size"]], ["font_weight", ["font-weight"]], ["font_family", ["font-family"]], ["italic", ["font-style"]], ["whitespace", ["white-space"]], ["text_align", ["text-align"]], ["font_features", ["font-variant-numeric"]]])
    (s(u, m) || !hc(a[u], r[u])) && (i[u] = a[u]);
  const c = $f(a.line_height, a.text_size), f = r.line_height ? $f(r.line_height, a.text_size) : NaN;
  return (s("line_height", ["line-height"]) || !(Math.abs(c - f) <= 1e-3)) && (i.line_height = a.line_height), i;
}
const Zb = (n, a) => ({ ...n, ...a });
function Si(n, a) {
  const r = {};
  for (const [i, s] of Object.entries(n))
    s && typeof s == "object" && "value" in s ? (r[i] = s.value, s.token && (a[i] = s.token)) : i === "line_height" ? r[i] = s.factor !== void 0 ? Math.round(s.factor * 1e3) / 1e3 : `${s.px}px` : i === "italic" ? s && (r.italic = !0) : r[i] = s;
  return r.italic === !1 && delete r.italic, r;
}
function em(n, a) {
  const r = {};
  for (const i of /* @__PURE__ */ new Set([...Object.keys(n), ...Object.keys(a)])) {
    const s = n[i], c = a[i];
    hc(s, c) || (r[i] = c === void 0 ? i in xi ? xi[i] : null : c);
  }
  return r;
}
function Wf(n, a) {
  const r = n.values;
  for (const [i, s] of Object.entries(n.sources)) {
    if (i.startsWith("--") || jb.has(i) || s.startsWith("ua:")) continue;
    const c = r[i];
    switch (i) {
      case "letter-spacing":
        c !== "normal" && c?.px !== 0 && a("approximated", i, c?.px !== void 0 ? `${Math.round(c.px * 1e3) / 1e3}px` : c, s, c?.px < 0 ? "the run's box is as wide as with the spacing (the glyphs reach past it; where the element clips, the run is drawn smaller to fit)" : "the run is as wide as with the spacing (room after it), the letters are not spread");
        break;
      case "font-variant-numeric":
        c !== "normal" && Pp(c) === null && a("unsupported", i, c, s);
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
        r["outline-style"] !== "none" && i === "outline-style" && a("unsupported", "outline", `${wn(r["outline-width"])}px ${r["outline-style"]} ${yi(r["outline-color"])?.value ?? ""}`.trim(), s, "no outline in the engine (no focus ring)");
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
function Xb(n, a, r, i) {
  const s = mc(n), c = {}, f = i.cascade.compute(n, a, /* @__PURE__ */ new Set(), null, c), u = i.cascade.matching(n, "*").filter((O) => O.states.subject.size), m = [];
  for (const [O, H] of Jb)
    u.some((X) => H.some((W) => X.states.subject.has(W))) && m.push([O, i.cascade.compute(n, a, new Set(H), null, c)]);
  const h = `${Mo(f.shared)}|${Mo(r)}|${+!!f.element.hidden}|${m.map(([O, H]) => `${O}${Mo(H.shared)}`).join(",")}`;
  let v = (i.cascade.styled ??= /* @__PURE__ */ new Map()).get(h);
  v || i.cascade.styled.set(h, v = Wb(f, m, r, i));
  const { style: y, tokens: b, shift: S, childText: E } = v, R = v.reports.map(([O, H, X, W, D]) => [O, H, X, W, s, D]), N = { ...v.extra };
  if (i.cascade.sheet.tracks(n, "hover") && (N.group = If(n), N.track_hover = !0), i.cascade.sheet.readsAncestor(n, "hover"))
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
      const W = {}, D = Si({ ...wi(X, () => {
      }), ..._i(X, ki(X, i.measure), r) }, W), g = em(y, D);
      if (!Object.keys(g).length) continue;
      const w = Object.fromEntries(Object.entries(W).filter(([x]) => x in g));
      (N.group_hover ??= []).push({ group: If(O), style: g, ...Object.keys(w).length ? { tokens: w } : {} });
    }
  if (/tabular/.test(String(f.values["font-variant-numeric"] ?? "")) && (N.tabular = !0), /^(anywhere|break-word)$/.test(String(f.values["overflow-wrap"] ?? "")) && (N.break_anywhere = !0), v.scrolls) {
    const O = Number.parseFloat(f.customs?.["--scrollbar-size"] ?? "");
    O > 0 && (N.scrollbar = O);
  }
  f.values["pointer-events"] !== "none" && a?.values["pointer-events"] === "none" && (N.blocks_pointer = !0), f.values["pointer-events"] === "none" && (N.pointer_none = !0);
  const M = Object.entries(Ub).filter(([, O]) => O.some((H) => typeof n.props[H] == "function")).map(([O]) => O);
  return !M.includes("click") && Yo(n) && M.push("click"), M.length && (N.events = M), { computed: f, style: y, tokens: b, extra: N, meta: l1(n), reports: R, childText: E, where: s, shift: S };
}
const Jb = [["hover", ["hover"]], ["focus", ["focus", "focus-visible"]], ["active", ["active", "hover"]]], Ff = /* @__PURE__ */ new WeakMap();
let $b = 0;
function Mo(n) {
  let a = Ff.get(n);
  return a === void 0 && Ff.set(n, a = ++$b), a;
}
function Wb(n, a, r, i) {
  const s = [], c = (b, S, E, R, N) => s.push([b, S, E, R ?? "(user agent)", N]), f = {}, u = wi(n, c, i.viewport);
  Wf(n, c);
  const m = ki(n, i.measure), h = _i(n, m, r), v = Si({ ...u, ...h }, f), y = {};
  for (const [b, S] of a) {
    const E = {}, R = Si({ ...wi(S, () => {
    }), ..._i(S, ki(S, i.measure), r) }, E);
    b === "focus" && Wf(S, c);
    const N = em(v, R);
    if (Object.keys(N).length) {
      y[b] = N;
      const M = Object.fromEntries(Object.entries(E).filter(([O]) => O in N));
      Object.keys(M).length && (y[`${b}_tokens`] = M);
    }
  }
  return { style: v, tokens: f, shift: u[Ip], childText: Zb(r, h), extra: y, scrolls: u.overflow_y === "scroll", reports: s };
}
function Fb(n, a, r, i) {
  const s = { before: null, after: null };
  for (const c of ["before", "after"]) {
    if (!i.cascade.matching(n, /* @__PURE__ */ new Set(), c).length) continue;
    const f = i.cascade.compute(n, a, /* @__PURE__ */ new Set(), c), u = String(f.values.content ?? "none").trim();
    if (u === "none" || u === "normal") continue;
    const m = /^(["'])(.*)\1$/.exec(u)?.[2] ?? "", h = (E, R, N, M, O) => i.add(E, R, N, M ?? "(user agent)", `${mc(n)}::${c}`, O), v = {}, y = wi(f, h, i.viewport), S = { kind: "div", style: Si({ ...y, ..._i(f, ki(f, i.measure), r) }, v), tokens: v, children: m ? [{ kind: "text", text: m }] : [] };
    Object.defineProperty(S, Zt, { value: f.values.display }), s[c] = S;
  }
  return s;
}
const If = (n) => `~g${n.id}`, Ib = ["pt", "pr", "pb", "pl", "mt", "mr", "mb", "ml", "border_t", "border_r", "border_b", "border_l", "bg"];
function Pb(n) {
  return n.kind === "div" && n[Zt] === "inline" && !n.events?.length && !n.meta?.attrs?.["data-testid"] && !Ib.some((a) => n.style?.[a]) && n.children?.every((a) => a.kind === "text");
}
function ti(n, a) {
  const r = n[a], i = { ...r, style: { ...r.style } };
  return Object.defineProperty(i, Zt, { value: r[Zt] }), n[a] = i, i;
}
function e1(n) {
  const a = [];
  for (let r = n.parentElement; r?.parentElement; r = r.parentElement) {
    const i = r.parentElement.children;
    a.push(`${+(i[0] === r)}${+(i[i.length - 1] === r)}`);
  }
  return a.join("");
}
function tm(n, a, r, i, s = 0, c = !0, f = !0, u = 0) {
  const m = i.cascade.sheet.depends(n), h = m.pos ? `${+c}${+f}${m.nth ? `:${u}` : ""}` : "", v = m.ancPos ? e1(n) : "";
  let y = i.cache.get(n);
  const b = y && y.version === n.version && y.parentValues === a?.values && y.inheritedText === r && y.pos === h && y.ancPos === v && (!m.anc || s <= y.at);
  if (b && y.node && y.stamp === n.stamp && !y.volatile && (!y.subAnc || s <= y.subAt)) {
    for (const N of y.log) i.add(...N);
    return y.node;
  }
  if (!b) {
    const N = Xb(n, a, r, i);
    y && hc(y.part.childText, N.childText) && (N.childText = y.part.childText), y = { version: n.version, parentValues: a?.values, inheritedText: r, pos: h, ancPos: v, at: i.now, part: N }, i.cache.set(n, y);
  }
  const S = i.log.length, E = { volatile: !!y.part.shift || m.ancPos, subAnc: m.anc }, R = t1(n, y, i, Math.max(s, n.attrStamp), E);
  return Object.assign(y, { node: R, stamp: n.stamp, subAt: i.now, log: i.log.slice(S), volatile: E.volatile, subAnc: E.subAnc }), R;
}
function t1(n, a, r, i, s) {
  const { computed: c, tokens: f, extra: u, reports: m, childText: h, where: v } = a.part;
  for (const x of m) r.add(...x);
  const y = (x, _, T, z, j) => r.add(x, _, T, z, v, j), b = { ...a.part.style };
  a.part.shift && Vb(n, b, a.part.shift);
  const S = { kind: "div", id: n.id, style: b, tokens: f, meta: a.part.meta, ...u };
  Object.defineProperty(S, Zt, { value: c.values.display }), n.measured && n.ownerDocument?.measureKey && (S.measure = n.ownerDocument.measureKey(n));
  const E = n.tagName;
  if (n.props["data-perch-engine"] != null)
    return S.kind = "engine", S.engine = String(n.props["data-perch-engine"]), S.key = String(n.props["data-perch-key"] ?? ""), S;
  if (E === "svg")
    return S.kind = n.props["data-perch-image"] ? "image" : "svg", S.markup = i1(n), S;
  if (E === "input" || E === "textarea" || E === "select") {
    S.kind = "input", S.input_type = E === "input" ? String(n.props.type ?? "text") : E;
    for (const T of ["placeholder", "checked", "disabled"]) n.props[T] !== void 0 && (S[T] = n.props[T]);
    if (/^(checkbox|radio)$/.test(S.input_type) && (S.checked = n.checked), E !== "select" && (S.value = n.value), E === "input" && Lb.test(S.input_type) && (S.field_w = Gb * c.values["font-size"]), E === "textarea" && b.h === void 0) {
      const T = c.values, z = ($) => $ && typeof $ == "object" && "px" in $ ? $.px : 0, j = ($) => T[`border-${$}-style`] === "none" ? 0 : z(T[`border-${$}-width`]), V = Number(n.props.rows) > 0 ? Math.floor(Number(n.props.rows)) : 2;
      b.h = V * Ql(T, r.measure) + z(T["padding-top"]) + z(T["padding-bottom"]) + j("top") + j("bottom");
    }
    const { before: x, after: _ } = Fb(n, c, h, r);
    return (x || _) && (S.children = [x, _].filter(Boolean)), S;
  }
  if (E === "img") {
    S.kind = "image", S.src = n.props.src ?? null;
    for (const [x, _] of [["width", "w"], ["height", "h"]]) {
      const T = Number(n.props[x]);
      b[_] === void 0 && n.props[x] != null && Number.isFinite(T) && (b[_] = T);
    }
    return S;
  }
  const R = c.values["text-transform"], N = [];
  let M = !1, O = !1;
  const H = n.childNodes.reduce((x, _) => x + (_ instanceof $e ? 1 : 0), 0);
  let X = 0;
  for (const x of n.childNodes) {
    if (x instanceof Oi) {
      if (x.hidden || x.data === "") continue;
      M = !0;
      const j = N[N.length - 1];
      if (j?.kind === "text")
        j.source = (j.source ?? j.text) + x.data, j.text = ep(j.source, R), j.text === j.source && delete j.source;
      else {
        const V = ep(x.data, R);
        N.push(V === x.data ? { kind: "text", text: V } : { kind: "text", text: V, source: x.data });
      }
      continue;
    }
    if (!(x instanceof $e)) continue;
    const _ = tm(x, c, h, r, i, X === 0, X === H - 1, X);
    X++;
    const T = r.cache.get(x);
    s.volatile ||= T.volatile, s.subAnc ||= T.subAnc;
    const z = _[Zt];
    z === "inline" || z === "inline-block" || z === "inline-flex" ? M = !0 : z !== "none" && (O = !0), N.push(_);
  }
  if (/(^|\s)inline-flex(\s|$)/.test(String(n.props?.className ?? "")) && b.w === void 0) {
    for (let x = 0; x < N.length; x++)
      if (N[x].style?.flex_grow && N[x].style.min_w === 0 && N[x].style.overflow_x === "hidden") {
        const _ = ti(N, x);
        delete _.style.min_w, delete _.style.flex_grow, delete _.style.flex_basis, delete _.style.overflow_x, delete _.style.overflow_y;
      }
  }
  if (!b.display && M && N.some((x) => x.kind !== "text") && N.every((x) => x.kind === "text" || Pb(x))) {
    const x = N.map((_) => _.kind === "text" ? _.text : _.children.map((T) => T.text).join("")).join("");
    y("approximated", "display", "inline text elements in a line of text", "(inline formatting)", "their text joined to the line, in its font"), N.splice(0, N.length, { kind: "text", text: x });
  }
  const W = N.some((x) => x.kind !== "text");
  let D = N.length === 1 && N[0].kind !== "text" && /^inline-(block|flex)$/.test(N[0][Zt]) ? N[0] : null;
  if (!b.display && D) {
    D = ti(N, 0);
    const x = r.cache.get(n.childNodes.find((T) => T.id === D.id))?.part.computed, _ = x ? Vl(c.values, r.measure) - Pf(x.values, r.measure, D) : 0;
    b.display = "flex", b.flex_direction = "col", b.items = "start", _ > 0 && (D.style.mt = Math.round(((D.style.mt ?? 0) + _) * 100) / 100), y("approximated", "display", `${c.values.display} holding one ${D[Zt]} box`, "(inline formatting)", "a column, the box lowered to the line's baseline");
  } else if (!b.display && N.length === 1 && (N[0].kind === "svg" || N[0].kind === "image") && N[0][Zt] === "inline" && typeof N[0].style.h == "number") {
    const x = ti(N, 0), _ = Vl(c.values, r.measure), T = Ql(c.values, r.measure) - _, z = (j) => Math.round(j * 100) / 100;
    b.display = "flex", b.flex_direction = "col", b.items = "start", _ > x.style.h && (x.style.mt = z((x.style.mt ?? 0) + _ - x.style.h)), T > 0 && (x.style.mb = z((x.style.mb ?? 0) + T)), y("approximated", "display", `${c.values.display} holding one inline image`, "(inline formatting)", "a column, the image on the line's baseline");
  } else if (!b.display && M && W) {
    if (b.display = "flex", b.flex_direction = O ? "col" : "row", !O) b.items = "baseline";
    else {
      const x = (_) => N[_] && (N[_].kind === "text" || !/^(block|flex|grid|table|list-item)$/.test(N[_][Zt] ?? "block"));
      for (let _ = 0; _ < N.length; _++) {
        if (N[_].kind === "text" || !/^inline-(block|flex)$/.test(N[_][Zt])) continue;
        const T = ti(N, _);
        if (T.style.self ??= "start", x(_ - 1) || x(_ + 1)) continue;
        const z = r.cache.get(n.childNodes.find((V) => V.id === T.id))?.part.computed, j = z ? Vl(c.values, r.measure) - Pf(z.values, r.measure, T) : 0;
        j > 0 && (T.style.mt = Math.round(((T.style.mt ?? 0) + j) * 100) / 100);
      }
    }
    y("approximated", "display", `${c.values.display} with inline content`, "(inline formatting)", O ? "a column of its children" : "a row on the text baseline");
  }
  const g = c.values["letter-spacing"]?.px, w = c.values["overflow-x"] !== "visible";
  if (g)
    for (let x = 0; x < N.length; x++) {
      const _ = N[x];
      if (_.kind !== "text") continue;
      const T = Math.round(g * [..._.text].length * 1e3) / 1e3;
      if (g > 0 || !w) {
        N[x] = { kind: "div", style: { pr: T }, tokens: {}, children: [_] };
        continue;
      }
      const z = c.values["font-size"], j = Math.max(0.8, 1 + g / (0.55 * z)), V = Math.round(Ql(c.values, r.measure) * 1e3) / 1e3;
      N[x] = { kind: "div", style: { text_size: Math.round(z * j * 1e3) / 1e3, line_height: `${V}px` }, tokens: {}, children: [_] };
    }
  return S.children = N, S;
}
function n1(n, a) {
  if (!a) return null;
  let i = (a.self ? n : a.closest ? Hp(n, a.closest) : a.find ? Zl(n, a.find)[0] : null)?.getAttribute(a.attr) ?? null;
  return i && a.strip && i.startsWith(a.strip) && (i = i.slice(a.strip.length)), i;
}
function a1(n, a, r) {
  const i = a.map((f) => [f, ji(f.selector)]), s = /* @__PURE__ */ new Map(), c = (f) => {
    for (const u of f.children) {
      const m = r.get(u.id);
      if (m)
        for (const [h, v] of i) {
          const y = h.textRange ? "range_name" : "name";
          if (h.textRange && m[y] != null || !v.some((R) => Uo(u, R))) continue;
          const b = n1(u, h.key), S = b == null ? s.get(h.name) ?? 0 : 0;
          b == null && s.set(h.name, S + 1);
          const E = b != null ? `${h.name}:${b}` : S ? `${h.name}@${S}` : h.name;
          m[y] == null ? m[y] = E : (m.also ??= []).push(E);
        }
      c(u);
    }
  };
  c(n.documentElement);
}
const Ei = 0.9521, nm = 0.2256, Vl = (n, a) => (Ql(n, a) - (Ei + nm) * n["font-size"]) / 2 + Ei * n["font-size"];
function Pf(n, a, r) {
  const i = (m) => m && typeof m == "object" && "px" in m ? m.px : 0, s = n["border-top-style"] === "none" ? 0 : i(n["border-top-width"]), c = r?.children ?? [], f = c.length === 1 && (c[0].kind === "svg" || c[0].kind === "image") && typeof c[0].style.h == "number" ? c[0] : null, u = f ? Math.max(Vl(n, a), (f.style.mt ?? 0) + f.style.h) : Vl(n, a);
  return i(n["padding-top"]) + s + u;
}
const ep = (n, a) => a === "uppercase" ? n.toUpperCase() : a === "lowercase" ? n.toLowerCase() : a === "capitalize" ? n.replace(/\b\p{L}/gu, (r) => r.toUpperCase()) : n, am = /* @__PURE__ */ new Set(["children", "style", "className", "key", "ref", "dangerouslySetInnerHTML"]);
function l1(n) {
  const a = {};
  for (const [r, i] of Object.entries(n.props)) {
    if (am.has(r) || typeof i == "function" || i === void 0 || i === null || typeof i == "object") continue;
    const s = r.startsWith("aria-") || r.startsWith("data-");
    if (i === !1 && !s) continue;
    const c = r === "htmlFor" ? "for" : r === "tabIndex" ? "tabindex" : r;
    a[c] = typeof i == "boolean" ? s ? String(i) : "" : String(i);
  }
  return { tag: n.tagName, classes: n.classList, attrs: a };
}
const r1 = (n) => n === "className" ? "class" : /^(viewBox|preserveAspectRatio|gradientUnits|gradientTransform|patternUnits|xmlns)$/.test(n) ? n : n.replace(/[A-Z]/g, (a) => `-${a.toLowerCase()}`), tp = (n) => String(n).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
function i1(n) {
  if (n.props["data-perch-markup"]) return String(n.props["data-perch-markup"]);
  const a = (r) => {
    const i = [];
    for (const [c, f] of Object.entries(r.props))
      am.has(c) || typeof f == "function" || f === void 0 || f === null || f === !1 || typeof f == "object" || c.startsWith("data-") || c.startsWith("aria-") || c === "focusable" || c === "role" || c === "title" || i.push(`${r1(c)}="${tp(f === !0 ? "" : f)}"`);
    r.tagName === "svg" && !r.props.xmlns && i.unshift('xmlns="http://www.w3.org/2000/svg"');
    const s = r.childNodes.map((c) => c instanceof Oi ? tp(c.data) : a(c)).join("");
    return `<${r.tagName}${i.length ? ` ${i.join(" ")}` : ""}>${s}</${r.tagName}>`;
  };
  return a(n);
}
function s1(n) {
  const a = n.theme?.() ?? {}, r = {};
  for (const i of Kp) a[i] && (r[i] = a[i]);
  return r;
}
const o1 = { font_features: "" };
function c1(n, a, r, i = {}, s = null) {
  const c = s1(a), f = a.viewport?.() ?? { width: 1e3, height: 800 }, u = JSON.stringify([c, f]);
  (i.look !== u || i.sheet !== r) && Object.assign(i, { look: u, sheet: r, cache: /* @__PURE__ */ new WeakMap(), cascade: new Nb(r, { theme: c, viewport: f }), top: null });
  const { cascade: m, cache: h } = i, v = new qb(), y = [], S = { cascade: m, cache: h, viewport: f, findings: v, log: y, add: (...M) => {
    y.push(M), v.add(...M);
  }, now: Lo(), measure: a.lineHeight ? (M) => a.lineHeight(M) : null };
  i.top ??= m.compute(n.body, m.compute(n.documentElement, null));
  const E = n.body.children, R = E.map((M, O) => tm(M, i.top, o1, S, 0, O === 0, O === E.length - 1, O));
  if (s?.length) {
    const M = /* @__PURE__ */ new Map(), O = (H) => {
      H.id && (M.set(H.id, H), delete H.name, delete H.range_name, delete H.also);
      for (const X of H.children ?? []) O(X);
    };
    R.forEach(O), a1(n, s, M);
  }
  const N = /* @__PURE__ */ new Set();
  for (const M of [n, n.defaultView])
    for (const { type: O } of M?.listeners ?? []) Xf[O] && N.add(Xf[O]);
  return { schema: Mb, root: R[0] ?? null, overlays: R.slice(1), document_events: [...N].sort(), unsupported: S.findings.list() };
}
const Ia = { layers: ["properties", "theme", "base", "utilities"], properties: { "--tw-translate-x": { inherits: !1, initial: "0" }, "--tw-translate-y": { inherits: !1, initial: "0" }, "--tw-translate-z": { inherits: !1, initial: "0" }, "--tw-rotate-x": { inherits: !1, initial: null }, "--tw-rotate-y": { inherits: !1, initial: null }, "--tw-rotate-z": { inherits: !1, initial: null }, "--tw-skew-x": { inherits: !1, initial: null }, "--tw-skew-y": { inherits: !1, initial: null }, "--tw-space-y-reverse": { inherits: !1, initial: "0" }, "--tw-border-style": { inherits: !1, initial: "solid" }, "--tw-leading": { inherits: !1, initial: null }, "--tw-font-weight": { inherits: !1, initial: null }, "--tw-tracking": { inherits: !1, initial: null }, "--tw-ordinal": { inherits: !1, initial: null }, "--tw-slashed-zero": { inherits: !1, initial: null }, "--tw-numeric-figure": { inherits: !1, initial: null }, "--tw-numeric-spacing": { inherits: !1, initial: null }, "--tw-numeric-fraction": { inherits: !1, initial: null }, "--tw-shadow": { inherits: !1, initial: "0 0 #0000" }, "--tw-shadow-color": { inherits: !1, initial: null }, "--tw-shadow-alpha": { inherits: !1, initial: "100%" }, "--tw-inset-shadow": { inherits: !1, initial: "0 0 #0000" }, "--tw-inset-shadow-color": { inherits: !1, initial: null }, "--tw-inset-shadow-alpha": { inherits: !1, initial: "100%" }, "--tw-ring-color": { inherits: !1, initial: null }, "--tw-ring-shadow": { inherits: !1, initial: "0 0 #0000" }, "--tw-inset-ring-color": { inherits: !1, initial: null }, "--tw-inset-ring-shadow": { inherits: !1, initial: "0 0 #0000" }, "--tw-ring-inset": { inherits: !1, initial: null }, "--tw-ring-offset-width": { inherits: !1, initial: "0" }, "--tw-ring-offset-color": { inherits: !1, initial: "#fff" }, "--tw-ring-offset-shadow": { inherits: !1, initial: "0 0 #0000" }, "--tw-outline-style": { inherits: !1, initial: "solid" }, "--tw-blur": { inherits: !1, initial: null }, "--tw-brightness": { inherits: !1, initial: null }, "--tw-contrast": { inherits: !1, initial: null }, "--tw-grayscale": { inherits: !1, initial: null }, "--tw-hue-rotate": { inherits: !1, initial: null }, "--tw-invert": { inherits: !1, initial: null }, "--tw-opacity": { inherits: !1, initial: null }, "--tw-saturate": { inherits: !1, initial: null }, "--tw-sepia": { inherits: !1, initial: null }, "--tw-drop-shadow": { inherits: !1, initial: null }, "--tw-drop-shadow-color": { inherits: !1, initial: null }, "--tw-drop-shadow-alpha": { inherits: !1, initial: "100%" }, "--tw-drop-shadow-size": { inherits: !1, initial: null }, "--tw-backdrop-blur": { inherits: !1, initial: null }, "--tw-backdrop-brightness": { inherits: !1, initial: null }, "--tw-backdrop-contrast": { inherits: !1, initial: null }, "--tw-backdrop-grayscale": { inherits: !1, initial: null }, "--tw-backdrop-hue-rotate": { inherits: !1, initial: null }, "--tw-backdrop-invert": { inherits: !1, initial: null }, "--tw-backdrop-opacity": { inherits: !1, initial: null }, "--tw-backdrop-saturate": { inherits: !1, initial: null }, "--tw-backdrop-sepia": { inherits: !1, initial: null }, "--tw-duration": { inherits: !1, initial: null }, "--tw-ease": { inherits: !1, initial: null }, "--tw-content": { inherits: !1, initial: '""' } }, rules: [[":root, :host", null, 2, [["--spacing", ".25rem"], ["--text-xs", ".75rem"], ["--text-xs--line-height", "calc(1 / .75)"], ["--text-sm", ".875rem"], ["--text-sm--line-height", "calc(1.25 / .875)"], ["--font-weight-normal", "400"], ["--font-weight-medium", "500"], ["--font-weight-semibold", "600"], ["--font-weight-bold", "700"], ["--tracking-normal", "0em"], ["--tracking-wide", ".025em"], ["--leading-tight", "1.25"], ["--leading-relaxed", "1.625"], ["--ease-out", "cubic-bezier(0, 0, .2, 1)"], ["--animate-pulse", "pulse 2s cubic-bezier(.4, 0, .6, 1) infinite"], ["--blur-xl", "24px"], ["--default-transition-duration", ".15s"], ["--default-transition-timing-function", "cubic-bezier(.4, 0, .2, 1)"], ["--animate-toast-in", "toast-in .2s cubic-bezier(.22, 1, .36, 1)"], ["--animate-host-pulse", "host-connecting-pulse 1.4s ease-in-out infinite"], ["--animate-drop-zone", "drop-zone-in .14s ease-out, drop-zone-pulse 1.2s ease-in-out .14s infinite"]]], ["::selection", null, 3, [["background", "var(--accent)"], ["color", "var(--panel-bg)"]]], [":where(input, textarea)::placeholder", null, 3, [["color", "var(--subtext-0)"], ["opacity", "1"]]], [":where(button, input, select, textarea)", null, 3, [["border", "0"]]], [':where(button, a[href], select, summary, [role="button"], [role="menuitem"]):focus-visible', null, 3, [["outline", "2px solid var(--accent)"], ["outline-offset", "-2px"]]], ["::-webkit-scrollbar", null, 3, [["width", "var(--scrollbar-size)"], ["height", "var(--scrollbar-size)"]]], ["::-webkit-scrollbar-track", null, 3, [["background", "none"]]], ["::-webkit-scrollbar-corner", null, 3, [["background", "none"]]], ["::-webkit-scrollbar-thumb", null, 3, [["background", "var(--text)"]]], ["::-webkit-scrollbar-thumb", null, 3, [["background", "color-mix(in srgb, var(--text) 20%, transparent)"]]], ["::-webkit-scrollbar-thumb", null, 3, [["border-radius", "var(--scrollbar-size)"]]], ["::-webkit-scrollbar-thumb:hover", null, 3, [["background", "var(--text)"]]], ["::-webkit-scrollbar-thumb:hover", null, 3, [["background", "color-mix(in srgb, var(--text) 40%, transparent)"]]], [".xterm .xterm-scrollable-element > .xterm-scrollbar > .xterm-slider", null, 3, [["border-radius", "var(--scrollbar-size)"]]], [".\\@container, .\\[container-type\\:inline-size\\]", null, 4, [["container-type", "inline-size"]]], [".pointer-events-auto", null, 4, [["pointer-events", "auto"]]], [".pointer-events-none", null, 4, [["pointer-events", "none"]]], [".collapse", null, 4, [["visibility", "collapse"]]], [".invisible", null, 4, [["visibility", "hidden"]]], [".visible", null, 4, [["visibility", "visible"]]], [".sr-only", null, 4, [["clip-path", "inset(50%)"], ["white-space", "nowrap"], ["border-width", "0"], ["width", "1px"], ["height", "1px"], ["margin", "-1px"], ["padding", "0"], ["position", "absolute"], ["overflow", "hidden"]]], [".absolute", null, 4, [["position", "absolute"]]], [".fixed", null, 4, [["position", "fixed"]]], [".relative", null, 4, [["position", "relative"]]], [".static", null, 4, [["position", "static"]]], [".sticky", null, 4, [["position", "sticky"]]], [".inset-0", null, 4, [["inset", "0"]]], [".inset-x-0", null, 4, [["inset-inline", "0"]]], [".inset-x-2", null, 4, [["inset-inline", "calc(var(--spacing) * 2)"]]], [".-top-1", null, 4, [["top", "calc(var(--spacing) * -1)"]]], [".-top-1\\.5", null, 4, [["top", "calc(var(--spacing) * -1.5)"]]], [".top-0", null, 4, [["top", "0"]]], [".top-1", null, 4, [["top", "var(--spacing)"]]], [".top-1\\.5", null, 4, [["top", "calc(var(--spacing) * 1.5)"]]], [".top-1\\/2", null, 4, [["top", "50%"]]], [".top-2", null, 4, [["top", "calc(var(--spacing) * 2)"]]], [".top-4", null, 4, [["top", "calc(var(--spacing) * 4)"]]], [".top-\\[0\\.1rem\\]", null, 4, [["top", ".1rem"]]], [".top-\\[7px\\]", null, 4, [["top", "7px"]]], [".top-\\[max\\(0\\.75rem\\,env\\(safe-area-inset-top\\)\\)\\]", null, 4, [["top", "max(.75rem, env(safe-area-inset-top))"]]], [".top-full", null, 4, [["top", "100%"]]], [".top-px", null, 4, [["top", "1px"]]], [".-right-1", null, 4, [["right", "calc(var(--spacing) * -1)"]]], [".-right-1\\.5", null, 4, [["right", "calc(var(--spacing) * -1.5)"]]], [".right-0", null, 4, [["right", "0"]]], [".right-1", null, 4, [["right", "var(--spacing)"]]], [".right-3", null, 4, [["right", "calc(var(--spacing) * 3)"]]], [".right-4", null, 4, [["right", "calc(var(--spacing) * 4)"]]], [".right-\\[0\\.8rem\\]", null, 4, [["right", ".8rem"]]], [".right-\\[0\\.25rem\\]", null, 4, [["right", ".25rem"]]], [".right-\\[max\\(0\\.75rem\\,env\\(safe-area-inset-right\\)\\)\\]", null, 4, [["right", "max(.75rem, env(safe-area-inset-right))"]]], [".right-full", null, 4, [["right", "100%"]]], [".bottom-0", null, 4, [["bottom", "0"]]], [".bottom-2", null, 4, [["bottom", "calc(var(--spacing) * 2)"]]], [".bottom-3", null, 4, [["bottom", "calc(var(--spacing) * 3)"]]], [".bottom-\\[0\\.8rem\\]", null, 4, [["bottom", ".8rem"]]], [".bottom-full", null, 4, [["bottom", "100%"]]], [".-left-8", null, 4, [["left", "calc(var(--spacing) * -8)"]]], [".-left-\\[2px\\]", null, 4, [["left", "-2px"]]], [".left-0", null, 4, [["left", "0"]]], [".left-2", null, 4, [["left", "calc(var(--spacing) * 2)"]]], [".left-\\[0\\.1rem\\]", null, 4, [["left", ".1rem"]]], [".left-\\[max\\(0\\.75rem\\,env\\(safe-area-inset-left\\)\\)\\]", null, 4, [["left", "max(.75rem, env(safe-area-inset-left))"]]], [".left-full", null, 4, [["left", "100%"]]], [".left-px", null, 4, [["left", "1px"]]], [".isolate", null, 4, [["isolation", "isolate"]]], [".z-4", null, 4, [["z-index", "4"]]], [".z-5", null, 4, [["z-index", "5"]]], [".z-10", null, 4, [["z-index", "10"]]], [".z-20", null, 4, [["z-index", "20"]]], [".z-30", null, 4, [["z-index", "30"]]], [".z-40", null, 4, [["z-index", "40"]]], [".z-50", null, 4, [["z-index", "50"]]], [".z-\\[2\\]", null, 4, [["z-index", "2"]]], [".z-\\[3\\]", null, 4, [["z-index", "3"]]], [".z-\\[5\\]", null, 4, [["z-index", "5"]]], [".z-\\[1000\\]", null, 4, [["z-index", "1000"]]], [".z-\\[2000\\]", null, 4, [["z-index", "2000"]]], [".z-\\[2100\\]", null, 4, [["z-index", "2100"]]], [".z-\\[2200\\]", null, 4, [["z-index", "2200"]]], [".z-\\[3000\\]", null, 4, [["z-index", "3000"]]], [".z-\\[3100\\]", null, 4, [["z-index", "3100"]]], [".z-\\[4000\\]", null, 4, [["z-index", "4000"]]], [".z-\\[9998\\]", null, 4, [["z-index", "9998"]]], [".z-\\[9999\\]", null, 4, [["z-index", "9999"]]], [".z-\\[10000\\]", null, 4, [["z-index", "10000"]]], [".z-auto", null, 4, [["z-index", "auto"]]], [".order-last", null, 4, [["order", "9999"]]], [".col-\\[1\\/-1\\]", null, 4, [["grid-column", "1 / -1"]]], [".container", null, 4, [["width", "100%"]]], [".container", ["(min-width: 40rem)"], 4, [["max-width", "40rem"]]], [".container", ["(min-width: 48rem)"], 4, [["max-width", "48rem"]]], [".container", ["(min-width: 64rem)"], 4, [["max-width", "64rem"]]], [".container", ["(min-width: 80rem)"], 4, [["max-width", "80rem"]]], [".container", ["(min-width: 96rem)"], 4, [["max-width", "96rem"]]], [".m-0", null, 4, [["margin", "0"]]], [".m-2", null, 4, [["margin", "calc(var(--spacing) * 2)"]]], [".m-\\[0\\.7rem\\]", null, 4, [["margin", ".7rem"]]], [".m-auto", null, 4, [["margin", "auto"]]], [".mx-0", null, 4, [["margin-inline", "0"]]], [".mx-0\\.5", null, 4, [["margin-inline", "calc(var(--spacing) * .5)"]]], [".mx-2", null, 4, [["margin-inline", "calc(var(--spacing) * 2)"]]], [".mx-3", null, 4, [["margin-inline", "calc(var(--spacing) * 3)"]]], [".mx-4", null, 4, [["margin-inline", "calc(var(--spacing) * 4)"]]], [".mx-\\[0\\.3rem\\]", null, 4, [["margin-inline", ".3rem"]]], [".mx-\\[0\\.7rem\\]", null, 4, [["margin-inline", ".7rem"]]], [".mx-\\[0\\.65rem\\]", null, 4, [["margin-inline", ".65rem"]]], [".mx-\\[3px\\]", null, 4, [["margin-inline", "3px"]]], [".mx-\\[11px\\]", null, 4, [["margin-inline", "11px"]]], [".mx-auto", null, 4, [["margin-inline", "auto"]]], [".my-0\\.5", null, 4, [["margin-block", "calc(var(--spacing) * .5)"]]], [".my-1", null, 4, [["margin-block", "var(--spacing)"]]], [".my-2", null, 4, [["margin-block", "calc(var(--spacing) * 2)"]]], [".my-\\[0\\.2rem\\]", null, 4, [["margin-block", ".2rem"]]], [".my-\\[0\\.3rem\\]", null, 4, [["margin-block", ".3rem"]]], [".my-\\[0\\.6rem\\]", null, 4, [["margin-block", ".6rem"]]], [".my-\\[0\\.28rem\\]", null, 4, [["margin-block", ".28rem"]]], [".my-\\[0\\.45rem\\]", null, 4, [["margin-block", ".45rem"]]], [".my-\\[0\\.55rem\\]", null, 4, [["margin-block", ".55rem"]]], [".my-\\[3px\\]", null, 4, [["margin-block", "3px"]]], [".-mt-\\[2px\\]", null, 4, [["margin-top", "-2px"]]], [".mt-0", null, 4, [["margin-top", "0"]]], [".mt-0\\.5", null, 4, [["margin-top", "calc(var(--spacing) * .5)"]]], [".mt-1", null, 4, [["margin-top", "var(--spacing)"]]], [".mt-1\\.5", null, 4, [["margin-top", "calc(var(--spacing) * 1.5)"]]], [".mt-2", null, 4, [["margin-top", "calc(var(--spacing) * 2)"]]], [".mt-3", null, 4, [["margin-top", "calc(var(--spacing) * 3)"]]], [".mt-4", null, 4, [["margin-top", "calc(var(--spacing) * 4)"]]], [".mt-\\[0\\.1rem\\]", null, 4, [["margin-top", ".1rem"]]], [".mt-\\[0\\.2rem\\]", null, 4, [["margin-top", ".2rem"]]], [".mt-\\[0\\.3rem\\]", null, 4, [["margin-top", ".3rem"]]], [".mt-\\[0\\.4rem\\]", null, 4, [["margin-top", ".4rem"]]], [".mt-\\[0\\.5rem\\]", null, 4, [["margin-top", ".5rem"]]], [".mt-\\[0\\.15rem\\]", null, 4, [["margin-top", ".15rem"]]], [".mt-\\[0\\.35rem\\]", null, 4, [["margin-top", ".35rem"]]], [".mr-1", null, 4, [["margin-right", "var(--spacing)"]]], [".mr-1\\.5", null, 4, [["margin-right", "calc(var(--spacing) * 1.5)"]]], [".mr-\\[0\\.3rem\\]", null, 4, [["margin-right", ".3rem"]]], [".mr-\\[0\\.7rem\\]", null, 4, [["margin-right", ".7rem"]]], [".mr-auto", null, 4, [["margin-right", "auto"]]], [".mb-0", null, 4, [["margin-bottom", "0"]]], [".mb-0\\.5", null, 4, [["margin-bottom", "calc(var(--spacing) * .5)"]]], [".mb-1", null, 4, [["margin-bottom", "var(--spacing)"]]], [".mb-2", null, 4, [["margin-bottom", "calc(var(--spacing) * 2)"]]], [".mb-3", null, 4, [["margin-bottom", "calc(var(--spacing) * 3)"]]], [".mb-4", null, 4, [["margin-bottom", "calc(var(--spacing) * 4)"]]], [".mb-8", null, 4, [["margin-bottom", "calc(var(--spacing) * 8)"]]], [".mb-\\[0\\.2rem\\]", null, 4, [["margin-bottom", ".2rem"]]], [".mb-\\[0\\.3rem\\]", null, 4, [["margin-bottom", ".3rem"]]], [".mb-\\[0\\.4rem\\]", null, 4, [["margin-bottom", ".4rem"]]], [".mb-\\[0\\.6rem\\]", null, 4, [["margin-bottom", ".6rem"]]], [".mb-\\[0\\.7rem\\]", null, 4, [["margin-bottom", ".7rem"]]], [".mb-\\[0\\.9rem\\]", null, 4, [["margin-bottom", ".9rem"]]], [".mb-\\[0\\.15rem\\]", null, 4, [["margin-bottom", ".15rem"]]], [".mb-\\[0\\.35rem\\]", null, 4, [["margin-bottom", ".35rem"]]], [".mb-\\[0\\.55rem\\]", null, 4, [["margin-bottom", ".55rem"]]], [".mb-\\[1\\.1rem\\]", null, 4, [["margin-bottom", "1.1rem"]]], [".-ml-0\\.5", null, 4, [["margin-left", "calc(var(--spacing) * -.5)"]]], [".-ml-1", null, 4, [["margin-left", "calc(var(--spacing) * -1)"]]], [".-ml-2", null, 4, [["margin-left", "calc(var(--spacing) * -2)"]]], [".ml-1", null, 4, [["margin-left", "var(--spacing)"]]], [".ml-2", null, 4, [["margin-left", "calc(var(--spacing) * 2)"]]], [".ml-\\[0\\.4rem\\]", null, 4, [["margin-left", ".4rem"]]], [".ml-\\[0\\.5rem\\]", null, 4, [["margin-left", ".5rem"]]], [".ml-\\[0\\.9rem\\]", null, 4, [["margin-left", ".9rem"]]], [".ml-\\[0\\.35rem\\]", null, 4, [["margin-left", ".35rem"]]], [".ml-\\[0\\.55rem\\]", null, 4, [["margin-left", ".55rem"]]], [".ml-\\[1\\.15rem\\]", null, 4, [["margin-left", "1.15rem"]]], [".ml-\\[1\\.45rem\\]", null, 4, [["margin-left", "1.45rem"]]], [".ml-\\[2\\.025rem\\]", null, 4, [["margin-left", "2.025rem"]]], [".ml-\\[2\\.375rem\\]", null, 4, [["margin-left", "2.375rem"]]], [".ml-\\[6\\.1rem\\]", null, 4, [["margin-left", "6.1rem"]]], [".ml-auto", null, 4, [["margin-left", "auto"]]], [".box-border", null, 4, [["box-sizing", "border-box"]]], [".\\!hidden", null, 4, [["display", "none", 1]]], [".\\[display\\:-webkit-box\\]", null, 4, [["display", "-webkit-box"]]], [".\\[display\\:var\\(--pane-grip\\,flex\\)\\]", null, 4, [["display", "var(--pane-grip, flex)"]]], [".block", null, 4, [["display", "block"]]], [".contents", null, 4, [["display", "contents"]]], [".flex", null, 4, [["display", "flex"]]], [".grid", null, 4, [["display", "grid"]]], [".hidden", null, 4, [["display", "none"]]], [".inline", null, 4, [["display", "inline"]]], [".inline-block", null, 4, [["display", "inline-block"]]], [".inline-flex", null, 4, [["display", "inline-flex"]]], [".table", null, 4, [["display", "table"]]], [".size-1", null, 4, [["width", "var(--spacing)"], ["height", "var(--spacing)"]]], [".size-1\\.5", null, 4, [["width", "calc(var(--spacing) * 1.5)"], ["height", "calc(var(--spacing) * 1.5)"]]], [".size-2", null, 4, [["width", "calc(var(--spacing) * 2)"], ["height", "calc(var(--spacing) * 2)"]]], [".size-3", null, 4, [["width", "calc(var(--spacing) * 3)"], ["height", "calc(var(--spacing) * 3)"]]], [".size-5", null, 4, [["width", "calc(var(--spacing) * 5)"], ["height", "calc(var(--spacing) * 5)"]]], [".size-6", null, 4, [["width", "calc(var(--spacing) * 6)"], ["height", "calc(var(--spacing) * 6)"]]], [".size-7", null, 4, [["width", "calc(var(--spacing) * 7)"], ["height", "calc(var(--spacing) * 7)"]]], [".size-8", null, 4, [["width", "calc(var(--spacing) * 8)"], ["height", "calc(var(--spacing) * 8)"]]], [".size-11", null, 4, [["width", "calc(var(--spacing) * 11)"], ["height", "calc(var(--spacing) * 11)"]]], [".size-14", null, 4, [["width", "calc(var(--spacing) * 14)"], ["height", "calc(var(--spacing) * 14)"]]], [".size-\\[0\\.6rem\\]", null, 4, [["width", ".6rem"], ["height", ".6rem"]]], [".size-\\[1\\.2rem\\]", null, 4, [["width", "1.2rem"], ["height", "1.2rem"]]], [".size-\\[5px\\]", null, 4, [["width", "5px"], ["height", "5px"]]], [".size-\\[14px\\]", null, 4, [["width", "14px"], ["height", "14px"]]], [".size-\\[calc\\(14px\\*var\\(--zoom\\,1\\)\\)\\]", null, 4, [["width", "calc(14px * var(--zoom, 1))"], ["height", "calc(14px * var(--zoom, 1))"]]], [".size-full", null, 4, [["width", "100%"], ["height", "100%"]]], [".h-1", null, 4, [["height", "var(--spacing)"]]], [".h-1\\.5", null, 4, [["height", "calc(var(--spacing) * 1.5)"]]], [".h-2", null, 4, [["height", "calc(var(--spacing) * 2)"]]], [".h-3", null, 4, [["height", "calc(var(--spacing) * 3)"]]], [".h-4", null, 4, [["height", "calc(var(--spacing) * 4)"]]], [".h-5", null, 4, [["height", "calc(var(--spacing) * 5)"]]], [".h-6", null, 4, [["height", "calc(var(--spacing) * 6)"]]], [".h-7", null, 4, [["height", "calc(var(--spacing) * 7)"]]], [".h-8", null, 4, [["height", "calc(var(--spacing) * 8)"]]], [".h-9", null, 4, [["height", "calc(var(--spacing) * 9)"]]], [".h-11", null, 4, [["height", "calc(var(--spacing) * 11)"]]], [".h-12", null, 4, [["height", "calc(var(--spacing) * 12)"]]], [".h-44", null, 4, [["height", "calc(var(--spacing) * 44)"]]], [".h-\\[1\\.1rem\\]", null, 4, [["height", "1.1rem"]]], [".h-\\[1\\.3rem\\]", null, 4, [["height", "1.3rem"]]], [".h-\\[1\\.4rem\\]", null, 4, [["height", "1.4rem"]]], [".h-\\[1\\.25rem\\]", null, 4, [["height", "1.25rem"]]], [".h-\\[2px\\]", null, 4, [["height", "2px"]]], [".h-\\[14px\\]", null, 4, [["height", "14px"]]], [".h-\\[18px\\]", null, 4, [["height", "18px"]]], [".h-\\[43px\\]", null, 4, [["height", "43px"]]], [".h-\\[calc\\(100\\%-max\\(0\\.5rem\\,env\\(safe-area-inset-top\\)\\)\\)\\]", null, 4, [["height", "calc(100% - max(.5rem, env(safe-area-inset-top)))"]]], [".h-full", null, 4, [["height", "100%"]]], [".h-px", null, 4, [["height", "1px"]]], [".max-h-40", null, 4, [["max-height", "calc(var(--spacing) * 40)"]]], [".max-h-56", null, 4, [["max-height", "calc(var(--spacing) * 56)"]]], [".max-h-72", null, 4, [["max-height", "calc(var(--spacing) * 72)"]]], [".max-h-\\[8rem\\]", null, 4, [["max-height", "8rem"]]], [".max-h-\\[13rem\\]", null, 4, [["max-height", "13rem"]]], [".max-h-\\[30\\%\\]", null, 4, [["max-height", "30%"]]], [".max-h-\\[30vh\\]", null, 4, [["max-height", "30vh"]]], [".max-h-\\[35vh\\]", null, 4, [["max-height", "35vh"]]], [".max-h-\\[40\\%\\]", null, 4, [["max-height", "40%"]]], [".max-h-\\[50dvh\\]", null, 4, [["max-height", "50dvh"]]], [".max-h-\\[60\\%\\]", null, 4, [["max-height", "60%"]]], [".max-h-\\[70\\%\\]", null, 4, [["max-height", "70%"]]], [".max-h-\\[85vh\\]", null, 4, [["max-height", "85vh"]]], [".max-h-\\[90\\%\\]", null, 4, [["max-height", "90%"]]], [".max-h-\\[190px\\]", null, 4, [["max-height", "190px"]]], [".max-h-\\[240px\\]", null, 4, [["max-height", "240px"]]], [".max-h-\\[260px\\]", null, 4, [["max-height", "260px"]]], [".max-h-\\[calc\\(85vh-4rem\\)\\]", null, 4, [["max-height", "calc(85vh - 4rem)"]]], [".max-h-\\[calc\\(100dvh_-_4rem\\)\\]", null, 4, [["max-height", "calc(100dvh - 4rem)"]]], [".max-h-\\[min\\(420px\\,calc\\(100dvh_-_16vh_-_2rem\\)\\)\\]", null, 4, [["max-height", "min(420px, 100dvh - 16vh - 2rem)"]]], [".max-h-\\[min\\(480px\\,calc\\(100dvh_-_16vh_-_2rem\\)\\)\\]", null, 4, [["max-height", "min(480px, 100dvh - 16vh - 2rem)"]]], [".max-h-full", null, 4, [["max-height", "100%"]]], [".min-h-0", null, 4, [["min-height", "0"]]], [".min-h-6", null, 4, [["min-height", "calc(var(--spacing) * 6)"]]], [".min-h-7", null, 4, [["min-height", "calc(var(--spacing) * 7)"]]], [".min-h-8", null, 4, [["min-height", "calc(var(--spacing) * 8)"]]], [".min-h-9", null, 4, [["min-height", "calc(var(--spacing) * 9)"]]], [".min-h-10", null, 4, [["min-height", "calc(var(--spacing) * 10)"]]], [".min-h-11", null, 4, [["min-height", "calc(var(--spacing) * 11)"]]], [".min-h-20", null, 4, [["min-height", "calc(var(--spacing) * 20)"]]], [".min-h-40", null, 4, [["min-height", "calc(var(--spacing) * 40)"]]], [".min-h-\\[1\\.5em\\]", null, 4, [["min-height", "1.5em"]]], [".min-h-\\[1\\.8rem\\]", null, 4, [["min-height", "1.8rem"]]], [".min-h-\\[2\\.5rem\\]", null, 4, [["min-height", "2.5rem"]]], [".min-h-\\[3\\.2rem\\]", null, 4, [["min-height", "3.2rem"]]], [".min-h-\\[3\\.25rem\\]", null, 4, [["min-height", "3.25rem"]]], [".min-h-\\[6rem\\]", null, 4, [["min-height", "6rem"]]], [".min-h-\\[8rem\\]", null, 4, [["min-height", "8rem"]]], [".min-h-\\[10rem\\]", null, 4, [["min-height", "10rem"]]], [".min-h-\\[12rem\\]", null, 4, [["min-height", "12rem"]]], [".min-h-\\[13rem\\]", null, 4, [["min-height", "13rem"]]], [".min-h-\\[32px\\]", null, 4, [["min-height", "32px"]]], [".min-h-\\[44px\\]", null, 4, [["min-height", "44px"]]], [".min-h-\\[60px\\]", null, 4, [["min-height", "60px"]]], [".min-h-\\[100dvh\\]", null, 4, [["min-height", "100dvh"]]], [".min-h-\\[calc\\(22px\\*var\\(--zoom\\,1\\)\\)\\]", null, 4, [["min-height", "calc(22px * var(--zoom, 1))"]]], [".min-h-full", null, 4, [["min-height", "100%"]]], [".w-2", null, 4, [["width", "calc(var(--spacing) * 2)"]]], [".w-2\\.5", null, 4, [["width", "calc(var(--spacing) * 2.5)"]]], [".w-3", null, 4, [["width", "calc(var(--spacing) * 3)"]]], [".w-4", null, 4, [["width", "calc(var(--spacing) * 4)"]]], [".w-5", null, 4, [["width", "calc(var(--spacing) * 5)"]]], [".w-7", null, 4, [["width", "calc(var(--spacing) * 7)"]]], [".w-8", null, 4, [["width", "calc(var(--spacing) * 8)"]]], [".w-9", null, 4, [["width", "calc(var(--spacing) * 9)"]]], [".w-10", null, 4, [["width", "calc(var(--spacing) * 10)"]]], [".w-20", null, 4, [["width", "calc(var(--spacing) * 20)"]]], [".w-40", null, 4, [["width", "calc(var(--spacing) * 40)"]]], [".w-44", null, 4, [["width", "calc(var(--spacing) * 44)"]]], [".w-60", null, 4, [["width", "calc(var(--spacing) * 60)"]]], [".w-\\[1\\.1rem\\]", null, 4, [["width", "1.1rem"]]], [".w-\\[1\\.4rem\\]", null, 4, [["width", "1.4rem"]]], [".w-\\[1\\.6rem\\]", null, 4, [["width", "1.6rem"]]], [".w-\\[1\\.25rem\\]", null, 4, [["width", "1.25rem"]]], [".w-\\[2\\.4rem\\]", null, 4, [["width", "2.4rem"]]], [".w-\\[2\\.25rem\\]", null, 4, [["width", "2.25rem"]]], [".w-\\[6rem\\]", null, 4, [["width", "6rem"]]], [".w-\\[7rem\\]", null, 4, [["width", "7rem"]]], [".w-\\[11rem\\]", null, 4, [["width", "11rem"]]], [".w-\\[15rem\\]", null, 4, [["width", "15rem"]]], [".w-\\[16rem\\]", null, 4, [["width", "16rem"]]], [".w-\\[18px\\]", null, 4, [["width", "18px"]]], [".w-\\[100cqi\\]", null, 4, [["width", "100cqi"]]], [".w-\\[calc\\(\\(100\\%-0\\.875rem\\)\\/8\\)\\]", null, 4, [["width", "calc(12.5% - .109375rem)"]]], [".w-\\[calc\\(100\\%_-_0\\.6rem\\)\\]", null, 4, [["width", "calc(100% - .6rem)"]]], [".w-\\[calc\\(100\\%_-_1rem\\)\\]", null, 4, [["width", "calc(100% - 1rem)"]]], [".w-\\[min\\(22rem\\,calc\\(100vw-3rem\\)\\)\\]", null, 4, [["width", "min(22rem, 100vw - 3rem)"]]], [".w-\\[min\\(26rem\\,100\\%\\)\\]", null, 4, [["width", "min(26rem, 100%)"]]], [".w-\\[min\\(28rem\\,calc\\(100vw-2\\.5rem\\)\\)\\]", null, 4, [["width", "min(28rem, 100vw - 2.5rem)"]]], [".w-\\[min\\(30rem\\,92vw\\)\\]", null, 4, [["width", "min(30rem, 92vw)"]]], [".w-\\[min\\(32rem\\,100\\%\\)\\]", null, 4, [["width", "min(32rem, 100%)"]]], [".w-\\[min\\(340px\\,calc\\(100vw-16px\\)\\)\\]", null, 4, [["width", "min(340px, 100vw - 16px)"]]], [".w-\\[min\\(360px\\,calc\\(100vw_-_2rem\\)\\)\\]", null, 4, [["width", "min(360px, 100vw - 2rem)"]]], [".w-\\[min\\(420px\\,calc\\(100vw_-_16px\\)\\)\\]", null, 4, [["width", "min(420px, 100vw - 16px)"]]], [".w-\\[min\\(480px\\,calc\\(100vw_-_2rem\\)\\)\\]", null, 4, [["width", "min(480px, 100vw - 2rem)"]]], [".w-\\[min\\(560px\\,calc\\(100vw_-_2rem\\)\\)\\]", null, 4, [["width", "min(560px, 100vw - 2rem)"]]], [".w-\\[var\\(--sidebar-width\\,240px\\)\\]", null, 4, [["width", "var(--sidebar-width, 240px)"]]], [".w-\\[var\\(--tools-width\\)\\]", null, 4, [["width", "var(--tools-width)"]]], [".w-auto", null, 4, [["width", "auto"]]], [".w-full", null, 4, [["width", "100%"]]], [".w-px", null, 4, [["width", "1px"]]], [".max-w-24", null, 4, [["max-width", "calc(var(--spacing) * 24)"]]], [".max-w-32", null, 4, [["max-width", "calc(var(--spacing) * 32)"]]], [".max-w-\\[9rem\\]", null, 4, [["max-width", "9rem"]]], [".max-w-\\[10rem\\]", null, 4, [["max-width", "10rem"]]], [".max-w-\\[14rem\\]", null, 4, [["max-width", "14rem"]]], [".max-w-\\[16rem\\]", null, 4, [["max-width", "16rem"]]], [".max-w-\\[24rem\\]", null, 4, [["max-width", "24rem"]]], [".max-w-\\[25\\%\\]", null, 4, [["max-width", "25%"]]], [".max-w-\\[26rem\\]", null, 4, [["max-width", "26rem"]]], [".max-w-\\[28rem\\]", null, 4, [["max-width", "28rem"]]], [".max-w-\\[35\\%\\]", null, 4, [["max-width", "35%"]]], [".max-w-\\[38\\%\\]", null, 4, [["max-width", "38%"]]], [".max-w-\\[45\\%\\]", null, 4, [["max-width", "45%"]]], [".max-w-\\[46rem\\]", null, 4, [["max-width", "46rem"]]], [".max-w-\\[55\\%\\]", null, 4, [["max-width", "55%"]]], [".max-w-\\[56rem\\]", null, 4, [["max-width", "56rem"]]], [".max-w-\\[85\\%\\]", null, 4, [["max-width", "85%"]]], [".max-w-\\[140px\\]", null, 4, [["max-width", "140px"]]], [".max-w-\\[320px\\]", null, 4, [["max-width", "320px"]]], [".max-w-\\[min\\(22rem\\,calc\\(100\\%-1\\.5rem\\)\\)\\]", null, 4, [["max-width", "min(22rem, 100% - 1.5rem)"]]], [".max-w-\\[min\\(30rem\\,calc\\(100\\%-1\\.6rem\\)\\)\\]", null, 4, [["max-width", "min(30rem, 100% - 1.6rem)"]]], [".max-w-\\[min\\(34rem\\,calc\\(100\\%-1\\.5rem\\)\\)\\]", null, 4, [["max-width", "min(34rem, 100% - 1.5rem)"]]], [".max-w-\\[min\\(320px\\,calc\\(100vw_-_24px\\)\\)\\]", null, 4, [["max-width", "min(320px, 100vw - 24px)"]]], [".max-w-full", null, 4, [["max-width", "100%"]]], [".max-w-none", null, 4, [["max-width", "none"]]], [".min-w-0", null, 4, [["min-width", "0"]]], [".min-w-6", null, 4, [["min-width", "calc(var(--spacing) * 6)"]]], [".min-w-8", null, 4, [["min-width", "calc(var(--spacing) * 8)"]]], [".min-w-12", null, 4, [["min-width", "calc(var(--spacing) * 12)"]]], [".min-w-24", null, 4, [["min-width", "calc(var(--spacing) * 24)"]]], [".min-w-36", null, 4, [["min-width", "calc(var(--spacing) * 36)"]]], [".min-w-56", null, 4, [["min-width", "calc(var(--spacing) * 56)"]]], [".min-w-\\[5\\.5rem\\]", null, 4, [["min-width", "5.5rem"]]], [".min-w-\\[7rem\\]", null, 4, [["min-width", "7rem"]]], [".min-w-\\[12rem\\]", null, 4, [["min-width", "12rem"]]], [".min-w-\\[14px\\]", null, 4, [["min-width", "14px"]]], [".min-w-\\[200px\\]", null, 4, [["min-width", "200px"]]], [".min-w-fit", null, 4, [["min-width", "fit-content"]]], [".min-w-max", null, 4, [["min-width", "max-content"]]], [".flex-1", null, 4, [["flex", "1"]]], [".flex-\\[0_0_5rem\\]", null, 4, [["flex", "0 0 5rem"]]], [".flex-\\[0_0_8px\\]", null, 4, [["flex", "0 0 8px"]]], [".flex-\\[0_1_40\\%\\]", null, 4, [["flex", "0 40%"]]], [".flex-\\[1_1_100\\%\\]", null, 4, [["flex", "100%"]]], [".flex-\\[2\\]", null, 4, [["flex", "2"]]], [".flex-initial", null, 4, [["flex", "0 auto"]]], [".flex-none", null, 4, [["flex", "none"]]], [".shrink", null, 4, [["flex-shrink", "1"]]], [".shrink-0", null, 4, [["flex-shrink", "0"]]], [".shrink-\\[0\\.001\\]", null, 4, [["flex-shrink", ".001"]]], [".shrink-\\[2\\]", null, 4, [["flex-shrink", "2"]]], [".shrink-\\[3\\]", null, 4, [["flex-shrink", "3"]]], [".grow", null, 4, [["flex-grow", "1"]]], [".basis-0", null, 4, [["flex-basis", "0"]]], [".basis-\\[14rem\\]", null, 4, [["flex-basis", "14rem"]]], [".-translate-y-1\\/2", null, 4, [["--tw-translate-y", "calc(calc(1 / 2 * 100%) * -1)"], ["translate", "var(--tw-translate-x) var(--tw-translate-y)"]]], [".\\[transform\\:translateY\\(-50\\%\\)\\]", null, 4, [["transform", "translateY(-50%)"]]], [".transform", null, 4, [["transform", "var(--tw-rotate-x, ) var(--tw-rotate-y, ) var(--tw-rotate-z, ) var(--tw-skew-x, ) var(--tw-skew-y, )"]]], [".animate-drop-zone", null, 4, [["animation", "var(--animate-drop-zone)"]]], [".animate-host-pulse", null, 4, [["animation", "var(--animate-host-pulse)"]]], [".animate-pulse", null, 4, [["animation", "var(--animate-pulse)"]]], [".animate-toast-in", null, 4, [["animation", "var(--animate-toast-in)"]]], [".cursor-col-resize", null, 4, [["cursor", "col-resize"]]], [".cursor-default", null, 4, [["cursor", "default"]]], [".cursor-grab", null, 4, [["cursor", "grab"]]], [".cursor-grabbing", null, 4, [["cursor", "grabbing"]]], [".cursor-pointer", null, 4, [["cursor", "pointer"]]], [".cursor-row-resize", null, 4, [["cursor", "row-resize"]]], [".touch-none", null, 4, [["touch-action", "none"]]], [".resize", null, 4, [["resize", "both"]]], [".resize-none", null, 4, [["resize", "none"]]], [".resize-y", null, 4, [["resize", "vertical"]]], [".\\[scrollbar-width\\:none\\]", null, 4, [["scrollbar-width", "none"]]], [".list-disc", null, 4, [["list-style-type", "disc"]]], [".list-none", null, 4, [["list-style-type", "none"]]], [".appearance-none", null, 4, [["appearance", "none"]]], [".grid-cols-8", null, 4, [["grid-template-columns", "repeat(8, minmax(0, 1fr))"]]], [".grid-cols-\\[1fr_auto_1fr\\]", null, 4, [["grid-template-columns", "1fr auto 1fr"]]], [".grid-cols-\\[2\\.5rem_2\\.5rem_0\\.9rem_minmax\\(0\\,1fr\\)\\]", null, 4, [["grid-template-columns", "2.5rem 2.5rem .9rem minmax(0, 1fr)"]]], [".grid-cols-\\[auto_minmax\\(0\\,1fr\\)\\]", null, 4, [["grid-template-columns", "auto minmax(0, 1fr)"]]], [".grid-cols-\\[minmax\\(4rem\\,10rem\\)_1fr_auto\\]", null, 4, [["grid-template-columns", "minmax(4rem, 10rem) 1fr auto"]]], [".grid-cols-\\[repeat\\(2\\,minmax\\(0\\,1fr\\)\\)\\]", null, 4, [["grid-template-columns", "repeat(2, minmax(0, 1fr))"]]], [".grid-cols-\\[repeat\\(auto-fit\\,minmax\\(8rem\\,1fr\\)\\)\\]", null, 4, [["grid-template-columns", "repeat(auto-fit, minmax(8rem, 1fr))"]]], [".flex-col", null, 4, [["flex-direction", "column"]]], [".flex-row", null, 4, [["flex-direction", "row"]]], [".flex-wrap", null, 4, [["flex-wrap", "wrap"]]], [".place-items-center", null, 4, [["place-items", "center"]]], [".content-center", null, 4, [["align-content", "center"]]], [".items-baseline", null, 4, [["align-items", "baseline"]]], [".items-center", null, 4, [["align-items", "center"]]], [".items-end", null, 4, [["align-items", "flex-end"]]], [".items-start", null, 4, [["align-items", "flex-start"]]], [".items-stretch", null, 4, [["align-items", "stretch"]]], [".justify-between", null, 4, [["justify-content", "space-between"]]], [".justify-center", null, 4, [["justify-content", "center"]]], [".justify-end", null, 4, [["justify-content", "flex-end"]]], [".justify-start", null, 4, [["justify-content", "flex-start"]]], [".justify-items-center", null, 4, [["justify-items", "center"]]], [".justify-items-start", null, 4, [["justify-items", "start"]]], [".gap-0", null, 4, [["gap", "0"]]], [".gap-0\\.5", null, 4, [["gap", "calc(var(--spacing) * .5)"]]], [".gap-1", null, 4, [["gap", "var(--spacing)"]]], [".gap-1\\.5", null, 4, [["gap", "calc(var(--spacing) * 1.5)"]]], [".gap-2", null, 4, [["gap", "calc(var(--spacing) * 2)"]]], [".gap-3", null, 4, [["gap", "calc(var(--spacing) * 3)"]]], [".gap-4", null, 4, [["gap", "calc(var(--spacing) * 4)"]]], [".gap-6", null, 4, [["gap", "calc(var(--spacing) * 6)"]]], [".gap-\\[0\\.1rem\\]", null, 4, [["gap", ".1rem"]]], [".gap-\\[0\\.3rem\\]", null, 4, [["gap", ".3rem"]]], [".gap-\\[0\\.4rem\\]", null, 4, [["gap", ".4rem"]]], [".gap-\\[0\\.05rem\\]", null, 4, [["gap", ".05rem"]]], [".gap-\\[0\\.6rem\\]", null, 4, [["gap", ".6rem"]]], [".gap-\\[0\\.8rem\\]", null, 4, [["gap", ".8rem"]]], [".gap-\\[0\\.16rem\\]", null, 4, [["gap", ".16rem"]]], [".gap-\\[0\\.32rem\\]", null, 4, [["gap", ".32rem"]]], [".gap-\\[0\\.35rem\\]", null, 4, [["gap", ".35rem"]]], [".gap-\\[0\\.45rem\\]", null, 4, [["gap", ".45rem"]]], [".gap-\\[0\\.55rem\\]", null, 4, [["gap", ".55rem"]]], [".gap-\\[0\\.65rem\\]", null, 4, [["gap", ".65rem"]]], [".gap-\\[0\\.85rem\\]", null, 4, [["gap", ".85rem"]]], [".gap-\\[1px\\]", null, 4, [["gap", "1px"]]], [".gap-\\[2px\\]", null, 4, [["gap", "2px"]]], [".gap-\\[3px\\]", null, 4, [["gap", "3px"]]], [".gap-\\[7px\\]", null, 4, [["gap", "7px"]]], [".gap-\\[13px\\]", null, 4, [["gap", "13px"]]], [":where(.space-y-0\\.5 > :not(:last-child))", null, 4, [["--tw-space-y-reverse", "0"], ["margin-block-start", "calc(calc(var(--spacing) * .5) * var(--tw-space-y-reverse))"], ["margin-block-end", "calc(calc(var(--spacing) * .5) * calc(1 - var(--tw-space-y-reverse)))"]]], [".gap-x-3", null, 4, [["column-gap", "calc(var(--spacing) * 3)"]]], [".gap-x-4", null, 4, [["column-gap", "calc(var(--spacing) * 4)"]]], [".gap-x-\\[0\\.7rem\\]", null, 4, [["column-gap", ".7rem"]]], [".gap-x-\\[0\\.9rem\\]", null, 4, [["column-gap", ".9rem"]]], [".gap-y-1", null, 4, [["row-gap", "var(--spacing)"]]], [".gap-y-\\[0\\.3rem\\]", null, 4, [["row-gap", ".3rem"]]], [".self-center", null, 4, [["align-self", "center"]]], [".self-end", null, 4, [["align-self", "flex-end"]]], [".self-start", null, 4, [["align-self", "flex-start"]]], [".self-stretch", null, 4, [["align-self", "stretch"]]], [".justify-self-start", null, 4, [["justify-self", "flex-start"]]], [".truncate", null, 4, [["text-overflow", "ellipsis"], ["white-space", "nowrap"], ["overflow", "hidden"]]], [".overflow-auto", null, 4, [["overflow", "auto"]]], [".overflow-hidden", null, 4, [["overflow", "hidden"]]], [".overflow-visible", null, 4, [["overflow", "visible"]]], [".overflow-x-auto", null, 4, [["overflow-x", "auto"]]], [".overflow-y-auto", null, 4, [["overflow-y", "auto"]]], [".overscroll-contain", null, 4, [["overscroll-behavior", "contain"]]], [".rounded, .rounded-\\[0\\.25rem\\]", null, 4, [["border-radius", ".25rem"]]], [".rounded-\\[1\\.5rem\\]", null, 4, [["border-radius", "1.5rem"]]], [".rounded-\\[2px\\]", null, 4, [["border-radius", "2px"]]], [".rounded-\\[3px\\]", null, 4, [["border-radius", "3px"]]], [".rounded-\\[12px\\]", null, 4, [["border-radius", "12px"]]], [".rounded-\\[50\\%\\]", null, 4, [["border-radius", "50%"]]], [".rounded-\\[999px\\]", null, 4, [["border-radius", "999px"]]], [".rounded-\\[calc\\(var\\(--radius\\)\\*2\\)\\]", null, 4, [["border-radius", "calc(var(--radius) * 2)"]]], [".rounded-\\[var\\(--card-radius\\,8px\\)\\]", null, 4, [["border-radius", "var(--card-radius, 8px)"]]], [".rounded-\\[var\\(--card-radius\\,12px\\)\\]", null, 4, [["border-radius", "var(--card-radius, 12px)"]]], [".rounded-full", null, 4, [["border-radius", "3.40282e38px"]]], [".rounded-none", null, 4, [["border-radius", "0"]]], [".rounded-soft", null, 4, [["border-radius", "var(--radius-pane)"]]], [".rounded-ui", null, 4, [["border-radius", "var(--radius)"]]], [".rounded-t-\\[12px\\]", null, 4, [["border-top-left-radius", "12px"], ["border-top-right-radius", "12px"]]], [".rounded-t-none", null, 4, [["border-top-left-radius", "0"], ["border-top-right-radius", "0"]]], [".rounded-bl-\\[6px\\]", null, 4, [["border-bottom-left-radius", "6px"]]], [".border", null, 4, [["border-style", "var(--tw-border-style)"], ["border-width", "1px"]]], [".border-0", null, 4, [["border-style", "var(--tw-border-style)"], ["border-width", "0"]]], [".border-\\[1\\.5px\\]", null, 4, [["border-style", "var(--tw-border-style)"], ["border-width", "1.5px"]]], [".border-b", null, 4, [["border-bottom-style", "var(--tw-border-style)"], ["border-bottom-width", "1px"]]], [".border-l", null, 4, [["border-left-style", "var(--tw-border-style)"], ["border-left-width", "1px"]]], [".border-l-\\[3px\\]", null, 4, [["border-left-style", "var(--tw-border-style)"], ["border-left-width", "3px"]]], [".border-solid", null, 4, [["--tw-border-style", "solid"], ["border-style", "solid"]]], [".border-accent", null, 4, [["border-color", "var(--accent)"]]], [".border-overlay-0", null, 4, [["border-color", "var(--overlay-0)"]]], [".border-overlay-1", null, 4, [["border-color", "var(--overlay-1)"]]], [".border-red", null, 4, [["border-color", "var(--red)"]]], [".border-subtext-0", null, 4, [["border-color", "var(--subtext-0)"]]], [".border-surface-1", null, 4, [["border-color", "var(--surface-1)"]]], [".border-teal", null, 4, [["border-color", "var(--teal)"]]], [".border-yellow", null, 4, [["border-color", "var(--yellow)"]]], [".border-l-accent", null, 4, [["border-left-color", "var(--accent)"]]], [".border-l-green", null, 4, [["border-left-color", "var(--green)"]]], [".border-l-red", null, 4, [["border-left-color", "var(--red)"]]], [".border-l-yellow", null, 4, [["border-left-color", "var(--yellow)"]]], [".bg-\\[\\#161616\\]", null, 4, [["background-color", "#161616"]]], [".bg-\\[\\#fff\\]", null, 4, [["background-color", "#fff"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_8\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "var(--accent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_8\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--accent) 8%,var(--panel-bg))"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_12\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--accent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_12\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--accent) 12%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--accent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--accent) 15%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--blue\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--blue)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--blue\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--blue) 15%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--green\\)_9\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--green)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--green\\)_9\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--green) 9%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--red\\)_7\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--red)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--red\\)_7\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--red) 7%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--red\\)_9\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--red)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--red\\)_9\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--red) 9%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--surface-1\\)_42\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--surface-1\\)_42\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--surface-1) 42%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--surface-1\\)_70\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--surface-1\\)_70\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--surface-1) 70%,var(--panel-bg))"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--text\\)_10\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "var(--text)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--text\\)_10\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--text) 10%,var(--panel-bg))"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--yellow\\)_8\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--yellow)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--yellow\\)_8\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--yellow) 8%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--yellow\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--yellow)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--yellow\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--yellow) 15%,transparent)"]]], [".bg-\\[rgba\\(0\\,0\\,0\\,0\\.5\\)\\]", null, 4, [["background-color", "#00000080"]]], [".bg-\\[rgba\\(0\\,0\\,0\\,0\\.7\\)\\]", null, 4, [["background-color", "#000000b3"]]], [".bg-\\[rgba\\(0\\,0\\,0\\,0\\.55\\)\\]", null, 4, [["background-color", "#0000008c"]]], [".bg-\\[rgba\\(0\\,0\\,0\\,0\\.62\\)\\]", null, 4, [["background-color", "#0000009e"]]], [".bg-\\[var\\(--accent\\)\\]", null, 4, [["background-color", "var(--accent)"]]], [".bg-\\[var\\(--backdrop\\)\\]", null, 4, [["background-color", "var(--backdrop)"]]], [".bg-\\[var\\(--bg\\)\\]", null, 4, [["background-color", "var(--bg)"]]], [".bg-\\[var\\(--card-bg\\)\\]", null, 4, [["background-color", "var(--card-bg)"]]], [".bg-\\[var\\(--picker-bg\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "var(--picker-bg, var(--panel-bg))"]]], [".bg-\\[var\\(--surface-1\\)\\]", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-\\[var\\(--workspace-tools-bg\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "var(--workspace-tools-bg, var(--panel-bg))"]]], [".bg-accent, .bg-accent\\/10", null, 4, [["background-color", "var(--accent)"]]], [".bg-accent\\/10", null, 4, [["background-color", "color-mix(in oklab, var(--accent) 10%, transparent)"]]], [".bg-accent\\/35", null, 4, [["background-color", "var(--accent)"]]], [".bg-accent\\/35", null, 4, [["background-color", "color-mix(in oklab, var(--accent) 35%, transparent)"]]], [".bg-fg", null, 4, [["background-color", "var(--text)"]]], [".bg-green, .bg-green\\/15", null, 4, [["background-color", "var(--green)"]]], [".bg-green\\/15", null, 4, [["background-color", "color-mix(in oklab, var(--green) 15%, transparent)"]]], [".bg-overlay-0", null, 4, [["background-color", "var(--overlay-0)"]]], [".bg-overlay-1", null, 4, [["background-color", "var(--overlay-1)"]]], [".bg-panel-bg", null, 4, [["background-color", "var(--panel-bg)"]]], [".bg-red, .bg-red\\/15", null, 4, [["background-color", "var(--red)"]]], [".bg-red\\/15", null, 4, [["background-color", "color-mix(in oklab, var(--red) 15%, transparent)"]]], [".bg-subtext-0", null, 4, [["background-color", "var(--subtext-0)"]]], [".bg-surface-0", null, 4, [["background-color", "var(--surface-0)"]]], [".bg-surface-1, .bg-surface-1\\/30", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-surface-1\\/30", null, 4, [["background-color", "color-mix(in oklab, var(--surface-1) 30%, transparent)"]]], [".bg-surface-1\\/60", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-surface-1\\/60", null, 4, [["background-color", "color-mix(in oklab, var(--surface-1) 60%, transparent)"]]], [".bg-surface-1\\/70", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-surface-1\\/70", null, 4, [["background-color", "color-mix(in oklab, var(--surface-1) 70%, transparent)"]]], [".bg-transparent", null, 4, [["background-color", "#0000"]]], [".bg-yellow", null, 4, [["background-color", "var(--yellow)"]]], [".object-contain", null, 4, [["object-fit", "contain"]]], [".object-cover", null, 4, [["object-fit", "cover"]]], [".p-0", null, 4, [["padding", "0"]]], [".p-0\\.5", null, 4, [["padding", "calc(var(--spacing) * .5)"]]], [".p-1", null, 4, [["padding", "var(--spacing)"]]], [".p-2", null, 4, [["padding", "calc(var(--spacing) * 2)"]]], [".p-3", null, 4, [["padding", "calc(var(--spacing) * 3)"]]], [".p-4", null, 4, [["padding", "calc(var(--spacing) * 4)"]]], [".p-5", null, 4, [["padding", "calc(var(--spacing) * 5)"]]], [".p-6", null, 4, [["padding", "calc(var(--spacing) * 6)"]]], [".p-\\[0\\.2rem\\]", null, 4, [["padding", ".2rem"]]], [".p-\\[0\\.4rem\\]", null, 4, [["padding", ".4rem"]]], [".p-\\[0\\.5rem\\]", null, 4, [["padding", ".5rem"]]], [".p-\\[0\\.9rem\\]", null, 4, [["padding", ".9rem"]]], [".p-\\[0\\.45rem\\]", null, 4, [["padding", ".45rem"]]], [".p-\\[0\\.55rem\\]", null, 4, [["padding", ".55rem"]]], [".p-\\[0\\.65rem\\]", null, 4, [["padding", ".65rem"]]], [".p-\\[2px\\]", null, 4, [["padding", "2px"]]], [".px-0", null, 4, [["padding-inline", "0"]]], [".px-1", null, 4, [["padding-inline", "var(--spacing)"]]], [".px-1\\.5", null, 4, [["padding-inline", "calc(var(--spacing) * 1.5)"]]], [".px-2", null, 4, [["padding-inline", "calc(var(--spacing) * 2)"]]], [".px-3", null, 4, [["padding-inline", "calc(var(--spacing) * 3)"]]], [".px-3\\.5", null, 4, [["padding-inline", "calc(var(--spacing) * 3.5)"]]], [".px-4", null, 4, [["padding-inline", "calc(var(--spacing) * 4)"]]], [".px-8", null, 4, [["padding-inline", "calc(var(--spacing) * 8)"]]], [".px-\\[0\\.2rem\\]", null, 4, [["padding-inline", ".2rem"]]], [".px-\\[0\\.3rem\\]", null, 4, [["padding-inline", ".3rem"]]], [".px-\\[0\\.4rem\\]", null, 4, [["padding-inline", ".4rem"]]], [".px-\\[0\\.5rem\\]", null, 4, [["padding-inline", ".5rem"]]], [".px-\\[0\\.6rem\\]", null, 4, [["padding-inline", ".6rem"]]], [".px-\\[0\\.7rem\\]", null, 4, [["padding-inline", ".7rem"]]], [".px-\\[0\\.8rem\\]", null, 4, [["padding-inline", ".8rem"]]], [".px-\\[0\\.9rem\\]", null, 4, [["padding-inline", ".9rem"]]], [".px-\\[0\\.26rem\\]", null, 4, [["padding-inline", ".26rem"]]], [".px-\\[0\\.28rem\\]", null, 4, [["padding-inline", ".28rem"]]], [".px-\\[0\\.35rem\\]", null, 4, [["padding-inline", ".35rem"]]], [".px-\\[0\\.42rem\\]", null, 4, [["padding-inline", ".42rem"]]], [".px-\\[0\\.45rem\\]", null, 4, [["padding-inline", ".45rem"]]], [".px-\\[0\\.48rem\\]", null, 4, [["padding-inline", ".48rem"]]], [".px-\\[0\\.55rem\\]", null, 4, [["padding-inline", ".55rem"]]], [".px-\\[0\\.65rem\\]", null, 4, [["padding-inline", ".65rem"]]], [".px-\\[0\\.75rem\\]", null, 4, [["padding-inline", ".75rem"]]], [".px-\\[0\\.85rem\\]", null, 4, [["padding-inline", ".85rem"]]], [".px-\\[1\\.4rem\\]", null, 4, [["padding-inline", "1.4rem"]]], [".px-\\[3px\\]", null, 4, [["padding-inline", "3px"]]], [".px-\\[10px\\]", null, 4, [["padding-inline", "10px"]]], [".py-0", null, 4, [["padding-block", "0"]]], [".py-0\\.5", null, 4, [["padding-block", "calc(var(--spacing) * .5)"]]], [".py-1", null, 4, [["padding-block", "var(--spacing)"]]], [".py-1\\.5", null, 4, [["padding-block", "calc(var(--spacing) * 1.5)"]]], [".py-2", null, 4, [["padding-block", "calc(var(--spacing) * 2)"]]], [".py-3", null, 4, [["padding-block", "calc(var(--spacing) * 3)"]]], [".py-4", null, 4, [["padding-block", "calc(var(--spacing) * 4)"]]], [".py-8", null, 4, [["padding-block", "calc(var(--spacing) * 8)"]]], [".py-\\[0\\.1rem\\]", null, 4, [["padding-block", ".1rem"]]], [".py-\\[0\\.2rem\\]", null, 4, [["padding-block", ".2rem"]]], [".py-\\[0\\.3rem\\]", null, 4, [["padding-block", ".3rem"]]], [".py-\\[0\\.4rem\\]", null, 4, [["padding-block", ".4rem"]]], [".py-\\[0\\.05rem\\]", null, 4, [["padding-block", ".05rem"]]], [".py-\\[0\\.6rem\\]", null, 4, [["padding-block", ".6rem"]]], [".py-\\[0\\.8rem\\]", null, 4, [["padding-block", ".8rem"]]], [".py-\\[0\\.12rem\\]", null, 4, [["padding-block", ".12rem"]]], [".py-\\[0\\.14rem\\]", null, 4, [["padding-block", ".14rem"]]], [".py-\\[0\\.15rem\\]", null, 4, [["padding-block", ".15rem"]]], [".py-\\[0\\.18rem\\]", null, 4, [["padding-block", ".18rem"]]], [".py-\\[0\\.25rem\\]", null, 4, [["padding-block", ".25rem"]]], [".py-\\[0\\.28rem\\]", null, 4, [["padding-block", ".28rem"]]], [".py-\\[0\\.32rem\\]", null, 4, [["padding-block", ".32rem"]]], [".py-\\[0\\.35rem\\]", null, 4, [["padding-block", ".35rem"]]], [".py-\\[0\\.42rem\\]", null, 4, [["padding-block", ".42rem"]]], [".py-\\[0\\.45rem\\]", null, 4, [["padding-block", ".45rem"]]], [".py-\\[0\\.55rem\\]", null, 4, [["padding-block", ".55rem"]]], [".py-\\[0\\.65rem\\]", null, 4, [["padding-block", ".65rem"]]], [".py-\\[2px\\]", null, 4, [["padding-block", "2px"]]], [".py-\\[3px\\]", null, 4, [["padding-block", "3px"]]], [".py-\\[6px\\]", null, 4, [["padding-block", "6px"]]], [".py-px", null, 4, [["padding-block", "1px"]]], [".pt-1", null, 4, [["padding-top", "var(--spacing)"]]], [".pt-2", null, 4, [["padding-top", "calc(var(--spacing) * 2)"]]], [".pt-2\\.5", null, 4, [["padding-top", "calc(var(--spacing) * 2.5)"]]], [".pt-3", null, 4, [["padding-top", "calc(var(--spacing) * 3)"]]], [".pt-4", null, 4, [["padding-top", "calc(var(--spacing) * 4)"]]], [".pt-5", null, 4, [["padding-top", "calc(var(--spacing) * 5)"]]], [".pt-\\[0\\.2rem\\]", null, 4, [["padding-top", ".2rem"]]], [".pt-\\[0\\.4rem\\]", null, 4, [["padding-top", ".4rem"]]], [".pt-\\[0\\.6rem\\]", null, 4, [["padding-top", ".6rem"]]], [".pt-\\[0\\.85rem\\]", null, 4, [["padding-top", ".85rem"]]], [".pt-\\[2px\\]", null, 4, [["padding-top", "2px"]]], [".pt-\\[12vh\\]", null, 4, [["padding-top", "12vh"]]], [".pt-\\[max\\(0\\.5rem\\,env\\(safe-area-inset-top\\)\\)\\]", null, 4, [["padding-top", "max(.5rem, env(safe-area-inset-top))"]]], [".pr-0\\.5", null, 4, [["padding-right", "calc(var(--spacing) * .5)"]]], [".pr-1", null, 4, [["padding-right", "var(--spacing)"]]], [".pr-1\\.5", null, 4, [["padding-right", "calc(var(--spacing) * 1.5)"]]], [".pr-2", null, 4, [["padding-right", "calc(var(--spacing) * 2)"]]], [".pr-3", null, 4, [["padding-right", "calc(var(--spacing) * 3)"]]], [".pr-12", null, 4, [["padding-right", "calc(var(--spacing) * 12)"]]], [".pr-\\[0\\.3rem\\]", null, 4, [["padding-right", ".3rem"]]], [".pr-\\[0\\.6rem\\]", null, 4, [["padding-right", ".6rem"]]], [".pr-\\[0\\.35rem\\]", null, 4, [["padding-right", ".35rem"]]], [".pr-\\[0\\.45rem\\]", null, 4, [["padding-right", ".45rem"]]], [".pr-\\[0\\.55rem\\]", null, 4, [["padding-right", ".55rem"]]], [".pr-\\[1\\.6rem\\]", null, 4, [["padding-right", "1.6rem"]]], [".pr-\\[3px\\]", null, 4, [["padding-right", "3px"]]], [".pr-\\[env\\(safe-area-inset-right\\)\\]", null, 4, [["padding-right", "env(safe-area-inset-right)"]]], [".pr-\\[max\\(0\\.5rem\\,env\\(safe-area-inset-right\\)\\)\\]", null, 4, [["padding-right", "max(.5rem, env(safe-area-inset-right))"]]], [".pb-1", null, 4, [["padding-bottom", "var(--spacing)"]]], [".pb-2", null, 4, [["padding-bottom", "calc(var(--spacing) * 2)"]]], [".pb-3", null, 4, [["padding-bottom", "calc(var(--spacing) * 3)"]]], [".pb-4", null, 4, [["padding-bottom", "calc(var(--spacing) * 4)"]]], [".pb-8", null, 4, [["padding-bottom", "calc(var(--spacing) * 8)"]]], [".pb-\\[0\\.3rem\\]", null, 4, [["padding-bottom", ".3rem"]]], [".pb-\\[0\\.4rem\\]", null, 4, [["padding-bottom", ".4rem"]]], [".pb-\\[0\\.25rem\\]", null, 4, [["padding-bottom", ".25rem"]]], [".pb-\\[0\\.55rem\\]", null, 4, [["padding-bottom", ".55rem"]]], [".pb-\\[1\\.4rem\\]", null, 4, [["padding-bottom", "1.4rem"]]], [".pb-\\[calc\\(1\\.5rem\\+env\\(safe-area-inset-bottom\\)\\)\\]", null, 4, [["padding-bottom", "calc(1.5rem + env(safe-area-inset-bottom))"]]], [".pb-\\[calc\\(1rem\\+env\\(safe-area-inset-bottom\\)\\)\\]", null, 4, [["padding-bottom", "calc(1rem + env(safe-area-inset-bottom))"]]], [".pb-\\[env\\(safe-area-inset-bottom\\)\\]", null, 4, [["padding-bottom", "env(safe-area-inset-bottom)"]]], [".pb-\\[max\\(0\\.5rem\\,env\\(safe-area-inset-bottom\\)\\)\\]", null, 4, [["padding-bottom", "max(.5rem, env(safe-area-inset-bottom))"]]], [".pl-1", null, 4, [["padding-left", "var(--spacing)"]]], [".pl-1\\.5", null, 4, [["padding-left", "calc(var(--spacing) * 1.5)"]]], [".pl-2", null, 4, [["padding-left", "calc(var(--spacing) * 2)"]]], [".pl-3", null, 4, [["padding-left", "calc(var(--spacing) * 3)"]]], [".pl-4", null, 4, [["padding-left", "calc(var(--spacing) * 4)"]]], [".pl-5", null, 4, [["padding-left", "calc(var(--spacing) * 5)"]]], [".pl-6", null, 4, [["padding-left", "calc(var(--spacing) * 6)"]]], [".pl-\\[0\\.4rem\\]", null, 4, [["padding-left", ".4rem"]]], [".pl-\\[0\\.45rem\\]", null, 4, [["padding-left", ".45rem"]]], [".pl-\\[0\\.75rem\\]", null, 4, [["padding-left", ".75rem"]]], [".pl-\\[0\\.85rem\\]", null, 4, [["padding-left", ".85rem"]]], [".pl-\\[1\\.2rem\\]", null, 4, [["padding-left", "1.2rem"]]], [".pl-\\[1\\.55rem\\]", null, 4, [["padding-left", "1.55rem"]]], [".pl-\\[1\\.075rem\\]", null, 4, [["padding-left", "1.075rem"]]], [".pl-\\[1\\.525rem\\]", null, 4, [["padding-left", "1.525rem"]]], [".pl-\\[1\\.875rem\\]", null, 4, [["padding-left", "1.875rem"]]], [".pl-\\[85px\\]", null, 4, [["padding-left", "85px"]]], [".pl-\\[max\\(0\\.5rem\\,env\\(safe-area-inset-left\\)\\)\\]", null, 4, [["padding-left", "max(.5rem, env(safe-area-inset-left))"]]], [".pl-\\[max\\(0\\.25rem\\,env\\(safe-area-inset-left\\)\\)\\]", null, 4, [["padding-left", "max(.25rem, env(safe-area-inset-left))"]]], [".text-center", null, 4, [["text-align", "center"]]], [".text-left", null, 4, [["text-align", "left"]]], [".text-right", null, 4, [["text-align", "right"]]], [".\\[font-family\\:inherit\\]", null, 4, [["font-family", "inherit"]]], [".\\[font-family\\:ui-monospace\\,SFMono-Regular\\,Menlo\\,monospace\\]", null, 4, [["font-family", "ui-monospace, SFMono-Regular, Menlo, monospace"]]], [".\\[font-family\\:var\\(--font-mono\\)\\]", null, 4, [["font-family", "var(--font-mono)"]]], [".text-sm", null, 4, [["font-size", "var(--text-sm)"], ["line-height", "var(--tw-leading, var(--text-sm--line-height))"]]], [".text-xs", null, 4, [["font-size", "var(--text-xs)"], ["line-height", "var(--tw-leading, var(--text-xs--line-height))"]]], [".\\[font-size\\:inherit\\]", null, 4, [["font-size", "inherit"]]], [".text-\\[0\\.6rem\\]", null, 4, [["font-size", ".6rem"]]], [".text-\\[0\\.7rem\\]", null, 4, [["font-size", ".7rem"]]], [".text-\\[0\\.8em\\]", null, 4, [["font-size", ".8em"]]], [".text-\\[0\\.8rem\\]", null, 4, [["font-size", ".8rem"]]], [".text-\\[0\\.9em\\]", null, 4, [["font-size", ".9em"]]], [".text-\\[0\\.9rem\\]", null, 4, [["font-size", ".9rem"]]], [".text-\\[0\\.54rem\\]", null, 4, [["font-size", ".54rem"]]], [".text-\\[0\\.58rem\\]", null, 4, [["font-size", ".58rem"]]], [".text-\\[0\\.62rem\\]", null, 4, [["font-size", ".62rem"]]], [".text-\\[0\\.63rem\\]", null, 4, [["font-size", ".63rem"]]], [".text-\\[0\\.64rem\\]", null, 4, [["font-size", ".64rem"]]], [".text-\\[0\\.65rem\\]", null, 4, [["font-size", ".65rem"]]], [".text-\\[0\\.66rem\\]", null, 4, [["font-size", ".66rem"]]], [".text-\\[0\\.66rem\\]\\!", null, 4, [["font-size", ".66rem", 1]]], [".text-\\[0\\.68rem\\]", null, 4, [["font-size", ".68rem"]]], [".text-\\[0\\.72rem\\]", null, 4, [["font-size", ".72rem"]]], [".text-\\[0\\.74rem\\]", null, 4, [["font-size", ".74rem"]]], [".text-\\[0\\.75rem\\]", null, 4, [["font-size", ".75rem"]]], [".text-\\[0\\.76rem\\]", null, 4, [["font-size", ".76rem"]]], [".text-\\[0\\.77rem\\]", null, 4, [["font-size", ".77rem"]]], [".text-\\[0\\.78rem\\]", null, 4, [["font-size", ".78rem"]]], [".text-\\[0\\.82rem\\]", null, 4, [["font-size", ".82rem"]]], [".text-\\[0\\.83rem\\]", null, 4, [["font-size", ".83rem"]]], [".text-\\[0\\.85rem\\]", null, 4, [["font-size", ".85rem"]]], [".text-\\[0\\.88rem\\]", null, 4, [["font-size", ".88rem"]]], [".text-\\[0\\.95rem\\]", null, 4, [["font-size", ".95rem"]]], [".text-\\[0\\.875rem\\]", null, 4, [["font-size", ".875rem"]]], [".text-\\[1\\.1rem\\]", null, 4, [["font-size", "1.1rem"]]], [".text-\\[1\\.4em\\]", null, 4, [["font-size", "1.4em"]]], [".text-\\[1\\.6rem\\]", null, 4, [["font-size", "1.6rem"]]], [".text-\\[1\\.15rem\\]", null, 4, [["font-size", "1.15rem"]]], [".text-\\[1rem\\]", null, 4, [["font-size", "1rem"]]], [".text-\\[2\\.4rem\\]", null, 4, [["font-size", "2.4rem"]]], [".text-\\[9px\\]", null, 4, [["font-size", "9px"]]], [".text-\\[10px\\]", null, 4, [["font-size", "10px"]]], [".text-\\[11px\\]", null, 4, [["font-size", "11px"]]], [".text-\\[12\\.5px\\]", null, 4, [["font-size", "12.5px"]]], [".text-\\[12px\\]", null, 4, [["font-size", "12px"]]], [".text-\\[13px\\]", null, 4, [["font-size", "13px"]]], [".text-\\[14px\\]", null, 4, [["font-size", "14px"]]], [".text-\\[calc\\(0\\.95rem\\*var\\(--chat-font-scale\\,1\\)\\)\\]", null, 4, [["font-size", "calc(.95rem * var(--chat-font-scale, 1))"]]], [".text-\\[length\\:calc\\(11px\\*var\\(--zoom\\,1\\)\\)\\]", null, 4, [["font-size", "calc(11px * var(--zoom, 1))"]]], [".text-\\[length\\:calc\\(13px\\*var\\(--zoom\\,1\\)\\)\\]", null, 4, [["font-size", "calc(13px * var(--zoom, 1))"]]], [".leading-4", null, 4, [["--tw-leading", "calc(var(--spacing) * 4)"], ["line-height", "calc(var(--spacing) * 4)"]]], [".leading-\\[1\\.1\\]", null, 4, [["--tw-leading", "1.1"], ["line-height", "1.1"]]], [".leading-\\[1\\.2\\]", null, 4, [["--tw-leading", "1.2"], ["line-height", "1.2"]]], [".leading-\\[1\\.3\\]", null, 4, [["--tw-leading", "1.3"], ["line-height", "1.3"]]], [".leading-\\[1\\.4\\]", null, 4, [["--tw-leading", "1.4"], ["line-height", "1.4"]]], [".leading-\\[1\\.5\\]", null, 4, [["--tw-leading", "1.5"], ["line-height", "1.5"]]], [".leading-\\[1\\.6\\]", null, 4, [["--tw-leading", "1.6"], ["line-height", "1.6"]]], [".leading-\\[1\\.45\\]", null, 4, [["--tw-leading", "1.45"], ["line-height", "1.45"]]], [".leading-\\[18px\\]", null, 4, [["--tw-leading", "18px"], ["line-height", "18px"]]], [".leading-none", null, 4, [["--tw-leading", "1"], ["line-height", "1"]]], [".leading-relaxed", null, 4, [["--tw-leading", "var(--leading-relaxed)"], ["line-height", "var(--leading-relaxed)"]]], [".leading-tight", null, 4, [["--tw-leading", "var(--leading-tight)"], ["line-height", "var(--leading-tight)"]]], [".\\[line-height\\:inherit\\]", null, 4, [["line-height", "inherit"]]], [".font-bold", null, 4, [["--tw-font-weight", "var(--font-weight-bold)"], ["font-weight", "var(--font-weight-bold)"]]], [".font-medium", null, 4, [["--tw-font-weight", "var(--font-weight-medium)"], ["font-weight", "var(--font-weight-medium)"]]], [".font-normal", null, 4, [["--tw-font-weight", "var(--font-weight-normal)"], ["font-weight", "var(--font-weight-normal)"]]], [".font-semibold", null, 4, [["--tw-font-weight", "var(--font-weight-semibold)"], ["font-weight", "var(--font-weight-semibold)"]]], [".\\[font-weight\\:inherit\\]", null, 4, [["font-weight", "inherit"]]], [".tracking-\\[-0\\.02em\\]", null, 4, [["--tw-tracking", "-.02em"], ["letter-spacing", "-.02em"]]], [".tracking-\\[0\\.03em\\]", null, 4, [["--tw-tracking", ".03em"], ["letter-spacing", ".03em"]]], [".tracking-\\[0\\.04em\\]", null, 4, [["--tw-tracking", ".04em"], ["letter-spacing", ".04em"]]], [".tracking-\\[0\\.06em\\]", null, 4, [["--tw-tracking", ".06em"], ["letter-spacing", ".06em"]]], [".tracking-\\[0\\.08em\\]", null, 4, [["--tw-tracking", ".08em"], ["letter-spacing", ".08em"]]], [".tracking-\\[0\\.09em\\]", null, 4, [["--tw-tracking", ".09em"], ["letter-spacing", ".09em"]]], [".tracking-\\[0\\.22em\\]", null, 4, [["--tw-tracking", ".22em"], ["letter-spacing", ".22em"]]], [".tracking-normal", null, 4, [["--tw-tracking", "var(--tracking-normal)"], ["letter-spacing", "var(--tracking-normal)"]]], [".tracking-wide", null, 4, [["--tw-tracking", "var(--tracking-wide)"], ["letter-spacing", "var(--tracking-wide)"]]], [".\\[overflow-wrap\\:anywhere\\]", null, 4, [["overflow-wrap", "anywhere"]]], [".break-words", null, 4, [["overflow-wrap", "break-word"]]], [".\\[word-break\\:break-word\\]", null, 4, [["word-break", "break-word"]]], [".text-ellipsis", null, 4, [["text-overflow", "ellipsis"]]], [".whitespace-normal", null, 4, [["white-space", "normal"]]], [".whitespace-nowrap", null, 4, [["white-space", "nowrap"]]], [".whitespace-pre", null, 4, [["white-space", "pre"]]], [".whitespace-pre-wrap", null, 4, [["white-space", "pre-wrap"]]], [".\\[tab-size\\:2\\]", null, 4, [["tab-size", "2"]]], [".text-\\[color\\:var\\(--git-muted\\)\\]", null, 4, [["color", "var(--git-muted)"]]], [".text-\\[var\\(--subtext-0\\)\\]", null, 4, [["color", "var(--subtext-0)"]]], [".text-\\[var\\(--text\\)\\]", null, 4, [["color", "var(--text)"]]], [".text-accent", null, 4, [["color", "var(--accent)"]]], [".text-blue", null, 4, [["color", "var(--blue)"]]], [".text-current", null, 4, [["color", "currentColor"]]], [".text-fg", null, 4, [["color", "var(--text)"]]], [".text-green", null, 4, [["color", "var(--green)"]]], [".text-inherit", null, 4, [["color", "inherit"]]], [".text-mauve", null, 4, [["color", "var(--mauve)"]]], [".text-overlay-0", null, 4, [["color", "var(--overlay-0)"]]], [".text-overlay-1", null, 4, [["color", "var(--overlay-1)"]]], [".text-panel-bg", null, 4, [["color", "var(--panel-bg)"]]], [".text-peach", null, 4, [["color", "var(--peach)"]]], [".text-red", null, 4, [["color", "var(--red)"]]], [".text-red\\!", null, 4, [["color", "var(--red)", 1]]], [".text-subtext-0", null, 4, [["color", "var(--subtext-0)"]]], [".text-yellow", null, 4, [["color", "var(--yellow)"]]], [".capitalize", null, 4, [["text-transform", "capitalize"]]], [".normal-case", null, 4, [["text-transform", "none"]]], [".uppercase", null, 4, [["text-transform", "uppercase"]]], [".italic", null, 4, [["font-style", "italic"]]], [".not-italic", null, 4, [["font-style", "normal"]]], [".tabular-nums", null, 4, [["--tw-numeric-spacing", "tabular-nums"], ["font-variant-numeric", "var(--tw-ordinal, ) var(--tw-slashed-zero, ) var(--tw-numeric-figure, ) var(--tw-numeric-spacing, ) var(--tw-numeric-fraction, )"]]], [".line-through", null, 4, [["text-decoration-line", "line-through"]]], [".no-underline", null, 4, [["text-decoration-line", "none"]]], [".underline", null, 4, [["text-decoration-line", "underline"]]], [".opacity-0", null, 4, [["opacity", "0"]]], [".opacity-40", null, 4, [["opacity", ".4"]]], [".opacity-60", null, 4, [["opacity", ".6"]]], [".opacity-70", null, 4, [["opacity", ".7"]]], [".opacity-75", null, 4, [["opacity", ".75"]]], [".opacity-80", null, 4, [["opacity", ".8"]]], [".opacity-100", null, 4, [["opacity", "1"]]], [".opacity-\\[0\\.72\\]", null, 4, [["opacity", ".72"]]], [".shadow", null, 4, [["--tw-shadow", "0 1px 3px 0 var(--tw-shadow-color, #0000001a), 0 1px 2px -1px var(--tw-shadow-color, #0000001a)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_1px_4px_rgba\\(0\\,0\\,0\\,0\\.4\\)\\]", null, 4, [["--tw-shadow", "0 1px 4px var(--tw-shadow-color, #0006)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_2px_8px_rgba\\(0\\,0\\,0\\,0\\.4\\)\\]", null, 4, [["--tw-shadow", "0 2px 8px var(--tw-shadow-color, #0006)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_2px_8px_rgba\\(0\\,0\\,0\\,0\\.35\\)\\]", null, 4, [["--tw-shadow", "0 2px 8px var(--tw-shadow-color, #00000059)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_6px_20px_rgba\\(0\\,0\\,0\\,0\\.3\\)\\]", null, 4, [["--tw-shadow", "0 6px 20px var(--tw-shadow-color, #0000004d)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_8px_24px_rgba\\(0\\,0\\,0\\,0\\.35\\)\\]", null, 4, [["--tw-shadow", "0 8px 24px var(--tw-shadow-color, #00000059)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_8px_24px_rgba\\(0\\,0\\,0\\,0\\.45\\)\\]", null, 4, [["--tw-shadow", "0 8px 24px var(--tw-shadow-color, #00000073)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_8px_32px_rgba\\(0\\,0\\,0\\,0\\.5\\)\\]", null, 4, [["--tw-shadow", "0 8px 32px var(--tw-shadow-color, #00000080)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_12px_32px_rgba\\(0\\,0\\,0\\,0\\.5\\)\\]", null, 4, [["--tw-shadow", "0 12px 32px var(--tw-shadow-color, #00000080)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_16px_48px_rgba\\(0\\,0\\,0\\,0\\.55\\)\\]", null, 4, [["--tw-shadow", "0 16px 48px var(--tw-shadow-color, #0000008c)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[inset_0_0_24px_var\\(--accent\\)\\]", null, 4, [["--tw-shadow", "inset 0 0 24px var(--tw-shadow-color, var(--accent))"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-lg", null, 4, [["--tw-shadow", "0 10px 15px -3px var(--tw-shadow-color, #0000001a), 0 4px 6px -4px var(--tw-shadow-color, #0000001a)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".ring", null, 4, [["--tw-ring-shadow", "var(--tw-ring-inset, ) 0 0 0 calc(1px + var(--tw-ring-offset-width)) var(--tw-ring-color, currentcolor)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".\\[box-shadow\\:0_1px_2px_rgba\\(0\\,0\\,0\\,0\\.3\\)\\]", null, 4, [["box-shadow", "0 1px 2px #0000004d"]]], [".\\[box-shadow\\:0_4px_14px_rgba\\(0\\,0\\,0\\,0\\.35\\)\\]", null, 4, [["box-shadow", "0 4px 14px #00000059"]]], [".\\[box-shadow\\:none\\]", null, 4, [["box-shadow", "none"]]], [".\\[outline\\:none\\]", null, 4, [["outline", "none"]]], [".outline, .outline-1", null, 4, [["outline-style", "var(--tw-outline-style)"], ["outline-width", "1px"]]], [".outline-2", null, 4, [["outline-style", "var(--tw-outline-style)"], ["outline-width", "2px"]]], [".outline-accent", null, 4, [["outline-color", "var(--accent)"]]], [".blur", null, 4, [["--tw-blur", "blur(8px)"], ["filter", "var(--tw-blur, ) var(--tw-brightness, ) var(--tw-contrast, ) var(--tw-grayscale, ) var(--tw-hue-rotate, ) var(--tw-invert, ) var(--tw-saturate, ) var(--tw-sepia, ) var(--tw-drop-shadow, )"]]], [".\\!filter", null, 4, [["filter", "var(--tw-blur, ) var(--tw-brightness, ) var(--tw-contrast, ) var(--tw-grayscale, ) var(--tw-hue-rotate, ) var(--tw-invert, ) var(--tw-saturate, ) var(--tw-sepia, ) var(--tw-drop-shadow, )", 1]]], [".\\[filter\\:drop-shadow\\(0_6px_10px_rgba\\(0\\,0\\,0\\,0\\.45\\)\\)\\]", null, 4, [["filter", "drop-shadow(0 6px 10px #00000073)"]]], [".filter", null, 4, [["filter", "var(--tw-blur, ) var(--tw-brightness, ) var(--tw-contrast, ) var(--tw-grayscale, ) var(--tw-hue-rotate, ) var(--tw-invert, ) var(--tw-saturate, ) var(--tw-sepia, ) var(--tw-drop-shadow, )"]]], [".backdrop-blur-xl", null, 4, [["--tw-backdrop-blur", "blur(var(--blur-xl))"], ["-webkit-backdrop-filter", "var(--tw-backdrop-blur, ) var(--tw-backdrop-brightness, ) var(--tw-backdrop-contrast, ) var(--tw-backdrop-grayscale, ) var(--tw-backdrop-hue-rotate, ) var(--tw-backdrop-invert, ) var(--tw-backdrop-opacity, ) var(--tw-backdrop-saturate, ) var(--tw-backdrop-sepia, )"], ["backdrop-filter", "var(--tw-backdrop-blur, ) var(--tw-backdrop-brightness, ) var(--tw-backdrop-contrast, ) var(--tw-backdrop-grayscale, ) var(--tw-backdrop-hue-rotate, ) var(--tw-backdrop-invert, ) var(--tw-backdrop-opacity, ) var(--tw-backdrop-saturate, ) var(--tw-backdrop-sepia, )"]]], [".backdrop-saturate-150", null, 4, [["--tw-backdrop-saturate", "saturate(150%)"], ["-webkit-backdrop-filter", "var(--tw-backdrop-blur, ) var(--tw-backdrop-brightness, ) var(--tw-backdrop-contrast, ) var(--tw-backdrop-grayscale, ) var(--tw-backdrop-hue-rotate, ) var(--tw-backdrop-invert, ) var(--tw-backdrop-opacity, ) var(--tw-backdrop-saturate, ) var(--tw-backdrop-sepia, )"], ["backdrop-filter", "var(--tw-backdrop-blur, ) var(--tw-backdrop-brightness, ) var(--tw-backdrop-contrast, ) var(--tw-backdrop-grayscale, ) var(--tw-backdrop-hue-rotate, ) var(--tw-backdrop-invert, ) var(--tw-backdrop-opacity, ) var(--tw-backdrop-saturate, ) var(--tw-backdrop-sepia, )"]]], [".transition", null, 4, [["transition-property", "color, background-color, border-color, outline-color, text-decoration-color, fill, stroke, --tw-gradient-from, --tw-gradient-via, --tw-gradient-to, opacity, box-shadow, transform, translate, scale, rotate, filter, -webkit-backdrop-filter, backdrop-filter, display, content-visibility, overlay, pointer-events"], ["transition-timing-function", "var(--tw-ease, var(--default-transition-timing-function))"], ["transition-duration", "var(--tw-duration, var(--default-transition-duration))"]]], [".transition-\\[left\\,top\\,width\\,height\\]", null, 4, [["transition-property", "left, top, width, height"], ["transition-timing-function", "var(--tw-ease, var(--default-transition-timing-function))"], ["transition-duration", "var(--tw-duration, var(--default-transition-duration))"]]], [".transition-opacity", null, 4, [["transition-property", "opacity"], ["transition-timing-function", "var(--tw-ease, var(--default-transition-timing-function))"], ["transition-duration", "var(--tw-duration, var(--default-transition-duration))"]]], [".duration-150", null, 4, [["--tw-duration", ".15s"], ["transition-duration", ".15s"]]], [".ease-out", null, 4, [["--tw-ease", "var(--ease-out)"], ["transition-timing-function", "var(--ease-out)"]]], [".outline-none", null, 4, [["--tw-outline-style", "none"], ["outline-style", "none"]]], [".outline-solid", null, 4, [["--tw-outline-style", "solid"], ["outline-style", "solid"]]], [".select-none", null, 4, [["-webkit-user-select", "none"], ["user-select", "none"]]], [".select-text", null, 4, [["-webkit-user-select", "text"], ["user-select", "text"]]], [".\\[--panel-bg\\:var\\(--surface-dim\\)\\]", null, 4, [["--panel-bg", "var(--surface-dim)"]]], [".\\[--picker-bg\\:var\\(--surface-0\\)\\]", null, 4, [["--picker-bg", "var(--surface-0)"]]], [".\\[--radius\\:var\\(--radius-pane\\)\\]", null, 4, [["--radius", "var(--radius-pane)"]]], [".\\[--workspace-tools-bg\\:transparent\\]", null, 4, [["--workspace-tools-bg", "transparent"]]], [".\\[-webkit-box-orient\\:vertical\\]", null, 4, [["-webkit-box-orient", "vertical"]]], [".\\[-webkit-line-clamp\\:3\\]", null, 4, [["-webkit-line-clamp", "3"]]], [".\\[-webkit-touch-callout\\:none\\]", null, 4, [["-webkit-touch-callout", "none"]]], [".\\[background\\:none\\]", null, 4, [["background", "none"]]], [".\\[border-right\\:1px_solid_var\\(--git-border\\)\\]", null, 4, [["border-right", "1px solid var(--git-border)"]]], [".\\[border-top\\:1px_solid_var\\(--git-border\\)\\]", null, 4, [["border-top", "1px solid var(--git-border)"]]], [".\\[border\\:0\\]", null, 4, [["border", "0"]]], [".\\[border\\:none\\]", null, 4, [["border", "none"]]], [".\\[font\\:1\\.15rem\\/1_var\\(--font-mono\\)\\]", null, 4, [["font", "1.15rem/1 var(--font-mono)"]]], [".\\[font\\:1rem\\/1\\.2_var\\(--font-mono\\)\\]", null, 4, [["font", "1rem/1.2 var(--font-mono)"]]], [".\\[font\\:inherit\\]", null, 4, [["font", "inherit"]]], [".\\[transition\\:background_0\\.1s_ease\\]", null, 4, [["transition", "background .1s"]]], [".\\[transition\\:background_0\\.12s_ease\\]", null, 4, [["transition", "background .12s"]]], [".\\[transition\\:background_0\\.15s_ease\\]", null, 4, [["transition", "background .15s"]]], [".\\[transition\\:color_0\\.1s_ease\\,background_0\\.1s_ease\\]", null, 4, [["transition", "color .1s, background .1s"]]], [".\\[transition\\:color_0\\.12s_ease\\,background_0\\.12s_ease\\]", null, 4, [["transition", "color .12s, background .12s"]]], [".\\[transition\\:color_0\\.15s_ease\\]", null, 4, [["transition", "color .15s"]]], [".\\[transition\\:opacity_0\\.12s_ease\\]", null, 4, [["transition", "opacity .12s"]]], [".\\[transition\\:transform_0\\.15s_ease\\,background_0\\.15s_ease\\]", null, 4, [["transition", "transform .15s, background .15s"]]], [".not-has-\\[\\[data-setting-row\\]\\]\\:hidden:not(:has([data-setting-row]))", null, 4, [["display", "none"]]], [".group-focus-within\\:flex:is(:where(.group):focus-within *)", null, 4, [["display", "flex"]]], [".group-focus-within\\/row\\:opacity-100:is(:where(.group\\/row):focus-within *)", null, 4, [["opacity", "1"]]], [".group-hover\\:flex:is(:where(.group):hover *)", null, 4, [["display", "flex"]]], [".group-hover\\:opacity-100:is(:where(.group):hover *)", null, 4, [["opacity", "1"]]], [".group-hover\\/line\\:opacity-90:is(:where(.group\\/line):hover *)", null, 4, [["opacity", ".9"]]], [".group-hover\\/ph\\:opacity-100:is(:where(.group\\/ph):hover *), .group-hover\\/row\\:opacity-100:is(:where(.group\\/row):hover *)", null, 4, [["opacity", "1"]]], [".group-hover\\/submenu\\:block:is(:where(.group\\/submenu):hover *)", null, 4, [["display", "block"]]], [".group-focus\\/tree\\:ring-1:is(:where(.group\\/tree):focus *)", null, 4, [["--tw-ring-shadow", "var(--tw-ring-inset, ) 0 0 0 calc(1px + var(--tw-ring-offset-width)) var(--tw-ring-color, currentcolor)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".group-focus\\/tree\\:ring-overlay-1:is(:where(.group\\/tree):focus *)", null, 4, [["--tw-ring-color", "var(--overlay-1)"]]], [".group-focus\\/tree\\:ring-inset:is(:where(.group\\/tree):focus *)", null, 4, [["--tw-ring-inset", "inset"]]], ['.group-aria-checked\\:\\[transform\\:translateX\\(1\\.1rem\\)\\]:is(:where(.group)[aria-checked="true"] *)', null, 4, [["transform", "translateX(1.1rem)"]]], ['.group-aria-checked\\:border-accent:is(:where(.group)[aria-checked="true"] *)', null, 4, [["border-color", "var(--accent)"]]], ['.group-aria-checked\\:bg-accent:is(:where(.group)[aria-checked="true"] *)', null, 4, [["background-color", "var(--accent)"]]], ['.group-aria-checked\\:bg-panel-bg:is(:where(.group)[aria-checked="true"] *)', null, 4, [["background-color", "var(--panel-bg)"]]], ['.group-aria-checked\\:text-accent:is(:where(.group)[aria-checked="true"] *), .group-aria-\\[checked\\=false\\]\\:text-accent:is(:where(.group)[aria-checked="false"] *)', null, 4, [["color", "var(--accent)"]]], [".placeholder\\:text-subtext-0::placeholder", null, 4, [["color", "var(--subtext-0)"]]], [".before\\:absolute:before", null, 4, [["content", "var(--tw-content)"], ["position", "absolute"]]], [".before\\:top-\\[0\\.15rem\\]:before", null, 4, [["content", "var(--tw-content)"], ["top", ".15rem"]]], [".before\\:left-\\[0\\.15rem\\]:before", null, 4, [["content", "var(--tw-content)"], ["left", ".15rem"]]], [".before\\:h-\\[0\\.95rem\\]:before", null, 4, [["content", "var(--tw-content)"], ["height", ".95rem"]]], [".before\\:w-\\[0\\.95rem\\]:before", null, 4, [["content", "var(--tw-content)"], ["width", ".95rem"]]], [".before\\:rounded-full:before", null, 4, [["content", "var(--tw-content)"], ["border-radius", "3.40282e38px"]]], [".before\\:bg-fg:before", null, 4, [["content", "var(--tw-content)"], ["background-color", "var(--text)"]]], [".before\\:content-\\[\\'\\'\\]:before", null, 4, [["--tw-content", '""'], ["content", "var(--tw-content)"]]], [".before\\:\\[transition\\:transform_0\\.12s_ease\\]:before", null, 4, [["content", "var(--tw-content)"], ["transition", "transform .12s"]]], [".after\\:absolute:after", null, 4, [["content", "var(--tw-content)"], ["position", "absolute"]]], [".after\\:inset-0:after", null, 4, [["content", "var(--tw-content)"], ["inset", "0"]]], [".after\\:inset-x-0:after", null, 4, [["content", "var(--tw-content)"], ["inset-inline", "0"]]], [".after\\:-inset-y-2:after", null, 4, [["content", "var(--tw-content)"], ["inset-block", "calc(var(--spacing) * -2)"]]], [".after\\:m-auto:after", null, 4, [["content", "var(--tw-content)"], ["margin", "auto"]]], [".after\\:h-8:after", null, 4, [["content", "var(--tw-content)"], ["height", "calc(var(--spacing) * 8)"]]], [".after\\:h-12:after", null, 4, [["content", "var(--tw-content)"], ["height", "calc(var(--spacing) * 12)"]]], [".after\\:h-\\[3px\\]:after", null, 4, [["content", "var(--tw-content)"], ["height", "3px"]]], [".after\\:w-8:after", null, 4, [["content", "var(--tw-content)"], ["width", "calc(var(--spacing) * 8)"]]], [".after\\:w-\\[3px\\]:after", null, 4, [["content", "var(--tw-content)"], ["width", "3px"]]], [".after\\:rounded-full:after", null, 4, [["content", "var(--tw-content)"], ["border-radius", "3.40282e38px"]]], [".after\\:bg-transparent:after", null, 4, [["content", "var(--tw-content)"], ["background-color", "#0000"]]], [".after\\:content-\\[\\'\\'\\]:after", null, 4, [["--tw-content", '""'], ["content", "var(--tw-content)"]]], [".last\\:border-b-0:last-child", null, 4, [["border-bottom-style", "var(--tw-border-style)"], ["border-bottom-width", "0"]]], [".checked\\:bg-accent:checked", null, 4, [["background-color", "var(--accent)"]]], [".checked\\:before\\:translate-x-\\[1rem\\]:checked:before", null, 4, [["content", "var(--tw-content)"], ["--tw-translate-x", "1rem"], ["translate", "var(--tw-translate-x) var(--tw-translate-y)"]]], [".checked\\:before\\:bg-panel-bg:checked:before", null, 4, [["content", "var(--tw-content)"], ["background-color", "var(--panel-bg)"]]], [".focus-within\\:bg-surface-1:focus-within", null, 4, [["background-color", "var(--surface-1)"]]], [".focus-within\\:outline:focus-within, .focus-within\\:outline-1:focus-within", null, 4, [["outline-style", "var(--tw-outline-style)"], ["outline-width", "1px"]]], [".focus-within\\:outline-fg:focus-within", null, 4, [["outline-color", "var(--text)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_12\\%\\,transparent\\)\\]:hover", null, 4, [["background-color", "var(--accent)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_12\\%\\,transparent\\)\\]:hover", null, 4, [["background-color", "color-mix(in srgb,var(--accent) 12%,transparent)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_15\\%\\,transparent\\)\\]:hover", null, 4, [["background-color", "var(--accent)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_15\\%\\,transparent\\)\\]:hover", null, 4, [["background-color", "color-mix(in srgb,var(--accent) 15%,transparent)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--text\\)_10\\%\\,var\\(--panel-bg\\)\\)\\]:hover", null, 4, [["background-color", "var(--text)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--text\\)_10\\%\\,var\\(--panel-bg\\)\\)\\]:hover", null, 4, [["background-color", "color-mix(in srgb,var(--text) 10%,var(--panel-bg))"]]], [".hover\\:bg-\\[var\\(--surface-0\\)\\]:hover", null, 4, [["background-color", "var(--surface-0)"]]], [".hover\\:bg-accent:hover", null, 4, [["background-color", "var(--accent)"]]], [".hover\\:bg-overlay-0:hover", null, 4, [["background-color", "var(--overlay-0)"]]], [".hover\\:bg-panel-bg:hover", null, 4, [["background-color", "var(--panel-bg)"]]], [".hover\\:bg-surface-0:hover", null, 4, [["background-color", "var(--surface-0)"]]], [".hover\\:bg-surface-1:hover", null, 4, [["background-color", "var(--surface-1)"]]], [".hover\\:bg-transparent:hover", null, 4, [["background-color", "#0000"]]], [".hover\\:text-accent:hover", null, 4, [["color", "var(--accent)"]]], [".hover\\:text-fg:hover", null, 4, [["color", "var(--text)"]]], [".hover\\:text-inherit:hover", null, 4, [["color", "inherit"]]], [".hover\\:text-overlay-0:hover", null, 4, [["color", "var(--overlay-0)"]]], [".hover\\:text-panel-bg:hover", null, 4, [["color", "var(--panel-bg)"]]], [".hover\\:text-red:hover", null, 4, [["color", "var(--red)"]]], [".hover\\:text-subtext-0:hover", null, 4, [["color", "var(--subtext-0)"]]], [".hover\\:text-yellow:hover", null, 4, [["color", "var(--yellow)"]]], [".hover\\:underline:hover", null, 4, [["text-decoration-line", "underline"]]], [".hover\\:opacity-60:hover", null, 4, [["opacity", ".6"]]], [".hover\\:opacity-100\\!:hover", null, 4, [["opacity", "1", 1]]], [".hover\\:opacity-\\[0\\.85\\]:hover", null, 4, [["opacity", ".85"]]], [".hover\\:brightness-110:hover", null, 4, [["--tw-brightness", "brightness(110%)"], ["filter", "var(--tw-blur, ) var(--tw-brightness, ) var(--tw-contrast, ) var(--tw-grayscale, ) var(--tw-hue-rotate, ) var(--tw-invert, ) var(--tw-saturate, ) var(--tw-sepia, ) var(--tw-drop-shadow, )"]]], [".hover\\:\\[filter\\:brightness\\(1\\.08\\)\\]:hover", null, 4, [["filter", "brightness(1.08)"]]], [".hover\\:after\\:bg-overlay-1:hover:after", null, 4, [["content", "var(--tw-content)"], ["background-color", "var(--overlay-1)"]]], [".focus\\:\\[outline\\:1px_solid_var\\(--accent\\)\\]:focus", null, 4, [["outline", "1px solid var(--accent)"]]], [".focus\\:outline-2:focus", null, 4, [["outline-style", "var(--tw-outline-style)"], ["outline-width", "2px"]]], [".focus\\:outline-none:focus", null, 4, [["--tw-outline-style", "none"], ["outline-style", "none"]]], [".focus-visible\\:bg-accent:focus-visible", null, 4, [["background-color", "var(--accent)"]]], [".focus-visible\\:bg-surface-0:focus-visible", null, 4, [["background-color", "var(--surface-0)"]]], [".focus-visible\\:bg-surface-1:focus-visible", null, 4, [["background-color", "var(--surface-1)"]]], [".focus-visible\\:text-accent:focus-visible", null, 4, [["color", "var(--accent)"]]], [".focus-visible\\:text-fg:focus-visible", null, 4, [["color", "var(--text)"]]], [".focus-visible\\:text-panel-bg:focus-visible", null, 4, [["color", "var(--panel-bg)"]]], [".focus-visible\\:text-red:focus-visible", null, 4, [["color", "var(--red)"]]], [".focus-visible\\:text-yellow:focus-visible", null, 4, [["color", "var(--yellow)"]]], [".focus-visible\\:underline:focus-visible", null, 4, [["text-decoration-line", "underline"]]], [".focus-visible\\:opacity-100:focus-visible", null, 4, [["opacity", "1"]]], [".focus-visible\\:\\[outline\\:1px_solid_var\\(--accent\\)\\]:focus-visible", null, 4, [["outline", "1px solid var(--accent)"]]], [".focus-visible\\:\\[outline\\:1px_solid_var\\(--overlay-1\\)\\]:focus-visible", null, 4, [["outline", "1px solid var(--overlay-1)"]]], [".focus-visible\\:\\[outline\\:2px_solid_var\\(--accent\\)\\]:focus-visible", null, 4, [["outline", "2px solid var(--accent)"]]], [".focus-visible\\:outline:focus-visible, .focus-visible\\:outline-1:focus-visible", null, 4, [["outline-style", "var(--tw-outline-style)"], ["outline-width", "1px"]]], [".focus-visible\\:\\[outline-offset\\:-1px\\]:focus-visible", null, 4, [["outline-offset", "-1px"]]], [".focus-visible\\:\\[outline-offset\\:-2px\\]:focus-visible", null, 4, [["outline-offset", "-2px"]]], [".focus-visible\\:\\[outline-offset\\:2px\\]:focus-visible", null, 4, [["outline-offset", "2px"]]], [".focus-visible\\:outline-offset-1:focus-visible", null, 4, [["outline-offset", "1px"]]], [".focus-visible\\:outline-fg:focus-visible", null, 4, [["outline-color", "var(--text)"]]], [".focus-visible\\:after\\:bg-accent:focus-visible:after", null, 4, [["content", "var(--tw-content)"], ["background-color", "var(--accent)"]]], [".active\\:cursor-grabbing:active", null, 4, [["cursor", "grabbing"]]], [".active\\:bg-surface-1:active", null, 4, [["background-color", "var(--surface-1)"]]], [".active\\:text-fg:active", null, 4, [["color", "var(--text)"]]], [".active\\:after\\:bg-accent:active:after", null, 4, [["content", "var(--tw-content)"], ["background-color", "var(--accent)"]]], [".enabled\\:hover\\:bg-surface-1:enabled:hover", null, 4, [["background-color", "var(--surface-1)"]]], [".enabled\\:hover\\:text-fg:enabled:hover", null, 4, [["color", "var(--text)"]]], [".disabled\\:cursor-default:disabled", null, 4, [["cursor", "default"]]], [".disabled\\:cursor-not-allowed:disabled", null, 4, [["cursor", "not-allowed"]]], [".disabled\\:cursor-not-allowed\\!:disabled", null, 4, [["cursor", "not-allowed", 1]]], [".disabled\\:cursor-wait:disabled", null, 4, [["cursor", "wait"]]], [".disabled\\:bg-transparent:disabled", null, 4, [["background-color", "#0000"]]], [".disabled\\:text-fg:disabled", null, 4, [["color", "var(--text)"]]], [".disabled\\:opacity-40:disabled", null, 4, [["opacity", ".4"]]], [".disabled\\:opacity-50:disabled", null, 4, [["opacity", ".5"]]], [".disabled\\:opacity-\\[0\\.45\\]:disabled", null, 4, [["opacity", ".45"]]], [".disabled\\:opacity-\\[0\\.55\\]:disabled", null, 4, [["opacity", ".55"]]], [":where(.app--mac-desktop) .in-\\[\\.app--mac-desktop\\]\\:pl-\\[84px\\]", null, 4, [["padding-left", "84px"]]], [".has-\\[\\:checked\\]\\:bg-surface-0:has(:checked)", null, 4, [["background-color", "var(--surface-0)"]]], [".has-\\[\\:checked\\]\\:text-fg:has(:checked)", null, 4, [["color", "var(--text)"]]], [".has-\\[\\:focus-visible\\]\\:bg-surface-0:has(:focus-visible)", null, 4, [["background-color", "var(--surface-0)"]]], ['.aria-disabled\\:cursor-not-allowed[aria-disabled="true"]', null, 4, [["cursor", "not-allowed"]]], ['.aria-disabled\\:opacity-40[aria-disabled="true"]', null, 4, [["opacity", ".4"]]], ['.aria-expanded\\:opacity-100[aria-expanded="true"]', null, 4, [["opacity", "1"]]], ['.aria-pressed\\:bg-surface-0[aria-pressed="true"]', null, 4, [["background-color", "var(--surface-0)"]]], ['.aria-pressed\\:text-fg[aria-pressed="true"]', null, 4, [["color", "var(--text)"]]], [".motion-reduce\\:animate-none", ["(prefers-reduced-motion: reduce)"], 4, [["animation", "none"]]], [".max-\\[900px\\]\\:hidden", ["not all and (min-width: 900px)"], 4, [["display", "none"]]], [".max-\\[700px\\]\\:hidden", ["not all and (min-width: 700px)"], 4, [["display", "none"]]], [".max-\\[700px\\]\\:size-11", ["not all and (min-width: 700px)"], 4, [["width", "calc(var(--spacing) * 11)"], ["height", "calc(var(--spacing) * 11)"]]], [".max-\\[700px\\]\\:h-9", ["not all and (min-width: 700px)"], 4, [["height", "calc(var(--spacing) * 9)"]]], [".max-\\[700px\\]\\:h-12", ["not all and (min-width: 700px)"], 4, [["height", "calc(var(--spacing) * 12)"]]], [".max-\\[700px\\]\\:min-h-9", ["not all and (min-width: 700px)"], 4, [["min-height", "calc(var(--spacing) * 9)"]]], [".max-\\[700px\\]\\:min-h-11", ["not all and (min-width: 700px)"], 4, [["min-height", "calc(var(--spacing) * 11)"]]], [".max-\\[700px\\]\\:w-24", ["not all and (min-width: 700px)"], 4, [["width", "calc(var(--spacing) * 24)"]]], [".max-\\[700px\\]\\:min-w-11", ["not all and (min-width: 700px)"], 4, [["min-width", "calc(var(--spacing) * 11)"]]], [".max-\\[700px\\]\\:flex-1", ["not all and (min-width: 700px)"], 4, [["flex", "1"]]], [".max-\\[700px\\]\\:flex-\\[1_1_6rem\\]", ["not all and (min-width: 700px)"], 4, [["flex", "6rem"]]], [".max-\\[700px\\]\\:flex-\\[1_1_100\\%\\]", ["not all and (min-width: 700px)"], 4, [["flex", "100%"]]], [".max-\\[700px\\]\\:basis-56", ["not all and (min-width: 700px)"], 4, [["flex-basis", "calc(var(--spacing) * 56)"]]], [".max-\\[700px\\]\\:basis-full", ["not all and (min-width: 700px)"], 4, [["flex-basis", "100%"]]], [".max-\\[700px\\]\\:flex-wrap", ["not all and (min-width: 700px)"], 4, [["flex-wrap", "wrap"]]], [".max-\\[700px\\]\\:gap-y-2", ["not all and (min-width: 700px)"], 4, [["row-gap", "calc(var(--spacing) * 2)"]]], [".min-\\[701px\\]\\:left-auto", ["(min-width: 701px)"], 4, [["left", "auto"]]], [".min-\\[701px\\]\\:my-\\[3px\\]", ["(min-width: 701px)"], 4, [["margin-block", "3px"]]], [".min-\\[701px\\]\\:block", ["(min-width: 701px)"], 4, [["display", "block"]]], [".min-\\[701px\\]\\:hidden", ["(min-width: 701px)"], 4, [["display", "none"]]], [".min-\\[701px\\]\\:min-h-6", ["(min-width: 701px)"], 4, [["min-height", "calc(var(--spacing) * 6)"]]], [".min-\\[701px\\]\\:w-80", ["(min-width: 701px)"], 4, [["width", "calc(var(--spacing) * 80)"]]], [".min-\\[701px\\]\\:rounded-ui", ["(min-width: 701px)"], 4, [["border-radius", "var(--radius)"]]], [".min-\\[701px\\]\\:px-3", ["(min-width: 701px)"], 4, [["padding-inline", "calc(var(--spacing) * 3)"]]], [".min-\\[701px\\]\\:px-4", ["(min-width: 701px)"], 4, [["padding-inline", "calc(var(--spacing) * 4)"]]], [".min-\\[701px\\]\\:pr-\\[3px\\]", ["(min-width: 701px)"], 4, [["padding-right", "3px"]]], [".min-\\[701px\\]\\:pl-4", ["(min-width: 701px)"], 4, [["padding-left", "calc(var(--spacing) * 4)"]]], [".min-\\[701px\\]\\:text-\\[0\\.62rem\\]", ["(min-width: 701px)"], 4, [["font-size", ".62rem"]]], [".min-\\[701px\\]\\:text-\\[12\\.5px\\]", ["(min-width: 701px)"], 4, [["font-size", "12.5px"]]], [".min-\\[701px\\]\\:text-\\[12px\\]", ["(min-width: 701px)"], 4, [["font-size", "12px"]]], [".min-\\[701px\\]\\:font-medium", ["(min-width: 701px)"], 4, [["--tw-font-weight", "var(--font-weight-medium)"], ["font-weight", "var(--font-weight-medium)"]]], [".min-\\[701px\\]\\:font-semibold", ["(min-width: 701px)"], 4, [["--tw-font-weight", "var(--font-weight-semibold)"], ["font-weight", "var(--font-weight-semibold)"]]], [".min-\\[701px\\]\\:tracking-\\[0\\.045em\\]", ["(min-width: 701px)"], 4, [["--tw-tracking", ".045em"], ["letter-spacing", ".045em"]]], [".min-\\[701px\\]\\:text-subtext-0", ["(min-width: 701px)"], 4, [["color", "var(--subtext-0)"]]], [".min-\\[701px\\]\\:uppercase", ["(min-width: 701px)"], 4, [["text-transform", "uppercase"]]], [".min-\\[900px\\]\\:inline", ["(min-width: 900px)"], 4, [["display", "inline"]]], [".pointer-coarse\\:opacity-100", ["(pointer: coarse)"], 4, [["opacity", "1"]]], [".\\[\\&_\\.mode-switch\\]\\:ml-0 .mode-switch", null, 4, [["margin-left", "0"]]], [".max-\\[700px\\]\\:\\[\\&_button\\]\\:min-h-11 button", ["not all and (min-width: 700px)"], 4, [["min-height", "calc(var(--spacing) * 11)"]]], [".\\[\\&_pre\\]\\:m-\\[0\\.2rem_0_0\\.3rem_1\\.2rem\\] pre", null, 4, [["margin", ".2rem 0 .3rem 1.2rem"]]], [".\\[\\&_pre\\]\\:max-h-72 pre", null, 4, [["max-height", "calc(var(--spacing) * 72)"]]], [".\\[\\&_pre\\]\\:overflow-auto pre", null, 4, [["overflow", "auto"]]], [".\\[\\&_pre\\]\\:rounded-ui pre", null, 4, [["border-radius", "var(--radius)"]]], [".\\[\\&_pre\\]\\:bg-surface-0 pre", null, 4, [["background-color", "var(--surface-0)"]]], [".\\[\\&_pre\\]\\:p-2 pre", null, 4, [["padding", "calc(var(--spacing) * 2)"]]], [".\\[\\&_pre\\]\\:text-\\[0\\.78rem\\] pre", null, 4, [["font-size", ".78rem"]]], [".\\[\\&_pre\\]\\:\\[overflow-wrap\\:anywhere\\] pre", null, 4, [["overflow-wrap", "anywhere"]]], [".\\[\\&_pre\\]\\:whitespace-pre-wrap pre", null, 4, [["white-space", "pre-wrap"]]], [".\\[\\&_pre\\]\\:text-fg pre, .\\[\\&_strong\\]\\:text-fg strong", null, 4, [["color", "var(--text)"]]], [".\\[\\&_summary\\]\\:cursor-pointer summary", null, 4, [["cursor", "pointer"]]], [".\\[\\&\\:hover\\:not\\(\\:disabled\\)\\]\\:bg-surface-1:hover:not(:disabled)", null, 4, [["background-color", "var(--surface-1)"]]], [".\\[\\&\\:hover\\:not\\(\\:disabled\\)\\]\\:text-accent:hover:not(:disabled)", null, 4, [["color", "var(--accent)"]]], [".\\[\\&\\:hover\\:not\\(\\:disabled\\)\\]\\:text-red:hover:not(:disabled)", null, 4, [["color", "var(--red)"]]], [".\\[\\&\\:not\\(\\:has\\(\\[data-setting-row\\]\\)\\)\\>\\[data-none\\]\\]\\:block:not(:has([data-setting-row])) > [data-none]", null, 4, [["display", "block"]]], [".\\[\\&\\>\\*\\]\\:min-h-0 > *", null, 4, [["min-height", "0"]]], [".\\[\\&\\>\\*\\]\\:min-w-0 > *", null, 4, [["min-width", "0"]]], [".\\[\\&\\>\\*\\]\\:flex-1 > *", null, 4, [["flex", "1"]]], [".\\[\\&\\>\\*\\]\\:shrink-0 > *", null, 4, [["flex-shrink", "0"]]], [".\\[\\&\\>li\\]\\:text-\\[0\\.85rem\\] > li", null, 4, [["font-size", ".85rem"]]], [".\\[\\&\\>li\\]\\:leading-\\[1\\.5\\] > li", null, 4, [["--tw-leading", "1.5"], ["line-height", "1.5"]]], [".\\[\\&\\>li\\]\\:text-fg > li", null, 4, [["color", "var(--text)"]]], [".\\[\\&\\>summary\\]\\:flex > summary", null, 4, [["display", "flex"]]], [".\\[\\&\\>summary\\]\\:cursor-pointer > summary", null, 4, [["cursor", "pointer"]]], [".\\[\\&\\>summary\\]\\:list-none > summary", null, 4, [["list-style-type", "none"]]], [".\\[\\&\\>summary\\]\\:items-center > summary", null, 4, [["align-items", "center"]]], [".\\[\\&\\>summary\\]\\:gap-\\[0\\.4rem\\] > summary", null, 4, [["gap", ".4rem"]]], [".\\[\\&\\>summary\\]\\:rounded-ui > summary", null, 4, [["border-radius", "var(--radius)"]]], [".\\[\\&\\>summary\\]\\:px-\\[0\\.4rem\\] > summary", null, 4, [["padding-inline", ".4rem"]]], [".\\[\\&\\>summary\\]\\:py-\\[0\\.25rem\\] > summary", null, 4, [["padding-block", ".25rem"]]], [".\\[\\&\\>summary\\]\\:select-none > summary", null, 4, [["-webkit-user-select", "none"], ["user-select", "none"]]], [".\\[\\&\\>summary\\]\\:before\\:inline-block > summary:before", null, 4, [["content", "var(--tw-content)"], ["display", "inline-block"]]], [".\\[\\&\\>summary\\]\\:before\\:size-\\[0\\.4rem\\] > summary:before", null, 4, [["content", "var(--tw-content)"], ["width", ".4rem"], ["height", ".4rem"]]], [".\\[\\&\\>summary\\]\\:before\\:shrink-0 > summary:before", null, 4, [["content", "var(--tw-content)"], ["flex-shrink", "0"]]], [".\\[\\&\\>summary\\]\\:before\\:\\[transform\\:rotate\\(-45deg\\)\\] > summary:before", null, 4, [["content", "var(--tw-content)"], ["transform", "rotate(-45deg)"]]], [".\\[\\&\\>summary\\]\\:before\\:content-\\[\\'\\'\\] > summary:before", null, 4, [["--tw-content", '""'], ["content", "var(--tw-content)"]]], [".\\[\\&\\>summary\\]\\:before\\:\\[border-bottom\\:1\\.3px_solid_currentColor\\] > summary:before", null, 4, [["content", "var(--tw-content)"], ["border-bottom", "1.3px solid"]]], [".\\[\\&\\>summary\\]\\:before\\:\\[border-right\\:1\\.3px_solid_currentColor\\] > summary:before", null, 4, [["content", "var(--tw-content)"], ["border-right", "1.3px solid"]]], [".\\[\\&\\>summary\\]\\:before\\:\\[transition\\:transform_0\\.15s_ease\\] > summary:before", null, 4, [["content", "var(--tw-content)"], ["transition", "transform .15s"]]], [".\\[\\&\\>summary\\:hover\\]\\:bg-surface-1 > summary:hover", null, 4, [["background-color", "var(--surface-1)"]]], [".\\[\\&\\>summary\\:hover\\]\\:text-fg > summary:hover", null, 4, [["color", "var(--text)"]]], [".\\[\\&\\[open\\]\\>summary\\]\\:before\\:\\[transform\\:rotate\\(45deg\\)\\][open] > summary:before", null, 4, [["content", "var(--tw-content)"], ["transform", "rotate(45deg)"]]], [".app--mobile .\\[\\.app--mobile_\\&\\]\\:min-h-11", null, 4, [["min-height", "calc(var(--spacing) * 11)"]]], [".app--mobile .\\[\\.app--mobile_\\&\\]\\:min-h-\\[44px\\]", null, 4, [["min-height", "44px"]]], [".\\[\\@media\\(hover\\:none\\)\\]\\:opacity-60", ["(hover: none)"], 4, [["opacity", ".6"]]], [".\\[\\@media\\(hover\\:none\\)\\]\\:opacity-100", ["(hover: none)"], 4, [["opacity", "1"]]], [".\\[\\@media\\(max-width\\:700px\\)\\]\\:h-\\[2\\.75rem\\]", ["(max-width: 700px)"], 4, [["height", "2.75rem"]]], [".\\[\\@media\\(max-width\\:700px\\)\\]\\:min-h-\\[2\\.75rem\\]", ["(max-width: 700px)"], 4, [["min-height", "2.75rem"]]], [".\\[\\@media\\(max-width\\:700px\\)\\]\\:w-\\[2\\.75rem\\]", ["(max-width: 700px)"], 4, [["width", "2.75rem"]]], [".\\[\\@media\\(max-width\\:700px\\)\\]\\:min-w-\\[2\\.75rem\\]", ["(max-width: 700px)"], 4, [["min-width", "2.75rem"]]], [".\\[\\@media\\(max-width\\:700px\\)\\]\\:px-\\[0\\.65rem\\]", ["(max-width: 700px)"], 4, [["padding-inline", ".65rem"]]], ["div:hover > .\\[div\\:hover\\>\\&\\]\\:opacity-100", null, 4, [["opacity", "1"]]], [":root", null, 1e3, [["color-scheme", "dark"], ["--scrollbar-size", "6px"], ["--accent", "#c8c8c8"], ["--panel-bg", "#161616"], ["--surface-0", "#262626"], ["--surface-1", "#333"], ["--surface-dim", "#1c1c1c"], ["--backdrop", "#050505"], ["--overlay-0", "#3a3a3a"], ["--overlay-1", "#9b9b9b"], ["--text", "#d8d8d8"], ["--subtext-0", "#9b9b9b"], ["--mauve", "#a993c9"], ["--green", "#7fb685"], ["--yellow", "#d3b46a"], ["--red", "#df8c8c"], ["--blue", "#7aa2d7"], ["--teal", "#7fb8b8"], ["--peach", "#d39a6a"], ["--bg", "var(--panel-bg)"], ["--surface", "var(--surface-0)"], ["--surface-alt", "var(--surface-1)"], ["--border", "var(--overlay-0)"], ["--muted", "var(--subtext-0)"], ["--danger", "var(--red)"], ["--radius", "8px"], ["--radius-pane", "8px"], ["accent-color", "var(--accent)"], ["--font-ui", '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif'], ["--font-mono", `ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono",
    monospace`], ["font-family", "var(--font-ui)"]]], ["code, pre, kbd, samp", null, 1e3, [["font-family", "var(--font-mono)"]]], ["*", null, 1e3, [["box-sizing", "border-box"]]], ["html, body, #root", null, 1e3, [["height", "100%"], ["margin", "0"]]], ["html", null, 1e3, [["overscroll-behavior", "none"], ["--shell-bg", "var(--panel-bg)"]]], ["html[data-glass]", null, 1e3, [["--shell-bg", "var(--panel-bg)"]]], ["html[data-glass]", null, 1e3, [["--shell-bg", "color-mix(in srgb, var(--panel-bg) 86%, transparent)"]]], ["html", null, 1e3, [["--backdrop-bg", "var(--backdrop)"], ["--card-bg", "var(--panel-bg)"]]], ["html[data-glass]", null, 1e3, [["--backdrop-bg", "var(--backdrop)"]]], ["html[data-glass]", null, 1e3, [["--backdrop-bg", "color-mix(in srgb, var(--backdrop) 86%, transparent)"]]], ["html[data-glass]", null, 1e3, [["--card-bg", "var(--panel-bg)"]]], ["html[data-glass]", null, 1e3, [["--card-bg", "color-mix(in srgb, var(--panel-bg) 86%, transparent)"]]], ['body:has(.app--cards, .app--mobile), .app--cards .dock-area:has([data-testid="split-canvas"]:not([data-split="0"]))', null, 1e3, [["background", "var(--backdrop-bg)"]]], ["body", null, 1e3, [["background", "var(--shell-bg)"], ["color", "var(--text)"], ["overscroll-behavior", "none"], ["-webkit-tap-highlight-color", "transparent"], ["line-height", "1.3"]]], [".app", null, 1e3, [["flex-direction", "column"], ["height", "100dvh"], ["display", "flex"]]], [".app--mobile", null, 1e3, [["inset", "var(--visible-top, 0px) 0 auto 0"], ["height", "var(--visible-height, 100dvh)"], ["position", "fixed"]]], [".mobile-drawer-backdrop", null, 1e3, [["animation", ".15s ease-out mobile-fade"]]], [".mobile-drawer--left", null, 1e3, [["animation", ".2s cubic-bezier(.2, .8, .2, 1) mobile-slide-left"]]], [".mobile-drawer--right", null, 1e3, [["animation", ".2s cubic-bezier(.2, .8, .2, 1) mobile-slide-right"]]], [".mobile-sheet", null, 1e3, [["animation", ".22s cubic-bezier(.2, .8, .2, 1) mobile-rise"]]], [".mobile-drawer-backdrop, .mobile-drawer, .mobile-sheet", ["(prefers-reduced-motion: reduce)"], 1e3, [["animation", "none"]]], [".layout-drawer", null, 1e3, [["transform", "translateX(var(--float-hide, 0))"], ["transition", "transform .18s"]]], [".layout-drawer:hover, .layout-drawer:focus-within", null, 1e3, [["--float-hide", "0px"]]], [".dockview-theme-perch", null, 1e3, [["--dv-color-abyss-dark", "var(--panel-bg)"], ["--dv-color-abyss", "var(--surface-0)"], ["--dv-color-abyss-light", "var(--surface-1)"], ["--dv-color-abyss-lighter", "var(--overlay-0)"], ["--dv-color-abyss-accent", "var(--accent)"], ["--dv-color-abyss-primary-text", "var(--text)"], ["--dv-color-abyss-secondary-text", "var(--subtext-0)"], ["--dv-group-view-background-color", "var(--panel-bg)"], ["--dv-tabs-and-actions-container-background-color", "var(--surface-0)"], ["--dv-activegroup-visiblepanel-tab-background-color", "var(--panel-bg)"], ["--dv-activegroup-hiddenpanel-tab-background-color", "var(--surface-0)"], ["--dv-inactivegroup-visiblepanel-tab-background-color", "var(--panel-bg)"], ["--dv-inactivegroup-hiddenpanel-tab-background-color", "var(--surface-0)"], ["--dv-tab-divider-color", "var(--overlay-0)"], ["--dv-activegroup-visiblepanel-tab-color", "var(--text)"], ["--dv-activegroup-hiddenpanel-tab-color", "var(--subtext-0)"], ["--dv-inactivegroup-visiblepanel-tab-color", "var(--subtext-0)"], ["--dv-inactivegroup-hiddenpanel-tab-color", "var(--subtext-0)"], ["--dv-separator-border", "var(--overlay-0)"], ["--dv-paneview-header-border-color", "var(--overlay-0)"], ["--dv-tabs-and-actions-container-font-size", ".82rem"], ["--dv-tabs-and-actions-container-height", "2.1rem"]]], [".dockview-theme-perch .dv-tabs-and-actions-container", null, 1e3, [["z-index", "1"], ["position", "relative"]]], [".pane-tab", null, 1e3, [["align-items", "center"], ["width", "100%"], ["height", "100%"], ["display", "flex"]]], [".pane-tab__agent-badge", null, 1e3, [["color", "var(--subtext-0)"], ["white-space", "nowrap"], ["flex-shrink", "0"], ["margin-right", ".4rem"], ["font-size", ".78em"]]], ['.pane-tab[data-testid="pane-tab-chat"] .dv-default-tab-action', null, 1e3, [["display", "none"]]], [".dockview-group-action", null, 1e3, [["border-radius", "var(--radius)"], ["width", "1.5rem"], ["height", "1.5rem"], ["color", "var(--subtext-0)"], ["cursor", "pointer"], ["background", "none"], ["border", "none"], ["justify-content", "center"], ["align-self", "center"], ["align-items", "center"], ["margin", "0 .15rem"], ["font-size", "1rem"], ["line-height", "1"], ["transition", "color .1s, background .1s"], ["display", "flex"]]], [".dockview-group-action:hover", null, 1e3, [["color", "var(--text)"], ["background", "var(--surface-1)"]]], [".dockview-theme-perch .dv-view-container > .dv-view:has(.dv-inactive-group)", ["(max-width: 700px)"], 1e3, [["display", "none"]]], [".dockview-theme-perch .dv-view-container > .dv-view:has(.dv-active-group)", ["(max-width: 700px)"], 1e3, [["width", "100%", 1], ["left", "0", 1]]], [".chat", null, 1e3, [["isolation", "isolate"], ["flex-direction", "column"], ["flex", "1"], ["height", "100%"], ["min-height", "0"], ["display", "flex"]]], [".message__markdown p", null, 1e3, [["margin", "0 0 .5em"]]], [".message__markdown p:last-child", null, 1e3, [["margin-bottom", "0"]]], [".message__markdown h1, .message__markdown h2, .message__markdown h3, .message__markdown h4", null, 1e3, [["margin", ".6em 0 .3em"], ["line-height", "1.25"]]], [".message__markdown h1", null, 1e3, [["font-size", "1.25em"]]], [".message__markdown h2", null, 1e3, [["font-size", "1.12em"]]], [".message__markdown h3", null, 1e3, [["font-size", "1em"]]], [".message__markdown > * + *", null, 1e3, [["margin-top", ".5em"]]], [".message__markdown table, .md-table", null, 1e3, [["border-collapse", "separate"], ["border-spacing", "0"], ["background", "var(--surface-0)"], ["border-radius", "var(--radius)"], ["max-width", "100%"], ["margin", ".5em 0"], ["font-size", ".92em"], ["display", "block"], ["overflow-x", "auto"]]], [".md-table", null, 1e3, [["width", "100%"], ["margin", "0"], ["display", "table"]]], [".message__markdown th, .message__markdown td, .md-table th, .md-table td", null, 1e3, [["text-align", "left"], ["vertical-align", "top"], ["border-bottom", "1px solid var(--surface-1)"], ["padding", ".35em .75em"]]], [".message__markdown th, .md-table th", null, 1e3, [["color", "var(--subtext-0)"], ["white-space", "nowrap"], ["background", "var(--surface-1)"], ["font-weight", "600"]]], [".message__markdown tbody tr:last-child td, .md-table tbody tr:last-child td", null, 1e3, [["border-bottom", "0"]]], [".message__markdown tbody tr:hover td, .md-table tbody tr:hover td", null, 1e3, [["background", "var(--surface-1)"]]], [".md-table caption", null, 1e3, [["text-align", "left"], ["color", "var(--subtext-0)"], ["padding", ".4em .75em"]]], [".md-code", null, 1e3, [["background", "var(--surface-0)"], ["border-radius", "var(--radius)"], ["overflow", "hidden"]]], [".md-code__bar", null, 1e3, [["color", "var(--subtext-0)"], ["background", "var(--surface-1)"], ["justify-content", "space-between"], ["align-items", "center"], ["padding", ".1rem .4rem .1rem .75rem"], ["font-size", ".75em"], ["display", "flex"]]], [".message__markdown .md-code pre", null, 1e3, [["background", "none"], ["border-radius", "0"], ["margin", "0"]]], [".hl-keyword", null, 1e3, [["color", "var(--mauve)"]]], [".hl-string", null, 1e3, [["color", "var(--green)"]]], [".hl-number", null, 1e3, [["color", "var(--peach)"]]], [".hl-function", null, 1e3, [["color", "var(--blue)"]]], [".hl-type", null, 1e3, [["color", "var(--yellow)"]]], [".hl-tag", null, 1e3, [["color", "var(--teal)"]]], [".hl-comment", null, 1e3, [["color", "var(--overlay-1)"], ["font-style", "italic"]]], [".message__markdown ul, .message__markdown ol", null, 1e3, [["margin", ".3em 0 .5em 1.3em"], ["padding", "0"]]], [".message__markdown li", null, 1e3, [["margin-bottom", ".2em"]]], [".message__markdown code", null, 1e3, [["background", "var(--surface-0)"], ["border-radius", ".25rem"], ["padding", ".1em .35em"], ["font-family", "ui-monospace, SFMono-Regular, SF Mono, Menlo, Consolas, monospace"], ["font-size", ".88em"]]], [".message__markdown pre", null, 1e3, [["background", "var(--surface-0)"], ["border-radius", "var(--radius)"], ["margin", ".4em 0"], ["padding", ".6rem .75rem"], ["position", "relative"], ["overflow-x", "auto"]]], [".message__markdown pre code", null, 1e3, [["background", "none"], ["border", "none"], ["padding", "0"], ["font-size", ".85em"]]], [".message__markdown a", null, 1e3, [["color", "var(--accent)"], ["text-decoration", "underline"]]], [".message__markdown blockquote", null, 1e3, [["border-left", "3px solid var(--overlay-0)"], ["color", "var(--subtext-0)"], ["margin", ".4em 0"], ["padding", ".1em .6em"]]], [".message__markdown hr", null, 1e3, [["border", "none"], ["border-top", "1px solid var(--overlay-0)"], ["margin", ".75em 0"]]], [".file-markdown", null, 1e3, [["overflow-wrap", "anywhere"]]], [".file-markdown img", null, 1e3, [["max-width", "100%"]]], [".file-markdown table", null, 1e3, [["border-collapse", "collapse"], ["margin", ".4em 0"], ["display", "block"], ["overflow-x", "auto"]]], [".file-markdown th, .file-markdown td", null, 1e3, [["border", "1px solid var(--overlay-0)"], ["padding", ".2em .5em"]]], [".file-markdown .md-placeholder", null, 1e3, [["color", "var(--subtext-0)"], ["border", "1px dashed var(--overlay-0)"], ["border-radius", ".25rem"], ["padding", ".05em .35em"], ["font-size", ".9em"]]], [".terminal", null, 1e3, [["min-width", "0"], ["min-height", "0"], ["padding", "var(--terminal-padding, 0)"], ["opacity", "var(--terminal-opacity, 1)"], ["flex", "1"], ["display", "flex"], ["position", "relative"]]], [".terminal__surface", null, 1e3, [["flex", "1"], ["min-width", "0"], ["min-height", "0"], ["overflow", "hidden"]]], [".terminal__surface .xterm", null, 1e3, [["height", "100%"]]], [".terminal__surface .xterm:not(.allow-transparency) .xterm-viewport", null, 1e3, [["background-color", "#0000"]]], [".terminal__surface .xterm-scrollable-element", null, 1e3, [["position", "static", 1]]], [".terminal__surface .xterm-decoration-overview-ruler, .no-pane-scrollbars .terminal__surface .xterm-scrollable-element > .xterm-scrollbar", null, 1e3, [["display", "none"]]], [".terminal--persistent", null, 1e3, [["flex-direction", "column"]]], [".terminal__toolbar", null, 1e3, [["color", "var(--subtext-0)"], ["align-items", "center"], ["gap", ".5rem"], ["padding", ".25rem 1.5rem .25rem .5rem"], ["font-size", ".8rem"], ["display", "flex"]]], [".terminal__toolbar button", null, 1e3, [["border-radius", "var(--radius)"], ["min-height", "32px"], ["color", "var(--text)"], ["background", "var(--surface-0)"], ["border", "0"], ["padding", ".25rem .5rem"]]], [".terminal__toolbar--overlay", null, 1e3, [["z-index", "2"], ["border-radius", "var(--radius)"], ["background", "var(--surface-1)"], ["padding", ".2rem .3rem .2rem .6rem"], ["position", "absolute"], ["top", ".4rem"], ["right", ".9rem"], ["box-shadow", "0 2px 8px #00000040"]]], [".terminal__connection", null, 1e3, [["margin-right", "auto"]]], [".terminal__toolbar button:disabled", null, 1e3, [["opacity", ".5"]]], [".terminal__notice", null, 1e3, [["color", "var(--subtext-0)"], ["padding", ".75rem"], ["font-size", ".85rem"]]], [".app--mobile .terminal__toolbar button", null, 1e3, [["min-height", "44px"]]], [".app--mobile .terminal__connection", null, 1e3, [["display", "none"]]], [".app--mobile .terminal__toolbar", null, 1e3, [["padding-right", ".5rem"]]], [".terminal__exited", null, 1e3, [["background", "var(--surface-1)"], ["border-radius", "var(--radius)"], ["color", "var(--subtext-0)"], ["padding", ".35rem .75rem"], ["font-size", ".85rem"], ["position", "absolute"], ["bottom", ".75rem"], ["left", "50%"], ["transform", "translateX(-50%)"]]], [".terminal__exited--cli", null, 1e3, [["background", "var(--panel-bg)"], ["flex-direction", "column"], ["align-items", "center"], ["gap", ".6rem"], ["padding", ".9rem 1.1rem"], ["display", "flex"], ["top", "50%"], ["bottom", "auto"], ["transform", "translate(-50%, -50%)"], ["box-shadow", "0 6px 24px #00000059"]]], [".terminal__exited-actions", null, 1e3, [["gap", ".5rem"], ["display", "flex"]]], [".terminal__cli-error", null, 1e3, [["background", "var(--red)"], ["position", "absolute"], ["bottom", ".75rem"], ["left", "50%"], ["transform", "translateX(-50%)"]]], [".terminal__cli-error", null, 1e3, [["background", "color-mix(in srgb, var(--red) 20%, var(--panel-bg))"]]], [".terminal__cli-error", null, 1e3, [["border-radius", "var(--radius)"], ["color", "var(--red)"], ["text-align", "center"], ["white-space", "pre-wrap"], ["word-break", "break-word"], ["max-width", "90%"], ["padding", ".35rem .75rem"], ["font-size", ".85rem"]]], [".mobile-pane-shell__content > .chat, .mobile-pane-shell__content > .terminal, .mobile-pane-shell__content > .workspace-files, .mobile-pane-shell__content > .workspace-git", null, 1e3, [["flex", "1"], ["width", "100%"], ["min-width", "0"], ["height", "100%"], ["min-height", "0"]]], [".terminal__host", null, 1e3, [["width", "100%"], ["height", "100%"], ["overflow", "hidden"]]], [".workspace-git", null, 1e3, [["--git-border", "var(--overlay-0)"]]], [".workspace-git", null, 1e3, [["--git-border", "color-mix(in srgb, var(--overlay-0) 72%, transparent)"]]], [".workspace-git", null, 1e3, [["--git-muted", "var(--subtext-0)"], ["width", "100%"], ["min-width", "0"], ["height", "100%"], ["min-height", "0"], ["color", "var(--text)"], ["background", "var(--workspace-tools-bg, var(--panel-bg))"], ["flex-direction", "column"], ["font-size", ".78rem"], ["display", "flex"], ["position", "relative"], ["overflow", "hidden"], ["container-type", "inline-size"]]], [".workspace-git button, .workspace-git input, .workspace-git textarea", null, 1e3, [["font", "inherit"]]], [".workspace-git button", null, 1e3, [["cursor", "pointer"]]], ['.workspace-git button:focus-visible, .workspace-git input:focus-visible, .workspace-git textarea:focus-visible, .workspace-git [role="button"]:focus-visible', null, 1e3, [["outline", "2px solid var(--accent)"], ["outline-offset", "1px"]]], [".workspace-git__diff", null, 1e3, [["container-type", "inline-size"]]], [".workspace-git__line-comment-thread", null, 1e3, [["max-width", "max(0px, min(42rem, 100cqi - 6.9rem))"], ["position", "sticky"], ["left", "0"]]], [".workspace-git__comment-composer", null, 1e3, [["max-width", "max(0px, 100cqi - 1.4rem)"], ["position", "sticky"], ["left", "0"]]], [".dockview-group-action--split-session", null, 1e3, [["font-size", "13px"]]], [".session-split-popover", null, 1e3, [["display", "flex"], ["flex-direction", "column"], ["background", "var(--surface-1)"], ["border-radius", "var(--radius)"], ["box-shadow", "0 8px 24px rgba(0, 0, 0, 0.45)"], ["padding", "4px"], ["font-size", "12.5px"], ["color", "var(--text)"], ["overflow", "hidden"]]], [".session-split-popover__header", null, 1e3, [["padding", "6px 8px 4px"], ["font-size", "11px"], ["text-transform", "uppercase"], ["letter-spacing", "0.04em"], ["color", "var(--subtext-0)"]]], [".session-split-popover__empty", null, 1e3, [["padding", "8px"], ["color", "var(--subtext-0)"]]], [".session-split-popover__list", null, 1e3, [["overflow-y", "auto"]]], [".session-split-popover__item", null, 1e3, [["display", "flex"], ["flex-direction", "column"], ["align-items", "flex-start"], ["gap", "1px"], ["width", "100%"], ["padding", "6px 8px"], ["border", "none"], ["border-radius", "4px"], ["background", "transparent"], ["color", "inherit"], ["text-align", "left"], ["cursor", "grab"]]], [".session-split-popover__item:hover", null, 1e3, [["background", "var(--surface-0)"]]], [".session-split-popover__item-title", null, 1e3, [["font-weight", "500"], ["white-space", "nowrap"], ["overflow", "hidden"], ["text-overflow", "ellipsis"], ["max-width", "100%"]]], [".session-split-popover__item-cwd", null, 1e3, [["font-size", "11px"], ["color", "var(--subtext-0)"], ["white-space", "nowrap"], ["overflow", "hidden"], ["text-overflow", "ellipsis"], ["max-width", "100%"]]], [".session-split-popover__item-badge", null, 1e3, [["align-self", "flex-end"], ["font-size", "10px"], ["color", "var(--accent)"], ["margin-top", "-14px"]]], [".inactive-session-pane", null, 1e3, [["display", "flex"], ["flex-direction", "column"], ["align-items", "center"], ["justify-content", "center"], ["gap", "10px"], ["height", "100%"], ["padding", "24px"], ["text-align", "center"], ["color", "var(--subtext-0)"]]], [".inactive-session-pane__title", null, 1e3, [["font-size", "14px"], ["font-weight", "500"], ["color", "var(--text)"]]], [".inactive-session-pane__cwd", null, 1e3, [["font-size", "12px"], ["color", "var(--subtext-0)"], ["word-break", "break-all"]]], [".inactive-session-pane__note", null, 1e3, [["font-size", "12px"], ["max-width", "320px"], ["line-height", "1.5"]]], [".inactive-session-pane__switch", null, 1e3, [["margin-top", "4px"], ["padding", "6px 14px"], ["border-radius", "var(--radius)"], ["border", "0"], ["background", "var(--surface-0)"], ["color", "var(--text)"], ["cursor", "pointer"], ["font-size", "12.5px"]]], [".inactive-session-pane__switch:hover", null, 1e3, [["background", "var(--surface-1)"]]]], skipped: { "@supports evaluated false": 2, "@container": 6, "@keyframes": 9 }, digest: "1b693a483c1992d8" };
//! The app's compiled stylesheet as a table (`build.mjs` writes it from Vite + Tailwind's output and bundles it as
//! `virtual:perch-css-table`), parsed once on first use.
const Pa = globalThis[Symbol.for("perch.styleSheets")] ??= /* @__PURE__ */ new Map();
let Hl = null;
function u1() {
  return Hl || (Hl = Ia.digest && Pa.get(Ia.digest) || new vb(Ia), Ia.digest && !Pa.has(Ia.digest) && (Pa.size >= 4 && Pa.delete(Pa.keys().next().value), Pa.set(Ia.digest, Hl)), Hl);
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
let Xn = nl.NoEventPriority;
function d1(n, a) {
  const r = /* @__PURE__ */ new Set([...Object.keys(n), ...Object.keys(a)]);
  for (const i of r) {
    if (i === "children") continue;
    const s = n[i], c = a[i];
    if (!(s === c || typeof s == "function" && typeof c == "function") && !(i === "style" && s && c && typeof s == "object" && typeof c == "object" && [.../* @__PURE__ */ new Set([...Object.keys(s), ...Object.keys(c)])].every((u) => s[u] === c[u])))
      return !0;
  }
  return !1;
}
const f1 = (n) => !n.props.disabled && (/^(button|input|select|textarea)$/.test(n.tagName) || n.tagName === "a" && n.props.href != null || n.props.tabIndex != null);
function np(n, a) {
  for (const r of B0(a.dangerouslySetInnerHTML?.__html, n.ownerDocument) ?? []) n.appendChild(r);
  return n;
}
const lm = {
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
  createInstance: (n, a, r) => np(new $e(n, a, r.ownerDocument), a),
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
      np(n, i);
    }
    d1(r, i) && n.touch();
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
  resolveUpdatePriority: () => Xn !== nl.NoEventPriority ? Xn : nl.DefaultEventPriority,
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
let bt = Vp(lm), Jo = 0;
function ap() {
  bt.isAlreadyRendering() && (bt = Vp(lm), Jo += 1, Xn = nl.NoEventPriority);
}
const $l = (n, a, r = null) => bt.createPortal(n, a, null, r), p1 = {
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
}, m1 = /* @__PURE__ */ new Set(["click", "dblclick", "mousedown", "mouseup"]), h1 = /* @__PURE__ */ new Set(["button", "input", "select", "textarea", "fieldset"]), g1 = (n) => {
  for (let a = n; a instanceof $e; a = a.parentNode) if (a.props.disabled && h1.has(a.tagName)) return !0;
  return !1;
};
class b1 {
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
function ni(n, a, r) {
  a.currentTarget = n;
  for (const { type: i, listener: s, capture: c } of [...n.listeners ?? []])
    i === a.type && c === r && s.call(n, a);
  if (n instanceof $e) {
    const i = p1[a.type], s = i && n.props[r ? `${i}Capture` : i];
    typeof s == "function" && s(a);
  }
}
function k4(n, a, r = {}) {
  const { document: i, window: s, globals: c } = G0(n), f = new $e("div", { id: "root", style: r.container ?? {} }, i);
  i.body.appendChild(f);
  const u = [];
  let m = null;
  const h = () => [i, s].map((w) => w.listeners.map((x) => `${x.type}:${x.capture}`).sort().join(",")).join("|");
  let v = "";
  const y = {}, b = `m${Math.random().toString(36).slice(2, 10)}:`;
  let S = 0, E = -1;
  i.measureKey = (w) => b + w.id, i.stale = () => E !== S, i.computed = (w) => {
    if (!y.cascade || !y.top) return null;
    const x = [];
    for (let T = w; T instanceof $e && T !== i.body; T = T.parentNode) x.unshift(T);
    let _ = y.top;
    for (const T of x) _ = y.cascade.compute(T, _);
    return _.values;
  };
  const R = () => (S += 1, m = c1(i, n, u1(), y, r.names), v = h(), n.render?.(m), m);
  ap();
  const N = Jo, M = () => (ap(), N === Jo), O = () => {
    M() && (bt.flushPassiveEffects(), bt.flushSyncWork(), h() !== v && R());
  };
  i.afterCommit = R;
  const H = (w) => {
    u.push(w), n.error?.(w);
  }, X = bt.createContainer(f, nl.ConcurrentRoot, null, !1, null, "", H, H, H, null);
  bt.updateContainerSync(L.createElement(a, r.props ?? {}), X, null, null), bt.flushSyncWork(), O();
  const W = (w) => {
    const x = (_) => {
      if (_.id === w) return _;
      for (const T of _.children) {
        const z = x(T);
        if (z) return z;
      }
      return null;
    };
    return x(i.documentElement);
  }, D = (w) => {
    if (!M()) return;
    const x = Xn;
    Xn = nl.DiscreteEventPriority;
    try {
      return w();
    } finally {
      Xn = x, bt.flushSyncWork(), O();
    }
  }, g = {
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
    describe: R,
    /** Runs a DOM event of `type` at node `id`; false when the node is gone. */
    dispatch(w, x, _ = {}) {
      const T = typeof w == "string" ? W(w) : w;
      if (!T || m1.has(x) && g1(T)) return !1;
      const z = new b1(x, _, T), j = [];
      for (let U = T; U; U = x === "scroll" ? null : U.parentNode) j.push(U);
      const V = [...j, i, s];
      D(() => {
        for (let U = V.length - 1; U > 0 && !z.propagationStopped; U--) ni(V[U], z, !0);
        z.propagationStopped || (ni(T, z, !0), z.propagationStopped || ni(T, z, !1));
        for (let U = 1; U < V.length && !z.propagationStopped; U++) ni(V[U], z, !1);
      });
      const $ = x === "click" && !z.defaultPrevented ? Yo(T) : null;
      if ($ && g.dispatch($, "submit", {}), x === "click" && !z.defaultPrevented)
        for (let U = T; U; U = U.parentNode) {
          if (U.tagName !== "a") continue;
          const K = U.props?.href;
          typeof K == "string" && /^https:\/\/\S+$/.test(K) && n.openLink?.(K);
          break;
        }
      return !z.defaultPrevented;
    },
    /** Whether the source listens for `type` on `window` or `document` (a page recording a key press does). */
    listensFor: (w) => [i, s].some((x) => x.listeners.some((_) => _.type === w)),
    /** A key pressed while the screen has the keyboard (`init`: the DOM's `key`, modifiers, `repeat`), at the
     * focused element. When nothing prevented it and that element is a text field, the key edits the field as a
     * browser would: a character is typed at the end (or replaces the text when all of it is selected), Backspace
     * deletes the last one, and the field gets `input` and `change` events with its new `value`. Returns whether the
     * source took the key (prevented it, or a field changed). */
    key(w) {
      const x = i.activeElement && i.activeElement !== i.body ? i.activeElement : i.body;
      if (!g.dispatch(x, "keydown", w)) return !0;
      const T = w.key === "Enter" && !w.isComposing ? Yo(x, !0) : null;
      if (T)
        return g.dispatch(T, "submit", {}), !0;
      if (!Yp(x) || x.props.disabled || x.props.readOnly) return !1;
      if ((w.ctrlKey || w.metaKey) && !w.altKey && !w.shiftKey && w.key.toLowerCase() === "a")
        return x.selectedAll = !0, !0;
      if (w.ctrlKey || w.metaKey) return !1;
      const z = x.selectedAll;
      x.selectedAll = !1;
      const j = x.value, $ = w.key === "Backspace" || z && w.key === "Delete" ? z ? "" : j.slice(0, -1) : [...w.key].length === 1 ? (z ? "" : j) + w.key : j;
      return $ === j ? !1 : (x.value = $, g.dispatch(x, "input", { data: w.key }), g.dispatch(x, "change", {}), x.props.value !== void 0 && delete x.edit, x.touch(), R(), !0);
    },
    /** The engine's box for node `id` (window coordinates, logical px), for `getBoundingClientRect`. */
    setBounds(w, x) {
      const _ = W(w);
      _ && (_.bounds = { x: x.x, y: x.y, width: x.width, height: x.height });
    },
    /** A click on a check box or radio button (`id`): the `click` event, then, unless the source prevented it, the
     * box ticked as a browser ticks it (a radio button only on), with `input` and `change` events. */
    toggle(w) {
      const x = W(w);
      if (!x || x.props.disabled || !g.dispatch(w, "click", { button: 0, detail: 1 })) return;
      const _ = x.props.type === "radio";
      _ && x.checked || (x.checked = _ ? !0 : !x.checked, g.dispatch(w, "input", {}), g.dispatch(w, "change", {}), x.props.checked !== void 0 && delete x.ticked, x.touch(), R());
    },
    /** A left click as the engine reports one: press then release on the same node. */
    click(w, x = {}) {
      const _ = { button: 0, buttons: 1, pointerType: "mouse", ...x };
      for (const T of ["pointerdown", "mousedown", "pointerup", "mouseup", "click"]) g.dispatch(w, T, _);
    },
    /** The pointer entered (`on`) or left node `id` (one the description marks `track_hover`): its `:hover` state,
     * which a descendant's group variant reads. The element's own `hover:` styles are the engine's hover style. */
    /** Whether the pointer is over node `id`, as `hover` last said. */
    hovered: (w) => !!W(w)?.state.hover,
    hover(w, x) {
      const _ = W(w);
      !_ || _.state.hover === x || (_.state.hover = x, _.touch(), R());
    },
    focus(w) {
      const x = W(w);
      x && (D(() => {
        const _ = i.activeElement;
        _ && _ !== x && _ !== i.body && g.dispatch(_, "blur"), i.focus(x), g.dispatch(x, "focus");
      }), R());
    },
    /** A press at node `id` that nothing prevented: the browser's default focuses the element pressed. Only an element
     * that listens for keys (`onKeyDown`) is focused, so a press elsewhere leaves the keyboard where it was; the focus
     * is not `:focus-visible`, as after a pointer press in a browser. */
    // ponytail: a browser focuses every focusable element pressed; here only one with its own key handler, so a
    // screen's ordinary buttons do not take the keyboard from a terminal.
    pressFocus(w) {
      let _ = typeof w == "string" ? W(w) : w;
      for (; _ && !(_ instanceof $e && typeof _.props.onKeyDown == "function" && f1(_)); ) _ = _.parentNode;
      !_ || _ === i.activeElement || (g.focus(_.id), _.state.pointerFocus = !0, _.touch(), R());
    },
    /** The engine is drawing the latest description: the boxes measured in this frame's layout are the tree's.
     * Returns whether effects wait for that layout (`measured`); run them with `retry` once the frame is drawn. */
    drawing() {
      return E = S, i.retries.length > 0;
    },
    /** Runs the effects that waited for a fresh layout. */
    retry() {
      const w = i.retries.splice(0);
      for (const x of w) x();
    },
    /** Runs effects React has scheduled (the engine calls it after a frame). */
    flush: O,
    /** React was replaced since this tree was mounted (`fresh`): the tree is to be mounted again. */
    dead: () => !M(),
    update(w) {
      M() && (bt.updateContainerSync(L.createElement(a, w ?? {}), X, null, null), bt.flushSyncWork(), O());
    },
    unmount() {
      M() && (bt.updateContainerSync(null, X, null, null), bt.flushSyncWork(), bt.flushPassiveEffects()), i.afterCommit = null, i.retries.length = 0, n.forgetBounds?.(b);
    }
  };
  return g;
}
//! `react-dom` for a screen on the native renderer: `createPortal` (into `document.body`, the overlay layer) and
//! `flushSync`. Nothing of the browser renderer.
const rm = (n) => bt.flushSyncFromReconciler(n), v1 = { createPortal: $l, flushSync: rm }, _4 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  createPortal: $l,
  default: v1,
  flushSync: rm
}, Symbol.toStringTag, { value: "Module" }));
function im(n) {
  var a, r, i = "";
  if (typeof n == "string" || typeof n == "number") i += n;
  else if (typeof n == "object") if (Array.isArray(n)) {
    var s = n.length;
    for (a = 0; a < s; a++) n[a] && (r = im(n[a])) && (i && (i += " "), i += r);
  } else for (r in n) n[r] && (i && (i += " "), i += r);
  return i;
}
function sm() {
  for (var n, a, r = 0, i = "", s = arguments.length; r < s; r++) (n = arguments[r]) && (a = im(n)) && (i && (i += " "), i += a);
  return i;
}
const y1 = (n, a) => {
  const r = new Array(n.length + a.length);
  for (let i = 0; i < n.length; i++)
    r[i] = n[i];
  for (let i = 0; i < a.length; i++)
    r[n.length + i] = a[i];
  return r;
}, x1 = (n, a) => ({
  classGroupId: n,
  validator: a
}), om = (n = /* @__PURE__ */ new Map(), a = null, r) => ({
  nextPart: n,
  validators: a,
  classGroupId: r
}), zi = "-", lp = [], w1 = "arbitrary..", k1 = (n) => {
  const a = S1(n), {
    conflictingClassGroups: r,
    conflictingClassGroupModifiers: i
  } = n;
  return {
    getClassGroupId: (f) => {
      if (f.startsWith("[") && f.endsWith("]"))
        return _1(f);
      const u = f.split(zi), m = u[0] === "" && u.length > 1 ? 1 : 0;
      return cm(u, m, a);
    },
    getConflictingClassGroupIds: (f, u) => {
      if (u) {
        const m = i[f], h = r[f];
        return m ? h ? y1(h, m) : m : h || lp;
      }
      return r[f] || lp;
    }
  };
}, cm = (n, a, r) => {
  if (n.length - a === 0)
    return r.classGroupId;
  const s = n[a], c = r.nextPart.get(s);
  if (c) {
    const h = cm(n, a + 1, c);
    if (h) return h;
  }
  const f = r.validators;
  if (f === null)
    return;
  const u = a === 0 ? n.join(zi) : n.slice(a).join(zi), m = f.length;
  for (let h = 0; h < m; h++) {
    const v = f[h];
    if (v.validator(u))
      return v.classGroupId;
  }
}, _1 = (n) => n.slice(1, -1).indexOf(":") === -1 ? void 0 : (() => {
  const a = n.slice(1, -1), r = a.indexOf(":"), i = a.slice(0, r);
  return i ? w1 + i : void 0;
})(), S1 = (n) => {
  const {
    theme: a,
    classGroups: r
  } = n;
  return E1(r, a);
}, E1 = (n, a) => {
  const r = om();
  for (const i in n) {
    const s = n[i];
    gc(s, r, i, a);
  }
  return r;
}, gc = (n, a, r, i) => {
  const s = n.length;
  for (let c = 0; c < s; c++) {
    const f = n[c];
    z1(f, a, r, i);
  }
}, z1 = (n, a, r, i) => {
  if (typeof n == "string") {
    N1(n, a, r);
    return;
  }
  if (typeof n == "function") {
    T1(n, a, r, i);
    return;
  }
  C1(n, a, r, i);
}, N1 = (n, a, r) => {
  const i = n === "" ? a : um(a, n);
  i.classGroupId = r;
}, T1 = (n, a, r, i) => {
  if (A1(n)) {
    gc(n(i), a, r, i);
    return;
  }
  a.validators === null && (a.validators = []), a.validators.push(x1(r, n));
}, C1 = (n, a, r, i) => {
  const s = Object.entries(n), c = s.length;
  for (let f = 0; f < c; f++) {
    const [u, m] = s[f];
    gc(m, um(a, u), r, i);
  }
}, um = (n, a) => {
  let r = n;
  const i = a.split(zi), s = i.length;
  for (let c = 0; c < s; c++) {
    const f = i[c];
    let u = r.nextPart.get(f);
    u || (u = om(), r.nextPart.set(f, u)), r = u;
  }
  return r;
}, A1 = (n) => "isThemeGetter" in n && n.isThemeGetter === !0, M1 = (n) => {
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
}, $o = "!", rp = ":", R1 = [], ip = (n, a, r, i, s) => ({
  modifiers: n,
  hasImportantModifier: a,
  baseClassName: r,
  maybePostfixModifierPosition: i,
  isExternal: s
}), j1 = (n) => {
  const {
    prefix: a,
    experimentalParseClassName: r
  } = n;
  let i = (s) => {
    const c = [];
    let f = 0, u = 0, m = 0, h;
    const v = s.length;
    for (let R = 0; R < v; R++) {
      const N = s[R];
      if (f === 0 && u === 0) {
        if (N === rp) {
          c.push(s.slice(m, R)), m = R + 1;
          continue;
        }
        if (N === "/") {
          h = R;
          continue;
        }
      }
      N === "[" ? f++ : N === "]" ? f-- : N === "(" ? u++ : N === ")" && u--;
    }
    const y = c.length === 0 ? s : s.slice(m);
    let b = y, S = !1;
    y.endsWith($o) ? (b = y.slice(0, -1), S = !0) : (
      /**
       * In Tailwind CSS v3 the important modifier was at the start of the base class name. This is still supported for legacy reasons.
       * @see https://github.com/dcastil/tailwind-merge/issues/513#issuecomment-2614029864
       */
      y.startsWith($o) && (b = y.slice(1), S = !0)
    );
    const E = h && h > m ? h - m : void 0;
    return ip(c, S, b, E);
  };
  if (a) {
    const s = a + rp, c = i;
    i = (f) => f.startsWith(s) ? c(f.slice(s.length)) : ip(R1, !1, f, void 0, !0);
  }
  if (r) {
    const s = i;
    i = (c) => r({
      className: c,
      parseClassName: s
    });
  }
  return i;
}, O1 = (n) => {
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
}, D1 = (n) => ({
  cache: M1(n.cacheSize),
  parseClassName: j1(n),
  sortModifiers: O1(n),
  postfixLookupClassGroupIds: B1(n),
  ...k1(n)
}), B1 = (n) => {
  const a = /* @__PURE__ */ Object.create(null), r = n.postfixLookupClassGroups;
  if (r)
    for (let i = 0; i < r.length; i++)
      a[r[i]] = !0;
  return a;
}, H1 = /\s+/, U1 = (n, a) => {
  const {
    parseClassName: r,
    getClassGroupId: i,
    getConflictingClassGroupIds: s,
    sortModifiers: c,
    postfixLookupClassGroupIds: f
  } = a, u = [], m = n.trim().split(H1);
  let h = "";
  for (let v = m.length - 1; v >= 0; v -= 1) {
    const y = m[v], {
      isExternal: b,
      modifiers: S,
      hasImportantModifier: E,
      baseClassName: R,
      maybePostfixModifierPosition: N
    } = r(y);
    if (b) {
      h = y + (h.length > 0 ? " " + h : h);
      continue;
    }
    let M = !!N, O;
    if (M) {
      const g = R.substring(0, N);
      O = i(g);
      const w = O && f[O] ? i(R) : void 0;
      w && w !== O && (O = w, M = !1);
    } else
      O = i(R);
    if (!O) {
      if (!M) {
        h = y + (h.length > 0 ? " " + h : h);
        continue;
      }
      if (O = i(R), !O) {
        h = y + (h.length > 0 ? " " + h : h);
        continue;
      }
      M = !1;
    }
    const H = S.length === 0 ? "" : S.length === 1 ? S[0] : c(S).join(":"), X = E ? H + $o : H, W = X + O;
    if (u.indexOf(W) > -1)
      continue;
    u.push(W);
    const D = s(O, M);
    for (let g = 0; g < D.length; ++g) {
      const w = D[g];
      u.push(X + w);
    }
    h = y + (h.length > 0 ? " " + h : h);
  }
  return h;
}, q1 = (...n) => {
  let a = 0, r, i, s = "";
  for (; a < n.length; )
    (r = n[a++]) && (i = dm(r)) && (s && (s += " "), s += i);
  return s;
}, dm = (n) => {
  if (typeof n == "string")
    return n;
  let a, r = "";
  for (let i = 0; i < n.length; i++)
    n[i] && (a = dm(n[i])) && (r && (r += " "), r += a);
  return r;
}, L1 = (n, ...a) => {
  let r, i, s, c;
  const f = (m) => {
    const h = a.reduce((v, y) => y(v), n());
    return r = D1(h), i = r.cache.get, s = r.cache.set, c = u, u(m);
  }, u = (m) => {
    const h = i(m);
    if (h)
      return h;
    const v = U1(m, r);
    return s(m, v), v;
  };
  return c = f, (...m) => c(q1(...m));
}, G1 = [], Ie = (n) => {
  const a = (r) => r[n] || G1;
  return a.isThemeGetter = !0, a.themeKey = n, a;
}, fm = /^\[(?:(\w[\w-]*):)?(.+)\]$/i, pm = /^\((?:(\w[\w-]*):)?(.+)\)$/i, Y1 = /^\d+(?:\.\d+)?\/\d+(?:\.\d+)?$/, Q1 = /^(\d+(\.\d+)?)?(xs|sm|md|lg|xl)$/, V1 = /\d+(%|px|r?em|[sdl]?v([hwib]|min|max)|pt|pc|in|cm|mm|cap|ch|ex|r?lh|cq(w|h|i|b|min|max))|\b(calc|min|max|clamp)\(.+\)|^0$/, K1 = /^(rgba?|hsla?|hwb|(ok)?(lab|lch)|color-mix|color|light-dark)\(.+\)$/, Z1 = /^(inset_)?-?((\d+)?\.?(\d+)[a-z]+|0)_-?((\d+)?\.?(\d+)[a-z]+|0)/, X1 = /^(url|image|image-set|cross-fade|element|(repeating-)?(linear|radial|conic)-gradient)\(.+\)$/, Gn = (n) => Y1.test(n), ye = (n) => !!n && !Number.isNaN(Number(n)), tn = (n) => !!n && Number.isInteger(Number(n)), Ro = (n) => n.endsWith("%") && ye(n.slice(0, -1)), xn = (n) => Q1.test(n), mm = () => !0, J1 = (n) => (
  // `colorFunctionRegex` check is necessary because color functions can have percentages in them which which would be incorrectly classified as lengths.
  // For example, `hsl(0 0% 0%)` would be classified as a length without this check.
  // I could also use lookbehind assertion in `lengthUnitRegex` but that isn't supported widely enough.
  V1.test(n) && !K1.test(n)
), bc = () => !1, $1 = (n) => Z1.test(n), W1 = (n) => X1.test(n), F1 = (n) => !re(n) && !ie(n), I1 = (n) => n.startsWith("@container") && (n[10] === "/" && n[11] !== void 0 || n[11] === "s" && n[16] !== void 0 && n.startsWith("-size/", 10) || n[11] === "n" && n[18] !== void 0 && n.startsWith("-normal/", 10)), P1 = (n) => $n(n, bm, bc), re = (n) => fm.test(n), ga = (n) => $n(n, vm, J1), sp = (n) => $n(n, sv, ye), ev = (n) => $n(n, xm, mm), tv = (n) => $n(n, ym, bc), op = (n) => $n(n, hm, bc), nv = (n) => $n(n, gm, W1), ai = (n) => $n(n, wm, $1), ie = (n) => pm.test(n), Ul = (n) => _a(n, vm), av = (n) => _a(n, ym), cp = (n) => _a(n, hm), lv = (n) => _a(n, bm), rv = (n) => _a(n, gm), li = (n) => _a(n, wm, !0), iv = (n) => _a(n, xm, !0), $n = (n, a, r) => {
  const i = fm.exec(n);
  return i ? i[1] ? a(i[1]) : r(i[2]) : !1;
}, _a = (n, a, r = !1) => {
  const i = pm.exec(n);
  return i ? i[1] ? a(i[1]) : r : !1;
}, hm = (n) => n === "position" || n === "percentage", gm = (n) => n === "image" || n === "url", bm = (n) => n === "length" || n === "size" || n === "bg-size", vm = (n) => n === "length", sv = (n) => n === "number", ym = (n) => n === "family-name", xm = (n) => n === "number" || n === "weight", wm = (n) => n === "shadow", ov = () => {
  const n = Ie("color"), a = Ie("font"), r = Ie("text"), i = Ie("font-weight"), s = Ie("tracking"), c = Ie("leading"), f = Ie("breakpoint"), u = Ie("container"), m = Ie("spacing"), h = Ie("radius"), v = Ie("shadow"), y = Ie("inset-shadow"), b = Ie("text-shadow"), S = Ie("drop-shadow"), E = Ie("blur"), R = Ie("perspective"), N = Ie("aspect"), M = Ie("ease"), O = Ie("animate"), H = () => ["auto", "avoid", "all", "avoid-page", "page", "left", "right", "column"], X = () => [
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
  ], W = () => [...X(), ie, re], D = () => ["auto", "hidden", "clip", "visible", "scroll"], g = () => ["auto", "contain", "none"], w = () => [ie, re, m], x = () => [Gn, "full", "auto", ...w()], _ = () => [tn, "none", "subgrid", ie, re], T = () => ["auto", {
    span: ["full", tn, ie, re]
  }, tn, ie, re], z = () => [tn, "auto", ie, re], j = () => ["auto", "min", "max", "fr", ie, re], V = () => ["start", "end", "center", "between", "around", "evenly", "stretch", "baseline", "center-safe", "end-safe"], $ = () => ["start", "end", "center", "stretch", "center-safe", "end-safe"], U = () => ["auto", ...w()], K = () => [Gn, "auto", "full", "dvw", "dvh", "lvw", "lvh", "svw", "svh", "min", "max", "fit", ...w()], I = () => [u, Gn, "screen", "full", "dvw", "lvw", "svw", "min", "max", "fit", ...w()], Q = () => [Gn, "screen", "full", "lh", "dvh", "lvh", "svh", "min", "max", "fit", ...w()], Z = () => [n, ie, re], C = () => [...X(), cp, op, {
    position: [ie, re]
  }], J = () => ["no-repeat", {
    repeat: ["", "x", "y", "space", "round"]
  }], ae = () => ["auto", "cover", "contain", lv, P1, {
    size: [ie, re]
  }], oe = () => [Ro, Ul, ga], ce = () => [
    // Deprecated since Tailwind CSS v4.0.0
    "",
    "none",
    "full",
    h,
    ie,
    re
  ], ue = () => ["", ye, Ul, ga], Ee = () => ["solid", "dashed", "dotted", "double"], Pe = () => ["normal", "multiply", "screen", "overlay", "darken", "lighten", "color-dodge", "color-burn", "hard-light", "soft-light", "difference", "exclusion", "hue", "saturation", "color", "luminosity"], he = () => [ye, Ro, cp, op], Fn = () => [
    // Deprecated since Tailwind CSS v4.0.0
    "",
    "none",
    E,
    ie,
    re
  ], In = () => ["none", ye, ie, re], qt = () => ["none", ye, ie, re], Lt = () => [ye, ie, re], kn = () => [Gn, "full", ...w()];
  return {
    cacheSize: 500,
    theme: {
      animate: ["spin", "ping", "pulse", "bounce"],
      aspect: ["video"],
      blur: [xn],
      breakpoint: [xn],
      color: [mm],
      container: [xn],
      "drop-shadow": [xn],
      ease: ["in", "out", "in-out"],
      font: [F1],
      "font-weight": ["thin", "extralight", "light", "normal", "medium", "semibold", "bold", "extrabold", "black"],
      "inset-shadow": [xn],
      leading: ["none", "tight", "snug", "normal", "relaxed", "loose"],
      perspective: ["dramatic", "near", "normal", "midrange", "distant", "none"],
      radius: [xn],
      shadow: [xn],
      spacing: ["px", ye],
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
        aspect: ["auto", "square", Gn, re, ie, N]
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
      "container-named": [I1],
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
        object: W()
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
        basis: [Gn, "full", "auto", u, ...w()]
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
        flex: [ye, Gn, "auto", "initial", "none", re]
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
        "auto-cols": j()
      }],
      /**
       * Grid Auto Rows
       * @see https://tailwindcss.com/docs/grid-auto-rows
       */
      "auto-rows": [{
        "auto-rows": j()
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
        justify: [...V(), "normal"]
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
        content: ["normal", ...V()]
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
        "place-content": V()
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
        size: K()
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
        w: [u, "screen", ...K()]
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
          ...K()
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
        text: ["base", r, Ul, ga]
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
        font: [i, iv, ev]
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
        font: [av, tv, a]
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
        "line-clamp": [ye, "none", ie, sp]
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
        decoration: [ye, "from-font", "auto", ie, ga]
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
        indent: w()
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
        bg: C()
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
          }, tn, ie, re],
          radial: ["", ie, re],
          conic: ["", tn, ie, re]
        }, rv, nv]
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
        outline: ["", ye, Ul, ga]
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
          v,
          li,
          ai
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
        "inset-shadow": ["none", y, li, ai]
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
        "ring-offset": [ye, ga]
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
        "text-shadow": ["none", b, li, ai]
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
        mask: C()
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
        blur: Fn()
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
          S,
          li,
          ai
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
        "backdrop-blur": Fn()
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
        duration: [ye, "initial", ie, re]
      }],
      /**
       * Transition Timing Function
       * @see https://tailwindcss.com/docs/transition-timing-function
       */
      ease: [{
        ease: ["linear", "initial", M, ie, re]
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
        "perspective-origin": W()
      }],
      /**
       * Rotate
       * @see https://tailwindcss.com/docs/rotate
       */
      rotate: [{
        rotate: In()
      }],
      /**
       * Rotate X
       * @see https://tailwindcss.com/docs/rotate
       */
      "rotate-x": [{
        "rotate-x": In()
      }],
      /**
       * Rotate Y
       * @see https://tailwindcss.com/docs/rotate
       */
      "rotate-y": [{
        "rotate-y": In()
      }],
      /**
       * Rotate Z
       * @see https://tailwindcss.com/docs/rotate
       */
      "rotate-z": [{
        "rotate-z": In()
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
        origin: W()
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
        fill: ["none", ...Z()]
      }],
      /**
       * Stroke Width
       * @see https://tailwindcss.com/docs/stroke-width
       */
      "stroke-w": [{
        stroke: [ye, Ul, ga, sp]
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
}, cv = /* @__PURE__ */ L1(ov);
function Oe(...n) {
  return cv(sm(n));
}
function uv(n, a, r) {
  return n.filter((i, s) => s !== a && (i.start + i.end) / 2 < r).length;
}
function dv(n, a, r, i) {
  const s = n.map(() => 0), c = n[a];
  if (!c) return s;
  const f = n[a + 1], u = n[a - 1], m = c.end - c.start + (f ? f.start - c.end : u ? c.start - u.end : 0);
  return n.forEach((h, v) => {
    a < r && v > a && v <= r ? s[v] = -m : r < a && v >= r && v < a && (s[v] = m);
  }), s[a] = Math.min(Math.max(i, n[0].start - c.start), n[n.length - 1].end - c.end), s;
}
const up = ["transform", "transition", "zIndex", "filter", "pointerEvents", "position"];
function fv(n, a) {
  for (let r = n.parentElement; r; r = r.parentElement) {
    const i = getComputedStyle(r)[a === "x" ? "overflowX" : "overflowY"];
    if ((i === "auto" || i === "scroll") && (a === "x" ? r.scrollWidth > r.clientWidth : r.scrollHeight > r.clientHeight)) return r;
  }
  return null;
}
function pv(n, a, r, i) {
  const s = n[a] ? fv(n[a], r) : null, c = () => s ? r === "x" ? s.scrollLeft : s.scrollTop : 0, f = (N) => (r === "x" ? N.clientX : N.clientY) + c(), u = f(i), m = c(), h = n.map((N) => {
    const M = N.getBoundingClientRect();
    return r === "x" ? { start: M.left + m, end: M.right + m } : { start: M.top + m, end: M.bottom + m };
  }), v = n.map((N) => up.map((M) => N.style[M])), y = typeof matchMedia == "function" && matchMedia("(prefers-reduced-motion: reduce)").matches, b = r === "x" ? "translateX" : "translateY";
  let S = !1;
  const E = { to: a };
  n.forEach((N, M) => {
    if (N.style.pointerEvents = "none", M !== a) {
      y || (N.style.transition = "transform 160ms cubic-bezier(0.2, 0.8, 0.2, 1)");
      return;
    }
    getComputedStyle(N).position === "static" && (N.style.position = "relative"), N.style.zIndex = "30", N.style.filter = "drop-shadow(0 6px 10px rgba(0, 0, 0, 0.45))";
  });
  const R = (N, M) => {
    E.to = N, dv(h, a, N, M).forEach((O, H) => {
      n[H].style.transform = O ? `${b}(${O}px)` : "";
    });
  };
  return {
    from: a,
    get to() {
      return E.to;
    },
    slot: (N) => uv(h, a, f(N)),
    apply: (N, M) => {
      S || R(N, f(M) - u);
    },
    rest: () => {
      S || R(a, 0);
    },
    end: () => {
      S || (S = !0, n.forEach((N, M) => up.forEach((O, H) => {
        N.style[O] = v[M][H];
      })));
    }
  };
}
const mv = 5;
let jo = !1;
function hv(n, a) {
  if (n.button !== 0 || jo) return;
  const r = { clientX: n.clientX, clientY: n.clientY }, i = n.currentTarget, s = n.pointerId;
  let c = null, f, u = !1;
  const m = { cursor: document.body.style.cursor, userSelect: document.body.style.userSelect }, h = (E) => {
    if (u) return;
    u = !0, window.removeEventListener("pointermove", v), window.removeEventListener("pointerup", y), window.removeEventListener("pointercancel", b), window.removeEventListener("keydown", S, !0), window.removeEventListener("blur", b), i.removeEventListener("lostpointercapture", b);
    try {
      i.releasePointerCapture(s);
    } catch {
    }
    if (!c) return;
    jo = !1, document.body.style.cursor = m.cursor, document.body.style.userSelect = m.userSelect, c.end();
    const R = (N) => N.stopPropagation();
    window.addEventListener("click", R, { capture: !0, once: !0 }), setTimeout(() => window.removeEventListener("click", R, !0), 0), f?.(), a.onEnd(E, c);
  }, v = (E) => {
    if (!c) {
      if (Math.hypot(E.clientX - r.clientX, E.clientY - r.clientY) < mv) return;
      const R = a.items();
      c = pv(R, a.from(R), a.axis, r), jo = !0, document.body.style.cursor = "grabbing", document.body.style.userSelect = "none";
      try {
        i.setPointerCapture(s);
      } catch {
      }
      i.addEventListener("lostpointercapture", b);
      const N = a.onStart?.();
      f = typeof N == "function" ? N : void 0;
    }
    a.onMove(E, c);
  }, y = () => h(!0), b = () => h(!1), S = (E) => {
    E.key === "Escape" && (E.stopPropagation(), h(!1));
  };
  window.addEventListener("pointermove", v), window.addEventListener("pointerup", y), window.addEventListener("pointercancel", b), window.addEventListener("keydown", S, !0), window.addEventListener("blur", b);
}
const km = typeof navigator < "u" && /Mac/i.test(navigator.platform), Ni = {
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
const gv = Object.fromEntries(Object.entries(Ni).map(([n, a]) => [a, n])), bv = {
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
function vv(n) {
  const a = /^Key([A-Z])$/.exec(n) ?? /^Digit(\d)$/.exec(n);
  return a ? a[1].toLowerCase() : gv[n];
}
const dp = /* @__PURE__ */ new Map();
function _m(n, a = km) {
  const r = `${a}|${n}`, i = dp.get(r);
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
  return dp.set(r, s), s;
}
new Set(["cmd+q", "cmd+h", "cmd+alt+h", "cmd+m", "cmd+ctrl+f", "cmd+z", "cmd+shift+z", "cmd+x", "cmd+c", "cmd+v", "cmd+a"].map((n) => {
  const a = _m(n, !0);
  return [a.cmd && "cmd", a.ctrl && "ctrl", a.alt && "alt", a.shift && "shift", a.code].filter(Boolean).join("+");
}));
function yv(n, a = km) {
  const r = _m(n, a), i = xv(vv(r.code) ?? "");
  return a ? `${r.ctrl ? "⌃" : ""}${r.alt ? "⌥" : ""}${r.shift ? "⇧" : ""}${r.cmd ? "⌘" : ""}${i}` : [r.ctrl && "Ctrl", r.alt && "Alt", r.shift && "Shift", i].filter(Boolean).join("+");
}
const xv = (n) => bv[n] ?? n.toUpperCase(), fp = (n) => typeof n == "boolean" ? `${n}` : n === 0 ? "0" : n, pp = sm, Bi = (n, a) => (r) => {
  var i;
  if (a?.variants == null) return pp(n, r?.class, r?.className);
  const { variants: s, defaultVariants: c } = a, f = Object.keys(s).map((h) => {
    const v = r?.[h], y = c?.[h];
    if (v === null) return null;
    const b = fp(v) || fp(y);
    return s[h][b];
  }), u = r && Object.entries(r).reduce((h, v) => {
    let [y, b] = v;
    return b === void 0 || (h[y] = b), h;
  }, {}), m = a == null || (i = a.compoundVariants) === null || i === void 0 ? void 0 : i.reduce((h, v) => {
    let { class: y, className: b, ...S } = v;
    return Object.entries(S).every((E) => {
      let [R, N] = E;
      return Array.isArray(N) ? N.includes({
        ...c,
        ...u
      }[R]) : {
        ...c,
        ...u
      }[R] === N;
    }) ? [
      ...h,
      y,
      b
    ] : h;
  }, []);
  return pp(n, f, m, r?.class, r?.className);
}, wv = Bi(
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
), kv = Bi(
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
function _v({ className: n, ...a } = {}) {
  return Oe(kv(a), n);
}
const Sm = "shrink-0 cursor-pointer rounded-ui bg-transparent px-[0.2rem] py-[0.1rem] text-[0.8rem] leading-none text-subtext-0 [font-family:inherit] [border:none] [transition:color_0.1s_ease,background_0.1s_ease] hover:bg-surface-1 hover:text-accent", Wl = "cursor-pointer rounded-ui bg-transparent text-subtext-0 [border:0] [font-family:inherit] [transition:color_0.1s_ease,background_0.1s_ease] hover:bg-surface-1 hover:text-fg focus-visible:bg-surface-1 focus-visible:text-fg disabled:cursor-not-allowed disabled:opacity-40", Sv = Bi(`${Wl} shrink-0 focus-visible:[outline:2px_solid_var(--accent)] focus-visible:[outline-offset:-2px]`, {
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
function Ev({ className: n, ...a } = {}) {
  return Oe(Sv(a), n);
}
const Hi = "overflow-hidden rounded-ui bg-surface-1 py-[0.3rem] shadow-[0_8px_24px_rgba(0,0,0,0.45)]", Wo = Bi(
  "pane-context-menu__item block w-full cursor-pointer bg-transparent px-[0.9rem] py-[0.45rem] text-left text-[0.82rem] [border:none] [font-family:inherit] [transition:background_0.1s_ease] hover:bg-surface-0 disabled:cursor-not-allowed disabled:bg-transparent disabled:opacity-40",
  { variants: { danger: { true: "text-red", false: "text-fg" } }, defaultVariants: { danger: !1 } }
), zv = "my-1 h-px bg-overlay-0";
function Nv({ size: n = 14, className: a }) {
  return /* @__PURE__ */ te.jsxs("svg", { className: a, width: n, height: n, viewBox: "0 0 16 16", fill: "currentColor", "aria-hidden": "true", children: [
    /* @__PURE__ */ te.jsx("circle", { cx: "3.5", cy: "8", r: "1.1" }),
    /* @__PURE__ */ te.jsx("circle", { cx: "8", cy: "8", r: "1.1" }),
    /* @__PURE__ */ te.jsx("circle", { cx: "12.5", cy: "8", r: "1.1" })
  ] });
}
function Tv({ size: n = 16, className: a }) {
  return /* @__PURE__ */ te.jsxs("svg", { className: a, width: n, height: n, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: "1.3", strokeLinejoin: "round", "aria-hidden": "true", children: [
    /* @__PURE__ */ te.jsx("path", { d: "M6.6 1.8h2.8l.4 1.6 1.1.6 1.5-.6 1.4 2.4-1.2 1.1v1.3l1.2 1.1-1.4 2.4-1.5-.6-1.1.6-.4 1.6H6.6l-.4-1.6-1.1-.6-1.5.6-1.4-2.4 1.2-1.1V7.3L2.2 6.2l1.4-2.4 1.5.6 1.1-.6z" }),
    /* @__PURE__ */ te.jsx("circle", { cx: "8", cy: "8", r: "2" })
  ] });
}
function Cv({ size: n = 14, className: a }) {
  return /* @__PURE__ */ te.jsx("svg", { className: a, width: n, height: n, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round", "aria-hidden": "true", children: /* @__PURE__ */ te.jsx("path", { d: "M3.5 3.5l9 9M12.5 3.5l-9 9" }) });
}
function Em({ size: n = 14, className: a }) {
  return /* @__PURE__ */ te.jsx("svg", { className: a, width: n, height: n, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round", "aria-hidden": "true", children: /* @__PURE__ */ te.jsx("path", { d: "M8 2.5v11M2.5 8h11" }) });
}
const mp = {
  connected: "host-state--connected bg-accent",
  connecting: "host-state--connecting animate-host-pulse bg-yellow",
  error: "host-state--error bg-red",
  disabled: "host-state--disabled bg-subtext-0"
};
function Av({ state: n, error: a }) {
  return /* @__PURE__ */ te.jsx(
    "span",
    {
      className: Oe("host-state inline-block h-2 w-2 shrink-0 rounded-[50%]", mp[n] ?? mp.disabled),
      title: n === "error" && a ? a : n
    }
  );
}
function Mv({ title: n, onClose: a, children: r, testId: i }) {
  return $l(
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
function vc() {
  return { async: !1, breaks: !1, extensions: null, gfm: !0, hooks: null, pedantic: !1, renderer: null, silent: !1, tokenizer: null, walkTokens: null };
}
var Sa = vc();
function zm(n) {
  Sa = n;
}
var ya = { exec: () => null };
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
var Rv = ((n = "") => {
  try {
    return !!new RegExp("(?<=1)(?<!1)" + n);
  } catch {
    return !1;
  }
})(), mt = { codeRemoveIndent: /^(?: {1,4}| {0,3}\t)/gm, outputLinkReplace: /\\([\[\]])/g, indentCodeCompensation: /^(\s+)(?:```)/, beginningSpace: /^\s+/, endingHash: /#$/, startingSpaceChar: /^ /, endingSpaceChar: / $/, nonSpaceChar: /[^ ]/, newLineCharGlobal: /\n/g, tabCharGlobal: /\t/g, multipleSpaceGlobal: /\s+/g, blankLine: /^[ \t]*$/, doubleBlankLine: /\n[ \t]*\n[ \t]*$/, blockquoteStart: /^ {0,3}>/, blockquoteSetextReplace: /\n {0,3}((?:=+|-+) *)(?=\n|$)/g, blockquoteSetextReplace2: /^ {0,3}>[ \t]?/gm, listReplaceNesting: /^ {1,4}(?=( {4})*[^ ])/g, listIsTask: /^\[[ xX]\] +\S/, listReplaceTask: /^\[[ xX]\] +/, listTaskCheckbox: /\[[ xX]\]/, anyLine: /\n.*\n/, hrefBrackets: /^<(.*)>$/, tableDelimiter: /[:|]/, tableAlignChars: /^\||\| *$/g, tableRowBlankLine: /\n[ \t]*$/, tableAlignRight: /^ *-+: *$/, tableAlignCenter: /^ *:-+: *$/, tableAlignLeft: /^ *:-+ *$/, startATag: /^<a /i, endATag: /^<\/a>/i, startPreScriptTag: /^<(pre|code|kbd|script)(\s|>)/i, endPreScriptTag: /^<\/(pre|code|kbd|script)(\s|>)/i, startAngleBracket: /^</, endAngleBracket: />$/, pedanticHrefTitle: /^([^'"]*[^\s])\s+(['"])(.*)\2/, unicodeAlphaNumeric: /[\p{L}\p{N}]/u, escapeTest: /[&<>"']/, escapeReplace: /[&<>"']/g, escapeTestNoEncode: /[<>"']|&(?!(#\d{1,7}|#[Xx][a-fA-F0-9]{1,6}|\w+);)/, escapeReplaceNoEncode: /[<>"']|&(?!(#\d{1,7}|#[Xx][a-fA-F0-9]{1,6}|\w+);)/g, caret: /(^|[^\[])\^/g, percentDecode: /%25/g, findPipe: /\|/g, splitPipe: / \|/, slashPipe: /\\\|/g, carriageReturn: /\r\n|\r/g, spaceLine: /^ +$/gm, notSpaceStart: /^\S*/, endingNewline: /\n$/, listItemRegex: (n) => new RegExp(`^( {0,3}${n})((?:[	 ][^\\n]*)?(?:\\n|$))`), nextBulletRegex: el((n) => new RegExp(`^ {0,${n}}(?:[*+-]|\\d{1,9}[.)])((?:[ 	][^\\n]*)?(?:\\n|$))`)), hrRegex: el((n) => new RegExp(`^ {0,${n}}((?:- *){3,}|(?:_ *){3,}|(?:\\* *){3,})(?:\\n+|$)`)), fencesBeginRegex: el((n) => new RegExp(`^ {0,${n}}(?:\`\`\`|~~~)`)), headingBeginRegex: el((n) => new RegExp(`^ {0,${n}}#`)), htmlBeginRegex: el((n) => new RegExp(`^ {0,${n}}<(?:[a-z].*>|!--)`, "i")), blockquoteBeginRegex: el((n) => new RegExp(`^ {0,${n}}>`)) }, jv = /^(?:[ \t]*(?:\n|$))+/, Ov = /^((?: {4}| {0,3}\t)[^\n]+(?:\n(?:[ \t]*(?:\n|$))*)?)+/, Dv = /^ {0,3}(`{3,}(?=[^`\n]*(?:\n|$))|~{3,})([^\n]*)(?:\n|$)(?:|([\s\S]*?)(?:\n|$))(?: {0,3}\1[~`]* *(?=\n|$)|$)/, Fl = /^ {0,3}((?:-[\t ]*){3,}|(?:_[ \t]*){3,}|(?:\*[ \t]*){3,})(?:\n+|$)/, Bv = /^ {0,3}(#{1,6})(?=\s|$)(.*)(?:\n+|$)/, yc = / {0,3}(?:[*+-]|\d{1,9}[.)])/, Nm = /^(?!bull |blockCode|fences|blockquote|heading|html|table)((?:.|\n(?!\s*?\n|bull |blockCode|fences|blockquote|heading|html|table))+?)\n {0,3}(=+|-+) *(?:\n+|$)/, Tm = ze(Nm).replace(/bull/g, yc).replace(/blockCode/g, /(?: {4}| {0,3}\t)/).replace(/fences/g, / {0,3}(?:`{3,}|~{3,})/).replace(/blockquote/g, / {0,3}>/).replace(/heading/g, / {0,3}#{1,6}(?:\s|$)/).replace(/html/g, / {0,3}<[^\n>]+>\n/).replace(/\|table/g, "").getRegex(), Hv = ze(Nm).replace(/bull/g, yc).replace(/blockCode/g, /(?: {4}| {0,3}\t)/).replace(/fences/g, / {0,3}(?:`{3,}|~{3,})/).replace(/blockquote/g, / {0,3}>/).replace(/heading/g, / {0,3}#{1,6}(?:\s|$)/).replace(/html/g, / {0,3}<[^\n>]+>\n/).replace(/table/g, / {0,3}\|?(?:[:\- ]*\|)+[\:\- ]*\n/).getRegex(), xc = /^([^\n]+(?:\n(?!hr|heading|lheading|blockquote|fences|list|html|table|[ \t]+\n)[^\n]+)*)/, Uv = /^[^\n]+/, wc = /(?!\s*\])(?:\\[\s\S]|[^\[\]\\])+/, qv = ze(/^ {0,3}\[(label)\]: *(?:\n[ \t]*)?([^<\s][^\s]*|<.*?>)(?:(?: +(?:\n[ \t]*)?| *\n[ \t]*)(title))? *(?:\n+|$)/).replace("label", wc).replace("title", /(?:"(?:\\"?|[^"\\])*"|'[^'\n]*(?:\n[^'\n]+)*\n?'|\([^()]*\))/).getRegex(), Lv = ze(/^(bull)([ \t][^\n]*?)?(?:\n|$)/).replace(/bull/g, yc).getRegex(), Ui = "address|article|aside|base|basefont|blockquote|body|caption|center|col|colgroup|dd|details|dialog|dir|div|dl|dt|fieldset|figcaption|figure|footer|form|frame|frameset|h[1-6]|head|header|hr|html|iframe|legend|li|link|main|menu|menuitem|meta|nav|noframes|ol|optgroup|option|p|param|search|section|summary|table|tbody|td|tfoot|th|thead|title|tr|track|ul", kc = /<!--(?:-?>|[\s\S]*?(?:-->|$))/, Gv = ze("^ {0,3}(?:<(script|pre|style|textarea)[\\s>][\\s\\S]*?(?:</\\1>[^\\n]*\\n*|$)|comment[^\\n]*(\\n+|$)|<\\?[\\s\\S]*?(?:\\?>[^\\n]*\\n*|$)|<![A-Z][\\s\\S]*?(?:>[^\\n]*\\n*|$)|<!\\[CDATA\\[[\\s\\S]*?(?:\\]\\]>[^\\n]*\\n*|$)|</?(tag)(?: +|\\n|/?>)[\\s\\S]*?(?:(?:\\n[ 	]*)+\\n|$)|<(?!script|pre|style|textarea)([a-z][\\w-]*)(?:attribute)*? */?>(?=[ \\t]*(?:\\n|$))[\\s\\S]*?(?:(?:\\n[ 	]*)+\\n|$)|</(?!script|pre|style|textarea)[a-z][\\w-]*\\s*>(?=[ \\t]*(?:\\n|$))[\\s\\S]*?(?:(?:\\n[ 	]*)+\\n|$))", "i").replace("comment", kc).replace("tag", Ui).replace("attribute", / +[a-zA-Z:_][\w.:-]*(?: *= *"[^"\n]*"| *= *'[^'\n]*'| *= *[^\s"'=<>`]+)?/).getRegex(), Cm = (n) => ze(xc).replace("hr", Fl).replace("heading", " {0,3}#{1,6}(?:\\s|$)").replace("|lheading", "").replace("|table", "").replace("blockquote", " {0,3}>").replace("fences", " {0,3}(?:`{3,}(?=[^`\\n]*\\n)|~~~)[^\\n]*\\n").replace("list", n).replace("html", "</?(?:tag)(?: +|\\n|/?>)|<(?:script|pre|style|textarea|!--)").replace("tag", Ui).getRegex(), Yv = Cm(/ {0,3}(?:[*+-]|1[.)])[ \t]+[^ \t\n]/), Qv = Cm(/ {0,3}(?:[*+-]|\d{1,9}[.)])(?:[ \t]|\n|$)/), Vv = ze(/^( {0,3}> ?(paragraph|[^\n]*)(?:\n|$))+/).replace("paragraph", Qv).getRegex(), _c = { blockquote: Vv, code: Ov, def: qv, fences: Dv, heading: Bv, hr: Fl, html: Gv, lheading: Tm, list: Lv, newline: jv, paragraph: Yv, table: ya, text: Uv }, hp = ze("^ *([^\\n ].*)\\n {0,3}((?:\\| *)?:?-+:? *(?:\\| *:?-+:? *)*(?:\\| *)?)(?:\\n((?:(?! *\\n|hr|heading|blockquote|code|fences|list|html).*(?:\\n|$))*)\\n*|$)").replace("hr", Fl).replace("heading", " {0,3}#{1,6}(?:\\s|$)").replace("blockquote", " {0,3}>").replace("code", "(?: {4}| {0,3}	)[^\\n]").replace("fences", " {0,3}(?:`{3,}(?=[^`\\n]*\\n)|~~~)[^\\n]*\\n").replace("list", " {0,3}(?:[*+-]|1[.)])[ \\t]").replace("html", "</?(?:tag)(?: +|\\n|/?>)|<(?:script|pre|style|textarea|!--)").replace("tag", Ui).getRegex(), Kv = { ..._c, lheading: Hv, table: hp, paragraph: ze(xc).replace("hr", Fl).replace("heading", " {0,3}#{1,6}(?:\\s|$)").replace("|lheading", "").replace("table", hp).replace("blockquote", " {0,3}>").replace("fences", " {0,3}(?:`{3,}(?=[^`\\n]*\\n)|~~~)[^\\n]*\\n").replace("list", " {0,3}(?:[*+-]|1[.)])[ \\t]+[^ \\t\\n]").replace("html", "</?(?:tag)(?: +|\\n|/?>)|<(?:script|pre|style|textarea|!--)").replace("tag", Ui).getRegex() }, Zv = { ..._c, html: ze(`^ *(?:comment *(?:\\n|\\s*$)|<(tag)[\\s\\S]+?</\\1> *(?:\\n{2,}|\\s*$)|<tag(?:"[^"]*"|'[^']*'|\\s[^'"/>\\s]*)*?/?> *(?:\\n{2,}|\\s*$))`).replace("comment", kc).replace(/tag/g, "(?!(?:a|em|strong|small|s|cite|q|dfn|abbr|data|time|code|var|samp|kbd|sub|sup|i|b|u|mark|ruby|rt|rp|bdi|bdo|span|br|wbr|ins|del|img)\\b)\\w+(?!:|[^\\w\\s@]*@)\\b").getRegex(), def: /^ *\[([^\]]+)\]: *<?([^\s>]+)>?(?: +(["(][^\n]+[")]))? *(?:\n+|$)/, heading: /^(#{1,6})(.*)(?:\n+|$)/, fences: ya, lheading: /^(.+?)\n {0,3}(=+|-+) *(?:\n+|$)/, paragraph: ze(xc).replace("hr", Fl).replace("heading", ` *#{1,6} *[^
]`).replace("lheading", Tm).replace("|table", "").replace("blockquote", " {0,3}>").replace("|fences", "").replace("|list", "").replace("|html", "").replace("|tag", "").getRegex() }, Xv = /^\\([!"#$%&'()*+,\-./:;<=>?@\[\]\\^_`{|}~])/, Jv = /^(`+)([^`]|[^`][\s\S]*?[^`])\1(?!`)/, Am = /^( {2,}|\\)\n(?!\s*$)/, $v = /^(`+|[^`])(?:(?= {2,}\n)|[\s\S]*?(?:(?=[\\<!\[`*_]|\b_|$)|[^ ](?= {2,}\n)))/, al = /[\p{P}\p{S}]/u, qi = /[\s\p{P}\p{S}]/u, Sc = /[^\s\p{P}\p{S}]/u, Wv = ze(/^((?![*_])punctSpace)/, "u").replace(/punctSpace/g, qi).getRegex(), Mm = /(?!~)[\p{P}\p{S}]/u, Fv = /(?!~)[\s\p{P}\p{S}]/u, Iv = /(?:[^\s\p{P}\p{S}]|~)/u, Pv = ze(/link|precode-code|html/, "g").replace("link", /\[(?:[^\[\]`]|(?<a>`+)[^`]+\k<a>(?!`))*?\]\((?:\\[\s\S]|[^\\\(\)]|\((?:\\[\s\S]|[^\\\(\)])*\))*\)/).replace("precode-", Rv ? "(?<!`)()" : "(^^|[^`])").replace("code", /(?<b>`+)[^`]+\k<b>(?!`)/).replace("html", /<(?! )[^<>]*?>/).getRegex(), Rm = /^(?:\*+(?:((?!\*)punct)|([^\s*]))?)|^_+(?:((?!_)punct)|([^\s_]))?/, ey = ze(Rm, "u").replace(/punct/g, al).getRegex(), ty = ze(Rm, "u").replace(/punct/g, Mm).getRegex(), jm = "^[^_*]*?__[^_*]*?\\*[^_*]*?(?=__)|[^*]+(?=[^*])|(?!\\*)punct(\\*+)(?=[\\s]|$)|notPunctSpace(\\*+)(?!\\*)(?=punctSpace|$)|(?!\\*)punctSpace(\\*+)(?=notPunctSpace)|[\\s](\\*+)(?!\\*)(?=punct)|(?!\\*)punct(\\*+)(?!\\*)(?=punct)|notPunctSpace(\\*+)(?=notPunctSpace)", ny = ze(jm, "gu").replace(/notPunctSpace/g, Sc).replace(/punctSpace/g, qi).replace(/punct/g, al).getRegex(), ay = ze(jm, "gu").replace(/notPunctSpace/g, Iv).replace(/punctSpace/g, Fv).replace(/punct/g, Mm).getRegex(), ly = ze("^[^_*]*?\\*\\*[^_*]*?_[^_*]*?(?=\\*\\*)|[^_]+(?=[^_])|(?!_)punct(_+)(?=[\\s]|$)|notPunctSpace(_+)(?!_)(?=punctSpace|$)|(?!_)punctSpace(_+)(?=notPunctSpace)|[\\s](_+)(?!_)(?=punct)|(?!_)punct(_+)(?!_)(?=punct)", "gu").replace(/notPunctSpace/g, Sc).replace(/punctSpace/g, qi).replace(/punct/g, al).getRegex(), ry = ze(/^~~?(?:((?!~)punct)|[^\s~])/, "u").replace(/punct/g, al).getRegex(), iy = "^[^~]+(?=[^~])|(?!~)punct(~~?)(?=[\\s]|$)|notPunctSpace(~~?)(?!~)(?=punctSpace|$)|(?!~)punctSpace(~~?)(?=notPunctSpace)|[\\s](~~?)(?!~)(?=punct)|(?!~)punct(~~?)(?!~)(?=punct)|notPunctSpace(~~?)(?=notPunctSpace)", sy = ze(iy, "gu").replace(/notPunctSpace/g, Sc).replace(/punctSpace/g, qi).replace(/punct/g, al).getRegex(), oy = ze(/\\(punct)/, "gu").replace(/punct/g, al).getRegex(), cy = ze(/^<(scheme:[^\s\x00-\x1f<>]*|email)>/).replace("scheme", /[a-zA-Z][a-zA-Z0-9+.-]{1,31}/).replace("email", /[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+(@)[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+(?![-_])/).getRegex(), uy = ze(kc).replace("(?:-->|$)", "-->").getRegex(), dy = ze("^comment|^</[a-zA-Z][\\w:-]*\\s*>|^<[a-zA-Z][\\w-]*(?:attribute)*?\\s*/?>|^<\\?[\\s\\S]*?\\?>|^<![a-zA-Z]+\\s[\\s\\S]*?>|^<!\\[CDATA\\[[\\s\\S]*?\\]\\]>").replace("comment", uy).replace("attribute", /\s+[a-zA-Z:_][\w.:-]*(?:\s*=\s*"[^"]*"|\s*=\s*'[^']*'|\s*=\s*[^\s"'=<>`]+)?/).getRegex(), Ti = /(?:\[(?:\\[\s\S]|[^\[\]\\])*\]|\\[\s\S]|`+(?!`)[^`]*?`+(?!`)|``+(?=\])|[^\[\]\\`])*?/, fy = ze(/^!?\[(label)\]\(\s*(href)(?:(?:[ \t]+(?:\n[ \t]*)?|\n[ \t]*)(title))?\s*\)/).replace("label", Ti).replace("href", /<(?:\\.|[^\n<>\\])+>|[^ \t\n\x00-\x1f]+|(?=\))/).replace("title", /"(?:\\"?|[^"\\])*"|'(?:\\'?|[^'\\])*'|\((?:\\\)?|[^)\\])*\)/).getRegex(), Om = ze(/^!?\[(label)\]\[(ref)\]/).replace("label", Ti).replace("ref", wc).getRegex(), Dm = ze(/^!?\[(ref)\](?:\[\])?/).replace("ref", wc).getRegex(), py = ze("reflink|nolink(?!\\()", "g").replace("reflink", Om).replace("nolink", Dm).getRegex(), gp = /[hH][tT][tT][pP][sS]?|[fF][tT][pP]/, Ec = { _backpedal: ya, anyPunctuation: oy, autolink: cy, blockSkip: Pv, br: Am, code: Jv, del: ya, delLDelim: ya, delRDelim: ya, emStrongLDelim: ey, emStrongRDelimAst: ny, emStrongRDelimUnd: ly, escape: Xv, link: fy, nolink: Dm, punctuation: Wv, reflink: Om, reflinkSearch: py, tag: dy, text: $v, url: ya }, my = { ...Ec, link: ze(/^!?\[(label)\]\((.*?)\)/).replace("label", Ti).getRegex(), reflink: ze(/^!?\[(label)\]\s*\[([^\]]*)\]/).replace("label", Ti).getRegex() }, Fo = { ...Ec, emStrongRDelimAst: ay, emStrongLDelim: ty, delLDelim: ry, delRDelim: sy, url: ze(/^((?:protocol):\/\/|www\.)(?:[a-zA-Z0-9\-]+\.?)+[^\s<]*|^email/).replace("protocol", gp).replace("email", /[A-Za-z0-9._+-]+(@)[a-zA-Z0-9-_]+(?:\.[a-zA-Z0-9-_]*[a-zA-Z0-9])+(?![-_])/).getRegex(), _backpedal: /(?:[^?!.,:;*_'"~()&]+|\([^)]*\)|&(?![a-zA-Z0-9]+;$)|[?!.,:;*_'"~)]+(?!$))+/, del: /^(~~?)(?=[^\s~])((?:\\[\s\S]|[^\\])*?(?:\\[\s\S]|[^\s~\\]))\1(?=[^~]|$)/, text: ze(/^(`+|~+|[^`~])(?:(?=[`~])|(?= {2,}\n)|(?=[a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-]+@)|[\s\S]*?(?:(?=[\\<!\[`*~_]|\b_|protocol:\/\/|www\.|$)|[^ ](?= {2,}\n)|[^a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-](?=[a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-]+@)))/).replace("protocol", gp).getRegex() }, hy = { ...Fo, br: ze(Am).replace("{2,}", "*").getRegex(), text: ze(Fo.text).replace("\\b_", "\\b_| {2,}\\n").replace(/\{2,\}/g, "*").getRegex() }, ri = { normal: _c, gfm: Kv, pedantic: Zv }, ql = { normal: Ec, gfm: Fo, breaks: hy, pedantic: my }, gy = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }, bp = (n) => gy[n];
function nn(n, a) {
  if (a) {
    if (mt.escapeTest.test(n)) return n.replace(mt.escapeReplace, bp);
  } else if (mt.escapeTestNoEncode.test(n)) return n.replace(mt.escapeReplaceNoEncode, bp);
  return n;
}
function vp(n) {
  try {
    n = encodeURI(n).replace(mt.percentDecode, "%");
  } catch {
    return null;
  }
  return n;
}
function yp(n, a) {
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
function Yn(n, a, r) {
  let i = n.length;
  if (i === 0) return "";
  let s = 0;
  for (; s < i && n.charAt(i - s - 1) === a; )
    s++;
  return n.slice(0, i - s);
}
function xp(n) {
  let a = n.split(`
`), r = a.length - 1;
  for (; r >= 0 && mt.blankLine.test(a[r]); ) r--;
  return a.length - r <= 2 ? n : a.slice(0, r + 1).join(`
`);
}
function by(n, a) {
  if (n.indexOf(a[1]) === -1) return -1;
  let r = 0;
  for (let i = 0; i < n.length; i++) if (n[i] === "\\") i++;
  else if (n[i] === a[0]) r++;
  else if (n[i] === a[1] && (r--, r < 0)) return i;
  return r > 0 ? -2 : -1;
}
function vy(n, a = 0) {
  let r = a, i = "";
  for (let s of n) if (s === "	") {
    let c = 4 - r % 4;
    i += " ".repeat(c), r += c;
  } else i += s, r++;
  return i;
}
function wp(n, a, r, i, s) {
  let c = a.href, f = a.title || null, u = n[1].replace(s.other.outputLinkReplace, "$1");
  i.state.inLink = !0;
  let m = { type: n[0].charAt(0) === "!" ? "image" : "link", raw: r, href: c, title: f, text: u, tokens: i.inlineTokens(u) };
  return i.state.inLink = !1, m;
}
function yy(n, a, r) {
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
      let r = this.options.pedantic ? a[0] : xp(a[0]), i = r.replace(this.rules.other.codeRemoveIndent, "");
      return { type: "code", raw: r, codeBlockStyle: "indented", text: i };
    }
  }
  fences(n) {
    let a = this.rules.block.fences.exec(n);
    if (a) {
      let r = a[0], i = yy(r, a[3] || "", this.rules);
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
        let f = !1, u = [], m;
        for (m = 0; m < r.length; m++) if (this.rules.other.blockquoteStart.test(r[m])) u.push(r[m]), f = !0;
        else if (!f) u.push(r[m]);
        else break;
        r = r.slice(m);
        let h = u.join(`
`), v = h.replace(this.rules.other.blockquoteSetextReplace, `
    $1`).replace(this.rules.other.blockquoteSetextReplace2, "");
        i = i ? `${i}
${h}` : h, s = s ? `${s}
${v}` : v;
        let y = this.lexer.state.top;
        if (this.lexer.state.top = !0, this.lexer.blockTokens(v, c, !0), this.lexer.state.top = y, r.length === 0) break;
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
        let m = !1, h = "", v = "";
        if (!(a = c.exec(n)) || this.rules.block.hr.test(n)) break;
        h = a[0], n = n.substring(h.length);
        let y = vy(a[2].split(`
`, 1)[0], a[1].length), b = n.split(`
`, 1)[0], S = !y.trim(), E = 0;
        if (this.options.pedantic ? (E = 2, v = y.trimStart()) : S ? E = a[1].length + 1 : (E = y.search(this.rules.other.nonSpaceChar), E = E > 4 ? 1 : E, v = y.slice(E), E += a[1].length), S && this.rules.other.blankLine.test(b) && (h += b + `
`, n = n.substring(b.length + 1), m = !0), !m) {
          let R = this.rules.other.nextBulletRegex(E), N = this.rules.other.hrRegex(E), M = this.rules.other.fencesBeginRegex(E), O = this.rules.other.headingBeginRegex(E), H = this.rules.other.htmlBeginRegex(E), X = this.rules.other.blockquoteBeginRegex(E);
          for (; n; ) {
            let W = n.split(`
`, 1)[0], D;
            if (b = W, this.options.pedantic ? (b = b.replace(this.rules.other.listReplaceNesting, "  "), D = b) : D = b.replace(this.rules.other.tabCharGlobal, "    "), M.test(b) || O.test(b) || H.test(b) || X.test(b) || R.test(b) || N.test(b)) break;
            if (D.search(this.rules.other.nonSpaceChar) >= E || !b.trim()) v += `
` + D.slice(E);
            else {
              if (S || y.replace(this.rules.other.tabCharGlobal, "    ").search(this.rules.other.nonSpaceChar) >= 4 || M.test(y) || O.test(y) || N.test(y)) break;
              v += `
` + b;
            }
            S = !b.trim(), h += W + `
`, n = n.substring(W.length + 1), y = D.slice(E);
          }
        }
        s.loose || (f ? s.loose = !0 : this.rules.other.doubleBlankLine.test(h) && (f = !0)), s.items.push({ type: "list_item", raw: h, task: !!this.options.gfm && this.rules.other.listIsTask.test(v), loose: !1, text: v, tokens: [] }), s.raw += h;
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
          for (let y = this.lexer.inlineQueue.length - 1; y >= 0; y--) if (this.rules.other.listIsTask.test(this.lexer.inlineQueue[y].src)) {
            this.lexer.inlineQueue[y].src = this.lexer.inlineQueue[y].src.replace(this.rules.other.listReplaceTask, "");
            break;
          }
          let v = this.rules.other.listTaskCheckbox.exec(m.raw);
          if (v) {
            let y = { type: "checkbox", raw: v[0] + " ", checked: v[0] !== "[ ]" };
            m.checked = y.checked, s.loose ? m.tokens[0] && ["paragraph", "text"].includes(m.tokens[0].type) && "tokens" in m.tokens[0] && m.tokens[0].tokens ? (m.tokens[0].raw = y.raw + m.tokens[0].raw, m.tokens[0].text = y.raw + m.tokens[0].text, m.tokens[0].tokens.unshift(y)) : m.tokens.unshift({ type: "paragraph", raw: y.raw, text: y.raw, tokens: [y] }) : m.tokens.unshift(y);
          }
        } else m.task && (m.task = !1);
        if (!s.loose) {
          let v = m.tokens.filter((b) => b.type === "space"), y = v.length > 0 && v.some((b) => this.rules.other.anyLine.test(b.raw));
          s.loose = y;
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
      let r = xp(a[0]);
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
    let r = yp(a[1]), i = a[2].replace(this.rules.other.tableAlignChars, "").split("|"), s = a[3]?.trim() ? a[3].replace(this.rules.other.tableRowBlankLine, "").split(`
`) : [], c = { type: "table", raw: Yn(a[0], `
`), header: [], align: [], rows: [] };
    if (r.length === i.length) {
      for (let f of i) this.rules.other.tableAlignRight.test(f) ? c.align.push("right") : this.rules.other.tableAlignCenter.test(f) ? c.align.push("center") : this.rules.other.tableAlignLeft.test(f) ? c.align.push("left") : c.align.push(null);
      for (let f = 0; f < r.length; f++) c.header.push({ text: r[f], tokens: this.lexer.inline(r[f]), header: !0, align: c.align[f] });
      for (let f of s) c.rows.push(yp(f, c.header.length).map((u, m) => ({ text: u, tokens: this.lexer.inline(u), header: !1, align: c.align[m] })));
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
        let c = by(a[2], "()");
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
      return i = i.trim(), this.rules.other.startAngleBracket.test(i) && (this.options.pedantic && !this.rules.other.endAngleBracket.test(r) ? i = i.slice(1) : i = i.slice(1, -1)), wp(a, { href: i && i.replace(this.rules.inline.anyPunctuation, "$1"), title: s && s.replace(this.rules.inline.anyPunctuation, "$1") }, a[0], this.lexer, this.rules);
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
      return wp(r, s, r[0], this.lexer, this.rules);
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
        let v = [...i[0]][0].length, y = n.slice(0, s + i.index + v + f);
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
      let s = [...i[0]].length - 1, c, f, u = s, m = this.rules.inline.delRDelim;
      for (m.lastIndex = 0, a = a.slice(-1 * n.length + s); (i = m.exec(a)) !== null; ) {
        if (c = i[1] || i[2] || i[3] || i[4] || i[5] || i[6], !c || (f = [...c].length, f !== s)) continue;
        if (i[3] || i[4]) {
          u += f;
          continue;
        }
        if (u -= f, u > 0) continue;
        f = Math.min(f, f + u);
        let h = [...i[0]][0].length, v = n.slice(0, s + i.index + h + f), y = v.slice(s, -s);
        return { type: "del", raw: v, text: y, tokens: this.lexer.inlineTokens(y) };
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
}, Ht = class Io {
  tokens;
  options;
  state;
  inlineQueue;
  tokenizer;
  constructor(a) {
    this.tokens = [], this.tokens.links = /* @__PURE__ */ Object.create(null), this.options = a || Sa, this.options.tokenizer = this.options.tokenizer || new Ci(), this.tokenizer = this.options.tokenizer, this.tokenizer.options = this.options, this.tokenizer.lexer = this, this.inlineQueue = [], this.state = { inLink: !1, inRawBlock: !1, top: !0 };
    let r = { other: mt, block: ri.normal, inline: ql.normal };
    this.options.pedantic ? (r.block = ri.pedantic, r.inline = ql.pedantic) : this.options.gfm && (r.block = ri.gfm, this.options.breaks ? r.inline = ql.breaks : r.inline = ql.gfm), this.tokenizer.rules = r;
  }
  static get rules() {
    return { block: ri, inline: ql };
  }
  static lex(a, r) {
    return new Io(r).lex(a);
  }
  static lexInline(a, r) {
    return new Io(r).inlineTokens(a);
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
        this.options.extensions.startBlock.forEach((v) => {
          h = v.call({ lexer: this }, m), typeof h == "number" && h >= 0 && (u = Math.min(u, h));
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
      let v = h ? h.length : 0;
      return u.slice(0, v) + "[" + "a".repeat(u.length - v - 2) + "]";
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
        let h = 1 / 0, v = a.slice(1), y;
        this.options.extensions.startInline.forEach((b) => {
          y = b.call({ lexer: this }, v), typeof y == "number" && y >= 0 && (h = Math.min(h, y));
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
    let i = this.parser.parseInline(r), s = vp(n);
    if (s === null) return i;
    n = s;
    let c = '<a href="' + n + '"';
    return a && (c += ' title="' + nn(a) + '"'), c += ">" + i + "</a>", c;
  }
  image({ href: n, title: a, text: r, tokens: i }) {
    i && (r = this.parser.parseInline(i, this.parser.textRenderer));
    let s = vp(n);
    if (s === null) return nn(r);
    n = s;
    let c = `<img src="${n}" alt="${nn(r)}"`;
    return a && (c += ` title="${nn(a)}"`), c += ">", c;
  }
  text(n) {
    return "tokens" in n && n.tokens ? this.parser.parseInline(n.tokens) : "escaped" in n && n.escaped ? n.text : nn(n.text);
  }
}, zc = class {
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
}, Xt = class Po {
  options;
  renderer;
  textRenderer;
  constructor(a) {
    this.options = a || Sa, this.options.renderer = this.options.renderer || new Ai(), this.renderer = this.options.renderer, this.renderer.options = this.options, this.renderer.parser = this, this.textRenderer = new zc();
  }
  static parse(a, r) {
    return new Po(r).parse(a);
  }
  static parseInline(a, r) {
    return new Po(r).parseInline(a);
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
    return n ? Xt.parse : Xt.parseInline;
  }
}, xy = class {
  defaults = vc();
  options = this.setOptions;
  parse = this.parseMarkdown(!0);
  parseInline = this.parseMarkdown(!1);
  Parser = Xt;
  Renderer = Ai;
  TextRenderer = zc;
  Lexer = Ht;
  Tokenizer = Ci;
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
        let s = this.defaults.renderer || new Ai(this.defaults);
        for (let c in r.renderer) {
          if (!(c in s)) throw new Error(`renderer '${c}' does not exist`);
          if (["options", "parser"].includes(c)) continue;
          let f = c, u = r.renderer[f], m = s[f];
          s[f] = (...h) => {
            let v = u.apply(s, h);
            return v === !1 && (v = m.apply(s, h)), v || "";
          };
        }
        i.renderer = s;
      }
      if (r.tokenizer) {
        let s = this.defaults.tokenizer || new Ci(this.defaults);
        for (let c in r.tokenizer) {
          if (!(c in s)) throw new Error(`tokenizer '${c}' does not exist`);
          if (["options", "rules", "lexer"].includes(c)) continue;
          let f = c, u = r.tokenizer[f], m = s[f];
          s[f] = (...h) => {
            let v = u.apply(s, h);
            return v === !1 && (v = m.apply(s, h)), v;
          };
        }
        i.tokenizer = s;
      }
      if (r.hooks) {
        let s = this.defaults.hooks || new Gl();
        for (let c in r.hooks) {
          if (!(c in s)) throw new Error(`hook '${c}' does not exist`);
          if (["options", "block"].includes(c)) continue;
          let f = c, u = r.hooks[f], m = s[f];
          Gl.passThroughHooks.has(c) ? s[f] = (h) => {
            if (this.defaults.async && Gl.passThroughHooksRespectAsync.has(c)) return (async () => {
              let y = await u.call(s, h);
              return m.call(s, y);
            })();
            let v = u.call(s, h);
            return m.call(s, v);
          } : s[f] = (...h) => {
            if (this.defaults.async) return (async () => {
              let y = await u.apply(s, h);
              return y === !1 && (y = await m.apply(s, h)), y;
            })();
            let v = u.apply(s, h);
            return v === !1 && (v = m.apply(s, h)), v;
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
    return Xt.parse(n, a ?? this.defaults);
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
        let h = await (s.hooks ? await s.hooks.provideParser(n) : n ? Xt.parse : Xt.parseInline)(m, s);
        return s.hooks ? await s.hooks.postprocess(h) : h;
      })().catch(c);
      try {
        s.hooks && (a = s.hooks.preprocess(a));
        let f = (s.hooks ? s.hooks.provideLexer(n) : n ? Ht.lex : Ht.lexInline)(a, s);
        s.hooks && (f = s.hooks.processAllTokens(f)), s.walkTokens && this.walkTokens(f, s.walkTokens);
        let u = (s.hooks ? s.hooks.provideParser(n) : n ? Xt.parse : Xt.parseInline)(f, s);
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
}, ka = new xy();
function Re(n, a) {
  return ka.parse(n, a);
}
Re.options = Re.setOptions = function(n) {
  return ka.setOptions(n), Re.defaults = ka.defaults, zm(Re.defaults), Re;
};
Re.getDefaults = vc;
Re.defaults = Sa;
Re.use = function(...n) {
  return ka.use(...n), Re.defaults = ka.defaults, zm(Re.defaults), Re;
};
Re.walkTokens = function(n, a) {
  return ka.walkTokens(n, a);
};
Re.parseInline = ka.parseInline;
Re.Parser = Xt;
Re.parser = Xt.parse;
Re.Renderer = Ai;
Re.TextRenderer = zc;
Re.Lexer = Ht;
Re.lexer = Ht.lex;
Re.Tokenizer = Ci;
Re.Hooks = Gl;
Re.parse = Re;
Re.options;
Re.setOptions;
Re.use;
Re.walkTokens;
Re.parseInline;
Xt.parse;
Ht.lex;
//! markdown.mjs: a Markdown file's rendered preview, drawn from `marked`'s tokens into a fixed set of elements, the
//! ones the web's sanitised preview keeps (`renderFilePreview` in `packages/web/src/markdown.ts`), so the web's
//! `.file-markdown` rules style both. Nothing is parsed as HTML: an HTML token is drawn as its text. Nothing loads on
//! its own: an image is the web's text placeholder (`[image: alt] url`). A link is drawn only for an absolute
//! http(s) address and opens on an explicit click through the window (`link.open`); any other keeps its address as
//! its title, as the web's does.
const pi = 2e5;
function wy(n) {
  if (n.length <= pi) return { source: n, truncated: !1 };
  const a = n.lastIndexOf(`
`, pi);
  return { source: n.slice(0, a > 0 ? a : pi), truncated: !0 };
}
const ky = (n, a, r) => {
  const i = r.startsWith("data:") ? "data URL" : r.length > 200 ? `${r.slice(0, 200)}…` : r;
  return `[${n}${a ? `: ${a}` : ""}]${i ? ` ${i}` : ""}`;
};
function xa(n, a) {
  return (n ?? []).map((r, i) => _y(r, i, a));
}
function ba(n, a) {
  return n.tokens ? xa(n.tokens, a) : n.text;
}
function _y(n, a, r) {
  switch (n.type) {
    case "space":
      return null;
    case "heading":
      return L.createElement(`h${n.depth}`, { key: a }, ba(n, r));
    case "paragraph":
      return L.createElement("p", { key: a }, ba(n, r));
    case "text":
      return n.tokens ? L.createElement(L.Fragment, { key: a }, xa(n.tokens, r)) : n.text;
    case "escape":
      return n.text;
    case "strong":
      return L.createElement("strong", { key: a }, ba(n, r));
    case "em":
      return L.createElement("em", { key: a }, ba(n, r));
    case "del":
      return L.createElement("del", { key: a }, ba(n, r));
    case "codespan":
      return L.createElement("code", { key: a }, n.text);
    case "br":
      return L.createElement("br", { key: a });
    case "hr":
      return L.createElement("hr", { key: a });
    case "code": {
      const i = /^[\w#+.-]+$/.test(n.lang ?? "") ? `language-${n.lang}` : void 0;
      return L.createElement("pre", { key: a }, L.createElement("code", i ? { className: i } : null, n.text));
    }
    case "blockquote":
      return L.createElement("blockquote", { key: a }, xa(n.tokens, r));
    case "list": {
      const i = n.items.map((s, c) => L.createElement(
        "li",
        { key: c },
        s.task ? L.createElement("input", { type: "checkbox", checked: !!s.checked, disabled: !0, readOnly: !0 }) : null,
        s.task ? " " : null,
        xa(s.tokens, r)
      ));
      return n.ordered ? L.createElement("ol", { key: a, start: n.start === "" || n.start === 1 ? void 0 : n.start }, i) : L.createElement("ul", { key: a }, i);
    }
    case "table": {
      const i = (s) => n.align[s] ? { textAlign: n.align[s] } : void 0;
      return L.createElement(
        "table",
        { key: a },
        L.createElement("thead", null, L.createElement("tr", null, n.header.map((s, c) => L.createElement("th", { key: c, style: i(c) }, xa(s.tokens, r))))),
        L.createElement("tbody", null, n.rows.map((s, c) => L.createElement("tr", { key: c }, s.map((f, u) => L.createElement("td", { key: u, style: i(u) }, xa(f.tokens, r))))))
      );
    }
    case "link": {
      const i = n.href ?? "";
      if (!/^https?:\/\//i.test(i)) return L.createElement("a", { key: a, title: i || void 0 }, ba(n, r));
      const s = (c) => {
        c.preventDefault?.(), r(i);
      };
      return L.createElement("a", { key: a, href: i, rel: "noopener noreferrer", onClick: s }, ba(n, r));
    }
    case "image":
      return L.createElement("span", { key: a, className: "md-placeholder" }, ky("image", n.text, n.href ?? ""));
    // Raw HTML is never parsed: it is drawn as written.
    case "html":
      return n.block ? L.createElement("p", { key: a }, n.text) : n.text;
    default:
      return n.raw ?? null;
  }
}
function Sy(n, a = 4e3) {
  const r = [];
  let i = 0, s = 0, c = null, f = !1;
  for (; s < n.length; ) {
    const u = n.indexOf(`
`, s), m = n.slice(s, u < 0 ? n.length : u), h = /^ {0,3}(`{3,}|~{3,})/.exec(m)?.[1];
    !c && !h && s - i >= a && (/^(#{1,6}|[-*+])(\s|$)/.test(m) || f && /^[^\s>|]/.test(m)) && (r.push(n.slice(i, s)), i = s), h && !c ? c = h : h && h[0] === c[0] && h.length >= c.length && !m.trim().slice(h.length) && (c = null), f = !m.trim(), s = u < 0 ? n.length : u + 1;
  }
  return r.push(n.slice(i)), r;
}
function Ey(n) {
  const a = new Ht({ gfm: !0 }), r = [], i = () => r.findLast((s) => s.type !== "space");
  return {
    add(s) {
      const c = a.tokens.length;
      a.lex(s);
      const f = a.tokens.slice(c), u = f.findIndex((h) => h.type !== "space"), m = i();
      u >= 0 && f[u].type === "list" && m?.type === "list" && m.ordered === f[u].ordered && (m.ordered || m.raw.trimStart()[0] === f[u].raw.trimStart()[0]) && (m.items.push(...f[u].items), m.raw += f[u].raw, f.splice(0, u + 1)), r.push(...f);
    },
    elements: () => xa(r, n)
  };
}
const ii = 4, Qn = 8, zy = "flex w-full cursor-pointer items-center justify-between gap-3 px-[0.9rem] py-[0.4rem] text-left text-[0.82rem] text-fg max-[700px]:min-h-11 aria-disabled:cursor-not-allowed aria-disabled:opacity-40", kp = (n) => n.text ?? (typeof n.label == "string" ? n.label : n.value);
function Ny({ value: n, onChange: a, options: r, className: i, ariaLabel: s, testId: c, id: f, title: u, disabled: m, placeholder: h, freeText: v, onKeyDown: y }) {
  const b = L.useId(), [S, E] = L.useState(!1), [R, N] = L.useState(-1), [M, O] = L.useState(!1), H = L.useRef(null), X = L.useRef(null), [W, D] = L.useState({}), g = L.useRef({ text: "", at: 0 }), w = v && M && n ? r.filter((Q) => kp(Q).toLowerCase().includes(n.toLowerCase()) || Q.value.toLowerCase().includes(n.toLowerCase())) : r, x = r.find((Q) => Q.value === n), _ = (Q) => `${b}-${Q}`;
  function T(Q) {
    m || (N(Q), E(!0));
  }
  function z() {
    E(!1), O(!1), N(-1);
  }
  function j(Q) {
    !Q || Q.disabled || (a(Q.value), z());
  }
  function V(Q, Z) {
    for (let C = 1; C <= w.length; C++) {
      const J = (Q + Z * C + w.length * C) % w.length;
      if (!w[J].disabled) return J;
    }
    return Q;
  }
  const $ = () => w.findIndex((Q) => !Q.disabled), U = () => w.length - 1 - [...w].reverse().findIndex((Q) => !Q.disabled);
  bi(() => {
    if (!S || !H.current) {
      D((ae) => ae.left === void 0 ? ae : {});
      return;
    }
    const Q = H.current.getBoundingClientRect(), Z = window.innerHeight - Q.bottom - ii - Qn, C = Q.top - ii - Qn, J = Z < 160 && C > Z;
    D({
      position: "fixed",
      left: Math.min(Math.max(Qn, Q.left), Math.max(Qn, window.innerWidth - Q.width - Qn)),
      // As wide as its longest label (a session title, a path), never wider than the window.
      width: "max-content",
      minWidth: Q.width,
      maxWidth: window.innerWidth - 2 * Qn,
      maxHeight: Math.min(J ? C : Z, 320),
      ...J ? { bottom: window.innerHeight - Q.top + ii } : { top: Q.bottom + ii },
      overflowY: "auto"
    });
  }, [S, w.length]), bi(() => {
    const Q = X.current;
    if (!S || !Q || W.left === void 0) return;
    const Z = Q.getBoundingClientRect().right, C = window.innerWidth - Qn;
    Z > C && D((J) => ({ ...J, left: Math.max(Qn, Number(J.left) - (Z - C)) }));
  }, [S, W]), Je(() => {
    if (!S) return;
    const Q = (Z) => {
      const C = Z.target;
      (C === document || C instanceof Node && H.current && C.contains(H.current)) && z();
    };
    return window.addEventListener("resize", z), window.addEventListener("scroll", Q, !0), () => {
      window.removeEventListener("resize", z), window.removeEventListener("scroll", Q, !0);
    };
  }, [S]), Je(() => {
    const Q = S && R >= 0 ? document.getElementById(_(R)) : null, Z = X.current;
    !Q || !Z || (Q.offsetTop < Z.scrollTop ? Z.scrollTop = Q.offsetTop : Q.offsetTop + Q.offsetHeight > Z.scrollTop + Z.clientHeight && (Z.scrollTop = Q.offsetTop + Q.offsetHeight - Z.clientHeight));
  }, [S, R]), Um(S, (Q) => {
    Q || z();
  }, H, X);
  function K(Q) {
    if (Q.nativeEvent.isComposing) return;
    const Z = () => {
      Q.preventDefault(), Q.stopPropagation();
    }, { key: C } = Q;
    if (S) {
      if (C === "Escape") {
        Z(), z();
        return;
      } else if (C === "Tab")
        z();
      else if (C === "ArrowDown" || C === "ArrowUp") {
        Z(), w.length && N(R < 0 ? C === "ArrowDown" ? $() : U() : V(R, C === "ArrowDown" ? 1 : -1));
        return;
      } else if (C === "Home" && !v) {
        Z(), N($());
        return;
      } else if (C === "End" && !v) {
        Z(), N(U());
        return;
      } else if (C === "Enter" || C === " " && !v) {
        if (R >= 0 && w[R]) {
          Z(), j(w[R]);
          return;
        }
        if (!v) {
          Z(), z();
          return;
        }
      } else if (!v && C.length === 1 && !Q.metaKey && !Q.ctrlKey && !Q.altKey) {
        const J = Date.now();
        g.current = { text: (J - g.current.at > 600 ? "" : g.current.text) + C.toLowerCase(), at: J };
        const ae = Math.max(R, 0), oe = [...w.slice(ae + (g.current.text.length === 1 ? 1 : 0)), ...w.slice(0, ae + 1)].find((ce) => !ce.disabled && kp(ce).toLowerCase().startsWith(g.current.text));
        oe && (Z(), N(w.indexOf(oe)));
        return;
      }
    } else if (C === "ArrowDown" || C === "ArrowUp" || !v && (C === "Enter" || C === " ")) {
      Z(), T(Math.max(0, w.findIndex((J) => J.value === n)));
      return;
    }
    y?.(Q);
  }
  const I = {
    ref: (Q) => {
      H.current = Q;
    },
    id: f,
    title: u,
    disabled: m,
    "aria-label": s,
    "aria-expanded": S,
    "aria-controls": S ? b : void 0,
    "aria-activedescendant": S && R >= 0 ? _(R) : void 0,
    "data-testid": c,
    onKeyDown: K
  };
  return /* @__PURE__ */ te.jsxs(te.Fragment, { children: [
    v ? /* @__PURE__ */ te.jsx(
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
          a(Q.target.value), O(!0), S ? N(-1) : (N(-1), E(!0));
        },
        onBlur: () => z()
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
        onClick: () => S ? z() : T(Math.max(0, w.findIndex((Q) => Q.value === n))),
        children: [
          /* @__PURE__ */ te.jsx("span", { className: "min-w-0 flex-1 truncate", children: x ? x.label : h ?? "" }),
          /* @__PURE__ */ te.jsx(Cc, { open: !0, className: "shrink-0 text-subtext-0" })
        ]
      }
    ),
    S && w.length > 0 && $l(
      /* @__PURE__ */ te.jsx(
        "div",
        {
          ref: X,
          id: b,
          role: "listbox",
          "aria-label": s,
          className: Oe("z-[9999]", Hi),
          style: W,
          onMouseDown: (Q) => {
            Q.preventDefault(), Q.stopPropagation();
          },
          onClick: (Q) => Q.stopPropagation(),
          children: w.map((Q, Z) => /* @__PURE__ */ te.jsxs(
            "div",
            {
              id: _(Z),
              role: "option",
              "aria-selected": Q.value === n,
              "aria-disabled": Q.disabled || void 0,
              "data-value": Q.value,
              className: Oe(zy, Z === R && !Q.disabled && "bg-surface-0"),
              onMouseEnter: () => {
                Q.disabled || N(Z);
              },
              onClick: () => j(Q),
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
const _p = 230, Ty = 370;
function Cy({ x: n, y: a, readOnly: r, canUndo: i, canRedo: s, hasSelection: c, onClose: f, actions: u }) {
  const m = L.useRef(null);
  Je(() => {
    const b = (E) => {
      m.current?.contains(E.target) || f();
    }, S = (E) => {
      E.key === "Escape" && (E.preventDefault(), f());
    };
    return document.addEventListener("mousedown", b), document.addEventListener("keydown", S), window.addEventListener("blur", f), window.addEventListener("resize", f), () => {
      document.removeEventListener("mousedown", b), document.removeEventListener("keydown", S), window.removeEventListener("blur", f), window.removeEventListener("resize", f);
    };
  }, [f]);
  const h = (b, S) => ac(Qm ? b : S), v = (b, S, E, R, N = !1) => /* @__PURE__ */ te.jsxs("button", { type: "button", className: Oe(Vm(), "flex items-center justify-between gap-6"), "data-testid": E, disabled: N, onClick: S, children: [
    /* @__PURE__ */ te.jsx("span", { children: b }),
    /* @__PURE__ */ te.jsx("span", { className: "text-[0.72rem] text-subtext-0", children: R })
  ] }), y = u.askAgent;
  return $l(
    /* @__PURE__ */ te.jsxs(
      "div",
      {
        ref: m,
        className: Hi,
        "data-testid": "editor-context-menu",
        style: {
          position: "fixed",
          top: Math.max(8, Math.min(a, window.innerHeight - Ty - 8)),
          left: Math.max(8, Math.min(n, window.innerWidth - _p - 8)),
          zIndex: 9999,
          minWidth: _p
        },
        onContextMenu: (b) => b.preventDefault(),
        children: [
          y && /* @__PURE__ */ te.jsxs(te.Fragment, { children: [
            v(c ? "Ask agent about selection…" : "Ask agent about file…", y, "editor-menu-ask-agent", ""),
            /* @__PURE__ */ te.jsx("div", { className: hi })
          ] }),
          v("Undo", u.undo, "editor-menu-undo", h("cmd+z", "ctrl+z"), r || !i),
          v("Redo", u.redo, "editor-menu-redo", h("cmd+shift+z", "ctrl+y"), r || !s),
          /* @__PURE__ */ te.jsx("div", { className: hi }),
          v("Cut", u.cut, "editor-menu-cut", h("cmd+x", "ctrl+x"), r || !c),
          v("Copy", u.copy, "editor-menu-copy", h("cmd+c", "ctrl+c"), !c),
          v("Paste", u.paste, "editor-menu-paste", h("cmd+v", "ctrl+v"), r),
          v("Select All", u.selectAll, "editor-menu-select-all", h("cmd+a", "ctrl+a")),
          /* @__PURE__ */ te.jsx("div", { className: hi }),
          v("Find…", u.find, "editor-menu-find", h("cmd+f", "ctrl+f")),
          !r && v("Replace…", u.replace, "editor-menu-replace", h("cmd+alt+f", "ctrl+h")),
          v("Go to Line…", u.gotoLine, "editor-menu-goto", ac("ctrl+g"))
        ]
      }
    ),
    document.body
  );
}
const Ay = "box-border min-h-[44px] cursor-pointer rounded-ui bg-transparent px-[0.7rem] py-[0.45rem] text-subtext-0 no-underline [border:0] [font-family:inherit] [font-weight:inherit] [line-height:inherit] text-[0.85rem] hover:bg-surface-1 hover:text-fg focus-visible:[outline:2px_solid_var(--accent)] focus-visible:[outline-offset:2px] disabled:cursor-default disabled:opacity-[0.55]", My = "m-0 mt-[0.4rem] text-[0.78rem] text-subtext-0", Ry = "m-0 mb-2 text-[0.82rem] text-subtext-0", Bm = "rounded-ui bg-surface-1 text-fg [font-family:inherit]", Nc = `${Bm} px-2 py-[0.3rem] text-[0.8rem] max-[700px]:min-h-11 focus:[outline:1px_solid_var(--accent)]`, jy = `${Nc} min-w-[5.5rem] shrink-0`, Tc = `${Bm} min-w-0 px-[0.55rem] py-[0.35rem] text-[0.82rem] max-[700px]:min-h-11 focus:[outline:1px_solid_var(--accent)]`, Oy = `${Tc} flex-1 max-[700px]:flex-[1_1_100%]`, Dy = `${Tc} w-20 flex-[0_0_5rem] max-[700px]:w-24 max-[700px]:flex-[1_1_6rem]`, By = `${Tc} flex-[1_1_100%]`, Hy = "flex flex-wrap items-center gap-[0.4rem]", Uy = "m-0 mb-2 flex list-none flex-col gap-[0.3rem] p-0", qy = "flex items-center gap-2 max-[700px]:flex-wrap rounded-ui bg-surface-1 px-2 py-[0.35rem] text-[0.82rem]", Ly = `settings-modal__host-row ${qy}`, Gy = "min-w-0 overflow-hidden font-semibold text-ellipsis whitespace-nowrap text-fg", Yy = "min-w-0 flex-1 max-[700px]:basis-full overflow-hidden text-[0.78rem] text-ellipsis whitespace-nowrap text-subtext-0", Hm = "shrink-0 cursor-pointer rounded-ui px-[0.7rem] py-[0.35rem] max-[700px]:min-h-11 text-[0.82rem] font-semibold text-panel-bg [border:none] [font-family:inherit] [transition:opacity_0.12s_ease] hover:opacity-[0.85]", Qy = `${Hm} bg-accent`, Vy = `${Hm} ml-auto bg-red`;
function Cc({ open: n, size: a = 12, className: r }) {
  return /* @__PURE__ */ te.jsx("svg", { className: r, width: a, height: a, viewBox: "0 0 12 12", fill: "none", stroke: "currentColor", strokeWidth: "1.3", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true", children: /* @__PURE__ */ te.jsx("path", { d: n ? "M2.5 4.5 6 8l3.5-3.5" : "M4.5 2.5 8 6l-3.5 3.5" }) });
}
function Ky({ label: n, items: a, testId: r, side: i = "right", up: s = !1, maxHeight: c = 320 }) {
  const [f, u] = L.useState(!1), [m, h] = L.useState(!1), v = L.useRef(null), y = L.useRef(null), b = () => [...y.current?.querySelectorAll('[role="menuitem"]') ?? []];
  Je(() => {
    f && m && (b()[0]?.focus(), h(!1));
  }, [f, m]);
  const S = () => {
    u(!0), h(!0);
  }, E = (N) => {
    (N.key === "ArrowRight" || N.key === "Enter" || N.key === " ") && (N.preventDefault(), S());
  }, R = (N) => {
    const M = b(), O = M.findIndex((H) => H === document.activeElement);
    N.key === "ArrowDown" || N.key === "ArrowUp" ? (N.preventDefault(), M[(O + (N.key === "ArrowDown" ? 1 : M.length - 1)) % M.length]?.focus()) : (N.key === "ArrowLeft" || N.key === "Escape") && (N.preventDefault(), N.stopPropagation(), u(!1), v.current?.focus());
  };
  return /* @__PURE__ */ te.jsxs("div", { className: "group/submenu relative", children: [
    /* @__PURE__ */ te.jsxs(
      "button",
      {
        ref: v,
        type: "button",
        role: "menuitem",
        "aria-haspopup": "menu",
        "aria-expanded": f,
        className: Oe(Wo(), "flex items-center justify-between gap-2"),
        "data-testid": r,
        onClick: () => f ? u(!1) : S(),
        onKeyDown: E,
        children: [
          /* @__PURE__ */ te.jsx("span", { className: "truncate", children: n }),
          /* @__PURE__ */ te.jsx(Cc, { open: !1, size: 10 })
        ]
      }
    ),
    /* @__PURE__ */ te.jsx(
      "div",
      {
        ref: y,
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
        onKeyDown: R,
        children: a.map((N) => /* @__PURE__ */ te.jsx("button", { type: "button", role: "menuitem", className: Wo(), "data-testid": N.testId, onClick: N.onSelect, children: /* @__PURE__ */ te.jsx("span", { className: "block truncate", children: N.label }) }, N.key))
      }
    )
  ] });
}
function Zy(n) {
  return n.blocked && !n.stale ? "blocked" : n.status === "running" && !n.stale ? "working" : n.unseen ? "done" : "idle";
}
const ec = {
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
function tc(n, a) {
  return !!n.parentSessionId && n.parentSessionId !== n.id && a.some((r) => r.id === n.parentSessionId);
}
function Xy(n) {
  const a = /* @__PURE__ */ new Map();
  for (const r of n)
    tc(r, n) && a.set(r.parentSessionId, [...a.get(r.parentSessionId) ?? [], r]);
  return a.size ? n.filter((r) => !tc(r, n)).flatMap((r) => [r, ...a.get(r.id) ?? []]) : n;
}
const si = 6, Sp = 8;
function Jy(n, a = {}) {
  const { minWidth: r = 220, align: i = "right", minSpaceAbove: s = 100 } = a, c = n.getBoundingClientRect(), f = window.innerWidth, u = window.innerHeight, m = i === "right" ? { right: Math.max(0, f - c.right) } : { left: Math.max(0, c.left) }, h = c.top - si - Sp, v = u - c.bottom - si - Sp;
  return h >= s ? {
    position: "fixed",
    bottom: u - c.top + si,
    ...m,
    minWidth: r,
    maxHeight: Math.min(h, u * 0.75),
    overflowY: "auto"
  } : {
    position: "fixed",
    top: c.bottom + si,
    ...m,
    minWidth: r,
    maxHeight: Math.min(v, u * 0.75),
    overflowY: "auto"
  };
}
function Um(n, a, r, i) {
  Je(() => {
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
function $y({ icon: n, fallback: a }) {
  const [r, i] = L.useState(!1);
  return Je(() => i(!1), [n]), !n || r ? /* @__PURE__ */ te.jsx(te.Fragment, { children: a }) : /* @__PURE__ */ te.jsx("img", { src: n, alt: "", width: 14, height: 14, className: "size-[14px] rounded-[2px] object-contain", referrerPolicy: "no-referrer", onError: () => i(!0) });
}
const Wy = ["application/zip", "application/x-tar", "application/gzip"];
function qm(n) {
  const a = n ?? "";
  if (a.startsWith("image/")) return "image";
  if (a.startsWith("video/")) return "video";
  if (a.startsWith("audio/")) return "audio";
  if (a === "application/pdf") return "pdf";
  if (Wy.includes(a)) return "archive";
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
const Fy = 50 * 1024 * 1024, Ep = 1.25, Iy = 0.05, Py = 16384, ex = "inline-flex items-center justify-center", oi = Oe(Wl, ex, "min-h-8 min-w-8 px-2 text-[0.75rem] max-[700px]:min-h-11 max-[700px]:min-w-11"), Oo = Oe(Wl, "inline-flex min-h-8 items-center px-2"), tx = { pdf: "PDF document", audio: "Audio", video: "Video" };
let nx = 0;
function ax(n) {
  return n < 1024 ? `${n} B` : n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
function lx(n, a, r) {
  const i = a ? Math.min(8, Py / Math.max(a.width, a.height)) : 1, s = r === "in" ? n * Ep : r === "out" ? n / Ep : 1;
  return Math.min(i, Math.max(Math.min(Iy, i), s));
}
function rx(n, a) {
  return typeof n != "string" || !n.startsWith("/") ? null : `${n.replace(/\/+$/, "")}/${a.replace(/^\/+/, "")}`;
}
function ix({ media: n, workspaceId: a, metadata: r, onFail: i }) {
  const s = L.useMemo(() => `media-${++nx}`, []), [c, f] = L.useState(null), [u, m] = L.useState("fit");
  Je(() => {
    let E = !0;
    return n.open(s, { workspaceId: a, path: r.path, mediaType: r.mediaType ?? "", size: r.size }).then((R) => {
      E && f(R ?? { width: 0, height: 0 });
    }, (R) => {
      E && i(String(R?.message ?? R));
    }), () => {
      E = !1, n.release(s);
    };
  }, [s]), Je(() => {
    n.setZoom(s, u === "fit" ? null : u);
  }, [s, u]);
  const h = c !== null && c.width > 0 && c.height > 0, v = () => u !== "fit" ? u : n.fitScale(s) ?? 1, y = (E) => m(lx(v(), c, E)), b = (E) => {
    if (!(E.metaKey || E.ctrlKey || E.altKey || !h)) {
      if (E.key === "+" || E.key === "=") y("in");
      else if (E.key === "-") y("out");
      else if (E.key === "0") y("actual");
      else return;
      E.preventDefault();
    }
  }, S = u === "fit" ? "Fit" : `${Math.round(u * 100)}%`;
  return L.createElement(
    "div",
    { className: "flex min-h-0 min-w-0 flex-1 flex-col", "data-testid": "workspace-image-viewer" },
    L.createElement(
      "div",
      { className: "flex shrink-0 flex-wrap items-center gap-1 px-3 py-1 text-[0.72rem] text-subtext-0", role: "toolbar", "aria-label": "Image view" },
      L.createElement("button", { type: "button", className: oi, "aria-label": "Zoom out", title: "Zoom out (-)", disabled: !h, onClick: () => y("out") }, "−"),
      L.createElement("button", { type: "button", className: oi, "aria-label": "Zoom in", title: "Zoom in (+)", disabled: !h, onClick: () => y("in") }, "+"),
      L.createElement("button", { type: "button", className: Oe(oi, u === "fit" && "text-fg"), "aria-pressed": u === "fit", onClick: () => m("fit") }, "Fit"),
      L.createElement("button", { type: "button", className: Oe(oi, u === 1 && "text-fg"), "aria-pressed": u === 1, title: "Actual size (0)", disabled: !h, onClick: () => y("actual") }, "100%"),
      L.createElement("span", { role: "status", className: "px-1", "data-testid": "workspace-image-info" }, h ? `${c.width} × ${c.height} · ${S}` : "")
    ),
    L.createElement("div", {
      className: "flex min-h-0 min-w-0 flex-1",
      tabIndex: 0,
      "aria-label": `${r.name} image. Plus and minus zoom, 0 shows actual size, arrow keys pan.`,
      onKeyDown: b
    }, c === null ? L.createElement("span", { className: "m-auto text-[0.8rem] text-subtext-0", role: "status" }, "Loading…") : L.createElement("div", { className: "relative min-h-0 min-w-0 flex-1", "data-perch-engine": "image", "data-perch-key": s, "data-testid": "workspace-file-image" }))
  );
}
function sx({ workspaceId: n, metadata: a, perch: r }) {
  const [i, s] = L.useState(!1), c = r.mediaFile?.(n, a.path) ?? { root: null, extraction: null }, f = c.extraction, u = qm(a.mediaType), m = rx(c.root, a.path), h = m === null, v = u === "archive", y = u === "image" && a.size > Fy, b = u !== void 0 && !v && !h && !y;
  let S = "Open this file in Quick Look or its default app.";
  h ? S = "Use your SSH tools to download this file. Perch will not open a remote path on this machine." : v && (S = "Extract into a new folder beside this archive. Existing files are never overwritten.");
  let E = "No preview for this file type";
  h ? E = "Remote media is not available yet" : v ? E = "Compressed archive" : y ? (E = "Image too large to preview", S = `This image is ${Math.round(a.size / 1048576)} MB. Open it in Quick Look or its default app.`) : i && (E = "Preview unavailable", u === "image" && (S = "The image may be corrupt or in a format Perch cannot decode. Open it in Quick Look or its default app."));
  const R = (M) => {
    try {
      r.media[M](m);
    } catch (O) {
      console.error(`perch-media ${M}: ${O?.message ?? O}`);
    }
  }, N = u === "pdf" || u === "audio" || u === "video";
  return L.createElement(
    "section",
    { className: "flex min-h-0 min-w-0 flex-1 flex-col", "aria-label": `Previewing ${a.path}`, "data-testid": "workspace-file-asset" },
    L.createElement(
      "header",
      { className: "flex shrink-0 flex-wrap items-center gap-2 px-3 py-2 text-[0.75rem]" },
      L.createElement("strong", { className: "min-w-0 flex-1 truncate", title: a.path }, a.path),
      v && L.createElement(
        "button",
        { type: "button", className: Oo, disabled: f?.state === "loading", onClick: () => r.command("files.extract", { workspaceId: n, path: a.path }) },
        f?.state === "loading" ? "Extracting…" : "Extract"
      ),
      !h && L.createElement("button", { type: "button", className: Oo, onClick: () => R("quickLook") }, "Quick Look"),
      !h && L.createElement("button", { type: "button", className: Oo, onClick: () => R("openDefault") }, "Open with Default App")
    ),
    f?.state === "ready" && L.createElement("p", { role: "status", className: "m-0 px-3 py-2 text-[0.75rem] text-subtext-0" }, `Extracted to ${f.destination}. Find it in the file tree.`),
    f?.state === "error" && L.createElement("p", { role: "alert", className: "m-0 px-3 py-2 text-[0.75rem] text-red" }, f.error),
    !b || i ? L.createElement(
      "div",
      { className: "grid flex-1 content-center justify-items-center gap-2 p-5 text-center text-[0.8rem] text-subtext-0" },
      L.createElement("strong", { className: "text-fg" }, E),
      L.createElement("span", null, S)
    ) : u === "image" ? L.createElement(ix, { media: r.media, workspaceId: n, metadata: a, onFail: () => s(!0) }) : N && L.createElement(
      "div",
      { className: "grid flex-1 content-center justify-items-center gap-2 p-5 text-center text-[0.8rem] text-subtext-0", "data-testid": "workspace-file-card" },
      L.createElement("strong", { className: "text-fg" }, a.name),
      L.createElement("span", null, `${tx[u]} · ${ax(a.size)}`),
      L.createElement("span", null, "Perch does not play or render this file. Open it in Quick Look or its default app.")
    )
  );
}
function ox(n, a = !1) {
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
const cx = {
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
function ux({ name: n, directory: a = !1, open: r = !1 }) {
  const { kind: i, tone: s, text: c } = ox(n, a);
  return /* @__PURE__ */ te.jsxs("svg", { className: Oe("size-[calc(14px*var(--zoom,1))] shrink-0", s), "data-file-icon": i, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: "1.25", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true", children: [
    i === "react" ? /* @__PURE__ */ te.jsxs(te.Fragment, { children: [
      /* @__PURE__ */ te.jsx("ellipse", { cx: "8", cy: "8", rx: "7", ry: "2.5" }),
      /* @__PURE__ */ te.jsx("ellipse", { cx: "8", cy: "8", rx: "7", ry: "2.5", transform: "rotate(60 8 8)" }),
      /* @__PURE__ */ te.jsx("ellipse", { cx: "8", cy: "8", rx: "7", ry: "2.5", transform: "rotate(120 8 8)" }),
      /* @__PURE__ */ te.jsx("circle", { cx: "8", cy: "8", r: "1" })
    ] }) : c ? /* @__PURE__ */ te.jsx("text", { x: "8", y: "11", textAnchor: "middle", fill: "currentColor", stroke: "none", fontSize: "8", fontWeight: "600", fontFamily: "var(--font-mono)", children: c }) : /* @__PURE__ */ te.jsx("path", { d: i === "folder" && r ? "M2 5V3h4l2 2h5v2M2 7h13l-2 6H2z" : cx[i] }),
    i === "branch" && /* @__PURE__ */ te.jsxs(te.Fragment, { children: [
      /* @__PURE__ */ te.jsx("circle", { cx: "4", cy: "3", r: "1.5" }),
      /* @__PURE__ */ te.jsx("circle", { cx: "4", cy: "13", r: "1.5" }),
      /* @__PURE__ */ te.jsx("circle", { cx: "12", cy: "3", r: "1.5" })
    ] }),
    i === "image" && /* @__PURE__ */ te.jsx("circle", { cx: "10.5", cy: "5", r: "1" })
  ] });
}
const dx = { unmodified: "", modified: "M", added: "A", deleted: "D", renamed: "R", copied: "C", typeChanged: "T", untracked: "U", ignored: "I", conflicted: "!" }, zp = (n) => typeof n == "string" ? dx[n] ?? "?" : "?", Np = (n) => typeof n == "string" ? n === "unmodified" ? "unmodified" : n === "typeChanged" ? "type changed" : n : `unknown (${n.unknown})`;
function fx(n) {
  const a = zp(n.index), r = zp(n.worktree), i = a === "!" || r === "!", s = i ? "!" : n.staged && n.unstaged ? `${a || "?"}/${r || "?"}` : n.staged ? a : r || a, c = `Git · Index: ${Np(n.index)}; working tree: ${Np(n.worktree)}${n.originalPath ? `; from ${n.originalPath}` : ""}`, f = i || s.includes("D") ? "text-red" : s === "U" || s === "A" || s === "C" ? "text-green" : s.includes("?") || s === "I" ? "text-subtext-0" : "text-yellow";
  return { label: s, title: c, tone: f };
}
function px({ decoration: n, directory: a = !1 }) {
  if (!n) return null;
  if (a && n.containsChanges) return /* @__PURE__ */ te.jsx("span", { className: Oe("ml-1 size-1 shrink-0 rounded-full", n.conflicted ? "bg-red" : "bg-yellow"), role: "img", "aria-label": n.conflicted ? "Contains Git conflicts" : "Contains Git changes", title: n.conflicted ? "Contains Git conflicts" : "Contains Git changes", "data-testid": "file-git-summary" });
  if (!n.entry) return null;
  const { label: r, title: i, tone: s } = fx(n.entry);
  return r ? /* @__PURE__ */ te.jsx("span", { className: Oe("ml-1 shrink-0 text-[10px] tabular-nums [font-family:var(--font-mono)]", s), "aria-label": i, title: i, "data-testid": "file-git-marker", children: r }) : null;
}
const mx = "mode-switch group ml-auto flex items-center gap-[0.4rem] bg-transparent p-[0.2rem] [border:none] [font-family:inherit]", Lm = "text-[0.72rem] font-semibold tracking-[0.03em] text-overlay-1 uppercase [transition:color_0.15s_ease]", hx = `${Lm} group-aria-[checked=false]:text-accent`, gx = `${Lm} group-aria-checked:text-accent`, bx = "relative h-[1.3rem] w-[2.4rem] shrink-0 rounded-[999px] border border-overlay-0 bg-surface-1 [transition:background_0.15s_ease] group-aria-checked:border-accent group-aria-checked:bg-panel-bg", vx = "absolute top-px left-px h-[1.1rem] w-[1.1rem] rounded-[50%] bg-fg [box-shadow:0_1px_2px_rgba(0,0,0,0.3)] [transition:transform_0.15s_ease,background_0.15s_ease] group-aria-checked:bg-accent group-aria-checked:[transform:translateX(1.1rem)]";
function yx({
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
      className: mx,
      "data-testid": r,
      role: "switch",
      "aria-checked": s,
      "aria-label": "Toggle UI / CLI mode",
      disabled: i,
      onClick: () => a(s ? "ui" : "cli"),
      children: [
        /* @__PURE__ */ te.jsx("span", { className: Oe("mode-switch__label mode-switch__label--ui", hx), children: "UI" }),
        /* @__PURE__ */ te.jsx("span", { className: Oe("mode-switch__track", bx), children: /* @__PURE__ */ te.jsx("span", { className: Oe("mode-switch__thumb", vx) }) }),
        /* @__PURE__ */ te.jsx("span", { className: Oe("mode-switch__label mode-switch__label--cli", gx), children: "CLI" })
      ]
    }
  );
}
const ll = function(n, a) {
  let s = n;
  const c = Yl[a];
  let f = null, u = 0, m = null;
  const h = [], v = {}, y = function(g, w) {
    u = s * 4 + 17, f = (function(x) {
      const _ = new Array(x);
      for (let T = 0; T < x; T += 1) {
        _[T] = new Array(x);
        for (let z = 0; z < x; z += 1)
          _[T][z] = null;
      }
      return _;
    })(u), b(0, 0), b(u - 7, 0), b(0, u - 7), R(), E(), M(g, w), s >= 7 && N(g), m == null && (m = X(s, c, h)), O(m, w);
  }, b = function(g, w) {
    for (let x = -1; x <= 7; x += 1)
      if (!(g + x <= -1 || u <= g + x))
        for (let _ = -1; _ <= 7; _ += 1)
          w + _ <= -1 || u <= w + _ || (0 <= x && x <= 6 && (_ == 0 || _ == 6) || 0 <= _ && _ <= 6 && (x == 0 || x == 6) || 2 <= x && x <= 4 && 2 <= _ && _ <= 4 ? f[g + x][w + _] = !0 : f[g + x][w + _] = !1);
  }, S = function() {
    let g = 0, w = 0;
    for (let x = 0; x < 8; x += 1) {
      y(!0, x);
      const _ = Kn.getLostPoint(v);
      (x == 0 || g > _) && (g = _, w = x);
    }
    return w;
  }, E = function() {
    for (let g = 8; g < u - 8; g += 1)
      f[g][6] == null && (f[g][6] = g % 2 == 0);
    for (let g = 8; g < u - 8; g += 1)
      f[6][g] == null && (f[6][g] = g % 2 == 0);
  }, R = function() {
    const g = Kn.getPatternPosition(s);
    for (let w = 0; w < g.length; w += 1)
      for (let x = 0; x < g.length; x += 1) {
        const _ = g[w], T = g[x];
        if (f[_][T] == null)
          for (let z = -2; z <= 2; z += 1)
            for (let j = -2; j <= 2; j += 1)
              z == -2 || z == 2 || j == -2 || j == 2 || z == 0 && j == 0 ? f[_ + z][T + j] = !0 : f[_ + z][T + j] = !1;
      }
  }, N = function(g) {
    const w = Kn.getBCHTypeNumber(s);
    for (let x = 0; x < 18; x += 1) {
      const _ = !g && (w >> x & 1) == 1;
      f[Math.floor(x / 3)][x % 3 + u - 8 - 3] = _;
    }
    for (let x = 0; x < 18; x += 1) {
      const _ = !g && (w >> x & 1) == 1;
      f[x % 3 + u - 8 - 3][Math.floor(x / 3)] = _;
    }
  }, M = function(g, w) {
    const x = c << 3 | w, _ = Kn.getBCHTypeInfo(x);
    for (let T = 0; T < 15; T += 1) {
      const z = !g && (_ >> T & 1) == 1;
      T < 6 ? f[T][8] = z : T < 8 ? f[T + 1][8] = z : f[u - 15 + T][8] = z;
    }
    for (let T = 0; T < 15; T += 1) {
      const z = !g && (_ >> T & 1) == 1;
      T < 8 ? f[8][u - T - 1] = z : T < 9 ? f[8][15 - T - 1 + 1] = z : f[8][15 - T - 1] = z;
    }
    f[u - 8][8] = !g;
  }, O = function(g, w) {
    let x = -1, _ = u - 1, T = 7, z = 0;
    const j = Kn.getMaskFunction(w);
    for (let V = u - 1; V > 0; V -= 2)
      for (V == 6 && (V -= 1); ; ) {
        for (let $ = 0; $ < 2; $ += 1)
          if (f[_][V - $] == null) {
            let U = !1;
            z < g.length && (U = (g[z] >>> T & 1) == 1), j(_, V - $) && (U = !U), f[_][V - $] = U, T -= 1, T == -1 && (z += 1, T = 7);
          }
        if (_ += x, _ < 0 || u <= _) {
          _ -= x, x = -x;
          break;
        }
      }
  }, H = function(g, w) {
    let x = 0, _ = 0, T = 0;
    const z = new Array(w.length), j = new Array(w.length);
    for (let K = 0; K < w.length; K += 1) {
      const I = w[K].dataCount, Q = w[K].totalCount - I;
      _ = Math.max(_, I), T = Math.max(T, Q), z[K] = new Array(I);
      for (let ae = 0; ae < z[K].length; ae += 1)
        z[K][ae] = 255 & g.getBuffer()[ae + x];
      x += I;
      const Z = Kn.getErrorCorrectPolynomial(Q), J = Xl(z[K], Z.getLength() - 1).mod(Z);
      j[K] = new Array(Z.getLength() - 1);
      for (let ae = 0; ae < j[K].length; ae += 1) {
        const oe = ae + J.getLength() - j[K].length;
        j[K][ae] = oe >= 0 ? J.getAt(oe) : 0;
      }
    }
    let V = 0;
    for (let K = 0; K < w.length; K += 1)
      V += w[K].totalCount;
    const $ = new Array(V);
    let U = 0;
    for (let K = 0; K < _; K += 1)
      for (let I = 0; I < w.length; I += 1)
        K < z[I].length && ($[U] = z[I][K], U += 1);
    for (let K = 0; K < T; K += 1)
      for (let I = 0; I < w.length; I += 1)
        K < j[I].length && ($[U] = j[I][K], U += 1);
    return $;
  }, X = function(g, w, x) {
    const _ = Tp.getRSBlocks(g, w), T = Cp();
    for (let j = 0; j < x.length; j += 1) {
      const V = x[j];
      T.put(V.getMode(), 4), T.put(V.getLength(), Kn.getLengthInBits(V.getMode(), g)), V.write(T);
    }
    let z = 0;
    for (let j = 0; j < _.length; j += 1)
      z += _[j].dataCount;
    if (T.getLengthInBits() > z * 8)
      throw "code length overflow. (" + T.getLengthInBits() + ">" + z * 8 + ")";
    for (T.getLengthInBits() + 4 <= z * 8 && T.put(0, 4); T.getLengthInBits() % 8 != 0; )
      T.putBit(!1);
    for (; !(T.getLengthInBits() >= z * 8 || (T.put(236, 8), T.getLengthInBits() >= z * 8)); )
      T.put(17, 8);
    return H(T, _);
  };
  v.addData = function(g, w) {
    w = w || "Byte";
    let x = null;
    switch (w) {
      case "Numeric":
        x = xx(g);
        break;
      case "Alphanumeric":
        x = wx(g);
        break;
      case "Byte":
        x = kx(g);
        break;
      case "Kanji":
        x = _x(g);
        break;
      default:
        throw "mode:" + w;
    }
    h.push(x), m = null;
  }, v.isDark = function(g, w) {
    if (g < 0 || u <= g || w < 0 || u <= w)
      throw g + "," + w;
    return f[g][w];
  }, v.getModuleCount = function() {
    return u;
  }, v.make = function() {
    if (s < 1) {
      let g = 1;
      for (; g < 40; g++) {
        const w = Tp.getRSBlocks(g, c), x = Cp();
        for (let T = 0; T < h.length; T++) {
          const z = h[T];
          x.put(z.getMode(), 4), x.put(z.getLength(), Kn.getLengthInBits(z.getMode(), g)), z.write(x);
        }
        let _ = 0;
        for (let T = 0; T < w.length; T++)
          _ += w[T].dataCount;
        if (x.getLengthInBits() <= _ * 8)
          break;
      }
      s = g;
    }
    y(!1, S());
  }, v.createTableTag = function(g, w) {
    g = g || 2, w = typeof w > "u" ? g * 4 : w;
    let x = "";
    x += '<table style="', x += " border-width: 0px; border-style: none;", x += " border-collapse: collapse;", x += " padding: 0px; margin: " + w + "px;", x += '">', x += "<tbody>";
    for (let _ = 0; _ < v.getModuleCount(); _ += 1) {
      x += "<tr>";
      for (let T = 0; T < v.getModuleCount(); T += 1)
        x += '<td style="', x += " border-width: 0px; border-style: none;", x += " border-collapse: collapse;", x += " padding: 0px; margin: 0px;", x += " width: " + g + "px;", x += " height: " + g + "px;", x += " background-color: ", x += v.isDark(_, T) ? "#000000" : "#ffffff", x += ";", x += '"/>';
      x += "</tr>";
    }
    return x += "</tbody>", x += "</table>", x;
  }, v.createSvgTag = function(g, w, x, _) {
    let T = {};
    typeof arguments[0] == "object" && (T = arguments[0], g = T.cellSize, w = T.margin, x = T.alt, _ = T.title), g = g || 2, w = typeof w > "u" ? g * 4 : w, x = typeof x == "string" ? { text: x } : x || {}, x.text = x.text || null, x.id = x.text ? x.id || "qrcode-description" : null, _ = typeof _ == "string" ? { text: _ } : _ || {}, _.text = _.text || null, _.id = _.text ? _.id || "qrcode-title" : null;
    const z = v.getModuleCount() * g + w * 2;
    let j, V, $, U, K = "", I;
    for (I = "l" + g + ",0 0," + g + " -" + g + ",0 0,-" + g + "z ", K += '<svg version="1.1" xmlns="http://www.w3.org/2000/svg"', K += T.scalable ? "" : ' width="' + z + 'px" height="' + z + 'px"', K += ' viewBox="0 0 ' + z + " " + z + '" ', K += ' preserveAspectRatio="xMinYMin meet"', K += _.text || x.text ? ' role="img" aria-labelledby="' + W([_.id, x.id].join(" ").trim()) + '"' : "", K += ">", K += _.text ? '<title id="' + W(_.id) + '">' + W(_.text) + "</title>" : "", K += x.text ? '<description id="' + W(x.id) + '">' + W(x.text) + "</description>" : "", K += '<rect width="100%" height="100%" fill="white" cx="0" cy="0"/>', K += '<path d="', $ = 0; $ < v.getModuleCount(); $ += 1)
      for (U = $ * g + w, j = 0; j < v.getModuleCount(); j += 1)
        v.isDark($, j) && (V = j * g + w, K += "M" + V + "," + U + I);
    return K += '" stroke="transparent" fill="black"/>', K += "</svg>", K;
  }, v.createDataURL = function(g, w) {
    g = g || 2, w = typeof w > "u" ? g * 4 : w;
    const x = v.getModuleCount() * g + w * 2, _ = w, T = x - w;
    return Nx(x, x, function(z, j) {
      if (_ <= z && z < T && _ <= j && j < T) {
        const V = Math.floor((z - _) / g), $ = Math.floor((j - _) / g);
        return v.isDark($, V) ? 0 : 1;
      } else
        return 1;
    });
  }, v.createImgTag = function(g, w, x) {
    g = g || 2, w = typeof w > "u" ? g * 4 : w;
    const _ = v.getModuleCount() * g + w * 2;
    let T = "";
    return T += "<img", T += ' src="', T += v.createDataURL(g, w), T += '"', T += ' width="', T += _, T += '"', T += ' height="', T += _, T += '"', x && (T += ' alt="', T += W(x), T += '"'), T += "/>", T;
  };
  const W = function(g) {
    let w = "";
    for (let x = 0; x < g.length; x += 1) {
      const _ = g.charAt(x);
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
  }, D = function(g) {
    g = typeof g > "u" ? 2 : g;
    const x = v.getModuleCount() * 1 + g * 2, _ = g, T = x - g;
    let z, j, V, $, U;
    const K = {
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
    for (z = 0; z < x; z += 2) {
      for (V = Math.floor((z - _) / 1), $ = Math.floor((z + 1 - _) / 1), j = 0; j < x; j += 1)
        U = "█", _ <= j && j < T && _ <= z && z < T && v.isDark(V, Math.floor((j - _) / 1)) && (U = " "), _ <= j && j < T && _ <= z + 1 && z + 1 < T && v.isDark($, Math.floor((j - _) / 1)) ? U += " " : U += "█", Q += g < 1 && z + 1 >= T ? I[U] : K[U];
      Q += `
`;
    }
    return x % 2 && g > 0 ? Q.substring(0, Q.length - x - 1) + Array(x + 1).join("▀") : Q.substring(0, Q.length - 1);
  };
  return v.createASCII = function(g, w) {
    if (g = g || 1, g < 2)
      return D(w);
    g -= 1, w = typeof w > "u" ? g * 2 : w;
    const x = v.getModuleCount() * g + w * 2, _ = w, T = x - w;
    let z, j, V, $;
    const U = Array(g + 1).join("██"), K = Array(g + 1).join("  ");
    let I = "", Q = "";
    for (z = 0; z < x; z += 1) {
      for (V = Math.floor((z - _) / g), Q = "", j = 0; j < x; j += 1)
        $ = 1, _ <= j && j < T && _ <= z && z < T && v.isDark(V, Math.floor((j - _) / g)) && ($ = 0), Q += $ ? U : K;
      for (V = 0; V < g; V += 1)
        I += Q + `
`;
    }
    return I.substring(0, I.length - 1);
  }, v.renderTo2dContext = function(g, w) {
    w = w || 2;
    const x = v.getModuleCount();
    for (let _ = 0; _ < x; _++)
      for (let T = 0; T < x; T++)
        g.fillStyle = v.isDark(_, T) ? "black" : "white", g.fillRect(T * w, _ * w, w, w);
  }, v;
};
ll.stringToBytes = function(n) {
  const a = [];
  for (let r = 0; r < n.length; r += 1) {
    const i = n.charCodeAt(r);
    a.push(i & 255);
  }
  return a;
};
ll.createStringToBytes = function(n, a) {
  const r = (function() {
    const s = Ex(n), c = function() {
      const m = s.read();
      if (m == -1) throw "eof";
      return m;
    };
    let f = 0;
    const u = {};
    for (; ; ) {
      const m = s.read();
      if (m == -1) break;
      const h = c(), v = c(), y = c(), b = String.fromCharCode(m << 8 | h), S = v << 8 | y;
      u[b] = S, f += 1;
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
}, Yl = {
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
      case Vn.PATTERN000:
        return function(u, m) {
          return (u + m) % 2 == 0;
        };
      case Vn.PATTERN001:
        return function(u, m) {
          return u % 2 == 0;
        };
      case Vn.PATTERN010:
        return function(u, m) {
          return m % 3 == 0;
        };
      case Vn.PATTERN011:
        return function(u, m) {
          return (u + m) % 3 == 0;
        };
      case Vn.PATTERN100:
        return function(u, m) {
          return (Math.floor(u / 2) + Math.floor(m / 3)) % 2 == 0;
        };
      case Vn.PATTERN101:
        return function(u, m) {
          return u * m % 2 + u * m % 3 == 0;
        };
      case Vn.PATTERN110:
        return function(u, m) {
          return (u * m % 2 + u * m % 3) % 2 == 0;
        };
      case Vn.PATTERN111:
        return function(u, m) {
          return (u * m % 3 + (u + m) % 2) % 2 == 0;
        };
      default:
        throw "bad maskPattern:" + f;
    }
  }, s.getErrorCorrectPolynomial = function(f) {
    let u = Xl([1], 0);
    for (let m = 0; m < f; m += 1)
      u = u.multiply(Xl([1, Zn.gexp(m)], 0));
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
    for (let y = 0; y < u; y += 1)
      for (let b = 0; b < u; b += 1) {
        let S = 0;
        const E = f.isDark(y, b);
        for (let R = -1; R <= 1; R += 1)
          if (!(y + R < 0 || u <= y + R))
            for (let N = -1; N <= 1; N += 1)
              b + N < 0 || u <= b + N || R == 0 && N == 0 || E == f.isDark(y + R, b + N) && (S += 1);
        S > 5 && (m += 3 + S - 5);
      }
    for (let y = 0; y < u - 1; y += 1)
      for (let b = 0; b < u - 1; b += 1) {
        let S = 0;
        f.isDark(y, b) && (S += 1), f.isDark(y + 1, b) && (S += 1), f.isDark(y, b + 1) && (S += 1), f.isDark(y + 1, b + 1) && (S += 1), (S == 0 || S == 4) && (m += 3);
      }
    for (let y = 0; y < u; y += 1)
      for (let b = 0; b < u - 6; b += 1)
        f.isDark(y, b) && !f.isDark(y, b + 1) && f.isDark(y, b + 2) && f.isDark(y, b + 3) && f.isDark(y, b + 4) && !f.isDark(y, b + 5) && f.isDark(y, b + 6) && (m += 40);
    for (let y = 0; y < u; y += 1)
      for (let b = 0; b < u - 6; b += 1)
        f.isDark(b, y) && !f.isDark(b + 1, y) && f.isDark(b + 2, y) && f.isDark(b + 3, y) && f.isDark(b + 4, y) && !f.isDark(b + 5, y) && f.isDark(b + 6, y) && (m += 40);
    let h = 0;
    for (let y = 0; y < u; y += 1)
      for (let b = 0; b < u; b += 1)
        f.isDark(b, y) && (h += 1);
    const v = Math.abs(100 * h / u / u - 50) / 5;
    return m += v * 10, m;
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
})(), Xl = function(n, a) {
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
    return Xl(c, 0);
  }, i.mod = function(s) {
    if (i.getLength() - s.getLength() < 0)
      return i;
    const c = Zn.glog(i.getAt(0)) - Zn.glog(s.getAt(0)), f = new Array(i.getLength());
    for (let u = 0; u < i.getLength(); u += 1)
      f[u] = i.getAt(u);
    for (let u = 0; u < s.getLength(); u += 1)
      f[u] ^= Zn.gexp(Zn.glog(s.getAt(u)) + c);
    return Xl(f, 0).mod(s);
  }, i;
}, Tp = (function() {
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
      case Yl.L:
        return n[(s - 1) * 4 + 0];
      case Yl.M:
        return n[(s - 1) * 4 + 1];
      case Yl.Q:
        return n[(s - 1) * 4 + 2];
      case Yl.H:
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
      const v = f[h * 3 + 0], y = f[h * 3 + 1], b = f[h * 3 + 2];
      for (let S = 0; S < v; S += 1)
        m.push(a(y, b));
    }
    return m;
  }, r;
})(), Cp = function() {
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
}, xx = function(n) {
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
}, wx = function(n) {
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
}, kx = function(n) {
  const a = pt.MODE_8BIT_BYTE, r = ll.stringToBytes(n), i = {};
  return i.getMode = function() {
    return a;
  }, i.getLength = function(s) {
    return r.length;
  }, i.write = function(s) {
    for (let c = 0; c < r.length; c += 1)
      s.put(r[c], 8);
  }, i;
}, _x = function(n) {
  const a = pt.MODE_KANJI, r = ll.stringToBytes;
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
}, Gm = function() {
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
}, Sx = function() {
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
}, Ex = function(n) {
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
}, zx = function(n, a) {
  const r = n, i = a, s = new Array(n * a), c = {};
  c.setPixel = function(h, v, y) {
    s[v * r + h] = y;
  }, c.write = function(h) {
    h.writeString("GIF87a"), h.writeShort(r), h.writeShort(i), h.writeByte(128), h.writeByte(0), h.writeByte(0), h.writeByte(0), h.writeByte(0), h.writeByte(0), h.writeByte(255), h.writeByte(255), h.writeByte(255), h.writeString(","), h.writeShort(0), h.writeShort(0), h.writeShort(r), h.writeShort(i), h.writeByte(0);
    const v = 2, y = u(v);
    h.writeByte(v);
    let b = 0;
    for (; y.length - b > 255; )
      h.writeByte(255), h.writeBytes(y, b, 255), b += 255;
    h.writeByte(y.length - b), h.writeBytes(y, b, y.length - b), h.writeByte(0), h.writeString(";");
  };
  const f = function(h) {
    const v = h;
    let y = 0, b = 0;
    const S = {};
    return S.write = function(E, R) {
      if (E >>> R)
        throw "length over";
      for (; y + R >= 8; )
        v.writeByte(255 & (E << y | b)), R -= 8 - y, E >>>= 8 - y, b = 0, y = 0;
      b = E << y | b, y = y + R;
    }, S.flush = function() {
      y > 0 && v.writeByte(b);
    }, S;
  }, u = function(h) {
    const v = 1 << h, y = (1 << h) + 1;
    let b = h + 1;
    const S = m();
    for (let O = 0; O < v; O += 1)
      S.add(String.fromCharCode(O));
    S.add(String.fromCharCode(v)), S.add(String.fromCharCode(y));
    const E = Gm(), R = f(E);
    R.write(v, b);
    let N = 0, M = String.fromCharCode(s[N]);
    for (N += 1; N < s.length; ) {
      const O = String.fromCharCode(s[N]);
      N += 1, S.contains(M + O) ? M = M + O : (R.write(S.indexOf(M), b), S.size() < 4095 && (S.size() == 1 << b && (b += 1), S.add(M + O)), M = O);
    }
    return R.write(S.indexOf(M), b), R.write(y, b), R.flush(), E.toByteArray();
  }, m = function() {
    const h = {};
    let v = 0;
    const y = {};
    return y.add = function(b) {
      if (y.contains(b))
        throw "dup key:" + b;
      h[b] = v, v += 1;
    }, y.size = function() {
      return v;
    }, y.indexOf = function(b) {
      return h[b];
    }, y.contains = function(b) {
      return typeof h[b] < "u";
    }, y;
  };
  return c;
}, Nx = function(n, a, r) {
  const i = zx(n, a);
  for (let u = 0; u < a; u += 1)
    for (let m = 0; m < n; m += 1)
      i.setPixel(m, u, r(m, u));
  const s = Gm();
  i.write(s);
  const c = Sx(), f = s.toByteArray();
  for (let u = 0; u < f.length; u += 1)
    c.writeByte(f[u]);
  return c.flush(), "data:image/gif;base64," + c;
};
ll.stringToBytes;
function Tx({ text: n }) {
  const { size: a, path: r } = L.useMemo(() => {
    const i = ll(0, "M");
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
const Jl = L.createContext(""), nc = (n, a) => typeof n == "string" && n.toLowerCase().includes(a);
function Cx({ title: n, children: a, testId: r, ariaLabel: i }) {
  const s = L.useContext(Jl), c = s !== "" && nc(n, s);
  return (
    // While searching, a group with no matching row (and no matching title) hides itself.
    /* @__PURE__ */ te.jsxs("section", { className: s && !c ? "mb-8 not-has-[[data-setting-row]]:hidden" : "mb-8", "data-testid": r, "aria-label": i, children: [
      n && /* @__PURE__ */ te.jsx("h3", { className: "m-0 mb-3 text-[0.9rem] font-medium text-fg", children: n }),
      /* @__PURE__ */ te.jsx("div", { className: "rounded-ui bg-surface-0 px-4", children: /* @__PURE__ */ te.jsx(Jl.Provider, { value: c ? "" : s, children: a }) })
    ] })
  );
}
function Ax({ title: n, description: a, children: r, testId: i }) {
  const s = L.useContext(Jl);
  return s && !nc(n, s) && !nc(a, s) ? null : /* @__PURE__ */ te.jsxs("div", { "data-setting-row": !0, "data-testid": i, className: "flex items-center justify-between gap-6 py-[0.8rem] max-[700px]:flex-wrap max-[700px]:gap-y-2", children: [
    /* @__PURE__ */ te.jsxs("div", { className: "min-w-0 max-[700px]:flex-1 max-[700px]:basis-56", children: [
      /* @__PURE__ */ te.jsx("div", { className: "text-[0.85rem] text-fg", children: n }),
      a && /* @__PURE__ */ te.jsx("div", { className: "mt-[0.15rem] text-[0.75rem] text-subtext-0", children: a })
    ] }),
    r && /* @__PURE__ */ te.jsx("div", { className: "flex shrink-0 items-center gap-2", children: r })
  ] });
}
function Mx({ checked: n, onChange: a, testId: r, label: i }) {
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
const Rx = () => L.useContext(Jl), jx = {
  select: Nc,
  selectHost: jy,
  input: Oy,
  inputPort: Dy,
  inputWide: By,
  addRow: Hy,
  list: Uy,
  hostRow: Ly,
  name: Gy,
  addr: Yy,
  muted: My,
  empty: Ry,
  primary: Qy,
  danger: Vy,
  catalogToggle: Ay
};
//! State the host keeps for a resource rather than for one view of it (`useResourceState`, `@perch/sdk` 1.4): a
//! review's unsent commit message and comment, its pending batch and its operation id, keyed by the screen's
//! own name for the resource (`review:<workspace>:commit`). Every view and copy that names the same key shares the
//! value, and it outlives a reload or swap of the screen's code, a released hidden copy and the phone/desktop
//! layouts trading places. In memory: a page reload starts empty (durable drafts live in their own services).
const Ox = 512, ln = /* @__PURE__ */ new Map(), Kl = /* @__PURE__ */ new Map();
function Ym(n, a) {
  ln.delete(n), ln.set(n, a);
  for (const r of ln.keys()) {
    if (ln.size <= Ox) break;
    Kl.get(r)?.size || ln.delete(r);
  }
}
function Dx(n, a) {
  return ln.has(n) ? ln.get(n) : a;
}
function Bx(n, a, r) {
  const i = Dx(n, r), s = typeof a == "function" ? a(i) : a;
  if (!(ln.has(n) && Object.is(s, i))) {
    Ym(n, s);
    for (const c of [...Kl.get(n) ?? []]) c();
  }
}
function Hx(n, a) {
  if (typeof n != "string" || !n) throw new Error("useResourceState needs a non-empty key.");
  ln.has(n) || Ym(n, a);
  const r = L.useCallback((c) => {
    const f = Kl.get(n) ?? /* @__PURE__ */ new Set();
    return Kl.set(n, f), f.add(c), () => {
      f.delete(c), f.size || Kl.delete(n);
    };
  }, [n]), i = L.useSyncExternalStore(r, () => ln.get(n)), s = L.useCallback((c) => Bx(n, c, a), [n]);
  return [i, s];
}
const Ux = "[--radius:var(--radius-pane)] rounded-soft bg-surface-1/70 shadow-[0_6px_20px_rgba(0,0,0,0.3)] backdrop-blur-xl backdrop-saturate-150", qx = "hover:bg-transparent hover:text-subtext-0 active:bg-surface-1 active:text-fg";
//! `@perch/sdk` for the native client: the surface a stock screen imports (the navigation part, 1.3), with every
//! call going to one abstract host object, `globalThis.perch`, read when called (so a host or a test sets it before
//! mounting). Class helpers, icons, `cn`, `keyLabel` and the host dot are the app's own modules, compiled in, so the
//! classes are the web's to the character. Data hooks subscribe to `perch.subscribe` and read the host's snapshots
//! (`perch.navigation(options)`, `perch.hosts()`, ...), which must return the same object until the data changes.
//! Menus and dialogs Perch draws itself (session menu, new session menu, confirm, select, folder browser,
//! instructions, memory) open through `perch.openOverlay(kind, props)`; their callbacks are plain functions.
const Lx = "1.3.0";
let mi = null;
const Gx = (n) => {
  mi = n;
};
function ve() {
  const n = (typeof mi == "function" ? mi() : mi) ?? globalThis.perch;
  if (!n) throw new Error("@perch/sdk: no perch host (globalThis.perch) is set");
  return n;
}
const Yx = (n) => ve().subscribe?.(n) ?? (() => {
}), Qx = Jy;
function Vx() {
  return typeof globalThis.crypto?.randomUUID == "function" ? globalThis.crypto.randomUUID() : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (n) => {
    const a = Math.floor(Math.random() * 16);
    return (n === "x" ? a : a & 3 | 8).toString(16);
  });
}
const Qm = globalThis.perch?.isMac !== !1, ac = (n) => yv(n, ve().isMac !== !1), Kx = (n) => wv(n), Zx = ({ className: n, ...a } = {}) => Oe(_v(a), n), Xx = Ev, Vm = (n) => Wo(n), hi = zv, Jx = Wl, $x = Sm, Wx = (n) => ec[n].color, Fx = (n, a) => ve().shortcutFor?.(n, a) ?? null, Ix = (n) => ve().shortcutLabel?.(n) ?? null, Il = (n, a) => ve().command(n, a ?? {}) !== !1, Px = (n, a, r) => ve().startSession?.(n, a, r), ew = globalThis.perch?.pickFolder ? (n) => ve().pickFolder(n) : null;
function Qe(n) {
  const a = L.useRef(n);
  return a.current = n, L.useSyncExternalStore(Yx, () => a.current(ve()));
}
const Km = (n = {}) => Qe((a) => a.navigation({ showTerminals: !!n.showTerminals, sortByAttention: !!n.sortByAttention })), tw = () => Qe((n) => n.hosts()), nw = () => Qe((n) => n.sessionFolders());
function aw() {
  const n = Qe((a) => a.addProject?.() ?? lw);
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
const lw = Object.freeze({ status: "idle" }), Zm = "perch.lastAgentChoice", rw = Object.freeze({ connected: !1, discovery: !1, state: "ready", choices: [] }), iw = () => {
  const n = ve().storage?.getItem(Zm);
  return n === "claude" || n === "codex" ? n : "claude";
}, sw = Object.freeze({ items: [] });
function ow() {
  const n = Qe((a) => a.notifications?.() ?? sw);
  return L.useMemo(() => ({
    items: n.items ?? [],
    open: (a) => ve().command("notification.open", { id: a }),
    dismiss: (a) => ve().command("notification.dismiss", { id: a })
  }), [n]);
}
function cw(n) {
  const a = Qe((s) => s.agentChoices?.(n) ?? rw), [r, i] = L.useState(iw);
  return L.useMemo(() => ({
    connected: !!a.connected,
    discovery: !!a.discovery,
    choices: a.choices ?? [],
    lastChoice: r,
    state: a.state ?? "ready",
    error: a.state === "error" ? a.error : void 0,
    rememberChoice: (s) => {
      s !== "claude" && s !== "codex" || (ve().storage?.setItem(Zm, s), i(s));
    },
    manage: () => ve().command("agents.manage", {})
  }), [a, r]);
}
function uw(n) {
  Je(() => ve().onRequest?.("add-project", n) ?? void 0, [n]);
}
function dw(n) {
  const a = n.map((r) => ({ id: r.id, parentSessionId: r.parentId, session: r }));
  return Xy(a).map((r) => ({ session: r.session, nested: tc(r, a) }));
}
function fw({ id: n, plain: a, className: r }) {
  const i = Qe((h) => h.session(n));
  if (!i) return null;
  const s = i.state ?? Zy(i), c = ec[s]?.color ?? ec.unknown.color, f = i.provider, u = f === "claude" || f === "claude-agent-teams" || f === "omp", m = a ? Oe("agent-mark", "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full leading-none", r) : Oe("agent-status-dot", `agent-status-dot--${s}`, "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-[1.5px] bg-panel-bg leading-none", r);
  return L.createElement(
    "span",
    { className: m, style: a ? void 0 : { borderColor: c }, "data-provider": f ?? "unknown", title: a ? f ?? "Agent" : `${f ?? "Agent"} · ${s}`, "aria-hidden": "true" },
    L.createElement("span", { className: Oe("inline-flex text-fg", u && "rounded-full bg-[#161616]") }, L.createElement(Xm, { provider: f, size: 14 }))
  );
}
function Xm({ provider: n, size: a = 14 }) {
  const r = ve().agentIcon?.(n, a) ?? null, i = r?.markup ?? '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><circle cx="8" cy="8" r="5" fill="currentColor"/></svg>';
  return L.createElement("svg", { width: a, height: a, "aria-hidden": "true", "data-agent-icon": n ?? "unknown", "data-perch-markup": i, ...r && r.tint === !1 ? { "data-perch-image": "true" } : {} });
}
const pw = ({ children: n }) => L.createElement(L.Fragment, null, n);
function mw(n, a) {
  const r = L.useRef(a);
  return r.current = a, Je(() => {
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
  return mw(n, r);
}, hw = Wn("session-menu"), gw = Wn("new-session-menu"), bw = Wn("confirm");
let Jm = null;
const vw = (n) => {
  Jm = n;
};
function yw(n) {
  return L.createElement(Jm ?? bw, n);
}
function xw({ className: n = Nc, ...a }) {
  return L.createElement(Ny, { ...a, className: n });
}
let lc = null;
const ww = (n) => {
  lc = n;
}, kw = Wn("folder-browser");
function _w(n) {
  return lc ? L.createElement(lc, { ...n, browse: (a) => ve().browse(n.hostId, a) }) : L.createElement(kw, n);
}
const Sw = Wn("instructions"), Ew = Wn("memory"), zw = Mv;
let Ac = null;
const Nw = (n) => {
  Ac = n;
};
function Tw(n) {
  if (Ac) return L.createElement(Aw, n);
  const { hostId: a, path: r, className: i } = n, s = L.useRef(null);
  return L.createElement(
    "button",
    {
      type: "button",
      ref: s,
      className: Oe("worktree-menu__btn", Sm, i),
      "data-testid": `worktree-menu-${a}-${r}`,
      title: "New workspace (a git worktree)",
      "aria-label": "New workspace",
      "aria-expanded": !1,
      onClick: () => ve().openOverlay?.("worktree", { hostId: a, cwd: r, anchor: s.current?.getBoundingClientRect() })
    },
    L.createElement(Em, null)
  );
}
const $m = "Perch did not answer.";
function ci(n) {
  return n ? n.type === "worktree.error" ? { error: n.message, dirty: !!n.dirty } : n.error ? { error: String(n.error) } : {} : { error: $m };
}
function Cw(n, a, r = ve()) {
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
const Ap = 5 * 6e4;
function Wm(n, a, r, i = ve()) {
  const s = Date.now() + Ap;
  let c = !1, f = () => {
  };
  const u = () => {
    c = !0, f(), clearTimeout(h);
  }, m = () => {
    if (!c) {
      if (Date.now() >= s) return u();
      Cw(n, a, i) && (u(), i.startSession?.(n, a, r));
    }
  }, h = setTimeout(u, Ap);
  f = i.subscribe?.(m) ?? (() => {
  }), m();
}
function Aw({ hostId: n, path: a, className: r, worktrees: i, request: s, parentChoices: c, emptyAgent: f, ...u }) {
  const [m, h] = L.useState(i), v = (_) => !!ve().coreCan?.(_, n), y = Km(), b = `${n}:${a}`, S = L.useMemo(() => {
    if (Array.isArray(c)) return c;
    if (!v("workspace.nest")) return [];
    const _ = y?.projects?.find((j) => j.hostId === n && j.repoPath === a), T = [], z = (j, V) => {
      for (const $ of j ?? [])
        V && T.push({ id: $.id, name: $.name, path: $.path }), z($.children, !0);
    };
    return z(_?.workspaces, !1), T;
  }, [c, y, n, a]), E = n === "local" && v("worktree.job"), R = u.deleteSupported ?? v("worktree.delete"), N = u.startFromSupported ?? v("worktree.startFrom"), M = Qe((_) => _.emptyWorkspaceAgent?.() ?? void 0), O = f ?? M ?? void 0, H = Qe((_) => _.worktreeMenuRequest?.() ?? null), X = H?.projectKey === b ? H.nonce : null, W = L.useMemo(() => s ?? (X == null ? null : H), [s, X]), [D, g] = L.useState(W);
  Je(() => {
    W && g(W);
  }, [W]);
  const w = L.useRef({});
  w.current = { background: E, deleteSupported: R };
  const x = L.useMemo(() => {
    const _ = (T, z) => ve().ask(T, { hostId: n, repoPath: a, ...z });
    return {
      list: async () => {
        const T = await _("worktree.list", {});
        return T?.type === "worktree.list.result" && h({ worktrees: T.worktrees ?? [], defaultRoot: T.defaultRoot ?? "", baseRef: T.baseRef, refs: T.refs ?? [] }), ci(T);
      },
      create: async ({ branch: T, newBranch: z, path: j, extra: V, agent: $ }) => {
        const U = { branch: T, newBranch: !!z, path: j ?? null, name: V?.name ?? null, startFrom: V?.startFrom ?? null, parentWorkspaceId: V?.parentWorkspaceId ?? null }, { background: K } = w.current, I = await _(K ? "worktree.job.start" : "worktree.create", U), Q = K ? "worktree.job.started" : "worktree.done";
        if (I?.type !== Q) return { error: ci(I).error ?? $m };
        const Z = K ? I.job?.path : I.path;
        return $ && Z && Wm(n, Z, $), { background: K };
      },
      remove: async (T, z) => {
        const j = await _("worktree.remove", { path: T, force: !!z, deleteBranch: w.current.deleteSupported });
        return { ...ci(j), preservedBranch: j?.type === "worktree.done" ? j.preservedBranch ?? void 0 : void 0 };
      },
      deleteBranch: async (T, z) => ci(await _("worktree.branch.delete", { branch: T, expectedHead: z })),
      open: (T) => ve().startSession?.(n, T, "terminal"),
      // The window forgets the request; the screen keeps it until a newer one, as clearing it would re-run (and so
      // cancel) the screen's effect that a measurement put off until the next frame (`measured`).
      takeRequest: () => ve().takeWorktreeRequest?.()
    };
  }, [n, a]);
  return L.createElement(Ac, {
    hostId: n,
    cwd: a,
    projectKey: b,
    className: r,
    worktrees: m,
    background: E,
    startFromSupported: N,
    deleteSupported: R,
    parentChoices: S,
    emptyAgent: O,
    request: D,
    actions: x
  });
}
const Mw = (n, a) => {
  if (!ve().followPointer?.(n)) return;
  const r = a.items();
  for (const i of r) i.getBoundingClientRect();
  r[0]?.parentElement?.getBoundingClientRect(), hv(n, a);
}, Rw = () => Qe((n) => n.workspaceTabs());
function jw({ path: n, content: a }) {
  const { source: r, truncated: i } = wy(a ?? ""), s = L.useMemo(() => Sy(r), [r]), c = L.useMemo(() => Ey((v) => Il("link.open", { url: v })), [r]), [f, u] = L.useState({ lexer: null, count: 0 }), m = f.lexer === c ? f.count : 0;
  Je(() => {
    if (m >= s.length) return;
    const v = () => {
      c.add(s[m]), u({ lexer: c, count: m + 1 });
    };
    if (m === 0) {
      v();
      return;
    }
    const y = setTimeout(v, 0);
    return () => clearTimeout(y);
  }, [c, s, m]);
  const h = L.useMemo(() => c.elements(), [c, m]);
  return L.createElement(
    "div",
    { className: "min-h-0 min-w-0 flex-1 overflow-auto px-4 py-3 text-[0.8rem]", tabIndex: 0, role: "region", "aria-label": `Rendered preview of ${n}`, "data-testid": "workspace-markdown-preview" },
    i && L.createElement(
      "p",
      { role: "status", className: "mt-0 text-[0.7rem] text-yellow", "data-testid": "workspace-markdown-truncated" },
      `This document is large: only the first ${pi.toLocaleString()} characters are rendered. Switch to Source to see all of it.`
    ),
    L.createElement("div", { className: "message__markdown file-markdown" }, h)
  );
}
const Ow = Wn("file-menu"), Dw = /* @__PURE__ */ new Map(), Bw = ["requestTree", "searchFiles", "openFile", "reloadFile", "requestPreview", "updateDraft", "saveFile", "overwriteFile", "setWrap"];
function Hw(n, a = {}) {
  const r = Qe((h) => h.workspaceFiles(n)), i = !!a.git, s = r.git?.decorations, c = L.useMemo(() => i && s?.length ? new Map(s) : Dw, [s, i]), f = L.useMemo(() => Object.fromEntries(Bw.map((h) => [h, (...v) => (ve().filesDo(h, n, ...v), null)])), [n]), u = Qe((h) => !!h.contextBridgeAvailable?.(n)), m = L.useMemo(() => u ? (h) => {
    if (h.kind !== "editor") return ve().askAgent(n, h);
    const v = ve().workspaceFiles(n)?.documents?.[h.path];
    return ve().askAgent(n, { ...h, dirty: v?.content !== v?.savedContent });
  } : void 0, [u, n]);
  return L.useMemo(() => ({
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
const Uw = () => Qe((n) => n.statusLine()), qw = () => Qe((n) => n.zoom()), Lw = () => Qe((n) => n.paneLook()), Gw = () => Qe((n) => n.keybindings?.() ?? []), Yw = Object.freeze({ usage: Object.freeze([]), updatedAt: 0, spend: null, redeemResult: null });
function Qw(n) {
  const a = !!n?.keepFresh, r = Qe((s) => s.statusLine?.().connected ?? !1), i = Qe((s) => s.planUsage?.() ?? Yw);
  return Je(() => {
    if (!a || !r) return;
    let s;
    const c = () => {
      ve().command("usage.get"), s = setTimeout(c, 18e4);
    };
    return c(), () => clearTimeout(s);
  }, [a, r]), i;
}
const Vw = () => ve().command("usage.get", { force: !0 }), Kw = (n) => ve().command("usage.redeemReset", { accountId: n }), Zw = () => Il("app.zoom_reset"), Xw = {
  focused: "bg-[color-mix(in_srgb,var(--text)_10%,var(--panel-bg))] hover:bg-[color-mix(in_srgb,var(--text)_10%,var(--panel-bg))] text-fg font-semibold",
  visible: "bg-transparent text-subtext-0 hover:bg-surface-0 hover:text-fg",
  hidden: "bg-transparent text-subtext-0 hover:bg-surface-0 hover:text-fg"
}, Jw = (n, a, r) => ve().beginTabDrag?.(n, a, r);
function $w(n) {
  Je(() => ve().onRequest?.("new-tab", n) ?? void 0, [n]);
}
const Ww = (n) => Il("browser.open", { workspaceId: n }), Fw = (n, a) => Il("file.open", { workspaceId: n, path: a }), Iw = () => null, Pw = () => null, e4 = Wn("new-file");
function t4(n) {
  return L.createElement(sx, { ...n, perch: ve() });
}
function n4(n, a) {
  const r = n.selection(a);
  if (r) return r;
  const i = n.value(a), s = i.split(`
`).length - (i.endsWith(`
`) && i.length ? 1 : 0);
  return { text: i, startLine: 1, endLine: Math.max(1, s) };
}
function a4({ onGo: n, onClose: a }) {
  const [r, i] = L.useState(""), s = (c) => {
    c?.preventDefault?.();
    const [f, u] = r.split(":").map((m) => Number.parseInt(m, 10));
    Number.isFinite(f) ? n(f, Number.isFinite(u) ? u : 1) : a();
  };
  return L.createElement(
    "div",
    { className: "flex shrink-0 items-center gap-2 border-b border-border px-3 py-1 text-[0.75rem] text-subtext-0", "data-testid": "editor-goto" },
    L.createElement("label", { htmlFor: "perch-editor-goto" }, "Go to line"),
    L.createElement("input", {
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
    L.createElement("button", { type: "button", className: Wl, onClick: s }, "OK")
  );
}
function l4({ value: n, onChange: a, onSave: r, onCaret: i, readOnly: s, wrap: c, label: f, path: u, docKey: m, onAskAgent: h, ref: v }) {
  const y = ve().editor, b = L.useRef(null);
  b.current = { onChange: a, onSave: r, onCaret: i, onAskAgent: h };
  const [S, , E] = String(m).split("\0"), R = !!y && E !== void 0 && /^\d+$/.test(E), N = Qe((x) => R ? x.workspaceFiles(S)?.carets?.[m] ?? null : null);
  Je(() => {
    N && b.current.onCaret?.({ line: N.line, col: N.col });
  }, [N?.line, N?.col]);
  const M = L.useRef(n), [O, H] = L.useState(null), [X, W] = L.useState(!1), D = () => {
    if (!y || !b.current.onAskAgent) return;
    const { text: x, startLine: _, endLine: T } = n4(y, m);
    b.current.onAskAgent(x, _, T);
  };
  if (L.useImperativeHandle(v, () => ({
    openGoto: () => W(!0),
    focus: () => y?.focus(m),
    askAgent: D
  }), [m]), bi(() => {
    if (!y) return;
    y.open(m, { path: u, value: n, readonly: !!s, wrap: !!c, label: f }), M.current = n;
    const x = y.watch(m, (_) => {
      for (const T of _)
        if (T.type === "change") {
          const z = y.value(m);
          M.current = z, b.current.onChange?.(z);
        } else T.type === "caret" ? b.current.onCaret?.({ line: T.line, col: T.col }) : T.type === "save" ? b.current.onSave?.() : T.type === "goto" ? W(!0) : T.type === "contextmenu" && H({ x: T.x, y: T.y });
    });
    return () => {
      x(), y.park(m);
    };
  }, [m]), Je(() => {
    !y || R || n === M.current || (M.current = n, y.setValue(m, n, { external: !0 }));
  }, [m, n]), Je(() => {
    y?.setReadonly(m, !!s);
  }, [m, s]), Je(() => {
    y?.setWrap(m, !!c);
  }, [m, c]), !y)
    return L.createElement("textarea", { className: "h-full min-h-0 w-full flex-1 bg-transparent font-mono text-text", "aria-label": f, value: n, readOnly: s, onChange: (x) => a?.(x.target.value) });
  const g = (x) => () => {
    H(null), x(), y.focus(m);
  }, w = O ? !!y.selection(m) : !1;
  return L.createElement(
    "div",
    { className: "relative flex h-full min-h-0 min-w-0 flex-1 flex-col", "aria-label": f },
    X && L.createElement(a4, {
      onGo: (x, _) => {
        W(!1), y.goTo(m, x, _), y.focus(m);
      },
      onClose: () => {
        W(!1), y.focus(m);
      }
    }),
    L.createElement("div", { "data-perch-engine": "editor", "data-perch-key": m, className: "min-h-0 min-w-0 flex-1" }),
    O && L.createElement(Cy, {
      x: O.x,
      y: O.y,
      readOnly: !!s,
      canUndo: y.canUndo(m),
      canRedo: y.canRedo(m),
      hasSelection: w,
      onClose: () => H(null),
      actions: {
        undo: g(() => y.undo(m)),
        redo: g(() => y.redo(m)),
        cut: g(() => y.cut(m)),
        copy: g(() => y.copy(m)),
        paste: g(() => y.paste(m)),
        selectAll: g(() => y.selectAll(m)),
        find: g(() => y.openSearch(m, !1)),
        replace: g(() => y.openSearch(m, !0)),
        gotoLine: () => {
          H(null), W(!0);
        },
        ...h ? { askAgent: () => {
          H(null), D();
        } } : {}
      }
    })
  );
}
const r4 = Object.freeze({ pages: [], shownId: null, tabCount: 0 });
function i4(n) {
  const a = Qe((r) => r.browserPages?.(n) ?? r4);
  return L.useMemo(() => {
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
function s4({ pageId: n, active: a }) {
  const r = `drawer
${n}`;
  return Je(() => {
    a && ve().command("browser.focus", { key: r });
  }, [a, r]), L.createElement("div", {
    "data-perch-engine": "browser",
    "data-perch-key": r,
    "data-testid": "browser-page",
    style: { display: "flex", flex: "1 1 0%", minHeight: 0, minWidth: 0 }
  });
}
const S4 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  AgentIcon: Xm,
  BrowserPage: s4,
  Chevron: Cc,
  CloseIcon: Cv,
  CodeEditor: l4,
  ConfirmDialog: yw,
  Dialog: zw,
  EllipsisIcon: Nv,
  FileAsset: t4,
  FileEntryMenu: Ow,
  FileIcon: ux,
  FolderBrowser: _w,
  GearIcon: Tv,
  GitMarker: px,
  HostStateDot: Av,
  InstructionsDialog: Sw,
  MarkdownPreview: jw,
  MemoryDialog: Ew,
  ModeSwitch: yx,
  NewFilePrompt: e4,
  NewSessionMenu: gw,
  PageIcon: $y,
  PlusIcon: Em,
  QrCode: Tx,
  Select: xw,
  SessionDot: fw,
  SessionMenu: hw,
  SettingRow: Ax,
  SettingsGroup: Cx,
  SettingsQuery: Jl,
  Slot: pw,
  Submenu: Ky,
  Switch: Mx,
  TabDragLayer: Pw,
  TabMenu: Iw,
  WorktreeMenu: Tw,
  agentStateColor: Wx,
  anchoredPopoverStyle: Qx,
  assetKind: qm,
  beginReorderDrag: Mw,
  beginTabDrag: Jw,
  bindHost: Gx,
  buttonClass: Xx,
  cn: Oe,
  drawConfirmationsInPlace: vw,
  drawFolderBrowserInPlace: ww,
  drawWorktreeInPlace: Nw,
  ghostButton: Jx,
  glassClass: Ux,
  iconButton: $x,
  isMac: Qm,
  keyLabel: ac,
  menuDividerClass: hi,
  menuItemClass: Vm,
  menuPanel: Hi,
  nestSessions: dw,
  newId: Vx,
  openBrowserTab: Ww,
  openFileTab: Fw,
  pickFolder: ew,
  redeemUsageReset: Kw,
  refreshUsage: Vw,
  resetZoom: Zw,
  rowActionClass: Zx,
  runCommand: Il,
  segmentClass: Kx,
  settingsClass: jx,
  shortcutFor: Fx,
  shortcutLabel: Ix,
  startPaneWhenReady: Wm,
  startSession: Px,
  tabStateClass: Xw,
  tapButtonClass: qx,
  useAddProject: aw,
  useAddProjectRequest: uw,
  useAgentChoices: cw,
  useBrowserPages: i4,
  useDismissOnOutsideClick: Um,
  useHostSnapshot: Qe,
  useHosts: tw,
  useKeybindings: Gw,
  useNavigation: Km,
  useNewTabRequest: $w,
  useNotifications: ow,
  usePaneLook: Lw,
  usePlanUsage: Qw,
  useResourceState: Hx,
  useSessionFolders: nw,
  useSettingsQuery: Rx,
  useStatusLine: Uw,
  useWorkspaceFiles: Hw,
  useWorkspaceTabs: Rw,
  useZoom: qw,
  version: Lx
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
const Mc = {
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
  Mc[n] = (a, r) => a[n](r);
const E4 = Object.keys(Mc);
function Do(n, a) {
  for (const [r, i] of Object.entries(a)) {
    const s = Mc[r];
    if (!s) throw new Error(`the description key ${r} has no GPUI builder`);
    i != null && (n = s(n, i));
  }
  return n;
}
const va = (n) => ({ clientX: n?.position?.x ?? 0, clientY: n?.position?.y ?? 0 }), rc = /* @__PURE__ */ new WeakSet(), gi = /* @__PURE__ */ new WeakSet();
function Mp(n, a, r) {
  const i = n.pressed, s = va(r);
  return i && i.x === s.clientX && i.y === s.clientY ? i.id : a;
}
function o4(n, a, r) {
  if (n.name) return n.name;
  if (!(a.size || n.hover || n.focus || n.active || n.track_hover && Mi.has(n.group) || r)) return null;
  const i = n.meta?.attrs["data-testid"];
  return i ? `~${n.id}:${i}` : `~${n.id}`;
}
const Fm = (n, a = !1) => (n.children ?? []).some((r) => r.kind === "text" ? !a || /\s/.test(String(r.text ?? "").trim()) : r.kind === "div" && r.style?.flex_direction !== "row" && r.style?.whitespace !== "nowrap" && Fm(r, !0)), Mt = (n) => n.style?.display !== "hidden";
let Mi = /* @__PURE__ */ new Set(), ic = null;
const Rp = /* @__PURE__ */ new WeakMap();
function Im(n, a = /* @__PURE__ */ new Set()) {
  let r = Rp.get(n);
  if (!r) {
    r = /* @__PURE__ */ new Set();
    for (const { group: i, style: s } of n.group_hover ?? []) "display" in s && r.add(i);
    for (const i of n.children ?? []) if (i.kind !== "text") for (const s of Im(i)) r.add(s);
    Rp.set(n, r);
  }
  for (const i of r) a.add(i);
  return a;
}
let an = null;
const c4 = (n, a, r, i, s, c, f) => `${+a}|${r}|${i.text_size}|${i.line_height}|${i.whitespace}|${i.text_ellipsis}|${+s}|${c ? `${c.group}|${c.color}` : ""}|${+rc.has(n)}|${+gi.has(n)}|${f.get(n)?.flex_basis ?? ""}`, jp = /* @__PURE__ */ new WeakMap();
function Pm(n) {
  let a = jp.get(n);
  return a === void 0 && (a = n.style.overflow_x === "scroll" || n.style.overflow_y === "scroll" || (n.children ?? []).some((r) => r.kind !== "text" && Pm(r)), jp.set(n, a)), a;
}
function eh(n, a, r, i) {
  let s = u4(a.get(n), r.get(n));
  if (n.kind === "text") return s;
  for (const c of n.children ?? []) eh(c, a, r, i) || (s = !1);
  return s && i.add(n), s;
}
function u4(n, a) {
  if (n === a) return !0;
  if (!n || !a) return !1;
  const r = Object.keys(n);
  if (r.length !== Object.keys(a).length) return !1;
  for (const i of r) if (n[i] !== a[i]) return !1;
  return !0;
}
function sc(n, a, r, i, s = !1, c = !1, f = null, u = {}, m = !1, h = /* @__PURE__ */ new Map(), v = null) {
  if (n.kind === "text") return h.get(n)?.text ?? n.text;
  const y = an && !s && !Pm(n) ? c4(n, c, f, u, m, v, h) : null;
  if (y !== null && an.clean.has(n)) {
    const S = an.from.get(n), E = S?.key === y ? a.reuse(S.id, an.generation) : null;
    if (E)
      return an.next.set(n, { id: E.__id, key: y }), E;
  }
  const b = d4(n, a, r, i, s, c, f, u, m, h, v);
  return y !== null && an.next.set(n, { id: b.__id, key: y }), b;
}
function d4(n, a, r, i, s, c, f, u, m, h, v) {
  const y = rc.has(n);
  c ||= n.style.opacity === 0 || n.style.visibility === "invisible" || n.style.display === "hidden", c && (n.name || n.range_name) && (n = { ...n, name: void 0, range_name: void 0, also: void 0 }), n.style.text_color !== void 0 && (v = null), f = n.style.text_color ?? f;
  const b = !!n.hover?.text_color && lh(n), S = n.group ?? (b ? `~g${n.id}` : null);
  b && (v = { group: S, color: n.hover.text_color }), u = { ...u };
  for (const z of ["text_size", "line_height", "whitespace", "text_ellipsis"]) n.style[z] !== void 0 && (u[z] = n.style[z]);
  const E = new Set(n.events ?? []), R = s ? { count: 0, hits: /* @__PURE__ */ new Set(), at: null } : !c && !n.pointer_none && n.style.position === "absolute" ? ic : null, N = R ? R.count++ : -1;
  s && (ic = R);
  let M;
  if (n.kind === "image" && !n.markup ? M = a.image(n.src) : M = a.div(), n.kind === "engine" && (M = M.child(i.engine ? i.engine(n.engine, n.key) : a.div())), n.markup && n.kind === "svg" && v && v.color !== f) {
    const { group: z, color: j } = v, V = () => a.div().absolute().top(0).left(0).size_full();
    M = M.child(V().group_hover(z, ($) => $.invisible()).child(i.icon(`~icon-${n.id}`, n.markup, f))).child(V().invisible().group_hover(z, ($) => $.visible()).child(i.icon(`~icon-${n.id}-hover`, n.markup, j)));
  } else n.markup && (M = M.child(i.icon(`~icon-${n.id}`, n.markup, n.kind === "svg" ? f : "")));
  const O = o4(n, E, !!R);
  if (O && (M = M.id(O)), n.measure && (M = M.measure(n.measure)), n.name && M.also_named) for (const z of n.also ?? []) M = M.also_named(z);
  M = Do(M, { ...n.style, ...h.get(n) });
  const H = u.whitespace !== "nowrap" && !u.text_ellipsis;
  m && H && n.style.flex_shrink !== 0 && n.style.min_w === void 0 && Fm(n) && (M = M.min_w(0));
  for (const z of ["hover", "focus", "active"]) n[z] && (M = M[z]((j) => Do(j, n[z])));
  S && (M = M.group(S));
  for (const { group: z, style: j } of n.group_hover ?? []) {
    const { display: V, ...$ } = j;
    Object.keys($).length && (M = M.group_hover(z, (U) => Do(U, $)));
  }
  if (a.scroll && (n.style.overflow_x === "scroll" || n.style.overflow_y === "scroll")) {
    const z = r.document?.scrollTarget, j = z ? (n.children ?? []).filter(Mt).findIndex((V) => ah(V, z.id)) : -1;
    if (j >= 0 && (r.scroller ?? n.id) === n.id && (r.document.scrollTarget = null, r.scroller = n.id, a.scroll.scroll_to_item(j)), r.scroller ??= n.id, r.scroller === n.id && r.document) {
      M = M.track_scroll(a.scroll);
      const V = (n.children ?? []).filter(Mt).map(($) => $.id);
      r.document.itemBounds = ($) => V.includes($) ? a.scroll.item_bounds?.(V.indexOf($)) ?? null : null;
    }
  }
  const X = n.style.overflow_x === "scroll" || n.style.overflow_y === "scroll", W = s && !n.pointer_none || n.blocks_pointer;
  if ((X && gi.has(n) || W) && (M = M.on_scroll_wheel((z, j) => j.stop_propagation?.())), X && E.has("scroll") && (M = M.on_scroll_wheel((z, j) => {
    r.dispatch(n.id, "scroll", {}), j.notify();
  })), X || gi.has(n)) for (const z of n.children ?? []) z.kind !== "text" && gi.add(z);
  n.kind === "input" && !n.disabled && (M = M.on_mouse_down("left", (z, j) => {
    z.bounds && r.setBounds(n.id, z.bounds), r.focus(n.id), j.notify();
  }));
  const D = n.kind === "input" ? n : n.meta?.tag === "label" ? nh(n) : null;
  D && !D.disabled && /^(checkbox|radio)$/.test(D.input_type) && (M = M.on_click((z, j) => {
    j.stop_propagation?.(), r.toggle(D.id), j.notify();
  }));
  const g = ["click", "double_click", "context_menu", "mouse_down", "mouse_up"].some((z) => E.has(z));
  if (g || y) for (const z of n.children ?? []) z.kind !== "text" && rc.add(z);
  if (g && (M = M.on_mouse_down("left", (z, j) => {
    j.stop_propagation?.(), z.bounds && r.setBounds(n.id, z.bounds);
    const V = { ...va(z), button: 0, buttons: 1, detail: z.click_count }, $ = Mp(r, n.id, z);
    r.pressed = null, r.dispatch($, "pointerdown", { ...V, pointerType: "mouse" }), r.dispatch($, "mousedown", V) && r.pressFocus?.($), j.notify();
  }), M = M.on_mouse_down("right", (z, j) => {
    j.stop_propagation?.(), z.bounds && r.setBounds(n.id, z.bounds);
    const V = Mp(r, n.id, z);
    r.pressed = null, r.dispatch(V, "contextmenu", { ...va(z), button: 2 }), j.notify();
  }), M = M.on_mouse_up("left", (z, j) => {
    j.stop_propagation?.();
    const V = { ...va(z), button: 0 };
    r.dispatch(n.id, "pointerup", { ...V, pointerType: "mouse" }), r.dispatch(n.id, "mouseup", V), j.notify();
  }), M = M.on_click((z, j) => {
    r.dispatch(n.id, z.click_count === 2 && E.has("double_click") ? "dblclick" : "click", { detail: z.click_count, button: 0 }), j.notify();
  })), n.blocks_pointer && !g)
    for (const z of ["left", "right"]) M = M.on_mouse_down(z, (j, V) => V.stop_propagation?.());
  else if (y && !g)
    for (const z of ["left", "right"])
      M = M.on_mouse_down(z, (j) => {
        const V = va(j);
        (r.pressed?.x !== V.clientX || r.pressed?.y !== V.clientY) && (r.pressed = { id: n.id, x: V.clientX, y: V.clientY });
      });
  if (E.has("mouse_move") && (M = M.on_mouse_move((z) => {
    r.dispatch(n.id, "pointermove", { ...va(z), pointerType: "mouse" });
  })), n.track_hover && Mi.has(n.group) && (M = M.on_hover((z, j) => {
    r.hover(n.id, z), j.notify();
  })), R && (M = M.on_mouse_down_out((z, j) => {
    const V = va(z), $ = `${V.clientX},${V.clientY}`;
    R.at !== $ && (R.at = $, R.hits = /* @__PURE__ */ new Set()), R.hits.add(N), !(R.hits.size < R.count) && (R.at = null, r.dispatch(r.document.body.id, "pointerdown", { ...V, pointerType: "mouse" }), r.dispatch(r.document.body.id, "mousedown", V), j.notify());
  })), n.kind === "input" && !/^(checkbox|radio|range|color|file|select)$/.test(n.input_type)) {
    const z = n.value ? String(n.value) : String(n.placeholder ?? "");
    let j = a.div().whitespace_nowrap().overflow_x_hidden();
    const V = wa(u);
    V && (j = j.h(V)), !n.value && f && (j = j.text_color(p4(f))), z && (M = M.child(j.child(n.input_type === "password" && n.value ? "•".repeat([...z].length) : z))), n.field_w && (M = M.child(a.div().w(n.field_w).h(0)));
  }
  const w = u.whitespace === "nowrap" ? wa(u) : null, x = n.style.display === "flex" && !String(n.style.flex_direction ?? "row").startsWith("col");
  let _ = !n.range_name;
  const T = n.style.display === "flex" && String(n.style.flex_direction ?? "row").startsWith("col") && (n.style.h === void 0 || n.style.h === "auto") && typeof n.style.max_h == "number";
  for (const z of (n.children ?? []).filter(Mt)) {
    const j = z.style?.flex_basis;
    T && z.style.flex_grow > 0 && (j === 0 || typeof j == "string" && j.endsWith("%")) && h.set(z, { ...h.get(z), flex_basis: "auto" });
    let V = sc(z, a, r, i, !1, c, f, u, x && z.style?.position !== "absolute", h, v);
    const $ = !_ && (z.kind === "text" || !z.meta), U = z.kind === "text" ? h.get(z)?.h ?? w : null, K = z.kind === "text" ? h.get(z)?.w : void 0;
    if ($ || U || K !== void 0) {
      let I = a.div();
      $ && (I = I.id(n.range_name)), $ && !x && n.style.display === "flex" && (I = I[`self_${f4[u.text_align] ?? "start"}`]().max_w("100%")), U && (I = I.h(U)), K !== void 0 && (I = I.w(K).flex_none().whitespace_nowrap()), V = I.child(V), _ ||= $;
    }
    M = M.child(V);
  }
  return M;
}
const f4 = { center: "center", right: "end", end: "end" };
function p4(n) {
  const a = String(n);
  if (!/^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(a)) return n;
  const r = a.length === 9 ? Number.parseInt(a.slice(7), 16) : 255;
  return `${a.slice(0, 7)}${Math.round(r / 2).toString(16).padStart(2, "0")}`;
}
const th = /^(?:[!-,.-~]+|\S)$/u, nh = (n) => {
  for (const a of n.children ?? []) {
    if (a.kind === "input" && /^(checkbox|radio)$/.test(a.input_type)) return a;
    const r = a.kind === "text" ? null : nh(a);
    if (r) return r;
  }
  return null;
}, ah = (n, a) => n.id === a || (n.children ?? []).some((r) => r.kind !== "text" && ah(r, a)), lh = (n) => !!n.markup || (n.children ?? []).some((a) => a.kind !== "text" && lh(a));
function wa(n) {
  const a = n.line_height;
  return typeof a == "string" && a.endsWith("px") ? Number.parseFloat(a) : typeof a == "number" && typeof n.text_size == "number" ? a * n.text_size : null;
}
function z4(n, a, r, i, s = 0, c = !1) {
  const f = [n.root, ...n.overlays];
  Mi = /* @__PURE__ */ new Set(), ic = null;
  for (const b of f) Im(b, Mi);
  const u = s > 0 ? x4(f, s) : /* @__PURE__ */ new Map();
  s > 0 && i.measure && m4(f, s, i.measure, u), v4(f, u), b4(f, u), i.measure && g4(f, i.measure, u);
  const m = a.reuse && a.renderGeneration ? r.retained ??= { built: /* @__PURE__ */ new Map(), overrides: /* @__PURE__ */ new Map(), generation: -1 } : null, h = new Map(u);
  m && n.root && (an = { from: m.built, generation: m.generation, clean: /* @__PURE__ */ new Set(), next: /* @__PURE__ */ new Map() }, eh(n.root, u, m.overrides, an.clean));
  let v;
  try {
    v = a.div().relative().size_full().child(sc(n.root, a, r, i, !1, !1, null, {}, !1, u)), m && Object.assign(m, { built: an?.next ?? /* @__PURE__ */ new Map(), overrides: h, generation: a.renderGeneration() ?? -1 });
  } finally {
    an = null;
  }
  let y = c && n.overlays.length ? a.div().relative().size_full().window_layer() : v;
  for (const b of n.overlays) y = y.child(sc(b, a, r, i, !0, !1, null, {}, !1, u));
  return y === v ? v : v.child(y);
}
function m4(n, a, r, i) {
  (ui.scale !== a || ui.measure !== r) && (ui = { scale: a, measure: r, widths: /* @__PURE__ */ new WeakMap(), fonts: /* @__PURE__ */ new WeakMap(), keys: /* @__PURE__ */ new WeakMap(), visits: /* @__PURE__ */ new WeakMap() });
  const { widths: s, fonts: c, keys: f, visits: u } = ui, m = [], h = (O, H) => i.set(O, { ...i.get(O), ...H }), v = (O, H) => {
    m.push(O, H), h(O, H);
  }, y = ["text_size", "font_weight", "font_family", "italic", "whitespace", "text_ellipsis"];
  function b(O, H, X) {
    if (O.kind === "text") {
      if (!(H.whitespace === "nowrap" || th.test(O.text)) || H.text_ellipsis || X || typeof H.text_size != "number") return NaN;
      const z = r(O.text, { size: H.text_size, weight: H.font_weight ?? 400, family: H.font_family ?? ".SystemUIFont", italic: !!H.italic });
      return Number.isFinite(z) ? z : NaN;
    }
    if (!Mt(O) || O.kind === "input" || O.kind === "engine" || O.markup) return S(O);
    const W = `${H.text_size}|${H.font_weight}|${H.font_family}|${H.italic}|${H.whitespace}|${H.text_ellipsis}|${+X}`;
    if (f.get(O) === W && s.has(O)) return s.get(O);
    f.set(O, W);
    const D = { ...H };
    for (const T of y) O.style[T] !== void 0 && (D[T] = O.style[T]);
    D.text_ellipsis = !!O.style.text_ellipsis, c.set(O, D);
    const g = O.style, w = (O.children ?? []).filter(Jt), x = w.map((T) => b(T, D, X || !!O.tabular));
    let _ = S(O);
    if (!Number.isFinite(_) && g.w === void 0) {
      const T = w.map((j, V) => x[V] + (j.kind === "text" ? 0 : se(j.style.ml) + se(j.style.mr)));
      let z;
      w.length ? Ut(O) ? z = w.some((j) => j.kind !== "text" && j.style.flex_grow > 0) || g.flex_wrap === "wrap" ? NaN : T.reduce((j, V) => j + V, 0) + se(g.gap_x) * (w.length - 1) : z = Math.max(...T) : z = 0, _ = z + se(g.pl) + se(g.pr) + se(g.border_l) + se(g.border_r), typeof g.min_w == "number" && (_ = Math.max(_, g.min_w)), typeof g.max_w == "number" && (_ = Math.min(_, g.max_w));
    }
    return s.set(O, _), _;
  }
  const S = (O) => typeof O.style?.w == "number" ? O.style.w : NaN, E = () => ({ exact: 0, laid: 0 }), R = (O, H) => {
    if (!Number.isFinite(H))
      return Object.assign(O, E()), NaN;
    O.exact += H;
    const X = Math.round(O.exact * a + 1e-9) / a, W = X - O.laid;
    return O.laid = X, W;
  }, N = (O) => Ut(O) && O.style.flex_wrap !== "wrap" && (O.style.justify ?? "start") === "start";
  function M(O) {
    if (!O || O.kind === "text" || !Mt(O)) return;
    const H = f.get(O), X = u.get(O);
    if (X && H !== void 0 && X.key === H) {
      for (let g = 0; g < X.log.length; g += 2)
        m.push(X.log[g], X.log[g + 1]), h(X.log[g], X.log[g + 1]);
      return;
    }
    const W = m.length, D = (O.children ?? []).filter(Jt);
    if (N(O) && D.length > 1) {
      const g = se(O.style.gap_x), w = E(), x = !(g && D.some((_) => _.kind === "text" || !Number.isFinite(se(_.style.ml))));
      v(O, { border_l: R(w, se(O.style.border_l)), pl: R(w, se(O.style.pl)) }), x && g && v(O, { gap_x: 0 }), D.forEach((_, T) => {
        const z = (T && x ? g : 0) + (_.kind === "text" ? 0 : se(_.style.ml));
        if (_.kind === "text")
          z && Object.assign(w, E());
        else {
          const U = R(w, z);
          Number.isFinite(U) && v(_, { ml: U });
        }
        const j = _.kind === "text" ? c.get(O) ?? {} : null, V = _.kind === "text" ? b(_, j, !!O.tabular) : s.get(_);
        if ((_.kind === "text" || !(_.style.flex_grow > 0)) && Number.isFinite(V)) {
          const U = { w: R(w, V) };
          _.kind !== "text" && typeof _.style.w != "number" && _.style.min_w === void 0 && (U.whitespace = "nowrap", U.flex_shrink = 0), v(_, U);
        } else Object.assign(w, E());
        if (_.kind !== "text") {
          const U = R(w, se(_.style.mr));
          Number.isFinite(U) && v(_, { mr: U });
        }
      });
    }
    for (const g of O.children ?? []) g.kind !== "text" && M(g);
    H !== void 0 && u.set(O, { key: H, log: m.slice(W) });
  }
  for (const O of n)
    O && (b(O, {}, !1), M(O));
}
let ui = { scale: 0, measure: null };
const h4 = /(?<= +)(?=[^ ])|(?<=[\p{L}\p{N}]-)(?=[\p{L}\p{N}])/u;
function g4(n, a, r) {
  const i = ["text_size", "font_weight", "font_family", "italic", "line_height"], s = (v) => typeof v == "number" ? v : 0, c = (v, y) => y && Ri(y) && !Ut(y) && v.style.position !== "absolute" && !["start", "center", "end"].includes(v.style.self) && !["start", "center", "end"].includes(y.style.items);
  di.measure !== a && (di = { measure: a, walks: /* @__PURE__ */ new WeakMap() });
  const f = [], u = (v, y) => {
    f.push(v, y), r.set(v, { ...r.get(v), ...y });
  }, m = (v, y, b, S) => {
    if (!v || v.kind === "text" || !Mt(v)) return;
    const E = `${b}|${+c(v, y)}|${S.text_size}|${S.font_weight}|${S.font_family}|${S.italic}|${S.line_height}`, R = di.walks.get(v);
    if (R?.key === E) {
      for (let M = 0; M < R.log.length; M += 2) u(R.log[M], R.log[M + 1]);
      return;
    }
    const N = f.length;
    h(v, y, b, S), di.walks.set(v, { key: E, log: f.slice(N) });
  }, h = (v, y, b, S) => {
    const E = v.style;
    let R = typeof E.w == "number" ? E.w : E.w === "100%" ? b : c(v, y) ? b - s(E.ml) - s(E.mr) : NaN;
    typeof E.max_w == "number" && (R = Math.min(R, E.max_w));
    const N = R - s(E.pl) - s(E.pr) - s(E.border_l) - s(E.border_r), M = { ...S };
    for (const H of i) E[H] !== void 0 && (M[H] = E[H]);
    const O = v.children ?? [];
    if (v.break_anywhere && Number.isFinite(N) && N > 0 && typeof M.text_size == "number" && O.length && O.every((H) => H.kind === "text")) {
      const H = { size: M.text_size, weight: M.font_weight ?? 400, family: M.font_family ?? ".SystemUIFont", italic: !!M.italic }, X = (g) => a(g.trimEnd(), H) <= N + 0.01;
      let W = 0;
      for (const g of O) {
        const w = [];
        for (const _ of g.text.split(`
`)) {
          let T = "";
          for (const z of _.split(h4)) {
            if (X(T + z)) {
              T += z;
              continue;
            }
            T && w.push(T.trimEnd()), T = "";
            for (const j of z)
              T && !X(T + j) && (w.push(T), T = ""), T += j;
          }
          w.push(T.trimEnd());
        }
        const x = w.join(`
`);
        w.every((_) => !_ || X(_)) ? x !== g.text && u(g, { text: x }) : W = NaN, W += w.length;
      }
      const D = wa(M);
      Number.isFinite(W) && D && E.h === void 0 && O.length === 1 && u(v, { h: W * D + s(E.pt) + s(E.pb) + s(E.border_t) + s(E.border_b) });
    }
    for (const H of O) m(H, v, Ut(v) ? NaN : N, M);
  };
  for (const v of n) m(v, null, NaN, {});
}
let di = { measure: null };
function b4(n, a) {
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
function v4(n, a) {
  const r = a.heights ?? /* @__PURE__ */ new Map(), i = (m) => r.get(m), s = (m) => {
    const h = i(m);
    if (Number.isFinite(h)) return h;
    if (m.kind === "text" || !Mt(m)) return 0;
    const v = m.style, y = typeof v.min_h == "number" ? v.min_h : 0, b = (m.children ?? []).filter(Jt), S = b.map((N) => s(N) + (N.kind === "text" ? 0 : Math.max(0, se(N.style.mt) || 0) + Math.max(0, se(N.style.mb) || 0))), E = b.length ? Ut(m) ? Math.max(...S) : S.reduce((N, M) => N + M, 0) + (v.display === "flex" ? (se(v.gap_y) || 0) * (b.length - 1) : 0) : 0, R = [v.pt, v.pb, v.border_t, v.border_b].reduce((N, M) => N + (se(M) || 0), 0);
    return Math.max(y, E + R);
  }, c = (m) => !(m.children ?? []).filter(Jt).length || Ut(m) ? NaN : s({ ...m, style: { ...m.style, h: void 0, max_h: void 0, min_h: void 0 } }), f = (m, h) => {
    const v = m.style;
    if (typeof v.h == "number") return v.h;
    if (typeof v.max_h == "number") return v.max_h;
    if (!h || !Ri(h) || Ut(h)) return NaN;
    const y = h.style, b = typeof y.h == "number" ? y.h : typeof y.max_h == "number" ? y.max_h : NaN, S = (h.children ?? []).filter(Jt);
    let E = 0;
    for (const N of S) {
      if (N === m) continue;
      const M = i(N);
      if (!Number.isFinite(M)) return NaN;
      E += M + (N.kind === "text" ? 0 : se(N.style.mt) + se(N.style.mb));
    }
    const R = y.display === "flex" ? se(y.gap_y) * Math.max(0, S.length - 1) : 0;
    return b - se(y.pt) - se(y.pb) - se(y.border_t) - se(y.border_b) - E - R - se(v.mt) - se(v.mb);
  }, u = (m, h) => {
    if (!(!m || m.kind === "text" || !Mt(m))) {
      if (m.scrollbar > 0 && m.style.overflow_y === "scroll") {
        const v = c(m), y = f(m, h);
        Number.isFinite(v) && Number.isFinite(y) && v > y + 0.01 && a.set(m, { ...a.get(m), pr: se(m.style.pr) + m.scrollbar });
      }
      for (const v of m.children ?? []) u(v, m);
    }
  };
  for (const m of n) u(m, null);
}
const y4 = ["text_size", "line_height", "whitespace", "text_ellipsis"], se = (n) => n == null ? 0 : typeof n == "number" ? n : NaN, Ri = (n) => n.style.display === "flex" ? n.style.flex_direction === "col" : !0, Ut = (n) => n.style.display === "flex" && (n.style.flex_direction ?? "row") === "row", Jt = (n) => n.kind === "text" || Mt(n) && n.style.position !== "absolute";
function x4(n, a) {
  Bo.scale !== a && (Bo = rh(a));
  const { heights: r, texts: i, textKeys: s, visits: c, places: f } = Bo, u = /* @__PURE__ */ new Map(), m = [], h = (D, g) => {
    const w = u.get(D);
    u.set(D, w ? { ...w, ...g } : g);
  }, v = (D, g) => {
    let w = null;
    for (const x in g)
      Number.isFinite(g[x]) && ((w ??= {})[x] = g[x]);
    w && (m.push(D, w), h(D, w));
  }, y = (D) => {
    for (let g = 0; g < D.length; g += 2)
      m.push(D[g], D[g + 1]), h(D[g], D[g + 1]);
  };
  function b(D, g) {
    if (D.kind === "text") return g.whitespace === "nowrap" || th.test(D.text) ? wa(g) ?? NaN : NaN;
    const w = `${g.text_size}|${g.line_height}|${g.whitespace}|${g.text_ellipsis}`;
    if (s.get(D) === w && r.has(D)) return r.get(D);
    let x = g;
    for (const V of y4) D.style[V] !== void 0 && D.style[V] !== x[V] && (x === g && (x = { ...g }), x[V] = D.style[V]);
    s.set(D, w), i.set(D, x);
    const _ = D.style, T = (D.children ?? []).filter(Jt), z = T.map((V) => b(V, x));
    let j;
    if (_.h !== void 0 && _.h !== "auto") j = se(_.h);
    else if (D.kind === "engine") j = NaN;
    else if (D.kind === "input")
      j = (D.input_type === "textarea" || D.input_type === "select" ? NaN : wa(x) ?? NaN) + se(_.pt) + se(_.pb) + se(_.border_t) + se(_.border_b), _.min_h !== void 0 && (j = Math.max(j, se(_.min_h)));
    else {
      const V = T.map((U, K) => (U.kind === "text" ? 0 : se(U.style.mt) + se(U.style.mb)) + z[K]);
      let $;
      if (Ut(D)) $ = _.flex_wrap === "wrap" ? NaN : _.items === "baseline" ? E(T, z, x) : Math.max(0, ...V);
      else if (Ri(D)) {
        const U = T.some((I) => I.kind !== "text" && (I.style.flex_grow > 0 || I.style.flex_basis !== void 0)), K = _.display !== "flex" && T.some((I) => I.kind !== "text" && (se(I.style.mt) || se(I.style.mb)));
        $ = U || K ? NaN : V.reduce((I, Q) => I + Q, 0) + (_.display === "flex" ? se(_.gap_y) * Math.max(0, T.length - 1) : 0);
      } else $ = NaN;
      j = $ + se(_.pt) + se(_.pb) + se(_.border_t) + se(_.border_b), _.min_h !== void 0 && (j = Math.max(j, se(_.min_h))), _.max_h !== void 0 && (j = Math.min(j, se(_.max_h)));
    }
    return r.set(D, j), j;
  }
  const S = (D) => (wa(D) - (Ei + nm) * D.text_size) / 2 + Ei * D.text_size;
  function E(D, g, w) {
    let x = 0, _ = 0;
    for (const [T, z] of D.entries()) {
      const j = z.kind === "text" ? w : i.get(z);
      if (!(z.kind === "text" || (z.children ?? []).filter(Jt).every((K) => K.kind === "text")) || !Number.isFinite(g[T]) || typeof j.text_size != "number") return NaN;
      const $ = z.kind === "text" ? {} : z.style, U = se($.mt) + se($.border_t) + se($.pt) + S(j);
      x = Math.max(x, U), _ = Math.max(_, se($.mt) + g[T] + se($.mb) - U);
    }
    return x + _;
  }
  const R = () => ({ exact: 0, laid: 0 }), N = (D, g) => {
    if (!Number.isFinite(g))
      return Object.assign(D, R()), NaN;
    D.exact += g;
    const w = Math.round(D.exact * a + 1e-9) / a, x = w - D.laid;
    return D.laid = w, x;
  };
  function M(D) {
    if (D.kind === "text" || !Mt(D)) return;
    const g = s.get(D), w = c.get(D);
    if (w && g !== void 0 && w.key === g) return y(w.log);
    const x = m.length;
    for (const _ of (D.children ?? []).filter((T) => T.kind !== "text" && Mt(T) && T.style.position === "absolute")) M(_);
    if (Ri(D) && !Ut(D)) {
      const _ = R();
      v(D, { border_t: N(_, se(D.style.border_t)), pt: N(_, se(D.style.pt)) }), O(D, _);
    } else for (const _ of (D.children ?? []).filter(Jt)) _.kind !== "text" && M(_);
    g !== void 0 && c.set(D, { key: g, log: m.slice(x) });
  }
  function O(D, g) {
    const w = (D.children ?? []).filter(Jt), x = D.style.display === "flex" ? se(D.style.gap_y) : 0;
    if (x && w.some((_) => _.kind === "text")) {
      for (const _ of w) _.kind !== "text" && M(_);
      return !1;
    }
    return x && v(D, { gap_y: 0 }), w.forEach((_, T) => {
      if (_.kind === "text") {
        const z = b(_, i.get(D) ?? {});
        Number.isFinite(z) ? v(_, { h: N(g, z) }) : Object.assign(g, R());
        return;
      }
      if (v(_, { mt: N(g, (T ? x : 0) + se(_.style.mt)) }), Number.isFinite(r.get(_))) X(_, g);
      else if (H(_)) {
        const z = _.style;
        v(_, { border_t: N(g, se(z.border_t)), pt: N(g, se(z.pt)) }), v(_, { pb: N(g, se(z.pb)), border_b: N(g, se(z.border_b)) });
      } else
        M(_), Object.assign(g, R());
      v(_, { mb: N(g, se(_.style.mb)) });
    }), !0;
  }
  function H(D) {
    const g = D.style, w = (D.children ?? []).filter(Jt), x = wa(i.get(D) ?? {});
    return D.kind === "div" && !Ut(D) && w.length > 0 && w.every((_) => _.kind === "text") && Number.isInteger(x) && [g.h, g.min_h, g.max_h].every((_) => _ === void 0 || _ === "auto");
  }
  function X(D, g) {
    const w = `${s.get(D)}|${Math.round((g.exact - g.laid) * 1e6)}`, x = f.get(D);
    if (x && x.key === w) {
      y(x.log), g.exact += x.exact, g.laid += x.laid;
      return;
    }
    const _ = m.length, [T, z] = [g.exact, g.laid];
    W(D, g), f.set(D, { key: w, log: m.slice(_), exact: g.exact - T, laid: g.laid - z });
  }
  function W(D, g) {
    const w = D.style;
    for (const j of (D.children ?? []).filter((V) => V.kind !== "text" && Mt(V) && V.style.position === "absolute")) M(j);
    const x = g.laid, _ = g.exact;
    v(D, { border_t: N(g, se(w.border_t)), pt: N(g, se(w.pt)) });
    const T = w.h !== void 0 && w.h !== "auto", z = r.get(D) - se(w.pt) - se(w.pb) - se(w.border_t) - se(w.border_b);
    if (D.kind === "input")
      T || N(g, z);
    else if (Ut(D) || T && (w.justify ?? "start") !== "start") {
      for (const j of (D.children ?? []).filter(Jt)) j.kind !== "text" && M(j);
      T || N(g, z);
    } else !O(D, g) && !T && N(g, z);
    if (T) {
      g.exact = _ + r.get(D), g.laid = Math.round(g.exact * a + 1e-9) / a, v(D, { h: g.laid - x });
      return;
    }
    v(D, { pb: N(g, se(w.pb)), border_b: N(g, se(w.border_b)) }), v(D, { h: g.laid - x });
  }
  for (const D of n)
    b(D, {}), M(D);
  return Object.defineProperty(u, "heights", { value: r }), u;
}
const rh = (n) => ({ scale: n, heights: /* @__PURE__ */ new WeakMap(), texts: /* @__PURE__ */ new WeakMap(), textKeys: /* @__PURE__ */ new WeakMap(), visits: /* @__PURE__ */ new WeakMap(), places: /* @__PURE__ */ new WeakMap() });
let Bo = rh(0);
const N4 = { sidebar: [{ name: "sidebar-root", selector: "aside.sidebar" }, { name: "sidebar-content", selector: "aside.sidebar > div:first-child" }, { name: "host-switcher", selector: '[data-testid="host-switcher"]' }, { name: "host-chip", selector: '[data-testid="host-switcher"] > div' }, { name: "host-badge", selector: ".sidebar__env-badge" }, { name: "host-name", selector: ".sidebar__env-host" }, { name: "host-meta", selector: '[data-testid="host-switcher"] > div > div:first-child > span:nth-child(3)' }, { name: "host-line", selector: ".sidebar__env-cwd" }, { name: "host-caret", selector: '[data-testid="host-switcher"] > span[aria-hidden="true"]' }, { name: "new-session-button", selector: 'button[data-testid^="new-session-"]', key: { self: !0, attr: "data-testid", strip: "new-session-" } }, { name: "new-session-icon", selector: 'button[data-testid^="new-session-"] > svg' }, { name: "new-session-label", selector: 'button[data-testid^="new-session-"]', textRange: !0 }, { name: "new-session-shortcut", selector: 'button[data-testid^="new-session-"] > span' }, { name: "overview", selector: '[data-testid="workspace-overview"]' }, { name: "overview-header", selector: '[data-testid="workspace-overview"] > div:first-child' }, { name: "overview-title", selector: '[data-testid="workspace-overview"] > div:first-child > div:first-child > span:first-child' }, { name: "needs-you-button", selector: '[data-testid="workspace-needs-you"]' }, { name: "organize-button", selector: '[data-testid="workspace-organize"]' }, { name: "organize-icon", selector: '[data-testid="workspace-organize"] > svg' }, { name: "add-project-button", selector: '[data-testid="workspace-add-project"]' }, { name: "add-project-icon", selector: '[data-testid="workspace-add-project"] > svg' }, { name: "add-project-label", selector: '[data-testid="workspace-add-project"]', textRange: !0 }, { name: "project-list", selector: '[data-testid="project-list"]' }, { name: "project", selector: ".workspace-project", key: { self: !0, attr: "data-testid", strip: "workspace-project-" } }, { name: "project-header", selector: ".workspace-project > div:first-child", key: { closest: ".workspace-project", attr: "data-testid", strip: "workspace-project-" } }, { name: "project-toggle", selector: '[data-testid^="project-toggle-"]', key: { self: !0, attr: "data-testid", strip: "project-toggle-" } }, { name: "project-chevron", selector: '[data-testid^="project-toggle-"] > svg:not([data-testid])', key: { closest: '[data-testid^="project-toggle-"]', attr: "data-testid", strip: "project-toggle-" } }, { name: "project-folder-icon", selector: '[data-testid="project-folder-icon"]', key: { closest: '[data-testid^="project-toggle-"]', attr: "data-testid", strip: "project-toggle-" } }, { name: "project-name", selector: '[data-testid^="project-toggle-"] strong', key: { closest: '[data-testid^="project-toggle-"]', attr: "data-testid", strip: "project-toggle-" } }, { name: "project-branch", selector: '[data-testid^="project-toggle-"] > span.whitespace-nowrap', key: { closest: '[data-testid^="project-toggle-"]', attr: "data-testid", strip: "project-toggle-" } }, { name: "project-dirty-mark", selector: '[data-testid^="project-toggle-"] > span[title="Uncommitted changes"]', key: { closest: '[data-testid^="project-toggle-"]', attr: "data-testid", strip: "project-toggle-" } }, { name: "project-rollup", selector: '[data-testid^="project-rollup-"]', key: { self: !0, attr: "data-testid", strip: "project-rollup-" } }, { name: "project-rollup-badge", selector: '[data-testid^="project-rollup-"] > span', key: { closest: '[data-testid^="project-rollup-"]', attr: "data-testid", strip: "project-rollup-" } }, { name: "project-menu-button", selector: '[data-testid^="workspace-project-menu-"]', key: { self: !0, attr: "data-testid", strip: "workspace-project-menu-" } }, { name: "project-add-button", selector: ".workspace-project > div:first-child .worktree-menu__btn", key: { closest: ".workspace-project", attr: "data-testid", strip: "workspace-project-" } }, { name: "project-workspaces", selector: ".workspace-project__workspaces", key: { closest: ".workspace-project", attr: "data-testid", strip: "workspace-project-" } }, { name: "workspace", selector: '[data-testid="workspace-tree-root"] [data-testid^="workspace-entry-"]', key: { self: !0, attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-button", selector: '[data-testid="workspace-tree-root"] button.workspace-entry__button', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-icon", selector: '[data-testid="workspace-tree-root"] [data-testid="workspace-checkout-icon"]', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-name", selector: '[data-testid="workspace-tree-root"] strong[title="Double-click to rename"]', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-branch", selector: '[data-testid="workspace-tree-root"] button.workspace-entry__button > span.items-baseline > span', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-dirty-mark", selector: '[data-testid="workspace-tree-root"] button.workspace-entry__button > span[title="Uncommitted changes"]', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-pinned-label", selector: '[data-testid="workspace-tree-root"] button.workspace-entry__button > span.shrink-0:not([title])', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "hidden-worktrees-button", selector: '[data-testid^="workspace-hidden-"]', key: { self: !0, attr: "data-testid", strip: "workspace-hidden-" } }, { name: "session-row", selector: 'div[class~="group/row"]', key: { find: 'button[data-testid^="workspace-session-"]:not([data-testid^="workspace-session-close-"])', attr: "data-testid", strip: "workspace-session-" } }, { name: "session-button", selector: 'button[data-testid^="workspace-session-"]:not([data-testid^="workspace-session-close-"])', key: { self: !0, attr: "data-testid", strip: "workspace-session-" } }, { name: "session-mark", selector: ".agent-mark", key: { closest: 'button[data-testid^="workspace-session-"]', attr: "data-testid", strip: "workspace-session-" } }, { name: "session-mark-icon", selector: ".agent-mark > span > *", key: { closest: 'button[data-testid^="workspace-session-"]', attr: "data-testid", strip: "workspace-session-" } }, { name: "session-title", selector: 'button[data-testid^="workspace-session-"] > span.whitespace-nowrap', key: { closest: 'button[data-testid^="workspace-session-"]', attr: "data-testid", strip: "workspace-session-" } }, { name: "status-row-title", selector: "button[data-session] span.truncate:not([data-testid])", key: { closest: 'button[data-testid^="workspace-session-"]', attr: "data-testid", strip: "workspace-session-" } }, { name: "status-row-detail", selector: '[data-testid="status-row-detail"]', key: { closest: 'button[data-testid^="workspace-session-"]', attr: "data-testid", strip: "workspace-session-" } }, { name: "session-state-badge", selector: '[data-testid^="session-state-"]', key: { self: !0, attr: "data-testid", strip: "session-state-" } }, { name: "session-menu-button", selector: '[data-testid^="session-menu-button-"]', key: { self: !0, attr: "data-testid", strip: "session-menu-button-" } }, { name: "session-fold-button", selector: '[data-testid^="session-fold-"]', key: { self: !0, attr: "data-testid", strip: "session-fold-" } }, { name: "session-elbow", selector: '[data-testid^="session-elbow-"]', key: { self: !0, attr: "data-testid", strip: "session-elbow-" } }, { name: "session-rollup", selector: '[data-testid^="session-rollup-"]', key: { self: !0, attr: "data-testid", strip: "session-rollup-" } }, { name: "chats", selector: '[data-testid="workspace-chats"]' }, { name: "chats-header", selector: '[data-testid="workspace-chats"] > div:first-child' }, { name: "chats-toggle", selector: '[data-testid="workspace-chats-collapse"]' }, { name: "chats-label", selector: '[data-testid="workspace-chats-collapse"]', textRange: !0 }, { name: "chats-chevron", selector: '[data-testid="workspace-chats-collapse"] > svg' }, { name: "chats-menu-button", selector: '[data-testid="workspace-chats-menu"]' }, { name: "chats-new-button", selector: '[data-testid="workspace-chats-new"]' }, { name: "chats-new-icon", selector: '[data-testid="workspace-chats-new"] > svg' }, { name: "status-view", selector: '[data-testid="workspace-status-view"]' }, { name: "status-section", selector: '[data-testid^="status-section-"]:not([data-testid^="status-section-title-"])', key: { self: !0, attr: "data-testid", strip: "status-section-" } }, { name: "status-heading", selector: '[data-testid^="status-section-title-"], [data-testid="status-no-sessions-title"]', key: { self: !0, attr: "data-testid" } }, { name: "status-heading-dot", selector: '[data-testid^="status-section-title-"] > span:first-child, [data-testid="status-no-sessions-title"] > span:first-child', key: { closest: '[data-testid^="status-section-title-"], [data-testid="status-no-sessions-title"]', attr: "data-testid" } }, { name: "status-heading-label", selector: '[data-testid^="status-section-title-"] > span:nth-child(2), [data-testid="status-no-sessions-title"] > span:nth-child(2)', key: { closest: '[data-testid^="status-section-title-"], [data-testid="status-no-sessions-title"]', attr: "data-testid" } }, { name: "status-heading-count", selector: '[data-testid^="status-section-title-"] > span[aria-label], [data-testid="status-no-sessions-title"] > span[aria-label]', key: { closest: '[data-testid^="status-section-title-"], [data-testid="status-no-sessions-title"]', attr: "data-testid" } }, { name: "status-heading-note", selector: '[data-testid^="status-section-title-"] > span.truncate, [data-testid="status-no-sessions-title"] > span.truncate', key: { closest: '[data-testid^="status-section-title-"], [data-testid="status-no-sessions-title"]', attr: "data-testid" } }, { name: "status-project", selector: 'div[data-testid^="status-project-"]', key: { self: !0, attr: "data-testid", strip: "status-project-" } }, { name: "status-project-header", selector: 'div[data-testid^="status-project-"] > div:first-child', key: { closest: 'div[data-testid^="status-project-"]', attr: "data-testid", strip: "status-project-" } }, { name: "status-project-icon", selector: 'div[data-testid^="status-project-"] > div:first-child > svg', key: { closest: 'div[data-testid^="status-project-"]', attr: "data-testid", strip: "status-project-" } }, { name: "status-project-title", selector: '[data-testid="status-project-title"]', key: { closest: 'div[data-testid^="status-project-"]', attr: "data-testid", strip: "status-project-" } }, { name: "status-empty-project", selector: '[data-testid^="status-empty-project-"]', key: { self: !0, attr: "data-testid", strip: "status-empty-project-" } }, { name: "status-empty-project-icon", selector: '[data-testid^="status-empty-project-"] > button:first-child > svg', key: { closest: '[data-testid^="status-empty-project-"]', attr: "data-testid", strip: "status-empty-project-" } }, { name: "status-empty-project-title", selector: '[data-testid^="status-empty-project-"] > button > span.whitespace-nowrap', key: { closest: '[data-testid^="status-empty-project-"]', attr: "data-testid", strip: "status-empty-project-" } }, { name: "settings-bar", selector: "aside.sidebar > div:last-child" }, { name: "settings-gear", selector: '[data-testid="settings-gear"]' }, { name: "settings-gear-icon", selector: '[data-testid="settings-gear"] > svg' }], tabs: [{ name: "tab-strip", selector: '[data-testid="tab-bar"]' }, { name: "tab-slot", selector: "[data-tab-entry]", key: { self: !0, attr: "data-tab-entry" } }, { name: "tab-separator", selector: '[data-testid="tab-separator"]', key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab", selector: "button.tab-bar__tab", key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-icon", selector: 'button.tab-bar__tab > span[aria-hidden="true"]', key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-icon-glyph", selector: 'button.tab-bar__tab > span[aria-hidden="true"] > *', key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-label", selector: "button.tab-bar__tab > span.truncate", key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-dirty", selector: 'button.tab-bar__tab > span[aria-label="unsaved changes"]', key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-close", selector: '[data-tab-entry] > button[aria-label^="Close"]', key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-close-glyph", selector: '[data-tab-entry] > button[aria-label^="Close"] > svg', key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-new", selector: '[data-testid="tab-new"]' }, { name: "tab-new-glyph", selector: '[data-testid="tab-new"] > svg' }], status: [{ name: "status-bar", selector: "footer.status-bar" }, { name: "status-location", selector: ".status-bar__location" }, { name: "status-dot", selector: ".status-bar__location > span:first-child" }, { name: "status-host", selector: '[data-testid="status-host"]' }, { name: "status-cwd", selector: ".status-item--cwd" }, { name: "status-branch", selector: ".status-bar__branch" }, { name: "status-branch-icon", selector: ".status-bar__branch > svg" }, { name: "status-branch-name", selector: ".status-bar__branch > span" }, { name: "status-details", selector: ".status-bar__details" }, { name: "zoom-indicator", selector: '[data-testid="zoom-indicator"]' }, { name: "status-detail", selector: ".status-bar__details > span" }, { name: "status-usage", selector: ".status-bar__usage" }, { name: "usage-summary", selector: '[data-testid="usage-summary"]' }, { name: "usage-unavailable", selector: '[data-testid="usage-summary"] > span:only-child' }, { name: "usage-account", selector: '[data-testid="usage-summary"] > span.flex' }, { name: "usage-account-name", selector: '[data-testid="usage-summary"] > span.flex > span:first-child' }, { name: "usage-window", selector: '[data-testid="usage-summary"] > span.flex > span:not(:first-child)' }, { name: "status-connection", selector: '[data-testid="status-connection"]' }, { name: "status-connection-glyph", selector: '[data-testid="status-connection"] > svg' }], navigator: [{ name: "navigator-scrim", selector: "body > div.fixed.inset-0" }, { name: "navigator-panel", selector: '[data-testid="navigator"]' }, { name: "navigator-input", selector: '[data-testid="navigator-input"]' }, { name: "navigator-chips", selector: '[data-testid="navigator"] > div:nth-child(2)' }, { name: "navigator-chip", selector: '[data-testid^="navigator-filter-"]', key: { self: !0, attr: "data-testid", strip: "navigator-filter-" } }, { name: "navigator-list", selector: '[data-testid="navigator"] > div:nth-child(3)' }, { name: "navigator-notice", selector: '[data-testid="navigator"] > div:nth-child(3) > p[role]' }, { name: "navigator-empty", selector: '[data-testid="navigator"] div.text-center' }, { name: "navigator-command", selector: '[data-testid^="navigator-command-"]', key: { self: !0, attr: "data-testid", strip: "navigator-command-" } }, { name: "navigator-command-title", selector: '[data-testid^="navigator-command-"] > span:first-child', key: { closest: '[data-testid^="navigator-command-"]', attr: "data-testid", strip: "navigator-command-" } }, { name: "navigator-command-detail", selector: '[data-testid^="navigator-command-"] > span:last-child', key: { closest: '[data-testid^="navigator-command-"]', attr: "data-testid", strip: "navigator-command-" } }, { name: "navigator-row", selector: '[data-testid^="navigator-row-"]', key: { self: !0, attr: "data-testid", strip: "navigator-row-" } }, { name: "navigator-row-dot", selector: '[data-testid^="navigator-row-"] > :first-child', key: { closest: '[data-testid^="navigator-row-"]', attr: "data-testid", strip: "navigator-row-" } }, { name: "navigator-row-title", selector: '[data-testid^="navigator-row-"] > span:nth-child(2)', key: { closest: '[data-testid^="navigator-row-"]', attr: "data-testid", strip: "navigator-row-" } }, { name: "navigator-row-detail", selector: '[data-testid^="navigator-row-"] > span:last-child', key: { closest: '[data-testid^="navigator-row-"]', attr: "data-testid", strip: "navigator-row-" } }, { name: "navigator-note", selector: '[data-testid="navigator"] > p:last-child' }], "pane-menu": [{ name: "pane-menu", selector: '[data-testid="pane-context-menu"]' }, { name: "pane-menu-item", selector: '[data-testid="pane-context-menu"] > button', key: { self: !0, attr: "data-testid", strip: "pane-menu-" } }, { name: "pane-menu-divider", selector: '[data-testid="pane-context-menu"] > div.h-px' }, { name: "pane-menu-rename-row", selector: '[data-testid="pane-context-menu"] > div.flex' }, { name: "pane-menu-rename-input", selector: '[data-testid="pane-menu-rename-input"]' }, { name: "pane-menu-rename-confirm", selector: '[data-testid="pane-menu-rename-confirm"]' }], confirm: [{ name: "confirm-scrim", selector: "body > div.fixed.inset-0" }, { name: "confirm-panel", selector: '[data-testid="confirm-dialog"]' }, { name: "confirm-message", selector: ".confirm-dialog__message" }, { name: "confirm-extra", selector: '[data-testid="confirm-dialog"] > :not(.confirm-dialog__message):not(div.flex)' }, { name: "confirm-buttons", selector: '[data-testid="confirm-dialog"] > div.flex' }, { name: "confirm-cancel", selector: '[data-testid="confirm-cancel"]' }, { name: "confirm-accept", selector: '[data-testid="confirm-accept"]' }], dialog: [{ name: "dialog-scrim", selector: "body > div.fixed.inset-0" }, { name: "dialog-panel", selector: '[data-testid="file-name-dialog"]' }, { name: "dialog-title", selector: '[data-testid="file-name-dialog"] > h2' }, { name: "dialog-input", selector: '[data-testid="file-name-input"]' }, { name: "dialog-hint", selector: '[data-testid="file-name-dialog"] > p:not([role])' }, { name: "dialog-error", selector: '[data-testid="file-name-dialog"] > p[role="alert"]' }, { name: "dialog-buttons", selector: '[data-testid="file-name-dialog"] > div.flex' }, { name: "dialog-cancel", selector: '[data-testid="file-name-dialog"] > div.flex > button:first-child' }, { name: "dialog-confirm", selector: '[data-testid="file-name-confirm"]' }], toast: [{ name: "toast-stack", selector: '[data-testid="toast"]' }, { name: "toast-card", selector: '[data-testid="toast"] .animate-toast-in' }, { name: "toast-open", selector: '[data-testid^="toast-"]:not([data-testid^="toast-dismiss-"])' }, { name: "toast-mark", selector: '[data-testid^="toast-"]:not([data-testid^="toast-dismiss-"]) > :first-child' }, { name: "toast-heading", selector: '[data-testid^="toast-"]:not([data-testid^="toast-dismiss-"]) > span.min-w-0 > span:first-child' }, { name: "toast-detail", selector: '[data-testid^="toast-"]:not([data-testid^="toast-dismiss-"]) > span.min-w-0 > span:nth-child(2)' }, { name: "toast-dismiss", selector: '[data-testid^="toast-dismiss-"]' }, { name: "toast-dismiss-glyph", selector: '[data-testid^="toast-dismiss-"] > svg' }], "pane-header": [{ name: "pane-header", selector: '[data-testid^="pane-header-"]', key: { self: !0, attr: "data-testid", strip: "pane-header-" } }, { name: "pane-header-icon", selector: '[data-testid^="pane-header-"] > span.shrink-0:not([data-testid])', key: { closest: '[data-testid^="pane-header-"]', attr: "data-testid", strip: "pane-header-" } }, { name: "pane-header-icon-glyph", selector: '[data-testid^="pane-header-"] > span.shrink-0:not([data-testid]) > *', key: { closest: '[data-testid^="pane-header-"]', attr: "data-testid", strip: "pane-header-" } }, { name: "pane-header-name", selector: '[data-testid^="pane-header-"] > span.truncate', key: { closest: '[data-testid^="pane-header-"]', attr: "data-testid", strip: "pane-header-" } }, { name: "pane-header-state", selector: '[data-testid^="pane-header-"] > span.flex[title]', key: { closest: '[data-testid^="pane-header-"]', attr: "data-testid", strip: "pane-header-" } }, { name: "pane-header-state-dot", selector: '[data-testid^="pane-header-"] > span.flex[title] > span.rounded-full', key: { closest: '[data-testid^="pane-header-"]', attr: "data-testid", strip: "pane-header-" } }, { name: "pane-header-state-word", selector: '[data-testid^="pane-header-"] > span.flex[title] > span.truncate', key: { closest: '[data-testid^="pane-header-"]', attr: "data-testid", strip: "pane-header-" } }, { name: "pane-controls", selector: '[data-testid^="tile-controls-"]', key: { self: !0, attr: "data-testid", strip: "tile-controls-" } }, { name: "pane-expand", selector: '[data-testid^="tile-expand-"]', key: { self: !0, attr: "data-testid", strip: "tile-expand-" } }, { name: "pane-expand-glyph", selector: '[data-testid^="tile-expand-"] > svg', key: { closest: '[data-testid^="tile-expand-"]', attr: "data-testid", strip: "tile-expand-" } }, { name: "pane-close", selector: '[data-testid^="tile-close-"]', key: { self: !0, attr: "data-testid", strip: "tile-close-" } }, { name: "pane-close-glyph", selector: '[data-testid^="tile-close-"] > svg', key: { closest: '[data-testid^="tile-close-"]', attr: "data-testid", strip: "tile-close-" } }, { name: "pane-corner", selector: "div.pointer-events-auto.absolute" }], "new-session": [{ name: "launcher", selector: ".new-session-popover" }, { name: "launcher-filter", selector: '[data-testid="new-tab-filter"]' }, { name: "launcher-list", selector: "#new-tab-launcher-list" }, { name: "launcher-option", selector: '[role="option"]', key: { self: !0, attr: "data-testid" } }, { name: "launcher-option-icon", selector: '[role="option"] > :first-child:not(span.flex-1):not(kbd)', key: { closest: '[role="option"]', attr: "data-testid" } }, { name: "launcher-option-label", selector: '[role="option"] > span.flex-1', key: { closest: '[role="option"]', attr: "data-testid" } }, { name: "launcher-option-key", selector: '[role="option"] > kbd', key: { closest: '[role="option"]', attr: "data-testid" } }, { name: "launcher-note", selector: ".new-session-popover p[role]" }, { name: "agent-select", selector: '[data-testid="new-session-popover-agent"]' }, { name: "agent-manage", selector: ".new-session-popover > div:first-child > button:not([data-testid])" }, { name: "project-option", selector: '[data-testid^="project-option-"]', key: { self: !0, attr: "data-testid", strip: "project-option-" } }, { name: "project-option-name", selector: '[data-testid^="project-option-"]', key: { closest: '[data-testid^="project-option-"]', attr: "data-testid", strip: "project-option-" }, textRange: !0 }, { name: "project-option-path", selector: '[data-testid^="project-option-"] > span', key: { closest: '[data-testid^="project-option-"]', attr: "data-testid", strip: "project-option-" } }], "tab-menu": [{ name: "tab-menu", selector: '[data-testid="tab-split-menu"]' }, { name: "tab-menu-item", selector: '[data-testid="tab-split-menu"] > button', key: { self: !0, attr: "data-testid" } }, { name: "tab-menu-show-beside", selector: '[data-testid="tab-menu-show-beside"]' }, { name: "tab-menu-beside-list", selector: '[data-testid="tab-split-menu"] [role="menu"]' }, { name: "tab-menu-beside-item", selector: '[data-testid="tab-split-menu"] [role="menu"] > button', key: { self: !0, attr: "data-testid" } }, { name: "tab-menu-item-label", selector: '[data-testid="tab-split-menu"] [role="menu"] > button > span.block', key: { closest: '[data-testid="tab-split-menu"] [role="menu"] > button', attr: "data-testid" } }, { name: "tab-menu-empty", selector: '[data-testid="tab-menu-empty"]' }, { name: "tab-menu-divider", selector: '[data-testid="tab-split-menu"] > div.h-px' }, { name: "tab-menu-rename-form", selector: '[data-testid="tab-split-menu"] > form' }, { name: "tab-menu-rename-input", selector: '[data-testid="tab-menu-rename-input"]' }, { name: "tab-menu-rename-save", selector: '[data-testid="tab-split-menu"] > form > button' }], select: [{ name: "select-field", selector: '[data-testid="select-demo"]' }, { name: "select-field-label", selector: '[data-testid="select-demo"] > span.truncate' }, { name: "select-chevron", selector: '[data-testid="select-demo"] > svg' }, { name: "select-list", selector: '[role="listbox"]' }, { name: "select-option", selector: '[role="listbox"] > [role="option"]', key: { self: !0, attr: "data-value" } }, { name: "select-option-label", selector: '[role="listbox"] > [role="option"] > span.truncate', key: { closest: '[role="option"]', attr: "data-value" } }, { name: "select-option-check", selector: '[role="listbox"] > [role="option"] > span[aria-hidden]', key: { closest: '[role="option"]', attr: "data-value" } }], "keybind-help": [{ name: "keybind-help-scrim", selector: "body > div.fixed.inset-0" }, { name: "keybind-help-panel", selector: '[data-testid="keybind-help"]' }, { name: "keybind-help-header", selector: '[data-testid="keybind-help"] > div:first-child' }, { name: "keybind-help-title", selector: '[data-testid="keybind-help"] h2' }, { name: "keybind-help-close", selector: '[aria-label="Close keybind help"]' }, { name: "keybind-help-close-glyph", selector: '[aria-label="Close keybind help"] > svg' }, { name: "keybind-help-search", selector: '[data-testid="keybind-help-search"]' }, { name: "keybind-help-list", selector: '[data-testid="keybind-help"] > div:last-child' }, { name: "keybind-help-empty", selector: '[data-testid="keybind-help"] div.text-center' }, { name: "keybind-help-group", selector: '[data-testid="keybind-help"] section' }, { name: "keybind-help-group-title", selector: '[data-testid="keybind-help"] section > h3' }, { name: "keybind-help-row", selector: '[data-testid="keybind-help"] li' }, { name: "keybind-help-keys", selector: '[data-testid="keybind-help"] li > kbd' }, { name: "keybind-help-description", selector: '[data-testid="keybind-help"] li > span' }], launcher: [{ name: "launcher-scrim", selector: "body > div.fixed.inset-0" }, { name: "launcher-panel", selector: '[data-testid="new-session-dialog"]' }, { name: "launcher-title", selector: '[data-testid="new-session-dialog"] > p' }, { name: "launcher-filter", selector: '[data-testid="new-session-filter"]' }, { name: "launcher-list", selector: "#new-session-list" }, { name: "launcher-row", selector: '[data-testid^="new-session-row-"]', key: { self: !0, attr: "data-testid", strip: "new-session-row-" } }, { name: "launcher-row-icon", selector: '[data-testid^="new-session-row-"] > :first-child:not(span):not(kbd)', key: { closest: '[data-testid^="new-session-row-"]', attr: "data-testid", strip: "new-session-row-" } }, { name: "launcher-row-label", selector: '[data-testid^="new-session-row-"] > span.shrink-0', key: { closest: '[data-testid^="new-session-row-"]', attr: "data-testid", strip: "new-session-row-" } }, { name: "launcher-row-detail", selector: '[data-testid^="new-session-row-"] > span.ml-auto', key: { closest: '[data-testid^="new-session-row-"]', attr: "data-testid", strip: "new-session-row-" } }, { name: "launcher-row-key", selector: '[data-testid^="new-session-row-"] > kbd', key: { closest: '[data-testid^="new-session-row-"]', attr: "data-testid", strip: "new-session-row-" } }, { name: "launcher-note", selector: "#new-session-list > p" }], "session-menu": [{ name: "tab-menu", selector: '[data-testid="tab-split-menu"]' }, { name: "tab-menu-item", selector: '[data-testid="tab-split-menu"] > button', key: { self: !0, attr: "data-testid" } }, { name: "tab-menu-show-beside", selector: '[data-testid="tab-menu-show-beside"]' }, { name: "tab-menu-beside-list", selector: '[data-testid="tab-split-menu"] [role="menu"]' }, { name: "tab-menu-beside-item", selector: '[data-testid="tab-split-menu"] [role="menu"] > button', key: { self: !0, attr: "data-testid" } }, { name: "tab-menu-item-label", selector: '[data-testid="tab-split-menu"] [role="menu"] > button > span.block', key: { closest: '[data-testid="tab-split-menu"] [role="menu"] > button', attr: "data-testid" } }, { name: "tab-menu-empty", selector: '[data-testid="tab-menu-empty"]' }, { name: "tab-menu-divider", selector: '[data-testid="tab-split-menu"] > div.h-px' }], "tab-drag": [{ name: "tab-drag-layer", selector: '[data-testid="tab-drag-layer"]' }, { name: "tab-drag-pane", selector: '[data-testid="tab-drag-layer"] > div.bg-surface-1\\/30' }, { name: "tab-drop-zone", selector: '[data-testid="tab-drop-zone"]', key: { self: !0, attr: "data-zone" } }, { name: "tab-drop-label", selector: '[data-testid="tab-drop-zone"] > span' }, { name: "tab-drag-ghost", selector: '[data-testid="tab-drag-ghost"]' }], start: [{ name: "start-panel", selector: '[data-testid="no-session-panel"], [data-testid="cli-start-panel"]' }, { name: "start-column", selector: '[data-testid$="-panel"] > div' }, { name: "start-logo", selector: '[data-testid="no-session-panel"] img' }, { name: "start-name", selector: '[data-testid$="-panel"] h1, [data-testid="no-session-panel"] h1, [data-testid="no-session-panel"] h2' }, { name: "start-hint", selector: '[data-testid$="-panel"] p' }, { name: "start-target", selector: '[data-testid="workspace-start-target"], [data-testid="cli-start-target"]' }, { name: "start-action", selector: '[data-testid="home-add-project"], [data-testid="no-session-create"], [data-testid^="workspace-start-"]:not([data-testid="workspace-start-target"]), [data-testid^="cli-start-agent-"]', key: { self: !0, attr: "data-testid" } }, { name: "start-status", selector: '[role="status"], [role="alert"]' }, { name: "start-status-action", selector: '[role="status"] > button, [role="alert"] > button' }, { name: "start-link", selector: '[data-testid$="-panel"] button.text-subtext-0' }, { name: "start-shortcut-row", selector: '[data-testid="no-session-panel"] dl > div' }, { name: "start-shortcut-label", selector: '[data-testid="no-session-panel"] dl dt' }, { name: "start-shortcut-key", selector: '[data-testid="no-session-panel"] dl kbd' }], "folder-browser": [{ name: "folder-browser", selector: '[data-testid="dir-browser"]' }, { name: "folder-browser-mode-toggle", selector: '[data-testid="dir-browser-mode-toggle"]' }, { name: "folder-browser-up", selector: '[data-testid="dir-browser-up"]' }, { name: "folder-browser-crumbs", selector: '[data-testid="dir-browser"] span.min-w-0.flex-1' }, { name: "folder-browser-crumb", selector: '[data-testid="dir-browser"] span.min-w-0.flex-1 button' }, { name: "folder-browser-filter", selector: '[data-testid="dir-browser-filter"]' }, { name: "folder-browser-list", selector: '[data-testid="dir-browser"] div.overflow-y-auto' }, { name: "folder-browser-entry", selector: '[data-testid^="dir-browser-entry-"]', key: { self: !0, attr: "data-testid", strip: "dir-browser-entry-" } }, { name: "folder-browser-entry-name", selector: '[data-testid^="dir-browser-entry-"] > span:first-child', key: { closest: '[data-testid^="dir-browser-entry-"]', attr: "data-testid", strip: "dir-browser-entry-" } }, { name: "folder-browser-git", selector: '[data-testid^="dir-browser-entry-"] > span:last-child:not(:first-child)', key: { closest: '[data-testid^="dir-browser-entry-"]', attr: "data-testid", strip: "dir-browser-entry-" } }, { name: "folder-browser-note", selector: '[data-testid="dir-browser"] div.overflow-y-auto > div' }, { name: "folder-browser-use", selector: '[data-testid="dir-browser-use"]' }, { name: "folder-browser-path-input", selector: '[data-testid="project-path-input"]' }], instructions: [{ name: "instructions-scrim", selector: "body > div.fixed.inset-0" }, { name: "instructions-panel", selector: '[data-testid="instructions-dialog"]' }, { name: "instructions-title", selector: '[data-testid="instructions-dialog"] > h2' }, { name: "instructions-intro", selector: '[data-testid="instructions-dialog"] > p' }, { name: "instructions-label", selector: '[data-testid="instructions-dialog"] > label > span:first-child' }, { name: "instructions-count", selector: '[data-testid="instructions-count"]' }, { name: "instructions-text", selector: '[data-testid="instructions-text"]' }, { name: "instructions-folders", selector: '[data-testid="instructions-folders"]' }, { name: "instructions-error", selector: '[data-testid="instructions-error"]' }, { name: "instructions-cancel", selector: '[data-testid="instructions-dialog"] > div.flex.justify-end > button:first-child' }, { name: "instructions-save", selector: '[data-testid="instructions-save"]' }], memory: [{ name: "memory-scrim", selector: "body > div.fixed.inset-0", key: { self: !0, attr: "data-testid" } }, { name: "memory-panel", selector: '[data-testid="memory-dialog"]' }, { name: "memory-title", selector: '[data-testid="memory-dialog"] > h2' }, { name: "memory-intro", selector: '[data-testid="memory-dialog"] > p' }, { name: "memory-caps", selector: '[data-testid="memory-caps"]' }, { name: "memory-new", selector: '[data-testid="memory-new"]' }, { name: "memory-enabled", selector: '[data-testid="memory-enabled"]' }, { name: "memory-enabled-label", selector: '[data-testid="memory-dialog"] > label.flex > span' }, { name: "memory-note", selector: '[data-testid="memory-dialog"] > span.text-subtext-0' }, { name: "memory-row", selector: '[data-testid^="memory-row-"]', key: { self: !0, attr: "data-testid", strip: "memory-row-" } }, { name: "memory-open", selector: '[data-testid^="memory-open-"]', key: { self: !0, attr: "data-testid", strip: "memory-open-" } }, { name: "memory-file-title", selector: '[data-testid^="memory-row-"] button > span:first-child', key: { closest: '[data-testid^="memory-row-"]', attr: "data-testid", strip: "memory-row-" } }, { name: "memory-file-summary", selector: '[data-testid^="memory-row-"] button > span.truncate', key: { closest: '[data-testid^="memory-row-"]', attr: "data-testid", strip: "memory-row-" } }, { name: "memory-file-meta", selector: '[data-testid^="memory-row-"] button > span:last-child', key: { closest: '[data-testid^="memory-row-"]', attr: "data-testid", strip: "memory-row-" } }, { name: "memory-delete", selector: '[data-testid^="memory-delete-"]', key: { self: !0, attr: "data-testid", strip: "memory-delete-" } }, { name: "memory-error", selector: '[data-testid="memory-error"]' }, { name: "memory-close", selector: '[data-testid="memory-dialog"] > div.flex.justify-end > button' }, { name: "memory-file-name", selector: '[data-testid="memory-file-name"]' }, { name: "memory-name", selector: '[data-testid="memory-name"]' }, { name: "memory-count", selector: '[data-testid="memory-count"]' }, { name: "memory-text", selector: '[data-testid="memory-text"]' }, { name: "memory-conflict", selector: '[data-testid="memory-conflict"]' }, { name: "memory-reload", selector: '[data-testid="memory-reload"]' }, { name: "memory-back", selector: '[data-testid="memory-back"]' }, { name: "memory-save", selector: '[data-testid="memory-save"]' }, { name: "memory-confirm", selector: '[data-testid="confirm-dialog"]' }, { name: "memory-confirm-message", selector: ".confirm-dialog__message" }], worktree: [{ name: "worktree-plus", selector: '[data-testid^="worktree-menu-"]' }, { name: "worktree-popover", selector: '[role="dialog"][aria-label="Git worktrees"]' }, { name: "worktree-heading", selector: '[role="dialog"][aria-label="Git worktrees"] > div:first-child > span:first-child' }, { name: "worktree-project", selector: '[role="dialog"][aria-label="Git worktrees"] > div:first-child > span:last-child' }, { name: "worktree-list", selector: '[role="dialog"][aria-label="Git worktrees"] > div.overflow-y-auto' }, { name: "worktree-note", selector: '[role="dialog"][aria-label="Git worktrees"] > div.overflow-y-auto > div:not(.worktree-menu__entry)' }, { name: "worktree-entry", selector: '[data-testid^="worktree-entry-"]', key: { self: !0, attr: "data-testid", strip: "worktree-entry-" } }, { name: "worktree-entry-branch", selector: ".worktree-menu__entry-branch", key: { closest: '[data-testid^="worktree-entry-"]', attr: "data-testid", strip: "worktree-entry-" } }, { name: "worktree-badge", selector: '[data-testid^="worktree-entry-"] .worktree-menu__entry-branch > span', key: { closest: '[data-testid^="worktree-entry-"]', attr: "data-testid", strip: "worktree-entry-" } }, { name: "worktree-entry-path", selector: ".worktree-menu__entry-path", key: { closest: '[data-testid^="worktree-entry-"]', attr: "data-testid", strip: "worktree-entry-" } }, { name: "worktree-open", selector: '[data-testid^="worktree-open-"]', key: { self: !0, attr: "data-testid", strip: "worktree-open-" } }, { name: "worktree-remove", selector: '[data-testid^="worktree-remove-"]', key: { self: !0, attr: "data-testid", strip: "worktree-remove-" } }, { name: "worktree-error", selector: '[data-testid="worktree-error"]' }, { name: "worktree-new", selector: '[data-testid="worktree-new"]' }, { name: "worktree-name-input", selector: '[data-testid="worktree-name-input"]' }, { name: "worktree-start-input", selector: '[data-testid="worktree-start-input"]' }, { name: "worktree-branch-input", selector: '[data-testid="worktree-branch-input"]' }, { name: "worktree-parent-select", selector: '[data-testid="worktree-parent-select"]' }, { name: "worktree-new-branch", selector: '[data-testid="worktree-new-branch"]' }, { name: "worktree-path-input", selector: '[data-testid="worktree-path-input"]' }, { name: "worktree-agent-select", selector: '[data-testid="worktree-agent-select"]' }, { name: "worktree-create-cancel", selector: '[data-testid="worktree-create-cancel"]' }, { name: "worktree-create-submit", selector: '[data-testid="worktree-create-submit"]' }, { name: "worktree-confirm", selector: '[data-testid="confirm-dialog"]' }, { name: "worktree-confirm-message", selector: ".confirm-dialog__message" }, { name: "worktree-confirm-accept", selector: '[data-testid="confirm-accept"]' }, { name: "worktree-confirm-cancel", selector: '[data-testid="confirm-cancel"]' }], "terminal-search": [{ name: "terminal-frame", selector: '[data-testid="persistent-agent-terminal"]' }, { name: "term-search", selector: '[data-testid="term-search"]' }, { name: "term-search-input", selector: '[data-testid="term-search-input"]' }, { name: "term-search-button", selector: '[data-testid="term-search"] > button', key: { self: !0, attr: "title" } }], "agent-control": [{ name: "terminal-frame", selector: '[data-testid="persistent-agent-terminal"]' }, { name: "agent-control-chip", selector: '[data-testid="agent-control-chip"]' }, { name: "agent-control-label", selector: '[data-testid="agent-control-chip"] > span' }, { name: "agent-control-button", selector: '[data-testid="agent-control-chip"] > button' }, { name: "agent-control-error", selector: ".terminal__cli-error" }, { name: "agent-control-ended", selector: ".terminal__exited", key: { self: !0, attr: "data-testid" } }, { name: "agent-control-ended-text", selector: ".terminal__exited-text" }, { name: "agent-control-ended-button", selector: ".terminal__exited-actions > button", key: { self: !0, attr: "data-testid" } }], "phone-size": [{ name: "terminal-frame", selector: '[data-testid="persistent-agent-terminal"]' }, { name: "phone-size-notice", selector: '[data-testid="phone-size-notice"]' }, { name: "phone-size-chip", selector: '[data-testid="phone-size-chip"]' }, { name: "phone-size-heading", selector: '[data-testid="phone-size-notice"] span.font-semibold' }, { name: "phone-size-text", selector: '[data-testid="phone-size-notice"] span:not(.font-semibold)' }, { name: "phone-size-fold", selector: '[aria-label="Keep phone size and hide this"]' }, { name: "phone-size-button", selector: '[data-testid="phone-size-notice"] div.flex.flex-wrap > button, [data-testid="phone-size-chip"] > button' }], window: [{ name: "sidebar-card", selector: '[data-testid="sidebar-card"]' }, { name: "main-card", selector: '[data-testid="main-card"]' }, { name: "tools-card", selector: '[data-testid="tools-card"]' }, { name: "sidebar-toggle", selector: '[data-testid="sidebar-collapse-toggle"]' }, { name: "drawer-toggle", selector: '[data-testid="workspace-tools-toggle"]' }, { name: "resize-sidebar", selector: '[data-testid="resize-sidebar"]' }, { name: "resize-tools", selector: '[data-testid="resize-tools"]' }, { name: "tools-tab", selector: 'nav[aria-label="Files, Git and Browser"] > button' }, { name: "status-bar", selector: "footer.status-bar" }], settings: [{ name: "settings-modal", selector: '[data-testid="settings-modal"]' }, { name: "settings-nav-card", selector: '[data-testid="settings-modal"] > nav' }, { name: "settings-close", selector: '[data-testid="settings-close"]' }, { name: "settings-nav", selector: 'nav [data-testid^="settings-nav-"]', key: { self: !0, attr: "data-testid", strip: "settings-nav-" } }, { name: "settings-main-card", selector: '[data-testid="settings-modal"] > main' }, { name: "settings-search", selector: '[data-testid="settings-search"]' }, { name: "settings-title", selector: '[data-testid="settings-modal"] > main h1' }, { name: "settings-body", selector: '[data-testid="settings-modal"] .settings-modal__body' }, { name: "settings-group-title", selector: '[data-testid="settings-modal"] > main h3' }, { name: "settings-group-card", selector: '[data-testid="settings-modal"] > main section > div.rounded-ui' }, { name: "settings-row", selector: '[data-testid="settings-modal"] [data-setting-row]' }, { name: "settings-row-title", selector: '[data-testid="settings-modal"] [data-setting-row] > div:first-child > div:first-child' }, { name: "settings-row-description", selector: '[data-testid="settings-modal"] [data-setting-row] > div:first-child > div:nth-child(2)' }, { name: "settings-result-title", selector: '[data-testid^="settings-result-"] > h2' }], files: [{ name: "files-explorer", selector: '[data-testid="workspace-files-view"]' }, { name: "files-tree", selector: '[data-testid="workspace-file-tree-scroll"]' }, { name: "files-entry", selector: '[data-testid^="workspace-file-entry-"]', key: { self: !0, attr: "data-testid", strip: "workspace-file-entry-" } }, { name: "files-entry-icon", selector: '[data-testid^="workspace-file-entry-"] > svg[data-file-icon]', key: { closest: '[data-testid^="workspace-file-entry-"]', attr: "data-testid", strip: "workspace-file-entry-" } }, { name: "files-entry-name", selector: '[data-testid^="workspace-file-entry-"] > span.flex-1', key: { closest: '[data-testid^="workspace-file-entry-"]', attr: "data-testid", strip: "workspace-file-entry-" } }, { name: "files-pane", selector: '[data-testid="workspace-file-pane"]' }, { name: "files-file-title", selector: ".workspace-files__file-title > span:first-child" }, { name: "files-dirty", selector: '.workspace-files__file-title > span[title="Unsaved changes"]' }, { name: "files-save", selector: ".workspace-files__save" }, { name: "files-markdown-view", selector: '[aria-label="Markdown view"]' }, { name: "files-markdown-preview", selector: '[data-testid="workspace-markdown-preview"]' }, { name: "files-conflict", selector: '[data-testid="workspace-file-conflict"]' }, { name: "files-conflict-title", selector: '[data-testid="workspace-file-conflict"] > strong' }, { name: "files-conflict-action", selector: '[data-testid="workspace-file-conflict"] button' }, { name: "files-editor", selector: '[data-testid="workspace-file-editor-area"]' }, { name: "editor-text", selector: '[data-testid="workspace-file-editor-area"] .cm-scroller' }, { name: "files-asset", selector: '[data-testid="workspace-file-asset"]' }, { name: "files-asset-header", selector: '[data-testid="workspace-file-asset"] > header' }, { name: "files-asset-title", selector: '[data-testid="workspace-file-asset"] > header > strong' }, { name: "files-image-viewer", selector: '[data-testid="workspace-image-viewer"]' }, { name: "files-image-toolbar", selector: '[data-testid="workspace-image-viewer"] > [role="toolbar"]' }, { name: "files-image-status", selector: '[data-testid="workspace-image-info"]' }] };
export {
  N4 as NAMED_ELEMENTS,
  J0 as React,
  Mb as SCHEMA,
  E4 as STYLE_KEYS,
  z4 as describeToGpui,
  w4 as jsxRuntime,
  k4 as mount,
  _4 as reactDom,
  S4 as sdk
};
