function ms(a, l) {
  for (var s = 0; s < l.length; s++) {
    const o = l[s];
    if (typeof o != "string" && !Array.isArray(o)) {
      for (const i in o)
        if (i !== "default" && !(i in a)) {
          const d = Object.getOwnPropertyDescriptor(o, i);
          d && Object.defineProperty(a, i, d.get ? d : {
            enumerable: !0,
            get: () => o[i]
          });
        }
    }
  }
  return Object.freeze(Object.defineProperty(a, Symbol.toStringTag, { value: "Module" }));
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
class ge extends Error {
}
const Qh = /* @__PURE__ */ new Set(["hover", "focus", "focus-visible", "focus-within", "active", "disabled", "enabled", "checked"]), Vh = /* @__PURE__ */ new Set(["not", "is", "where", "has", "nth-child"]), Xh = /* @__PURE__ */ new Set(["first-child", "last-child", "only-child", "root", ...Qh]);
function Io(a) {
  return a.replace(/\\(?:([0-9a-fA-F]{1,6})\s?|([\s\S]))/g, (l, s, o) => s ? String.fromCodePoint(parseInt(s, 16)) : o);
}
function Er(a, l) {
  let s = l;
  for (; s < a.length; ) {
    const o = a[s];
    if (o === "\\") {
      s += 2;
      continue;
    }
    if (/[A-Za-z0-9_\- -￿]/.test(o)) {
      s++;
      continue;
    }
    break;
  }
  if (s === l) throw new ge(`expected a name at ${l} in ${JSON.stringify(a)}`);
  return [Io(a.slice(l, s)), s];
}
function Lh(a, l) {
  let s = 1;
  for (let o = l; o < a.length; o++) {
    const i = a[o];
    if (i === "\\") {
      o++;
      continue;
    }
    if (i === '"' || i === "'") {
      if (o = a.indexOf(i, o + 1), o < 0) break;
      continue;
    }
    if (i === "(") s++;
    else if (i === ")" && --s === 0) return o;
  }
  throw new ge(`unbalanced parenthesis in ${JSON.stringify(a)}`);
}
function ps(a) {
  const l = [];
  let s = 0, o = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i];
    if (d === "\\") {
      i++;
      continue;
    }
    if (d === '"' || d === "'") {
      if (i = a.indexOf(d, i + 1), i < 0) break;
      continue;
    }
    d === "(" || d === "[" ? s++ : d === ")" || d === "]" ? s-- : d === "," && s === 0 && (l.push(a.slice(o, i).trim()), o = i + 1);
  }
  return l.push(a.slice(o).trim()), l.filter(Boolean);
}
function Zh(a, l) {
  const s = { tag: null, id: null, classes: [], attrs: [], pseudos: [] };
  let o = !1;
  for (; l < a.length; ) {
    const i = a[l];
    if (i === "*") {
      s.tag = "*", l++, o = !0;
      continue;
    }
    if (i === ".") {
      const [d, m] = Er(a, l + 1);
      s.classes.push(d), l = m, o = !0;
      continue;
    }
    if (i === "#") {
      const [d, m] = Er(a, l + 1);
      s.id = d, l = m, o = !0;
      continue;
    }
    if (i === "[") {
      const d = a.indexOf("]", l);
      if (d < 0) throw new ge(`unclosed [ in ${JSON.stringify(a)}`);
      const m = a.slice(l + 1, d).trim(), f = /^([^\s~^$*|=]+)\s*(?:([~^$*|]?=)\s*(?:"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'|([^\s"'\]]+)))?\s*(i)?$/.exec(m);
      if (!f) throw new ge(`cannot read the attribute selector [${m}]`);
      const b = f[3] ?? f[4] ?? f[5];
      s.attrs.push({ name: Io(f[1]).toLowerCase(), op: f[2] ?? null, value: b === void 0 ? null : Io(b) }), l = d + 1, o = !0;
      continue;
    }
    if (i === ":") {
      if (a[l + 1] === ":") throw new ge(`pseudo-elements are not supported (${JSON.stringify(a)})`);
      const [d, m] = Er(a, l + 1);
      l = m;
      const f = d.toLowerCase();
      if (a[l] === "(") {
        if (!Vh.has(f)) throw new ge(`:${f}() is not supported`);
        const b = Lh(a, l + 1), x = a.slice(l + 1, b).trim();
        if (l = b + 1, f === "nth-child") {
          if (!/^\d+$/.test(x)) throw new ge(`:nth-child(${x}) is not supported (only a number)`);
          s.pseudos.push({ name: f, n: Number(x) });
        } else {
          const E = ps(x).map(hs);
          if (f === "has" && E.some((k) => k.length !== 1)) throw new ge(`:has(${x}) is not supported (only a compound selector)`);
          s.pseudos.push({ name: f, list: E });
        }
      } else {
        if (!Xh.has(f)) throw new ge(`:${f} is not supported`);
        s.pseudos.push({ name: f });
      }
      o = !0;
      continue;
    }
    if (/[A-Za-z_\-\\]/.test(i) && !o) {
      const [d, m] = Er(a, l);
      s.tag = d.toLowerCase(), l = m, o = !0;
      continue;
    }
    break;
  }
  if (!o) throw new ge(`empty compound selector at ${l} in ${JSON.stringify(a)}`);
  return [s, l];
}
function hs(a) {
  const l = [];
  let s = 0, o = null;
  for (a = a.trim(); s < a.length; ) {
    const [i, d] = Zh(a, s);
    l.push({ compound: i, combinator: o }), s = d;
    let m = !1;
    for (; a[s] === " " || a[s] === `
` || a[s] === "	"; )
      s++, m = !0;
    if (s >= a.length) break;
    const f = a[s];
    if (f === ">")
      for (o = ">", s++; a[s] === " "; ) s++;
    else {
      if (f === "+" || f === "~") throw new ge(`the ${f} combinator is not supported`);
      if (m) o = " ";
      else throw new ge(`unexpected ${JSON.stringify(f)} in ${JSON.stringify(a)}`);
    }
  }
  if (!l.length) throw new ge("empty selector");
  return l;
}
const xd = /* @__PURE__ */ new Map();
function Zr(a) {
  let l = xd.get(a);
  return l || (l = ps(a).map(hs), xd.set(a, l)), l;
}
function mf(a) {
  const l = [0, 0, 0], s = (o) => {
    l[0] += o[0], l[1] += o[1], l[2] += o[2];
  };
  for (const { compound: o } of a) {
    o.id && l[0]++, l[1] += o.classes.length + o.attrs.length, o.tag && o.tag !== "*" && l[2]++;
    for (const i of o.pseudos)
      if (i.name !== "where")
        if (i.list) {
          const d = i.list.map(mf).sort((m, f) => f[0] - m[0] || f[1] - m[1] || f[2] - m[2])[0];
          s(d);
        } else l[1]++;
  }
  return l;
}
function Jh(a, { name: l, op: s, value: o }) {
  const i = a.getAttribute(l);
  if (i == null) return !1;
  if (s === null) return !0;
  switch (s) {
    case "=":
      return i === o;
    case "^=":
      return o !== "" && i.startsWith(o);
    case "$=":
      return o !== "" && i.endsWith(o);
    case "*=":
      return o !== "" && i.includes(o);
    case "~=":
      return i.split(/\s+/).includes(o);
    case "|=":
      return i === o || i.startsWith(`${o}-`);
    default:
      return !1;
  }
}
function zr(a) {
  return a.parentElement ? a.parentElement.children : [a];
}
function pf(a, l) {
  for (const s of a.children) if (l(s) || pf(s, l)) return !0;
  return !1;
}
function hf(a, l, s, o) {
  if (l.tag && l.tag !== "*" && a.tagName !== l.tag || l.id && a.getAttribute("id") !== l.id) return !1;
  if (l.classes.length) {
    const i = a.classList ?? [];
    for (const d of l.classes) if (!i.includes(d)) return !1;
  }
  for (const i of l.attrs) if (!Jh(a, i)) return !1;
  for (const i of l.pseudos)
    switch (i.name) {
      case "first-child":
        if (zr(a)[0] !== a) return !1;
        break;
      case "only-child":
        if (zr(a).length !== 1) return !1;
        break;
      case "last-child": {
        const d = zr(a);
        if (d[d.length - 1] !== a) return !1;
        break;
      }
      case "nth-child":
        if (zr(a).indexOf(a) !== i.n - 1) return !1;
        break;
      case "root":
        if (!a.isDocumentRoot) return !1;
        break;
      case "not":
        if (i.list.some((d) => qa(a, d, s, o))) return !1;
        break;
      case "has":
        if (a.watchesDescendants = !0, !i.list.some(([{ compound: d }]) => pf(a, (m) => hf(m, d, s, !1)))) return !1;
        break;
      case "is":
      case "where":
        if (!i.list.some((d) => qa(a, d, s, o))) return !1;
        break;
      default:
        if (!s.state || !s.state(a, i.name, o)) return !1;
    }
  return !0;
}
function qa(a, l, s, o = !0) {
  const i = (d, m, f) => {
    const { compound: b, combinator: x } = l[m];
    if (!hf(d, b, s, f)) return !1;
    if (m === 0) return !0;
    if (x === ">") return !!d.parentElement && i(d.parentElement, m - 1, !1);
    for (let E = d.parentElement; E; E = E.parentElement) if (i(E, m - 1, !1)) return !0;
    return !1;
  };
  return i(a, l.length - 1, o);
}
function Wh(a, l, s = {}) {
  return (typeof l == "string" ? Zr(l) : l).some((i) => qa(a, i, s));
}
function gf(a, l, s = {}) {
  return qa(a, l, s);
}
function _l(a, l, s = {}) {
  const o = Zr(l), i = [], d = (m) => {
    for (const f of m.children)
      o.some((b) => qa(f, b, s)) && i.push(f), d(f);
  };
  return d(a), i;
}
function bf(a, l, s = {}) {
  const o = Zr(l);
  for (let i = a; i; i = i.parentElement) if (o.some((d) => qa(i, d, s))) return i;
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
let Fh = 1;
class Po {
  constructor(l = 0, s = 0, o = 0, i = 0) {
    this.x = l, this.y = s, this.width = o, this.height = i;
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
class gs {
  constructor() {
    this.listeners = [];
  }
  addEventListener(l, s, o) {
    const i = o === !0 || !!o?.capture;
    this.listeners.some((d) => d.type === l && d.listener === s && d.capture === i) || this.listeners.push({ type: l, listener: s, capture: i });
  }
  removeEventListener(l, s, o) {
    const i = o === !0 || !!o?.capture;
    this.listeners = this.listeners.filter((d) => !(d.type === l && d.listener === s && d.capture === i));
  }
}
class Jr {
  constructor(l) {
    this.nodeType = 3, this.data = String(l), this.parentNode = null, this.hidden = !1;
  }
  get parentElement() {
    return this.parentNode;
  }
  get textContent() {
    return this.data;
  }
}
class It extends gs {
  constructor(l, s = {}, o = null) {
    super(), this.nodeType = 1, this.id = `n${Fh++}`, this.tagName = l.toLowerCase(), this.props = s, this.childNodes = [], this.parentNode = null, this.ownerDocument = o, this.hidden = !1, this.state = { hover: !1, focus: !1, active: !1 }, this.bounds = null, this.version = 0;
  }
  touch() {
    this.version++;
  }
  /** The element and every ancestor whose style asked what lies below it (`:has()`, `selector.mjs`). */
  touchWatchers() {
    this.touch();
    for (let l = this.parentElement; l; l = l.parentElement) l.watchesDescendants && l.touch();
  }
  get nodeName() {
    return this.tagName.toUpperCase();
  }
  get parentElement() {
    return this.parentNode instanceof It ? this.parentNode : null;
  }
  get children() {
    return this.childNodes.filter((l) => l instanceof It);
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
    return this.classCache?.name !== l && (this.classCache = { name: l, list: l.split(/\s+/).filter(Boolean) }), this.classCache.list;
  }
  get textContent() {
    return this.childNodes.map((l) => l.textContent).join("");
  }
  get dataset() {
    const l = {};
    for (const [s, o] of Object.entries(this.props))
      s.startsWith("data-") && o != null && o !== !1 && (l[s.slice(5).replace(/-([a-z])/g, (i, d) => d.toUpperCase())] = String(o));
    return l;
  }
  /** The DOM attribute React would write for `name`, or null. */
  getAttribute(l) {
    const s = this.props;
    if (l === "class") return this.className || null;
    if (l === "id") return s.id != null ? String(s.id) : null;
    if (l === "style") return null;
    let i = s[l === "for" ? "htmlFor" : l === "tabindex" ? "tabIndex" : l];
    if (i === void 0 && !l.includes("-")) {
      const d = l.replace(/-([a-z])/g, (m, f) => f.toUpperCase());
      i = s[d];
    }
    return i == null || typeof i == "function" ? null : typeof i == "boolean" ? l.startsWith("aria-") || l.startsWith("data-") ? String(i) : i ? "" : null : String(i);
  }
  hasAttribute(l) {
    return this.getAttribute(l) !== null;
  }
  appendChild(l) {
    return l.parentNode && l.parentNode.removeChild(l), l.parentNode = this, this.childNodes.push(l), this.touchWatchers(), l;
  }
  insertBefore(l, s) {
    l.parentNode && l.parentNode.removeChild(l);
    const o = this.childNodes.indexOf(s);
    return l.parentNode = this, o < 0 ? this.childNodes.push(l) : this.childNodes.splice(o, 0, l), this.touchWatchers(), l;
  }
  removeChild(l) {
    const s = this.childNodes.indexOf(l);
    return s >= 0 && this.childNodes.splice(s, 1), l.parentNode = null, this.touchWatchers(), l;
  }
  contains(l) {
    for (let s = l; s; s = s.parentNode) if (s === this) return !0;
    return !1;
  }
  matches(l) {
    return Wh(this, l);
  }
  closest(l) {
    return bf(this, l);
  }
  querySelectorAll(l) {
    return _l(this, l);
  }
  querySelector(l) {
    return _l(this, l)[0] ?? null;
  }
  /** Where the engine last laid this element out (`HostDocument.measure`); else, before its first layout, a box the
   * engine reported another way (the direct children of a scroll area, a pressed element); else a zero box. */
  getBoundingClientRect() {
    const l = this.ownerDocument?.measure?.(this) ?? this.ownerDocument?.itemBounds?.(this.id) ?? this.bounds;
    return l ? new Po(l.x, l.y, l.width, l.height) : new Po();
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
  setSelectionRange(l, s) {
    this.selectedAll = l === 0 && s >= this.value.length && s > 0;
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
    const l = this, s = (m) => String(m).startsWith("--") ? String(m) : String(m).replace(/-([a-z])/g, (f, b) => b.toUpperCase()), o = (m) => {
      const f = l.props.style?.[m];
      return f == null || typeof f == "boolean" ? "" : typeof f == "number" && f !== 0 ? `${f}px` : String(f);
    }, i = (m) => l.inline && m in l.inline ? l.inline[m] : o(m), d = (m, f) => {
      const b = f == null ? "" : String(f);
      i(m) !== b && (l.inline ??= {}, b === o(m) ? delete l.inline[m] : l.inline[m] = b, l.touch(), l.ownerDocument?.restyled());
    };
    return this.styleView = new Proxy({}, {
      get: (m, f) => {
        if (typeof f == "string")
          return f === "setProperty" ? (b, x) => d(s(b), x) : f === "removeProperty" ? (b) => {
            const x = i(s(b));
            return d(s(b), ""), x;
          } : f === "getPropertyValue" ? (b) => i(s(b)) : i(f);
      },
      set: (m, f, b) => (typeof f == "string" && d(f, b), !0)
    }), this.styleView;
  }
  /** What the cascade reads as this element's inline style: its props' `style` under what was written to `style`. */
  get inlineStyle() {
    return this.inline ? { ...this.props.style, ...this.inline } : this.props.style;
  }
  /** This element and what is in it, as this shim's own markup (`markup`), which `dangerouslySetInnerHTML` takes. */
  get outerHTML() {
    return wd(this);
  }
  /** `outerHTML` without the attributes named in `omit` (by their DOM names), as the web's drag strips its copy. */
  copyMarkup(l = []) {
    return wd(this, l);
  }
}
const vf = Symbol("perch.stale-layout"), yf = 3;
let Dr = !1;
function xf(a) {
  return () => {
    let l, s = !1;
    const o = (i) => {
      const d = Dr;
      Dr = i < yf;
      try {
        l = a();
      } catch (m) {
        const f = m?.[vf];
        if (!f) throw m;
        f.retries.push(() => {
          s || o(i + 1);
        });
      } finally {
        Dr = d;
      }
    };
    return o(0), () => {
      s = !0, typeof l == "function" && l();
    };
  };
}
const $o = "perch-dom:", Ih = /* @__PURE__ */ new Set(["children", "key", "ref", "dangerouslySetInnerHTML"]), Ph = { class: "className", for: "htmlFor", tabindex: "tabIndex" };
function wd(a, l = []) {
  const s = new Set(l.map((i) => Ph[i] ?? i)), o = (i) => {
    if (!(i instanceof It)) return { x: i.data, ...i.hidden ? { h: 1 } : {} };
    const d = {};
    for (const [m, f] of Object.entries(i.props))
      Ih.has(m) || s.has(m) || f == null || typeof f == "function" || typeof f == "symbol" || (d[m] = f);
    return { t: i.tagName, p: d, c: i.childNodes.map(o), ...i.hidden ? { h: 1 } : {} };
  };
  return $o + JSON.stringify(o(a));
}
function $h(a, l) {
  if (typeof a != "string" || !a.startsWith($o)) return null;
  let s;
  try {
    s = JSON.parse(a.slice($o.length));
  } catch {
    return null;
  }
  const o = (d) => !!d && typeof d == "object" && !Array.isArray(d), i = (d) => {
    if (!o(d)) throw new Error("not a node");
    let m;
    if (typeof d.x == "string") m = new Jr(d.x);
    else {
      if (typeof d.t != "string" || !/^[a-z][a-z0-9-]*$/i.test(d.t) || !o(d.p) || !Array.isArray(d.c)) throw new Error("not an element");
      m = new It(d.t, d.p, l);
      for (const f of d.c) m.appendChild(i(f));
    }
    return m.hidden = d.h === 1, m;
  };
  try {
    return [i(s)];
  } catch {
    return null;
  }
}
class t0 {
  observe() {
  }
  unobserve() {
  }
  disconnect() {
  }
}
class e0 {
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
  setItem(l, s) {
    this.map.set(l, String(s));
  }
  removeItem(l) {
    this.map.delete(l);
  }
  clear() {
    this.map.clear();
  }
}
function _d(a) {
  for (let l = a; l instanceof It; l = l.parentElement) l.touch();
}
class n0 extends gs {
  constructor(l) {
    super(), this.perch = l, this.documentElement = new It("html", {}, this), this.body = new It("body", {}, this), this.documentElement.appendChild(this.body), this.activeElement = this.body, this.retries = [];
  }
  createElement(l) {
    return new It(l, {}, this);
  }
  /** `element`'s box as the engine last laid it out, or null before its first layout or without an engine that
   * reports boxes (`perch.bounds`). The first ask marks the element to be measured from the next frame on. Inside an
   * effect (`measured`) a box older than the tree, or none yet, puts the effect off until the next frame. */
  measure(l) {
    const s = this.perch?.bounds;
    if (typeof s != "function" || !this.measureKey) return null;
    l.measured || (l.measured = !0, l.touch(), this.restyled());
    const o = s(this.measureKey(l));
    if (Dr && (!o || this.stale?.())) throw { [vf]: this };
    return o ?? null;
  }
  /** An element's `style` was written: the tree is described again once the writing script is done. */
  restyled() {
    this.restyling || (this.restyling = !0, queueMicrotask(() => {
      this.restyling = !1, this.afterCommit?.();
    }));
  }
  focus(l) {
    this.activeElement && this.activeElement !== l && this.blur(this.activeElement), this.activeElement = l, l.state.focus = !0, l.state.pointerFocus = !1, _d(l), this.perch?.focused?.(l);
  }
  blur(l) {
    l.state.focus = !1, _d(l), this.activeElement === l && (this.activeElement = this.body);
  }
  querySelectorAll(l) {
    return _l(this.documentElement, l);
  }
  querySelector(l) {
    return this.querySelectorAll(l)[0] ?? null;
  }
  /** The element whose `id` prop is `id` (React's `useId` ids are not selectors). */
  getElementById(l) {
    return _l(this.documentElement, "*").find((s) => s.props?.id === l) ?? null;
  }
}
class a0 extends gs {
  constructor(l, s) {
    super(), this.perch = l, this.document = s, this.location = { get hostname() {
      return l.hostname ?? "localhost";
    } };
  }
  get innerWidth() {
    return this.perch.viewport?.().width ?? 1e3;
  }
  get innerHeight() {
    return this.perch.viewport?.().height ?? 800;
  }
  setTimeout(l, s, ...o) {
    return globalThis.setTimeout(l, s, ...o);
  }
  clearTimeout(l) {
    return globalThis.clearTimeout(l);
  }
}
function wf(a) {
  return {
    setTimeout: (l, s = 0, ...o) => a.setTimeout(() => l(...o), Math.max(0, Number(s) || 0)),
    clearTimeout: (l) => {
      l != null && a.clearTimeout(l);
    }
  };
}
const Sd = Symbol.for("perch.react.globals");
function Ze(a, l, s) {
  Object.defineProperty(a, l, { value: s, configurable: !0, writable: !0, enumerable: !1 });
}
function l0(a, l = globalThis) {
  const s = new n0(a), o = new a0(a, s);
  s.defaultView = o;
  const i = a.storage ?? new e0();
  if (typeof l.setTimeout != "function") {
    if (typeof a.setTimeout != "function") throw new Error("the engine has no setTimeout and the perch host gives none (perch.setTimeout)");
    const f = wf(a);
    Ze(l, "setTimeout", f.setTimeout), Ze(l, "clearTimeout", f.clearTimeout);
  }
  typeof l.queueMicrotask != "function" && Ze(l, "queueMicrotask", (f) => {
    Promise.resolve().then(f);
  }), Ze(l, "requestAnimationFrame", (f) => l.setTimeout(() => f(Date.now()), 0)), Ze(l, "cancelAnimationFrame", (f) => l.clearTimeout(f));
  const d = { document: s, window: o, localStorage: i, HTMLElement: It, Element: It };
  for (const f of Object.keys(d))
    Object.defineProperty(l, f, { get: () => l[Sd]?.[f], configurable: !0, enumerable: !1 });
  l[Sd] = d, Ze(l, "DOMRect", Po), Ze(l, "getComputedStyle", r0), typeof l.ResizeObserver != "function" && Ze(l, "ResizeObserver", t0);
  const m = l.navigator && typeof l.navigator == "object" ? l.navigator : {};
  if (!m.clipboard && a.clipboard)
    try {
      Ze(m, "clipboard", a.clipboard);
    } catch {
    }
  return l.navigator || Ze(l, "navigator", m), { document: s, window: o, globals: d };
}
function r0(a) {
  const l = a?.ownerDocument?.computed?.(a) ?? {}, s = (o) => {
    const i = l[o];
    return typeof i == "string" || typeof i == "number" ? String(i) : "";
  };
  return new Proxy({}, {
    get: (o, i) => {
      if (typeof i == "string")
        return i === "getPropertyValue" ? (d) => s(String(d)) : s(i.replace(/[A-Z]/g, (d) => `-${d.toLowerCase()}`));
    }
  });
}
function ts(a, l = !1) {
  if (!(l ? a?.tagName === "input" && _f(a) : a?.tagName === "button" && !/^(button|reset)$/.test(String(a.props.type ?? "submit")) && !a.props.disabled)) return null;
  for (let o = a.parentElement; o; o = o.parentElement) if (o.tagName === "form") return o;
  return null;
}
const _f = (a) => a?.tagName === "textarea" || a?.tagName === "input" && /^(text|search|url|email|tel|password|number|)$/.test(String(a.props.type ?? ""));
//! Evaluated before anything else in the runtime bundle: React's scheduler reads `setTimeout` and `queueMicrotask`
//! once, when it loads, so an engine without them (QuickJS) gets the host's (`perch.setTimeout`) first.
const kd = globalThis.perch;
if (typeof globalThis.setTimeout != "function" && typeof kd?.setTimeout == "function") {
  const a = wf(kd);
  globalThis.setTimeout = a.setTimeout, globalThis.clearTimeout = a.clearTimeout;
}
typeof globalThis.queueMicrotask != "function" && (globalThis.queueMicrotask = (a) => {
  Promise.resolve().then(a);
});
function bs(a) {
  return a && a.__esModule && Object.prototype.hasOwnProperty.call(a, "default") ? a.default : a;
}
function i0(a) {
  if (Object.prototype.hasOwnProperty.call(a, "__esModule")) return a;
  var l = a.default;
  if (typeof l == "function") {
    var s = function o() {
      return this instanceof o ? Reflect.construct(l, arguments, this.constructor) : l.apply(this, arguments);
    };
    s.prototype = l.prototype;
  } else s = {};
  return Object.defineProperty(s, "__esModule", { value: !0 }), Object.keys(a).forEach(function(o) {
    var i = Object.getOwnPropertyDescriptor(a, o);
    Object.defineProperty(s, o, i.get ? i : {
      enumerable: !0,
      get: function() {
        return a[o];
      }
    });
  }), s;
}
var Ho = { exports: {} }, pt = {};
/**
 * @license React
 * react.production.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var Ed;
function o0() {
  if (Ed) return pt;
  Ed = 1;
  var a = Symbol.for("react.transitional.element"), l = Symbol.for("react.portal"), s = Symbol.for("react.fragment"), o = Symbol.for("react.strict_mode"), i = Symbol.for("react.profiler"), d = Symbol.for("react.consumer"), m = Symbol.for("react.context"), f = Symbol.for("react.forward_ref"), b = Symbol.for("react.suspense"), x = Symbol.for("react.memo"), E = Symbol.for("react.lazy"), k = Symbol.for("react.activity"), w = Symbol.iterator;
  function N(T) {
    return T === null || typeof T != "object" ? null : (T = w && T[w] || T["@@iterator"], typeof T == "function" ? T : null);
  }
  var _ = {
    isMounted: function() {
      return !1;
    },
    enqueueForceUpdate: function() {
    },
    enqueueReplaceState: function() {
    },
    enqueueSetState: function() {
    }
  }, y = Object.assign, z = {};
  function R(T, V, et) {
    this.props = T, this.context = V, this.refs = z, this.updater = et || _;
  }
  R.prototype.isReactComponent = {}, R.prototype.setState = function(T, V) {
    if (typeof T != "object" && typeof T != "function" && T != null)
      throw Error(
        "takes an object of state variables to update or a function which returns an object of state variables."
      );
    this.updater.enqueueSetState(this, T, V, "setState");
  }, R.prototype.forceUpdate = function(T) {
    this.updater.enqueueForceUpdate(this, T, "forceUpdate");
  };
  function D() {
  }
  D.prototype = R.prototype;
  function A(T, V, et) {
    this.props = T, this.context = V, this.refs = z, this.updater = et || _;
  }
  var X = A.prototype = new D();
  X.constructor = A, y(X, R.prototype), X.isPureReactComponent = !0;
  var q = Array.isArray;
  function O() {
  }
  var h = { H: null, A: null, T: null, S: null }, p = Object.prototype.hasOwnProperty;
  function v(T, V, et) {
    var it = et.ref;
    return {
      $$typeof: a,
      type: T,
      key: V,
      ref: it !== void 0 ? it : null,
      props: et
    };
  }
  function S(T, V) {
    return v(T.type, V, T.props);
  }
  function M(T) {
    return typeof T == "object" && T !== null && T.$$typeof === a;
  }
  function H(T) {
    var V = { "=": "=0", ":": "=2" };
    return "$" + T.replace(/[=:]/g, function(et) {
      return V[et];
    });
  }
  var J = /\/+/g;
  function $(T, V) {
    return typeof T == "object" && T !== null && T.key != null ? H("" + T.key) : V.toString(36);
  }
  function tt(T) {
    switch (T.status) {
      case "fulfilled":
        return T.value;
      case "rejected":
        throw T.reason;
      default:
        switch (typeof T.status == "string" ? T.then(O, O) : (T.status = "pending", T.then(
          function(V) {
            T.status === "pending" && (T.status = "fulfilled", T.value = V);
          },
          function(V) {
            T.status === "pending" && (T.status = "rejected", T.reason = V);
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
  function Q(T, V, et, it, ot) {
    var st = typeof T;
    (st === "undefined" || st === "boolean") && (T = null);
    var kt = !1;
    if (T === null) kt = !0;
    else
      switch (st) {
        case "bigint":
        case "string":
        case "number":
          kt = !0;
          break;
        case "object":
          switch (T.$$typeof) {
            case a:
            case l:
              kt = !0;
              break;
            case E:
              return kt = T._init, Q(
                kt(T._payload),
                V,
                et,
                it,
                ot
              );
          }
      }
    if (kt)
      return ot = ot(T), kt = it === "" ? "." + $(T, 0) : it, q(ot) ? (et = "", kt != null && (et = kt.replace(J, "$&/") + "/"), Q(ot, V, et, "", function(Gn) {
        return Gn;
      })) : ot != null && (M(ot) && (ot = S(
        ot,
        et + (ot.key == null || T && T.key === ot.key ? "" : ("" + ot.key).replace(
          J,
          "$&/"
        ) + "/") + kt
      )), V.push(ot)), 1;
    kt = 0;
    var Zt = it === "" ? "." : it + ":";
    if (q(T))
      for (var ht = 0; ht < T.length; ht++)
        it = T[ht], st = Zt + $(it, ht), kt += Q(
          it,
          V,
          et,
          st,
          ot
        );
    else if (ht = N(T), typeof ht == "function")
      for (T = ht.call(T), ht = 0; !(it = T.next()).done; )
        it = it.value, st = Zt + $(it, ht++), kt += Q(
          it,
          V,
          et,
          st,
          ot
        );
    else if (st === "object") {
      if (typeof T.then == "function")
        return Q(
          tt(T),
          V,
          et,
          it,
          ot
        );
      throw V = String(T), Error(
        "Objects are not valid as a React child (found: " + (V === "[object Object]" ? "object with keys {" + Object.keys(T).join(", ") + "}" : V) + "). If you meant to render a collection of children, use an array instead."
      );
    }
    return kt;
  }
  function L(T, V, et) {
    if (T == null) return T;
    var it = [], ot = 0;
    return Q(T, it, "", "", function(st) {
      return V.call(et, st, ot++);
    }), it;
  }
  function I(T) {
    if (T._status === -1) {
      var V = T._result;
      V = V(), V.then(
        function(et) {
          (T._status === 0 || T._status === -1) && (T._status = 1, T._result = et);
        },
        function(et) {
          (T._status === 0 || T._status === -1) && (T._status = 2, T._result = et);
        }
      ), T._status === -1 && (T._status = 0, T._result = V);
    }
    if (T._status === 1) return T._result.default;
    throw T._result;
  }
  var G = typeof reportError == "function" ? reportError : function(T) {
    if (typeof window == "object" && typeof window.ErrorEvent == "function") {
      var V = new window.ErrorEvent("error", {
        bubbles: !0,
        cancelable: !0,
        message: typeof T == "object" && T !== null && typeof T.message == "string" ? String(T.message) : String(T),
        error: T
      });
      if (!window.dispatchEvent(V)) return;
    } else if (typeof process == "object" && typeof process.emit == "function") {
      process.emit("uncaughtException", T);
      return;
    }
    console.error(T);
  }, K = {
    map: L,
    forEach: function(T, V, et) {
      L(
        T,
        function() {
          V.apply(this, arguments);
        },
        et
      );
    },
    count: function(T) {
      var V = 0;
      return L(T, function() {
        V++;
      }), V;
    },
    toArray: function(T) {
      return L(T, function(V) {
        return V;
      }) || [];
    },
    only: function(T) {
      if (!M(T))
        throw Error(
          "React.Children.only expected to receive a single React element child."
        );
      return T;
    }
  };
  return pt.Activity = k, pt.Children = K, pt.Component = R, pt.Fragment = s, pt.Profiler = i, pt.PureComponent = A, pt.StrictMode = o, pt.Suspense = b, pt.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE = h, pt.__COMPILER_RUNTIME = {
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
  }, pt.cloneElement = function(T, V, et) {
    if (T == null)
      throw Error(
        "The argument must be a React element, but you passed " + T + "."
      );
    var it = y({}, T.props), ot = T.key;
    if (V != null)
      for (st in V.key !== void 0 && (ot = "" + V.key), V)
        !p.call(V, st) || st === "key" || st === "__self" || st === "__source" || st === "ref" && V.ref === void 0 || (it[st] = V[st]);
    var st = arguments.length - 2;
    if (st === 1) it.children = et;
    else if (1 < st) {
      for (var kt = Array(st), Zt = 0; Zt < st; Zt++)
        kt[Zt] = arguments[Zt + 2];
      it.children = kt;
    }
    return v(T.type, ot, it);
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
  }, pt.createElement = function(T, V, et) {
    var it, ot = {}, st = null;
    if (V != null)
      for (it in V.key !== void 0 && (st = "" + V.key), V)
        p.call(V, it) && it !== "key" && it !== "__self" && it !== "__source" && (ot[it] = V[it]);
    var kt = arguments.length - 2;
    if (kt === 1) ot.children = et;
    else if (1 < kt) {
      for (var Zt = Array(kt), ht = 0; ht < kt; ht++)
        Zt[ht] = arguments[ht + 2];
      ot.children = Zt;
    }
    if (T && T.defaultProps)
      for (it in kt = T.defaultProps, kt)
        ot[it] === void 0 && (ot[it] = kt[it]);
    return v(T, st, ot);
  }, pt.createRef = function() {
    return { current: null };
  }, pt.forwardRef = function(T) {
    return { $$typeof: f, render: T };
  }, pt.isValidElement = M, pt.lazy = function(T) {
    return {
      $$typeof: E,
      _payload: { _status: -1, _result: T },
      _init: I
    };
  }, pt.memo = function(T, V) {
    return {
      $$typeof: x,
      type: T,
      compare: V === void 0 ? null : V
    };
  }, pt.startTransition = function(T) {
    var V = h.T, et = {};
    h.T = et;
    try {
      var it = T(), ot = h.S;
      ot !== null && ot(et, it), typeof it == "object" && it !== null && typeof it.then == "function" && it.then(O, G);
    } catch (st) {
      G(st);
    } finally {
      V !== null && et.types !== null && (V.types = et.types), h.T = V;
    }
  }, pt.unstable_useCacheRefresh = function() {
    return h.H.useCacheRefresh();
  }, pt.use = function(T) {
    return h.H.use(T);
  }, pt.useActionState = function(T, V, et) {
    return h.H.useActionState(T, V, et);
  }, pt.useCallback = function(T, V) {
    return h.H.useCallback(T, V);
  }, pt.useContext = function(T) {
    return h.H.useContext(T);
  }, pt.useDebugValue = function() {
  }, pt.useDeferredValue = function(T, V) {
    return h.H.useDeferredValue(T, V);
  }, pt.useEffect = function(T, V) {
    return h.H.useEffect(T, V);
  }, pt.useEffectEvent = function(T) {
    return h.H.useEffectEvent(T);
  }, pt.useId = function() {
    return h.H.useId();
  }, pt.useImperativeHandle = function(T, V, et) {
    return h.H.useImperativeHandle(T, V, et);
  }, pt.useInsertionEffect = function(T, V) {
    return h.H.useInsertionEffect(T, V);
  }, pt.useLayoutEffect = function(T, V) {
    return h.H.useLayoutEffect(T, V);
  }, pt.useMemo = function(T, V) {
    return h.H.useMemo(T, V);
  }, pt.useOptimistic = function(T, V) {
    return h.H.useOptimistic(T, V);
  }, pt.useReducer = function(T, V, et) {
    return h.H.useReducer(T, V, et);
  }, pt.useRef = function(T) {
    return h.H.useRef(T);
  }, pt.useState = function(T) {
    return h.H.useState(T);
  }, pt.useSyncExternalStore = function(T, V, et) {
    return h.H.useSyncExternalStore(
      T,
      V,
      et
    );
  }, pt.useTransition = function() {
    return h.H.useTransition();
  }, pt.version = "19.2.8", pt;
}
var zd;
function s0() {
  return zd || (zd = 1, Ho.exports = o0()), Ho.exports;
}
var dt = s0();
const Sf = /* @__PURE__ */ bs(dt), c0 = /* @__PURE__ */ ms({
  __proto__: null,
  default: Sf
}, [dt]);
//! "react" as the runtime bundles it, for its own code, the stock screens and every screen's `react` import: React
//! itself, with `useEffect` and `useLayoutEffect` run through `measured` (`dom.mjs`), so an effect that measures a
//! box the engine has not laid out yet runs again once it has (layout readback).
const u0 = Sf ?? c0;
function Fe(a, l) {
  return dt.useEffect(xf(a), l);
}
function es(a, l) {
  return dt.useLayoutEffect(xf(a), l);
}
const d0 = /* @__PURE__ */ ms({
  __proto__: null,
  default: u0,
  useEffect: Fe,
  useLayoutEffect: es
}, [dt]);
var Bo = { exports: {} }, bl = {};
/**
 * @license React
 * react-jsx-runtime.production.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var Nd;
function f0() {
  if (Nd) return bl;
  Nd = 1;
  var a = Symbol.for("react.transitional.element"), l = Symbol.for("react.fragment");
  function s(o, i, d) {
    var m = null;
    if (d !== void 0 && (m = "" + d), i.key !== void 0 && (m = "" + i.key), "key" in i) {
      d = {};
      for (var f in i)
        f !== "key" && (d[f] = i[f]);
    } else d = i;
    return i = d.ref, {
      $$typeof: a,
      type: o,
      key: m,
      ref: i !== void 0 ? i : null,
      props: d
    };
  }
  return bl.Fragment = l, bl.jsx = s, bl.jsxs = s, bl;
}
var Td;
function m0() {
  return Td || (Td = 1, Bo.exports = f0()), Bo.exports;
}
var ft = m0();
const p0 = /* @__PURE__ */ bs(ft), ly = /* @__PURE__ */ ms({
  __proto__: null,
  default: p0
}, [ft]);
var Uo = { exports: {} }, qo = { exports: {} };
const h0 = /* @__PURE__ */ i0(d0);
var Yo = { exports: {} }, Go = {};
/**
 * @license React
 * scheduler.production.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var Cd;
function g0() {
  return Cd || (Cd = 1, (function(a) {
    function l(Q, L) {
      var I = Q.length;
      Q.push(L);
      t: for (; 0 < I; ) {
        var G = I - 1 >>> 1, K = Q[G];
        if (0 < i(K, L))
          Q[G] = L, Q[I] = K, I = G;
        else break t;
      }
    }
    function s(Q) {
      return Q.length === 0 ? null : Q[0];
    }
    function o(Q) {
      if (Q.length === 0) return null;
      var L = Q[0], I = Q.pop();
      if (I !== L) {
        Q[0] = I;
        t: for (var G = 0, K = Q.length, T = K >>> 1; G < T; ) {
          var V = 2 * (G + 1) - 1, et = Q[V], it = V + 1, ot = Q[it];
          if (0 > i(et, I))
            it < K && 0 > i(ot, et) ? (Q[G] = ot, Q[it] = I, G = it) : (Q[G] = et, Q[V] = I, G = V);
          else if (it < K && 0 > i(ot, I))
            Q[G] = ot, Q[it] = I, G = it;
          else break t;
        }
      }
      return L;
    }
    function i(Q, L) {
      var I = Q.sortIndex - L.sortIndex;
      return I !== 0 ? I : Q.id - L.id;
    }
    if (a.unstable_now = void 0, typeof performance == "object" && typeof performance.now == "function") {
      var d = performance;
      a.unstable_now = function() {
        return d.now();
      };
    } else {
      var m = Date, f = m.now();
      a.unstable_now = function() {
        return m.now() - f;
      };
    }
    var b = [], x = [], E = 1, k = null, w = 3, N = !1, _ = !1, y = !1, z = !1, R = typeof setTimeout == "function" ? setTimeout : null, D = typeof clearTimeout == "function" ? clearTimeout : null, A = typeof setImmediate < "u" ? setImmediate : null;
    function X(Q) {
      for (var L = s(x); L !== null; ) {
        if (L.callback === null) o(x);
        else if (L.startTime <= Q)
          o(x), L.sortIndex = L.expirationTime, l(b, L);
        else break;
        L = s(x);
      }
    }
    function q(Q) {
      if (y = !1, X(Q), !_)
        if (s(b) !== null)
          _ = !0, O || (O = !0, H());
        else {
          var L = s(x);
          L !== null && tt(q, L.startTime - Q);
        }
    }
    var O = !1, h = -1, p = 5, v = -1;
    function S() {
      return z ? !0 : !(a.unstable_now() - v < p);
    }
    function M() {
      if (z = !1, O) {
        var Q = a.unstable_now();
        v = Q;
        var L = !0;
        try {
          t: {
            _ = !1, y && (y = !1, D(h), h = -1), N = !0;
            var I = w;
            try {
              e: {
                for (X(Q), k = s(b); k !== null && !(k.expirationTime > Q && S()); ) {
                  var G = k.callback;
                  if (typeof G == "function") {
                    k.callback = null, w = k.priorityLevel;
                    var K = G(
                      k.expirationTime <= Q
                    );
                    if (Q = a.unstable_now(), typeof K == "function") {
                      k.callback = K, X(Q), L = !0;
                      break e;
                    }
                    k === s(b) && o(b), X(Q);
                  } else o(b);
                  k = s(b);
                }
                if (k !== null) L = !0;
                else {
                  var T = s(x);
                  T !== null && tt(
                    q,
                    T.startTime - Q
                  ), L = !1;
                }
              }
              break t;
            } finally {
              k = null, w = I, N = !1;
            }
            L = void 0;
          }
        } finally {
          L ? H() : O = !1;
        }
      }
    }
    var H;
    if (typeof A == "function")
      H = function() {
        A(M);
      };
    else if (typeof MessageChannel < "u") {
      var J = new MessageChannel(), $ = J.port2;
      J.port1.onmessage = M, H = function() {
        $.postMessage(null);
      };
    } else
      H = function() {
        R(M, 0);
      };
    function tt(Q, L) {
      h = R(function() {
        Q(a.unstable_now());
      }, L);
    }
    a.unstable_IdlePriority = 5, a.unstable_ImmediatePriority = 1, a.unstable_LowPriority = 4, a.unstable_NormalPriority = 3, a.unstable_Profiling = null, a.unstable_UserBlockingPriority = 2, a.unstable_cancelCallback = function(Q) {
      Q.callback = null;
    }, a.unstable_forceFrameRate = function(Q) {
      0 > Q || 125 < Q ? console.error(
        "forceFrameRate takes a positive int between 0 and 125, forcing frame rates higher than 125 fps is not supported"
      ) : p = 0 < Q ? Math.floor(1e3 / Q) : 5;
    }, a.unstable_getCurrentPriorityLevel = function() {
      return w;
    }, a.unstable_next = function(Q) {
      switch (w) {
        case 1:
        case 2:
        case 3:
          var L = 3;
          break;
        default:
          L = w;
      }
      var I = w;
      w = L;
      try {
        return Q();
      } finally {
        w = I;
      }
    }, a.unstable_requestPaint = function() {
      z = !0;
    }, a.unstable_runWithPriority = function(Q, L) {
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
      var I = w;
      w = Q;
      try {
        return L();
      } finally {
        w = I;
      }
    }, a.unstable_scheduleCallback = function(Q, L, I) {
      var G = a.unstable_now();
      switch (typeof I == "object" && I !== null ? (I = I.delay, I = typeof I == "number" && 0 < I ? G + I : G) : I = G, Q) {
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
      return K = I + K, Q = {
        id: E++,
        callback: L,
        priorityLevel: Q,
        startTime: I,
        expirationTime: K,
        sortIndex: -1
      }, I > G ? (Q.sortIndex = I, l(x, Q), s(b) === null && Q === s(x) && (y ? (D(h), h = -1) : y = !0, tt(q, I - G))) : (Q.sortIndex = K, l(b, Q), _ || N || (_ = !0, O || (O = !0, H()))), Q;
    }, a.unstable_shouldYield = S, a.unstable_wrapCallback = function(Q) {
      var L = w;
      return function() {
        var I = w;
        w = L;
        try {
          return Q.apply(this, arguments);
        } finally {
          w = I;
        }
      };
    };
  })(Go)), Go;
}
var Md;
function b0() {
  return Md || (Md = 1, Yo.exports = g0()), Yo.exports;
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
var Ad;
function v0() {
  return Ad || (Ad = 1, (function(a) {
    a.exports = function(l) {
      function s(t, e, n, r) {
        return new Jm(t, e, n, r);
      }
      function o() {
      }
      function i(t) {
        var e = "https://react.dev/errors/" + t;
        if (1 < arguments.length) {
          e += "?args[]=" + encodeURIComponent(arguments[1]);
          for (var n = 2; n < arguments.length; n++)
            e += "&args[]=" + encodeURIComponent(arguments[n]);
        }
        return "Minified React error #" + t + "; visit " + e + " for the full message or use the non-minified dev environment for full errors and additional helpful warnings.";
      }
      function d(t) {
        var e = t, n = t;
        if (t.alternate) for (; e.return; ) e = e.return;
        else {
          t = e;
          do
            e = t, (e.flags & 4098) !== 0 && (n = e.return), t = e.return;
          while (t);
        }
        return e.tag === 3 ? n : null;
      }
      function m(t) {
        if (d(t) !== t)
          throw Error(i(188));
      }
      function f(t) {
        var e = t.alternate;
        if (!e) {
          if (e = d(t), e === null) throw Error(i(188));
          return e !== t ? null : t;
        }
        for (var n = t, r = e; ; ) {
          var c = n.return;
          if (c === null) break;
          var u = c.alternate;
          if (u === null) {
            if (r = c.return, r !== null) {
              n = r;
              continue;
            }
            break;
          }
          if (c.child === u.child) {
            for (u = c.child; u; ) {
              if (u === n) return m(c), t;
              if (u === r) return m(c), e;
              u = u.sibling;
            }
            throw Error(i(188));
          }
          if (n.return !== r.return) n = c, r = u;
          else {
            for (var g = !1, C = c.child; C; ) {
              if (C === n) {
                g = !0, n = c, r = u;
                break;
              }
              if (C === r) {
                g = !0, r = c, n = u;
                break;
              }
              C = C.sibling;
            }
            if (!g) {
              for (C = u.child; C; ) {
                if (C === n) {
                  g = !0, n = u, r = c;
                  break;
                }
                if (C === r) {
                  g = !0, r = u, n = c;
                  break;
                }
                C = C.sibling;
              }
              if (!g) throw Error(i(189));
            }
          }
          if (n.alternate !== r) throw Error(i(190));
        }
        if (n.tag !== 3) throw Error(i(188));
        return n.stateNode.current === n ? t : e;
      }
      function b(t) {
        var e = t.tag;
        if (e === 5 || e === 26 || e === 27 || e === 6) return t;
        for (t = t.child; t !== null; ) {
          if (e = b(t), e !== null) return e;
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
      function E(t) {
        return t === null || typeof t != "object" ? null : (t = qu && t[qu] || t["@@iterator"], typeof t == "function" ? t : null);
      }
      function k(t) {
        if (t == null) return null;
        if (typeof t == "function")
          return t.$$typeof === $m ? null : t.displayName || t.name || null;
        if (typeof t == "string") return t;
        switch (t) {
          case ya:
            return "Fragment";
          case eo:
            return "Profiler";
          case Bu:
            return "StrictMode";
          case ao:
            return "Suspense";
          case lo:
            return "SuspenseList";
          case io:
            return "Activity";
        }
        if (typeof t == "object")
          switch (t.$$typeof) {
            case va:
              return "Portal";
            case _n:
              return t.displayName || "Context";
            case Uu:
              return (t._context.displayName || "Context") + ".Consumer";
            case no:
              var e = t.render;
              return t = t.displayName, t || (t = e.displayName || e.name || "", t = t !== "" ? "ForwardRef(" + t + ")" : "ForwardRef"), t;
            case ro:
              return e = t.displayName || null, e !== null ? e : k(t.type) || "Memo";
            case Sn:
              e = t._payload, t = t._init;
              try {
                return k(t(e));
              } catch {
              }
          }
        return null;
      }
      function w(t) {
        return { current: t };
      }
      function N(t) {
        0 > _a || (t.current = mo[_a], mo[_a] = null, _a--);
      }
      function _(t, e) {
        _a++, mo[_a] = t.current, t.current = e;
      }
      function y(t) {
        return t >>>= 0, t === 0 ? 32 : 31 - (Nh(t) / Th | 0) | 0;
      }
      function z(t) {
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
      function R(t, e, n) {
        var r = t.pendingLanes;
        if (r === 0) return 0;
        var c = 0, u = t.suspendedLanes, g = t.pingedLanes;
        t = t.warmLanes;
        var C = r & 134217727;
        return C !== 0 ? (r = C & ~u, r !== 0 ? c = z(r) : (g &= C, g !== 0 ? c = z(g) : n || (n = C & ~t, n !== 0 && (c = z(n))))) : (C = r & ~u, C !== 0 ? c = z(C) : g !== 0 ? c = z(g) : n || (n = r & ~t, n !== 0 && (c = z(n)))), c === 0 ? 0 : e !== 0 && e !== c && (e & u) === 0 && (u = c & -c, n = e & -e, u >= n || u === 32 && (n & 4194048) !== 0) ? e : c;
      }
      function D(t, e) {
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
      function X() {
        var t = ir;
        return ir <<= 1, (ir & 62914560) === 0 && (ir = 4194304), t;
      }
      function q(t) {
        for (var e = [], n = 0; 31 > n; n++) e.push(t);
        return e;
      }
      function O(t, e) {
        t.pendingLanes |= e, e !== 268435456 && (t.suspendedLanes = 0, t.pingedLanes = 0, t.warmLanes = 0);
      }
      function h(t, e, n, r, c, u) {
        var g = t.pendingLanes;
        t.pendingLanes = n, t.suspendedLanes = 0, t.pingedLanes = 0, t.warmLanes = 0, t.expiredLanes &= n, t.entangledLanes &= n, t.errorRecoveryDisabledLanes &= n, t.shellSuspendCounter = 0;
        var C = t.entanglements, Y = t.expirationTimes, Z = t.hiddenUpdates;
        for (n = g & ~n; 0 < n; ) {
          var P = 31 - xe(n), W = 1 << P;
          C[P] = 0, Y[P] = -1;
          var nt = Z[P];
          if (nt !== null)
            for (Z[P] = null, P = 0; P < nt.length; P++) {
              var gt = nt[P];
              gt !== null && (gt.lane &= -536870913);
            }
          n &= ~W;
        }
        r !== 0 && p(t, r, 0), u !== 0 && c === 0 && t.tag !== 0 && (t.suspendedLanes |= u & ~(g & ~e));
      }
      function p(t, e, n) {
        t.pendingLanes |= e, t.suspendedLanes &= ~e;
        var r = 31 - xe(e);
        t.entangledLanes |= e, t.entanglements[r] = t.entanglements[r] | 1073741824 | n & 261930;
      }
      function v(t, e) {
        var n = t.entangledLanes |= e;
        for (t = t.entanglements; n; ) {
          var r = 31 - xe(n), c = 1 << r;
          c & e | t[r] & e && (t[r] |= e), n &= ~c;
        }
      }
      function S(t, e) {
        var n = e & -e;
        return n = (n & 42) !== 0 ? 1 : M(n), (n & (t.suspendedLanes | e)) !== 0 ? 0 : n;
      }
      function M(t) {
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
      function H(t) {
        return t &= -t, 2 < t ? 8 < t ? (t & 134217727) !== 0 ? 32 : 268435456 : 8 : 2;
      }
      function J(t) {
        if (typeof Oh == "function" && Rh(t), we && typeof we.setStrictMode == "function")
          try {
            we.setStrictMode(rl, t);
          } catch {
          }
      }
      function $(t, e) {
        return t === e && (t !== 0 || 1 / t === 1 / e) || t !== t && e !== e;
      }
      function tt(t) {
        if (go === void 0)
          try {
            throw Error();
          } catch (n) {
            var e = n.stack.trim().match(/\n( *(at )?)/);
            go = e && e[1] || "", dd = -1 < n.stack.indexOf(`
    at`) ? " (<anonymous>)" : -1 < n.stack.indexOf("@") ? "@unknown:0:0" : "";
          }
        return `
` + go + t + dd;
      }
      function Q(t, e) {
        if (!t || bo) return "";
        bo = !0;
        var n = Error.prepareStackTrace;
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
          var u = r.DetermineComponentFrameRoot(), g = u[0], C = u[1];
          if (g && C) {
            var Y = g.split(`
`), Z = C.split(`
`);
            for (c = r = 0; r < Y.length && !Y[r].includes("DetermineComponentFrameRoot"); )
              r++;
            for (; c < Z.length && !Z[c].includes(
              "DetermineComponentFrameRoot"
            ); )
              c++;
            if (r === Y.length || c === Z.length)
              for (r = Y.length - 1, c = Z.length - 1; 1 <= r && 0 <= c && Y[r] !== Z[c]; )
                c--;
            for (; 1 <= r && 0 <= c; r--, c--)
              if (Y[r] !== Z[c]) {
                if (r !== 1 || c !== 1)
                  do
                    if (r--, c--, 0 > c || Y[r] !== Z[c]) {
                      var P = `
` + Y[r].replace(" at new ", " at ");
                      return t.displayName && P.includes("<anonymous>") && (P = P.replace("<anonymous>", t.displayName)), P;
                    }
                  while (1 <= r && 0 <= c);
                break;
              }
          }
        } finally {
          bo = !1, Error.prepareStackTrace = n;
        }
        return (n = t ? t.displayName || t.name : "") ? tt(n) : "";
      }
      function L(t, e) {
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
      function I(t) {
        try {
          var e = "", n = null;
          do
            e += L(t, n), n = t, t = t.return;
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
          var n = fd.get(t);
          return n !== void 0 ? n : (e = {
            value: t,
            source: e,
            stack: I(e)
          }, fd.set(t, e), e);
        }
        return {
          value: t,
          source: e,
          stack: I(e)
        };
      }
      function K(t, e) {
        ka[Ea++] = il, ka[Ea++] = sr, sr = t, il = e;
      }
      function T(t, e, n) {
        Te[Ce++] = Xe, Te[Ce++] = Le, Te[Ce++] = kn, kn = t;
        var r = Xe;
        t = Le;
        var c = 32 - xe(r) - 1;
        r &= ~(1 << c), n += 1;
        var u = 32 - xe(e) + c;
        if (30 < u) {
          var g = c - c % 5;
          u = (r & (1 << g) - 1).toString(32), r >>= g, c -= g, Xe = 1 << 32 - xe(e) + c | n << c | r, Le = u + t;
        } else
          Xe = 1 << u | n << c | r, Le = t;
      }
      function V(t) {
        t.return !== null && (K(t, 1), T(t, 1, 0));
      }
      function et(t) {
        for (; t === sr; )
          sr = ka[--Ea], ka[Ea] = null, il = ka[--Ea], ka[Ea] = null;
        for (; t === kn; )
          kn = Te[--Ce], Te[Ce] = null, Le = Te[--Ce], Te[Ce] = null, Xe = Te[--Ce], Te[Ce] = null;
      }
      function it(t, e) {
        Te[Ce++] = Xe, Te[Ce++] = Le, Te[Ce++] = kn, Xe = e.id, Le = e.overflow, kn = t;
      }
      function ot(t, e) {
        _(En, e), _(ol, t), _(te, null), t = np(e), N(te), _(te, t);
      }
      function st() {
        N(te), N(ol), N(En);
      }
      function kt(t) {
        t.memoizedState !== null && _(cr, t);
        var e = te.current, n = ap(e, t.type);
        e !== n && (_(ol, t), _(te, n));
      }
      function Zt(t) {
        ol.current === t && (N(te), N(ol)), cr.current === t && (N(cr), an ? In._currentValue = xa : In._currentValue2 = xa);
      }
      function ht(t) {
        var e = Error(
          i(
            418,
            1 < arguments.length && arguments[1] !== void 0 && arguments[1] ? "text" : "HTML",
            ""
          )
        );
        throw Ga(G(e, t)), vo;
      }
      function Gn(t, e) {
        if (!oe) throw Error(i(175));
        ah(
          t.stateNode,
          t.type,
          t.memoizedProps,
          e,
          t
        ) || ht(t, !0);
      }
      function Kn(t) {
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
        if (!oe || t !== ee) return !1;
        if (!St) return Kn(t), St = !0, !1;
        var e = t.tag;
        if (Vt ? e !== 3 && e !== 27 && (e !== 5 || Pu(t.type) && !ar(t.type, t.memoizedProps)) && Ot && ht(t) : e !== 3 && (e !== 5 || Pu(t.type) && !ar(t.type, t.memoizedProps)) && Ot && ht(t), Kn(t), e === 13) {
          if (!oe) throw Error(i(316));
          if (t = t.memoizedState, t = t !== null ? t.dehydrated : null, !t) throw Error(i(317));
          Ot = sh(t);
        } else if (e === 31) {
          if (t = t.memoizedState, t = t !== null ? t.dehydrated : null, !t) throw Error(i(317));
          Ot = oh(t);
        } else
          Ot = Vt && e === 27 ? Zp(
            t.type,
            Ot
          ) : ee ? Iu(t.stateNode) : null;
        return !0;
      }
      function De() {
        oe && (Ot = ee = null, St = !1);
      }
      function pn() {
        var t = zn;
        return t !== null && (he === null ? he = t : he.push.apply(
          he,
          t
        ), zn = null), t;
      }
      function Ga(t) {
        zn === null ? zn = [t] : zn.push(t);
      }
      function hn(t, e, n) {
        an ? (_(ur, e._currentValue), e._currentValue = n) : (_(ur, e._currentValue2), e._currentValue2 = n);
      }
      function Ie(t) {
        var e = ur.current;
        an ? t._currentValue = e : t._currentValue2 = e, N(ur);
      }
      function Pr(t, e, n) {
        for (; t !== null; ) {
          var r = t.alternate;
          if ((t.childLanes & e) !== e ? (t.childLanes |= e, r !== null && (r.childLanes |= e)) : r !== null && (r.childLanes & e) !== e && (r.childLanes |= e), t === n) break;
          t = t.return;
        }
      }
      function $r(t, e, n, r) {
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
                  u.lanes |= n, C = u.alternate, C !== null && (C.lanes |= n), Pr(
                    u.return,
                    n,
                    t
                  ), r || (g = null);
                  break t;
                }
              u = C.next;
            }
          } else if (c.tag === 18) {
            if (g = c.return, g === null) throw Error(i(341));
            g.lanes |= n, u = g.alternate, u !== null && (u.lanes |= n), Pr(g, n, t), g = null;
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
      function fa(t, e, n, r) {
        t = null;
        for (var c = e, u = !1; c !== null; ) {
          if (!u) {
            if ((c.flags & 524288) !== 0) u = !0;
            else if ((c.flags & 262144) !== 0) break;
          }
          if (c.tag === 10) {
            var g = c.alternate;
            if (g === null) throw Error(i(387));
            if (g = g.memoizedProps, g !== null) {
              var C = c.type;
              _e(c.pendingProps.value, g.value) || (t !== null ? t.push(C) : t = [C]);
            }
          } else if (c === cr.current) {
            if (g = c.alternate, g === null) throw Error(i(387));
            g.memoizedState.memoizedState !== c.memoizedState.memoizedState && (t !== null ? t.push(In) : t = [In]);
          }
          c = c.return;
        }
        t !== null && $r(
          e,
          t,
          n,
          r
        ), e.flags |= 262144;
      }
      function zl(t) {
        for (t = t.firstContext; t !== null; ) {
          var e = t.context;
          if (!_e(
            an ? e._currentValue : e._currentValue2,
            t.memoizedValue
          ))
            return !0;
          t = t.next;
        }
        return !1;
      }
      function Qn(t) {
        Pn = t, rn = null, t = t.dependencies, t !== null && (t.firstContext = null);
      }
      function Pt(t) {
        return Es(Pn, t);
      }
      function Nl(t, e) {
        return Pn === null && Qn(t), Es(t, e);
      }
      function Es(t, e) {
        var n = an ? e._currentValue : e._currentValue2;
        if (e = { context: e, memoizedValue: n, next: null }, rn === null) {
          if (t === null) throw Error(i(308));
          rn = e, t.dependencies = { lanes: 0, firstContext: e }, t.flags |= 524288;
        } else rn = rn.next = e;
        return n;
      }
      function ti() {
        return {
          controller: new Hh(),
          data: /* @__PURE__ */ new Map(),
          refCount: 0
        };
      }
      function Ka(t) {
        t.refCount--, t.refCount === 0 && Bh(Uh, function() {
          t.controller.abort();
        });
      }
      function Tl() {
      }
      function Ke(t) {
        t !== za && t.next === null && (za === null ? dr = za = t : za = za.next = t), fr = !0, yo || (yo = !0, km());
      }
      function ma(t, e) {
        if (!xo && fr) {
          xo = !0;
          do
            for (var n = !1, r = dr; r !== null; ) {
              if (t !== 0) {
                var c = r.pendingLanes;
                if (c === 0) var u = 0;
                else {
                  var g = r.suspendedLanes, C = r.pingedLanes;
                  u = (1 << 31 - xe(42 | t) + 1) - 1, u &= c & ~(g & ~C), u = u & 201326741 ? u & 201326741 | 1 : u ? u | 2 : 0;
                }
                u !== 0 && (n = !0, Ms(r, u));
              } else
                u = _t, u = R(
                  r,
                  r === At ? u : 0,
                  r.cancelPendingCommit !== null || r.timeoutHandle !== Fn
                ), (u & 3) === 0 || D(r, u) || (n = !0, Ms(r, u));
              r = r.next;
            }
          while (n);
          xo = !1;
        }
      }
      function zs() {
        Ns();
      }
      function Ns() {
        fr = yo = !1;
        var t = 0;
        $n !== 0 && fp() && (t = $n);
        for (var e = me(), n = null, r = dr; r !== null; ) {
          var c = r.next, u = Ts(r, e);
          u === 0 ? (r.next = null, n === null ? dr = c : n.next = c, c === null && (za = n)) : (n = r, (t !== 0 || (u & 3) !== 0) && (fr = !0)), r = c;
        }
        Xt !== 0 && Xt !== 5 || ma(t), $n !== 0 && ($n = 0);
      }
      function Ts(t, e) {
        for (var n = t.suspendedLanes, r = t.pingedLanes, c = t.expirationTimes, u = t.pendingLanes & -62914561; 0 < u; ) {
          var g = 31 - xe(u), C = 1 << g, Y = c[g];
          Y === -1 ? ((C & n) === 0 || (C & r) !== 0) && (c[g] = A(C, e)) : Y <= e && (t.expiredLanes |= C), u &= ~C;
        }
        if (e = At, n = _t, n = R(
          t,
          t === e ? n : 0,
          t.cancelPendingCommit !== null || t.timeoutHandle !== Fn
        ), r = t.callbackNode, n === 0 || t === e && (Ct === 2 || Ct === 9) || t.cancelPendingCommit !== null)
          return r !== null && r !== null && po(r), t.callbackNode = null, t.callbackPriority = 0;
        if ((n & 3) === 0 || D(t, n)) {
          if (e = n & -n, e === t.callbackPriority) return e;
          switch (r !== null && po(r), H(n)) {
            case 2:
            case 8:
              n = Ah;
              break;
            case 32:
              n = ho;
              break;
            case 268435456:
              n = jh;
              break;
            default:
              n = ho;
          }
          return r = Cs.bind(null, t), n = or(n, r), t.callbackPriority = e, t.callbackNode = n, e;
        }
        return r !== null && r !== null && po(r), t.callbackPriority = 2, t.callbackNode = null, 2;
      }
      function Cs(t, e) {
        if (Xt !== 0 && Xt !== 5)
          return t.callbackNode = null, t.callbackPriority = 0, null;
        var n = t.callbackNode;
        if (el() && t.callbackNode !== n)
          return null;
        var r = _t;
        return r = R(
          t,
          t === At ? r : 0,
          t.cancelPendingCommit !== null || t.timeoutHandle !== Fn
        ), r === 0 ? null : (fu(t, r, e), Ts(t, me()), t.callbackNode != null && t.callbackNode === n ? Cs.bind(null, t) : null);
      }
      function Ms(t, e) {
        if (el()) return null;
        fu(t, e, !0);
      }
      function km() {
        yp ? xp(function() {
          (xt & 6) !== 0 ? or(
            cd,
            zs
          ) : Ns();
        }) : or(
          cd,
          zs
        );
      }
      function ei() {
        if ($n === 0) {
          var t = Na;
          t === 0 && (t = lr, lr <<= 1, (lr & 261888) === 0 && (lr = 256)), $n = t;
        }
        return $n;
      }
      function Em(t, e) {
        if (sl === null) {
          var n = sl = [];
          wo = 0, Na = ei(), Ta = {
            status: "pending",
            value: void 0,
            then: function(r) {
              n.push(r);
            }
          };
        }
        return wo++, e.then(As, As), e;
      }
      function As() {
        if (--wo === 0 && sl !== null) {
          Ta !== null && (Ta.status = "fulfilled");
          var t = sl;
          sl = null, Na = 0, Ta = null;
          for (var e = 0; e < t.length; e++) (0, t[e])();
        }
      }
      function zm(t, e) {
        var n = [], r = {
          status: "pending",
          value: null,
          reason: null,
          then: function(c) {
            n.push(c);
          }
        };
        return t.then(
          function() {
            r.status = "fulfilled", r.value = e;
            for (var c = 0; c < n.length; c++) (0, n[c])(e);
          },
          function(c) {
            for (r.status = "rejected", r.reason = c, c = 0; c < n.length; c++)
              (0, n[c])(void 0);
          }
        ), r;
      }
      function ni() {
        var t = ta.current;
        return t !== null ? t : At.pooledCache;
      }
      function Cl(t, e) {
        e === null ? _(ta, ta.current) : _(ta, e.pool);
      }
      function js() {
        var t = ni();
        return t === null ? null : {
          parent: an ? Rt._currentValue : Rt._currentValue2,
          pool: t
        };
      }
      function Ml(t, e) {
        if (_e(t, e)) return !0;
        if (typeof t != "object" || t === null || typeof e != "object" || e === null)
          return !1;
        var n = Object.keys(t), r = Object.keys(e);
        if (n.length !== r.length) return !1;
        for (r = 0; r < n.length; r++) {
          var c = n[r];
          if (!Dh.call(e, c) || !_e(t[c], e[c]))
            return !1;
        }
        return !0;
      }
      function Os(t) {
        return t = t.status, t === "fulfilled" || t === "rejected";
      }
      function Rs(t, e, n) {
        switch (n = t[n], n === void 0 ? t.push(e) : n !== e && (e.then(Tl, Tl), e = n), e.status) {
          case "fulfilled":
            return e.value;
          case "rejected":
            throw t = e.reason, Hs(t), t;
          default:
            if (typeof e.status == "string") e.then(Tl, Tl);
            else {
              if (t = At, t !== null && 100 < t.shellSuspendCounter)
                throw Error(i(482));
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
                throw t = e.reason, Hs(t), t;
            }
            throw ea = e, Ca;
        }
      }
      function Vn(t) {
        try {
          var e = t._init;
          return e(t._payload);
        } catch (n) {
          throw n !== null && typeof n == "object" && typeof n.then == "function" ? (ea = n, Ca) : n;
        }
      }
      function Ds() {
        if (ea === null) throw Error(i(459));
        var t = ea;
        return ea = null, t;
      }
      function Hs(t) {
        if (t === Ca || t === mr)
          throw Error(i(483));
      }
      function Al(t) {
        var e = cl;
        return cl += 1, Ma === null && (Ma = []), Rs(Ma, t, e);
      }
      function Qa(t, e) {
        e = e.props.ref, t.ref = e !== void 0 ? e : null;
      }
      function jl(t, e) {
        throw e.$$typeof === Im ? Error(i(525)) : (t = Object.prototype.toString.call(e), Error(
          i(
            31,
            t === "[object Object]" ? "object with keys {" + Object.keys(e).join(", ") + "}" : t
          )
        ));
      }
      function Bs(t) {
        function e(B, j) {
          if (t) {
            var U = B.deletions;
            U === null ? (B.deletions = [j], B.flags |= 16) : U.push(j);
          }
        }
        function n(B, j) {
          if (!t) return null;
          for (; j !== null; )
            e(B, j), j = j.sibling;
          return null;
        }
        function r(B) {
          for (var j = /* @__PURE__ */ new Map(); B !== null; )
            B.key !== null ? j.set(B.key, B) : j.set(B.index, B), B = B.sibling;
          return j;
        }
        function c(B, j) {
          return B = nn(B, j), B.index = 0, B.sibling = null, B;
        }
        function u(B, j, U) {
          return B.index = U, t ? (U = B.alternate, U !== null ? (U = U.index, U < j ? (B.flags |= 67108866, j) : U) : (B.flags |= 67108866, j)) : (B.flags |= 1048576, j);
        }
        function g(B) {
          return t && B.alternate === null && (B.flags |= 67108866), B;
        }
        function C(B, j, U, F) {
          return j === null || j.tag !== 6 ? (j = Ii(U, B.mode, F), j.return = B, j) : (j = c(j, U), j.return = B, j);
        }
        function Y(B, j, U, F) {
          var ut = U.type;
          return ut === ya ? P(
            B,
            j,
            U.props.children,
            F,
            U.key
          ) : j !== null && (j.elementType === ut || typeof ut == "object" && ut !== null && ut.$$typeof === Sn && Vn(ut) === j.type) ? (j = c(j, U.props), Qa(j, U), j.return = B, j) : (j = tr(
            U.type,
            U.key,
            U.props,
            null,
            B.mode,
            F
          ), Qa(j, U), j.return = B, j);
        }
        function Z(B, j, U, F) {
          return j === null || j.tag !== 4 || j.stateNode.containerInfo !== U.containerInfo || j.stateNode.implementation !== U.implementation ? (j = Pi(U, B.mode, F), j.return = B, j) : (j = c(j, U.children || []), j.return = B, j);
        }
        function P(B, j, U, F, ut) {
          return j === null || j.tag !== 7 ? (j = Wn(
            U,
            B.mode,
            F,
            ut
          ), j.return = B, j) : (j = c(j, U), j.return = B, j);
        }
        function W(B, j, U) {
          if (typeof j == "string" && j !== "" || typeof j == "number" || typeof j == "bigint")
            return j = Ii(
              "" + j,
              B.mode,
              U
            ), j.return = B, j;
          if (typeof j == "object" && j !== null) {
            switch (j.$$typeof) {
              case er:
                return U = tr(
                  j.type,
                  j.key,
                  j.props,
                  null,
                  B.mode,
                  U
                ), Qa(U, j), U.return = B, U;
              case va:
                return j = Pi(
                  j,
                  B.mode,
                  U
                ), j.return = B, j;
              case Sn:
                return j = Vn(j), W(B, j, U);
            }
            if (nr(j) || E(j))
              return j = Wn(
                j,
                B.mode,
                U,
                null
              ), j.return = B, j;
            if (typeof j.then == "function")
              return W(B, Al(j), U);
            if (j.$$typeof === _n)
              return W(
                B,
                Nl(B, j),
                U
              );
            jl(B, j);
          }
          return null;
        }
        function nt(B, j, U, F) {
          var ut = j !== null ? j.key : null;
          if (typeof U == "string" && U !== "" || typeof U == "number" || typeof U == "bigint")
            return ut !== null ? null : C(B, j, "" + U, F);
          if (typeof U == "object" && U !== null) {
            switch (U.$$typeof) {
              case er:
                return U.key === ut ? Y(B, j, U, F) : null;
              case va:
                return U.key === ut ? Z(B, j, U, F) : null;
              case Sn:
                return U = Vn(U), nt(B, j, U, F);
            }
            if (nr(U) || E(U))
              return ut !== null ? null : P(B, j, U, F, null);
            if (typeof U.then == "function")
              return nt(
                B,
                j,
                Al(U),
                F
              );
            if (U.$$typeof === _n)
              return nt(
                B,
                j,
                Nl(B, U),
                F
              );
            jl(B, U);
          }
          return null;
        }
        function gt(B, j, U, F, ut) {
          if (typeof F == "string" && F !== "" || typeof F == "number" || typeof F == "bigint")
            return B = B.get(U) || null, C(j, B, "" + F, ut);
          if (typeof F == "object" && F !== null) {
            switch (F.$$typeof) {
              case er:
                return B = B.get(
                  F.key === null ? U : F.key
                ) || null, Y(j, B, F, ut);
              case va:
                return B = B.get(
                  F.key === null ? U : F.key
                ) || null, Z(j, B, F, ut);
              case Sn:
                return F = Vn(F), gt(
                  B,
                  j,
                  U,
                  F,
                  ut
                );
            }
            if (nr(F) || E(F))
              return B = B.get(U) || null, P(j, B, F, ut, null);
            if (typeof F.then == "function")
              return gt(
                B,
                j,
                U,
                Al(F),
                ut
              );
            if (F.$$typeof === _n)
              return gt(
                B,
                j,
                U,
                Nl(j, F),
                ut
              );
            jl(j, F);
          }
          return null;
        }
        function ne(B, j, U, F) {
          for (var ut = null, Dt = null, mt = j, zt = j = 0, Ft = null; mt !== null && zt < U.length; zt++) {
            mt.index > zt ? (Ft = mt, mt = null) : Ft = mt.sibling;
            var Nt = nt(
              B,
              mt,
              U[zt],
              F
            );
            if (Nt === null) {
              mt === null && (mt = Ft);
              break;
            }
            t && mt && Nt.alternate === null && e(B, mt), j = u(Nt, j, zt), Dt === null ? ut = Nt : Dt.sibling = Nt, Dt = Nt, mt = Ft;
          }
          if (zt === U.length)
            return n(B, mt), St && K(B, zt), ut;
          if (mt === null) {
            for (; zt < U.length; zt++)
              mt = W(B, U[zt], F), mt !== null && (j = u(
                mt,
                j,
                zt
              ), Dt === null ? ut = mt : Dt.sibling = mt, Dt = mt);
            return St && K(B, zt), ut;
          }
          for (mt = r(mt); zt < U.length; zt++)
            Ft = gt(
              mt,
              B,
              zt,
              U[zt],
              F
            ), Ft !== null && (t && Ft.alternate !== null && mt.delete(
              Ft.key === null ? zt : Ft.key
            ), j = u(
              Ft,
              j,
              zt
            ), Dt === null ? ut = Ft : Dt.sibling = Ft, Dt = Ft);
          return t && mt.forEach(function(jn) {
            return e(B, jn);
          }), St && K(B, zt), ut;
        }
        function gl(B, j, U, F) {
          if (U == null) throw Error(i(151));
          for (var ut = null, Dt = null, mt = j, zt = j = 0, Ft = null, Nt = U.next(); mt !== null && !Nt.done; zt++, Nt = U.next()) {
            mt.index > zt ? (Ft = mt, mt = null) : Ft = mt.sibling;
            var jn = nt(B, mt, Nt.value, F);
            if (jn === null) {
              mt === null && (mt = Ft);
              break;
            }
            t && mt && jn.alternate === null && e(B, mt), j = u(jn, j, zt), Dt === null ? ut = jn : Dt.sibling = jn, Dt = jn, mt = Ft;
          }
          if (Nt.done)
            return n(B, mt), St && K(B, zt), ut;
          if (mt === null) {
            for (; !Nt.done; zt++, Nt = U.next())
              Nt = W(B, Nt.value, F), Nt !== null && (j = u(
                Nt,
                j,
                zt
              ), Dt === null ? ut = Nt : Dt.sibling = Nt, Dt = Nt);
            return St && K(B, zt), ut;
          }
          for (mt = r(mt); !Nt.done; zt++, Nt = U.next())
            Nt = gt(
              mt,
              B,
              zt,
              Nt.value,
              F
            ), Nt !== null && (t && Nt.alternate !== null && mt.delete(Nt.key === null ? zt : Nt.key), j = u(Nt, j, zt), Dt === null ? ut = Nt : Dt.sibling = Nt, Dt = Nt);
          return t && mt.forEach(function(Kh) {
            return e(B, Kh);
          }), St && K(B, zt), ut;
        }
        function ra(B, j, U, F) {
          if (typeof U == "object" && U !== null && U.type === ya && U.key === null && (U = U.props.children), typeof U == "object" && U !== null) {
            switch (U.$$typeof) {
              case er:
                t: {
                  for (var ut = U.key; j !== null; ) {
                    if (j.key === ut) {
                      if (ut = U.type, ut === ya) {
                        if (j.tag === 7) {
                          n(
                            B,
                            j.sibling
                          ), F = c(
                            j,
                            U.props.children
                          ), F.return = B, B = F;
                          break t;
                        }
                      } else if (j.elementType === ut || typeof ut == "object" && ut !== null && ut.$$typeof === Sn && Vn(ut) === j.type) {
                        n(
                          B,
                          j.sibling
                        ), F = c(j, U.props), Qa(F, U), F.return = B, B = F;
                        break t;
                      }
                      n(B, j);
                      break;
                    } else e(B, j);
                    j = j.sibling;
                  }
                  U.type === ya ? (F = Wn(
                    U.props.children,
                    B.mode,
                    F,
                    U.key
                  ), F.return = B, B = F) : (F = tr(
                    U.type,
                    U.key,
                    U.props,
                    null,
                    B.mode,
                    F
                  ), Qa(F, U), F.return = B, B = F);
                }
                return g(B);
              case va:
                t: {
                  for (ut = U.key; j !== null; ) {
                    if (j.key === ut)
                      if (j.tag === 4 && j.stateNode.containerInfo === U.containerInfo && j.stateNode.implementation === U.implementation) {
                        n(
                          B,
                          j.sibling
                        ), F = c(
                          j,
                          U.children || []
                        ), F.return = B, B = F;
                        break t;
                      } else {
                        n(B, j);
                        break;
                      }
                    else e(B, j);
                    j = j.sibling;
                  }
                  F = Pi(U, B.mode, F), F.return = B, B = F;
                }
                return g(B);
              case Sn:
                return U = Vn(U), ra(
                  B,
                  j,
                  U,
                  F
                );
            }
            if (nr(U))
              return ne(
                B,
                j,
                U,
                F
              );
            if (E(U)) {
              if (ut = E(U), typeof ut != "function")
                throw Error(i(150));
              return U = ut.call(U), gl(
                B,
                j,
                U,
                F
              );
            }
            if (typeof U.then == "function")
              return ra(
                B,
                j,
                Al(U),
                F
              );
            if (U.$$typeof === _n)
              return ra(
                B,
                j,
                Nl(B, U),
                F
              );
            jl(B, U);
          }
          return typeof U == "string" && U !== "" || typeof U == "number" || typeof U == "bigint" ? (U = "" + U, j !== null && j.tag === 6 ? (n(B, j.sibling), F = c(j, U), F.return = B, B = F) : (n(B, j), F = Ii(U, B.mode, F), F.return = B, B = F), g(B)) : n(B, j);
        }
        return function(B, j, U, F) {
          try {
            cl = 0;
            var ut = ra(
              B,
              j,
              U,
              F
            );
            return Ma = null, ut;
          } catch (mt) {
            if (mt === Ca || mt === mr) throw mt;
            var Dt = s(29, mt, null, B.mode);
            return Dt.lanes = F, Dt.return = B, Dt;
          } finally {
          }
        };
      }
      function Ol() {
        for (var t = Aa, e = So = Aa = 0; e < t; ) {
          var n = Ae[e];
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
          u !== 0 && Us(n, c, u);
        }
      }
      function Rl(t, e, n, r) {
        Ae[Aa++] = t, Ae[Aa++] = e, Ae[Aa++] = n, Ae[Aa++] = r, So |= r, t.lanes |= r, t = t.alternate, t !== null && (t.lanes |= r);
      }
      function ai(t, e, n, r) {
        return Rl(t, e, n, r), Dl(t);
      }
      function Xn(t, e) {
        return Rl(t, null, null, e), Dl(t);
      }
      function Us(t, e, n) {
        t.lanes |= n;
        var r = t.alternate;
        r !== null && (r.lanes |= n);
        for (var c = !1, u = t.return; u !== null; )
          u.childLanes |= n, r = u.alternate, r !== null && (r.childLanes |= n), u.tag === 22 && (t = u.stateNode, t === null || t._visibility & 1 || (c = !0)), t = u, u = u.return;
        return t.tag === 3 ? (u = t.stateNode, c && e !== null && (c = 31 - xe(n), t = u.hiddenUpdates, r = t[c], r === null ? t[c] = [e] : r.push(e), e.lane = n | 536870912), u) : null;
      }
      function Dl(t) {
        if (50 < hl)
          throw hl = 0, Do = null, Error(i(185));
        for (var e = t.return; e !== null; )
          t = e, e = t.return;
        return t.tag === 3 ? t.stateNode : null;
      }
      function li(t) {
        t.updateQueue = {
          baseState: t.memoizedState,
          firstBaseUpdate: null,
          lastBaseUpdate: null,
          shared: { pending: null, lanes: 0, hiddenCallbacks: null },
          callbacks: null
        };
      }
      function ri(t, e) {
        t = t.updateQueue, e.updateQueue === t && (e.updateQueue = {
          baseState: t.baseState,
          firstBaseUpdate: t.firstBaseUpdate,
          lastBaseUpdate: t.lastBaseUpdate,
          shared: t.shared,
          callbacks: null
        });
      }
      function gn(t) {
        return { lane: t, tag: 0, payload: null, callback: null, next: null };
      }
      function bn(t, e, n) {
        var r = t.updateQueue;
        if (r === null) return null;
        if (r = r.shared, (xt & 2) !== 0) {
          var c = r.pending;
          return c === null ? e.next = e : (e.next = c.next, c.next = e), r.pending = e, e = Dl(t), Us(t, null, n), e;
        }
        return Rl(t, r, e, n), Dl(t);
      }
      function Va(t, e, n) {
        if (e = e.updateQueue, e !== null && (e = e.shared, (n & 4194048) !== 0)) {
          var r = e.lanes;
          r &= t.pendingLanes, n |= r, e.lanes = n, v(t, n);
        }
      }
      function ii(t, e) {
        var n = t.updateQueue, r = t.alternate;
        if (r !== null && (r = r.updateQueue, n === r)) {
          var c = null, u = null;
          if (n = n.firstBaseUpdate, n !== null) {
            do {
              var g = {
                lane: n.lane,
                tag: n.tag,
                payload: n.payload,
                callback: null,
                next: null
              };
              u === null ? c = u = g : u = u.next = g, n = n.next;
            } while (n !== null);
            u === null ? c = u = e : u = u.next = e;
          } else c = u = e;
          n = {
            baseState: r.baseState,
            firstBaseUpdate: c,
            lastBaseUpdate: u,
            shared: r.shared,
            callbacks: r.callbacks
          }, t.updateQueue = n;
          return;
        }
        t = n.lastBaseUpdate, t === null ? n.firstBaseUpdate = e : t.next = e, n.lastBaseUpdate = e;
      }
      function Xa() {
        if (ko) {
          var t = Ta;
          if (t !== null) throw t;
        }
      }
      function La(t, e, n, r) {
        ko = !1;
        var c = t.updateQueue;
        Nn = !1;
        var u = c.firstBaseUpdate, g = c.lastBaseUpdate, C = c.shared.pending;
        if (C !== null) {
          c.shared.pending = null;
          var Y = C, Z = Y.next;
          Y.next = null, g === null ? u = Z : g.next = Z, g = Y;
          var P = t.alternate;
          P !== null && (P = P.updateQueue, C = P.lastBaseUpdate, C !== g && (C === null ? P.firstBaseUpdate = Z : C.next = Z, P.lastBaseUpdate = Y));
        }
        if (u !== null) {
          var W = c.baseState;
          g = 0, P = Z = Y = null, C = u;
          do {
            var nt = C.lane & -536870913, gt = nt !== C.lane;
            if (gt ? (_t & nt) === nt : (r & nt) === nt) {
              nt !== 0 && nt === Na && (ko = !0), P !== null && (P = P.next = {
                lane: 0,
                tag: C.tag,
                payload: C.payload,
                callback: null,
                next: null
              });
              t: {
                var ne = t, gl = C;
                nt = e;
                var ra = n;
                switch (gl.tag) {
                  case 1:
                    if (ne = gl.payload, typeof ne == "function") {
                      W = ne.call(
                        ra,
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
                    if (ne = gl.payload, nt = typeof ne == "function" ? ne.call(ra, W, nt) : ne, nt == null) break t;
                    W = to({}, W, nt);
                    break t;
                  case 2:
                    Nn = !0;
                }
              }
              nt = C.callback, nt !== null && (t.flags |= 64, gt && (t.flags |= 8192), gt = c.callbacks, gt === null ? c.callbacks = [nt] : gt.push(nt));
            } else
              gt = {
                lane: nt,
                tag: C.tag,
                payload: C.payload,
                callback: C.callback,
                next: null
              }, P === null ? (Z = P = gt, Y = W) : P = P.next = gt, g |= nt;
            if (C = C.next, C === null) {
              if (C = c.shared.pending, C === null)
                break;
              gt = C, C = gt.next, gt.next = null, c.lastBaseUpdate = gt, c.shared.pending = null;
            }
          } while (!0);
          P === null && (Y = W), c.baseState = Y, c.firstBaseUpdate = Z, c.lastBaseUpdate = P, u === null && (c.shared.lanes = 0), Cn |= g, t.lanes = g, t.memoizedState = W;
        }
      }
      function qs(t, e) {
        if (typeof t != "function")
          throw Error(i(191, t));
        t.call(e);
      }
      function Ys(t, e) {
        var n = t.callbacks;
        if (n !== null)
          for (t.callbacks = null, t = 0; t < n.length; t++)
            qs(n[t], e);
      }
      function Gs(t, e) {
        t = cn, _(hr, t), _(ja, e), cn = t | e.baseLanes;
      }
      function oi() {
        _(hr, cn), _(ja, ja.current);
      }
      function si() {
        cn = hr.current, N(ja), N(hr);
      }
      function vn(t) {
        var e = t.alternate;
        _(qt, qt.current & 1), _(Se, t), je === null && (e === null || ja.current !== null || e.memoizedState !== null) && (je = t);
      }
      function ci(t) {
        _(qt, qt.current), _(Se, t), je === null && (je = t);
      }
      function Ks(t) {
        t.tag === 22 ? (_(qt, qt.current), _(Se, t), je === null && (je = t)) : yn();
      }
      function yn() {
        _(qt, qt.current), _(Se, Se.current);
      }
      function be(t) {
        N(Se), je === t && (je = null), N(qt);
      }
      function Hl(t) {
        for (var e = t; e !== null; ) {
          if (e.tag === 13) {
            var n = e.memoizedState;
            if (n !== null && (n = n.dehydrated, n === null || co(n) || uo(n)))
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
        throw Error(i(321));
      }
      function ui(t, e) {
        if (e === null) return !1;
        for (var n = 0; n < e.length && n < t.length; n++)
          if (!_e(t[n], e[n])) return !1;
        return !0;
      }
      function di(t, e, n, r, c, u) {
        return on = u, bt = e, e.memoizedState = null, e.updateQueue = null, e.lanes = 0, ct.H = t === null || t.memoizedState === null ? hd : Eo, aa = !1, u = n(r, c), aa = !1, Oa && (u = Vs(
          e,
          n,
          r,
          c
        )), Qs(t), u;
      }
      function Qs(t) {
        ct.H = dl;
        var e = Mt !== null && Mt.next !== null;
        if (on = 0, Yt = Mt = bt = null, gr = !1, ul = 0, Ra = null, e) throw Error(i(300));
        t === null || Gt || (t = t.dependencies, t !== null && zl(t) && (Gt = !0));
      }
      function Vs(t, e, n, r) {
        bt = t;
        var c = 0;
        do {
          if (Oa && (Ra = null), ul = 0, Oa = !1, 25 <= c) throw Error(i(301));
          if (c += 1, Yt = Mt = null, t.updateQueue != null) {
            var u = t.updateQueue;
            u.lastEffect = null, u.events = null, u.stores = null, u.memoCache != null && (u.memoCache.index = 0);
          }
          ct.H = gd, u = e(n, r);
        } while (Oa);
        return u;
      }
      function Nm() {
        var t = ct.H, e = t.useState()[0];
        return e = typeof e.then == "function" ? Za(e) : e, t = t.useState()[0], (Mt !== null ? Mt.memoizedState : null) !== t && (bt.flags |= 1024), e;
      }
      function fi() {
        var t = br !== 0;
        return br = 0, t;
      }
      function mi(t, e, n) {
        e.updateQueue = t.updateQueue, e.flags &= -2053, t.lanes &= ~n;
      }
      function pi(t) {
        if (gr) {
          for (t = t.memoizedState; t !== null; ) {
            var e = t.queue;
            e !== null && (e.pending = null), t = t.next;
          }
          gr = !1;
        }
        on = 0, Yt = Mt = bt = null, Oa = !1, ul = br = 0, Ra = null;
      }
      function ue() {
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
            throw bt.alternate === null ? Error(i(467)) : Error(i(310));
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
      function Bl() {
        return { lastEffect: null, events: null, stores: null, memoCache: null };
      }
      function Za(t) {
        var e = ul;
        return ul += 1, Ra === null && (Ra = []), t = Rs(Ra, t, e), e = bt, (Yt === null ? e.memoizedState : Yt.next) === null && (e = e.alternate, ct.H = e === null || e.memoizedState === null ? hd : Eo), t;
      }
      function Ul(t) {
        if (t !== null && typeof t == "object") {
          if (typeof t.then == "function") return Za(t);
          if (t.$$typeof === _n) return Pt(t);
        }
        throw Error(i(438, String(t)));
      }
      function hi(t) {
        var e = null, n = bt.updateQueue;
        if (n !== null && (e = n.memoCache), e == null) {
          var r = bt.alternate;
          r !== null && (r = r.updateQueue, r !== null && (r = r.memoCache, r != null && (e = {
            data: r.data.map(function(c) {
              return c.slice();
            }),
            index: 0
          })));
        }
        if (e == null && (e = { data: [], index: 0 }), n === null && (n = Bl(), bt.updateQueue = n), n.memoCache = e, n = e.data[e.index], n === void 0)
          for (n = e.data[e.index] = Array(t), r = 0; r < t; r++)
            n[r] = Pm;
        return e.index++, n;
      }
      function Pe(t, e) {
        return typeof e == "function" ? e(t) : e;
      }
      function ql(t) {
        var e = Ut();
        return gi(e, Mt, t);
      }
      function gi(t, e, n) {
        var r = t.queue;
        if (r === null) throw Error(i(311));
        r.lastRenderedReducer = n;
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
          var C = g = null, Y = null, Z = e, P = !1;
          do {
            var W = Z.lane & -536870913;
            if (W !== Z.lane ? (_t & W) === W : (on & W) === W) {
              var nt = Z.revertLane;
              if (nt === 0)
                Y !== null && (Y = Y.next = {
                  lane: 0,
                  revertLane: 0,
                  gesture: null,
                  action: Z.action,
                  hasEagerState: Z.hasEagerState,
                  eagerState: Z.eagerState,
                  next: null
                }), W === Na && (P = !0);
              else if ((on & nt) === nt) {
                Z = Z.next, nt === Na && (P = !0);
                continue;
              } else
                W = {
                  lane: 0,
                  revertLane: Z.revertLane,
                  gesture: null,
                  action: Z.action,
                  hasEagerState: Z.hasEagerState,
                  eagerState: Z.eagerState,
                  next: null
                }, Y === null ? (C = Y = W, g = u) : Y = Y.next = W, bt.lanes |= nt, Cn |= nt;
              W = Z.action, aa && n(u, W), u = Z.hasEagerState ? Z.eagerState : n(u, W);
            } else
              nt = {
                lane: W,
                revertLane: Z.revertLane,
                gesture: Z.gesture,
                action: Z.action,
                hasEagerState: Z.hasEagerState,
                eagerState: Z.eagerState,
                next: null
              }, Y === null ? (C = Y = nt, g = u) : Y = Y.next = nt, bt.lanes |= W, Cn |= W;
            Z = Z.next;
          } while (Z !== null && Z !== e);
          if (Y === null ? g = u : Y.next = C, !_e(u, t.memoizedState) && (Gt = !0, P && (n = Ta, n !== null)))
            throw n;
          t.memoizedState = u, t.baseState = g, t.baseQueue = Y, r.lastRenderedState = u;
        }
        return c === null && (r.lanes = 0), [t.memoizedState, r.dispatch];
      }
      function bi(t) {
        var e = Ut(), n = e.queue;
        if (n === null) throw Error(i(311));
        n.lastRenderedReducer = t;
        var r = n.dispatch, c = n.pending, u = e.memoizedState;
        if (c !== null) {
          n.pending = null;
          var g = c = c.next;
          do
            u = t(u, g.action), g = g.next;
          while (g !== c);
          _e(u, e.memoizedState) || (Gt = !0), e.memoizedState = u, e.baseQueue === null && (e.baseState = u), n.lastRenderedState = u;
        }
        return [u, r];
      }
      function Xs(t, e, n) {
        var r = bt, c = Ut(), u = St;
        if (u) {
          if (n === void 0)
            throw Error(i(407));
          n = n();
        } else n = e();
        var g = !_e(
          (Mt || c).memoizedState,
          n
        );
        if (g && (c.memoizedState = n, Gt = !0), c = c.queue, xi(Js.bind(null, r, c, t), [
          t
        ]), c.getSnapshot !== e || g || Yt !== null && Yt.memoizedState.tag & 1) {
          if (r.flags |= 2048, pa(
            9,
            { destroy: void 0 },
            Zs.bind(
              null,
              r,
              c,
              n,
              e
            ),
            null
          ), At === null) throw Error(i(349));
          u || (on & 127) !== 0 || Ls(r, e, n);
        }
        return n;
      }
      function Ls(t, e, n) {
        t.flags |= 16384, t = { getSnapshot: e, value: n }, e = bt.updateQueue, e === null ? (e = Bl(), bt.updateQueue = e, e.stores = [t]) : (n = e.stores, n === null ? e.stores = [t] : n.push(t));
      }
      function Zs(t, e, n, r) {
        e.value = n, e.getSnapshot = r, Ws(e) && Fs(t);
      }
      function Js(t, e, n) {
        return n(function() {
          Ws(e) && Fs(t);
        });
      }
      function Ws(t) {
        var e = t.getSnapshot;
        t = t.value;
        try {
          var n = e();
          return !_e(t, n);
        } catch {
          return !0;
        }
      }
      function Fs(t) {
        var e = Xn(t, 2);
        e !== null && fe(e, t, 2);
      }
      function vi(t) {
        var e = ue();
        if (typeof t == "function") {
          var n = t;
          if (t = n(), aa) {
            J(!0);
            try {
              n();
            } finally {
              J(!1);
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
      function Is(t, e, n, r) {
        return t.baseState = n, gi(
          t,
          Mt,
          typeof r == "function" ? r : Pe
        );
      }
      function Tm(t, e, n, r, c) {
        if (Kl(t)) throw Error(i(485));
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
          ct.T !== null ? n(!0) : u.isTransition = !1, r(u), n = e.pending, n === null ? (u.next = e.pending = u, Ps(e, u)) : (u.next = n.next, e.pending = n.next = u);
        }
      }
      function Ps(t, e) {
        var n = e.action, r = e.payload, c = t.state;
        if (e.isTransition) {
          var u = ct.T, g = {};
          ct.T = g;
          try {
            var C = n(c, r), Y = ct.S;
            Y !== null && Y(g, C), $s(t, e, C);
          } catch (Z) {
            yi(t, e, Z);
          } finally {
            u !== null && g.types !== null && (u.types = g.types), ct.T = u;
          }
        } else
          try {
            u = n(c, r), $s(t, e, u);
          } catch (Z) {
            yi(t, e, Z);
          }
      }
      function $s(t, e, n) {
        n !== null && typeof n == "object" && typeof n.then == "function" ? n.then(
          function(r) {
            tc(t, e, r);
          },
          function(r) {
            return yi(t, e, r);
          }
        ) : tc(t, e, n);
      }
      function tc(t, e, n) {
        e.status = "fulfilled", e.value = n, ec(e), t.state = n, e = t.pending, e !== null && (n = e.next, n === e ? t.pending = null : (n = n.next, e.next = n, Ps(t, n)));
      }
      function yi(t, e, n) {
        var r = t.pending;
        if (t.pending = null, r !== null) {
          r = r.next;
          do
            e.status = "rejected", e.reason = n, ec(e), e = e.next;
          while (e !== r);
        }
        t.action = null;
      }
      function ec(t) {
        t = t.listeners;
        for (var e = 0; e < t.length; e++) (0, t[e])();
      }
      function nc(t, e) {
        return e;
      }
      function ac(t, e) {
        if (St) {
          var n = At.formState;
          if (n !== null) {
            t: {
              var r = bt;
              if (St) {
                if (Ot) {
                  var c = Xp(
                    Ot,
                    Me
                  );
                  if (c) {
                    Ot = Iu(c), r = Lp(c);
                    break t;
                  }
                }
                ht(r);
              }
              r = !1;
            }
            r && (e = n[0]);
          }
        }
        n = ue(), n.memoizedState = n.baseState = e, r = {
          pending: null,
          lanes: 0,
          dispatch: null,
          lastRenderedReducer: nc,
          lastRenderedState: e
        }, n.queue = r, n = wc.bind(
          null,
          bt,
          r
        ), r.dispatch = n, r = vi(!1);
        var u = ki.bind(
          null,
          bt,
          !1,
          r.queue
        );
        return r = ue(), c = {
          state: e,
          dispatch: null,
          action: t,
          pending: null
        }, r.queue = c, n = Tm.bind(
          null,
          bt,
          c,
          u,
          n
        ), c.dispatch = n, r.memoizedState = t, [e, n, !1];
      }
      function lc(t) {
        var e = Ut();
        return rc(e, Mt, t);
      }
      function rc(t, e, n) {
        if (e = gi(
          t,
          e,
          nc
        )[0], t = ql(Pe)[0], typeof e == "object" && e !== null && typeof e.then == "function")
          try {
            var r = Za(e);
          } catch (g) {
            throw g === Ca ? mr : g;
          }
        else r = e;
        e = Ut();
        var c = e.queue, u = c.dispatch;
        return n !== e.memoizedState && (bt.flags |= 2048, pa(
          9,
          { destroy: void 0 },
          Cm.bind(null, c, n),
          null
        )), [r, u, t];
      }
      function Cm(t, e) {
        t.action = e;
      }
      function ic(t) {
        var e = Ut(), n = Mt;
        if (n !== null)
          return rc(e, n, t);
        Ut(), e = e.memoizedState, n = Ut();
        var r = n.queue.dispatch;
        return n.memoizedState = t, [e, r, !1];
      }
      function pa(t, e, n, r) {
        return t = { tag: t, create: n, deps: r, inst: e, next: null }, e = bt.updateQueue, e === null && (e = Bl(), bt.updateQueue = e), n = e.lastEffect, n === null ? e.lastEffect = t.next = t : (r = n.next, n.next = t, t.next = r, e.lastEffect = t), t;
      }
      function oc() {
        return Ut().memoizedState;
      }
      function Yl(t, e, n, r) {
        var c = ue();
        bt.flags |= t, c.memoizedState = pa(
          1 | e,
          { destroy: void 0 },
          n,
          r === void 0 ? null : r
        );
      }
      function Gl(t, e, n, r) {
        var c = Ut();
        r = r === void 0 ? null : r;
        var u = c.memoizedState.inst;
        Mt !== null && r !== null && ui(r, Mt.memoizedState.deps) ? c.memoizedState = pa(e, u, n, r) : (bt.flags |= t, c.memoizedState = pa(
          1 | e,
          u,
          n,
          r
        ));
      }
      function sc(t, e) {
        Yl(8390656, 8, t, e);
      }
      function xi(t, e) {
        Gl(2048, 8, t, e);
      }
      function Mm(t) {
        bt.flags |= 4;
        var e = bt.updateQueue;
        if (e === null)
          e = Bl(), bt.updateQueue = e, e.events = [t];
        else {
          var n = e.events;
          n === null ? e.events = [t] : n.push(t);
        }
      }
      function cc(t) {
        var e = Ut().memoizedState;
        return Mm({ ref: e, nextImpl: t }), function() {
          if ((xt & 2) !== 0)
            throw Error(i(440));
          return e.impl.apply(void 0, arguments);
        };
      }
      function uc(t, e) {
        return Gl(4, 2, t, e);
      }
      function dc(t, e) {
        return Gl(4, 4, t, e);
      }
      function fc(t, e) {
        if (typeof e == "function") {
          t = t();
          var n = e(t);
          return function() {
            typeof n == "function" ? n() : e(null);
          };
        }
        if (e != null)
          return t = t(), e.current = t, function() {
            e.current = null;
          };
      }
      function mc(t, e, n) {
        n = n != null ? n.concat([t]) : null, Gl(
          4,
          4,
          fc.bind(null, e, t),
          n
        );
      }
      function wi() {
      }
      function pc(t, e) {
        var n = Ut();
        e = e === void 0 ? null : e;
        var r = n.memoizedState;
        return e !== null && ui(e, r[1]) ? r[0] : (n.memoizedState = [t, e], t);
      }
      function hc(t, e) {
        var n = Ut();
        e = e === void 0 ? null : e;
        var r = n.memoizedState;
        if (e !== null && ui(e, r[1]))
          return r[0];
        if (r = t(), aa) {
          J(!0);
          try {
            t();
          } finally {
            J(!1);
          }
        }
        return n.memoizedState = [r, e], r;
      }
      function _i(t, e, n) {
        return n === void 0 || (on & 1073741824) !== 0 && (_t & 261930) === 0 ? t.memoizedState = e : (t.memoizedState = n, t = du(), bt.lanes |= t, Cn |= t, n);
      }
      function gc(t, e, n, r) {
        return _e(n, e) ? n : ja.current !== null ? (t = _i(t, n, r), _e(t, e) || (Gt = !0), t) : (on & 42) === 0 || (on & 1073741824) !== 0 && (_t & 261930) === 0 ? (Gt = !0, t.memoizedState = n) : (t = du(), bt.lanes |= t, Cn |= t, e);
      }
      function bc(t, e, n, r, c) {
        var u = ln();
        Jt(
          u !== 0 && 8 > u ? u : 8
        );
        var g = ct.T, C = {};
        ct.T = C, ki(t, !1, e, n);
        try {
          var Y = c(), Z = ct.S;
          if (Z !== null && Z(C, Y), Y !== null && typeof Y == "object" && typeof Y.then == "function") {
            var P = zm(
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
          Jt(u), g !== null && C.types !== null && (g.types = C.types), ct.T = g;
        }
      }
      function vc(t) {
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
        var n = {};
        return e.next = {
          memoizedState: n,
          baseState: n,
          baseQueue: null,
          queue: {
            pending: null,
            lanes: 0,
            dispatch: null,
            lastRenderedReducer: Pe,
            lastRenderedState: n
          },
          next: null
        }, t.memoizedState = e, t = t.alternate, t !== null && (t.memoizedState = e), e;
      }
      function Si() {
        return Pt(In);
      }
      function yc() {
        return Ut().memoizedState;
      }
      function xc() {
        return Ut().memoizedState;
      }
      function Am(t) {
        for (var e = t.return; e !== null; ) {
          switch (e.tag) {
            case 24:
            case 3:
              var n = ve();
              t = gn(n);
              var r = bn(e, t, n);
              r !== null && (fe(r, e, n), Va(r, e, n)), e = { cache: ti() }, t.payload = e;
              return;
          }
          e = e.return;
        }
      }
      function jm(t, e, n) {
        var r = ve();
        n = {
          lane: r,
          revertLane: 0,
          gesture: null,
          action: n,
          hasEagerState: !1,
          eagerState: null,
          next: null
        }, Kl(t) ? _c(e, n) : (n = ai(t, e, n, r), n !== null && (fe(n, t, r), Sc(n, e, r)));
      }
      function wc(t, e, n) {
        var r = ve();
        Ja(t, e, n, r);
      }
      function Ja(t, e, n, r) {
        var c = {
          lane: r,
          revertLane: 0,
          gesture: null,
          action: n,
          hasEagerState: !1,
          eagerState: null,
          next: null
        };
        if (Kl(t)) _c(e, c);
        else {
          var u = t.alternate;
          if (t.lanes === 0 && (u === null || u.lanes === 0) && (u = e.lastRenderedReducer, u !== null))
            try {
              var g = e.lastRenderedState, C = u(g, n);
              if (c.hasEagerState = !0, c.eagerState = C, _e(C, g))
                return Rl(t, e, c, 0), At === null && Ol(), !1;
            } catch {
            } finally {
            }
          if (n = ai(t, e, c, r), n !== null)
            return fe(n, t, r), Sc(n, e, r), !0;
        }
        return !1;
      }
      function ki(t, e, n, r) {
        if (r = {
          lane: 2,
          revertLane: ei(),
          gesture: null,
          action: r,
          hasEagerState: !1,
          eagerState: null,
          next: null
        }, Kl(t)) {
          if (e) throw Error(i(479));
        } else
          e = ai(
            t,
            n,
            r,
            2
          ), e !== null && fe(e, t, 2);
      }
      function Kl(t) {
        var e = t.alternate;
        return t === bt || e !== null && e === bt;
      }
      function _c(t, e) {
        Oa = gr = !0;
        var n = t.pending;
        n === null ? e.next = e : (e.next = n.next, n.next = e), t.pending = e;
      }
      function Sc(t, e, n) {
        if ((n & 4194048) !== 0) {
          var r = e.lanes;
          r &= t.pendingLanes, n |= r, e.lanes = n, v(t, n);
        }
      }
      function Ei(t, e, n, r) {
        e = t.memoizedState, n = n(r, e), n = n == null ? e : to({}, e, n), t.memoizedState = n, t.lanes === 0 && (t.updateQueue.baseState = n);
      }
      function kc(t, e, n, r, c, u, g) {
        return t = t.stateNode, typeof t.shouldComponentUpdate == "function" ? t.shouldComponentUpdate(r, u, g) : e.prototype && e.prototype.isPureReactComponent ? !Ml(n, r) || !Ml(c, u) : !0;
      }
      function Ec(t, e, n, r) {
        t = e.state, typeof e.componentWillReceiveProps == "function" && e.componentWillReceiveProps(n, r), typeof e.UNSAFE_componentWillReceiveProps == "function" && e.UNSAFE_componentWillReceiveProps(n, r), e.state !== t && zo.enqueueReplaceState(e, e.state, null);
      }
      function Ln(t, e) {
        var n = e;
        if ("ref" in e) {
          n = {};
          for (var r in e)
            r !== "ref" && (n[r] = e[r]);
        }
        if (t = t.defaultProps) {
          n === e && (n = to({}, n));
          for (var c in t)
            n[c] === void 0 && (n[c] = t[c]);
        }
        return n;
      }
      function Ql(t, e) {
        try {
          var n = t.onUncaughtError;
          n(e.value, { componentStack: e.stack });
        } catch (r) {
          setTimeout(function() {
            throw r;
          });
        }
      }
      function zc(t, e, n) {
        try {
          var r = t.onCaughtError;
          r(n.value, {
            componentStack: n.stack,
            errorBoundary: e.tag === 1 ? e.stateNode : null
          });
        } catch (c) {
          setTimeout(function() {
            throw c;
          });
        }
      }
      function zi(t, e, n) {
        return n = gn(n), n.tag = 3, n.payload = { element: null }, n.callback = function() {
          Ql(t, e);
        }, n;
      }
      function Nc(t) {
        return t = gn(t), t.tag = 3, t;
      }
      function Tc(t, e, n, r) {
        var c = n.type.getDerivedStateFromError;
        if (typeof c == "function") {
          var u = r.value;
          t.payload = function() {
            return c(u);
          }, t.callback = function() {
            zc(e, n, r);
          };
        }
        var g = n.stateNode;
        g !== null && typeof g.componentDidCatch == "function" && (t.callback = function() {
          zc(e, n, r), typeof c != "function" && (Mn === null ? Mn = /* @__PURE__ */ new Set([this]) : Mn.add(this));
          var C = r.stack;
          this.componentDidCatch(r.value, {
            componentStack: C !== null ? C : ""
          });
        });
      }
      function Om(t, e, n, r, c) {
        if (n.flags |= 32768, r !== null && typeof r == "object" && typeof r.then == "function") {
          if (e = n.alternate, e !== null && fa(
            e,
            n,
            c,
            !0
          ), n = Se.current, n !== null) {
            switch (n.tag) {
              case 31:
              case 13:
                return je === null ? Pl() : n.alternate === null && Bt === 0 && (Bt = 3), n.flags &= -257, n.flags |= 65536, n.lanes = c, r === pr ? n.flags |= 16384 : (e = n.updateQueue, e === null ? n.updateQueue = /* @__PURE__ */ new Set([r]) : e.add(r), Wi(t, r, c)), !1;
              case 22:
                return n.flags |= 65536, r === pr ? n.flags |= 16384 : (e = n.updateQueue, e === null ? (e = {
                  transitions: null,
                  markerInstances: null,
                  retryQueue: /* @__PURE__ */ new Set([r])
                }, n.updateQueue = e) : (n = e.retryQueue, n === null ? e.retryQueue = /* @__PURE__ */ new Set([r]) : n.add(r)), Wi(t, r, c)), !1;
            }
            throw Error(i(435, n.tag));
          }
          return Wi(t, r, c), Pl(), !1;
        }
        if (St)
          return e = Se.current, e !== null ? ((e.flags & 65536) === 0 && (e.flags |= 256), e.flags |= 65536, e.lanes = c, r !== vo && (t = Error(i(422), { cause: r }), Ga(
            G(t, n)
          ))) : (r !== vo && (e = Error(i(423), {
            cause: r
          }), Ga(
            G(e, n)
          )), t = t.current.alternate, t.flags |= 65536, c &= -c, t.lanes |= c, r = G(r, n), c = zi(
            t.stateNode,
            r,
            c
          ), ii(t, c), Bt !== 4 && (Bt = 2)), !1;
        var u = Error(i(520), { cause: r });
        if (u = G(u, n), ml === null ? ml = [u] : ml.push(u), Bt !== 4 && (Bt = 2), e === null) return !0;
        r = G(r, n), n = e;
        do {
          switch (n.tag) {
            case 3:
              return n.flags |= 65536, t = c & -c, n.lanes |= t, t = zi(n.stateNode, r, t), ii(n, t), !1;
            case 1:
              if (e = n.type, u = n.stateNode, (n.flags & 128) === 0 && (typeof e.getDerivedStateFromError == "function" || u !== null && typeof u.componentDidCatch == "function" && (Mn === null || !Mn.has(
                u
              ))))
                return n.flags |= 65536, c &= -c, n.lanes |= c, c = Nc(c), Tc(
                  c,
                  t,
                  n,
                  r
                ), ii(n, c), !1;
          }
          n = n.return;
        } while (n !== null);
        return !1;
      }
      function $t(t, e, n, r) {
        e.child = t === null ? pd(e, null, n, r) : na(
          e,
          t.child,
          n,
          r
        );
      }
      function Cc(t, e, n, r, c) {
        n = n.render;
        var u = e.ref;
        if ("ref" in r) {
          var g = {};
          for (var C in r)
            C !== "ref" && (g[C] = r[C]);
        } else g = r;
        return Qn(e), r = di(
          t,
          e,
          n,
          g,
          u,
          c
        ), C = fi(), t !== null && !Gt ? (mi(t, e, c), $e(t, e, c)) : (St && C && V(e), e.flags |= 1, $t(t, e, r, c), e.child);
      }
      function Mc(t, e, n, r, c) {
        if (t === null) {
          var u = n.type;
          return typeof u == "function" && !Fi(u) && u.defaultProps === void 0 && n.compare === null ? (e.tag = 15, e.type = u, Ac(
            t,
            e,
            u,
            r,
            c
          )) : (t = tr(
            n.type,
            null,
            r,
            e,
            e.mode,
            c
          ), t.ref = e.ref, t.return = e, e.child = t);
        }
        if (u = t.child, !Oi(t, c)) {
          var g = u.memoizedProps;
          if (n = n.compare, n = n !== null ? n : Ml, n(g, r) && t.ref === e.ref)
            return $e(
              t,
              e,
              c
            );
        }
        return e.flags |= 1, t = nn(u, r), t.ref = e.ref, t.return = e, e.child = t;
      }
      function Ac(t, e, n, r, c) {
        if (t !== null) {
          var u = t.memoizedProps;
          if (Ml(u, r) && t.ref === e.ref)
            if (Gt = !1, e.pendingProps = r = u, Oi(t, c))
              (t.flags & 131072) !== 0 && (Gt = !0);
            else
              return e.lanes = t.lanes, $e(t, e, c);
        }
        return Ni(
          t,
          e,
          n,
          r,
          c
        );
      }
      function jc(t, e, n, r) {
        var c = r.children, u = t !== null ? t.memoizedState : null;
        if (t === null && e.stateNode === null && (e.stateNode = {
          _visibility: 1,
          _pendingMarkers: null,
          _retryCache: null,
          _transitions: null
        }), r.mode === "hidden") {
          if ((e.flags & 128) !== 0) {
            if (u = u !== null ? u.baseLanes | n : n, t !== null) {
              for (r = e.child = t.child, c = 0; r !== null; )
                c = c | r.lanes | r.childLanes, r = r.sibling;
              r = c & ~u;
            } else r = 0, e.child = null;
            return Oc(
              t,
              e,
              u,
              n,
              r
            );
          }
          if ((n & 536870912) !== 0)
            e.memoizedState = { baseLanes: 0, cachePool: null }, t !== null && Cl(
              e,
              u !== null ? u.cachePool : null
            ), u !== null ? Gs(e, u) : oi(), Ks(e);
          else
            return r = e.lanes = 536870912, Oc(
              t,
              e,
              u !== null ? u.baseLanes | n : n,
              n,
              r
            );
        } else
          u !== null ? (Cl(e, u.cachePool), Gs(e, u), yn(), e.memoizedState = null) : (t !== null && Cl(e, null), oi(), yn());
        return $t(t, e, c, n), e.child;
      }
      function Wa(t, e) {
        return t !== null && t.tag === 22 || e.stateNode !== null || (e.stateNode = {
          _visibility: 1,
          _pendingMarkers: null,
          _retryCache: null,
          _transitions: null
        }), e.sibling;
      }
      function Oc(t, e, n, r, c) {
        var u = ni();
        return u = u === null ? null : {
          parent: an ? Rt._currentValue : Rt._currentValue2,
          pool: u
        }, e.memoizedState = {
          baseLanes: n,
          cachePool: u
        }, t !== null && Cl(e, null), oi(), Ks(e), t !== null && fa(t, e, r, !0), e.childLanes = c, null;
      }
      function Vl(t, e) {
        return e = Ll(
          { mode: e.mode, children: e.children },
          t.mode
        ), e.ref = t.ref, t.child = e, e.return = t, e;
      }
      function Rc(t, e, n) {
        return na(e, t.child, null, n), t = Vl(
          e,
          e.pendingProps
        ), t.flags |= 2, be(e), e.memoizedState = null, t;
      }
      function Rm(t, e, n) {
        var r = e.pendingProps, c = (e.flags & 128) !== 0;
        if (e.flags &= -129, t === null) {
          if (St) {
            if (r.mode === "hidden")
              return t = Vl(e, r), e.lanes = 536870912, Wa(null, t);
            if (ci(e), (t = Ot) ? (t = eh(
              t,
              Me
            ), t !== null && (e.memoizedState = {
              dehydrated: t,
              treeContext: kn !== null ? { id: Xe, overflow: Le } : null,
              retryLane: 536870912,
              hydrationErrors: null
            }, n = Au(t), n.return = e, e.child = n, ee = e, Ot = null)) : t = null, t === null) throw ht(e);
            return e.lanes = 536870912, null;
          }
          return Vl(e, r);
        }
        var u = t.memoizedState;
        if (u !== null) {
          var g = u.dehydrated;
          if (ci(e), c)
            if (e.flags & 256)
              e.flags &= -257, e = Rc(
                t,
                e,
                n
              );
            else if (e.memoizedState !== null)
              e.child = t.child, e.flags |= 128, e = null;
            else throw Error(i(558));
          else if (Gt || fa(
            t,
            e,
            n,
            !1
          ), c = (n & t.childLanes) !== 0, Gt || c) {
            if (r = At, r !== null && (g = S(r, n), g !== 0 && g !== u.retryLane))
              throw u.retryLane = g, Xn(t, g), fe(r, t, g), No;
            Pl(), e = Rc(
              t,
              e,
              n
            );
          } else
            t = u.treeContext, oe && (Ot = Fp(g), ee = e, St = !0, zn = null, Me = !1, t !== null && it(e, t)), e = Vl(e, r), e.flags |= 4096;
          return e;
        }
        return t = nn(t.child, {
          mode: r.mode,
          children: r.children
        }), t.ref = e.ref, e.child = t, t.return = e, t;
      }
      function Xl(t, e) {
        var n = e.ref;
        if (n === null)
          t !== null && t.ref !== null && (e.flags |= 4194816);
        else {
          if (typeof n != "function" && typeof n != "object")
            throw Error(i(284));
          (t === null || t.ref !== n) && (e.flags |= 4194816);
        }
      }
      function Ni(t, e, n, r, c) {
        return Qn(e), n = di(
          t,
          e,
          n,
          r,
          void 0,
          c
        ), r = fi(), t !== null && !Gt ? (mi(t, e, c), $e(t, e, c)) : (St && r && V(e), e.flags |= 1, $t(t, e, n, c), e.child);
      }
      function Dc(t, e, n, r, c, u) {
        return Qn(e), e.updateQueue = null, n = Vs(
          e,
          r,
          n,
          c
        ), Qs(t), r = fi(), t !== null && !Gt ? (mi(t, e, u), $e(t, e, u)) : (St && r && V(e), e.flags |= 1, $t(t, e, n, u), e.child);
      }
      function Hc(t, e, n, r, c) {
        if (Qn(e), e.stateNode === null) {
          var u = Sa, g = n.contextType;
          typeof g == "object" && g !== null && (u = Pt(g)), u = new n(r, u), e.memoizedState = u.state !== null && u.state !== void 0 ? u.state : null, u.updater = zo, e.stateNode = u, u._reactInternals = e, u = e.stateNode, u.props = r, u.state = e.memoizedState, u.refs = {}, li(e), g = n.contextType, u.context = typeof g == "object" && g !== null ? Pt(g) : Sa, u.state = e.memoizedState, g = n.getDerivedStateFromProps, typeof g == "function" && (Ei(
            e,
            n,
            g,
            r
          ), u.state = e.memoizedState), typeof n.getDerivedStateFromProps == "function" || typeof u.getSnapshotBeforeUpdate == "function" || typeof u.UNSAFE_componentWillMount != "function" && typeof u.componentWillMount != "function" || (g = u.state, typeof u.componentWillMount == "function" && u.componentWillMount(), typeof u.UNSAFE_componentWillMount == "function" && u.UNSAFE_componentWillMount(), g !== u.state && zo.enqueueReplaceState(
            u,
            u.state,
            null
          ), La(e, r, u, c), Xa(), u.state = e.memoizedState), typeof u.componentDidMount == "function" && (e.flags |= 4194308), r = !0;
        } else if (t === null) {
          u = e.stateNode;
          var C = e.memoizedProps, Y = Ln(n, C);
          u.props = Y;
          var Z = u.context, P = n.contextType;
          g = Sa, typeof P == "object" && P !== null && (g = Pt(P));
          var W = n.getDerivedStateFromProps;
          P = typeof W == "function" || typeof u.getSnapshotBeforeUpdate == "function", C = e.pendingProps !== C, P || typeof u.UNSAFE_componentWillReceiveProps != "function" && typeof u.componentWillReceiveProps != "function" || (C || Z !== g) && Ec(
            e,
            u,
            r,
            g
          ), Nn = !1;
          var nt = e.memoizedState;
          u.state = nt, La(e, r, u, c), Xa(), Z = e.memoizedState, C || nt !== Z || Nn ? (typeof W == "function" && (Ei(
            e,
            n,
            W,
            r
          ), Z = e.memoizedState), (Y = Nn || kc(
            e,
            n,
            Y,
            r,
            nt,
            Z,
            g
          )) ? (P || typeof u.UNSAFE_componentWillMount != "function" && typeof u.componentWillMount != "function" || (typeof u.componentWillMount == "function" && u.componentWillMount(), typeof u.UNSAFE_componentWillMount == "function" && u.UNSAFE_componentWillMount()), typeof u.componentDidMount == "function" && (e.flags |= 4194308)) : (typeof u.componentDidMount == "function" && (e.flags |= 4194308), e.memoizedProps = r, e.memoizedState = Z), u.props = r, u.state = Z, u.context = g, r = Y) : (typeof u.componentDidMount == "function" && (e.flags |= 4194308), r = !1);
        } else {
          u = e.stateNode, ri(t, e), g = e.memoizedProps, P = Ln(n, g), u.props = P, W = e.pendingProps, nt = u.context, Z = n.contextType, Y = Sa, typeof Z == "object" && Z !== null && (Y = Pt(Z)), C = n.getDerivedStateFromProps, (Z = typeof C == "function" || typeof u.getSnapshotBeforeUpdate == "function") || typeof u.UNSAFE_componentWillReceiveProps != "function" && typeof u.componentWillReceiveProps != "function" || (g !== W || nt !== Y) && Ec(
            e,
            u,
            r,
            Y
          ), Nn = !1, nt = e.memoizedState, u.state = nt, La(e, r, u, c), Xa();
          var gt = e.memoizedState;
          g !== W || nt !== gt || Nn || t !== null && t.dependencies !== null && zl(t.dependencies) ? (typeof C == "function" && (Ei(
            e,
            n,
            C,
            r
          ), gt = e.memoizedState), (P = Nn || kc(
            e,
            n,
            P,
            r,
            nt,
            gt,
            Y
          ) || t !== null && t.dependencies !== null && zl(t.dependencies)) ? (Z || typeof u.UNSAFE_componentWillUpdate != "function" && typeof u.componentWillUpdate != "function" || (typeof u.componentWillUpdate == "function" && u.componentWillUpdate(r, gt, Y), typeof u.UNSAFE_componentWillUpdate == "function" && u.UNSAFE_componentWillUpdate(
            r,
            gt,
            Y
          )), typeof u.componentDidUpdate == "function" && (e.flags |= 4), typeof u.getSnapshotBeforeUpdate == "function" && (e.flags |= 1024)) : (typeof u.componentDidUpdate != "function" || g === t.memoizedProps && nt === t.memoizedState || (e.flags |= 4), typeof u.getSnapshotBeforeUpdate != "function" || g === t.memoizedProps && nt === t.memoizedState || (e.flags |= 1024), e.memoizedProps = r, e.memoizedState = gt), u.props = r, u.state = gt, u.context = Y, r = P) : (typeof u.componentDidUpdate != "function" || g === t.memoizedProps && nt === t.memoizedState || (e.flags |= 4), typeof u.getSnapshotBeforeUpdate != "function" || g === t.memoizedProps && nt === t.memoizedState || (e.flags |= 1024), r = !1);
        }
        return u = r, Xl(t, e), r = (e.flags & 128) !== 0, u || r ? (u = e.stateNode, n = r && typeof n.getDerivedStateFromError != "function" ? null : u.render(), e.flags |= 1, t !== null && r ? (e.child = na(
          e,
          t.child,
          null,
          c
        ), e.child = na(
          e,
          null,
          n,
          c
        )) : $t(t, e, n, c), e.memoizedState = u.state, t = e.child) : t = $e(
          t,
          e,
          c
        ), t;
      }
      function Bc(t, e, n, r) {
        return De(), e.flags |= 256, $t(t, e, n, r), e.child;
      }
      function Ti(t) {
        return { baseLanes: t, cachePool: js() };
      }
      function Ci(t, e, n) {
        return t = t !== null ? t.childLanes & ~n : 0, e && (t |= Ee), t;
      }
      function Uc(t, e, n) {
        var r = e.pendingProps, c = !1, u = (e.flags & 128) !== 0, g;
        if ((g = u) || (g = t !== null && t.memoizedState === null ? !1 : (qt.current & 2) !== 0), g && (c = !0, e.flags &= -129), g = (e.flags & 32) !== 0, e.flags &= -33, t === null) {
          if (St) {
            if (c ? vn(e) : yn(), (t = Ot) ? (t = nh(
              t,
              Me
            ), t !== null && (e.memoizedState = {
              dehydrated: t,
              treeContext: kn !== null ? { id: Xe, overflow: Le } : null,
              retryLane: 536870912,
              hydrationErrors: null
            }, n = Au(t), n.return = e, e.child = n, ee = e, Ot = null)) : t = null, t === null) throw ht(e);
            return uo(t) ? e.lanes = 32 : e.lanes = 536870912, null;
          }
          var C = r.children;
          return r = r.fallback, c ? (yn(), c = e.mode, C = Ll(
            { mode: "hidden", children: C },
            c
          ), r = Wn(
            r,
            c,
            n,
            null
          ), C.return = e, r.return = e, C.sibling = r, e.child = C, r = e.child, r.memoizedState = Ti(n), r.childLanes = Ci(
            t,
            g,
            n
          ), e.memoizedState = To, Wa(null, r)) : (vn(e), Mi(e, C));
        }
        var Y = t.memoizedState;
        if (Y !== null && (C = Y.dehydrated, C !== null)) {
          if (u)
            e.flags & 256 ? (vn(e), e.flags &= -257, e = Ai(
              t,
              e,
              n
            )) : e.memoizedState !== null ? (yn(), e.child = t.child, e.flags |= 128, e = null) : (yn(), C = r.fallback, c = e.mode, r = Ll(
              { mode: "visible", children: r.children },
              c
            ), C = Wn(
              C,
              c,
              n,
              null
            ), C.flags |= 2, r.return = e, C.return = e, r.sibling = C, e.child = r, na(
              e,
              t.child,
              null,
              n
            ), r = e.child, r.memoizedState = Ti(n), r.childLanes = Ci(
              t,
              g,
              n
            ), e.memoizedState = To, e = Wa(null, r));
          else if (vn(e), uo(C))
            g = Qp(C).digest, r = Error(i(419)), r.stack = "", r.digest = g, Ga({ value: r, source: null, stack: null }), e = Ai(
              t,
              e,
              n
            );
          else if (Gt || fa(
            t,
            e,
            n,
            !1
          ), g = (n & t.childLanes) !== 0, Gt || g) {
            if (g = At, g !== null && (r = S(
              g,
              n
            ), r !== 0 && r !== Y.retryLane))
              throw Y.retryLane = r, Xn(t, r), fe(g, t, r), No;
            co(C) || Pl(), e = Ai(
              t,
              e,
              n
            );
          } else
            co(C) ? (e.flags |= 192, e.child = t.child, e = null) : (t = Y.treeContext, oe && (Ot = Ip(
              C
            ), ee = e, St = !0, zn = null, Me = !1, t !== null && it(e, t)), e = Mi(
              e,
              r.children
            ), e.flags |= 4096);
          return e;
        }
        return c ? (yn(), C = r.fallback, c = e.mode, Y = t.child, u = Y.sibling, r = nn(Y, {
          mode: "hidden",
          children: r.children
        }), r.subtreeFlags = Y.subtreeFlags & 65011712, u !== null ? C = nn(
          u,
          C
        ) : (C = Wn(
          C,
          c,
          n,
          null
        ), C.flags |= 2), C.return = e, r.return = e, r.sibling = C, e.child = r, Wa(null, r), r = e.child, C = t.child.memoizedState, C === null ? C = Ti(n) : (c = C.cachePool, c !== null ? (Y = an ? Rt._currentValue : Rt._currentValue2, c = c.parent !== Y ? { parent: Y, pool: Y } : c) : c = js(), C = {
          baseLanes: C.baseLanes | n,
          cachePool: c
        }), r.memoizedState = C, r.childLanes = Ci(
          t,
          g,
          n
        ), e.memoizedState = To, Wa(t.child, r)) : (vn(e), n = t.child, t = n.sibling, n = nn(n, {
          mode: "visible",
          children: r.children
        }), n.return = e, n.sibling = null, t !== null && (g = e.deletions, g === null ? (e.deletions = [t], e.flags |= 16) : g.push(t)), e.child = n, e.memoizedState = null, n);
      }
      function Mi(t, e) {
        return e = Ll(
          { mode: "visible", children: e },
          t.mode
        ), e.return = t, t.child = e;
      }
      function Ll(t, e) {
        return t = s(22, t, null, e), t.lanes = 0, t;
      }
      function Ai(t, e, n) {
        return na(e, t.child, null, n), t = Mi(
          e,
          e.pendingProps.children
        ), t.flags |= 2, e.memoizedState = null, t;
      }
      function qc(t, e, n) {
        t.lanes |= e;
        var r = t.alternate;
        r !== null && (r.lanes |= e), Pr(t.return, e, n);
      }
      function ji(t, e, n, r, c, u) {
        var g = t.memoizedState;
        g === null ? t.memoizedState = {
          isBackwards: e,
          rendering: null,
          renderingStartTime: 0,
          last: r,
          tail: n,
          tailMode: c,
          treeForkCount: u
        } : (g.isBackwards = e, g.rendering = null, g.renderingStartTime = 0, g.last = r, g.tail = n, g.tailMode = c, g.treeForkCount = u);
      }
      function Yc(t, e, n) {
        var r = e.pendingProps, c = r.revealOrder, u = r.tail;
        r = r.children;
        var g = qt.current, C = (g & 2) !== 0;
        if (C ? (g = g & 1 | 2, e.flags |= 128) : g &= 1, _(qt, g), $t(t, e, r, n), r = St ? il : 0, !C && t !== null && (t.flags & 128) !== 0)
          t: for (t = e.child; t !== null; ) {
            if (t.tag === 13)
              t.memoizedState !== null && qc(t, n, e);
            else if (t.tag === 19)
              qc(t, n, e);
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
            for (n = e.child, c = null; n !== null; )
              t = n.alternate, t !== null && Hl(t) === null && (c = n), n = n.sibling;
            n = c, n === null ? (c = e.child, e.child = null) : (c = n.sibling, n.sibling = null), ji(
              e,
              !1,
              c,
              n,
              u,
              r
            );
            break;
          case "backwards":
          case "unstable_legacy-backwards":
            for (n = null, c = e.child, e.child = null; c !== null; ) {
              if (t = c.alternate, t !== null && Hl(t) === null) {
                e.child = c;
                break;
              }
              t = c.sibling, c.sibling = n, n = c, c = t;
            }
            ji(
              e,
              !0,
              n,
              null,
              u,
              r
            );
            break;
          case "together":
            ji(
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
      function $e(t, e, n) {
        if (t !== null && (e.dependencies = t.dependencies), Cn |= e.lanes, (n & e.childLanes) === 0)
          if (t !== null) {
            if (fa(
              t,
              e,
              n,
              !1
            ), (n & e.childLanes) === 0)
              return null;
          } else return null;
        if (t !== null && e.child !== t.child)
          throw Error(i(153));
        if (e.child !== null) {
          for (t = e.child, n = nn(t, t.pendingProps), e.child = n, n.return = e; t.sibling !== null; )
            t = t.sibling, n = n.sibling = nn(t, t.pendingProps), n.return = e;
          n.sibling = null;
        }
        return e.child;
      }
      function Oi(t, e) {
        return (t.lanes & e) !== 0 ? !0 : (t = t.dependencies, !!(t !== null && zl(t)));
      }
      function Dm(t, e, n) {
        switch (e.tag) {
          case 3:
            ot(
              e,
              e.stateNode.containerInfo
            ), hn(e, Rt, t.memoizedState.cache), De();
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
            hn(
              e,
              e.type,
              e.memoizedProps.value
            );
            break;
          case 31:
            if (e.memoizedState !== null)
              return e.flags |= 128, ci(e), null;
            break;
          case 13:
            var r = e.memoizedState;
            if (r !== null)
              return r.dehydrated !== null ? (vn(e), e.flags |= 128, null) : (n & e.child.childLanes) !== 0 ? Uc(
                t,
                e,
                n
              ) : (vn(e), t = $e(
                t,
                e,
                n
              ), t !== null ? t.sibling : null);
            vn(e);
            break;
          case 19:
            var c = (t.flags & 128) !== 0;
            if (r = (n & e.childLanes) !== 0, r || (fa(
              t,
              e,
              n,
              !1
            ), r = (n & e.childLanes) !== 0), c) {
              if (r)
                return Yc(
                  t,
                  e,
                  n
                );
              e.flags |= 128;
            }
            if (c = e.memoizedState, c !== null && (c.rendering = null, c.tail = null, c.lastEffect = null), _(qt, qt.current), r) break;
            return null;
          case 22:
            return e.lanes = 0, jc(
              t,
              e,
              n,
              e.pendingProps
            );
          case 24:
            hn(e, Rt, t.memoizedState.cache);
        }
        return $e(t, e, n);
      }
      function Gc(t, e, n) {
        if (t !== null)
          if (t.memoizedProps !== e.pendingProps)
            Gt = !0;
          else {
            if (!Oi(t, n) && (e.flags & 128) === 0)
              return Gt = !1, Dm(
                t,
                e,
                n
              );
            Gt = (t.flags & 131072) !== 0;
          }
        else
          Gt = !1, St && (e.flags & 1048576) !== 0 && T(e, il, e.index);
        switch (e.lanes = 0, e.tag) {
          case 16:
            t: {
              var r = e.pendingProps;
              if (t = Vn(e.elementType), e.type = t, typeof t == "function")
                Fi(t) ? (r = Ln(t, r), e.tag = 1, e = Hc(
                  null,
                  e,
                  t,
                  r,
                  n
                )) : (e.tag = 0, e = Ni(
                  null,
                  e,
                  t,
                  r,
                  n
                ));
              else {
                if (t != null) {
                  var c = t.$$typeof;
                  if (c === no) {
                    e.tag = 11, e = Cc(
                      null,
                      e,
                      t,
                      r,
                      n
                    );
                    break t;
                  } else if (c === ro) {
                    e.tag = 14, e = Mc(
                      null,
                      e,
                      t,
                      r,
                      n
                    );
                    break t;
                  }
                }
                throw e = k(t) || t, Error(i(306, e, ""));
              }
            }
            return e;
          case 0:
            return Ni(
              t,
              e,
              e.type,
              e.pendingProps,
              n
            );
          case 1:
            return r = e.type, c = Ln(
              r,
              e.pendingProps
            ), Hc(
              t,
              e,
              r,
              c,
              n
            );
          case 3:
            t: {
              if (ot(
                e,
                e.stateNode.containerInfo
              ), t === null) throw Error(i(387));
              var u = e.pendingProps;
              c = e.memoizedState, r = c.element, ri(t, e), La(e, u, null, n);
              var g = e.memoizedState;
              if (u = g.cache, hn(e, Rt, u), u !== c.cache && $r(
                e,
                [Rt],
                n,
                !0
              ), Xa(), u = g.element, oe && c.isDehydrated)
                if (c = {
                  element: u,
                  isDehydrated: !1,
                  cache: g.cache
                }, e.updateQueue.baseState = c, e.memoizedState = c, e.flags & 256) {
                  e = Bc(
                    t,
                    e,
                    u,
                    n
                  );
                  break t;
                } else if (u !== r) {
                  r = G(
                    Error(i(424)),
                    e
                  ), Ga(r), e = Bc(
                    t,
                    e,
                    u,
                    n
                  );
                  break t;
                } else
                  for (oe && (Ot = Wp(
                    e.stateNode.containerInfo
                  ), ee = e, St = !0, zn = null, Me = !0), n = pd(
                    e,
                    null,
                    u,
                    n
                  ), e.child = n; n; )
                    n.flags = n.flags & -3 | 4096, n = n.sibling;
              else {
                if (De(), u === r) {
                  e = $e(
                    t,
                    e,
                    n
                  );
                  break t;
                }
                $t(t, e, u, n);
              }
              e = e.child;
            }
            return e;
          case 26:
            if (qe)
              return Xl(t, e), t === null ? (n = td(
                e.type,
                null,
                e.pendingProps,
                null
              )) ? e.memoizedState = n : St || (e.stateNode = _h(
                e.type,
                e.pendingProps,
                En.current,
                e
              )) : e.memoizedState = td(
                e.type,
                t.memoizedProps,
                e.pendingProps,
                t.memoizedState
              ), null;
          case 27:
            if (Vt)
              return kt(e), t === null && Vt && St && (r = e.stateNode = id(
                e.type,
                e.pendingProps,
                En.current,
                te.current,
                !1
              ), ee = e, Me = !0, Ot = Pp(
                e.type,
                r,
                Ot
              )), $t(
                t,
                e,
                e.pendingProps.children,
                n
              ), Xl(t, e), t === null && (e.flags |= 4194304), e.child;
          case 5:
            return t === null && St && (yh(
              e.type,
              e.pendingProps,
              te.current
            ), (c = r = Ot) && (r = $p(
              r,
              e.type,
              e.pendingProps,
              Me
            ), r !== null ? (e.stateNode = r, ee = e, Ot = Jp(r), Me = !1, c = !0) : c = !1), c || ht(e)), kt(e), c = e.type, u = e.pendingProps, g = t !== null ? t.memoizedProps : null, r = u.children, ar(c, u) ? r = null : g !== null && ar(c, g) && (e.flags |= 32), e.memoizedState !== null && (c = di(
              t,
              e,
              Nm,
              null,
              null,
              n
            ), an ? In._currentValue = c : In._currentValue2 = c), Xl(t, e), $t(t, e, r, n), e.child;
          case 6:
            return t === null && St && (xh(
              e.pendingProps,
              te.current
            ), (t = n = Ot) && (n = th(
              n,
              e.pendingProps,
              Me
            ), n !== null ? (e.stateNode = n, ee = e, Ot = null, t = !0) : t = !1), t || ht(e)), null;
          case 13:
            return Uc(t, e, n);
          case 4:
            return ot(
              e,
              e.stateNode.containerInfo
            ), r = e.pendingProps, t === null ? e.child = na(
              e,
              null,
              r,
              n
            ) : $t(t, e, r, n), e.child;
          case 11:
            return Cc(
              t,
              e,
              e.type,
              e.pendingProps,
              n
            );
          case 7:
            return $t(
              t,
              e,
              e.pendingProps,
              n
            ), e.child;
          case 8:
            return $t(
              t,
              e,
              e.pendingProps.children,
              n
            ), e.child;
          case 12:
            return $t(
              t,
              e,
              e.pendingProps.children,
              n
            ), e.child;
          case 10:
            return r = e.pendingProps, hn(e, e.type, r.value), $t(
              t,
              e,
              r.children,
              n
            ), e.child;
          case 9:
            return c = e.type._context, r = e.pendingProps.children, Qn(e), c = Pt(c), r = r(c), e.flags |= 1, $t(t, e, r, n), e.child;
          case 14:
            return Mc(
              t,
              e,
              e.type,
              e.pendingProps,
              n
            );
          case 15:
            return Ac(
              t,
              e,
              e.type,
              e.pendingProps,
              n
            );
          case 19:
            return Yc(
              t,
              e,
              n
            );
          case 31:
            return Rm(t, e, n);
          case 22:
            return jc(
              t,
              e,
              n,
              e.pendingProps
            );
          case 24:
            return Qn(e), r = Pt(Rt), t === null ? (c = ni(), c === null && (c = At, u = ti(), c.pooledCache = u, u.refCount++, u !== null && (c.pooledCacheLanes |= n), c = u), e.memoizedState = {
              parent: r,
              cache: c
            }, li(e), hn(e, Rt, c)) : ((t.lanes & n) !== 0 && (ri(t, e), La(e, null, null, n), Xa()), c = t.memoizedState, u = e.memoizedState, c.parent !== r ? (c = { parent: r, cache: r }, e.memoizedState = c, e.lanes === 0 && (e.memoizedState = e.updateQueue.baseState = c), hn(e, Rt, r)) : (r = u.cache, hn(e, Rt, r), r !== c.cache && $r(
              e,
              [Rt],
              n,
              !0
            ))), $t(
              t,
              e,
              e.pendingProps.children,
              n
            ), e.child;
          case 29:
            throw e.pendingProps;
        }
        throw Error(i(156, e.tag));
      }
      function He(t) {
        t.flags |= 4;
      }
      function Zl(t) {
        Ve && (t.flags |= 8);
      }
      function Kc(t, e) {
        if (t !== null && t.child === e.child) return !1;
        if ((e.flags & 16) !== 0) return !0;
        for (t = e.child; t !== null; ) {
          if ((t.flags & 8218) !== 0 || (t.subtreeFlags & 8218) !== 0)
            return !0;
          t = t.sibling;
        }
        return !1;
      }
      function Ri(t, e, n, r) {
        if (ie)
          for (n = e.child; n !== null; ) {
            if (n.tag === 5 || n.tag === 6)
              oo(t, n.stateNode);
            else if (!(n.tag === 4 || Vt && n.tag === 27) && n.child !== null) {
              n.child.return = n, n = n.child;
              continue;
            }
            if (n === e) break;
            for (; n.sibling === null; ) {
              if (n.return === null || n.return === e)
                return;
              n = n.return;
            }
            n.sibling.return = n.return, n = n.sibling;
          }
        else if (Ve)
          for (var c = e.child; c !== null; ) {
            if (c.tag === 5) {
              var u = c.stateNode;
              n && r && (u = Wu(
                u,
                c.type,
                c.memoizedProps
              )), oo(t, u);
            } else if (c.tag === 6)
              u = c.stateNode, n && r && (u = Fu(
                u,
                c.memoizedProps
              )), oo(t, u);
            else if (c.tag !== 4) {
              if (c.tag === 22 && c.memoizedState !== null)
                u = c.child, u !== null && (u.return = c), Ri(t, c, !0, !0);
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
      function Qc(t, e, n, r) {
        var c = !1;
        if (Ve)
          for (var u = e.child; u !== null; ) {
            if (u.tag === 5) {
              var g = u.stateNode;
              n && r && (g = Wu(
                g,
                u.type,
                u.memoizedProps
              )), Zu(t, g);
            } else if (u.tag === 6)
              g = u.stateNode, n && r && (g = Fu(
                g,
                u.memoizedProps
              )), Zu(t, g);
            else if (u.tag !== 4) {
              if (u.tag === 22 && u.memoizedState !== null)
                c = u.child, c !== null && (c.return = u), Qc(t, u, !0, !0), c = !0;
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
      function Vc(t, e) {
        if (Ve && Kc(t, e)) {
          t = e.stateNode;
          var n = t.containerInfo, r = Lu();
          Qc(r, e, !1, !1), t.pendingChildren = r, He(e), Kp(n, r);
        }
      }
      function Di(t, e, n, r) {
        if (ie)
          t.memoizedProps !== r && He(e);
        else if (Ve) {
          var c = t.stateNode, u = t.memoizedProps;
          if ((t = Kc(t, e)) || u !== r) {
            var g = te.current;
            u = Gp(
              c,
              n,
              u,
              r,
              !t,
              null
            ), u === c ? e.stateNode = c : (Zl(e), Gu(
              u,
              n,
              r,
              g
            ) && He(e), e.stateNode = u, t && Ri(u, e, !1, !1));
          } else e.stateNode = c;
        }
      }
      function Hi(t, e, n, r, c) {
        if ((t.mode & 32) !== 0 && (n === null ? pp(e, r) : hp(e, n, r))) {
          if (t.flags |= 16777216, (c & 335544128) === c || so(e, r))
            if (Qu(t.stateNode, e, r))
              t.flags |= 8192;
            else if (gu()) t.flags |= 8192;
            else
              throw ea = pr, _o;
        } else t.flags &= -16777217;
      }
      function Xc(t, e) {
        if (kh(e)) {
          if (t.flags |= 16777216, !rd(e))
            if (gu()) t.flags |= 8192;
            else
              throw ea = pr, _o;
        } else t.flags &= -16777217;
      }
      function Jl(t, e) {
        e !== null && (t.flags |= 4), t.flags & 16384 && (e = t.tag !== 22 ? X() : 536870912, t.lanes |= e, Ba |= e);
      }
      function Fa(t, e) {
        if (!St)
          switch (t.tailMode) {
            case "hidden":
              e = t.tail;
              for (var n = null; e !== null; )
                e.alternate !== null && (n = e), e = e.sibling;
              n === null ? t.tail = null : n.sibling = null;
              break;
            case "collapsed":
              n = t.tail;
              for (var r = null; n !== null; )
                n.alternate !== null && (r = n), n = n.sibling;
              r === null ? e || t.tail === null ? t.tail = null : t.tail.sibling = null : r.sibling = null;
          }
      }
      function jt(t) {
        var e = t.alternate !== null && t.alternate.child === t.child, n = 0, r = 0;
        if (e)
          for (var c = t.child; c !== null; )
            n |= c.lanes | c.childLanes, r |= c.subtreeFlags & 65011712, r |= c.flags & 65011712, c.return = t, c = c.sibling;
        else
          for (c = t.child; c !== null; )
            n |= c.lanes | c.childLanes, r |= c.subtreeFlags, r |= c.flags, c.return = t, c = c.sibling;
        return t.subtreeFlags |= r, t.childLanes = n, e;
      }
      function Hm(t, e, n) {
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
            return n = e.stateNode, r = null, t !== null && (r = t.memoizedState.cache), e.memoizedState.cache !== r && (e.flags |= 2048), Ie(Rt), st(), n.pendingContext && (n.context = n.pendingContext, n.pendingContext = null), (t === null || t.child === null) && (Re(e) ? He(e) : t === null || t.memoizedState.isDehydrated && (e.flags & 256) === 0 || (e.flags |= 1024, pn())), Vc(t, e), jt(e), null;
          case 26:
            if (qe) {
              var c = e.type, u = e.memoizedState;
              return t === null ? (He(e), u !== null ? (jt(e), Xc(
                e,
                u
              )) : (jt(e), Hi(
                e,
                c,
                null,
                r,
                n
              ))) : u ? u !== t.memoizedState ? (He(e), jt(e), Xc(
                e,
                u
              )) : (jt(e), e.flags &= -16777217) : (u = t.memoizedProps, ie ? u !== r && He(e) : Di(
                t,
                e,
                c,
                r
              ), jt(e), Hi(
                e,
                c,
                u,
                r,
                n
              )), null;
            }
          case 27:
            if (Vt) {
              if (Zt(e), n = En.current, c = e.type, t !== null && e.stateNode != null)
                ie ? t.memoizedProps !== r && He(e) : Di(t, e, c, r);
              else {
                if (!r) {
                  if (e.stateNode === null)
                    throw Error(i(166));
                  return jt(e), null;
                }
                t = te.current, Re(e) ? Gn(e, t) : (t = id(
                  c,
                  r,
                  n,
                  t,
                  !0
                ), e.stateNode = t, He(e));
              }
              return jt(e), null;
            }
          case 5:
            if (Zt(e), c = e.type, t !== null && e.stateNode != null)
              Di(t, e, c, r);
            else {
              if (!r) {
                if (e.stateNode === null)
                  throw Error(i(166));
                return jt(e), null;
              }
              if (u = te.current, Re(e))
                Gn(e, u), mh(
                  e.stateNode,
                  c,
                  r,
                  u
                ) && (e.flags |= 64);
              else {
                var g = ip(
                  c,
                  r,
                  En.current,
                  u,
                  e
                );
                Zl(e), Ri(g, e, !1, !1), e.stateNode = g, Gu(
                  g,
                  c,
                  r,
                  u
                ) && He(e);
              }
            }
            return jt(e), Hi(
              e,
              e.type,
              t === null ? null : t.memoizedProps,
              e.pendingProps,
              n
            ), null;
          case 6:
            if (t && e.stateNode != null)
              n = t.memoizedProps, ie ? n !== r && He(e) : Ve && (n !== r ? (t = En.current, n = te.current, Zl(e), e.stateNode = Ku(
                r,
                t,
                n,
                e
              )) : e.stateNode = t.stateNode);
            else {
              if (typeof r != "string" && e.stateNode === null)
                throw Error(i(166));
              if (t = En.current, n = te.current, Re(e)) {
                if (!oe) throw Error(i(176));
                if (t = e.stateNode, n = e.memoizedProps, r = null, c = ee, c !== null)
                  switch (c.tag) {
                    case 27:
                    case 5:
                      r = c.memoizedProps;
                  }
                lh(
                  t,
                  n,
                  e,
                  r
                ) || ht(e, !0);
              } else
                Zl(e), e.stateNode = Ku(
                  r,
                  t,
                  n,
                  e
                );
            }
            return jt(e), null;
          case 31:
            if (n = e.memoizedState, t === null || t.memoizedState !== null) {
              if (r = Re(e), n !== null) {
                if (t === null) {
                  if (!r) throw Error(i(318));
                  if (!oe) throw Error(i(556));
                  if (t = e.memoizedState, t = t !== null ? t.dehydrated : null, !t) throw Error(i(557));
                  rh(t, e);
                } else
                  De(), (e.flags & 128) === 0 && (e.memoizedState = null), e.flags |= 4;
                jt(e), t = !1;
              } else
                n = pn(), t !== null && t.memoizedState !== null && (t.memoizedState.hydrationErrors = n), t = !0;
              if (!t)
                return e.flags & 256 ? (be(e), e) : (be(e), null);
              if ((e.flags & 128) !== 0)
                throw Error(i(558));
            }
            return jt(e), null;
          case 13:
            if (r = e.memoizedState, t === null || t.memoizedState !== null && t.memoizedState.dehydrated !== null) {
              if (c = Re(e), r !== null && r.dehydrated !== null) {
                if (t === null) {
                  if (!c) throw Error(i(318));
                  if (!oe) throw Error(i(344));
                  if (c = e.memoizedState, c = c !== null ? c.dehydrated : null, !c) throw Error(i(317));
                  ih(c, e);
                } else
                  De(), (e.flags & 128) === 0 && (e.memoizedState = null), e.flags |= 4;
                jt(e), c = !1;
              } else
                c = pn(), t !== null && t.memoizedState !== null && (t.memoizedState.hydrationErrors = c), c = !0;
              if (!c)
                return e.flags & 256 ? (be(e), e) : (be(e), null);
            }
            return be(e), (e.flags & 128) !== 0 ? (e.lanes = n, e) : (n = r !== null, t = t !== null && t.memoizedState !== null, n && (r = e.child, c = null, r.alternate !== null && r.alternate.memoizedState !== null && r.alternate.memoizedState.cachePool !== null && (c = r.alternate.memoizedState.cachePool.pool), u = null, r.memoizedState !== null && r.memoizedState.cachePool !== null && (u = r.memoizedState.cachePool.pool), u !== c && (r.flags |= 2048)), n !== t && n && (e.child.flags |= 8192), Jl(e, e.updateQueue), jt(e), null);
          case 4:
            return st(), Vc(t, e), t === null && up(e.stateNode.containerInfo), jt(e), null;
          case 10:
            return Ie(e.type), jt(e), null;
          case 19:
            if (N(qt), r = e.memoizedState, r === null) return jt(e), null;
            if (c = (e.flags & 128) !== 0, u = r.rendering, u === null)
              if (c) Fa(r, !1);
              else {
                if (Bt !== 0 || t !== null && (t.flags & 128) !== 0)
                  for (t = e.child; t !== null; ) {
                    if (u = Hl(t), u !== null) {
                      for (e.flags |= 128, Fa(r, !1), t = u.updateQueue, e.updateQueue = t, Jl(e, t), e.subtreeFlags = 0, t = n, n = e.child; n !== null; )
                        Mu(n, t), n = n.sibling;
                      return _(
                        qt,
                        qt.current & 1 | 2
                      ), St && K(e, r.treeForkCount), e.child;
                    }
                    t = t.sibling;
                  }
                r.tail !== null && me() > pl && (e.flags |= 128, c = !0, Fa(r, !1), e.lanes = 4194304);
              }
            else {
              if (!c)
                if (t = Hl(u), t !== null) {
                  if (e.flags |= 128, c = !0, t = t.updateQueue, e.updateQueue = t, Jl(e, t), Fa(r, !0), r.tail === null && r.tailMode === "hidden" && !u.alternate && !St)
                    return jt(e), null;
                } else
                  2 * me() - r.renderingStartTime > pl && n !== 536870912 && (e.flags |= 128, c = !0, Fa(r, !1), e.lanes = 4194304);
              r.isBackwards ? (u.sibling = e.child, e.child = u) : (t = r.last, t !== null ? t.sibling = u : e.child = u, r.last = u);
            }
            return r.tail !== null ? (t = r.tail, r.rendering = t, r.tail = t.sibling, r.renderingStartTime = me(), t.sibling = null, n = qt.current, _(
              qt,
              c ? n & 1 | 2 : n & 1
            ), St && K(e, r.treeForkCount), t) : (jt(e), null);
          case 22:
          case 23:
            return be(e), si(), r = e.memoizedState !== null, t !== null ? t.memoizedState !== null !== r && (e.flags |= 8192) : r && (e.flags |= 8192), r ? (n & 536870912) !== 0 && (e.flags & 128) === 0 && (jt(e), e.subtreeFlags & 6 && (e.flags |= 8192)) : jt(e), n = e.updateQueue, n !== null && Jl(e, n.retryQueue), n = null, t !== null && t.memoizedState !== null && t.memoizedState.cachePool !== null && (n = t.memoizedState.cachePool.pool), r = null, e.memoizedState !== null && e.memoizedState.cachePool !== null && (r = e.memoizedState.cachePool.pool), r !== n && (e.flags |= 2048), t !== null && N(ta), null;
          case 24:
            return n = null, t !== null && (n = t.memoizedState.cache), e.memoizedState.cache !== n && (e.flags |= 2048), Ie(Rt), jt(e), null;
          case 25:
            return null;
          case 30:
            return null;
        }
        throw Error(i(156, e.tag));
      }
      function Bm(t, e) {
        switch (et(e), e.tag) {
          case 1:
            return t = e.flags, t & 65536 ? (e.flags = t & -65537 | 128, e) : null;
          case 3:
            return Ie(Rt), st(), t = e.flags, (t & 65536) !== 0 && (t & 128) === 0 ? (e.flags = t & -65537 | 128, e) : null;
          case 26:
          case 27:
          case 5:
            return Zt(e), null;
          case 31:
            if (e.memoizedState !== null) {
              if (be(e), e.alternate === null)
                throw Error(i(340));
              De();
            }
            return t = e.flags, t & 65536 ? (e.flags = t & -65537 | 128, e) : null;
          case 13:
            if (be(e), t = e.memoizedState, t !== null && t.dehydrated !== null) {
              if (e.alternate === null)
                throw Error(i(340));
              De();
            }
            return t = e.flags, t & 65536 ? (e.flags = t & -65537 | 128, e) : null;
          case 19:
            return N(qt), null;
          case 4:
            return st(), null;
          case 10:
            return Ie(e.type), null;
          case 22:
          case 23:
            return be(e), si(), t !== null && N(ta), t = e.flags, t & 65536 ? (e.flags = t & -65537 | 128, e) : null;
          case 24:
            return Ie(Rt), null;
          case 25:
            return null;
          default:
            return null;
        }
      }
      function Lc(t, e) {
        switch (et(e), e.tag) {
          case 3:
            Ie(Rt), st();
            break;
          case 26:
          case 27:
          case 5:
            Zt(e);
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
            N(qt);
            break;
          case 10:
            Ie(e.type);
            break;
          case 22:
          case 23:
            be(e), si(), t !== null && N(ta);
            break;
          case 24:
            Ie(Rt);
        }
      }
      function Ia(t, e) {
        try {
          var n = e.updateQueue, r = n !== null ? n.lastEffect : null;
          if (r !== null) {
            var c = r.next;
            n = c;
            do {
              if ((n.tag & t) === t) {
                r = void 0;
                var u = n.create, g = n.inst;
                r = u(), g.destroy = r;
              }
              n = n.next;
            } while (n !== c);
          }
        } catch (C) {
          Et(e, e.return, C);
        }
      }
      function xn(t, e, n) {
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
                  var Y = n, Z = C;
                  try {
                    Z();
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
      function Zc(t) {
        var e = t.updateQueue;
        if (e !== null) {
          var n = t.stateNode;
          try {
            Ys(e, n);
          } catch (r) {
            Et(t, t.return, r);
          }
        }
      }
      function Jc(t, e, n) {
        n.props = Ln(
          t.type,
          t.memoizedProps
        ), n.state = t.memoizedState;
        try {
          n.componentWillUnmount();
        } catch (r) {
          Et(t, e, r);
        }
      }
      function Pa(t, e) {
        try {
          var n = t.ref;
          if (n !== null) {
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
            typeof n == "function" ? t.refCleanup = n(r) : n.current = r;
          }
        } catch (c) {
          Et(t, e, c);
        }
      }
      function Qe(t, e) {
        var n = t.ref, r = t.refCleanup;
        if (n !== null)
          if (typeof r == "function")
            try {
              r();
            } catch (c) {
              Et(t, e, c);
            } finally {
              t.refCleanup = null, t = t.alternate, t != null && (t.refCleanup = null);
            }
          else if (typeof n == "function")
            try {
              n(null);
            } catch (c) {
              Et(t, e, c);
            }
          else n.current = null;
      }
      function Wc(t) {
        var e = t.type, n = t.memoizedProps, r = t.stateNode;
        try {
          Mp(r, e, n, t);
        } catch (c) {
          Et(t, t.return, c);
        }
      }
      function Bi(t, e, n) {
        try {
          Ap(
            t.stateNode,
            t.type,
            n,
            e,
            t
          );
        } catch (r) {
          Et(t, t.return, r);
        }
      }
      function Fc(t) {
        return t.tag === 5 || t.tag === 3 || (qe ? t.tag === 26 : !1) || (Vt ? t.tag === 27 && wa(t.type) : !1) || t.tag === 4;
      }
      function Ui(t) {
        t: for (; ; ) {
          for (; t.sibling === null; ) {
            if (t.return === null || Fc(t.return)) return null;
            t = t.return;
          }
          for (t.sibling.return = t.return, t = t.sibling; t.tag !== 5 && t.tag !== 6 && t.tag !== 18; ) {
            if (Vt && t.tag === 27 && wa(t.type) || t.flags & 2 || t.child === null || t.tag === 4) continue t;
            t.child.return = t, t = t.child;
          }
          if (!(t.flags & 2)) return t.stateNode;
        }
      }
      function qi(t, e, n) {
        var r = t.tag;
        if (r === 5 || r === 6)
          t = t.stateNode, e ? Op(n, t, e) : Tp(n, t);
        else if (r !== 4 && (Vt && r === 27 && wa(t.type) && (n = t.stateNode, e = null), t = t.child, t !== null))
          for (qi(t, e, n), t = t.sibling; t !== null; )
            qi(t, e, n), t = t.sibling;
      }
      function Wl(t, e, n) {
        var r = t.tag;
        if (r === 5 || r === 6)
          t = t.stateNode, e ? jp(n, t, e) : Np(n, t);
        else if (r !== 4 && (Vt && r === 27 && wa(t.type) && (n = t.stateNode), t = t.child, t !== null))
          for (Wl(t, e, n), t = t.sibling; t !== null; )
            Wl(t, e, n), t = t.sibling;
      }
      function Ic(t, e, n) {
        t = t.containerInfo;
        try {
          Ju(t, n);
        } catch (r) {
          Et(e, e.return, r);
        }
      }
      function Pc(t) {
        var e = t.stateNode, n = t.memoizedProps;
        try {
          zh(
            t.type,
            n,
            e,
            t
          );
        } catch (r) {
          Et(t, t.return, r);
        }
      }
      function Um(t, e) {
        for (lp(t.containerInfo), Wt = e; Wt !== null; )
          if (t = Wt, e = t.child, (t.subtreeFlags & 1028) !== 0 && e !== null)
            e.return = t, Wt = e;
          else
            for (; Wt !== null; ) {
              t = Wt;
              var n = t.alternate;
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
                  if ((e & 1024) !== 0 && n !== null) {
                    e = void 0, r = t, c = n.memoizedProps, n = n.memoizedState;
                    var u = r.stateNode;
                    try {
                      var g = Ln(
                        r.type,
                        c
                      );
                      e = u.getSnapshotBeforeUpdate(
                        g,
                        n
                      ), u.__reactInternalSnapshotBeforeUpdate = e;
                    } catch (C) {
                      Et(r, r.return, C);
                    }
                  }
                  break;
                case 3:
                  (e & 1024) !== 0 && ie && Yp(t.stateNode.containerInfo);
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
                    throw Error(i(163));
              }
              if (e = t.sibling, e !== null) {
                e.return = t.return, Wt = e;
                break;
              }
              Wt = t.return;
            }
      }
      function $c(t, e, n) {
        var r = n.flags;
        switch (n.tag) {
          case 0:
          case 11:
          case 15:
            tn(t, n), r & 4 && Ia(5, n);
            break;
          case 1:
            if (tn(t, n), r & 4)
              if (t = n.stateNode, e === null)
                try {
                  t.componentDidMount();
                } catch (g) {
                  Et(n, n.return, g);
                }
              else {
                var c = Ln(
                  n.type,
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
                    n,
                    n.return,
                    g
                  );
                }
              }
            r & 64 && Zc(n), r & 512 && Pa(n, n.return);
            break;
          case 3:
            if (tn(t, n), r & 64 && (r = n.updateQueue, r !== null)) {
              if (t = null, n.child !== null)
                switch (n.child.tag) {
                  case 27:
                  case 5:
                    t = nl(n.child.stateNode);
                    break;
                  case 1:
                    t = n.child.stateNode;
                }
              try {
                Ys(r, t);
              } catch (g) {
                Et(n, n.return, g);
              }
            }
            break;
          case 27:
            Vt && e === null && r & 4 && Pc(n);
          case 26:
          case 5:
            if (tn(t, n), e === null) {
              if (r & 4) Wc(n);
              else if (r & 64) {
                t = n.type, e = n.memoizedProps, c = n.stateNode;
                try {
                  ch(
                    c,
                    t,
                    e,
                    n
                  );
                } catch (g) {
                  Et(n, n.return, g);
                }
              }
            }
            r & 512 && Pa(n, n.return);
            break;
          case 12:
            tn(t, n);
            break;
          case 31:
            tn(t, n), r & 4 && eu(t, n);
            break;
          case 13:
            tn(t, n), r & 4 && nu(t, n), r & 64 && (r = n.memoizedState, r !== null && (r = r.dehydrated, r !== null && (n = Xm.bind(
              null,
              n
            ), Vp(r, n))));
            break;
          case 22:
            if (r = n.memoizedState !== null || sn, !r) {
              e = e !== null && e.memoizedState !== null || Kt, c = sn;
              var u = Kt;
              sn = r, (Kt = e) && !u ? en(
                t,
                n,
                (n.subtreeFlags & 8772) !== 0
              ) : tn(t, n), sn = c, Kt = u;
            }
            break;
          case 30:
            break;
          default:
            tn(t, n);
        }
      }
      function tu(t) {
        var e = t.alternate;
        e !== null && (t.alternate = null, tu(e)), t.child = null, t.deletions = null, t.sibling = null, t.tag === 5 && (e = t.stateNode, e !== null && mp(e)), t.stateNode = null, t.return = null, t.dependencies = null, t.memoizedProps = null, t.memoizedState = null, t.pendingProps = null, t.stateNode = null, t.updateQueue = null;
      }
      function Be(t, e, n) {
        for (n = n.child; n !== null; )
          Yi(
            t,
            e,
            n
          ), n = n.sibling;
      }
      function Yi(t, e, n) {
        if (we && typeof we.onCommitFiberUnmount == "function")
          try {
            we.onCommitFiberUnmount(rl, n);
          } catch {
          }
        switch (n.tag) {
          case 26:
            if (qe) {
              Kt || Qe(n, e), Be(
                t,
                e,
                n
              ), n.memoizedState ? nd(n.memoizedState) : n.stateNode && ld(n.stateNode);
              break;
            }
          case 27:
            if (Vt) {
              Kt || Qe(n, e);
              var r = Qt, c = pe;
              wa(n.type) && (Qt = n.stateNode, pe = !1), Be(
                t,
                e,
                n
              ), od(n.stateNode), Qt = r, pe = c;
              break;
            }
          case 5:
            Kt || Qe(n, e);
          case 6:
            if (ie) {
              if (r = Qt, c = pe, Qt = null, Be(
                t,
                e,
                n
              ), Qt = r, pe = c, Qt !== null)
                if (pe)
                  try {
                    Dp(Qt, n.stateNode);
                  } catch (u) {
                    Et(
                      n,
                      e,
                      u
                    );
                  }
                else
                  try {
                    Rp(Qt, n.stateNode);
                  } catch (u) {
                    Et(
                      n,
                      e,
                      u
                    );
                  }
            } else
              Be(
                t,
                e,
                n
              );
            break;
          case 18:
            ie && Qt !== null && (pe ? gh(
              Qt,
              n.stateNode
            ) : hh(Qt, n.stateNode));
            break;
          case 4:
            ie ? (r = Qt, c = pe, Qt = n.stateNode.containerInfo, pe = !0, Be(
              t,
              e,
              n
            ), Qt = r, pe = c) : (Ve && Ic(
              n.stateNode,
              n,
              Lu()
            ), Be(
              t,
              e,
              n
            ));
            break;
          case 0:
          case 11:
          case 14:
          case 15:
            xn(2, n, e), Kt || xn(4, n, e), Be(
              t,
              e,
              n
            );
            break;
          case 1:
            Kt || (Qe(n, e), r = n.stateNode, typeof r.componentWillUnmount == "function" && Jc(
              n,
              e,
              r
            )), Be(
              t,
              e,
              n
            );
            break;
          case 21:
            Be(
              t,
              e,
              n
            );
            break;
          case 22:
            Kt = (r = Kt) || n.memoizedState !== null, Be(
              t,
              e,
              n
            ), Kt = r;
            break;
          default:
            Be(
              t,
              e,
              n
            );
        }
      }
      function eu(t, e) {
        if (oe && e.memoizedState === null && (t = e.alternate, t !== null && (t = t.memoizedState, t !== null))) {
          t = t.dehydrated;
          try {
            dh(t);
          } catch (n) {
            Et(e, e.return, n);
          }
        }
      }
      function nu(t, e) {
        if (oe && e.memoizedState === null && (t = e.alternate, t !== null && (t = t.memoizedState, t !== null && (t = t.dehydrated, t !== null))))
          try {
            fh(t);
          } catch (n) {
            Et(e, e.return, n);
          }
      }
      function qm(t) {
        switch (t.tag) {
          case 31:
          case 13:
          case 19:
            var e = t.stateNode;
            return e === null && (e = t.stateNode = new bd()), e;
          case 22:
            return t = t.stateNode, e = t._retryCache, e === null && (e = t._retryCache = new bd()), e;
          default:
            throw Error(i(435, t.tag));
        }
      }
      function Fl(t, e) {
        var n = qm(t);
        e.forEach(function(r) {
          if (!n.has(r)) {
            n.add(r);
            var c = Lm.bind(null, t, r);
            r.then(c, c);
          }
        });
      }
      function re(t, e) {
        var n = e.deletions;
        if (n !== null)
          for (var r = 0; r < n.length; r++) {
            var c = n[r], u = t, g = e;
            if (ie) {
              var C = g;
              t: for (; C !== null; ) {
                switch (C.tag) {
                  case 27:
                    if (Vt) {
                      if (wa(C.type)) {
                        Qt = C.stateNode, pe = !1;
                        break t;
                      }
                      break;
                    }
                  case 5:
                    Qt = C.stateNode, pe = !1;
                    break t;
                  case 3:
                  case 4:
                    Qt = C.stateNode.containerInfo, pe = !0;
                    break t;
                }
                C = C.return;
              }
              if (Qt === null) throw Error(i(160));
              Yi(u, g, c), Qt = null, pe = !1;
            } else Yi(u, g, c);
            u = c.alternate, u !== null && (u.return = null), c.return = null;
          }
        if (e.subtreeFlags & 13886)
          for (e = e.child; e !== null; )
            au(e, t), e = e.sibling;
      }
      function au(t, e) {
        var n = t.alternate, r = t.flags;
        switch (t.tag) {
          case 0:
          case 11:
          case 14:
          case 15:
            re(e, t), de(t), r & 4 && (xn(3, t, t.return), Ia(3, t), xn(5, t, t.return));
            break;
          case 1:
            re(e, t), de(t), r & 512 && (Kt || n === null || Qe(n, n.return)), r & 64 && sn && (t = t.updateQueue, t !== null && (r = t.callbacks, r !== null && (n = t.shared.hiddenCallbacks, t.shared.hiddenCallbacks = n === null ? r : n.concat(r))));
            break;
          case 26:
            if (qe) {
              var c = Ye;
              if (re(e, t), de(t), r & 512 && (Kt || n === null || Qe(n, n.return)), r & 4) {
                r = n !== null ? n.memoizedState : null;
                var u = t.memoizedState;
                n === null ? u === null ? t.stateNode === null ? t.stateNode = wh(
                  c,
                  t.type,
                  t.memoizedProps,
                  t
                ) : ad(
                  c,
                  t.type,
                  t.stateNode
                ) : t.stateNode = ed(
                  c,
                  u,
                  t.memoizedProps
                ) : r !== u ? (r === null ? n.stateNode !== null && ld(n.stateNode) : nd(r), u === null ? ad(
                  c,
                  t.type,
                  t.stateNode
                ) : ed(
                  c,
                  u,
                  t.memoizedProps
                )) : u === null && t.stateNode !== null && Bi(
                  t,
                  t.memoizedProps,
                  n.memoizedProps
                );
              }
              break;
            }
          case 27:
            if (Vt) {
              re(e, t), de(t), r & 512 && (Kt || n === null || Qe(n, n.return)), n !== null && r & 4 && Bi(
                t,
                t.memoizedProps,
                n.memoizedProps
              );
              break;
            }
          case 5:
            if (re(e, t), de(t), r & 512 && (Kt || n === null || Qe(n, n.return)), ie) {
              if (t.flags & 32) {
                c = t.stateNode;
                try {
                  Xu(c);
                } catch (W) {
                  Et(t, t.return, W);
                }
              }
              r & 4 && t.stateNode != null && (c = t.memoizedProps, Bi(
                t,
                c,
                n !== null ? n.memoizedProps : c
              )), r & 1024 && (Co = !0);
            } else
              Ve && t.alternate !== null && (t.alternate.stateNode = t.stateNode);
            break;
          case 6:
            if (re(e, t), de(t), r & 4 && ie) {
              if (t.stateNode === null)
                throw Error(i(162));
              r = t.memoizedProps, n = n !== null ? n.memoizedProps : r, c = t.stateNode;
              try {
                Cp(c, n, r);
              } catch (W) {
                Et(t, t.return, W);
              }
            }
            break;
          case 3:
            if (qe ? (Sh(), c = Ye, Ye = fo(e.containerInfo), re(e, t), Ye = c) : re(e, t), de(t), r & 4) {
              if (ie && oe && n !== null && n.memoizedState.isDehydrated)
                try {
                  uh(e.containerInfo);
                } catch (W) {
                  Et(t, t.return, W);
                }
              if (Ve) {
                r = e.containerInfo, n = e.pendingChildren;
                try {
                  Ju(r, n);
                } catch (W) {
                  Et(t, t.return, W);
                }
              }
            }
            Co && (Co = !1, lu(t));
            break;
          case 4:
            qe ? (n = Ye, Ye = fo(
              t.stateNode.containerInfo
            ), re(e, t), de(t), Ye = n) : (re(e, t), de(t)), r & 4 && Ve && Ic(
              t.stateNode,
              t,
              t.stateNode.pendingChildren
            );
            break;
          case 12:
            re(e, t), de(t);
            break;
          case 31:
            re(e, t), de(t), r & 4 && (r = t.updateQueue, r !== null && (t.updateQueue = null, Fl(t, r)));
            break;
          case 13:
            re(e, t), de(t), t.child.flags & 8192 && t.memoizedState !== null != (n !== null && n.memoizedState !== null) && (Sr = me()), r & 4 && (r = t.updateQueue, r !== null && (t.updateQueue = null, Fl(t, r)));
            break;
          case 22:
            c = t.memoizedState !== null;
            var g = n !== null && n.memoizedState !== null, C = sn, Y = Kt;
            if (sn = C || c, Kt = Y || g, re(e, t), Kt = Y, sn = C, de(t), r & 8192 && (e = t.stateNode, e._visibility = c ? e._visibility & -2 : e._visibility | 1, c && (n === null || g || sn || Kt || Zn(t)), ie)) {
              t: if (n = null, ie)
                for (e = t; ; ) {
                  if (e.tag === 5 || qe && e.tag === 26) {
                    if (n === null) {
                      g = n = e;
                      try {
                        u = g.stateNode, c ? Hp(u) : Up(
                          g.stateNode,
                          g.memoizedProps
                        );
                      } catch (W) {
                        Et(g, g.return, W);
                      }
                    }
                  } else if (e.tag === 6) {
                    if (n === null) {
                      g = e;
                      try {
                        var Z = g.stateNode;
                        c ? Bp(Z) : qp(Z, g.memoizedProps);
                      } catch (W) {
                        Et(g, g.return, W);
                      }
                    }
                  } else if (e.tag === 18) {
                    if (n === null) {
                      g = e;
                      try {
                        var P = g.stateNode;
                        c ? bh(P) : vh(g.stateNode);
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
                    n === e && (n = null), e = e.return;
                  }
                  n === e && (n = null), e.sibling.return = e.return, e = e.sibling;
                }
            }
            r & 4 && (r = t.updateQueue, r !== null && (n = r.retryQueue, n !== null && (r.retryQueue = null, Fl(t, n))));
            break;
          case 19:
            re(e, t), de(t), r & 4 && (r = t.updateQueue, r !== null && (t.updateQueue = null, Fl(t, r)));
            break;
          case 30:
            break;
          case 21:
            break;
          default:
            re(e, t), de(t);
        }
      }
      function de(t) {
        var e = t.flags;
        if (e & 2) {
          try {
            for (var n, r = t.return; r !== null; ) {
              if (Fc(r)) {
                n = r;
                break;
              }
              r = r.return;
            }
            if (ie) {
              if (n == null) throw Error(i(160));
              switch (n.tag) {
                case 27:
                  if (Vt) {
                    var c = n.stateNode, u = Ui(t);
                    Wl(t, u, c);
                    break;
                  }
                case 5:
                  var g = n.stateNode;
                  n.flags & 32 && (Xu(g), n.flags &= -33);
                  var C = Ui(t);
                  Wl(t, C, g);
                  break;
                case 3:
                case 4:
                  var Y = n.stateNode.containerInfo, Z = Ui(t);
                  qi(
                    t,
                    Z,
                    Y
                  );
                  break;
                default:
                  throw Error(i(161));
              }
            }
          } catch (P) {
            Et(t, t.return, P);
          }
          t.flags &= -3;
        }
        e & 4096 && (t.flags &= -4097);
      }
      function lu(t) {
        if (t.subtreeFlags & 1024)
          for (t = t.child; t !== null; ) {
            var e = t;
            lu(e), e.tag === 5 && e.flags & 1024 && vp(e.stateNode), t = t.sibling;
          }
      }
      function tn(t, e) {
        if (e.subtreeFlags & 8772)
          for (e = e.child; e !== null; )
            $c(t, e.alternate, e), e = e.sibling;
      }
      function Zn(t) {
        for (t = t.child; t !== null; ) {
          var e = t;
          switch (e.tag) {
            case 0:
            case 11:
            case 14:
            case 15:
              xn(4, e, e.return), Zn(e);
              break;
            case 1:
              Qe(e, e.return);
              var n = e.stateNode;
              typeof n.componentWillUnmount == "function" && Jc(
                e,
                e.return,
                n
              ), Zn(e);
              break;
            case 27:
              Vt && od(e.stateNode);
            case 26:
            case 5:
              Qe(e, e.return), Zn(e);
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
      function en(t, e, n) {
        for (n = n && (e.subtreeFlags & 8772) !== 0, e = e.child; e !== null; ) {
          var r = e.alternate, c = t, u = e, g = u.flags;
          switch (u.tag) {
            case 0:
            case 11:
            case 15:
              en(
                c,
                u,
                n
              ), Ia(4, u);
              break;
            case 1:
              if (en(
                c,
                u,
                n
              ), r = u, c = r.stateNode, typeof c.componentDidMount == "function")
                try {
                  c.componentDidMount();
                } catch (Z) {
                  Et(r, r.return, Z);
                }
              if (r = u, c = r.updateQueue, c !== null) {
                var C = r.stateNode;
                try {
                  var Y = c.shared.hiddenCallbacks;
                  if (Y !== null)
                    for (c.shared.hiddenCallbacks = null, c = 0; c < Y.length; c++)
                      qs(Y[c], C);
                } catch (Z) {
                  Et(r, r.return, Z);
                }
              }
              n && g & 64 && Zc(u), Pa(u, u.return);
              break;
            case 27:
              Vt && Pc(u);
            case 26:
            case 5:
              en(
                c,
                u,
                n
              ), n && r === null && g & 4 && Wc(u), Pa(u, u.return);
              break;
            case 12:
              en(
                c,
                u,
                n
              );
              break;
            case 31:
              en(
                c,
                u,
                n
              ), n && g & 4 && eu(c, u);
              break;
            case 13:
              en(
                c,
                u,
                n
              ), n && g & 4 && nu(c, u);
              break;
            case 22:
              u.memoizedState === null && en(
                c,
                u,
                n
              ), Pa(u, u.return);
              break;
            case 30:
              break;
            default:
              en(
                c,
                u,
                n
              );
          }
          e = e.sibling;
        }
      }
      function Gi(t, e) {
        var n = null;
        t !== null && t.memoizedState !== null && t.memoizedState.cachePool !== null && (n = t.memoizedState.cachePool.pool), t = null, e.memoizedState !== null && e.memoizedState.cachePool !== null && (t = e.memoizedState.cachePool.pool), t !== n && (t != null && t.refCount++, n != null && Ka(n));
      }
      function Ki(t, e) {
        t = null, e.alternate !== null && (t = e.alternate.memoizedState.cache), e = e.memoizedState.cache, e !== t && (e.refCount++, t != null && Ka(t));
      }
      function Ue(t, e, n, r) {
        if (e.subtreeFlags & 10256)
          for (e = e.child; e !== null; )
            ru(
              t,
              e,
              n,
              r
            ), e = e.sibling;
      }
      function ru(t, e, n, r) {
        var c = e.flags;
        switch (e.tag) {
          case 0:
          case 11:
          case 15:
            Ue(
              t,
              e,
              n,
              r
            ), c & 2048 && Ia(9, e);
            break;
          case 1:
            Ue(
              t,
              e,
              n,
              r
            );
            break;
          case 3:
            Ue(
              t,
              e,
              n,
              r
            ), c & 2048 && (t = null, e.alternate !== null && (t = e.alternate.memoizedState.cache), e = e.memoizedState.cache, e !== t && (e.refCount++, t != null && Ka(t)));
            break;
          case 12:
            if (c & 2048) {
              Ue(
                t,
                e,
                n,
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
                Et(e, e.return, Y);
              }
            } else
              Ue(
                t,
                e,
                n,
                r
              );
            break;
          case 31:
            Ue(
              t,
              e,
              n,
              r
            );
            break;
          case 13:
            Ue(
              t,
              e,
              n,
              r
            );
            break;
          case 23:
            break;
          case 22:
            u = e.stateNode, g = e.alternate, e.memoizedState !== null ? u._visibility & 2 ? Ue(
              t,
              e,
              n,
              r
            ) : $a(
              t,
              e
            ) : u._visibility & 2 ? Ue(
              t,
              e,
              n,
              r
            ) : (u._visibility |= 2, ha(
              t,
              e,
              n,
              r,
              (e.subtreeFlags & 10256) !== 0 || !1
            )), c & 2048 && Gi(g, e);
            break;
          case 24:
            Ue(
              t,
              e,
              n,
              r
            ), c & 2048 && Ki(e.alternate, e);
            break;
          default:
            Ue(
              t,
              e,
              n,
              r
            );
        }
      }
      function ha(t, e, n, r, c) {
        for (c = c && ((e.subtreeFlags & 10256) !== 0 || !1), e = e.child; e !== null; ) {
          var u = t, g = e, C = n, Y = r, Z = g.flags;
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
              var P = g.stateNode;
              g.memoizedState !== null ? P._visibility & 2 ? ha(
                u,
                g,
                C,
                Y,
                c
              ) : $a(
                u,
                g
              ) : (P._visibility |= 2, ha(
                u,
                g,
                C,
                Y,
                c
              )), c && Z & 2048 && Gi(
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
              ), c && Z & 2048 && Ki(g.alternate, g);
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
      function $a(t, e) {
        if (e.subtreeFlags & 10256)
          for (e = e.child; e !== null; ) {
            var n = t, r = e, c = r.flags;
            switch (r.tag) {
              case 22:
                $a(n, r), c & 2048 && Gi(
                  r.alternate,
                  r
                );
                break;
              case 24:
                $a(n, r), c & 2048 && Ki(
                  r.alternate,
                  r
                );
                break;
              default:
                $a(n, r);
            }
            e = e.sibling;
          }
      }
      function Jn(t, e, n) {
        if (t.subtreeFlags & Da)
          for (t = t.child; t !== null; )
            iu(
              t,
              e,
              n
            ), t = t.sibling;
      }
      function iu(t, e, n) {
        switch (t.tag) {
          case 26:
            if (Jn(
              t,
              e,
              n
            ), t.flags & Da)
              if (t.memoizedState !== null)
                Eh(
                  n,
                  Ye,
                  t.memoizedState,
                  t.memoizedProps
                );
              else {
                var r = t.stateNode, c = t.type;
                t = t.memoizedProps, ((e & 335544128) === e || so(c, t)) && Vu(n, r, c, t);
              }
            break;
          case 5:
            Jn(
              t,
              e,
              n
            ), t.flags & Da && (r = t.stateNode, c = t.type, t = t.memoizedProps, ((e & 335544128) === e || so(c, t)) && Vu(n, r, c, t));
            break;
          case 3:
          case 4:
            qe ? (r = Ye, Ye = fo(
              t.stateNode.containerInfo
            ), Jn(
              t,
              e,
              n
            ), Ye = r) : Jn(
              t,
              e,
              n
            );
            break;
          case 22:
            t.memoizedState === null && (r = t.alternate, r !== null && r.memoizedState !== null ? (r = Da, Da = 16777216, Jn(
              t,
              e,
              n
            ), Da = r) : Jn(
              t,
              e,
              n
            ));
            break;
          default:
            Jn(
              t,
              e,
              n
            );
        }
      }
      function ou(t) {
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
            for (var n = 0; n < e.length; n++) {
              var r = e[n];
              Wt = r, cu(
                r,
                t
              );
            }
          ou(t);
        }
        if (t.subtreeFlags & 10256)
          for (t = t.child; t !== null; )
            su(t), t = t.sibling;
      }
      function su(t) {
        switch (t.tag) {
          case 0:
          case 11:
          case 15:
            tl(t), t.flags & 2048 && xn(9, t, t.return);
            break;
          case 3:
            tl(t);
            break;
          case 12:
            tl(t);
            break;
          case 22:
            var e = t.stateNode;
            t.memoizedState !== null && e._visibility & 2 && (t.return === null || t.return.tag !== 13) ? (e._visibility &= -3, Il(t)) : tl(t);
            break;
          default:
            tl(t);
        }
      }
      function Il(t) {
        var e = t.deletions;
        if ((t.flags & 16) !== 0) {
          if (e !== null)
            for (var n = 0; n < e.length; n++) {
              var r = e[n];
              Wt = r, cu(
                r,
                t
              );
            }
          ou(t);
        }
        for (t = t.child; t !== null; ) {
          switch (e = t, e.tag) {
            case 0:
            case 11:
            case 15:
              xn(8, e, e.return), Il(e);
              break;
            case 22:
              n = e.stateNode, n._visibility & 2 && (n._visibility &= -3, Il(e));
              break;
            default:
              Il(e);
          }
          t = t.sibling;
        }
      }
      function cu(t, e) {
        for (; Wt !== null; ) {
          var n = Wt;
          switch (n.tag) {
            case 0:
            case 11:
            case 15:
              xn(8, n, e);
              break;
            case 23:
            case 22:
              if (n.memoizedState !== null && n.memoizedState.cachePool !== null) {
                var r = n.memoizedState.cachePool.pool;
                r != null && r.refCount++;
              }
              break;
            case 24:
              Ka(n.memoizedState.cache);
          }
          if (r = n.child, r !== null) r.return = n, Wt = r;
          else
            t: for (n = t; Wt !== null; ) {
              r = Wt;
              var c = r.sibling, u = r.return;
              if (tu(r), r === n) {
                Wt = null;
                break t;
              }
              if (c !== null) {
                c.return = u, Wt = c;
                break t;
              }
              Wt = u;
            }
        }
      }
      function Qi(t) {
        var e = cp(t);
        if (e != null) {
          if (typeof e.memoizedProps["data-testname"] != "string")
            throw Error(i(364));
          return e;
        }
        if (t = wp(t), t === null) throw Error(i(362));
        return t.stateNode.current;
      }
      function Vi(t, e) {
        var n = t.tag;
        switch (e.$$typeof) {
          case vr:
            if (t.type === e.value) return !0;
            break;
          case yr:
            t: {
              for (e = e.value, t = [t, 0], n = 0; n < t.length; ) {
                var r = t[n++], c = r.tag, u = t[n++], g = e[u];
                if (c !== 5 && c !== 26 && c !== 27 || !ll(r)) {
                  for (; g != null && Vi(r, g); )
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
          case xr:
            if ((n === 5 || n === 26 || n === 27) && kp(t.stateNode, e.value))
              return !0;
            break;
          case _r:
            if ((n === 5 || n === 6 || n === 26 || n === 27) && (t = Sp(t), t !== null && 0 <= t.indexOf(e.value)))
              return !0;
            break;
          case wr:
            if ((n === 5 || n === 26 || n === 27) && (t = t.memoizedProps["data-testname"], typeof t == "string" && t.toLowerCase() === e.value.toLowerCase()))
              return !0;
            break;
          default:
            throw Error(i(365));
        }
        return !1;
      }
      function Xi(t) {
        switch (t.$$typeof) {
          case vr:
            return "<" + (k(t.value) || "Unknown") + ">";
          case yr:
            return ":has(" + (Xi(t) || "") + ")";
          case xr:
            return '[role="' + t.value + '"]';
          case _r:
            return '"' + t.value + '"';
          case wr:
            return '[data-testname="' + t.value + '"]';
          default:
            throw Error(i(365));
        }
      }
      function uu(t, e) {
        var n = [];
        t = [t, 0];
        for (var r = 0; r < t.length; ) {
          var c = t[r++], u = c.tag, g = t[r++], C = e[g];
          if (u !== 5 && u !== 26 && u !== 27 || !ll(c)) {
            for (; C != null && Vi(c, C); )
              g++, C = e[g];
            if (g === e.length) n.push(c);
            else
              for (c = c.child; c !== null; )
                t.push(c, g), c = c.sibling;
          }
        }
        return n;
      }
      function Li(t, e) {
        if (!al) throw Error(i(363));
        t = Qi(t), t = uu(t, e), e = [], t = Array.from(t);
        for (var n = 0; n < t.length; ) {
          var r = t[n++], c = r.tag;
          if (c === 5 || c === 26 || c === 27)
            ll(r) || e.push(r.stateNode);
          else
            for (r = r.child; r !== null; )
              t.push(r), r = r.sibling;
        }
        return e;
      }
      function ve() {
        return (xt & 2) !== 0 && _t !== 0 ? _t & -_t : ct.T !== null ? ei() : dp();
      }
      function du() {
        if (Ee === 0)
          if ((_t & 536870912) === 0 || St) {
            var t = rr;
            rr <<= 1, (rr & 3932160) === 0 && (rr = 262144), Ee = t;
          } else Ee = 536870912;
        return t = Se.current, t !== null && (t.flags |= 32), Ee;
      }
      function fe(t, e, n) {
        (t === At && (Ct === 2 || Ct === 9) || t.cancelPendingCommit !== null) && (ga(t, 0), wn(
          t,
          _t,
          Ee,
          !1
        )), O(t, n), ((xt & 2) === 0 || t !== At) && (t === At && ((xt & 2) === 0 && (la |= n), Bt === 4 && wn(
          t,
          _t,
          Ee,
          !1
        )), Ke(t));
      }
      function fu(t, e, n) {
        if ((xt & 6) !== 0) throw Error(i(327));
        var r = !n && (e & 127) === 0 && (e & t.expiredLanes) === 0 || D(t, e), c = r ? Km(t, e) : Ji(t, e, !0), u = r;
        do {
          if (c === 0) {
            Ha && !r && wn(t, e, 0, !1);
            break;
          } else {
            if (n = t.current.alternate, u && !Ym(n)) {
              c = Ji(t, e, !1), u = !1;
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
                  var Y = oe && C.current.memoizedState.isDehydrated;
                  if (Y && (ga(C, g).flags |= 256), g = Ji(
                    C,
                    g,
                    !1
                  ), g !== 2) {
                    if (Mo && !Y) {
                      C.errorRecoveryDisabledLanes |= u, la |= u, c = 4;
                      break t;
                    }
                    u = he, he = c, u !== null && (he === null ? he = u : he.push.apply(
                      he,
                      u
                    ));
                  }
                  c = g;
                }
                if (u = !1, c !== 2) continue;
              }
            }
            if (c === 1) {
              ga(t, 0), wn(t, e, 0, !0);
              break;
            }
            t: {
              switch (r = t, u = c, u) {
                case 0:
                case 1:
                  throw Error(i(345));
                case 4:
                  if ((e & 4194048) !== e) break;
                case 6:
                  wn(
                    r,
                    e,
                    Ee,
                    !Tn
                  );
                  break t;
                case 2:
                  he = null;
                  break;
                case 3:
                case 5:
                  break;
                default:
                  throw Error(i(329));
              }
              if ((e & 62914560) === e && (c = Sr + 300 - me(), 10 < c)) {
                if (wn(
                  r,
                  e,
                  Ee,
                  !Tn
                ), R(r, 0, !0) !== 0) break t;
                un = e, r.timeoutHandle = op(
                  mu.bind(
                    null,
                    r,
                    n,
                    he,
                    kr,
                    jo,
                    e,
                    Ee,
                    la,
                    Ba,
                    Tn,
                    u,
                    "Throttled",
                    -0,
                    0
                  ),
                  c
                );
                break t;
              }
              mu(
                r,
                n,
                he,
                kr,
                jo,
                e,
                Ee,
                la,
                Ba,
                Tn,
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
      function mu(t, e, n, r, c, u, g, C, Y, Z, P, W, nt, gt) {
        if (t.timeoutHandle = Fn, W = e.subtreeFlags, W & 8192 || (W & 16785408) === 16785408) {
          W = gp(), iu(
            e,
            u,
            W
          );
          var ne = (u & 62914560) === u ? Sr - me() : (u & 4194048) === u ? vd - me() : 0;
          if (ne = bp(
            W,
            ne
          ), ne !== null) {
            un = u, t.cancelPendingCommit = ne(
              _u.bind(
                null,
                t,
                e,
                u,
                n,
                r,
                c,
                g,
                C,
                Y,
                P,
                W,
                null,
                nt,
                gt
              )
            ), wn(t, u, g, !Z);
            return;
          }
        }
        _u(
          t,
          e,
          u,
          n,
          r,
          c,
          g,
          C,
          Y
        );
      }
      function Ym(t) {
        for (var e = t; ; ) {
          var n = e.tag;
          if ((n === 0 || n === 11 || n === 15) && e.flags & 16384 && (n = e.updateQueue, n !== null && (n = n.stores, n !== null)))
            for (var r = 0; r < n.length; r++) {
              var c = n[r], u = c.getSnapshot;
              c = c.value;
              try {
                if (!_e(u(), c)) return !1;
              } catch {
                return !1;
              }
            }
          if (n = e.child, e.subtreeFlags & 16384 && n !== null)
            n.return = e, e = n;
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
      function wn(t, e, n, r) {
        e &= ~Ao, e &= ~la, t.suspendedLanes |= e, t.pingedLanes &= ~e, r && (t.warmLanes |= e), r = t.expirationTimes;
        for (var c = e; 0 < c; ) {
          var u = 31 - xe(c), g = 1 << u;
          r[u] = -1, c &= ~g;
        }
        n !== 0 && p(t, n, e);
      }
      function pu() {
        return (xt & 6) === 0 ? (ma(0), !1) : !0;
      }
      function Zi() {
        if (wt !== null) {
          if (Ct === 0)
            var t = wt.return;
          else
            t = wt, rn = Pn = null, pi(t), Ma = null, cl = 0, t = wt;
          for (; t !== null; )
            Lc(t.alternate, t), t = t.return;
          wt = null;
        }
      }
      function ga(t, e) {
        var n = t.timeoutHandle;
        n !== Fn && (t.timeoutHandle = Fn, sp(n)), n = t.cancelPendingCommit, n !== null && (t.cancelPendingCommit = null, n()), un = 0, Zi(), At = t, wt = n = nn(t.current, null), _t = e, Ct = 0, ke = null, Tn = !1, Ha = D(t, e), Mo = !1, Ba = Ee = Ao = la = Cn = Bt = 0, he = ml = null, jo = !1, (e & 8) !== 0 && (e |= e & 32);
        var r = t.entangledLanes;
        if (r !== 0)
          for (t = t.entanglements, r &= e; 0 < r; ) {
            var c = 31 - xe(r), u = 1 << c;
            e |= t[c], r &= ~u;
          }
        return cn = e, Ol(), n;
      }
      function hu(t, e) {
        bt = null, ct.H = dl, e === Ca || e === mr ? (e = Ds(), Ct = 3) : e === _o ? (e = Ds(), Ct = 4) : Ct = e === No ? 8 : e !== null && typeof e == "object" && typeof e.then == "function" ? 6 : 1, ke = e, wt === null && (Bt = 1, Ql(
          t,
          G(e, t.current)
        ));
      }
      function gu() {
        var t = Se.current;
        return t === null ? !0 : (_t & 4194048) === _t ? je === null : (_t & 62914560) === _t || (_t & 536870912) !== 0 ? t === je : !1;
      }
      function bu() {
        var t = ct.H;
        return ct.H = dl, t === null ? dl : t;
      }
      function vu() {
        var t = ct.A;
        return ct.A = Yh, t;
      }
      function Pl() {
        Bt = 4, Tn || (_t & 4194048) !== _t && Se.current !== null || (Ha = !0), (Cn & 134217727) === 0 && (la & 134217727) === 0 || At === null || wn(
          At,
          _t,
          Ee,
          !1
        );
      }
      function Ji(t, e, n) {
        var r = xt;
        xt |= 2;
        var c = bu(), u = vu();
        (At !== t || _t !== e) && (kr = null, ga(t, e)), e = !1;
        var g = Bt;
        t: do
          try {
            if (Ct !== 0 && wt !== null) {
              var C = wt, Y = ke;
              switch (Ct) {
                case 8:
                  Zi(), g = 6;
                  break t;
                case 3:
                case 2:
                case 9:
                case 6:
                  Se.current === null && (e = !0);
                  var Z = Ct;
                  if (Ct = 0, ke = null, ba(t, C, Y, Z), n && Ha) {
                    g = 0;
                    break t;
                  }
                  break;
                default:
                  Z = Ct, Ct = 0, ke = null, ba(t, C, Y, Z);
              }
            }
            Gm(), g = Bt;
            break;
          } catch (P) {
            hu(t, P);
          }
        while (!0);
        return e && t.shellSuspendCounter++, rn = Pn = null, xt = r, ct.H = c, ct.A = u, wt === null && (At = null, _t = 0, Ol()), g;
      }
      function Gm() {
        for (; wt !== null; ) yu(wt);
      }
      function Km(t, e) {
        var n = xt;
        xt |= 2;
        var r = bu(), c = vu();
        At !== t || _t !== e ? (kr = null, pl = me() + 500, ga(t, e)) : Ha = D(
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
                  if (Os(u)) {
                    Ct = 0, ke = null, xu(e);
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
                  Os(u) ? (Ct = 0, ke = null, xu(e)) : (Ct = 0, ke = null, ba(t, e, u, 7));
                  break;
                case 5:
                  var g = null;
                  switch (wt.tag) {
                    case 26:
                      g = wt.memoizedState;
                    case 5:
                    case 27:
                      var C = wt, Y = C.type, Z = C.pendingProps;
                      if (g ? rd(g) : Qu(C.stateNode, Y, Z)) {
                        Ct = 0, ke = null;
                        var P = C.sibling;
                        if (P !== null) wt = P;
                        else {
                          var W = C.return;
                          W !== null ? (wt = W, $l(W)) : wt = null;
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
                  Zi(), Bt = 6;
                  break t;
                default:
                  throw Error(i(462));
              }
            }
            Qm();
            break;
          } catch (nt) {
            hu(t, nt);
          }
        while (!0);
        return rn = Pn = null, ct.H = r, ct.A = c, xt = n, wt !== null ? 0 : (At = null, _t = 0, Ol(), Bt);
      }
      function Qm() {
        for (; wt !== null && !Ch(); )
          yu(wt);
      }
      function yu(t) {
        var e = Gc(
          t.alternate,
          t,
          cn
        );
        t.memoizedProps = t.pendingProps, e === null ? $l(t) : wt = e;
      }
      function xu(t) {
        var e = t, n = e.alternate;
        switch (e.tag) {
          case 15:
          case 0:
            e = Dc(
              n,
              e,
              e.pendingProps,
              e.type,
              void 0,
              _t
            );
            break;
          case 11:
            e = Dc(
              n,
              e,
              e.pendingProps,
              e.type.render,
              e.ref,
              _t
            );
            break;
          case 5:
            pi(e);
          default:
            Lc(n, e), e = wt = Mu(e, cn), e = Gc(n, e, cn);
        }
        t.memoizedProps = t.pendingProps, e === null ? $l(t) : wt = e;
      }
      function ba(t, e, n, r) {
        rn = Pn = null, pi(e), Ma = null, cl = 0;
        var c = e.return;
        try {
          if (Om(
            t,
            c,
            e,
            n,
            _t
          )) {
            Bt = 1, Ql(
              t,
              G(n, t.current)
            ), wt = null;
            return;
          }
        } catch (u) {
          if (c !== null) throw wt = c, u;
          Bt = 1, Ql(
            t,
            G(n, t.current)
          ), wt = null;
          return;
        }
        e.flags & 32768 ? (St || r === 1 ? t = !0 : Ha || (_t & 536870912) !== 0 ? t = !1 : (Tn = t = !0, (r === 2 || r === 9 || r === 3 || r === 6) && (r = Se.current, r !== null && r.tag === 13 && (r.flags |= 16384))), wu(e, t)) : $l(e);
      }
      function $l(t) {
        var e = t;
        do {
          if ((e.flags & 32768) !== 0) {
            wu(
              e,
              Tn
            );
            return;
          }
          t = e.return;
          var n = Hm(
            e.alternate,
            e,
            cn
          );
          if (n !== null) {
            wt = n;
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
      function wu(t, e) {
        do {
          var n = Bm(t.alternate, t);
          if (n !== null) {
            n.flags &= 32767, wt = n;
            return;
          }
          if (n = t.return, n !== null && (n.flags |= 32768, n.subtreeFlags = 0, n.deletions = null), !e && (t = t.sibling, t !== null)) {
            wt = t;
            return;
          }
          wt = t = n;
        } while (t !== null);
        Bt = 6, wt = null;
      }
      function _u(t, e, n, r, c, u, g, C, Y) {
        t.cancelPendingCommit = null;
        do
          el();
        while (Xt !== 0);
        if ((xt & 6) !== 0) throw Error(i(327));
        if (e !== null) {
          if (e === t.current)
            throw Error(i(177));
          if (u = e.lanes | e.childLanes, u |= So, h(
            t,
            n,
            u,
            g,
            C,
            Y
          ), t === At && (wt = At = null, _t = 0), Ua = e, An = t, un = n, Oo = u, Ro = c, yd = r, (e.subtreeFlags & 10256) !== 0 || (e.flags & 10256) !== 0 ? (t.callbackNode = null, t.callbackPriority = 0, Zm(ho, function() {
            return Nu(), null;
          })) : (t.callbackNode = null, t.callbackPriority = 0), r = (e.flags & 13878) !== 0, (e.subtreeFlags & 13878) !== 0 || r) {
            r = ct.T, ct.T = null, c = ln(), Jt(2), g = xt, xt |= 4;
            try {
              Um(t, e, n);
            } finally {
              xt = g, Jt(c), ct.T = r;
            }
          }
          Xt = 1, Su(), ku(), Eu();
        }
      }
      function Su() {
        if (Xt === 1) {
          Xt = 0;
          var t = An, e = Ua, n = (e.flags & 13878) !== 0;
          if ((e.subtreeFlags & 13878) !== 0 || n) {
            n = ct.T, ct.T = null;
            var r = ln();
            Jt(2);
            var c = xt;
            xt |= 4;
            try {
              au(e, t), rp(t.containerInfo);
            } finally {
              xt = c, Jt(r), ct.T = n;
            }
          }
          t.current = e, Xt = 2;
        }
      }
      function ku() {
        if (Xt === 2) {
          Xt = 0;
          var t = An, e = Ua, n = (e.flags & 8772) !== 0;
          if ((e.subtreeFlags & 8772) !== 0 || n) {
            n = ct.T, ct.T = null;
            var r = ln();
            Jt(2);
            var c = xt;
            xt |= 4;
            try {
              $c(t, e.alternate, e);
            } finally {
              xt = c, Jt(r), ct.T = n;
            }
          }
          Xt = 3;
        }
      }
      function Eu() {
        if (Xt === 4 || Xt === 3) {
          Xt = 0, Mh();
          var t = An, e = Ua, n = un, r = yd;
          (e.subtreeFlags & 10256) !== 0 || (e.flags & 10256) !== 0 ? Xt = 5 : (Xt = 0, Ua = An = null, zu(t, t.pendingLanes));
          var c = t.pendingLanes;
          if (c === 0 && (Mn = null), H(n), e = e.stateNode, we && typeof we.onCommitFiberRoot == "function")
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
            e = ct.T, c = ln(), Jt(2), ct.T = null;
            try {
              for (var u = t.onRecoverableError, g = 0; g < r.length; g++) {
                var C = r[g];
                u(C.value, {
                  componentStack: C.stack
                });
              }
            } finally {
              ct.T = e, Jt(c);
            }
          }
          (un & 3) !== 0 && el(), Ke(t), c = t.pendingLanes, (n & 261930) !== 0 && (c & 42) !== 0 ? t === Do ? hl++ : (hl = 0, Do = t) : hl = 0, oe && ph(), ma(0);
        }
      }
      function zu(t, e) {
        (t.pooledCacheLanes &= e) === 0 && (e = t.pooledCache, e != null && (t.pooledCache = null, Ka(e)));
      }
      function el() {
        return Su(), ku(), Eu(), Nu();
      }
      function Nu() {
        if (Xt !== 5) return !1;
        var t = An, e = Oo;
        Oo = 0;
        var n = H(un), r = 32 > n ? 32 : n;
        n = ct.T;
        var c = ln();
        try {
          Jt(r), ct.T = null, r = Ro, Ro = null;
          var u = An, g = un;
          if (Xt = 0, Ua = An = null, un = 0, (xt & 6) !== 0)
            throw Error(i(331));
          var C = xt;
          if (xt |= 4, su(u.current), ru(
            u,
            u.current,
            g,
            r
          ), xt = C, ma(0, !1), we && typeof we.onPostCommitFiberRoot == "function")
            try {
              we.onPostCommitFiberRoot(rl, u);
            } catch {
            }
          return !0;
        } finally {
          Jt(c), ct.T = n, zu(t, e);
        }
      }
      function Tu(t, e, n) {
        e = G(n, e), e = zi(t.stateNode, e, 2), t = bn(t, e, 2), t !== null && (O(t, 2), Ke(t));
      }
      function Et(t, e, n) {
        if (t.tag === 3)
          Tu(t, t, n);
        else
          for (; e !== null; ) {
            if (e.tag === 3) {
              Tu(
                e,
                t,
                n
              );
              break;
            } else if (e.tag === 1) {
              var r = e.stateNode;
              if (typeof e.type.getDerivedStateFromError == "function" || typeof r.componentDidCatch == "function" && (Mn === null || !Mn.has(r))) {
                t = G(n, t), n = Nc(2), r = bn(e, n, 2), r !== null && (Tc(
                  n,
                  r,
                  e,
                  t
                ), O(r, 2), Ke(r));
                break;
              }
            }
            e = e.return;
          }
      }
      function Wi(t, e, n) {
        var r = t.pingCache;
        if (r === null) {
          r = t.pingCache = new Gh();
          var c = /* @__PURE__ */ new Set();
          r.set(e, c);
        } else
          c = r.get(e), c === void 0 && (c = /* @__PURE__ */ new Set(), r.set(e, c));
        c.has(n) || (Mo = !0, c.add(n), t = Vm.bind(null, t, e, n), e.then(t, t));
      }
      function Vm(t, e, n) {
        var r = t.pingCache;
        r !== null && r.delete(e), t.pingedLanes |= t.suspendedLanes & n, t.warmLanes &= ~n, At === t && (_t & n) === n && (Bt === 4 || Bt === 3 && (_t & 62914560) === _t && 300 > me() - Sr ? (xt & 2) === 0 && ga(t, 0) : Ao |= n, Ba === _t && (Ba = 0)), Ke(t);
      }
      function Cu(t, e) {
        e === 0 && (e = X()), t = Xn(t, e), t !== null && (O(t, e), Ke(t));
      }
      function Xm(t) {
        var e = t.memoizedState, n = 0;
        e !== null && (n = e.retryLane), Cu(t, n);
      }
      function Lm(t, e) {
        var n = 0;
        switch (t.tag) {
          case 31:
          case 13:
            var r = t.stateNode, c = t.memoizedState;
            c !== null && (n = c.retryLane);
            break;
          case 19:
            r = t.stateNode;
            break;
          case 22:
            r = t.stateNode._retryCache;
            break;
          default:
            throw Error(i(314));
        }
        r !== null && r.delete(e), Cu(t, n);
      }
      function Zm(t, e) {
        return or(t, e);
      }
      function Jm(t, e, n, r) {
        this.tag = t, this.key = n, this.sibling = this.child = this.return = this.stateNode = this.type = this.elementType = null, this.index = 0, this.refCleanup = this.ref = null, this.pendingProps = e, this.dependencies = this.memoizedState = this.updateQueue = this.memoizedProps = null, this.mode = r, this.subtreeFlags = this.flags = 0, this.deletions = null, this.childLanes = this.lanes = 0, this.alternate = null;
      }
      function Fi(t) {
        return t = t.prototype, !(!t || !t.isReactComponent);
      }
      function nn(t, e) {
        var n = t.alternate;
        return n === null ? (n = s(
          t.tag,
          e,
          t.key,
          t.mode
        ), n.elementType = t.elementType, n.type = t.type, n.stateNode = t.stateNode, n.alternate = t, t.alternate = n) : (n.pendingProps = e, n.type = t.type, n.flags = 0, n.subtreeFlags = 0, n.deletions = null), n.flags = t.flags & 65011712, n.childLanes = t.childLanes, n.lanes = t.lanes, n.child = t.child, n.memoizedProps = t.memoizedProps, n.memoizedState = t.memoizedState, n.updateQueue = t.updateQueue, e = t.dependencies, n.dependencies = e === null ? null : {
          lanes: e.lanes,
          firstContext: e.firstContext
        }, n.sibling = t.sibling, n.index = t.index, n.ref = t.ref, n.refCleanup = t.refCleanup, n;
      }
      function Mu(t, e) {
        t.flags &= 65011714;
        var n = t.alternate;
        return n === null ? (t.childLanes = 0, t.lanes = e, t.child = null, t.subtreeFlags = 0, t.memoizedProps = null, t.memoizedState = null, t.updateQueue = null, t.dependencies = null, t.stateNode = null) : (t.childLanes = n.childLanes, t.lanes = n.lanes, t.child = n.child, t.subtreeFlags = 0, t.deletions = null, t.memoizedProps = n.memoizedProps, t.memoizedState = n.memoizedState, t.updateQueue = n.updateQueue, t.type = n.type, e = n.dependencies, t.dependencies = e === null ? null : {
          lanes: e.lanes,
          firstContext: e.firstContext
        }), t;
      }
      function tr(t, e, n, r, c, u) {
        var g = 0;
        if (r = t, typeof t == "function") Fi(t) && (g = 1);
        else if (typeof t == "string")
          g = qe && Vt ? $u(t, n, te.current) ? 26 : sd(t) ? 27 : 5 : qe ? $u(
            t,
            n,
            te.current
          ) ? 26 : 5 : Vt && sd(t) ? 27 : 5;
        else
          t: switch (t) {
            case io:
              return t = s(31, n, e, c), t.elementType = io, t.lanes = u, t;
            case ya:
              return Wn(
                n.children,
                c,
                u,
                e
              );
            case Bu:
              g = 8, c |= 24;
              break;
            case eo:
              return t = s(12, n, e, c | 2), t.elementType = eo, t.lanes = u, t;
            case ao:
              return t = s(13, n, e, c), t.elementType = ao, t.lanes = u, t;
            case lo:
              return t = s(19, n, e, c), t.elementType = lo, t.lanes = u, t;
            default:
              if (typeof t == "object" && t !== null)
                switch (t.$$typeof) {
                  case _n:
                    g = 10;
                    break t;
                  case Uu:
                    g = 9;
                    break t;
                  case no:
                    g = 11;
                    break t;
                  case ro:
                    g = 14;
                    break t;
                  case Sn:
                    g = 16, r = null;
                    break t;
                }
              g = 29, n = Error(
                i(
                  130,
                  t === null ? "null" : typeof t,
                  ""
                )
              ), r = null;
          }
        return e = s(g, n, e, c), e.elementType = t, e.type = r, e.lanes = u, e;
      }
      function Wn(t, e, n, r) {
        return t = s(7, t, r, e), t.lanes = n, t;
      }
      function Ii(t, e, n) {
        return t = s(6, t, null, e), t.lanes = n, t;
      }
      function Au(t) {
        var e = s(18, null, null, 0);
        return e.stateNode = t, e;
      }
      function Pi(t, e, n) {
        return e = s(
          4,
          t.children !== null ? t.children : [],
          t.key,
          e
        ), e.lanes = n, e.stateNode = {
          containerInfo: t.containerInfo,
          pendingChildren: null,
          implementation: t.implementation
        }, e;
      }
      function Wm(t, e, n, r, c, u, g, C, Y) {
        this.tag = 1, this.containerInfo = t, this.pingCache = this.current = this.pendingChildren = null, this.timeoutHandle = Fn, this.callbackNode = this.next = this.pendingContext = this.context = this.cancelPendingCommit = null, this.callbackPriority = 0, this.expirationTimes = q(-1), this.entangledLanes = this.shellSuspendCounter = this.errorRecoveryDisabledLanes = this.expiredLanes = this.warmLanes = this.pingedLanes = this.suspendedLanes = this.pendingLanes = 0, this.entanglements = q(0), this.hiddenUpdates = q(null), this.identifierPrefix = r, this.onUncaughtError = c, this.onCaughtError = u, this.onRecoverableError = g, this.pooledCache = null, this.pooledCacheLanes = 0, this.formState = Y, this.incompleteTransitions = /* @__PURE__ */ new Map();
      }
      function ju(t, e, n, r, c, u, g, C, Y, Z, P, W) {
        return t = new Wm(
          t,
          e,
          n,
          g,
          Y,
          Z,
          P,
          W,
          C
        ), e = 1, u === !0 && (e |= 24), u = s(3, null, null, e), t.current = u, u.stateNode = t, e = ti(), e.refCount++, t.pooledCache = e, e.refCount++, u.memoizedState = {
          element: r,
          isDehydrated: n,
          cache: e
        }, li(u), t;
      }
      function Ou(t) {
        return t ? (t = Sa, t) : Sa;
      }
      function Ru(t) {
        var e = t._reactInternals;
        if (e === void 0)
          throw typeof t.render == "function" ? Error(i(188)) : (t = Object.keys(t).join(","), Error(i(268, t)));
        return t = f(e), t = t !== null ? b(t) : null, t === null ? null : nl(t.stateNode);
      }
      function Du(t, e, n, r, c, u) {
        c = Ou(c), r.context === null ? r.context = c : r.pendingContext = c, r = gn(e), r.payload = { element: n }, u = u === void 0 ? null : u, u !== null && (r.callback = u), n = bn(t, r, e), n !== null && (fe(n, t, e), Va(n, t, e));
      }
      function Hu(t, e) {
        if (t = t.memoizedState, t !== null && t.dehydrated !== null) {
          var n = t.retryLane;
          t.retryLane = n !== 0 && n < e ? n : e;
        }
      }
      function $i(t, e) {
        Hu(t, e), (t = t.alternate) && Hu(t, e);
      }
      var yt = {}, Fm = h0, ye = b0(), to = Object.assign, Im = Symbol.for("react.element"), er = Symbol.for("react.transitional.element"), va = Symbol.for("react.portal"), ya = Symbol.for("react.fragment"), Bu = Symbol.for("react.strict_mode"), eo = Symbol.for("react.profiler"), Uu = Symbol.for("react.consumer"), _n = Symbol.for("react.context"), no = Symbol.for("react.forward_ref"), ao = Symbol.for("react.suspense"), lo = Symbol.for("react.suspense_list"), ro = Symbol.for("react.memo"), Sn = Symbol.for("react.lazy"), io = Symbol.for("react.activity"), Pm = Symbol.for("react.memo_cache_sentinel"), qu = Symbol.iterator, $m = Symbol.for("react.client.reference"), nr = Array.isArray, ct = Fm.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE, tp = l.rendererVersion, ep = l.rendererPackageName, Yu = l.extraDevToolsConfig, nl = l.getPublicInstance, np = l.getRootHostContext, ap = l.getChildHostContext, lp = l.prepareForCommit, rp = l.resetAfterCommit, ip = l.createInstance;
      l.cloneMutableInstance;
      var oo = l.appendInitialChild, Gu = l.finalizeInitialChildren, ar = l.shouldSetTextContent, Ku = l.createTextInstance;
      l.cloneMutableTextInstance;
      var op = l.scheduleTimeout, sp = l.cancelTimeout, Fn = l.noTimeout, an = l.isPrimaryRenderer;
      l.warnsIfNotActing;
      var ie = l.supportsMutation, Ve = l.supportsPersistence, oe = l.supportsHydration, cp = l.getInstanceFromNode;
      l.beforeActiveInstanceBlur;
      var up = l.preparePortalMount;
      l.prepareScopeUpdate, l.getInstanceFromScope;
      var Jt = l.setCurrentUpdatePriority, ln = l.getCurrentUpdatePriority, dp = l.resolveUpdatePriority;
      l.trackSchedulerEvent, l.resolveEventType, l.resolveEventTimeStamp;
      var fp = l.shouldAttemptEagerTransition, mp = l.detachDeletedInstance;
      l.requestPostPaintCallback;
      var pp = l.maySuspendCommit, hp = l.maySuspendCommitOnUpdate, so = l.maySuspendCommitInSyncRender, Qu = l.preloadInstance, gp = l.startSuspendingCommit, Vu = l.suspendInstance;
      l.suspendOnActiveViewTransition;
      var bp = l.waitForCommitToBeReady;
      l.getSuspendedCommitReason;
      var xa = l.NotPendingTransition, In = l.HostTransitionContext, vp = l.resetFormInstance;
      l.bindToConsole;
      var yp = l.supportsMicrotasks, xp = l.scheduleMicrotask, al = l.supportsTestSelectors, wp = l.findFiberRoot, _p = l.getBoundingRect, Sp = l.getTextContent, ll = l.isHiddenSubtree, kp = l.matchAccessibilityRole, Ep = l.setFocusIfFocusable, zp = l.setupIntersectionObserver, Np = l.appendChild, Tp = l.appendChildToContainer, Cp = l.commitTextUpdate, Mp = l.commitMount, Ap = l.commitUpdate, jp = l.insertBefore, Op = l.insertInContainerBefore, Rp = l.removeChild, Dp = l.removeChildFromContainer, Xu = l.resetTextContent, Hp = l.hideInstance, Bp = l.hideTextInstance, Up = l.unhideInstance, qp = l.unhideTextInstance;
      l.cancelViewTransitionName, l.cancelRootViewTransitionName, l.restoreRootViewTransitionName, l.cloneRootViewTransitionContainer, l.removeRootViewTransitionClone, l.measureClonedInstance, l.hasInstanceChanged, l.hasInstanceAffectedParent, l.startViewTransition, l.startGestureTransition, l.stopViewTransition, l.getCurrentGestureOffset, l.createViewTransitionInstance;
      var Yp = l.clearContainer;
      l.createFragmentInstance, l.updateFragmentInstanceFiber, l.commitNewChildToFragmentInstance, l.deleteChildFromFragmentInstance;
      var Gp = l.cloneInstance, Lu = l.createContainerChildSet, Zu = l.appendChildToContainerChildSet, Kp = l.finalizeContainerChildren, Ju = l.replaceContainerChildren, Wu = l.cloneHiddenInstance, Fu = l.cloneHiddenTextInstance, co = l.isSuspenseInstancePending, uo = l.isSuspenseInstanceFallback, Qp = l.getSuspenseInstanceFallbackErrorDetails, Vp = l.registerSuspenseInstanceRetry, Xp = l.canHydrateFormStateMarker, Lp = l.isFormStateMarkerMatching, Iu = l.getNextHydratableSibling, Zp = l.getNextHydratableSiblingAfterSingleton, Jp = l.getFirstHydratableChild, Wp = l.getFirstHydratableChildWithinContainer, Fp = l.getFirstHydratableChildWithinActivityInstance, Ip = l.getFirstHydratableChildWithinSuspenseInstance, Pp = l.getFirstHydratableChildWithinSingleton, $p = l.canHydrateInstance, th = l.canHydrateTextInstance, eh = l.canHydrateActivityInstance, nh = l.canHydrateSuspenseInstance, ah = l.hydrateInstance, lh = l.hydrateTextInstance, rh = l.hydrateActivityInstance, ih = l.hydrateSuspenseInstance, oh = l.getNextHydratableInstanceAfterActivityInstance, sh = l.getNextHydratableInstanceAfterSuspenseInstance, ch = l.commitHydratedInstance, uh = l.commitHydratedContainer, dh = l.commitHydratedActivityInstance, fh = l.commitHydratedSuspenseInstance, mh = l.finalizeHydratedChildren, ph = l.flushHydrationEvents;
      l.clearActivityBoundary;
      var hh = l.clearSuspenseBoundary;
      l.clearActivityBoundaryFromContainer;
      var gh = l.clearSuspenseBoundaryFromContainer, bh = l.hideDehydratedBoundary, vh = l.unhideDehydratedBoundary, Pu = l.shouldDeleteUnhydratedTailInstances;
      l.diffHydratedPropsForDevWarnings, l.diffHydratedTextForDevWarnings, l.describeHydratableInstanceForDevWarnings;
      var yh = l.validateHydratableInstance, xh = l.validateHydratableTextInstance, qe = l.supportsResources, $u = l.isHostHoistableType, fo = l.getHoistableRoot, td = l.getResource, ed = l.acquireResource, nd = l.releaseResource, wh = l.hydrateHoistable, ad = l.mountHoistable, ld = l.unmountHoistable, _h = l.createHoistableInstance, Sh = l.prepareToCommitHoistables, kh = l.mayResourceSuspendCommit, rd = l.preloadResource, Eh = l.suspendResource, Vt = l.supportsSingletons, id = l.resolveSingletonInstance, zh = l.acquireSingletonInstance, od = l.releaseSingletonInstance, sd = l.isHostSingletonType, wa = l.isSingletonScope, mo = [], _a = -1, Sa = {}, xe = Math.clz32 ? Math.clz32 : y, Nh = Math.log, Th = Math.LN2, lr = 256, rr = 262144, ir = 4194304, or = ye.unstable_scheduleCallback, po = ye.unstable_cancelCallback, Ch = ye.unstable_shouldYield, Mh = ye.unstable_requestPaint, me = ye.unstable_now, cd = ye.unstable_ImmediatePriority, Ah = ye.unstable_UserBlockingPriority, ho = ye.unstable_NormalPriority, jh = ye.unstable_IdlePriority, Oh = ye.log, Rh = ye.unstable_setDisableYieldValue, rl = null, we = null, _e = typeof Object.is == "function" ? Object.is : $, ud = typeof reportError == "function" ? reportError : function(t) {
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
      }, Dh = Object.prototype.hasOwnProperty, go, dd, bo = !1, fd = /* @__PURE__ */ new WeakMap(), ka = [], Ea = 0, sr = null, il = 0, Te = [], Ce = 0, kn = null, Xe = 1, Le = "", te = w(null), ol = w(null), En = w(null), cr = w(null), ee = null, Ot = null, St = !1, zn = null, Me = !1, vo = Error(i(519)), ur = w(null), Pn = null, rn = null, Hh = typeof AbortController < "u" ? AbortController : function() {
        var t = [], e = this.signal = {
          aborted: !1,
          addEventListener: function(n, r) {
            t.push(r);
          }
        };
        this.abort = function() {
          e.aborted = !0, t.forEach(function(n) {
            return n();
          });
        };
      }, Bh = ye.unstable_scheduleCallback, Uh = ye.unstable_NormalPriority, Rt = {
        $$typeof: _n,
        Consumer: null,
        Provider: null,
        _currentValue: null,
        _currentValue2: null,
        _threadCount: 0
      }, dr = null, za = null, yo = !1, fr = !1, xo = !1, $n = 0, sl = null, wo = 0, Na = 0, Ta = null, md = ct.S;
      ct.S = function(t, e) {
        vd = me(), typeof e == "object" && e !== null && typeof e.then == "function" && Em(t, e), md !== null && md(t, e);
      };
      var ta = w(null), Ca = Error(i(460)), _o = Error(i(474)), mr = Error(i(542)), pr = { then: function() {
      } }, ea = null, Ma = null, cl = 0, na = Bs(!0), pd = Bs(!1), Ae = [], Aa = 0, So = 0, Nn = !1, ko = !1, ja = w(null), hr = w(0), Se = w(null), je = null, qt = w(0), on = 0, bt = null, Mt = null, Yt = null, gr = !1, Oa = !1, aa = !1, br = 0, ul = 0, Ra = null, qh = 0, dl = {
        readContext: Pt,
        use: Ul,
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
      var hd = {
        readContext: Pt,
        use: Ul,
        useCallback: function(t, e) {
          return ue().memoizedState = [
            t,
            e === void 0 ? null : e
          ], t;
        },
        useContext: Pt,
        useEffect: sc,
        useImperativeHandle: function(t, e, n) {
          n = n != null ? n.concat([t]) : null, Yl(
            4194308,
            4,
            fc.bind(null, e, t),
            n
          );
        },
        useLayoutEffect: function(t, e) {
          return Yl(4194308, 4, t, e);
        },
        useInsertionEffect: function(t, e) {
          Yl(4, 2, t, e);
        },
        useMemo: function(t, e) {
          var n = ue();
          e = e === void 0 ? null : e;
          var r = t();
          if (aa) {
            J(!0);
            try {
              t();
            } finally {
              J(!1);
            }
          }
          return n.memoizedState = [r, e], r;
        },
        useReducer: function(t, e, n) {
          var r = ue();
          if (n !== void 0) {
            var c = n(e);
            if (aa) {
              J(!0);
              try {
                n(e);
              } finally {
                J(!1);
              }
            }
          } else c = e;
          return r.memoizedState = r.baseState = c, t = {
            pending: null,
            lanes: 0,
            dispatch: null,
            lastRenderedReducer: t,
            lastRenderedState: c
          }, r.queue = t, t = t.dispatch = jm.bind(
            null,
            bt,
            t
          ), [r.memoizedState, t];
        },
        useRef: function(t) {
          var e = ue();
          return t = { current: t }, e.memoizedState = t;
        },
        useState: function(t) {
          t = vi(t);
          var e = t.queue, n = wc.bind(
            null,
            bt,
            e
          );
          return e.dispatch = n, [t.memoizedState, n];
        },
        useDebugValue: wi,
        useDeferredValue: function(t, e) {
          var n = ue();
          return _i(n, t, e);
        },
        useTransition: function() {
          var t = vi(!1);
          return t = bc.bind(
            null,
            bt,
            t.queue,
            !0,
            !1
          ), ue().memoizedState = t, [!1, t];
        },
        useSyncExternalStore: function(t, e, n) {
          var r = bt, c = ue();
          if (St) {
            if (n === void 0)
              throw Error(i(407));
            n = n();
          } else {
            if (n = e(), At === null)
              throw Error(i(349));
            (_t & 127) !== 0 || Ls(r, e, n);
          }
          c.memoizedState = n;
          var u = { value: n, getSnapshot: e };
          return c.queue = u, sc(Js.bind(null, r, u, t), [
            t
          ]), r.flags |= 2048, pa(
            9,
            { destroy: void 0 },
            Zs.bind(
              null,
              r,
              u,
              n,
              e
            ),
            null
          ), n;
        },
        useId: function() {
          var t = ue(), e = At.identifierPrefix;
          if (St) {
            var n = Le, r = Xe;
            n = (r & ~(1 << 32 - xe(r) - 1)).toString(32) + n, e = "_" + e + "R_" + n, n = br++, 0 < n && (e += "H" + n.toString(32)), e += "_";
          } else
            n = qh++, e = "_" + e + "r_" + n.toString(32) + "_";
          return t.memoizedState = e;
        },
        useHostTransitionStatus: Si,
        useFormState: ac,
        useActionState: ac,
        useOptimistic: function(t) {
          var e = ue();
          e.memoizedState = e.baseState = t;
          var n = {
            pending: null,
            lanes: 0,
            dispatch: null,
            lastRenderedReducer: null,
            lastRenderedState: null
          };
          return e.queue = n, e = ki.bind(
            null,
            bt,
            !0,
            n
          ), n.dispatch = e, [t, e];
        },
        useMemoCache: hi,
        useCacheRefresh: function() {
          return ue().memoizedState = Am.bind(
            null,
            bt
          );
        },
        useEffectEvent: function(t) {
          var e = ue(), n = { impl: t };
          return e.memoizedState = n, function() {
            if ((xt & 2) !== 0)
              throw Error(i(440));
            return n.impl.apply(void 0, arguments);
          };
        }
      }, Eo = {
        readContext: Pt,
        use: Ul,
        useCallback: pc,
        useContext: Pt,
        useEffect: xi,
        useImperativeHandle: mc,
        useInsertionEffect: uc,
        useLayoutEffect: dc,
        useMemo: hc,
        useReducer: ql,
        useRef: oc,
        useState: function() {
          return ql(Pe);
        },
        useDebugValue: wi,
        useDeferredValue: function(t, e) {
          var n = Ut();
          return gc(
            n,
            Mt.memoizedState,
            t,
            e
          );
        },
        useTransition: function() {
          var t = ql(Pe)[0], e = Ut().memoizedState;
          return [
            typeof t == "boolean" ? t : Za(t),
            e
          ];
        },
        useSyncExternalStore: Xs,
        useId: yc,
        useHostTransitionStatus: Si,
        useFormState: lc,
        useActionState: lc,
        useOptimistic: function(t, e) {
          var n = Ut();
          return Is(n, Mt, t, e);
        },
        useMemoCache: hi,
        useCacheRefresh: xc
      };
      Eo.useEffectEvent = cc;
      var gd = {
        readContext: Pt,
        use: Ul,
        useCallback: pc,
        useContext: Pt,
        useEffect: xi,
        useImperativeHandle: mc,
        useInsertionEffect: uc,
        useLayoutEffect: dc,
        useMemo: hc,
        useReducer: bi,
        useRef: oc,
        useState: function() {
          return bi(Pe);
        },
        useDebugValue: wi,
        useDeferredValue: function(t, e) {
          var n = Ut();
          return Mt === null ? _i(n, t, e) : gc(
            n,
            Mt.memoizedState,
            t,
            e
          );
        },
        useTransition: function() {
          var t = bi(Pe)[0], e = Ut().memoizedState;
          return [
            typeof t == "boolean" ? t : Za(t),
            e
          ];
        },
        useSyncExternalStore: Xs,
        useId: yc,
        useHostTransitionStatus: Si,
        useFormState: ic,
        useActionState: ic,
        useOptimistic: function(t, e) {
          var n = Ut();
          return Mt !== null ? Is(n, Mt, t, e) : (n.baseState = t, [t, n.queue.dispatch]);
        },
        useMemoCache: hi,
        useCacheRefresh: xc
      };
      gd.useEffectEvent = cc;
      var zo = {
        enqueueSetState: function(t, e, n) {
          t = t._reactInternals;
          var r = ve(), c = gn(r);
          c.payload = e, n != null && (c.callback = n), e = bn(t, c, r), e !== null && (fe(e, t, r), Va(e, t, r));
        },
        enqueueReplaceState: function(t, e, n) {
          t = t._reactInternals;
          var r = ve(), c = gn(r);
          c.tag = 1, c.payload = e, n != null && (c.callback = n), e = bn(t, c, r), e !== null && (fe(e, t, r), Va(e, t, r));
        },
        enqueueForceUpdate: function(t, e) {
          t = t._reactInternals;
          var n = ve(), r = gn(n);
          r.tag = 2, e != null && (r.callback = e), e = bn(t, r, n), e !== null && (fe(e, t, n), Va(e, t, n));
        }
      }, No = Error(i(461)), Gt = !1, To = {
        dehydrated: null,
        treeContext: null,
        retryLane: 0,
        hydrationErrors: null
      }, sn = !1, Kt = !1, Co = !1, bd = typeof WeakSet == "function" ? WeakSet : Set, Wt = null, Qt = null, pe = !1, Ye = null, Da = 8192, Yh = {
        getCacheForType: function(t) {
          var e = Pt(Rt), n = e.data.get(t);
          return n === void 0 && (n = t(), e.data.set(t, n)), n;
        },
        cacheSignal: function() {
          return Pt(Rt).controller.signal;
        }
      }, vr = 0, yr = 1, xr = 2, wr = 3, _r = 4;
      if (typeof Symbol == "function" && Symbol.for) {
        var fl = Symbol.for;
        vr = fl("selector.component"), yr = fl("selector.has_pseudo_class"), xr = fl("selector.role"), wr = fl("selector.test_id"), _r = fl("selector.text");
      }
      var Gh = typeof WeakMap == "function" ? WeakMap : Map, xt = 0, At = null, wt = null, _t = 0, Ct = 0, ke = null, Tn = !1, Ha = !1, Mo = !1, cn = 0, Bt = 0, Cn = 0, la = 0, Ao = 0, Ee = 0, Ba = 0, ml = null, he = null, jo = !1, Sr = 0, vd = 0, pl = 1 / 0, kr = null, Mn = null, Xt = 0, An = null, Ua = null, un = 0, Oo = 0, Ro = null, yd = null, hl = 0, Do = null;
      return yt.attemptContinuousHydration = function(t) {
        if (t.tag === 13 || t.tag === 31) {
          var e = Xn(t, 67108864);
          e !== null && fe(e, t, 67108864), $i(t, 67108864);
        }
      }, yt.attemptHydrationAtCurrentPriority = function(t) {
        if (t.tag === 13 || t.tag === 31) {
          var e = ve();
          e = M(e);
          var n = Xn(t, e);
          n !== null && fe(n, t, e), $i(t, e);
        }
      }, yt.attemptSynchronousHydration = function(t) {
        switch (t.tag) {
          case 3:
            if (t = t.stateNode, t.current.memoizedState.isDehydrated) {
              var e = z(t.pendingLanes);
              if (e !== 0) {
                for (t.pendingLanes |= 2, t.entangledLanes |= 2; e; ) {
                  var n = 1 << 31 - xe(e);
                  t.entanglements[1] |= n, e &= ~n;
                }
                Ke(t), (xt & 6) === 0 && (pl = me() + 500, ma(0));
              }
            }
            break;
          case 31:
          case 13:
            e = Xn(t, 2), e !== null && fe(e, t, 2), pu(), $i(t, 2);
        }
      }, yt.batchedUpdates = function(t, e) {
        return t(e);
      }, yt.createComponentSelector = function(t) {
        return { $$typeof: vr, value: t };
      }, yt.createContainer = function(t, e, n, r, c, u, g, C, Y, Z) {
        return ju(
          t,
          e,
          !1,
          null,
          n,
          r,
          u,
          null,
          g,
          C,
          Y,
          Z
        );
      }, yt.createHasPseudoClassSelector = function(t) {
        return { $$typeof: yr, value: t };
      }, yt.createHydrationContainer = function(t, e, n, r, c, u, g, C, Y, Z, P, W, nt, gt) {
        return t = ju(
          n,
          r,
          !0,
          t,
          c,
          u,
          C,
          gt,
          Y,
          Z,
          P,
          W
        ), t.context = Ou(null), n = t.current, r = ve(), r = M(r), c = gn(r), c.callback = e ?? null, bn(n, c, r), e = r, t.current.lanes = e, O(t, e), Ke(t), t;
      }, yt.createPortal = function(t, e, n) {
        var r = 3 < arguments.length && arguments[3] !== void 0 ? arguments[3] : null;
        return {
          $$typeof: va,
          key: r == null ? null : "" + r,
          children: t,
          containerInfo: e,
          implementation: n
        };
      }, yt.createRoleSelector = function(t) {
        return { $$typeof: xr, value: t };
      }, yt.createTestNameSelector = function(t) {
        return { $$typeof: wr, value: t };
      }, yt.createTextSelector = function(t) {
        return { $$typeof: _r, value: t };
      }, yt.defaultOnCaughtError = function(t) {
        console.error(t);
      }, yt.defaultOnRecoverableError = function(t) {
        ud(t);
      }, yt.defaultOnUncaughtError = function(t) {
        ud(t);
      }, yt.deferredUpdates = function(t) {
        var e = ct.T, n = ln();
        try {
          return Jt(32), ct.T = null, t();
        } finally {
          Jt(n), ct.T = e;
        }
      }, yt.discreteUpdates = function(t, e, n, r, c) {
        var u = ct.T, g = ln();
        try {
          return Jt(2), ct.T = null, t(e, n, r, c);
        } finally {
          Jt(g), ct.T = u, xt === 0 && (pl = me() + 500);
        }
      }, yt.findAllNodes = Li, yt.findBoundingRects = function(t, e) {
        if (!al) throw Error(i(363));
        e = Li(t, e), t = [];
        for (var n = 0; n < e.length; n++)
          t.push(_p(e[n]));
        for (e = t.length - 1; 0 < e; e--) {
          n = t[e];
          for (var r = n.x, c = r + n.width, u = n.y, g = u + n.height, C = e - 1; 0 <= C; C--)
            if (e !== C) {
              var Y = t[C], Z = Y.x, P = Z + Y.width, W = Y.y, nt = W + Y.height;
              if (r >= Z && u >= W && c <= P && g <= nt) {
                t.splice(e, 1);
                break;
              } else if (r !== Z || n.width !== Y.width || nt < u || W > g) {
                if (!(u !== W || n.height !== Y.height || P < r || Z > c)) {
                  Z > r && (Y.width += Z - r, Y.x = r), P < c && (Y.width = c - Z), t.splice(e, 1);
                  break;
                }
              } else {
                W > u && (Y.height += W - u, Y.y = u), nt < g && (Y.height = g - W), t.splice(e, 1);
                break;
              }
            }
        }
        return t;
      }, yt.findHostInstance = Ru, yt.findHostInstanceWithNoPortals = function(t) {
        return t = f(t), t = t !== null ? x(t) : null, t === null ? null : nl(t.stateNode);
      }, yt.findHostInstanceWithWarning = function(t) {
        return Ru(t);
      }, yt.flushPassiveEffects = el, yt.flushSyncFromReconciler = function(t) {
        var e = xt;
        xt |= 1;
        var n = ct.T, r = ln();
        try {
          if (Jt(2), ct.T = null, t)
            return t();
        } finally {
          Jt(r), ct.T = n, xt = e, (xt & 6) === 0 && ma(0);
        }
      }, yt.flushSyncWork = pu, yt.focusWithin = function(t, e) {
        if (!al) throw Error(i(363));
        for (t = Qi(t), e = uu(t, e), e = Array.from(e), t = 0; t < e.length; ) {
          var n = e[t++], r = n.tag;
          if (!ll(n)) {
            if ((r === 5 || r === 26 || r === 27) && Ep(n.stateNode))
              return !0;
            for (n = n.child; n !== null; )
              e.push(n), n = n.sibling;
          }
        }
        return !1;
      }, yt.getFindAllNodesFailureDescription = function(t, e) {
        if (!al) throw Error(i(363));
        var n = 0, r = [];
        t = [Qi(t), 0];
        for (var c = 0; c < t.length; ) {
          var u = t[c++], g = u.tag, C = t[c++], Y = e[C];
          if ((g !== 5 && g !== 26 && g !== 27 || !ll(u)) && (Vi(u, Y) && (r.push(Xi(Y)), C++, C > n && (n = C)), C < e.length))
            for (u = u.child; u !== null; )
              t.push(u, C), u = u.sibling;
        }
        if (n < e.length) {
          for (t = []; n < e.length; n++)
            t.push(Xi(e[n]));
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
          version: tp,
          rendererPackageName: ep,
          currentDispatcherRef: ct,
          reconcilerVersion: "19.2.0"
        };
        if (Yu !== null && (t.rendererConfig = Yu), typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ > "u") t = !1;
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
      }, yt.observeVisibleRects = function(t, e, n, r) {
        if (!al) throw Error(i(363));
        t = Li(t, e);
        var c = zp(
          t,
          n,
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
      }, yt.startHostTransition = function(t, e, n, r) {
        if (t.tag !== 5) throw Error(i(476));
        var c = vc(t).queue;
        bc(
          t,
          c,
          e,
          xa,
          n === null ? o : function() {
            var u = vc(t);
            return u.next === null && (u = t.alternate.memoizedState), Ja(
              t,
              u.next.queue,
              {},
              ve()
            ), n(r);
          }
        );
      }, yt.updateContainer = function(t, e, n, r) {
        var c = e.current, u = ve();
        return Du(
          c,
          u,
          t,
          e,
          n,
          r
        ), u;
      }, yt.updateContainerSync = function(t, e, n, r) {
        return Du(
          e.current,
          2,
          t,
          e,
          n,
          r
        ), 2;
      }, yt;
    }, a.exports.default = a.exports, Object.defineProperty(a.exports, "__esModule", { value: !0 });
  })(qo)), qo.exports;
}
var jd;
function y0() {
  return jd || (jd = 1, Uo.exports = v0()), Uo.exports;
}
var x0 = y0();
const w0 = /* @__PURE__ */ bs(x0);
var Ko = { exports: {} }, dn = {};
/**
 * @license React
 * react-reconciler-constants.production.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var Od;
function _0() {
  return Od || (Od = 1, dn.ConcurrentRoot = 1, dn.ContinuousEventPriority = 8, dn.DefaultEventPriority = 32, dn.DiscreteEventPriority = 2, dn.IdleEventPriority = 268435456, dn.LegacyRoot = 0, dn.NoEventPriority = 0), dn;
}
var Rd;
function S0() {
  return Rd || (Rd = 1, Ko.exports = _0()), Ko.exports;
}
var Sl = S0();
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
const kf = ["accent", "panel-bg", "surface-0", "surface-1", "surface-dim", "overlay-0", "overlay-1", "text", "subtext-0", "mauve", "green", "yellow", "red", "blue", "teal", "peach", "backdrop", "card-bg"], ns = 16, Ef = /* @__PURE__ */ new Set(["hover", "focus", "focus-visible", "focus-within", "active"]), k0 = [
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
], Dd = {
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
}, E0 = /* @__PURE__ */ new Set([
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
]), zf = {
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
}, Nf = {
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
}, as = ["font-size", "color", ...new Set([...Object.keys(zf), ...Object.keys(Nf)].filter((a) => a !== "font-size" && a !== "color"))], z0 = new Set(as);
function ae(a, l = " ") {
  const s = [];
  let o = 0, i = "";
  for (let d = 0; d < a.length; d++) {
    const m = a[d];
    if (m === "(" ? o++ : m === ")" && o--, o === 0 && (l === " " ? /\s/.test(m) : m === l)) {
      (i.trim() || l !== " ") && s.push(i.trim()), i = "";
      continue;
    }
    i += m;
  }
  return (i.trim() || l !== " " && s.length) && s.push(i.trim()), s;
}
function ls(a, l, s = 0) {
  if (s > 32) return null;
  let o = "", i = 0;
  for (; ; ) {
    const d = a.indexOf("var(", i);
    if (d < 0)
      return o += a.slice(i), o;
    o += a.slice(i, d);
    let m = 1, f = d + 4;
    for (; f < a.length && m; f++)
      a[f] === "(" ? m++ : a[f] === ")" && m--;
    const b = a.slice(d + 4, f - 1), x = ae(b, ","), E = x[0].trim(), k = x.length > 1 ? b.slice(b.indexOf(",") + 1).trim() : null;
    let w = l(E);
    if ((w == null || w === "initial") && (w = k), w == null) return null;
    const N = ls(w, l, s + 1);
    if (N === null) return null;
    o += N, i = f;
  }
}
function N0(a) {
  const l = [], s = /\s*(?:(-?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)(%|[a-z]+)?|([a-z-]+)\(|(infinity)|([()+*/,])|(-)(?=\s))/giy;
  let o, i = 0;
  for (; i < a.length; ) {
    if (s.lastIndex = i, o = s.exec(a), !o || o.index !== i) {
      if (/^\s+$/.test(a.slice(i))) break;
      return null;
    }
    i = s.lastIndex, o[1] !== void 0 ? l.push({ num: parseFloat(o[1]), unit: (o[2] ?? "").toLowerCase() }) : o[3] ? l.push({ fn: o[3].toLowerCase() }) : o[4] ? l.push({ num: 1 / 0, unit: "" }) : l.push({ op: o[5] ?? o[6] });
  }
  return l;
}
function qn(a, l) {
  const s = N0(a.trim().replace(/env\(\s*safe-area-inset-(?:top|right|bottom|left)\s*(?:,[^()]*)?\)/gi, "0px"));
  if (!s) return null;
  let o = 0;
  const i = ({ num: w, unit: N }) => {
    switch (N) {
      case "":
        return { px: 0, pct: 0, num: w, unitless: !0 };
      case "px":
        return { px: w, pct: 0, num: 0 };
      case "rem":
        return { px: w * ns, pct: 0, num: 0 };
      case "em":
        return { px: w * (l.fontSize ?? ns), pct: 0, num: 0 };
      case "%":
        return { px: 0, pct: w, num: 0 };
      case "vh":
      case "dvh":
      case "svh":
      case "lvh":
        return { px: w / 100 * (l.viewport?.height ?? 800), pct: 0, num: 0 };
      case "vw":
      case "dvw":
      case "svw":
      case "lvw":
        return { px: w / 100 * (l.viewport?.width ?? 1e3), pct: 0, num: 0 };
      case "pt":
        return { px: w * (4 / 3), pct: 0, num: 0 };
      default:
        return null;
    }
  }, d = (w, N, _) => w && N ? { px: w.px + _ * N.px, pct: w.pct + _ * N.pct, num: w.num + _ * N.num, unitless: w.unitless && N.unitless } : null, m = (w, N) => w ? { px: w.px * N, pct: w.pct * N, num: w.num * N, unitless: w.unitless } : null, f = (w) => w && w.unitless;
  function b() {
    const w = s[o++];
    if (!w) return null;
    if (w.num !== void 0) return i(w);
    if (w.op === "(") {
      const N = E();
      return s[o]?.op !== ")" ? null : (o++, N);
    }
    if (w.op === "-" || w.op === "+") {
      const N = b();
      return w.op === "-" ? m(N, -1) : N;
    }
    if (w.fn) {
      const N = [];
      for (; ; ) {
        N.push(E());
        const z = s[o++];
        if (!z) return null;
        if (z.op === ")") break;
        if (z.op !== ",") return null;
      }
      if (N.some((z) => !z)) return null;
      if (w.fn === "calc") return N[0];
      if (!(N.every((z) => !z.pct) || N.every((z) => !z.px && !z.num))) return null;
      const y = (z) => z.px + z.pct + z.num;
      return w.fn === "min" ? N.reduce((z, R) => y(R) < y(z) ? R : z) : w.fn === "max" ? N.reduce((z, R) => y(R) > y(z) ? R : z) : w.fn === "clamp" && N.length === 3 ? y(N[1]) < y(N[0]) ? N[0] : y(N[1]) > y(N[2]) ? N[2] : N[1] : null;
    }
    return null;
  }
  function x() {
    let w = b();
    for (; s[o] && (s[o].op === "*" || s[o].op === "/"); ) {
      const N = s[o++].op, _ = b();
      if (!w || !_) return null;
      N === "*" ? w = f(_) ? m(w, _.num) : f(w) ? m(_, w.num) : null : w = f(_) && _.num !== 0 ? m(w, 1 / _.num) : null;
    }
    return w;
  }
  function E() {
    let w = x();
    for (; s[o] && (s[o].op === "+" || s[o].op === "-"); ) {
      const N = s[o++].op;
      w = d(w, x(), N === "-" ? -1 : 1);
    }
    return w;
  }
  const k = E();
  return o !== s.length || !k ? null : k;
}
function rs(a, l) {
  const s = a.trim().toLowerCase();
  if (/^(auto|none|normal|fit-content|max-content|min-content|medium|thin|thick)$/.test(s))
    return s === "thin" ? { px: 1 } : s === "medium" ? { px: 3 } : s === "thick" ? { px: 5 } : s;
  const o = qn(s, l);
  return o ? o.unitless ? o.num === 0 ? { px: 0 } : { expr: a.trim() } : o.pct && (o.px || o.num) ? { expr: a.trim() } : o.pct ? { pct: o.pct } : { px: T0(o.px) } : { expr: a.trim() };
}
const T0 = (a) => Number.isFinite(a) ? a : a > 0 ? 34e37 : -34e37, Nr = (a) => Math.max(0, Math.min(255, Math.round(a))).toString(16).padStart(2, "0"), C0 = ([a, l, s, o]) => `#${Nr(a)}${Nr(l)}${Nr(s)}${Nr(o * 255)}`;
function Hd(a) {
  const l = a.slice(1), s = l.length <= 4 ? l.split("").map((i) => i + i).join("") : l;
  if (!/^[0-9a-f]{6}([0-9a-f]{2})?$/i.test(s)) return null;
  const o = (i) => parseInt(s.slice(i, i + 2), 16);
  return [o(0), o(2), o(4), s.length === 8 ? o(6) / 255 : 1];
}
function Br(a, l) {
  const s = a.trim().toLowerCase();
  if (s === "currentcolor") return "currentcolor";
  const o = /^perchtoken\(([a-z0-9-]+)\)$/.exec(s);
  if (o) {
    const x = l(o[1]), E = x && Hd(x);
    return E ? { rgba: E, token: o[1] } : null;
  }
  if (s.startsWith("#")) {
    const x = Hd(s);
    return x ? { rgba: x, token: null } : null;
  }
  if (Dd[s]) return { rgba: [...Dd[s]], token: null };
  const i = /^(rgba?|color-mix)\((.*)\)$/s.exec(s);
  if (!i) return null;
  if (i[1] === "color-mix") {
    const x = ae(i[2], ",");
    if (x.length !== 3 || !/^in\s+(srgb|srgb-linear|oklab|lab|oklch|lch|hsl|xyz)/.test(x[0])) return null;
    const E = (J) => {
      const $ = ae(J), tt = $.findIndex((I) => /%$/.test(I)), Q = tt >= 0 ? parseFloat($[tt]) / 100 : null;
      return { color: Br($.filter((I, G) => G !== tt).join(" "), l), pct: Q };
    }, k = E(x[1]), w = E(x[2]);
    if (!k.color || !w.color || k.color === "currentcolor" || w.color === "currentcolor") return null;
    let N = k.pct, _ = w.pct;
    N === null && _ === null ? (N = 0.5, _ = 0.5) : N === null ? N = 1 - _ : _ === null && (_ = 1 - N);
    const y = N + _, z = y < 1 ? y : 1;
    N /= y, _ /= y;
    const [R, D, A, X] = k.color.rgba, [q, O, h, p] = w.color.rgba, v = X * N + p * _, S = (J, $) => v === 0 ? 0 : (J * X * N + $ * p * _) / v, M = [S(R, q), S(D, O), S(A, h), v * z], H = p === 0 ? k.color.token : X === 0 ? w.color.token : null;
    return { rgba: M, token: H };
  }
  const d = i[2].includes(",") ? ae(i[2], ",") : ae(i[2].replace("/", " / ")).filter((x) => x !== "/");
  if (d.length < 3) return null;
  const m = (x) => x.endsWith("%") ? parseFloat(x) / 100 * 255 : parseFloat(x), f = d[3] === void 0 ? 1 : d[3].endsWith("%") ? parseFloat(d[3]) / 100 : parseFloat(d[3]), b = [m(d[0]), m(d[1]), m(d[2]), f];
  return b.some((x) => Number.isNaN(x)) ? null : { rgba: b, token: null };
}
const yl = ["top", "right", "bottom", "left"], M0 = ["top-left", "top-right", "bottom-right", "bottom-left"], Tr = (a) => [a[0], a[1] ?? a[0], a[2] ?? a[0], a[3] ?? a[1] ?? a[0]], Bd = /* @__PURE__ */ new Set(["none", "hidden", "solid", "dashed", "dotted", "double", "groove", "ridge", "inset", "outset"]);
function is(a, l) {
  const s = l.trim(), o = () => ae(s);
  switch (a) {
    case "padding":
    case "margin": {
      const i = Tr(o());
      return yl.map((d, m) => [`${a}-${d}`, i[m]]);
    }
    case "padding-inline":
    case "margin-inline": {
      const i = o(), d = a.split("-")[0];
      return [[`${d}-left`, i[0]], [`${d}-right`, i[1] ?? i[0]]];
    }
    case "padding-block":
    case "margin-block": {
      const i = o(), d = a.split("-")[0];
      return [[`${d}-top`, i[0]], [`${d}-bottom`, i[1] ?? i[0]]];
    }
    case "padding-inline-start":
    case "margin-inline-start":
      return [[`${a.split("-")[0]}-left`, s]];
    case "padding-inline-end":
    case "margin-inline-end":
      return [[`${a.split("-")[0]}-right`, s]];
    case "padding-block-start":
    case "margin-block-start":
      return [[`${a.split("-")[0]}-top`, s]];
    case "padding-block-end":
    case "margin-block-end":
      return [[`${a.split("-")[0]}-bottom`, s]];
    case "inset": {
      const i = Tr(o());
      return yl.map((d, m) => [d, i[m]]);
    }
    case "inset-inline": {
      const i = o();
      return [["left", i[0]], ["right", i[1] ?? i[0]]];
    }
    case "inset-block": {
      const i = o();
      return [["top", i[0]], ["bottom", i[1] ?? i[0]]];
    }
    case "inset-inline-start":
      return [["left", s]];
    case "inset-inline-end":
      return [["right", s]];
    case "border-width":
    case "border-style":
    case "border-color": {
      const i = a.split("-")[1], d = Tr(o());
      return yl.map((m, f) => [`border-${m}-${i}`, d[f]]);
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
      const i = a === "border" ? yl : a === "border-inline" ? ["left", "right"] : a === "border-block" ? ["top", "bottom"] : a === "border-inline-start" ? ["left"] : a === "border-inline-end" ? ["right"] : [a.slice(7)];
      let d = "medium", m = "none", f = "currentcolor";
      if (s !== "none" && s !== "0")
        for (const b of o())
          Bd.has(b) ? m = b : /^(thin|medium|thick|-?[\d.]|calc\()/.test(b) ? d = b : f = b;
      else s === "0" && (d = "0");
      return i.flatMap((b) => [[`border-${b}-width`, d], [`border-${b}-style`, m], [`border-${b}-color`, f]]);
    }
    case "border-inline-width": {
      const i = o();
      return [["border-left-width", i[0]], ["border-right-width", i[1] ?? i[0]]];
    }
    case "border-block-width": {
      const i = o();
      return [["border-top-width", i[0]], ["border-bottom-width", i[1] ?? i[0]]];
    }
    case "border-inline-style": {
      const i = o();
      return [["border-left-style", i[0]], ["border-right-style", i[1] ?? i[0]]];
    }
    case "border-inline-color": {
      const i = o();
      return [["border-left-color", i[0]], ["border-right-color", i[1] ?? i[0]]];
    }
    case "border-radius": {
      const i = Tr(ae(s.split("/")[0]));
      return M0.map((d, m) => [`border-${d}-radius`, i[m]]);
    }
    case "border-start-start-radius":
      return [["border-top-left-radius", s]];
    case "border-start-end-radius":
      return [["border-top-right-radius", s]];
    case "border-end-start-radius":
      return [["border-bottom-left-radius", s]];
    case "border-end-end-radius":
      return [["border-bottom-right-radius", s]];
    case "background":
      return s === "none" ? [["background-color", "transparent"], ["background-image", "none"]] : Br(s, () => "#000000") ? [["background-color", s], ["background-image", "none"]] : [["background-color", "transparent"], ["background-image", s]];
    // ponytail: only the CSS-wide keywords (`[font:inherit]` on a button); a full `font` value is kept unexpanded.
    case "font":
      return /^(inherit|initial|unset|revert|revert-layer)$/.test(s) ? ["font-family", "font-size", "font-weight", "font-style", "line-height"].map((i) => [i, s]) : [[a, s]];
    case "overflow": {
      const i = o();
      return [["overflow-x", i[0]], ["overflow-y", i[1] ?? i[0]]];
    }
    case "gap": {
      const i = o();
      return [["row-gap", i[0]], ["column-gap", i[1] ?? i[0]]];
    }
    case "grid-gap":
      return is("gap", s);
    case "place-items": {
      const i = o();
      return [["align-items", i[0]], ["justify-items", i[1] ?? i[0]]];
    }
    case "place-self": {
      const i = o();
      return [["align-self", i[0]], ["justify-self", i[1] ?? i[0]]];
    }
    case "place-content": {
      const i = o();
      return [["align-content", i[0]], ["justify-content", i[1] ?? i[0]]];
    }
    case "flex": {
      if (s === "none") return [["flex-grow", "0"], ["flex-shrink", "0"], ["flex-basis", "auto"]];
      if (s === "auto") return [["flex-grow", "1"], ["flex-shrink", "1"], ["flex-basis", "auto"]];
      if (s === "initial") return [["flex-grow", "0"], ["flex-shrink", "1"], ["flex-basis", "auto"]];
      const i = o(), d = i.filter((f) => /^[\d.]+$/.test(f)), m = i.find((f) => !/^[\d.]+$/.test(f));
      return [["flex-grow", d[0] ?? "1"], ["flex-shrink", d[1] ?? "1"], ["flex-basis", m ?? (d.length ? "0%" : "auto")]];
    }
    case "flex-flow": {
      const i = [];
      for (const d of o()) i.push(/wrap/.test(d) ? ["flex-wrap", d] : ["flex-direction", d]);
      return i;
    }
    case "outline": {
      if (s === "none" || s === "0") return [["outline-style", "none"], ["outline-width", "medium"], ["outline-color", "currentcolor"]];
      let i = "medium", d = "none", m = "currentcolor";
      for (const f of o())
        Bd.has(f) || f === "auto" ? d = f : /^(thin|medium|thick|-?[\d.]|calc\()/.test(f) ? i = f : m = f;
      return [["outline-width", i], ["outline-style", d], ["outline-color", m]];
    }
    case "transition": {
      if (s === "none") return [["transition-property", "none"], ["transition-duration", "0s"]];
      const i = ae(s, ","), d = i.map((f) => ae(f).find((b) => !/^[\d.]+m?s$/.test(b) && !/^(ease|linear|step|cubic)/.test(b)) ?? "all"), m = i.map((f) => ae(f).find((b) => /^[\d.]+m?s$/.test(b)) ?? "0s");
      return [["transition-property", d.join(", ")], ["transition-duration", m.join(", ")]];
    }
    case "text-decoration":
      return [["text-decoration-line", o()[0] ?? "none"]];
    case "-webkit-user-select":
      return [["user-select", s]];
    case "word-wrap":
      return [["overflow-wrap", s]];
    default:
      return [[a, s]];
  }
}
function A0(a, l) {
  return a ? ae(a, ",").some((s) => {
    let o = s.trim().toLowerCase(), i = !1;
    o.startsWith("not ") && (i = !0, o = o.slice(4)), o.startsWith("only ") && (o = o.slice(5));
    const d = o.split(/\s+and\s+/).every((m) => {
      if (m = m.trim(), m === "all" || m === "screen") return !0;
      if (m === "print") return !1;
      const f = /^\((.+)\)$/.exec(m);
      if (!f) return !1;
      const b = f[1].trim(), x = /^([a-z-]+)\s*:\s*(.+)$/.exec(b);
      if (x) {
        const [, k, w] = x, N = (_) => {
          const y = rs(_, { viewport: l });
          return typeof y == "object" && "px" in y ? y.px : NaN;
        };
        switch (k) {
          case "min-width":
            return l.width >= N(w);
          case "max-width":
            return l.width <= N(w);
          case "min-height":
            return l.height >= N(w);
          case "max-height":
            return l.height <= N(w);
          case "hover":
          case "any-hover":
            return w.trim() === "hover";
          case "pointer":
          case "any-pointer":
            return w.trim() === "fine";
          case "prefers-reduced-motion":
            return w.trim() === "no-preference";
          case "prefers-color-scheme":
            return w.trim() === (l.dark === !1 ? "light" : "dark");
          default:
            return !1;
        }
      }
      const E = /^(width|height)\s*(>=|<=|>|<|=)\s*(.+)$/.exec(b);
      if (E) {
        const k = E[1] === "width" ? l.width : l.height, w = rs(E[3], { viewport: l }), N = typeof w == "object" && "px" in w ? w.px : NaN;
        switch (E[2]) {
          case ">=":
            return k >= N;
          case "<=":
            return k <= N;
          case ">":
            return k > N;
          case "<":
            return k < N;
          default:
            return k === N;
        }
      }
      return !1;
    });
    return i ? !d : d;
  }) : !0;
}
function j0(a, l) {
  const s = l[l.length - 1].compound;
  return vs(s)[0] ?? a;
}
function O0(a) {
  const l = /* @__PURE__ */ new Set(), s = /* @__PURE__ */ new Set(), o = (i, d) => {
    i.forEach(({ compound: m }, f) => {
      const b = d && f === i.length - 1;
      for (const x of m.pseudos)
        if (Ef.has(x.name) && (b ? l : s).add(x.name), x.list && x.name !== "not") for (const E of x.list) o(E, b);
    });
  };
  return o(a, !0), { subject: l, ancestor: s };
}
function vs(a) {
  const l = [...a.classes];
  for (const s of a.pseudos)
    if (!(s.name !== "is" && s.name !== "where"))
      for (const o of s.list) o.length === 1 && l.push(...vs(o[0].compound));
  return l;
}
function R0(a, l) {
  const s = (o, i) => {
    o.forEach(({ compound: d }, m) => {
      const f = i && m === o.length - 1, b = d.pseudos.filter((x) => Ef.has(x.name)).map((x) => x.name);
      if (!f) for (const x of b) for (const E of vs(d)) l.add(`${x}:${E}`);
      for (const x of d.pseudos) if (x.list && x.name !== "not") for (const E of x.list) s(E, f);
    });
  };
  s(a, !0);
}
class D0 {
  constructor(l) {
    this.properties = l.properties ?? {}, this.rules = [], this.skipped = 0, this.index = /* @__PURE__ */ new Map(), this.trackedStates = /* @__PURE__ */ new Set();
    const s = (d, m) => {
      const f = m[m.length - 1].compound, b = f.classes.length ? `.${f.classes[0]}` : f.tag && f.tag !== "*" ? f.tag : "*";
      this.index.has(b) || this.index.set(b, []), this.index.get(b).push(d);
    };
    let o = 0;
    const i = (d, m) => {
      for (const [f, b, x, E] of d)
        for (const k of ps(f)) {
          let w;
          try {
            w = hs(k);
          } catch (y) {
            if (y instanceof ge) {
              this.skipped++;
              continue;
            }
            throw y;
          }
          const N = O0(w);
          R0(w, this.trackedStates);
          const _ = { steps: w, media: b, layer: x, origin: m, order: o++, specificity: mf(w), decls: E, states: N, source: m === 0 ? `ua:${w[w.length - 1].compound.tag ?? "*"}` : j0(k, w) };
          this.rules.push(_), s(_, w);
        }
    };
    i(k0.map(([d, m]) => [d, null, 0, Object.entries(m)]), 0), i(l.rules, 1);
  }
  /** Rules that may match `element` (by its classes, its tag, and the universal ones). */
  candidates(l) {
    const s = [], o = /* @__PURE__ */ new Set(), i = (d) => {
      if (d) for (const m of d) o.has(m) || (o.add(m), s.push(m));
    };
    for (const d of l.classList) i(this.index.get(`.${d}`));
    return i(this.index.get(l.tagName)), i(this.index.get("*")), s;
  }
  /** Whether a rule that may match `element` reads interaction `state` on one of its ancestors (`group-hover:`). */
  readsAncestor(l, s) {
    return this.candidates(l).some((o) => o.states.ancestor.has(s));
  }
  /** Whether `element` carries a class whose interaction state some rule reads on an ancestor. */
  tracks(l, s) {
    for (const o of l.classList) if (this.trackedStates.has(`${s}:${o}`)) return !0;
    return !1;
  }
}
const H0 = /* @__PURE__ */ new Set(["opacity", "z-index", "flex-grow", "flex-shrink", "font-weight", "line-height", "flex", "order", "-webkit-line-clamp", "zoom"]);
function B0(a) {
  if (!a || typeof a != "object") return [];
  const l = [];
  for (const [s, o] of Object.entries(a)) {
    if (o == null || o === "" || typeof o == "boolean") continue;
    const i = s.startsWith("--") ? s : s.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`).replace(/^(webkit|moz|ms)-/, "-$1-"), d = typeof o == "number" && o !== 0 && !H0.has(i) && !i.startsWith("--") ? `${o}px` : String(o);
    l.push([i, d]);
  }
  return l;
}
function U0(a) {
  if (a.tagName !== "svg") return [];
  const l = [];
  for (const s of ["width", "height"]) {
    const o = a.getAttribute(s);
    o !== null && l.push([s, /^[\d.]+$/.test(o) ? `${o}px` : o]);
  }
  return l;
}
const q0 = (a, l) => a.important - l.important || a.origin - l.origin || a.layer - l.layer || a.specificity[0] - l.specificity[0] || a.specificity[1] - l.specificity[1] || a.specificity[2] - l.specificity[2] || a.order - l.order;
class Y0 {
  constructor(l, { theme: s, viewport: o }) {
    this.sheet = l, this.theme = s, this.viewport = o, this.parsed = /* @__PURE__ */ new Map();
  }
  themeHex(l) {
    return this.theme?.[l] ?? null;
  }
  /** Rules matching `element`; `assume` is the set of interaction states assumed on the element itself
   * (`"*"`: any, for finding variant rules). Ancestors use their real state. */
  matching(l, s) {
    const o = (i, d, m) => {
      if (d === "disabled") return !!i.props?.disabled && ["button", "input", "select", "textarea", "fieldset"].includes(i.tagName);
      if (d === "enabled") return !i.props?.disabled && ["button", "input", "select", "textarea"].includes(i.tagName);
      if (d === "checked") return !!i.props?.checked;
      if (s === "*") return !0;
      if (d === "focus-within") {
        const f = i.ownerDocument?.activeElement;
        return !!f && f !== i.ownerDocument.body && typeof i.contains == "function" && i.contains(f);
      }
      return m ? s.has(d) : d === "focus-visible" ? !!i.state?.focus && !i.state?.pointerFocus : !!i.state?.[d];
    };
    return this.sheet.candidates(l).filter((i) => (!i.media || i.media.every((d) => A0(d, this.viewport))) && gf(l, i.steps, { state: o }));
  }
  compute(l, s, o = /* @__PURE__ */ new Set()) {
    const i = this.matching(l, o), d = [];
    for (const h of i)
      for (const [p, v, S] of h.decls) d.push({ prop: p, value: v, important: S ? 1 : 0, origin: h.origin === 0 ? 0 : 2, layer: h.layer, specificity: h.specificity, order: h.order, source: h.source });
    for (const [h, p] of U0(l)) d.push({ prop: h, value: p, important: 0, origin: 1, layer: 0, specificity: [0, 0, 0], order: 0, source: `attr:${h}` });
    for (const [h, p] of B0(l.inlineStyle ?? l.props?.style)) d.push({ prop: h, value: p, important: 0, origin: 3, layer: 0, specificity: [1, 0, 0], order: 0, source: "style" });
    d.sort(q0);
    const m = this.sheet.properties, f = Object.create(s?.customs ?? null), b = /* @__PURE__ */ new Map(), x = /* @__PURE__ */ new Map();
    for (const h of d) h.prop.startsWith("--") && x.set(h.prop, h.value);
    if (!s && this.theme) for (const h of kf) this.theme[h] && x.set(`--${h}`, `perchtoken(${h})`);
    const E = (h) => {
      if (b.has(h)) return b.get(h);
      const p = m[h];
      return p && !p.inherits ? p.initial ?? null : h in f ? f[h] : p?.initial ?? null;
    }, k = /* @__PURE__ */ new Set(), w = (h) => {
      if (!x.has(h)) return E(h);
      if (k.has(h)) return null;
      k.add(h);
      const p = ls(x.get(h), w);
      return k.delete(h), x.delete(h), b.set(h, p), (!m[h] || m[h].inherits) && (f[h] = p), p;
    };
    for (const h of [...x.keys()]) w(h);
    const N = /* @__PURE__ */ new Map();
    for (const h of d) {
      if (h.prop.startsWith("--")) continue;
      const p = ls(h.value, E);
      if (p === null) {
        for (const [v] of is(h.prop, "unset")) N.set(v, { value: "unset", source: h.source, origin: h.origin });
        continue;
      }
      for (const [v, S] of is(h.prop, p)) N.set(v, { value: S, source: h.source, origin: h.origin });
    }
    const _ = {}, y = {}, z = /* @__PURE__ */ new Set(), R = /* @__PURE__ */ new Set(), D = s?.values, A = { fontSize: D?.["font-size"] ?? ns, viewport: this.viewport }, X = (h, p) => {
      if (/currentcolor/i.test(p)) return this.parseValue(h, p, A, _, D);
      const v = `${h}\0${p}\0${A.fontSize}`;
      let S = this.parsed.get(v);
      return S === void 0 && this.parsed.set(v, S = this.parseValue(h, p, A, _, D)), S;
    }, q = N.size ? [...as, ...[...N.keys()].filter((h) => !z0.has(h))] : as;
    for (const h of q) {
      const p = N.get(h);
      let v = p?.value;
      const S = E0.has(h);
      if ((v === void 0 || v === "unset" || v === "revert" || v === "revert-layer") && (v = S ? "inherit" : "initial"), p && (y[h] = p.source, p.origin !== 0 && z.add(h)), v === "inherit" && D && h in D) {
        _[h] = D[h], R.add(h);
        continue;
      }
      (v === "inherit" || v === "initial") && (v = S ? Nf[h] : zf[h]), _[h] = X(h, v), h === "font-size" && (A.fontSize = _["font-size"]);
    }
    for (const h of yl) {
      const p = _[`border-${h}-style`];
      (p === "none" || p === "hidden") && (_[`border-${h}-width`] = { px: 0 });
    }
    _["outline-style"] === "none" && (_["outline-width"] = { px: 0 });
    const O = D?.display;
    return (O === "flex" || O === "inline-flex" || O === "grid" || O === "inline-grid") && _.position !== "absolute" && _.position !== "fixed" && (_.display = Ud(_.display)), (_.position === "absolute" || _.position === "fixed") && (_.display = Ud(_.display)), { values: _, sources: y, own: z, inherited: R, customs: f, rules: i, element: l };
  }
  parseValue(l, s, o, i, d) {
    const m = String(s).trim();
    switch (l) {
      case "font-size": {
        const f = m.toLowerCase(), b = { "xx-small": 9, "x-small": 10, small: 13, medium: 16, large: 18, "x-large": 24, "xx-large": 32 };
        if (b[f]) return b[f];
        if (f === "smaller") return o.fontSize / 1.2;
        if (f === "larger") return o.fontSize * 1.2;
        const x = qn(f, { fontSize: o.fontSize, viewport: o.viewport });
        return !x || x.num ? o.fontSize : x.px + x.pct / 100 * o.fontSize;
      }
      case "font-weight": {
        const f = m.toLowerCase();
        if (f === "normal") return 400;
        if (f === "bold") return 700;
        if (f === "bolder") return (d?.["font-weight"] ?? 400) >= 600 ? 900 : 700;
        if (f === "lighter") return (d?.["font-weight"] ?? 400) >= 600 ? 400 : 100;
        const b = parseFloat(f);
        return Number.isFinite(b) ? b : 400;
      }
      case "line-height": {
        const f = m.toLowerCase();
        if (f === "normal") return { normal: !0 };
        const b = qn(f, { fontSize: o.fontSize, viewport: o.viewport });
        return b ? b.unitless ? { factor: b.num } : { px: b.px + b.pct / 100 * o.fontSize } : { normal: !0 };
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
        const f = Br(m, (b) => this.themeHex(b));
        return f === "currentcolor" || !f ? d?.color ?? { rgba: [0, 0, 0, 1], token: null } : f;
      }
      case "background-color":
      case "border-top-color":
      case "border-right-color":
      case "border-bottom-color":
      case "border-left-color":
      case "outline-color": {
        const f = Br(m, (b) => this.themeHex(b));
        return f === "currentcolor" ? i.color : f ?? { rgba: [0, 0, 0, 0], token: null, unreadable: m };
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
        return rs(m, o);
      default:
        return m.toLowerCase().startsWith("var(") ? m : /^[a-z-]+$/i.test(m) ? m.toLowerCase() : m;
    }
  }
}
function Ud(a) {
  return a === "inline" || a === "inline-block" || a === "contents" ? "block" : a === "inline-flex" ? "flex" : a === "inline-grid" ? "grid" : a;
}
const Ur = (a) => a && a.rgba ? { value: C0(a.rgba), token: a.token ?? null } : null, G0 = { 9.28: 11, 9.92: 12, 10.4: 12, 10.88: 13, 11: 13, 11.2: 13, 11.52: 13, 12: 15, 12.5: 15, 13: 16, 14: 17, 16: 19 };
function K0(a, l) {
  const s = l?.(a);
  if (Number.isFinite(s)) return s;
  const o = Math.round(a * 100) / 100;
  return G0[o] ?? Math.round(a * 1.2);
}
function qr(a, l) {
  const s = a["line-height"], o = a["font-size"];
  return s.normal ? K0(o, l) : s.factor !== void 0 ? s.factor * o : s.px;
}
const Q0 = (a) => ae(a, ",").map((l) => l.trim().replace(/^["']|["']$/g, "")).join(", ");
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
//! - `{ kind: "input", id, value, placeholder, checked, input_type, style, ... }` (`value`: what the field holds,
//!   typed text included; `field_w`: a line field's content width when its content sizes it)
//! - `break_anywhere` on a node whose text breaks a word too long for its line anywhere (`overflow-wrap`)
//! - `blocks_pointer` on a node that takes pointer events under an ancestor that lets them through; `tabular` on one
//!   whose digits are tabular; `scrollbar` (its width) on a vertical scroller
//! - a node `mount` was given a parity table for (`options.names`) carries `name` (`name` or `name:key`, the engine
//!   id tests find it by) and, for a name that is the element's own text, `range_name`.
//! - letter-spaced text is a `div` (no `id`) around the run with the spacing as room after it.
//!
//! Text styles follow GPUI's inheritance: a node carries a text style when it sets one itself (so an ancestor's
//! hover colour does not reach it, as in CSS) or when the inherited value would differ (`line-height: normal`, a
//! multiplier under a new size). `tokens` names the theme token each colour came from.
const V0 = "perch-native-description/1", ia = Symbol("display"), Yr = {
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
}, X0 = ["w", "h", "min_w", "min_h", "max_w", "max_h", "top", "right", "bottom", "left", "pt", "pr", "pb", "pl", "mt", "mr", "mb", "ml", "gap_x", "gap_y", "border_t", "border_r", "border_b", "border_l", "rounded_tl", "rounded_tr", "rounded_br", "rounded_bl"];
for (const a of X0) Yr[a] = /^(w|h|min_|max_|top|right|bottom|left)/.test(a) ? "auto" : 0;
Yr.rounded = 0;
const L0 = /* @__PURE__ */ new Set([
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
]), Z0 = /(-apple-system|blinkmacsystemfont|system-ui|segoe ui|sans-serif|times)/i, J0 = /(ui-monospace|sfmono|sf mono|menlo|monospace)/i, W0 = (a) => J0.test(a) ? "Menlo" : /^\s*system-ui\s*$/i.test(a ?? "") ? ".AppleSystemUIFont" : Z0.test(a) ? ".SystemUIFont" : Q0(a).split(",")[0].trim(), F0 = {
  click: ["onClick", "onClickCapture"],
  double_click: ["onDoubleClick"],
  context_menu: ["onContextMenu"],
  mouse_down: ["onPointerDown", "onMouseDown", "onPointerDownCapture", "onMouseDownCapture"],
  mouse_up: ["onPointerUp", "onMouseUp", "onPointerCancel"],
  mouse_move: ["onPointerMove", "onMouseMove"],
  key_down: ["onKeyDown", "onKeyUp"],
  focus: ["onFocus", "onBlur"],
  input: ["onChange", "onInput"]
}, qd = { pointerdown: "mouse_down", mousedown: "mouse_down", click: "click", keydown: "key_down", pointerup: "mouse_up", mouseup: "mouse_up" }, Tf = (a) => {
  const l = a.props["data-testid"];
  if (l) return `${a.tagName}[data-testid="${l}"]`;
  if (a.props.id) return `${a.tagName}#${a.props.id}`;
  const s = a.classList.find((i) => !i.includes(":") && !i.includes("[")) ?? a.classList[0];
  if (s) return `${a.tagName}.${s}`;
  const o = a.parentElement;
  return o && o.tagName !== "body" ? `${Tf(o)} > ${a.tagName}` : a.tagName;
};
class I0 {
  constructor() {
    this.map = /* @__PURE__ */ new Map();
  }
  add(l, s, o, i, d, m = "") {
    const f = `${l}|${s}|${o}|${i}`, b = this.map.get(f);
    if (b) {
      !b.elements.includes(d) && b.elements.length < 4 && b.elements.push(d), b.count++;
      return;
    }
    this.map.set(f, { kind: l, property: s, value: String(o), class: i ?? null, elements: [d], count: 1, ...m ? { note: m } : {} });
  }
  list() {
    return [...this.map.values()].sort((l, s) => l.kind < s.kind ? -1 : l.kind > s.kind ? 1 : l.property < s.property ? -1 : l.property > s.property ? 1 : 0);
  }
}
const mn = (a) => {
  if (a != null) {
    if (typeof a == "string") return a === "auto" || a === "none" || a === "normal" ? "auto" : void 0;
    if ("px" in a) return Math.round(Math.min(Math.max(a.px, -9999), 9999) * 100) / 100;
    if ("pct" in a) return `${Math.round(a.pct * 1e3) / 1e3}%`;
  }
}, P0 = /^(text|search|url|email|tel|password|number)$/, $0 = 162.13 / 12.8;
function tg(a, l) {
  const s = typeof a == "object" && /^min\((.*)\)$/.exec(String(a?.expr ?? "").trim());
  if (!s) return;
  const o = ae(s[1], ",").map((i) => qn(i.trim(), { fontSize: l })).filter((i) => i && !i.pct && !i.num).map((i) => i.px);
  return o.length ? Math.min(...o) : void 0;
}
function eg(a, l) {
  if (typeof a != "object" || !a?.expr) return !1;
  const s = qn(a.expr, { fontSize: l["font-size"] }), o = (l["margin-left"]?.px ?? NaN) + (l["margin-right"]?.px ?? NaN);
  return !!s && !s.num && s.pct === 100 && Math.abs(s.px + o) < 0.01;
}
function Cf(a) {
  const l = a.transform;
  if (l && l !== "none") {
    const o = /^\s*translate(X|Y)?\(([^]*)\)\s*$/.exec(l), i = o && ae(o[2], ",").map((d) => d.trim());
    return !i || i.length > (o[1] ? 1 : 2) ? null : o[1] === "X" ? [i[0], "0"] : o[1] === "Y" ? ["0", i[0]] : [i[0], i[1] ?? "0"];
  }
  const s = a.translate;
  if (s && s !== "none") {
    const o = ae(String(s).trim(), " ").filter(Boolean);
    return o.length > 3 || o[2] !== void 0 && qn(o[2], {})?.px ? null : [o[0], o[1] ?? "0"];
  }
  return [];
}
function Yd(a, l, s, o = !1) {
  const i = a.values, d = Cf(i);
  if (d?.length === 0) return;
  const m = i.transform && i.transform !== "none" ? "transform" : "translate", f = { fontSize: i["font-size"] }, b = (k, w) => {
    const N = qn(k, f);
    if (!(!N || N.unitless && N.num))
      return N.pct ? typeof w == "number" ? N.px + N.pct / 100 * w : void 0 : N.px;
  }, x = d ? b(d[0], l.w) : void 0, E = d ? b(d[1], l.h) : void 0;
  if (x === void 0 || E === void 0) {
    const k = !o && d ? d.map((w) => qn(w, f)) : null;
    if (k?.every((w) => w && !(w.unitless && w.num))) {
      l[Mf] = k.map((w) => [w.px, w.pct ?? 0]);
      return;
    }
    s("unsupported", m, i[m], a.sources[m]);
    return;
  }
  if (o) {
    x && (l.left = x), E && (l.top = E);
    return;
  }
  x && (l.ml = (l.ml ?? 0) + x), E && (l.mt = (l.mt ?? 0) + E);
}
const Mf = Symbol("perch.shift");
function ng(a, l, s) {
  const o = a.ownerDocument, i = o?.measure?.(a) ?? null;
  if (i) {
    const [[m, f], [b, x]] = s, E = m + f / 100 * i.width, k = b + x / 100 * i.height;
    E && (l.ml = (typeof l.ml == "number" ? l.ml : 0) + E), k && (l.mt = (typeof l.mt == "number" ? l.mt : 0) + k);
  }
  const d = i ? `${i.width}x${i.height}` : "";
  d === a.shiftSeen ? a.shiftTries = 0 : (a.shiftTries ?? 0) < yf && o?.retries && (a.shiftSeen = d, a.shiftTries = (a.shiftTries ?? 0) + 1, o.retries.push(() => o.afterCommit?.()));
}
function Qo(a, l, s = null) {
  const o = a.values, i = {}, d = (A) => a.sources[A], m = (A) => a.sources[A] !== void 0, f = o.display;
  f === "none" ? i.display = "hidden" : f === "flex" || f === "inline-flex" ? i.display = "flex" : (f === "grid" || f === "inline-grid") && (i.display = "flex", i.flex_direction = "col", l("approximated", "display", f, d("display"), "one-column flex column"), o["grid-template-columns"] && o["grid-template-columns"] !== "none" && l("unsupported", "grid-template-columns", o["grid-template-columns"], d("grid-template-columns"))), a.element.hidden && (i.display = "hidden");
  const b = i.display === "flex";
  if (b && i.flex_direction !== "col") {
    const A = { row: "row", column: "col", "row-reverse": "row_reverse", "column-reverse": "col_reverse" }[o["flex-direction"]] ?? "row";
    i.flex_direction = A;
  }
  if (b) {
    (o["flex-wrap"] === "wrap" || o["flex-wrap"] === "wrap-reverse") && (i.flex_wrap = "wrap");
    const A = f === "grid" || f === "inline-grid", X = { "flex-start": "start", start: "start", "self-start": "start", "flex-end": "end", end: "end", "self-end": "end", center: "center", baseline: "baseline", "first baseline": "baseline" }[o["align-items"]];
    X && (i.items = X);
    let q = { "flex-start": "start", start: "start", "flex-end": "end", end: "end", center: "center", "space-between": "between", "space-around": "around", "space-evenly": "evenly" }[o["justify-content"]];
    if (A) {
      const p = { center: "center", end: "end", "flex-end": "end", start: "start", "flex-start": "start" }[o["justify-items"]];
      p && (i.items = p), o["align-items"] === "center" && (q = "center");
    }
    q && (i.justify = q);
    const O = mn(o["row-gap"]), h = mn(o["column-gap"]);
    typeof O == "number" && O && (i.gap_y = O), typeof h == "number" && h && !A && (i.gap_x = h);
  }
  o["flex-grow"] && (i.flex_grow = o["flex-grow"]), o["flex-shrink"] !== 1 && (i.flex_shrink = o["flex-shrink"]);
  const x = mn(o["flex-basis"]);
  x !== void 0 && x !== "auto" && (i.flex_basis = x);
  const E = { "flex-start": "start", start: "start", "flex-end": "end", end: "end", center: "center", baseline: "baseline", stretch: "stretch" }[o["align-self"]];
  E && (i.self = E);
  for (const [A, X] of [["w", "width"], ["h", "height"], ["min_w", "min-width"], ["min_h", "min-height"], ["max_w", "max-width"], ["max_h", "max-height"]]) {
    const q = o[X], O = mn(q);
    if (O === void 0 && X === "width" && eg(q, o)) {
      i.self = "stretch", l("approximated", X, q.expr, d(X), "stretched across its parent, inside its margins");
      continue;
    }
    const h = O === void 0 && /^max-/.test(X) ? tg(q, o["font-size"]) : void 0;
    if (h !== void 0) {
      i[A] = h, l("approximated", X, q.expr, d(X), "the fixed bound of min()");
      continue;
    }
    if (O === void 0) {
      typeof q == "object" && q.expr ? l("unsupported", X, q.expr, d(X), "no calc() in the engine") : typeof q == "string" && !["auto", "none"].includes(q) && l("unsupported", X, q, d(X));
      continue;
    }
    O !== "auto" && (i[A] = O);
  }
  const k = ["top", "right", "bottom", "left"];
  for (const A of k) {
    const X = A[0];
    for (const [q, O] of [["p", "padding"], ["m", "margin"]]) {
      const h = o[`${O}-${A}`], p = mn(h);
      if (p === void 0) {
        h?.expr && l("unsupported", `${O}-${A}`, h.expr, d(`${O}-${A}`), "no calc() in the engine");
        continue;
      }
      p !== 0 && (i[`${q}${X}`] = p);
    }
  }
  const w = o.position;
  if (w === "absolute" || w === "fixed") {
    i.position = "absolute", w === "fixed" && l("approximated", "position", "fixed", d("position"), "absolute in the overlay layer");
    for (const A of k) {
      const X = mn(o[A]);
      X !== void 0 && X !== "auto" && (i[A] = X);
    }
    if (w === "fixed" && s && i.w === void 0 && i.right === void 0 && typeof i.left == "number") {
      const A = s.width - i.left - (typeof i.ml == "number" ? i.ml : 0) - (typeof i.mr == "number" ? i.mr : 0);
      i.max_w = typeof i.max_w == "number" ? Math.min(i.max_w, A) : A;
    }
    Yd(a, i, l);
  } else w === "sticky" ? l("unsupported", "position", "sticky", d("position")) : Cf(o)?.length !== 0 && (i.position = "relative", Yd(a, i, l, !0));
  o["z-index"] !== "auto" && m("z-index") && l("unsupported", "z-index", o["z-index"], d("z-index"), "paint order is tree order");
  for (const [A, X] of [["overflow_x", "overflow-x"], ["overflow_y", "overflow-y"]]) {
    const q = o[X];
    q === "hidden" || q === "clip" ? i[A] = "hidden" : (q === "auto" || q === "scroll") && (i[A] = "scroll");
  }
  (o.visibility === "hidden" || o.visibility === "collapse") && (i.visibility = "invisible");
  const N = o["background-color"];
  N?.unreadable ? l("unsupported", "background-color", N.unreadable, d("background-color")) : N?.rgba && N.rgba[3] > 0 && (i.bg = Ur(N)), o["background-image"] && o["background-image"] !== "none" && l("unsupported", "background-image", o["background-image"], d("background-image"));
  const _ = k.map((A) => mn(o[`border-${A}-width`]) || 0), y = [];
  k.forEach((A, X) => {
    if (!_[X]) return;
    i[`border_${A[0]}`] = _[X];
    const q = o[`border-${A}-style`];
    q !== "solid" && l("approximated", `border-${A}-style`, q, d(`border-${A}-style`), "drawn solid");
    const O = Ur(o[`border-${A}-color`]);
    O && y.push(O);
  }), y.length && (i.border_color = y[0], y.some((A) => A.value !== y[0].value) && l("approximated", "border-color", y.map((A) => A.value).join(" "), d("border-top-color"), "one border colour"));
  const z = (A) => {
    const X = mn(o[`border-${A}-radius`]) || 0;
    if (typeof X != "string") return X;
    const q = parseFloat(X) / 100, O = [i.w, i.h].filter((h) => typeof h == "number");
    return X === "auto" || !(q > 0) ? 0 : O.length ? Math.round(Math.min(q, 0.5) * Math.min(...O) * 100) / 100 : 9999;
  }, R = ["top-left", "top-right", "bottom-right", "bottom-left"].map(z);
  R.every((A) => A === R[0]) ? R[0] && (i.rounded = R[0]) : ["tl", "tr", "br", "bl"].forEach((A, X) => {
    R[X] && (i[`rounded_${A}`] = R[X]);
  }), o.opacity !== 1 && (i.opacity = Math.round(o.opacity * 1e3) / 1e3);
  const D = o["box-shadow"];
  if (D && D !== "none" && ae(D, ",").some((A) => !/^0(px)?\s+0(px)?\s+(0(px)?\s+)?(0(px)?\s+)?(#0000|transparent|rgba?\(0,\s*0,\s*0,\s*0\))/.test(A.trim())) && (i.shadow = "lg", l("approximated", "box-shadow", D, d("box-shadow"), "the engine's large shadow preset")), o.cursor && o.cursor !== "auto" && !a.inherited.has("cursor")) {
    const A = { pointer: "pointer", default: "default", text: "text", move: "move", "not-allowed": "not_allowed", grab: "move", grabbing: "move" }[o.cursor];
    A ? i.cursor = A : l("unsupported", "cursor", o.cursor, d("cursor"));
  }
  return o["text-overflow"] === "ellipsis" && (i.text_ellipsis = !0), o["text-decoration-line"] === "underline" ? i.underline = !0 : o["text-decoration-line"] && o["text-decoration-line"] !== "none" && l("unsupported", "text-decoration-line", o["text-decoration-line"], d("text-decoration-line")), i;
}
const ag = { "tabular-nums": "tnum", "proportional-nums": "pnum", "lining-nums": "lnum", "oldstyle-nums": "onum", "slashed-zero": "zero", "diagonal-fractions": "frac", "stacked-fractions": "afrc", ordinal: "ordn" };
function Af(a) {
  if (!a || a === "normal") return "";
  const l = String(a).trim().split(/\s+/).map((s) => ag[s]);
  return l.every(Boolean) ? l.join(",") : null;
}
function Vo(a, l) {
  const s = a.values, o = s["line-height"];
  return {
    text_color: Ur(s.color),
    text_size: Math.round(s["font-size"] * 1e3) / 1e3,
    font_features: Af(s["font-variant-numeric"]) ?? "",
    font_weight: s["font-weight"],
    line_height: o.factor !== void 0 ? { factor: o.factor } : { px: Math.round(qr(s, l) * 1e3) / 1e3 },
    font_family: W0(s["font-family"]),
    italic: s["font-style"] === "italic" || s["font-style"] === "oblique",
    whitespace: s["white-space"] === "nowrap" || s["white-space"] === "pre" ? "nowrap" : "normal",
    text_align: { center: "center", right: "right", end: "right" }[s["text-align"]] ?? "left"
  };
}
const Gd = (a, l) => a.factor !== void 0 ? a.factor * l : a.px, jf = (a, l) => JSON.stringify(a) === JSON.stringify(l);
function Xo(a, l, s) {
  const o = {}, i = (f, b) => b.some((x) => !a.inherited.has(x));
  for (const [f, b] of [["text_color", ["color"]], ["text_size", ["font-size"]], ["font_weight", ["font-weight"]], ["font_family", ["font-family"]], ["italic", ["font-style"]], ["whitespace", ["white-space"]], ["text_align", ["text-align"]], ["font_features", ["font-variant-numeric"]]])
    (i(f, b) || !jf(l[f], s[f])) && (o[f] = l[f]);
  const d = Gd(l.line_height, l.text_size), m = s.line_height ? Gd(s.line_height, l.text_size) : NaN;
  return (i("line_height", ["line-height"]) || !(Math.abs(d - m) <= 1e-3)) && (o.line_height = l.line_height), o;
}
const lg = (a, l) => ({ ...a, ...l });
function Lo(a, l) {
  const s = {};
  for (const [o, i] of Object.entries(a))
    i && typeof i == "object" && "value" in i ? (s[o] = i.value, i.token && (l[o] = i.token)) : o === "line_height" ? s[o] = i.factor !== void 0 ? Math.round(i.factor * 1e3) / 1e3 : `${i.px}px` : o === "italic" ? i && (s.italic = !0) : s[o] = i;
  return s.italic === !1 && delete s.italic, s;
}
function Kd(a, l) {
  const s = {};
  for (const o of /* @__PURE__ */ new Set([...Object.keys(a), ...Object.keys(l)])) {
    const i = a[o], d = l[o];
    jf(i, d) || (s[o] = d === void 0 ? o in Yr ? Yr[o] : null : d);
  }
  return s;
}
function Qd(a, l) {
  const s = a.values;
  for (const [o, i] of Object.entries(a.sources)) {
    if (o.startsWith("--") || L0.has(o) || i.startsWith("ua:")) continue;
    const d = s[o];
    switch (o) {
      case "letter-spacing":
        d !== "normal" && d?.px !== 0 && l("approximated", o, d?.px !== void 0 ? `${Math.round(d.px * 1e3) / 1e3}px` : d, i, "the run is as wide as with the spacing (room after it), the letters are not spread");
        break;
      case "font-variant-numeric":
        d !== "normal" && Af(d) === null && l("unsupported", o, d, i);
        break;
      case "text-transform":
        d !== "none" && l("approximated", o, d, i, "applied to the text in JS");
        break;
      case "transition-property":
      case "transition-duration": {
        const m = s["transition-duration"];
        o === "transition-property" && m && ae(m, ",").some((f) => parseFloat(f) > 0) && s["transition-property"] !== "none" && l("unsupported", "transition", `${s["transition-property"]} ${m}`, i, "changes are instant (the engine animates only opacity and size)");
        break;
      }
      case "-webkit-line-clamp":
        d !== "none" && l("unsupported", o, d, i, "no line clamp in the engine");
        break;
      case "-webkit-box-orient":
      case "overflow-wrap":
        o === "overflow-wrap" && d !== "normal" && l("approximated", o, d, i, "lines broken by the translator where the box's width is known (`break_anywhere`)");
        break;
      case "outline-style":
      case "outline-width":
      case "outline-color":
        s["outline-style"] !== "none" && o === "outline-style" && l("unsupported", "outline", `${mn(s["outline-width"])}px ${s["outline-style"]} ${Ur(s["outline-color"])?.value ?? ""}`.trim(), i, "no outline in the engine (no focus ring)");
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
        d && d !== "none" && d !== "auto" && d !== "normal" && d !== "initial" && l("unsupported", o, d, i);
        break;
    }
  }
}
function rg(a, l, s, o) {
  const i = Tf(a), d = [], m = (R, D, A, X, q) => d.push([R, D, A, X ?? "(user agent)", i, q]), f = o.cascade.compute(a, l), b = {}, x = Qo(f, m, o.viewport), E = x[Mf];
  Qd(f, m);
  const k = Vo(f, o.measure), w = Xo(f, k, s), N = Lo({ ...x, ...w }, b), _ = {}, y = o.cascade.matching(a, "*").filter((R) => R.states.subject.size);
  for (const [R, D] of [["hover", ["hover"]], ["focus", ["focus", "focus-visible"]], ["active", ["active", "hover"]]]) {
    if (!y.some((h) => D.some((p) => h.states.subject.has(p)))) continue;
    const A = o.cascade.compute(a, l, new Set(D)), X = {}, q = Lo({ ...Qo(A, () => {
    }), ...Xo(A, Vo(A, o.measure), s) }, X);
    R === "focus" && Qd(A, m);
    const O = Kd(N, q);
    if (Object.keys(O).length) {
      _[R] = O;
      const h = Object.fromEntries(Object.entries(X).filter(([p]) => p in O));
      Object.keys(h).length && (_[`${R}_tokens`] = h);
    }
  }
  if (o.cascade.sheet.tracks(a, "hover") && (_.group = Vd(a), _.track_hover = !0), o.cascade.sheet.readsAncestor(a, "hover"))
    for (let R = a.parentNode; R?.state; R = R.parentNode) {
      if (!o.cascade.sheet.tracks(R, "hover")) continue;
      const D = R.state.hover;
      R.state.hover = !0;
      let A;
      try {
        A = o.cascade.compute(a, l);
      } finally {
        R.state.hover = D;
      }
      const X = {}, q = Lo({ ...Qo(A, () => {
      }), ...Xo(A, Vo(A, o.measure), s) }, X), O = Kd(N, q);
      if (!Object.keys(O).length) continue;
      const h = Object.fromEntries(Object.entries(X).filter(([p]) => p in O));
      (_.group_hover ??= []).push({ group: Vd(R), style: O, ...Object.keys(h).length ? { tokens: h } : {} });
    }
  if (/tabular/.test(String(f.values["font-variant-numeric"] ?? "")) && (_.tabular = !0), /^(anywhere|break-word)$/.test(String(f.values["overflow-wrap"] ?? "")) && (_.break_anywhere = !0), x.overflow_y === "scroll") {
    const R = Number.parseFloat(f.customs?.["--scrollbar-size"] ?? "");
    R > 0 && (_.scrollbar = R);
  }
  f.values["pointer-events"] !== "none" && l?.values["pointer-events"] === "none" && (_.blocks_pointer = !0);
  const z = Object.entries(F0).filter(([, R]) => R.some((D) => typeof a.props[D] == "function")).map(([R]) => R);
  return !z.includes("click") && ts(a) && z.push("click"), z.length && (_.events = z), { computed: f, style: N, tokens: b, extra: _, meta: cg(a), reports: d, childText: lg(s, w), where: i, shift: E };
}
const Vd = (a) => `~g${a.id}`;
function Of(a, l, s, o, i = "") {
  const d = `${i}/${a.id}.${a.version}`;
  let m = o.cache.get(a);
  (!m || m.key !== d) && o.cache.set(a, m = { key: d, part: rg(a, l, s, o) });
  const { computed: f, tokens: b, extra: x, reports: E, childText: k, where: w } = m.part;
  for (const p of E) o.findings.add(...p);
  const N = (p, v, S, M, H) => o.findings.add(p, v, S, M, w, H), _ = { ...m.part.style };
  m.part.shift && ng(a, _, m.part.shift);
  const y = { kind: "div", id: a.id, style: _, tokens: b, meta: m.part.meta, ...x };
  Object.defineProperty(y, ia, { value: f.values.display }), a.measured && a.ownerDocument?.measureKey && (y.measure = a.ownerDocument.measureKey(a));
  const z = a.tagName;
  if (z === "svg")
    return y.kind = a.props["data-perch-image"] ? "image" : "svg", y.markup = dg(a), y;
  if (z === "input" || z === "textarea" || z === "select") {
    y.kind = "input", y.input_type = z === "input" ? String(a.props.type ?? "text") : z;
    for (const p of ["placeholder", "checked", "disabled"]) a.props[p] !== void 0 && (y[p] = a.props[p]);
    if (/^(checkbox|radio)$/.test(y.input_type) && (y.checked = a.checked), z !== "select" && (y.value = a.value), z === "input" && P0.test(y.input_type) && (y.field_w = $0 * f.values["font-size"]), z === "textarea" && _.h === void 0) {
      const p = f.values, v = (H) => H && typeof H == "object" && "px" in H ? H.px : 0, S = (H) => p[`border-${H}-style`] === "none" ? 0 : v(p[`border-${H}-width`]), M = Number(a.props.rows) > 0 ? Math.floor(Number(a.props.rows)) : 2;
      _.h = M * qr(p, o.measure) + v(p["padding-top"]) + v(p["padding-bottom"]) + S("top") + S("bottom");
    }
    return y;
  }
  if (z === "img") {
    y.kind = "image", y.src = a.props.src ?? null;
    for (const [p, v] of [["width", "w"], ["height", "h"]]) {
      const S = Number(a.props[p]);
      _[v] === void 0 && a.props[p] != null && Number.isFinite(S) && (_[v] = S);
    }
    return y;
  }
  const R = f.values["text-transform"], D = [];
  let A = !1, X = !1;
  for (const p of a.childNodes) {
    if (p instanceof Jr) {
      if (p.hidden || p.data === "") continue;
      A = !0;
      const M = D[D.length - 1];
      if (M?.kind === "text")
        M.source = (M.source ?? M.text) + p.data, M.text = Xd(M.source, R), M.text === M.source && delete M.source;
      else {
        const H = Xd(p.data, R);
        D.push(H === p.data ? { kind: "text", text: H } : { kind: "text", text: H, source: p.data });
      }
      continue;
    }
    if (!(p instanceof It)) continue;
    const v = Of(p, f, k, o, d), S = v[ia];
    S === "inline" || S === "inline-block" || S === "inline-flex" ? A = !0 : S !== "none" && (X = !0), D.push(v);
  }
  if (/(^|\s)inline-flex(\s|$)/.test(String(a.props?.className ?? "")) && _.w === void 0)
    for (const p of D)
      p.style?.flex_grow && p.style.min_w === 0 && p.style.overflow_x === "hidden" && (delete p.style.min_w, delete p.style.flex_grow, delete p.style.flex_basis, delete p.style.overflow_x, delete p.style.overflow_y);
  if (!_.display && A && D.some((p) => p.kind !== "text") && D.every((p) => p.kind === "text" || p.kind === "div" && p[ia] === "inline" && !p.events?.length && p.children?.every((v) => v.kind === "text"))) {
    const p = D.map((v) => v.kind === "text" ? v.text : v.children.map((S) => S.text).join("")).join("");
    N("approximated", "display", "inline text elements in a line of text", "(inline formatting)", "their text joined to the line, in its font"), D.splice(0, D.length, { kind: "text", text: p });
  }
  const q = D.some((p) => p.kind !== "text"), O = D.length === 1 && D[0].kind !== "text" && /^inline-(block|flex)$/.test(D[0][ia]) ? D[0] : null;
  if (!_.display && O) {
    const p = o.cache.get(a.childNodes.find((S) => S.id === O.id))?.part.computed, v = p ? Kr(f.values, o.measure) - sg(p.values, o.measure, O) : 0;
    _.display = "flex", _.flex_direction = "col", _.items = "start", v > 0 && (O.style.mt = Math.round(((O.style.mt ?? 0) + v) * 100) / 100), N("approximated", "display", `${f.values.display} holding one ${O[ia]} box`, "(inline formatting)", "a column, the box lowered to the line's baseline");
  } else if (!_.display && D.length === 1 && (D[0].kind === "svg" || D[0].kind === "image") && D[0][ia] === "inline" && typeof D[0].style.h == "number") {
    const p = D[0], v = Kr(f.values, o.measure), S = qr(f.values, o.measure) - v, M = (H) => Math.round(H * 100) / 100;
    _.display = "flex", _.flex_direction = "col", _.items = "start", v > p.style.h && (p.style.mt = M((p.style.mt ?? 0) + v - p.style.h)), S > 0 && (p.style.mb = M((p.style.mb ?? 0) + S)), N("approximated", "display", `${f.values.display} holding one inline image`, "(inline formatting)", "a column, the image on the line's baseline");
  } else if (!_.display && A && q) {
    if (_.display = "flex", _.flex_direction = X ? "col" : "row", !X) _.items = "baseline";
    else for (const p of D) p.kind !== "text" && /^inline-(block|flex)$/.test(p[ia]) && !p.style.self && (p.style.self = "start");
    N("approximated", "display", `${f.values.display} with inline content`, "(inline formatting)", X ? "a column of its children" : "a row on the text baseline");
  }
  const h = f.values["letter-spacing"]?.px;
  if (h)
    for (let p = 0; p < D.length; p++) {
      const v = D[p];
      if (v.kind !== "text") continue;
      const S = Math.round(h * [...v.text].length * 1e3) / 1e3;
      D[p] = { kind: "div", style: { pr: S }, tokens: {}, children: [v] };
    }
  return y.children = D, y;
}
function ig(a, l) {
  if (!l) return null;
  let o = (l.self ? a : l.closest ? bf(a, l.closest) : l.find ? _l(a, l.find)[0] : null)?.getAttribute(l.attr) ?? null;
  return o && l.strip && o.startsWith(l.strip) && (o = o.slice(l.strip.length)), o;
}
function og(a, l, s) {
  const o = l.map((m) => [m, Zr(m.selector)]), i = /* @__PURE__ */ new Map(), d = (m) => {
    for (const f of m.children) {
      const b = s.get(f.id);
      if (b)
        for (const [x, E] of o) {
          const k = x.textRange ? "range_name" : "name";
          if (x.textRange && b[k] != null || !E.some((y) => gf(f, y))) continue;
          const w = ig(f, x.key), N = w == null ? i.get(x.name) ?? 0 : 0;
          w == null && i.set(x.name, N + 1);
          const _ = w != null ? `${x.name}:${w}` : N ? `${x.name}@${N}` : x.name;
          b[k] == null ? b[k] = _ : (b.also ??= []).push(_);
        }
      d(f);
    }
  };
  d(a.documentElement);
}
const Gr = 0.9521, Rf = 0.2256, Kr = (a, l) => (qr(a, l) - (Gr + Rf) * a["font-size"]) / 2 + Gr * a["font-size"];
function sg(a, l, s) {
  const o = (b) => b && typeof b == "object" && "px" in b ? b.px : 0, i = a["border-top-style"] === "none" ? 0 : o(a["border-top-width"]), d = s?.children ?? [], m = d.length === 1 && (d[0].kind === "svg" || d[0].kind === "image") && typeof d[0].style.h == "number" ? d[0] : null, f = m ? Math.max(Kr(a, l), (m.style.mt ?? 0) + m.style.h) : Kr(a, l);
  return o(a["padding-top"]) + i + f;
}
const Xd = (a, l) => l === "uppercase" ? a.toUpperCase() : l === "lowercase" ? a.toLowerCase() : l === "capitalize" ? a.replace(/\b\p{L}/gu, (s) => s.toUpperCase()) : a, Df = /* @__PURE__ */ new Set(["children", "style", "className", "key", "ref", "dangerouslySetInnerHTML"]);
function cg(a) {
  const l = {};
  for (const [s, o] of Object.entries(a.props)) {
    if (Df.has(s) || typeof o == "function" || o === void 0 || o === null || typeof o == "object") continue;
    const i = s.startsWith("aria-") || s.startsWith("data-");
    if (o === !1 && !i) continue;
    const d = s === "htmlFor" ? "for" : s === "tabIndex" ? "tabindex" : s;
    l[d] = typeof o == "boolean" ? i ? String(o) : "" : String(o);
  }
  return { tag: a.tagName, classes: a.classList, attrs: l };
}
const ug = (a) => a === "className" ? "class" : /^(viewBox|preserveAspectRatio|gradientUnits|gradientTransform|patternUnits|xmlns)$/.test(a) ? a : a.replace(/[A-Z]/g, (l) => `-${l.toLowerCase()}`), Ld = (a) => String(a).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
function dg(a) {
  if (a.props["data-perch-markup"]) return String(a.props["data-perch-markup"]);
  const l = (s) => {
    const o = [];
    for (const [d, m] of Object.entries(s.props))
      Df.has(d) || typeof m == "function" || m === void 0 || m === null || m === !1 || typeof m == "object" || d.startsWith("data-") || d.startsWith("aria-") || d === "focusable" || d === "role" || d === "title" || o.push(`${ug(d)}="${Ld(m === !0 ? "" : m)}"`);
    s.tagName === "svg" && !s.props.xmlns && o.unshift('xmlns="http://www.w3.org/2000/svg"');
    const i = s.childNodes.map((d) => d instanceof Jr ? Ld(d.data) : l(d)).join("");
    return `<${s.tagName}${o.length ? ` ${o.join(" ")}` : ""}>${i}</${s.tagName}>`;
  };
  return l(a);
}
function fg(a) {
  const l = a.theme?.() ?? {}, s = {};
  for (const o of kf) l[o] && (s[o] = l[o]);
  return s;
}
const mg = { font_features: "" };
function pg(a, l, s, o = {}, i = null) {
  const d = fg(l), m = l.viewport?.() ?? { width: 1e3, height: 800 }, f = JSON.stringify([d, m]);
  (o.look !== f || o.sheet !== s) && Object.assign(o, { look: f, sheet: s, cache: /* @__PURE__ */ new WeakMap(), cascade: new Y0(s, { theme: d, viewport: m }), top: null });
  const { cascade: b, cache: x } = o, E = { cascade: b, cache: x, viewport: m, findings: new I0(), measure: l.lineHeight ? (N) => l.lineHeight(N) : null };
  o.top ??= b.compute(a.body, b.compute(a.documentElement, null));
  const k = a.body.children.map((N) => Of(N, o.top, mg, E));
  if (i?.length) {
    const N = /* @__PURE__ */ new Map(), _ = (y) => {
      y.id && N.set(y.id, y);
      for (const z of y.children ?? []) _(z);
    };
    k.forEach(_), og(a, i, N);
  }
  const w = /* @__PURE__ */ new Set();
  for (const N of [a, a.defaultView])
    for (const { type: _ } of N?.listeners ?? []) qd[_] && w.add(qd[_]);
  return { schema: V0, root: k[0] ?? null, overlays: k.slice(1), document_events: [...w].sort(), unsupported: E.findings.list() };
}
const hg = { layers: ["properties", "theme", "base", "utilities"], properties: { "--tw-translate-x": { inherits: !1, initial: "0" }, "--tw-translate-y": { inherits: !1, initial: "0" }, "--tw-translate-z": { inherits: !1, initial: "0" }, "--tw-rotate-x": { inherits: !1, initial: null }, "--tw-rotate-y": { inherits: !1, initial: null }, "--tw-rotate-z": { inherits: !1, initial: null }, "--tw-skew-x": { inherits: !1, initial: null }, "--tw-skew-y": { inherits: !1, initial: null }, "--tw-space-y-reverse": { inherits: !1, initial: "0" }, "--tw-border-style": { inherits: !1, initial: "solid" }, "--tw-leading": { inherits: !1, initial: null }, "--tw-font-weight": { inherits: !1, initial: null }, "--tw-tracking": { inherits: !1, initial: null }, "--tw-ordinal": { inherits: !1, initial: null }, "--tw-slashed-zero": { inherits: !1, initial: null }, "--tw-numeric-figure": { inherits: !1, initial: null }, "--tw-numeric-spacing": { inherits: !1, initial: null }, "--tw-numeric-fraction": { inherits: !1, initial: null }, "--tw-shadow": { inherits: !1, initial: "0 0 #0000" }, "--tw-shadow-color": { inherits: !1, initial: null }, "--tw-shadow-alpha": { inherits: !1, initial: "100%" }, "--tw-inset-shadow": { inherits: !1, initial: "0 0 #0000" }, "--tw-inset-shadow-color": { inherits: !1, initial: null }, "--tw-inset-shadow-alpha": { inherits: !1, initial: "100%" }, "--tw-ring-color": { inherits: !1, initial: null }, "--tw-ring-shadow": { inherits: !1, initial: "0 0 #0000" }, "--tw-inset-ring-color": { inherits: !1, initial: null }, "--tw-inset-ring-shadow": { inherits: !1, initial: "0 0 #0000" }, "--tw-ring-inset": { inherits: !1, initial: null }, "--tw-ring-offset-width": { inherits: !1, initial: "0" }, "--tw-ring-offset-color": { inherits: !1, initial: "#fff" }, "--tw-ring-offset-shadow": { inherits: !1, initial: "0 0 #0000" }, "--tw-outline-style": { inherits: !1, initial: "solid" }, "--tw-blur": { inherits: !1, initial: null }, "--tw-brightness": { inherits: !1, initial: null }, "--tw-contrast": { inherits: !1, initial: null }, "--tw-grayscale": { inherits: !1, initial: null }, "--tw-hue-rotate": { inherits: !1, initial: null }, "--tw-invert": { inherits: !1, initial: null }, "--tw-opacity": { inherits: !1, initial: null }, "--tw-saturate": { inherits: !1, initial: null }, "--tw-sepia": { inherits: !1, initial: null }, "--tw-drop-shadow": { inherits: !1, initial: null }, "--tw-drop-shadow-color": { inherits: !1, initial: null }, "--tw-drop-shadow-alpha": { inherits: !1, initial: "100%" }, "--tw-drop-shadow-size": { inherits: !1, initial: null }, "--tw-backdrop-blur": { inherits: !1, initial: null }, "--tw-backdrop-brightness": { inherits: !1, initial: null }, "--tw-backdrop-contrast": { inherits: !1, initial: null }, "--tw-backdrop-grayscale": { inherits: !1, initial: null }, "--tw-backdrop-hue-rotate": { inherits: !1, initial: null }, "--tw-backdrop-invert": { inherits: !1, initial: null }, "--tw-backdrop-opacity": { inherits: !1, initial: null }, "--tw-backdrop-saturate": { inherits: !1, initial: null }, "--tw-backdrop-sepia": { inherits: !1, initial: null }, "--tw-duration": { inherits: !1, initial: null }, "--tw-ease": { inherits: !1, initial: null }, "--tw-content": { inherits: !1, initial: '""' } }, rules: [[":root, :host", null, 2, [["--spacing", ".25rem"], ["--text-xs", ".75rem"], ["--text-xs--line-height", "calc(1 / .75)"], ["--text-sm", ".875rem"], ["--text-sm--line-height", "calc(1.25 / .875)"], ["--font-weight-normal", "400"], ["--font-weight-medium", "500"], ["--font-weight-semibold", "600"], ["--font-weight-bold", "700"], ["--tracking-normal", "0em"], ["--tracking-wide", ".025em"], ["--leading-tight", "1.25"], ["--leading-relaxed", "1.625"], ["--ease-out", "cubic-bezier(0, 0, .2, 1)"], ["--animate-pulse", "pulse 2s cubic-bezier(.4, 0, .6, 1) infinite"], ["--blur-xl", "24px"], ["--default-transition-duration", ".15s"], ["--default-transition-timing-function", "cubic-bezier(.4, 0, .2, 1)"], ["--animate-toast-in", "toast-in .2s cubic-bezier(.22, 1, .36, 1)"], ["--animate-host-pulse", "host-connecting-pulse 1.4s ease-in-out infinite"], ["--animate-drop-zone", "drop-zone-in .14s ease-out, drop-zone-pulse 1.2s ease-in-out .14s infinite"]]], ["::selection", null, 3, [["background", "var(--accent)"], ["color", "var(--panel-bg)"]]], [":where(input, textarea)::placeholder", null, 3, [["color", "var(--subtext-0)"], ["opacity", "1"]]], [":where(button, input, select, textarea)", null, 3, [["border", "0"]]], [':where(button, a[href], select, summary, [role="button"], [role="menuitem"]):focus-visible', null, 3, [["outline", "2px solid var(--accent)"], ["outline-offset", "-2px"]]], ["::-webkit-scrollbar", null, 3, [["width", "var(--scrollbar-size)"], ["height", "var(--scrollbar-size)"]]], ["::-webkit-scrollbar-track", null, 3, [["background", "none"]]], ["::-webkit-scrollbar-corner", null, 3, [["background", "none"]]], ["::-webkit-scrollbar-thumb", null, 3, [["background", "var(--text)"]]], ["::-webkit-scrollbar-thumb", null, 3, [["background", "color-mix(in srgb, var(--text) 20%, transparent)"]]], ["::-webkit-scrollbar-thumb", null, 3, [["border-radius", "var(--scrollbar-size)"]]], ["::-webkit-scrollbar-thumb:hover", null, 3, [["background", "var(--text)"]]], ["::-webkit-scrollbar-thumb:hover", null, 3, [["background", "color-mix(in srgb, var(--text) 40%, transparent)"]]], [".xterm .xterm-scrollable-element > .xterm-scrollbar > .xterm-slider", null, 3, [["border-radius", "var(--scrollbar-size)"]]], [".\\@container, .\\[container-type\\:inline-size\\]", null, 4, [["container-type", "inline-size"]]], [".pointer-events-auto", null, 4, [["pointer-events", "auto"]]], [".pointer-events-none", null, 4, [["pointer-events", "none"]]], [".collapse", null, 4, [["visibility", "collapse"]]], [".invisible", null, 4, [["visibility", "hidden"]]], [".visible", null, 4, [["visibility", "visible"]]], [".sr-only", null, 4, [["clip-path", "inset(50%)"], ["white-space", "nowrap"], ["border-width", "0"], ["width", "1px"], ["height", "1px"], ["margin", "-1px"], ["padding", "0"], ["position", "absolute"], ["overflow", "hidden"]]], [".absolute", null, 4, [["position", "absolute"]]], [".fixed", null, 4, [["position", "fixed"]]], [".relative", null, 4, [["position", "relative"]]], [".static", null, 4, [["position", "static"]]], [".sticky", null, 4, [["position", "sticky"]]], [".inset-0", null, 4, [["inset", "0"]]], [".inset-x-0", null, 4, [["inset-inline", "0"]]], [".inset-x-2", null, 4, [["inset-inline", "calc(var(--spacing) * 2)"]]], [".-top-1", null, 4, [["top", "calc(var(--spacing) * -1)"]]], [".-top-1\\.5", null, 4, [["top", "calc(var(--spacing) * -1.5)"]]], [".top-0", null, 4, [["top", "0"]]], [".top-1", null, 4, [["top", "var(--spacing)"]]], [".top-1\\.5", null, 4, [["top", "calc(var(--spacing) * 1.5)"]]], [".top-1\\/2", null, 4, [["top", "50%"]]], [".top-2", null, 4, [["top", "calc(var(--spacing) * 2)"]]], [".top-4", null, 4, [["top", "calc(var(--spacing) * 4)"]]], [".top-\\[0\\.1rem\\]", null, 4, [["top", ".1rem"]]], [".top-\\[7px\\]", null, 4, [["top", "7px"]]], [".top-\\[max\\(0\\.75rem\\,env\\(safe-area-inset-top\\)\\)\\]", null, 4, [["top", "max(.75rem, env(safe-area-inset-top))"]]], [".top-full", null, 4, [["top", "100%"]]], [".top-px", null, 4, [["top", "1px"]]], [".-right-1", null, 4, [["right", "calc(var(--spacing) * -1)"]]], [".-right-1\\.5", null, 4, [["right", "calc(var(--spacing) * -1.5)"]]], [".right-0", null, 4, [["right", "0"]]], [".right-1", null, 4, [["right", "var(--spacing)"]]], [".right-3", null, 4, [["right", "calc(var(--spacing) * 3)"]]], [".right-4", null, 4, [["right", "calc(var(--spacing) * 4)"]]], [".right-\\[0\\.8rem\\]", null, 4, [["right", ".8rem"]]], [".right-\\[0\\.25rem\\]", null, 4, [["right", ".25rem"]]], [".right-\\[max\\(0\\.75rem\\,env\\(safe-area-inset-right\\)\\)\\]", null, 4, [["right", "max(.75rem, env(safe-area-inset-right))"]]], [".bottom-0", null, 4, [["bottom", "0"]]], [".bottom-2", null, 4, [["bottom", "calc(var(--spacing) * 2)"]]], [".bottom-3", null, 4, [["bottom", "calc(var(--spacing) * 3)"]]], [".bottom-\\[0\\.8rem\\]", null, 4, [["bottom", ".8rem"]]], [".bottom-full", null, 4, [["bottom", "100%"]]], [".-left-8", null, 4, [["left", "calc(var(--spacing) * -8)"]]], [".-left-\\[2px\\]", null, 4, [["left", "-2px"]]], [".left-0", null, 4, [["left", "0"]]], [".left-2", null, 4, [["left", "calc(var(--spacing) * 2)"]]], [".left-\\[0\\.1rem\\]", null, 4, [["left", ".1rem"]]], [".left-\\[max\\(0\\.75rem\\,env\\(safe-area-inset-left\\)\\)\\]", null, 4, [["left", "max(.75rem, env(safe-area-inset-left))"]]], [".left-px", null, 4, [["left", "1px"]]], [".isolate", null, 4, [["isolation", "isolate"]]], [".z-4", null, 4, [["z-index", "4"]]], [".z-5", null, 4, [["z-index", "5"]]], [".z-10", null, 4, [["z-index", "10"]]], [".z-20", null, 4, [["z-index", "20"]]], [".z-30", null, 4, [["z-index", "30"]]], [".z-40", null, 4, [["z-index", "40"]]], [".z-50", null, 4, [["z-index", "50"]]], [".z-\\[2\\]", null, 4, [["z-index", "2"]]], [".z-\\[3\\]", null, 4, [["z-index", "3"]]], [".z-\\[5\\]", null, 4, [["z-index", "5"]]], [".z-\\[1000\\]", null, 4, [["z-index", "1000"]]], [".z-\\[2000\\]", null, 4, [["z-index", "2000"]]], [".z-\\[2100\\]", null, 4, [["z-index", "2100"]]], [".z-\\[2200\\]", null, 4, [["z-index", "2200"]]], [".z-\\[3000\\]", null, 4, [["z-index", "3000"]]], [".z-\\[3100\\]", null, 4, [["z-index", "3100"]]], [".z-\\[4000\\]", null, 4, [["z-index", "4000"]]], [".z-\\[9998\\]", null, 4, [["z-index", "9998"]]], [".z-\\[9999\\]", null, 4, [["z-index", "9999"]]], [".z-\\[10000\\]", null, 4, [["z-index", "10000"]]], [".z-auto", null, 4, [["z-index", "auto"]]], [".order-last", null, 4, [["order", "9999"]]], [".col-\\[1\\/-1\\]", null, 4, [["grid-column", "1 / -1"]]], [".container", null, 4, [["width", "100%"]]], [".container", ["(min-width: 40rem)"], 4, [["max-width", "40rem"]]], [".container", ["(min-width: 48rem)"], 4, [["max-width", "48rem"]]], [".container", ["(min-width: 64rem)"], 4, [["max-width", "64rem"]]], [".container", ["(min-width: 80rem)"], 4, [["max-width", "80rem"]]], [".container", ["(min-width: 96rem)"], 4, [["max-width", "96rem"]]], [".m-0", null, 4, [["margin", "0"]]], [".m-2", null, 4, [["margin", "calc(var(--spacing) * 2)"]]], [".m-\\[0\\.7rem\\]", null, 4, [["margin", ".7rem"]]], [".m-auto", null, 4, [["margin", "auto"]]], [".mx-0", null, 4, [["margin-inline", "0"]]], [".mx-0\\.5", null, 4, [["margin-inline", "calc(var(--spacing) * .5)"]]], [".mx-2", null, 4, [["margin-inline", "calc(var(--spacing) * 2)"]]], [".mx-3", null, 4, [["margin-inline", "calc(var(--spacing) * 3)"]]], [".mx-4", null, 4, [["margin-inline", "calc(var(--spacing) * 4)"]]], [".mx-\\[0\\.3rem\\]", null, 4, [["margin-inline", ".3rem"]]], [".mx-\\[0\\.7rem\\]", null, 4, [["margin-inline", ".7rem"]]], [".mx-\\[0\\.65rem\\]", null, 4, [["margin-inline", ".65rem"]]], [".mx-\\[3px\\]", null, 4, [["margin-inline", "3px"]]], [".mx-\\[11px\\]", null, 4, [["margin-inline", "11px"]]], [".mx-auto", null, 4, [["margin-inline", "auto"]]], [".my-0\\.5", null, 4, [["margin-block", "calc(var(--spacing) * .5)"]]], [".my-1", null, 4, [["margin-block", "var(--spacing)"]]], [".my-2", null, 4, [["margin-block", "calc(var(--spacing) * 2)"]]], [".my-\\[0\\.2rem\\]", null, 4, [["margin-block", ".2rem"]]], [".my-\\[0\\.3rem\\]", null, 4, [["margin-block", ".3rem"]]], [".my-\\[0\\.6rem\\]", null, 4, [["margin-block", ".6rem"]]], [".my-\\[0\\.28rem\\]", null, 4, [["margin-block", ".28rem"]]], [".my-\\[0\\.45rem\\]", null, 4, [["margin-block", ".45rem"]]], [".my-\\[0\\.55rem\\]", null, 4, [["margin-block", ".55rem"]]], [".my-\\[3px\\]", null, 4, [["margin-block", "3px"]]], [".-mt-\\[2px\\]", null, 4, [["margin-top", "-2px"]]], [".mt-0", null, 4, [["margin-top", "0"]]], [".mt-0\\.5", null, 4, [["margin-top", "calc(var(--spacing) * .5)"]]], [".mt-1", null, 4, [["margin-top", "var(--spacing)"]]], [".mt-1\\.5", null, 4, [["margin-top", "calc(var(--spacing) * 1.5)"]]], [".mt-2", null, 4, [["margin-top", "calc(var(--spacing) * 2)"]]], [".mt-3", null, 4, [["margin-top", "calc(var(--spacing) * 3)"]]], [".mt-4", null, 4, [["margin-top", "calc(var(--spacing) * 4)"]]], [".mt-\\[0\\.1rem\\]", null, 4, [["margin-top", ".1rem"]]], [".mt-\\[0\\.2rem\\]", null, 4, [["margin-top", ".2rem"]]], [".mt-\\[0\\.3rem\\]", null, 4, [["margin-top", ".3rem"]]], [".mt-\\[0\\.4rem\\]", null, 4, [["margin-top", ".4rem"]]], [".mt-\\[0\\.5rem\\]", null, 4, [["margin-top", ".5rem"]]], [".mt-\\[0\\.15rem\\]", null, 4, [["margin-top", ".15rem"]]], [".mt-\\[0\\.35rem\\]", null, 4, [["margin-top", ".35rem"]]], [".mr-1", null, 4, [["margin-right", "var(--spacing)"]]], [".mr-1\\.5", null, 4, [["margin-right", "calc(var(--spacing) * 1.5)"]]], [".mr-\\[0\\.3rem\\]", null, 4, [["margin-right", ".3rem"]]], [".mr-\\[0\\.7rem\\]", null, 4, [["margin-right", ".7rem"]]], [".mr-auto", null, 4, [["margin-right", "auto"]]], [".mb-0", null, 4, [["margin-bottom", "0"]]], [".mb-0\\.5", null, 4, [["margin-bottom", "calc(var(--spacing) * .5)"]]], [".mb-1", null, 4, [["margin-bottom", "var(--spacing)"]]], [".mb-2", null, 4, [["margin-bottom", "calc(var(--spacing) * 2)"]]], [".mb-3", null, 4, [["margin-bottom", "calc(var(--spacing) * 3)"]]], [".mb-4", null, 4, [["margin-bottom", "calc(var(--spacing) * 4)"]]], [".mb-8", null, 4, [["margin-bottom", "calc(var(--spacing) * 8)"]]], [".mb-\\[0\\.2rem\\]", null, 4, [["margin-bottom", ".2rem"]]], [".mb-\\[0\\.3rem\\]", null, 4, [["margin-bottom", ".3rem"]]], [".mb-\\[0\\.4rem\\]", null, 4, [["margin-bottom", ".4rem"]]], [".mb-\\[0\\.6rem\\]", null, 4, [["margin-bottom", ".6rem"]]], [".mb-\\[0\\.7rem\\]", null, 4, [["margin-bottom", ".7rem"]]], [".mb-\\[0\\.9rem\\]", null, 4, [["margin-bottom", ".9rem"]]], [".mb-\\[0\\.15rem\\]", null, 4, [["margin-bottom", ".15rem"]]], [".mb-\\[0\\.35rem\\]", null, 4, [["margin-bottom", ".35rem"]]], [".mb-\\[0\\.55rem\\]", null, 4, [["margin-bottom", ".55rem"]]], [".mb-\\[1\\.1rem\\]", null, 4, [["margin-bottom", "1.1rem"]]], [".-ml-0\\.5", null, 4, [["margin-left", "calc(var(--spacing) * -.5)"]]], [".-ml-1", null, 4, [["margin-left", "calc(var(--spacing) * -1)"]]], [".-ml-2", null, 4, [["margin-left", "calc(var(--spacing) * -2)"]]], [".ml-1", null, 4, [["margin-left", "var(--spacing)"]]], [".ml-2", null, 4, [["margin-left", "calc(var(--spacing) * 2)"]]], [".ml-\\[0\\.4rem\\]", null, 4, [["margin-left", ".4rem"]]], [".ml-\\[0\\.5rem\\]", null, 4, [["margin-left", ".5rem"]]], [".ml-\\[0\\.9rem\\]", null, 4, [["margin-left", ".9rem"]]], [".ml-\\[0\\.35rem\\]", null, 4, [["margin-left", ".35rem"]]], [".ml-\\[0\\.55rem\\]", null, 4, [["margin-left", ".55rem"]]], [".ml-\\[1\\.15rem\\]", null, 4, [["margin-left", "1.15rem"]]], [".ml-\\[1\\.45rem\\]", null, 4, [["margin-left", "1.45rem"]]], [".ml-\\[2\\.025rem\\]", null, 4, [["margin-left", "2.025rem"]]], [".ml-\\[2\\.375rem\\]", null, 4, [["margin-left", "2.375rem"]]], [".ml-\\[6\\.1rem\\]", null, 4, [["margin-left", "6.1rem"]]], [".ml-auto", null, 4, [["margin-left", "auto"]]], [".box-border", null, 4, [["box-sizing", "border-box"]]], [".\\!hidden", null, 4, [["display", "none", 1]]], [".\\[display\\:-webkit-box\\]", null, 4, [["display", "-webkit-box"]]], [".\\[display\\:var\\(--pane-grip\\,flex\\)\\]", null, 4, [["display", "var(--pane-grip, flex)"]]], [".block", null, 4, [["display", "block"]]], [".contents", null, 4, [["display", "contents"]]], [".flex", null, 4, [["display", "flex"]]], [".grid", null, 4, [["display", "grid"]]], [".hidden", null, 4, [["display", "none"]]], [".inline", null, 4, [["display", "inline"]]], [".inline-block", null, 4, [["display", "inline-block"]]], [".inline-flex", null, 4, [["display", "inline-flex"]]], [".table", null, 4, [["display", "table"]]], [".size-1", null, 4, [["width", "var(--spacing)"], ["height", "var(--spacing)"]]], [".size-1\\.5", null, 4, [["width", "calc(var(--spacing) * 1.5)"], ["height", "calc(var(--spacing) * 1.5)"]]], [".size-2", null, 4, [["width", "calc(var(--spacing) * 2)"], ["height", "calc(var(--spacing) * 2)"]]], [".size-3", null, 4, [["width", "calc(var(--spacing) * 3)"], ["height", "calc(var(--spacing) * 3)"]]], [".size-5", null, 4, [["width", "calc(var(--spacing) * 5)"], ["height", "calc(var(--spacing) * 5)"]]], [".size-6", null, 4, [["width", "calc(var(--spacing) * 6)"], ["height", "calc(var(--spacing) * 6)"]]], [".size-7", null, 4, [["width", "calc(var(--spacing) * 7)"], ["height", "calc(var(--spacing) * 7)"]]], [".size-8", null, 4, [["width", "calc(var(--spacing) * 8)"], ["height", "calc(var(--spacing) * 8)"]]], [".size-11", null, 4, [["width", "calc(var(--spacing) * 11)"], ["height", "calc(var(--spacing) * 11)"]]], [".size-14", null, 4, [["width", "calc(var(--spacing) * 14)"], ["height", "calc(var(--spacing) * 14)"]]], [".size-\\[0\\.6rem\\]", null, 4, [["width", ".6rem"], ["height", ".6rem"]]], [".size-\\[1\\.2rem\\]", null, 4, [["width", "1.2rem"], ["height", "1.2rem"]]], [".size-\\[5px\\]", null, 4, [["width", "5px"], ["height", "5px"]]], [".size-\\[14px\\]", null, 4, [["width", "14px"], ["height", "14px"]]], [".size-\\[calc\\(14px\\*var\\(--zoom\\,1\\)\\)\\]", null, 4, [["width", "calc(14px * var(--zoom, 1))"], ["height", "calc(14px * var(--zoom, 1))"]]], [".size-full", null, 4, [["width", "100%"], ["height", "100%"]]], [".h-1", null, 4, [["height", "var(--spacing)"]]], [".h-1\\.5", null, 4, [["height", "calc(var(--spacing) * 1.5)"]]], [".h-2", null, 4, [["height", "calc(var(--spacing) * 2)"]]], [".h-3", null, 4, [["height", "calc(var(--spacing) * 3)"]]], [".h-4", null, 4, [["height", "calc(var(--spacing) * 4)"]]], [".h-5", null, 4, [["height", "calc(var(--spacing) * 5)"]]], [".h-6", null, 4, [["height", "calc(var(--spacing) * 6)"]]], [".h-7", null, 4, [["height", "calc(var(--spacing) * 7)"]]], [".h-8", null, 4, [["height", "calc(var(--spacing) * 8)"]]], [".h-9", null, 4, [["height", "calc(var(--spacing) * 9)"]]], [".h-11", null, 4, [["height", "calc(var(--spacing) * 11)"]]], [".h-12", null, 4, [["height", "calc(var(--spacing) * 12)"]]], [".h-44", null, 4, [["height", "calc(var(--spacing) * 44)"]]], [".h-\\[1\\.1rem\\]", null, 4, [["height", "1.1rem"]]], [".h-\\[1\\.3rem\\]", null, 4, [["height", "1.3rem"]]], [".h-\\[1\\.4rem\\]", null, 4, [["height", "1.4rem"]]], [".h-\\[1\\.25rem\\]", null, 4, [["height", "1.25rem"]]], [".h-\\[2px\\]", null, 4, [["height", "2px"]]], [".h-\\[14px\\]", null, 4, [["height", "14px"]]], [".h-\\[18px\\]", null, 4, [["height", "18px"]]], [".h-\\[43px\\]", null, 4, [["height", "43px"]]], [".h-\\[calc\\(100\\%-max\\(0\\.5rem\\,env\\(safe-area-inset-top\\)\\)\\)\\]", null, 4, [["height", "calc(100% - max(.5rem, env(safe-area-inset-top)))"]]], [".h-full", null, 4, [["height", "100%"]]], [".h-px", null, 4, [["height", "1px"]]], [".max-h-40", null, 4, [["max-height", "calc(var(--spacing) * 40)"]]], [".max-h-56", null, 4, [["max-height", "calc(var(--spacing) * 56)"]]], [".max-h-72", null, 4, [["max-height", "calc(var(--spacing) * 72)"]]], [".max-h-\\[8rem\\]", null, 4, [["max-height", "8rem"]]], [".max-h-\\[13rem\\]", null, 4, [["max-height", "13rem"]]], [".max-h-\\[30\\%\\]", null, 4, [["max-height", "30%"]]], [".max-h-\\[30vh\\]", null, 4, [["max-height", "30vh"]]], [".max-h-\\[35vh\\]", null, 4, [["max-height", "35vh"]]], [".max-h-\\[40\\%\\]", null, 4, [["max-height", "40%"]]], [".max-h-\\[50dvh\\]", null, 4, [["max-height", "50dvh"]]], [".max-h-\\[60\\%\\]", null, 4, [["max-height", "60%"]]], [".max-h-\\[70\\%\\]", null, 4, [["max-height", "70%"]]], [".max-h-\\[85vh\\]", null, 4, [["max-height", "85vh"]]], [".max-h-\\[90\\%\\]", null, 4, [["max-height", "90%"]]], [".max-h-\\[190px\\]", null, 4, [["max-height", "190px"]]], [".max-h-\\[240px\\]", null, 4, [["max-height", "240px"]]], [".max-h-\\[260px\\]", null, 4, [["max-height", "260px"]]], [".max-h-\\[calc\\(85vh-4rem\\)\\]", null, 4, [["max-height", "calc(85vh - 4rem)"]]], [".max-h-\\[calc\\(100dvh_-_4rem\\)\\]", null, 4, [["max-height", "calc(100dvh - 4rem)"]]], [".max-h-\\[min\\(420px\\,calc\\(100dvh_-_16vh_-_2rem\\)\\)\\]", null, 4, [["max-height", "min(420px, 100dvh - 16vh - 2rem)"]]], [".max-h-\\[min\\(480px\\,calc\\(100dvh_-_16vh_-_2rem\\)\\)\\]", null, 4, [["max-height", "min(480px, 100dvh - 16vh - 2rem)"]]], [".max-h-full", null, 4, [["max-height", "100%"]]], [".min-h-0", null, 4, [["min-height", "0"]]], [".min-h-6", null, 4, [["min-height", "calc(var(--spacing) * 6)"]]], [".min-h-7", null, 4, [["min-height", "calc(var(--spacing) * 7)"]]], [".min-h-8", null, 4, [["min-height", "calc(var(--spacing) * 8)"]]], [".min-h-9", null, 4, [["min-height", "calc(var(--spacing) * 9)"]]], [".min-h-10", null, 4, [["min-height", "calc(var(--spacing) * 10)"]]], [".min-h-11", null, 4, [["min-height", "calc(var(--spacing) * 11)"]]], [".min-h-20", null, 4, [["min-height", "calc(var(--spacing) * 20)"]]], [".min-h-40", null, 4, [["min-height", "calc(var(--spacing) * 40)"]]], [".min-h-\\[1\\.5em\\]", null, 4, [["min-height", "1.5em"]]], [".min-h-\\[1\\.8rem\\]", null, 4, [["min-height", "1.8rem"]]], [".min-h-\\[2\\.5rem\\]", null, 4, [["min-height", "2.5rem"]]], [".min-h-\\[3\\.2rem\\]", null, 4, [["min-height", "3.2rem"]]], [".min-h-\\[3\\.25rem\\]", null, 4, [["min-height", "3.25rem"]]], [".min-h-\\[6rem\\]", null, 4, [["min-height", "6rem"]]], [".min-h-\\[8rem\\]", null, 4, [["min-height", "8rem"]]], [".min-h-\\[10rem\\]", null, 4, [["min-height", "10rem"]]], [".min-h-\\[12rem\\]", null, 4, [["min-height", "12rem"]]], [".min-h-\\[13rem\\]", null, 4, [["min-height", "13rem"]]], [".min-h-\\[32px\\]", null, 4, [["min-height", "32px"]]], [".min-h-\\[44px\\]", null, 4, [["min-height", "44px"]]], [".min-h-\\[60px\\]", null, 4, [["min-height", "60px"]]], [".min-h-\\[100dvh\\]", null, 4, [["min-height", "100dvh"]]], [".min-h-\\[calc\\(22px\\*var\\(--zoom\\,1\\)\\)\\]", null, 4, [["min-height", "calc(22px * var(--zoom, 1))"]]], [".min-h-full", null, 4, [["min-height", "100%"]]], [".w-2", null, 4, [["width", "calc(var(--spacing) * 2)"]]], [".w-2\\.5", null, 4, [["width", "calc(var(--spacing) * 2.5)"]]], [".w-3", null, 4, [["width", "calc(var(--spacing) * 3)"]]], [".w-4", null, 4, [["width", "calc(var(--spacing) * 4)"]]], [".w-5", null, 4, [["width", "calc(var(--spacing) * 5)"]]], [".w-7", null, 4, [["width", "calc(var(--spacing) * 7)"]]], [".w-8", null, 4, [["width", "calc(var(--spacing) * 8)"]]], [".w-9", null, 4, [["width", "calc(var(--spacing) * 9)"]]], [".w-10", null, 4, [["width", "calc(var(--spacing) * 10)"]]], [".w-20", null, 4, [["width", "calc(var(--spacing) * 20)"]]], [".w-40", null, 4, [["width", "calc(var(--spacing) * 40)"]]], [".w-44", null, 4, [["width", "calc(var(--spacing) * 44)"]]], [".w-\\[1\\.1rem\\]", null, 4, [["width", "1.1rem"]]], [".w-\\[1\\.4rem\\]", null, 4, [["width", "1.4rem"]]], [".w-\\[1\\.6rem\\]", null, 4, [["width", "1.6rem"]]], [".w-\\[1\\.25rem\\]", null, 4, [["width", "1.25rem"]]], [".w-\\[2\\.4rem\\]", null, 4, [["width", "2.4rem"]]], [".w-\\[2\\.25rem\\]", null, 4, [["width", "2.25rem"]]], [".w-\\[6rem\\]", null, 4, [["width", "6rem"]]], [".w-\\[7rem\\]", null, 4, [["width", "7rem"]]], [".w-\\[11rem\\]", null, 4, [["width", "11rem"]]], [".w-\\[15rem\\]", null, 4, [["width", "15rem"]]], [".w-\\[16rem\\]", null, 4, [["width", "16rem"]]], [".w-\\[18px\\]", null, 4, [["width", "18px"]]], [".w-\\[100cqi\\]", null, 4, [["width", "100cqi"]]], [".w-\\[calc\\(\\(100\\%-0\\.875rem\\)\\/8\\)\\]", null, 4, [["width", "calc(12.5% - .109375rem)"]]], [".w-\\[calc\\(100\\%_-_0\\.6rem\\)\\]", null, 4, [["width", "calc(100% - .6rem)"]]], [".w-\\[calc\\(100\\%_-_1rem\\)\\]", null, 4, [["width", "calc(100% - 1rem)"]]], [".w-\\[min\\(22rem\\,calc\\(100vw-3rem\\)\\)\\]", null, 4, [["width", "min(22rem, 100vw - 3rem)"]]], [".w-\\[min\\(26rem\\,100\\%\\)\\]", null, 4, [["width", "min(26rem, 100%)"]]], [".w-\\[min\\(28rem\\,calc\\(100vw-2\\.5rem\\)\\)\\]", null, 4, [["width", "min(28rem, 100vw - 2.5rem)"]]], [".w-\\[min\\(30rem\\,92vw\\)\\]", null, 4, [["width", "min(30rem, 92vw)"]]], [".w-\\[min\\(32rem\\,100\\%\\)\\]", null, 4, [["width", "min(32rem, 100%)"]]], [".w-\\[min\\(340px\\,calc\\(100vw-16px\\)\\)\\]", null, 4, [["width", "min(340px, 100vw - 16px)"]]], [".w-\\[min\\(360px\\,calc\\(100vw_-_2rem\\)\\)\\]", null, 4, [["width", "min(360px, 100vw - 2rem)"]]], [".w-\\[min\\(420px\\,calc\\(100vw_-_16px\\)\\)\\]", null, 4, [["width", "min(420px, 100vw - 16px)"]]], [".w-\\[min\\(480px\\,calc\\(100vw_-_2rem\\)\\)\\]", null, 4, [["width", "min(480px, 100vw - 2rem)"]]], [".w-\\[min\\(560px\\,calc\\(100vw_-_2rem\\)\\)\\]", null, 4, [["width", "min(560px, 100vw - 2rem)"]]], [".w-\\[var\\(--sidebar-width\\,240px\\)\\]", null, 4, [["width", "var(--sidebar-width, 240px)"]]], [".w-\\[var\\(--tools-width\\)\\]", null, 4, [["width", "var(--tools-width)"]]], [".w-auto", null, 4, [["width", "auto"]]], [".w-full", null, 4, [["width", "100%"]]], [".w-px", null, 4, [["width", "1px"]]], [".max-w-24", null, 4, [["max-width", "calc(var(--spacing) * 24)"]]], [".max-w-32", null, 4, [["max-width", "calc(var(--spacing) * 32)"]]], [".max-w-\\[9rem\\]", null, 4, [["max-width", "9rem"]]], [".max-w-\\[10rem\\]", null, 4, [["max-width", "10rem"]]], [".max-w-\\[14rem\\]", null, 4, [["max-width", "14rem"]]], [".max-w-\\[16rem\\]", null, 4, [["max-width", "16rem"]]], [".max-w-\\[24rem\\]", null, 4, [["max-width", "24rem"]]], [".max-w-\\[25\\%\\]", null, 4, [["max-width", "25%"]]], [".max-w-\\[26rem\\]", null, 4, [["max-width", "26rem"]]], [".max-w-\\[28rem\\]", null, 4, [["max-width", "28rem"]]], [".max-w-\\[35\\%\\]", null, 4, [["max-width", "35%"]]], [".max-w-\\[38\\%\\]", null, 4, [["max-width", "38%"]]], [".max-w-\\[45\\%\\]", null, 4, [["max-width", "45%"]]], [".max-w-\\[46rem\\]", null, 4, [["max-width", "46rem"]]], [".max-w-\\[55\\%\\]", null, 4, [["max-width", "55%"]]], [".max-w-\\[56rem\\]", null, 4, [["max-width", "56rem"]]], [".max-w-\\[85\\%\\]", null, 4, [["max-width", "85%"]]], [".max-w-\\[140px\\]", null, 4, [["max-width", "140px"]]], [".max-w-\\[320px\\]", null, 4, [["max-width", "320px"]]], [".max-w-\\[min\\(22rem\\,calc\\(100\\%-1\\.5rem\\)\\)\\]", null, 4, [["max-width", "min(22rem, 100% - 1.5rem)"]]], [".max-w-\\[min\\(30rem\\,calc\\(100\\%-1\\.6rem\\)\\)\\]", null, 4, [["max-width", "min(30rem, 100% - 1.6rem)"]]], [".max-w-\\[min\\(34rem\\,calc\\(100\\%-1\\.5rem\\)\\)\\]", null, 4, [["max-width", "min(34rem, 100% - 1.5rem)"]]], [".max-w-\\[min\\(320px\\,calc\\(100vw_-_24px\\)\\)\\]", null, 4, [["max-width", "min(320px, 100vw - 24px)"]]], [".max-w-full", null, 4, [["max-width", "100%"]]], [".max-w-none", null, 4, [["max-width", "none"]]], [".min-w-0", null, 4, [["min-width", "0"]]], [".min-w-6", null, 4, [["min-width", "calc(var(--spacing) * 6)"]]], [".min-w-8", null, 4, [["min-width", "calc(var(--spacing) * 8)"]]], [".min-w-12", null, 4, [["min-width", "calc(var(--spacing) * 12)"]]], [".min-w-24", null, 4, [["min-width", "calc(var(--spacing) * 24)"]]], [".min-w-36", null, 4, [["min-width", "calc(var(--spacing) * 36)"]]], [".min-w-56", null, 4, [["min-width", "calc(var(--spacing) * 56)"]]], [".min-w-\\[5\\.5rem\\]", null, 4, [["min-width", "5.5rem"]]], [".min-w-\\[7rem\\]", null, 4, [["min-width", "7rem"]]], [".min-w-\\[12rem\\]", null, 4, [["min-width", "12rem"]]], [".min-w-\\[14px\\]", null, 4, [["min-width", "14px"]]], [".min-w-\\[200px\\]", null, 4, [["min-width", "200px"]]], [".min-w-fit", null, 4, [["min-width", "fit-content"]]], [".min-w-max", null, 4, [["min-width", "max-content"]]], [".flex-1", null, 4, [["flex", "1"]]], [".flex-\\[0_0_5rem\\]", null, 4, [["flex", "0 0 5rem"]]], [".flex-\\[0_0_8px\\]", null, 4, [["flex", "0 0 8px"]]], [".flex-\\[0_1_40\\%\\]", null, 4, [["flex", "0 40%"]]], [".flex-\\[1_1_100\\%\\]", null, 4, [["flex", "100%"]]], [".flex-\\[2\\]", null, 4, [["flex", "2"]]], [".flex-initial", null, 4, [["flex", "0 auto"]]], [".flex-none", null, 4, [["flex", "none"]]], [".shrink", null, 4, [["flex-shrink", "1"]]], [".shrink-0", null, 4, [["flex-shrink", "0"]]], [".shrink-\\[0\\.001\\]", null, 4, [["flex-shrink", ".001"]]], [".shrink-\\[2\\]", null, 4, [["flex-shrink", "2"]]], [".shrink-\\[3\\]", null, 4, [["flex-shrink", "3"]]], [".grow", null, 4, [["flex-grow", "1"]]], [".basis-0", null, 4, [["flex-basis", "0"]]], [".basis-\\[14rem\\]", null, 4, [["flex-basis", "14rem"]]], [".-translate-y-1\\/2", null, 4, [["--tw-translate-y", "calc(calc(1 / 2 * 100%) * -1)"], ["translate", "var(--tw-translate-x) var(--tw-translate-y)"]]], [".\\[transform\\:translateY\\(-50\\%\\)\\]", null, 4, [["transform", "translateY(-50%)"]]], [".transform", null, 4, [["transform", "var(--tw-rotate-x, ) var(--tw-rotate-y, ) var(--tw-rotate-z, ) var(--tw-skew-x, ) var(--tw-skew-y, )"]]], [".animate-drop-zone", null, 4, [["animation", "var(--animate-drop-zone)"]]], [".animate-host-pulse", null, 4, [["animation", "var(--animate-host-pulse)"]]], [".animate-pulse", null, 4, [["animation", "var(--animate-pulse)"]]], [".animate-toast-in", null, 4, [["animation", "var(--animate-toast-in)"]]], [".cursor-col-resize", null, 4, [["cursor", "col-resize"]]], [".cursor-default", null, 4, [["cursor", "default"]]], [".cursor-grab", null, 4, [["cursor", "grab"]]], [".cursor-grabbing", null, 4, [["cursor", "grabbing"]]], [".cursor-pointer", null, 4, [["cursor", "pointer"]]], [".cursor-row-resize", null, 4, [["cursor", "row-resize"]]], [".touch-none", null, 4, [["touch-action", "none"]]], [".resize", null, 4, [["resize", "both"]]], [".resize-none", null, 4, [["resize", "none"]]], [".resize-y", null, 4, [["resize", "vertical"]]], [".\\[scrollbar-width\\:none\\]", null, 4, [["scrollbar-width", "none"]]], [".list-disc", null, 4, [["list-style-type", "disc"]]], [".list-none", null, 4, [["list-style-type", "none"]]], [".appearance-none", null, 4, [["appearance", "none"]]], [".grid-cols-8", null, 4, [["grid-template-columns", "repeat(8, minmax(0, 1fr))"]]], [".grid-cols-\\[1fr_auto_1fr\\]", null, 4, [["grid-template-columns", "1fr auto 1fr"]]], [".grid-cols-\\[2\\.5rem_2\\.5rem_0\\.9rem_minmax\\(0\\,1fr\\)\\]", null, 4, [["grid-template-columns", "2.5rem 2.5rem .9rem minmax(0, 1fr)"]]], [".grid-cols-\\[auto_minmax\\(0\\,1fr\\)\\]", null, 4, [["grid-template-columns", "auto minmax(0, 1fr)"]]], [".grid-cols-\\[minmax\\(4rem\\,10rem\\)_1fr_auto\\]", null, 4, [["grid-template-columns", "minmax(4rem, 10rem) 1fr auto"]]], [".grid-cols-\\[repeat\\(2\\,minmax\\(0\\,1fr\\)\\)\\]", null, 4, [["grid-template-columns", "repeat(2, minmax(0, 1fr))"]]], [".grid-cols-\\[repeat\\(auto-fit\\,minmax\\(8rem\\,1fr\\)\\)\\]", null, 4, [["grid-template-columns", "repeat(auto-fit, minmax(8rem, 1fr))"]]], [".flex-col", null, 4, [["flex-direction", "column"]]], [".flex-row", null, 4, [["flex-direction", "row"]]], [".flex-wrap", null, 4, [["flex-wrap", "wrap"]]], [".place-items-center", null, 4, [["place-items", "center"]]], [".content-center", null, 4, [["align-content", "center"]]], [".items-baseline", null, 4, [["align-items", "baseline"]]], [".items-center", null, 4, [["align-items", "center"]]], [".items-end", null, 4, [["align-items", "flex-end"]]], [".items-start", null, 4, [["align-items", "flex-start"]]], [".items-stretch", null, 4, [["align-items", "stretch"]]], [".justify-between", null, 4, [["justify-content", "space-between"]]], [".justify-center", null, 4, [["justify-content", "center"]]], [".justify-end", null, 4, [["justify-content", "flex-end"]]], [".justify-start", null, 4, [["justify-content", "flex-start"]]], [".justify-items-center", null, 4, [["justify-items", "center"]]], [".justify-items-start", null, 4, [["justify-items", "start"]]], [".gap-0", null, 4, [["gap", "0"]]], [".gap-0\\.5", null, 4, [["gap", "calc(var(--spacing) * .5)"]]], [".gap-1", null, 4, [["gap", "var(--spacing)"]]], [".gap-1\\.5", null, 4, [["gap", "calc(var(--spacing) * 1.5)"]]], [".gap-2", null, 4, [["gap", "calc(var(--spacing) * 2)"]]], [".gap-3", null, 4, [["gap", "calc(var(--spacing) * 3)"]]], [".gap-4", null, 4, [["gap", "calc(var(--spacing) * 4)"]]], [".gap-6", null, 4, [["gap", "calc(var(--spacing) * 6)"]]], [".gap-\\[0\\.1rem\\]", null, 4, [["gap", ".1rem"]]], [".gap-\\[0\\.3rem\\]", null, 4, [["gap", ".3rem"]]], [".gap-\\[0\\.4rem\\]", null, 4, [["gap", ".4rem"]]], [".gap-\\[0\\.05rem\\]", null, 4, [["gap", ".05rem"]]], [".gap-\\[0\\.6rem\\]", null, 4, [["gap", ".6rem"]]], [".gap-\\[0\\.8rem\\]", null, 4, [["gap", ".8rem"]]], [".gap-\\[0\\.16rem\\]", null, 4, [["gap", ".16rem"]]], [".gap-\\[0\\.32rem\\]", null, 4, [["gap", ".32rem"]]], [".gap-\\[0\\.35rem\\]", null, 4, [["gap", ".35rem"]]], [".gap-\\[0\\.45rem\\]", null, 4, [["gap", ".45rem"]]], [".gap-\\[0\\.55rem\\]", null, 4, [["gap", ".55rem"]]], [".gap-\\[0\\.65rem\\]", null, 4, [["gap", ".65rem"]]], [".gap-\\[0\\.85rem\\]", null, 4, [["gap", ".85rem"]]], [".gap-\\[1px\\]", null, 4, [["gap", "1px"]]], [".gap-\\[2px\\]", null, 4, [["gap", "2px"]]], [".gap-\\[3px\\]", null, 4, [["gap", "3px"]]], [".gap-\\[7px\\]", null, 4, [["gap", "7px"]]], [".gap-\\[13px\\]", null, 4, [["gap", "13px"]]], [":where(.space-y-0\\.5 > :not(:last-child))", null, 4, [["--tw-space-y-reverse", "0"], ["margin-block-start", "calc(calc(var(--spacing) * .5) * var(--tw-space-y-reverse))"], ["margin-block-end", "calc(calc(var(--spacing) * .5) * calc(1 - var(--tw-space-y-reverse)))"]]], [".gap-x-3", null, 4, [["column-gap", "calc(var(--spacing) * 3)"]]], [".gap-x-4", null, 4, [["column-gap", "calc(var(--spacing) * 4)"]]], [".gap-x-\\[0\\.7rem\\]", null, 4, [["column-gap", ".7rem"]]], [".gap-x-\\[0\\.9rem\\]", null, 4, [["column-gap", ".9rem"]]], [".gap-y-1", null, 4, [["row-gap", "var(--spacing)"]]], [".gap-y-\\[0\\.3rem\\]", null, 4, [["row-gap", ".3rem"]]], [".self-center", null, 4, [["align-self", "center"]]], [".self-end", null, 4, [["align-self", "flex-end"]]], [".self-start", null, 4, [["align-self", "flex-start"]]], [".self-stretch", null, 4, [["align-self", "stretch"]]], [".justify-self-start", null, 4, [["justify-self", "flex-start"]]], [".truncate", null, 4, [["text-overflow", "ellipsis"], ["white-space", "nowrap"], ["overflow", "hidden"]]], [".overflow-auto", null, 4, [["overflow", "auto"]]], [".overflow-hidden", null, 4, [["overflow", "hidden"]]], [".overflow-visible", null, 4, [["overflow", "visible"]]], [".overflow-x-auto", null, 4, [["overflow-x", "auto"]]], [".overflow-y-auto", null, 4, [["overflow-y", "auto"]]], [".overscroll-contain", null, 4, [["overscroll-behavior", "contain"]]], [".rounded, .rounded-\\[0\\.25rem\\]", null, 4, [["border-radius", ".25rem"]]], [".rounded-\\[1\\.5rem\\]", null, 4, [["border-radius", "1.5rem"]]], [".rounded-\\[2px\\]", null, 4, [["border-radius", "2px"]]], [".rounded-\\[3px\\]", null, 4, [["border-radius", "3px"]]], [".rounded-\\[12px\\]", null, 4, [["border-radius", "12px"]]], [".rounded-\\[50\\%\\]", null, 4, [["border-radius", "50%"]]], [".rounded-\\[999px\\]", null, 4, [["border-radius", "999px"]]], [".rounded-\\[calc\\(var\\(--radius\\)\\*2\\)\\]", null, 4, [["border-radius", "calc(var(--radius) * 2)"]]], [".rounded-\\[var\\(--card-radius\\,8px\\)\\]", null, 4, [["border-radius", "var(--card-radius, 8px)"]]], [".rounded-\\[var\\(--card-radius\\,12px\\)\\]", null, 4, [["border-radius", "var(--card-radius, 12px)"]]], [".rounded-full", null, 4, [["border-radius", "3.40282e38px"]]], [".rounded-none", null, 4, [["border-radius", "0"]]], [".rounded-soft", null, 4, [["border-radius", "var(--radius-pane)"]]], [".rounded-ui", null, 4, [["border-radius", "var(--radius)"]]], [".rounded-t-\\[12px\\]", null, 4, [["border-top-left-radius", "12px"], ["border-top-right-radius", "12px"]]], [".rounded-t-none", null, 4, [["border-top-left-radius", "0"], ["border-top-right-radius", "0"]]], [".rounded-bl-\\[6px\\]", null, 4, [["border-bottom-left-radius", "6px"]]], [".border", null, 4, [["border-style", "var(--tw-border-style)"], ["border-width", "1px"]]], [".border-0", null, 4, [["border-style", "var(--tw-border-style)"], ["border-width", "0"]]], [".border-\\[1\\.5px\\]", null, 4, [["border-style", "var(--tw-border-style)"], ["border-width", "1.5px"]]], [".border-b", null, 4, [["border-bottom-style", "var(--tw-border-style)"], ["border-bottom-width", "1px"]]], [".border-l", null, 4, [["border-left-style", "var(--tw-border-style)"], ["border-left-width", "1px"]]], [".border-l-\\[3px\\]", null, 4, [["border-left-style", "var(--tw-border-style)"], ["border-left-width", "3px"]]], [".border-solid", null, 4, [["--tw-border-style", "solid"], ["border-style", "solid"]]], [".border-accent", null, 4, [["border-color", "var(--accent)"]]], [".border-overlay-0", null, 4, [["border-color", "var(--overlay-0)"]]], [".border-overlay-1", null, 4, [["border-color", "var(--overlay-1)"]]], [".border-red", null, 4, [["border-color", "var(--red)"]]], [".border-subtext-0", null, 4, [["border-color", "var(--subtext-0)"]]], [".border-surface-1", null, 4, [["border-color", "var(--surface-1)"]]], [".border-teal", null, 4, [["border-color", "var(--teal)"]]], [".border-yellow", null, 4, [["border-color", "var(--yellow)"]]], [".border-l-accent", null, 4, [["border-left-color", "var(--accent)"]]], [".border-l-green", null, 4, [["border-left-color", "var(--green)"]]], [".border-l-red", null, 4, [["border-left-color", "var(--red)"]]], [".border-l-yellow", null, 4, [["border-left-color", "var(--yellow)"]]], [".bg-\\[\\#161616\\]", null, 4, [["background-color", "#161616"]]], [".bg-\\[\\#fff\\]", null, 4, [["background-color", "#fff"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_8\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "var(--accent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_8\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--accent) 8%,var(--panel-bg))"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_12\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--accent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_12\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--accent) 12%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--accent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--accent) 15%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--blue\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--blue)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--blue\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--blue) 15%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--green\\)_9\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--green)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--green\\)_9\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--green) 9%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--red\\)_7\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--red)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--red\\)_7\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--red) 7%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--red\\)_9\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--red)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--red\\)_9\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--red) 9%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--surface-1\\)_42\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--surface-1\\)_42\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--surface-1) 42%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--surface-1\\)_70\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--surface-1\\)_70\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--surface-1) 70%,var(--panel-bg))"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--text\\)_10\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "var(--text)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--text\\)_10\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--text) 10%,var(--panel-bg))"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--yellow\\)_8\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--yellow)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--yellow\\)_8\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--yellow) 8%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--yellow\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--yellow)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--yellow\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--yellow) 15%,transparent)"]]], [".bg-\\[rgba\\(0\\,0\\,0\\,0\\.5\\)\\]", null, 4, [["background-color", "#00000080"]]], [".bg-\\[rgba\\(0\\,0\\,0\\,0\\.7\\)\\]", null, 4, [["background-color", "#000000b3"]]], [".bg-\\[rgba\\(0\\,0\\,0\\,0\\.55\\)\\]", null, 4, [["background-color", "#0000008c"]]], [".bg-\\[rgba\\(0\\,0\\,0\\,0\\.62\\)\\]", null, 4, [["background-color", "#0000009e"]]], [".bg-\\[var\\(--accent\\)\\]", null, 4, [["background-color", "var(--accent)"]]], [".bg-\\[var\\(--backdrop\\)\\]", null, 4, [["background-color", "var(--backdrop)"]]], [".bg-\\[var\\(--bg\\)\\]", null, 4, [["background-color", "var(--bg)"]]], [".bg-\\[var\\(--card-bg\\)\\]", null, 4, [["background-color", "var(--card-bg)"]]], [".bg-\\[var\\(--picker-bg\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "var(--picker-bg, var(--panel-bg))"]]], [".bg-\\[var\\(--surface-1\\)\\]", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-\\[var\\(--workspace-tools-bg\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "var(--workspace-tools-bg, var(--panel-bg))"]]], [".bg-accent, .bg-accent\\/10", null, 4, [["background-color", "var(--accent)"]]], [".bg-accent\\/10", null, 4, [["background-color", "color-mix(in oklab, var(--accent) 10%, transparent)"]]], [".bg-accent\\/35", null, 4, [["background-color", "var(--accent)"]]], [".bg-accent\\/35", null, 4, [["background-color", "color-mix(in oklab, var(--accent) 35%, transparent)"]]], [".bg-fg", null, 4, [["background-color", "var(--text)"]]], [".bg-green, .bg-green\\/15", null, 4, [["background-color", "var(--green)"]]], [".bg-green\\/15", null, 4, [["background-color", "color-mix(in oklab, var(--green) 15%, transparent)"]]], [".bg-overlay-0", null, 4, [["background-color", "var(--overlay-0)"]]], [".bg-overlay-1", null, 4, [["background-color", "var(--overlay-1)"]]], [".bg-panel-bg", null, 4, [["background-color", "var(--panel-bg)"]]], [".bg-red, .bg-red\\/15", null, 4, [["background-color", "var(--red)"]]], [".bg-red\\/15", null, 4, [["background-color", "color-mix(in oklab, var(--red) 15%, transparent)"]]], [".bg-subtext-0", null, 4, [["background-color", "var(--subtext-0)"]]], [".bg-surface-0", null, 4, [["background-color", "var(--surface-0)"]]], [".bg-surface-1, .bg-surface-1\\/30", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-surface-1\\/30", null, 4, [["background-color", "color-mix(in oklab, var(--surface-1) 30%, transparent)"]]], [".bg-surface-1\\/60", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-surface-1\\/60", null, 4, [["background-color", "color-mix(in oklab, var(--surface-1) 60%, transparent)"]]], [".bg-surface-1\\/70", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-surface-1\\/70", null, 4, [["background-color", "color-mix(in oklab, var(--surface-1) 70%, transparent)"]]], [".bg-transparent", null, 4, [["background-color", "#0000"]]], [".bg-yellow", null, 4, [["background-color", "var(--yellow)"]]], [".object-contain", null, 4, [["object-fit", "contain"]]], [".object-cover", null, 4, [["object-fit", "cover"]]], [".p-0", null, 4, [["padding", "0"]]], [".p-0\\.5", null, 4, [["padding", "calc(var(--spacing) * .5)"]]], [".p-1", null, 4, [["padding", "var(--spacing)"]]], [".p-2", null, 4, [["padding", "calc(var(--spacing) * 2)"]]], [".p-3", null, 4, [["padding", "calc(var(--spacing) * 3)"]]], [".p-4", null, 4, [["padding", "calc(var(--spacing) * 4)"]]], [".p-5", null, 4, [["padding", "calc(var(--spacing) * 5)"]]], [".p-6", null, 4, [["padding", "calc(var(--spacing) * 6)"]]], [".p-\\[0\\.2rem\\]", null, 4, [["padding", ".2rem"]]], [".p-\\[0\\.4rem\\]", null, 4, [["padding", ".4rem"]]], [".p-\\[0\\.5rem\\]", null, 4, [["padding", ".5rem"]]], [".p-\\[0\\.9rem\\]", null, 4, [["padding", ".9rem"]]], [".p-\\[0\\.45rem\\]", null, 4, [["padding", ".45rem"]]], [".p-\\[0\\.55rem\\]", null, 4, [["padding", ".55rem"]]], [".p-\\[0\\.65rem\\]", null, 4, [["padding", ".65rem"]]], [".p-\\[2px\\]", null, 4, [["padding", "2px"]]], [".px-0", null, 4, [["padding-inline", "0"]]], [".px-1", null, 4, [["padding-inline", "var(--spacing)"]]], [".px-1\\.5", null, 4, [["padding-inline", "calc(var(--spacing) * 1.5)"]]], [".px-2", null, 4, [["padding-inline", "calc(var(--spacing) * 2)"]]], [".px-3", null, 4, [["padding-inline", "calc(var(--spacing) * 3)"]]], [".px-3\\.5", null, 4, [["padding-inline", "calc(var(--spacing) * 3.5)"]]], [".px-4", null, 4, [["padding-inline", "calc(var(--spacing) * 4)"]]], [".px-8", null, 4, [["padding-inline", "calc(var(--spacing) * 8)"]]], [".px-\\[0\\.2rem\\]", null, 4, [["padding-inline", ".2rem"]]], [".px-\\[0\\.3rem\\]", null, 4, [["padding-inline", ".3rem"]]], [".px-\\[0\\.4rem\\]", null, 4, [["padding-inline", ".4rem"]]], [".px-\\[0\\.5rem\\]", null, 4, [["padding-inline", ".5rem"]]], [".px-\\[0\\.6rem\\]", null, 4, [["padding-inline", ".6rem"]]], [".px-\\[0\\.7rem\\]", null, 4, [["padding-inline", ".7rem"]]], [".px-\\[0\\.8rem\\]", null, 4, [["padding-inline", ".8rem"]]], [".px-\\[0\\.9rem\\]", null, 4, [["padding-inline", ".9rem"]]], [".px-\\[0\\.26rem\\]", null, 4, [["padding-inline", ".26rem"]]], [".px-\\[0\\.28rem\\]", null, 4, [["padding-inline", ".28rem"]]], [".px-\\[0\\.35rem\\]", null, 4, [["padding-inline", ".35rem"]]], [".px-\\[0\\.42rem\\]", null, 4, [["padding-inline", ".42rem"]]], [".px-\\[0\\.45rem\\]", null, 4, [["padding-inline", ".45rem"]]], [".px-\\[0\\.48rem\\]", null, 4, [["padding-inline", ".48rem"]]], [".px-\\[0\\.55rem\\]", null, 4, [["padding-inline", ".55rem"]]], [".px-\\[0\\.65rem\\]", null, 4, [["padding-inline", ".65rem"]]], [".px-\\[0\\.75rem\\]", null, 4, [["padding-inline", ".75rem"]]], [".px-\\[0\\.85rem\\]", null, 4, [["padding-inline", ".85rem"]]], [".px-\\[1\\.4rem\\]", null, 4, [["padding-inline", "1.4rem"]]], [".px-\\[3px\\]", null, 4, [["padding-inline", "3px"]]], [".px-\\[10px\\]", null, 4, [["padding-inline", "10px"]]], [".py-0", null, 4, [["padding-block", "0"]]], [".py-0\\.5", null, 4, [["padding-block", "calc(var(--spacing) * .5)"]]], [".py-1", null, 4, [["padding-block", "var(--spacing)"]]], [".py-1\\.5", null, 4, [["padding-block", "calc(var(--spacing) * 1.5)"]]], [".py-2", null, 4, [["padding-block", "calc(var(--spacing) * 2)"]]], [".py-3", null, 4, [["padding-block", "calc(var(--spacing) * 3)"]]], [".py-4", null, 4, [["padding-block", "calc(var(--spacing) * 4)"]]], [".py-8", null, 4, [["padding-block", "calc(var(--spacing) * 8)"]]], [".py-\\[0\\.1rem\\]", null, 4, [["padding-block", ".1rem"]]], [".py-\\[0\\.2rem\\]", null, 4, [["padding-block", ".2rem"]]], [".py-\\[0\\.3rem\\]", null, 4, [["padding-block", ".3rem"]]], [".py-\\[0\\.4rem\\]", null, 4, [["padding-block", ".4rem"]]], [".py-\\[0\\.05rem\\]", null, 4, [["padding-block", ".05rem"]]], [".py-\\[0\\.6rem\\]", null, 4, [["padding-block", ".6rem"]]], [".py-\\[0\\.8rem\\]", null, 4, [["padding-block", ".8rem"]]], [".py-\\[0\\.12rem\\]", null, 4, [["padding-block", ".12rem"]]], [".py-\\[0\\.14rem\\]", null, 4, [["padding-block", ".14rem"]]], [".py-\\[0\\.15rem\\]", null, 4, [["padding-block", ".15rem"]]], [".py-\\[0\\.18rem\\]", null, 4, [["padding-block", ".18rem"]]], [".py-\\[0\\.25rem\\]", null, 4, [["padding-block", ".25rem"]]], [".py-\\[0\\.28rem\\]", null, 4, [["padding-block", ".28rem"]]], [".py-\\[0\\.32rem\\]", null, 4, [["padding-block", ".32rem"]]], [".py-\\[0\\.35rem\\]", null, 4, [["padding-block", ".35rem"]]], [".py-\\[0\\.42rem\\]", null, 4, [["padding-block", ".42rem"]]], [".py-\\[0\\.45rem\\]", null, 4, [["padding-block", ".45rem"]]], [".py-\\[0\\.55rem\\]", null, 4, [["padding-block", ".55rem"]]], [".py-\\[0\\.65rem\\]", null, 4, [["padding-block", ".65rem"]]], [".py-\\[2px\\]", null, 4, [["padding-block", "2px"]]], [".py-\\[3px\\]", null, 4, [["padding-block", "3px"]]], [".py-\\[6px\\]", null, 4, [["padding-block", "6px"]]], [".py-px", null, 4, [["padding-block", "1px"]]], [".pt-1", null, 4, [["padding-top", "var(--spacing)"]]], [".pt-2", null, 4, [["padding-top", "calc(var(--spacing) * 2)"]]], [".pt-2\\.5", null, 4, [["padding-top", "calc(var(--spacing) * 2.5)"]]], [".pt-3", null, 4, [["padding-top", "calc(var(--spacing) * 3)"]]], [".pt-4", null, 4, [["padding-top", "calc(var(--spacing) * 4)"]]], [".pt-5", null, 4, [["padding-top", "calc(var(--spacing) * 5)"]]], [".pt-\\[0\\.2rem\\]", null, 4, [["padding-top", ".2rem"]]], [".pt-\\[0\\.4rem\\]", null, 4, [["padding-top", ".4rem"]]], [".pt-\\[0\\.6rem\\]", null, 4, [["padding-top", ".6rem"]]], [".pt-\\[0\\.85rem\\]", null, 4, [["padding-top", ".85rem"]]], [".pt-\\[2px\\]", null, 4, [["padding-top", "2px"]]], [".pt-\\[12vh\\]", null, 4, [["padding-top", "12vh"]]], [".pt-\\[max\\(0\\.5rem\\,env\\(safe-area-inset-top\\)\\)\\]", null, 4, [["padding-top", "max(.5rem, env(safe-area-inset-top))"]]], [".pr-0\\.5", null, 4, [["padding-right", "calc(var(--spacing) * .5)"]]], [".pr-1", null, 4, [["padding-right", "var(--spacing)"]]], [".pr-1\\.5", null, 4, [["padding-right", "calc(var(--spacing) * 1.5)"]]], [".pr-2", null, 4, [["padding-right", "calc(var(--spacing) * 2)"]]], [".pr-3", null, 4, [["padding-right", "calc(var(--spacing) * 3)"]]], [".pr-12", null, 4, [["padding-right", "calc(var(--spacing) * 12)"]]], [".pr-\\[0\\.3rem\\]", null, 4, [["padding-right", ".3rem"]]], [".pr-\\[0\\.6rem\\]", null, 4, [["padding-right", ".6rem"]]], [".pr-\\[0\\.35rem\\]", null, 4, [["padding-right", ".35rem"]]], [".pr-\\[0\\.45rem\\]", null, 4, [["padding-right", ".45rem"]]], [".pr-\\[0\\.55rem\\]", null, 4, [["padding-right", ".55rem"]]], [".pr-\\[1\\.6rem\\]", null, 4, [["padding-right", "1.6rem"]]], [".pr-\\[3px\\]", null, 4, [["padding-right", "3px"]]], [".pr-\\[env\\(safe-area-inset-right\\)\\]", null, 4, [["padding-right", "env(safe-area-inset-right)"]]], [".pr-\\[max\\(0\\.5rem\\,env\\(safe-area-inset-right\\)\\)\\]", null, 4, [["padding-right", "max(.5rem, env(safe-area-inset-right))"]]], [".pb-1", null, 4, [["padding-bottom", "var(--spacing)"]]], [".pb-2", null, 4, [["padding-bottom", "calc(var(--spacing) * 2)"]]], [".pb-3", null, 4, [["padding-bottom", "calc(var(--spacing) * 3)"]]], [".pb-4", null, 4, [["padding-bottom", "calc(var(--spacing) * 4)"]]], [".pb-8", null, 4, [["padding-bottom", "calc(var(--spacing) * 8)"]]], [".pb-\\[0\\.3rem\\]", null, 4, [["padding-bottom", ".3rem"]]], [".pb-\\[0\\.4rem\\]", null, 4, [["padding-bottom", ".4rem"]]], [".pb-\\[0\\.25rem\\]", null, 4, [["padding-bottom", ".25rem"]]], [".pb-\\[0\\.55rem\\]", null, 4, [["padding-bottom", ".55rem"]]], [".pb-\\[1\\.4rem\\]", null, 4, [["padding-bottom", "1.4rem"]]], [".pb-\\[calc\\(1\\.5rem\\+env\\(safe-area-inset-bottom\\)\\)\\]", null, 4, [["padding-bottom", "calc(1.5rem + env(safe-area-inset-bottom))"]]], [".pb-\\[calc\\(1rem\\+env\\(safe-area-inset-bottom\\)\\)\\]", null, 4, [["padding-bottom", "calc(1rem + env(safe-area-inset-bottom))"]]], [".pb-\\[env\\(safe-area-inset-bottom\\)\\]", null, 4, [["padding-bottom", "env(safe-area-inset-bottom)"]]], [".pb-\\[max\\(0\\.5rem\\,env\\(safe-area-inset-bottom\\)\\)\\]", null, 4, [["padding-bottom", "max(.5rem, env(safe-area-inset-bottom))"]]], [".pl-1", null, 4, [["padding-left", "var(--spacing)"]]], [".pl-1\\.5", null, 4, [["padding-left", "calc(var(--spacing) * 1.5)"]]], [".pl-2", null, 4, [["padding-left", "calc(var(--spacing) * 2)"]]], [".pl-3", null, 4, [["padding-left", "calc(var(--spacing) * 3)"]]], [".pl-4", null, 4, [["padding-left", "calc(var(--spacing) * 4)"]]], [".pl-5", null, 4, [["padding-left", "calc(var(--spacing) * 5)"]]], [".pl-6", null, 4, [["padding-left", "calc(var(--spacing) * 6)"]]], [".pl-\\[0\\.4rem\\]", null, 4, [["padding-left", ".4rem"]]], [".pl-\\[0\\.45rem\\]", null, 4, [["padding-left", ".45rem"]]], [".pl-\\[0\\.75rem\\]", null, 4, [["padding-left", ".75rem"]]], [".pl-\\[0\\.85rem\\]", null, 4, [["padding-left", ".85rem"]]], [".pl-\\[1\\.2rem\\]", null, 4, [["padding-left", "1.2rem"]]], [".pl-\\[1\\.55rem\\]", null, 4, [["padding-left", "1.55rem"]]], [".pl-\\[1\\.075rem\\]", null, 4, [["padding-left", "1.075rem"]]], [".pl-\\[1\\.525rem\\]", null, 4, [["padding-left", "1.525rem"]]], [".pl-\\[1\\.875rem\\]", null, 4, [["padding-left", "1.875rem"]]], [".pl-\\[85px\\]", null, 4, [["padding-left", "85px"]]], [".pl-\\[max\\(0\\.5rem\\,env\\(safe-area-inset-left\\)\\)\\]", null, 4, [["padding-left", "max(.5rem, env(safe-area-inset-left))"]]], [".pl-\\[max\\(0\\.25rem\\,env\\(safe-area-inset-left\\)\\)\\]", null, 4, [["padding-left", "max(.25rem, env(safe-area-inset-left))"]]], [".text-center", null, 4, [["text-align", "center"]]], [".text-left", null, 4, [["text-align", "left"]]], [".text-right", null, 4, [["text-align", "right"]]], [".\\[font-family\\:inherit\\]", null, 4, [["font-family", "inherit"]]], [".\\[font-family\\:ui-monospace\\,SFMono-Regular\\,Menlo\\,monospace\\]", null, 4, [["font-family", "ui-monospace, SFMono-Regular, Menlo, monospace"]]], [".\\[font-family\\:var\\(--font-mono\\)\\]", null, 4, [["font-family", "var(--font-mono)"]]], [".text-sm", null, 4, [["font-size", "var(--text-sm)"], ["line-height", "var(--tw-leading, var(--text-sm--line-height))"]]], [".text-xs", null, 4, [["font-size", "var(--text-xs)"], ["line-height", "var(--tw-leading, var(--text-xs--line-height))"]]], [".\\[font-size\\:inherit\\]", null, 4, [["font-size", "inherit"]]], [".text-\\[0\\.6rem\\]", null, 4, [["font-size", ".6rem"]]], [".text-\\[0\\.7rem\\]", null, 4, [["font-size", ".7rem"]]], [".text-\\[0\\.8em\\]", null, 4, [["font-size", ".8em"]]], [".text-\\[0\\.8rem\\]", null, 4, [["font-size", ".8rem"]]], [".text-\\[0\\.9em\\]", null, 4, [["font-size", ".9em"]]], [".text-\\[0\\.9rem\\]", null, 4, [["font-size", ".9rem"]]], [".text-\\[0\\.54rem\\]", null, 4, [["font-size", ".54rem"]]], [".text-\\[0\\.58rem\\]", null, 4, [["font-size", ".58rem"]]], [".text-\\[0\\.62rem\\]", null, 4, [["font-size", ".62rem"]]], [".text-\\[0\\.63rem\\]", null, 4, [["font-size", ".63rem"]]], [".text-\\[0\\.64rem\\]", null, 4, [["font-size", ".64rem"]]], [".text-\\[0\\.65rem\\]", null, 4, [["font-size", ".65rem"]]], [".text-\\[0\\.66rem\\]", null, 4, [["font-size", ".66rem"]]], [".text-\\[0\\.66rem\\]\\!", null, 4, [["font-size", ".66rem", 1]]], [".text-\\[0\\.68rem\\]", null, 4, [["font-size", ".68rem"]]], [".text-\\[0\\.72rem\\]", null, 4, [["font-size", ".72rem"]]], [".text-\\[0\\.74rem\\]", null, 4, [["font-size", ".74rem"]]], [".text-\\[0\\.75rem\\]", null, 4, [["font-size", ".75rem"]]], [".text-\\[0\\.76rem\\]", null, 4, [["font-size", ".76rem"]]], [".text-\\[0\\.77rem\\]", null, 4, [["font-size", ".77rem"]]], [".text-\\[0\\.78rem\\]", null, 4, [["font-size", ".78rem"]]], [".text-\\[0\\.82rem\\]", null, 4, [["font-size", ".82rem"]]], [".text-\\[0\\.83rem\\]", null, 4, [["font-size", ".83rem"]]], [".text-\\[0\\.85rem\\]", null, 4, [["font-size", ".85rem"]]], [".text-\\[0\\.88rem\\]", null, 4, [["font-size", ".88rem"]]], [".text-\\[0\\.95rem\\]", null, 4, [["font-size", ".95rem"]]], [".text-\\[0\\.875rem\\]", null, 4, [["font-size", ".875rem"]]], [".text-\\[1\\.1rem\\]", null, 4, [["font-size", "1.1rem"]]], [".text-\\[1\\.4em\\]", null, 4, [["font-size", "1.4em"]]], [".text-\\[1\\.6rem\\]", null, 4, [["font-size", "1.6rem"]]], [".text-\\[1\\.15rem\\]", null, 4, [["font-size", "1.15rem"]]], [".text-\\[1rem\\]", null, 4, [["font-size", "1rem"]]], [".text-\\[2\\.4rem\\]", null, 4, [["font-size", "2.4rem"]]], [".text-\\[9px\\]", null, 4, [["font-size", "9px"]]], [".text-\\[10px\\]", null, 4, [["font-size", "10px"]]], [".text-\\[11px\\]", null, 4, [["font-size", "11px"]]], [".text-\\[12\\.5px\\]", null, 4, [["font-size", "12.5px"]]], [".text-\\[12px\\]", null, 4, [["font-size", "12px"]]], [".text-\\[13px\\]", null, 4, [["font-size", "13px"]]], [".text-\\[14px\\]", null, 4, [["font-size", "14px"]]], [".text-\\[calc\\(0\\.95rem\\*var\\(--chat-font-scale\\,1\\)\\)\\]", null, 4, [["font-size", "calc(.95rem * var(--chat-font-scale, 1))"]]], [".text-\\[length\\:calc\\(11px\\*var\\(--zoom\\,1\\)\\)\\]", null, 4, [["font-size", "calc(11px * var(--zoom, 1))"]]], [".text-\\[length\\:calc\\(13px\\*var\\(--zoom\\,1\\)\\)\\]", null, 4, [["font-size", "calc(13px * var(--zoom, 1))"]]], [".leading-4", null, 4, [["--tw-leading", "calc(var(--spacing) * 4)"], ["line-height", "calc(var(--spacing) * 4)"]]], [".leading-\\[1\\.1\\]", null, 4, [["--tw-leading", "1.1"], ["line-height", "1.1"]]], [".leading-\\[1\\.2\\]", null, 4, [["--tw-leading", "1.2"], ["line-height", "1.2"]]], [".leading-\\[1\\.3\\]", null, 4, [["--tw-leading", "1.3"], ["line-height", "1.3"]]], [".leading-\\[1\\.4\\]", null, 4, [["--tw-leading", "1.4"], ["line-height", "1.4"]]], [".leading-\\[1\\.5\\]", null, 4, [["--tw-leading", "1.5"], ["line-height", "1.5"]]], [".leading-\\[1\\.6\\]", null, 4, [["--tw-leading", "1.6"], ["line-height", "1.6"]]], [".leading-\\[1\\.45\\]", null, 4, [["--tw-leading", "1.45"], ["line-height", "1.45"]]], [".leading-\\[18px\\]", null, 4, [["--tw-leading", "18px"], ["line-height", "18px"]]], [".leading-none", null, 4, [["--tw-leading", "1"], ["line-height", "1"]]], [".leading-relaxed", null, 4, [["--tw-leading", "var(--leading-relaxed)"], ["line-height", "var(--leading-relaxed)"]]], [".leading-tight", null, 4, [["--tw-leading", "var(--leading-tight)"], ["line-height", "var(--leading-tight)"]]], [".\\[line-height\\:inherit\\]", null, 4, [["line-height", "inherit"]]], [".font-bold", null, 4, [["--tw-font-weight", "var(--font-weight-bold)"], ["font-weight", "var(--font-weight-bold)"]]], [".font-medium", null, 4, [["--tw-font-weight", "var(--font-weight-medium)"], ["font-weight", "var(--font-weight-medium)"]]], [".font-normal", null, 4, [["--tw-font-weight", "var(--font-weight-normal)"], ["font-weight", "var(--font-weight-normal)"]]], [".font-semibold", null, 4, [["--tw-font-weight", "var(--font-weight-semibold)"], ["font-weight", "var(--font-weight-semibold)"]]], [".\\[font-weight\\:inherit\\]", null, 4, [["font-weight", "inherit"]]], [".tracking-\\[-0\\.02em\\]", null, 4, [["--tw-tracking", "-.02em"], ["letter-spacing", "-.02em"]]], [".tracking-\\[0\\.03em\\]", null, 4, [["--tw-tracking", ".03em"], ["letter-spacing", ".03em"]]], [".tracking-\\[0\\.04em\\]", null, 4, [["--tw-tracking", ".04em"], ["letter-spacing", ".04em"]]], [".tracking-\\[0\\.06em\\]", null, 4, [["--tw-tracking", ".06em"], ["letter-spacing", ".06em"]]], [".tracking-\\[0\\.08em\\]", null, 4, [["--tw-tracking", ".08em"], ["letter-spacing", ".08em"]]], [".tracking-\\[0\\.09em\\]", null, 4, [["--tw-tracking", ".09em"], ["letter-spacing", ".09em"]]], [".tracking-\\[0\\.22em\\]", null, 4, [["--tw-tracking", ".22em"], ["letter-spacing", ".22em"]]], [".tracking-normal", null, 4, [["--tw-tracking", "var(--tracking-normal)"], ["letter-spacing", "var(--tracking-normal)"]]], [".tracking-wide", null, 4, [["--tw-tracking", "var(--tracking-wide)"], ["letter-spacing", "var(--tracking-wide)"]]], [".\\[overflow-wrap\\:anywhere\\]", null, 4, [["overflow-wrap", "anywhere"]]], [".break-words", null, 4, [["overflow-wrap", "break-word"]]], [".\\[word-break\\:break-word\\]", null, 4, [["word-break", "break-word"]]], [".text-ellipsis", null, 4, [["text-overflow", "ellipsis"]]], [".whitespace-normal", null, 4, [["white-space", "normal"]]], [".whitespace-nowrap", null, 4, [["white-space", "nowrap"]]], [".whitespace-pre", null, 4, [["white-space", "pre"]]], [".whitespace-pre-wrap", null, 4, [["white-space", "pre-wrap"]]], [".\\[tab-size\\:2\\]", null, 4, [["tab-size", "2"]]], [".text-\\[color\\:var\\(--git-muted\\)\\]", null, 4, [["color", "var(--git-muted)"]]], [".text-\\[var\\(--subtext-0\\)\\]", null, 4, [["color", "var(--subtext-0)"]]], [".text-\\[var\\(--text\\)\\]", null, 4, [["color", "var(--text)"]]], [".text-accent", null, 4, [["color", "var(--accent)"]]], [".text-blue", null, 4, [["color", "var(--blue)"]]], [".text-current", null, 4, [["color", "currentColor"]]], [".text-fg", null, 4, [["color", "var(--text)"]]], [".text-green", null, 4, [["color", "var(--green)"]]], [".text-inherit", null, 4, [["color", "inherit"]]], [".text-mauve", null, 4, [["color", "var(--mauve)"]]], [".text-overlay-0", null, 4, [["color", "var(--overlay-0)"]]], [".text-overlay-1", null, 4, [["color", "var(--overlay-1)"]]], [".text-panel-bg", null, 4, [["color", "var(--panel-bg)"]]], [".text-peach", null, 4, [["color", "var(--peach)"]]], [".text-red", null, 4, [["color", "var(--red)"]]], [".text-red\\!", null, 4, [["color", "var(--red)", 1]]], [".text-subtext-0", null, 4, [["color", "var(--subtext-0)"]]], [".text-yellow", null, 4, [["color", "var(--yellow)"]]], [".capitalize", null, 4, [["text-transform", "capitalize"]]], [".normal-case", null, 4, [["text-transform", "none"]]], [".uppercase", null, 4, [["text-transform", "uppercase"]]], [".italic", null, 4, [["font-style", "italic"]]], [".not-italic", null, 4, [["font-style", "normal"]]], [".tabular-nums", null, 4, [["--tw-numeric-spacing", "tabular-nums"], ["font-variant-numeric", "var(--tw-ordinal, ) var(--tw-slashed-zero, ) var(--tw-numeric-figure, ) var(--tw-numeric-spacing, ) var(--tw-numeric-fraction, )"]]], [".line-through", null, 4, [["text-decoration-line", "line-through"]]], [".no-underline", null, 4, [["text-decoration-line", "none"]]], [".underline", null, 4, [["text-decoration-line", "underline"]]], [".opacity-0", null, 4, [["opacity", "0"]]], [".opacity-40", null, 4, [["opacity", ".4"]]], [".opacity-60", null, 4, [["opacity", ".6"]]], [".opacity-70", null, 4, [["opacity", ".7"]]], [".opacity-75", null, 4, [["opacity", ".75"]]], [".opacity-80", null, 4, [["opacity", ".8"]]], [".opacity-100", null, 4, [["opacity", "1"]]], [".opacity-\\[0\\.72\\]", null, 4, [["opacity", ".72"]]], [".shadow", null, 4, [["--tw-shadow", "0 1px 3px 0 var(--tw-shadow-color, #0000001a), 0 1px 2px -1px var(--tw-shadow-color, #0000001a)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_1px_4px_rgba\\(0\\,0\\,0\\,0\\.4\\)\\]", null, 4, [["--tw-shadow", "0 1px 4px var(--tw-shadow-color, #0006)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_2px_8px_rgba\\(0\\,0\\,0\\,0\\.4\\)\\]", null, 4, [["--tw-shadow", "0 2px 8px var(--tw-shadow-color, #0006)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_2px_8px_rgba\\(0\\,0\\,0\\,0\\.35\\)\\]", null, 4, [["--tw-shadow", "0 2px 8px var(--tw-shadow-color, #00000059)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_6px_20px_rgba\\(0\\,0\\,0\\,0\\.3\\)\\]", null, 4, [["--tw-shadow", "0 6px 20px var(--tw-shadow-color, #0000004d)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_8px_24px_rgba\\(0\\,0\\,0\\,0\\.35\\)\\]", null, 4, [["--tw-shadow", "0 8px 24px var(--tw-shadow-color, #00000059)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_8px_24px_rgba\\(0\\,0\\,0\\,0\\.45\\)\\]", null, 4, [["--tw-shadow", "0 8px 24px var(--tw-shadow-color, #00000073)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_8px_32px_rgba\\(0\\,0\\,0\\,0\\.5\\)\\]", null, 4, [["--tw-shadow", "0 8px 32px var(--tw-shadow-color, #00000080)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_12px_32px_rgba\\(0\\,0\\,0\\,0\\.5\\)\\]", null, 4, [["--tw-shadow", "0 12px 32px var(--tw-shadow-color, #00000080)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_16px_48px_rgba\\(0\\,0\\,0\\,0\\.55\\)\\]", null, 4, [["--tw-shadow", "0 16px 48px var(--tw-shadow-color, #0000008c)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[inset_0_0_24px_var\\(--accent\\)\\]", null, 4, [["--tw-shadow", "inset 0 0 24px var(--tw-shadow-color, var(--accent))"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-lg", null, 4, [["--tw-shadow", "0 10px 15px -3px var(--tw-shadow-color, #0000001a), 0 4px 6px -4px var(--tw-shadow-color, #0000001a)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".ring", null, 4, [["--tw-ring-shadow", "var(--tw-ring-inset, ) 0 0 0 calc(1px + var(--tw-ring-offset-width)) var(--tw-ring-color, currentcolor)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".\\[box-shadow\\:0_1px_2px_rgba\\(0\\,0\\,0\\,0\\.3\\)\\]", null, 4, [["box-shadow", "0 1px 2px #0000004d"]]], [".\\[box-shadow\\:0_4px_14px_rgba\\(0\\,0\\,0\\,0\\.35\\)\\]", null, 4, [["box-shadow", "0 4px 14px #00000059"]]], [".\\[box-shadow\\:none\\]", null, 4, [["box-shadow", "none"]]], [".\\[outline\\:none\\]", null, 4, [["outline", "none"]]], [".outline, .outline-1", null, 4, [["outline-style", "var(--tw-outline-style)"], ["outline-width", "1px"]]], [".outline-2", null, 4, [["outline-style", "var(--tw-outline-style)"], ["outline-width", "2px"]]], [".outline-accent", null, 4, [["outline-color", "var(--accent)"]]], [".blur", null, 4, [["--tw-blur", "blur(8px)"], ["filter", "var(--tw-blur, ) var(--tw-brightness, ) var(--tw-contrast, ) var(--tw-grayscale, ) var(--tw-hue-rotate, ) var(--tw-invert, ) var(--tw-saturate, ) var(--tw-sepia, ) var(--tw-drop-shadow, )"]]], [".\\!filter", null, 4, [["filter", "var(--tw-blur, ) var(--tw-brightness, ) var(--tw-contrast, ) var(--tw-grayscale, ) var(--tw-hue-rotate, ) var(--tw-invert, ) var(--tw-saturate, ) var(--tw-sepia, ) var(--tw-drop-shadow, )", 1]]], [".\\[filter\\:drop-shadow\\(0_6px_10px_rgba\\(0\\,0\\,0\\,0\\.45\\)\\)\\]", null, 4, [["filter", "drop-shadow(0 6px 10px #00000073)"]]], [".filter", null, 4, [["filter", "var(--tw-blur, ) var(--tw-brightness, ) var(--tw-contrast, ) var(--tw-grayscale, ) var(--tw-hue-rotate, ) var(--tw-invert, ) var(--tw-saturate, ) var(--tw-sepia, ) var(--tw-drop-shadow, )"]]], [".backdrop-blur-xl", null, 4, [["--tw-backdrop-blur", "blur(var(--blur-xl))"], ["-webkit-backdrop-filter", "var(--tw-backdrop-blur, ) var(--tw-backdrop-brightness, ) var(--tw-backdrop-contrast, ) var(--tw-backdrop-grayscale, ) var(--tw-backdrop-hue-rotate, ) var(--tw-backdrop-invert, ) var(--tw-backdrop-opacity, ) var(--tw-backdrop-saturate, ) var(--tw-backdrop-sepia, )"], ["backdrop-filter", "var(--tw-backdrop-blur, ) var(--tw-backdrop-brightness, ) var(--tw-backdrop-contrast, ) var(--tw-backdrop-grayscale, ) var(--tw-backdrop-hue-rotate, ) var(--tw-backdrop-invert, ) var(--tw-backdrop-opacity, ) var(--tw-backdrop-saturate, ) var(--tw-backdrop-sepia, )"]]], [".backdrop-saturate-150", null, 4, [["--tw-backdrop-saturate", "saturate(150%)"], ["-webkit-backdrop-filter", "var(--tw-backdrop-blur, ) var(--tw-backdrop-brightness, ) var(--tw-backdrop-contrast, ) var(--tw-backdrop-grayscale, ) var(--tw-backdrop-hue-rotate, ) var(--tw-backdrop-invert, ) var(--tw-backdrop-opacity, ) var(--tw-backdrop-saturate, ) var(--tw-backdrop-sepia, )"], ["backdrop-filter", "var(--tw-backdrop-blur, ) var(--tw-backdrop-brightness, ) var(--tw-backdrop-contrast, ) var(--tw-backdrop-grayscale, ) var(--tw-backdrop-hue-rotate, ) var(--tw-backdrop-invert, ) var(--tw-backdrop-opacity, ) var(--tw-backdrop-saturate, ) var(--tw-backdrop-sepia, )"]]], [".transition", null, 4, [["transition-property", "color, background-color, border-color, outline-color, text-decoration-color, fill, stroke, --tw-gradient-from, --tw-gradient-via, --tw-gradient-to, opacity, box-shadow, transform, translate, scale, rotate, filter, -webkit-backdrop-filter, backdrop-filter, display, content-visibility, overlay, pointer-events"], ["transition-timing-function", "var(--tw-ease, var(--default-transition-timing-function))"], ["transition-duration", "var(--tw-duration, var(--default-transition-duration))"]]], [".transition-\\[left\\,top\\,width\\,height\\]", null, 4, [["transition-property", "left, top, width, height"], ["transition-timing-function", "var(--tw-ease, var(--default-transition-timing-function))"], ["transition-duration", "var(--tw-duration, var(--default-transition-duration))"]]], [".transition-opacity", null, 4, [["transition-property", "opacity"], ["transition-timing-function", "var(--tw-ease, var(--default-transition-timing-function))"], ["transition-duration", "var(--tw-duration, var(--default-transition-duration))"]]], [".duration-150", null, 4, [["--tw-duration", ".15s"], ["transition-duration", ".15s"]]], [".ease-out", null, 4, [["--tw-ease", "var(--ease-out)"], ["transition-timing-function", "var(--ease-out)"]]], [".outline-none", null, 4, [["--tw-outline-style", "none"], ["outline-style", "none"]]], [".outline-solid", null, 4, [["--tw-outline-style", "solid"], ["outline-style", "solid"]]], [".select-none", null, 4, [["-webkit-user-select", "none"], ["user-select", "none"]]], [".select-text", null, 4, [["-webkit-user-select", "text"], ["user-select", "text"]]], [".\\[--panel-bg\\:var\\(--surface-dim\\)\\]", null, 4, [["--panel-bg", "var(--surface-dim)"]]], [".\\[--picker-bg\\:var\\(--surface-0\\)\\]", null, 4, [["--picker-bg", "var(--surface-0)"]]], [".\\[--radius\\:var\\(--radius-pane\\)\\]", null, 4, [["--radius", "var(--radius-pane)"]]], [".\\[--workspace-tools-bg\\:transparent\\]", null, 4, [["--workspace-tools-bg", "transparent"]]], [".\\[-webkit-box-orient\\:vertical\\]", null, 4, [["-webkit-box-orient", "vertical"]]], [".\\[-webkit-line-clamp\\:3\\]", null, 4, [["-webkit-line-clamp", "3"]]], [".\\[-webkit-touch-callout\\:none\\]", null, 4, [["-webkit-touch-callout", "none"]]], [".\\[background\\:none\\]", null, 4, [["background", "none"]]], [".\\[border-right\\:1px_solid_var\\(--git-border\\)\\]", null, 4, [["border-right", "1px solid var(--git-border)"]]], [".\\[border-top\\:1px_solid_var\\(--git-border\\)\\]", null, 4, [["border-top", "1px solid var(--git-border)"]]], [".\\[border\\:0\\]", null, 4, [["border", "0"]]], [".\\[border\\:none\\]", null, 4, [["border", "none"]]], [".\\[font\\:1\\.15rem\\/1_var\\(--font-mono\\)\\]", null, 4, [["font", "1.15rem/1 var(--font-mono)"]]], [".\\[font\\:1rem\\/1\\.2_var\\(--font-mono\\)\\]", null, 4, [["font", "1rem/1.2 var(--font-mono)"]]], [".\\[font\\:inherit\\]", null, 4, [["font", "inherit"]]], [".\\[transition\\:background_0\\.1s_ease\\]", null, 4, [["transition", "background .1s"]]], [".\\[transition\\:background_0\\.12s_ease\\]", null, 4, [["transition", "background .12s"]]], [".\\[transition\\:background_0\\.15s_ease\\]", null, 4, [["transition", "background .15s"]]], [".\\[transition\\:color_0\\.1s_ease\\,background_0\\.1s_ease\\]", null, 4, [["transition", "color .1s, background .1s"]]], [".\\[transition\\:color_0\\.12s_ease\\,background_0\\.12s_ease\\]", null, 4, [["transition", "color .12s, background .12s"]]], [".\\[transition\\:color_0\\.15s_ease\\]", null, 4, [["transition", "color .15s"]]], [".\\[transition\\:opacity_0\\.12s_ease\\]", null, 4, [["transition", "opacity .12s"]]], [".\\[transition\\:transform_0\\.15s_ease\\,background_0\\.15s_ease\\]", null, 4, [["transition", "transform .15s, background .15s"]]], [".not-has-\\[\\[data-setting-row\\]\\]\\:hidden:not(:has([data-setting-row]))", null, 4, [["display", "none"]]], [".group-focus-within\\:flex:is(:where(.group):focus-within *)", null, 4, [["display", "flex"]]], [".group-focus-within\\/row\\:opacity-100:is(:where(.group\\/row):focus-within *)", null, 4, [["opacity", "1"]]], [".group-hover\\:flex:is(:where(.group):hover *)", null, 4, [["display", "flex"]]], [".group-hover\\:opacity-100:is(:where(.group):hover *)", null, 4, [["opacity", "1"]]], [".group-hover\\/line\\:opacity-90:is(:where(.group\\/line):hover *)", null, 4, [["opacity", ".9"]]], [".group-hover\\/ph\\:opacity-100:is(:where(.group\\/ph):hover *), .group-hover\\/row\\:opacity-100:is(:where(.group\\/row):hover *)", null, 4, [["opacity", "1"]]], [".group-focus\\/tree\\:ring-1:is(:where(.group\\/tree):focus *)", null, 4, [["--tw-ring-shadow", "var(--tw-ring-inset, ) 0 0 0 calc(1px + var(--tw-ring-offset-width)) var(--tw-ring-color, currentcolor)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".group-focus\\/tree\\:ring-overlay-1:is(:where(.group\\/tree):focus *)", null, 4, [["--tw-ring-color", "var(--overlay-1)"]]], [".group-focus\\/tree\\:ring-inset:is(:where(.group\\/tree):focus *)", null, 4, [["--tw-ring-inset", "inset"]]], ['.group-aria-checked\\:\\[transform\\:translateX\\(1\\.1rem\\)\\]:is(:where(.group)[aria-checked="true"] *)', null, 4, [["transform", "translateX(1.1rem)"]]], ['.group-aria-checked\\:border-accent:is(:where(.group)[aria-checked="true"] *)', null, 4, [["border-color", "var(--accent)"]]], ['.group-aria-checked\\:bg-accent:is(:where(.group)[aria-checked="true"] *)', null, 4, [["background-color", "var(--accent)"]]], ['.group-aria-checked\\:bg-panel-bg:is(:where(.group)[aria-checked="true"] *)', null, 4, [["background-color", "var(--panel-bg)"]]], ['.group-aria-checked\\:text-accent:is(:where(.group)[aria-checked="true"] *), .group-aria-\\[checked\\=false\\]\\:text-accent:is(:where(.group)[aria-checked="false"] *)', null, 4, [["color", "var(--accent)"]]], [".placeholder\\:text-subtext-0::placeholder", null, 4, [["color", "var(--subtext-0)"]]], [".before\\:absolute:before", null, 4, [["content", "var(--tw-content)"], ["position", "absolute"]]], [".before\\:top-\\[0\\.15rem\\]:before", null, 4, [["content", "var(--tw-content)"], ["top", ".15rem"]]], [".before\\:left-\\[0\\.15rem\\]:before", null, 4, [["content", "var(--tw-content)"], ["left", ".15rem"]]], [".before\\:h-\\[0\\.95rem\\]:before", null, 4, [["content", "var(--tw-content)"], ["height", ".95rem"]]], [".before\\:w-\\[0\\.95rem\\]:before", null, 4, [["content", "var(--tw-content)"], ["width", ".95rem"]]], [".before\\:rounded-full:before", null, 4, [["content", "var(--tw-content)"], ["border-radius", "3.40282e38px"]]], [".before\\:bg-fg:before", null, 4, [["content", "var(--tw-content)"], ["background-color", "var(--text)"]]], [".before\\:content-\\[\\'\\'\\]:before", null, 4, [["--tw-content", '""'], ["content", "var(--tw-content)"]]], [".before\\:\\[transition\\:transform_0\\.12s_ease\\]:before", null, 4, [["content", "var(--tw-content)"], ["transition", "transform .12s"]]], [".after\\:absolute:after", null, 4, [["content", "var(--tw-content)"], ["position", "absolute"]]], [".after\\:inset-0:after", null, 4, [["content", "var(--tw-content)"], ["inset", "0"]]], [".after\\:inset-x-0:after", null, 4, [["content", "var(--tw-content)"], ["inset-inline", "0"]]], [".after\\:-inset-y-2:after", null, 4, [["content", "var(--tw-content)"], ["inset-block", "calc(var(--spacing) * -2)"]]], [".after\\:m-auto:after", null, 4, [["content", "var(--tw-content)"], ["margin", "auto"]]], [".after\\:h-8:after", null, 4, [["content", "var(--tw-content)"], ["height", "calc(var(--spacing) * 8)"]]], [".after\\:h-12:after", null, 4, [["content", "var(--tw-content)"], ["height", "calc(var(--spacing) * 12)"]]], [".after\\:h-\\[3px\\]:after", null, 4, [["content", "var(--tw-content)"], ["height", "3px"]]], [".after\\:w-8:after", null, 4, [["content", "var(--tw-content)"], ["width", "calc(var(--spacing) * 8)"]]], [".after\\:w-\\[3px\\]:after", null, 4, [["content", "var(--tw-content)"], ["width", "3px"]]], [".after\\:rounded-full:after", null, 4, [["content", "var(--tw-content)"], ["border-radius", "3.40282e38px"]]], [".after\\:bg-transparent:after", null, 4, [["content", "var(--tw-content)"], ["background-color", "#0000"]]], [".after\\:content-\\[\\'\\'\\]:after", null, 4, [["--tw-content", '""'], ["content", "var(--tw-content)"]]], [".last\\:border-b-0:last-child", null, 4, [["border-bottom-style", "var(--tw-border-style)"], ["border-bottom-width", "0"]]], [".checked\\:bg-accent:checked", null, 4, [["background-color", "var(--accent)"]]], [".checked\\:before\\:translate-x-\\[1rem\\]:checked:before", null, 4, [["content", "var(--tw-content)"], ["--tw-translate-x", "1rem"], ["translate", "var(--tw-translate-x) var(--tw-translate-y)"]]], [".checked\\:before\\:bg-panel-bg:checked:before", null, 4, [["content", "var(--tw-content)"], ["background-color", "var(--panel-bg)"]]], [".focus-within\\:bg-surface-1:focus-within", null, 4, [["background-color", "var(--surface-1)"]]], [".focus-within\\:outline:focus-within, .focus-within\\:outline-1:focus-within", null, 4, [["outline-style", "var(--tw-outline-style)"], ["outline-width", "1px"]]], [".focus-within\\:outline-fg:focus-within", null, 4, [["outline-color", "var(--text)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_12\\%\\,transparent\\)\\]:hover", null, 4, [["background-color", "var(--accent)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_12\\%\\,transparent\\)\\]:hover", null, 4, [["background-color", "color-mix(in srgb,var(--accent) 12%,transparent)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_15\\%\\,transparent\\)\\]:hover", null, 4, [["background-color", "var(--accent)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_15\\%\\,transparent\\)\\]:hover", null, 4, [["background-color", "color-mix(in srgb,var(--accent) 15%,transparent)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--text\\)_10\\%\\,var\\(--panel-bg\\)\\)\\]:hover", null, 4, [["background-color", "var(--text)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--text\\)_10\\%\\,var\\(--panel-bg\\)\\)\\]:hover", null, 4, [["background-color", "color-mix(in srgb,var(--text) 10%,var(--panel-bg))"]]], [".hover\\:bg-\\[var\\(--surface-0\\)\\]:hover", null, 4, [["background-color", "var(--surface-0)"]]], [".hover\\:bg-accent:hover", null, 4, [["background-color", "var(--accent)"]]], [".hover\\:bg-overlay-0:hover", null, 4, [["background-color", "var(--overlay-0)"]]], [".hover\\:bg-panel-bg:hover", null, 4, [["background-color", "var(--panel-bg)"]]], [".hover\\:bg-surface-0:hover", null, 4, [["background-color", "var(--surface-0)"]]], [".hover\\:bg-surface-1:hover", null, 4, [["background-color", "var(--surface-1)"]]], [".hover\\:bg-transparent:hover", null, 4, [["background-color", "#0000"]]], [".hover\\:text-accent:hover", null, 4, [["color", "var(--accent)"]]], [".hover\\:text-fg:hover", null, 4, [["color", "var(--text)"]]], [".hover\\:text-inherit:hover", null, 4, [["color", "inherit"]]], [".hover\\:text-overlay-0:hover", null, 4, [["color", "var(--overlay-0)"]]], [".hover\\:text-panel-bg:hover", null, 4, [["color", "var(--panel-bg)"]]], [".hover\\:text-red:hover", null, 4, [["color", "var(--red)"]]], [".hover\\:text-subtext-0:hover", null, 4, [["color", "var(--subtext-0)"]]], [".hover\\:text-yellow:hover", null, 4, [["color", "var(--yellow)"]]], [".hover\\:underline:hover", null, 4, [["text-decoration-line", "underline"]]], [".hover\\:opacity-60:hover", null, 4, [["opacity", ".6"]]], [".hover\\:opacity-100\\!:hover", null, 4, [["opacity", "1", 1]]], [".hover\\:opacity-\\[0\\.85\\]:hover", null, 4, [["opacity", ".85"]]], [".hover\\:brightness-110:hover", null, 4, [["--tw-brightness", "brightness(110%)"], ["filter", "var(--tw-blur, ) var(--tw-brightness, ) var(--tw-contrast, ) var(--tw-grayscale, ) var(--tw-hue-rotate, ) var(--tw-invert, ) var(--tw-saturate, ) var(--tw-sepia, ) var(--tw-drop-shadow, )"]]], [".hover\\:\\[filter\\:brightness\\(1\\.08\\)\\]:hover", null, 4, [["filter", "brightness(1.08)"]]], [".hover\\:after\\:bg-overlay-1:hover:after", null, 4, [["content", "var(--tw-content)"], ["background-color", "var(--overlay-1)"]]], [".focus\\:\\[outline\\:1px_solid_var\\(--accent\\)\\]:focus", null, 4, [["outline", "1px solid var(--accent)"]]], [".focus\\:outline-2:focus", null, 4, [["outline-style", "var(--tw-outline-style)"], ["outline-width", "2px"]]], [".focus\\:outline-none:focus", null, 4, [["--tw-outline-style", "none"], ["outline-style", "none"]]], [".focus-visible\\:bg-accent:focus-visible", null, 4, [["background-color", "var(--accent)"]]], [".focus-visible\\:bg-surface-0:focus-visible", null, 4, [["background-color", "var(--surface-0)"]]], [".focus-visible\\:bg-surface-1:focus-visible", null, 4, [["background-color", "var(--surface-1)"]]], [".focus-visible\\:text-accent:focus-visible", null, 4, [["color", "var(--accent)"]]], [".focus-visible\\:text-fg:focus-visible", null, 4, [["color", "var(--text)"]]], [".focus-visible\\:text-panel-bg:focus-visible", null, 4, [["color", "var(--panel-bg)"]]], [".focus-visible\\:text-red:focus-visible", null, 4, [["color", "var(--red)"]]], [".focus-visible\\:text-yellow:focus-visible", null, 4, [["color", "var(--yellow)"]]], [".focus-visible\\:underline:focus-visible", null, 4, [["text-decoration-line", "underline"]]], [".focus-visible\\:opacity-100:focus-visible", null, 4, [["opacity", "1"]]], [".focus-visible\\:\\[outline\\:1px_solid_var\\(--accent\\)\\]:focus-visible", null, 4, [["outline", "1px solid var(--accent)"]]], [".focus-visible\\:\\[outline\\:1px_solid_var\\(--overlay-1\\)\\]:focus-visible", null, 4, [["outline", "1px solid var(--overlay-1)"]]], [".focus-visible\\:\\[outline\\:2px_solid_var\\(--accent\\)\\]:focus-visible", null, 4, [["outline", "2px solid var(--accent)"]]], [".focus-visible\\:outline:focus-visible, .focus-visible\\:outline-1:focus-visible", null, 4, [["outline-style", "var(--tw-outline-style)"], ["outline-width", "1px"]]], [".focus-visible\\:\\[outline-offset\\:-1px\\]:focus-visible", null, 4, [["outline-offset", "-1px"]]], [".focus-visible\\:\\[outline-offset\\:-2px\\]:focus-visible", null, 4, [["outline-offset", "-2px"]]], [".focus-visible\\:\\[outline-offset\\:2px\\]:focus-visible", null, 4, [["outline-offset", "2px"]]], [".focus-visible\\:outline-offset-1:focus-visible", null, 4, [["outline-offset", "1px"]]], [".focus-visible\\:outline-fg:focus-visible", null, 4, [["outline-color", "var(--text)"]]], [".focus-visible\\:after\\:bg-accent:focus-visible:after", null, 4, [["content", "var(--tw-content)"], ["background-color", "var(--accent)"]]], [".active\\:cursor-grabbing:active", null, 4, [["cursor", "grabbing"]]], [".active\\:bg-surface-1:active", null, 4, [["background-color", "var(--surface-1)"]]], [".active\\:text-fg:active", null, 4, [["color", "var(--text)"]]], [".active\\:after\\:bg-accent:active:after", null, 4, [["content", "var(--tw-content)"], ["background-color", "var(--accent)"]]], [".enabled\\:hover\\:bg-surface-1:enabled:hover", null, 4, [["background-color", "var(--surface-1)"]]], [".enabled\\:hover\\:text-fg:enabled:hover", null, 4, [["color", "var(--text)"]]], [".disabled\\:cursor-default:disabled", null, 4, [["cursor", "default"]]], [".disabled\\:cursor-not-allowed:disabled", null, 4, [["cursor", "not-allowed"]]], [".disabled\\:cursor-not-allowed\\!:disabled", null, 4, [["cursor", "not-allowed", 1]]], [".disabled\\:cursor-wait:disabled", null, 4, [["cursor", "wait"]]], [".disabled\\:bg-transparent:disabled", null, 4, [["background-color", "#0000"]]], [".disabled\\:text-fg:disabled", null, 4, [["color", "var(--text)"]]], [".disabled\\:opacity-40:disabled", null, 4, [["opacity", ".4"]]], [".disabled\\:opacity-50:disabled", null, 4, [["opacity", ".5"]]], [".disabled\\:opacity-\\[0\\.45\\]:disabled", null, 4, [["opacity", ".45"]]], [".disabled\\:opacity-\\[0\\.55\\]:disabled", null, 4, [["opacity", ".55"]]], [":where(.app--mac-desktop) .in-\\[\\.app--mac-desktop\\]\\:pl-\\[84px\\]", null, 4, [["padding-left", "84px"]]], [".has-\\[\\:checked\\]\\:bg-surface-0:has(:checked)", null, 4, [["background-color", "var(--surface-0)"]]], [".has-\\[\\:checked\\]\\:text-fg:has(:checked)", null, 4, [["color", "var(--text)"]]], [".has-\\[\\:focus-visible\\]\\:bg-surface-0:has(:focus-visible)", null, 4, [["background-color", "var(--surface-0)"]]], ['.aria-disabled\\:cursor-not-allowed[aria-disabled="true"]', null, 4, [["cursor", "not-allowed"]]], ['.aria-disabled\\:opacity-40[aria-disabled="true"]', null, 4, [["opacity", ".4"]]], ['.aria-expanded\\:opacity-100[aria-expanded="true"]', null, 4, [["opacity", "1"]]], ['.aria-pressed\\:bg-surface-0[aria-pressed="true"]', null, 4, [["background-color", "var(--surface-0)"]]], ['.aria-pressed\\:text-fg[aria-pressed="true"]', null, 4, [["color", "var(--text)"]]], [".motion-reduce\\:animate-none", ["(prefers-reduced-motion: reduce)"], 4, [["animation", "none"]]], [".max-\\[900px\\]\\:hidden", ["not all and (min-width: 900px)"], 4, [["display", "none"]]], [".max-\\[700px\\]\\:hidden", ["not all and (min-width: 700px)"], 4, [["display", "none"]]], [".max-\\[700px\\]\\:size-11", ["not all and (min-width: 700px)"], 4, [["width", "calc(var(--spacing) * 11)"], ["height", "calc(var(--spacing) * 11)"]]], [".max-\\[700px\\]\\:h-9", ["not all and (min-width: 700px)"], 4, [["height", "calc(var(--spacing) * 9)"]]], [".max-\\[700px\\]\\:h-12", ["not all and (min-width: 700px)"], 4, [["height", "calc(var(--spacing) * 12)"]]], [".max-\\[700px\\]\\:min-h-9", ["not all and (min-width: 700px)"], 4, [["min-height", "calc(var(--spacing) * 9)"]]], [".max-\\[700px\\]\\:min-h-11", ["not all and (min-width: 700px)"], 4, [["min-height", "calc(var(--spacing) * 11)"]]], [".max-\\[700px\\]\\:w-24", ["not all and (min-width: 700px)"], 4, [["width", "calc(var(--spacing) * 24)"]]], [".max-\\[700px\\]\\:min-w-11", ["not all and (min-width: 700px)"], 4, [["min-width", "calc(var(--spacing) * 11)"]]], [".max-\\[700px\\]\\:flex-1", ["not all and (min-width: 700px)"], 4, [["flex", "1"]]], [".max-\\[700px\\]\\:flex-\\[1_1_6rem\\]", ["not all and (min-width: 700px)"], 4, [["flex", "6rem"]]], [".max-\\[700px\\]\\:flex-\\[1_1_100\\%\\]", ["not all and (min-width: 700px)"], 4, [["flex", "100%"]]], [".max-\\[700px\\]\\:basis-56", ["not all and (min-width: 700px)"], 4, [["flex-basis", "calc(var(--spacing) * 56)"]]], [".max-\\[700px\\]\\:basis-full", ["not all and (min-width: 700px)"], 4, [["flex-basis", "100%"]]], [".max-\\[700px\\]\\:flex-wrap", ["not all and (min-width: 700px)"], 4, [["flex-wrap", "wrap"]]], [".max-\\[700px\\]\\:gap-y-2", ["not all and (min-width: 700px)"], 4, [["row-gap", "calc(var(--spacing) * 2)"]]], [".min-\\[701px\\]\\:left-auto", ["(min-width: 701px)"], 4, [["left", "auto"]]], [".min-\\[701px\\]\\:my-\\[3px\\]", ["(min-width: 701px)"], 4, [["margin-block", "3px"]]], [".min-\\[701px\\]\\:block", ["(min-width: 701px)"], 4, [["display", "block"]]], [".min-\\[701px\\]\\:hidden", ["(min-width: 701px)"], 4, [["display", "none"]]], [".min-\\[701px\\]\\:min-h-6", ["(min-width: 701px)"], 4, [["min-height", "calc(var(--spacing) * 6)"]]], [".min-\\[701px\\]\\:w-80", ["(min-width: 701px)"], 4, [["width", "calc(var(--spacing) * 80)"]]], [".min-\\[701px\\]\\:rounded-ui", ["(min-width: 701px)"], 4, [["border-radius", "var(--radius)"]]], [".min-\\[701px\\]\\:px-3", ["(min-width: 701px)"], 4, [["padding-inline", "calc(var(--spacing) * 3)"]]], [".min-\\[701px\\]\\:px-4", ["(min-width: 701px)"], 4, [["padding-inline", "calc(var(--spacing) * 4)"]]], [".min-\\[701px\\]\\:pr-\\[3px\\]", ["(min-width: 701px)"], 4, [["padding-right", "3px"]]], [".min-\\[701px\\]\\:pl-4", ["(min-width: 701px)"], 4, [["padding-left", "calc(var(--spacing) * 4)"]]], [".min-\\[701px\\]\\:text-\\[0\\.62rem\\]", ["(min-width: 701px)"], 4, [["font-size", ".62rem"]]], [".min-\\[701px\\]\\:text-\\[12\\.5px\\]", ["(min-width: 701px)"], 4, [["font-size", "12.5px"]]], [".min-\\[701px\\]\\:text-\\[12px\\]", ["(min-width: 701px)"], 4, [["font-size", "12px"]]], [".min-\\[701px\\]\\:font-medium", ["(min-width: 701px)"], 4, [["--tw-font-weight", "var(--font-weight-medium)"], ["font-weight", "var(--font-weight-medium)"]]], [".min-\\[701px\\]\\:font-semibold", ["(min-width: 701px)"], 4, [["--tw-font-weight", "var(--font-weight-semibold)"], ["font-weight", "var(--font-weight-semibold)"]]], [".min-\\[701px\\]\\:tracking-\\[0\\.045em\\]", ["(min-width: 701px)"], 4, [["--tw-tracking", ".045em"], ["letter-spacing", ".045em"]]], [".min-\\[701px\\]\\:text-subtext-0", ["(min-width: 701px)"], 4, [["color", "var(--subtext-0)"]]], [".min-\\[701px\\]\\:uppercase", ["(min-width: 701px)"], 4, [["text-transform", "uppercase"]]], [".min-\\[900px\\]\\:inline", ["(min-width: 900px)"], 4, [["display", "inline"]]], [".pointer-coarse\\:opacity-100", ["(pointer: coarse)"], 4, [["opacity", "1"]]], [".\\[\\&_\\.mode-switch\\]\\:ml-0 .mode-switch", null, 4, [["margin-left", "0"]]], [".max-\\[700px\\]\\:\\[\\&_button\\]\\:min-h-11 button", ["not all and (min-width: 700px)"], 4, [["min-height", "calc(var(--spacing) * 11)"]]], [".\\[\\&_pre\\]\\:m-\\[0\\.2rem_0_0\\.3rem_1\\.2rem\\] pre", null, 4, [["margin", ".2rem 0 .3rem 1.2rem"]]], [".\\[\\&_pre\\]\\:max-h-72 pre", null, 4, [["max-height", "calc(var(--spacing) * 72)"]]], [".\\[\\&_pre\\]\\:overflow-auto pre", null, 4, [["overflow", "auto"]]], [".\\[\\&_pre\\]\\:rounded-ui pre", null, 4, [["border-radius", "var(--radius)"]]], [".\\[\\&_pre\\]\\:bg-surface-0 pre", null, 4, [["background-color", "var(--surface-0)"]]], [".\\[\\&_pre\\]\\:p-2 pre", null, 4, [["padding", "calc(var(--spacing) * 2)"]]], [".\\[\\&_pre\\]\\:text-\\[0\\.78rem\\] pre", null, 4, [["font-size", ".78rem"]]], [".\\[\\&_pre\\]\\:\\[overflow-wrap\\:anywhere\\] pre", null, 4, [["overflow-wrap", "anywhere"]]], [".\\[\\&_pre\\]\\:whitespace-pre-wrap pre", null, 4, [["white-space", "pre-wrap"]]], [".\\[\\&_pre\\]\\:text-fg pre, .\\[\\&_strong\\]\\:text-fg strong", null, 4, [["color", "var(--text)"]]], [".\\[\\&_summary\\]\\:cursor-pointer summary", null, 4, [["cursor", "pointer"]]], [".\\[\\&\\:hover\\:not\\(\\:disabled\\)\\]\\:bg-surface-1:hover:not(:disabled)", null, 4, [["background-color", "var(--surface-1)"]]], [".\\[\\&\\:hover\\:not\\(\\:disabled\\)\\]\\:text-accent:hover:not(:disabled)", null, 4, [["color", "var(--accent)"]]], [".\\[\\&\\:hover\\:not\\(\\:disabled\\)\\]\\:text-red:hover:not(:disabled)", null, 4, [["color", "var(--red)"]]], [".\\[\\&\\:not\\(\\:has\\(\\[data-setting-row\\]\\)\\)\\>\\[data-none\\]\\]\\:block:not(:has([data-setting-row])) > [data-none]", null, 4, [["display", "block"]]], [".\\[\\&\\>\\*\\]\\:min-h-0 > *", null, 4, [["min-height", "0"]]], [".\\[\\&\\>\\*\\]\\:min-w-0 > *", null, 4, [["min-width", "0"]]], [".\\[\\&\\>\\*\\]\\:flex-1 > *", null, 4, [["flex", "1"]]], [".\\[\\&\\>\\*\\]\\:shrink-0 > *", null, 4, [["flex-shrink", "0"]]], [".\\[\\&\\>li\\]\\:text-\\[0\\.85rem\\] > li", null, 4, [["font-size", ".85rem"]]], [".\\[\\&\\>li\\]\\:leading-\\[1\\.5\\] > li", null, 4, [["--tw-leading", "1.5"], ["line-height", "1.5"]]], [".\\[\\&\\>li\\]\\:text-fg > li", null, 4, [["color", "var(--text)"]]], [".\\[\\&\\>summary\\]\\:flex > summary", null, 4, [["display", "flex"]]], [".\\[\\&\\>summary\\]\\:cursor-pointer > summary", null, 4, [["cursor", "pointer"]]], [".\\[\\&\\>summary\\]\\:list-none > summary", null, 4, [["list-style-type", "none"]]], [".\\[\\&\\>summary\\]\\:items-center > summary", null, 4, [["align-items", "center"]]], [".\\[\\&\\>summary\\]\\:gap-\\[0\\.4rem\\] > summary", null, 4, [["gap", ".4rem"]]], [".\\[\\&\\>summary\\]\\:rounded-ui > summary", null, 4, [["border-radius", "var(--radius)"]]], [".\\[\\&\\>summary\\]\\:px-\\[0\\.4rem\\] > summary", null, 4, [["padding-inline", ".4rem"]]], [".\\[\\&\\>summary\\]\\:py-\\[0\\.25rem\\] > summary", null, 4, [["padding-block", ".25rem"]]], [".\\[\\&\\>summary\\]\\:select-none > summary", null, 4, [["-webkit-user-select", "none"], ["user-select", "none"]]], [".\\[\\&\\>summary\\]\\:before\\:inline-block > summary:before", null, 4, [["content", "var(--tw-content)"], ["display", "inline-block"]]], [".\\[\\&\\>summary\\]\\:before\\:size-\\[0\\.4rem\\] > summary:before", null, 4, [["content", "var(--tw-content)"], ["width", ".4rem"], ["height", ".4rem"]]], [".\\[\\&\\>summary\\]\\:before\\:shrink-0 > summary:before", null, 4, [["content", "var(--tw-content)"], ["flex-shrink", "0"]]], [".\\[\\&\\>summary\\]\\:before\\:\\[transform\\:rotate\\(-45deg\\)\\] > summary:before", null, 4, [["content", "var(--tw-content)"], ["transform", "rotate(-45deg)"]]], [".\\[\\&\\>summary\\]\\:before\\:content-\\[\\'\\'\\] > summary:before", null, 4, [["--tw-content", '""'], ["content", "var(--tw-content)"]]], [".\\[\\&\\>summary\\]\\:before\\:\\[border-bottom\\:1\\.3px_solid_currentColor\\] > summary:before", null, 4, [["content", "var(--tw-content)"], ["border-bottom", "1.3px solid"]]], [".\\[\\&\\>summary\\]\\:before\\:\\[border-right\\:1\\.3px_solid_currentColor\\] > summary:before", null, 4, [["content", "var(--tw-content)"], ["border-right", "1.3px solid"]]], [".\\[\\&\\>summary\\]\\:before\\:\\[transition\\:transform_0\\.15s_ease\\] > summary:before", null, 4, [["content", "var(--tw-content)"], ["transition", "transform .15s"]]], [".\\[\\&\\>summary\\:hover\\]\\:bg-surface-1 > summary:hover", null, 4, [["background-color", "var(--surface-1)"]]], [".\\[\\&\\>summary\\:hover\\]\\:text-fg > summary:hover", null, 4, [["color", "var(--text)"]]], [".\\[\\&\\[open\\]\\>summary\\]\\:before\\:\\[transform\\:rotate\\(45deg\\)\\][open] > summary:before", null, 4, [["content", "var(--tw-content)"], ["transform", "rotate(45deg)"]]], [".app--mobile .\\[\\.app--mobile_\\&\\]\\:min-h-11", null, 4, [["min-height", "calc(var(--spacing) * 11)"]]], [".app--mobile .\\[\\.app--mobile_\\&\\]\\:min-h-\\[44px\\]", null, 4, [["min-height", "44px"]]], [".\\[\\@media\\(hover\\:none\\)\\]\\:opacity-60", ["(hover: none)"], 4, [["opacity", ".6"]]], [".\\[\\@media\\(hover\\:none\\)\\]\\:opacity-100", ["(hover: none)"], 4, [["opacity", "1"]]], [".\\[\\@media\\(max-width\\:700px\\)\\]\\:h-\\[2\\.75rem\\]", ["(max-width: 700px)"], 4, [["height", "2.75rem"]]], [".\\[\\@media\\(max-width\\:700px\\)\\]\\:min-h-\\[2\\.75rem\\]", ["(max-width: 700px)"], 4, [["min-height", "2.75rem"]]], [".\\[\\@media\\(max-width\\:700px\\)\\]\\:w-\\[2\\.75rem\\]", ["(max-width: 700px)"], 4, [["width", "2.75rem"]]], [".\\[\\@media\\(max-width\\:700px\\)\\]\\:min-w-\\[2\\.75rem\\]", ["(max-width: 700px)"], 4, [["min-width", "2.75rem"]]], [".\\[\\@media\\(max-width\\:700px\\)\\]\\:px-\\[0\\.65rem\\]", ["(max-width: 700px)"], 4, [["padding-inline", ".65rem"]]], ["div:hover > .\\[div\\:hover\\>\\&\\]\\:opacity-100", null, 4, [["opacity", "1"]]], [":root", null, 1e3, [["color-scheme", "dark"], ["--scrollbar-size", "6px"], ["--accent", "#c8c8c8"], ["--panel-bg", "#161616"], ["--surface-0", "#262626"], ["--surface-1", "#333"], ["--surface-dim", "#1c1c1c"], ["--backdrop", "#050505"], ["--overlay-0", "#3a3a3a"], ["--overlay-1", "#9b9b9b"], ["--text", "#d8d8d8"], ["--subtext-0", "#9b9b9b"], ["--mauve", "#a993c9"], ["--green", "#7fb685"], ["--yellow", "#d3b46a"], ["--red", "#df8c8c"], ["--blue", "#7aa2d7"], ["--teal", "#7fb8b8"], ["--peach", "#d39a6a"], ["--bg", "var(--panel-bg)"], ["--surface", "var(--surface-0)"], ["--surface-alt", "var(--surface-1)"], ["--border", "var(--overlay-0)"], ["--muted", "var(--subtext-0)"], ["--danger", "var(--red)"], ["--radius", "8px"], ["--radius-pane", "8px"], ["accent-color", "var(--accent)"], ["--font-ui", '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif'], ["--font-mono", `ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono",
    monospace`], ["font-family", "var(--font-ui)"]]], ["code, pre, kbd, samp", null, 1e3, [["font-family", "var(--font-mono)"]]], ["*", null, 1e3, [["box-sizing", "border-box"]]], ["html, body, #root", null, 1e3, [["height", "100%"], ["margin", "0"]]], ["html", null, 1e3, [["overscroll-behavior", "none"], ["--shell-bg", "var(--panel-bg)"]]], ["html[data-glass]", null, 1e3, [["--shell-bg", "var(--panel-bg)"]]], ["html[data-glass]", null, 1e3, [["--shell-bg", "color-mix(in srgb, var(--panel-bg) 86%, transparent)"]]], ["html", null, 1e3, [["--backdrop-bg", "var(--backdrop)"], ["--card-bg", "var(--panel-bg)"]]], ["html[data-glass]", null, 1e3, [["--backdrop-bg", "var(--backdrop)"]]], ["html[data-glass]", null, 1e3, [["--backdrop-bg", "color-mix(in srgb, var(--backdrop) 86%, transparent)"]]], ["html[data-glass]", null, 1e3, [["--card-bg", "var(--panel-bg)"]]], ["html[data-glass]", null, 1e3, [["--card-bg", "color-mix(in srgb, var(--panel-bg) 86%, transparent)"]]], ['body:has(.app--cards, .app--mobile), .app--cards .dock-area:has([data-testid="split-canvas"]:not([data-split="0"]))', null, 1e3, [["background", "var(--backdrop-bg)"]]], ["body", null, 1e3, [["background", "var(--shell-bg)"], ["color", "var(--text)"], ["overscroll-behavior", "none"], ["-webkit-tap-highlight-color", "transparent"], ["line-height", "1.3"]]], [".app", null, 1e3, [["flex-direction", "column"], ["height", "100dvh"], ["display", "flex"]]], [".app--mobile", null, 1e3, [["inset", "var(--visible-top, 0px) 0 auto 0"], ["height", "var(--visible-height, 100dvh)"], ["position", "fixed"]]], [".mobile-drawer-backdrop", null, 1e3, [["animation", ".15s ease-out mobile-fade"]]], [".mobile-drawer--left", null, 1e3, [["animation", ".2s cubic-bezier(.2, .8, .2, 1) mobile-slide-left"]]], [".mobile-drawer--right", null, 1e3, [["animation", ".2s cubic-bezier(.2, .8, .2, 1) mobile-slide-right"]]], [".mobile-sheet", null, 1e3, [["animation", ".22s cubic-bezier(.2, .8, .2, 1) mobile-rise"]]], [".mobile-drawer-backdrop, .mobile-drawer, .mobile-sheet", ["(prefers-reduced-motion: reduce)"], 1e3, [["animation", "none"]]], [".layout-drawer", null, 1e3, [["transform", "translateX(var(--float-hide, 0))"], ["transition", "transform .18s"]]], [".layout-drawer:hover, .layout-drawer:focus-within", null, 1e3, [["--float-hide", "0px"]]], [".dockview-theme-perch", null, 1e3, [["--dv-color-abyss-dark", "var(--panel-bg)"], ["--dv-color-abyss", "var(--surface-0)"], ["--dv-color-abyss-light", "var(--surface-1)"], ["--dv-color-abyss-lighter", "var(--overlay-0)"], ["--dv-color-abyss-accent", "var(--accent)"], ["--dv-color-abyss-primary-text", "var(--text)"], ["--dv-color-abyss-secondary-text", "var(--subtext-0)"], ["--dv-group-view-background-color", "var(--panel-bg)"], ["--dv-tabs-and-actions-container-background-color", "var(--surface-0)"], ["--dv-activegroup-visiblepanel-tab-background-color", "var(--panel-bg)"], ["--dv-activegroup-hiddenpanel-tab-background-color", "var(--surface-0)"], ["--dv-inactivegroup-visiblepanel-tab-background-color", "var(--panel-bg)"], ["--dv-inactivegroup-hiddenpanel-tab-background-color", "var(--surface-0)"], ["--dv-tab-divider-color", "var(--overlay-0)"], ["--dv-activegroup-visiblepanel-tab-color", "var(--text)"], ["--dv-activegroup-hiddenpanel-tab-color", "var(--subtext-0)"], ["--dv-inactivegroup-visiblepanel-tab-color", "var(--subtext-0)"], ["--dv-inactivegroup-hiddenpanel-tab-color", "var(--subtext-0)"], ["--dv-separator-border", "var(--overlay-0)"], ["--dv-paneview-header-border-color", "var(--overlay-0)"], ["--dv-tabs-and-actions-container-font-size", ".82rem"], ["--dv-tabs-and-actions-container-height", "2.1rem"]]], [".dockview-theme-perch .dv-tabs-and-actions-container", null, 1e3, [["z-index", "1"], ["position", "relative"]]], [".pane-tab", null, 1e3, [["align-items", "center"], ["width", "100%"], ["height", "100%"], ["display", "flex"]]], [".pane-tab__agent-badge", null, 1e3, [["color", "var(--subtext-0)"], ["white-space", "nowrap"], ["flex-shrink", "0"], ["margin-right", ".4rem"], ["font-size", ".78em"]]], ['.pane-tab[data-testid="pane-tab-chat"] .dv-default-tab-action', null, 1e3, [["display", "none"]]], [".dockview-group-action", null, 1e3, [["border-radius", "var(--radius)"], ["width", "1.5rem"], ["height", "1.5rem"], ["color", "var(--subtext-0)"], ["cursor", "pointer"], ["background", "none"], ["border", "none"], ["justify-content", "center"], ["align-self", "center"], ["align-items", "center"], ["margin", "0 .15rem"], ["font-size", "1rem"], ["line-height", "1"], ["transition", "color .1s, background .1s"], ["display", "flex"]]], [".dockview-group-action:hover", null, 1e3, [["color", "var(--text)"], ["background", "var(--surface-1)"]]], [".dockview-theme-perch .dv-view-container > .dv-view:has(.dv-inactive-group)", ["(max-width: 700px)"], 1e3, [["display", "none"]]], [".dockview-theme-perch .dv-view-container > .dv-view:has(.dv-active-group)", ["(max-width: 700px)"], 1e3, [["width", "100%", 1], ["left", "0", 1]]], [".chat", null, 1e3, [["isolation", "isolate"], ["flex-direction", "column"], ["flex", "1"], ["height", "100%"], ["min-height", "0"], ["display", "flex"]]], [".message__markdown p", null, 1e3, [["margin", "0 0 .5em"]]], [".message__markdown p:last-child", null, 1e3, [["margin-bottom", "0"]]], [".message__markdown h1, .message__markdown h2, .message__markdown h3, .message__markdown h4", null, 1e3, [["margin", ".6em 0 .3em"], ["line-height", "1.25"]]], [".message__markdown h1", null, 1e3, [["font-size", "1.25em"]]], [".message__markdown h2", null, 1e3, [["font-size", "1.12em"]]], [".message__markdown h3", null, 1e3, [["font-size", "1em"]]], [".message__markdown > * + *", null, 1e3, [["margin-top", ".5em"]]], [".message__markdown table, .md-table", null, 1e3, [["border-collapse", "separate"], ["border-spacing", "0"], ["background", "var(--surface-0)"], ["border-radius", "var(--radius)"], ["max-width", "100%"], ["margin", ".5em 0"], ["font-size", ".92em"], ["display", "block"], ["overflow-x", "auto"]]], [".md-table", null, 1e3, [["width", "100%"], ["margin", "0"], ["display", "table"]]], [".message__markdown th, .message__markdown td, .md-table th, .md-table td", null, 1e3, [["text-align", "left"], ["vertical-align", "top"], ["border-bottom", "1px solid var(--surface-1)"], ["padding", ".35em .75em"]]], [".message__markdown th, .md-table th", null, 1e3, [["color", "var(--subtext-0)"], ["white-space", "nowrap"], ["background", "var(--surface-1)"], ["font-weight", "600"]]], [".message__markdown tbody tr:last-child td, .md-table tbody tr:last-child td", null, 1e3, [["border-bottom", "0"]]], [".message__markdown tbody tr:hover td, .md-table tbody tr:hover td", null, 1e3, [["background", "var(--surface-1)"]]], [".md-table caption", null, 1e3, [["text-align", "left"], ["color", "var(--subtext-0)"], ["padding", ".4em .75em"]]], [".md-code", null, 1e3, [["background", "var(--surface-0)"], ["border-radius", "var(--radius)"], ["overflow", "hidden"]]], [".md-code__bar", null, 1e3, [["color", "var(--subtext-0)"], ["background", "var(--surface-1)"], ["justify-content", "space-between"], ["align-items", "center"], ["padding", ".1rem .4rem .1rem .75rem"], ["font-size", ".75em"], ["display", "flex"]]], [".message__markdown .md-code pre", null, 1e3, [["background", "none"], ["border-radius", "0"], ["margin", "0"]]], [".hl-keyword", null, 1e3, [["color", "var(--mauve)"]]], [".hl-string", null, 1e3, [["color", "var(--green)"]]], [".hl-number", null, 1e3, [["color", "var(--peach)"]]], [".hl-function", null, 1e3, [["color", "var(--blue)"]]], [".hl-type", null, 1e3, [["color", "var(--yellow)"]]], [".hl-tag", null, 1e3, [["color", "var(--teal)"]]], [".hl-comment", null, 1e3, [["color", "var(--overlay-1)"], ["font-style", "italic"]]], [".message__markdown ul, .message__markdown ol", null, 1e3, [["margin", ".3em 0 .5em 1.3em"], ["padding", "0"]]], [".message__markdown li", null, 1e3, [["margin-bottom", ".2em"]]], [".message__markdown code", null, 1e3, [["background", "var(--surface-0)"], ["border-radius", ".25rem"], ["padding", ".1em .35em"], ["font-family", "ui-monospace, SFMono-Regular, SF Mono, Menlo, Consolas, monospace"], ["font-size", ".88em"]]], [".message__markdown pre", null, 1e3, [["background", "var(--surface-0)"], ["border-radius", "var(--radius)"], ["margin", ".4em 0"], ["padding", ".6rem .75rem"], ["position", "relative"], ["overflow-x", "auto"]]], [".message__markdown pre code", null, 1e3, [["background", "none"], ["border", "none"], ["padding", "0"], ["font-size", ".85em"]]], [".message__markdown a", null, 1e3, [["color", "var(--accent)"], ["text-decoration", "underline"]]], [".message__markdown blockquote", null, 1e3, [["border-left", "3px solid var(--overlay-0)"], ["color", "var(--subtext-0)"], ["margin", ".4em 0"], ["padding", ".1em .6em"]]], [".message__markdown hr", null, 1e3, [["border", "none"], ["border-top", "1px solid var(--overlay-0)"], ["margin", ".75em 0"]]], [".file-markdown", null, 1e3, [["overflow-wrap", "anywhere"]]], [".file-markdown img", null, 1e3, [["max-width", "100%"]]], [".file-markdown table", null, 1e3, [["border-collapse", "collapse"], ["margin", ".4em 0"], ["display", "block"], ["overflow-x", "auto"]]], [".file-markdown th, .file-markdown td", null, 1e3, [["border", "1px solid var(--overlay-0)"], ["padding", ".2em .5em"]]], [".file-markdown .md-placeholder", null, 1e3, [["color", "var(--subtext-0)"], ["border", "1px dashed var(--overlay-0)"], ["border-radius", ".25rem"], ["padding", ".05em .35em"], ["font-size", ".9em"]]], [".terminal", null, 1e3, [["min-width", "0"], ["min-height", "0"], ["padding", "var(--terminal-padding, 0)"], ["opacity", "var(--terminal-opacity, 1)"], ["flex", "1"], ["display", "flex"], ["position", "relative"]]], [".terminal__surface", null, 1e3, [["flex", "1"], ["min-width", "0"], ["min-height", "0"], ["overflow", "hidden"]]], [".terminal__surface .xterm", null, 1e3, [["height", "100%"]]], [".terminal__surface .xterm:not(.allow-transparency) .xterm-viewport", null, 1e3, [["background-color", "#0000"]]], [".terminal__surface .xterm-scrollable-element", null, 1e3, [["position", "static", 1]]], [".terminal__surface .xterm-decoration-overview-ruler, .no-pane-scrollbars .terminal__surface .xterm-scrollable-element > .xterm-scrollbar", null, 1e3, [["display", "none"]]], [".terminal--persistent", null, 1e3, [["flex-direction", "column"]]], [".terminal__toolbar", null, 1e3, [["color", "var(--subtext-0)"], ["align-items", "center"], ["gap", ".5rem"], ["padding", ".25rem 1.5rem .25rem .5rem"], ["font-size", ".8rem"], ["display", "flex"]]], [".terminal__toolbar button", null, 1e3, [["border-radius", "var(--radius)"], ["min-height", "32px"], ["color", "var(--text)"], ["background", "var(--surface-0)"], ["border", "0"], ["padding", ".25rem .5rem"]]], [".terminal__toolbar--overlay", null, 1e3, [["z-index", "2"], ["border-radius", "var(--radius)"], ["background", "var(--surface-1)"], ["padding", ".2rem .3rem .2rem .6rem"], ["position", "absolute"], ["top", ".4rem"], ["right", ".9rem"], ["box-shadow", "0 2px 8px #00000040"]]], [".terminal__connection", null, 1e3, [["margin-right", "auto"]]], [".terminal__toolbar button:disabled", null, 1e3, [["opacity", ".5"]]], [".terminal__notice", null, 1e3, [["color", "var(--subtext-0)"], ["padding", ".75rem"], ["font-size", ".85rem"]]], [".app--mobile .terminal__toolbar button", null, 1e3, [["min-height", "44px"]]], [".app--mobile .terminal__connection", null, 1e3, [["display", "none"]]], [".app--mobile .terminal__toolbar", null, 1e3, [["padding-right", ".5rem"]]], [".terminal__exited", null, 1e3, [["background", "var(--surface-1)"], ["border-radius", "var(--radius)"], ["color", "var(--subtext-0)"], ["padding", ".35rem .75rem"], ["font-size", ".85rem"], ["position", "absolute"], ["bottom", ".75rem"], ["left", "50%"], ["transform", "translateX(-50%)"]]], [".terminal__exited--cli", null, 1e3, [["background", "var(--panel-bg)"], ["flex-direction", "column"], ["align-items", "center"], ["gap", ".6rem"], ["padding", ".9rem 1.1rem"], ["display", "flex"], ["top", "50%"], ["bottom", "auto"], ["transform", "translate(-50%, -50%)"], ["box-shadow", "0 6px 24px #00000059"]]], [".terminal__exited-actions", null, 1e3, [["gap", ".5rem"], ["display", "flex"]]], [".terminal__cli-error", null, 1e3, [["background", "var(--red)"], ["position", "absolute"], ["bottom", ".75rem"], ["left", "50%"], ["transform", "translateX(-50%)"]]], [".terminal__cli-error", null, 1e3, [["background", "color-mix(in srgb, var(--red) 20%, var(--panel-bg))"]]], [".terminal__cli-error", null, 1e3, [["border-radius", "var(--radius)"], ["color", "var(--red)"], ["text-align", "center"], ["white-space", "pre-wrap"], ["word-break", "break-word"], ["max-width", "90%"], ["padding", ".35rem .75rem"], ["font-size", ".85rem"]]], [".mobile-pane-shell__content > .chat, .mobile-pane-shell__content > .terminal, .mobile-pane-shell__content > .workspace-files, .mobile-pane-shell__content > .workspace-git", null, 1e3, [["flex", "1"], ["width", "100%"], ["min-width", "0"], ["height", "100%"], ["min-height", "0"]]], [".terminal__host", null, 1e3, [["width", "100%"], ["height", "100%"], ["overflow", "hidden"]]], [".workspace-git", null, 1e3, [["--git-border", "var(--overlay-0)"]]], [".workspace-git", null, 1e3, [["--git-border", "color-mix(in srgb, var(--overlay-0) 72%, transparent)"]]], [".workspace-git", null, 1e3, [["--git-muted", "var(--subtext-0)"], ["width", "100%"], ["min-width", "0"], ["height", "100%"], ["min-height", "0"], ["color", "var(--text)"], ["background", "var(--workspace-tools-bg, var(--panel-bg))"], ["flex-direction", "column"], ["font-size", ".78rem"], ["display", "flex"], ["position", "relative"], ["overflow", "hidden"], ["container-type", "inline-size"]]], [".workspace-git button, .workspace-git input, .workspace-git textarea", null, 1e3, [["font", "inherit"]]], [".workspace-git button", null, 1e3, [["cursor", "pointer"]]], ['.workspace-git button:focus-visible, .workspace-git input:focus-visible, .workspace-git textarea:focus-visible, .workspace-git [role="button"]:focus-visible', null, 1e3, [["outline", "2px solid var(--accent)"], ["outline-offset", "1px"]]], [".workspace-git__diff", null, 1e3, [["container-type", "inline-size"]]], [".workspace-git__line-comment-thread", null, 1e3, [["max-width", "max(0px, min(42rem, 100cqi - 6.9rem))"], ["position", "sticky"], ["left", "0"]]], [".workspace-git__comment-composer", null, 1e3, [["max-width", "max(0px, 100cqi - 1.4rem)"], ["position", "sticky"], ["left", "0"]]], [".dockview-group-action--split-session", null, 1e3, [["font-size", "13px"]]], [".session-split-popover", null, 1e3, [["display", "flex"], ["flex-direction", "column"], ["background", "var(--surface-1)"], ["border-radius", "var(--radius)"], ["box-shadow", "0 8px 24px rgba(0, 0, 0, 0.45)"], ["padding", "4px"], ["font-size", "12.5px"], ["color", "var(--text)"], ["overflow", "hidden"]]], [".session-split-popover__header", null, 1e3, [["padding", "6px 8px 4px"], ["font-size", "11px"], ["text-transform", "uppercase"], ["letter-spacing", "0.04em"], ["color", "var(--subtext-0)"]]], [".session-split-popover__empty", null, 1e3, [["padding", "8px"], ["color", "var(--subtext-0)"]]], [".session-split-popover__list", null, 1e3, [["overflow-y", "auto"]]], [".session-split-popover__item", null, 1e3, [["display", "flex"], ["flex-direction", "column"], ["align-items", "flex-start"], ["gap", "1px"], ["width", "100%"], ["padding", "6px 8px"], ["border", "none"], ["border-radius", "4px"], ["background", "transparent"], ["color", "inherit"], ["text-align", "left"], ["cursor", "grab"]]], [".session-split-popover__item:hover", null, 1e3, [["background", "var(--surface-0)"]]], [".session-split-popover__item-title", null, 1e3, [["font-weight", "500"], ["white-space", "nowrap"], ["overflow", "hidden"], ["text-overflow", "ellipsis"], ["max-width", "100%"]]], [".session-split-popover__item-cwd", null, 1e3, [["font-size", "11px"], ["color", "var(--subtext-0)"], ["white-space", "nowrap"], ["overflow", "hidden"], ["text-overflow", "ellipsis"], ["max-width", "100%"]]], [".session-split-popover__item-badge", null, 1e3, [["align-self", "flex-end"], ["font-size", "10px"], ["color", "var(--accent)"], ["margin-top", "-14px"]]], [".inactive-session-pane", null, 1e3, [["display", "flex"], ["flex-direction", "column"], ["align-items", "center"], ["justify-content", "center"], ["gap", "10px"], ["height", "100%"], ["padding", "24px"], ["text-align", "center"], ["color", "var(--subtext-0)"]]], [".inactive-session-pane__title", null, 1e3, [["font-size", "14px"], ["font-weight", "500"], ["color", "var(--text)"]]], [".inactive-session-pane__cwd", null, 1e3, [["font-size", "12px"], ["color", "var(--subtext-0)"], ["word-break", "break-all"]]], [".inactive-session-pane__note", null, 1e3, [["font-size", "12px"], ["max-width", "320px"], ["line-height", "1.5"]]], [".inactive-session-pane__switch", null, 1e3, [["margin-top", "4px"], ["padding", "6px 14px"], ["border-radius", "var(--radius)"], ["border", "0"], ["background", "var(--surface-0)"], ["color", "var(--text)"], ["cursor", "pointer"], ["font-size", "12.5px"]]], [".inactive-session-pane__switch:hover", null, 1e3, [["background", "var(--surface-1)"]]]], skipped: { "@supports evaluated false": 2, "@container": 6, "@keyframes": 9 } };
//! The app's compiled stylesheet as a table (`build.mjs` writes it from Vite + Tailwind's output and bundles it as
//! `virtual:perch-css-table`), parsed once on first use.
let gg = null;
const bg = () => gg ??= new D0(hg);
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
let sa = Sl.NoEventPriority;
function vg(a, l) {
  const s = /* @__PURE__ */ new Set([...Object.keys(a), ...Object.keys(l)]);
  for (const o of s) {
    if (o === "children") continue;
    const i = a[o], d = l[o];
    if (!(i === d || typeof i == "function" && typeof d == "function") && !(o === "style" && i && d && typeof i == "object" && typeof d == "object" && [.../* @__PURE__ */ new Set([...Object.keys(i), ...Object.keys(d)])].every((f) => i[f] === d[f])))
      return !0;
  }
  return !1;
}
const yg = (a) => !a.props.disabled && (/^(button|input|select|textarea)$/.test(a.tagName) || a.tagName === "a" && a.props.href != null || a.props.tabIndex != null);
function Zd(a, l) {
  for (const s of $h(l.dangerouslySetInnerHTML?.__html, a.ownerDocument) ?? []) a.appendChild(s);
  return a;
}
const xg = {
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
  scheduleTimeout: (a, l) => setTimeout(a, l),
  cancelTimeout: (a) => clearTimeout(a),
  scheduleMicrotask: (a) => queueMicrotask(a),
  // React works on one root at a time, whichever screen's call it runs in: the host runs it as that root's screen.
  getRootHostContext: (a) => (a.ownerDocument?.perch?.enter?.(), null),
  getChildHostContext: (a) => a,
  getPublicInstance: (a) => a,
  prepareForCommit: (a) => (a.ownerDocument?.perch?.enter?.(), null),
  resetAfterCommit: (a) => a.ownerDocument?.afterCommit?.(),
  preparePortalMount: () => {
  },
  createInstance: (a, l, s) => Zd(new It(a, l, s.ownerDocument), l),
  createTextInstance: (a, l) => new Jr(a),
  appendInitialChild: (a, l) => {
    a.appendChild(l);
  },
  // `autoFocus` focuses the element once it is in the tree, as React DOM does.
  finalizeInitialChildren: (a, l, s) => !!s.autoFocus,
  shouldSetTextContent: () => !1,
  appendChild: (a, l) => {
    a.appendChild(l);
  },
  appendChildToContainer: (a, l) => {
    a.appendChild(l);
  },
  insertBefore: (a, l, s) => {
    a.insertBefore(l, s);
  },
  insertInContainerBefore: (a, l, s) => {
    a.insertBefore(l, s);
  },
  removeChild: (a, l) => {
    a.removeChild(l);
  },
  removeChildFromContainer: (a, l) => {
    a.removeChild(l);
  },
  clearContainer: (a) => {
    for (const l of [...a.childNodes]) a.removeChild(l);
  },
  commitUpdate: (a, l, s, o) => {
    if (a.props = o, a.inline) for (const i of Object.keys(a.inline)) s.style?.[i] !== o.style?.[i] && delete a.inline[i];
    if (s.dangerouslySetInnerHTML?.__html !== o.dangerouslySetInnerHTML?.__html) {
      for (const i of [...a.childNodes]) a.removeChild(i);
      Zd(a, o);
    }
    vg(s, o) && a.touch();
  },
  commitTextUpdate: (a, l, s) => {
    a.data = String(s);
  },
  commitMount: (a) => {
    a.focus();
  },
  resetTextContent: () => {
  },
  hideInstance: (a) => {
    a.hidden = !0, a.touch();
  },
  unhideInstance: (a) => {
    a.hidden = !1, a.touch();
  },
  hideTextInstance: (a) => {
    a.hidden = !0;
  },
  unhideTextInstance: (a) => {
    a.hidden = !1;
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
  setCurrentUpdatePriority: (a) => {
    sa = a;
  },
  getCurrentUpdatePriority: () => sa,
  resolveUpdatePriority: () => sa !== Sl.NoEventPriority ? sa : Sl.DefaultEventPriority,
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
  bindToConsole: (a, l) => Function.prototype.bind.call(console[a], console, ...l)
}, ze = w0(xg), Wr = (a, l, s = null) => ze.createPortal(a, l, null, s), wg = {
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
}, _g = /* @__PURE__ */ new Set(["click", "dblclick", "mousedown", "mouseup"]), Sg = /* @__PURE__ */ new Set(["button", "input", "select", "textarea", "fieldset"]), kg = (a) => {
  for (let l = a; l instanceof It; l = l.parentNode) if (l.props.disabled && Sg.has(l.tagName)) return !0;
  return !1;
};
class Eg {
  constructor(l, s, o) {
    Object.assign(this, { clientX: 0, clientY: 0, button: 0, buttons: 0, pointerType: "mouse", key: "", code: "", shiftKey: !1, metaKey: !1, ctrlKey: !1, altKey: !1, repeat: !1, isComposing: !1, keyCode: 0 }, s), this.type = l, this.target = o, this.currentTarget = null, this.defaultPrevented = !1, this.propagationStopped = !1, this.timeStamp = Date.now();
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
function Cr(a, l, s) {
  l.currentTarget = a;
  for (const { type: o, listener: i, capture: d } of [...a.listeners ?? []])
    o === l.type && d === s && i.call(a, l);
  if (a instanceof It) {
    const o = wg[l.type], i = o && a.props[s ? `${o}Capture` : o];
    typeof i == "function" && i(l);
  }
}
function ry(a, l, s = {}) {
  const { document: o, window: i, globals: d } = l0(a), m = new It("div", { id: "root", style: s.container ?? {} }, o);
  o.body.appendChild(m);
  const f = [];
  let b = null;
  const x = () => [o, i].map((O) => O.listeners.map((h) => `${h.type}:${h.capture}`).sort().join(",")).join("|");
  let E = "";
  const k = {}, w = `m${Math.random().toString(36).slice(2, 10)}:`;
  let N = 0, _ = -1;
  o.measureKey = (O) => w + O.id, o.stale = () => _ !== N, o.computed = (O) => {
    if (!k.cascade || !k.top) return null;
    const h = [];
    for (let v = O; v instanceof It && v !== o.body; v = v.parentNode) h.unshift(v);
    let p = k.top;
    for (const v of h) p = k.cascade.compute(v, p);
    return p.values;
  };
  const y = () => (N += 1, b = pg(o, a, bg(), k, s.names), E = x(), a.render?.(b), b), z = () => {
    ze.flushPassiveEffects(), ze.flushSyncWork(), x() !== E && y();
  };
  o.afterCommit = y;
  const R = (O) => {
    f.push(O), a.error?.(O);
  }, D = ze.createContainer(m, Sl.ConcurrentRoot, null, !1, null, "", R, R, R, null);
  ze.updateContainerSync(dt.createElement(l, s.props ?? {}), D, null, null), ze.flushSyncWork(), z();
  const A = (O) => {
    const h = (p) => {
      if (p.id === O) return p;
      for (const v of p.children) {
        const S = h(v);
        if (S) return S;
      }
      return null;
    };
    return h(o.documentElement);
  }, X = (O) => {
    const h = sa;
    sa = Sl.DiscreteEventPriority;
    try {
      return O();
    } finally {
      sa = h, ze.flushSyncWork(), z();
    }
  }, q = {
    document: o,
    window: i,
    /** What `window`, `document` and `localStorage` read while this screen runs (`dom.mjs`'s `GLOBALS`). */
    globals: d,
    container: m,
    errors: f,
    /** The latest description (after the last commit or state change). */
    get description() {
      return b;
    },
    describe: y,
    /** Runs a DOM event of `type` at node `id`; false when the node is gone. */
    dispatch(O, h, p = {}) {
      const v = typeof O == "string" ? A(O) : O;
      if (!v || _g.has(h) && kg(v)) return !1;
      const S = new Eg(h, p, v), M = [];
      for (let $ = v; $; $ = $.parentNode) M.push($);
      const H = [...M, o, i];
      X(() => {
        for (let $ = H.length - 1; $ > 0 && !S.propagationStopped; $--) Cr(H[$], S, !0);
        S.propagationStopped || (Cr(v, S, !0), S.propagationStopped || Cr(v, S, !1));
        for (let $ = 1; $ < H.length && !S.propagationStopped; $++) Cr(H[$], S, !1);
      });
      const J = h === "click" && !S.defaultPrevented ? ts(v) : null;
      if (J && q.dispatch(J, "submit", {}), h === "click" && !S.defaultPrevented)
        for (let $ = v; $; $ = $.parentNode) {
          if ($.tagName !== "a") continue;
          const tt = $.props?.href;
          typeof tt == "string" && /^https:\/\/\S+$/.test(tt) && a.openLink?.(tt);
          break;
        }
      return !S.defaultPrevented;
    },
    /** Whether the source listens for `type` on `window` or `document` (a page recording a key press does). */
    listensFor: (O) => [o, i].some((h) => h.listeners.some((p) => p.type === O)),
    /** A key pressed while the screen has the keyboard (`init`: the DOM's `key`, modifiers, `repeat`), at the
     * focused element. When nothing prevented it and that element is a text field, the key edits the field as a
     * browser would: a character is typed at the end (or replaces the text when all of it is selected), Backspace
     * deletes the last one, and the field gets `input` and `change` events with its new `value`. Returns whether the
     * source took the key (prevented it, or a field changed). */
    key(O) {
      const h = o.activeElement && o.activeElement !== o.body ? o.activeElement : o.body;
      if (!q.dispatch(h, "keydown", O)) return !0;
      const v = O.key === "Enter" && !O.isComposing ? ts(h, !0) : null;
      if (v)
        return q.dispatch(v, "submit", {}), !0;
      if (!_f(h) || h.props.disabled || h.props.readOnly) return !1;
      if ((O.ctrlKey || O.metaKey) && !O.altKey && !O.shiftKey && O.key.toLowerCase() === "a")
        return h.selectedAll = !0, !0;
      if (O.ctrlKey || O.metaKey) return !1;
      const S = h.selectedAll;
      h.selectedAll = !1;
      const M = h.value, J = O.key === "Backspace" || S && O.key === "Delete" ? S ? "" : M.slice(0, -1) : [...O.key].length === 1 ? (S ? "" : M) + O.key : M;
      return J === M ? !1 : (h.value = J, q.dispatch(h, "input", { data: O.key }), q.dispatch(h, "change", {}), h.props.value !== void 0 && delete h.edit, h.touch(), y(), !0);
    },
    /** The engine's box for node `id` (window coordinates, logical px), for `getBoundingClientRect`. */
    setBounds(O, h) {
      const p = A(O);
      p && (p.bounds = { x: h.x, y: h.y, width: h.width, height: h.height });
    },
    /** A click on a check box or radio button (`id`): the `click` event, then, unless the source prevented it, the
     * box ticked as a browser ticks it (a radio button only on), with `input` and `change` events. */
    toggle(O) {
      const h = A(O);
      if (!h || h.props.disabled || !q.dispatch(O, "click", { button: 0, detail: 1 })) return;
      const p = h.props.type === "radio";
      p && h.checked || (h.checked = p ? !0 : !h.checked, q.dispatch(O, "input", {}), q.dispatch(O, "change", {}), h.props.checked !== void 0 && delete h.ticked, h.touch(), y());
    },
    /** A left click as the engine reports one: press then release on the same node. */
    click(O, h = {}) {
      const p = { button: 0, buttons: 1, pointerType: "mouse", ...h };
      for (const v of ["pointerdown", "mousedown", "pointerup", "mouseup", "click"]) q.dispatch(O, v, p);
    },
    /** The pointer entered (`on`) or left node `id` (one the description marks `track_hover`): its `:hover` state,
     * which a descendant's group variant reads. The element's own `hover:` styles are the engine's hover style. */
    /** Whether the pointer is over node `id`, as `hover` last said. */
    hovered: (O) => !!A(O)?.state.hover,
    hover(O, h) {
      const p = A(O);
      !p || p.state.hover === h || (p.state.hover = h, p.touch(), y());
    },
    focus(O) {
      const h = A(O);
      h && (X(() => {
        const p = o.activeElement;
        p && p !== h && p !== o.body && q.dispatch(p, "blur"), o.focus(h), q.dispatch(h, "focus");
      }), y());
    },
    /** A press at node `id` that nothing prevented: the browser's default focuses the element pressed. Only an element
     * that listens for keys (`onKeyDown`) is focused, so a press elsewhere leaves the keyboard where it was; the focus
     * is not `:focus-visible`, as after a pointer press in a browser. */
    // ponytail: a browser focuses every focusable element pressed; here only one with its own key handler, so a
    // screen's ordinary buttons do not take the keyboard from a terminal.
    pressFocus(O) {
      let p = typeof O == "string" ? A(O) : O;
      for (; p && !(p instanceof It && typeof p.props.onKeyDown == "function" && yg(p)); ) p = p.parentNode;
      !p || p === o.activeElement || (q.focus(p.id), p.state.pointerFocus = !0, p.touch(), y());
    },
    /** The engine is drawing the latest description: the boxes measured in this frame's layout are the tree's.
     * Returns whether effects wait for that layout (`measured`); run them with `retry` once the frame is drawn. */
    drawing() {
      return _ = N, o.retries.length > 0;
    },
    /** Runs the effects that waited for a fresh layout. */
    retry() {
      const O = o.retries.splice(0);
      for (const h of O) h();
    },
    /** Runs effects React has scheduled (the engine calls it after a frame). */
    flush: z,
    update(O) {
      ze.updateContainerSync(dt.createElement(l, O ?? {}), D, null, null), ze.flushSyncWork(), z();
    },
    unmount() {
      ze.updateContainerSync(null, D, null, null), ze.flushSyncWork(), ze.flushPassiveEffects(), o.afterCommit = null, o.retries.length = 0, a.forgetBounds?.(w);
    }
  };
  return q;
}
//! `react-dom` for a screen on the native renderer: `createPortal` (into `document.body`, the overlay layer) and
//! `flushSync`. Nothing of the browser renderer.
const Hf = (a) => ze.flushSyncFromReconciler(a), zg = { createPortal: Wr, flushSync: Hf }, iy = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  createPortal: Wr,
  default: zg,
  flushSync: Hf
}, Symbol.toStringTag, { value: "Module" }));
function Bf(a) {
  var l, s, o = "";
  if (typeof a == "string" || typeof a == "number") o += a;
  else if (typeof a == "object") if (Array.isArray(a)) {
    var i = a.length;
    for (l = 0; l < i; l++) a[l] && (s = Bf(a[l])) && (o && (o += " "), o += s);
  } else for (s in a) a[s] && (o && (o += " "), o += s);
  return o;
}
function Uf() {
  for (var a, l, s = 0, o = "", i = arguments.length; s < i; s++) (a = arguments[s]) && (l = Bf(a)) && (o && (o += " "), o += l);
  return o;
}
const Ng = (a, l) => {
  const s = new Array(a.length + l.length);
  for (let o = 0; o < a.length; o++)
    s[o] = a[o];
  for (let o = 0; o < l.length; o++)
    s[a.length + o] = l[o];
  return s;
}, Tg = (a, l) => ({
  classGroupId: a,
  validator: l
}), qf = (a = /* @__PURE__ */ new Map(), l = null, s) => ({
  nextPart: a,
  validators: l,
  classGroupId: s
}), Qr = "-", Jd = [], Cg = "arbitrary..", Mg = (a) => {
  const l = jg(a), {
    conflictingClassGroups: s,
    conflictingClassGroupModifiers: o
  } = a;
  return {
    getClassGroupId: (m) => {
      if (m.startsWith("[") && m.endsWith("]"))
        return Ag(m);
      const f = m.split(Qr), b = f[0] === "" && f.length > 1 ? 1 : 0;
      return Yf(f, b, l);
    },
    getConflictingClassGroupIds: (m, f) => {
      if (f) {
        const b = o[m], x = s[m];
        return b ? x ? Ng(x, b) : b : x || Jd;
      }
      return s[m] || Jd;
    }
  };
}, Yf = (a, l, s) => {
  if (a.length - l === 0)
    return s.classGroupId;
  const i = a[l], d = s.nextPart.get(i);
  if (d) {
    const x = Yf(a, l + 1, d);
    if (x) return x;
  }
  const m = s.validators;
  if (m === null)
    return;
  const f = l === 0 ? a.join(Qr) : a.slice(l).join(Qr), b = m.length;
  for (let x = 0; x < b; x++) {
    const E = m[x];
    if (E.validator(f))
      return E.classGroupId;
  }
}, Ag = (a) => a.slice(1, -1).indexOf(":") === -1 ? void 0 : (() => {
  const l = a.slice(1, -1), s = l.indexOf(":"), o = l.slice(0, s);
  return o ? Cg + o : void 0;
})(), jg = (a) => {
  const {
    theme: l,
    classGroups: s
  } = a;
  return Og(s, l);
}, Og = (a, l) => {
  const s = qf();
  for (const o in a) {
    const i = a[o];
    ys(i, s, o, l);
  }
  return s;
}, ys = (a, l, s, o) => {
  const i = a.length;
  for (let d = 0; d < i; d++) {
    const m = a[d];
    Rg(m, l, s, o);
  }
}, Rg = (a, l, s, o) => {
  if (typeof a == "string") {
    Dg(a, l, s);
    return;
  }
  if (typeof a == "function") {
    Hg(a, l, s, o);
    return;
  }
  Bg(a, l, s, o);
}, Dg = (a, l, s) => {
  const o = a === "" ? l : Gf(l, a);
  o.classGroupId = s;
}, Hg = (a, l, s, o) => {
  if (Ug(a)) {
    ys(a(o), l, s, o);
    return;
  }
  l.validators === null && (l.validators = []), l.validators.push(Tg(s, a));
}, Bg = (a, l, s, o) => {
  const i = Object.entries(a), d = i.length;
  for (let m = 0; m < d; m++) {
    const [f, b] = i[m];
    ys(b, Gf(l, f), s, o);
  }
}, Gf = (a, l) => {
  let s = a;
  const o = l.split(Qr), i = o.length;
  for (let d = 0; d < i; d++) {
    const m = o[d];
    let f = s.nextPart.get(m);
    f || (f = qf(), s.nextPart.set(m, f)), s = f;
  }
  return s;
}, Ug = (a) => "isThemeGetter" in a && a.isThemeGetter === !0, qg = (a) => {
  if (a < 1)
    return {
      get: () => {
      },
      set: () => {
      }
    };
  let l = 0, s = /* @__PURE__ */ Object.create(null), o = /* @__PURE__ */ Object.create(null);
  const i = (d, m) => {
    s[d] = m, l++, l > a && (l = 0, o = s, s = /* @__PURE__ */ Object.create(null));
  };
  return {
    get(d) {
      let m = s[d];
      if (m !== void 0)
        return m;
      if ((m = o[d]) !== void 0)
        return i(d, m), m;
    },
    set(d, m) {
      d in s ? s[d] = m : i(d, m);
    }
  };
}, os = "!", Wd = ":", Yg = [], Fd = (a, l, s, o, i) => ({
  modifiers: a,
  hasImportantModifier: l,
  baseClassName: s,
  maybePostfixModifierPosition: o,
  isExternal: i
}), Gg = (a) => {
  const {
    prefix: l,
    experimentalParseClassName: s
  } = a;
  let o = (i) => {
    const d = [];
    let m = 0, f = 0, b = 0, x;
    const E = i.length;
    for (let y = 0; y < E; y++) {
      const z = i[y];
      if (m === 0 && f === 0) {
        if (z === Wd) {
          d.push(i.slice(b, y)), b = y + 1;
          continue;
        }
        if (z === "/") {
          x = y;
          continue;
        }
      }
      z === "[" ? m++ : z === "]" ? m-- : z === "(" ? f++ : z === ")" && f--;
    }
    const k = d.length === 0 ? i : i.slice(b);
    let w = k, N = !1;
    k.endsWith(os) ? (w = k.slice(0, -1), N = !0) : (
      /**
       * In Tailwind CSS v3 the important modifier was at the start of the base class name. This is still supported for legacy reasons.
       * @see https://github.com/dcastil/tailwind-merge/issues/513#issuecomment-2614029864
       */
      k.startsWith(os) && (w = k.slice(1), N = !0)
    );
    const _ = x && x > b ? x - b : void 0;
    return Fd(d, N, w, _);
  };
  if (l) {
    const i = l + Wd, d = o;
    o = (m) => m.startsWith(i) ? d(m.slice(i.length)) : Fd(Yg, !1, m, void 0, !0);
  }
  if (s) {
    const i = o;
    o = (d) => s({
      className: d,
      parseClassName: i
    });
  }
  return o;
}, Kg = (a) => {
  const l = /* @__PURE__ */ new Map();
  return a.orderSensitiveModifiers.forEach((s, o) => {
    l.set(s, 1e6 + o);
  }), (s) => {
    const o = [];
    let i = [];
    for (let d = 0; d < s.length; d++) {
      const m = s[d], f = m[0] === "[", b = l.has(m);
      f || b ? (i.length > 0 && (i.sort(), o.push(...i), i = []), o.push(m)) : i.push(m);
    }
    return i.length > 0 && (i.sort(), o.push(...i)), o;
  };
}, Qg = (a) => ({
  cache: qg(a.cacheSize),
  parseClassName: Gg(a),
  sortModifiers: Kg(a),
  postfixLookupClassGroupIds: Vg(a),
  ...Mg(a)
}), Vg = (a) => {
  const l = /* @__PURE__ */ Object.create(null), s = a.postfixLookupClassGroups;
  if (s)
    for (let o = 0; o < s.length; o++)
      l[s[o]] = !0;
  return l;
}, Xg = /\s+/, Lg = (a, l) => {
  const {
    parseClassName: s,
    getClassGroupId: o,
    getConflictingClassGroupIds: i,
    sortModifiers: d,
    postfixLookupClassGroupIds: m
  } = l, f = [], b = a.trim().split(Xg);
  let x = "";
  for (let E = b.length - 1; E >= 0; E -= 1) {
    const k = b[E], {
      isExternal: w,
      modifiers: N,
      hasImportantModifier: _,
      baseClassName: y,
      maybePostfixModifierPosition: z
    } = s(k);
    if (w) {
      x = k + (x.length > 0 ? " " + x : x);
      continue;
    }
    let R = !!z, D;
    if (R) {
      const h = y.substring(0, z);
      D = o(h);
      const p = D && m[D] ? o(y) : void 0;
      p && p !== D && (D = p, R = !1);
    } else
      D = o(y);
    if (!D) {
      if (!R) {
        x = k + (x.length > 0 ? " " + x : x);
        continue;
      }
      if (D = o(y), !D) {
        x = k + (x.length > 0 ? " " + x : x);
        continue;
      }
      R = !1;
    }
    const A = N.length === 0 ? "" : N.length === 1 ? N[0] : d(N).join(":"), X = _ ? A + os : A, q = X + D;
    if (f.indexOf(q) > -1)
      continue;
    f.push(q);
    const O = i(D, R);
    for (let h = 0; h < O.length; ++h) {
      const p = O[h];
      f.push(X + p);
    }
    x = k + (x.length > 0 ? " " + x : x);
  }
  return x;
}, Zg = (...a) => {
  let l = 0, s, o, i = "";
  for (; l < a.length; )
    (s = a[l++]) && (o = Kf(s)) && (i && (i += " "), i += o);
  return i;
}, Kf = (a) => {
  if (typeof a == "string")
    return a;
  let l, s = "";
  for (let o = 0; o < a.length; o++)
    a[o] && (l = Kf(a[o])) && (s && (s += " "), s += l);
  return s;
}, Jg = (a, ...l) => {
  let s, o, i, d;
  const m = (b) => {
    const x = l.reduce((E, k) => k(E), a());
    return s = Qg(x), o = s.cache.get, i = s.cache.set, d = f, f(b);
  }, f = (b) => {
    const x = o(b);
    if (x)
      return x;
    const E = Lg(b, s);
    return i(b, E), E;
  };
  return d = m, (...b) => d(Zg(...b));
}, Wg = [], Lt = (a) => {
  const l = (s) => s[a] || Wg;
  return l.isThemeGetter = !0, l.themeKey = a, l;
}, Qf = /^\[(?:(\w[\w-]*):)?(.+)\]$/i, Vf = /^\((?:(\w[\w-]*):)?(.+)\)$/i, Fg = /^\d+(?:\.\d+)?\/\d+(?:\.\d+)?$/, Ig = /^(\d+(\.\d+)?)?(xs|sm|md|lg|xl)$/, Pg = /\d+(%|px|r?em|[sdl]?v([hwib]|min|max)|pt|pc|in|cm|mm|cap|ch|ex|r?lh|cq(w|h|i|b|min|max))|\b(calc|min|max|clamp)\(.+\)|^0$/, $g = /^(rgba?|hsla?|hwb|(ok)?(lab|lch)|color-mix|color|light-dark)\(.+\)$/, tb = /^(inset_)?-?((\d+)?\.?(\d+)[a-z]+|0)_-?((\d+)?\.?(\d+)[a-z]+|0)/, eb = /^(url|image|image-set|cross-fade|element|(repeating-)?(linear|radial|conic)-gradient)\(.+\)$/, On = (a) => Fg.test(a), vt = (a) => !!a && !Number.isNaN(Number(a)), Je = (a) => !!a && Number.isInteger(Number(a)), Zo = (a) => a.endsWith("%") && vt(a.slice(0, -1)), fn = (a) => Ig.test(a), Xf = () => !0, nb = (a) => (
  // `colorFunctionRegex` check is necessary because color functions can have percentages in them which which would be incorrectly classified as lengths.
  // For example, `hsl(0 0% 0%)` would be classified as a length without this check.
  // I could also use lookbehind assertion in `lengthUnitRegex` but that isn't supported widely enough.
  Pg.test(a) && !$g.test(a)
), xs = () => !1, ab = (a) => tb.test(a), lb = (a) => eb.test(a), rb = (a) => !at(a) && !lt(a), ib = (a) => a.startsWith("@container") && (a[10] === "/" && a[11] !== void 0 || a[11] === "s" && a[16] !== void 0 && a.startsWith("-size/", 10) || a[11] === "n" && a[18] !== void 0 && a.startsWith("-normal/", 10)), ob = (a) => Yn(a, Jf, xs), at = (a) => Qf.test(a), oa = (a) => Yn(a, Wf, nb), Id = (a) => Yn(a, hb, vt), sb = (a) => Yn(a, If, Xf), cb = (a) => Yn(a, Ff, xs), Pd = (a) => Yn(a, Lf, xs), ub = (a) => Yn(a, Zf, lb), Mr = (a) => Yn(a, Pf, ab), lt = (a) => Vf.test(a), vl = (a) => ua(a, Wf), db = (a) => ua(a, Ff), $d = (a) => ua(a, Lf), fb = (a) => ua(a, Jf), mb = (a) => ua(a, Zf), Ar = (a) => ua(a, Pf, !0), pb = (a) => ua(a, If, !0), Yn = (a, l, s) => {
  const o = Qf.exec(a);
  return o ? o[1] ? l(o[1]) : s(o[2]) : !1;
}, ua = (a, l, s = !1) => {
  const o = Vf.exec(a);
  return o ? o[1] ? l(o[1]) : s : !1;
}, Lf = (a) => a === "position" || a === "percentage", Zf = (a) => a === "image" || a === "url", Jf = (a) => a === "length" || a === "size" || a === "bg-size", Wf = (a) => a === "length", hb = (a) => a === "number", Ff = (a) => a === "family-name", If = (a) => a === "number" || a === "weight", Pf = (a) => a === "shadow", gb = () => {
  const a = Lt("color"), l = Lt("font"), s = Lt("text"), o = Lt("font-weight"), i = Lt("tracking"), d = Lt("leading"), m = Lt("breakpoint"), f = Lt("container"), b = Lt("spacing"), x = Lt("radius"), E = Lt("shadow"), k = Lt("inset-shadow"), w = Lt("text-shadow"), N = Lt("drop-shadow"), _ = Lt("blur"), y = Lt("perspective"), z = Lt("aspect"), R = Lt("ease"), D = Lt("animate"), A = () => ["auto", "avoid", "all", "avoid-page", "page", "left", "right", "column"], X = () => [
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
  ], q = () => [...X(), lt, at], O = () => ["auto", "hidden", "clip", "visible", "scroll"], h = () => ["auto", "contain", "none"], p = () => [lt, at, b], v = () => [On, "full", "auto", ...p()], S = () => [Je, "none", "subgrid", lt, at], M = () => ["auto", {
    span: ["full", Je, lt, at]
  }, Je, lt, at], H = () => [Je, "auto", lt, at], J = () => ["auto", "min", "max", "fr", lt, at], $ = () => ["start", "end", "center", "between", "around", "evenly", "stretch", "baseline", "center-safe", "end-safe"], tt = () => ["start", "end", "center", "stretch", "center-safe", "end-safe"], Q = () => ["auto", ...p()], L = () => [On, "auto", "full", "dvw", "dvh", "lvw", "lvh", "svw", "svh", "min", "max", "fit", ...p()], I = () => [f, On, "screen", "full", "dvw", "lvw", "svw", "min", "max", "fit", ...p()], G = () => [On, "screen", "full", "lh", "dvh", "lvh", "svh", "min", "max", "fit", ...p()], K = () => [a, lt, at], T = () => [...X(), $d, Pd, {
    position: [lt, at]
  }], V = () => ["no-repeat", {
    repeat: ["", "x", "y", "space", "round"]
  }], et = () => ["auto", "cover", "contain", fb, ob, {
    size: [lt, at]
  }], it = () => [Zo, vl, oa], ot = () => [
    // Deprecated since Tailwind CSS v4.0.0
    "",
    "none",
    "full",
    x,
    lt,
    at
  ], st = () => ["", vt, vl, oa], kt = () => ["solid", "dashed", "dotted", "double"], Zt = () => ["normal", "multiply", "screen", "overlay", "darken", "lighten", "color-dodge", "color-burn", "hard-light", "soft-light", "difference", "exclusion", "hue", "saturation", "color", "luminosity"], ht = () => [vt, Zo, $d, Pd], Gn = () => [
    // Deprecated since Tailwind CSS v4.0.0
    "",
    "none",
    _,
    lt,
    at
  ], Kn = () => ["none", vt, lt, at], Re = () => ["none", vt, lt, at], De = () => [vt, lt, at], pn = () => [On, "full", ...p()];
  return {
    cacheSize: 500,
    theme: {
      animate: ["spin", "ping", "pulse", "bounce"],
      aspect: ["video"],
      blur: [fn],
      breakpoint: [fn],
      color: [Xf],
      container: [fn],
      "drop-shadow": [fn],
      ease: ["in", "out", "in-out"],
      font: [rb],
      "font-weight": ["thin", "extralight", "light", "normal", "medium", "semibold", "bold", "extrabold", "black"],
      "inset-shadow": [fn],
      leading: ["none", "tight", "snug", "normal", "relaxed", "loose"],
      perspective: ["dramatic", "near", "normal", "midrange", "distant", "none"],
      radius: [fn],
      shadow: [fn],
      spacing: ["px", vt],
      text: [fn],
      "text-shadow": [fn],
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
        aspect: ["auto", "square", On, at, lt, z]
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
      "container-named": [ib],
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
        inset: v()
      }],
      /**
       * Inset Inline
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       */
      "inset-x": [{
        "inset-x": v()
      }],
      /**
       * Inset Block
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       */
      "inset-y": [{
        "inset-y": v()
      }],
      /**
       * Inset Inline Start
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       * @todo class group will be renamed to `inset-s` in next major release
       */
      start: [{
        "inset-s": v(),
        /**
         * @deprecated since Tailwind CSS v4.2.0 in favor of `inset-s-*` utilities.
         * @see https://github.com/tailwindlabs/tailwindcss/pull/19613
         */
        start: v()
      }],
      /**
       * Inset Inline End
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       * @todo class group will be renamed to `inset-e` in next major release
       */
      end: [{
        "inset-e": v(),
        /**
         * @deprecated since Tailwind CSS v4.2.0 in favor of `inset-e-*` utilities.
         * @see https://github.com/tailwindlabs/tailwindcss/pull/19613
         */
        end: v()
      }],
      /**
       * Inset Block Start
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       */
      "inset-bs": [{
        "inset-bs": v()
      }],
      /**
       * Inset Block End
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       */
      "inset-be": [{
        "inset-be": v()
      }],
      /**
       * Top
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       */
      top: [{
        top: v()
      }],
      /**
       * Right
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       */
      right: [{
        right: v()
      }],
      /**
       * Bottom
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       */
      bottom: [{
        bottom: v()
      }],
      /**
       * Left
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       */
      left: [{
        left: v()
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
        basis: [On, "full", "auto", f, ...p()]
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
        flex: [vt, On, "auto", "initial", "none", at]
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
        "grid-cols": S()
      }],
      /**
       * Grid Column Start / End
       * @see https://tailwindcss.com/docs/grid-column
       */
      "col-start-end": [{
        col: M()
      }],
      /**
       * Grid Column Start
       * @see https://tailwindcss.com/docs/grid-column
       */
      "col-start": [{
        "col-start": H()
      }],
      /**
       * Grid Column End
       * @see https://tailwindcss.com/docs/grid-column
       */
      "col-end": [{
        "col-end": H()
      }],
      /**
       * Grid Template Rows
       * @see https://tailwindcss.com/docs/grid-template-rows
       */
      "grid-rows": [{
        "grid-rows": S()
      }],
      /**
       * Grid Row Start / End
       * @see https://tailwindcss.com/docs/grid-row
       */
      "row-start-end": [{
        row: M()
      }],
      /**
       * Grid Row Start
       * @see https://tailwindcss.com/docs/grid-row
       */
      "row-start": [{
        "row-start": H()
      }],
      /**
       * Grid Row End
       * @see https://tailwindcss.com/docs/grid-row
       */
      "row-end": [{
        "row-end": H()
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
        "auto-cols": J()
      }],
      /**
       * Grid Auto Rows
       * @see https://tailwindcss.com/docs/grid-auto-rows
       */
      "auto-rows": [{
        "auto-rows": J()
      }],
      /**
       * Gap
       * @see https://tailwindcss.com/docs/gap
       */
      gap: [{
        gap: p()
      }],
      /**
       * Gap X
       * @see https://tailwindcss.com/docs/gap
       */
      "gap-x": [{
        "gap-x": p()
      }],
      /**
       * Gap Y
       * @see https://tailwindcss.com/docs/gap
       */
      "gap-y": [{
        "gap-y": p()
      }],
      /**
       * Justify Content
       * @see https://tailwindcss.com/docs/justify-content
       */
      "justify-content": [{
        justify: [...$(), "normal"]
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
        content: ["normal", ...$()]
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
        "place-content": $()
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
        p: p()
      }],
      /**
       * Padding Inline
       * @see https://tailwindcss.com/docs/padding
       */
      px: [{
        px: p()
      }],
      /**
       * Padding Block
       * @see https://tailwindcss.com/docs/padding
       */
      py: [{
        py: p()
      }],
      /**
       * Padding Inline Start
       * @see https://tailwindcss.com/docs/padding
       */
      ps: [{
        ps: p()
      }],
      /**
       * Padding Inline End
       * @see https://tailwindcss.com/docs/padding
       */
      pe: [{
        pe: p()
      }],
      /**
       * Padding Block Start
       * @see https://tailwindcss.com/docs/padding
       */
      pbs: [{
        pbs: p()
      }],
      /**
       * Padding Block End
       * @see https://tailwindcss.com/docs/padding
       */
      pbe: [{
        pbe: p()
      }],
      /**
       * Padding Top
       * @see https://tailwindcss.com/docs/padding
       */
      pt: [{
        pt: p()
      }],
      /**
       * Padding Right
       * @see https://tailwindcss.com/docs/padding
       */
      pr: [{
        pr: p()
      }],
      /**
       * Padding Bottom
       * @see https://tailwindcss.com/docs/padding
       */
      pb: [{
        pb: p()
      }],
      /**
       * Padding Left
       * @see https://tailwindcss.com/docs/padding
       */
      pl: [{
        pl: p()
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
        "space-x": p()
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
        "space-y": p()
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
        size: L()
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
        w: [f, "screen", ...L()]
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
          ...L()
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
          ...L()
        ]
      }],
      /**
       * Height
       * @see https://tailwindcss.com/docs/height
       */
      h: [{
        h: ["screen", "lh", ...L()]
      }],
      /**
       * Min-Height
       * @see https://tailwindcss.com/docs/min-height
       */
      "min-h": [{
        "min-h": ["screen", "lh", "none", ...L()]
      }],
      /**
       * Max-Height
       * @see https://tailwindcss.com/docs/max-height
       */
      "max-h": [{
        "max-h": ["screen", "lh", "none", ...L()]
      }],
      // ------------------
      // --- Typography ---
      // ------------------
      /**
       * Font Size
       * @see https://tailwindcss.com/docs/font-size
       */
      "font-size": [{
        text: ["base", s, vl, oa]
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
        font: [o, pb, sb]
      }],
      /**
       * Font Stretch
       * @see https://tailwindcss.com/docs/font-stretch
       */
      "font-stretch": [{
        "font-stretch": ["ultra-condensed", "extra-condensed", "condensed", "semi-condensed", "normal", "semi-expanded", "expanded", "extra-expanded", "ultra-expanded", Zo, at]
      }],
      /**
       * Font Family
       * @see https://tailwindcss.com/docs/font-family
       */
      "font-family": [{
        font: [db, cb, l]
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
        tracking: [i, lt, at]
      }],
      /**
       * Line Clamp
       * @see https://tailwindcss.com/docs/line-clamp
       */
      "line-clamp": [{
        "line-clamp": [vt, "none", lt, Id]
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
          ...p()
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
        decoration: K()
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
        indent: p()
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
        bg: T()
      }],
      /**
       * Background Repeat
       * @see https://tailwindcss.com/docs/background-repeat
       */
      "bg-repeat": [{
        bg: V()
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
        }, mb, ub]
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
        outline: ["", vt, vl, oa]
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
          E,
          Ar,
          Mr
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
        "inset-shadow": ["none", k, Ar, Mr]
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
        ring: K()
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
        "ring-offset": K()
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
        "inset-ring": K()
      }],
      /**
       * Text Shadow
       * @see https://tailwindcss.com/docs/text-shadow
       */
      "text-shadow": [{
        "text-shadow": ["none", w, Ar, Mr]
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
        opacity: [vt, lt, at]
      }],
      /**
       * Mix Blend Mode
       * @see https://tailwindcss.com/docs/mix-blend-mode
       */
      "mix-blend": [{
        "mix-blend": [...Zt(), "plus-darker", "plus-lighter"]
      }],
      /**
       * Background Blend Mode
       * @see https://tailwindcss.com/docs/background-blend-mode
       */
      "bg-blend": [{
        "bg-blend": Zt()
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
        "mask-radial": [lt, at]
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
        mask: T()
      }],
      /**
       * Mask Repeat
       * @see https://tailwindcss.com/docs/mask-repeat
       */
      "mask-repeat": [{
        mask: V()
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
        blur: Gn()
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
          N,
          Ar,
          Mr
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
        "backdrop-blur": Gn()
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
        "border-spacing": p()
      }],
      /**
       * Border Spacing X
       * @see https://tailwindcss.com/docs/border-spacing
       */
      "border-spacing-x": [{
        "border-spacing-x": p()
      }],
      /**
       * Border Spacing Y
       * @see https://tailwindcss.com/docs/border-spacing
       */
      "border-spacing-y": [{
        "border-spacing-y": p()
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
        ease: ["linear", "initial", R, lt, at]
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
        animate: ["none", D, lt, at]
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
        perspective: [y, lt, at]
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
        translate: pn()
      }],
      /**
       * Translate X
       * @see https://tailwindcss.com/docs/translate
       */
      "translate-x": [{
        "translate-x": pn()
      }],
      /**
       * Translate Y
       * @see https://tailwindcss.com/docs/translate
       */
      "translate-y": [{
        "translate-y": pn()
      }],
      /**
       * Translate Z
       * @see https://tailwindcss.com/docs/translate
       */
      "translate-z": [{
        "translate-z": pn()
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
        "scroll-m": p()
      }],
      /**
       * Scroll Margin Inline
       * @see https://tailwindcss.com/docs/scroll-margin
       */
      "scroll-mx": [{
        "scroll-mx": p()
      }],
      /**
       * Scroll Margin Block
       * @see https://tailwindcss.com/docs/scroll-margin
       */
      "scroll-my": [{
        "scroll-my": p()
      }],
      /**
       * Scroll Margin Inline Start
       * @see https://tailwindcss.com/docs/scroll-margin
       */
      "scroll-ms": [{
        "scroll-ms": p()
      }],
      /**
       * Scroll Margin Inline End
       * @see https://tailwindcss.com/docs/scroll-margin
       */
      "scroll-me": [{
        "scroll-me": p()
      }],
      /**
       * Scroll Margin Block Start
       * @see https://tailwindcss.com/docs/scroll-margin
       */
      "scroll-mbs": [{
        "scroll-mbs": p()
      }],
      /**
       * Scroll Margin Block End
       * @see https://tailwindcss.com/docs/scroll-margin
       */
      "scroll-mbe": [{
        "scroll-mbe": p()
      }],
      /**
       * Scroll Margin Top
       * @see https://tailwindcss.com/docs/scroll-margin
       */
      "scroll-mt": [{
        "scroll-mt": p()
      }],
      /**
       * Scroll Margin Right
       * @see https://tailwindcss.com/docs/scroll-margin
       */
      "scroll-mr": [{
        "scroll-mr": p()
      }],
      /**
       * Scroll Margin Bottom
       * @see https://tailwindcss.com/docs/scroll-margin
       */
      "scroll-mb": [{
        "scroll-mb": p()
      }],
      /**
       * Scroll Margin Left
       * @see https://tailwindcss.com/docs/scroll-margin
       */
      "scroll-ml": [{
        "scroll-ml": p()
      }],
      /**
       * Scroll Padding
       * @see https://tailwindcss.com/docs/scroll-padding
       */
      "scroll-p": [{
        "scroll-p": p()
      }],
      /**
       * Scroll Padding Inline
       * @see https://tailwindcss.com/docs/scroll-padding
       */
      "scroll-px": [{
        "scroll-px": p()
      }],
      /**
       * Scroll Padding Block
       * @see https://tailwindcss.com/docs/scroll-padding
       */
      "scroll-py": [{
        "scroll-py": p()
      }],
      /**
       * Scroll Padding Inline Start
       * @see https://tailwindcss.com/docs/scroll-padding
       */
      "scroll-ps": [{
        "scroll-ps": p()
      }],
      /**
       * Scroll Padding Inline End
       * @see https://tailwindcss.com/docs/scroll-padding
       */
      "scroll-pe": [{
        "scroll-pe": p()
      }],
      /**
       * Scroll Padding Block Start
       * @see https://tailwindcss.com/docs/scroll-padding
       */
      "scroll-pbs": [{
        "scroll-pbs": p()
      }],
      /**
       * Scroll Padding Block End
       * @see https://tailwindcss.com/docs/scroll-padding
       */
      "scroll-pbe": [{
        "scroll-pbe": p()
      }],
      /**
       * Scroll Padding Top
       * @see https://tailwindcss.com/docs/scroll-padding
       */
      "scroll-pt": [{
        "scroll-pt": p()
      }],
      /**
       * Scroll Padding Right
       * @see https://tailwindcss.com/docs/scroll-padding
       */
      "scroll-pr": [{
        "scroll-pr": p()
      }],
      /**
       * Scroll Padding Bottom
       * @see https://tailwindcss.com/docs/scroll-padding
       */
      "scroll-pb": [{
        "scroll-pb": p()
      }],
      /**
       * Scroll Padding Left
       * @see https://tailwindcss.com/docs/scroll-padding
       */
      "scroll-pl": [{
        "scroll-pl": p()
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
        fill: ["none", ...K()]
      }],
      /**
       * Stroke Width
       * @see https://tailwindcss.com/docs/stroke-width
       */
      "stroke-w": [{
        stroke: [vt, vl, oa, Id]
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
}, bb = /* @__PURE__ */ Jg(gb);
function ce(...a) {
  return bb(Uf(a));
}
function vb(a, l, s) {
  return a.filter((o, i) => i !== l && (o.start + o.end) / 2 < s).length;
}
function yb(a, l, s, o) {
  const i = a.map(() => 0), d = a[l];
  if (!d) return i;
  const m = a[l + 1], f = a[l - 1], b = d.end - d.start + (m ? m.start - d.end : f ? d.start - f.end : 0);
  return a.forEach((x, E) => {
    l < s && E > l && E <= s ? i[E] = -b : s < l && E >= s && E < l && (i[E] = b);
  }), i[l] = Math.min(Math.max(o, a[0].start - d.start), a[a.length - 1].end - d.end), i;
}
const tf = ["transform", "transition", "zIndex", "filter", "pointerEvents", "position"];
function xb(a, l) {
  for (let s = a.parentElement; s; s = s.parentElement) {
    const o = getComputedStyle(s)[l === "x" ? "overflowX" : "overflowY"];
    if ((o === "auto" || o === "scroll") && (l === "x" ? s.scrollWidth > s.clientWidth : s.scrollHeight > s.clientHeight)) return s;
  }
  return null;
}
function wb(a, l, s, o) {
  const i = a[l] ? xb(a[l], s) : null, d = () => i ? s === "x" ? i.scrollLeft : i.scrollTop : 0, m = (z) => (s === "x" ? z.clientX : z.clientY) + d(), f = m(o), b = d(), x = a.map((z) => {
    const R = z.getBoundingClientRect();
    return s === "x" ? { start: R.left + b, end: R.right + b } : { start: R.top + b, end: R.bottom + b };
  }), E = a.map((z) => tf.map((R) => z.style[R])), k = typeof matchMedia == "function" && matchMedia("(prefers-reduced-motion: reduce)").matches, w = s === "x" ? "translateX" : "translateY";
  let N = !1;
  const _ = { to: l };
  a.forEach((z, R) => {
    if (z.style.pointerEvents = "none", R !== l) {
      k || (z.style.transition = "transform 160ms cubic-bezier(0.2, 0.8, 0.2, 1)");
      return;
    }
    getComputedStyle(z).position === "static" && (z.style.position = "relative"), z.style.zIndex = "30", z.style.filter = "drop-shadow(0 6px 10px rgba(0, 0, 0, 0.45))";
  });
  const y = (z, R) => {
    _.to = z, yb(x, l, z, R).forEach((D, A) => {
      a[A].style.transform = D ? `${w}(${D}px)` : "";
    });
  };
  return {
    from: l,
    get to() {
      return _.to;
    },
    slot: (z) => vb(x, l, m(z)),
    apply: (z, R) => {
      N || y(z, m(R) - f);
    },
    rest: () => {
      N || y(l, 0);
    },
    end: () => {
      N || (N = !0, a.forEach((z, R) => tf.forEach((D, A) => {
        z.style[D] = E[R][A];
      })));
    }
  };
}
const _b = 5;
let Jo = !1;
function Sb(a, l) {
  if (a.button !== 0 || Jo) return;
  const s = { clientX: a.clientX, clientY: a.clientY }, o = a.currentTarget, i = a.pointerId;
  let d = null, m, f = !1;
  const b = { cursor: document.body.style.cursor, userSelect: document.body.style.userSelect }, x = (_) => {
    if (f) return;
    f = !0, window.removeEventListener("pointermove", E), window.removeEventListener("pointerup", k), window.removeEventListener("pointercancel", w), window.removeEventListener("keydown", N, !0), window.removeEventListener("blur", w), o.removeEventListener("lostpointercapture", w);
    try {
      o.releasePointerCapture(i);
    } catch {
    }
    if (!d) return;
    Jo = !1, document.body.style.cursor = b.cursor, document.body.style.userSelect = b.userSelect, d.end();
    const y = (z) => z.stopPropagation();
    window.addEventListener("click", y, { capture: !0, once: !0 }), setTimeout(() => window.removeEventListener("click", y, !0), 0), m?.(), l.onEnd(_, d);
  }, E = (_) => {
    if (!d) {
      if (Math.hypot(_.clientX - s.clientX, _.clientY - s.clientY) < _b) return;
      const y = l.items();
      d = wb(y, l.from(y), l.axis, s), Jo = !0, document.body.style.cursor = "grabbing", document.body.style.userSelect = "none";
      try {
        o.setPointerCapture(i);
      } catch {
      }
      o.addEventListener("lostpointercapture", w);
      const z = l.onStart?.();
      m = typeof z == "function" ? z : void 0;
    }
    l.onMove(_, d);
  }, k = () => x(!0), w = () => x(!1), N = (_) => {
    _.key === "Escape" && (_.stopPropagation(), x(!1));
  };
  window.addEventListener("pointermove", E), window.addEventListener("pointerup", k), window.addEventListener("pointercancel", w), window.addEventListener("keydown", N, !0), window.addEventListener("blur", w);
}
const $f = typeof navigator < "u" && /Mac/i.test(navigator.platform), Vr = {
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
for (let a = 1; a <= 12; a++) Vr[`f${a}`] = `F${a}`;
const kb = Object.fromEntries(Object.entries(Vr).map(([a, l]) => [l, a])), Eb = {
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
function zb(a) {
  const l = /^Key([A-Z])$/.exec(a) ?? /^Digit(\d)$/.exec(a);
  return l ? l[1].toLowerCase() : kb[a];
}
const ef = /* @__PURE__ */ new Map();
function tm(a, l = $f) {
  const s = `${l}|${a}`, o = ef.get(s);
  if (o) return o;
  const i = { cmd: !1, ctrl: !1, shift: !1, alt: !1, code: "" };
  for (const d of a.split("+"))
    if (d === "mod")
      l ? i.cmd = !0 : (i.ctrl = !0, i.shift = !0);
    else if (d === "cmd" || d === "ctrl" || d === "shift" || d === "alt") i[d] = !0;
    else if (/^[a-z]$/.test(d))
      i.code = `Key${d.toUpperCase()}`, i.letter = d;
    else if (/^[0-9]$/.test(d)) i.code = `Digit${d}`;
    else if (Vr[d]) i.code = Vr[d];
    else throw new Error(`unknown key "${d}" in "${a}"`);
  if (!i.code) throw new Error(`no key in "${a}"`);
  return ef.set(s, i), i;
}
new Set(["cmd+q", "cmd+h", "cmd+alt+h", "cmd+m", "cmd+ctrl+f", "cmd+z", "cmd+shift+z", "cmd+x", "cmd+c", "cmd+v", "cmd+a"].map((a) => {
  const l = tm(a, !0);
  return [l.cmd && "cmd", l.ctrl && "ctrl", l.alt && "alt", l.shift && "shift", l.code].filter(Boolean).join("+");
}));
function Nb(a, l = $f) {
  const s = tm(a, l), o = Tb(zb(s.code) ?? "");
  return l ? `${s.ctrl ? "⌃" : ""}${s.alt ? "⌥" : ""}${s.shift ? "⇧" : ""}${s.cmd ? "⌘" : ""}${o}` : [s.ctrl && "Ctrl", s.alt && "Alt", s.shift && "Shift", o].filter(Boolean).join("+");
}
const Tb = (a) => Eb[a] ?? a.toUpperCase(), nf = (a) => typeof a == "boolean" ? `${a}` : a === 0 ? "0" : a, af = Uf, Fr = (a, l) => (s) => {
  var o;
  if (l?.variants == null) return af(a, s?.class, s?.className);
  const { variants: i, defaultVariants: d } = l, m = Object.keys(i).map((x) => {
    const E = s?.[x], k = d?.[x];
    if (E === null) return null;
    const w = nf(E) || nf(k);
    return i[x][w];
  }), f = s && Object.entries(s).reduce((x, E) => {
    let [k, w] = E;
    return w === void 0 || (x[k] = w), x;
  }, {}), b = l == null || (o = l.compoundVariants) === null || o === void 0 ? void 0 : o.reduce((x, E) => {
    let { class: k, className: w, ...N } = E;
    return Object.entries(N).every((_) => {
      let [y, z] = _;
      return Array.isArray(z) ? z.includes({
        ...d,
        ...f
      }[y]) : {
        ...d,
        ...f
      }[y] === z;
    }) ? [
      ...x,
      k,
      w
    ] : x;
  }, []);
  return af(a, m, b, s?.class, s?.className);
}, Cb = Fr(
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
), Mb = Fr(
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
function Ab({ className: a, ...l } = {}) {
  return ce(Mb(l), a);
}
const em = "shrink-0 cursor-pointer rounded-ui bg-transparent px-[0.2rem] py-[0.1rem] text-[0.8rem] leading-none text-subtext-0 [font-family:inherit] [border:none] [transition:color_0.1s_ease,background_0.1s_ease] hover:bg-surface-1 hover:text-accent", nm = "cursor-pointer rounded-ui bg-transparent text-subtext-0 [border:0] [font-family:inherit] [transition:color_0.1s_ease,background_0.1s_ease] hover:bg-surface-1 hover:text-fg focus-visible:bg-surface-1 focus-visible:text-fg disabled:cursor-not-allowed disabled:opacity-40", jb = Fr(`${nm} shrink-0 focus-visible:[outline:2px_solid_var(--accent)] focus-visible:[outline-offset:-2px]`, {
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
function Ob({ className: a, ...l } = {}) {
  return ce(jb(l), a);
}
const am = "overflow-hidden rounded-ui bg-surface-1 py-[0.3rem] shadow-[0_8px_24px_rgba(0,0,0,0.45)]", Rb = Fr(
  "pane-context-menu__item block w-full cursor-pointer bg-transparent px-[0.9rem] py-[0.45rem] text-left text-[0.82rem] [border:none] [font-family:inherit] [transition:background_0.1s_ease] hover:bg-surface-0 disabled:cursor-not-allowed disabled:bg-transparent disabled:opacity-40",
  { variants: { danger: { true: "text-red", false: "text-fg" } }, defaultVariants: { danger: !1 } }
), Db = "my-1 h-px bg-overlay-0";
function Hb({ size: a = 14, className: l }) {
  return /* @__PURE__ */ ft.jsxs("svg", { className: l, width: a, height: a, viewBox: "0 0 16 16", fill: "currentColor", "aria-hidden": "true", children: [
    /* @__PURE__ */ ft.jsx("circle", { cx: "3.5", cy: "8", r: "1.1" }),
    /* @__PURE__ */ ft.jsx("circle", { cx: "8", cy: "8", r: "1.1" }),
    /* @__PURE__ */ ft.jsx("circle", { cx: "12.5", cy: "8", r: "1.1" })
  ] });
}
function Bb({ size: a = 16, className: l }) {
  return /* @__PURE__ */ ft.jsxs("svg", { className: l, width: a, height: a, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: "1.3", strokeLinejoin: "round", "aria-hidden": "true", children: [
    /* @__PURE__ */ ft.jsx("path", { d: "M6.6 1.8h2.8l.4 1.6 1.1.6 1.5-.6 1.4 2.4-1.2 1.1v1.3l1.2 1.1-1.4 2.4-1.5-.6-1.1.6-.4 1.6H6.6l-.4-1.6-1.1-.6-1.5.6-1.4-2.4 1.2-1.1V7.3L2.2 6.2l1.4-2.4 1.5.6 1.1-.6z" }),
    /* @__PURE__ */ ft.jsx("circle", { cx: "8", cy: "8", r: "2" })
  ] });
}
function Ub({ size: a = 14, className: l }) {
  return /* @__PURE__ */ ft.jsx("svg", { className: l, width: a, height: a, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round", "aria-hidden": "true", children: /* @__PURE__ */ ft.jsx("path", { d: "M3.5 3.5l9 9M12.5 3.5l-9 9" }) });
}
function lm({ size: a = 14, className: l }) {
  return /* @__PURE__ */ ft.jsx("svg", { className: l, width: a, height: a, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round", "aria-hidden": "true", children: /* @__PURE__ */ ft.jsx("path", { d: "M8 2.5v11M2.5 8h11" }) });
}
const lf = {
  connected: "host-state--connected bg-accent",
  connecting: "host-state--connecting animate-host-pulse bg-yellow",
  error: "host-state--error bg-red",
  disabled: "host-state--disabled bg-subtext-0"
};
function qb({ state: a, error: l }) {
  return /* @__PURE__ */ ft.jsx(
    "span",
    {
      className: ce("host-state inline-block h-2 w-2 shrink-0 rounded-[50%]", lf[a] ?? lf.disabled),
      title: a === "error" && l ? l : a
    }
  );
}
function Yb({ title: a, onClose: l, children: s, testId: o }) {
  return Wr(
    /* @__PURE__ */ ft.jsx(
      "div",
      {
        className: "fixed inset-0 z-[2100] flex items-center justify-center bg-[rgba(0,0,0,0.55)]",
        onMouseDown: (i) => {
          i.target === i.currentTarget && l();
        },
        onKeyDown: (i) => {
          i.key === "Escape" && l();
        },
        children: /* @__PURE__ */ ft.jsxs(
          "div",
          {
            className: "grid max-h-[85vh] w-[min(30rem,92vw)] gap-[0.6rem] overflow-y-auto rounded-ui bg-panel-bg p-4 shadow-[0_8px_32px_rgba(0,0,0,0.5)]",
            role: "dialog",
            "aria-modal": "true",
            "aria-label": a,
            "data-testid": o,
            children: [
              /* @__PURE__ */ ft.jsx("h2", { className: "m-0 text-[0.9rem] font-semibold text-fg", children: a }),
              s
            ]
          }
        )
      }
    ),
    document.body
  );
}
const jr = 4, Rn = 8, Gb = "flex w-full cursor-pointer items-center justify-between gap-3 px-[0.9rem] py-[0.4rem] text-left text-[0.82rem] text-fg max-[700px]:min-h-11 aria-disabled:cursor-not-allowed aria-disabled:opacity-40", rf = (a) => a.text ?? (typeof a.label == "string" ? a.label : a.value);
function Kb({ value: a, onChange: l, options: s, className: o, ariaLabel: i, testId: d, id: m, title: f, disabled: b, placeholder: x, freeText: E, onKeyDown: k }) {
  const w = dt.useId(), [N, _] = dt.useState(!1), [y, z] = dt.useState(-1), [R, D] = dt.useState(!1), A = dt.useRef(null), X = dt.useRef(null), [q, O] = dt.useState({}), h = dt.useRef({ text: "", at: 0 }), p = E && R && a ? s.filter((G) => rf(G).toLowerCase().includes(a.toLowerCase()) || G.value.toLowerCase().includes(a.toLowerCase())) : s, v = s.find((G) => G.value === a), S = (G) => `${w}-${G}`;
  function M(G) {
    b || (z(G), _(!0));
  }
  function H() {
    _(!1), D(!1), z(-1);
  }
  function J(G) {
    !G || G.disabled || (l(G.value), H());
  }
  function $(G, K) {
    for (let T = 1; T <= p.length; T++) {
      const V = (G + K * T + p.length * T) % p.length;
      if (!p[V].disabled) return V;
    }
    return G;
  }
  const tt = () => p.findIndex((G) => !G.disabled), Q = () => p.length - 1 - [...p].reverse().findIndex((G) => !G.disabled);
  es(() => {
    if (!N || !A.current) {
      O((et) => et.left === void 0 ? et : {});
      return;
    }
    const G = A.current.getBoundingClientRect(), K = window.innerHeight - G.bottom - jr - Rn, T = G.top - jr - Rn, V = K < 160 && T > K;
    O({
      position: "fixed",
      left: Math.min(Math.max(Rn, G.left), Math.max(Rn, window.innerWidth - G.width - Rn)),
      // As wide as its longest label (a session title, a path), never wider than the window.
      width: "max-content",
      minWidth: G.width,
      maxWidth: window.innerWidth - 2 * Rn,
      maxHeight: Math.min(V ? T : K, 320),
      ...V ? { bottom: window.innerHeight - G.top + jr } : { top: G.bottom + jr },
      overflowY: "auto"
    });
  }, [N, p.length]), es(() => {
    const G = X.current;
    if (!N || !G || q.left === void 0) return;
    const K = G.getBoundingClientRect().right, T = window.innerWidth - Rn;
    K > T && O((V) => ({ ...V, left: Math.max(Rn, Number(V.left) - (K - T)) }));
  }, [N, q]), Fe(() => {
    if (!N) return;
    const G = (K) => {
      const T = K.target;
      (T === document || T instanceof Node && A.current && T.contains(A.current)) && H();
    };
    return window.addEventListener("resize", H), window.addEventListener("scroll", G, !0), () => {
      window.removeEventListener("resize", H), window.removeEventListener("scroll", G, !0);
    };
  }, [N]), Fe(() => {
    const G = N && y >= 0 ? document.getElementById(S(y)) : null, K = X.current;
    !G || !K || (G.offsetTop < K.scrollTop ? K.scrollTop = G.offsetTop : G.offsetTop + G.offsetHeight > K.scrollTop + K.clientHeight && (K.scrollTop = G.offsetTop + G.offsetHeight - K.clientHeight));
  }, [N, y]), sm(N, (G) => {
    G || H();
  }, A, X);
  function L(G) {
    if (G.nativeEvent.isComposing) return;
    const K = () => {
      G.preventDefault(), G.stopPropagation();
    }, { key: T } = G;
    if (N) {
      if (T === "Escape") {
        K(), H();
        return;
      } else if (T === "Tab")
        H();
      else if (T === "ArrowDown" || T === "ArrowUp") {
        K(), p.length && z(y < 0 ? T === "ArrowDown" ? tt() : Q() : $(y, T === "ArrowDown" ? 1 : -1));
        return;
      } else if (T === "Home" && !E) {
        K(), z(tt());
        return;
      } else if (T === "End" && !E) {
        K(), z(Q());
        return;
      } else if (T === "Enter" || T === " " && !E) {
        if (y >= 0 && p[y]) {
          K(), J(p[y]);
          return;
        }
        if (!E) {
          K(), H();
          return;
        }
      } else if (!E && T.length === 1 && !G.metaKey && !G.ctrlKey && !G.altKey) {
        const V = Date.now();
        h.current = { text: (V - h.current.at > 600 ? "" : h.current.text) + T.toLowerCase(), at: V };
        const et = Math.max(y, 0), it = [...p.slice(et + (h.current.text.length === 1 ? 1 : 0)), ...p.slice(0, et + 1)].find((ot) => !ot.disabled && rf(ot).toLowerCase().startsWith(h.current.text));
        it && (K(), z(p.indexOf(it)));
        return;
      }
    } else if (T === "ArrowDown" || T === "ArrowUp" || !E && (T === "Enter" || T === " ")) {
      K(), M(Math.max(0, p.findIndex((V) => V.value === a)));
      return;
    }
    k?.(G);
  }
  const I = {
    ref: (G) => {
      A.current = G;
    },
    id: m,
    title: f,
    disabled: b,
    "aria-label": i,
    "aria-expanded": N,
    "aria-controls": N ? w : void 0,
    "aria-activedescendant": N && y >= 0 ? S(y) : void 0,
    "data-testid": d,
    onKeyDown: L
  };
  return /* @__PURE__ */ ft.jsxs(ft.Fragment, { children: [
    E ? /* @__PURE__ */ ft.jsx(
      "input",
      {
        ...I,
        type: "text",
        role: "combobox",
        "aria-autocomplete": "list",
        autoComplete: "off",
        placeholder: x,
        className: o,
        value: a,
        onChange: (G) => {
          l(G.target.value), D(!0), N ? z(-1) : (z(-1), _(!0));
        },
        onBlur: () => H()
      }
    ) : /* @__PURE__ */ ft.jsxs(
      "button",
      {
        ...I,
        type: "button",
        role: "combobox",
        "aria-haspopup": "listbox",
        "data-value": a,
        className: ce("inline-flex items-center justify-between gap-2 text-left [font-family:inherit] cursor-pointer disabled:cursor-not-allowed disabled:opacity-50", o),
        onClick: () => N ? H() : M(Math.max(0, p.findIndex((G) => G.value === a))),
        children: [
          /* @__PURE__ */ ft.jsx("span", { className: "min-w-0 flex-1 truncate", children: v ? v.label : x ?? "" }),
          /* @__PURE__ */ ft.jsx(om, { open: !0, className: "shrink-0 text-subtext-0" })
        ]
      }
    ),
    N && p.length > 0 && Wr(
      /* @__PURE__ */ ft.jsx(
        "div",
        {
          ref: X,
          id: w,
          role: "listbox",
          "aria-label": i,
          className: ce("z-[9999]", am),
          style: q,
          onMouseDown: (G) => {
            G.preventDefault(), G.stopPropagation();
          },
          onClick: (G) => G.stopPropagation(),
          children: p.map((G, K) => /* @__PURE__ */ ft.jsxs(
            "div",
            {
              id: S(K),
              role: "option",
              "aria-selected": G.value === a,
              "aria-disabled": G.disabled || void 0,
              "data-value": G.value,
              className: ce(Gb, K === y && !G.disabled && "bg-surface-0"),
              onMouseEnter: () => {
                G.disabled || z(K);
              },
              onClick: () => J(G),
              children: [
                /* @__PURE__ */ ft.jsx("span", { className: "min-w-0 truncate", children: G.label }),
                G.value === a && /* @__PURE__ */ ft.jsx("span", { "aria-hidden": "true", className: "shrink-0 text-accent", children: "✓" })
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
const Qb = "box-border min-h-[44px] cursor-pointer rounded-ui bg-transparent px-[0.7rem] py-[0.45rem] text-subtext-0 no-underline [border:0] [font-family:inherit] [font-weight:inherit] [line-height:inherit] text-[0.85rem] hover:bg-surface-1 hover:text-fg focus-visible:[outline:2px_solid_var(--accent)] focus-visible:[outline-offset:2px] disabled:cursor-default disabled:opacity-[0.55]", Vb = "m-0 mt-[0.4rem] text-[0.78rem] text-subtext-0", Xb = "m-0 mb-2 text-[0.82rem] text-subtext-0", rm = "rounded-ui bg-surface-1 text-fg [font-family:inherit]", ws = `${rm} px-2 py-[0.3rem] text-[0.8rem] max-[700px]:min-h-11 focus:[outline:1px_solid_var(--accent)]`, Lb = `${ws} min-w-[5.5rem] shrink-0`, _s = `${rm} min-w-0 px-[0.55rem] py-[0.35rem] text-[0.82rem] max-[700px]:min-h-11 focus:[outline:1px_solid_var(--accent)]`, Zb = `${_s} flex-1 max-[700px]:flex-[1_1_100%]`, Jb = `${_s} w-20 flex-[0_0_5rem] max-[700px]:w-24 max-[700px]:flex-[1_1_6rem]`, Wb = `${_s} flex-[1_1_100%]`, Fb = "flex flex-wrap items-center gap-[0.4rem]", Ib = "m-0 mb-2 flex list-none flex-col gap-[0.3rem] p-0", Pb = "flex items-center gap-2 max-[700px]:flex-wrap rounded-ui bg-surface-1 px-2 py-[0.35rem] text-[0.82rem]", $b = `settings-modal__host-row ${Pb}`, tv = "min-w-0 overflow-hidden font-semibold text-ellipsis whitespace-nowrap text-fg", ev = "min-w-0 flex-1 max-[700px]:basis-full overflow-hidden text-[0.78rem] text-ellipsis whitespace-nowrap text-subtext-0", im = "shrink-0 cursor-pointer rounded-ui px-[0.7rem] py-[0.35rem] max-[700px]:min-h-11 text-[0.82rem] font-semibold text-panel-bg [border:none] [font-family:inherit] [transition:opacity_0.12s_ease] hover:opacity-[0.85]", nv = `${im} bg-accent`, av = `${im} ml-auto bg-red`;
function om({ open: a, size: l = 12, className: s }) {
  return /* @__PURE__ */ ft.jsx("svg", { className: s, width: l, height: l, viewBox: "0 0 12 12", fill: "none", stroke: "currentColor", strokeWidth: "1.3", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true", children: /* @__PURE__ */ ft.jsx("path", { d: a ? "M2.5 4.5 6 8l3.5-3.5" : "M4.5 2.5 8 6l-3.5 3.5" }) });
}
function lv(a) {
  return a.blocked && !a.stale ? "blocked" : a.status === "running" && !a.stale ? "working" : a.unseen ? "done" : "idle";
}
const ss = {
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
function cs(a, l) {
  return !!a.parentSessionId && a.parentSessionId !== a.id && l.some((s) => s.id === a.parentSessionId);
}
function rv(a) {
  const l = /* @__PURE__ */ new Map();
  for (const s of a)
    cs(s, a) && l.set(s.parentSessionId, [...l.get(s.parentSessionId) ?? [], s]);
  return l.size ? a.filter((s) => !cs(s, a)).flatMap((s) => [s, ...l.get(s.id) ?? []]) : a;
}
const Or = 6, of = 8;
function iv(a, l = {}) {
  const { minWidth: s = 220, align: o = "right", minSpaceAbove: i = 100 } = l, d = a.getBoundingClientRect(), m = window.innerWidth, f = window.innerHeight, b = o === "right" ? { right: Math.max(0, m - d.right) } : { left: Math.max(0, d.left) }, x = d.top - Or - of, E = f - d.bottom - Or - of;
  return x >= i ? {
    position: "fixed",
    bottom: f - d.top + Or,
    ...b,
    minWidth: s,
    maxHeight: Math.min(x, f * 0.75),
    overflowY: "auto"
  } : {
    position: "fixed",
    top: d.bottom + Or,
    ...b,
    minWidth: s,
    maxHeight: Math.min(E, f * 0.75),
    overflowY: "auto"
  };
}
function sm(a, l, s, o) {
  Fe(() => {
    if (!a) return;
    function i(m) {
      const f = m.target, b = s.current?.contains(f) ?? !1, x = o.current?.contains(f) ?? !1;
      !b && !x && l(!1);
    }
    function d(m) {
      m.key === "Escape" && l(!1);
    }
    return document.addEventListener("mousedown", i), document.addEventListener("keydown", d), () => {
      document.removeEventListener("mousedown", i), document.removeEventListener("keydown", d);
    };
  }, [a]);
}
function ov({ icon: a, fallback: l }) {
  const [s, o] = dt.useState(!1);
  return Fe(() => o(!1), [a]), !a || s ? /* @__PURE__ */ ft.jsx(ft.Fragment, { children: l }) : /* @__PURE__ */ ft.jsx("img", { src: a, alt: "", width: 14, height: 14, className: "size-[14px] rounded-[2px] object-contain", referrerPolicy: "no-referrer", onError: () => o(!0) });
}
const sv = "mode-switch group ml-auto flex items-center gap-[0.4rem] bg-transparent p-[0.2rem] [border:none] [font-family:inherit]", cm = "text-[0.72rem] font-semibold tracking-[0.03em] text-overlay-1 uppercase [transition:color_0.15s_ease]", cv = `${cm} group-aria-[checked=false]:text-accent`, uv = `${cm} group-aria-checked:text-accent`, dv = "relative h-[1.3rem] w-[2.4rem] shrink-0 rounded-[999px] border border-overlay-0 bg-surface-1 [transition:background_0.15s_ease] group-aria-checked:border-accent group-aria-checked:bg-panel-bg", fv = "absolute top-px left-px h-[1.1rem] w-[1.1rem] rounded-[50%] bg-fg [box-shadow:0_1px_2px_rgba(0,0,0,0.3)] [transition:transform_0.15s_ease,background_0.15s_ease] group-aria-checked:bg-accent group-aria-checked:[transform:translateX(1.1rem)]";
function mv({
  mode: a,
  onChange: l,
  testId: s = "mode-switch",
  disabled: o = !1
}) {
  const i = a === "cli";
  return /* @__PURE__ */ ft.jsxs(
    "button",
    {
      type: "button",
      className: sv,
      "data-testid": s,
      role: "switch",
      "aria-checked": i,
      "aria-label": "Toggle UI / CLI mode",
      disabled: o,
      onClick: () => l(i ? "ui" : "cli"),
      children: [
        /* @__PURE__ */ ft.jsx("span", { className: ce("mode-switch__label mode-switch__label--ui", cv), children: "UI" }),
        /* @__PURE__ */ ft.jsx("span", { className: ce("mode-switch__track", dv), children: /* @__PURE__ */ ft.jsx("span", { className: ce("mode-switch__thumb", fv) }) }),
        /* @__PURE__ */ ft.jsx("span", { className: ce("mode-switch__label mode-switch__label--cli", uv), children: "CLI" })
      ]
    }
  );
}
const Ya = function(a, l) {
  let i = a;
  const d = xl[l];
  let m = null, f = 0, b = null;
  const x = [], E = {}, k = function(h, p) {
    f = i * 4 + 17, m = (function(v) {
      const S = new Array(v);
      for (let M = 0; M < v; M += 1) {
        S[M] = new Array(v);
        for (let H = 0; H < v; H += 1)
          S[M][H] = null;
      }
      return S;
    })(f), w(0, 0), w(f - 7, 0), w(0, f - 7), y(), _(), R(h, p), i >= 7 && z(h), b == null && (b = X(i, d, x)), D(b, p);
  }, w = function(h, p) {
    for (let v = -1; v <= 7; v += 1)
      if (!(h + v <= -1 || f <= h + v))
        for (let S = -1; S <= 7; S += 1)
          p + S <= -1 || f <= p + S || (0 <= v && v <= 6 && (S == 0 || S == 6) || 0 <= S && S <= 6 && (v == 0 || v == 6) || 2 <= v && v <= 4 && 2 <= S && S <= 4 ? m[h + v][p + S] = !0 : m[h + v][p + S] = !1);
  }, N = function() {
    let h = 0, p = 0;
    for (let v = 0; v < 8; v += 1) {
      k(!0, v);
      const S = Hn.getLostPoint(E);
      (v == 0 || h > S) && (h = S, p = v);
    }
    return p;
  }, _ = function() {
    for (let h = 8; h < f - 8; h += 1)
      m[h][6] == null && (m[h][6] = h % 2 == 0);
    for (let h = 8; h < f - 8; h += 1)
      m[6][h] == null && (m[6][h] = h % 2 == 0);
  }, y = function() {
    const h = Hn.getPatternPosition(i);
    for (let p = 0; p < h.length; p += 1)
      for (let v = 0; v < h.length; v += 1) {
        const S = h[p], M = h[v];
        if (m[S][M] == null)
          for (let H = -2; H <= 2; H += 1)
            for (let J = -2; J <= 2; J += 1)
              H == -2 || H == 2 || J == -2 || J == 2 || H == 0 && J == 0 ? m[S + H][M + J] = !0 : m[S + H][M + J] = !1;
      }
  }, z = function(h) {
    const p = Hn.getBCHTypeNumber(i);
    for (let v = 0; v < 18; v += 1) {
      const S = !h && (p >> v & 1) == 1;
      m[Math.floor(v / 3)][v % 3 + f - 8 - 3] = S;
    }
    for (let v = 0; v < 18; v += 1) {
      const S = !h && (p >> v & 1) == 1;
      m[v % 3 + f - 8 - 3][Math.floor(v / 3)] = S;
    }
  }, R = function(h, p) {
    const v = d << 3 | p, S = Hn.getBCHTypeInfo(v);
    for (let M = 0; M < 15; M += 1) {
      const H = !h && (S >> M & 1) == 1;
      M < 6 ? m[M][8] = H : M < 8 ? m[M + 1][8] = H : m[f - 15 + M][8] = H;
    }
    for (let M = 0; M < 15; M += 1) {
      const H = !h && (S >> M & 1) == 1;
      M < 8 ? m[8][f - M - 1] = H : M < 9 ? m[8][15 - M - 1 + 1] = H : m[8][15 - M - 1] = H;
    }
    m[f - 8][8] = !h;
  }, D = function(h, p) {
    let v = -1, S = f - 1, M = 7, H = 0;
    const J = Hn.getMaskFunction(p);
    for (let $ = f - 1; $ > 0; $ -= 2)
      for ($ == 6 && ($ -= 1); ; ) {
        for (let tt = 0; tt < 2; tt += 1)
          if (m[S][$ - tt] == null) {
            let Q = !1;
            H < h.length && (Q = (h[H] >>> M & 1) == 1), J(S, $ - tt) && (Q = !Q), m[S][$ - tt] = Q, M -= 1, M == -1 && (H += 1, M = 7);
          }
        if (S += v, S < 0 || f <= S) {
          S -= v, v = -v;
          break;
        }
      }
  }, A = function(h, p) {
    let v = 0, S = 0, M = 0;
    const H = new Array(p.length), J = new Array(p.length);
    for (let L = 0; L < p.length; L += 1) {
      const I = p[L].dataCount, G = p[L].totalCount - I;
      S = Math.max(S, I), M = Math.max(M, G), H[L] = new Array(I);
      for (let et = 0; et < H[L].length; et += 1)
        H[L][et] = 255 & h.getBuffer()[et + v];
      v += I;
      const K = Hn.getErrorCorrectPolynomial(G), V = kl(H[L], K.getLength() - 1).mod(K);
      J[L] = new Array(K.getLength() - 1);
      for (let et = 0; et < J[L].length; et += 1) {
        const it = et + V.getLength() - J[L].length;
        J[L][et] = it >= 0 ? V.getAt(it) : 0;
      }
    }
    let $ = 0;
    for (let L = 0; L < p.length; L += 1)
      $ += p[L].totalCount;
    const tt = new Array($);
    let Q = 0;
    for (let L = 0; L < S; L += 1)
      for (let I = 0; I < p.length; I += 1)
        L < H[I].length && (tt[Q] = H[I][L], Q += 1);
    for (let L = 0; L < M; L += 1)
      for (let I = 0; I < p.length; I += 1)
        L < J[I].length && (tt[Q] = J[I][L], Q += 1);
    return tt;
  }, X = function(h, p, v) {
    const S = sf.getRSBlocks(h, p), M = cf();
    for (let J = 0; J < v.length; J += 1) {
      const $ = v[J];
      M.put($.getMode(), 4), M.put($.getLength(), Hn.getLengthInBits($.getMode(), h)), $.write(M);
    }
    let H = 0;
    for (let J = 0; J < S.length; J += 1)
      H += S[J].dataCount;
    if (M.getLengthInBits() > H * 8)
      throw "code length overflow. (" + M.getLengthInBits() + ">" + H * 8 + ")";
    for (M.getLengthInBits() + 4 <= H * 8 && M.put(0, 4); M.getLengthInBits() % 8 != 0; )
      M.putBit(!1);
    for (; !(M.getLengthInBits() >= H * 8 || (M.put(236, 8), M.getLengthInBits() >= H * 8)); )
      M.put(17, 8);
    return A(M, S);
  };
  E.addData = function(h, p) {
    p = p || "Byte";
    let v = null;
    switch (p) {
      case "Numeric":
        v = pv(h);
        break;
      case "Alphanumeric":
        v = hv(h);
        break;
      case "Byte":
        v = gv(h);
        break;
      case "Kanji":
        v = bv(h);
        break;
      default:
        throw "mode:" + p;
    }
    x.push(v), b = null;
  }, E.isDark = function(h, p) {
    if (h < 0 || f <= h || p < 0 || f <= p)
      throw h + "," + p;
    return m[h][p];
  }, E.getModuleCount = function() {
    return f;
  }, E.make = function() {
    if (i < 1) {
      let h = 1;
      for (; h < 40; h++) {
        const p = sf.getRSBlocks(h, d), v = cf();
        for (let M = 0; M < x.length; M++) {
          const H = x[M];
          v.put(H.getMode(), 4), v.put(H.getLength(), Hn.getLengthInBits(H.getMode(), h)), H.write(v);
        }
        let S = 0;
        for (let M = 0; M < p.length; M++)
          S += p[M].dataCount;
        if (v.getLengthInBits() <= S * 8)
          break;
      }
      i = h;
    }
    k(!1, N());
  }, E.createTableTag = function(h, p) {
    h = h || 2, p = typeof p > "u" ? h * 4 : p;
    let v = "";
    v += '<table style="', v += " border-width: 0px; border-style: none;", v += " border-collapse: collapse;", v += " padding: 0px; margin: " + p + "px;", v += '">', v += "<tbody>";
    for (let S = 0; S < E.getModuleCount(); S += 1) {
      v += "<tr>";
      for (let M = 0; M < E.getModuleCount(); M += 1)
        v += '<td style="', v += " border-width: 0px; border-style: none;", v += " border-collapse: collapse;", v += " padding: 0px; margin: 0px;", v += " width: " + h + "px;", v += " height: " + h + "px;", v += " background-color: ", v += E.isDark(S, M) ? "#000000" : "#ffffff", v += ";", v += '"/>';
      v += "</tr>";
    }
    return v += "</tbody>", v += "</table>", v;
  }, E.createSvgTag = function(h, p, v, S) {
    let M = {};
    typeof arguments[0] == "object" && (M = arguments[0], h = M.cellSize, p = M.margin, v = M.alt, S = M.title), h = h || 2, p = typeof p > "u" ? h * 4 : p, v = typeof v == "string" ? { text: v } : v || {}, v.text = v.text || null, v.id = v.text ? v.id || "qrcode-description" : null, S = typeof S == "string" ? { text: S } : S || {}, S.text = S.text || null, S.id = S.text ? S.id || "qrcode-title" : null;
    const H = E.getModuleCount() * h + p * 2;
    let J, $, tt, Q, L = "", I;
    for (I = "l" + h + ",0 0," + h + " -" + h + ",0 0,-" + h + "z ", L += '<svg version="1.1" xmlns="http://www.w3.org/2000/svg"', L += M.scalable ? "" : ' width="' + H + 'px" height="' + H + 'px"', L += ' viewBox="0 0 ' + H + " " + H + '" ', L += ' preserveAspectRatio="xMinYMin meet"', L += S.text || v.text ? ' role="img" aria-labelledby="' + q([S.id, v.id].join(" ").trim()) + '"' : "", L += ">", L += S.text ? '<title id="' + q(S.id) + '">' + q(S.text) + "</title>" : "", L += v.text ? '<description id="' + q(v.id) + '">' + q(v.text) + "</description>" : "", L += '<rect width="100%" height="100%" fill="white" cx="0" cy="0"/>', L += '<path d="', tt = 0; tt < E.getModuleCount(); tt += 1)
      for (Q = tt * h + p, J = 0; J < E.getModuleCount(); J += 1)
        E.isDark(tt, J) && ($ = J * h + p, L += "M" + $ + "," + Q + I);
    return L += '" stroke="transparent" fill="black"/>', L += "</svg>", L;
  }, E.createDataURL = function(h, p) {
    h = h || 2, p = typeof p > "u" ? h * 4 : p;
    const v = E.getModuleCount() * h + p * 2, S = p, M = v - p;
    return wv(v, v, function(H, J) {
      if (S <= H && H < M && S <= J && J < M) {
        const $ = Math.floor((H - S) / h), tt = Math.floor((J - S) / h);
        return E.isDark(tt, $) ? 0 : 1;
      } else
        return 1;
    });
  }, E.createImgTag = function(h, p, v) {
    h = h || 2, p = typeof p > "u" ? h * 4 : p;
    const S = E.getModuleCount() * h + p * 2;
    let M = "";
    return M += "<img", M += ' src="', M += E.createDataURL(h, p), M += '"', M += ' width="', M += S, M += '"', M += ' height="', M += S, M += '"', v && (M += ' alt="', M += q(v), M += '"'), M += "/>", M;
  };
  const q = function(h) {
    let p = "";
    for (let v = 0; v < h.length; v += 1) {
      const S = h.charAt(v);
      switch (S) {
        case "<":
          p += "&lt;";
          break;
        case ">":
          p += "&gt;";
          break;
        case "&":
          p += "&amp;";
          break;
        case '"':
          p += "&quot;";
          break;
        default:
          p += S;
          break;
      }
    }
    return p;
  }, O = function(h) {
    h = typeof h > "u" ? 2 : h;
    const v = E.getModuleCount() * 1 + h * 2, S = h, M = v - h;
    let H, J, $, tt, Q;
    const L = {
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
    for (H = 0; H < v; H += 2) {
      for ($ = Math.floor((H - S) / 1), tt = Math.floor((H + 1 - S) / 1), J = 0; J < v; J += 1)
        Q = "█", S <= J && J < M && S <= H && H < M && E.isDark($, Math.floor((J - S) / 1)) && (Q = " "), S <= J && J < M && S <= H + 1 && H + 1 < M && E.isDark(tt, Math.floor((J - S) / 1)) ? Q += " " : Q += "█", G += h < 1 && H + 1 >= M ? I[Q] : L[Q];
      G += `
`;
    }
    return v % 2 && h > 0 ? G.substring(0, G.length - v - 1) + Array(v + 1).join("▀") : G.substring(0, G.length - 1);
  };
  return E.createASCII = function(h, p) {
    if (h = h || 1, h < 2)
      return O(p);
    h -= 1, p = typeof p > "u" ? h * 2 : p;
    const v = E.getModuleCount() * h + p * 2, S = p, M = v - p;
    let H, J, $, tt;
    const Q = Array(h + 1).join("██"), L = Array(h + 1).join("  ");
    let I = "", G = "";
    for (H = 0; H < v; H += 1) {
      for ($ = Math.floor((H - S) / h), G = "", J = 0; J < v; J += 1)
        tt = 1, S <= J && J < M && S <= H && H < M && E.isDark($, Math.floor((J - S) / h)) && (tt = 0), G += tt ? Q : L;
      for ($ = 0; $ < h; $ += 1)
        I += G + `
`;
    }
    return I.substring(0, I.length - 1);
  }, E.renderTo2dContext = function(h, p) {
    p = p || 2;
    const v = E.getModuleCount();
    for (let S = 0; S < v; S++)
      for (let M = 0; M < v; M++)
        h.fillStyle = E.isDark(S, M) ? "black" : "white", h.fillRect(M * p, S * p, p, p);
  }, E;
};
Ya.stringToBytes = function(a) {
  const l = [];
  for (let s = 0; s < a.length; s += 1) {
    const o = a.charCodeAt(s);
    l.push(o & 255);
  }
  return l;
};
Ya.createStringToBytes = function(a, l) {
  const s = (function() {
    const i = yv(a), d = function() {
      const b = i.read();
      if (b == -1) throw "eof";
      return b;
    };
    let m = 0;
    const f = {};
    for (; ; ) {
      const b = i.read();
      if (b == -1) break;
      const x = d(), E = d(), k = d(), w = String.fromCharCode(b << 8 | x), N = E << 8 | k;
      f[w] = N, m += 1;
    }
    if (m != l)
      throw m + " != " + l;
    return f;
  })(), o = 63;
  return function(i) {
    const d = [];
    for (let m = 0; m < i.length; m += 1) {
      const f = i.charCodeAt(m);
      if (f < 128)
        d.push(f);
      else {
        const b = s[i.charAt(m)];
        typeof b == "number" ? (b & 255) == b ? d.push(b) : (d.push(b >>> 8), d.push(b & 255)) : d.push(o);
      }
    }
    return d;
  };
};
const se = {
  MODE_NUMBER: 1,
  MODE_ALPHA_NUM: 2,
  MODE_8BIT_BYTE: 4,
  MODE_KANJI: 8
}, xl = {
  L: 1,
  M: 0,
  Q: 3,
  H: 2
}, Dn = {
  PATTERN000: 0,
  PATTERN001: 1,
  PATTERN010: 2,
  PATTERN011: 3,
  PATTERN100: 4,
  PATTERN101: 5,
  PATTERN110: 6,
  PATTERN111: 7
}, Hn = (function() {
  const a = [
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
  ], l = 1335, s = 7973, o = 21522, i = {}, d = function(m) {
    let f = 0;
    for (; m != 0; )
      f += 1, m >>>= 1;
    return f;
  };
  return i.getBCHTypeInfo = function(m) {
    let f = m << 10;
    for (; d(f) - d(l) >= 0; )
      f ^= l << d(f) - d(l);
    return (m << 10 | f) ^ o;
  }, i.getBCHTypeNumber = function(m) {
    let f = m << 12;
    for (; d(f) - d(s) >= 0; )
      f ^= s << d(f) - d(s);
    return m << 12 | f;
  }, i.getPatternPosition = function(m) {
    return a[m - 1];
  }, i.getMaskFunction = function(m) {
    switch (m) {
      case Dn.PATTERN000:
        return function(f, b) {
          return (f + b) % 2 == 0;
        };
      case Dn.PATTERN001:
        return function(f, b) {
          return f % 2 == 0;
        };
      case Dn.PATTERN010:
        return function(f, b) {
          return b % 3 == 0;
        };
      case Dn.PATTERN011:
        return function(f, b) {
          return (f + b) % 3 == 0;
        };
      case Dn.PATTERN100:
        return function(f, b) {
          return (Math.floor(f / 2) + Math.floor(b / 3)) % 2 == 0;
        };
      case Dn.PATTERN101:
        return function(f, b) {
          return f * b % 2 + f * b % 3 == 0;
        };
      case Dn.PATTERN110:
        return function(f, b) {
          return (f * b % 2 + f * b % 3) % 2 == 0;
        };
      case Dn.PATTERN111:
        return function(f, b) {
          return (f * b % 3 + (f + b) % 2) % 2 == 0;
        };
      default:
        throw "bad maskPattern:" + m;
    }
  }, i.getErrorCorrectPolynomial = function(m) {
    let f = kl([1], 0);
    for (let b = 0; b < m; b += 1)
      f = f.multiply(kl([1, Bn.gexp(b)], 0));
    return f;
  }, i.getLengthInBits = function(m, f) {
    if (1 <= f && f < 10)
      switch (m) {
        case se.MODE_NUMBER:
          return 10;
        case se.MODE_ALPHA_NUM:
          return 9;
        case se.MODE_8BIT_BYTE:
          return 8;
        case se.MODE_KANJI:
          return 8;
        default:
          throw "mode:" + m;
      }
    else if (f < 27)
      switch (m) {
        case se.MODE_NUMBER:
          return 12;
        case se.MODE_ALPHA_NUM:
          return 11;
        case se.MODE_8BIT_BYTE:
          return 16;
        case se.MODE_KANJI:
          return 10;
        default:
          throw "mode:" + m;
      }
    else if (f < 41)
      switch (m) {
        case se.MODE_NUMBER:
          return 14;
        case se.MODE_ALPHA_NUM:
          return 13;
        case se.MODE_8BIT_BYTE:
          return 16;
        case se.MODE_KANJI:
          return 12;
        default:
          throw "mode:" + m;
      }
    else
      throw "type:" + f;
  }, i.getLostPoint = function(m) {
    const f = m.getModuleCount();
    let b = 0;
    for (let k = 0; k < f; k += 1)
      for (let w = 0; w < f; w += 1) {
        let N = 0;
        const _ = m.isDark(k, w);
        for (let y = -1; y <= 1; y += 1)
          if (!(k + y < 0 || f <= k + y))
            for (let z = -1; z <= 1; z += 1)
              w + z < 0 || f <= w + z || y == 0 && z == 0 || _ == m.isDark(k + y, w + z) && (N += 1);
        N > 5 && (b += 3 + N - 5);
      }
    for (let k = 0; k < f - 1; k += 1)
      for (let w = 0; w < f - 1; w += 1) {
        let N = 0;
        m.isDark(k, w) && (N += 1), m.isDark(k + 1, w) && (N += 1), m.isDark(k, w + 1) && (N += 1), m.isDark(k + 1, w + 1) && (N += 1), (N == 0 || N == 4) && (b += 3);
      }
    for (let k = 0; k < f; k += 1)
      for (let w = 0; w < f - 6; w += 1)
        m.isDark(k, w) && !m.isDark(k, w + 1) && m.isDark(k, w + 2) && m.isDark(k, w + 3) && m.isDark(k, w + 4) && !m.isDark(k, w + 5) && m.isDark(k, w + 6) && (b += 40);
    for (let k = 0; k < f; k += 1)
      for (let w = 0; w < f - 6; w += 1)
        m.isDark(w, k) && !m.isDark(w + 1, k) && m.isDark(w + 2, k) && m.isDark(w + 3, k) && m.isDark(w + 4, k) && !m.isDark(w + 5, k) && m.isDark(w + 6, k) && (b += 40);
    let x = 0;
    for (let k = 0; k < f; k += 1)
      for (let w = 0; w < f; w += 1)
        m.isDark(w, k) && (x += 1);
    const E = Math.abs(100 * x / f / f - 50) / 5;
    return b += E * 10, b;
  }, i;
})(), Bn = (function() {
  const a = new Array(256), l = new Array(256);
  for (let o = 0; o < 8; o += 1)
    a[o] = 1 << o;
  for (let o = 8; o < 256; o += 1)
    a[o] = a[o - 4] ^ a[o - 5] ^ a[o - 6] ^ a[o - 8];
  for (let o = 0; o < 255; o += 1)
    l[a[o]] = o;
  const s = {};
  return s.glog = function(o) {
    if (o < 1)
      throw "glog(" + o + ")";
    return l[o];
  }, s.gexp = function(o) {
    for (; o < 0; )
      o += 255;
    for (; o >= 256; )
      o -= 255;
    return a[o];
  }, s;
})(), kl = function(a, l) {
  if (typeof a.length > "u")
    throw a.length + "/" + l;
  const s = (function() {
    let i = 0;
    for (; i < a.length && a[i] == 0; )
      i += 1;
    const d = new Array(a.length - i + l);
    for (let m = 0; m < a.length - i; m += 1)
      d[m] = a[m + i];
    return d;
  })(), o = {};
  return o.getAt = function(i) {
    return s[i];
  }, o.getLength = function() {
    return s.length;
  }, o.multiply = function(i) {
    const d = new Array(o.getLength() + i.getLength() - 1);
    for (let m = 0; m < o.getLength(); m += 1)
      for (let f = 0; f < i.getLength(); f += 1)
        d[m + f] ^= Bn.gexp(Bn.glog(o.getAt(m)) + Bn.glog(i.getAt(f)));
    return kl(d, 0);
  }, o.mod = function(i) {
    if (o.getLength() - i.getLength() < 0)
      return o;
    const d = Bn.glog(o.getAt(0)) - Bn.glog(i.getAt(0)), m = new Array(o.getLength());
    for (let f = 0; f < o.getLength(); f += 1)
      m[f] = o.getAt(f);
    for (let f = 0; f < i.getLength(); f += 1)
      m[f] ^= Bn.gexp(Bn.glog(i.getAt(f)) + d);
    return kl(m, 0).mod(i);
  }, o;
}, sf = (function() {
  const a = [
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
  ], l = function(i, d) {
    const m = {};
    return m.totalCount = i, m.dataCount = d, m;
  }, s = {}, o = function(i, d) {
    switch (d) {
      case xl.L:
        return a[(i - 1) * 4 + 0];
      case xl.M:
        return a[(i - 1) * 4 + 1];
      case xl.Q:
        return a[(i - 1) * 4 + 2];
      case xl.H:
        return a[(i - 1) * 4 + 3];
      default:
        return;
    }
  };
  return s.getRSBlocks = function(i, d) {
    const m = o(i, d);
    if (typeof m > "u")
      throw "bad rs block @ typeNumber:" + i + "/errorCorrectionLevel:" + d;
    const f = m.length / 3, b = [];
    for (let x = 0; x < f; x += 1) {
      const E = m[x * 3 + 0], k = m[x * 3 + 1], w = m[x * 3 + 2];
      for (let N = 0; N < E; N += 1)
        b.push(l(k, w));
    }
    return b;
  }, s;
})(), cf = function() {
  const a = [];
  let l = 0;
  const s = {};
  return s.getBuffer = function() {
    return a;
  }, s.getAt = function(o) {
    const i = Math.floor(o / 8);
    return (a[i] >>> 7 - o % 8 & 1) == 1;
  }, s.put = function(o, i) {
    for (let d = 0; d < i; d += 1)
      s.putBit((o >>> i - d - 1 & 1) == 1);
  }, s.getLengthInBits = function() {
    return l;
  }, s.putBit = function(o) {
    const i = Math.floor(l / 8);
    a.length <= i && a.push(0), o && (a[i] |= 128 >>> l % 8), l += 1;
  }, s;
}, pv = function(a) {
  const l = se.MODE_NUMBER, s = a, o = {};
  o.getMode = function() {
    return l;
  }, o.getLength = function(m) {
    return s.length;
  }, o.write = function(m) {
    const f = s;
    let b = 0;
    for (; b + 2 < f.length; )
      m.put(i(f.substring(b, b + 3)), 10), b += 3;
    b < f.length && (f.length - b == 1 ? m.put(i(f.substring(b, b + 1)), 4) : f.length - b == 2 && m.put(i(f.substring(b, b + 2)), 7));
  };
  const i = function(m) {
    let f = 0;
    for (let b = 0; b < m.length; b += 1)
      f = f * 10 + d(m.charAt(b));
    return f;
  }, d = function(m) {
    if ("0" <= m && m <= "9")
      return m.charCodeAt(0) - 48;
    throw "illegal char :" + m;
  };
  return o;
}, hv = function(a) {
  const l = se.MODE_ALPHA_NUM, s = a, o = {};
  o.getMode = function() {
    return l;
  }, o.getLength = function(d) {
    return s.length;
  }, o.write = function(d) {
    const m = s;
    let f = 0;
    for (; f + 1 < m.length; )
      d.put(
        i(m.charAt(f)) * 45 + i(m.charAt(f + 1)),
        11
      ), f += 2;
    f < m.length && d.put(i(m.charAt(f)), 6);
  };
  const i = function(d) {
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
}, gv = function(a) {
  const l = se.MODE_8BIT_BYTE, s = Ya.stringToBytes(a), o = {};
  return o.getMode = function() {
    return l;
  }, o.getLength = function(i) {
    return s.length;
  }, o.write = function(i) {
    for (let d = 0; d < s.length; d += 1)
      i.put(s[d], 8);
  }, o;
}, bv = function(a) {
  const l = se.MODE_KANJI, s = Ya.stringToBytes;
  (function(d, m) {
    const f = s(d);
    if (f.length != 2 || (f[0] << 8 | f[1]) != m)
      throw "sjis not supported.";
  })("友", 38726);
  const o = s(a), i = {};
  return i.getMode = function() {
    return l;
  }, i.getLength = function(d) {
    return ~~(o.length / 2);
  }, i.write = function(d) {
    const m = o;
    let f = 0;
    for (; f + 1 < m.length; ) {
      let b = (255 & m[f]) << 8 | 255 & m[f + 1];
      if (33088 <= b && b <= 40956)
        b -= 33088;
      else if (57408 <= b && b <= 60351)
        b -= 49472;
      else
        throw "illegal char at " + (f + 1) + "/" + b;
      b = (b >>> 8 & 255) * 192 + (b & 255), d.put(b, 13), f += 2;
    }
    if (f < m.length)
      throw "illegal char at " + (f + 1);
  }, i;
}, um = function() {
  const a = [], l = {};
  return l.writeByte = function(s) {
    a.push(s & 255);
  }, l.writeShort = function(s) {
    l.writeByte(s), l.writeByte(s >>> 8);
  }, l.writeBytes = function(s, o, i) {
    o = o || 0, i = i || s.length;
    for (let d = 0; d < i; d += 1)
      l.writeByte(s[d + o]);
  }, l.writeString = function(s) {
    for (let o = 0; o < s.length; o += 1)
      l.writeByte(s.charCodeAt(o));
  }, l.toByteArray = function() {
    return a;
  }, l.toString = function() {
    let s = "";
    s += "[";
    for (let o = 0; o < a.length; o += 1)
      o > 0 && (s += ","), s += a[o];
    return s += "]", s;
  }, l;
}, vv = function() {
  let a = 0, l = 0, s = 0, o = "";
  const i = {}, d = function(f) {
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
  return i.writeByte = function(f) {
    for (a = a << 8 | f & 255, l += 8, s += 1; l >= 6; )
      d(a >>> l - 6), l -= 6;
  }, i.flush = function() {
    if (l > 0 && (d(a << 6 - l), a = 0, l = 0), s % 3 != 0) {
      const f = 3 - s % 3;
      for (let b = 0; b < f; b += 1)
        o += "=";
    }
  }, i.toString = function() {
    return o;
  }, i;
}, yv = function(a) {
  const l = a;
  let s = 0, o = 0, i = 0;
  const d = {};
  d.read = function() {
    for (; i < 8; ) {
      if (s >= l.length) {
        if (i == 0)
          return -1;
        throw "unexpected end of file./" + i;
      }
      const b = l.charAt(s);
      if (s += 1, b == "=")
        return i = 0, -1;
      if (b.match(/^\s$/))
        continue;
      o = o << 6 | m(b.charCodeAt(0)), i += 6;
    }
    const f = o >>> i - 8 & 255;
    return i -= 8, f;
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
}, xv = function(a, l) {
  const s = a, o = l, i = new Array(a * l), d = {};
  d.setPixel = function(x, E, k) {
    i[E * s + x] = k;
  }, d.write = function(x) {
    x.writeString("GIF87a"), x.writeShort(s), x.writeShort(o), x.writeByte(128), x.writeByte(0), x.writeByte(0), x.writeByte(0), x.writeByte(0), x.writeByte(0), x.writeByte(255), x.writeByte(255), x.writeByte(255), x.writeString(","), x.writeShort(0), x.writeShort(0), x.writeShort(s), x.writeShort(o), x.writeByte(0);
    const E = 2, k = f(E);
    x.writeByte(E);
    let w = 0;
    for (; k.length - w > 255; )
      x.writeByte(255), x.writeBytes(k, w, 255), w += 255;
    x.writeByte(k.length - w), x.writeBytes(k, w, k.length - w), x.writeByte(0), x.writeString(";");
  };
  const m = function(x) {
    const E = x;
    let k = 0, w = 0;
    const N = {};
    return N.write = function(_, y) {
      if (_ >>> y)
        throw "length over";
      for (; k + y >= 8; )
        E.writeByte(255 & (_ << k | w)), y -= 8 - k, _ >>>= 8 - k, w = 0, k = 0;
      w = _ << k | w, k = k + y;
    }, N.flush = function() {
      k > 0 && E.writeByte(w);
    }, N;
  }, f = function(x) {
    const E = 1 << x, k = (1 << x) + 1;
    let w = x + 1;
    const N = b();
    for (let D = 0; D < E; D += 1)
      N.add(String.fromCharCode(D));
    N.add(String.fromCharCode(E)), N.add(String.fromCharCode(k));
    const _ = um(), y = m(_);
    y.write(E, w);
    let z = 0, R = String.fromCharCode(i[z]);
    for (z += 1; z < i.length; ) {
      const D = String.fromCharCode(i[z]);
      z += 1, N.contains(R + D) ? R = R + D : (y.write(N.indexOf(R), w), N.size() < 4095 && (N.size() == 1 << w && (w += 1), N.add(R + D)), R = D);
    }
    return y.write(N.indexOf(R), w), y.write(k, w), y.flush(), _.toByteArray();
  }, b = function() {
    const x = {};
    let E = 0;
    const k = {};
    return k.add = function(w) {
      if (k.contains(w))
        throw "dup key:" + w;
      x[w] = E, E += 1;
    }, k.size = function() {
      return E;
    }, k.indexOf = function(w) {
      return x[w];
    }, k.contains = function(w) {
      return typeof x[w] < "u";
    }, k;
  };
  return d;
}, wv = function(a, l, s) {
  const o = xv(a, l);
  for (let f = 0; f < l; f += 1)
    for (let b = 0; b < a; b += 1)
      o.setPixel(b, f, s(b, f));
  const i = um();
  o.write(i);
  const d = vv(), m = i.toByteArray();
  for (let f = 0; f < m.length; f += 1)
    d.writeByte(m[f]);
  return d.flush(), "data:image/gif;base64," + d;
};
Ya.stringToBytes;
function _v({ text: a }) {
  const { size: l, path: s } = dt.useMemo(() => {
    const o = Ya(0, "M");
    o.addData(a), o.make();
    const i = o.getModuleCount();
    let d = "";
    for (let m = 0; m < i; m++)
      for (let f = 0; f < i; f++) o.isDark(m, f) && (d += `M${f} ${m}h1v1h-1z`);
    return { size: i, path: d };
  }, [a]);
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
        /* @__PURE__ */ ft.jsx("path", { d: s, fill: "#000" })
      ]
    }
  );
}
const El = dt.createContext(""), us = (a, l) => typeof a == "string" && a.toLowerCase().includes(l);
function Sv({ title: a, children: l, testId: s, ariaLabel: o }) {
  const i = dt.useContext(El), d = i !== "" && us(a, i);
  return (
    // While searching, a group with no matching row (and no matching title) hides itself.
    /* @__PURE__ */ ft.jsxs("section", { className: i && !d ? "mb-8 not-has-[[data-setting-row]]:hidden" : "mb-8", "data-testid": s, "aria-label": o, children: [
      a && /* @__PURE__ */ ft.jsx("h3", { className: "m-0 mb-3 text-[0.9rem] font-medium text-fg", children: a }),
      /* @__PURE__ */ ft.jsx("div", { className: "rounded-ui bg-surface-0 px-4", children: /* @__PURE__ */ ft.jsx(El.Provider, { value: d ? "" : i, children: l }) })
    ] })
  );
}
function kv({ title: a, description: l, children: s, testId: o }) {
  const i = dt.useContext(El);
  return i && !us(a, i) && !us(l, i) ? null : /* @__PURE__ */ ft.jsxs("div", { "data-setting-row": !0, "data-testid": o, className: "flex items-center justify-between gap-6 py-[0.8rem] max-[700px]:flex-wrap max-[700px]:gap-y-2", children: [
    /* @__PURE__ */ ft.jsxs("div", { className: "min-w-0 max-[700px]:flex-1 max-[700px]:basis-56", children: [
      /* @__PURE__ */ ft.jsx("div", { className: "text-[0.85rem] text-fg", children: a }),
      l && /* @__PURE__ */ ft.jsx("div", { className: "mt-[0.15rem] text-[0.75rem] text-subtext-0", children: l })
    ] }),
    s && /* @__PURE__ */ ft.jsx("div", { className: "flex shrink-0 items-center gap-2", children: s })
  ] });
}
function Ev({ checked: a, onChange: l, testId: s, label: o }) {
  return /* @__PURE__ */ ft.jsx(
    "input",
    {
      type: "checkbox",
      role: "switch",
      "aria-label": o,
      "data-testid": s,
      checked: a,
      onChange: (i) => l(i.target.checked),
      className: "relative h-[1.25rem] w-[2.25rem] shrink-0 cursor-pointer appearance-none rounded-full bg-overlay-0 [transition:background_0.12s_ease] before:absolute before:top-[0.15rem] before:left-[0.15rem] before:h-[0.95rem] before:w-[0.95rem] before:rounded-full before:bg-fg before:content-[''] before:[transition:transform_0.12s_ease] checked:bg-accent checked:before:translate-x-[1rem] checked:before:bg-panel-bg focus-visible:[outline:2px_solid_var(--accent)] focus-visible:[outline-offset:2px]"
    }
  );
}
//! The Settings pages' shared parts for `@perch/sdk` 1.8 (`sdk.ts` re-exports and lists them). Each wraps the host
//! component or class string the pages are drawn with and owns no state. `SettingsGroup` and `SettingRow` are the
//! host's own, so the Settings search (`SettingsQuery`) filters a copy's rows exactly as it filters Perch's.
const zv = () => dt.useContext(El), Nv = {
  select: ws,
  selectHost: Lb,
  input: Zb,
  inputPort: Jb,
  inputWide: Wb,
  addRow: Fb,
  list: Ib,
  hostRow: $b,
  name: tv,
  addr: ev,
  muted: Vb,
  empty: Xb,
  primary: nv,
  danger: av,
  catalogToggle: Qb
};
//! State the host keeps for a resource rather than for one view of it (`useResourceState`, `@perch/sdk` 1.4): a
//! review's unsent commit message and comment, its pending batch and its operation id, keyed by the screen's
//! own name for the resource (`review:<workspace>:commit`). Every view and copy that names the same key shares the
//! value, and it outlives a reload or swap of the screen's code, a released hidden copy and the phone/desktop
//! layouts trading places. In memory: a page reload starts empty (durable drafts live in their own services).
const Tv = 512, We = /* @__PURE__ */ new Map(), wl = /* @__PURE__ */ new Map();
function dm(a, l) {
  We.delete(a), We.set(a, l);
  for (const s of We.keys()) {
    if (We.size <= Tv) break;
    wl.get(s)?.size || We.delete(s);
  }
}
function Cv(a, l) {
  return We.has(a) ? We.get(a) : l;
}
function Mv(a, l, s) {
  const o = Cv(a, s), i = typeof l == "function" ? l(o) : l;
  if (!(We.has(a) && Object.is(i, o))) {
    dm(a, i);
    for (const d of [...wl.get(a) ?? []]) d();
  }
}
function Av(a, l) {
  if (typeof a != "string" || !a) throw new Error("useResourceState needs a non-empty key.");
  We.has(a) || dm(a, l);
  const s = dt.useCallback((d) => {
    const m = wl.get(a) ?? /* @__PURE__ */ new Set();
    return wl.set(a, m), m.add(d), () => {
      m.delete(d), m.size || wl.delete(a);
    };
  }, [a]), o = dt.useSyncExternalStore(s, () => We.get(a)), i = dt.useCallback((d) => Mv(a, d, l), [a]);
  return [o, i];
}
const jv = "[--radius:var(--radius-pane)] rounded-soft bg-surface-1/70 shadow-[0_6px_20px_rgba(0,0,0,0.3)] backdrop-blur-xl backdrop-saturate-150", Ov = "hover:bg-transparent hover:text-subtext-0 active:bg-surface-1 active:text-fg";
//! `@perch/sdk` for the native client: the surface a stock screen imports (the navigation part, 1.3), with every
//! call going to one abstract host object, `globalThis.perch`, read when called (so a host or a test sets it before
//! mounting). Class helpers, icons, `cn`, `keyLabel` and the host dot are the app's own modules, compiled in, so the
//! classes are the web's to the character. Data hooks subscribe to `perch.subscribe` and read the host's snapshots
//! (`perch.navigation(options)`, `perch.hosts()`, ...), which must return the same object until the data changes.
//! Menus and dialogs Perch draws itself (session menu, new session menu, confirm, select, folder browser,
//! instructions, memory) open through `perch.openOverlay(kind, props)`; their callbacks are plain functions.
const Rv = "1.3.0";
let Hr = null;
const Dv = (a) => {
  Hr = a;
};
function Tt() {
  const a = (typeof Hr == "function" ? Hr() : Hr) ?? globalThis.perch;
  if (!a) throw new Error("@perch/sdk: no perch host (globalThis.perch) is set");
  return a;
}
const Hv = (a) => Tt().subscribe?.(a) ?? (() => {
}), Bv = iv;
function Uv() {
  return typeof globalThis.crypto?.randomUUID == "function" ? globalThis.crypto.randomUUID() : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (a) => {
    const l = Math.floor(Math.random() * 16);
    return (a === "x" ? l : l & 3 | 8).toString(16);
  });
}
const qv = globalThis.perch?.isMac !== !1, Yv = (a) => Nb(a, Tt().isMac !== !1), Gv = (a) => Cb(a), Kv = ({ className: a, ...l } = {}) => ce(Ab(l), a), Qv = Ob, Vv = (a) => Rb(a), Xv = Db, Lv = nm, Zv = em, Jv = (a) => ss[a].color, Wv = (a, l) => Tt().shortcutFor?.(a, l) ?? null, Fv = (a) => Tt().shortcutLabel?.(a) ?? null, Ir = (a, l) => Tt().command(a, l ?? {}) !== !1, Iv = (a, l, s) => Tt().startSession?.(a, l, s), Pv = globalThis.perch?.pickFolder ? (a) => Tt().pickFolder(a) : null;
function le(a) {
  const l = dt.useRef(a);
  return l.current = a, dt.useSyncExternalStore(Hv, () => l.current(Tt()));
}
const fm = (a = {}) => le((l) => l.navigation({ showTerminals: !!a.showTerminals, sortByAttention: !!a.sortByAttention })), $v = () => le((a) => a.hosts()), t1 = () => le((a) => a.sessionFolders());
function e1() {
  const a = le((l) => l.addProject?.() ?? n1);
  return {
    status: a.status ?? "idle",
    error: a.error,
    hostId: a.hostId,
    add: (l, s, o) => {
      l.trim() && a.status !== "pending" && Tt().addProjectFolder?.(l, s, o);
    },
    clear: () => Tt().clearAddProject?.()
  };
}
const n1 = Object.freeze({ status: "idle" }), mm = "perch.lastAgentChoice", a1 = Object.freeze({ connected: !1, discovery: !1, state: "ready", choices: [] }), l1 = () => {
  const a = Tt().storage?.getItem(mm);
  return a === "claude" || a === "codex" ? a : "claude";
}, r1 = Object.freeze({ items: [] });
function i1() {
  const a = le((l) => l.notifications?.() ?? r1);
  return dt.useMemo(() => ({
    items: a.items ?? [],
    open: (l) => Tt().command("notification.open", { id: l }),
    dismiss: (l) => Tt().command("notification.dismiss", { id: l })
  }), [a]);
}
function o1(a) {
  const l = le((i) => i.agentChoices?.(a) ?? a1), [s, o] = dt.useState(l1);
  return dt.useMemo(() => ({
    connected: !!l.connected,
    discovery: !!l.discovery,
    choices: l.choices ?? [],
    lastChoice: s,
    state: l.state ?? "ready",
    error: l.state === "error" ? l.error : void 0,
    rememberChoice: (i) => {
      i !== "claude" && i !== "codex" || (Tt().storage?.setItem(mm, i), o(i));
    },
    manage: () => Tt().command("agents.manage", {})
  }), [l, s]);
}
function s1(a) {
  Fe(() => Tt().onRequest?.("add-project", a) ?? void 0, [a]);
}
function c1(a) {
  const l = a.map((s) => ({ id: s.id, parentSessionId: s.parentId, session: s }));
  return rv(l).map((s) => ({ session: s.session, nested: cs(s, l) }));
}
function u1({ id: a, plain: l, className: s }) {
  const o = le((x) => x.session(a));
  if (!o) return null;
  const i = o.state ?? lv(o), d = ss[i]?.color ?? ss.unknown.color, m = o.provider, f = m === "claude" || m === "claude-agent-teams" || m === "omp", b = l ? ce("agent-mark", "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full leading-none", s) : ce("agent-status-dot", `agent-status-dot--${i}`, "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-[1.5px] bg-panel-bg leading-none", s);
  return dt.createElement(
    "span",
    { className: b, style: l ? void 0 : { borderColor: d }, "data-provider": m ?? "unknown", title: l ? m ?? "Agent" : `${m ?? "Agent"} · ${i}`, "aria-hidden": "true" },
    dt.createElement("span", { className: ce("inline-flex text-fg", f && "rounded-full bg-[#161616]") }, dt.createElement(pm, { provider: m, size: 14 }))
  );
}
function pm({ provider: a, size: l = 14 }) {
  const s = Tt().agentIcon?.(a, l) ?? null, o = s?.markup ?? '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><circle cx="8" cy="8" r="5" fill="currentColor"/></svg>';
  return dt.createElement("svg", { width: l, height: l, "aria-hidden": "true", "data-agent-icon": a ?? "unknown", "data-perch-markup": o, ...s && s.tint === !1 ? { "data-perch-image": "true" } : {} });
}
const d1 = ({ children: a }) => dt.createElement(dt.Fragment, null, a);
function f1(a, l) {
  const s = dt.useRef(l);
  return s.current = l, Fe(() => {
    const o = Tt();
    if (!o.openOverlay) throw new Error(`@perch/sdk: the host draws no overlays (perch.openOverlay), so ${a} cannot open`);
    const i = {};
    for (const [m, f] of Object.entries(s.current))
      i[m] = typeof f == "function" ? (...b) => s.current[m]?.(...b) : f;
    const d = o.openOverlay(a, i);
    return () => o.closeOverlay?.(d);
  }, [a]), null;
}
const da = (a) => function(s) {
  return f1(a, s);
}, m1 = da("session-menu"), p1 = da("new-session-menu"), h1 = da("confirm");
let hm = null;
const g1 = (a) => {
  hm = a;
};
function b1(a) {
  return dt.createElement(hm ?? h1, a);
}
function v1({ className: a = ws, ...l }) {
  return dt.createElement(Kb, { ...l, className: a });
}
let ds = null;
const y1 = (a) => {
  ds = a;
}, x1 = da("folder-browser");
function w1(a) {
  return ds ? dt.createElement(ds, { ...a, browse: (l) => Tt().browse(a.hostId, l) }) : dt.createElement(x1, a);
}
const _1 = da("instructions"), S1 = da("memory"), k1 = Yb;
let Ss = null;
const E1 = (a) => {
  Ss = a;
};
function z1(a) {
  if (Ss) return dt.createElement(T1, a);
  const { hostId: l, path: s, className: o } = a, i = dt.useRef(null);
  return dt.createElement(
    "button",
    {
      type: "button",
      ref: i,
      className: ce("worktree-menu__btn", em, o),
      "data-testid": `worktree-menu-${l}-${s}`,
      title: "New workspace (a git worktree)",
      "aria-label": "New workspace",
      "aria-expanded": !1,
      onClick: () => Tt().openOverlay?.("worktree", { hostId: l, cwd: s, anchor: i.current?.getBoundingClientRect() })
    },
    dt.createElement(lm, null)
  );
}
const gm = "Perch did not answer.";
function Rr(a) {
  return a ? a.type === "worktree.error" ? { error: a.message, dirty: !!a.dirty } : a.error ? { error: String(a.error) } : {} : { error: gm };
}
function N1(a, l, s = Tt()) {
  const o = (i) => {
    for (const d of i ?? []) {
      if (d.path === l) return d;
      const m = o(d.children);
      if (m) return m;
    }
    return null;
  };
  for (const i of s.navigation({})?.projects ?? []) {
    if (i.hostId !== a) continue;
    const d = o(i.workspaces) ?? o(i.hidden);
    if (d) return d;
  }
  return null;
}
const uf = 5 * 6e4;
function bm(a, l, s, o = Tt()) {
  const i = Date.now() + uf;
  let d = !1, m = () => {
  };
  const f = () => {
    d = !0, m(), clearTimeout(x);
  }, b = () => {
    if (!d) {
      if (Date.now() >= i) return f();
      N1(a, l, o) && (f(), o.startSession?.(a, l, s));
    }
  }, x = setTimeout(f, uf);
  m = o.subscribe?.(b) ?? (() => {
  }), b();
}
function T1({ hostId: a, path: l, className: s, worktrees: o, request: i, parentChoices: d, emptyAgent: m, ...f }) {
  const [b, x] = dt.useState(o), E = (S) => !!Tt().coreCan?.(S, a), k = fm(), w = `${a}:${l}`, N = dt.useMemo(() => {
    if (Array.isArray(d)) return d;
    if (!E("workspace.nest")) return [];
    const S = k?.projects?.find((J) => J.hostId === a && J.repoPath === l), M = [], H = (J, $) => {
      for (const tt of J ?? [])
        $ && M.push({ id: tt.id, name: tt.name, path: tt.path }), H(tt.children, !0);
    };
    return H(S?.workspaces, !1), M;
  }, [d, k, a, l]), _ = a === "local" && E("worktree.job"), y = f.deleteSupported ?? E("worktree.delete"), z = f.startFromSupported ?? E("worktree.startFrom"), R = le((S) => S.emptyWorkspaceAgent?.() ?? void 0), D = m ?? R ?? void 0, A = le((S) => S.worktreeMenuRequest?.() ?? null), X = A?.projectKey === w ? A.nonce : null, q = dt.useMemo(() => i ?? (X == null ? null : A), [i, X]), [O, h] = dt.useState(q);
  Fe(() => {
    q && h(q);
  }, [q]);
  const p = dt.useRef({});
  p.current = { background: _, deleteSupported: y };
  const v = dt.useMemo(() => {
    const S = (M, H) => Tt().ask(M, { hostId: a, repoPath: l, ...H });
    return {
      list: async () => {
        const M = await S("worktree.list", {});
        return M?.type === "worktree.list.result" && x({ worktrees: M.worktrees ?? [], defaultRoot: M.defaultRoot ?? "", baseRef: M.baseRef, refs: M.refs ?? [] }), Rr(M);
      },
      create: async ({ branch: M, newBranch: H, path: J, extra: $, agent: tt }) => {
        const Q = { branch: M, newBranch: !!H, path: J ?? null, name: $?.name ?? null, startFrom: $?.startFrom ?? null, parentWorkspaceId: $?.parentWorkspaceId ?? null }, { background: L } = p.current, I = await S(L ? "worktree.job.start" : "worktree.create", Q), G = L ? "worktree.job.started" : "worktree.done";
        if (I?.type !== G) return { error: Rr(I).error ?? gm };
        const K = L ? I.job?.path : I.path;
        return tt && K && bm(a, K, tt), { background: L };
      },
      remove: async (M, H) => {
        const J = await S("worktree.remove", { path: M, force: !!H, deleteBranch: p.current.deleteSupported });
        return { ...Rr(J), preservedBranch: J?.type === "worktree.done" ? J.preservedBranch ?? void 0 : void 0 };
      },
      deleteBranch: async (M, H) => Rr(await S("worktree.branch.delete", { branch: M, expectedHead: H })),
      open: (M) => Tt().startSession?.(a, M, "terminal"),
      // The window forgets the request; the screen keeps it until a newer one, as clearing it would re-run (and so
      // cancel) the screen's effect that a measurement put off until the next frame (`measured`).
      takeRequest: () => Tt().takeWorktreeRequest?.()
    };
  }, [a, l]);
  return dt.createElement(Ss, {
    hostId: a,
    cwd: l,
    projectKey: w,
    className: s,
    worktrees: b,
    background: _,
    startFromSupported: z,
    deleteSupported: y,
    parentChoices: N,
    emptyAgent: D,
    request: O,
    actions: v
  });
}
const C1 = (a, l) => {
  if (!Tt().followPointer?.(a)) return;
  const s = l.items();
  for (const o of s) o.getBoundingClientRect();
  s[0]?.parentElement?.getBoundingClientRect(), Sb(a, l);
}, M1 = () => le((a) => a.workspaceTabs()), A1 = () => le((a) => a.statusLine()), j1 = () => le((a) => a.zoom()), O1 = () => le((a) => a.paneLook()), R1 = () => le((a) => a.keybindings?.() ?? []), D1 = Object.freeze({ usage: Object.freeze([]), updatedAt: 0, spend: null, redeemResult: null });
function H1(a) {
  const l = !!a?.keepFresh, s = le((i) => i.statusLine?.().connected ?? !1), o = le((i) => i.planUsage?.() ?? D1);
  return Fe(() => {
    if (!l || !s) return;
    let i;
    const d = () => {
      Tt().command("usage.get"), i = setTimeout(d, 18e4);
    };
    return d(), () => clearTimeout(i);
  }, [l, s]), o;
}
const B1 = () => Tt().command("usage.get", { force: !0 }), U1 = (a) => Tt().command("usage.redeemReset", { accountId: a }), q1 = () => Ir("app.zoom_reset"), Y1 = {
  focused: "bg-[color-mix(in_srgb,var(--text)_10%,var(--panel-bg))] hover:bg-[color-mix(in_srgb,var(--text)_10%,var(--panel-bg))] text-fg font-semibold",
  visible: "bg-transparent text-subtext-0 hover:bg-surface-0 hover:text-fg",
  hidden: "bg-transparent text-subtext-0 hover:bg-surface-0 hover:text-fg"
}, G1 = (a, l, s) => Tt().beginTabDrag?.(a, l, s);
function K1(a) {
  Fe(() => Tt().onRequest?.("new-tab", a) ?? void 0, [a]);
}
const Q1 = (a) => Ir("browser.open", { workspaceId: a }), V1 = (a, l) => Ir("file.open", { workspaceId: a, path: l }), X1 = () => null, L1 = () => null, Z1 = da("new-file"), oy = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  AgentIcon: pm,
  Chevron: om,
  CloseIcon: Ub,
  ConfirmDialog: b1,
  Dialog: k1,
  EllipsisIcon: Hb,
  FolderBrowser: w1,
  GearIcon: Bb,
  HostStateDot: qb,
  InstructionsDialog: _1,
  MemoryDialog: S1,
  ModeSwitch: mv,
  NewFilePrompt: Z1,
  NewSessionMenu: p1,
  PageIcon: ov,
  PlusIcon: lm,
  QrCode: _v,
  Select: v1,
  SessionDot: u1,
  SessionMenu: m1,
  SettingRow: kv,
  SettingsGroup: Sv,
  SettingsQuery: El,
  Slot: d1,
  Switch: Ev,
  TabDragLayer: L1,
  TabMenu: X1,
  WorktreeMenu: z1,
  agentStateColor: Jv,
  anchoredPopoverStyle: Bv,
  beginReorderDrag: C1,
  beginTabDrag: G1,
  bindHost: Dv,
  buttonClass: Qv,
  cn: ce,
  drawConfirmationsInPlace: g1,
  drawFolderBrowserInPlace: y1,
  drawWorktreeInPlace: E1,
  ghostButton: Lv,
  glassClass: jv,
  iconButton: Zv,
  isMac: qv,
  keyLabel: Yv,
  menuDividerClass: Xv,
  menuItemClass: Vv,
  menuPanel: am,
  nestSessions: c1,
  newId: Uv,
  openBrowserTab: Q1,
  openFileTab: V1,
  pickFolder: Pv,
  redeemUsageReset: U1,
  refreshUsage: B1,
  resetZoom: q1,
  rowActionClass: Kv,
  runCommand: Ir,
  segmentClass: Gv,
  settingsClass: Nv,
  shortcutFor: Wv,
  shortcutLabel: Fv,
  startPaneWhenReady: bm,
  startSession: Iv,
  tabStateClass: Y1,
  tapButtonClass: Ov,
  useAddProject: e1,
  useAddProjectRequest: s1,
  useAgentChoices: o1,
  useDismissOnOutsideClick: sm,
  useHostSnapshot: le,
  useHosts: $v,
  useKeybindings: R1,
  useNavigation: fm,
  useNewTabRequest: K1,
  useNotifications: i1,
  usePaneLook: O1,
  usePlanUsage: H1,
  useResourceState: Av,
  useSessionFolders: t1,
  useSettingsQuery: zv,
  useStatusLine: A1,
  useWorkspaceTabs: M1,
  useZoom: j1,
  version: Rv
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
//! `kit` is `{ div, image }` from `gpui-kit`; `files.icon(id, markup, color)` gives the element that draws an icon's
//! markup (`currentColor` as `color`; the mod's `perch-react` `Icon`), as gpui-kit's `svg()` and `image()` read
//! files through an asset source the host may not have. An icon is drawn once per colour it is described with; one
//! under a node whose own `hover:` changes the text colour is drawn twice, the hover copy shown by the engine while the
//! pointer is over that node (a hover group), so a hover never calls back into the script.
const ks = {
  display: (a, l) => l === "hidden" ? a.hidden() : l === "flex" ? a.flex() : a.block(),
  flex_direction: (a, l) => a[{ row: "flex_row", col: "flex_col", row_reverse: "flex_row_reverse", col_reverse: "flex_col_reverse" }[l]](),
  flex_wrap: (a, l) => l === "wrap" ? a.flex_wrap() : a.flex_nowrap(),
  items: (a, l) => a[`items_${l}`](),
  justify: (a, l) => a[`justify_${l}`](),
  self: (a, l) => l === "auto" ? a : a[`self_${l}`](),
  flex_grow: (a, l) => a.flex_grow(l),
  flex_shrink: (a, l) => a.flex_shrink(l),
  flex_basis: (a, l) => a.flex_basis(l),
  position: (a, l) => l === "absolute" ? a.absolute() : a.relative(),
  overflow_x: (a, l) => l === "hidden" ? a.overflow_x_hidden() : l === "scroll" ? a.overflow_x_scroll() : a,
  overflow_y: (a, l) => l === "hidden" ? a.overflow_y_hidden() : l === "scroll" ? a.overflow_y_scroll() : a,
  visibility: (a, l) => l === "invisible" ? a.invisible() : a.visible(),
  bg: (a, l) => a.bg(l),
  opacity: (a, l) => a.opacity(l),
  shadow: (a, l) => l === "none" ? a.shadow_none() : a[`shadow_${l}`](),
  cursor: (a, l) => a[`cursor_${l}`](),
  border_color: (a, l) => a.border_color(l),
  text_ellipsis: (a, l) => l ? a.text_ellipsis() : a,
  underline: (a, l) => l ? a.underline() : a,
  text_color: (a, l) => a.text_color(l),
  text_size: (a, l) => a.text_size(l),
  font_weight: (a, l) => a.font_weight(l),
  font_family: (a, l) => a.font_family(l),
  font_features: (a, l) => a.font_features(l),
  line_height: (a, l) => a.line_height(l),
  italic: (a, l) => l ? a.italic() : a.not_italic(),
  whitespace: (a, l) => l === "nowrap" ? a.whitespace_nowrap() : a.whitespace_normal(),
  text_align: (a, l) => a[`text_${l}`](),
  rounded: (a, l) => a.rounded(l)
};
for (const a of ["w", "h", "min_w", "min_h", "max_w", "max_h", "top", "right", "bottom", "left", "pt", "pr", "pb", "pl", "mt", "mr", "mb", "ml", "gap_x", "gap_y", "border_t", "border_r", "border_b", "border_l", "rounded_tl", "rounded_tr", "rounded_br", "rounded_bl"])
  ks[a] = (l, s) => l[a](s);
const sy = Object.keys(ks);
function Wo(a, l) {
  for (const [s, o] of Object.entries(l)) {
    const i = ks[s];
    if (!i) throw new Error(`the description key ${s} has no GPUI builder`);
    o != null && (a = i(a, o));
  }
  return a;
}
const Un = (a) => ({ clientX: a?.position?.x ?? 0, clientY: a?.position?.y ?? 0 }), df = /* @__PURE__ */ new WeakSet(), Fo = /* @__PURE__ */ new WeakSet();
function ff(a, l, s) {
  const o = a.pressed, i = Un(s);
  return o && o.x === i.clientX && o.y === i.clientY ? o.id : l;
}
function J1(a, l, s) {
  if (a.name) return a.name;
  if (!(l.size || a.hover || a.focus || a.active || a.track_hover && Xr.has(a.group) || s)) return null;
  const o = a.meta?.attrs["data-testid"];
  return o ? `~${a.id}:${o}` : `~${a.id}`;
}
const vm = (a, l = !1) => (a.children ?? []).some((s) => s.kind === "text" ? !l || /\s/.test(String(s.text ?? "").trim()) : s.kind === "div" && s.style?.flex_direction !== "row" && s.style?.whitespace !== "nowrap" && vm(s, !0)), Ne = (a) => a.style?.display !== "hidden";
let Xr = /* @__PURE__ */ new Set();
function ym(a, l = /* @__PURE__ */ new Set()) {
  for (const { group: s, style: o } of a.group_hover ?? []) "display" in o && l.add(s);
  for (const s of a.children ?? []) s.kind !== "text" && ym(s, l);
  return l;
}
function fs(a, l, s, o, i = !1, d = !1, m = null, f = {}, b = !1, x = /* @__PURE__ */ new Map(), E = null) {
  if (a.kind === "text") return x.get(a)?.text ?? a.text;
  const k = df.has(a);
  d ||= a.style.opacity === 0 || a.style.visibility === "invisible" || a.style.display === "hidden", d && (a.name || a.range_name) && (a = { ...a, name: void 0, range_name: void 0, also: void 0 }), a.style.text_color !== void 0 && (E = null), m = a.style.text_color ?? m;
  const w = !!a.hover?.text_color && Sm(a), N = a.group ?? (w ? `~g${a.id}` : null);
  w && (E = { group: N, color: a.hover.text_color }), f = { ...f };
  for (const v of ["text_size", "line_height", "whitespace", "text_ellipsis"]) a.style[v] !== void 0 && (f[v] = a.style[v]);
  const _ = new Set(a.events ?? []);
  let y;
  if (a.kind === "image" && !a.markup ? y = l.image(a.src) : y = l.div(), a.markup && a.kind === "svg" && E && E.color !== m) {
    const { group: v, color: S } = E, M = () => l.div().absolute().top(0).left(0).size_full();
    y = y.child(M().group_hover(v, (H) => H.invisible()).child(o.icon(`~icon-${a.id}`, a.markup, m))).child(M().invisible().group_hover(v, (H) => H.visible()).child(o.icon(`~icon-${a.id}-hover`, a.markup, S)));
  } else a.markup && (y = y.child(o.icon(`~icon-${a.id}`, a.markup, a.kind === "svg" ? m : "")));
  const z = J1(a, _, i);
  if (z && (y = y.id(z)), a.measure && (y = y.measure(a.measure)), a.name && y.also_named) for (const v of a.also ?? []) y = y.also_named(v);
  y = Wo(y, { ...a.style, ...x.get(a) });
  const R = f.whitespace !== "nowrap" && !f.text_ellipsis;
  b && R && a.style.flex_shrink !== 0 && a.style.min_w === void 0 && vm(a) && (y = y.min_w(0));
  for (const v of ["hover", "focus", "active"]) a[v] && (y = y[v]((S) => Wo(S, a[v])));
  N && (y = y.group(N));
  for (const { group: v, style: S } of a.group_hover ?? []) {
    const { display: M, ...H } = S;
    Object.keys(H).length && (y = y.group_hover(v, (J) => Wo(J, H)));
  }
  if (l.scroll && (a.style.overflow_x === "scroll" || a.style.overflow_y === "scroll")) {
    const v = s.document?.scrollTarget, S = v ? (a.children ?? []).filter(Ne).findIndex((M) => _m(M, v.id)) : -1;
    if (S >= 0 && (s.scroller ?? a.id) === a.id && (s.document.scrollTarget = null, s.scroller = a.id, l.scroll.scroll_to_item(S)), s.scroller ??= a.id, s.scroller === a.id && s.document) {
      y = y.track_scroll(l.scroll);
      const M = (a.children ?? []).filter(Ne).map((H) => H.id);
      s.document.itemBounds = (H) => M.includes(H) ? l.scroll.item_bounds?.(M.indexOf(H)) ?? null : null;
    }
  }
  const D = a.style.overflow_x === "scroll" || a.style.overflow_y === "scroll";
  if (D && Fo.has(a) && (y = y.on_scroll_wheel((v, S) => S.stop_propagation?.())), D || Fo.has(a)) for (const v of a.children ?? []) v.kind !== "text" && Fo.add(v);
  a.kind === "input" && !a.disabled && (y = y.on_mouse_down("left", (v, S) => {
    v.bounds && s.setBounds(a.id, v.bounds), s.focus(a.id), S.notify();
  }));
  const A = a.kind === "input" ? a : a.meta?.tag === "label" ? wm(a) : null;
  A && !A.disabled && /^(checkbox|radio)$/.test(A.input_type) && (y = y.on_click((v, S) => {
    S.stop_propagation?.(), s.toggle(A.id), S.notify();
  }));
  const X = ["click", "double_click", "context_menu", "mouse_down", "mouse_up"].some((v) => _.has(v));
  if (X || k) for (const v of a.children ?? []) v.kind !== "text" && df.add(v);
  if (X && (y = y.on_mouse_down("left", (v, S) => {
    S.stop_propagation?.(), v.bounds && s.setBounds(a.id, v.bounds);
    const M = { ...Un(v), button: 0, buttons: 1, detail: v.click_count }, H = ff(s, a.id, v);
    s.pressed = null, s.dispatch(H, "pointerdown", { ...M, pointerType: "mouse" }), s.dispatch(H, "mousedown", M) && s.pressFocus?.(H), S.notify();
  }), y = y.on_mouse_down("right", (v, S) => {
    S.stop_propagation?.(), v.bounds && s.setBounds(a.id, v.bounds);
    const M = ff(s, a.id, v);
    s.pressed = null, s.dispatch(M, "contextmenu", { ...Un(v), button: 2 }), S.notify();
  }), y = y.on_mouse_up("left", (v, S) => {
    S.stop_propagation?.();
    const M = { ...Un(v), button: 0 };
    s.dispatch(a.id, "pointerup", { ...M, pointerType: "mouse" }), s.dispatch(a.id, "mouseup", M), S.notify();
  }), y = y.on_click((v, S) => {
    s.dispatch(a.id, v.click_count === 2 && _.has("double_click") ? "dblclick" : "click", { detail: v.click_count, button: 0 }), S.notify();
  })), a.blocks_pointer && !X)
    for (const v of ["left", "right"]) y = y.on_mouse_down(v, (S, M) => M.stop_propagation?.());
  else if (k && !X)
    for (const v of ["left", "right"])
      y = y.on_mouse_down(v, (S) => {
        const M = Un(S);
        (s.pressed?.x !== M.clientX || s.pressed?.y !== M.clientY) && (s.pressed = { id: a.id, x: M.clientX, y: M.clientY });
      });
  if (_.has("mouse_move") && (y = y.on_mouse_move((v) => {
    s.dispatch(a.id, "pointermove", { ...Un(v), pointerType: "mouse" });
  })), a.track_hover && Xr.has(a.group) && (y = y.on_hover((v, S) => {
    s.hover(a.id, v), S.notify();
  })), i && (y = y.on_mouse_down_out((v, S) => {
    s.dispatch(s.document.body.id, "pointerdown", { ...Un(v), pointerType: "mouse" }), s.dispatch(s.document.body.id, "mousedown", Un(v)), S.notify();
  })), a.kind === "input" && !/^(checkbox|radio|range|color|file|select)$/.test(a.input_type)) {
    const v = a.value ? String(a.value) : String(a.placeholder ?? "");
    let S = l.div().whitespace_nowrap().overflow_x_hidden();
    const M = ca(f);
    M && (S = S.h(M)), !a.value && m && (S = S.text_color(F1(m))), v && (y = y.child(S.child(a.input_type === "password" && a.value ? "•".repeat([...v].length) : v))), a.field_w && (y = y.child(l.div().w(a.field_w).h(0)));
  }
  const q = f.whitespace === "nowrap" ? ca(f) : null, O = a.style.display === "flex" && !String(a.style.flex_direction ?? "row").startsWith("col");
  let h = !a.range_name;
  const p = a.style.display === "flex" && String(a.style.flex_direction ?? "row").startsWith("col") && (a.style.h === void 0 || a.style.h === "auto") && typeof a.style.max_h == "number";
  for (const v of (a.children ?? []).filter(Ne)) {
    const S = v.style?.flex_basis;
    p && v.style.flex_grow > 0 && (S === 0 || typeof S == "string" && S.endsWith("%")) && x.set(v, { ...x.get(v), flex_basis: "auto" });
    let M = fs(v, l, s, o, !1, d, m, f, O && v.style?.position !== "absolute", x, E);
    const H = !h && (v.kind === "text" || !v.meta), J = v.kind === "text" ? x.get(v)?.h ?? q : null, $ = v.kind === "text" ? x.get(v)?.w : void 0;
    if (H || J || $ !== void 0) {
      let tt = l.div();
      H && (tt = tt.id(a.range_name)), H && !O && a.style.display === "flex" && (tt = tt[`self_${W1[f.text_align] ?? "start"}`]().max_w("100%")), J && (tt = tt.h(J)), $ !== void 0 && (tt = tt.w($).flex_none().whitespace_nowrap()), M = tt.child(M), h ||= H;
    }
    y = y.child(M);
  }
  return y;
}
const W1 = { center: "center", right: "end", end: "end" };
function F1(a) {
  const l = String(a);
  if (!/^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(l)) return a;
  const s = l.length === 9 ? Number.parseInt(l.slice(7), 16) : 255;
  return `${l.slice(0, 7)}${Math.round(s / 2).toString(16).padStart(2, "0")}`;
}
const xm = /^(?:[!-,.-~]+|\S)$/u, wm = (a) => {
  for (const l of a.children ?? []) {
    if (l.kind === "input" && /^(checkbox|radio)$/.test(l.input_type)) return l;
    const s = l.kind === "text" ? null : wm(l);
    if (s) return s;
  }
  return null;
}, _m = (a, l) => a.id === l || (a.children ?? []).some((s) => s.kind !== "text" && _m(s, l)), Sm = (a) => !!a.markup || (a.children ?? []).some((l) => l.kind !== "text" && Sm(l));
function ca(a) {
  const l = a.line_height;
  return typeof l == "string" && l.endsWith("px") ? Number.parseFloat(l) : typeof l == "number" && typeof a.text_size == "number" ? l * a.text_size : null;
}
function cy(a, l, s, o, i = 0, d = !1) {
  const m = [a.root, ...a.overlays];
  Xr = /* @__PURE__ */ new Set();
  for (const E of m) ym(E, Xr);
  const f = i > 0 ? ay(m, i) : /* @__PURE__ */ new Map();
  i > 0 && o.measure && I1(m, i, o.measure, f), ey(m, f), ty(m, f), o.measure && $1(m, o.measure, f);
  let b = l.div().relative().size_full().child(fs(a.root, l, s, o, !1, !1, null, {}, !1, f)), x = d && a.overlays.length ? l.div().relative().size_full().window_layer() : b;
  for (const E of a.overlays) x = x.child(fs(E, l, s, o, !0, !1, null, {}, !1, f));
  return x === b ? b : b.child(x);
}
function I1(a, l, s, o) {
  const i = (_, y) => o.set(_, { ...o.get(_), ...y }), d = /* @__PURE__ */ new Map(), m = /* @__PURE__ */ new Map(), f = ["text_size", "font_weight", "font_family", "italic", "whitespace", "text_ellipsis"];
  function b(_, y, z) {
    if (_.kind === "text") {
      if (!(y.whitespace === "nowrap" || xm.test(_.text)) || y.text_ellipsis || z || typeof y.text_size != "number") return NaN;
      const h = s(_.text, { size: y.text_size, weight: y.font_weight ?? 400, family: y.font_family ?? ".SystemUIFont", italic: !!y.italic });
      return Number.isFinite(h) ? h : NaN;
    }
    if (!Ne(_) || _.kind === "input" || _.markup) return x(_);
    const R = { ...y };
    for (const O of f) _.style[O] !== void 0 && (R[O] = _.style[O]);
    R.text_ellipsis = !!_.style.text_ellipsis, m.set(_, R);
    const D = _.style, A = (_.children ?? []).filter(Ge), X = A.map((O) => b(O, R, z || !!_.tabular));
    let q = x(_);
    if (!Number.isFinite(q) && D.w === void 0) {
      const O = A.map((p, v) => X[v] + (p.kind === "text" ? 0 : rt(p.style.ml) + rt(p.style.mr)));
      let h;
      A.length ? Oe(_) ? h = A.some((p) => p.kind !== "text" && p.style.flex_grow > 0) || D.flex_wrap === "wrap" ? NaN : O.reduce((p, v) => p + v, 0) + rt(D.gap_x) * (A.length - 1) : h = Math.max(...O) : h = 0, q = h + rt(D.pl) + rt(D.pr) + rt(D.border_l) + rt(D.border_r), typeof D.min_w == "number" && (q = Math.max(q, D.min_w)), typeof D.max_w == "number" && (q = Math.min(q, D.max_w));
    }
    return d.set(_, q), q;
  }
  const x = (_) => typeof _.style?.w == "number" ? _.style.w : NaN, E = () => ({ exact: 0, laid: 0 }), k = (_, y) => {
    if (!Number.isFinite(y))
      return Object.assign(_, E()), NaN;
    _.exact += y;
    const z = Math.round(_.exact * l + 1e-9) / l, R = z - _.laid;
    return _.laid = z, R;
  }, w = (_) => Oe(_) && _.style.flex_wrap !== "wrap" && (_.style.justify ?? "start") === "start";
  function N(_) {
    if (!_ || _.kind === "text" || !Ne(_)) return;
    const y = (_.children ?? []).filter(Ge);
    if (w(_) && y.length > 1) {
      const z = rt(_.style.gap_x), R = E(), D = !(z && y.some((A) => A.kind === "text" || !Number.isFinite(rt(A.style.ml))));
      i(_, { border_l: k(R, rt(_.style.border_l)), pl: k(R, rt(_.style.pl)) }), D && z && i(_, { gap_x: 0 }), y.forEach((A, X) => {
        const q = (X && D ? z : 0) + (A.kind === "text" ? 0 : rt(A.style.ml));
        if (A.kind === "text")
          q && Object.assign(R, E());
        else {
          const v = k(R, q);
          Number.isFinite(v) && i(A, { ml: v });
        }
        const O = A.kind === "text" ? m.get(_) ?? {} : null, h = A.kind === "text" ? b(A, O, !!_.tabular) : d.get(A);
        if ((A.kind === "text" || !(A.style.flex_grow > 0)) && Number.isFinite(h)) {
          const v = { w: k(R, h) };
          A.kind !== "text" && typeof A.style.w != "number" && A.style.min_w === void 0 && (v.whitespace = "nowrap", v.flex_shrink = 0), i(A, v);
        } else Object.assign(R, E());
        if (A.kind !== "text") {
          const v = k(R, rt(A.style.mr));
          Number.isFinite(v) && i(A, { mr: v });
        }
      });
    }
    for (const z of _.children ?? []) z.kind !== "text" && N(z);
  }
  for (const _ of a)
    _ && (b(_, {}, !1), N(_));
}
const P1 = /(?<= +)(?=[^ ])|(?<=[\p{L}\p{N}]-)(?=[\p{L}\p{N}])/u;
function $1(a, l, s) {
  const o = ["text_size", "font_weight", "font_family", "italic", "line_height"], i = (f) => typeof f == "number" ? f : 0, d = (f, b) => b && Lr(b) && !Oe(b) && f.style.position !== "absolute" && !["start", "center", "end"].includes(f.style.self) && !["start", "center", "end"].includes(b.style.items), m = (f, b, x, E) => {
    if (!f || f.kind === "text" || !Ne(f)) return;
    const k = f.style;
    let w = typeof k.w == "number" ? k.w : k.w === "100%" ? x : d(f, b) ? x - i(k.ml) - i(k.mr) : NaN;
    typeof k.max_w == "number" && (w = Math.min(w, k.max_w));
    const N = w - i(k.pl) - i(k.pr) - i(k.border_l) - i(k.border_r), _ = { ...E };
    for (const z of o) k[z] !== void 0 && (_[z] = k[z]);
    const y = f.children ?? [];
    if (f.break_anywhere && Number.isFinite(N) && N > 0 && typeof _.text_size == "number" && y.length && y.every((z) => z.kind === "text")) {
      const z = { size: _.text_size, weight: _.font_weight ?? 400, family: _.font_family ?? ".SystemUIFont", italic: !!_.italic }, R = (X) => l(X.trimEnd(), z) <= N + 0.01;
      let D = 0;
      for (const X of y) {
        const q = [];
        for (const h of X.text.split(`
`)) {
          let p = "";
          for (const v of h.split(P1)) {
            if (R(p + v)) {
              p += v;
              continue;
            }
            p && q.push(p.trimEnd()), p = "";
            for (const S of v)
              p && !R(p + S) && (q.push(p), p = ""), p += S;
          }
          q.push(p.trimEnd());
        }
        const O = q.join(`
`);
        q.every((h) => !h || R(h)) ? O !== X.text && s.set(X, { ...s.get(X), text: O }) : D = NaN, D += q.length;
      }
      const A = ca(_);
      Number.isFinite(D) && A && k.h === void 0 && y.length === 1 && s.set(f, { ...s.get(f), h: D * A + i(k.pt) + i(k.pb) + i(k.border_t) + i(k.border_b) });
    }
    for (const z of y) m(z, f, Oe(f) ? NaN : N, _);
  };
  for (const f of a) m(f, null, NaN, {});
}
function ty(a, l) {
  const s = (o, i) => {
    if (!o || o.kind === "text" || !Ne(o)) return;
    const d = o.style, m = d.position === "absolute" ? d.w === void 0 && (d.left === void 0 || d.right === void 0) : i && typeof d.w != "number";
    if (m && Oe(o))
      for (const f of o.children ?? []) {
        const b = f.kind === "text" ? void 0 : f.style.flex_basis;
        f.kind !== "text" && f.style.flex_grow > 0 && (b === 0 || typeof b == "string" && b.endsWith("%")) && l.set(f, { ...l.get(f), flex_basis: "auto" });
      }
    for (const f of o.children ?? []) s(f, m);
  };
  for (const o of a) s(o, !1);
}
function ey(a, l) {
  const s = l.heights ?? /* @__PURE__ */ new Map(), o = (b) => s.get(b), i = (b) => {
    const x = o(b);
    if (Number.isFinite(x)) return x;
    if (b.kind === "text" || !Ne(b)) return 0;
    const E = b.style, k = typeof E.min_h == "number" ? E.min_h : 0, w = (b.children ?? []).filter(Ge), N = w.map((z) => i(z) + (z.kind === "text" ? 0 : Math.max(0, rt(z.style.mt) || 0) + Math.max(0, rt(z.style.mb) || 0))), _ = w.length ? Oe(b) ? Math.max(...N) : N.reduce((z, R) => z + R, 0) + (E.display === "flex" ? (rt(E.gap_y) || 0) * (w.length - 1) : 0) : 0, y = [E.pt, E.pb, E.border_t, E.border_b].reduce((z, R) => z + (rt(R) || 0), 0);
    return Math.max(k, _ + y);
  }, d = (b) => !(b.children ?? []).filter(Ge).length || Oe(b) ? NaN : i({ ...b, style: { ...b.style, h: void 0, max_h: void 0, min_h: void 0 } }), m = (b, x) => {
    const E = b.style;
    if (typeof E.h == "number") return E.h;
    if (typeof E.max_h == "number") return E.max_h;
    if (!x || !Lr(x) || Oe(x)) return NaN;
    const k = x.style, w = typeof k.h == "number" ? k.h : typeof k.max_h == "number" ? k.max_h : NaN, N = (x.children ?? []).filter(Ge);
    let _ = 0;
    for (const z of N) {
      if (z === b) continue;
      const R = o(z);
      if (!Number.isFinite(R)) return NaN;
      _ += R + (z.kind === "text" ? 0 : rt(z.style.mt) + rt(z.style.mb));
    }
    const y = k.display === "flex" ? rt(k.gap_y) * Math.max(0, N.length - 1) : 0;
    return w - rt(k.pt) - rt(k.pb) - rt(k.border_t) - rt(k.border_b) - _ - y - rt(E.mt) - rt(E.mb);
  }, f = (b, x) => {
    if (!(!b || b.kind === "text" || !Ne(b))) {
      if (b.scrollbar > 0 && b.style.overflow_y === "scroll") {
        const E = d(b), k = m(b, x);
        Number.isFinite(E) && Number.isFinite(k) && E > k + 0.01 && l.set(b, { ...l.get(b), pr: rt(b.style.pr) + b.scrollbar });
      }
      for (const E of b.children ?? []) f(E, b);
    }
  };
  for (const b of a) f(b, null);
}
const ny = ["text_size", "line_height", "whitespace", "text_ellipsis"], rt = (a) => a == null ? 0 : typeof a == "number" ? a : NaN, Lr = (a) => a.style.display === "flex" ? a.style.flex_direction === "col" : !0, Oe = (a) => a.style.display === "flex" && (a.style.flex_direction ?? "row") === "row", Ge = (a) => a.kind === "text" || Ne(a) && a.style.position !== "absolute";
function ay(a, l) {
  const s = /* @__PURE__ */ new Map(), o = (y, z) => s.set(y, { ...s.get(y), ...Object.fromEntries(Object.entries(z).filter(([, R]) => Number.isFinite(R))) }), i = /* @__PURE__ */ new Map(), d = /* @__PURE__ */ new Map();
  function m(y, z) {
    if (y.kind === "text") return z.whitespace === "nowrap" || xm.test(y.text) ? ca(z) ?? NaN : NaN;
    const R = { ...z };
    for (const O of ny) y.style[O] !== void 0 && (R[O] = y.style[O]);
    d.set(y, R);
    const D = y.style, A = (y.children ?? []).filter(Ge), X = A.map((O) => m(O, R));
    let q;
    if (D.h !== void 0 && D.h !== "auto") q = rt(D.h);
    else if (y.kind === "input")
      q = (y.input_type === "textarea" || y.input_type === "select" ? NaN : ca(R) ?? NaN) + rt(D.pt) + rt(D.pb) + rt(D.border_t) + rt(D.border_b), D.min_h !== void 0 && (q = Math.max(q, rt(D.min_h)));
    else {
      const O = A.map((p, v) => (p.kind === "text" ? 0 : rt(p.style.mt) + rt(p.style.mb)) + X[v]);
      let h;
      if (Oe(y)) h = D.flex_wrap === "wrap" ? NaN : D.items === "baseline" ? b(A, X, R) : Math.max(0, ...O);
      else if (Lr(y)) {
        const p = A.some((S) => S.kind !== "text" && (S.style.flex_grow > 0 || S.style.flex_basis !== void 0)), v = D.display !== "flex" && A.some((S) => S.kind !== "text" && (rt(S.style.mt) || rt(S.style.mb)));
        h = p || v ? NaN : O.reduce((S, M) => S + M, 0) + (D.display === "flex" ? rt(D.gap_y) * Math.max(0, A.length - 1) : 0);
      } else h = NaN;
      q = h + rt(D.pt) + rt(D.pb) + rt(D.border_t) + rt(D.border_b), D.min_h !== void 0 && (q = Math.max(q, rt(D.min_h))), D.max_h !== void 0 && (q = Math.min(q, rt(D.max_h)));
    }
    return i.set(y, q), q;
  }
  const f = (y) => (ca(y) - (Gr + Rf) * y.text_size) / 2 + Gr * y.text_size;
  function b(y, z, R) {
    let D = 0, A = 0;
    for (const [X, q] of y.entries()) {
      const O = q.kind === "text" ? R : d.get(q);
      if (!(q.kind === "text" || (q.children ?? []).filter(Ge).every((S) => S.kind === "text")) || !Number.isFinite(z[X]) || typeof O.text_size != "number") return NaN;
      const p = q.kind === "text" ? {} : q.style, v = rt(p.mt) + rt(p.border_t) + rt(p.pt) + f(O);
      D = Math.max(D, v), A = Math.max(A, rt(p.mt) + z[X] + rt(p.mb) - v);
    }
    return D + A;
  }
  const x = () => ({ exact: 0, laid: 0 }), E = (y, z) => {
    if (!Number.isFinite(z))
      return Object.assign(y, x()), NaN;
    y.exact += z;
    const R = Math.round(y.exact * l + 1e-9) / l, D = R - y.laid;
    return y.laid = R, D;
  };
  function k(y) {
    if (!(y.kind === "text" || !Ne(y))) {
      for (const z of (y.children ?? []).filter((R) => R.kind !== "text" && Ne(R) && R.style.position === "absolute")) k(z);
      if (Lr(y) && !Oe(y)) {
        const z = x();
        o(y, { border_t: E(z, rt(y.style.border_t)), pt: E(z, rt(y.style.pt)) }), w(y, z);
      } else for (const z of (y.children ?? []).filter(Ge)) z.kind !== "text" && k(z);
    }
  }
  function w(y, z) {
    const R = (y.children ?? []).filter(Ge), D = y.style.display === "flex" ? rt(y.style.gap_y) : 0;
    if (D && R.some((A) => A.kind === "text")) {
      for (const A of R) A.kind !== "text" && k(A);
      return !1;
    }
    return D && o(y, { gap_y: 0 }), R.forEach((A, X) => {
      if (A.kind === "text") {
        const q = i.get(A) ?? m(A, d.get(y) ?? {});
        Number.isFinite(q) ? o(A, { h: E(z, q) }) : Object.assign(z, x());
        return;
      }
      if (o(A, { mt: E(z, (X ? D : 0) + rt(A.style.mt)) }), Number.isFinite(i.get(A))) _(A, z);
      else if (N(A)) {
        const q = A.style;
        o(A, { border_t: E(z, rt(q.border_t)), pt: E(z, rt(q.pt)) }), o(A, { pb: E(z, rt(q.pb)), border_b: E(z, rt(q.border_b)) });
      } else
        k(A), Object.assign(z, x());
      o(A, { mb: E(z, rt(A.style.mb)) });
    }), !0;
  }
  function N(y) {
    const z = y.style, R = (y.children ?? []).filter(Ge), D = ca(d.get(y) ?? {});
    return y.kind === "div" && !Oe(y) && R.length > 0 && R.every((A) => A.kind === "text") && Number.isInteger(D) && [z.h, z.min_h, z.max_h].every((A) => A === void 0 || A === "auto");
  }
  function _(y, z) {
    const R = y.style;
    for (const O of (y.children ?? []).filter((h) => h.kind !== "text" && Ne(h) && h.style.position === "absolute")) k(O);
    const D = z.laid, A = z.exact;
    o(y, { border_t: E(z, rt(R.border_t)), pt: E(z, rt(R.pt)) });
    const X = R.h !== void 0 && R.h !== "auto", q = i.get(y) - rt(R.pt) - rt(R.pb) - rt(R.border_t) - rt(R.border_b);
    if (y.kind === "input")
      X || E(z, q);
    else if (Oe(y) || X && (R.justify ?? "start") !== "start") {
      for (const O of (y.children ?? []).filter(Ge)) O.kind !== "text" && k(O);
      X || E(z, q);
    } else !w(y, z) && !X && E(z, q);
    if (X) {
      z.exact = A + i.get(y), z.laid = Math.round(z.exact * l + 1e-9) / l, o(y, { h: z.laid - D });
      return;
    }
    o(y, { pb: E(z, rt(R.pb)), border_b: E(z, rt(R.border_b)) }), o(y, { h: z.laid - D });
  }
  for (const y of a)
    m(y, {}), k(y);
  return Object.defineProperty(s, "heights", { value: i }), s;
}
const uy = { sidebar: [{ name: "sidebar-root", selector: "aside.sidebar" }, { name: "sidebar-content", selector: "aside.sidebar > div:first-child" }, { name: "host-switcher", selector: '[data-testid="host-switcher"]' }, { name: "host-chip", selector: '[data-testid="host-switcher"] > div' }, { name: "host-badge", selector: ".sidebar__env-badge" }, { name: "host-name", selector: ".sidebar__env-host" }, { name: "host-meta", selector: '[data-testid="host-switcher"] > div > div:first-child > span:nth-child(3)' }, { name: "host-line", selector: ".sidebar__env-cwd" }, { name: "host-caret", selector: '[data-testid="host-switcher"] > span[aria-hidden="true"]' }, { name: "new-session-button", selector: 'button[data-testid^="new-session-"]', key: { self: !0, attr: "data-testid", strip: "new-session-" } }, { name: "new-session-icon", selector: 'button[data-testid^="new-session-"] > svg' }, { name: "new-session-label", selector: 'button[data-testid^="new-session-"]', textRange: !0 }, { name: "new-session-shortcut", selector: 'button[data-testid^="new-session-"] > span' }, { name: "overview", selector: '[data-testid="workspace-overview"]' }, { name: "overview-header", selector: '[data-testid="workspace-overview"] > div:first-child' }, { name: "overview-title", selector: '[data-testid="workspace-overview"] > div:first-child > div:first-child > span:first-child' }, { name: "needs-you-button", selector: '[data-testid="workspace-needs-you"]' }, { name: "organize-button", selector: '[data-testid="workspace-organize"]' }, { name: "organize-icon", selector: '[data-testid="workspace-organize"] > svg' }, { name: "add-project-button", selector: '[data-testid="workspace-add-project"]' }, { name: "add-project-icon", selector: '[data-testid="workspace-add-project"] > svg' }, { name: "add-project-label", selector: '[data-testid="workspace-add-project"]', textRange: !0 }, { name: "project-list", selector: '[data-testid="project-list"]' }, { name: "project", selector: ".workspace-project", key: { self: !0, attr: "data-testid", strip: "workspace-project-" } }, { name: "project-header", selector: ".workspace-project > div:first-child", key: { closest: ".workspace-project", attr: "data-testid", strip: "workspace-project-" } }, { name: "project-toggle", selector: '[data-testid^="project-toggle-"]', key: { self: !0, attr: "data-testid", strip: "project-toggle-" } }, { name: "project-chevron", selector: '[data-testid^="project-toggle-"] > svg:not([data-testid])', key: { closest: '[data-testid^="project-toggle-"]', attr: "data-testid", strip: "project-toggle-" } }, { name: "project-folder-icon", selector: '[data-testid="project-folder-icon"]', key: { closest: '[data-testid^="project-toggle-"]', attr: "data-testid", strip: "project-toggle-" } }, { name: "project-name", selector: '[data-testid^="project-toggle-"] strong', key: { closest: '[data-testid^="project-toggle-"]', attr: "data-testid", strip: "project-toggle-" } }, { name: "project-branch", selector: '[data-testid^="project-toggle-"] > span.whitespace-nowrap', key: { closest: '[data-testid^="project-toggle-"]', attr: "data-testid", strip: "project-toggle-" } }, { name: "project-dirty-mark", selector: '[data-testid^="project-toggle-"] > span[title="Uncommitted changes"]', key: { closest: '[data-testid^="project-toggle-"]', attr: "data-testid", strip: "project-toggle-" } }, { name: "project-rollup", selector: '[data-testid^="project-rollup-"]', key: { self: !0, attr: "data-testid", strip: "project-rollup-" } }, { name: "project-rollup-badge", selector: '[data-testid^="project-rollup-"] > span', key: { closest: '[data-testid^="project-rollup-"]', attr: "data-testid", strip: "project-rollup-" } }, { name: "project-menu-button", selector: '[data-testid^="workspace-project-menu-"]', key: { self: !0, attr: "data-testid", strip: "workspace-project-menu-" } }, { name: "project-add-button", selector: ".workspace-project > div:first-child .worktree-menu__btn", key: { closest: ".workspace-project", attr: "data-testid", strip: "workspace-project-" } }, { name: "project-workspaces", selector: ".workspace-project__workspaces", key: { closest: ".workspace-project", attr: "data-testid", strip: "workspace-project-" } }, { name: "workspace", selector: '[data-testid="workspace-tree-root"] [data-testid^="workspace-entry-"]', key: { self: !0, attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-button", selector: '[data-testid="workspace-tree-root"] button.workspace-entry__button', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-icon", selector: '[data-testid="workspace-tree-root"] [data-testid="workspace-checkout-icon"]', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-name", selector: '[data-testid="workspace-tree-root"] strong[title="Double-click to rename"]', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-branch", selector: '[data-testid="workspace-tree-root"] button.workspace-entry__button > span.items-baseline > span', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-dirty-mark", selector: '[data-testid="workspace-tree-root"] button.workspace-entry__button > span[title="Uncommitted changes"]', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-pinned-label", selector: '[data-testid="workspace-tree-root"] button.workspace-entry__button > span.shrink-0:not([title])', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "hidden-worktrees-button", selector: '[data-testid^="workspace-hidden-"]', key: { self: !0, attr: "data-testid", strip: "workspace-hidden-" } }, { name: "session-row", selector: 'div[class~="group/row"]', key: { find: 'button[data-testid^="workspace-session-"]:not([data-testid^="workspace-session-close-"])', attr: "data-testid", strip: "workspace-session-" } }, { name: "session-button", selector: 'button[data-testid^="workspace-session-"]:not([data-testid^="workspace-session-close-"])', key: { self: !0, attr: "data-testid", strip: "workspace-session-" } }, { name: "session-mark", selector: ".agent-mark", key: { closest: 'button[data-testid^="workspace-session-"]', attr: "data-testid", strip: "workspace-session-" } }, { name: "session-mark-icon", selector: ".agent-mark > span > *", key: { closest: 'button[data-testid^="workspace-session-"]', attr: "data-testid", strip: "workspace-session-" } }, { name: "session-title", selector: 'button[data-testid^="workspace-session-"] > span.whitespace-nowrap', key: { closest: 'button[data-testid^="workspace-session-"]', attr: "data-testid", strip: "workspace-session-" } }, { name: "status-row-title", selector: "button[data-session] span.truncate:not([data-testid])", key: { closest: 'button[data-testid^="workspace-session-"]', attr: "data-testid", strip: "workspace-session-" } }, { name: "status-row-detail", selector: '[data-testid="status-row-detail"]', key: { closest: 'button[data-testid^="workspace-session-"]', attr: "data-testid", strip: "workspace-session-" } }, { name: "session-state-badge", selector: '[data-testid^="session-state-"]', key: { self: !0, attr: "data-testid", strip: "session-state-" } }, { name: "session-menu-button", selector: '[data-testid^="session-menu-button-"]', key: { self: !0, attr: "data-testid", strip: "session-menu-button-" } }, { name: "session-fold-button", selector: '[data-testid^="session-fold-"]', key: { self: !0, attr: "data-testid", strip: "session-fold-" } }, { name: "session-elbow", selector: '[data-testid^="session-elbow-"]', key: { self: !0, attr: "data-testid", strip: "session-elbow-" } }, { name: "session-rollup", selector: '[data-testid^="session-rollup-"]', key: { self: !0, attr: "data-testid", strip: "session-rollup-" } }, { name: "chats", selector: '[data-testid="workspace-chats"]' }, { name: "chats-header", selector: '[data-testid="workspace-chats"] > div:first-child' }, { name: "chats-toggle", selector: '[data-testid="workspace-chats-collapse"]' }, { name: "chats-label", selector: '[data-testid="workspace-chats-collapse"]', textRange: !0 }, { name: "chats-chevron", selector: '[data-testid="workspace-chats-collapse"] > svg' }, { name: "chats-menu-button", selector: '[data-testid="workspace-chats-menu"]' }, { name: "chats-new-button", selector: '[data-testid="workspace-chats-new"]' }, { name: "chats-new-icon", selector: '[data-testid="workspace-chats-new"] > svg' }, { name: "status-view", selector: '[data-testid="workspace-status-view"]' }, { name: "status-section", selector: '[data-testid^="status-section-"]:not([data-testid^="status-section-title-"])', key: { self: !0, attr: "data-testid", strip: "status-section-" } }, { name: "status-heading", selector: '[data-testid^="status-section-title-"], [data-testid="status-no-sessions-title"]', key: { self: !0, attr: "data-testid" } }, { name: "status-heading-dot", selector: '[data-testid^="status-section-title-"] > span:first-child, [data-testid="status-no-sessions-title"] > span:first-child', key: { closest: '[data-testid^="status-section-title-"], [data-testid="status-no-sessions-title"]', attr: "data-testid" } }, { name: "status-heading-label", selector: '[data-testid^="status-section-title-"] > span:nth-child(2), [data-testid="status-no-sessions-title"] > span:nth-child(2)', key: { closest: '[data-testid^="status-section-title-"], [data-testid="status-no-sessions-title"]', attr: "data-testid" } }, { name: "status-heading-count", selector: '[data-testid^="status-section-title-"] > span[aria-label], [data-testid="status-no-sessions-title"] > span[aria-label]', key: { closest: '[data-testid^="status-section-title-"], [data-testid="status-no-sessions-title"]', attr: "data-testid" } }, { name: "status-heading-note", selector: '[data-testid^="status-section-title-"] > span.truncate, [data-testid="status-no-sessions-title"] > span.truncate', key: { closest: '[data-testid^="status-section-title-"], [data-testid="status-no-sessions-title"]', attr: "data-testid" } }, { name: "status-project", selector: 'div[data-testid^="status-project-"]', key: { self: !0, attr: "data-testid", strip: "status-project-" } }, { name: "status-project-header", selector: 'div[data-testid^="status-project-"] > div:first-child', key: { closest: 'div[data-testid^="status-project-"]', attr: "data-testid", strip: "status-project-" } }, { name: "status-project-icon", selector: 'div[data-testid^="status-project-"] > div:first-child > svg', key: { closest: 'div[data-testid^="status-project-"]', attr: "data-testid", strip: "status-project-" } }, { name: "status-project-title", selector: '[data-testid="status-project-title"]', key: { closest: 'div[data-testid^="status-project-"]', attr: "data-testid", strip: "status-project-" } }, { name: "status-empty-project", selector: '[data-testid^="status-empty-project-"]', key: { self: !0, attr: "data-testid", strip: "status-empty-project-" } }, { name: "status-empty-project-icon", selector: '[data-testid^="status-empty-project-"] > button:first-child > svg', key: { closest: '[data-testid^="status-empty-project-"]', attr: "data-testid", strip: "status-empty-project-" } }, { name: "status-empty-project-title", selector: '[data-testid^="status-empty-project-"] > button > span.whitespace-nowrap', key: { closest: '[data-testid^="status-empty-project-"]', attr: "data-testid", strip: "status-empty-project-" } }, { name: "settings-bar", selector: "aside.sidebar > div:last-child" }, { name: "settings-gear", selector: '[data-testid="settings-gear"]' }, { name: "settings-gear-icon", selector: '[data-testid="settings-gear"] > svg' }], tabs: [{ name: "tab-strip", selector: '[data-testid="tab-bar"]' }, { name: "tab-slot", selector: "[data-tab-entry]", key: { self: !0, attr: "data-tab-entry" } }, { name: "tab-separator", selector: '[data-testid="tab-separator"]', key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab", selector: "button.tab-bar__tab", key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-icon", selector: 'button.tab-bar__tab > span[aria-hidden="true"]', key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-icon-glyph", selector: 'button.tab-bar__tab > span[aria-hidden="true"] > *', key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-label", selector: "button.tab-bar__tab > span.truncate", key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-dirty", selector: 'button.tab-bar__tab > span[aria-label="unsaved changes"]', key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-close", selector: '[data-tab-entry] > button[aria-label^="Close"]', key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-close-glyph", selector: '[data-tab-entry] > button[aria-label^="Close"] > svg', key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-new", selector: '[data-testid="tab-new"]' }, { name: "tab-new-glyph", selector: '[data-testid="tab-new"] > svg' }], status: [{ name: "status-bar", selector: "footer.status-bar" }, { name: "status-location", selector: ".status-bar__location" }, { name: "status-dot", selector: ".status-bar__location > span:first-child" }, { name: "status-host", selector: '[data-testid="status-host"]' }, { name: "status-cwd", selector: ".status-item--cwd" }, { name: "status-branch", selector: ".status-bar__branch" }, { name: "status-branch-icon", selector: ".status-bar__branch > svg" }, { name: "status-branch-name", selector: ".status-bar__branch > span" }, { name: "status-details", selector: ".status-bar__details" }, { name: "zoom-indicator", selector: '[data-testid="zoom-indicator"]' }, { name: "status-detail", selector: ".status-bar__details > span" }, { name: "status-usage", selector: ".status-bar__usage" }, { name: "usage-summary", selector: '[data-testid="usage-summary"]' }, { name: "usage-unavailable", selector: '[data-testid="usage-summary"] > span:only-child' }, { name: "usage-account", selector: '[data-testid="usage-summary"] > span.flex' }, { name: "usage-account-name", selector: '[data-testid="usage-summary"] > span.flex > span:first-child' }, { name: "usage-window", selector: '[data-testid="usage-summary"] > span.flex > span:not(:first-child)' }, { name: "status-connection", selector: '[data-testid="status-connection"]' }, { name: "status-connection-glyph", selector: '[data-testid="status-connection"] > svg' }], navigator: [{ name: "navigator-scrim", selector: "body > div.fixed.inset-0" }, { name: "navigator-panel", selector: '[data-testid="navigator"]' }, { name: "navigator-input", selector: '[data-testid="navigator-input"]' }, { name: "navigator-chips", selector: '[data-testid="navigator"] > div:nth-child(2)' }, { name: "navigator-chip", selector: '[data-testid^="navigator-filter-"]', key: { self: !0, attr: "data-testid", strip: "navigator-filter-" } }, { name: "navigator-list", selector: '[data-testid="navigator"] > div:nth-child(3)' }, { name: "navigator-notice", selector: '[data-testid="navigator"] > div:nth-child(3) > p[role]' }, { name: "navigator-empty", selector: '[data-testid="navigator"] div.text-center' }, { name: "navigator-command", selector: '[data-testid^="navigator-command-"]', key: { self: !0, attr: "data-testid", strip: "navigator-command-" } }, { name: "navigator-command-title", selector: '[data-testid^="navigator-command-"] > span:first-child', key: { closest: '[data-testid^="navigator-command-"]', attr: "data-testid", strip: "navigator-command-" } }, { name: "navigator-command-detail", selector: '[data-testid^="navigator-command-"] > span:last-child', key: { closest: '[data-testid^="navigator-command-"]', attr: "data-testid", strip: "navigator-command-" } }, { name: "navigator-row", selector: '[data-testid^="navigator-row-"]', key: { self: !0, attr: "data-testid", strip: "navigator-row-" } }, { name: "navigator-row-dot", selector: '[data-testid^="navigator-row-"] > :first-child', key: { closest: '[data-testid^="navigator-row-"]', attr: "data-testid", strip: "navigator-row-" } }, { name: "navigator-row-title", selector: '[data-testid^="navigator-row-"] > span:nth-child(2)', key: { closest: '[data-testid^="navigator-row-"]', attr: "data-testid", strip: "navigator-row-" } }, { name: "navigator-row-detail", selector: '[data-testid^="navigator-row-"] > span:last-child', key: { closest: '[data-testid^="navigator-row-"]', attr: "data-testid", strip: "navigator-row-" } }, { name: "navigator-note", selector: '[data-testid="navigator"] > p:last-child' }], "pane-menu": [{ name: "pane-menu", selector: '[data-testid="pane-context-menu"]' }, { name: "pane-menu-item", selector: '[data-testid="pane-context-menu"] > button', key: { self: !0, attr: "data-testid", strip: "pane-menu-" } }, { name: "pane-menu-divider", selector: '[data-testid="pane-context-menu"] > div.h-px' }, { name: "pane-menu-rename-row", selector: '[data-testid="pane-context-menu"] > div.flex' }, { name: "pane-menu-rename-input", selector: '[data-testid="pane-menu-rename-input"]' }, { name: "pane-menu-rename-confirm", selector: '[data-testid="pane-menu-rename-confirm"]' }], confirm: [{ name: "confirm-scrim", selector: "body > div.fixed.inset-0" }, { name: "confirm-panel", selector: '[data-testid="confirm-dialog"]' }, { name: "confirm-message", selector: ".confirm-dialog__message" }, { name: "confirm-extra", selector: '[data-testid="confirm-dialog"] > :not(.confirm-dialog__message):not(div.flex)' }, { name: "confirm-buttons", selector: '[data-testid="confirm-dialog"] > div.flex' }, { name: "confirm-cancel", selector: '[data-testid="confirm-cancel"]' }, { name: "confirm-accept", selector: '[data-testid="confirm-accept"]' }], dialog: [{ name: "dialog-scrim", selector: "body > div.fixed.inset-0" }, { name: "dialog-panel", selector: '[data-testid="file-name-dialog"]' }, { name: "dialog-title", selector: '[data-testid="file-name-dialog"] > h2' }, { name: "dialog-input", selector: '[data-testid="file-name-input"]' }, { name: "dialog-hint", selector: '[data-testid="file-name-dialog"] > p:not([role])' }, { name: "dialog-error", selector: '[data-testid="file-name-dialog"] > p[role="alert"]' }, { name: "dialog-buttons", selector: '[data-testid="file-name-dialog"] > div.flex' }, { name: "dialog-cancel", selector: '[data-testid="file-name-dialog"] > div.flex > button:first-child' }, { name: "dialog-confirm", selector: '[data-testid="file-name-confirm"]' }], toast: [{ name: "toast-stack", selector: '[data-testid="toast"]' }, { name: "toast-card", selector: '[data-testid="toast"] .animate-toast-in' }, { name: "toast-open", selector: '[data-testid^="toast-"]:not([data-testid^="toast-dismiss-"])' }, { name: "toast-mark", selector: '[data-testid^="toast-"]:not([data-testid^="toast-dismiss-"]) > :first-child' }, { name: "toast-heading", selector: '[data-testid^="toast-"]:not([data-testid^="toast-dismiss-"]) > span.min-w-0 > span:first-child' }, { name: "toast-detail", selector: '[data-testid^="toast-"]:not([data-testid^="toast-dismiss-"]) > span.min-w-0 > span:nth-child(2)' }, { name: "toast-dismiss", selector: '[data-testid^="toast-dismiss-"]' }, { name: "toast-dismiss-glyph", selector: '[data-testid^="toast-dismiss-"] > svg' }], "pane-header": [{ name: "pane-header", selector: '[data-testid^="pane-header-"]', key: { self: !0, attr: "data-testid", strip: "pane-header-" } }, { name: "pane-header-icon", selector: '[data-testid^="pane-header-"] > span.shrink-0:not([data-testid])', key: { closest: '[data-testid^="pane-header-"]', attr: "data-testid", strip: "pane-header-" } }, { name: "pane-header-icon-glyph", selector: '[data-testid^="pane-header-"] > span.shrink-0:not([data-testid]) > *', key: { closest: '[data-testid^="pane-header-"]', attr: "data-testid", strip: "pane-header-" } }, { name: "pane-header-name", selector: '[data-testid^="pane-header-"] > span.truncate', key: { closest: '[data-testid^="pane-header-"]', attr: "data-testid", strip: "pane-header-" } }, { name: "pane-header-state", selector: '[data-testid^="pane-header-"] > span.flex[title]', key: { closest: '[data-testid^="pane-header-"]', attr: "data-testid", strip: "pane-header-" } }, { name: "pane-header-state-dot", selector: '[data-testid^="pane-header-"] > span.flex[title] > span.rounded-full', key: { closest: '[data-testid^="pane-header-"]', attr: "data-testid", strip: "pane-header-" } }, { name: "pane-header-state-word", selector: '[data-testid^="pane-header-"] > span.flex[title] > span.truncate', key: { closest: '[data-testid^="pane-header-"]', attr: "data-testid", strip: "pane-header-" } }, { name: "pane-controls", selector: '[data-testid^="tile-controls-"]', key: { self: !0, attr: "data-testid", strip: "tile-controls-" } }, { name: "pane-expand", selector: '[data-testid^="tile-expand-"]', key: { self: !0, attr: "data-testid", strip: "tile-expand-" } }, { name: "pane-expand-glyph", selector: '[data-testid^="tile-expand-"] > svg', key: { closest: '[data-testid^="tile-expand-"]', attr: "data-testid", strip: "tile-expand-" } }, { name: "pane-close", selector: '[data-testid^="tile-close-"]', key: { self: !0, attr: "data-testid", strip: "tile-close-" } }, { name: "pane-close-glyph", selector: '[data-testid^="tile-close-"] > svg', key: { closest: '[data-testid^="tile-close-"]', attr: "data-testid", strip: "tile-close-" } }, { name: "pane-corner", selector: "div.pointer-events-auto.absolute" }], "new-session": [{ name: "launcher", selector: ".new-session-popover" }, { name: "launcher-filter", selector: '[data-testid="new-tab-filter"]' }, { name: "launcher-list", selector: "#new-tab-launcher-list" }, { name: "launcher-option", selector: '[role="option"]', key: { self: !0, attr: "data-testid" } }, { name: "launcher-option-icon", selector: '[role="option"] > :first-child:not(span.flex-1):not(kbd)', key: { closest: '[role="option"]', attr: "data-testid" } }, { name: "launcher-option-label", selector: '[role="option"] > span.flex-1', key: { closest: '[role="option"]', attr: "data-testid" } }, { name: "launcher-option-key", selector: '[role="option"] > kbd', key: { closest: '[role="option"]', attr: "data-testid" } }, { name: "launcher-note", selector: ".new-session-popover p[role]" }, { name: "agent-select", selector: '[data-testid="new-session-popover-agent"]' }, { name: "agent-manage", selector: ".new-session-popover > div:first-child > button:not([data-testid])" }, { name: "project-option", selector: '[data-testid^="project-option-"]', key: { self: !0, attr: "data-testid", strip: "project-option-" } }, { name: "project-option-name", selector: '[data-testid^="project-option-"]', key: { closest: '[data-testid^="project-option-"]', attr: "data-testid", strip: "project-option-" }, textRange: !0 }, { name: "project-option-path", selector: '[data-testid^="project-option-"] > span', key: { closest: '[data-testid^="project-option-"]', attr: "data-testid", strip: "project-option-" } }], "tab-menu": [{ name: "tab-menu", selector: '[data-testid="tab-split-menu"]' }, { name: "tab-menu-item", selector: '[data-testid="tab-split-menu"] > button', key: { self: !0, attr: "data-testid" } }, { name: "tab-menu-item-label", selector: '[data-testid="tab-split-menu"] > button > span.block', key: { closest: '[data-testid="tab-split-menu"] > button', attr: "data-testid" } }, { name: "tab-menu-heading", selector: '[data-testid="tab-split-menu"] > p' }, { name: "tab-menu-empty", selector: '[data-testid="tab-split-menu"] > div:not(.h-px)' }, { name: "tab-menu-divider", selector: '[data-testid="tab-split-menu"] > div.h-px' }, { name: "tab-menu-rename-form", selector: '[data-testid="tab-split-menu"] > form' }, { name: "tab-menu-rename-input", selector: '[data-testid="tab-menu-rename-input"]' }, { name: "tab-menu-rename-save", selector: '[data-testid="tab-split-menu"] > form > button' }], select: [{ name: "select-field", selector: '[data-testid="select-demo"]' }, { name: "select-field-label", selector: '[data-testid="select-demo"] > span.truncate' }, { name: "select-chevron", selector: '[data-testid="select-demo"] > svg' }, { name: "select-list", selector: '[role="listbox"]' }, { name: "select-option", selector: '[role="listbox"] > [role="option"]', key: { self: !0, attr: "data-value" } }, { name: "select-option-label", selector: '[role="listbox"] > [role="option"] > span.truncate', key: { closest: '[role="option"]', attr: "data-value" } }, { name: "select-option-check", selector: '[role="listbox"] > [role="option"] > span[aria-hidden]', key: { closest: '[role="option"]', attr: "data-value" } }], "keybind-help": [{ name: "keybind-help-scrim", selector: "body > div.fixed.inset-0" }, { name: "keybind-help-panel", selector: '[data-testid="keybind-help"]' }, { name: "keybind-help-header", selector: '[data-testid="keybind-help"] > div:first-child' }, { name: "keybind-help-title", selector: '[data-testid="keybind-help"] h2' }, { name: "keybind-help-close", selector: '[aria-label="Close keybind help"]' }, { name: "keybind-help-close-glyph", selector: '[aria-label="Close keybind help"] > svg' }, { name: "keybind-help-search", selector: '[data-testid="keybind-help-search"]' }, { name: "keybind-help-list", selector: '[data-testid="keybind-help"] > div:last-child' }, { name: "keybind-help-empty", selector: '[data-testid="keybind-help"] div.text-center' }, { name: "keybind-help-group", selector: '[data-testid="keybind-help"] section' }, { name: "keybind-help-group-title", selector: '[data-testid="keybind-help"] section > h3' }, { name: "keybind-help-row", selector: '[data-testid="keybind-help"] li' }, { name: "keybind-help-keys", selector: '[data-testid="keybind-help"] li > kbd' }, { name: "keybind-help-description", selector: '[data-testid="keybind-help"] li > span' }], launcher: [{ name: "launcher-scrim", selector: "body > div.fixed.inset-0" }, { name: "launcher-panel", selector: '[data-testid="new-session-dialog"]' }, { name: "launcher-title", selector: '[data-testid="new-session-dialog"] > p' }, { name: "launcher-filter", selector: '[data-testid="new-session-filter"]' }, { name: "launcher-list", selector: "#new-session-list" }, { name: "launcher-row", selector: '[data-testid^="new-session-row-"]', key: { self: !0, attr: "data-testid", strip: "new-session-row-" } }, { name: "launcher-row-icon", selector: '[data-testid^="new-session-row-"] > :first-child:not(span):not(kbd)', key: { closest: '[data-testid^="new-session-row-"]', attr: "data-testid", strip: "new-session-row-" } }, { name: "launcher-row-label", selector: '[data-testid^="new-session-row-"] > span.shrink-0', key: { closest: '[data-testid^="new-session-row-"]', attr: "data-testid", strip: "new-session-row-" } }, { name: "launcher-row-detail", selector: '[data-testid^="new-session-row-"] > span.ml-auto', key: { closest: '[data-testid^="new-session-row-"]', attr: "data-testid", strip: "new-session-row-" } }, { name: "launcher-row-key", selector: '[data-testid^="new-session-row-"] > kbd', key: { closest: '[data-testid^="new-session-row-"]', attr: "data-testid", strip: "new-session-row-" } }, { name: "launcher-note", selector: "#new-session-list > p" }], "session-menu": [{ name: "tab-menu", selector: '[data-testid="tab-split-menu"]' }, { name: "tab-menu-item", selector: '[data-testid="tab-split-menu"] > button', key: { self: !0, attr: "data-testid" } }, { name: "tab-menu-item-label", selector: '[data-testid="tab-split-menu"] > button > span.block', key: { closest: '[data-testid="tab-split-menu"] > button', attr: "data-testid" } }, { name: "tab-menu-heading", selector: '[data-testid="tab-split-menu"] > p' }, { name: "tab-menu-empty", selector: '[data-testid="tab-split-menu"] > div:not(.h-px)' }, { name: "tab-menu-divider", selector: '[data-testid="tab-split-menu"] > div.h-px' }], "tab-drag": [{ name: "tab-drag-layer", selector: '[data-testid="tab-drag-layer"]' }, { name: "tab-drag-pane", selector: '[data-testid="tab-drag-layer"] > div.bg-surface-1\\/30' }, { name: "tab-drop-zone", selector: '[data-testid="tab-drop-zone"]', key: { self: !0, attr: "data-zone" } }, { name: "tab-drop-label", selector: '[data-testid="tab-drop-zone"] > span' }, { name: "tab-drag-ghost", selector: '[data-testid="tab-drag-ghost"]' }], start: [{ name: "start-panel", selector: '[data-testid="no-session-panel"], [data-testid="cli-start-panel"]' }, { name: "start-column", selector: '[data-testid$="-panel"] > div' }, { name: "start-logo", selector: '[data-testid="no-session-panel"] img' }, { name: "start-name", selector: '[data-testid$="-panel"] h1, [data-testid="no-session-panel"] h1, [data-testid="no-session-panel"] h2' }, { name: "start-hint", selector: '[data-testid$="-panel"] p' }, { name: "start-target", selector: '[data-testid="workspace-start-target"], [data-testid="cli-start-target"]' }, { name: "start-action", selector: '[data-testid="home-add-project"], [data-testid="no-session-create"], [data-testid^="workspace-start-"]:not([data-testid="workspace-start-target"]), [data-testid^="cli-start-agent-"]', key: { self: !0, attr: "data-testid" } }, { name: "start-status", selector: '[role="status"], [role="alert"]' }, { name: "start-status-action", selector: '[role="status"] > button, [role="alert"] > button' }, { name: "start-link", selector: '[data-testid$="-panel"] button.text-subtext-0' }, { name: "start-shortcut-row", selector: '[data-testid="no-session-panel"] dl > div' }, { name: "start-shortcut-label", selector: '[data-testid="no-session-panel"] dl dt' }, { name: "start-shortcut-key", selector: '[data-testid="no-session-panel"] dl kbd' }], "folder-browser": [{ name: "folder-browser", selector: '[data-testid="dir-browser"]' }, { name: "folder-browser-mode-toggle", selector: '[data-testid="dir-browser-mode-toggle"]' }, { name: "folder-browser-up", selector: '[data-testid="dir-browser-up"]' }, { name: "folder-browser-crumbs", selector: '[data-testid="dir-browser"] span.min-w-0.flex-1' }, { name: "folder-browser-crumb", selector: '[data-testid="dir-browser"] span.min-w-0.flex-1 button' }, { name: "folder-browser-filter", selector: '[data-testid="dir-browser-filter"]' }, { name: "folder-browser-list", selector: '[data-testid="dir-browser"] div.overflow-y-auto' }, { name: "folder-browser-entry", selector: '[data-testid^="dir-browser-entry-"]', key: { self: !0, attr: "data-testid", strip: "dir-browser-entry-" } }, { name: "folder-browser-entry-name", selector: '[data-testid^="dir-browser-entry-"] > span:first-child', key: { closest: '[data-testid^="dir-browser-entry-"]', attr: "data-testid", strip: "dir-browser-entry-" } }, { name: "folder-browser-git", selector: '[data-testid^="dir-browser-entry-"] > span:last-child:not(:first-child)', key: { closest: '[data-testid^="dir-browser-entry-"]', attr: "data-testid", strip: "dir-browser-entry-" } }, { name: "folder-browser-note", selector: '[data-testid="dir-browser"] div.overflow-y-auto > div' }, { name: "folder-browser-use", selector: '[data-testid="dir-browser-use"]' }, { name: "folder-browser-path-input", selector: '[data-testid="project-path-input"]' }], instructions: [{ name: "instructions-scrim", selector: "body > div.fixed.inset-0" }, { name: "instructions-panel", selector: '[data-testid="instructions-dialog"]' }, { name: "instructions-title", selector: '[data-testid="instructions-dialog"] > h2' }, { name: "instructions-intro", selector: '[data-testid="instructions-dialog"] > p' }, { name: "instructions-label", selector: '[data-testid="instructions-dialog"] > label > span:first-child' }, { name: "instructions-count", selector: '[data-testid="instructions-count"]' }, { name: "instructions-text", selector: '[data-testid="instructions-text"]' }, { name: "instructions-folders", selector: '[data-testid="instructions-folders"]' }, { name: "instructions-error", selector: '[data-testid="instructions-error"]' }, { name: "instructions-cancel", selector: '[data-testid="instructions-dialog"] > div.flex.justify-end > button:first-child' }, { name: "instructions-save", selector: '[data-testid="instructions-save"]' }], memory: [{ name: "memory-scrim", selector: "body > div.fixed.inset-0", key: { self: !0, attr: "data-testid" } }, { name: "memory-panel", selector: '[data-testid="memory-dialog"]' }, { name: "memory-title", selector: '[data-testid="memory-dialog"] > h2' }, { name: "memory-intro", selector: '[data-testid="memory-dialog"] > p' }, { name: "memory-caps", selector: '[data-testid="memory-caps"]' }, { name: "memory-new", selector: '[data-testid="memory-new"]' }, { name: "memory-enabled", selector: '[data-testid="memory-enabled"]' }, { name: "memory-enabled-label", selector: '[data-testid="memory-dialog"] > label.flex > span' }, { name: "memory-note", selector: '[data-testid="memory-dialog"] > span.text-subtext-0' }, { name: "memory-row", selector: '[data-testid^="memory-row-"]', key: { self: !0, attr: "data-testid", strip: "memory-row-" } }, { name: "memory-open", selector: '[data-testid^="memory-open-"]', key: { self: !0, attr: "data-testid", strip: "memory-open-" } }, { name: "memory-file-title", selector: '[data-testid^="memory-row-"] button > span:first-child', key: { closest: '[data-testid^="memory-row-"]', attr: "data-testid", strip: "memory-row-" } }, { name: "memory-file-summary", selector: '[data-testid^="memory-row-"] button > span.truncate', key: { closest: '[data-testid^="memory-row-"]', attr: "data-testid", strip: "memory-row-" } }, { name: "memory-file-meta", selector: '[data-testid^="memory-row-"] button > span:last-child', key: { closest: '[data-testid^="memory-row-"]', attr: "data-testid", strip: "memory-row-" } }, { name: "memory-delete", selector: '[data-testid^="memory-delete-"]', key: { self: !0, attr: "data-testid", strip: "memory-delete-" } }, { name: "memory-error", selector: '[data-testid="memory-error"]' }, { name: "memory-close", selector: '[data-testid="memory-dialog"] > div.flex.justify-end > button' }, { name: "memory-file-name", selector: '[data-testid="memory-file-name"]' }, { name: "memory-name", selector: '[data-testid="memory-name"]' }, { name: "memory-count", selector: '[data-testid="memory-count"]' }, { name: "memory-text", selector: '[data-testid="memory-text"]' }, { name: "memory-conflict", selector: '[data-testid="memory-conflict"]' }, { name: "memory-reload", selector: '[data-testid="memory-reload"]' }, { name: "memory-back", selector: '[data-testid="memory-back"]' }, { name: "memory-save", selector: '[data-testid="memory-save"]' }, { name: "memory-confirm", selector: '[data-testid="confirm-dialog"]' }, { name: "memory-confirm-message", selector: ".confirm-dialog__message" }], worktree: [{ name: "worktree-plus", selector: '[data-testid^="worktree-menu-"]' }, { name: "worktree-popover", selector: '[role="dialog"][aria-label="Git worktrees"]' }, { name: "worktree-heading", selector: '[role="dialog"][aria-label="Git worktrees"] > div:first-child > span:first-child' }, { name: "worktree-project", selector: '[role="dialog"][aria-label="Git worktrees"] > div:first-child > span:last-child' }, { name: "worktree-list", selector: '[role="dialog"][aria-label="Git worktrees"] > div.overflow-y-auto' }, { name: "worktree-note", selector: '[role="dialog"][aria-label="Git worktrees"] > div.overflow-y-auto > div:not(.worktree-menu__entry)' }, { name: "worktree-entry", selector: '[data-testid^="worktree-entry-"]', key: { self: !0, attr: "data-testid", strip: "worktree-entry-" } }, { name: "worktree-entry-branch", selector: ".worktree-menu__entry-branch", key: { closest: '[data-testid^="worktree-entry-"]', attr: "data-testid", strip: "worktree-entry-" } }, { name: "worktree-badge", selector: '[data-testid^="worktree-entry-"] .worktree-menu__entry-branch > span', key: { closest: '[data-testid^="worktree-entry-"]', attr: "data-testid", strip: "worktree-entry-" } }, { name: "worktree-entry-path", selector: ".worktree-menu__entry-path", key: { closest: '[data-testid^="worktree-entry-"]', attr: "data-testid", strip: "worktree-entry-" } }, { name: "worktree-open", selector: '[data-testid^="worktree-open-"]', key: { self: !0, attr: "data-testid", strip: "worktree-open-" } }, { name: "worktree-remove", selector: '[data-testid^="worktree-remove-"]', key: { self: !0, attr: "data-testid", strip: "worktree-remove-" } }, { name: "worktree-error", selector: '[data-testid="worktree-error"]' }, { name: "worktree-new", selector: '[data-testid="worktree-new"]' }, { name: "worktree-name-input", selector: '[data-testid="worktree-name-input"]' }, { name: "worktree-start-input", selector: '[data-testid="worktree-start-input"]' }, { name: "worktree-branch-input", selector: '[data-testid="worktree-branch-input"]' }, { name: "worktree-parent-select", selector: '[data-testid="worktree-parent-select"]' }, { name: "worktree-new-branch", selector: '[data-testid="worktree-new-branch"]' }, { name: "worktree-path-input", selector: '[data-testid="worktree-path-input"]' }, { name: "worktree-agent-select", selector: '[data-testid="worktree-agent-select"]' }, { name: "worktree-create-cancel", selector: '[data-testid="worktree-create-cancel"]' }, { name: "worktree-create-submit", selector: '[data-testid="worktree-create-submit"]' }, { name: "worktree-confirm", selector: '[data-testid="confirm-dialog"]' }, { name: "worktree-confirm-message", selector: ".confirm-dialog__message" }, { name: "worktree-confirm-accept", selector: '[data-testid="confirm-accept"]' }, { name: "worktree-confirm-cancel", selector: '[data-testid="confirm-cancel"]' }], "terminal-search": [{ name: "terminal-frame", selector: '[data-testid="persistent-agent-terminal"]' }, { name: "term-search", selector: '[data-testid="term-search"]' }, { name: "term-search-input", selector: '[data-testid="term-search-input"]' }, { name: "term-search-button", selector: '[data-testid="term-search"] > button', key: { self: !0, attr: "title" } }], "agent-control": [{ name: "terminal-frame", selector: '[data-testid="persistent-agent-terminal"]' }, { name: "agent-control-chip", selector: '[data-testid="agent-control-chip"]' }, { name: "agent-control-label", selector: '[data-testid="agent-control-chip"] > span' }, { name: "agent-control-button", selector: '[data-testid="agent-control-chip"] > button' }, { name: "agent-control-error", selector: ".terminal__cli-error" }, { name: "agent-control-ended", selector: ".terminal__exited", key: { self: !0, attr: "data-testid" } }, { name: "agent-control-ended-text", selector: ".terminal__exited-text" }, { name: "agent-control-ended-button", selector: ".terminal__exited-actions > button", key: { self: !0, attr: "data-testid" } }], "phone-size": [{ name: "terminal-frame", selector: '[data-testid="persistent-agent-terminal"]' }, { name: "phone-size-notice", selector: '[data-testid="phone-size-notice"]' }, { name: "phone-size-chip", selector: '[data-testid="phone-size-chip"]' }, { name: "phone-size-heading", selector: '[data-testid="phone-size-notice"] span.font-semibold' }, { name: "phone-size-text", selector: '[data-testid="phone-size-notice"] span:not(.font-semibold)' }, { name: "phone-size-fold", selector: '[aria-label="Keep phone size and hide this"]' }, { name: "phone-size-button", selector: '[data-testid="phone-size-notice"] div.flex.flex-wrap > button, [data-testid="phone-size-chip"] > button' }], window: [{ name: "sidebar-card", selector: '[data-testid="sidebar-card"]' }, { name: "main-card", selector: '[data-testid="main-card"]' }, { name: "tools-card", selector: '[data-testid="tools-card"]' }, { name: "sidebar-toggle", selector: '[data-testid="sidebar-collapse-toggle"]' }, { name: "drawer-toggle", selector: '[data-testid="workspace-tools-toggle"]' }, { name: "resize-sidebar", selector: '[data-testid="resize-sidebar"]' }, { name: "resize-tools", selector: '[data-testid="resize-tools"]' }, { name: "tools-tab", selector: 'nav[aria-label="Files, Git and Browser"] > button' }, { name: "status-bar", selector: "footer.status-bar" }], settings: [{ name: "settings-modal", selector: '[data-testid="settings-modal"]' }, { name: "settings-nav-card", selector: '[data-testid="settings-modal"] > nav' }, { name: "settings-close", selector: '[data-testid="settings-close"]' }, { name: "settings-nav", selector: 'nav [data-testid^="settings-nav-"]', key: { self: !0, attr: "data-testid", strip: "settings-nav-" } }, { name: "settings-main-card", selector: '[data-testid="settings-modal"] > main' }, { name: "settings-search", selector: '[data-testid="settings-search"]' }, { name: "settings-title", selector: '[data-testid="settings-modal"] > main h1' }, { name: "settings-body", selector: '[data-testid="settings-modal"] .settings-modal__body' }, { name: "settings-group-title", selector: '[data-testid="settings-modal"] > main h3' }, { name: "settings-group-card", selector: '[data-testid="settings-modal"] > main section > div.rounded-ui' }, { name: "settings-row", selector: '[data-testid="settings-modal"] [data-setting-row]' }, { name: "settings-row-title", selector: '[data-testid="settings-modal"] [data-setting-row] > div:first-child > div:first-child' }, { name: "settings-row-description", selector: '[data-testid="settings-modal"] [data-setting-row] > div:first-child > div:nth-child(2)' }, { name: "settings-result-title", selector: '[data-testid^="settings-result-"] > h2' }] };
export {
  uy as NAMED_ELEMENTS,
  d0 as React,
  V0 as SCHEMA,
  sy as STYLE_KEYS,
  cy as describeToGpui,
  ly as jsxRuntime,
  ry as mount,
  iy as reactDom,
  oy as sdk
};
