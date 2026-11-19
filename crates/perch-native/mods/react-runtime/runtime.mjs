function Ys(n, a) {
  for (var i = 0; i < a.length; i++) {
    const o = a[i];
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
class re extends Error {
}
const Kg = /* @__PURE__ */ new Set(["hover", "focus", "focus-visible", "focus-within", "active", "disabled", "enabled", "checked"]), Xg = /* @__PURE__ */ new Set(["not", "is", "where", "has", "nth-child"]), Zg = /* @__PURE__ */ new Set(["first-child", "last-child", "only-child", "root", ...Kg]);
function vs(n) {
  return n.replace(/\\(?:([0-9a-fA-F]{1,6})\s?|([\s\S]))/g, (a, i, o) => i ? String.fromCodePoint(parseInt(i, 16)) : o);
}
function _l(n, a) {
  let i = a;
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
  if (i === a) throw new re(`expected a name at ${a} in ${JSON.stringify(n)}`);
  return [vs(n.slice(a, i)), i];
}
function Jg(n, a) {
  let i = 1;
  for (let o = a; o < n.length; o++) {
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
function Ls(n) {
  const a = [];
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
    u === "(" || u === "[" ? i++ : u === ")" || u === "]" ? i-- : u === "," && i === 0 && (a.push(n.slice(o, s).trim()), o = s + 1);
  }
  return a.push(n.slice(o).trim()), a.filter(Boolean);
}
function Wg(n, a) {
  const i = { tag: null, id: null, classes: [], attrs: [], pseudos: [], pseudoElement: null };
  let o = !1;
  for (; a < n.length; ) {
    const s = n[a];
    if (s === "*") {
      i.tag = "*", a++, o = !0;
      continue;
    }
    if (s === ".") {
      const [u, m] = _l(n, a + 1);
      i.classes.push(u), a = m, o = !0;
      continue;
    }
    if (s === "#") {
      const [u, m] = _l(n, a + 1);
      i.id = u, a = m, o = !0;
      continue;
    }
    if (s === "[") {
      const u = n.indexOf("]", a);
      if (u < 0) throw new re(`unclosed [ in ${JSON.stringify(n)}`);
      const m = n.slice(a + 1, u).trim(), f = /^([^\s~^$*|=]+)\s*(?:([~^$*|]?=)\s*(?:"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'|([^\s"'\]]+)))?\s*(i)?$/.exec(m);
      if (!f) throw new re(`cannot read the attribute selector [${m}]`);
      const p = f[3] ?? f[4] ?? f[5];
      i.attrs.push({ name: vs(f[1]).toLowerCase(), op: f[2] ?? null, value: p === void 0 ? null : vs(p) }), a = u + 1, o = !0;
      continue;
    }
    if (s === ":") {
      if (n[a + 1] === ":") {
        const [p, v] = _l(n, a + 2), x = p.toLowerCase();
        if (x !== "before" && x !== "after") throw new re(`::${x} is not supported`);
        if (i.pseudoElement = x, a = v, o = !0, a < n.length && !/[\s>]/.test(n[a])) throw new re(`nothing may follow ::${x} in ${JSON.stringify(n)}`);
        break;
      }
      const [u, m] = _l(n, a + 1);
      a = m;
      const f = u.toLowerCase();
      if ((f === "before" || f === "after") && n[a] !== "(") {
        if (i.pseudoElement = f, o = !0, a < n.length && !/[\s>]/.test(n[a])) throw new re(`nothing may follow :${f} in ${JSON.stringify(n)}`);
        break;
      }
      if (n[a] === "(") {
        if (!Xg.has(f)) throw new re(`:${f}() is not supported`);
        const p = Jg(n, a + 1), v = n.slice(a + 1, p).trim();
        if (a = p + 1, f === "nth-child") {
          if (!/^\d+$/.test(v)) throw new re(`:nth-child(${v}) is not supported (only a number)`);
          i.pseudos.push({ name: f, n: Number(v) });
        } else {
          const x = Ls(v).map(Vs);
          if (f === "has" && x.some((y) => y.length !== 1)) throw new re(`:has(${v}) is not supported (only a compound selector)`);
          i.pseudos.push({ name: f, list: x });
        }
      } else {
        if (!Zg.has(f)) throw new re(`:${f} is not supported`);
        i.pseudos.push({ name: f });
      }
      o = !0;
      continue;
    }
    if (/[A-Za-z_\-\\]/.test(s) && !o) {
      const [u, m] = _l(n, a);
      i.tag = u.toLowerCase(), a = m, o = !0;
      continue;
    }
    break;
  }
  if (!o) throw new re(`empty compound selector at ${a} in ${JSON.stringify(n)}`);
  return [i, a];
}
function Vs(n) {
  const a = [];
  let i = 0, o = null;
  for (n = n.trim(); i < n.length; ) {
    const [s, u] = Wg(n, i);
    if (a.at(-1)?.compound.pseudoElement) throw new re(`::${a.at(-1).compound.pseudoElement} must end ${JSON.stringify(n)}`);
    a.push({ compound: s, combinator: o }), i = u;
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
  if (!a.length) throw new re("empty selector");
  return a;
}
const Fd = /* @__PURE__ */ new Map();
function hr(n) {
  let a = Fd.get(n);
  return a || (a = Ls(n).map(Vs), Fd.set(n, a)), a;
}
function nm(n) {
  const a = [0, 0, 0], i = (o) => {
    a[0] += o[0], a[1] += o[1], a[2] += o[2];
  };
  for (const { compound: o } of n) {
    o.id && a[0]++, a[1] += o.classes.length + o.attrs.length, o.tag && o.tag !== "*" && a[2]++, o.pseudoElement && a[2]++;
    for (const s of o.pseudos)
      if (s.name !== "where")
        if (s.list) {
          const u = s.list.map(nm).sort((m, f) => f[0] - m[0] || f[1] - m[1] || f[2] - m[2])[0];
          i(u);
        } else a[1]++;
  }
  return a;
}
function Fg(n, { name: a, op: i, value: o }) {
  const s = n.getAttribute(a);
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
function Ui(n) {
  return n.parentElement ? n.parentElement.children : [n];
}
function am(n, a) {
  for (const i of n.children) if (a(i) || am(i, a)) return !0;
  return !1;
}
function lm(n, a, i, o) {
  if ((a.pseudoElement ?? null) !== (o ? i.pseudo ?? null : null) || a.tag && a.tag !== "*" && n.tagName !== a.tag || a.id && n.getAttribute("id") !== a.id) return !1;
  if (a.classes.length) {
    const s = n.classSet ?? new Set(n.classList ?? []);
    for (const u of a.classes) if (!s.has(u)) return !1;
  }
  for (const s of a.attrs) if (!Fg(n, s)) return !1;
  for (const s of a.pseudos)
    switch (s.name) {
      case "first-child":
        if (Ui(n)[0] !== n) return !1;
        break;
      case "only-child":
        if (Ui(n).length !== 1) return !1;
        break;
      case "last-child": {
        const u = Ui(n);
        if (u[u.length - 1] !== n) return !1;
        break;
      }
      case "nth-child":
        if (Ui(n).indexOf(n) !== s.n - 1) return !1;
        break;
      case "root":
        if (!n.isDocumentRoot) return !1;
        break;
      case "not":
        if (s.list.some((u) => Va(n, u, i, o))) return !1;
        break;
      case "has":
        if (n.watchesDescendants = !0, !s.list.some(([{ compound: u }]) => am(n, (m) => lm(m, u, i, !1)))) return !1;
        break;
      case "is":
      case "where":
        if (!s.list.some((u) => Va(n, u, i, o))) return !1;
        break;
      default:
        if (!i.state || !i.state(n, s.name, o)) return !1;
    }
  return !0;
}
function Va(n, a, i, o = !0) {
  const s = (u, m, f) => {
    const { compound: p, combinator: v } = a[m];
    if (!lm(u, p, i, f)) return !1;
    if (m === 0) return !0;
    if (v === ">") return !!u.parentElement && s(u.parentElement, m - 1, !1);
    for (let x = u.parentElement; x; x = x.parentElement) if (s(x, m - 1, !1)) return !0;
    return !1;
  };
  return s(n, a.length - 1, o);
}
function $g(n, a, i = {}) {
  return (typeof a == "string" ? hr(a) : a).some((s) => Va(n, s, i));
}
function ys(n, a, i = {}) {
  return Va(n, a, i);
}
function jl(n, a, i = {}) {
  const o = hr(a), s = [], u = (m) => {
    for (const f of m.children)
      o.some((p) => Va(f, p, i)) && s.push(f), u(f);
  };
  return u(n), s;
}
function im(n, a, i = {}) {
  const o = hr(a);
  for (let s = n; s; s = s.parentElement) if (o.some((u) => Va(s, u, i))) return s;
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
let Ig = 1;
class xs {
  constructor(a = 0, i = 0, o = 0, s = 0) {
    this.x = a, this.y = i, this.width = o, this.height = s;
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
class Qs {
  constructor() {
    this.listeners = [];
  }
  addEventListener(a, i, o) {
    const s = o === !0 || !!o?.capture;
    this.listeners.some((u) => u.type === a && u.listener === i && u.capture === s) || this.listeners.push({ type: a, listener: i, capture: s });
  }
  removeEventListener(a, i, o) {
    const s = o === !0 || !!o?.capture;
    this.listeners = this.listeners.filter((u) => !(u.type === a && u.listener === i && u.capture === s));
  }
}
let Pg = 0;
const ws = () => ++Pg;
class gr {
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
class Zt extends Qs {
  constructor(a, i = {}, o = null) {
    super(), this.nodeType = 1, this.id = `n${Ig++}`, this.tagName = a.toLowerCase(), this.props = i, this.childNodes = [], this.parentNode = null, this.ownerDocument = o, this.hidden = !1, this.state = { hover: !1, focus: !1, active: !1 }, this.bounds = null, this.version = 0, this.attrStamp = 0, this.stamp = 0;
  }
  /** Its props, attributes or state changed. */
  touch() {
    this.version++, this.attrStamp = ws(), this.mark();
  }
  /** Its subtree changed: it and its ancestors are described again (their styles are kept unless they changed). */
  mark() {
    const a = ws();
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
    for (const [i, o] of Object.entries(this.props))
      i.startsWith("data-") && o != null && o !== !1 && (a[i.slice(5).replace(/-([a-z])/g, (s, u) => u.toUpperCase())] = String(o));
    return a;
  }
  /** The DOM attribute React would write for `name`, or null. */
  getAttribute(a) {
    const i = this.props;
    if (a === "class") return this.className || null;
    if (a === "id") return i.id != null ? String(i.id) : null;
    if (a === "style") return null;
    const s = i[a === "for" ? "htmlFor" : a === "tabindex" ? "tabIndex" : a];
    return s == null || typeof s == "function" ? null : typeof s == "boolean" ? a.startsWith("aria-") || a.startsWith("data-") ? String(s) : s ? "" : null : String(s);
  }
  hasAttribute(a) {
    return this.getAttribute(a) !== null;
  }
  appendChild(a) {
    return a.parentNode && a.parentNode.removeChild(a), a.parentNode = this, this.childNodes.push(a), this.touchWatchers(), a;
  }
  insertBefore(a, i) {
    a.parentNode && a.parentNode.removeChild(a);
    const o = this.childNodes.indexOf(i);
    return a.parentNode = this, o < 0 ? this.childNodes.push(a) : this.childNodes.splice(o, 0, a), this.touchWatchers(), a;
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
    return $g(this, a);
  }
  closest(a) {
    return im(this, a);
  }
  querySelectorAll(a) {
    return jl(this, a);
  }
  querySelector(a) {
    return jl(this, a)[0] ?? null;
  }
  /** Where the engine last laid this element out (`HostDocument.measure`); else, before its first layout, a box the
   * engine reported another way (the direct children of a scroll area, a pressed element); else a zero box. */
  getBoundingClientRect() {
    const a = this.ownerDocument?.measure?.(this) ?? this.ownerDocument?.itemBounds?.(this.id) ?? this.bounds;
    return a ? new xs(a.x, a.y, a.width, a.height) : new xs();
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
   * (`selectedAll`: the next character typed replaces the text). `select()` focuses the field first, as WebKit and
   * Chromium do: a source that only selects (the tab strip's rename) expects the keyboard there. */
  select() {
    this.focus(), this.selectedAll = !0;
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
    const a = this, i = (m) => String(m).startsWith("--") ? String(m) : String(m).replace(/-([a-z])/g, (f, p) => p.toUpperCase()), o = (m) => {
      const f = a.props.style?.[m];
      return f == null || typeof f == "boolean" ? "" : typeof f == "number" && f !== 0 ? `${f}px` : String(f);
    }, s = (m) => a.inline && m in a.inline ? a.inline[m] : o(m), u = (m, f) => {
      const p = f == null ? "" : String(f);
      s(m) !== p && (a.inline ??= {}, p === o(m) ? delete a.inline[m] : a.inline[m] = p, a.touch(), a.ownerDocument?.restyled());
    };
    return this.styleView = new Proxy({}, {
      get: (m, f) => {
        if (typeof f == "string")
          return f === "setProperty" ? (p, v) => u(i(p), v) : f === "removeProperty" ? (p) => {
            const v = s(i(p));
            return u(i(p), ""), v;
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
    return $d(this);
  }
  /** `outerHTML` without the attributes named in `omit` (by their DOM names), as the web's drag strips its copy. */
  copyMarkup(a = []) {
    return $d(this, a);
  }
}
const rm = Symbol("perch.stale-layout"), om = 3;
let $i = !1;
function sm(n) {
  return () => {
    let a, i = !1;
    const o = (s) => {
      const u = $i;
      $i = s < om;
      try {
        a = n();
      } catch (m) {
        const f = m?.[rm];
        if (!f) throw m;
        f.retries.push(() => {
          i || o(s + 1);
        });
      } finally {
        $i = u;
      }
    };
    return o(0), () => {
      i = !0, typeof a == "function" && a();
    };
  };
}
const _s = "perch-dom:", t0 = /* @__PURE__ */ new Set(["children", "key", "ref", "dangerouslySetInnerHTML"]), e0 = { class: "className", for: "htmlFor", tabindex: "tabIndex" };
function $d(n, a = []) {
  const i = new Set(a.map((s) => e0[s] ?? s)), o = (s) => {
    if (!(s instanceof Zt)) return { x: s.data, ...s.hidden ? { h: 1 } : {} };
    const u = {};
    for (const [m, f] of Object.entries(s.props))
      t0.has(m) || i.has(m) || f == null || typeof f == "function" || typeof f == "symbol" || (u[m] = f);
    return { t: s.tagName, p: u, c: s.childNodes.map(o), ...s.hidden ? { h: 1 } : {} };
  };
  return _s + JSON.stringify(o(n));
}
function n0(n, a) {
  if (typeof n != "string" || !n.startsWith(_s)) return null;
  let i;
  try {
    i = JSON.parse(n.slice(_s.length));
  } catch {
    return null;
  }
  const o = (u) => !!u && typeof u == "object" && !Array.isArray(u), s = (u) => {
    if (!o(u)) throw new Error("not a node");
    let m;
    if (typeof u.x == "string") m = new gr(u.x);
    else {
      if (typeof u.t != "string" || !/^[a-z][a-z0-9-]*$/i.test(u.t) || !o(u.p) || !Array.isArray(u.c)) throw new Error("not an element");
      m = new Zt(u.t, u.p, a);
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
class a0 {
  observe() {
  }
  unobserve() {
  }
  disconnect() {
  }
}
class l0 {
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
function Id(n) {
  for (let a = n; a instanceof Zt; a = a.parentElement) a.touch();
}
class i0 extends Qs {
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
    const o = i(this.measureKey(a));
    if ($i && (!o || this.stale?.())) throw { [rm]: this };
    return o ?? null;
  }
  /** An element's `style` was written: the tree is described again once the writing script is done. */
  restyled() {
    this.restyling || (this.restyling = !0, queueMicrotask(() => {
      this.restyling = !1, this.afterCommit?.();
    }));
  }
  focus(a) {
    (this.activeElement !== a || !a.state.focus) && (this.activeElement && this.activeElement !== a && this.blur(this.activeElement), this.activeElement = a, a.state.focus = !0, a.state.pointerFocus = !1, Id(a), this.restyled()), this.perch?.focused?.(a);
  }
  blur(a) {
    a.state.focus = !1, Id(a), this.restyled(), this.activeElement === a && (this.activeElement = this.body);
  }
  querySelectorAll(a) {
    return jl(this.documentElement, a);
  }
  querySelector(a) {
    return this.querySelectorAll(a)[0] ?? null;
  }
  /** The element whose `id` prop is `id` (React's `useId` ids are not selectors). */
  getElementById(a) {
    return jl(this.documentElement, "*").find((i) => i.props?.id === a) ?? null;
  }
}
class r0 extends Qs {
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
  setTimeout(a, i, ...o) {
    return globalThis.setTimeout(a, i, ...o);
  }
  clearTimeout(a) {
    return globalThis.clearTimeout(a);
  }
}
function cm(n) {
  return {
    setTimeout: (a, i = 0, ...o) => n.setTimeout(() => a(...o), Math.max(0, Number(i) || 0)),
    clearTimeout: (a) => {
      a != null && n.clearTimeout(a);
    }
  };
}
const Pd = Symbol.for("perch.react.globals");
function We(n, a, i) {
  Object.defineProperty(n, a, { value: i, configurable: !0, writable: !0, enumerable: !1 });
}
function o0(n, a = globalThis) {
  const i = new i0(n), o = new r0(n, i);
  i.defaultView = o;
  const s = n.storage ?? new l0();
  if (typeof a.setTimeout != "function") {
    if (typeof n.setTimeout != "function") throw new Error("the engine has no setTimeout and the perch host gives none (perch.setTimeout)");
    const f = cm(n);
    We(a, "setTimeout", f.setTimeout), We(a, "clearTimeout", f.clearTimeout);
  }
  typeof a.queueMicrotask != "function" && We(a, "queueMicrotask", (f) => {
    Promise.resolve().then(f);
  }), We(a, "requestAnimationFrame", (f) => a.setTimeout(() => f(Date.now()), 0)), We(a, "cancelAnimationFrame", (f) => a.clearTimeout(f));
  const u = { document: i, window: o, localStorage: s, HTMLElement: Zt, Element: Zt };
  for (const f of Object.keys(u))
    Object.defineProperty(a, f, { get: () => a[Pd]?.[f], configurable: !0, enumerable: !1 });
  a[Pd] = u, We(a, "DOMRect", xs), We(a, "getComputedStyle", s0), typeof a.ResizeObserver != "function" && We(a, "ResizeObserver", a0);
  const m = a.navigator && typeof a.navigator == "object" ? a.navigator : {};
  if (!m.clipboard && n.clipboard)
    try {
      We(m, "clipboard", n.clipboard);
    } catch {
    }
  return a.navigator || We(a, "navigator", m), { document: i, window: o, globals: u };
}
function s0(n) {
  const a = n?.ownerDocument?.computed?.(n) ?? {}, i = (o) => {
    const s = a[o];
    return typeof s == "string" || typeof s == "number" ? String(s) : "";
  };
  return new Proxy({}, {
    get: (o, s) => {
      if (typeof s == "string")
        return s === "getPropertyValue" ? (u) => i(String(u)) : i(s.replace(/[A-Z]/g, (u) => `-${u.toLowerCase()}`));
    }
  });
}
function ks(n, a = !1) {
  if (!(a ? n?.tagName === "input" && um(n) : n?.tagName === "button" && !/^(button|reset)$/.test(String(n.props.type ?? "submit")) && !n.props.disabled)) return null;
  for (let o = n.parentElement; o; o = o.parentElement) if (o.tagName === "form") return o;
  return null;
}
const um = (n) => n?.tagName === "textarea" || n?.tagName === "input" && /^(text|search|url|email|tel|password|number|)$/.test(String(n.props.type ?? ""));
//! Evaluated before anything else in the runtime bundle: React's scheduler reads `setTimeout` and `queueMicrotask`
//! once, when it loads, so an engine without them (QuickJS) gets the host's (`perch.setTimeout`) first.
const tf = globalThis.perch;
if (typeof globalThis.setTimeout != "function" && typeof tf?.setTimeout == "function") {
  const n = cm(tf);
  globalThis.setTimeout = n.setTimeout, globalThis.clearTimeout = n.clearTimeout;
}
typeof globalThis.queueMicrotask != "function" && (globalThis.queueMicrotask = (n) => {
  Promise.resolve().then(n);
});
function Ks(n) {
  return n && n.__esModule && Object.prototype.hasOwnProperty.call(n, "default") ? n.default : n;
}
function c0(n) {
  if (Object.prototype.hasOwnProperty.call(n, "__esModule")) return n;
  var a = n.default;
  if (typeof a == "function") {
    var i = function o() {
      return this instanceof o ? Reflect.construct(a, arguments, this.constructor) : a.apply(this, arguments);
    };
    i.prototype = a.prototype;
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
var is = { exports: {} }, pt = {};
/**
 * @license React
 * react.production.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var ef;
function u0() {
  if (ef) return pt;
  ef = 1;
  var n = Symbol.for("react.transitional.element"), a = Symbol.for("react.portal"), i = Symbol.for("react.fragment"), o = Symbol.for("react.strict_mode"), s = Symbol.for("react.profiler"), u = Symbol.for("react.consumer"), m = Symbol.for("react.context"), f = Symbol.for("react.forward_ref"), p = Symbol.for("react.suspense"), v = Symbol.for("react.memo"), x = Symbol.for("react.lazy"), y = Symbol.for("react.activity"), b = Symbol.iterator;
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
  }, E = Object.assign, N = {};
  function j(C, J, at) {
    this.props = C, this.context = J, this.refs = N, this.updater = at || T;
  }
  j.prototype.isReactComponent = {}, j.prototype.setState = function(C, J) {
    if (typeof C != "object" && typeof C != "function" && C != null)
      throw Error(
        "takes an object of state variables to update or a function which returns an object of state variables."
      );
    this.updater.enqueueSetState(this, C, J, "setState");
  }, j.prototype.forceUpdate = function(C) {
    this.updater.enqueueForceUpdate(this, C, "forceUpdate");
  };
  function R() {
  }
  R.prototype = j.prototype;
  function U(C, J, at) {
    this.props = C, this.context = J, this.refs = N, this.updater = at || T;
  }
  var F = U.prototype = new R();
  F.constructor = U, E(F, j.prototype), F.isPureReactComponent = !0;
  var W = Array.isArray;
  function B() {
  }
  var g = { H: null, A: null, T: null, S: null }, h = Object.prototype.hasOwnProperty;
  function _(C, J, at) {
    var st = at.ref;
    return {
      $$typeof: n,
      type: C,
      key: J,
      ref: st !== void 0 ? st : null,
      props: at
    };
  }
  function k(C, J) {
    return _(C.type, J, C.props);
  }
  function z(C) {
    return typeof C == "object" && C !== null && C.$$typeof === n;
  }
  function O(C) {
    var J = { "=": "=0", ":": "=2" };
    return "$" + C.replace(/[=:]/g, function(at) {
      return J[at];
    });
  }
  var M = /\/+/g;
  function Y(C, J) {
    return typeof C == "object" && C !== null && C.key != null ? O("" + C.key) : J.toString(36);
  }
  function Z(C) {
    switch (C.status) {
      case "fulfilled":
        return C.value;
      case "rejected":
        throw C.reason;
      default:
        switch (typeof C.status == "string" ? C.then(B, B) : (C.status = "pending", C.then(
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
  function D(C, J, at, st, ct) {
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
            case x:
              return Et = C._init, D(
                Et(C._payload),
                J,
                at,
                st,
                ct
              );
          }
      }
    if (Et)
      return ct = ct(C), Et = st === "" ? "." + Y(C, 0) : st, W(ct) ? (at = "", Et != null && (at = Et.replace(M, "$&/") + "/"), D(ct, J, at, "", function(Qn) {
        return Qn;
      })) : ct != null && (z(ct) && (ct = k(
        ct,
        at + (ct.key == null || C && C.key === ct.key ? "" : ("" + ct.key).replace(
          M,
          "$&/"
        ) + "/") + Et
      )), J.push(ct)), 1;
    Et = 0;
    var $t = st === "" ? "." : st + ":";
    if (W(C))
      for (var ht = 0; ht < C.length; ht++)
        st = C[ht], ut = $t + Y(st, ht), Et += D(
          st,
          J,
          at,
          ut,
          ct
        );
    else if (ht = S(C), typeof ht == "function")
      for (C = ht.call(C), ht = 0; !(st = C.next()).done; )
        st = st.value, ut = $t + Y(st, ht++), Et += D(
          st,
          J,
          at,
          ut,
          ct
        );
    else if (ut === "object") {
      if (typeof C.then == "function")
        return D(
          Z(C),
          J,
          at,
          st,
          ct
        );
      throw J = String(C), Error(
        "Objects are not valid as a React child (found: " + (J === "[object Object]" ? "object with keys {" + Object.keys(C).join(", ") + "}" : J) + "). If you meant to render a collection of children, use an array instead."
      );
    }
    return Et;
  }
  function Q(C, J, at) {
    if (C == null) return C;
    var st = [], ct = 0;
    return D(C, st, "", "", function(ut) {
      return J.call(at, ut, ct++);
    }), st;
  }
  function I(C) {
    if (C._status === -1) {
      var J = C._result;
      J = J(), J.then(
        function(at) {
          (C._status === 0 || C._status === -1) && (C._status = 1, C._result = at);
        },
        function(at) {
          (C._status === 0 || C._status === -1) && (C._status = 2, C._result = at);
        }
      ), C._status === -1 && (C._status = 0, C._result = J);
    }
    if (C._status === 1) return C._result.default;
    throw C._result;
  }
  var G = typeof reportError == "function" ? reportError : function(C) {
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
  }, K = {
    map: Q,
    forEach: function(C, J, at) {
      Q(
        C,
        function() {
          J.apply(this, arguments);
        },
        at
      );
    },
    count: function(C) {
      var J = 0;
      return Q(C, function() {
        J++;
      }), J;
    },
    toArray: function(C) {
      return Q(C, function(J) {
        return J;
      }) || [];
    },
    only: function(C) {
      if (!z(C))
        throw Error(
          "React.Children.only expected to receive a single React element child."
        );
      return C;
    }
  };
  return pt.Activity = y, pt.Children = K, pt.Component = j, pt.Fragment = i, pt.Profiler = s, pt.PureComponent = U, pt.StrictMode = o, pt.Suspense = p, pt.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE = g, pt.__COMPILER_RUNTIME = {
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
  }, pt.cloneElement = function(C, J, at) {
    if (C == null)
      throw Error(
        "The argument must be a React element, but you passed " + C + "."
      );
    var st = E({}, C.props), ct = C.key;
    if (J != null)
      for (ut in J.key !== void 0 && (ct = "" + J.key), J)
        !h.call(J, ut) || ut === "key" || ut === "__self" || ut === "__source" || ut === "ref" && J.ref === void 0 || (st[ut] = J[ut]);
    var ut = arguments.length - 2;
    if (ut === 1) st.children = at;
    else if (1 < ut) {
      for (var Et = Array(ut), $t = 0; $t < ut; $t++)
        Et[$t] = arguments[$t + 2];
      st.children = Et;
    }
    return _(C.type, ct, st);
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
  }, pt.createElement = function(C, J, at) {
    var st, ct = {}, ut = null;
    if (J != null)
      for (st in J.key !== void 0 && (ut = "" + J.key), J)
        h.call(J, st) && st !== "key" && st !== "__self" && st !== "__source" && (ct[st] = J[st]);
    var Et = arguments.length - 2;
    if (Et === 1) ct.children = at;
    else if (1 < Et) {
      for (var $t = Array(Et), ht = 0; ht < Et; ht++)
        $t[ht] = arguments[ht + 2];
      ct.children = $t;
    }
    if (C && C.defaultProps)
      for (st in Et = C.defaultProps, Et)
        ct[st] === void 0 && (ct[st] = Et[st]);
    return _(C, ut, ct);
  }, pt.createRef = function() {
    return { current: null };
  }, pt.forwardRef = function(C) {
    return { $$typeof: f, render: C };
  }, pt.isValidElement = z, pt.lazy = function(C) {
    return {
      $$typeof: x,
      _payload: { _status: -1, _result: C },
      _init: I
    };
  }, pt.memo = function(C, J) {
    return {
      $$typeof: v,
      type: C,
      compare: J === void 0 ? null : J
    };
  }, pt.startTransition = function(C) {
    var J = g.T, at = {};
    g.T = at;
    try {
      var st = C(), ct = g.S;
      ct !== null && ct(at, st), typeof st == "object" && st !== null && typeof st.then == "function" && st.then(B, G);
    } catch (ut) {
      G(ut);
    } finally {
      J !== null && at.types !== null && (J.types = at.types), g.T = J;
    }
  }, pt.unstable_useCacheRefresh = function() {
    return g.H.useCacheRefresh();
  }, pt.use = function(C) {
    return g.H.use(C);
  }, pt.useActionState = function(C, J, at) {
    return g.H.useActionState(C, J, at);
  }, pt.useCallback = function(C, J) {
    return g.H.useCallback(C, J);
  }, pt.useContext = function(C) {
    return g.H.useContext(C);
  }, pt.useDebugValue = function() {
  }, pt.useDeferredValue = function(C, J) {
    return g.H.useDeferredValue(C, J);
  }, pt.useEffect = function(C, J) {
    return g.H.useEffect(C, J);
  }, pt.useEffectEvent = function(C) {
    return g.H.useEffectEvent(C);
  }, pt.useId = function() {
    return g.H.useId();
  }, pt.useImperativeHandle = function(C, J, at) {
    return g.H.useImperativeHandle(C, J, at);
  }, pt.useInsertionEffect = function(C, J) {
    return g.H.useInsertionEffect(C, J);
  }, pt.useLayoutEffect = function(C, J) {
    return g.H.useLayoutEffect(C, J);
  }, pt.useMemo = function(C, J) {
    return g.H.useMemo(C, J);
  }, pt.useOptimistic = function(C, J) {
    return g.H.useOptimistic(C, J);
  }, pt.useReducer = function(C, J, at) {
    return g.H.useReducer(C, J, at);
  }, pt.useRef = function(C) {
    return g.H.useRef(C);
  }, pt.useState = function(C) {
    return g.H.useState(C);
  }, pt.useSyncExternalStore = function(C, J, at) {
    return g.H.useSyncExternalStore(
      C,
      J,
      at
    );
  }, pt.useTransition = function() {
    return g.H.useTransition();
  }, pt.version = "19.2.8", pt;
}
var nf;
function d0() {
  return nf || (nf = 1, is.exports = u0()), is.exports;
}
var X = d0();
const dm = /* @__PURE__ */ Ks(X), f0 = /* @__PURE__ */ Ys({
  __proto__: null,
  default: dm
}, [X]);
//! "react" as the runtime bundles it, for its own code, the stock screens and every screen's `react` import: React
//! itself, with `useEffect` and `useLayoutEffect` run through `measured` (`dom.mjs`), so an effect that measures a
//! box the engine has not laid out yet runs again once it has (layout readback).
const m0 = dm ?? f0;
function Lt(n, a) {
  return X.useEffect(sm(n), a);
}
function Ol(n, a) {
  return X.useLayoutEffect(sm(n), a);
}
const p0 = /* @__PURE__ */ Ys({
  __proto__: null,
  default: m0,
  useEffect: Lt,
  useLayoutEffect: Ol
}, [X]);
var rs = { exports: {} }, kl = {};
/**
 * @license React
 * react-jsx-runtime.production.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var af;
function h0() {
  if (af) return kl;
  af = 1;
  var n = Symbol.for("react.transitional.element"), a = Symbol.for("react.fragment");
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
  return kl.Fragment = a, kl.jsx = i, kl.jsxs = i, kl;
}
var lf;
function g0() {
  return lf || (lf = 1, rs.exports = h0()), rs.exports;
}
var et = g0();
const b0 = /* @__PURE__ */ Ks(et), Fx = /* @__PURE__ */ Ys({
  __proto__: null,
  default: b0
}, [et]);
var os = { exports: {} }, ss = { exports: {} };
const v0 = /* @__PURE__ */ c0(p0);
var cs = { exports: {} }, us = {};
/**
 * @license React
 * scheduler.production.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var rf;
function y0() {
  return rf || (rf = 1, (function(n) {
    function a(D, Q) {
      var I = D.length;
      D.push(Q);
      t: for (; 0 < I; ) {
        var G = I - 1 >>> 1, K = D[G];
        if (0 < s(K, Q))
          D[G] = Q, D[I] = K, I = G;
        else break t;
      }
    }
    function i(D) {
      return D.length === 0 ? null : D[0];
    }
    function o(D) {
      if (D.length === 0) return null;
      var Q = D[0], I = D.pop();
      if (I !== Q) {
        D[0] = I;
        t: for (var G = 0, K = D.length, C = K >>> 1; G < C; ) {
          var J = 2 * (G + 1) - 1, at = D[J], st = J + 1, ct = D[st];
          if (0 > s(at, I))
            st < K && 0 > s(ct, at) ? (D[G] = ct, D[st] = I, G = st) : (D[G] = at, D[J] = I, G = J);
          else if (st < K && 0 > s(ct, I))
            D[G] = ct, D[st] = I, G = st;
          else break t;
        }
      }
      return Q;
    }
    function s(D, Q) {
      var I = D.sortIndex - Q.sortIndex;
      return I !== 0 ? I : D.id - Q.id;
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
    var p = [], v = [], x = 1, y = null, b = 3, S = !1, T = !1, E = !1, N = !1, j = typeof setTimeout == "function" ? setTimeout : null, R = typeof clearTimeout == "function" ? clearTimeout : null, U = typeof setImmediate < "u" ? setImmediate : null;
    function F(D) {
      for (var Q = i(v); Q !== null; ) {
        if (Q.callback === null) o(v);
        else if (Q.startTime <= D)
          o(v), Q.sortIndex = Q.expirationTime, a(p, Q);
        else break;
        Q = i(v);
      }
    }
    function W(D) {
      if (E = !1, F(D), !T)
        if (i(p) !== null)
          T = !0, B || (B = !0, O());
        else {
          var Q = i(v);
          Q !== null && Z(W, Q.startTime - D);
        }
    }
    var B = !1, g = -1, h = 5, _ = -1;
    function k() {
      return N ? !0 : !(n.unstable_now() - _ < h);
    }
    function z() {
      if (N = !1, B) {
        var D = n.unstable_now();
        _ = D;
        var Q = !0;
        try {
          t: {
            T = !1, E && (E = !1, R(g), g = -1), S = !0;
            var I = b;
            try {
              e: {
                for (F(D), y = i(p); y !== null && !(y.expirationTime > D && k()); ) {
                  var G = y.callback;
                  if (typeof G == "function") {
                    y.callback = null, b = y.priorityLevel;
                    var K = G(
                      y.expirationTime <= D
                    );
                    if (D = n.unstable_now(), typeof K == "function") {
                      y.callback = K, F(D), Q = !0;
                      break e;
                    }
                    y === i(p) && o(p), F(D);
                  } else o(p);
                  y = i(p);
                }
                if (y !== null) Q = !0;
                else {
                  var C = i(v);
                  C !== null && Z(
                    W,
                    C.startTime - D
                  ), Q = !1;
                }
              }
              break t;
            } finally {
              y = null, b = I, S = !1;
            }
            Q = void 0;
          }
        } finally {
          Q ? O() : B = !1;
        }
      }
    }
    var O;
    if (typeof U == "function")
      O = function() {
        U(z);
      };
    else if (typeof MessageChannel < "u") {
      var M = new MessageChannel(), Y = M.port2;
      M.port1.onmessage = z, O = function() {
        Y.postMessage(null);
      };
    } else
      O = function() {
        j(z, 0);
      };
    function Z(D, Q) {
      g = j(function() {
        D(n.unstable_now());
      }, Q);
    }
    n.unstable_IdlePriority = 5, n.unstable_ImmediatePriority = 1, n.unstable_LowPriority = 4, n.unstable_NormalPriority = 3, n.unstable_Profiling = null, n.unstable_UserBlockingPriority = 2, n.unstable_cancelCallback = function(D) {
      D.callback = null;
    }, n.unstable_forceFrameRate = function(D) {
      0 > D || 125 < D ? console.error(
        "forceFrameRate takes a positive int between 0 and 125, forcing frame rates higher than 125 fps is not supported"
      ) : h = 0 < D ? Math.floor(1e3 / D) : 5;
    }, n.unstable_getCurrentPriorityLevel = function() {
      return b;
    }, n.unstable_next = function(D) {
      switch (b) {
        case 1:
        case 2:
        case 3:
          var Q = 3;
          break;
        default:
          Q = b;
      }
      var I = b;
      b = Q;
      try {
        return D();
      } finally {
        b = I;
      }
    }, n.unstable_requestPaint = function() {
      N = !0;
    }, n.unstable_runWithPriority = function(D, Q) {
      switch (D) {
        case 1:
        case 2:
        case 3:
        case 4:
        case 5:
          break;
        default:
          D = 3;
      }
      var I = b;
      b = D;
      try {
        return Q();
      } finally {
        b = I;
      }
    }, n.unstable_scheduleCallback = function(D, Q, I) {
      var G = n.unstable_now();
      switch (typeof I == "object" && I !== null ? (I = I.delay, I = typeof I == "number" && 0 < I ? G + I : G) : I = G, D) {
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
      return K = I + K, D = {
        id: x++,
        callback: Q,
        priorityLevel: D,
        startTime: I,
        expirationTime: K,
        sortIndex: -1
      }, I > G ? (D.sortIndex = I, a(v, D), i(p) === null && D === i(v) && (E ? (R(g), g = -1) : E = !0, Z(W, I - G))) : (D.sortIndex = K, a(p, D), T || S || (T = !0, B || (B = !0, O()))), D;
    }, n.unstable_shouldYield = k, n.unstable_wrapCallback = function(D) {
      var Q = b;
      return function() {
        var I = b;
        b = Q;
        try {
          return D.apply(this, arguments);
        } finally {
          b = I;
        }
      };
    }, n.unstable_recoverFromCut = function() {
      !S && !B || (S = !1, y = null, T = !1, B = !1, i(p) !== null && (T = !0, B = !0, O()));
    };
  })(us)), us;
}
var of;
function fm() {
  return of || (of = 1, cs.exports = y0()), cs.exports;
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
var sf;
function x0() {
  return sf || (sf = 1, (function(n) {
    n.exports = function(a) {
      function i(t, e, l, r) {
        return new Fp(t, e, l, r);
      }
      function o() {
      }
      function s(t) {
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
          throw Error(s(188));
      }
      function f(t) {
        var e = t.alternate;
        if (!e) {
          if (e = u(t), e === null) throw Error(s(188));
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
            throw Error(s(188));
          }
          if (l.return !== r.return) l = c, r = d;
          else {
            for (var w = !1, A = c.child; A; ) {
              if (A === l) {
                w = !0, l = c, r = d;
                break;
              }
              if (A === r) {
                w = !0, r = c, l = d;
                break;
              }
              A = A.sibling;
            }
            if (!w) {
              for (A = d.child; A; ) {
                if (A === l) {
                  w = !0, l = d, r = c;
                  break;
                }
                if (A === r) {
                  w = !0, r = d, l = c;
                  break;
                }
                A = A.sibling;
              }
              if (!w) throw Error(s(189));
            }
          }
          if (l.alternate !== r) throw Error(s(190));
        }
        if (l.tag !== 3) throw Error(s(188));
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
      function x(t) {
        return t === null || typeof t != "object" ? null : (t = hd && t[hd] || t["@@iterator"], typeof t == "function" ? t : null);
      }
      function y(t) {
        if (t == null) return null;
        if (typeof t == "function")
          return t.$$typeof === eh ? null : t.displayName || t.name || null;
        if (typeof t == "string") return t;
        switch (t) {
          case xa:
            return "Fragment";
          case Eo:
            return "Profiler";
          case md:
            return "StrictMode";
          case No:
            return "Suspense";
          case To:
            return "SuspenseList";
          case Mo:
            return "Activity";
        }
        if (typeof t == "object")
          switch (t.$$typeof) {
            case ya:
              return "Portal";
            case Sn:
              return t.displayName || "Context";
            case pd:
              return (t._context.displayName || "Context") + ".Consumer";
            case zo:
              var e = t.render;
              return t = t.displayName, t || (t = e.displayName || e.name || "", t = t !== "" ? "ForwardRef(" + t + ")" : "ForwardRef"), t;
            case Co:
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
        0 > ka || (t.current = Bo[ka], Bo[ka] = null, ka--);
      }
      function T(t, e) {
        ka++, Bo[ka] = t.current, t.current = e;
      }
      function E(t) {
        return t >>>= 0, t === 0 ? 32 : 31 - (Cg(t) / Mg | 0) | 0;
      }
      function N(t) {
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
        var c = 0, d = t.suspendedLanes, w = t.pingedLanes;
        t = t.warmLanes;
        var A = r & 134217727;
        return A !== 0 ? (r = A & ~d, r !== 0 ? c = N(r) : (w &= A, w !== 0 ? c = N(w) : l || (l = A & ~t, l !== 0 && (c = N(l))))) : (A = r & ~d, A !== 0 ? c = N(A) : w !== 0 ? c = N(w) : l || (l = r & ~t, l !== 0 && (c = N(l)))), c === 0 ? 0 : e !== 0 && e !== c && (e & d) === 0 && (d = c & -c, l = e & -e, d >= l || d === 32 && (l & 4194048) !== 0) ? e : c;
      }
      function R(t, e) {
        return (t.pendingLanes & ~(t.suspendedLanes & ~t.pingedLanes) & e) === 0;
      }
      function U(t, e) {
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
      function F() {
        var t = yi;
        return yi <<= 1, (yi & 62914560) === 0 && (yi = 4194304), t;
      }
      function W(t) {
        for (var e = [], l = 0; 31 > l; l++) e.push(t);
        return e;
      }
      function B(t, e) {
        t.pendingLanes |= e, e !== 268435456 && (t.suspendedLanes = 0, t.pingedLanes = 0, t.warmLanes = 0);
      }
      function g(t, e, l, r, c, d) {
        var w = t.pendingLanes;
        t.pendingLanes = l, t.suspendedLanes = 0, t.pingedLanes = 0, t.warmLanes = 0, t.expiredLanes &= l, t.entangledLanes &= l, t.errorRecoveryDisabledLanes &= l, t.shellSuspendCounter = 0;
        var A = t.entanglements, V = t.expirationTimes, $ = t.hiddenUpdates;
        for (l = w & ~l; 0 < l; ) {
          var nt = 31 - _e(l), P = 1 << nt;
          A[nt] = 0, V[nt] = -1;
          var lt = $[nt];
          if (lt !== null)
            for ($[nt] = null, nt = 0; nt < lt.length; nt++) {
              var gt = lt[nt];
              gt !== null && (gt.lane &= -536870913);
            }
          l &= ~P;
        }
        r !== 0 && h(t, r, 0), d !== 0 && c === 0 && t.tag !== 0 && (t.suspendedLanes |= d & ~(w & ~e));
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
        return l = (l & 42) !== 0 ? 1 : z(l), (l & (t.suspendedLanes | e)) !== 0 ? 0 : l;
      }
      function z(t) {
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
      function O(t) {
        return t &= -t, 2 < t ? 8 < t ? (t & 134217727) !== 0 ? 32 : 268435456 : 8 : 2;
      }
      function M(t) {
        if (typeof Dg == "function" && Bg(t), ke && typeof ke.setStrictMode == "function")
          try {
            ke.setStrictMode(ul, t);
          } catch {
          }
      }
      function Y(t, e) {
        return t === e && (t !== 0 || 1 / t === 1 / e) || t !== t && e !== e;
      }
      function Z(t) {
        if (qo === void 0)
          try {
            throw Error();
          } catch (l) {
            var e = l.stack.trim().match(/\n( *(at )?)/);
            qo = e && e[1] || "", Yd = -1 < l.stack.indexOf(`
    at`) ? " (<anonymous>)" : -1 < l.stack.indexOf("@") ? "@unknown:0:0" : "";
          }
        return `
` + qo + t + Yd;
      }
      function D(t, e) {
        if (!t || Go) return "";
        Go = !0;
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
          var d = r.DetermineComponentFrameRoot(), w = d[0], A = d[1];
          if (w && A) {
            var V = w.split(`
`), $ = A.split(`
`);
            for (c = r = 0; r < V.length && !V[r].includes("DetermineComponentFrameRoot"); )
              r++;
            for (; c < $.length && !$[c].includes(
              "DetermineComponentFrameRoot"
            ); )
              c++;
            if (r === V.length || c === $.length)
              for (r = V.length - 1, c = $.length - 1; 1 <= r && 0 <= c && V[r] !== $[c]; )
                c--;
            for (; 1 <= r && 0 <= c; r--, c--)
              if (V[r] !== $[c]) {
                if (r !== 1 || c !== 1)
                  do
                    if (r--, c--, 0 > c || V[r] !== $[c]) {
                      var nt = `
` + V[r].replace(" at new ", " at ");
                      return t.displayName && nt.includes("<anonymous>") && (nt = nt.replace("<anonymous>", t.displayName)), nt;
                    }
                  while (1 <= r && 0 <= c);
                break;
              }
          }
        } finally {
          Go = !1, Error.prepareStackTrace = l;
        }
        return (l = t ? t.displayName || t.name : "") ? Z(l) : "";
      }
      function Q(t, e) {
        switch (t.tag) {
          case 26:
          case 27:
          case 5:
            return Z(t.type);
          case 16:
            return Z("Lazy");
          case 13:
            return t.child !== e && e !== null ? Z("Suspense Fallback") : Z("Suspense");
          case 19:
            return Z("SuspenseList");
          case 0:
          case 15:
            return D(t.type, !1);
          case 11:
            return D(t.type.render, !1);
          case 1:
            return D(t.type, !0);
          case 31:
            return Z("Activity");
          default:
            return "";
        }
      }
      function I(t) {
        try {
          var e = "", l = null;
          do
            e += Q(t, l), l = t, t = t.return;
          while (t);
          return e;
        } catch (r) {
          return `
Error generating stack: ` + r.message + `
` + r.stack;
        }
      }
      function G(t, e) {
        if (typeof t == "object" && t !== null) {
          var l = Ld.get(t);
          return l !== void 0 ? l : (e = {
            value: t,
            source: e,
            stack: I(e)
          }, Ld.set(t, e), e);
        }
        return {
          value: t,
          source: e,
          stack: I(e)
        };
      }
      function K(t, e) {
        Ea[za++] = dl, Ea[za++] = wi, wi = t, dl = e;
      }
      function C(t, e, l) {
        Ce[Me++] = Ze, Ce[Me++] = Je, Ce[Me++] = zn, zn = t;
        var r = Ze;
        t = Je;
        var c = 32 - _e(r) - 1;
        r &= ~(1 << c), l += 1;
        var d = 32 - _e(e) + c;
        if (30 < d) {
          var w = c - c % 5;
          d = (r & (1 << w) - 1).toString(32), r >>= w, c -= w, Ze = 1 << 32 - _e(e) + c | l << c | r, Je = d + t;
        } else
          Ze = 1 << d | l << c | r, Je = t;
      }
      function J(t) {
        t.return !== null && (K(t, 1), C(t, 1, 0));
      }
      function at(t) {
        for (; t === wi; )
          wi = Ea[--za], Ea[za] = null, dl = Ea[--za], Ea[za] = null;
        for (; t === zn; )
          zn = Ce[--Me], Ce[Me] = null, Je = Ce[--Me], Ce[Me] = null, Ze = Ce[--Me], Ce[Me] = null;
      }
      function st(t, e) {
        Ce[Me++] = Ze, Ce[Me++] = Je, Ce[Me++] = zn, Ze = e.id, Je = e.overflow, zn = t;
      }
      function ct(t, e) {
        T(Nn, e), T(fl, t), T(ae, null), t = lh(e), S(ae), T(ae, t);
      }
      function ut() {
        S(ae), S(fl), S(Nn);
      }
      function Et(t) {
        t.memoizedState !== null && T(_i, t);
        var e = ae.current, l = ih(e, t.type);
        e !== l && (T(fl, t), T(ae, l));
      }
      function $t(t) {
        fl.current === t && (S(ae), S(fl)), _i.current === t && (S(_i), rn ? ta._currentValue = wa : ta._currentValue2 = wa);
      }
      function ht(t) {
        var e = Error(
          s(
            418,
            1 < arguments.length && arguments[1] !== void 0 && arguments[1] ? "text" : "HTML",
            ""
          )
        );
        throw Xa(G(e, t)), Yo;
      }
      function Qn(t, e) {
        if (!ue) throw Error(s(175));
        ig(
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
        if (Jt ? e !== 3 && e !== 27 && (e !== 5 || Td(t.type) && !gi(t.type, t.memoizedProps)) && Rt && ht(t) : e !== 3 && (e !== 5 || Td(t.type) && !gi(t.type, t.memoizedProps)) && Rt && ht(t), Kn(t), e === 13) {
          if (!ue) throw Error(s(316));
          if (t = t.memoizedState, t = t !== null ? t.dehydrated : null, !t) throw Error(s(317));
          Rt = ug(t);
        } else if (e === 31) {
          if (t = t.memoizedState, t = t !== null ? t.dehydrated : null, !t) throw Error(s(317));
          Rt = cg(t);
        } else
          Rt = Jt && e === 27 ? Wh(
            t.type,
            Rt
          ) : le ? Nd(t.stateNode) : null;
        return !0;
      }
      function Be() {
        ue && (Rt = le = null, St = !1);
      }
      function gn() {
        var t = Tn;
        return t !== null && (ve === null ? ve = t : ve.push.apply(
          ve,
          t
        ), Tn = null), t;
      }
      function Xa(t) {
        Tn === null ? Tn = [t] : Tn.push(t);
      }
      function bn(t, e, l) {
        rn ? (T(ki, e._currentValue), e._currentValue = l) : (T(ki, e._currentValue2), e._currentValue2 = l);
      }
      function Pe(t) {
        var e = ki.current;
        rn ? t._currentValue = e : t._currentValue2 = e, S(ki);
      }
      function wr(t, e, l) {
        for (; t !== null; ) {
          var r = t.alternate;
          if ((t.childLanes & e) !== e ? (t.childLanes |= e, r !== null && (r.childLanes |= e)) : r !== null && (r.childLanes & e) !== e && (r.childLanes |= e), t === l) break;
          t = t.return;
        }
      }
      function _r(t, e, l, r) {
        var c = t.child;
        for (c !== null && (c.return = t); c !== null; ) {
          var d = c.dependencies;
          if (d !== null) {
            var w = c.child;
            d = d.firstContext;
            t: for (; d !== null; ) {
              var A = d;
              d = c;
              for (var V = 0; V < e.length; V++)
                if (A.context === e[V]) {
                  d.lanes |= l, A = d.alternate, A !== null && (A.lanes |= l), wr(
                    d.return,
                    l,
                    t
                  ), r || (w = null);
                  break t;
                }
              d = A.next;
            }
          } else if (c.tag === 18) {
            if (w = c.return, w === null) throw Error(s(341));
            w.lanes |= l, d = w.alternate, d !== null && (d.lanes |= l), wr(w, l, t), w = null;
          } else w = c.child;
          if (w !== null) w.return = c;
          else
            for (w = c; w !== null; ) {
              if (w === t) {
                w = null;
                break;
              }
              if (c = w.sibling, c !== null) {
                c.return = w.return, w = c;
                break;
              }
              w = w.return;
            }
          c = w;
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
            var w = c.alternate;
            if (w === null) throw Error(s(387));
            if (w = w.memoizedProps, w !== null) {
              var A = c.type;
              Se(c.pendingProps.value, w.value) || (t !== null ? t.push(A) : t = [A]);
            }
          } else if (c === _i.current) {
            if (w = c.alternate, w === null) throw Error(s(387));
            w.memoizedState.memoizedState !== c.memoizedState.memoizedState && (t !== null ? t.push(ta) : t = [ta]);
          }
          c = c.return;
        }
        t !== null && _r(
          e,
          t,
          l,
          r
        ), e.flags |= 262144;
      }
      function ql(t) {
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
        return ec(ea, t);
      }
      function Gl(t, e) {
        return ea === null && Xn(t), ec(t, e);
      }
      function ec(t, e) {
        var l = rn ? e._currentValue : e._currentValue2;
        if (e = { context: e, memoizedValue: l, next: null }, sn === null) {
          if (t === null) throw Error(s(308));
          sn = e, t.dependencies = { lanes: 0, firstContext: e }, t.flags |= 524288;
        } else sn = sn.next = e;
        return l;
      }
      function kr() {
        return {
          controller: new Ug(),
          data: /* @__PURE__ */ new Map(),
          refCount: 0
        };
      }
      function Za(t) {
        t.refCount--, t.refCount === 0 && qg(Gg, function() {
          t.controller.abort();
        });
      }
      function Yl() {
      }
      function Qe(t) {
        t !== Na && t.next === null && (Na === null ? Si = Na = t : Na = Na.next = t), Ei = !0, Lo || (Lo = !0, zp());
      }
      function pa(t, e) {
        if (!Vo && Ei) {
          Vo = !0;
          do
            for (var l = !1, r = Si; r !== null; ) {
              if (t !== 0) {
                var c = r.pendingLanes;
                if (c === 0) var d = 0;
                else {
                  var w = r.suspendedLanes, A = r.pingedLanes;
                  d = (1 << 31 - _e(42 | t) + 1) - 1, d &= c & ~(w & ~A), d = d & 201326741 ? d & 201326741 | 1 : d ? d | 2 : 0;
                }
                d !== 0 && (l = !0, rc(r, d));
              } else
                d = kt, d = j(
                  r,
                  r === At ? d : 0,
                  r.cancelPendingCommit !== null || r.timeoutHandle !== Pn
                ), (d & 3) === 0 || R(r, d) || (l = !0, rc(r, d));
              r = r.next;
            }
          while (l);
          Vo = !1;
        }
      }
      function nc() {
        ac();
      }
      function ac() {
        Ei = Lo = !1;
        var t = 0;
        na !== 0 && ph() && (t = na);
        for (var e = ge(), l = null, r = Si; r !== null; ) {
          var c = r.next, d = lc(r, e);
          d === 0 ? (r.next = null, l === null ? Si = c : l.next = c, c === null && (Na = l)) : (l = r, (t !== 0 || (d & 3) !== 0) && (Ei = !0)), r = c;
        }
        Wt !== 0 && Wt !== 5 || pa(t), na !== 0 && (na = 0);
      }
      function lc(t, e) {
        for (var l = t.suspendedLanes, r = t.pingedLanes, c = t.expirationTimes, d = t.pendingLanes & -62914561; 0 < d; ) {
          var w = 31 - _e(d), A = 1 << w, V = c[w];
          V === -1 ? ((A & l) === 0 || (A & r) !== 0) && (c[w] = U(A, e)) : V <= e && (t.expiredLanes |= A), d &= ~A;
        }
        if (e = At, l = kt, l = j(
          t,
          t === e ? l : 0,
          t.cancelPendingCommit !== null || t.timeoutHandle !== Pn
        ), r = t.callbackNode, l === 0 || t === e && (Ct === 2 || Ct === 9) || t.cancelPendingCommit !== null)
          return r !== null && r !== null && Ho(r), t.callbackNode = null, t.callbackPriority = 0;
        if ((l & 3) === 0 || R(t, l)) {
          if (e = l & -l, e === t.callbackPriority) return e;
          switch (r !== null && Ho(r), O(l)) {
            case 2:
            case 8:
              l = Og;
              break;
            case 32:
              l = Uo;
              break;
            case 268435456:
              l = Rg;
              break;
            default:
              l = Uo;
          }
          return r = ic.bind(null, t), l = xi(l, r), t.callbackPriority = e, t.callbackNode = l, e;
        }
        return r !== null && r !== null && Ho(r), t.callbackPriority = 2, t.callbackNode = null, 2;
      }
      function ic(t, e) {
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
        ), r === 0 ? null : (Lu(t, r, e), lc(t, ge()), t.callbackNode != null && t.callbackNode === l ? ic.bind(null, t) : null);
      }
      function rc(t, e) {
        if (rl()) return null;
        Lu(t, e, !0);
      }
      function zp() {
        wh ? _h(function() {
          (wt & 6) !== 0 ? xi(
            qd,
            nc
          ) : ac();
        }) : xi(
          qd,
          nc
        );
      }
      function Sr() {
        if (na === 0) {
          var t = Ta;
          t === 0 && (t = bi, bi <<= 1, (bi & 261888) === 0 && (bi = 256)), na = t;
        }
        return na;
      }
      function Np(t, e) {
        if (ml === null) {
          var l = ml = [];
          Qo = 0, Ta = Sr(), Ca = {
            status: "pending",
            value: void 0,
            then: function(r) {
              l.push(r);
            }
          };
        }
        return Qo++, e.then(oc, oc), e;
      }
      function oc() {
        if (--Qo === 0 && ml !== null) {
          Ca !== null && (Ca.status = "fulfilled");
          var t = ml;
          ml = null, Ta = 0, Ca = null;
          for (var e = 0; e < t.length; e++) (0, t[e])();
        }
      }
      function Tp(t, e) {
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
      function Er() {
        var t = aa.current;
        return t !== null ? t : At.pooledCache;
      }
      function Ll(t, e) {
        e === null ? T(aa, aa.current) : T(aa, e.pool);
      }
      function sc() {
        var t = Er();
        return t === null ? null : {
          parent: rn ? Dt._currentValue : Dt._currentValue2,
          pool: t
        };
      }
      function Vl(t, e) {
        if (Se(t, e)) return !0;
        if (typeof t != "object" || t === null || typeof e != "object" || e === null)
          return !1;
        var l = Object.keys(t), r = Object.keys(e);
        if (l.length !== r.length) return !1;
        for (r = 0; r < l.length; r++) {
          var c = l[r];
          if (!Hg.call(e, c) || !Se(t[c], e[c]))
            return !1;
        }
        return !0;
      }
      function cc(t) {
        return t = t.status, t === "fulfilled" || t === "rejected";
      }
      function uc(t, e, l) {
        switch (l = t[l], l === void 0 ? t.push(e) : l !== e && (e.then(Yl, Yl), e = l), e.status) {
          case "fulfilled":
            return e.value;
          case "rejected":
            throw t = e.reason, fc(t), t;
          default:
            if (typeof e.status == "string") e.then(Yl, Yl);
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
                throw t = e.reason, fc(t), t;
            }
            throw la = e, Ma;
        }
      }
      function Zn(t) {
        try {
          var e = t._init;
          return e(t._payload);
        } catch (l) {
          throw l !== null && typeof l == "object" && typeof l.then == "function" ? (la = l, Ma) : l;
        }
      }
      function dc() {
        if (la === null) throw Error(s(459));
        var t = la;
        return la = null, t;
      }
      function fc(t) {
        if (t === Ma || t === zi)
          throw Error(s(483));
      }
      function Ql(t) {
        var e = pl;
        return pl += 1, Aa === null && (Aa = []), uc(Aa, t, e);
      }
      function Ja(t, e) {
        e = e.props.ref, t.ref = e !== void 0 ? e : null;
      }
      function Kl(t, e) {
        throw e.$$typeof === Pp ? Error(s(525)) : (t = Object.prototype.toString.call(e), Error(
          s(
            31,
            t === "[object Object]" ? "object with keys {" + Object.keys(e).join(", ") + "}" : t
          )
        ));
      }
      function mc(t) {
        function e(q, H) {
          if (t) {
            var L = q.deletions;
            L === null ? (q.deletions = [H], q.flags |= 16) : L.push(H);
          }
        }
        function l(q, H) {
          if (!t) return null;
          for (; H !== null; )
            e(q, H), H = H.sibling;
          return null;
        }
        function r(q) {
          for (var H = /* @__PURE__ */ new Map(); q !== null; )
            q.key !== null ? H.set(q.key, q) : H.set(q.index, q), q = q.sibling;
          return H;
        }
        function c(q, H) {
          return q = ln(q, H), q.index = 0, q.sibling = null, q;
        }
        function d(q, H, L) {
          return q.index = L, t ? (L = q.alternate, L !== null ? (L = L.index, L < H ? (q.flags |= 67108866, H) : L) : (q.flags |= 67108866, H)) : (q.flags |= 1048576, H);
        }
        function w(q) {
          return t && q.alternate === null && (q.flags |= 67108866), q;
        }
        function A(q, H, L, tt) {
          return H === null || H.tag !== 6 ? (H = wo(L, q.mode, tt), H.return = q, H) : (H = c(H, L), H.return = q, H);
        }
        function V(q, H, L, tt) {
          var ft = L.type;
          return ft === xa ? nt(
            q,
            H,
            L.props.children,
            tt,
            L.key
          ) : H !== null && (H.elementType === ft || typeof ft == "object" && ft !== null && ft.$$typeof === En && Zn(ft) === H.type) ? (H = c(H, L.props), Ja(H, L), H.return = q, H) : (H = mi(
            L.type,
            L.key,
            L.props,
            null,
            q.mode,
            tt
          ), Ja(H, L), H.return = q, H);
        }
        function $(q, H, L, tt) {
          return H === null || H.tag !== 4 || H.stateNode.containerInfo !== L.containerInfo || H.stateNode.implementation !== L.implementation ? (H = _o(L, q.mode, tt), H.return = q, H) : (H = c(H, L.children || []), H.return = q, H);
        }
        function nt(q, H, L, tt, ft) {
          return H === null || H.tag !== 7 ? (H = In(
            L,
            q.mode,
            tt,
            ft
          ), H.return = q, H) : (H = c(H, L), H.return = q, H);
        }
        function P(q, H, L) {
          if (typeof H == "string" && H !== "" || typeof H == "number" || typeof H == "bigint")
            return H = wo(
              "" + H,
              q.mode,
              L
            ), H.return = q, H;
          if (typeof H == "object" && H !== null) {
            switch (H.$$typeof) {
              case pi:
                return L = mi(
                  H.type,
                  H.key,
                  H.props,
                  null,
                  q.mode,
                  L
                ), Ja(L, H), L.return = q, L;
              case ya:
                return H = _o(
                  H,
                  q.mode,
                  L
                ), H.return = q, H;
              case En:
                return H = Zn(H), P(q, H, L);
            }
            if (hi(H) || x(H))
              return H = In(
                H,
                q.mode,
                L,
                null
              ), H.return = q, H;
            if (typeof H.then == "function")
              return P(q, Ql(H), L);
            if (H.$$typeof === Sn)
              return P(
                q,
                Gl(q, H),
                L
              );
            Kl(q, H);
          }
          return null;
        }
        function lt(q, H, L, tt) {
          var ft = H !== null ? H.key : null;
          if (typeof L == "string" && L !== "" || typeof L == "number" || typeof L == "bigint")
            return ft !== null ? null : A(q, H, "" + L, tt);
          if (typeof L == "object" && L !== null) {
            switch (L.$$typeof) {
              case pi:
                return L.key === ft ? V(q, H, L, tt) : null;
              case ya:
                return L.key === ft ? $(q, H, L, tt) : null;
              case En:
                return L = Zn(L), lt(q, H, L, tt);
            }
            if (hi(L) || x(L))
              return ft !== null ? null : nt(q, H, L, tt, null);
            if (typeof L.then == "function")
              return lt(
                q,
                H,
                Ql(L),
                tt
              );
            if (L.$$typeof === Sn)
              return lt(
                q,
                H,
                Gl(q, L),
                tt
              );
            Kl(q, L);
          }
          return null;
        }
        function gt(q, H, L, tt, ft) {
          if (typeof tt == "string" && tt !== "" || typeof tt == "number" || typeof tt == "bigint")
            return q = q.get(L) || null, A(H, q, "" + tt, ft);
          if (typeof tt == "object" && tt !== null) {
            switch (tt.$$typeof) {
              case pi:
                return q = q.get(
                  tt.key === null ? L : tt.key
                ) || null, V(H, q, tt, ft);
              case ya:
                return q = q.get(
                  tt.key === null ? L : tt.key
                ) || null, $(H, q, tt, ft);
              case En:
                return tt = Zn(tt), gt(
                  q,
                  H,
                  L,
                  tt,
                  ft
                );
            }
            if (hi(tt) || x(tt))
              return q = q.get(L) || null, nt(H, q, tt, ft, null);
            if (typeof tt.then == "function")
              return gt(
                q,
                H,
                L,
                Ql(tt),
                ft
              );
            if (tt.$$typeof === Sn)
              return gt(
                q,
                H,
                L,
                Gl(H, tt),
                ft
              );
            Kl(H, tt);
          }
          return null;
        }
        function ie(q, H, L, tt) {
          for (var ft = null, Bt = null, mt = H, Nt = H = 0, te = null; mt !== null && Nt < L.length; Nt++) {
            mt.index > Nt ? (te = mt, mt = null) : te = mt.sibling;
            var Tt = lt(
              q,
              mt,
              L[Nt],
              tt
            );
            if (Tt === null) {
              mt === null && (mt = te);
              break;
            }
            t && mt && Tt.alternate === null && e(q, mt), H = d(Tt, H, Nt), Bt === null ? ft = Tt : Bt.sibling = Tt, Bt = Tt, mt = te;
          }
          if (Nt === L.length)
            return l(q, mt), St && K(q, Nt), ft;
          if (mt === null) {
            for (; Nt < L.length; Nt++)
              mt = P(q, L[Nt], tt), mt !== null && (H = d(
                mt,
                H,
                Nt
              ), Bt === null ? ft = mt : Bt.sibling = mt, Bt = mt);
            return St && K(q, Nt), ft;
          }
          for (mt = r(mt); Nt < L.length; Nt++)
            te = gt(
              mt,
              q,
              Nt,
              L[Nt],
              tt
            ), te !== null && (t && te.alternate !== null && mt.delete(
              te.key === null ? Nt : te.key
            ), H = d(
              te,
              H,
              Nt
            ), Bt === null ? ft = te : Bt.sibling = te, Bt = te);
          return t && mt.forEach(function(Rn) {
            return e(q, Rn);
          }), St && K(q, Nt), ft;
        }
        function wl(q, H, L, tt) {
          if (L == null) throw Error(s(151));
          for (var ft = null, Bt = null, mt = H, Nt = H = 0, te = null, Tt = L.next(); mt !== null && !Tt.done; Nt++, Tt = L.next()) {
            mt.index > Nt ? (te = mt, mt = null) : te = mt.sibling;
            var Rn = lt(q, mt, Tt.value, tt);
            if (Rn === null) {
              mt === null && (mt = te);
              break;
            }
            t && mt && Rn.alternate === null && e(q, mt), H = d(Rn, H, Nt), Bt === null ? ft = Rn : Bt.sibling = Rn, Bt = Rn, mt = te;
          }
          if (Tt.done)
            return l(q, mt), St && K(q, Nt), ft;
          if (mt === null) {
            for (; !Tt.done; Nt++, Tt = L.next())
              Tt = P(q, Tt.value, tt), Tt !== null && (H = d(
                Tt,
                H,
                Nt
              ), Bt === null ? ft = Tt : Bt.sibling = Tt, Bt = Tt);
            return St && K(q, Nt), ft;
          }
          for (mt = r(mt); !Tt.done; Nt++, Tt = L.next())
            Tt = gt(
              mt,
              q,
              Nt,
              Tt.value,
              tt
            ), Tt !== null && (t && Tt.alternate !== null && mt.delete(Tt.key === null ? Nt : Tt.key), H = d(Tt, H, Nt), Bt === null ? ft = Tt : Bt.sibling = Tt, Bt = Tt);
          return t && mt.forEach(function(Qg) {
            return e(q, Qg);
          }), St && K(q, Nt), ft;
        }
        function sa(q, H, L, tt) {
          if (typeof L == "object" && L !== null && L.type === xa && L.key === null && (L = L.props.children), typeof L == "object" && L !== null) {
            switch (L.$$typeof) {
              case pi:
                t: {
                  for (var ft = L.key; H !== null; ) {
                    if (H.key === ft) {
                      if (ft = L.type, ft === xa) {
                        if (H.tag === 7) {
                          l(
                            q,
                            H.sibling
                          ), tt = c(
                            H,
                            L.props.children
                          ), tt.return = q, q = tt;
                          break t;
                        }
                      } else if (H.elementType === ft || typeof ft == "object" && ft !== null && ft.$$typeof === En && Zn(ft) === H.type) {
                        l(
                          q,
                          H.sibling
                        ), tt = c(H, L.props), Ja(tt, L), tt.return = q, q = tt;
                        break t;
                      }
                      l(q, H);
                      break;
                    } else e(q, H);
                    H = H.sibling;
                  }
                  L.type === xa ? (tt = In(
                    L.props.children,
                    q.mode,
                    tt,
                    L.key
                  ), tt.return = q, q = tt) : (tt = mi(
                    L.type,
                    L.key,
                    L.props,
                    null,
                    q.mode,
                    tt
                  ), Ja(tt, L), tt.return = q, q = tt);
                }
                return w(q);
              case ya:
                t: {
                  for (ft = L.key; H !== null; ) {
                    if (H.key === ft)
                      if (H.tag === 4 && H.stateNode.containerInfo === L.containerInfo && H.stateNode.implementation === L.implementation) {
                        l(
                          q,
                          H.sibling
                        ), tt = c(
                          H,
                          L.children || []
                        ), tt.return = q, q = tt;
                        break t;
                      } else {
                        l(q, H);
                        break;
                      }
                    else e(q, H);
                    H = H.sibling;
                  }
                  tt = _o(L, q.mode, tt), tt.return = q, q = tt;
                }
                return w(q);
              case En:
                return L = Zn(L), sa(
                  q,
                  H,
                  L,
                  tt
                );
            }
            if (hi(L))
              return ie(
                q,
                H,
                L,
                tt
              );
            if (x(L)) {
              if (ft = x(L), typeof ft != "function")
                throw Error(s(150));
              return L = ft.call(L), wl(
                q,
                H,
                L,
                tt
              );
            }
            if (typeof L.then == "function")
              return sa(
                q,
                H,
                Ql(L),
                tt
              );
            if (L.$$typeof === Sn)
              return sa(
                q,
                H,
                Gl(q, L),
                tt
              );
            Kl(q, L);
          }
          return typeof L == "string" && L !== "" || typeof L == "number" || typeof L == "bigint" ? (L = "" + L, H !== null && H.tag === 6 ? (l(q, H.sibling), tt = c(H, L), tt.return = q, q = tt) : (l(q, H), tt = wo(L, q.mode, tt), tt.return = q, q = tt), w(q)) : l(q, H);
        }
        return function(q, H, L, tt) {
          try {
            pl = 0;
            var ft = sa(
              q,
              H,
              L,
              tt
            );
            return Aa = null, ft;
          } catch (mt) {
            if (mt === Ma || mt === zi) throw mt;
            var Bt = i(29, mt, null, q.mode);
            return Bt.lanes = tt, Bt.return = q, Bt;
          } finally {
          }
        };
      }
      function Xl() {
        for (var t = ja, e = Xo = ja = 0; e < t; ) {
          var l = je[e];
          je[e++] = null;
          var r = je[e];
          je[e++] = null;
          var c = je[e];
          je[e++] = null;
          var d = je[e];
          if (je[e++] = null, r !== null && c !== null) {
            var w = r.pending;
            w === null ? c.next = c : (c.next = w.next, w.next = c), r.pending = c;
          }
          d !== 0 && pc(l, c, d);
        }
      }
      function Zl(t, e, l, r) {
        je[ja++] = t, je[ja++] = e, je[ja++] = l, je[ja++] = r, Xo |= r, t.lanes |= r, t = t.alternate, t !== null && (t.lanes |= r);
      }
      function zr(t, e, l, r) {
        return Zl(t, e, l, r), Jl(t);
      }
      function Jn(t, e) {
        return Zl(t, null, null, e), Jl(t);
      }
      function pc(t, e, l) {
        t.lanes |= l;
        var r = t.alternate;
        r !== null && (r.lanes |= l);
        for (var c = !1, d = t.return; d !== null; )
          d.childLanes |= l, r = d.alternate, r !== null && (r.childLanes |= l), d.tag === 22 && (t = d.stateNode, t === null || t._visibility & 1 || (c = !0)), t = d, d = d.return;
        return t.tag === 3 ? (d = t.stateNode, c && e !== null && (c = 31 - _e(l), t = d.hiddenUpdates, r = t[c], r === null ? t[c] = [e] : r.push(e), e.lane = l | 536870912), d) : null;
      }
      function Jl(t) {
        if (50 < xl)
          throw xl = 0, ls = null, Error(s(185));
        for (var e = t.return; e !== null; )
          t = e, e = t.return;
        return t.tag === 3 ? t.stateNode : null;
      }
      function Nr(t) {
        t.updateQueue = {
          baseState: t.memoizedState,
          firstBaseUpdate: null,
          lastBaseUpdate: null,
          shared: { pending: null, lanes: 0, hiddenCallbacks: null },
          callbacks: null
        };
      }
      function Tr(t, e) {
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
          return c === null ? e.next = e : (e.next = c.next, c.next = e), r.pending = e, e = Jl(t), pc(t, null, l), e;
        }
        return Zl(t, r, e, l), Jl(t);
      }
      function Wa(t, e, l) {
        if (e = e.updateQueue, e !== null && (e = e.shared, (l & 4194048) !== 0)) {
          var r = e.lanes;
          r &= t.pendingLanes, l |= r, e.lanes = l, _(t, l);
        }
      }
      function Cr(t, e) {
        var l = t.updateQueue, r = t.alternate;
        if (r !== null && (r = r.updateQueue, l === r)) {
          var c = null, d = null;
          if (l = l.firstBaseUpdate, l !== null) {
            do {
              var w = {
                lane: l.lane,
                tag: l.tag,
                payload: l.payload,
                callback: null,
                next: null
              };
              d === null ? c = d = w : d = d.next = w, l = l.next;
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
      function Fa() {
        if (Zo) {
          var t = Ca;
          if (t !== null) throw t;
        }
      }
      function $a(t, e, l, r) {
        Zo = !1;
        var c = t.updateQueue;
        Cn = !1;
        var d = c.firstBaseUpdate, w = c.lastBaseUpdate, A = c.shared.pending;
        if (A !== null) {
          c.shared.pending = null;
          var V = A, $ = V.next;
          V.next = null, w === null ? d = $ : w.next = $, w = V;
          var nt = t.alternate;
          nt !== null && (nt = nt.updateQueue, A = nt.lastBaseUpdate, A !== w && (A === null ? nt.firstBaseUpdate = $ : A.next = $, nt.lastBaseUpdate = V));
        }
        if (d !== null) {
          var P = c.baseState;
          w = 0, nt = $ = V = null, A = d;
          do {
            var lt = A.lane & -536870913, gt = lt !== A.lane;
            if (gt ? (kt & lt) === lt : (r & lt) === lt) {
              lt !== 0 && lt === Ta && (Zo = !0), nt !== null && (nt = nt.next = {
                lane: 0,
                tag: A.tag,
                payload: A.payload,
                callback: null,
                next: null
              });
              t: {
                var ie = t, wl = A;
                lt = e;
                var sa = l;
                switch (wl.tag) {
                  case 1:
                    if (ie = wl.payload, typeof ie == "function") {
                      P = ie.call(
                        sa,
                        P,
                        lt
                      );
                      break t;
                    }
                    P = ie;
                    break t;
                  case 3:
                    ie.flags = ie.flags & -65537 | 128;
                  case 0:
                    if (ie = wl.payload, lt = typeof ie == "function" ? ie.call(sa, P, lt) : ie, lt == null) break t;
                    P = So({}, P, lt);
                    break t;
                  case 2:
                    Cn = !0;
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
              }, nt === null ? ($ = nt = gt, V = P) : nt = nt.next = gt, w |= lt;
            if (A = A.next, A === null) {
              if (A = c.shared.pending, A === null)
                break;
              gt = A, A = gt.next, gt.next = null, c.lastBaseUpdate = gt, c.shared.pending = null;
            }
          } while (!0);
          nt === null && (V = P), c.baseState = V, c.firstBaseUpdate = $, c.lastBaseUpdate = nt, d === null && (c.shared.lanes = 0), An |= w, t.lanes = w, t.memoizedState = P;
        }
      }
      function hc(t, e) {
        if (typeof t != "function")
          throw Error(s(191, t));
        t.call(e);
      }
      function gc(t, e) {
        var l = t.callbacks;
        if (l !== null)
          for (t.callbacks = null, t = 0; t < l.length; t++)
            hc(l[t], e);
      }
      function bc(t, e) {
        t = dn, T(Ti, t), T(Oa, e), dn = t | e.baseLanes;
      }
      function Mr() {
        T(Ti, dn), T(Oa, Oa.current);
      }
      function Ar() {
        dn = Ti.current, S(Oa), S(Ti);
      }
      function xn(t) {
        var e = t.alternate;
        T(Yt, Yt.current & 1), T(Ee, t), Oe === null && (e === null || Oa.current !== null || e.memoizedState !== null) && (Oe = t);
      }
      function jr(t) {
        T(Yt, Yt.current), T(Ee, t), Oe === null && (Oe = t);
      }
      function vc(t) {
        t.tag === 22 ? (T(Yt, Yt.current), T(Ee, t), Oe === null && (Oe = t)) : wn();
      }
      function wn() {
        T(Yt, Yt.current), T(Ee, Ee.current);
      }
      function ye(t) {
        S(Ee), Oe === t && (Oe = null), S(Yt);
      }
      function Wl(t) {
        for (var e = t; e !== null; ) {
          if (e.tag === 13) {
            var l = e.memoizedState;
            if (l !== null && (l = l.dehydrated, l === null || Oo(l) || Ro(l)))
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
        throw Error(s(321));
      }
      function Or(t, e) {
        if (e === null) return !1;
        for (var l = 0; l < e.length && l < t.length; l++)
          if (!Se(t[l], e[l])) return !1;
        return !0;
      }
      function Rr(t, e, l, r, c, d) {
        return cn = d, vt = e, e.memoizedState = null, e.updateQueue = null, e.lanes = 0, dt.H = t === null || t.memoizedState === null ? Kd : Jo, ra = !1, d = l(r, c), ra = !1, Ra && (d = xc(
          e,
          l,
          r,
          c
        )), yc(t), d;
      }
      function yc(t) {
        dt.H = gl;
        var e = Mt !== null && Mt.next !== null;
        if (cn = 0, Vt = Mt = vt = null, Ci = !1, hl = 0, Da = null, e) throw Error(s(300));
        t === null || Qt || (t = t.dependencies, t !== null && ql(t) && (Qt = !0));
      }
      function xc(t, e, l, r) {
        vt = t;
        var c = 0;
        do {
          if (Ra && (Da = null), hl = 0, Ra = !1, 25 <= c) throw Error(s(301));
          if (c += 1, Vt = Mt = null, t.updateQueue != null) {
            var d = t.updateQueue;
            d.lastEffect = null, d.events = null, d.stores = null, d.memoCache != null && (d.memoCache.index = 0);
          }
          dt.H = Xd, d = e(l, r);
        } while (Ra);
        return d;
      }
      function Cp() {
        var t = dt.H, e = t.useState()[0];
        return e = typeof e.then == "function" ? Ia(e) : e, t = t.useState()[0], (Mt !== null ? Mt.memoizedState : null) !== t && (vt.flags |= 1024), e;
      }
      function Dr() {
        var t = Mi !== 0;
        return Mi = 0, t;
      }
      function Br(t, e, l) {
        e.updateQueue = t.updateQueue, e.flags &= -2053, t.lanes &= ~l;
      }
      function Hr(t) {
        if (Ci) {
          for (t = t.memoizedState; t !== null; ) {
            var e = t.queue;
            e !== null && (e.pending = null), t = t.next;
          }
          Ci = !1;
        }
        cn = 0, Vt = Mt = vt = null, Ra = !1, hl = Mi = 0, Da = null;
      }
      function fe() {
        var t = {
          memoizedState: null,
          baseState: null,
          baseQueue: null,
          queue: null,
          next: null
        };
        return Vt === null ? vt.memoizedState = Vt = t : Vt = Vt.next = t, Vt;
      }
      function Gt() {
        if (Mt === null) {
          var t = vt.alternate;
          t = t !== null ? t.memoizedState : null;
        } else t = Mt.next;
        var e = Vt === null ? vt.memoizedState : Vt.next;
        if (e !== null)
          Vt = e, Mt = t;
        else {
          if (t === null)
            throw vt.alternate === null ? Error(s(467)) : Error(s(310));
          Mt = t, t = {
            memoizedState: Mt.memoizedState,
            baseState: Mt.baseState,
            baseQueue: Mt.baseQueue,
            queue: Mt.queue,
            next: null
          }, Vt === null ? vt.memoizedState = Vt = t : Vt = Vt.next = t;
        }
        return Vt;
      }
      function Fl() {
        return { lastEffect: null, events: null, stores: null, memoCache: null };
      }
      function Ia(t) {
        var e = hl;
        return hl += 1, Da === null && (Da = []), t = uc(Da, t, e), e = vt, (Vt === null ? e.memoizedState : Vt.next) === null && (e = e.alternate, dt.H = e === null || e.memoizedState === null ? Kd : Jo), t;
      }
      function $l(t) {
        if (t !== null && typeof t == "object") {
          if (typeof t.then == "function") return Ia(t);
          if (t.$$typeof === Sn) return ee(t);
        }
        throw Error(s(438, String(t)));
      }
      function Ur(t) {
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
        if (e == null && (e = { data: [], index: 0 }), l === null && (l = Fl(), vt.updateQueue = l), l.memoCache = e, l = e.data[e.index], l === void 0)
          for (l = e.data[e.index] = Array(t), r = 0; r < t; r++)
            l[r] = th;
        return e.index++, l;
      }
      function tn(t, e) {
        return typeof e == "function" ? e(t) : e;
      }
      function Il(t) {
        var e = Gt();
        return qr(e, Mt, t);
      }
      function qr(t, e, l) {
        var r = t.queue;
        if (r === null) throw Error(s(311));
        r.lastRenderedReducer = l;
        var c = t.baseQueue, d = r.pending;
        if (d !== null) {
          if (c !== null) {
            var w = c.next;
            c.next = d.next, d.next = w;
          }
          e.baseQueue = c = d, r.pending = null;
        }
        if (d = t.baseState, c === null) t.memoizedState = d;
        else {
          e = c.next;
          var A = w = null, V = null, $ = e, nt = !1;
          do {
            var P = $.lane & -536870913;
            if (P !== $.lane ? (kt & P) === P : (cn & P) === P) {
              var lt = $.revertLane;
              if (lt === 0)
                V !== null && (V = V.next = {
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
                }, V === null ? (A = V = P, w = d) : V = V.next = P, vt.lanes |= lt, An |= lt;
              P = $.action, ra && l(d, P), d = $.hasEagerState ? $.eagerState : l(d, P);
            } else
              lt = {
                lane: P,
                revertLane: $.revertLane,
                gesture: $.gesture,
                action: $.action,
                hasEagerState: $.hasEagerState,
                eagerState: $.eagerState,
                next: null
              }, V === null ? (A = V = lt, w = d) : V = V.next = lt, vt.lanes |= P, An |= P;
            $ = $.next;
          } while ($ !== null && $ !== e);
          if (V === null ? w = d : V.next = A, !Se(d, t.memoizedState) && (Qt = !0, nt && (l = Ca, l !== null)))
            throw l;
          t.memoizedState = d, t.baseState = w, t.baseQueue = V, r.lastRenderedState = d;
        }
        return c === null && (r.lanes = 0), [t.memoizedState, r.dispatch];
      }
      function Gr(t) {
        var e = Gt(), l = e.queue;
        if (l === null) throw Error(s(311));
        l.lastRenderedReducer = t;
        var r = l.dispatch, c = l.pending, d = e.memoizedState;
        if (c !== null) {
          l.pending = null;
          var w = c = c.next;
          do
            d = t(d, w.action), w = w.next;
          while (w !== c);
          Se(d, e.memoizedState) || (Qt = !0), e.memoizedState = d, e.baseQueue === null && (e.baseState = d), l.lastRenderedState = d;
        }
        return [d, r];
      }
      function wc(t, e, l) {
        var r = vt, c = Gt(), d = St;
        if (d) {
          if (l === void 0)
            throw Error(s(407));
          l = l();
        } else l = e();
        var w = !Se(
          (Mt || c).memoizedState,
          l
        );
        if (w && (c.memoizedState = l, Qt = !0), c = c.queue, Vr(Sc.bind(null, r, c, t), [
          t
        ]), c.getSnapshot !== e || w || Vt !== null && Vt.memoizedState.tag & 1) {
          if (r.flags |= 2048, ha(
            9,
            { destroy: void 0 },
            kc.bind(
              null,
              r,
              c,
              l,
              e
            ),
            null
          ), At === null) throw Error(s(349));
          d || (cn & 127) !== 0 || _c(r, e, l);
        }
        return l;
      }
      function _c(t, e, l) {
        t.flags |= 16384, t = { getSnapshot: e, value: l }, e = vt.updateQueue, e === null ? (e = Fl(), vt.updateQueue = e, e.stores = [t]) : (l = e.stores, l === null ? e.stores = [t] : l.push(t));
      }
      function kc(t, e, l, r) {
        e.value = l, e.getSnapshot = r, Ec(e) && zc(t);
      }
      function Sc(t, e, l) {
        return l(function() {
          Ec(e) && zc(t);
        });
      }
      function Ec(t) {
        var e = t.getSnapshot;
        t = t.value;
        try {
          var l = e();
          return !Se(t, l);
        } catch {
          return !0;
        }
      }
      function zc(t) {
        var e = Jn(t, 2);
        e !== null && he(e, t, 2);
      }
      function Yr(t) {
        var e = fe();
        if (typeof t == "function") {
          var l = t;
          if (t = l(), ra) {
            M(!0);
            try {
              l();
            } finally {
              M(!1);
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
      function Nc(t, e, l, r) {
        return t.baseState = l, qr(
          t,
          Mt,
          typeof r == "function" ? r : tn
        );
      }
      function Mp(t, e, l, r, c) {
        if (ei(t)) throw Error(s(485));
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
            then: function(w) {
              d.listeners.push(w);
            }
          };
          dt.T !== null ? l(!0) : d.isTransition = !1, r(d), l = e.pending, l === null ? (d.next = e.pending = d, Tc(e, d)) : (d.next = l.next, e.pending = l.next = d);
        }
      }
      function Tc(t, e) {
        var l = e.action, r = e.payload, c = t.state;
        if (e.isTransition) {
          var d = dt.T, w = {};
          dt.T = w;
          try {
            var A = l(c, r), V = dt.S;
            V !== null && V(w, A), Cc(t, e, A);
          } catch ($) {
            Lr(t, e, $);
          } finally {
            d !== null && w.types !== null && (d.types = w.types), dt.T = d;
          }
        } else
          try {
            d = l(c, r), Cc(t, e, d);
          } catch ($) {
            Lr(t, e, $);
          }
      }
      function Cc(t, e, l) {
        l !== null && typeof l == "object" && typeof l.then == "function" ? l.then(
          function(r) {
            Mc(t, e, r);
          },
          function(r) {
            return Lr(t, e, r);
          }
        ) : Mc(t, e, l);
      }
      function Mc(t, e, l) {
        e.status = "fulfilled", e.value = l, Ac(e), t.state = l, e = t.pending, e !== null && (l = e.next, l === e ? t.pending = null : (l = l.next, e.next = l, Tc(t, l)));
      }
      function Lr(t, e, l) {
        var r = t.pending;
        if (t.pending = null, r !== null) {
          r = r.next;
          do
            e.status = "rejected", e.reason = l, Ac(e), e = e.next;
          while (e !== r);
        }
        t.action = null;
      }
      function Ac(t) {
        t = t.listeners;
        for (var e = 0; e < t.length; e++) (0, t[e])();
      }
      function jc(t, e) {
        return e;
      }
      function Oc(t, e) {
        if (St) {
          var l = At.formState;
          if (l !== null) {
            t: {
              var r = vt;
              if (St) {
                if (Rt) {
                  var c = Zh(
                    Rt,
                    Ae
                  );
                  if (c) {
                    Rt = Nd(c), r = Jh(c);
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
          lastRenderedReducer: jc,
          lastRenderedState: e
        }, l.queue = r, l = $c.bind(
          null,
          vt,
          r
        ), r.dispatch = l, r = Yr(!1);
        var d = Zr.bind(
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
        }, r.queue = c, l = Mp.bind(
          null,
          vt,
          c,
          d,
          l
        ), c.dispatch = l, r.memoizedState = t, [e, l, !1];
      }
      function Rc(t) {
        var e = Gt();
        return Dc(e, Mt, t);
      }
      function Dc(t, e, l) {
        if (e = qr(
          t,
          e,
          jc
        )[0], t = Il(tn)[0], typeof e == "object" && e !== null && typeof e.then == "function")
          try {
            var r = Ia(e);
          } catch (w) {
            throw w === Ma ? zi : w;
          }
        else r = e;
        e = Gt();
        var c = e.queue, d = c.dispatch;
        return l !== e.memoizedState && (vt.flags |= 2048, ha(
          9,
          { destroy: void 0 },
          Ap.bind(null, c, l),
          null
        )), [r, d, t];
      }
      function Ap(t, e) {
        t.action = e;
      }
      function Bc(t) {
        var e = Gt(), l = Mt;
        if (l !== null)
          return Dc(e, l, t);
        Gt(), e = e.memoizedState, l = Gt();
        var r = l.queue.dispatch;
        return l.memoizedState = t, [e, r, !1];
      }
      function ha(t, e, l, r) {
        return t = { tag: t, create: l, deps: r, inst: e, next: null }, e = vt.updateQueue, e === null && (e = Fl(), vt.updateQueue = e), l = e.lastEffect, l === null ? e.lastEffect = t.next = t : (r = l.next, l.next = t, t.next = r, e.lastEffect = t), t;
      }
      function Hc() {
        return Gt().memoizedState;
      }
      function Pl(t, e, l, r) {
        var c = fe();
        vt.flags |= t, c.memoizedState = ha(
          1 | e,
          { destroy: void 0 },
          l,
          r === void 0 ? null : r
        );
      }
      function ti(t, e, l, r) {
        var c = Gt();
        r = r === void 0 ? null : r;
        var d = c.memoizedState.inst;
        Mt !== null && r !== null && Or(r, Mt.memoizedState.deps) ? c.memoizedState = ha(e, d, l, r) : (vt.flags |= t, c.memoizedState = ha(
          1 | e,
          d,
          l,
          r
        ));
      }
      function Uc(t, e) {
        Pl(8390656, 8, t, e);
      }
      function Vr(t, e) {
        ti(2048, 8, t, e);
      }
      function jp(t) {
        vt.flags |= 4;
        var e = vt.updateQueue;
        if (e === null)
          e = Fl(), vt.updateQueue = e, e.events = [t];
        else {
          var l = e.events;
          l === null ? e.events = [t] : l.push(t);
        }
      }
      function qc(t) {
        var e = Gt().memoizedState;
        return jp({ ref: e, nextImpl: t }), function() {
          if ((wt & 2) !== 0)
            throw Error(s(440));
          return e.impl.apply(void 0, arguments);
        };
      }
      function Gc(t, e) {
        return ti(4, 2, t, e);
      }
      function Yc(t, e) {
        return ti(4, 4, t, e);
      }
      function Lc(t, e) {
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
      function Vc(t, e, l) {
        l = l != null ? l.concat([t]) : null, ti(
          4,
          4,
          Lc.bind(null, e, t),
          l
        );
      }
      function Qr() {
      }
      function Qc(t, e) {
        var l = Gt();
        e = e === void 0 ? null : e;
        var r = l.memoizedState;
        return e !== null && Or(e, r[1]) ? r[0] : (l.memoizedState = [t, e], t);
      }
      function Kc(t, e) {
        var l = Gt();
        e = e === void 0 ? null : e;
        var r = l.memoizedState;
        if (e !== null && Or(e, r[1]))
          return r[0];
        if (r = t(), ra) {
          M(!0);
          try {
            t();
          } finally {
            M(!1);
          }
        }
        return l.memoizedState = [r, e], r;
      }
      function Kr(t, e, l) {
        return l === void 0 || (cn & 1073741824) !== 0 && (kt & 261930) === 0 ? t.memoizedState = e : (t.memoizedState = l, t = Yu(), vt.lanes |= t, An |= t, l);
      }
      function Xc(t, e, l, r) {
        return Se(l, e) ? l : Oa.current !== null ? (t = Kr(t, l, r), Se(t, e) || (Qt = !0), t) : (cn & 42) === 0 || (cn & 1073741824) !== 0 && (kt & 261930) === 0 ? (Qt = !0, t.memoizedState = l) : (t = Yu(), vt.lanes |= t, An |= t, e);
      }
      function Zc(t, e, l, r, c) {
        var d = on();
        It(
          d !== 0 && 8 > d ? d : 8
        );
        var w = dt.T, A = {};
        dt.T = A, Zr(t, !1, e, l);
        try {
          var V = c(), $ = dt.S;
          if ($ !== null && $(A, V), V !== null && typeof V == "object" && typeof V.then == "function") {
            var nt = Tp(
              V,
              r
            );
            Pa(
              t,
              e,
              nt,
              xe(t)
            );
          } else
            Pa(
              t,
              e,
              r,
              xe(t)
            );
        } catch (P) {
          Pa(
            t,
            e,
            { then: function() {
            }, status: "rejected", reason: P },
            xe()
          );
        } finally {
          It(d), w !== null && A.types !== null && (w.types = A.types), dt.T = w;
        }
      }
      function Jc(t) {
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
      function Xr() {
        return ee(ta);
      }
      function Wc() {
        return Gt().memoizedState;
      }
      function Fc() {
        return Gt().memoizedState;
      }
      function Op(t) {
        for (var e = t.return; e !== null; ) {
          switch (e.tag) {
            case 24:
            case 3:
              var l = xe();
              t = vn(l);
              var r = yn(e, t, l);
              r !== null && (he(r, e, l), Wa(r, e, l)), e = { cache: kr() }, t.payload = e;
              return;
          }
          e = e.return;
        }
      }
      function Rp(t, e, l) {
        var r = xe();
        l = {
          lane: r,
          revertLane: 0,
          gesture: null,
          action: l,
          hasEagerState: !1,
          eagerState: null,
          next: null
        }, ei(t) ? Ic(e, l) : (l = zr(t, e, l, r), l !== null && (he(l, t, r), Pc(l, e, r)));
      }
      function $c(t, e, l) {
        var r = xe();
        Pa(t, e, l, r);
      }
      function Pa(t, e, l, r) {
        var c = {
          lane: r,
          revertLane: 0,
          gesture: null,
          action: l,
          hasEagerState: !1,
          eagerState: null,
          next: null
        };
        if (ei(t)) Ic(e, c);
        else {
          var d = t.alternate;
          if (t.lanes === 0 && (d === null || d.lanes === 0) && (d = e.lastRenderedReducer, d !== null))
            try {
              var w = e.lastRenderedState, A = d(w, l);
              if (c.hasEagerState = !0, c.eagerState = A, Se(A, w))
                return Zl(t, e, c, 0), At === null && Xl(), !1;
            } catch {
            } finally {
            }
          if (l = zr(t, e, c, r), l !== null)
            return he(l, t, r), Pc(l, e, r), !0;
        }
        return !1;
      }
      function Zr(t, e, l, r) {
        if (r = {
          lane: 2,
          revertLane: Sr(),
          gesture: null,
          action: r,
          hasEagerState: !1,
          eagerState: null,
          next: null
        }, ei(t)) {
          if (e) throw Error(s(479));
        } else
          e = zr(
            t,
            l,
            r,
            2
          ), e !== null && he(e, t, 2);
      }
      function ei(t) {
        var e = t.alternate;
        return t === vt || e !== null && e === vt;
      }
      function Ic(t, e) {
        Ra = Ci = !0;
        var l = t.pending;
        l === null ? e.next = e : (e.next = l.next, l.next = e), t.pending = e;
      }
      function Pc(t, e, l) {
        if ((l & 4194048) !== 0) {
          var r = e.lanes;
          r &= t.pendingLanes, l |= r, e.lanes = l, _(t, l);
        }
      }
      function Jr(t, e, l, r) {
        e = t.memoizedState, l = l(r, e), l = l == null ? e : So({}, e, l), t.memoizedState = l, t.lanes === 0 && (t.updateQueue.baseState = l);
      }
      function tu(t, e, l, r, c, d, w) {
        return t = t.stateNode, typeof t.shouldComponentUpdate == "function" ? t.shouldComponentUpdate(r, d, w) : e.prototype && e.prototype.isPureReactComponent ? !Vl(l, r) || !Vl(c, d) : !0;
      }
      function eu(t, e, l, r) {
        t = e.state, typeof e.componentWillReceiveProps == "function" && e.componentWillReceiveProps(l, r), typeof e.UNSAFE_componentWillReceiveProps == "function" && e.UNSAFE_componentWillReceiveProps(l, r), e.state !== t && Wo.enqueueReplaceState(e, e.state, null);
      }
      function Wn(t, e) {
        var l = e;
        if ("ref" in e) {
          l = {};
          for (var r in e)
            r !== "ref" && (l[r] = e[r]);
        }
        if (t = t.defaultProps) {
          l === e && (l = So({}, l));
          for (var c in t)
            l[c] === void 0 && (l[c] = t[c]);
        }
        return l;
      }
      function ni(t, e) {
        try {
          var l = t.onUncaughtError;
          l(e.value, { componentStack: e.stack });
        } catch (r) {
          setTimeout(function() {
            throw r;
          });
        }
      }
      function nu(t, e, l) {
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
      function Wr(t, e, l) {
        return l = vn(l), l.tag = 3, l.payload = { element: null }, l.callback = function() {
          ni(t, e);
        }, l;
      }
      function au(t) {
        return t = vn(t), t.tag = 3, t;
      }
      function lu(t, e, l, r) {
        var c = l.type.getDerivedStateFromError;
        if (typeof c == "function") {
          var d = r.value;
          t.payload = function() {
            return c(d);
          }, t.callback = function() {
            nu(e, l, r);
          };
        }
        var w = l.stateNode;
        w !== null && typeof w.componentDidCatch == "function" && (t.callback = function() {
          nu(e, l, r), typeof c != "function" && (jn === null ? jn = /* @__PURE__ */ new Set([this]) : jn.add(this));
          var A = r.stack;
          this.componentDidCatch(r.value, {
            componentStack: A !== null ? A : ""
          });
        });
      }
      function Dp(t, e, l, r, c) {
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
                return Oe === null ? di() : l.alternate === null && qt === 0 && (qt = 3), l.flags &= -257, l.flags |= 65536, l.lanes = c, r === Ni ? l.flags |= 16384 : (e = l.updateQueue, e === null ? l.updateQueue = /* @__PURE__ */ new Set([r]) : e.add(r), yo(t, r, c)), !1;
              case 22:
                return l.flags |= 65536, r === Ni ? l.flags |= 16384 : (e = l.updateQueue, e === null ? (e = {
                  transitions: null,
                  markerInstances: null,
                  retryQueue: /* @__PURE__ */ new Set([r])
                }, l.updateQueue = e) : (l = e.retryQueue, l === null ? e.retryQueue = /* @__PURE__ */ new Set([r]) : l.add(r)), yo(t, r, c)), !1;
            }
            throw Error(s(435, l.tag));
          }
          return yo(t, r, c), di(), !1;
        }
        if (St)
          return e = Ee.current, e !== null ? ((e.flags & 65536) === 0 && (e.flags |= 256), e.flags |= 65536, e.lanes = c, r !== Yo && (t = Error(s(422), { cause: r }), Xa(
            G(t, l)
          ))) : (r !== Yo && (e = Error(s(423), {
            cause: r
          }), Xa(
            G(e, l)
          )), t = t.current.alternate, t.flags |= 65536, c &= -c, t.lanes |= c, r = G(r, l), c = Wr(
            t.stateNode,
            r,
            c
          ), Cr(t, c), qt !== 4 && (qt = 2)), !1;
        var d = Error(s(520), { cause: r });
        if (d = G(d, l), vl === null ? vl = [d] : vl.push(d), qt !== 4 && (qt = 2), e === null) return !0;
        r = G(r, l), l = e;
        do {
          switch (l.tag) {
            case 3:
              return l.flags |= 65536, t = c & -c, l.lanes |= t, t = Wr(l.stateNode, r, t), Cr(l, t), !1;
            case 1:
              if (e = l.type, d = l.stateNode, (l.flags & 128) === 0 && (typeof e.getDerivedStateFromError == "function" || d !== null && typeof d.componentDidCatch == "function" && (jn === null || !jn.has(
                d
              ))))
                return l.flags |= 65536, c &= -c, l.lanes |= c, c = au(c), lu(
                  c,
                  t,
                  l,
                  r
                ), Cr(l, c), !1;
          }
          l = l.return;
        } while (l !== null);
        return !1;
      }
      function ne(t, e, l, r) {
        e.child = t === null ? Qd(e, null, l, r) : ia(
          e,
          t.child,
          l,
          r
        );
      }
      function iu(t, e, l, r, c) {
        l = l.render;
        var d = e.ref;
        if ("ref" in r) {
          var w = {};
          for (var A in r)
            A !== "ref" && (w[A] = r[A]);
        } else w = r;
        return Xn(e), r = Rr(
          t,
          e,
          l,
          w,
          d,
          c
        ), A = Dr(), t !== null && !Qt ? (Br(t, e, c), en(t, e, c)) : (St && A && J(e), e.flags |= 1, ne(t, e, r, c), e.child);
      }
      function ru(t, e, l, r, c) {
        if (t === null) {
          var d = l.type;
          return typeof d == "function" && !xo(d) && d.defaultProps === void 0 && l.compare === null ? (e.tag = 15, e.type = d, ou(
            t,
            e,
            d,
            r,
            c
          )) : (t = mi(
            l.type,
            null,
            r,
            e,
            e.mode,
            c
          ), t.ref = e.ref, t.return = e, e.child = t);
        }
        if (d = t.child, !no(t, c)) {
          var w = d.memoizedProps;
          if (l = l.compare, l = l !== null ? l : Vl, l(w, r) && t.ref === e.ref)
            return en(
              t,
              e,
              c
            );
        }
        return e.flags |= 1, t = ln(d, r), t.ref = e.ref, t.return = e, e.child = t;
      }
      function ou(t, e, l, r, c) {
        if (t !== null) {
          var d = t.memoizedProps;
          if (Vl(d, r) && t.ref === e.ref)
            if (Qt = !1, e.pendingProps = r = d, no(t, c))
              (t.flags & 131072) !== 0 && (Qt = !0);
            else
              return e.lanes = t.lanes, en(t, e, c);
        }
        return Fr(
          t,
          e,
          l,
          r,
          c
        );
      }
      function su(t, e, l, r) {
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
            return cu(
              t,
              e,
              d,
              l,
              r
            );
          }
          if ((l & 536870912) !== 0)
            e.memoizedState = { baseLanes: 0, cachePool: null }, t !== null && Ll(
              e,
              d !== null ? d.cachePool : null
            ), d !== null ? bc(e, d) : Mr(), vc(e);
          else
            return r = e.lanes = 536870912, cu(
              t,
              e,
              d !== null ? d.baseLanes | l : l,
              l,
              r
            );
        } else
          d !== null ? (Ll(e, d.cachePool), bc(e, d), wn(), e.memoizedState = null) : (t !== null && Ll(e, null), Mr(), wn());
        return ne(t, e, c, l), e.child;
      }
      function tl(t, e) {
        return t !== null && t.tag === 22 || e.stateNode !== null || (e.stateNode = {
          _visibility: 1,
          _pendingMarkers: null,
          _retryCache: null,
          _transitions: null
        }), e.sibling;
      }
      function cu(t, e, l, r, c) {
        var d = Er();
        return d = d === null ? null : {
          parent: rn ? Dt._currentValue : Dt._currentValue2,
          pool: d
        }, e.memoizedState = {
          baseLanes: l,
          cachePool: d
        }, t !== null && Ll(e, null), Mr(), vc(e), t !== null && ma(t, e, r, !0), e.childLanes = c, null;
      }
      function ai(t, e) {
        return e = ii(
          { mode: e.mode, children: e.children },
          t.mode
        ), e.ref = t.ref, t.child = e, e.return = t, e;
      }
      function uu(t, e, l) {
        return ia(e, t.child, null, l), t = ai(
          e,
          e.pendingProps
        ), t.flags |= 2, ye(e), e.memoizedState = null, t;
      }
      function Bp(t, e, l) {
        var r = e.pendingProps, c = (e.flags & 128) !== 0;
        if (e.flags &= -129, t === null) {
          if (St) {
            if (r.mode === "hidden")
              return t = ai(e, r), e.lanes = 536870912, tl(null, t);
            if (jr(e), (t = Rt) ? (t = ag(
              t,
              Ae
            ), t !== null && (e.memoizedState = {
              dehydrated: t,
              treeContext: zn !== null ? { id: Ze, overflow: Je } : null,
              retryLane: 536870912,
              hydrationErrors: null
            }, l = od(t), l.return = e, e.child = l, le = e, Rt = null)) : t = null, t === null) throw ht(e);
            return e.lanes = 536870912, null;
          }
          return ai(e, r);
        }
        var d = t.memoizedState;
        if (d !== null) {
          var w = d.dehydrated;
          if (jr(e), c)
            if (e.flags & 256)
              e.flags &= -257, e = uu(
                t,
                e,
                l
              );
            else if (e.memoizedState !== null)
              e.child = t.child, e.flags |= 128, e = null;
            else throw Error(s(558));
          else if (Qt || ma(
            t,
            e,
            l,
            !1
          ), c = (l & t.childLanes) !== 0, Qt || c) {
            if (r = At, r !== null && (w = k(r, l), w !== 0 && w !== d.retryLane))
              throw d.retryLane = w, Jn(t, w), he(r, t, w), Fo;
            di(), e = uu(
              t,
              e,
              l
            );
          } else
            t = d.treeContext, ue && (Rt = Ih(w), le = e, St = !0, Tn = null, Ae = !1, t !== null && st(e, t)), e = ai(e, r), e.flags |= 4096;
          return e;
        }
        return t = ln(t.child, {
          mode: r.mode,
          children: r.children
        }), t.ref = e.ref, e.child = t, t.return = e, t;
      }
      function li(t, e) {
        var l = e.ref;
        if (l === null)
          t !== null && t.ref !== null && (e.flags |= 4194816);
        else {
          if (typeof l != "function" && typeof l != "object")
            throw Error(s(284));
          (t === null || t.ref !== l) && (e.flags |= 4194816);
        }
      }
      function Fr(t, e, l, r, c) {
        return Xn(e), l = Rr(
          t,
          e,
          l,
          r,
          void 0,
          c
        ), r = Dr(), t !== null && !Qt ? (Br(t, e, c), en(t, e, c)) : (St && r && J(e), e.flags |= 1, ne(t, e, l, c), e.child);
      }
      function du(t, e, l, r, c, d) {
        return Xn(e), e.updateQueue = null, l = xc(
          e,
          r,
          l,
          c
        ), yc(t), r = Dr(), t !== null && !Qt ? (Br(t, e, d), en(t, e, d)) : (St && r && J(e), e.flags |= 1, ne(t, e, l, d), e.child);
      }
      function fu(t, e, l, r, c) {
        if (Xn(e), e.stateNode === null) {
          var d = Sa, w = l.contextType;
          typeof w == "object" && w !== null && (d = ee(w)), d = new l(r, d), e.memoizedState = d.state !== null && d.state !== void 0 ? d.state : null, d.updater = Wo, e.stateNode = d, d._reactInternals = e, d = e.stateNode, d.props = r, d.state = e.memoizedState, d.refs = {}, Nr(e), w = l.contextType, d.context = typeof w == "object" && w !== null ? ee(w) : Sa, d.state = e.memoizedState, w = l.getDerivedStateFromProps, typeof w == "function" && (Jr(
            e,
            l,
            w,
            r
          ), d.state = e.memoizedState), typeof l.getDerivedStateFromProps == "function" || typeof d.getSnapshotBeforeUpdate == "function" || typeof d.UNSAFE_componentWillMount != "function" && typeof d.componentWillMount != "function" || (w = d.state, typeof d.componentWillMount == "function" && d.componentWillMount(), typeof d.UNSAFE_componentWillMount == "function" && d.UNSAFE_componentWillMount(), w !== d.state && Wo.enqueueReplaceState(
            d,
            d.state,
            null
          ), $a(e, r, d, c), Fa(), d.state = e.memoizedState), typeof d.componentDidMount == "function" && (e.flags |= 4194308), r = !0;
        } else if (t === null) {
          d = e.stateNode;
          var A = e.memoizedProps, V = Wn(l, A);
          d.props = V;
          var $ = d.context, nt = l.contextType;
          w = Sa, typeof nt == "object" && nt !== null && (w = ee(nt));
          var P = l.getDerivedStateFromProps;
          nt = typeof P == "function" || typeof d.getSnapshotBeforeUpdate == "function", A = e.pendingProps !== A, nt || typeof d.UNSAFE_componentWillReceiveProps != "function" && typeof d.componentWillReceiveProps != "function" || (A || $ !== w) && eu(
            e,
            d,
            r,
            w
          ), Cn = !1;
          var lt = e.memoizedState;
          d.state = lt, $a(e, r, d, c), Fa(), $ = e.memoizedState, A || lt !== $ || Cn ? (typeof P == "function" && (Jr(
            e,
            l,
            P,
            r
          ), $ = e.memoizedState), (V = Cn || tu(
            e,
            l,
            V,
            r,
            lt,
            $,
            w
          )) ? (nt || typeof d.UNSAFE_componentWillMount != "function" && typeof d.componentWillMount != "function" || (typeof d.componentWillMount == "function" && d.componentWillMount(), typeof d.UNSAFE_componentWillMount == "function" && d.UNSAFE_componentWillMount()), typeof d.componentDidMount == "function" && (e.flags |= 4194308)) : (typeof d.componentDidMount == "function" && (e.flags |= 4194308), e.memoizedProps = r, e.memoizedState = $), d.props = r, d.state = $, d.context = w, r = V) : (typeof d.componentDidMount == "function" && (e.flags |= 4194308), r = !1);
        } else {
          d = e.stateNode, Tr(t, e), w = e.memoizedProps, nt = Wn(l, w), d.props = nt, P = e.pendingProps, lt = d.context, $ = l.contextType, V = Sa, typeof $ == "object" && $ !== null && (V = ee($)), A = l.getDerivedStateFromProps, ($ = typeof A == "function" || typeof d.getSnapshotBeforeUpdate == "function") || typeof d.UNSAFE_componentWillReceiveProps != "function" && typeof d.componentWillReceiveProps != "function" || (w !== P || lt !== V) && eu(
            e,
            d,
            r,
            V
          ), Cn = !1, lt = e.memoizedState, d.state = lt, $a(e, r, d, c), Fa();
          var gt = e.memoizedState;
          w !== P || lt !== gt || Cn || t !== null && t.dependencies !== null && ql(t.dependencies) ? (typeof A == "function" && (Jr(
            e,
            l,
            A,
            r
          ), gt = e.memoizedState), (nt = Cn || tu(
            e,
            l,
            nt,
            r,
            lt,
            gt,
            V
          ) || t !== null && t.dependencies !== null && ql(t.dependencies)) ? ($ || typeof d.UNSAFE_componentWillUpdate != "function" && typeof d.componentWillUpdate != "function" || (typeof d.componentWillUpdate == "function" && d.componentWillUpdate(r, gt, V), typeof d.UNSAFE_componentWillUpdate == "function" && d.UNSAFE_componentWillUpdate(
            r,
            gt,
            V
          )), typeof d.componentDidUpdate == "function" && (e.flags |= 4), typeof d.getSnapshotBeforeUpdate == "function" && (e.flags |= 1024)) : (typeof d.componentDidUpdate != "function" || w === t.memoizedProps && lt === t.memoizedState || (e.flags |= 4), typeof d.getSnapshotBeforeUpdate != "function" || w === t.memoizedProps && lt === t.memoizedState || (e.flags |= 1024), e.memoizedProps = r, e.memoizedState = gt), d.props = r, d.state = gt, d.context = V, r = nt) : (typeof d.componentDidUpdate != "function" || w === t.memoizedProps && lt === t.memoizedState || (e.flags |= 4), typeof d.getSnapshotBeforeUpdate != "function" || w === t.memoizedProps && lt === t.memoizedState || (e.flags |= 1024), r = !1);
        }
        return d = r, li(t, e), r = (e.flags & 128) !== 0, d || r ? (d = e.stateNode, l = r && typeof l.getDerivedStateFromError != "function" ? null : d.render(), e.flags |= 1, t !== null && r ? (e.child = ia(
          e,
          t.child,
          null,
          c
        ), e.child = ia(
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
      function mu(t, e, l, r) {
        return Be(), e.flags |= 256, ne(t, e, l, r), e.child;
      }
      function $r(t) {
        return { baseLanes: t, cachePool: sc() };
      }
      function Ir(t, e, l) {
        return t = t !== null ? t.childLanes & ~l : 0, e && (t |= Ne), t;
      }
      function pu(t, e, l) {
        var r = e.pendingProps, c = !1, d = (e.flags & 128) !== 0, w;
        if ((w = d) || (w = t !== null && t.memoizedState === null ? !1 : (Yt.current & 2) !== 0), w && (c = !0, e.flags &= -129), w = (e.flags & 32) !== 0, e.flags &= -33, t === null) {
          if (St) {
            if (c ? xn(e) : wn(), (t = Rt) ? (t = lg(
              t,
              Ae
            ), t !== null && (e.memoizedState = {
              dehydrated: t,
              treeContext: zn !== null ? { id: Ze, overflow: Je } : null,
              retryLane: 536870912,
              hydrationErrors: null
            }, l = od(t), l.return = e, e.child = l, le = e, Rt = null)) : t = null, t === null) throw ht(e);
            return Ro(t) ? e.lanes = 32 : e.lanes = 536870912, null;
          }
          var A = r.children;
          return r = r.fallback, c ? (wn(), c = e.mode, A = ii(
            { mode: "hidden", children: A },
            c
          ), r = In(
            r,
            c,
            l,
            null
          ), A.return = e, r.return = e, A.sibling = r, e.child = A, r = e.child, r.memoizedState = $r(l), r.childLanes = Ir(
            t,
            w,
            l
          ), e.memoizedState = $o, tl(null, r)) : (xn(e), Pr(e, A));
        }
        var V = t.memoizedState;
        if (V !== null && (A = V.dehydrated, A !== null)) {
          if (d)
            e.flags & 256 ? (xn(e), e.flags &= -257, e = to(
              t,
              e,
              l
            )) : e.memoizedState !== null ? (wn(), e.child = t.child, e.flags |= 128, e = null) : (wn(), A = r.fallback, c = e.mode, r = ii(
              { mode: "visible", children: r.children },
              c
            ), A = In(
              A,
              c,
              l,
              null
            ), A.flags |= 2, r.return = e, A.return = e, r.sibling = A, e.child = r, ia(
              e,
              t.child,
              null,
              l
            ), r = e.child, r.memoizedState = $r(l), r.childLanes = Ir(
              t,
              w,
              l
            ), e.memoizedState = $o, e = tl(null, r));
          else if (xn(e), Ro(A))
            w = Kh(A).digest, r = Error(s(419)), r.stack = "", r.digest = w, Xa({ value: r, source: null, stack: null }), e = to(
              t,
              e,
              l
            );
          else if (Qt || ma(
            t,
            e,
            l,
            !1
          ), w = (l & t.childLanes) !== 0, Qt || w) {
            if (w = At, w !== null && (r = k(
              w,
              l
            ), r !== 0 && r !== V.retryLane))
              throw V.retryLane = r, Jn(t, r), he(w, t, r), Fo;
            Oo(A) || di(), e = to(
              t,
              e,
              l
            );
          } else
            Oo(A) ? (e.flags |= 192, e.child = t.child, e = null) : (t = V.treeContext, ue && (Rt = Ph(
              A
            ), le = e, St = !0, Tn = null, Ae = !1, t !== null && st(e, t)), e = Pr(
              e,
              r.children
            ), e.flags |= 4096);
          return e;
        }
        return c ? (wn(), A = r.fallback, c = e.mode, V = t.child, d = V.sibling, r = ln(V, {
          mode: "hidden",
          children: r.children
        }), r.subtreeFlags = V.subtreeFlags & 65011712, d !== null ? A = ln(
          d,
          A
        ) : (A = In(
          A,
          c,
          l,
          null
        ), A.flags |= 2), A.return = e, r.return = e, r.sibling = A, e.child = r, tl(null, r), r = e.child, A = t.child.memoizedState, A === null ? A = $r(l) : (c = A.cachePool, c !== null ? (V = rn ? Dt._currentValue : Dt._currentValue2, c = c.parent !== V ? { parent: V, pool: V } : c) : c = sc(), A = {
          baseLanes: A.baseLanes | l,
          cachePool: c
        }), r.memoizedState = A, r.childLanes = Ir(
          t,
          w,
          l
        ), e.memoizedState = $o, tl(t.child, r)) : (xn(e), l = t.child, t = l.sibling, l = ln(l, {
          mode: "visible",
          children: r.children
        }), l.return = e, l.sibling = null, t !== null && (w = e.deletions, w === null ? (e.deletions = [t], e.flags |= 16) : w.push(t)), e.child = l, e.memoizedState = null, l);
      }
      function Pr(t, e) {
        return e = ii(
          { mode: "visible", children: e },
          t.mode
        ), e.return = t, t.child = e;
      }
      function ii(t, e) {
        return t = i(22, t, null, e), t.lanes = 0, t;
      }
      function to(t, e, l) {
        return ia(e, t.child, null, l), t = Pr(
          e,
          e.pendingProps.children
        ), t.flags |= 2, e.memoizedState = null, t;
      }
      function hu(t, e, l) {
        t.lanes |= e;
        var r = t.alternate;
        r !== null && (r.lanes |= e), wr(t.return, e, l);
      }
      function eo(t, e, l, r, c, d) {
        var w = t.memoizedState;
        w === null ? t.memoizedState = {
          isBackwards: e,
          rendering: null,
          renderingStartTime: 0,
          last: r,
          tail: l,
          tailMode: c,
          treeForkCount: d
        } : (w.isBackwards = e, w.rendering = null, w.renderingStartTime = 0, w.last = r, w.tail = l, w.tailMode = c, w.treeForkCount = d);
      }
      function gu(t, e, l) {
        var r = e.pendingProps, c = r.revealOrder, d = r.tail;
        r = r.children;
        var w = Yt.current, A = (w & 2) !== 0;
        if (A ? (w = w & 1 | 2, e.flags |= 128) : w &= 1, T(Yt, w), ne(t, e, r, l), r = St ? dl : 0, !A && t !== null && (t.flags & 128) !== 0)
          t: for (t = e.child; t !== null; ) {
            if (t.tag === 13)
              t.memoizedState !== null && hu(t, l, e);
            else if (t.tag === 19)
              hu(t, l, e);
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
              t = l.alternate, t !== null && Wl(t) === null && (c = l), l = l.sibling;
            l = c, l === null ? (c = e.child, e.child = null) : (c = l.sibling, l.sibling = null), eo(
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
              if (t = c.alternate, t !== null && Wl(t) === null) {
                e.child = c;
                break;
              }
              t = c.sibling, c.sibling = l, l = c, c = t;
            }
            eo(
              e,
              !0,
              l,
              null,
              d,
              r
            );
            break;
          case "together":
            eo(
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
          throw Error(s(153));
        if (e.child !== null) {
          for (t = e.child, l = ln(t, t.pendingProps), e.child = l, l.return = e; t.sibling !== null; )
            t = t.sibling, l = l.sibling = ln(t, t.pendingProps), l.return = e;
          l.sibling = null;
        }
        return e.child;
      }
      function no(t, e) {
        return (t.lanes & e) !== 0 ? !0 : (t = t.dependencies, !!(t !== null && ql(t)));
      }
      function Hp(t, e, l) {
        switch (e.tag) {
          case 3:
            ct(
              e,
              e.stateNode.containerInfo
            ), bn(e, Dt, t.memoizedState.cache), Be();
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
              return e.flags |= 128, jr(e), null;
            break;
          case 13:
            var r = e.memoizedState;
            if (r !== null)
              return r.dehydrated !== null ? (xn(e), e.flags |= 128, null) : (l & e.child.childLanes) !== 0 ? pu(
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
                return gu(
                  t,
                  e,
                  l
                );
              e.flags |= 128;
            }
            if (c = e.memoizedState, c !== null && (c.rendering = null, c.tail = null, c.lastEffect = null), T(Yt, Yt.current), r) break;
            return null;
          case 22:
            return e.lanes = 0, su(
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
      function bu(t, e, l) {
        if (t !== null)
          if (t.memoizedProps !== e.pendingProps)
            Qt = !0;
          else {
            if (!no(t, l) && (e.flags & 128) === 0)
              return Qt = !1, Hp(
                t,
                e,
                l
              );
            Qt = (t.flags & 131072) !== 0;
          }
        else
          Qt = !1, St && (e.flags & 1048576) !== 0 && C(e, dl, e.index);
        switch (e.lanes = 0, e.tag) {
          case 16:
            t: {
              var r = e.pendingProps;
              if (t = Zn(e.elementType), e.type = t, typeof t == "function")
                xo(t) ? (r = Wn(t, r), e.tag = 1, e = fu(
                  null,
                  e,
                  t,
                  r,
                  l
                )) : (e.tag = 0, e = Fr(
                  null,
                  e,
                  t,
                  r,
                  l
                ));
              else {
                if (t != null) {
                  var c = t.$$typeof;
                  if (c === zo) {
                    e.tag = 11, e = iu(
                      null,
                      e,
                      t,
                      r,
                      l
                    );
                    break t;
                  } else if (c === Co) {
                    e.tag = 14, e = ru(
                      null,
                      e,
                      t,
                      r,
                      l
                    );
                    break t;
                  }
                }
                throw e = y(t) || t, Error(s(306, e, ""));
              }
            }
            return e;
          case 0:
            return Fr(
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
            ), fu(
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
              ), t === null) throw Error(s(387));
              var d = e.pendingProps;
              c = e.memoizedState, r = c.element, Tr(t, e), $a(e, d, null, l);
              var w = e.memoizedState;
              if (d = w.cache, bn(e, Dt, d), d !== c.cache && _r(
                e,
                [Dt],
                l,
                !0
              ), Fa(), d = w.element, ue && c.isDehydrated)
                if (c = {
                  element: d,
                  isDehydrated: !1,
                  cache: w.cache
                }, e.updateQueue.baseState = c, e.memoizedState = c, e.flags & 256) {
                  e = mu(
                    t,
                    e,
                    d,
                    l
                  );
                  break t;
                } else if (d !== r) {
                  r = G(
                    Error(s(424)),
                    e
                  ), Xa(r), e = mu(
                    t,
                    e,
                    d,
                    l
                  );
                  break t;
                } else
                  for (ue && (Rt = $h(
                    e.stateNode.containerInfo
                  ), le = e, St = !0, Tn = null, Ae = !0), l = Qd(
                    e,
                    null,
                    d,
                    l
                  ), e.child = l; l; )
                    l.flags = l.flags & -3 | 4096, l = l.sibling;
              else {
                if (Be(), d === r) {
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
            if (Ge)
              return li(t, e), t === null ? (l = Md(
                e.type,
                null,
                e.pendingProps,
                null
              )) ? e.memoizedState = l : St || (e.stateNode = Sg(
                e.type,
                e.pendingProps,
                Nn.current,
                e
              )) : e.memoizedState = Md(
                e.type,
                t.memoizedProps,
                e.pendingProps,
                t.memoizedState
              ), null;
          case 27:
            if (Jt)
              return Et(e), t === null && Jt && St && (r = e.stateNode = Bd(
                e.type,
                e.pendingProps,
                Nn.current,
                ae.current,
                !1
              ), le = e, Ae = !0, Rt = tg(
                e.type,
                r,
                Rt
              )), ne(
                t,
                e,
                e.pendingProps.children,
                l
              ), li(t, e), t === null && (e.flags |= 4194304), e.child;
          case 5:
            return t === null && St && (wg(
              e.type,
              e.pendingProps,
              ae.current
            ), (c = r = Rt) && (r = eg(
              r,
              e.type,
              e.pendingProps,
              Ae
            ), r !== null ? (e.stateNode = r, le = e, Rt = Fh(r), Ae = !1, c = !0) : c = !1), c || ht(e)), Et(e), c = e.type, d = e.pendingProps, w = t !== null ? t.memoizedProps : null, r = d.children, gi(c, d) ? r = null : w !== null && gi(c, w) && (e.flags |= 32), e.memoizedState !== null && (c = Rr(
              t,
              e,
              Cp,
              null,
              null,
              l
            ), rn ? ta._currentValue = c : ta._currentValue2 = c), li(t, e), ne(t, e, r, l), e.child;
          case 6:
            return t === null && St && (_g(
              e.pendingProps,
              ae.current
            ), (t = l = Rt) && (l = ng(
              l,
              e.pendingProps,
              Ae
            ), l !== null ? (e.stateNode = l, le = e, Rt = null, t = !0) : t = !1), t || ht(e)), null;
          case 13:
            return pu(t, e, l);
          case 4:
            return ct(
              e,
              e.stateNode.containerInfo
            ), r = e.pendingProps, t === null ? e.child = ia(
              e,
              null,
              r,
              l
            ) : ne(t, e, r, l), e.child;
          case 11:
            return iu(
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
            return ru(
              t,
              e,
              e.type,
              e.pendingProps,
              l
            );
          case 15:
            return ou(
              t,
              e,
              e.type,
              e.pendingProps,
              l
            );
          case 19:
            return gu(
              t,
              e,
              l
            );
          case 31:
            return Bp(t, e, l);
          case 22:
            return su(
              t,
              e,
              l,
              e.pendingProps
            );
          case 24:
            return Xn(e), r = ee(Dt), t === null ? (c = Er(), c === null && (c = At, d = kr(), c.pooledCache = d, d.refCount++, d !== null && (c.pooledCacheLanes |= l), c = d), e.memoizedState = {
              parent: r,
              cache: c
            }, Nr(e), bn(e, Dt, c)) : ((t.lanes & l) !== 0 && (Tr(t, e), $a(e, null, null, l), Fa()), c = t.memoizedState, d = e.memoizedState, c.parent !== r ? (c = { parent: r, cache: r }, e.memoizedState = c, e.lanes === 0 && (e.memoizedState = e.updateQueue.baseState = c), bn(e, Dt, r)) : (r = d.cache, bn(e, Dt, r), r !== c.cache && _r(
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
        throw Error(s(156, e.tag));
      }
      function He(t) {
        t.flags |= 4;
      }
      function ri(t) {
        Xe && (t.flags |= 8);
      }
      function vu(t, e) {
        if (t !== null && t.child === e.child) return !1;
        if ((e.flags & 16) !== 0) return !0;
        for (t = e.child; t !== null; ) {
          if ((t.flags & 8218) !== 0 || (t.subtreeFlags & 8218) !== 0)
            return !0;
          t = t.sibling;
        }
        return !1;
      }
      function ao(t, e, l, r) {
        if (ce)
          for (l = e.child; l !== null; ) {
            if (l.tag === 5 || l.tag === 6)
              Ao(t, l.stateNode);
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
              l && r && (d = Ed(
                d,
                c.type,
                c.memoizedProps
              )), Ao(t, d);
            } else if (c.tag === 6)
              d = c.stateNode, l && r && (d = zd(
                d,
                c.memoizedProps
              )), Ao(t, d);
            else if (c.tag !== 4) {
              if (c.tag === 22 && c.memoizedState !== null)
                d = c.child, d !== null && (d.return = c), ao(t, c, !0, !0);
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
      function yu(t, e, l, r) {
        var c = !1;
        if (Xe)
          for (var d = e.child; d !== null; ) {
            if (d.tag === 5) {
              var w = d.stateNode;
              l && r && (w = Ed(
                w,
                d.type,
                d.memoizedProps
              )), kd(t, w);
            } else if (d.tag === 6)
              w = d.stateNode, l && r && (w = zd(
                w,
                d.memoizedProps
              )), kd(t, w);
            else if (d.tag !== 4) {
              if (d.tag === 22 && d.memoizedState !== null)
                c = d.child, c !== null && (c.return = d), yu(t, d, !0, !0), c = !0;
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
      function xu(t, e) {
        if (Xe && vu(t, e)) {
          t = e.stateNode;
          var l = t.containerInfo, r = _d();
          yu(r, e, !1, !1), t.pendingChildren = r, He(e), Qh(l, r);
        }
      }
      function lo(t, e, l, r) {
        if (ce)
          t.memoizedProps !== r && He(e);
        else if (Xe) {
          var c = t.stateNode, d = t.memoizedProps;
          if ((t = vu(t, e)) || d !== r) {
            var w = ae.current;
            d = Vh(
              c,
              l,
              d,
              r,
              !t,
              null
            ), d === c ? e.stateNode = c : (ri(e), bd(
              d,
              l,
              r,
              w
            ) && He(e), e.stateNode = d, t && ao(d, e, !1, !1));
          } else e.stateNode = c;
        }
      }
      function io(t, e, l, r, c) {
        if ((t.mode & 32) !== 0 && (l === null ? gh(e, r) : bh(e, l, r))) {
          if (t.flags |= 16777216, (c & 335544128) === c || jo(e, r))
            if (yd(t.stateNode, e, r))
              t.flags |= 8192;
            else if (Xu()) t.flags |= 8192;
            else
              throw la = Ni, Ko;
        } else t.flags &= -16777217;
      }
      function wu(t, e) {
        if (zg(e)) {
          if (t.flags |= 16777216, !Dd(e))
            if (Xu()) t.flags |= 8192;
            else
              throw la = Ni, Ko;
        } else t.flags &= -16777217;
      }
      function oi(t, e) {
        e !== null && (t.flags |= 4), t.flags & 16384 && (e = t.tag !== 22 ? F() : 536870912, t.lanes |= e, Ua |= e);
      }
      function el(t, e) {
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
      function Up(t, e, l) {
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
            return l = e.stateNode, r = null, t !== null && (r = t.memoizedState.cache), e.memoizedState.cache !== r && (e.flags |= 2048), Pe(Dt), ut(), l.pendingContext && (l.context = l.pendingContext, l.pendingContext = null), (t === null || t.child === null) && (De(e) ? He(e) : t === null || t.memoizedState.isDehydrated && (e.flags & 256) === 0 || (e.flags |= 1024, gn())), xu(t, e), Ot(e), null;
          case 26:
            if (Ge) {
              var c = e.type, d = e.memoizedState;
              return t === null ? (He(e), d !== null ? (Ot(e), wu(
                e,
                d
              )) : (Ot(e), io(
                e,
                c,
                null,
                r,
                l
              ))) : d ? d !== t.memoizedState ? (He(e), Ot(e), wu(
                e,
                d
              )) : (Ot(e), e.flags &= -16777217) : (d = t.memoizedProps, ce ? d !== r && He(e) : lo(
                t,
                e,
                c,
                r
              ), Ot(e), io(
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
                ce ? t.memoizedProps !== r && He(e) : lo(t, e, c, r);
              else {
                if (!r) {
                  if (e.stateNode === null)
                    throw Error(s(166));
                  return Ot(e), null;
                }
                t = ae.current, De(e) ? Qn(e, t) : (t = Bd(
                  c,
                  r,
                  l,
                  t,
                  !0
                ), e.stateNode = t, He(e));
              }
              return Ot(e), null;
            }
          case 5:
            if ($t(e), c = e.type, t !== null && e.stateNode != null)
              lo(t, e, c, r);
            else {
              if (!r) {
                if (e.stateNode === null)
                  throw Error(s(166));
                return Ot(e), null;
              }
              if (d = ae.current, De(e))
                Qn(e, d), hg(
                  e.stateNode,
                  c,
                  r,
                  d
                ) && (e.flags |= 64);
              else {
                var w = sh(
                  c,
                  r,
                  Nn.current,
                  d,
                  e
                );
                ri(e), ao(w, e, !1, !1), e.stateNode = w, bd(
                  w,
                  c,
                  r,
                  d
                ) && He(e);
              }
            }
            return Ot(e), io(
              e,
              e.type,
              t === null ? null : t.memoizedProps,
              e.pendingProps,
              l
            ), null;
          case 6:
            if (t && e.stateNode != null)
              l = t.memoizedProps, ce ? l !== r && He(e) : Xe && (l !== r ? (t = Nn.current, l = ae.current, ri(e), e.stateNode = vd(
                r,
                t,
                l,
                e
              )) : e.stateNode = t.stateNode);
            else {
              if (typeof r != "string" && e.stateNode === null)
                throw Error(s(166));
              if (t = Nn.current, l = ae.current, De(e)) {
                if (!ue) throw Error(s(176));
                if (t = e.stateNode, l = e.memoizedProps, r = null, c = le, c !== null)
                  switch (c.tag) {
                    case 27:
                    case 5:
                      r = c.memoizedProps;
                  }
                rg(
                  t,
                  l,
                  e,
                  r
                ) || ht(e, !0);
              } else
                ri(e), e.stateNode = vd(
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
                  if (!r) throw Error(s(318));
                  if (!ue) throw Error(s(556));
                  if (t = e.memoizedState, t = t !== null ? t.dehydrated : null, !t) throw Error(s(557));
                  og(t, e);
                } else
                  Be(), (e.flags & 128) === 0 && (e.memoizedState = null), e.flags |= 4;
                Ot(e), t = !1;
              } else
                l = gn(), t !== null && t.memoizedState !== null && (t.memoizedState.hydrationErrors = l), t = !0;
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
                  sg(c, e);
                } else
                  Be(), (e.flags & 128) === 0 && (e.memoizedState = null), e.flags |= 4;
                Ot(e), c = !1;
              } else
                c = gn(), t !== null && t.memoizedState !== null && (t.memoizedState.hydrationErrors = c), c = !0;
              if (!c)
                return e.flags & 256 ? (ye(e), e) : (ye(e), null);
            }
            return ye(e), (e.flags & 128) !== 0 ? (e.lanes = l, e) : (l = r !== null, t = t !== null && t.memoizedState !== null, l && (r = e.child, c = null, r.alternate !== null && r.alternate.memoizedState !== null && r.alternate.memoizedState.cachePool !== null && (c = r.alternate.memoizedState.cachePool.pool), d = null, r.memoizedState !== null && r.memoizedState.cachePool !== null && (d = r.memoizedState.cachePool.pool), d !== c && (r.flags |= 2048)), l !== t && l && (e.child.flags |= 8192), oi(e, e.updateQueue), Ot(e), null);
          case 4:
            return ut(), xu(t, e), t === null && fh(e.stateNode.containerInfo), Ot(e), null;
          case 10:
            return Pe(e.type), Ot(e), null;
          case 19:
            if (S(Yt), r = e.memoizedState, r === null) return Ot(e), null;
            if (c = (e.flags & 128) !== 0, d = r.rendering, d === null)
              if (c) el(r, !1);
              else {
                if (qt !== 0 || t !== null && (t.flags & 128) !== 0)
                  for (t = e.child; t !== null; ) {
                    if (d = Wl(t), d !== null) {
                      for (e.flags |= 128, el(r, !1), t = d.updateQueue, e.updateQueue = t, oi(e, t), e.subtreeFlags = 0, t = l, l = e.child; l !== null; )
                        rd(l, t), l = l.sibling;
                      return T(
                        Yt,
                        Yt.current & 1 | 2
                      ), St && K(e, r.treeForkCount), e.child;
                    }
                    t = t.sibling;
                  }
                r.tail !== null && ge() > yl && (e.flags |= 128, c = !0, el(r, !1), e.lanes = 4194304);
              }
            else {
              if (!c)
                if (t = Wl(d), t !== null) {
                  if (e.flags |= 128, c = !0, t = t.updateQueue, e.updateQueue = t, oi(e, t), el(r, !0), r.tail === null && r.tailMode === "hidden" && !d.alternate && !St)
                    return Ot(e), null;
                } else
                  2 * ge() - r.renderingStartTime > yl && l !== 536870912 && (e.flags |= 128, c = !0, el(r, !1), e.lanes = 4194304);
              r.isBackwards ? (d.sibling = e.child, e.child = d) : (t = r.last, t !== null ? t.sibling = d : e.child = d, r.last = d);
            }
            return r.tail !== null ? (t = r.tail, r.rendering = t, r.tail = t.sibling, r.renderingStartTime = ge(), t.sibling = null, l = Yt.current, T(
              Yt,
              c ? l & 1 | 2 : l & 1
            ), St && K(e, r.treeForkCount), t) : (Ot(e), null);
          case 22:
          case 23:
            return ye(e), Ar(), r = e.memoizedState !== null, t !== null ? t.memoizedState !== null !== r && (e.flags |= 8192) : r && (e.flags |= 8192), r ? (l & 536870912) !== 0 && (e.flags & 128) === 0 && (Ot(e), e.subtreeFlags & 6 && (e.flags |= 8192)) : Ot(e), l = e.updateQueue, l !== null && oi(e, l.retryQueue), l = null, t !== null && t.memoizedState !== null && t.memoizedState.cachePool !== null && (l = t.memoizedState.cachePool.pool), r = null, e.memoizedState !== null && e.memoizedState.cachePool !== null && (r = e.memoizedState.cachePool.pool), r !== l && (e.flags |= 2048), t !== null && S(aa), null;
          case 24:
            return l = null, t !== null && (l = t.memoizedState.cache), e.memoizedState.cache !== l && (e.flags |= 2048), Pe(Dt), Ot(e), null;
          case 25:
            return null;
          case 30:
            return null;
        }
        throw Error(s(156, e.tag));
      }
      function qp(t, e) {
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
              Be();
            }
            return t = e.flags, t & 65536 ? (e.flags = t & -65537 | 128, e) : null;
          case 13:
            if (ye(e), t = e.memoizedState, t !== null && t.dehydrated !== null) {
              if (e.alternate === null)
                throw Error(s(340));
              Be();
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
            return ye(e), Ar(), t !== null && S(aa), t = e.flags, t & 65536 ? (e.flags = t & -65537 | 128, e) : null;
          case 24:
            return Pe(Dt), null;
          case 25:
            return null;
          default:
            return null;
        }
      }
      function _u(t, e) {
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
            ye(e), Ar(), t !== null && S(aa);
            break;
          case 24:
            Pe(Dt);
        }
      }
      function nl(t, e) {
        try {
          var l = e.updateQueue, r = l !== null ? l.lastEffect : null;
          if (r !== null) {
            var c = r.next;
            l = c;
            do {
              if ((l.tag & t) === t) {
                r = void 0;
                var d = l.create, w = l.inst;
                r = d(), w.destroy = r;
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
                var w = r.inst, A = w.destroy;
                if (A !== void 0) {
                  w.destroy = void 0, c = e;
                  var V = l, $ = A;
                  try {
                    $();
                  } catch (nt) {
                    zt(
                      c,
                      V,
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
      function ku(t) {
        var e = t.updateQueue;
        if (e !== null) {
          var l = t.stateNode;
          try {
            gc(e, l);
          } catch (r) {
            zt(t, t.return, r);
          }
        }
      }
      function Su(t, e, l) {
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
      function al(t, e) {
        try {
          var l = t.ref;
          if (l !== null) {
            switch (t.tag) {
              case 26:
              case 27:
              case 5:
                var r = ol(t.stateNode);
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
      function Eu(t) {
        var e = t.type, l = t.memoizedProps, r = t.stateNode;
        try {
          jh(r, e, l, t);
        } catch (c) {
          zt(t, t.return, c);
        }
      }
      function ro(t, e, l) {
        try {
          Oh(
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
      function zu(t) {
        return t.tag === 5 || t.tag === 3 || (Ge ? t.tag === 26 : !1) || (Jt ? t.tag === 27 && _a(t.type) : !1) || t.tag === 4;
      }
      function oo(t) {
        t: for (; ; ) {
          for (; t.sibling === null; ) {
            if (t.return === null || zu(t.return)) return null;
            t = t.return;
          }
          for (t.sibling.return = t.return, t = t.sibling; t.tag !== 5 && t.tag !== 6 && t.tag !== 18; ) {
            if (Jt && t.tag === 27 && _a(t.type) || t.flags & 2 || t.child === null || t.tag === 4) continue t;
            t.child.return = t, t = t.child;
          }
          if (!(t.flags & 2)) return t.stateNode;
        }
      }
      function so(t, e, l) {
        var r = t.tag;
        if (r === 5 || r === 6)
          t = t.stateNode, e ? Dh(l, t, e) : Mh(l, t);
        else if (r !== 4 && (Jt && r === 27 && _a(t.type) && (l = t.stateNode, e = null), t = t.child, t !== null))
          for (so(t, e, l), t = t.sibling; t !== null; )
            so(t, e, l), t = t.sibling;
      }
      function si(t, e, l) {
        var r = t.tag;
        if (r === 5 || r === 6)
          t = t.stateNode, e ? Rh(l, t, e) : Ch(l, t);
        else if (r !== 4 && (Jt && r === 27 && _a(t.type) && (l = t.stateNode), t = t.child, t !== null))
          for (si(t, e, l), t = t.sibling; t !== null; )
            si(t, e, l), t = t.sibling;
      }
      function Nu(t, e, l) {
        t = t.containerInfo;
        try {
          Sd(t, l);
        } catch (r) {
          zt(e, e.return, r);
        }
      }
      function Tu(t) {
        var e = t.stateNode, l = t.memoizedProps;
        try {
          Tg(
            t.type,
            l,
            e,
            t
          );
        } catch (r) {
          zt(t, t.return, r);
        }
      }
      function Gp(t, e) {
        for (rh(t.containerInfo), Pt = e; Pt !== null; )
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
                      var w = Wn(
                        r.type,
                        c
                      );
                      e = d.getSnapshotBeforeUpdate(
                        w,
                        l
                      ), d.__reactInternalSnapshotBeforeUpdate = e;
                    } catch (A) {
                      zt(r, r.return, A);
                    }
                  }
                  break;
                case 3:
                  (e & 1024) !== 0 && ce && Lh(t.stateNode.containerInfo);
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
      function Cu(t, e, l) {
        var r = l.flags;
        switch (l.tag) {
          case 0:
          case 11:
          case 15:
            nn(t, l), r & 4 && nl(5, l);
            break;
          case 1:
            if (nn(t, l), r & 4)
              if (t = l.stateNode, e === null)
                try {
                  t.componentDidMount();
                } catch (w) {
                  zt(l, l.return, w);
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
                } catch (w) {
                  zt(
                    l,
                    l.return,
                    w
                  );
                }
              }
            r & 64 && ku(l), r & 512 && al(l, l.return);
            break;
          case 3:
            if (nn(t, l), r & 64 && (r = l.updateQueue, r !== null)) {
              if (t = null, l.child !== null)
                switch (l.child.tag) {
                  case 27:
                  case 5:
                    t = ol(l.child.stateNode);
                    break;
                  case 1:
                    t = l.child.stateNode;
                }
              try {
                gc(r, t);
              } catch (w) {
                zt(l, l.return, w);
              }
            }
            break;
          case 27:
            Jt && e === null && r & 4 && Tu(l);
          case 26:
          case 5:
            if (nn(t, l), e === null) {
              if (r & 4) Eu(l);
              else if (r & 64) {
                t = l.type, e = l.memoizedProps, c = l.stateNode;
                try {
                  dg(
                    c,
                    t,
                    e,
                    l
                  );
                } catch (w) {
                  zt(l, l.return, w);
                }
              }
            }
            r & 512 && al(l, l.return);
            break;
          case 12:
            nn(t, l);
            break;
          case 31:
            nn(t, l), r & 4 && Au(t, l);
            break;
          case 13:
            nn(t, l), r & 4 && ju(t, l), r & 64 && (r = l.memoizedState, r !== null && (r = r.dehydrated, r !== null && (l = Zp.bind(
              null,
              l
            ), Xh(r, l))));
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
      function Mu(t) {
        var e = t.alternate;
        e !== null && (t.alternate = null, Mu(e)), t.child = null, t.deletions = null, t.sibling = null, t.tag === 5 && (e = t.stateNode, e !== null && hh(e)), t.stateNode = null, t.return = null, t.dependencies = null, t.memoizedProps = null, t.memoizedState = null, t.pendingProps = null, t.stateNode = null, t.updateQueue = null;
      }
      function Ue(t, e, l) {
        for (l = l.child; l !== null; )
          co(
            t,
            e,
            l
          ), l = l.sibling;
      }
      function co(t, e, l) {
        if (ke && typeof ke.onCommitFiberUnmount == "function")
          try {
            ke.onCommitFiberUnmount(ul, l);
          } catch {
          }
        switch (l.tag) {
          case 26:
            if (Ge) {
              Kt || Ke(l, e), Ue(
                t,
                e,
                l
              ), l.memoizedState ? jd(l.memoizedState) : l.stateNode && Rd(l.stateNode);
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
              ), Hd(l.stateNode), Xt = r, be = c;
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
                    Hh(Xt, l.stateNode);
                  } catch (d) {
                    zt(
                      l,
                      e,
                      d
                    );
                  }
                else
                  try {
                    Bh(Xt, l.stateNode);
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
            ce && Xt !== null && (be ? vg(
              Xt,
              l.stateNode
            ) : bg(Xt, l.stateNode));
            break;
          case 4:
            ce ? (r = Xt, c = be, Xt = l.stateNode.containerInfo, be = !0, Ue(
              t,
              e,
              l
            ), Xt = r, be = c) : (Xe && Nu(
              l.stateNode,
              l,
              _d()
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
            Kt || (Ke(l, e), r = l.stateNode, typeof r.componentWillUnmount == "function" && Su(
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
      function Au(t, e) {
        if (ue && e.memoizedState === null && (t = e.alternate, t !== null && (t = t.memoizedState, t !== null))) {
          t = t.dehydrated;
          try {
            mg(t);
          } catch (l) {
            zt(e, e.return, l);
          }
        }
      }
      function ju(t, e) {
        if (ue && e.memoizedState === null && (t = e.alternate, t !== null && (t = t.memoizedState, t !== null && (t = t.dehydrated, t !== null))))
          try {
            pg(t);
          } catch (l) {
            zt(e, e.return, l);
          }
      }
      function Yp(t) {
        switch (t.tag) {
          case 31:
          case 13:
          case 19:
            var e = t.stateNode;
            return e === null && (e = t.stateNode = new Zd()), e;
          case 22:
            return t = t.stateNode, e = t._retryCache, e === null && (e = t._retryCache = new Zd()), e;
          default:
            throw Error(s(435, t.tag));
        }
      }
      function ci(t, e) {
        var l = Yp(t);
        e.forEach(function(r) {
          if (!l.has(r)) {
            l.add(r);
            var c = Jp.bind(null, t, r);
            r.then(c, c);
          }
        });
      }
      function se(t, e) {
        var l = e.deletions;
        if (l !== null)
          for (var r = 0; r < l.length; r++) {
            var c = l[r], d = t, w = e;
            if (ce) {
              var A = w;
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
              if (Xt === null) throw Error(s(160));
              co(d, w, c), Xt = null, be = !1;
            } else co(d, w, c);
            d = c.alternate, d !== null && (d.return = null), c.return = null;
          }
        if (e.subtreeFlags & 13886)
          for (e = e.child; e !== null; )
            Ou(e, t), e = e.sibling;
      }
      function Ou(t, e) {
        var l = t.alternate, r = t.flags;
        switch (t.tag) {
          case 0:
          case 11:
          case 14:
          case 15:
            se(e, t), me(t), r & 4 && (_n(3, t, t.return), nl(3, t), _n(5, t, t.return));
            break;
          case 1:
            se(e, t), me(t), r & 512 && (Kt || l === null || Ke(l, l.return)), r & 64 && un && (t = t.updateQueue, t !== null && (r = t.callbacks, r !== null && (l = t.shared.hiddenCallbacks, t.shared.hiddenCallbacks = l === null ? r : l.concat(r))));
            break;
          case 26:
            if (Ge) {
              var c = Ye;
              if (se(e, t), me(t), r & 512 && (Kt || l === null || Ke(l, l.return)), r & 4) {
                r = l !== null ? l.memoizedState : null;
                var d = t.memoizedState;
                l === null ? d === null ? t.stateNode === null ? t.stateNode = kg(
                  c,
                  t.type,
                  t.memoizedProps,
                  t
                ) : Od(
                  c,
                  t.type,
                  t.stateNode
                ) : t.stateNode = Ad(
                  c,
                  d,
                  t.memoizedProps
                ) : r !== d ? (r === null ? l.stateNode !== null && Rd(l.stateNode) : jd(r), d === null ? Od(
                  c,
                  t.type,
                  t.stateNode
                ) : Ad(
                  c,
                  d,
                  t.memoizedProps
                )) : d === null && t.stateNode !== null && ro(
                  t,
                  t.memoizedProps,
                  l.memoizedProps
                );
              }
              break;
            }
          case 27:
            if (Jt) {
              se(e, t), me(t), r & 512 && (Kt || l === null || Ke(l, l.return)), l !== null && r & 4 && ro(
                t,
                t.memoizedProps,
                l.memoizedProps
              );
              break;
            }
          case 5:
            if (se(e, t), me(t), r & 512 && (Kt || l === null || Ke(l, l.return)), ce) {
              if (t.flags & 32) {
                c = t.stateNode;
                try {
                  wd(c);
                } catch (P) {
                  zt(t, t.return, P);
                }
              }
              r & 4 && t.stateNode != null && (c = t.memoizedProps, ro(
                t,
                c,
                l !== null ? l.memoizedProps : c
              )), r & 1024 && (Io = !0);
            } else
              Xe && t.alternate !== null && (t.alternate.stateNode = t.stateNode);
            break;
          case 6:
            if (se(e, t), me(t), r & 4 && ce) {
              if (t.stateNode === null)
                throw Error(s(162));
              r = t.memoizedProps, l = l !== null ? l.memoizedProps : r, c = t.stateNode;
              try {
                Ah(c, l, r);
              } catch (P) {
                zt(t, t.return, P);
              }
            }
            break;
          case 3:
            if (Ge ? (Eg(), c = Ye, Ye = Do(e.containerInfo), se(e, t), Ye = c) : se(e, t), me(t), r & 4) {
              if (ce && ue && l !== null && l.memoizedState.isDehydrated)
                try {
                  fg(e.containerInfo);
                } catch (P) {
                  zt(t, t.return, P);
                }
              if (Xe) {
                r = e.containerInfo, l = e.pendingChildren;
                try {
                  Sd(r, l);
                } catch (P) {
                  zt(t, t.return, P);
                }
              }
            }
            Io && (Io = !1, Ru(t));
            break;
          case 4:
            Ge ? (l = Ye, Ye = Do(
              t.stateNode.containerInfo
            ), se(e, t), me(t), Ye = l) : (se(e, t), me(t)), r & 4 && Xe && Nu(
              t.stateNode,
              t,
              t.stateNode.pendingChildren
            );
            break;
          case 12:
            se(e, t), me(t);
            break;
          case 31:
            se(e, t), me(t), r & 4 && (r = t.updateQueue, r !== null && (t.updateQueue = null, ci(t, r)));
            break;
          case 13:
            se(e, t), me(t), t.child.flags & 8192 && t.memoizedState !== null != (l !== null && l.memoizedState !== null) && (Bi = ge()), r & 4 && (r = t.updateQueue, r !== null && (t.updateQueue = null, ci(t, r)));
            break;
          case 22:
            c = t.memoizedState !== null;
            var w = l !== null && l.memoizedState !== null, A = un, V = Kt;
            if (un = A || c, Kt = V || w, se(e, t), Kt = V, un = A, me(t), r & 8192 && (e = t.stateNode, e._visibility = c ? e._visibility & -2 : e._visibility | 1, c && (l === null || w || un || Kt || Fn(t)), ce)) {
              t: if (l = null, ce)
                for (e = t; ; ) {
                  if (e.tag === 5 || Ge && e.tag === 26) {
                    if (l === null) {
                      w = l = e;
                      try {
                        d = w.stateNode, c ? Uh(d) : Gh(
                          w.stateNode,
                          w.memoizedProps
                        );
                      } catch (P) {
                        zt(w, w.return, P);
                      }
                    }
                  } else if (e.tag === 6) {
                    if (l === null) {
                      w = e;
                      try {
                        var $ = w.stateNode;
                        c ? qh($) : Yh($, w.memoizedProps);
                      } catch (P) {
                        zt(w, w.return, P);
                      }
                    }
                  } else if (e.tag === 18) {
                    if (l === null) {
                      w = e;
                      try {
                        var nt = w.stateNode;
                        c ? yg(nt) : xg(w.stateNode);
                      } catch (P) {
                        zt(w, w.return, P);
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
            r & 4 && (r = t.updateQueue, r !== null && (l = r.retryQueue, l !== null && (r.retryQueue = null, ci(t, l))));
            break;
          case 19:
            se(e, t), me(t), r & 4 && (r = t.updateQueue, r !== null && (t.updateQueue = null, ci(t, r)));
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
            for (var l, r = t.return; r !== null; ) {
              if (zu(r)) {
                l = r;
                break;
              }
              r = r.return;
            }
            if (ce) {
              if (l == null) throw Error(s(160));
              switch (l.tag) {
                case 27:
                  if (Jt) {
                    var c = l.stateNode, d = oo(t);
                    si(t, d, c);
                    break;
                  }
                case 5:
                  var w = l.stateNode;
                  l.flags & 32 && (wd(w), l.flags &= -33);
                  var A = oo(t);
                  si(t, A, w);
                  break;
                case 3:
                case 4:
                  var V = l.stateNode.containerInfo, $ = oo(t);
                  so(
                    t,
                    $,
                    V
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
      function Ru(t) {
        if (t.subtreeFlags & 1024)
          for (t = t.child; t !== null; ) {
            var e = t;
            Ru(e), e.tag === 5 && e.flags & 1024 && xh(e.stateNode), t = t.sibling;
          }
      }
      function nn(t, e) {
        if (e.subtreeFlags & 8772)
          for (e = e.child; e !== null; )
            Cu(t, e.alternate, e), e = e.sibling;
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
              typeof l.componentWillUnmount == "function" && Su(
                e,
                e.return,
                l
              ), Fn(e);
              break;
            case 27:
              Jt && Hd(e.stateNode);
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
          var r = e.alternate, c = t, d = e, w = d.flags;
          switch (d.tag) {
            case 0:
            case 11:
            case 15:
              an(
                c,
                d,
                l
              ), nl(4, d);
              break;
            case 1:
              if (an(
                c,
                d,
                l
              ), r = d, c = r.stateNode, typeof c.componentDidMount == "function")
                try {
                  c.componentDidMount();
                } catch ($) {
                  zt(r, r.return, $);
                }
              if (r = d, c = r.updateQueue, c !== null) {
                var A = r.stateNode;
                try {
                  var V = c.shared.hiddenCallbacks;
                  if (V !== null)
                    for (c.shared.hiddenCallbacks = null, c = 0; c < V.length; c++)
                      hc(V[c], A);
                } catch ($) {
                  zt(r, r.return, $);
                }
              }
              l && w & 64 && ku(d), al(d, d.return);
              break;
            case 27:
              Jt && Tu(d);
            case 26:
            case 5:
              an(
                c,
                d,
                l
              ), l && r === null && w & 4 && Eu(d), al(d, d.return);
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
              ), l && w & 4 && Au(c, d);
              break;
            case 13:
              an(
                c,
                d,
                l
              ), l && w & 4 && ju(c, d);
              break;
            case 22:
              d.memoizedState === null && an(
                c,
                d,
                l
              ), al(d, d.return);
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
      function uo(t, e) {
        var l = null;
        t !== null && t.memoizedState !== null && t.memoizedState.cachePool !== null && (l = t.memoizedState.cachePool.pool), t = null, e.memoizedState !== null && e.memoizedState.cachePool !== null && (t = e.memoizedState.cachePool.pool), t !== l && (t != null && t.refCount++, l != null && Za(l));
      }
      function fo(t, e) {
        t = null, e.alternate !== null && (t = e.alternate.memoizedState.cache), e = e.memoizedState.cache, e !== t && (e.refCount++, t != null && Za(t));
      }
      function qe(t, e, l, r) {
        if (e.subtreeFlags & 10256)
          for (e = e.child; e !== null; )
            Du(
              t,
              e,
              l,
              r
            ), e = e.sibling;
      }
      function Du(t, e, l, r) {
        var c = e.flags;
        switch (e.tag) {
          case 0:
          case 11:
          case 15:
            qe(
              t,
              e,
              l,
              r
            ), c & 2048 && nl(9, e);
            break;
          case 1:
            qe(
              t,
              e,
              l,
              r
            );
            break;
          case 3:
            qe(
              t,
              e,
              l,
              r
            ), c & 2048 && (t = null, e.alternate !== null && (t = e.alternate.memoizedState.cache), e = e.memoizedState.cache, e !== t && (e.refCount++, t != null && Za(t)));
            break;
          case 12:
            if (c & 2048) {
              qe(
                t,
                e,
                l,
                r
              ), t = e.stateNode;
              try {
                var d = e.memoizedProps, w = d.id, A = d.onPostCommit;
                typeof A == "function" && A(
                  w,
                  e.alternate === null ? "mount" : "update",
                  t.passiveEffectDuration,
                  -0
                );
              } catch (V) {
                zt(e, e.return, V);
              }
            } else
              qe(
                t,
                e,
                l,
                r
              );
            break;
          case 31:
            qe(
              t,
              e,
              l,
              r
            );
            break;
          case 13:
            qe(
              t,
              e,
              l,
              r
            );
            break;
          case 23:
            break;
          case 22:
            d = e.stateNode, w = e.alternate, e.memoizedState !== null ? d._visibility & 2 ? qe(
              t,
              e,
              l,
              r
            ) : ll(
              t,
              e
            ) : d._visibility & 2 ? qe(
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
            )), c & 2048 && uo(w, e);
            break;
          case 24:
            qe(
              t,
              e,
              l,
              r
            ), c & 2048 && fo(e.alternate, e);
            break;
          default:
            qe(
              t,
              e,
              l,
              r
            );
        }
      }
      function ga(t, e, l, r, c) {
        for (c = c && ((e.subtreeFlags & 10256) !== 0 || !1), e = e.child; e !== null; ) {
          var d = t, w = e, A = l, V = r, $ = w.flags;
          switch (w.tag) {
            case 0:
            case 11:
            case 15:
              ga(
                d,
                w,
                A,
                V,
                c
              ), nl(8, w);
              break;
            case 23:
              break;
            case 22:
              var nt = w.stateNode;
              w.memoizedState !== null ? nt._visibility & 2 ? ga(
                d,
                w,
                A,
                V,
                c
              ) : ll(
                d,
                w
              ) : (nt._visibility |= 2, ga(
                d,
                w,
                A,
                V,
                c
              )), c && $ & 2048 && uo(
                w.alternate,
                w
              );
              break;
            case 24:
              ga(
                d,
                w,
                A,
                V,
                c
              ), c && $ & 2048 && fo(w.alternate, w);
              break;
            default:
              ga(
                d,
                w,
                A,
                V,
                c
              );
          }
          e = e.sibling;
        }
      }
      function ll(t, e) {
        if (e.subtreeFlags & 10256)
          for (e = e.child; e !== null; ) {
            var l = t, r = e, c = r.flags;
            switch (r.tag) {
              case 22:
                ll(l, r), c & 2048 && uo(
                  r.alternate,
                  r
                );
                break;
              case 24:
                ll(l, r), c & 2048 && fo(
                  r.alternate,
                  r
                );
                break;
              default:
                ll(l, r);
            }
            e = e.sibling;
          }
      }
      function $n(t, e, l) {
        if (t.subtreeFlags & Ba)
          for (t = t.child; t !== null; )
            Bu(
              t,
              e,
              l
            ), t = t.sibling;
      }
      function Bu(t, e, l) {
        switch (t.tag) {
          case 26:
            if ($n(
              t,
              e,
              l
            ), t.flags & Ba)
              if (t.memoizedState !== null)
                Ng(
                  l,
                  Ye,
                  t.memoizedState,
                  t.memoizedProps
                );
              else {
                var r = t.stateNode, c = t.type;
                t = t.memoizedProps, ((e & 335544128) === e || jo(c, t)) && xd(l, r, c, t);
              }
            break;
          case 5:
            $n(
              t,
              e,
              l
            ), t.flags & Ba && (r = t.stateNode, c = t.type, t = t.memoizedProps, ((e & 335544128) === e || jo(c, t)) && xd(l, r, c, t));
            break;
          case 3:
          case 4:
            Ge ? (r = Ye, Ye = Do(
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
            t.memoizedState === null && (r = t.alternate, r !== null && r.memoizedState !== null ? (r = Ba, Ba = 16777216, $n(
              t,
              e,
              l
            ), Ba = r) : $n(
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
      function Hu(t) {
        var e = t.alternate;
        if (e !== null && (t = e.child, t !== null)) {
          e.child = null;
          do
            e = t.sibling, t.sibling = null, t = e;
          while (t !== null);
        }
      }
      function il(t) {
        var e = t.deletions;
        if ((t.flags & 16) !== 0) {
          if (e !== null)
            for (var l = 0; l < e.length; l++) {
              var r = e[l];
              Pt = r, qu(
                r,
                t
              );
            }
          Hu(t);
        }
        if (t.subtreeFlags & 10256)
          for (t = t.child; t !== null; )
            Uu(t), t = t.sibling;
      }
      function Uu(t) {
        switch (t.tag) {
          case 0:
          case 11:
          case 15:
            il(t), t.flags & 2048 && _n(9, t, t.return);
            break;
          case 3:
            il(t);
            break;
          case 12:
            il(t);
            break;
          case 22:
            var e = t.stateNode;
            t.memoizedState !== null && e._visibility & 2 && (t.return === null || t.return.tag !== 13) ? (e._visibility &= -3, ui(t)) : il(t);
            break;
          default:
            il(t);
        }
      }
      function ui(t) {
        var e = t.deletions;
        if ((t.flags & 16) !== 0) {
          if (e !== null)
            for (var l = 0; l < e.length; l++) {
              var r = e[l];
              Pt = r, qu(
                r,
                t
              );
            }
          Hu(t);
        }
        for (t = t.child; t !== null; ) {
          switch (e = t, e.tag) {
            case 0:
            case 11:
            case 15:
              _n(8, e, e.return), ui(e);
              break;
            case 22:
              l = e.stateNode, l._visibility & 2 && (l._visibility &= -3, ui(e));
              break;
            default:
              ui(e);
          }
          t = t.sibling;
        }
      }
      function qu(t, e) {
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
              Za(l.memoizedState.cache);
          }
          if (r = l.child, r !== null) r.return = l, Pt = r;
          else
            t: for (l = t; Pt !== null; ) {
              r = Pt;
              var c = r.sibling, d = r.return;
              if (Mu(r), r === l) {
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
      function mo(t) {
        var e = dh(t);
        if (e != null) {
          if (typeof e.memoizedProps["data-testname"] != "string")
            throw Error(s(364));
          return e;
        }
        if (t = kh(t), t === null) throw Error(s(362));
        return t.stateNode.current;
      }
      function po(t, e) {
        var l = t.tag;
        switch (e.$$typeof) {
          case Ai:
            if (t.type === e.value) return !0;
            break;
          case ji:
            t: {
              for (e = e.value, t = [t, 0], l = 0; l < t.length; ) {
                var r = t[l++], c = r.tag, d = t[l++], w = e[d];
                if (c !== 5 && c !== 26 && c !== 27 || !cl(r)) {
                  for (; w != null && po(r, w); )
                    d++, w = e[d];
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
          case Oi:
            if ((l === 5 || l === 26 || l === 27) && zh(t.stateNode, e.value))
              return !0;
            break;
          case Di:
            if ((l === 5 || l === 6 || l === 26 || l === 27) && (t = Eh(t), t !== null && 0 <= t.indexOf(e.value)))
              return !0;
            break;
          case Ri:
            if ((l === 5 || l === 26 || l === 27) && (t = t.memoizedProps["data-testname"], typeof t == "string" && t.toLowerCase() === e.value.toLowerCase()))
              return !0;
            break;
          default:
            throw Error(s(365));
        }
        return !1;
      }
      function ho(t) {
        switch (t.$$typeof) {
          case Ai:
            return "<" + (y(t.value) || "Unknown") + ">";
          case ji:
            return ":has(" + (ho(t) || "") + ")";
          case Oi:
            return '[role="' + t.value + '"]';
          case Di:
            return '"' + t.value + '"';
          case Ri:
            return '[data-testname="' + t.value + '"]';
          default:
            throw Error(s(365));
        }
      }
      function Gu(t, e) {
        var l = [];
        t = [t, 0];
        for (var r = 0; r < t.length; ) {
          var c = t[r++], d = c.tag, w = t[r++], A = e[w];
          if (d !== 5 && d !== 26 && d !== 27 || !cl(c)) {
            for (; A != null && po(c, A); )
              w++, A = e[w];
            if (w === e.length) l.push(c);
            else
              for (c = c.child; c !== null; )
                t.push(c, w), c = c.sibling;
          }
        }
        return l;
      }
      function go(t, e) {
        if (!sl) throw Error(s(363));
        t = mo(t), t = Gu(t, e), e = [], t = Array.from(t);
        for (var l = 0; l < t.length; ) {
          var r = t[l++], c = r.tag;
          if (c === 5 || c === 26 || c === 27)
            cl(r) || e.push(r.stateNode);
          else
            for (r = r.child; r !== null; )
              t.push(r), r = r.sibling;
        }
        return e;
      }
      function xe() {
        return (wt & 2) !== 0 && kt !== 0 ? kt & -kt : dt.T !== null ? Sr() : mh();
      }
      function Yu() {
        if (Ne === 0)
          if ((kt & 536870912) === 0 || St) {
            var t = vi;
            vi <<= 1, (vi & 3932160) === 0 && (vi = 262144), Ne = t;
          } else Ne = 536870912;
        return t = Ee.current, t !== null && (t.flags |= 32), Ne;
      }
      function he(t, e, l) {
        (t === At && (Ct === 2 || Ct === 9) || t.cancelPendingCommit !== null) && (ba(t, 0), kn(
          t,
          kt,
          Ne,
          !1
        )), B(t, l), ((wt & 2) === 0 || t !== At) && (t === At && ((wt & 2) === 0 && (oa |= l), qt === 4 && kn(
          t,
          kt,
          Ne,
          !1
        )), Qe(t));
      }
      function Lu(t, e, l) {
        if ((wt & 6) !== 0) throw Error(s(327));
        var r = !l && (e & 127) === 0 && (e & t.expiredLanes) === 0 || R(t, e), c = r ? Qp(t, e) : vo(t, e, !0), d = r;
        do {
          if (c === 0) {
            Ha && !r && kn(t, e, 0, !1);
            break;
          } else {
            if (l = t.current.alternate, d && !Lp(l)) {
              c = vo(t, e, !1), d = !1;
              continue;
            }
            if (c === 2) {
              if (d = e, t.errorRecoveryDisabledLanes & d)
                var w = 0;
              else
                w = t.pendingLanes & -536870913, w = w !== 0 ? w : w & 536870912 ? 536870912 : 0;
              if (w !== 0) {
                e = w;
                t: {
                  var A = t;
                  c = vl;
                  var V = ue && A.current.memoizedState.isDehydrated;
                  if (V && (ba(A, w).flags |= 256), w = vo(
                    A,
                    w,
                    !1
                  ), w !== 2) {
                    if (Po && !V) {
                      A.errorRecoveryDisabledLanes |= d, oa |= d, c = 4;
                      break t;
                    }
                    d = ve, ve = c, d !== null && (ve === null ? ve = d : ve.push.apply(
                      ve,
                      d
                    ));
                  }
                  c = w;
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
                    !Mn
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
              if ((e & 62914560) === e && (c = Bi + 300 - ge(), 10 < c)) {
                if (kn(
                  r,
                  e,
                  Ne,
                  !Mn
                ), j(r, 0, !0) !== 0) break t;
                fn = e, r.timeoutHandle = ch(
                  Vu.bind(
                    null,
                    r,
                    l,
                    ve,
                    Hi,
                    es,
                    e,
                    Ne,
                    oa,
                    Ua,
                    Mn,
                    d,
                    "Throttled",
                    -0,
                    0
                  ),
                  c
                );
                break t;
              }
              Vu(
                r,
                l,
                ve,
                Hi,
                es,
                e,
                Ne,
                oa,
                Ua,
                Mn,
                d,
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
      function Vu(t, e, l, r, c, d, w, A, V, $, nt, P, lt, gt) {
        if (t.timeoutHandle = Pn, P = e.subtreeFlags, P & 8192 || (P & 16785408) === 16785408) {
          P = vh(), Bu(
            e,
            d,
            P
          );
          var ie = (d & 62914560) === d ? Bi - ge() : (d & 4194048) === d ? Jd - ge() : 0;
          if (ie = yh(
            P,
            ie
          ), ie !== null) {
            fn = d, t.cancelPendingCommit = ie(
              Iu.bind(
                null,
                t,
                e,
                d,
                l,
                r,
                c,
                w,
                A,
                V,
                nt,
                P,
                null,
                lt,
                gt
              )
            ), kn(t, d, w, !$);
            return;
          }
        }
        Iu(
          t,
          e,
          d,
          l,
          r,
          c,
          w,
          A,
          V
        );
      }
      function Lp(t) {
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
        e &= ~ts, e &= ~oa, t.suspendedLanes |= e, t.pingedLanes &= ~e, r && (t.warmLanes |= e), r = t.expirationTimes;
        for (var c = e; 0 < c; ) {
          var d = 31 - _e(c), w = 1 << d;
          r[d] = -1, c &= ~w;
        }
        l !== 0 && h(t, l, e);
      }
      function Qu() {
        return (wt & 6) === 0 ? (pa(0), !1) : !0;
      }
      function bo() {
        if (_t !== null) {
          if (Ct === 0)
            var t = _t.return;
          else
            t = _t, sn = ea = null, Hr(t), Aa = null, pl = 0, t = _t;
          for (; t !== null; )
            _u(t.alternate, t), t = t.return;
          _t = null;
        }
      }
      function ba(t, e) {
        var l = t.timeoutHandle;
        l !== Pn && (t.timeoutHandle = Pn, uh(l)), l = t.cancelPendingCommit, l !== null && (t.cancelPendingCommit = null, l()), fn = 0, bo(), At = t, _t = l = ln(t.current, null), kt = e, Ct = 0, ze = null, Mn = !1, Ha = R(t, e), Po = !1, Ua = Ne = ts = oa = An = qt = 0, ve = vl = null, es = !1, (e & 8) !== 0 && (e |= e & 32);
        var r = t.entangledLanes;
        if (r !== 0)
          for (t = t.entanglements, r &= e; 0 < r; ) {
            var c = 31 - _e(r), d = 1 << c;
            e |= t[c], r &= ~d;
          }
        return dn = e, Xl(), l;
      }
      function Ku(t, e) {
        vt = null, dt.H = gl, e === Ma || e === zi ? (e = dc(), Ct = 3) : e === Ko ? (e = dc(), Ct = 4) : Ct = e === Fo ? 8 : e !== null && typeof e == "object" && typeof e.then == "function" ? 6 : 1, ze = e, _t === null && (qt = 1, ni(
          t,
          G(e, t.current)
        ));
      }
      function Xu() {
        var t = Ee.current;
        return t === null ? !0 : (kt & 4194048) === kt ? Oe === null : (kt & 62914560) === kt || (kt & 536870912) !== 0 ? t === Oe : !1;
      }
      function Zu() {
        var t = dt.H;
        return dt.H = gl, t === null ? gl : t;
      }
      function Ju() {
        var t = dt.A;
        return dt.A = Lg, t;
      }
      function di() {
        qt = 4, Mn || (kt & 4194048) !== kt && Ee.current !== null || (Ha = !0), (An & 134217727) === 0 && (oa & 134217727) === 0 || At === null || kn(
          At,
          kt,
          Ne,
          !1
        );
      }
      function vo(t, e, l) {
        var r = wt;
        wt |= 2;
        var c = Zu(), d = Ju();
        (At !== t || kt !== e) && (Hi = null, ba(t, e)), e = !1;
        var w = qt;
        t: do
          try {
            if (Ct !== 0 && _t !== null) {
              var A = _t, V = ze;
              switch (Ct) {
                case 8:
                  bo(), w = 6;
                  break t;
                case 3:
                case 2:
                case 9:
                case 6:
                  Ee.current === null && (e = !0);
                  var $ = Ct;
                  if (Ct = 0, ze = null, va(t, A, V, $), l && Ha) {
                    w = 0;
                    break t;
                  }
                  break;
                default:
                  $ = Ct, Ct = 0, ze = null, va(t, A, V, $);
              }
            }
            Vp(), w = qt;
            break;
          } catch (nt) {
            Ku(t, nt);
          }
        while (!0);
        return e && t.shellSuspendCounter++, sn = ea = null, wt = r, dt.H = c, dt.A = d, _t === null && (At = null, kt = 0, Xl()), w;
      }
      function Vp() {
        for (; _t !== null; ) Wu(_t);
      }
      function Qp(t, e) {
        var l = wt;
        wt |= 2;
        var r = Zu(), c = Ju();
        At !== t || kt !== e ? (Hi = null, yl = ge() + 500, ba(t, e)) : Ha = R(
          t,
          e
        );
        t: do
          try {
            if (Ct !== 0 && _t !== null) {
              e = _t;
              var d = ze;
              e: switch (Ct) {
                case 1:
                  Ct = 0, ze = null, va(t, e, d, 1);
                  break;
                case 2:
                case 9:
                  if (cc(d)) {
                    Ct = 0, ze = null, Fu(e);
                    break;
                  }
                  e = function() {
                    Ct !== 2 && Ct !== 9 || At !== t || (Ct = 7), Qe(t);
                  }, d.then(e, e);
                  break t;
                case 3:
                  Ct = 7;
                  break t;
                case 4:
                  Ct = 5;
                  break t;
                case 7:
                  cc(d) ? (Ct = 0, ze = null, Fu(e)) : (Ct = 0, ze = null, va(t, e, d, 7));
                  break;
                case 5:
                  var w = null;
                  switch (_t.tag) {
                    case 26:
                      w = _t.memoizedState;
                    case 5:
                    case 27:
                      var A = _t, V = A.type, $ = A.pendingProps;
                      if (w ? Dd(w) : yd(A.stateNode, V, $)) {
                        Ct = 0, ze = null;
                        var nt = A.sibling;
                        if (nt !== null) _t = nt;
                        else {
                          var P = A.return;
                          P !== null ? (_t = P, fi(P)) : _t = null;
                        }
                        break e;
                      }
                  }
                  Ct = 0, ze = null, va(t, e, d, 5);
                  break;
                case 6:
                  Ct = 0, ze = null, va(t, e, d, 6);
                  break;
                case 8:
                  bo(), qt = 6;
                  break t;
                default:
                  throw Error(s(462));
              }
            }
            Kp();
            break;
          } catch (lt) {
            Ku(t, lt);
          }
        while (!0);
        return sn = ea = null, dt.H = r, dt.A = c, wt = l, _t !== null ? 0 : (At = null, kt = 0, Xl(), qt);
      }
      function Kp() {
        for (; _t !== null && !Ag(); )
          Wu(_t);
      }
      function Wu(t) {
        var e = bu(
          t.alternate,
          t,
          dn
        );
        t.memoizedProps = t.pendingProps, e === null ? fi(t) : _t = e;
      }
      function Fu(t) {
        var e = t, l = e.alternate;
        switch (e.tag) {
          case 15:
          case 0:
            e = du(
              l,
              e,
              e.pendingProps,
              e.type,
              void 0,
              kt
            );
            break;
          case 11:
            e = du(
              l,
              e,
              e.pendingProps,
              e.type.render,
              e.ref,
              kt
            );
            break;
          case 5:
            Hr(e);
          default:
            _u(l, e), e = _t = rd(e, dn), e = bu(l, e, dn);
        }
        t.memoizedProps = t.pendingProps, e === null ? fi(t) : _t = e;
      }
      function va(t, e, l, r) {
        sn = ea = null, Hr(e), Aa = null, pl = 0;
        var c = e.return;
        try {
          if (Dp(
            t,
            c,
            e,
            l,
            kt
          )) {
            qt = 1, ni(
              t,
              G(l, t.current)
            ), _t = null;
            return;
          }
        } catch (d) {
          if (c !== null) throw _t = c, d;
          qt = 1, ni(
            t,
            G(l, t.current)
          ), _t = null;
          return;
        }
        e.flags & 32768 ? (St || r === 1 ? t = !0 : Ha || (kt & 536870912) !== 0 ? t = !1 : (Mn = t = !0, (r === 2 || r === 9 || r === 3 || r === 6) && (r = Ee.current, r !== null && r.tag === 13 && (r.flags |= 16384))), $u(e, t)) : fi(e);
      }
      function fi(t) {
        var e = t;
        do {
          if ((e.flags & 32768) !== 0) {
            $u(
              e,
              Mn
            );
            return;
          }
          t = e.return;
          var l = Up(
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
        qt === 0 && (qt = 5);
      }
      function $u(t, e) {
        do {
          var l = qp(t.alternate, t);
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
        qt = 6, _t = null;
      }
      function Iu(t, e, l, r, c, d, w, A, V) {
        t.cancelPendingCommit = null;
        do
          rl();
        while (Wt !== 0);
        if ((wt & 6) !== 0) throw Error(s(327));
        if (e !== null) {
          if (e === t.current)
            throw Error(s(177));
          if (d = e.lanes | e.childLanes, d |= Xo, g(
            t,
            l,
            d,
            w,
            A,
            V
          ), t === At && (_t = At = null, kt = 0), qa = e, On = t, fn = l, ns = d, as = c, Wd = r, (e.subtreeFlags & 10256) !== 0 || (e.flags & 10256) !== 0 ? (t.callbackNode = null, t.callbackPriority = 0, Wp(Uo, function() {
            return ad(), null;
          })) : (t.callbackNode = null, t.callbackPriority = 0), r = (e.flags & 13878) !== 0, (e.subtreeFlags & 13878) !== 0 || r) {
            r = dt.T, dt.T = null, c = on(), It(2), w = wt, wt |= 4;
            try {
              Gp(t, e, l);
            } finally {
              wt = w, It(c), dt.T = r;
            }
          }
          Wt = 1, Pu(), td(), ed();
        }
      }
      function Pu() {
        if (Wt === 1) {
          Wt = 0;
          var t = On, e = qa, l = (e.flags & 13878) !== 0;
          if ((e.subtreeFlags & 13878) !== 0 || l) {
            l = dt.T, dt.T = null;
            var r = on();
            It(2);
            var c = wt;
            wt |= 4;
            try {
              Ou(e, t), oh(t.containerInfo);
            } finally {
              wt = c, It(r), dt.T = l;
            }
          }
          t.current = e, Wt = 2;
        }
      }
      function td() {
        if (Wt === 2) {
          Wt = 0;
          var t = On, e = qa, l = (e.flags & 8772) !== 0;
          if ((e.subtreeFlags & 8772) !== 0 || l) {
            l = dt.T, dt.T = null;
            var r = on();
            It(2);
            var c = wt;
            wt |= 4;
            try {
              Cu(t, e.alternate, e);
            } finally {
              wt = c, It(r), dt.T = l;
            }
          }
          Wt = 3;
        }
      }
      function ed() {
        if (Wt === 4 || Wt === 3) {
          Wt = 0, jg();
          var t = On, e = qa, l = fn, r = Wd;
          (e.subtreeFlags & 10256) !== 0 || (e.flags & 10256) !== 0 ? Wt = 5 : (Wt = 0, qa = On = null, nd(t, t.pendingLanes));
          var c = t.pendingLanes;
          if (c === 0 && (jn = null), O(l), e = e.stateNode, ke && typeof ke.onCommitFiberRoot == "function")
            try {
              ke.onCommitFiberRoot(
                ul,
                e,
                void 0,
                (e.current.flags & 128) === 128
              );
            } catch {
            }
          if (r !== null) {
            e = dt.T, c = on(), It(2), dt.T = null;
            try {
              for (var d = t.onRecoverableError, w = 0; w < r.length; w++) {
                var A = r[w];
                d(A.value, {
                  componentStack: A.stack
                });
              }
            } finally {
              dt.T = e, It(c);
            }
          }
          (fn & 3) !== 0 && rl(), Qe(t), c = t.pendingLanes, (l & 261930) !== 0 && (c & 42) !== 0 ? t === ls ? xl++ : (xl = 0, ls = t) : xl = 0, ue && gg(), pa(0);
        }
      }
      function nd(t, e) {
        (t.pooledCacheLanes &= e) === 0 && (e = t.pooledCache, e != null && (t.pooledCache = null, Za(e)));
      }
      function rl() {
        return Pu(), td(), ed(), ad();
      }
      function ad() {
        if (Wt !== 5) return !1;
        var t = On, e = ns;
        ns = 0;
        var l = O(fn), r = 32 > l ? 32 : l;
        l = dt.T;
        var c = on();
        try {
          It(r), dt.T = null, r = as, as = null;
          var d = On, w = fn;
          if (Wt = 0, qa = On = null, fn = 0, (wt & 6) !== 0)
            throw Error(s(331));
          var A = wt;
          if (wt |= 4, Uu(d.current), Du(
            d,
            d.current,
            w,
            r
          ), wt = A, pa(0, !1), ke && typeof ke.onPostCommitFiberRoot == "function")
            try {
              ke.onPostCommitFiberRoot(ul, d);
            } catch {
            }
          return !0;
        } finally {
          It(c), dt.T = l, nd(t, e);
        }
      }
      function ld(t, e, l) {
        e = G(l, e), e = Wr(t.stateNode, e, 2), t = yn(t, e, 2), t !== null && (B(t, 2), Qe(t));
      }
      function zt(t, e, l) {
        if (t.tag === 3)
          ld(t, t, l);
        else
          for (; e !== null; ) {
            if (e.tag === 3) {
              ld(
                e,
                t,
                l
              );
              break;
            } else if (e.tag === 1) {
              var r = e.stateNode;
              if (typeof e.type.getDerivedStateFromError == "function" || typeof r.componentDidCatch == "function" && (jn === null || !jn.has(r))) {
                t = G(l, t), l = au(2), r = yn(e, l, 2), r !== null && (lu(
                  l,
                  r,
                  e,
                  t
                ), B(r, 2), Qe(r));
                break;
              }
            }
            e = e.return;
          }
      }
      function yo(t, e, l) {
        var r = t.pingCache;
        if (r === null) {
          r = t.pingCache = new Vg();
          var c = /* @__PURE__ */ new Set();
          r.set(e, c);
        } else
          c = r.get(e), c === void 0 && (c = /* @__PURE__ */ new Set(), r.set(e, c));
        c.has(l) || (Po = !0, c.add(l), t = Xp.bind(null, t, e, l), e.then(t, t));
      }
      function Xp(t, e, l) {
        var r = t.pingCache;
        r !== null && r.delete(e), t.pingedLanes |= t.suspendedLanes & l, t.warmLanes &= ~l, At === t && (kt & l) === l && (qt === 4 || qt === 3 && (kt & 62914560) === kt && 300 > ge() - Bi ? (wt & 2) === 0 && ba(t, 0) : ts |= l, Ua === kt && (Ua = 0)), Qe(t);
      }
      function id(t, e) {
        e === 0 && (e = F()), t = Jn(t, e), t !== null && (B(t, e), Qe(t));
      }
      function Zp(t) {
        var e = t.memoizedState, l = 0;
        e !== null && (l = e.retryLane), id(t, l);
      }
      function Jp(t, e) {
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
            throw Error(s(314));
        }
        r !== null && r.delete(e), id(t, l);
      }
      function Wp(t, e) {
        return xi(t, e);
      }
      function Fp(t, e, l, r) {
        this.tag = t, this.key = l, this.sibling = this.child = this.return = this.stateNode = this.type = this.elementType = null, this.index = 0, this.refCleanup = this.ref = null, this.pendingProps = e, this.dependencies = this.memoizedState = this.updateQueue = this.memoizedProps = null, this.mode = r, this.subtreeFlags = this.flags = 0, this.deletions = null, this.childLanes = this.lanes = 0, this.alternate = null;
      }
      function xo(t) {
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
      function rd(t, e) {
        t.flags &= 65011714;
        var l = t.alternate;
        return l === null ? (t.childLanes = 0, t.lanes = e, t.child = null, t.subtreeFlags = 0, t.memoizedProps = null, t.memoizedState = null, t.updateQueue = null, t.dependencies = null, t.stateNode = null) : (t.childLanes = l.childLanes, t.lanes = l.lanes, t.child = l.child, t.subtreeFlags = 0, t.deletions = null, t.memoizedProps = l.memoizedProps, t.memoizedState = l.memoizedState, t.updateQueue = l.updateQueue, t.type = l.type, e = l.dependencies, t.dependencies = e === null ? null : {
          lanes: e.lanes,
          firstContext: e.firstContext
        }), t;
      }
      function mi(t, e, l, r, c, d) {
        var w = 0;
        if (r = t, typeof t == "function") xo(t) && (w = 1);
        else if (typeof t == "string")
          w = Ge && Jt ? Cd(t, l, ae.current) ? 26 : Ud(t) ? 27 : 5 : Ge ? Cd(
            t,
            l,
            ae.current
          ) ? 26 : 5 : Jt && Ud(t) ? 27 : 5;
        else
          t: switch (t) {
            case Mo:
              return t = i(31, l, e, c), t.elementType = Mo, t.lanes = d, t;
            case xa:
              return In(
                l.children,
                c,
                d,
                e
              );
            case md:
              w = 8, c |= 24;
              break;
            case Eo:
              return t = i(12, l, e, c | 2), t.elementType = Eo, t.lanes = d, t;
            case No:
              return t = i(13, l, e, c), t.elementType = No, t.lanes = d, t;
            case To:
              return t = i(19, l, e, c), t.elementType = To, t.lanes = d, t;
            default:
              if (typeof t == "object" && t !== null)
                switch (t.$$typeof) {
                  case Sn:
                    w = 10;
                    break t;
                  case pd:
                    w = 9;
                    break t;
                  case zo:
                    w = 11;
                    break t;
                  case Co:
                    w = 14;
                    break t;
                  case En:
                    w = 16, r = null;
                    break t;
                }
              w = 29, l = Error(
                s(
                  130,
                  t === null ? "null" : typeof t,
                  ""
                )
              ), r = null;
          }
        return e = i(w, l, e, c), e.elementType = t, e.type = r, e.lanes = d, e;
      }
      function In(t, e, l, r) {
        return t = i(7, t, r, e), t.lanes = l, t;
      }
      function wo(t, e, l) {
        return t = i(6, t, null, e), t.lanes = l, t;
      }
      function od(t) {
        var e = i(18, null, null, 0);
        return e.stateNode = t, e;
      }
      function _o(t, e, l) {
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
      function $p(t, e, l, r, c, d, w, A, V) {
        this.tag = 1, this.containerInfo = t, this.pingCache = this.current = this.pendingChildren = null, this.timeoutHandle = Pn, this.callbackNode = this.next = this.pendingContext = this.context = this.cancelPendingCommit = null, this.callbackPriority = 0, this.expirationTimes = W(-1), this.entangledLanes = this.shellSuspendCounter = this.errorRecoveryDisabledLanes = this.expiredLanes = this.warmLanes = this.pingedLanes = this.suspendedLanes = this.pendingLanes = 0, this.entanglements = W(0), this.hiddenUpdates = W(null), this.identifierPrefix = r, this.onUncaughtError = c, this.onCaughtError = d, this.onRecoverableError = w, this.pooledCache = null, this.pooledCacheLanes = 0, this.formState = V, this.incompleteTransitions = /* @__PURE__ */ new Map();
      }
      function sd(t, e, l, r, c, d, w, A, V, $, nt, P) {
        return t = new $p(
          t,
          e,
          l,
          w,
          V,
          $,
          nt,
          P,
          A
        ), e = 1, d === !0 && (e |= 24), d = i(3, null, null, e), t.current = d, d.stateNode = t, e = kr(), e.refCount++, t.pooledCache = e, e.refCount++, d.memoizedState = {
          element: r,
          isDehydrated: l,
          cache: e
        }, Nr(d), t;
      }
      function cd(t) {
        return t ? (t = Sa, t) : Sa;
      }
      function ud(t) {
        var e = t._reactInternals;
        if (e === void 0)
          throw typeof t.render == "function" ? Error(s(188)) : (t = Object.keys(t).join(","), Error(s(268, t)));
        return t = f(e), t = t !== null ? p(t) : null, t === null ? null : ol(t.stateNode);
      }
      function dd(t, e, l, r, c, d) {
        c = cd(c), r.context === null ? r.context = c : r.pendingContext = c, r = vn(e), r.payload = { element: l }, d = d === void 0 ? null : d, d !== null && (r.callback = d), l = yn(t, r, e), l !== null && (he(l, t, e), Wa(l, t, e));
      }
      function fd(t, e) {
        if (t = t.memoizedState, t !== null && t.dehydrated !== null) {
          var l = t.retryLane;
          t.retryLane = l !== 0 && l < e ? l : e;
        }
      }
      function ko(t, e) {
        fd(t, e), (t = t.alternate) && fd(t, e);
      }
      var xt = {}, Ip = v0, we = fm(), So = Object.assign, Pp = Symbol.for("react.element"), pi = Symbol.for("react.transitional.element"), ya = Symbol.for("react.portal"), xa = Symbol.for("react.fragment"), md = Symbol.for("react.strict_mode"), Eo = Symbol.for("react.profiler"), pd = Symbol.for("react.consumer"), Sn = Symbol.for("react.context"), zo = Symbol.for("react.forward_ref"), No = Symbol.for("react.suspense"), To = Symbol.for("react.suspense_list"), Co = Symbol.for("react.memo"), En = Symbol.for("react.lazy"), Mo = Symbol.for("react.activity"), th = Symbol.for("react.memo_cache_sentinel"), hd = Symbol.iterator, eh = Symbol.for("react.client.reference"), hi = Array.isArray, dt = Ip.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE, nh = a.rendererVersion, ah = a.rendererPackageName, gd = a.extraDevToolsConfig, ol = a.getPublicInstance, lh = a.getRootHostContext, ih = a.getChildHostContext, rh = a.prepareForCommit, oh = a.resetAfterCommit, sh = a.createInstance;
      a.cloneMutableInstance;
      var Ao = a.appendInitialChild, bd = a.finalizeInitialChildren, gi = a.shouldSetTextContent, vd = a.createTextInstance;
      a.cloneMutableTextInstance;
      var ch = a.scheduleTimeout, uh = a.cancelTimeout, Pn = a.noTimeout, rn = a.isPrimaryRenderer;
      a.warnsIfNotActing;
      var ce = a.supportsMutation, Xe = a.supportsPersistence, ue = a.supportsHydration, dh = a.getInstanceFromNode;
      a.beforeActiveInstanceBlur;
      var fh = a.preparePortalMount;
      a.prepareScopeUpdate, a.getInstanceFromScope;
      var It = a.setCurrentUpdatePriority, on = a.getCurrentUpdatePriority, mh = a.resolveUpdatePriority;
      a.trackSchedulerEvent, a.resolveEventType, a.resolveEventTimeStamp;
      var ph = a.shouldAttemptEagerTransition, hh = a.detachDeletedInstance;
      a.requestPostPaintCallback;
      var gh = a.maySuspendCommit, bh = a.maySuspendCommitOnUpdate, jo = a.maySuspendCommitInSyncRender, yd = a.preloadInstance, vh = a.startSuspendingCommit, xd = a.suspendInstance;
      a.suspendOnActiveViewTransition;
      var yh = a.waitForCommitToBeReady;
      a.getSuspendedCommitReason;
      var wa = a.NotPendingTransition, ta = a.HostTransitionContext, xh = a.resetFormInstance;
      a.bindToConsole;
      var wh = a.supportsMicrotasks, _h = a.scheduleMicrotask, sl = a.supportsTestSelectors, kh = a.findFiberRoot, Sh = a.getBoundingRect, Eh = a.getTextContent, cl = a.isHiddenSubtree, zh = a.matchAccessibilityRole, Nh = a.setFocusIfFocusable, Th = a.setupIntersectionObserver, Ch = a.appendChild, Mh = a.appendChildToContainer, Ah = a.commitTextUpdate, jh = a.commitMount, Oh = a.commitUpdate, Rh = a.insertBefore, Dh = a.insertInContainerBefore, Bh = a.removeChild, Hh = a.removeChildFromContainer, wd = a.resetTextContent, Uh = a.hideInstance, qh = a.hideTextInstance, Gh = a.unhideInstance, Yh = a.unhideTextInstance;
      a.cancelViewTransitionName, a.cancelRootViewTransitionName, a.restoreRootViewTransitionName, a.cloneRootViewTransitionContainer, a.removeRootViewTransitionClone, a.measureClonedInstance, a.hasInstanceChanged, a.hasInstanceAffectedParent, a.startViewTransition, a.startGestureTransition, a.stopViewTransition, a.getCurrentGestureOffset, a.createViewTransitionInstance;
      var Lh = a.clearContainer;
      a.createFragmentInstance, a.updateFragmentInstanceFiber, a.commitNewChildToFragmentInstance, a.deleteChildFromFragmentInstance;
      var Vh = a.cloneInstance, _d = a.createContainerChildSet, kd = a.appendChildToContainerChildSet, Qh = a.finalizeContainerChildren, Sd = a.replaceContainerChildren, Ed = a.cloneHiddenInstance, zd = a.cloneHiddenTextInstance, Oo = a.isSuspenseInstancePending, Ro = a.isSuspenseInstanceFallback, Kh = a.getSuspenseInstanceFallbackErrorDetails, Xh = a.registerSuspenseInstanceRetry, Zh = a.canHydrateFormStateMarker, Jh = a.isFormStateMarkerMatching, Nd = a.getNextHydratableSibling, Wh = a.getNextHydratableSiblingAfterSingleton, Fh = a.getFirstHydratableChild, $h = a.getFirstHydratableChildWithinContainer, Ih = a.getFirstHydratableChildWithinActivityInstance, Ph = a.getFirstHydratableChildWithinSuspenseInstance, tg = a.getFirstHydratableChildWithinSingleton, eg = a.canHydrateInstance, ng = a.canHydrateTextInstance, ag = a.canHydrateActivityInstance, lg = a.canHydrateSuspenseInstance, ig = a.hydrateInstance, rg = a.hydrateTextInstance, og = a.hydrateActivityInstance, sg = a.hydrateSuspenseInstance, cg = a.getNextHydratableInstanceAfterActivityInstance, ug = a.getNextHydratableInstanceAfterSuspenseInstance, dg = a.commitHydratedInstance, fg = a.commitHydratedContainer, mg = a.commitHydratedActivityInstance, pg = a.commitHydratedSuspenseInstance, hg = a.finalizeHydratedChildren, gg = a.flushHydrationEvents;
      a.clearActivityBoundary;
      var bg = a.clearSuspenseBoundary;
      a.clearActivityBoundaryFromContainer;
      var vg = a.clearSuspenseBoundaryFromContainer, yg = a.hideDehydratedBoundary, xg = a.unhideDehydratedBoundary, Td = a.shouldDeleteUnhydratedTailInstances;
      a.diffHydratedPropsForDevWarnings, a.diffHydratedTextForDevWarnings, a.describeHydratableInstanceForDevWarnings;
      var wg = a.validateHydratableInstance, _g = a.validateHydratableTextInstance, Ge = a.supportsResources, Cd = a.isHostHoistableType, Do = a.getHoistableRoot, Md = a.getResource, Ad = a.acquireResource, jd = a.releaseResource, kg = a.hydrateHoistable, Od = a.mountHoistable, Rd = a.unmountHoistable, Sg = a.createHoistableInstance, Eg = a.prepareToCommitHoistables, zg = a.mayResourceSuspendCommit, Dd = a.preloadResource, Ng = a.suspendResource, Jt = a.supportsSingletons, Bd = a.resolveSingletonInstance, Tg = a.acquireSingletonInstance, Hd = a.releaseSingletonInstance, Ud = a.isHostSingletonType, _a = a.isSingletonScope, Bo = [], ka = -1, Sa = {}, _e = Math.clz32 ? Math.clz32 : E, Cg = Math.log, Mg = Math.LN2, bi = 256, vi = 262144, yi = 4194304, xi = we.unstable_scheduleCallback, Ho = we.unstable_cancelCallback, Ag = we.unstable_shouldYield, jg = we.unstable_requestPaint, ge = we.unstable_now, qd = we.unstable_ImmediatePriority, Og = we.unstable_UserBlockingPriority, Uo = we.unstable_NormalPriority, Rg = we.unstable_IdlePriority, Dg = we.log, Bg = we.unstable_setDisableYieldValue, ul = null, ke = null, Se = typeof Object.is == "function" ? Object.is : Y, Gd = typeof reportError == "function" ? reportError : function(t) {
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
      }, Hg = Object.prototype.hasOwnProperty, qo, Yd, Go = !1, Ld = /* @__PURE__ */ new WeakMap(), Ea = [], za = 0, wi = null, dl = 0, Ce = [], Me = 0, zn = null, Ze = 1, Je = "", ae = b(null), fl = b(null), Nn = b(null), _i = b(null), le = null, Rt = null, St = !1, Tn = null, Ae = !1, Yo = Error(s(519)), ki = b(null), ea = null, sn = null, Ug = typeof AbortController < "u" ? AbortController : function() {
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
      }, qg = we.unstable_scheduleCallback, Gg = we.unstable_NormalPriority, Dt = {
        $$typeof: Sn,
        Consumer: null,
        Provider: null,
        _currentValue: null,
        _currentValue2: null,
        _threadCount: 0
      }, Si = null, Na = null, Lo = !1, Ei = !1, Vo = !1, na = 0, ml = null, Qo = 0, Ta = 0, Ca = null, Vd = dt.S;
      dt.S = function(t, e) {
        Jd = ge(), typeof e == "object" && e !== null && typeof e.then == "function" && Np(t, e), Vd !== null && Vd(t, e);
      };
      var aa = b(null), Ma = Error(s(460)), Ko = Error(s(474)), zi = Error(s(542)), Ni = { then: function() {
      } }, la = null, Aa = null, pl = 0, ia = mc(!0), Qd = mc(!1), je = [], ja = 0, Xo = 0, Cn = !1, Zo = !1, Oa = b(null), Ti = b(0), Ee = b(null), Oe = null, Yt = b(0), cn = 0, vt = null, Mt = null, Vt = null, Ci = !1, Ra = !1, ra = !1, Mi = 0, hl = 0, Da = null, Yg = 0, gl = {
        readContext: ee,
        use: $l,
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
      gl.useEffectEvent = Ut;
      var Kd = {
        readContext: ee,
        use: $l,
        useCallback: function(t, e) {
          return fe().memoizedState = [
            t,
            e === void 0 ? null : e
          ], t;
        },
        useContext: ee,
        useEffect: Uc,
        useImperativeHandle: function(t, e, l) {
          l = l != null ? l.concat([t]) : null, Pl(
            4194308,
            4,
            Lc.bind(null, e, t),
            l
          );
        },
        useLayoutEffect: function(t, e) {
          return Pl(4194308, 4, t, e);
        },
        useInsertionEffect: function(t, e) {
          Pl(4, 2, t, e);
        },
        useMemo: function(t, e) {
          var l = fe();
          e = e === void 0 ? null : e;
          var r = t();
          if (ra) {
            M(!0);
            try {
              t();
            } finally {
              M(!1);
            }
          }
          return l.memoizedState = [r, e], r;
        },
        useReducer: function(t, e, l) {
          var r = fe();
          if (l !== void 0) {
            var c = l(e);
            if (ra) {
              M(!0);
              try {
                l(e);
              } finally {
                M(!1);
              }
            }
          } else c = e;
          return r.memoizedState = r.baseState = c, t = {
            pending: null,
            lanes: 0,
            dispatch: null,
            lastRenderedReducer: t,
            lastRenderedState: c
          }, r.queue = t, t = t.dispatch = Rp.bind(
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
          t = Yr(t);
          var e = t.queue, l = $c.bind(
            null,
            vt,
            e
          );
          return e.dispatch = l, [t.memoizedState, l];
        },
        useDebugValue: Qr,
        useDeferredValue: function(t, e) {
          var l = fe();
          return Kr(l, t, e);
        },
        useTransition: function() {
          var t = Yr(!1);
          return t = Zc.bind(
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
              throw Error(s(407));
            l = l();
          } else {
            if (l = e(), At === null)
              throw Error(s(349));
            (kt & 127) !== 0 || _c(r, e, l);
          }
          c.memoizedState = l;
          var d = { value: l, getSnapshot: e };
          return c.queue = d, Uc(Sc.bind(null, r, d, t), [
            t
          ]), r.flags |= 2048, ha(
            9,
            { destroy: void 0 },
            kc.bind(
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
            l = (r & ~(1 << 32 - _e(r) - 1)).toString(32) + l, e = "_" + e + "R_" + l, l = Mi++, 0 < l && (e += "H" + l.toString(32)), e += "_";
          } else
            l = Yg++, e = "_" + e + "r_" + l.toString(32) + "_";
          return t.memoizedState = e;
        },
        useHostTransitionStatus: Xr,
        useFormState: Oc,
        useActionState: Oc,
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
          return e.queue = l, e = Zr.bind(
            null,
            vt,
            !0,
            l
          ), l.dispatch = e, [t, e];
        },
        useMemoCache: Ur,
        useCacheRefresh: function() {
          return fe().memoizedState = Op.bind(
            null,
            vt
          );
        },
        useEffectEvent: function(t) {
          var e = fe(), l = { impl: t };
          return e.memoizedState = l, function() {
            if ((wt & 2) !== 0)
              throw Error(s(440));
            return l.impl.apply(void 0, arguments);
          };
        }
      }, Jo = {
        readContext: ee,
        use: $l,
        useCallback: Qc,
        useContext: ee,
        useEffect: Vr,
        useImperativeHandle: Vc,
        useInsertionEffect: Gc,
        useLayoutEffect: Yc,
        useMemo: Kc,
        useReducer: Il,
        useRef: Hc,
        useState: function() {
          return Il(tn);
        },
        useDebugValue: Qr,
        useDeferredValue: function(t, e) {
          var l = Gt();
          return Xc(
            l,
            Mt.memoizedState,
            t,
            e
          );
        },
        useTransition: function() {
          var t = Il(tn)[0], e = Gt().memoizedState;
          return [
            typeof t == "boolean" ? t : Ia(t),
            e
          ];
        },
        useSyncExternalStore: wc,
        useId: Wc,
        useHostTransitionStatus: Xr,
        useFormState: Rc,
        useActionState: Rc,
        useOptimistic: function(t, e) {
          var l = Gt();
          return Nc(l, Mt, t, e);
        },
        useMemoCache: Ur,
        useCacheRefresh: Fc
      };
      Jo.useEffectEvent = qc;
      var Xd = {
        readContext: ee,
        use: $l,
        useCallback: Qc,
        useContext: ee,
        useEffect: Vr,
        useImperativeHandle: Vc,
        useInsertionEffect: Gc,
        useLayoutEffect: Yc,
        useMemo: Kc,
        useReducer: Gr,
        useRef: Hc,
        useState: function() {
          return Gr(tn);
        },
        useDebugValue: Qr,
        useDeferredValue: function(t, e) {
          var l = Gt();
          return Mt === null ? Kr(l, t, e) : Xc(
            l,
            Mt.memoizedState,
            t,
            e
          );
        },
        useTransition: function() {
          var t = Gr(tn)[0], e = Gt().memoizedState;
          return [
            typeof t == "boolean" ? t : Ia(t),
            e
          ];
        },
        useSyncExternalStore: wc,
        useId: Wc,
        useHostTransitionStatus: Xr,
        useFormState: Bc,
        useActionState: Bc,
        useOptimistic: function(t, e) {
          var l = Gt();
          return Mt !== null ? Nc(l, Mt, t, e) : (l.baseState = t, [t, l.queue.dispatch]);
        },
        useMemoCache: Ur,
        useCacheRefresh: Fc
      };
      Xd.useEffectEvent = qc;
      var Wo = {
        enqueueSetState: function(t, e, l) {
          t = t._reactInternals;
          var r = xe(), c = vn(r);
          c.payload = e, l != null && (c.callback = l), e = yn(t, c, r), e !== null && (he(e, t, r), Wa(e, t, r));
        },
        enqueueReplaceState: function(t, e, l) {
          t = t._reactInternals;
          var r = xe(), c = vn(r);
          c.tag = 1, c.payload = e, l != null && (c.callback = l), e = yn(t, c, r), e !== null && (he(e, t, r), Wa(e, t, r));
        },
        enqueueForceUpdate: function(t, e) {
          t = t._reactInternals;
          var l = xe(), r = vn(l);
          r.tag = 2, e != null && (r.callback = e), e = yn(t, r, l), e !== null && (he(e, t, l), Wa(e, t, l));
        }
      }, Fo = Error(s(461)), Qt = !1, $o = {
        dehydrated: null,
        treeContext: null,
        retryLane: 0,
        hydrationErrors: null
      }, un = !1, Kt = !1, Io = !1, Zd = typeof WeakSet == "function" ? WeakSet : Set, Pt = null, Xt = null, be = !1, Ye = null, Ba = 8192, Lg = {
        getCacheForType: function(t) {
          var e = ee(Dt), l = e.data.get(t);
          return l === void 0 && (l = t(), e.data.set(t, l)), l;
        },
        cacheSignal: function() {
          return ee(Dt).controller.signal;
        }
      }, Ai = 0, ji = 1, Oi = 2, Ri = 3, Di = 4;
      if (typeof Symbol == "function" && Symbol.for) {
        var bl = Symbol.for;
        Ai = bl("selector.component"), ji = bl("selector.has_pseudo_class"), Oi = bl("selector.role"), Ri = bl("selector.test_id"), Di = bl("selector.text");
      }
      var Vg = typeof WeakMap == "function" ? WeakMap : Map, wt = 0, At = null, _t = null, kt = 0, Ct = 0, ze = null, Mn = !1, Ha = !1, Po = !1, dn = 0, qt = 0, An = 0, oa = 0, ts = 0, Ne = 0, Ua = 0, vl = null, ve = null, es = !1, Bi = 0, Jd = 0, yl = 1 / 0, Hi = null, jn = null, Wt = 0, On = null, qa = null, fn = 0, ns = 0, as = null, Wd = null, xl = 0, ls = null;
      return xt.attemptContinuousHydration = function(t) {
        if (t.tag === 13 || t.tag === 31) {
          var e = Jn(t, 67108864);
          e !== null && he(e, t, 67108864), ko(t, 67108864);
        }
      }, xt.attemptHydrationAtCurrentPriority = function(t) {
        if (t.tag === 13 || t.tag === 31) {
          var e = xe();
          e = z(e);
          var l = Jn(t, e);
          l !== null && he(l, t, e), ko(t, e);
        }
      }, xt.attemptSynchronousHydration = function(t) {
        switch (t.tag) {
          case 3:
            if (t = t.stateNode, t.current.memoizedState.isDehydrated) {
              var e = N(t.pendingLanes);
              if (e !== 0) {
                for (t.pendingLanes |= 2, t.entangledLanes |= 2; e; ) {
                  var l = 1 << 31 - _e(e);
                  t.entanglements[1] |= l, e &= ~l;
                }
                Qe(t), (wt & 6) === 0 && (yl = ge() + 500, pa(0));
              }
            }
            break;
          case 31:
          case 13:
            e = Jn(t, 2), e !== null && he(e, t, 2), Qu(), ko(t, 2);
        }
      }, xt.batchedUpdates = function(t, e) {
        return t(e);
      }, xt.createComponentSelector = function(t) {
        return { $$typeof: Ai, value: t };
      }, xt.createContainer = function(t, e, l, r, c, d, w, A, V, $) {
        return sd(
          t,
          e,
          !1,
          null,
          l,
          r,
          d,
          null,
          w,
          A,
          V,
          $
        );
      }, xt.createHasPseudoClassSelector = function(t) {
        return { $$typeof: ji, value: t };
      }, xt.createHydrationContainer = function(t, e, l, r, c, d, w, A, V, $, nt, P, lt, gt) {
        return t = sd(
          l,
          r,
          !0,
          t,
          c,
          d,
          A,
          gt,
          V,
          $,
          nt,
          P
        ), t.context = cd(null), l = t.current, r = xe(), r = z(r), c = vn(r), c.callback = e ?? null, yn(l, c, r), e = r, t.current.lanes = e, B(t, e), Qe(t), t;
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
        return { $$typeof: Oi, value: t };
      }, xt.createTestNameSelector = function(t) {
        return { $$typeof: Ri, value: t };
      }, xt.createTextSelector = function(t) {
        return { $$typeof: Di, value: t };
      }, xt.defaultOnCaughtError = function(t) {
        console.error(t);
      }, xt.defaultOnRecoverableError = function(t) {
        Gd(t);
      }, xt.defaultOnUncaughtError = function(t) {
        Gd(t);
      }, xt.deferredUpdates = function(t) {
        var e = dt.T, l = on();
        try {
          return It(32), dt.T = null, t();
        } finally {
          It(l), dt.T = e;
        }
      }, xt.discreteUpdates = function(t, e, l, r, c) {
        var d = dt.T, w = on();
        try {
          return It(2), dt.T = null, t(e, l, r, c);
        } finally {
          It(w), dt.T = d, wt === 0 && (yl = ge() + 500);
        }
      }, xt.findAllNodes = go, xt.findBoundingRects = function(t, e) {
        if (!sl) throw Error(s(363));
        e = go(t, e), t = [];
        for (var l = 0; l < e.length; l++)
          t.push(Sh(e[l]));
        for (e = t.length - 1; 0 < e; e--) {
          l = t[e];
          for (var r = l.x, c = r + l.width, d = l.y, w = d + l.height, A = e - 1; 0 <= A; A--)
            if (e !== A) {
              var V = t[A], $ = V.x, nt = $ + V.width, P = V.y, lt = P + V.height;
              if (r >= $ && d >= P && c <= nt && w <= lt) {
                t.splice(e, 1);
                break;
              } else if (r !== $ || l.width !== V.width || lt < d || P > w) {
                if (!(d !== P || l.height !== V.height || nt < r || $ > c)) {
                  $ > r && (V.width += $ - r, V.x = r), nt < c && (V.width = c - $), t.splice(e, 1);
                  break;
                }
              } else {
                P > d && (V.height += P - d, V.y = d), lt < w && (V.height = w - P), t.splice(e, 1);
                break;
              }
            }
        }
        return t;
      }, xt.findHostInstance = ud, xt.findHostInstanceWithNoPortals = function(t) {
        return t = f(t), t = t !== null ? v(t) : null, t === null ? null : ol(t.stateNode);
      }, xt.findHostInstanceWithWarning = function(t) {
        return ud(t);
      }, xt.flushPassiveEffects = rl, xt.flushSyncFromReconciler = function(t) {
        var e = wt;
        wt |= 1;
        var l = dt.T, r = on();
        try {
          if (It(2), dt.T = null, t)
            return t();
        } finally {
          It(r), dt.T = l, wt = e, (wt & 6) === 0 && pa(0);
        }
      }, xt.flushSyncWork = Qu, xt.focusWithin = function(t, e) {
        if (!sl) throw Error(s(363));
        for (t = mo(t), e = Gu(t, e), e = Array.from(e), t = 0; t < e.length; ) {
          var l = e[t++], r = l.tag;
          if (!cl(l)) {
            if ((r === 5 || r === 26 || r === 27) && Nh(l.stateNode))
              return !0;
            for (l = l.child; l !== null; )
              e.push(l), l = l.sibling;
          }
        }
        return !1;
      }, xt.getFindAllNodesFailureDescription = function(t, e) {
        if (!sl) throw Error(s(363));
        var l = 0, r = [];
        t = [mo(t), 0];
        for (var c = 0; c < t.length; ) {
          var d = t[c++], w = d.tag, A = t[c++], V = e[A];
          if ((w !== 5 && w !== 26 && w !== 27 || !cl(d)) && (po(d, V) && (r.push(ho(V)), A++, A > l && (l = A)), A < e.length))
            for (d = d.child; d !== null; )
              t.push(d, A), d = d.sibling;
        }
        if (l < e.length) {
          for (t = []; l < e.length; l++)
            t.push(ho(e[l]));
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
            return ol(t.child.stateNode);
          default:
            return t.child.stateNode;
        }
      }, xt.injectIntoDevTools = function() {
        var t = {
          bundleType: 0,
          version: nh,
          rendererPackageName: ah,
          currentDispatcherRef: dt,
          reconcilerVersion: "19.2.0"
        };
        if (gd !== null && (t.rendererConfig = gd), typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ > "u") t = !1;
        else {
          var e = __REACT_DEVTOOLS_GLOBAL_HOOK__;
          if (e.isDisabled || !e.supportsFiber) t = !0;
          else {
            try {
              ul = e.inject(t), ke = e;
            } catch {
            }
            t = !!e.checkDCE;
          }
        }
        return t;
      }, xt.isAlreadyRendering = function() {
        return (wt & 6) !== 0;
      }, xt.observeVisibleRects = function(t, e, l, r) {
        if (!sl) throw Error(s(363));
        t = go(t, e);
        var c = Th(
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
        if (t.tag !== 5) throw Error(s(476));
        var c = Jc(t).queue;
        Zc(
          t,
          c,
          e,
          wa,
          l === null ? o : function() {
            var d = Jc(t);
            return d.next === null && (d = t.alternate.memoizedState), Pa(
              t,
              d.next.queue,
              {},
              xe()
            ), l(r);
          }
        );
      }, xt.updateContainer = function(t, e, l, r) {
        var c = e.current, d = xe();
        return dd(
          c,
          d,
          t,
          e,
          l,
          r
        ), d;
      }, xt.updateContainerSync = function(t, e, l, r) {
        return dd(
          e.current,
          2,
          t,
          e,
          l,
          r
        ), 2;
      }, xt;
    }, n.exports.default = n.exports, Object.defineProperty(n.exports, "__esModule", { value: !0 });
  })(ss)), ss.exports;
}
var cf;
function w0() {
  return cf || (cf = 1, os.exports = x0()), os.exports;
}
var _0 = w0();
const mm = /* @__PURE__ */ Ks(_0);
var k0 = fm(), ds = { exports: {} }, mn = {};
/**
 * @license React
 * react-reconciler-constants.production.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var uf;
function S0() {
  return uf || (uf = 1, mn.ConcurrentRoot = 1, mn.ContinuousEventPriority = 8, mn.DefaultEventPriority = 32, mn.DiscreteEventPriority = 2, mn.IdleEventPriority = 268435456, mn.LegacyRoot = 0, mn.NoEventPriority = 0), mn;
}
var df;
function E0() {
  return df || (df = 1, ds.exports = S0()), ds.exports;
}
var Qa = E0();
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
const pm = ["accent", "panel-bg", "surface-0", "surface-1", "surface-dim", "overlay-0", "overlay-1", "text", "subtext-0", "mauve", "green", "yellow", "red", "blue", "teal", "peach", "backdrop", "card-bg"], Ss = 16, br = /* @__PURE__ */ new Set(["hover", "focus", "focus-visible", "focus-within", "active"]), z0 = [
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
  ['input[type="checkbox"], input[type="radio"]', { width: "12px", height: "12px", margin: "3px 2px", padding: "0", "border-width": "0", "box-sizing": "border-box", "border-radius": "3px" }],
  // A ticked one is the app's accent with a mark (`describe.mjs`), as the web's `accent-color: var(--accent)` draws it (the plain box
  // gave no sign it was ticked). A radio button is round.
  ['input[type="checkbox"]:checked, input[type="radio"]:checked', { "background-color": "var(--accent)", color: "var(--panel-bg)" }],
  ['input[type="radio"]', { "border-radius": "6px" }],
  ["svg", { overflow: "hidden" }],
  ["[hidden]", { display: "none" }]
], ff = {
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
}, N0 = /* @__PURE__ */ new Set([
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
]), hm = {
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
}, gm = {
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
}, Es = ["font-size", "color", ...new Set([...Object.keys(hm), ...Object.keys(gm)].filter((n) => n !== "font-size" && n !== "color"))], T0 = new Set(Es);
function oe(n, a = " ") {
  const i = [];
  let o = 0, s = "";
  for (let u = 0; u < n.length; u++) {
    const m = n[u];
    if (m === "(" ? o++ : m === ")" && o--, o === 0 && (a === " " ? /\s/.test(m) : m === a)) {
      (s.trim() || a !== " ") && i.push(s.trim()), s = "";
      continue;
    }
    s += m;
  }
  return (s.trim() || a !== " " && i.length) && i.push(s.trim()), i;
}
function zs(n, a, i = 0) {
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
    const p = n.slice(u + 4, f - 1), v = oe(p, ","), x = v[0].trim(), y = v.length > 1 ? p.slice(p.indexOf(",") + 1).trim() : null;
    let b = a(x);
    if ((b == null || b === "initial") && (b = y), b == null) return null;
    const S = zs(b, a, i + 1);
    if (S === null) return null;
    o += S, s = f;
  }
}
function C0(n) {
  const a = [], i = /\s*(?:(-?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)(%|[a-z]+)?|([a-z-]+)\(|(infinity)|([()+*/,])|(-)(?=\s))/giy;
  let o, s = 0;
  for (; s < n.length; ) {
    if (i.lastIndex = s, o = i.exec(n), !o || o.index !== s) {
      if (/^\s+$/.test(n.slice(s))) break;
      return null;
    }
    s = i.lastIndex, o[1] !== void 0 ? a.push({ num: parseFloat(o[1]), unit: (o[2] ?? "").toLowerCase() }) : o[3] ? a.push({ fn: o[3].toLowerCase() }) : o[4] ? a.push({ num: 1 / 0, unit: "" }) : a.push({ op: o[5] ?? o[6] });
  }
  return a;
}
function Yn(n, a) {
  const i = C0(n.trim().replace(/env\(\s*safe-area-inset-(?:top|right|bottom|left)\s*(?:,[^()]*)?\)/gi, "0px"));
  if (!i) return null;
  let o = 0;
  const s = ({ num: b, unit: S }) => {
    switch (S) {
      case "":
        return { px: 0, pct: 0, num: b, unitless: !0 };
      case "px":
        return { px: b, pct: 0, num: 0 };
      case "rem":
        return { px: b * Ss, pct: 0, num: 0 };
      case "em":
        return { px: b * (a.fontSize ?? Ss), pct: 0, num: 0 };
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
    const b = i[o++];
    if (!b) return null;
    if (b.num !== void 0) return s(b);
    if (b.op === "(") {
      const S = x();
      return i[o]?.op !== ")" ? null : (o++, S);
    }
    if (b.op === "-" || b.op === "+") {
      const S = p();
      return b.op === "-" ? m(S, -1) : S;
    }
    if (b.fn) {
      const S = [];
      for (; ; ) {
        S.push(x());
        const N = i[o++];
        if (!N) return null;
        if (N.op === ")") break;
        if (N.op !== ",") return null;
      }
      if (S.some((N) => !N)) return null;
      if (b.fn === "calc") return S[0];
      if (!(S.every((N) => !N.pct) || S.every((N) => !N.px && !N.num))) return null;
      const E = (N) => N.px + N.pct + N.num;
      return b.fn === "min" ? S.reduce((N, j) => E(j) < E(N) ? j : N) : b.fn === "max" ? S.reduce((N, j) => E(j) > E(N) ? j : N) : b.fn === "clamp" && S.length === 3 ? E(S[1]) < E(S[0]) ? S[0] : E(S[1]) > E(S[2]) ? S[2] : S[1] : null;
    }
    return null;
  }
  function v() {
    let b = p();
    for (; i[o] && (i[o].op === "*" || i[o].op === "/"); ) {
      const S = i[o++].op, T = p();
      if (!b || !T) return null;
      S === "*" ? b = f(T) ? m(b, T.num) : f(b) ? m(T, b.num) : null : b = f(T) && T.num !== 0 ? m(b, 1 / T.num) : null;
    }
    return b;
  }
  function x() {
    let b = v();
    for (; i[o] && (i[o].op === "+" || i[o].op === "-"); ) {
      const S = i[o++].op;
      b = u(b, v(), S === "-" ? -1 : 1);
    }
    return b;
  }
  const y = x();
  return o !== i.length || !y ? null : y;
}
function Ns(n, a) {
  const i = n.trim().toLowerCase();
  if (/^(auto|none|normal|fit-content|max-content|min-content|medium|thin|thick)$/.test(i))
    return i === "thin" ? { px: 1 } : i === "medium" ? { px: 3 } : i === "thick" ? { px: 5 } : i;
  const o = Yn(i, a);
  return o ? o.unitless ? o.num === 0 ? { px: 0 } : { expr: n.trim() } : o.pct && (o.px || o.num) ? { expr: n.trim() } : o.pct ? { pct: o.pct } : { px: M0(o.px) } : { expr: n.trim() };
}
const M0 = (n) => Number.isFinite(n) ? n : n > 0 ? 34e37 : -34e37, qi = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0"), A0 = ([n, a, i, o]) => `#${qi(n)}${qi(a)}${qi(i)}${qi(o * 255)}`;
function mf(n) {
  const a = n.slice(1), i = a.length <= 4 ? a.split("").map((s) => s + s).join("") : a;
  if (!/^[0-9a-f]{6}([0-9a-f]{2})?$/i.test(i)) return null;
  const o = (s) => parseInt(i.slice(s, s + 2), 16);
  return [o(0), o(2), o(4), i.length === 8 ? o(6) / 255 : 1];
}
function nr(n, a) {
  const i = n.trim().toLowerCase();
  if (i === "currentcolor") return "currentcolor";
  const o = /^perchtoken\(([a-z0-9-]+)\)$/.exec(i);
  if (o) {
    const v = a(o[1]), x = v && mf(v);
    return x ? { rgba: x, token: o[1] } : null;
  }
  if (i.startsWith("#")) {
    const v = mf(i);
    return v ? { rgba: v, token: null } : null;
  }
  if (ff[i]) return { rgba: [...ff[i]], token: null };
  const s = /^(rgba?|color-mix)\((.*)\)$/s.exec(i);
  if (!s) return null;
  if (s[1] === "color-mix") {
    const v = oe(s[2], ",");
    if (v.length !== 3 || !/^in\s+(srgb|srgb-linear|oklab|lab|oklch|lch|hsl|xyz)/.test(v[0])) return null;
    const x = (M) => {
      const Y = oe(M), Z = Y.findIndex((I) => /%$/.test(I)), D = Z >= 0 ? parseFloat(Y[Z]) / 100 : null;
      return { color: nr(Y.filter((I, G) => G !== Z).join(" "), a), pct: D };
    }, y = x(v[1]), b = x(v[2]);
    if (!y.color || !b.color || y.color === "currentcolor" || b.color === "currentcolor") return null;
    let S = y.pct, T = b.pct;
    S === null && T === null ? (S = 0.5, T = 0.5) : S === null ? S = 1 - T : T === null && (T = 1 - S);
    const E = S + T, N = E < 1 ? E : 1;
    S /= E, T /= E;
    const [j, R, U, F] = y.color.rgba, [W, B, g, h] = b.color.rgba, _ = F * S + h * T, k = (M, Y) => _ === 0 ? 0 : (M * F * S + Y * h * T) / _, z = [k(j, W), k(R, B), k(U, g), _ * N], O = h === 0 ? y.color.token : F === 0 ? b.color.token : null;
    return { rgba: z, token: O };
  }
  const u = s[2].includes(",") ? oe(s[2], ",") : oe(s[2].replace("/", " / ")).filter((v) => v !== "/");
  if (u.length < 3) return null;
  const m = (v) => v.endsWith("%") ? parseFloat(v) / 100 * 255 : parseFloat(v), f = u[3] === void 0 ? 1 : u[3].endsWith("%") ? parseFloat(u[3]) / 100 : parseFloat(u[3]), p = [m(u[0]), m(u[1]), m(u[2]), f];
  return p.some((v) => Number.isNaN(v)) ? null : { rgba: p, token: null };
}
const zl = ["top", "right", "bottom", "left"], j0 = ["top-left", "top-right", "bottom-right", "bottom-left"], Gi = (n) => [n[0], n[1] ?? n[0], n[2] ?? n[0], n[3] ?? n[1] ?? n[0]], pf = /* @__PURE__ */ new Set(["none", "hidden", "solid", "dashed", "dotted", "double", "groove", "ridge", "inset", "outset"]);
function Ts(n, a) {
  const i = a.trim(), o = () => oe(i);
  switch (n) {
    case "padding":
    case "margin": {
      const s = Gi(o());
      return zl.map((u, m) => [`${n}-${u}`, s[m]]);
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
      const s = Gi(o());
      return zl.map((u, m) => [u, s[m]]);
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
      const s = n.split("-")[1], u = Gi(o());
      return zl.map((m, f) => [`border-${m}-${s}`, u[f]]);
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
      const s = n === "border" ? zl : n === "border-inline" ? ["left", "right"] : n === "border-block" ? ["top", "bottom"] : n === "border-inline-start" ? ["left"] : n === "border-inline-end" ? ["right"] : [n.slice(7)];
      let u = "medium", m = "none", f = "currentcolor";
      if (i !== "none" && i !== "0")
        for (const p of o())
          pf.has(p) ? m = p : /^(thin|medium|thick|-?[\d.]|calc\()/.test(p) ? u = p : f = p;
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
      const s = Gi(oe(i.split("/")[0]));
      return j0.map((u, m) => [`border-${u}-radius`, s[m]]);
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
      return i === "none" ? [["background-color", "transparent"], ["background-image", "none"]] : nr(i, () => "#000000") ? [["background-color", i], ["background-image", "none"]] : [["background-color", "transparent"], ["background-image", i]];
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
      return Ts("gap", i);
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
        pf.has(f) || f === "auto" ? u = f : /^(thin|medium|thick|-?[\d.]|calc\()/.test(f) ? s = f : m = f;
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
function O0(n, a) {
  return n ? oe(n, ",").some((i) => {
    let o = i.trim().toLowerCase(), s = !1;
    o.startsWith("not ") && (s = !0, o = o.slice(4)), o.startsWith("only ") && (o = o.slice(5));
    const u = o.split(/\s+and\s+/).every((m) => {
      if (m = m.trim(), m === "all" || m === "screen") return !0;
      if (m === "print") return !1;
      const f = /^\((.+)\)$/.exec(m);
      if (!f) return !1;
      const p = f[1].trim(), v = /^([a-z-]+)\s*:\s*(.+)$/.exec(p);
      if (v) {
        const [, y, b] = v, S = (T) => {
          const E = Ns(T, { viewport: a });
          return typeof E == "object" && "px" in E ? E.px : NaN;
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
      const x = /^(width|height)\s*(>=|<=|>|<|=)\s*(.+)$/.exec(p);
      if (x) {
        const y = x[1] === "width" ? a.width : a.height, b = Ns(x[3], { viewport: a }), S = typeof b == "object" && "px" in b ? b.px : NaN;
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
    return s ? !u : u;
  }) : !0;
}
function R0(n, a) {
  const i = a[a.length - 1].compound;
  return Xs(i)[0] ?? n;
}
function D0(n) {
  const a = (i) => i.some((o) => br.has(o.name) || (o.list ?? []).some((s) => s.some(({ compound: u }) => a(u.pseudos))));
  return a(n[n.length - 1].compound.pseudos);
}
function B0(n) {
  const a = /* @__PURE__ */ new Set(), i = /* @__PURE__ */ new Set(), o = (s, u) => {
    s.forEach(({ compound: m }, f) => {
      const p = u && f === s.length - 1;
      for (const v of m.pseudos)
        if (br.has(v.name) && (p ? a : i).add(v.name), v.list && v.name !== "not") for (const x of v.list) o(x, p);
    });
  };
  return o(n, !0), { subject: a, ancestor: i };
}
function Xs(n) {
  const a = [...n.classes];
  for (const i of n.pseudos)
    if (!(i.name !== "is" && i.name !== "where"))
      for (const o of i.list) o.length === 1 && a.push(...Xs(o[0].compound));
  return a;
}
function H0(n, a) {
  const i = (o, s) => {
    o.forEach(({ compound: u }, m) => {
      const f = s && m === o.length - 1, p = u.pseudos.filter((v) => br.has(v.name)).map((v) => v.name);
      if (!f) for (const v of p) for (const x of Xs(u)) a.add(`${v}:${x}`);
      for (const v of u.pseudos) if (v.list && v.name !== "not") for (const x of v.list) i(x, f);
    });
  };
  i(n, !0);
}
class U0 {
  constructor(a) {
    this.properties = a.properties ?? {}, this.rules = [], this.skipped = 0, this.index = /* @__PURE__ */ new Map(), this.trackedStates = /* @__PURE__ */ new Set(), this.dependsCache = /* @__PURE__ */ new Map(), this.candidateCache = /* @__PURE__ */ new Map(), this.selectorAttrs = /* @__PURE__ */ new Set(), this.subjectAttrs = /* @__PURE__ */ new Set();
    const i = (u, m) => {
      const f = m[m.length - 1].compound;
      for (const v of f.attrs) this.subjectAttrs.add(v.name);
      const p = f.classes.length ? `.${f.classes[0]}` : f.tag && f.tag !== "*" ? f.tag : "*";
      this.index.has(p) || this.index.set(p, []), this.index.get(p).push(u);
    };
    let o = 0;
    const s = (u, m) => {
      for (const [f, p, v, x] of u)
        for (const y of Ls(f)) {
          let b;
          try {
            b = Vs(y);
          } catch (N) {
            if (N instanceof re) {
              this.skipped++;
              continue;
            }
            throw N;
          }
          const S = B0(b);
          ym(b, this.selectorAttrs), H0(b, this.trackedStates);
          const T = b[b.length - 1].compound.pseudoElement, E = { steps: b, media: p, layer: v, origin: m, order: o++, specificity: nm(b), decls: x, states: S, pseudo: T, own: L0(b), assumed: D0(b), above: G0(b), source: m === 0 ? `ua:${b[b.length - 1].compound.tag ?? "*"}` : R0(y, b) };
          this.rules.push(E), i(E, b);
        }
    };
    s(z0.map(([u, m]) => [u, null, 0, Object.entries(m)]), 0), s(a.rules, 1);
  }
  /** Rules that may match `element` (by its classes, its tag, and the universal ones), or its `pseudo` box
   * (`before`, `after`). */
  candidates(a, i = null, o = null) {
    const s = `${a.tagName} ${a.className}|${i ?? ""}|${o ?? ""}`, u = this.candidateCache.get(s);
    if (u) return u;
    if (o !== null) {
      const x = this.candidates(a, i).filter((y) => {
        const b = y.reads ??= Cs(y.steps);
        return (b.has || b.focusWithin) === o;
      });
      return this.candidateCache.set(s, x), x;
    }
    const m = [], f = /* @__PURE__ */ new Set(), p = new Set(a.classList), v = (x) => {
      if (x) for (const y of x) !f.has(y) && y.pseudo === i && (f.add(y), bm(y.steps[y.steps.length - 1].compound, a.tagName, p) && m.push(y));
    };
    for (const x of a.classList) v(this.index.get(`.${x}`));
    return v(this.index.get(a.tagName)), v(this.index.get("*")), this.candidateCache.set(s, m), m;
  }
  /** What the rules that may match `element` (any pseudo-element) read besides the element and its parent's computed
   * style: `anc`, an ancestor's attributes or state; `pos`, whether it is its parent's first or last child; `nth`, its
   * index; `ancPos`, an ancestor's position. The description's cache keys on exactly these (`describe.mjs`). */
  depends(a) {
    const i = a.dependsIn;
    if (i && i.sheet === this && i.version === a.version) return i.deps;
    const o = this.dependsOf(a);
    return a.version !== void 0 && (a.dependsIn = { sheet: this, version: a.version, deps: o }), o;
  }
  dependsOf(a) {
    const i = (f) => a.getAttribute?.(f) != null;
    let o = `${a.tagName} ${a.className}`;
    for (const f of this.subjectAttrs) i(f) && (o += ` [${f}]`);
    let s = this.dependsCache.get(o);
    if (s) return s;
    s = { anc: !1, pos: !1, nth: !1, ancPos: !1, has: !1, focusWithin: !1 };
    const u = /* @__PURE__ */ new Set(), m = (f) => {
      for (const p of f ?? []) {
        if (u.has(p) || !p.steps[p.steps.length - 1].compound.attrs.every((x) => i(x.name))) continue;
        u.add(p);
        const v = p.reads ??= Cs(p.steps);
        s.anc ||= v.anc, s.pos ||= v.pos, s.nth ||= v.nth, s.ancPos ||= v.ancPos, s.has ||= v.has, s.focusWithin ||= v.focusWithin;
      }
    };
    for (const f of a.classList) m(this.index.get(`.${f}`));
    return m(this.index.get(a.tagName)), m(this.index.get("*")), this.dependsCache.set(o, s), s;
  }
  /** Whether a rule that may match `element` reads interaction `state` on one of its ancestors (`group-hover:`). */
  readsAncestor(a, i) {
    return this.candidates(a).some((o) => o.states.ancestor.has(i));
  }
  /** Whether `element` carries a class whose interaction state some rule reads on an ancestor. */
  tracks(a, i) {
    for (const o of a.classList) if (this.trackedStates.has(`${i}:${o}`)) return !0;
    return !1;
  }
}
function bm(n, a, i) {
  if (n.tag && n.tag !== "*" && n.tag !== a) return !1;
  for (const o of n.classes) if (!i.has(o)) return !1;
  for (const o of n.pseudos) {
    if (o.name === "has") return !0;
    if (o.name === "root" && a !== "html" || (o.name === "where" || o.name === "is") && o.list.every((s) => s.length === 1 && !bm(s[0].compound, a, i))) return !1;
  }
  return !0;
}
const q0 = /* @__PURE__ */ new Set(["first-child", "last-child", "only-child", "nth-child"]);
function G0(n) {
  const a = [];
  for (let i = n.length - 1; i > 0 && !(n[i].combinator !== " " && n[i].combinator !== ">"); i--)
    a.push(...n[i - 1].compound.classes);
  return a;
}
function vm(n) {
  const a = n.parentElement;
  if (!a) return Y0;
  const i = vm(a), o = n.aboveCache;
  if (o && o.parent === a && o.name === a.className && o.base === i) return o.set;
  const s = a.classSet, u = s.size === 0 ? i : /* @__PURE__ */ new Set([...i, ...s]);
  return n.aboveCache = { parent: a, name: a.className, base: i, set: u }, u;
}
const Y0 = /* @__PURE__ */ new Set();
function L0(n) {
  if (n.length !== 1) return !1;
  const { compound: a } = n[0];
  return !a.id && !a.attrs.length && a.pseudos.every((i) => br.has(i.name) && i.name !== "focus-within");
}
function ym(n, a) {
  for (const { compound: i } of n) {
    for (const o of i.attrs) a.add(o.name);
    for (const o of i.pseudos) for (const s of o.list ?? []) ym(s, a);
  }
}
function Cs(n, a = !0, i = { anc: !1, pos: !1, nth: !1, ancPos: !1, has: !1, focusWithin: !1 }) {
  return n.forEach((o, s) => {
    const u = a && s === n.length - 1;
    u || (i.anc = !0);
    for (const m of o.compound.pseudos)
      if (q0.has(m.name) && (u ? i.pos = !0 : i.ancPos = !0, m.name === "nth-child" && u && (i.nth = !0)), m.name === "has" && (i.has = !0), m.name === "focus-within" && (i.focusWithin = !0), m.list && m.name !== "has") for (const f of m.list) Cs(f, u, i);
  }), i;
}
const V0 = /* @__PURE__ */ new Set(["opacity", "z-index", "flex-grow", "flex-shrink", "font-weight", "line-height", "flex", "order", "-webkit-line-clamp", "zoom"]);
function hf(n) {
  if (!n || typeof n != "object") return [];
  const a = [];
  for (const [i, o] of Object.entries(n)) {
    if (o == null || o === "" || typeof o == "boolean") continue;
    const s = i.startsWith("--") ? i : i.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`).replace(/^(webkit|moz|ms)-/, "-$1-"), u = typeof o == "number" && o !== 0 && !V0.has(s) && !s.startsWith("--") ? `${o}px` : String(o);
    a.push([s, u]);
  }
  return a;
}
const Q0 = { className: "class", htmlFor: "for", tabIndex: "tabindex" };
function gf(n) {
  if (n.tagName !== "svg") return [];
  const a = [];
  for (const i of ["width", "height"]) {
    const o = n.getAttribute(i);
    o !== null && a.push([i, /^[\d.]+$/.test(o) ? `${o}px` : o]);
  }
  return a;
}
const K0 = (n, a) => n.important - a.important || n.origin - a.origin || n.layer - a.layer || n.specificity[0] - a.specificity[0] || n.specificity[1] - a.specificity[1] || n.specificity[2] - a.specificity[2] || n.order - a.order;
class X0 {
  constructor(a, { theme: i, viewport: o }) {
    this.sheet = a, this.theme = i, this.viewport = o, this.parsed = /* @__PURE__ */ new Map(), this.computed = /* @__PURE__ */ new WeakMap(), this.rootComputed = /* @__PURE__ */ new Map(), this.media = /* @__PURE__ */ new Map(), this.ownMatches = /* @__PURE__ */ new Map(), this.pass = null, this.matched = /* @__PURE__ */ new Map(), this.signatures = /* @__PURE__ */ new Map(), this.nextSignature = 0;
  }
  mediaHolds(a) {
    if (!a.media) return !0;
    for (const i of a.media) {
      let o = this.media.get(i);
      if (o === void 0 && this.media.set(i, o = O0(i, this.viewport)), !o) return !1;
    }
    return !0;
  }
  themeHex(a) {
    return this.theme?.[a] ?? null;
  }
  /** Rules matching `element`; `assume` is the set of interaction states assumed on the element itself
   * (`"*"`: any, for finding variant rules). Ancestors use their real state. */
  matching(a, i, o = null, s = null) {
    if (!this.pass) return this.match(a, i, o, s);
    const u = `${this.signature(a)}|${o ?? ""}|${i === "*" ? "*" : [...i].sort().join(",")}`;
    let m = this.matched.get(u);
    m || (this.matched.size > 2e4 && (this.matched.clear(), this.signatures.clear()), this.matched.set(u, m = this.match(a, i, o, s, !1)));
    const f = this.match(a, i, o, s, !0);
    return f.length ? [...m, ...f] : m;
  }
  /** A number for what a selector can read of `element` and its ancestors (tag, classes, id, the attributes some
   * selector reads, state, position among its siblings, being the root): equal numbers match the same rules. Worked
   * out once per element per describe pass. */
  signature(a) {
    if (!a) return -1;
    const i = a.signatureIn;
    if (i && i.pass === this.pass) return i.id;
    const o = a.parentElement, s = this.sheet.depends(a), u = (b) => {
      let S = b.parentElement.kidsIn;
      return (!S || S.pass !== this.pass) && (b.parentElement.kidsIn = S = { pass: this.pass, list: b.parentElement.children }), `${S.list.indexOf(b)}/${S.list.length}.`;
    };
    let m = s.pos && o ? u(a) : "";
    if (s.ancPos) for (let b = o; b?.parentElement; b = b.parentElement) m += u(b);
    let f = "";
    for (const b in a.props ?? {}) {
      const S = Q0[b] ?? b;
      if (!this.sheet.selectorAttrs.has(S)) continue;
      const T = a.getAttribute(S);
      T !== null && (f += `${S}=${T}`);
    }
    const p = a.state, v = a.props ?? {}, x = `${this.signature(o)}\0${a.tagName} ${a.className}#${a.getAttribute?.("id") ?? ""}[${f}]${+!!p?.hover}${+!!p?.focus}${+!!p?.active}${+!!p?.pointerFocus}${+!!v.disabled}${+!!v.checked}${+!!a.isDocumentRoot}@${m}`;
    let y = this.signatures.get(x);
    return y === void 0 && this.signatures.set(x, y = this.nextSignature++), a.signatureIn = { pass: this.pass, id: y }, y;
  }
  /** Everything of `element` its own style is computed from, its parent's style aside (`signature`, presentational
   * attributes, inline style, `hidden`): elements with equal keys under one parent style compute alike. */
  partKey(a) {
    const i = gf(a), o = hf(a.inlineStyle ?? a.props?.style);
    return `${this.signature(a)}|${i.length ? JSON.stringify(i) : ""}|${o.length ? JSON.stringify(o) : ""}|${+!!a.hidden}`;
  }
  /** `matching` without the memo; with `live` true only the rules that read descendants or focus, false the others. */
  match(a, i, o = null, s = null, u = null) {
    const f = { state: (E, N, j) => {
      if (N === "disabled") return !!E.props?.disabled && ["button", "input", "select", "textarea", "fieldset"].includes(E.tagName);
      if (N === "enabled") return !E.props?.disabled && ["button", "input", "select", "textarea"].includes(E.tagName);
      if (N === "checked") return !!E.props?.checked;
      if (i === "*") return !0;
      if (N === "focus-within") {
        const R = E.ownerDocument?.activeElement;
        return !!R && R !== E.ownerDocument.body && typeof E.contains == "function" && E.contains(R);
      }
      return j ? i.has(N) : N === "focus-visible" ? !!E.state?.focus && !E.state?.pointerFocus : !!E.state?.[N];
    }, pseudo: o }, p = u === null ? this.sheet.candidates(a, o) : this.sheet.candidates(a, o, u), v = `${a.tagName} ${a.className}|${o ?? ""}|${u ?? ""}|${i === "*" ? "*" : [...i].sort().join(",")}`;
    let x = this.ownMatches.get(v);
    x || (x = new Set(p.filter((E) => E.own && this.mediaHolds(E) && ys(a, E.steps, f))), this.ownMatches.set(v, x));
    let y = null;
    const b = (E) => E.above.length ? (y ??= vm(a), E.above.every((N) => y.has(N))) : !0, S = s && i !== "*" ? s[o ?? ""] ??= /* @__PURE__ */ new Map() : null, T = (E) => this.mediaHolds(E) && b(E) && ys(a, E.steps, f);
    return p.filter((E) => {
      if (E.own) return x.has(E);
      if (!S || E.assumed) return T(E);
      let N = S.get(E);
      return N === void 0 && S.set(E, N = T(E)), N;
    });
  }
  /** `element`'s computed style, or with `pseudo` (`before`, `after`) that of its pseudo-element's box, whose parent
   * is the element (pass the element's own computed style as `parent`). */
  compute(a, i, o = /* @__PURE__ */ new Set(), s = null, u = null) {
    const m = this.matching(a, o, s, u), f = s ? [] : gf(a), p = s ? [] : hf(a.inlineStyle ?? a.props?.style);
    let v = this.rootComputed;
    i && (v = this.computed.get(i.values), v || this.computed.set(i.values, v = /* @__PURE__ */ new Map()));
    const x = `${m.map((b) => b.order).join(",")}|${f.length ? JSON.stringify(f) : ""}|${p.length ? JSON.stringify(p) : ""}`;
    let y = v.get(x);
    return y || v.set(x, y = this.cascade(m, f, p, i)), { ...y, rules: m, element: a, shared: y };
  }
  /** The computed style from the matched `rules`, presentational `attrs`, `inline` declarations and the parent's. */
  cascade(a, i, o, s) {
    const u = [];
    for (const g of a)
      for (const [h, _, k] of g.decls) u.push({ prop: h, value: _, important: k ? 1 : 0, origin: g.origin === 0 ? 0 : 2, layer: g.layer, specificity: g.specificity, order: g.order, source: g.source });
    for (const [g, h] of i) u.push({ prop: g, value: h, important: 0, origin: 1, layer: 0, specificity: [0, 0, 0], order: 0, source: `attr:${g}` });
    for (const [g, h] of o) u.push({ prop: g, value: h, important: 0, origin: 3, layer: 0, specificity: [1, 0, 0], order: 0, source: "style" });
    u.sort(K0);
    const m = this.sheet.properties, f = Object.create(s?.customs ?? null), p = /* @__PURE__ */ new Map(), v = /* @__PURE__ */ new Map();
    for (const g of u) g.prop.startsWith("--") && v.set(g.prop, g.value);
    if (!s && this.theme) for (const g of pm) this.theme[g] && v.set(`--${g}`, `perchtoken(${g})`);
    const x = (g) => {
      if (p.has(g)) return p.get(g);
      const h = m[g];
      return h && !h.inherits ? h.initial ?? null : g in f ? f[g] : h?.initial ?? null;
    }, y = /* @__PURE__ */ new Set(), b = (g) => {
      if (!v.has(g)) return x(g);
      if (y.has(g)) return null;
      y.add(g);
      const h = zs(v.get(g), b);
      return y.delete(g), v.delete(g), p.set(g, h), (!m[g] || m[g].inherits) && (f[g] = h), h;
    };
    for (const g of [...v.keys()]) b(g);
    const S = /* @__PURE__ */ new Map();
    for (const g of u) {
      if (g.prop.startsWith("--")) continue;
      const h = zs(g.value, x);
      if (h === null) {
        for (const [_] of Ts(g.prop, "unset")) S.set(_, { value: "unset", source: g.source, origin: g.origin });
        continue;
      }
      for (const [_, k] of Ts(g.prop, h)) S.set(_, { value: k, source: g.source, origin: g.origin });
    }
    const T = {}, E = {}, N = /* @__PURE__ */ new Set(), j = /* @__PURE__ */ new Set(), R = s?.values, U = { fontSize: R?.["font-size"] ?? Ss, viewport: this.viewport }, F = (g, h) => {
      if (/currentcolor/i.test(h)) return this.parseValue(g, h, U, T, R);
      const _ = `${g}\0${h}\0${U.fontSize}`;
      let k = this.parsed.get(_);
      return k === void 0 && this.parsed.set(_, k = this.parseValue(g, h, U, T, R)), k;
    }, W = S.size ? [...Es, ...[...S.keys()].filter((g) => !T0.has(g))] : Es;
    for (const g of W) {
      const h = S.get(g);
      let _ = h?.value;
      const k = N0.has(g);
      if ((_ === void 0 || _ === "unset" || _ === "revert" || _ === "revert-layer") && (_ = k ? "inherit" : "initial"), h && (E[g] = h.source, h.origin !== 0 && N.add(g)), _ === "inherit" && R && g in R) {
        T[g] = R[g], j.add(g);
        continue;
      }
      (_ === "inherit" || _ === "initial") && (_ = k ? gm[g] : hm[g]), T[g] = F(g, _), g === "font-size" && (U.fontSize = T["font-size"]);
    }
    for (const g of zl) {
      const h = T[`border-${g}-style`];
      (h === "none" || h === "hidden") && (T[`border-${g}-width`] = { px: 0 });
    }
    T["outline-style"] === "none" && (T["outline-width"] = { px: 0 });
    const B = R?.display;
    return (B === "flex" || B === "inline-flex" || B === "grid" || B === "inline-grid") && T.position !== "absolute" && T.position !== "fixed" && (T.display = bf(T.display)), (T.position === "absolute" || T.position === "fixed") && (T.display = bf(T.display)), { values: T, sources: E, own: N, inherited: j, customs: f };
  }
  parseValue(a, i, o, s, u) {
    const m = String(i).trim();
    switch (a) {
      case "font-size": {
        const f = m.toLowerCase(), p = { "xx-small": 9, "x-small": 10, small: 13, medium: 16, large: 18, "x-large": 24, "xx-large": 32 };
        if (p[f]) return p[f];
        if (f === "smaller") return o.fontSize / 1.2;
        if (f === "larger") return o.fontSize * 1.2;
        const v = Yn(f, { fontSize: o.fontSize, viewport: o.viewport });
        return !v || v.num ? o.fontSize : v.px + v.pct / 100 * o.fontSize;
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
        const p = Yn(f, { fontSize: o.fontSize, viewport: o.viewport });
        return p ? p.unitless ? { factor: p.num } : { px: p.px + p.pct / 100 * o.fontSize } : { normal: !0 };
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
        const f = nr(m, (p) => this.themeHex(p));
        return f === "currentcolor" || !f ? u?.color ?? { rgba: [0, 0, 0, 1], token: null } : f;
      }
      case "background-color":
      case "border-top-color":
      case "border-right-color":
      case "border-bottom-color":
      case "border-left-color":
      case "outline-color": {
        const f = nr(m, (p) => this.themeHex(p));
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
        return Ns(m, o);
      default:
        return m.toLowerCase().startsWith("var(") ? m : /^[a-z-]+$/i.test(m) ? m.toLowerCase() : m;
    }
  }
}
function bf(n) {
  return n === "inline" || n === "inline-block" || n === "contents" ? "block" : n === "inline-flex" ? "flex" : n === "inline-grid" ? "grid" : n;
}
const ar = (n) => n && n.rgba ? { value: A0(n.rgba), token: n.token ?? null } : null, Z0 = { 9.28: 11, 9.92: 12, 10.4: 12, 10.88: 13, 11: 13, 11.2: 13, 11.52: 13, 12: 15, 12.5: 15, 13: 16, 14: 17, 16: 19 };
function J0(n, a) {
  const i = a?.(n);
  if (Number.isFinite(i)) return i;
  const o = Math.round(n * 100) / 100;
  return Z0[o] ?? Math.round(n * 1.2);
}
function Tl(n, a) {
  const i = n["line-height"], o = n["font-size"];
  return i.normal ? J0(o, a) : i.factor !== void 0 ? i.factor * o : i.px;
}
const W0 = (n) => oe(n, ",").map((a) => a.trim().replace(/^["']|["']$/g, "")).join(", ");
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
const F0 = "perch-native-description/1", Le = Symbol("display"), lr = {
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
}, $0 = ["w", "h", "min_w", "min_h", "max_w", "max_h", "top", "right", "bottom", "left", "pt", "pr", "pb", "pl", "mt", "mr", "mb", "ml", "gap_x", "gap_y", "border_t", "border_r", "border_b", "border_l", "rounded_tl", "rounded_tr", "rounded_br", "rounded_bl"];
for (const n of $0) lr[n] = /^(w|h|min_|max_|top|right|bottom|left)/.test(n) ? "auto" : 0;
lr.rounded = 0;
const I0 = /* @__PURE__ */ new Set([
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
]), P0 = /(-apple-system|blinkmacsystemfont|system-ui|segoe ui|sans-serif|times)/i, tb = /(ui-monospace|sfmono|sf mono|menlo|monospace)/i, eb = /^\s*["']?(ui-monospace|sfmono-regular|sf mono)["']?\s*(,|$)/i, nb = (n) => eb.test(n ?? "") ? ".AppleSystemUIFontMonospaced" : tb.test(n) ? "Menlo" : /^\s*system-ui\s*$/i.test(n ?? "") ? ".AppleSystemUIFont" : P0.test(n) ? ".SystemUIFont" : W0(n).split(",")[0].trim(), xm = {
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
}, vf = Object.keys(xm), yf = Object.fromEntries(Object.entries(xm).flatMap(([n, a], i) => a.map((o) => [o, 1 << i]))), xf = { pointerdown: "mouse_down", mousedown: "mouse_down", click: "click", keydown: "key_down", pointerup: "mouse_up", mouseup: "mouse_up" }, Bl = (n) => {
  const a = n.props["data-testid"];
  if (a) return `${n.tagName}[data-testid="${a}"]`;
  if (n.props.id) return `${n.tagName}#${n.props.id}`;
  const i = n.classList.find((s) => !s.includes(":") && !s.includes("[")) ?? n.classList[0];
  if (i) return `${n.tagName}.${i}`;
  const o = n.parentElement;
  return o && o.tagName !== "body" ? `${Bl(o)} > ${n.tagName}` : n.tagName;
};
class ab {
  constructor() {
    this.map = /* @__PURE__ */ new Map();
  }
  add(a, i, o, s, u, m = "") {
    const f = `${a}|${i}|${o}|${s}`, p = this.map.get(f);
    if (p) {
      !p.elements.includes(u) && p.elements.length < 4 && p.elements.push(u), p.count++;
      return;
    }
    this.map.set(f, { kind: a, property: i, value: String(o), class: s ?? null, elements: [u], count: 1, ...m ? { note: m } : {} });
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
}, fs = /^(text|search|url|email|tel|password|number)$/, lb = 162.13 / 12.8;
function ib(n, a) {
  const i = typeof n == "object" && /^min\((.*)\)$/.exec(String(n?.expr ?? "").trim());
  if (!i) return;
  const o = oe(i[1], ",").map((s) => Yn(s.trim(), { fontSize: a })).filter((s) => s && !s.pct && !s.num).map((s) => s.px);
  return o.length ? Math.min(...o) : void 0;
}
function rb(n, a) {
  if (typeof n != "object" || !n?.expr) return !1;
  const i = Yn(n.expr, { fontSize: a["font-size"] }), o = (a["margin-left"]?.px ?? NaN) + (a["margin-right"]?.px ?? NaN);
  return !!i && !i.num && i.pct === 100 && Math.abs(i.px + o) < 0.01;
}
function wm(n) {
  const a = n.transform;
  if (a && a !== "none") {
    const o = /^\s*translate(X|Y)?\(([^]*)\)\s*$/.exec(a), s = o && oe(o[2], ",").map((u) => u.trim());
    return !s || s.length > (o[1] ? 1 : 2) ? null : o[1] === "X" ? [s[0], "0"] : o[1] === "Y" ? ["0", s[0]] : [s[0], s[1] ?? "0"];
  }
  const i = n.translate;
  if (i && i !== "none") {
    const o = oe(String(i).trim(), " ").filter(Boolean);
    return o.length > 3 || o[2] !== void 0 && Yn(o[2], {})?.px ? null : [o[0], o[1] ?? "0"];
  }
  return [];
}
function wf(n, a, i, o = !1) {
  const s = n.values, u = wm(s);
  if (u?.length === 0) return;
  const m = s.transform && s.transform !== "none" ? "transform" : "translate", f = { fontSize: s["font-size"] }, p = (y, b) => {
    const S = Yn(y, f);
    if (!(!S || S.unitless && S.num))
      return S.pct ? typeof b == "number" ? S.px + S.pct / 100 * b : void 0 : S.px;
  }, v = u ? p(u[0], a.w) : void 0, x = u ? p(u[1], a.h) : void 0;
  if (v === void 0 || x === void 0) {
    const y = !o && u ? u.map((b) => Yn(b, f)) : null;
    if (y?.every((b) => b && !(b.unitless && b.num))) {
      a[_m] = y.map((b) => [b.px, b.pct ?? 0]);
      return;
    }
    i("unsupported", m, s[m], n.sources[m]);
    return;
  }
  if (o) {
    v && (a.left = v), x && (a.top = x);
    return;
  }
  v && (a.ml = (a.ml ?? 0) + v), x && (a.mt = (a.mt ?? 0) + x);
}
const _m = Symbol("perch.shift");
function ob(n, a, i) {
  const o = n.ownerDocument, s = o?.measure?.(n) ?? null;
  if (s) {
    const [[m, f], [p, v]] = i, x = m + f / 100 * s.width, y = p + v / 100 * s.height;
    x && (a.ml = (typeof a.ml == "number" ? a.ml : 0) + x), y && (a.mt = (typeof a.mt == "number" ? a.mt : 0) + y);
  }
  const u = s ? `${s.width}x${s.height}` : "";
  u === n.shiftSeen ? n.shiftTries = 0 : (n.shiftTries ?? 0) < om && o?.retries && (n.shiftSeen = u, n.shiftTries = (n.shiftTries ?? 0) + 1, o.retries.push(() => o.afterCommit?.()));
}
function ir(n, a, i = null) {
  const o = n.values, s = {}, u = (U) => n.sources[U], m = (U) => n.sources[U] !== void 0, f = o.display;
  f === "none" ? s.display = "hidden" : f === "flex" || f === "inline-flex" ? s.display = "flex" : (f === "grid" || f === "inline-grid") && (s.display = "flex", s.flex_direction = "col", a("approximated", "display", f, u("display"), "one-column flex column"), o["grid-template-columns"] && o["grid-template-columns"] !== "none" && a("unsupported", "grid-template-columns", o["grid-template-columns"], u("grid-template-columns"))), n.element.hidden && (s.display = "hidden");
  const p = s.display === "flex";
  if (p && s.flex_direction !== "col") {
    const U = { row: "row", column: "col", "row-reverse": "row_reverse", "column-reverse": "col_reverse" }[o["flex-direction"]] ?? "row";
    s.flex_direction = U;
  }
  if (p) {
    (o["flex-wrap"] === "wrap" || o["flex-wrap"] === "wrap-reverse") && (s.flex_wrap = "wrap");
    const U = f === "grid" || f === "inline-grid", F = { "flex-start": "start", start: "start", "self-start": "start", "flex-end": "end", end: "end", "self-end": "end", center: "center", baseline: "baseline", "first baseline": "baseline" }[o["align-items"]];
    F && (s.items = F);
    let W = { "flex-start": "start", start: "start", "flex-end": "end", end: "end", center: "center", "space-between": "between", "space-around": "around", "space-evenly": "evenly" }[o["justify-content"]];
    if (U) {
      const h = { center: "center", end: "end", "flex-end": "end", start: "start", "flex-start": "start" }[o["justify-items"]];
      h && (s.items = h), o["align-items"] === "center" && (W = "center");
    }
    W && (s.justify = W);
    const B = hn(o["row-gap"]), g = hn(o["column-gap"]);
    typeof B == "number" && B && (s.gap_y = B), typeof g == "number" && g && !U && (s.gap_x = g);
  }
  o["flex-grow"] && (s.flex_grow = o["flex-grow"]), o["flex-shrink"] !== 1 && (s.flex_shrink = o["flex-shrink"]);
  const v = hn(o["flex-basis"]);
  v !== void 0 && v !== "auto" && (s.flex_basis = v);
  const x = { "flex-start": "start", start: "start", "flex-end": "end", end: "end", center: "center", baseline: "baseline", stretch: "stretch" }[o["align-self"]];
  x && (s.self = x);
  for (const [U, F] of [["w", "width"], ["h", "height"], ["min_w", "min-width"], ["min_h", "min-height"], ["max_w", "max-width"], ["max_h", "max-height"]]) {
    const W = o[F], B = hn(W);
    if (B === void 0 && F === "width" && rb(W, o)) {
      s.self = "stretch", a("approximated", F, W.expr, u(F), "stretched across its parent, inside its margins");
      continue;
    }
    const g = B === void 0 && /^max-/.test(F) ? ib(W, o["font-size"]) : void 0;
    if (g !== void 0) {
      s[U] = g, a("approximated", F, W.expr, u(F), "the fixed bound of min()");
      continue;
    }
    if (B === void 0) {
      typeof W == "object" && W.expr ? a("unsupported", F, W.expr, u(F), "no calc() in the engine") : typeof W == "string" && !["auto", "none"].includes(W) && a("unsupported", F, W, u(F));
      continue;
    }
    B !== "auto" && (s[U] = B);
  }
  const y = ["top", "right", "bottom", "left"];
  for (const U of y) {
    const F = U[0];
    for (const [W, B] of [["p", "padding"], ["m", "margin"]]) {
      const g = o[`${B}-${U}`], h = hn(g);
      if (h === void 0) {
        g?.expr && a("unsupported", `${B}-${U}`, g.expr, u(`${B}-${U}`), "no calc() in the engine");
        continue;
      }
      h !== 0 && (s[`${W}${F}`] = h);
    }
  }
  const b = o.position;
  if (b === "absolute" || b === "fixed") {
    s.position = "absolute", b === "fixed" && a("approximated", "position", "fixed", u("position"), "absolute in the overlay layer");
    for (const U of y) {
      const F = hn(o[U]);
      F !== void 0 && F !== "auto" && (s[U] = F);
    }
    if (b === "fixed" && i && s.w === void 0 && s.right === void 0 && typeof s.left == "number") {
      const U = i.width - s.left - (typeof s.ml == "number" ? s.ml : 0) - (typeof s.mr == "number" ? s.mr : 0);
      s.max_w = typeof s.max_w == "number" ? Math.min(s.max_w, U) : U;
    }
    wf(n, s, a);
  } else b === "sticky" ? a("unsupported", "position", "sticky", u("position")) : wm(o)?.length !== 0 && (s.position = "relative", wf(n, s, a, !0));
  o["z-index"] !== "auto" && m("z-index") && a("unsupported", "z-index", o["z-index"], u("z-index"), "paint order is tree order");
  for (const [U, F] of [["overflow_x", "overflow-x"], ["overflow_y", "overflow-y"]]) {
    const W = o[F];
    W === "hidden" || W === "clip" ? s[U] = "hidden" : (W === "auto" || W === "scroll") && (s[U] = "scroll");
  }
  (o.visibility === "hidden" || o.visibility === "collapse") && (s.visibility = "invisible");
  const S = o["background-color"];
  S?.unreadable ? a("unsupported", "background-color", S.unreadable, u("background-color")) : S?.rgba && S.rgba[3] > 0 && (s.bg = ar(S)), o["background-image"] && o["background-image"] !== "none" && a("unsupported", "background-image", o["background-image"], u("background-image"));
  const T = y.map((U) => hn(o[`border-${U}-width`]) || 0), E = [];
  y.forEach((U, F) => {
    if (!T[F]) return;
    s[`border_${U[0]}`] = T[F];
    const W = o[`border-${U}-style`];
    W !== "solid" && a("approximated", `border-${U}-style`, W, u(`border-${U}-style`), "drawn solid");
    const B = ar(o[`border-${U}-color`]);
    B && E.push(B);
  }), E.length && (s.border_color = E[0], E.some((U) => U.value !== E[0].value) && a("approximated", "border-color", E.map((U) => U.value).join(" "), u("border-top-color"), "one border colour"));
  const N = (U) => {
    const F = hn(o[`border-${U}-radius`]) || 0;
    if (typeof F != "string") return F;
    const W = parseFloat(F) / 100, B = [s.w, s.h].filter((g) => typeof g == "number");
    return F === "auto" || !(W > 0) ? 0 : B.length ? Math.round(Math.min(W, 0.5) * Math.min(...B) * 100) / 100 : 9999;
  }, j = ["top-left", "top-right", "bottom-right", "bottom-left"].map(N);
  j.every((U) => U === j[0]) ? j[0] && (s.rounded = j[0]) : ["tl", "tr", "br", "bl"].forEach((U, F) => {
    j[F] && (s[`rounded_${U}`] = j[F]);
  }), o.opacity !== 1 && (s.opacity = Math.round(o.opacity * 1e3) / 1e3);
  const R = o["box-shadow"];
  if (R && R !== "none" && oe(R, ",").some((U) => !/^0(px)?\s+0(px)?\s+(0(px)?\s+)?(0(px)?\s+)?(#0000|transparent|rgba?\(0,\s*0,\s*0,\s*0\))/.test(U.trim())) && (s.shadow = "lg", a("approximated", "box-shadow", R, u("box-shadow"), "the engine's large shadow preset")), o.cursor && o.cursor !== "auto" && !n.inherited.has("cursor")) {
    const U = { pointer: "pointer", default: "default", text: "text", move: "move", "not-allowed": "not_allowed", grab: "move", grabbing: "move" }[o.cursor];
    U ? s.cursor = U : a("unsupported", "cursor", o.cursor, u("cursor"));
  }
  return o["text-overflow"] === "ellipsis" && (s.text_ellipsis = !0), o["text-decoration-line"] === "underline" ? s.underline = !0 : o["text-decoration-line"] && o["text-decoration-line"] !== "none" && a("unsupported", "text-decoration-line", o["text-decoration-line"], u("text-decoration-line")), s;
}
const sb = { "tabular-nums": "tnum", "proportional-nums": "pnum", "lining-nums": "lnum", "oldstyle-nums": "onum", "slashed-zero": "zero", "diagonal-fractions": "frac", "stacked-fractions": "afrc", ordinal: "ordn" };
function km(n) {
  if (!n || n === "normal") return "";
  const a = String(n).trim().split(/\s+/).map((i) => sb[i]);
  return a.every(Boolean) ? a.join(",") : null;
}
function rr(n, a) {
  const i = n.values, o = i["line-height"];
  return {
    text_color: ar(i.color),
    text_size: Math.round(i["font-size"] * 1e3) / 1e3,
    font_features: km(i["font-variant-numeric"]) ?? "",
    font_weight: i["font-weight"],
    line_height: o.factor !== void 0 ? { factor: o.factor } : { px: Math.round(Tl(i, a) * 1e3) / 1e3 },
    font_family: nb(i["font-family"]),
    italic: i["font-style"] === "italic" || i["font-style"] === "oblique",
    whitespace: i["white-space"] === "nowrap" || i["white-space"] === "pre" ? "nowrap" : "normal",
    text_align: { center: "center", right: "right", end: "right" }[i["text-align"]] ?? "left"
  };
}
const _f = (n, a) => n.factor !== void 0 ? n.factor * a : n.px, Zs = (n, a) => JSON.stringify(n) === JSON.stringify(a);
function or(n, a, i) {
  const o = {}, s = (f, p) => p.some((v) => !n.inherited.has(v));
  for (const [f, p] of [["text_color", ["color"]], ["text_size", ["font-size"]], ["font_weight", ["font-weight"]], ["font_family", ["font-family"]], ["italic", ["font-style"]], ["whitespace", ["white-space"]], ["text_align", ["text-align"]], ["font_features", ["font-variant-numeric"]]])
    (s(f, p) || !Zs(a[f], i[f])) && (o[f] = a[f]);
  const u = _f(a.line_height, a.text_size), m = i.line_height ? _f(i.line_height, a.text_size) : NaN;
  return (s("line_height", ["line-height"]) || !(Math.abs(u - m) <= 1e-3)) && (o.line_height = a.line_height), o;
}
const cb = (n, a) => ({ ...n, ...a });
function sr(n, a) {
  const i = {};
  for (const [o, s] of Object.entries(n))
    s && typeof s == "object" && "value" in s ? (i[o] = s.value, s.token && (a[o] = s.token)) : o === "line_height" ? i[o] = s.factor !== void 0 ? Math.round(s.factor * 1e3) / 1e3 : `${s.px}px` : o === "italic" ? s && (i.italic = !0) : i[o] = s;
  return i.italic === !1 && delete i.italic, i;
}
function Sm(n, a) {
  const i = {};
  for (const o of /* @__PURE__ */ new Set([...Object.keys(n), ...Object.keys(a)])) {
    const s = n[o], u = a[o];
    Zs(s, u) || (i[o] = u === void 0 ? o in lr ? lr[o] : null : u);
  }
  return i;
}
function kf(n, a) {
  const i = n.values;
  for (const [o, s] of Object.entries(n.sources)) {
    if (o.startsWith("--") || I0.has(o) || s.startsWith("ua:")) continue;
    const u = i[o];
    switch (o) {
      case "letter-spacing":
        u !== "normal" && u?.px !== 0 && a("approximated", o, u?.px !== void 0 ? `${Math.round(u.px * 1e3) / 1e3}px` : u, s, u?.px < 0 ? "the run's box is as wide as with the spacing (the glyphs reach past it; where the element clips, the run is drawn smaller to fit)" : "the run is as wide as with the spacing (room after it), the letters are not spread");
        break;
      case "font-variant-numeric":
        u !== "normal" && km(u) === null && a("unsupported", o, u, s);
        break;
      case "text-transform":
        u !== "none" && a("approximated", o, u, s, "applied to the text in JS");
        break;
      case "transition-property":
      case "transition-duration": {
        const m = i["transition-duration"];
        o === "transition-property" && m && oe(m, ",").some((f) => parseFloat(f) > 0) && i["transition-property"] !== "none" && a("unsupported", "transition", `${i["transition-property"]} ${m}`, s, "changes are instant (the engine animates only opacity and size)");
        break;
      }
      case "-webkit-line-clamp":
        u !== "none" && a("unsupported", o, u, s, "no line clamp in the engine");
        break;
      case "-webkit-box-orient":
      case "overflow-wrap":
        o === "overflow-wrap" && u !== "normal" && a("approximated", o, u, s, "lines broken by the translator where the box's width is known (`break_anywhere`)");
        break;
      case "outline-style":
      case "outline-width":
      case "outline-color":
        i["outline-style"] !== "none" && o === "outline-style" && a("unsupported", "outline", `${hn(i["outline-width"])}px ${i["outline-style"]} ${ar(i["outline-color"])?.value ?? ""}`.trim(), s, "no outline in the engine (no focus ring)");
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
        u && u !== "none" && u !== "auto" && u !== "normal" && u !== "initial" && a("unsupported", o, u, s);
        break;
    }
  }
}
function ub(n, a, i, o) {
  const s = o.cascade.sheet.depends(n), u = n.ownerDocument?.activeElement, m = !!u && u !== n.ownerDocument.body;
  if (s.has || s.focusWithin && m || !o.cascade.pass) {
    const b = Ef(n, a, i, o), S = Sf(n);
    return b.meta = S.meta, S.events.length && (b.extra.events = S.events), b;
  }
  const f = o.cascade.parts ??= /* @__PURE__ */ new Map(), p = `${o.cascade.partKey(n)}|${a ? Cl(a.values) : ""}|${i ? Cl(i) : ""}`;
  let v = f.get(p);
  v || (f.size > 2e4 && f.clear(), v = Ef(n, a, i, o), v.computed = { ...v.computed, element: { hidden: !!n.hidden } }, f.set(p, v));
  const x = { ...v.extra };
  x.group && (x.group = cr(n)), x.group_hover && (x.group_hover = x.group_hover.map((b, S) => {
    let T = n;
    for (let E = 0; E < v.groupsUp[S]; E++) T = T.parentNode;
    return { ...b, group: cr(T) };
  }));
  const y = Sf(n);
  return y.events.length && (x.events = y.events), {
    ...v,
    extra: x,
    meta: y.meta,
    reports: v.reports.length ? v.reports.map(([b, S, T, E, , N]) => [b, S, T, E, Bl(n), N]) : v.reports
  };
}
function Sf(n) {
  const a = n.props, i = {};
  let o = 0;
  for (const u in a) {
    const m = a[u];
    if (typeof m == "function") {
      o |= yf[u] ?? 0;
      continue;
    }
    if (Nm.has(u) || m === void 0 || m === null || typeof m == "object") continue;
    const f = u.startsWith("aria-") || u.startsWith("data-");
    if (m === !1 && !f) continue;
    const p = u === "htmlFor" ? "for" : u === "tabIndex" ? "tabindex" : u;
    i[p] = typeof m == "boolean" ? f ? String(m) : "" : String(m);
  }
  const s = [];
  if (o) for (let u = 0; u < vf.length; u++) o & 1 << u && s.push(vf[u]);
  return !(o & yf.onClick) && ks(n) && s.push("click"), { meta: { tag: n.tagName, get classes() {
    return n.classList;
  }, attrs: i }, events: s };
}
function Ef(n, a, i, o) {
  const s = Bl(n), u = {}, m = o.cascade.compute(n, a, /* @__PURE__ */ new Set(), null, u), f = o.cascade.matching(n, "*").filter((R) => R.states.subject.size), p = [];
  for (const [R, U] of db)
    f.some((F) => U.some((W) => F.states.subject.has(W))) && p.push([R, o.cascade.compute(n, a, new Set(U), null, u)]);
  const v = `${Cl(m.shared)}|${Cl(i)}|${+!!m.element.hidden}|${p.map(([R, U]) => `${R}${Cl(U.shared)}`).join(",")}`;
  let x = (o.cascade.styled ??= /* @__PURE__ */ new Map()).get(v);
  x || o.cascade.styled.set(v, x = mb(m, p, i, o));
  const { style: y, tokens: b, shift: S, childText: T } = x, E = x.reports.map(([R, U, F, W, B]) => [R, U, F, W, s, B]), N = { ...x.extra }, j = [];
  if (o.cascade.sheet.tracks(n, "hover") && (N.group = cr(n), N.track_hover = !0), o.cascade.sheet.readsAncestor(n, "hover"))
    for (let R = n.parentNode, U = 1; R?.state; R = R.parentNode, U++) {
      if (!o.cascade.sheet.tracks(R, "hover")) continue;
      const F = R.state.hover;
      R.state.hover = !0;
      let W;
      const B = o.cascade.pass;
      o.cascade.pass = null;
      try {
        W = o.cascade.compute(n, a);
      } finally {
        R.state.hover = F, o.cascade.pass = B;
      }
      const g = {}, h = sr({ ...ir(W, () => {
      }), ...or(W, rr(W, o.measure), i) }, g), _ = Sm(y, h);
      if (!Object.keys(_).length) continue;
      const k = Object.fromEntries(Object.entries(g).filter(([z]) => z in _));
      (N.group_hover ??= []).push({ group: cr(R), style: _, ...Object.keys(k).length ? { tokens: k } : {} }), j.push(U);
    }
  if (/tabular/.test(String(m.values["font-variant-numeric"] ?? "")) && (N.tabular = !0), /^(anywhere|break-word)$/.test(String(m.values["overflow-wrap"] ?? "")) && (N.break_anywhere = !0), x.scrolls) {
    const R = Number.parseFloat(m.customs?.["--scrollbar-size"] ?? "");
    R > 0 && (N.scrollbar = R);
  }
  return m.values["pointer-events"] !== "none" && a?.values["pointer-events"] === "none" && (N.blocks_pointer = !0), m.values["pointer-events"] === "none" && (N.pointer_none = !0), { computed: m, style: y, tokens: b, extra: N, reports: E, childText: T, shift: S, groupsUp: j };
}
const db = [["hover", ["hover"]], ["focus", ["focus", "focus-visible"]], ["active", ["active", "hover"]]], zf = /* @__PURE__ */ new WeakMap();
let fb = 0;
function Cl(n) {
  let a = zf.get(n);
  return a === void 0 && zf.set(n, a = ++fb), a;
}
function mb(n, a, i, o) {
  const s = [], u = (b, S, T, E, N) => s.push([b, S, T, E ?? "(user agent)", N]), m = {}, f = ir(n, u, o.viewport);
  kf(n, u);
  const p = rr(n, o.measure), v = or(n, p, i), x = sr({ ...f, ...v }, m), y = {};
  for (const [b, S] of a) {
    const T = {}, E = sr({ ...ir(S, () => {
    }), ...or(S, rr(S, o.measure), i) }, T);
    b === "focus" && kf(S, u);
    const N = Sm(x, E);
    if (Object.keys(N).length) {
      y[b] = N;
      const j = Object.fromEntries(Object.entries(T).filter(([R]) => R in N));
      Object.keys(j).length && (y[`${b}_tokens`] = j);
    }
  }
  return { style: x, tokens: m, shift: f[_m], childText: cb(i, v), extra: y, scrolls: f.overflow_y === "scroll", reports: s };
}
function pb(n, a, i, o) {
  const s = { before: null, after: null };
  for (const u of ["before", "after"]) {
    if (!o.cascade.matching(n, /* @__PURE__ */ new Set(), u).length) continue;
    const m = o.cascade.compute(n, a, /* @__PURE__ */ new Set(), u), f = String(m.values.content ?? "none").trim();
    if (f === "none" || f === "normal") continue;
    const p = /^(["'])(.*)\1$/.exec(f)?.[2] ?? "", v = (T, E, N, j, R) => o.add(T, E, N, j ?? "(user agent)", `${Bl(n)}::${u}`, R), x = {}, y = ir(m, v, o.viewport), S = { kind: "div", style: sr({ ...y, ...or(m, rr(m, o.measure), i) }, x), tokens: x, children: p ? [{ kind: "text", text: p }] : [] };
    Object.defineProperty(S, Le, { value: m.values.display }), s[u] = S;
  }
  return s;
}
const cr = (n) => `~g${n.id}`, hb = ["pt", "pr", "pb", "pl", "mt", "mr", "mb", "ml", "border_t", "border_r", "border_b", "border_l", "bg"];
function gb(n) {
  return n.kind === "div" && n[Le] === "inline" && !n.events?.length && !n.meta?.attrs?.["data-testid"] && !hb.some((a) => n.style?.[a]) && n.children?.every((a) => a.kind === "text");
}
function Yi(n, a) {
  const i = n[a], o = { ...i, style: { ...i.style } };
  return Object.defineProperty(o, Le, { value: i[Le] }), n[a] = o, o;
}
function bb(n) {
  const a = [];
  for (let i = n.parentElement; i?.parentElement; i = i.parentElement) {
    const o = i.parentElement.children;
    a.push(`${+(o[0] === i)}${+(o[o.length - 1] === i)}`);
  }
  return a.join("");
}
function Em(n, a, i, o, s = 0, u = !0, m = !0, f = 0) {
  const p = o.cascade.sheet.depends(n), v = p.pos ? `${+u}${+m}${p.nth ? `:${f}` : ""}` : "", x = p.ancPos ? bb(n) : "";
  let y = o.cache.get(n);
  const b = y && y.version === n.version && y.parentValues === a?.values && y.inheritedText === i && y.pos === v && y.ancPos === x && (!p.anc || s <= y.at);
  if (b && y.node && y.stamp === n.stamp && !y.volatile && (!y.subAnc || s <= y.subAt)) {
    for (const N of y.log) o.add(...N);
    return y.node;
  }
  if (!b) {
    const N = ub(n, a, i, o);
    y && Zs(y.part.childText, N.childText) && (N.childText = y.part.childText), y = { version: n.version, parentValues: a?.values, inheritedText: i, pos: v, ancPos: x, at: o.now, part: N }, o.cache.set(n, y);
  }
  const S = o.log.length, T = { volatile: !!y.part.shift || p.ancPos, subAnc: p.anc }, E = vb(n, y, o, Math.max(s, n.attrStamp), T);
  return Object.assign(y, { node: E, stamp: n.stamp, subAt: o.now, log: o.log.slice(S), volatile: T.volatile, subAnc: T.subAnc }), E;
}
function vb(n, a, i, o, s) {
  const { computed: u, tokens: m, extra: f, reports: p, childText: v } = a.part;
  for (const h of p) i.add(...h);
  const x = (h, _, k, z, O) => i.add(h, _, k, z, Bl(n), O), y = { ...a.part.style };
  a.part.shift && ob(n, y, a.part.shift);
  const b = { kind: "div", id: n.id, style: y, tokens: m, meta: a.part.meta, ...f };
  Object.defineProperty(b, Le, { value: u.values.display }), n.measured && n.ownerDocument?.measureKey && (b.measure = n.ownerDocument.measureKey(n));
  const S = n.tagName;
  if (n.props["data-perch-engine"] != null)
    return b.kind = "engine", b.engine = String(n.props["data-perch-engine"]), b.key = String(n.props["data-perch-key"] ?? ""), b;
  if (S === "svg")
    return b.kind = n.props["data-perch-image"] ? "image" : "svg", b.markup = _b(n), b;
  if (S === "input" || S === "textarea" || S === "select") {
    b.kind = "input", b.input_type = S === "input" ? String(n.props.type ?? "text") : S;
    for (const k of ["placeholder", "checked", "disabled"]) n.props[k] !== void 0 && (b[k] = n.props[k]);
    if (/^(checkbox|radio)$/.test(b.input_type) && (b.checked = n.checked), S !== "select" && (b.value = n.value), y.cursor === void 0 && !n.props.disabled && (S === "textarea" || fs.test(b.input_type)) && (y.cursor = "text"), n.state.focus && (S === "textarea" || fs.test(b.input_type)) && !n.props.disabled && !n.props.readOnly && (b.caret = !0), S === "input" && fs.test(b.input_type) && (b.field_w = lb * u.values["font-size"]), S === "textarea" && y.h === void 0) {
      const k = u.values, z = (Y) => Y && typeof Y == "object" && "px" in Y ? Y.px : 0, O = (Y) => k[`border-${Y}-style`] === "none" ? 0 : z(k[`border-${Y}-width`]), M = Number(n.props.rows) > 0 ? Math.floor(Number(n.props.rows)) : 2;
      y.h = M * Tl(k, i.measure) + z(k["padding-top"]) + z(k["padding-bottom"]) + O("top") + O("bottom");
    }
    const { before: h, after: _ } = pb(n, u, v, i);
    return h || _ ? b.children = [h, _].filter(Boolean) : b.checked && /^(checkbox|radio)$/.test(b.input_type) && (b.children = [{ kind: "div", style: { w: 12, text_size: 10, font_weight: 700, text_align: "center", line_height: "12px" }, tokens: {}, children: [{ kind: "text", text: "✓" }] }]), b;
  }
  if (S === "img") {
    b.kind = "image", b.src = n.props.src ?? null;
    for (const [h, _] of [["width", "w"], ["height", "h"]]) {
      const k = Number(n.props[h]);
      y[_] === void 0 && n.props[h] != null && Number.isFinite(k) && (y[_] = k);
    }
    return b;
  }
  const T = u.values["text-transform"], E = [];
  let N = !1, j = !1;
  const R = n.childNodes.reduce((h, _) => h + (_ instanceof Zt ? 1 : 0), 0);
  let U = 0;
  for (const h of n.childNodes) {
    if (h instanceof gr) {
      if (h.hidden || h.data === "") continue;
      N = !0;
      const O = E[E.length - 1];
      if (O?.kind === "text")
        O.source = (O.source ?? O.text) + h.data, O.text = Tf(O.source, T), O.text === O.source && delete O.source;
      else {
        const M = Tf(h.data, T);
        E.push(M === h.data ? { kind: "text", text: M } : { kind: "text", text: M, source: h.data });
      }
      continue;
    }
    if (!(h instanceof Zt)) continue;
    const _ = Em(h, u, v, i, o, U === 0, U === R - 1, U);
    U++;
    const k = i.cache.get(h);
    s.volatile ||= k.volatile, s.subAnc ||= k.subAnc;
    const z = _[Le];
    z === "inline" || z === "inline-block" || z === "inline-flex" ? N = !0 : z !== "none" && (j = !0), E.push(_);
  }
  if (/(^|\s)inline-flex(\s|$)/.test(String(n.props?.className ?? "")) && y.w === void 0) {
    for (let h = 0; h < E.length; h++)
      if (E[h].style?.flex_grow && E[h].style.min_w === 0 && E[h].style.overflow_x === "hidden") {
        const _ = Yi(E, h);
        delete _.style.min_w, delete _.style.flex_grow, delete _.style.flex_basis, delete _.style.overflow_x, delete _.style.overflow_y;
      }
  }
  if (!y.display && N && E.some((h) => h.kind !== "text") && E.every((h) => h.kind === "text" || gb(h))) {
    const h = E.map((_) => _.kind === "text" ? _.text : _.children.map((k) => k.text).join("")).join("");
    x("approximated", "display", "inline text elements in a line of text", "(inline formatting)", "their text joined to the line, in its font"), E.splice(0, E.length, { kind: "text", text: h });
  }
  const F = E.some((h) => h.kind !== "text");
  let W = E.length === 1 && E[0].kind !== "text" && /^inline-(block|flex)$/.test(E[0][Le]) ? E[0] : null;
  if (!y.display && W) {
    W = Yi(E, 0);
    const h = i.cache.get(n.childNodes.find((k) => k.id === W.id))?.part.computed, _ = h ? Ml(u.values, i.measure) - Nf(h.values, i.measure, W) : 0;
    y.display = "flex", y.flex_direction = "col", y.items = "start", _ > 0 && (W.style.mt = Math.round(((W.style.mt ?? 0) + _) * 100) / 100), x("approximated", "display", `${u.values.display} holding one ${W[Le]} box`, "(inline formatting)", "a column, the box lowered to the line's baseline");
  } else if (!y.display && E.length === 1 && (E[0].kind === "svg" || E[0].kind === "image") && E[0][Le] === "inline" && typeof E[0].style.h == "number") {
    const h = Yi(E, 0), _ = Ml(u.values, i.measure), k = Tl(u.values, i.measure) - _, z = (O) => Math.round(O * 100) / 100;
    y.display = "flex", y.flex_direction = "col", y.items = "start", _ > h.style.h && (h.style.mt = z((h.style.mt ?? 0) + _ - h.style.h)), k > 0 && (h.style.mb = z((h.style.mb ?? 0) + k)), x("approximated", "display", `${u.values.display} holding one inline image`, "(inline formatting)", "a column, the image on the line's baseline");
  } else if (!y.display && N && F) {
    if (y.display = "flex", y.flex_direction = j ? "col" : "row", !j) y.items = "baseline";
    else {
      const h = (_) => E[_] && (E[_].kind === "text" || !/^(block|flex|grid|table|list-item)$/.test(E[_][Le] ?? "block"));
      for (let _ = 0; _ < E.length; _++) {
        if (E[_].kind === "text" || !/^inline-(block|flex)$/.test(E[_][Le])) continue;
        const k = Yi(E, _);
        if (k.style.self ??= "start", h(_ - 1) || h(_ + 1)) continue;
        const z = i.cache.get(n.childNodes.find((M) => M.id === k.id))?.part.computed, O = z ? Ml(u.values, i.measure) - Nf(z.values, i.measure, k) : 0;
        O > 0 && (k.style.mt = Math.round(((k.style.mt ?? 0) + O) * 100) / 100);
      }
    }
    x("approximated", "display", `${u.values.display} with inline content`, "(inline formatting)", j ? "a column of its children" : "a row on the text baseline");
  }
  const B = u.values["letter-spacing"]?.px, g = u.values["overflow-x"] !== "visible";
  if (B)
    for (let h = 0; h < E.length; h++) {
      const _ = E[h];
      if (_.kind !== "text") continue;
      const k = Math.round(B * [..._.text].length * 1e3) / 1e3;
      if (B > 0 || !g) {
        E[h] = { kind: "div", style: { pr: k }, tokens: {}, children: [_] };
        continue;
      }
      const z = u.values["font-size"], O = Math.max(0.8, 1 + B / (0.55 * z)), M = Math.round(Tl(u.values, i.measure) * 1e3) / 1e3;
      E[h] = { kind: "div", style: { text_size: Math.round(z * O * 1e3) / 1e3, line_height: `${M}px` }, tokens: {}, children: [_] };
    }
  return b.children = E, b;
}
function yb(n, a) {
  if (!a) return null;
  let o = (a.self ? n : a.closest ? im(n, a.closest) : a.find ? jl(n, a.find)[0] : null)?.getAttribute(a.attr) ?? null;
  return o && a.strip && o.startsWith(a.strip) && (o = o.slice(a.strip.length)), o;
}
function xb(n, a, i) {
  const o = a.map((m) => [m, hr(m.selector)]), s = /* @__PURE__ */ new Map(), u = (m) => {
    for (const f of m.children) {
      const p = i.get(f.id);
      if (p)
        for (const [v, x] of o) {
          const y = v.textRange ? "range_name" : "name";
          if (v.textRange && p[y] != null || !x.some((E) => ys(f, E))) continue;
          const b = yb(f, v.key), S = b == null ? s.get(v.name) ?? 0 : 0;
          b == null && s.set(v.name, S + 1);
          const T = b != null ? `${v.name}:${b}` : S ? `${v.name}@${S}` : v.name;
          p[y] == null ? p[y] = T : (p.also ??= []).push(T);
        }
      u(f);
    }
  };
  u(n.documentElement);
}
const ur = 0.9521, zm = 0.2256, Ml = (n, a) => (Tl(n, a) - (ur + zm) * n["font-size"]) / 2 + ur * n["font-size"];
function Nf(n, a, i) {
  const o = (p) => p && typeof p == "object" && "px" in p ? p.px : 0, s = n["border-top-style"] === "none" ? 0 : o(n["border-top-width"]), u = i?.children ?? [], m = u.length === 1 && (u[0].kind === "svg" || u[0].kind === "image") && typeof u[0].style.h == "number" ? u[0] : null, f = m ? Math.max(Ml(n, a), (m.style.mt ?? 0) + m.style.h) : Ml(n, a);
  return o(n["padding-top"]) + s + f;
}
const Tf = (n, a) => a === "uppercase" ? n.toUpperCase() : a === "lowercase" ? n.toLowerCase() : a === "capitalize" ? n.replace(/\b\p{L}/gu, (i) => i.toUpperCase()) : n, Nm = /* @__PURE__ */ new Set(["children", "style", "className", "key", "ref", "dangerouslySetInnerHTML"]), wb = (n) => n === "className" ? "class" : /^(viewBox|preserveAspectRatio|gradientUnits|gradientTransform|patternUnits|xmlns)$/.test(n) ? n : n.replace(/[A-Z]/g, (a) => `-${a.toLowerCase()}`), Cf = (n) => String(n).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
function _b(n) {
  if (n.props["data-perch-markup"]) return String(n.props["data-perch-markup"]);
  const a = (i) => {
    const o = [];
    for (const [u, m] of Object.entries(i.props))
      Nm.has(u) || typeof m == "function" || m === void 0 || m === null || m === !1 || typeof m == "object" || u.startsWith("data-") || u.startsWith("aria-") || u === "focusable" || u === "role" || u === "title" || o.push(`${wb(u)}="${Cf(m === !0 ? "" : m)}"`);
    i.tagName === "svg" && !i.props.xmlns && o.unshift('xmlns="http://www.w3.org/2000/svg"');
    const s = i.childNodes.map((u) => u instanceof gr ? Cf(u.data) : a(u)).join("");
    return `<${i.tagName}${o.length ? ` ${o.join(" ")}` : ""}>${s}</${i.tagName}>`;
  };
  return a(n);
}
function kb(n) {
  const a = n.theme?.() ?? {}, i = {};
  for (const o of pm) a[o] && (i[o] = a[o]);
  return i;
}
const Sb = { font_features: "" }, Mf = /* @__PURE__ */ new WeakMap();
function Eb(n, a, i, o) {
  const s = Mf.get(n);
  if (s?.look === a) return s.cascade;
  const u = new X0(n, { theme: i, viewport: o });
  return Mf.set(n, { look: a, cascade: u }), u;
}
function zb(n, a, i, o = {}, s = null) {
  const u = kb(a), m = a.viewport?.() ?? { width: 1e3, height: 800 }, f = JSON.stringify([u, m]);
  (o.look !== f || o.sheet !== i) && Object.assign(o, { look: f, sheet: i, cache: /* @__PURE__ */ new WeakMap(), cascade: Eb(i, f, u, m), top: null });
  const { cascade: p, cache: v } = o, x = new ab(), y = [], S = { cascade: p, cache: v, viewport: m, findings: x, log: y, add: (...N) => {
    y.push(N), x.add(...N);
  }, now: ws(), measure: a.lineHeight ? (N) => a.lineHeight(N) : null };
  o.top ??= p.compute(n.body, p.compute(n.documentElement, null));
  const T = n.body.children;
  p.pass = {};
  let E;
  try {
    E = T.map((N, j) => Em(N, o.top, Sb, S, 0, j === 0, j === T.length - 1, j));
  } finally {
    p.pass = null;
  }
  if (s?.length) {
    const N = /* @__PURE__ */ new Map(), j = (R) => {
      R.id && (N.set(R.id, R), delete R.name, delete R.range_name, delete R.also);
      for (const U of R.children ?? []) j(U);
    };
    E.forEach(j), xb(n, s, N);
  }
  return { schema: F0, root: E[0] ?? null, overlays: E.slice(1), document_events: Tm(n), unsupported: S.findings.list() };
}
function Tm(n) {
  const a = /* @__PURE__ */ new Set();
  for (const i of [n, n.defaultView])
    for (const { type: o } of i?.listeners ?? []) xf[o] && a.add(xf[o]);
  return [...a].sort();
}
const Ga = { layers: ["properties", "theme", "base", "utilities"], properties: { "--tw-translate-x": { inherits: !1, initial: "0" }, "--tw-translate-y": { inherits: !1, initial: "0" }, "--tw-translate-z": { inherits: !1, initial: "0" }, "--tw-rotate-x": { inherits: !1, initial: null }, "--tw-rotate-y": { inherits: !1, initial: null }, "--tw-rotate-z": { inherits: !1, initial: null }, "--tw-skew-x": { inherits: !1, initial: null }, "--tw-skew-y": { inherits: !1, initial: null }, "--tw-space-y-reverse": { inherits: !1, initial: "0" }, "--tw-border-style": { inherits: !1, initial: "solid" }, "--tw-leading": { inherits: !1, initial: null }, "--tw-font-weight": { inherits: !1, initial: null }, "--tw-tracking": { inherits: !1, initial: null }, "--tw-ordinal": { inherits: !1, initial: null }, "--tw-slashed-zero": { inherits: !1, initial: null }, "--tw-numeric-figure": { inherits: !1, initial: null }, "--tw-numeric-spacing": { inherits: !1, initial: null }, "--tw-numeric-fraction": { inherits: !1, initial: null }, "--tw-shadow": { inherits: !1, initial: "0 0 #0000" }, "--tw-shadow-color": { inherits: !1, initial: null }, "--tw-shadow-alpha": { inherits: !1, initial: "100%" }, "--tw-inset-shadow": { inherits: !1, initial: "0 0 #0000" }, "--tw-inset-shadow-color": { inherits: !1, initial: null }, "--tw-inset-shadow-alpha": { inherits: !1, initial: "100%" }, "--tw-ring-color": { inherits: !1, initial: null }, "--tw-ring-shadow": { inherits: !1, initial: "0 0 #0000" }, "--tw-inset-ring-color": { inherits: !1, initial: null }, "--tw-inset-ring-shadow": { inherits: !1, initial: "0 0 #0000" }, "--tw-ring-inset": { inherits: !1, initial: null }, "--tw-ring-offset-width": { inherits: !1, initial: "0" }, "--tw-ring-offset-color": { inherits: !1, initial: "#fff" }, "--tw-ring-offset-shadow": { inherits: !1, initial: "0 0 #0000" }, "--tw-outline-style": { inherits: !1, initial: "solid" }, "--tw-blur": { inherits: !1, initial: null }, "--tw-brightness": { inherits: !1, initial: null }, "--tw-contrast": { inherits: !1, initial: null }, "--tw-grayscale": { inherits: !1, initial: null }, "--tw-hue-rotate": { inherits: !1, initial: null }, "--tw-invert": { inherits: !1, initial: null }, "--tw-opacity": { inherits: !1, initial: null }, "--tw-saturate": { inherits: !1, initial: null }, "--tw-sepia": { inherits: !1, initial: null }, "--tw-drop-shadow": { inherits: !1, initial: null }, "--tw-drop-shadow-color": { inherits: !1, initial: null }, "--tw-drop-shadow-alpha": { inherits: !1, initial: "100%" }, "--tw-drop-shadow-size": { inherits: !1, initial: null }, "--tw-backdrop-blur": { inherits: !1, initial: null }, "--tw-backdrop-brightness": { inherits: !1, initial: null }, "--tw-backdrop-contrast": { inherits: !1, initial: null }, "--tw-backdrop-grayscale": { inherits: !1, initial: null }, "--tw-backdrop-hue-rotate": { inherits: !1, initial: null }, "--tw-backdrop-invert": { inherits: !1, initial: null }, "--tw-backdrop-opacity": { inherits: !1, initial: null }, "--tw-backdrop-saturate": { inherits: !1, initial: null }, "--tw-backdrop-sepia": { inherits: !1, initial: null }, "--tw-duration": { inherits: !1, initial: null }, "--tw-ease": { inherits: !1, initial: null }, "--tw-content": { inherits: !1, initial: '""' } }, rules: [[":root, :host", null, 2, [["--spacing", ".25rem"], ["--text-xs", ".75rem"], ["--text-xs--line-height", "calc(1 / .75)"], ["--text-sm", ".875rem"], ["--text-sm--line-height", "calc(1.25 / .875)"], ["--font-weight-normal", "400"], ["--font-weight-medium", "500"], ["--font-weight-semibold", "600"], ["--font-weight-bold", "700"], ["--tracking-normal", "0em"], ["--tracking-wide", ".025em"], ["--leading-tight", "1.25"], ["--leading-relaxed", "1.625"], ["--ease-out", "cubic-bezier(0, 0, .2, 1)"], ["--animate-pulse", "pulse 2s cubic-bezier(.4, 0, .6, 1) infinite"], ["--blur-xl", "24px"], ["--default-transition-duration", ".15s"], ["--default-transition-timing-function", "cubic-bezier(.4, 0, .2, 1)"], ["--animate-toast-in", "toast-in .2s cubic-bezier(.22, 1, .36, 1)"], ["--animate-host-pulse", "host-connecting-pulse 1.4s ease-in-out infinite"], ["--animate-drop-zone", "drop-zone-in .14s ease-out, drop-zone-pulse 1.2s ease-in-out .14s infinite"]]], ["::selection", null, 3, [["background", "var(--accent)"], ["color", "var(--panel-bg)"]]], [":where(input, textarea)::placeholder", null, 3, [["color", "var(--subtext-0)"], ["opacity", "1"]]], [":where(button, input, select, textarea)", null, 3, [["border", "0"]]], [':where(button, a[href], select, summary, [role="button"], [role="menuitem"]):focus-visible', null, 3, [["outline", "2px solid var(--accent)"], ["outline-offset", "-2px"]]], ["::-webkit-scrollbar", null, 3, [["width", "var(--scrollbar-size)"], ["height", "var(--scrollbar-size)"]]], ["::-webkit-scrollbar-track", null, 3, [["background", "none"]]], ["::-webkit-scrollbar-corner", null, 3, [["background", "none"]]], ["::-webkit-scrollbar-thumb", null, 3, [["background", "var(--text)"]]], ["::-webkit-scrollbar-thumb", null, 3, [["background", "color-mix(in srgb, var(--text) 20%, transparent)"]]], ["::-webkit-scrollbar-thumb", null, 3, [["border-radius", "var(--scrollbar-size)"]]], ["::-webkit-scrollbar-thumb:hover", null, 3, [["background", "var(--text)"]]], ["::-webkit-scrollbar-thumb:hover", null, 3, [["background", "color-mix(in srgb, var(--text) 40%, transparent)"]]], [".xterm .xterm-scrollable-element > .xterm-scrollbar > .xterm-slider", null, 3, [["border-radius", "var(--scrollbar-size)"]]], [".\\@container, .\\[container-type\\:inline-size\\]", null, 4, [["container-type", "inline-size"]]], [".pointer-events-auto", null, 4, [["pointer-events", "auto"]]], [".pointer-events-none", null, 4, [["pointer-events", "none"]]], [".collapse", null, 4, [["visibility", "collapse"]]], [".invisible", null, 4, [["visibility", "hidden"]]], [".visible", null, 4, [["visibility", "visible"]]], [".sr-only", null, 4, [["clip-path", "inset(50%)"], ["white-space", "nowrap"], ["border-width", "0"], ["width", "1px"], ["height", "1px"], ["margin", "-1px"], ["padding", "0"], ["position", "absolute"], ["overflow", "hidden"]]], [".absolute", null, 4, [["position", "absolute"]]], [".fixed", null, 4, [["position", "fixed"]]], [".relative", null, 4, [["position", "relative"]]], [".static", null, 4, [["position", "static"]]], [".sticky", null, 4, [["position", "sticky"]]], [".inset-0", null, 4, [["inset", "0"]]], [".inset-x-0", null, 4, [["inset-inline", "0"]]], [".inset-x-2", null, 4, [["inset-inline", "calc(var(--spacing) * 2)"]]], [".-top-1", null, 4, [["top", "calc(var(--spacing) * -1)"]]], [".-top-1\\.5", null, 4, [["top", "calc(var(--spacing) * -1.5)"]]], [".top-0", null, 4, [["top", "0"]]], [".top-1", null, 4, [["top", "var(--spacing)"]]], [".top-1\\.5", null, 4, [["top", "calc(var(--spacing) * 1.5)"]]], [".top-1\\/2", null, 4, [["top", "50%"]]], [".top-2", null, 4, [["top", "calc(var(--spacing) * 2)"]]], [".top-4", null, 4, [["top", "calc(var(--spacing) * 4)"]]], [".top-\\[0\\.1rem\\]", null, 4, [["top", ".1rem"]]], [".top-\\[7px\\]", null, 4, [["top", "7px"]]], [".top-\\[max\\(0\\.75rem\\,env\\(safe-area-inset-top\\)\\)\\]", null, 4, [["top", "max(.75rem, env(safe-area-inset-top))"]]], [".top-full", null, 4, [["top", "100%"]]], [".top-px", null, 4, [["top", "1px"]]], [".-right-1", null, 4, [["right", "calc(var(--spacing) * -1)"]]], [".-right-1\\.5", null, 4, [["right", "calc(var(--spacing) * -1.5)"]]], [".right-0", null, 4, [["right", "0"]]], [".right-1", null, 4, [["right", "var(--spacing)"]]], [".right-3", null, 4, [["right", "calc(var(--spacing) * 3)"]]], [".right-4", null, 4, [["right", "calc(var(--spacing) * 4)"]]], [".right-\\[0\\.8rem\\]", null, 4, [["right", ".8rem"]]], [".right-\\[0\\.25rem\\]", null, 4, [["right", ".25rem"]]], [".right-\\[1\\.6rem\\]", null, 4, [["right", "1.6rem"]]], [".right-\\[3px\\]", null, 4, [["right", "3px"]]], [".right-\\[max\\(0\\.75rem\\,env\\(safe-area-inset-right\\)\\)\\]", null, 4, [["right", "max(.75rem, env(safe-area-inset-right))"]]], [".right-full", null, 4, [["right", "100%"]]], [".-bottom-\\[4px\\]", null, 4, [["bottom", "-4px"]]], [".bottom-0", null, 4, [["bottom", "0"]]], [".bottom-2", null, 4, [["bottom", "calc(var(--spacing) * 2)"]]], [".bottom-3", null, 4, [["bottom", "calc(var(--spacing) * 3)"]]], [".bottom-\\[0\\.8rem\\]", null, 4, [["bottom", ".8rem"]]], [".bottom-full", null, 4, [["bottom", "100%"]]], [".-left-8", null, 4, [["left", "calc(var(--spacing) * -8)"]]], [".-left-\\[2px\\]", null, 4, [["left", "-2px"]]], [".-left-\\[3px\\]", null, 4, [["left", "-3px"]]], [".left-0", null, 4, [["left", "0"]]], [".left-2", null, 4, [["left", "calc(var(--spacing) * 2)"]]], [".left-\\[0\\.1rem\\]", null, 4, [["left", ".1rem"]]], [".left-\\[3px\\]", null, 4, [["left", "3px"]]], [".left-\\[max\\(0\\.75rem\\,env\\(safe-area-inset-left\\)\\)\\]", null, 4, [["left", "max(.75rem, env(safe-area-inset-left))"]]], [".left-full", null, 4, [["left", "100%"]]], [".left-px", null, 4, [["left", "1px"]]], [".isolate", null, 4, [["isolation", "isolate"]]], [".z-4", null, 4, [["z-index", "4"]]], [".z-5", null, 4, [["z-index", "5"]]], [".z-10", null, 4, [["z-index", "10"]]], [".z-20", null, 4, [["z-index", "20"]]], [".z-30", null, 4, [["z-index", "30"]]], [".z-40", null, 4, [["z-index", "40"]]], [".z-50", null, 4, [["z-index", "50"]]], [".z-\\[2\\]", null, 4, [["z-index", "2"]]], [".z-\\[3\\]", null, 4, [["z-index", "3"]]], [".z-\\[5\\]", null, 4, [["z-index", "5"]]], [".z-\\[1000\\]", null, 4, [["z-index", "1000"]]], [".z-\\[2000\\]", null, 4, [["z-index", "2000"]]], [".z-\\[2100\\]", null, 4, [["z-index", "2100"]]], [".z-\\[2200\\]", null, 4, [["z-index", "2200"]]], [".z-\\[3000\\]", null, 4, [["z-index", "3000"]]], [".z-\\[3100\\]", null, 4, [["z-index", "3100"]]], [".z-\\[4000\\]", null, 4, [["z-index", "4000"]]], [".z-\\[9998\\]", null, 4, [["z-index", "9998"]]], [".z-\\[9999\\]", null, 4, [["z-index", "9999"]]], [".z-\\[10000\\]", null, 4, [["z-index", "10000"]]], [".z-auto", null, 4, [["z-index", "auto"]]], [".order-last", null, 4, [["order", "9999"]]], [".col-\\[1\\/-1\\]", null, 4, [["grid-column", "1 / -1"]]], [".container", null, 4, [["width", "100%"]]], [".container", ["(min-width: 40rem)"], 4, [["max-width", "40rem"]]], [".container", ["(min-width: 48rem)"], 4, [["max-width", "48rem"]]], [".container", ["(min-width: 64rem)"], 4, [["max-width", "64rem"]]], [".container", ["(min-width: 80rem)"], 4, [["max-width", "80rem"]]], [".container", ["(min-width: 96rem)"], 4, [["max-width", "96rem"]]], [".m-0", null, 4, [["margin", "0"]]], [".m-2", null, 4, [["margin", "calc(var(--spacing) * 2)"]]], [".m-auto", null, 4, [["margin", "auto"]]], [".mx-0", null, 4, [["margin-inline", "0"]]], [".mx-0\\.5", null, 4, [["margin-inline", "calc(var(--spacing) * .5)"]]], [".mx-2", null, 4, [["margin-inline", "calc(var(--spacing) * 2)"]]], [".mx-3", null, 4, [["margin-inline", "calc(var(--spacing) * 3)"]]], [".mx-4", null, 4, [["margin-inline", "calc(var(--spacing) * 4)"]]], [".mx-\\[0\\.3rem\\]", null, 4, [["margin-inline", ".3rem"]]], [".mx-\\[0\\.7rem\\]", null, 4, [["margin-inline", ".7rem"]]], [".mx-\\[0\\.65rem\\]", null, 4, [["margin-inline", ".65rem"]]], [".mx-\\[3px\\]", null, 4, [["margin-inline", "3px"]]], [".mx-\\[11px\\]", null, 4, [["margin-inline", "11px"]]], [".mx-auto", null, 4, [["margin-inline", "auto"]]], [".my-0\\.5", null, 4, [["margin-block", "calc(var(--spacing) * .5)"]]], [".my-1", null, 4, [["margin-block", "var(--spacing)"]]], [".my-2", null, 4, [["margin-block", "calc(var(--spacing) * 2)"]]], [".my-\\[0\\.2rem\\]", null, 4, [["margin-block", ".2rem"]]], [".my-\\[0\\.3rem\\]", null, 4, [["margin-block", ".3rem"]]], [".my-\\[0\\.6rem\\]", null, 4, [["margin-block", ".6rem"]]], [".my-\\[0\\.28rem\\]", null, 4, [["margin-block", ".28rem"]]], [".my-\\[0\\.45rem\\]", null, 4, [["margin-block", ".45rem"]]], [".my-\\[0\\.55rem\\]", null, 4, [["margin-block", ".55rem"]]], [".my-\\[3px\\]", null, 4, [["margin-block", "3px"]]], [".-mt-\\[2px\\]", null, 4, [["margin-top", "-2px"]]], [".mt-0", null, 4, [["margin-top", "0"]]], [".mt-0\\.5", null, 4, [["margin-top", "calc(var(--spacing) * .5)"]]], [".mt-1", null, 4, [["margin-top", "var(--spacing)"]]], [".mt-1\\.5", null, 4, [["margin-top", "calc(var(--spacing) * 1.5)"]]], [".mt-2", null, 4, [["margin-top", "calc(var(--spacing) * 2)"]]], [".mt-3", null, 4, [["margin-top", "calc(var(--spacing) * 3)"]]], [".mt-4", null, 4, [["margin-top", "calc(var(--spacing) * 4)"]]], [".mt-\\[0\\.1rem\\]", null, 4, [["margin-top", ".1rem"]]], [".mt-\\[0\\.2rem\\]", null, 4, [["margin-top", ".2rem"]]], [".mt-\\[0\\.3rem\\]", null, 4, [["margin-top", ".3rem"]]], [".mt-\\[0\\.4rem\\]", null, 4, [["margin-top", ".4rem"]]], [".mt-\\[0\\.5rem\\]", null, 4, [["margin-top", ".5rem"]]], [".mt-\\[0\\.15rem\\]", null, 4, [["margin-top", ".15rem"]]], [".mt-\\[0\\.35rem\\]", null, 4, [["margin-top", ".35rem"]]], [".mr-1", null, 4, [["margin-right", "var(--spacing)"]]], [".mr-1\\.5", null, 4, [["margin-right", "calc(var(--spacing) * 1.5)"]]], [".mr-\\[0\\.3rem\\]", null, 4, [["margin-right", ".3rem"]]], [".mr-\\[0\\.7rem\\]", null, 4, [["margin-right", ".7rem"]]], [".mr-auto", null, 4, [["margin-right", "auto"]]], [".mb-0", null, 4, [["margin-bottom", "0"]]], [".mb-0\\.5", null, 4, [["margin-bottom", "calc(var(--spacing) * .5)"]]], [".mb-1", null, 4, [["margin-bottom", "var(--spacing)"]]], [".mb-2", null, 4, [["margin-bottom", "calc(var(--spacing) * 2)"]]], [".mb-3", null, 4, [["margin-bottom", "calc(var(--spacing) * 3)"]]], [".mb-4", null, 4, [["margin-bottom", "calc(var(--spacing) * 4)"]]], [".mb-8", null, 4, [["margin-bottom", "calc(var(--spacing) * 8)"]]], [".mb-\\[0\\.2rem\\]", null, 4, [["margin-bottom", ".2rem"]]], [".mb-\\[0\\.3rem\\]", null, 4, [["margin-bottom", ".3rem"]]], [".mb-\\[0\\.4rem\\]", null, 4, [["margin-bottom", ".4rem"]]], [".mb-\\[0\\.6rem\\]", null, 4, [["margin-bottom", ".6rem"]]], [".mb-\\[0\\.7rem\\]", null, 4, [["margin-bottom", ".7rem"]]], [".mb-\\[0\\.9rem\\]", null, 4, [["margin-bottom", ".9rem"]]], [".mb-\\[0\\.15rem\\]", null, 4, [["margin-bottom", ".15rem"]]], [".mb-\\[0\\.35rem\\]", null, 4, [["margin-bottom", ".35rem"]]], [".mb-\\[0\\.45rem\\]", null, 4, [["margin-bottom", ".45rem"]]], [".mb-\\[0\\.55rem\\]", null, 4, [["margin-bottom", ".55rem"]]], [".mb-\\[1\\.1rem\\]", null, 4, [["margin-bottom", "1.1rem"]]], [".-ml-0\\.5", null, 4, [["margin-left", "calc(var(--spacing) * -.5)"]]], [".-ml-1", null, 4, [["margin-left", "calc(var(--spacing) * -1)"]]], [".-ml-2", null, 4, [["margin-left", "calc(var(--spacing) * -2)"]]], [".ml-1", null, 4, [["margin-left", "var(--spacing)"]]], [".ml-2", null, 4, [["margin-left", "calc(var(--spacing) * 2)"]]], [".ml-\\[0\\.3rem\\]", null, 4, [["margin-left", ".3rem"]]], [".ml-\\[0\\.4rem\\]", null, 4, [["margin-left", ".4rem"]]], [".ml-\\[0\\.5rem\\]", null, 4, [["margin-left", ".5rem"]]], [".ml-\\[0\\.9rem\\]", null, 4, [["margin-left", ".9rem"]]], [".ml-\\[0\\.35rem\\]", null, 4, [["margin-left", ".35rem"]]], [".ml-\\[0\\.55rem\\]", null, 4, [["margin-left", ".55rem"]]], [".ml-\\[1\\.15rem\\]", null, 4, [["margin-left", "1.15rem"]]], [".ml-\\[1\\.45rem\\]", null, 4, [["margin-left", "1.45rem"]]], [".ml-\\[2\\.025rem\\]", null, 4, [["margin-left", "2.025rem"]]], [".ml-\\[2\\.375rem\\]", null, 4, [["margin-left", "2.375rem"]]], [".ml-\\[6\\.1rem\\]", null, 4, [["margin-left", "6.1rem"]]], [".ml-auto", null, 4, [["margin-left", "auto"]]], [".box-border", null, 4, [["box-sizing", "border-box"]]], [".\\!hidden", null, 4, [["display", "none", 1]]], [".\\[display\\:-webkit-box\\]", null, 4, [["display", "-webkit-box"]]], [".\\[display\\:var\\(--pane-grip\\,flex\\)\\]", null, 4, [["display", "var(--pane-grip, flex)"]]], [".block", null, 4, [["display", "block"]]], [".contents", null, 4, [["display", "contents"]]], [".flex", null, 4, [["display", "flex"]]], [".grid", null, 4, [["display", "grid"]]], [".hidden", null, 4, [["display", "none"]]], [".inline", null, 4, [["display", "inline"]]], [".inline-block", null, 4, [["display", "inline-block"]]], [".inline-flex", null, 4, [["display", "inline-flex"]]], [".table", null, 4, [["display", "table"]]], [".size-1", null, 4, [["width", "var(--spacing)"], ["height", "var(--spacing)"]]], [".size-1\\.5", null, 4, [["width", "calc(var(--spacing) * 1.5)"], ["height", "calc(var(--spacing) * 1.5)"]]], [".size-2", null, 4, [["width", "calc(var(--spacing) * 2)"], ["height", "calc(var(--spacing) * 2)"]]], [".size-3", null, 4, [["width", "calc(var(--spacing) * 3)"], ["height", "calc(var(--spacing) * 3)"]]], [".size-5", null, 4, [["width", "calc(var(--spacing) * 5)"], ["height", "calc(var(--spacing) * 5)"]]], [".size-6", null, 4, [["width", "calc(var(--spacing) * 6)"], ["height", "calc(var(--spacing) * 6)"]]], [".size-7", null, 4, [["width", "calc(var(--spacing) * 7)"], ["height", "calc(var(--spacing) * 7)"]]], [".size-8", null, 4, [["width", "calc(var(--spacing) * 8)"], ["height", "calc(var(--spacing) * 8)"]]], [".size-11", null, 4, [["width", "calc(var(--spacing) * 11)"], ["height", "calc(var(--spacing) * 11)"]]], [".size-14", null, 4, [["width", "calc(var(--spacing) * 14)"], ["height", "calc(var(--spacing) * 14)"]]], [".size-\\[0\\.6rem\\]", null, 4, [["width", ".6rem"], ["height", ".6rem"]]], [".size-\\[1\\.2rem\\]", null, 4, [["width", "1.2rem"], ["height", "1.2rem"]]], [".size-\\[5px\\]", null, 4, [["width", "5px"], ["height", "5px"]]], [".size-\\[14px\\]", null, 4, [["width", "14px"], ["height", "14px"]]], [".size-\\[calc\\(14px\\*var\\(--zoom\\,1\\)\\)\\]", null, 4, [["width", "calc(14px * var(--zoom, 1))"], ["height", "calc(14px * var(--zoom, 1))"]]], [".size-full", null, 4, [["width", "100%"], ["height", "100%"]]], [".h-1", null, 4, [["height", "var(--spacing)"]]], [".h-1\\.5", null, 4, [["height", "calc(var(--spacing) * 1.5)"]]], [".h-2", null, 4, [["height", "calc(var(--spacing) * 2)"]]], [".h-3", null, 4, [["height", "calc(var(--spacing) * 3)"]]], [".h-4", null, 4, [["height", "calc(var(--spacing) * 4)"]]], [".h-5", null, 4, [["height", "calc(var(--spacing) * 5)"]]], [".h-6", null, 4, [["height", "calc(var(--spacing) * 6)"]]], [".h-7", null, 4, [["height", "calc(var(--spacing) * 7)"]]], [".h-8", null, 4, [["height", "calc(var(--spacing) * 8)"]]], [".h-9", null, 4, [["height", "calc(var(--spacing) * 9)"]]], [".h-11", null, 4, [["height", "calc(var(--spacing) * 11)"]]], [".h-12", null, 4, [["height", "calc(var(--spacing) * 12)"]]], [".h-44", null, 4, [["height", "calc(var(--spacing) * 44)"]]], [".h-\\[1\\.1rem\\]", null, 4, [["height", "1.1rem"]]], [".h-\\[1\\.3rem\\]", null, 4, [["height", "1.3rem"]]], [".h-\\[1\\.4rem\\]", null, 4, [["height", "1.4rem"]]], [".h-\\[1\\.25rem\\]", null, 4, [["height", "1.25rem"]]], [".h-\\[2px\\]", null, 4, [["height", "2px"]]], [".h-\\[5px\\]", null, 4, [["height", "5px"]]], [".h-\\[14px\\]", null, 4, [["height", "14px"]]], [".h-\\[18px\\]", null, 4, [["height", "18px"]]], [".h-\\[43px\\]", null, 4, [["height", "43px"]]], [".h-\\[calc\\(100\\%-max\\(0\\.5rem\\,env\\(safe-area-inset-top\\)\\)\\)\\]", null, 4, [["height", "calc(100% - max(.5rem, env(safe-area-inset-top)))"]]], [".h-full", null, 4, [["height", "100%"]]], [".h-px", null, 4, [["height", "1px"]]], [".max-h-40", null, 4, [["max-height", "calc(var(--spacing) * 40)"]]], [".max-h-56", null, 4, [["max-height", "calc(var(--spacing) * 56)"]]], [".max-h-72", null, 4, [["max-height", "calc(var(--spacing) * 72)"]]], [".max-h-\\[8rem\\]", null, 4, [["max-height", "8rem"]]], [".max-h-\\[13rem\\]", null, 4, [["max-height", "13rem"]]], [".max-h-\\[30\\%\\]", null, 4, [["max-height", "30%"]]], [".max-h-\\[30vh\\]", null, 4, [["max-height", "30vh"]]], [".max-h-\\[35vh\\]", null, 4, [["max-height", "35vh"]]], [".max-h-\\[40\\%\\]", null, 4, [["max-height", "40%"]]], [".max-h-\\[50dvh\\]", null, 4, [["max-height", "50dvh"]]], [".max-h-\\[60\\%\\]", null, 4, [["max-height", "60%"]]], [".max-h-\\[70\\%\\]", null, 4, [["max-height", "70%"]]], [".max-h-\\[85vh\\]", null, 4, [["max-height", "85vh"]]], [".max-h-\\[90\\%\\]", null, 4, [["max-height", "90%"]]], [".max-h-\\[190px\\]", null, 4, [["max-height", "190px"]]], [".max-h-\\[240px\\]", null, 4, [["max-height", "240px"]]], [".max-h-\\[260px\\]", null, 4, [["max-height", "260px"]]], [".max-h-\\[calc\\(85vh-4rem\\)\\]", null, 4, [["max-height", "calc(85vh - 4rem)"]]], [".max-h-\\[calc\\(100dvh_-_4rem\\)\\]", null, 4, [["max-height", "calc(100dvh - 4rem)"]]], [".max-h-\\[min\\(420px\\,calc\\(100dvh_-_16vh_-_2rem\\)\\)\\]", null, 4, [["max-height", "min(420px, 100dvh - 16vh - 2rem)"]]], [".max-h-\\[min\\(480px\\,calc\\(100dvh_-_16vh_-_2rem\\)\\)\\]", null, 4, [["max-height", "min(480px, 100dvh - 16vh - 2rem)"]]], [".max-h-full", null, 4, [["max-height", "100%"]]], [".min-h-0", null, 4, [["min-height", "0"]]], [".min-h-6", null, 4, [["min-height", "calc(var(--spacing) * 6)"]]], [".min-h-7", null, 4, [["min-height", "calc(var(--spacing) * 7)"]]], [".min-h-8", null, 4, [["min-height", "calc(var(--spacing) * 8)"]]], [".min-h-9", null, 4, [["min-height", "calc(var(--spacing) * 9)"]]], [".min-h-10", null, 4, [["min-height", "calc(var(--spacing) * 10)"]]], [".min-h-11", null, 4, [["min-height", "calc(var(--spacing) * 11)"]]], [".min-h-20", null, 4, [["min-height", "calc(var(--spacing) * 20)"]]], [".min-h-40", null, 4, [["min-height", "calc(var(--spacing) * 40)"]]], [".min-h-\\[1\\.5em\\]", null, 4, [["min-height", "1.5em"]]], [".min-h-\\[1\\.8rem\\]", null, 4, [["min-height", "1.8rem"]]], [".min-h-\\[2\\.5rem\\]", null, 4, [["min-height", "2.5rem"]]], [".min-h-\\[3\\.2rem\\]", null, 4, [["min-height", "3.2rem"]]], [".min-h-\\[3\\.25rem\\]", null, 4, [["min-height", "3.25rem"]]], [".min-h-\\[6rem\\]", null, 4, [["min-height", "6rem"]]], [".min-h-\\[8rem\\]", null, 4, [["min-height", "8rem"]]], [".min-h-\\[10rem\\]", null, 4, [["min-height", "10rem"]]], [".min-h-\\[12rem\\]", null, 4, [["min-height", "12rem"]]], [".min-h-\\[13rem\\]", null, 4, [["min-height", "13rem"]]], [".min-h-\\[32px\\]", null, 4, [["min-height", "32px"]]], [".min-h-\\[44px\\]", null, 4, [["min-height", "44px"]]], [".min-h-\\[60px\\]", null, 4, [["min-height", "60px"]]], [".min-h-\\[100dvh\\]", null, 4, [["min-height", "100dvh"]]], [".min-h-\\[calc\\(22px\\*var\\(--zoom\\,1\\)\\)\\]", null, 4, [["min-height", "calc(22px * var(--zoom, 1))"]]], [".min-h-full", null, 4, [["min-height", "100%"]]], [".w-2", null, 4, [["width", "calc(var(--spacing) * 2)"]]], [".w-2\\.5", null, 4, [["width", "calc(var(--spacing) * 2.5)"]]], [".w-3", null, 4, [["width", "calc(var(--spacing) * 3)"]]], [".w-4", null, 4, [["width", "calc(var(--spacing) * 4)"]]], [".w-5", null, 4, [["width", "calc(var(--spacing) * 5)"]]], [".w-7", null, 4, [["width", "calc(var(--spacing) * 7)"]]], [".w-8", null, 4, [["width", "calc(var(--spacing) * 8)"]]], [".w-9", null, 4, [["width", "calc(var(--spacing) * 9)"]]], [".w-10", null, 4, [["width", "calc(var(--spacing) * 10)"]]], [".w-11", null, 4, [["width", "calc(var(--spacing) * 11)"]]], [".w-20", null, 4, [["width", "calc(var(--spacing) * 20)"]]], [".w-40", null, 4, [["width", "calc(var(--spacing) * 40)"]]], [".w-44", null, 4, [["width", "calc(var(--spacing) * 44)"]]], [".w-60", null, 4, [["width", "calc(var(--spacing) * 60)"]]], [".w-\\[0\\.7rem\\]", null, 4, [["width", ".7rem"]]], [".w-\\[0\\.9rem\\]", null, 4, [["width", ".9rem"]]], [".w-\\[1\\.1rem\\]", null, 4, [["width", "1.1rem"]]], [".w-\\[1\\.4rem\\]", null, 4, [["width", "1.4rem"]]], [".w-\\[1\\.6rem\\]", null, 4, [["width", "1.6rem"]]], [".w-\\[1\\.25rem\\]", null, 4, [["width", "1.25rem"]]], [".w-\\[2\\.4rem\\]", null, 4, [["width", "2.4rem"]]], [".w-\\[2\\.25rem\\]", null, 4, [["width", "2.25rem"]]], [".w-\\[3\\.6rem\\]", null, 4, [["width", "3.6rem"]]], [".w-\\[5\\.2rem\\]", null, 4, [["width", "5.2rem"]]], [".w-\\[6rem\\]", null, 4, [["width", "6rem"]]], [".w-\\[11rem\\]", null, 4, [["width", "11rem"]]], [".w-\\[15rem\\]", null, 4, [["width", "15rem"]]], [".w-\\[16rem\\]", null, 4, [["width", "16rem"]]], [".w-\\[17rem\\]", null, 4, [["width", "17rem"]]], [".w-\\[18px\\]", null, 4, [["width", "18px"]]], [".w-\\[100cqi\\]", null, 4, [["width", "100cqi"]]], [".w-\\[calc\\(\\(100\\%-0\\.875rem\\)\\/8\\)\\]", null, 4, [["width", "calc(12.5% - .109375rem)"]]], [".w-\\[calc\\(100\\%_-_0\\.6rem\\)\\]", null, 4, [["width", "calc(100% - .6rem)"]]], [".w-\\[calc\\(100\\%_-_1rem\\)\\]", null, 4, [["width", "calc(100% - 1rem)"]]], [".w-\\[min\\(22rem\\,calc\\(100vw-3rem\\)\\)\\]", null, 4, [["width", "min(22rem, 100vw - 3rem)"]]], [".w-\\[min\\(26rem\\,100\\%\\)\\]", null, 4, [["width", "min(26rem, 100%)"]]], [".w-\\[min\\(28rem\\,calc\\(100vw-2\\.5rem\\)\\)\\]", null, 4, [["width", "min(28rem, 100vw - 2.5rem)"]]], [".w-\\[min\\(30rem\\,92vw\\)\\]", null, 4, [["width", "min(30rem, 92vw)"]]], [".w-\\[min\\(32rem\\,100\\%\\)\\]", null, 4, [["width", "min(32rem, 100%)"]]], [".w-\\[min\\(340px\\,calc\\(100vw-16px\\)\\)\\]", null, 4, [["width", "min(340px, 100vw - 16px)"]]], [".w-\\[min\\(360px\\,calc\\(100vw_-_2rem\\)\\)\\]", null, 4, [["width", "min(360px, 100vw - 2rem)"]]], [".w-\\[min\\(420px\\,calc\\(100vw_-_16px\\)\\)\\]", null, 4, [["width", "min(420px, 100vw - 16px)"]]], [".w-\\[min\\(480px\\,calc\\(100vw_-_2rem\\)\\)\\]", null, 4, [["width", "min(480px, 100vw - 2rem)"]]], [".w-\\[min\\(560px\\,calc\\(100vw_-_2rem\\)\\)\\]", null, 4, [["width", "min(560px, 100vw - 2rem)"]]], [".w-\\[var\\(--sidebar-width\\,240px\\)\\]", null, 4, [["width", "var(--sidebar-width, 240px)"]]], [".w-\\[var\\(--tools-width\\)\\]", null, 4, [["width", "var(--tools-width)"]]], [".w-auto", null, 4, [["width", "auto"]]], [".w-full", null, 4, [["width", "100%"]]], [".w-px", null, 4, [["width", "1px"]]], [".max-w-24", null, 4, [["max-width", "calc(var(--spacing) * 24)"]]], [".max-w-32", null, 4, [["max-width", "calc(var(--spacing) * 32)"]]], [".max-w-\\[9rem\\]", null, 4, [["max-width", "9rem"]]], [".max-w-\\[10rem\\]", null, 4, [["max-width", "10rem"]]], [".max-w-\\[11rem\\]", null, 4, [["max-width", "11rem"]]], [".max-w-\\[12rem\\]", null, 4, [["max-width", "12rem"]]], [".max-w-\\[14rem\\]", null, 4, [["max-width", "14rem"]]], [".max-w-\\[16rem\\]", null, 4, [["max-width", "16rem"]]], [".max-w-\\[24rem\\]", null, 4, [["max-width", "24rem"]]], [".max-w-\\[25\\%\\]", null, 4, [["max-width", "25%"]]], [".max-w-\\[26rem\\]", null, 4, [["max-width", "26rem"]]], [".max-w-\\[28rem\\]", null, 4, [["max-width", "28rem"]]], [".max-w-\\[35\\%\\]", null, 4, [["max-width", "35%"]]], [".max-w-\\[38\\%\\]", null, 4, [["max-width", "38%"]]], [".max-w-\\[45\\%\\]", null, 4, [["max-width", "45%"]]], [".max-w-\\[46rem\\]", null, 4, [["max-width", "46rem"]]], [".max-w-\\[55\\%\\]", null, 4, [["max-width", "55%"]]], [".max-w-\\[56rem\\]", null, 4, [["max-width", "56rem"]]], [".max-w-\\[85\\%\\]", null, 4, [["max-width", "85%"]]], [".max-w-\\[140px\\]", null, 4, [["max-width", "140px"]]], [".max-w-\\[320px\\]", null, 4, [["max-width", "320px"]]], [".max-w-\\[min\\(22rem\\,calc\\(100\\%-1\\.5rem\\)\\)\\]", null, 4, [["max-width", "min(22rem, 100% - 1.5rem)"]]], [".max-w-\\[min\\(30rem\\,calc\\(100\\%-1\\.6rem\\)\\)\\]", null, 4, [["max-width", "min(30rem, 100% - 1.6rem)"]]], [".max-w-\\[min\\(34rem\\,calc\\(100\\%-1\\.5rem\\)\\)\\]", null, 4, [["max-width", "min(34rem, 100% - 1.5rem)"]]], [".max-w-\\[min\\(42rem\\,calc\\(100cqi-6\\.9rem\\)\\)\\]", null, 4, [["max-width", "min(42rem, 100cqi - 6.9rem)"]]], [".max-w-\\[min\\(320px\\,calc\\(100vw_-_24px\\)\\)\\]", null, 4, [["max-width", "min(320px, 100vw - 24px)"]]], [".max-w-full", null, 4, [["max-width", "100%"]]], [".max-w-none", null, 4, [["max-width", "none"]]], [".min-w-0", null, 4, [["min-width", "0"]]], [".min-w-6", null, 4, [["min-width", "calc(var(--spacing) * 6)"]]], [".min-w-8", null, 4, [["min-width", "calc(var(--spacing) * 8)"]]], [".min-w-11", null, 4, [["min-width", "calc(var(--spacing) * 11)"]]], [".min-w-12", null, 4, [["min-width", "calc(var(--spacing) * 12)"]]], [".min-w-24", null, 4, [["min-width", "calc(var(--spacing) * 24)"]]], [".min-w-36", null, 4, [["min-width", "calc(var(--spacing) * 36)"]]], [".min-w-56", null, 4, [["min-width", "calc(var(--spacing) * 56)"]]], [".min-w-\\[1\\.25rem\\]", null, 4, [["min-width", "1.25rem"]]], [".min-w-\\[5\\.5rem\\]", null, 4, [["min-width", "5.5rem"]]], [".min-w-\\[7rem\\]", null, 4, [["min-width", "7rem"]]], [".min-w-\\[8rem\\]", null, 4, [["min-width", "8rem"]]], [".min-w-\\[13rem\\]", null, 4, [["min-width", "13rem"]]], [".min-w-\\[14px\\]", null, 4, [["min-width", "14px"]]], [".min-w-\\[200px\\]", null, 4, [["min-width", "200px"]]], [".min-w-max", null, 4, [["min-width", "max-content"]]], [".flex-1", null, 4, [["flex", "1"]]], [".flex-\\[0_0_5rem\\]", null, 4, [["flex", "0 0 5rem"]]], [".flex-\\[0_0_8px\\]", null, 4, [["flex", "0 0 8px"]]], [".flex-\\[0_1_40\\%\\]", null, 4, [["flex", "0 40%"]]], [".flex-\\[1_1_100\\%\\]", null, 4, [["flex", "100%"]]], [".flex-\\[2\\]", null, 4, [["flex", "2"]]], [".flex-initial", null, 4, [["flex", "0 auto"]]], [".flex-none", null, 4, [["flex", "none"]]], [".shrink", null, 4, [["flex-shrink", "1"]]], [".shrink-0", null, 4, [["flex-shrink", "0"]]], [".shrink-\\[0\\.001\\]", null, 4, [["flex-shrink", ".001"]]], [".shrink-\\[2\\]", null, 4, [["flex-shrink", "2"]]], [".shrink-\\[3\\]", null, 4, [["flex-shrink", "3"]]], [".grow", null, 4, [["flex-grow", "1"]]], [".basis-0", null, 4, [["flex-basis", "0"]]], [".basis-\\[14rem\\]", null, 4, [["flex-basis", "14rem"]]], [".-translate-y-1\\/2", null, 4, [["--tw-translate-y", "calc(calc(1 / 2 * 100%) * -1)"], ["translate", "var(--tw-translate-x) var(--tw-translate-y)"]]], [".\\[transform\\:translateY\\(-50\\%\\)\\]", null, 4, [["transform", "translateY(-50%)"]]], [".transform", null, 4, [["transform", "var(--tw-rotate-x, ) var(--tw-rotate-y, ) var(--tw-rotate-z, ) var(--tw-skew-x, ) var(--tw-skew-y, )"]]], [".animate-drop-zone", null, 4, [["animation", "var(--animate-drop-zone)"]]], [".animate-host-pulse", null, 4, [["animation", "var(--animate-host-pulse)"]]], [".animate-pulse", null, 4, [["animation", "var(--animate-pulse)"]]], [".animate-toast-in", null, 4, [["animation", "var(--animate-toast-in)"]]], [".cursor-col-resize", null, 4, [["cursor", "col-resize"]]], [".cursor-default", null, 4, [["cursor", "default"]]], [".cursor-grab", null, 4, [["cursor", "grab"]]], [".cursor-grabbing", null, 4, [["cursor", "grabbing"]]], [".cursor-pointer", null, 4, [["cursor", "pointer"]]], [".cursor-row-resize", null, 4, [["cursor", "row-resize"]]], [".touch-none", null, 4, [["touch-action", "none"]]], [".resize", null, 4, [["resize", "both"]]], [".resize-none", null, 4, [["resize", "none"]]], [".resize-y", null, 4, [["resize", "vertical"]]], [".\\[scrollbar-width\\:none\\]", null, 4, [["scrollbar-width", "none"]]], [".list-disc", null, 4, [["list-style-type", "disc"]]], [".list-none", null, 4, [["list-style-type", "none"]]], [".appearance-none", null, 4, [["appearance", "none"]]], [".grid-cols-8", null, 4, [["grid-template-columns", "repeat(8, minmax(0, 1fr))"]]], [".grid-cols-\\[1fr_auto_1fr\\]", null, 4, [["grid-template-columns", "1fr auto 1fr"]]], [".grid-cols-\\[2\\.5rem_2\\.5rem_0\\.9rem_minmax\\(0\\,1fr\\)\\]", null, 4, [["grid-template-columns", "2.5rem 2.5rem .9rem minmax(0, 1fr)"]]], [".grid-cols-\\[auto_minmax\\(0\\,1fr\\)\\]", null, 4, [["grid-template-columns", "auto minmax(0, 1fr)"]]], [".grid-cols-\\[minmax\\(4rem\\,10rem\\)_1fr_auto\\]", null, 4, [["grid-template-columns", "minmax(4rem, 10rem) 1fr auto"]]], [".grid-cols-\\[repeat\\(2\\,minmax\\(0\\,1fr\\)\\)\\]", null, 4, [["grid-template-columns", "repeat(2, minmax(0, 1fr))"]]], [".grid-cols-\\[repeat\\(auto-fit\\,minmax\\(8rem\\,1fr\\)\\)\\]", null, 4, [["grid-template-columns", "repeat(auto-fit, minmax(8rem, 1fr))"]]], [".flex-col", null, 4, [["flex-direction", "column"]]], [".flex-row", null, 4, [["flex-direction", "row"]]], [".flex-wrap", null, 4, [["flex-wrap", "wrap"]]], [".place-items-center", null, 4, [["place-items", "center"]]], [".content-center", null, 4, [["align-content", "center"]]], [".items-baseline", null, 4, [["align-items", "baseline"]]], [".items-center", null, 4, [["align-items", "center"]]], [".items-end", null, 4, [["align-items", "flex-end"]]], [".items-start", null, 4, [["align-items", "flex-start"]]], [".items-stretch", null, 4, [["align-items", "stretch"]]], [".justify-between", null, 4, [["justify-content", "space-between"]]], [".justify-center", null, 4, [["justify-content", "center"]]], [".justify-end", null, 4, [["justify-content", "flex-end"]]], [".justify-start", null, 4, [["justify-content", "flex-start"]]], [".justify-items-center", null, 4, [["justify-items", "center"]]], [".justify-items-start", null, 4, [["justify-items", "start"]]], [".gap-0", null, 4, [["gap", "0"]]], [".gap-0\\.5", null, 4, [["gap", "calc(var(--spacing) * .5)"]]], [".gap-1", null, 4, [["gap", "var(--spacing)"]]], [".gap-1\\.5", null, 4, [["gap", "calc(var(--spacing) * 1.5)"]]], [".gap-2", null, 4, [["gap", "calc(var(--spacing) * 2)"]]], [".gap-3", null, 4, [["gap", "calc(var(--spacing) * 3)"]]], [".gap-4", null, 4, [["gap", "calc(var(--spacing) * 4)"]]], [".gap-6", null, 4, [["gap", "calc(var(--spacing) * 6)"]]], [".gap-\\[0\\.1rem\\]", null, 4, [["gap", ".1rem"]]], [".gap-\\[0\\.2rem\\]", null, 4, [["gap", ".2rem"]]], [".gap-\\[0\\.3rem\\]", null, 4, [["gap", ".3rem"]]], [".gap-\\[0\\.4rem\\]", null, 4, [["gap", ".4rem"]]], [".gap-\\[0\\.05rem\\]", null, 4, [["gap", ".05rem"]]], [".gap-\\[0\\.6rem\\]", null, 4, [["gap", ".6rem"]]], [".gap-\\[0\\.8rem\\]", null, 4, [["gap", ".8rem"]]], [".gap-\\[0\\.15rem\\]", null, 4, [["gap", ".15rem"]]], [".gap-\\[0\\.16rem\\]", null, 4, [["gap", ".16rem"]]], [".gap-\\[0\\.32rem\\]", null, 4, [["gap", ".32rem"]]], [".gap-\\[0\\.35rem\\]", null, 4, [["gap", ".35rem"]]], [".gap-\\[0\\.45rem\\]", null, 4, [["gap", ".45rem"]]], [".gap-\\[0\\.55rem\\]", null, 4, [["gap", ".55rem"]]], [".gap-\\[0\\.65rem\\]", null, 4, [["gap", ".65rem"]]], [".gap-\\[0\\.85rem\\]", null, 4, [["gap", ".85rem"]]], [".gap-\\[2px\\]", null, 4, [["gap", "2px"]]], [".gap-\\[3px\\]", null, 4, [["gap", "3px"]]], [".gap-\\[7px\\]", null, 4, [["gap", "7px"]]], [".gap-\\[13px\\]", null, 4, [["gap", "13px"]]], [":where(.space-y-0\\.5 > :not(:last-child))", null, 4, [["--tw-space-y-reverse", "0"], ["margin-block-start", "calc(calc(var(--spacing) * .5) * var(--tw-space-y-reverse))"], ["margin-block-end", "calc(calc(var(--spacing) * .5) * calc(1 - var(--tw-space-y-reverse)))"]]], [".gap-x-3", null, 4, [["column-gap", "calc(var(--spacing) * 3)"]]], [".gap-x-4", null, 4, [["column-gap", "calc(var(--spacing) * 4)"]]], [".gap-x-\\[0\\.4rem\\]", null, 4, [["column-gap", ".4rem"]]], [".gap-y-1", null, 4, [["row-gap", "var(--spacing)"]]], [".gap-y-\\[0\\.3rem\\]", null, 4, [["row-gap", ".3rem"]]], [".self-center", null, 4, [["align-self", "center"]]], [".self-end", null, 4, [["align-self", "flex-end"]]], [".self-start", null, 4, [["align-self", "flex-start"]]], [".self-stretch", null, 4, [["align-self", "stretch"]]], [".justify-self-start", null, 4, [["justify-self", "flex-start"]]], [".truncate", null, 4, [["text-overflow", "ellipsis"], ["white-space", "nowrap"], ["overflow", "hidden"]]], [".overflow-auto", null, 4, [["overflow", "auto"]]], [".overflow-hidden", null, 4, [["overflow", "hidden"]]], [".overflow-visible", null, 4, [["overflow", "visible"]]], [".overflow-x-auto", null, 4, [["overflow-x", "auto"]]], [".overflow-x-hidden", null, 4, [["overflow-x", "hidden"]]], [".overflow-y-auto", null, 4, [["overflow-y", "auto"]]], [".overflow-y-hidden", null, 4, [["overflow-y", "hidden"]]], [".overscroll-contain", null, 4, [["overscroll-behavior", "contain"]]], [".overscroll-x-contain", null, 4, [["overscroll-behavior-x", "contain"]]], [".rounded, .rounded-\\[0\\.25rem\\]", null, 4, [["border-radius", ".25rem"]]], [".rounded-\\[1\\.5rem\\]", null, 4, [["border-radius", "1.5rem"]]], [".rounded-\\[2px\\]", null, 4, [["border-radius", "2px"]]], [".rounded-\\[3px\\]", null, 4, [["border-radius", "3px"]]], [".rounded-\\[12px\\]", null, 4, [["border-radius", "12px"]]], [".rounded-\\[50\\%\\]", null, 4, [["border-radius", "50%"]]], [".rounded-\\[999px\\]", null, 4, [["border-radius", "999px"]]], [".rounded-\\[calc\\(var\\(--radius\\)\\*2\\)\\]", null, 4, [["border-radius", "calc(var(--radius) * 2)"]]], [".rounded-\\[var\\(--card-radius\\,8px\\)\\]", null, 4, [["border-radius", "var(--card-radius, 8px)"]]], [".rounded-\\[var\\(--card-radius\\,12px\\)\\]", null, 4, [["border-radius", "var(--card-radius, 12px)"]]], [".rounded-full", null, 4, [["border-radius", "3.40282e38px"]]], [".rounded-none", null, 4, [["border-radius", "0"]]], [".rounded-soft", null, 4, [["border-radius", "var(--radius-pane)"]]], [".rounded-ui", null, 4, [["border-radius", "var(--radius)"]]], [".rounded-t-\\[12px\\]", null, 4, [["border-top-left-radius", "12px"], ["border-top-right-radius", "12px"]]], [".rounded-t-none", null, 4, [["border-top-left-radius", "0"], ["border-top-right-radius", "0"]]], [".rounded-br-\\[3px\\]", null, 4, [["border-bottom-right-radius", "3px"]]], [".rounded-bl-\\[3px\\]", null, 4, [["border-bottom-left-radius", "3px"]]], [".rounded-bl-\\[6px\\]", null, 4, [["border-bottom-left-radius", "6px"]]], [".border", null, 4, [["border-style", "var(--tw-border-style)"], ["border-width", "1px"]]], [".border-0", null, 4, [["border-style", "var(--tw-border-style)"], ["border-width", "0"]]], [".border-\\[1\\.5px\\]", null, 4, [["border-style", "var(--tw-border-style)"], ["border-width", "1.5px"]]], [".border-r", null, 4, [["border-right-style", "var(--tw-border-style)"], ["border-right-width", "1px"]]], [".border-b", null, 4, [["border-bottom-style", "var(--tw-border-style)"], ["border-bottom-width", "1px"]]], [".border-l", null, 4, [["border-left-style", "var(--tw-border-style)"], ["border-left-width", "1px"]]], [".border-l-\\[3px\\]", null, 4, [["border-left-style", "var(--tw-border-style)"], ["border-left-width", "3px"]]], [".border-solid", null, 4, [["--tw-border-style", "solid"], ["border-style", "solid"]]], [".border-accent", null, 4, [["border-color", "var(--accent)"]]], [".border-overlay-0", null, 4, [["border-color", "var(--overlay-0)"]]], [".border-overlay-1", null, 4, [["border-color", "var(--overlay-1)"]]], [".border-red", null, 4, [["border-color", "var(--red)"]]], [".border-subtext-0", null, 4, [["border-color", "var(--subtext-0)"]]], [".border-surface-1", null, 4, [["border-color", "var(--surface-1)"]]], [".border-teal", null, 4, [["border-color", "var(--teal)"]]], [".border-yellow", null, 4, [["border-color", "var(--yellow)"]]], [".border-l-accent", null, 4, [["border-left-color", "var(--accent)"]]], [".border-l-green", null, 4, [["border-left-color", "var(--green)"]]], [".border-l-red", null, 4, [["border-left-color", "var(--red)"]]], [".border-l-yellow", null, 4, [["border-left-color", "var(--yellow)"]]], [".bg-\\[\\#161616\\]", null, 4, [["background-color", "#161616"]]], [".bg-\\[\\#fff\\]", null, 4, [["background-color", "#fff"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_8\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "var(--accent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_8\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--accent) 8%,var(--panel-bg))"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_12\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--accent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_12\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--accent) 12%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--accent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--accent) 15%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_22\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--accent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_22\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--accent) 22%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--blue\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--blue)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--blue\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--blue) 15%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--green\\)_9\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--green)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--green\\)_9\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--green) 9%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--red\\)_7\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--red)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--red\\)_7\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--red) 7%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--red\\)_9\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--red)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--red\\)_9\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--red) 9%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--surface-1\\)_42\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--surface-1\\)_42\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--surface-1) 42%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--surface-1\\)_70\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--surface-1\\)_70\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--surface-1) 70%,var(--panel-bg))"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--text\\)_10\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "var(--text)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--text\\)_10\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--text) 10%,var(--panel-bg))"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--yellow\\)_8\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--yellow)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--yellow\\)_8\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--yellow) 8%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--yellow\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--yellow)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--yellow\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--yellow) 15%,transparent)"]]], [".bg-\\[rgba\\(0\\,0\\,0\\,0\\.5\\)\\]", null, 4, [["background-color", "#00000080"]]], [".bg-\\[rgba\\(0\\,0\\,0\\,0\\.7\\)\\]", null, 4, [["background-color", "#000000b3"]]], [".bg-\\[rgba\\(0\\,0\\,0\\,0\\.55\\)\\]", null, 4, [["background-color", "#0000008c"]]], [".bg-\\[rgba\\(0\\,0\\,0\\,0\\.62\\)\\]", null, 4, [["background-color", "#0000009e"]]], [".bg-\\[var\\(--accent\\)\\]", null, 4, [["background-color", "var(--accent)"]]], [".bg-\\[var\\(--backdrop\\)\\]", null, 4, [["background-color", "var(--backdrop)"]]], [".bg-\\[var\\(--bg\\)\\]", null, 4, [["background-color", "var(--bg)"]]], [".bg-\\[var\\(--card-bg\\)\\]", null, 4, [["background-color", "var(--card-bg)"]]], [".bg-\\[var\\(--picker-bg\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "var(--picker-bg, var(--panel-bg))"]]], [".bg-\\[var\\(--surface-1\\)\\]", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-\\[var\\(--workspace-tools-bg\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "var(--workspace-tools-bg, var(--panel-bg))"]]], [".bg-accent, .bg-accent\\/10", null, 4, [["background-color", "var(--accent)"]]], [".bg-accent\\/10", null, 4, [["background-color", "color-mix(in oklab, var(--accent) 10%, transparent)"]]], [".bg-accent\\/35", null, 4, [["background-color", "var(--accent)"]]], [".bg-accent\\/35", null, 4, [["background-color", "color-mix(in oklab, var(--accent) 35%, transparent)"]]], [".bg-fg", null, 4, [["background-color", "var(--text)"]]], [".bg-green, .bg-green\\/15", null, 4, [["background-color", "var(--green)"]]], [".bg-green\\/15", null, 4, [["background-color", "color-mix(in oklab, var(--green) 15%, transparent)"]]], [".bg-overlay-0", null, 4, [["background-color", "var(--overlay-0)"]]], [".bg-overlay-1", null, 4, [["background-color", "var(--overlay-1)"]]], [".bg-panel-bg", null, 4, [["background-color", "var(--panel-bg)"]]], [".bg-red, .bg-red\\/15", null, 4, [["background-color", "var(--red)"]]], [".bg-red\\/15", null, 4, [["background-color", "color-mix(in oklab, var(--red) 15%, transparent)"]]], [".bg-subtext-0", null, 4, [["background-color", "var(--subtext-0)"]]], [".bg-surface-0", null, 4, [["background-color", "var(--surface-0)"]]], [".bg-surface-1, .bg-surface-1\\/30", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-surface-1\\/30", null, 4, [["background-color", "color-mix(in oklab, var(--surface-1) 30%, transparent)"]]], [".bg-surface-1\\/60", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-surface-1\\/60", null, 4, [["background-color", "color-mix(in oklab, var(--surface-1) 60%, transparent)"]]], [".bg-surface-1\\/70", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-surface-1\\/70", null, 4, [["background-color", "color-mix(in oklab, var(--surface-1) 70%, transparent)"]]], [".bg-transparent", null, 4, [["background-color", "#0000"]]], [".bg-yellow", null, 4, [["background-color", "var(--yellow)"]]], [".object-contain", null, 4, [["object-fit", "contain"]]], [".object-cover", null, 4, [["object-fit", "cover"]]], [".p-0", null, 4, [["padding", "0"]]], [".p-0\\.5", null, 4, [["padding", "calc(var(--spacing) * .5)"]]], [".p-1", null, 4, [["padding", "var(--spacing)"]]], [".p-2", null, 4, [["padding", "calc(var(--spacing) * 2)"]]], [".p-3", null, 4, [["padding", "calc(var(--spacing) * 3)"]]], [".p-4", null, 4, [["padding", "calc(var(--spacing) * 4)"]]], [".p-5", null, 4, [["padding", "calc(var(--spacing) * 5)"]]], [".p-6", null, 4, [["padding", "calc(var(--spacing) * 6)"]]], [".p-\\[0\\.2rem\\]", null, 4, [["padding", ".2rem"]]], [".p-\\[0\\.4rem\\]", null, 4, [["padding", ".4rem"]]], [".p-\\[0\\.5rem\\]", null, 4, [["padding", ".5rem"]]], [".p-\\[0\\.9rem\\]", null, 4, [["padding", ".9rem"]]], [".p-\\[0\\.35rem\\]", null, 4, [["padding", ".35rem"]]], [".p-\\[0\\.45rem\\]", null, 4, [["padding", ".45rem"]]], [".p-\\[0\\.55rem\\]", null, 4, [["padding", ".55rem"]]], [".p-\\[0\\.65rem\\]", null, 4, [["padding", ".65rem"]]], [".p-\\[2px\\]", null, 4, [["padding", "2px"]]], [".px-0", null, 4, [["padding-inline", "0"]]], [".px-1", null, 4, [["padding-inline", "var(--spacing)"]]], [".px-1\\.5", null, 4, [["padding-inline", "calc(var(--spacing) * 1.5)"]]], [".px-2", null, 4, [["padding-inline", "calc(var(--spacing) * 2)"]]], [".px-3", null, 4, [["padding-inline", "calc(var(--spacing) * 3)"]]], [".px-3\\.5", null, 4, [["padding-inline", "calc(var(--spacing) * 3.5)"]]], [".px-4", null, 4, [["padding-inline", "calc(var(--spacing) * 4)"]]], [".px-8", null, 4, [["padding-inline", "calc(var(--spacing) * 8)"]]], [".px-\\[0\\.2rem\\]", null, 4, [["padding-inline", ".2rem"]]], [".px-\\[0\\.3rem\\]", null, 4, [["padding-inline", ".3rem"]]], [".px-\\[0\\.4rem\\]", null, 4, [["padding-inline", ".4rem"]]], [".px-\\[0\\.5rem\\]", null, 4, [["padding-inline", ".5rem"]]], [".px-\\[0\\.6rem\\]", null, 4, [["padding-inline", ".6rem"]]], [".px-\\[0\\.7rem\\]", null, 4, [["padding-inline", ".7rem"]]], [".px-\\[0\\.8rem\\]", null, 4, [["padding-inline", ".8rem"]]], [".px-\\[0\\.9rem\\]", null, 4, [["padding-inline", ".9rem"]]], [".px-\\[0\\.26rem\\]", null, 4, [["padding-inline", ".26rem"]]], [".px-\\[0\\.28rem\\]", null, 4, [["padding-inline", ".28rem"]]], [".px-\\[0\\.35rem\\]", null, 4, [["padding-inline", ".35rem"]]], [".px-\\[0\\.42rem\\]", null, 4, [["padding-inline", ".42rem"]]], [".px-\\[0\\.45rem\\]", null, 4, [["padding-inline", ".45rem"]]], [".px-\\[0\\.48rem\\]", null, 4, [["padding-inline", ".48rem"]]], [".px-\\[0\\.55rem\\]", null, 4, [["padding-inline", ".55rem"]]], [".px-\\[0\\.65rem\\]", null, 4, [["padding-inline", ".65rem"]]], [".px-\\[0\\.75rem\\]", null, 4, [["padding-inline", ".75rem"]]], [".px-\\[0\\.85rem\\]", null, 4, [["padding-inline", ".85rem"]]], [".px-\\[1\\.4rem\\]", null, 4, [["padding-inline", "1.4rem"]]], [".px-\\[3px\\]", null, 4, [["padding-inline", "3px"]]], [".px-\\[10px\\]", null, 4, [["padding-inline", "10px"]]], [".py-0", null, 4, [["padding-block", "0"]]], [".py-0\\.5", null, 4, [["padding-block", "calc(var(--spacing) * .5)"]]], [".py-1", null, 4, [["padding-block", "var(--spacing)"]]], [".py-1\\.5", null, 4, [["padding-block", "calc(var(--spacing) * 1.5)"]]], [".py-2", null, 4, [["padding-block", "calc(var(--spacing) * 2)"]]], [".py-3", null, 4, [["padding-block", "calc(var(--spacing) * 3)"]]], [".py-4", null, 4, [["padding-block", "calc(var(--spacing) * 4)"]]], [".py-8", null, 4, [["padding-block", "calc(var(--spacing) * 8)"]]], [".py-\\[0\\.1rem\\]", null, 4, [["padding-block", ".1rem"]]], [".py-\\[0\\.2rem\\]", null, 4, [["padding-block", ".2rem"]]], [".py-\\[0\\.3rem\\]", null, 4, [["padding-block", ".3rem"]]], [".py-\\[0\\.4rem\\]", null, 4, [["padding-block", ".4rem"]]], [".py-\\[0\\.05rem\\]", null, 4, [["padding-block", ".05rem"]]], [".py-\\[0\\.6rem\\]", null, 4, [["padding-block", ".6rem"]]], [".py-\\[0\\.8rem\\]", null, 4, [["padding-block", ".8rem"]]], [".py-\\[0\\.12rem\\]", null, 4, [["padding-block", ".12rem"]]], [".py-\\[0\\.14rem\\]", null, 4, [["padding-block", ".14rem"]]], [".py-\\[0\\.15rem\\]", null, 4, [["padding-block", ".15rem"]]], [".py-\\[0\\.18rem\\]", null, 4, [["padding-block", ".18rem"]]], [".py-\\[0\\.25rem\\]", null, 4, [["padding-block", ".25rem"]]], [".py-\\[0\\.28rem\\]", null, 4, [["padding-block", ".28rem"]]], [".py-\\[0\\.32rem\\]", null, 4, [["padding-block", ".32rem"]]], [".py-\\[0\\.35rem\\]", null, 4, [["padding-block", ".35rem"]]], [".py-\\[0\\.42rem\\]", null, 4, [["padding-block", ".42rem"]]], [".py-\\[0\\.45rem\\]", null, 4, [["padding-block", ".45rem"]]], [".py-\\[0\\.55rem\\]", null, 4, [["padding-block", ".55rem"]]], [".py-\\[0\\.65rem\\]", null, 4, [["padding-block", ".65rem"]]], [".py-\\[2px\\]", null, 4, [["padding-block", "2px"]]], [".py-\\[3px\\]", null, 4, [["padding-block", "3px"]]], [".py-\\[6px\\]", null, 4, [["padding-block", "6px"]]], [".py-px", null, 4, [["padding-block", "1px"]]], [".pt-1", null, 4, [["padding-top", "var(--spacing)"]]], [".pt-2", null, 4, [["padding-top", "calc(var(--spacing) * 2)"]]], [".pt-2\\.5", null, 4, [["padding-top", "calc(var(--spacing) * 2.5)"]]], [".pt-3", null, 4, [["padding-top", "calc(var(--spacing) * 3)"]]], [".pt-4", null, 4, [["padding-top", "calc(var(--spacing) * 4)"]]], [".pt-5", null, 4, [["padding-top", "calc(var(--spacing) * 5)"]]], [".pt-\\[0\\.2rem\\]", null, 4, [["padding-top", ".2rem"]]], [".pt-\\[0\\.4rem\\]", null, 4, [["padding-top", ".4rem"]]], [".pt-\\[0\\.6rem\\]", null, 4, [["padding-top", ".6rem"]]], [".pt-\\[0\\.85rem\\]", null, 4, [["padding-top", ".85rem"]]], [".pt-\\[2px\\]", null, 4, [["padding-top", "2px"]]], [".pt-\\[12vh\\]", null, 4, [["padding-top", "12vh"]]], [".pt-\\[max\\(0\\.5rem\\,env\\(safe-area-inset-top\\)\\)\\]", null, 4, [["padding-top", "max(.5rem, env(safe-area-inset-top))"]]], [".pr-0\\.5", null, 4, [["padding-right", "calc(var(--spacing) * .5)"]]], [".pr-1", null, 4, [["padding-right", "var(--spacing)"]]], [".pr-1\\.5", null, 4, [["padding-right", "calc(var(--spacing) * 1.5)"]]], [".pr-2", null, 4, [["padding-right", "calc(var(--spacing) * 2)"]]], [".pr-3", null, 4, [["padding-right", "calc(var(--spacing) * 3)"]]], [".pr-12", null, 4, [["padding-right", "calc(var(--spacing) * 12)"]]], [".pr-\\[0\\.3rem\\]", null, 4, [["padding-right", ".3rem"]]], [".pr-\\[0\\.6rem\\]", null, 4, [["padding-right", ".6rem"]]], [".pr-\\[0\\.35rem\\]", null, 4, [["padding-right", ".35rem"]]], [".pr-\\[0\\.45rem\\]", null, 4, [["padding-right", ".45rem"]]], [".pr-\\[0\\.55rem\\]", null, 4, [["padding-right", ".55rem"]]], [".pr-\\[1\\.6rem\\]", null, 4, [["padding-right", "1.6rem"]]], [".pr-\\[3px\\]", null, 4, [["padding-right", "3px"]]], [".pr-\\[env\\(safe-area-inset-right\\)\\]", null, 4, [["padding-right", "env(safe-area-inset-right)"]]], [".pr-\\[max\\(0\\.5rem\\,env\\(safe-area-inset-right\\)\\)\\]", null, 4, [["padding-right", "max(.5rem, env(safe-area-inset-right))"]]], [".pb-1", null, 4, [["padding-bottom", "var(--spacing)"]]], [".pb-2", null, 4, [["padding-bottom", "calc(var(--spacing) * 2)"]]], [".pb-3", null, 4, [["padding-bottom", "calc(var(--spacing) * 3)"]]], [".pb-4", null, 4, [["padding-bottom", "calc(var(--spacing) * 4)"]]], [".pb-8", null, 4, [["padding-bottom", "calc(var(--spacing) * 8)"]]], [".pb-\\[0\\.3rem\\]", null, 4, [["padding-bottom", ".3rem"]]], [".pb-\\[0\\.4rem\\]", null, 4, [["padding-bottom", ".4rem"]]], [".pb-\\[0\\.25rem\\]", null, 4, [["padding-bottom", ".25rem"]]], [".pb-\\[0\\.35rem\\]", null, 4, [["padding-bottom", ".35rem"]]], [".pb-\\[0\\.55rem\\]", null, 4, [["padding-bottom", ".55rem"]]], [".pb-\\[1\\.4rem\\]", null, 4, [["padding-bottom", "1.4rem"]]], [".pb-\\[calc\\(1\\.5rem\\+env\\(safe-area-inset-bottom\\)\\)\\]", null, 4, [["padding-bottom", "calc(1.5rem + env(safe-area-inset-bottom))"]]], [".pb-\\[calc\\(1rem\\+env\\(safe-area-inset-bottom\\)\\)\\]", null, 4, [["padding-bottom", "calc(1rem + env(safe-area-inset-bottom))"]]], [".pb-\\[env\\(safe-area-inset-bottom\\)\\]", null, 4, [["padding-bottom", "env(safe-area-inset-bottom)"]]], [".pb-\\[max\\(0\\.5rem\\,env\\(safe-area-inset-bottom\\)\\)\\]", null, 4, [["padding-bottom", "max(.5rem, env(safe-area-inset-bottom))"]]], [".pl-1", null, 4, [["padding-left", "var(--spacing)"]]], [".pl-1\\.5", null, 4, [["padding-left", "calc(var(--spacing) * 1.5)"]]], [".pl-2", null, 4, [["padding-left", "calc(var(--spacing) * 2)"]]], [".pl-3", null, 4, [["padding-left", "calc(var(--spacing) * 3)"]]], [".pl-4", null, 4, [["padding-left", "calc(var(--spacing) * 4)"]]], [".pl-5", null, 4, [["padding-left", "calc(var(--spacing) * 5)"]]], [".pl-6", null, 4, [["padding-left", "calc(var(--spacing) * 6)"]]], [".pl-\\[0\\.4rem\\]", null, 4, [["padding-left", ".4rem"]]], [".pl-\\[0\\.45rem\\]", null, 4, [["padding-left", ".45rem"]]], [".pl-\\[0\\.75rem\\]", null, 4, [["padding-left", ".75rem"]]], [".pl-\\[0\\.85rem\\]", null, 4, [["padding-left", ".85rem"]]], [".pl-\\[1\\.2rem\\]", null, 4, [["padding-left", "1.2rem"]]], [".pl-\\[1\\.55rem\\]", null, 4, [["padding-left", "1.55rem"]]], [".pl-\\[1\\.075rem\\]", null, 4, [["padding-left", "1.075rem"]]], [".pl-\\[1\\.525rem\\]", null, 4, [["padding-left", "1.525rem"]]], [".pl-\\[1\\.875rem\\]", null, 4, [["padding-left", "1.875rem"]]], [".pl-\\[85px\\]", null, 4, [["padding-left", "85px"]]], [".pl-\\[max\\(0\\.5rem\\,env\\(safe-area-inset-left\\)\\)\\]", null, 4, [["padding-left", "max(.5rem, env(safe-area-inset-left))"]]], [".pl-\\[max\\(0\\.25rem\\,env\\(safe-area-inset-left\\)\\)\\]", null, 4, [["padding-left", "max(.25rem, env(safe-area-inset-left))"]]], [".text-center", null, 4, [["text-align", "center"]]], [".text-left", null, 4, [["text-align", "left"]]], [".text-right", null, 4, [["text-align", "right"]]], [".\\[font-family\\:inherit\\]", null, 4, [["font-family", "inherit"]]], [".\\[font-family\\:ui-monospace\\,SFMono-Regular\\,Menlo\\,monospace\\]", null, 4, [["font-family", "ui-monospace, SFMono-Regular, Menlo, monospace"]]], [".\\[font-family\\:var\\(--font-mono\\)\\], .font-mono", null, 4, [["font-family", "var(--font-mono)"]]], [".text-sm", null, 4, [["font-size", "var(--text-sm)"], ["line-height", "var(--tw-leading, var(--text-sm--line-height))"]]], [".text-xs", null, 4, [["font-size", "var(--text-xs)"], ["line-height", "var(--tw-leading, var(--text-xs--line-height))"]]], [".\\[font-size\\:inherit\\]", null, 4, [["font-size", "inherit"]]], [".text-\\[0\\.6rem\\]", null, 4, [["font-size", ".6rem"]]], [".text-\\[0\\.7rem\\]", null, 4, [["font-size", ".7rem"]]], [".text-\\[0\\.8em\\]", null, 4, [["font-size", ".8em"]]], [".text-\\[0\\.8rem\\]", null, 4, [["font-size", ".8rem"]]], [".text-\\[0\\.9em\\]", null, 4, [["font-size", ".9em"]]], [".text-\\[0\\.9rem\\]", null, 4, [["font-size", ".9rem"]]], [".text-\\[0\\.54rem\\]", null, 4, [["font-size", ".54rem"]]], [".text-\\[0\\.58rem\\]", null, 4, [["font-size", ".58rem"]]], [".text-\\[0\\.62rem\\]", null, 4, [["font-size", ".62rem"]]], [".text-\\[0\\.63rem\\]", null, 4, [["font-size", ".63rem"]]], [".text-\\[0\\.64rem\\]", null, 4, [["font-size", ".64rem"]]], [".text-\\[0\\.65rem\\]", null, 4, [["font-size", ".65rem"]]], [".text-\\[0\\.66rem\\]", null, 4, [["font-size", ".66rem"]]], [".text-\\[0\\.66rem\\]\\!", null, 4, [["font-size", ".66rem", 1]]], [".text-\\[0\\.68rem\\]", null, 4, [["font-size", ".68rem"]]], [".text-\\[0\\.72rem\\]", null, 4, [["font-size", ".72rem"]]], [".text-\\[0\\.74rem\\]", null, 4, [["font-size", ".74rem"]]], [".text-\\[0\\.75rem\\]", null, 4, [["font-size", ".75rem"]]], [".text-\\[0\\.76rem\\]", null, 4, [["font-size", ".76rem"]]], [".text-\\[0\\.77rem\\]", null, 4, [["font-size", ".77rem"]]], [".text-\\[0\\.78rem\\]", null, 4, [["font-size", ".78rem"]]], [".text-\\[0\\.82rem\\]", null, 4, [["font-size", ".82rem"]]], [".text-\\[0\\.83rem\\]", null, 4, [["font-size", ".83rem"]]], [".text-\\[0\\.85rem\\]", null, 4, [["font-size", ".85rem"]]], [".text-\\[0\\.88rem\\]", null, 4, [["font-size", ".88rem"]]], [".text-\\[0\\.95rem\\]", null, 4, [["font-size", ".95rem"]]], [".text-\\[0\\.875rem\\]", null, 4, [["font-size", ".875rem"]]], [".text-\\[1\\.1rem\\]", null, 4, [["font-size", "1.1rem"]]], [".text-\\[1\\.4em\\]", null, 4, [["font-size", "1.4em"]]], [".text-\\[1\\.6rem\\]", null, 4, [["font-size", "1.6rem"]]], [".text-\\[1\\.15rem\\]", null, 4, [["font-size", "1.15rem"]]], [".text-\\[1rem\\]", null, 4, [["font-size", "1rem"]]], [".text-\\[2\\.4rem\\]", null, 4, [["font-size", "2.4rem"]]], [".text-\\[9px\\]", null, 4, [["font-size", "9px"]]], [".text-\\[10px\\]", null, 4, [["font-size", "10px"]]], [".text-\\[11px\\]", null, 4, [["font-size", "11px"]]], [".text-\\[12\\.5px\\]", null, 4, [["font-size", "12.5px"]]], [".text-\\[12px\\]", null, 4, [["font-size", "12px"]]], [".text-\\[13px\\]", null, 4, [["font-size", "13px"]]], [".text-\\[14px\\]", null, 4, [["font-size", "14px"]]], [".text-\\[calc\\(0\\.95rem\\*var\\(--chat-font-scale\\,1\\)\\)\\]", null, 4, [["font-size", "calc(.95rem * var(--chat-font-scale, 1))"]]], [".text-\\[length\\:calc\\(11px\\*var\\(--zoom\\,1\\)\\)\\]", null, 4, [["font-size", "calc(11px * var(--zoom, 1))"]]], [".text-\\[length\\:calc\\(13px\\*var\\(--zoom\\,1\\)\\)\\]", null, 4, [["font-size", "calc(13px * var(--zoom, 1))"]]], [".leading-4", null, 4, [["--tw-leading", "calc(var(--spacing) * 4)"], ["line-height", "calc(var(--spacing) * 4)"]]], [".leading-\\[1\\.1\\]", null, 4, [["--tw-leading", "1.1"], ["line-height", "1.1"]]], [".leading-\\[1\\.2\\]", null, 4, [["--tw-leading", "1.2"], ["line-height", "1.2"]]], [".leading-\\[1\\.3\\]", null, 4, [["--tw-leading", "1.3"], ["line-height", "1.3"]]], [".leading-\\[1\\.4\\]", null, 4, [["--tw-leading", "1.4"], ["line-height", "1.4"]]], [".leading-\\[1\\.5\\]", null, 4, [["--tw-leading", "1.5"], ["line-height", "1.5"]]], [".leading-\\[1\\.6\\]", null, 4, [["--tw-leading", "1.6"], ["line-height", "1.6"]]], [".leading-\\[1\\.45\\]", null, 4, [["--tw-leading", "1.45"], ["line-height", "1.45"]]], [".leading-\\[18px\\]", null, 4, [["--tw-leading", "18px"], ["line-height", "18px"]]], [".leading-none", null, 4, [["--tw-leading", "1"], ["line-height", "1"]]], [".leading-relaxed", null, 4, [["--tw-leading", "var(--leading-relaxed)"], ["line-height", "var(--leading-relaxed)"]]], [".leading-tight", null, 4, [["--tw-leading", "var(--leading-tight)"], ["line-height", "var(--leading-tight)"]]], [".\\[line-height\\:inherit\\]", null, 4, [["line-height", "inherit"]]], [".font-bold", null, 4, [["--tw-font-weight", "var(--font-weight-bold)"], ["font-weight", "var(--font-weight-bold)"]]], [".font-medium", null, 4, [["--tw-font-weight", "var(--font-weight-medium)"], ["font-weight", "var(--font-weight-medium)"]]], [".font-normal", null, 4, [["--tw-font-weight", "var(--font-weight-normal)"], ["font-weight", "var(--font-weight-normal)"]]], [".font-semibold", null, 4, [["--tw-font-weight", "var(--font-weight-semibold)"], ["font-weight", "var(--font-weight-semibold)"]]], [".\\[font-weight\\:inherit\\]", null, 4, [["font-weight", "inherit"]]], [".tracking-\\[-0\\.02em\\]", null, 4, [["--tw-tracking", "-.02em"], ["letter-spacing", "-.02em"]]], [".tracking-\\[0\\.03em\\]", null, 4, [["--tw-tracking", ".03em"], ["letter-spacing", ".03em"]]], [".tracking-\\[0\\.04em\\]", null, 4, [["--tw-tracking", ".04em"], ["letter-spacing", ".04em"]]], [".tracking-\\[0\\.06em\\]", null, 4, [["--tw-tracking", ".06em"], ["letter-spacing", ".06em"]]], [".tracking-\\[0\\.08em\\]", null, 4, [["--tw-tracking", ".08em"], ["letter-spacing", ".08em"]]], [".tracking-\\[0\\.09em\\]", null, 4, [["--tw-tracking", ".09em"], ["letter-spacing", ".09em"]]], [".tracking-\\[0\\.22em\\]", null, 4, [["--tw-tracking", ".22em"], ["letter-spacing", ".22em"]]], [".tracking-normal", null, 4, [["--tw-tracking", "var(--tracking-normal)"], ["letter-spacing", "var(--tracking-normal)"]]], [".tracking-wide", null, 4, [["--tw-tracking", "var(--tracking-wide)"], ["letter-spacing", "var(--tracking-wide)"]]], [".\\[overflow-wrap\\:anywhere\\]", null, 4, [["overflow-wrap", "anywhere"]]], [".break-words", null, 4, [["overflow-wrap", "break-word"]]], [".\\[word-break\\:break-word\\]", null, 4, [["word-break", "break-word"]]], [".text-ellipsis", null, 4, [["text-overflow", "ellipsis"]]], [".whitespace-normal", null, 4, [["white-space", "normal"]]], [".whitespace-nowrap", null, 4, [["white-space", "nowrap"]]], [".whitespace-pre", null, 4, [["white-space", "pre"]]], [".whitespace-pre-wrap", null, 4, [["white-space", "pre-wrap"]]], [".\\[tab-size\\:2\\]", null, 4, [["tab-size", "2"]]], [".text-\\[color\\:var\\(--git-muted\\)\\]", null, 4, [["color", "var(--git-muted)"]]], [".text-\\[var\\(--subtext-0\\)\\]", null, 4, [["color", "var(--subtext-0)"]]], [".text-\\[var\\(--text\\)\\]", null, 4, [["color", "var(--text)"]]], [".text-accent", null, 4, [["color", "var(--accent)"]]], [".text-blue", null, 4, [["color", "var(--blue)"]]], [".text-current", null, 4, [["color", "currentColor"]]], [".text-fg", null, 4, [["color", "var(--text)"]]], [".text-green", null, 4, [["color", "var(--green)"]]], [".text-inherit", null, 4, [["color", "inherit"]]], [".text-mauve", null, 4, [["color", "var(--mauve)"]]], [".text-overlay-0", null, 4, [["color", "var(--overlay-0)"]]], [".text-overlay-1", null, 4, [["color", "var(--overlay-1)"]]], [".text-panel-bg", null, 4, [["color", "var(--panel-bg)"]]], [".text-peach", null, 4, [["color", "var(--peach)"]]], [".text-red", null, 4, [["color", "var(--red)"]]], [".text-red\\!", null, 4, [["color", "var(--red)", 1]]], [".text-subtext-0", null, 4, [["color", "var(--subtext-0)"]]], [".text-yellow", null, 4, [["color", "var(--yellow)"]]], [".capitalize", null, 4, [["text-transform", "capitalize"]]], [".normal-case", null, 4, [["text-transform", "none"]]], [".uppercase", null, 4, [["text-transform", "uppercase"]]], [".italic", null, 4, [["font-style", "italic"]]], [".not-italic", null, 4, [["font-style", "normal"]]], [".tabular-nums", null, 4, [["--tw-numeric-spacing", "tabular-nums"], ["font-variant-numeric", "var(--tw-ordinal, ) var(--tw-slashed-zero, ) var(--tw-numeric-figure, ) var(--tw-numeric-spacing, ) var(--tw-numeric-fraction, )"]]], [".line-through", null, 4, [["text-decoration-line", "line-through"]]], [".no-underline", null, 4, [["text-decoration-line", "none"]]], [".underline", null, 4, [["text-decoration-line", "underline"]]], [".opacity-0", null, 4, [["opacity", "0"]]], [".opacity-40", null, 4, [["opacity", ".4"]]], [".opacity-60", null, 4, [["opacity", ".6"]]], [".opacity-70", null, 4, [["opacity", ".7"]]], [".opacity-75", null, 4, [["opacity", ".75"]]], [".opacity-80", null, 4, [["opacity", ".8"]]], [".opacity-100", null, 4, [["opacity", "1"]]], [".opacity-\\[0\\.72\\]", null, 4, [["opacity", ".72"]]], [".shadow", null, 4, [["--tw-shadow", "0 1px 3px 0 var(--tw-shadow-color, #0000001a), 0 1px 2px -1px var(--tw-shadow-color, #0000001a)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_1px_4px_rgba\\(0\\,0\\,0\\,0\\.4\\)\\]", null, 4, [["--tw-shadow", "0 1px 4px var(--tw-shadow-color, #0006)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_2px_8px_rgba\\(0\\,0\\,0\\,0\\.4\\)\\]", null, 4, [["--tw-shadow", "0 2px 8px var(--tw-shadow-color, #0006)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_2px_8px_rgba\\(0\\,0\\,0\\,0\\.35\\)\\]", null, 4, [["--tw-shadow", "0 2px 8px var(--tw-shadow-color, #00000059)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_6px_20px_rgba\\(0\\,0\\,0\\,0\\.3\\)\\]", null, 4, [["--tw-shadow", "0 6px 20px var(--tw-shadow-color, #0000004d)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_8px_24px_rgba\\(0\\,0\\,0\\,0\\.35\\)\\]", null, 4, [["--tw-shadow", "0 8px 24px var(--tw-shadow-color, #00000059)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_8px_24px_rgba\\(0\\,0\\,0\\,0\\.45\\)\\]", null, 4, [["--tw-shadow", "0 8px 24px var(--tw-shadow-color, #00000073)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_8px_32px_rgba\\(0\\,0\\,0\\,0\\.5\\)\\]", null, 4, [["--tw-shadow", "0 8px 32px var(--tw-shadow-color, #00000080)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_12px_32px_rgba\\(0\\,0\\,0\\,0\\.5\\)\\]", null, 4, [["--tw-shadow", "0 12px 32px var(--tw-shadow-color, #00000080)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_16px_48px_rgba\\(0\\,0\\,0\\,0\\.55\\)\\]", null, 4, [["--tw-shadow", "0 16px 48px var(--tw-shadow-color, #0000008c)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[inset_0_0_24px_var\\(--accent\\)\\]", null, 4, [["--tw-shadow", "inset 0 0 24px var(--tw-shadow-color, var(--accent))"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-lg", null, 4, [["--tw-shadow", "0 10px 15px -3px var(--tw-shadow-color, #0000001a), 0 4px 6px -4px var(--tw-shadow-color, #0000001a)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".ring", null, 4, [["--tw-ring-shadow", "var(--tw-ring-inset, ) 0 0 0 calc(1px + var(--tw-ring-offset-width)) var(--tw-ring-color, currentcolor)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".\\[box-shadow\\:0_1px_2px_rgba\\(0\\,0\\,0\\,0\\.3\\)\\]", null, 4, [["box-shadow", "0 1px 2px #0000004d"]]], [".\\[box-shadow\\:0_4px_14px_rgba\\(0\\,0\\,0\\,0\\.35\\)\\]", null, 4, [["box-shadow", "0 4px 14px #00000059"]]], [".\\[box-shadow\\:none\\]", null, 4, [["box-shadow", "none"]]], [".\\[outline\\:none\\]", null, 4, [["outline", "none"]]], [".outline, .outline-1", null, 4, [["outline-style", "var(--tw-outline-style)"], ["outline-width", "1px"]]], [".outline-2", null, 4, [["outline-style", "var(--tw-outline-style)"], ["outline-width", "2px"]]], [".outline-accent", null, 4, [["outline-color", "var(--accent)"]]], [".blur", null, 4, [["--tw-blur", "blur(8px)"], ["filter", "var(--tw-blur, ) var(--tw-brightness, ) var(--tw-contrast, ) var(--tw-grayscale, ) var(--tw-hue-rotate, ) var(--tw-invert, ) var(--tw-saturate, ) var(--tw-sepia, ) var(--tw-drop-shadow, )"]]], [".\\!filter", null, 4, [["filter", "var(--tw-blur, ) var(--tw-brightness, ) var(--tw-contrast, ) var(--tw-grayscale, ) var(--tw-hue-rotate, ) var(--tw-invert, ) var(--tw-saturate, ) var(--tw-sepia, ) var(--tw-drop-shadow, )", 1]]], [".\\[filter\\:drop-shadow\\(0_6px_10px_rgba\\(0\\,0\\,0\\,0\\.45\\)\\)\\]", null, 4, [["filter", "drop-shadow(0 6px 10px #00000073)"]]], [".filter", null, 4, [["filter", "var(--tw-blur, ) var(--tw-brightness, ) var(--tw-contrast, ) var(--tw-grayscale, ) var(--tw-hue-rotate, ) var(--tw-invert, ) var(--tw-saturate, ) var(--tw-sepia, ) var(--tw-drop-shadow, )"]]], [".backdrop-blur-xl", null, 4, [["--tw-backdrop-blur", "blur(var(--blur-xl))"], ["-webkit-backdrop-filter", "var(--tw-backdrop-blur, ) var(--tw-backdrop-brightness, ) var(--tw-backdrop-contrast, ) var(--tw-backdrop-grayscale, ) var(--tw-backdrop-hue-rotate, ) var(--tw-backdrop-invert, ) var(--tw-backdrop-opacity, ) var(--tw-backdrop-saturate, ) var(--tw-backdrop-sepia, )"], ["backdrop-filter", "var(--tw-backdrop-blur, ) var(--tw-backdrop-brightness, ) var(--tw-backdrop-contrast, ) var(--tw-backdrop-grayscale, ) var(--tw-backdrop-hue-rotate, ) var(--tw-backdrop-invert, ) var(--tw-backdrop-opacity, ) var(--tw-backdrop-saturate, ) var(--tw-backdrop-sepia, )"]]], [".backdrop-saturate-150", null, 4, [["--tw-backdrop-saturate", "saturate(150%)"], ["-webkit-backdrop-filter", "var(--tw-backdrop-blur, ) var(--tw-backdrop-brightness, ) var(--tw-backdrop-contrast, ) var(--tw-backdrop-grayscale, ) var(--tw-backdrop-hue-rotate, ) var(--tw-backdrop-invert, ) var(--tw-backdrop-opacity, ) var(--tw-backdrop-saturate, ) var(--tw-backdrop-sepia, )"], ["backdrop-filter", "var(--tw-backdrop-blur, ) var(--tw-backdrop-brightness, ) var(--tw-backdrop-contrast, ) var(--tw-backdrop-grayscale, ) var(--tw-backdrop-hue-rotate, ) var(--tw-backdrop-invert, ) var(--tw-backdrop-opacity, ) var(--tw-backdrop-saturate, ) var(--tw-backdrop-sepia, )"]]], [".transition", null, 4, [["transition-property", "color, background-color, border-color, outline-color, text-decoration-color, fill, stroke, --tw-gradient-from, --tw-gradient-via, --tw-gradient-to, opacity, box-shadow, transform, translate, scale, rotate, filter, -webkit-backdrop-filter, backdrop-filter, display, content-visibility, overlay, pointer-events"], ["transition-timing-function", "var(--tw-ease, var(--default-transition-timing-function))"], ["transition-duration", "var(--tw-duration, var(--default-transition-duration))"]]], [".transition-\\[left\\,top\\,width\\,height\\]", null, 4, [["transition-property", "left, top, width, height"], ["transition-timing-function", "var(--tw-ease, var(--default-transition-timing-function))"], ["transition-duration", "var(--tw-duration, var(--default-transition-duration))"]]], [".transition-opacity", null, 4, [["transition-property", "opacity"], ["transition-timing-function", "var(--tw-ease, var(--default-transition-timing-function))"], ["transition-duration", "var(--tw-duration, var(--default-transition-duration))"]]], [".duration-150", null, 4, [["--tw-duration", ".15s"], ["transition-duration", ".15s"]]], [".ease-out", null, 4, [["--tw-ease", "var(--ease-out)"], ["transition-timing-function", "var(--ease-out)"]]], [".outline-none", null, 4, [["--tw-outline-style", "none"], ["outline-style", "none"]]], [".outline-solid", null, 4, [["--tw-outline-style", "solid"], ["outline-style", "solid"]]], [".select-none", null, 4, [["-webkit-user-select", "none"], ["user-select", "none"]]], [".select-text", null, 4, [["-webkit-user-select", "text"], ["user-select", "text"]]], [".\\[--panel-bg\\:var\\(--surface-dim\\)\\]", null, 4, [["--panel-bg", "var(--surface-dim)"]]], [".\\[--picker-bg\\:var\\(--surface-0\\)\\]", null, 4, [["--picker-bg", "var(--surface-0)"]]], [".\\[--radius\\:var\\(--radius-pane\\)\\]", null, 4, [["--radius", "var(--radius-pane)"]]], [".\\[--workspace-tools-bg\\:transparent\\]", null, 4, [["--workspace-tools-bg", "transparent"]]], [".\\[-webkit-box-orient\\:vertical\\]", null, 4, [["-webkit-box-orient", "vertical"]]], [".\\[-webkit-line-clamp\\:3\\]", null, 4, [["-webkit-line-clamp", "3"]]], [".\\[-webkit-touch-callout\\:none\\]", null, 4, [["-webkit-touch-callout", "none"]]], [".\\[background\\:none\\]", null, 4, [["background", "none"]]], [".\\[border-left\\:1px_solid_var\\(--git-border\\)\\]", null, 4, [["border-left", "1px solid var(--git-border)"]]], [".\\[border-top\\:1px_solid_var\\(--git-border\\)\\]", null, 4, [["border-top", "1px solid var(--git-border)"]]], [".\\[border\\:0\\]", null, 4, [["border", "0"]]], [".\\[border\\:none\\]", null, 4, [["border", "none"]]], [".\\[font\\:1\\.15rem\\/1_var\\(--font-mono\\)\\]", null, 4, [["font", "1.15rem/1 var(--font-mono)"]]], [".\\[font\\:1rem\\/1\\.2_var\\(--font-mono\\)\\]", null, 4, [["font", "1rem/1.2 var(--font-mono)"]]], [".\\[font\\:inherit\\]", null, 4, [["font", "inherit"]]], [".\\[transition\\:background_0\\.1s_ease\\]", null, 4, [["transition", "background .1s"]]], [".\\[transition\\:background_0\\.12s_ease\\]", null, 4, [["transition", "background .12s"]]], [".\\[transition\\:background_0\\.15s_ease\\]", null, 4, [["transition", "background .15s"]]], [".\\[transition\\:color_0\\.1s_ease\\,background_0\\.1s_ease\\]", null, 4, [["transition", "color .1s, background .1s"]]], [".\\[transition\\:color_0\\.12s_ease\\,background_0\\.12s_ease\\]", null, 4, [["transition", "color .12s, background .12s"]]], [".\\[transition\\:color_0\\.15s_ease\\]", null, 4, [["transition", "color .15s"]]], [".\\[transition\\:opacity_0\\.12s_ease\\]", null, 4, [["transition", "opacity .12s"]]], [".\\[transition\\:transform_0\\.15s_ease\\,background_0\\.15s_ease\\]", null, 4, [["transition", "transform .15s, background .15s"]]], [".not-has-\\[\\[data-setting-row\\]\\]\\:hidden:not(:has([data-setting-row]))", null, 4, [["display", "none"]]], [".group-focus-within\\:flex:is(:where(.group):focus-within *)", null, 4, [["display", "flex"]]], [".group-focus-within\\/row\\:opacity-100:is(:where(.group\\/row):focus-within *)", null, 4, [["opacity", "1"]]], [".group-hover\\:flex:is(:where(.group):hover *)", null, 4, [["display", "flex"]]], [".group-hover\\:opacity-100:is(:where(.group):hover *)", null, 4, [["opacity", "1"]]], [".group-hover\\/line\\:opacity-90:is(:where(.group\\/line):hover *)", null, 4, [["opacity", ".9"]]], [".group-hover\\/ph\\:opacity-100:is(:where(.group\\/ph):hover *), .group-hover\\/row\\:opacity-100:is(:where(.group\\/row):hover *)", null, 4, [["opacity", "1"]]], [".group-hover\\/submenu\\:block:is(:where(.group\\/submenu):hover *)", null, 4, [["display", "block"]]], [".group-focus\\/tree\\:ring-1:is(:where(.group\\/tree):focus *)", null, 4, [["--tw-ring-shadow", "var(--tw-ring-inset, ) 0 0 0 calc(1px + var(--tw-ring-offset-width)) var(--tw-ring-color, currentcolor)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".group-focus\\/tree\\:ring-overlay-1:is(:where(.group\\/tree):focus *)", null, 4, [["--tw-ring-color", "var(--overlay-1)"]]], [".group-focus\\/tree\\:ring-inset:is(:where(.group\\/tree):focus *)", null, 4, [["--tw-ring-inset", "inset"]]], ['.group-aria-checked\\:\\[transform\\:translateX\\(1\\.1rem\\)\\]:is(:where(.group)[aria-checked="true"] *)', null, 4, [["transform", "translateX(1.1rem)"]]], ['.group-aria-checked\\:border-accent:is(:where(.group)[aria-checked="true"] *)', null, 4, [["border-color", "var(--accent)"]]], ['.group-aria-checked\\:bg-accent:is(:where(.group)[aria-checked="true"] *)', null, 4, [["background-color", "var(--accent)"]]], ['.group-aria-checked\\:bg-panel-bg:is(:where(.group)[aria-checked="true"] *)', null, 4, [["background-color", "var(--panel-bg)"]]], ['.group-aria-checked\\:text-accent:is(:where(.group)[aria-checked="true"] *), .group-aria-\\[checked\\=false\\]\\:text-accent:is(:where(.group)[aria-checked="false"] *)', null, 4, [["color", "var(--accent)"]]], [".placeholder\\:text-subtext-0::placeholder", null, 4, [["color", "var(--subtext-0)"]]], [".before\\:absolute:before", null, 4, [["content", "var(--tw-content)"], ["position", "absolute"]]], [".before\\:top-\\[0\\.15rem\\]:before", null, 4, [["content", "var(--tw-content)"], ["top", ".15rem"]]], [".before\\:left-\\[0\\.15rem\\]:before", null, 4, [["content", "var(--tw-content)"], ["left", ".15rem"]]], [".before\\:h-\\[0\\.95rem\\]:before", null, 4, [["content", "var(--tw-content)"], ["height", ".95rem"]]], [".before\\:w-\\[0\\.95rem\\]:before", null, 4, [["content", "var(--tw-content)"], ["width", ".95rem"]]], [".before\\:rounded-full:before", null, 4, [["content", "var(--tw-content)"], ["border-radius", "3.40282e38px"]]], [".before\\:bg-fg:before", null, 4, [["content", "var(--tw-content)"], ["background-color", "var(--text)"]]], [".before\\:content-\\[\\'\\'\\]:before", null, 4, [["--tw-content", '""'], ["content", "var(--tw-content)"]]], [".before\\:\\[transition\\:transform_0\\.12s_ease\\]:before", null, 4, [["content", "var(--tw-content)"], ["transition", "transform .12s"]]], [".after\\:absolute:after", null, 4, [["content", "var(--tw-content)"], ["position", "absolute"]]], [".after\\:inset-0:after", null, 4, [["content", "var(--tw-content)"], ["inset", "0"]]], [".after\\:inset-x-0:after", null, 4, [["content", "var(--tw-content)"], ["inset-inline", "0"]]], [".after\\:-inset-y-2:after", null, 4, [["content", "var(--tw-content)"], ["inset-block", "calc(var(--spacing) * -2)"]]], [".after\\:m-auto:after", null, 4, [["content", "var(--tw-content)"], ["margin", "auto"]]], [".after\\:h-8:after", null, 4, [["content", "var(--tw-content)"], ["height", "calc(var(--spacing) * 8)"]]], [".after\\:h-12:after", null, 4, [["content", "var(--tw-content)"], ["height", "calc(var(--spacing) * 12)"]]], [".after\\:h-\\[3px\\]:after", null, 4, [["content", "var(--tw-content)"], ["height", "3px"]]], [".after\\:w-8:after", null, 4, [["content", "var(--tw-content)"], ["width", "calc(var(--spacing) * 8)"]]], [".after\\:w-\\[3px\\]:after", null, 4, [["content", "var(--tw-content)"], ["width", "3px"]]], [".after\\:rounded-full:after", null, 4, [["content", "var(--tw-content)"], ["border-radius", "3.40282e38px"]]], [".after\\:bg-transparent:after", null, 4, [["content", "var(--tw-content)"], ["background-color", "#0000"]]], [".after\\:content-\\[\\'\\'\\]:after", null, 4, [["--tw-content", '""'], ["content", "var(--tw-content)"]]], [".last\\:border-b-0:last-child", null, 4, [["border-bottom-style", "var(--tw-border-style)"], ["border-bottom-width", "0"]]], [".checked\\:bg-accent:checked", null, 4, [["background-color", "var(--accent)"]]], [".checked\\:before\\:translate-x-\\[1rem\\]:checked:before", null, 4, [["content", "var(--tw-content)"], ["--tw-translate-x", "1rem"], ["translate", "var(--tw-translate-x) var(--tw-translate-y)"]]], [".checked\\:before\\:bg-panel-bg:checked:before", null, 4, [["content", "var(--tw-content)"], ["background-color", "var(--panel-bg)"]]], [".focus-within\\:bg-surface-1:focus-within", null, 4, [["background-color", "var(--surface-1)"]]], [".focus-within\\:outline:focus-within, .focus-within\\:outline-1:focus-within", null, 4, [["outline-style", "var(--tw-outline-style)"], ["outline-width", "1px"]]], [".focus-within\\:outline-fg:focus-within", null, 4, [["outline-color", "var(--text)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_12\\%\\,transparent\\)\\]:hover", null, 4, [["background-color", "var(--accent)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_12\\%\\,transparent\\)\\]:hover", null, 4, [["background-color", "color-mix(in srgb,var(--accent) 12%,transparent)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_15\\%\\,transparent\\)\\]:hover", null, 4, [["background-color", "var(--accent)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_15\\%\\,transparent\\)\\]:hover", null, 4, [["background-color", "color-mix(in srgb,var(--accent) 15%,transparent)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--text\\)_10\\%\\,var\\(--panel-bg\\)\\)\\]:hover", null, 4, [["background-color", "var(--text)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--text\\)_10\\%\\,var\\(--panel-bg\\)\\)\\]:hover", null, 4, [["background-color", "color-mix(in srgb,var(--text) 10%,var(--panel-bg))"]]], [".hover\\:bg-\\[var\\(--surface-0\\)\\]:hover", null, 4, [["background-color", "var(--surface-0)"]]], [".hover\\:bg-accent:hover", null, 4, [["background-color", "var(--accent)"]]], [".hover\\:bg-overlay-0:hover", null, 4, [["background-color", "var(--overlay-0)"]]], [".hover\\:bg-panel-bg:hover", null, 4, [["background-color", "var(--panel-bg)"]]], [".hover\\:bg-surface-0:hover", null, 4, [["background-color", "var(--surface-0)"]]], [".hover\\:bg-surface-1:hover", null, 4, [["background-color", "var(--surface-1)"]]], [".hover\\:bg-transparent:hover", null, 4, [["background-color", "#0000"]]], [".hover\\:text-accent:hover", null, 4, [["color", "var(--accent)"]]], [".hover\\:text-fg:hover", null, 4, [["color", "var(--text)"]]], [".hover\\:text-inherit:hover", null, 4, [["color", "inherit"]]], [".hover\\:text-overlay-0:hover", null, 4, [["color", "var(--overlay-0)"]]], [".hover\\:text-panel-bg:hover", null, 4, [["color", "var(--panel-bg)"]]], [".hover\\:text-red:hover", null, 4, [["color", "var(--red)"]]], [".hover\\:text-subtext-0:hover", null, 4, [["color", "var(--subtext-0)"]]], [".hover\\:text-yellow:hover", null, 4, [["color", "var(--yellow)"]]], [".hover\\:underline:hover", null, 4, [["text-decoration-line", "underline"]]], [".hover\\:opacity-60:hover", null, 4, [["opacity", ".6"]]], [".hover\\:opacity-100\\!:hover", null, 4, [["opacity", "1", 1]]], [".hover\\:opacity-\\[0\\.85\\]:hover", null, 4, [["opacity", ".85"]]], [".hover\\:brightness-110:hover", null, 4, [["--tw-brightness", "brightness(110%)"], ["filter", "var(--tw-blur, ) var(--tw-brightness, ) var(--tw-contrast, ) var(--tw-grayscale, ) var(--tw-hue-rotate, ) var(--tw-invert, ) var(--tw-saturate, ) var(--tw-sepia, ) var(--tw-drop-shadow, )"]]], [".hover\\:\\[filter\\:brightness\\(1\\.08\\)\\]:hover", null, 4, [["filter", "brightness(1.08)"]]], [".hover\\:after\\:bg-overlay-1:hover:after", null, 4, [["content", "var(--tw-content)"], ["background-color", "var(--overlay-1)"]]], [".focus\\:\\[outline\\:1px_solid_var\\(--accent\\)\\]:focus", null, 4, [["outline", "1px solid var(--accent)"]]], [".focus\\:outline-2:focus", null, 4, [["outline-style", "var(--tw-outline-style)"], ["outline-width", "2px"]]], [".focus\\:outline-none:focus", null, 4, [["--tw-outline-style", "none"], ["outline-style", "none"]]], [".focus-visible\\:bg-accent:focus-visible", null, 4, [["background-color", "var(--accent)"]]], [".focus-visible\\:bg-surface-0:focus-visible", null, 4, [["background-color", "var(--surface-0)"]]], [".focus-visible\\:bg-surface-1:focus-visible", null, 4, [["background-color", "var(--surface-1)"]]], [".focus-visible\\:text-accent:focus-visible", null, 4, [["color", "var(--accent)"]]], [".focus-visible\\:text-fg:focus-visible", null, 4, [["color", "var(--text)"]]], [".focus-visible\\:text-panel-bg:focus-visible", null, 4, [["color", "var(--panel-bg)"]]], [".focus-visible\\:text-red:focus-visible", null, 4, [["color", "var(--red)"]]], [".focus-visible\\:text-yellow:focus-visible", null, 4, [["color", "var(--yellow)"]]], [".focus-visible\\:underline:focus-visible", null, 4, [["text-decoration-line", "underline"]]], [".focus-visible\\:opacity-100:focus-visible", null, 4, [["opacity", "1"]]], [".focus-visible\\:\\[outline\\:1px_solid_var\\(--accent\\)\\]:focus-visible", null, 4, [["outline", "1px solid var(--accent)"]]], [".focus-visible\\:\\[outline\\:1px_solid_var\\(--overlay-1\\)\\]:focus-visible", null, 4, [["outline", "1px solid var(--overlay-1)"]]], [".focus-visible\\:\\[outline\\:2px_solid_var\\(--accent\\)\\]:focus-visible", null, 4, [["outline", "2px solid var(--accent)"]]], [".focus-visible\\:outline:focus-visible, .focus-visible\\:outline-1:focus-visible", null, 4, [["outline-style", "var(--tw-outline-style)"], ["outline-width", "1px"]]], [".focus-visible\\:\\[outline-offset\\:-1px\\]:focus-visible", null, 4, [["outline-offset", "-1px"]]], [".focus-visible\\:\\[outline-offset\\:-2px\\]:focus-visible", null, 4, [["outline-offset", "-2px"]]], [".focus-visible\\:\\[outline-offset\\:2px\\]:focus-visible", null, 4, [["outline-offset", "2px"]]], [".focus-visible\\:outline-offset-1:focus-visible", null, 4, [["outline-offset", "1px"]]], [".focus-visible\\:outline-fg:focus-visible", null, 4, [["outline-color", "var(--text)"]]], [".focus-visible\\:after\\:bg-accent:focus-visible:after", null, 4, [["content", "var(--tw-content)"], ["background-color", "var(--accent)"]]], [".active\\:cursor-grabbing:active", null, 4, [["cursor", "grabbing"]]], [".active\\:bg-surface-1:active", null, 4, [["background-color", "var(--surface-1)"]]], [".active\\:text-fg:active", null, 4, [["color", "var(--text)"]]], [".active\\:after\\:bg-accent:active:after", null, 4, [["content", "var(--tw-content)"], ["background-color", "var(--accent)"]]], [".enabled\\:hover\\:bg-surface-1:enabled:hover", null, 4, [["background-color", "var(--surface-1)"]]], [".enabled\\:hover\\:text-fg:enabled:hover", null, 4, [["color", "var(--text)"]]], [".disabled\\:cursor-default:disabled", null, 4, [["cursor", "default"]]], [".disabled\\:cursor-not-allowed:disabled", null, 4, [["cursor", "not-allowed"]]], [".disabled\\:cursor-not-allowed\\!:disabled", null, 4, [["cursor", "not-allowed", 1]]], [".disabled\\:cursor-wait:disabled", null, 4, [["cursor", "wait"]]], [".disabled\\:bg-transparent:disabled", null, 4, [["background-color", "#0000"]]], [".disabled\\:text-fg:disabled", null, 4, [["color", "var(--text)"]]], [".disabled\\:opacity-40:disabled", null, 4, [["opacity", ".4"]]], [".disabled\\:opacity-50:disabled", null, 4, [["opacity", ".5"]]], [".disabled\\:opacity-\\[0\\.45\\]:disabled", null, 4, [["opacity", ".45"]]], [".disabled\\:opacity-\\[0\\.55\\]:disabled", null, 4, [["opacity", ".55"]]], [":where(.app--mac-desktop) .in-\\[\\.app--mac-desktop\\]\\:pl-\\[84px\\]", null, 4, [["padding-left", "84px"]]], [".has-\\[\\:checked\\]\\:bg-surface-0:has(:checked)", null, 4, [["background-color", "var(--surface-0)"]]], [".has-\\[\\:checked\\]\\:text-fg:has(:checked)", null, 4, [["color", "var(--text)"]]], [".has-\\[\\:focus-visible\\]\\:bg-surface-0:has(:focus-visible)", null, 4, [["background-color", "var(--surface-0)"]]], ['.aria-disabled\\:cursor-not-allowed[aria-disabled="true"]', null, 4, [["cursor", "not-allowed"]]], ['.aria-disabled\\:opacity-40[aria-disabled="true"]', null, 4, [["opacity", ".4"]]], ['.aria-expanded\\:opacity-100[aria-expanded="true"]', null, 4, [["opacity", "1"]]], ['.aria-pressed\\:bg-surface-0[aria-pressed="true"]', null, 4, [["background-color", "var(--surface-0)"]]], ['.aria-pressed\\:text-fg[aria-pressed="true"]', null, 4, [["color", "var(--text)"]]], [".motion-reduce\\:animate-none", ["(prefers-reduced-motion: reduce)"], 4, [["animation", "none"]]], [".max-\\[900px\\]\\:hidden", ["not all and (min-width: 900px)"], 4, [["display", "none"]]], [".max-\\[700px\\]\\:hidden", ["not all and (min-width: 700px)"], 4, [["display", "none"]]], [".max-\\[700px\\]\\:size-11", ["not all and (min-width: 700px)"], 4, [["width", "calc(var(--spacing) * 11)"], ["height", "calc(var(--spacing) * 11)"]]], [".max-\\[700px\\]\\:h-9", ["not all and (min-width: 700px)"], 4, [["height", "calc(var(--spacing) * 9)"]]], [".max-\\[700px\\]\\:h-12", ["not all and (min-width: 700px)"], 4, [["height", "calc(var(--spacing) * 12)"]]], [".max-\\[700px\\]\\:min-h-9", ["not all and (min-width: 700px)"], 4, [["min-height", "calc(var(--spacing) * 9)"]]], [".max-\\[700px\\]\\:min-h-11", ["not all and (min-width: 700px)"], 4, [["min-height", "calc(var(--spacing) * 11)"]]], [".max-\\[700px\\]\\:w-24", ["not all and (min-width: 700px)"], 4, [["width", "calc(var(--spacing) * 24)"]]], [".max-\\[700px\\]\\:min-w-11", ["not all and (min-width: 700px)"], 4, [["min-width", "calc(var(--spacing) * 11)"]]], [".max-\\[700px\\]\\:flex-1", ["not all and (min-width: 700px)"], 4, [["flex", "1"]]], [".max-\\[700px\\]\\:flex-\\[1_1_6rem\\]", ["not all and (min-width: 700px)"], 4, [["flex", "6rem"]]], [".max-\\[700px\\]\\:flex-\\[1_1_100\\%\\]", ["not all and (min-width: 700px)"], 4, [["flex", "100%"]]], [".max-\\[700px\\]\\:basis-56", ["not all and (min-width: 700px)"], 4, [["flex-basis", "calc(var(--spacing) * 56)"]]], [".max-\\[700px\\]\\:basis-full", ["not all and (min-width: 700px)"], 4, [["flex-basis", "100%"]]], [".max-\\[700px\\]\\:flex-wrap", ["not all and (min-width: 700px)"], 4, [["flex-wrap", "wrap"]]], [".max-\\[700px\\]\\:gap-y-2", ["not all and (min-width: 700px)"], 4, [["row-gap", "calc(var(--spacing) * 2)"]]], [".min-\\[701px\\]\\:left-auto", ["(min-width: 701px)"], 4, [["left", "auto"]]], [".min-\\[701px\\]\\:my-\\[3px\\]", ["(min-width: 701px)"], 4, [["margin-block", "3px"]]], [".min-\\[701px\\]\\:block", ["(min-width: 701px)"], 4, [["display", "block"]]], [".min-\\[701px\\]\\:hidden", ["(min-width: 701px)"], 4, [["display", "none"]]], [".min-\\[701px\\]\\:min-h-6", ["(min-width: 701px)"], 4, [["min-height", "calc(var(--spacing) * 6)"]]], [".min-\\[701px\\]\\:w-80", ["(min-width: 701px)"], 4, [["width", "calc(var(--spacing) * 80)"]]], [".min-\\[701px\\]\\:rounded-ui", ["(min-width: 701px)"], 4, [["border-radius", "var(--radius)"]]], [".min-\\[701px\\]\\:px-3", ["(min-width: 701px)"], 4, [["padding-inline", "calc(var(--spacing) * 3)"]]], [".min-\\[701px\\]\\:px-4", ["(min-width: 701px)"], 4, [["padding-inline", "calc(var(--spacing) * 4)"]]], [".min-\\[701px\\]\\:pr-\\[3px\\]", ["(min-width: 701px)"], 4, [["padding-right", "3px"]]], [".min-\\[701px\\]\\:pl-4", ["(min-width: 701px)"], 4, [["padding-left", "calc(var(--spacing) * 4)"]]], [".min-\\[701px\\]\\:text-\\[0\\.62rem\\]", ["(min-width: 701px)"], 4, [["font-size", ".62rem"]]], [".min-\\[701px\\]\\:text-\\[12\\.5px\\]", ["(min-width: 701px)"], 4, [["font-size", "12.5px"]]], [".min-\\[701px\\]\\:text-\\[12px\\]", ["(min-width: 701px)"], 4, [["font-size", "12px"]]], [".min-\\[701px\\]\\:font-medium", ["(min-width: 701px)"], 4, [["--tw-font-weight", "var(--font-weight-medium)"], ["font-weight", "var(--font-weight-medium)"]]], [".min-\\[701px\\]\\:font-semibold", ["(min-width: 701px)"], 4, [["--tw-font-weight", "var(--font-weight-semibold)"], ["font-weight", "var(--font-weight-semibold)"]]], [".min-\\[701px\\]\\:tracking-\\[0\\.045em\\]", ["(min-width: 701px)"], 4, [["--tw-tracking", ".045em"], ["letter-spacing", ".045em"]]], [".min-\\[701px\\]\\:text-subtext-0", ["(min-width: 701px)"], 4, [["color", "var(--subtext-0)"]]], [".min-\\[701px\\]\\:uppercase", ["(min-width: 701px)"], 4, [["text-transform", "uppercase"]]], [".min-\\[900px\\]\\:inline", ["(min-width: 900px)"], 4, [["display", "inline"]]], [".\\@max-\\[460px\\]\\:mx-1", ["not (min-width: 460px)"], 4, [["margin-inline", "var(--spacing)"]]], [".\\@max-\\[460px\\]\\:hidden", ["not (min-width: 460px)"], 4, [["display", "none"]]], [".\\@min-\\[461px\\]\\:flex", ["(min-width: 461px)"], 4, [["display", "flex"]]], [".pointer-coarse\\:opacity-100", ["(pointer: coarse)"], 4, [["opacity", "1"]]], [".\\[\\&_\\.mode-switch\\]\\:ml-0 .mode-switch", null, 4, [["margin-left", "0"]]], [".max-\\[700px\\]\\:\\[\\&_button\\]\\:min-h-11 button", ["not all and (min-width: 700px)"], 4, [["min-height", "calc(var(--spacing) * 11)"]]], [".\\[\\&_pre\\]\\:m-\\[0\\.2rem_0_0\\.3rem_1\\.2rem\\] pre", null, 4, [["margin", ".2rem 0 .3rem 1.2rem"]]], [".\\[\\&_pre\\]\\:max-h-72 pre", null, 4, [["max-height", "calc(var(--spacing) * 72)"]]], [".\\[\\&_pre\\]\\:overflow-auto pre", null, 4, [["overflow", "auto"]]], [".\\[\\&_pre\\]\\:rounded-ui pre", null, 4, [["border-radius", "var(--radius)"]]], [".\\[\\&_pre\\]\\:bg-surface-0 pre", null, 4, [["background-color", "var(--surface-0)"]]], [".\\[\\&_pre\\]\\:p-2 pre", null, 4, [["padding", "calc(var(--spacing) * 2)"]]], [".\\[\\&_pre\\]\\:text-\\[0\\.78rem\\] pre", null, 4, [["font-size", ".78rem"]]], [".\\[\\&_pre\\]\\:\\[overflow-wrap\\:anywhere\\] pre", null, 4, [["overflow-wrap", "anywhere"]]], [".\\[\\&_pre\\]\\:whitespace-pre-wrap pre", null, 4, [["white-space", "pre-wrap"]]], [".\\[\\&_pre\\]\\:text-fg pre, .\\[\\&_strong\\]\\:text-fg strong", null, 4, [["color", "var(--text)"]]], [".\\[\\&_summary\\]\\:cursor-pointer summary", null, 4, [["cursor", "pointer"]]], [".\\[\\&\\:hover\\:not\\(\\:disabled\\)\\]\\:bg-surface-1:hover:not(:disabled)", null, 4, [["background-color", "var(--surface-1)"]]], [".\\[\\&\\:hover\\:not\\(\\:disabled\\)\\]\\:text-accent:hover:not(:disabled)", null, 4, [["color", "var(--accent)"]]], [".\\[\\&\\:hover\\:not\\(\\:disabled\\)\\]\\:text-fg:hover:not(:disabled)", null, 4, [["color", "var(--text)"]]], [".\\[\\&\\:hover\\:not\\(\\:disabled\\)\\]\\:text-red:hover:not(:disabled)", null, 4, [["color", "var(--red)"]]], [".\\[\\&\\:not\\(\\:has\\(\\[data-setting-row\\]\\)\\)\\>\\[data-none\\]\\]\\:block:not(:has([data-setting-row])) > [data-none]", null, 4, [["display", "block"]]], [".\\[\\&\\>\\*\\]\\:min-h-0 > *", null, 4, [["min-height", "0"]]], [".\\[\\&\\>\\*\\]\\:min-w-0 > *", null, 4, [["min-width", "0"]]], [".\\[\\&\\>\\*\\]\\:flex-1 > *", null, 4, [["flex", "1"]]], [".\\[\\&\\>\\*\\]\\:shrink-0 > *", null, 4, [["flex-shrink", "0"]]], [".\\[\\&\\>li\\]\\:text-\\[0\\.85rem\\] > li", null, 4, [["font-size", ".85rem"]]], [".\\[\\&\\>li\\]\\:leading-\\[1\\.5\\] > li", null, 4, [["--tw-leading", "1.5"], ["line-height", "1.5"]]], [".\\[\\&\\>li\\]\\:text-fg > li", null, 4, [["color", "var(--text)"]]], [".\\[\\&\\>summary\\]\\:flex > summary", null, 4, [["display", "flex"]]], [".\\[\\&\\>summary\\]\\:cursor-pointer > summary", null, 4, [["cursor", "pointer"]]], [".\\[\\&\\>summary\\]\\:list-none > summary", null, 4, [["list-style-type", "none"]]], [".\\[\\&\\>summary\\]\\:items-center > summary", null, 4, [["align-items", "center"]]], [".\\[\\&\\>summary\\]\\:gap-\\[0\\.4rem\\] > summary", null, 4, [["gap", ".4rem"]]], [".\\[\\&\\>summary\\]\\:rounded-ui > summary", null, 4, [["border-radius", "var(--radius)"]]], [".\\[\\&\\>summary\\]\\:px-\\[0\\.4rem\\] > summary", null, 4, [["padding-inline", ".4rem"]]], [".\\[\\&\\>summary\\]\\:py-\\[0\\.25rem\\] > summary", null, 4, [["padding-block", ".25rem"]]], [".\\[\\&\\>summary\\]\\:select-none > summary", null, 4, [["-webkit-user-select", "none"], ["user-select", "none"]]], [".\\[\\&\\>summary\\]\\:before\\:inline-block > summary:before", null, 4, [["content", "var(--tw-content)"], ["display", "inline-block"]]], [".\\[\\&\\>summary\\]\\:before\\:size-\\[0\\.4rem\\] > summary:before", null, 4, [["content", "var(--tw-content)"], ["width", ".4rem"], ["height", ".4rem"]]], [".\\[\\&\\>summary\\]\\:before\\:shrink-0 > summary:before", null, 4, [["content", "var(--tw-content)"], ["flex-shrink", "0"]]], [".\\[\\&\\>summary\\]\\:before\\:\\[transform\\:rotate\\(-45deg\\)\\] > summary:before", null, 4, [["content", "var(--tw-content)"], ["transform", "rotate(-45deg)"]]], [".\\[\\&\\>summary\\]\\:before\\:content-\\[\\'\\'\\] > summary:before", null, 4, [["--tw-content", '""'], ["content", "var(--tw-content)"]]], [".\\[\\&\\>summary\\]\\:before\\:\\[border-bottom\\:1\\.3px_solid_currentColor\\] > summary:before", null, 4, [["content", "var(--tw-content)"], ["border-bottom", "1.3px solid"]]], [".\\[\\&\\>summary\\]\\:before\\:\\[border-right\\:1\\.3px_solid_currentColor\\] > summary:before", null, 4, [["content", "var(--tw-content)"], ["border-right", "1.3px solid"]]], [".\\[\\&\\>summary\\]\\:before\\:\\[transition\\:transform_0\\.15s_ease\\] > summary:before", null, 4, [["content", "var(--tw-content)"], ["transition", "transform .15s"]]], [".\\[\\&\\>summary\\:hover\\]\\:bg-surface-1 > summary:hover", null, 4, [["background-color", "var(--surface-1)"]]], [".\\[\\&\\>summary\\:hover\\]\\:text-fg > summary:hover", null, 4, [["color", "var(--text)"]]], [".\\[\\&\\[open\\]\\>summary\\]\\:before\\:\\[transform\\:rotate\\(45deg\\)\\][open] > summary:before", null, 4, [["content", "var(--tw-content)"], ["transform", "rotate(45deg)"]]], [".app--mobile .\\[\\.app--mobile_\\&\\]\\:min-h-11", null, 4, [["min-height", "calc(var(--spacing) * 11)"]]], [".app--mobile .\\[\\.app--mobile_\\&\\]\\:min-h-\\[44px\\]", null, 4, [["min-height", "44px"]]], [".\\[\\@container\\(max-width\\:460px\\)\\]\\:min-h-11", ["(max-width: 460px)"], 4, [["min-height", "calc(var(--spacing) * 11)"]]], [".\\[\\@container\\(max-width\\:460px\\)\\]\\:min-h-\\[2\\.5rem\\]", ["(max-width: 460px)"], 4, [["min-height", "2.5rem"]]], [".\\[\\@container\\(max-width\\:460px\\)\\]\\:max-w-full", ["(max-width: 460px)"], 4, [["max-width", "100%"]]], [".\\[\\@container\\(max-width\\:460px\\)\\]\\:min-w-0", ["(max-width: 460px)"], 4, [["min-width", "0"]]], [".\\[\\@container\\(max-width\\:460px\\)\\]\\:flex-\\[1_1_9rem\\]", ["(max-width: 460px)"], 4, [["flex", "9rem"]]], [".\\[\\@container\\(max-width\\:460px\\)\\]\\:flex-\\[1_1_100\\%\\]", ["(max-width: 460px)"], 4, [["flex", "100%"]]], [".\\[\\@container\\(max-width\\:460px\\)\\]\\:grid-cols-\\[1fr\\]", ["(max-width: 460px)"], 4, [["grid-template-columns", "1fr"]]], [".\\[\\@container\\(max-width\\:460px\\)\\]\\:flex-col", ["(max-width: 460px)"], 4, [["flex-direction", "column"]]], [".\\[\\@container\\(max-width\\:460px\\)\\]\\:flex-wrap", ["(max-width: 460px)"], 4, [["flex-wrap", "wrap"]]], [".\\[\\@container\\(max-width\\:460px\\)\\]\\:items-start", ["(max-width: 460px)"], 4, [["align-items", "flex-start"]]], [".\\[\\@container\\(max-width\\:460px\\)\\]\\:\\[border-right\\:none\\]", ["(max-width: 460px)"], 4, [["border-right", "none"]]], [".\\[\\@container\\(max-width\\:700px\\)\\]\\:ml-\\[5\\.2rem\\]", ["(max-width: 700px)"], 4, [["margin-left", "5.2rem"]]], [".\\[\\@container\\(max-width\\:700px\\)\\]\\:grid-cols-\\[2\\.1rem_2\\.1rem_0\\.8rem_minmax\\(0\\,1fr\\)\\]", ["(max-width: 700px)"], 4, [["grid-template-columns", "2.1rem 2.1rem .8rem minmax(0, 1fr)"]]], [".\\[\\@media\\(hover\\:none\\)\\]\\:opacity-60", ["(hover: none)"], 4, [["opacity", ".6"]]], [".\\[\\@media\\(hover\\:none\\)\\]\\:opacity-100", ["(hover: none)"], 4, [["opacity", "1"]]], [".\\[\\@media\\(max-width\\:700px\\)\\]\\:h-\\[2\\.75rem\\]", ["(max-width: 700px)"], 4, [["height", "2.75rem"]]], [".\\[\\@media\\(max-width\\:700px\\)\\]\\:min-h-\\[2\\.75rem\\]", ["(max-width: 700px)"], 4, [["min-height", "2.75rem"]]], [".\\[\\@media\\(max-width\\:700px\\)\\]\\:w-\\[2\\.75rem\\]", ["(max-width: 700px)"], 4, [["width", "2.75rem"]]], [".\\[\\@media\\(max-width\\:700px\\)\\]\\:min-w-\\[2\\.75rem\\]", ["(max-width: 700px)"], 4, [["min-width", "2.75rem"]]], [".\\[\\@media\\(max-width\\:700px\\)\\]\\:px-\\[0\\.65rem\\]", ["(max-width: 700px)"], 4, [["padding-inline", ".65rem"]]], ["div:hover > .\\[div\\:hover\\>\\&\\]\\:opacity-100", null, 4, [["opacity", "1"]]], [":root", null, 1e3, [["color-scheme", "dark"], ["--scrollbar-size", "6px"], ["--accent", "#c8c8c8"], ["--panel-bg", "#161616"], ["--surface-0", "#262626"], ["--surface-1", "#333"], ["--surface-dim", "#1c1c1c"], ["--backdrop", "#050505"], ["--overlay-0", "#3a3a3a"], ["--overlay-1", "#9b9b9b"], ["--text", "#d8d8d8"], ["--subtext-0", "#9b9b9b"], ["--mauve", "#a993c9"], ["--green", "#7fb685"], ["--yellow", "#d3b46a"], ["--red", "#df8c8c"], ["--blue", "#7aa2d7"], ["--teal", "#7fb8b8"], ["--peach", "#d39a6a"], ["--bg", "var(--panel-bg)"], ["--surface", "var(--surface-0)"], ["--surface-alt", "var(--surface-1)"], ["--border", "var(--overlay-0)"], ["--muted", "var(--subtext-0)"], ["--danger", "var(--red)"], ["--radius", "8px"], ["--radius-pane", "8px"], ["accent-color", "var(--accent)"], ["--font-ui", '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif'], ["--font-mono", `ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono",
    monospace`], ["font-family", "var(--font-ui)"]]], ["code, pre, kbd, samp", null, 1e3, [["font-family", "var(--font-mono)"]]], ["*", null, 1e3, [["box-sizing", "border-box"]]], ["html, body, #root", null, 1e3, [["height", "100%"], ["margin", "0"]]], ["html", null, 1e3, [["overscroll-behavior", "none"], ["--shell-bg", "var(--panel-bg)"]]], ["html[data-glass]", null, 1e3, [["--shell-bg", "var(--panel-bg)"]]], ["html[data-glass]", null, 1e3, [["--shell-bg", "color-mix(in srgb, var(--panel-bg) 86%, transparent)"]]], ["html", null, 1e3, [["--backdrop-bg", "var(--backdrop)"], ["--card-bg", "var(--panel-bg)"]]], ["html[data-glass]", null, 1e3, [["--backdrop-bg", "var(--backdrop)"]]], ["html[data-glass]", null, 1e3, [["--backdrop-bg", "color-mix(in srgb, var(--backdrop) 86%, transparent)"]]], ["html[data-glass]", null, 1e3, [["--card-bg", "var(--panel-bg)"]]], ["html[data-glass]", null, 1e3, [["--card-bg", "color-mix(in srgb, var(--panel-bg) 86%, transparent)"]]], ['body:has(.app--cards, .app--mobile), .app--cards .dock-area:has([data-testid="split-canvas"]:not([data-split="0"]))', null, 1e3, [["background", "var(--backdrop-bg)"]]], ["body", null, 1e3, [["background", "var(--shell-bg)"], ["color", "var(--text)"], ["overscroll-behavior", "none"], ["-webkit-tap-highlight-color", "transparent"], ["line-height", "1.3"]]], [".app", null, 1e3, [["flex-direction", "column"], ["height", "100dvh"], ["display", "flex"]]], [".app--mobile", null, 1e3, [["inset", "var(--visible-top, 0px) 0 auto 0"], ["height", "var(--visible-height, 100dvh)"], ["position", "fixed"]]], [".mobile-drawer-backdrop", null, 1e3, [["animation", ".15s ease-out mobile-fade"]]], [".mobile-drawer--left", null, 1e3, [["animation", ".2s cubic-bezier(.2, .8, .2, 1) mobile-slide-left"]]], [".mobile-drawer--right", null, 1e3, [["animation", ".2s cubic-bezier(.2, .8, .2, 1) mobile-slide-right"]]], [".mobile-sheet", null, 1e3, [["animation", ".22s cubic-bezier(.2, .8, .2, 1) mobile-rise"]]], [".mobile-drawer-backdrop, .mobile-drawer, .mobile-sheet", ["(prefers-reduced-motion: reduce)"], 1e3, [["animation", "none"]]], [".layout-drawer", null, 1e3, [["transform", "translateX(var(--float-hide, 0))"], ["transition", "transform .18s"]]], [".layout-drawer:hover, .layout-drawer:focus-within", null, 1e3, [["--float-hide", "0px"]]], [".dockview-theme-perch", null, 1e3, [["--dv-color-abyss-dark", "var(--panel-bg)"], ["--dv-color-abyss", "var(--surface-0)"], ["--dv-color-abyss-light", "var(--surface-1)"], ["--dv-color-abyss-lighter", "var(--overlay-0)"], ["--dv-color-abyss-accent", "var(--accent)"], ["--dv-color-abyss-primary-text", "var(--text)"], ["--dv-color-abyss-secondary-text", "var(--subtext-0)"], ["--dv-group-view-background-color", "var(--panel-bg)"], ["--dv-tabs-and-actions-container-background-color", "var(--surface-0)"], ["--dv-activegroup-visiblepanel-tab-background-color", "var(--panel-bg)"], ["--dv-activegroup-hiddenpanel-tab-background-color", "var(--surface-0)"], ["--dv-inactivegroup-visiblepanel-tab-background-color", "var(--panel-bg)"], ["--dv-inactivegroup-hiddenpanel-tab-background-color", "var(--surface-0)"], ["--dv-tab-divider-color", "var(--overlay-0)"], ["--dv-activegroup-visiblepanel-tab-color", "var(--text)"], ["--dv-activegroup-hiddenpanel-tab-color", "var(--subtext-0)"], ["--dv-inactivegroup-visiblepanel-tab-color", "var(--subtext-0)"], ["--dv-inactivegroup-hiddenpanel-tab-color", "var(--subtext-0)"], ["--dv-separator-border", "var(--overlay-0)"], ["--dv-paneview-header-border-color", "var(--overlay-0)"], ["--dv-tabs-and-actions-container-font-size", ".82rem"], ["--dv-tabs-and-actions-container-height", "2.1rem"]]], [".dockview-theme-perch .dv-tabs-and-actions-container", null, 1e3, [["z-index", "1"], ["position", "relative"]]], [".pane-tab", null, 1e3, [["align-items", "center"], ["width", "100%"], ["height", "100%"], ["display", "flex"]]], [".pane-tab__agent-badge", null, 1e3, [["color", "var(--subtext-0)"], ["white-space", "nowrap"], ["flex-shrink", "0"], ["margin-right", ".4rem"], ["font-size", ".78em"]]], ['.pane-tab[data-testid="pane-tab-chat"] .dv-default-tab-action', null, 1e3, [["display", "none"]]], [".dockview-group-action", null, 1e3, [["border-radius", "var(--radius)"], ["width", "1.5rem"], ["height", "1.5rem"], ["color", "var(--subtext-0)"], ["cursor", "pointer"], ["background", "none"], ["border", "none"], ["justify-content", "center"], ["align-self", "center"], ["align-items", "center"], ["margin", "0 .15rem"], ["font-size", "1rem"], ["line-height", "1"], ["transition", "color .1s, background .1s"], ["display", "flex"]]], [".dockview-group-action:hover", null, 1e3, [["color", "var(--text)"], ["background", "var(--surface-1)"]]], [".dockview-theme-perch .dv-view-container > .dv-view:has(.dv-inactive-group)", ["(max-width: 700px)"], 1e3, [["display", "none"]]], [".dockview-theme-perch .dv-view-container > .dv-view:has(.dv-active-group)", ["(max-width: 700px)"], 1e3, [["width", "100%", 1], ["left", "0", 1]]], [".chat", null, 1e3, [["isolation", "isolate"], ["flex-direction", "column"], ["flex", "1"], ["height", "100%"], ["min-height", "0"], ["display", "flex"]]], [".message__markdown p", null, 1e3, [["margin", "0 0 .5em"]]], [".message__markdown p:last-child", null, 1e3, [["margin-bottom", "0"]]], [".message__markdown h1, .message__markdown h2, .message__markdown h3, .message__markdown h4", null, 1e3, [["margin", ".6em 0 .3em"], ["line-height", "1.25"]]], [".message__markdown h1", null, 1e3, [["font-size", "1.25em"]]], [".message__markdown h2", null, 1e3, [["font-size", "1.12em"]]], [".message__markdown h3", null, 1e3, [["font-size", "1em"]]], [".message__markdown > * + *", null, 1e3, [["margin-top", ".5em"]]], [".message__markdown table, .md-table", null, 1e3, [["border-collapse", "separate"], ["border-spacing", "0"], ["background", "var(--surface-0)"], ["border-radius", "var(--radius)"], ["max-width", "100%"], ["margin", ".5em 0"], ["font-size", ".92em"], ["display", "block"], ["overflow-x", "auto"]]], [".md-table", null, 1e3, [["width", "100%"], ["margin", "0"], ["display", "table"]]], [".message__markdown th, .message__markdown td, .md-table th, .md-table td", null, 1e3, [["text-align", "left"], ["vertical-align", "top"], ["border-bottom", "1px solid var(--surface-1)"], ["padding", ".35em .75em"]]], [".message__markdown th, .md-table th", null, 1e3, [["color", "var(--subtext-0)"], ["white-space", "nowrap"], ["background", "var(--surface-1)"], ["font-weight", "600"]]], [".message__markdown tbody tr:last-child td, .md-table tbody tr:last-child td", null, 1e3, [["border-bottom", "0"]]], [".message__markdown tbody tr:hover td, .md-table tbody tr:hover td", null, 1e3, [["background", "var(--surface-1)"]]], [".md-table caption", null, 1e3, [["text-align", "left"], ["color", "var(--subtext-0)"], ["padding", ".4em .75em"]]], [".md-code", null, 1e3, [["background", "var(--surface-0)"], ["border-radius", "var(--radius)"], ["overflow", "hidden"]]], [".md-code__bar", null, 1e3, [["color", "var(--subtext-0)"], ["background", "var(--surface-1)"], ["justify-content", "space-between"], ["align-items", "center"], ["padding", ".1rem .4rem .1rem .75rem"], ["font-size", ".75em"], ["display", "flex"]]], [".message__markdown .md-code pre", null, 1e3, [["background", "none"], ["border-radius", "0"], ["margin", "0"]]], [".hl-keyword", null, 1e3, [["color", "var(--mauve)"]]], [".hl-string", null, 1e3, [["color", "var(--green)"]]], [".hl-number", null, 1e3, [["color", "var(--peach)"]]], [".hl-function", null, 1e3, [["color", "var(--blue)"]]], [".hl-type", null, 1e3, [["color", "var(--yellow)"]]], [".hl-tag", null, 1e3, [["color", "var(--teal)"]]], [".hl-comment", null, 1e3, [["color", "var(--overlay-1)"], ["font-style", "italic"]]], [".message__markdown ul, .message__markdown ol", null, 1e3, [["margin", ".3em 0 .5em 1.3em"], ["padding", "0"]]], [".message__markdown li", null, 1e3, [["margin-bottom", ".2em"]]], [".message__markdown code", null, 1e3, [["background", "var(--surface-0)"], ["border-radius", ".25rem"], ["padding", ".1em .35em"], ["font-family", "ui-monospace, SFMono-Regular, SF Mono, Menlo, Consolas, monospace"], ["font-size", ".88em"]]], [".message__markdown pre", null, 1e3, [["background", "var(--surface-0)"], ["border-radius", "var(--radius)"], ["margin", ".4em 0"], ["padding", ".6rem .75rem"], ["position", "relative"], ["overflow-x", "auto"]]], [".message__markdown pre code", null, 1e3, [["background", "none"], ["border", "none"], ["padding", "0"], ["font-size", ".85em"]]], [".message__markdown a", null, 1e3, [["color", "var(--accent)"], ["text-decoration", "underline"]]], [".message__markdown blockquote", null, 1e3, [["border-left", "3px solid var(--overlay-0)"], ["color", "var(--subtext-0)"], ["margin", ".4em 0"], ["padding", ".1em .6em"]]], [".message__markdown hr", null, 1e3, [["border", "none"], ["border-top", "1px solid var(--overlay-0)"], ["margin", ".75em 0"]]], [".file-markdown", null, 1e3, [["overflow-wrap", "anywhere"]]], [".file-markdown img", null, 1e3, [["max-width", "100%"]]], [".file-markdown table", null, 1e3, [["border-collapse", "collapse"], ["margin", ".4em 0"], ["display", "block"], ["overflow-x", "auto"]]], [".file-markdown th, .file-markdown td", null, 1e3, [["border", "1px solid var(--overlay-0)"], ["padding", ".2em .5em"]]], [".file-markdown .md-placeholder", null, 1e3, [["color", "var(--subtext-0)"], ["border", "1px dashed var(--overlay-0)"], ["border-radius", ".25rem"], ["padding", ".05em .35em"], ["font-size", ".9em"]]], [".terminal", null, 1e3, [["min-width", "0"], ["min-height", "0"], ["padding", "var(--terminal-padding, 0)"], ["opacity", "var(--terminal-opacity, 1)"], ["flex", "1"], ["display", "flex"], ["position", "relative"]]], [".terminal__surface", null, 1e3, [["flex", "1"], ["min-width", "0"], ["min-height", "0"], ["overflow", "hidden"]]], [".terminal__surface .xterm", null, 1e3, [["height", "100%"]]], [".terminal__surface .xterm:not(.allow-transparency) .xterm-viewport", null, 1e3, [["background-color", "#0000"]]], [".terminal__surface .xterm-scrollable-element", null, 1e3, [["position", "static", 1]]], [".terminal__surface .xterm-decoration-overview-ruler, .no-pane-scrollbars .terminal__surface .xterm-scrollable-element > .xterm-scrollbar", null, 1e3, [["display", "none"]]], [".terminal--persistent", null, 1e3, [["flex-direction", "column"]]], [".terminal__toolbar", null, 1e3, [["color", "var(--subtext-0)"], ["align-items", "center"], ["gap", ".5rem"], ["padding", ".25rem 1.5rem .25rem .5rem"], ["font-size", ".8rem"], ["display", "flex"]]], [".terminal__toolbar button", null, 1e3, [["border-radius", "var(--radius)"], ["min-height", "32px"], ["color", "var(--text)"], ["background", "var(--surface-0)"], ["border", "0"], ["padding", ".25rem .5rem"]]], [".terminal__toolbar--overlay", null, 1e3, [["z-index", "2"], ["border-radius", "var(--radius)"], ["background", "var(--surface-1)"], ["padding", ".2rem .3rem .2rem .6rem"], ["position", "absolute"], ["top", ".4rem"], ["right", ".9rem"], ["box-shadow", "0 2px 8px #00000040"]]], [".terminal__connection", null, 1e3, [["margin-right", "auto"]]], [".terminal__toolbar button:disabled", null, 1e3, [["opacity", ".5"]]], [".terminal__notice", null, 1e3, [["color", "var(--subtext-0)"], ["padding", ".75rem"], ["font-size", ".85rem"]]], [".app--mobile .terminal__toolbar button", null, 1e3, [["min-height", "44px"]]], [".app--mobile .terminal__connection", null, 1e3, [["display", "none"]]], [".app--mobile .terminal__toolbar", null, 1e3, [["padding-right", ".5rem"]]], [".terminal__exited", null, 1e3, [["background", "var(--surface-1)"], ["border-radius", "var(--radius)"], ["color", "var(--subtext-0)"], ["padding", ".35rem .75rem"], ["font-size", ".85rem"], ["position", "absolute"], ["bottom", ".75rem"], ["left", "50%"], ["transform", "translateX(-50%)"]]], [".terminal__exited--cli", null, 1e3, [["background", "var(--panel-bg)"], ["flex-direction", "column"], ["align-items", "center"], ["gap", ".6rem"], ["padding", ".9rem 1.1rem"], ["display", "flex"], ["top", "50%"], ["bottom", "auto"], ["transform", "translate(-50%, -50%)"], ["box-shadow", "0 6px 24px #00000059"]]], [".terminal__exited-actions", null, 1e3, [["gap", ".5rem"], ["display", "flex"]]], [".terminal__cli-error", null, 1e3, [["background", "var(--red)"], ["position", "absolute"], ["bottom", ".75rem"], ["left", "50%"], ["transform", "translateX(-50%)"]]], [".terminal__cli-error", null, 1e3, [["background", "color-mix(in srgb, var(--red) 20%, var(--panel-bg))"]]], [".terminal__cli-error", null, 1e3, [["border-radius", "var(--radius)"], ["color", "var(--red)"], ["text-align", "center"], ["white-space", "pre-wrap"], ["word-break", "break-word"], ["max-width", "90%"], ["padding", ".35rem .75rem"], ["font-size", ".85rem"]]], [".mobile-pane-shell__content > .chat, .mobile-pane-shell__content > .terminal, .mobile-pane-shell__content > .workspace-files, .mobile-pane-shell__content > .workspace-git", null, 1e3, [["flex", "1"], ["width", "100%"], ["min-width", "0"], ["height", "100%"], ["min-height", "0"]]], [".terminal__host", null, 1e3, [["width", "100%"], ["height", "100%"], ["overflow", "hidden"]]], [".workspace-git", null, 1e3, [["--git-border", "var(--overlay-0)"]]], [".workspace-git", null, 1e3, [["--git-border", "color-mix(in srgb, var(--overlay-0) 72%, transparent)"]]], [".workspace-git", null, 1e3, [["--git-muted", "var(--subtext-0)"], ["width", "100%"], ["min-width", "0"], ["height", "100%"], ["min-height", "0"], ["color", "var(--text)"], ["background", "var(--workspace-tools-bg, var(--panel-bg))"], ["flex-direction", "column"], ["font-size", ".78rem"], ["display", "flex"], ["position", "relative"], ["overflow", "hidden"], ["container-type", "inline-size"]]], [".workspace-git button, .workspace-git input, .workspace-git textarea", null, 1e3, [["font", "inherit"]]], [".workspace-git button", null, 1e3, [["cursor", "pointer"]]], ['.workspace-git button:focus-visible, .workspace-git input:focus-visible, .workspace-git textarea:focus-visible, .workspace-git [role="button"]:focus-visible', null, 1e3, [["outline", "2px solid var(--accent)"], ["outline-offset", "1px"]]], [".workspace-git__diff", null, 1e3, [["container-type", "inline-size"]]], [".workspace-git__line-comment-thread", null, 1e3, [["max-width", "max(0px, min(42rem, 100cqi - 6.9rem))"], ["position", "sticky"], ["left", "0"]]], [".workspace-git__comment-composer", null, 1e3, [["max-width", "max(0px, 100cqi - 1.4rem)"], ["position", "sticky"], ["left", "0"]]], [".workspace-git__line-comment-thread", ["(max-width: 700px)"], 1e3, [["max-width", "max(0px, 100cqi - 5.6rem)"]]], [".dockview-group-action--split-session", null, 1e3, [["font-size", "13px"]]], [".session-split-popover", null, 1e3, [["display", "flex"], ["flex-direction", "column"], ["background", "var(--surface-1)"], ["border-radius", "var(--radius)"], ["box-shadow", "0 8px 24px rgba(0, 0, 0, 0.45)"], ["padding", "4px"], ["font-size", "12.5px"], ["color", "var(--text)"], ["overflow", "hidden"]]], [".session-split-popover__header", null, 1e3, [["padding", "6px 8px 4px"], ["font-size", "11px"], ["text-transform", "uppercase"], ["letter-spacing", "0.04em"], ["color", "var(--subtext-0)"]]], [".session-split-popover__empty", null, 1e3, [["padding", "8px"], ["color", "var(--subtext-0)"]]], [".session-split-popover__list", null, 1e3, [["overflow-y", "auto"]]], [".session-split-popover__item", null, 1e3, [["display", "flex"], ["flex-direction", "column"], ["align-items", "flex-start"], ["gap", "1px"], ["width", "100%"], ["padding", "6px 8px"], ["border", "none"], ["border-radius", "4px"], ["background", "transparent"], ["color", "inherit"], ["text-align", "left"], ["cursor", "grab"]]], [".session-split-popover__item:hover", null, 1e3, [["background", "var(--surface-0)"]]], [".session-split-popover__item-title", null, 1e3, [["font-weight", "500"], ["white-space", "nowrap"], ["overflow", "hidden"], ["text-overflow", "ellipsis"], ["max-width", "100%"]]], [".session-split-popover__item-cwd", null, 1e3, [["font-size", "11px"], ["color", "var(--subtext-0)"], ["white-space", "nowrap"], ["overflow", "hidden"], ["text-overflow", "ellipsis"], ["max-width", "100%"]]], [".session-split-popover__item-badge", null, 1e3, [["align-self", "flex-end"], ["font-size", "10px"], ["color", "var(--accent)"], ["margin-top", "-14px"]]], [".inactive-session-pane", null, 1e3, [["display", "flex"], ["flex-direction", "column"], ["align-items", "center"], ["justify-content", "center"], ["gap", "10px"], ["height", "100%"], ["padding", "24px"], ["text-align", "center"], ["color", "var(--subtext-0)"]]], [".inactive-session-pane__title", null, 1e3, [["font-size", "14px"], ["font-weight", "500"], ["color", "var(--text)"]]], [".inactive-session-pane__cwd", null, 1e3, [["font-size", "12px"], ["color", "var(--subtext-0)"], ["word-break", "break-all"]]], [".inactive-session-pane__note", null, 1e3, [["font-size", "12px"], ["max-width", "320px"], ["line-height", "1.5"]]], [".inactive-session-pane__switch", null, 1e3, [["margin-top", "4px"], ["padding", "6px 14px"], ["border-radius", "var(--radius)"], ["border", "0"], ["background", "var(--surface-0)"], ["color", "var(--text)"], ["cursor", "pointer"], ["font-size", "12.5px"]]], [".inactive-session-pane__switch:hover", null, 1e3, [["background", "var(--surface-1)"]]]], skipped: { "@supports evaluated false": 2, "@keyframes": 9 }, digest: "954b47dfb2ee5536" };
//! The app's compiled stylesheet as a table (`build.mjs` writes it from Vite + Tailwind's output and bundles it as
//! `virtual:perch-css-table`), parsed once on first use.
const Ya = globalThis[Symbol.for("perch.styleSheets")] ??= /* @__PURE__ */ new Map();
let Sl = null;
function Nb() {
  return Sl || (Sl = Ga.digest && Ya.get(Ga.digest) || new U0(Ga), Ga.digest && !Ya.has(Ga.digest) && (Ya.size >= 4 && Ya.delete(Ya.keys().next().value), Ya.set(Ga.digest, Sl)), Sl);
}
//! The React renderer: React 19 through `react-reconciler` onto the retained host tree of `dom.mjs`, so a stock
//! screen's unchanged source (`useRef`, `createPortal(..., document.body)`, `event.currentTarget.closest(...)`)
//! runs as it does in the page. After every commit the tree is described for the engine (`describe.mjs`) and handed
//! to `perch.render(description)`.
//!
//! The engine talks back through the handle `mount` returns: `dispatch(id, type, init)` runs a DOM event through
//! the tree (capture on `window`, `document` and the ancestors, the target, then bubble, with React's `on<Type>`
//! and `on<Type>Capture` props at their element), `hover(id, on)`, `focus(id)` and `blur()` (the keyboard gone
//! elsewhere) set the interaction state the cascade reads for group variants, and `flush()` runs pending effects. An
//! event is a discrete update: React commits it before `dispatch` returns.
let Gn = Qa.NoEventPriority;
function Tb(n, a) {
  const i = /* @__PURE__ */ new Set([...Object.keys(n), ...Object.keys(a)]);
  for (const o of i) {
    if (o === "children") continue;
    const s = n[o], u = a[o];
    if (!(s === u || typeof s == "function" && typeof u == "function") && !(o === "style" && s && u && typeof s == "object" && typeof u == "object" && [.../* @__PURE__ */ new Set([...Object.keys(s), ...Object.keys(u)])].every((f) => s[f] === u[f])))
      return !0;
  }
  return !1;
}
const Cb = (n) => !n.props.disabled && (/^(button|input|select|textarea)$/.test(n.tagName) || n.tagName === "a" && n.props.href != null || n.props.tabIndex != null);
function Af(n, a) {
  for (const i of n0(a.dangerouslySetInnerHTML?.__html, n.ownerDocument) ?? []) n.appendChild(i);
  return n;
}
const Cm = {
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
  createInstance: (n, a, i) => Af(new Zt(n, a, i.ownerDocument), a),
  createTextInstance: (n, a) => new gr(n),
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
  commitUpdate: (n, a, i, o) => {
    if (n.props = o, n.inline) for (const s of Object.keys(n.inline)) i.style?.[s] !== o.style?.[s] && delete n.inline[s];
    if (i.dangerouslySetInnerHTML?.__html !== o.dangerouslySetInnerHTML?.__html) {
      for (const s of [...n.childNodes]) n.removeChild(s);
      Af(n, o);
    }
    Tb(i, o) && n.touch();
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
    Gn = n;
  },
  getCurrentUpdatePriority: () => Gn,
  resolveUpdatePriority: () => Gn !== Qa.NoEventPriority ? Gn : Qa.DefaultEventPriority,
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
let pe = mm(Cm), Ms = 0;
function jf() {
  pe.isAlreadyRendering() && (k0.unstable_recoverFromCut?.(), pe = mm(Cm), Ms += 1, Gn = Qa.NoEventPriority);
}
const Hl = (n, a, i = null) => pe.createPortal(n, a, null, i), Mb = {
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
}, Ab = /* @__PURE__ */ new Set(["click", "dblclick", "mousedown", "mouseup"]), jb = /* @__PURE__ */ new Set(["button", "input", "select", "textarea", "fieldset"]), Ob = (n) => {
  for (let a = n; a instanceof Zt; a = a.parentNode) if (a.props.disabled && jb.has(a.tagName)) return !0;
  return !1;
};
class Rb {
  constructor(a, i, o) {
    Object.assign(this, { clientX: 0, clientY: 0, button: 0, buttons: 0, pointerType: "mouse", key: "", code: "", shiftKey: !1, metaKey: !1, ctrlKey: !1, altKey: !1, repeat: !1, isComposing: !1, keyCode: 0 }, i), this.type = a, this.target = o, this.currentTarget = null, this.defaultPrevented = !1, this.propagationStopped = !1, this.timeStamp = Date.now();
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
function Li(n, a, i) {
  a.currentTarget = n;
  for (const { type: o, listener: s, capture: u } of [...n.listeners ?? []])
    o === a.type && u === i && s.call(n, a);
  if (n instanceof Zt) {
    const o = Mb[a.type], s = o && n.props[i ? `${o}Capture` : o];
    typeof s == "function" && s(a);
  }
}
function $x(n, a, i = {}) {
  const { document: o, window: s, globals: u } = o0(n), m = new Zt("div", { id: "root", style: i.container ?? {} }, o);
  o.body.appendChild(m);
  const f = [];
  let p = null;
  const v = () => [o, s].map((h) => h.listeners.map((_) => `${_.type}:${_.capture}`).sort().join(",")).join("|");
  let x = "";
  const y = {}, b = `m${Math.random().toString(36).slice(2, 10)}:`;
  let S = 0, T = -1;
  o.measureKey = (h) => b + h.id, o.stale = () => T !== S, o.computed = (h) => {
    if (!y.cascade || !y.top) return null;
    const _ = [];
    for (let z = h; z instanceof Zt && z !== o.body; z = z.parentNode) _.unshift(z);
    let k = y.top;
    for (const z of _) k = y.cascade.compute(z, k);
    return k.values;
  };
  const E = () => (S += 1, p = zb(o, n, Nb(), y, i.names), x = v(), n.render?.(p), p);
  jf();
  const N = Ms, j = () => (jf(), N === Ms), R = () => {
    j() && (pe.flushPassiveEffects(), pe.flushSyncWork(), v() !== x && (x = v(), p.document_events = Tm(o)));
  };
  o.afterCommit = E;
  const U = (h) => {
    f.push(h), n.error?.(h);
  }, F = pe.createContainer(m, Qa.ConcurrentRoot, null, !1, null, "", U, U, U, null);
  pe.updateContainerSync(X.createElement(a, i.props ?? {}), F, null, null), pe.flushSyncWork(), R();
  const W = (h) => {
    const _ = (k) => {
      if (k.id === h) return k;
      for (const z of k.children) {
        const O = _(z);
        if (O) return O;
      }
      return null;
    };
    return _(o.documentElement);
  }, B = (h) => {
    if (!j()) return;
    const _ = Gn;
    Gn = Qa.DiscreteEventPriority;
    try {
      return h();
    } finally {
      Gn = _, pe.flushSyncWork(), R();
    }
  }, g = {
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
    describe: E,
    /** Runs a DOM event of `type` at node `id`; false when the node is gone. */
    dispatch(h, _, k = {}) {
      const z = typeof h == "string" ? W(h) : h;
      if (!z || Ab.has(_) && Ob(z)) return !1;
      const O = new Rb(_, k, z), M = [];
      for (let D = z; D; D = _ === "scroll" ? null : D.parentNode) M.push(D);
      const Y = [...M, o, s];
      B(() => {
        for (let D = Y.length - 1; D > 0 && !O.propagationStopped; D--) Li(Y[D], O, !0);
        O.propagationStopped || (Li(z, O, !0), O.propagationStopped || Li(z, O, !1));
        for (let D = 1; D < Y.length && !O.propagationStopped; D++) Li(Y[D], O, !1);
      });
      const Z = _ === "click" && !O.defaultPrevented ? ks(z) : null;
      if (Z && g.dispatch(Z, "submit", {}), _ === "click" && !O.defaultPrevented)
        for (let D = z; D; D = D.parentNode) {
          if (D.tagName !== "a") continue;
          const Q = D.props?.href;
          typeof Q == "string" && /^https:\/\/\S+$/.test(Q) && n.openLink?.(Q);
          break;
        }
      return !O.defaultPrevented;
    },
    /** Whether the source listens for `type` on `window` or `document` (a page recording a key press does). */
    listensFor: (h) => [o, s].some((_) => _.listeners.some((k) => k.type === h)),
    /** A key pressed while the screen has the keyboard (`init`: the DOM's `key`, modifiers, `repeat`), at the
     * focused element. When nothing prevented it and that element is a text field, the key edits the field as a
     * browser would: a character is typed at the end (or replaces the text when all of it is selected), Backspace
     * deletes the last one, and the field gets `input` and `change` events with its new `value`. Returns whether the
     * source took the key (prevented it, or a field changed). */
    key(h) {
      const _ = o.activeElement && o.activeElement !== o.body ? o.activeElement : o.body;
      if (!g.dispatch(_, "keydown", h)) return !0;
      const z = h.key === "Enter" && !h.isComposing ? ks(_, !0) : null;
      if (z)
        return g.dispatch(z, "submit", {}), !0;
      if (!um(_) || _.props.disabled || _.props.readOnly) return !1;
      if ((h.ctrlKey || h.metaKey) && !h.altKey && !h.shiftKey && h.key.toLowerCase() === "a")
        return _.selectedAll = !0, !0;
      if (h.ctrlKey || h.metaKey) return !1;
      const O = _.selectedAll;
      _.selectedAll = !1;
      const M = _.value, Z = h.key === "Backspace" || O && h.key === "Delete" ? O ? "" : M.slice(0, -1) : [...h.key].length === 1 ? (O ? "" : M) + h.key : M;
      return Z === M ? !1 : (_.value = Z, g.dispatch(_, "input", { data: h.key }), g.dispatch(_, "change", {}), _.props.value !== void 0 && delete _.edit, _.touch(), E(), !0);
    },
    /** The engine's box for node `id` (window coordinates, logical px), for `getBoundingClientRect`. */
    setBounds(h, _) {
      const k = W(h);
      k && (k.bounds = { x: _.x, y: _.y, width: _.width, height: _.height });
    },
    /** A click on a check box or radio button (`id`): the `click` event, then, unless the source prevented it, the
     * box ticked as a browser ticks it (a radio button only on), with `input` and `change` events. */
    toggle(h) {
      const _ = W(h);
      if (!_ || _.props.disabled || !g.dispatch(h, "click", { button: 0, detail: 1 })) return;
      const k = _.props.type === "radio";
      k && _.checked || (_.checked = k ? !0 : !_.checked, g.dispatch(h, "input", {}), g.dispatch(h, "change", {}), _.props.checked !== void 0 && delete _.ticked, _.touch(), E());
    },
    /** A left click as the engine reports one: press then release on the same node. */
    click(h, _ = {}) {
      const k = { button: 0, buttons: 1, pointerType: "mouse", ..._ };
      for (const z of ["pointerdown", "mousedown", "pointerup", "mouseup", "click"]) g.dispatch(h, z, k);
    },
    /** The pointer entered (`on`) or left node `id` (one the description marks `track_hover`): its `:hover` state,
     * which a descendant's group variant reads. The element's own `hover:` styles are the engine's hover style. */
    /** Whether the pointer is over node `id`, as `hover` last said. */
    hovered: (h) => !!W(h)?.state.hover,
    hover(h, _) {
      const k = W(h);
      !k || k.state.hover === _ || (k.state.hover = _, k.touch(), E());
    },
    focus(h) {
      const _ = W(h);
      _ && (B(() => {
        const k = o.activeElement;
        k && k !== _ && k !== o.body && g.dispatch(k, "blur"), o.focus(_), g.dispatch(_, "focus");
      }), E());
    },
    /** The keyboard left the screen (a press on a terminal): its focused element loses the focus and gets `blur`, as
     * a page's field does when the focus moves out of it, so a field that ends on blur (a rename) ends. */
    blur() {
      const h = o.activeElement;
      !h || h === o.body || (B(() => {
        g.dispatch(h, "blur"), o.blur(h);
      }), E());
    },
    /** A press at node `id` that nothing prevented: the browser's default focuses the element pressed. Only an element
     * that listens for keys (`onKeyDown`) is focused, so a press elsewhere leaves the keyboard where it was; the focus
     * is not `:focus-visible`, as after a pointer press in a browser. */
    // ponytail: a browser focuses every focusable element pressed; here only one with its own key handler, so a
    // screen's ordinary buttons do not take the keyboard from a terminal.
    pressFocus(h) {
      let k = typeof h == "string" ? W(h) : h;
      for (; k && !(k instanceof Zt && typeof k.props.onKeyDown == "function" && Cb(k)); ) k = k.parentNode;
      !k || k === o.activeElement || (g.focus(k.id), k.state.pointerFocus = !0, k.touch(), E());
    },
    /** The engine is drawing the latest description: the boxes measured in this frame's layout are the tree's.
     * Returns whether effects wait for that layout (`measured`); run them with `retry` once the frame is drawn. */
    drawing() {
      return T = S, o.retries.length > 0;
    },
    /** Runs the effects that waited for a fresh layout. */
    retry() {
      const h = o.retries.splice(0);
      for (const _ of h) _();
    },
    /** Runs effects React has scheduled (the engine calls it after a frame). */
    flush: R,
    /** React was replaced since this tree was mounted (`fresh`): the tree is to be mounted again. */
    dead: () => !j(),
    update(h) {
      j() && (pe.updateContainerSync(X.createElement(a, h ?? {}), F, null, null), pe.flushSyncWork(), R());
    },
    unmount() {
      j() && (pe.updateContainerSync(null, F, null, null), pe.flushSyncWork(), pe.flushPassiveEffects()), o.afterCommit = null, o.retries.length = 0, n.forgetBounds?.(b);
    }
  };
  return g;
}
//! `react-dom` for a screen on the native renderer: `createPortal` (into `document.body`, the overlay layer) and
//! `flushSync`. Nothing of the browser renderer.
const Mm = (n) => pe.flushSyncFromReconciler(n), Db = { createPortal: Hl, flushSync: Mm }, Ix = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  createPortal: Hl,
  default: Db,
  flushSync: Mm
}, Symbol.toStringTag, { value: "Module" }));
function Am(n) {
  var a, i, o = "";
  if (typeof n == "string" || typeof n == "number") o += n;
  else if (typeof n == "object") if (Array.isArray(n)) {
    var s = n.length;
    for (a = 0; a < s; a++) n[a] && (i = Am(n[a])) && (o && (o += " "), o += i);
  } else for (i in n) n[i] && (o && (o += " "), o += i);
  return o;
}
function jm() {
  for (var n, a, i = 0, o = "", s = arguments.length; i < s; i++) (n = arguments[i]) && (a = Am(n)) && (o && (o += " "), o += a);
  return o;
}
const Bb = (n, a) => {
  const i = new Array(n.length + a.length);
  for (let o = 0; o < n.length; o++)
    i[o] = n[o];
  for (let o = 0; o < a.length; o++)
    i[n.length + o] = a[o];
  return i;
}, Hb = (n, a) => ({
  classGroupId: n,
  validator: a
}), Om = (n = /* @__PURE__ */ new Map(), a = null, i) => ({
  nextPart: n,
  validators: a,
  classGroupId: i
}), dr = "-", Of = [], Ub = "arbitrary..", qb = (n) => {
  const a = Yb(n), {
    conflictingClassGroups: i,
    conflictingClassGroupModifiers: o
  } = n;
  return {
    getClassGroupId: (m) => {
      if (m.startsWith("[") && m.endsWith("]"))
        return Gb(m);
      const f = m.split(dr), p = f[0] === "" && f.length > 1 ? 1 : 0;
      return Rm(f, p, a);
    },
    getConflictingClassGroupIds: (m, f) => {
      if (f) {
        const p = o[m], v = i[m];
        return p ? v ? Bb(v, p) : p : v || Of;
      }
      return i[m] || Of;
    }
  };
}, Rm = (n, a, i) => {
  if (n.length - a === 0)
    return i.classGroupId;
  const s = n[a], u = i.nextPart.get(s);
  if (u) {
    const v = Rm(n, a + 1, u);
    if (v) return v;
  }
  const m = i.validators;
  if (m === null)
    return;
  const f = a === 0 ? n.join(dr) : n.slice(a).join(dr), p = m.length;
  for (let v = 0; v < p; v++) {
    const x = m[v];
    if (x.validator(f))
      return x.classGroupId;
  }
}, Gb = (n) => n.slice(1, -1).indexOf(":") === -1 ? void 0 : (() => {
  const a = n.slice(1, -1), i = a.indexOf(":"), o = a.slice(0, i);
  return o ? Ub + o : void 0;
})(), Yb = (n) => {
  const {
    theme: a,
    classGroups: i
  } = n;
  return Lb(i, a);
}, Lb = (n, a) => {
  const i = Om();
  for (const o in n) {
    const s = n[o];
    Js(s, i, o, a);
  }
  return i;
}, Js = (n, a, i, o) => {
  const s = n.length;
  for (let u = 0; u < s; u++) {
    const m = n[u];
    Vb(m, a, i, o);
  }
}, Vb = (n, a, i, o) => {
  if (typeof n == "string") {
    Qb(n, a, i);
    return;
  }
  if (typeof n == "function") {
    Kb(n, a, i, o);
    return;
  }
  Xb(n, a, i, o);
}, Qb = (n, a, i) => {
  const o = n === "" ? a : Dm(a, n);
  o.classGroupId = i;
}, Kb = (n, a, i, o) => {
  if (Zb(n)) {
    Js(n(o), a, i, o);
    return;
  }
  a.validators === null && (a.validators = []), a.validators.push(Hb(i, n));
}, Xb = (n, a, i, o) => {
  const s = Object.entries(n), u = s.length;
  for (let m = 0; m < u; m++) {
    const [f, p] = s[m];
    Js(p, Dm(a, f), i, o);
  }
}, Dm = (n, a) => {
  let i = n;
  const o = a.split(dr), s = o.length;
  for (let u = 0; u < s; u++) {
    const m = o[u];
    let f = i.nextPart.get(m);
    f || (f = Om(), i.nextPart.set(m, f)), i = f;
  }
  return i;
}, Zb = (n) => "isThemeGetter" in n && n.isThemeGetter === !0, Jb = (n) => {
  if (n < 1)
    return {
      get: () => {
      },
      set: () => {
      }
    };
  let a = 0, i = /* @__PURE__ */ Object.create(null), o = /* @__PURE__ */ Object.create(null);
  const s = (u, m) => {
    i[u] = m, a++, a > n && (a = 0, o = i, i = /* @__PURE__ */ Object.create(null));
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
}, As = "!", Rf = ":", Wb = [], Df = (n, a, i, o, s) => ({
  modifiers: n,
  hasImportantModifier: a,
  baseClassName: i,
  maybePostfixModifierPosition: o,
  isExternal: s
}), Fb = (n) => {
  const {
    prefix: a,
    experimentalParseClassName: i
  } = n;
  let o = (s) => {
    const u = [];
    let m = 0, f = 0, p = 0, v;
    const x = s.length;
    for (let E = 0; E < x; E++) {
      const N = s[E];
      if (m === 0 && f === 0) {
        if (N === Rf) {
          u.push(s.slice(p, E)), p = E + 1;
          continue;
        }
        if (N === "/") {
          v = E;
          continue;
        }
      }
      N === "[" ? m++ : N === "]" ? m-- : N === "(" ? f++ : N === ")" && f--;
    }
    const y = u.length === 0 ? s : s.slice(p);
    let b = y, S = !1;
    y.endsWith(As) ? (b = y.slice(0, -1), S = !0) : (
      /**
       * In Tailwind CSS v3 the important modifier was at the start of the base class name. This is still supported for legacy reasons.
       * @see https://github.com/dcastil/tailwind-merge/issues/513#issuecomment-2614029864
       */
      y.startsWith(As) && (b = y.slice(1), S = !0)
    );
    const T = v && v > p ? v - p : void 0;
    return Df(u, S, b, T);
  };
  if (a) {
    const s = a + Rf, u = o;
    o = (m) => m.startsWith(s) ? u(m.slice(s.length)) : Df(Wb, !1, m, void 0, !0);
  }
  if (i) {
    const s = o;
    o = (u) => i({
      className: u,
      parseClassName: s
    });
  }
  return o;
}, $b = (n) => {
  const a = /* @__PURE__ */ new Map();
  return n.orderSensitiveModifiers.forEach((i, o) => {
    a.set(i, 1e6 + o);
  }), (i) => {
    const o = [];
    let s = [];
    for (let u = 0; u < i.length; u++) {
      const m = i[u], f = m[0] === "[", p = a.has(m);
      f || p ? (s.length > 0 && (s.sort(), o.push(...s), s = []), o.push(m)) : s.push(m);
    }
    return s.length > 0 && (s.sort(), o.push(...s)), o;
  };
}, Ib = (n) => ({
  cache: Jb(n.cacheSize),
  parseClassName: Fb(n),
  sortModifiers: $b(n),
  postfixLookupClassGroupIds: Pb(n),
  ...qb(n)
}), Pb = (n) => {
  const a = /* @__PURE__ */ Object.create(null), i = n.postfixLookupClassGroups;
  if (i)
    for (let o = 0; o < i.length; o++)
      a[i[o]] = !0;
  return a;
}, tv = /\s+/, ev = (n, a) => {
  const {
    parseClassName: i,
    getClassGroupId: o,
    getConflictingClassGroupIds: s,
    sortModifiers: u,
    postfixLookupClassGroupIds: m
  } = a, f = [], p = n.trim().split(tv);
  let v = "";
  for (let x = p.length - 1; x >= 0; x -= 1) {
    const y = p[x], {
      isExternal: b,
      modifiers: S,
      hasImportantModifier: T,
      baseClassName: E,
      maybePostfixModifierPosition: N
    } = i(y);
    if (b) {
      v = y + (v.length > 0 ? " " + v : v);
      continue;
    }
    let j = !!N, R;
    if (j) {
      const g = E.substring(0, N);
      R = o(g);
      const h = R && m[R] ? o(E) : void 0;
      h && h !== R && (R = h, j = !1);
    } else
      R = o(E);
    if (!R) {
      if (!j) {
        v = y + (v.length > 0 ? " " + v : v);
        continue;
      }
      if (R = o(E), !R) {
        v = y + (v.length > 0 ? " " + v : v);
        continue;
      }
      j = !1;
    }
    const U = S.length === 0 ? "" : S.length === 1 ? S[0] : u(S).join(":"), F = T ? U + As : U, W = F + R;
    if (f.indexOf(W) > -1)
      continue;
    f.push(W);
    const B = s(R, j);
    for (let g = 0; g < B.length; ++g) {
      const h = B[g];
      f.push(F + h);
    }
    v = y + (v.length > 0 ? " " + v : v);
  }
  return v;
}, nv = (...n) => {
  let a = 0, i, o, s = "";
  for (; a < n.length; )
    (i = n[a++]) && (o = Bm(i)) && (s && (s += " "), s += o);
  return s;
}, Bm = (n) => {
  if (typeof n == "string")
    return n;
  let a, i = "";
  for (let o = 0; o < n.length; o++)
    n[o] && (a = Bm(n[o])) && (i && (i += " "), i += a);
  return i;
}, av = (n, ...a) => {
  let i, o, s, u;
  const m = (p) => {
    const v = a.reduce((x, y) => y(x), n());
    return i = Ib(v), o = i.cache.get, s = i.cache.set, u = f, f(p);
  }, f = (p) => {
    const v = o(p);
    if (v)
      return v;
    const x = ev(p, i);
    return s(p, x), x;
  };
  return u = m, (...p) => u(nv(...p));
}, lv = [], Ft = (n) => {
  const a = (i) => i[n] || lv;
  return a.isThemeGetter = !0, a.themeKey = n, a;
}, Hm = /^\[(?:(\w[\w-]*):)?(.+)\]$/i, Um = /^\((?:(\w[\w-]*):)?(.+)\)$/i, iv = /^\d+(?:\.\d+)?\/\d+(?:\.\d+)?$/, rv = /^(\d+(\.\d+)?)?(xs|sm|md|lg|xl)$/, ov = /\d+(%|px|r?em|[sdl]?v([hwib]|min|max)|pt|pc|in|cm|mm|cap|ch|ex|r?lh|cq(w|h|i|b|min|max))|\b(calc|min|max|clamp)\(.+\)|^0$/, sv = /^(rgba?|hsla?|hwb|(ok)?(lab|lch)|color-mix|color|light-dark)\(.+\)$/, cv = /^(inset_)?-?((\d+)?\.?(\d+)[a-z]+|0)_-?((\d+)?\.?(\d+)[a-z]+|0)/, uv = /^(url|image|image-set|cross-fade|element|(repeating-)?(linear|radial|conic)-gradient)\(.+\)$/, Dn = (n) => iv.test(n), yt = (n) => !!n && !Number.isNaN(Number(n)), Fe = (n) => !!n && Number.isInteger(Number(n)), ms = (n) => n.endsWith("%") && yt(n.slice(0, -1)), pn = (n) => rv.test(n), qm = () => !0, dv = (n) => (
  // `colorFunctionRegex` check is necessary because color functions can have percentages in them which which would be incorrectly classified as lengths.
  // For example, `hsl(0 0% 0%)` would be classified as a length without this check.
  // I could also use lookbehind assertion in `lengthUnitRegex` but that isn't supported widely enough.
  ov.test(n) && !sv.test(n)
), Ws = () => !1, fv = (n) => cv.test(n), mv = (n) => uv.test(n), pv = (n) => !it(n) && !rt(n), hv = (n) => n.startsWith("@container") && (n[10] === "/" && n[11] !== void 0 || n[11] === "s" && n[16] !== void 0 && n.startsWith("-size/", 10) || n[11] === "n" && n[18] !== void 0 && n.startsWith("-normal/", 10)), gv = (n) => Ln(n, Lm, Ws), it = (n) => Hm.test(n), ca = (n) => Ln(n, Vm, dv), Bf = (n) => Ln(n, Sv, yt), bv = (n) => Ln(n, Km, qm), vv = (n) => Ln(n, Qm, Ws), Hf = (n) => Ln(n, Gm, Ws), yv = (n) => Ln(n, Ym, mv), Vi = (n) => Ln(n, Xm, fv), rt = (n) => Um.test(n), El = (n) => fa(n, Vm), xv = (n) => fa(n, Qm), Uf = (n) => fa(n, Gm), wv = (n) => fa(n, Lm), _v = (n) => fa(n, Ym), Qi = (n) => fa(n, Xm, !0), kv = (n) => fa(n, Km, !0), Ln = (n, a, i) => {
  const o = Hm.exec(n);
  return o ? o[1] ? a(o[1]) : i(o[2]) : !1;
}, fa = (n, a, i = !1) => {
  const o = Um.exec(n);
  return o ? o[1] ? a(o[1]) : i : !1;
}, Gm = (n) => n === "position" || n === "percentage", Ym = (n) => n === "image" || n === "url", Lm = (n) => n === "length" || n === "size" || n === "bg-size", Vm = (n) => n === "length", Sv = (n) => n === "number", Qm = (n) => n === "family-name", Km = (n) => n === "number" || n === "weight", Xm = (n) => n === "shadow", Ev = () => {
  const n = Ft("color"), a = Ft("font"), i = Ft("text"), o = Ft("font-weight"), s = Ft("tracking"), u = Ft("leading"), m = Ft("breakpoint"), f = Ft("container"), p = Ft("spacing"), v = Ft("radius"), x = Ft("shadow"), y = Ft("inset-shadow"), b = Ft("text-shadow"), S = Ft("drop-shadow"), T = Ft("blur"), E = Ft("perspective"), N = Ft("aspect"), j = Ft("ease"), R = Ft("animate"), U = () => ["auto", "avoid", "all", "avoid-page", "page", "left", "right", "column"], F = () => [
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
  ], W = () => [...F(), rt, it], B = () => ["auto", "hidden", "clip", "visible", "scroll"], g = () => ["auto", "contain", "none"], h = () => [rt, it, p], _ = () => [Dn, "full", "auto", ...h()], k = () => [Fe, "none", "subgrid", rt, it], z = () => ["auto", {
    span: ["full", Fe, rt, it]
  }, Fe, rt, it], O = () => [Fe, "auto", rt, it], M = () => ["auto", "min", "max", "fr", rt, it], Y = () => ["start", "end", "center", "between", "around", "evenly", "stretch", "baseline", "center-safe", "end-safe"], Z = () => ["start", "end", "center", "stretch", "center-safe", "end-safe"], D = () => ["auto", ...h()], Q = () => [Dn, "auto", "full", "dvw", "dvh", "lvw", "lvh", "svw", "svh", "min", "max", "fit", ...h()], I = () => [f, Dn, "screen", "full", "dvw", "lvw", "svw", "min", "max", "fit", ...h()], G = () => [Dn, "screen", "full", "lh", "dvh", "lvh", "svh", "min", "max", "fit", ...h()], K = () => [n, rt, it], C = () => [...F(), Uf, Hf, {
    position: [rt, it]
  }], J = () => ["no-repeat", {
    repeat: ["", "x", "y", "space", "round"]
  }], at = () => ["auto", "cover", "contain", wv, gv, {
    size: [rt, it]
  }], st = () => [ms, El, ca], ct = () => [
    // Deprecated since Tailwind CSS v4.0.0
    "",
    "none",
    "full",
    v,
    rt,
    it
  ], ut = () => ["", yt, El, ca], Et = () => ["solid", "dashed", "dotted", "double"], $t = () => ["normal", "multiply", "screen", "overlay", "darken", "lighten", "color-dodge", "color-burn", "hard-light", "soft-light", "difference", "exclusion", "hue", "saturation", "color", "luminosity"], ht = () => [yt, ms, Uf, Hf], Qn = () => [
    // Deprecated since Tailwind CSS v4.0.0
    "",
    "none",
    T,
    rt,
    it
  ], Kn = () => ["none", yt, rt, it], De = () => ["none", yt, rt, it], Be = () => [yt, rt, it], gn = () => [Dn, "full", ...h()];
  return {
    cacheSize: 500,
    theme: {
      animate: ["spin", "ping", "pulse", "bounce"],
      aspect: ["video"],
      blur: [pn],
      breakpoint: [pn],
      color: [qm],
      container: [pn],
      "drop-shadow": [pn],
      ease: ["in", "out", "in-out"],
      font: [pv],
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
        aspect: ["auto", "square", Dn, it, rt, N]
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
        "@container": ["", "normal", "size", rt, it]
      }],
      /**
       * Container Name
       * @see https://tailwindcss.com/docs/responsive-design#named-containers
       */
      "container-named": [hv],
      /**
       * Columns
       * @see https://tailwindcss.com/docs/columns
       */
      columns: [{
        columns: [yt, "auto", it, rt, f]
      }],
      /**
       * Break After
       * @see https://tailwindcss.com/docs/break-after
       */
      "break-after": [{
        "break-after": U()
      }],
      /**
       * Break Before
       * @see https://tailwindcss.com/docs/break-before
       */
      "break-before": [{
        "break-before": U()
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
        overflow: B()
      }],
      /**
       * Overflow X
       * @see https://tailwindcss.com/docs/overflow
       */
      "overflow-x": [{
        "overflow-x": B()
      }],
      /**
       * Overflow Y
       * @see https://tailwindcss.com/docs/overflow
       */
      "overflow-y": [{
        "overflow-y": B()
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
        z: [Fe, "auto", rt, it]
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
        flex: [yt, Dn, "auto", "initial", "none", it]
      }],
      /**
       * Flex Grow
       * @see https://tailwindcss.com/docs/flex-grow
       */
      grow: [{
        grow: ["", yt, rt, it]
      }],
      /**
       * Flex Shrink
       * @see https://tailwindcss.com/docs/flex-shrink
       */
      shrink: [{
        shrink: ["", yt, rt, it]
      }],
      /**
       * Order
       * @see https://tailwindcss.com/docs/order
       */
      order: [{
        order: [Fe, "first", "last", "none", rt, it]
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
        col: z()
      }],
      /**
       * Grid Column Start
       * @see https://tailwindcss.com/docs/grid-column
       */
      "col-start": [{
        "col-start": O()
      }],
      /**
       * Grid Column End
       * @see https://tailwindcss.com/docs/grid-column
       */
      "col-end": [{
        "col-end": O()
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
        row: z()
      }],
      /**
       * Grid Row Start
       * @see https://tailwindcss.com/docs/grid-row
       */
      "row-start": [{
        "row-start": O()
      }],
      /**
       * Grid Row End
       * @see https://tailwindcss.com/docs/grid-row
       */
      "row-end": [{
        "row-end": O()
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
        "auto-cols": M()
      }],
      /**
       * Grid Auto Rows
       * @see https://tailwindcss.com/docs/grid-auto-rows
       */
      "auto-rows": [{
        "auto-rows": M()
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
        justify: [...Y(), "normal"]
      }],
      /**
       * Justify Items
       * @see https://tailwindcss.com/docs/justify-items
       */
      "justify-items": [{
        "justify-items": [...Z(), "normal"]
      }],
      /**
       * Justify Self
       * @see https://tailwindcss.com/docs/justify-self
       */
      "justify-self": [{
        "justify-self": ["auto", ...Z()]
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
        items: [...Z(), {
          baseline: ["", "last"]
        }]
      }],
      /**
       * Align Self
       * @see https://tailwindcss.com/docs/align-self
       */
      "align-self": [{
        self: ["auto", ...Z(), {
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
        "place-items": [...Z(), "baseline"]
      }],
      /**
       * Place Self
       * @see https://tailwindcss.com/docs/place-self
       */
      "place-self": [{
        "place-self": ["auto", ...Z()]
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
        m: D()
      }],
      /**
       * Margin Inline
       * @see https://tailwindcss.com/docs/margin
       */
      mx: [{
        mx: D()
      }],
      /**
       * Margin Block
       * @see https://tailwindcss.com/docs/margin
       */
      my: [{
        my: D()
      }],
      /**
       * Margin Inline Start
       * @see https://tailwindcss.com/docs/margin
       */
      ms: [{
        ms: D()
      }],
      /**
       * Margin Inline End
       * @see https://tailwindcss.com/docs/margin
       */
      me: [{
        me: D()
      }],
      /**
       * Margin Block Start
       * @see https://tailwindcss.com/docs/margin
       */
      mbs: [{
        mbs: D()
      }],
      /**
       * Margin Block End
       * @see https://tailwindcss.com/docs/margin
       */
      mbe: [{
        mbe: D()
      }],
      /**
       * Margin Top
       * @see https://tailwindcss.com/docs/margin
       */
      mt: [{
        mt: D()
      }],
      /**
       * Margin Right
       * @see https://tailwindcss.com/docs/margin
       */
      mr: [{
        mr: D()
      }],
      /**
       * Margin Bottom
       * @see https://tailwindcss.com/docs/margin
       */
      mb: [{
        mb: D()
      }],
      /**
       * Margin Left
       * @see https://tailwindcss.com/docs/margin
       */
      ml: [{
        ml: D()
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
        size: Q()
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
        block: ["auto", ...G()]
      }],
      /**
       * Min-Block Size
       * @see https://tailwindcss.com/docs/min-block-size
       */
      "min-block-size": [{
        "min-block": ["auto", ...G()]
      }],
      /**
       * Max-Block Size
       * @see https://tailwindcss.com/docs/max-block-size
       */
      "max-block-size": [{
        "max-block": ["none", ...G()]
      }],
      /**
       * Width
       * @see https://tailwindcss.com/docs/width
       */
      w: [{
        w: [f, "screen", ...Q()]
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
          ...Q()
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
          ...Q()
        ]
      }],
      /**
       * Height
       * @see https://tailwindcss.com/docs/height
       */
      h: [{
        h: ["screen", "lh", ...Q()]
      }],
      /**
       * Min-Height
       * @see https://tailwindcss.com/docs/min-height
       */
      "min-h": [{
        "min-h": ["screen", "lh", "none", ...Q()]
      }],
      /**
       * Max-Height
       * @see https://tailwindcss.com/docs/max-height
       */
      "max-h": [{
        "max-h": ["screen", "lh", "none", ...Q()]
      }],
      // ------------------
      // --- Typography ---
      // ------------------
      /**
       * Font Size
       * @see https://tailwindcss.com/docs/font-size
       */
      "font-size": [{
        text: ["base", i, El, ca]
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
        font: [o, kv, bv]
      }],
      /**
       * Font Stretch
       * @see https://tailwindcss.com/docs/font-stretch
       */
      "font-stretch": [{
        "font-stretch": ["ultra-condensed", "extra-condensed", "condensed", "semi-condensed", "normal", "semi-expanded", "expanded", "extra-expanded", "ultra-expanded", ms, it]
      }],
      /**
       * Font Family
       * @see https://tailwindcss.com/docs/font-family
       */
      "font-family": [{
        font: [xv, vv, a]
      }],
      /**
       * Font Feature Settings
       * @see https://tailwindcss.com/docs/font-feature-settings
       */
      "font-features": [{
        "font-features": [it]
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
        tracking: [s, rt, it]
      }],
      /**
       * Line Clamp
       * @see https://tailwindcss.com/docs/line-clamp
       */
      "line-clamp": [{
        "line-clamp": [yt, "none", rt, Bf]
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
        "list-image": ["none", rt, it]
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
        list: ["disc", "decimal", "none", rt, it]
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
        decoration: [yt, "from-font", "auto", rt, ca]
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
        "underline-offset": [yt, "auto", rt, it]
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
        tab: [Fe, rt, it]
      }],
      /**
       * Vertical Alignment
       * @see https://tailwindcss.com/docs/vertical-align
       */
      "vertical-align": [{
        align: ["baseline", "top", "middle", "bottom", "text-top", "text-bottom", "sub", "super", rt, it]
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
        content: ["none", rt, it]
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
          }, Fe, rt, it],
          radial: ["", rt, it],
          conic: ["", Fe, rt, it]
        }, _v, yv]
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
        "outline-offset": [yt, rt, it]
      }],
      /**
       * Outline Width
       * @see https://tailwindcss.com/docs/outline-width
       */
      "outline-w": [{
        outline: ["", yt, El, ca]
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
          x,
          Qi,
          Vi
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
        "inset-shadow": ["none", y, Qi, Vi]
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
        "text-shadow": ["none", b, Qi, Vi]
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
        opacity: [yt, rt, it]
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
        "mask-radial": [rt, it]
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
        "mask-radial-at": F()
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
        mask: J()
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
        mask: ["none", rt, it]
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
          it
        ]
      }],
      /**
       * Blur
       * @see https://tailwindcss.com/docs/blur
       */
      blur: [{
        blur: Qn()
      }],
      /**
       * Brightness
       * @see https://tailwindcss.com/docs/brightness
       */
      brightness: [{
        brightness: [yt, rt, it]
      }],
      /**
       * Contrast
       * @see https://tailwindcss.com/docs/contrast
       */
      contrast: [{
        contrast: [yt, rt, it]
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
          Qi,
          Vi
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
        grayscale: ["", yt, rt, it]
      }],
      /**
       * Hue Rotate
       * @see https://tailwindcss.com/docs/hue-rotate
       */
      "hue-rotate": [{
        "hue-rotate": [yt, rt, it]
      }],
      /**
       * Invert
       * @see https://tailwindcss.com/docs/invert
       */
      invert: [{
        invert: ["", yt, rt, it]
      }],
      /**
       * Saturate
       * @see https://tailwindcss.com/docs/saturate
       */
      saturate: [{
        saturate: [yt, rt, it]
      }],
      /**
       * Sepia
       * @see https://tailwindcss.com/docs/sepia
       */
      sepia: [{
        sepia: ["", yt, rt, it]
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
          it
        ]
      }],
      /**
       * Backdrop Blur
       * @see https://tailwindcss.com/docs/backdrop-blur
       */
      "backdrop-blur": [{
        "backdrop-blur": Qn()
      }],
      /**
       * Backdrop Brightness
       * @see https://tailwindcss.com/docs/backdrop-brightness
       */
      "backdrop-brightness": [{
        "backdrop-brightness": [yt, rt, it]
      }],
      /**
       * Backdrop Contrast
       * @see https://tailwindcss.com/docs/backdrop-contrast
       */
      "backdrop-contrast": [{
        "backdrop-contrast": [yt, rt, it]
      }],
      /**
       * Backdrop Grayscale
       * @see https://tailwindcss.com/docs/backdrop-grayscale
       */
      "backdrop-grayscale": [{
        "backdrop-grayscale": ["", yt, rt, it]
      }],
      /**
       * Backdrop Hue Rotate
       * @see https://tailwindcss.com/docs/backdrop-hue-rotate
       */
      "backdrop-hue-rotate": [{
        "backdrop-hue-rotate": [yt, rt, it]
      }],
      /**
       * Backdrop Invert
       * @see https://tailwindcss.com/docs/backdrop-invert
       */
      "backdrop-invert": [{
        "backdrop-invert": ["", yt, rt, it]
      }],
      /**
       * Backdrop Opacity
       * @see https://tailwindcss.com/docs/backdrop-opacity
       */
      "backdrop-opacity": [{
        "backdrop-opacity": [yt, rt, it]
      }],
      /**
       * Backdrop Saturate
       * @see https://tailwindcss.com/docs/backdrop-saturate
       */
      "backdrop-saturate": [{
        "backdrop-saturate": [yt, rt, it]
      }],
      /**
       * Backdrop Sepia
       * @see https://tailwindcss.com/docs/backdrop-sepia
       */
      "backdrop-sepia": [{
        "backdrop-sepia": ["", yt, rt, it]
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
        transition: ["", "all", "colors", "opacity", "shadow", "transform", "none", rt, it]
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
        duration: [yt, "initial", rt, it]
      }],
      /**
       * Transition Timing Function
       * @see https://tailwindcss.com/docs/transition-timing-function
       */
      ease: [{
        ease: ["linear", "initial", j, rt, it]
      }],
      /**
       * Transition Delay
       * @see https://tailwindcss.com/docs/transition-delay
       */
      delay: [{
        delay: [yt, rt, it]
      }],
      /**
       * Animation
       * @see https://tailwindcss.com/docs/animation
       */
      animate: [{
        animate: ["none", R, rt, it]
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
        perspective: [E, rt, it]
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
        skew: Be()
      }],
      /**
       * Skew X
       * @see https://tailwindcss.com/docs/skew
       */
      "skew-x": [{
        "skew-x": Be()
      }],
      /**
       * Skew Y
       * @see https://tailwindcss.com/docs/skew
       */
      "skew-y": [{
        "skew-y": Be()
      }],
      /**
       * Transform
       * @see https://tailwindcss.com/docs/transform
       */
      transform: [{
        transform: [rt, it, "", "none", "gpu", "cpu"]
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
        zoom: [Fe, rt, it]
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
        cursor: ["auto", "default", "pointer", "wait", "text", "move", "help", "not-allowed", "none", "context-menu", "progress", "cell", "crosshair", "vertical-text", "alias", "copy", "no-drop", "grab", "grabbing", "all-scroll", "col-resize", "row-resize", "n-resize", "e-resize", "s-resize", "w-resize", "ne-resize", "nw-resize", "se-resize", "sw-resize", "ew-resize", "ns-resize", "nesw-resize", "nwse-resize", "zoom-in", "zoom-out", rt, it]
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
        "will-change": ["auto", "scroll", "contents", "transform", rt, it]
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
        stroke: [yt, El, ca, Bf]
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
}, zv = /* @__PURE__ */ av(Ev);
function jt(...n) {
  return zv(jm(n));
}
function Nv(n, a, i) {
  return n.filter((o, s) => s !== a && (o.start + o.end) / 2 < i).length;
}
function Tv(n, a, i, o) {
  const s = n.map(() => 0), u = n[a];
  if (!u) return s;
  const m = n[a + 1], f = n[a - 1], p = u.end - u.start + (m ? m.start - u.end : f ? u.start - f.end : 0);
  return n.forEach((v, x) => {
    a < i && x > a && x <= i ? s[x] = -p : i < a && x >= i && x < a && (s[x] = p);
  }), s[a] = Math.min(Math.max(o, n[0].start - u.start), n[n.length - 1].end - u.end), s;
}
const qf = ["transform", "transition", "zIndex", "filter", "pointerEvents", "position"];
function Cv(n, a) {
  for (let i = n.parentElement; i; i = i.parentElement) {
    const o = getComputedStyle(i)[a === "x" ? "overflowX" : "overflowY"];
    if ((o === "auto" || o === "scroll") && (a === "x" ? i.scrollWidth > i.clientWidth : i.scrollHeight > i.clientHeight)) return i;
  }
  return null;
}
function Mv(n, a, i, o) {
  const s = n[a] ? Cv(n[a], i) : null, u = () => s ? i === "x" ? s.scrollLeft : s.scrollTop : 0, m = (N) => (i === "x" ? N.clientX : N.clientY) + u(), f = m(o), p = u(), v = n.map((N) => {
    const j = N.getBoundingClientRect();
    return i === "x" ? { start: j.left + p, end: j.right + p } : { start: j.top + p, end: j.bottom + p };
  }), x = n.map((N) => qf.map((j) => N.style[j])), y = typeof matchMedia == "function" && matchMedia("(prefers-reduced-motion: reduce)").matches, b = i === "x" ? "translateX" : "translateY";
  let S = !1;
  const T = { to: a };
  n.forEach((N, j) => {
    if (N.style.pointerEvents = "none", j !== a) {
      y || (N.style.transition = "transform 160ms cubic-bezier(0.2, 0.8, 0.2, 1)");
      return;
    }
    getComputedStyle(N).position === "static" && (N.style.position = "relative"), N.style.zIndex = "30", N.style.filter = "drop-shadow(0 6px 10px rgba(0, 0, 0, 0.45))";
  });
  const E = (N, j) => {
    T.to = N, Tv(v, a, N, j).forEach((R, U) => {
      n[U].style.transform = R ? `${b}(${R}px)` : "";
    });
  };
  return {
    from: a,
    get to() {
      return T.to;
    },
    slot: (N) => Nv(v, a, m(N)),
    apply: (N, j) => {
      S || E(N, m(j) - f);
    },
    rest: () => {
      S || E(a, 0);
    },
    end: () => {
      S || (S = !0, n.forEach((N, j) => qf.forEach((R, U) => {
        N.style[R] = x[j][U];
      })));
    }
  };
}
const Av = 5;
let ps = !1;
function jv(n, a) {
  if (n.button !== 0 || ps) return;
  const i = { clientX: n.clientX, clientY: n.clientY }, o = n.currentTarget, s = n.pointerId;
  let u = null, m, f = !1;
  const p = { cursor: document.body.style.cursor, userSelect: document.body.style.userSelect }, v = (T) => {
    if (f) return;
    f = !0, window.removeEventListener("pointermove", x), window.removeEventListener("pointerup", y), window.removeEventListener("pointercancel", b), window.removeEventListener("keydown", S, !0), window.removeEventListener("blur", b), o.removeEventListener("lostpointercapture", b);
    try {
      o.releasePointerCapture(s);
    } catch {
    }
    if (!u) return;
    ps = !1, document.body.style.cursor = p.cursor, document.body.style.userSelect = p.userSelect, u.end();
    const E = (N) => N.stopPropagation();
    window.addEventListener("click", E, { capture: !0, once: !0 }), setTimeout(() => window.removeEventListener("click", E, !0), 0), m?.(), a.onEnd(T, u);
  }, x = (T) => {
    if (!u) {
      if (Math.hypot(T.clientX - i.clientX, T.clientY - i.clientY) < Av) return;
      const E = a.items();
      u = Mv(E, a.from(E), a.axis, i), ps = !0, document.body.style.cursor = "grabbing", document.body.style.userSelect = "none";
      try {
        o.setPointerCapture(s);
      } catch {
      }
      o.addEventListener("lostpointercapture", b);
      const N = a.onStart?.();
      m = typeof N == "function" ? N : void 0;
    }
    a.onMove(T, u);
  }, y = () => v(!0), b = () => v(!1), S = (T) => {
    T.key === "Escape" && (T.stopPropagation(), v(!1));
  };
  window.addEventListener("pointermove", x), window.addEventListener("pointerup", y), window.addEventListener("pointercancel", b), window.addEventListener("keydown", S, !0), window.addEventListener("blur", b);
}
const Zm = typeof navigator < "u" && /Mac/i.test(navigator.platform), fr = {
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
for (let n = 1; n <= 12; n++) fr[`f${n}`] = `F${n}`;
const Ov = Object.fromEntries(Object.entries(fr).map(([n, a]) => [a, n])), Rv = {
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
function Dv(n) {
  const a = /^Key([A-Z])$/.exec(n) ?? /^Digit(\d)$/.exec(n);
  return a ? a[1].toLowerCase() : Ov[n];
}
const Gf = /* @__PURE__ */ new Map();
function Jm(n, a = Zm) {
  const i = `${a}|${n}`, o = Gf.get(i);
  if (o) return o;
  const s = { cmd: !1, ctrl: !1, shift: !1, alt: !1, code: "" };
  for (const u of n.split("+"))
    if (u === "mod")
      a ? s.cmd = !0 : (s.ctrl = !0, s.shift = !0);
    else if (u === "cmd" || u === "ctrl" || u === "shift" || u === "alt") s[u] = !0;
    else if (/^[a-z]$/.test(u))
      s.code = `Key${u.toUpperCase()}`, s.letter = u;
    else if (/^[0-9]$/.test(u)) s.code = `Digit${u}`;
    else if (fr[u]) s.code = fr[u];
    else throw new Error(`unknown key "${u}" in "${n}"`);
  if (!s.code) throw new Error(`no key in "${n}"`);
  return Gf.set(i, s), s;
}
new Set(["cmd+q", "cmd+h", "cmd+alt+h", "cmd+m", "cmd+ctrl+f", "cmd+z", "cmd+shift+z", "cmd+x", "cmd+c", "cmd+v", "cmd+a"].map((n) => {
  const a = Jm(n, !0);
  return [a.cmd && "cmd", a.ctrl && "ctrl", a.alt && "alt", a.shift && "shift", a.code].filter(Boolean).join("+");
}));
function Bv(n, a = Zm) {
  const i = Jm(n, a), o = Hv(Dv(i.code) ?? "");
  return a ? `${i.ctrl ? "⌃" : ""}${i.alt ? "⌥" : ""}${i.shift ? "⇧" : ""}${i.cmd ? "⌘" : ""}${o}` : [i.ctrl && "Ctrl", i.alt && "Alt", i.shift && "Shift", o].filter(Boolean).join("+");
}
const Hv = (n) => Rv[n] ?? n.toUpperCase(), Yf = (n) => typeof n == "boolean" ? `${n}` : n === 0 ? "0" : n, Lf = jm, vr = (n, a) => (i) => {
  var o;
  if (a?.variants == null) return Lf(n, i?.class, i?.className);
  const { variants: s, defaultVariants: u } = a, m = Object.keys(s).map((v) => {
    const x = i?.[v], y = u?.[v];
    if (x === null) return null;
    const b = Yf(x) || Yf(y);
    return s[v][b];
  }), f = i && Object.entries(i).reduce((v, x) => {
    let [y, b] = x;
    return b === void 0 || (v[y] = b), v;
  }, {}), p = a == null || (o = a.compoundVariants) === null || o === void 0 ? void 0 : o.reduce((v, x) => {
    let { class: y, className: b, ...S } = x;
    return Object.entries(S).every((T) => {
      let [E, N] = T;
      return Array.isArray(N) ? N.includes({
        ...u,
        ...f
      }[E]) : {
        ...u,
        ...f
      }[E] === N;
    }) ? [
      ...v,
      y,
      b
    ] : v;
  }, []);
  return Lf(n, m, p, i?.class, i?.className);
}, Uv = vr(
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
), qv = vr(
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
function Gv({ className: n, ...a } = {}) {
  return jt(qv(a), n);
}
const Wm = "shrink-0 cursor-pointer rounded-ui bg-transparent px-[0.2rem] py-[0.1rem] text-[0.8rem] leading-none text-subtext-0 [font-family:inherit] [border:none] [transition:color_0.1s_ease,background_0.1s_ease] hover:bg-surface-1 hover:text-accent", Ul = "cursor-pointer rounded-ui bg-transparent text-subtext-0 [border:0] [font-family:inherit] [transition:color_0.1s_ease,background_0.1s_ease] hover:bg-surface-1 hover:text-fg focus-visible:bg-surface-1 focus-visible:text-fg disabled:cursor-not-allowed disabled:opacity-40", Yv = vr(`${Ul} shrink-0 focus-visible:[outline:2px_solid_var(--accent)] focus-visible:[outline-offset:-2px]`, {
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
function Lv({ className: n, ...a } = {}) {
  return jt(Yv(a), n);
}
const yr = "overflow-hidden rounded-ui bg-surface-1 py-[0.3rem] shadow-[0_8px_24px_rgba(0,0,0,0.45)]", js = vr(
  "pane-context-menu__item block w-full cursor-pointer bg-transparent px-[0.9rem] py-[0.45rem] text-left text-[0.82rem] [border:none] [font-family:inherit] [transition:background_0.1s_ease] hover:bg-surface-0 disabled:cursor-not-allowed disabled:bg-transparent disabled:opacity-40",
  { variants: { danger: { true: "text-red", false: "text-fg" } }, defaultVariants: { danger: !1 } }
), Vv = "my-1 h-px bg-overlay-0";
function Qv({ size: n = 14, className: a }) {
  return /* @__PURE__ */ et.jsxs("svg", { className: a, width: n, height: n, viewBox: "0 0 16 16", fill: "currentColor", "aria-hidden": "true", children: [
    /* @__PURE__ */ et.jsx("circle", { cx: "3.5", cy: "8", r: "1.1" }),
    /* @__PURE__ */ et.jsx("circle", { cx: "8", cy: "8", r: "1.1" }),
    /* @__PURE__ */ et.jsx("circle", { cx: "12.5", cy: "8", r: "1.1" })
  ] });
}
function Kv({ size: n = 16, className: a }) {
  return /* @__PURE__ */ et.jsxs("svg", { className: a, width: n, height: n, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: "1.3", strokeLinejoin: "round", "aria-hidden": "true", children: [
    /* @__PURE__ */ et.jsx("path", { d: "M6.6 1.8h2.8l.4 1.6 1.1.6 1.5-.6 1.4 2.4-1.2 1.1v1.3l1.2 1.1-1.4 2.4-1.5-.6-1.1.6-.4 1.6H6.6l-.4-1.6-1.1-.6-1.5.6-1.4-2.4 1.2-1.1V7.3L2.2 6.2l1.4-2.4 1.5.6 1.1-.6z" }),
    /* @__PURE__ */ et.jsx("circle", { cx: "8", cy: "8", r: "2" })
  ] });
}
function Xv({ size: n = 14, className: a }) {
  return /* @__PURE__ */ et.jsx("svg", { className: a, width: n, height: n, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round", "aria-hidden": "true", children: /* @__PURE__ */ et.jsx("path", { d: "M3.5 3.5l9 9M12.5 3.5l-9 9" }) });
}
function Fm({ size: n = 14, className: a }) {
  return /* @__PURE__ */ et.jsx("svg", { className: a, width: n, height: n, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round", "aria-hidden": "true", children: /* @__PURE__ */ et.jsx("path", { d: "M8 2.5v11M2.5 8h11" }) });
}
const Vf = {
  connected: "host-state--connected bg-accent",
  connecting: "host-state--connecting animate-host-pulse bg-yellow",
  error: "host-state--error bg-red",
  disabled: "host-state--disabled bg-subtext-0"
};
function Zv({ state: n, error: a }) {
  return /* @__PURE__ */ et.jsx(
    "span",
    {
      className: jt("host-state inline-block h-2 w-2 shrink-0 rounded-[50%]", Vf[n] ?? Vf.disabled),
      title: n === "error" && a ? a : n
    }
  );
}
function Jv({ title: n, onClose: a, children: i, testId: o }) {
  return Hl(
    /* @__PURE__ */ et.jsx(
      "div",
      {
        className: "fixed inset-0 z-[2100] flex items-center justify-center bg-[rgba(0,0,0,0.55)]",
        onMouseDown: (s) => {
          s.target === s.currentTarget && a();
        },
        onKeyDown: (s) => {
          s.key === "Escape" && a();
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
const Ii = 2e5;
function Wv(n) {
  if (n.length <= Ii) return { source: n, truncated: !1 };
  const a = n.lastIndexOf(`
`, Ii);
  return { source: n.slice(0, a > 0 ? a : Ii), truncated: !0 };
}
const Ki = 4, Bn = 8, Fv = "flex w-full cursor-pointer items-center justify-between gap-3 px-[0.9rem] py-[0.4rem] text-left text-[0.82rem] text-fg max-[700px]:min-h-11 aria-disabled:cursor-not-allowed aria-disabled:opacity-40", Qf = (n) => n.text ?? (typeof n.label == "string" ? n.label : n.value);
function $v({ value: n, onChange: a, options: i, className: o, ariaLabel: s, testId: u, id: m, title: f, disabled: p, placeholder: v, freeText: x, onKeyDown: y }) {
  const b = X.useId(), [S, T] = X.useState(!1), [E, N] = X.useState(-1), [j, R] = X.useState(!1), U = X.useRef(null), F = X.useRef(null), [W, B] = X.useState({}), g = X.useRef({ text: "", at: 0 }), h = x && j && n ? i.filter((G) => Qf(G).toLowerCase().includes(n.toLowerCase()) || G.value.toLowerCase().includes(n.toLowerCase())) : i, _ = i.find((G) => G.value === n), k = (G) => `${b}-${G}`;
  function z(G) {
    p || (N(G), T(!0));
  }
  function O() {
    T(!1), R(!1), N(-1);
  }
  function M(G) {
    !G || G.disabled || (a(G.value), O());
  }
  function Y(G, K) {
    for (let C = 1; C <= h.length; C++) {
      const J = (G + K * C + h.length * C) % h.length;
      if (!h[J].disabled) return J;
    }
    return G;
  }
  const Z = () => h.findIndex((G) => !G.disabled), D = () => h.length - 1 - [...h].reverse().findIndex((G) => !G.disabled);
  Ol(() => {
    if (!S || !U.current) {
      B((at) => at.left === void 0 ? at : {});
      return;
    }
    const G = U.current.getBoundingClientRect(), K = window.innerHeight - G.bottom - Ki - Bn, C = G.top - Ki - Bn, J = K < 160 && C > K;
    B({
      position: "fixed",
      left: Math.min(Math.max(Bn, G.left), Math.max(Bn, window.innerWidth - G.width - Bn)),
      // As wide as its longest label (a session title, a path), never wider than the window.
      width: "max-content",
      minWidth: G.width,
      maxWidth: window.innerWidth - 2 * Bn,
      maxHeight: Math.min(J ? C : K, 320),
      ...J ? { bottom: window.innerHeight - G.top + Ki } : { top: G.bottom + Ki },
      overflowY: "auto"
    });
  }, [S, h.length]), Ol(() => {
    const G = F.current;
    if (!S || !G || W.left === void 0) return;
    const K = G.getBoundingClientRect().right, C = window.innerWidth - Bn;
    K > C && B((J) => ({ ...J, left: Math.max(Bn, Number(J.left) - (K - C)) }));
  }, [S, W]), Lt(() => {
    if (!S) return;
    const G = (K) => {
      const C = K.target;
      (C === document || C instanceof Node && U.current && C.contains(U.current)) && O();
    };
    return window.addEventListener("resize", O), window.addEventListener("scroll", G, !0), () => {
      window.removeEventListener("resize", O), window.removeEventListener("scroll", G, !0);
    };
  }, [S]), Lt(() => {
    const G = S && E >= 0 ? document.getElementById(k(E)) : null, K = F.current;
    !G || !K || (G.offsetTop < K.scrollTop ? K.scrollTop = G.offsetTop : G.offsetTop + G.offsetHeight > K.scrollTop + K.clientHeight && (K.scrollTop = G.offsetTop + G.offsetHeight - K.clientHeight));
  }, [S, E]), Pm(S, (G) => {
    G || O();
  }, U, F);
  function Q(G) {
    if (G.nativeEvent.isComposing) return;
    const K = () => {
      G.preventDefault(), G.stopPropagation();
    }, { key: C } = G;
    if (S) {
      if (C === "Escape") {
        K(), O();
        return;
      } else if (C === "Tab")
        O();
      else if (C === "ArrowDown" || C === "ArrowUp") {
        K(), h.length && N(E < 0 ? C === "ArrowDown" ? Z() : D() : Y(E, C === "ArrowDown" ? 1 : -1));
        return;
      } else if (C === "Home" && !x) {
        K(), N(Z());
        return;
      } else if (C === "End" && !x) {
        K(), N(D());
        return;
      } else if (C === "Enter" || C === " " && !x) {
        if (E >= 0 && h[E]) {
          K(), M(h[E]);
          return;
        }
        if (!x) {
          K(), O();
          return;
        }
      } else if (!x && C.length === 1 && !G.metaKey && !G.ctrlKey && !G.altKey) {
        const J = Date.now();
        g.current = { text: (J - g.current.at > 600 ? "" : g.current.text) + C.toLowerCase(), at: J };
        const at = Math.max(E, 0), st = [...h.slice(at + (g.current.text.length === 1 ? 1 : 0)), ...h.slice(0, at + 1)].find((ct) => !ct.disabled && Qf(ct).toLowerCase().startsWith(g.current.text));
        st && (K(), N(h.indexOf(st)));
        return;
      }
    } else if (C === "ArrowDown" || C === "ArrowUp" || !x && (C === "Enter" || C === " ")) {
      K(), z(Math.max(0, h.findIndex((J) => J.value === n)));
      return;
    }
    y?.(G);
  }
  const I = {
    ref: (G) => {
      U.current = G;
    },
    id: m,
    title: f,
    disabled: p,
    "aria-label": s,
    "aria-expanded": S,
    "aria-controls": S ? b : void 0,
    "aria-activedescendant": S && E >= 0 ? k(E) : void 0,
    "data-testid": u,
    onKeyDown: Q
  };
  return /* @__PURE__ */ et.jsxs(et.Fragment, { children: [
    x ? /* @__PURE__ */ et.jsx(
      "input",
      {
        ...I,
        type: "text",
        role: "combobox",
        "aria-autocomplete": "list",
        autoComplete: "off",
        placeholder: v,
        className: o,
        value: n,
        onChange: (G) => {
          a(G.target.value), R(!0), S ? N(-1) : (N(-1), T(!0));
        },
        onBlur: () => O()
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
        onClick: () => S ? O() : z(Math.max(0, h.findIndex((G) => G.value === n))),
        children: [
          /* @__PURE__ */ et.jsx("span", { className: "min-w-0 flex-1 truncate", children: _ ? _.label : v ?? "" }),
          /* @__PURE__ */ et.jsx(Is, { open: !0, className: "shrink-0 text-subtext-0" })
        ]
      }
    ),
    S && h.length > 0 && Hl(
      /* @__PURE__ */ et.jsx(
        "div",
        {
          ref: F,
          id: b,
          role: "listbox",
          "aria-label": s,
          className: jt("z-[9999]", yr),
          style: W,
          onMouseDown: (G) => {
            G.preventDefault(), G.stopPropagation();
          },
          onClick: (G) => G.stopPropagation(),
          children: h.map((G, K) => /* @__PURE__ */ et.jsxs(
            "div",
            {
              id: k(K),
              role: "option",
              "aria-selected": G.value === n,
              "aria-disabled": G.disabled || void 0,
              "data-value": G.value,
              className: jt(Fv, K === E && !G.disabled && "bg-surface-0"),
              onMouseEnter: () => {
                G.disabled || N(K);
              },
              onClick: () => M(G),
              children: [
                /* @__PURE__ */ et.jsx("span", { className: "min-w-0 truncate", children: G.label }),
                G.value === n && /* @__PURE__ */ et.jsx("span", { "aria-hidden": "true", className: "shrink-0 text-accent", children: "✓" })
              ]
            },
            G.value
          ))
        }
      ),
      document.body
    )
  ] });
}
const Kf = 230, Iv = 370;
function Pv({ x: n, y: a, readOnly: i, canUndo: o, canRedo: s, hasSelection: u, onClose: m, actions: f }) {
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
  const v = (b, S) => Bs(ip ? b : S), x = (b, S, T, E, N = !1) => /* @__PURE__ */ et.jsxs("button", { type: "button", className: jt(rp(), "flex items-center justify-between gap-6"), "data-testid": T, disabled: N, onClick: S, children: [
    /* @__PURE__ */ et.jsx("span", { children: b }),
    /* @__PURE__ */ et.jsx("span", { className: "text-[0.72rem] text-subtext-0", children: E })
  ] }), y = f.askAgent;
  return Hl(
    /* @__PURE__ */ et.jsxs(
      "div",
      {
        ref: p,
        className: yr,
        "data-testid": "editor-context-menu",
        style: {
          position: "fixed",
          top: Math.max(8, Math.min(a, window.innerHeight - Iv - 8)),
          left: Math.max(8, Math.min(n, window.innerWidth - Kf - 8)),
          zIndex: 9999,
          minWidth: Kf
        },
        onContextMenu: (b) => b.preventDefault(),
        children: [
          y && /* @__PURE__ */ et.jsxs(et.Fragment, { children: [
            x(u ? "Ask agent about selection…" : "Ask agent about file…", y, "editor-menu-ask-agent", ""),
            /* @__PURE__ */ et.jsx("div", { className: tr })
          ] }),
          x("Undo", f.undo, "editor-menu-undo", v("cmd+z", "ctrl+z"), i || !o),
          x("Redo", f.redo, "editor-menu-redo", v("cmd+shift+z", "ctrl+y"), i || !s),
          /* @__PURE__ */ et.jsx("div", { className: tr }),
          x("Cut", f.cut, "editor-menu-cut", v("cmd+x", "ctrl+x"), i || !u),
          x("Copy", f.copy, "editor-menu-copy", v("cmd+c", "ctrl+c"), !u),
          x("Paste", f.paste, "editor-menu-paste", v("cmd+v", "ctrl+v"), i),
          x("Select All", f.selectAll, "editor-menu-select-all", v("cmd+a", "ctrl+a")),
          /* @__PURE__ */ et.jsx("div", { className: tr }),
          x("Find…", f.find, "editor-menu-find", v("cmd+f", "ctrl+f")),
          !i && x("Replace…", f.replace, "editor-menu-replace", v("cmd+alt+f", "ctrl+h")),
          x("Go to Line…", f.gotoLine, "editor-menu-goto", Bs("ctrl+g"))
        ]
      }
    ),
    document.body
  );
}
const t1 = "box-border min-h-[44px] cursor-pointer rounded-ui bg-transparent px-[0.7rem] py-[0.45rem] text-subtext-0 no-underline [border:0] [font-family:inherit] [font-weight:inherit] [line-height:inherit] text-[0.85rem] hover:bg-surface-1 hover:text-fg focus-visible:[outline:2px_solid_var(--accent)] focus-visible:[outline-offset:2px] disabled:cursor-default disabled:opacity-[0.55]", e1 = "m-0 mt-[0.4rem] text-[0.78rem] text-subtext-0", n1 = "m-0 mb-2 text-[0.82rem] text-subtext-0", $m = "rounded-ui bg-surface-1 text-fg [font-family:inherit]", Fs = `${$m} px-2 py-[0.3rem] text-[0.8rem] max-[700px]:min-h-11 focus:[outline:1px_solid_var(--accent)]`, a1 = `${Fs} min-w-[5.5rem] shrink-0`, $s = `${$m} min-w-0 px-[0.55rem] py-[0.35rem] text-[0.82rem] max-[700px]:min-h-11 focus:[outline:1px_solid_var(--accent)]`, l1 = `${$s} flex-1 max-[700px]:flex-[1_1_100%]`, i1 = `${$s} w-20 flex-[0_0_5rem] max-[700px]:w-24 max-[700px]:flex-[1_1_6rem]`, r1 = `${$s} flex-[1_1_100%]`, o1 = "flex flex-wrap items-center gap-[0.4rem]", s1 = "m-0 mb-2 flex list-none flex-col gap-[0.3rem] p-0", c1 = "flex items-center gap-2 max-[700px]:flex-wrap rounded-ui bg-surface-1 px-2 py-[0.35rem] text-[0.82rem]", u1 = `settings-modal__host-row ${c1}`, d1 = "min-w-0 overflow-hidden font-semibold text-ellipsis whitespace-nowrap text-fg", f1 = "min-w-0 flex-1 max-[700px]:basis-full overflow-hidden text-[0.78rem] text-ellipsis whitespace-nowrap text-subtext-0", Im = "shrink-0 cursor-pointer rounded-ui px-[0.7rem] py-[0.35rem] max-[700px]:min-h-11 text-[0.82rem] font-semibold text-panel-bg [border:none] [font-family:inherit] [transition:opacity_0.12s_ease] hover:opacity-[0.85]", m1 = `${Im} bg-accent`, p1 = `${Im} ml-auto bg-red`;
function Is({ open: n, size: a = 12, className: i }) {
  return /* @__PURE__ */ et.jsx("svg", { className: i, width: a, height: a, viewBox: "0 0 12 12", fill: "none", stroke: "currentColor", strokeWidth: "1.3", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true", children: /* @__PURE__ */ et.jsx("path", { d: n ? "M2.5 4.5 6 8l3.5-3.5" : "M4.5 2.5 8 6l-3.5 3.5" }) });
}
function h1({ label: n, items: a, testId: i, side: o = "right", up: s = !1, maxHeight: u = 320 }) {
  const [m, f] = X.useState(!1), [p, v] = X.useState(!1), x = X.useRef(null), y = X.useRef(null), b = () => [...y.current?.querySelectorAll('[role="menuitem"]') ?? []];
  Lt(() => {
    m && p && (b()[0]?.focus(), v(!1));
  }, [m, p]);
  const S = () => {
    f(!0), v(!0);
  }, T = (N) => {
    (N.key === "ArrowRight" || N.key === "Enter" || N.key === " ") && (N.preventDefault(), S());
  }, E = (N) => {
    const j = b(), R = j.findIndex((U) => U === document.activeElement);
    N.key === "ArrowDown" || N.key === "ArrowUp" ? (N.preventDefault(), j[(R + (N.key === "ArrowDown" ? 1 : j.length - 1)) % j.length]?.focus()) : (N.key === "ArrowLeft" || N.key === "Escape") && (N.preventDefault(), N.stopPropagation(), f(!1), x.current?.focus());
  };
  return /* @__PURE__ */ et.jsxs("div", { className: "group/submenu relative", children: [
    /* @__PURE__ */ et.jsxs(
      "button",
      {
        ref: x,
        type: "button",
        role: "menuitem",
        "aria-haspopup": "menu",
        "aria-expanded": m,
        className: jt(js(), "flex items-center justify-between gap-2"),
        "data-testid": i,
        onClick: () => m ? f(!1) : S(),
        onKeyDown: T,
        children: [
          /* @__PURE__ */ et.jsx("span", { className: "truncate", children: n }),
          /* @__PURE__ */ et.jsx(Is, { open: !1, size: 10 })
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
          yr,
          "absolute z-10 w-60 overflow-y-auto",
          o === "right" ? "left-full" : "right-full",
          s ? "bottom-0" : "top-0",
          m ? "block" : "hidden group-hover/submenu:block"
        ),
        style: { maxHeight: u },
        onKeyDown: E,
        children: a.map((N) => /* @__PURE__ */ et.jsx("button", { type: "button", role: "menuitem", className: js(), "data-testid": N.testId, onClick: N.onSelect, children: /* @__PURE__ */ et.jsx("span", { className: "block truncate", children: N.label }) }, N.key))
      }
    )
  ] });
}
function g1(n) {
  return n.blocked && !n.stale ? "blocked" : n.status === "running" && !n.stale ? "working" : n.unseen ? "done" : "idle";
}
const Os = {
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
function Rs(n, a) {
  return !!n.parentSessionId && n.parentSessionId !== n.id && a.some((i) => i.id === n.parentSessionId);
}
function b1(n) {
  const a = /* @__PURE__ */ new Map();
  for (const i of n)
    Rs(i, n) && a.set(i.parentSessionId, [...a.get(i.parentSessionId) ?? [], i]);
  return a.size ? n.filter((i) => !Rs(i, n)).flatMap((i) => [i, ...a.get(i.id) ?? []]) : n;
}
const Xi = 6, Xf = 8;
function v1(n, a = {}) {
  const { minWidth: i = 220, align: o = "right", minSpaceAbove: s = 100 } = a, u = n.getBoundingClientRect(), m = window.innerWidth, f = window.innerHeight, p = o === "right" ? { right: Math.max(0, m - u.right) } : { left: Math.max(0, u.left) }, v = u.top - Xi - Xf, x = f - u.bottom - Xi - Xf;
  return v >= s ? {
    position: "fixed",
    bottom: f - u.top + Xi,
    ...p,
    minWidth: i,
    maxHeight: Math.min(v, f * 0.75),
    overflowY: "auto"
  } : {
    position: "fixed",
    top: u.bottom + Xi,
    ...p,
    minWidth: i,
    maxHeight: Math.min(x, f * 0.75),
    overflowY: "auto"
  };
}
function Pm(n, a, i, o) {
  Lt(() => {
    if (!n) return;
    function s(m) {
      const f = m.target, p = i.current?.contains(f) ?? !1, v = o.current?.contains(f) ?? !1;
      !p && !v && a(!1);
    }
    function u(m) {
      m.key === "Escape" && a(!1);
    }
    return document.addEventListener("mousedown", s), document.addEventListener("keydown", u), () => {
      document.removeEventListener("mousedown", s), document.removeEventListener("keydown", u);
    };
  }, [n]);
}
function y1({ icon: n, fallback: a }) {
  const [i, o] = X.useState(!1);
  return Lt(() => o(!1), [n]), !n || i ? /* @__PURE__ */ et.jsx(et.Fragment, { children: a }) : /* @__PURE__ */ et.jsx("img", { src: n, alt: "", width: 14, height: 14, className: "size-[14px] rounded-[2px] object-contain", referrerPolicy: "no-referrer", onError: () => o(!0) });
}
const x1 = ["application/zip", "application/x-tar", "application/gzip"];
function tp(n) {
  const a = n ?? "";
  if (a.startsWith("image/")) return "image";
  if (a.startsWith("video/")) return "video";
  if (a.startsWith("audio/")) return "audio";
  if (a === "application/pdf") return "pdf";
  if (x1.includes(a)) return "archive";
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
const w1 = 50 * 1024 * 1024, Zf = 1.25, _1 = 0.05, k1 = 16384, S1 = "inline-flex items-center justify-center", Zi = jt(Ul, S1, "min-h-8 min-w-8 px-2 text-[0.75rem] max-[700px]:min-h-11 max-[700px]:min-w-11"), hs = jt(Ul, "inline-flex min-h-8 items-center px-2"), E1 = { pdf: "PDF document", audio: "Audio", video: "Video" };
let z1 = 0;
function N1(n) {
  return n < 1024 ? `${n} B` : n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
function T1(n, a, i) {
  const o = a ? Math.min(8, k1 / Math.max(a.width, a.height)) : 1, s = i === "in" ? n * Zf : i === "out" ? n / Zf : 1;
  return Math.min(o, Math.max(Math.min(_1, o), s));
}
function C1(n, a) {
  return typeof n != "string" || !n.startsWith("/") ? null : `${n.replace(/\/+$/, "")}/${a.replace(/^\/+/, "")}`;
}
function M1({ media: n, workspaceId: a, metadata: i, onFail: o }) {
  const s = X.useMemo(() => `media-${++z1}`, []), [u, m] = X.useState(null), [f, p] = X.useState("fit");
  Lt(() => {
    let T = !0;
    return n.open(s, { workspaceId: a, path: i.path, mediaType: i.mediaType ?? "", size: i.size }).then((E) => {
      T && m(E ?? { width: 0, height: 0 });
    }, (E) => {
      T && o(String(E?.message ?? E));
    }), () => {
      T = !1, n.release(s);
    };
  }, [s]), Lt(() => {
    n.setZoom(s, f === "fit" ? null : f);
  }, [s, f]);
  const v = u !== null && u.width > 0 && u.height > 0, x = () => f !== "fit" ? f : n.fitScale(s) ?? 1, y = (T) => p(T1(x(), u, T)), b = (T) => {
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
      X.createElement("button", { type: "button", className: Zi, "aria-label": "Zoom out", title: "Zoom out (-)", disabled: !v, onClick: () => y("out") }, "−"),
      X.createElement("button", { type: "button", className: Zi, "aria-label": "Zoom in", title: "Zoom in (+)", disabled: !v, onClick: () => y("in") }, "+"),
      X.createElement("button", { type: "button", className: jt(Zi, f === "fit" && "text-fg"), "aria-pressed": f === "fit", onClick: () => p("fit") }, "Fit"),
      X.createElement("button", { type: "button", className: jt(Zi, f === 1 && "text-fg"), "aria-pressed": f === 1, title: "Actual size (0)", disabled: !v, onClick: () => y("actual") }, "100%"),
      X.createElement("span", { role: "status", className: "px-1", "data-testid": "workspace-image-info" }, v ? `${u.width} × ${u.height} · ${S}` : "")
    ),
    X.createElement("div", {
      className: "flex min-h-0 min-w-0 flex-1",
      tabIndex: 0,
      "aria-label": `${i.name} image. Plus and minus zoom, 0 shows actual size, arrow keys pan.`,
      onKeyDown: b
    }, u === null ? X.createElement("span", { className: "m-auto text-[0.8rem] text-subtext-0", role: "status" }, "Loading…") : X.createElement("div", { className: "relative min-h-0 min-w-0 flex-1", "data-perch-engine": "image", "data-perch-key": s, "data-testid": "workspace-file-image" }))
  );
}
function A1({ workspaceId: n, metadata: a, perch: i }) {
  const [o, s] = X.useState(!1), u = i.mediaFile?.(n, a.path) ?? { root: null, extraction: null }, m = u.extraction, f = tp(a.mediaType), p = C1(u.root, a.path), v = p === null, x = f === "archive", y = f === "image" && a.size > w1, b = f !== void 0 && !x && !v && !y;
  let S = "Open this file in Quick Look or its default app.";
  v ? S = "Use your SSH tools to download this file. Perch will not open a remote path on this machine." : x && (S = "Extract into a new folder beside this archive. Existing files are never overwritten.");
  let T = "No preview for this file type";
  v ? T = "Remote media is not available yet" : x ? T = "Compressed archive" : y ? (T = "Image too large to preview", S = `This image is ${Math.round(a.size / 1048576)} MB. Open it in Quick Look or its default app.`) : o && (T = "Preview unavailable", f === "image" && (S = "The image may be corrupt or in a format Perch cannot decode. Open it in Quick Look or its default app."));
  const E = (j) => {
    try {
      i.media[j](p);
    } catch (R) {
      console.error(`perch-media ${j}: ${R?.message ?? R}`);
    }
  }, N = f === "pdf" || f === "audio" || f === "video";
  return X.createElement(
    "section",
    { className: "flex min-h-0 min-w-0 flex-1 flex-col", "aria-label": `Previewing ${a.path}`, "data-testid": "workspace-file-asset" },
    X.createElement(
      "header",
      { className: "flex shrink-0 flex-wrap items-center gap-2 px-3 py-2 text-[0.75rem]" },
      X.createElement("strong", { className: "min-w-0 flex-1 truncate", title: a.path }, a.path),
      x && X.createElement(
        "button",
        { type: "button", className: hs, disabled: m?.state === "loading", onClick: () => i.command("files.extract", { workspaceId: n, path: a.path }) },
        m?.state === "loading" ? "Extracting…" : "Extract"
      ),
      !v && X.createElement("button", { type: "button", className: hs, onClick: () => E("quickLook") }, "Quick Look"),
      !v && X.createElement("button", { type: "button", className: hs, onClick: () => E("openDefault") }, "Open with Default App")
    ),
    m?.state === "ready" && X.createElement("p", { role: "status", className: "m-0 px-3 py-2 text-[0.75rem] text-subtext-0" }, `Extracted to ${m.destination}. Find it in the file tree.`),
    m?.state === "error" && X.createElement("p", { role: "alert", className: "m-0 px-3 py-2 text-[0.75rem] text-red" }, m.error),
    !b || o ? X.createElement(
      "div",
      { className: "grid flex-1 content-center justify-items-center gap-2 p-5 text-center text-[0.8rem] text-subtext-0" },
      X.createElement("strong", { className: "text-fg" }, T),
      X.createElement("span", null, S)
    ) : f === "image" ? X.createElement(M1, { media: i.media, workspaceId: n, metadata: a, onFail: () => s(!0) }) : N && X.createElement(
      "div",
      { className: "grid flex-1 content-center justify-items-center gap-2 p-5 text-center text-[0.8rem] text-subtext-0", "data-testid": "workspace-file-card" },
      X.createElement("strong", { className: "text-fg" }, a.name),
      X.createElement("span", null, `${E1[f]} · ${N1(a.size)}`),
      X.createElement("span", null, "Perch does not play or render this file. Open it in Quick Look or its default app.")
    )
  );
}
function j1(n, a = !1) {
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
const O1 = {
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
function R1({ name: n, directory: a = !1, open: i = !1 }) {
  const { kind: o, tone: s, text: u } = j1(n, a);
  return /* @__PURE__ */ et.jsxs("svg", { className: jt("size-[calc(14px*var(--zoom,1))] shrink-0", s), "data-file-icon": o, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: "1.25", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true", children: [
    o === "react" ? /* @__PURE__ */ et.jsxs(et.Fragment, { children: [
      /* @__PURE__ */ et.jsx("ellipse", { cx: "8", cy: "8", rx: "7", ry: "2.5" }),
      /* @__PURE__ */ et.jsx("ellipse", { cx: "8", cy: "8", rx: "7", ry: "2.5", transform: "rotate(60 8 8)" }),
      /* @__PURE__ */ et.jsx("ellipse", { cx: "8", cy: "8", rx: "7", ry: "2.5", transform: "rotate(120 8 8)" }),
      /* @__PURE__ */ et.jsx("circle", { cx: "8", cy: "8", r: "1" })
    ] }) : u ? /* @__PURE__ */ et.jsx("text", { x: "8", y: "11", textAnchor: "middle", fill: "currentColor", stroke: "none", fontSize: "8", fontWeight: "600", fontFamily: "var(--font-mono)", children: u }) : /* @__PURE__ */ et.jsx("path", { d: o === "folder" && i ? "M2 5V3h4l2 2h5v2M2 7h13l-2 6H2z" : O1[o] }),
    o === "branch" && /* @__PURE__ */ et.jsxs(et.Fragment, { children: [
      /* @__PURE__ */ et.jsx("circle", { cx: "4", cy: "3", r: "1.5" }),
      /* @__PURE__ */ et.jsx("circle", { cx: "4", cy: "13", r: "1.5" }),
      /* @__PURE__ */ et.jsx("circle", { cx: "12", cy: "3", r: "1.5" })
    ] }),
    o === "image" && /* @__PURE__ */ et.jsx("circle", { cx: "10.5", cy: "5", r: "1" })
  ] });
}
const D1 = { unmodified: "", modified: "M", added: "A", deleted: "D", renamed: "R", copied: "C", typeChanged: "T", untracked: "U", ignored: "I", conflicted: "!" }, Jf = (n) => typeof n == "string" ? D1[n] ?? "?" : "?", Wf = (n) => typeof n == "string" ? n === "unmodified" ? "unmodified" : n === "typeChanged" ? "type changed" : n : `unknown (${n.unknown})`;
function B1(n) {
  const a = Jf(n.index), i = Jf(n.worktree), o = a === "!" || i === "!", s = o ? "!" : n.staged && n.unstaged ? `${a || "?"}/${i || "?"}` : n.staged ? a : i || a, u = `Git · Index: ${Wf(n.index)}; working tree: ${Wf(n.worktree)}${n.originalPath ? `; from ${n.originalPath}` : ""}`, m = o || s.includes("D") ? "text-red" : s === "U" || s === "A" || s === "C" ? "text-green" : s.includes("?") || s === "I" ? "text-subtext-0" : "text-yellow";
  return { label: s, title: u, tone: m };
}
function H1({ decoration: n, directory: a = !1 }) {
  if (!n) return null;
  if (a && n.containsChanges) return /* @__PURE__ */ et.jsx("span", { className: jt("ml-1 size-1 shrink-0 rounded-full", n.conflicted ? "bg-red" : "bg-yellow"), role: "img", "aria-label": n.conflicted ? "Contains Git conflicts" : "Contains Git changes", title: n.conflicted ? "Contains Git conflicts" : "Contains Git changes", "data-testid": "file-git-summary" });
  if (!n.entry) return null;
  const { label: i, title: o, tone: s } = B1(n.entry);
  return i ? /* @__PURE__ */ et.jsx("span", { className: jt("ml-1 shrink-0 text-[10px] tabular-nums [font-family:var(--font-mono)]", s), "aria-label": o, title: o, "data-testid": "file-git-marker", children: i }) : null;
}
const U1 = "mode-switch group ml-auto flex items-center gap-[0.4rem] bg-transparent p-[0.2rem] [border:none] [font-family:inherit]", ep = "text-[0.72rem] font-semibold tracking-[0.03em] text-overlay-1 uppercase [transition:color_0.15s_ease]", q1 = `${ep} group-aria-[checked=false]:text-accent`, G1 = `${ep} group-aria-checked:text-accent`, Y1 = "relative h-[1.3rem] w-[2.4rem] shrink-0 rounded-[999px] border border-overlay-0 bg-surface-1 [transition:background_0.15s_ease] group-aria-checked:border-accent group-aria-checked:bg-panel-bg", L1 = "absolute top-px left-px h-[1.1rem] w-[1.1rem] rounded-[50%] bg-fg [box-shadow:0_1px_2px_rgba(0,0,0,0.3)] [transition:transform_0.15s_ease,background_0.15s_ease] group-aria-checked:bg-accent group-aria-checked:[transform:translateX(1.1rem)]";
function V1({
  mode: n,
  onChange: a,
  testId: i = "mode-switch",
  disabled: o = !1
}) {
  const s = n === "cli";
  return /* @__PURE__ */ et.jsxs(
    "button",
    {
      type: "button",
      className: U1,
      "data-testid": i,
      role: "switch",
      "aria-checked": s,
      "aria-label": "Toggle UI / CLI mode",
      disabled: o,
      onClick: () => a(s ? "ui" : "cli"),
      children: [
        /* @__PURE__ */ et.jsx("span", { className: jt("mode-switch__label mode-switch__label--ui", q1), children: "UI" }),
        /* @__PURE__ */ et.jsx("span", { className: jt("mode-switch__track", Y1), children: /* @__PURE__ */ et.jsx("span", { className: jt("mode-switch__thumb", L1) }) }),
        /* @__PURE__ */ et.jsx("span", { className: jt("mode-switch__label mode-switch__label--cli", G1), children: "CLI" })
      ]
    }
  );
}
const Ka = function(n, a) {
  let s = n;
  const u = Nl[a];
  let m = null, f = 0, p = null;
  const v = [], x = {}, y = function(g, h) {
    f = s * 4 + 17, m = (function(_) {
      const k = new Array(_);
      for (let z = 0; z < _; z += 1) {
        k[z] = new Array(_);
        for (let O = 0; O < _; O += 1)
          k[z][O] = null;
      }
      return k;
    })(f), b(0, 0), b(f - 7, 0), b(0, f - 7), E(), T(), j(g, h), s >= 7 && N(g), p == null && (p = F(s, u, v)), R(p, h);
  }, b = function(g, h) {
    for (let _ = -1; _ <= 7; _ += 1)
      if (!(g + _ <= -1 || f <= g + _))
        for (let k = -1; k <= 7; k += 1)
          h + k <= -1 || f <= h + k || (0 <= _ && _ <= 6 && (k == 0 || k == 6) || 0 <= k && k <= 6 && (_ == 0 || _ == 6) || 2 <= _ && _ <= 4 && 2 <= k && k <= 4 ? m[g + _][h + k] = !0 : m[g + _][h + k] = !1);
  }, S = function() {
    let g = 0, h = 0;
    for (let _ = 0; _ < 8; _ += 1) {
      y(!0, _);
      const k = Un.getLostPoint(x);
      (_ == 0 || g > k) && (g = k, h = _);
    }
    return h;
  }, T = function() {
    for (let g = 8; g < f - 8; g += 1)
      m[g][6] == null && (m[g][6] = g % 2 == 0);
    for (let g = 8; g < f - 8; g += 1)
      m[6][g] == null && (m[6][g] = g % 2 == 0);
  }, E = function() {
    const g = Un.getPatternPosition(s);
    for (let h = 0; h < g.length; h += 1)
      for (let _ = 0; _ < g.length; _ += 1) {
        const k = g[h], z = g[_];
        if (m[k][z] == null)
          for (let O = -2; O <= 2; O += 1)
            for (let M = -2; M <= 2; M += 1)
              O == -2 || O == 2 || M == -2 || M == 2 || O == 0 && M == 0 ? m[k + O][z + M] = !0 : m[k + O][z + M] = !1;
      }
  }, N = function(g) {
    const h = Un.getBCHTypeNumber(s);
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
    for (let z = 0; z < 15; z += 1) {
      const O = !g && (k >> z & 1) == 1;
      z < 6 ? m[z][8] = O : z < 8 ? m[z + 1][8] = O : m[f - 15 + z][8] = O;
    }
    for (let z = 0; z < 15; z += 1) {
      const O = !g && (k >> z & 1) == 1;
      z < 8 ? m[8][f - z - 1] = O : z < 9 ? m[8][15 - z - 1 + 1] = O : m[8][15 - z - 1] = O;
    }
    m[f - 8][8] = !g;
  }, R = function(g, h) {
    let _ = -1, k = f - 1, z = 7, O = 0;
    const M = Un.getMaskFunction(h);
    for (let Y = f - 1; Y > 0; Y -= 2)
      for (Y == 6 && (Y -= 1); ; ) {
        for (let Z = 0; Z < 2; Z += 1)
          if (m[k][Y - Z] == null) {
            let D = !1;
            O < g.length && (D = (g[O] >>> z & 1) == 1), M(k, Y - Z) && (D = !D), m[k][Y - Z] = D, z -= 1, z == -1 && (O += 1, z = 7);
          }
        if (k += _, k < 0 || f <= k) {
          k -= _, _ = -_;
          break;
        }
      }
  }, U = function(g, h) {
    let _ = 0, k = 0, z = 0;
    const O = new Array(h.length), M = new Array(h.length);
    for (let Q = 0; Q < h.length; Q += 1) {
      const I = h[Q].dataCount, G = h[Q].totalCount - I;
      k = Math.max(k, I), z = Math.max(z, G), O[Q] = new Array(I);
      for (let at = 0; at < O[Q].length; at += 1)
        O[Q][at] = 255 & g.getBuffer()[at + _];
      _ += I;
      const K = Un.getErrorCorrectPolynomial(G), J = Rl(O[Q], K.getLength() - 1).mod(K);
      M[Q] = new Array(K.getLength() - 1);
      for (let at = 0; at < M[Q].length; at += 1) {
        const st = at + J.getLength() - M[Q].length;
        M[Q][at] = st >= 0 ? J.getAt(st) : 0;
      }
    }
    let Y = 0;
    for (let Q = 0; Q < h.length; Q += 1)
      Y += h[Q].totalCount;
    const Z = new Array(Y);
    let D = 0;
    for (let Q = 0; Q < k; Q += 1)
      for (let I = 0; I < h.length; I += 1)
        Q < O[I].length && (Z[D] = O[I][Q], D += 1);
    for (let Q = 0; Q < z; Q += 1)
      for (let I = 0; I < h.length; I += 1)
        Q < M[I].length && (Z[D] = M[I][Q], D += 1);
    return Z;
  }, F = function(g, h, _) {
    const k = Ff.getRSBlocks(g, h), z = $f();
    for (let M = 0; M < _.length; M += 1) {
      const Y = _[M];
      z.put(Y.getMode(), 4), z.put(Y.getLength(), Un.getLengthInBits(Y.getMode(), g)), Y.write(z);
    }
    let O = 0;
    for (let M = 0; M < k.length; M += 1)
      O += k[M].dataCount;
    if (z.getLengthInBits() > O * 8)
      throw "code length overflow. (" + z.getLengthInBits() + ">" + O * 8 + ")";
    for (z.getLengthInBits() + 4 <= O * 8 && z.put(0, 4); z.getLengthInBits() % 8 != 0; )
      z.putBit(!1);
    for (; !(z.getLengthInBits() >= O * 8 || (z.put(236, 8), z.getLengthInBits() >= O * 8)); )
      z.put(17, 8);
    return U(z, k);
  };
  x.addData = function(g, h) {
    h = h || "Byte";
    let _ = null;
    switch (h) {
      case "Numeric":
        _ = Q1(g);
        break;
      case "Alphanumeric":
        _ = K1(g);
        break;
      case "Byte":
        _ = X1(g);
        break;
      case "Kanji":
        _ = Z1(g);
        break;
      default:
        throw "mode:" + h;
    }
    v.push(_), p = null;
  }, x.isDark = function(g, h) {
    if (g < 0 || f <= g || h < 0 || f <= h)
      throw g + "," + h;
    return m[g][h];
  }, x.getModuleCount = function() {
    return f;
  }, x.make = function() {
    if (s < 1) {
      let g = 1;
      for (; g < 40; g++) {
        const h = Ff.getRSBlocks(g, u), _ = $f();
        for (let z = 0; z < v.length; z++) {
          const O = v[z];
          _.put(O.getMode(), 4), _.put(O.getLength(), Un.getLengthInBits(O.getMode(), g)), O.write(_);
        }
        let k = 0;
        for (let z = 0; z < h.length; z++)
          k += h[z].dataCount;
        if (_.getLengthInBits() <= k * 8)
          break;
      }
      s = g;
    }
    y(!1, S());
  }, x.createTableTag = function(g, h) {
    g = g || 2, h = typeof h > "u" ? g * 4 : h;
    let _ = "";
    _ += '<table style="', _ += " border-width: 0px; border-style: none;", _ += " border-collapse: collapse;", _ += " padding: 0px; margin: " + h + "px;", _ += '">', _ += "<tbody>";
    for (let k = 0; k < x.getModuleCount(); k += 1) {
      _ += "<tr>";
      for (let z = 0; z < x.getModuleCount(); z += 1)
        _ += '<td style="', _ += " border-width: 0px; border-style: none;", _ += " border-collapse: collapse;", _ += " padding: 0px; margin: 0px;", _ += " width: " + g + "px;", _ += " height: " + g + "px;", _ += " background-color: ", _ += x.isDark(k, z) ? "#000000" : "#ffffff", _ += ";", _ += '"/>';
      _ += "</tr>";
    }
    return _ += "</tbody>", _ += "</table>", _;
  }, x.createSvgTag = function(g, h, _, k) {
    let z = {};
    typeof arguments[0] == "object" && (z = arguments[0], g = z.cellSize, h = z.margin, _ = z.alt, k = z.title), g = g || 2, h = typeof h > "u" ? g * 4 : h, _ = typeof _ == "string" ? { text: _ } : _ || {}, _.text = _.text || null, _.id = _.text ? _.id || "qrcode-description" : null, k = typeof k == "string" ? { text: k } : k || {}, k.text = k.text || null, k.id = k.text ? k.id || "qrcode-title" : null;
    const O = x.getModuleCount() * g + h * 2;
    let M, Y, Z, D, Q = "", I;
    for (I = "l" + g + ",0 0," + g + " -" + g + ",0 0,-" + g + "z ", Q += '<svg version="1.1" xmlns="http://www.w3.org/2000/svg"', Q += z.scalable ? "" : ' width="' + O + 'px" height="' + O + 'px"', Q += ' viewBox="0 0 ' + O + " " + O + '" ', Q += ' preserveAspectRatio="xMinYMin meet"', Q += k.text || _.text ? ' role="img" aria-labelledby="' + W([k.id, _.id].join(" ").trim()) + '"' : "", Q += ">", Q += k.text ? '<title id="' + W(k.id) + '">' + W(k.text) + "</title>" : "", Q += _.text ? '<description id="' + W(_.id) + '">' + W(_.text) + "</description>" : "", Q += '<rect width="100%" height="100%" fill="white" cx="0" cy="0"/>', Q += '<path d="', Z = 0; Z < x.getModuleCount(); Z += 1)
      for (D = Z * g + h, M = 0; M < x.getModuleCount(); M += 1)
        x.isDark(Z, M) && (Y = M * g + h, Q += "M" + Y + "," + D + I);
    return Q += '" stroke="transparent" fill="black"/>', Q += "</svg>", Q;
  }, x.createDataURL = function(g, h) {
    g = g || 2, h = typeof h > "u" ? g * 4 : h;
    const _ = x.getModuleCount() * g + h * 2, k = h, z = _ - h;
    return $1(_, _, function(O, M) {
      if (k <= O && O < z && k <= M && M < z) {
        const Y = Math.floor((O - k) / g), Z = Math.floor((M - k) / g);
        return x.isDark(Z, Y) ? 0 : 1;
      } else
        return 1;
    });
  }, x.createImgTag = function(g, h, _) {
    g = g || 2, h = typeof h > "u" ? g * 4 : h;
    const k = x.getModuleCount() * g + h * 2;
    let z = "";
    return z += "<img", z += ' src="', z += x.createDataURL(g, h), z += '"', z += ' width="', z += k, z += '"', z += ' height="', z += k, z += '"', _ && (z += ' alt="', z += W(_), z += '"'), z += "/>", z;
  };
  const W = function(g) {
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
  }, B = function(g) {
    g = typeof g > "u" ? 2 : g;
    const _ = x.getModuleCount() * 1 + g * 2, k = g, z = _ - g;
    let O, M, Y, Z, D;
    const Q = {
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
    let G = "";
    for (O = 0; O < _; O += 2) {
      for (Y = Math.floor((O - k) / 1), Z = Math.floor((O + 1 - k) / 1), M = 0; M < _; M += 1)
        D = "█", k <= M && M < z && k <= O && O < z && x.isDark(Y, Math.floor((M - k) / 1)) && (D = " "), k <= M && M < z && k <= O + 1 && O + 1 < z && x.isDark(Z, Math.floor((M - k) / 1)) ? D += " " : D += "█", G += g < 1 && O + 1 >= z ? I[D] : Q[D];
      G += `
`;
    }
    return _ % 2 && g > 0 ? G.substring(0, G.length - _ - 1) + Array(_ + 1).join("▀") : G.substring(0, G.length - 1);
  };
  return x.createASCII = function(g, h) {
    if (g = g || 1, g < 2)
      return B(h);
    g -= 1, h = typeof h > "u" ? g * 2 : h;
    const _ = x.getModuleCount() * g + h * 2, k = h, z = _ - h;
    let O, M, Y, Z;
    const D = Array(g + 1).join("██"), Q = Array(g + 1).join("  ");
    let I = "", G = "";
    for (O = 0; O < _; O += 1) {
      for (Y = Math.floor((O - k) / g), G = "", M = 0; M < _; M += 1)
        Z = 1, k <= M && M < z && k <= O && O < z && x.isDark(Y, Math.floor((M - k) / g)) && (Z = 0), G += Z ? D : Q;
      for (Y = 0; Y < g; Y += 1)
        I += G + `
`;
    }
    return I.substring(0, I.length - 1);
  }, x.renderTo2dContext = function(g, h) {
    h = h || 2;
    const _ = x.getModuleCount();
    for (let k = 0; k < _; k++)
      for (let z = 0; z < _; z++)
        g.fillStyle = x.isDark(k, z) ? "black" : "white", g.fillRect(z * h, k * h, h, h);
  }, x;
};
Ka.stringToBytes = function(n) {
  const a = [];
  for (let i = 0; i < n.length; i += 1) {
    const o = n.charCodeAt(i);
    a.push(o & 255);
  }
  return a;
};
Ka.createStringToBytes = function(n, a) {
  const i = (function() {
    const s = W1(n), u = function() {
      const p = s.read();
      if (p == -1) throw "eof";
      return p;
    };
    let m = 0;
    const f = {};
    for (; ; ) {
      const p = s.read();
      if (p == -1) break;
      const v = u(), x = u(), y = u(), b = String.fromCharCode(p << 8 | v), S = x << 8 | y;
      f[b] = S, m += 1;
    }
    if (m != a)
      throw m + " != " + a;
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
}, Nl = {
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
  ], a = 1335, i = 7973, o = 21522, s = {}, u = function(m) {
    let f = 0;
    for (; m != 0; )
      f += 1, m >>>= 1;
    return f;
  };
  return s.getBCHTypeInfo = function(m) {
    let f = m << 10;
    for (; u(f) - u(a) >= 0; )
      f ^= a << u(f) - u(a);
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
    let f = Rl([1], 0);
    for (let p = 0; p < m; p += 1)
      f = f.multiply(Rl([1, qn.gexp(p)], 0));
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
    for (let y = 0; y < f; y += 1)
      for (let b = 0; b < f; b += 1) {
        let S = 0;
        const T = m.isDark(y, b);
        for (let E = -1; E <= 1; E += 1)
          if (!(y + E < 0 || f <= y + E))
            for (let N = -1; N <= 1; N += 1)
              b + N < 0 || f <= b + N || E == 0 && N == 0 || T == m.isDark(y + E, b + N) && (S += 1);
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
    const x = Math.abs(100 * v / f / f - 50) / 5;
    return p += x * 10, p;
  }, s;
})(), qn = (function() {
  const n = new Array(256), a = new Array(256);
  for (let o = 0; o < 8; o += 1)
    n[o] = 1 << o;
  for (let o = 8; o < 256; o += 1)
    n[o] = n[o - 4] ^ n[o - 5] ^ n[o - 6] ^ n[o - 8];
  for (let o = 0; o < 255; o += 1)
    a[n[o]] = o;
  const i = {};
  return i.glog = function(o) {
    if (o < 1)
      throw "glog(" + o + ")";
    return a[o];
  }, i.gexp = function(o) {
    for (; o < 0; )
      o += 255;
    for (; o >= 256; )
      o -= 255;
    return n[o];
  }, i;
})(), Rl = function(n, a) {
  if (typeof n.length > "u")
    throw n.length + "/" + a;
  const i = (function() {
    let s = 0;
    for (; s < n.length && n[s] == 0; )
      s += 1;
    const u = new Array(n.length - s + a);
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
        u[m + f] ^= qn.gexp(qn.glog(o.getAt(m)) + qn.glog(s.getAt(f)));
    return Rl(u, 0);
  }, o.mod = function(s) {
    if (o.getLength() - s.getLength() < 0)
      return o;
    const u = qn.glog(o.getAt(0)) - qn.glog(s.getAt(0)), m = new Array(o.getLength());
    for (let f = 0; f < o.getLength(); f += 1)
      m[f] = o.getAt(f);
    for (let f = 0; f < s.getLength(); f += 1)
      m[f] ^= qn.gexp(qn.glog(s.getAt(f)) + u);
    return Rl(m, 0).mod(s);
  }, o;
}, Ff = (function() {
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
  ], a = function(s, u) {
    const m = {};
    return m.totalCount = s, m.dataCount = u, m;
  }, i = {}, o = function(s, u) {
    switch (u) {
      case Nl.L:
        return n[(s - 1) * 4 + 0];
      case Nl.M:
        return n[(s - 1) * 4 + 1];
      case Nl.Q:
        return n[(s - 1) * 4 + 2];
      case Nl.H:
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
    for (let v = 0; v < f; v += 1) {
      const x = m[v * 3 + 0], y = m[v * 3 + 1], b = m[v * 3 + 2];
      for (let S = 0; S < x; S += 1)
        p.push(a(y, b));
    }
    return p;
  }, i;
})(), $f = function() {
  const n = [];
  let a = 0;
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
    return a;
  }, i.putBit = function(o) {
    const s = Math.floor(a / 8);
    n.length <= s && n.push(0), o && (n[s] |= 128 >>> a % 8), a += 1;
  }, i;
}, Q1 = function(n) {
  const a = de.MODE_NUMBER, i = n, o = {};
  o.getMode = function() {
    return a;
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
}, K1 = function(n) {
  const a = de.MODE_ALPHA_NUM, i = n, o = {};
  o.getMode = function() {
    return a;
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
}, X1 = function(n) {
  const a = de.MODE_8BIT_BYTE, i = Ka.stringToBytes(n), o = {};
  return o.getMode = function() {
    return a;
  }, o.getLength = function(s) {
    return i.length;
  }, o.write = function(s) {
    for (let u = 0; u < i.length; u += 1)
      s.put(i[u], 8);
  }, o;
}, Z1 = function(n) {
  const a = de.MODE_KANJI, i = Ka.stringToBytes;
  (function(u, m) {
    const f = i(u);
    if (f.length != 2 || (f[0] << 8 | f[1]) != m)
      throw "sjis not supported.";
  })("友", 38726);
  const o = i(n), s = {};
  return s.getMode = function() {
    return a;
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
}, np = function() {
  const n = [], a = {};
  return a.writeByte = function(i) {
    n.push(i & 255);
  }, a.writeShort = function(i) {
    a.writeByte(i), a.writeByte(i >>> 8);
  }, a.writeBytes = function(i, o, s) {
    o = o || 0, s = s || i.length;
    for (let u = 0; u < s; u += 1)
      a.writeByte(i[u + o]);
  }, a.writeString = function(i) {
    for (let o = 0; o < i.length; o += 1)
      a.writeByte(i.charCodeAt(o));
  }, a.toByteArray = function() {
    return n;
  }, a.toString = function() {
    let i = "";
    i += "[";
    for (let o = 0; o < n.length; o += 1)
      o > 0 && (i += ","), i += n[o];
    return i += "]", i;
  }, a;
}, J1 = function() {
  let n = 0, a = 0, i = 0, o = "";
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
    for (n = n << 8 | f & 255, a += 8, i += 1; a >= 6; )
      u(n >>> a - 6), a -= 6;
  }, s.flush = function() {
    if (a > 0 && (u(n << 6 - a), n = 0, a = 0), i % 3 != 0) {
      const f = 3 - i % 3;
      for (let p = 0; p < f; p += 1)
        o += "=";
    }
  }, s.toString = function() {
    return o;
  }, s;
}, W1 = function(n) {
  const a = n;
  let i = 0, o = 0, s = 0;
  const u = {};
  u.read = function() {
    for (; s < 8; ) {
      if (i >= a.length) {
        if (s == 0)
          return -1;
        throw "unexpected end of file./" + s;
      }
      const p = a.charAt(i);
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
}, F1 = function(n, a) {
  const i = n, o = a, s = new Array(n * a), u = {};
  u.setPixel = function(v, x, y) {
    s[x * i + v] = y;
  }, u.write = function(v) {
    v.writeString("GIF87a"), v.writeShort(i), v.writeShort(o), v.writeByte(128), v.writeByte(0), v.writeByte(0), v.writeByte(0), v.writeByte(0), v.writeByte(0), v.writeByte(255), v.writeByte(255), v.writeByte(255), v.writeString(","), v.writeShort(0), v.writeShort(0), v.writeShort(i), v.writeShort(o), v.writeByte(0);
    const x = 2, y = f(x);
    v.writeByte(x);
    let b = 0;
    for (; y.length - b > 255; )
      v.writeByte(255), v.writeBytes(y, b, 255), b += 255;
    v.writeByte(y.length - b), v.writeBytes(y, b, y.length - b), v.writeByte(0), v.writeString(";");
  };
  const m = function(v) {
    const x = v;
    let y = 0, b = 0;
    const S = {};
    return S.write = function(T, E) {
      if (T >>> E)
        throw "length over";
      for (; y + E >= 8; )
        x.writeByte(255 & (T << y | b)), E -= 8 - y, T >>>= 8 - y, b = 0, y = 0;
      b = T << y | b, y = y + E;
    }, S.flush = function() {
      y > 0 && x.writeByte(b);
    }, S;
  }, f = function(v) {
    const x = 1 << v, y = (1 << v) + 1;
    let b = v + 1;
    const S = p();
    for (let R = 0; R < x; R += 1)
      S.add(String.fromCharCode(R));
    S.add(String.fromCharCode(x)), S.add(String.fromCharCode(y));
    const T = np(), E = m(T);
    E.write(x, b);
    let N = 0, j = String.fromCharCode(s[N]);
    for (N += 1; N < s.length; ) {
      const R = String.fromCharCode(s[N]);
      N += 1, S.contains(j + R) ? j = j + R : (E.write(S.indexOf(j), b), S.size() < 4095 && (S.size() == 1 << b && (b += 1), S.add(j + R)), j = R);
    }
    return E.write(S.indexOf(j), b), E.write(y, b), E.flush(), T.toByteArray();
  }, p = function() {
    const v = {};
    let x = 0;
    const y = {};
    return y.add = function(b) {
      if (y.contains(b))
        throw "dup key:" + b;
      v[b] = x, x += 1;
    }, y.size = function() {
      return x;
    }, y.indexOf = function(b) {
      return v[b];
    }, y.contains = function(b) {
      return typeof v[b] < "u";
    }, y;
  };
  return u;
}, $1 = function(n, a, i) {
  const o = F1(n, a);
  for (let f = 0; f < a; f += 1)
    for (let p = 0; p < n; p += 1)
      o.setPixel(p, f, i(p, f));
  const s = np();
  o.write(s);
  const u = J1(), m = s.toByteArray();
  for (let f = 0; f < m.length; f += 1)
    u.writeByte(m[f]);
  return u.flush(), "data:image/gif;base64," + u;
};
Ka.stringToBytes;
function I1({ text: n }) {
  const { size: a, path: i } = X.useMemo(() => {
    const o = Ka(0, "M");
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
const Dl = X.createContext(""), Ds = (n, a) => typeof n == "string" && n.toLowerCase().includes(a);
function P1({ title: n, children: a, testId: i, ariaLabel: o }) {
  const s = X.useContext(Dl), u = s !== "" && Ds(n, s);
  return (
    // While searching, a group with no matching row (and no matching title) hides itself.
    /* @__PURE__ */ et.jsxs("section", { className: s && !u ? "mb-8 not-has-[[data-setting-row]]:hidden" : "mb-8", "data-testid": i, "aria-label": o, children: [
      n && /* @__PURE__ */ et.jsx("h3", { className: "m-0 mb-3 text-[0.9rem] font-medium text-fg", children: n }),
      /* @__PURE__ */ et.jsx("div", { className: "rounded-ui bg-surface-0 px-4", children: /* @__PURE__ */ et.jsx(Dl.Provider, { value: u ? "" : s, children: a }) })
    ] })
  );
}
function ty({ title: n, description: a, children: i, testId: o }) {
  const s = X.useContext(Dl);
  return s && !Ds(n, s) && !Ds(a, s) ? null : /* @__PURE__ */ et.jsxs("div", { "data-setting-row": !0, "data-testid": o, className: "flex items-center justify-between gap-6 py-[0.8rem] max-[700px]:flex-wrap max-[700px]:gap-y-2", children: [
    /* @__PURE__ */ et.jsxs("div", { className: "min-w-0 max-[700px]:flex-1 max-[700px]:basis-56", children: [
      /* @__PURE__ */ et.jsx("div", { className: "text-[0.85rem] text-fg", children: n }),
      a && /* @__PURE__ */ et.jsx("div", { className: "mt-[0.15rem] text-[0.75rem] text-subtext-0", children: a })
    ] }),
    i && /* @__PURE__ */ et.jsx("div", { className: "flex shrink-0 items-center gap-2", children: i })
  ] });
}
function ey({ checked: n, onChange: a, testId: i, label: o }) {
  return /* @__PURE__ */ et.jsx(
    "input",
    {
      type: "checkbox",
      role: "switch",
      "aria-label": o,
      "data-testid": i,
      checked: n,
      onChange: (s) => a(s.target.checked),
      className: "relative h-[1.25rem] w-[2.25rem] shrink-0 cursor-pointer appearance-none rounded-full bg-overlay-0 [transition:background_0.12s_ease] before:absolute before:top-[0.15rem] before:left-[0.15rem] before:h-[0.95rem] before:w-[0.95rem] before:rounded-full before:bg-fg before:content-[''] before:[transition:transform_0.12s_ease] checked:bg-accent checked:before:translate-x-[1rem] checked:before:bg-panel-bg focus-visible:[outline:2px_solid_var(--accent)] focus-visible:[outline-offset:2px]"
    }
  );
}
//! The Settings pages' shared parts for `@perch/sdk` 1.8 (`sdk.ts` re-exports and lists them). Each wraps the host
//! component or class string the pages are drawn with and owns no state. `SettingsGroup` and `SettingRow` are the
//! host's own, so the Settings search (`SettingsQuery`) filters a copy's rows exactly as it filters Perch's.
const ny = () => X.useContext(Dl), ay = {
  select: Fs,
  selectHost: a1,
  input: l1,
  inputPort: i1,
  inputWide: r1,
  addRow: o1,
  list: s1,
  hostRow: u1,
  name: d1,
  addr: f1,
  muted: e1,
  empty: n1,
  primary: m1,
  danger: p1,
  catalogToggle: t1
};
//! State the host keeps for a resource rather than for one view of it (`useResourceState`, `@perch/sdk` 1.4): a
//! review's unsent commit message and comment, its pending batch and its operation id, keyed by the screen's
//! own name for the resource (`review:<workspace>:commit`). Every view and copy that names the same key shares the
//! value, and it outlives a reload or swap of the screen's code, a released hidden copy and the phone/desktop
//! layouts trading places. In memory: a page reload starts empty (durable drafts live in their own services).
const ly = 512, Ie = globalThis.__perchResources ??= /* @__PURE__ */ new Map(), Al = /* @__PURE__ */ new Map();
function ap(n, a) {
  Ie.delete(n), Ie.set(n, a);
  for (const i of Ie.keys()) {
    if (Ie.size <= ly) break;
    Al.get(i)?.size || Ie.delete(i);
  }
}
function iy(n, a) {
  return Ie.has(n) ? Ie.get(n) : a;
}
function ry(n, a, i) {
  const o = iy(n, i), s = typeof a == "function" ? a(o) : a;
  if (!(Ie.has(n) && Object.is(s, o))) {
    ap(n, s);
    for (const u of [...Al.get(n) ?? []]) u();
  }
}
function oy(n, a) {
  if (typeof n != "string" || !n) throw new Error("useResourceState needs a non-empty key.");
  Ie.has(n) || ap(n, a);
  const i = X.useCallback((u) => {
    const m = Al.get(n) ?? /* @__PURE__ */ new Set();
    return Al.set(n, m), m.add(u), () => {
      m.delete(u), m.size || Al.delete(n);
    };
  }, [n]), o = X.useSyncExternalStore(i, () => Ie.get(n)), s = X.useCallback((u) => ry(n, u, a), [n]);
  return [o, s];
}
const sy = "[--radius:var(--radius-pane)] rounded-soft bg-surface-1/70 shadow-[0_6px_20px_rgba(0,0,0,0.3)] backdrop-blur-xl backdrop-saturate-150", cy = "hover:bg-transparent hover:text-subtext-0 active:bg-surface-1 active:text-fg";
//! `@perch/sdk` for the native client: the surface a stock screen imports (the navigation part, 1.3), with every
//! call going to one abstract host object, `globalThis.perch`, read when called (so a host or a test sets it before
//! mounting). Class helpers, icons, `cn`, `keyLabel` and the host dot are the app's own modules, compiled in, so the
//! classes are the web's to the character. Data hooks subscribe to `perch.subscribe` and read the host's snapshots
//! (`perch.navigation(options)`, `perch.hosts()`, ...), which must return the same object until the data changes.
//! Menus and dialogs Perch draws itself (session menu, new session menu, confirm, select, folder browser,
//! instructions, memory) open through `perch.openOverlay(kind, props)`; their callbacks are plain functions.
const uy = "1.3.0";
let Pi = null;
const dy = (n) => {
  Pi = n;
};
function bt() {
  const n = (typeof Pi == "function" ? Pi() : Pi) ?? globalThis.perch;
  if (!n) throw new Error("@perch/sdk: no perch host (globalThis.perch) is set");
  return n;
}
const lp = (n) => bt().subscribe?.(n) ?? (() => {
}), fy = v1;
function my() {
  return typeof globalThis.crypto?.randomUUID == "function" ? globalThis.crypto.randomUUID() : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (n) => {
    const a = Math.floor(Math.random() * 16);
    return (n === "x" ? a : a & 3 | 8).toString(16);
  });
}
const ip = globalThis.perch?.isMac !== !1, Bs = (n) => Bv(n, bt().isMac !== !1), py = (n) => Uv(n), hy = ({ className: n, ...a } = {}) => jt(Gv(a), n), gy = Lv, rp = (n) => js(n), tr = Vv, by = Ul, vy = Wm, yy = (n) => Os[n].color, xy = (n, a) => bt().shortcutFor?.(n, a) ?? null, op = (n) => bt().shortcutLabel?.(n) ?? null, wy = (n, a) => {
  const i = op(a);
  return i ? `${n} (${i})` : n;
}, xr = (n, a) => bt().command(n, a ?? {}) !== !1, _y = (n, a, i) => bt().startSession?.(n, a, i), ky = globalThis.perch?.pickFolder ? (n) => bt().pickFolder(n) : null;
function Ht(n) {
  const a = X.useRef(n);
  return a.current = n, X.useSyncExternalStore(lp, () => a.current(bt()));
}
const sp = (n = {}) => Ht((a) => a.navigation({ showTerminals: !!n.showTerminals, sortByAttention: !!n.sortByAttention })), Sy = () => Ht((n) => n.hosts()), Ey = () => Ht((n) => n.sessionFolders());
function zy() {
  const n = Ht((a) => a.addProject?.() ?? Ny);
  return {
    status: n.status ?? "idle",
    error: n.error,
    hostId: n.hostId,
    add: (a, i, o) => {
      a.trim() && n.status !== "pending" && bt().addProjectFolder?.(a, i, o);
    },
    clear: () => bt().clearAddProject?.()
  };
}
const Ny = Object.freeze({ status: "idle" }), cp = "perch.lastAgentChoice", Ty = Object.freeze({ connected: !1, discovery: !1, state: "ready", choices: [] }), Cy = () => {
  const n = bt().storage?.getItem(cp);
  return n === "claude" || n === "codex" ? n : "claude";
}, My = Object.freeze({ items: [] });
function Ay() {
  const n = Ht((a) => a.notifications?.() ?? My);
  return X.useMemo(() => ({
    items: n.items ?? [],
    open: (a) => bt().command("notification.open", { id: a }),
    dismiss: (a) => bt().command("notification.dismiss", { id: a })
  }), [n]);
}
function jy(n) {
  const a = Ht((s) => s.agentChoices?.(n) ?? Ty), [i, o] = X.useState(Cy);
  return X.useMemo(() => ({
    connected: !!a.connected,
    discovery: !!a.discovery,
    choices: a.choices ?? [],
    lastChoice: i,
    state: a.state ?? "ready",
    error: a.state === "error" ? a.error : void 0,
    rememberChoice: (s) => {
      s !== "claude" && s !== "codex" || (bt().storage?.setItem(cp, s), o(s));
    },
    manage: () => bt().command("agents.manage", {})
  }), [a, i]);
}
function Oy(n) {
  Lt(() => bt().onRequest?.("add-project", n) ?? void 0, [n]);
}
function Ry(n) {
  const a = n.map((i) => ({ id: i.id, parentSessionId: i.parentId, session: i }));
  return b1(a).map((i) => ({ session: i.session, nested: Rs(i, a) }));
}
function Dy({ id: n, plain: a, className: i }) {
  const o = Ht((v) => v.session(n));
  if (!o) return null;
  const s = o.state ?? g1(o), u = Os[s]?.color ?? Os.unknown.color, m = o.provider, f = m === "claude" || m === "claude-agent-teams" || m === "omp", p = a ? jt("agent-mark", "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full leading-none", i) : jt("agent-status-dot", `agent-status-dot--${s}`, "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-[1.5px] bg-panel-bg leading-none", i);
  return X.createElement(
    "span",
    { className: p, style: a ? void 0 : { borderColor: u }, "data-provider": m ?? "unknown", title: a ? m ?? "Agent" : `${m ?? "Agent"} · ${s}`, "aria-hidden": "true" },
    X.createElement("span", { className: jt("inline-flex text-fg", f && "rounded-full bg-[#161616]") }, X.createElement(up, { provider: m, size: 14 }))
  );
}
function up({ provider: n, size: a = 14 }) {
  const i = bt().agentIcon?.(n, a) ?? null, o = i?.markup ?? '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><circle cx="8" cy="8" r="5" fill="currentColor"/></svg>';
  return X.createElement("svg", { width: a, height: a, "aria-hidden": "true", "data-agent-icon": n ?? "unknown", "data-perch-markup": o, ...i && i.tint === !1 ? { "data-perch-image": "true" } : {} });
}
const By = ({ children: n }) => X.createElement(X.Fragment, null, n);
function Hy(n, a) {
  const i = X.useRef(a);
  return i.current = a, Lt(() => {
    const o = bt();
    if (!o.openOverlay) throw new Error(`@perch/sdk: the host draws no overlays (perch.openOverlay), so ${n} cannot open`);
    const s = {};
    for (const [m, f] of Object.entries(i.current))
      s[m] = typeof f == "function" ? (...p) => i.current[m]?.(...p) : f;
    const u = o.openOverlay(n, s);
    return () => o.closeOverlay?.(u);
  }, [n]), null;
}
const Vn = (n) => function(i) {
  return Hy(n, i);
}, Uy = Vn("session-menu"), qy = Vn("new-session-menu"), Gy = Vn("confirm");
let dp = null;
const Yy = (n) => {
  dp = n;
};
function Ly(n) {
  return X.createElement(dp ?? Gy, n);
}
function Vy({ className: n = Fs, ...a }) {
  return X.createElement($v, { ...a, className: n });
}
let Hs = null;
const Qy = (n) => {
  Hs = n;
}, Ky = Vn("folder-browser");
function Xy(n) {
  return Hs ? X.createElement(Hs, { ...n, browse: (a) => bt().browse(n.hostId, a) }) : X.createElement(Ky, n);
}
const Zy = Vn("instructions"), Jy = Vn("memory"), Wy = Jv;
let Ps = null;
const Fy = (n) => {
  Ps = n;
};
function $y(n) {
  if (Ps) return X.createElement(Py, n);
  const { hostId: a, path: i, className: o } = n, s = X.useRef(null);
  return X.createElement(
    "button",
    {
      type: "button",
      ref: s,
      className: jt("worktree-menu__btn", Wm, o),
      "data-testid": `worktree-menu-${a}-${i}`,
      title: "New workspace (a git worktree)",
      "aria-label": "New workspace",
      "aria-expanded": !1,
      onClick: () => bt().openOverlay?.("worktree", { hostId: a, cwd: i, anchor: s.current?.getBoundingClientRect() })
    },
    X.createElement(Fm, null)
  );
}
const fp = "Perch did not answer.";
function Ji(n) {
  return n ? n.type === "worktree.error" ? { error: n.message, dirty: !!n.dirty } : n.error ? { error: String(n.error) } : {} : { error: fp };
}
function Iy(n, a, i = bt()) {
  const o = (s) => {
    for (const u of s ?? []) {
      if (u.path === a) return u;
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
const If = 5 * 6e4;
function mp(n, a, i, o = bt()) {
  const s = Date.now() + If;
  let u = !1, m = () => {
  };
  const f = () => {
    u = !0, m(), clearTimeout(v);
  }, p = () => {
    if (!u) {
      if (Date.now() >= s) return f();
      Iy(n, a, o) && (f(), o.startSession?.(n, a, i));
    }
  }, v = setTimeout(f, If);
  m = o.subscribe?.(p) ?? (() => {
  }), p();
}
function Py({ hostId: n, path: a, className: i, worktrees: o, request: s, parentChoices: u, emptyAgent: m, ...f }) {
  const [p, v] = X.useState(o), x = (k) => !!bt().coreCan?.(k, n), y = sp(), b = `${n}:${a}`, S = X.useMemo(() => {
    if (Array.isArray(u)) return u;
    if (!x("workspace.nest")) return [];
    const k = y?.projects?.find((M) => M.hostId === n && M.repoPath === a), z = [], O = (M, Y) => {
      for (const Z of M ?? [])
        Y && z.push({ id: Z.id, name: Z.name, path: Z.path }), O(Z.children, !0);
    };
    return O(k?.workspaces, !1), z;
  }, [u, y, n, a]), T = n === "local" && x("worktree.job"), E = f.deleteSupported ?? x("worktree.delete"), N = f.startFromSupported ?? x("worktree.startFrom"), j = Ht((k) => k.emptyWorkspaceAgent?.() ?? void 0), R = m ?? j ?? void 0, U = Ht((k) => k.worktreeMenuRequest?.() ?? null), F = U?.projectKey === b ? U.nonce : null, W = X.useMemo(() => s ?? (F == null ? null : U), [s, F]), [B, g] = X.useState(W);
  Lt(() => {
    W && g(W);
  }, [W]);
  const h = X.useRef({});
  h.current = { background: T, deleteSupported: E };
  const _ = X.useMemo(() => {
    const k = (z, O) => bt().ask(z, { hostId: n, repoPath: a, ...O });
    return {
      list: async () => {
        const z = await k("worktree.list", {});
        return z?.type === "worktree.list.result" && v({ worktrees: z.worktrees ?? [], defaultRoot: z.defaultRoot ?? "", baseRef: z.baseRef, refs: z.refs ?? [] }), Ji(z);
      },
      create: async ({ branch: z, newBranch: O, path: M, extra: Y, agent: Z }) => {
        const D = { branch: z, newBranch: !!O, path: M ?? null, name: Y?.name ?? null, startFrom: Y?.startFrom ?? null, parentWorkspaceId: Y?.parentWorkspaceId ?? null }, { background: Q } = h.current, I = await k(Q ? "worktree.job.start" : "worktree.create", D), G = Q ? "worktree.job.started" : "worktree.done";
        if (I?.type !== G) return { error: Ji(I).error ?? fp };
        const K = Q ? I.job?.path : I.path;
        return Z && K && mp(n, K, Z), { background: Q };
      },
      remove: async (z, O) => {
        const M = await k("worktree.remove", { path: z, force: !!O, deleteBranch: h.current.deleteSupported });
        return { ...Ji(M), preservedBranch: M?.type === "worktree.done" ? M.preservedBranch ?? void 0 : void 0 };
      },
      deleteBranch: async (z, O) => Ji(await k("worktree.branch.delete", { branch: z, expectedHead: O })),
      open: (z) => bt().startSession?.(n, z, "terminal"),
      // The window forgets the request; the screen keeps it until a newer one, as clearing it would re-run (and so
      // cancel) the screen's effect that a measurement put off until the next frame (`measured`).
      takeRequest: () => bt().takeWorktreeRequest?.()
    };
  }, [n, a]);
  return X.createElement(Ps, {
    hostId: n,
    cwd: a,
    projectKey: b,
    className: i,
    worktrees: p,
    background: T,
    startFromSupported: N,
    deleteSupported: E,
    parentChoices: S,
    emptyAgent: R,
    request: B,
    actions: _
  });
}
const tx = (n, a) => {
  if (!bt().followPointer?.(n)) return;
  const i = a.items();
  for (const o of i) o.getBoundingClientRect();
  i[0]?.parentElement?.getBoundingClientRect(), jv(n, a);
}, ex = () => Ht((n) => n.workspaceTabs());
let nx = 0;
function ax({ path: n, content: a }) {
  const { source: i, truncated: o } = Wv(a ?? ""), s = bt().markdown, u = X.useMemo(() => `markdown-${++nx}`, []);
  return Ol(() => {
    s?.show(u, i);
  }, [u, i]), Lt(() => () => s?.release(u), [u]), X.createElement(
    "div",
    { className: "min-h-0 min-w-0 flex-1 overflow-auto px-4 py-3 text-[0.8rem]", style: { display: "flex", flexDirection: "column" }, tabIndex: 0, role: "region", "aria-label": `Rendered preview of ${n}`, "data-testid": "workspace-markdown-preview" },
    o && X.createElement(
      "p",
      { role: "status", className: "mt-0 text-[0.7rem] text-yellow", "data-testid": "workspace-markdown-truncated" },
      `This document is large: only the first ${Ii.toLocaleString()} characters are rendered. Switch to Source to see all of it.`
    ),
    X.createElement(
      "div",
      { className: "message__markdown file-markdown", style: { display: "flex", flexDirection: "column", flex: "1 1 0%", minHeight: 0 } },
      X.createElement("div", { "data-perch-engine": "markdown", "data-perch-key": u, className: "min-h-0 min-w-0 flex-1" })
    )
  );
}
const lx = Vn("file-menu"), ix = /* @__PURE__ */ new Map(), rx = ["requestTree", "searchFiles", "openFile", "reloadFile", "requestPreview", "updateDraft", "saveFile", "overwriteFile", "setWrap"];
function ox(n, a = {}) {
  const i = Ht((v) => v.workspaceFiles(n)), o = !!a.git, s = i.git?.decorations, u = X.useMemo(() => o && s?.length ? new Map(s) : ix, [s, o]), m = X.useMemo(() => Object.fromEntries(rx.map((v) => [v, (...x) => (bt().filesDo(v, n, ...x), null)])), [n]), f = Ht((v) => !!v.contextBridgeAvailable?.(n)), p = X.useMemo(() => f ? (v) => {
    if (v.kind !== "editor") return bt().askAgent(n, v);
    const x = bt().workspaceFiles(n)?.documents?.[v.path];
    return bt().askAgent(n, { ...v, dirty: x?.content !== x?.savedContent });
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
const sx = () => Ht((n) => n.statusLine()), cx = () => Ht((n) => n.zoom()), ux = () => Ht((n) => n.paneLook()), dx = () => Ht((n) => n.keybindings?.() ?? []), fx = Object.freeze({ usage: Object.freeze([]), updatedAt: 0, spend: null, redeemResult: null });
function mx(n) {
  const a = !!n?.keepFresh, i = Ht((s) => s.statusLine?.().connected ?? !1), o = Ht((s) => s.planUsage?.() ?? fx);
  return Lt(() => {
    if (!a || !i) return;
    let s;
    const u = () => {
      bt().command("usage.get"), s = setTimeout(u, 18e4);
    };
    return u(), () => clearTimeout(s);
  }, [a, i]), o;
}
const px = () => bt().command("usage.get", { force: !0 }), hx = (n) => bt().command("usage.redeemReset", { accountId: n }), gx = () => xr("app.zoom_reset"), bx = {
  focused: "bg-[color-mix(in_srgb,var(--text)_10%,var(--panel-bg))] hover:bg-[color-mix(in_srgb,var(--text)_10%,var(--panel-bg))] text-fg font-semibold",
  visible: "bg-transparent text-subtext-0 hover:bg-surface-0 hover:text-fg",
  hidden: "bg-transparent text-subtext-0 hover:bg-surface-0 hover:text-fg"
}, vx = (n, a, i) => bt().beginTabDrag?.(n, a, i);
function yx(n) {
  Lt(() => bt().onRequest?.("new-tab", n) ?? void 0, [n]);
}
const xx = (n) => xr("browser.open", { workspaceId: n }), wx = (n, a) => xr("file.open", { workspaceId: n, path: a }), _x = () => null, kx = () => null, Sx = Vn("new-file"), Ex = [
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
], zx = /* @__PURE__ */ new Set(["discardPreview", "commitPreview", "previewBatch", "sendBatch"]);
function Nx(n) {
  const a = {};
  for (const i of Ex)
    a[i] = (...o) => {
      const s = bt().gitDo(i, n, ...o);
      return zx.has(i) ? s.then((u) => u ?? null, () => null) : (s.catch?.((u) => console.error(`perch: ${i}: ${u?.message ?? u}`)), null);
    };
  return a;
}
function Tx(n) {
  const a = Ht((o) => o.gitReview(n)), i = X.useMemo(() => Nx(n), [n]);
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
function pp(n) {
  const { workspaceId: a } = n, i = `diff:${a}:${X.useId()}`, o = bt(), s = X.useRef(null);
  s.current !== i && (o.diff.open(i, { workspaceId: a }), s.current = i), o.diff.setProps(i, {
    path: n.path ?? null,
    wrap: !!n.wrap,
    layout: n.layout ?? "auto",
    canAsk: !!n.onAskAgent,
    selection: n.selection ?? null,
    editingCommentId: n.editingCommentId ?? null,
    editingBody: n.editingBody ?? "",
    reveal: n.reveal ?? null,
    collapsed: n.collapsed ?? [],
    viewed: n.onToggleViewed ? n.viewed ?? [] : null,
    composer: n.selection && n.onSubmitComment ? { body: n.commentBody ?? "", target: n.commentTarget ?? null, canAsk: !!n.onAskLines } : null
  });
  const u = Ht((p) => p.gitReview(a)).comments ?? [], m = X.useSyncExternalStore(lp, () => o.diff.seq(i)), f = X.useRef(n);
  return f.current = n, Lt(() => {
    const p = f.current, v = (x) => u.find((y) => y.id === x);
    for (const x of o.diff.events(i))
      switch (x.type) {
        case "selectLine":
          p.onSelectLine?.(x.path, x.side, x.line, x.extend);
          break;
        case "addComment":
          p.onAddComment?.(x.path, x.side, x.line);
          break;
        case "askAgent":
          p.onAskAgent?.(x.path);
          break;
        case "toggleCollapsed":
          p.onToggleCollapsed?.(x.path);
          break;
        case "toggleViewed":
          p.onToggleViewed?.(x.path);
          break;
        case "editComment": {
          const y = v(x.commentId);
          y && p.onEditComment?.(y);
          break;
        }
        case "editBody":
          p.onEditBody?.(x.text);
          break;
        case "saveEdit": {
          const y = v(x.commentId);
          y && p.onSaveEdit?.(y);
          break;
        }
        case "cancelEdit":
          p.onCancelEdit?.();
          break;
        case "commentBody":
          p.onCommentBody?.(x.text);
          break;
        case "submitComment":
          p.onSubmitComment?.();
          break;
        case "cancelComment":
          p.onCancelComment?.();
          break;
        case "askLines":
          p.onAskLines?.();
          break;
        case "resolve": {
          const y = v(x.commentId);
          y && p.onResolve?.(y);
          break;
        }
        case "delete": {
          const y = v(x.commentId);
          y && p.onDelete?.(y);
          break;
        }
      }
  }, [m, i]), X.createElement("div", { "data-perch-engine": "diff", "data-perch-key": i, "data-testid": "git-diff", className: n.className ?? "min-h-0 flex-1" });
}
pp.splitLayout = !0;
function Cx(n) {
  return X.createElement(A1, { ...n, perch: bt() });
}
function Mx(n, a) {
  const i = n.selection(a);
  if (i) return i;
  const o = n.value(a), s = o.split(`
`).length - (o.endsWith(`
`) && o.length ? 1 : 0);
  return { text: o, startLine: 1, endLine: Math.max(1, s) };
}
function Ax({ onGo: n, onClose: a }) {
  const [i, o] = X.useState(""), s = (u) => {
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
      onChange: (u) => o(u.target.value),
      onKeyDown: (u) => {
        u.key === "Escape" ? (u.preventDefault(), a()) : u.key === "Enter" && s(u);
      }
    }),
    X.createElement("button", { type: "button", className: Ul, onClick: s }, "OK")
  );
}
function jx({ value: n, onChange: a, onSave: i, onCaret: o, readOnly: s, wrap: u, label: m, path: f, docKey: p, onAskAgent: v, ref: x }) {
  const y = bt().editor, b = X.useRef(null);
  b.current = { onChange: a, onSave: i, onCaret: o, onAskAgent: v };
  const [S, , T] = String(p).split("\0"), E = !!y && T !== void 0 && /^\d+$/.test(T), N = Ht((_) => E ? _.workspaceFiles(S)?.carets?.[p] ?? null : null);
  Lt(() => {
    N && b.current.onCaret?.({ line: N.line, col: N.col });
  }, [N?.line, N?.col]);
  const j = X.useRef(n), [R, U] = X.useState(null), [F, W] = X.useState(!1), B = () => {
    if (!y || !b.current.onAskAgent) return;
    const { text: _, startLine: k, endLine: z } = Mx(y, p);
    b.current.onAskAgent(_, k, z);
  };
  if (X.useImperativeHandle(x, () => ({
    openGoto: () => W(!0),
    focus: () => y?.focus(p),
    askAgent: B
  }), [p]), Ol(() => {
    if (!y) return;
    y.open(p, { path: f, value: n, readonly: !!s, wrap: !!u, label: m }), j.current = n;
    const _ = y.watch(p, (k) => {
      for (const z of k)
        if (z.type === "change") {
          const O = y.value(p);
          j.current = O, b.current.onChange?.(O);
        } else z.type === "caret" ? b.current.onCaret?.({ line: z.line, col: z.col }) : z.type === "save" ? b.current.onSave?.() : z.type === "goto" ? W(!0) : z.type === "contextmenu" && U({ x: z.x, y: z.y });
    });
    return () => {
      _(), y.park(p);
    };
  }, [p]), Lt(() => {
    !y || E || n === j.current || (j.current = n, y.setValue(p, n, { external: !0 }));
  }, [p, n]), Lt(() => {
    y?.setReadonly(p, !!s);
  }, [p, s]), Lt(() => {
    y?.setWrap(p, !!u);
  }, [p, u]), !y)
    return X.createElement("textarea", { className: "h-full min-h-0 w-full flex-1 bg-transparent font-mono text-text", "aria-label": m, value: n, readOnly: s, onChange: (_) => a?.(_.target.value) });
  const g = (_) => () => {
    U(null), _(), y.focus(p);
  }, h = R ? !!y.selection(p) : !1;
  return X.createElement(
    "div",
    { className: "relative flex h-full min-h-0 min-w-0 flex-1 flex-col", "aria-label": m },
    F && X.createElement(Ax, {
      onGo: (_, k) => {
        W(!1), y.goTo(p, _, k), y.focus(p);
      },
      onClose: () => {
        W(!1), y.focus(p);
      }
    }),
    X.createElement("div", { "data-perch-engine": "editor", "data-perch-key": p, className: "min-h-0 min-w-0 flex-1" }),
    R && X.createElement(Pv, {
      x: R.x,
      y: R.y,
      readOnly: !!s,
      canUndo: y.canUndo(p),
      canRedo: y.canRedo(p),
      hasSelection: h,
      onClose: () => U(null),
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
          U(null), W(!0);
        },
        ...v ? { askAgent: () => {
          U(null), B();
        } } : {}
      }
    })
  );
}
const Ox = Object.freeze({ pages: [], shownId: null, tabCount: 0 });
function Rx(n) {
  const a = Ht((i) => i.browserPages?.(n) ?? Ox);
  return X.useMemo(() => {
    const i = (o, s) => bt().command(o, { workspaceId: n, ...s });
    return {
      pages: a.pages ?? [],
      shownId: a.shownId ?? null,
      tabCount: a.tabCount ?? 0,
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
  }, [a, n]);
}
function Dx({ pageId: n, active: a }) {
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
const Px = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  AgentIcon: up,
  BrowserPage: Dx,
  Chevron: Is,
  CloseIcon: Xv,
  CodeEditor: jx,
  ConfirmDialog: Ly,
  Dialog: Wy,
  DiffView: pp,
  EllipsisIcon: Qv,
  FileAsset: Cx,
  FileEntryMenu: lx,
  FileIcon: R1,
  FolderBrowser: Xy,
  GearIcon: Kv,
  GitMarker: H1,
  HostStateDot: Zv,
  InstructionsDialog: Zy,
  MarkdownPreview: ax,
  MemoryDialog: Jy,
  ModeSwitch: V1,
  NewFilePrompt: Sx,
  NewSessionMenu: qy,
  PageIcon: y1,
  PlusIcon: Fm,
  QrCode: I1,
  Select: Vy,
  SessionDot: Dy,
  SessionMenu: Uy,
  SettingRow: ty,
  SettingsGroup: P1,
  SettingsQuery: Dl,
  Slot: By,
  Submenu: h1,
  Switch: ey,
  TabDragLayer: kx,
  TabMenu: _x,
  WorktreeMenu: $y,
  agentStateColor: yy,
  anchoredPopoverStyle: fy,
  assetKind: tp,
  beginReorderDrag: tx,
  beginTabDrag: vx,
  bindHost: dy,
  buttonClass: gy,
  cn: jt,
  drawConfirmationsInPlace: Yy,
  drawFolderBrowserInPlace: Qy,
  drawWorktreeInPlace: Fy,
  ghostButton: by,
  glassClass: sy,
  iconButton: vy,
  isMac: ip,
  keyLabel: Bs,
  menuDividerClass: tr,
  menuItemClass: rp,
  menuPanel: yr,
  nestSessions: Ry,
  newId: my,
  openBrowserTab: xx,
  openFileTab: wx,
  pickFolder: ky,
  redeemUsageReset: hx,
  refreshUsage: px,
  resetZoom: gx,
  rowActionClass: hy,
  runCommand: xr,
  segmentClass: py,
  settingsClass: ay,
  shortcutFor: xy,
  shortcutLabel: op,
  startPaneWhenReady: mp,
  startSession: _y,
  tabStateClass: bx,
  tapButtonClass: cy,
  tip: wy,
  useAddProject: zy,
  useAddProjectRequest: Oy,
  useAgentChoices: jy,
  useBrowserPages: Rx,
  useDismissOnOutsideClick: Pm,
  useGitReview: Tx,
  useHostSnapshot: Ht,
  useHosts: Sy,
  useKeybindings: dx,
  useNavigation: sp,
  useNewTabRequest: yx,
  useNotifications: Ay,
  usePaneLook: ux,
  usePlanUsage: mx,
  useResourceState: oy,
  useSessionFolders: Ey,
  useSettingsQuery: ny,
  useStatusLine: sx,
  useWorkspaceFiles: ox,
  useWorkspaceTabs: ex,
  useZoom: cx,
  version: uy
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
//! the rest get none. A node with a `title` (or an icon-only button with an `aria-label`) gets that text as its
//! hover tooltip, so it also gets an id. Display-none nodes are left out; a named node that is invisible or fully transparent (a
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
const tc = {
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
  tc[n] = (a, i) => a[n](i);
const tw = Object.keys(tc);
function gs(n, a) {
  for (const [i, o] of Object.entries(a)) {
    const s = tc[i];
    if (!s) throw new Error(`the description key ${i} has no GPUI builder`);
    o != null && (n = s(n, o));
  }
  return n;
}
const ua = (n) => ({ clientX: n?.position?.x ?? 0, clientY: n?.position?.y ?? 0 }), Us = /* @__PURE__ */ new WeakSet(), er = /* @__PURE__ */ new WeakSet();
function Pf(n, a, i) {
  const o = n.pressed, s = ua(i);
  return o && o.x === s.clientX && o.y === s.clientY ? o.id : a;
}
function Bx(n, a, i, o) {
  if (n.name) return n.name;
  if (!(a.size || n.hover || n.focus || n.active || n.track_hover && mr.has(n.group) || i || o)) return null;
  const s = n.meta?.attrs["data-testid"];
  return s ? `~${n.id}:${s}` : `~${n.id}`;
}
const hp = (n) => (n.children ?? []).some((a) => a.kind === "text" ? String(a.text ?? "").trim() !== "" : hp(a));
function Hx(n) {
  const a = n.meta?.attrs;
  return a && (a.title || (n.meta.tag === "button" && a["aria-label"] && !hp(n) ? a["aria-label"] : "") || a["data-overflow-title"]) || "";
}
const gp = (n, a = !1) => (n.children ?? []).some((i) => i.kind === "text" ? !a || /\s/.test(String(i.text ?? "").trim()) : i.kind === "div" && i.style?.flex_direction !== "row" && i.style?.whitespace !== "nowrap" && gp(i, !0)), Te = (n) => n.style?.display !== "hidden";
let mr = /* @__PURE__ */ new Set(), La = null;
function bp(n, a) {
  for (const i of n.children ?? []) {
    if (i.kind === "text") continue;
    if (i.id === a) return [i];
    const o = bp(i, a);
    if (o.length) return [i, ...o];
  }
  return [];
}
let qs = null;
const tm = /* @__PURE__ */ new WeakMap();
function vp(n, a = /* @__PURE__ */ new Set()) {
  let i = tm.get(n);
  if (!i) {
    i = /* @__PURE__ */ new Set();
    for (const { group: o, style: s } of n.group_hover ?? []) "display" in s && i.add(o);
    for (const o of n.children ?? []) if (o.kind !== "text") for (const s of vp(o)) i.add(s);
    tm.set(n, i);
  }
  for (const o of i) a.add(o);
  return a;
}
let $e = null;
const Ux = (n, a, i, o, s, u, m) => `${+a}|${i}|${o.text_size}|${o.line_height}|${o.whitespace}|${o.text_ellipsis}|${+s}|${u ? `${u.group}|${u.color}` : ""}|${+Us.has(n)}|${+er.has(n)}|${m.get(n)?.flex_basis ?? ""}`, em = /* @__PURE__ */ new WeakMap();
function yp(n) {
  let a = em.get(n);
  return a === void 0 && (a = n.style.overflow_x === "scroll" || n.style.overflow_y === "scroll" || (n.children ?? []).some((i) => i.kind !== "text" && yp(i)), em.set(n, a)), a;
}
function xp(n, a, i, o) {
  let s = qx(a.get(n), i.get(n));
  if (n.kind === "text") return s;
  for (const u of n.children ?? []) xp(u, a, i, o) || (s = !1);
  return s && o.add(n), s;
}
function qx(n, a) {
  if (n === a) return !0;
  if (!n || !a) return !1;
  const i = Object.keys(n);
  if (i.length !== Object.keys(a).length) return !1;
  for (const o of i) if (n[o] !== a[o]) return !1;
  return !0;
}
function Gs(n, a, i, o, s = !1, u = !1, m = null, f = {}, p = !1, v = /* @__PURE__ */ new Map(), x = null) {
  if (n.kind === "text") return v.get(n)?.text ?? n.text;
  const y = $e && !s && !yp(n) && !La?.has(n.id) ? Ux(n, u, m, f, p, x, v) : null;
  if (y !== null && $e.clean.has(n)) {
    const S = $e.from.get(n), T = S?.key === y ? a.reuse(S.id, $e.generation) : null;
    if (T)
      return $e.next.set(n, { id: T.__id, key: y }), T;
  }
  const b = Gx(n, a, i, o, s, u, m, f, p, v, x);
  return y !== null && $e.next.set(n, { id: b.__id, key: y }), b;
}
function Gx(n, a, i, o, s, u, m, f, p, v, x) {
  const y = Us.has(n);
  u ||= n.style.opacity === 0 || n.style.visibility === "invisible" || n.style.display === "hidden", u && (n.name || n.range_name) && (n = { ...n, name: void 0, range_name: void 0, also: void 0 }), n.style.text_color !== void 0 && (x = null), m = n.style.text_color ?? m;
  const b = !!n.hover?.text_color && Sp(n), S = n.group ?? (b ? `~g${n.id}` : null);
  b && (x = { group: S, color: n.hover.text_color }), f = { ...f };
  for (const M of ["text_size", "line_height", "whitespace", "text_ellipsis"]) n.style[M] !== void 0 && (f[M] = n.style[M]);
  const T = new Set(n.events ?? []), E = s ? { count: 0, hits: /* @__PURE__ */ new Set(), at: null } : !u && !n.pointer_none && n.style.position === "absolute" ? qs : null, N = E ? E.count++ : -1;
  s && (qs = E);
  let j;
  if (n.kind === "image" && !n.markup ? j = a.image(n.src) : j = a.div(), n.kind === "engine" && (j = j.child(o.engine ? o.engine(n.engine, n.key) : a.div())), n.markup && n.kind === "svg" && x && x.color !== m) {
    const { group: M, color: Y } = x, Z = () => a.div().absolute().top(0).left(0).size_full();
    j = j.child(Z().group_hover(M, (D) => D.invisible()).child(o.icon(`~icon-${n.id}`, n.markup, m))).child(Z().invisible().group_hover(M, (D) => D.visible()).child(o.icon(`~icon-${n.id}-hover`, n.markup, Y)));
  } else n.markup && (j = j.child(o.icon(`~icon-${n.id}`, n.markup, n.kind === "svg" ? m : "")));
  const R = u ? "" : Hx(n), U = Bx(n, T, !!E, !!R);
  if (U && (j = j.id(U)), R && (j = j.tooltip(R, !n.meta.attrs.title && R === n.meta.attrs["data-overflow-title"])), n.measure && (j = j.measure(n.measure)), La?.has(n.id) && !(n.children ?? []).some((M) => La.has(M.id)) && (La = null, j = j.reveal_in(a.scroll)), n.name && j.also_named) for (const M of n.also ?? []) j = j.also_named(M);
  j = gs(j, { ...n.style, ...v.get(n) });
  const F = f.whitespace !== "nowrap" && !f.text_ellipsis;
  p && F && n.style.flex_shrink !== 0 && n.style.min_w === void 0 && gp(n) && (j = j.min_w(0));
  for (const M of ["hover", "focus", "active"]) n[M] && (j = j[M]((Y) => gs(Y, n[M])));
  S && (j = j.group(S));
  for (const { group: M, style: Y } of n.group_hover ?? []) {
    const { display: Z, ...D } = Y;
    Object.keys(D).length && (j = j.group_hover(M, (Q) => gs(Q, D)));
  }
  if (a.scroll && (n.style.overflow_x === "scroll" || n.style.overflow_y === "scroll")) {
    const M = i.document?.scrollTarget;
    if ((M ? (n.children ?? []).filter(Te).findIndex((Z) => kp(Z, M.id)) : -1) >= 0 && (i.scroller ?? n.id) === n.id && (i.document.scrollTarget = null, i.scroller = n.id, La = new Set(bp(n, M.id).map((Z) => Z.id))), i.scroller ??= n.id, i.scroller === n.id && i.document) {
      j = j.track_scroll(a.scroll);
      const Z = (n.children ?? []).filter(Te).map((D) => D.id);
      i.document.itemBounds = (D) => Z.includes(D) ? a.scroll.item_bounds?.(Z.indexOf(D)) ?? null : null;
    }
  }
  const W = n.style.overflow_x === "scroll" || n.style.overflow_y === "scroll", B = s && !n.pointer_none || n.blocks_pointer;
  if ((W && er.has(n) || B) && (j = j.on_scroll_wheel((M, Y) => Y.stop_propagation?.())), W && T.has("scroll") && (j = j.on_scroll_wheel((M, Y) => {
    i.dispatch(n.id, "scroll", {}), Y.notify();
  })), W || er.has(n)) for (const M of n.children ?? []) M.kind !== "text" && er.add(M);
  n.kind === "input" && !n.disabled && (j = j.on_mouse_down("left", (M, Y) => {
    M.bounds && i.setBounds(n.id, M.bounds), i.focus(n.id), Y.notify();
  }));
  const g = n.kind === "input" ? n : n.meta?.tag === "label" ? _p(n) : null;
  g && !g.disabled && /^(checkbox|radio)$/.test(g.input_type) && (j = j.on_click((M, Y) => {
    Y.stop_propagation?.(), i.toggle(g.id), Y.notify();
  }));
  const h = ["click", "double_click", "context_menu", "mouse_down", "mouse_up"].some((M) => T.has(M));
  if (h || y) for (const M of n.children ?? []) M.kind !== "text" && Us.add(M);
  if (h && (j = j.on_mouse_down("left", (M, Y) => {
    Y.stop_propagation?.(), M.bounds && i.setBounds(n.id, M.bounds);
    const Z = { ...ua(M), button: 0, buttons: 1, detail: M.click_count }, D = Pf(i, n.id, M);
    i.pressed = null, i.dispatch(D, "pointerdown", { ...Z, pointerType: "mouse" }), i.dispatch(D, "mousedown", Z) && i.pressFocus?.(D), Y.notify();
  }), j = j.on_mouse_down("right", (M, Y) => {
    Y.stop_propagation?.(), M.bounds && i.setBounds(n.id, M.bounds);
    const Z = Pf(i, n.id, M);
    i.pressed = null, i.dispatch(Z, "contextmenu", { ...ua(M), button: 2 }), Y.notify();
  }), j = j.on_mouse_up("left", (M, Y) => {
    Y.stop_propagation?.();
    const Z = { ...ua(M), button: 0 };
    i.dispatch(n.id, "pointerup", { ...Z, pointerType: "mouse" }), i.dispatch(n.id, "mouseup", Z), Y.notify();
  }), j = j.on_click((M, Y) => {
    i.dispatch(n.id, M.click_count === 2 && T.has("double_click") ? "dblclick" : "click", { detail: M.click_count, button: 0 }), Y.notify();
  })), n.blocks_pointer && !h)
    for (const M of ["left", "right"]) j = j.on_mouse_down(M, (Y, Z) => Z.stop_propagation?.());
  else if (y && !h)
    for (const M of ["left", "right"])
      j = j.on_mouse_down(M, (Y) => {
        const Z = ua(Y);
        (i.pressed?.x !== Z.clientX || i.pressed?.y !== Z.clientY) && (i.pressed = { id: n.id, x: Z.clientX, y: Z.clientY });
      });
  if (T.has("mouse_move") && (j = j.on_mouse_move((M) => {
    i.dispatch(n.id, "pointermove", { ...ua(M), pointerType: "mouse" });
  })), n.track_hover && mr.has(n.group) && (j = j.on_hover((M, Y) => {
    i.hover(n.id, M), Y.notify();
  })), E && (j = j.on_mouse_down_out((M, Y) => {
    const Z = ua(M), D = `${Z.clientX},${Z.clientY}`;
    E.at !== D && (E.at = D, E.hits = /* @__PURE__ */ new Set()), E.hits.add(N), !(E.hits.size < E.count) && (E.at = null, i.dispatch(i.document.body.id, "pointerdown", { ...Z, pointerType: "mouse" }), i.dispatch(i.document.body.id, "mousedown", Z), Y.notify());
  })), n.kind === "input" && !/^(checkbox|radio|range|color|file|select)$/.test(n.input_type)) {
    const M = n.value ? String(n.value) : String(n.placeholder ?? "");
    let Y = a.div().whitespace_nowrap().overflow_x_hidden();
    const Z = da(f);
    Z && (Y = Y.h(Z)), !n.value && m && (Y = Y.text_color(Lx(m)));
    const D = n.input_type === "password" && n.value ? "•".repeat([...M].length) : M;
    if (n.caret) {
      const Q = a.div().w(1).flex_none().bg(m ?? "#ffffff").loop("opacity", { from: 1, to: 0, period: 800, easing: "linear" });
      Y = Y.flex().flex_row(), Y = n.value ? Y.child(D).child(Q) : M ? Y.child(Q.mr(-1)).child(M) : Y.child(Q.h(Z ?? Math.round((f.text_size ?? 13) * 1.2))), j = j.child(Y);
    } else M && (j = j.child(Y.child(D)));
    n.field_w && (j = j.child(a.div().w(n.field_w).h(0))), n.input_type !== "textarea" && (j = j.flex().flex_col().justify_center());
  }
  const _ = f.whitespace === "nowrap" ? da(f) : null, k = n.style.display === "flex" && !String(n.style.flex_direction ?? "row").startsWith("col");
  let z = !n.range_name;
  const O = n.style.display === "flex" && String(n.style.flex_direction ?? "row").startsWith("col") && (n.style.h === void 0 || n.style.h === "auto") && typeof n.style.max_h == "number";
  for (const M of (n.children ?? []).filter(Te)) {
    const Y = M.style?.flex_basis;
    O && M.style.flex_grow > 0 && (Y === 0 || typeof Y == "string" && Y.endsWith("%")) && v.set(M, { ...v.get(M), flex_basis: "auto" });
    let Z = Gs(M, a, i, o, !1, u, m, f, k && M.style?.position !== "absolute", v, x);
    const D = !z && (M.kind === "text" || !M.meta), Q = M.kind === "text" ? v.get(M)?.h ?? _ : null, I = M.kind === "text" ? v.get(M)?.w : void 0;
    if (D || Q || I !== void 0) {
      let G = a.div();
      D && (G = G.id(n.range_name)), D && !k && n.style.display === "flex" && (G = G[`self_${Yx[f.text_align] ?? "start"}`]().max_w("100%")), Q && (G = G.h(Q)), I !== void 0 && (G = G.w(I).flex_none().whitespace_nowrap()), Z = G.child(Z), z ||= D;
    }
    j = j.child(Z);
  }
  return j;
}
const Yx = { center: "center", right: "end", end: "end" };
function Lx(n) {
  const a = String(n);
  if (!/^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(a)) return n;
  const i = a.length === 9 ? Number.parseInt(a.slice(7), 16) : 255;
  return `${a.slice(0, 7)}${Math.round(i / 2).toString(16).padStart(2, "0")}`;
}
const wp = /^(?:[!-,.-~]+|\S)$/u, _p = (n) => {
  for (const a of n.children ?? []) {
    if (a.kind === "input" && /^(checkbox|radio)$/.test(a.input_type)) return a;
    const i = a.kind === "text" ? null : _p(a);
    if (i) return i;
  }
  return null;
}, kp = (n, a) => n.id === a || (n.children ?? []).some((i) => i.kind !== "text" && kp(i, a)), Sp = (n) => !!n.markup || (n.children ?? []).some((a) => a.kind !== "text" && Sp(a));
function da(n) {
  const a = n.line_height;
  return typeof a == "string" && a.endsWith("px") ? Number.parseFloat(a) : typeof a == "number" && typeof n.text_size == "number" ? a * n.text_size : null;
}
function ew(n, a, i, o, s = 0, u = !1) {
  const m = [n.root, ...n.overlays];
  mr = /* @__PURE__ */ new Set(), qs = null;
  for (const b of m) vp(b, mr);
  const f = s > 0 ? Wx(m, s) : /* @__PURE__ */ new Map();
  s > 0 && o.measure && Vx(m, s, o.measure, f), Zx(m, f), Xx(m, f), o.measure && Kx(m, o.measure, f);
  const p = a.reuse && a.renderGeneration ? i.retained ??= { built: /* @__PURE__ */ new Map(), overrides: /* @__PURE__ */ new Map(), generation: -1 } : null, v = new Map(f);
  p && n.root && ($e = { from: p.built, generation: p.generation, clean: /* @__PURE__ */ new Set(), next: /* @__PURE__ */ new Map() }, xp(n.root, f, p.overrides, $e.clean));
  let x;
  try {
    x = a.div().relative().size_full().child(Gs(n.root, a, i, o, !1, !1, null, {}, !1, f)), p && Object.assign(p, { built: $e?.next ?? /* @__PURE__ */ new Map(), overrides: v, generation: a.renderGeneration() ?? -1 });
  } finally {
    $e = null, La = null;
  }
  let y = u && n.overlays.length ? a.div().relative().size_full().window_layer() : x;
  for (const b of n.overlays) y = y.child(Gs(b, a, i, o, !0, !1, null, {}, !1, f));
  return y === x ? x : x.child(y);
}
function Vx(n, a, i, o) {
  (Wi.scale !== a || Wi.measure !== i) && (Wi = { scale: a, measure: i, widths: /* @__PURE__ */ new WeakMap(), fonts: /* @__PURE__ */ new WeakMap(), keys: /* @__PURE__ */ new WeakMap(), visits: /* @__PURE__ */ new WeakMap() });
  const { widths: s, fonts: u, keys: m, visits: f } = Wi, p = [], v = (R, U) => o.set(R, { ...o.get(R), ...U }), x = (R, U) => {
    p.push(R, U), v(R, U);
  }, y = ["text_size", "font_weight", "font_family", "italic", "whitespace", "text_ellipsis"];
  function b(R, U, F) {
    if (R.kind === "text") {
      if (!(U.whitespace === "nowrap" || wp.test(R.text)) || U.text_ellipsis || F || typeof U.text_size != "number") return NaN;
      const O = i(R.text, { size: U.text_size, weight: U.font_weight ?? 400, family: U.font_family ?? ".SystemUIFont", italic: !!U.italic });
      return Number.isFinite(O) ? O : NaN;
    }
    if (!Te(R) || R.kind === "input" || R.kind === "engine" || R.markup) return S(R);
    const W = `${U.text_size}|${U.font_weight}|${U.font_family}|${U.italic}|${U.whitespace}|${U.text_ellipsis}|${+F}`;
    if (m.get(R) === W && s.has(R)) return s.get(R);
    m.set(R, W);
    const B = { ...U };
    for (const z of y) R.style[z] !== void 0 && (B[z] = R.style[z]);
    B.text_ellipsis = !!R.style.text_ellipsis, u.set(R, B);
    const g = R.style, h = (R.children ?? []).filter(Ve), _ = h.map((z) => b(z, B, F || !!R.tabular));
    let k = S(R);
    if (!Number.isFinite(k) && g.w === void 0) {
      const z = h.map((M, Y) => _[Y] + (M.kind === "text" ? 0 : ot(M.style.ml) + ot(M.style.mr)));
      let O;
      h.length ? Re(R) ? O = h.some((M) => M.kind !== "text" && M.style.flex_grow > 0) || g.flex_wrap === "wrap" ? NaN : z.reduce((M, Y) => M + Y, 0) + ot(g.gap_x) * (h.length - 1) : O = Math.max(...z) : O = 0, k = O + ot(g.pl) + ot(g.pr) + ot(g.border_l) + ot(g.border_r), typeof g.min_w == "number" && (k = Math.max(k, g.min_w)), typeof g.max_w == "number" && (k = Math.min(k, g.max_w));
    }
    return s.set(R, k), k;
  }
  const S = (R) => typeof R.style?.w == "number" ? R.style.w : NaN, T = () => ({ exact: 0, laid: 0 }), E = (R, U) => {
    if (!Number.isFinite(U))
      return Object.assign(R, T()), NaN;
    R.exact += U;
    const F = Math.round(R.exact * a + 1e-9) / a, W = F - R.laid;
    return R.laid = F, W;
  }, N = (R) => Re(R) && R.style.flex_wrap !== "wrap" && (R.style.justify ?? "start") === "start";
  function j(R) {
    if (!R || R.kind === "text" || !Te(R)) return;
    const U = m.get(R), F = f.get(R);
    if (F && U !== void 0 && F.key === U) {
      for (let g = 0; g < F.log.length; g += 2)
        p.push(F.log[g], F.log[g + 1]), v(F.log[g], F.log[g + 1]);
      return;
    }
    const W = p.length, B = (R.children ?? []).filter(Ve);
    if (N(R) && B.length > 1) {
      const g = ot(R.style.gap_x), h = T(), _ = !(g && B.some((k) => k.kind === "text" || !Number.isFinite(ot(k.style.ml))));
      x(R, { border_l: E(h, ot(R.style.border_l)), pl: E(h, ot(R.style.pl)) }), _ && g && x(R, { gap_x: 0 }), B.forEach((k, z) => {
        const O = (z && _ ? g : 0) + (k.kind === "text" ? 0 : ot(k.style.ml));
        if (k.kind === "text")
          O && Object.assign(h, T());
        else {
          const D = E(h, O);
          Number.isFinite(D) && x(k, { ml: D });
        }
        const M = k.kind === "text" ? u.get(R) ?? {} : null, Y = k.kind === "text" ? b(k, M, !!R.tabular) : s.get(k);
        if ((k.kind === "text" || !(k.style.flex_grow > 0)) && Number.isFinite(Y)) {
          const D = { w: E(h, Y) };
          k.kind !== "text" && typeof k.style.w != "number" && k.style.min_w === void 0 && (D.whitespace = "nowrap", D.flex_shrink = 0), x(k, D);
        } else Object.assign(h, T());
        if (k.kind !== "text") {
          const D = E(h, ot(k.style.mr));
          Number.isFinite(D) && x(k, { mr: D });
        }
      });
    }
    for (const g of R.children ?? []) g.kind !== "text" && j(g);
    U !== void 0 && f.set(R, { key: U, log: p.slice(W) });
  }
  for (const R of n)
    R && (b(R, {}, !1), j(R));
}
let Wi = { scale: 0, measure: null };
const Qx = /(?<= +)(?=[^ ])|(?<=[\p{L}\p{N}]-)(?=[\p{L}\p{N}])/u;
function Kx(n, a, i) {
  const o = ["text_size", "font_weight", "font_family", "italic", "line_height"], s = (x) => typeof x == "number" ? x : 0, u = (x, y) => y && pr(y) && !Re(y) && x.style.position !== "absolute" && !["start", "center", "end"].includes(x.style.self) && !["start", "center", "end"].includes(y.style.items);
  Fi.measure !== a && (Fi = { measure: a, walks: /* @__PURE__ */ new WeakMap() });
  const m = [], f = (x, y) => {
    m.push(x, y), i.set(x, { ...i.get(x), ...y });
  }, p = (x, y, b, S) => {
    if (!x || x.kind === "text" || !Te(x)) return;
    const T = `${b}|${+u(x, y)}|${S.text_size}|${S.font_weight}|${S.font_family}|${S.italic}|${S.line_height}`, E = Fi.walks.get(x);
    if (E?.key === T) {
      for (let j = 0; j < E.log.length; j += 2) f(E.log[j], E.log[j + 1]);
      return;
    }
    const N = m.length;
    v(x, y, b, S), Fi.walks.set(x, { key: T, log: m.slice(N) });
  }, v = (x, y, b, S) => {
    const T = x.style;
    let E = typeof T.w == "number" ? T.w : T.w === "100%" ? b : u(x, y) ? b - s(T.ml) - s(T.mr) : NaN;
    typeof T.max_w == "number" && (E = Math.min(E, T.max_w));
    const N = E - s(T.pl) - s(T.pr) - s(T.border_l) - s(T.border_r), j = { ...S };
    for (const U of o) T[U] !== void 0 && (j[U] = T[U]);
    const R = x.children ?? [];
    if (x.break_anywhere && Number.isFinite(N) && N > 0 && typeof j.text_size == "number" && R.length && R.every((U) => U.kind === "text")) {
      const U = { size: j.text_size, weight: j.font_weight ?? 400, family: j.font_family ?? ".SystemUIFont", italic: !!j.italic }, F = (g) => a(g.trimEnd(), U) <= N + 0.01;
      let W = 0;
      for (const g of R) {
        const h = [];
        for (const k of g.text.split(`
`)) {
          let z = "";
          for (const O of k.split(Qx)) {
            if (F(z + O)) {
              z += O;
              continue;
            }
            z && h.push(z.trimEnd()), z = "";
            for (const M of O)
              z && !F(z + M) && (h.push(z), z = ""), z += M;
          }
          h.push(z.trimEnd());
        }
        const _ = h.join(`
`);
        h.every((k) => !k || F(k)) ? _ !== g.text && f(g, { text: _ }) : W = NaN, W += h.length;
      }
      const B = da(j);
      Number.isFinite(W) && B && T.h === void 0 && R.length === 1 && f(x, { h: W * B + s(T.pt) + s(T.pb) + s(T.border_t) + s(T.border_b) });
    }
    for (const U of R) p(U, x, Re(x) ? NaN : N, j);
  };
  for (const x of n) p(x, null, NaN, {});
}
let Fi = { measure: null };
function Xx(n, a) {
  const i = (o, s) => {
    if (!o || o.kind === "text" || !Te(o)) return;
    const u = o.style, m = u.position === "absolute" ? u.w === void 0 && (u.left === void 0 || u.right === void 0) : s && typeof u.w != "number";
    if (m && Re(o))
      for (const f of o.children ?? []) {
        const p = f.kind === "text" ? void 0 : f.style.flex_basis;
        f.kind !== "text" && f.style.flex_grow > 0 && (p === 0 || typeof p == "string" && p.endsWith("%")) && a.set(f, { ...a.get(f), flex_basis: "auto" });
      }
    for (const f of o.children ?? []) i(f, m);
  };
  for (const o of n) i(o, !1);
}
function Zx(n, a) {
  const i = a.heights ?? /* @__PURE__ */ new Map(), o = (p) => i.get(p), s = (p) => {
    const v = o(p);
    if (Number.isFinite(v)) return v;
    if (p.kind === "text" || !Te(p)) return 0;
    const x = p.style, y = typeof x.min_h == "number" ? x.min_h : 0, b = (p.children ?? []).filter(Ve), S = b.map((N) => s(N) + (N.kind === "text" ? 0 : Math.max(0, ot(N.style.mt) || 0) + Math.max(0, ot(N.style.mb) || 0))), T = b.length ? Re(p) ? Math.max(...S) : S.reduce((N, j) => N + j, 0) + (x.display === "flex" ? (ot(x.gap_y) || 0) * (b.length - 1) : 0) : 0, E = [x.pt, x.pb, x.border_t, x.border_b].reduce((N, j) => N + (ot(j) || 0), 0);
    return Math.max(y, T + E);
  }, u = (p) => !(p.children ?? []).filter(Ve).length || Re(p) ? NaN : s({ ...p, style: { ...p.style, h: void 0, max_h: void 0, min_h: void 0 } }), m = (p, v) => {
    const x = p.style;
    if (typeof x.h == "number") return x.h;
    if (typeof x.max_h == "number") return x.max_h;
    if (!v || !pr(v) || Re(v)) return NaN;
    const y = v.style, b = typeof y.h == "number" ? y.h : typeof y.max_h == "number" ? y.max_h : NaN, S = (v.children ?? []).filter(Ve);
    let T = 0;
    for (const N of S) {
      if (N === p) continue;
      const j = o(N);
      if (!Number.isFinite(j)) return NaN;
      T += j + (N.kind === "text" ? 0 : ot(N.style.mt) + ot(N.style.mb));
    }
    const E = y.display === "flex" ? ot(y.gap_y) * Math.max(0, S.length - 1) : 0;
    return b - ot(y.pt) - ot(y.pb) - ot(y.border_t) - ot(y.border_b) - T - E - ot(x.mt) - ot(x.mb);
  }, f = (p, v) => {
    if (!(!p || p.kind === "text" || !Te(p))) {
      if (p.scrollbar > 0 && p.style.overflow_y === "scroll") {
        const x = u(p), y = m(p, v);
        Number.isFinite(x) && Number.isFinite(y) && x > y + 0.01 && a.set(p, { ...a.get(p), pr: ot(p.style.pr) + p.scrollbar });
      }
      for (const x of p.children ?? []) f(x, p);
    }
  };
  for (const p of n) f(p, null);
}
const Jx = ["text_size", "line_height", "whitespace", "text_ellipsis"], ot = (n) => n == null ? 0 : typeof n == "number" ? n : NaN, pr = (n) => n.style.display === "flex" ? n.style.flex_direction === "col" : !0, Re = (n) => n.style.display === "flex" && (n.style.flex_direction ?? "row") === "row", Ve = (n) => n.kind === "text" || Te(n) && n.style.position !== "absolute";
function Wx(n, a) {
  bs.scale !== a && (bs = Ep(a));
  const { heights: i, texts: o, textKeys: s, visits: u, places: m } = bs, f = /* @__PURE__ */ new Map(), p = [], v = (B, g) => {
    const h = f.get(B);
    f.set(B, h ? { ...h, ...g } : g);
  }, x = (B, g) => {
    let h = null;
    for (const _ in g)
      Number.isFinite(g[_]) && ((h ??= {})[_] = g[_]);
    h && (p.push(B, h), v(B, h));
  }, y = (B) => {
    for (let g = 0; g < B.length; g += 2)
      p.push(B[g], B[g + 1]), v(B[g], B[g + 1]);
  };
  function b(B, g) {
    if (B.kind === "text") return g.whitespace === "nowrap" || wp.test(B.text) ? da(g) ?? NaN : NaN;
    const h = `${g.text_size}|${g.line_height}|${g.whitespace}|${g.text_ellipsis}`;
    if (s.get(B) === h && i.has(B)) return i.get(B);
    let _ = g;
    for (const Y of Jx) B.style[Y] !== void 0 && B.style[Y] !== _[Y] && (_ === g && (_ = { ...g }), _[Y] = B.style[Y]);
    s.set(B, h), o.set(B, _);
    const k = B.style, z = (B.children ?? []).filter(Ve), O = z.map((Y) => b(Y, _));
    let M;
    if (k.h !== void 0 && k.h !== "auto") M = ot(k.h);
    else if (B.kind === "engine") M = NaN;
    else if (B.kind === "input")
      M = (B.input_type === "textarea" || B.input_type === "select" ? NaN : da(_) ?? NaN) + ot(k.pt) + ot(k.pb) + ot(k.border_t) + ot(k.border_b), k.min_h !== void 0 && (M = Math.max(M, ot(k.min_h)));
    else {
      const Y = z.map((D, Q) => (D.kind === "text" ? 0 : ot(D.style.mt) + ot(D.style.mb)) + O[Q]);
      let Z;
      if (Re(B)) Z = k.flex_wrap === "wrap" ? NaN : k.items === "baseline" ? T(z, O, _) : Math.max(0, ...Y);
      else if (pr(B)) {
        const D = z.some((I) => I.kind !== "text" && (I.style.flex_grow > 0 || I.style.flex_basis !== void 0)), Q = k.display !== "flex" && z.some((I) => I.kind !== "text" && (ot(I.style.mt) || ot(I.style.mb)));
        Z = D || Q ? NaN : Y.reduce((I, G) => I + G, 0) + (k.display === "flex" ? ot(k.gap_y) * Math.max(0, z.length - 1) : 0);
      } else Z = NaN;
      M = Z + ot(k.pt) + ot(k.pb) + ot(k.border_t) + ot(k.border_b), k.min_h !== void 0 && (M = Math.max(M, ot(k.min_h))), k.max_h !== void 0 && (M = Math.min(M, ot(k.max_h)));
    }
    return i.set(B, M), M;
  }
  const S = (B) => (da(B) - (ur + zm) * B.text_size) / 2 + ur * B.text_size;
  function T(B, g, h) {
    let _ = 0, k = 0;
    for (const [z, O] of B.entries()) {
      const M = O.kind === "text" ? h : o.get(O);
      if (!(O.kind === "text" || (O.children ?? []).filter(Ve).every((Q) => Q.kind === "text")) || !Number.isFinite(g[z]) || typeof M.text_size != "number") return NaN;
      const Z = O.kind === "text" ? {} : O.style, D = ot(Z.mt) + ot(Z.border_t) + ot(Z.pt) + S(M);
      _ = Math.max(_, D), k = Math.max(k, ot(Z.mt) + g[z] + ot(Z.mb) - D);
    }
    return _ + k;
  }
  const E = () => ({ exact: 0, laid: 0 }), N = (B, g) => {
    if (!Number.isFinite(g))
      return Object.assign(B, E()), NaN;
    B.exact += g;
    const h = Math.round(B.exact * a + 1e-9) / a, _ = h - B.laid;
    return B.laid = h, _;
  };
  function j(B) {
    if (B.kind === "text" || !Te(B)) return;
    const g = s.get(B), h = u.get(B);
    if (h && g !== void 0 && h.key === g) return y(h.log);
    const _ = p.length;
    for (const k of (B.children ?? []).filter((z) => z.kind !== "text" && Te(z) && z.style.position === "absolute")) j(k);
    if (pr(B) && !Re(B)) {
      const k = E();
      x(B, { border_t: N(k, ot(B.style.border_t)), pt: N(k, ot(B.style.pt)) }), R(B, k);
    } else for (const k of (B.children ?? []).filter(Ve)) k.kind !== "text" && j(k);
    g !== void 0 && u.set(B, { key: g, log: p.slice(_) });
  }
  function R(B, g) {
    const h = (B.children ?? []).filter(Ve), _ = B.style.display === "flex" ? ot(B.style.gap_y) : 0;
    if (_ && h.some((k) => k.kind === "text")) {
      for (const k of h) k.kind !== "text" && j(k);
      return !1;
    }
    return _ && x(B, { gap_y: 0 }), h.forEach((k, z) => {
      if (k.kind === "text") {
        const O = b(k, o.get(B) ?? {});
        Number.isFinite(O) ? x(k, { h: N(g, O) }) : Object.assign(g, E());
        return;
      }
      if (x(k, { mt: N(g, (z ? _ : 0) + ot(k.style.mt)) }), Number.isFinite(i.get(k))) F(k, g);
      else if (U(k)) {
        const O = k.style;
        x(k, { border_t: N(g, ot(O.border_t)), pt: N(g, ot(O.pt)) }), x(k, { pb: N(g, ot(O.pb)), border_b: N(g, ot(O.border_b)) });
      } else
        j(k), Object.assign(g, E());
      x(k, { mb: N(g, ot(k.style.mb)) });
    }), !0;
  }
  function U(B) {
    const g = B.style, h = (B.children ?? []).filter(Ve), _ = da(o.get(B) ?? {});
    return B.kind === "div" && !Re(B) && h.length > 0 && h.every((k) => k.kind === "text") && Number.isInteger(_) && [g.h, g.min_h, g.max_h].every((k) => k === void 0 || k === "auto");
  }
  function F(B, g) {
    const h = `${s.get(B)}|${Math.round((g.exact - g.laid) * 1e6)}`, _ = m.get(B);
    if (_ && _.key === h) {
      y(_.log), g.exact += _.exact, g.laid += _.laid;
      return;
    }
    const k = p.length, [z, O] = [g.exact, g.laid];
    W(B, g), m.set(B, { key: h, log: p.slice(k), exact: g.exact - z, laid: g.laid - O });
  }
  function W(B, g) {
    const h = B.style;
    for (const M of (B.children ?? []).filter((Y) => Y.kind !== "text" && Te(Y) && Y.style.position === "absolute")) j(M);
    const _ = g.laid, k = g.exact;
    x(B, { border_t: N(g, ot(h.border_t)), pt: N(g, ot(h.pt)) });
    const z = h.h !== void 0 && h.h !== "auto", O = i.get(B) - ot(h.pt) - ot(h.pb) - ot(h.border_t) - ot(h.border_b);
    if (B.kind === "input")
      z || N(g, O);
    else if (Re(B) || z && (h.justify ?? "start") !== "start") {
      for (const M of (B.children ?? []).filter(Ve)) M.kind !== "text" && j(M);
      z || N(g, O);
    } else !R(B, g) && !z && N(g, O);
    if (z) {
      g.exact = k + i.get(B), g.laid = Math.round(g.exact * a + 1e-9) / a, x(B, { h: g.laid - _ });
      return;
    }
    x(B, { pb: N(g, ot(h.pb)), border_b: N(g, ot(h.border_b)) }), x(B, { h: g.laid - _ });
  }
  for (const B of n)
    b(B, {}), j(B);
  return Object.defineProperty(f, "heights", { value: i }), f;
}
const Ep = (n) => ({ scale: n, heights: /* @__PURE__ */ new WeakMap(), texts: /* @__PURE__ */ new WeakMap(), textKeys: /* @__PURE__ */ new WeakMap(), visits: /* @__PURE__ */ new WeakMap(), places: /* @__PURE__ */ new WeakMap() });
let bs = Ep(0);
const nw = { sidebar: [{ name: "sidebar-root", selector: "aside.sidebar" }, { name: "sidebar-content", selector: "aside.sidebar > div:first-child" }, { name: "host-switcher", selector: '[data-testid="host-switcher"]' }, { name: "host-chip", selector: '[data-testid="host-switcher"] > div' }, { name: "host-badge", selector: ".sidebar__env-badge" }, { name: "host-name", selector: ".sidebar__env-host" }, { name: "host-meta", selector: '[data-testid="host-switcher"] > div > div:first-child > span:nth-child(3)' }, { name: "host-line", selector: ".sidebar__env-cwd" }, { name: "host-caret", selector: '[data-testid="host-switcher"] > span[aria-hidden="true"]' }, { name: "new-session-button", selector: 'button[data-testid^="new-session-"]', key: { self: !0, attr: "data-testid", strip: "new-session-" } }, { name: "new-session-icon", selector: 'button[data-testid^="new-session-"] > svg' }, { name: "new-session-label", selector: 'button[data-testid^="new-session-"]', textRange: !0 }, { name: "new-session-shortcut", selector: 'button[data-testid^="new-session-"] > span' }, { name: "overview", selector: '[data-testid="workspace-overview"]' }, { name: "overview-header", selector: '[data-testid="workspace-overview"] > div:first-child' }, { name: "overview-title", selector: '[data-testid="workspace-overview"] > div:first-child > div:first-child > span:first-child' }, { name: "needs-you-button", selector: '[data-testid="workspace-needs-you"]' }, { name: "organize-button", selector: '[data-testid="workspace-organize"]' }, { name: "organize-icon", selector: '[data-testid="workspace-organize"] > svg' }, { name: "add-project-button", selector: '[data-testid="workspace-add-project"]' }, { name: "add-project-icon", selector: '[data-testid="workspace-add-project"] > svg' }, { name: "add-project-label", selector: '[data-testid="workspace-add-project"]', textRange: !0 }, { name: "project-list", selector: '[data-testid="project-list"]' }, { name: "project", selector: ".workspace-project", key: { self: !0, attr: "data-testid", strip: "workspace-project-" } }, { name: "project-header", selector: ".workspace-project > div:first-child", key: { closest: ".workspace-project", attr: "data-testid", strip: "workspace-project-" } }, { name: "project-toggle", selector: '[data-testid^="project-toggle-"]', key: { self: !0, attr: "data-testid", strip: "project-toggle-" } }, { name: "project-chevron", selector: '[data-testid^="project-toggle-"] > svg:not([data-testid])', key: { closest: '[data-testid^="project-toggle-"]', attr: "data-testid", strip: "project-toggle-" } }, { name: "project-folder-icon", selector: '[data-testid="project-folder-icon"]', key: { closest: '[data-testid^="project-toggle-"]', attr: "data-testid", strip: "project-toggle-" } }, { name: "project-name", selector: '[data-testid^="project-toggle-"] strong', key: { closest: '[data-testid^="project-toggle-"]', attr: "data-testid", strip: "project-toggle-" } }, { name: "project-branch", selector: '[data-testid^="project-toggle-"] > span.whitespace-nowrap', key: { closest: '[data-testid^="project-toggle-"]', attr: "data-testid", strip: "project-toggle-" } }, { name: "project-dirty-mark", selector: '[data-testid^="project-toggle-"] > span[title="Uncommitted changes"]', key: { closest: '[data-testid^="project-toggle-"]', attr: "data-testid", strip: "project-toggle-" } }, { name: "project-rollup", selector: '[data-testid^="project-rollup-"]', key: { self: !0, attr: "data-testid", strip: "project-rollup-" } }, { name: "project-rollup-badge", selector: '[data-testid^="project-rollup-"] > span', key: { closest: '[data-testid^="project-rollup-"]', attr: "data-testid", strip: "project-rollup-" } }, { name: "project-menu-button", selector: '[data-testid^="workspace-project-menu-"]', key: { self: !0, attr: "data-testid", strip: "workspace-project-menu-" } }, { name: "project-add-button", selector: ".workspace-project > div:first-child .worktree-menu__btn", key: { closest: ".workspace-project", attr: "data-testid", strip: "workspace-project-" } }, { name: "project-workspaces", selector: ".workspace-project__workspaces", key: { closest: ".workspace-project", attr: "data-testid", strip: "workspace-project-" } }, { name: "workspace", selector: '[data-testid="workspace-tree-root"] [data-testid^="workspace-entry-"]', key: { self: !0, attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-button", selector: '[data-testid="workspace-tree-root"] button.workspace-entry__button', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-icon", selector: '[data-testid="workspace-tree-root"] [data-testid="workspace-checkout-icon"]', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-name", selector: '[data-testid="workspace-tree-root"] strong[title="Double-click to rename"]', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-branch", selector: '[data-testid="workspace-tree-root"] button.workspace-entry__button > span.items-baseline > span', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-dirty-mark", selector: '[data-testid="workspace-tree-root"] button.workspace-entry__button > span[title="Uncommitted changes"]', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-pinned-label", selector: '[data-testid="workspace-tree-root"] button.workspace-entry__button > span.shrink-0:not([title])', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "hidden-worktrees-button", selector: '[data-testid^="workspace-hidden-"]', key: { self: !0, attr: "data-testid", strip: "workspace-hidden-" } }, { name: "session-row", selector: 'div[class~="group/row"]', key: { find: 'button[data-testid^="workspace-session-"]:not([data-testid^="workspace-session-close-"])', attr: "data-testid", strip: "workspace-session-" } }, { name: "session-button", selector: 'button[data-testid^="workspace-session-"]:not([data-testid^="workspace-session-close-"])', key: { self: !0, attr: "data-testid", strip: "workspace-session-" } }, { name: "session-mark", selector: ".agent-mark", key: { closest: 'button[data-testid^="workspace-session-"]', attr: "data-testid", strip: "workspace-session-" } }, { name: "session-mark-icon", selector: ".agent-mark > span > *", key: { closest: 'button[data-testid^="workspace-session-"]', attr: "data-testid", strip: "workspace-session-" } }, { name: "session-title", selector: 'button[data-testid^="workspace-session-"] > span.whitespace-nowrap', key: { closest: 'button[data-testid^="workspace-session-"]', attr: "data-testid", strip: "workspace-session-" } }, { name: "status-row-title", selector: "button[data-session] span.truncate:not([data-testid])", key: { closest: 'button[data-testid^="workspace-session-"]', attr: "data-testid", strip: "workspace-session-" } }, { name: "status-row-detail", selector: '[data-testid="status-row-detail"]', key: { closest: 'button[data-testid^="workspace-session-"]', attr: "data-testid", strip: "workspace-session-" } }, { name: "session-state-badge", selector: '[data-testid^="session-state-"]', key: { self: !0, attr: "data-testid", strip: "session-state-" } }, { name: "session-menu-button", selector: '[data-testid^="session-menu-button-"]', key: { self: !0, attr: "data-testid", strip: "session-menu-button-" } }, { name: "session-fold-button", selector: '[data-testid^="session-fold-"]', key: { self: !0, attr: "data-testid", strip: "session-fold-" } }, { name: "session-elbow", selector: '[data-testid^="session-elbow-"]', key: { self: !0, attr: "data-testid", strip: "session-elbow-" } }, { name: "session-rollup", selector: '[data-testid^="session-rollup-"]', key: { self: !0, attr: "data-testid", strip: "session-rollup-" } }, { name: "chats", selector: '[data-testid="workspace-chats"]' }, { name: "chats-header", selector: '[data-testid="workspace-chats"] > div:first-child' }, { name: "chats-toggle", selector: '[data-testid="workspace-chats-collapse"]' }, { name: "chats-label", selector: '[data-testid="workspace-chats-collapse"]', textRange: !0 }, { name: "chats-chevron", selector: '[data-testid="workspace-chats-collapse"] > svg' }, { name: "chats-menu-button", selector: '[data-testid="workspace-chats-menu"]' }, { name: "chats-new-button", selector: '[data-testid="workspace-chats-new"]' }, { name: "chats-new-icon", selector: '[data-testid="workspace-chats-new"] > svg' }, { name: "status-view", selector: '[data-testid="workspace-status-view"]' }, { name: "status-section", selector: '[data-testid^="status-section-"]:not([data-testid^="status-section-title-"])', key: { self: !0, attr: "data-testid", strip: "status-section-" } }, { name: "status-heading", selector: '[data-testid^="status-section-title-"], [data-testid="status-no-sessions-title"]', key: { self: !0, attr: "data-testid" } }, { name: "status-heading-dot", selector: '[data-testid^="status-section-title-"] > span:first-child, [data-testid="status-no-sessions-title"] > span:first-child', key: { closest: '[data-testid^="status-section-title-"], [data-testid="status-no-sessions-title"]', attr: "data-testid" } }, { name: "status-heading-label", selector: '[data-testid^="status-section-title-"] > span:nth-child(2), [data-testid="status-no-sessions-title"] > span:nth-child(2)', key: { closest: '[data-testid^="status-section-title-"], [data-testid="status-no-sessions-title"]', attr: "data-testid" } }, { name: "status-heading-count", selector: '[data-testid^="status-section-title-"] > span[aria-label], [data-testid="status-no-sessions-title"] > span[aria-label]', key: { closest: '[data-testid^="status-section-title-"], [data-testid="status-no-sessions-title"]', attr: "data-testid" } }, { name: "status-heading-note", selector: '[data-testid^="status-section-title-"] > span.truncate, [data-testid="status-no-sessions-title"] > span.truncate', key: { closest: '[data-testid^="status-section-title-"], [data-testid="status-no-sessions-title"]', attr: "data-testid" } }, { name: "status-project", selector: 'div[data-testid^="status-project-"]', key: { self: !0, attr: "data-testid", strip: "status-project-" } }, { name: "status-project-header", selector: 'div[data-testid^="status-project-"] > div:first-child', key: { closest: 'div[data-testid^="status-project-"]', attr: "data-testid", strip: "status-project-" } }, { name: "status-project-icon", selector: 'div[data-testid^="status-project-"] > div:first-child > svg', key: { closest: 'div[data-testid^="status-project-"]', attr: "data-testid", strip: "status-project-" } }, { name: "status-project-title", selector: '[data-testid="status-project-title"]', key: { closest: 'div[data-testid^="status-project-"]', attr: "data-testid", strip: "status-project-" } }, { name: "status-empty-project", selector: '[data-testid^="status-empty-project-"]', key: { self: !0, attr: "data-testid", strip: "status-empty-project-" } }, { name: "status-empty-project-icon", selector: '[data-testid^="status-empty-project-"] > button:first-child > svg', key: { closest: '[data-testid^="status-empty-project-"]', attr: "data-testid", strip: "status-empty-project-" } }, { name: "status-empty-project-title", selector: '[data-testid^="status-empty-project-"] > button > span.whitespace-nowrap', key: { closest: '[data-testid^="status-empty-project-"]', attr: "data-testid", strip: "status-empty-project-" } }, { name: "settings-bar", selector: "aside.sidebar > div:last-child" }, { name: "settings-gear", selector: '[data-testid="settings-gear"]' }, { name: "settings-gear-icon", selector: '[data-testid="settings-gear"] > svg' }], tabs: [{ name: "tab-strip", selector: '[data-testid="tab-bar"]' }, { name: "tab-slot", selector: "[data-tab-entry]", key: { self: !0, attr: "data-tab-entry" } }, { name: "tab-separator", selector: '[data-testid="tab-separator"]', key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab", selector: "button.tab-bar__tab", key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-icon", selector: 'button.tab-bar__tab > span[aria-hidden="true"]', key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-icon-glyph", selector: 'button.tab-bar__tab > span[aria-hidden="true"] > *', key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-label", selector: "button.tab-bar__tab > span.truncate", key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-dirty", selector: 'button.tab-bar__tab > span[aria-label="unsaved changes"]', key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-stack-count", selector: '[data-testid^="tab-stack-count-"]', key: { self: !0, attr: "data-testid", strip: "tab-stack-count-" } }, { name: "tab-close", selector: '[data-tab-entry] > button[aria-label^="Close"]', key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-close-glyph", selector: '[data-tab-entry] > button[aria-label^="Close"] > svg', key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-new", selector: '[data-testid="tab-new"]' }, { name: "tab-new-glyph", selector: '[data-testid="tab-new"] > svg' }], status: [{ name: "status-bar", selector: "footer.status-bar" }, { name: "status-location", selector: ".status-bar__location" }, { name: "status-dot", selector: ".status-bar__location > span:first-child" }, { name: "status-host", selector: '[data-testid="status-host"]' }, { name: "status-cwd", selector: ".status-item--cwd" }, { name: "status-branch", selector: ".status-bar__branch" }, { name: "status-branch-icon", selector: ".status-bar__branch > svg" }, { name: "status-branch-name", selector: ".status-bar__branch > span" }, { name: "status-details", selector: ".status-bar__details" }, { name: "zoom-indicator", selector: '[data-testid="zoom-indicator"]' }, { name: "status-detail", selector: ".status-bar__details > span" }, { name: "status-usage", selector: ".status-bar__usage" }, { name: "usage-summary", selector: '[data-testid="usage-summary"]' }, { name: "usage-unavailable", selector: '[data-testid="usage-summary"] > span:only-child' }, { name: "usage-account", selector: '[data-testid="usage-summary"] > span.flex' }, { name: "usage-account-name", selector: '[data-testid="usage-summary"] > span.flex > span:first-child' }, { name: "usage-window", selector: '[data-testid="usage-summary"] > span.flex > span:not(:first-child)' }, { name: "status-connection", selector: '[data-testid="status-connection"]' }, { name: "status-connection-glyph", selector: '[data-testid="status-connection"] > svg' }], navigator: [{ name: "navigator-scrim", selector: "body > div.fixed.inset-0" }, { name: "navigator-panel", selector: '[data-testid="navigator"]' }, { name: "navigator-input", selector: '[data-testid="navigator-input"]' }, { name: "navigator-chips", selector: '[data-testid="navigator"] > div:nth-child(2)' }, { name: "navigator-chip", selector: '[data-testid^="navigator-filter-"]', key: { self: !0, attr: "data-testid", strip: "navigator-filter-" } }, { name: "navigator-list", selector: '[data-testid="navigator"] > div:nth-child(3)' }, { name: "navigator-notice", selector: '[data-testid="navigator"] > div:nth-child(3) > p[role]' }, { name: "navigator-empty", selector: '[data-testid="navigator"] div.text-center' }, { name: "navigator-command", selector: '[data-testid^="navigator-command-"]', key: { self: !0, attr: "data-testid", strip: "navigator-command-" } }, { name: "navigator-command-title", selector: '[data-testid^="navigator-command-"] > span:first-child', key: { closest: '[data-testid^="navigator-command-"]', attr: "data-testid", strip: "navigator-command-" } }, { name: "navigator-command-detail", selector: '[data-testid^="navigator-command-"] > span:last-child', key: { closest: '[data-testid^="navigator-command-"]', attr: "data-testid", strip: "navigator-command-" } }, { name: "navigator-row", selector: '[data-testid^="navigator-row-"]', key: { self: !0, attr: "data-testid", strip: "navigator-row-" } }, { name: "navigator-row-dot", selector: '[data-testid^="navigator-row-"] > :first-child', key: { closest: '[data-testid^="navigator-row-"]', attr: "data-testid", strip: "navigator-row-" } }, { name: "navigator-row-title", selector: '[data-testid^="navigator-row-"] > span:nth-child(2)', key: { closest: '[data-testid^="navigator-row-"]', attr: "data-testid", strip: "navigator-row-" } }, { name: "navigator-row-detail", selector: '[data-testid^="navigator-row-"] > span:last-child', key: { closest: '[data-testid^="navigator-row-"]', attr: "data-testid", strip: "navigator-row-" } }, { name: "navigator-note", selector: '[data-testid="navigator"] > p:last-child' }], "pane-menu": [{ name: "pane-menu", selector: '[data-testid="pane-context-menu"]' }, { name: "pane-menu-item", selector: '[data-testid="pane-context-menu"] > button', key: { self: !0, attr: "data-testid", strip: "pane-menu-" } }, { name: "pane-menu-divider", selector: '[data-testid="pane-context-menu"] > div.h-px' }, { name: "pane-menu-rename-row", selector: '[data-testid="pane-context-menu"] > div.flex' }, { name: "pane-menu-rename-input", selector: '[data-testid="pane-menu-rename-input"]' }, { name: "pane-menu-rename-confirm", selector: '[data-testid="pane-menu-rename-confirm"]' }], confirm: [{ name: "confirm-scrim", selector: "body > div.fixed.inset-0" }, { name: "confirm-panel", selector: '[data-testid="confirm-dialog"]' }, { name: "confirm-message", selector: ".confirm-dialog__message" }, { name: "confirm-extra", selector: '[data-testid="confirm-dialog"] > :not(.confirm-dialog__message):not(div.flex)' }, { name: "confirm-buttons", selector: '[data-testid="confirm-dialog"] > div.flex' }, { name: "close-guard-stop-sub-sessions", selector: '[data-testid="close-guard-stop-sub-sessions"]' }, { name: "confirm-cancel", selector: '[data-testid="confirm-cancel"]' }, { name: "confirm-accept", selector: '[data-testid="confirm-accept"]' }], dialog: [{ name: "dialog-scrim", selector: "body > div.fixed.inset-0" }, { name: "dialog-panel", selector: '[data-testid="file-name-dialog"]' }, { name: "dialog-title", selector: '[data-testid="file-name-dialog"] > h2' }, { name: "dialog-input", selector: '[data-testid="file-name-input"]' }, { name: "dialog-hint", selector: '[data-testid="file-name-dialog"] > p:not([role])' }, { name: "dialog-error", selector: '[data-testid="file-name-dialog"] > p[role="alert"]' }, { name: "dialog-buttons", selector: '[data-testid="file-name-dialog"] > div.flex' }, { name: "dialog-cancel", selector: '[data-testid="file-name-dialog"] > div.flex > button:first-child' }, { name: "dialog-confirm", selector: '[data-testid="file-name-confirm"]' }], toast: [{ name: "toast-stack", selector: '[data-testid="toast"]' }, { name: "toast-card", selector: '[data-testid="toast"] .animate-toast-in' }, { name: "toast-open", selector: '[data-testid^="toast-"]:not([data-testid^="toast-dismiss-"])' }, { name: "toast-mark", selector: '[data-testid^="toast-"]:not([data-testid^="toast-dismiss-"]) > :first-child' }, { name: "toast-heading", selector: '[data-testid^="toast-"]:not([data-testid^="toast-dismiss-"]) > span.min-w-0 > span:first-child' }, { name: "toast-detail", selector: '[data-testid^="toast-"]:not([data-testid^="toast-dismiss-"]) > span.min-w-0 > span:nth-child(2)' }, { name: "toast-dismiss", selector: '[data-testid^="toast-dismiss-"]' }, { name: "toast-dismiss-glyph", selector: '[data-testid^="toast-dismiss-"] > svg' }], "pane-header": [{ name: "pane-header", selector: '[data-testid^="pane-header-"]', key: { self: !0, attr: "data-testid", strip: "pane-header-" } }, { name: "pane-header-icon", selector: '[data-testid^="pane-header-"] > span.shrink-0:not([data-testid])', key: { closest: '[data-testid^="pane-header-"]', attr: "data-testid", strip: "pane-header-" } }, { name: "pane-header-icon-glyph", selector: '[data-testid^="pane-header-"] > span.shrink-0:not([data-testid]) > *', key: { closest: '[data-testid^="pane-header-"]', attr: "data-testid", strip: "pane-header-" } }, { name: "pane-header-name", selector: '[data-testid^="pane-header-"] > span.truncate', key: { closest: '[data-testid^="pane-header-"]', attr: "data-testid", strip: "pane-header-" } }, { name: "pane-header-state", selector: '[data-testid^="pane-header-"] > span.flex[title]', key: { closest: '[data-testid^="pane-header-"]', attr: "data-testid", strip: "pane-header-" } }, { name: "pane-header-state-dot", selector: '[data-testid^="pane-header-"] > span.flex[title] > span.rounded-full', key: { closest: '[data-testid^="pane-header-"]', attr: "data-testid", strip: "pane-header-" } }, { name: "pane-header-state-word", selector: '[data-testid^="pane-header-"] > span.flex[title] > span.truncate', key: { closest: '[data-testid^="pane-header-"]', attr: "data-testid", strip: "pane-header-" } }, { name: "pane-controls", selector: '[data-testid^="tile-controls-"]', key: { self: !0, attr: "data-testid", strip: "tile-controls-" } }, { name: "pane-expand", selector: '[data-testid^="tile-expand-"]', key: { self: !0, attr: "data-testid", strip: "tile-expand-" } }, { name: "pane-expand-glyph", selector: '[data-testid^="tile-expand-"] > svg', key: { closest: '[data-testid^="tile-expand-"]', attr: "data-testid", strip: "tile-expand-" } }, { name: "pane-close", selector: '[data-testid^="tile-close-"]', key: { self: !0, attr: "data-testid", strip: "tile-close-" } }, { name: "pane-close-glyph", selector: '[data-testid^="tile-close-"] > svg', key: { closest: '[data-testid^="tile-close-"]', attr: "data-testid", strip: "tile-close-" } }, { name: "pane-corner", selector: "div.pointer-events-auto.absolute" }], "new-session": [{ name: "launcher", selector: ".new-session-popover" }, { name: "launcher-filter", selector: '[data-testid="new-tab-filter"]' }, { name: "launcher-list", selector: "#new-tab-launcher-list" }, { name: "launcher-option", selector: '[role="option"]', key: { self: !0, attr: "data-testid" } }, { name: "launcher-option-icon", selector: '[role="option"] > :first-child:not(span.flex-1):not(kbd)', key: { closest: '[role="option"]', attr: "data-testid" } }, { name: "launcher-option-label", selector: '[role="option"] > span.flex-1', key: { closest: '[role="option"]', attr: "data-testid" } }, { name: "launcher-option-key", selector: '[role="option"] > kbd', key: { closest: '[role="option"]', attr: "data-testid" } }, { name: "launcher-note", selector: ".new-session-popover p[role]" }, { name: "agent-select", selector: '[data-testid="new-session-popover-agent"]' }, { name: "agent-manage", selector: ".new-session-popover > div:first-child > button:not([data-testid])" }, { name: "project-option", selector: '[data-testid^="project-option-"]', key: { self: !0, attr: "data-testid", strip: "project-option-" } }, { name: "project-option-name", selector: '[data-testid^="project-option-"]', key: { closest: '[data-testid^="project-option-"]', attr: "data-testid", strip: "project-option-" }, textRange: !0 }, { name: "project-option-path", selector: '[data-testid^="project-option-"] > span', key: { closest: '[data-testid^="project-option-"]', attr: "data-testid", strip: "project-option-" } }], "tab-menu": [{ name: "tab-menu", selector: '[data-testid="tab-split-menu"]' }, { name: "tab-menu-item", selector: '[data-testid="tab-split-menu"] > button', key: { self: !0, attr: "data-testid" } }, { name: "tab-menu-show-beside", selector: '[data-testid="tab-menu-show-beside"]' }, { name: "tab-menu-beside-list", selector: '[data-testid="tab-split-menu"] [role="menu"]' }, { name: "tab-menu-beside-item", selector: '[data-testid="tab-split-menu"] [role="menu"] > button', key: { self: !0, attr: "data-testid" } }, { name: "tab-menu-item-label", selector: '[data-testid="tab-split-menu"] [role="menu"] > button > span.block', key: { closest: '[data-testid="tab-split-menu"] [role="menu"] > button', attr: "data-testid" } }, { name: "tab-menu-empty", selector: '[data-testid="tab-menu-empty"]' }, { name: "tab-menu-divider", selector: '[data-testid="tab-split-menu"] > div.h-px' }, { name: "tab-menu-rename-form", selector: '[data-testid="tab-split-menu"] > form' }, { name: "tab-menu-rename-input", selector: '[data-testid="tab-menu-rename-input"]' }, { name: "tab-menu-rename-save", selector: '[data-testid="tab-split-menu"] > form > button' }], select: [{ name: "select-field", selector: '[data-testid="select-demo"]' }, { name: "select-field-label", selector: '[data-testid="select-demo"] > span.truncate' }, { name: "select-chevron", selector: '[data-testid="select-demo"] > svg' }, { name: "select-list", selector: '[role="listbox"]' }, { name: "select-option", selector: '[role="listbox"] > [role="option"]', key: { self: !0, attr: "data-value" } }, { name: "select-option-label", selector: '[role="listbox"] > [role="option"] > span.truncate', key: { closest: '[role="option"]', attr: "data-value" } }, { name: "select-option-check", selector: '[role="listbox"] > [role="option"] > span[aria-hidden]', key: { closest: '[role="option"]', attr: "data-value" } }], "keybind-help": [{ name: "keybind-help-scrim", selector: "body > div.fixed.inset-0" }, { name: "keybind-help-panel", selector: '[data-testid="keybind-help"]' }, { name: "keybind-help-header", selector: '[data-testid="keybind-help"] > div:first-child' }, { name: "keybind-help-title", selector: '[data-testid="keybind-help"] h2' }, { name: "keybind-help-close", selector: '[aria-label="Close keybind help"]' }, { name: "keybind-help-close-glyph", selector: '[aria-label="Close keybind help"] > svg' }, { name: "keybind-help-search", selector: '[data-testid="keybind-help-search"]' }, { name: "keybind-help-list", selector: '[data-testid="keybind-help"] > div:last-child' }, { name: "keybind-help-empty", selector: '[data-testid="keybind-help"] div.text-center' }, { name: "keybind-help-group", selector: '[data-testid="keybind-help"] section' }, { name: "keybind-help-group-title", selector: '[data-testid="keybind-help"] section > h3' }, { name: "keybind-help-row", selector: '[data-testid="keybind-help"] li' }, { name: "keybind-help-keys", selector: '[data-testid="keybind-help"] li > kbd' }, { name: "keybind-help-description", selector: '[data-testid="keybind-help"] li > span' }], launcher: [{ name: "launcher-scrim", selector: "body > div.fixed.inset-0" }, { name: "launcher-panel", selector: '[data-testid="new-session-dialog"]' }, { name: "launcher-title", selector: '[data-testid="new-session-dialog"] > p' }, { name: "launcher-filter", selector: '[data-testid="new-session-filter"]' }, { name: "launcher-list", selector: "#new-session-list" }, { name: "launcher-row", selector: '[data-testid^="new-session-row-"]', key: { self: !0, attr: "data-testid", strip: "new-session-row-" } }, { name: "launcher-row-icon", selector: '[data-testid^="new-session-row-"] > :first-child:not(span):not(kbd)', key: { closest: '[data-testid^="new-session-row-"]', attr: "data-testid", strip: "new-session-row-" } }, { name: "launcher-row-label", selector: '[data-testid^="new-session-row-"] > span.shrink-0', key: { closest: '[data-testid^="new-session-row-"]', attr: "data-testid", strip: "new-session-row-" } }, { name: "launcher-row-detail", selector: '[data-testid^="new-session-row-"] > span.ml-auto', key: { closest: '[data-testid^="new-session-row-"]', attr: "data-testid", strip: "new-session-row-" } }, { name: "launcher-row-key", selector: '[data-testid^="new-session-row-"] > kbd', key: { closest: '[data-testid^="new-session-row-"]', attr: "data-testid", strip: "new-session-row-" } }, { name: "launcher-note", selector: "#new-session-list > p" }], "session-menu": [{ name: "tab-menu", selector: '[data-testid="tab-split-menu"]' }, { name: "tab-menu-item", selector: '[data-testid="tab-split-menu"] > button', key: { self: !0, attr: "data-testid" } }, { name: "tab-menu-show-beside", selector: '[data-testid="tab-menu-show-beside"]' }, { name: "tab-menu-beside-list", selector: '[data-testid="tab-split-menu"] [role="menu"]' }, { name: "tab-menu-beside-item", selector: '[data-testid="tab-split-menu"] [role="menu"] > button', key: { self: !0, attr: "data-testid" } }, { name: "tab-menu-item-label", selector: '[data-testid="tab-split-menu"] [role="menu"] > button > span.block', key: { closest: '[data-testid="tab-split-menu"] [role="menu"] > button', attr: "data-testid" } }, { name: "tab-menu-empty", selector: '[data-testid="tab-menu-empty"]' }, { name: "tab-menu-divider", selector: '[data-testid="tab-split-menu"] > div.h-px' }], "tab-drag": [{ name: "tab-drag-layer", selector: '[data-testid="tab-drag-layer"]' }, { name: "tab-drag-pane", selector: '[data-testid="tab-drag-layer"] > div.bg-surface-1\\/30' }, { name: "tab-drop-zone", selector: '[data-testid="tab-drop-zone"]', key: { self: !0, attr: "data-zone" } }, { name: "tab-drop-label", selector: '[data-testid="tab-drop-zone"] > span' }, { name: "tab-drag-ghost", selector: '[data-testid="tab-drag-ghost"]' }], start: [{ name: "start-panel", selector: '[data-testid="no-session-panel"], [data-testid="cli-start-panel"]' }, { name: "start-column", selector: '[data-testid$="-panel"] > div' }, { name: "start-logo", selector: '[data-testid="no-session-panel"] img' }, { name: "start-name", selector: '[data-testid$="-panel"] h1, [data-testid="no-session-panel"] h1, [data-testid="no-session-panel"] h2' }, { name: "start-hint", selector: '[data-testid$="-panel"] p' }, { name: "start-target", selector: '[data-testid="workspace-start-target"], [data-testid="cli-start-target"]' }, { name: "start-action", selector: '[data-testid="home-add-project"], [data-testid="no-session-create"], [data-testid^="workspace-start-"]:not([data-testid="workspace-start-target"]), [data-testid^="cli-start-agent-"]', key: { self: !0, attr: "data-testid" } }, { name: "start-status", selector: '[role="status"], [role="alert"]' }, { name: "start-status-action", selector: '[role="status"] > button, [role="alert"] > button' }, { name: "start-link", selector: '[data-testid$="-panel"] button.text-subtext-0' }, { name: "start-shortcut-row", selector: '[data-testid="no-session-panel"] dl > div' }, { name: "start-shortcut-label", selector: '[data-testid="no-session-panel"] dl dt' }, { name: "start-shortcut-key", selector: '[data-testid="no-session-panel"] dl kbd' }], "folder-browser": [{ name: "folder-browser", selector: '[data-testid="dir-browser"]' }, { name: "folder-browser-mode-toggle", selector: '[data-testid="dir-browser-mode-toggle"]' }, { name: "folder-browser-up", selector: '[data-testid="dir-browser-up"]' }, { name: "folder-browser-crumbs", selector: '[data-testid="dir-browser"] span.min-w-0.flex-1' }, { name: "folder-browser-crumb", selector: '[data-testid="dir-browser"] span.min-w-0.flex-1 button' }, { name: "folder-browser-filter", selector: '[data-testid="dir-browser-filter"]' }, { name: "folder-browser-list", selector: '[data-testid="dir-browser"] div.overflow-y-auto' }, { name: "folder-browser-entry", selector: '[data-testid^="dir-browser-entry-"]', key: { self: !0, attr: "data-testid", strip: "dir-browser-entry-" } }, { name: "folder-browser-entry-name", selector: '[data-testid^="dir-browser-entry-"] > span:first-child', key: { closest: '[data-testid^="dir-browser-entry-"]', attr: "data-testid", strip: "dir-browser-entry-" } }, { name: "folder-browser-git", selector: '[data-testid^="dir-browser-entry-"] > span:last-child:not(:first-child)', key: { closest: '[data-testid^="dir-browser-entry-"]', attr: "data-testid", strip: "dir-browser-entry-" } }, { name: "folder-browser-note", selector: '[data-testid="dir-browser"] div.overflow-y-auto > div' }, { name: "folder-browser-use", selector: '[data-testid="dir-browser-use"]' }, { name: "folder-browser-path-input", selector: '[data-testid="project-path-input"]' }], instructions: [{ name: "instructions-scrim", selector: "body > div.fixed.inset-0" }, { name: "instructions-panel", selector: '[data-testid="instructions-dialog"]' }, { name: "instructions-title", selector: '[data-testid="instructions-dialog"] > h2' }, { name: "instructions-intro", selector: '[data-testid="instructions-dialog"] > p' }, { name: "instructions-label", selector: '[data-testid="instructions-dialog"] > label > span:first-child' }, { name: "instructions-count", selector: '[data-testid="instructions-count"]' }, { name: "instructions-text", selector: '[data-testid="instructions-text"]' }, { name: "instructions-folders", selector: '[data-testid="instructions-folders"]' }, { name: "instructions-error", selector: '[data-testid="instructions-error"]' }, { name: "instructions-cancel", selector: '[data-testid="instructions-dialog"] > div.flex.justify-end > button:first-child' }, { name: "instructions-save", selector: '[data-testid="instructions-save"]' }], memory: [{ name: "memory-scrim", selector: "body > div.fixed.inset-0", key: { self: !0, attr: "data-testid" } }, { name: "memory-panel", selector: '[data-testid="memory-dialog"]' }, { name: "memory-title", selector: '[data-testid="memory-dialog"] > h2' }, { name: "memory-intro", selector: '[data-testid="memory-dialog"] > p' }, { name: "memory-caps", selector: '[data-testid="memory-caps"]' }, { name: "memory-new", selector: '[data-testid="memory-new"]' }, { name: "memory-enabled", selector: '[data-testid="memory-enabled"]' }, { name: "memory-enabled-label", selector: '[data-testid="memory-dialog"] > label.flex > span' }, { name: "memory-note", selector: '[data-testid="memory-dialog"] > span.text-subtext-0' }, { name: "memory-row", selector: '[data-testid^="memory-row-"]', key: { self: !0, attr: "data-testid", strip: "memory-row-" } }, { name: "memory-open", selector: '[data-testid^="memory-open-"]', key: { self: !0, attr: "data-testid", strip: "memory-open-" } }, { name: "memory-file-title", selector: '[data-testid^="memory-row-"] button > span:first-child', key: { closest: '[data-testid^="memory-row-"]', attr: "data-testid", strip: "memory-row-" } }, { name: "memory-file-summary", selector: '[data-testid^="memory-row-"] button > span.truncate', key: { closest: '[data-testid^="memory-row-"]', attr: "data-testid", strip: "memory-row-" } }, { name: "memory-file-meta", selector: '[data-testid^="memory-row-"] button > span:last-child', key: { closest: '[data-testid^="memory-row-"]', attr: "data-testid", strip: "memory-row-" } }, { name: "memory-delete", selector: '[data-testid^="memory-delete-"]', key: { self: !0, attr: "data-testid", strip: "memory-delete-" } }, { name: "memory-error", selector: '[data-testid="memory-error"]' }, { name: "memory-close", selector: '[data-testid="memory-dialog"] > div.flex.justify-end > button' }, { name: "memory-file-name", selector: '[data-testid="memory-file-name"]' }, { name: "memory-name", selector: '[data-testid="memory-name"]' }, { name: "memory-count", selector: '[data-testid="memory-count"]' }, { name: "memory-text", selector: '[data-testid="memory-text"]' }, { name: "memory-conflict", selector: '[data-testid="memory-conflict"]' }, { name: "memory-reload", selector: '[data-testid="memory-reload"]' }, { name: "memory-back", selector: '[data-testid="memory-back"]' }, { name: "memory-save", selector: '[data-testid="memory-save"]' }, { name: "memory-confirm", selector: '[data-testid="confirm-dialog"]' }, { name: "memory-confirm-message", selector: ".confirm-dialog__message" }], worktree: [{ name: "worktree-plus", selector: '[data-testid^="worktree-menu-"]' }, { name: "worktree-popover", selector: '[role="dialog"][aria-label="Git worktrees"]' }, { name: "worktree-heading", selector: '[role="dialog"][aria-label="Git worktrees"] > div:first-child > span:first-child' }, { name: "worktree-project", selector: '[role="dialog"][aria-label="Git worktrees"] > div:first-child > span:last-child' }, { name: "worktree-list", selector: '[role="dialog"][aria-label="Git worktrees"] > div.overflow-y-auto' }, { name: "worktree-note", selector: '[role="dialog"][aria-label="Git worktrees"] > div.overflow-y-auto > div:not(.worktree-menu__entry)' }, { name: "worktree-entry", selector: '[data-testid^="worktree-entry-"]', key: { self: !0, attr: "data-testid", strip: "worktree-entry-" } }, { name: "worktree-entry-branch", selector: ".worktree-menu__entry-branch", key: { closest: '[data-testid^="worktree-entry-"]', attr: "data-testid", strip: "worktree-entry-" } }, { name: "worktree-badge", selector: '[data-testid^="worktree-entry-"] .worktree-menu__entry-branch > span', key: { closest: '[data-testid^="worktree-entry-"]', attr: "data-testid", strip: "worktree-entry-" } }, { name: "worktree-entry-path", selector: ".worktree-menu__entry-path", key: { closest: '[data-testid^="worktree-entry-"]', attr: "data-testid", strip: "worktree-entry-" } }, { name: "worktree-open", selector: '[data-testid^="worktree-open-"]', key: { self: !0, attr: "data-testid", strip: "worktree-open-" } }, { name: "worktree-remove", selector: '[data-testid^="worktree-remove-"]', key: { self: !0, attr: "data-testid", strip: "worktree-remove-" } }, { name: "worktree-error", selector: '[data-testid="worktree-error"]' }, { name: "worktree-new", selector: '[data-testid="worktree-new"]' }, { name: "worktree-name-input", selector: '[data-testid="worktree-name-input"]' }, { name: "worktree-start-input", selector: '[data-testid="worktree-start-input"]' }, { name: "worktree-branch-input", selector: '[data-testid="worktree-branch-input"]' }, { name: "worktree-parent-select", selector: '[data-testid="worktree-parent-select"]' }, { name: "worktree-new-branch", selector: '[data-testid="worktree-new-branch"]' }, { name: "worktree-path-input", selector: '[data-testid="worktree-path-input"]' }, { name: "worktree-agent-select", selector: '[data-testid="worktree-agent-select"]' }, { name: "worktree-create-cancel", selector: '[data-testid="worktree-create-cancel"]' }, { name: "worktree-create-submit", selector: '[data-testid="worktree-create-submit"]' }, { name: "worktree-confirm", selector: '[data-testid="confirm-dialog"]' }, { name: "worktree-confirm-message", selector: ".confirm-dialog__message" }, { name: "worktree-confirm-accept", selector: '[data-testid="confirm-accept"]' }, { name: "worktree-confirm-cancel", selector: '[data-testid="confirm-cancel"]' }], "terminal-search": [{ name: "terminal-frame", selector: '[data-testid="persistent-agent-terminal"]' }, { name: "term-search", selector: '[data-testid="term-search"]' }, { name: "term-search-input", selector: '[data-testid="term-search-input"]' }, { name: "term-search-button", selector: '[data-testid="term-search"] > button', key: { self: !0, attr: "title" } }], "agent-control": [{ name: "terminal-frame", selector: '[data-testid="persistent-agent-terminal"]' }, { name: "agent-control-chip", selector: '[data-testid="agent-control-chip"]' }, { name: "agent-control-label", selector: '[data-testid="agent-control-chip"] > span' }, { name: "agent-control-button", selector: '[data-testid="agent-control-chip"] > button' }, { name: "agent-control-error", selector: ".terminal__cli-error" }, { name: "agent-control-ended", selector: ".terminal__exited", key: { self: !0, attr: "data-testid" } }, { name: "agent-control-ended-text", selector: ".terminal__exited-text" }, { name: "agent-control-ended-button", selector: ".terminal__exited-actions > button", key: { self: !0, attr: "data-testid" } }], "phone-size": [{ name: "terminal-frame", selector: '[data-testid="persistent-agent-terminal"]' }, { name: "phone-size-notice", selector: '[data-testid="phone-size-notice"]' }, { name: "phone-size-chip", selector: '[data-testid="phone-size-chip"]' }, { name: "phone-size-heading", selector: '[data-testid="phone-size-notice"] span.font-semibold' }, { name: "phone-size-text", selector: '[data-testid="phone-size-notice"] span:not(.font-semibold)' }, { name: "phone-size-fold", selector: '[aria-label="Keep phone size and hide this"]' }, { name: "phone-size-button", selector: '[data-testid="phone-size-notice"] div.flex.flex-wrap > button, [data-testid="phone-size-chip"] > button' }], window: [{ name: "sidebar-card", selector: '[data-testid="sidebar-card"]' }, { name: "main-card", selector: '[data-testid="main-card"]' }, { name: "tools-card", selector: '[data-testid="tools-card"]' }, { name: "sidebar-toggle", selector: '[data-testid="sidebar-collapse-toggle"]' }, { name: "drawer-toggle", selector: '[data-testid="workspace-tools-toggle"]' }, { name: "resize-sidebar", selector: '[data-testid="resize-sidebar"]' }, { name: "resize-tools", selector: '[data-testid="resize-tools"]' }, { name: "tools-tab", selector: 'nav[aria-label="Files, Git and Browser"] > button' }, { name: "status-bar", selector: "footer.status-bar" }], settings: [{ name: "settings-modal", selector: '[data-testid="settings-modal"]' }, { name: "settings-nav-card", selector: '[data-testid="settings-modal"] > nav' }, { name: "settings-close", selector: '[data-testid="settings-close"]' }, { name: "settings-nav", selector: 'nav [data-testid^="settings-nav-"]', key: { self: !0, attr: "data-testid", strip: "settings-nav-" } }, { name: "settings-main-card", selector: '[data-testid="settings-modal"] > main' }, { name: "settings-search", selector: '[data-testid="settings-search"]' }, { name: "settings-title", selector: '[data-testid="settings-modal"] > main h1' }, { name: "settings-body", selector: '[data-testid="settings-modal"] .settings-modal__body' }, { name: "settings-group-title", selector: '[data-testid="settings-modal"] > main h3' }, { name: "settings-group-card", selector: '[data-testid="settings-modal"] > main section > div.rounded-ui' }, { name: "settings-row", selector: '[data-testid="settings-modal"] [data-setting-row]' }, { name: "settings-row-title", selector: '[data-testid="settings-modal"] [data-setting-row] > div:first-child > div:first-child' }, { name: "settings-row-description", selector: '[data-testid="settings-modal"] [data-setting-row] > div:first-child > div:nth-child(2)' }, { name: "settings-result-title", selector: '[data-testid^="settings-result-"] > h2' }], files: [{ name: "files-explorer", selector: '[data-testid="workspace-files-view"]' }, { name: "files-tree", selector: '[data-testid="workspace-file-tree-scroll"]' }, { name: "files-refresh", selector: '[aria-label="Refresh file tree"]' }, { name: "files-entry", selector: '[data-testid^="workspace-file-entry-"]', key: { self: !0, attr: "data-testid", strip: "workspace-file-entry-" } }, { name: "files-entry-icon", selector: '[data-testid^="workspace-file-entry-"] > svg[data-file-icon]', key: { closest: '[data-testid^="workspace-file-entry-"]', attr: "data-testid", strip: "workspace-file-entry-" } }, { name: "files-entry-name", selector: '[data-testid^="workspace-file-entry-"] > span.flex-1', key: { closest: '[data-testid^="workspace-file-entry-"]', attr: "data-testid", strip: "workspace-file-entry-" } }, { name: "files-pane", selector: '[data-testid="workspace-file-pane"]' }, { name: "files-file-title", selector: ".workspace-files__file-title > span:first-child" }, { name: "files-dirty", selector: '.workspace-files__file-title > span[title="Unsaved changes"]' }, { name: "files-save", selector: ".workspace-files__save" }, { name: "files-markdown-view", selector: '[aria-label="Markdown view"]' }, { name: "files-markdown-preview-button", selector: '[aria-label="Markdown view"] > button:last-child' }, { name: "files-markdown-preview", selector: '[data-testid="workspace-markdown-preview"]' }, { name: "files-conflict", selector: '[data-testid="workspace-file-conflict"]' }, { name: "files-conflict-title", selector: '[data-testid="workspace-file-conflict"] > strong' }, { name: "files-conflict-action", selector: '[data-testid="workspace-file-conflict"] button' }, { name: "files-editor", selector: '[data-testid="workspace-file-editor-area"]' }, { name: "editor-text", selector: '[data-testid="workspace-file-editor-area"] .cm-scroller' }, { name: "files-asset", selector: '[data-testid="workspace-file-asset"]' }, { name: "files-asset-header", selector: '[data-testid="workspace-file-asset"] > header' }, { name: "files-asset-title", selector: '[data-testid="workspace-file-asset"] > header > strong' }, { name: "files-image-viewer", selector: '[data-testid="workspace-image-viewer"]' }, { name: "files-image-toolbar", selector: '[data-testid="workspace-image-viewer"] > [role="toolbar"]' }, { name: "files-image-status", selector: '[data-testid="workspace-image-info"]' }], review: [{ name: "review-root", selector: '[data-testid="workspace-git-review"]' }, { name: "git-refresh", selector: '[data-testid="git-refresh"]' }, { name: "git-status", selector: '[data-testid="git-status"]' }, { name: "git-change", selector: '[data-testid^="git-change-"]', key: { self: !0, attr: "data-testid", strip: "git-change-" } }, { name: "git-dir", selector: '[data-testid^="git-dir-"]', key: { self: !0, attr: "data-testid", strip: "git-dir-" } }, { name: "git-changes", selector: '[role="tree"][aria-label="Changed paths"]' }, { name: "git-diff", selector: '[data-testid="git-diff"]' }, { name: "git-diff-empty", selector: '[data-testid="git-diff-empty"]' }, { name: "git-file-header", selector: '[data-testid="git-diff"] article > header' }, { name: "git-hunk-header", selector: '[data-testid="git-diff"] section > div:first-child' }, { name: "git-diff-line", selector: '[data-testid="git-diff-line"]' }, { name: "git-line-comments", selector: '[data-testid="git-line-comments"]' }, { name: "git-comment-composer", selector: '[data-testid="git-comment-composer"]' }] };
export {
  nw as NAMED_ELEMENTS,
  p0 as React,
  F0 as SCHEMA,
  tw as STYLE_KEYS,
  ew as describeToGpui,
  Fx as jsxRuntime,
  $x as mount,
  Ix as reactDom,
  Px as sdk
};
