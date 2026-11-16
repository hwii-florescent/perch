function ds(a, l) {
  for (var s = 0; s < l.length; s++) {
    const i = l[s];
    if (typeof i != "string" && !Array.isArray(i)) {
      for (const o in i)
        if (o !== "default" && !(o in a)) {
          const d = Object.getOwnPropertyDescriptor(i, o);
          d && Object.defineProperty(a, o, d.get ? d : {
            enumerable: !0,
            get: () => i[o]
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
class ae extends Error {
}
const qh = /* @__PURE__ */ new Set(["hover", "focus", "focus-visible", "focus-within", "active", "disabled", "enabled", "checked"]), Yh = /* @__PURE__ */ new Set(["not", "is", "where", "has", "nth-child"]), Gh = /* @__PURE__ */ new Set(["first-child", "last-child", "only-child", "root", ...qh]);
function Xo(a) {
  return a.replace(/\\(?:([0-9a-fA-F]{1,6})\s?|([\s\S]))/g, (l, s, i) => s ? String.fromCodePoint(parseInt(s, 16)) : i);
}
function bl(a, l) {
  let s = l;
  for (; s < a.length; ) {
    const i = a[s];
    if (i === "\\") {
      s += 2;
      continue;
    }
    if (/[A-Za-z0-9_\- -￿]/.test(i)) {
      s++;
      continue;
    }
    break;
  }
  if (s === l) throw new ae(`expected a name at ${l} in ${JSON.stringify(a)}`);
  return [Xo(a.slice(l, s)), s];
}
function Kh(a, l) {
  let s = 1;
  for (let i = l; i < a.length; i++) {
    const o = a[i];
    if (o === "\\") {
      i++;
      continue;
    }
    if (o === '"' || o === "'") {
      if (i = a.indexOf(o, i + 1), i < 0) break;
      continue;
    }
    if (o === "(") s++;
    else if (o === ")" && --s === 0) return i;
  }
  throw new ae(`unbalanced parenthesis in ${JSON.stringify(a)}`);
}
function fs(a) {
  const l = [];
  let s = 0, i = 0;
  for (let o = 0; o < a.length; o++) {
    const d = a[o];
    if (d === "\\") {
      o++;
      continue;
    }
    if (d === '"' || d === "'") {
      if (o = a.indexOf(d, o + 1), o < 0) break;
      continue;
    }
    d === "(" || d === "[" ? s++ : d === ")" || d === "]" ? s-- : d === "," && s === 0 && (l.push(a.slice(i, o).trim()), i = o + 1);
  }
  return l.push(a.slice(i).trim()), l.filter(Boolean);
}
function Qh(a, l) {
  const s = { tag: null, id: null, classes: [], attrs: [], pseudos: [], pseudoElement: null };
  let i = !1;
  for (; l < a.length; ) {
    const o = a[l];
    if (o === "*") {
      s.tag = "*", l++, i = !0;
      continue;
    }
    if (o === ".") {
      const [d, m] = bl(a, l + 1);
      s.classes.push(d), l = m, i = !0;
      continue;
    }
    if (o === "#") {
      const [d, m] = bl(a, l + 1);
      s.id = d, l = m, i = !0;
      continue;
    }
    if (o === "[") {
      const d = a.indexOf("]", l);
      if (d < 0) throw new ae(`unclosed [ in ${JSON.stringify(a)}`);
      const m = a.slice(l + 1, d).trim(), f = /^([^\s~^$*|=]+)\s*(?:([~^$*|]?=)\s*(?:"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'|([^\s"'\]]+)))?\s*(i)?$/.exec(m);
      if (!f) throw new ae(`cannot read the attribute selector [${m}]`);
      const h = f[3] ?? f[4] ?? f[5];
      s.attrs.push({ name: Xo(f[1]).toLowerCase(), op: f[2] ?? null, value: h === void 0 ? null : Xo(h) }), l = d + 1, i = !0;
      continue;
    }
    if (o === ":") {
      if (a[l + 1] === ":") {
        const [h, x] = bl(a, l + 2), S = h.toLowerCase();
        if (S !== "before" && S !== "after") throw new ae(`::${S} is not supported`);
        if (s.pseudoElement = S, l = x, i = !0, l < a.length && !/[\s>]/.test(a[l])) throw new ae(`nothing may follow ::${S} in ${JSON.stringify(a)}`);
        break;
      }
      const [d, m] = bl(a, l + 1);
      l = m;
      const f = d.toLowerCase();
      if ((f === "before" || f === "after") && a[l] !== "(") {
        if (s.pseudoElement = f, i = !0, l < a.length && !/[\s>]/.test(a[l])) throw new ae(`nothing may follow :${f} in ${JSON.stringify(a)}`);
        break;
      }
      if (a[l] === "(") {
        if (!Yh.has(f)) throw new ae(`:${f}() is not supported`);
        const h = Kh(a, l + 1), x = a.slice(l + 1, h).trim();
        if (l = h + 1, f === "nth-child") {
          if (!/^\d+$/.test(x)) throw new ae(`:nth-child(${x}) is not supported (only a number)`);
          s.pseudos.push({ name: f, n: Number(x) });
        } else {
          const S = fs(x).map(ms);
          if (f === "has" && S.some((k) => k.length !== 1)) throw new ae(`:has(${x}) is not supported (only a compound selector)`);
          s.pseudos.push({ name: f, list: S });
        }
      } else {
        if (!Gh.has(f)) throw new ae(`:${f} is not supported`);
        s.pseudos.push({ name: f });
      }
      i = !0;
      continue;
    }
    if (/[A-Za-z_\-\\]/.test(o) && !i) {
      const [d, m] = bl(a, l);
      s.tag = d.toLowerCase(), l = m, i = !0;
      continue;
    }
    break;
  }
  if (!i) throw new ae(`empty compound selector at ${l} in ${JSON.stringify(a)}`);
  return [s, l];
}
function ms(a) {
  const l = [];
  let s = 0, i = null;
  for (a = a.trim(); s < a.length; ) {
    const [o, d] = Qh(a, s);
    if (l.at(-1)?.compound.pseudoElement) throw new ae(`::${l.at(-1).compound.pseudoElement} must end ${JSON.stringify(a)}`);
    l.push({ compound: o, combinator: i }), s = d;
    let m = !1;
    for (; a[s] === " " || a[s] === `
` || a[s] === "	"; )
      s++, m = !0;
    if (s >= a.length) break;
    const f = a[s];
    if (f === ">")
      for (i = ">", s++; a[s] === " "; ) s++;
    else {
      if (f === "+" || f === "~") throw new ae(`the ${f} combinator is not supported`);
      if (m) i = " ";
      else throw new ae(`unexpected ${JSON.stringify(f)} in ${JSON.stringify(a)}`);
    }
  }
  if (!l.length) throw new ae("empty selector");
  return l;
}
const yd = /* @__PURE__ */ new Map();
function Lr(a) {
  let l = yd.get(a);
  return l || (l = fs(a).map(ms), yd.set(a, l)), l;
}
function df(a) {
  const l = [0, 0, 0], s = (i) => {
    l[0] += i[0], l[1] += i[1], l[2] += i[2];
  };
  for (const { compound: i } of a) {
    i.id && l[0]++, l[1] += i.classes.length + i.attrs.length, i.tag && i.tag !== "*" && l[2]++, i.pseudoElement && l[2]++;
    for (const o of i.pseudos)
      if (o.name !== "where")
        if (o.list) {
          const d = o.list.map(df).sort((m, f) => f[0] - m[0] || f[1] - m[1] || f[2] - m[2])[0];
          s(d);
        } else l[1]++;
  }
  return l;
}
function Vh(a, { name: l, op: s, value: i }) {
  const o = a.getAttribute(l);
  if (o == null) return !1;
  if (s === null) return !0;
  switch (s) {
    case "=":
      return o === i;
    case "^=":
      return i !== "" && o.startsWith(i);
    case "$=":
      return i !== "" && o.endsWith(i);
    case "*=":
      return i !== "" && o.includes(i);
    case "~=":
      return o.split(/\s+/).includes(i);
    case "|=":
      return o === i || o.startsWith(`${i}-`);
    default:
      return !1;
  }
}
function Nr(a) {
  return a.parentElement ? a.parentElement.children : [a];
}
function ff(a, l) {
  for (const s of a.children) if (l(s) || ff(s, l)) return !0;
  return !1;
}
function mf(a, l, s, i) {
  if ((l.pseudoElement ?? null) !== (i ? s.pseudo ?? null : null) || l.tag && l.tag !== "*" && a.tagName !== l.tag || l.id && a.getAttribute("id") !== l.id) return !1;
  if (l.classes.length) {
    const o = a.classList ?? [];
    for (const d of l.classes) if (!o.includes(d)) return !1;
  }
  for (const o of l.attrs) if (!Vh(a, o)) return !1;
  for (const o of l.pseudos)
    switch (o.name) {
      case "first-child":
        if (Nr(a)[0] !== a) return !1;
        break;
      case "only-child":
        if (Nr(a).length !== 1) return !1;
        break;
      case "last-child": {
        const d = Nr(a);
        if (d[d.length - 1] !== a) return !1;
        break;
      }
      case "nth-child":
        if (Nr(a).indexOf(a) !== o.n - 1) return !1;
        break;
      case "root":
        if (!a.isDocumentRoot) return !1;
        break;
      case "not":
        if (o.list.some((d) => qa(a, d, s, i))) return !1;
        break;
      case "has":
        if (a.watchesDescendants = !0, !o.list.some(([{ compound: d }]) => ff(a, (m) => mf(m, d, s, !1)))) return !1;
        break;
      case "is":
      case "where":
        if (!o.list.some((d) => qa(a, d, s, i))) return !1;
        break;
      default:
        if (!s.state || !s.state(a, o.name, i)) return !1;
    }
  return !0;
}
function qa(a, l, s, i = !0) {
  const o = (d, m, f) => {
    const { compound: h, combinator: x } = l[m];
    if (!mf(d, h, s, f)) return !1;
    if (m === 0) return !0;
    if (x === ">") return !!d.parentElement && o(d.parentElement, m - 1, !1);
    for (let S = d.parentElement; S; S = S.parentElement) if (o(S, m - 1, !1)) return !0;
    return !1;
  };
  return o(a, l.length - 1, i);
}
function Xh(a, l, s = {}) {
  return (typeof l == "string" ? Lr(l) : l).some((o) => qa(a, o, s));
}
function pf(a, l, s = {}) {
  return qa(a, l, s);
}
function kl(a, l, s = {}) {
  const i = Lr(l), o = [], d = (m) => {
    for (const f of m.children)
      i.some((h) => qa(f, h, s)) && o.push(f), d(f);
  };
  return d(a), o;
}
function hf(a, l, s = {}) {
  const i = Lr(l);
  for (let o = a; o; o = o.parentElement) if (i.some((d) => qa(o, d, s))) return o;
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
let Lh = 1;
class Lo {
  constructor(l = 0, s = 0, i = 0, o = 0) {
    this.x = l, this.y = s, this.width = i, this.height = o;
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
class ps {
  constructor() {
    this.listeners = [];
  }
  addEventListener(l, s, i) {
    const o = i === !0 || !!i?.capture;
    this.listeners.some((d) => d.type === l && d.listener === s && d.capture === o) || this.listeners.push({ type: l, listener: s, capture: o });
  }
  removeEventListener(l, s, i) {
    const o = i === !0 || !!i?.capture;
    this.listeners = this.listeners.filter((d) => !(d.type === l && d.listener === s && d.capture === o));
  }
}
class Zr {
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
class It extends ps {
  constructor(l, s = {}, i = null) {
    super(), this.nodeType = 1, this.id = `n${Lh++}`, this.tagName = l.toLowerCase(), this.props = s, this.childNodes = [], this.parentNode = null, this.ownerDocument = i, this.hidden = !1, this.state = { hover: !1, focus: !1, active: !1 }, this.bounds = null, this.version = 0;
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
    for (const [s, i] of Object.entries(this.props))
      s.startsWith("data-") && i != null && i !== !1 && (l[s.slice(5).replace(/-([a-z])/g, (o, d) => d.toUpperCase())] = String(i));
    return l;
  }
  /** The DOM attribute React would write for `name`, or null. */
  getAttribute(l) {
    const s = this.props;
    if (l === "class") return this.className || null;
    if (l === "id") return s.id != null ? String(s.id) : null;
    if (l === "style") return null;
    let o = s[l === "for" ? "htmlFor" : l === "tabindex" ? "tabIndex" : l];
    if (o === void 0 && !l.includes("-")) {
      const d = l.replace(/-([a-z])/g, (m, f) => f.toUpperCase());
      o = s[d];
    }
    return o == null || typeof o == "function" ? null : typeof o == "boolean" ? l.startsWith("aria-") || l.startsWith("data-") ? String(o) : o ? "" : null : String(o);
  }
  hasAttribute(l) {
    return this.getAttribute(l) !== null;
  }
  appendChild(l) {
    return l.parentNode && l.parentNode.removeChild(l), l.parentNode = this, this.childNodes.push(l), this.touchWatchers(), l;
  }
  insertBefore(l, s) {
    l.parentNode && l.parentNode.removeChild(l);
    const i = this.childNodes.indexOf(s);
    return l.parentNode = this, i < 0 ? this.childNodes.push(l) : this.childNodes.splice(i, 0, l), this.touchWatchers(), l;
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
    return Xh(this, l);
  }
  closest(l) {
    return hf(this, l);
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
    return l ? new Lo(l.x, l.y, l.width, l.height) : new Lo();
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
    const l = this, s = (m) => String(m).startsWith("--") ? String(m) : String(m).replace(/-([a-z])/g, (f, h) => h.toUpperCase()), i = (m) => {
      const f = l.props.style?.[m];
      return f == null || typeof f == "boolean" ? "" : typeof f == "number" && f !== 0 ? `${f}px` : String(f);
    }, o = (m) => l.inline && m in l.inline ? l.inline[m] : i(m), d = (m, f) => {
      const h = f == null ? "" : String(f);
      o(m) !== h && (l.inline ??= {}, h === i(m) ? delete l.inline[m] : l.inline[m] = h, l.touch(), l.ownerDocument?.restyled());
    };
    return this.styleView = new Proxy({}, {
      get: (m, f) => {
        if (typeof f == "string")
          return f === "setProperty" ? (h, x) => d(s(h), x) : f === "removeProperty" ? (h) => {
            const x = o(s(h));
            return d(s(h), ""), x;
          } : f === "getPropertyValue" ? (h) => o(s(h)) : o(f);
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
    return xd(this);
  }
  /** `outerHTML` without the attributes named in `omit` (by their DOM names), as the web's drag strips its copy. */
  copyMarkup(l = []) {
    return xd(this, l);
  }
}
const gf = Symbol("perch.stale-layout"), bf = 3;
let Br = !1;
function vf(a) {
  return () => {
    let l, s = !1;
    const i = (o) => {
      const d = Br;
      Br = o < bf;
      try {
        l = a();
      } catch (m) {
        const f = m?.[gf];
        if (!f) throw m;
        f.retries.push(() => {
          s || i(o + 1);
        });
      } finally {
        Br = d;
      }
    };
    return i(0), () => {
      s = !0, typeof l == "function" && l();
    };
  };
}
const Zo = "perch-dom:", Zh = /* @__PURE__ */ new Set(["children", "key", "ref", "dangerouslySetInnerHTML"]), Jh = { class: "className", for: "htmlFor", tabindex: "tabIndex" };
function xd(a, l = []) {
  const s = new Set(l.map((o) => Jh[o] ?? o)), i = (o) => {
    if (!(o instanceof It)) return { x: o.data, ...o.hidden ? { h: 1 } : {} };
    const d = {};
    for (const [m, f] of Object.entries(o.props))
      Zh.has(m) || s.has(m) || f == null || typeof f == "function" || typeof f == "symbol" || (d[m] = f);
    return { t: o.tagName, p: d, c: o.childNodes.map(i), ...o.hidden ? { h: 1 } : {} };
  };
  return Zo + JSON.stringify(i(a));
}
function Wh(a, l) {
  if (typeof a != "string" || !a.startsWith(Zo)) return null;
  let s;
  try {
    s = JSON.parse(a.slice(Zo.length));
  } catch {
    return null;
  }
  const i = (d) => !!d && typeof d == "object" && !Array.isArray(d), o = (d) => {
    if (!i(d)) throw new Error("not a node");
    let m;
    if (typeof d.x == "string") m = new Zr(d.x);
    else {
      if (typeof d.t != "string" || !/^[a-z][a-z0-9-]*$/i.test(d.t) || !i(d.p) || !Array.isArray(d.c)) throw new Error("not an element");
      m = new It(d.t, d.p, l);
      for (const f of d.c) m.appendChild(o(f));
    }
    return m.hidden = d.h === 1, m;
  };
  try {
    return [o(s)];
  } catch {
    return null;
  }
}
class Fh {
  observe() {
  }
  unobserve() {
  }
  disconnect() {
  }
}
class Ih {
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
function wd(a) {
  for (let l = a; l instanceof It; l = l.parentElement) l.touch();
}
class Ph extends ps {
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
    const i = s(this.measureKey(l));
    if (Br && (!i || this.stale?.())) throw { [gf]: this };
    return i ?? null;
  }
  /** An element's `style` was written: the tree is described again once the writing script is done. */
  restyled() {
    this.restyling || (this.restyling = !0, queueMicrotask(() => {
      this.restyling = !1, this.afterCommit?.();
    }));
  }
  focus(l) {
    this.activeElement && this.activeElement !== l && this.blur(this.activeElement), this.activeElement = l, l.state.focus = !0, l.state.pointerFocus = !1, wd(l), this.perch?.focused?.(l);
  }
  blur(l) {
    l.state.focus = !1, wd(l), this.activeElement === l && (this.activeElement = this.body);
  }
  querySelectorAll(l) {
    return kl(this.documentElement, l);
  }
  querySelector(l) {
    return this.querySelectorAll(l)[0] ?? null;
  }
  /** The element whose `id` prop is `id` (React's `useId` ids are not selectors). */
  getElementById(l) {
    return kl(this.documentElement, "*").find((s) => s.props?.id === l) ?? null;
  }
}
class $h extends ps {
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
  setTimeout(l, s, ...i) {
    return globalThis.setTimeout(l, s, ...i);
  }
  clearTimeout(l) {
    return globalThis.clearTimeout(l);
  }
}
function yf(a) {
  return {
    setTimeout: (l, s = 0, ...i) => a.setTimeout(() => l(...i), Math.max(0, Number(s) || 0)),
    clearTimeout: (l) => {
      l != null && a.clearTimeout(l);
    }
  };
}
const _d = Symbol.for("perch.react.globals");
function Ze(a, l, s) {
  Object.defineProperty(a, l, { value: s, configurable: !0, writable: !0, enumerable: !1 });
}
function t0(a, l = globalThis) {
  const s = new Ph(a), i = new $h(a, s);
  s.defaultView = i;
  const o = a.storage ?? new Ih();
  if (typeof l.setTimeout != "function") {
    if (typeof a.setTimeout != "function") throw new Error("the engine has no setTimeout and the perch host gives none (perch.setTimeout)");
    const f = yf(a);
    Ze(l, "setTimeout", f.setTimeout), Ze(l, "clearTimeout", f.clearTimeout);
  }
  typeof l.queueMicrotask != "function" && Ze(l, "queueMicrotask", (f) => {
    Promise.resolve().then(f);
  }), Ze(l, "requestAnimationFrame", (f) => l.setTimeout(() => f(Date.now()), 0)), Ze(l, "cancelAnimationFrame", (f) => l.clearTimeout(f));
  const d = { document: s, window: i, localStorage: o, HTMLElement: It, Element: It };
  for (const f of Object.keys(d))
    Object.defineProperty(l, f, { get: () => l[_d]?.[f], configurable: !0, enumerable: !1 });
  l[_d] = d, Ze(l, "DOMRect", Lo), Ze(l, "getComputedStyle", e0), typeof l.ResizeObserver != "function" && Ze(l, "ResizeObserver", Fh);
  const m = l.navigator && typeof l.navigator == "object" ? l.navigator : {};
  if (!m.clipboard && a.clipboard)
    try {
      Ze(m, "clipboard", a.clipboard);
    } catch {
    }
  return l.navigator || Ze(l, "navigator", m), { document: s, window: i, globals: d };
}
function e0(a) {
  const l = a?.ownerDocument?.computed?.(a) ?? {}, s = (i) => {
    const o = l[i];
    return typeof o == "string" || typeof o == "number" ? String(o) : "";
  };
  return new Proxy({}, {
    get: (i, o) => {
      if (typeof o == "string")
        return o === "getPropertyValue" ? (d) => s(String(d)) : s(o.replace(/[A-Z]/g, (d) => `-${d.toLowerCase()}`));
    }
  });
}
function Jo(a, l = !1) {
  if (!(l ? a?.tagName === "input" && xf(a) : a?.tagName === "button" && !/^(button|reset)$/.test(String(a.props.type ?? "submit")) && !a.props.disabled)) return null;
  for (let i = a.parentElement; i; i = i.parentElement) if (i.tagName === "form") return i;
  return null;
}
const xf = (a) => a?.tagName === "textarea" || a?.tagName === "input" && /^(text|search|url|email|tel|password|number|)$/.test(String(a.props.type ?? ""));
//! Evaluated before anything else in the runtime bundle: React's scheduler reads `setTimeout` and `queueMicrotask`
//! once, when it loads, so an engine without them (QuickJS) gets the host's (`perch.setTimeout`) first.
const Sd = globalThis.perch;
if (typeof globalThis.setTimeout != "function" && typeof Sd?.setTimeout == "function") {
  const a = yf(Sd);
  globalThis.setTimeout = a.setTimeout, globalThis.clearTimeout = a.clearTimeout;
}
typeof globalThis.queueMicrotask != "function" && (globalThis.queueMicrotask = (a) => {
  Promise.resolve().then(a);
});
function hs(a) {
  return a && a.__esModule && Object.prototype.hasOwnProperty.call(a, "default") ? a.default : a;
}
function n0(a) {
  if (Object.prototype.hasOwnProperty.call(a, "__esModule")) return a;
  var l = a.default;
  if (typeof l == "function") {
    var s = function i() {
      return this instanceof i ? Reflect.construct(l, arguments, this.constructor) : l.apply(this, arguments);
    };
    s.prototype = l.prototype;
  } else s = {};
  return Object.defineProperty(s, "__esModule", { value: !0 }), Object.keys(a).forEach(function(i) {
    var o = Object.getOwnPropertyDescriptor(a, i);
    Object.defineProperty(s, i, o.get ? o : {
      enumerable: !0,
      get: function() {
        return a[i];
      }
    });
  }), s;
}
var Do = { exports: {} }, pt = {};
/**
 * @license React
 * react.production.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var kd;
function a0() {
  if (kd) return pt;
  kd = 1;
  var a = Symbol.for("react.transitional.element"), l = Symbol.for("react.portal"), s = Symbol.for("react.fragment"), i = Symbol.for("react.strict_mode"), o = Symbol.for("react.profiler"), d = Symbol.for("react.consumer"), m = Symbol.for("react.context"), f = Symbol.for("react.forward_ref"), h = Symbol.for("react.suspense"), x = Symbol.for("react.memo"), S = Symbol.for("react.lazy"), k = Symbol.for("react.activity"), y = Symbol.iterator;
  function w(T) {
    return T === null || typeof T != "object" ? null : (T = y && T[y] || T["@@iterator"], typeof T == "function" ? T : null);
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
  }, _ = Object.assign, E = {};
  function O(T, X, et) {
    this.props = T, this.context = X, this.refs = E, this.updater = et || N;
  }
  O.prototype.isReactComponent = {}, O.prototype.setState = function(T, X) {
    if (typeof T != "object" && typeof T != "function" && T != null)
      throw Error(
        "takes an object of state variables to update or a function which returns an object of state variables."
      );
    this.updater.enqueueSetState(this, T, X, "setState");
  }, O.prototype.forceUpdate = function(T) {
    this.updater.enqueueForceUpdate(this, T, "forceUpdate");
  };
  function R() {
  }
  R.prototype = O.prototype;
  function A(T, X, et) {
    this.props = T, this.context = X, this.refs = E, this.updater = et || N;
  }
  var L = A.prototype = new R();
  L.constructor = A, _(L, O.prototype), L.isPureReactComponent = !0;
  var q = Array.isArray;
  function D() {
  }
  var g = { H: null, A: null, T: null, S: null }, p = Object.prototype.hasOwnProperty;
  function v(T, X, et) {
    var it = et.ref;
    return {
      $$typeof: a,
      type: T,
      key: X,
      ref: it !== void 0 ? it : null,
      props: et
    };
  }
  function z(T, X) {
    return v(T.type, X, T.props);
  }
  function M(T) {
    return typeof T == "object" && T !== null && T.$$typeof === a;
  }
  function H(T) {
    var X = { "=": "=0", ":": "=2" };
    return "$" + T.replace(/[=:]/g, function(et) {
      return X[et];
    });
  }
  var V = /\/+/g;
  function $(T, X) {
    return typeof T == "object" && T !== null && T.key != null ? H("" + T.key) : X.toString(36);
  }
  function tt(T) {
    switch (T.status) {
      case "fulfilled":
        return T.value;
      case "rejected":
        throw T.reason;
      default:
        switch (typeof T.status == "string" ? T.then(D, D) : (T.status = "pending", T.then(
          function(X) {
            T.status === "pending" && (T.status = "fulfilled", T.value = X);
          },
          function(X) {
            T.status === "pending" && (T.status = "rejected", T.reason = X);
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
  function Q(T, X, et, it, ot) {
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
            case S:
              return kt = T._init, Q(
                kt(T._payload),
                X,
                et,
                it,
                ot
              );
          }
      }
    if (kt)
      return ot = ot(T), kt = it === "" ? "." + $(T, 0) : it, q(ot) ? (et = "", kt != null && (et = kt.replace(V, "$&/") + "/"), Q(ot, X, et, "", function(Kn) {
        return Kn;
      })) : ot != null && (M(ot) && (ot = z(
        ot,
        et + (ot.key == null || T && T.key === ot.key ? "" : ("" + ot.key).replace(
          V,
          "$&/"
        ) + "/") + kt
      )), X.push(ot)), 1;
    kt = 0;
    var Zt = it === "" ? "." : it + ":";
    if (q(T))
      for (var ht = 0; ht < T.length; ht++)
        it = T[ht], st = Zt + $(it, ht), kt += Q(
          it,
          X,
          et,
          st,
          ot
        );
    else if (ht = w(T), typeof ht == "function")
      for (T = ht.call(T), ht = 0; !(it = T.next()).done; )
        it = it.value, st = Zt + $(it, ht++), kt += Q(
          it,
          X,
          et,
          st,
          ot
        );
    else if (st === "object") {
      if (typeof T.then == "function")
        return Q(
          tt(T),
          X,
          et,
          it,
          ot
        );
      throw X = String(T), Error(
        "Objects are not valid as a React child (found: " + (X === "[object Object]" ? "object with keys {" + Object.keys(T).join(", ") + "}" : X) + "). If you meant to render a collection of children, use an array instead."
      );
    }
    return kt;
  }
  function Z(T, X, et) {
    if (T == null) return T;
    var it = [], ot = 0;
    return Q(T, it, "", "", function(st) {
      return X.call(et, st, ot++);
    }), it;
  }
  function I(T) {
    if (T._status === -1) {
      var X = T._result;
      X = X(), X.then(
        function(et) {
          (T._status === 0 || T._status === -1) && (T._status = 1, T._result = et);
        },
        function(et) {
          (T._status === 0 || T._status === -1) && (T._status = 2, T._result = et);
        }
      ), T._status === -1 && (T._status = 0, T._result = X);
    }
    if (T._status === 1) return T._result.default;
    throw T._result;
  }
  var G = typeof reportError == "function" ? reportError : function(T) {
    if (typeof window == "object" && typeof window.ErrorEvent == "function") {
      var X = new window.ErrorEvent("error", {
        bubbles: !0,
        cancelable: !0,
        message: typeof T == "object" && T !== null && typeof T.message == "string" ? String(T.message) : String(T),
        error: T
      });
      if (!window.dispatchEvent(X)) return;
    } else if (typeof process == "object" && typeof process.emit == "function") {
      process.emit("uncaughtException", T);
      return;
    }
    console.error(T);
  }, K = {
    map: Z,
    forEach: function(T, X, et) {
      Z(
        T,
        function() {
          X.apply(this, arguments);
        },
        et
      );
    },
    count: function(T) {
      var X = 0;
      return Z(T, function() {
        X++;
      }), X;
    },
    toArray: function(T) {
      return Z(T, function(X) {
        return X;
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
  return pt.Activity = k, pt.Children = K, pt.Component = O, pt.Fragment = s, pt.Profiler = o, pt.PureComponent = A, pt.StrictMode = i, pt.Suspense = h, pt.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE = g, pt.__COMPILER_RUNTIME = {
    __proto__: null,
    c: function(T) {
      return g.H.useMemoCache(T);
    }
  }, pt.cache = function(T) {
    return function() {
      return T.apply(null, arguments);
    };
  }, pt.cacheSignal = function() {
    return null;
  }, pt.cloneElement = function(T, X, et) {
    if (T == null)
      throw Error(
        "The argument must be a React element, but you passed " + T + "."
      );
    var it = _({}, T.props), ot = T.key;
    if (X != null)
      for (st in X.key !== void 0 && (ot = "" + X.key), X)
        !p.call(X, st) || st === "key" || st === "__self" || st === "__source" || st === "ref" && X.ref === void 0 || (it[st] = X[st]);
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
  }, pt.createElement = function(T, X, et) {
    var it, ot = {}, st = null;
    if (X != null)
      for (it in X.key !== void 0 && (st = "" + X.key), X)
        p.call(X, it) && it !== "key" && it !== "__self" && it !== "__source" && (ot[it] = X[it]);
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
      $$typeof: S,
      _payload: { _status: -1, _result: T },
      _init: I
    };
  }, pt.memo = function(T, X) {
    return {
      $$typeof: x,
      type: T,
      compare: X === void 0 ? null : X
    };
  }, pt.startTransition = function(T) {
    var X = g.T, et = {};
    g.T = et;
    try {
      var it = T(), ot = g.S;
      ot !== null && ot(et, it), typeof it == "object" && it !== null && typeof it.then == "function" && it.then(D, G);
    } catch (st) {
      G(st);
    } finally {
      X !== null && et.types !== null && (X.types = et.types), g.T = X;
    }
  }, pt.unstable_useCacheRefresh = function() {
    return g.H.useCacheRefresh();
  }, pt.use = function(T) {
    return g.H.use(T);
  }, pt.useActionState = function(T, X, et) {
    return g.H.useActionState(T, X, et);
  }, pt.useCallback = function(T, X) {
    return g.H.useCallback(T, X);
  }, pt.useContext = function(T) {
    return g.H.useContext(T);
  }, pt.useDebugValue = function() {
  }, pt.useDeferredValue = function(T, X) {
    return g.H.useDeferredValue(T, X);
  }, pt.useEffect = function(T, X) {
    return g.H.useEffect(T, X);
  }, pt.useEffectEvent = function(T) {
    return g.H.useEffectEvent(T);
  }, pt.useId = function() {
    return g.H.useId();
  }, pt.useImperativeHandle = function(T, X, et) {
    return g.H.useImperativeHandle(T, X, et);
  }, pt.useInsertionEffect = function(T, X) {
    return g.H.useInsertionEffect(T, X);
  }, pt.useLayoutEffect = function(T, X) {
    return g.H.useLayoutEffect(T, X);
  }, pt.useMemo = function(T, X) {
    return g.H.useMemo(T, X);
  }, pt.useOptimistic = function(T, X) {
    return g.H.useOptimistic(T, X);
  }, pt.useReducer = function(T, X, et) {
    return g.H.useReducer(T, X, et);
  }, pt.useRef = function(T) {
    return g.H.useRef(T);
  }, pt.useState = function(T) {
    return g.H.useState(T);
  }, pt.useSyncExternalStore = function(T, X, et) {
    return g.H.useSyncExternalStore(
      T,
      X,
      et
    );
  }, pt.useTransition = function() {
    return g.H.useTransition();
  }, pt.version = "19.2.8", pt;
}
var Ed;
function l0() {
  return Ed || (Ed = 1, Do.exports = a0()), Do.exports;
}
var dt = l0();
const wf = /* @__PURE__ */ hs(dt), r0 = /* @__PURE__ */ ds({
  __proto__: null,
  default: wf
}, [dt]);
//! "react" as the runtime bundles it, for its own code, the stock screens and every screen's `react` import: React
//! itself, with `useEffect` and `useLayoutEffect` run through `measured` (`dom.mjs`), so an effect that measures a
//! box the engine has not laid out yet runs again once it has (layout readback).
const i0 = wf ?? r0;
function Fe(a, l) {
  return dt.useEffect(vf(a), l);
}
function Wo(a, l) {
  return dt.useLayoutEffect(vf(a), l);
}
const o0 = /* @__PURE__ */ ds({
  __proto__: null,
  default: i0,
  useEffect: Fe,
  useLayoutEffect: Wo
}, [dt]);
var Bo = { exports: {} }, vl = {};
/**
 * @license React
 * react-jsx-runtime.production.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var zd;
function s0() {
  if (zd) return vl;
  zd = 1;
  var a = Symbol.for("react.transitional.element"), l = Symbol.for("react.fragment");
  function s(i, o, d) {
    var m = null;
    if (d !== void 0 && (m = "" + d), o.key !== void 0 && (m = "" + o.key), "key" in o) {
      d = {};
      for (var f in o)
        f !== "key" && (d[f] = o[f]);
    } else d = o;
    return o = d.ref, {
      $$typeof: a,
      type: i,
      key: m,
      ref: o !== void 0 ? o : null,
      props: d
    };
  }
  return vl.Fragment = l, vl.jsx = s, vl.jsxs = s, vl;
}
var Nd;
function c0() {
  return Nd || (Nd = 1, Bo.exports = s0()), Bo.exports;
}
var ft = c0();
const u0 = /* @__PURE__ */ hs(ft), ny = /* @__PURE__ */ ds({
  __proto__: null,
  default: u0
}, [ft]);
var Ho = { exports: {} }, Uo = { exports: {} };
const d0 = /* @__PURE__ */ n0(o0);
var qo = { exports: {} }, Yo = {};
/**
 * @license React
 * scheduler.production.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var Td;
function f0() {
  return Td || (Td = 1, (function(a) {
    function l(Q, Z) {
      var I = Q.length;
      Q.push(Z);
      t: for (; 0 < I; ) {
        var G = I - 1 >>> 1, K = Q[G];
        if (0 < o(K, Z))
          Q[G] = Z, Q[I] = K, I = G;
        else break t;
      }
    }
    function s(Q) {
      return Q.length === 0 ? null : Q[0];
    }
    function i(Q) {
      if (Q.length === 0) return null;
      var Z = Q[0], I = Q.pop();
      if (I !== Z) {
        Q[0] = I;
        t: for (var G = 0, K = Q.length, T = K >>> 1; G < T; ) {
          var X = 2 * (G + 1) - 1, et = Q[X], it = X + 1, ot = Q[it];
          if (0 > o(et, I))
            it < K && 0 > o(ot, et) ? (Q[G] = ot, Q[it] = I, G = it) : (Q[G] = et, Q[X] = I, G = X);
          else if (it < K && 0 > o(ot, I))
            Q[G] = ot, Q[it] = I, G = it;
          else break t;
        }
      }
      return Z;
    }
    function o(Q, Z) {
      var I = Q.sortIndex - Z.sortIndex;
      return I !== 0 ? I : Q.id - Z.id;
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
    var h = [], x = [], S = 1, k = null, y = 3, w = !1, N = !1, _ = !1, E = !1, O = typeof setTimeout == "function" ? setTimeout : null, R = typeof clearTimeout == "function" ? clearTimeout : null, A = typeof setImmediate < "u" ? setImmediate : null;
    function L(Q) {
      for (var Z = s(x); Z !== null; ) {
        if (Z.callback === null) i(x);
        else if (Z.startTime <= Q)
          i(x), Z.sortIndex = Z.expirationTime, l(h, Z);
        else break;
        Z = s(x);
      }
    }
    function q(Q) {
      if (_ = !1, L(Q), !N)
        if (s(h) !== null)
          N = !0, D || (D = !0, H());
        else {
          var Z = s(x);
          Z !== null && tt(q, Z.startTime - Q);
        }
    }
    var D = !1, g = -1, p = 5, v = -1;
    function z() {
      return E ? !0 : !(a.unstable_now() - v < p);
    }
    function M() {
      if (E = !1, D) {
        var Q = a.unstable_now();
        v = Q;
        var Z = !0;
        try {
          t: {
            N = !1, _ && (_ = !1, R(g), g = -1), w = !0;
            var I = y;
            try {
              e: {
                for (L(Q), k = s(h); k !== null && !(k.expirationTime > Q && z()); ) {
                  var G = k.callback;
                  if (typeof G == "function") {
                    k.callback = null, y = k.priorityLevel;
                    var K = G(
                      k.expirationTime <= Q
                    );
                    if (Q = a.unstable_now(), typeof K == "function") {
                      k.callback = K, L(Q), Z = !0;
                      break e;
                    }
                    k === s(h) && i(h), L(Q);
                  } else i(h);
                  k = s(h);
                }
                if (k !== null) Z = !0;
                else {
                  var T = s(x);
                  T !== null && tt(
                    q,
                    T.startTime - Q
                  ), Z = !1;
                }
              }
              break t;
            } finally {
              k = null, y = I, w = !1;
            }
            Z = void 0;
          }
        } finally {
          Z ? H() : D = !1;
        }
      }
    }
    var H;
    if (typeof A == "function")
      H = function() {
        A(M);
      };
    else if (typeof MessageChannel < "u") {
      var V = new MessageChannel(), $ = V.port2;
      V.port1.onmessage = M, H = function() {
        $.postMessage(null);
      };
    } else
      H = function() {
        O(M, 0);
      };
    function tt(Q, Z) {
      g = O(function() {
        Q(a.unstable_now());
      }, Z);
    }
    a.unstable_IdlePriority = 5, a.unstable_ImmediatePriority = 1, a.unstable_LowPriority = 4, a.unstable_NormalPriority = 3, a.unstable_Profiling = null, a.unstable_UserBlockingPriority = 2, a.unstable_cancelCallback = function(Q) {
      Q.callback = null;
    }, a.unstable_forceFrameRate = function(Q) {
      0 > Q || 125 < Q ? console.error(
        "forceFrameRate takes a positive int between 0 and 125, forcing frame rates higher than 125 fps is not supported"
      ) : p = 0 < Q ? Math.floor(1e3 / Q) : 5;
    }, a.unstable_getCurrentPriorityLevel = function() {
      return y;
    }, a.unstable_next = function(Q) {
      switch (y) {
        case 1:
        case 2:
        case 3:
          var Z = 3;
          break;
        default:
          Z = y;
      }
      var I = y;
      y = Z;
      try {
        return Q();
      } finally {
        y = I;
      }
    }, a.unstable_requestPaint = function() {
      E = !0;
    }, a.unstable_runWithPriority = function(Q, Z) {
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
      var I = y;
      y = Q;
      try {
        return Z();
      } finally {
        y = I;
      }
    }, a.unstable_scheduleCallback = function(Q, Z, I) {
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
        id: S++,
        callback: Z,
        priorityLevel: Q,
        startTime: I,
        expirationTime: K,
        sortIndex: -1
      }, I > G ? (Q.sortIndex = I, l(x, Q), s(h) === null && Q === s(x) && (_ ? (R(g), g = -1) : _ = !0, tt(q, I - G))) : (Q.sortIndex = K, l(h, Q), N || w || (N = !0, D || (D = !0, H()))), Q;
    }, a.unstable_shouldYield = z, a.unstable_wrapCallback = function(Q) {
      var Z = y;
      return function() {
        var I = y;
        y = Z;
        try {
          return Q.apply(this, arguments);
        } finally {
          y = I;
        }
      };
    };
  })(Yo)), Yo;
}
var Cd;
function m0() {
  return Cd || (Cd = 1, qo.exports = f0()), qo.exports;
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
var Md;
function p0() {
  return Md || (Md = 1, (function(a) {
    a.exports = function(l) {
      function s(t, e, n, r) {
        return new Vm(t, e, n, r);
      }
      function i() {
      }
      function o(t) {
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
          throw Error(o(188));
      }
      function f(t) {
        var e = t.alternate;
        if (!e) {
          if (e = d(t), e === null) throw Error(o(188));
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
            throw Error(o(188));
          }
          if (n.return !== r.return) n = c, r = u;
          else {
            for (var b = !1, C = c.child; C; ) {
              if (C === n) {
                b = !0, n = c, r = u;
                break;
              }
              if (C === r) {
                b = !0, r = c, n = u;
                break;
              }
              C = C.sibling;
            }
            if (!b) {
              for (C = u.child; C; ) {
                if (C === n) {
                  b = !0, n = u, r = c;
                  break;
                }
                if (C === r) {
                  b = !0, r = u, n = c;
                  break;
                }
                C = C.sibling;
              }
              if (!b) throw Error(o(189));
            }
          }
          if (n.alternate !== r) throw Error(o(190));
        }
        if (n.tag !== 3) throw Error(o(188));
        return n.stateNode.current === n ? t : e;
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
      function S(t) {
        return t === null || typeof t != "object" ? null : (t = Uu && t[Uu] || t["@@iterator"], typeof t == "function" ? t : null);
      }
      function k(t) {
        if (t == null) return null;
        if (typeof t == "function")
          return t.$$typeof === Wm ? null : t.displayName || t.name || null;
        if (typeof t == "string") return t;
        switch (t) {
          case ya:
            return "Fragment";
          case to:
            return "Profiler";
          case Bu:
            return "StrictMode";
          case no:
            return "Suspense";
          case ao:
            return "SuspenseList";
          case ro:
            return "Activity";
        }
        if (typeof t == "object")
          switch (t.$$typeof) {
            case va:
              return "Portal";
            case _n:
              return t.displayName || "Context";
            case Hu:
              return (t._context.displayName || "Context") + ".Consumer";
            case eo:
              var e = t.render;
              return t = t.displayName, t || (t = e.displayName || e.name || "", t = t !== "" ? "ForwardRef(" + t + ")" : "ForwardRef"), t;
            case lo:
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
      function y(t) {
        return { current: t };
      }
      function w(t) {
        0 > _a || (t.current = fo[_a], fo[_a] = null, _a--);
      }
      function N(t, e) {
        _a++, fo[_a] = t.current, t.current = e;
      }
      function _(t) {
        return t >>>= 0, t === 0 ? 32 : 31 - (Sh(t) / kh | 0) | 0;
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
      function O(t, e, n) {
        var r = t.pendingLanes;
        if (r === 0) return 0;
        var c = 0, u = t.suspendedLanes, b = t.pingedLanes;
        t = t.warmLanes;
        var C = r & 134217727;
        return C !== 0 ? (r = C & ~u, r !== 0 ? c = E(r) : (b &= C, b !== 0 ? c = E(b) : n || (n = C & ~t, n !== 0 && (c = E(n))))) : (C = r & ~u, C !== 0 ? c = E(C) : b !== 0 ? c = E(b) : n || (n = r & ~t, n !== 0 && (c = E(n)))), c === 0 ? 0 : e !== 0 && e !== c && (e & u) === 0 && (u = c & -c, n = e & -e, u >= n || u === 32 && (n & 4194048) !== 0) ? e : c;
      }
      function R(t, e) {
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
      function q(t) {
        for (var e = [], n = 0; 31 > n; n++) e.push(t);
        return e;
      }
      function D(t, e) {
        t.pendingLanes |= e, e !== 268435456 && (t.suspendedLanes = 0, t.pingedLanes = 0, t.warmLanes = 0);
      }
      function g(t, e, n, r, c, u) {
        var b = t.pendingLanes;
        t.pendingLanes = n, t.suspendedLanes = 0, t.pingedLanes = 0, t.warmLanes = 0, t.expiredLanes &= n, t.entangledLanes &= n, t.errorRecoveryDisabledLanes &= n, t.shellSuspendCounter = 0;
        var C = t.entanglements, Y = t.expirationTimes, J = t.hiddenUpdates;
        for (n = b & ~n; 0 < n; ) {
          var P = 31 - xe(n), W = 1 << P;
          C[P] = 0, Y[P] = -1;
          var nt = J[P];
          if (nt !== null)
            for (J[P] = null, P = 0; P < nt.length; P++) {
              var gt = nt[P];
              gt !== null && (gt.lane &= -536870913);
            }
          n &= ~W;
        }
        r !== 0 && p(t, r, 0), u !== 0 && c === 0 && t.tag !== 0 && (t.suspendedLanes |= u & ~(b & ~e));
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
      function z(t, e) {
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
      function V(t) {
        if (typeof Ch == "function" && Mh(t), we && typeof we.setStrictMode == "function")
          try {
            we.setStrictMode(rl, t);
          } catch {
          }
      }
      function $(t, e) {
        return t === e && (t !== 0 || 1 / t === 1 / e) || t !== t && e !== e;
      }
      function tt(t) {
        if (ho === void 0)
          try {
            throw Error();
          } catch (n) {
            var e = n.stack.trim().match(/\n( *(at )?)/);
            ho = e && e[1] || "", ud = -1 < n.stack.indexOf(`
    at`) ? " (<anonymous>)" : -1 < n.stack.indexOf("@") ? "@unknown:0:0" : "";
          }
        return `
` + ho + t + ud;
      }
      function Q(t, e) {
        if (!t || go) return "";
        go = !0;
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
          var u = r.DetermineComponentFrameRoot(), b = u[0], C = u[1];
          if (b && C) {
            var Y = b.split(`
`), J = C.split(`
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
          go = !1, Error.prepareStackTrace = n;
        }
        return (n = t ? t.displayName || t.name : "") ? tt(n) : "";
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
      function I(t) {
        try {
          var e = "", n = null;
          do
            e += Z(t, n), n = t, t = t.return;
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
          var n = dd.get(t);
          return n !== void 0 ? n : (e = {
            value: t,
            source: e,
            stack: I(e)
          }, dd.set(t, e), e);
        }
        return {
          value: t,
          source: e,
          stack: I(e)
        };
      }
      function K(t, e) {
        ka[Ea++] = il, ka[Ea++] = ur, ur = t, il = e;
      }
      function T(t, e, n) {
        Te[Ce++] = Xe, Te[Ce++] = Le, Te[Ce++] = kn, kn = t;
        var r = Xe;
        t = Le;
        var c = 32 - xe(r) - 1;
        r &= ~(1 << c), n += 1;
        var u = 32 - xe(e) + c;
        if (30 < u) {
          var b = c - c % 5;
          u = (r & (1 << b) - 1).toString(32), r >>= b, c -= b, Xe = 1 << 32 - xe(e) + c | n << c | r, Le = u + t;
        } else
          Xe = 1 << u | n << c | r, Le = t;
      }
      function X(t) {
        t.return !== null && (K(t, 1), T(t, 1, 0));
      }
      function et(t) {
        for (; t === ur; )
          ur = ka[--Ea], ka[Ea] = null, il = ka[--Ea], ka[Ea] = null;
        for (; t === kn; )
          kn = Te[--Ce], Te[Ce] = null, Le = Te[--Ce], Te[Ce] = null, Xe = Te[--Ce], Te[Ce] = null;
      }
      function it(t, e) {
        Te[Ce++] = Xe, Te[Ce++] = Le, Te[Ce++] = kn, Xe = e.id, Le = e.overflow, kn = t;
      }
      function ot(t, e) {
        N(En, e), N(ol, t), N(te, null), t = Pm(e), w(te), N(te, t);
      }
      function st() {
        w(te), w(ol), w(En);
      }
      function kt(t) {
        t.memoizedState !== null && N(dr, t);
        var e = te.current, n = $m(e, t.type);
        e !== n && (N(ol, t), N(te, n));
      }
      function Zt(t) {
        ol.current === t && (w(te), w(ol)), dr.current === t && (w(dr), an ? Pn._currentValue = xa : Pn._currentValue2 = xa);
      }
      function ht(t) {
        var e = Error(
          o(
            418,
            1 < arguments.length && arguments[1] !== void 0 && arguments[1] ? "text" : "HTML",
            ""
          )
        );
        throw Ga(G(e, t)), bo;
      }
      function Kn(t, e) {
        if (!se) throw Error(o(175));
        $p(
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
        if (Vt ? e !== 3 && e !== 27 && (e !== 5 || Iu(t.type) && !rr(t.type, t.memoizedProps)) && Ot && ht(t) : e !== 3 && (e !== 5 || Iu(t.type) && !rr(t.type, t.memoizedProps)) && Ot && ht(t), Qn(t), e === 13) {
          if (!se) throw Error(o(316));
          if (t = t.memoizedState, t = t !== null ? t.dehydrated : null, !t) throw Error(o(317));
          Ot = lh(t);
        } else if (e === 31) {
          if (t = t.memoizedState, t = t !== null ? t.dehydrated : null, !t) throw Error(o(317));
          Ot = ah(t);
        } else
          Ot = Vt && e === 27 ? Qp(
            t.type,
            Ot
          ) : ee ? Fu(t.stateNode) : null;
        return !0;
      }
      function De() {
        se && (Ot = ee = null, St = !1);
      }
      function pn() {
        var t = zn;
        return t !== null && (ge === null ? ge = t : ge.push.apply(
          ge,
          t
        ), zn = null), t;
      }
      function Ga(t) {
        zn === null ? zn = [t] : zn.push(t);
      }
      function hn(t, e, n) {
        an ? (N(fr, e._currentValue), e._currentValue = n) : (N(fr, e._currentValue2), e._currentValue2 = n);
      }
      function Ie(t) {
        var e = fr.current;
        an ? t._currentValue = e : t._currentValue2 = e, w(fr);
      }
      function Ir(t, e, n) {
        for (; t !== null; ) {
          var r = t.alternate;
          if ((t.childLanes & e) !== e ? (t.childLanes |= e, r !== null && (r.childLanes |= e)) : r !== null && (r.childLanes & e) !== e && (r.childLanes |= e), t === n) break;
          t = t.return;
        }
      }
      function Pr(t, e, n, r) {
        var c = t.child;
        for (c !== null && (c.return = t); c !== null; ) {
          var u = c.dependencies;
          if (u !== null) {
            var b = c.child;
            u = u.firstContext;
            t: for (; u !== null; ) {
              var C = u;
              u = c;
              for (var Y = 0; Y < e.length; Y++)
                if (C.context === e[Y]) {
                  u.lanes |= n, C = u.alternate, C !== null && (C.lanes |= n), Ir(
                    u.return,
                    n,
                    t
                  ), r || (b = null);
                  break t;
                }
              u = C.next;
            }
          } else if (c.tag === 18) {
            if (b = c.return, b === null) throw Error(o(341));
            b.lanes |= n, u = b.alternate, u !== null && (u.lanes |= n), Ir(b, n, t), b = null;
          } else b = c.child;
          if (b !== null) b.return = c;
          else
            for (b = c; b !== null; ) {
              if (b === t) {
                b = null;
                break;
              }
              if (c = b.sibling, c !== null) {
                c.return = b.return, b = c;
                break;
              }
              b = b.return;
            }
          c = b;
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
            var b = c.alternate;
            if (b === null) throw Error(o(387));
            if (b = b.memoizedProps, b !== null) {
              var C = c.type;
              _e(c.pendingProps.value, b.value) || (t !== null ? t.push(C) : t = [C]);
            }
          } else if (c === dr.current) {
            if (b = c.alternate, b === null) throw Error(o(387));
            b.memoizedState.memoizedState !== c.memoizedState.memoizedState && (t !== null ? t.push(Pn) : t = [Pn]);
          }
          c = c.return;
        }
        t !== null && Pr(
          e,
          t,
          n,
          r
        ), e.flags |= 262144;
      }
      function Tl(t) {
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
      function Vn(t) {
        $n = t, rn = null, t = t.dependencies, t !== null && (t.firstContext = null);
      }
      function Pt(t) {
        return ks($n, t);
      }
      function Cl(t, e) {
        return $n === null && Vn(t), ks(t, e);
      }
      function ks(t, e) {
        var n = an ? e._currentValue : e._currentValue2;
        if (e = { context: e, memoizedValue: n, next: null }, rn === null) {
          if (t === null) throw Error(o(308));
          rn = e, t.dependencies = { lanes: 0, firstContext: e }, t.flags |= 524288;
        } else rn = rn.next = e;
        return n;
      }
      function $r() {
        return {
          controller: new jh(),
          data: /* @__PURE__ */ new Map(),
          refCount: 0
        };
      }
      function Ka(t) {
        t.refCount--, t.refCount === 0 && Oh(Rh, function() {
          t.controller.abort();
        });
      }
      function Ml() {
      }
      function Ke(t) {
        t !== za && t.next === null && (za === null ? mr = za = t : za = za.next = t), pr = !0, vo || (vo = !0, xm());
      }
      function ma(t, e) {
        if (!yo && pr) {
          yo = !0;
          do
            for (var n = !1, r = mr; r !== null; ) {
              if (t !== 0) {
                var c = r.pendingLanes;
                if (c === 0) var u = 0;
                else {
                  var b = r.suspendedLanes, C = r.pingedLanes;
                  u = (1 << 31 - xe(42 | t) + 1) - 1, u &= c & ~(b & ~C), u = u & 201326741 ? u & 201326741 | 1 : u ? u | 2 : 0;
                }
                u !== 0 && (n = !0, Cs(r, u));
              } else
                u = _t, u = O(
                  r,
                  r === At ? u : 0,
                  r.cancelPendingCommit !== null || r.timeoutHandle !== In
                ), (u & 3) === 0 || R(r, u) || (n = !0, Cs(r, u));
              r = r.next;
            }
          while (n);
          yo = !1;
        }
      }
      function Es() {
        zs();
      }
      function zs() {
        pr = vo = !1;
        var t = 0;
        ta !== 0 && sp() && (t = ta);
        for (var e = pe(), n = null, r = mr; r !== null; ) {
          var c = r.next, u = Ns(r, e);
          u === 0 ? (r.next = null, n === null ? mr = c : n.next = c, c === null && (za = n)) : (n = r, (t !== 0 || (u & 3) !== 0) && (pr = !0)), r = c;
        }
        Xt !== 0 && Xt !== 5 || ma(t), ta !== 0 && (ta = 0);
      }
      function Ns(t, e) {
        for (var n = t.suspendedLanes, r = t.pingedLanes, c = t.expirationTimes, u = t.pendingLanes & -62914561; 0 < u; ) {
          var b = 31 - xe(u), C = 1 << b, Y = c[b];
          Y === -1 ? ((C & n) === 0 || (C & r) !== 0) && (c[b] = A(C, e)) : Y <= e && (t.expiredLanes |= C), u &= ~C;
        }
        if (e = At, n = _t, n = O(
          t,
          t === e ? n : 0,
          t.cancelPendingCommit !== null || t.timeoutHandle !== In
        ), r = t.callbackNode, n === 0 || t === e && (Ct === 2 || Ct === 9) || t.cancelPendingCommit !== null)
          return r !== null && r !== null && mo(r), t.callbackNode = null, t.callbackPriority = 0;
        if ((n & 3) === 0 || R(t, n)) {
          if (e = n & -n, e === t.callbackPriority) return e;
          switch (r !== null && mo(r), H(n)) {
            case 2:
            case 8:
              n = Nh;
              break;
            case 32:
              n = po;
              break;
            case 268435456:
              n = Th;
              break;
            default:
              n = po;
          }
          return r = Ts.bind(null, t), n = cr(n, r), t.callbackPriority = e, t.callbackNode = n, e;
        }
        return r !== null && r !== null && mo(r), t.callbackPriority = 2, t.callbackNode = null, 2;
      }
      function Ts(t, e) {
        if (Xt !== 0 && Xt !== 5)
          return t.callbackNode = null, t.callbackPriority = 0, null;
        var n = t.callbackNode;
        if (el() && t.callbackNode !== n)
          return null;
        var r = _t;
        return r = O(
          t,
          t === At ? r : 0,
          t.cancelPendingCommit !== null || t.timeoutHandle !== In
        ), r === 0 ? null : (du(t, r, e), Ns(t, pe()), t.callbackNode != null && t.callbackNode === n ? Ts.bind(null, t) : null);
      }
      function Cs(t, e) {
        if (el()) return null;
        du(t, e, !0);
      }
      function xm() {
        hp ? gp(function() {
          (xt & 6) !== 0 ? cr(
            sd,
            Es
          ) : zs();
        }) : cr(
          sd,
          Es
        );
      }
      function ti() {
        if (ta === 0) {
          var t = Na;
          t === 0 && (t = ir, ir <<= 1, (ir & 261888) === 0 && (ir = 256)), ta = t;
        }
        return ta;
      }
      function wm(t, e) {
        if (sl === null) {
          var n = sl = [];
          xo = 0, Na = ti(), Ta = {
            status: "pending",
            value: void 0,
            then: function(r) {
              n.push(r);
            }
          };
        }
        return xo++, e.then(Ms, Ms), e;
      }
      function Ms() {
        if (--xo === 0 && sl !== null) {
          Ta !== null && (Ta.status = "fulfilled");
          var t = sl;
          sl = null, Na = 0, Ta = null;
          for (var e = 0; e < t.length; e++) (0, t[e])();
        }
      }
      function _m(t, e) {
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
      function ei() {
        var t = ea.current;
        return t !== null ? t : At.pooledCache;
      }
      function Al(t, e) {
        e === null ? N(ea, ea.current) : N(ea, e.pool);
      }
      function As() {
        var t = ei();
        return t === null ? null : {
          parent: an ? Rt._currentValue : Rt._currentValue2,
          pool: t
        };
      }
      function jl(t, e) {
        if (_e(t, e)) return !0;
        if (typeof t != "object" || t === null || typeof e != "object" || e === null)
          return !1;
        var n = Object.keys(t), r = Object.keys(e);
        if (n.length !== r.length) return !1;
        for (r = 0; r < n.length; r++) {
          var c = n[r];
          if (!Ah.call(e, c) || !_e(t[c], e[c]))
            return !1;
        }
        return !0;
      }
      function js(t) {
        return t = t.status, t === "fulfilled" || t === "rejected";
      }
      function Os(t, e, n) {
        switch (n = t[n], n === void 0 ? t.push(e) : n !== e && (e.then(Ml, Ml), e = n), e.status) {
          case "fulfilled":
            return e.value;
          case "rejected":
            throw t = e.reason, Ds(t), t;
          default:
            if (typeof e.status == "string") e.then(Ml, Ml);
            else {
              if (t = At, t !== null && 100 < t.shellSuspendCounter)
                throw Error(o(482));
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
                throw t = e.reason, Ds(t), t;
            }
            throw na = e, Ca;
        }
      }
      function Xn(t) {
        try {
          var e = t._init;
          return e(t._payload);
        } catch (n) {
          throw n !== null && typeof n == "object" && typeof n.then == "function" ? (na = n, Ca) : n;
        }
      }
      function Rs() {
        if (na === null) throw Error(o(459));
        var t = na;
        return na = null, t;
      }
      function Ds(t) {
        if (t === Ca || t === hr)
          throw Error(o(483));
      }
      function Ol(t) {
        var e = cl;
        return cl += 1, Ma === null && (Ma = []), Os(Ma, t, e);
      }
      function Qa(t, e) {
        e = e.props.ref, t.ref = e !== void 0 ? e : null;
      }
      function Rl(t, e) {
        throw e.$$typeof === Zm ? Error(o(525)) : (t = Object.prototype.toString.call(e), Error(
          o(
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
        function b(B) {
          return t && B.alternate === null && (B.flags |= 67108866), B;
        }
        function C(B, j, U, F) {
          return j === null || j.tag !== 6 ? (j = Fi(U, B.mode, F), j.return = B, j) : (j = c(j, U), j.return = B, j);
        }
        function Y(B, j, U, F) {
          var ut = U.type;
          return ut === ya ? P(
            B,
            j,
            U.props.children,
            F,
            U.key
          ) : j !== null && (j.elementType === ut || typeof ut == "object" && ut !== null && ut.$$typeof === Sn && Xn(ut) === j.type) ? (j = c(j, U.props), Qa(j, U), j.return = B, j) : (j = nr(
            U.type,
            U.key,
            U.props,
            null,
            B.mode,
            F
          ), Qa(j, U), j.return = B, j);
        }
        function J(B, j, U, F) {
          return j === null || j.tag !== 4 || j.stateNode.containerInfo !== U.containerInfo || j.stateNode.implementation !== U.implementation ? (j = Ii(U, B.mode, F), j.return = B, j) : (j = c(j, U.children || []), j.return = B, j);
        }
        function P(B, j, U, F, ut) {
          return j === null || j.tag !== 7 ? (j = Fn(
            U,
            B.mode,
            F,
            ut
          ), j.return = B, j) : (j = c(j, U), j.return = B, j);
        }
        function W(B, j, U) {
          if (typeof j == "string" && j !== "" || typeof j == "number" || typeof j == "bigint")
            return j = Fi(
              "" + j,
              B.mode,
              U
            ), j.return = B, j;
          if (typeof j == "object" && j !== null) {
            switch (j.$$typeof) {
              case ar:
                return U = nr(
                  j.type,
                  j.key,
                  j.props,
                  null,
                  B.mode,
                  U
                ), Qa(U, j), U.return = B, U;
              case va:
                return j = Ii(
                  j,
                  B.mode,
                  U
                ), j.return = B, j;
              case Sn:
                return j = Xn(j), W(B, j, U);
            }
            if (lr(j) || S(j))
              return j = Fn(
                j,
                B.mode,
                U,
                null
              ), j.return = B, j;
            if (typeof j.then == "function")
              return W(B, Ol(j), U);
            if (j.$$typeof === _n)
              return W(
                B,
                Cl(B, j),
                U
              );
            Rl(B, j);
          }
          return null;
        }
        function nt(B, j, U, F) {
          var ut = j !== null ? j.key : null;
          if (typeof U == "string" && U !== "" || typeof U == "number" || typeof U == "bigint")
            return ut !== null ? null : C(B, j, "" + U, F);
          if (typeof U == "object" && U !== null) {
            switch (U.$$typeof) {
              case ar:
                return U.key === ut ? Y(B, j, U, F) : null;
              case va:
                return U.key === ut ? J(B, j, U, F) : null;
              case Sn:
                return U = Xn(U), nt(B, j, U, F);
            }
            if (lr(U) || S(U))
              return ut !== null ? null : P(B, j, U, F, null);
            if (typeof U.then == "function")
              return nt(
                B,
                j,
                Ol(U),
                F
              );
            if (U.$$typeof === _n)
              return nt(
                B,
                j,
                Cl(B, U),
                F
              );
            Rl(B, U);
          }
          return null;
        }
        function gt(B, j, U, F, ut) {
          if (typeof F == "string" && F !== "" || typeof F == "number" || typeof F == "bigint")
            return B = B.get(U) || null, C(j, B, "" + F, ut);
          if (typeof F == "object" && F !== null) {
            switch (F.$$typeof) {
              case ar:
                return B = B.get(
                  F.key === null ? U : F.key
                ) || null, Y(j, B, F, ut);
              case va:
                return B = B.get(
                  F.key === null ? U : F.key
                ) || null, J(j, B, F, ut);
              case Sn:
                return F = Xn(F), gt(
                  B,
                  j,
                  U,
                  F,
                  ut
                );
            }
            if (lr(F) || S(F))
              return B = B.get(U) || null, P(j, B, F, ut, null);
            if (typeof F.then == "function")
              return gt(
                B,
                j,
                U,
                Ol(F),
                ut
              );
            if (F.$$typeof === _n)
              return gt(
                B,
                j,
                U,
                Cl(j, F),
                ut
              );
            Rl(j, F);
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
          if (U == null) throw Error(o(151));
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
          return t && mt.forEach(function(Uh) {
            return e(B, Uh);
          }), St && K(B, zt), ut;
        }
        function ia(B, j, U, F) {
          if (typeof U == "object" && U !== null && U.type === ya && U.key === null && (U = U.props.children), typeof U == "object" && U !== null) {
            switch (U.$$typeof) {
              case ar:
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
                      } else if (j.elementType === ut || typeof ut == "object" && ut !== null && ut.$$typeof === Sn && Xn(ut) === j.type) {
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
                  U.type === ya ? (F = Fn(
                    U.props.children,
                    B.mode,
                    F,
                    U.key
                  ), F.return = B, B = F) : (F = nr(
                    U.type,
                    U.key,
                    U.props,
                    null,
                    B.mode,
                    F
                  ), Qa(F, U), F.return = B, B = F);
                }
                return b(B);
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
                  F = Ii(U, B.mode, F), F.return = B, B = F;
                }
                return b(B);
              case Sn:
                return U = Xn(U), ia(
                  B,
                  j,
                  U,
                  F
                );
            }
            if (lr(U))
              return ne(
                B,
                j,
                U,
                F
              );
            if (S(U)) {
              if (ut = S(U), typeof ut != "function")
                throw Error(o(150));
              return U = ut.call(U), gl(
                B,
                j,
                U,
                F
              );
            }
            if (typeof U.then == "function")
              return ia(
                B,
                j,
                Ol(U),
                F
              );
            if (U.$$typeof === _n)
              return ia(
                B,
                j,
                Cl(B, U),
                F
              );
            Rl(B, U);
          }
          return typeof U == "string" && U !== "" || typeof U == "number" || typeof U == "bigint" ? (U = "" + U, j !== null && j.tag === 6 ? (n(B, j.sibling), F = c(j, U), F.return = B, B = F) : (n(B, j), F = Fi(U, B.mode, F), F.return = B, B = F), b(B)) : n(B, j);
        }
        return function(B, j, U, F) {
          try {
            cl = 0;
            var ut = ia(
              B,
              j,
              U,
              F
            );
            return Ma = null, ut;
          } catch (mt) {
            if (mt === Ca || mt === hr) throw mt;
            var Dt = s(29, mt, null, B.mode);
            return Dt.lanes = F, Dt.return = B, Dt;
          } finally {
          }
        };
      }
      function Dl() {
        for (var t = Aa, e = _o = Aa = 0; e < t; ) {
          var n = Ae[e];
          Ae[e++] = null;
          var r = Ae[e];
          Ae[e++] = null;
          var c = Ae[e];
          Ae[e++] = null;
          var u = Ae[e];
          if (Ae[e++] = null, r !== null && c !== null) {
            var b = r.pending;
            b === null ? c.next = c : (c.next = b.next, b.next = c), r.pending = c;
          }
          u !== 0 && Hs(n, c, u);
        }
      }
      function Bl(t, e, n, r) {
        Ae[Aa++] = t, Ae[Aa++] = e, Ae[Aa++] = n, Ae[Aa++] = r, _o |= r, t.lanes |= r, t = t.alternate, t !== null && (t.lanes |= r);
      }
      function ni(t, e, n, r) {
        return Bl(t, e, n, r), Hl(t);
      }
      function Ln(t, e) {
        return Bl(t, null, null, e), Hl(t);
      }
      function Hs(t, e, n) {
        t.lanes |= n;
        var r = t.alternate;
        r !== null && (r.lanes |= n);
        for (var c = !1, u = t.return; u !== null; )
          u.childLanes |= n, r = u.alternate, r !== null && (r.childLanes |= n), u.tag === 22 && (t = u.stateNode, t === null || t._visibility & 1 || (c = !0)), t = u, u = u.return;
        return t.tag === 3 ? (u = t.stateNode, c && e !== null && (c = 31 - xe(n), t = u.hiddenUpdates, r = t[c], r === null ? t[c] = [e] : r.push(e), e.lane = n | 536870912), u) : null;
      }
      function Hl(t) {
        if (50 < hl)
          throw hl = 0, Ro = null, Error(o(185));
        for (var e = t.return; e !== null; )
          t = e, e = t.return;
        return t.tag === 3 ? t.stateNode : null;
      }
      function ai(t) {
        t.updateQueue = {
          baseState: t.memoizedState,
          firstBaseUpdate: null,
          lastBaseUpdate: null,
          shared: { pending: null, lanes: 0, hiddenCallbacks: null },
          callbacks: null
        };
      }
      function li(t, e) {
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
          return c === null ? e.next = e : (e.next = c.next, c.next = e), r.pending = e, e = Hl(t), Hs(t, null, n), e;
        }
        return Bl(t, r, e, n), Hl(t);
      }
      function Va(t, e, n) {
        if (e = e.updateQueue, e !== null && (e = e.shared, (n & 4194048) !== 0)) {
          var r = e.lanes;
          r &= t.pendingLanes, n |= r, e.lanes = n, v(t, n);
        }
      }
      function ri(t, e) {
        var n = t.updateQueue, r = t.alternate;
        if (r !== null && (r = r.updateQueue, n === r)) {
          var c = null, u = null;
          if (n = n.firstBaseUpdate, n !== null) {
            do {
              var b = {
                lane: n.lane,
                tag: n.tag,
                payload: n.payload,
                callback: null,
                next: null
              };
              u === null ? c = u = b : u = u.next = b, n = n.next;
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
        if (So) {
          var t = Ta;
          if (t !== null) throw t;
        }
      }
      function La(t, e, n, r) {
        So = !1;
        var c = t.updateQueue;
        Nn = !1;
        var u = c.firstBaseUpdate, b = c.lastBaseUpdate, C = c.shared.pending;
        if (C !== null) {
          c.shared.pending = null;
          var Y = C, J = Y.next;
          Y.next = null, b === null ? u = J : b.next = J, b = Y;
          var P = t.alternate;
          P !== null && (P = P.updateQueue, C = P.lastBaseUpdate, C !== b && (C === null ? P.firstBaseUpdate = J : C.next = J, P.lastBaseUpdate = Y));
        }
        if (u !== null) {
          var W = c.baseState;
          b = 0, P = J = Y = null, C = u;
          do {
            var nt = C.lane & -536870913, gt = nt !== C.lane;
            if (gt ? (_t & nt) === nt : (r & nt) === nt) {
              nt !== 0 && nt === Na && (So = !0), P !== null && (P = P.next = {
                lane: 0,
                tag: C.tag,
                payload: C.payload,
                callback: null,
                next: null
              });
              t: {
                var ne = t, gl = C;
                nt = e;
                var ia = n;
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
                    W = $i({}, W, nt);
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
              }, P === null ? (J = P = gt, Y = W) : P = P.next = gt, b |= nt;
            if (C = C.next, C === null) {
              if (C = c.shared.pending, C === null)
                break;
              gt = C, C = gt.next, gt.next = null, c.lastBaseUpdate = gt, c.shared.pending = null;
            }
          } while (!0);
          P === null && (Y = W), c.baseState = Y, c.firstBaseUpdate = J, c.lastBaseUpdate = P, u === null && (c.shared.lanes = 0), Cn |= b, t.lanes = b, t.memoizedState = W;
        }
      }
      function Us(t, e) {
        if (typeof t != "function")
          throw Error(o(191, t));
        t.call(e);
      }
      function qs(t, e) {
        var n = t.callbacks;
        if (n !== null)
          for (t.callbacks = null, t = 0; t < n.length; t++)
            Us(n[t], e);
      }
      function Ys(t, e) {
        t = cn, N(br, t), N(ja, e), cn = t | e.baseLanes;
      }
      function ii() {
        N(br, cn), N(ja, ja.current);
      }
      function oi() {
        cn = br.current, w(ja), w(br);
      }
      function vn(t) {
        var e = t.alternate;
        N(qt, qt.current & 1), N(Se, t), je === null && (e === null || ja.current !== null || e.memoizedState !== null) && (je = t);
      }
      function si(t) {
        N(qt, qt.current), N(Se, t), je === null && (je = t);
      }
      function Gs(t) {
        t.tag === 22 ? (N(qt, qt.current), N(Se, t), je === null && (je = t)) : yn();
      }
      function yn() {
        N(qt, qt.current), N(Se, Se.current);
      }
      function be(t) {
        w(Se), je === t && (je = null), w(qt);
      }
      function Ul(t) {
        for (var e = t; e !== null; ) {
          if (e.tag === 13) {
            var n = e.memoizedState;
            if (n !== null && (n = n.dehydrated, n === null || so(n) || co(n)))
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
        throw Error(o(321));
      }
      function ci(t, e) {
        if (e === null) return !1;
        for (var n = 0; n < e.length && n < t.length; n++)
          if (!_e(t[n], e[n])) return !1;
        return !0;
      }
      function ui(t, e, n, r, c, u) {
        return on = u, bt = e, e.memoizedState = null, e.updateQueue = null, e.lanes = 0, ct.H = t === null || t.memoizedState === null ? pd : ko, la = !1, u = n(r, c), la = !1, Oa && (u = Qs(
          e,
          n,
          r,
          c
        )), Ks(t), u;
      }
      function Ks(t) {
        ct.H = dl;
        var e = Mt !== null && Mt.next !== null;
        if (on = 0, Yt = Mt = bt = null, vr = !1, ul = 0, Ra = null, e) throw Error(o(300));
        t === null || Gt || (t = t.dependencies, t !== null && Tl(t) && (Gt = !0));
      }
      function Qs(t, e, n, r) {
        bt = t;
        var c = 0;
        do {
          if (Oa && (Ra = null), ul = 0, Oa = !1, 25 <= c) throw Error(o(301));
          if (c += 1, Yt = Mt = null, t.updateQueue != null) {
            var u = t.updateQueue;
            u.lastEffect = null, u.events = null, u.stores = null, u.memoCache != null && (u.memoCache.index = 0);
          }
          ct.H = hd, u = e(n, r);
        } while (Oa);
        return u;
      }
      function Sm() {
        var t = ct.H, e = t.useState()[0];
        return e = typeof e.then == "function" ? Za(e) : e, t = t.useState()[0], (Mt !== null ? Mt.memoizedState : null) !== t && (bt.flags |= 1024), e;
      }
      function di() {
        var t = yr !== 0;
        return yr = 0, t;
      }
      function fi(t, e, n) {
        e.updateQueue = t.updateQueue, e.flags &= -2053, t.lanes &= ~n;
      }
      function mi(t) {
        if (vr) {
          for (t = t.memoizedState; t !== null; ) {
            var e = t.queue;
            e !== null && (e.pending = null), t = t.next;
          }
          vr = !1;
        }
        on = 0, Yt = Mt = bt = null, Oa = !1, ul = yr = 0, Ra = null;
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
            throw bt.alternate === null ? Error(o(467)) : Error(o(310));
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
        return ul += 1, Ra === null && (Ra = []), t = Os(Ra, t, e), e = bt, (Yt === null ? e.memoizedState : Yt.next) === null && (e = e.alternate, ct.H = e === null || e.memoizedState === null ? pd : ko), t;
      }
      function Yl(t) {
        if (t !== null && typeof t == "object") {
          if (typeof t.then == "function") return Za(t);
          if (t.$$typeof === _n) return Pt(t);
        }
        throw Error(o(438, String(t)));
      }
      function pi(t) {
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
        if (e == null && (e = { data: [], index: 0 }), n === null && (n = ql(), bt.updateQueue = n), n.memoCache = e, n = e.data[e.index], n === void 0)
          for (n = e.data[e.index] = Array(t), r = 0; r < t; r++)
            n[r] = Jm;
        return e.index++, n;
      }
      function Pe(t, e) {
        return typeof e == "function" ? e(t) : e;
      }
      function Gl(t) {
        var e = Ut();
        return hi(e, Mt, t);
      }
      function hi(t, e, n) {
        var r = t.queue;
        if (r === null) throw Error(o(311));
        r.lastRenderedReducer = n;
        var c = t.baseQueue, u = r.pending;
        if (u !== null) {
          if (c !== null) {
            var b = c.next;
            c.next = u.next, u.next = b;
          }
          e.baseQueue = c = u, r.pending = null;
        }
        if (u = t.baseState, c === null) t.memoizedState = u;
        else {
          e = c.next;
          var C = b = null, Y = null, J = e, P = !1;
          do {
            var W = J.lane & -536870913;
            if (W !== J.lane ? (_t & W) === W : (on & W) === W) {
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
              else if ((on & nt) === nt) {
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
                }, Y === null ? (C = Y = W, b = u) : Y = Y.next = W, bt.lanes |= nt, Cn |= nt;
              W = J.action, la && n(u, W), u = J.hasEagerState ? J.eagerState : n(u, W);
            } else
              nt = {
                lane: W,
                revertLane: J.revertLane,
                gesture: J.gesture,
                action: J.action,
                hasEagerState: J.hasEagerState,
                eagerState: J.eagerState,
                next: null
              }, Y === null ? (C = Y = nt, b = u) : Y = Y.next = nt, bt.lanes |= W, Cn |= W;
            J = J.next;
          } while (J !== null && J !== e);
          if (Y === null ? b = u : Y.next = C, !_e(u, t.memoizedState) && (Gt = !0, P && (n = Ta, n !== null)))
            throw n;
          t.memoizedState = u, t.baseState = b, t.baseQueue = Y, r.lastRenderedState = u;
        }
        return c === null && (r.lanes = 0), [t.memoizedState, r.dispatch];
      }
      function gi(t) {
        var e = Ut(), n = e.queue;
        if (n === null) throw Error(o(311));
        n.lastRenderedReducer = t;
        var r = n.dispatch, c = n.pending, u = e.memoizedState;
        if (c !== null) {
          n.pending = null;
          var b = c = c.next;
          do
            u = t(u, b.action), b = b.next;
          while (b !== c);
          _e(u, e.memoizedState) || (Gt = !0), e.memoizedState = u, e.baseQueue === null && (e.baseState = u), n.lastRenderedState = u;
        }
        return [u, r];
      }
      function Vs(t, e, n) {
        var r = bt, c = Ut(), u = St;
        if (u) {
          if (n === void 0)
            throw Error(o(407));
          n = n();
        } else n = e();
        var b = !_e(
          (Mt || c).memoizedState,
          n
        );
        if (b && (c.memoizedState = n, Gt = !0), c = c.queue, yi(Zs.bind(null, r, c, t), [
          t
        ]), c.getSnapshot !== e || b || Yt !== null && Yt.memoizedState.tag & 1) {
          if (r.flags |= 2048, pa(
            9,
            { destroy: void 0 },
            Ls.bind(
              null,
              r,
              c,
              n,
              e
            ),
            null
          ), At === null) throw Error(o(349));
          u || (on & 127) !== 0 || Xs(r, e, n);
        }
        return n;
      }
      function Xs(t, e, n) {
        t.flags |= 16384, t = { getSnapshot: e, value: n }, e = bt.updateQueue, e === null ? (e = ql(), bt.updateQueue = e, e.stores = [t]) : (n = e.stores, n === null ? e.stores = [t] : n.push(t));
      }
      function Ls(t, e, n, r) {
        e.value = n, e.getSnapshot = r, Js(e) && Ws(t);
      }
      function Zs(t, e, n) {
        return n(function() {
          Js(e) && Ws(t);
        });
      }
      function Js(t) {
        var e = t.getSnapshot;
        t = t.value;
        try {
          var n = e();
          return !_e(t, n);
        } catch {
          return !0;
        }
      }
      function Ws(t) {
        var e = Ln(t, 2);
        e !== null && me(e, t, 2);
      }
      function bi(t) {
        var e = de();
        if (typeof t == "function") {
          var n = t;
          if (t = n(), la) {
            V(!0);
            try {
              n();
            } finally {
              V(!1);
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
      function Fs(t, e, n, r) {
        return t.baseState = n, hi(
          t,
          Mt,
          typeof r == "function" ? r : Pe
        );
      }
      function km(t, e, n, r, c) {
        if (Vl(t)) throw Error(o(485));
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
            then: function(b) {
              u.listeners.push(b);
            }
          };
          ct.T !== null ? n(!0) : u.isTransition = !1, r(u), n = e.pending, n === null ? (u.next = e.pending = u, Is(e, u)) : (u.next = n.next, e.pending = n.next = u);
        }
      }
      function Is(t, e) {
        var n = e.action, r = e.payload, c = t.state;
        if (e.isTransition) {
          var u = ct.T, b = {};
          ct.T = b;
          try {
            var C = n(c, r), Y = ct.S;
            Y !== null && Y(b, C), Ps(t, e, C);
          } catch (J) {
            vi(t, e, J);
          } finally {
            u !== null && b.types !== null && (u.types = b.types), ct.T = u;
          }
        } else
          try {
            u = n(c, r), Ps(t, e, u);
          } catch (J) {
            vi(t, e, J);
          }
      }
      function Ps(t, e, n) {
        n !== null && typeof n == "object" && typeof n.then == "function" ? n.then(
          function(r) {
            $s(t, e, r);
          },
          function(r) {
            return vi(t, e, r);
          }
        ) : $s(t, e, n);
      }
      function $s(t, e, n) {
        e.status = "fulfilled", e.value = n, tc(e), t.state = n, e = t.pending, e !== null && (n = e.next, n === e ? t.pending = null : (n = n.next, e.next = n, Is(t, n)));
      }
      function vi(t, e, n) {
        var r = t.pending;
        if (t.pending = null, r !== null) {
          r = r.next;
          do
            e.status = "rejected", e.reason = n, tc(e), e = e.next;
          while (e !== r);
        }
        t.action = null;
      }
      function tc(t) {
        t = t.listeners;
        for (var e = 0; e < t.length; e++) (0, t[e])();
      }
      function ec(t, e) {
        return e;
      }
      function nc(t, e) {
        if (St) {
          var n = At.formState;
          if (n !== null) {
            t: {
              var r = bt;
              if (St) {
                if (Ot) {
                  var c = Gp(
                    Ot,
                    Me
                  );
                  if (c) {
                    Ot = Fu(c), r = Kp(c);
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
        n = de(), n.memoizedState = n.baseState = e, r = {
          pending: null,
          lanes: 0,
          dispatch: null,
          lastRenderedReducer: ec,
          lastRenderedState: e
        }, n.queue = r, n = xc.bind(
          null,
          bt,
          r
        ), r.dispatch = n, r = bi(!1);
        var u = Si.bind(
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
        }, r.queue = c, n = km.bind(
          null,
          bt,
          c,
          u,
          n
        ), c.dispatch = n, r.memoizedState = t, [e, n, !1];
      }
      function ac(t) {
        var e = Ut();
        return lc(e, Mt, t);
      }
      function lc(t, e, n) {
        if (e = hi(
          t,
          e,
          ec
        )[0], t = Gl(Pe)[0], typeof e == "object" && e !== null && typeof e.then == "function")
          try {
            var r = Za(e);
          } catch (b) {
            throw b === Ca ? hr : b;
          }
        else r = e;
        e = Ut();
        var c = e.queue, u = c.dispatch;
        return n !== e.memoizedState && (bt.flags |= 2048, pa(
          9,
          { destroy: void 0 },
          Em.bind(null, c, n),
          null
        )), [r, u, t];
      }
      function Em(t, e) {
        t.action = e;
      }
      function rc(t) {
        var e = Ut(), n = Mt;
        if (n !== null)
          return lc(e, n, t);
        Ut(), e = e.memoizedState, n = Ut();
        var r = n.queue.dispatch;
        return n.memoizedState = t, [e, r, !1];
      }
      function pa(t, e, n, r) {
        return t = { tag: t, create: n, deps: r, inst: e, next: null }, e = bt.updateQueue, e === null && (e = ql(), bt.updateQueue = e), n = e.lastEffect, n === null ? e.lastEffect = t.next = t : (r = n.next, n.next = t, t.next = r, e.lastEffect = t), t;
      }
      function ic() {
        return Ut().memoizedState;
      }
      function Kl(t, e, n, r) {
        var c = de();
        bt.flags |= t, c.memoizedState = pa(
          1 | e,
          { destroy: void 0 },
          n,
          r === void 0 ? null : r
        );
      }
      function Ql(t, e, n, r) {
        var c = Ut();
        r = r === void 0 ? null : r;
        var u = c.memoizedState.inst;
        Mt !== null && r !== null && ci(r, Mt.memoizedState.deps) ? c.memoizedState = pa(e, u, n, r) : (bt.flags |= t, c.memoizedState = pa(
          1 | e,
          u,
          n,
          r
        ));
      }
      function oc(t, e) {
        Kl(8390656, 8, t, e);
      }
      function yi(t, e) {
        Ql(2048, 8, t, e);
      }
      function zm(t) {
        bt.flags |= 4;
        var e = bt.updateQueue;
        if (e === null)
          e = ql(), bt.updateQueue = e, e.events = [t];
        else {
          var n = e.events;
          n === null ? e.events = [t] : n.push(t);
        }
      }
      function sc(t) {
        var e = Ut().memoizedState;
        return zm({ ref: e, nextImpl: t }), function() {
          if ((xt & 2) !== 0)
            throw Error(o(440));
          return e.impl.apply(void 0, arguments);
        };
      }
      function cc(t, e) {
        return Ql(4, 2, t, e);
      }
      function uc(t, e) {
        return Ql(4, 4, t, e);
      }
      function dc(t, e) {
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
      function fc(t, e, n) {
        n = n != null ? n.concat([t]) : null, Ql(
          4,
          4,
          dc.bind(null, e, t),
          n
        );
      }
      function xi() {
      }
      function mc(t, e) {
        var n = Ut();
        e = e === void 0 ? null : e;
        var r = n.memoizedState;
        return e !== null && ci(e, r[1]) ? r[0] : (n.memoizedState = [t, e], t);
      }
      function pc(t, e) {
        var n = Ut();
        e = e === void 0 ? null : e;
        var r = n.memoizedState;
        if (e !== null && ci(e, r[1]))
          return r[0];
        if (r = t(), la) {
          V(!0);
          try {
            t();
          } finally {
            V(!1);
          }
        }
        return n.memoizedState = [r, e], r;
      }
      function wi(t, e, n) {
        return n === void 0 || (on & 1073741824) !== 0 && (_t & 261930) === 0 ? t.memoizedState = e : (t.memoizedState = n, t = uu(), bt.lanes |= t, Cn |= t, n);
      }
      function hc(t, e, n, r) {
        return _e(n, e) ? n : ja.current !== null ? (t = wi(t, n, r), _e(t, e) || (Gt = !0), t) : (on & 42) === 0 || (on & 1073741824) !== 0 && (_t & 261930) === 0 ? (Gt = !0, t.memoizedState = n) : (t = uu(), bt.lanes |= t, Cn |= t, e);
      }
      function gc(t, e, n, r, c) {
        var u = ln();
        Jt(
          u !== 0 && 8 > u ? u : 8
        );
        var b = ct.T, C = {};
        ct.T = C, Si(t, !1, e, n);
        try {
          var Y = c(), J = ct.S;
          if (J !== null && J(C, Y), Y !== null && typeof Y == "object" && typeof Y.then == "function") {
            var P = _m(
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
          Jt(u), b !== null && C.types !== null && (b.types = C.types), ct.T = b;
        }
      }
      function bc(t) {
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
      function _i() {
        return Pt(Pn);
      }
      function vc() {
        return Ut().memoizedState;
      }
      function yc() {
        return Ut().memoizedState;
      }
      function Nm(t) {
        for (var e = t.return; e !== null; ) {
          switch (e.tag) {
            case 24:
            case 3:
              var n = ve();
              t = gn(n);
              var r = bn(e, t, n);
              r !== null && (me(r, e, n), Va(r, e, n)), e = { cache: $r() }, t.payload = e;
              return;
          }
          e = e.return;
        }
      }
      function Tm(t, e, n) {
        var r = ve();
        n = {
          lane: r,
          revertLane: 0,
          gesture: null,
          action: n,
          hasEagerState: !1,
          eagerState: null,
          next: null
        }, Vl(t) ? wc(e, n) : (n = ni(t, e, n, r), n !== null && (me(n, t, r), _c(n, e, r)));
      }
      function xc(t, e, n) {
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
        if (Vl(t)) wc(e, c);
        else {
          var u = t.alternate;
          if (t.lanes === 0 && (u === null || u.lanes === 0) && (u = e.lastRenderedReducer, u !== null))
            try {
              var b = e.lastRenderedState, C = u(b, n);
              if (c.hasEagerState = !0, c.eagerState = C, _e(C, b))
                return Bl(t, e, c, 0), At === null && Dl(), !1;
            } catch {
            } finally {
            }
          if (n = ni(t, e, c, r), n !== null)
            return me(n, t, r), _c(n, e, r), !0;
        }
        return !1;
      }
      function Si(t, e, n, r) {
        if (r = {
          lane: 2,
          revertLane: ti(),
          gesture: null,
          action: r,
          hasEagerState: !1,
          eagerState: null,
          next: null
        }, Vl(t)) {
          if (e) throw Error(o(479));
        } else
          e = ni(
            t,
            n,
            r,
            2
          ), e !== null && me(e, t, 2);
      }
      function Vl(t) {
        var e = t.alternate;
        return t === bt || e !== null && e === bt;
      }
      function wc(t, e) {
        Oa = vr = !0;
        var n = t.pending;
        n === null ? e.next = e : (e.next = n.next, n.next = e), t.pending = e;
      }
      function _c(t, e, n) {
        if ((n & 4194048) !== 0) {
          var r = e.lanes;
          r &= t.pendingLanes, n |= r, e.lanes = n, v(t, n);
        }
      }
      function ki(t, e, n, r) {
        e = t.memoizedState, n = n(r, e), n = n == null ? e : $i({}, e, n), t.memoizedState = n, t.lanes === 0 && (t.updateQueue.baseState = n);
      }
      function Sc(t, e, n, r, c, u, b) {
        return t = t.stateNode, typeof t.shouldComponentUpdate == "function" ? t.shouldComponentUpdate(r, u, b) : e.prototype && e.prototype.isPureReactComponent ? !jl(n, r) || !jl(c, u) : !0;
      }
      function kc(t, e, n, r) {
        t = e.state, typeof e.componentWillReceiveProps == "function" && e.componentWillReceiveProps(n, r), typeof e.UNSAFE_componentWillReceiveProps == "function" && e.UNSAFE_componentWillReceiveProps(n, r), e.state !== t && Eo.enqueueReplaceState(e, e.state, null);
      }
      function Zn(t, e) {
        var n = e;
        if ("ref" in e) {
          n = {};
          for (var r in e)
            r !== "ref" && (n[r] = e[r]);
        }
        if (t = t.defaultProps) {
          n === e && (n = $i({}, n));
          for (var c in t)
            n[c] === void 0 && (n[c] = t[c]);
        }
        return n;
      }
      function Xl(t, e) {
        try {
          var n = t.onUncaughtError;
          n(e.value, { componentStack: e.stack });
        } catch (r) {
          setTimeout(function() {
            throw r;
          });
        }
      }
      function Ec(t, e, n) {
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
      function Ei(t, e, n) {
        return n = gn(n), n.tag = 3, n.payload = { element: null }, n.callback = function() {
          Xl(t, e);
        }, n;
      }
      function zc(t) {
        return t = gn(t), t.tag = 3, t;
      }
      function Nc(t, e, n, r) {
        var c = n.type.getDerivedStateFromError;
        if (typeof c == "function") {
          var u = r.value;
          t.payload = function() {
            return c(u);
          }, t.callback = function() {
            Ec(e, n, r);
          };
        }
        var b = n.stateNode;
        b !== null && typeof b.componentDidCatch == "function" && (t.callback = function() {
          Ec(e, n, r), typeof c != "function" && (Mn === null ? Mn = /* @__PURE__ */ new Set([this]) : Mn.add(this));
          var C = r.stack;
          this.componentDidCatch(r.value, {
            componentStack: C !== null ? C : ""
          });
        });
      }
      function Cm(t, e, n, r, c) {
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
                return je === null ? tr() : n.alternate === null && Ht === 0 && (Ht = 3), n.flags &= -257, n.flags |= 65536, n.lanes = c, r === gr ? n.flags |= 16384 : (e = n.updateQueue, e === null ? n.updateQueue = /* @__PURE__ */ new Set([r]) : e.add(r), Ji(t, r, c)), !1;
              case 22:
                return n.flags |= 65536, r === gr ? n.flags |= 16384 : (e = n.updateQueue, e === null ? (e = {
                  transitions: null,
                  markerInstances: null,
                  retryQueue: /* @__PURE__ */ new Set([r])
                }, n.updateQueue = e) : (n = e.retryQueue, n === null ? e.retryQueue = /* @__PURE__ */ new Set([r]) : n.add(r)), Ji(t, r, c)), !1;
            }
            throw Error(o(435, n.tag));
          }
          return Ji(t, r, c), tr(), !1;
        }
        if (St)
          return e = Se.current, e !== null ? ((e.flags & 65536) === 0 && (e.flags |= 256), e.flags |= 65536, e.lanes = c, r !== bo && (t = Error(o(422), { cause: r }), Ga(
            G(t, n)
          ))) : (r !== bo && (e = Error(o(423), {
            cause: r
          }), Ga(
            G(e, n)
          )), t = t.current.alternate, t.flags |= 65536, c &= -c, t.lanes |= c, r = G(r, n), c = Ei(
            t.stateNode,
            r,
            c
          ), ri(t, c), Ht !== 4 && (Ht = 2)), !1;
        var u = Error(o(520), { cause: r });
        if (u = G(u, n), ml === null ? ml = [u] : ml.push(u), Ht !== 4 && (Ht = 2), e === null) return !0;
        r = G(r, n), n = e;
        do {
          switch (n.tag) {
            case 3:
              return n.flags |= 65536, t = c & -c, n.lanes |= t, t = Ei(n.stateNode, r, t), ri(n, t), !1;
            case 1:
              if (e = n.type, u = n.stateNode, (n.flags & 128) === 0 && (typeof e.getDerivedStateFromError == "function" || u !== null && typeof u.componentDidCatch == "function" && (Mn === null || !Mn.has(
                u
              ))))
                return n.flags |= 65536, c &= -c, n.lanes |= c, c = zc(c), Nc(
                  c,
                  t,
                  n,
                  r
                ), ri(n, c), !1;
          }
          n = n.return;
        } while (n !== null);
        return !1;
      }
      function $t(t, e, n, r) {
        e.child = t === null ? md(e, null, n, r) : aa(
          e,
          t.child,
          n,
          r
        );
      }
      function Tc(t, e, n, r, c) {
        n = n.render;
        var u = e.ref;
        if ("ref" in r) {
          var b = {};
          for (var C in r)
            C !== "ref" && (b[C] = r[C]);
        } else b = r;
        return Vn(e), r = ui(
          t,
          e,
          n,
          b,
          u,
          c
        ), C = di(), t !== null && !Gt ? (fi(t, e, c), $e(t, e, c)) : (St && C && X(e), e.flags |= 1, $t(t, e, r, c), e.child);
      }
      function Cc(t, e, n, r, c) {
        if (t === null) {
          var u = n.type;
          return typeof u == "function" && !Wi(u) && u.defaultProps === void 0 && n.compare === null ? (e.tag = 15, e.type = u, Mc(
            t,
            e,
            u,
            r,
            c
          )) : (t = nr(
            n.type,
            null,
            r,
            e,
            e.mode,
            c
          ), t.ref = e.ref, t.return = e, e.child = t);
        }
        if (u = t.child, !ji(t, c)) {
          var b = u.memoizedProps;
          if (n = n.compare, n = n !== null ? n : jl, n(b, r) && t.ref === e.ref)
            return $e(
              t,
              e,
              c
            );
        }
        return e.flags |= 1, t = nn(u, r), t.ref = e.ref, t.return = e, e.child = t;
      }
      function Mc(t, e, n, r, c) {
        if (t !== null) {
          var u = t.memoizedProps;
          if (jl(u, r) && t.ref === e.ref)
            if (Gt = !1, e.pendingProps = r = u, ji(t, c))
              (t.flags & 131072) !== 0 && (Gt = !0);
            else
              return e.lanes = t.lanes, $e(t, e, c);
        }
        return zi(
          t,
          e,
          n,
          r,
          c
        );
      }
      function Ac(t, e, n, r) {
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
            return jc(
              t,
              e,
              u,
              n,
              r
            );
          }
          if ((n & 536870912) !== 0)
            e.memoizedState = { baseLanes: 0, cachePool: null }, t !== null && Al(
              e,
              u !== null ? u.cachePool : null
            ), u !== null ? Ys(e, u) : ii(), Gs(e);
          else
            return r = e.lanes = 536870912, jc(
              t,
              e,
              u !== null ? u.baseLanes | n : n,
              n,
              r
            );
        } else
          u !== null ? (Al(e, u.cachePool), Ys(e, u), yn(), e.memoizedState = null) : (t !== null && Al(e, null), ii(), yn());
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
      function jc(t, e, n, r, c) {
        var u = ei();
        return u = u === null ? null : {
          parent: an ? Rt._currentValue : Rt._currentValue2,
          pool: u
        }, e.memoizedState = {
          baseLanes: n,
          cachePool: u
        }, t !== null && Al(e, null), ii(), Gs(e), t !== null && fa(t, e, r, !0), e.childLanes = c, null;
      }
      function Ll(t, e) {
        return e = Jl(
          { mode: e.mode, children: e.children },
          t.mode
        ), e.ref = t.ref, t.child = e, e.return = t, e;
      }
      function Oc(t, e, n) {
        return aa(e, t.child, null, n), t = Ll(
          e,
          e.pendingProps
        ), t.flags |= 2, be(e), e.memoizedState = null, t;
      }
      function Mm(t, e, n) {
        var r = e.pendingProps, c = (e.flags & 128) !== 0;
        if (e.flags &= -129, t === null) {
          if (St) {
            if (r.mode === "hidden")
              return t = Ll(e, r), e.lanes = 536870912, Wa(null, t);
            if (si(e), (t = Ot) ? (t = Ip(
              t,
              Me
            ), t !== null && (e.memoizedState = {
              dehydrated: t,
              treeContext: kn !== null ? { id: Xe, overflow: Le } : null,
              retryLane: 536870912,
              hydrationErrors: null
            }, n = Mu(t), n.return = e, e.child = n, ee = e, Ot = null)) : t = null, t === null) throw ht(e);
            return e.lanes = 536870912, null;
          }
          return Ll(e, r);
        }
        var u = t.memoizedState;
        if (u !== null) {
          var b = u.dehydrated;
          if (si(e), c)
            if (e.flags & 256)
              e.flags &= -257, e = Oc(
                t,
                e,
                n
              );
            else if (e.memoizedState !== null)
              e.child = t.child, e.flags |= 128, e = null;
            else throw Error(o(558));
          else if (Gt || fa(
            t,
            e,
            n,
            !1
          ), c = (n & t.childLanes) !== 0, Gt || c) {
            if (r = At, r !== null && (b = z(r, n), b !== 0 && b !== u.retryLane))
              throw u.retryLane = b, Ln(t, b), me(r, t, b), zo;
            tr(), e = Oc(
              t,
              e,
              n
            );
          } else
            t = u.treeContext, se && (Ot = Lp(b), ee = e, St = !0, zn = null, Me = !1, t !== null && it(e, t)), e = Ll(e, r), e.flags |= 4096;
          return e;
        }
        return t = nn(t.child, {
          mode: r.mode,
          children: r.children
        }), t.ref = e.ref, e.child = t, t.return = e, t;
      }
      function Zl(t, e) {
        var n = e.ref;
        if (n === null)
          t !== null && t.ref !== null && (e.flags |= 4194816);
        else {
          if (typeof n != "function" && typeof n != "object")
            throw Error(o(284));
          (t === null || t.ref !== n) && (e.flags |= 4194816);
        }
      }
      function zi(t, e, n, r, c) {
        return Vn(e), n = ui(
          t,
          e,
          n,
          r,
          void 0,
          c
        ), r = di(), t !== null && !Gt ? (fi(t, e, c), $e(t, e, c)) : (St && r && X(e), e.flags |= 1, $t(t, e, n, c), e.child);
      }
      function Rc(t, e, n, r, c, u) {
        return Vn(e), e.updateQueue = null, n = Qs(
          e,
          r,
          n,
          c
        ), Ks(t), r = di(), t !== null && !Gt ? (fi(t, e, u), $e(t, e, u)) : (St && r && X(e), e.flags |= 1, $t(t, e, n, u), e.child);
      }
      function Dc(t, e, n, r, c) {
        if (Vn(e), e.stateNode === null) {
          var u = Sa, b = n.contextType;
          typeof b == "object" && b !== null && (u = Pt(b)), u = new n(r, u), e.memoizedState = u.state !== null && u.state !== void 0 ? u.state : null, u.updater = Eo, e.stateNode = u, u._reactInternals = e, u = e.stateNode, u.props = r, u.state = e.memoizedState, u.refs = {}, ai(e), b = n.contextType, u.context = typeof b == "object" && b !== null ? Pt(b) : Sa, u.state = e.memoizedState, b = n.getDerivedStateFromProps, typeof b == "function" && (ki(
            e,
            n,
            b,
            r
          ), u.state = e.memoizedState), typeof n.getDerivedStateFromProps == "function" || typeof u.getSnapshotBeforeUpdate == "function" || typeof u.UNSAFE_componentWillMount != "function" && typeof u.componentWillMount != "function" || (b = u.state, typeof u.componentWillMount == "function" && u.componentWillMount(), typeof u.UNSAFE_componentWillMount == "function" && u.UNSAFE_componentWillMount(), b !== u.state && Eo.enqueueReplaceState(
            u,
            u.state,
            null
          ), La(e, r, u, c), Xa(), u.state = e.memoizedState), typeof u.componentDidMount == "function" && (e.flags |= 4194308), r = !0;
        } else if (t === null) {
          u = e.stateNode;
          var C = e.memoizedProps, Y = Zn(n, C);
          u.props = Y;
          var J = u.context, P = n.contextType;
          b = Sa, typeof P == "object" && P !== null && (b = Pt(P));
          var W = n.getDerivedStateFromProps;
          P = typeof W == "function" || typeof u.getSnapshotBeforeUpdate == "function", C = e.pendingProps !== C, P || typeof u.UNSAFE_componentWillReceiveProps != "function" && typeof u.componentWillReceiveProps != "function" || (C || J !== b) && kc(
            e,
            u,
            r,
            b
          ), Nn = !1;
          var nt = e.memoizedState;
          u.state = nt, La(e, r, u, c), Xa(), J = e.memoizedState, C || nt !== J || Nn ? (typeof W == "function" && (ki(
            e,
            n,
            W,
            r
          ), J = e.memoizedState), (Y = Nn || Sc(
            e,
            n,
            Y,
            r,
            nt,
            J,
            b
          )) ? (P || typeof u.UNSAFE_componentWillMount != "function" && typeof u.componentWillMount != "function" || (typeof u.componentWillMount == "function" && u.componentWillMount(), typeof u.UNSAFE_componentWillMount == "function" && u.UNSAFE_componentWillMount()), typeof u.componentDidMount == "function" && (e.flags |= 4194308)) : (typeof u.componentDidMount == "function" && (e.flags |= 4194308), e.memoizedProps = r, e.memoizedState = J), u.props = r, u.state = J, u.context = b, r = Y) : (typeof u.componentDidMount == "function" && (e.flags |= 4194308), r = !1);
        } else {
          u = e.stateNode, li(t, e), b = e.memoizedProps, P = Zn(n, b), u.props = P, W = e.pendingProps, nt = u.context, J = n.contextType, Y = Sa, typeof J == "object" && J !== null && (Y = Pt(J)), C = n.getDerivedStateFromProps, (J = typeof C == "function" || typeof u.getSnapshotBeforeUpdate == "function") || typeof u.UNSAFE_componentWillReceiveProps != "function" && typeof u.componentWillReceiveProps != "function" || (b !== W || nt !== Y) && kc(
            e,
            u,
            r,
            Y
          ), Nn = !1, nt = e.memoizedState, u.state = nt, La(e, r, u, c), Xa();
          var gt = e.memoizedState;
          b !== W || nt !== gt || Nn || t !== null && t.dependencies !== null && Tl(t.dependencies) ? (typeof C == "function" && (ki(
            e,
            n,
            C,
            r
          ), gt = e.memoizedState), (P = Nn || Sc(
            e,
            n,
            P,
            r,
            nt,
            gt,
            Y
          ) || t !== null && t.dependencies !== null && Tl(t.dependencies)) ? (J || typeof u.UNSAFE_componentWillUpdate != "function" && typeof u.componentWillUpdate != "function" || (typeof u.componentWillUpdate == "function" && u.componentWillUpdate(r, gt, Y), typeof u.UNSAFE_componentWillUpdate == "function" && u.UNSAFE_componentWillUpdate(
            r,
            gt,
            Y
          )), typeof u.componentDidUpdate == "function" && (e.flags |= 4), typeof u.getSnapshotBeforeUpdate == "function" && (e.flags |= 1024)) : (typeof u.componentDidUpdate != "function" || b === t.memoizedProps && nt === t.memoizedState || (e.flags |= 4), typeof u.getSnapshotBeforeUpdate != "function" || b === t.memoizedProps && nt === t.memoizedState || (e.flags |= 1024), e.memoizedProps = r, e.memoizedState = gt), u.props = r, u.state = gt, u.context = Y, r = P) : (typeof u.componentDidUpdate != "function" || b === t.memoizedProps && nt === t.memoizedState || (e.flags |= 4), typeof u.getSnapshotBeforeUpdate != "function" || b === t.memoizedProps && nt === t.memoizedState || (e.flags |= 1024), r = !1);
        }
        return u = r, Zl(t, e), r = (e.flags & 128) !== 0, u || r ? (u = e.stateNode, n = r && typeof n.getDerivedStateFromError != "function" ? null : u.render(), e.flags |= 1, t !== null && r ? (e.child = aa(
          e,
          t.child,
          null,
          c
        ), e.child = aa(
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
      function Ni(t) {
        return { baseLanes: t, cachePool: As() };
      }
      function Ti(t, e, n) {
        return t = t !== null ? t.childLanes & ~n : 0, e && (t |= Ee), t;
      }
      function Hc(t, e, n) {
        var r = e.pendingProps, c = !1, u = (e.flags & 128) !== 0, b;
        if ((b = u) || (b = t !== null && t.memoizedState === null ? !1 : (qt.current & 2) !== 0), b && (c = !0, e.flags &= -129), b = (e.flags & 32) !== 0, e.flags &= -33, t === null) {
          if (St) {
            if (c ? vn(e) : yn(), (t = Ot) ? (t = Pp(
              t,
              Me
            ), t !== null && (e.memoizedState = {
              dehydrated: t,
              treeContext: kn !== null ? { id: Xe, overflow: Le } : null,
              retryLane: 536870912,
              hydrationErrors: null
            }, n = Mu(t), n.return = e, e.child = n, ee = e, Ot = null)) : t = null, t === null) throw ht(e);
            return co(t) ? e.lanes = 32 : e.lanes = 536870912, null;
          }
          var C = r.children;
          return r = r.fallback, c ? (yn(), c = e.mode, C = Jl(
            { mode: "hidden", children: C },
            c
          ), r = Fn(
            r,
            c,
            n,
            null
          ), C.return = e, r.return = e, C.sibling = r, e.child = C, r = e.child, r.memoizedState = Ni(n), r.childLanes = Ti(
            t,
            b,
            n
          ), e.memoizedState = No, Wa(null, r)) : (vn(e), Ci(e, C));
        }
        var Y = t.memoizedState;
        if (Y !== null && (C = Y.dehydrated, C !== null)) {
          if (u)
            e.flags & 256 ? (vn(e), e.flags &= -257, e = Mi(
              t,
              e,
              n
            )) : e.memoizedState !== null ? (yn(), e.child = t.child, e.flags |= 128, e = null) : (yn(), C = r.fallback, c = e.mode, r = Jl(
              { mode: "visible", children: r.children },
              c
            ), C = Fn(
              C,
              c,
              n,
              null
            ), C.flags |= 2, r.return = e, C.return = e, r.sibling = C, e.child = r, aa(
              e,
              t.child,
              null,
              n
            ), r = e.child, r.memoizedState = Ni(n), r.childLanes = Ti(
              t,
              b,
              n
            ), e.memoizedState = No, e = Wa(null, r));
          else if (vn(e), co(C))
            b = qp(C).digest, r = Error(o(419)), r.stack = "", r.digest = b, Ga({ value: r, source: null, stack: null }), e = Mi(
              t,
              e,
              n
            );
          else if (Gt || fa(
            t,
            e,
            n,
            !1
          ), b = (n & t.childLanes) !== 0, Gt || b) {
            if (b = At, b !== null && (r = z(
              b,
              n
            ), r !== 0 && r !== Y.retryLane))
              throw Y.retryLane = r, Ln(t, r), me(b, t, r), zo;
            so(C) || tr(), e = Mi(
              t,
              e,
              n
            );
          } else
            so(C) ? (e.flags |= 192, e.child = t.child, e = null) : (t = Y.treeContext, se && (Ot = Zp(
              C
            ), ee = e, St = !0, zn = null, Me = !1, t !== null && it(e, t)), e = Ci(
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
        ) : (C = Fn(
          C,
          c,
          n,
          null
        ), C.flags |= 2), C.return = e, r.return = e, r.sibling = C, e.child = r, Wa(null, r), r = e.child, C = t.child.memoizedState, C === null ? C = Ni(n) : (c = C.cachePool, c !== null ? (Y = an ? Rt._currentValue : Rt._currentValue2, c = c.parent !== Y ? { parent: Y, pool: Y } : c) : c = As(), C = {
          baseLanes: C.baseLanes | n,
          cachePool: c
        }), r.memoizedState = C, r.childLanes = Ti(
          t,
          b,
          n
        ), e.memoizedState = No, Wa(t.child, r)) : (vn(e), n = t.child, t = n.sibling, n = nn(n, {
          mode: "visible",
          children: r.children
        }), n.return = e, n.sibling = null, t !== null && (b = e.deletions, b === null ? (e.deletions = [t], e.flags |= 16) : b.push(t)), e.child = n, e.memoizedState = null, n);
      }
      function Ci(t, e) {
        return e = Jl(
          { mode: "visible", children: e },
          t.mode
        ), e.return = t, t.child = e;
      }
      function Jl(t, e) {
        return t = s(22, t, null, e), t.lanes = 0, t;
      }
      function Mi(t, e, n) {
        return aa(e, t.child, null, n), t = Ci(
          e,
          e.pendingProps.children
        ), t.flags |= 2, e.memoizedState = null, t;
      }
      function Uc(t, e, n) {
        t.lanes |= e;
        var r = t.alternate;
        r !== null && (r.lanes |= e), Ir(t.return, e, n);
      }
      function Ai(t, e, n, r, c, u) {
        var b = t.memoizedState;
        b === null ? t.memoizedState = {
          isBackwards: e,
          rendering: null,
          renderingStartTime: 0,
          last: r,
          tail: n,
          tailMode: c,
          treeForkCount: u
        } : (b.isBackwards = e, b.rendering = null, b.renderingStartTime = 0, b.last = r, b.tail = n, b.tailMode = c, b.treeForkCount = u);
      }
      function qc(t, e, n) {
        var r = e.pendingProps, c = r.revealOrder, u = r.tail;
        r = r.children;
        var b = qt.current, C = (b & 2) !== 0;
        if (C ? (b = b & 1 | 2, e.flags |= 128) : b &= 1, N(qt, b), $t(t, e, r, n), r = St ? il : 0, !C && t !== null && (t.flags & 128) !== 0)
          t: for (t = e.child; t !== null; ) {
            if (t.tag === 13)
              t.memoizedState !== null && Uc(t, n, e);
            else if (t.tag === 19)
              Uc(t, n, e);
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
              t = n.alternate, t !== null && Ul(t) === null && (c = n), n = n.sibling;
            n = c, n === null ? (c = e.child, e.child = null) : (c = n.sibling, n.sibling = null), Ai(
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
              if (t = c.alternate, t !== null && Ul(t) === null) {
                e.child = c;
                break;
              }
              t = c.sibling, c.sibling = n, n = c, c = t;
            }
            Ai(
              e,
              !0,
              n,
              null,
              u,
              r
            );
            break;
          case "together":
            Ai(
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
          throw Error(o(153));
        if (e.child !== null) {
          for (t = e.child, n = nn(t, t.pendingProps), e.child = n, n.return = e; t.sibling !== null; )
            t = t.sibling, n = n.sibling = nn(t, t.pendingProps), n.return = e;
          n.sibling = null;
        }
        return e.child;
      }
      function ji(t, e) {
        return (t.lanes & e) !== 0 ? !0 : (t = t.dependencies, !!(t !== null && Tl(t)));
      }
      function Am(t, e, n) {
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
              return e.flags |= 128, si(e), null;
            break;
          case 13:
            var r = e.memoizedState;
            if (r !== null)
              return r.dehydrated !== null ? (vn(e), e.flags |= 128, null) : (n & e.child.childLanes) !== 0 ? Hc(
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
                return qc(
                  t,
                  e,
                  n
                );
              e.flags |= 128;
            }
            if (c = e.memoizedState, c !== null && (c.rendering = null, c.tail = null, c.lastEffect = null), N(qt, qt.current), r) break;
            return null;
          case 22:
            return e.lanes = 0, Ac(
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
      function Yc(t, e, n) {
        if (t !== null)
          if (t.memoizedProps !== e.pendingProps)
            Gt = !0;
          else {
            if (!ji(t, n) && (e.flags & 128) === 0)
              return Gt = !1, Am(
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
              if (t = Xn(e.elementType), e.type = t, typeof t == "function")
                Wi(t) ? (r = Zn(t, r), e.tag = 1, e = Dc(
                  null,
                  e,
                  t,
                  r,
                  n
                )) : (e.tag = 0, e = zi(
                  null,
                  e,
                  t,
                  r,
                  n
                ));
              else {
                if (t != null) {
                  var c = t.$$typeof;
                  if (c === eo) {
                    e.tag = 11, e = Tc(
                      null,
                      e,
                      t,
                      r,
                      n
                    );
                    break t;
                  } else if (c === lo) {
                    e.tag = 14, e = Cc(
                      null,
                      e,
                      t,
                      r,
                      n
                    );
                    break t;
                  }
                }
                throw e = k(t) || t, Error(o(306, e, ""));
              }
            }
            return e;
          case 0:
            return zi(
              t,
              e,
              e.type,
              e.pendingProps,
              n
            );
          case 1:
            return r = e.type, c = Zn(
              r,
              e.pendingProps
            ), Dc(
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
              ), t === null) throw Error(o(387));
              var u = e.pendingProps;
              c = e.memoizedState, r = c.element, li(t, e), La(e, u, null, n);
              var b = e.memoizedState;
              if (u = b.cache, hn(e, Rt, u), u !== c.cache && Pr(
                e,
                [Rt],
                n,
                !0
              ), Xa(), u = b.element, se && c.isDehydrated)
                if (c = {
                  element: u,
                  isDehydrated: !1,
                  cache: b.cache
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
                    Error(o(424)),
                    e
                  ), Ga(r), e = Bc(
                    t,
                    e,
                    u,
                    n
                  );
                  break t;
                } else
                  for (se && (Ot = Xp(
                    e.stateNode.containerInfo
                  ), ee = e, St = !0, zn = null, Me = !0), n = md(
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
              return Zl(t, e), t === null ? (n = $u(
                e.type,
                null,
                e.pendingProps,
                null
              )) ? e.memoizedState = n : St || (e.stateNode = vh(
                e.type,
                e.pendingProps,
                En.current,
                e
              )) : e.memoizedState = $u(
                e.type,
                t.memoizedProps,
                e.pendingProps,
                t.memoizedState
              ), null;
          case 27:
            if (Vt)
              return kt(e), t === null && Vt && St && (r = e.stateNode = rd(
                e.type,
                e.pendingProps,
                En.current,
                te.current,
                !1
              ), ee = e, Me = !0, Ot = Jp(
                e.type,
                r,
                Ot
              )), $t(
                t,
                e,
                e.pendingProps.children,
                n
              ), Zl(t, e), t === null && (e.flags |= 4194304), e.child;
          case 5:
            return t === null && St && (hh(
              e.type,
              e.pendingProps,
              te.current
            ), (c = r = Ot) && (r = Wp(
              r,
              e.type,
              e.pendingProps,
              Me
            ), r !== null ? (e.stateNode = r, ee = e, Ot = Vp(r), Me = !1, c = !0) : c = !1), c || ht(e)), kt(e), c = e.type, u = e.pendingProps, b = t !== null ? t.memoizedProps : null, r = u.children, rr(c, u) ? r = null : b !== null && rr(c, b) && (e.flags |= 32), e.memoizedState !== null && (c = ui(
              t,
              e,
              Sm,
              null,
              null,
              n
            ), an ? Pn._currentValue = c : Pn._currentValue2 = c), Zl(t, e), $t(t, e, r, n), e.child;
          case 6:
            return t === null && St && (gh(
              e.pendingProps,
              te.current
            ), (t = n = Ot) && (n = Fp(
              n,
              e.pendingProps,
              Me
            ), n !== null ? (e.stateNode = n, ee = e, Ot = null, t = !0) : t = !1), t || ht(e)), null;
          case 13:
            return Hc(t, e, n);
          case 4:
            return ot(
              e,
              e.stateNode.containerInfo
            ), r = e.pendingProps, t === null ? e.child = aa(
              e,
              null,
              r,
              n
            ) : $t(t, e, r, n), e.child;
          case 11:
            return Tc(
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
            return c = e.type._context, r = e.pendingProps.children, Vn(e), c = Pt(c), r = r(c), e.flags |= 1, $t(t, e, r, n), e.child;
          case 14:
            return Cc(
              t,
              e,
              e.type,
              e.pendingProps,
              n
            );
          case 15:
            return Mc(
              t,
              e,
              e.type,
              e.pendingProps,
              n
            );
          case 19:
            return qc(
              t,
              e,
              n
            );
          case 31:
            return Mm(t, e, n);
          case 22:
            return Ac(
              t,
              e,
              n,
              e.pendingProps
            );
          case 24:
            return Vn(e), r = Pt(Rt), t === null ? (c = ei(), c === null && (c = At, u = $r(), c.pooledCache = u, u.refCount++, u !== null && (c.pooledCacheLanes |= n), c = u), e.memoizedState = {
              parent: r,
              cache: c
            }, ai(e), hn(e, Rt, c)) : ((t.lanes & n) !== 0 && (li(t, e), La(e, null, null, n), Xa()), c = t.memoizedState, u = e.memoizedState, c.parent !== r ? (c = { parent: r, cache: r }, e.memoizedState = c, e.lanes === 0 && (e.memoizedState = e.updateQueue.baseState = c), hn(e, Rt, r)) : (r = u.cache, hn(e, Rt, r), r !== c.cache && Pr(
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
        throw Error(o(156, e.tag));
      }
      function Be(t) {
        t.flags |= 4;
      }
      function Wl(t) {
        Ve && (t.flags |= 8);
      }
      function Gc(t, e) {
        if (t !== null && t.child === e.child) return !1;
        if ((e.flags & 16) !== 0) return !0;
        for (t = e.child; t !== null; ) {
          if ((t.flags & 8218) !== 0 || (t.subtreeFlags & 8218) !== 0)
            return !0;
          t = t.sibling;
        }
        return !1;
      }
      function Oi(t, e, n, r) {
        if (oe)
          for (n = e.child; n !== null; ) {
            if (n.tag === 5 || n.tag === 6)
              io(t, n.stateNode);
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
              n && r && (u = Ju(
                u,
                c.type,
                c.memoizedProps
              )), io(t, u);
            } else if (c.tag === 6)
              u = c.stateNode, n && r && (u = Wu(
                u,
                c.memoizedProps
              )), io(t, u);
            else if (c.tag !== 4) {
              if (c.tag === 22 && c.memoizedState !== null)
                u = c.child, u !== null && (u.return = c), Oi(t, c, !0, !0);
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
      function Kc(t, e, n, r) {
        var c = !1;
        if (Ve)
          for (var u = e.child; u !== null; ) {
            if (u.tag === 5) {
              var b = u.stateNode;
              n && r && (b = Ju(
                b,
                u.type,
                u.memoizedProps
              )), Lu(t, b);
            } else if (u.tag === 6)
              b = u.stateNode, n && r && (b = Wu(
                b,
                u.memoizedProps
              )), Lu(t, b);
            else if (u.tag !== 4) {
              if (u.tag === 22 && u.memoizedState !== null)
                c = u.child, c !== null && (c.return = u), Kc(t, u, !0, !0), c = !0;
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
      function Qc(t, e) {
        if (Ve && Gc(t, e)) {
          t = e.stateNode;
          var n = t.containerInfo, r = Xu();
          Kc(r, e, !1, !1), t.pendingChildren = r, Be(e), Up(n, r);
        }
      }
      function Ri(t, e, n, r) {
        if (oe)
          t.memoizedProps !== r && Be(e);
        else if (Ve) {
          var c = t.stateNode, u = t.memoizedProps;
          if ((t = Gc(t, e)) || u !== r) {
            var b = te.current;
            u = Hp(
              c,
              n,
              u,
              r,
              !t,
              null
            ), u === c ? e.stateNode = c : (Wl(e), Yu(
              u,
              n,
              r,
              b
            ) && Be(e), e.stateNode = u, t && Oi(u, e, !1, !1));
          } else e.stateNode = c;
        }
      }
      function Di(t, e, n, r, c) {
        if ((t.mode & 32) !== 0 && (n === null ? up(e, r) : dp(e, n, r))) {
          if (t.flags |= 16777216, (c & 335544128) === c || oo(e, r))
            if (Ku(t.stateNode, e, r))
              t.flags |= 8192;
            else if (hu()) t.flags |= 8192;
            else
              throw na = gr, wo;
        } else t.flags &= -16777217;
      }
      function Vc(t, e) {
        if (xh(e)) {
          if (t.flags |= 16777216, !ld(e))
            if (hu()) t.flags |= 8192;
            else
              throw na = gr, wo;
        } else t.flags &= -16777217;
      }
      function Fl(t, e) {
        e !== null && (t.flags |= 4), t.flags & 16384 && (e = t.tag !== 22 ? L() : 536870912, t.lanes |= e, Ha |= e);
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
      function jm(t, e, n) {
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
            return n = e.stateNode, r = null, t !== null && (r = t.memoizedState.cache), e.memoizedState.cache !== r && (e.flags |= 2048), Ie(Rt), st(), n.pendingContext && (n.context = n.pendingContext, n.pendingContext = null), (t === null || t.child === null) && (Re(e) ? Be(e) : t === null || t.memoizedState.isDehydrated && (e.flags & 256) === 0 || (e.flags |= 1024, pn())), Qc(t, e), jt(e), null;
          case 26:
            if (qe) {
              var c = e.type, u = e.memoizedState;
              return t === null ? (Be(e), u !== null ? (jt(e), Vc(
                e,
                u
              )) : (jt(e), Di(
                e,
                c,
                null,
                r,
                n
              ))) : u ? u !== t.memoizedState ? (Be(e), jt(e), Vc(
                e,
                u
              )) : (jt(e), e.flags &= -16777217) : (u = t.memoizedProps, oe ? u !== r && Be(e) : Ri(
                t,
                e,
                c,
                r
              ), jt(e), Di(
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
                oe ? t.memoizedProps !== r && Be(e) : Ri(t, e, c, r);
              else {
                if (!r) {
                  if (e.stateNode === null)
                    throw Error(o(166));
                  return jt(e), null;
                }
                t = te.current, Re(e) ? Kn(e, t) : (t = rd(
                  c,
                  r,
                  n,
                  t,
                  !0
                ), e.stateNode = t, Be(e));
              }
              return jt(e), null;
            }
          case 5:
            if (Zt(e), c = e.type, t !== null && e.stateNode != null)
              Ri(t, e, c, r);
            else {
              if (!r) {
                if (e.stateNode === null)
                  throw Error(o(166));
                return jt(e), null;
              }
              if (u = te.current, Re(e))
                Kn(e, u), ch(
                  e.stateNode,
                  c,
                  r,
                  u
                ) && (e.flags |= 64);
              else {
                var b = np(
                  c,
                  r,
                  En.current,
                  u,
                  e
                );
                Wl(e), Oi(b, e, !1, !1), e.stateNode = b, Yu(
                  b,
                  c,
                  r,
                  u
                ) && Be(e);
              }
            }
            return jt(e), Di(
              e,
              e.type,
              t === null ? null : t.memoizedProps,
              e.pendingProps,
              n
            ), null;
          case 6:
            if (t && e.stateNode != null)
              n = t.memoizedProps, oe ? n !== r && Be(e) : Ve && (n !== r ? (t = En.current, n = te.current, Wl(e), e.stateNode = Gu(
                r,
                t,
                n,
                e
              )) : e.stateNode = t.stateNode);
            else {
              if (typeof r != "string" && e.stateNode === null)
                throw Error(o(166));
              if (t = En.current, n = te.current, Re(e)) {
                if (!se) throw Error(o(176));
                if (t = e.stateNode, n = e.memoizedProps, r = null, c = ee, c !== null)
                  switch (c.tag) {
                    case 27:
                    case 5:
                      r = c.memoizedProps;
                  }
                th(
                  t,
                  n,
                  e,
                  r
                ) || ht(e, !0);
              } else
                Wl(e), e.stateNode = Gu(
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
                  if (!r) throw Error(o(318));
                  if (!se) throw Error(o(556));
                  if (t = e.memoizedState, t = t !== null ? t.dehydrated : null, !t) throw Error(o(557));
                  eh(t, e);
                } else
                  De(), (e.flags & 128) === 0 && (e.memoizedState = null), e.flags |= 4;
                jt(e), t = !1;
              } else
                n = pn(), t !== null && t.memoizedState !== null && (t.memoizedState.hydrationErrors = n), t = !0;
              if (!t)
                return e.flags & 256 ? (be(e), e) : (be(e), null);
              if ((e.flags & 128) !== 0)
                throw Error(o(558));
            }
            return jt(e), null;
          case 13:
            if (r = e.memoizedState, t === null || t.memoizedState !== null && t.memoizedState.dehydrated !== null) {
              if (c = Re(e), r !== null && r.dehydrated !== null) {
                if (t === null) {
                  if (!c) throw Error(o(318));
                  if (!se) throw Error(o(344));
                  if (c = e.memoizedState, c = c !== null ? c.dehydrated : null, !c) throw Error(o(317));
                  nh(c, e);
                } else
                  De(), (e.flags & 128) === 0 && (e.memoizedState = null), e.flags |= 4;
                jt(e), c = !1;
              } else
                c = pn(), t !== null && t.memoizedState !== null && (t.memoizedState.hydrationErrors = c), c = !0;
              if (!c)
                return e.flags & 256 ? (be(e), e) : (be(e), null);
            }
            return be(e), (e.flags & 128) !== 0 ? (e.lanes = n, e) : (n = r !== null, t = t !== null && t.memoizedState !== null, n && (r = e.child, c = null, r.alternate !== null && r.alternate.memoizedState !== null && r.alternate.memoizedState.cachePool !== null && (c = r.alternate.memoizedState.cachePool.pool), u = null, r.memoizedState !== null && r.memoizedState.cachePool !== null && (u = r.memoizedState.cachePool.pool), u !== c && (r.flags |= 2048)), n !== t && n && (e.child.flags |= 8192), Fl(e, e.updateQueue), jt(e), null);
          case 4:
            return st(), Qc(t, e), t === null && ip(e.stateNode.containerInfo), jt(e), null;
          case 10:
            return Ie(e.type), jt(e), null;
          case 19:
            if (w(qt), r = e.memoizedState, r === null) return jt(e), null;
            if (c = (e.flags & 128) !== 0, u = r.rendering, u === null)
              if (c) Fa(r, !1);
              else {
                if (Ht !== 0 || t !== null && (t.flags & 128) !== 0)
                  for (t = e.child; t !== null; ) {
                    if (u = Ul(t), u !== null) {
                      for (e.flags |= 128, Fa(r, !1), t = u.updateQueue, e.updateQueue = t, Fl(e, t), e.subtreeFlags = 0, t = n, n = e.child; n !== null; )
                        Cu(n, t), n = n.sibling;
                      return N(
                        qt,
                        qt.current & 1 | 2
                      ), St && K(e, r.treeForkCount), e.child;
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
                  2 * pe() - r.renderingStartTime > pl && n !== 536870912 && (e.flags |= 128, c = !0, Fa(r, !1), e.lanes = 4194304);
              r.isBackwards ? (u.sibling = e.child, e.child = u) : (t = r.last, t !== null ? t.sibling = u : e.child = u, r.last = u);
            }
            return r.tail !== null ? (t = r.tail, r.rendering = t, r.tail = t.sibling, r.renderingStartTime = pe(), t.sibling = null, n = qt.current, N(
              qt,
              c ? n & 1 | 2 : n & 1
            ), St && K(e, r.treeForkCount), t) : (jt(e), null);
          case 22:
          case 23:
            return be(e), oi(), r = e.memoizedState !== null, t !== null ? t.memoizedState !== null !== r && (e.flags |= 8192) : r && (e.flags |= 8192), r ? (n & 536870912) !== 0 && (e.flags & 128) === 0 && (jt(e), e.subtreeFlags & 6 && (e.flags |= 8192)) : jt(e), n = e.updateQueue, n !== null && Fl(e, n.retryQueue), n = null, t !== null && t.memoizedState !== null && t.memoizedState.cachePool !== null && (n = t.memoizedState.cachePool.pool), r = null, e.memoizedState !== null && e.memoizedState.cachePool !== null && (r = e.memoizedState.cachePool.pool), r !== n && (e.flags |= 2048), t !== null && w(ea), null;
          case 24:
            return n = null, t !== null && (n = t.memoizedState.cache), e.memoizedState.cache !== n && (e.flags |= 2048), Ie(Rt), jt(e), null;
          case 25:
            return null;
          case 30:
            return null;
        }
        throw Error(o(156, e.tag));
      }
      function Om(t, e) {
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
                throw Error(o(340));
              De();
            }
            return t = e.flags, t & 65536 ? (e.flags = t & -65537 | 128, e) : null;
          case 13:
            if (be(e), t = e.memoizedState, t !== null && t.dehydrated !== null) {
              if (e.alternate === null)
                throw Error(o(340));
              De();
            }
            return t = e.flags, t & 65536 ? (e.flags = t & -65537 | 128, e) : null;
          case 19:
            return w(qt), null;
          case 4:
            return st(), null;
          case 10:
            return Ie(e.type), null;
          case 22:
          case 23:
            return be(e), oi(), t !== null && w(ea), t = e.flags, t & 65536 ? (e.flags = t & -65537 | 128, e) : null;
          case 24:
            return Ie(Rt), null;
          case 25:
            return null;
          default:
            return null;
        }
      }
      function Xc(t, e) {
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
            w(qt);
            break;
          case 10:
            Ie(e.type);
            break;
          case 22:
          case 23:
            be(e), oi(), t !== null && w(ea);
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
                var u = n.create, b = n.inst;
                r = u(), b.destroy = r;
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
                var b = r.inst, C = b.destroy;
                if (C !== void 0) {
                  b.destroy = void 0, c = e;
                  var Y = n, J = C;
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
      function Lc(t) {
        var e = t.updateQueue;
        if (e !== null) {
          var n = t.stateNode;
          try {
            qs(e, n);
          } catch (r) {
            Et(t, t.return, r);
          }
        }
      }
      function Zc(t, e, n) {
        n.props = Zn(
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
      function Jc(t) {
        var e = t.type, n = t.memoizedProps, r = t.stateNode;
        try {
          zp(r, e, n, t);
        } catch (c) {
          Et(t, t.return, c);
        }
      }
      function Bi(t, e, n) {
        try {
          Np(
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
      function Wc(t) {
        return t.tag === 5 || t.tag === 3 || (qe ? t.tag === 26 : !1) || (Vt ? t.tag === 27 && wa(t.type) : !1) || t.tag === 4;
      }
      function Hi(t) {
        t: for (; ; ) {
          for (; t.sibling === null; ) {
            if (t.return === null || Wc(t.return)) return null;
            t = t.return;
          }
          for (t.sibling.return = t.return, t = t.sibling; t.tag !== 5 && t.tag !== 6 && t.tag !== 18; ) {
            if (Vt && t.tag === 27 && wa(t.type) || t.flags & 2 || t.child === null || t.tag === 4) continue t;
            t.child.return = t, t = t.child;
          }
          if (!(t.flags & 2)) return t.stateNode;
        }
      }
      function Ui(t, e, n) {
        var r = t.tag;
        if (r === 5 || r === 6)
          t = t.stateNode, e ? Cp(n, t, e) : kp(n, t);
        else if (r !== 4 && (Vt && r === 27 && wa(t.type) && (n = t.stateNode, e = null), t = t.child, t !== null))
          for (Ui(t, e, n), t = t.sibling; t !== null; )
            Ui(t, e, n), t = t.sibling;
      }
      function Il(t, e, n) {
        var r = t.tag;
        if (r === 5 || r === 6)
          t = t.stateNode, e ? Tp(n, t, e) : Sp(n, t);
        else if (r !== 4 && (Vt && r === 27 && wa(t.type) && (n = t.stateNode), t = t.child, t !== null))
          for (Il(t, e, n), t = t.sibling; t !== null; )
            Il(t, e, n), t = t.sibling;
      }
      function Fc(t, e, n) {
        t = t.containerInfo;
        try {
          Zu(t, n);
        } catch (r) {
          Et(e, e.return, r);
        }
      }
      function Ic(t) {
        var e = t.stateNode, n = t.memoizedProps;
        try {
          _h(
            t.type,
            n,
            e,
            t
          );
        } catch (r) {
          Et(t, t.return, r);
        }
      }
      function Rm(t, e) {
        for (tp(t.containerInfo), Wt = e; Wt !== null; )
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
                      var b = Zn(
                        r.type,
                        c
                      );
                      e = u.getSnapshotBeforeUpdate(
                        b,
                        n
                      ), u.__reactInternalSnapshotBeforeUpdate = e;
                    } catch (C) {
                      Et(r, r.return, C);
                    }
                  }
                  break;
                case 3:
                  (e & 1024) !== 0 && oe && Bp(t.stateNode.containerInfo);
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
                    throw Error(o(163));
              }
              if (e = t.sibling, e !== null) {
                e.return = t.return, Wt = e;
                break;
              }
              Wt = t.return;
            }
      }
      function Pc(t, e, n) {
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
                } catch (b) {
                  Et(n, n.return, b);
                }
              else {
                var c = Zn(
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
                } catch (b) {
                  Et(
                    n,
                    n.return,
                    b
                  );
                }
              }
            r & 64 && Lc(n), r & 512 && Pa(n, n.return);
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
                qs(r, t);
              } catch (b) {
                Et(n, n.return, b);
              }
            }
            break;
          case 27:
            Vt && e === null && r & 4 && Ic(n);
          case 26:
          case 5:
            if (tn(t, n), e === null) {
              if (r & 4) Jc(n);
              else if (r & 64) {
                t = n.type, e = n.memoizedProps, c = n.stateNode;
                try {
                  rh(
                    c,
                    t,
                    e,
                    n
                  );
                } catch (b) {
                  Et(n, n.return, b);
                }
              }
            }
            r & 512 && Pa(n, n.return);
            break;
          case 12:
            tn(t, n);
            break;
          case 31:
            tn(t, n), r & 4 && tu(t, n);
            break;
          case 13:
            tn(t, n), r & 4 && eu(t, n), r & 64 && (r = n.memoizedState, r !== null && (r = r.dehydrated, r !== null && (n = Gm.bind(
              null,
              n
            ), Yp(r, n))));
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
      function $c(t) {
        var e = t.alternate;
        e !== null && (t.alternate = null, $c(e)), t.child = null, t.deletions = null, t.sibling = null, t.tag === 5 && (e = t.stateNode, e !== null && cp(e)), t.stateNode = null, t.return = null, t.dependencies = null, t.memoizedProps = null, t.memoizedState = null, t.pendingProps = null, t.stateNode = null, t.updateQueue = null;
      }
      function He(t, e, n) {
        for (n = n.child; n !== null; )
          qi(
            t,
            e,
            n
          ), n = n.sibling;
      }
      function qi(t, e, n) {
        if (we && typeof we.onCommitFiberUnmount == "function")
          try {
            we.onCommitFiberUnmount(rl, n);
          } catch {
          }
        switch (n.tag) {
          case 26:
            if (qe) {
              Kt || Qe(n, e), He(
                t,
                e,
                n
              ), n.memoizedState ? ed(n.memoizedState) : n.stateNode && ad(n.stateNode);
              break;
            }
          case 27:
            if (Vt) {
              Kt || Qe(n, e);
              var r = Qt, c = he;
              wa(n.type) && (Qt = n.stateNode, he = !1), He(
                t,
                e,
                n
              ), id(n.stateNode), Qt = r, he = c;
              break;
            }
          case 5:
            Kt || Qe(n, e);
          case 6:
            if (oe) {
              if (r = Qt, c = he, Qt = null, He(
                t,
                e,
                n
              ), Qt = r, he = c, Qt !== null)
                if (he)
                  try {
                    Ap(Qt, n.stateNode);
                  } catch (u) {
                    Et(
                      n,
                      e,
                      u
                    );
                  }
                else
                  try {
                    Mp(Qt, n.stateNode);
                  } catch (u) {
                    Et(
                      n,
                      e,
                      u
                    );
                  }
            } else
              He(
                t,
                e,
                n
              );
            break;
          case 18:
            oe && Qt !== null && (he ? fh(
              Qt,
              n.stateNode
            ) : dh(Qt, n.stateNode));
            break;
          case 4:
            oe ? (r = Qt, c = he, Qt = n.stateNode.containerInfo, he = !0, He(
              t,
              e,
              n
            ), Qt = r, he = c) : (Ve && Fc(
              n.stateNode,
              n,
              Xu()
            ), He(
              t,
              e,
              n
            ));
            break;
          case 0:
          case 11:
          case 14:
          case 15:
            xn(2, n, e), Kt || xn(4, n, e), He(
              t,
              e,
              n
            );
            break;
          case 1:
            Kt || (Qe(n, e), r = n.stateNode, typeof r.componentWillUnmount == "function" && Zc(
              n,
              e,
              r
            )), He(
              t,
              e,
              n
            );
            break;
          case 21:
            He(
              t,
              e,
              n
            );
            break;
          case 22:
            Kt = (r = Kt) || n.memoizedState !== null, He(
              t,
              e,
              n
            ), Kt = r;
            break;
          default:
            He(
              t,
              e,
              n
            );
        }
      }
      function tu(t, e) {
        if (se && e.memoizedState === null && (t = e.alternate, t !== null && (t = t.memoizedState, t !== null))) {
          t = t.dehydrated;
          try {
            oh(t);
          } catch (n) {
            Et(e, e.return, n);
          }
        }
      }
      function eu(t, e) {
        if (se && e.memoizedState === null && (t = e.alternate, t !== null && (t = t.memoizedState, t !== null && (t = t.dehydrated, t !== null))))
          try {
            sh(t);
          } catch (n) {
            Et(e, e.return, n);
          }
      }
      function Dm(t) {
        switch (t.tag) {
          case 31:
          case 13:
          case 19:
            var e = t.stateNode;
            return e === null && (e = t.stateNode = new gd()), e;
          case 22:
            return t = t.stateNode, e = t._retryCache, e === null && (e = t._retryCache = new gd()), e;
          default:
            throw Error(o(435, t.tag));
        }
      }
      function Pl(t, e) {
        var n = Dm(t);
        e.forEach(function(r) {
          if (!n.has(r)) {
            n.add(r);
            var c = Km.bind(null, t, r);
            r.then(c, c);
          }
        });
      }
      function ie(t, e) {
        var n = e.deletions;
        if (n !== null)
          for (var r = 0; r < n.length; r++) {
            var c = n[r], u = t, b = e;
            if (oe) {
              var C = b;
              t: for (; C !== null; ) {
                switch (C.tag) {
                  case 27:
                    if (Vt) {
                      if (wa(C.type)) {
                        Qt = C.stateNode, he = !1;
                        break t;
                      }
                      break;
                    }
                  case 5:
                    Qt = C.stateNode, he = !1;
                    break t;
                  case 3:
                  case 4:
                    Qt = C.stateNode.containerInfo, he = !0;
                    break t;
                }
                C = C.return;
              }
              if (Qt === null) throw Error(o(160));
              qi(u, b, c), Qt = null, he = !1;
            } else qi(u, b, c);
            u = c.alternate, u !== null && (u.return = null), c.return = null;
          }
        if (e.subtreeFlags & 13886)
          for (e = e.child; e !== null; )
            nu(e, t), e = e.sibling;
      }
      function nu(t, e) {
        var n = t.alternate, r = t.flags;
        switch (t.tag) {
          case 0:
          case 11:
          case 14:
          case 15:
            ie(e, t), fe(t), r & 4 && (xn(3, t, t.return), Ia(3, t), xn(5, t, t.return));
            break;
          case 1:
            ie(e, t), fe(t), r & 512 && (Kt || n === null || Qe(n, n.return)), r & 64 && sn && (t = t.updateQueue, t !== null && (r = t.callbacks, r !== null && (n = t.shared.hiddenCallbacks, t.shared.hiddenCallbacks = n === null ? r : n.concat(r))));
            break;
          case 26:
            if (qe) {
              var c = Ye;
              if (ie(e, t), fe(t), r & 512 && (Kt || n === null || Qe(n, n.return)), r & 4) {
                r = n !== null ? n.memoizedState : null;
                var u = t.memoizedState;
                n === null ? u === null ? t.stateNode === null ? t.stateNode = bh(
                  c,
                  t.type,
                  t.memoizedProps,
                  t
                ) : nd(
                  c,
                  t.type,
                  t.stateNode
                ) : t.stateNode = td(
                  c,
                  u,
                  t.memoizedProps
                ) : r !== u ? (r === null ? n.stateNode !== null && ad(n.stateNode) : ed(r), u === null ? nd(
                  c,
                  t.type,
                  t.stateNode
                ) : td(
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
              ie(e, t), fe(t), r & 512 && (Kt || n === null || Qe(n, n.return)), n !== null && r & 4 && Bi(
                t,
                t.memoizedProps,
                n.memoizedProps
              );
              break;
            }
          case 5:
            if (ie(e, t), fe(t), r & 512 && (Kt || n === null || Qe(n, n.return)), oe) {
              if (t.flags & 32) {
                c = t.stateNode;
                try {
                  Vu(c);
                } catch (W) {
                  Et(t, t.return, W);
                }
              }
              r & 4 && t.stateNode != null && (c = t.memoizedProps, Bi(
                t,
                c,
                n !== null ? n.memoizedProps : c
              )), r & 1024 && (To = !0);
            } else
              Ve && t.alternate !== null && (t.alternate.stateNode = t.stateNode);
            break;
          case 6:
            if (ie(e, t), fe(t), r & 4 && oe) {
              if (t.stateNode === null)
                throw Error(o(162));
              r = t.memoizedProps, n = n !== null ? n.memoizedProps : r, c = t.stateNode;
              try {
                Ep(c, n, r);
              } catch (W) {
                Et(t, t.return, W);
              }
            }
            break;
          case 3:
            if (qe ? (yh(), c = Ye, Ye = uo(e.containerInfo), ie(e, t), Ye = c) : ie(e, t), fe(t), r & 4) {
              if (oe && se && n !== null && n.memoizedState.isDehydrated)
                try {
                  ih(e.containerInfo);
                } catch (W) {
                  Et(t, t.return, W);
                }
              if (Ve) {
                r = e.containerInfo, n = e.pendingChildren;
                try {
                  Zu(r, n);
                } catch (W) {
                  Et(t, t.return, W);
                }
              }
            }
            To && (To = !1, au(t));
            break;
          case 4:
            qe ? (n = Ye, Ye = uo(
              t.stateNode.containerInfo
            ), ie(e, t), fe(t), Ye = n) : (ie(e, t), fe(t)), r & 4 && Ve && Fc(
              t.stateNode,
              t,
              t.stateNode.pendingChildren
            );
            break;
          case 12:
            ie(e, t), fe(t);
            break;
          case 31:
            ie(e, t), fe(t), r & 4 && (r = t.updateQueue, r !== null && (t.updateQueue = null, Pl(t, r)));
            break;
          case 13:
            ie(e, t), fe(t), t.child.flags & 8192 && t.memoizedState !== null != (n !== null && n.memoizedState !== null) && (Er = pe()), r & 4 && (r = t.updateQueue, r !== null && (t.updateQueue = null, Pl(t, r)));
            break;
          case 22:
            c = t.memoizedState !== null;
            var b = n !== null && n.memoizedState !== null, C = sn, Y = Kt;
            if (sn = C || c, Kt = Y || b, ie(e, t), Kt = Y, sn = C, fe(t), r & 8192 && (e = t.stateNode, e._visibility = c ? e._visibility & -2 : e._visibility | 1, c && (n === null || b || sn || Kt || Jn(t)), oe)) {
              t: if (n = null, oe)
                for (e = t; ; ) {
                  if (e.tag === 5 || qe && e.tag === 26) {
                    if (n === null) {
                      b = n = e;
                      try {
                        u = b.stateNode, c ? jp(u) : Rp(
                          b.stateNode,
                          b.memoizedProps
                        );
                      } catch (W) {
                        Et(b, b.return, W);
                      }
                    }
                  } else if (e.tag === 6) {
                    if (n === null) {
                      b = e;
                      try {
                        var J = b.stateNode;
                        c ? Op(J) : Dp(J, b.memoizedProps);
                      } catch (W) {
                        Et(b, b.return, W);
                      }
                    }
                  } else if (e.tag === 18) {
                    if (n === null) {
                      b = e;
                      try {
                        var P = b.stateNode;
                        c ? mh(P) : ph(b.stateNode);
                      } catch (W) {
                        Et(b, b.return, W);
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
            r & 4 && (r = t.updateQueue, r !== null && (n = r.retryQueue, n !== null && (r.retryQueue = null, Pl(t, n))));
            break;
          case 19:
            ie(e, t), fe(t), r & 4 && (r = t.updateQueue, r !== null && (t.updateQueue = null, Pl(t, r)));
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
            for (var n, r = t.return; r !== null; ) {
              if (Wc(r)) {
                n = r;
                break;
              }
              r = r.return;
            }
            if (oe) {
              if (n == null) throw Error(o(160));
              switch (n.tag) {
                case 27:
                  if (Vt) {
                    var c = n.stateNode, u = Hi(t);
                    Il(t, u, c);
                    break;
                  }
                case 5:
                  var b = n.stateNode;
                  n.flags & 32 && (Vu(b), n.flags &= -33);
                  var C = Hi(t);
                  Il(t, C, b);
                  break;
                case 3:
                case 4:
                  var Y = n.stateNode.containerInfo, J = Hi(t);
                  Ui(
                    t,
                    J,
                    Y
                  );
                  break;
                default:
                  throw Error(o(161));
              }
            }
          } catch (P) {
            Et(t, t.return, P);
          }
          t.flags &= -3;
        }
        e & 4096 && (t.flags &= -4097);
      }
      function au(t) {
        if (t.subtreeFlags & 1024)
          for (t = t.child; t !== null; ) {
            var e = t;
            au(e), e.tag === 5 && e.flags & 1024 && pp(e.stateNode), t = t.sibling;
          }
      }
      function tn(t, e) {
        if (e.subtreeFlags & 8772)
          for (e = e.child; e !== null; )
            Pc(t, e.alternate, e), e = e.sibling;
      }
      function Jn(t) {
        for (t = t.child; t !== null; ) {
          var e = t;
          switch (e.tag) {
            case 0:
            case 11:
            case 14:
            case 15:
              xn(4, e, e.return), Jn(e);
              break;
            case 1:
              Qe(e, e.return);
              var n = e.stateNode;
              typeof n.componentWillUnmount == "function" && Zc(
                e,
                e.return,
                n
              ), Jn(e);
              break;
            case 27:
              Vt && id(e.stateNode);
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
      function en(t, e, n) {
        for (n = n && (e.subtreeFlags & 8772) !== 0, e = e.child; e !== null; ) {
          var r = e.alternate, c = t, u = e, b = u.flags;
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
                } catch (J) {
                  Et(r, r.return, J);
                }
              if (r = u, c = r.updateQueue, c !== null) {
                var C = r.stateNode;
                try {
                  var Y = c.shared.hiddenCallbacks;
                  if (Y !== null)
                    for (c.shared.hiddenCallbacks = null, c = 0; c < Y.length; c++)
                      Us(Y[c], C);
                } catch (J) {
                  Et(r, r.return, J);
                }
              }
              n && b & 64 && Lc(u), Pa(u, u.return);
              break;
            case 27:
              Vt && Ic(u);
            case 26:
            case 5:
              en(
                c,
                u,
                n
              ), n && r === null && b & 4 && Jc(u), Pa(u, u.return);
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
              ), n && b & 4 && tu(c, u);
              break;
            case 13:
              en(
                c,
                u,
                n
              ), n && b & 4 && eu(c, u);
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
      function Yi(t, e) {
        var n = null;
        t !== null && t.memoizedState !== null && t.memoizedState.cachePool !== null && (n = t.memoizedState.cachePool.pool), t = null, e.memoizedState !== null && e.memoizedState.cachePool !== null && (t = e.memoizedState.cachePool.pool), t !== n && (t != null && t.refCount++, n != null && Ka(n));
      }
      function Gi(t, e) {
        t = null, e.alternate !== null && (t = e.alternate.memoizedState.cache), e = e.memoizedState.cache, e !== t && (e.refCount++, t != null && Ka(t));
      }
      function Ue(t, e, n, r) {
        if (e.subtreeFlags & 10256)
          for (e = e.child; e !== null; )
            lu(
              t,
              e,
              n,
              r
            ), e = e.sibling;
      }
      function lu(t, e, n, r) {
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
                var u = e.memoizedProps, b = u.id, C = u.onPostCommit;
                typeof C == "function" && C(
                  b,
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
            u = e.stateNode, b = e.alternate, e.memoizedState !== null ? u._visibility & 2 ? Ue(
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
            )), c & 2048 && Yi(b, e);
            break;
          case 24:
            Ue(
              t,
              e,
              n,
              r
            ), c & 2048 && Gi(e.alternate, e);
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
          var u = t, b = e, C = n, Y = r, J = b.flags;
          switch (b.tag) {
            case 0:
            case 11:
            case 15:
              ha(
                u,
                b,
                C,
                Y,
                c
              ), Ia(8, b);
              break;
            case 23:
              break;
            case 22:
              var P = b.stateNode;
              b.memoizedState !== null ? P._visibility & 2 ? ha(
                u,
                b,
                C,
                Y,
                c
              ) : $a(
                u,
                b
              ) : (P._visibility |= 2, ha(
                u,
                b,
                C,
                Y,
                c
              )), c && J & 2048 && Yi(
                b.alternate,
                b
              );
              break;
            case 24:
              ha(
                u,
                b,
                C,
                Y,
                c
              ), c && J & 2048 && Gi(b.alternate, b);
              break;
            default:
              ha(
                u,
                b,
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
                $a(n, r), c & 2048 && Yi(
                  r.alternate,
                  r
                );
                break;
              case 24:
                $a(n, r), c & 2048 && Gi(
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
      function Wn(t, e, n) {
        if (t.subtreeFlags & Da)
          for (t = t.child; t !== null; )
            ru(
              t,
              e,
              n
            ), t = t.sibling;
      }
      function ru(t, e, n) {
        switch (t.tag) {
          case 26:
            if (Wn(
              t,
              e,
              n
            ), t.flags & Da)
              if (t.memoizedState !== null)
                wh(
                  n,
                  Ye,
                  t.memoizedState,
                  t.memoizedProps
                );
              else {
                var r = t.stateNode, c = t.type;
                t = t.memoizedProps, ((e & 335544128) === e || oo(c, t)) && Qu(n, r, c, t);
              }
            break;
          case 5:
            Wn(
              t,
              e,
              n
            ), t.flags & Da && (r = t.stateNode, c = t.type, t = t.memoizedProps, ((e & 335544128) === e || oo(c, t)) && Qu(n, r, c, t));
            break;
          case 3:
          case 4:
            qe ? (r = Ye, Ye = uo(
              t.stateNode.containerInfo
            ), Wn(
              t,
              e,
              n
            ), Ye = r) : Wn(
              t,
              e,
              n
            );
            break;
          case 22:
            t.memoizedState === null && (r = t.alternate, r !== null && r.memoizedState !== null ? (r = Da, Da = 16777216, Wn(
              t,
              e,
              n
            ), Da = r) : Wn(
              t,
              e,
              n
            ));
            break;
          default:
            Wn(
              t,
              e,
              n
            );
        }
      }
      function iu(t) {
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
              Wt = r, su(
                r,
                t
              );
            }
          iu(t);
        }
        if (t.subtreeFlags & 10256)
          for (t = t.child; t !== null; )
            ou(t), t = t.sibling;
      }
      function ou(t) {
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
            t.memoizedState !== null && e._visibility & 2 && (t.return === null || t.return.tag !== 13) ? (e._visibility &= -3, $l(t)) : tl(t);
            break;
          default:
            tl(t);
        }
      }
      function $l(t) {
        var e = t.deletions;
        if ((t.flags & 16) !== 0) {
          if (e !== null)
            for (var n = 0; n < e.length; n++) {
              var r = e[n];
              Wt = r, su(
                r,
                t
              );
            }
          iu(t);
        }
        for (t = t.child; t !== null; ) {
          switch (e = t, e.tag) {
            case 0:
            case 11:
            case 15:
              xn(8, e, e.return), $l(e);
              break;
            case 22:
              n = e.stateNode, n._visibility & 2 && (n._visibility &= -3, $l(e));
              break;
            default:
              $l(e);
          }
          t = t.sibling;
        }
      }
      function su(t, e) {
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
              if ($c(r), r === n) {
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
      function Ki(t) {
        var e = rp(t);
        if (e != null) {
          if (typeof e.memoizedProps["data-testname"] != "string")
            throw Error(o(364));
          return e;
        }
        if (t = bp(t), t === null) throw Error(o(362));
        return t.stateNode.current;
      }
      function Qi(t, e) {
        var n = t.tag;
        switch (e.$$typeof) {
          case xr:
            if (t.type === e.value) return !0;
            break;
          case wr:
            t: {
              for (e = e.value, t = [t, 0], n = 0; n < t.length; ) {
                var r = t[n++], c = r.tag, u = t[n++], b = e[u];
                if (c !== 5 && c !== 26 && c !== 27 || !ll(r)) {
                  for (; b != null && Qi(r, b); )
                    u++, b = e[u];
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
            if ((n === 5 || n === 26 || n === 27) && xp(t.stateNode, e.value))
              return !0;
            break;
          case kr:
            if ((n === 5 || n === 6 || n === 26 || n === 27) && (t = yp(t), t !== null && 0 <= t.indexOf(e.value)))
              return !0;
            break;
          case Sr:
            if ((n === 5 || n === 26 || n === 27) && (t = t.memoizedProps["data-testname"], typeof t == "string" && t.toLowerCase() === e.value.toLowerCase()))
              return !0;
            break;
          default:
            throw Error(o(365));
        }
        return !1;
      }
      function Vi(t) {
        switch (t.$$typeof) {
          case xr:
            return "<" + (k(t.value) || "Unknown") + ">";
          case wr:
            return ":has(" + (Vi(t) || "") + ")";
          case _r:
            return '[role="' + t.value + '"]';
          case kr:
            return '"' + t.value + '"';
          case Sr:
            return '[data-testname="' + t.value + '"]';
          default:
            throw Error(o(365));
        }
      }
      function cu(t, e) {
        var n = [];
        t = [t, 0];
        for (var r = 0; r < t.length; ) {
          var c = t[r++], u = c.tag, b = t[r++], C = e[b];
          if (u !== 5 && u !== 26 && u !== 27 || !ll(c)) {
            for (; C != null && Qi(c, C); )
              b++, C = e[b];
            if (b === e.length) n.push(c);
            else
              for (c = c.child; c !== null; )
                t.push(c, b), c = c.sibling;
          }
        }
        return n;
      }
      function Xi(t, e) {
        if (!al) throw Error(o(363));
        t = Ki(t), t = cu(t, e), e = [], t = Array.from(t);
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
        return (xt & 2) !== 0 && _t !== 0 ? _t & -_t : ct.T !== null ? ti() : op();
      }
      function uu() {
        if (Ee === 0)
          if ((_t & 536870912) === 0 || St) {
            var t = or;
            or <<= 1, (or & 3932160) === 0 && (or = 262144), Ee = t;
          } else Ee = 536870912;
        return t = Se.current, t !== null && (t.flags |= 32), Ee;
      }
      function me(t, e, n) {
        (t === At && (Ct === 2 || Ct === 9) || t.cancelPendingCommit !== null) && (ga(t, 0), wn(
          t,
          _t,
          Ee,
          !1
        )), D(t, n), ((xt & 2) === 0 || t !== At) && (t === At && ((xt & 2) === 0 && (ra |= n), Ht === 4 && wn(
          t,
          _t,
          Ee,
          !1
        )), Ke(t));
      }
      function du(t, e, n) {
        if ((xt & 6) !== 0) throw Error(o(327));
        var r = !n && (e & 127) === 0 && (e & t.expiredLanes) === 0 || R(t, e), c = r ? Um(t, e) : Zi(t, e, !0), u = r;
        do {
          if (c === 0) {
            Ba && !r && wn(t, e, 0, !1);
            break;
          } else {
            if (n = t.current.alternate, u && !Bm(n)) {
              c = Zi(t, e, !1), u = !1;
              continue;
            }
            if (c === 2) {
              if (u = e, t.errorRecoveryDisabledLanes & u)
                var b = 0;
              else
                b = t.pendingLanes & -536870913, b = b !== 0 ? b : b & 536870912 ? 536870912 : 0;
              if (b !== 0) {
                e = b;
                t: {
                  var C = t;
                  c = ml;
                  var Y = se && C.current.memoizedState.isDehydrated;
                  if (Y && (ga(C, b).flags |= 256), b = Zi(
                    C,
                    b,
                    !1
                  ), b !== 2) {
                    if (Co && !Y) {
                      C.errorRecoveryDisabledLanes |= u, ra |= u, c = 4;
                      break t;
                    }
                    u = ge, ge = c, u !== null && (ge === null ? ge = u : ge.push.apply(
                      ge,
                      u
                    ));
                  }
                  c = b;
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
                  throw Error(o(345));
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
                  ge = null;
                  break;
                case 3:
                case 5:
                  break;
                default:
                  throw Error(o(329));
              }
              if ((e & 62914560) === e && (c = Er + 300 - pe(), 10 < c)) {
                if (wn(
                  r,
                  e,
                  Ee,
                  !Tn
                ), O(r, 0, !0) !== 0) break t;
                un = e, r.timeoutHandle = ap(
                  fu.bind(
                    null,
                    r,
                    n,
                    ge,
                    zr,
                    Ao,
                    e,
                    Ee,
                    ra,
                    Ha,
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
              fu(
                r,
                n,
                ge,
                zr,
                Ao,
                e,
                Ee,
                ra,
                Ha,
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
      function fu(t, e, n, r, c, u, b, C, Y, J, P, W, nt, gt) {
        if (t.timeoutHandle = In, W = e.subtreeFlags, W & 8192 || (W & 16785408) === 16785408) {
          W = fp(), ru(
            e,
            u,
            W
          );
          var ne = (u & 62914560) === u ? Er - pe() : (u & 4194048) === u ? bd - pe() : 0;
          if (ne = mp(
            W,
            ne
          ), ne !== null) {
            un = u, t.cancelPendingCommit = ne(
              wu.bind(
                null,
                t,
                e,
                u,
                n,
                r,
                c,
                b,
                C,
                Y,
                P,
                W,
                null,
                nt,
                gt
              )
            ), wn(t, u, b, !J);
            return;
          }
        }
        wu(
          t,
          e,
          u,
          n,
          r,
          c,
          b,
          C,
          Y
        );
      }
      function Bm(t) {
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
        e &= ~Mo, e &= ~ra, t.suspendedLanes |= e, t.pingedLanes &= ~e, r && (t.warmLanes |= e), r = t.expirationTimes;
        for (var c = e; 0 < c; ) {
          var u = 31 - xe(c), b = 1 << u;
          r[u] = -1, c &= ~b;
        }
        n !== 0 && p(t, n, e);
      }
      function mu() {
        return (xt & 6) === 0 ? (ma(0), !1) : !0;
      }
      function Li() {
        if (wt !== null) {
          if (Ct === 0)
            var t = wt.return;
          else
            t = wt, rn = $n = null, mi(t), Ma = null, cl = 0, t = wt;
          for (; t !== null; )
            Xc(t.alternate, t), t = t.return;
          wt = null;
        }
      }
      function ga(t, e) {
        var n = t.timeoutHandle;
        n !== In && (t.timeoutHandle = In, lp(n)), n = t.cancelPendingCommit, n !== null && (t.cancelPendingCommit = null, n()), un = 0, Li(), At = t, wt = n = nn(t.current, null), _t = e, Ct = 0, ke = null, Tn = !1, Ba = R(t, e), Co = !1, Ha = Ee = Mo = ra = Cn = Ht = 0, ge = ml = null, Ao = !1, (e & 8) !== 0 && (e |= e & 32);
        var r = t.entangledLanes;
        if (r !== 0)
          for (t = t.entanglements, r &= e; 0 < r; ) {
            var c = 31 - xe(r), u = 1 << c;
            e |= t[c], r &= ~u;
          }
        return cn = e, Dl(), n;
      }
      function pu(t, e) {
        bt = null, ct.H = dl, e === Ca || e === hr ? (e = Rs(), Ct = 3) : e === wo ? (e = Rs(), Ct = 4) : Ct = e === zo ? 8 : e !== null && typeof e == "object" && typeof e.then == "function" ? 6 : 1, ke = e, wt === null && (Ht = 1, Xl(
          t,
          G(e, t.current)
        ));
      }
      function hu() {
        var t = Se.current;
        return t === null ? !0 : (_t & 4194048) === _t ? je === null : (_t & 62914560) === _t || (_t & 536870912) !== 0 ? t === je : !1;
      }
      function gu() {
        var t = ct.H;
        return ct.H = dl, t === null ? dl : t;
      }
      function bu() {
        var t = ct.A;
        return ct.A = Bh, t;
      }
      function tr() {
        Ht = 4, Tn || (_t & 4194048) !== _t && Se.current !== null || (Ba = !0), (Cn & 134217727) === 0 && (ra & 134217727) === 0 || At === null || wn(
          At,
          _t,
          Ee,
          !1
        );
      }
      function Zi(t, e, n) {
        var r = xt;
        xt |= 2;
        var c = gu(), u = bu();
        (At !== t || _t !== e) && (zr = null, ga(t, e)), e = !1;
        var b = Ht;
        t: do
          try {
            if (Ct !== 0 && wt !== null) {
              var C = wt, Y = ke;
              switch (Ct) {
                case 8:
                  Li(), b = 6;
                  break t;
                case 3:
                case 2:
                case 9:
                case 6:
                  Se.current === null && (e = !0);
                  var J = Ct;
                  if (Ct = 0, ke = null, ba(t, C, Y, J), n && Ba) {
                    b = 0;
                    break t;
                  }
                  break;
                default:
                  J = Ct, Ct = 0, ke = null, ba(t, C, Y, J);
              }
            }
            Hm(), b = Ht;
            break;
          } catch (P) {
            pu(t, P);
          }
        while (!0);
        return e && t.shellSuspendCounter++, rn = $n = null, xt = r, ct.H = c, ct.A = u, wt === null && (At = null, _t = 0, Dl()), b;
      }
      function Hm() {
        for (; wt !== null; ) vu(wt);
      }
      function Um(t, e) {
        var n = xt;
        xt |= 2;
        var r = gu(), c = bu();
        At !== t || _t !== e ? (zr = null, pl = pe() + 500, ga(t, e)) : Ba = R(
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
                  if (js(u)) {
                    Ct = 0, ke = null, yu(e);
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
                  js(u) ? (Ct = 0, ke = null, yu(e)) : (Ct = 0, ke = null, ba(t, e, u, 7));
                  break;
                case 5:
                  var b = null;
                  switch (wt.tag) {
                    case 26:
                      b = wt.memoizedState;
                    case 5:
                    case 27:
                      var C = wt, Y = C.type, J = C.pendingProps;
                      if (b ? ld(b) : Ku(C.stateNode, Y, J)) {
                        Ct = 0, ke = null;
                        var P = C.sibling;
                        if (P !== null) wt = P;
                        else {
                          var W = C.return;
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
                  Li(), Ht = 6;
                  break t;
                default:
                  throw Error(o(462));
              }
            }
            qm();
            break;
          } catch (nt) {
            pu(t, nt);
          }
        while (!0);
        return rn = $n = null, ct.H = r, ct.A = c, xt = n, wt !== null ? 0 : (At = null, _t = 0, Dl(), Ht);
      }
      function qm() {
        for (; wt !== null && !Eh(); )
          vu(wt);
      }
      function vu(t) {
        var e = Yc(
          t.alternate,
          t,
          cn
        );
        t.memoizedProps = t.pendingProps, e === null ? er(t) : wt = e;
      }
      function yu(t) {
        var e = t, n = e.alternate;
        switch (e.tag) {
          case 15:
          case 0:
            e = Rc(
              n,
              e,
              e.pendingProps,
              e.type,
              void 0,
              _t
            );
            break;
          case 11:
            e = Rc(
              n,
              e,
              e.pendingProps,
              e.type.render,
              e.ref,
              _t
            );
            break;
          case 5:
            mi(e);
          default:
            Xc(n, e), e = wt = Cu(e, cn), e = Yc(n, e, cn);
        }
        t.memoizedProps = t.pendingProps, e === null ? er(t) : wt = e;
      }
      function ba(t, e, n, r) {
        rn = $n = null, mi(e), Ma = null, cl = 0;
        var c = e.return;
        try {
          if (Cm(
            t,
            c,
            e,
            n,
            _t
          )) {
            Ht = 1, Xl(
              t,
              G(n, t.current)
            ), wt = null;
            return;
          }
        } catch (u) {
          if (c !== null) throw wt = c, u;
          Ht = 1, Xl(
            t,
            G(n, t.current)
          ), wt = null;
          return;
        }
        e.flags & 32768 ? (St || r === 1 ? t = !0 : Ba || (_t & 536870912) !== 0 ? t = !1 : (Tn = t = !0, (r === 2 || r === 9 || r === 3 || r === 6) && (r = Se.current, r !== null && r.tag === 13 && (r.flags |= 16384))), xu(e, t)) : er(e);
      }
      function er(t) {
        var e = t;
        do {
          if ((e.flags & 32768) !== 0) {
            xu(
              e,
              Tn
            );
            return;
          }
          t = e.return;
          var n = jm(
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
        Ht === 0 && (Ht = 5);
      }
      function xu(t, e) {
        do {
          var n = Om(t.alternate, t);
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
        Ht = 6, wt = null;
      }
      function wu(t, e, n, r, c, u, b, C, Y) {
        t.cancelPendingCommit = null;
        do
          el();
        while (Xt !== 0);
        if ((xt & 6) !== 0) throw Error(o(327));
        if (e !== null) {
          if (e === t.current)
            throw Error(o(177));
          if (u = e.lanes | e.childLanes, u |= _o, g(
            t,
            n,
            u,
            b,
            C,
            Y
          ), t === At && (wt = At = null, _t = 0), Ua = e, An = t, un = n, jo = u, Oo = c, vd = r, (e.subtreeFlags & 10256) !== 0 || (e.flags & 10256) !== 0 ? (t.callbackNode = null, t.callbackPriority = 0, Qm(po, function() {
            return zu(), null;
          })) : (t.callbackNode = null, t.callbackPriority = 0), r = (e.flags & 13878) !== 0, (e.subtreeFlags & 13878) !== 0 || r) {
            r = ct.T, ct.T = null, c = ln(), Jt(2), b = xt, xt |= 4;
            try {
              Rm(t, e, n);
            } finally {
              xt = b, Jt(c), ct.T = r;
            }
          }
          Xt = 1, _u(), Su(), ku();
        }
      }
      function _u() {
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
              nu(e, t), ep(t.containerInfo);
            } finally {
              xt = c, Jt(r), ct.T = n;
            }
          }
          t.current = e, Xt = 2;
        }
      }
      function Su() {
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
              Pc(t, e.alternate, e);
            } finally {
              xt = c, Jt(r), ct.T = n;
            }
          }
          Xt = 3;
        }
      }
      function ku() {
        if (Xt === 4 || Xt === 3) {
          Xt = 0, zh();
          var t = An, e = Ua, n = un, r = vd;
          (e.subtreeFlags & 10256) !== 0 || (e.flags & 10256) !== 0 ? Xt = 5 : (Xt = 0, Ua = An = null, Eu(t, t.pendingLanes));
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
              for (var u = t.onRecoverableError, b = 0; b < r.length; b++) {
                var C = r[b];
                u(C.value, {
                  componentStack: C.stack
                });
              }
            } finally {
              ct.T = e, Jt(c);
            }
          }
          (un & 3) !== 0 && el(), Ke(t), c = t.pendingLanes, (n & 261930) !== 0 && (c & 42) !== 0 ? t === Ro ? hl++ : (hl = 0, Ro = t) : hl = 0, se && uh(), ma(0);
        }
      }
      function Eu(t, e) {
        (t.pooledCacheLanes &= e) === 0 && (e = t.pooledCache, e != null && (t.pooledCache = null, Ka(e)));
      }
      function el() {
        return _u(), Su(), ku(), zu();
      }
      function zu() {
        if (Xt !== 5) return !1;
        var t = An, e = jo;
        jo = 0;
        var n = H(un), r = 32 > n ? 32 : n;
        n = ct.T;
        var c = ln();
        try {
          Jt(r), ct.T = null, r = Oo, Oo = null;
          var u = An, b = un;
          if (Xt = 0, Ua = An = null, un = 0, (xt & 6) !== 0)
            throw Error(o(331));
          var C = xt;
          if (xt |= 4, ou(u.current), lu(
            u,
            u.current,
            b,
            r
          ), xt = C, ma(0, !1), we && typeof we.onPostCommitFiberRoot == "function")
            try {
              we.onPostCommitFiberRoot(rl, u);
            } catch {
            }
          return !0;
        } finally {
          Jt(c), ct.T = n, Eu(t, e);
        }
      }
      function Nu(t, e, n) {
        e = G(n, e), e = Ei(t.stateNode, e, 2), t = bn(t, e, 2), t !== null && (D(t, 2), Ke(t));
      }
      function Et(t, e, n) {
        if (t.tag === 3)
          Nu(t, t, n);
        else
          for (; e !== null; ) {
            if (e.tag === 3) {
              Nu(
                e,
                t,
                n
              );
              break;
            } else if (e.tag === 1) {
              var r = e.stateNode;
              if (typeof e.type.getDerivedStateFromError == "function" || typeof r.componentDidCatch == "function" && (Mn === null || !Mn.has(r))) {
                t = G(n, t), n = zc(2), r = bn(e, n, 2), r !== null && (Nc(
                  n,
                  r,
                  e,
                  t
                ), D(r, 2), Ke(r));
                break;
              }
            }
            e = e.return;
          }
      }
      function Ji(t, e, n) {
        var r = t.pingCache;
        if (r === null) {
          r = t.pingCache = new Hh();
          var c = /* @__PURE__ */ new Set();
          r.set(e, c);
        } else
          c = r.get(e), c === void 0 && (c = /* @__PURE__ */ new Set(), r.set(e, c));
        c.has(n) || (Co = !0, c.add(n), t = Ym.bind(null, t, e, n), e.then(t, t));
      }
      function Ym(t, e, n) {
        var r = t.pingCache;
        r !== null && r.delete(e), t.pingedLanes |= t.suspendedLanes & n, t.warmLanes &= ~n, At === t && (_t & n) === n && (Ht === 4 || Ht === 3 && (_t & 62914560) === _t && 300 > pe() - Er ? (xt & 2) === 0 && ga(t, 0) : Mo |= n, Ha === _t && (Ha = 0)), Ke(t);
      }
      function Tu(t, e) {
        e === 0 && (e = L()), t = Ln(t, e), t !== null && (D(t, e), Ke(t));
      }
      function Gm(t) {
        var e = t.memoizedState, n = 0;
        e !== null && (n = e.retryLane), Tu(t, n);
      }
      function Km(t, e) {
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
            throw Error(o(314));
        }
        r !== null && r.delete(e), Tu(t, n);
      }
      function Qm(t, e) {
        return cr(t, e);
      }
      function Vm(t, e, n, r) {
        this.tag = t, this.key = n, this.sibling = this.child = this.return = this.stateNode = this.type = this.elementType = null, this.index = 0, this.refCleanup = this.ref = null, this.pendingProps = e, this.dependencies = this.memoizedState = this.updateQueue = this.memoizedProps = null, this.mode = r, this.subtreeFlags = this.flags = 0, this.deletions = null, this.childLanes = this.lanes = 0, this.alternate = null;
      }
      function Wi(t) {
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
      function Cu(t, e) {
        t.flags &= 65011714;
        var n = t.alternate;
        return n === null ? (t.childLanes = 0, t.lanes = e, t.child = null, t.subtreeFlags = 0, t.memoizedProps = null, t.memoizedState = null, t.updateQueue = null, t.dependencies = null, t.stateNode = null) : (t.childLanes = n.childLanes, t.lanes = n.lanes, t.child = n.child, t.subtreeFlags = 0, t.deletions = null, t.memoizedProps = n.memoizedProps, t.memoizedState = n.memoizedState, t.updateQueue = n.updateQueue, t.type = n.type, e = n.dependencies, t.dependencies = e === null ? null : {
          lanes: e.lanes,
          firstContext: e.firstContext
        }), t;
      }
      function nr(t, e, n, r, c, u) {
        var b = 0;
        if (r = t, typeof t == "function") Wi(t) && (b = 1);
        else if (typeof t == "string")
          b = qe && Vt ? Pu(t, n, te.current) ? 26 : od(t) ? 27 : 5 : qe ? Pu(
            t,
            n,
            te.current
          ) ? 26 : 5 : Vt && od(t) ? 27 : 5;
        else
          t: switch (t) {
            case ro:
              return t = s(31, n, e, c), t.elementType = ro, t.lanes = u, t;
            case ya:
              return Fn(
                n.children,
                c,
                u,
                e
              );
            case Bu:
              b = 8, c |= 24;
              break;
            case to:
              return t = s(12, n, e, c | 2), t.elementType = to, t.lanes = u, t;
            case no:
              return t = s(13, n, e, c), t.elementType = no, t.lanes = u, t;
            case ao:
              return t = s(19, n, e, c), t.elementType = ao, t.lanes = u, t;
            default:
              if (typeof t == "object" && t !== null)
                switch (t.$$typeof) {
                  case _n:
                    b = 10;
                    break t;
                  case Hu:
                    b = 9;
                    break t;
                  case eo:
                    b = 11;
                    break t;
                  case lo:
                    b = 14;
                    break t;
                  case Sn:
                    b = 16, r = null;
                    break t;
                }
              b = 29, n = Error(
                o(
                  130,
                  t === null ? "null" : typeof t,
                  ""
                )
              ), r = null;
          }
        return e = s(b, n, e, c), e.elementType = t, e.type = r, e.lanes = u, e;
      }
      function Fn(t, e, n, r) {
        return t = s(7, t, r, e), t.lanes = n, t;
      }
      function Fi(t, e, n) {
        return t = s(6, t, null, e), t.lanes = n, t;
      }
      function Mu(t) {
        var e = s(18, null, null, 0);
        return e.stateNode = t, e;
      }
      function Ii(t, e, n) {
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
      function Xm(t, e, n, r, c, u, b, C, Y) {
        this.tag = 1, this.containerInfo = t, this.pingCache = this.current = this.pendingChildren = null, this.timeoutHandle = In, this.callbackNode = this.next = this.pendingContext = this.context = this.cancelPendingCommit = null, this.callbackPriority = 0, this.expirationTimes = q(-1), this.entangledLanes = this.shellSuspendCounter = this.errorRecoveryDisabledLanes = this.expiredLanes = this.warmLanes = this.pingedLanes = this.suspendedLanes = this.pendingLanes = 0, this.entanglements = q(0), this.hiddenUpdates = q(null), this.identifierPrefix = r, this.onUncaughtError = c, this.onCaughtError = u, this.onRecoverableError = b, this.pooledCache = null, this.pooledCacheLanes = 0, this.formState = Y, this.incompleteTransitions = /* @__PURE__ */ new Map();
      }
      function Au(t, e, n, r, c, u, b, C, Y, J, P, W) {
        return t = new Xm(
          t,
          e,
          n,
          b,
          Y,
          J,
          P,
          W,
          C
        ), e = 1, u === !0 && (e |= 24), u = s(3, null, null, e), t.current = u, u.stateNode = t, e = $r(), e.refCount++, t.pooledCache = e, e.refCount++, u.memoizedState = {
          element: r,
          isDehydrated: n,
          cache: e
        }, ai(u), t;
      }
      function ju(t) {
        return t ? (t = Sa, t) : Sa;
      }
      function Ou(t) {
        var e = t._reactInternals;
        if (e === void 0)
          throw typeof t.render == "function" ? Error(o(188)) : (t = Object.keys(t).join(","), Error(o(268, t)));
        return t = f(e), t = t !== null ? h(t) : null, t === null ? null : nl(t.stateNode);
      }
      function Ru(t, e, n, r, c, u) {
        c = ju(c), r.context === null ? r.context = c : r.pendingContext = c, r = gn(e), r.payload = { element: n }, u = u === void 0 ? null : u, u !== null && (r.callback = u), n = bn(t, r, e), n !== null && (me(n, t, e), Va(n, t, e));
      }
      function Du(t, e) {
        if (t = t.memoizedState, t !== null && t.dehydrated !== null) {
          var n = t.retryLane;
          t.retryLane = n !== 0 && n < e ? n : e;
        }
      }
      function Pi(t, e) {
        Du(t, e), (t = t.alternate) && Du(t, e);
      }
      var yt = {}, Lm = d0, ye = m0(), $i = Object.assign, Zm = Symbol.for("react.element"), ar = Symbol.for("react.transitional.element"), va = Symbol.for("react.portal"), ya = Symbol.for("react.fragment"), Bu = Symbol.for("react.strict_mode"), to = Symbol.for("react.profiler"), Hu = Symbol.for("react.consumer"), _n = Symbol.for("react.context"), eo = Symbol.for("react.forward_ref"), no = Symbol.for("react.suspense"), ao = Symbol.for("react.suspense_list"), lo = Symbol.for("react.memo"), Sn = Symbol.for("react.lazy"), ro = Symbol.for("react.activity"), Jm = Symbol.for("react.memo_cache_sentinel"), Uu = Symbol.iterator, Wm = Symbol.for("react.client.reference"), lr = Array.isArray, ct = Lm.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE, Fm = l.rendererVersion, Im = l.rendererPackageName, qu = l.extraDevToolsConfig, nl = l.getPublicInstance, Pm = l.getRootHostContext, $m = l.getChildHostContext, tp = l.prepareForCommit, ep = l.resetAfterCommit, np = l.createInstance;
      l.cloneMutableInstance;
      var io = l.appendInitialChild, Yu = l.finalizeInitialChildren, rr = l.shouldSetTextContent, Gu = l.createTextInstance;
      l.cloneMutableTextInstance;
      var ap = l.scheduleTimeout, lp = l.cancelTimeout, In = l.noTimeout, an = l.isPrimaryRenderer;
      l.warnsIfNotActing;
      var oe = l.supportsMutation, Ve = l.supportsPersistence, se = l.supportsHydration, rp = l.getInstanceFromNode;
      l.beforeActiveInstanceBlur;
      var ip = l.preparePortalMount;
      l.prepareScopeUpdate, l.getInstanceFromScope;
      var Jt = l.setCurrentUpdatePriority, ln = l.getCurrentUpdatePriority, op = l.resolveUpdatePriority;
      l.trackSchedulerEvent, l.resolveEventType, l.resolveEventTimeStamp;
      var sp = l.shouldAttemptEagerTransition, cp = l.detachDeletedInstance;
      l.requestPostPaintCallback;
      var up = l.maySuspendCommit, dp = l.maySuspendCommitOnUpdate, oo = l.maySuspendCommitInSyncRender, Ku = l.preloadInstance, fp = l.startSuspendingCommit, Qu = l.suspendInstance;
      l.suspendOnActiveViewTransition;
      var mp = l.waitForCommitToBeReady;
      l.getSuspendedCommitReason;
      var xa = l.NotPendingTransition, Pn = l.HostTransitionContext, pp = l.resetFormInstance;
      l.bindToConsole;
      var hp = l.supportsMicrotasks, gp = l.scheduleMicrotask, al = l.supportsTestSelectors, bp = l.findFiberRoot, vp = l.getBoundingRect, yp = l.getTextContent, ll = l.isHiddenSubtree, xp = l.matchAccessibilityRole, wp = l.setFocusIfFocusable, _p = l.setupIntersectionObserver, Sp = l.appendChild, kp = l.appendChildToContainer, Ep = l.commitTextUpdate, zp = l.commitMount, Np = l.commitUpdate, Tp = l.insertBefore, Cp = l.insertInContainerBefore, Mp = l.removeChild, Ap = l.removeChildFromContainer, Vu = l.resetTextContent, jp = l.hideInstance, Op = l.hideTextInstance, Rp = l.unhideInstance, Dp = l.unhideTextInstance;
      l.cancelViewTransitionName, l.cancelRootViewTransitionName, l.restoreRootViewTransitionName, l.cloneRootViewTransitionContainer, l.removeRootViewTransitionClone, l.measureClonedInstance, l.hasInstanceChanged, l.hasInstanceAffectedParent, l.startViewTransition, l.startGestureTransition, l.stopViewTransition, l.getCurrentGestureOffset, l.createViewTransitionInstance;
      var Bp = l.clearContainer;
      l.createFragmentInstance, l.updateFragmentInstanceFiber, l.commitNewChildToFragmentInstance, l.deleteChildFromFragmentInstance;
      var Hp = l.cloneInstance, Xu = l.createContainerChildSet, Lu = l.appendChildToContainerChildSet, Up = l.finalizeContainerChildren, Zu = l.replaceContainerChildren, Ju = l.cloneHiddenInstance, Wu = l.cloneHiddenTextInstance, so = l.isSuspenseInstancePending, co = l.isSuspenseInstanceFallback, qp = l.getSuspenseInstanceFallbackErrorDetails, Yp = l.registerSuspenseInstanceRetry, Gp = l.canHydrateFormStateMarker, Kp = l.isFormStateMarkerMatching, Fu = l.getNextHydratableSibling, Qp = l.getNextHydratableSiblingAfterSingleton, Vp = l.getFirstHydratableChild, Xp = l.getFirstHydratableChildWithinContainer, Lp = l.getFirstHydratableChildWithinActivityInstance, Zp = l.getFirstHydratableChildWithinSuspenseInstance, Jp = l.getFirstHydratableChildWithinSingleton, Wp = l.canHydrateInstance, Fp = l.canHydrateTextInstance, Ip = l.canHydrateActivityInstance, Pp = l.canHydrateSuspenseInstance, $p = l.hydrateInstance, th = l.hydrateTextInstance, eh = l.hydrateActivityInstance, nh = l.hydrateSuspenseInstance, ah = l.getNextHydratableInstanceAfterActivityInstance, lh = l.getNextHydratableInstanceAfterSuspenseInstance, rh = l.commitHydratedInstance, ih = l.commitHydratedContainer, oh = l.commitHydratedActivityInstance, sh = l.commitHydratedSuspenseInstance, ch = l.finalizeHydratedChildren, uh = l.flushHydrationEvents;
      l.clearActivityBoundary;
      var dh = l.clearSuspenseBoundary;
      l.clearActivityBoundaryFromContainer;
      var fh = l.clearSuspenseBoundaryFromContainer, mh = l.hideDehydratedBoundary, ph = l.unhideDehydratedBoundary, Iu = l.shouldDeleteUnhydratedTailInstances;
      l.diffHydratedPropsForDevWarnings, l.diffHydratedTextForDevWarnings, l.describeHydratableInstanceForDevWarnings;
      var hh = l.validateHydratableInstance, gh = l.validateHydratableTextInstance, qe = l.supportsResources, Pu = l.isHostHoistableType, uo = l.getHoistableRoot, $u = l.getResource, td = l.acquireResource, ed = l.releaseResource, bh = l.hydrateHoistable, nd = l.mountHoistable, ad = l.unmountHoistable, vh = l.createHoistableInstance, yh = l.prepareToCommitHoistables, xh = l.mayResourceSuspendCommit, ld = l.preloadResource, wh = l.suspendResource, Vt = l.supportsSingletons, rd = l.resolveSingletonInstance, _h = l.acquireSingletonInstance, id = l.releaseSingletonInstance, od = l.isHostSingletonType, wa = l.isSingletonScope, fo = [], _a = -1, Sa = {}, xe = Math.clz32 ? Math.clz32 : _, Sh = Math.log, kh = Math.LN2, ir = 256, or = 262144, sr = 4194304, cr = ye.unstable_scheduleCallback, mo = ye.unstable_cancelCallback, Eh = ye.unstable_shouldYield, zh = ye.unstable_requestPaint, pe = ye.unstable_now, sd = ye.unstable_ImmediatePriority, Nh = ye.unstable_UserBlockingPriority, po = ye.unstable_NormalPriority, Th = ye.unstable_IdlePriority, Ch = ye.log, Mh = ye.unstable_setDisableYieldValue, rl = null, we = null, _e = typeof Object.is == "function" ? Object.is : $, cd = typeof reportError == "function" ? reportError : function(t) {
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
      }, Ah = Object.prototype.hasOwnProperty, ho, ud, go = !1, dd = /* @__PURE__ */ new WeakMap(), ka = [], Ea = 0, ur = null, il = 0, Te = [], Ce = 0, kn = null, Xe = 1, Le = "", te = y(null), ol = y(null), En = y(null), dr = y(null), ee = null, Ot = null, St = !1, zn = null, Me = !1, bo = Error(o(519)), fr = y(null), $n = null, rn = null, jh = typeof AbortController < "u" ? AbortController : function() {
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
      }, Oh = ye.unstable_scheduleCallback, Rh = ye.unstable_NormalPriority, Rt = {
        $$typeof: _n,
        Consumer: null,
        Provider: null,
        _currentValue: null,
        _currentValue2: null,
        _threadCount: 0
      }, mr = null, za = null, vo = !1, pr = !1, yo = !1, ta = 0, sl = null, xo = 0, Na = 0, Ta = null, fd = ct.S;
      ct.S = function(t, e) {
        bd = pe(), typeof e == "object" && e !== null && typeof e.then == "function" && wm(t, e), fd !== null && fd(t, e);
      };
      var ea = y(null), Ca = Error(o(460)), wo = Error(o(474)), hr = Error(o(542)), gr = { then: function() {
      } }, na = null, Ma = null, cl = 0, aa = Bs(!0), md = Bs(!1), Ae = [], Aa = 0, _o = 0, Nn = !1, So = !1, ja = y(null), br = y(0), Se = y(null), je = null, qt = y(0), on = 0, bt = null, Mt = null, Yt = null, vr = !1, Oa = !1, la = !1, yr = 0, ul = 0, Ra = null, Dh = 0, dl = {
        readContext: Pt,
        use: Yl,
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
      var pd = {
        readContext: Pt,
        use: Yl,
        useCallback: function(t, e) {
          return de().memoizedState = [
            t,
            e === void 0 ? null : e
          ], t;
        },
        useContext: Pt,
        useEffect: oc,
        useImperativeHandle: function(t, e, n) {
          n = n != null ? n.concat([t]) : null, Kl(
            4194308,
            4,
            dc.bind(null, e, t),
            n
          );
        },
        useLayoutEffect: function(t, e) {
          return Kl(4194308, 4, t, e);
        },
        useInsertionEffect: function(t, e) {
          Kl(4, 2, t, e);
        },
        useMemo: function(t, e) {
          var n = de();
          e = e === void 0 ? null : e;
          var r = t();
          if (la) {
            V(!0);
            try {
              t();
            } finally {
              V(!1);
            }
          }
          return n.memoizedState = [r, e], r;
        },
        useReducer: function(t, e, n) {
          var r = de();
          if (n !== void 0) {
            var c = n(e);
            if (la) {
              V(!0);
              try {
                n(e);
              } finally {
                V(!1);
              }
            }
          } else c = e;
          return r.memoizedState = r.baseState = c, t = {
            pending: null,
            lanes: 0,
            dispatch: null,
            lastRenderedReducer: t,
            lastRenderedState: c
          }, r.queue = t, t = t.dispatch = Tm.bind(
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
          t = bi(t);
          var e = t.queue, n = xc.bind(
            null,
            bt,
            e
          );
          return e.dispatch = n, [t.memoizedState, n];
        },
        useDebugValue: xi,
        useDeferredValue: function(t, e) {
          var n = de();
          return wi(n, t, e);
        },
        useTransition: function() {
          var t = bi(!1);
          return t = gc.bind(
            null,
            bt,
            t.queue,
            !0,
            !1
          ), de().memoizedState = t, [!1, t];
        },
        useSyncExternalStore: function(t, e, n) {
          var r = bt, c = de();
          if (St) {
            if (n === void 0)
              throw Error(o(407));
            n = n();
          } else {
            if (n = e(), At === null)
              throw Error(o(349));
            (_t & 127) !== 0 || Xs(r, e, n);
          }
          c.memoizedState = n;
          var u = { value: n, getSnapshot: e };
          return c.queue = u, oc(Zs.bind(null, r, u, t), [
            t
          ]), r.flags |= 2048, pa(
            9,
            { destroy: void 0 },
            Ls.bind(
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
          var t = de(), e = At.identifierPrefix;
          if (St) {
            var n = Le, r = Xe;
            n = (r & ~(1 << 32 - xe(r) - 1)).toString(32) + n, e = "_" + e + "R_" + n, n = yr++, 0 < n && (e += "H" + n.toString(32)), e += "_";
          } else
            n = Dh++, e = "_" + e + "r_" + n.toString(32) + "_";
          return t.memoizedState = e;
        },
        useHostTransitionStatus: _i,
        useFormState: nc,
        useActionState: nc,
        useOptimistic: function(t) {
          var e = de();
          e.memoizedState = e.baseState = t;
          var n = {
            pending: null,
            lanes: 0,
            dispatch: null,
            lastRenderedReducer: null,
            lastRenderedState: null
          };
          return e.queue = n, e = Si.bind(
            null,
            bt,
            !0,
            n
          ), n.dispatch = e, [t, e];
        },
        useMemoCache: pi,
        useCacheRefresh: function() {
          return de().memoizedState = Nm.bind(
            null,
            bt
          );
        },
        useEffectEvent: function(t) {
          var e = de(), n = { impl: t };
          return e.memoizedState = n, function() {
            if ((xt & 2) !== 0)
              throw Error(o(440));
            return n.impl.apply(void 0, arguments);
          };
        }
      }, ko = {
        readContext: Pt,
        use: Yl,
        useCallback: mc,
        useContext: Pt,
        useEffect: yi,
        useImperativeHandle: fc,
        useInsertionEffect: cc,
        useLayoutEffect: uc,
        useMemo: pc,
        useReducer: Gl,
        useRef: ic,
        useState: function() {
          return Gl(Pe);
        },
        useDebugValue: xi,
        useDeferredValue: function(t, e) {
          var n = Ut();
          return hc(
            n,
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
        useSyncExternalStore: Vs,
        useId: vc,
        useHostTransitionStatus: _i,
        useFormState: ac,
        useActionState: ac,
        useOptimistic: function(t, e) {
          var n = Ut();
          return Fs(n, Mt, t, e);
        },
        useMemoCache: pi,
        useCacheRefresh: yc
      };
      ko.useEffectEvent = sc;
      var hd = {
        readContext: Pt,
        use: Yl,
        useCallback: mc,
        useContext: Pt,
        useEffect: yi,
        useImperativeHandle: fc,
        useInsertionEffect: cc,
        useLayoutEffect: uc,
        useMemo: pc,
        useReducer: gi,
        useRef: ic,
        useState: function() {
          return gi(Pe);
        },
        useDebugValue: xi,
        useDeferredValue: function(t, e) {
          var n = Ut();
          return Mt === null ? wi(n, t, e) : hc(
            n,
            Mt.memoizedState,
            t,
            e
          );
        },
        useTransition: function() {
          var t = gi(Pe)[0], e = Ut().memoizedState;
          return [
            typeof t == "boolean" ? t : Za(t),
            e
          ];
        },
        useSyncExternalStore: Vs,
        useId: vc,
        useHostTransitionStatus: _i,
        useFormState: rc,
        useActionState: rc,
        useOptimistic: function(t, e) {
          var n = Ut();
          return Mt !== null ? Fs(n, Mt, t, e) : (n.baseState = t, [t, n.queue.dispatch]);
        },
        useMemoCache: pi,
        useCacheRefresh: yc
      };
      hd.useEffectEvent = sc;
      var Eo = {
        enqueueSetState: function(t, e, n) {
          t = t._reactInternals;
          var r = ve(), c = gn(r);
          c.payload = e, n != null && (c.callback = n), e = bn(t, c, r), e !== null && (me(e, t, r), Va(e, t, r));
        },
        enqueueReplaceState: function(t, e, n) {
          t = t._reactInternals;
          var r = ve(), c = gn(r);
          c.tag = 1, c.payload = e, n != null && (c.callback = n), e = bn(t, c, r), e !== null && (me(e, t, r), Va(e, t, r));
        },
        enqueueForceUpdate: function(t, e) {
          t = t._reactInternals;
          var n = ve(), r = gn(n);
          r.tag = 2, e != null && (r.callback = e), e = bn(t, r, n), e !== null && (me(e, t, n), Va(e, t, n));
        }
      }, zo = Error(o(461)), Gt = !1, No = {
        dehydrated: null,
        treeContext: null,
        retryLane: 0,
        hydrationErrors: null
      }, sn = !1, Kt = !1, To = !1, gd = typeof WeakSet == "function" ? WeakSet : Set, Wt = null, Qt = null, he = !1, Ye = null, Da = 8192, Bh = {
        getCacheForType: function(t) {
          var e = Pt(Rt), n = e.data.get(t);
          return n === void 0 && (n = t(), e.data.set(t, n)), n;
        },
        cacheSignal: function() {
          return Pt(Rt).controller.signal;
        }
      }, xr = 0, wr = 1, _r = 2, Sr = 3, kr = 4;
      if (typeof Symbol == "function" && Symbol.for) {
        var fl = Symbol.for;
        xr = fl("selector.component"), wr = fl("selector.has_pseudo_class"), _r = fl("selector.role"), Sr = fl("selector.test_id"), kr = fl("selector.text");
      }
      var Hh = typeof WeakMap == "function" ? WeakMap : Map, xt = 0, At = null, wt = null, _t = 0, Ct = 0, ke = null, Tn = !1, Ba = !1, Co = !1, cn = 0, Ht = 0, Cn = 0, ra = 0, Mo = 0, Ee = 0, Ha = 0, ml = null, ge = null, Ao = !1, Er = 0, bd = 0, pl = 1 / 0, zr = null, Mn = null, Xt = 0, An = null, Ua = null, un = 0, jo = 0, Oo = null, vd = null, hl = 0, Ro = null;
      return yt.attemptContinuousHydration = function(t) {
        if (t.tag === 13 || t.tag === 31) {
          var e = Ln(t, 67108864);
          e !== null && me(e, t, 67108864), Pi(t, 67108864);
        }
      }, yt.attemptHydrationAtCurrentPriority = function(t) {
        if (t.tag === 13 || t.tag === 31) {
          var e = ve();
          e = M(e);
          var n = Ln(t, e);
          n !== null && me(n, t, e), Pi(t, e);
        }
      }, yt.attemptSynchronousHydration = function(t) {
        switch (t.tag) {
          case 3:
            if (t = t.stateNode, t.current.memoizedState.isDehydrated) {
              var e = E(t.pendingLanes);
              if (e !== 0) {
                for (t.pendingLanes |= 2, t.entangledLanes |= 2; e; ) {
                  var n = 1 << 31 - xe(e);
                  t.entanglements[1] |= n, e &= ~n;
                }
                Ke(t), (xt & 6) === 0 && (pl = pe() + 500, ma(0));
              }
            }
            break;
          case 31:
          case 13:
            e = Ln(t, 2), e !== null && me(e, t, 2), mu(), Pi(t, 2);
        }
      }, yt.batchedUpdates = function(t, e) {
        return t(e);
      }, yt.createComponentSelector = function(t) {
        return { $$typeof: xr, value: t };
      }, yt.createContainer = function(t, e, n, r, c, u, b, C, Y, J) {
        return Au(
          t,
          e,
          !1,
          null,
          n,
          r,
          u,
          null,
          b,
          C,
          Y,
          J
        );
      }, yt.createHasPseudoClassSelector = function(t) {
        return { $$typeof: wr, value: t };
      }, yt.createHydrationContainer = function(t, e, n, r, c, u, b, C, Y, J, P, W, nt, gt) {
        return t = Au(
          n,
          r,
          !0,
          t,
          c,
          u,
          C,
          gt,
          Y,
          J,
          P,
          W
        ), t.context = ju(null), n = t.current, r = ve(), r = M(r), c = gn(r), c.callback = e ?? null, bn(n, c, r), e = r, t.current.lanes = e, D(t, e), Ke(t), t;
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
        return { $$typeof: _r, value: t };
      }, yt.createTestNameSelector = function(t) {
        return { $$typeof: Sr, value: t };
      }, yt.createTextSelector = function(t) {
        return { $$typeof: kr, value: t };
      }, yt.defaultOnCaughtError = function(t) {
        console.error(t);
      }, yt.defaultOnRecoverableError = function(t) {
        cd(t);
      }, yt.defaultOnUncaughtError = function(t) {
        cd(t);
      }, yt.deferredUpdates = function(t) {
        var e = ct.T, n = ln();
        try {
          return Jt(32), ct.T = null, t();
        } finally {
          Jt(n), ct.T = e;
        }
      }, yt.discreteUpdates = function(t, e, n, r, c) {
        var u = ct.T, b = ln();
        try {
          return Jt(2), ct.T = null, t(e, n, r, c);
        } finally {
          Jt(b), ct.T = u, xt === 0 && (pl = pe() + 500);
        }
      }, yt.findAllNodes = Xi, yt.findBoundingRects = function(t, e) {
        if (!al) throw Error(o(363));
        e = Xi(t, e), t = [];
        for (var n = 0; n < e.length; n++)
          t.push(vp(e[n]));
        for (e = t.length - 1; 0 < e; e--) {
          n = t[e];
          for (var r = n.x, c = r + n.width, u = n.y, b = u + n.height, C = e - 1; 0 <= C; C--)
            if (e !== C) {
              var Y = t[C], J = Y.x, P = J + Y.width, W = Y.y, nt = W + Y.height;
              if (r >= J && u >= W && c <= P && b <= nt) {
                t.splice(e, 1);
                break;
              } else if (r !== J || n.width !== Y.width || nt < u || W > b) {
                if (!(u !== W || n.height !== Y.height || P < r || J > c)) {
                  J > r && (Y.width += J - r, Y.x = r), P < c && (Y.width = c - J), t.splice(e, 1);
                  break;
                }
              } else {
                W > u && (Y.height += W - u, Y.y = u), nt < b && (Y.height = b - W), t.splice(e, 1);
                break;
              }
            }
        }
        return t;
      }, yt.findHostInstance = Ou, yt.findHostInstanceWithNoPortals = function(t) {
        return t = f(t), t = t !== null ? x(t) : null, t === null ? null : nl(t.stateNode);
      }, yt.findHostInstanceWithWarning = function(t) {
        return Ou(t);
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
      }, yt.flushSyncWork = mu, yt.focusWithin = function(t, e) {
        if (!al) throw Error(o(363));
        for (t = Ki(t), e = cu(t, e), e = Array.from(e), t = 0; t < e.length; ) {
          var n = e[t++], r = n.tag;
          if (!ll(n)) {
            if ((r === 5 || r === 26 || r === 27) && wp(n.stateNode))
              return !0;
            for (n = n.child; n !== null; )
              e.push(n), n = n.sibling;
          }
        }
        return !1;
      }, yt.getFindAllNodesFailureDescription = function(t, e) {
        if (!al) throw Error(o(363));
        var n = 0, r = [];
        t = [Ki(t), 0];
        for (var c = 0; c < t.length; ) {
          var u = t[c++], b = u.tag, C = t[c++], Y = e[C];
          if ((b !== 5 && b !== 26 && b !== 27 || !ll(u)) && (Qi(u, Y) && (r.push(Vi(Y)), C++, C > n && (n = C)), C < e.length))
            for (u = u.child; u !== null; )
              t.push(u, C), u = u.sibling;
        }
        if (n < e.length) {
          for (t = []; n < e.length; n++)
            t.push(Vi(e[n]));
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
          version: Fm,
          rendererPackageName: Im,
          currentDispatcherRef: ct,
          reconcilerVersion: "19.2.0"
        };
        if (qu !== null && (t.rendererConfig = qu), typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ > "u") t = !1;
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
        if (!al) throw Error(o(363));
        t = Xi(t, e);
        var c = _p(
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
        if (t.tag !== 5) throw Error(o(476));
        var c = bc(t).queue;
        gc(
          t,
          c,
          e,
          xa,
          n === null ? i : function() {
            var u = bc(t);
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
        return Ru(
          c,
          u,
          t,
          e,
          n,
          r
        ), u;
      }, yt.updateContainerSync = function(t, e, n, r) {
        return Ru(
          e.current,
          2,
          t,
          e,
          n,
          r
        ), 2;
      }, yt;
    }, a.exports.default = a.exports, Object.defineProperty(a.exports, "__esModule", { value: !0 });
  })(Uo)), Uo.exports;
}
var Ad;
function h0() {
  return Ad || (Ad = 1, Ho.exports = p0()), Ho.exports;
}
var g0 = h0();
const b0 = /* @__PURE__ */ hs(g0);
var Go = { exports: {} }, dn = {};
/**
 * @license React
 * react-reconciler-constants.production.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var jd;
function v0() {
  return jd || (jd = 1, dn.ConcurrentRoot = 1, dn.ContinuousEventPriority = 8, dn.DefaultEventPriority = 32, dn.DiscreteEventPriority = 2, dn.IdleEventPriority = 268435456, dn.LegacyRoot = 0, dn.NoEventPriority = 0), dn;
}
var Od;
function y0() {
  return Od || (Od = 1, Go.exports = v0()), Go.exports;
}
var El = y0();
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
const _f = ["accent", "panel-bg", "surface-0", "surface-1", "surface-dim", "overlay-0", "overlay-1", "text", "subtext-0", "mauve", "green", "yellow", "red", "blue", "teal", "peach", "backdrop", "card-bg"], Fo = 16, Sf = /* @__PURE__ */ new Set(["hover", "focus", "focus-visible", "focus-within", "active"]), x0 = [
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
], Rd = {
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
}, w0 = /* @__PURE__ */ new Set([
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
]), kf = {
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
}, Ef = {
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
}, Io = ["font-size", "color", ...new Set([...Object.keys(kf), ...Object.keys(Ef)].filter((a) => a !== "font-size" && a !== "color"))], _0 = new Set(Io);
function le(a, l = " ") {
  const s = [];
  let i = 0, o = "";
  for (let d = 0; d < a.length; d++) {
    const m = a[d];
    if (m === "(" ? i++ : m === ")" && i--, i === 0 && (l === " " ? /\s/.test(m) : m === l)) {
      (o.trim() || l !== " ") && s.push(o.trim()), o = "";
      continue;
    }
    o += m;
  }
  return (o.trim() || l !== " " && s.length) && s.push(o.trim()), s;
}
function Po(a, l, s = 0) {
  if (s > 32) return null;
  let i = "", o = 0;
  for (; ; ) {
    const d = a.indexOf("var(", o);
    if (d < 0)
      return i += a.slice(o), i;
    i += a.slice(o, d);
    let m = 1, f = d + 4;
    for (; f < a.length && m; f++)
      a[f] === "(" ? m++ : a[f] === ")" && m--;
    const h = a.slice(d + 4, f - 1), x = le(h, ","), S = x[0].trim(), k = x.length > 1 ? h.slice(h.indexOf(",") + 1).trim() : null;
    let y = l(S);
    if ((y == null || y === "initial") && (y = k), y == null) return null;
    const w = Po(y, l, s + 1);
    if (w === null) return null;
    i += w, o = f;
  }
}
function S0(a) {
  const l = [], s = /\s*(?:(-?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)(%|[a-z]+)?|([a-z-]+)\(|(infinity)|([()+*/,])|(-)(?=\s))/giy;
  let i, o = 0;
  for (; o < a.length; ) {
    if (s.lastIndex = o, i = s.exec(a), !i || i.index !== o) {
      if (/^\s+$/.test(a.slice(o))) break;
      return null;
    }
    o = s.lastIndex, i[1] !== void 0 ? l.push({ num: parseFloat(i[1]), unit: (i[2] ?? "").toLowerCase() }) : i[3] ? l.push({ fn: i[3].toLowerCase() }) : i[4] ? l.push({ num: 1 / 0, unit: "" }) : l.push({ op: i[5] ?? i[6] });
  }
  return l;
}
function Yn(a, l) {
  const s = S0(a.trim().replace(/env\(\s*safe-area-inset-(?:top|right|bottom|left)\s*(?:,[^()]*)?\)/gi, "0px"));
  if (!s) return null;
  let i = 0;
  const o = ({ num: y, unit: w }) => {
    switch (w) {
      case "":
        return { px: 0, pct: 0, num: y, unitless: !0 };
      case "px":
        return { px: y, pct: 0, num: 0 };
      case "rem":
        return { px: y * Fo, pct: 0, num: 0 };
      case "em":
        return { px: y * (l.fontSize ?? Fo), pct: 0, num: 0 };
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
  }, d = (y, w, N) => y && w ? { px: y.px + N * w.px, pct: y.pct + N * w.pct, num: y.num + N * w.num, unitless: y.unitless && w.unitless } : null, m = (y, w) => y ? { px: y.px * w, pct: y.pct * w, num: y.num * w, unitless: y.unitless } : null, f = (y) => y && y.unitless;
  function h() {
    const y = s[i++];
    if (!y) return null;
    if (y.num !== void 0) return o(y);
    if (y.op === "(") {
      const w = S();
      return s[i]?.op !== ")" ? null : (i++, w);
    }
    if (y.op === "-" || y.op === "+") {
      const w = h();
      return y.op === "-" ? m(w, -1) : w;
    }
    if (y.fn) {
      const w = [];
      for (; ; ) {
        w.push(S());
        const E = s[i++];
        if (!E) return null;
        if (E.op === ")") break;
        if (E.op !== ",") return null;
      }
      if (w.some((E) => !E)) return null;
      if (y.fn === "calc") return w[0];
      if (!(w.every((E) => !E.pct) || w.every((E) => !E.px && !E.num))) return null;
      const _ = (E) => E.px + E.pct + E.num;
      return y.fn === "min" ? w.reduce((E, O) => _(O) < _(E) ? O : E) : y.fn === "max" ? w.reduce((E, O) => _(O) > _(E) ? O : E) : y.fn === "clamp" && w.length === 3 ? _(w[1]) < _(w[0]) ? w[0] : _(w[1]) > _(w[2]) ? w[2] : w[1] : null;
    }
    return null;
  }
  function x() {
    let y = h();
    for (; s[i] && (s[i].op === "*" || s[i].op === "/"); ) {
      const w = s[i++].op, N = h();
      if (!y || !N) return null;
      w === "*" ? y = f(N) ? m(y, N.num) : f(y) ? m(N, y.num) : null : y = f(N) && N.num !== 0 ? m(y, 1 / N.num) : null;
    }
    return y;
  }
  function S() {
    let y = x();
    for (; s[i] && (s[i].op === "+" || s[i].op === "-"); ) {
      const w = s[i++].op;
      y = d(y, x(), w === "-" ? -1 : 1);
    }
    return y;
  }
  const k = S();
  return i !== s.length || !k ? null : k;
}
function $o(a, l) {
  const s = a.trim().toLowerCase();
  if (/^(auto|none|normal|fit-content|max-content|min-content|medium|thin|thick)$/.test(s))
    return s === "thin" ? { px: 1 } : s === "medium" ? { px: 3 } : s === "thick" ? { px: 5 } : s;
  const i = Yn(s, l);
  return i ? i.unitless ? i.num === 0 ? { px: 0 } : { expr: a.trim() } : i.pct && (i.px || i.num) ? { expr: a.trim() } : i.pct ? { pct: i.pct } : { px: k0(i.px) } : { expr: a.trim() };
}
const k0 = (a) => Number.isFinite(a) ? a : a > 0 ? 34e37 : -34e37, Tr = (a) => Math.max(0, Math.min(255, Math.round(a))).toString(16).padStart(2, "0"), E0 = ([a, l, s, i]) => `#${Tr(a)}${Tr(l)}${Tr(s)}${Tr(i * 255)}`;
function Dd(a) {
  const l = a.slice(1), s = l.length <= 4 ? l.split("").map((o) => o + o).join("") : l;
  if (!/^[0-9a-f]{6}([0-9a-f]{2})?$/i.test(s)) return null;
  const i = (o) => parseInt(s.slice(o, o + 2), 16);
  return [i(0), i(2), i(4), s.length === 8 ? i(6) / 255 : 1];
}
function Ur(a, l) {
  const s = a.trim().toLowerCase();
  if (s === "currentcolor") return "currentcolor";
  const i = /^perchtoken\(([a-z0-9-]+)\)$/.exec(s);
  if (i) {
    const x = l(i[1]), S = x && Dd(x);
    return S ? { rgba: S, token: i[1] } : null;
  }
  if (s.startsWith("#")) {
    const x = Dd(s);
    return x ? { rgba: x, token: null } : null;
  }
  if (Rd[s]) return { rgba: [...Rd[s]], token: null };
  const o = /^(rgba?|color-mix)\((.*)\)$/s.exec(s);
  if (!o) return null;
  if (o[1] === "color-mix") {
    const x = le(o[2], ",");
    if (x.length !== 3 || !/^in\s+(srgb|srgb-linear|oklab|lab|oklch|lch|hsl|xyz)/.test(x[0])) return null;
    const S = (V) => {
      const $ = le(V), tt = $.findIndex((I) => /%$/.test(I)), Q = tt >= 0 ? parseFloat($[tt]) / 100 : null;
      return { color: Ur($.filter((I, G) => G !== tt).join(" "), l), pct: Q };
    }, k = S(x[1]), y = S(x[2]);
    if (!k.color || !y.color || k.color === "currentcolor" || y.color === "currentcolor") return null;
    let w = k.pct, N = y.pct;
    w === null && N === null ? (w = 0.5, N = 0.5) : w === null ? w = 1 - N : N === null && (N = 1 - w);
    const _ = w + N, E = _ < 1 ? _ : 1;
    w /= _, N /= _;
    const [O, R, A, L] = k.color.rgba, [q, D, g, p] = y.color.rgba, v = L * w + p * N, z = (V, $) => v === 0 ? 0 : (V * L * w + $ * p * N) / v, M = [z(O, q), z(R, D), z(A, g), v * E], H = p === 0 ? k.color.token : L === 0 ? y.color.token : null;
    return { rgba: M, token: H };
  }
  const d = o[2].includes(",") ? le(o[2], ",") : le(o[2].replace("/", " / ")).filter((x) => x !== "/");
  if (d.length < 3) return null;
  const m = (x) => x.endsWith("%") ? parseFloat(x) / 100 * 255 : parseFloat(x), f = d[3] === void 0 ? 1 : d[3].endsWith("%") ? parseFloat(d[3]) / 100 : parseFloat(d[3]), h = [m(d[0]), m(d[1]), m(d[2]), f];
  return h.some((x) => Number.isNaN(x)) ? null : { rgba: h, token: null };
}
const xl = ["top", "right", "bottom", "left"], z0 = ["top-left", "top-right", "bottom-right", "bottom-left"], Cr = (a) => [a[0], a[1] ?? a[0], a[2] ?? a[0], a[3] ?? a[1] ?? a[0]], Bd = /* @__PURE__ */ new Set(["none", "hidden", "solid", "dashed", "dotted", "double", "groove", "ridge", "inset", "outset"]);
function ts(a, l) {
  const s = l.trim(), i = () => le(s);
  switch (a) {
    case "padding":
    case "margin": {
      const o = Cr(i());
      return xl.map((d, m) => [`${a}-${d}`, o[m]]);
    }
    case "padding-inline":
    case "margin-inline": {
      const o = i(), d = a.split("-")[0];
      return [[`${d}-left`, o[0]], [`${d}-right`, o[1] ?? o[0]]];
    }
    case "padding-block":
    case "margin-block": {
      const o = i(), d = a.split("-")[0];
      return [[`${d}-top`, o[0]], [`${d}-bottom`, o[1] ?? o[0]]];
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
      const o = Cr(i());
      return xl.map((d, m) => [d, o[m]]);
    }
    case "inset-inline": {
      const o = i();
      return [["left", o[0]], ["right", o[1] ?? o[0]]];
    }
    case "inset-block": {
      const o = i();
      return [["top", o[0]], ["bottom", o[1] ?? o[0]]];
    }
    case "inset-inline-start":
      return [["left", s]];
    case "inset-inline-end":
      return [["right", s]];
    case "border-width":
    case "border-style":
    case "border-color": {
      const o = a.split("-")[1], d = Cr(i());
      return xl.map((m, f) => [`border-${m}-${o}`, d[f]]);
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
      const o = a === "border" ? xl : a === "border-inline" ? ["left", "right"] : a === "border-block" ? ["top", "bottom"] : a === "border-inline-start" ? ["left"] : a === "border-inline-end" ? ["right"] : [a.slice(7)];
      let d = "medium", m = "none", f = "currentcolor";
      if (s !== "none" && s !== "0")
        for (const h of i())
          Bd.has(h) ? m = h : /^(thin|medium|thick|-?[\d.]|calc\()/.test(h) ? d = h : f = h;
      else s === "0" && (d = "0");
      return o.flatMap((h) => [[`border-${h}-width`, d], [`border-${h}-style`, m], [`border-${h}-color`, f]]);
    }
    case "border-inline-width": {
      const o = i();
      return [["border-left-width", o[0]], ["border-right-width", o[1] ?? o[0]]];
    }
    case "border-block-width": {
      const o = i();
      return [["border-top-width", o[0]], ["border-bottom-width", o[1] ?? o[0]]];
    }
    case "border-inline-style": {
      const o = i();
      return [["border-left-style", o[0]], ["border-right-style", o[1] ?? o[0]]];
    }
    case "border-inline-color": {
      const o = i();
      return [["border-left-color", o[0]], ["border-right-color", o[1] ?? o[0]]];
    }
    case "border-radius": {
      const o = Cr(le(s.split("/")[0]));
      return z0.map((d, m) => [`border-${d}-radius`, o[m]]);
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
      return s === "none" ? [["background-color", "transparent"], ["background-image", "none"]] : Ur(s, () => "#000000") ? [["background-color", s], ["background-image", "none"]] : [["background-color", "transparent"], ["background-image", s]];
    // ponytail: only the CSS-wide keywords (`[font:inherit]` on a button); a full `font` value is kept unexpanded.
    case "font":
      return /^(inherit|initial|unset|revert|revert-layer)$/.test(s) ? ["font-family", "font-size", "font-weight", "font-style", "line-height"].map((o) => [o, s]) : [[a, s]];
    case "overflow": {
      const o = i();
      return [["overflow-x", o[0]], ["overflow-y", o[1] ?? o[0]]];
    }
    case "gap": {
      const o = i();
      return [["row-gap", o[0]], ["column-gap", o[1] ?? o[0]]];
    }
    case "grid-gap":
      return ts("gap", s);
    case "place-items": {
      const o = i();
      return [["align-items", o[0]], ["justify-items", o[1] ?? o[0]]];
    }
    case "place-self": {
      const o = i();
      return [["align-self", o[0]], ["justify-self", o[1] ?? o[0]]];
    }
    case "place-content": {
      const o = i();
      return [["align-content", o[0]], ["justify-content", o[1] ?? o[0]]];
    }
    case "flex": {
      if (s === "none") return [["flex-grow", "0"], ["flex-shrink", "0"], ["flex-basis", "auto"]];
      if (s === "auto") return [["flex-grow", "1"], ["flex-shrink", "1"], ["flex-basis", "auto"]];
      if (s === "initial") return [["flex-grow", "0"], ["flex-shrink", "1"], ["flex-basis", "auto"]];
      const o = i(), d = o.filter((f) => /^[\d.]+$/.test(f)), m = o.find((f) => !/^[\d.]+$/.test(f));
      return [["flex-grow", d[0] ?? "1"], ["flex-shrink", d[1] ?? "1"], ["flex-basis", m ?? (d.length ? "0%" : "auto")]];
    }
    case "flex-flow": {
      const o = [];
      for (const d of i()) o.push(/wrap/.test(d) ? ["flex-wrap", d] : ["flex-direction", d]);
      return o;
    }
    case "outline": {
      if (s === "none" || s === "0") return [["outline-style", "none"], ["outline-width", "medium"], ["outline-color", "currentcolor"]];
      let o = "medium", d = "none", m = "currentcolor";
      for (const f of i())
        Bd.has(f) || f === "auto" ? d = f : /^(thin|medium|thick|-?[\d.]|calc\()/.test(f) ? o = f : m = f;
      return [["outline-width", o], ["outline-style", d], ["outline-color", m]];
    }
    case "transition": {
      if (s === "none") return [["transition-property", "none"], ["transition-duration", "0s"]];
      const o = le(s, ","), d = o.map((f) => le(f).find((h) => !/^[\d.]+m?s$/.test(h) && !/^(ease|linear|step|cubic)/.test(h)) ?? "all"), m = o.map((f) => le(f).find((h) => /^[\d.]+m?s$/.test(h)) ?? "0s");
      return [["transition-property", d.join(", ")], ["transition-duration", m.join(", ")]];
    }
    case "text-decoration":
      return [["text-decoration-line", i()[0] ?? "none"]];
    case "-webkit-user-select":
      return [["user-select", s]];
    case "word-wrap":
      return [["overflow-wrap", s]];
    default:
      return [[a, s]];
  }
}
function N0(a, l) {
  return a ? le(a, ",").some((s) => {
    let i = s.trim().toLowerCase(), o = !1;
    i.startsWith("not ") && (o = !0, i = i.slice(4)), i.startsWith("only ") && (i = i.slice(5));
    const d = i.split(/\s+and\s+/).every((m) => {
      if (m = m.trim(), m === "all" || m === "screen") return !0;
      if (m === "print") return !1;
      const f = /^\((.+)\)$/.exec(m);
      if (!f) return !1;
      const h = f[1].trim(), x = /^([a-z-]+)\s*:\s*(.+)$/.exec(h);
      if (x) {
        const [, k, y] = x, w = (N) => {
          const _ = $o(N, { viewport: l });
          return typeof _ == "object" && "px" in _ ? _.px : NaN;
        };
        switch (k) {
          case "min-width":
            return l.width >= w(y);
          case "max-width":
            return l.width <= w(y);
          case "min-height":
            return l.height >= w(y);
          case "max-height":
            return l.height <= w(y);
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
      const S = /^(width|height)\s*(>=|<=|>|<|=)\s*(.+)$/.exec(h);
      if (S) {
        const k = S[1] === "width" ? l.width : l.height, y = $o(S[3], { viewport: l }), w = typeof y == "object" && "px" in y ? y.px : NaN;
        switch (S[2]) {
          case ">=":
            return k >= w;
          case "<=":
            return k <= w;
          case ">":
            return k > w;
          case "<":
            return k < w;
          default:
            return k === w;
        }
      }
      return !1;
    });
    return o ? !d : d;
  }) : !0;
}
function T0(a, l) {
  const s = l[l.length - 1].compound;
  return gs(s)[0] ?? a;
}
function C0(a) {
  const l = /* @__PURE__ */ new Set(), s = /* @__PURE__ */ new Set(), i = (o, d) => {
    o.forEach(({ compound: m }, f) => {
      const h = d && f === o.length - 1;
      for (const x of m.pseudos)
        if (Sf.has(x.name) && (h ? l : s).add(x.name), x.list && x.name !== "not") for (const S of x.list) i(S, h);
    });
  };
  return i(a, !0), { subject: l, ancestor: s };
}
function gs(a) {
  const l = [...a.classes];
  for (const s of a.pseudos)
    if (!(s.name !== "is" && s.name !== "where"))
      for (const i of s.list) i.length === 1 && l.push(...gs(i[0].compound));
  return l;
}
function M0(a, l) {
  const s = (i, o) => {
    i.forEach(({ compound: d }, m) => {
      const f = o && m === i.length - 1, h = d.pseudos.filter((x) => Sf.has(x.name)).map((x) => x.name);
      if (!f) for (const x of h) for (const S of gs(d)) l.add(`${x}:${S}`);
      for (const x of d.pseudos) if (x.list && x.name !== "not") for (const S of x.list) s(S, f);
    });
  };
  s(a, !0);
}
class A0 {
  constructor(l) {
    this.properties = l.properties ?? {}, this.rules = [], this.skipped = 0, this.index = /* @__PURE__ */ new Map(), this.trackedStates = /* @__PURE__ */ new Set();
    const s = (d, m) => {
      const f = m[m.length - 1].compound, h = f.classes.length ? `.${f.classes[0]}` : f.tag && f.tag !== "*" ? f.tag : "*";
      this.index.has(h) || this.index.set(h, []), this.index.get(h).push(d);
    };
    let i = 0;
    const o = (d, m) => {
      for (const [f, h, x, S] of d)
        for (const k of fs(f)) {
          let y;
          try {
            y = ms(k);
          } catch (E) {
            if (E instanceof ae) {
              this.skipped++;
              continue;
            }
            throw E;
          }
          const w = C0(y);
          M0(y, this.trackedStates);
          const N = y[y.length - 1].compound.pseudoElement, _ = { steps: y, media: h, layer: x, origin: m, order: i++, specificity: df(y), decls: S, states: w, pseudo: N, source: m === 0 ? `ua:${y[y.length - 1].compound.tag ?? "*"}` : T0(k, y) };
          this.rules.push(_), s(_, y);
        }
    };
    o(x0.map(([d, m]) => [d, null, 0, Object.entries(m)]), 0), o(l.rules, 1);
  }
  /** Rules that may match `element` (by its classes, its tag, and the universal ones), or its `pseudo` box
   * (`before`, `after`). */
  candidates(l, s = null) {
    const i = [], o = /* @__PURE__ */ new Set(), d = (m) => {
      if (m) for (const f of m) !o.has(f) && f.pseudo === s && (o.add(f), i.push(f));
    };
    for (const m of l.classList) d(this.index.get(`.${m}`));
    return d(this.index.get(l.tagName)), d(this.index.get("*")), i;
  }
  /** Whether `element` carries a class whose interaction state some rule reads on an ancestor. */
  tracks(l, s) {
    for (const i of l.classList) if (this.trackedStates.has(`${s}:${i}`)) return !0;
    return !1;
  }
}
const j0 = /* @__PURE__ */ new Set(["opacity", "z-index", "flex-grow", "flex-shrink", "font-weight", "line-height", "flex", "order", "-webkit-line-clamp", "zoom"]);
function O0(a) {
  if (!a || typeof a != "object") return [];
  const l = [];
  for (const [s, i] of Object.entries(a)) {
    if (i == null || i === "" || typeof i == "boolean") continue;
    const o = s.startsWith("--") ? s : s.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`).replace(/^(webkit|moz|ms)-/, "-$1-"), d = typeof i == "number" && i !== 0 && !j0.has(o) && !o.startsWith("--") ? `${i}px` : String(i);
    l.push([o, d]);
  }
  return l;
}
function R0(a) {
  if (a.tagName !== "svg") return [];
  const l = [];
  for (const s of ["width", "height"]) {
    const i = a.getAttribute(s);
    i !== null && l.push([s, /^[\d.]+$/.test(i) ? `${i}px` : i]);
  }
  return l;
}
const D0 = (a, l) => a.important - l.important || a.origin - l.origin || a.layer - l.layer || a.specificity[0] - l.specificity[0] || a.specificity[1] - l.specificity[1] || a.specificity[2] - l.specificity[2] || a.order - l.order;
class B0 {
  constructor(l, { theme: s, viewport: i }) {
    this.sheet = l, this.theme = s, this.viewport = i, this.parsed = /* @__PURE__ */ new Map();
  }
  themeHex(l) {
    return this.theme?.[l] ?? null;
  }
  /** Rules matching `element`; `assume` is the set of interaction states assumed on the element itself
   * (`"*"`: any, for finding variant rules). Ancestors use their real state. */
  matching(l, s, i = null) {
    const o = (d, m, f) => {
      if (m === "disabled") return !!d.props?.disabled && ["button", "input", "select", "textarea", "fieldset"].includes(d.tagName);
      if (m === "enabled") return !d.props?.disabled && ["button", "input", "select", "textarea"].includes(d.tagName);
      if (m === "checked") return !!d.props?.checked;
      if (s === "*") return !0;
      if (m === "focus-within") {
        const h = d.ownerDocument?.activeElement;
        return !!h && h !== d.ownerDocument.body && typeof d.contains == "function" && d.contains(h);
      }
      return f ? s.has(m) : m === "focus-visible" ? !!d.state?.focus && !d.state?.pointerFocus : !!d.state?.[m];
    };
    return this.sheet.candidates(l, i).filter((d) => (!d.media || d.media.every((m) => N0(m, this.viewport))) && pf(l, d.steps, { state: o, pseudo: i }));
  }
  /** `element`'s computed style, or with `pseudo` (`before`, `after`) that of its pseudo-element's box, whose parent
   * is the element (pass the element's own computed style as `parent`). */
  compute(l, s, i = /* @__PURE__ */ new Set(), o = null) {
    const d = this.matching(l, i, o), m = [];
    for (const p of d)
      for (const [v, z, M] of p.decls) m.push({ prop: v, value: z, important: M ? 1 : 0, origin: p.origin === 0 ? 0 : 2, layer: p.layer, specificity: p.specificity, order: p.order, source: p.source });
    if (!o) for (const [p, v] of R0(l)) m.push({ prop: p, value: v, important: 0, origin: 1, layer: 0, specificity: [0, 0, 0], order: 0, source: `attr:${p}` });
    if (!o) for (const [p, v] of O0(l.inlineStyle ?? l.props?.style)) m.push({ prop: p, value: v, important: 0, origin: 3, layer: 0, specificity: [1, 0, 0], order: 0, source: "style" });
    m.sort(D0);
    const f = this.sheet.properties, h = Object.create(s?.customs ?? null), x = /* @__PURE__ */ new Map(), S = /* @__PURE__ */ new Map();
    for (const p of m) p.prop.startsWith("--") && S.set(p.prop, p.value);
    if (!s && this.theme) for (const p of _f) this.theme[p] && S.set(`--${p}`, `perchtoken(${p})`);
    const k = (p) => {
      if (x.has(p)) return x.get(p);
      const v = f[p];
      return v && !v.inherits ? v.initial ?? null : p in h ? h[p] : v?.initial ?? null;
    }, y = /* @__PURE__ */ new Set(), w = (p) => {
      if (!S.has(p)) return k(p);
      if (y.has(p)) return null;
      y.add(p);
      const v = Po(S.get(p), w);
      return y.delete(p), S.delete(p), x.set(p, v), (!f[p] || f[p].inherits) && (h[p] = v), v;
    };
    for (const p of [...S.keys()]) w(p);
    const N = /* @__PURE__ */ new Map();
    for (const p of m) {
      if (p.prop.startsWith("--")) continue;
      const v = Po(p.value, k);
      if (v === null) {
        for (const [z] of ts(p.prop, "unset")) N.set(z, { value: "unset", source: p.source, origin: p.origin });
        continue;
      }
      for (const [z, M] of ts(p.prop, v)) N.set(z, { value: M, source: p.source, origin: p.origin });
    }
    const _ = {}, E = {}, O = /* @__PURE__ */ new Set(), R = /* @__PURE__ */ new Set(), A = s?.values, L = { fontSize: A?.["font-size"] ?? Fo, viewport: this.viewport }, q = (p, v) => {
      if (/currentcolor/i.test(v)) return this.parseValue(p, v, L, _, A);
      const z = `${p}\0${v}\0${L.fontSize}`;
      let M = this.parsed.get(z);
      return M === void 0 && this.parsed.set(z, M = this.parseValue(p, v, L, _, A)), M;
    }, D = N.size ? [...Io, ...[...N.keys()].filter((p) => !_0.has(p))] : Io;
    for (const p of D) {
      const v = N.get(p);
      let z = v?.value;
      const M = w0.has(p);
      if ((z === void 0 || z === "unset" || z === "revert" || z === "revert-layer") && (z = M ? "inherit" : "initial"), v && (E[p] = v.source, v.origin !== 0 && O.add(p)), z === "inherit" && A && p in A) {
        _[p] = A[p], R.add(p);
        continue;
      }
      (z === "inherit" || z === "initial") && (z = M ? Ef[p] : kf[p]), _[p] = q(p, z), p === "font-size" && (L.fontSize = _["font-size"]);
    }
    for (const p of xl) {
      const v = _[`border-${p}-style`];
      (v === "none" || v === "hidden") && (_[`border-${p}-width`] = { px: 0 });
    }
    _["outline-style"] === "none" && (_["outline-width"] = { px: 0 });
    const g = A?.display;
    return (g === "flex" || g === "inline-flex" || g === "grid" || g === "inline-grid") && _.position !== "absolute" && _.position !== "fixed" && (_.display = Hd(_.display)), (_.position === "absolute" || _.position === "fixed") && (_.display = Hd(_.display)), { values: _, sources: E, own: O, inherited: R, customs: h, rules: d, element: l };
  }
  parseValue(l, s, i, o, d) {
    const m = String(s).trim();
    switch (l) {
      case "font-size": {
        const f = m.toLowerCase(), h = { "xx-small": 9, "x-small": 10, small: 13, medium: 16, large: 18, "x-large": 24, "xx-large": 32 };
        if (h[f]) return h[f];
        if (f === "smaller") return i.fontSize / 1.2;
        if (f === "larger") return i.fontSize * 1.2;
        const x = Yn(f, { fontSize: i.fontSize, viewport: i.viewport });
        return !x || x.num ? i.fontSize : x.px + x.pct / 100 * i.fontSize;
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
        const h = Yn(f, { fontSize: i.fontSize, viewport: i.viewport });
        return h ? h.unitless ? { factor: h.num } : { px: h.px + h.pct / 100 * i.fontSize } : { normal: !0 };
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
        const f = Ur(m, (h) => this.themeHex(h));
        return f === "currentcolor" || !f ? d?.color ?? { rgba: [0, 0, 0, 1], token: null } : f;
      }
      case "background-color":
      case "border-top-color":
      case "border-right-color":
      case "border-bottom-color":
      case "border-left-color":
      case "outline-color": {
        const f = Ur(m, (h) => this.themeHex(h));
        return f === "currentcolor" ? o.color : f ?? { rgba: [0, 0, 0, 0], token: null, unreadable: m };
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
        return $o(m, i);
      default:
        return m.toLowerCase().startsWith("var(") ? m : /^[a-z-]+$/i.test(m) ? m.toLowerCase() : m;
    }
  }
}
function Hd(a) {
  return a === "inline" || a === "inline-block" || a === "contents" ? "block" : a === "inline-flex" ? "flex" : a === "inline-grid" ? "grid" : a;
}
const qr = (a) => a && a.rgba ? { value: E0(a.rgba), token: a.token ?? null } : null, H0 = { 9.28: 11, 9.92: 12, 10.4: 12, 10.88: 13, 11: 13, 11.2: 13, 11.52: 13, 12: 15, 12.5: 15, 13: 16, 14: 17, 16: 19 };
function U0(a, l) {
  const s = l?.(a);
  if (Number.isFinite(s)) return s;
  const i = Math.round(a * 100) / 100;
  return H0[i] ?? Math.round(a * 1.2);
}
function _l(a, l) {
  const s = a["line-height"], i = a["font-size"];
  return s.normal ? U0(i, l) : s.factor !== void 0 ? s.factor * i : s.px;
}
const q0 = (a) => le(a, ",").map((l) => l.trim().replace(/^["']|["']$/g, "")).join(", ");
//! The description: the host tree after a commit, as the engine draws it. Each element's computed style
//! (`css.mjs`) becomes engine styles in the vocabulary of the GPUI kit (`div()` with `.flex()`, `.px(8)`,
//! `.text_color(...)`, `.hover(|s| ...)`), keyed so the engine maps each key to one builder call; a key's value says
//! which (`display: "flex"` is `.flex()`, `pt: 4` is `.pt(px(4))`, `w: "100%"`, `line_height: 1.3` a multiplier,
//! `line_height: "15px"` absolute). Everything CSS says that the engine cannot draw is listed in `unsupported`, with
//! the class that asked for it and the element; nothing is dropped silently.
//!
//! Node shapes (`id` is the host element's, the one `dispatch`/`hover`/`perch.bounds` take):
//! - `{ kind: "div", id, style, hover?, focus?, active?, tokens, events, track_hover?, meta, children }`
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
const Y0 = "perch-native-description/1", Hn = Symbol("display"), Yr = {
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
}, G0 = ["w", "h", "min_w", "min_h", "max_w", "max_h", "top", "right", "bottom", "left", "pt", "pr", "pb", "pl", "mt", "mr", "mb", "ml", "gap_x", "gap_y", "border_t", "border_r", "border_b", "border_l", "rounded_tl", "rounded_tr", "rounded_br", "rounded_bl"];
for (const a of G0) Yr[a] = /^(w|h|min_|max_|top|right|bottom|left)/.test(a) ? "auto" : 0;
Yr.rounded = 0;
const K0 = /* @__PURE__ */ new Set([
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
]), Q0 = /(-apple-system|blinkmacsystemfont|system-ui|segoe ui|sans-serif|times)/i, V0 = /(ui-monospace|sfmono|sf mono|menlo|monospace)/i, X0 = (a) => V0.test(a) ? "Menlo" : /^\s*system-ui\s*$/i.test(a ?? "") ? ".AppleSystemUIFont" : Q0.test(a) ? ".SystemUIFont" : q0(a).split(",")[0].trim(), L0 = {
  click: ["onClick", "onClickCapture"],
  double_click: ["onDoubleClick"],
  context_menu: ["onContextMenu"],
  mouse_down: ["onPointerDown", "onMouseDown", "onPointerDownCapture", "onMouseDownCapture"],
  mouse_up: ["onPointerUp", "onMouseUp", "onPointerCancel"],
  mouse_move: ["onPointerMove", "onMouseMove"],
  key_down: ["onKeyDown", "onKeyUp"],
  focus: ["onFocus", "onBlur"],
  input: ["onChange", "onInput"]
}, Ud = { pointerdown: "mouse_down", mousedown: "mouse_down", click: "click", keydown: "key_down", pointerup: "mouse_up", mouseup: "mouse_up" }, bs = (a) => {
  const l = a.props["data-testid"];
  if (l) return `${a.tagName}[data-testid="${l}"]`;
  if (a.props.id) return `${a.tagName}#${a.props.id}`;
  const s = a.classList.find((o) => !o.includes(":") && !o.includes("[")) ?? a.classList[0];
  if (s) return `${a.tagName}.${s}`;
  const i = a.parentElement;
  return i && i.tagName !== "body" ? `${bs(i)} > ${a.tagName}` : a.tagName;
};
class Z0 {
  constructor() {
    this.map = /* @__PURE__ */ new Map();
  }
  add(l, s, i, o, d, m = "") {
    const f = `${l}|${s}|${i}|${o}`, h = this.map.get(f);
    if (h) {
      !h.elements.includes(d) && h.elements.length < 4 && h.elements.push(d), h.count++;
      return;
    }
    this.map.set(f, { kind: l, property: s, value: String(i), class: o ?? null, elements: [d], count: 1, ...m ? { note: m } : {} });
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
}, J0 = /^(text|search|url|email|tel|password|number)$/, W0 = 162.13 / 12.8;
function F0(a, l) {
  const s = typeof a == "object" && /^min\((.*)\)$/.exec(String(a?.expr ?? "").trim());
  if (!s) return;
  const i = le(s[1], ",").map((o) => Yn(o.trim(), { fontSize: l })).filter((o) => o && !o.pct && !o.num).map((o) => o.px);
  return i.length ? Math.min(...i) : void 0;
}
function I0(a, l) {
  if (typeof a != "object" || !a?.expr) return !1;
  const s = Yn(a.expr, { fontSize: l["font-size"] }), i = (l["margin-left"]?.px ?? NaN) + (l["margin-right"]?.px ?? NaN);
  return !!s && !s.num && s.pct === 100 && Math.abs(s.px + i) < 0.01;
}
function zf(a) {
  const l = a.transform;
  if (l && l !== "none") {
    const i = /^\s*translate(X|Y)?\(([^]*)\)\s*$/.exec(l), o = i && le(i[2], ",").map((d) => d.trim());
    return !o || o.length > (i[1] ? 1 : 2) ? null : i[1] === "X" ? [o[0], "0"] : i[1] === "Y" ? ["0", o[0]] : [o[0], o[1] ?? "0"];
  }
  const s = a.translate;
  if (s && s !== "none") {
    const i = le(String(s).trim(), " ").filter(Boolean);
    return i.length > 3 || i[2] !== void 0 && Yn(i[2], {})?.px ? null : [i[0], i[1] ?? "0"];
  }
  return [];
}
function qd(a, l, s, i = !1) {
  const o = a.values, d = zf(o);
  if (d?.length === 0) return;
  const m = o.transform && o.transform !== "none" ? "transform" : "translate", f = { fontSize: o["font-size"] }, h = (k, y) => {
    const w = Yn(k, f);
    if (!(!w || w.unitless && w.num))
      return w.pct ? typeof y == "number" ? w.px + w.pct / 100 * y : void 0 : w.px;
  }, x = d ? h(d[0], l.w) : void 0, S = d ? h(d[1], l.h) : void 0;
  if (x === void 0 || S === void 0) {
    const k = !i && d ? d.map((y) => Yn(y, f)) : null;
    if (k?.every((y) => y && !(y.unitless && y.num))) {
      l[Nf] = k.map((y) => [y.px, y.pct ?? 0]);
      return;
    }
    s("unsupported", m, o[m], a.sources[m]);
    return;
  }
  if (i) {
    x && (l.left = x), S && (l.top = S);
    return;
  }
  x && (l.ml = (l.ml ?? 0) + x), S && (l.mt = (l.mt ?? 0) + S);
}
const Nf = Symbol("perch.shift");
function P0(a, l, s) {
  const i = a.ownerDocument, o = i?.measure?.(a) ?? null;
  if (o) {
    const [[m, f], [h, x]] = s, S = m + f / 100 * o.width, k = h + x / 100 * o.height;
    S && (l.ml = (typeof l.ml == "number" ? l.ml : 0) + S), k && (l.mt = (typeof l.mt == "number" ? l.mt : 0) + k);
  }
  const d = o ? `${o.width}x${o.height}` : "";
  d === a.shiftSeen ? a.shiftTries = 0 : (a.shiftTries ?? 0) < bf && i?.retries && (a.shiftSeen = d, a.shiftTries = (a.shiftTries ?? 0) + 1, i.retries.push(() => i.afterCommit?.()));
}
function es(a, l, s = null) {
  const i = a.values, o = {}, d = (A) => a.sources[A], m = (A) => a.sources[A] !== void 0, f = i.display;
  f === "none" ? o.display = "hidden" : f === "flex" || f === "inline-flex" ? o.display = "flex" : (f === "grid" || f === "inline-grid") && (o.display = "flex", o.flex_direction = "col", l("approximated", "display", f, d("display"), "one-column flex column"), i["grid-template-columns"] && i["grid-template-columns"] !== "none" && l("unsupported", "grid-template-columns", i["grid-template-columns"], d("grid-template-columns"))), a.element.hidden && (o.display = "hidden");
  const h = o.display === "flex";
  if (h && o.flex_direction !== "col") {
    const A = { row: "row", column: "col", "row-reverse": "row_reverse", "column-reverse": "col_reverse" }[i["flex-direction"]] ?? "row";
    o.flex_direction = A;
  }
  if (h) {
    (i["flex-wrap"] === "wrap" || i["flex-wrap"] === "wrap-reverse") && (o.flex_wrap = "wrap");
    const A = f === "grid" || f === "inline-grid", L = { "flex-start": "start", start: "start", "self-start": "start", "flex-end": "end", end: "end", "self-end": "end", center: "center", baseline: "baseline", "first baseline": "baseline" }[i["align-items"]];
    L && (o.items = L);
    let q = { "flex-start": "start", start: "start", "flex-end": "end", end: "end", center: "center", "space-between": "between", "space-around": "around", "space-evenly": "evenly" }[i["justify-content"]];
    if (A) {
      const p = { center: "center", end: "end", "flex-end": "end", start: "start", "flex-start": "start" }[i["justify-items"]];
      p && (o.items = p), i["align-items"] === "center" && (q = "center");
    }
    q && (o.justify = q);
    const D = mn(i["row-gap"]), g = mn(i["column-gap"]);
    typeof D == "number" && D && (o.gap_y = D), typeof g == "number" && g && !A && (o.gap_x = g);
  }
  i["flex-grow"] && (o.flex_grow = i["flex-grow"]), i["flex-shrink"] !== 1 && (o.flex_shrink = i["flex-shrink"]);
  const x = mn(i["flex-basis"]);
  x !== void 0 && x !== "auto" && (o.flex_basis = x);
  const S = { "flex-start": "start", start: "start", "flex-end": "end", end: "end", center: "center", baseline: "baseline", stretch: "stretch" }[i["align-self"]];
  S && (o.self = S);
  for (const [A, L] of [["w", "width"], ["h", "height"], ["min_w", "min-width"], ["min_h", "min-height"], ["max_w", "max-width"], ["max_h", "max-height"]]) {
    const q = i[L], D = mn(q);
    if (D === void 0 && L === "width" && I0(q, i)) {
      o.self = "stretch", l("approximated", L, q.expr, d(L), "stretched across its parent, inside its margins");
      continue;
    }
    const g = D === void 0 && /^max-/.test(L) ? F0(q, i["font-size"]) : void 0;
    if (g !== void 0) {
      o[A] = g, l("approximated", L, q.expr, d(L), "the fixed bound of min()");
      continue;
    }
    if (D === void 0) {
      typeof q == "object" && q.expr ? l("unsupported", L, q.expr, d(L), "no calc() in the engine") : typeof q == "string" && !["auto", "none"].includes(q) && l("unsupported", L, q, d(L));
      continue;
    }
    D !== "auto" && (o[A] = D);
  }
  const k = ["top", "right", "bottom", "left"];
  for (const A of k) {
    const L = A[0];
    for (const [q, D] of [["p", "padding"], ["m", "margin"]]) {
      const g = i[`${D}-${A}`], p = mn(g);
      if (p === void 0) {
        g?.expr && l("unsupported", `${D}-${A}`, g.expr, d(`${D}-${A}`), "no calc() in the engine");
        continue;
      }
      p !== 0 && (o[`${q}${L}`] = p);
    }
  }
  const y = i.position;
  if (y === "absolute" || y === "fixed") {
    o.position = "absolute", y === "fixed" && l("approximated", "position", "fixed", d("position"), "absolute in the overlay layer");
    for (const A of k) {
      const L = mn(i[A]);
      L !== void 0 && L !== "auto" && (o[A] = L);
    }
    if (y === "fixed" && s && o.w === void 0 && o.right === void 0 && typeof o.left == "number") {
      const A = s.width - o.left - (typeof o.ml == "number" ? o.ml : 0) - (typeof o.mr == "number" ? o.mr : 0);
      o.max_w = typeof o.max_w == "number" ? Math.min(o.max_w, A) : A;
    }
    qd(a, o, l);
  } else y === "sticky" ? l("unsupported", "position", "sticky", d("position")) : zf(i)?.length !== 0 && (o.position = "relative", qd(a, o, l, !0));
  i["z-index"] !== "auto" && m("z-index") && l("unsupported", "z-index", i["z-index"], d("z-index"), "paint order is tree order");
  for (const [A, L] of [["overflow_x", "overflow-x"], ["overflow_y", "overflow-y"]]) {
    const q = i[L];
    q === "hidden" || q === "clip" ? o[A] = "hidden" : (q === "auto" || q === "scroll") && (o[A] = "scroll");
  }
  (i.visibility === "hidden" || i.visibility === "collapse") && (o.visibility = "invisible");
  const w = i["background-color"];
  w?.unreadable ? l("unsupported", "background-color", w.unreadable, d("background-color")) : w?.rgba && w.rgba[3] > 0 && (o.bg = qr(w)), i["background-image"] && i["background-image"] !== "none" && l("unsupported", "background-image", i["background-image"], d("background-image"));
  const N = k.map((A) => mn(i[`border-${A}-width`]) || 0), _ = [];
  k.forEach((A, L) => {
    if (!N[L]) return;
    o[`border_${A[0]}`] = N[L];
    const q = i[`border-${A}-style`];
    q !== "solid" && l("approximated", `border-${A}-style`, q, d(`border-${A}-style`), "drawn solid");
    const D = qr(i[`border-${A}-color`]);
    D && _.push(D);
  }), _.length && (o.border_color = _[0], _.some((A) => A.value !== _[0].value) && l("approximated", "border-color", _.map((A) => A.value).join(" "), d("border-top-color"), "one border colour"));
  const E = (A) => {
    const L = mn(i[`border-${A}-radius`]) || 0;
    if (typeof L != "string") return L;
    const q = parseFloat(L) / 100, D = [o.w, o.h].filter((g) => typeof g == "number");
    return L === "auto" || !(q > 0) ? 0 : D.length ? Math.round(Math.min(q, 0.5) * Math.min(...D) * 100) / 100 : 9999;
  }, O = ["top-left", "top-right", "bottom-right", "bottom-left"].map(E);
  O.every((A) => A === O[0]) ? O[0] && (o.rounded = O[0]) : ["tl", "tr", "br", "bl"].forEach((A, L) => {
    O[L] && (o[`rounded_${A}`] = O[L]);
  }), i.opacity !== 1 && (o.opacity = Math.round(i.opacity * 1e3) / 1e3);
  const R = i["box-shadow"];
  if (R && R !== "none" && le(R, ",").some((A) => !/^0(px)?\s+0(px)?\s+(0(px)?\s+)?(0(px)?\s+)?(#0000|transparent|rgba?\(0,\s*0,\s*0,\s*0\))/.test(A.trim())) && (o.shadow = "lg", l("approximated", "box-shadow", R, d("box-shadow"), "the engine's large shadow preset")), i.cursor && i.cursor !== "auto" && !a.inherited.has("cursor")) {
    const A = { pointer: "pointer", default: "default", text: "text", move: "move", "not-allowed": "not_allowed", grab: "move", grabbing: "move" }[i.cursor];
    A ? o.cursor = A : l("unsupported", "cursor", i.cursor, d("cursor"));
  }
  return i["text-overflow"] === "ellipsis" && (o.text_ellipsis = !0), i["text-decoration-line"] === "underline" ? o.underline = !0 : i["text-decoration-line"] && i["text-decoration-line"] !== "none" && l("unsupported", "text-decoration-line", i["text-decoration-line"], d("text-decoration-line")), o;
}
const $0 = { "tabular-nums": "tnum", "proportional-nums": "pnum", "lining-nums": "lnum", "oldstyle-nums": "onum", "slashed-zero": "zero", "diagonal-fractions": "frac", "stacked-fractions": "afrc", ordinal: "ordn" };
function Tf(a) {
  if (!a || a === "normal") return "";
  const l = String(a).trim().split(/\s+/).map((s) => $0[s]);
  return l.every(Boolean) ? l.join(",") : null;
}
function ns(a, l) {
  const s = a.values, i = s["line-height"];
  return {
    text_color: qr(s.color),
    text_size: Math.round(s["font-size"] * 1e3) / 1e3,
    font_features: Tf(s["font-variant-numeric"]) ?? "",
    font_weight: s["font-weight"],
    line_height: i.factor !== void 0 ? { factor: i.factor } : { px: Math.round(_l(s, l) * 1e3) / 1e3 },
    font_family: X0(s["font-family"]),
    italic: s["font-style"] === "italic" || s["font-style"] === "oblique",
    whitespace: s["white-space"] === "nowrap" || s["white-space"] === "pre" ? "nowrap" : "normal",
    text_align: { center: "center", right: "right", end: "right" }[s["text-align"]] ?? "left"
  };
}
const Yd = (a, l) => a.factor !== void 0 ? a.factor * l : a.px, Cf = (a, l) => JSON.stringify(a) === JSON.stringify(l);
function as(a, l, s) {
  const i = {}, o = (f, h) => h.some((x) => !a.inherited.has(x));
  for (const [f, h] of [["text_color", ["color"]], ["text_size", ["font-size"]], ["font_weight", ["font-weight"]], ["font_family", ["font-family"]], ["italic", ["font-style"]], ["whitespace", ["white-space"]], ["text_align", ["text-align"]], ["font_features", ["font-variant-numeric"]]])
    (o(f, h) || !Cf(l[f], s[f])) && (i[f] = l[f]);
  const d = Yd(l.line_height, l.text_size), m = s.line_height ? Yd(s.line_height, l.text_size) : NaN;
  return (o("line_height", ["line-height"]) || !(Math.abs(d - m) <= 1e-3)) && (i.line_height = l.line_height), i;
}
const tg = (a, l) => ({ ...a, ...l });
function ls(a, l) {
  const s = {};
  for (const [i, o] of Object.entries(a))
    o && typeof o == "object" && "value" in o ? (s[i] = o.value, o.token && (l[i] = o.token)) : i === "line_height" ? s[i] = o.factor !== void 0 ? Math.round(o.factor * 1e3) / 1e3 : `${o.px}px` : i === "italic" ? o && (s.italic = !0) : s[i] = o;
  return s.italic === !1 && delete s.italic, s;
}
function eg(a, l) {
  const s = {};
  for (const i of /* @__PURE__ */ new Set([...Object.keys(a), ...Object.keys(l)])) {
    const o = a[i], d = l[i];
    Cf(o, d) || (s[i] = d === void 0 ? i in Yr ? Yr[i] : null : d);
  }
  return s;
}
function Gd(a, l) {
  const s = a.values;
  for (const [i, o] of Object.entries(a.sources)) {
    if (i.startsWith("--") || K0.has(i) || o.startsWith("ua:")) continue;
    const d = s[i];
    switch (i) {
      case "letter-spacing":
        d !== "normal" && d?.px !== 0 && l("approximated", i, d?.px !== void 0 ? `${Math.round(d.px * 1e3) / 1e3}px` : d, o, d?.px < 0 ? "the run's box is as wide as with the spacing (the glyphs reach past it; where the element clips, the run is drawn smaller to fit)" : "the run is as wide as with the spacing (room after it), the letters are not spread");
        break;
      case "font-variant-numeric":
        d !== "normal" && Tf(d) === null && l("unsupported", i, d, o);
        break;
      case "text-transform":
        d !== "none" && l("approximated", i, d, o, "applied to the text in JS");
        break;
      case "transition-property":
      case "transition-duration": {
        const m = s["transition-duration"];
        i === "transition-property" && m && le(m, ",").some((f) => parseFloat(f) > 0) && s["transition-property"] !== "none" && l("unsupported", "transition", `${s["transition-property"]} ${m}`, o, "changes are instant (the engine animates only opacity and size)");
        break;
      }
      case "-webkit-line-clamp":
        d !== "none" && l("unsupported", i, d, o, "no line clamp in the engine");
        break;
      case "-webkit-box-orient":
      case "overflow-wrap":
        i === "overflow-wrap" && d !== "normal" && l("approximated", i, d, o, "lines broken by the translator where the box's width is known (`break_anywhere`)");
        break;
      case "outline-style":
      case "outline-width":
      case "outline-color":
        s["outline-style"] !== "none" && i === "outline-style" && l("unsupported", "outline", `${mn(s["outline-width"])}px ${s["outline-style"]} ${qr(s["outline-color"])?.value ?? ""}`.trim(), o, "no outline in the engine (no focus ring)");
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
        d && d !== "none" && d !== "auto" && d !== "normal" && d !== "initial" && l("unsupported", i, d, o);
        break;
    }
  }
}
function ng(a, l, s, i) {
  const o = bs(a), d = [], m = (O, R, A, L, q) => d.push([O, R, A, L ?? "(user agent)", o, q]), f = i.cascade.compute(a, l), h = {}, x = es(f, m, i.viewport), S = x[Nf];
  Gd(f, m);
  const k = ns(f, i.measure), y = as(f, k, s), w = ls({ ...x, ...y }, h), N = {}, _ = i.cascade.matching(a, "*").filter((O) => O.states.subject.size);
  for (const [O, R] of [["hover", ["hover"]], ["focus", ["focus", "focus-visible"]], ["active", ["active", "hover"]]]) {
    if (!_.some((g) => R.some((p) => g.states.subject.has(p)))) continue;
    const A = i.cascade.compute(a, l, new Set(R)), L = {}, q = ls({ ...es(A, () => {
    }), ...as(A, ns(A, i.measure), s) }, L);
    O === "focus" && Gd(A, m);
    const D = eg(w, q);
    if (Object.keys(D).length) {
      N[O] = D;
      const g = Object.fromEntries(Object.entries(L).filter(([p]) => p in D));
      Object.keys(g).length && (N[`${O}_tokens`] = g);
    }
  }
  if (i.cascade.sheet.tracks(a, "hover") && (N.track_hover = !0), /tabular/.test(String(f.values["font-variant-numeric"] ?? "")) && (N.tabular = !0), /^(anywhere|break-word)$/.test(String(f.values["overflow-wrap"] ?? "")) && (N.break_anywhere = !0), x.overflow_y === "scroll") {
    const O = Number.parseFloat(f.customs?.["--scrollbar-size"] ?? "");
    O > 0 && (N.scrollbar = O);
  }
  f.values["pointer-events"] !== "none" && l?.values["pointer-events"] === "none" && (N.blocks_pointer = !0);
  const E = Object.entries(L0).filter(([, O]) => O.some((R) => typeof a.props[R] == "function")).map(([O]) => O);
  return !E.includes("click") && Jo(a) && E.push("click"), E.length && (N.events = E), { computed: f, style: w, tokens: h, extra: N, meta: og(a), reports: d, childText: tg(s, y), where: o, shift: S };
}
function ag(a, l, s, i) {
  const o = { before: null, after: null };
  for (const d of ["before", "after"]) {
    if (!i.cascade.matching(a, /* @__PURE__ */ new Set(), d).length) continue;
    const m = i.cascade.compute(a, l, /* @__PURE__ */ new Set(), d), f = String(m.values.content ?? "none").trim();
    if (f === "none" || f === "normal") continue;
    const h = /^(["'])(.*)\1$/.exec(f)?.[2] ?? "", x = (N, _, E, O, R) => i.findings.add(N, _, E, O ?? "(user agent)", `${bs(a)}::${d}`, R), S = {}, k = es(m, x, i.viewport), w = { kind: "div", style: ls({ ...k, ...as(m, ns(m, i.measure), s) }, S), tokens: S, children: h ? [{ kind: "text", text: h }] : [] };
    Object.defineProperty(w, Hn, { value: m.values.display }), o[d] = w;
  }
  return o;
}
function Mf(a, l, s, i, o = "") {
  const d = `${o}/${a.id}.${a.version}`;
  let m = i.cache.get(a);
  (!m || m.key !== d) && i.cache.set(a, m = { key: d, part: ng(a, l, s, i) });
  const { computed: f, tokens: h, extra: x, reports: S, childText: k, where: y } = m.part;
  for (const v of S) i.findings.add(...v);
  const w = (v, z, M, H, V) => i.findings.add(v, z, M, H, y, V), N = { ...m.part.style };
  m.part.shift && P0(a, N, m.part.shift);
  const _ = { kind: "div", id: a.id, style: N, tokens: h, meta: m.part.meta, ...x };
  Object.defineProperty(_, Hn, { value: f.values.display }), a.measured && a.ownerDocument?.measureKey && (_.measure = a.ownerDocument.measureKey(a));
  const E = a.tagName;
  if (E === "svg")
    return _.kind = a.props["data-perch-image"] ? "image" : "svg", _.markup = cg(a), _;
  if (E === "input" || E === "textarea" || E === "select") {
    _.kind = "input", _.input_type = E === "input" ? String(a.props.type ?? "text") : E;
    for (const M of ["placeholder", "checked", "disabled"]) a.props[M] !== void 0 && (_[M] = a.props[M]);
    if (/^(checkbox|radio)$/.test(_.input_type) && (_.checked = a.checked), E !== "select" && (_.value = a.value), E === "input" && J0.test(_.input_type) && (_.field_w = W0 * f.values["font-size"]), E === "textarea" && N.h === void 0) {
      const M = f.values, H = (tt) => tt && typeof tt == "object" && "px" in tt ? tt.px : 0, V = (tt) => M[`border-${tt}-style`] === "none" ? 0 : H(M[`border-${tt}-width`]), $ = Number(a.props.rows) > 0 ? Math.floor(Number(a.props.rows)) : 2;
      N.h = $ * _l(M, i.measure) + H(M["padding-top"]) + H(M["padding-bottom"]) + V("top") + V("bottom");
    }
    const { before: v, after: z } = ag(a, f, k, i);
    return (v || z) && (_.children = [v, z].filter(Boolean)), _;
  }
  if (E === "img") {
    _.kind = "image", _.src = a.props.src ?? null;
    for (const [v, z] of [["width", "w"], ["height", "h"]]) {
      const M = Number(a.props[v]);
      N[z] === void 0 && a.props[v] != null && Number.isFinite(M) && (N[z] = M);
    }
    return _;
  }
  const O = f.values["text-transform"], R = [];
  let A = !1, L = !1;
  for (const v of a.childNodes) {
    if (v instanceof Zr) {
      if (v.hidden || v.data === "") continue;
      A = !0;
      const H = R[R.length - 1];
      if (H?.kind === "text")
        H.source = (H.source ?? H.text) + v.data, H.text = Kd(H.source, O), H.text === H.source && delete H.source;
      else {
        const V = Kd(v.data, O);
        R.push(V === v.data ? { kind: "text", text: V } : { kind: "text", text: V, source: v.data });
      }
      continue;
    }
    if (!(v instanceof It)) continue;
    const z = Mf(v, f, k, i, d), M = z[Hn];
    M === "inline" || M === "inline-block" || M === "inline-flex" ? A = !0 : M !== "none" && (L = !0), R.push(z);
  }
  if (/(^|\s)inline-flex(\s|$)/.test(String(a.props?.className ?? "")) && N.w === void 0)
    for (const v of R)
      v.style?.flex_grow && v.style.min_w === 0 && v.style.overflow_x === "hidden" && (delete v.style.min_w, delete v.style.flex_grow, delete v.style.flex_basis, delete v.style.overflow_x, delete v.style.overflow_y);
  if (!N.display && A && R.some((v) => v.kind !== "text") && R.every((v) => v.kind === "text" || v.kind === "div" && v[Hn] === "inline" && !v.events?.length && v.children?.every((z) => z.kind === "text"))) {
    const v = R.map((z) => z.kind === "text" ? z.text : z.children.map((M) => M.text).join("")).join("");
    w("approximated", "display", "inline text elements in a line of text", "(inline formatting)", "their text joined to the line, in its font"), R.splice(0, R.length, { kind: "text", text: v });
  }
  const q = R.some((v) => v.kind !== "text"), D = R.length === 1 && R[0].kind !== "text" && /^inline-(block|flex)$/.test(R[0][Hn]) ? R[0] : null;
  if (!N.display && D) {
    const v = i.cache.get(a.childNodes.find((M) => M.id === D.id))?.part.computed, z = v ? Kr(f.values, i.measure) - ig(v.values, i.measure, D) : 0;
    N.display = "flex", N.flex_direction = "col", N.items = "start", z > 0 && (D.style.mt = Math.round(((D.style.mt ?? 0) + z) * 100) / 100), w("approximated", "display", `${f.values.display} holding one ${D[Hn]} box`, "(inline formatting)", "a column, the box lowered to the line's baseline");
  } else if (!N.display && R.length === 1 && (R[0].kind === "svg" || R[0].kind === "image") && R[0][Hn] === "inline" && typeof R[0].style.h == "number") {
    const v = R[0], z = Kr(f.values, i.measure), M = _l(f.values, i.measure) - z, H = (V) => Math.round(V * 100) / 100;
    N.display = "flex", N.flex_direction = "col", N.items = "start", z > v.style.h && (v.style.mt = H((v.style.mt ?? 0) + z - v.style.h)), M > 0 && (v.style.mb = H((v.style.mb ?? 0) + M)), w("approximated", "display", `${f.values.display} holding one inline image`, "(inline formatting)", "a column, the image on the line's baseline");
  } else if (!N.display && A && q) {
    if (N.display = "flex", N.flex_direction = L ? "col" : "row", !L) N.items = "baseline";
    else for (const v of R) v.kind !== "text" && /^inline-(block|flex)$/.test(v[Hn]) && !v.style.self && (v.style.self = "start");
    w("approximated", "display", `${f.values.display} with inline content`, "(inline formatting)", L ? "a column of its children" : "a row on the text baseline");
  }
  const g = f.values["letter-spacing"]?.px, p = f.values["overflow-x"] !== "visible";
  if (g)
    for (let v = 0; v < R.length; v++) {
      const z = R[v];
      if (z.kind !== "text") continue;
      const M = Math.round(g * [...z.text].length * 1e3) / 1e3;
      if (g > 0 || !p) {
        R[v] = { kind: "div", style: { pr: M }, tokens: {}, children: [z] };
        continue;
      }
      const H = f.values["font-size"], V = Math.max(0.8, 1 + g / (0.55 * H)), $ = Math.round(_l(f.values, i.measure) * 1e3) / 1e3;
      R[v] = { kind: "div", style: { text_size: Math.round(H * V * 1e3) / 1e3, line_height: `${$}px` }, tokens: {}, children: [z] };
    }
  return _.children = R, _;
}
function lg(a, l) {
  if (!l) return null;
  let i = (l.self ? a : l.closest ? hf(a, l.closest) : l.find ? kl(a, l.find)[0] : null)?.getAttribute(l.attr) ?? null;
  return i && l.strip && i.startsWith(l.strip) && (i = i.slice(l.strip.length)), i;
}
function rg(a, l, s) {
  const i = l.map((m) => [m, Lr(m.selector)]), o = /* @__PURE__ */ new Map(), d = (m) => {
    for (const f of m.children) {
      const h = s.get(f.id);
      if (h)
        for (const [x, S] of i) {
          const k = x.textRange ? "range_name" : "name";
          if (x.textRange && h[k] != null || !S.some((_) => pf(f, _))) continue;
          const y = lg(f, x.key), w = y == null ? o.get(x.name) ?? 0 : 0;
          y == null && o.set(x.name, w + 1);
          const N = y != null ? `${x.name}:${y}` : w ? `${x.name}@${w}` : x.name;
          h[k] == null ? h[k] = N : (h.also ??= []).push(N);
        }
      d(f);
    }
  };
  d(a.documentElement);
}
const Gr = 0.9521, Af = 0.2256, Kr = (a, l) => (_l(a, l) - (Gr + Af) * a["font-size"]) / 2 + Gr * a["font-size"];
function ig(a, l, s) {
  const i = (h) => h && typeof h == "object" && "px" in h ? h.px : 0, o = a["border-top-style"] === "none" ? 0 : i(a["border-top-width"]), d = s?.children ?? [], m = d.length === 1 && (d[0].kind === "svg" || d[0].kind === "image") && typeof d[0].style.h == "number" ? d[0] : null, f = m ? Math.max(Kr(a, l), (m.style.mt ?? 0) + m.style.h) : Kr(a, l);
  return i(a["padding-top"]) + o + f;
}
const Kd = (a, l) => l === "uppercase" ? a.toUpperCase() : l === "lowercase" ? a.toLowerCase() : l === "capitalize" ? a.replace(/\b\p{L}/gu, (s) => s.toUpperCase()) : a, jf = /* @__PURE__ */ new Set(["children", "style", "className", "key", "ref", "dangerouslySetInnerHTML"]);
function og(a) {
  const l = {};
  for (const [s, i] of Object.entries(a.props)) {
    if (jf.has(s) || typeof i == "function" || i === void 0 || i === null || typeof i == "object") continue;
    const o = s.startsWith("aria-") || s.startsWith("data-");
    if (i === !1 && !o) continue;
    const d = s === "htmlFor" ? "for" : s === "tabIndex" ? "tabindex" : s;
    l[d] = typeof i == "boolean" ? o ? String(i) : "" : String(i);
  }
  return { tag: a.tagName, classes: a.classList, attrs: l };
}
const sg = (a) => a === "className" ? "class" : /^(viewBox|preserveAspectRatio|gradientUnits|gradientTransform|patternUnits|xmlns)$/.test(a) ? a : a.replace(/[A-Z]/g, (l) => `-${l.toLowerCase()}`), Qd = (a) => String(a).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
function cg(a) {
  if (a.props["data-perch-markup"]) return String(a.props["data-perch-markup"]);
  const l = (s) => {
    const i = [];
    for (const [d, m] of Object.entries(s.props))
      jf.has(d) || typeof m == "function" || m === void 0 || m === null || m === !1 || typeof m == "object" || d.startsWith("data-") || d.startsWith("aria-") || d === "focusable" || d === "role" || d === "title" || i.push(`${sg(d)}="${Qd(m === !0 ? "" : m)}"`);
    s.tagName === "svg" && !s.props.xmlns && i.unshift('xmlns="http://www.w3.org/2000/svg"');
    const o = s.childNodes.map((d) => d instanceof Zr ? Qd(d.data) : l(d)).join("");
    return `<${s.tagName}${i.length ? ` ${i.join(" ")}` : ""}>${o}</${s.tagName}>`;
  };
  return l(a);
}
function ug(a) {
  const l = a.theme?.() ?? {}, s = {};
  for (const i of _f) l[i] && (s[i] = l[i]);
  return s;
}
const dg = { font_features: "" };
function fg(a, l, s, i = {}, o = null) {
  const d = ug(l), m = l.viewport?.() ?? { width: 1e3, height: 800 }, f = JSON.stringify([d, m]);
  (i.look !== f || i.sheet !== s) && Object.assign(i, { look: f, sheet: s, cache: /* @__PURE__ */ new WeakMap(), cascade: new B0(s, { theme: d, viewport: m }), top: null });
  const { cascade: h, cache: x } = i, S = { cascade: h, cache: x, viewport: m, findings: new Z0(), measure: l.lineHeight ? (w) => l.lineHeight(w) : null };
  i.top ??= h.compute(a.body, h.compute(a.documentElement, null));
  const k = a.body.children.map((w) => Mf(w, i.top, dg, S));
  if (o?.length) {
    const w = /* @__PURE__ */ new Map(), N = (_) => {
      _.id && w.set(_.id, _);
      for (const E of _.children ?? []) N(E);
    };
    k.forEach(N), rg(a, o, w);
  }
  const y = /* @__PURE__ */ new Set();
  for (const w of [a, a.defaultView])
    for (const { type: N } of w?.listeners ?? []) Ud[N] && y.add(Ud[N]);
  return { schema: Y0, root: k[0] ?? null, overlays: k.slice(1), document_events: [...y].sort(), unsupported: S.findings.list() };
}
const mg = { layers: ["properties", "theme", "base", "utilities"], properties: { "--tw-translate-x": { inherits: !1, initial: "0" }, "--tw-translate-y": { inherits: !1, initial: "0" }, "--tw-translate-z": { inherits: !1, initial: "0" }, "--tw-rotate-x": { inherits: !1, initial: null }, "--tw-rotate-y": { inherits: !1, initial: null }, "--tw-rotate-z": { inherits: !1, initial: null }, "--tw-skew-x": { inherits: !1, initial: null }, "--tw-skew-y": { inherits: !1, initial: null }, "--tw-space-y-reverse": { inherits: !1, initial: "0" }, "--tw-border-style": { inherits: !1, initial: "solid" }, "--tw-leading": { inherits: !1, initial: null }, "--tw-font-weight": { inherits: !1, initial: null }, "--tw-tracking": { inherits: !1, initial: null }, "--tw-ordinal": { inherits: !1, initial: null }, "--tw-slashed-zero": { inherits: !1, initial: null }, "--tw-numeric-figure": { inherits: !1, initial: null }, "--tw-numeric-spacing": { inherits: !1, initial: null }, "--tw-numeric-fraction": { inherits: !1, initial: null }, "--tw-shadow": { inherits: !1, initial: "0 0 #0000" }, "--tw-shadow-color": { inherits: !1, initial: null }, "--tw-shadow-alpha": { inherits: !1, initial: "100%" }, "--tw-inset-shadow": { inherits: !1, initial: "0 0 #0000" }, "--tw-inset-shadow-color": { inherits: !1, initial: null }, "--tw-inset-shadow-alpha": { inherits: !1, initial: "100%" }, "--tw-ring-color": { inherits: !1, initial: null }, "--tw-ring-shadow": { inherits: !1, initial: "0 0 #0000" }, "--tw-inset-ring-color": { inherits: !1, initial: null }, "--tw-inset-ring-shadow": { inherits: !1, initial: "0 0 #0000" }, "--tw-ring-inset": { inherits: !1, initial: null }, "--tw-ring-offset-width": { inherits: !1, initial: "0" }, "--tw-ring-offset-color": { inherits: !1, initial: "#fff" }, "--tw-ring-offset-shadow": { inherits: !1, initial: "0 0 #0000" }, "--tw-outline-style": { inherits: !1, initial: "solid" }, "--tw-blur": { inherits: !1, initial: null }, "--tw-brightness": { inherits: !1, initial: null }, "--tw-contrast": { inherits: !1, initial: null }, "--tw-grayscale": { inherits: !1, initial: null }, "--tw-hue-rotate": { inherits: !1, initial: null }, "--tw-invert": { inherits: !1, initial: null }, "--tw-opacity": { inherits: !1, initial: null }, "--tw-saturate": { inherits: !1, initial: null }, "--tw-sepia": { inherits: !1, initial: null }, "--tw-drop-shadow": { inherits: !1, initial: null }, "--tw-drop-shadow-color": { inherits: !1, initial: null }, "--tw-drop-shadow-alpha": { inherits: !1, initial: "100%" }, "--tw-drop-shadow-size": { inherits: !1, initial: null }, "--tw-backdrop-blur": { inherits: !1, initial: null }, "--tw-backdrop-brightness": { inherits: !1, initial: null }, "--tw-backdrop-contrast": { inherits: !1, initial: null }, "--tw-backdrop-grayscale": { inherits: !1, initial: null }, "--tw-backdrop-hue-rotate": { inherits: !1, initial: null }, "--tw-backdrop-invert": { inherits: !1, initial: null }, "--tw-backdrop-opacity": { inherits: !1, initial: null }, "--tw-backdrop-saturate": { inherits: !1, initial: null }, "--tw-backdrop-sepia": { inherits: !1, initial: null }, "--tw-duration": { inherits: !1, initial: null }, "--tw-ease": { inherits: !1, initial: null }, "--tw-content": { inherits: !1, initial: '""' } }, rules: [[":root, :host", null, 2, [["--spacing", ".25rem"], ["--text-xs", ".75rem"], ["--text-xs--line-height", "calc(1 / .75)"], ["--text-sm", ".875rem"], ["--text-sm--line-height", "calc(1.25 / .875)"], ["--font-weight-normal", "400"], ["--font-weight-medium", "500"], ["--font-weight-semibold", "600"], ["--font-weight-bold", "700"], ["--tracking-normal", "0em"], ["--tracking-wide", ".025em"], ["--leading-tight", "1.25"], ["--leading-relaxed", "1.625"], ["--ease-out", "cubic-bezier(0, 0, .2, 1)"], ["--animate-pulse", "pulse 2s cubic-bezier(.4, 0, .6, 1) infinite"], ["--blur-xl", "24px"], ["--default-transition-duration", ".15s"], ["--default-transition-timing-function", "cubic-bezier(.4, 0, .2, 1)"], ["--animate-toast-in", "toast-in .2s cubic-bezier(.22, 1, .36, 1)"], ["--animate-host-pulse", "host-connecting-pulse 1.4s ease-in-out infinite"], ["--animate-drop-zone", "drop-zone-in .14s ease-out, drop-zone-pulse 1.2s ease-in-out .14s infinite"]]], ["::selection", null, 3, [["background", "var(--accent)"], ["color", "var(--panel-bg)"]]], [":where(input, textarea)::placeholder", null, 3, [["color", "var(--subtext-0)"], ["opacity", "1"]]], [":where(button, input, select, textarea)", null, 3, [["border", "0"]]], [':where(button, a[href], select, summary, [role="button"], [role="menuitem"]):focus-visible', null, 3, [["outline", "2px solid var(--accent)"], ["outline-offset", "-2px"]]], ["::-webkit-scrollbar", null, 3, [["width", "var(--scrollbar-size)"], ["height", "var(--scrollbar-size)"]]], ["::-webkit-scrollbar-track", null, 3, [["background", "none"]]], ["::-webkit-scrollbar-corner", null, 3, [["background", "none"]]], ["::-webkit-scrollbar-thumb", null, 3, [["background", "var(--text)"]]], ["::-webkit-scrollbar-thumb", null, 3, [["background", "color-mix(in srgb, var(--text) 20%, transparent)"]]], ["::-webkit-scrollbar-thumb", null, 3, [["border-radius", "var(--scrollbar-size)"]]], ["::-webkit-scrollbar-thumb:hover", null, 3, [["background", "var(--text)"]]], ["::-webkit-scrollbar-thumb:hover", null, 3, [["background", "color-mix(in srgb, var(--text) 40%, transparent)"]]], [".xterm .xterm-scrollable-element > .xterm-scrollbar > .xterm-slider", null, 3, [["border-radius", "var(--scrollbar-size)"]]], [".\\@container, .\\[container-type\\:inline-size\\]", null, 4, [["container-type", "inline-size"]]], [".pointer-events-auto", null, 4, [["pointer-events", "auto"]]], [".pointer-events-none", null, 4, [["pointer-events", "none"]]], [".collapse", null, 4, [["visibility", "collapse"]]], [".invisible", null, 4, [["visibility", "hidden"]]], [".visible", null, 4, [["visibility", "visible"]]], [".sr-only", null, 4, [["clip-path", "inset(50%)"], ["white-space", "nowrap"], ["border-width", "0"], ["width", "1px"], ["height", "1px"], ["margin", "-1px"], ["padding", "0"], ["position", "absolute"], ["overflow", "hidden"]]], [".absolute", null, 4, [["position", "absolute"]]], [".fixed", null, 4, [["position", "fixed"]]], [".relative", null, 4, [["position", "relative"]]], [".static", null, 4, [["position", "static"]]], [".sticky", null, 4, [["position", "sticky"]]], [".inset-0", null, 4, [["inset", "0"]]], [".inset-x-0", null, 4, [["inset-inline", "0"]]], [".inset-x-2", null, 4, [["inset-inline", "calc(var(--spacing) * 2)"]]], [".-top-1", null, 4, [["top", "calc(var(--spacing) * -1)"]]], [".-top-1\\.5", null, 4, [["top", "calc(var(--spacing) * -1.5)"]]], [".top-0", null, 4, [["top", "0"]]], [".top-1", null, 4, [["top", "var(--spacing)"]]], [".top-1\\.5", null, 4, [["top", "calc(var(--spacing) * 1.5)"]]], [".top-1\\/2", null, 4, [["top", "50%"]]], [".top-2", null, 4, [["top", "calc(var(--spacing) * 2)"]]], [".top-4", null, 4, [["top", "calc(var(--spacing) * 4)"]]], [".top-\\[0\\.1rem\\]", null, 4, [["top", ".1rem"]]], [".top-\\[7px\\]", null, 4, [["top", "7px"]]], [".top-\\[max\\(0\\.75rem\\,env\\(safe-area-inset-top\\)\\)\\]", null, 4, [["top", "max(.75rem, env(safe-area-inset-top))"]]], [".top-full", null, 4, [["top", "100%"]]], [".top-px", null, 4, [["top", "1px"]]], [".-right-1", null, 4, [["right", "calc(var(--spacing) * -1)"]]], [".-right-1\\.5", null, 4, [["right", "calc(var(--spacing) * -1.5)"]]], [".right-0", null, 4, [["right", "0"]]], [".right-1", null, 4, [["right", "var(--spacing)"]]], [".right-3", null, 4, [["right", "calc(var(--spacing) * 3)"]]], [".right-4", null, 4, [["right", "calc(var(--spacing) * 4)"]]], [".right-\\[0\\.8rem\\]", null, 4, [["right", ".8rem"]]], [".right-\\[0\\.25rem\\]", null, 4, [["right", ".25rem"]]], [".right-\\[max\\(0\\.75rem\\,env\\(safe-area-inset-right\\)\\)\\]", null, 4, [["right", "max(.75rem, env(safe-area-inset-right))"]]], [".bottom-0", null, 4, [["bottom", "0"]]], [".bottom-2", null, 4, [["bottom", "calc(var(--spacing) * 2)"]]], [".bottom-3", null, 4, [["bottom", "calc(var(--spacing) * 3)"]]], [".bottom-\\[0\\.8rem\\]", null, 4, [["bottom", ".8rem"]]], [".bottom-full", null, 4, [["bottom", "100%"]]], [".-left-8", null, 4, [["left", "calc(var(--spacing) * -8)"]]], [".-left-\\[2px\\]", null, 4, [["left", "-2px"]]], [".left-0", null, 4, [["left", "0"]]], [".left-2", null, 4, [["left", "calc(var(--spacing) * 2)"]]], [".left-\\[0\\.1rem\\]", null, 4, [["left", ".1rem"]]], [".left-\\[max\\(0\\.75rem\\,env\\(safe-area-inset-left\\)\\)\\]", null, 4, [["left", "max(.75rem, env(safe-area-inset-left))"]]], [".left-px", null, 4, [["left", "1px"]]], [".isolate", null, 4, [["isolation", "isolate"]]], [".z-4", null, 4, [["z-index", "4"]]], [".z-5", null, 4, [["z-index", "5"]]], [".z-10", null, 4, [["z-index", "10"]]], [".z-20", null, 4, [["z-index", "20"]]], [".z-30", null, 4, [["z-index", "30"]]], [".z-40", null, 4, [["z-index", "40"]]], [".z-50", null, 4, [["z-index", "50"]]], [".z-\\[2\\]", null, 4, [["z-index", "2"]]], [".z-\\[3\\]", null, 4, [["z-index", "3"]]], [".z-\\[5\\]", null, 4, [["z-index", "5"]]], [".z-\\[1000\\]", null, 4, [["z-index", "1000"]]], [".z-\\[2000\\]", null, 4, [["z-index", "2000"]]], [".z-\\[2100\\]", null, 4, [["z-index", "2100"]]], [".z-\\[2200\\]", null, 4, [["z-index", "2200"]]], [".z-\\[3000\\]", null, 4, [["z-index", "3000"]]], [".z-\\[3100\\]", null, 4, [["z-index", "3100"]]], [".z-\\[4000\\]", null, 4, [["z-index", "4000"]]], [".z-\\[9998\\]", null, 4, [["z-index", "9998"]]], [".z-\\[9999\\]", null, 4, [["z-index", "9999"]]], [".z-\\[10000\\]", null, 4, [["z-index", "10000"]]], [".z-auto", null, 4, [["z-index", "auto"]]], [".order-last", null, 4, [["order", "9999"]]], [".col-\\[1\\/-1\\]", null, 4, [["grid-column", "1 / -1"]]], [".container", null, 4, [["width", "100%"]]], [".container", ["(min-width: 40rem)"], 4, [["max-width", "40rem"]]], [".container", ["(min-width: 48rem)"], 4, [["max-width", "48rem"]]], [".container", ["(min-width: 64rem)"], 4, [["max-width", "64rem"]]], [".container", ["(min-width: 80rem)"], 4, [["max-width", "80rem"]]], [".container", ["(min-width: 96rem)"], 4, [["max-width", "96rem"]]], [".m-0", null, 4, [["margin", "0"]]], [".m-2", null, 4, [["margin", "calc(var(--spacing) * 2)"]]], [".m-\\[0\\.7rem\\]", null, 4, [["margin", ".7rem"]]], [".m-auto", null, 4, [["margin", "auto"]]], [".mx-0", null, 4, [["margin-inline", "0"]]], [".mx-0\\.5", null, 4, [["margin-inline", "calc(var(--spacing) * .5)"]]], [".mx-2", null, 4, [["margin-inline", "calc(var(--spacing) * 2)"]]], [".mx-3", null, 4, [["margin-inline", "calc(var(--spacing) * 3)"]]], [".mx-4", null, 4, [["margin-inline", "calc(var(--spacing) * 4)"]]], [".mx-\\[0\\.3rem\\]", null, 4, [["margin-inline", ".3rem"]]], [".mx-\\[0\\.7rem\\]", null, 4, [["margin-inline", ".7rem"]]], [".mx-\\[0\\.65rem\\]", null, 4, [["margin-inline", ".65rem"]]], [".mx-\\[3px\\]", null, 4, [["margin-inline", "3px"]]], [".mx-\\[11px\\]", null, 4, [["margin-inline", "11px"]]], [".mx-auto", null, 4, [["margin-inline", "auto"]]], [".my-0\\.5", null, 4, [["margin-block", "calc(var(--spacing) * .5)"]]], [".my-1", null, 4, [["margin-block", "var(--spacing)"]]], [".my-2", null, 4, [["margin-block", "calc(var(--spacing) * 2)"]]], [".my-\\[0\\.2rem\\]", null, 4, [["margin-block", ".2rem"]]], [".my-\\[0\\.3rem\\]", null, 4, [["margin-block", ".3rem"]]], [".my-\\[0\\.6rem\\]", null, 4, [["margin-block", ".6rem"]]], [".my-\\[0\\.28rem\\]", null, 4, [["margin-block", ".28rem"]]], [".my-\\[0\\.45rem\\]", null, 4, [["margin-block", ".45rem"]]], [".my-\\[0\\.55rem\\]", null, 4, [["margin-block", ".55rem"]]], [".my-\\[3px\\]", null, 4, [["margin-block", "3px"]]], [".-mt-\\[2px\\]", null, 4, [["margin-top", "-2px"]]], [".mt-0", null, 4, [["margin-top", "0"]]], [".mt-0\\.5", null, 4, [["margin-top", "calc(var(--spacing) * .5)"]]], [".mt-1", null, 4, [["margin-top", "var(--spacing)"]]], [".mt-1\\.5", null, 4, [["margin-top", "calc(var(--spacing) * 1.5)"]]], [".mt-2", null, 4, [["margin-top", "calc(var(--spacing) * 2)"]]], [".mt-3", null, 4, [["margin-top", "calc(var(--spacing) * 3)"]]], [".mt-4", null, 4, [["margin-top", "calc(var(--spacing) * 4)"]]], [".mt-\\[0\\.1rem\\]", null, 4, [["margin-top", ".1rem"]]], [".mt-\\[0\\.2rem\\]", null, 4, [["margin-top", ".2rem"]]], [".mt-\\[0\\.3rem\\]", null, 4, [["margin-top", ".3rem"]]], [".mt-\\[0\\.4rem\\]", null, 4, [["margin-top", ".4rem"]]], [".mt-\\[0\\.5rem\\]", null, 4, [["margin-top", ".5rem"]]], [".mt-\\[0\\.15rem\\]", null, 4, [["margin-top", ".15rem"]]], [".mt-\\[0\\.35rem\\]", null, 4, [["margin-top", ".35rem"]]], [".mr-1", null, 4, [["margin-right", "var(--spacing)"]]], [".mr-1\\.5", null, 4, [["margin-right", "calc(var(--spacing) * 1.5)"]]], [".mr-\\[0\\.3rem\\]", null, 4, [["margin-right", ".3rem"]]], [".mr-\\[0\\.7rem\\]", null, 4, [["margin-right", ".7rem"]]], [".mr-auto", null, 4, [["margin-right", "auto"]]], [".mb-0", null, 4, [["margin-bottom", "0"]]], [".mb-0\\.5", null, 4, [["margin-bottom", "calc(var(--spacing) * .5)"]]], [".mb-1", null, 4, [["margin-bottom", "var(--spacing)"]]], [".mb-2", null, 4, [["margin-bottom", "calc(var(--spacing) * 2)"]]], [".mb-3", null, 4, [["margin-bottom", "calc(var(--spacing) * 3)"]]], [".mb-4", null, 4, [["margin-bottom", "calc(var(--spacing) * 4)"]]], [".mb-8", null, 4, [["margin-bottom", "calc(var(--spacing) * 8)"]]], [".mb-\\[0\\.2rem\\]", null, 4, [["margin-bottom", ".2rem"]]], [".mb-\\[0\\.3rem\\]", null, 4, [["margin-bottom", ".3rem"]]], [".mb-\\[0\\.4rem\\]", null, 4, [["margin-bottom", ".4rem"]]], [".mb-\\[0\\.6rem\\]", null, 4, [["margin-bottom", ".6rem"]]], [".mb-\\[0\\.7rem\\]", null, 4, [["margin-bottom", ".7rem"]]], [".mb-\\[0\\.9rem\\]", null, 4, [["margin-bottom", ".9rem"]]], [".mb-\\[0\\.15rem\\]", null, 4, [["margin-bottom", ".15rem"]]], [".mb-\\[0\\.35rem\\]", null, 4, [["margin-bottom", ".35rem"]]], [".mb-\\[0\\.55rem\\]", null, 4, [["margin-bottom", ".55rem"]]], [".mb-\\[1\\.1rem\\]", null, 4, [["margin-bottom", "1.1rem"]]], [".-ml-0\\.5", null, 4, [["margin-left", "calc(var(--spacing) * -.5)"]]], [".-ml-1", null, 4, [["margin-left", "calc(var(--spacing) * -1)"]]], [".-ml-2", null, 4, [["margin-left", "calc(var(--spacing) * -2)"]]], [".ml-1", null, 4, [["margin-left", "var(--spacing)"]]], [".ml-2", null, 4, [["margin-left", "calc(var(--spacing) * 2)"]]], [".ml-\\[0\\.4rem\\]", null, 4, [["margin-left", ".4rem"]]], [".ml-\\[0\\.5rem\\]", null, 4, [["margin-left", ".5rem"]]], [".ml-\\[0\\.9rem\\]", null, 4, [["margin-left", ".9rem"]]], [".ml-\\[0\\.35rem\\]", null, 4, [["margin-left", ".35rem"]]], [".ml-\\[0\\.55rem\\]", null, 4, [["margin-left", ".55rem"]]], [".ml-\\[1\\.15rem\\]", null, 4, [["margin-left", "1.15rem"]]], [".ml-\\[1\\.45rem\\]", null, 4, [["margin-left", "1.45rem"]]], [".ml-\\[2\\.025rem\\]", null, 4, [["margin-left", "2.025rem"]]], [".ml-\\[2\\.375rem\\]", null, 4, [["margin-left", "2.375rem"]]], [".ml-\\[6\\.1rem\\]", null, 4, [["margin-left", "6.1rem"]]], [".ml-auto", null, 4, [["margin-left", "auto"]]], [".box-border", null, 4, [["box-sizing", "border-box"]]], [".\\!hidden", null, 4, [["display", "none", 1]]], [".\\[display\\:-webkit-box\\]", null, 4, [["display", "-webkit-box"]]], [".\\[display\\:var\\(--pane-grip\\,flex\\)\\]", null, 4, [["display", "var(--pane-grip, flex)"]]], [".block", null, 4, [["display", "block"]]], [".contents", null, 4, [["display", "contents"]]], [".flex", null, 4, [["display", "flex"]]], [".grid", null, 4, [["display", "grid"]]], [".hidden", null, 4, [["display", "none"]]], [".inline", null, 4, [["display", "inline"]]], [".inline-block", null, 4, [["display", "inline-block"]]], [".inline-flex", null, 4, [["display", "inline-flex"]]], [".table", null, 4, [["display", "table"]]], [".size-1", null, 4, [["width", "var(--spacing)"], ["height", "var(--spacing)"]]], [".size-1\\.5", null, 4, [["width", "calc(var(--spacing) * 1.5)"], ["height", "calc(var(--spacing) * 1.5)"]]], [".size-2", null, 4, [["width", "calc(var(--spacing) * 2)"], ["height", "calc(var(--spacing) * 2)"]]], [".size-3", null, 4, [["width", "calc(var(--spacing) * 3)"], ["height", "calc(var(--spacing) * 3)"]]], [".size-5", null, 4, [["width", "calc(var(--spacing) * 5)"], ["height", "calc(var(--spacing) * 5)"]]], [".size-6", null, 4, [["width", "calc(var(--spacing) * 6)"], ["height", "calc(var(--spacing) * 6)"]]], [".size-7", null, 4, [["width", "calc(var(--spacing) * 7)"], ["height", "calc(var(--spacing) * 7)"]]], [".size-8", null, 4, [["width", "calc(var(--spacing) * 8)"], ["height", "calc(var(--spacing) * 8)"]]], [".size-11", null, 4, [["width", "calc(var(--spacing) * 11)"], ["height", "calc(var(--spacing) * 11)"]]], [".size-14", null, 4, [["width", "calc(var(--spacing) * 14)"], ["height", "calc(var(--spacing) * 14)"]]], [".size-\\[0\\.6rem\\]", null, 4, [["width", ".6rem"], ["height", ".6rem"]]], [".size-\\[1\\.2rem\\]", null, 4, [["width", "1.2rem"], ["height", "1.2rem"]]], [".size-\\[5px\\]", null, 4, [["width", "5px"], ["height", "5px"]]], [".size-\\[14px\\]", null, 4, [["width", "14px"], ["height", "14px"]]], [".size-\\[calc\\(14px\\*var\\(--zoom\\,1\\)\\)\\]", null, 4, [["width", "calc(14px * var(--zoom, 1))"], ["height", "calc(14px * var(--zoom, 1))"]]], [".size-full", null, 4, [["width", "100%"], ["height", "100%"]]], [".h-1", null, 4, [["height", "var(--spacing)"]]], [".h-1\\.5", null, 4, [["height", "calc(var(--spacing) * 1.5)"]]], [".h-2", null, 4, [["height", "calc(var(--spacing) * 2)"]]], [".h-3", null, 4, [["height", "calc(var(--spacing) * 3)"]]], [".h-4", null, 4, [["height", "calc(var(--spacing) * 4)"]]], [".h-5", null, 4, [["height", "calc(var(--spacing) * 5)"]]], [".h-6", null, 4, [["height", "calc(var(--spacing) * 6)"]]], [".h-7", null, 4, [["height", "calc(var(--spacing) * 7)"]]], [".h-8", null, 4, [["height", "calc(var(--spacing) * 8)"]]], [".h-9", null, 4, [["height", "calc(var(--spacing) * 9)"]]], [".h-11", null, 4, [["height", "calc(var(--spacing) * 11)"]]], [".h-12", null, 4, [["height", "calc(var(--spacing) * 12)"]]], [".h-44", null, 4, [["height", "calc(var(--spacing) * 44)"]]], [".h-\\[1\\.1rem\\]", null, 4, [["height", "1.1rem"]]], [".h-\\[1\\.3rem\\]", null, 4, [["height", "1.3rem"]]], [".h-\\[1\\.4rem\\]", null, 4, [["height", "1.4rem"]]], [".h-\\[1\\.25rem\\]", null, 4, [["height", "1.25rem"]]], [".h-\\[2px\\]", null, 4, [["height", "2px"]]], [".h-\\[14px\\]", null, 4, [["height", "14px"]]], [".h-\\[18px\\]", null, 4, [["height", "18px"]]], [".h-\\[43px\\]", null, 4, [["height", "43px"]]], [".h-\\[calc\\(100\\%-max\\(0\\.5rem\\,env\\(safe-area-inset-top\\)\\)\\)\\]", null, 4, [["height", "calc(100% - max(.5rem, env(safe-area-inset-top)))"]]], [".h-full", null, 4, [["height", "100%"]]], [".h-px", null, 4, [["height", "1px"]]], [".max-h-40", null, 4, [["max-height", "calc(var(--spacing) * 40)"]]], [".max-h-56", null, 4, [["max-height", "calc(var(--spacing) * 56)"]]], [".max-h-72", null, 4, [["max-height", "calc(var(--spacing) * 72)"]]], [".max-h-\\[8rem\\]", null, 4, [["max-height", "8rem"]]], [".max-h-\\[13rem\\]", null, 4, [["max-height", "13rem"]]], [".max-h-\\[30\\%\\]", null, 4, [["max-height", "30%"]]], [".max-h-\\[30vh\\]", null, 4, [["max-height", "30vh"]]], [".max-h-\\[35vh\\]", null, 4, [["max-height", "35vh"]]], [".max-h-\\[40\\%\\]", null, 4, [["max-height", "40%"]]], [".max-h-\\[50dvh\\]", null, 4, [["max-height", "50dvh"]]], [".max-h-\\[60\\%\\]", null, 4, [["max-height", "60%"]]], [".max-h-\\[70\\%\\]", null, 4, [["max-height", "70%"]]], [".max-h-\\[85vh\\]", null, 4, [["max-height", "85vh"]]], [".max-h-\\[90\\%\\]", null, 4, [["max-height", "90%"]]], [".max-h-\\[190px\\]", null, 4, [["max-height", "190px"]]], [".max-h-\\[240px\\]", null, 4, [["max-height", "240px"]]], [".max-h-\\[260px\\]", null, 4, [["max-height", "260px"]]], [".max-h-\\[calc\\(85vh-4rem\\)\\]", null, 4, [["max-height", "calc(85vh - 4rem)"]]], [".max-h-\\[calc\\(100dvh_-_4rem\\)\\]", null, 4, [["max-height", "calc(100dvh - 4rem)"]]], [".max-h-\\[min\\(420px\\,calc\\(100dvh_-_16vh_-_2rem\\)\\)\\]", null, 4, [["max-height", "min(420px, 100dvh - 16vh - 2rem)"]]], [".max-h-\\[min\\(480px\\,calc\\(100dvh_-_16vh_-_2rem\\)\\)\\]", null, 4, [["max-height", "min(480px, 100dvh - 16vh - 2rem)"]]], [".max-h-full", null, 4, [["max-height", "100%"]]], [".min-h-0", null, 4, [["min-height", "0"]]], [".min-h-6", null, 4, [["min-height", "calc(var(--spacing) * 6)"]]], [".min-h-7", null, 4, [["min-height", "calc(var(--spacing) * 7)"]]], [".min-h-8", null, 4, [["min-height", "calc(var(--spacing) * 8)"]]], [".min-h-9", null, 4, [["min-height", "calc(var(--spacing) * 9)"]]], [".min-h-10", null, 4, [["min-height", "calc(var(--spacing) * 10)"]]], [".min-h-11", null, 4, [["min-height", "calc(var(--spacing) * 11)"]]], [".min-h-20", null, 4, [["min-height", "calc(var(--spacing) * 20)"]]], [".min-h-40", null, 4, [["min-height", "calc(var(--spacing) * 40)"]]], [".min-h-\\[1\\.5em\\]", null, 4, [["min-height", "1.5em"]]], [".min-h-\\[1\\.8rem\\]", null, 4, [["min-height", "1.8rem"]]], [".min-h-\\[2\\.5rem\\]", null, 4, [["min-height", "2.5rem"]]], [".min-h-\\[3\\.2rem\\]", null, 4, [["min-height", "3.2rem"]]], [".min-h-\\[3\\.25rem\\]", null, 4, [["min-height", "3.25rem"]]], [".min-h-\\[6rem\\]", null, 4, [["min-height", "6rem"]]], [".min-h-\\[8rem\\]", null, 4, [["min-height", "8rem"]]], [".min-h-\\[10rem\\]", null, 4, [["min-height", "10rem"]]], [".min-h-\\[12rem\\]", null, 4, [["min-height", "12rem"]]], [".min-h-\\[13rem\\]", null, 4, [["min-height", "13rem"]]], [".min-h-\\[32px\\]", null, 4, [["min-height", "32px"]]], [".min-h-\\[44px\\]", null, 4, [["min-height", "44px"]]], [".min-h-\\[60px\\]", null, 4, [["min-height", "60px"]]], [".min-h-\\[100dvh\\]", null, 4, [["min-height", "100dvh"]]], [".min-h-\\[calc\\(22px\\*var\\(--zoom\\,1\\)\\)\\]", null, 4, [["min-height", "calc(22px * var(--zoom, 1))"]]], [".min-h-full", null, 4, [["min-height", "100%"]]], [".w-2", null, 4, [["width", "calc(var(--spacing) * 2)"]]], [".w-2\\.5", null, 4, [["width", "calc(var(--spacing) * 2.5)"]]], [".w-3", null, 4, [["width", "calc(var(--spacing) * 3)"]]], [".w-4", null, 4, [["width", "calc(var(--spacing) * 4)"]]], [".w-5", null, 4, [["width", "calc(var(--spacing) * 5)"]]], [".w-7", null, 4, [["width", "calc(var(--spacing) * 7)"]]], [".w-8", null, 4, [["width", "calc(var(--spacing) * 8)"]]], [".w-9", null, 4, [["width", "calc(var(--spacing) * 9)"]]], [".w-10", null, 4, [["width", "calc(var(--spacing) * 10)"]]], [".w-20", null, 4, [["width", "calc(var(--spacing) * 20)"]]], [".w-40", null, 4, [["width", "calc(var(--spacing) * 40)"]]], [".w-44", null, 4, [["width", "calc(var(--spacing) * 44)"]]], [".w-\\[1\\.1rem\\]", null, 4, [["width", "1.1rem"]]], [".w-\\[1\\.4rem\\]", null, 4, [["width", "1.4rem"]]], [".w-\\[1\\.6rem\\]", null, 4, [["width", "1.6rem"]]], [".w-\\[1\\.25rem\\]", null, 4, [["width", "1.25rem"]]], [".w-\\[2\\.4rem\\]", null, 4, [["width", "2.4rem"]]], [".w-\\[2\\.25rem\\]", null, 4, [["width", "2.25rem"]]], [".w-\\[6rem\\]", null, 4, [["width", "6rem"]]], [".w-\\[7rem\\]", null, 4, [["width", "7rem"]]], [".w-\\[11rem\\]", null, 4, [["width", "11rem"]]], [".w-\\[15rem\\]", null, 4, [["width", "15rem"]]], [".w-\\[16rem\\]", null, 4, [["width", "16rem"]]], [".w-\\[18px\\]", null, 4, [["width", "18px"]]], [".w-\\[100cqi\\]", null, 4, [["width", "100cqi"]]], [".w-\\[calc\\(\\(100\\%-0\\.875rem\\)\\/8\\)\\]", null, 4, [["width", "calc(12.5% - .109375rem)"]]], [".w-\\[calc\\(100\\%_-_0\\.6rem\\)\\]", null, 4, [["width", "calc(100% - .6rem)"]]], [".w-\\[calc\\(100\\%_-_1rem\\)\\]", null, 4, [["width", "calc(100% - 1rem)"]]], [".w-\\[min\\(22rem\\,calc\\(100vw-3rem\\)\\)\\]", null, 4, [["width", "min(22rem, 100vw - 3rem)"]]], [".w-\\[min\\(26rem\\,100\\%\\)\\]", null, 4, [["width", "min(26rem, 100%)"]]], [".w-\\[min\\(28rem\\,calc\\(100vw-2\\.5rem\\)\\)\\]", null, 4, [["width", "min(28rem, 100vw - 2.5rem)"]]], [".w-\\[min\\(30rem\\,92vw\\)\\]", null, 4, [["width", "min(30rem, 92vw)"]]], [".w-\\[min\\(32rem\\,100\\%\\)\\]", null, 4, [["width", "min(32rem, 100%)"]]], [".w-\\[min\\(340px\\,calc\\(100vw-16px\\)\\)\\]", null, 4, [["width", "min(340px, 100vw - 16px)"]]], [".w-\\[min\\(360px\\,calc\\(100vw_-_2rem\\)\\)\\]", null, 4, [["width", "min(360px, 100vw - 2rem)"]]], [".w-\\[min\\(420px\\,calc\\(100vw_-_16px\\)\\)\\]", null, 4, [["width", "min(420px, 100vw - 16px)"]]], [".w-\\[min\\(480px\\,calc\\(100vw_-_2rem\\)\\)\\]", null, 4, [["width", "min(480px, 100vw - 2rem)"]]], [".w-\\[min\\(560px\\,calc\\(100vw_-_2rem\\)\\)\\]", null, 4, [["width", "min(560px, 100vw - 2rem)"]]], [".w-\\[var\\(--sidebar-width\\,240px\\)\\]", null, 4, [["width", "var(--sidebar-width, 240px)"]]], [".w-\\[var\\(--tools-width\\)\\]", null, 4, [["width", "var(--tools-width)"]]], [".w-auto", null, 4, [["width", "auto"]]], [".w-full", null, 4, [["width", "100%"]]], [".w-px", null, 4, [["width", "1px"]]], [".max-w-24", null, 4, [["max-width", "calc(var(--spacing) * 24)"]]], [".max-w-32", null, 4, [["max-width", "calc(var(--spacing) * 32)"]]], [".max-w-\\[9rem\\]", null, 4, [["max-width", "9rem"]]], [".max-w-\\[10rem\\]", null, 4, [["max-width", "10rem"]]], [".max-w-\\[14rem\\]", null, 4, [["max-width", "14rem"]]], [".max-w-\\[16rem\\]", null, 4, [["max-width", "16rem"]]], [".max-w-\\[24rem\\]", null, 4, [["max-width", "24rem"]]], [".max-w-\\[25\\%\\]", null, 4, [["max-width", "25%"]]], [".max-w-\\[26rem\\]", null, 4, [["max-width", "26rem"]]], [".max-w-\\[28rem\\]", null, 4, [["max-width", "28rem"]]], [".max-w-\\[35\\%\\]", null, 4, [["max-width", "35%"]]], [".max-w-\\[38\\%\\]", null, 4, [["max-width", "38%"]]], [".max-w-\\[45\\%\\]", null, 4, [["max-width", "45%"]]], [".max-w-\\[46rem\\]", null, 4, [["max-width", "46rem"]]], [".max-w-\\[55\\%\\]", null, 4, [["max-width", "55%"]]], [".max-w-\\[56rem\\]", null, 4, [["max-width", "56rem"]]], [".max-w-\\[85\\%\\]", null, 4, [["max-width", "85%"]]], [".max-w-\\[140px\\]", null, 4, [["max-width", "140px"]]], [".max-w-\\[320px\\]", null, 4, [["max-width", "320px"]]], [".max-w-\\[min\\(22rem\\,calc\\(100\\%-1\\.5rem\\)\\)\\]", null, 4, [["max-width", "min(22rem, 100% - 1.5rem)"]]], [".max-w-\\[min\\(30rem\\,calc\\(100\\%-1\\.6rem\\)\\)\\]", null, 4, [["max-width", "min(30rem, 100% - 1.6rem)"]]], [".max-w-\\[min\\(34rem\\,calc\\(100\\%-1\\.5rem\\)\\)\\]", null, 4, [["max-width", "min(34rem, 100% - 1.5rem)"]]], [".max-w-\\[min\\(320px\\,calc\\(100vw_-_24px\\)\\)\\]", null, 4, [["max-width", "min(320px, 100vw - 24px)"]]], [".max-w-full", null, 4, [["max-width", "100%"]]], [".max-w-none", null, 4, [["max-width", "none"]]], [".min-w-0", null, 4, [["min-width", "0"]]], [".min-w-6", null, 4, [["min-width", "calc(var(--spacing) * 6)"]]], [".min-w-8", null, 4, [["min-width", "calc(var(--spacing) * 8)"]]], [".min-w-12", null, 4, [["min-width", "calc(var(--spacing) * 12)"]]], [".min-w-24", null, 4, [["min-width", "calc(var(--spacing) * 24)"]]], [".min-w-36", null, 4, [["min-width", "calc(var(--spacing) * 36)"]]], [".min-w-56", null, 4, [["min-width", "calc(var(--spacing) * 56)"]]], [".min-w-\\[5\\.5rem\\]", null, 4, [["min-width", "5.5rem"]]], [".min-w-\\[7rem\\]", null, 4, [["min-width", "7rem"]]], [".min-w-\\[12rem\\]", null, 4, [["min-width", "12rem"]]], [".min-w-\\[14px\\]", null, 4, [["min-width", "14px"]]], [".min-w-\\[200px\\]", null, 4, [["min-width", "200px"]]], [".min-w-fit", null, 4, [["min-width", "fit-content"]]], [".min-w-max", null, 4, [["min-width", "max-content"]]], [".flex-1", null, 4, [["flex", "1"]]], [".flex-\\[0_0_5rem\\]", null, 4, [["flex", "0 0 5rem"]]], [".flex-\\[0_0_8px\\]", null, 4, [["flex", "0 0 8px"]]], [".flex-\\[0_1_40\\%\\]", null, 4, [["flex", "0 40%"]]], [".flex-\\[1_1_100\\%\\]", null, 4, [["flex", "100%"]]], [".flex-\\[2\\]", null, 4, [["flex", "2"]]], [".flex-initial", null, 4, [["flex", "0 auto"]]], [".flex-none", null, 4, [["flex", "none"]]], [".shrink", null, 4, [["flex-shrink", "1"]]], [".shrink-0", null, 4, [["flex-shrink", "0"]]], [".shrink-\\[0\\.001\\]", null, 4, [["flex-shrink", ".001"]]], [".shrink-\\[2\\]", null, 4, [["flex-shrink", "2"]]], [".shrink-\\[3\\]", null, 4, [["flex-shrink", "3"]]], [".grow", null, 4, [["flex-grow", "1"]]], [".basis-0", null, 4, [["flex-basis", "0"]]], [".basis-\\[14rem\\]", null, 4, [["flex-basis", "14rem"]]], [".-translate-y-1\\/2", null, 4, [["--tw-translate-y", "calc(calc(1 / 2 * 100%) * -1)"], ["translate", "var(--tw-translate-x) var(--tw-translate-y)"]]], [".\\[transform\\:translateY\\(-50\\%\\)\\]", null, 4, [["transform", "translateY(-50%)"]]], [".transform", null, 4, [["transform", "var(--tw-rotate-x, ) var(--tw-rotate-y, ) var(--tw-rotate-z, ) var(--tw-skew-x, ) var(--tw-skew-y, )"]]], [".animate-drop-zone", null, 4, [["animation", "var(--animate-drop-zone)"]]], [".animate-host-pulse", null, 4, [["animation", "var(--animate-host-pulse)"]]], [".animate-pulse", null, 4, [["animation", "var(--animate-pulse)"]]], [".animate-toast-in", null, 4, [["animation", "var(--animate-toast-in)"]]], [".cursor-col-resize", null, 4, [["cursor", "col-resize"]]], [".cursor-default", null, 4, [["cursor", "default"]]], [".cursor-grab", null, 4, [["cursor", "grab"]]], [".cursor-grabbing", null, 4, [["cursor", "grabbing"]]], [".cursor-pointer", null, 4, [["cursor", "pointer"]]], [".cursor-row-resize", null, 4, [["cursor", "row-resize"]]], [".touch-none", null, 4, [["touch-action", "none"]]], [".resize", null, 4, [["resize", "both"]]], [".resize-none", null, 4, [["resize", "none"]]], [".resize-y", null, 4, [["resize", "vertical"]]], [".\\[scrollbar-width\\:none\\]", null, 4, [["scrollbar-width", "none"]]], [".list-disc", null, 4, [["list-style-type", "disc"]]], [".list-none", null, 4, [["list-style-type", "none"]]], [".appearance-none", null, 4, [["appearance", "none"]]], [".grid-cols-8", null, 4, [["grid-template-columns", "repeat(8, minmax(0, 1fr))"]]], [".grid-cols-\\[1fr_auto_1fr\\]", null, 4, [["grid-template-columns", "1fr auto 1fr"]]], [".grid-cols-\\[2\\.5rem_2\\.5rem_0\\.9rem_minmax\\(0\\,1fr\\)\\]", null, 4, [["grid-template-columns", "2.5rem 2.5rem .9rem minmax(0, 1fr)"]]], [".grid-cols-\\[auto_minmax\\(0\\,1fr\\)\\]", null, 4, [["grid-template-columns", "auto minmax(0, 1fr)"]]], [".grid-cols-\\[minmax\\(4rem\\,10rem\\)_1fr_auto\\]", null, 4, [["grid-template-columns", "minmax(4rem, 10rem) 1fr auto"]]], [".grid-cols-\\[repeat\\(2\\,minmax\\(0\\,1fr\\)\\)\\]", null, 4, [["grid-template-columns", "repeat(2, minmax(0, 1fr))"]]], [".grid-cols-\\[repeat\\(auto-fit\\,minmax\\(8rem\\,1fr\\)\\)\\]", null, 4, [["grid-template-columns", "repeat(auto-fit, minmax(8rem, 1fr))"]]], [".flex-col", null, 4, [["flex-direction", "column"]]], [".flex-row", null, 4, [["flex-direction", "row"]]], [".flex-wrap", null, 4, [["flex-wrap", "wrap"]]], [".place-items-center", null, 4, [["place-items", "center"]]], [".content-center", null, 4, [["align-content", "center"]]], [".items-baseline", null, 4, [["align-items", "baseline"]]], [".items-center", null, 4, [["align-items", "center"]]], [".items-end", null, 4, [["align-items", "flex-end"]]], [".items-start", null, 4, [["align-items", "flex-start"]]], [".items-stretch", null, 4, [["align-items", "stretch"]]], [".justify-between", null, 4, [["justify-content", "space-between"]]], [".justify-center", null, 4, [["justify-content", "center"]]], [".justify-end", null, 4, [["justify-content", "flex-end"]]], [".justify-start", null, 4, [["justify-content", "flex-start"]]], [".justify-items-center", null, 4, [["justify-items", "center"]]], [".justify-items-start", null, 4, [["justify-items", "start"]]], [".gap-0", null, 4, [["gap", "0"]]], [".gap-0\\.5", null, 4, [["gap", "calc(var(--spacing) * .5)"]]], [".gap-1", null, 4, [["gap", "var(--spacing)"]]], [".gap-1\\.5", null, 4, [["gap", "calc(var(--spacing) * 1.5)"]]], [".gap-2", null, 4, [["gap", "calc(var(--spacing) * 2)"]]], [".gap-3", null, 4, [["gap", "calc(var(--spacing) * 3)"]]], [".gap-4", null, 4, [["gap", "calc(var(--spacing) * 4)"]]], [".gap-6", null, 4, [["gap", "calc(var(--spacing) * 6)"]]], [".gap-\\[0\\.1rem\\]", null, 4, [["gap", ".1rem"]]], [".gap-\\[0\\.3rem\\]", null, 4, [["gap", ".3rem"]]], [".gap-\\[0\\.4rem\\]", null, 4, [["gap", ".4rem"]]], [".gap-\\[0\\.05rem\\]", null, 4, [["gap", ".05rem"]]], [".gap-\\[0\\.6rem\\]", null, 4, [["gap", ".6rem"]]], [".gap-\\[0\\.8rem\\]", null, 4, [["gap", ".8rem"]]], [".gap-\\[0\\.16rem\\]", null, 4, [["gap", ".16rem"]]], [".gap-\\[0\\.32rem\\]", null, 4, [["gap", ".32rem"]]], [".gap-\\[0\\.35rem\\]", null, 4, [["gap", ".35rem"]]], [".gap-\\[0\\.45rem\\]", null, 4, [["gap", ".45rem"]]], [".gap-\\[0\\.55rem\\]", null, 4, [["gap", ".55rem"]]], [".gap-\\[0\\.65rem\\]", null, 4, [["gap", ".65rem"]]], [".gap-\\[0\\.85rem\\]", null, 4, [["gap", ".85rem"]]], [".gap-\\[1px\\]", null, 4, [["gap", "1px"]]], [".gap-\\[2px\\]", null, 4, [["gap", "2px"]]], [".gap-\\[3px\\]", null, 4, [["gap", "3px"]]], [".gap-\\[7px\\]", null, 4, [["gap", "7px"]]], [".gap-\\[13px\\]", null, 4, [["gap", "13px"]]], [":where(.space-y-0\\.5 > :not(:last-child))", null, 4, [["--tw-space-y-reverse", "0"], ["margin-block-start", "calc(calc(var(--spacing) * .5) * var(--tw-space-y-reverse))"], ["margin-block-end", "calc(calc(var(--spacing) * .5) * calc(1 - var(--tw-space-y-reverse)))"]]], [".gap-x-3", null, 4, [["column-gap", "calc(var(--spacing) * 3)"]]], [".gap-x-4", null, 4, [["column-gap", "calc(var(--spacing) * 4)"]]], [".gap-x-\\[0\\.7rem\\]", null, 4, [["column-gap", ".7rem"]]], [".gap-x-\\[0\\.9rem\\]", null, 4, [["column-gap", ".9rem"]]], [".gap-y-1", null, 4, [["row-gap", "var(--spacing)"]]], [".gap-y-\\[0\\.3rem\\]", null, 4, [["row-gap", ".3rem"]]], [".self-center", null, 4, [["align-self", "center"]]], [".self-end", null, 4, [["align-self", "flex-end"]]], [".self-start", null, 4, [["align-self", "flex-start"]]], [".self-stretch", null, 4, [["align-self", "stretch"]]], [".justify-self-start", null, 4, [["justify-self", "flex-start"]]], [".truncate", null, 4, [["text-overflow", "ellipsis"], ["white-space", "nowrap"], ["overflow", "hidden"]]], [".overflow-auto", null, 4, [["overflow", "auto"]]], [".overflow-hidden", null, 4, [["overflow", "hidden"]]], [".overflow-visible", null, 4, [["overflow", "visible"]]], [".overflow-x-auto", null, 4, [["overflow-x", "auto"]]], [".overflow-y-auto", null, 4, [["overflow-y", "auto"]]], [".overscroll-contain", null, 4, [["overscroll-behavior", "contain"]]], [".rounded, .rounded-\\[0\\.25rem\\]", null, 4, [["border-radius", ".25rem"]]], [".rounded-\\[1\\.5rem\\]", null, 4, [["border-radius", "1.5rem"]]], [".rounded-\\[2px\\]", null, 4, [["border-radius", "2px"]]], [".rounded-\\[3px\\]", null, 4, [["border-radius", "3px"]]], [".rounded-\\[12px\\]", null, 4, [["border-radius", "12px"]]], [".rounded-\\[50\\%\\]", null, 4, [["border-radius", "50%"]]], [".rounded-\\[999px\\]", null, 4, [["border-radius", "999px"]]], [".rounded-\\[calc\\(var\\(--radius\\)\\*2\\)\\]", null, 4, [["border-radius", "calc(var(--radius) * 2)"]]], [".rounded-\\[var\\(--card-radius\\,8px\\)\\]", null, 4, [["border-radius", "var(--card-radius, 8px)"]]], [".rounded-\\[var\\(--card-radius\\,12px\\)\\]", null, 4, [["border-radius", "var(--card-radius, 12px)"]]], [".rounded-full", null, 4, [["border-radius", "3.40282e38px"]]], [".rounded-none", null, 4, [["border-radius", "0"]]], [".rounded-soft", null, 4, [["border-radius", "var(--radius-pane)"]]], [".rounded-ui", null, 4, [["border-radius", "var(--radius)"]]], [".rounded-t-\\[12px\\]", null, 4, [["border-top-left-radius", "12px"], ["border-top-right-radius", "12px"]]], [".rounded-t-none", null, 4, [["border-top-left-radius", "0"], ["border-top-right-radius", "0"]]], [".rounded-bl-\\[6px\\]", null, 4, [["border-bottom-left-radius", "6px"]]], [".border", null, 4, [["border-style", "var(--tw-border-style)"], ["border-width", "1px"]]], [".border-0", null, 4, [["border-style", "var(--tw-border-style)"], ["border-width", "0"]]], [".border-\\[1\\.5px\\]", null, 4, [["border-style", "var(--tw-border-style)"], ["border-width", "1.5px"]]], [".border-b", null, 4, [["border-bottom-style", "var(--tw-border-style)"], ["border-bottom-width", "1px"]]], [".border-l", null, 4, [["border-left-style", "var(--tw-border-style)"], ["border-left-width", "1px"]]], [".border-l-\\[3px\\]", null, 4, [["border-left-style", "var(--tw-border-style)"], ["border-left-width", "3px"]]], [".border-solid", null, 4, [["--tw-border-style", "solid"], ["border-style", "solid"]]], [".border-accent", null, 4, [["border-color", "var(--accent)"]]], [".border-overlay-0", null, 4, [["border-color", "var(--overlay-0)"]]], [".border-overlay-1", null, 4, [["border-color", "var(--overlay-1)"]]], [".border-red", null, 4, [["border-color", "var(--red)"]]], [".border-subtext-0", null, 4, [["border-color", "var(--subtext-0)"]]], [".border-surface-1", null, 4, [["border-color", "var(--surface-1)"]]], [".border-teal", null, 4, [["border-color", "var(--teal)"]]], [".border-yellow", null, 4, [["border-color", "var(--yellow)"]]], [".border-l-accent", null, 4, [["border-left-color", "var(--accent)"]]], [".border-l-green", null, 4, [["border-left-color", "var(--green)"]]], [".border-l-red", null, 4, [["border-left-color", "var(--red)"]]], [".border-l-yellow", null, 4, [["border-left-color", "var(--yellow)"]]], [".bg-\\[\\#161616\\]", null, 4, [["background-color", "#161616"]]], [".bg-\\[\\#fff\\]", null, 4, [["background-color", "#fff"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_8\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "var(--accent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_8\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--accent) 8%,var(--panel-bg))"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_12\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--accent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_12\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--accent) 12%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--accent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--accent) 15%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--blue\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--blue)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--blue\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--blue) 15%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--green\\)_9\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--green)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--green\\)_9\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--green) 9%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--red\\)_7\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--red)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--red\\)_7\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--red) 7%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--red\\)_9\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--red)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--red\\)_9\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--red) 9%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--surface-1\\)_42\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--surface-1\\)_42\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--surface-1) 42%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--surface-1\\)_70\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--surface-1\\)_70\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--surface-1) 70%,var(--panel-bg))"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--text\\)_10\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "var(--text)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--text\\)_10\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--text) 10%,var(--panel-bg))"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--yellow\\)_8\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--yellow)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--yellow\\)_8\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--yellow) 8%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--yellow\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--yellow)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--yellow\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--yellow) 15%,transparent)"]]], [".bg-\\[rgba\\(0\\,0\\,0\\,0\\.5\\)\\]", null, 4, [["background-color", "#00000080"]]], [".bg-\\[rgba\\(0\\,0\\,0\\,0\\.7\\)\\]", null, 4, [["background-color", "#000000b3"]]], [".bg-\\[rgba\\(0\\,0\\,0\\,0\\.55\\)\\]", null, 4, [["background-color", "#0000008c"]]], [".bg-\\[rgba\\(0\\,0\\,0\\,0\\.62\\)\\]", null, 4, [["background-color", "#0000009e"]]], [".bg-\\[var\\(--accent\\)\\]", null, 4, [["background-color", "var(--accent)"]]], [".bg-\\[var\\(--backdrop\\)\\]", null, 4, [["background-color", "var(--backdrop)"]]], [".bg-\\[var\\(--bg\\)\\]", null, 4, [["background-color", "var(--bg)"]]], [".bg-\\[var\\(--card-bg\\)\\]", null, 4, [["background-color", "var(--card-bg)"]]], [".bg-\\[var\\(--picker-bg\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "var(--picker-bg, var(--panel-bg))"]]], [".bg-\\[var\\(--surface-1\\)\\]", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-\\[var\\(--workspace-tools-bg\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "var(--workspace-tools-bg, var(--panel-bg))"]]], [".bg-accent, .bg-accent\\/10", null, 4, [["background-color", "var(--accent)"]]], [".bg-accent\\/10", null, 4, [["background-color", "color-mix(in oklab, var(--accent) 10%, transparent)"]]], [".bg-accent\\/35", null, 4, [["background-color", "var(--accent)"]]], [".bg-accent\\/35", null, 4, [["background-color", "color-mix(in oklab, var(--accent) 35%, transparent)"]]], [".bg-fg", null, 4, [["background-color", "var(--text)"]]], [".bg-green, .bg-green\\/15", null, 4, [["background-color", "var(--green)"]]], [".bg-green\\/15", null, 4, [["background-color", "color-mix(in oklab, var(--green) 15%, transparent)"]]], [".bg-overlay-0", null, 4, [["background-color", "var(--overlay-0)"]]], [".bg-overlay-1", null, 4, [["background-color", "var(--overlay-1)"]]], [".bg-panel-bg", null, 4, [["background-color", "var(--panel-bg)"]]], [".bg-red, .bg-red\\/15", null, 4, [["background-color", "var(--red)"]]], [".bg-red\\/15", null, 4, [["background-color", "color-mix(in oklab, var(--red) 15%, transparent)"]]], [".bg-subtext-0", null, 4, [["background-color", "var(--subtext-0)"]]], [".bg-surface-0", null, 4, [["background-color", "var(--surface-0)"]]], [".bg-surface-1, .bg-surface-1\\/30", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-surface-1\\/30", null, 4, [["background-color", "color-mix(in oklab, var(--surface-1) 30%, transparent)"]]], [".bg-surface-1\\/60", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-surface-1\\/60", null, 4, [["background-color", "color-mix(in oklab, var(--surface-1) 60%, transparent)"]]], [".bg-surface-1\\/70", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-surface-1\\/70", null, 4, [["background-color", "color-mix(in oklab, var(--surface-1) 70%, transparent)"]]], [".bg-transparent", null, 4, [["background-color", "#0000"]]], [".bg-yellow", null, 4, [["background-color", "var(--yellow)"]]], [".object-contain", null, 4, [["object-fit", "contain"]]], [".object-cover", null, 4, [["object-fit", "cover"]]], [".p-0", null, 4, [["padding", "0"]]], [".p-0\\.5", null, 4, [["padding", "calc(var(--spacing) * .5)"]]], [".p-1", null, 4, [["padding", "var(--spacing)"]]], [".p-2", null, 4, [["padding", "calc(var(--spacing) * 2)"]]], [".p-3", null, 4, [["padding", "calc(var(--spacing) * 3)"]]], [".p-4", null, 4, [["padding", "calc(var(--spacing) * 4)"]]], [".p-5", null, 4, [["padding", "calc(var(--spacing) * 5)"]]], [".p-6", null, 4, [["padding", "calc(var(--spacing) * 6)"]]], [".p-\\[0\\.2rem\\]", null, 4, [["padding", ".2rem"]]], [".p-\\[0\\.4rem\\]", null, 4, [["padding", ".4rem"]]], [".p-\\[0\\.5rem\\]", null, 4, [["padding", ".5rem"]]], [".p-\\[0\\.9rem\\]", null, 4, [["padding", ".9rem"]]], [".p-\\[0\\.45rem\\]", null, 4, [["padding", ".45rem"]]], [".p-\\[0\\.55rem\\]", null, 4, [["padding", ".55rem"]]], [".p-\\[0\\.65rem\\]", null, 4, [["padding", ".65rem"]]], [".p-\\[2px\\]", null, 4, [["padding", "2px"]]], [".px-0", null, 4, [["padding-inline", "0"]]], [".px-1", null, 4, [["padding-inline", "var(--spacing)"]]], [".px-1\\.5", null, 4, [["padding-inline", "calc(var(--spacing) * 1.5)"]]], [".px-2", null, 4, [["padding-inline", "calc(var(--spacing) * 2)"]]], [".px-3", null, 4, [["padding-inline", "calc(var(--spacing) * 3)"]]], [".px-3\\.5", null, 4, [["padding-inline", "calc(var(--spacing) * 3.5)"]]], [".px-4", null, 4, [["padding-inline", "calc(var(--spacing) * 4)"]]], [".px-8", null, 4, [["padding-inline", "calc(var(--spacing) * 8)"]]], [".px-\\[0\\.2rem\\]", null, 4, [["padding-inline", ".2rem"]]], [".px-\\[0\\.3rem\\]", null, 4, [["padding-inline", ".3rem"]]], [".px-\\[0\\.4rem\\]", null, 4, [["padding-inline", ".4rem"]]], [".px-\\[0\\.5rem\\]", null, 4, [["padding-inline", ".5rem"]]], [".px-\\[0\\.6rem\\]", null, 4, [["padding-inline", ".6rem"]]], [".px-\\[0\\.7rem\\]", null, 4, [["padding-inline", ".7rem"]]], [".px-\\[0\\.8rem\\]", null, 4, [["padding-inline", ".8rem"]]], [".px-\\[0\\.9rem\\]", null, 4, [["padding-inline", ".9rem"]]], [".px-\\[0\\.26rem\\]", null, 4, [["padding-inline", ".26rem"]]], [".px-\\[0\\.28rem\\]", null, 4, [["padding-inline", ".28rem"]]], [".px-\\[0\\.35rem\\]", null, 4, [["padding-inline", ".35rem"]]], [".px-\\[0\\.42rem\\]", null, 4, [["padding-inline", ".42rem"]]], [".px-\\[0\\.45rem\\]", null, 4, [["padding-inline", ".45rem"]]], [".px-\\[0\\.48rem\\]", null, 4, [["padding-inline", ".48rem"]]], [".px-\\[0\\.55rem\\]", null, 4, [["padding-inline", ".55rem"]]], [".px-\\[0\\.65rem\\]", null, 4, [["padding-inline", ".65rem"]]], [".px-\\[0\\.75rem\\]", null, 4, [["padding-inline", ".75rem"]]], [".px-\\[0\\.85rem\\]", null, 4, [["padding-inline", ".85rem"]]], [".px-\\[1\\.4rem\\]", null, 4, [["padding-inline", "1.4rem"]]], [".px-\\[3px\\]", null, 4, [["padding-inline", "3px"]]], [".px-\\[10px\\]", null, 4, [["padding-inline", "10px"]]], [".py-0", null, 4, [["padding-block", "0"]]], [".py-0\\.5", null, 4, [["padding-block", "calc(var(--spacing) * .5)"]]], [".py-1", null, 4, [["padding-block", "var(--spacing)"]]], [".py-1\\.5", null, 4, [["padding-block", "calc(var(--spacing) * 1.5)"]]], [".py-2", null, 4, [["padding-block", "calc(var(--spacing) * 2)"]]], [".py-3", null, 4, [["padding-block", "calc(var(--spacing) * 3)"]]], [".py-4", null, 4, [["padding-block", "calc(var(--spacing) * 4)"]]], [".py-8", null, 4, [["padding-block", "calc(var(--spacing) * 8)"]]], [".py-\\[0\\.1rem\\]", null, 4, [["padding-block", ".1rem"]]], [".py-\\[0\\.2rem\\]", null, 4, [["padding-block", ".2rem"]]], [".py-\\[0\\.3rem\\]", null, 4, [["padding-block", ".3rem"]]], [".py-\\[0\\.4rem\\]", null, 4, [["padding-block", ".4rem"]]], [".py-\\[0\\.05rem\\]", null, 4, [["padding-block", ".05rem"]]], [".py-\\[0\\.6rem\\]", null, 4, [["padding-block", ".6rem"]]], [".py-\\[0\\.8rem\\]", null, 4, [["padding-block", ".8rem"]]], [".py-\\[0\\.12rem\\]", null, 4, [["padding-block", ".12rem"]]], [".py-\\[0\\.14rem\\]", null, 4, [["padding-block", ".14rem"]]], [".py-\\[0\\.15rem\\]", null, 4, [["padding-block", ".15rem"]]], [".py-\\[0\\.18rem\\]", null, 4, [["padding-block", ".18rem"]]], [".py-\\[0\\.25rem\\]", null, 4, [["padding-block", ".25rem"]]], [".py-\\[0\\.28rem\\]", null, 4, [["padding-block", ".28rem"]]], [".py-\\[0\\.32rem\\]", null, 4, [["padding-block", ".32rem"]]], [".py-\\[0\\.35rem\\]", null, 4, [["padding-block", ".35rem"]]], [".py-\\[0\\.42rem\\]", null, 4, [["padding-block", ".42rem"]]], [".py-\\[0\\.45rem\\]", null, 4, [["padding-block", ".45rem"]]], [".py-\\[0\\.55rem\\]", null, 4, [["padding-block", ".55rem"]]], [".py-\\[0\\.65rem\\]", null, 4, [["padding-block", ".65rem"]]], [".py-\\[2px\\]", null, 4, [["padding-block", "2px"]]], [".py-\\[3px\\]", null, 4, [["padding-block", "3px"]]], [".py-\\[6px\\]", null, 4, [["padding-block", "6px"]]], [".py-px", null, 4, [["padding-block", "1px"]]], [".pt-1", null, 4, [["padding-top", "var(--spacing)"]]], [".pt-2", null, 4, [["padding-top", "calc(var(--spacing) * 2)"]]], [".pt-2\\.5", null, 4, [["padding-top", "calc(var(--spacing) * 2.5)"]]], [".pt-3", null, 4, [["padding-top", "calc(var(--spacing) * 3)"]]], [".pt-4", null, 4, [["padding-top", "calc(var(--spacing) * 4)"]]], [".pt-5", null, 4, [["padding-top", "calc(var(--spacing) * 5)"]]], [".pt-\\[0\\.2rem\\]", null, 4, [["padding-top", ".2rem"]]], [".pt-\\[0\\.4rem\\]", null, 4, [["padding-top", ".4rem"]]], [".pt-\\[0\\.6rem\\]", null, 4, [["padding-top", ".6rem"]]], [".pt-\\[0\\.85rem\\]", null, 4, [["padding-top", ".85rem"]]], [".pt-\\[2px\\]", null, 4, [["padding-top", "2px"]]], [".pt-\\[12vh\\]", null, 4, [["padding-top", "12vh"]]], [".pt-\\[max\\(0\\.5rem\\,env\\(safe-area-inset-top\\)\\)\\]", null, 4, [["padding-top", "max(.5rem, env(safe-area-inset-top))"]]], [".pr-0\\.5", null, 4, [["padding-right", "calc(var(--spacing) * .5)"]]], [".pr-1", null, 4, [["padding-right", "var(--spacing)"]]], [".pr-1\\.5", null, 4, [["padding-right", "calc(var(--spacing) * 1.5)"]]], [".pr-2", null, 4, [["padding-right", "calc(var(--spacing) * 2)"]]], [".pr-3", null, 4, [["padding-right", "calc(var(--spacing) * 3)"]]], [".pr-12", null, 4, [["padding-right", "calc(var(--spacing) * 12)"]]], [".pr-\\[0\\.3rem\\]", null, 4, [["padding-right", ".3rem"]]], [".pr-\\[0\\.6rem\\]", null, 4, [["padding-right", ".6rem"]]], [".pr-\\[0\\.35rem\\]", null, 4, [["padding-right", ".35rem"]]], [".pr-\\[0\\.45rem\\]", null, 4, [["padding-right", ".45rem"]]], [".pr-\\[0\\.55rem\\]", null, 4, [["padding-right", ".55rem"]]], [".pr-\\[1\\.6rem\\]", null, 4, [["padding-right", "1.6rem"]]], [".pr-\\[3px\\]", null, 4, [["padding-right", "3px"]]], [".pr-\\[env\\(safe-area-inset-right\\)\\]", null, 4, [["padding-right", "env(safe-area-inset-right)"]]], [".pr-\\[max\\(0\\.5rem\\,env\\(safe-area-inset-right\\)\\)\\]", null, 4, [["padding-right", "max(.5rem, env(safe-area-inset-right))"]]], [".pb-1", null, 4, [["padding-bottom", "var(--spacing)"]]], [".pb-2", null, 4, [["padding-bottom", "calc(var(--spacing) * 2)"]]], [".pb-3", null, 4, [["padding-bottom", "calc(var(--spacing) * 3)"]]], [".pb-4", null, 4, [["padding-bottom", "calc(var(--spacing) * 4)"]]], [".pb-8", null, 4, [["padding-bottom", "calc(var(--spacing) * 8)"]]], [".pb-\\[0\\.3rem\\]", null, 4, [["padding-bottom", ".3rem"]]], [".pb-\\[0\\.4rem\\]", null, 4, [["padding-bottom", ".4rem"]]], [".pb-\\[0\\.25rem\\]", null, 4, [["padding-bottom", ".25rem"]]], [".pb-\\[0\\.55rem\\]", null, 4, [["padding-bottom", ".55rem"]]], [".pb-\\[1\\.4rem\\]", null, 4, [["padding-bottom", "1.4rem"]]], [".pb-\\[calc\\(1\\.5rem\\+env\\(safe-area-inset-bottom\\)\\)\\]", null, 4, [["padding-bottom", "calc(1.5rem + env(safe-area-inset-bottom))"]]], [".pb-\\[calc\\(1rem\\+env\\(safe-area-inset-bottom\\)\\)\\]", null, 4, [["padding-bottom", "calc(1rem + env(safe-area-inset-bottom))"]]], [".pb-\\[env\\(safe-area-inset-bottom\\)\\]", null, 4, [["padding-bottom", "env(safe-area-inset-bottom)"]]], [".pb-\\[max\\(0\\.5rem\\,env\\(safe-area-inset-bottom\\)\\)\\]", null, 4, [["padding-bottom", "max(.5rem, env(safe-area-inset-bottom))"]]], [".pl-1", null, 4, [["padding-left", "var(--spacing)"]]], [".pl-1\\.5", null, 4, [["padding-left", "calc(var(--spacing) * 1.5)"]]], [".pl-2", null, 4, [["padding-left", "calc(var(--spacing) * 2)"]]], [".pl-3", null, 4, [["padding-left", "calc(var(--spacing) * 3)"]]], [".pl-4", null, 4, [["padding-left", "calc(var(--spacing) * 4)"]]], [".pl-5", null, 4, [["padding-left", "calc(var(--spacing) * 5)"]]], [".pl-6", null, 4, [["padding-left", "calc(var(--spacing) * 6)"]]], [".pl-\\[0\\.4rem\\]", null, 4, [["padding-left", ".4rem"]]], [".pl-\\[0\\.45rem\\]", null, 4, [["padding-left", ".45rem"]]], [".pl-\\[0\\.75rem\\]", null, 4, [["padding-left", ".75rem"]]], [".pl-\\[0\\.85rem\\]", null, 4, [["padding-left", ".85rem"]]], [".pl-\\[1\\.2rem\\]", null, 4, [["padding-left", "1.2rem"]]], [".pl-\\[1\\.55rem\\]", null, 4, [["padding-left", "1.55rem"]]], [".pl-\\[1\\.075rem\\]", null, 4, [["padding-left", "1.075rem"]]], [".pl-\\[1\\.525rem\\]", null, 4, [["padding-left", "1.525rem"]]], [".pl-\\[1\\.875rem\\]", null, 4, [["padding-left", "1.875rem"]]], [".pl-\\[85px\\]", null, 4, [["padding-left", "85px"]]], [".pl-\\[max\\(0\\.5rem\\,env\\(safe-area-inset-left\\)\\)\\]", null, 4, [["padding-left", "max(.5rem, env(safe-area-inset-left))"]]], [".pl-\\[max\\(0\\.25rem\\,env\\(safe-area-inset-left\\)\\)\\]", null, 4, [["padding-left", "max(.25rem, env(safe-area-inset-left))"]]], [".text-center", null, 4, [["text-align", "center"]]], [".text-left", null, 4, [["text-align", "left"]]], [".text-right", null, 4, [["text-align", "right"]]], [".\\[font-family\\:inherit\\]", null, 4, [["font-family", "inherit"]]], [".\\[font-family\\:ui-monospace\\,SFMono-Regular\\,Menlo\\,monospace\\]", null, 4, [["font-family", "ui-monospace, SFMono-Regular, Menlo, monospace"]]], [".\\[font-family\\:var\\(--font-mono\\)\\]", null, 4, [["font-family", "var(--font-mono)"]]], [".text-sm", null, 4, [["font-size", "var(--text-sm)"], ["line-height", "var(--tw-leading, var(--text-sm--line-height))"]]], [".text-xs", null, 4, [["font-size", "var(--text-xs)"], ["line-height", "var(--tw-leading, var(--text-xs--line-height))"]]], [".\\[font-size\\:inherit\\]", null, 4, [["font-size", "inherit"]]], [".text-\\[0\\.6rem\\]", null, 4, [["font-size", ".6rem"]]], [".text-\\[0\\.7rem\\]", null, 4, [["font-size", ".7rem"]]], [".text-\\[0\\.8em\\]", null, 4, [["font-size", ".8em"]]], [".text-\\[0\\.8rem\\]", null, 4, [["font-size", ".8rem"]]], [".text-\\[0\\.9em\\]", null, 4, [["font-size", ".9em"]]], [".text-\\[0\\.9rem\\]", null, 4, [["font-size", ".9rem"]]], [".text-\\[0\\.54rem\\]", null, 4, [["font-size", ".54rem"]]], [".text-\\[0\\.58rem\\]", null, 4, [["font-size", ".58rem"]]], [".text-\\[0\\.62rem\\]", null, 4, [["font-size", ".62rem"]]], [".text-\\[0\\.63rem\\]", null, 4, [["font-size", ".63rem"]]], [".text-\\[0\\.64rem\\]", null, 4, [["font-size", ".64rem"]]], [".text-\\[0\\.65rem\\]", null, 4, [["font-size", ".65rem"]]], [".text-\\[0\\.66rem\\]", null, 4, [["font-size", ".66rem"]]], [".text-\\[0\\.66rem\\]\\!", null, 4, [["font-size", ".66rem", 1]]], [".text-\\[0\\.68rem\\]", null, 4, [["font-size", ".68rem"]]], [".text-\\[0\\.72rem\\]", null, 4, [["font-size", ".72rem"]]], [".text-\\[0\\.74rem\\]", null, 4, [["font-size", ".74rem"]]], [".text-\\[0\\.75rem\\]", null, 4, [["font-size", ".75rem"]]], [".text-\\[0\\.76rem\\]", null, 4, [["font-size", ".76rem"]]], [".text-\\[0\\.77rem\\]", null, 4, [["font-size", ".77rem"]]], [".text-\\[0\\.78rem\\]", null, 4, [["font-size", ".78rem"]]], [".text-\\[0\\.82rem\\]", null, 4, [["font-size", ".82rem"]]], [".text-\\[0\\.83rem\\]", null, 4, [["font-size", ".83rem"]]], [".text-\\[0\\.85rem\\]", null, 4, [["font-size", ".85rem"]]], [".text-\\[0\\.88rem\\]", null, 4, [["font-size", ".88rem"]]], [".text-\\[0\\.95rem\\]", null, 4, [["font-size", ".95rem"]]], [".text-\\[0\\.875rem\\]", null, 4, [["font-size", ".875rem"]]], [".text-\\[1\\.1rem\\]", null, 4, [["font-size", "1.1rem"]]], [".text-\\[1\\.4em\\]", null, 4, [["font-size", "1.4em"]]], [".text-\\[1\\.6rem\\]", null, 4, [["font-size", "1.6rem"]]], [".text-\\[1\\.15rem\\]", null, 4, [["font-size", "1.15rem"]]], [".text-\\[1rem\\]", null, 4, [["font-size", "1rem"]]], [".text-\\[2\\.4rem\\]", null, 4, [["font-size", "2.4rem"]]], [".text-\\[9px\\]", null, 4, [["font-size", "9px"]]], [".text-\\[10px\\]", null, 4, [["font-size", "10px"]]], [".text-\\[11px\\]", null, 4, [["font-size", "11px"]]], [".text-\\[12\\.5px\\]", null, 4, [["font-size", "12.5px"]]], [".text-\\[12px\\]", null, 4, [["font-size", "12px"]]], [".text-\\[13px\\]", null, 4, [["font-size", "13px"]]], [".text-\\[14px\\]", null, 4, [["font-size", "14px"]]], [".text-\\[calc\\(0\\.95rem\\*var\\(--chat-font-scale\\,1\\)\\)\\]", null, 4, [["font-size", "calc(.95rem * var(--chat-font-scale, 1))"]]], [".text-\\[length\\:calc\\(11px\\*var\\(--zoom\\,1\\)\\)\\]", null, 4, [["font-size", "calc(11px * var(--zoom, 1))"]]], [".text-\\[length\\:calc\\(13px\\*var\\(--zoom\\,1\\)\\)\\]", null, 4, [["font-size", "calc(13px * var(--zoom, 1))"]]], [".leading-4", null, 4, [["--tw-leading", "calc(var(--spacing) * 4)"], ["line-height", "calc(var(--spacing) * 4)"]]], [".leading-\\[1\\.1\\]", null, 4, [["--tw-leading", "1.1"], ["line-height", "1.1"]]], [".leading-\\[1\\.2\\]", null, 4, [["--tw-leading", "1.2"], ["line-height", "1.2"]]], [".leading-\\[1\\.3\\]", null, 4, [["--tw-leading", "1.3"], ["line-height", "1.3"]]], [".leading-\\[1\\.4\\]", null, 4, [["--tw-leading", "1.4"], ["line-height", "1.4"]]], [".leading-\\[1\\.5\\]", null, 4, [["--tw-leading", "1.5"], ["line-height", "1.5"]]], [".leading-\\[1\\.6\\]", null, 4, [["--tw-leading", "1.6"], ["line-height", "1.6"]]], [".leading-\\[1\\.45\\]", null, 4, [["--tw-leading", "1.45"], ["line-height", "1.45"]]], [".leading-\\[18px\\]", null, 4, [["--tw-leading", "18px"], ["line-height", "18px"]]], [".leading-none", null, 4, [["--tw-leading", "1"], ["line-height", "1"]]], [".leading-relaxed", null, 4, [["--tw-leading", "var(--leading-relaxed)"], ["line-height", "var(--leading-relaxed)"]]], [".leading-tight", null, 4, [["--tw-leading", "var(--leading-tight)"], ["line-height", "var(--leading-tight)"]]], [".\\[line-height\\:inherit\\]", null, 4, [["line-height", "inherit"]]], [".font-bold", null, 4, [["--tw-font-weight", "var(--font-weight-bold)"], ["font-weight", "var(--font-weight-bold)"]]], [".font-medium", null, 4, [["--tw-font-weight", "var(--font-weight-medium)"], ["font-weight", "var(--font-weight-medium)"]]], [".font-normal", null, 4, [["--tw-font-weight", "var(--font-weight-normal)"], ["font-weight", "var(--font-weight-normal)"]]], [".font-semibold", null, 4, [["--tw-font-weight", "var(--font-weight-semibold)"], ["font-weight", "var(--font-weight-semibold)"]]], [".\\[font-weight\\:inherit\\]", null, 4, [["font-weight", "inherit"]]], [".tracking-\\[-0\\.02em\\]", null, 4, [["--tw-tracking", "-.02em"], ["letter-spacing", "-.02em"]]], [".tracking-\\[0\\.03em\\]", null, 4, [["--tw-tracking", ".03em"], ["letter-spacing", ".03em"]]], [".tracking-\\[0\\.04em\\]", null, 4, [["--tw-tracking", ".04em"], ["letter-spacing", ".04em"]]], [".tracking-\\[0\\.06em\\]", null, 4, [["--tw-tracking", ".06em"], ["letter-spacing", ".06em"]]], [".tracking-\\[0\\.08em\\]", null, 4, [["--tw-tracking", ".08em"], ["letter-spacing", ".08em"]]], [".tracking-\\[0\\.09em\\]", null, 4, [["--tw-tracking", ".09em"], ["letter-spacing", ".09em"]]], [".tracking-\\[0\\.22em\\]", null, 4, [["--tw-tracking", ".22em"], ["letter-spacing", ".22em"]]], [".tracking-normal", null, 4, [["--tw-tracking", "var(--tracking-normal)"], ["letter-spacing", "var(--tracking-normal)"]]], [".tracking-wide", null, 4, [["--tw-tracking", "var(--tracking-wide)"], ["letter-spacing", "var(--tracking-wide)"]]], [".\\[overflow-wrap\\:anywhere\\]", null, 4, [["overflow-wrap", "anywhere"]]], [".break-words", null, 4, [["overflow-wrap", "break-word"]]], [".\\[word-break\\:break-word\\]", null, 4, [["word-break", "break-word"]]], [".text-ellipsis", null, 4, [["text-overflow", "ellipsis"]]], [".whitespace-normal", null, 4, [["white-space", "normal"]]], [".whitespace-nowrap", null, 4, [["white-space", "nowrap"]]], [".whitespace-pre", null, 4, [["white-space", "pre"]]], [".whitespace-pre-wrap", null, 4, [["white-space", "pre-wrap"]]], [".\\[tab-size\\:2\\]", null, 4, [["tab-size", "2"]]], [".text-\\[color\\:var\\(--git-muted\\)\\]", null, 4, [["color", "var(--git-muted)"]]], [".text-\\[var\\(--subtext-0\\)\\]", null, 4, [["color", "var(--subtext-0)"]]], [".text-\\[var\\(--text\\)\\]", null, 4, [["color", "var(--text)"]]], [".text-accent", null, 4, [["color", "var(--accent)"]]], [".text-blue", null, 4, [["color", "var(--blue)"]]], [".text-current", null, 4, [["color", "currentColor"]]], [".text-fg", null, 4, [["color", "var(--text)"]]], [".text-green", null, 4, [["color", "var(--green)"]]], [".text-inherit", null, 4, [["color", "inherit"]]], [".text-mauve", null, 4, [["color", "var(--mauve)"]]], [".text-overlay-0", null, 4, [["color", "var(--overlay-0)"]]], [".text-overlay-1", null, 4, [["color", "var(--overlay-1)"]]], [".text-panel-bg", null, 4, [["color", "var(--panel-bg)"]]], [".text-peach", null, 4, [["color", "var(--peach)"]]], [".text-red", null, 4, [["color", "var(--red)"]]], [".text-red\\!", null, 4, [["color", "var(--red)", 1]]], [".text-subtext-0", null, 4, [["color", "var(--subtext-0)"]]], [".text-yellow", null, 4, [["color", "var(--yellow)"]]], [".capitalize", null, 4, [["text-transform", "capitalize"]]], [".normal-case", null, 4, [["text-transform", "none"]]], [".uppercase", null, 4, [["text-transform", "uppercase"]]], [".italic", null, 4, [["font-style", "italic"]]], [".not-italic", null, 4, [["font-style", "normal"]]], [".tabular-nums", null, 4, [["--tw-numeric-spacing", "tabular-nums"], ["font-variant-numeric", "var(--tw-ordinal, ) var(--tw-slashed-zero, ) var(--tw-numeric-figure, ) var(--tw-numeric-spacing, ) var(--tw-numeric-fraction, )"]]], [".line-through", null, 4, [["text-decoration-line", "line-through"]]], [".no-underline", null, 4, [["text-decoration-line", "none"]]], [".underline", null, 4, [["text-decoration-line", "underline"]]], [".opacity-0", null, 4, [["opacity", "0"]]], [".opacity-40", null, 4, [["opacity", ".4"]]], [".opacity-60", null, 4, [["opacity", ".6"]]], [".opacity-70", null, 4, [["opacity", ".7"]]], [".opacity-75", null, 4, [["opacity", ".75"]]], [".opacity-80", null, 4, [["opacity", ".8"]]], [".opacity-100", null, 4, [["opacity", "1"]]], [".opacity-\\[0\\.72\\]", null, 4, [["opacity", ".72"]]], [".shadow", null, 4, [["--tw-shadow", "0 1px 3px 0 var(--tw-shadow-color, #0000001a), 0 1px 2px -1px var(--tw-shadow-color, #0000001a)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_1px_4px_rgba\\(0\\,0\\,0\\,0\\.4\\)\\]", null, 4, [["--tw-shadow", "0 1px 4px var(--tw-shadow-color, #0006)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_2px_8px_rgba\\(0\\,0\\,0\\,0\\.4\\)\\]", null, 4, [["--tw-shadow", "0 2px 8px var(--tw-shadow-color, #0006)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_2px_8px_rgba\\(0\\,0\\,0\\,0\\.35\\)\\]", null, 4, [["--tw-shadow", "0 2px 8px var(--tw-shadow-color, #00000059)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_6px_20px_rgba\\(0\\,0\\,0\\,0\\.3\\)\\]", null, 4, [["--tw-shadow", "0 6px 20px var(--tw-shadow-color, #0000004d)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_8px_24px_rgba\\(0\\,0\\,0\\,0\\.35\\)\\]", null, 4, [["--tw-shadow", "0 8px 24px var(--tw-shadow-color, #00000059)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_8px_24px_rgba\\(0\\,0\\,0\\,0\\.45\\)\\]", null, 4, [["--tw-shadow", "0 8px 24px var(--tw-shadow-color, #00000073)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_8px_32px_rgba\\(0\\,0\\,0\\,0\\.5\\)\\]", null, 4, [["--tw-shadow", "0 8px 32px var(--tw-shadow-color, #00000080)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_12px_32px_rgba\\(0\\,0\\,0\\,0\\.5\\)\\]", null, 4, [["--tw-shadow", "0 12px 32px var(--tw-shadow-color, #00000080)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_16px_48px_rgba\\(0\\,0\\,0\\,0\\.55\\)\\]", null, 4, [["--tw-shadow", "0 16px 48px var(--tw-shadow-color, #0000008c)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[inset_0_0_24px_var\\(--accent\\)\\]", null, 4, [["--tw-shadow", "inset 0 0 24px var(--tw-shadow-color, var(--accent))"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-lg", null, 4, [["--tw-shadow", "0 10px 15px -3px var(--tw-shadow-color, #0000001a), 0 4px 6px -4px var(--tw-shadow-color, #0000001a)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".ring", null, 4, [["--tw-ring-shadow", "var(--tw-ring-inset, ) 0 0 0 calc(1px + var(--tw-ring-offset-width)) var(--tw-ring-color, currentcolor)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".\\[box-shadow\\:0_1px_2px_rgba\\(0\\,0\\,0\\,0\\.3\\)\\]", null, 4, [["box-shadow", "0 1px 2px #0000004d"]]], [".\\[box-shadow\\:0_4px_14px_rgba\\(0\\,0\\,0\\,0\\.35\\)\\]", null, 4, [["box-shadow", "0 4px 14px #00000059"]]], [".\\[box-shadow\\:none\\]", null, 4, [["box-shadow", "none"]]], [".\\[outline\\:none\\]", null, 4, [["outline", "none"]]], [".outline, .outline-1", null, 4, [["outline-style", "var(--tw-outline-style)"], ["outline-width", "1px"]]], [".outline-2", null, 4, [["outline-style", "var(--tw-outline-style)"], ["outline-width", "2px"]]], [".outline-accent", null, 4, [["outline-color", "var(--accent)"]]], [".blur", null, 4, [["--tw-blur", "blur(8px)"], ["filter", "var(--tw-blur, ) var(--tw-brightness, ) var(--tw-contrast, ) var(--tw-grayscale, ) var(--tw-hue-rotate, ) var(--tw-invert, ) var(--tw-saturate, ) var(--tw-sepia, ) var(--tw-drop-shadow, )"]]], [".\\!filter", null, 4, [["filter", "var(--tw-blur, ) var(--tw-brightness, ) var(--tw-contrast, ) var(--tw-grayscale, ) var(--tw-hue-rotate, ) var(--tw-invert, ) var(--tw-saturate, ) var(--tw-sepia, ) var(--tw-drop-shadow, )", 1]]], [".\\[filter\\:drop-shadow\\(0_6px_10px_rgba\\(0\\,0\\,0\\,0\\.45\\)\\)\\]", null, 4, [["filter", "drop-shadow(0 6px 10px #00000073)"]]], [".filter", null, 4, [["filter", "var(--tw-blur, ) var(--tw-brightness, ) var(--tw-contrast, ) var(--tw-grayscale, ) var(--tw-hue-rotate, ) var(--tw-invert, ) var(--tw-saturate, ) var(--tw-sepia, ) var(--tw-drop-shadow, )"]]], [".backdrop-blur-xl", null, 4, [["--tw-backdrop-blur", "blur(var(--blur-xl))"], ["-webkit-backdrop-filter", "var(--tw-backdrop-blur, ) var(--tw-backdrop-brightness, ) var(--tw-backdrop-contrast, ) var(--tw-backdrop-grayscale, ) var(--tw-backdrop-hue-rotate, ) var(--tw-backdrop-invert, ) var(--tw-backdrop-opacity, ) var(--tw-backdrop-saturate, ) var(--tw-backdrop-sepia, )"], ["backdrop-filter", "var(--tw-backdrop-blur, ) var(--tw-backdrop-brightness, ) var(--tw-backdrop-contrast, ) var(--tw-backdrop-grayscale, ) var(--tw-backdrop-hue-rotate, ) var(--tw-backdrop-invert, ) var(--tw-backdrop-opacity, ) var(--tw-backdrop-saturate, ) var(--tw-backdrop-sepia, )"]]], [".backdrop-saturate-150", null, 4, [["--tw-backdrop-saturate", "saturate(150%)"], ["-webkit-backdrop-filter", "var(--tw-backdrop-blur, ) var(--tw-backdrop-brightness, ) var(--tw-backdrop-contrast, ) var(--tw-backdrop-grayscale, ) var(--tw-backdrop-hue-rotate, ) var(--tw-backdrop-invert, ) var(--tw-backdrop-opacity, ) var(--tw-backdrop-saturate, ) var(--tw-backdrop-sepia, )"], ["backdrop-filter", "var(--tw-backdrop-blur, ) var(--tw-backdrop-brightness, ) var(--tw-backdrop-contrast, ) var(--tw-backdrop-grayscale, ) var(--tw-backdrop-hue-rotate, ) var(--tw-backdrop-invert, ) var(--tw-backdrop-opacity, ) var(--tw-backdrop-saturate, ) var(--tw-backdrop-sepia, )"]]], [".transition", null, 4, [["transition-property", "color, background-color, border-color, outline-color, text-decoration-color, fill, stroke, --tw-gradient-from, --tw-gradient-via, --tw-gradient-to, opacity, box-shadow, transform, translate, scale, rotate, filter, -webkit-backdrop-filter, backdrop-filter, display, content-visibility, overlay, pointer-events"], ["transition-timing-function", "var(--tw-ease, var(--default-transition-timing-function))"], ["transition-duration", "var(--tw-duration, var(--default-transition-duration))"]]], [".transition-\\[left\\,top\\,width\\,height\\]", null, 4, [["transition-property", "left, top, width, height"], ["transition-timing-function", "var(--tw-ease, var(--default-transition-timing-function))"], ["transition-duration", "var(--tw-duration, var(--default-transition-duration))"]]], [".transition-opacity", null, 4, [["transition-property", "opacity"], ["transition-timing-function", "var(--tw-ease, var(--default-transition-timing-function))"], ["transition-duration", "var(--tw-duration, var(--default-transition-duration))"]]], [".duration-150", null, 4, [["--tw-duration", ".15s"], ["transition-duration", ".15s"]]], [".ease-out", null, 4, [["--tw-ease", "var(--ease-out)"], ["transition-timing-function", "var(--ease-out)"]]], [".outline-none", null, 4, [["--tw-outline-style", "none"], ["outline-style", "none"]]], [".outline-solid", null, 4, [["--tw-outline-style", "solid"], ["outline-style", "solid"]]], [".select-none", null, 4, [["-webkit-user-select", "none"], ["user-select", "none"]]], [".select-text", null, 4, [["-webkit-user-select", "text"], ["user-select", "text"]]], [".\\[--panel-bg\\:var\\(--surface-dim\\)\\]", null, 4, [["--panel-bg", "var(--surface-dim)"]]], [".\\[--picker-bg\\:var\\(--surface-0\\)\\]", null, 4, [["--picker-bg", "var(--surface-0)"]]], [".\\[--radius\\:var\\(--radius-pane\\)\\]", null, 4, [["--radius", "var(--radius-pane)"]]], [".\\[--workspace-tools-bg\\:transparent\\]", null, 4, [["--workspace-tools-bg", "transparent"]]], [".\\[-webkit-box-orient\\:vertical\\]", null, 4, [["-webkit-box-orient", "vertical"]]], [".\\[-webkit-line-clamp\\:3\\]", null, 4, [["-webkit-line-clamp", "3"]]], [".\\[-webkit-touch-callout\\:none\\]", null, 4, [["-webkit-touch-callout", "none"]]], [".\\[background\\:none\\]", null, 4, [["background", "none"]]], [".\\[border-right\\:1px_solid_var\\(--git-border\\)\\]", null, 4, [["border-right", "1px solid var(--git-border)"]]], [".\\[border-top\\:1px_solid_var\\(--git-border\\)\\]", null, 4, [["border-top", "1px solid var(--git-border)"]]], [".\\[border\\:0\\]", null, 4, [["border", "0"]]], [".\\[border\\:none\\]", null, 4, [["border", "none"]]], [".\\[font\\:1\\.15rem\\/1_var\\(--font-mono\\)\\]", null, 4, [["font", "1.15rem/1 var(--font-mono)"]]], [".\\[font\\:1rem\\/1\\.2_var\\(--font-mono\\)\\]", null, 4, [["font", "1rem/1.2 var(--font-mono)"]]], [".\\[font\\:inherit\\]", null, 4, [["font", "inherit"]]], [".\\[transition\\:background_0\\.1s_ease\\]", null, 4, [["transition", "background .1s"]]], [".\\[transition\\:background_0\\.12s_ease\\]", null, 4, [["transition", "background .12s"]]], [".\\[transition\\:background_0\\.15s_ease\\]", null, 4, [["transition", "background .15s"]]], [".\\[transition\\:color_0\\.1s_ease\\,background_0\\.1s_ease\\]", null, 4, [["transition", "color .1s, background .1s"]]], [".\\[transition\\:color_0\\.12s_ease\\,background_0\\.12s_ease\\]", null, 4, [["transition", "color .12s, background .12s"]]], [".\\[transition\\:color_0\\.15s_ease\\]", null, 4, [["transition", "color .15s"]]], [".\\[transition\\:opacity_0\\.12s_ease\\]", null, 4, [["transition", "opacity .12s"]]], [".\\[transition\\:transform_0\\.15s_ease\\,background_0\\.15s_ease\\]", null, 4, [["transition", "transform .15s, background .15s"]]], [".not-has-\\[\\[data-setting-row\\]\\]\\:hidden:not(:has([data-setting-row]))", null, 4, [["display", "none"]]], [".group-focus-within\\:flex:is(:where(.group):focus-within *)", null, 4, [["display", "flex"]]], [".group-focus-within\\/row\\:opacity-100:is(:where(.group\\/row):focus-within *)", null, 4, [["opacity", "1"]]], [".group-hover\\:flex:is(:where(.group):hover *)", null, 4, [["display", "flex"]]], [".group-hover\\:opacity-100:is(:where(.group):hover *)", null, 4, [["opacity", "1"]]], [".group-hover\\/line\\:opacity-90:is(:where(.group\\/line):hover *)", null, 4, [["opacity", ".9"]]], [".group-hover\\/ph\\:opacity-100:is(:where(.group\\/ph):hover *), .group-hover\\/row\\:opacity-100:is(:where(.group\\/row):hover *)", null, 4, [["opacity", "1"]]], [".group-focus\\/tree\\:ring-1:is(:where(.group\\/tree):focus *)", null, 4, [["--tw-ring-shadow", "var(--tw-ring-inset, ) 0 0 0 calc(1px + var(--tw-ring-offset-width)) var(--tw-ring-color, currentcolor)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".group-focus\\/tree\\:ring-overlay-1:is(:where(.group\\/tree):focus *)", null, 4, [["--tw-ring-color", "var(--overlay-1)"]]], [".group-focus\\/tree\\:ring-inset:is(:where(.group\\/tree):focus *)", null, 4, [["--tw-ring-inset", "inset"]]], ['.group-aria-checked\\:\\[transform\\:translateX\\(1\\.1rem\\)\\]:is(:where(.group)[aria-checked="true"] *)', null, 4, [["transform", "translateX(1.1rem)"]]], ['.group-aria-checked\\:border-accent:is(:where(.group)[aria-checked="true"] *)', null, 4, [["border-color", "var(--accent)"]]], ['.group-aria-checked\\:bg-accent:is(:where(.group)[aria-checked="true"] *)', null, 4, [["background-color", "var(--accent)"]]], ['.group-aria-checked\\:bg-panel-bg:is(:where(.group)[aria-checked="true"] *)', null, 4, [["background-color", "var(--panel-bg)"]]], ['.group-aria-checked\\:text-accent:is(:where(.group)[aria-checked="true"] *), .group-aria-\\[checked\\=false\\]\\:text-accent:is(:where(.group)[aria-checked="false"] *)', null, 4, [["color", "var(--accent)"]]], [".placeholder\\:text-subtext-0::placeholder", null, 4, [["color", "var(--subtext-0)"]]], [".before\\:absolute:before", null, 4, [["content", "var(--tw-content)"], ["position", "absolute"]]], [".before\\:top-\\[0\\.15rem\\]:before", null, 4, [["content", "var(--tw-content)"], ["top", ".15rem"]]], [".before\\:left-\\[0\\.15rem\\]:before", null, 4, [["content", "var(--tw-content)"], ["left", ".15rem"]]], [".before\\:h-\\[0\\.95rem\\]:before", null, 4, [["content", "var(--tw-content)"], ["height", ".95rem"]]], [".before\\:w-\\[0\\.95rem\\]:before", null, 4, [["content", "var(--tw-content)"], ["width", ".95rem"]]], [".before\\:rounded-full:before", null, 4, [["content", "var(--tw-content)"], ["border-radius", "3.40282e38px"]]], [".before\\:bg-fg:before", null, 4, [["content", "var(--tw-content)"], ["background-color", "var(--text)"]]], [".before\\:content-\\[\\'\\'\\]:before", null, 4, [["--tw-content", '""'], ["content", "var(--tw-content)"]]], [".before\\:\\[transition\\:transform_0\\.12s_ease\\]:before", null, 4, [["content", "var(--tw-content)"], ["transition", "transform .12s"]]], [".after\\:absolute:after", null, 4, [["content", "var(--tw-content)"], ["position", "absolute"]]], [".after\\:inset-0:after", null, 4, [["content", "var(--tw-content)"], ["inset", "0"]]], [".after\\:inset-x-0:after", null, 4, [["content", "var(--tw-content)"], ["inset-inline", "0"]]], [".after\\:-inset-y-2:after", null, 4, [["content", "var(--tw-content)"], ["inset-block", "calc(var(--spacing) * -2)"]]], [".after\\:m-auto:after", null, 4, [["content", "var(--tw-content)"], ["margin", "auto"]]], [".after\\:h-8:after", null, 4, [["content", "var(--tw-content)"], ["height", "calc(var(--spacing) * 8)"]]], [".after\\:h-12:after", null, 4, [["content", "var(--tw-content)"], ["height", "calc(var(--spacing) * 12)"]]], [".after\\:h-\\[3px\\]:after", null, 4, [["content", "var(--tw-content)"], ["height", "3px"]]], [".after\\:w-8:after", null, 4, [["content", "var(--tw-content)"], ["width", "calc(var(--spacing) * 8)"]]], [".after\\:w-\\[3px\\]:after", null, 4, [["content", "var(--tw-content)"], ["width", "3px"]]], [".after\\:rounded-full:after", null, 4, [["content", "var(--tw-content)"], ["border-radius", "3.40282e38px"]]], [".after\\:bg-transparent:after", null, 4, [["content", "var(--tw-content)"], ["background-color", "#0000"]]], [".after\\:content-\\[\\'\\'\\]:after", null, 4, [["--tw-content", '""'], ["content", "var(--tw-content)"]]], [".last\\:border-b-0:last-child", null, 4, [["border-bottom-style", "var(--tw-border-style)"], ["border-bottom-width", "0"]]], [".checked\\:bg-accent:checked", null, 4, [["background-color", "var(--accent)"]]], [".checked\\:before\\:translate-x-\\[1rem\\]:checked:before", null, 4, [["content", "var(--tw-content)"], ["--tw-translate-x", "1rem"], ["translate", "var(--tw-translate-x) var(--tw-translate-y)"]]], [".checked\\:before\\:bg-panel-bg:checked:before", null, 4, [["content", "var(--tw-content)"], ["background-color", "var(--panel-bg)"]]], [".focus-within\\:bg-surface-1:focus-within", null, 4, [["background-color", "var(--surface-1)"]]], [".focus-within\\:outline:focus-within, .focus-within\\:outline-1:focus-within", null, 4, [["outline-style", "var(--tw-outline-style)"], ["outline-width", "1px"]]], [".focus-within\\:outline-fg:focus-within", null, 4, [["outline-color", "var(--text)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_12\\%\\,transparent\\)\\]:hover", null, 4, [["background-color", "var(--accent)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_12\\%\\,transparent\\)\\]:hover", null, 4, [["background-color", "color-mix(in srgb,var(--accent) 12%,transparent)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_15\\%\\,transparent\\)\\]:hover", null, 4, [["background-color", "var(--accent)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_15\\%\\,transparent\\)\\]:hover", null, 4, [["background-color", "color-mix(in srgb,var(--accent) 15%,transparent)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--text\\)_10\\%\\,var\\(--panel-bg\\)\\)\\]:hover", null, 4, [["background-color", "var(--text)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--text\\)_10\\%\\,var\\(--panel-bg\\)\\)\\]:hover", null, 4, [["background-color", "color-mix(in srgb,var(--text) 10%,var(--panel-bg))"]]], [".hover\\:bg-\\[var\\(--surface-0\\)\\]:hover", null, 4, [["background-color", "var(--surface-0)"]]], [".hover\\:bg-accent:hover", null, 4, [["background-color", "var(--accent)"]]], [".hover\\:bg-overlay-0:hover", null, 4, [["background-color", "var(--overlay-0)"]]], [".hover\\:bg-panel-bg:hover", null, 4, [["background-color", "var(--panel-bg)"]]], [".hover\\:bg-surface-0:hover", null, 4, [["background-color", "var(--surface-0)"]]], [".hover\\:bg-surface-1:hover", null, 4, [["background-color", "var(--surface-1)"]]], [".hover\\:bg-transparent:hover", null, 4, [["background-color", "#0000"]]], [".hover\\:text-accent:hover", null, 4, [["color", "var(--accent)"]]], [".hover\\:text-fg:hover", null, 4, [["color", "var(--text)"]]], [".hover\\:text-inherit:hover", null, 4, [["color", "inherit"]]], [".hover\\:text-overlay-0:hover", null, 4, [["color", "var(--overlay-0)"]]], [".hover\\:text-panel-bg:hover", null, 4, [["color", "var(--panel-bg)"]]], [".hover\\:text-red:hover", null, 4, [["color", "var(--red)"]]], [".hover\\:text-subtext-0:hover", null, 4, [["color", "var(--subtext-0)"]]], [".hover\\:text-yellow:hover", null, 4, [["color", "var(--yellow)"]]], [".hover\\:underline:hover", null, 4, [["text-decoration-line", "underline"]]], [".hover\\:opacity-60:hover", null, 4, [["opacity", ".6"]]], [".hover\\:opacity-100\\!:hover", null, 4, [["opacity", "1", 1]]], [".hover\\:opacity-\\[0\\.85\\]:hover", null, 4, [["opacity", ".85"]]], [".hover\\:brightness-110:hover", null, 4, [["--tw-brightness", "brightness(110%)"], ["filter", "var(--tw-blur, ) var(--tw-brightness, ) var(--tw-contrast, ) var(--tw-grayscale, ) var(--tw-hue-rotate, ) var(--tw-invert, ) var(--tw-saturate, ) var(--tw-sepia, ) var(--tw-drop-shadow, )"]]], [".hover\\:\\[filter\\:brightness\\(1\\.08\\)\\]:hover", null, 4, [["filter", "brightness(1.08)"]]], [".hover\\:after\\:bg-overlay-1:hover:after", null, 4, [["content", "var(--tw-content)"], ["background-color", "var(--overlay-1)"]]], [".focus\\:\\[outline\\:1px_solid_var\\(--accent\\)\\]:focus", null, 4, [["outline", "1px solid var(--accent)"]]], [".focus\\:outline-2:focus", null, 4, [["outline-style", "var(--tw-outline-style)"], ["outline-width", "2px"]]], [".focus\\:outline-none:focus", null, 4, [["--tw-outline-style", "none"], ["outline-style", "none"]]], [".focus-visible\\:bg-accent:focus-visible", null, 4, [["background-color", "var(--accent)"]]], [".focus-visible\\:bg-surface-0:focus-visible", null, 4, [["background-color", "var(--surface-0)"]]], [".focus-visible\\:bg-surface-1:focus-visible", null, 4, [["background-color", "var(--surface-1)"]]], [".focus-visible\\:text-accent:focus-visible", null, 4, [["color", "var(--accent)"]]], [".focus-visible\\:text-fg:focus-visible", null, 4, [["color", "var(--text)"]]], [".focus-visible\\:text-panel-bg:focus-visible", null, 4, [["color", "var(--panel-bg)"]]], [".focus-visible\\:text-red:focus-visible", null, 4, [["color", "var(--red)"]]], [".focus-visible\\:text-yellow:focus-visible", null, 4, [["color", "var(--yellow)"]]], [".focus-visible\\:underline:focus-visible", null, 4, [["text-decoration-line", "underline"]]], [".focus-visible\\:opacity-100:focus-visible", null, 4, [["opacity", "1"]]], [".focus-visible\\:\\[outline\\:1px_solid_var\\(--accent\\)\\]:focus-visible", null, 4, [["outline", "1px solid var(--accent)"]]], [".focus-visible\\:\\[outline\\:1px_solid_var\\(--overlay-1\\)\\]:focus-visible", null, 4, [["outline", "1px solid var(--overlay-1)"]]], [".focus-visible\\:\\[outline\\:2px_solid_var\\(--accent\\)\\]:focus-visible", null, 4, [["outline", "2px solid var(--accent)"]]], [".focus-visible\\:outline:focus-visible, .focus-visible\\:outline-1:focus-visible", null, 4, [["outline-style", "var(--tw-outline-style)"], ["outline-width", "1px"]]], [".focus-visible\\:\\[outline-offset\\:-1px\\]:focus-visible", null, 4, [["outline-offset", "-1px"]]], [".focus-visible\\:\\[outline-offset\\:-2px\\]:focus-visible", null, 4, [["outline-offset", "-2px"]]], [".focus-visible\\:\\[outline-offset\\:2px\\]:focus-visible", null, 4, [["outline-offset", "2px"]]], [".focus-visible\\:outline-offset-1:focus-visible", null, 4, [["outline-offset", "1px"]]], [".focus-visible\\:outline-fg:focus-visible", null, 4, [["outline-color", "var(--text)"]]], [".focus-visible\\:after\\:bg-accent:focus-visible:after", null, 4, [["content", "var(--tw-content)"], ["background-color", "var(--accent)"]]], [".active\\:cursor-grabbing:active", null, 4, [["cursor", "grabbing"]]], [".active\\:bg-surface-1:active", null, 4, [["background-color", "var(--surface-1)"]]], [".active\\:text-fg:active", null, 4, [["color", "var(--text)"]]], [".active\\:after\\:bg-accent:active:after", null, 4, [["content", "var(--tw-content)"], ["background-color", "var(--accent)"]]], [".enabled\\:hover\\:bg-surface-1:enabled:hover", null, 4, [["background-color", "var(--surface-1)"]]], [".enabled\\:hover\\:text-fg:enabled:hover", null, 4, [["color", "var(--text)"]]], [".disabled\\:cursor-default:disabled", null, 4, [["cursor", "default"]]], [".disabled\\:cursor-not-allowed:disabled", null, 4, [["cursor", "not-allowed"]]], [".disabled\\:cursor-not-allowed\\!:disabled", null, 4, [["cursor", "not-allowed", 1]]], [".disabled\\:cursor-wait:disabled", null, 4, [["cursor", "wait"]]], [".disabled\\:bg-transparent:disabled", null, 4, [["background-color", "#0000"]]], [".disabled\\:text-fg:disabled", null, 4, [["color", "var(--text)"]]], [".disabled\\:opacity-40:disabled", null, 4, [["opacity", ".4"]]], [".disabled\\:opacity-50:disabled", null, 4, [["opacity", ".5"]]], [".disabled\\:opacity-\\[0\\.45\\]:disabled", null, 4, [["opacity", ".45"]]], [".disabled\\:opacity-\\[0\\.55\\]:disabled", null, 4, [["opacity", ".55"]]], [":where(.app--mac-desktop) .in-\\[\\.app--mac-desktop\\]\\:pl-\\[84px\\]", null, 4, [["padding-left", "84px"]]], [".has-\\[\\:checked\\]\\:bg-surface-0:has(:checked)", null, 4, [["background-color", "var(--surface-0)"]]], [".has-\\[\\:checked\\]\\:text-fg:has(:checked)", null, 4, [["color", "var(--text)"]]], [".has-\\[\\:focus-visible\\]\\:bg-surface-0:has(:focus-visible)", null, 4, [["background-color", "var(--surface-0)"]]], ['.aria-disabled\\:cursor-not-allowed[aria-disabled="true"]', null, 4, [["cursor", "not-allowed"]]], ['.aria-disabled\\:opacity-40[aria-disabled="true"]', null, 4, [["opacity", ".4"]]], ['.aria-expanded\\:opacity-100[aria-expanded="true"]', null, 4, [["opacity", "1"]]], ['.aria-pressed\\:bg-surface-0[aria-pressed="true"]', null, 4, [["background-color", "var(--surface-0)"]]], ['.aria-pressed\\:text-fg[aria-pressed="true"]', null, 4, [["color", "var(--text)"]]], [".motion-reduce\\:animate-none", ["(prefers-reduced-motion: reduce)"], 4, [["animation", "none"]]], [".max-\\[900px\\]\\:hidden", ["not all and (min-width: 900px)"], 4, [["display", "none"]]], [".max-\\[700px\\]\\:hidden", ["not all and (min-width: 700px)"], 4, [["display", "none"]]], [".max-\\[700px\\]\\:size-11", ["not all and (min-width: 700px)"], 4, [["width", "calc(var(--spacing) * 11)"], ["height", "calc(var(--spacing) * 11)"]]], [".max-\\[700px\\]\\:h-9", ["not all and (min-width: 700px)"], 4, [["height", "calc(var(--spacing) * 9)"]]], [".max-\\[700px\\]\\:h-12", ["not all and (min-width: 700px)"], 4, [["height", "calc(var(--spacing) * 12)"]]], [".max-\\[700px\\]\\:min-h-9", ["not all and (min-width: 700px)"], 4, [["min-height", "calc(var(--spacing) * 9)"]]], [".max-\\[700px\\]\\:min-h-11", ["not all and (min-width: 700px)"], 4, [["min-height", "calc(var(--spacing) * 11)"]]], [".max-\\[700px\\]\\:w-24", ["not all and (min-width: 700px)"], 4, [["width", "calc(var(--spacing) * 24)"]]], [".max-\\[700px\\]\\:min-w-11", ["not all and (min-width: 700px)"], 4, [["min-width", "calc(var(--spacing) * 11)"]]], [".max-\\[700px\\]\\:flex-1", ["not all and (min-width: 700px)"], 4, [["flex", "1"]]], [".max-\\[700px\\]\\:flex-\\[1_1_6rem\\]", ["not all and (min-width: 700px)"], 4, [["flex", "6rem"]]], [".max-\\[700px\\]\\:flex-\\[1_1_100\\%\\]", ["not all and (min-width: 700px)"], 4, [["flex", "100%"]]], [".max-\\[700px\\]\\:basis-56", ["not all and (min-width: 700px)"], 4, [["flex-basis", "calc(var(--spacing) * 56)"]]], [".max-\\[700px\\]\\:basis-full", ["not all and (min-width: 700px)"], 4, [["flex-basis", "100%"]]], [".max-\\[700px\\]\\:flex-wrap", ["not all and (min-width: 700px)"], 4, [["flex-wrap", "wrap"]]], [".max-\\[700px\\]\\:gap-y-2", ["not all and (min-width: 700px)"], 4, [["row-gap", "calc(var(--spacing) * 2)"]]], [".min-\\[701px\\]\\:left-auto", ["(min-width: 701px)"], 4, [["left", "auto"]]], [".min-\\[701px\\]\\:my-\\[3px\\]", ["(min-width: 701px)"], 4, [["margin-block", "3px"]]], [".min-\\[701px\\]\\:block", ["(min-width: 701px)"], 4, [["display", "block"]]], [".min-\\[701px\\]\\:hidden", ["(min-width: 701px)"], 4, [["display", "none"]]], [".min-\\[701px\\]\\:min-h-6", ["(min-width: 701px)"], 4, [["min-height", "calc(var(--spacing) * 6)"]]], [".min-\\[701px\\]\\:w-80", ["(min-width: 701px)"], 4, [["width", "calc(var(--spacing) * 80)"]]], [".min-\\[701px\\]\\:rounded-ui", ["(min-width: 701px)"], 4, [["border-radius", "var(--radius)"]]], [".min-\\[701px\\]\\:px-3", ["(min-width: 701px)"], 4, [["padding-inline", "calc(var(--spacing) * 3)"]]], [".min-\\[701px\\]\\:px-4", ["(min-width: 701px)"], 4, [["padding-inline", "calc(var(--spacing) * 4)"]]], [".min-\\[701px\\]\\:pr-\\[3px\\]", ["(min-width: 701px)"], 4, [["padding-right", "3px"]]], [".min-\\[701px\\]\\:pl-4", ["(min-width: 701px)"], 4, [["padding-left", "calc(var(--spacing) * 4)"]]], [".min-\\[701px\\]\\:text-\\[0\\.62rem\\]", ["(min-width: 701px)"], 4, [["font-size", ".62rem"]]], [".min-\\[701px\\]\\:text-\\[12\\.5px\\]", ["(min-width: 701px)"], 4, [["font-size", "12.5px"]]], [".min-\\[701px\\]\\:text-\\[12px\\]", ["(min-width: 701px)"], 4, [["font-size", "12px"]]], [".min-\\[701px\\]\\:font-medium", ["(min-width: 701px)"], 4, [["--tw-font-weight", "var(--font-weight-medium)"], ["font-weight", "var(--font-weight-medium)"]]], [".min-\\[701px\\]\\:font-semibold", ["(min-width: 701px)"], 4, [["--tw-font-weight", "var(--font-weight-semibold)"], ["font-weight", "var(--font-weight-semibold)"]]], [".min-\\[701px\\]\\:tracking-\\[0\\.045em\\]", ["(min-width: 701px)"], 4, [["--tw-tracking", ".045em"], ["letter-spacing", ".045em"]]], [".min-\\[701px\\]\\:text-subtext-0", ["(min-width: 701px)"], 4, [["color", "var(--subtext-0)"]]], [".min-\\[701px\\]\\:uppercase", ["(min-width: 701px)"], 4, [["text-transform", "uppercase"]]], [".min-\\[900px\\]\\:inline", ["(min-width: 900px)"], 4, [["display", "inline"]]], [".pointer-coarse\\:opacity-100", ["(pointer: coarse)"], 4, [["opacity", "1"]]], [".\\[\\&_\\.mode-switch\\]\\:ml-0 .mode-switch", null, 4, [["margin-left", "0"]]], [".max-\\[700px\\]\\:\\[\\&_button\\]\\:min-h-11 button", ["not all and (min-width: 700px)"], 4, [["min-height", "calc(var(--spacing) * 11)"]]], [".\\[\\&_pre\\]\\:m-\\[0\\.2rem_0_0\\.3rem_1\\.2rem\\] pre", null, 4, [["margin", ".2rem 0 .3rem 1.2rem"]]], [".\\[\\&_pre\\]\\:max-h-72 pre", null, 4, [["max-height", "calc(var(--spacing) * 72)"]]], [".\\[\\&_pre\\]\\:overflow-auto pre", null, 4, [["overflow", "auto"]]], [".\\[\\&_pre\\]\\:rounded-ui pre", null, 4, [["border-radius", "var(--radius)"]]], [".\\[\\&_pre\\]\\:bg-surface-0 pre", null, 4, [["background-color", "var(--surface-0)"]]], [".\\[\\&_pre\\]\\:p-2 pre", null, 4, [["padding", "calc(var(--spacing) * 2)"]]], [".\\[\\&_pre\\]\\:text-\\[0\\.78rem\\] pre", null, 4, [["font-size", ".78rem"]]], [".\\[\\&_pre\\]\\:\\[overflow-wrap\\:anywhere\\] pre", null, 4, [["overflow-wrap", "anywhere"]]], [".\\[\\&_pre\\]\\:whitespace-pre-wrap pre", null, 4, [["white-space", "pre-wrap"]]], [".\\[\\&_pre\\]\\:text-fg pre, .\\[\\&_strong\\]\\:text-fg strong", null, 4, [["color", "var(--text)"]]], [".\\[\\&_summary\\]\\:cursor-pointer summary", null, 4, [["cursor", "pointer"]]], [".\\[\\&\\:hover\\:not\\(\\:disabled\\)\\]\\:bg-surface-1:hover:not(:disabled)", null, 4, [["background-color", "var(--surface-1)"]]], [".\\[\\&\\:hover\\:not\\(\\:disabled\\)\\]\\:text-accent:hover:not(:disabled)", null, 4, [["color", "var(--accent)"]]], [".\\[\\&\\:hover\\:not\\(\\:disabled\\)\\]\\:text-red:hover:not(:disabled)", null, 4, [["color", "var(--red)"]]], [".\\[\\&\\:not\\(\\:has\\(\\[data-setting-row\\]\\)\\)\\>\\[data-none\\]\\]\\:block:not(:has([data-setting-row])) > [data-none]", null, 4, [["display", "block"]]], [".\\[\\&\\>\\*\\]\\:min-h-0 > *", null, 4, [["min-height", "0"]]], [".\\[\\&\\>\\*\\]\\:min-w-0 > *", null, 4, [["min-width", "0"]]], [".\\[\\&\\>\\*\\]\\:flex-1 > *", null, 4, [["flex", "1"]]], [".\\[\\&\\>\\*\\]\\:shrink-0 > *", null, 4, [["flex-shrink", "0"]]], [".\\[\\&\\>li\\]\\:text-\\[0\\.85rem\\] > li", null, 4, [["font-size", ".85rem"]]], [".\\[\\&\\>li\\]\\:leading-\\[1\\.5\\] > li", null, 4, [["--tw-leading", "1.5"], ["line-height", "1.5"]]], [".\\[\\&\\>li\\]\\:text-fg > li", null, 4, [["color", "var(--text)"]]], [".\\[\\&\\>summary\\]\\:flex > summary", null, 4, [["display", "flex"]]], [".\\[\\&\\>summary\\]\\:cursor-pointer > summary", null, 4, [["cursor", "pointer"]]], [".\\[\\&\\>summary\\]\\:list-none > summary", null, 4, [["list-style-type", "none"]]], [".\\[\\&\\>summary\\]\\:items-center > summary", null, 4, [["align-items", "center"]]], [".\\[\\&\\>summary\\]\\:gap-\\[0\\.4rem\\] > summary", null, 4, [["gap", ".4rem"]]], [".\\[\\&\\>summary\\]\\:rounded-ui > summary", null, 4, [["border-radius", "var(--radius)"]]], [".\\[\\&\\>summary\\]\\:px-\\[0\\.4rem\\] > summary", null, 4, [["padding-inline", ".4rem"]]], [".\\[\\&\\>summary\\]\\:py-\\[0\\.25rem\\] > summary", null, 4, [["padding-block", ".25rem"]]], [".\\[\\&\\>summary\\]\\:select-none > summary", null, 4, [["-webkit-user-select", "none"], ["user-select", "none"]]], [".\\[\\&\\>summary\\]\\:before\\:inline-block > summary:before", null, 4, [["content", "var(--tw-content)"], ["display", "inline-block"]]], [".\\[\\&\\>summary\\]\\:before\\:size-\\[0\\.4rem\\] > summary:before", null, 4, [["content", "var(--tw-content)"], ["width", ".4rem"], ["height", ".4rem"]]], [".\\[\\&\\>summary\\]\\:before\\:shrink-0 > summary:before", null, 4, [["content", "var(--tw-content)"], ["flex-shrink", "0"]]], [".\\[\\&\\>summary\\]\\:before\\:\\[transform\\:rotate\\(-45deg\\)\\] > summary:before", null, 4, [["content", "var(--tw-content)"], ["transform", "rotate(-45deg)"]]], [".\\[\\&\\>summary\\]\\:before\\:content-\\[\\'\\'\\] > summary:before", null, 4, [["--tw-content", '""'], ["content", "var(--tw-content)"]]], [".\\[\\&\\>summary\\]\\:before\\:\\[border-bottom\\:1\\.3px_solid_currentColor\\] > summary:before", null, 4, [["content", "var(--tw-content)"], ["border-bottom", "1.3px solid"]]], [".\\[\\&\\>summary\\]\\:before\\:\\[border-right\\:1\\.3px_solid_currentColor\\] > summary:before", null, 4, [["content", "var(--tw-content)"], ["border-right", "1.3px solid"]]], [".\\[\\&\\>summary\\]\\:before\\:\\[transition\\:transform_0\\.15s_ease\\] > summary:before", null, 4, [["content", "var(--tw-content)"], ["transition", "transform .15s"]]], [".\\[\\&\\>summary\\:hover\\]\\:bg-surface-1 > summary:hover", null, 4, [["background-color", "var(--surface-1)"]]], [".\\[\\&\\>summary\\:hover\\]\\:text-fg > summary:hover", null, 4, [["color", "var(--text)"]]], [".\\[\\&\\[open\\]\\>summary\\]\\:before\\:\\[transform\\:rotate\\(45deg\\)\\][open] > summary:before", null, 4, [["content", "var(--tw-content)"], ["transform", "rotate(45deg)"]]], [".app--mobile .\\[\\.app--mobile_\\&\\]\\:min-h-11", null, 4, [["min-height", "calc(var(--spacing) * 11)"]]], [".app--mobile .\\[\\.app--mobile_\\&\\]\\:min-h-\\[44px\\]", null, 4, [["min-height", "44px"]]], [".\\[\\@media\\(hover\\:none\\)\\]\\:opacity-60", ["(hover: none)"], 4, [["opacity", ".6"]]], [".\\[\\@media\\(hover\\:none\\)\\]\\:opacity-100", ["(hover: none)"], 4, [["opacity", "1"]]], [".\\[\\@media\\(max-width\\:700px\\)\\]\\:h-\\[2\\.75rem\\]", ["(max-width: 700px)"], 4, [["height", "2.75rem"]]], [".\\[\\@media\\(max-width\\:700px\\)\\]\\:min-h-\\[2\\.75rem\\]", ["(max-width: 700px)"], 4, [["min-height", "2.75rem"]]], [".\\[\\@media\\(max-width\\:700px\\)\\]\\:w-\\[2\\.75rem\\]", ["(max-width: 700px)"], 4, [["width", "2.75rem"]]], [".\\[\\@media\\(max-width\\:700px\\)\\]\\:min-w-\\[2\\.75rem\\]", ["(max-width: 700px)"], 4, [["min-width", "2.75rem"]]], [".\\[\\@media\\(max-width\\:700px\\)\\]\\:px-\\[0\\.65rem\\]", ["(max-width: 700px)"], 4, [["padding-inline", ".65rem"]]], ["div:hover > .\\[div\\:hover\\>\\&\\]\\:opacity-100", null, 4, [["opacity", "1"]]], [":root", null, 1e3, [["color-scheme", "dark"], ["--scrollbar-size", "6px"], ["--accent", "#c8c8c8"], ["--panel-bg", "#161616"], ["--surface-0", "#262626"], ["--surface-1", "#333"], ["--surface-dim", "#1c1c1c"], ["--backdrop", "#050505"], ["--overlay-0", "#3a3a3a"], ["--overlay-1", "#9b9b9b"], ["--text", "#d8d8d8"], ["--subtext-0", "#9b9b9b"], ["--mauve", "#a993c9"], ["--green", "#7fb685"], ["--yellow", "#d3b46a"], ["--red", "#df8c8c"], ["--blue", "#7aa2d7"], ["--teal", "#7fb8b8"], ["--peach", "#d39a6a"], ["--bg", "var(--panel-bg)"], ["--surface", "var(--surface-0)"], ["--surface-alt", "var(--surface-1)"], ["--border", "var(--overlay-0)"], ["--muted", "var(--subtext-0)"], ["--danger", "var(--red)"], ["--radius", "8px"], ["--radius-pane", "8px"], ["accent-color", "var(--accent)"], ["--font-ui", '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif'], ["--font-mono", `ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono",
    monospace`], ["font-family", "var(--font-ui)"]]], ["code, pre, kbd, samp", null, 1e3, [["font-family", "var(--font-mono)"]]], ["*", null, 1e3, [["box-sizing", "border-box"]]], ["html, body, #root", null, 1e3, [["height", "100%"], ["margin", "0"]]], ["html", null, 1e3, [["overscroll-behavior", "none"], ["--shell-bg", "var(--panel-bg)"]]], ["html[data-glass]", null, 1e3, [["--shell-bg", "var(--panel-bg)"]]], ["html[data-glass]", null, 1e3, [["--shell-bg", "color-mix(in srgb, var(--panel-bg) 86%, transparent)"]]], ["html", null, 1e3, [["--backdrop-bg", "var(--backdrop)"], ["--card-bg", "var(--panel-bg)"]]], ["html[data-glass]", null, 1e3, [["--backdrop-bg", "var(--backdrop)"]]], ["html[data-glass]", null, 1e3, [["--backdrop-bg", "color-mix(in srgb, var(--backdrop) 86%, transparent)"]]], ["html[data-glass]", null, 1e3, [["--card-bg", "var(--panel-bg)"]]], ["html[data-glass]", null, 1e3, [["--card-bg", "color-mix(in srgb, var(--panel-bg) 86%, transparent)"]]], ['body:has(.app--cards, .app--mobile), .app--cards .dock-area:has([data-testid="split-canvas"]:not([data-split="0"]))', null, 1e3, [["background", "var(--backdrop-bg)"]]], ["body", null, 1e3, [["background", "var(--shell-bg)"], ["color", "var(--text)"], ["overscroll-behavior", "none"], ["-webkit-tap-highlight-color", "transparent"], ["line-height", "1.3"]]], [".app", null, 1e3, [["flex-direction", "column"], ["height", "100dvh"], ["display", "flex"]]], [".app--mobile", null, 1e3, [["inset", "var(--visible-top, 0px) 0 auto 0"], ["height", "var(--visible-height, 100dvh)"], ["position", "fixed"]]], [".mobile-drawer-backdrop", null, 1e3, [["animation", ".15s ease-out mobile-fade"]]], [".mobile-drawer--left", null, 1e3, [["animation", ".2s cubic-bezier(.2, .8, .2, 1) mobile-slide-left"]]], [".mobile-drawer--right", null, 1e3, [["animation", ".2s cubic-bezier(.2, .8, .2, 1) mobile-slide-right"]]], [".mobile-sheet", null, 1e3, [["animation", ".22s cubic-bezier(.2, .8, .2, 1) mobile-rise"]]], [".mobile-drawer-backdrop, .mobile-drawer, .mobile-sheet", ["(prefers-reduced-motion: reduce)"], 1e3, [["animation", "none"]]], [".layout-drawer", null, 1e3, [["transform", "translateX(var(--float-hide, 0))"], ["transition", "transform .18s"]]], [".layout-drawer:hover, .layout-drawer:focus-within", null, 1e3, [["--float-hide", "0px"]]], [".dockview-theme-perch", null, 1e3, [["--dv-color-abyss-dark", "var(--panel-bg)"], ["--dv-color-abyss", "var(--surface-0)"], ["--dv-color-abyss-light", "var(--surface-1)"], ["--dv-color-abyss-lighter", "var(--overlay-0)"], ["--dv-color-abyss-accent", "var(--accent)"], ["--dv-color-abyss-primary-text", "var(--text)"], ["--dv-color-abyss-secondary-text", "var(--subtext-0)"], ["--dv-group-view-background-color", "var(--panel-bg)"], ["--dv-tabs-and-actions-container-background-color", "var(--surface-0)"], ["--dv-activegroup-visiblepanel-tab-background-color", "var(--panel-bg)"], ["--dv-activegroup-hiddenpanel-tab-background-color", "var(--surface-0)"], ["--dv-inactivegroup-visiblepanel-tab-background-color", "var(--panel-bg)"], ["--dv-inactivegroup-hiddenpanel-tab-background-color", "var(--surface-0)"], ["--dv-tab-divider-color", "var(--overlay-0)"], ["--dv-activegroup-visiblepanel-tab-color", "var(--text)"], ["--dv-activegroup-hiddenpanel-tab-color", "var(--subtext-0)"], ["--dv-inactivegroup-visiblepanel-tab-color", "var(--subtext-0)"], ["--dv-inactivegroup-hiddenpanel-tab-color", "var(--subtext-0)"], ["--dv-separator-border", "var(--overlay-0)"], ["--dv-paneview-header-border-color", "var(--overlay-0)"], ["--dv-tabs-and-actions-container-font-size", ".82rem"], ["--dv-tabs-and-actions-container-height", "2.1rem"]]], [".dockview-theme-perch .dv-tabs-and-actions-container", null, 1e3, [["z-index", "1"], ["position", "relative"]]], [".pane-tab", null, 1e3, [["align-items", "center"], ["width", "100%"], ["height", "100%"], ["display", "flex"]]], [".pane-tab__agent-badge", null, 1e3, [["color", "var(--subtext-0)"], ["white-space", "nowrap"], ["flex-shrink", "0"], ["margin-right", ".4rem"], ["font-size", ".78em"]]], ['.pane-tab[data-testid="pane-tab-chat"] .dv-default-tab-action', null, 1e3, [["display", "none"]]], [".dockview-group-action", null, 1e3, [["border-radius", "var(--radius)"], ["width", "1.5rem"], ["height", "1.5rem"], ["color", "var(--subtext-0)"], ["cursor", "pointer"], ["background", "none"], ["border", "none"], ["justify-content", "center"], ["align-self", "center"], ["align-items", "center"], ["margin", "0 .15rem"], ["font-size", "1rem"], ["line-height", "1"], ["transition", "color .1s, background .1s"], ["display", "flex"]]], [".dockview-group-action:hover", null, 1e3, [["color", "var(--text)"], ["background", "var(--surface-1)"]]], [".dockview-theme-perch .dv-view-container > .dv-view:has(.dv-inactive-group)", ["(max-width: 700px)"], 1e3, [["display", "none"]]], [".dockview-theme-perch .dv-view-container > .dv-view:has(.dv-active-group)", ["(max-width: 700px)"], 1e3, [["width", "100%", 1], ["left", "0", 1]]], [".chat", null, 1e3, [["isolation", "isolate"], ["flex-direction", "column"], ["flex", "1"], ["height", "100%"], ["min-height", "0"], ["display", "flex"]]], [".message__markdown p", null, 1e3, [["margin", "0 0 .5em"]]], [".message__markdown p:last-child", null, 1e3, [["margin-bottom", "0"]]], [".message__markdown h1, .message__markdown h2, .message__markdown h3, .message__markdown h4", null, 1e3, [["margin", ".6em 0 .3em"], ["line-height", "1.25"]]], [".message__markdown h1", null, 1e3, [["font-size", "1.25em"]]], [".message__markdown h2", null, 1e3, [["font-size", "1.12em"]]], [".message__markdown h3", null, 1e3, [["font-size", "1em"]]], [".message__markdown > * + *", null, 1e3, [["margin-top", ".5em"]]], [".message__markdown table, .md-table", null, 1e3, [["border-collapse", "separate"], ["border-spacing", "0"], ["background", "var(--surface-0)"], ["border-radius", "var(--radius)"], ["max-width", "100%"], ["margin", ".5em 0"], ["font-size", ".92em"], ["display", "block"], ["overflow-x", "auto"]]], [".md-table", null, 1e3, [["width", "100%"], ["margin", "0"], ["display", "table"]]], [".message__markdown th, .message__markdown td, .md-table th, .md-table td", null, 1e3, [["text-align", "left"], ["vertical-align", "top"], ["border-bottom", "1px solid var(--surface-1)"], ["padding", ".35em .75em"]]], [".message__markdown th, .md-table th", null, 1e3, [["color", "var(--subtext-0)"], ["white-space", "nowrap"], ["background", "var(--surface-1)"], ["font-weight", "600"]]], [".message__markdown tbody tr:last-child td, .md-table tbody tr:last-child td", null, 1e3, [["border-bottom", "0"]]], [".message__markdown tbody tr:hover td, .md-table tbody tr:hover td", null, 1e3, [["background", "var(--surface-1)"]]], [".md-table caption", null, 1e3, [["text-align", "left"], ["color", "var(--subtext-0)"], ["padding", ".4em .75em"]]], [".md-code", null, 1e3, [["background", "var(--surface-0)"], ["border-radius", "var(--radius)"], ["overflow", "hidden"]]], [".md-code__bar", null, 1e3, [["color", "var(--subtext-0)"], ["background", "var(--surface-1)"], ["justify-content", "space-between"], ["align-items", "center"], ["padding", ".1rem .4rem .1rem .75rem"], ["font-size", ".75em"], ["display", "flex"]]], [".message__markdown .md-code pre", null, 1e3, [["background", "none"], ["border-radius", "0"], ["margin", "0"]]], [".hl-keyword", null, 1e3, [["color", "var(--mauve)"]]], [".hl-string", null, 1e3, [["color", "var(--green)"]]], [".hl-number", null, 1e3, [["color", "var(--peach)"]]], [".hl-function", null, 1e3, [["color", "var(--blue)"]]], [".hl-type", null, 1e3, [["color", "var(--yellow)"]]], [".hl-tag", null, 1e3, [["color", "var(--teal)"]]], [".hl-comment", null, 1e3, [["color", "var(--overlay-1)"], ["font-style", "italic"]]], [".message__markdown ul, .message__markdown ol", null, 1e3, [["margin", ".3em 0 .5em 1.3em"], ["padding", "0"]]], [".message__markdown li", null, 1e3, [["margin-bottom", ".2em"]]], [".message__markdown code", null, 1e3, [["background", "var(--surface-0)"], ["border-radius", ".25rem"], ["padding", ".1em .35em"], ["font-family", "ui-monospace, SFMono-Regular, SF Mono, Menlo, Consolas, monospace"], ["font-size", ".88em"]]], [".message__markdown pre", null, 1e3, [["background", "var(--surface-0)"], ["border-radius", "var(--radius)"], ["margin", ".4em 0"], ["padding", ".6rem .75rem"], ["position", "relative"], ["overflow-x", "auto"]]], [".message__markdown pre code", null, 1e3, [["background", "none"], ["border", "none"], ["padding", "0"], ["font-size", ".85em"]]], [".message__markdown a", null, 1e3, [["color", "var(--accent)"], ["text-decoration", "underline"]]], [".message__markdown blockquote", null, 1e3, [["border-left", "3px solid var(--overlay-0)"], ["color", "var(--subtext-0)"], ["margin", ".4em 0"], ["padding", ".1em .6em"]]], [".message__markdown hr", null, 1e3, [["border", "none"], ["border-top", "1px solid var(--overlay-0)"], ["margin", ".75em 0"]]], [".file-markdown", null, 1e3, [["overflow-wrap", "anywhere"]]], [".file-markdown img", null, 1e3, [["max-width", "100%"]]], [".file-markdown table", null, 1e3, [["border-collapse", "collapse"], ["margin", ".4em 0"], ["display", "block"], ["overflow-x", "auto"]]], [".file-markdown th, .file-markdown td", null, 1e3, [["border", "1px solid var(--overlay-0)"], ["padding", ".2em .5em"]]], [".file-markdown .md-placeholder", null, 1e3, [["color", "var(--subtext-0)"], ["border", "1px dashed var(--overlay-0)"], ["border-radius", ".25rem"], ["padding", ".05em .35em"], ["font-size", ".9em"]]], [".terminal", null, 1e3, [["min-width", "0"], ["min-height", "0"], ["padding", "var(--terminal-padding, 0)"], ["opacity", "var(--terminal-opacity, 1)"], ["flex", "1"], ["display", "flex"], ["position", "relative"]]], [".terminal__surface", null, 1e3, [["flex", "1"], ["min-width", "0"], ["min-height", "0"], ["overflow", "hidden"]]], [".terminal__surface .xterm", null, 1e3, [["height", "100%"]]], [".terminal__surface .xterm:not(.allow-transparency) .xterm-viewport", null, 1e3, [["background-color", "#0000"]]], [".terminal__surface .xterm-scrollable-element", null, 1e3, [["position", "static", 1]]], [".terminal__surface .xterm-decoration-overview-ruler, .no-pane-scrollbars .terminal__surface .xterm-scrollable-element > .xterm-scrollbar", null, 1e3, [["display", "none"]]], [".terminal--persistent", null, 1e3, [["flex-direction", "column"]]], [".terminal__toolbar", null, 1e3, [["color", "var(--subtext-0)"], ["align-items", "center"], ["gap", ".5rem"], ["padding", ".25rem 1.5rem .25rem .5rem"], ["font-size", ".8rem"], ["display", "flex"]]], [".terminal__toolbar button", null, 1e3, [["border-radius", "var(--radius)"], ["min-height", "32px"], ["color", "var(--text)"], ["background", "var(--surface-0)"], ["border", "0"], ["padding", ".25rem .5rem"]]], [".terminal__toolbar--overlay", null, 1e3, [["z-index", "2"], ["border-radius", "var(--radius)"], ["background", "var(--surface-1)"], ["padding", ".2rem .3rem .2rem .6rem"], ["position", "absolute"], ["top", ".4rem"], ["right", ".9rem"], ["box-shadow", "0 2px 8px #00000040"]]], [".terminal__connection", null, 1e3, [["margin-right", "auto"]]], [".terminal__toolbar button:disabled", null, 1e3, [["opacity", ".5"]]], [".terminal__notice", null, 1e3, [["color", "var(--subtext-0)"], ["padding", ".75rem"], ["font-size", ".85rem"]]], [".app--mobile .terminal__toolbar button", null, 1e3, [["min-height", "44px"]]], [".app--mobile .terminal__connection", null, 1e3, [["display", "none"]]], [".app--mobile .terminal__toolbar", null, 1e3, [["padding-right", ".5rem"]]], [".terminal__exited", null, 1e3, [["background", "var(--surface-1)"], ["border-radius", "var(--radius)"], ["color", "var(--subtext-0)"], ["padding", ".35rem .75rem"], ["font-size", ".85rem"], ["position", "absolute"], ["bottom", ".75rem"], ["left", "50%"], ["transform", "translateX(-50%)"]]], [".terminal__exited--cli", null, 1e3, [["background", "var(--panel-bg)"], ["flex-direction", "column"], ["align-items", "center"], ["gap", ".6rem"], ["padding", ".9rem 1.1rem"], ["display", "flex"], ["top", "50%"], ["bottom", "auto"], ["transform", "translate(-50%, -50%)"], ["box-shadow", "0 6px 24px #00000059"]]], [".terminal__exited-actions", null, 1e3, [["gap", ".5rem"], ["display", "flex"]]], [".terminal__cli-error", null, 1e3, [["background", "var(--red)"], ["position", "absolute"], ["bottom", ".75rem"], ["left", "50%"], ["transform", "translateX(-50%)"]]], [".terminal__cli-error", null, 1e3, [["background", "color-mix(in srgb, var(--red) 20%, var(--panel-bg))"]]], [".terminal__cli-error", null, 1e3, [["border-radius", "var(--radius)"], ["color", "var(--red)"], ["text-align", "center"], ["white-space", "pre-wrap"], ["word-break", "break-word"], ["max-width", "90%"], ["padding", ".35rem .75rem"], ["font-size", ".85rem"]]], [".mobile-pane-shell__content > .chat, .mobile-pane-shell__content > .terminal, .mobile-pane-shell__content > .workspace-files, .mobile-pane-shell__content > .workspace-git", null, 1e3, [["flex", "1"], ["width", "100%"], ["min-width", "0"], ["height", "100%"], ["min-height", "0"]]], [".terminal__host", null, 1e3, [["width", "100%"], ["height", "100%"], ["overflow", "hidden"]]], [".workspace-git", null, 1e3, [["--git-border", "var(--overlay-0)"]]], [".workspace-git", null, 1e3, [["--git-border", "color-mix(in srgb, var(--overlay-0) 72%, transparent)"]]], [".workspace-git", null, 1e3, [["--git-muted", "var(--subtext-0)"], ["width", "100%"], ["min-width", "0"], ["height", "100%"], ["min-height", "0"], ["color", "var(--text)"], ["background", "var(--workspace-tools-bg, var(--panel-bg))"], ["flex-direction", "column"], ["font-size", ".78rem"], ["display", "flex"], ["position", "relative"], ["overflow", "hidden"], ["container-type", "inline-size"]]], [".workspace-git button, .workspace-git input, .workspace-git textarea", null, 1e3, [["font", "inherit"]]], [".workspace-git button", null, 1e3, [["cursor", "pointer"]]], ['.workspace-git button:focus-visible, .workspace-git input:focus-visible, .workspace-git textarea:focus-visible, .workspace-git [role="button"]:focus-visible', null, 1e3, [["outline", "2px solid var(--accent)"], ["outline-offset", "1px"]]], [".workspace-git__diff", null, 1e3, [["container-type", "inline-size"]]], [".workspace-git__line-comment-thread", null, 1e3, [["max-width", "max(0px, min(42rem, 100cqi - 6.9rem))"], ["position", "sticky"], ["left", "0"]]], [".workspace-git__comment-composer", null, 1e3, [["max-width", "max(0px, 100cqi - 1.4rem)"], ["position", "sticky"], ["left", "0"]]], [".dockview-group-action--split-session", null, 1e3, [["font-size", "13px"]]], [".session-split-popover", null, 1e3, [["display", "flex"], ["flex-direction", "column"], ["background", "var(--surface-1)"], ["border-radius", "var(--radius)"], ["box-shadow", "0 8px 24px rgba(0, 0, 0, 0.45)"], ["padding", "4px"], ["font-size", "12.5px"], ["color", "var(--text)"], ["overflow", "hidden"]]], [".session-split-popover__header", null, 1e3, [["padding", "6px 8px 4px"], ["font-size", "11px"], ["text-transform", "uppercase"], ["letter-spacing", "0.04em"], ["color", "var(--subtext-0)"]]], [".session-split-popover__empty", null, 1e3, [["padding", "8px"], ["color", "var(--subtext-0)"]]], [".session-split-popover__list", null, 1e3, [["overflow-y", "auto"]]], [".session-split-popover__item", null, 1e3, [["display", "flex"], ["flex-direction", "column"], ["align-items", "flex-start"], ["gap", "1px"], ["width", "100%"], ["padding", "6px 8px"], ["border", "none"], ["border-radius", "4px"], ["background", "transparent"], ["color", "inherit"], ["text-align", "left"], ["cursor", "grab"]]], [".session-split-popover__item:hover", null, 1e3, [["background", "var(--surface-0)"]]], [".session-split-popover__item-title", null, 1e3, [["font-weight", "500"], ["white-space", "nowrap"], ["overflow", "hidden"], ["text-overflow", "ellipsis"], ["max-width", "100%"]]], [".session-split-popover__item-cwd", null, 1e3, [["font-size", "11px"], ["color", "var(--subtext-0)"], ["white-space", "nowrap"], ["overflow", "hidden"], ["text-overflow", "ellipsis"], ["max-width", "100%"]]], [".session-split-popover__item-badge", null, 1e3, [["align-self", "flex-end"], ["font-size", "10px"], ["color", "var(--accent)"], ["margin-top", "-14px"]]], [".inactive-session-pane", null, 1e3, [["display", "flex"], ["flex-direction", "column"], ["align-items", "center"], ["justify-content", "center"], ["gap", "10px"], ["height", "100%"], ["padding", "24px"], ["text-align", "center"], ["color", "var(--subtext-0)"]]], [".inactive-session-pane__title", null, 1e3, [["font-size", "14px"], ["font-weight", "500"], ["color", "var(--text)"]]], [".inactive-session-pane__cwd", null, 1e3, [["font-size", "12px"], ["color", "var(--subtext-0)"], ["word-break", "break-all"]]], [".inactive-session-pane__note", null, 1e3, [["font-size", "12px"], ["max-width", "320px"], ["line-height", "1.5"]]], [".inactive-session-pane__switch", null, 1e3, [["margin-top", "4px"], ["padding", "6px 14px"], ["border-radius", "var(--radius)"], ["border", "0"], ["background", "var(--surface-0)"], ["color", "var(--text)"], ["cursor", "pointer"], ["font-size", "12.5px"]]], [".inactive-session-pane__switch:hover", null, 1e3, [["background", "var(--surface-1)"]]]], skipped: { "@supports evaluated false": 2, "@container": 6, "@keyframes": 9 } };
//! The app's compiled stylesheet as a table (`build.mjs` writes it from Vite + Tailwind's output and bundles it as
//! `virtual:perch-css-table`), parsed once on first use.
let pg = null;
const hg = () => pg ??= new A0(mg);
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
function gg(a, l) {
  const s = /* @__PURE__ */ new Set([...Object.keys(a), ...Object.keys(l)]);
  for (const i of s) {
    if (i === "children") continue;
    const o = a[i], d = l[i];
    if (!(o === d || typeof o == "function" && typeof d == "function") && !(i === "style" && o && d && typeof o == "object" && typeof d == "object" && [.../* @__PURE__ */ new Set([...Object.keys(o), ...Object.keys(d)])].every((f) => o[f] === d[f])))
      return !0;
  }
  return !1;
}
const bg = (a) => !a.props.disabled && (/^(button|input|select|textarea)$/.test(a.tagName) || a.tagName === "a" && a.props.href != null || a.props.tabIndex != null);
function Vd(a, l) {
  for (const s of Wh(l.dangerouslySetInnerHTML?.__html, a.ownerDocument) ?? []) a.appendChild(s);
  return a;
}
const vg = {
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
  createInstance: (a, l, s) => Vd(new It(a, l, s.ownerDocument), l),
  createTextInstance: (a, l) => new Zr(a),
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
  commitUpdate: (a, l, s, i) => {
    if (a.props = i, a.inline) for (const o of Object.keys(a.inline)) s.style?.[o] !== i.style?.[o] && delete a.inline[o];
    if (s.dangerouslySetInnerHTML?.__html !== i.dangerouslySetInnerHTML?.__html) {
      for (const o of [...a.childNodes]) a.removeChild(o);
      Vd(a, i);
    }
    gg(s, i) && a.touch();
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
  bindToConsole: (a, l) => Function.prototype.bind.call(console[a], console, ...l)
}, ze = b0(vg), Jr = (a, l, s = null) => ze.createPortal(a, l, null, s), yg = {
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
}, xg = /* @__PURE__ */ new Set(["click", "dblclick", "mousedown", "mouseup"]), wg = /* @__PURE__ */ new Set(["button", "input", "select", "textarea", "fieldset"]), _g = (a) => {
  for (let l = a; l instanceof It; l = l.parentNode) if (l.props.disabled && wg.has(l.tagName)) return !0;
  return !1;
};
class Sg {
  constructor(l, s, i) {
    Object.assign(this, { clientX: 0, clientY: 0, button: 0, buttons: 0, pointerType: "mouse", key: "", code: "", shiftKey: !1, metaKey: !1, ctrlKey: !1, altKey: !1, repeat: !1, isComposing: !1, keyCode: 0 }, s), this.type = l, this.target = i, this.currentTarget = null, this.defaultPrevented = !1, this.propagationStopped = !1, this.timeStamp = Date.now();
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
function Mr(a, l, s) {
  l.currentTarget = a;
  for (const { type: i, listener: o, capture: d } of [...a.listeners ?? []])
    i === l.type && d === s && o.call(a, l);
  if (a instanceof It) {
    const i = yg[l.type], o = i && a.props[s ? `${i}Capture` : i];
    typeof o == "function" && o(l);
  }
}
function ay(a, l, s = {}) {
  const { document: i, window: o, globals: d } = t0(a), m = new It("div", { id: "root", style: s.container ?? {} }, i);
  i.body.appendChild(m);
  const f = [];
  let h = null;
  const x = () => [i, o].map((D) => D.listeners.map((g) => `${g.type}:${g.capture}`).sort().join(",")).join("|");
  let S = "";
  const k = {}, y = `m${Math.random().toString(36).slice(2, 10)}:`;
  let w = 0, N = -1;
  i.measureKey = (D) => y + D.id, i.stale = () => N !== w, i.computed = (D) => {
    if (!k.cascade || !k.top) return null;
    const g = [];
    for (let v = D; v instanceof It && v !== i.body; v = v.parentNode) g.unshift(v);
    let p = k.top;
    for (const v of g) p = k.cascade.compute(v, p);
    return p.values;
  };
  const _ = () => (w += 1, h = fg(i, a, hg(), k, s.names), S = x(), a.render?.(h), h), E = () => {
    ze.flushPassiveEffects(), ze.flushSyncWork(), x() !== S && _();
  };
  i.afterCommit = _;
  const O = (D) => {
    f.push(D), a.error?.(D);
  }, R = ze.createContainer(m, El.ConcurrentRoot, null, !1, null, "", O, O, O, null);
  ze.updateContainerSync(dt.createElement(l, s.props ?? {}), R, null, null), ze.flushSyncWork(), E();
  const A = (D) => {
    const g = (p) => {
      if (p.id === D) return p;
      for (const v of p.children) {
        const z = g(v);
        if (z) return z;
      }
      return null;
    };
    return g(i.documentElement);
  }, L = (D) => {
    const g = sa;
    sa = El.DiscreteEventPriority;
    try {
      return D();
    } finally {
      sa = g, ze.flushSyncWork(), E();
    }
  }, q = {
    document: i,
    window: o,
    /** What `window`, `document` and `localStorage` read while this screen runs (`dom.mjs`'s `GLOBALS`). */
    globals: d,
    container: m,
    errors: f,
    /** The latest description (after the last commit or state change). */
    get description() {
      return h;
    },
    describe: _,
    /** Runs a DOM event of `type` at node `id`; false when the node is gone. */
    dispatch(D, g, p = {}) {
      const v = typeof D == "string" ? A(D) : D;
      if (!v || xg.has(g) && _g(v)) return !1;
      const z = new Sg(g, p, v), M = [];
      for (let $ = v; $; $ = $.parentNode) M.push($);
      const H = [...M, i, o];
      L(() => {
        for (let $ = H.length - 1; $ > 0 && !z.propagationStopped; $--) Mr(H[$], z, !0);
        z.propagationStopped || (Mr(v, z, !0), z.propagationStopped || Mr(v, z, !1));
        for (let $ = 1; $ < H.length && !z.propagationStopped; $++) Mr(H[$], z, !1);
      });
      const V = g === "click" && !z.defaultPrevented ? Jo(v) : null;
      if (V && q.dispatch(V, "submit", {}), g === "click" && !z.defaultPrevented)
        for (let $ = v; $; $ = $.parentNode) {
          if ($.tagName !== "a") continue;
          const tt = $.props?.href;
          typeof tt == "string" && /^https:\/\/\S+$/.test(tt) && a.openLink?.(tt);
          break;
        }
      return !z.defaultPrevented;
    },
    /** Whether the source listens for `type` on `window` or `document` (a page recording a key press does). */
    listensFor: (D) => [i, o].some((g) => g.listeners.some((p) => p.type === D)),
    /** A key pressed while the screen has the keyboard (`init`: the DOM's `key`, modifiers, `repeat`), at the
     * focused element. When nothing prevented it and that element is a text field, the key edits the field as a
     * browser would: a character is typed at the end (or replaces the text when all of it is selected), Backspace
     * deletes the last one, and the field gets `input` and `change` events with its new `value`. Returns whether the
     * source took the key (prevented it, or a field changed). */
    key(D) {
      const g = i.activeElement && i.activeElement !== i.body ? i.activeElement : i.body;
      if (!q.dispatch(g, "keydown", D)) return !0;
      const v = D.key === "Enter" && !D.isComposing ? Jo(g, !0) : null;
      if (v)
        return q.dispatch(v, "submit", {}), !0;
      if (!xf(g) || g.props.disabled || g.props.readOnly) return !1;
      if ((D.ctrlKey || D.metaKey) && !D.altKey && !D.shiftKey && D.key.toLowerCase() === "a")
        return g.selectedAll = !0, !0;
      if (D.ctrlKey || D.metaKey) return !1;
      const z = g.selectedAll;
      g.selectedAll = !1;
      const M = g.value, V = D.key === "Backspace" || z && D.key === "Delete" ? z ? "" : M.slice(0, -1) : [...D.key].length === 1 ? (z ? "" : M) + D.key : M;
      return V === M ? !1 : (g.value = V, q.dispatch(g, "input", { data: D.key }), q.dispatch(g, "change", {}), g.props.value !== void 0 && delete g.edit, g.touch(), _(), !0);
    },
    /** The engine's box for node `id` (window coordinates, logical px), for `getBoundingClientRect`. */
    setBounds(D, g) {
      const p = A(D);
      p && (p.bounds = { x: g.x, y: g.y, width: g.width, height: g.height });
    },
    /** A click on a check box or radio button (`id`): the `click` event, then, unless the source prevented it, the
     * box ticked as a browser ticks it (a radio button only on), with `input` and `change` events. */
    toggle(D) {
      const g = A(D);
      if (!g || g.props.disabled || !q.dispatch(D, "click", { button: 0, detail: 1 })) return;
      const p = g.props.type === "radio";
      p && g.checked || (g.checked = p ? !0 : !g.checked, q.dispatch(D, "input", {}), q.dispatch(D, "change", {}), g.props.checked !== void 0 && delete g.ticked, g.touch(), _());
    },
    /** A left click as the engine reports one: press then release on the same node. */
    click(D, g = {}) {
      const p = { button: 0, buttons: 1, pointerType: "mouse", ...g };
      for (const v of ["pointerdown", "mousedown", "pointerup", "mouseup", "click"]) q.dispatch(D, v, p);
    },
    /** The pointer entered (`on`) or left node `id` (one the description marks `track_hover`): its `:hover` state,
     * which a descendant's group variant reads. The element's own `hover:` styles are the engine's hover style. */
    /** Whether the pointer is over node `id`, as `hover` last said. */
    hovered: (D) => !!A(D)?.state.hover,
    hover(D, g) {
      const p = A(D);
      !p || p.state.hover === g || (p.state.hover = g, p.touch(), _());
    },
    focus(D) {
      const g = A(D);
      g && (L(() => {
        const p = i.activeElement;
        p && p !== g && p !== i.body && q.dispatch(p, "blur"), i.focus(g), q.dispatch(g, "focus");
      }), _());
    },
    /** A press at node `id` that nothing prevented: the browser's default focuses the element pressed. Only an element
     * that listens for keys (`onKeyDown`) is focused, so a press elsewhere leaves the keyboard where it was; the focus
     * is not `:focus-visible`, as after a pointer press in a browser. */
    // ponytail: a browser focuses every focusable element pressed; here only one with its own key handler, so a
    // screen's ordinary buttons do not take the keyboard from a terminal.
    pressFocus(D) {
      let p = typeof D == "string" ? A(D) : D;
      for (; p && !(p instanceof It && typeof p.props.onKeyDown == "function" && bg(p)); ) p = p.parentNode;
      !p || p === i.activeElement || (q.focus(p.id), p.state.pointerFocus = !0, p.touch(), _());
    },
    /** The engine is drawing the latest description: the boxes measured in this frame's layout are the tree's.
     * Returns whether effects wait for that layout (`measured`); run them with `retry` once the frame is drawn. */
    drawing() {
      return N = w, i.retries.length > 0;
    },
    /** Runs the effects that waited for a fresh layout. */
    retry() {
      const D = i.retries.splice(0);
      for (const g of D) g();
    },
    /** Runs effects React has scheduled (the engine calls it after a frame). */
    flush: E,
    update(D) {
      ze.updateContainerSync(dt.createElement(l, D ?? {}), R, null, null), ze.flushSyncWork(), E();
    },
    unmount() {
      ze.updateContainerSync(null, R, null, null), ze.flushSyncWork(), ze.flushPassiveEffects(), i.afterCommit = null, i.retries.length = 0, a.forgetBounds?.(y);
    }
  };
  return q;
}
//! `react-dom` for a screen on the native renderer: `createPortal` (into `document.body`, the overlay layer) and
//! `flushSync`. Nothing of the browser renderer.
const Of = (a) => ze.flushSyncFromReconciler(a), kg = { createPortal: Jr, flushSync: Of }, ly = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  createPortal: Jr,
  default: kg,
  flushSync: Of
}, Symbol.toStringTag, { value: "Module" }));
function Rf(a) {
  var l, s, i = "";
  if (typeof a == "string" || typeof a == "number") i += a;
  else if (typeof a == "object") if (Array.isArray(a)) {
    var o = a.length;
    for (l = 0; l < o; l++) a[l] && (s = Rf(a[l])) && (i && (i += " "), i += s);
  } else for (s in a) a[s] && (i && (i += " "), i += s);
  return i;
}
function Df() {
  for (var a, l, s = 0, i = "", o = arguments.length; s < o; s++) (a = arguments[s]) && (l = Rf(a)) && (i && (i += " "), i += l);
  return i;
}
const Eg = (a, l) => {
  const s = new Array(a.length + l.length);
  for (let i = 0; i < a.length; i++)
    s[i] = a[i];
  for (let i = 0; i < l.length; i++)
    s[a.length + i] = l[i];
  return s;
}, zg = (a, l) => ({
  classGroupId: a,
  validator: l
}), Bf = (a = /* @__PURE__ */ new Map(), l = null, s) => ({
  nextPart: a,
  validators: l,
  classGroupId: s
}), Qr = "-", Xd = [], Ng = "arbitrary..", Tg = (a) => {
  const l = Mg(a), {
    conflictingClassGroups: s,
    conflictingClassGroupModifiers: i
  } = a;
  return {
    getClassGroupId: (m) => {
      if (m.startsWith("[") && m.endsWith("]"))
        return Cg(m);
      const f = m.split(Qr), h = f[0] === "" && f.length > 1 ? 1 : 0;
      return Hf(f, h, l);
    },
    getConflictingClassGroupIds: (m, f) => {
      if (f) {
        const h = i[m], x = s[m];
        return h ? x ? Eg(x, h) : h : x || Xd;
      }
      return s[m] || Xd;
    }
  };
}, Hf = (a, l, s) => {
  if (a.length - l === 0)
    return s.classGroupId;
  const o = a[l], d = s.nextPart.get(o);
  if (d) {
    const x = Hf(a, l + 1, d);
    if (x) return x;
  }
  const m = s.validators;
  if (m === null)
    return;
  const f = l === 0 ? a.join(Qr) : a.slice(l).join(Qr), h = m.length;
  for (let x = 0; x < h; x++) {
    const S = m[x];
    if (S.validator(f))
      return S.classGroupId;
  }
}, Cg = (a) => a.slice(1, -1).indexOf(":") === -1 ? void 0 : (() => {
  const l = a.slice(1, -1), s = l.indexOf(":"), i = l.slice(0, s);
  return i ? Ng + i : void 0;
})(), Mg = (a) => {
  const {
    theme: l,
    classGroups: s
  } = a;
  return Ag(s, l);
}, Ag = (a, l) => {
  const s = Bf();
  for (const i in a) {
    const o = a[i];
    vs(o, s, i, l);
  }
  return s;
}, vs = (a, l, s, i) => {
  const o = a.length;
  for (let d = 0; d < o; d++) {
    const m = a[d];
    jg(m, l, s, i);
  }
}, jg = (a, l, s, i) => {
  if (typeof a == "string") {
    Og(a, l, s);
    return;
  }
  if (typeof a == "function") {
    Rg(a, l, s, i);
    return;
  }
  Dg(a, l, s, i);
}, Og = (a, l, s) => {
  const i = a === "" ? l : Uf(l, a);
  i.classGroupId = s;
}, Rg = (a, l, s, i) => {
  if (Bg(a)) {
    vs(a(i), l, s, i);
    return;
  }
  l.validators === null && (l.validators = []), l.validators.push(zg(s, a));
}, Dg = (a, l, s, i) => {
  const o = Object.entries(a), d = o.length;
  for (let m = 0; m < d; m++) {
    const [f, h] = o[m];
    vs(h, Uf(l, f), s, i);
  }
}, Uf = (a, l) => {
  let s = a;
  const i = l.split(Qr), o = i.length;
  for (let d = 0; d < o; d++) {
    const m = i[d];
    let f = s.nextPart.get(m);
    f || (f = Bf(), s.nextPart.set(m, f)), s = f;
  }
  return s;
}, Bg = (a) => "isThemeGetter" in a && a.isThemeGetter === !0, Hg = (a) => {
  if (a < 1)
    return {
      get: () => {
      },
      set: () => {
      }
    };
  let l = 0, s = /* @__PURE__ */ Object.create(null), i = /* @__PURE__ */ Object.create(null);
  const o = (d, m) => {
    s[d] = m, l++, l > a && (l = 0, i = s, s = /* @__PURE__ */ Object.create(null));
  };
  return {
    get(d) {
      let m = s[d];
      if (m !== void 0)
        return m;
      if ((m = i[d]) !== void 0)
        return o(d, m), m;
    },
    set(d, m) {
      d in s ? s[d] = m : o(d, m);
    }
  };
}, rs = "!", Ld = ":", Ug = [], Zd = (a, l, s, i, o) => ({
  modifiers: a,
  hasImportantModifier: l,
  baseClassName: s,
  maybePostfixModifierPosition: i,
  isExternal: o
}), qg = (a) => {
  const {
    prefix: l,
    experimentalParseClassName: s
  } = a;
  let i = (o) => {
    const d = [];
    let m = 0, f = 0, h = 0, x;
    const S = o.length;
    for (let _ = 0; _ < S; _++) {
      const E = o[_];
      if (m === 0 && f === 0) {
        if (E === Ld) {
          d.push(o.slice(h, _)), h = _ + 1;
          continue;
        }
        if (E === "/") {
          x = _;
          continue;
        }
      }
      E === "[" ? m++ : E === "]" ? m-- : E === "(" ? f++ : E === ")" && f--;
    }
    const k = d.length === 0 ? o : o.slice(h);
    let y = k, w = !1;
    k.endsWith(rs) ? (y = k.slice(0, -1), w = !0) : (
      /**
       * In Tailwind CSS v3 the important modifier was at the start of the base class name. This is still supported for legacy reasons.
       * @see https://github.com/dcastil/tailwind-merge/issues/513#issuecomment-2614029864
       */
      k.startsWith(rs) && (y = k.slice(1), w = !0)
    );
    const N = x && x > h ? x - h : void 0;
    return Zd(d, w, y, N);
  };
  if (l) {
    const o = l + Ld, d = i;
    i = (m) => m.startsWith(o) ? d(m.slice(o.length)) : Zd(Ug, !1, m, void 0, !0);
  }
  if (s) {
    const o = i;
    i = (d) => s({
      className: d,
      parseClassName: o
    });
  }
  return i;
}, Yg = (a) => {
  const l = /* @__PURE__ */ new Map();
  return a.orderSensitiveModifiers.forEach((s, i) => {
    l.set(s, 1e6 + i);
  }), (s) => {
    const i = [];
    let o = [];
    for (let d = 0; d < s.length; d++) {
      const m = s[d], f = m[0] === "[", h = l.has(m);
      f || h ? (o.length > 0 && (o.sort(), i.push(...o), o = []), i.push(m)) : o.push(m);
    }
    return o.length > 0 && (o.sort(), i.push(...o)), i;
  };
}, Gg = (a) => ({
  cache: Hg(a.cacheSize),
  parseClassName: qg(a),
  sortModifiers: Yg(a),
  postfixLookupClassGroupIds: Kg(a),
  ...Tg(a)
}), Kg = (a) => {
  const l = /* @__PURE__ */ Object.create(null), s = a.postfixLookupClassGroups;
  if (s)
    for (let i = 0; i < s.length; i++)
      l[s[i]] = !0;
  return l;
}, Qg = /\s+/, Vg = (a, l) => {
  const {
    parseClassName: s,
    getClassGroupId: i,
    getConflictingClassGroupIds: o,
    sortModifiers: d,
    postfixLookupClassGroupIds: m
  } = l, f = [], h = a.trim().split(Qg);
  let x = "";
  for (let S = h.length - 1; S >= 0; S -= 1) {
    const k = h[S], {
      isExternal: y,
      modifiers: w,
      hasImportantModifier: N,
      baseClassName: _,
      maybePostfixModifierPosition: E
    } = s(k);
    if (y) {
      x = k + (x.length > 0 ? " " + x : x);
      continue;
    }
    let O = !!E, R;
    if (O) {
      const g = _.substring(0, E);
      R = i(g);
      const p = R && m[R] ? i(_) : void 0;
      p && p !== R && (R = p, O = !1);
    } else
      R = i(_);
    if (!R) {
      if (!O) {
        x = k + (x.length > 0 ? " " + x : x);
        continue;
      }
      if (R = i(_), !R) {
        x = k + (x.length > 0 ? " " + x : x);
        continue;
      }
      O = !1;
    }
    const A = w.length === 0 ? "" : w.length === 1 ? w[0] : d(w).join(":"), L = N ? A + rs : A, q = L + R;
    if (f.indexOf(q) > -1)
      continue;
    f.push(q);
    const D = o(R, O);
    for (let g = 0; g < D.length; ++g) {
      const p = D[g];
      f.push(L + p);
    }
    x = k + (x.length > 0 ? " " + x : x);
  }
  return x;
}, Xg = (...a) => {
  let l = 0, s, i, o = "";
  for (; l < a.length; )
    (s = a[l++]) && (i = qf(s)) && (o && (o += " "), o += i);
  return o;
}, qf = (a) => {
  if (typeof a == "string")
    return a;
  let l, s = "";
  for (let i = 0; i < a.length; i++)
    a[i] && (l = qf(a[i])) && (s && (s += " "), s += l);
  return s;
}, Lg = (a, ...l) => {
  let s, i, o, d;
  const m = (h) => {
    const x = l.reduce((S, k) => k(S), a());
    return s = Gg(x), i = s.cache.get, o = s.cache.set, d = f, f(h);
  }, f = (h) => {
    const x = i(h);
    if (x)
      return x;
    const S = Vg(h, s);
    return o(h, S), S;
  };
  return d = m, (...h) => d(Xg(...h));
}, Zg = [], Lt = (a) => {
  const l = (s) => s[a] || Zg;
  return l.isThemeGetter = !0, l.themeKey = a, l;
}, Yf = /^\[(?:(\w[\w-]*):)?(.+)\]$/i, Gf = /^\((?:(\w[\w-]*):)?(.+)\)$/i, Jg = /^\d+(?:\.\d+)?\/\d+(?:\.\d+)?$/, Wg = /^(\d+(\.\d+)?)?(xs|sm|md|lg|xl)$/, Fg = /\d+(%|px|r?em|[sdl]?v([hwib]|min|max)|pt|pc|in|cm|mm|cap|ch|ex|r?lh|cq(w|h|i|b|min|max))|\b(calc|min|max|clamp)\(.+\)|^0$/, Ig = /^(rgba?|hsla?|hwb|(ok)?(lab|lch)|color-mix|color|light-dark)\(.+\)$/, Pg = /^(inset_)?-?((\d+)?\.?(\d+)[a-z]+|0)_-?((\d+)?\.?(\d+)[a-z]+|0)/, $g = /^(url|image|image-set|cross-fade|element|(repeating-)?(linear|radial|conic)-gradient)\(.+\)$/, On = (a) => Jg.test(a), vt = (a) => !!a && !Number.isNaN(Number(a)), Je = (a) => !!a && Number.isInteger(Number(a)), Ko = (a) => a.endsWith("%") && vt(a.slice(0, -1)), fn = (a) => Wg.test(a), Kf = () => !0, tb = (a) => (
  // `colorFunctionRegex` check is necessary because color functions can have percentages in them which which would be incorrectly classified as lengths.
  // For example, `hsl(0 0% 0%)` would be classified as a length without this check.
  // I could also use lookbehind assertion in `lengthUnitRegex` but that isn't supported widely enough.
  Fg.test(a) && !Ig.test(a)
), ys = () => !1, eb = (a) => Pg.test(a), nb = (a) => $g.test(a), ab = (a) => !at(a) && !lt(a), lb = (a) => a.startsWith("@container") && (a[10] === "/" && a[11] !== void 0 || a[11] === "s" && a[16] !== void 0 && a.startsWith("-size/", 10) || a[11] === "n" && a[18] !== void 0 && a.startsWith("-normal/", 10)), rb = (a) => Gn(a, Xf, ys), at = (a) => Yf.test(a), oa = (a) => Gn(a, Lf, tb), Jd = (a) => Gn(a, mb, vt), ib = (a) => Gn(a, Jf, Kf), ob = (a) => Gn(a, Zf, ys), Wd = (a) => Gn(a, Qf, ys), sb = (a) => Gn(a, Vf, nb), Ar = (a) => Gn(a, Wf, eb), lt = (a) => Gf.test(a), yl = (a) => ua(a, Lf), cb = (a) => ua(a, Zf), Fd = (a) => ua(a, Qf), ub = (a) => ua(a, Xf), db = (a) => ua(a, Vf), jr = (a) => ua(a, Wf, !0), fb = (a) => ua(a, Jf, !0), Gn = (a, l, s) => {
  const i = Yf.exec(a);
  return i ? i[1] ? l(i[1]) : s(i[2]) : !1;
}, ua = (a, l, s = !1) => {
  const i = Gf.exec(a);
  return i ? i[1] ? l(i[1]) : s : !1;
}, Qf = (a) => a === "position" || a === "percentage", Vf = (a) => a === "image" || a === "url", Xf = (a) => a === "length" || a === "size" || a === "bg-size", Lf = (a) => a === "length", mb = (a) => a === "number", Zf = (a) => a === "family-name", Jf = (a) => a === "number" || a === "weight", Wf = (a) => a === "shadow", pb = () => {
  const a = Lt("color"), l = Lt("font"), s = Lt("text"), i = Lt("font-weight"), o = Lt("tracking"), d = Lt("leading"), m = Lt("breakpoint"), f = Lt("container"), h = Lt("spacing"), x = Lt("radius"), S = Lt("shadow"), k = Lt("inset-shadow"), y = Lt("text-shadow"), w = Lt("drop-shadow"), N = Lt("blur"), _ = Lt("perspective"), E = Lt("aspect"), O = Lt("ease"), R = Lt("animate"), A = () => ["auto", "avoid", "all", "avoid-page", "page", "left", "right", "column"], L = () => [
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
  ], q = () => [...L(), lt, at], D = () => ["auto", "hidden", "clip", "visible", "scroll"], g = () => ["auto", "contain", "none"], p = () => [lt, at, h], v = () => [On, "full", "auto", ...p()], z = () => [Je, "none", "subgrid", lt, at], M = () => ["auto", {
    span: ["full", Je, lt, at]
  }, Je, lt, at], H = () => [Je, "auto", lt, at], V = () => ["auto", "min", "max", "fr", lt, at], $ = () => ["start", "end", "center", "between", "around", "evenly", "stretch", "baseline", "center-safe", "end-safe"], tt = () => ["start", "end", "center", "stretch", "center-safe", "end-safe"], Q = () => ["auto", ...p()], Z = () => [On, "auto", "full", "dvw", "dvh", "lvw", "lvh", "svw", "svh", "min", "max", "fit", ...p()], I = () => [f, On, "screen", "full", "dvw", "lvw", "svw", "min", "max", "fit", ...p()], G = () => [On, "screen", "full", "lh", "dvh", "lvh", "svh", "min", "max", "fit", ...p()], K = () => [a, lt, at], T = () => [...L(), Fd, Wd, {
    position: [lt, at]
  }], X = () => ["no-repeat", {
    repeat: ["", "x", "y", "space", "round"]
  }], et = () => ["auto", "cover", "contain", ub, rb, {
    size: [lt, at]
  }], it = () => [Ko, yl, oa], ot = () => [
    // Deprecated since Tailwind CSS v4.0.0
    "",
    "none",
    "full",
    x,
    lt,
    at
  ], st = () => ["", vt, yl, oa], kt = () => ["solid", "dashed", "dotted", "double"], Zt = () => ["normal", "multiply", "screen", "overlay", "darken", "lighten", "color-dodge", "color-burn", "hard-light", "soft-light", "difference", "exclusion", "hue", "saturation", "color", "luminosity"], ht = () => [vt, Ko, Fd, Wd], Kn = () => [
    // Deprecated since Tailwind CSS v4.0.0
    "",
    "none",
    N,
    lt,
    at
  ], Qn = () => ["none", vt, lt, at], Re = () => ["none", vt, lt, at], De = () => [vt, lt, at], pn = () => [On, "full", ...p()];
  return {
    cacheSize: 500,
    theme: {
      animate: ["spin", "ping", "pulse", "bounce"],
      aspect: ["video"],
      blur: [fn],
      breakpoint: [fn],
      color: [Kf],
      container: [fn],
      "drop-shadow": [fn],
      ease: ["in", "out", "in-out"],
      font: [ab],
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
        aspect: ["auto", "square", On, at, lt, E]
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
      "container-named": [lb],
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
        "grid-cols": z()
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
        "grid-rows": z()
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
        "auto-cols": V()
      }],
      /**
       * Grid Auto Rows
       * @see https://tailwindcss.com/docs/grid-auto-rows
       */
      "auto-rows": [{
        "auto-rows": V()
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
        text: ["base", s, yl, oa]
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
        font: [i, fb, ib]
      }],
      /**
       * Font Stretch
       * @see https://tailwindcss.com/docs/font-stretch
       */
      "font-stretch": [{
        "font-stretch": ["ultra-condensed", "extra-condensed", "condensed", "semi-condensed", "normal", "semi-expanded", "expanded", "extra-expanded", "ultra-expanded", Ko, at]
      }],
      /**
       * Font Family
       * @see https://tailwindcss.com/docs/font-family
       */
      "font-family": [{
        font: [cb, ob, l]
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
        tracking: [o, lt, at]
      }],
      /**
       * Line Clamp
       * @see https://tailwindcss.com/docs/line-clamp
       */
      "line-clamp": [{
        "line-clamp": [vt, "none", lt, Jd]
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
        }, db, sb]
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
        outline: ["", vt, yl, oa]
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
          S,
          jr,
          Ar
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
        "inset-shadow": ["none", k, jr, Ar]
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
        "text-shadow": ["none", y, jr, Ar]
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
          w,
          jr,
          Ar
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
        ease: ["linear", "initial", O, lt, at]
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
        animate: ["none", R, lt, at]
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
        perspective: [_, lt, at]
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
        stroke: [vt, yl, oa, Jd]
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
}, hb = /* @__PURE__ */ Lg(pb);
function ue(...a) {
  return hb(Df(a));
}
function gb(a, l, s) {
  return a.filter((i, o) => o !== l && (i.start + i.end) / 2 < s).length;
}
function bb(a, l, s, i) {
  const o = a.map(() => 0), d = a[l];
  if (!d) return o;
  const m = a[l + 1], f = a[l - 1], h = d.end - d.start + (m ? m.start - d.end : f ? d.start - f.end : 0);
  return a.forEach((x, S) => {
    l < s && S > l && S <= s ? o[S] = -h : s < l && S >= s && S < l && (o[S] = h);
  }), o[l] = Math.min(Math.max(i, a[0].start - d.start), a[a.length - 1].end - d.end), o;
}
const Id = ["transform", "transition", "zIndex", "filter", "pointerEvents", "position"];
function vb(a, l) {
  for (let s = a.parentElement; s; s = s.parentElement) {
    const i = getComputedStyle(s)[l === "x" ? "overflowX" : "overflowY"];
    if ((i === "auto" || i === "scroll") && (l === "x" ? s.scrollWidth > s.clientWidth : s.scrollHeight > s.clientHeight)) return s;
  }
  return null;
}
function yb(a, l, s, i) {
  const o = a[l] ? vb(a[l], s) : null, d = () => o ? s === "x" ? o.scrollLeft : o.scrollTop : 0, m = (E) => (s === "x" ? E.clientX : E.clientY) + d(), f = m(i), h = d(), x = a.map((E) => {
    const O = E.getBoundingClientRect();
    return s === "x" ? { start: O.left + h, end: O.right + h } : { start: O.top + h, end: O.bottom + h };
  }), S = a.map((E) => Id.map((O) => E.style[O])), k = typeof matchMedia == "function" && matchMedia("(prefers-reduced-motion: reduce)").matches, y = s === "x" ? "translateX" : "translateY";
  let w = !1;
  const N = { to: l };
  a.forEach((E, O) => {
    if (E.style.pointerEvents = "none", O !== l) {
      k || (E.style.transition = "transform 160ms cubic-bezier(0.2, 0.8, 0.2, 1)");
      return;
    }
    getComputedStyle(E).position === "static" && (E.style.position = "relative"), E.style.zIndex = "30", E.style.filter = "drop-shadow(0 6px 10px rgba(0, 0, 0, 0.45))";
  });
  const _ = (E, O) => {
    N.to = E, bb(x, l, E, O).forEach((R, A) => {
      a[A].style.transform = R ? `${y}(${R}px)` : "";
    });
  };
  return {
    from: l,
    get to() {
      return N.to;
    },
    slot: (E) => gb(x, l, m(E)),
    apply: (E, O) => {
      w || _(E, m(O) - f);
    },
    rest: () => {
      w || _(l, 0);
    },
    end: () => {
      w || (w = !0, a.forEach((E, O) => Id.forEach((R, A) => {
        E.style[R] = S[O][A];
      })));
    }
  };
}
const xb = 5;
let Qo = !1;
function wb(a, l) {
  if (a.button !== 0 || Qo) return;
  const s = { clientX: a.clientX, clientY: a.clientY }, i = a.currentTarget, o = a.pointerId;
  let d = null, m, f = !1;
  const h = { cursor: document.body.style.cursor, userSelect: document.body.style.userSelect }, x = (N) => {
    if (f) return;
    f = !0, window.removeEventListener("pointermove", S), window.removeEventListener("pointerup", k), window.removeEventListener("pointercancel", y), window.removeEventListener("keydown", w, !0), window.removeEventListener("blur", y), i.removeEventListener("lostpointercapture", y);
    try {
      i.releasePointerCapture(o);
    } catch {
    }
    if (!d) return;
    Qo = !1, document.body.style.cursor = h.cursor, document.body.style.userSelect = h.userSelect, d.end();
    const _ = (E) => E.stopPropagation();
    window.addEventListener("click", _, { capture: !0, once: !0 }), setTimeout(() => window.removeEventListener("click", _, !0), 0), m?.(), l.onEnd(N, d);
  }, S = (N) => {
    if (!d) {
      if (Math.hypot(N.clientX - s.clientX, N.clientY - s.clientY) < xb) return;
      const _ = l.items();
      d = yb(_, l.from(_), l.axis, s), Qo = !0, document.body.style.cursor = "grabbing", document.body.style.userSelect = "none";
      try {
        i.setPointerCapture(o);
      } catch {
      }
      i.addEventListener("lostpointercapture", y);
      const E = l.onStart?.();
      m = typeof E == "function" ? E : void 0;
    }
    l.onMove(N, d);
  }, k = () => x(!0), y = () => x(!1), w = (N) => {
    N.key === "Escape" && (N.stopPropagation(), x(!1));
  };
  window.addEventListener("pointermove", S), window.addEventListener("pointerup", k), window.addEventListener("pointercancel", y), window.addEventListener("keydown", w, !0), window.addEventListener("blur", y);
}
const Ff = typeof navigator < "u" && /Mac/i.test(navigator.platform), Vr = {
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
const _b = Object.fromEntries(Object.entries(Vr).map(([a, l]) => [l, a])), Sb = {
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
function kb(a) {
  const l = /^Key([A-Z])$/.exec(a) ?? /^Digit(\d)$/.exec(a);
  return l ? l[1].toLowerCase() : _b[a];
}
const Pd = /* @__PURE__ */ new Map();
function If(a, l = Ff) {
  const s = `${l}|${a}`, i = Pd.get(s);
  if (i) return i;
  const o = { cmd: !1, ctrl: !1, shift: !1, alt: !1, code: "" };
  for (const d of a.split("+"))
    if (d === "mod")
      l ? o.cmd = !0 : (o.ctrl = !0, o.shift = !0);
    else if (d === "cmd" || d === "ctrl" || d === "shift" || d === "alt") o[d] = !0;
    else if (/^[a-z]$/.test(d))
      o.code = `Key${d.toUpperCase()}`, o.letter = d;
    else if (/^[0-9]$/.test(d)) o.code = `Digit${d}`;
    else if (Vr[d]) o.code = Vr[d];
    else throw new Error(`unknown key "${d}" in "${a}"`);
  if (!o.code) throw new Error(`no key in "${a}"`);
  return Pd.set(s, o), o;
}
new Set(["cmd+q", "cmd+h", "cmd+alt+h", "cmd+m", "cmd+ctrl+f", "cmd+z", "cmd+shift+z", "cmd+x", "cmd+c", "cmd+v", "cmd+a"].map((a) => {
  const l = If(a, !0);
  return [l.cmd && "cmd", l.ctrl && "ctrl", l.alt && "alt", l.shift && "shift", l.code].filter(Boolean).join("+");
}));
function Eb(a, l = Ff) {
  const s = If(a, l), i = zb(kb(s.code) ?? "");
  return l ? `${s.ctrl ? "⌃" : ""}${s.alt ? "⌥" : ""}${s.shift ? "⇧" : ""}${s.cmd ? "⌘" : ""}${i}` : [s.ctrl && "Ctrl", s.alt && "Alt", s.shift && "Shift", i].filter(Boolean).join("+");
}
const zb = (a) => Sb[a] ?? a.toUpperCase(), $d = (a) => typeof a == "boolean" ? `${a}` : a === 0 ? "0" : a, tf = Df, Wr = (a, l) => (s) => {
  var i;
  if (l?.variants == null) return tf(a, s?.class, s?.className);
  const { variants: o, defaultVariants: d } = l, m = Object.keys(o).map((x) => {
    const S = s?.[x], k = d?.[x];
    if (S === null) return null;
    const y = $d(S) || $d(k);
    return o[x][y];
  }), f = s && Object.entries(s).reduce((x, S) => {
    let [k, y] = S;
    return y === void 0 || (x[k] = y), x;
  }, {}), h = l == null || (i = l.compoundVariants) === null || i === void 0 ? void 0 : i.reduce((x, S) => {
    let { class: k, className: y, ...w } = S;
    return Object.entries(w).every((N) => {
      let [_, E] = N;
      return Array.isArray(E) ? E.includes({
        ...d,
        ...f
      }[_]) : {
        ...d,
        ...f
      }[_] === E;
    }) ? [
      ...x,
      k,
      y
    ] : x;
  }, []);
  return tf(a, m, h, s?.class, s?.className);
}, Nb = Wr(
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
), Tb = Wr(
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
function Cb({ className: a, ...l } = {}) {
  return ue(Tb(l), a);
}
const Pf = "shrink-0 cursor-pointer rounded-ui bg-transparent px-[0.2rem] py-[0.1rem] text-[0.8rem] leading-none text-subtext-0 [font-family:inherit] [border:none] [transition:color_0.1s_ease,background_0.1s_ease] hover:bg-surface-1 hover:text-accent", $f = "cursor-pointer rounded-ui bg-transparent text-subtext-0 [border:0] [font-family:inherit] [transition:color_0.1s_ease,background_0.1s_ease] hover:bg-surface-1 hover:text-fg focus-visible:bg-surface-1 focus-visible:text-fg disabled:cursor-not-allowed disabled:opacity-40", Mb = Wr(`${$f} shrink-0 focus-visible:[outline:2px_solid_var(--accent)] focus-visible:[outline-offset:-2px]`, {
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
function Ab({ className: a, ...l } = {}) {
  return ue(Mb(l), a);
}
const tm = "overflow-hidden rounded-ui bg-surface-1 py-[0.3rem] shadow-[0_8px_24px_rgba(0,0,0,0.45)]", jb = Wr(
  "pane-context-menu__item block w-full cursor-pointer bg-transparent px-[0.9rem] py-[0.45rem] text-left text-[0.82rem] [border:none] [font-family:inherit] [transition:background_0.1s_ease] hover:bg-surface-0 disabled:cursor-not-allowed disabled:bg-transparent disabled:opacity-40",
  { variants: { danger: { true: "text-red", false: "text-fg" } }, defaultVariants: { danger: !1 } }
), Ob = "my-1 h-px bg-overlay-0";
function Rb({ size: a = 14, className: l }) {
  return /* @__PURE__ */ ft.jsxs("svg", { className: l, width: a, height: a, viewBox: "0 0 16 16", fill: "currentColor", "aria-hidden": "true", children: [
    /* @__PURE__ */ ft.jsx("circle", { cx: "3.5", cy: "8", r: "1.1" }),
    /* @__PURE__ */ ft.jsx("circle", { cx: "8", cy: "8", r: "1.1" }),
    /* @__PURE__ */ ft.jsx("circle", { cx: "12.5", cy: "8", r: "1.1" })
  ] });
}
function Db({ size: a = 16, className: l }) {
  return /* @__PURE__ */ ft.jsxs("svg", { className: l, width: a, height: a, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: "1.3", strokeLinejoin: "round", "aria-hidden": "true", children: [
    /* @__PURE__ */ ft.jsx("path", { d: "M6.6 1.8h2.8l.4 1.6 1.1.6 1.5-.6 1.4 2.4-1.2 1.1v1.3l1.2 1.1-1.4 2.4-1.5-.6-1.1.6-.4 1.6H6.6l-.4-1.6-1.1-.6-1.5.6-1.4-2.4 1.2-1.1V7.3L2.2 6.2l1.4-2.4 1.5.6 1.1-.6z" }),
    /* @__PURE__ */ ft.jsx("circle", { cx: "8", cy: "8", r: "2" })
  ] });
}
function Bb({ size: a = 14, className: l }) {
  return /* @__PURE__ */ ft.jsx("svg", { className: l, width: a, height: a, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round", "aria-hidden": "true", children: /* @__PURE__ */ ft.jsx("path", { d: "M3.5 3.5l9 9M12.5 3.5l-9 9" }) });
}
function em({ size: a = 14, className: l }) {
  return /* @__PURE__ */ ft.jsx("svg", { className: l, width: a, height: a, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round", "aria-hidden": "true", children: /* @__PURE__ */ ft.jsx("path", { d: "M8 2.5v11M2.5 8h11" }) });
}
const ef = {
  connected: "host-state--connected bg-accent",
  connecting: "host-state--connecting animate-host-pulse bg-yellow",
  error: "host-state--error bg-red",
  disabled: "host-state--disabled bg-subtext-0"
};
function Hb({ state: a, error: l }) {
  return /* @__PURE__ */ ft.jsx(
    "span",
    {
      className: ue("host-state inline-block h-2 w-2 shrink-0 rounded-[50%]", ef[a] ?? ef.disabled),
      title: a === "error" && l ? l : a
    }
  );
}
function Ub({ title: a, onClose: l, children: s, testId: i }) {
  return Jr(
    /* @__PURE__ */ ft.jsx(
      "div",
      {
        className: "fixed inset-0 z-[2100] flex items-center justify-center bg-[rgba(0,0,0,0.55)]",
        onMouseDown: (o) => {
          o.target === o.currentTarget && l();
        },
        onKeyDown: (o) => {
          o.key === "Escape" && l();
        },
        children: /* @__PURE__ */ ft.jsxs(
          "div",
          {
            className: "grid max-h-[85vh] w-[min(30rem,92vw)] gap-[0.6rem] overflow-y-auto rounded-ui bg-panel-bg p-4 shadow-[0_8px_32px_rgba(0,0,0,0.5)]",
            role: "dialog",
            "aria-modal": "true",
            "aria-label": a,
            "data-testid": i,
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
const Or = 4, Rn = 8, qb = "flex w-full cursor-pointer items-center justify-between gap-3 px-[0.9rem] py-[0.4rem] text-left text-[0.82rem] text-fg max-[700px]:min-h-11 aria-disabled:cursor-not-allowed aria-disabled:opacity-40", nf = (a) => a.text ?? (typeof a.label == "string" ? a.label : a.value);
function Yb({ value: a, onChange: l, options: s, className: i, ariaLabel: o, testId: d, id: m, title: f, disabled: h, placeholder: x, freeText: S, onKeyDown: k }) {
  const y = dt.useId(), [w, N] = dt.useState(!1), [_, E] = dt.useState(-1), [O, R] = dt.useState(!1), A = dt.useRef(null), L = dt.useRef(null), [q, D] = dt.useState({}), g = dt.useRef({ text: "", at: 0 }), p = S && O && a ? s.filter((G) => nf(G).toLowerCase().includes(a.toLowerCase()) || G.value.toLowerCase().includes(a.toLowerCase())) : s, v = s.find((G) => G.value === a), z = (G) => `${y}-${G}`;
  function M(G) {
    h || (E(G), N(!0));
  }
  function H() {
    N(!1), R(!1), E(-1);
  }
  function V(G) {
    !G || G.disabled || (l(G.value), H());
  }
  function $(G, K) {
    for (let T = 1; T <= p.length; T++) {
      const X = (G + K * T + p.length * T) % p.length;
      if (!p[X].disabled) return X;
    }
    return G;
  }
  const tt = () => p.findIndex((G) => !G.disabled), Q = () => p.length - 1 - [...p].reverse().findIndex((G) => !G.disabled);
  Wo(() => {
    if (!w || !A.current) {
      D((et) => et.left === void 0 ? et : {});
      return;
    }
    const G = A.current.getBoundingClientRect(), K = window.innerHeight - G.bottom - Or - Rn, T = G.top - Or - Rn, X = K < 160 && T > K;
    D({
      position: "fixed",
      left: Math.min(Math.max(Rn, G.left), Math.max(Rn, window.innerWidth - G.width - Rn)),
      // As wide as its longest label (a session title, a path), never wider than the window.
      width: "max-content",
      minWidth: G.width,
      maxWidth: window.innerWidth - 2 * Rn,
      maxHeight: Math.min(X ? T : K, 320),
      ...X ? { bottom: window.innerHeight - G.top + Or } : { top: G.bottom + Or },
      overflowY: "auto"
    });
  }, [w, p.length]), Wo(() => {
    const G = L.current;
    if (!w || !G || q.left === void 0) return;
    const K = G.getBoundingClientRect().right, T = window.innerWidth - Rn;
    K > T && D((X) => ({ ...X, left: Math.max(Rn, Number(X.left) - (K - T)) }));
  }, [w, q]), Fe(() => {
    if (!w) return;
    const G = (K) => {
      const T = K.target;
      (T === document || T instanceof Node && A.current && T.contains(A.current)) && H();
    };
    return window.addEventListener("resize", H), window.addEventListener("scroll", G, !0), () => {
      window.removeEventListener("resize", H), window.removeEventListener("scroll", G, !0);
    };
  }, [w]), Fe(() => {
    const G = w && _ >= 0 ? document.getElementById(z(_)) : null, K = L.current;
    !G || !K || (G.offsetTop < K.scrollTop ? K.scrollTop = G.offsetTop : G.offsetTop + G.offsetHeight > K.scrollTop + K.clientHeight && (K.scrollTop = G.offsetTop + G.offsetHeight - K.clientHeight));
  }, [w, _]), rm(w, (G) => {
    G || H();
  }, A, L);
  function Z(G) {
    if (G.nativeEvent.isComposing) return;
    const K = () => {
      G.preventDefault(), G.stopPropagation();
    }, { key: T } = G;
    if (w) {
      if (T === "Escape") {
        K(), H();
        return;
      } else if (T === "Tab")
        H();
      else if (T === "ArrowDown" || T === "ArrowUp") {
        K(), p.length && E(_ < 0 ? T === "ArrowDown" ? tt() : Q() : $(_, T === "ArrowDown" ? 1 : -1));
        return;
      } else if (T === "Home" && !S) {
        K(), E(tt());
        return;
      } else if (T === "End" && !S) {
        K(), E(Q());
        return;
      } else if (T === "Enter" || T === " " && !S) {
        if (_ >= 0 && p[_]) {
          K(), V(p[_]);
          return;
        }
        if (!S) {
          K(), H();
          return;
        }
      } else if (!S && T.length === 1 && !G.metaKey && !G.ctrlKey && !G.altKey) {
        const X = Date.now();
        g.current = { text: (X - g.current.at > 600 ? "" : g.current.text) + T.toLowerCase(), at: X };
        const et = Math.max(_, 0), it = [...p.slice(et + (g.current.text.length === 1 ? 1 : 0)), ...p.slice(0, et + 1)].find((ot) => !ot.disabled && nf(ot).toLowerCase().startsWith(g.current.text));
        it && (K(), E(p.indexOf(it)));
        return;
      }
    } else if (T === "ArrowDown" || T === "ArrowUp" || !S && (T === "Enter" || T === " ")) {
      K(), M(Math.max(0, p.findIndex((X) => X.value === a)));
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
    disabled: h,
    "aria-label": o,
    "aria-expanded": w,
    "aria-controls": w ? y : void 0,
    "aria-activedescendant": w && _ >= 0 ? z(_) : void 0,
    "data-testid": d,
    onKeyDown: Z
  };
  return /* @__PURE__ */ ft.jsxs(ft.Fragment, { children: [
    S ? /* @__PURE__ */ ft.jsx(
      "input",
      {
        ...I,
        type: "text",
        role: "combobox",
        "aria-autocomplete": "list",
        autoComplete: "off",
        placeholder: x,
        className: i,
        value: a,
        onChange: (G) => {
          l(G.target.value), R(!0), w ? E(-1) : (E(-1), N(!0));
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
        className: ue("inline-flex items-center justify-between gap-2 text-left [font-family:inherit] cursor-pointer disabled:cursor-not-allowed disabled:opacity-50", i),
        onClick: () => w ? H() : M(Math.max(0, p.findIndex((G) => G.value === a))),
        children: [
          /* @__PURE__ */ ft.jsx("span", { className: "min-w-0 flex-1 truncate", children: v ? v.label : x ?? "" }),
          /* @__PURE__ */ ft.jsx(lm, { open: !0, className: "shrink-0 text-subtext-0" })
        ]
      }
    ),
    w && p.length > 0 && Jr(
      /* @__PURE__ */ ft.jsx(
        "div",
        {
          ref: L,
          id: y,
          role: "listbox",
          "aria-label": o,
          className: ue("z-[9999]", tm),
          style: q,
          onMouseDown: (G) => {
            G.preventDefault(), G.stopPropagation();
          },
          onClick: (G) => G.stopPropagation(),
          children: p.map((G, K) => /* @__PURE__ */ ft.jsxs(
            "div",
            {
              id: z(K),
              role: "option",
              "aria-selected": G.value === a,
              "aria-disabled": G.disabled || void 0,
              "data-value": G.value,
              className: ue(qb, K === _ && !G.disabled && "bg-surface-0"),
              onMouseEnter: () => {
                G.disabled || E(K);
              },
              onClick: () => V(G),
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
const Gb = "box-border min-h-[44px] cursor-pointer rounded-ui bg-transparent px-[0.7rem] py-[0.45rem] text-subtext-0 no-underline [border:0] [font-family:inherit] [font-weight:inherit] [line-height:inherit] text-[0.85rem] hover:bg-surface-1 hover:text-fg focus-visible:[outline:2px_solid_var(--accent)] focus-visible:[outline-offset:2px] disabled:cursor-default disabled:opacity-[0.55]", Kb = "m-0 mt-[0.4rem] text-[0.78rem] text-subtext-0", Qb = "m-0 mb-2 text-[0.82rem] text-subtext-0", nm = "rounded-ui bg-surface-1 text-fg [font-family:inherit]", xs = `${nm} px-2 py-[0.3rem] text-[0.8rem] max-[700px]:min-h-11 focus:[outline:1px_solid_var(--accent)]`, Vb = `${xs} min-w-[5.5rem] shrink-0`, ws = `${nm} min-w-0 px-[0.55rem] py-[0.35rem] text-[0.82rem] max-[700px]:min-h-11 focus:[outline:1px_solid_var(--accent)]`, Xb = `${ws} flex-1 max-[700px]:flex-[1_1_100%]`, Lb = `${ws} w-20 flex-[0_0_5rem] max-[700px]:w-24 max-[700px]:flex-[1_1_6rem]`, Zb = `${ws} flex-[1_1_100%]`, Jb = "flex flex-wrap items-center gap-[0.4rem]", Wb = "m-0 mb-2 flex list-none flex-col gap-[0.3rem] p-0", Fb = "flex items-center gap-2 max-[700px]:flex-wrap rounded-ui bg-surface-1 px-2 py-[0.35rem] text-[0.82rem]", Ib = `settings-modal__host-row ${Fb}`, Pb = "min-w-0 overflow-hidden font-semibold text-ellipsis whitespace-nowrap text-fg", $b = "min-w-0 flex-1 max-[700px]:basis-full overflow-hidden text-[0.78rem] text-ellipsis whitespace-nowrap text-subtext-0", am = "shrink-0 cursor-pointer rounded-ui px-[0.7rem] py-[0.35rem] max-[700px]:min-h-11 text-[0.82rem] font-semibold text-panel-bg [border:none] [font-family:inherit] [transition:opacity_0.12s_ease] hover:opacity-[0.85]", tv = `${am} bg-accent`, ev = `${am} ml-auto bg-red`;
function lm({ open: a, size: l = 12, className: s }) {
  return /* @__PURE__ */ ft.jsx("svg", { className: s, width: l, height: l, viewBox: "0 0 12 12", fill: "none", stroke: "currentColor", strokeWidth: "1.3", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true", children: /* @__PURE__ */ ft.jsx("path", { d: a ? "M2.5 4.5 6 8l3.5-3.5" : "M4.5 2.5 8 6l-3.5 3.5" }) });
}
function nv(a) {
  return a.blocked && !a.stale ? "blocked" : a.status === "running" && !a.stale ? "working" : a.unseen ? "done" : "idle";
}
const is = {
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
function os(a, l) {
  return !!a.parentSessionId && a.parentSessionId !== a.id && l.some((s) => s.id === a.parentSessionId);
}
function av(a) {
  const l = /* @__PURE__ */ new Map();
  for (const s of a)
    os(s, a) && l.set(s.parentSessionId, [...l.get(s.parentSessionId) ?? [], s]);
  return l.size ? a.filter((s) => !os(s, a)).flatMap((s) => [s, ...l.get(s.id) ?? []]) : a;
}
const Rr = 6, af = 8;
function lv(a, l = {}) {
  const { minWidth: s = 220, align: i = "right", minSpaceAbove: o = 100 } = l, d = a.getBoundingClientRect(), m = window.innerWidth, f = window.innerHeight, h = i === "right" ? { right: Math.max(0, m - d.right) } : { left: Math.max(0, d.left) }, x = d.top - Rr - af, S = f - d.bottom - Rr - af;
  return x >= o ? {
    position: "fixed",
    bottom: f - d.top + Rr,
    ...h,
    minWidth: s,
    maxHeight: Math.min(x, f * 0.75),
    overflowY: "auto"
  } : {
    position: "fixed",
    top: d.bottom + Rr,
    ...h,
    minWidth: s,
    maxHeight: Math.min(S, f * 0.75),
    overflowY: "auto"
  };
}
function rm(a, l, s, i) {
  Fe(() => {
    if (!a) return;
    function o(m) {
      const f = m.target, h = s.current?.contains(f) ?? !1, x = i.current?.contains(f) ?? !1;
      !h && !x && l(!1);
    }
    function d(m) {
      m.key === "Escape" && l(!1);
    }
    return document.addEventListener("mousedown", o), document.addEventListener("keydown", d), () => {
      document.removeEventListener("mousedown", o), document.removeEventListener("keydown", d);
    };
  }, [a]);
}
function rv({ icon: a, fallback: l }) {
  const [s, i] = dt.useState(!1);
  return Fe(() => i(!1), [a]), !a || s ? /* @__PURE__ */ ft.jsx(ft.Fragment, { children: l }) : /* @__PURE__ */ ft.jsx("img", { src: a, alt: "", width: 14, height: 14, className: "size-[14px] rounded-[2px] object-contain", referrerPolicy: "no-referrer", onError: () => i(!0) });
}
const iv = "mode-switch group ml-auto flex items-center gap-[0.4rem] bg-transparent p-[0.2rem] [border:none] [font-family:inherit]", im = "text-[0.72rem] font-semibold tracking-[0.03em] text-overlay-1 uppercase [transition:color_0.15s_ease]", ov = `${im} group-aria-[checked=false]:text-accent`, sv = `${im} group-aria-checked:text-accent`, cv = "relative h-[1.3rem] w-[2.4rem] shrink-0 rounded-[999px] border border-overlay-0 bg-surface-1 [transition:background_0.15s_ease] group-aria-checked:border-accent group-aria-checked:bg-panel-bg", uv = "absolute top-px left-px h-[1.1rem] w-[1.1rem] rounded-[50%] bg-fg [box-shadow:0_1px_2px_rgba(0,0,0,0.3)] [transition:transform_0.15s_ease,background_0.15s_ease] group-aria-checked:bg-accent group-aria-checked:[transform:translateX(1.1rem)]";
function dv({
  mode: a,
  onChange: l,
  testId: s = "mode-switch",
  disabled: i = !1
}) {
  const o = a === "cli";
  return /* @__PURE__ */ ft.jsxs(
    "button",
    {
      type: "button",
      className: iv,
      "data-testid": s,
      role: "switch",
      "aria-checked": o,
      "aria-label": "Toggle UI / CLI mode",
      disabled: i,
      onClick: () => l(o ? "ui" : "cli"),
      children: [
        /* @__PURE__ */ ft.jsx("span", { className: ue("mode-switch__label mode-switch__label--ui", ov), children: "UI" }),
        /* @__PURE__ */ ft.jsx("span", { className: ue("mode-switch__track", cv), children: /* @__PURE__ */ ft.jsx("span", { className: ue("mode-switch__thumb", uv) }) }),
        /* @__PURE__ */ ft.jsx("span", { className: ue("mode-switch__label mode-switch__label--cli", sv), children: "CLI" })
      ]
    }
  );
}
const Ya = function(a, l) {
  let o = a;
  const d = wl[l];
  let m = null, f = 0, h = null;
  const x = [], S = {}, k = function(g, p) {
    f = o * 4 + 17, m = (function(v) {
      const z = new Array(v);
      for (let M = 0; M < v; M += 1) {
        z[M] = new Array(v);
        for (let H = 0; H < v; H += 1)
          z[M][H] = null;
      }
      return z;
    })(f), y(0, 0), y(f - 7, 0), y(0, f - 7), _(), N(), O(g, p), o >= 7 && E(g), h == null && (h = L(o, d, x)), R(h, p);
  }, y = function(g, p) {
    for (let v = -1; v <= 7; v += 1)
      if (!(g + v <= -1 || f <= g + v))
        for (let z = -1; z <= 7; z += 1)
          p + z <= -1 || f <= p + z || (0 <= v && v <= 6 && (z == 0 || z == 6) || 0 <= z && z <= 6 && (v == 0 || v == 6) || 2 <= v && v <= 4 && 2 <= z && z <= 4 ? m[g + v][p + z] = !0 : m[g + v][p + z] = !1);
  }, w = function() {
    let g = 0, p = 0;
    for (let v = 0; v < 8; v += 1) {
      k(!0, v);
      const z = Bn.getLostPoint(S);
      (v == 0 || g > z) && (g = z, p = v);
    }
    return p;
  }, N = function() {
    for (let g = 8; g < f - 8; g += 1)
      m[g][6] == null && (m[g][6] = g % 2 == 0);
    for (let g = 8; g < f - 8; g += 1)
      m[6][g] == null && (m[6][g] = g % 2 == 0);
  }, _ = function() {
    const g = Bn.getPatternPosition(o);
    for (let p = 0; p < g.length; p += 1)
      for (let v = 0; v < g.length; v += 1) {
        const z = g[p], M = g[v];
        if (m[z][M] == null)
          for (let H = -2; H <= 2; H += 1)
            for (let V = -2; V <= 2; V += 1)
              H == -2 || H == 2 || V == -2 || V == 2 || H == 0 && V == 0 ? m[z + H][M + V] = !0 : m[z + H][M + V] = !1;
      }
  }, E = function(g) {
    const p = Bn.getBCHTypeNumber(o);
    for (let v = 0; v < 18; v += 1) {
      const z = !g && (p >> v & 1) == 1;
      m[Math.floor(v / 3)][v % 3 + f - 8 - 3] = z;
    }
    for (let v = 0; v < 18; v += 1) {
      const z = !g && (p >> v & 1) == 1;
      m[v % 3 + f - 8 - 3][Math.floor(v / 3)] = z;
    }
  }, O = function(g, p) {
    const v = d << 3 | p, z = Bn.getBCHTypeInfo(v);
    for (let M = 0; M < 15; M += 1) {
      const H = !g && (z >> M & 1) == 1;
      M < 6 ? m[M][8] = H : M < 8 ? m[M + 1][8] = H : m[f - 15 + M][8] = H;
    }
    for (let M = 0; M < 15; M += 1) {
      const H = !g && (z >> M & 1) == 1;
      M < 8 ? m[8][f - M - 1] = H : M < 9 ? m[8][15 - M - 1 + 1] = H : m[8][15 - M - 1] = H;
    }
    m[f - 8][8] = !g;
  }, R = function(g, p) {
    let v = -1, z = f - 1, M = 7, H = 0;
    const V = Bn.getMaskFunction(p);
    for (let $ = f - 1; $ > 0; $ -= 2)
      for ($ == 6 && ($ -= 1); ; ) {
        for (let tt = 0; tt < 2; tt += 1)
          if (m[z][$ - tt] == null) {
            let Q = !1;
            H < g.length && (Q = (g[H] >>> M & 1) == 1), V(z, $ - tt) && (Q = !Q), m[z][$ - tt] = Q, M -= 1, M == -1 && (H += 1, M = 7);
          }
        if (z += v, z < 0 || f <= z) {
          z -= v, v = -v;
          break;
        }
      }
  }, A = function(g, p) {
    let v = 0, z = 0, M = 0;
    const H = new Array(p.length), V = new Array(p.length);
    for (let Z = 0; Z < p.length; Z += 1) {
      const I = p[Z].dataCount, G = p[Z].totalCount - I;
      z = Math.max(z, I), M = Math.max(M, G), H[Z] = new Array(I);
      for (let et = 0; et < H[Z].length; et += 1)
        H[Z][et] = 255 & g.getBuffer()[et + v];
      v += I;
      const K = Bn.getErrorCorrectPolynomial(G), X = zl(H[Z], K.getLength() - 1).mod(K);
      V[Z] = new Array(K.getLength() - 1);
      for (let et = 0; et < V[Z].length; et += 1) {
        const it = et + X.getLength() - V[Z].length;
        V[Z][et] = it >= 0 ? X.getAt(it) : 0;
      }
    }
    let $ = 0;
    for (let Z = 0; Z < p.length; Z += 1)
      $ += p[Z].totalCount;
    const tt = new Array($);
    let Q = 0;
    for (let Z = 0; Z < z; Z += 1)
      for (let I = 0; I < p.length; I += 1)
        Z < H[I].length && (tt[Q] = H[I][Z], Q += 1);
    for (let Z = 0; Z < M; Z += 1)
      for (let I = 0; I < p.length; I += 1)
        Z < V[I].length && (tt[Q] = V[I][Z], Q += 1);
    return tt;
  }, L = function(g, p, v) {
    const z = lf.getRSBlocks(g, p), M = rf();
    for (let V = 0; V < v.length; V += 1) {
      const $ = v[V];
      M.put($.getMode(), 4), M.put($.getLength(), Bn.getLengthInBits($.getMode(), g)), $.write(M);
    }
    let H = 0;
    for (let V = 0; V < z.length; V += 1)
      H += z[V].dataCount;
    if (M.getLengthInBits() > H * 8)
      throw "code length overflow. (" + M.getLengthInBits() + ">" + H * 8 + ")";
    for (M.getLengthInBits() + 4 <= H * 8 && M.put(0, 4); M.getLengthInBits() % 8 != 0; )
      M.putBit(!1);
    for (; !(M.getLengthInBits() >= H * 8 || (M.put(236, 8), M.getLengthInBits() >= H * 8)); )
      M.put(17, 8);
    return A(M, z);
  };
  S.addData = function(g, p) {
    p = p || "Byte";
    let v = null;
    switch (p) {
      case "Numeric":
        v = fv(g);
        break;
      case "Alphanumeric":
        v = mv(g);
        break;
      case "Byte":
        v = pv(g);
        break;
      case "Kanji":
        v = hv(g);
        break;
      default:
        throw "mode:" + p;
    }
    x.push(v), h = null;
  }, S.isDark = function(g, p) {
    if (g < 0 || f <= g || p < 0 || f <= p)
      throw g + "," + p;
    return m[g][p];
  }, S.getModuleCount = function() {
    return f;
  }, S.make = function() {
    if (o < 1) {
      let g = 1;
      for (; g < 40; g++) {
        const p = lf.getRSBlocks(g, d), v = rf();
        for (let M = 0; M < x.length; M++) {
          const H = x[M];
          v.put(H.getMode(), 4), v.put(H.getLength(), Bn.getLengthInBits(H.getMode(), g)), H.write(v);
        }
        let z = 0;
        for (let M = 0; M < p.length; M++)
          z += p[M].dataCount;
        if (v.getLengthInBits() <= z * 8)
          break;
      }
      o = g;
    }
    k(!1, w());
  }, S.createTableTag = function(g, p) {
    g = g || 2, p = typeof p > "u" ? g * 4 : p;
    let v = "";
    v += '<table style="', v += " border-width: 0px; border-style: none;", v += " border-collapse: collapse;", v += " padding: 0px; margin: " + p + "px;", v += '">', v += "<tbody>";
    for (let z = 0; z < S.getModuleCount(); z += 1) {
      v += "<tr>";
      for (let M = 0; M < S.getModuleCount(); M += 1)
        v += '<td style="', v += " border-width: 0px; border-style: none;", v += " border-collapse: collapse;", v += " padding: 0px; margin: 0px;", v += " width: " + g + "px;", v += " height: " + g + "px;", v += " background-color: ", v += S.isDark(z, M) ? "#000000" : "#ffffff", v += ";", v += '"/>';
      v += "</tr>";
    }
    return v += "</tbody>", v += "</table>", v;
  }, S.createSvgTag = function(g, p, v, z) {
    let M = {};
    typeof arguments[0] == "object" && (M = arguments[0], g = M.cellSize, p = M.margin, v = M.alt, z = M.title), g = g || 2, p = typeof p > "u" ? g * 4 : p, v = typeof v == "string" ? { text: v } : v || {}, v.text = v.text || null, v.id = v.text ? v.id || "qrcode-description" : null, z = typeof z == "string" ? { text: z } : z || {}, z.text = z.text || null, z.id = z.text ? z.id || "qrcode-title" : null;
    const H = S.getModuleCount() * g + p * 2;
    let V, $, tt, Q, Z = "", I;
    for (I = "l" + g + ",0 0," + g + " -" + g + ",0 0,-" + g + "z ", Z += '<svg version="1.1" xmlns="http://www.w3.org/2000/svg"', Z += M.scalable ? "" : ' width="' + H + 'px" height="' + H + 'px"', Z += ' viewBox="0 0 ' + H + " " + H + '" ', Z += ' preserveAspectRatio="xMinYMin meet"', Z += z.text || v.text ? ' role="img" aria-labelledby="' + q([z.id, v.id].join(" ").trim()) + '"' : "", Z += ">", Z += z.text ? '<title id="' + q(z.id) + '">' + q(z.text) + "</title>" : "", Z += v.text ? '<description id="' + q(v.id) + '">' + q(v.text) + "</description>" : "", Z += '<rect width="100%" height="100%" fill="white" cx="0" cy="0"/>', Z += '<path d="', tt = 0; tt < S.getModuleCount(); tt += 1)
      for (Q = tt * g + p, V = 0; V < S.getModuleCount(); V += 1)
        S.isDark(tt, V) && ($ = V * g + p, Z += "M" + $ + "," + Q + I);
    return Z += '" stroke="transparent" fill="black"/>', Z += "</svg>", Z;
  }, S.createDataURL = function(g, p) {
    g = g || 2, p = typeof p > "u" ? g * 4 : p;
    const v = S.getModuleCount() * g + p * 2, z = p, M = v - p;
    return yv(v, v, function(H, V) {
      if (z <= H && H < M && z <= V && V < M) {
        const $ = Math.floor((H - z) / g), tt = Math.floor((V - z) / g);
        return S.isDark(tt, $) ? 0 : 1;
      } else
        return 1;
    });
  }, S.createImgTag = function(g, p, v) {
    g = g || 2, p = typeof p > "u" ? g * 4 : p;
    const z = S.getModuleCount() * g + p * 2;
    let M = "";
    return M += "<img", M += ' src="', M += S.createDataURL(g, p), M += '"', M += ' width="', M += z, M += '"', M += ' height="', M += z, M += '"', v && (M += ' alt="', M += q(v), M += '"'), M += "/>", M;
  };
  const q = function(g) {
    let p = "";
    for (let v = 0; v < g.length; v += 1) {
      const z = g.charAt(v);
      switch (z) {
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
          p += z;
          break;
      }
    }
    return p;
  }, D = function(g) {
    g = typeof g > "u" ? 2 : g;
    const v = S.getModuleCount() * 1 + g * 2, z = g, M = v - g;
    let H, V, $, tt, Q;
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
    let G = "";
    for (H = 0; H < v; H += 2) {
      for ($ = Math.floor((H - z) / 1), tt = Math.floor((H + 1 - z) / 1), V = 0; V < v; V += 1)
        Q = "█", z <= V && V < M && z <= H && H < M && S.isDark($, Math.floor((V - z) / 1)) && (Q = " "), z <= V && V < M && z <= H + 1 && H + 1 < M && S.isDark(tt, Math.floor((V - z) / 1)) ? Q += " " : Q += "█", G += g < 1 && H + 1 >= M ? I[Q] : Z[Q];
      G += `
`;
    }
    return v % 2 && g > 0 ? G.substring(0, G.length - v - 1) + Array(v + 1).join("▀") : G.substring(0, G.length - 1);
  };
  return S.createASCII = function(g, p) {
    if (g = g || 1, g < 2)
      return D(p);
    g -= 1, p = typeof p > "u" ? g * 2 : p;
    const v = S.getModuleCount() * g + p * 2, z = p, M = v - p;
    let H, V, $, tt;
    const Q = Array(g + 1).join("██"), Z = Array(g + 1).join("  ");
    let I = "", G = "";
    for (H = 0; H < v; H += 1) {
      for ($ = Math.floor((H - z) / g), G = "", V = 0; V < v; V += 1)
        tt = 1, z <= V && V < M && z <= H && H < M && S.isDark($, Math.floor((V - z) / g)) && (tt = 0), G += tt ? Q : Z;
      for ($ = 0; $ < g; $ += 1)
        I += G + `
`;
    }
    return I.substring(0, I.length - 1);
  }, S.renderTo2dContext = function(g, p) {
    p = p || 2;
    const v = S.getModuleCount();
    for (let z = 0; z < v; z++)
      for (let M = 0; M < v; M++)
        g.fillStyle = S.isDark(z, M) ? "black" : "white", g.fillRect(M * p, z * p, p, p);
  }, S;
};
Ya.stringToBytes = function(a) {
  const l = [];
  for (let s = 0; s < a.length; s += 1) {
    const i = a.charCodeAt(s);
    l.push(i & 255);
  }
  return l;
};
Ya.createStringToBytes = function(a, l) {
  const s = (function() {
    const o = bv(a), d = function() {
      const h = o.read();
      if (h == -1) throw "eof";
      return h;
    };
    let m = 0;
    const f = {};
    for (; ; ) {
      const h = o.read();
      if (h == -1) break;
      const x = d(), S = d(), k = d(), y = String.fromCharCode(h << 8 | x), w = S << 8 | k;
      f[y] = w, m += 1;
    }
    if (m != l)
      throw m + " != " + l;
    return f;
  })(), i = 63;
  return function(o) {
    const d = [];
    for (let m = 0; m < o.length; m += 1) {
      const f = o.charCodeAt(m);
      if (f < 128)
        d.push(f);
      else {
        const h = s[o.charAt(m)];
        typeof h == "number" ? (h & 255) == h ? d.push(h) : (d.push(h >>> 8), d.push(h & 255)) : d.push(i);
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
}, Dn = {
  PATTERN000: 0,
  PATTERN001: 1,
  PATTERN010: 2,
  PATTERN011: 3,
  PATTERN100: 4,
  PATTERN101: 5,
  PATTERN110: 6,
  PATTERN111: 7
}, Bn = (function() {
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
  ], l = 1335, s = 7973, i = 21522, o = {}, d = function(m) {
    let f = 0;
    for (; m != 0; )
      f += 1, m >>>= 1;
    return f;
  };
  return o.getBCHTypeInfo = function(m) {
    let f = m << 10;
    for (; d(f) - d(l) >= 0; )
      f ^= l << d(f) - d(l);
    return (m << 10 | f) ^ i;
  }, o.getBCHTypeNumber = function(m) {
    let f = m << 12;
    for (; d(f) - d(s) >= 0; )
      f ^= s << d(f) - d(s);
    return m << 12 | f;
  }, o.getPatternPosition = function(m) {
    return a[m - 1];
  }, o.getMaskFunction = function(m) {
    switch (m) {
      case Dn.PATTERN000:
        return function(f, h) {
          return (f + h) % 2 == 0;
        };
      case Dn.PATTERN001:
        return function(f, h) {
          return f % 2 == 0;
        };
      case Dn.PATTERN010:
        return function(f, h) {
          return h % 3 == 0;
        };
      case Dn.PATTERN011:
        return function(f, h) {
          return (f + h) % 3 == 0;
        };
      case Dn.PATTERN100:
        return function(f, h) {
          return (Math.floor(f / 2) + Math.floor(h / 3)) % 2 == 0;
        };
      case Dn.PATTERN101:
        return function(f, h) {
          return f * h % 2 + f * h % 3 == 0;
        };
      case Dn.PATTERN110:
        return function(f, h) {
          return (f * h % 2 + f * h % 3) % 2 == 0;
        };
      case Dn.PATTERN111:
        return function(f, h) {
          return (f * h % 3 + (f + h) % 2) % 2 == 0;
        };
      default:
        throw "bad maskPattern:" + m;
    }
  }, o.getErrorCorrectPolynomial = function(m) {
    let f = zl([1], 0);
    for (let h = 0; h < m; h += 1)
      f = f.multiply(zl([1, Un.gexp(h)], 0));
    return f;
  }, o.getLengthInBits = function(m, f) {
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
  }, o.getLostPoint = function(m) {
    const f = m.getModuleCount();
    let h = 0;
    for (let k = 0; k < f; k += 1)
      for (let y = 0; y < f; y += 1) {
        let w = 0;
        const N = m.isDark(k, y);
        for (let _ = -1; _ <= 1; _ += 1)
          if (!(k + _ < 0 || f <= k + _))
            for (let E = -1; E <= 1; E += 1)
              y + E < 0 || f <= y + E || _ == 0 && E == 0 || N == m.isDark(k + _, y + E) && (w += 1);
        w > 5 && (h += 3 + w - 5);
      }
    for (let k = 0; k < f - 1; k += 1)
      for (let y = 0; y < f - 1; y += 1) {
        let w = 0;
        m.isDark(k, y) && (w += 1), m.isDark(k + 1, y) && (w += 1), m.isDark(k, y + 1) && (w += 1), m.isDark(k + 1, y + 1) && (w += 1), (w == 0 || w == 4) && (h += 3);
      }
    for (let k = 0; k < f; k += 1)
      for (let y = 0; y < f - 6; y += 1)
        m.isDark(k, y) && !m.isDark(k, y + 1) && m.isDark(k, y + 2) && m.isDark(k, y + 3) && m.isDark(k, y + 4) && !m.isDark(k, y + 5) && m.isDark(k, y + 6) && (h += 40);
    for (let k = 0; k < f; k += 1)
      for (let y = 0; y < f - 6; y += 1)
        m.isDark(y, k) && !m.isDark(y + 1, k) && m.isDark(y + 2, k) && m.isDark(y + 3, k) && m.isDark(y + 4, k) && !m.isDark(y + 5, k) && m.isDark(y + 6, k) && (h += 40);
    let x = 0;
    for (let k = 0; k < f; k += 1)
      for (let y = 0; y < f; y += 1)
        m.isDark(y, k) && (x += 1);
    const S = Math.abs(100 * x / f / f - 50) / 5;
    return h += S * 10, h;
  }, o;
})(), Un = (function() {
  const a = new Array(256), l = new Array(256);
  for (let i = 0; i < 8; i += 1)
    a[i] = 1 << i;
  for (let i = 8; i < 256; i += 1)
    a[i] = a[i - 4] ^ a[i - 5] ^ a[i - 6] ^ a[i - 8];
  for (let i = 0; i < 255; i += 1)
    l[a[i]] = i;
  const s = {};
  return s.glog = function(i) {
    if (i < 1)
      throw "glog(" + i + ")";
    return l[i];
  }, s.gexp = function(i) {
    for (; i < 0; )
      i += 255;
    for (; i >= 256; )
      i -= 255;
    return a[i];
  }, s;
})(), zl = function(a, l) {
  if (typeof a.length > "u")
    throw a.length + "/" + l;
  const s = (function() {
    let o = 0;
    for (; o < a.length && a[o] == 0; )
      o += 1;
    const d = new Array(a.length - o + l);
    for (let m = 0; m < a.length - o; m += 1)
      d[m] = a[m + o];
    return d;
  })(), i = {};
  return i.getAt = function(o) {
    return s[o];
  }, i.getLength = function() {
    return s.length;
  }, i.multiply = function(o) {
    const d = new Array(i.getLength() + o.getLength() - 1);
    for (let m = 0; m < i.getLength(); m += 1)
      for (let f = 0; f < o.getLength(); f += 1)
        d[m + f] ^= Un.gexp(Un.glog(i.getAt(m)) + Un.glog(o.getAt(f)));
    return zl(d, 0);
  }, i.mod = function(o) {
    if (i.getLength() - o.getLength() < 0)
      return i;
    const d = Un.glog(i.getAt(0)) - Un.glog(o.getAt(0)), m = new Array(i.getLength());
    for (let f = 0; f < i.getLength(); f += 1)
      m[f] = i.getAt(f);
    for (let f = 0; f < o.getLength(); f += 1)
      m[f] ^= Un.gexp(Un.glog(o.getAt(f)) + d);
    return zl(m, 0).mod(o);
  }, i;
}, lf = (function() {
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
  ], l = function(o, d) {
    const m = {};
    return m.totalCount = o, m.dataCount = d, m;
  }, s = {}, i = function(o, d) {
    switch (d) {
      case wl.L:
        return a[(o - 1) * 4 + 0];
      case wl.M:
        return a[(o - 1) * 4 + 1];
      case wl.Q:
        return a[(o - 1) * 4 + 2];
      case wl.H:
        return a[(o - 1) * 4 + 3];
      default:
        return;
    }
  };
  return s.getRSBlocks = function(o, d) {
    const m = i(o, d);
    if (typeof m > "u")
      throw "bad rs block @ typeNumber:" + o + "/errorCorrectionLevel:" + d;
    const f = m.length / 3, h = [];
    for (let x = 0; x < f; x += 1) {
      const S = m[x * 3 + 0], k = m[x * 3 + 1], y = m[x * 3 + 2];
      for (let w = 0; w < S; w += 1)
        h.push(l(k, y));
    }
    return h;
  }, s;
})(), rf = function() {
  const a = [];
  let l = 0;
  const s = {};
  return s.getBuffer = function() {
    return a;
  }, s.getAt = function(i) {
    const o = Math.floor(i / 8);
    return (a[o] >>> 7 - i % 8 & 1) == 1;
  }, s.put = function(i, o) {
    for (let d = 0; d < o; d += 1)
      s.putBit((i >>> o - d - 1 & 1) == 1);
  }, s.getLengthInBits = function() {
    return l;
  }, s.putBit = function(i) {
    const o = Math.floor(l / 8);
    a.length <= o && a.push(0), i && (a[o] |= 128 >>> l % 8), l += 1;
  }, s;
}, fv = function(a) {
  const l = ce.MODE_NUMBER, s = a, i = {};
  i.getMode = function() {
    return l;
  }, i.getLength = function(m) {
    return s.length;
  }, i.write = function(m) {
    const f = s;
    let h = 0;
    for (; h + 2 < f.length; )
      m.put(o(f.substring(h, h + 3)), 10), h += 3;
    h < f.length && (f.length - h == 1 ? m.put(o(f.substring(h, h + 1)), 4) : f.length - h == 2 && m.put(o(f.substring(h, h + 2)), 7));
  };
  const o = function(m) {
    let f = 0;
    for (let h = 0; h < m.length; h += 1)
      f = f * 10 + d(m.charAt(h));
    return f;
  }, d = function(m) {
    if ("0" <= m && m <= "9")
      return m.charCodeAt(0) - 48;
    throw "illegal char :" + m;
  };
  return i;
}, mv = function(a) {
  const l = ce.MODE_ALPHA_NUM, s = a, i = {};
  i.getMode = function() {
    return l;
  }, i.getLength = function(d) {
    return s.length;
  }, i.write = function(d) {
    const m = s;
    let f = 0;
    for (; f + 1 < m.length; )
      d.put(
        o(m.charAt(f)) * 45 + o(m.charAt(f + 1)),
        11
      ), f += 2;
    f < m.length && d.put(o(m.charAt(f)), 6);
  };
  const o = function(d) {
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
  return i;
}, pv = function(a) {
  const l = ce.MODE_8BIT_BYTE, s = Ya.stringToBytes(a), i = {};
  return i.getMode = function() {
    return l;
  }, i.getLength = function(o) {
    return s.length;
  }, i.write = function(o) {
    for (let d = 0; d < s.length; d += 1)
      o.put(s[d], 8);
  }, i;
}, hv = function(a) {
  const l = ce.MODE_KANJI, s = Ya.stringToBytes;
  (function(d, m) {
    const f = s(d);
    if (f.length != 2 || (f[0] << 8 | f[1]) != m)
      throw "sjis not supported.";
  })("友", 38726);
  const i = s(a), o = {};
  return o.getMode = function() {
    return l;
  }, o.getLength = function(d) {
    return ~~(i.length / 2);
  }, o.write = function(d) {
    const m = i;
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
  }, o;
}, om = function() {
  const a = [], l = {};
  return l.writeByte = function(s) {
    a.push(s & 255);
  }, l.writeShort = function(s) {
    l.writeByte(s), l.writeByte(s >>> 8);
  }, l.writeBytes = function(s, i, o) {
    i = i || 0, o = o || s.length;
    for (let d = 0; d < o; d += 1)
      l.writeByte(s[d + i]);
  }, l.writeString = function(s) {
    for (let i = 0; i < s.length; i += 1)
      l.writeByte(s.charCodeAt(i));
  }, l.toByteArray = function() {
    return a;
  }, l.toString = function() {
    let s = "";
    s += "[";
    for (let i = 0; i < a.length; i += 1)
      i > 0 && (s += ","), s += a[i];
    return s += "]", s;
  }, l;
}, gv = function() {
  let a = 0, l = 0, s = 0, i = "";
  const o = {}, d = function(f) {
    i += String.fromCharCode(m(f & 63));
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
  return o.writeByte = function(f) {
    for (a = a << 8 | f & 255, l += 8, s += 1; l >= 6; )
      d(a >>> l - 6), l -= 6;
  }, o.flush = function() {
    if (l > 0 && (d(a << 6 - l), a = 0, l = 0), s % 3 != 0) {
      const f = 3 - s % 3;
      for (let h = 0; h < f; h += 1)
        i += "=";
    }
  }, o.toString = function() {
    return i;
  }, o;
}, bv = function(a) {
  const l = a;
  let s = 0, i = 0, o = 0;
  const d = {};
  d.read = function() {
    for (; o < 8; ) {
      if (s >= l.length) {
        if (o == 0)
          return -1;
        throw "unexpected end of file./" + o;
      }
      const h = l.charAt(s);
      if (s += 1, h == "=")
        return o = 0, -1;
      if (h.match(/^\s$/))
        continue;
      i = i << 6 | m(h.charCodeAt(0)), o += 6;
    }
    const f = i >>> o - 8 & 255;
    return o -= 8, f;
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
}, vv = function(a, l) {
  const s = a, i = l, o = new Array(a * l), d = {};
  d.setPixel = function(x, S, k) {
    o[S * s + x] = k;
  }, d.write = function(x) {
    x.writeString("GIF87a"), x.writeShort(s), x.writeShort(i), x.writeByte(128), x.writeByte(0), x.writeByte(0), x.writeByte(0), x.writeByte(0), x.writeByte(0), x.writeByte(255), x.writeByte(255), x.writeByte(255), x.writeString(","), x.writeShort(0), x.writeShort(0), x.writeShort(s), x.writeShort(i), x.writeByte(0);
    const S = 2, k = f(S);
    x.writeByte(S);
    let y = 0;
    for (; k.length - y > 255; )
      x.writeByte(255), x.writeBytes(k, y, 255), y += 255;
    x.writeByte(k.length - y), x.writeBytes(k, y, k.length - y), x.writeByte(0), x.writeString(";");
  };
  const m = function(x) {
    const S = x;
    let k = 0, y = 0;
    const w = {};
    return w.write = function(N, _) {
      if (N >>> _)
        throw "length over";
      for (; k + _ >= 8; )
        S.writeByte(255 & (N << k | y)), _ -= 8 - k, N >>>= 8 - k, y = 0, k = 0;
      y = N << k | y, k = k + _;
    }, w.flush = function() {
      k > 0 && S.writeByte(y);
    }, w;
  }, f = function(x) {
    const S = 1 << x, k = (1 << x) + 1;
    let y = x + 1;
    const w = h();
    for (let R = 0; R < S; R += 1)
      w.add(String.fromCharCode(R));
    w.add(String.fromCharCode(S)), w.add(String.fromCharCode(k));
    const N = om(), _ = m(N);
    _.write(S, y);
    let E = 0, O = String.fromCharCode(o[E]);
    for (E += 1; E < o.length; ) {
      const R = String.fromCharCode(o[E]);
      E += 1, w.contains(O + R) ? O = O + R : (_.write(w.indexOf(O), y), w.size() < 4095 && (w.size() == 1 << y && (y += 1), w.add(O + R)), O = R);
    }
    return _.write(w.indexOf(O), y), _.write(k, y), _.flush(), N.toByteArray();
  }, h = function() {
    const x = {};
    let S = 0;
    const k = {};
    return k.add = function(y) {
      if (k.contains(y))
        throw "dup key:" + y;
      x[y] = S, S += 1;
    }, k.size = function() {
      return S;
    }, k.indexOf = function(y) {
      return x[y];
    }, k.contains = function(y) {
      return typeof x[y] < "u";
    }, k;
  };
  return d;
}, yv = function(a, l, s) {
  const i = vv(a, l);
  for (let f = 0; f < l; f += 1)
    for (let h = 0; h < a; h += 1)
      i.setPixel(h, f, s(h, f));
  const o = om();
  i.write(o);
  const d = gv(), m = o.toByteArray();
  for (let f = 0; f < m.length; f += 1)
    d.writeByte(m[f]);
  return d.flush(), "data:image/gif;base64," + d;
};
Ya.stringToBytes;
function xv({ text: a }) {
  const { size: l, path: s } = dt.useMemo(() => {
    const i = Ya(0, "M");
    i.addData(a), i.make();
    const o = i.getModuleCount();
    let d = "";
    for (let m = 0; m < o; m++)
      for (let f = 0; f < o; f++) i.isDark(m, f) && (d += `M${f} ${m}h1v1h-1z`);
    return { size: o, path: d };
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
const Nl = dt.createContext(""), ss = (a, l) => typeof a == "string" && a.toLowerCase().includes(l);
function wv({ title: a, children: l, testId: s, ariaLabel: i }) {
  const o = dt.useContext(Nl), d = o !== "" && ss(a, o);
  return (
    // While searching, a group with no matching row (and no matching title) hides itself.
    /* @__PURE__ */ ft.jsxs("section", { className: o && !d ? "mb-8 not-has-[[data-setting-row]]:hidden" : "mb-8", "data-testid": s, "aria-label": i, children: [
      a && /* @__PURE__ */ ft.jsx("h3", { className: "m-0 mb-3 text-[0.9rem] font-medium text-fg", children: a }),
      /* @__PURE__ */ ft.jsx("div", { className: "rounded-ui bg-surface-0 px-4", children: /* @__PURE__ */ ft.jsx(Nl.Provider, { value: d ? "" : o, children: l }) })
    ] })
  );
}
function _v({ title: a, description: l, children: s, testId: i }) {
  const o = dt.useContext(Nl);
  return o && !ss(a, o) && !ss(l, o) ? null : /* @__PURE__ */ ft.jsxs("div", { "data-setting-row": !0, "data-testid": i, className: "flex items-center justify-between gap-6 py-[0.8rem] max-[700px]:flex-wrap max-[700px]:gap-y-2", children: [
    /* @__PURE__ */ ft.jsxs("div", { className: "min-w-0 max-[700px]:flex-1 max-[700px]:basis-56", children: [
      /* @__PURE__ */ ft.jsx("div", { className: "text-[0.85rem] text-fg", children: a }),
      l && /* @__PURE__ */ ft.jsx("div", { className: "mt-[0.15rem] text-[0.75rem] text-subtext-0", children: l })
    ] }),
    s && /* @__PURE__ */ ft.jsx("div", { className: "flex shrink-0 items-center gap-2", children: s })
  ] });
}
function Sv({ checked: a, onChange: l, testId: s, label: i }) {
  return /* @__PURE__ */ ft.jsx(
    "input",
    {
      type: "checkbox",
      role: "switch",
      "aria-label": i,
      "data-testid": s,
      checked: a,
      onChange: (o) => l(o.target.checked),
      className: "relative h-[1.25rem] w-[2.25rem] shrink-0 cursor-pointer appearance-none rounded-full bg-overlay-0 [transition:background_0.12s_ease] before:absolute before:top-[0.15rem] before:left-[0.15rem] before:h-[0.95rem] before:w-[0.95rem] before:rounded-full before:bg-fg before:content-[''] before:[transition:transform_0.12s_ease] checked:bg-accent checked:before:translate-x-[1rem] checked:before:bg-panel-bg focus-visible:[outline:2px_solid_var(--accent)] focus-visible:[outline-offset:2px]"
    }
  );
}
//! The Settings pages' shared parts for `@perch/sdk` 1.8 (`sdk.ts` re-exports and lists them). Each wraps the host
//! component or class string the pages are drawn with and owns no state. `SettingsGroup` and `SettingRow` are the
//! host's own, so the Settings search (`SettingsQuery`) filters a copy's rows exactly as it filters Perch's.
const kv = () => dt.useContext(Nl), Ev = {
  select: xs,
  selectHost: Vb,
  input: Xb,
  inputPort: Lb,
  inputWide: Zb,
  addRow: Jb,
  list: Wb,
  hostRow: Ib,
  name: Pb,
  addr: $b,
  muted: Kb,
  empty: Qb,
  primary: tv,
  danger: ev,
  catalogToggle: Gb
};
//! State the host keeps for a resource rather than for one view of it (`useResourceState`, `@perch/sdk` 1.4): a
//! review's unsent commit message and comment, its pending batch and its operation id, keyed by the screen's
//! own name for the resource (`review:<workspace>:commit`). Every view and copy that names the same key shares the
//! value, and it outlives a reload or swap of the screen's code, a released hidden copy and the phone/desktop
//! layouts trading places. In memory: a page reload starts empty (durable drafts live in their own services).
const zv = 512, We = /* @__PURE__ */ new Map(), Sl = /* @__PURE__ */ new Map();
function sm(a, l) {
  We.delete(a), We.set(a, l);
  for (const s of We.keys()) {
    if (We.size <= zv) break;
    Sl.get(s)?.size || We.delete(s);
  }
}
function Nv(a, l) {
  return We.has(a) ? We.get(a) : l;
}
function Tv(a, l, s) {
  const i = Nv(a, s), o = typeof l == "function" ? l(i) : l;
  if (!(We.has(a) && Object.is(o, i))) {
    sm(a, o);
    for (const d of [...Sl.get(a) ?? []]) d();
  }
}
function Cv(a, l) {
  if (typeof a != "string" || !a) throw new Error("useResourceState needs a non-empty key.");
  We.has(a) || sm(a, l);
  const s = dt.useCallback((d) => {
    const m = Sl.get(a) ?? /* @__PURE__ */ new Set();
    return Sl.set(a, m), m.add(d), () => {
      m.delete(d), m.size || Sl.delete(a);
    };
  }, [a]), i = dt.useSyncExternalStore(s, () => We.get(a)), o = dt.useCallback((d) => Tv(a, d, l), [a]);
  return [i, o];
}
const Mv = "[--radius:var(--radius-pane)] rounded-soft bg-surface-1/70 shadow-[0_6px_20px_rgba(0,0,0,0.3)] backdrop-blur-xl backdrop-saturate-150", Av = "hover:bg-transparent hover:text-subtext-0 active:bg-surface-1 active:text-fg";
//! `@perch/sdk` for the native client: the surface a stock screen imports (the navigation part, 1.3), with every
//! call going to one abstract host object, `globalThis.perch`, read when called (so a host or a test sets it before
//! mounting). Class helpers, icons, `cn`, `keyLabel` and the host dot are the app's own modules, compiled in, so the
//! classes are the web's to the character. Data hooks subscribe to `perch.subscribe` and read the host's snapshots
//! (`perch.navigation(options)`, `perch.hosts()`, ...), which must return the same object until the data changes.
//! Menus and dialogs Perch draws itself (session menu, new session menu, confirm, select, folder browser,
//! instructions, memory) open through `perch.openOverlay(kind, props)`; their callbacks are plain functions.
const jv = "1.3.0";
let Hr = null;
const Ov = (a) => {
  Hr = a;
};
function Tt() {
  const a = (typeof Hr == "function" ? Hr() : Hr) ?? globalThis.perch;
  if (!a) throw new Error("@perch/sdk: no perch host (globalThis.perch) is set");
  return a;
}
const Rv = (a) => Tt().subscribe?.(a) ?? (() => {
}), Dv = lv;
function Bv() {
  return typeof globalThis.crypto?.randomUUID == "function" ? globalThis.crypto.randomUUID() : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (a) => {
    const l = Math.floor(Math.random() * 16);
    return (a === "x" ? l : l & 3 | 8).toString(16);
  });
}
const Hv = globalThis.perch?.isMac !== !1, Uv = (a) => Eb(a, Tt().isMac !== !1), qv = (a) => Nb(a), Yv = ({ className: a, ...l } = {}) => ue(Cb(l), a), Gv = Ab, Kv = (a) => jb(a), Qv = Ob, Vv = $f, Xv = Pf, Lv = (a) => is[a].color, Zv = (a, l) => Tt().shortcutFor?.(a, l) ?? null, Jv = (a) => Tt().shortcutLabel?.(a) ?? null, Fr = (a, l) => Tt().command(a, l ?? {}) !== !1, Wv = (a, l, s) => Tt().startSession?.(a, l, s), Fv = globalThis.perch?.pickFolder ? (a) => Tt().pickFolder(a) : null;
function re(a) {
  const l = dt.useRef(a);
  return l.current = a, dt.useSyncExternalStore(Rv, () => l.current(Tt()));
}
const cm = (a = {}) => re((l) => l.navigation({ showTerminals: !!a.showTerminals, sortByAttention: !!a.sortByAttention })), Iv = () => re((a) => a.hosts()), Pv = () => re((a) => a.sessionFolders());
function $v() {
  const a = re((l) => l.addProject?.() ?? t1);
  return {
    status: a.status ?? "idle",
    error: a.error,
    hostId: a.hostId,
    add: (l, s, i) => {
      l.trim() && a.status !== "pending" && Tt().addProjectFolder?.(l, s, i);
    },
    clear: () => Tt().clearAddProject?.()
  };
}
const t1 = Object.freeze({ status: "idle" }), um = "perch.lastAgentChoice", e1 = Object.freeze({ connected: !1, discovery: !1, state: "ready", choices: [] }), n1 = () => {
  const a = Tt().storage?.getItem(um);
  return a === "claude" || a === "codex" ? a : "claude";
}, a1 = Object.freeze({ items: [] });
function l1() {
  const a = re((l) => l.notifications?.() ?? a1);
  return dt.useMemo(() => ({
    items: a.items ?? [],
    open: (l) => Tt().command("notification.open", { id: l }),
    dismiss: (l) => Tt().command("notification.dismiss", { id: l })
  }), [a]);
}
function r1(a) {
  const l = re((o) => o.agentChoices?.(a) ?? e1), [s, i] = dt.useState(n1);
  return dt.useMemo(() => ({
    connected: !!l.connected,
    discovery: !!l.discovery,
    choices: l.choices ?? [],
    lastChoice: s,
    state: l.state ?? "ready",
    error: l.state === "error" ? l.error : void 0,
    rememberChoice: (o) => {
      o !== "claude" && o !== "codex" || (Tt().storage?.setItem(um, o), i(o));
    },
    manage: () => Tt().command("agents.manage", {})
  }), [l, s]);
}
function i1(a) {
  Fe(() => Tt().onRequest?.("add-project", a) ?? void 0, [a]);
}
function o1(a) {
  const l = a.map((s) => ({ id: s.id, parentSessionId: s.parentId, session: s }));
  return av(l).map((s) => ({ session: s.session, nested: os(s, l) }));
}
function s1({ id: a, plain: l, className: s }) {
  const i = re((x) => x.session(a));
  if (!i) return null;
  const o = i.state ?? nv(i), d = is[o]?.color ?? is.unknown.color, m = i.provider, f = m === "claude" || m === "claude-agent-teams" || m === "omp", h = l ? ue("agent-mark", "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full leading-none", s) : ue("agent-status-dot", `agent-status-dot--${o}`, "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-[1.5px] bg-panel-bg leading-none", s);
  return dt.createElement(
    "span",
    { className: h, style: l ? void 0 : { borderColor: d }, "data-provider": m ?? "unknown", title: l ? m ?? "Agent" : `${m ?? "Agent"} · ${o}`, "aria-hidden": "true" },
    dt.createElement("span", { className: ue("inline-flex text-fg", f && "rounded-full bg-[#161616]") }, dt.createElement(dm, { provider: m, size: 14 }))
  );
}
function dm({ provider: a, size: l = 14 }) {
  const s = Tt().agentIcon?.(a, l) ?? null, i = s?.markup ?? '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><circle cx="8" cy="8" r="5" fill="currentColor"/></svg>';
  return dt.createElement("svg", { width: l, height: l, "aria-hidden": "true", "data-agent-icon": a ?? "unknown", "data-perch-markup": i, ...s && s.tint === !1 ? { "data-perch-image": "true" } : {} });
}
const c1 = ({ children: a }) => dt.createElement(dt.Fragment, null, a);
function u1(a, l) {
  const s = dt.useRef(l);
  return s.current = l, Fe(() => {
    const i = Tt();
    if (!i.openOverlay) throw new Error(`@perch/sdk: the host draws no overlays (perch.openOverlay), so ${a} cannot open`);
    const o = {};
    for (const [m, f] of Object.entries(s.current))
      o[m] = typeof f == "function" ? (...h) => s.current[m]?.(...h) : f;
    const d = i.openOverlay(a, o);
    return () => i.closeOverlay?.(d);
  }, [a]), null;
}
const da = (a) => function(s) {
  return u1(a, s);
}, d1 = da("session-menu"), f1 = da("new-session-menu"), m1 = da("confirm");
let fm = null;
const p1 = (a) => {
  fm = a;
};
function h1(a) {
  return dt.createElement(fm ?? m1, a);
}
function g1({ className: a = xs, ...l }) {
  return dt.createElement(Yb, { ...l, className: a });
}
let cs = null;
const b1 = (a) => {
  cs = a;
}, v1 = da("folder-browser");
function y1(a) {
  return cs ? dt.createElement(cs, { ...a, browse: (l) => Tt().browse(a.hostId, l) }) : dt.createElement(v1, a);
}
const x1 = da("instructions"), w1 = da("memory"), _1 = Ub;
let _s = null;
const S1 = (a) => {
  _s = a;
};
function k1(a) {
  if (_s) return dt.createElement(z1, a);
  const { hostId: l, path: s, className: i } = a, o = dt.useRef(null);
  return dt.createElement(
    "button",
    {
      type: "button",
      ref: o,
      className: ue("worktree-menu__btn", Pf, i),
      "data-testid": `worktree-menu-${l}-${s}`,
      title: "New workspace (a git worktree)",
      "aria-label": "New workspace",
      "aria-expanded": !1,
      onClick: () => Tt().openOverlay?.("worktree", { hostId: l, cwd: s, anchor: o.current?.getBoundingClientRect() })
    },
    dt.createElement(em, null)
  );
}
const mm = "Perch did not answer.";
function Dr(a) {
  return a ? a.type === "worktree.error" ? { error: a.message, dirty: !!a.dirty } : a.error ? { error: String(a.error) } : {} : { error: mm };
}
function E1(a, l, s = Tt()) {
  const i = (o) => {
    for (const d of o ?? []) {
      if (d.path === l) return d;
      const m = i(d.children);
      if (m) return m;
    }
    return null;
  };
  for (const o of s.navigation({})?.projects ?? []) {
    if (o.hostId !== a) continue;
    const d = i(o.workspaces) ?? i(o.hidden);
    if (d) return d;
  }
  return null;
}
const of = 5 * 6e4;
function pm(a, l, s, i = Tt()) {
  const o = Date.now() + of;
  let d = !1, m = () => {
  };
  const f = () => {
    d = !0, m(), clearTimeout(x);
  }, h = () => {
    if (!d) {
      if (Date.now() >= o) return f();
      E1(a, l, i) && (f(), i.startSession?.(a, l, s));
    }
  }, x = setTimeout(f, of);
  m = i.subscribe?.(h) ?? (() => {
  }), h();
}
function z1({ hostId: a, path: l, className: s, worktrees: i, request: o, parentChoices: d, emptyAgent: m, ...f }) {
  const [h, x] = dt.useState(i), S = (z) => !!Tt().coreCan?.(z, a), k = cm(), y = `${a}:${l}`, w = dt.useMemo(() => {
    if (Array.isArray(d)) return d;
    if (!S("workspace.nest")) return [];
    const z = k?.projects?.find((V) => V.hostId === a && V.repoPath === l), M = [], H = (V, $) => {
      for (const tt of V ?? [])
        $ && M.push({ id: tt.id, name: tt.name, path: tt.path }), H(tt.children, !0);
    };
    return H(z?.workspaces, !1), M;
  }, [d, k, a, l]), N = a === "local" && S("worktree.job"), _ = f.deleteSupported ?? S("worktree.delete"), E = f.startFromSupported ?? S("worktree.startFrom"), O = re((z) => z.emptyWorkspaceAgent?.() ?? void 0), R = m ?? O ?? void 0, A = re((z) => z.worktreeMenuRequest?.() ?? null), L = A?.projectKey === y ? A.nonce : null, q = dt.useMemo(() => o ?? (L == null ? null : A), [o, L]), [D, g] = dt.useState(q);
  Fe(() => {
    q && g(q);
  }, [q]);
  const p = dt.useRef({});
  p.current = { background: N, deleteSupported: _ };
  const v = dt.useMemo(() => {
    const z = (M, H) => Tt().ask(M, { hostId: a, repoPath: l, ...H });
    return {
      list: async () => {
        const M = await z("worktree.list", {});
        return M?.type === "worktree.list.result" && x({ worktrees: M.worktrees ?? [], defaultRoot: M.defaultRoot ?? "", baseRef: M.baseRef, refs: M.refs ?? [] }), Dr(M);
      },
      create: async ({ branch: M, newBranch: H, path: V, extra: $, agent: tt }) => {
        const Q = { branch: M, newBranch: !!H, path: V ?? null, name: $?.name ?? null, startFrom: $?.startFrom ?? null, parentWorkspaceId: $?.parentWorkspaceId ?? null }, { background: Z } = p.current, I = await z(Z ? "worktree.job.start" : "worktree.create", Q), G = Z ? "worktree.job.started" : "worktree.done";
        if (I?.type !== G) return { error: Dr(I).error ?? mm };
        const K = Z ? I.job?.path : I.path;
        return tt && K && pm(a, K, tt), { background: Z };
      },
      remove: async (M, H) => {
        const V = await z("worktree.remove", { path: M, force: !!H, deleteBranch: p.current.deleteSupported });
        return { ...Dr(V), preservedBranch: V?.type === "worktree.done" ? V.preservedBranch ?? void 0 : void 0 };
      },
      deleteBranch: async (M, H) => Dr(await z("worktree.branch.delete", { branch: M, expectedHead: H })),
      open: (M) => Tt().startSession?.(a, M, "terminal"),
      // The window forgets the request; the screen keeps it until a newer one, as clearing it would re-run (and so
      // cancel) the screen's effect that a measurement put off until the next frame (`measured`).
      takeRequest: () => Tt().takeWorktreeRequest?.()
    };
  }, [a, l]);
  return dt.createElement(_s, {
    hostId: a,
    cwd: l,
    projectKey: y,
    className: s,
    worktrees: h,
    background: N,
    startFromSupported: E,
    deleteSupported: _,
    parentChoices: w,
    emptyAgent: R,
    request: D,
    actions: v
  });
}
const N1 = (a, l) => {
  if (!Tt().followPointer?.(a)) return;
  const s = l.items();
  for (const i of s) i.getBoundingClientRect();
  s[0]?.parentElement?.getBoundingClientRect(), wb(a, l);
}, T1 = () => re((a) => a.workspaceTabs()), C1 = () => re((a) => a.statusLine()), M1 = () => re((a) => a.zoom()), A1 = () => re((a) => a.paneLook()), j1 = () => re((a) => a.keybindings?.() ?? []), O1 = Object.freeze({ usage: Object.freeze([]), updatedAt: 0, spend: null, redeemResult: null });
function R1(a) {
  const l = !!a?.keepFresh, s = re((o) => o.statusLine?.().connected ?? !1), i = re((o) => o.planUsage?.() ?? O1);
  return Fe(() => {
    if (!l || !s) return;
    let o;
    const d = () => {
      Tt().command("usage.get"), o = setTimeout(d, 18e4);
    };
    return d(), () => clearTimeout(o);
  }, [l, s]), i;
}
const D1 = () => Tt().command("usage.get", { force: !0 }), B1 = (a) => Tt().command("usage.redeemReset", { accountId: a }), H1 = () => Fr("app.zoom_reset"), U1 = {
  focused: "bg-[color-mix(in_srgb,var(--text)_10%,var(--panel-bg))] hover:bg-[color-mix(in_srgb,var(--text)_10%,var(--panel-bg))] text-fg font-semibold",
  visible: "bg-transparent text-subtext-0 hover:bg-surface-0 hover:text-fg",
  hidden: "bg-transparent text-subtext-0 hover:bg-surface-0 hover:text-fg"
}, q1 = (a, l, s) => Tt().beginTabDrag?.(a, l, s);
function Y1(a) {
  Fe(() => Tt().onRequest?.("new-tab", a) ?? void 0, [a]);
}
const G1 = (a) => Fr("browser.open", { workspaceId: a }), K1 = (a, l) => Fr("file.open", { workspaceId: a, path: l }), Q1 = () => null, V1 = () => null, X1 = da("new-file"), ry = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  AgentIcon: dm,
  Chevron: lm,
  CloseIcon: Bb,
  ConfirmDialog: h1,
  Dialog: _1,
  EllipsisIcon: Rb,
  FolderBrowser: y1,
  GearIcon: Db,
  HostStateDot: Hb,
  InstructionsDialog: x1,
  MemoryDialog: w1,
  ModeSwitch: dv,
  NewFilePrompt: X1,
  NewSessionMenu: f1,
  PageIcon: rv,
  PlusIcon: em,
  QrCode: xv,
  Select: g1,
  SessionDot: s1,
  SessionMenu: d1,
  SettingRow: _v,
  SettingsGroup: wv,
  SettingsQuery: Nl,
  Slot: c1,
  Switch: Sv,
  TabDragLayer: V1,
  TabMenu: Q1,
  WorktreeMenu: k1,
  agentStateColor: Lv,
  anchoredPopoverStyle: Dv,
  beginReorderDrag: N1,
  beginTabDrag: q1,
  bindHost: Ov,
  buttonClass: Gv,
  cn: ue,
  drawConfirmationsInPlace: p1,
  drawFolderBrowserInPlace: b1,
  drawWorktreeInPlace: S1,
  ghostButton: Vv,
  glassClass: Mv,
  iconButton: Xv,
  isMac: Hv,
  keyLabel: Uv,
  menuDividerClass: Qv,
  menuItemClass: Kv,
  menuPanel: tm,
  nestSessions: o1,
  newId: Bv,
  openBrowserTab: G1,
  openFileTab: K1,
  pickFolder: Fv,
  redeemUsageReset: B1,
  refreshUsage: D1,
  resetZoom: H1,
  rowActionClass: Yv,
  runCommand: Fr,
  segmentClass: qv,
  settingsClass: Ev,
  shortcutFor: Zv,
  shortcutLabel: Jv,
  startPaneWhenReady: pm,
  startSession: Wv,
  tabStateClass: U1,
  tapButtonClass: Av,
  useAddProject: $v,
  useAddProjectRequest: i1,
  useAgentChoices: r1,
  useDismissOnOutsideClick: rm,
  useHostSnapshot: re,
  useHosts: Iv,
  useKeybindings: j1,
  useNavigation: cm,
  useNewTabRequest: Y1,
  useNotifications: l1,
  usePaneLook: A1,
  usePlanUsage: R1,
  useResourceState: Cv,
  useSessionFolders: Pv,
  useSettingsQuery: kv,
  useStatusLine: C1,
  useWorkspaceTabs: T1,
  useZoom: M1,
  version: jv
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
//! files through an asset source the host may not have. An icon does not follow a hover colour (it is drawn once
//! per colour it is described with).
const Ss = {
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
  Ss[a] = (l, s) => l[a](s);
const iy = Object.keys(Ss);
function sf(a, l) {
  for (const [s, i] of Object.entries(l)) {
    const o = Ss[s];
    if (!o) throw new Error(`the description key ${s} has no GPUI builder`);
    i != null && (a = o(a, i));
  }
  return a;
}
const qn = (a) => ({ clientX: a?.position?.x ?? 0, clientY: a?.position?.y ?? 0 }), cf = /* @__PURE__ */ new WeakSet(), Vo = /* @__PURE__ */ new WeakSet();
function uf(a, l, s) {
  const i = a.pressed, o = qn(s);
  return i && i.x === o.clientX && i.y === o.clientY ? i.id : l;
}
function L1(a, l, s) {
  if (a.name) return a.name;
  if (!(l.size || a.hover || a.focus || a.active || a.track_hover || s)) return null;
  const i = a.meta?.attrs["data-testid"];
  return i ? `~${a.id}:${i}` : `~${a.id}`;
}
const hm = (a, l = !1) => (a.children ?? []).some((s) => s.kind === "text" ? !l || /\s/.test(String(s.text ?? "").trim()) : s.kind === "div" && s.style?.flex_direction !== "row" && s.style?.whitespace !== "nowrap" && hm(s, !0)), Ne = (a) => a.style?.display !== "hidden";
function us(a, l, s, i, o = !1, d = !1, m = null, f = {}, h = !1, x = /* @__PURE__ */ new Map()) {
  if (a.kind === "text") return x.get(a)?.text ?? a.text;
  const S = cf.has(a);
  d ||= a.style.opacity === 0 || a.style.visibility === "invisible", d && (a.name || a.range_name) && (a = { ...a, name: void 0, range_name: void 0, also: void 0 }), m = a.style.text_color ?? m;
  const k = !!a.hover?.text_color && ym(a);
  k && s.hovered?.(a.id) && (m = a.hover.text_color), f = { ...f };
  for (const g of ["text_size", "line_height", "whitespace", "text_ellipsis"]) a.style[g] !== void 0 && (f[g] = a.style[g]);
  const y = new Set(a.events ?? []);
  let w;
  a.kind === "image" && !a.markup ? w = l.image(a.src) : w = l.div(), a.markup && (w = w.child(i.icon(`~icon-${a.id}`, a.markup, a.kind === "svg" ? m : "")));
  const N = L1(a, y, o);
  if (N && (w = w.id(N)), a.measure && (w = w.measure(a.measure)), a.name && w.also_named) for (const g of a.also ?? []) w = w.also_named(g);
  w = sf(w, { ...a.style, ...x.get(a) });
  const _ = f.whitespace !== "nowrap" && !f.text_ellipsis;
  h && _ && a.style.flex_shrink !== 0 && a.style.min_w === void 0 && hm(a) && (w = w.min_w(0));
  for (const g of ["hover", "focus", "active"]) a[g] && (w = w[g]((p) => sf(p, a[g])));
  if (l.scroll && (a.style.overflow_x === "scroll" || a.style.overflow_y === "scroll")) {
    const g = s.document?.scrollTarget, p = g ? (a.children ?? []).filter(Ne).findIndex((v) => vm(v, g.id)) : -1;
    if (p >= 0 && (s.scroller ?? a.id) === a.id && (s.document.scrollTarget = null, s.scroller = a.id, l.scroll.scroll_to_item(p)), s.scroller ??= a.id, s.scroller === a.id && s.document) {
      w = w.track_scroll(l.scroll);
      const v = (a.children ?? []).filter(Ne).map((z) => z.id);
      s.document.itemBounds = (z) => v.includes(z) ? l.scroll.item_bounds?.(v.indexOf(z)) ?? null : null;
    }
  }
  const E = a.style.overflow_x === "scroll" || a.style.overflow_y === "scroll";
  if (E && Vo.has(a) && (w = w.on_scroll_wheel((g, p) => p.stop_propagation?.())), E || Vo.has(a)) for (const g of a.children ?? []) g.kind !== "text" && Vo.add(g);
  a.kind === "input" && !a.disabled && (w = w.on_mouse_down("left", (g, p) => {
    g.bounds && s.setBounds(a.id, g.bounds), s.focus(a.id), p.notify();
  }));
  const O = a.kind === "input" ? a : a.meta?.tag === "label" ? bm(a) : null;
  O && !O.disabled && /^(checkbox|radio)$/.test(O.input_type) && (w = w.on_click((g, p) => {
    p.stop_propagation?.(), s.toggle(O.id), p.notify();
  }));
  const R = ["click", "double_click", "context_menu", "mouse_down", "mouse_up"].some((g) => y.has(g));
  if (R || S) for (const g of a.children ?? []) g.kind !== "text" && cf.add(g);
  if (R && (w = w.on_mouse_down("left", (g, p) => {
    p.stop_propagation?.(), g.bounds && s.setBounds(a.id, g.bounds);
    const v = { ...qn(g), button: 0, buttons: 1, detail: g.click_count }, z = uf(s, a.id, g);
    s.pressed = null, s.dispatch(z, "pointerdown", { ...v, pointerType: "mouse" }), s.dispatch(z, "mousedown", v) && s.pressFocus?.(z), p.notify();
  }), w = w.on_mouse_down("right", (g, p) => {
    p.stop_propagation?.(), g.bounds && s.setBounds(a.id, g.bounds);
    const v = uf(s, a.id, g);
    s.pressed = null, s.dispatch(v, "contextmenu", { ...qn(g), button: 2 }), p.notify();
  }), w = w.on_mouse_up("left", (g, p) => {
    p.stop_propagation?.();
    const v = { ...qn(g), button: 0 };
    s.dispatch(a.id, "pointerup", { ...v, pointerType: "mouse" }), s.dispatch(a.id, "mouseup", v), p.notify();
  }), w = w.on_click((g, p) => {
    s.dispatch(a.id, g.click_count === 2 && y.has("double_click") ? "dblclick" : "click", { detail: g.click_count, button: 0 }), p.notify();
  })), a.blocks_pointer && !R)
    for (const g of ["left", "right"]) w = w.on_mouse_down(g, (p, v) => v.stop_propagation?.());
  else if (S && !R)
    for (const g of ["left", "right"])
      w = w.on_mouse_down(g, (p) => {
        const v = qn(p);
        (s.pressed?.x !== v.clientX || s.pressed?.y !== v.clientY) && (s.pressed = { id: a.id, x: v.clientX, y: v.clientY });
      });
  if (y.has("mouse_move") && (w = w.on_mouse_move((g, p) => {
    s.dispatch(a.id, "pointermove", { ...qn(g), pointerType: "mouse" }), p.notify();
  })), (a.track_hover || k) && (w = w.on_hover((g, p) => {
    s.hover(a.id, g), p.notify();
  })), o && (w = w.on_mouse_down_out((g, p) => {
    s.dispatch(s.document.body.id, "pointerdown", { ...qn(g), pointerType: "mouse" }), s.dispatch(s.document.body.id, "mousedown", qn(g)), p.notify();
  })), a.kind === "input" && !/^(checkbox|radio|range|color|file|select)$/.test(a.input_type)) {
    const g = a.value ? String(a.value) : String(a.placeholder ?? "");
    let p = l.div().whitespace_nowrap().overflow_x_hidden();
    const v = ca(f);
    v && (p = p.h(v)), !a.value && m && (p = p.text_color(J1(m))), g && (w = w.child(p.child(a.input_type === "password" && a.value ? "•".repeat([...g].length) : g))), a.field_w && (w = w.child(l.div().w(a.field_w).h(0)));
  }
  const A = f.whitespace === "nowrap" ? ca(f) : null, L = a.style.display === "flex" && !String(a.style.flex_direction ?? "row").startsWith("col");
  let q = !a.range_name;
  const D = a.style.display === "flex" && String(a.style.flex_direction ?? "row").startsWith("col") && (a.style.h === void 0 || a.style.h === "auto") && typeof a.style.max_h == "number";
  for (const g of (a.children ?? []).filter(Ne)) {
    const p = g.style?.flex_basis;
    D && g.style.flex_grow > 0 && (p === 0 || typeof p == "string" && p.endsWith("%")) && x.set(g, { ...x.get(g), flex_basis: "auto" });
    let v = us(g, l, s, i, !1, d, m, f, L && g.style?.position !== "absolute", x);
    const z = !q && (g.kind === "text" || !g.meta), M = g.kind === "text" ? x.get(g)?.h ?? A : null, H = g.kind === "text" ? x.get(g)?.w : void 0;
    if (z || M || H !== void 0) {
      let V = l.div();
      z && (V = V.id(a.range_name)), z && !L && a.style.display === "flex" && (V = V[`self_${Z1[f.text_align] ?? "start"}`]().max_w("100%")), M && (V = V.h(M)), H !== void 0 && (V = V.w(H).flex_none().whitespace_nowrap()), v = V.child(v), q ||= z;
    }
    w = w.child(v);
  }
  return w;
}
const Z1 = { center: "center", right: "end", end: "end" };
function J1(a) {
  const l = String(a);
  if (!/^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(l)) return a;
  const s = l.length === 9 ? Number.parseInt(l.slice(7), 16) : 255;
  return `${l.slice(0, 7)}${Math.round(s / 2).toString(16).padStart(2, "0")}`;
}
const gm = /^(?:[!-,.-~]+|\S)$/u, bm = (a) => {
  for (const l of a.children ?? []) {
    if (l.kind === "input" && /^(checkbox|radio)$/.test(l.input_type)) return l;
    const s = l.kind === "text" ? null : bm(l);
    if (s) return s;
  }
  return null;
}, vm = (a, l) => a.id === l || (a.children ?? []).some((s) => s.kind !== "text" && vm(s, l)), ym = (a) => !!a.markup || (a.children ?? []).some((l) => l.kind !== "text" && ym(l));
function ca(a) {
  const l = a.line_height;
  return typeof l == "string" && l.endsWith("px") ? Number.parseFloat(l) : typeof l == "number" && typeof a.text_size == "number" ? l * a.text_size : null;
}
function oy(a, l, s, i, o = 0, d = !1) {
  const m = [a.root, ...a.overlays], f = o > 0 ? ey(m, o) : /* @__PURE__ */ new Map();
  o > 0 && i.measure && W1(m, o, i.measure, f), $1(m, f), P1(m, f), i.measure && I1(m, i.measure, f);
  let h = l.div().relative().size_full().child(us(a.root, l, s, i, !1, !1, null, {}, !1, f)), x = d && a.overlays.length ? l.div().relative().size_full().window_layer() : h;
  for (const S of a.overlays) x = x.child(us(S, l, s, i, !0, !1, null, {}, !1, f));
  return x === h ? h : h.child(x);
}
function W1(a, l, s, i) {
  const o = (N, _) => i.set(N, { ...i.get(N), ..._ }), d = /* @__PURE__ */ new Map(), m = /* @__PURE__ */ new Map(), f = ["text_size", "font_weight", "font_family", "italic", "whitespace", "text_ellipsis"];
  function h(N, _, E) {
    if (N.kind === "text") {
      if (!(_.whitespace === "nowrap" || gm.test(N.text)) || _.text_ellipsis || E || typeof _.text_size != "number") return NaN;
      const g = s(N.text, { size: _.text_size, weight: _.font_weight ?? 400, family: _.font_family ?? ".SystemUIFont", italic: !!_.italic });
      return Number.isFinite(g) ? g : NaN;
    }
    if (!Ne(N) || N.kind === "input" || N.markup) return x(N);
    const O = { ..._ };
    for (const D of f) N.style[D] !== void 0 && (O[D] = N.style[D]);
    O.text_ellipsis = !!N.style.text_ellipsis, m.set(N, O);
    const R = N.style, A = (N.children ?? []).filter(Ge), L = A.map((D) => h(D, O, E || !!N.tabular));
    let q = x(N);
    if (!Number.isFinite(q) && R.w === void 0) {
      const D = A.map((p, v) => L[v] + (p.kind === "text" ? 0 : rt(p.style.ml) + rt(p.style.mr)));
      let g;
      A.length ? Oe(N) ? g = A.some((p) => p.kind !== "text" && p.style.flex_grow > 0) || R.flex_wrap === "wrap" ? NaN : D.reduce((p, v) => p + v, 0) + rt(R.gap_x) * (A.length - 1) : g = Math.max(...D) : g = 0, q = g + rt(R.pl) + rt(R.pr) + rt(R.border_l) + rt(R.border_r), typeof R.min_w == "number" && (q = Math.max(q, R.min_w)), typeof R.max_w == "number" && (q = Math.min(q, R.max_w));
    }
    return d.set(N, q), q;
  }
  const x = (N) => typeof N.style?.w == "number" ? N.style.w : NaN, S = () => ({ exact: 0, laid: 0 }), k = (N, _) => {
    if (!Number.isFinite(_))
      return Object.assign(N, S()), NaN;
    N.exact += _;
    const E = Math.round(N.exact * l + 1e-9) / l, O = E - N.laid;
    return N.laid = E, O;
  }, y = (N) => Oe(N) && N.style.flex_wrap !== "wrap" && (N.style.justify ?? "start") === "start";
  function w(N) {
    if (!N || N.kind === "text" || !Ne(N)) return;
    const _ = (N.children ?? []).filter(Ge);
    if (y(N) && _.length > 1) {
      const E = rt(N.style.gap_x), O = S(), R = !(E && _.some((A) => A.kind === "text" || !Number.isFinite(rt(A.style.ml))));
      o(N, { border_l: k(O, rt(N.style.border_l)), pl: k(O, rt(N.style.pl)) }), R && E && o(N, { gap_x: 0 }), _.forEach((A, L) => {
        const q = (L && R ? E : 0) + (A.kind === "text" ? 0 : rt(A.style.ml));
        if (A.kind === "text")
          q && Object.assign(O, S());
        else {
          const v = k(O, q);
          Number.isFinite(v) && o(A, { ml: v });
        }
        const D = A.kind === "text" ? m.get(N) ?? {} : null, g = A.kind === "text" ? h(A, D, !!N.tabular) : d.get(A);
        if ((A.kind === "text" || !(A.style.flex_grow > 0)) && Number.isFinite(g)) {
          const v = { w: k(O, g) };
          A.kind !== "text" && typeof A.style.w != "number" && A.style.min_w === void 0 && (v.whitespace = "nowrap", v.flex_shrink = 0), o(A, v);
        } else Object.assign(O, S());
        if (A.kind !== "text") {
          const v = k(O, rt(A.style.mr));
          Number.isFinite(v) && o(A, { mr: v });
        }
      });
    }
    for (const E of N.children ?? []) E.kind !== "text" && w(E);
  }
  for (const N of a)
    N && (h(N, {}, !1), w(N));
}
const F1 = /(?<= +)(?=[^ ])|(?<=[\p{L}\p{N}]-)(?=[\p{L}\p{N}])/u;
function I1(a, l, s) {
  const i = ["text_size", "font_weight", "font_family", "italic", "line_height"], o = (f) => typeof f == "number" ? f : 0, d = (f, h) => h && Xr(h) && !Oe(h) && f.style.position !== "absolute" && !["start", "center", "end"].includes(f.style.self) && !["start", "center", "end"].includes(h.style.items), m = (f, h, x, S) => {
    if (!f || f.kind === "text" || !Ne(f)) return;
    const k = f.style;
    let y = typeof k.w == "number" ? k.w : k.w === "100%" ? x : d(f, h) ? x - o(k.ml) - o(k.mr) : NaN;
    typeof k.max_w == "number" && (y = Math.min(y, k.max_w));
    const w = y - o(k.pl) - o(k.pr) - o(k.border_l) - o(k.border_r), N = { ...S };
    for (const E of i) k[E] !== void 0 && (N[E] = k[E]);
    const _ = f.children ?? [];
    if (f.break_anywhere && Number.isFinite(w) && w > 0 && typeof N.text_size == "number" && _.length && _.every((E) => E.kind === "text")) {
      const E = { size: N.text_size, weight: N.font_weight ?? 400, family: N.font_family ?? ".SystemUIFont", italic: !!N.italic }, O = (L) => l(L.trimEnd(), E) <= w + 0.01;
      let R = 0;
      for (const L of _) {
        const q = [];
        for (const g of L.text.split(`
`)) {
          let p = "";
          for (const v of g.split(F1)) {
            if (O(p + v)) {
              p += v;
              continue;
            }
            p && q.push(p.trimEnd()), p = "";
            for (const z of v)
              p && !O(p + z) && (q.push(p), p = ""), p += z;
          }
          q.push(p.trimEnd());
        }
        const D = q.join(`
`);
        q.every((g) => !g || O(g)) ? D !== L.text && s.set(L, { ...s.get(L), text: D }) : R = NaN, R += q.length;
      }
      const A = ca(N);
      Number.isFinite(R) && A && k.h === void 0 && _.length === 1 && s.set(f, { ...s.get(f), h: R * A + o(k.pt) + o(k.pb) + o(k.border_t) + o(k.border_b) });
    }
    for (const E of _) m(E, f, Oe(f) ? NaN : w, N);
  };
  for (const f of a) m(f, null, NaN, {});
}
function P1(a, l) {
  const s = (i, o) => {
    if (!i || i.kind === "text" || !Ne(i)) return;
    const d = i.style, m = d.position === "absolute" ? d.w === void 0 && (d.left === void 0 || d.right === void 0) : o && typeof d.w != "number";
    if (m && Oe(i))
      for (const f of i.children ?? []) {
        const h = f.kind === "text" ? void 0 : f.style.flex_basis;
        f.kind !== "text" && f.style.flex_grow > 0 && (h === 0 || typeof h == "string" && h.endsWith("%")) && l.set(f, { ...l.get(f), flex_basis: "auto" });
      }
    for (const f of i.children ?? []) s(f, m);
  };
  for (const i of a) s(i, !1);
}
function $1(a, l) {
  const s = l.heights ?? /* @__PURE__ */ new Map(), i = (h) => s.get(h), o = (h) => {
    const x = i(h);
    if (Number.isFinite(x)) return x;
    if (h.kind === "text" || !Ne(h)) return 0;
    const S = h.style, k = typeof S.min_h == "number" ? S.min_h : 0, y = (h.children ?? []).filter(Ge), w = y.map((E) => o(E) + (E.kind === "text" ? 0 : Math.max(0, rt(E.style.mt) || 0) + Math.max(0, rt(E.style.mb) || 0))), N = y.length ? Oe(h) ? Math.max(...w) : w.reduce((E, O) => E + O, 0) + (S.display === "flex" ? (rt(S.gap_y) || 0) * (y.length - 1) : 0) : 0, _ = [S.pt, S.pb, S.border_t, S.border_b].reduce((E, O) => E + (rt(O) || 0), 0);
    return Math.max(k, N + _);
  }, d = (h) => !(h.children ?? []).filter(Ge).length || Oe(h) ? NaN : o({ ...h, style: { ...h.style, h: void 0, max_h: void 0, min_h: void 0 } }), m = (h, x) => {
    const S = h.style;
    if (typeof S.h == "number") return S.h;
    if (typeof S.max_h == "number") return S.max_h;
    if (!x || !Xr(x) || Oe(x)) return NaN;
    const k = x.style, y = typeof k.h == "number" ? k.h : typeof k.max_h == "number" ? k.max_h : NaN, w = (x.children ?? []).filter(Ge);
    let N = 0;
    for (const E of w) {
      if (E === h) continue;
      const O = i(E);
      if (!Number.isFinite(O)) return NaN;
      N += O + (E.kind === "text" ? 0 : rt(E.style.mt) + rt(E.style.mb));
    }
    const _ = k.display === "flex" ? rt(k.gap_y) * Math.max(0, w.length - 1) : 0;
    return y - rt(k.pt) - rt(k.pb) - rt(k.border_t) - rt(k.border_b) - N - _ - rt(S.mt) - rt(S.mb);
  }, f = (h, x) => {
    if (!(!h || h.kind === "text" || !Ne(h))) {
      if (h.scrollbar > 0 && h.style.overflow_y === "scroll") {
        const S = d(h), k = m(h, x);
        Number.isFinite(S) && Number.isFinite(k) && S > k + 0.01 && l.set(h, { ...l.get(h), pr: rt(h.style.pr) + h.scrollbar });
      }
      for (const S of h.children ?? []) f(S, h);
    }
  };
  for (const h of a) f(h, null);
}
const ty = ["text_size", "line_height", "whitespace", "text_ellipsis"], rt = (a) => a == null ? 0 : typeof a == "number" ? a : NaN, Xr = (a) => a.style.display === "flex" ? a.style.flex_direction === "col" : !0, Oe = (a) => a.style.display === "flex" && (a.style.flex_direction ?? "row") === "row", Ge = (a) => a.kind === "text" || Ne(a) && a.style.position !== "absolute";
function ey(a, l) {
  const s = /* @__PURE__ */ new Map(), i = (_, E) => s.set(_, { ...s.get(_), ...Object.fromEntries(Object.entries(E).filter(([, O]) => Number.isFinite(O))) }), o = /* @__PURE__ */ new Map(), d = /* @__PURE__ */ new Map();
  function m(_, E) {
    if (_.kind === "text") return E.whitespace === "nowrap" || gm.test(_.text) ? ca(E) ?? NaN : NaN;
    const O = { ...E };
    for (const D of ty) _.style[D] !== void 0 && (O[D] = _.style[D]);
    d.set(_, O);
    const R = _.style, A = (_.children ?? []).filter(Ge), L = A.map((D) => m(D, O));
    let q;
    if (R.h !== void 0 && R.h !== "auto") q = rt(R.h);
    else if (_.kind === "input")
      q = (_.input_type === "textarea" || _.input_type === "select" ? NaN : ca(O) ?? NaN) + rt(R.pt) + rt(R.pb) + rt(R.border_t) + rt(R.border_b), R.min_h !== void 0 && (q = Math.max(q, rt(R.min_h)));
    else {
      const D = A.map((p, v) => (p.kind === "text" ? 0 : rt(p.style.mt) + rt(p.style.mb)) + L[v]);
      let g;
      if (Oe(_)) g = R.flex_wrap === "wrap" ? NaN : R.items === "baseline" ? h(A, L, O) : Math.max(0, ...D);
      else if (Xr(_)) {
        const p = A.some((z) => z.kind !== "text" && (z.style.flex_grow > 0 || z.style.flex_basis !== void 0)), v = R.display !== "flex" && A.some((z) => z.kind !== "text" && (rt(z.style.mt) || rt(z.style.mb)));
        g = p || v ? NaN : D.reduce((z, M) => z + M, 0) + (R.display === "flex" ? rt(R.gap_y) * Math.max(0, A.length - 1) : 0);
      } else g = NaN;
      q = g + rt(R.pt) + rt(R.pb) + rt(R.border_t) + rt(R.border_b), R.min_h !== void 0 && (q = Math.max(q, rt(R.min_h))), R.max_h !== void 0 && (q = Math.min(q, rt(R.max_h)));
    }
    return o.set(_, q), q;
  }
  const f = (_) => (ca(_) - (Gr + Af) * _.text_size) / 2 + Gr * _.text_size;
  function h(_, E, O) {
    let R = 0, A = 0;
    for (const [L, q] of _.entries()) {
      const D = q.kind === "text" ? O : d.get(q);
      if (!(q.kind === "text" || (q.children ?? []).filter(Ge).every((z) => z.kind === "text")) || !Number.isFinite(E[L]) || typeof D.text_size != "number") return NaN;
      const p = q.kind === "text" ? {} : q.style, v = rt(p.mt) + rt(p.border_t) + rt(p.pt) + f(D);
      R = Math.max(R, v), A = Math.max(A, rt(p.mt) + E[L] + rt(p.mb) - v);
    }
    return R + A;
  }
  const x = () => ({ exact: 0, laid: 0 }), S = (_, E) => {
    if (!Number.isFinite(E))
      return Object.assign(_, x()), NaN;
    _.exact += E;
    const O = Math.round(_.exact * l + 1e-9) / l, R = O - _.laid;
    return _.laid = O, R;
  };
  function k(_) {
    if (!(_.kind === "text" || !Ne(_))) {
      for (const E of (_.children ?? []).filter((O) => O.kind !== "text" && Ne(O) && O.style.position === "absolute")) k(E);
      if (Xr(_) && !Oe(_)) {
        const E = x();
        i(_, { border_t: S(E, rt(_.style.border_t)), pt: S(E, rt(_.style.pt)) }), y(_, E);
      } else for (const E of (_.children ?? []).filter(Ge)) E.kind !== "text" && k(E);
    }
  }
  function y(_, E) {
    const O = (_.children ?? []).filter(Ge), R = _.style.display === "flex" ? rt(_.style.gap_y) : 0;
    if (R && O.some((A) => A.kind === "text")) {
      for (const A of O) A.kind !== "text" && k(A);
      return !1;
    }
    return R && i(_, { gap_y: 0 }), O.forEach((A, L) => {
      if (A.kind === "text") {
        const q = o.get(A) ?? m(A, d.get(_) ?? {});
        Number.isFinite(q) ? i(A, { h: S(E, q) }) : Object.assign(E, x());
        return;
      }
      if (i(A, { mt: S(E, (L ? R : 0) + rt(A.style.mt)) }), Number.isFinite(o.get(A))) N(A, E);
      else if (w(A)) {
        const q = A.style;
        i(A, { border_t: S(E, rt(q.border_t)), pt: S(E, rt(q.pt)) }), i(A, { pb: S(E, rt(q.pb)), border_b: S(E, rt(q.border_b)) });
      } else
        k(A), Object.assign(E, x());
      i(A, { mb: S(E, rt(A.style.mb)) });
    }), !0;
  }
  function w(_) {
    const E = _.style, O = (_.children ?? []).filter(Ge), R = ca(d.get(_) ?? {});
    return _.kind === "div" && !Oe(_) && O.length > 0 && O.every((A) => A.kind === "text") && Number.isInteger(R) && [E.h, E.min_h, E.max_h].every((A) => A === void 0 || A === "auto");
  }
  function N(_, E) {
    const O = _.style;
    for (const D of (_.children ?? []).filter((g) => g.kind !== "text" && Ne(g) && g.style.position === "absolute")) k(D);
    const R = E.laid, A = E.exact;
    i(_, { border_t: S(E, rt(O.border_t)), pt: S(E, rt(O.pt)) });
    const L = O.h !== void 0 && O.h !== "auto", q = o.get(_) - rt(O.pt) - rt(O.pb) - rt(O.border_t) - rt(O.border_b);
    if (_.kind === "input")
      L || S(E, q);
    else if (Oe(_) || L && (O.justify ?? "start") !== "start") {
      for (const D of (_.children ?? []).filter(Ge)) D.kind !== "text" && k(D);
      L || S(E, q);
    } else !y(_, E) && !L && S(E, q);
    if (L) {
      E.exact = A + o.get(_), E.laid = Math.round(E.exact * l + 1e-9) / l, i(_, { h: E.laid - R });
      return;
    }
    i(_, { pb: S(E, rt(O.pb)), border_b: S(E, rt(O.border_b)) }), i(_, { h: E.laid - R });
  }
  for (const _ of a)
    m(_, {}), k(_);
  return Object.defineProperty(s, "heights", { value: o }), s;
}
const sy = { sidebar: [{ name: "sidebar-root", selector: "aside.sidebar" }, { name: "sidebar-content", selector: "aside.sidebar > div:first-child" }, { name: "host-switcher", selector: '[data-testid="host-switcher"]' }, { name: "host-chip", selector: '[data-testid="host-switcher"] > div' }, { name: "host-badge", selector: ".sidebar__env-badge" }, { name: "host-name", selector: ".sidebar__env-host" }, { name: "host-meta", selector: '[data-testid="host-switcher"] > div > div:first-child > span:nth-child(3)' }, { name: "host-line", selector: ".sidebar__env-cwd" }, { name: "host-caret", selector: '[data-testid="host-switcher"] > span[aria-hidden="true"]' }, { name: "new-session-button", selector: 'button[data-testid^="new-session-"]', key: { self: !0, attr: "data-testid", strip: "new-session-" } }, { name: "new-session-icon", selector: 'button[data-testid^="new-session-"] > svg' }, { name: "new-session-label", selector: 'button[data-testid^="new-session-"]', textRange: !0 }, { name: "new-session-shortcut", selector: 'button[data-testid^="new-session-"] > span' }, { name: "overview", selector: '[data-testid="workspace-overview"]' }, { name: "overview-header", selector: '[data-testid="workspace-overview"] > div:first-child' }, { name: "overview-title", selector: '[data-testid="workspace-overview"] > div:first-child > div:first-child > span:first-child' }, { name: "needs-you-button", selector: '[data-testid="workspace-needs-you"]' }, { name: "organize-button", selector: '[data-testid="workspace-organize"]' }, { name: "organize-icon", selector: '[data-testid="workspace-organize"] > svg' }, { name: "add-project-button", selector: '[data-testid="workspace-add-project"]' }, { name: "add-project-icon", selector: '[data-testid="workspace-add-project"] > svg' }, { name: "add-project-label", selector: '[data-testid="workspace-add-project"]', textRange: !0 }, { name: "project-list", selector: '[data-testid="project-list"]' }, { name: "project", selector: ".workspace-project", key: { self: !0, attr: "data-testid", strip: "workspace-project-" } }, { name: "project-header", selector: ".workspace-project > div:first-child", key: { closest: ".workspace-project", attr: "data-testid", strip: "workspace-project-" } }, { name: "project-toggle", selector: '[data-testid^="project-toggle-"]', key: { self: !0, attr: "data-testid", strip: "project-toggle-" } }, { name: "project-chevron", selector: '[data-testid^="project-toggle-"] > svg:not([data-testid])', key: { closest: '[data-testid^="project-toggle-"]', attr: "data-testid", strip: "project-toggle-" } }, { name: "project-folder-icon", selector: '[data-testid="project-folder-icon"]', key: { closest: '[data-testid^="project-toggle-"]', attr: "data-testid", strip: "project-toggle-" } }, { name: "project-name", selector: '[data-testid^="project-toggle-"] strong', key: { closest: '[data-testid^="project-toggle-"]', attr: "data-testid", strip: "project-toggle-" } }, { name: "project-branch", selector: '[data-testid^="project-toggle-"] > span.whitespace-nowrap', key: { closest: '[data-testid^="project-toggle-"]', attr: "data-testid", strip: "project-toggle-" } }, { name: "project-dirty-mark", selector: '[data-testid^="project-toggle-"] > span[title="Uncommitted changes"]', key: { closest: '[data-testid^="project-toggle-"]', attr: "data-testid", strip: "project-toggle-" } }, { name: "project-rollup", selector: '[data-testid^="project-rollup-"]', key: { self: !0, attr: "data-testid", strip: "project-rollup-" } }, { name: "project-rollup-badge", selector: '[data-testid^="project-rollup-"] > span', key: { closest: '[data-testid^="project-rollup-"]', attr: "data-testid", strip: "project-rollup-" } }, { name: "project-menu-button", selector: '[data-testid^="workspace-project-menu-"]', key: { self: !0, attr: "data-testid", strip: "workspace-project-menu-" } }, { name: "project-add-button", selector: ".workspace-project > div:first-child .worktree-menu__btn", key: { closest: ".workspace-project", attr: "data-testid", strip: "workspace-project-" } }, { name: "project-workspaces", selector: ".workspace-project__workspaces", key: { closest: ".workspace-project", attr: "data-testid", strip: "workspace-project-" } }, { name: "workspace", selector: '[data-testid="workspace-tree-root"] [data-testid^="workspace-entry-"]', key: { self: !0, attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-button", selector: '[data-testid="workspace-tree-root"] button.workspace-entry__button', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-icon", selector: '[data-testid="workspace-tree-root"] [data-testid="workspace-checkout-icon"]', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-name", selector: '[data-testid="workspace-tree-root"] strong[title="Double-click to rename"]', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-branch", selector: '[data-testid="workspace-tree-root"] button.workspace-entry__button > span.items-baseline > span', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-dirty-mark", selector: '[data-testid="workspace-tree-root"] button.workspace-entry__button > span[title="Uncommitted changes"]', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-pinned-label", selector: '[data-testid="workspace-tree-root"] button.workspace-entry__button > span.shrink-0:not([title])', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "hidden-worktrees-button", selector: '[data-testid^="workspace-hidden-"]', key: { self: !0, attr: "data-testid", strip: "workspace-hidden-" } }, { name: "session-row", selector: 'div[class~="group/row"]', key: { find: 'button[data-testid^="workspace-session-"]:not([data-testid^="workspace-session-close-"])', attr: "data-testid", strip: "workspace-session-" } }, { name: "session-button", selector: 'button[data-testid^="workspace-session-"]:not([data-testid^="workspace-session-close-"])', key: { self: !0, attr: "data-testid", strip: "workspace-session-" } }, { name: "session-mark", selector: ".agent-mark", key: { closest: 'button[data-testid^="workspace-session-"]', attr: "data-testid", strip: "workspace-session-" } }, { name: "session-mark-icon", selector: ".agent-mark > span > *", key: { closest: 'button[data-testid^="workspace-session-"]', attr: "data-testid", strip: "workspace-session-" } }, { name: "session-title", selector: 'button[data-testid^="workspace-session-"] > span.whitespace-nowrap', key: { closest: 'button[data-testid^="workspace-session-"]', attr: "data-testid", strip: "workspace-session-" } }, { name: "status-row-title", selector: "button[data-session] span.truncate:not([data-testid])", key: { closest: 'button[data-testid^="workspace-session-"]', attr: "data-testid", strip: "workspace-session-" } }, { name: "status-row-detail", selector: '[data-testid="status-row-detail"]', key: { closest: 'button[data-testid^="workspace-session-"]', attr: "data-testid", strip: "workspace-session-" } }, { name: "session-state-badge", selector: '[data-testid^="session-state-"]', key: { self: !0, attr: "data-testid", strip: "session-state-" } }, { name: "session-menu-button", selector: '[data-testid^="session-menu-button-"]', key: { self: !0, attr: "data-testid", strip: "session-menu-button-" } }, { name: "session-fold-button", selector: '[data-testid^="session-fold-"]', key: { self: !0, attr: "data-testid", strip: "session-fold-" } }, { name: "session-elbow", selector: '[data-testid^="session-elbow-"]', key: { self: !0, attr: "data-testid", strip: "session-elbow-" } }, { name: "session-rollup", selector: '[data-testid^="session-rollup-"]', key: { self: !0, attr: "data-testid", strip: "session-rollup-" } }, { name: "chats", selector: '[data-testid="workspace-chats"]' }, { name: "chats-header", selector: '[data-testid="workspace-chats"] > div:first-child' }, { name: "chats-toggle", selector: '[data-testid="workspace-chats-collapse"]' }, { name: "chats-label", selector: '[data-testid="workspace-chats-collapse"]', textRange: !0 }, { name: "chats-chevron", selector: '[data-testid="workspace-chats-collapse"] > svg' }, { name: "chats-menu-button", selector: '[data-testid="workspace-chats-menu"]' }, { name: "chats-new-button", selector: '[data-testid="workspace-chats-new"]' }, { name: "chats-new-icon", selector: '[data-testid="workspace-chats-new"] > svg' }, { name: "status-view", selector: '[data-testid="workspace-status-view"]' }, { name: "status-section", selector: '[data-testid^="status-section-"]:not([data-testid^="status-section-title-"])', key: { self: !0, attr: "data-testid", strip: "status-section-" } }, { name: "status-heading", selector: '[data-testid^="status-section-title-"], [data-testid="status-no-sessions-title"]', key: { self: !0, attr: "data-testid" } }, { name: "status-heading-dot", selector: '[data-testid^="status-section-title-"] > span:first-child, [data-testid="status-no-sessions-title"] > span:first-child', key: { closest: '[data-testid^="status-section-title-"], [data-testid="status-no-sessions-title"]', attr: "data-testid" } }, { name: "status-heading-label", selector: '[data-testid^="status-section-title-"] > span:nth-child(2), [data-testid="status-no-sessions-title"] > span:nth-child(2)', key: { closest: '[data-testid^="status-section-title-"], [data-testid="status-no-sessions-title"]', attr: "data-testid" } }, { name: "status-heading-count", selector: '[data-testid^="status-section-title-"] > span[aria-label], [data-testid="status-no-sessions-title"] > span[aria-label]', key: { closest: '[data-testid^="status-section-title-"], [data-testid="status-no-sessions-title"]', attr: "data-testid" } }, { name: "status-heading-note", selector: '[data-testid^="status-section-title-"] > span.truncate, [data-testid="status-no-sessions-title"] > span.truncate', key: { closest: '[data-testid^="status-section-title-"], [data-testid="status-no-sessions-title"]', attr: "data-testid" } }, { name: "status-project", selector: 'div[data-testid^="status-project-"]', key: { self: !0, attr: "data-testid", strip: "status-project-" } }, { name: "status-project-header", selector: 'div[data-testid^="status-project-"] > div:first-child', key: { closest: 'div[data-testid^="status-project-"]', attr: "data-testid", strip: "status-project-" } }, { name: "status-project-icon", selector: 'div[data-testid^="status-project-"] > div:first-child > svg', key: { closest: 'div[data-testid^="status-project-"]', attr: "data-testid", strip: "status-project-" } }, { name: "status-project-title", selector: '[data-testid="status-project-title"]', key: { closest: 'div[data-testid^="status-project-"]', attr: "data-testid", strip: "status-project-" } }, { name: "status-empty-project", selector: '[data-testid^="status-empty-project-"]', key: { self: !0, attr: "data-testid", strip: "status-empty-project-" } }, { name: "status-empty-project-icon", selector: '[data-testid^="status-empty-project-"] > button:first-child > svg', key: { closest: '[data-testid^="status-empty-project-"]', attr: "data-testid", strip: "status-empty-project-" } }, { name: "status-empty-project-title", selector: '[data-testid^="status-empty-project-"] > button > span.whitespace-nowrap', key: { closest: '[data-testid^="status-empty-project-"]', attr: "data-testid", strip: "status-empty-project-" } }, { name: "settings-bar", selector: "aside.sidebar > div:last-child" }, { name: "settings-gear", selector: '[data-testid="settings-gear"]' }, { name: "settings-gear-icon", selector: '[data-testid="settings-gear"] > svg' }], tabs: [{ name: "tab-strip", selector: '[data-testid="tab-bar"]' }, { name: "tab-slot", selector: "[data-tab-entry]", key: { self: !0, attr: "data-tab-entry" } }, { name: "tab-separator", selector: '[data-testid="tab-separator"]', key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab", selector: "button.tab-bar__tab", key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-icon", selector: 'button.tab-bar__tab > span[aria-hidden="true"]', key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-icon-glyph", selector: 'button.tab-bar__tab > span[aria-hidden="true"] > *', key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-label", selector: "button.tab-bar__tab > span.truncate", key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-dirty", selector: 'button.tab-bar__tab > span[aria-label="unsaved changes"]', key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-close", selector: '[data-tab-entry] > button[aria-label^="Close"]', key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-close-glyph", selector: '[data-tab-entry] > button[aria-label^="Close"] > svg', key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-new", selector: '[data-testid="tab-new"]' }, { name: "tab-new-glyph", selector: '[data-testid="tab-new"] > svg' }], status: [{ name: "status-bar", selector: "footer.status-bar" }, { name: "status-location", selector: ".status-bar__location" }, { name: "status-dot", selector: ".status-bar__location > span:first-child" }, { name: "status-host", selector: '[data-testid="status-host"]' }, { name: "status-cwd", selector: ".status-item--cwd" }, { name: "status-branch", selector: ".status-bar__branch" }, { name: "status-branch-icon", selector: ".status-bar__branch > svg" }, { name: "status-branch-name", selector: ".status-bar__branch > span" }, { name: "status-details", selector: ".status-bar__details" }, { name: "zoom-indicator", selector: '[data-testid="zoom-indicator"]' }, { name: "status-detail", selector: ".status-bar__details > span" }, { name: "status-usage", selector: ".status-bar__usage" }, { name: "usage-summary", selector: '[data-testid="usage-summary"]' }, { name: "usage-unavailable", selector: '[data-testid="usage-summary"] > span:only-child' }, { name: "usage-account", selector: '[data-testid="usage-summary"] > span.flex' }, { name: "usage-account-name", selector: '[data-testid="usage-summary"] > span.flex > span:first-child' }, { name: "usage-window", selector: '[data-testid="usage-summary"] > span.flex > span:not(:first-child)' }, { name: "status-connection", selector: '[data-testid="status-connection"]' }, { name: "status-connection-glyph", selector: '[data-testid="status-connection"] > svg' }], navigator: [{ name: "navigator-scrim", selector: "body > div.fixed.inset-0" }, { name: "navigator-panel", selector: '[data-testid="navigator"]' }, { name: "navigator-input", selector: '[data-testid="navigator-input"]' }, { name: "navigator-chips", selector: '[data-testid="navigator"] > div:nth-child(2)' }, { name: "navigator-chip", selector: '[data-testid^="navigator-filter-"]', key: { self: !0, attr: "data-testid", strip: "navigator-filter-" } }, { name: "navigator-list", selector: '[data-testid="navigator"] > div:nth-child(3)' }, { name: "navigator-notice", selector: '[data-testid="navigator"] > div:nth-child(3) > p[role]' }, { name: "navigator-empty", selector: '[data-testid="navigator"] div.text-center' }, { name: "navigator-command", selector: '[data-testid^="navigator-command-"]', key: { self: !0, attr: "data-testid", strip: "navigator-command-" } }, { name: "navigator-command-title", selector: '[data-testid^="navigator-command-"] > span:first-child', key: { closest: '[data-testid^="navigator-command-"]', attr: "data-testid", strip: "navigator-command-" } }, { name: "navigator-command-detail", selector: '[data-testid^="navigator-command-"] > span:last-child', key: { closest: '[data-testid^="navigator-command-"]', attr: "data-testid", strip: "navigator-command-" } }, { name: "navigator-row", selector: '[data-testid^="navigator-row-"]', key: { self: !0, attr: "data-testid", strip: "navigator-row-" } }, { name: "navigator-row-dot", selector: '[data-testid^="navigator-row-"] > :first-child', key: { closest: '[data-testid^="navigator-row-"]', attr: "data-testid", strip: "navigator-row-" } }, { name: "navigator-row-title", selector: '[data-testid^="navigator-row-"] > span:nth-child(2)', key: { closest: '[data-testid^="navigator-row-"]', attr: "data-testid", strip: "navigator-row-" } }, { name: "navigator-row-detail", selector: '[data-testid^="navigator-row-"] > span:last-child', key: { closest: '[data-testid^="navigator-row-"]', attr: "data-testid", strip: "navigator-row-" } }, { name: "navigator-note", selector: '[data-testid="navigator"] > p:last-child' }], "pane-menu": [{ name: "pane-menu", selector: '[data-testid="pane-context-menu"]' }, { name: "pane-menu-item", selector: '[data-testid="pane-context-menu"] > button', key: { self: !0, attr: "data-testid", strip: "pane-menu-" } }, { name: "pane-menu-divider", selector: '[data-testid="pane-context-menu"] > div.h-px' }, { name: "pane-menu-rename-row", selector: '[data-testid="pane-context-menu"] > div.flex' }, { name: "pane-menu-rename-input", selector: '[data-testid="pane-menu-rename-input"]' }, { name: "pane-menu-rename-confirm", selector: '[data-testid="pane-menu-rename-confirm"]' }], confirm: [{ name: "confirm-scrim", selector: "body > div.fixed.inset-0" }, { name: "confirm-panel", selector: '[data-testid="confirm-dialog"]' }, { name: "confirm-message", selector: ".confirm-dialog__message" }, { name: "confirm-extra", selector: '[data-testid="confirm-dialog"] > :not(.confirm-dialog__message):not(div.flex)' }, { name: "confirm-buttons", selector: '[data-testid="confirm-dialog"] > div.flex' }, { name: "confirm-cancel", selector: '[data-testid="confirm-cancel"]' }, { name: "confirm-accept", selector: '[data-testid="confirm-accept"]' }], dialog: [{ name: "dialog-scrim", selector: "body > div.fixed.inset-0" }, { name: "dialog-panel", selector: '[data-testid="file-name-dialog"]' }, { name: "dialog-title", selector: '[data-testid="file-name-dialog"] > h2' }, { name: "dialog-input", selector: '[data-testid="file-name-input"]' }, { name: "dialog-hint", selector: '[data-testid="file-name-dialog"] > p:not([role])' }, { name: "dialog-error", selector: '[data-testid="file-name-dialog"] > p[role="alert"]' }, { name: "dialog-buttons", selector: '[data-testid="file-name-dialog"] > div.flex' }, { name: "dialog-cancel", selector: '[data-testid="file-name-dialog"] > div.flex > button:first-child' }, { name: "dialog-confirm", selector: '[data-testid="file-name-confirm"]' }], toast: [{ name: "toast-stack", selector: '[data-testid="toast"]' }, { name: "toast-card", selector: '[data-testid="toast"] .animate-toast-in' }, { name: "toast-open", selector: '[data-testid^="toast-"]:not([data-testid^="toast-dismiss-"])' }, { name: "toast-mark", selector: '[data-testid^="toast-"]:not([data-testid^="toast-dismiss-"]) > :first-child' }, { name: "toast-heading", selector: '[data-testid^="toast-"]:not([data-testid^="toast-dismiss-"]) > span.min-w-0 > span:first-child' }, { name: "toast-detail", selector: '[data-testid^="toast-"]:not([data-testid^="toast-dismiss-"]) > span.min-w-0 > span:nth-child(2)' }, { name: "toast-dismiss", selector: '[data-testid^="toast-dismiss-"]' }, { name: "toast-dismiss-glyph", selector: '[data-testid^="toast-dismiss-"] > svg' }], "pane-header": [{ name: "pane-header", selector: '[data-testid^="pane-header-"]', key: { self: !0, attr: "data-testid", strip: "pane-header-" } }, { name: "pane-header-icon", selector: '[data-testid^="pane-header-"] > span.shrink-0:not([data-testid])', key: { closest: '[data-testid^="pane-header-"]', attr: "data-testid", strip: "pane-header-" } }, { name: "pane-header-icon-glyph", selector: '[data-testid^="pane-header-"] > span.shrink-0:not([data-testid]) > *', key: { closest: '[data-testid^="pane-header-"]', attr: "data-testid", strip: "pane-header-" } }, { name: "pane-header-name", selector: '[data-testid^="pane-header-"] > span.truncate', key: { closest: '[data-testid^="pane-header-"]', attr: "data-testid", strip: "pane-header-" } }, { name: "pane-header-state", selector: '[data-testid^="pane-header-"] > span.flex[title]', key: { closest: '[data-testid^="pane-header-"]', attr: "data-testid", strip: "pane-header-" } }, { name: "pane-header-state-dot", selector: '[data-testid^="pane-header-"] > span.flex[title] > span.rounded-full', key: { closest: '[data-testid^="pane-header-"]', attr: "data-testid", strip: "pane-header-" } }, { name: "pane-header-state-word", selector: '[data-testid^="pane-header-"] > span.flex[title] > span.truncate', key: { closest: '[data-testid^="pane-header-"]', attr: "data-testid", strip: "pane-header-" } }, { name: "pane-controls", selector: '[data-testid^="tile-controls-"]', key: { self: !0, attr: "data-testid", strip: "tile-controls-" } }, { name: "pane-expand", selector: '[data-testid^="tile-expand-"]', key: { self: !0, attr: "data-testid", strip: "tile-expand-" } }, { name: "pane-expand-glyph", selector: '[data-testid^="tile-expand-"] > svg', key: { closest: '[data-testid^="tile-expand-"]', attr: "data-testid", strip: "tile-expand-" } }, { name: "pane-close", selector: '[data-testid^="tile-close-"]', key: { self: !0, attr: "data-testid", strip: "tile-close-" } }, { name: "pane-close-glyph", selector: '[data-testid^="tile-close-"] > svg', key: { closest: '[data-testid^="tile-close-"]', attr: "data-testid", strip: "tile-close-" } }, { name: "pane-corner", selector: "div.pointer-events-auto.absolute" }], "new-session": [{ name: "launcher", selector: ".new-session-popover" }, { name: "launcher-filter", selector: '[data-testid="new-tab-filter"]' }, { name: "launcher-list", selector: "#new-tab-launcher-list" }, { name: "launcher-option", selector: '[role="option"]', key: { self: !0, attr: "data-testid" } }, { name: "launcher-option-icon", selector: '[role="option"] > :first-child:not(span.flex-1):not(kbd)', key: { closest: '[role="option"]', attr: "data-testid" } }, { name: "launcher-option-label", selector: '[role="option"] > span.flex-1', key: { closest: '[role="option"]', attr: "data-testid" } }, { name: "launcher-option-key", selector: '[role="option"] > kbd', key: { closest: '[role="option"]', attr: "data-testid" } }, { name: "launcher-note", selector: ".new-session-popover p[role]" }, { name: "agent-select", selector: '[data-testid="new-session-popover-agent"]' }, { name: "agent-manage", selector: ".new-session-popover > div:first-child > button:not([data-testid])" }, { name: "project-option", selector: '[data-testid^="project-option-"]', key: { self: !0, attr: "data-testid", strip: "project-option-" } }, { name: "project-option-name", selector: '[data-testid^="project-option-"]', key: { closest: '[data-testid^="project-option-"]', attr: "data-testid", strip: "project-option-" }, textRange: !0 }, { name: "project-option-path", selector: '[data-testid^="project-option-"] > span', key: { closest: '[data-testid^="project-option-"]', attr: "data-testid", strip: "project-option-" } }], "tab-menu": [{ name: "tab-menu", selector: '[data-testid="tab-split-menu"]' }, { name: "tab-menu-item", selector: '[data-testid="tab-split-menu"] > button', key: { self: !0, attr: "data-testid" } }, { name: "tab-menu-item-label", selector: '[data-testid="tab-split-menu"] > button > span.block', key: { closest: '[data-testid="tab-split-menu"] > button', attr: "data-testid" } }, { name: "tab-menu-heading", selector: '[data-testid="tab-split-menu"] > p' }, { name: "tab-menu-empty", selector: '[data-testid="tab-split-menu"] > div:not(.h-px)' }, { name: "tab-menu-divider", selector: '[data-testid="tab-split-menu"] > div.h-px' }, { name: "tab-menu-rename-form", selector: '[data-testid="tab-split-menu"] > form' }, { name: "tab-menu-rename-input", selector: '[data-testid="tab-menu-rename-input"]' }, { name: "tab-menu-rename-save", selector: '[data-testid="tab-split-menu"] > form > button' }], select: [{ name: "select-field", selector: '[data-testid="select-demo"]' }, { name: "select-field-label", selector: '[data-testid="select-demo"] > span.truncate' }, { name: "select-chevron", selector: '[data-testid="select-demo"] > svg' }, { name: "select-list", selector: '[role="listbox"]' }, { name: "select-option", selector: '[role="listbox"] > [role="option"]', key: { self: !0, attr: "data-value" } }, { name: "select-option-label", selector: '[role="listbox"] > [role="option"] > span.truncate', key: { closest: '[role="option"]', attr: "data-value" } }, { name: "select-option-check", selector: '[role="listbox"] > [role="option"] > span[aria-hidden]', key: { closest: '[role="option"]', attr: "data-value" } }], "keybind-help": [{ name: "keybind-help-scrim", selector: "body > div.fixed.inset-0" }, { name: "keybind-help-panel", selector: '[data-testid="keybind-help"]' }, { name: "keybind-help-header", selector: '[data-testid="keybind-help"] > div:first-child' }, { name: "keybind-help-title", selector: '[data-testid="keybind-help"] h2' }, { name: "keybind-help-close", selector: '[aria-label="Close keybind help"]' }, { name: "keybind-help-close-glyph", selector: '[aria-label="Close keybind help"] > svg' }, { name: "keybind-help-search", selector: '[data-testid="keybind-help-search"]' }, { name: "keybind-help-list", selector: '[data-testid="keybind-help"] > div:last-child' }, { name: "keybind-help-empty", selector: '[data-testid="keybind-help"] div.text-center' }, { name: "keybind-help-group", selector: '[data-testid="keybind-help"] section' }, { name: "keybind-help-group-title", selector: '[data-testid="keybind-help"] section > h3' }, { name: "keybind-help-row", selector: '[data-testid="keybind-help"] li' }, { name: "keybind-help-keys", selector: '[data-testid="keybind-help"] li > kbd' }, { name: "keybind-help-description", selector: '[data-testid="keybind-help"] li > span' }], launcher: [{ name: "launcher-scrim", selector: "body > div.fixed.inset-0" }, { name: "launcher-panel", selector: '[data-testid="new-session-dialog"]' }, { name: "launcher-title", selector: '[data-testid="new-session-dialog"] > p' }, { name: "launcher-filter", selector: '[data-testid="new-session-filter"]' }, { name: "launcher-list", selector: "#new-session-list" }, { name: "launcher-row", selector: '[data-testid^="new-session-row-"]', key: { self: !0, attr: "data-testid", strip: "new-session-row-" } }, { name: "launcher-row-icon", selector: '[data-testid^="new-session-row-"] > :first-child:not(span):not(kbd)', key: { closest: '[data-testid^="new-session-row-"]', attr: "data-testid", strip: "new-session-row-" } }, { name: "launcher-row-label", selector: '[data-testid^="new-session-row-"] > span.shrink-0', key: { closest: '[data-testid^="new-session-row-"]', attr: "data-testid", strip: "new-session-row-" } }, { name: "launcher-row-detail", selector: '[data-testid^="new-session-row-"] > span.ml-auto', key: { closest: '[data-testid^="new-session-row-"]', attr: "data-testid", strip: "new-session-row-" } }, { name: "launcher-row-key", selector: '[data-testid^="new-session-row-"] > kbd', key: { closest: '[data-testid^="new-session-row-"]', attr: "data-testid", strip: "new-session-row-" } }, { name: "launcher-note", selector: "#new-session-list > p" }], "session-menu": [{ name: "tab-menu", selector: '[data-testid="tab-split-menu"]' }, { name: "tab-menu-item", selector: '[data-testid="tab-split-menu"] > button', key: { self: !0, attr: "data-testid" } }, { name: "tab-menu-item-label", selector: '[data-testid="tab-split-menu"] > button > span.block', key: { closest: '[data-testid="tab-split-menu"] > button', attr: "data-testid" } }, { name: "tab-menu-heading", selector: '[data-testid="tab-split-menu"] > p' }, { name: "tab-menu-empty", selector: '[data-testid="tab-split-menu"] > div:not(.h-px)' }, { name: "tab-menu-divider", selector: '[data-testid="tab-split-menu"] > div.h-px' }], "tab-drag": [{ name: "tab-drag-layer", selector: '[data-testid="tab-drag-layer"]' }, { name: "tab-drag-pane", selector: '[data-testid="tab-drag-layer"] > div.bg-surface-1\\/30' }, { name: "tab-drop-zone", selector: '[data-testid="tab-drop-zone"]', key: { self: !0, attr: "data-zone" } }, { name: "tab-drop-label", selector: '[data-testid="tab-drop-zone"] > span' }, { name: "tab-drag-ghost", selector: '[data-testid="tab-drag-ghost"]' }], start: [{ name: "start-panel", selector: '[data-testid="no-session-panel"], [data-testid="cli-start-panel"]' }, { name: "start-column", selector: '[data-testid$="-panel"] > div' }, { name: "start-logo", selector: '[data-testid="no-session-panel"] img' }, { name: "start-name", selector: '[data-testid$="-panel"] h1, [data-testid="no-session-panel"] h1, [data-testid="no-session-panel"] h2' }, { name: "start-hint", selector: '[data-testid$="-panel"] p' }, { name: "start-target", selector: '[data-testid="workspace-start-target"], [data-testid="cli-start-target"]' }, { name: "start-action", selector: '[data-testid="home-add-project"], [data-testid="no-session-create"], [data-testid^="workspace-start-"]:not([data-testid="workspace-start-target"]), [data-testid^="cli-start-agent-"]', key: { self: !0, attr: "data-testid" } }, { name: "start-status", selector: '[role="status"], [role="alert"]' }, { name: "start-status-action", selector: '[role="status"] > button, [role="alert"] > button' }, { name: "start-link", selector: '[data-testid$="-panel"] button.text-subtext-0' }, { name: "start-shortcut-row", selector: '[data-testid="no-session-panel"] dl > div' }, { name: "start-shortcut-label", selector: '[data-testid="no-session-panel"] dl dt' }, { name: "start-shortcut-key", selector: '[data-testid="no-session-panel"] dl kbd' }], "folder-browser": [{ name: "folder-browser", selector: '[data-testid="dir-browser"]' }, { name: "folder-browser-mode-toggle", selector: '[data-testid="dir-browser-mode-toggle"]' }, { name: "folder-browser-up", selector: '[data-testid="dir-browser-up"]' }, { name: "folder-browser-crumbs", selector: '[data-testid="dir-browser"] span.min-w-0.flex-1' }, { name: "folder-browser-crumb", selector: '[data-testid="dir-browser"] span.min-w-0.flex-1 button' }, { name: "folder-browser-filter", selector: '[data-testid="dir-browser-filter"]' }, { name: "folder-browser-list", selector: '[data-testid="dir-browser"] div.overflow-y-auto' }, { name: "folder-browser-entry", selector: '[data-testid^="dir-browser-entry-"]', key: { self: !0, attr: "data-testid", strip: "dir-browser-entry-" } }, { name: "folder-browser-entry-name", selector: '[data-testid^="dir-browser-entry-"] > span:first-child', key: { closest: '[data-testid^="dir-browser-entry-"]', attr: "data-testid", strip: "dir-browser-entry-" } }, { name: "folder-browser-git", selector: '[data-testid^="dir-browser-entry-"] > span:last-child:not(:first-child)', key: { closest: '[data-testid^="dir-browser-entry-"]', attr: "data-testid", strip: "dir-browser-entry-" } }, { name: "folder-browser-note", selector: '[data-testid="dir-browser"] div.overflow-y-auto > div' }, { name: "folder-browser-use", selector: '[data-testid="dir-browser-use"]' }, { name: "folder-browser-path-input", selector: '[data-testid="project-path-input"]' }], instructions: [{ name: "instructions-scrim", selector: "body > div.fixed.inset-0" }, { name: "instructions-panel", selector: '[data-testid="instructions-dialog"]' }, { name: "instructions-title", selector: '[data-testid="instructions-dialog"] > h2' }, { name: "instructions-intro", selector: '[data-testid="instructions-dialog"] > p' }, { name: "instructions-label", selector: '[data-testid="instructions-dialog"] > label > span:first-child' }, { name: "instructions-count", selector: '[data-testid="instructions-count"]' }, { name: "instructions-text", selector: '[data-testid="instructions-text"]' }, { name: "instructions-folders", selector: '[data-testid="instructions-folders"]' }, { name: "instructions-error", selector: '[data-testid="instructions-error"]' }, { name: "instructions-cancel", selector: '[data-testid="instructions-dialog"] > div.flex.justify-end > button:first-child' }, { name: "instructions-save", selector: '[data-testid="instructions-save"]' }], memory: [{ name: "memory-scrim", selector: "body > div.fixed.inset-0", key: { self: !0, attr: "data-testid" } }, { name: "memory-panel", selector: '[data-testid="memory-dialog"]' }, { name: "memory-title", selector: '[data-testid="memory-dialog"] > h2' }, { name: "memory-intro", selector: '[data-testid="memory-dialog"] > p' }, { name: "memory-caps", selector: '[data-testid="memory-caps"]' }, { name: "memory-new", selector: '[data-testid="memory-new"]' }, { name: "memory-enabled", selector: '[data-testid="memory-enabled"]' }, { name: "memory-enabled-label", selector: '[data-testid="memory-dialog"] > label.flex > span' }, { name: "memory-note", selector: '[data-testid="memory-dialog"] > span.text-subtext-0' }, { name: "memory-row", selector: '[data-testid^="memory-row-"]', key: { self: !0, attr: "data-testid", strip: "memory-row-" } }, { name: "memory-open", selector: '[data-testid^="memory-open-"]', key: { self: !0, attr: "data-testid", strip: "memory-open-" } }, { name: "memory-file-title", selector: '[data-testid^="memory-row-"] button > span:first-child', key: { closest: '[data-testid^="memory-row-"]', attr: "data-testid", strip: "memory-row-" } }, { name: "memory-file-summary", selector: '[data-testid^="memory-row-"] button > span.truncate', key: { closest: '[data-testid^="memory-row-"]', attr: "data-testid", strip: "memory-row-" } }, { name: "memory-file-meta", selector: '[data-testid^="memory-row-"] button > span:last-child', key: { closest: '[data-testid^="memory-row-"]', attr: "data-testid", strip: "memory-row-" } }, { name: "memory-delete", selector: '[data-testid^="memory-delete-"]', key: { self: !0, attr: "data-testid", strip: "memory-delete-" } }, { name: "memory-error", selector: '[data-testid="memory-error"]' }, { name: "memory-close", selector: '[data-testid="memory-dialog"] > div.flex.justify-end > button' }, { name: "memory-file-name", selector: '[data-testid="memory-file-name"]' }, { name: "memory-name", selector: '[data-testid="memory-name"]' }, { name: "memory-count", selector: '[data-testid="memory-count"]' }, { name: "memory-text", selector: '[data-testid="memory-text"]' }, { name: "memory-conflict", selector: '[data-testid="memory-conflict"]' }, { name: "memory-reload", selector: '[data-testid="memory-reload"]' }, { name: "memory-back", selector: '[data-testid="memory-back"]' }, { name: "memory-save", selector: '[data-testid="memory-save"]' }, { name: "memory-confirm", selector: '[data-testid="confirm-dialog"]' }, { name: "memory-confirm-message", selector: ".confirm-dialog__message" }], worktree: [{ name: "worktree-plus", selector: '[data-testid^="worktree-menu-"]' }, { name: "worktree-popover", selector: '[role="dialog"][aria-label="Git worktrees"]' }, { name: "worktree-heading", selector: '[role="dialog"][aria-label="Git worktrees"] > div:first-child > span:first-child' }, { name: "worktree-project", selector: '[role="dialog"][aria-label="Git worktrees"] > div:first-child > span:last-child' }, { name: "worktree-list", selector: '[role="dialog"][aria-label="Git worktrees"] > div.overflow-y-auto' }, { name: "worktree-note", selector: '[role="dialog"][aria-label="Git worktrees"] > div.overflow-y-auto > div:not(.worktree-menu__entry)' }, { name: "worktree-entry", selector: '[data-testid^="worktree-entry-"]', key: { self: !0, attr: "data-testid", strip: "worktree-entry-" } }, { name: "worktree-entry-branch", selector: ".worktree-menu__entry-branch", key: { closest: '[data-testid^="worktree-entry-"]', attr: "data-testid", strip: "worktree-entry-" } }, { name: "worktree-badge", selector: '[data-testid^="worktree-entry-"] .worktree-menu__entry-branch > span', key: { closest: '[data-testid^="worktree-entry-"]', attr: "data-testid", strip: "worktree-entry-" } }, { name: "worktree-entry-path", selector: ".worktree-menu__entry-path", key: { closest: '[data-testid^="worktree-entry-"]', attr: "data-testid", strip: "worktree-entry-" } }, { name: "worktree-open", selector: '[data-testid^="worktree-open-"]', key: { self: !0, attr: "data-testid", strip: "worktree-open-" } }, { name: "worktree-remove", selector: '[data-testid^="worktree-remove-"]', key: { self: !0, attr: "data-testid", strip: "worktree-remove-" } }, { name: "worktree-error", selector: '[data-testid="worktree-error"]' }, { name: "worktree-new", selector: '[data-testid="worktree-new"]' }, { name: "worktree-name-input", selector: '[data-testid="worktree-name-input"]' }, { name: "worktree-start-input", selector: '[data-testid="worktree-start-input"]' }, { name: "worktree-branch-input", selector: '[data-testid="worktree-branch-input"]' }, { name: "worktree-parent-select", selector: '[data-testid="worktree-parent-select"]' }, { name: "worktree-new-branch", selector: '[data-testid="worktree-new-branch"]' }, { name: "worktree-path-input", selector: '[data-testid="worktree-path-input"]' }, { name: "worktree-agent-select", selector: '[data-testid="worktree-agent-select"]' }, { name: "worktree-create-cancel", selector: '[data-testid="worktree-create-cancel"]' }, { name: "worktree-create-submit", selector: '[data-testid="worktree-create-submit"]' }, { name: "worktree-confirm", selector: '[data-testid="confirm-dialog"]' }, { name: "worktree-confirm-message", selector: ".confirm-dialog__message" }, { name: "worktree-confirm-accept", selector: '[data-testid="confirm-accept"]' }, { name: "worktree-confirm-cancel", selector: '[data-testid="confirm-cancel"]' }], "terminal-search": [{ name: "terminal-frame", selector: '[data-testid="persistent-agent-terminal"]' }, { name: "term-search", selector: '[data-testid="term-search"]' }, { name: "term-search-input", selector: '[data-testid="term-search-input"]' }, { name: "term-search-button", selector: '[data-testid="term-search"] > button', key: { self: !0, attr: "title" } }], "agent-control": [{ name: "terminal-frame", selector: '[data-testid="persistent-agent-terminal"]' }, { name: "agent-control-chip", selector: '[data-testid="agent-control-chip"]' }, { name: "agent-control-label", selector: '[data-testid="agent-control-chip"] > span' }, { name: "agent-control-button", selector: '[data-testid="agent-control-chip"] > button' }, { name: "agent-control-error", selector: ".terminal__cli-error" }, { name: "agent-control-ended", selector: ".terminal__exited", key: { self: !0, attr: "data-testid" } }, { name: "agent-control-ended-text", selector: ".terminal__exited-text" }, { name: "agent-control-ended-button", selector: ".terminal__exited-actions > button", key: { self: !0, attr: "data-testid" } }], "phone-size": [{ name: "terminal-frame", selector: '[data-testid="persistent-agent-terminal"]' }, { name: "phone-size-notice", selector: '[data-testid="phone-size-notice"]' }, { name: "phone-size-chip", selector: '[data-testid="phone-size-chip"]' }, { name: "phone-size-heading", selector: '[data-testid="phone-size-notice"] span.font-semibold' }, { name: "phone-size-text", selector: '[data-testid="phone-size-notice"] span:not(.font-semibold)' }, { name: "phone-size-fold", selector: '[aria-label="Keep phone size and hide this"]' }, { name: "phone-size-button", selector: '[data-testid="phone-size-notice"] div.flex.flex-wrap > button, [data-testid="phone-size-chip"] > button' }], window: [{ name: "sidebar-card", selector: '[data-testid="sidebar-card"]' }, { name: "main-card", selector: '[data-testid="main-card"]' }, { name: "tools-card", selector: '[data-testid="tools-card"]' }, { name: "sidebar-toggle", selector: '[data-testid="sidebar-collapse-toggle"]' }, { name: "drawer-toggle", selector: '[data-testid="workspace-tools-toggle"]' }, { name: "resize-sidebar", selector: '[data-testid="resize-sidebar"]' }, { name: "resize-tools", selector: '[data-testid="resize-tools"]' }, { name: "tools-tab", selector: 'nav[aria-label="Files, Git and Browser"] > button' }, { name: "status-bar", selector: "footer.status-bar" }], settings: [{ name: "settings-modal", selector: '[data-testid="settings-modal"]' }, { name: "settings-nav-card", selector: '[data-testid="settings-modal"] > nav' }, { name: "settings-close", selector: '[data-testid="settings-close"]' }, { name: "settings-nav", selector: 'nav [data-testid^="settings-nav-"]', key: { self: !0, attr: "data-testid", strip: "settings-nav-" } }, { name: "settings-main-card", selector: '[data-testid="settings-modal"] > main' }, { name: "settings-search", selector: '[data-testid="settings-search"]' }, { name: "settings-title", selector: '[data-testid="settings-modal"] > main h1' }, { name: "settings-body", selector: '[data-testid="settings-modal"] .settings-modal__body' }, { name: "settings-group-title", selector: '[data-testid="settings-modal"] > main h3' }, { name: "settings-group-card", selector: '[data-testid="settings-modal"] > main section > div.rounded-ui' }, { name: "settings-row", selector: '[data-testid="settings-modal"] [data-setting-row]' }, { name: "settings-row-title", selector: '[data-testid="settings-modal"] [data-setting-row] > div:first-child > div:first-child' }, { name: "settings-row-description", selector: '[data-testid="settings-modal"] [data-setting-row] > div:first-child > div:nth-child(2)' }, { name: "settings-result-title", selector: '[data-testid^="settings-result-"] > h2' }] };
export {
  sy as NAMED_ELEMENTS,
  o0 as React,
  Y0 as SCHEMA,
  iy as STYLE_KEYS,
  oy as describeToGpui,
  ny as jsxRuntime,
  ay as mount,
  ly as reactDom,
  ry as sdk
};
