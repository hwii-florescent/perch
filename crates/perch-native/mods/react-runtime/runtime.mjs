function ms(a, l) {
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
const Qh = /* @__PURE__ */ new Set(["hover", "focus", "focus-visible", "focus-within", "active", "disabled", "enabled", "checked"]), Vh = /* @__PURE__ */ new Set(["not", "is", "where", "has", "nth-child"]), Xh = /* @__PURE__ */ new Set(["first-child", "last-child", "only-child", "root", ...Qh]);
function Io(a) {
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
  return [Io(a.slice(l, s)), s];
}
function Lh(a, l) {
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
function ps(a) {
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
function Zh(a, l) {
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
      const p = f[3] ?? f[4] ?? f[5];
      s.attrs.push({ name: Io(f[1]).toLowerCase(), op: f[2] ?? null, value: p === void 0 ? null : Io(p) }), l = d + 1, i = !0;
      continue;
    }
    if (o === ":") {
      if (a[l + 1] === ":") {
        const [p, x] = bl(a, l + 2), k = p.toLowerCase();
        if (k !== "before" && k !== "after") throw new ae(`::${k} is not supported`);
        if (s.pseudoElement = k, l = x, i = !0, l < a.length && !/[\s>]/.test(a[l])) throw new ae(`nothing may follow ::${k} in ${JSON.stringify(a)}`);
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
        if (!Vh.has(f)) throw new ae(`:${f}() is not supported`);
        const p = Lh(a, l + 1), x = a.slice(l + 1, p).trim();
        if (l = p + 1, f === "nth-child") {
          if (!/^\d+$/.test(x)) throw new ae(`:nth-child(${x}) is not supported (only a number)`);
          s.pseudos.push({ name: f, n: Number(x) });
        } else {
          const k = ps(x).map(hs);
          if (f === "has" && k.some((E) => E.length !== 1)) throw new ae(`:has(${x}) is not supported (only a compound selector)`);
          s.pseudos.push({ name: f, list: k });
        }
      } else {
        if (!Xh.has(f)) throw new ae(`:${f} is not supported`);
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
function hs(a) {
  const l = [];
  let s = 0, i = null;
  for (a = a.trim(); s < a.length; ) {
    const [o, d] = Zh(a, s);
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
const wd = /* @__PURE__ */ new Map();
function Ir(a) {
  let l = wd.get(a);
  return l || (l = ps(a).map(hs), wd.set(a, l)), l;
}
function pf(a) {
  const l = [0, 0, 0], s = (i) => {
    l[0] += i[0], l[1] += i[1], l[2] += i[2];
  };
  for (const { compound: i } of a) {
    i.id && l[0]++, l[1] += i.classes.length + i.attrs.length, i.tag && i.tag !== "*" && l[2]++, i.pseudoElement && l[2]++;
    for (const o of i.pseudos)
      if (o.name !== "where")
        if (o.list) {
          const d = o.list.map(pf).sort((m, f) => f[0] - m[0] || f[1] - m[1] || f[2] - m[2])[0];
          s(d);
        } else l[1]++;
  }
  return l;
}
function Jh(a, { name: l, op: s, value: i }) {
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
function hf(a, l) {
  for (const s of a.children) if (l(s) || hf(s, l)) return !0;
  return !1;
}
function gf(a, l, s, i) {
  if ((l.pseudoElement ?? null) !== (i ? s.pseudo ?? null : null) || l.tag && l.tag !== "*" && a.tagName !== l.tag || l.id && a.getAttribute("id") !== l.id) return !1;
  if (l.classes.length) {
    const o = a.classList ?? [];
    for (const d of l.classes) if (!o.includes(d)) return !1;
  }
  for (const o of l.attrs) if (!Jh(a, o)) return !1;
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
        if (a.watchesDescendants = !0, !o.list.some(([{ compound: d }]) => hf(a, (m) => gf(m, d, s, !1)))) return !1;
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
    const { compound: p, combinator: x } = l[m];
    if (!gf(d, p, s, f)) return !1;
    if (m === 0) return !0;
    if (x === ">") return !!d.parentElement && o(d.parentElement, m - 1, !1);
    for (let k = d.parentElement; k; k = k.parentElement) if (o(k, m - 1, !1)) return !0;
    return !1;
  };
  return o(a, l.length - 1, i);
}
function Wh(a, l, s = {}) {
  return (typeof l == "string" ? Ir(l) : l).some((o) => qa(a, o, s));
}
function bf(a, l, s = {}) {
  return qa(a, l, s);
}
function kl(a, l, s = {}) {
  const i = Ir(l), o = [], d = (m) => {
    for (const f of m.children)
      i.some((p) => qa(f, p, s)) && o.push(f), d(f);
  };
  return d(a), o;
}
function vf(a, l, s = {}) {
  const i = Ir(l);
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
let Fh = 1;
class $o {
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
class gs {
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
class $r {
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
  constructor(l, s = {}, i = null) {
    super(), this.nodeType = 1, this.id = `n${Fh++}`, this.tagName = l.toLowerCase(), this.props = s, this.childNodes = [], this.parentNode = null, this.ownerDocument = i, this.hidden = !1, this.state = { hover: !1, focus: !1, active: !1 }, this.bounds = null, this.version = 0;
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
    return Wh(this, l);
  }
  closest(l) {
    return vf(this, l);
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
    return l ? new $o(l.x, l.y, l.width, l.height) : new $o();
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
    const l = this, s = (m) => String(m).startsWith("--") ? String(m) : String(m).replace(/-([a-z])/g, (f, p) => p.toUpperCase()), i = (m) => {
      const f = l.props.style?.[m];
      return f == null || typeof f == "boolean" ? "" : typeof f == "number" && f !== 0 ? `${f}px` : String(f);
    }, o = (m) => l.inline && m in l.inline ? l.inline[m] : i(m), d = (m, f) => {
      const p = f == null ? "" : String(f);
      o(m) !== p && (l.inline ??= {}, p === i(m) ? delete l.inline[m] : l.inline[m] = p, l.touch(), l.ownerDocument?.restyled());
    };
    return this.styleView = new Proxy({}, {
      get: (m, f) => {
        if (typeof f == "string")
          return f === "setProperty" ? (p, x) => d(s(p), x) : f === "removeProperty" ? (p) => {
            const x = o(s(p));
            return d(s(p), ""), x;
          } : f === "getPropertyValue" ? (p) => o(s(p)) : o(f);
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
    return _d(this);
  }
  /** `outerHTML` without the attributes named in `omit` (by their DOM names), as the web's drag strips its copy. */
  copyMarkup(l = []) {
    return _d(this, l);
  }
}
const yf = Symbol("perch.stale-layout"), xf = 3;
let Br = !1;
function wf(a) {
  return () => {
    let l, s = !1;
    const i = (o) => {
      const d = Br;
      Br = o < xf;
      try {
        l = a();
      } catch (m) {
        const f = m?.[yf];
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
const Po = "perch-dom:", Ih = /* @__PURE__ */ new Set(["children", "key", "ref", "dangerouslySetInnerHTML"]), $h = { class: "className", for: "htmlFor", tabindex: "tabIndex" };
function _d(a, l = []) {
  const s = new Set(l.map((o) => $h[o] ?? o)), i = (o) => {
    if (!(o instanceof It)) return { x: o.data, ...o.hidden ? { h: 1 } : {} };
    const d = {};
    for (const [m, f] of Object.entries(o.props))
      Ih.has(m) || s.has(m) || f == null || typeof f == "function" || typeof f == "symbol" || (d[m] = f);
    return { t: o.tagName, p: d, c: o.childNodes.map(i), ...o.hidden ? { h: 1 } : {} };
  };
  return Po + JSON.stringify(i(a));
}
function Ph(a, l) {
  if (typeof a != "string" || !a.startsWith(Po)) return null;
  let s;
  try {
    s = JSON.parse(a.slice(Po.length));
  } catch {
    return null;
  }
  const i = (d) => !!d && typeof d == "object" && !Array.isArray(d), o = (d) => {
    if (!i(d)) throw new Error("not a node");
    let m;
    if (typeof d.x == "string") m = new $r(d.x);
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
function Sd(a) {
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
    const i = s(this.measureKey(l));
    if (Br && (!i || this.stale?.())) throw { [yf]: this };
    return i ?? null;
  }
  /** An element's `style` was written: the tree is described again once the writing script is done. */
  restyled() {
    this.restyling || (this.restyling = !0, queueMicrotask(() => {
      this.restyling = !1, this.afterCommit?.();
    }));
  }
  focus(l) {
    this.activeElement && this.activeElement !== l && this.blur(this.activeElement), this.activeElement = l, l.state.focus = !0, l.state.pointerFocus = !1, Sd(l), this.perch?.focused?.(l);
  }
  blur(l) {
    l.state.focus = !1, Sd(l), this.activeElement === l && (this.activeElement = this.body);
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
  setTimeout(l, s, ...i) {
    return globalThis.setTimeout(l, s, ...i);
  }
  clearTimeout(l) {
    return globalThis.clearTimeout(l);
  }
}
function _f(a) {
  return {
    setTimeout: (l, s = 0, ...i) => a.setTimeout(() => l(...i), Math.max(0, Number(s) || 0)),
    clearTimeout: (l) => {
      l != null && a.clearTimeout(l);
    }
  };
}
const kd = Symbol.for("perch.react.globals");
function Ze(a, l, s) {
  Object.defineProperty(a, l, { value: s, configurable: !0, writable: !0, enumerable: !1 });
}
function l0(a, l = globalThis) {
  const s = new n0(a), i = new a0(a, s);
  s.defaultView = i;
  const o = a.storage ?? new e0();
  if (typeof l.setTimeout != "function") {
    if (typeof a.setTimeout != "function") throw new Error("the engine has no setTimeout and the perch host gives none (perch.setTimeout)");
    const f = _f(a);
    Ze(l, "setTimeout", f.setTimeout), Ze(l, "clearTimeout", f.clearTimeout);
  }
  typeof l.queueMicrotask != "function" && Ze(l, "queueMicrotask", (f) => {
    Promise.resolve().then(f);
  }), Ze(l, "requestAnimationFrame", (f) => l.setTimeout(() => f(Date.now()), 0)), Ze(l, "cancelAnimationFrame", (f) => l.clearTimeout(f));
  const d = { document: s, window: i, localStorage: o, HTMLElement: It, Element: It };
  for (const f of Object.keys(d))
    Object.defineProperty(l, f, { get: () => l[kd]?.[f], configurable: !0, enumerable: !1 });
  l[kd] = d, Ze(l, "DOMRect", $o), Ze(l, "getComputedStyle", r0), typeof l.ResizeObserver != "function" && Ze(l, "ResizeObserver", t0);
  const m = l.navigator && typeof l.navigator == "object" ? l.navigator : {};
  if (!m.clipboard && a.clipboard)
    try {
      Ze(m, "clipboard", a.clipboard);
    } catch {
    }
  return l.navigator || Ze(l, "navigator", m), { document: s, window: i, globals: d };
}
function r0(a) {
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
function ts(a, l = !1) {
  if (!(l ? a?.tagName === "input" && Sf(a) : a?.tagName === "button" && !/^(button|reset)$/.test(String(a.props.type ?? "submit")) && !a.props.disabled)) return null;
  for (let i = a.parentElement; i; i = i.parentElement) if (i.tagName === "form") return i;
  return null;
}
const Sf = (a) => a?.tagName === "textarea" || a?.tagName === "input" && /^(text|search|url|email|tel|password|number|)$/.test(String(a.props.type ?? ""));
//! Evaluated before anything else in the runtime bundle: React's scheduler reads `setTimeout` and `queueMicrotask`
//! once, when it loads, so an engine without them (QuickJS) gets the host's (`perch.setTimeout`) first.
const Ed = globalThis.perch;
if (typeof globalThis.setTimeout != "function" && typeof Ed?.setTimeout == "function") {
  const a = _f(Ed);
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
var Yo = { exports: {} }, pt = {};
/**
 * @license React
 * react.production.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var zd;
function o0() {
  if (zd) return pt;
  zd = 1;
  var a = Symbol.for("react.transitional.element"), l = Symbol.for("react.portal"), s = Symbol.for("react.fragment"), i = Symbol.for("react.strict_mode"), o = Symbol.for("react.profiler"), d = Symbol.for("react.consumer"), m = Symbol.for("react.context"), f = Symbol.for("react.forward_ref"), p = Symbol.for("react.suspense"), x = Symbol.for("react.memo"), k = Symbol.for("react.lazy"), E = Symbol.for("react.activity"), w = Symbol.iterator;
  function N(T) {
    return T === null || typeof T != "object" ? null : (T = w && T[w] || T["@@iterator"], typeof T == "function" ? T : null);
  }
  var S = {
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
  function O(T, V, et) {
    this.props = T, this.context = V, this.refs = z, this.updater = et || S;
  }
  O.prototype.isReactComponent = {}, O.prototype.setState = function(T, V) {
    if (typeof T != "object" && typeof T != "function" && T != null)
      throw Error(
        "takes an object of state variables to update or a function which returns an object of state variables."
      );
    this.updater.enqueueSetState(this, T, V, "setState");
  }, O.prototype.forceUpdate = function(T) {
    this.updater.enqueueForceUpdate(this, T, "forceUpdate");
  };
  function D() {
  }
  D.prototype = O.prototype;
  function A(T, V, et) {
    this.props = T, this.context = V, this.refs = z, this.updater = et || S;
  }
  var X = A.prototype = new D();
  X.constructor = A, y(X, O.prototype), X.isPureReactComponent = !0;
  var U = Array.isArray;
  function R() {
  }
  var g = { H: null, A: null, T: null, S: null }, v = Object.prototype.hasOwnProperty;
  function h(T, V, et) {
    var it = et.ref;
    return {
      $$typeof: a,
      type: T,
      key: V,
      ref: it !== void 0 ? it : null,
      props: et
    };
  }
  function _(T, V) {
    return h(T.type, V, T.props);
  }
  function M(T) {
    return typeof T == "object" && T !== null && T.$$typeof === a;
  }
  function B(T) {
    var V = { "=": "=0", ":": "=2" };
    return "$" + T.replace(/[=:]/g, function(et) {
      return V[et];
    });
  }
  var L = /\/+/g;
  function I(T, V) {
    return typeof T == "object" && T !== null && T.key != null ? B("" + T.key) : V.toString(36);
  }
  function $(T) {
    switch (T.status) {
      case "fulfilled":
        return T.value;
      case "rejected":
        throw T.reason;
      default:
        switch (typeof T.status == "string" ? T.then(R, R) : (T.status = "pending", T.then(
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
            case k:
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
      return ot = ot(T), kt = it === "" ? "." + I(T, 0) : it, U(ot) ? (et = "", kt != null && (et = kt.replace(L, "$&/") + "/"), Q(ot, V, et, "", function(Kn) {
        return Kn;
      })) : ot != null && (M(ot) && (ot = _(
        ot,
        et + (ot.key == null || T && T.key === ot.key ? "" : ("" + ot.key).replace(
          L,
          "$&/"
        ) + "/") + kt
      )), V.push(ot)), 1;
    kt = 0;
    var Zt = it === "" ? "." : it + ":";
    if (U(T))
      for (var ht = 0; ht < T.length; ht++)
        it = T[ht], st = Zt + I(it, ht), kt += Q(
          it,
          V,
          et,
          st,
          ot
        );
    else if (ht = N(T), typeof ht == "function")
      for (T = ht.call(T), ht = 0; !(it = T.next()).done; )
        it = it.value, st = Zt + I(it, ht++), kt += Q(
          it,
          V,
          et,
          st,
          ot
        );
    else if (st === "object") {
      if (typeof T.then == "function")
        return Q(
          $(T),
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
  function Z(T, V, et) {
    if (T == null) return T;
    var it = [], ot = 0;
    return Q(T, it, "", "", function(st) {
      return V.call(et, st, ot++);
    }), it;
  }
  function P(T) {
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
    map: Z,
    forEach: function(T, V, et) {
      Z(
        T,
        function() {
          V.apply(this, arguments);
        },
        et
      );
    },
    count: function(T) {
      var V = 0;
      return Z(T, function() {
        V++;
      }), V;
    },
    toArray: function(T) {
      return Z(T, function(V) {
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
  return pt.Activity = E, pt.Children = K, pt.Component = O, pt.Fragment = s, pt.Profiler = o, pt.PureComponent = A, pt.StrictMode = i, pt.Suspense = p, pt.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE = g, pt.__COMPILER_RUNTIME = {
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
  }, pt.cloneElement = function(T, V, et) {
    if (T == null)
      throw Error(
        "The argument must be a React element, but you passed " + T + "."
      );
    var it = y({}, T.props), ot = T.key;
    if (V != null)
      for (st in V.key !== void 0 && (ot = "" + V.key), V)
        !v.call(V, st) || st === "key" || st === "__self" || st === "__source" || st === "ref" && V.ref === void 0 || (it[st] = V[st]);
    var st = arguments.length - 2;
    if (st === 1) it.children = et;
    else if (1 < st) {
      for (var kt = Array(st), Zt = 0; Zt < st; Zt++)
        kt[Zt] = arguments[Zt + 2];
      it.children = kt;
    }
    return h(T.type, ot, it);
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
        v.call(V, it) && it !== "key" && it !== "__self" && it !== "__source" && (ot[it] = V[it]);
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
    return h(T, st, ot);
  }, pt.createRef = function() {
    return { current: null };
  }, pt.forwardRef = function(T) {
    return { $$typeof: f, render: T };
  }, pt.isValidElement = M, pt.lazy = function(T) {
    return {
      $$typeof: k,
      _payload: { _status: -1, _result: T },
      _init: P
    };
  }, pt.memo = function(T, V) {
    return {
      $$typeof: x,
      type: T,
      compare: V === void 0 ? null : V
    };
  }, pt.startTransition = function(T) {
    var V = g.T, et = {};
    g.T = et;
    try {
      var it = T(), ot = g.S;
      ot !== null && ot(et, it), typeof it == "object" && it !== null && typeof it.then == "function" && it.then(R, G);
    } catch (st) {
      G(st);
    } finally {
      V !== null && et.types !== null && (V.types = et.types), g.T = V;
    }
  }, pt.unstable_useCacheRefresh = function() {
    return g.H.useCacheRefresh();
  }, pt.use = function(T) {
    return g.H.use(T);
  }, pt.useActionState = function(T, V, et) {
    return g.H.useActionState(T, V, et);
  }, pt.useCallback = function(T, V) {
    return g.H.useCallback(T, V);
  }, pt.useContext = function(T) {
    return g.H.useContext(T);
  }, pt.useDebugValue = function() {
  }, pt.useDeferredValue = function(T, V) {
    return g.H.useDeferredValue(T, V);
  }, pt.useEffect = function(T, V) {
    return g.H.useEffect(T, V);
  }, pt.useEffectEvent = function(T) {
    return g.H.useEffectEvent(T);
  }, pt.useId = function() {
    return g.H.useId();
  }, pt.useImperativeHandle = function(T, V, et) {
    return g.H.useImperativeHandle(T, V, et);
  }, pt.useInsertionEffect = function(T, V) {
    return g.H.useInsertionEffect(T, V);
  }, pt.useLayoutEffect = function(T, V) {
    return g.H.useLayoutEffect(T, V);
  }, pt.useMemo = function(T, V) {
    return g.H.useMemo(T, V);
  }, pt.useOptimistic = function(T, V) {
    return g.H.useOptimistic(T, V);
  }, pt.useReducer = function(T, V, et) {
    return g.H.useReducer(T, V, et);
  }, pt.useRef = function(T) {
    return g.H.useRef(T);
  }, pt.useState = function(T) {
    return g.H.useState(T);
  }, pt.useSyncExternalStore = function(T, V, et) {
    return g.H.useSyncExternalStore(
      T,
      V,
      et
    );
  }, pt.useTransition = function() {
    return g.H.useTransition();
  }, pt.version = "19.2.8", pt;
}
var Nd;
function s0() {
  return Nd || (Nd = 1, Yo.exports = o0()), Yo.exports;
}
var dt = s0();
const kf = /* @__PURE__ */ bs(dt), c0 = /* @__PURE__ */ ms({
  __proto__: null,
  default: kf
}, [dt]);
//! "react" as the runtime bundles it, for its own code, the stock screens and every screen's `react` import: React
//! itself, with `useEffect` and `useLayoutEffect` run through `measured` (`dom.mjs`), so an effect that measures a
//! box the engine has not laid out yet runs again once it has (layout readback).
const u0 = kf ?? c0;
function Fe(a, l) {
  return dt.useEffect(wf(a), l);
}
function es(a, l) {
  return dt.useLayoutEffect(wf(a), l);
}
const d0 = /* @__PURE__ */ ms({
  __proto__: null,
  default: u0,
  useEffect: Fe,
  useLayoutEffect: es
}, [dt]);
var Go = { exports: {} }, vl = {};
/**
 * @license React
 * react-jsx-runtime.production.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var Td;
function f0() {
  if (Td) return vl;
  Td = 1;
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
var Cd;
function m0() {
  return Cd || (Cd = 1, Go.exports = f0()), Go.exports;
}
var ft = m0();
const p0 = /* @__PURE__ */ bs(ft), oy = /* @__PURE__ */ ms({
  __proto__: null,
  default: p0
}, [ft]);
var Ko = { exports: {} }, Qo = { exports: {} };
const h0 = /* @__PURE__ */ i0(d0);
var Vo = { exports: {} }, Xo = {};
/**
 * @license React
 * scheduler.production.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var Md;
function g0() {
  return Md || (Md = 1, (function(a) {
    function l(Q, Z) {
      var P = Q.length;
      Q.push(Z);
      t: for (; 0 < P; ) {
        var G = P - 1 >>> 1, K = Q[G];
        if (0 < o(K, Z))
          Q[G] = Z, Q[P] = K, P = G;
        else break t;
      }
    }
    function s(Q) {
      return Q.length === 0 ? null : Q[0];
    }
    function i(Q) {
      if (Q.length === 0) return null;
      var Z = Q[0], P = Q.pop();
      if (P !== Z) {
        Q[0] = P;
        t: for (var G = 0, K = Q.length, T = K >>> 1; G < T; ) {
          var V = 2 * (G + 1) - 1, et = Q[V], it = V + 1, ot = Q[it];
          if (0 > o(et, P))
            it < K && 0 > o(ot, et) ? (Q[G] = ot, Q[it] = P, G = it) : (Q[G] = et, Q[V] = P, G = V);
          else if (it < K && 0 > o(ot, P))
            Q[G] = ot, Q[it] = P, G = it;
          else break t;
        }
      }
      return Z;
    }
    function o(Q, Z) {
      var P = Q.sortIndex - Z.sortIndex;
      return P !== 0 ? P : Q.id - Z.id;
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
    var p = [], x = [], k = 1, E = null, w = 3, N = !1, S = !1, y = !1, z = !1, O = typeof setTimeout == "function" ? setTimeout : null, D = typeof clearTimeout == "function" ? clearTimeout : null, A = typeof setImmediate < "u" ? setImmediate : null;
    function X(Q) {
      for (var Z = s(x); Z !== null; ) {
        if (Z.callback === null) i(x);
        else if (Z.startTime <= Q)
          i(x), Z.sortIndex = Z.expirationTime, l(p, Z);
        else break;
        Z = s(x);
      }
    }
    function U(Q) {
      if (y = !1, X(Q), !S)
        if (s(p) !== null)
          S = !0, R || (R = !0, B());
        else {
          var Z = s(x);
          Z !== null && $(U, Z.startTime - Q);
        }
    }
    var R = !1, g = -1, v = 5, h = -1;
    function _() {
      return z ? !0 : !(a.unstable_now() - h < v);
    }
    function M() {
      if (z = !1, R) {
        var Q = a.unstable_now();
        h = Q;
        var Z = !0;
        try {
          t: {
            S = !1, y && (y = !1, D(g), g = -1), N = !0;
            var P = w;
            try {
              e: {
                for (X(Q), E = s(p); E !== null && !(E.expirationTime > Q && _()); ) {
                  var G = E.callback;
                  if (typeof G == "function") {
                    E.callback = null, w = E.priorityLevel;
                    var K = G(
                      E.expirationTime <= Q
                    );
                    if (Q = a.unstable_now(), typeof K == "function") {
                      E.callback = K, X(Q), Z = !0;
                      break e;
                    }
                    E === s(p) && i(p), X(Q);
                  } else i(p);
                  E = s(p);
                }
                if (E !== null) Z = !0;
                else {
                  var T = s(x);
                  T !== null && $(
                    U,
                    T.startTime - Q
                  ), Z = !1;
                }
              }
              break t;
            } finally {
              E = null, w = P, N = !1;
            }
            Z = void 0;
          }
        } finally {
          Z ? B() : R = !1;
        }
      }
    }
    var B;
    if (typeof A == "function")
      B = function() {
        A(M);
      };
    else if (typeof MessageChannel < "u") {
      var L = new MessageChannel(), I = L.port2;
      L.port1.onmessage = M, B = function() {
        I.postMessage(null);
      };
    } else
      B = function() {
        O(M, 0);
      };
    function $(Q, Z) {
      g = O(function() {
        Q(a.unstable_now());
      }, Z);
    }
    a.unstable_IdlePriority = 5, a.unstable_ImmediatePriority = 1, a.unstable_LowPriority = 4, a.unstable_NormalPriority = 3, a.unstable_Profiling = null, a.unstable_UserBlockingPriority = 2, a.unstable_cancelCallback = function(Q) {
      Q.callback = null;
    }, a.unstable_forceFrameRate = function(Q) {
      0 > Q || 125 < Q ? console.error(
        "forceFrameRate takes a positive int between 0 and 125, forcing frame rates higher than 125 fps is not supported"
      ) : v = 0 < Q ? Math.floor(1e3 / Q) : 5;
    }, a.unstable_getCurrentPriorityLevel = function() {
      return w;
    }, a.unstable_next = function(Q) {
      switch (w) {
        case 1:
        case 2:
        case 3:
          var Z = 3;
          break;
        default:
          Z = w;
      }
      var P = w;
      w = Z;
      try {
        return Q();
      } finally {
        w = P;
      }
    }, a.unstable_requestPaint = function() {
      z = !0;
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
      var P = w;
      w = Q;
      try {
        return Z();
      } finally {
        w = P;
      }
    }, a.unstable_scheduleCallback = function(Q, Z, P) {
      var G = a.unstable_now();
      switch (typeof P == "object" && P !== null ? (P = P.delay, P = typeof P == "number" && 0 < P ? G + P : G) : P = G, Q) {
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
      return K = P + K, Q = {
        id: k++,
        callback: Z,
        priorityLevel: Q,
        startTime: P,
        expirationTime: K,
        sortIndex: -1
      }, P > G ? (Q.sortIndex = P, l(x, Q), s(p) === null && Q === s(x) && (y ? (D(g), g = -1) : y = !0, $(U, P - G))) : (Q.sortIndex = K, l(p, Q), S || N || (S = !0, R || (R = !0, B()))), Q;
    }, a.unstable_shouldYield = _, a.unstable_wrapCallback = function(Q) {
      var Z = w;
      return function() {
        var P = w;
        w = Z;
        try {
          return Q.apply(this, arguments);
        } finally {
          w = P;
        }
      };
    };
  })(Xo)), Xo;
}
var Ad;
function b0() {
  return Ad || (Ad = 1, Vo.exports = g0()), Vo.exports;
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
var jd;
function v0() {
  return jd || (jd = 1, (function(a) {
    a.exports = function(l) {
      function s(t, e, n, r) {
        return new Jm(t, e, n, r);
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
      function k(t) {
        return t === null || typeof t != "object" ? null : (t = Yu && t[Yu] || t["@@iterator"], typeof t == "function" ? t : null);
      }
      function E(t) {
        if (t == null) return null;
        if (typeof t == "function")
          return t.$$typeof === Pm ? null : t.displayName || t.name || null;
        if (typeof t == "string") return t;
        switch (t) {
          case ya:
            return "Fragment";
          case ro:
            return "Profiler";
          case Uu:
            return "StrictMode";
          case oo:
            return "Suspense";
          case so:
            return "SuspenseList";
          case uo:
            return "Activity";
        }
        if (typeof t == "object")
          switch (t.$$typeof) {
            case va:
              return "Portal";
            case _n:
              return t.displayName || "Context";
            case qu:
              return (t._context.displayName || "Context") + ".Consumer";
            case io:
              var e = t.render;
              return t = t.displayName, t || (t = e.displayName || e.name || "", t = t !== "" ? "ForwardRef(" + t + ")" : "ForwardRef"), t;
            case co:
              return e = t.displayName || null, e !== null ? e : E(t.type) || "Memo";
            case Sn:
              e = t._payload, t = t._init;
              try {
                return E(t(e));
              } catch {
              }
          }
        return null;
      }
      function w(t) {
        return { current: t };
      }
      function N(t) {
        0 > _a || (t.current = bo[_a], bo[_a] = null, _a--);
      }
      function S(t, e) {
        _a++, bo[_a] = t.current, t.current = e;
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
      function O(t, e, n) {
        var r = t.pendingLanes;
        if (r === 0) return 0;
        var c = 0, u = t.suspendedLanes, b = t.pingedLanes;
        t = t.warmLanes;
        var C = r & 134217727;
        return C !== 0 ? (r = C & ~u, r !== 0 ? c = z(r) : (b &= C, b !== 0 ? c = z(b) : n || (n = C & ~t, n !== 0 && (c = z(n))))) : (C = r & ~u, C !== 0 ? c = z(C) : b !== 0 ? c = z(b) : n || (n = r & ~t, n !== 0 && (c = z(n)))), c === 0 ? 0 : e !== 0 && e !== c && (e & u) === 0 && (u = c & -c, n = e & -e, u >= n || u === 32 && (n & 4194048) !== 0) ? e : c;
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
        var t = sr;
        return sr <<= 1, (sr & 62914560) === 0 && (sr = 4194304), t;
      }
      function U(t) {
        for (var e = [], n = 0; 31 > n; n++) e.push(t);
        return e;
      }
      function R(t, e) {
        t.pendingLanes |= e, e !== 268435456 && (t.suspendedLanes = 0, t.pingedLanes = 0, t.warmLanes = 0);
      }
      function g(t, e, n, r, c, u) {
        var b = t.pendingLanes;
        t.pendingLanes = n, t.suspendedLanes = 0, t.pingedLanes = 0, t.warmLanes = 0, t.expiredLanes &= n, t.entangledLanes &= n, t.errorRecoveryDisabledLanes &= n, t.shellSuspendCounter = 0;
        var C = t.entanglements, Y = t.expirationTimes, J = t.hiddenUpdates;
        for (n = b & ~n; 0 < n; ) {
          var tt = 31 - xe(n), W = 1 << tt;
          C[tt] = 0, Y[tt] = -1;
          var nt = J[tt];
          if (nt !== null)
            for (J[tt] = null, tt = 0; tt < nt.length; tt++) {
              var gt = nt[tt];
              gt !== null && (gt.lane &= -536870913);
            }
          n &= ~W;
        }
        r !== 0 && v(t, r, 0), u !== 0 && c === 0 && t.tag !== 0 && (t.suspendedLanes |= u & ~(b & ~e));
      }
      function v(t, e, n) {
        t.pendingLanes |= e, t.suspendedLanes &= ~e;
        var r = 31 - xe(e);
        t.entangledLanes |= e, t.entanglements[r] = t.entanglements[r] | 1073741824 | n & 261930;
      }
      function h(t, e) {
        var n = t.entangledLanes |= e;
        for (t = t.entanglements; n; ) {
          var r = 31 - xe(n), c = 1 << r;
          c & e | t[r] & e && (t[r] |= e), n &= ~c;
        }
      }
      function _(t, e) {
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
      function B(t) {
        return t &= -t, 2 < t ? 8 < t ? (t & 134217727) !== 0 ? 32 : 268435456 : 8 : 2;
      }
      function L(t) {
        if (typeof Oh == "function" && Rh(t), we && typeof we.setStrictMode == "function")
          try {
            we.setStrictMode(rl, t);
          } catch {
          }
      }
      function I(t, e) {
        return t === e && (t !== 0 || 1 / t === 1 / e) || t !== t && e !== e;
      }
      function $(t) {
        if (xo === void 0)
          try {
            throw Error();
          } catch (n) {
            var e = n.stack.trim().match(/\n( *(at )?)/);
            xo = e && e[1] || "", fd = -1 < n.stack.indexOf(`
    at`) ? " (<anonymous>)" : -1 < n.stack.indexOf("@") ? "@unknown:0:0" : "";
          }
        return `
` + xo + t + fd;
      }
      function Q(t, e) {
        if (!t || wo) return "";
        wo = !0;
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
                      var tt = `
` + Y[r].replace(" at new ", " at ");
                      return t.displayName && tt.includes("<anonymous>") && (tt = tt.replace("<anonymous>", t.displayName)), tt;
                    }
                  while (1 <= r && 0 <= c);
                break;
              }
          }
        } finally {
          wo = !1, Error.prepareStackTrace = n;
        }
        return (n = t ? t.displayName || t.name : "") ? $(n) : "";
      }
      function Z(t, e) {
        switch (t.tag) {
          case 26:
          case 27:
          case 5:
            return $(t.type);
          case 16:
            return $("Lazy");
          case 13:
            return t.child !== e && e !== null ? $("Suspense Fallback") : $("Suspense");
          case 19:
            return $("SuspenseList");
          case 0:
          case 15:
            return Q(t.type, !1);
          case 11:
            return Q(t.type.render, !1);
          case 1:
            return Q(t.type, !0);
          case 31:
            return $("Activity");
          default:
            return "";
        }
      }
      function P(t) {
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
          var n = md.get(t);
          return n !== void 0 ? n : (e = {
            value: t,
            source: e,
            stack: P(e)
          }, md.set(t, e), e);
        }
        return {
          value: t,
          source: e,
          stack: P(e)
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
      function V(t) {
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
        S(En, e), S(ol, t), S(te, null), t = np(e), N(te), S(te, t);
      }
      function st() {
        N(te), N(ol), N(En);
      }
      function kt(t) {
        t.memoizedState !== null && S(dr, t);
        var e = te.current, n = ap(e, t.type);
        e !== n && (S(ol, t), S(te, n));
      }
      function Zt(t) {
        ol.current === t && (N(te), N(ol)), dr.current === t && (N(dr), an ? $n._currentValue = xa : $n._currentValue2 = xa);
      }
      function ht(t) {
        var e = Error(
          o(
            418,
            1 < arguments.length && arguments[1] !== void 0 && arguments[1] ? "text" : "HTML",
            ""
          )
        );
        throw Ga(G(e, t)), _o;
      }
      function Kn(t, e) {
        if (!se) throw Error(o(175));
        ah(
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
        if (Vt ? e !== 3 && e !== 27 && (e !== 5 || Pu(t.type) && !rr(t.type, t.memoizedProps)) && Ot && ht(t) : e !== 3 && (e !== 5 || Pu(t.type) && !rr(t.type, t.memoizedProps)) && Ot && ht(t), Qn(t), e === 13) {
          if (!se) throw Error(o(316));
          if (t = t.memoizedState, t = t !== null ? t.dehydrated : null, !t) throw Error(o(317));
          Ot = sh(t);
        } else if (e === 31) {
          if (t = t.memoizedState, t = t !== null ? t.dehydrated : null, !t) throw Error(o(317));
          Ot = oh(t);
        } else
          Ot = Vt && e === 27 ? Zp(
            t.type,
            Ot
          ) : ee ? $u(t.stateNode) : null;
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
        an ? (S(fr, e._currentValue), e._currentValue = n) : (S(fr, e._currentValue2), e._currentValue2 = n);
      }
      function Ie(t) {
        var e = fr.current;
        an ? t._currentValue = e : t._currentValue2 = e, N(fr);
      }
      function ni(t, e, n) {
        for (; t !== null; ) {
          var r = t.alternate;
          if ((t.childLanes & e) !== e ? (t.childLanes |= e, r !== null && (r.childLanes |= e)) : r !== null && (r.childLanes & e) !== e && (r.childLanes |= e), t === n) break;
          t = t.return;
        }
      }
      function ai(t, e, n, r) {
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
                  u.lanes |= n, C = u.alternate, C !== null && (C.lanes |= n), ni(
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
            b.lanes |= n, u = b.alternate, u !== null && (u.lanes |= n), ni(b, n, t), b = null;
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
            b.memoizedState.memoizedState !== c.memoizedState.memoizedState && (t !== null ? t.push($n) : t = [$n]);
          }
          c = c.return;
        }
        t !== null && ai(
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
        Pn = t, rn = null, t = t.dependencies, t !== null && (t.firstContext = null);
      }
      function $t(t) {
        return zs(Pn, t);
      }
      function Cl(t, e) {
        return Pn === null && Vn(t), zs(t, e);
      }
      function zs(t, e) {
        var n = an ? e._currentValue : e._currentValue2;
        if (e = { context: e, memoizedValue: n, next: null }, rn === null) {
          if (t === null) throw Error(o(308));
          rn = e, t.dependencies = { lanes: 0, firstContext: e }, t.flags |= 524288;
        } else rn = rn.next = e;
        return n;
      }
      function li() {
        return {
          controller: new Bh(),
          data: /* @__PURE__ */ new Map(),
          refCount: 0
        };
      }
      function Ka(t) {
        t.refCount--, t.refCount === 0 && Hh(Uh, function() {
          t.controller.abort();
        });
      }
      function Ml() {
      }
      function Ke(t) {
        t !== za && t.next === null && (za === null ? mr = za = t : za = za.next = t), pr = !0, So || (So = !0, km());
      }
      function ma(t, e) {
        if (!ko && pr) {
          ko = !0;
          do
            for (var n = !1, r = mr; r !== null; ) {
              if (t !== 0) {
                var c = r.pendingLanes;
                if (c === 0) var u = 0;
                else {
                  var b = r.suspendedLanes, C = r.pingedLanes;
                  u = (1 << 31 - xe(42 | t) + 1) - 1, u &= c & ~(b & ~C), u = u & 201326741 ? u & 201326741 | 1 : u ? u | 2 : 0;
                }
                u !== 0 && (n = !0, As(r, u));
              } else
                u = _t, u = O(
                  r,
                  r === At ? u : 0,
                  r.cancelPendingCommit !== null || r.timeoutHandle !== In
                ), (u & 3) === 0 || D(r, u) || (n = !0, As(r, u));
              r = r.next;
            }
          while (n);
          ko = !1;
        }
      }
      function Ns() {
        Ts();
      }
      function Ts() {
        pr = So = !1;
        var t = 0;
        ta !== 0 && fp() && (t = ta);
        for (var e = pe(), n = null, r = mr; r !== null; ) {
          var c = r.next, u = Cs(r, e);
          u === 0 ? (r.next = null, n === null ? mr = c : n.next = c, c === null && (za = n)) : (n = r, (t !== 0 || (u & 3) !== 0) && (pr = !0)), r = c;
        }
        Xt !== 0 && Xt !== 5 || ma(t), ta !== 0 && (ta = 0);
      }
      function Cs(t, e) {
        for (var n = t.suspendedLanes, r = t.pingedLanes, c = t.expirationTimes, u = t.pendingLanes & -62914561; 0 < u; ) {
          var b = 31 - xe(u), C = 1 << b, Y = c[b];
          Y === -1 ? ((C & n) === 0 || (C & r) !== 0) && (c[b] = A(C, e)) : Y <= e && (t.expiredLanes |= C), u &= ~C;
        }
        if (e = At, n = _t, n = O(
          t,
          t === e ? n : 0,
          t.cancelPendingCommit !== null || t.timeoutHandle !== In
        ), r = t.callbackNode, n === 0 || t === e && (Ct === 2 || Ct === 9) || t.cancelPendingCommit !== null)
          return r !== null && r !== null && vo(r), t.callbackNode = null, t.callbackPriority = 0;
        if ((n & 3) === 0 || D(t, n)) {
          if (e = n & -n, e === t.callbackPriority) return e;
          switch (r !== null && vo(r), B(n)) {
            case 2:
            case 8:
              n = Ah;
              break;
            case 32:
              n = yo;
              break;
            case 268435456:
              n = jh;
              break;
            default:
              n = yo;
          }
          return r = Ms.bind(null, t), n = cr(n, r), t.callbackPriority = e, t.callbackNode = n, e;
        }
        return r !== null && r !== null && vo(r), t.callbackPriority = 2, t.callbackNode = null, 2;
      }
      function Ms(t, e) {
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
        ), r === 0 ? null : (mu(t, r, e), Cs(t, pe()), t.callbackNode != null && t.callbackNode === n ? Ms.bind(null, t) : null);
      }
      function As(t, e) {
        if (el()) return null;
        mu(t, e, !0);
      }
      function km() {
        yp ? xp(function() {
          (xt & 6) !== 0 ? cr(
            ud,
            Ns
          ) : Ts();
        }) : cr(
          ud,
          Ns
        );
      }
      function ri() {
        if (ta === 0) {
          var t = Na;
          t === 0 && (t = ir, ir <<= 1, (ir & 261888) === 0 && (ir = 256)), ta = t;
        }
        return ta;
      }
      function Em(t, e) {
        if (sl === null) {
          var n = sl = [];
          Eo = 0, Na = ri(), Ta = {
            status: "pending",
            value: void 0,
            then: function(r) {
              n.push(r);
            }
          };
        }
        return Eo++, e.then(js, js), e;
      }
      function js() {
        if (--Eo === 0 && sl !== null) {
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
      function ii() {
        var t = ea.current;
        return t !== null ? t : At.pooledCache;
      }
      function Al(t, e) {
        e === null ? S(ea, ea.current) : S(ea, e.pool);
      }
      function Os() {
        var t = ii();
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
          if (!Dh.call(e, c) || !_e(t[c], e[c]))
            return !1;
        }
        return !0;
      }
      function Rs(t) {
        return t = t.status, t === "fulfilled" || t === "rejected";
      }
      function Ds(t, e, n) {
        switch (n = t[n], n === void 0 ? t.push(e) : n !== e && (e.then(Ml, Ml), e = n), e.status) {
          case "fulfilled":
            return e.value;
          case "rejected":
            throw t = e.reason, Hs(t), t;
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
                throw t = e.reason, Hs(t), t;
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
      function Bs() {
        if (na === null) throw Error(o(459));
        var t = na;
        return na = null, t;
      }
      function Hs(t) {
        if (t === Ca || t === hr)
          throw Error(o(483));
      }
      function Ol(t) {
        var e = cl;
        return cl += 1, Ma === null && (Ma = []), Ds(Ma, t, e);
      }
      function Qa(t, e) {
        e = e.props.ref, t.ref = e !== void 0 ? e : null;
      }
      function Rl(t, e) {
        throw e.$$typeof === Im ? Error(o(525)) : (t = Object.prototype.toString.call(e), Error(
          o(
            31,
            t === "[object Object]" ? "object with keys {" + Object.keys(e).join(", ") + "}" : t
          )
        ));
      }
      function Us(t) {
        function e(H, j) {
          if (t) {
            var q = H.deletions;
            q === null ? (H.deletions = [j], H.flags |= 16) : q.push(j);
          }
        }
        function n(H, j) {
          if (!t) return null;
          for (; j !== null; )
            e(H, j), j = j.sibling;
          return null;
        }
        function r(H) {
          for (var j = /* @__PURE__ */ new Map(); H !== null; )
            H.key !== null ? j.set(H.key, H) : j.set(H.index, H), H = H.sibling;
          return j;
        }
        function c(H, j) {
          return H = nn(H, j), H.index = 0, H.sibling = null, H;
        }
        function u(H, j, q) {
          return H.index = q, t ? (q = H.alternate, q !== null ? (q = q.index, q < j ? (H.flags |= 67108866, j) : q) : (H.flags |= 67108866, j)) : (H.flags |= 1048576, j);
        }
        function b(H) {
          return t && H.alternate === null && (H.flags |= 67108866), H;
        }
        function C(H, j, q, F) {
          return j === null || j.tag !== 6 ? (j = eo(q, H.mode, F), j.return = H, j) : (j = c(j, q), j.return = H, j);
        }
        function Y(H, j, q, F) {
          var ut = q.type;
          return ut === ya ? tt(
            H,
            j,
            q.props.children,
            F,
            q.key
          ) : j !== null && (j.elementType === ut || typeof ut == "object" && ut !== null && ut.$$typeof === Sn && Xn(ut) === j.type) ? (j = c(j, q.props), Qa(j, q), j.return = H, j) : (j = nr(
            q.type,
            q.key,
            q.props,
            null,
            H.mode,
            F
          ), Qa(j, q), j.return = H, j);
        }
        function J(H, j, q, F) {
          return j === null || j.tag !== 4 || j.stateNode.containerInfo !== q.containerInfo || j.stateNode.implementation !== q.implementation ? (j = no(q, H.mode, F), j.return = H, j) : (j = c(j, q.children || []), j.return = H, j);
        }
        function tt(H, j, q, F, ut) {
          return j === null || j.tag !== 7 ? (j = Fn(
            q,
            H.mode,
            F,
            ut
          ), j.return = H, j) : (j = c(j, q), j.return = H, j);
        }
        function W(H, j, q) {
          if (typeof j == "string" && j !== "" || typeof j == "number" || typeof j == "bigint")
            return j = eo(
              "" + j,
              H.mode,
              q
            ), j.return = H, j;
          if (typeof j == "object" && j !== null) {
            switch (j.$$typeof) {
              case ar:
                return q = nr(
                  j.type,
                  j.key,
                  j.props,
                  null,
                  H.mode,
                  q
                ), Qa(q, j), q.return = H, q;
              case va:
                return j = no(
                  j,
                  H.mode,
                  q
                ), j.return = H, j;
              case Sn:
                return j = Xn(j), W(H, j, q);
            }
            if (lr(j) || k(j))
              return j = Fn(
                j,
                H.mode,
                q,
                null
              ), j.return = H, j;
            if (typeof j.then == "function")
              return W(H, Ol(j), q);
            if (j.$$typeof === _n)
              return W(
                H,
                Cl(H, j),
                q
              );
            Rl(H, j);
          }
          return null;
        }
        function nt(H, j, q, F) {
          var ut = j !== null ? j.key : null;
          if (typeof q == "string" && q !== "" || typeof q == "number" || typeof q == "bigint")
            return ut !== null ? null : C(H, j, "" + q, F);
          if (typeof q == "object" && q !== null) {
            switch (q.$$typeof) {
              case ar:
                return q.key === ut ? Y(H, j, q, F) : null;
              case va:
                return q.key === ut ? J(H, j, q, F) : null;
              case Sn:
                return q = Xn(q), nt(H, j, q, F);
            }
            if (lr(q) || k(q))
              return ut !== null ? null : tt(H, j, q, F, null);
            if (typeof q.then == "function")
              return nt(
                H,
                j,
                Ol(q),
                F
              );
            if (q.$$typeof === _n)
              return nt(
                H,
                j,
                Cl(H, q),
                F
              );
            Rl(H, q);
          }
          return null;
        }
        function gt(H, j, q, F, ut) {
          if (typeof F == "string" && F !== "" || typeof F == "number" || typeof F == "bigint")
            return H = H.get(q) || null, C(j, H, "" + F, ut);
          if (typeof F == "object" && F !== null) {
            switch (F.$$typeof) {
              case ar:
                return H = H.get(
                  F.key === null ? q : F.key
                ) || null, Y(j, H, F, ut);
              case va:
                return H = H.get(
                  F.key === null ? q : F.key
                ) || null, J(j, H, F, ut);
              case Sn:
                return F = Xn(F), gt(
                  H,
                  j,
                  q,
                  F,
                  ut
                );
            }
            if (lr(F) || k(F))
              return H = H.get(q) || null, tt(j, H, F, ut, null);
            if (typeof F.then == "function")
              return gt(
                H,
                j,
                q,
                Ol(F),
                ut
              );
            if (F.$$typeof === _n)
              return gt(
                H,
                j,
                q,
                Cl(j, F),
                ut
              );
            Rl(j, F);
          }
          return null;
        }
        function ne(H, j, q, F) {
          for (var ut = null, Dt = null, mt = j, zt = j = 0, Ft = null; mt !== null && zt < q.length; zt++) {
            mt.index > zt ? (Ft = mt, mt = null) : Ft = mt.sibling;
            var Nt = nt(
              H,
              mt,
              q[zt],
              F
            );
            if (Nt === null) {
              mt === null && (mt = Ft);
              break;
            }
            t && mt && Nt.alternate === null && e(H, mt), j = u(Nt, j, zt), Dt === null ? ut = Nt : Dt.sibling = Nt, Dt = Nt, mt = Ft;
          }
          if (zt === q.length)
            return n(H, mt), St && K(H, zt), ut;
          if (mt === null) {
            for (; zt < q.length; zt++)
              mt = W(H, q[zt], F), mt !== null && (j = u(
                mt,
                j,
                zt
              ), Dt === null ? ut = mt : Dt.sibling = mt, Dt = mt);
            return St && K(H, zt), ut;
          }
          for (mt = r(mt); zt < q.length; zt++)
            Ft = gt(
              mt,
              H,
              zt,
              q[zt],
              F
            ), Ft !== null && (t && Ft.alternate !== null && mt.delete(
              Ft.key === null ? zt : Ft.key
            ), j = u(
              Ft,
              j,
              zt
            ), Dt === null ? ut = Ft : Dt.sibling = Ft, Dt = Ft);
          return t && mt.forEach(function(jn) {
            return e(H, jn);
          }), St && K(H, zt), ut;
        }
        function gl(H, j, q, F) {
          if (q == null) throw Error(o(151));
          for (var ut = null, Dt = null, mt = j, zt = j = 0, Ft = null, Nt = q.next(); mt !== null && !Nt.done; zt++, Nt = q.next()) {
            mt.index > zt ? (Ft = mt, mt = null) : Ft = mt.sibling;
            var jn = nt(H, mt, Nt.value, F);
            if (jn === null) {
              mt === null && (mt = Ft);
              break;
            }
            t && mt && jn.alternate === null && e(H, mt), j = u(jn, j, zt), Dt === null ? ut = jn : Dt.sibling = jn, Dt = jn, mt = Ft;
          }
          if (Nt.done)
            return n(H, mt), St && K(H, zt), ut;
          if (mt === null) {
            for (; !Nt.done; zt++, Nt = q.next())
              Nt = W(H, Nt.value, F), Nt !== null && (j = u(
                Nt,
                j,
                zt
              ), Dt === null ? ut = Nt : Dt.sibling = Nt, Dt = Nt);
            return St && K(H, zt), ut;
          }
          for (mt = r(mt); !Nt.done; zt++, Nt = q.next())
            Nt = gt(
              mt,
              H,
              zt,
              Nt.value,
              F
            ), Nt !== null && (t && Nt.alternate !== null && mt.delete(Nt.key === null ? zt : Nt.key), j = u(Nt, j, zt), Dt === null ? ut = Nt : Dt.sibling = Nt, Dt = Nt);
          return t && mt.forEach(function(Kh) {
            return e(H, Kh);
          }), St && K(H, zt), ut;
        }
        function ia(H, j, q, F) {
          if (typeof q == "object" && q !== null && q.type === ya && q.key === null && (q = q.props.children), typeof q == "object" && q !== null) {
            switch (q.$$typeof) {
              case ar:
                t: {
                  for (var ut = q.key; j !== null; ) {
                    if (j.key === ut) {
                      if (ut = q.type, ut === ya) {
                        if (j.tag === 7) {
                          n(
                            H,
                            j.sibling
                          ), F = c(
                            j,
                            q.props.children
                          ), F.return = H, H = F;
                          break t;
                        }
                      } else if (j.elementType === ut || typeof ut == "object" && ut !== null && ut.$$typeof === Sn && Xn(ut) === j.type) {
                        n(
                          H,
                          j.sibling
                        ), F = c(j, q.props), Qa(F, q), F.return = H, H = F;
                        break t;
                      }
                      n(H, j);
                      break;
                    } else e(H, j);
                    j = j.sibling;
                  }
                  q.type === ya ? (F = Fn(
                    q.props.children,
                    H.mode,
                    F,
                    q.key
                  ), F.return = H, H = F) : (F = nr(
                    q.type,
                    q.key,
                    q.props,
                    null,
                    H.mode,
                    F
                  ), Qa(F, q), F.return = H, H = F);
                }
                return b(H);
              case va:
                t: {
                  for (ut = q.key; j !== null; ) {
                    if (j.key === ut)
                      if (j.tag === 4 && j.stateNode.containerInfo === q.containerInfo && j.stateNode.implementation === q.implementation) {
                        n(
                          H,
                          j.sibling
                        ), F = c(
                          j,
                          q.children || []
                        ), F.return = H, H = F;
                        break t;
                      } else {
                        n(H, j);
                        break;
                      }
                    else e(H, j);
                    j = j.sibling;
                  }
                  F = no(q, H.mode, F), F.return = H, H = F;
                }
                return b(H);
              case Sn:
                return q = Xn(q), ia(
                  H,
                  j,
                  q,
                  F
                );
            }
            if (lr(q))
              return ne(
                H,
                j,
                q,
                F
              );
            if (k(q)) {
              if (ut = k(q), typeof ut != "function")
                throw Error(o(150));
              return q = ut.call(q), gl(
                H,
                j,
                q,
                F
              );
            }
            if (typeof q.then == "function")
              return ia(
                H,
                j,
                Ol(q),
                F
              );
            if (q.$$typeof === _n)
              return ia(
                H,
                j,
                Cl(H, q),
                F
              );
            Rl(H, q);
          }
          return typeof q == "string" && q !== "" || typeof q == "number" || typeof q == "bigint" ? (q = "" + q, j !== null && j.tag === 6 ? (n(H, j.sibling), F = c(j, q), F.return = H, H = F) : (n(H, j), F = eo(q, H.mode, F), F.return = H, H = F), b(H)) : n(H, j);
        }
        return function(H, j, q, F) {
          try {
            cl = 0;
            var ut = ia(
              H,
              j,
              q,
              F
            );
            return Ma = null, ut;
          } catch (mt) {
            if (mt === Ca || mt === hr) throw mt;
            var Dt = s(29, mt, null, H.mode);
            return Dt.lanes = F, Dt.return = H, Dt;
          } finally {
          }
        };
      }
      function Dl() {
        for (var t = Aa, e = No = Aa = 0; e < t; ) {
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
          u !== 0 && qs(n, c, u);
        }
      }
      function Bl(t, e, n, r) {
        Ae[Aa++] = t, Ae[Aa++] = e, Ae[Aa++] = n, Ae[Aa++] = r, No |= r, t.lanes |= r, t = t.alternate, t !== null && (t.lanes |= r);
      }
      function oi(t, e, n, r) {
        return Bl(t, e, n, r), Hl(t);
      }
      function Ln(t, e) {
        return Bl(t, null, null, e), Hl(t);
      }
      function qs(t, e, n) {
        t.lanes |= n;
        var r = t.alternate;
        r !== null && (r.lanes |= n);
        for (var c = !1, u = t.return; u !== null; )
          u.childLanes |= n, r = u.alternate, r !== null && (r.childLanes |= n), u.tag === 22 && (t = u.stateNode, t === null || t._visibility & 1 || (c = !0)), t = u, u = u.return;
        return t.tag === 3 ? (u = t.stateNode, c && e !== null && (c = 31 - xe(n), t = u.hiddenUpdates, r = t[c], r === null ? t[c] = [e] : r.push(e), e.lane = n | 536870912), u) : null;
      }
      function Hl(t) {
        if (50 < hl)
          throw hl = 0, qo = null, Error(o(185));
        for (var e = t.return; e !== null; )
          t = e, e = t.return;
        return t.tag === 3 ? t.stateNode : null;
      }
      function si(t) {
        t.updateQueue = {
          baseState: t.memoizedState,
          firstBaseUpdate: null,
          lastBaseUpdate: null,
          shared: { pending: null, lanes: 0, hiddenCallbacks: null },
          callbacks: null
        };
      }
      function ci(t, e) {
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
          return c === null ? e.next = e : (e.next = c.next, c.next = e), r.pending = e, e = Hl(t), qs(t, null, n), e;
        }
        return Bl(t, r, e, n), Hl(t);
      }
      function Va(t, e, n) {
        if (e = e.updateQueue, e !== null && (e = e.shared, (n & 4194048) !== 0)) {
          var r = e.lanes;
          r &= t.pendingLanes, n |= r, e.lanes = n, h(t, n);
        }
      }
      function ui(t, e) {
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
        if (To) {
          var t = Ta;
          if (t !== null) throw t;
        }
      }
      function La(t, e, n, r) {
        To = !1;
        var c = t.updateQueue;
        Nn = !1;
        var u = c.firstBaseUpdate, b = c.lastBaseUpdate, C = c.shared.pending;
        if (C !== null) {
          c.shared.pending = null;
          var Y = C, J = Y.next;
          Y.next = null, b === null ? u = J : b.next = J, b = Y;
          var tt = t.alternate;
          tt !== null && (tt = tt.updateQueue, C = tt.lastBaseUpdate, C !== b && (C === null ? tt.firstBaseUpdate = J : C.next = J, tt.lastBaseUpdate = Y));
        }
        if (u !== null) {
          var W = c.baseState;
          b = 0, tt = J = Y = null, C = u;
          do {
            var nt = C.lane & -536870913, gt = nt !== C.lane;
            if (gt ? (_t & nt) === nt : (r & nt) === nt) {
              nt !== 0 && nt === Na && (To = !0), tt !== null && (tt = tt.next = {
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
                    W = lo({}, W, nt);
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
              }, tt === null ? (J = tt = gt, Y = W) : tt = tt.next = gt, b |= nt;
            if (C = C.next, C === null) {
              if (C = c.shared.pending, C === null)
                break;
              gt = C, C = gt.next, gt.next = null, c.lastBaseUpdate = gt, c.shared.pending = null;
            }
          } while (!0);
          tt === null && (Y = W), c.baseState = Y, c.firstBaseUpdate = J, c.lastBaseUpdate = tt, u === null && (c.shared.lanes = 0), Cn |= b, t.lanes = b, t.memoizedState = W;
        }
      }
      function Ys(t, e) {
        if (typeof t != "function")
          throw Error(o(191, t));
        t.call(e);
      }
      function Gs(t, e) {
        var n = t.callbacks;
        if (n !== null)
          for (t.callbacks = null, t = 0; t < n.length; t++)
            Ys(n[t], e);
      }
      function Ks(t, e) {
        t = cn, S(br, t), S(ja, e), cn = t | e.baseLanes;
      }
      function di() {
        S(br, cn), S(ja, ja.current);
      }
      function fi() {
        cn = br.current, N(ja), N(br);
      }
      function vn(t) {
        var e = t.alternate;
        S(qt, qt.current & 1), S(Se, t), je === null && (e === null || ja.current !== null || e.memoizedState !== null) && (je = t);
      }
      function mi(t) {
        S(qt, qt.current), S(Se, t), je === null && (je = t);
      }
      function Qs(t) {
        t.tag === 22 ? (S(qt, qt.current), S(Se, t), je === null && (je = t)) : yn();
      }
      function yn() {
        S(qt, qt.current), S(Se, Se.current);
      }
      function be(t) {
        N(Se), je === t && (je = null), N(qt);
      }
      function Ul(t) {
        for (var e = t; e !== null; ) {
          if (e.tag === 13) {
            var n = e.memoizedState;
            if (n !== null && (n = n.dehydrated, n === null || po(n) || ho(n)))
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
      function pi(t, e) {
        if (e === null) return !1;
        for (var n = 0; n < e.length && n < t.length; n++)
          if (!_e(t[n], e[n])) return !1;
        return !0;
      }
      function hi(t, e, n, r, c, u) {
        return on = u, bt = e, e.memoizedState = null, e.updateQueue = null, e.lanes = 0, ct.H = t === null || t.memoizedState === null ? gd : Co, la = !1, u = n(r, c), la = !1, Oa && (u = Xs(
          e,
          n,
          r,
          c
        )), Vs(t), u;
      }
      function Vs(t) {
        ct.H = dl;
        var e = Mt !== null && Mt.next !== null;
        if (on = 0, Yt = Mt = bt = null, vr = !1, ul = 0, Ra = null, e) throw Error(o(300));
        t === null || Gt || (t = t.dependencies, t !== null && Tl(t) && (Gt = !0));
      }
      function Xs(t, e, n, r) {
        bt = t;
        var c = 0;
        do {
          if (Oa && (Ra = null), ul = 0, Oa = !1, 25 <= c) throw Error(o(301));
          if (c += 1, Yt = Mt = null, t.updateQueue != null) {
            var u = t.updateQueue;
            u.lastEffect = null, u.events = null, u.stores = null, u.memoCache != null && (u.memoCache.index = 0);
          }
          ct.H = bd, u = e(n, r);
        } while (Oa);
        return u;
      }
      function Nm() {
        var t = ct.H, e = t.useState()[0];
        return e = typeof e.then == "function" ? Za(e) : e, t = t.useState()[0], (Mt !== null ? Mt.memoizedState : null) !== t && (bt.flags |= 1024), e;
      }
      function gi() {
        var t = yr !== 0;
        return yr = 0, t;
      }
      function bi(t, e, n) {
        e.updateQueue = t.updateQueue, e.flags &= -2053, t.lanes &= ~n;
      }
      function vi(t) {
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
        return ul += 1, Ra === null && (Ra = []), t = Ds(Ra, t, e), e = bt, (Yt === null ? e.memoizedState : Yt.next) === null && (e = e.alternate, ct.H = e === null || e.memoizedState === null ? gd : Co), t;
      }
      function Yl(t) {
        if (t !== null && typeof t == "object") {
          if (typeof t.then == "function") return Za(t);
          if (t.$$typeof === _n) return $t(t);
        }
        throw Error(o(438, String(t)));
      }
      function yi(t) {
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
            n[r] = $m;
        return e.index++, n;
      }
      function $e(t, e) {
        return typeof e == "function" ? e(t) : e;
      }
      function Gl(t) {
        var e = Ut();
        return xi(e, Mt, t);
      }
      function xi(t, e, n) {
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
          var C = b = null, Y = null, J = e, tt = !1;
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
                }), W === Na && (tt = !0);
              else if ((on & nt) === nt) {
                J = J.next, nt === Na && (tt = !0);
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
          if (Y === null ? b = u : Y.next = C, !_e(u, t.memoizedState) && (Gt = !0, tt && (n = Ta, n !== null)))
            throw n;
          t.memoizedState = u, t.baseState = b, t.baseQueue = Y, r.lastRenderedState = u;
        }
        return c === null && (r.lanes = 0), [t.memoizedState, r.dispatch];
      }
      function wi(t) {
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
      function Ls(t, e, n) {
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
        if (b && (c.memoizedState = n, Gt = !0), c = c.queue, ki(Ws.bind(null, r, c, t), [
          t
        ]), c.getSnapshot !== e || b || Yt !== null && Yt.memoizedState.tag & 1) {
          if (r.flags |= 2048, pa(
            9,
            { destroy: void 0 },
            Js.bind(
              null,
              r,
              c,
              n,
              e
            ),
            null
          ), At === null) throw Error(o(349));
          u || (on & 127) !== 0 || Zs(r, e, n);
        }
        return n;
      }
      function Zs(t, e, n) {
        t.flags |= 16384, t = { getSnapshot: e, value: n }, e = bt.updateQueue, e === null ? (e = ql(), bt.updateQueue = e, e.stores = [t]) : (n = e.stores, n === null ? e.stores = [t] : n.push(t));
      }
      function Js(t, e, n, r) {
        e.value = n, e.getSnapshot = r, Fs(e) && Is(t);
      }
      function Ws(t, e, n) {
        return n(function() {
          Fs(e) && Is(t);
        });
      }
      function Fs(t) {
        var e = t.getSnapshot;
        t = t.value;
        try {
          var n = e();
          return !_e(t, n);
        } catch {
          return !0;
        }
      }
      function Is(t) {
        var e = Ln(t, 2);
        e !== null && me(e, t, 2);
      }
      function _i(t) {
        var e = de();
        if (typeof t == "function") {
          var n = t;
          if (t = n(), la) {
            L(!0);
            try {
              n();
            } finally {
              L(!1);
            }
          }
        }
        return e.memoizedState = e.baseState = t, e.queue = {
          pending: null,
          lanes: 0,
          dispatch: null,
          lastRenderedReducer: $e,
          lastRenderedState: t
        }, e;
      }
      function $s(t, e, n, r) {
        return t.baseState = n, xi(
          t,
          Mt,
          typeof r == "function" ? r : $e
        );
      }
      function Tm(t, e, n, r, c) {
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
          ct.T !== null ? n(!0) : u.isTransition = !1, r(u), n = e.pending, n === null ? (u.next = e.pending = u, Ps(e, u)) : (u.next = n.next, e.pending = n.next = u);
        }
      }
      function Ps(t, e) {
        var n = e.action, r = e.payload, c = t.state;
        if (e.isTransition) {
          var u = ct.T, b = {};
          ct.T = b;
          try {
            var C = n(c, r), Y = ct.S;
            Y !== null && Y(b, C), tc(t, e, C);
          } catch (J) {
            Si(t, e, J);
          } finally {
            u !== null && b.types !== null && (u.types = b.types), ct.T = u;
          }
        } else
          try {
            u = n(c, r), tc(t, e, u);
          } catch (J) {
            Si(t, e, J);
          }
      }
      function tc(t, e, n) {
        n !== null && typeof n == "object" && typeof n.then == "function" ? n.then(
          function(r) {
            ec(t, e, r);
          },
          function(r) {
            return Si(t, e, r);
          }
        ) : ec(t, e, n);
      }
      function ec(t, e, n) {
        e.status = "fulfilled", e.value = n, nc(e), t.state = n, e = t.pending, e !== null && (n = e.next, n === e ? t.pending = null : (n = n.next, e.next = n, Ps(t, n)));
      }
      function Si(t, e, n) {
        var r = t.pending;
        if (t.pending = null, r !== null) {
          r = r.next;
          do
            e.status = "rejected", e.reason = n, nc(e), e = e.next;
          while (e !== r);
        }
        t.action = null;
      }
      function nc(t) {
        t = t.listeners;
        for (var e = 0; e < t.length; e++) (0, t[e])();
      }
      function ac(t, e) {
        return e;
      }
      function lc(t, e) {
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
                    Ot = $u(c), r = Lp(c);
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
          lastRenderedReducer: ac,
          lastRenderedState: e
        }, n.queue = r, n = _c.bind(
          null,
          bt,
          r
        ), r.dispatch = n, r = _i(!1);
        var u = Ti.bind(
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
        }, r.queue = c, n = Tm.bind(
          null,
          bt,
          c,
          u,
          n
        ), c.dispatch = n, r.memoizedState = t, [e, n, !1];
      }
      function rc(t) {
        var e = Ut();
        return ic(e, Mt, t);
      }
      function ic(t, e, n) {
        if (e = xi(
          t,
          e,
          ac
        )[0], t = Gl($e)[0], typeof e == "object" && e !== null && typeof e.then == "function")
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
          Cm.bind(null, c, n),
          null
        )), [r, u, t];
      }
      function Cm(t, e) {
        t.action = e;
      }
      function oc(t) {
        var e = Ut(), n = Mt;
        if (n !== null)
          return ic(e, n, t);
        Ut(), e = e.memoizedState, n = Ut();
        var r = n.queue.dispatch;
        return n.memoizedState = t, [e, r, !1];
      }
      function pa(t, e, n, r) {
        return t = { tag: t, create: n, deps: r, inst: e, next: null }, e = bt.updateQueue, e === null && (e = ql(), bt.updateQueue = e), n = e.lastEffect, n === null ? e.lastEffect = t.next = t : (r = n.next, n.next = t, t.next = r, e.lastEffect = t), t;
      }
      function sc() {
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
        Mt !== null && r !== null && pi(r, Mt.memoizedState.deps) ? c.memoizedState = pa(e, u, n, r) : (bt.flags |= t, c.memoizedState = pa(
          1 | e,
          u,
          n,
          r
        ));
      }
      function cc(t, e) {
        Kl(8390656, 8, t, e);
      }
      function ki(t, e) {
        Ql(2048, 8, t, e);
      }
      function Mm(t) {
        bt.flags |= 4;
        var e = bt.updateQueue;
        if (e === null)
          e = ql(), bt.updateQueue = e, e.events = [t];
        else {
          var n = e.events;
          n === null ? e.events = [t] : n.push(t);
        }
      }
      function uc(t) {
        var e = Ut().memoizedState;
        return Mm({ ref: e, nextImpl: t }), function() {
          if ((xt & 2) !== 0)
            throw Error(o(440));
          return e.impl.apply(void 0, arguments);
        };
      }
      function dc(t, e) {
        return Ql(4, 2, t, e);
      }
      function fc(t, e) {
        return Ql(4, 4, t, e);
      }
      function mc(t, e) {
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
      function pc(t, e, n) {
        n = n != null ? n.concat([t]) : null, Ql(
          4,
          4,
          mc.bind(null, e, t),
          n
        );
      }
      function Ei() {
      }
      function hc(t, e) {
        var n = Ut();
        e = e === void 0 ? null : e;
        var r = n.memoizedState;
        return e !== null && pi(e, r[1]) ? r[0] : (n.memoizedState = [t, e], t);
      }
      function gc(t, e) {
        var n = Ut();
        e = e === void 0 ? null : e;
        var r = n.memoizedState;
        if (e !== null && pi(e, r[1]))
          return r[0];
        if (r = t(), la) {
          L(!0);
          try {
            t();
          } finally {
            L(!1);
          }
        }
        return n.memoizedState = [r, e], r;
      }
      function zi(t, e, n) {
        return n === void 0 || (on & 1073741824) !== 0 && (_t & 261930) === 0 ? t.memoizedState = e : (t.memoizedState = n, t = fu(), bt.lanes |= t, Cn |= t, n);
      }
      function bc(t, e, n, r) {
        return _e(n, e) ? n : ja.current !== null ? (t = zi(t, n, r), _e(t, e) || (Gt = !0), t) : (on & 42) === 0 || (on & 1073741824) !== 0 && (_t & 261930) === 0 ? (Gt = !0, t.memoizedState = n) : (t = fu(), bt.lanes |= t, Cn |= t, e);
      }
      function vc(t, e, n, r, c) {
        var u = ln();
        Jt(
          u !== 0 && 8 > u ? u : 8
        );
        var b = ct.T, C = {};
        ct.T = C, Ti(t, !1, e, n);
        try {
          var Y = c(), J = ct.S;
          if (J !== null && J(C, Y), Y !== null && typeof Y == "object" && typeof Y.then == "function") {
            var tt = zm(
              Y,
              r
            );
            Ja(
              t,
              e,
              tt,
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
      function yc(t) {
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
            lastRenderedReducer: $e,
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
            lastRenderedReducer: $e,
            lastRenderedState: n
          },
          next: null
        }, t.memoizedState = e, t = t.alternate, t !== null && (t.memoizedState = e), e;
      }
      function Ni() {
        return $t($n);
      }
      function xc() {
        return Ut().memoizedState;
      }
      function wc() {
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
              r !== null && (me(r, e, n), Va(r, e, n)), e = { cache: li() }, t.payload = e;
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
        }, Vl(t) ? Sc(e, n) : (n = oi(t, e, n, r), n !== null && (me(n, t, r), kc(n, e, r)));
      }
      function _c(t, e, n) {
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
        if (Vl(t)) Sc(e, c);
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
          if (n = oi(t, e, c, r), n !== null)
            return me(n, t, r), kc(n, e, r), !0;
        }
        return !1;
      }
      function Ti(t, e, n, r) {
        if (r = {
          lane: 2,
          revertLane: ri(),
          gesture: null,
          action: r,
          hasEagerState: !1,
          eagerState: null,
          next: null
        }, Vl(t)) {
          if (e) throw Error(o(479));
        } else
          e = oi(
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
      function Sc(t, e) {
        Oa = vr = !0;
        var n = t.pending;
        n === null ? e.next = e : (e.next = n.next, n.next = e), t.pending = e;
      }
      function kc(t, e, n) {
        if ((n & 4194048) !== 0) {
          var r = e.lanes;
          r &= t.pendingLanes, n |= r, e.lanes = n, h(t, n);
        }
      }
      function Ci(t, e, n, r) {
        e = t.memoizedState, n = n(r, e), n = n == null ? e : lo({}, e, n), t.memoizedState = n, t.lanes === 0 && (t.updateQueue.baseState = n);
      }
      function Ec(t, e, n, r, c, u, b) {
        return t = t.stateNode, typeof t.shouldComponentUpdate == "function" ? t.shouldComponentUpdate(r, u, b) : e.prototype && e.prototype.isPureReactComponent ? !jl(n, r) || !jl(c, u) : !0;
      }
      function zc(t, e, n, r) {
        t = e.state, typeof e.componentWillReceiveProps == "function" && e.componentWillReceiveProps(n, r), typeof e.UNSAFE_componentWillReceiveProps == "function" && e.UNSAFE_componentWillReceiveProps(n, r), e.state !== t && Mo.enqueueReplaceState(e, e.state, null);
      }
      function Zn(t, e) {
        var n = e;
        if ("ref" in e) {
          n = {};
          for (var r in e)
            r !== "ref" && (n[r] = e[r]);
        }
        if (t = t.defaultProps) {
          n === e && (n = lo({}, n));
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
      function Nc(t, e, n) {
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
      function Mi(t, e, n) {
        return n = gn(n), n.tag = 3, n.payload = { element: null }, n.callback = function() {
          Xl(t, e);
        }, n;
      }
      function Tc(t) {
        return t = gn(t), t.tag = 3, t;
      }
      function Cc(t, e, n, r) {
        var c = n.type.getDerivedStateFromError;
        if (typeof c == "function") {
          var u = r.value;
          t.payload = function() {
            return c(u);
          }, t.callback = function() {
            Nc(e, n, r);
          };
        }
        var b = n.stateNode;
        b !== null && typeof b.componentDidCatch == "function" && (t.callback = function() {
          Nc(e, n, r), typeof c != "function" && (Mn === null ? Mn = /* @__PURE__ */ new Set([this]) : Mn.add(this));
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
                return je === null ? tr() : n.alternate === null && Ht === 0 && (Ht = 3), n.flags &= -257, n.flags |= 65536, n.lanes = c, r === gr ? n.flags |= 16384 : (e = n.updateQueue, e === null ? n.updateQueue = /* @__PURE__ */ new Set([r]) : e.add(r), Pi(t, r, c)), !1;
              case 22:
                return n.flags |= 65536, r === gr ? n.flags |= 16384 : (e = n.updateQueue, e === null ? (e = {
                  transitions: null,
                  markerInstances: null,
                  retryQueue: /* @__PURE__ */ new Set([r])
                }, n.updateQueue = e) : (n = e.retryQueue, n === null ? e.retryQueue = /* @__PURE__ */ new Set([r]) : n.add(r)), Pi(t, r, c)), !1;
            }
            throw Error(o(435, n.tag));
          }
          return Pi(t, r, c), tr(), !1;
        }
        if (St)
          return e = Se.current, e !== null ? ((e.flags & 65536) === 0 && (e.flags |= 256), e.flags |= 65536, e.lanes = c, r !== _o && (t = Error(o(422), { cause: r }), Ga(
            G(t, n)
          ))) : (r !== _o && (e = Error(o(423), {
            cause: r
          }), Ga(
            G(e, n)
          )), t = t.current.alternate, t.flags |= 65536, c &= -c, t.lanes |= c, r = G(r, n), c = Mi(
            t.stateNode,
            r,
            c
          ), ui(t, c), Ht !== 4 && (Ht = 2)), !1;
        var u = Error(o(520), { cause: r });
        if (u = G(u, n), ml === null ? ml = [u] : ml.push(u), Ht !== 4 && (Ht = 2), e === null) return !0;
        r = G(r, n), n = e;
        do {
          switch (n.tag) {
            case 3:
              return n.flags |= 65536, t = c & -c, n.lanes |= t, t = Mi(n.stateNode, r, t), ui(n, t), !1;
            case 1:
              if (e = n.type, u = n.stateNode, (n.flags & 128) === 0 && (typeof e.getDerivedStateFromError == "function" || u !== null && typeof u.componentDidCatch == "function" && (Mn === null || !Mn.has(
                u
              ))))
                return n.flags |= 65536, c &= -c, n.lanes |= c, c = Tc(c), Cc(
                  c,
                  t,
                  n,
                  r
                ), ui(n, c), !1;
          }
          n = n.return;
        } while (n !== null);
        return !1;
      }
      function Pt(t, e, n, r) {
        e.child = t === null ? hd(e, null, n, r) : aa(
          e,
          t.child,
          n,
          r
        );
      }
      function Mc(t, e, n, r, c) {
        n = n.render;
        var u = e.ref;
        if ("ref" in r) {
          var b = {};
          for (var C in r)
            C !== "ref" && (b[C] = r[C]);
        } else b = r;
        return Vn(e), r = hi(
          t,
          e,
          n,
          b,
          u,
          c
        ), C = gi(), t !== null && !Gt ? (bi(t, e, c), Pe(t, e, c)) : (St && C && V(e), e.flags |= 1, Pt(t, e, r, c), e.child);
      }
      function Ac(t, e, n, r, c) {
        if (t === null) {
          var u = n.type;
          return typeof u == "function" && !to(u) && u.defaultProps === void 0 && n.compare === null ? (e.tag = 15, e.type = u, jc(
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
        if (u = t.child, !Hi(t, c)) {
          var b = u.memoizedProps;
          if (n = n.compare, n = n !== null ? n : jl, n(b, r) && t.ref === e.ref)
            return Pe(
              t,
              e,
              c
            );
        }
        return e.flags |= 1, t = nn(u, r), t.ref = e.ref, t.return = e, e.child = t;
      }
      function jc(t, e, n, r, c) {
        if (t !== null) {
          var u = t.memoizedProps;
          if (jl(u, r) && t.ref === e.ref)
            if (Gt = !1, e.pendingProps = r = u, Hi(t, c))
              (t.flags & 131072) !== 0 && (Gt = !0);
            else
              return e.lanes = t.lanes, Pe(t, e, c);
        }
        return Ai(
          t,
          e,
          n,
          r,
          c
        );
      }
      function Oc(t, e, n, r) {
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
            return Rc(
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
            ), u !== null ? Ks(e, u) : di(), Qs(e);
          else
            return r = e.lanes = 536870912, Rc(
              t,
              e,
              u !== null ? u.baseLanes | n : n,
              n,
              r
            );
        } else
          u !== null ? (Al(e, u.cachePool), Ks(e, u), yn(), e.memoizedState = null) : (t !== null && Al(e, null), di(), yn());
        return Pt(t, e, c, n), e.child;
      }
      function Wa(t, e) {
        return t !== null && t.tag === 22 || e.stateNode !== null || (e.stateNode = {
          _visibility: 1,
          _pendingMarkers: null,
          _retryCache: null,
          _transitions: null
        }), e.sibling;
      }
      function Rc(t, e, n, r, c) {
        var u = ii();
        return u = u === null ? null : {
          parent: an ? Rt._currentValue : Rt._currentValue2,
          pool: u
        }, e.memoizedState = {
          baseLanes: n,
          cachePool: u
        }, t !== null && Al(e, null), di(), Qs(e), t !== null && fa(t, e, r, !0), e.childLanes = c, null;
      }
      function Ll(t, e) {
        return e = Jl(
          { mode: e.mode, children: e.children },
          t.mode
        ), e.ref = t.ref, t.child = e, e.return = t, e;
      }
      function Dc(t, e, n) {
        return aa(e, t.child, null, n), t = Ll(
          e,
          e.pendingProps
        ), t.flags |= 2, be(e), e.memoizedState = null, t;
      }
      function Rm(t, e, n) {
        var r = e.pendingProps, c = (e.flags & 128) !== 0;
        if (e.flags &= -129, t === null) {
          if (St) {
            if (r.mode === "hidden")
              return t = Ll(e, r), e.lanes = 536870912, Wa(null, t);
            if (mi(e), (t = Ot) ? (t = eh(
              t,
              Me
            ), t !== null && (e.memoizedState = {
              dehydrated: t,
              treeContext: kn !== null ? { id: Xe, overflow: Le } : null,
              retryLane: 536870912,
              hydrationErrors: null
            }, n = ju(t), n.return = e, e.child = n, ee = e, Ot = null)) : t = null, t === null) throw ht(e);
            return e.lanes = 536870912, null;
          }
          return Ll(e, r);
        }
        var u = t.memoizedState;
        if (u !== null) {
          var b = u.dehydrated;
          if (mi(e), c)
            if (e.flags & 256)
              e.flags &= -257, e = Dc(
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
            if (r = At, r !== null && (b = _(r, n), b !== 0 && b !== u.retryLane))
              throw u.retryLane = b, Ln(t, b), me(r, t, b), Ao;
            tr(), e = Dc(
              t,
              e,
              n
            );
          } else
            t = u.treeContext, se && (Ot = Fp(b), ee = e, St = !0, zn = null, Me = !1, t !== null && it(e, t)), e = Ll(e, r), e.flags |= 4096;
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
      function Ai(t, e, n, r, c) {
        return Vn(e), n = hi(
          t,
          e,
          n,
          r,
          void 0,
          c
        ), r = gi(), t !== null && !Gt ? (bi(t, e, c), Pe(t, e, c)) : (St && r && V(e), e.flags |= 1, Pt(t, e, n, c), e.child);
      }
      function Bc(t, e, n, r, c, u) {
        return Vn(e), e.updateQueue = null, n = Xs(
          e,
          r,
          n,
          c
        ), Vs(t), r = gi(), t !== null && !Gt ? (bi(t, e, u), Pe(t, e, u)) : (St && r && V(e), e.flags |= 1, Pt(t, e, n, u), e.child);
      }
      function Hc(t, e, n, r, c) {
        if (Vn(e), e.stateNode === null) {
          var u = Sa, b = n.contextType;
          typeof b == "object" && b !== null && (u = $t(b)), u = new n(r, u), e.memoizedState = u.state !== null && u.state !== void 0 ? u.state : null, u.updater = Mo, e.stateNode = u, u._reactInternals = e, u = e.stateNode, u.props = r, u.state = e.memoizedState, u.refs = {}, si(e), b = n.contextType, u.context = typeof b == "object" && b !== null ? $t(b) : Sa, u.state = e.memoizedState, b = n.getDerivedStateFromProps, typeof b == "function" && (Ci(
            e,
            n,
            b,
            r
          ), u.state = e.memoizedState), typeof n.getDerivedStateFromProps == "function" || typeof u.getSnapshotBeforeUpdate == "function" || typeof u.UNSAFE_componentWillMount != "function" && typeof u.componentWillMount != "function" || (b = u.state, typeof u.componentWillMount == "function" && u.componentWillMount(), typeof u.UNSAFE_componentWillMount == "function" && u.UNSAFE_componentWillMount(), b !== u.state && Mo.enqueueReplaceState(
            u,
            u.state,
            null
          ), La(e, r, u, c), Xa(), u.state = e.memoizedState), typeof u.componentDidMount == "function" && (e.flags |= 4194308), r = !0;
        } else if (t === null) {
          u = e.stateNode;
          var C = e.memoizedProps, Y = Zn(n, C);
          u.props = Y;
          var J = u.context, tt = n.contextType;
          b = Sa, typeof tt == "object" && tt !== null && (b = $t(tt));
          var W = n.getDerivedStateFromProps;
          tt = typeof W == "function" || typeof u.getSnapshotBeforeUpdate == "function", C = e.pendingProps !== C, tt || typeof u.UNSAFE_componentWillReceiveProps != "function" && typeof u.componentWillReceiveProps != "function" || (C || J !== b) && zc(
            e,
            u,
            r,
            b
          ), Nn = !1;
          var nt = e.memoizedState;
          u.state = nt, La(e, r, u, c), Xa(), J = e.memoizedState, C || nt !== J || Nn ? (typeof W == "function" && (Ci(
            e,
            n,
            W,
            r
          ), J = e.memoizedState), (Y = Nn || Ec(
            e,
            n,
            Y,
            r,
            nt,
            J,
            b
          )) ? (tt || typeof u.UNSAFE_componentWillMount != "function" && typeof u.componentWillMount != "function" || (typeof u.componentWillMount == "function" && u.componentWillMount(), typeof u.UNSAFE_componentWillMount == "function" && u.UNSAFE_componentWillMount()), typeof u.componentDidMount == "function" && (e.flags |= 4194308)) : (typeof u.componentDidMount == "function" && (e.flags |= 4194308), e.memoizedProps = r, e.memoizedState = J), u.props = r, u.state = J, u.context = b, r = Y) : (typeof u.componentDidMount == "function" && (e.flags |= 4194308), r = !1);
        } else {
          u = e.stateNode, ci(t, e), b = e.memoizedProps, tt = Zn(n, b), u.props = tt, W = e.pendingProps, nt = u.context, J = n.contextType, Y = Sa, typeof J == "object" && J !== null && (Y = $t(J)), C = n.getDerivedStateFromProps, (J = typeof C == "function" || typeof u.getSnapshotBeforeUpdate == "function") || typeof u.UNSAFE_componentWillReceiveProps != "function" && typeof u.componentWillReceiveProps != "function" || (b !== W || nt !== Y) && zc(
            e,
            u,
            r,
            Y
          ), Nn = !1, nt = e.memoizedState, u.state = nt, La(e, r, u, c), Xa();
          var gt = e.memoizedState;
          b !== W || nt !== gt || Nn || t !== null && t.dependencies !== null && Tl(t.dependencies) ? (typeof C == "function" && (Ci(
            e,
            n,
            C,
            r
          ), gt = e.memoizedState), (tt = Nn || Ec(
            e,
            n,
            tt,
            r,
            nt,
            gt,
            Y
          ) || t !== null && t.dependencies !== null && Tl(t.dependencies)) ? (J || typeof u.UNSAFE_componentWillUpdate != "function" && typeof u.componentWillUpdate != "function" || (typeof u.componentWillUpdate == "function" && u.componentWillUpdate(r, gt, Y), typeof u.UNSAFE_componentWillUpdate == "function" && u.UNSAFE_componentWillUpdate(
            r,
            gt,
            Y
          )), typeof u.componentDidUpdate == "function" && (e.flags |= 4), typeof u.getSnapshotBeforeUpdate == "function" && (e.flags |= 1024)) : (typeof u.componentDidUpdate != "function" || b === t.memoizedProps && nt === t.memoizedState || (e.flags |= 4), typeof u.getSnapshotBeforeUpdate != "function" || b === t.memoizedProps && nt === t.memoizedState || (e.flags |= 1024), e.memoizedProps = r, e.memoizedState = gt), u.props = r, u.state = gt, u.context = Y, r = tt) : (typeof u.componentDidUpdate != "function" || b === t.memoizedProps && nt === t.memoizedState || (e.flags |= 4), typeof u.getSnapshotBeforeUpdate != "function" || b === t.memoizedProps && nt === t.memoizedState || (e.flags |= 1024), r = !1);
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
        )) : Pt(t, e, n, c), e.memoizedState = u.state, t = e.child) : t = Pe(
          t,
          e,
          c
        ), t;
      }
      function Uc(t, e, n, r) {
        return De(), e.flags |= 256, Pt(t, e, n, r), e.child;
      }
      function ji(t) {
        return { baseLanes: t, cachePool: Os() };
      }
      function Oi(t, e, n) {
        return t = t !== null ? t.childLanes & ~n : 0, e && (t |= Ee), t;
      }
      function qc(t, e, n) {
        var r = e.pendingProps, c = !1, u = (e.flags & 128) !== 0, b;
        if ((b = u) || (b = t !== null && t.memoizedState === null ? !1 : (qt.current & 2) !== 0), b && (c = !0, e.flags &= -129), b = (e.flags & 32) !== 0, e.flags &= -33, t === null) {
          if (St) {
            if (c ? vn(e) : yn(), (t = Ot) ? (t = nh(
              t,
              Me
            ), t !== null && (e.memoizedState = {
              dehydrated: t,
              treeContext: kn !== null ? { id: Xe, overflow: Le } : null,
              retryLane: 536870912,
              hydrationErrors: null
            }, n = ju(t), n.return = e, e.child = n, ee = e, Ot = null)) : t = null, t === null) throw ht(e);
            return ho(t) ? e.lanes = 32 : e.lanes = 536870912, null;
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
          ), C.return = e, r.return = e, C.sibling = r, e.child = C, r = e.child, r.memoizedState = ji(n), r.childLanes = Oi(
            t,
            b,
            n
          ), e.memoizedState = jo, Wa(null, r)) : (vn(e), Ri(e, C));
        }
        var Y = t.memoizedState;
        if (Y !== null && (C = Y.dehydrated, C !== null)) {
          if (u)
            e.flags & 256 ? (vn(e), e.flags &= -257, e = Di(
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
            ), r = e.child, r.memoizedState = ji(n), r.childLanes = Oi(
              t,
              b,
              n
            ), e.memoizedState = jo, e = Wa(null, r));
          else if (vn(e), ho(C))
            b = Qp(C).digest, r = Error(o(419)), r.stack = "", r.digest = b, Ga({ value: r, source: null, stack: null }), e = Di(
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
            if (b = At, b !== null && (r = _(
              b,
              n
            ), r !== 0 && r !== Y.retryLane))
              throw Y.retryLane = r, Ln(t, r), me(b, t, r), Ao;
            po(C) || tr(), e = Di(
              t,
              e,
              n
            );
          } else
            po(C) ? (e.flags |= 192, e.child = t.child, e = null) : (t = Y.treeContext, se && (Ot = Ip(
              C
            ), ee = e, St = !0, zn = null, Me = !1, t !== null && it(e, t)), e = Ri(
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
        ), C.flags |= 2), C.return = e, r.return = e, r.sibling = C, e.child = r, Wa(null, r), r = e.child, C = t.child.memoizedState, C === null ? C = ji(n) : (c = C.cachePool, c !== null ? (Y = an ? Rt._currentValue : Rt._currentValue2, c = c.parent !== Y ? { parent: Y, pool: Y } : c) : c = Os(), C = {
          baseLanes: C.baseLanes | n,
          cachePool: c
        }), r.memoizedState = C, r.childLanes = Oi(
          t,
          b,
          n
        ), e.memoizedState = jo, Wa(t.child, r)) : (vn(e), n = t.child, t = n.sibling, n = nn(n, {
          mode: "visible",
          children: r.children
        }), n.return = e, n.sibling = null, t !== null && (b = e.deletions, b === null ? (e.deletions = [t], e.flags |= 16) : b.push(t)), e.child = n, e.memoizedState = null, n);
      }
      function Ri(t, e) {
        return e = Jl(
          { mode: "visible", children: e },
          t.mode
        ), e.return = t, t.child = e;
      }
      function Jl(t, e) {
        return t = s(22, t, null, e), t.lanes = 0, t;
      }
      function Di(t, e, n) {
        return aa(e, t.child, null, n), t = Ri(
          e,
          e.pendingProps.children
        ), t.flags |= 2, e.memoizedState = null, t;
      }
      function Yc(t, e, n) {
        t.lanes |= e;
        var r = t.alternate;
        r !== null && (r.lanes |= e), ni(t.return, e, n);
      }
      function Bi(t, e, n, r, c, u) {
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
      function Gc(t, e, n) {
        var r = e.pendingProps, c = r.revealOrder, u = r.tail;
        r = r.children;
        var b = qt.current, C = (b & 2) !== 0;
        if (C ? (b = b & 1 | 2, e.flags |= 128) : b &= 1, S(qt, b), Pt(t, e, r, n), r = St ? il : 0, !C && t !== null && (t.flags & 128) !== 0)
          t: for (t = e.child; t !== null; ) {
            if (t.tag === 13)
              t.memoizedState !== null && Yc(t, n, e);
            else if (t.tag === 19)
              Yc(t, n, e);
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
            n = c, n === null ? (c = e.child, e.child = null) : (c = n.sibling, n.sibling = null), Bi(
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
            Bi(
              e,
              !0,
              n,
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
      function Pe(t, e, n) {
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
      function Hi(t, e) {
        return (t.lanes & e) !== 0 ? !0 : (t = t.dependencies, !!(t !== null && Tl(t)));
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
              return e.flags |= 128, mi(e), null;
            break;
          case 13:
            var r = e.memoizedState;
            if (r !== null)
              return r.dehydrated !== null ? (vn(e), e.flags |= 128, null) : (n & e.child.childLanes) !== 0 ? qc(
                t,
                e,
                n
              ) : (vn(e), t = Pe(
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
                return Gc(
                  t,
                  e,
                  n
                );
              e.flags |= 128;
            }
            if (c = e.memoizedState, c !== null && (c.rendering = null, c.tail = null, c.lastEffect = null), S(qt, qt.current), r) break;
            return null;
          case 22:
            return e.lanes = 0, Oc(
              t,
              e,
              n,
              e.pendingProps
            );
          case 24:
            hn(e, Rt, t.memoizedState.cache);
        }
        return Pe(t, e, n);
      }
      function Kc(t, e, n) {
        if (t !== null)
          if (t.memoizedProps !== e.pendingProps)
            Gt = !0;
          else {
            if (!Hi(t, n) && (e.flags & 128) === 0)
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
              if (t = Xn(e.elementType), e.type = t, typeof t == "function")
                to(t) ? (r = Zn(t, r), e.tag = 1, e = Hc(
                  null,
                  e,
                  t,
                  r,
                  n
                )) : (e.tag = 0, e = Ai(
                  null,
                  e,
                  t,
                  r,
                  n
                ));
              else {
                if (t != null) {
                  var c = t.$$typeof;
                  if (c === io) {
                    e.tag = 11, e = Mc(
                      null,
                      e,
                      t,
                      r,
                      n
                    );
                    break t;
                  } else if (c === co) {
                    e.tag = 14, e = Ac(
                      null,
                      e,
                      t,
                      r,
                      n
                    );
                    break t;
                  }
                }
                throw e = E(t) || t, Error(o(306, e, ""));
              }
            }
            return e;
          case 0:
            return Ai(
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
              ), t === null) throw Error(o(387));
              var u = e.pendingProps;
              c = e.memoizedState, r = c.element, ci(t, e), La(e, u, null, n);
              var b = e.memoizedState;
              if (u = b.cache, hn(e, Rt, u), u !== c.cache && ai(
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
                  e = Uc(
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
                  ), Ga(r), e = Uc(
                    t,
                    e,
                    u,
                    n
                  );
                  break t;
                } else
                  for (se && (Ot = Wp(
                    e.stateNode.containerInfo
                  ), ee = e, St = !0, zn = null, Me = !0), n = hd(
                    e,
                    null,
                    u,
                    n
                  ), e.child = n; n; )
                    n.flags = n.flags & -3 | 4096, n = n.sibling;
              else {
                if (De(), u === r) {
                  e = Pe(
                    t,
                    e,
                    n
                  );
                  break t;
                }
                Pt(t, e, u, n);
              }
              e = e.child;
            }
            return e;
          case 26:
            if (qe)
              return Zl(t, e), t === null ? (n = ed(
                e.type,
                null,
                e.pendingProps,
                null
              )) ? e.memoizedState = n : St || (e.stateNode = _h(
                e.type,
                e.pendingProps,
                En.current,
                e
              )) : e.memoizedState = ed(
                e.type,
                t.memoizedProps,
                e.pendingProps,
                t.memoizedState
              ), null;
          case 27:
            if (Vt)
              return kt(e), t === null && Vt && St && (r = e.stateNode = od(
                e.type,
                e.pendingProps,
                En.current,
                te.current,
                !1
              ), ee = e, Me = !0, Ot = $p(
                e.type,
                r,
                Ot
              )), Pt(
                t,
                e,
                e.pendingProps.children,
                n
              ), Zl(t, e), t === null && (e.flags |= 4194304), e.child;
          case 5:
            return t === null && St && (yh(
              e.type,
              e.pendingProps,
              te.current
            ), (c = r = Ot) && (r = Pp(
              r,
              e.type,
              e.pendingProps,
              Me
            ), r !== null ? (e.stateNode = r, ee = e, Ot = Jp(r), Me = !1, c = !0) : c = !1), c || ht(e)), kt(e), c = e.type, u = e.pendingProps, b = t !== null ? t.memoizedProps : null, r = u.children, rr(c, u) ? r = null : b !== null && rr(c, b) && (e.flags |= 32), e.memoizedState !== null && (c = hi(
              t,
              e,
              Nm,
              null,
              null,
              n
            ), an ? $n._currentValue = c : $n._currentValue2 = c), Zl(t, e), Pt(t, e, r, n), e.child;
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
            return qc(t, e, n);
          case 4:
            return ot(
              e,
              e.stateNode.containerInfo
            ), r = e.pendingProps, t === null ? e.child = aa(
              e,
              null,
              r,
              n
            ) : Pt(t, e, r, n), e.child;
          case 11:
            return Mc(
              t,
              e,
              e.type,
              e.pendingProps,
              n
            );
          case 7:
            return Pt(
              t,
              e,
              e.pendingProps,
              n
            ), e.child;
          case 8:
            return Pt(
              t,
              e,
              e.pendingProps.children,
              n
            ), e.child;
          case 12:
            return Pt(
              t,
              e,
              e.pendingProps.children,
              n
            ), e.child;
          case 10:
            return r = e.pendingProps, hn(e, e.type, r.value), Pt(
              t,
              e,
              r.children,
              n
            ), e.child;
          case 9:
            return c = e.type._context, r = e.pendingProps.children, Vn(e), c = $t(c), r = r(c), e.flags |= 1, Pt(t, e, r, n), e.child;
          case 14:
            return Ac(
              t,
              e,
              e.type,
              e.pendingProps,
              n
            );
          case 15:
            return jc(
              t,
              e,
              e.type,
              e.pendingProps,
              n
            );
          case 19:
            return Gc(
              t,
              e,
              n
            );
          case 31:
            return Rm(t, e, n);
          case 22:
            return Oc(
              t,
              e,
              n,
              e.pendingProps
            );
          case 24:
            return Vn(e), r = $t(Rt), t === null ? (c = ii(), c === null && (c = At, u = li(), c.pooledCache = u, u.refCount++, u !== null && (c.pooledCacheLanes |= n), c = u), e.memoizedState = {
              parent: r,
              cache: c
            }, si(e), hn(e, Rt, c)) : ((t.lanes & n) !== 0 && (ci(t, e), La(e, null, null, n), Xa()), c = t.memoizedState, u = e.memoizedState, c.parent !== r ? (c = { parent: r, cache: r }, e.memoizedState = c, e.lanes === 0 && (e.memoizedState = e.updateQueue.baseState = c), hn(e, Rt, r)) : (r = u.cache, hn(e, Rt, r), r !== c.cache && ai(
              e,
              [Rt],
              n,
              !0
            ))), Pt(
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
      function Qc(t, e) {
        if (t !== null && t.child === e.child) return !1;
        if ((e.flags & 16) !== 0) return !0;
        for (t = e.child; t !== null; ) {
          if ((t.flags & 8218) !== 0 || (t.subtreeFlags & 8218) !== 0)
            return !0;
          t = t.sibling;
        }
        return !1;
      }
      function Ui(t, e, n, r) {
        if (oe)
          for (n = e.child; n !== null; ) {
            if (n.tag === 5 || n.tag === 6)
              fo(t, n.stateNode);
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
              n && r && (u = Fu(
                u,
                c.type,
                c.memoizedProps
              )), fo(t, u);
            } else if (c.tag === 6)
              u = c.stateNode, n && r && (u = Iu(
                u,
                c.memoizedProps
              )), fo(t, u);
            else if (c.tag !== 4) {
              if (c.tag === 22 && c.memoizedState !== null)
                u = c.child, u !== null && (u.return = c), Ui(t, c, !0, !0);
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
      function Vc(t, e, n, r) {
        var c = !1;
        if (Ve)
          for (var u = e.child; u !== null; ) {
            if (u.tag === 5) {
              var b = u.stateNode;
              n && r && (b = Fu(
                b,
                u.type,
                u.memoizedProps
              )), Ju(t, b);
            } else if (u.tag === 6)
              b = u.stateNode, n && r && (b = Iu(
                b,
                u.memoizedProps
              )), Ju(t, b);
            else if (u.tag !== 4) {
              if (u.tag === 22 && u.memoizedState !== null)
                c = u.child, c !== null && (c.return = u), Vc(t, u, !0, !0), c = !0;
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
      function Xc(t, e) {
        if (Ve && Qc(t, e)) {
          t = e.stateNode;
          var n = t.containerInfo, r = Zu();
          Vc(r, e, !1, !1), t.pendingChildren = r, Be(e), Kp(n, r);
        }
      }
      function qi(t, e, n, r) {
        if (oe)
          t.memoizedProps !== r && Be(e);
        else if (Ve) {
          var c = t.stateNode, u = t.memoizedProps;
          if ((t = Qc(t, e)) || u !== r) {
            var b = te.current;
            u = Gp(
              c,
              n,
              u,
              r,
              !t,
              null
            ), u === c ? e.stateNode = c : (Wl(e), Ku(
              u,
              n,
              r,
              b
            ) && Be(e), e.stateNode = u, t && Ui(u, e, !1, !1));
          } else e.stateNode = c;
        }
      }
      function Yi(t, e, n, r, c) {
        if ((t.mode & 32) !== 0 && (n === null ? pp(e, r) : hp(e, n, r))) {
          if (t.flags |= 16777216, (c & 335544128) === c || mo(e, r))
            if (Vu(t.stateNode, e, r))
              t.flags |= 8192;
            else if (bu()) t.flags |= 8192;
            else
              throw na = gr, zo;
        } else t.flags &= -16777217;
      }
      function Lc(t, e) {
        if (kh(e)) {
          if (t.flags |= 16777216, !id(e))
            if (bu()) t.flags |= 8192;
            else
              throw na = gr, zo;
        } else t.flags &= -16777217;
      }
      function Fl(t, e) {
        e !== null && (t.flags |= 4), t.flags & 16384 && (e = t.tag !== 22 ? X() : 536870912, t.lanes |= e, Ha |= e);
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
      function Bm(t, e, n) {
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
            return n = e.stateNode, r = null, t !== null && (r = t.memoizedState.cache), e.memoizedState.cache !== r && (e.flags |= 2048), Ie(Rt), st(), n.pendingContext && (n.context = n.pendingContext, n.pendingContext = null), (t === null || t.child === null) && (Re(e) ? Be(e) : t === null || t.memoizedState.isDehydrated && (e.flags & 256) === 0 || (e.flags |= 1024, pn())), Xc(t, e), jt(e), null;
          case 26:
            if (qe) {
              var c = e.type, u = e.memoizedState;
              return t === null ? (Be(e), u !== null ? (jt(e), Lc(
                e,
                u
              )) : (jt(e), Yi(
                e,
                c,
                null,
                r,
                n
              ))) : u ? u !== t.memoizedState ? (Be(e), jt(e), Lc(
                e,
                u
              )) : (jt(e), e.flags &= -16777217) : (u = t.memoizedProps, oe ? u !== r && Be(e) : qi(
                t,
                e,
                c,
                r
              ), jt(e), Yi(
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
                oe ? t.memoizedProps !== r && Be(e) : qi(t, e, c, r);
              else {
                if (!r) {
                  if (e.stateNode === null)
                    throw Error(o(166));
                  return jt(e), null;
                }
                t = te.current, Re(e) ? Kn(e, t) : (t = od(
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
              qi(t, e, c, r);
            else {
              if (!r) {
                if (e.stateNode === null)
                  throw Error(o(166));
                return jt(e), null;
              }
              if (u = te.current, Re(e))
                Kn(e, u), mh(
                  e.stateNode,
                  c,
                  r,
                  u
                ) && (e.flags |= 64);
              else {
                var b = ip(
                  c,
                  r,
                  En.current,
                  u,
                  e
                );
                Wl(e), Ui(b, e, !1, !1), e.stateNode = b, Ku(
                  b,
                  c,
                  r,
                  u
                ) && Be(e);
              }
            }
            return jt(e), Yi(
              e,
              e.type,
              t === null ? null : t.memoizedProps,
              e.pendingProps,
              n
            ), null;
          case 6:
            if (t && e.stateNode != null)
              n = t.memoizedProps, oe ? n !== r && Be(e) : Ve && (n !== r ? (t = En.current, n = te.current, Wl(e), e.stateNode = Qu(
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
                lh(
                  t,
                  n,
                  e,
                  r
                ) || ht(e, !0);
              } else
                Wl(e), e.stateNode = Qu(
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
                  rh(t, e);
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
                  ih(c, e);
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
            return st(), Xc(t, e), t === null && up(e.stateNode.containerInfo), jt(e), null;
          case 10:
            return Ie(e.type), jt(e), null;
          case 19:
            if (N(qt), r = e.memoizedState, r === null) return jt(e), null;
            if (c = (e.flags & 128) !== 0, u = r.rendering, u === null)
              if (c) Fa(r, !1);
              else {
                if (Ht !== 0 || t !== null && (t.flags & 128) !== 0)
                  for (t = e.child; t !== null; ) {
                    if (u = Ul(t), u !== null) {
                      for (e.flags |= 128, Fa(r, !1), t = u.updateQueue, e.updateQueue = t, Fl(e, t), e.subtreeFlags = 0, t = n, n = e.child; n !== null; )
                        Au(n, t), n = n.sibling;
                      return S(
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
            return r.tail !== null ? (t = r.tail, r.rendering = t, r.tail = t.sibling, r.renderingStartTime = pe(), t.sibling = null, n = qt.current, S(
              qt,
              c ? n & 1 | 2 : n & 1
            ), St && K(e, r.treeForkCount), t) : (jt(e), null);
          case 22:
          case 23:
            return be(e), fi(), r = e.memoizedState !== null, t !== null ? t.memoizedState !== null !== r && (e.flags |= 8192) : r && (e.flags |= 8192), r ? (n & 536870912) !== 0 && (e.flags & 128) === 0 && (jt(e), e.subtreeFlags & 6 && (e.flags |= 8192)) : jt(e), n = e.updateQueue, n !== null && Fl(e, n.retryQueue), n = null, t !== null && t.memoizedState !== null && t.memoizedState.cachePool !== null && (n = t.memoizedState.cachePool.pool), r = null, e.memoizedState !== null && e.memoizedState.cachePool !== null && (r = e.memoizedState.cachePool.pool), r !== n && (e.flags |= 2048), t !== null && N(ea), null;
          case 24:
            return n = null, t !== null && (n = t.memoizedState.cache), e.memoizedState.cache !== n && (e.flags |= 2048), Ie(Rt), jt(e), null;
          case 25:
            return null;
          case 30:
            return null;
        }
        throw Error(o(156, e.tag));
      }
      function Hm(t, e) {
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
            return N(qt), null;
          case 4:
            return st(), null;
          case 10:
            return Ie(e.type), null;
          case 22:
          case 23:
            return be(e), fi(), t !== null && N(ea), t = e.flags, t & 65536 ? (e.flags = t & -65537 | 128, e) : null;
          case 24:
            return Ie(Rt), null;
          case 25:
            return null;
          default:
            return null;
        }
      }
      function Zc(t, e) {
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
            be(e), fi(), t !== null && N(ea);
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
                  } catch (tt) {
                    Et(
                      c,
                      Y,
                      tt
                    );
                  }
                }
              }
              r = r.next;
            } while (r !== u);
          }
        } catch (tt) {
          Et(e, e.return, tt);
        }
      }
      function Jc(t) {
        var e = t.updateQueue;
        if (e !== null) {
          var n = t.stateNode;
          try {
            Gs(e, n);
          } catch (r) {
            Et(t, t.return, r);
          }
        }
      }
      function Wc(t, e, n) {
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
      function $a(t, e) {
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
      function Fc(t) {
        var e = t.type, n = t.memoizedProps, r = t.stateNode;
        try {
          Mp(r, e, n, t);
        } catch (c) {
          Et(t, t.return, c);
        }
      }
      function Gi(t, e, n) {
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
      function Ic(t) {
        return t.tag === 5 || t.tag === 3 || (qe ? t.tag === 26 : !1) || (Vt ? t.tag === 27 && wa(t.type) : !1) || t.tag === 4;
      }
      function Ki(t) {
        t: for (; ; ) {
          for (; t.sibling === null; ) {
            if (t.return === null || Ic(t.return)) return null;
            t = t.return;
          }
          for (t.sibling.return = t.return, t = t.sibling; t.tag !== 5 && t.tag !== 6 && t.tag !== 18; ) {
            if (Vt && t.tag === 27 && wa(t.type) || t.flags & 2 || t.child === null || t.tag === 4) continue t;
            t.child.return = t, t = t.child;
          }
          if (!(t.flags & 2)) return t.stateNode;
        }
      }
      function Qi(t, e, n) {
        var r = t.tag;
        if (r === 5 || r === 6)
          t = t.stateNode, e ? Op(n, t, e) : Tp(n, t);
        else if (r !== 4 && (Vt && r === 27 && wa(t.type) && (n = t.stateNode, e = null), t = t.child, t !== null))
          for (Qi(t, e, n), t = t.sibling; t !== null; )
            Qi(t, e, n), t = t.sibling;
      }
      function Il(t, e, n) {
        var r = t.tag;
        if (r === 5 || r === 6)
          t = t.stateNode, e ? jp(n, t, e) : Np(n, t);
        else if (r !== 4 && (Vt && r === 27 && wa(t.type) && (n = t.stateNode), t = t.child, t !== null))
          for (Il(t, e, n), t = t.sibling; t !== null; )
            Il(t, e, n), t = t.sibling;
      }
      function $c(t, e, n) {
        t = t.containerInfo;
        try {
          Wu(t, n);
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
                  (e & 1024) !== 0 && oe && Yp(t.stateNode.containerInfo);
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
      function tu(t, e, n) {
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
            r & 64 && Jc(n), r & 512 && $a(n, n.return);
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
                Gs(r, t);
              } catch (b) {
                Et(n, n.return, b);
              }
            }
            break;
          case 27:
            Vt && e === null && r & 4 && Pc(n);
          case 26:
          case 5:
            if (tn(t, n), e === null) {
              if (r & 4) Fc(n);
              else if (r & 64) {
                t = n.type, e = n.memoizedProps, c = n.stateNode;
                try {
                  ch(
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
            r & 512 && $a(n, n.return);
            break;
          case 12:
            tn(t, n);
            break;
          case 31:
            tn(t, n), r & 4 && nu(t, n);
            break;
          case 13:
            tn(t, n), r & 4 && au(t, n), r & 64 && (r = n.memoizedState, r !== null && (r = r.dehydrated, r !== null && (n = Xm.bind(
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
      function eu(t) {
        var e = t.alternate;
        e !== null && (t.alternate = null, eu(e)), t.child = null, t.deletions = null, t.sibling = null, t.tag === 5 && (e = t.stateNode, e !== null && mp(e)), t.stateNode = null, t.return = null, t.dependencies = null, t.memoizedProps = null, t.memoizedState = null, t.pendingProps = null, t.stateNode = null, t.updateQueue = null;
      }
      function He(t, e, n) {
        for (n = n.child; n !== null; )
          Vi(
            t,
            e,
            n
          ), n = n.sibling;
      }
      function Vi(t, e, n) {
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
              ), n.memoizedState ? ad(n.memoizedState) : n.stateNode && rd(n.stateNode);
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
              ), sd(n.stateNode), Qt = r, he = c;
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
              He(
                t,
                e,
                n
              );
            break;
          case 18:
            oe && Qt !== null && (he ? gh(
              Qt,
              n.stateNode
            ) : hh(Qt, n.stateNode));
            break;
          case 4:
            oe ? (r = Qt, c = he, Qt = n.stateNode.containerInfo, he = !0, He(
              t,
              e,
              n
            ), Qt = r, he = c) : (Ve && $c(
              n.stateNode,
              n,
              Zu()
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
            Kt || (Qe(n, e), r = n.stateNode, typeof r.componentWillUnmount == "function" && Wc(
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
      function nu(t, e) {
        if (se && e.memoizedState === null && (t = e.alternate, t !== null && (t = t.memoizedState, t !== null))) {
          t = t.dehydrated;
          try {
            dh(t);
          } catch (n) {
            Et(e, e.return, n);
          }
        }
      }
      function au(t, e) {
        if (se && e.memoizedState === null && (t = e.alternate, t !== null && (t = t.memoizedState, t !== null && (t = t.dehydrated, t !== null))))
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
            return e === null && (e = t.stateNode = new vd()), e;
          case 22:
            return t = t.stateNode, e = t._retryCache, e === null && (e = t._retryCache = new vd()), e;
          default:
            throw Error(o(435, t.tag));
        }
      }
      function $l(t, e) {
        var n = qm(t);
        e.forEach(function(r) {
          if (!n.has(r)) {
            n.add(r);
            var c = Lm.bind(null, t, r);
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
              Vi(u, b, c), Qt = null, he = !1;
            } else Vi(u, b, c);
            u = c.alternate, u !== null && (u.return = null), c.return = null;
          }
        if (e.subtreeFlags & 13886)
          for (e = e.child; e !== null; )
            lu(e, t), e = e.sibling;
      }
      function lu(t, e) {
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
                n === null ? u === null ? t.stateNode === null ? t.stateNode = wh(
                  c,
                  t.type,
                  t.memoizedProps,
                  t
                ) : ld(
                  c,
                  t.type,
                  t.stateNode
                ) : t.stateNode = nd(
                  c,
                  u,
                  t.memoizedProps
                ) : r !== u ? (r === null ? n.stateNode !== null && rd(n.stateNode) : ad(r), u === null ? ld(
                  c,
                  t.type,
                  t.stateNode
                ) : nd(
                  c,
                  u,
                  t.memoizedProps
                )) : u === null && t.stateNode !== null && Gi(
                  t,
                  t.memoizedProps,
                  n.memoizedProps
                );
              }
              break;
            }
          case 27:
            if (Vt) {
              ie(e, t), fe(t), r & 512 && (Kt || n === null || Qe(n, n.return)), n !== null && r & 4 && Gi(
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
                  Lu(c);
                } catch (W) {
                  Et(t, t.return, W);
                }
              }
              r & 4 && t.stateNode != null && (c = t.memoizedProps, Gi(
                t,
                c,
                n !== null ? n.memoizedProps : c
              )), r & 1024 && (Oo = !0);
            } else
              Ve && t.alternate !== null && (t.alternate.stateNode = t.stateNode);
            break;
          case 6:
            if (ie(e, t), fe(t), r & 4 && oe) {
              if (t.stateNode === null)
                throw Error(o(162));
              r = t.memoizedProps, n = n !== null ? n.memoizedProps : r, c = t.stateNode;
              try {
                Cp(c, n, r);
              } catch (W) {
                Et(t, t.return, W);
              }
            }
            break;
          case 3:
            if (qe ? (Sh(), c = Ye, Ye = go(e.containerInfo), ie(e, t), Ye = c) : ie(e, t), fe(t), r & 4) {
              if (oe && se && n !== null && n.memoizedState.isDehydrated)
                try {
                  uh(e.containerInfo);
                } catch (W) {
                  Et(t, t.return, W);
                }
              if (Ve) {
                r = e.containerInfo, n = e.pendingChildren;
                try {
                  Wu(r, n);
                } catch (W) {
                  Et(t, t.return, W);
                }
              }
            }
            Oo && (Oo = !1, ru(t));
            break;
          case 4:
            qe ? (n = Ye, Ye = go(
              t.stateNode.containerInfo
            ), ie(e, t), fe(t), Ye = n) : (ie(e, t), fe(t)), r & 4 && Ve && $c(
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
            ie(e, t), fe(t), t.child.flags & 8192 && t.memoizedState !== null != (n !== null && n.memoizedState !== null) && (Er = pe()), r & 4 && (r = t.updateQueue, r !== null && (t.updateQueue = null, $l(t, r)));
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
                        u = b.stateNode, c ? Bp(u) : Up(
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
                        c ? Hp(J) : qp(J, b.memoizedProps);
                      } catch (W) {
                        Et(b, b.return, W);
                      }
                    }
                  } else if (e.tag === 18) {
                    if (n === null) {
                      b = e;
                      try {
                        var tt = b.stateNode;
                        c ? bh(tt) : vh(b.stateNode);
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
            r & 4 && (r = t.updateQueue, r !== null && (n = r.retryQueue, n !== null && (r.retryQueue = null, $l(t, n))));
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
            for (var n, r = t.return; r !== null; ) {
              if (Ic(r)) {
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
                    var c = n.stateNode, u = Ki(t);
                    Il(t, u, c);
                    break;
                  }
                case 5:
                  var b = n.stateNode;
                  n.flags & 32 && (Lu(b), n.flags &= -33);
                  var C = Ki(t);
                  Il(t, C, b);
                  break;
                case 3:
                case 4:
                  var Y = n.stateNode.containerInfo, J = Ki(t);
                  Qi(
                    t,
                    J,
                    Y
                  );
                  break;
                default:
                  throw Error(o(161));
              }
            }
          } catch (tt) {
            Et(t, t.return, tt);
          }
          t.flags &= -3;
        }
        e & 4096 && (t.flags &= -4097);
      }
      function ru(t) {
        if (t.subtreeFlags & 1024)
          for (t = t.child; t !== null; ) {
            var e = t;
            ru(e), e.tag === 5 && e.flags & 1024 && vp(e.stateNode), t = t.sibling;
          }
      }
      function tn(t, e) {
        if (e.subtreeFlags & 8772)
          for (e = e.child; e !== null; )
            tu(t, e.alternate, e), e = e.sibling;
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
              typeof n.componentWillUnmount == "function" && Wc(
                e,
                e.return,
                n
              ), Jn(e);
              break;
            case 27:
              Vt && sd(e.stateNode);
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
                      Ys(Y[c], C);
                } catch (J) {
                  Et(r, r.return, J);
                }
              }
              n && b & 64 && Jc(u), $a(u, u.return);
              break;
            case 27:
              Vt && Pc(u);
            case 26:
            case 5:
              en(
                c,
                u,
                n
              ), n && r === null && b & 4 && Fc(u), $a(u, u.return);
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
              ), n && b & 4 && nu(c, u);
              break;
            case 13:
              en(
                c,
                u,
                n
              ), n && b & 4 && au(c, u);
              break;
            case 22:
              u.memoizedState === null && en(
                c,
                u,
                n
              ), $a(u, u.return);
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
      function Xi(t, e) {
        var n = null;
        t !== null && t.memoizedState !== null && t.memoizedState.cachePool !== null && (n = t.memoizedState.cachePool.pool), t = null, e.memoizedState !== null && e.memoizedState.cachePool !== null && (t = e.memoizedState.cachePool.pool), t !== n && (t != null && t.refCount++, n != null && Ka(n));
      }
      function Li(t, e) {
        t = null, e.alternate !== null && (t = e.alternate.memoizedState.cache), e = e.memoizedState.cache, e !== t && (e.refCount++, t != null && Ka(t));
      }
      function Ue(t, e, n, r) {
        if (e.subtreeFlags & 10256)
          for (e = e.child; e !== null; )
            iu(
              t,
              e,
              n,
              r
            ), e = e.sibling;
      }
      function iu(t, e, n, r) {
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
            ) : Pa(
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
            )), c & 2048 && Xi(b, e);
            break;
          case 24:
            Ue(
              t,
              e,
              n,
              r
            ), c & 2048 && Li(e.alternate, e);
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
              var tt = b.stateNode;
              b.memoizedState !== null ? tt._visibility & 2 ? ha(
                u,
                b,
                C,
                Y,
                c
              ) : Pa(
                u,
                b
              ) : (tt._visibility |= 2, ha(
                u,
                b,
                C,
                Y,
                c
              )), c && J & 2048 && Xi(
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
              ), c && J & 2048 && Li(b.alternate, b);
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
      function Pa(t, e) {
        if (e.subtreeFlags & 10256)
          for (e = e.child; e !== null; ) {
            var n = t, r = e, c = r.flags;
            switch (r.tag) {
              case 22:
                Pa(n, r), c & 2048 && Xi(
                  r.alternate,
                  r
                );
                break;
              case 24:
                Pa(n, r), c & 2048 && Li(
                  r.alternate,
                  r
                );
                break;
              default:
                Pa(n, r);
            }
            e = e.sibling;
          }
      }
      function Wn(t, e, n) {
        if (t.subtreeFlags & Da)
          for (t = t.child; t !== null; )
            ou(
              t,
              e,
              n
            ), t = t.sibling;
      }
      function ou(t, e, n) {
        switch (t.tag) {
          case 26:
            if (Wn(
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
                t = t.memoizedProps, ((e & 335544128) === e || mo(c, t)) && Xu(n, r, c, t);
              }
            break;
          case 5:
            Wn(
              t,
              e,
              n
            ), t.flags & Da && (r = t.stateNode, c = t.type, t = t.memoizedProps, ((e & 335544128) === e || mo(c, t)) && Xu(n, r, c, t));
            break;
          case 3:
          case 4:
            qe ? (r = Ye, Ye = go(
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
      function su(t) {
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
              Wt = r, uu(
                r,
                t
              );
            }
          su(t);
        }
        if (t.subtreeFlags & 10256)
          for (t = t.child; t !== null; )
            cu(t), t = t.sibling;
      }
      function cu(t) {
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
            for (var n = 0; n < e.length; n++) {
              var r = e[n];
              Wt = r, uu(
                r,
                t
              );
            }
          su(t);
        }
        for (t = t.child; t !== null; ) {
          switch (e = t, e.tag) {
            case 0:
            case 11:
            case 15:
              xn(8, e, e.return), Pl(e);
              break;
            case 22:
              n = e.stateNode, n._visibility & 2 && (n._visibility &= -3, Pl(e));
              break;
            default:
              Pl(e);
          }
          t = t.sibling;
        }
      }
      function uu(t, e) {
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
              if (eu(r), r === n) {
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
      function Zi(t) {
        var e = cp(t);
        if (e != null) {
          if (typeof e.memoizedProps["data-testname"] != "string")
            throw Error(o(364));
          return e;
        }
        if (t = wp(t), t === null) throw Error(o(362));
        return t.stateNode.current;
      }
      function Ji(t, e) {
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
                  for (; b != null && Ji(r, b); )
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
            if ((n === 5 || n === 26 || n === 27) && kp(t.stateNode, e.value))
              return !0;
            break;
          case kr:
            if ((n === 5 || n === 6 || n === 26 || n === 27) && (t = Sp(t), t !== null && 0 <= t.indexOf(e.value)))
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
      function Wi(t) {
        switch (t.$$typeof) {
          case xr:
            return "<" + (E(t.value) || "Unknown") + ">";
          case wr:
            return ":has(" + (Wi(t) || "") + ")";
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
      function du(t, e) {
        var n = [];
        t = [t, 0];
        for (var r = 0; r < t.length; ) {
          var c = t[r++], u = c.tag, b = t[r++], C = e[b];
          if (u !== 5 && u !== 26 && u !== 27 || !ll(c)) {
            for (; C != null && Ji(c, C); )
              b++, C = e[b];
            if (b === e.length) n.push(c);
            else
              for (c = c.child; c !== null; )
                t.push(c, b), c = c.sibling;
          }
        }
        return n;
      }
      function Fi(t, e) {
        if (!al) throw Error(o(363));
        t = Zi(t), t = du(t, e), e = [], t = Array.from(t);
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
        return (xt & 2) !== 0 && _t !== 0 ? _t & -_t : ct.T !== null ? ri() : dp();
      }
      function fu() {
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
        )), R(t, n), ((xt & 2) === 0 || t !== At) && (t === At && ((xt & 2) === 0 && (ra |= n), Ht === 4 && wn(
          t,
          _t,
          Ee,
          !1
        )), Ke(t));
      }
      function mu(t, e, n) {
        if ((xt & 6) !== 0) throw Error(o(327));
        var r = !n && (e & 127) === 0 && (e & t.expiredLanes) === 0 || D(t, e), c = r ? Km(t, e) : $i(t, e, !0), u = r;
        do {
          if (c === 0) {
            Ba && !r && wn(t, e, 0, !1);
            break;
          } else {
            if (n = t.current.alternate, u && !Ym(n)) {
              c = $i(t, e, !1), u = !1;
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
                  if (Y && (ga(C, b).flags |= 256), b = $i(
                    C,
                    b,
                    !1
                  ), b !== 2) {
                    if (Ro && !Y) {
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
                un = e, r.timeoutHandle = op(
                  pu.bind(
                    null,
                    r,
                    n,
                    ge,
                    zr,
                    Bo,
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
              pu(
                r,
                n,
                ge,
                zr,
                Bo,
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
      function pu(t, e, n, r, c, u, b, C, Y, J, tt, W, nt, gt) {
        if (t.timeoutHandle = In, W = e.subtreeFlags, W & 8192 || (W & 16785408) === 16785408) {
          W = gp(), ou(
            e,
            u,
            W
          );
          var ne = (u & 62914560) === u ? Er - pe() : (u & 4194048) === u ? yd - pe() : 0;
          if (ne = bp(
            W,
            ne
          ), ne !== null) {
            un = u, t.cancelPendingCommit = ne(
              Su.bind(
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
                tt,
                W,
                null,
                nt,
                gt
              )
            ), wn(t, u, b, !J);
            return;
          }
        }
        Su(
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
        e &= ~Do, e &= ~ra, t.suspendedLanes |= e, t.pingedLanes &= ~e, r && (t.warmLanes |= e), r = t.expirationTimes;
        for (var c = e; 0 < c; ) {
          var u = 31 - xe(c), b = 1 << u;
          r[u] = -1, c &= ~b;
        }
        n !== 0 && v(t, n, e);
      }
      function hu() {
        return (xt & 6) === 0 ? (ma(0), !1) : !0;
      }
      function Ii() {
        if (wt !== null) {
          if (Ct === 0)
            var t = wt.return;
          else
            t = wt, rn = Pn = null, vi(t), Ma = null, cl = 0, t = wt;
          for (; t !== null; )
            Zc(t.alternate, t), t = t.return;
          wt = null;
        }
      }
      function ga(t, e) {
        var n = t.timeoutHandle;
        n !== In && (t.timeoutHandle = In, sp(n)), n = t.cancelPendingCommit, n !== null && (t.cancelPendingCommit = null, n()), un = 0, Ii(), At = t, wt = n = nn(t.current, null), _t = e, Ct = 0, ke = null, Tn = !1, Ba = D(t, e), Ro = !1, Ha = Ee = Do = ra = Cn = Ht = 0, ge = ml = null, Bo = !1, (e & 8) !== 0 && (e |= e & 32);
        var r = t.entangledLanes;
        if (r !== 0)
          for (t = t.entanglements, r &= e; 0 < r; ) {
            var c = 31 - xe(r), u = 1 << c;
            e |= t[c], r &= ~u;
          }
        return cn = e, Dl(), n;
      }
      function gu(t, e) {
        bt = null, ct.H = dl, e === Ca || e === hr ? (e = Bs(), Ct = 3) : e === zo ? (e = Bs(), Ct = 4) : Ct = e === Ao ? 8 : e !== null && typeof e == "object" && typeof e.then == "function" ? 6 : 1, ke = e, wt === null && (Ht = 1, Xl(
          t,
          G(e, t.current)
        ));
      }
      function bu() {
        var t = Se.current;
        return t === null ? !0 : (_t & 4194048) === _t ? je === null : (_t & 62914560) === _t || (_t & 536870912) !== 0 ? t === je : !1;
      }
      function vu() {
        var t = ct.H;
        return ct.H = dl, t === null ? dl : t;
      }
      function yu() {
        var t = ct.A;
        return ct.A = Yh, t;
      }
      function tr() {
        Ht = 4, Tn || (_t & 4194048) !== _t && Se.current !== null || (Ba = !0), (Cn & 134217727) === 0 && (ra & 134217727) === 0 || At === null || wn(
          At,
          _t,
          Ee,
          !1
        );
      }
      function $i(t, e, n) {
        var r = xt;
        xt |= 2;
        var c = vu(), u = yu();
        (At !== t || _t !== e) && (zr = null, ga(t, e)), e = !1;
        var b = Ht;
        t: do
          try {
            if (Ct !== 0 && wt !== null) {
              var C = wt, Y = ke;
              switch (Ct) {
                case 8:
                  Ii(), b = 6;
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
            Gm(), b = Ht;
            break;
          } catch (tt) {
            gu(t, tt);
          }
        while (!0);
        return e && t.shellSuspendCounter++, rn = Pn = null, xt = r, ct.H = c, ct.A = u, wt === null && (At = null, _t = 0, Dl()), b;
      }
      function Gm() {
        for (; wt !== null; ) xu(wt);
      }
      function Km(t, e) {
        var n = xt;
        xt |= 2;
        var r = vu(), c = yu();
        At !== t || _t !== e ? (zr = null, pl = pe() + 500, ga(t, e)) : Ba = D(
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
                  if (Rs(u)) {
                    Ct = 0, ke = null, wu(e);
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
                  Rs(u) ? (Ct = 0, ke = null, wu(e)) : (Ct = 0, ke = null, ba(t, e, u, 7));
                  break;
                case 5:
                  var b = null;
                  switch (wt.tag) {
                    case 26:
                      b = wt.memoizedState;
                    case 5:
                    case 27:
                      var C = wt, Y = C.type, J = C.pendingProps;
                      if (b ? id(b) : Vu(C.stateNode, Y, J)) {
                        Ct = 0, ke = null;
                        var tt = C.sibling;
                        if (tt !== null) wt = tt;
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
                  Ii(), Ht = 6;
                  break t;
                default:
                  throw Error(o(462));
              }
            }
            Qm();
            break;
          } catch (nt) {
            gu(t, nt);
          }
        while (!0);
        return rn = Pn = null, ct.H = r, ct.A = c, xt = n, wt !== null ? 0 : (At = null, _t = 0, Dl(), Ht);
      }
      function Qm() {
        for (; wt !== null && !Ch(); )
          xu(wt);
      }
      function xu(t) {
        var e = Kc(
          t.alternate,
          t,
          cn
        );
        t.memoizedProps = t.pendingProps, e === null ? er(t) : wt = e;
      }
      function wu(t) {
        var e = t, n = e.alternate;
        switch (e.tag) {
          case 15:
          case 0:
            e = Bc(
              n,
              e,
              e.pendingProps,
              e.type,
              void 0,
              _t
            );
            break;
          case 11:
            e = Bc(
              n,
              e,
              e.pendingProps,
              e.type.render,
              e.ref,
              _t
            );
            break;
          case 5:
            vi(e);
          default:
            Zc(n, e), e = wt = Au(e, cn), e = Kc(n, e, cn);
        }
        t.memoizedProps = t.pendingProps, e === null ? er(t) : wt = e;
      }
      function ba(t, e, n, r) {
        rn = Pn = null, vi(e), Ma = null, cl = 0;
        var c = e.return;
        try {
          if (Om(
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
        e.flags & 32768 ? (St || r === 1 ? t = !0 : Ba || (_t & 536870912) !== 0 ? t = !1 : (Tn = t = !0, (r === 2 || r === 9 || r === 3 || r === 6) && (r = Se.current, r !== null && r.tag === 13 && (r.flags |= 16384))), _u(e, t)) : er(e);
      }
      function er(t) {
        var e = t;
        do {
          if ((e.flags & 32768) !== 0) {
            _u(
              e,
              Tn
            );
            return;
          }
          t = e.return;
          var n = Bm(
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
      function _u(t, e) {
        do {
          var n = Hm(t.alternate, t);
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
      function Su(t, e, n, r, c, u, b, C, Y) {
        t.cancelPendingCommit = null;
        do
          el();
        while (Xt !== 0);
        if ((xt & 6) !== 0) throw Error(o(327));
        if (e !== null) {
          if (e === t.current)
            throw Error(o(177));
          if (u = e.lanes | e.childLanes, u |= No, g(
            t,
            n,
            u,
            b,
            C,
            Y
          ), t === At && (wt = At = null, _t = 0), Ua = e, An = t, un = n, Ho = u, Uo = c, xd = r, (e.subtreeFlags & 10256) !== 0 || (e.flags & 10256) !== 0 ? (t.callbackNode = null, t.callbackPriority = 0, Zm(yo, function() {
            return Tu(), null;
          })) : (t.callbackNode = null, t.callbackPriority = 0), r = (e.flags & 13878) !== 0, (e.subtreeFlags & 13878) !== 0 || r) {
            r = ct.T, ct.T = null, c = ln(), Jt(2), b = xt, xt |= 4;
            try {
              Um(t, e, n);
            } finally {
              xt = b, Jt(c), ct.T = r;
            }
          }
          Xt = 1, ku(), Eu(), zu();
        }
      }
      function ku() {
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
              lu(e, t), rp(t.containerInfo);
            } finally {
              xt = c, Jt(r), ct.T = n;
            }
          }
          t.current = e, Xt = 2;
        }
      }
      function Eu() {
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
              tu(t, e.alternate, e);
            } finally {
              xt = c, Jt(r), ct.T = n;
            }
          }
          Xt = 3;
        }
      }
      function zu() {
        if (Xt === 4 || Xt === 3) {
          Xt = 0, Mh();
          var t = An, e = Ua, n = un, r = xd;
          (e.subtreeFlags & 10256) !== 0 || (e.flags & 10256) !== 0 ? Xt = 5 : (Xt = 0, Ua = An = null, Nu(t, t.pendingLanes));
          var c = t.pendingLanes;
          if (c === 0 && (Mn = null), B(n), e = e.stateNode, we && typeof we.onCommitFiberRoot == "function")
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
          (un & 3) !== 0 && el(), Ke(t), c = t.pendingLanes, (n & 261930) !== 0 && (c & 42) !== 0 ? t === qo ? hl++ : (hl = 0, qo = t) : hl = 0, se && ph(), ma(0);
        }
      }
      function Nu(t, e) {
        (t.pooledCacheLanes &= e) === 0 && (e = t.pooledCache, e != null && (t.pooledCache = null, Ka(e)));
      }
      function el() {
        return ku(), Eu(), zu(), Tu();
      }
      function Tu() {
        if (Xt !== 5) return !1;
        var t = An, e = Ho;
        Ho = 0;
        var n = B(un), r = 32 > n ? 32 : n;
        n = ct.T;
        var c = ln();
        try {
          Jt(r), ct.T = null, r = Uo, Uo = null;
          var u = An, b = un;
          if (Xt = 0, Ua = An = null, un = 0, (xt & 6) !== 0)
            throw Error(o(331));
          var C = xt;
          if (xt |= 4, cu(u.current), iu(
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
          Jt(c), ct.T = n, Nu(t, e);
        }
      }
      function Cu(t, e, n) {
        e = G(n, e), e = Mi(t.stateNode, e, 2), t = bn(t, e, 2), t !== null && (R(t, 2), Ke(t));
      }
      function Et(t, e, n) {
        if (t.tag === 3)
          Cu(t, t, n);
        else
          for (; e !== null; ) {
            if (e.tag === 3) {
              Cu(
                e,
                t,
                n
              );
              break;
            } else if (e.tag === 1) {
              var r = e.stateNode;
              if (typeof e.type.getDerivedStateFromError == "function" || typeof r.componentDidCatch == "function" && (Mn === null || !Mn.has(r))) {
                t = G(n, t), n = Tc(2), r = bn(e, n, 2), r !== null && (Cc(
                  n,
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
      function Pi(t, e, n) {
        var r = t.pingCache;
        if (r === null) {
          r = t.pingCache = new Gh();
          var c = /* @__PURE__ */ new Set();
          r.set(e, c);
        } else
          c = r.get(e), c === void 0 && (c = /* @__PURE__ */ new Set(), r.set(e, c));
        c.has(n) || (Ro = !0, c.add(n), t = Vm.bind(null, t, e, n), e.then(t, t));
      }
      function Vm(t, e, n) {
        var r = t.pingCache;
        r !== null && r.delete(e), t.pingedLanes |= t.suspendedLanes & n, t.warmLanes &= ~n, At === t && (_t & n) === n && (Ht === 4 || Ht === 3 && (_t & 62914560) === _t && 300 > pe() - Er ? (xt & 2) === 0 && ga(t, 0) : Do |= n, Ha === _t && (Ha = 0)), Ke(t);
      }
      function Mu(t, e) {
        e === 0 && (e = X()), t = Ln(t, e), t !== null && (R(t, e), Ke(t));
      }
      function Xm(t) {
        var e = t.memoizedState, n = 0;
        e !== null && (n = e.retryLane), Mu(t, n);
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
            throw Error(o(314));
        }
        r !== null && r.delete(e), Mu(t, n);
      }
      function Zm(t, e) {
        return cr(t, e);
      }
      function Jm(t, e, n, r) {
        this.tag = t, this.key = n, this.sibling = this.child = this.return = this.stateNode = this.type = this.elementType = null, this.index = 0, this.refCleanup = this.ref = null, this.pendingProps = e, this.dependencies = this.memoizedState = this.updateQueue = this.memoizedProps = null, this.mode = r, this.subtreeFlags = this.flags = 0, this.deletions = null, this.childLanes = this.lanes = 0, this.alternate = null;
      }
      function to(t) {
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
      function Au(t, e) {
        t.flags &= 65011714;
        var n = t.alternate;
        return n === null ? (t.childLanes = 0, t.lanes = e, t.child = null, t.subtreeFlags = 0, t.memoizedProps = null, t.memoizedState = null, t.updateQueue = null, t.dependencies = null, t.stateNode = null) : (t.childLanes = n.childLanes, t.lanes = n.lanes, t.child = n.child, t.subtreeFlags = 0, t.deletions = null, t.memoizedProps = n.memoizedProps, t.memoizedState = n.memoizedState, t.updateQueue = n.updateQueue, t.type = n.type, e = n.dependencies, t.dependencies = e === null ? null : {
          lanes: e.lanes,
          firstContext: e.firstContext
        }), t;
      }
      function nr(t, e, n, r, c, u) {
        var b = 0;
        if (r = t, typeof t == "function") to(t) && (b = 1);
        else if (typeof t == "string")
          b = qe && Vt ? td(t, n, te.current) ? 26 : cd(t) ? 27 : 5 : qe ? td(
            t,
            n,
            te.current
          ) ? 26 : 5 : Vt && cd(t) ? 27 : 5;
        else
          t: switch (t) {
            case uo:
              return t = s(31, n, e, c), t.elementType = uo, t.lanes = u, t;
            case ya:
              return Fn(
                n.children,
                c,
                u,
                e
              );
            case Uu:
              b = 8, c |= 24;
              break;
            case ro:
              return t = s(12, n, e, c | 2), t.elementType = ro, t.lanes = u, t;
            case oo:
              return t = s(13, n, e, c), t.elementType = oo, t.lanes = u, t;
            case so:
              return t = s(19, n, e, c), t.elementType = so, t.lanes = u, t;
            default:
              if (typeof t == "object" && t !== null)
                switch (t.$$typeof) {
                  case _n:
                    b = 10;
                    break t;
                  case qu:
                    b = 9;
                    break t;
                  case io:
                    b = 11;
                    break t;
                  case co:
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
      function eo(t, e, n) {
        return t = s(6, t, null, e), t.lanes = n, t;
      }
      function ju(t) {
        var e = s(18, null, null, 0);
        return e.stateNode = t, e;
      }
      function no(t, e, n) {
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
      function Wm(t, e, n, r, c, u, b, C, Y) {
        this.tag = 1, this.containerInfo = t, this.pingCache = this.current = this.pendingChildren = null, this.timeoutHandle = In, this.callbackNode = this.next = this.pendingContext = this.context = this.cancelPendingCommit = null, this.callbackPriority = 0, this.expirationTimes = U(-1), this.entangledLanes = this.shellSuspendCounter = this.errorRecoveryDisabledLanes = this.expiredLanes = this.warmLanes = this.pingedLanes = this.suspendedLanes = this.pendingLanes = 0, this.entanglements = U(0), this.hiddenUpdates = U(null), this.identifierPrefix = r, this.onUncaughtError = c, this.onCaughtError = u, this.onRecoverableError = b, this.pooledCache = null, this.pooledCacheLanes = 0, this.formState = Y, this.incompleteTransitions = /* @__PURE__ */ new Map();
      }
      function Ou(t, e, n, r, c, u, b, C, Y, J, tt, W) {
        return t = new Wm(
          t,
          e,
          n,
          b,
          Y,
          J,
          tt,
          W,
          C
        ), e = 1, u === !0 && (e |= 24), u = s(3, null, null, e), t.current = u, u.stateNode = t, e = li(), e.refCount++, t.pooledCache = e, e.refCount++, u.memoizedState = {
          element: r,
          isDehydrated: n,
          cache: e
        }, si(u), t;
      }
      function Ru(t) {
        return t ? (t = Sa, t) : Sa;
      }
      function Du(t) {
        var e = t._reactInternals;
        if (e === void 0)
          throw typeof t.render == "function" ? Error(o(188)) : (t = Object.keys(t).join(","), Error(o(268, t)));
        return t = f(e), t = t !== null ? p(t) : null, t === null ? null : nl(t.stateNode);
      }
      function Bu(t, e, n, r, c, u) {
        c = Ru(c), r.context === null ? r.context = c : r.pendingContext = c, r = gn(e), r.payload = { element: n }, u = u === void 0 ? null : u, u !== null && (r.callback = u), n = bn(t, r, e), n !== null && (me(n, t, e), Va(n, t, e));
      }
      function Hu(t, e) {
        if (t = t.memoizedState, t !== null && t.dehydrated !== null) {
          var n = t.retryLane;
          t.retryLane = n !== 0 && n < e ? n : e;
        }
      }
      function ao(t, e) {
        Hu(t, e), (t = t.alternate) && Hu(t, e);
      }
      var yt = {}, Fm = h0, ye = b0(), lo = Object.assign, Im = Symbol.for("react.element"), ar = Symbol.for("react.transitional.element"), va = Symbol.for("react.portal"), ya = Symbol.for("react.fragment"), Uu = Symbol.for("react.strict_mode"), ro = Symbol.for("react.profiler"), qu = Symbol.for("react.consumer"), _n = Symbol.for("react.context"), io = Symbol.for("react.forward_ref"), oo = Symbol.for("react.suspense"), so = Symbol.for("react.suspense_list"), co = Symbol.for("react.memo"), Sn = Symbol.for("react.lazy"), uo = Symbol.for("react.activity"), $m = Symbol.for("react.memo_cache_sentinel"), Yu = Symbol.iterator, Pm = Symbol.for("react.client.reference"), lr = Array.isArray, ct = Fm.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE, tp = l.rendererVersion, ep = l.rendererPackageName, Gu = l.extraDevToolsConfig, nl = l.getPublicInstance, np = l.getRootHostContext, ap = l.getChildHostContext, lp = l.prepareForCommit, rp = l.resetAfterCommit, ip = l.createInstance;
      l.cloneMutableInstance;
      var fo = l.appendInitialChild, Ku = l.finalizeInitialChildren, rr = l.shouldSetTextContent, Qu = l.createTextInstance;
      l.cloneMutableTextInstance;
      var op = l.scheduleTimeout, sp = l.cancelTimeout, In = l.noTimeout, an = l.isPrimaryRenderer;
      l.warnsIfNotActing;
      var oe = l.supportsMutation, Ve = l.supportsPersistence, se = l.supportsHydration, cp = l.getInstanceFromNode;
      l.beforeActiveInstanceBlur;
      var up = l.preparePortalMount;
      l.prepareScopeUpdate, l.getInstanceFromScope;
      var Jt = l.setCurrentUpdatePriority, ln = l.getCurrentUpdatePriority, dp = l.resolveUpdatePriority;
      l.trackSchedulerEvent, l.resolveEventType, l.resolveEventTimeStamp;
      var fp = l.shouldAttemptEagerTransition, mp = l.detachDeletedInstance;
      l.requestPostPaintCallback;
      var pp = l.maySuspendCommit, hp = l.maySuspendCommitOnUpdate, mo = l.maySuspendCommitInSyncRender, Vu = l.preloadInstance, gp = l.startSuspendingCommit, Xu = l.suspendInstance;
      l.suspendOnActiveViewTransition;
      var bp = l.waitForCommitToBeReady;
      l.getSuspendedCommitReason;
      var xa = l.NotPendingTransition, $n = l.HostTransitionContext, vp = l.resetFormInstance;
      l.bindToConsole;
      var yp = l.supportsMicrotasks, xp = l.scheduleMicrotask, al = l.supportsTestSelectors, wp = l.findFiberRoot, _p = l.getBoundingRect, Sp = l.getTextContent, ll = l.isHiddenSubtree, kp = l.matchAccessibilityRole, Ep = l.setFocusIfFocusable, zp = l.setupIntersectionObserver, Np = l.appendChild, Tp = l.appendChildToContainer, Cp = l.commitTextUpdate, Mp = l.commitMount, Ap = l.commitUpdate, jp = l.insertBefore, Op = l.insertInContainerBefore, Rp = l.removeChild, Dp = l.removeChildFromContainer, Lu = l.resetTextContent, Bp = l.hideInstance, Hp = l.hideTextInstance, Up = l.unhideInstance, qp = l.unhideTextInstance;
      l.cancelViewTransitionName, l.cancelRootViewTransitionName, l.restoreRootViewTransitionName, l.cloneRootViewTransitionContainer, l.removeRootViewTransitionClone, l.measureClonedInstance, l.hasInstanceChanged, l.hasInstanceAffectedParent, l.startViewTransition, l.startGestureTransition, l.stopViewTransition, l.getCurrentGestureOffset, l.createViewTransitionInstance;
      var Yp = l.clearContainer;
      l.createFragmentInstance, l.updateFragmentInstanceFiber, l.commitNewChildToFragmentInstance, l.deleteChildFromFragmentInstance;
      var Gp = l.cloneInstance, Zu = l.createContainerChildSet, Ju = l.appendChildToContainerChildSet, Kp = l.finalizeContainerChildren, Wu = l.replaceContainerChildren, Fu = l.cloneHiddenInstance, Iu = l.cloneHiddenTextInstance, po = l.isSuspenseInstancePending, ho = l.isSuspenseInstanceFallback, Qp = l.getSuspenseInstanceFallbackErrorDetails, Vp = l.registerSuspenseInstanceRetry, Xp = l.canHydrateFormStateMarker, Lp = l.isFormStateMarkerMatching, $u = l.getNextHydratableSibling, Zp = l.getNextHydratableSiblingAfterSingleton, Jp = l.getFirstHydratableChild, Wp = l.getFirstHydratableChildWithinContainer, Fp = l.getFirstHydratableChildWithinActivityInstance, Ip = l.getFirstHydratableChildWithinSuspenseInstance, $p = l.getFirstHydratableChildWithinSingleton, Pp = l.canHydrateInstance, th = l.canHydrateTextInstance, eh = l.canHydrateActivityInstance, nh = l.canHydrateSuspenseInstance, ah = l.hydrateInstance, lh = l.hydrateTextInstance, rh = l.hydrateActivityInstance, ih = l.hydrateSuspenseInstance, oh = l.getNextHydratableInstanceAfterActivityInstance, sh = l.getNextHydratableInstanceAfterSuspenseInstance, ch = l.commitHydratedInstance, uh = l.commitHydratedContainer, dh = l.commitHydratedActivityInstance, fh = l.commitHydratedSuspenseInstance, mh = l.finalizeHydratedChildren, ph = l.flushHydrationEvents;
      l.clearActivityBoundary;
      var hh = l.clearSuspenseBoundary;
      l.clearActivityBoundaryFromContainer;
      var gh = l.clearSuspenseBoundaryFromContainer, bh = l.hideDehydratedBoundary, vh = l.unhideDehydratedBoundary, Pu = l.shouldDeleteUnhydratedTailInstances;
      l.diffHydratedPropsForDevWarnings, l.diffHydratedTextForDevWarnings, l.describeHydratableInstanceForDevWarnings;
      var yh = l.validateHydratableInstance, xh = l.validateHydratableTextInstance, qe = l.supportsResources, td = l.isHostHoistableType, go = l.getHoistableRoot, ed = l.getResource, nd = l.acquireResource, ad = l.releaseResource, wh = l.hydrateHoistable, ld = l.mountHoistable, rd = l.unmountHoistable, _h = l.createHoistableInstance, Sh = l.prepareToCommitHoistables, kh = l.mayResourceSuspendCommit, id = l.preloadResource, Eh = l.suspendResource, Vt = l.supportsSingletons, od = l.resolveSingletonInstance, zh = l.acquireSingletonInstance, sd = l.releaseSingletonInstance, cd = l.isHostSingletonType, wa = l.isSingletonScope, bo = [], _a = -1, Sa = {}, xe = Math.clz32 ? Math.clz32 : y, Nh = Math.log, Th = Math.LN2, ir = 256, or = 262144, sr = 4194304, cr = ye.unstable_scheduleCallback, vo = ye.unstable_cancelCallback, Ch = ye.unstable_shouldYield, Mh = ye.unstable_requestPaint, pe = ye.unstable_now, ud = ye.unstable_ImmediatePriority, Ah = ye.unstable_UserBlockingPriority, yo = ye.unstable_NormalPriority, jh = ye.unstable_IdlePriority, Oh = ye.log, Rh = ye.unstable_setDisableYieldValue, rl = null, we = null, _e = typeof Object.is == "function" ? Object.is : I, dd = typeof reportError == "function" ? reportError : function(t) {
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
      }, Dh = Object.prototype.hasOwnProperty, xo, fd, wo = !1, md = /* @__PURE__ */ new WeakMap(), ka = [], Ea = 0, ur = null, il = 0, Te = [], Ce = 0, kn = null, Xe = 1, Le = "", te = w(null), ol = w(null), En = w(null), dr = w(null), ee = null, Ot = null, St = !1, zn = null, Me = !1, _o = Error(o(519)), fr = w(null), Pn = null, rn = null, Bh = typeof AbortController < "u" ? AbortController : function() {
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
      }, Hh = ye.unstable_scheduleCallback, Uh = ye.unstable_NormalPriority, Rt = {
        $$typeof: _n,
        Consumer: null,
        Provider: null,
        _currentValue: null,
        _currentValue2: null,
        _threadCount: 0
      }, mr = null, za = null, So = !1, pr = !1, ko = !1, ta = 0, sl = null, Eo = 0, Na = 0, Ta = null, pd = ct.S;
      ct.S = function(t, e) {
        yd = pe(), typeof e == "object" && e !== null && typeof e.then == "function" && Em(t, e), pd !== null && pd(t, e);
      };
      var ea = w(null), Ca = Error(o(460)), zo = Error(o(474)), hr = Error(o(542)), gr = { then: function() {
      } }, na = null, Ma = null, cl = 0, aa = Us(!0), hd = Us(!1), Ae = [], Aa = 0, No = 0, Nn = !1, To = !1, ja = w(null), br = w(0), Se = w(null), je = null, qt = w(0), on = 0, bt = null, Mt = null, Yt = null, vr = !1, Oa = !1, la = !1, yr = 0, ul = 0, Ra = null, qh = 0, dl = {
        readContext: $t,
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
      var gd = {
        readContext: $t,
        use: Yl,
        useCallback: function(t, e) {
          return de().memoizedState = [
            t,
            e === void 0 ? null : e
          ], t;
        },
        useContext: $t,
        useEffect: cc,
        useImperativeHandle: function(t, e, n) {
          n = n != null ? n.concat([t]) : null, Kl(
            4194308,
            4,
            mc.bind(null, e, t),
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
            L(!0);
            try {
              t();
            } finally {
              L(!1);
            }
          }
          return n.memoizedState = [r, e], r;
        },
        useReducer: function(t, e, n) {
          var r = de();
          if (n !== void 0) {
            var c = n(e);
            if (la) {
              L(!0);
              try {
                n(e);
              } finally {
                L(!1);
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
          var e = de();
          return t = { current: t }, e.memoizedState = t;
        },
        useState: function(t) {
          t = _i(t);
          var e = t.queue, n = _c.bind(
            null,
            bt,
            e
          );
          return e.dispatch = n, [t.memoizedState, n];
        },
        useDebugValue: Ei,
        useDeferredValue: function(t, e) {
          var n = de();
          return zi(n, t, e);
        },
        useTransition: function() {
          var t = _i(!1);
          return t = vc.bind(
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
            (_t & 127) !== 0 || Zs(r, e, n);
          }
          c.memoizedState = n;
          var u = { value: n, getSnapshot: e };
          return c.queue = u, cc(Ws.bind(null, r, u, t), [
            t
          ]), r.flags |= 2048, pa(
            9,
            { destroy: void 0 },
            Js.bind(
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
            n = qh++, e = "_" + e + "r_" + n.toString(32) + "_";
          return t.memoizedState = e;
        },
        useHostTransitionStatus: Ni,
        useFormState: lc,
        useActionState: lc,
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
          return e.queue = n, e = Ti.bind(
            null,
            bt,
            !0,
            n
          ), n.dispatch = e, [t, e];
        },
        useMemoCache: yi,
        useCacheRefresh: function() {
          return de().memoizedState = Am.bind(
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
      }, Co = {
        readContext: $t,
        use: Yl,
        useCallback: hc,
        useContext: $t,
        useEffect: ki,
        useImperativeHandle: pc,
        useInsertionEffect: dc,
        useLayoutEffect: fc,
        useMemo: gc,
        useReducer: Gl,
        useRef: sc,
        useState: function() {
          return Gl($e);
        },
        useDebugValue: Ei,
        useDeferredValue: function(t, e) {
          var n = Ut();
          return bc(
            n,
            Mt.memoizedState,
            t,
            e
          );
        },
        useTransition: function() {
          var t = Gl($e)[0], e = Ut().memoizedState;
          return [
            typeof t == "boolean" ? t : Za(t),
            e
          ];
        },
        useSyncExternalStore: Ls,
        useId: xc,
        useHostTransitionStatus: Ni,
        useFormState: rc,
        useActionState: rc,
        useOptimistic: function(t, e) {
          var n = Ut();
          return $s(n, Mt, t, e);
        },
        useMemoCache: yi,
        useCacheRefresh: wc
      };
      Co.useEffectEvent = uc;
      var bd = {
        readContext: $t,
        use: Yl,
        useCallback: hc,
        useContext: $t,
        useEffect: ki,
        useImperativeHandle: pc,
        useInsertionEffect: dc,
        useLayoutEffect: fc,
        useMemo: gc,
        useReducer: wi,
        useRef: sc,
        useState: function() {
          return wi($e);
        },
        useDebugValue: Ei,
        useDeferredValue: function(t, e) {
          var n = Ut();
          return Mt === null ? zi(n, t, e) : bc(
            n,
            Mt.memoizedState,
            t,
            e
          );
        },
        useTransition: function() {
          var t = wi($e)[0], e = Ut().memoizedState;
          return [
            typeof t == "boolean" ? t : Za(t),
            e
          ];
        },
        useSyncExternalStore: Ls,
        useId: xc,
        useHostTransitionStatus: Ni,
        useFormState: oc,
        useActionState: oc,
        useOptimistic: function(t, e) {
          var n = Ut();
          return Mt !== null ? $s(n, Mt, t, e) : (n.baseState = t, [t, n.queue.dispatch]);
        },
        useMemoCache: yi,
        useCacheRefresh: wc
      };
      bd.useEffectEvent = uc;
      var Mo = {
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
      }, Ao = Error(o(461)), Gt = !1, jo = {
        dehydrated: null,
        treeContext: null,
        retryLane: 0,
        hydrationErrors: null
      }, sn = !1, Kt = !1, Oo = !1, vd = typeof WeakSet == "function" ? WeakSet : Set, Wt = null, Qt = null, he = !1, Ye = null, Da = 8192, Yh = {
        getCacheForType: function(t) {
          var e = $t(Rt), n = e.data.get(t);
          return n === void 0 && (n = t(), e.data.set(t, n)), n;
        },
        cacheSignal: function() {
          return $t(Rt).controller.signal;
        }
      }, xr = 0, wr = 1, _r = 2, Sr = 3, kr = 4;
      if (typeof Symbol == "function" && Symbol.for) {
        var fl = Symbol.for;
        xr = fl("selector.component"), wr = fl("selector.has_pseudo_class"), _r = fl("selector.role"), Sr = fl("selector.test_id"), kr = fl("selector.text");
      }
      var Gh = typeof WeakMap == "function" ? WeakMap : Map, xt = 0, At = null, wt = null, _t = 0, Ct = 0, ke = null, Tn = !1, Ba = !1, Ro = !1, cn = 0, Ht = 0, Cn = 0, ra = 0, Do = 0, Ee = 0, Ha = 0, ml = null, ge = null, Bo = !1, Er = 0, yd = 0, pl = 1 / 0, zr = null, Mn = null, Xt = 0, An = null, Ua = null, un = 0, Ho = 0, Uo = null, xd = null, hl = 0, qo = null;
      return yt.attemptContinuousHydration = function(t) {
        if (t.tag === 13 || t.tag === 31) {
          var e = Ln(t, 67108864);
          e !== null && me(e, t, 67108864), ao(t, 67108864);
        }
      }, yt.attemptHydrationAtCurrentPriority = function(t) {
        if (t.tag === 13 || t.tag === 31) {
          var e = ve();
          e = M(e);
          var n = Ln(t, e);
          n !== null && me(n, t, e), ao(t, e);
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
                Ke(t), (xt & 6) === 0 && (pl = pe() + 500, ma(0));
              }
            }
            break;
          case 31:
          case 13:
            e = Ln(t, 2), e !== null && me(e, t, 2), hu(), ao(t, 2);
        }
      }, yt.batchedUpdates = function(t, e) {
        return t(e);
      }, yt.createComponentSelector = function(t) {
        return { $$typeof: xr, value: t };
      }, yt.createContainer = function(t, e, n, r, c, u, b, C, Y, J) {
        return Ou(
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
      }, yt.createHydrationContainer = function(t, e, n, r, c, u, b, C, Y, J, tt, W, nt, gt) {
        return t = Ou(
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
          tt,
          W
        ), t.context = Ru(null), n = t.current, r = ve(), r = M(r), c = gn(r), c.callback = e ?? null, bn(n, c, r), e = r, t.current.lanes = e, R(t, e), Ke(t), t;
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
        dd(t);
      }, yt.defaultOnUncaughtError = function(t) {
        dd(t);
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
      }, yt.findAllNodes = Fi, yt.findBoundingRects = function(t, e) {
        if (!al) throw Error(o(363));
        e = Fi(t, e), t = [];
        for (var n = 0; n < e.length; n++)
          t.push(_p(e[n]));
        for (e = t.length - 1; 0 < e; e--) {
          n = t[e];
          for (var r = n.x, c = r + n.width, u = n.y, b = u + n.height, C = e - 1; 0 <= C; C--)
            if (e !== C) {
              var Y = t[C], J = Y.x, tt = J + Y.width, W = Y.y, nt = W + Y.height;
              if (r >= J && u >= W && c <= tt && b <= nt) {
                t.splice(e, 1);
                break;
              } else if (r !== J || n.width !== Y.width || nt < u || W > b) {
                if (!(u !== W || n.height !== Y.height || tt < r || J > c)) {
                  J > r && (Y.width += J - r, Y.x = r), tt < c && (Y.width = c - J), t.splice(e, 1);
                  break;
                }
              } else {
                W > u && (Y.height += W - u, Y.y = u), nt < b && (Y.height = b - W), t.splice(e, 1);
                break;
              }
            }
        }
        return t;
      }, yt.findHostInstance = Du, yt.findHostInstanceWithNoPortals = function(t) {
        return t = f(t), t = t !== null ? x(t) : null, t === null ? null : nl(t.stateNode);
      }, yt.findHostInstanceWithWarning = function(t) {
        return Du(t);
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
      }, yt.flushSyncWork = hu, yt.focusWithin = function(t, e) {
        if (!al) throw Error(o(363));
        for (t = Zi(t), e = du(t, e), e = Array.from(e), t = 0; t < e.length; ) {
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
        if (!al) throw Error(o(363));
        var n = 0, r = [];
        t = [Zi(t), 0];
        for (var c = 0; c < t.length; ) {
          var u = t[c++], b = u.tag, C = t[c++], Y = e[C];
          if ((b !== 5 && b !== 26 && b !== 27 || !ll(u)) && (Ji(u, Y) && (r.push(Wi(Y)), C++, C > n && (n = C)), C < e.length))
            for (u = u.child; u !== null; )
              t.push(u, C), u = u.sibling;
        }
        if (n < e.length) {
          for (t = []; n < e.length; n++)
            t.push(Wi(e[n]));
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
        if (Gu !== null && (t.rendererConfig = Gu), typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ > "u") t = !1;
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
        t = Fi(t, e);
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
        if (t.tag !== 5) throw Error(o(476));
        var c = yc(t).queue;
        vc(
          t,
          c,
          e,
          xa,
          n === null ? i : function() {
            var u = yc(t);
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
        return Bu(
          c,
          u,
          t,
          e,
          n,
          r
        ), u;
      }, yt.updateContainerSync = function(t, e, n, r) {
        return Bu(
          e.current,
          2,
          t,
          e,
          n,
          r
        ), 2;
      }, yt;
    }, a.exports.default = a.exports, Object.defineProperty(a.exports, "__esModule", { value: !0 });
  })(Qo)), Qo.exports;
}
var Od;
function y0() {
  return Od || (Od = 1, Ko.exports = v0()), Ko.exports;
}
var x0 = y0();
const w0 = /* @__PURE__ */ bs(x0);
var Lo = { exports: {} }, dn = {};
/**
 * @license React
 * react-reconciler-constants.production.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var Rd;
function _0() {
  return Rd || (Rd = 1, dn.ConcurrentRoot = 1, dn.ContinuousEventPriority = 8, dn.DefaultEventPriority = 32, dn.DiscreteEventPriority = 2, dn.IdleEventPriority = 268435456, dn.LegacyRoot = 0, dn.NoEventPriority = 0), dn;
}
var Dd;
function S0() {
  return Dd || (Dd = 1, Lo.exports = _0()), Lo.exports;
}
var El = S0();
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
const Ef = ["accent", "panel-bg", "surface-0", "surface-1", "surface-dim", "overlay-0", "overlay-1", "text", "subtext-0", "mauve", "green", "yellow", "red", "blue", "teal", "peach", "backdrop", "card-bg"], ns = 16, zf = /* @__PURE__ */ new Set(["hover", "focus", "focus-visible", "focus-within", "active"]), k0 = [
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
], Bd = {
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
]), Nf = {
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
}, Tf = {
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
}, as = ["font-size", "color", ...new Set([...Object.keys(Nf), ...Object.keys(Tf)].filter((a) => a !== "font-size" && a !== "color"))], z0 = new Set(as);
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
function ls(a, l, s = 0) {
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
    const p = a.slice(d + 4, f - 1), x = le(p, ","), k = x[0].trim(), E = x.length > 1 ? p.slice(p.indexOf(",") + 1).trim() : null;
    let w = l(k);
    if ((w == null || w === "initial") && (w = E), w == null) return null;
    const N = ls(w, l, s + 1);
    if (N === null) return null;
    i += N, o = f;
  }
}
function N0(a) {
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
  const s = N0(a.trim().replace(/env\(\s*safe-area-inset-(?:top|right|bottom|left)\s*(?:,[^()]*)?\)/gi, "0px"));
  if (!s) return null;
  let i = 0;
  const o = ({ num: w, unit: N }) => {
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
  }, d = (w, N, S) => w && N ? { px: w.px + S * N.px, pct: w.pct + S * N.pct, num: w.num + S * N.num, unitless: w.unitless && N.unitless } : null, m = (w, N) => w ? { px: w.px * N, pct: w.pct * N, num: w.num * N, unitless: w.unitless } : null, f = (w) => w && w.unitless;
  function p() {
    const w = s[i++];
    if (!w) return null;
    if (w.num !== void 0) return o(w);
    if (w.op === "(") {
      const N = k();
      return s[i]?.op !== ")" ? null : (i++, N);
    }
    if (w.op === "-" || w.op === "+") {
      const N = p();
      return w.op === "-" ? m(N, -1) : N;
    }
    if (w.fn) {
      const N = [];
      for (; ; ) {
        N.push(k());
        const z = s[i++];
        if (!z) return null;
        if (z.op === ")") break;
        if (z.op !== ",") return null;
      }
      if (N.some((z) => !z)) return null;
      if (w.fn === "calc") return N[0];
      if (!(N.every((z) => !z.pct) || N.every((z) => !z.px && !z.num))) return null;
      const y = (z) => z.px + z.pct + z.num;
      return w.fn === "min" ? N.reduce((z, O) => y(O) < y(z) ? O : z) : w.fn === "max" ? N.reduce((z, O) => y(O) > y(z) ? O : z) : w.fn === "clamp" && N.length === 3 ? y(N[1]) < y(N[0]) ? N[0] : y(N[1]) > y(N[2]) ? N[2] : N[1] : null;
    }
    return null;
  }
  function x() {
    let w = p();
    for (; s[i] && (s[i].op === "*" || s[i].op === "/"); ) {
      const N = s[i++].op, S = p();
      if (!w || !S) return null;
      N === "*" ? w = f(S) ? m(w, S.num) : f(w) ? m(S, w.num) : null : w = f(S) && S.num !== 0 ? m(w, 1 / S.num) : null;
    }
    return w;
  }
  function k() {
    let w = x();
    for (; s[i] && (s[i].op === "+" || s[i].op === "-"); ) {
      const N = s[i++].op;
      w = d(w, x(), N === "-" ? -1 : 1);
    }
    return w;
  }
  const E = k();
  return i !== s.length || !E ? null : E;
}
function rs(a, l) {
  const s = a.trim().toLowerCase();
  if (/^(auto|none|normal|fit-content|max-content|min-content|medium|thin|thick)$/.test(s))
    return s === "thin" ? { px: 1 } : s === "medium" ? { px: 3 } : s === "thick" ? { px: 5 } : s;
  const i = Yn(s, l);
  return i ? i.unitless ? i.num === 0 ? { px: 0 } : { expr: a.trim() } : i.pct && (i.px || i.num) ? { expr: a.trim() } : i.pct ? { pct: i.pct } : { px: T0(i.px) } : { expr: a.trim() };
}
const T0 = (a) => Number.isFinite(a) ? a : a > 0 ? 34e37 : -34e37, Tr = (a) => Math.max(0, Math.min(255, Math.round(a))).toString(16).padStart(2, "0"), C0 = ([a, l, s, i]) => `#${Tr(a)}${Tr(l)}${Tr(s)}${Tr(i * 255)}`;
function Hd(a) {
  const l = a.slice(1), s = l.length <= 4 ? l.split("").map((o) => o + o).join("") : l;
  if (!/^[0-9a-f]{6}([0-9a-f]{2})?$/i.test(s)) return null;
  const i = (o) => parseInt(s.slice(o, o + 2), 16);
  return [i(0), i(2), i(4), s.length === 8 ? i(6) / 255 : 1];
}
function Kr(a, l) {
  const s = a.trim().toLowerCase();
  if (s === "currentcolor") return "currentcolor";
  const i = /^perchtoken\(([a-z0-9-]+)\)$/.exec(s);
  if (i) {
    const x = l(i[1]), k = x && Hd(x);
    return k ? { rgba: k, token: i[1] } : null;
  }
  if (s.startsWith("#")) {
    const x = Hd(s);
    return x ? { rgba: x, token: null } : null;
  }
  if (Bd[s]) return { rgba: [...Bd[s]], token: null };
  const o = /^(rgba?|color-mix)\((.*)\)$/s.exec(s);
  if (!o) return null;
  if (o[1] === "color-mix") {
    const x = le(o[2], ",");
    if (x.length !== 3 || !/^in\s+(srgb|srgb-linear|oklab|lab|oklch|lch|hsl|xyz)/.test(x[0])) return null;
    const k = (L) => {
      const I = le(L), $ = I.findIndex((P) => /%$/.test(P)), Q = $ >= 0 ? parseFloat(I[$]) / 100 : null;
      return { color: Kr(I.filter((P, G) => G !== $).join(" "), l), pct: Q };
    }, E = k(x[1]), w = k(x[2]);
    if (!E.color || !w.color || E.color === "currentcolor" || w.color === "currentcolor") return null;
    let N = E.pct, S = w.pct;
    N === null && S === null ? (N = 0.5, S = 0.5) : N === null ? N = 1 - S : S === null && (S = 1 - N);
    const y = N + S, z = y < 1 ? y : 1;
    N /= y, S /= y;
    const [O, D, A, X] = E.color.rgba, [U, R, g, v] = w.color.rgba, h = X * N + v * S, _ = (L, I) => h === 0 ? 0 : (L * X * N + I * v * S) / h, M = [_(O, U), _(D, R), _(A, g), h * z], B = v === 0 ? E.color.token : X === 0 ? w.color.token : null;
    return { rgba: M, token: B };
  }
  const d = o[2].includes(",") ? le(o[2], ",") : le(o[2].replace("/", " / ")).filter((x) => x !== "/");
  if (d.length < 3) return null;
  const m = (x) => x.endsWith("%") ? parseFloat(x) / 100 * 255 : parseFloat(x), f = d[3] === void 0 ? 1 : d[3].endsWith("%") ? parseFloat(d[3]) / 100 : parseFloat(d[3]), p = [m(d[0]), m(d[1]), m(d[2]), f];
  return p.some((x) => Number.isNaN(x)) ? null : { rgba: p, token: null };
}
const xl = ["top", "right", "bottom", "left"], M0 = ["top-left", "top-right", "bottom-right", "bottom-left"], Cr = (a) => [a[0], a[1] ?? a[0], a[2] ?? a[0], a[3] ?? a[1] ?? a[0]], Ud = /* @__PURE__ */ new Set(["none", "hidden", "solid", "dashed", "dotted", "double", "groove", "ridge", "inset", "outset"]);
function is(a, l) {
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
        for (const p of i())
          Ud.has(p) ? m = p : /^(thin|medium|thick|-?[\d.]|calc\()/.test(p) ? d = p : f = p;
      else s === "0" && (d = "0");
      return o.flatMap((p) => [[`border-${p}-width`, d], [`border-${p}-style`, m], [`border-${p}-color`, f]]);
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
      return M0.map((d, m) => [`border-${d}-radius`, o[m]]);
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
      return s === "none" ? [["background-color", "transparent"], ["background-image", "none"]] : Kr(s, () => "#000000") ? [["background-color", s], ["background-image", "none"]] : [["background-color", "transparent"], ["background-image", s]];
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
      return is("gap", s);
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
        Ud.has(f) || f === "auto" ? d = f : /^(thin|medium|thick|-?[\d.]|calc\()/.test(f) ? o = f : m = f;
      return [["outline-width", o], ["outline-style", d], ["outline-color", m]];
    }
    case "transition": {
      if (s === "none") return [["transition-property", "none"], ["transition-duration", "0s"]];
      const o = le(s, ","), d = o.map((f) => le(f).find((p) => !/^[\d.]+m?s$/.test(p) && !/^(ease|linear|step|cubic)/.test(p)) ?? "all"), m = o.map((f) => le(f).find((p) => /^[\d.]+m?s$/.test(p)) ?? "0s");
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
function A0(a, l) {
  return a ? le(a, ",").some((s) => {
    let i = s.trim().toLowerCase(), o = !1;
    i.startsWith("not ") && (o = !0, i = i.slice(4)), i.startsWith("only ") && (i = i.slice(5));
    const d = i.split(/\s+and\s+/).every((m) => {
      if (m = m.trim(), m === "all" || m === "screen") return !0;
      if (m === "print") return !1;
      const f = /^\((.+)\)$/.exec(m);
      if (!f) return !1;
      const p = f[1].trim(), x = /^([a-z-]+)\s*:\s*(.+)$/.exec(p);
      if (x) {
        const [, E, w] = x, N = (S) => {
          const y = rs(S, { viewport: l });
          return typeof y == "object" && "px" in y ? y.px : NaN;
        };
        switch (E) {
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
      const k = /^(width|height)\s*(>=|<=|>|<|=)\s*(.+)$/.exec(p);
      if (k) {
        const E = k[1] === "width" ? l.width : l.height, w = rs(k[3], { viewport: l }), N = typeof w == "object" && "px" in w ? w.px : NaN;
        switch (k[2]) {
          case ">=":
            return E >= N;
          case "<=":
            return E <= N;
          case ">":
            return E > N;
          case "<":
            return E < N;
          default:
            return E === N;
        }
      }
      return !1;
    });
    return o ? !d : d;
  }) : !0;
}
function j0(a, l) {
  const s = l[l.length - 1].compound;
  return vs(s)[0] ?? a;
}
function O0(a) {
  const l = /* @__PURE__ */ new Set(), s = /* @__PURE__ */ new Set(), i = (o, d) => {
    o.forEach(({ compound: m }, f) => {
      const p = d && f === o.length - 1;
      for (const x of m.pseudos)
        if (zf.has(x.name) && (p ? l : s).add(x.name), x.list && x.name !== "not") for (const k of x.list) i(k, p);
    });
  };
  return i(a, !0), { subject: l, ancestor: s };
}
function vs(a) {
  const l = [...a.classes];
  for (const s of a.pseudos)
    if (!(s.name !== "is" && s.name !== "where"))
      for (const i of s.list) i.length === 1 && l.push(...vs(i[0].compound));
  return l;
}
function R0(a, l) {
  const s = (i, o) => {
    i.forEach(({ compound: d }, m) => {
      const f = o && m === i.length - 1, p = d.pseudos.filter((x) => zf.has(x.name)).map((x) => x.name);
      if (!f) for (const x of p) for (const k of vs(d)) l.add(`${x}:${k}`);
      for (const x of d.pseudos) if (x.list && x.name !== "not") for (const k of x.list) s(k, f);
    });
  };
  s(a, !0);
}
class D0 {
  constructor(l) {
    this.properties = l.properties ?? {}, this.rules = [], this.skipped = 0, this.index = /* @__PURE__ */ new Map(), this.trackedStates = /* @__PURE__ */ new Set();
    const s = (d, m) => {
      const f = m[m.length - 1].compound, p = f.classes.length ? `.${f.classes[0]}` : f.tag && f.tag !== "*" ? f.tag : "*";
      this.index.has(p) || this.index.set(p, []), this.index.get(p).push(d);
    };
    let i = 0;
    const o = (d, m) => {
      for (const [f, p, x, k] of d)
        for (const E of ps(f)) {
          let w;
          try {
            w = hs(E);
          } catch (z) {
            if (z instanceof ae) {
              this.skipped++;
              continue;
            }
            throw z;
          }
          const N = O0(w);
          R0(w, this.trackedStates);
          const S = w[w.length - 1].compound.pseudoElement, y = { steps: w, media: p, layer: x, origin: m, order: i++, specificity: pf(w), decls: k, states: N, pseudo: S, source: m === 0 ? `ua:${w[w.length - 1].compound.tag ?? "*"}` : j0(E, w) };
          this.rules.push(y), s(y, w);
        }
    };
    o(k0.map(([d, m]) => [d, null, 0, Object.entries(m)]), 0), o(l.rules, 1);
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
  /** Whether a rule that may match `element` reads interaction `state` on one of its ancestors (`group-hover:`). */
  readsAncestor(l, s) {
    return this.candidates(l).some((i) => i.states.ancestor.has(s));
  }
  /** Whether `element` carries a class whose interaction state some rule reads on an ancestor. */
  tracks(l, s) {
    for (const i of l.classList) if (this.trackedStates.has(`${s}:${i}`)) return !0;
    return !1;
  }
}
const B0 = /* @__PURE__ */ new Set(["opacity", "z-index", "flex-grow", "flex-shrink", "font-weight", "line-height", "flex", "order", "-webkit-line-clamp", "zoom"]);
function H0(a) {
  if (!a || typeof a != "object") return [];
  const l = [];
  for (const [s, i] of Object.entries(a)) {
    if (i == null || i === "" || typeof i == "boolean") continue;
    const o = s.startsWith("--") ? s : s.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`).replace(/^(webkit|moz|ms)-/, "-$1-"), d = typeof i == "number" && i !== 0 && !B0.has(o) && !o.startsWith("--") ? `${i}px` : String(i);
    l.push([o, d]);
  }
  return l;
}
function U0(a) {
  if (a.tagName !== "svg") return [];
  const l = [];
  for (const s of ["width", "height"]) {
    const i = a.getAttribute(s);
    i !== null && l.push([s, /^[\d.]+$/.test(i) ? `${i}px` : i]);
  }
  return l;
}
const q0 = (a, l) => a.important - l.important || a.origin - l.origin || a.layer - l.layer || a.specificity[0] - l.specificity[0] || a.specificity[1] - l.specificity[1] || a.specificity[2] - l.specificity[2] || a.order - l.order;
class Y0 {
  constructor(l, { theme: s, viewport: i }) {
    this.sheet = l, this.theme = s, this.viewport = i, this.parsed = /* @__PURE__ */ new Map(), this.computed = /* @__PURE__ */ new WeakMap(), this.rootComputed = /* @__PURE__ */ new Map();
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
        const p = d.ownerDocument?.activeElement;
        return !!p && p !== d.ownerDocument.body && typeof d.contains == "function" && d.contains(p);
      }
      return f ? s.has(m) : m === "focus-visible" ? !!d.state?.focus && !d.state?.pointerFocus : !!d.state?.[m];
    };
    return this.sheet.candidates(l, i).filter((d) => (!d.media || d.media.every((m) => A0(m, this.viewport))) && bf(l, d.steps, { state: o, pseudo: i }));
  }
  /** `element`'s computed style, or with `pseudo` (`before`, `after`) that of its pseudo-element's box, whose parent
   * is the element (pass the element's own computed style as `parent`). */
  compute(l, s, i = /* @__PURE__ */ new Set(), o = null) {
    const d = this.matching(l, i, o), m = o ? [] : U0(l), f = o ? [] : H0(l.inlineStyle ?? l.props?.style);
    let p = this.rootComputed;
    s && (p = this.computed.get(s.values), p || this.computed.set(s.values, p = /* @__PURE__ */ new Map()));
    const x = `${d.map((E) => E.order).join(",")}|${m.length ? JSON.stringify(m) : ""}|${f.length ? JSON.stringify(f) : ""}`;
    let k = p.get(x);
    return k || p.set(x, k = this.cascade(d, m, f, s)), { ...k, rules: d, element: l };
  }
  /** The computed style from the matched `rules`, presentational `attrs`, `inline` declarations and the parent's. */
  cascade(l, s, i, o) {
    const d = [];
    for (const g of l)
      for (const [v, h, _] of g.decls) d.push({ prop: v, value: h, important: _ ? 1 : 0, origin: g.origin === 0 ? 0 : 2, layer: g.layer, specificity: g.specificity, order: g.order, source: g.source });
    for (const [g, v] of s) d.push({ prop: g, value: v, important: 0, origin: 1, layer: 0, specificity: [0, 0, 0], order: 0, source: `attr:${g}` });
    for (const [g, v] of i) d.push({ prop: g, value: v, important: 0, origin: 3, layer: 0, specificity: [1, 0, 0], order: 0, source: "style" });
    d.sort(q0);
    const m = this.sheet.properties, f = Object.create(o?.customs ?? null), p = /* @__PURE__ */ new Map(), x = /* @__PURE__ */ new Map();
    for (const g of d) g.prop.startsWith("--") && x.set(g.prop, g.value);
    if (!o && this.theme) for (const g of Ef) this.theme[g] && x.set(`--${g}`, `perchtoken(${g})`);
    const k = (g) => {
      if (p.has(g)) return p.get(g);
      const v = m[g];
      return v && !v.inherits ? v.initial ?? null : g in f ? f[g] : v?.initial ?? null;
    }, E = /* @__PURE__ */ new Set(), w = (g) => {
      if (!x.has(g)) return k(g);
      if (E.has(g)) return null;
      E.add(g);
      const v = ls(x.get(g), w);
      return E.delete(g), x.delete(g), p.set(g, v), (!m[g] || m[g].inherits) && (f[g] = v), v;
    };
    for (const g of [...x.keys()]) w(g);
    const N = /* @__PURE__ */ new Map();
    for (const g of d) {
      if (g.prop.startsWith("--")) continue;
      const v = ls(g.value, k);
      if (v === null) {
        for (const [h] of is(g.prop, "unset")) N.set(h, { value: "unset", source: g.source, origin: g.origin });
        continue;
      }
      for (const [h, _] of is(g.prop, v)) N.set(h, { value: _, source: g.source, origin: g.origin });
    }
    const S = {}, y = {}, z = /* @__PURE__ */ new Set(), O = /* @__PURE__ */ new Set(), D = o?.values, A = { fontSize: D?.["font-size"] ?? ns, viewport: this.viewport }, X = (g, v) => {
      if (/currentcolor/i.test(v)) return this.parseValue(g, v, A, S, D);
      const h = `${g}\0${v}\0${A.fontSize}`;
      let _ = this.parsed.get(h);
      return _ === void 0 && this.parsed.set(h, _ = this.parseValue(g, v, A, S, D)), _;
    }, U = N.size ? [...as, ...[...N.keys()].filter((g) => !z0.has(g))] : as;
    for (const g of U) {
      const v = N.get(g);
      let h = v?.value;
      const _ = E0.has(g);
      if ((h === void 0 || h === "unset" || h === "revert" || h === "revert-layer") && (h = _ ? "inherit" : "initial"), v && (y[g] = v.source, v.origin !== 0 && z.add(g)), h === "inherit" && D && g in D) {
        S[g] = D[g], O.add(g);
        continue;
      }
      (h === "inherit" || h === "initial") && (h = _ ? Tf[g] : Nf[g]), S[g] = X(g, h), g === "font-size" && (A.fontSize = S["font-size"]);
    }
    for (const g of xl) {
      const v = S[`border-${g}-style`];
      (v === "none" || v === "hidden") && (S[`border-${g}-width`] = { px: 0 });
    }
    S["outline-style"] === "none" && (S["outline-width"] = { px: 0 });
    const R = D?.display;
    return (R === "flex" || R === "inline-flex" || R === "grid" || R === "inline-grid") && S.position !== "absolute" && S.position !== "fixed" && (S.display = qd(S.display)), (S.position === "absolute" || S.position === "fixed") && (S.display = qd(S.display)), { values: S, sources: y, own: z, inherited: O, customs: f };
  }
  parseValue(l, s, i, o, d) {
    const m = String(s).trim();
    switch (l) {
      case "font-size": {
        const f = m.toLowerCase(), p = { "xx-small": 9, "x-small": 10, small: 13, medium: 16, large: 18, "x-large": 24, "xx-large": 32 };
        if (p[f]) return p[f];
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
        const p = parseFloat(f);
        return Number.isFinite(p) ? p : 400;
      }
      case "line-height": {
        const f = m.toLowerCase();
        if (f === "normal") return { normal: !0 };
        const p = Yn(f, { fontSize: i.fontSize, viewport: i.viewport });
        return p ? p.unitless ? { factor: p.num } : { px: p.px + p.pct / 100 * i.fontSize } : { normal: !0 };
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
        const f = Kr(m, (p) => this.themeHex(p));
        return f === "currentcolor" || !f ? d?.color ?? { rgba: [0, 0, 0, 1], token: null } : f;
      }
      case "background-color":
      case "border-top-color":
      case "border-right-color":
      case "border-bottom-color":
      case "border-left-color":
      case "outline-color": {
        const f = Kr(m, (p) => this.themeHex(p));
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
        return rs(m, i);
      default:
        return m.toLowerCase().startsWith("var(") ? m : /^[a-z-]+$/i.test(m) ? m.toLowerCase() : m;
    }
  }
}
function qd(a) {
  return a === "inline" || a === "inline-block" || a === "contents" ? "block" : a === "inline-flex" ? "flex" : a === "inline-grid" ? "grid" : a;
}
const Qr = (a) => a && a.rgba ? { value: C0(a.rgba), token: a.token ?? null } : null, G0 = { 9.28: 11, 9.92: 12, 10.4: 12, 10.88: 13, 11: 13, 11.2: 13, 11.52: 13, 12: 15, 12.5: 15, 13: 16, 14: 17, 16: 19 };
function K0(a, l) {
  const s = l?.(a);
  if (Number.isFinite(s)) return s;
  const i = Math.round(a * 100) / 100;
  return G0[i] ?? Math.round(a * 1.2);
}
function _l(a, l) {
  const s = a["line-height"], i = a["font-size"];
  return s.normal ? K0(i, l) : s.factor !== void 0 ? s.factor * i : s.px;
}
const Q0 = (a) => le(a, ",").map((l) => l.trim().replace(/^["']|["']$/g, "")).join(", ");
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
//! - `blocks_pointer` on a node that takes pointer events under an ancestor that lets them through; `tabular` on one
//!   whose digits are tabular; `scrollbar` (its width) on a vertical scroller
//! - a node `mount` was given a parity table for (`options.names`) carries `name` (`name` or `name:key`, the engine
//!   id tests find it by) and, for a name that is the element's own text, `range_name`.
//! - letter-spaced text is a `div` (no `id`) around the run with the spacing as room after it.
//!
//! Text styles follow GPUI's inheritance: a node carries a text style when it sets one itself (so an ancestor's
//! hover colour does not reach it, as in CSS) or when the inherited value would differ (`line-height: normal`, a
//! multiplier under a new size). `tokens` names the theme token each colour came from.
const V0 = "perch-native-description/1", qn = Symbol("display"), Vr = {
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
for (const a of X0) Vr[a] = /^(w|h|min_|max_|top|right|bottom|left)/.test(a) ? "auto" : 0;
Vr.rounded = 0;
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
}, Yd = { pointerdown: "mouse_down", mousedown: "mouse_down", click: "click", keydown: "key_down", pointerup: "mouse_up", mouseup: "mouse_up" }, ys = (a) => {
  const l = a.props["data-testid"];
  if (l) return `${a.tagName}[data-testid="${l}"]`;
  if (a.props.id) return `${a.tagName}#${a.props.id}`;
  const s = a.classList.find((o) => !o.includes(":") && !o.includes("[")) ?? a.classList[0];
  if (s) return `${a.tagName}.${s}`;
  const i = a.parentElement;
  return i && i.tagName !== "body" ? `${ys(i)} > ${a.tagName}` : a.tagName;
};
class I0 {
  constructor() {
    this.map = /* @__PURE__ */ new Map();
  }
  add(l, s, i, o, d, m = "") {
    const f = `${l}|${s}|${i}|${o}`, p = this.map.get(f);
    if (p) {
      !p.elements.includes(d) && p.elements.length < 4 && p.elements.push(d), p.count++;
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
}, $0 = /^(text|search|url|email|tel|password|number)$/, P0 = 162.13 / 12.8;
function tg(a, l) {
  const s = typeof a == "object" && /^min\((.*)\)$/.exec(String(a?.expr ?? "").trim());
  if (!s) return;
  const i = le(s[1], ",").map((o) => Yn(o.trim(), { fontSize: l })).filter((o) => o && !o.pct && !o.num).map((o) => o.px);
  return i.length ? Math.min(...i) : void 0;
}
function eg(a, l) {
  if (typeof a != "object" || !a?.expr) return !1;
  const s = Yn(a.expr, { fontSize: l["font-size"] }), i = (l["margin-left"]?.px ?? NaN) + (l["margin-right"]?.px ?? NaN);
  return !!s && !s.num && s.pct === 100 && Math.abs(s.px + i) < 0.01;
}
function Cf(a) {
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
function Gd(a, l, s, i = !1) {
  const o = a.values, d = Cf(o);
  if (d?.length === 0) return;
  const m = o.transform && o.transform !== "none" ? "transform" : "translate", f = { fontSize: o["font-size"] }, p = (E, w) => {
    const N = Yn(E, f);
    if (!(!N || N.unitless && N.num))
      return N.pct ? typeof w == "number" ? N.px + N.pct / 100 * w : void 0 : N.px;
  }, x = d ? p(d[0], l.w) : void 0, k = d ? p(d[1], l.h) : void 0;
  if (x === void 0 || k === void 0) {
    const E = !i && d ? d.map((w) => Yn(w, f)) : null;
    if (E?.every((w) => w && !(w.unitless && w.num))) {
      l[Mf] = E.map((w) => [w.px, w.pct ?? 0]);
      return;
    }
    s("unsupported", m, o[m], a.sources[m]);
    return;
  }
  if (i) {
    x && (l.left = x), k && (l.top = k);
    return;
  }
  x && (l.ml = (l.ml ?? 0) + x), k && (l.mt = (l.mt ?? 0) + k);
}
const Mf = Symbol("perch.shift");
function ng(a, l, s) {
  const i = a.ownerDocument, o = i?.measure?.(a) ?? null;
  if (o) {
    const [[m, f], [p, x]] = s, k = m + f / 100 * o.width, E = p + x / 100 * o.height;
    k && (l.ml = (typeof l.ml == "number" ? l.ml : 0) + k), E && (l.mt = (typeof l.mt == "number" ? l.mt : 0) + E);
  }
  const d = o ? `${o.width}x${o.height}` : "";
  d === a.shiftSeen ? a.shiftTries = 0 : (a.shiftTries ?? 0) < xf && i?.retries && (a.shiftSeen = d, a.shiftTries = (a.shiftTries ?? 0) + 1, i.retries.push(() => i.afterCommit?.()));
}
function Hr(a, l, s = null) {
  const i = a.values, o = {}, d = (A) => a.sources[A], m = (A) => a.sources[A] !== void 0, f = i.display;
  f === "none" ? o.display = "hidden" : f === "flex" || f === "inline-flex" ? o.display = "flex" : (f === "grid" || f === "inline-grid") && (o.display = "flex", o.flex_direction = "col", l("approximated", "display", f, d("display"), "one-column flex column"), i["grid-template-columns"] && i["grid-template-columns"] !== "none" && l("unsupported", "grid-template-columns", i["grid-template-columns"], d("grid-template-columns"))), a.element.hidden && (o.display = "hidden");
  const p = o.display === "flex";
  if (p && o.flex_direction !== "col") {
    const A = { row: "row", column: "col", "row-reverse": "row_reverse", "column-reverse": "col_reverse" }[i["flex-direction"]] ?? "row";
    o.flex_direction = A;
  }
  if (p) {
    (i["flex-wrap"] === "wrap" || i["flex-wrap"] === "wrap-reverse") && (o.flex_wrap = "wrap");
    const A = f === "grid" || f === "inline-grid", X = { "flex-start": "start", start: "start", "self-start": "start", "flex-end": "end", end: "end", "self-end": "end", center: "center", baseline: "baseline", "first baseline": "baseline" }[i["align-items"]];
    X && (o.items = X);
    let U = { "flex-start": "start", start: "start", "flex-end": "end", end: "end", center: "center", "space-between": "between", "space-around": "around", "space-evenly": "evenly" }[i["justify-content"]];
    if (A) {
      const v = { center: "center", end: "end", "flex-end": "end", start: "start", "flex-start": "start" }[i["justify-items"]];
      v && (o.items = v), i["align-items"] === "center" && (U = "center");
    }
    U && (o.justify = U);
    const R = mn(i["row-gap"]), g = mn(i["column-gap"]);
    typeof R == "number" && R && (o.gap_y = R), typeof g == "number" && g && !A && (o.gap_x = g);
  }
  i["flex-grow"] && (o.flex_grow = i["flex-grow"]), i["flex-shrink"] !== 1 && (o.flex_shrink = i["flex-shrink"]);
  const x = mn(i["flex-basis"]);
  x !== void 0 && x !== "auto" && (o.flex_basis = x);
  const k = { "flex-start": "start", start: "start", "flex-end": "end", end: "end", center: "center", baseline: "baseline", stretch: "stretch" }[i["align-self"]];
  k && (o.self = k);
  for (const [A, X] of [["w", "width"], ["h", "height"], ["min_w", "min-width"], ["min_h", "min-height"], ["max_w", "max-width"], ["max_h", "max-height"]]) {
    const U = i[X], R = mn(U);
    if (R === void 0 && X === "width" && eg(U, i)) {
      o.self = "stretch", l("approximated", X, U.expr, d(X), "stretched across its parent, inside its margins");
      continue;
    }
    const g = R === void 0 && /^max-/.test(X) ? tg(U, i["font-size"]) : void 0;
    if (g !== void 0) {
      o[A] = g, l("approximated", X, U.expr, d(X), "the fixed bound of min()");
      continue;
    }
    if (R === void 0) {
      typeof U == "object" && U.expr ? l("unsupported", X, U.expr, d(X), "no calc() in the engine") : typeof U == "string" && !["auto", "none"].includes(U) && l("unsupported", X, U, d(X));
      continue;
    }
    R !== "auto" && (o[A] = R);
  }
  const E = ["top", "right", "bottom", "left"];
  for (const A of E) {
    const X = A[0];
    for (const [U, R] of [["p", "padding"], ["m", "margin"]]) {
      const g = i[`${R}-${A}`], v = mn(g);
      if (v === void 0) {
        g?.expr && l("unsupported", `${R}-${A}`, g.expr, d(`${R}-${A}`), "no calc() in the engine");
        continue;
      }
      v !== 0 && (o[`${U}${X}`] = v);
    }
  }
  const w = i.position;
  if (w === "absolute" || w === "fixed") {
    o.position = "absolute", w === "fixed" && l("approximated", "position", "fixed", d("position"), "absolute in the overlay layer");
    for (const A of E) {
      const X = mn(i[A]);
      X !== void 0 && X !== "auto" && (o[A] = X);
    }
    if (w === "fixed" && s && o.w === void 0 && o.right === void 0 && typeof o.left == "number") {
      const A = s.width - o.left - (typeof o.ml == "number" ? o.ml : 0) - (typeof o.mr == "number" ? o.mr : 0);
      o.max_w = typeof o.max_w == "number" ? Math.min(o.max_w, A) : A;
    }
    Gd(a, o, l);
  } else w === "sticky" ? l("unsupported", "position", "sticky", d("position")) : Cf(i)?.length !== 0 && (o.position = "relative", Gd(a, o, l, !0));
  i["z-index"] !== "auto" && m("z-index") && l("unsupported", "z-index", i["z-index"], d("z-index"), "paint order is tree order");
  for (const [A, X] of [["overflow_x", "overflow-x"], ["overflow_y", "overflow-y"]]) {
    const U = i[X];
    U === "hidden" || U === "clip" ? o[A] = "hidden" : (U === "auto" || U === "scroll") && (o[A] = "scroll");
  }
  (i.visibility === "hidden" || i.visibility === "collapse") && (o.visibility = "invisible");
  const N = i["background-color"];
  N?.unreadable ? l("unsupported", "background-color", N.unreadable, d("background-color")) : N?.rgba && N.rgba[3] > 0 && (o.bg = Qr(N)), i["background-image"] && i["background-image"] !== "none" && l("unsupported", "background-image", i["background-image"], d("background-image"));
  const S = E.map((A) => mn(i[`border-${A}-width`]) || 0), y = [];
  E.forEach((A, X) => {
    if (!S[X]) return;
    o[`border_${A[0]}`] = S[X];
    const U = i[`border-${A}-style`];
    U !== "solid" && l("approximated", `border-${A}-style`, U, d(`border-${A}-style`), "drawn solid");
    const R = Qr(i[`border-${A}-color`]);
    R && y.push(R);
  }), y.length && (o.border_color = y[0], y.some((A) => A.value !== y[0].value) && l("approximated", "border-color", y.map((A) => A.value).join(" "), d("border-top-color"), "one border colour"));
  const z = (A) => {
    const X = mn(i[`border-${A}-radius`]) || 0;
    if (typeof X != "string") return X;
    const U = parseFloat(X) / 100, R = [o.w, o.h].filter((g) => typeof g == "number");
    return X === "auto" || !(U > 0) ? 0 : R.length ? Math.round(Math.min(U, 0.5) * Math.min(...R) * 100) / 100 : 9999;
  }, O = ["top-left", "top-right", "bottom-right", "bottom-left"].map(z);
  O.every((A) => A === O[0]) ? O[0] && (o.rounded = O[0]) : ["tl", "tr", "br", "bl"].forEach((A, X) => {
    O[X] && (o[`rounded_${A}`] = O[X]);
  }), i.opacity !== 1 && (o.opacity = Math.round(i.opacity * 1e3) / 1e3);
  const D = i["box-shadow"];
  if (D && D !== "none" && le(D, ",").some((A) => !/^0(px)?\s+0(px)?\s+(0(px)?\s+)?(0(px)?\s+)?(#0000|transparent|rgba?\(0,\s*0,\s*0,\s*0\))/.test(A.trim())) && (o.shadow = "lg", l("approximated", "box-shadow", D, d("box-shadow"), "the engine's large shadow preset")), i.cursor && i.cursor !== "auto" && !a.inherited.has("cursor")) {
    const A = { pointer: "pointer", default: "default", text: "text", move: "move", "not-allowed": "not_allowed", grab: "move", grabbing: "move" }[i.cursor];
    A ? o.cursor = A : l("unsupported", "cursor", i.cursor, d("cursor"));
  }
  return i["text-overflow"] === "ellipsis" && (o.text_ellipsis = !0), i["text-decoration-line"] === "underline" ? o.underline = !0 : i["text-decoration-line"] && i["text-decoration-line"] !== "none" && l("unsupported", "text-decoration-line", i["text-decoration-line"], d("text-decoration-line")), o;
}
const ag = { "tabular-nums": "tnum", "proportional-nums": "pnum", "lining-nums": "lnum", "oldstyle-nums": "onum", "slashed-zero": "zero", "diagonal-fractions": "frac", "stacked-fractions": "afrc", ordinal: "ordn" };
function Af(a) {
  if (!a || a === "normal") return "";
  const l = String(a).trim().split(/\s+/).map((s) => ag[s]);
  return l.every(Boolean) ? l.join(",") : null;
}
function Ur(a, l) {
  const s = a.values, i = s["line-height"];
  return {
    text_color: Qr(s.color),
    text_size: Math.round(s["font-size"] * 1e3) / 1e3,
    font_features: Af(s["font-variant-numeric"]) ?? "",
    font_weight: s["font-weight"],
    line_height: i.factor !== void 0 ? { factor: i.factor } : { px: Math.round(_l(s, l) * 1e3) / 1e3 },
    font_family: W0(s["font-family"]),
    italic: s["font-style"] === "italic" || s["font-style"] === "oblique",
    whitespace: s["white-space"] === "nowrap" || s["white-space"] === "pre" ? "nowrap" : "normal",
    text_align: { center: "center", right: "right", end: "right" }[s["text-align"]] ?? "left"
  };
}
const Kd = (a, l) => a.factor !== void 0 ? a.factor * l : a.px, jf = (a, l) => JSON.stringify(a) === JSON.stringify(l);
function qr(a, l, s) {
  const i = {}, o = (f, p) => p.some((x) => !a.inherited.has(x));
  for (const [f, p] of [["text_color", ["color"]], ["text_size", ["font-size"]], ["font_weight", ["font-weight"]], ["font_family", ["font-family"]], ["italic", ["font-style"]], ["whitespace", ["white-space"]], ["text_align", ["text-align"]], ["font_features", ["font-variant-numeric"]]])
    (o(f, p) || !jf(l[f], s[f])) && (i[f] = l[f]);
  const d = Kd(l.line_height, l.text_size), m = s.line_height ? Kd(s.line_height, l.text_size) : NaN;
  return (o("line_height", ["line-height"]) || !(Math.abs(d - m) <= 1e-3)) && (i.line_height = l.line_height), i;
}
const lg = (a, l) => ({ ...a, ...l });
function Yr(a, l) {
  const s = {};
  for (const [i, o] of Object.entries(a))
    o && typeof o == "object" && "value" in o ? (s[i] = o.value, o.token && (l[i] = o.token)) : i === "line_height" ? s[i] = o.factor !== void 0 ? Math.round(o.factor * 1e3) / 1e3 : `${o.px}px` : i === "italic" ? o && (s.italic = !0) : s[i] = o;
  return s.italic === !1 && delete s.italic, s;
}
function Qd(a, l) {
  const s = {};
  for (const i of /* @__PURE__ */ new Set([...Object.keys(a), ...Object.keys(l)])) {
    const o = a[i], d = l[i];
    jf(o, d) || (s[i] = d === void 0 ? i in Vr ? Vr[i] : null : d);
  }
  return s;
}
function Vd(a, l) {
  const s = a.values;
  for (const [i, o] of Object.entries(a.sources)) {
    if (i.startsWith("--") || L0.has(i) || o.startsWith("ua:")) continue;
    const d = s[i];
    switch (i) {
      case "letter-spacing":
        d !== "normal" && d?.px !== 0 && l("approximated", i, d?.px !== void 0 ? `${Math.round(d.px * 1e3) / 1e3}px` : d, o, d?.px < 0 ? "the run's box is as wide as with the spacing (the glyphs reach past it; where the element clips, the run is drawn smaller to fit)" : "the run is as wide as with the spacing (room after it), the letters are not spread");
        break;
      case "font-variant-numeric":
        d !== "normal" && Af(d) === null && l("unsupported", i, d, o);
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
        s["outline-style"] !== "none" && i === "outline-style" && l("unsupported", "outline", `${mn(s["outline-width"])}px ${s["outline-style"]} ${Qr(s["outline-color"])?.value ?? ""}`.trim(), o, "no outline in the engine (no focus ring)");
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
function rg(a, l, s, i) {
  const o = ys(a), d = [], m = (O, D, A, X, U) => d.push([O, D, A, X ?? "(user agent)", o, U]), f = i.cascade.compute(a, l), p = {}, x = Hr(f, m, i.viewport), k = x[Mf];
  Vd(f, m);
  const E = Ur(f, i.measure), w = qr(f, E, s), N = Yr({ ...x, ...w }, p), S = {}, y = i.cascade.matching(a, "*").filter((O) => O.states.subject.size);
  for (const [O, D] of [["hover", ["hover"]], ["focus", ["focus", "focus-visible"]], ["active", ["active", "hover"]]]) {
    if (!y.some((g) => D.some((v) => g.states.subject.has(v)))) continue;
    const A = i.cascade.compute(a, l, new Set(D)), X = {}, U = Yr({ ...Hr(A, () => {
    }), ...qr(A, Ur(A, i.measure), s) }, X);
    O === "focus" && Vd(A, m);
    const R = Qd(N, U);
    if (Object.keys(R).length) {
      S[O] = R;
      const g = Object.fromEntries(Object.entries(X).filter(([v]) => v in R));
      Object.keys(g).length && (S[`${O}_tokens`] = g);
    }
  }
  if (i.cascade.sheet.tracks(a, "hover") && (S.group = Xd(a), S.track_hover = !0), i.cascade.sheet.readsAncestor(a, "hover"))
    for (let O = a.parentNode; O?.state; O = O.parentNode) {
      if (!i.cascade.sheet.tracks(O, "hover")) continue;
      const D = O.state.hover;
      O.state.hover = !0;
      let A;
      try {
        A = i.cascade.compute(a, l);
      } finally {
        O.state.hover = D;
      }
      const X = {}, U = Yr({ ...Hr(A, () => {
      }), ...qr(A, Ur(A, i.measure), s) }, X), R = Qd(N, U);
      if (!Object.keys(R).length) continue;
      const g = Object.fromEntries(Object.entries(X).filter(([v]) => v in R));
      (S.group_hover ??= []).push({ group: Xd(O), style: R, ...Object.keys(g).length ? { tokens: g } : {} });
    }
  if (/tabular/.test(String(f.values["font-variant-numeric"] ?? "")) && (S.tabular = !0), /^(anywhere|break-word)$/.test(String(f.values["overflow-wrap"] ?? "")) && (S.break_anywhere = !0), x.overflow_y === "scroll") {
    const O = Number.parseFloat(f.customs?.["--scrollbar-size"] ?? "");
    O > 0 && (S.scrollbar = O);
  }
  f.values["pointer-events"] !== "none" && l?.values["pointer-events"] === "none" && (S.blocks_pointer = !0);
  const z = Object.entries(F0).filter(([, O]) => O.some((D) => typeof a.props[D] == "function")).map(([O]) => O);
  return !z.includes("click") && ts(a) && z.push("click"), z.length && (S.events = z), { computed: f, style: N, tokens: p, extra: S, meta: fg(a), reports: d, childText: lg(s, w), where: o, shift: k };
}
function ig(a, l, s, i) {
  const o = { before: null, after: null };
  for (const d of ["before", "after"]) {
    if (!i.cascade.matching(a, /* @__PURE__ */ new Set(), d).length) continue;
    const m = i.cascade.compute(a, l, /* @__PURE__ */ new Set(), d), f = String(m.values.content ?? "none").trim();
    if (f === "none" || f === "normal") continue;
    const p = /^(["'])(.*)\1$/.exec(f)?.[2] ?? "", x = (S, y, z, O, D) => i.findings.add(S, y, z, O ?? "(user agent)", `${ys(a)}::${d}`, D), k = {}, E = Hr(m, x, i.viewport), N = { kind: "div", style: Yr({ ...E, ...qr(m, Ur(m, i.measure), s) }, k), tokens: k, children: p ? [{ kind: "text", text: p }] : [] };
    Object.defineProperty(N, qn, { value: m.values.display }), o[d] = N;
  }
  return o;
}
const Xd = (a) => `~g${a.id}`, og = ["pt", "pr", "pb", "pl", "mt", "mr", "mb", "ml", "border_t", "border_r", "border_b", "border_l", "bg"];
function sg(a) {
  return a.kind === "div" && a[qn] === "inline" && !a.events?.length && !a.meta?.attrs?.["data-testid"] && !og.some((l) => a.style?.[l]) && a.children?.every((l) => l.kind === "text");
}
function Of(a, l, s, i, o = "") {
  const d = `${o}/${a.id}.${a.version}`;
  let m = i.cache.get(a);
  (!m || m.key !== d) && i.cache.set(a, m = { key: d, part: rg(a, l, s, i) });
  const { computed: f, tokens: p, extra: x, reports: k, childText: E, where: w } = m.part;
  for (const h of k) i.findings.add(...h);
  const N = (h, _, M, B, L) => i.findings.add(h, _, M, B, w, L), S = { ...m.part.style };
  m.part.shift && ng(a, S, m.part.shift);
  const y = { kind: "div", id: a.id, style: S, tokens: p, meta: m.part.meta, ...x };
  Object.defineProperty(y, qn, { value: f.values.display }), a.measured && a.ownerDocument?.measureKey && (y.measure = a.ownerDocument.measureKey(a));
  const z = a.tagName;
  if (a.props["data-perch-engine"] != null)
    return y.kind = "engine", y.engine = String(a.props["data-perch-engine"]), y.key = String(a.props["data-perch-key"] ?? ""), y;
  if (z === "svg")
    return y.kind = a.props["data-perch-image"] ? "image" : "svg", y.markup = pg(a), y;
  if (z === "input" || z === "textarea" || z === "select") {
    y.kind = "input", y.input_type = z === "input" ? String(a.props.type ?? "text") : z;
    for (const M of ["placeholder", "checked", "disabled"]) a.props[M] !== void 0 && (y[M] = a.props[M]);
    if (/^(checkbox|radio)$/.test(y.input_type) && (y.checked = a.checked), z !== "select" && (y.value = a.value), z === "input" && $0.test(y.input_type) && (y.field_w = P0 * f.values["font-size"]), z === "textarea" && S.h === void 0) {
      const M = f.values, B = ($) => $ && typeof $ == "object" && "px" in $ ? $.px : 0, L = ($) => M[`border-${$}-style`] === "none" ? 0 : B(M[`border-${$}-width`]), I = Number(a.props.rows) > 0 ? Math.floor(Number(a.props.rows)) : 2;
      S.h = I * _l(M, i.measure) + B(M["padding-top"]) + B(M["padding-bottom"]) + L("top") + L("bottom");
    }
    const { before: h, after: _ } = ig(a, f, E, i);
    return (h || _) && (y.children = [h, _].filter(Boolean)), y;
  }
  if (z === "img") {
    y.kind = "image", y.src = a.props.src ?? null;
    for (const [h, _] of [["width", "w"], ["height", "h"]]) {
      const M = Number(a.props[h]);
      S[_] === void 0 && a.props[h] != null && Number.isFinite(M) && (S[_] = M);
    }
    return y;
  }
  const O = f.values["text-transform"], D = [];
  let A = !1, X = !1;
  for (const h of a.childNodes) {
    if (h instanceof $r) {
      if (h.hidden || h.data === "") continue;
      A = !0;
      const B = D[D.length - 1];
      if (B?.kind === "text")
        B.source = (B.source ?? B.text) + h.data, B.text = Ld(B.source, O), B.text === B.source && delete B.source;
      else {
        const L = Ld(h.data, O);
        D.push(L === h.data ? { kind: "text", text: L } : { kind: "text", text: L, source: h.data });
      }
      continue;
    }
    if (!(h instanceof It)) continue;
    const _ = Of(h, f, E, i, d), M = _[qn];
    M === "inline" || M === "inline-block" || M === "inline-flex" ? A = !0 : M !== "none" && (X = !0), D.push(_);
  }
  if (/(^|\s)inline-flex(\s|$)/.test(String(a.props?.className ?? "")) && S.w === void 0)
    for (const h of D)
      h.style?.flex_grow && h.style.min_w === 0 && h.style.overflow_x === "hidden" && (delete h.style.min_w, delete h.style.flex_grow, delete h.style.flex_basis, delete h.style.overflow_x, delete h.style.overflow_y);
  if (!S.display && A && D.some((h) => h.kind !== "text") && D.every((h) => h.kind === "text" || sg(h))) {
    const h = D.map((_) => _.kind === "text" ? _.text : _.children.map((M) => M.text).join("")).join("");
    N("approximated", "display", "inline text elements in a line of text", "(inline formatting)", "their text joined to the line, in its font"), D.splice(0, D.length, { kind: "text", text: h });
  }
  const U = D.some((h) => h.kind !== "text"), R = D.length === 1 && D[0].kind !== "text" && /^inline-(block|flex)$/.test(D[0][qn]) ? D[0] : null;
  if (!S.display && R) {
    const h = i.cache.get(a.childNodes.find((M) => M.id === R.id))?.part.computed, _ = h ? Lr(f.values, i.measure) - dg(h.values, i.measure, R) : 0;
    S.display = "flex", S.flex_direction = "col", S.items = "start", _ > 0 && (R.style.mt = Math.round(((R.style.mt ?? 0) + _) * 100) / 100), N("approximated", "display", `${f.values.display} holding one ${R[qn]} box`, "(inline formatting)", "a column, the box lowered to the line's baseline");
  } else if (!S.display && D.length === 1 && (D[0].kind === "svg" || D[0].kind === "image") && D[0][qn] === "inline" && typeof D[0].style.h == "number") {
    const h = D[0], _ = Lr(f.values, i.measure), M = _l(f.values, i.measure) - _, B = (L) => Math.round(L * 100) / 100;
    S.display = "flex", S.flex_direction = "col", S.items = "start", _ > h.style.h && (h.style.mt = B((h.style.mt ?? 0) + _ - h.style.h)), M > 0 && (h.style.mb = B((h.style.mb ?? 0) + M)), N("approximated", "display", `${f.values.display} holding one inline image`, "(inline formatting)", "a column, the image on the line's baseline");
  } else if (!S.display && A && U) {
    if (S.display = "flex", S.flex_direction = X ? "col" : "row", !X) S.items = "baseline";
    else for (const h of D) h.kind !== "text" && /^inline-(block|flex)$/.test(h[qn]) && !h.style.self && (h.style.self = "start");
    N("approximated", "display", `${f.values.display} with inline content`, "(inline formatting)", X ? "a column of its children" : "a row on the text baseline");
  }
  const g = f.values["letter-spacing"]?.px, v = f.values["overflow-x"] !== "visible";
  if (g)
    for (let h = 0; h < D.length; h++) {
      const _ = D[h];
      if (_.kind !== "text") continue;
      const M = Math.round(g * [..._.text].length * 1e3) / 1e3;
      if (g > 0 || !v) {
        D[h] = { kind: "div", style: { pr: M }, tokens: {}, children: [_] };
        continue;
      }
      const B = f.values["font-size"], L = Math.max(0.8, 1 + g / (0.55 * B)), I = Math.round(_l(f.values, i.measure) * 1e3) / 1e3;
      D[h] = { kind: "div", style: { text_size: Math.round(B * L * 1e3) / 1e3, line_height: `${I}px` }, tokens: {}, children: [_] };
    }
  return y.children = D, y;
}
function cg(a, l) {
  if (!l) return null;
  let i = (l.self ? a : l.closest ? vf(a, l.closest) : l.find ? kl(a, l.find)[0] : null)?.getAttribute(l.attr) ?? null;
  return i && l.strip && i.startsWith(l.strip) && (i = i.slice(l.strip.length)), i;
}
function ug(a, l, s) {
  const i = l.map((m) => [m, Ir(m.selector)]), o = /* @__PURE__ */ new Map(), d = (m) => {
    for (const f of m.children) {
      const p = s.get(f.id);
      if (p)
        for (const [x, k] of i) {
          const E = x.textRange ? "range_name" : "name";
          if (x.textRange && p[E] != null || !k.some((y) => bf(f, y))) continue;
          const w = cg(f, x.key), N = w == null ? o.get(x.name) ?? 0 : 0;
          w == null && o.set(x.name, N + 1);
          const S = w != null ? `${x.name}:${w}` : N ? `${x.name}@${N}` : x.name;
          p[E] == null ? p[E] = S : (p.also ??= []).push(S);
        }
      d(f);
    }
  };
  d(a.documentElement);
}
const Xr = 0.9521, Rf = 0.2256, Lr = (a, l) => (_l(a, l) - (Xr + Rf) * a["font-size"]) / 2 + Xr * a["font-size"];
function dg(a, l, s) {
  const i = (p) => p && typeof p == "object" && "px" in p ? p.px : 0, o = a["border-top-style"] === "none" ? 0 : i(a["border-top-width"]), d = s?.children ?? [], m = d.length === 1 && (d[0].kind === "svg" || d[0].kind === "image") && typeof d[0].style.h == "number" ? d[0] : null, f = m ? Math.max(Lr(a, l), (m.style.mt ?? 0) + m.style.h) : Lr(a, l);
  return i(a["padding-top"]) + o + f;
}
const Ld = (a, l) => l === "uppercase" ? a.toUpperCase() : l === "lowercase" ? a.toLowerCase() : l === "capitalize" ? a.replace(/\b\p{L}/gu, (s) => s.toUpperCase()) : a, Df = /* @__PURE__ */ new Set(["children", "style", "className", "key", "ref", "dangerouslySetInnerHTML"]);
function fg(a) {
  const l = {};
  for (const [s, i] of Object.entries(a.props)) {
    if (Df.has(s) || typeof i == "function" || i === void 0 || i === null || typeof i == "object") continue;
    const o = s.startsWith("aria-") || s.startsWith("data-");
    if (i === !1 && !o) continue;
    const d = s === "htmlFor" ? "for" : s === "tabIndex" ? "tabindex" : s;
    l[d] = typeof i == "boolean" ? o ? String(i) : "" : String(i);
  }
  return { tag: a.tagName, classes: a.classList, attrs: l };
}
const mg = (a) => a === "className" ? "class" : /^(viewBox|preserveAspectRatio|gradientUnits|gradientTransform|patternUnits|xmlns)$/.test(a) ? a : a.replace(/[A-Z]/g, (l) => `-${l.toLowerCase()}`), Zd = (a) => String(a).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
function pg(a) {
  if (a.props["data-perch-markup"]) return String(a.props["data-perch-markup"]);
  const l = (s) => {
    const i = [];
    for (const [d, m] of Object.entries(s.props))
      Df.has(d) || typeof m == "function" || m === void 0 || m === null || m === !1 || typeof m == "object" || d.startsWith("data-") || d.startsWith("aria-") || d === "focusable" || d === "role" || d === "title" || i.push(`${mg(d)}="${Zd(m === !0 ? "" : m)}"`);
    s.tagName === "svg" && !s.props.xmlns && i.unshift('xmlns="http://www.w3.org/2000/svg"');
    const o = s.childNodes.map((d) => d instanceof $r ? Zd(d.data) : l(d)).join("");
    return `<${s.tagName}${i.length ? ` ${i.join(" ")}` : ""}>${o}</${s.tagName}>`;
  };
  return l(a);
}
function hg(a) {
  const l = a.theme?.() ?? {}, s = {};
  for (const i of Ef) l[i] && (s[i] = l[i]);
  return s;
}
const gg = { font_features: "" };
function bg(a, l, s, i = {}, o = null) {
  const d = hg(l), m = l.viewport?.() ?? { width: 1e3, height: 800 }, f = JSON.stringify([d, m]);
  (i.look !== f || i.sheet !== s) && Object.assign(i, { look: f, sheet: s, cache: /* @__PURE__ */ new WeakMap(), cascade: new Y0(s, { theme: d, viewport: m }), top: null });
  const { cascade: p, cache: x } = i, k = { cascade: p, cache: x, viewport: m, findings: new I0(), measure: l.lineHeight ? (N) => l.lineHeight(N) : null };
  i.top ??= p.compute(a.body, p.compute(a.documentElement, null));
  const E = a.body.children.map((N) => Of(N, i.top, gg, k));
  if (o?.length) {
    const N = /* @__PURE__ */ new Map(), S = (y) => {
      y.id && N.set(y.id, y);
      for (const z of y.children ?? []) S(z);
    };
    E.forEach(S), ug(a, o, N);
  }
  const w = /* @__PURE__ */ new Set();
  for (const N of [a, a.defaultView])
    for (const { type: S } of N?.listeners ?? []) Yd[S] && w.add(Yd[S]);
  return { schema: V0, root: E[0] ?? null, overlays: E.slice(1), document_events: [...w].sort(), unsupported: k.findings.list() };
}
const vg = { layers: ["properties", "theme", "base", "utilities"], properties: { "--tw-translate-x": { inherits: !1, initial: "0" }, "--tw-translate-y": { inherits: !1, initial: "0" }, "--tw-translate-z": { inherits: !1, initial: "0" }, "--tw-rotate-x": { inherits: !1, initial: null }, "--tw-rotate-y": { inherits: !1, initial: null }, "--tw-rotate-z": { inherits: !1, initial: null }, "--tw-skew-x": { inherits: !1, initial: null }, "--tw-skew-y": { inherits: !1, initial: null }, "--tw-space-y-reverse": { inherits: !1, initial: "0" }, "--tw-border-style": { inherits: !1, initial: "solid" }, "--tw-leading": { inherits: !1, initial: null }, "--tw-font-weight": { inherits: !1, initial: null }, "--tw-tracking": { inherits: !1, initial: null }, "--tw-ordinal": { inherits: !1, initial: null }, "--tw-slashed-zero": { inherits: !1, initial: null }, "--tw-numeric-figure": { inherits: !1, initial: null }, "--tw-numeric-spacing": { inherits: !1, initial: null }, "--tw-numeric-fraction": { inherits: !1, initial: null }, "--tw-shadow": { inherits: !1, initial: "0 0 #0000" }, "--tw-shadow-color": { inherits: !1, initial: null }, "--tw-shadow-alpha": { inherits: !1, initial: "100%" }, "--tw-inset-shadow": { inherits: !1, initial: "0 0 #0000" }, "--tw-inset-shadow-color": { inherits: !1, initial: null }, "--tw-inset-shadow-alpha": { inherits: !1, initial: "100%" }, "--tw-ring-color": { inherits: !1, initial: null }, "--tw-ring-shadow": { inherits: !1, initial: "0 0 #0000" }, "--tw-inset-ring-color": { inherits: !1, initial: null }, "--tw-inset-ring-shadow": { inherits: !1, initial: "0 0 #0000" }, "--tw-ring-inset": { inherits: !1, initial: null }, "--tw-ring-offset-width": { inherits: !1, initial: "0" }, "--tw-ring-offset-color": { inherits: !1, initial: "#fff" }, "--tw-ring-offset-shadow": { inherits: !1, initial: "0 0 #0000" }, "--tw-outline-style": { inherits: !1, initial: "solid" }, "--tw-blur": { inherits: !1, initial: null }, "--tw-brightness": { inherits: !1, initial: null }, "--tw-contrast": { inherits: !1, initial: null }, "--tw-grayscale": { inherits: !1, initial: null }, "--tw-hue-rotate": { inherits: !1, initial: null }, "--tw-invert": { inherits: !1, initial: null }, "--tw-opacity": { inherits: !1, initial: null }, "--tw-saturate": { inherits: !1, initial: null }, "--tw-sepia": { inherits: !1, initial: null }, "--tw-drop-shadow": { inherits: !1, initial: null }, "--tw-drop-shadow-color": { inherits: !1, initial: null }, "--tw-drop-shadow-alpha": { inherits: !1, initial: "100%" }, "--tw-drop-shadow-size": { inherits: !1, initial: null }, "--tw-backdrop-blur": { inherits: !1, initial: null }, "--tw-backdrop-brightness": { inherits: !1, initial: null }, "--tw-backdrop-contrast": { inherits: !1, initial: null }, "--tw-backdrop-grayscale": { inherits: !1, initial: null }, "--tw-backdrop-hue-rotate": { inherits: !1, initial: null }, "--tw-backdrop-invert": { inherits: !1, initial: null }, "--tw-backdrop-opacity": { inherits: !1, initial: null }, "--tw-backdrop-saturate": { inherits: !1, initial: null }, "--tw-backdrop-sepia": { inherits: !1, initial: null }, "--tw-duration": { inherits: !1, initial: null }, "--tw-ease": { inherits: !1, initial: null }, "--tw-content": { inherits: !1, initial: '""' } }, rules: [[":root, :host", null, 2, [["--spacing", ".25rem"], ["--text-xs", ".75rem"], ["--text-xs--line-height", "calc(1 / .75)"], ["--text-sm", ".875rem"], ["--text-sm--line-height", "calc(1.25 / .875)"], ["--font-weight-normal", "400"], ["--font-weight-medium", "500"], ["--font-weight-semibold", "600"], ["--font-weight-bold", "700"], ["--tracking-normal", "0em"], ["--tracking-wide", ".025em"], ["--leading-tight", "1.25"], ["--leading-relaxed", "1.625"], ["--ease-out", "cubic-bezier(0, 0, .2, 1)"], ["--animate-pulse", "pulse 2s cubic-bezier(.4, 0, .6, 1) infinite"], ["--blur-xl", "24px"], ["--default-transition-duration", ".15s"], ["--default-transition-timing-function", "cubic-bezier(.4, 0, .2, 1)"], ["--animate-toast-in", "toast-in .2s cubic-bezier(.22, 1, .36, 1)"], ["--animate-host-pulse", "host-connecting-pulse 1.4s ease-in-out infinite"], ["--animate-drop-zone", "drop-zone-in .14s ease-out, drop-zone-pulse 1.2s ease-in-out .14s infinite"]]], ["::selection", null, 3, [["background", "var(--accent)"], ["color", "var(--panel-bg)"]]], [":where(input, textarea)::placeholder", null, 3, [["color", "var(--subtext-0)"], ["opacity", "1"]]], [":where(button, input, select, textarea)", null, 3, [["border", "0"]]], [':where(button, a[href], select, summary, [role="button"], [role="menuitem"]):focus-visible', null, 3, [["outline", "2px solid var(--accent)"], ["outline-offset", "-2px"]]], ["::-webkit-scrollbar", null, 3, [["width", "var(--scrollbar-size)"], ["height", "var(--scrollbar-size)"]]], ["::-webkit-scrollbar-track", null, 3, [["background", "none"]]], ["::-webkit-scrollbar-corner", null, 3, [["background", "none"]]], ["::-webkit-scrollbar-thumb", null, 3, [["background", "var(--text)"]]], ["::-webkit-scrollbar-thumb", null, 3, [["background", "color-mix(in srgb, var(--text) 20%, transparent)"]]], ["::-webkit-scrollbar-thumb", null, 3, [["border-radius", "var(--scrollbar-size)"]]], ["::-webkit-scrollbar-thumb:hover", null, 3, [["background", "var(--text)"]]], ["::-webkit-scrollbar-thumb:hover", null, 3, [["background", "color-mix(in srgb, var(--text) 40%, transparent)"]]], [".xterm .xterm-scrollable-element > .xterm-scrollbar > .xterm-slider", null, 3, [["border-radius", "var(--scrollbar-size)"]]], [".\\@container, .\\[container-type\\:inline-size\\]", null, 4, [["container-type", "inline-size"]]], [".pointer-events-auto", null, 4, [["pointer-events", "auto"]]], [".pointer-events-none", null, 4, [["pointer-events", "none"]]], [".collapse", null, 4, [["visibility", "collapse"]]], [".invisible", null, 4, [["visibility", "hidden"]]], [".visible", null, 4, [["visibility", "visible"]]], [".sr-only", null, 4, [["clip-path", "inset(50%)"], ["white-space", "nowrap"], ["border-width", "0"], ["width", "1px"], ["height", "1px"], ["margin", "-1px"], ["padding", "0"], ["position", "absolute"], ["overflow", "hidden"]]], [".absolute", null, 4, [["position", "absolute"]]], [".fixed", null, 4, [["position", "fixed"]]], [".relative", null, 4, [["position", "relative"]]], [".static", null, 4, [["position", "static"]]], [".sticky", null, 4, [["position", "sticky"]]], [".inset-0", null, 4, [["inset", "0"]]], [".inset-x-0", null, 4, [["inset-inline", "0"]]], [".inset-x-2", null, 4, [["inset-inline", "calc(var(--spacing) * 2)"]]], [".-top-1", null, 4, [["top", "calc(var(--spacing) * -1)"]]], [".-top-1\\.5", null, 4, [["top", "calc(var(--spacing) * -1.5)"]]], [".top-0", null, 4, [["top", "0"]]], [".top-1", null, 4, [["top", "var(--spacing)"]]], [".top-1\\.5", null, 4, [["top", "calc(var(--spacing) * 1.5)"]]], [".top-1\\/2", null, 4, [["top", "50%"]]], [".top-2", null, 4, [["top", "calc(var(--spacing) * 2)"]]], [".top-4", null, 4, [["top", "calc(var(--spacing) * 4)"]]], [".top-\\[0\\.1rem\\]", null, 4, [["top", ".1rem"]]], [".top-\\[7px\\]", null, 4, [["top", "7px"]]], [".top-\\[max\\(0\\.75rem\\,env\\(safe-area-inset-top\\)\\)\\]", null, 4, [["top", "max(.75rem, env(safe-area-inset-top))"]]], [".top-full", null, 4, [["top", "100%"]]], [".top-px", null, 4, [["top", "1px"]]], [".-right-1", null, 4, [["right", "calc(var(--spacing) * -1)"]]], [".-right-1\\.5", null, 4, [["right", "calc(var(--spacing) * -1.5)"]]], [".right-0", null, 4, [["right", "0"]]], [".right-1", null, 4, [["right", "var(--spacing)"]]], [".right-3", null, 4, [["right", "calc(var(--spacing) * 3)"]]], [".right-4", null, 4, [["right", "calc(var(--spacing) * 4)"]]], [".right-\\[0\\.8rem\\]", null, 4, [["right", ".8rem"]]], [".right-\\[0\\.25rem\\]", null, 4, [["right", ".25rem"]]], [".right-\\[max\\(0\\.75rem\\,env\\(safe-area-inset-right\\)\\)\\]", null, 4, [["right", "max(.75rem, env(safe-area-inset-right))"]]], [".bottom-0", null, 4, [["bottom", "0"]]], [".bottom-2", null, 4, [["bottom", "calc(var(--spacing) * 2)"]]], [".bottom-3", null, 4, [["bottom", "calc(var(--spacing) * 3)"]]], [".bottom-\\[0\\.8rem\\]", null, 4, [["bottom", ".8rem"]]], [".bottom-full", null, 4, [["bottom", "100%"]]], [".-left-8", null, 4, [["left", "calc(var(--spacing) * -8)"]]], [".-left-\\[2px\\]", null, 4, [["left", "-2px"]]], [".left-0", null, 4, [["left", "0"]]], [".left-2", null, 4, [["left", "calc(var(--spacing) * 2)"]]], [".left-\\[0\\.1rem\\]", null, 4, [["left", ".1rem"]]], [".left-\\[max\\(0\\.75rem\\,env\\(safe-area-inset-left\\)\\)\\]", null, 4, [["left", "max(.75rem, env(safe-area-inset-left))"]]], [".left-px", null, 4, [["left", "1px"]]], [".isolate", null, 4, [["isolation", "isolate"]]], [".z-4", null, 4, [["z-index", "4"]]], [".z-5", null, 4, [["z-index", "5"]]], [".z-10", null, 4, [["z-index", "10"]]], [".z-20", null, 4, [["z-index", "20"]]], [".z-30", null, 4, [["z-index", "30"]]], [".z-40", null, 4, [["z-index", "40"]]], [".z-50", null, 4, [["z-index", "50"]]], [".z-\\[2\\]", null, 4, [["z-index", "2"]]], [".z-\\[3\\]", null, 4, [["z-index", "3"]]], [".z-\\[5\\]", null, 4, [["z-index", "5"]]], [".z-\\[1000\\]", null, 4, [["z-index", "1000"]]], [".z-\\[2000\\]", null, 4, [["z-index", "2000"]]], [".z-\\[2100\\]", null, 4, [["z-index", "2100"]]], [".z-\\[2200\\]", null, 4, [["z-index", "2200"]]], [".z-\\[3000\\]", null, 4, [["z-index", "3000"]]], [".z-\\[3100\\]", null, 4, [["z-index", "3100"]]], [".z-\\[4000\\]", null, 4, [["z-index", "4000"]]], [".z-\\[9998\\]", null, 4, [["z-index", "9998"]]], [".z-\\[9999\\]", null, 4, [["z-index", "9999"]]], [".z-\\[10000\\]", null, 4, [["z-index", "10000"]]], [".z-auto", null, 4, [["z-index", "auto"]]], [".order-last", null, 4, [["order", "9999"]]], [".col-\\[1\\/-1\\]", null, 4, [["grid-column", "1 / -1"]]], [".container", null, 4, [["width", "100%"]]], [".container", ["(min-width: 40rem)"], 4, [["max-width", "40rem"]]], [".container", ["(min-width: 48rem)"], 4, [["max-width", "48rem"]]], [".container", ["(min-width: 64rem)"], 4, [["max-width", "64rem"]]], [".container", ["(min-width: 80rem)"], 4, [["max-width", "80rem"]]], [".container", ["(min-width: 96rem)"], 4, [["max-width", "96rem"]]], [".m-0", null, 4, [["margin", "0"]]], [".m-2", null, 4, [["margin", "calc(var(--spacing) * 2)"]]], [".m-\\[0\\.7rem\\]", null, 4, [["margin", ".7rem"]]], [".m-auto", null, 4, [["margin", "auto"]]], [".mx-0", null, 4, [["margin-inline", "0"]]], [".mx-0\\.5", null, 4, [["margin-inline", "calc(var(--spacing) * .5)"]]], [".mx-2", null, 4, [["margin-inline", "calc(var(--spacing) * 2)"]]], [".mx-3", null, 4, [["margin-inline", "calc(var(--spacing) * 3)"]]], [".mx-4", null, 4, [["margin-inline", "calc(var(--spacing) * 4)"]]], [".mx-\\[0\\.3rem\\]", null, 4, [["margin-inline", ".3rem"]]], [".mx-\\[0\\.7rem\\]", null, 4, [["margin-inline", ".7rem"]]], [".mx-\\[0\\.65rem\\]", null, 4, [["margin-inline", ".65rem"]]], [".mx-\\[3px\\]", null, 4, [["margin-inline", "3px"]]], [".mx-\\[11px\\]", null, 4, [["margin-inline", "11px"]]], [".mx-auto", null, 4, [["margin-inline", "auto"]]], [".my-0\\.5", null, 4, [["margin-block", "calc(var(--spacing) * .5)"]]], [".my-1", null, 4, [["margin-block", "var(--spacing)"]]], [".my-2", null, 4, [["margin-block", "calc(var(--spacing) * 2)"]]], [".my-\\[0\\.2rem\\]", null, 4, [["margin-block", ".2rem"]]], [".my-\\[0\\.3rem\\]", null, 4, [["margin-block", ".3rem"]]], [".my-\\[0\\.6rem\\]", null, 4, [["margin-block", ".6rem"]]], [".my-\\[0\\.28rem\\]", null, 4, [["margin-block", ".28rem"]]], [".my-\\[0\\.45rem\\]", null, 4, [["margin-block", ".45rem"]]], [".my-\\[0\\.55rem\\]", null, 4, [["margin-block", ".55rem"]]], [".my-\\[3px\\]", null, 4, [["margin-block", "3px"]]], [".-mt-\\[2px\\]", null, 4, [["margin-top", "-2px"]]], [".mt-0", null, 4, [["margin-top", "0"]]], [".mt-0\\.5", null, 4, [["margin-top", "calc(var(--spacing) * .5)"]]], [".mt-1", null, 4, [["margin-top", "var(--spacing)"]]], [".mt-1\\.5", null, 4, [["margin-top", "calc(var(--spacing) * 1.5)"]]], [".mt-2", null, 4, [["margin-top", "calc(var(--spacing) * 2)"]]], [".mt-3", null, 4, [["margin-top", "calc(var(--spacing) * 3)"]]], [".mt-4", null, 4, [["margin-top", "calc(var(--spacing) * 4)"]]], [".mt-\\[0\\.1rem\\]", null, 4, [["margin-top", ".1rem"]]], [".mt-\\[0\\.2rem\\]", null, 4, [["margin-top", ".2rem"]]], [".mt-\\[0\\.3rem\\]", null, 4, [["margin-top", ".3rem"]]], [".mt-\\[0\\.4rem\\]", null, 4, [["margin-top", ".4rem"]]], [".mt-\\[0\\.5rem\\]", null, 4, [["margin-top", ".5rem"]]], [".mt-\\[0\\.15rem\\]", null, 4, [["margin-top", ".15rem"]]], [".mt-\\[0\\.35rem\\]", null, 4, [["margin-top", ".35rem"]]], [".mr-1", null, 4, [["margin-right", "var(--spacing)"]]], [".mr-1\\.5", null, 4, [["margin-right", "calc(var(--spacing) * 1.5)"]]], [".mr-\\[0\\.3rem\\]", null, 4, [["margin-right", ".3rem"]]], [".mr-\\[0\\.7rem\\]", null, 4, [["margin-right", ".7rem"]]], [".mr-auto", null, 4, [["margin-right", "auto"]]], [".mb-0", null, 4, [["margin-bottom", "0"]]], [".mb-0\\.5", null, 4, [["margin-bottom", "calc(var(--spacing) * .5)"]]], [".mb-1", null, 4, [["margin-bottom", "var(--spacing)"]]], [".mb-2", null, 4, [["margin-bottom", "calc(var(--spacing) * 2)"]]], [".mb-3", null, 4, [["margin-bottom", "calc(var(--spacing) * 3)"]]], [".mb-4", null, 4, [["margin-bottom", "calc(var(--spacing) * 4)"]]], [".mb-8", null, 4, [["margin-bottom", "calc(var(--spacing) * 8)"]]], [".mb-\\[0\\.2rem\\]", null, 4, [["margin-bottom", ".2rem"]]], [".mb-\\[0\\.3rem\\]", null, 4, [["margin-bottom", ".3rem"]]], [".mb-\\[0\\.4rem\\]", null, 4, [["margin-bottom", ".4rem"]]], [".mb-\\[0\\.6rem\\]", null, 4, [["margin-bottom", ".6rem"]]], [".mb-\\[0\\.7rem\\]", null, 4, [["margin-bottom", ".7rem"]]], [".mb-\\[0\\.9rem\\]", null, 4, [["margin-bottom", ".9rem"]]], [".mb-\\[0\\.15rem\\]", null, 4, [["margin-bottom", ".15rem"]]], [".mb-\\[0\\.35rem\\]", null, 4, [["margin-bottom", ".35rem"]]], [".mb-\\[0\\.55rem\\]", null, 4, [["margin-bottom", ".55rem"]]], [".mb-\\[1\\.1rem\\]", null, 4, [["margin-bottom", "1.1rem"]]], [".-ml-0\\.5", null, 4, [["margin-left", "calc(var(--spacing) * -.5)"]]], [".-ml-1", null, 4, [["margin-left", "calc(var(--spacing) * -1)"]]], [".-ml-2", null, 4, [["margin-left", "calc(var(--spacing) * -2)"]]], [".ml-1", null, 4, [["margin-left", "var(--spacing)"]]], [".ml-2", null, 4, [["margin-left", "calc(var(--spacing) * 2)"]]], [".ml-\\[0\\.4rem\\]", null, 4, [["margin-left", ".4rem"]]], [".ml-\\[0\\.5rem\\]", null, 4, [["margin-left", ".5rem"]]], [".ml-\\[0\\.9rem\\]", null, 4, [["margin-left", ".9rem"]]], [".ml-\\[0\\.35rem\\]", null, 4, [["margin-left", ".35rem"]]], [".ml-\\[0\\.55rem\\]", null, 4, [["margin-left", ".55rem"]]], [".ml-\\[1\\.15rem\\]", null, 4, [["margin-left", "1.15rem"]]], [".ml-\\[1\\.45rem\\]", null, 4, [["margin-left", "1.45rem"]]], [".ml-\\[2\\.025rem\\]", null, 4, [["margin-left", "2.025rem"]]], [".ml-\\[2\\.375rem\\]", null, 4, [["margin-left", "2.375rem"]]], [".ml-\\[6\\.1rem\\]", null, 4, [["margin-left", "6.1rem"]]], [".ml-auto", null, 4, [["margin-left", "auto"]]], [".box-border", null, 4, [["box-sizing", "border-box"]]], [".\\!hidden", null, 4, [["display", "none", 1]]], [".\\[display\\:-webkit-box\\]", null, 4, [["display", "-webkit-box"]]], [".\\[display\\:var\\(--pane-grip\\,flex\\)\\]", null, 4, [["display", "var(--pane-grip, flex)"]]], [".block", null, 4, [["display", "block"]]], [".contents", null, 4, [["display", "contents"]]], [".flex", null, 4, [["display", "flex"]]], [".grid", null, 4, [["display", "grid"]]], [".hidden", null, 4, [["display", "none"]]], [".inline", null, 4, [["display", "inline"]]], [".inline-block", null, 4, [["display", "inline-block"]]], [".inline-flex", null, 4, [["display", "inline-flex"]]], [".table", null, 4, [["display", "table"]]], [".size-1", null, 4, [["width", "var(--spacing)"], ["height", "var(--spacing)"]]], [".size-1\\.5", null, 4, [["width", "calc(var(--spacing) * 1.5)"], ["height", "calc(var(--spacing) * 1.5)"]]], [".size-2", null, 4, [["width", "calc(var(--spacing) * 2)"], ["height", "calc(var(--spacing) * 2)"]]], [".size-3", null, 4, [["width", "calc(var(--spacing) * 3)"], ["height", "calc(var(--spacing) * 3)"]]], [".size-5", null, 4, [["width", "calc(var(--spacing) * 5)"], ["height", "calc(var(--spacing) * 5)"]]], [".size-6", null, 4, [["width", "calc(var(--spacing) * 6)"], ["height", "calc(var(--spacing) * 6)"]]], [".size-7", null, 4, [["width", "calc(var(--spacing) * 7)"], ["height", "calc(var(--spacing) * 7)"]]], [".size-8", null, 4, [["width", "calc(var(--spacing) * 8)"], ["height", "calc(var(--spacing) * 8)"]]], [".size-11", null, 4, [["width", "calc(var(--spacing) * 11)"], ["height", "calc(var(--spacing) * 11)"]]], [".size-14", null, 4, [["width", "calc(var(--spacing) * 14)"], ["height", "calc(var(--spacing) * 14)"]]], [".size-\\[0\\.6rem\\]", null, 4, [["width", ".6rem"], ["height", ".6rem"]]], [".size-\\[1\\.2rem\\]", null, 4, [["width", "1.2rem"], ["height", "1.2rem"]]], [".size-\\[5px\\]", null, 4, [["width", "5px"], ["height", "5px"]]], [".size-\\[14px\\]", null, 4, [["width", "14px"], ["height", "14px"]]], [".size-\\[calc\\(14px\\*var\\(--zoom\\,1\\)\\)\\]", null, 4, [["width", "calc(14px * var(--zoom, 1))"], ["height", "calc(14px * var(--zoom, 1))"]]], [".size-full", null, 4, [["width", "100%"], ["height", "100%"]]], [".h-1", null, 4, [["height", "var(--spacing)"]]], [".h-1\\.5", null, 4, [["height", "calc(var(--spacing) * 1.5)"]]], [".h-2", null, 4, [["height", "calc(var(--spacing) * 2)"]]], [".h-3", null, 4, [["height", "calc(var(--spacing) * 3)"]]], [".h-4", null, 4, [["height", "calc(var(--spacing) * 4)"]]], [".h-5", null, 4, [["height", "calc(var(--spacing) * 5)"]]], [".h-6", null, 4, [["height", "calc(var(--spacing) * 6)"]]], [".h-7", null, 4, [["height", "calc(var(--spacing) * 7)"]]], [".h-8", null, 4, [["height", "calc(var(--spacing) * 8)"]]], [".h-9", null, 4, [["height", "calc(var(--spacing) * 9)"]]], [".h-11", null, 4, [["height", "calc(var(--spacing) * 11)"]]], [".h-12", null, 4, [["height", "calc(var(--spacing) * 12)"]]], [".h-44", null, 4, [["height", "calc(var(--spacing) * 44)"]]], [".h-\\[1\\.1rem\\]", null, 4, [["height", "1.1rem"]]], [".h-\\[1\\.3rem\\]", null, 4, [["height", "1.3rem"]]], [".h-\\[1\\.4rem\\]", null, 4, [["height", "1.4rem"]]], [".h-\\[1\\.25rem\\]", null, 4, [["height", "1.25rem"]]], [".h-\\[2px\\]", null, 4, [["height", "2px"]]], [".h-\\[14px\\]", null, 4, [["height", "14px"]]], [".h-\\[18px\\]", null, 4, [["height", "18px"]]], [".h-\\[43px\\]", null, 4, [["height", "43px"]]], [".h-\\[calc\\(100\\%-max\\(0\\.5rem\\,env\\(safe-area-inset-top\\)\\)\\)\\]", null, 4, [["height", "calc(100% - max(.5rem, env(safe-area-inset-top)))"]]], [".h-full", null, 4, [["height", "100%"]]], [".h-px", null, 4, [["height", "1px"]]], [".max-h-40", null, 4, [["max-height", "calc(var(--spacing) * 40)"]]], [".max-h-56", null, 4, [["max-height", "calc(var(--spacing) * 56)"]]], [".max-h-72", null, 4, [["max-height", "calc(var(--spacing) * 72)"]]], [".max-h-\\[8rem\\]", null, 4, [["max-height", "8rem"]]], [".max-h-\\[13rem\\]", null, 4, [["max-height", "13rem"]]], [".max-h-\\[30\\%\\]", null, 4, [["max-height", "30%"]]], [".max-h-\\[30vh\\]", null, 4, [["max-height", "30vh"]]], [".max-h-\\[35vh\\]", null, 4, [["max-height", "35vh"]]], [".max-h-\\[40\\%\\]", null, 4, [["max-height", "40%"]]], [".max-h-\\[50dvh\\]", null, 4, [["max-height", "50dvh"]]], [".max-h-\\[60\\%\\]", null, 4, [["max-height", "60%"]]], [".max-h-\\[70\\%\\]", null, 4, [["max-height", "70%"]]], [".max-h-\\[85vh\\]", null, 4, [["max-height", "85vh"]]], [".max-h-\\[90\\%\\]", null, 4, [["max-height", "90%"]]], [".max-h-\\[190px\\]", null, 4, [["max-height", "190px"]]], [".max-h-\\[240px\\]", null, 4, [["max-height", "240px"]]], [".max-h-\\[260px\\]", null, 4, [["max-height", "260px"]]], [".max-h-\\[calc\\(85vh-4rem\\)\\]", null, 4, [["max-height", "calc(85vh - 4rem)"]]], [".max-h-\\[calc\\(100dvh_-_4rem\\)\\]", null, 4, [["max-height", "calc(100dvh - 4rem)"]]], [".max-h-\\[min\\(420px\\,calc\\(100dvh_-_16vh_-_2rem\\)\\)\\]", null, 4, [["max-height", "min(420px, 100dvh - 16vh - 2rem)"]]], [".max-h-\\[min\\(480px\\,calc\\(100dvh_-_16vh_-_2rem\\)\\)\\]", null, 4, [["max-height", "min(480px, 100dvh - 16vh - 2rem)"]]], [".max-h-full", null, 4, [["max-height", "100%"]]], [".min-h-0", null, 4, [["min-height", "0"]]], [".min-h-6", null, 4, [["min-height", "calc(var(--spacing) * 6)"]]], [".min-h-7", null, 4, [["min-height", "calc(var(--spacing) * 7)"]]], [".min-h-8", null, 4, [["min-height", "calc(var(--spacing) * 8)"]]], [".min-h-9", null, 4, [["min-height", "calc(var(--spacing) * 9)"]]], [".min-h-10", null, 4, [["min-height", "calc(var(--spacing) * 10)"]]], [".min-h-11", null, 4, [["min-height", "calc(var(--spacing) * 11)"]]], [".min-h-20", null, 4, [["min-height", "calc(var(--spacing) * 20)"]]], [".min-h-40", null, 4, [["min-height", "calc(var(--spacing) * 40)"]]], [".min-h-\\[1\\.5em\\]", null, 4, [["min-height", "1.5em"]]], [".min-h-\\[1\\.8rem\\]", null, 4, [["min-height", "1.8rem"]]], [".min-h-\\[2\\.5rem\\]", null, 4, [["min-height", "2.5rem"]]], [".min-h-\\[3\\.2rem\\]", null, 4, [["min-height", "3.2rem"]]], [".min-h-\\[3\\.25rem\\]", null, 4, [["min-height", "3.25rem"]]], [".min-h-\\[6rem\\]", null, 4, [["min-height", "6rem"]]], [".min-h-\\[8rem\\]", null, 4, [["min-height", "8rem"]]], [".min-h-\\[10rem\\]", null, 4, [["min-height", "10rem"]]], [".min-h-\\[12rem\\]", null, 4, [["min-height", "12rem"]]], [".min-h-\\[13rem\\]", null, 4, [["min-height", "13rem"]]], [".min-h-\\[32px\\]", null, 4, [["min-height", "32px"]]], [".min-h-\\[44px\\]", null, 4, [["min-height", "44px"]]], [".min-h-\\[60px\\]", null, 4, [["min-height", "60px"]]], [".min-h-\\[100dvh\\]", null, 4, [["min-height", "100dvh"]]], [".min-h-\\[calc\\(22px\\*var\\(--zoom\\,1\\)\\)\\]", null, 4, [["min-height", "calc(22px * var(--zoom, 1))"]]], [".min-h-full", null, 4, [["min-height", "100%"]]], [".w-2", null, 4, [["width", "calc(var(--spacing) * 2)"]]], [".w-2\\.5", null, 4, [["width", "calc(var(--spacing) * 2.5)"]]], [".w-3", null, 4, [["width", "calc(var(--spacing) * 3)"]]], [".w-4", null, 4, [["width", "calc(var(--spacing) * 4)"]]], [".w-5", null, 4, [["width", "calc(var(--spacing) * 5)"]]], [".w-7", null, 4, [["width", "calc(var(--spacing) * 7)"]]], [".w-8", null, 4, [["width", "calc(var(--spacing) * 8)"]]], [".w-9", null, 4, [["width", "calc(var(--spacing) * 9)"]]], [".w-10", null, 4, [["width", "calc(var(--spacing) * 10)"]]], [".w-20", null, 4, [["width", "calc(var(--spacing) * 20)"]]], [".w-40", null, 4, [["width", "calc(var(--spacing) * 40)"]]], [".w-44", null, 4, [["width", "calc(var(--spacing) * 44)"]]], [".w-\\[1\\.1rem\\]", null, 4, [["width", "1.1rem"]]], [".w-\\[1\\.4rem\\]", null, 4, [["width", "1.4rem"]]], [".w-\\[1\\.6rem\\]", null, 4, [["width", "1.6rem"]]], [".w-\\[1\\.25rem\\]", null, 4, [["width", "1.25rem"]]], [".w-\\[2\\.4rem\\]", null, 4, [["width", "2.4rem"]]], [".w-\\[2\\.25rem\\]", null, 4, [["width", "2.25rem"]]], [".w-\\[6rem\\]", null, 4, [["width", "6rem"]]], [".w-\\[7rem\\]", null, 4, [["width", "7rem"]]], [".w-\\[11rem\\]", null, 4, [["width", "11rem"]]], [".w-\\[15rem\\]", null, 4, [["width", "15rem"]]], [".w-\\[16rem\\]", null, 4, [["width", "16rem"]]], [".w-\\[18px\\]", null, 4, [["width", "18px"]]], [".w-\\[100cqi\\]", null, 4, [["width", "100cqi"]]], [".w-\\[calc\\(\\(100\\%-0\\.875rem\\)\\/8\\)\\]", null, 4, [["width", "calc(12.5% - .109375rem)"]]], [".w-\\[calc\\(100\\%_-_0\\.6rem\\)\\]", null, 4, [["width", "calc(100% - .6rem)"]]], [".w-\\[calc\\(100\\%_-_1rem\\)\\]", null, 4, [["width", "calc(100% - 1rem)"]]], [".w-\\[min\\(22rem\\,calc\\(100vw-3rem\\)\\)\\]", null, 4, [["width", "min(22rem, 100vw - 3rem)"]]], [".w-\\[min\\(26rem\\,100\\%\\)\\]", null, 4, [["width", "min(26rem, 100%)"]]], [".w-\\[min\\(28rem\\,calc\\(100vw-2\\.5rem\\)\\)\\]", null, 4, [["width", "min(28rem, 100vw - 2.5rem)"]]], [".w-\\[min\\(30rem\\,92vw\\)\\]", null, 4, [["width", "min(30rem, 92vw)"]]], [".w-\\[min\\(32rem\\,100\\%\\)\\]", null, 4, [["width", "min(32rem, 100%)"]]], [".w-\\[min\\(340px\\,calc\\(100vw-16px\\)\\)\\]", null, 4, [["width", "min(340px, 100vw - 16px)"]]], [".w-\\[min\\(360px\\,calc\\(100vw_-_2rem\\)\\)\\]", null, 4, [["width", "min(360px, 100vw - 2rem)"]]], [".w-\\[min\\(420px\\,calc\\(100vw_-_16px\\)\\)\\]", null, 4, [["width", "min(420px, 100vw - 16px)"]]], [".w-\\[min\\(480px\\,calc\\(100vw_-_2rem\\)\\)\\]", null, 4, [["width", "min(480px, 100vw - 2rem)"]]], [".w-\\[min\\(560px\\,calc\\(100vw_-_2rem\\)\\)\\]", null, 4, [["width", "min(560px, 100vw - 2rem)"]]], [".w-\\[var\\(--sidebar-width\\,240px\\)\\]", null, 4, [["width", "var(--sidebar-width, 240px)"]]], [".w-\\[var\\(--tools-width\\)\\]", null, 4, [["width", "var(--tools-width)"]]], [".w-auto", null, 4, [["width", "auto"]]], [".w-full", null, 4, [["width", "100%"]]], [".w-px", null, 4, [["width", "1px"]]], [".max-w-24", null, 4, [["max-width", "calc(var(--spacing) * 24)"]]], [".max-w-32", null, 4, [["max-width", "calc(var(--spacing) * 32)"]]], [".max-w-\\[9rem\\]", null, 4, [["max-width", "9rem"]]], [".max-w-\\[10rem\\]", null, 4, [["max-width", "10rem"]]], [".max-w-\\[14rem\\]", null, 4, [["max-width", "14rem"]]], [".max-w-\\[16rem\\]", null, 4, [["max-width", "16rem"]]], [".max-w-\\[24rem\\]", null, 4, [["max-width", "24rem"]]], [".max-w-\\[25\\%\\]", null, 4, [["max-width", "25%"]]], [".max-w-\\[26rem\\]", null, 4, [["max-width", "26rem"]]], [".max-w-\\[28rem\\]", null, 4, [["max-width", "28rem"]]], [".max-w-\\[35\\%\\]", null, 4, [["max-width", "35%"]]], [".max-w-\\[38\\%\\]", null, 4, [["max-width", "38%"]]], [".max-w-\\[45\\%\\]", null, 4, [["max-width", "45%"]]], [".max-w-\\[46rem\\]", null, 4, [["max-width", "46rem"]]], [".max-w-\\[55\\%\\]", null, 4, [["max-width", "55%"]]], [".max-w-\\[56rem\\]", null, 4, [["max-width", "56rem"]]], [".max-w-\\[85\\%\\]", null, 4, [["max-width", "85%"]]], [".max-w-\\[140px\\]", null, 4, [["max-width", "140px"]]], [".max-w-\\[320px\\]", null, 4, [["max-width", "320px"]]], [".max-w-\\[min\\(22rem\\,calc\\(100\\%-1\\.5rem\\)\\)\\]", null, 4, [["max-width", "min(22rem, 100% - 1.5rem)"]]], [".max-w-\\[min\\(30rem\\,calc\\(100\\%-1\\.6rem\\)\\)\\]", null, 4, [["max-width", "min(30rem, 100% - 1.6rem)"]]], [".max-w-\\[min\\(34rem\\,calc\\(100\\%-1\\.5rem\\)\\)\\]", null, 4, [["max-width", "min(34rem, 100% - 1.5rem)"]]], [".max-w-\\[min\\(320px\\,calc\\(100vw_-_24px\\)\\)\\]", null, 4, [["max-width", "min(320px, 100vw - 24px)"]]], [".max-w-full", null, 4, [["max-width", "100%"]]], [".max-w-none", null, 4, [["max-width", "none"]]], [".min-w-0", null, 4, [["min-width", "0"]]], [".min-w-6", null, 4, [["min-width", "calc(var(--spacing) * 6)"]]], [".min-w-8", null, 4, [["min-width", "calc(var(--spacing) * 8)"]]], [".min-w-12", null, 4, [["min-width", "calc(var(--spacing) * 12)"]]], [".min-w-24", null, 4, [["min-width", "calc(var(--spacing) * 24)"]]], [".min-w-36", null, 4, [["min-width", "calc(var(--spacing) * 36)"]]], [".min-w-56", null, 4, [["min-width", "calc(var(--spacing) * 56)"]]], [".min-w-\\[5\\.5rem\\]", null, 4, [["min-width", "5.5rem"]]], [".min-w-\\[7rem\\]", null, 4, [["min-width", "7rem"]]], [".min-w-\\[12rem\\]", null, 4, [["min-width", "12rem"]]], [".min-w-\\[14px\\]", null, 4, [["min-width", "14px"]]], [".min-w-\\[200px\\]", null, 4, [["min-width", "200px"]]], [".min-w-fit", null, 4, [["min-width", "fit-content"]]], [".min-w-max", null, 4, [["min-width", "max-content"]]], [".flex-1", null, 4, [["flex", "1"]]], [".flex-\\[0_0_5rem\\]", null, 4, [["flex", "0 0 5rem"]]], [".flex-\\[0_0_8px\\]", null, 4, [["flex", "0 0 8px"]]], [".flex-\\[0_1_40\\%\\]", null, 4, [["flex", "0 40%"]]], [".flex-\\[1_1_100\\%\\]", null, 4, [["flex", "100%"]]], [".flex-\\[2\\]", null, 4, [["flex", "2"]]], [".flex-initial", null, 4, [["flex", "0 auto"]]], [".flex-none", null, 4, [["flex", "none"]]], [".shrink", null, 4, [["flex-shrink", "1"]]], [".shrink-0", null, 4, [["flex-shrink", "0"]]], [".shrink-\\[0\\.001\\]", null, 4, [["flex-shrink", ".001"]]], [".shrink-\\[2\\]", null, 4, [["flex-shrink", "2"]]], [".shrink-\\[3\\]", null, 4, [["flex-shrink", "3"]]], [".grow", null, 4, [["flex-grow", "1"]]], [".basis-0", null, 4, [["flex-basis", "0"]]], [".basis-\\[14rem\\]", null, 4, [["flex-basis", "14rem"]]], [".-translate-y-1\\/2", null, 4, [["--tw-translate-y", "calc(calc(1 / 2 * 100%) * -1)"], ["translate", "var(--tw-translate-x) var(--tw-translate-y)"]]], [".\\[transform\\:translateY\\(-50\\%\\)\\]", null, 4, [["transform", "translateY(-50%)"]]], [".transform", null, 4, [["transform", "var(--tw-rotate-x, ) var(--tw-rotate-y, ) var(--tw-rotate-z, ) var(--tw-skew-x, ) var(--tw-skew-y, )"]]], [".animate-drop-zone", null, 4, [["animation", "var(--animate-drop-zone)"]]], [".animate-host-pulse", null, 4, [["animation", "var(--animate-host-pulse)"]]], [".animate-pulse", null, 4, [["animation", "var(--animate-pulse)"]]], [".animate-toast-in", null, 4, [["animation", "var(--animate-toast-in)"]]], [".cursor-col-resize", null, 4, [["cursor", "col-resize"]]], [".cursor-default", null, 4, [["cursor", "default"]]], [".cursor-grab", null, 4, [["cursor", "grab"]]], [".cursor-grabbing", null, 4, [["cursor", "grabbing"]]], [".cursor-pointer", null, 4, [["cursor", "pointer"]]], [".cursor-row-resize", null, 4, [["cursor", "row-resize"]]], [".touch-none", null, 4, [["touch-action", "none"]]], [".resize", null, 4, [["resize", "both"]]], [".resize-none", null, 4, [["resize", "none"]]], [".resize-y", null, 4, [["resize", "vertical"]]], [".\\[scrollbar-width\\:none\\]", null, 4, [["scrollbar-width", "none"]]], [".list-disc", null, 4, [["list-style-type", "disc"]]], [".list-none", null, 4, [["list-style-type", "none"]]], [".appearance-none", null, 4, [["appearance", "none"]]], [".grid-cols-8", null, 4, [["grid-template-columns", "repeat(8, minmax(0, 1fr))"]]], [".grid-cols-\\[1fr_auto_1fr\\]", null, 4, [["grid-template-columns", "1fr auto 1fr"]]], [".grid-cols-\\[2\\.5rem_2\\.5rem_0\\.9rem_minmax\\(0\\,1fr\\)\\]", null, 4, [["grid-template-columns", "2.5rem 2.5rem .9rem minmax(0, 1fr)"]]], [".grid-cols-\\[auto_minmax\\(0\\,1fr\\)\\]", null, 4, [["grid-template-columns", "auto minmax(0, 1fr)"]]], [".grid-cols-\\[minmax\\(4rem\\,10rem\\)_1fr_auto\\]", null, 4, [["grid-template-columns", "minmax(4rem, 10rem) 1fr auto"]]], [".grid-cols-\\[repeat\\(2\\,minmax\\(0\\,1fr\\)\\)\\]", null, 4, [["grid-template-columns", "repeat(2, minmax(0, 1fr))"]]], [".grid-cols-\\[repeat\\(auto-fit\\,minmax\\(8rem\\,1fr\\)\\)\\]", null, 4, [["grid-template-columns", "repeat(auto-fit, minmax(8rem, 1fr))"]]], [".flex-col", null, 4, [["flex-direction", "column"]]], [".flex-row", null, 4, [["flex-direction", "row"]]], [".flex-wrap", null, 4, [["flex-wrap", "wrap"]]], [".place-items-center", null, 4, [["place-items", "center"]]], [".content-center", null, 4, [["align-content", "center"]]], [".items-baseline", null, 4, [["align-items", "baseline"]]], [".items-center", null, 4, [["align-items", "center"]]], [".items-end", null, 4, [["align-items", "flex-end"]]], [".items-start", null, 4, [["align-items", "flex-start"]]], [".items-stretch", null, 4, [["align-items", "stretch"]]], [".justify-between", null, 4, [["justify-content", "space-between"]]], [".justify-center", null, 4, [["justify-content", "center"]]], [".justify-end", null, 4, [["justify-content", "flex-end"]]], [".justify-start", null, 4, [["justify-content", "flex-start"]]], [".justify-items-center", null, 4, [["justify-items", "center"]]], [".justify-items-start", null, 4, [["justify-items", "start"]]], [".gap-0", null, 4, [["gap", "0"]]], [".gap-0\\.5", null, 4, [["gap", "calc(var(--spacing) * .5)"]]], [".gap-1", null, 4, [["gap", "var(--spacing)"]]], [".gap-1\\.5", null, 4, [["gap", "calc(var(--spacing) * 1.5)"]]], [".gap-2", null, 4, [["gap", "calc(var(--spacing) * 2)"]]], [".gap-3", null, 4, [["gap", "calc(var(--spacing) * 3)"]]], [".gap-4", null, 4, [["gap", "calc(var(--spacing) * 4)"]]], [".gap-6", null, 4, [["gap", "calc(var(--spacing) * 6)"]]], [".gap-\\[0\\.1rem\\]", null, 4, [["gap", ".1rem"]]], [".gap-\\[0\\.3rem\\]", null, 4, [["gap", ".3rem"]]], [".gap-\\[0\\.4rem\\]", null, 4, [["gap", ".4rem"]]], [".gap-\\[0\\.05rem\\]", null, 4, [["gap", ".05rem"]]], [".gap-\\[0\\.6rem\\]", null, 4, [["gap", ".6rem"]]], [".gap-\\[0\\.8rem\\]", null, 4, [["gap", ".8rem"]]], [".gap-\\[0\\.16rem\\]", null, 4, [["gap", ".16rem"]]], [".gap-\\[0\\.32rem\\]", null, 4, [["gap", ".32rem"]]], [".gap-\\[0\\.35rem\\]", null, 4, [["gap", ".35rem"]]], [".gap-\\[0\\.45rem\\]", null, 4, [["gap", ".45rem"]]], [".gap-\\[0\\.55rem\\]", null, 4, [["gap", ".55rem"]]], [".gap-\\[0\\.65rem\\]", null, 4, [["gap", ".65rem"]]], [".gap-\\[0\\.85rem\\]", null, 4, [["gap", ".85rem"]]], [".gap-\\[1px\\]", null, 4, [["gap", "1px"]]], [".gap-\\[2px\\]", null, 4, [["gap", "2px"]]], [".gap-\\[3px\\]", null, 4, [["gap", "3px"]]], [".gap-\\[7px\\]", null, 4, [["gap", "7px"]]], [".gap-\\[13px\\]", null, 4, [["gap", "13px"]]], [":where(.space-y-0\\.5 > :not(:last-child))", null, 4, [["--tw-space-y-reverse", "0"], ["margin-block-start", "calc(calc(var(--spacing) * .5) * var(--tw-space-y-reverse))"], ["margin-block-end", "calc(calc(var(--spacing) * .5) * calc(1 - var(--tw-space-y-reverse)))"]]], [".gap-x-3", null, 4, [["column-gap", "calc(var(--spacing) * 3)"]]], [".gap-x-4", null, 4, [["column-gap", "calc(var(--spacing) * 4)"]]], [".gap-x-\\[0\\.7rem\\]", null, 4, [["column-gap", ".7rem"]]], [".gap-x-\\[0\\.9rem\\]", null, 4, [["column-gap", ".9rem"]]], [".gap-y-1", null, 4, [["row-gap", "var(--spacing)"]]], [".gap-y-\\[0\\.3rem\\]", null, 4, [["row-gap", ".3rem"]]], [".self-center", null, 4, [["align-self", "center"]]], [".self-end", null, 4, [["align-self", "flex-end"]]], [".self-start", null, 4, [["align-self", "flex-start"]]], [".self-stretch", null, 4, [["align-self", "stretch"]]], [".justify-self-start", null, 4, [["justify-self", "flex-start"]]], [".truncate", null, 4, [["text-overflow", "ellipsis"], ["white-space", "nowrap"], ["overflow", "hidden"]]], [".overflow-auto", null, 4, [["overflow", "auto"]]], [".overflow-hidden", null, 4, [["overflow", "hidden"]]], [".overflow-visible", null, 4, [["overflow", "visible"]]], [".overflow-x-auto", null, 4, [["overflow-x", "auto"]]], [".overflow-y-auto", null, 4, [["overflow-y", "auto"]]], [".overscroll-contain", null, 4, [["overscroll-behavior", "contain"]]], [".rounded, .rounded-\\[0\\.25rem\\]", null, 4, [["border-radius", ".25rem"]]], [".rounded-\\[1\\.5rem\\]", null, 4, [["border-radius", "1.5rem"]]], [".rounded-\\[2px\\]", null, 4, [["border-radius", "2px"]]], [".rounded-\\[3px\\]", null, 4, [["border-radius", "3px"]]], [".rounded-\\[12px\\]", null, 4, [["border-radius", "12px"]]], [".rounded-\\[50\\%\\]", null, 4, [["border-radius", "50%"]]], [".rounded-\\[999px\\]", null, 4, [["border-radius", "999px"]]], [".rounded-\\[calc\\(var\\(--radius\\)\\*2\\)\\]", null, 4, [["border-radius", "calc(var(--radius) * 2)"]]], [".rounded-\\[var\\(--card-radius\\,8px\\)\\]", null, 4, [["border-radius", "var(--card-radius, 8px)"]]], [".rounded-\\[var\\(--card-radius\\,12px\\)\\]", null, 4, [["border-radius", "var(--card-radius, 12px)"]]], [".rounded-full", null, 4, [["border-radius", "3.40282e38px"]]], [".rounded-none", null, 4, [["border-radius", "0"]]], [".rounded-soft", null, 4, [["border-radius", "var(--radius-pane)"]]], [".rounded-ui", null, 4, [["border-radius", "var(--radius)"]]], [".rounded-t-\\[12px\\]", null, 4, [["border-top-left-radius", "12px"], ["border-top-right-radius", "12px"]]], [".rounded-t-none", null, 4, [["border-top-left-radius", "0"], ["border-top-right-radius", "0"]]], [".rounded-bl-\\[6px\\]", null, 4, [["border-bottom-left-radius", "6px"]]], [".border", null, 4, [["border-style", "var(--tw-border-style)"], ["border-width", "1px"]]], [".border-0", null, 4, [["border-style", "var(--tw-border-style)"], ["border-width", "0"]]], [".border-\\[1\\.5px\\]", null, 4, [["border-style", "var(--tw-border-style)"], ["border-width", "1.5px"]]], [".border-b", null, 4, [["border-bottom-style", "var(--tw-border-style)"], ["border-bottom-width", "1px"]]], [".border-l", null, 4, [["border-left-style", "var(--tw-border-style)"], ["border-left-width", "1px"]]], [".border-l-\\[3px\\]", null, 4, [["border-left-style", "var(--tw-border-style)"], ["border-left-width", "3px"]]], [".border-solid", null, 4, [["--tw-border-style", "solid"], ["border-style", "solid"]]], [".border-accent", null, 4, [["border-color", "var(--accent)"]]], [".border-overlay-0", null, 4, [["border-color", "var(--overlay-0)"]]], [".border-overlay-1", null, 4, [["border-color", "var(--overlay-1)"]]], [".border-red", null, 4, [["border-color", "var(--red)"]]], [".border-subtext-0", null, 4, [["border-color", "var(--subtext-0)"]]], [".border-surface-1", null, 4, [["border-color", "var(--surface-1)"]]], [".border-teal", null, 4, [["border-color", "var(--teal)"]]], [".border-yellow", null, 4, [["border-color", "var(--yellow)"]]], [".border-l-accent", null, 4, [["border-left-color", "var(--accent)"]]], [".border-l-green", null, 4, [["border-left-color", "var(--green)"]]], [".border-l-red", null, 4, [["border-left-color", "var(--red)"]]], [".border-l-yellow", null, 4, [["border-left-color", "var(--yellow)"]]], [".bg-\\[\\#161616\\]", null, 4, [["background-color", "#161616"]]], [".bg-\\[\\#fff\\]", null, 4, [["background-color", "#fff"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_8\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "var(--accent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_8\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--accent) 8%,var(--panel-bg))"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_12\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--accent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_12\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--accent) 12%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--accent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--accent) 15%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--blue\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--blue)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--blue\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--blue) 15%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--green\\)_9\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--green)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--green\\)_9\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--green) 9%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--red\\)_7\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--red)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--red\\)_7\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--red) 7%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--red\\)_9\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--red)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--red\\)_9\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--red) 9%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--surface-1\\)_42\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--surface-1\\)_42\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--surface-1) 42%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--surface-1\\)_70\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--surface-1\\)_70\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--surface-1) 70%,var(--panel-bg))"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--text\\)_10\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "var(--text)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--text\\)_10\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--text) 10%,var(--panel-bg))"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--yellow\\)_8\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--yellow)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--yellow\\)_8\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--yellow) 8%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--yellow\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--yellow)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--yellow\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--yellow) 15%,transparent)"]]], [".bg-\\[rgba\\(0\\,0\\,0\\,0\\.5\\)\\]", null, 4, [["background-color", "#00000080"]]], [".bg-\\[rgba\\(0\\,0\\,0\\,0\\.7\\)\\]", null, 4, [["background-color", "#000000b3"]]], [".bg-\\[rgba\\(0\\,0\\,0\\,0\\.55\\)\\]", null, 4, [["background-color", "#0000008c"]]], [".bg-\\[rgba\\(0\\,0\\,0\\,0\\.62\\)\\]", null, 4, [["background-color", "#0000009e"]]], [".bg-\\[var\\(--accent\\)\\]", null, 4, [["background-color", "var(--accent)"]]], [".bg-\\[var\\(--backdrop\\)\\]", null, 4, [["background-color", "var(--backdrop)"]]], [".bg-\\[var\\(--bg\\)\\]", null, 4, [["background-color", "var(--bg)"]]], [".bg-\\[var\\(--card-bg\\)\\]", null, 4, [["background-color", "var(--card-bg)"]]], [".bg-\\[var\\(--picker-bg\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "var(--picker-bg, var(--panel-bg))"]]], [".bg-\\[var\\(--surface-1\\)\\]", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-\\[var\\(--workspace-tools-bg\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "var(--workspace-tools-bg, var(--panel-bg))"]]], [".bg-accent, .bg-accent\\/10", null, 4, [["background-color", "var(--accent)"]]], [".bg-accent\\/10", null, 4, [["background-color", "color-mix(in oklab, var(--accent) 10%, transparent)"]]], [".bg-accent\\/35", null, 4, [["background-color", "var(--accent)"]]], [".bg-accent\\/35", null, 4, [["background-color", "color-mix(in oklab, var(--accent) 35%, transparent)"]]], [".bg-fg", null, 4, [["background-color", "var(--text)"]]], [".bg-green, .bg-green\\/15", null, 4, [["background-color", "var(--green)"]]], [".bg-green\\/15", null, 4, [["background-color", "color-mix(in oklab, var(--green) 15%, transparent)"]]], [".bg-overlay-0", null, 4, [["background-color", "var(--overlay-0)"]]], [".bg-overlay-1", null, 4, [["background-color", "var(--overlay-1)"]]], [".bg-panel-bg", null, 4, [["background-color", "var(--panel-bg)"]]], [".bg-red, .bg-red\\/15", null, 4, [["background-color", "var(--red)"]]], [".bg-red\\/15", null, 4, [["background-color", "color-mix(in oklab, var(--red) 15%, transparent)"]]], [".bg-subtext-0", null, 4, [["background-color", "var(--subtext-0)"]]], [".bg-surface-0", null, 4, [["background-color", "var(--surface-0)"]]], [".bg-surface-1, .bg-surface-1\\/30", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-surface-1\\/30", null, 4, [["background-color", "color-mix(in oklab, var(--surface-1) 30%, transparent)"]]], [".bg-surface-1\\/60", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-surface-1\\/60", null, 4, [["background-color", "color-mix(in oklab, var(--surface-1) 60%, transparent)"]]], [".bg-surface-1\\/70", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-surface-1\\/70", null, 4, [["background-color", "color-mix(in oklab, var(--surface-1) 70%, transparent)"]]], [".bg-transparent", null, 4, [["background-color", "#0000"]]], [".bg-yellow", null, 4, [["background-color", "var(--yellow)"]]], [".object-contain", null, 4, [["object-fit", "contain"]]], [".object-cover", null, 4, [["object-fit", "cover"]]], [".p-0", null, 4, [["padding", "0"]]], [".p-0\\.5", null, 4, [["padding", "calc(var(--spacing) * .5)"]]], [".p-1", null, 4, [["padding", "var(--spacing)"]]], [".p-2", null, 4, [["padding", "calc(var(--spacing) * 2)"]]], [".p-3", null, 4, [["padding", "calc(var(--spacing) * 3)"]]], [".p-4", null, 4, [["padding", "calc(var(--spacing) * 4)"]]], [".p-5", null, 4, [["padding", "calc(var(--spacing) * 5)"]]], [".p-6", null, 4, [["padding", "calc(var(--spacing) * 6)"]]], [".p-\\[0\\.2rem\\]", null, 4, [["padding", ".2rem"]]], [".p-\\[0\\.4rem\\]", null, 4, [["padding", ".4rem"]]], [".p-\\[0\\.5rem\\]", null, 4, [["padding", ".5rem"]]], [".p-\\[0\\.9rem\\]", null, 4, [["padding", ".9rem"]]], [".p-\\[0\\.45rem\\]", null, 4, [["padding", ".45rem"]]], [".p-\\[0\\.55rem\\]", null, 4, [["padding", ".55rem"]]], [".p-\\[0\\.65rem\\]", null, 4, [["padding", ".65rem"]]], [".p-\\[2px\\]", null, 4, [["padding", "2px"]]], [".px-0", null, 4, [["padding-inline", "0"]]], [".px-1", null, 4, [["padding-inline", "var(--spacing)"]]], [".px-1\\.5", null, 4, [["padding-inline", "calc(var(--spacing) * 1.5)"]]], [".px-2", null, 4, [["padding-inline", "calc(var(--spacing) * 2)"]]], [".px-3", null, 4, [["padding-inline", "calc(var(--spacing) * 3)"]]], [".px-3\\.5", null, 4, [["padding-inline", "calc(var(--spacing) * 3.5)"]]], [".px-4", null, 4, [["padding-inline", "calc(var(--spacing) * 4)"]]], [".px-8", null, 4, [["padding-inline", "calc(var(--spacing) * 8)"]]], [".px-\\[0\\.2rem\\]", null, 4, [["padding-inline", ".2rem"]]], [".px-\\[0\\.3rem\\]", null, 4, [["padding-inline", ".3rem"]]], [".px-\\[0\\.4rem\\]", null, 4, [["padding-inline", ".4rem"]]], [".px-\\[0\\.5rem\\]", null, 4, [["padding-inline", ".5rem"]]], [".px-\\[0\\.6rem\\]", null, 4, [["padding-inline", ".6rem"]]], [".px-\\[0\\.7rem\\]", null, 4, [["padding-inline", ".7rem"]]], [".px-\\[0\\.8rem\\]", null, 4, [["padding-inline", ".8rem"]]], [".px-\\[0\\.9rem\\]", null, 4, [["padding-inline", ".9rem"]]], [".px-\\[0\\.26rem\\]", null, 4, [["padding-inline", ".26rem"]]], [".px-\\[0\\.28rem\\]", null, 4, [["padding-inline", ".28rem"]]], [".px-\\[0\\.35rem\\]", null, 4, [["padding-inline", ".35rem"]]], [".px-\\[0\\.42rem\\]", null, 4, [["padding-inline", ".42rem"]]], [".px-\\[0\\.45rem\\]", null, 4, [["padding-inline", ".45rem"]]], [".px-\\[0\\.48rem\\]", null, 4, [["padding-inline", ".48rem"]]], [".px-\\[0\\.55rem\\]", null, 4, [["padding-inline", ".55rem"]]], [".px-\\[0\\.65rem\\]", null, 4, [["padding-inline", ".65rem"]]], [".px-\\[0\\.75rem\\]", null, 4, [["padding-inline", ".75rem"]]], [".px-\\[0\\.85rem\\]", null, 4, [["padding-inline", ".85rem"]]], [".px-\\[1\\.4rem\\]", null, 4, [["padding-inline", "1.4rem"]]], [".px-\\[3px\\]", null, 4, [["padding-inline", "3px"]]], [".px-\\[10px\\]", null, 4, [["padding-inline", "10px"]]], [".py-0", null, 4, [["padding-block", "0"]]], [".py-0\\.5", null, 4, [["padding-block", "calc(var(--spacing) * .5)"]]], [".py-1", null, 4, [["padding-block", "var(--spacing)"]]], [".py-1\\.5", null, 4, [["padding-block", "calc(var(--spacing) * 1.5)"]]], [".py-2", null, 4, [["padding-block", "calc(var(--spacing) * 2)"]]], [".py-3", null, 4, [["padding-block", "calc(var(--spacing) * 3)"]]], [".py-4", null, 4, [["padding-block", "calc(var(--spacing) * 4)"]]], [".py-8", null, 4, [["padding-block", "calc(var(--spacing) * 8)"]]], [".py-\\[0\\.1rem\\]", null, 4, [["padding-block", ".1rem"]]], [".py-\\[0\\.2rem\\]", null, 4, [["padding-block", ".2rem"]]], [".py-\\[0\\.3rem\\]", null, 4, [["padding-block", ".3rem"]]], [".py-\\[0\\.4rem\\]", null, 4, [["padding-block", ".4rem"]]], [".py-\\[0\\.05rem\\]", null, 4, [["padding-block", ".05rem"]]], [".py-\\[0\\.6rem\\]", null, 4, [["padding-block", ".6rem"]]], [".py-\\[0\\.8rem\\]", null, 4, [["padding-block", ".8rem"]]], [".py-\\[0\\.12rem\\]", null, 4, [["padding-block", ".12rem"]]], [".py-\\[0\\.14rem\\]", null, 4, [["padding-block", ".14rem"]]], [".py-\\[0\\.15rem\\]", null, 4, [["padding-block", ".15rem"]]], [".py-\\[0\\.18rem\\]", null, 4, [["padding-block", ".18rem"]]], [".py-\\[0\\.25rem\\]", null, 4, [["padding-block", ".25rem"]]], [".py-\\[0\\.28rem\\]", null, 4, [["padding-block", ".28rem"]]], [".py-\\[0\\.32rem\\]", null, 4, [["padding-block", ".32rem"]]], [".py-\\[0\\.35rem\\]", null, 4, [["padding-block", ".35rem"]]], [".py-\\[0\\.42rem\\]", null, 4, [["padding-block", ".42rem"]]], [".py-\\[0\\.45rem\\]", null, 4, [["padding-block", ".45rem"]]], [".py-\\[0\\.55rem\\]", null, 4, [["padding-block", ".55rem"]]], [".py-\\[0\\.65rem\\]", null, 4, [["padding-block", ".65rem"]]], [".py-\\[2px\\]", null, 4, [["padding-block", "2px"]]], [".py-\\[3px\\]", null, 4, [["padding-block", "3px"]]], [".py-\\[6px\\]", null, 4, [["padding-block", "6px"]]], [".py-px", null, 4, [["padding-block", "1px"]]], [".pt-1", null, 4, [["padding-top", "var(--spacing)"]]], [".pt-2", null, 4, [["padding-top", "calc(var(--spacing) * 2)"]]], [".pt-2\\.5", null, 4, [["padding-top", "calc(var(--spacing) * 2.5)"]]], [".pt-3", null, 4, [["padding-top", "calc(var(--spacing) * 3)"]]], [".pt-4", null, 4, [["padding-top", "calc(var(--spacing) * 4)"]]], [".pt-5", null, 4, [["padding-top", "calc(var(--spacing) * 5)"]]], [".pt-\\[0\\.2rem\\]", null, 4, [["padding-top", ".2rem"]]], [".pt-\\[0\\.4rem\\]", null, 4, [["padding-top", ".4rem"]]], [".pt-\\[0\\.6rem\\]", null, 4, [["padding-top", ".6rem"]]], [".pt-\\[0\\.85rem\\]", null, 4, [["padding-top", ".85rem"]]], [".pt-\\[2px\\]", null, 4, [["padding-top", "2px"]]], [".pt-\\[12vh\\]", null, 4, [["padding-top", "12vh"]]], [".pt-\\[max\\(0\\.5rem\\,env\\(safe-area-inset-top\\)\\)\\]", null, 4, [["padding-top", "max(.5rem, env(safe-area-inset-top))"]]], [".pr-0\\.5", null, 4, [["padding-right", "calc(var(--spacing) * .5)"]]], [".pr-1", null, 4, [["padding-right", "var(--spacing)"]]], [".pr-1\\.5", null, 4, [["padding-right", "calc(var(--spacing) * 1.5)"]]], [".pr-2", null, 4, [["padding-right", "calc(var(--spacing) * 2)"]]], [".pr-3", null, 4, [["padding-right", "calc(var(--spacing) * 3)"]]], [".pr-12", null, 4, [["padding-right", "calc(var(--spacing) * 12)"]]], [".pr-\\[0\\.3rem\\]", null, 4, [["padding-right", ".3rem"]]], [".pr-\\[0\\.6rem\\]", null, 4, [["padding-right", ".6rem"]]], [".pr-\\[0\\.35rem\\]", null, 4, [["padding-right", ".35rem"]]], [".pr-\\[0\\.45rem\\]", null, 4, [["padding-right", ".45rem"]]], [".pr-\\[0\\.55rem\\]", null, 4, [["padding-right", ".55rem"]]], [".pr-\\[1\\.6rem\\]", null, 4, [["padding-right", "1.6rem"]]], [".pr-\\[3px\\]", null, 4, [["padding-right", "3px"]]], [".pr-\\[env\\(safe-area-inset-right\\)\\]", null, 4, [["padding-right", "env(safe-area-inset-right)"]]], [".pr-\\[max\\(0\\.5rem\\,env\\(safe-area-inset-right\\)\\)\\]", null, 4, [["padding-right", "max(.5rem, env(safe-area-inset-right))"]]], [".pb-1", null, 4, [["padding-bottom", "var(--spacing)"]]], [".pb-2", null, 4, [["padding-bottom", "calc(var(--spacing) * 2)"]]], [".pb-3", null, 4, [["padding-bottom", "calc(var(--spacing) * 3)"]]], [".pb-4", null, 4, [["padding-bottom", "calc(var(--spacing) * 4)"]]], [".pb-8", null, 4, [["padding-bottom", "calc(var(--spacing) * 8)"]]], [".pb-\\[0\\.3rem\\]", null, 4, [["padding-bottom", ".3rem"]]], [".pb-\\[0\\.4rem\\]", null, 4, [["padding-bottom", ".4rem"]]], [".pb-\\[0\\.25rem\\]", null, 4, [["padding-bottom", ".25rem"]]], [".pb-\\[0\\.55rem\\]", null, 4, [["padding-bottom", ".55rem"]]], [".pb-\\[1\\.4rem\\]", null, 4, [["padding-bottom", "1.4rem"]]], [".pb-\\[calc\\(1\\.5rem\\+env\\(safe-area-inset-bottom\\)\\)\\]", null, 4, [["padding-bottom", "calc(1.5rem + env(safe-area-inset-bottom))"]]], [".pb-\\[calc\\(1rem\\+env\\(safe-area-inset-bottom\\)\\)\\]", null, 4, [["padding-bottom", "calc(1rem + env(safe-area-inset-bottom))"]]], [".pb-\\[env\\(safe-area-inset-bottom\\)\\]", null, 4, [["padding-bottom", "env(safe-area-inset-bottom)"]]], [".pb-\\[max\\(0\\.5rem\\,env\\(safe-area-inset-bottom\\)\\)\\]", null, 4, [["padding-bottom", "max(.5rem, env(safe-area-inset-bottom))"]]], [".pl-1", null, 4, [["padding-left", "var(--spacing)"]]], [".pl-1\\.5", null, 4, [["padding-left", "calc(var(--spacing) * 1.5)"]]], [".pl-2", null, 4, [["padding-left", "calc(var(--spacing) * 2)"]]], [".pl-3", null, 4, [["padding-left", "calc(var(--spacing) * 3)"]]], [".pl-4", null, 4, [["padding-left", "calc(var(--spacing) * 4)"]]], [".pl-5", null, 4, [["padding-left", "calc(var(--spacing) * 5)"]]], [".pl-6", null, 4, [["padding-left", "calc(var(--spacing) * 6)"]]], [".pl-\\[0\\.4rem\\]", null, 4, [["padding-left", ".4rem"]]], [".pl-\\[0\\.45rem\\]", null, 4, [["padding-left", ".45rem"]]], [".pl-\\[0\\.75rem\\]", null, 4, [["padding-left", ".75rem"]]], [".pl-\\[0\\.85rem\\]", null, 4, [["padding-left", ".85rem"]]], [".pl-\\[1\\.2rem\\]", null, 4, [["padding-left", "1.2rem"]]], [".pl-\\[1\\.55rem\\]", null, 4, [["padding-left", "1.55rem"]]], [".pl-\\[1\\.075rem\\]", null, 4, [["padding-left", "1.075rem"]]], [".pl-\\[1\\.525rem\\]", null, 4, [["padding-left", "1.525rem"]]], [".pl-\\[1\\.875rem\\]", null, 4, [["padding-left", "1.875rem"]]], [".pl-\\[85px\\]", null, 4, [["padding-left", "85px"]]], [".pl-\\[max\\(0\\.5rem\\,env\\(safe-area-inset-left\\)\\)\\]", null, 4, [["padding-left", "max(.5rem, env(safe-area-inset-left))"]]], [".pl-\\[max\\(0\\.25rem\\,env\\(safe-area-inset-left\\)\\)\\]", null, 4, [["padding-left", "max(.25rem, env(safe-area-inset-left))"]]], [".text-center", null, 4, [["text-align", "center"]]], [".text-left", null, 4, [["text-align", "left"]]], [".text-right", null, 4, [["text-align", "right"]]], [".\\[font-family\\:inherit\\]", null, 4, [["font-family", "inherit"]]], [".\\[font-family\\:ui-monospace\\,SFMono-Regular\\,Menlo\\,monospace\\]", null, 4, [["font-family", "ui-monospace, SFMono-Regular, Menlo, monospace"]]], [".\\[font-family\\:var\\(--font-mono\\)\\]", null, 4, [["font-family", "var(--font-mono)"]]], [".text-sm", null, 4, [["font-size", "var(--text-sm)"], ["line-height", "var(--tw-leading, var(--text-sm--line-height))"]]], [".text-xs", null, 4, [["font-size", "var(--text-xs)"], ["line-height", "var(--tw-leading, var(--text-xs--line-height))"]]], [".\\[font-size\\:inherit\\]", null, 4, [["font-size", "inherit"]]], [".text-\\[0\\.6rem\\]", null, 4, [["font-size", ".6rem"]]], [".text-\\[0\\.7rem\\]", null, 4, [["font-size", ".7rem"]]], [".text-\\[0\\.8em\\]", null, 4, [["font-size", ".8em"]]], [".text-\\[0\\.8rem\\]", null, 4, [["font-size", ".8rem"]]], [".text-\\[0\\.9em\\]", null, 4, [["font-size", ".9em"]]], [".text-\\[0\\.9rem\\]", null, 4, [["font-size", ".9rem"]]], [".text-\\[0\\.54rem\\]", null, 4, [["font-size", ".54rem"]]], [".text-\\[0\\.58rem\\]", null, 4, [["font-size", ".58rem"]]], [".text-\\[0\\.62rem\\]", null, 4, [["font-size", ".62rem"]]], [".text-\\[0\\.63rem\\]", null, 4, [["font-size", ".63rem"]]], [".text-\\[0\\.64rem\\]", null, 4, [["font-size", ".64rem"]]], [".text-\\[0\\.65rem\\]", null, 4, [["font-size", ".65rem"]]], [".text-\\[0\\.66rem\\]", null, 4, [["font-size", ".66rem"]]], [".text-\\[0\\.66rem\\]\\!", null, 4, [["font-size", ".66rem", 1]]], [".text-\\[0\\.68rem\\]", null, 4, [["font-size", ".68rem"]]], [".text-\\[0\\.72rem\\]", null, 4, [["font-size", ".72rem"]]], [".text-\\[0\\.74rem\\]", null, 4, [["font-size", ".74rem"]]], [".text-\\[0\\.75rem\\]", null, 4, [["font-size", ".75rem"]]], [".text-\\[0\\.76rem\\]", null, 4, [["font-size", ".76rem"]]], [".text-\\[0\\.77rem\\]", null, 4, [["font-size", ".77rem"]]], [".text-\\[0\\.78rem\\]", null, 4, [["font-size", ".78rem"]]], [".text-\\[0\\.82rem\\]", null, 4, [["font-size", ".82rem"]]], [".text-\\[0\\.83rem\\]", null, 4, [["font-size", ".83rem"]]], [".text-\\[0\\.85rem\\]", null, 4, [["font-size", ".85rem"]]], [".text-\\[0\\.88rem\\]", null, 4, [["font-size", ".88rem"]]], [".text-\\[0\\.95rem\\]", null, 4, [["font-size", ".95rem"]]], [".text-\\[0\\.875rem\\]", null, 4, [["font-size", ".875rem"]]], [".text-\\[1\\.1rem\\]", null, 4, [["font-size", "1.1rem"]]], [".text-\\[1\\.4em\\]", null, 4, [["font-size", "1.4em"]]], [".text-\\[1\\.6rem\\]", null, 4, [["font-size", "1.6rem"]]], [".text-\\[1\\.15rem\\]", null, 4, [["font-size", "1.15rem"]]], [".text-\\[1rem\\]", null, 4, [["font-size", "1rem"]]], [".text-\\[2\\.4rem\\]", null, 4, [["font-size", "2.4rem"]]], [".text-\\[9px\\]", null, 4, [["font-size", "9px"]]], [".text-\\[10px\\]", null, 4, [["font-size", "10px"]]], [".text-\\[11px\\]", null, 4, [["font-size", "11px"]]], [".text-\\[12\\.5px\\]", null, 4, [["font-size", "12.5px"]]], [".text-\\[12px\\]", null, 4, [["font-size", "12px"]]], [".text-\\[13px\\]", null, 4, [["font-size", "13px"]]], [".text-\\[14px\\]", null, 4, [["font-size", "14px"]]], [".text-\\[calc\\(0\\.95rem\\*var\\(--chat-font-scale\\,1\\)\\)\\]", null, 4, [["font-size", "calc(.95rem * var(--chat-font-scale, 1))"]]], [".text-\\[length\\:calc\\(11px\\*var\\(--zoom\\,1\\)\\)\\]", null, 4, [["font-size", "calc(11px * var(--zoom, 1))"]]], [".text-\\[length\\:calc\\(13px\\*var\\(--zoom\\,1\\)\\)\\]", null, 4, [["font-size", "calc(13px * var(--zoom, 1))"]]], [".leading-4", null, 4, [["--tw-leading", "calc(var(--spacing) * 4)"], ["line-height", "calc(var(--spacing) * 4)"]]], [".leading-\\[1\\.1\\]", null, 4, [["--tw-leading", "1.1"], ["line-height", "1.1"]]], [".leading-\\[1\\.2\\]", null, 4, [["--tw-leading", "1.2"], ["line-height", "1.2"]]], [".leading-\\[1\\.3\\]", null, 4, [["--tw-leading", "1.3"], ["line-height", "1.3"]]], [".leading-\\[1\\.4\\]", null, 4, [["--tw-leading", "1.4"], ["line-height", "1.4"]]], [".leading-\\[1\\.5\\]", null, 4, [["--tw-leading", "1.5"], ["line-height", "1.5"]]], [".leading-\\[1\\.6\\]", null, 4, [["--tw-leading", "1.6"], ["line-height", "1.6"]]], [".leading-\\[1\\.45\\]", null, 4, [["--tw-leading", "1.45"], ["line-height", "1.45"]]], [".leading-\\[18px\\]", null, 4, [["--tw-leading", "18px"], ["line-height", "18px"]]], [".leading-none", null, 4, [["--tw-leading", "1"], ["line-height", "1"]]], [".leading-relaxed", null, 4, [["--tw-leading", "var(--leading-relaxed)"], ["line-height", "var(--leading-relaxed)"]]], [".leading-tight", null, 4, [["--tw-leading", "var(--leading-tight)"], ["line-height", "var(--leading-tight)"]]], [".\\[line-height\\:inherit\\]", null, 4, [["line-height", "inherit"]]], [".font-bold", null, 4, [["--tw-font-weight", "var(--font-weight-bold)"], ["font-weight", "var(--font-weight-bold)"]]], [".font-medium", null, 4, [["--tw-font-weight", "var(--font-weight-medium)"], ["font-weight", "var(--font-weight-medium)"]]], [".font-normal", null, 4, [["--tw-font-weight", "var(--font-weight-normal)"], ["font-weight", "var(--font-weight-normal)"]]], [".font-semibold", null, 4, [["--tw-font-weight", "var(--font-weight-semibold)"], ["font-weight", "var(--font-weight-semibold)"]]], [".\\[font-weight\\:inherit\\]", null, 4, [["font-weight", "inherit"]]], [".tracking-\\[-0\\.02em\\]", null, 4, [["--tw-tracking", "-.02em"], ["letter-spacing", "-.02em"]]], [".tracking-\\[0\\.03em\\]", null, 4, [["--tw-tracking", ".03em"], ["letter-spacing", ".03em"]]], [".tracking-\\[0\\.04em\\]", null, 4, [["--tw-tracking", ".04em"], ["letter-spacing", ".04em"]]], [".tracking-\\[0\\.06em\\]", null, 4, [["--tw-tracking", ".06em"], ["letter-spacing", ".06em"]]], [".tracking-\\[0\\.08em\\]", null, 4, [["--tw-tracking", ".08em"], ["letter-spacing", ".08em"]]], [".tracking-\\[0\\.09em\\]", null, 4, [["--tw-tracking", ".09em"], ["letter-spacing", ".09em"]]], [".tracking-\\[0\\.22em\\]", null, 4, [["--tw-tracking", ".22em"], ["letter-spacing", ".22em"]]], [".tracking-normal", null, 4, [["--tw-tracking", "var(--tracking-normal)"], ["letter-spacing", "var(--tracking-normal)"]]], [".tracking-wide", null, 4, [["--tw-tracking", "var(--tracking-wide)"], ["letter-spacing", "var(--tracking-wide)"]]], [".\\[overflow-wrap\\:anywhere\\]", null, 4, [["overflow-wrap", "anywhere"]]], [".break-words", null, 4, [["overflow-wrap", "break-word"]]], [".\\[word-break\\:break-word\\]", null, 4, [["word-break", "break-word"]]], [".text-ellipsis", null, 4, [["text-overflow", "ellipsis"]]], [".whitespace-normal", null, 4, [["white-space", "normal"]]], [".whitespace-nowrap", null, 4, [["white-space", "nowrap"]]], [".whitespace-pre", null, 4, [["white-space", "pre"]]], [".whitespace-pre-wrap", null, 4, [["white-space", "pre-wrap"]]], [".\\[tab-size\\:2\\]", null, 4, [["tab-size", "2"]]], [".text-\\[color\\:var\\(--git-muted\\)\\]", null, 4, [["color", "var(--git-muted)"]]], [".text-\\[var\\(--subtext-0\\)\\]", null, 4, [["color", "var(--subtext-0)"]]], [".text-\\[var\\(--text\\)\\]", null, 4, [["color", "var(--text)"]]], [".text-accent", null, 4, [["color", "var(--accent)"]]], [".text-blue", null, 4, [["color", "var(--blue)"]]], [".text-current", null, 4, [["color", "currentColor"]]], [".text-fg", null, 4, [["color", "var(--text)"]]], [".text-green", null, 4, [["color", "var(--green)"]]], [".text-inherit", null, 4, [["color", "inherit"]]], [".text-mauve", null, 4, [["color", "var(--mauve)"]]], [".text-overlay-0", null, 4, [["color", "var(--overlay-0)"]]], [".text-overlay-1", null, 4, [["color", "var(--overlay-1)"]]], [".text-panel-bg", null, 4, [["color", "var(--panel-bg)"]]], [".text-peach", null, 4, [["color", "var(--peach)"]]], [".text-red", null, 4, [["color", "var(--red)"]]], [".text-red\\!", null, 4, [["color", "var(--red)", 1]]], [".text-subtext-0", null, 4, [["color", "var(--subtext-0)"]]], [".text-yellow", null, 4, [["color", "var(--yellow)"]]], [".capitalize", null, 4, [["text-transform", "capitalize"]]], [".normal-case", null, 4, [["text-transform", "none"]]], [".uppercase", null, 4, [["text-transform", "uppercase"]]], [".italic", null, 4, [["font-style", "italic"]]], [".not-italic", null, 4, [["font-style", "normal"]]], [".tabular-nums", null, 4, [["--tw-numeric-spacing", "tabular-nums"], ["font-variant-numeric", "var(--tw-ordinal, ) var(--tw-slashed-zero, ) var(--tw-numeric-figure, ) var(--tw-numeric-spacing, ) var(--tw-numeric-fraction, )"]]], [".line-through", null, 4, [["text-decoration-line", "line-through"]]], [".no-underline", null, 4, [["text-decoration-line", "none"]]], [".underline", null, 4, [["text-decoration-line", "underline"]]], [".opacity-0", null, 4, [["opacity", "0"]]], [".opacity-40", null, 4, [["opacity", ".4"]]], [".opacity-60", null, 4, [["opacity", ".6"]]], [".opacity-70", null, 4, [["opacity", ".7"]]], [".opacity-75", null, 4, [["opacity", ".75"]]], [".opacity-80", null, 4, [["opacity", ".8"]]], [".opacity-100", null, 4, [["opacity", "1"]]], [".opacity-\\[0\\.72\\]", null, 4, [["opacity", ".72"]]], [".shadow", null, 4, [["--tw-shadow", "0 1px 3px 0 var(--tw-shadow-color, #0000001a), 0 1px 2px -1px var(--tw-shadow-color, #0000001a)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_1px_4px_rgba\\(0\\,0\\,0\\,0\\.4\\)\\]", null, 4, [["--tw-shadow", "0 1px 4px var(--tw-shadow-color, #0006)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_2px_8px_rgba\\(0\\,0\\,0\\,0\\.4\\)\\]", null, 4, [["--tw-shadow", "0 2px 8px var(--tw-shadow-color, #0006)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_2px_8px_rgba\\(0\\,0\\,0\\,0\\.35\\)\\]", null, 4, [["--tw-shadow", "0 2px 8px var(--tw-shadow-color, #00000059)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_6px_20px_rgba\\(0\\,0\\,0\\,0\\.3\\)\\]", null, 4, [["--tw-shadow", "0 6px 20px var(--tw-shadow-color, #0000004d)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_8px_24px_rgba\\(0\\,0\\,0\\,0\\.35\\)\\]", null, 4, [["--tw-shadow", "0 8px 24px var(--tw-shadow-color, #00000059)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_8px_24px_rgba\\(0\\,0\\,0\\,0\\.45\\)\\]", null, 4, [["--tw-shadow", "0 8px 24px var(--tw-shadow-color, #00000073)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_8px_32px_rgba\\(0\\,0\\,0\\,0\\.5\\)\\]", null, 4, [["--tw-shadow", "0 8px 32px var(--tw-shadow-color, #00000080)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_12px_32px_rgba\\(0\\,0\\,0\\,0\\.5\\)\\]", null, 4, [["--tw-shadow", "0 12px 32px var(--tw-shadow-color, #00000080)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_16px_48px_rgba\\(0\\,0\\,0\\,0\\.55\\)\\]", null, 4, [["--tw-shadow", "0 16px 48px var(--tw-shadow-color, #0000008c)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[inset_0_0_24px_var\\(--accent\\)\\]", null, 4, [["--tw-shadow", "inset 0 0 24px var(--tw-shadow-color, var(--accent))"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-lg", null, 4, [["--tw-shadow", "0 10px 15px -3px var(--tw-shadow-color, #0000001a), 0 4px 6px -4px var(--tw-shadow-color, #0000001a)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".ring", null, 4, [["--tw-ring-shadow", "var(--tw-ring-inset, ) 0 0 0 calc(1px + var(--tw-ring-offset-width)) var(--tw-ring-color, currentcolor)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".\\[box-shadow\\:0_1px_2px_rgba\\(0\\,0\\,0\\,0\\.3\\)\\]", null, 4, [["box-shadow", "0 1px 2px #0000004d"]]], [".\\[box-shadow\\:0_4px_14px_rgba\\(0\\,0\\,0\\,0\\.35\\)\\]", null, 4, [["box-shadow", "0 4px 14px #00000059"]]], [".\\[box-shadow\\:none\\]", null, 4, [["box-shadow", "none"]]], [".\\[outline\\:none\\]", null, 4, [["outline", "none"]]], [".outline, .outline-1", null, 4, [["outline-style", "var(--tw-outline-style)"], ["outline-width", "1px"]]], [".outline-2", null, 4, [["outline-style", "var(--tw-outline-style)"], ["outline-width", "2px"]]], [".outline-accent", null, 4, [["outline-color", "var(--accent)"]]], [".blur", null, 4, [["--tw-blur", "blur(8px)"], ["filter", "var(--tw-blur, ) var(--tw-brightness, ) var(--tw-contrast, ) var(--tw-grayscale, ) var(--tw-hue-rotate, ) var(--tw-invert, ) var(--tw-saturate, ) var(--tw-sepia, ) var(--tw-drop-shadow, )"]]], [".\\!filter", null, 4, [["filter", "var(--tw-blur, ) var(--tw-brightness, ) var(--tw-contrast, ) var(--tw-grayscale, ) var(--tw-hue-rotate, ) var(--tw-invert, ) var(--tw-saturate, ) var(--tw-sepia, ) var(--tw-drop-shadow, )", 1]]], [".\\[filter\\:drop-shadow\\(0_6px_10px_rgba\\(0\\,0\\,0\\,0\\.45\\)\\)\\]", null, 4, [["filter", "drop-shadow(0 6px 10px #00000073)"]]], [".filter", null, 4, [["filter", "var(--tw-blur, ) var(--tw-brightness, ) var(--tw-contrast, ) var(--tw-grayscale, ) var(--tw-hue-rotate, ) var(--tw-invert, ) var(--tw-saturate, ) var(--tw-sepia, ) var(--tw-drop-shadow, )"]]], [".backdrop-blur-xl", null, 4, [["--tw-backdrop-blur", "blur(var(--blur-xl))"], ["-webkit-backdrop-filter", "var(--tw-backdrop-blur, ) var(--tw-backdrop-brightness, ) var(--tw-backdrop-contrast, ) var(--tw-backdrop-grayscale, ) var(--tw-backdrop-hue-rotate, ) var(--tw-backdrop-invert, ) var(--tw-backdrop-opacity, ) var(--tw-backdrop-saturate, ) var(--tw-backdrop-sepia, )"], ["backdrop-filter", "var(--tw-backdrop-blur, ) var(--tw-backdrop-brightness, ) var(--tw-backdrop-contrast, ) var(--tw-backdrop-grayscale, ) var(--tw-backdrop-hue-rotate, ) var(--tw-backdrop-invert, ) var(--tw-backdrop-opacity, ) var(--tw-backdrop-saturate, ) var(--tw-backdrop-sepia, )"]]], [".backdrop-saturate-150", null, 4, [["--tw-backdrop-saturate", "saturate(150%)"], ["-webkit-backdrop-filter", "var(--tw-backdrop-blur, ) var(--tw-backdrop-brightness, ) var(--tw-backdrop-contrast, ) var(--tw-backdrop-grayscale, ) var(--tw-backdrop-hue-rotate, ) var(--tw-backdrop-invert, ) var(--tw-backdrop-opacity, ) var(--tw-backdrop-saturate, ) var(--tw-backdrop-sepia, )"], ["backdrop-filter", "var(--tw-backdrop-blur, ) var(--tw-backdrop-brightness, ) var(--tw-backdrop-contrast, ) var(--tw-backdrop-grayscale, ) var(--tw-backdrop-hue-rotate, ) var(--tw-backdrop-invert, ) var(--tw-backdrop-opacity, ) var(--tw-backdrop-saturate, ) var(--tw-backdrop-sepia, )"]]], [".transition", null, 4, [["transition-property", "color, background-color, border-color, outline-color, text-decoration-color, fill, stroke, --tw-gradient-from, --tw-gradient-via, --tw-gradient-to, opacity, box-shadow, transform, translate, scale, rotate, filter, -webkit-backdrop-filter, backdrop-filter, display, content-visibility, overlay, pointer-events"], ["transition-timing-function", "var(--tw-ease, var(--default-transition-timing-function))"], ["transition-duration", "var(--tw-duration, var(--default-transition-duration))"]]], [".transition-\\[left\\,top\\,width\\,height\\]", null, 4, [["transition-property", "left, top, width, height"], ["transition-timing-function", "var(--tw-ease, var(--default-transition-timing-function))"], ["transition-duration", "var(--tw-duration, var(--default-transition-duration))"]]], [".transition-opacity", null, 4, [["transition-property", "opacity"], ["transition-timing-function", "var(--tw-ease, var(--default-transition-timing-function))"], ["transition-duration", "var(--tw-duration, var(--default-transition-duration))"]]], [".duration-150", null, 4, [["--tw-duration", ".15s"], ["transition-duration", ".15s"]]], [".ease-out", null, 4, [["--tw-ease", "var(--ease-out)"], ["transition-timing-function", "var(--ease-out)"]]], [".outline-none", null, 4, [["--tw-outline-style", "none"], ["outline-style", "none"]]], [".outline-solid", null, 4, [["--tw-outline-style", "solid"], ["outline-style", "solid"]]], [".select-none", null, 4, [["-webkit-user-select", "none"], ["user-select", "none"]]], [".select-text", null, 4, [["-webkit-user-select", "text"], ["user-select", "text"]]], [".\\[--panel-bg\\:var\\(--surface-dim\\)\\]", null, 4, [["--panel-bg", "var(--surface-dim)"]]], [".\\[--picker-bg\\:var\\(--surface-0\\)\\]", null, 4, [["--picker-bg", "var(--surface-0)"]]], [".\\[--radius\\:var\\(--radius-pane\\)\\]", null, 4, [["--radius", "var(--radius-pane)"]]], [".\\[--workspace-tools-bg\\:transparent\\]", null, 4, [["--workspace-tools-bg", "transparent"]]], [".\\[-webkit-box-orient\\:vertical\\]", null, 4, [["-webkit-box-orient", "vertical"]]], [".\\[-webkit-line-clamp\\:3\\]", null, 4, [["-webkit-line-clamp", "3"]]], [".\\[-webkit-touch-callout\\:none\\]", null, 4, [["-webkit-touch-callout", "none"]]], [".\\[background\\:none\\]", null, 4, [["background", "none"]]], [".\\[border-right\\:1px_solid_var\\(--git-border\\)\\]", null, 4, [["border-right", "1px solid var(--git-border)"]]], [".\\[border-top\\:1px_solid_var\\(--git-border\\)\\]", null, 4, [["border-top", "1px solid var(--git-border)"]]], [".\\[border\\:0\\]", null, 4, [["border", "0"]]], [".\\[border\\:none\\]", null, 4, [["border", "none"]]], [".\\[font\\:1\\.15rem\\/1_var\\(--font-mono\\)\\]", null, 4, [["font", "1.15rem/1 var(--font-mono)"]]], [".\\[font\\:1rem\\/1\\.2_var\\(--font-mono\\)\\]", null, 4, [["font", "1rem/1.2 var(--font-mono)"]]], [".\\[font\\:inherit\\]", null, 4, [["font", "inherit"]]], [".\\[transition\\:background_0\\.1s_ease\\]", null, 4, [["transition", "background .1s"]]], [".\\[transition\\:background_0\\.12s_ease\\]", null, 4, [["transition", "background .12s"]]], [".\\[transition\\:background_0\\.15s_ease\\]", null, 4, [["transition", "background .15s"]]], [".\\[transition\\:color_0\\.1s_ease\\,background_0\\.1s_ease\\]", null, 4, [["transition", "color .1s, background .1s"]]], [".\\[transition\\:color_0\\.12s_ease\\,background_0\\.12s_ease\\]", null, 4, [["transition", "color .12s, background .12s"]]], [".\\[transition\\:color_0\\.15s_ease\\]", null, 4, [["transition", "color .15s"]]], [".\\[transition\\:opacity_0\\.12s_ease\\]", null, 4, [["transition", "opacity .12s"]]], [".\\[transition\\:transform_0\\.15s_ease\\,background_0\\.15s_ease\\]", null, 4, [["transition", "transform .15s, background .15s"]]], [".not-has-\\[\\[data-setting-row\\]\\]\\:hidden:not(:has([data-setting-row]))", null, 4, [["display", "none"]]], [".group-focus-within\\:flex:is(:where(.group):focus-within *)", null, 4, [["display", "flex"]]], [".group-focus-within\\/row\\:opacity-100:is(:where(.group\\/row):focus-within *)", null, 4, [["opacity", "1"]]], [".group-hover\\:flex:is(:where(.group):hover *)", null, 4, [["display", "flex"]]], [".group-hover\\:opacity-100:is(:where(.group):hover *)", null, 4, [["opacity", "1"]]], [".group-hover\\/line\\:opacity-90:is(:where(.group\\/line):hover *)", null, 4, [["opacity", ".9"]]], [".group-hover\\/ph\\:opacity-100:is(:where(.group\\/ph):hover *), .group-hover\\/row\\:opacity-100:is(:where(.group\\/row):hover *)", null, 4, [["opacity", "1"]]], [".group-focus\\/tree\\:ring-1:is(:where(.group\\/tree):focus *)", null, 4, [["--tw-ring-shadow", "var(--tw-ring-inset, ) 0 0 0 calc(1px + var(--tw-ring-offset-width)) var(--tw-ring-color, currentcolor)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".group-focus\\/tree\\:ring-overlay-1:is(:where(.group\\/tree):focus *)", null, 4, [["--tw-ring-color", "var(--overlay-1)"]]], [".group-focus\\/tree\\:ring-inset:is(:where(.group\\/tree):focus *)", null, 4, [["--tw-ring-inset", "inset"]]], ['.group-aria-checked\\:\\[transform\\:translateX\\(1\\.1rem\\)\\]:is(:where(.group)[aria-checked="true"] *)', null, 4, [["transform", "translateX(1.1rem)"]]], ['.group-aria-checked\\:border-accent:is(:where(.group)[aria-checked="true"] *)', null, 4, [["border-color", "var(--accent)"]]], ['.group-aria-checked\\:bg-accent:is(:where(.group)[aria-checked="true"] *)', null, 4, [["background-color", "var(--accent)"]]], ['.group-aria-checked\\:bg-panel-bg:is(:where(.group)[aria-checked="true"] *)', null, 4, [["background-color", "var(--panel-bg)"]]], ['.group-aria-checked\\:text-accent:is(:where(.group)[aria-checked="true"] *), .group-aria-\\[checked\\=false\\]\\:text-accent:is(:where(.group)[aria-checked="false"] *)', null, 4, [["color", "var(--accent)"]]], [".placeholder\\:text-subtext-0::placeholder", null, 4, [["color", "var(--subtext-0)"]]], [".before\\:absolute:before", null, 4, [["content", "var(--tw-content)"], ["position", "absolute"]]], [".before\\:top-\\[0\\.15rem\\]:before", null, 4, [["content", "var(--tw-content)"], ["top", ".15rem"]]], [".before\\:left-\\[0\\.15rem\\]:before", null, 4, [["content", "var(--tw-content)"], ["left", ".15rem"]]], [".before\\:h-\\[0\\.95rem\\]:before", null, 4, [["content", "var(--tw-content)"], ["height", ".95rem"]]], [".before\\:w-\\[0\\.95rem\\]:before", null, 4, [["content", "var(--tw-content)"], ["width", ".95rem"]]], [".before\\:rounded-full:before", null, 4, [["content", "var(--tw-content)"], ["border-radius", "3.40282e38px"]]], [".before\\:bg-fg:before", null, 4, [["content", "var(--tw-content)"], ["background-color", "var(--text)"]]], [".before\\:content-\\[\\'\\'\\]:before", null, 4, [["--tw-content", '""'], ["content", "var(--tw-content)"]]], [".before\\:\\[transition\\:transform_0\\.12s_ease\\]:before", null, 4, [["content", "var(--tw-content)"], ["transition", "transform .12s"]]], [".after\\:absolute:after", null, 4, [["content", "var(--tw-content)"], ["position", "absolute"]]], [".after\\:inset-0:after", null, 4, [["content", "var(--tw-content)"], ["inset", "0"]]], [".after\\:inset-x-0:after", null, 4, [["content", "var(--tw-content)"], ["inset-inline", "0"]]], [".after\\:-inset-y-2:after", null, 4, [["content", "var(--tw-content)"], ["inset-block", "calc(var(--spacing) * -2)"]]], [".after\\:m-auto:after", null, 4, [["content", "var(--tw-content)"], ["margin", "auto"]]], [".after\\:h-8:after", null, 4, [["content", "var(--tw-content)"], ["height", "calc(var(--spacing) * 8)"]]], [".after\\:h-12:after", null, 4, [["content", "var(--tw-content)"], ["height", "calc(var(--spacing) * 12)"]]], [".after\\:h-\\[3px\\]:after", null, 4, [["content", "var(--tw-content)"], ["height", "3px"]]], [".after\\:w-8:after", null, 4, [["content", "var(--tw-content)"], ["width", "calc(var(--spacing) * 8)"]]], [".after\\:w-\\[3px\\]:after", null, 4, [["content", "var(--tw-content)"], ["width", "3px"]]], [".after\\:rounded-full:after", null, 4, [["content", "var(--tw-content)"], ["border-radius", "3.40282e38px"]]], [".after\\:bg-transparent:after", null, 4, [["content", "var(--tw-content)"], ["background-color", "#0000"]]], [".after\\:content-\\[\\'\\'\\]:after", null, 4, [["--tw-content", '""'], ["content", "var(--tw-content)"]]], [".last\\:border-b-0:last-child", null, 4, [["border-bottom-style", "var(--tw-border-style)"], ["border-bottom-width", "0"]]], [".checked\\:bg-accent:checked", null, 4, [["background-color", "var(--accent)"]]], [".checked\\:before\\:translate-x-\\[1rem\\]:checked:before", null, 4, [["content", "var(--tw-content)"], ["--tw-translate-x", "1rem"], ["translate", "var(--tw-translate-x) var(--tw-translate-y)"]]], [".checked\\:before\\:bg-panel-bg:checked:before", null, 4, [["content", "var(--tw-content)"], ["background-color", "var(--panel-bg)"]]], [".focus-within\\:bg-surface-1:focus-within", null, 4, [["background-color", "var(--surface-1)"]]], [".focus-within\\:outline:focus-within, .focus-within\\:outline-1:focus-within", null, 4, [["outline-style", "var(--tw-outline-style)"], ["outline-width", "1px"]]], [".focus-within\\:outline-fg:focus-within", null, 4, [["outline-color", "var(--text)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_12\\%\\,transparent\\)\\]:hover", null, 4, [["background-color", "var(--accent)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_12\\%\\,transparent\\)\\]:hover", null, 4, [["background-color", "color-mix(in srgb,var(--accent) 12%,transparent)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_15\\%\\,transparent\\)\\]:hover", null, 4, [["background-color", "var(--accent)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_15\\%\\,transparent\\)\\]:hover", null, 4, [["background-color", "color-mix(in srgb,var(--accent) 15%,transparent)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--text\\)_10\\%\\,var\\(--panel-bg\\)\\)\\]:hover", null, 4, [["background-color", "var(--text)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--text\\)_10\\%\\,var\\(--panel-bg\\)\\)\\]:hover", null, 4, [["background-color", "color-mix(in srgb,var(--text) 10%,var(--panel-bg))"]]], [".hover\\:bg-\\[var\\(--surface-0\\)\\]:hover", null, 4, [["background-color", "var(--surface-0)"]]], [".hover\\:bg-accent:hover", null, 4, [["background-color", "var(--accent)"]]], [".hover\\:bg-overlay-0:hover", null, 4, [["background-color", "var(--overlay-0)"]]], [".hover\\:bg-panel-bg:hover", null, 4, [["background-color", "var(--panel-bg)"]]], [".hover\\:bg-surface-0:hover", null, 4, [["background-color", "var(--surface-0)"]]], [".hover\\:bg-surface-1:hover", null, 4, [["background-color", "var(--surface-1)"]]], [".hover\\:bg-transparent:hover", null, 4, [["background-color", "#0000"]]], [".hover\\:text-accent:hover", null, 4, [["color", "var(--accent)"]]], [".hover\\:text-fg:hover", null, 4, [["color", "var(--text)"]]], [".hover\\:text-inherit:hover", null, 4, [["color", "inherit"]]], [".hover\\:text-overlay-0:hover", null, 4, [["color", "var(--overlay-0)"]]], [".hover\\:text-panel-bg:hover", null, 4, [["color", "var(--panel-bg)"]]], [".hover\\:text-red:hover", null, 4, [["color", "var(--red)"]]], [".hover\\:text-subtext-0:hover", null, 4, [["color", "var(--subtext-0)"]]], [".hover\\:text-yellow:hover", null, 4, [["color", "var(--yellow)"]]], [".hover\\:underline:hover", null, 4, [["text-decoration-line", "underline"]]], [".hover\\:opacity-60:hover", null, 4, [["opacity", ".6"]]], [".hover\\:opacity-100\\!:hover", null, 4, [["opacity", "1", 1]]], [".hover\\:opacity-\\[0\\.85\\]:hover", null, 4, [["opacity", ".85"]]], [".hover\\:brightness-110:hover", null, 4, [["--tw-brightness", "brightness(110%)"], ["filter", "var(--tw-blur, ) var(--tw-brightness, ) var(--tw-contrast, ) var(--tw-grayscale, ) var(--tw-hue-rotate, ) var(--tw-invert, ) var(--tw-saturate, ) var(--tw-sepia, ) var(--tw-drop-shadow, )"]]], [".hover\\:\\[filter\\:brightness\\(1\\.08\\)\\]:hover", null, 4, [["filter", "brightness(1.08)"]]], [".hover\\:after\\:bg-overlay-1:hover:after", null, 4, [["content", "var(--tw-content)"], ["background-color", "var(--overlay-1)"]]], [".focus\\:\\[outline\\:1px_solid_var\\(--accent\\)\\]:focus", null, 4, [["outline", "1px solid var(--accent)"]]], [".focus\\:outline-2:focus", null, 4, [["outline-style", "var(--tw-outline-style)"], ["outline-width", "2px"]]], [".focus\\:outline-none:focus", null, 4, [["--tw-outline-style", "none"], ["outline-style", "none"]]], [".focus-visible\\:bg-accent:focus-visible", null, 4, [["background-color", "var(--accent)"]]], [".focus-visible\\:bg-surface-0:focus-visible", null, 4, [["background-color", "var(--surface-0)"]]], [".focus-visible\\:bg-surface-1:focus-visible", null, 4, [["background-color", "var(--surface-1)"]]], [".focus-visible\\:text-accent:focus-visible", null, 4, [["color", "var(--accent)"]]], [".focus-visible\\:text-fg:focus-visible", null, 4, [["color", "var(--text)"]]], [".focus-visible\\:text-panel-bg:focus-visible", null, 4, [["color", "var(--panel-bg)"]]], [".focus-visible\\:text-red:focus-visible", null, 4, [["color", "var(--red)"]]], [".focus-visible\\:text-yellow:focus-visible", null, 4, [["color", "var(--yellow)"]]], [".focus-visible\\:underline:focus-visible", null, 4, [["text-decoration-line", "underline"]]], [".focus-visible\\:opacity-100:focus-visible", null, 4, [["opacity", "1"]]], [".focus-visible\\:\\[outline\\:1px_solid_var\\(--accent\\)\\]:focus-visible", null, 4, [["outline", "1px solid var(--accent)"]]], [".focus-visible\\:\\[outline\\:1px_solid_var\\(--overlay-1\\)\\]:focus-visible", null, 4, [["outline", "1px solid var(--overlay-1)"]]], [".focus-visible\\:\\[outline\\:2px_solid_var\\(--accent\\)\\]:focus-visible", null, 4, [["outline", "2px solid var(--accent)"]]], [".focus-visible\\:outline:focus-visible, .focus-visible\\:outline-1:focus-visible", null, 4, [["outline-style", "var(--tw-outline-style)"], ["outline-width", "1px"]]], [".focus-visible\\:\\[outline-offset\\:-1px\\]:focus-visible", null, 4, [["outline-offset", "-1px"]]], [".focus-visible\\:\\[outline-offset\\:-2px\\]:focus-visible", null, 4, [["outline-offset", "-2px"]]], [".focus-visible\\:\\[outline-offset\\:2px\\]:focus-visible", null, 4, [["outline-offset", "2px"]]], [".focus-visible\\:outline-offset-1:focus-visible", null, 4, [["outline-offset", "1px"]]], [".focus-visible\\:outline-fg:focus-visible", null, 4, [["outline-color", "var(--text)"]]], [".focus-visible\\:after\\:bg-accent:focus-visible:after", null, 4, [["content", "var(--tw-content)"], ["background-color", "var(--accent)"]]], [".active\\:cursor-grabbing:active", null, 4, [["cursor", "grabbing"]]], [".active\\:bg-surface-1:active", null, 4, [["background-color", "var(--surface-1)"]]], [".active\\:text-fg:active", null, 4, [["color", "var(--text)"]]], [".active\\:after\\:bg-accent:active:after", null, 4, [["content", "var(--tw-content)"], ["background-color", "var(--accent)"]]], [".enabled\\:hover\\:bg-surface-1:enabled:hover", null, 4, [["background-color", "var(--surface-1)"]]], [".enabled\\:hover\\:text-fg:enabled:hover", null, 4, [["color", "var(--text)"]]], [".disabled\\:cursor-default:disabled", null, 4, [["cursor", "default"]]], [".disabled\\:cursor-not-allowed:disabled", null, 4, [["cursor", "not-allowed"]]], [".disabled\\:cursor-not-allowed\\!:disabled", null, 4, [["cursor", "not-allowed", 1]]], [".disabled\\:cursor-wait:disabled", null, 4, [["cursor", "wait"]]], [".disabled\\:bg-transparent:disabled", null, 4, [["background-color", "#0000"]]], [".disabled\\:text-fg:disabled", null, 4, [["color", "var(--text)"]]], [".disabled\\:opacity-40:disabled", null, 4, [["opacity", ".4"]]], [".disabled\\:opacity-50:disabled", null, 4, [["opacity", ".5"]]], [".disabled\\:opacity-\\[0\\.45\\]:disabled", null, 4, [["opacity", ".45"]]], [".disabled\\:opacity-\\[0\\.55\\]:disabled", null, 4, [["opacity", ".55"]]], [":where(.app--mac-desktop) .in-\\[\\.app--mac-desktop\\]\\:pl-\\[84px\\]", null, 4, [["padding-left", "84px"]]], [".has-\\[\\:checked\\]\\:bg-surface-0:has(:checked)", null, 4, [["background-color", "var(--surface-0)"]]], [".has-\\[\\:checked\\]\\:text-fg:has(:checked)", null, 4, [["color", "var(--text)"]]], [".has-\\[\\:focus-visible\\]\\:bg-surface-0:has(:focus-visible)", null, 4, [["background-color", "var(--surface-0)"]]], ['.aria-disabled\\:cursor-not-allowed[aria-disabled="true"]', null, 4, [["cursor", "not-allowed"]]], ['.aria-disabled\\:opacity-40[aria-disabled="true"]', null, 4, [["opacity", ".4"]]], ['.aria-expanded\\:opacity-100[aria-expanded="true"]', null, 4, [["opacity", "1"]]], ['.aria-pressed\\:bg-surface-0[aria-pressed="true"]', null, 4, [["background-color", "var(--surface-0)"]]], ['.aria-pressed\\:text-fg[aria-pressed="true"]', null, 4, [["color", "var(--text)"]]], [".motion-reduce\\:animate-none", ["(prefers-reduced-motion: reduce)"], 4, [["animation", "none"]]], [".max-\\[900px\\]\\:hidden", ["not all and (min-width: 900px)"], 4, [["display", "none"]]], [".max-\\[700px\\]\\:hidden", ["not all and (min-width: 700px)"], 4, [["display", "none"]]], [".max-\\[700px\\]\\:size-11", ["not all and (min-width: 700px)"], 4, [["width", "calc(var(--spacing) * 11)"], ["height", "calc(var(--spacing) * 11)"]]], [".max-\\[700px\\]\\:h-9", ["not all and (min-width: 700px)"], 4, [["height", "calc(var(--spacing) * 9)"]]], [".max-\\[700px\\]\\:h-12", ["not all and (min-width: 700px)"], 4, [["height", "calc(var(--spacing) * 12)"]]], [".max-\\[700px\\]\\:min-h-9", ["not all and (min-width: 700px)"], 4, [["min-height", "calc(var(--spacing) * 9)"]]], [".max-\\[700px\\]\\:min-h-11", ["not all and (min-width: 700px)"], 4, [["min-height", "calc(var(--spacing) * 11)"]]], [".max-\\[700px\\]\\:w-24", ["not all and (min-width: 700px)"], 4, [["width", "calc(var(--spacing) * 24)"]]], [".max-\\[700px\\]\\:min-w-11", ["not all and (min-width: 700px)"], 4, [["min-width", "calc(var(--spacing) * 11)"]]], [".max-\\[700px\\]\\:flex-1", ["not all and (min-width: 700px)"], 4, [["flex", "1"]]], [".max-\\[700px\\]\\:flex-\\[1_1_6rem\\]", ["not all and (min-width: 700px)"], 4, [["flex", "6rem"]]], [".max-\\[700px\\]\\:flex-\\[1_1_100\\%\\]", ["not all and (min-width: 700px)"], 4, [["flex", "100%"]]], [".max-\\[700px\\]\\:basis-56", ["not all and (min-width: 700px)"], 4, [["flex-basis", "calc(var(--spacing) * 56)"]]], [".max-\\[700px\\]\\:basis-full", ["not all and (min-width: 700px)"], 4, [["flex-basis", "100%"]]], [".max-\\[700px\\]\\:flex-wrap", ["not all and (min-width: 700px)"], 4, [["flex-wrap", "wrap"]]], [".max-\\[700px\\]\\:gap-y-2", ["not all and (min-width: 700px)"], 4, [["row-gap", "calc(var(--spacing) * 2)"]]], [".min-\\[701px\\]\\:left-auto", ["(min-width: 701px)"], 4, [["left", "auto"]]], [".min-\\[701px\\]\\:my-\\[3px\\]", ["(min-width: 701px)"], 4, [["margin-block", "3px"]]], [".min-\\[701px\\]\\:block", ["(min-width: 701px)"], 4, [["display", "block"]]], [".min-\\[701px\\]\\:hidden", ["(min-width: 701px)"], 4, [["display", "none"]]], [".min-\\[701px\\]\\:min-h-6", ["(min-width: 701px)"], 4, [["min-height", "calc(var(--spacing) * 6)"]]], [".min-\\[701px\\]\\:w-80", ["(min-width: 701px)"], 4, [["width", "calc(var(--spacing) * 80)"]]], [".min-\\[701px\\]\\:rounded-ui", ["(min-width: 701px)"], 4, [["border-radius", "var(--radius)"]]], [".min-\\[701px\\]\\:px-3", ["(min-width: 701px)"], 4, [["padding-inline", "calc(var(--spacing) * 3)"]]], [".min-\\[701px\\]\\:px-4", ["(min-width: 701px)"], 4, [["padding-inline", "calc(var(--spacing) * 4)"]]], [".min-\\[701px\\]\\:pr-\\[3px\\]", ["(min-width: 701px)"], 4, [["padding-right", "3px"]]], [".min-\\[701px\\]\\:pl-4", ["(min-width: 701px)"], 4, [["padding-left", "calc(var(--spacing) * 4)"]]], [".min-\\[701px\\]\\:text-\\[0\\.62rem\\]", ["(min-width: 701px)"], 4, [["font-size", ".62rem"]]], [".min-\\[701px\\]\\:text-\\[12\\.5px\\]", ["(min-width: 701px)"], 4, [["font-size", "12.5px"]]], [".min-\\[701px\\]\\:text-\\[12px\\]", ["(min-width: 701px)"], 4, [["font-size", "12px"]]], [".min-\\[701px\\]\\:font-medium", ["(min-width: 701px)"], 4, [["--tw-font-weight", "var(--font-weight-medium)"], ["font-weight", "var(--font-weight-medium)"]]], [".min-\\[701px\\]\\:font-semibold", ["(min-width: 701px)"], 4, [["--tw-font-weight", "var(--font-weight-semibold)"], ["font-weight", "var(--font-weight-semibold)"]]], [".min-\\[701px\\]\\:tracking-\\[0\\.045em\\]", ["(min-width: 701px)"], 4, [["--tw-tracking", ".045em"], ["letter-spacing", ".045em"]]], [".min-\\[701px\\]\\:text-subtext-0", ["(min-width: 701px)"], 4, [["color", "var(--subtext-0)"]]], [".min-\\[701px\\]\\:uppercase", ["(min-width: 701px)"], 4, [["text-transform", "uppercase"]]], [".min-\\[900px\\]\\:inline", ["(min-width: 900px)"], 4, [["display", "inline"]]], [".pointer-coarse\\:opacity-100", ["(pointer: coarse)"], 4, [["opacity", "1"]]], [".\\[\\&_\\.mode-switch\\]\\:ml-0 .mode-switch", null, 4, [["margin-left", "0"]]], [".max-\\[700px\\]\\:\\[\\&_button\\]\\:min-h-11 button", ["not all and (min-width: 700px)"], 4, [["min-height", "calc(var(--spacing) * 11)"]]], [".\\[\\&_pre\\]\\:m-\\[0\\.2rem_0_0\\.3rem_1\\.2rem\\] pre", null, 4, [["margin", ".2rem 0 .3rem 1.2rem"]]], [".\\[\\&_pre\\]\\:max-h-72 pre", null, 4, [["max-height", "calc(var(--spacing) * 72)"]]], [".\\[\\&_pre\\]\\:overflow-auto pre", null, 4, [["overflow", "auto"]]], [".\\[\\&_pre\\]\\:rounded-ui pre", null, 4, [["border-radius", "var(--radius)"]]], [".\\[\\&_pre\\]\\:bg-surface-0 pre", null, 4, [["background-color", "var(--surface-0)"]]], [".\\[\\&_pre\\]\\:p-2 pre", null, 4, [["padding", "calc(var(--spacing) * 2)"]]], [".\\[\\&_pre\\]\\:text-\\[0\\.78rem\\] pre", null, 4, [["font-size", ".78rem"]]], [".\\[\\&_pre\\]\\:\\[overflow-wrap\\:anywhere\\] pre", null, 4, [["overflow-wrap", "anywhere"]]], [".\\[\\&_pre\\]\\:whitespace-pre-wrap pre", null, 4, [["white-space", "pre-wrap"]]], [".\\[\\&_pre\\]\\:text-fg pre, .\\[\\&_strong\\]\\:text-fg strong", null, 4, [["color", "var(--text)"]]], [".\\[\\&_summary\\]\\:cursor-pointer summary", null, 4, [["cursor", "pointer"]]], [".\\[\\&\\:hover\\:not\\(\\:disabled\\)\\]\\:bg-surface-1:hover:not(:disabled)", null, 4, [["background-color", "var(--surface-1)"]]], [".\\[\\&\\:hover\\:not\\(\\:disabled\\)\\]\\:text-accent:hover:not(:disabled)", null, 4, [["color", "var(--accent)"]]], [".\\[\\&\\:hover\\:not\\(\\:disabled\\)\\]\\:text-red:hover:not(:disabled)", null, 4, [["color", "var(--red)"]]], [".\\[\\&\\:not\\(\\:has\\(\\[data-setting-row\\]\\)\\)\\>\\[data-none\\]\\]\\:block:not(:has([data-setting-row])) > [data-none]", null, 4, [["display", "block"]]], [".\\[\\&\\>\\*\\]\\:min-h-0 > *", null, 4, [["min-height", "0"]]], [".\\[\\&\\>\\*\\]\\:min-w-0 > *", null, 4, [["min-width", "0"]]], [".\\[\\&\\>\\*\\]\\:flex-1 > *", null, 4, [["flex", "1"]]], [".\\[\\&\\>\\*\\]\\:shrink-0 > *", null, 4, [["flex-shrink", "0"]]], [".\\[\\&\\>li\\]\\:text-\\[0\\.85rem\\] > li", null, 4, [["font-size", ".85rem"]]], [".\\[\\&\\>li\\]\\:leading-\\[1\\.5\\] > li", null, 4, [["--tw-leading", "1.5"], ["line-height", "1.5"]]], [".\\[\\&\\>li\\]\\:text-fg > li", null, 4, [["color", "var(--text)"]]], [".\\[\\&\\>summary\\]\\:flex > summary", null, 4, [["display", "flex"]]], [".\\[\\&\\>summary\\]\\:cursor-pointer > summary", null, 4, [["cursor", "pointer"]]], [".\\[\\&\\>summary\\]\\:list-none > summary", null, 4, [["list-style-type", "none"]]], [".\\[\\&\\>summary\\]\\:items-center > summary", null, 4, [["align-items", "center"]]], [".\\[\\&\\>summary\\]\\:gap-\\[0\\.4rem\\] > summary", null, 4, [["gap", ".4rem"]]], [".\\[\\&\\>summary\\]\\:rounded-ui > summary", null, 4, [["border-radius", "var(--radius)"]]], [".\\[\\&\\>summary\\]\\:px-\\[0\\.4rem\\] > summary", null, 4, [["padding-inline", ".4rem"]]], [".\\[\\&\\>summary\\]\\:py-\\[0\\.25rem\\] > summary", null, 4, [["padding-block", ".25rem"]]], [".\\[\\&\\>summary\\]\\:select-none > summary", null, 4, [["-webkit-user-select", "none"], ["user-select", "none"]]], [".\\[\\&\\>summary\\]\\:before\\:inline-block > summary:before", null, 4, [["content", "var(--tw-content)"], ["display", "inline-block"]]], [".\\[\\&\\>summary\\]\\:before\\:size-\\[0\\.4rem\\] > summary:before", null, 4, [["content", "var(--tw-content)"], ["width", ".4rem"], ["height", ".4rem"]]], [".\\[\\&\\>summary\\]\\:before\\:shrink-0 > summary:before", null, 4, [["content", "var(--tw-content)"], ["flex-shrink", "0"]]], [".\\[\\&\\>summary\\]\\:before\\:\\[transform\\:rotate\\(-45deg\\)\\] > summary:before", null, 4, [["content", "var(--tw-content)"], ["transform", "rotate(-45deg)"]]], [".\\[\\&\\>summary\\]\\:before\\:content-\\[\\'\\'\\] > summary:before", null, 4, [["--tw-content", '""'], ["content", "var(--tw-content)"]]], [".\\[\\&\\>summary\\]\\:before\\:\\[border-bottom\\:1\\.3px_solid_currentColor\\] > summary:before", null, 4, [["content", "var(--tw-content)"], ["border-bottom", "1.3px solid"]]], [".\\[\\&\\>summary\\]\\:before\\:\\[border-right\\:1\\.3px_solid_currentColor\\] > summary:before", null, 4, [["content", "var(--tw-content)"], ["border-right", "1.3px solid"]]], [".\\[\\&\\>summary\\]\\:before\\:\\[transition\\:transform_0\\.15s_ease\\] > summary:before", null, 4, [["content", "var(--tw-content)"], ["transition", "transform .15s"]]], [".\\[\\&\\>summary\\:hover\\]\\:bg-surface-1 > summary:hover", null, 4, [["background-color", "var(--surface-1)"]]], [".\\[\\&\\>summary\\:hover\\]\\:text-fg > summary:hover", null, 4, [["color", "var(--text)"]]], [".\\[\\&\\[open\\]\\>summary\\]\\:before\\:\\[transform\\:rotate\\(45deg\\)\\][open] > summary:before", null, 4, [["content", "var(--tw-content)"], ["transform", "rotate(45deg)"]]], [".app--mobile .\\[\\.app--mobile_\\&\\]\\:min-h-11", null, 4, [["min-height", "calc(var(--spacing) * 11)"]]], [".app--mobile .\\[\\.app--mobile_\\&\\]\\:min-h-\\[44px\\]", null, 4, [["min-height", "44px"]]], [".\\[\\@media\\(hover\\:none\\)\\]\\:opacity-60", ["(hover: none)"], 4, [["opacity", ".6"]]], [".\\[\\@media\\(hover\\:none\\)\\]\\:opacity-100", ["(hover: none)"], 4, [["opacity", "1"]]], [".\\[\\@media\\(max-width\\:700px\\)\\]\\:h-\\[2\\.75rem\\]", ["(max-width: 700px)"], 4, [["height", "2.75rem"]]], [".\\[\\@media\\(max-width\\:700px\\)\\]\\:min-h-\\[2\\.75rem\\]", ["(max-width: 700px)"], 4, [["min-height", "2.75rem"]]], [".\\[\\@media\\(max-width\\:700px\\)\\]\\:w-\\[2\\.75rem\\]", ["(max-width: 700px)"], 4, [["width", "2.75rem"]]], [".\\[\\@media\\(max-width\\:700px\\)\\]\\:min-w-\\[2\\.75rem\\]", ["(max-width: 700px)"], 4, [["min-width", "2.75rem"]]], [".\\[\\@media\\(max-width\\:700px\\)\\]\\:px-\\[0\\.65rem\\]", ["(max-width: 700px)"], 4, [["padding-inline", ".65rem"]]], ["div:hover > .\\[div\\:hover\\>\\&\\]\\:opacity-100", null, 4, [["opacity", "1"]]], [":root", null, 1e3, [["color-scheme", "dark"], ["--scrollbar-size", "6px"], ["--accent", "#c8c8c8"], ["--panel-bg", "#161616"], ["--surface-0", "#262626"], ["--surface-1", "#333"], ["--surface-dim", "#1c1c1c"], ["--backdrop", "#050505"], ["--overlay-0", "#3a3a3a"], ["--overlay-1", "#9b9b9b"], ["--text", "#d8d8d8"], ["--subtext-0", "#9b9b9b"], ["--mauve", "#a993c9"], ["--green", "#7fb685"], ["--yellow", "#d3b46a"], ["--red", "#df8c8c"], ["--blue", "#7aa2d7"], ["--teal", "#7fb8b8"], ["--peach", "#d39a6a"], ["--bg", "var(--panel-bg)"], ["--surface", "var(--surface-0)"], ["--surface-alt", "var(--surface-1)"], ["--border", "var(--overlay-0)"], ["--muted", "var(--subtext-0)"], ["--danger", "var(--red)"], ["--radius", "8px"], ["--radius-pane", "8px"], ["accent-color", "var(--accent)"], ["--font-ui", '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif'], ["--font-mono", `ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono",
    monospace`], ["font-family", "var(--font-ui)"]]], ["code, pre, kbd, samp", null, 1e3, [["font-family", "var(--font-mono)"]]], ["*", null, 1e3, [["box-sizing", "border-box"]]], ["html, body, #root", null, 1e3, [["height", "100%"], ["margin", "0"]]], ["html", null, 1e3, [["overscroll-behavior", "none"], ["--shell-bg", "var(--panel-bg)"]]], ["html[data-glass]", null, 1e3, [["--shell-bg", "var(--panel-bg)"]]], ["html[data-glass]", null, 1e3, [["--shell-bg", "color-mix(in srgb, var(--panel-bg) 86%, transparent)"]]], ["html", null, 1e3, [["--backdrop-bg", "var(--backdrop)"], ["--card-bg", "var(--panel-bg)"]]], ["html[data-glass]", null, 1e3, [["--backdrop-bg", "var(--backdrop)"]]], ["html[data-glass]", null, 1e3, [["--backdrop-bg", "color-mix(in srgb, var(--backdrop) 86%, transparent)"]]], ["html[data-glass]", null, 1e3, [["--card-bg", "var(--panel-bg)"]]], ["html[data-glass]", null, 1e3, [["--card-bg", "color-mix(in srgb, var(--panel-bg) 86%, transparent)"]]], ['body:has(.app--cards, .app--mobile), .app--cards .dock-area:has([data-testid="split-canvas"]:not([data-split="0"]))', null, 1e3, [["background", "var(--backdrop-bg)"]]], ["body", null, 1e3, [["background", "var(--shell-bg)"], ["color", "var(--text)"], ["overscroll-behavior", "none"], ["-webkit-tap-highlight-color", "transparent"], ["line-height", "1.3"]]], [".app", null, 1e3, [["flex-direction", "column"], ["height", "100dvh"], ["display", "flex"]]], [".app--mobile", null, 1e3, [["inset", "var(--visible-top, 0px) 0 auto 0"], ["height", "var(--visible-height, 100dvh)"], ["position", "fixed"]]], [".mobile-drawer-backdrop", null, 1e3, [["animation", ".15s ease-out mobile-fade"]]], [".mobile-drawer--left", null, 1e3, [["animation", ".2s cubic-bezier(.2, .8, .2, 1) mobile-slide-left"]]], [".mobile-drawer--right", null, 1e3, [["animation", ".2s cubic-bezier(.2, .8, .2, 1) mobile-slide-right"]]], [".mobile-sheet", null, 1e3, [["animation", ".22s cubic-bezier(.2, .8, .2, 1) mobile-rise"]]], [".mobile-drawer-backdrop, .mobile-drawer, .mobile-sheet", ["(prefers-reduced-motion: reduce)"], 1e3, [["animation", "none"]]], [".layout-drawer", null, 1e3, [["transform", "translateX(var(--float-hide, 0))"], ["transition", "transform .18s"]]], [".layout-drawer:hover, .layout-drawer:focus-within", null, 1e3, [["--float-hide", "0px"]]], [".dockview-theme-perch", null, 1e3, [["--dv-color-abyss-dark", "var(--panel-bg)"], ["--dv-color-abyss", "var(--surface-0)"], ["--dv-color-abyss-light", "var(--surface-1)"], ["--dv-color-abyss-lighter", "var(--overlay-0)"], ["--dv-color-abyss-accent", "var(--accent)"], ["--dv-color-abyss-primary-text", "var(--text)"], ["--dv-color-abyss-secondary-text", "var(--subtext-0)"], ["--dv-group-view-background-color", "var(--panel-bg)"], ["--dv-tabs-and-actions-container-background-color", "var(--surface-0)"], ["--dv-activegroup-visiblepanel-tab-background-color", "var(--panel-bg)"], ["--dv-activegroup-hiddenpanel-tab-background-color", "var(--surface-0)"], ["--dv-inactivegroup-visiblepanel-tab-background-color", "var(--panel-bg)"], ["--dv-inactivegroup-hiddenpanel-tab-background-color", "var(--surface-0)"], ["--dv-tab-divider-color", "var(--overlay-0)"], ["--dv-activegroup-visiblepanel-tab-color", "var(--text)"], ["--dv-activegroup-hiddenpanel-tab-color", "var(--subtext-0)"], ["--dv-inactivegroup-visiblepanel-tab-color", "var(--subtext-0)"], ["--dv-inactivegroup-hiddenpanel-tab-color", "var(--subtext-0)"], ["--dv-separator-border", "var(--overlay-0)"], ["--dv-paneview-header-border-color", "var(--overlay-0)"], ["--dv-tabs-and-actions-container-font-size", ".82rem"], ["--dv-tabs-and-actions-container-height", "2.1rem"]]], [".dockview-theme-perch .dv-tabs-and-actions-container", null, 1e3, [["z-index", "1"], ["position", "relative"]]], [".pane-tab", null, 1e3, [["align-items", "center"], ["width", "100%"], ["height", "100%"], ["display", "flex"]]], [".pane-tab__agent-badge", null, 1e3, [["color", "var(--subtext-0)"], ["white-space", "nowrap"], ["flex-shrink", "0"], ["margin-right", ".4rem"], ["font-size", ".78em"]]], ['.pane-tab[data-testid="pane-tab-chat"] .dv-default-tab-action', null, 1e3, [["display", "none"]]], [".dockview-group-action", null, 1e3, [["border-radius", "var(--radius)"], ["width", "1.5rem"], ["height", "1.5rem"], ["color", "var(--subtext-0)"], ["cursor", "pointer"], ["background", "none"], ["border", "none"], ["justify-content", "center"], ["align-self", "center"], ["align-items", "center"], ["margin", "0 .15rem"], ["font-size", "1rem"], ["line-height", "1"], ["transition", "color .1s, background .1s"], ["display", "flex"]]], [".dockview-group-action:hover", null, 1e3, [["color", "var(--text)"], ["background", "var(--surface-1)"]]], [".dockview-theme-perch .dv-view-container > .dv-view:has(.dv-inactive-group)", ["(max-width: 700px)"], 1e3, [["display", "none"]]], [".dockview-theme-perch .dv-view-container > .dv-view:has(.dv-active-group)", ["(max-width: 700px)"], 1e3, [["width", "100%", 1], ["left", "0", 1]]], [".chat", null, 1e3, [["isolation", "isolate"], ["flex-direction", "column"], ["flex", "1"], ["height", "100%"], ["min-height", "0"], ["display", "flex"]]], [".message__markdown p", null, 1e3, [["margin", "0 0 .5em"]]], [".message__markdown p:last-child", null, 1e3, [["margin-bottom", "0"]]], [".message__markdown h1, .message__markdown h2, .message__markdown h3, .message__markdown h4", null, 1e3, [["margin", ".6em 0 .3em"], ["line-height", "1.25"]]], [".message__markdown h1", null, 1e3, [["font-size", "1.25em"]]], [".message__markdown h2", null, 1e3, [["font-size", "1.12em"]]], [".message__markdown h3", null, 1e3, [["font-size", "1em"]]], [".message__markdown > * + *", null, 1e3, [["margin-top", ".5em"]]], [".message__markdown table, .md-table", null, 1e3, [["border-collapse", "separate"], ["border-spacing", "0"], ["background", "var(--surface-0)"], ["border-radius", "var(--radius)"], ["max-width", "100%"], ["margin", ".5em 0"], ["font-size", ".92em"], ["display", "block"], ["overflow-x", "auto"]]], [".md-table", null, 1e3, [["width", "100%"], ["margin", "0"], ["display", "table"]]], [".message__markdown th, .message__markdown td, .md-table th, .md-table td", null, 1e3, [["text-align", "left"], ["vertical-align", "top"], ["border-bottom", "1px solid var(--surface-1)"], ["padding", ".35em .75em"]]], [".message__markdown th, .md-table th", null, 1e3, [["color", "var(--subtext-0)"], ["white-space", "nowrap"], ["background", "var(--surface-1)"], ["font-weight", "600"]]], [".message__markdown tbody tr:last-child td, .md-table tbody tr:last-child td", null, 1e3, [["border-bottom", "0"]]], [".message__markdown tbody tr:hover td, .md-table tbody tr:hover td", null, 1e3, [["background", "var(--surface-1)"]]], [".md-table caption", null, 1e3, [["text-align", "left"], ["color", "var(--subtext-0)"], ["padding", ".4em .75em"]]], [".md-code", null, 1e3, [["background", "var(--surface-0)"], ["border-radius", "var(--radius)"], ["overflow", "hidden"]]], [".md-code__bar", null, 1e3, [["color", "var(--subtext-0)"], ["background", "var(--surface-1)"], ["justify-content", "space-between"], ["align-items", "center"], ["padding", ".1rem .4rem .1rem .75rem"], ["font-size", ".75em"], ["display", "flex"]]], [".message__markdown .md-code pre", null, 1e3, [["background", "none"], ["border-radius", "0"], ["margin", "0"]]], [".hl-keyword", null, 1e3, [["color", "var(--mauve)"]]], [".hl-string", null, 1e3, [["color", "var(--green)"]]], [".hl-number", null, 1e3, [["color", "var(--peach)"]]], [".hl-function", null, 1e3, [["color", "var(--blue)"]]], [".hl-type", null, 1e3, [["color", "var(--yellow)"]]], [".hl-tag", null, 1e3, [["color", "var(--teal)"]]], [".hl-comment", null, 1e3, [["color", "var(--overlay-1)"], ["font-style", "italic"]]], [".message__markdown ul, .message__markdown ol", null, 1e3, [["margin", ".3em 0 .5em 1.3em"], ["padding", "0"]]], [".message__markdown li", null, 1e3, [["margin-bottom", ".2em"]]], [".message__markdown code", null, 1e3, [["background", "var(--surface-0)"], ["border-radius", ".25rem"], ["padding", ".1em .35em"], ["font-family", "ui-monospace, SFMono-Regular, SF Mono, Menlo, Consolas, monospace"], ["font-size", ".88em"]]], [".message__markdown pre", null, 1e3, [["background", "var(--surface-0)"], ["border-radius", "var(--radius)"], ["margin", ".4em 0"], ["padding", ".6rem .75rem"], ["position", "relative"], ["overflow-x", "auto"]]], [".message__markdown pre code", null, 1e3, [["background", "none"], ["border", "none"], ["padding", "0"], ["font-size", ".85em"]]], [".message__markdown a", null, 1e3, [["color", "var(--accent)"], ["text-decoration", "underline"]]], [".message__markdown blockquote", null, 1e3, [["border-left", "3px solid var(--overlay-0)"], ["color", "var(--subtext-0)"], ["margin", ".4em 0"], ["padding", ".1em .6em"]]], [".message__markdown hr", null, 1e3, [["border", "none"], ["border-top", "1px solid var(--overlay-0)"], ["margin", ".75em 0"]]], [".file-markdown", null, 1e3, [["overflow-wrap", "anywhere"]]], [".file-markdown img", null, 1e3, [["max-width", "100%"]]], [".file-markdown table", null, 1e3, [["border-collapse", "collapse"], ["margin", ".4em 0"], ["display", "block"], ["overflow-x", "auto"]]], [".file-markdown th, .file-markdown td", null, 1e3, [["border", "1px solid var(--overlay-0)"], ["padding", ".2em .5em"]]], [".file-markdown .md-placeholder", null, 1e3, [["color", "var(--subtext-0)"], ["border", "1px dashed var(--overlay-0)"], ["border-radius", ".25rem"], ["padding", ".05em .35em"], ["font-size", ".9em"]]], [".terminal", null, 1e3, [["min-width", "0"], ["min-height", "0"], ["padding", "var(--terminal-padding, 0)"], ["opacity", "var(--terminal-opacity, 1)"], ["flex", "1"], ["display", "flex"], ["position", "relative"]]], [".terminal__surface", null, 1e3, [["flex", "1"], ["min-width", "0"], ["min-height", "0"], ["overflow", "hidden"]]], [".terminal__surface .xterm", null, 1e3, [["height", "100%"]]], [".terminal__surface .xterm:not(.allow-transparency) .xterm-viewport", null, 1e3, [["background-color", "#0000"]]], [".terminal__surface .xterm-scrollable-element", null, 1e3, [["position", "static", 1]]], [".terminal__surface .xterm-decoration-overview-ruler, .no-pane-scrollbars .terminal__surface .xterm-scrollable-element > .xterm-scrollbar", null, 1e3, [["display", "none"]]], [".terminal--persistent", null, 1e3, [["flex-direction", "column"]]], [".terminal__toolbar", null, 1e3, [["color", "var(--subtext-0)"], ["align-items", "center"], ["gap", ".5rem"], ["padding", ".25rem 1.5rem .25rem .5rem"], ["font-size", ".8rem"], ["display", "flex"]]], [".terminal__toolbar button", null, 1e3, [["border-radius", "var(--radius)"], ["min-height", "32px"], ["color", "var(--text)"], ["background", "var(--surface-0)"], ["border", "0"], ["padding", ".25rem .5rem"]]], [".terminal__toolbar--overlay", null, 1e3, [["z-index", "2"], ["border-radius", "var(--radius)"], ["background", "var(--surface-1)"], ["padding", ".2rem .3rem .2rem .6rem"], ["position", "absolute"], ["top", ".4rem"], ["right", ".9rem"], ["box-shadow", "0 2px 8px #00000040"]]], [".terminal__connection", null, 1e3, [["margin-right", "auto"]]], [".terminal__toolbar button:disabled", null, 1e3, [["opacity", ".5"]]], [".terminal__notice", null, 1e3, [["color", "var(--subtext-0)"], ["padding", ".75rem"], ["font-size", ".85rem"]]], [".app--mobile .terminal__toolbar button", null, 1e3, [["min-height", "44px"]]], [".app--mobile .terminal__connection", null, 1e3, [["display", "none"]]], [".app--mobile .terminal__toolbar", null, 1e3, [["padding-right", ".5rem"]]], [".terminal__exited", null, 1e3, [["background", "var(--surface-1)"], ["border-radius", "var(--radius)"], ["color", "var(--subtext-0)"], ["padding", ".35rem .75rem"], ["font-size", ".85rem"], ["position", "absolute"], ["bottom", ".75rem"], ["left", "50%"], ["transform", "translateX(-50%)"]]], [".terminal__exited--cli", null, 1e3, [["background", "var(--panel-bg)"], ["flex-direction", "column"], ["align-items", "center"], ["gap", ".6rem"], ["padding", ".9rem 1.1rem"], ["display", "flex"], ["top", "50%"], ["bottom", "auto"], ["transform", "translate(-50%, -50%)"], ["box-shadow", "0 6px 24px #00000059"]]], [".terminal__exited-actions", null, 1e3, [["gap", ".5rem"], ["display", "flex"]]], [".terminal__cli-error", null, 1e3, [["background", "var(--red)"], ["position", "absolute"], ["bottom", ".75rem"], ["left", "50%"], ["transform", "translateX(-50%)"]]], [".terminal__cli-error", null, 1e3, [["background", "color-mix(in srgb, var(--red) 20%, var(--panel-bg))"]]], [".terminal__cli-error", null, 1e3, [["border-radius", "var(--radius)"], ["color", "var(--red)"], ["text-align", "center"], ["white-space", "pre-wrap"], ["word-break", "break-word"], ["max-width", "90%"], ["padding", ".35rem .75rem"], ["font-size", ".85rem"]]], [".mobile-pane-shell__content > .chat, .mobile-pane-shell__content > .terminal, .mobile-pane-shell__content > .workspace-files, .mobile-pane-shell__content > .workspace-git", null, 1e3, [["flex", "1"], ["width", "100%"], ["min-width", "0"], ["height", "100%"], ["min-height", "0"]]], [".terminal__host", null, 1e3, [["width", "100%"], ["height", "100%"], ["overflow", "hidden"]]], [".workspace-git", null, 1e3, [["--git-border", "var(--overlay-0)"]]], [".workspace-git", null, 1e3, [["--git-border", "color-mix(in srgb, var(--overlay-0) 72%, transparent)"]]], [".workspace-git", null, 1e3, [["--git-muted", "var(--subtext-0)"], ["width", "100%"], ["min-width", "0"], ["height", "100%"], ["min-height", "0"], ["color", "var(--text)"], ["background", "var(--workspace-tools-bg, var(--panel-bg))"], ["flex-direction", "column"], ["font-size", ".78rem"], ["display", "flex"], ["position", "relative"], ["overflow", "hidden"], ["container-type", "inline-size"]]], [".workspace-git button, .workspace-git input, .workspace-git textarea", null, 1e3, [["font", "inherit"]]], [".workspace-git button", null, 1e3, [["cursor", "pointer"]]], ['.workspace-git button:focus-visible, .workspace-git input:focus-visible, .workspace-git textarea:focus-visible, .workspace-git [role="button"]:focus-visible', null, 1e3, [["outline", "2px solid var(--accent)"], ["outline-offset", "1px"]]], [".workspace-git__diff", null, 1e3, [["container-type", "inline-size"]]], [".workspace-git__line-comment-thread", null, 1e3, [["max-width", "max(0px, min(42rem, 100cqi - 6.9rem))"], ["position", "sticky"], ["left", "0"]]], [".workspace-git__comment-composer", null, 1e3, [["max-width", "max(0px, 100cqi - 1.4rem)"], ["position", "sticky"], ["left", "0"]]], [".dockview-group-action--split-session", null, 1e3, [["font-size", "13px"]]], [".session-split-popover", null, 1e3, [["display", "flex"], ["flex-direction", "column"], ["background", "var(--surface-1)"], ["border-radius", "var(--radius)"], ["box-shadow", "0 8px 24px rgba(0, 0, 0, 0.45)"], ["padding", "4px"], ["font-size", "12.5px"], ["color", "var(--text)"], ["overflow", "hidden"]]], [".session-split-popover__header", null, 1e3, [["padding", "6px 8px 4px"], ["font-size", "11px"], ["text-transform", "uppercase"], ["letter-spacing", "0.04em"], ["color", "var(--subtext-0)"]]], [".session-split-popover__empty", null, 1e3, [["padding", "8px"], ["color", "var(--subtext-0)"]]], [".session-split-popover__list", null, 1e3, [["overflow-y", "auto"]]], [".session-split-popover__item", null, 1e3, [["display", "flex"], ["flex-direction", "column"], ["align-items", "flex-start"], ["gap", "1px"], ["width", "100%"], ["padding", "6px 8px"], ["border", "none"], ["border-radius", "4px"], ["background", "transparent"], ["color", "inherit"], ["text-align", "left"], ["cursor", "grab"]]], [".session-split-popover__item:hover", null, 1e3, [["background", "var(--surface-0)"]]], [".session-split-popover__item-title", null, 1e3, [["font-weight", "500"], ["white-space", "nowrap"], ["overflow", "hidden"], ["text-overflow", "ellipsis"], ["max-width", "100%"]]], [".session-split-popover__item-cwd", null, 1e3, [["font-size", "11px"], ["color", "var(--subtext-0)"], ["white-space", "nowrap"], ["overflow", "hidden"], ["text-overflow", "ellipsis"], ["max-width", "100%"]]], [".session-split-popover__item-badge", null, 1e3, [["align-self", "flex-end"], ["font-size", "10px"], ["color", "var(--accent)"], ["margin-top", "-14px"]]], [".inactive-session-pane", null, 1e3, [["display", "flex"], ["flex-direction", "column"], ["align-items", "center"], ["justify-content", "center"], ["gap", "10px"], ["height", "100%"], ["padding", "24px"], ["text-align", "center"], ["color", "var(--subtext-0)"]]], [".inactive-session-pane__title", null, 1e3, [["font-size", "14px"], ["font-weight", "500"], ["color", "var(--text)"]]], [".inactive-session-pane__cwd", null, 1e3, [["font-size", "12px"], ["color", "var(--subtext-0)"], ["word-break", "break-all"]]], [".inactive-session-pane__note", null, 1e3, [["font-size", "12px"], ["max-width", "320px"], ["line-height", "1.5"]]], [".inactive-session-pane__switch", null, 1e3, [["margin-top", "4px"], ["padding", "6px 14px"], ["border-radius", "var(--radius)"], ["border", "0"], ["background", "var(--surface-0)"], ["color", "var(--text)"], ["cursor", "pointer"], ["font-size", "12.5px"]]], [".inactive-session-pane__switch:hover", null, 1e3, [["background", "var(--surface-1)"]]]], skipped: { "@supports evaluated false": 2, "@container": 6, "@keyframes": 9 } };
//! The app's compiled stylesheet as a table (`build.mjs` writes it from Vite + Tailwind's output and bundles it as
//! `virtual:perch-css-table`), parsed once on first use.
let yg = null;
const xg = () => yg ??= new D0(vg);
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
function wg(a, l) {
  const s = /* @__PURE__ */ new Set([...Object.keys(a), ...Object.keys(l)]);
  for (const i of s) {
    if (i === "children") continue;
    const o = a[i], d = l[i];
    if (!(o === d || typeof o == "function" && typeof d == "function") && !(i === "style" && o && d && typeof o == "object" && typeof d == "object" && [.../* @__PURE__ */ new Set([...Object.keys(o), ...Object.keys(d)])].every((f) => o[f] === d[f])))
      return !0;
  }
  return !1;
}
const _g = (a) => !a.props.disabled && (/^(button|input|select|textarea)$/.test(a.tagName) || a.tagName === "a" && a.props.href != null || a.props.tabIndex != null);
function Jd(a, l) {
  for (const s of Ph(l.dangerouslySetInnerHTML?.__html, a.ownerDocument) ?? []) a.appendChild(s);
  return a;
}
const Sg = {
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
  createInstance: (a, l, s) => Jd(new It(a, l, s.ownerDocument), l),
  createTextInstance: (a, l) => new $r(a),
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
      Jd(a, i);
    }
    wg(s, i) && a.touch();
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
}, ze = w0(Sg), Pr = (a, l, s = null) => ze.createPortal(a, l, null, s), kg = {
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
}, Eg = /* @__PURE__ */ new Set(["click", "dblclick", "mousedown", "mouseup"]), zg = /* @__PURE__ */ new Set(["button", "input", "select", "textarea", "fieldset"]), Ng = (a) => {
  for (let l = a; l instanceof It; l = l.parentNode) if (l.props.disabled && zg.has(l.tagName)) return !0;
  return !1;
};
class Tg {
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
    const i = kg[l.type], o = i && a.props[s ? `${i}Capture` : i];
    typeof o == "function" && o(l);
  }
}
function sy(a, l, s = {}) {
  const { document: i, window: o, globals: d } = l0(a), m = new It("div", { id: "root", style: s.container ?? {} }, i);
  i.body.appendChild(m);
  const f = [];
  let p = null;
  const x = () => [i, o].map((R) => R.listeners.map((g) => `${g.type}:${g.capture}`).sort().join(",")).join("|");
  let k = "";
  const E = {}, w = `m${Math.random().toString(36).slice(2, 10)}:`;
  let N = 0, S = -1;
  i.measureKey = (R) => w + R.id, i.stale = () => S !== N, i.computed = (R) => {
    if (!E.cascade || !E.top) return null;
    const g = [];
    for (let h = R; h instanceof It && h !== i.body; h = h.parentNode) g.unshift(h);
    let v = E.top;
    for (const h of g) v = E.cascade.compute(h, v);
    return v.values;
  };
  const y = () => (N += 1, p = bg(i, a, xg(), E, s.names), k = x(), a.render?.(p), p), z = () => {
    ze.flushPassiveEffects(), ze.flushSyncWork(), x() !== k && y();
  };
  i.afterCommit = y;
  const O = (R) => {
    f.push(R), a.error?.(R);
  }, D = ze.createContainer(m, El.ConcurrentRoot, null, !1, null, "", O, O, O, null);
  ze.updateContainerSync(dt.createElement(l, s.props ?? {}), D, null, null), ze.flushSyncWork(), z();
  const A = (R) => {
    const g = (v) => {
      if (v.id === R) return v;
      for (const h of v.children) {
        const _ = g(h);
        if (_) return _;
      }
      return null;
    };
    return g(i.documentElement);
  }, X = (R) => {
    const g = sa;
    sa = El.DiscreteEventPriority;
    try {
      return R();
    } finally {
      sa = g, ze.flushSyncWork(), z();
    }
  }, U = {
    document: i,
    window: o,
    /** What `window`, `document` and `localStorage` read while this screen runs (`dom.mjs`'s `GLOBALS`). */
    globals: d,
    container: m,
    errors: f,
    /** The latest description (after the last commit or state change). */
    get description() {
      return p;
    },
    describe: y,
    /** Runs a DOM event of `type` at node `id`; false when the node is gone. */
    dispatch(R, g, v = {}) {
      const h = typeof R == "string" ? A(R) : R;
      if (!h || Eg.has(g) && Ng(h)) return !1;
      const _ = new Tg(g, v, h), M = [];
      for (let I = h; I; I = I.parentNode) M.push(I);
      const B = [...M, i, o];
      X(() => {
        for (let I = B.length - 1; I > 0 && !_.propagationStopped; I--) Mr(B[I], _, !0);
        _.propagationStopped || (Mr(h, _, !0), _.propagationStopped || Mr(h, _, !1));
        for (let I = 1; I < B.length && !_.propagationStopped; I++) Mr(B[I], _, !1);
      });
      const L = g === "click" && !_.defaultPrevented ? ts(h) : null;
      if (L && U.dispatch(L, "submit", {}), g === "click" && !_.defaultPrevented)
        for (let I = h; I; I = I.parentNode) {
          if (I.tagName !== "a") continue;
          const $ = I.props?.href;
          typeof $ == "string" && /^https:\/\/\S+$/.test($) && a.openLink?.($);
          break;
        }
      return !_.defaultPrevented;
    },
    /** Whether the source listens for `type` on `window` or `document` (a page recording a key press does). */
    listensFor: (R) => [i, o].some((g) => g.listeners.some((v) => v.type === R)),
    /** A key pressed while the screen has the keyboard (`init`: the DOM's `key`, modifiers, `repeat`), at the
     * focused element. When nothing prevented it and that element is a text field, the key edits the field as a
     * browser would: a character is typed at the end (or replaces the text when all of it is selected), Backspace
     * deletes the last one, and the field gets `input` and `change` events with its new `value`. Returns whether the
     * source took the key (prevented it, or a field changed). */
    key(R) {
      const g = i.activeElement && i.activeElement !== i.body ? i.activeElement : i.body;
      if (!U.dispatch(g, "keydown", R)) return !0;
      const h = R.key === "Enter" && !R.isComposing ? ts(g, !0) : null;
      if (h)
        return U.dispatch(h, "submit", {}), !0;
      if (!Sf(g) || g.props.disabled || g.props.readOnly) return !1;
      if ((R.ctrlKey || R.metaKey) && !R.altKey && !R.shiftKey && R.key.toLowerCase() === "a")
        return g.selectedAll = !0, !0;
      if (R.ctrlKey || R.metaKey) return !1;
      const _ = g.selectedAll;
      g.selectedAll = !1;
      const M = g.value, L = R.key === "Backspace" || _ && R.key === "Delete" ? _ ? "" : M.slice(0, -1) : [...R.key].length === 1 ? (_ ? "" : M) + R.key : M;
      return L === M ? !1 : (g.value = L, U.dispatch(g, "input", { data: R.key }), U.dispatch(g, "change", {}), g.props.value !== void 0 && delete g.edit, g.touch(), y(), !0);
    },
    /** The engine's box for node `id` (window coordinates, logical px), for `getBoundingClientRect`. */
    setBounds(R, g) {
      const v = A(R);
      v && (v.bounds = { x: g.x, y: g.y, width: g.width, height: g.height });
    },
    /** A click on a check box or radio button (`id`): the `click` event, then, unless the source prevented it, the
     * box ticked as a browser ticks it (a radio button only on), with `input` and `change` events. */
    toggle(R) {
      const g = A(R);
      if (!g || g.props.disabled || !U.dispatch(R, "click", { button: 0, detail: 1 })) return;
      const v = g.props.type === "radio";
      v && g.checked || (g.checked = v ? !0 : !g.checked, U.dispatch(R, "input", {}), U.dispatch(R, "change", {}), g.props.checked !== void 0 && delete g.ticked, g.touch(), y());
    },
    /** A left click as the engine reports one: press then release on the same node. */
    click(R, g = {}) {
      const v = { button: 0, buttons: 1, pointerType: "mouse", ...g };
      for (const h of ["pointerdown", "mousedown", "pointerup", "mouseup", "click"]) U.dispatch(R, h, v);
    },
    /** The pointer entered (`on`) or left node `id` (one the description marks `track_hover`): its `:hover` state,
     * which a descendant's group variant reads. The element's own `hover:` styles are the engine's hover style. */
    /** Whether the pointer is over node `id`, as `hover` last said. */
    hovered: (R) => !!A(R)?.state.hover,
    hover(R, g) {
      const v = A(R);
      !v || v.state.hover === g || (v.state.hover = g, v.touch(), y());
    },
    focus(R) {
      const g = A(R);
      g && (X(() => {
        const v = i.activeElement;
        v && v !== g && v !== i.body && U.dispatch(v, "blur"), i.focus(g), U.dispatch(g, "focus");
      }), y());
    },
    /** A press at node `id` that nothing prevented: the browser's default focuses the element pressed. Only an element
     * that listens for keys (`onKeyDown`) is focused, so a press elsewhere leaves the keyboard where it was; the focus
     * is not `:focus-visible`, as after a pointer press in a browser. */
    // ponytail: a browser focuses every focusable element pressed; here only one with its own key handler, so a
    // screen's ordinary buttons do not take the keyboard from a terminal.
    pressFocus(R) {
      let v = typeof R == "string" ? A(R) : R;
      for (; v && !(v instanceof It && typeof v.props.onKeyDown == "function" && _g(v)); ) v = v.parentNode;
      !v || v === i.activeElement || (U.focus(v.id), v.state.pointerFocus = !0, v.touch(), y());
    },
    /** The engine is drawing the latest description: the boxes measured in this frame's layout are the tree's.
     * Returns whether effects wait for that layout (`measured`); run them with `retry` once the frame is drawn. */
    drawing() {
      return S = N, i.retries.length > 0;
    },
    /** Runs the effects that waited for a fresh layout. */
    retry() {
      const R = i.retries.splice(0);
      for (const g of R) g();
    },
    /** Runs effects React has scheduled (the engine calls it after a frame). */
    flush: z,
    update(R) {
      ze.updateContainerSync(dt.createElement(l, R ?? {}), D, null, null), ze.flushSyncWork(), z();
    },
    unmount() {
      ze.updateContainerSync(null, D, null, null), ze.flushSyncWork(), ze.flushPassiveEffects(), i.afterCommit = null, i.retries.length = 0, a.forgetBounds?.(w);
    }
  };
  return U;
}
//! `react-dom` for a screen on the native renderer: `createPortal` (into `document.body`, the overlay layer) and
//! `flushSync`. Nothing of the browser renderer.
const Bf = (a) => ze.flushSyncFromReconciler(a), Cg = { createPortal: Pr, flushSync: Bf }, cy = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  createPortal: Pr,
  default: Cg,
  flushSync: Bf
}, Symbol.toStringTag, { value: "Module" }));
function Hf(a) {
  var l, s, i = "";
  if (typeof a == "string" || typeof a == "number") i += a;
  else if (typeof a == "object") if (Array.isArray(a)) {
    var o = a.length;
    for (l = 0; l < o; l++) a[l] && (s = Hf(a[l])) && (i && (i += " "), i += s);
  } else for (s in a) a[s] && (i && (i += " "), i += s);
  return i;
}
function Uf() {
  for (var a, l, s = 0, i = "", o = arguments.length; s < o; s++) (a = arguments[s]) && (l = Hf(a)) && (i && (i += " "), i += l);
  return i;
}
const Mg = (a, l) => {
  const s = new Array(a.length + l.length);
  for (let i = 0; i < a.length; i++)
    s[i] = a[i];
  for (let i = 0; i < l.length; i++)
    s[a.length + i] = l[i];
  return s;
}, Ag = (a, l) => ({
  classGroupId: a,
  validator: l
}), qf = (a = /* @__PURE__ */ new Map(), l = null, s) => ({
  nextPart: a,
  validators: l,
  classGroupId: s
}), Zr = "-", Wd = [], jg = "arbitrary..", Og = (a) => {
  const l = Dg(a), {
    conflictingClassGroups: s,
    conflictingClassGroupModifiers: i
  } = a;
  return {
    getClassGroupId: (m) => {
      if (m.startsWith("[") && m.endsWith("]"))
        return Rg(m);
      const f = m.split(Zr), p = f[0] === "" && f.length > 1 ? 1 : 0;
      return Yf(f, p, l);
    },
    getConflictingClassGroupIds: (m, f) => {
      if (f) {
        const p = i[m], x = s[m];
        return p ? x ? Mg(x, p) : p : x || Wd;
      }
      return s[m] || Wd;
    }
  };
}, Yf = (a, l, s) => {
  if (a.length - l === 0)
    return s.classGroupId;
  const o = a[l], d = s.nextPart.get(o);
  if (d) {
    const x = Yf(a, l + 1, d);
    if (x) return x;
  }
  const m = s.validators;
  if (m === null)
    return;
  const f = l === 0 ? a.join(Zr) : a.slice(l).join(Zr), p = m.length;
  for (let x = 0; x < p; x++) {
    const k = m[x];
    if (k.validator(f))
      return k.classGroupId;
  }
}, Rg = (a) => a.slice(1, -1).indexOf(":") === -1 ? void 0 : (() => {
  const l = a.slice(1, -1), s = l.indexOf(":"), i = l.slice(0, s);
  return i ? jg + i : void 0;
})(), Dg = (a) => {
  const {
    theme: l,
    classGroups: s
  } = a;
  return Bg(s, l);
}, Bg = (a, l) => {
  const s = qf();
  for (const i in a) {
    const o = a[i];
    xs(o, s, i, l);
  }
  return s;
}, xs = (a, l, s, i) => {
  const o = a.length;
  for (let d = 0; d < o; d++) {
    const m = a[d];
    Hg(m, l, s, i);
  }
}, Hg = (a, l, s, i) => {
  if (typeof a == "string") {
    Ug(a, l, s);
    return;
  }
  if (typeof a == "function") {
    qg(a, l, s, i);
    return;
  }
  Yg(a, l, s, i);
}, Ug = (a, l, s) => {
  const i = a === "" ? l : Gf(l, a);
  i.classGroupId = s;
}, qg = (a, l, s, i) => {
  if (Gg(a)) {
    xs(a(i), l, s, i);
    return;
  }
  l.validators === null && (l.validators = []), l.validators.push(Ag(s, a));
}, Yg = (a, l, s, i) => {
  const o = Object.entries(a), d = o.length;
  for (let m = 0; m < d; m++) {
    const [f, p] = o[m];
    xs(p, Gf(l, f), s, i);
  }
}, Gf = (a, l) => {
  let s = a;
  const i = l.split(Zr), o = i.length;
  for (let d = 0; d < o; d++) {
    const m = i[d];
    let f = s.nextPart.get(m);
    f || (f = qf(), s.nextPart.set(m, f)), s = f;
  }
  return s;
}, Gg = (a) => "isThemeGetter" in a && a.isThemeGetter === !0, Kg = (a) => {
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
}, os = "!", Fd = ":", Qg = [], Id = (a, l, s, i, o) => ({
  modifiers: a,
  hasImportantModifier: l,
  baseClassName: s,
  maybePostfixModifierPosition: i,
  isExternal: o
}), Vg = (a) => {
  const {
    prefix: l,
    experimentalParseClassName: s
  } = a;
  let i = (o) => {
    const d = [];
    let m = 0, f = 0, p = 0, x;
    const k = o.length;
    for (let y = 0; y < k; y++) {
      const z = o[y];
      if (m === 0 && f === 0) {
        if (z === Fd) {
          d.push(o.slice(p, y)), p = y + 1;
          continue;
        }
        if (z === "/") {
          x = y;
          continue;
        }
      }
      z === "[" ? m++ : z === "]" ? m-- : z === "(" ? f++ : z === ")" && f--;
    }
    const E = d.length === 0 ? o : o.slice(p);
    let w = E, N = !1;
    E.endsWith(os) ? (w = E.slice(0, -1), N = !0) : (
      /**
       * In Tailwind CSS v3 the important modifier was at the start of the base class name. This is still supported for legacy reasons.
       * @see https://github.com/dcastil/tailwind-merge/issues/513#issuecomment-2614029864
       */
      E.startsWith(os) && (w = E.slice(1), N = !0)
    );
    const S = x && x > p ? x - p : void 0;
    return Id(d, N, w, S);
  };
  if (l) {
    const o = l + Fd, d = i;
    i = (m) => m.startsWith(o) ? d(m.slice(o.length)) : Id(Qg, !1, m, void 0, !0);
  }
  if (s) {
    const o = i;
    i = (d) => s({
      className: d,
      parseClassName: o
    });
  }
  return i;
}, Xg = (a) => {
  const l = /* @__PURE__ */ new Map();
  return a.orderSensitiveModifiers.forEach((s, i) => {
    l.set(s, 1e6 + i);
  }), (s) => {
    const i = [];
    let o = [];
    for (let d = 0; d < s.length; d++) {
      const m = s[d], f = m[0] === "[", p = l.has(m);
      f || p ? (o.length > 0 && (o.sort(), i.push(...o), o = []), i.push(m)) : o.push(m);
    }
    return o.length > 0 && (o.sort(), i.push(...o)), i;
  };
}, Lg = (a) => ({
  cache: Kg(a.cacheSize),
  parseClassName: Vg(a),
  sortModifiers: Xg(a),
  postfixLookupClassGroupIds: Zg(a),
  ...Og(a)
}), Zg = (a) => {
  const l = /* @__PURE__ */ Object.create(null), s = a.postfixLookupClassGroups;
  if (s)
    for (let i = 0; i < s.length; i++)
      l[s[i]] = !0;
  return l;
}, Jg = /\s+/, Wg = (a, l) => {
  const {
    parseClassName: s,
    getClassGroupId: i,
    getConflictingClassGroupIds: o,
    sortModifiers: d,
    postfixLookupClassGroupIds: m
  } = l, f = [], p = a.trim().split(Jg);
  let x = "";
  for (let k = p.length - 1; k >= 0; k -= 1) {
    const E = p[k], {
      isExternal: w,
      modifiers: N,
      hasImportantModifier: S,
      baseClassName: y,
      maybePostfixModifierPosition: z
    } = s(E);
    if (w) {
      x = E + (x.length > 0 ? " " + x : x);
      continue;
    }
    let O = !!z, D;
    if (O) {
      const g = y.substring(0, z);
      D = i(g);
      const v = D && m[D] ? i(y) : void 0;
      v && v !== D && (D = v, O = !1);
    } else
      D = i(y);
    if (!D) {
      if (!O) {
        x = E + (x.length > 0 ? " " + x : x);
        continue;
      }
      if (D = i(y), !D) {
        x = E + (x.length > 0 ? " " + x : x);
        continue;
      }
      O = !1;
    }
    const A = N.length === 0 ? "" : N.length === 1 ? N[0] : d(N).join(":"), X = S ? A + os : A, U = X + D;
    if (f.indexOf(U) > -1)
      continue;
    f.push(U);
    const R = o(D, O);
    for (let g = 0; g < R.length; ++g) {
      const v = R[g];
      f.push(X + v);
    }
    x = E + (x.length > 0 ? " " + x : x);
  }
  return x;
}, Fg = (...a) => {
  let l = 0, s, i, o = "";
  for (; l < a.length; )
    (s = a[l++]) && (i = Kf(s)) && (o && (o += " "), o += i);
  return o;
}, Kf = (a) => {
  if (typeof a == "string")
    return a;
  let l, s = "";
  for (let i = 0; i < a.length; i++)
    a[i] && (l = Kf(a[i])) && (s && (s += " "), s += l);
  return s;
}, Ig = (a, ...l) => {
  let s, i, o, d;
  const m = (p) => {
    const x = l.reduce((k, E) => E(k), a());
    return s = Lg(x), i = s.cache.get, o = s.cache.set, d = f, f(p);
  }, f = (p) => {
    const x = i(p);
    if (x)
      return x;
    const k = Wg(p, s);
    return o(p, k), k;
  };
  return d = m, (...p) => d(Fg(...p));
}, $g = [], Lt = (a) => {
  const l = (s) => s[a] || $g;
  return l.isThemeGetter = !0, l.themeKey = a, l;
}, Qf = /^\[(?:(\w[\w-]*):)?(.+)\]$/i, Vf = /^\((?:(\w[\w-]*):)?(.+)\)$/i, Pg = /^\d+(?:\.\d+)?\/\d+(?:\.\d+)?$/, tb = /^(\d+(\.\d+)?)?(xs|sm|md|lg|xl)$/, eb = /\d+(%|px|r?em|[sdl]?v([hwib]|min|max)|pt|pc|in|cm|mm|cap|ch|ex|r?lh|cq(w|h|i|b|min|max))|\b(calc|min|max|clamp)\(.+\)|^0$/, nb = /^(rgba?|hsla?|hwb|(ok)?(lab|lch)|color-mix|color|light-dark)\(.+\)$/, ab = /^(inset_)?-?((\d+)?\.?(\d+)[a-z]+|0)_-?((\d+)?\.?(\d+)[a-z]+|0)/, lb = /^(url|image|image-set|cross-fade|element|(repeating-)?(linear|radial|conic)-gradient)\(.+\)$/, On = (a) => Pg.test(a), vt = (a) => !!a && !Number.isNaN(Number(a)), Je = (a) => !!a && Number.isInteger(Number(a)), Zo = (a) => a.endsWith("%") && vt(a.slice(0, -1)), fn = (a) => tb.test(a), Xf = () => !0, rb = (a) => (
  // `colorFunctionRegex` check is necessary because color functions can have percentages in them which which would be incorrectly classified as lengths.
  // For example, `hsl(0 0% 0%)` would be classified as a length without this check.
  // I could also use lookbehind assertion in `lengthUnitRegex` but that isn't supported widely enough.
  eb.test(a) && !nb.test(a)
), ws = () => !1, ib = (a) => ab.test(a), ob = (a) => lb.test(a), sb = (a) => !at(a) && !lt(a), cb = (a) => a.startsWith("@container") && (a[10] === "/" && a[11] !== void 0 || a[11] === "s" && a[16] !== void 0 && a.startsWith("-size/", 10) || a[11] === "n" && a[18] !== void 0 && a.startsWith("-normal/", 10)), ub = (a) => Gn(a, Jf, ws), at = (a) => Qf.test(a), oa = (a) => Gn(a, Wf, rb), $d = (a) => Gn(a, vb, vt), db = (a) => Gn(a, If, Xf), fb = (a) => Gn(a, Ff, ws), Pd = (a) => Gn(a, Lf, ws), mb = (a) => Gn(a, Zf, ob), Ar = (a) => Gn(a, $f, ib), lt = (a) => Vf.test(a), yl = (a) => ua(a, Wf), pb = (a) => ua(a, Ff), tf = (a) => ua(a, Lf), hb = (a) => ua(a, Jf), gb = (a) => ua(a, Zf), jr = (a) => ua(a, $f, !0), bb = (a) => ua(a, If, !0), Gn = (a, l, s) => {
  const i = Qf.exec(a);
  return i ? i[1] ? l(i[1]) : s(i[2]) : !1;
}, ua = (a, l, s = !1) => {
  const i = Vf.exec(a);
  return i ? i[1] ? l(i[1]) : s : !1;
}, Lf = (a) => a === "position" || a === "percentage", Zf = (a) => a === "image" || a === "url", Jf = (a) => a === "length" || a === "size" || a === "bg-size", Wf = (a) => a === "length", vb = (a) => a === "number", Ff = (a) => a === "family-name", If = (a) => a === "number" || a === "weight", $f = (a) => a === "shadow", yb = () => {
  const a = Lt("color"), l = Lt("font"), s = Lt("text"), i = Lt("font-weight"), o = Lt("tracking"), d = Lt("leading"), m = Lt("breakpoint"), f = Lt("container"), p = Lt("spacing"), x = Lt("radius"), k = Lt("shadow"), E = Lt("inset-shadow"), w = Lt("text-shadow"), N = Lt("drop-shadow"), S = Lt("blur"), y = Lt("perspective"), z = Lt("aspect"), O = Lt("ease"), D = Lt("animate"), A = () => ["auto", "avoid", "all", "avoid-page", "page", "left", "right", "column"], X = () => [
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
  ], U = () => [...X(), lt, at], R = () => ["auto", "hidden", "clip", "visible", "scroll"], g = () => ["auto", "contain", "none"], v = () => [lt, at, p], h = () => [On, "full", "auto", ...v()], _ = () => [Je, "none", "subgrid", lt, at], M = () => ["auto", {
    span: ["full", Je, lt, at]
  }, Je, lt, at], B = () => [Je, "auto", lt, at], L = () => ["auto", "min", "max", "fr", lt, at], I = () => ["start", "end", "center", "between", "around", "evenly", "stretch", "baseline", "center-safe", "end-safe"], $ = () => ["start", "end", "center", "stretch", "center-safe", "end-safe"], Q = () => ["auto", ...v()], Z = () => [On, "auto", "full", "dvw", "dvh", "lvw", "lvh", "svw", "svh", "min", "max", "fit", ...v()], P = () => [f, On, "screen", "full", "dvw", "lvw", "svw", "min", "max", "fit", ...v()], G = () => [On, "screen", "full", "lh", "dvh", "lvh", "svh", "min", "max", "fit", ...v()], K = () => [a, lt, at], T = () => [...X(), tf, Pd, {
    position: [lt, at]
  }], V = () => ["no-repeat", {
    repeat: ["", "x", "y", "space", "round"]
  }], et = () => ["auto", "cover", "contain", hb, ub, {
    size: [lt, at]
  }], it = () => [Zo, yl, oa], ot = () => [
    // Deprecated since Tailwind CSS v4.0.0
    "",
    "none",
    "full",
    x,
    lt,
    at
  ], st = () => ["", vt, yl, oa], kt = () => ["solid", "dashed", "dotted", "double"], Zt = () => ["normal", "multiply", "screen", "overlay", "darken", "lighten", "color-dodge", "color-burn", "hard-light", "soft-light", "difference", "exclusion", "hue", "saturation", "color", "luminosity"], ht = () => [vt, Zo, tf, Pd], Kn = () => [
    // Deprecated since Tailwind CSS v4.0.0
    "",
    "none",
    S,
    lt,
    at
  ], Qn = () => ["none", vt, lt, at], Re = () => ["none", vt, lt, at], De = () => [vt, lt, at], pn = () => [On, "full", ...v()];
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
      font: [sb],
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
      "container-named": [cb],
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
        inset: h()
      }],
      /**
       * Inset Inline
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       */
      "inset-x": [{
        "inset-x": h()
      }],
      /**
       * Inset Block
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       */
      "inset-y": [{
        "inset-y": h()
      }],
      /**
       * Inset Inline Start
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       * @todo class group will be renamed to `inset-s` in next major release
       */
      start: [{
        "inset-s": h(),
        /**
         * @deprecated since Tailwind CSS v4.2.0 in favor of `inset-s-*` utilities.
         * @see https://github.com/tailwindlabs/tailwindcss/pull/19613
         */
        start: h()
      }],
      /**
       * Inset Inline End
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       * @todo class group will be renamed to `inset-e` in next major release
       */
      end: [{
        "inset-e": h(),
        /**
         * @deprecated since Tailwind CSS v4.2.0 in favor of `inset-e-*` utilities.
         * @see https://github.com/tailwindlabs/tailwindcss/pull/19613
         */
        end: h()
      }],
      /**
       * Inset Block Start
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       */
      "inset-bs": [{
        "inset-bs": h()
      }],
      /**
       * Inset Block End
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       */
      "inset-be": [{
        "inset-be": h()
      }],
      /**
       * Top
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       */
      top: [{
        top: h()
      }],
      /**
       * Right
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       */
      right: [{
        right: h()
      }],
      /**
       * Bottom
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       */
      bottom: [{
        bottom: h()
      }],
      /**
       * Left
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       */
      left: [{
        left: h()
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
        basis: [On, "full", "auto", f, ...v()]
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
        "grid-cols": _()
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
        "col-start": B()
      }],
      /**
       * Grid Column End
       * @see https://tailwindcss.com/docs/grid-column
       */
      "col-end": [{
        "col-end": B()
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
        row: M()
      }],
      /**
       * Grid Row Start
       * @see https://tailwindcss.com/docs/grid-row
       */
      "row-start": [{
        "row-start": B()
      }],
      /**
       * Grid Row End
       * @see https://tailwindcss.com/docs/grid-row
       */
      "row-end": [{
        "row-end": B()
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
        "auto-cols": L()
      }],
      /**
       * Grid Auto Rows
       * @see https://tailwindcss.com/docs/grid-auto-rows
       */
      "auto-rows": [{
        "auto-rows": L()
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
        justify: [...I(), "normal"]
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
        content: ["normal", ...I()]
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
        "place-content": I()
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
        size: Z()
      }],
      /**
       * Inline Size
       * @see https://tailwindcss.com/docs/inline-size
       */
      "inline-size": [{
        inline: ["auto", ...P()]
      }],
      /**
       * Min-Inline Size
       * @see https://tailwindcss.com/docs/min-inline-size
       */
      "min-inline-size": [{
        "min-inline": ["auto", ...P()]
      }],
      /**
       * Max-Inline Size
       * @see https://tailwindcss.com/docs/max-inline-size
       */
      "max-inline-size": [{
        "max-inline": ["none", ...P()]
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
        font: [i, bb, db]
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
        font: [pb, fb, l]
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
        "line-clamp": [vt, "none", lt, $d]
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
        indent: v()
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
        }, gb, mb]
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
          k,
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
        "inset-shadow": ["none", E, jr, Ar]
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
        "text-shadow": ["none", w, jr, Ar]
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
          N,
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
        stroke: [vt, yl, oa, $d]
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
}, xb = /* @__PURE__ */ Ig(yb);
function ue(...a) {
  return xb(Uf(a));
}
function wb(a, l, s) {
  return a.filter((i, o) => o !== l && (i.start + i.end) / 2 < s).length;
}
function _b(a, l, s, i) {
  const o = a.map(() => 0), d = a[l];
  if (!d) return o;
  const m = a[l + 1], f = a[l - 1], p = d.end - d.start + (m ? m.start - d.end : f ? d.start - f.end : 0);
  return a.forEach((x, k) => {
    l < s && k > l && k <= s ? o[k] = -p : s < l && k >= s && k < l && (o[k] = p);
  }), o[l] = Math.min(Math.max(i, a[0].start - d.start), a[a.length - 1].end - d.end), o;
}
const ef = ["transform", "transition", "zIndex", "filter", "pointerEvents", "position"];
function Sb(a, l) {
  for (let s = a.parentElement; s; s = s.parentElement) {
    const i = getComputedStyle(s)[l === "x" ? "overflowX" : "overflowY"];
    if ((i === "auto" || i === "scroll") && (l === "x" ? s.scrollWidth > s.clientWidth : s.scrollHeight > s.clientHeight)) return s;
  }
  return null;
}
function kb(a, l, s, i) {
  const o = a[l] ? Sb(a[l], s) : null, d = () => o ? s === "x" ? o.scrollLeft : o.scrollTop : 0, m = (z) => (s === "x" ? z.clientX : z.clientY) + d(), f = m(i), p = d(), x = a.map((z) => {
    const O = z.getBoundingClientRect();
    return s === "x" ? { start: O.left + p, end: O.right + p } : { start: O.top + p, end: O.bottom + p };
  }), k = a.map((z) => ef.map((O) => z.style[O])), E = typeof matchMedia == "function" && matchMedia("(prefers-reduced-motion: reduce)").matches, w = s === "x" ? "translateX" : "translateY";
  let N = !1;
  const S = { to: l };
  a.forEach((z, O) => {
    if (z.style.pointerEvents = "none", O !== l) {
      E || (z.style.transition = "transform 160ms cubic-bezier(0.2, 0.8, 0.2, 1)");
      return;
    }
    getComputedStyle(z).position === "static" && (z.style.position = "relative"), z.style.zIndex = "30", z.style.filter = "drop-shadow(0 6px 10px rgba(0, 0, 0, 0.45))";
  });
  const y = (z, O) => {
    S.to = z, _b(x, l, z, O).forEach((D, A) => {
      a[A].style.transform = D ? `${w}(${D}px)` : "";
    });
  };
  return {
    from: l,
    get to() {
      return S.to;
    },
    slot: (z) => wb(x, l, m(z)),
    apply: (z, O) => {
      N || y(z, m(O) - f);
    },
    rest: () => {
      N || y(l, 0);
    },
    end: () => {
      N || (N = !0, a.forEach((z, O) => ef.forEach((D, A) => {
        z.style[D] = k[O][A];
      })));
    }
  };
}
const Eb = 5;
let Jo = !1;
function zb(a, l) {
  if (a.button !== 0 || Jo) return;
  const s = { clientX: a.clientX, clientY: a.clientY }, i = a.currentTarget, o = a.pointerId;
  let d = null, m, f = !1;
  const p = { cursor: document.body.style.cursor, userSelect: document.body.style.userSelect }, x = (S) => {
    if (f) return;
    f = !0, window.removeEventListener("pointermove", k), window.removeEventListener("pointerup", E), window.removeEventListener("pointercancel", w), window.removeEventListener("keydown", N, !0), window.removeEventListener("blur", w), i.removeEventListener("lostpointercapture", w);
    try {
      i.releasePointerCapture(o);
    } catch {
    }
    if (!d) return;
    Jo = !1, document.body.style.cursor = p.cursor, document.body.style.userSelect = p.userSelect, d.end();
    const y = (z) => z.stopPropagation();
    window.addEventListener("click", y, { capture: !0, once: !0 }), setTimeout(() => window.removeEventListener("click", y, !0), 0), m?.(), l.onEnd(S, d);
  }, k = (S) => {
    if (!d) {
      if (Math.hypot(S.clientX - s.clientX, S.clientY - s.clientY) < Eb) return;
      const y = l.items();
      d = kb(y, l.from(y), l.axis, s), Jo = !0, document.body.style.cursor = "grabbing", document.body.style.userSelect = "none";
      try {
        i.setPointerCapture(o);
      } catch {
      }
      i.addEventListener("lostpointercapture", w);
      const z = l.onStart?.();
      m = typeof z == "function" ? z : void 0;
    }
    l.onMove(S, d);
  }, E = () => x(!0), w = () => x(!1), N = (S) => {
    S.key === "Escape" && (S.stopPropagation(), x(!1));
  };
  window.addEventListener("pointermove", k), window.addEventListener("pointerup", E), window.addEventListener("pointercancel", w), window.addEventListener("keydown", N, !0), window.addEventListener("blur", w);
}
const Pf = typeof navigator < "u" && /Mac/i.test(navigator.platform), Jr = {
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
for (let a = 1; a <= 12; a++) Jr[`f${a}`] = `F${a}`;
const Nb = Object.fromEntries(Object.entries(Jr).map(([a, l]) => [l, a])), Tb = {
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
function Cb(a) {
  const l = /^Key([A-Z])$/.exec(a) ?? /^Digit(\d)$/.exec(a);
  return l ? l[1].toLowerCase() : Nb[a];
}
const nf = /* @__PURE__ */ new Map();
function tm(a, l = Pf) {
  const s = `${l}|${a}`, i = nf.get(s);
  if (i) return i;
  const o = { cmd: !1, ctrl: !1, shift: !1, alt: !1, code: "" };
  for (const d of a.split("+"))
    if (d === "mod")
      l ? o.cmd = !0 : (o.ctrl = !0, o.shift = !0);
    else if (d === "cmd" || d === "ctrl" || d === "shift" || d === "alt") o[d] = !0;
    else if (/^[a-z]$/.test(d))
      o.code = `Key${d.toUpperCase()}`, o.letter = d;
    else if (/^[0-9]$/.test(d)) o.code = `Digit${d}`;
    else if (Jr[d]) o.code = Jr[d];
    else throw new Error(`unknown key "${d}" in "${a}"`);
  if (!o.code) throw new Error(`no key in "${a}"`);
  return nf.set(s, o), o;
}
new Set(["cmd+q", "cmd+h", "cmd+alt+h", "cmd+m", "cmd+ctrl+f", "cmd+z", "cmd+shift+z", "cmd+x", "cmd+c", "cmd+v", "cmd+a"].map((a) => {
  const l = tm(a, !0);
  return [l.cmd && "cmd", l.ctrl && "ctrl", l.alt && "alt", l.shift && "shift", l.code].filter(Boolean).join("+");
}));
function Mb(a, l = Pf) {
  const s = tm(a, l), i = Ab(Cb(s.code) ?? "");
  return l ? `${s.ctrl ? "⌃" : ""}${s.alt ? "⌥" : ""}${s.shift ? "⇧" : ""}${s.cmd ? "⌘" : ""}${i}` : [s.ctrl && "Ctrl", s.alt && "Alt", s.shift && "Shift", i].filter(Boolean).join("+");
}
const Ab = (a) => Tb[a] ?? a.toUpperCase(), af = (a) => typeof a == "boolean" ? `${a}` : a === 0 ? "0" : a, lf = Uf, ti = (a, l) => (s) => {
  var i;
  if (l?.variants == null) return lf(a, s?.class, s?.className);
  const { variants: o, defaultVariants: d } = l, m = Object.keys(o).map((x) => {
    const k = s?.[x], E = d?.[x];
    if (k === null) return null;
    const w = af(k) || af(E);
    return o[x][w];
  }), f = s && Object.entries(s).reduce((x, k) => {
    let [E, w] = k;
    return w === void 0 || (x[E] = w), x;
  }, {}), p = l == null || (i = l.compoundVariants) === null || i === void 0 ? void 0 : i.reduce((x, k) => {
    let { class: E, className: w, ...N } = k;
    return Object.entries(N).every((S) => {
      let [y, z] = S;
      return Array.isArray(z) ? z.includes({
        ...d,
        ...f
      }[y]) : {
        ...d,
        ...f
      }[y] === z;
    }) ? [
      ...x,
      E,
      w
    ] : x;
  }, []);
  return lf(a, m, p, s?.class, s?.className);
}, jb = ti(
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
), Ob = ti(
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
function Rb({ className: a, ...l } = {}) {
  return ue(Ob(l), a);
}
const em = "shrink-0 cursor-pointer rounded-ui bg-transparent px-[0.2rem] py-[0.1rem] text-[0.8rem] leading-none text-subtext-0 [font-family:inherit] [border:none] [transition:color_0.1s_ease,background_0.1s_ease] hover:bg-surface-1 hover:text-accent", nm = "cursor-pointer rounded-ui bg-transparent text-subtext-0 [border:0] [font-family:inherit] [transition:color_0.1s_ease,background_0.1s_ease] hover:bg-surface-1 hover:text-fg focus-visible:bg-surface-1 focus-visible:text-fg disabled:cursor-not-allowed disabled:opacity-40", Db = ti(`${nm} shrink-0 focus-visible:[outline:2px_solid_var(--accent)] focus-visible:[outline-offset:-2px]`, {
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
function Bb({ className: a, ...l } = {}) {
  return ue(Db(l), a);
}
const am = "overflow-hidden rounded-ui bg-surface-1 py-[0.3rem] shadow-[0_8px_24px_rgba(0,0,0,0.45)]", Hb = ti(
  "pane-context-menu__item block w-full cursor-pointer bg-transparent px-[0.9rem] py-[0.45rem] text-left text-[0.82rem] [border:none] [font-family:inherit] [transition:background_0.1s_ease] hover:bg-surface-0 disabled:cursor-not-allowed disabled:bg-transparent disabled:opacity-40",
  { variants: { danger: { true: "text-red", false: "text-fg" } }, defaultVariants: { danger: !1 } }
), Ub = "my-1 h-px bg-overlay-0";
function qb({ size: a = 14, className: l }) {
  return /* @__PURE__ */ ft.jsxs("svg", { className: l, width: a, height: a, viewBox: "0 0 16 16", fill: "currentColor", "aria-hidden": "true", children: [
    /* @__PURE__ */ ft.jsx("circle", { cx: "3.5", cy: "8", r: "1.1" }),
    /* @__PURE__ */ ft.jsx("circle", { cx: "8", cy: "8", r: "1.1" }),
    /* @__PURE__ */ ft.jsx("circle", { cx: "12.5", cy: "8", r: "1.1" })
  ] });
}
function Yb({ size: a = 16, className: l }) {
  return /* @__PURE__ */ ft.jsxs("svg", { className: l, width: a, height: a, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: "1.3", strokeLinejoin: "round", "aria-hidden": "true", children: [
    /* @__PURE__ */ ft.jsx("path", { d: "M6.6 1.8h2.8l.4 1.6 1.1.6 1.5-.6 1.4 2.4-1.2 1.1v1.3l1.2 1.1-1.4 2.4-1.5-.6-1.1.6-.4 1.6H6.6l-.4-1.6-1.1-.6-1.5.6-1.4-2.4 1.2-1.1V7.3L2.2 6.2l1.4-2.4 1.5.6 1.1-.6z" }),
    /* @__PURE__ */ ft.jsx("circle", { cx: "8", cy: "8", r: "2" })
  ] });
}
function Gb({ size: a = 14, className: l }) {
  return /* @__PURE__ */ ft.jsx("svg", { className: l, width: a, height: a, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round", "aria-hidden": "true", children: /* @__PURE__ */ ft.jsx("path", { d: "M3.5 3.5l9 9M12.5 3.5l-9 9" }) });
}
function lm({ size: a = 14, className: l }) {
  return /* @__PURE__ */ ft.jsx("svg", { className: l, width: a, height: a, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round", "aria-hidden": "true", children: /* @__PURE__ */ ft.jsx("path", { d: "M8 2.5v11M2.5 8h11" }) });
}
const rf = {
  connected: "host-state--connected bg-accent",
  connecting: "host-state--connecting animate-host-pulse bg-yellow",
  error: "host-state--error bg-red",
  disabled: "host-state--disabled bg-subtext-0"
};
function Kb({ state: a, error: l }) {
  return /* @__PURE__ */ ft.jsx(
    "span",
    {
      className: ue("host-state inline-block h-2 w-2 shrink-0 rounded-[50%]", rf[a] ?? rf.disabled),
      title: a === "error" && l ? l : a
    }
  );
}
function Qb({ title: a, onClose: l, children: s, testId: i }) {
  return Pr(
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
const Or = 4, Rn = 8, Vb = "flex w-full cursor-pointer items-center justify-between gap-3 px-[0.9rem] py-[0.4rem] text-left text-[0.82rem] text-fg max-[700px]:min-h-11 aria-disabled:cursor-not-allowed aria-disabled:opacity-40", of = (a) => a.text ?? (typeof a.label == "string" ? a.label : a.value);
function Xb({ value: a, onChange: l, options: s, className: i, ariaLabel: o, testId: d, id: m, title: f, disabled: p, placeholder: x, freeText: k, onKeyDown: E }) {
  const w = dt.useId(), [N, S] = dt.useState(!1), [y, z] = dt.useState(-1), [O, D] = dt.useState(!1), A = dt.useRef(null), X = dt.useRef(null), [U, R] = dt.useState({}), g = dt.useRef({ text: "", at: 0 }), v = k && O && a ? s.filter((G) => of(G).toLowerCase().includes(a.toLowerCase()) || G.value.toLowerCase().includes(a.toLowerCase())) : s, h = s.find((G) => G.value === a), _ = (G) => `${w}-${G}`;
  function M(G) {
    p || (z(G), S(!0));
  }
  function B() {
    S(!1), D(!1), z(-1);
  }
  function L(G) {
    !G || G.disabled || (l(G.value), B());
  }
  function I(G, K) {
    for (let T = 1; T <= v.length; T++) {
      const V = (G + K * T + v.length * T) % v.length;
      if (!v[V].disabled) return V;
    }
    return G;
  }
  const $ = () => v.findIndex((G) => !G.disabled), Q = () => v.length - 1 - [...v].reverse().findIndex((G) => !G.disabled);
  es(() => {
    if (!N || !A.current) {
      R((et) => et.left === void 0 ? et : {});
      return;
    }
    const G = A.current.getBoundingClientRect(), K = window.innerHeight - G.bottom - Or - Rn, T = G.top - Or - Rn, V = K < 160 && T > K;
    R({
      position: "fixed",
      left: Math.min(Math.max(Rn, G.left), Math.max(Rn, window.innerWidth - G.width - Rn)),
      // As wide as its longest label (a session title, a path), never wider than the window.
      width: "max-content",
      minWidth: G.width,
      maxWidth: window.innerWidth - 2 * Rn,
      maxHeight: Math.min(V ? T : K, 320),
      ...V ? { bottom: window.innerHeight - G.top + Or } : { top: G.bottom + Or },
      overflowY: "auto"
    });
  }, [N, v.length]), es(() => {
    const G = X.current;
    if (!N || !G || U.left === void 0) return;
    const K = G.getBoundingClientRect().right, T = window.innerWidth - Rn;
    K > T && R((V) => ({ ...V, left: Math.max(Rn, Number(V.left) - (K - T)) }));
  }, [N, U]), Fe(() => {
    if (!N) return;
    const G = (K) => {
      const T = K.target;
      (T === document || T instanceof Node && A.current && T.contains(A.current)) && B();
    };
    return window.addEventListener("resize", B), window.addEventListener("scroll", G, !0), () => {
      window.removeEventListener("resize", B), window.removeEventListener("scroll", G, !0);
    };
  }, [N]), Fe(() => {
    const G = N && y >= 0 ? document.getElementById(_(y)) : null, K = X.current;
    !G || !K || (G.offsetTop < K.scrollTop ? K.scrollTop = G.offsetTop : G.offsetTop + G.offsetHeight > K.scrollTop + K.clientHeight && (K.scrollTop = G.offsetTop + G.offsetHeight - K.clientHeight));
  }, [N, y]), sm(N, (G) => {
    G || B();
  }, A, X);
  function Z(G) {
    if (G.nativeEvent.isComposing) return;
    const K = () => {
      G.preventDefault(), G.stopPropagation();
    }, { key: T } = G;
    if (N) {
      if (T === "Escape") {
        K(), B();
        return;
      } else if (T === "Tab")
        B();
      else if (T === "ArrowDown" || T === "ArrowUp") {
        K(), v.length && z(y < 0 ? T === "ArrowDown" ? $() : Q() : I(y, T === "ArrowDown" ? 1 : -1));
        return;
      } else if (T === "Home" && !k) {
        K(), z($());
        return;
      } else if (T === "End" && !k) {
        K(), z(Q());
        return;
      } else if (T === "Enter" || T === " " && !k) {
        if (y >= 0 && v[y]) {
          K(), L(v[y]);
          return;
        }
        if (!k) {
          K(), B();
          return;
        }
      } else if (!k && T.length === 1 && !G.metaKey && !G.ctrlKey && !G.altKey) {
        const V = Date.now();
        g.current = { text: (V - g.current.at > 600 ? "" : g.current.text) + T.toLowerCase(), at: V };
        const et = Math.max(y, 0), it = [...v.slice(et + (g.current.text.length === 1 ? 1 : 0)), ...v.slice(0, et + 1)].find((ot) => !ot.disabled && of(ot).toLowerCase().startsWith(g.current.text));
        it && (K(), z(v.indexOf(it)));
        return;
      }
    } else if (T === "ArrowDown" || T === "ArrowUp" || !k && (T === "Enter" || T === " ")) {
      K(), M(Math.max(0, v.findIndex((V) => V.value === a)));
      return;
    }
    E?.(G);
  }
  const P = {
    ref: (G) => {
      A.current = G;
    },
    id: m,
    title: f,
    disabled: p,
    "aria-label": o,
    "aria-expanded": N,
    "aria-controls": N ? w : void 0,
    "aria-activedescendant": N && y >= 0 ? _(y) : void 0,
    "data-testid": d,
    onKeyDown: Z
  };
  return /* @__PURE__ */ ft.jsxs(ft.Fragment, { children: [
    k ? /* @__PURE__ */ ft.jsx(
      "input",
      {
        ...P,
        type: "text",
        role: "combobox",
        "aria-autocomplete": "list",
        autoComplete: "off",
        placeholder: x,
        className: i,
        value: a,
        onChange: (G) => {
          l(G.target.value), D(!0), N ? z(-1) : (z(-1), S(!0));
        },
        onBlur: () => B()
      }
    ) : /* @__PURE__ */ ft.jsxs(
      "button",
      {
        ...P,
        type: "button",
        role: "combobox",
        "aria-haspopup": "listbox",
        "data-value": a,
        className: ue("inline-flex items-center justify-between gap-2 text-left [font-family:inherit] cursor-pointer disabled:cursor-not-allowed disabled:opacity-50", i),
        onClick: () => N ? B() : M(Math.max(0, v.findIndex((G) => G.value === a))),
        children: [
          /* @__PURE__ */ ft.jsx("span", { className: "min-w-0 flex-1 truncate", children: h ? h.label : x ?? "" }),
          /* @__PURE__ */ ft.jsx(om, { open: !0, className: "shrink-0 text-subtext-0" })
        ]
      }
    ),
    N && v.length > 0 && Pr(
      /* @__PURE__ */ ft.jsx(
        "div",
        {
          ref: X,
          id: w,
          role: "listbox",
          "aria-label": o,
          className: ue("z-[9999]", am),
          style: U,
          onMouseDown: (G) => {
            G.preventDefault(), G.stopPropagation();
          },
          onClick: (G) => G.stopPropagation(),
          children: v.map((G, K) => /* @__PURE__ */ ft.jsxs(
            "div",
            {
              id: _(K),
              role: "option",
              "aria-selected": G.value === a,
              "aria-disabled": G.disabled || void 0,
              "data-value": G.value,
              className: ue(Vb, K === y && !G.disabled && "bg-surface-0"),
              onMouseEnter: () => {
                G.disabled || z(K);
              },
              onClick: () => L(G),
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
const Lb = "box-border min-h-[44px] cursor-pointer rounded-ui bg-transparent px-[0.7rem] py-[0.45rem] text-subtext-0 no-underline [border:0] [font-family:inherit] [font-weight:inherit] [line-height:inherit] text-[0.85rem] hover:bg-surface-1 hover:text-fg focus-visible:[outline:2px_solid_var(--accent)] focus-visible:[outline-offset:2px] disabled:cursor-default disabled:opacity-[0.55]", Zb = "m-0 mt-[0.4rem] text-[0.78rem] text-subtext-0", Jb = "m-0 mb-2 text-[0.82rem] text-subtext-0", rm = "rounded-ui bg-surface-1 text-fg [font-family:inherit]", _s = `${rm} px-2 py-[0.3rem] text-[0.8rem] max-[700px]:min-h-11 focus:[outline:1px_solid_var(--accent)]`, Wb = `${_s} min-w-[5.5rem] shrink-0`, Ss = `${rm} min-w-0 px-[0.55rem] py-[0.35rem] text-[0.82rem] max-[700px]:min-h-11 focus:[outline:1px_solid_var(--accent)]`, Fb = `${Ss} flex-1 max-[700px]:flex-[1_1_100%]`, Ib = `${Ss} w-20 flex-[0_0_5rem] max-[700px]:w-24 max-[700px]:flex-[1_1_6rem]`, $b = `${Ss} flex-[1_1_100%]`, Pb = "flex flex-wrap items-center gap-[0.4rem]", tv = "m-0 mb-2 flex list-none flex-col gap-[0.3rem] p-0", ev = "flex items-center gap-2 max-[700px]:flex-wrap rounded-ui bg-surface-1 px-2 py-[0.35rem] text-[0.82rem]", nv = `settings-modal__host-row ${ev}`, av = "min-w-0 overflow-hidden font-semibold text-ellipsis whitespace-nowrap text-fg", lv = "min-w-0 flex-1 max-[700px]:basis-full overflow-hidden text-[0.78rem] text-ellipsis whitespace-nowrap text-subtext-0", im = "shrink-0 cursor-pointer rounded-ui px-[0.7rem] py-[0.35rem] max-[700px]:min-h-11 text-[0.82rem] font-semibold text-panel-bg [border:none] [font-family:inherit] [transition:opacity_0.12s_ease] hover:opacity-[0.85]", rv = `${im} bg-accent`, iv = `${im} ml-auto bg-red`;
function om({ open: a, size: l = 12, className: s }) {
  return /* @__PURE__ */ ft.jsx("svg", { className: s, width: l, height: l, viewBox: "0 0 12 12", fill: "none", stroke: "currentColor", strokeWidth: "1.3", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true", children: /* @__PURE__ */ ft.jsx("path", { d: a ? "M2.5 4.5 6 8l3.5-3.5" : "M4.5 2.5 8 6l-3.5 3.5" }) });
}
function ov(a) {
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
function sv(a) {
  const l = /* @__PURE__ */ new Map();
  for (const s of a)
    cs(s, a) && l.set(s.parentSessionId, [...l.get(s.parentSessionId) ?? [], s]);
  return l.size ? a.filter((s) => !cs(s, a)).flatMap((s) => [s, ...l.get(s.id) ?? []]) : a;
}
const Rr = 6, sf = 8;
function cv(a, l = {}) {
  const { minWidth: s = 220, align: i = "right", minSpaceAbove: o = 100 } = l, d = a.getBoundingClientRect(), m = window.innerWidth, f = window.innerHeight, p = i === "right" ? { right: Math.max(0, m - d.right) } : { left: Math.max(0, d.left) }, x = d.top - Rr - sf, k = f - d.bottom - Rr - sf;
  return x >= o ? {
    position: "fixed",
    bottom: f - d.top + Rr,
    ...p,
    minWidth: s,
    maxHeight: Math.min(x, f * 0.75),
    overflowY: "auto"
  } : {
    position: "fixed",
    top: d.bottom + Rr,
    ...p,
    minWidth: s,
    maxHeight: Math.min(k, f * 0.75),
    overflowY: "auto"
  };
}
function sm(a, l, s, i) {
  Fe(() => {
    if (!a) return;
    function o(m) {
      const f = m.target, p = s.current?.contains(f) ?? !1, x = i.current?.contains(f) ?? !1;
      !p && !x && l(!1);
    }
    function d(m) {
      m.key === "Escape" && l(!1);
    }
    return document.addEventListener("mousedown", o), document.addEventListener("keydown", d), () => {
      document.removeEventListener("mousedown", o), document.removeEventListener("keydown", d);
    };
  }, [a]);
}
function uv({ icon: a, fallback: l }) {
  const [s, i] = dt.useState(!1);
  return Fe(() => i(!1), [a]), !a || s ? /* @__PURE__ */ ft.jsx(ft.Fragment, { children: l }) : /* @__PURE__ */ ft.jsx("img", { src: a, alt: "", width: 14, height: 14, className: "size-[14px] rounded-[2px] object-contain", referrerPolicy: "no-referrer", onError: () => i(!0) });
}
const dv = "mode-switch group ml-auto flex items-center gap-[0.4rem] bg-transparent p-[0.2rem] [border:none] [font-family:inherit]", cm = "text-[0.72rem] font-semibold tracking-[0.03em] text-overlay-1 uppercase [transition:color_0.15s_ease]", fv = `${cm} group-aria-[checked=false]:text-accent`, mv = `${cm} group-aria-checked:text-accent`, pv = "relative h-[1.3rem] w-[2.4rem] shrink-0 rounded-[999px] border border-overlay-0 bg-surface-1 [transition:background_0.15s_ease] group-aria-checked:border-accent group-aria-checked:bg-panel-bg", hv = "absolute top-px left-px h-[1.1rem] w-[1.1rem] rounded-[50%] bg-fg [box-shadow:0_1px_2px_rgba(0,0,0,0.3)] [transition:transform_0.15s_ease,background_0.15s_ease] group-aria-checked:bg-accent group-aria-checked:[transform:translateX(1.1rem)]";
function gv({
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
      className: dv,
      "data-testid": s,
      role: "switch",
      "aria-checked": o,
      "aria-label": "Toggle UI / CLI mode",
      disabled: i,
      onClick: () => l(o ? "ui" : "cli"),
      children: [
        /* @__PURE__ */ ft.jsx("span", { className: ue("mode-switch__label mode-switch__label--ui", fv), children: "UI" }),
        /* @__PURE__ */ ft.jsx("span", { className: ue("mode-switch__track", pv), children: /* @__PURE__ */ ft.jsx("span", { className: ue("mode-switch__thumb", hv) }) }),
        /* @__PURE__ */ ft.jsx("span", { className: ue("mode-switch__label mode-switch__label--cli", mv), children: "CLI" })
      ]
    }
  );
}
const Ya = function(a, l) {
  let o = a;
  const d = wl[l];
  let m = null, f = 0, p = null;
  const x = [], k = {}, E = function(g, v) {
    f = o * 4 + 17, m = (function(h) {
      const _ = new Array(h);
      for (let M = 0; M < h; M += 1) {
        _[M] = new Array(h);
        for (let B = 0; B < h; B += 1)
          _[M][B] = null;
      }
      return _;
    })(f), w(0, 0), w(f - 7, 0), w(0, f - 7), y(), S(), O(g, v), o >= 7 && z(g), p == null && (p = X(o, d, x)), D(p, v);
  }, w = function(g, v) {
    for (let h = -1; h <= 7; h += 1)
      if (!(g + h <= -1 || f <= g + h))
        for (let _ = -1; _ <= 7; _ += 1)
          v + _ <= -1 || f <= v + _ || (0 <= h && h <= 6 && (_ == 0 || _ == 6) || 0 <= _ && _ <= 6 && (h == 0 || h == 6) || 2 <= h && h <= 4 && 2 <= _ && _ <= 4 ? m[g + h][v + _] = !0 : m[g + h][v + _] = !1);
  }, N = function() {
    let g = 0, v = 0;
    for (let h = 0; h < 8; h += 1) {
      E(!0, h);
      const _ = Bn.getLostPoint(k);
      (h == 0 || g > _) && (g = _, v = h);
    }
    return v;
  }, S = function() {
    for (let g = 8; g < f - 8; g += 1)
      m[g][6] == null && (m[g][6] = g % 2 == 0);
    for (let g = 8; g < f - 8; g += 1)
      m[6][g] == null && (m[6][g] = g % 2 == 0);
  }, y = function() {
    const g = Bn.getPatternPosition(o);
    for (let v = 0; v < g.length; v += 1)
      for (let h = 0; h < g.length; h += 1) {
        const _ = g[v], M = g[h];
        if (m[_][M] == null)
          for (let B = -2; B <= 2; B += 1)
            for (let L = -2; L <= 2; L += 1)
              B == -2 || B == 2 || L == -2 || L == 2 || B == 0 && L == 0 ? m[_ + B][M + L] = !0 : m[_ + B][M + L] = !1;
      }
  }, z = function(g) {
    const v = Bn.getBCHTypeNumber(o);
    for (let h = 0; h < 18; h += 1) {
      const _ = !g && (v >> h & 1) == 1;
      m[Math.floor(h / 3)][h % 3 + f - 8 - 3] = _;
    }
    for (let h = 0; h < 18; h += 1) {
      const _ = !g && (v >> h & 1) == 1;
      m[h % 3 + f - 8 - 3][Math.floor(h / 3)] = _;
    }
  }, O = function(g, v) {
    const h = d << 3 | v, _ = Bn.getBCHTypeInfo(h);
    for (let M = 0; M < 15; M += 1) {
      const B = !g && (_ >> M & 1) == 1;
      M < 6 ? m[M][8] = B : M < 8 ? m[M + 1][8] = B : m[f - 15 + M][8] = B;
    }
    for (let M = 0; M < 15; M += 1) {
      const B = !g && (_ >> M & 1) == 1;
      M < 8 ? m[8][f - M - 1] = B : M < 9 ? m[8][15 - M - 1 + 1] = B : m[8][15 - M - 1] = B;
    }
    m[f - 8][8] = !g;
  }, D = function(g, v) {
    let h = -1, _ = f - 1, M = 7, B = 0;
    const L = Bn.getMaskFunction(v);
    for (let I = f - 1; I > 0; I -= 2)
      for (I == 6 && (I -= 1); ; ) {
        for (let $ = 0; $ < 2; $ += 1)
          if (m[_][I - $] == null) {
            let Q = !1;
            B < g.length && (Q = (g[B] >>> M & 1) == 1), L(_, I - $) && (Q = !Q), m[_][I - $] = Q, M -= 1, M == -1 && (B += 1, M = 7);
          }
        if (_ += h, _ < 0 || f <= _) {
          _ -= h, h = -h;
          break;
        }
      }
  }, A = function(g, v) {
    let h = 0, _ = 0, M = 0;
    const B = new Array(v.length), L = new Array(v.length);
    for (let Z = 0; Z < v.length; Z += 1) {
      const P = v[Z].dataCount, G = v[Z].totalCount - P;
      _ = Math.max(_, P), M = Math.max(M, G), B[Z] = new Array(P);
      for (let et = 0; et < B[Z].length; et += 1)
        B[Z][et] = 255 & g.getBuffer()[et + h];
      h += P;
      const K = Bn.getErrorCorrectPolynomial(G), V = zl(B[Z], K.getLength() - 1).mod(K);
      L[Z] = new Array(K.getLength() - 1);
      for (let et = 0; et < L[Z].length; et += 1) {
        const it = et + V.getLength() - L[Z].length;
        L[Z][et] = it >= 0 ? V.getAt(it) : 0;
      }
    }
    let I = 0;
    for (let Z = 0; Z < v.length; Z += 1)
      I += v[Z].totalCount;
    const $ = new Array(I);
    let Q = 0;
    for (let Z = 0; Z < _; Z += 1)
      for (let P = 0; P < v.length; P += 1)
        Z < B[P].length && ($[Q] = B[P][Z], Q += 1);
    for (let Z = 0; Z < M; Z += 1)
      for (let P = 0; P < v.length; P += 1)
        Z < L[P].length && ($[Q] = L[P][Z], Q += 1);
    return $;
  }, X = function(g, v, h) {
    const _ = cf.getRSBlocks(g, v), M = uf();
    for (let L = 0; L < h.length; L += 1) {
      const I = h[L];
      M.put(I.getMode(), 4), M.put(I.getLength(), Bn.getLengthInBits(I.getMode(), g)), I.write(M);
    }
    let B = 0;
    for (let L = 0; L < _.length; L += 1)
      B += _[L].dataCount;
    if (M.getLengthInBits() > B * 8)
      throw "code length overflow. (" + M.getLengthInBits() + ">" + B * 8 + ")";
    for (M.getLengthInBits() + 4 <= B * 8 && M.put(0, 4); M.getLengthInBits() % 8 != 0; )
      M.putBit(!1);
    for (; !(M.getLengthInBits() >= B * 8 || (M.put(236, 8), M.getLengthInBits() >= B * 8)); )
      M.put(17, 8);
    return A(M, _);
  };
  k.addData = function(g, v) {
    v = v || "Byte";
    let h = null;
    switch (v) {
      case "Numeric":
        h = bv(g);
        break;
      case "Alphanumeric":
        h = vv(g);
        break;
      case "Byte":
        h = yv(g);
        break;
      case "Kanji":
        h = xv(g);
        break;
      default:
        throw "mode:" + v;
    }
    x.push(h), p = null;
  }, k.isDark = function(g, v) {
    if (g < 0 || f <= g || v < 0 || f <= v)
      throw g + "," + v;
    return m[g][v];
  }, k.getModuleCount = function() {
    return f;
  }, k.make = function() {
    if (o < 1) {
      let g = 1;
      for (; g < 40; g++) {
        const v = cf.getRSBlocks(g, d), h = uf();
        for (let M = 0; M < x.length; M++) {
          const B = x[M];
          h.put(B.getMode(), 4), h.put(B.getLength(), Bn.getLengthInBits(B.getMode(), g)), B.write(h);
        }
        let _ = 0;
        for (let M = 0; M < v.length; M++)
          _ += v[M].dataCount;
        if (h.getLengthInBits() <= _ * 8)
          break;
      }
      o = g;
    }
    E(!1, N());
  }, k.createTableTag = function(g, v) {
    g = g || 2, v = typeof v > "u" ? g * 4 : v;
    let h = "";
    h += '<table style="', h += " border-width: 0px; border-style: none;", h += " border-collapse: collapse;", h += " padding: 0px; margin: " + v + "px;", h += '">', h += "<tbody>";
    for (let _ = 0; _ < k.getModuleCount(); _ += 1) {
      h += "<tr>";
      for (let M = 0; M < k.getModuleCount(); M += 1)
        h += '<td style="', h += " border-width: 0px; border-style: none;", h += " border-collapse: collapse;", h += " padding: 0px; margin: 0px;", h += " width: " + g + "px;", h += " height: " + g + "px;", h += " background-color: ", h += k.isDark(_, M) ? "#000000" : "#ffffff", h += ";", h += '"/>';
      h += "</tr>";
    }
    return h += "</tbody>", h += "</table>", h;
  }, k.createSvgTag = function(g, v, h, _) {
    let M = {};
    typeof arguments[0] == "object" && (M = arguments[0], g = M.cellSize, v = M.margin, h = M.alt, _ = M.title), g = g || 2, v = typeof v > "u" ? g * 4 : v, h = typeof h == "string" ? { text: h } : h || {}, h.text = h.text || null, h.id = h.text ? h.id || "qrcode-description" : null, _ = typeof _ == "string" ? { text: _ } : _ || {}, _.text = _.text || null, _.id = _.text ? _.id || "qrcode-title" : null;
    const B = k.getModuleCount() * g + v * 2;
    let L, I, $, Q, Z = "", P;
    for (P = "l" + g + ",0 0," + g + " -" + g + ",0 0,-" + g + "z ", Z += '<svg version="1.1" xmlns="http://www.w3.org/2000/svg"', Z += M.scalable ? "" : ' width="' + B + 'px" height="' + B + 'px"', Z += ' viewBox="0 0 ' + B + " " + B + '" ', Z += ' preserveAspectRatio="xMinYMin meet"', Z += _.text || h.text ? ' role="img" aria-labelledby="' + U([_.id, h.id].join(" ").trim()) + '"' : "", Z += ">", Z += _.text ? '<title id="' + U(_.id) + '">' + U(_.text) + "</title>" : "", Z += h.text ? '<description id="' + U(h.id) + '">' + U(h.text) + "</description>" : "", Z += '<rect width="100%" height="100%" fill="white" cx="0" cy="0"/>', Z += '<path d="', $ = 0; $ < k.getModuleCount(); $ += 1)
      for (Q = $ * g + v, L = 0; L < k.getModuleCount(); L += 1)
        k.isDark($, L) && (I = L * g + v, Z += "M" + I + "," + Q + P);
    return Z += '" stroke="transparent" fill="black"/>', Z += "</svg>", Z;
  }, k.createDataURL = function(g, v) {
    g = g || 2, v = typeof v > "u" ? g * 4 : v;
    const h = k.getModuleCount() * g + v * 2, _ = v, M = h - v;
    return kv(h, h, function(B, L) {
      if (_ <= B && B < M && _ <= L && L < M) {
        const I = Math.floor((B - _) / g), $ = Math.floor((L - _) / g);
        return k.isDark($, I) ? 0 : 1;
      } else
        return 1;
    });
  }, k.createImgTag = function(g, v, h) {
    g = g || 2, v = typeof v > "u" ? g * 4 : v;
    const _ = k.getModuleCount() * g + v * 2;
    let M = "";
    return M += "<img", M += ' src="', M += k.createDataURL(g, v), M += '"', M += ' width="', M += _, M += '"', M += ' height="', M += _, M += '"', h && (M += ' alt="', M += U(h), M += '"'), M += "/>", M;
  };
  const U = function(g) {
    let v = "";
    for (let h = 0; h < g.length; h += 1) {
      const _ = g.charAt(h);
      switch (_) {
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
          v += _;
          break;
      }
    }
    return v;
  }, R = function(g) {
    g = typeof g > "u" ? 2 : g;
    const h = k.getModuleCount() * 1 + g * 2, _ = g, M = h - g;
    let B, L, I, $, Q;
    const Z = {
      "██": "█",
      "█ ": "▀",
      " █": "▄",
      "  ": " "
    }, P = {
      "██": "▀",
      "█ ": "▀",
      " █": " ",
      "  ": " "
    };
    let G = "";
    for (B = 0; B < h; B += 2) {
      for (I = Math.floor((B - _) / 1), $ = Math.floor((B + 1 - _) / 1), L = 0; L < h; L += 1)
        Q = "█", _ <= L && L < M && _ <= B && B < M && k.isDark(I, Math.floor((L - _) / 1)) && (Q = " "), _ <= L && L < M && _ <= B + 1 && B + 1 < M && k.isDark($, Math.floor((L - _) / 1)) ? Q += " " : Q += "█", G += g < 1 && B + 1 >= M ? P[Q] : Z[Q];
      G += `
`;
    }
    return h % 2 && g > 0 ? G.substring(0, G.length - h - 1) + Array(h + 1).join("▀") : G.substring(0, G.length - 1);
  };
  return k.createASCII = function(g, v) {
    if (g = g || 1, g < 2)
      return R(v);
    g -= 1, v = typeof v > "u" ? g * 2 : v;
    const h = k.getModuleCount() * g + v * 2, _ = v, M = h - v;
    let B, L, I, $;
    const Q = Array(g + 1).join("██"), Z = Array(g + 1).join("  ");
    let P = "", G = "";
    for (B = 0; B < h; B += 1) {
      for (I = Math.floor((B - _) / g), G = "", L = 0; L < h; L += 1)
        $ = 1, _ <= L && L < M && _ <= B && B < M && k.isDark(I, Math.floor((L - _) / g)) && ($ = 0), G += $ ? Q : Z;
      for (I = 0; I < g; I += 1)
        P += G + `
`;
    }
    return P.substring(0, P.length - 1);
  }, k.renderTo2dContext = function(g, v) {
    v = v || 2;
    const h = k.getModuleCount();
    for (let _ = 0; _ < h; _++)
      for (let M = 0; M < h; M++)
        g.fillStyle = k.isDark(_, M) ? "black" : "white", g.fillRect(M * v, _ * v, v, v);
  }, k;
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
    const o = _v(a), d = function() {
      const p = o.read();
      if (p == -1) throw "eof";
      return p;
    };
    let m = 0;
    const f = {};
    for (; ; ) {
      const p = o.read();
      if (p == -1) break;
      const x = d(), k = d(), E = d(), w = String.fromCharCode(p << 8 | x), N = k << 8 | E;
      f[w] = N, m += 1;
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
        const p = s[o.charAt(m)];
        typeof p == "number" ? (p & 255) == p ? d.push(p) : (d.push(p >>> 8), d.push(p & 255)) : d.push(i);
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
        return function(f, p) {
          return (f + p) % 2 == 0;
        };
      case Dn.PATTERN001:
        return function(f, p) {
          return f % 2 == 0;
        };
      case Dn.PATTERN010:
        return function(f, p) {
          return p % 3 == 0;
        };
      case Dn.PATTERN011:
        return function(f, p) {
          return (f + p) % 3 == 0;
        };
      case Dn.PATTERN100:
        return function(f, p) {
          return (Math.floor(f / 2) + Math.floor(p / 3)) % 2 == 0;
        };
      case Dn.PATTERN101:
        return function(f, p) {
          return f * p % 2 + f * p % 3 == 0;
        };
      case Dn.PATTERN110:
        return function(f, p) {
          return (f * p % 2 + f * p % 3) % 2 == 0;
        };
      case Dn.PATTERN111:
        return function(f, p) {
          return (f * p % 3 + (f + p) % 2) % 2 == 0;
        };
      default:
        throw "bad maskPattern:" + m;
    }
  }, o.getErrorCorrectPolynomial = function(m) {
    let f = zl([1], 0);
    for (let p = 0; p < m; p += 1)
      f = f.multiply(zl([1, Hn.gexp(p)], 0));
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
    let p = 0;
    for (let E = 0; E < f; E += 1)
      for (let w = 0; w < f; w += 1) {
        let N = 0;
        const S = m.isDark(E, w);
        for (let y = -1; y <= 1; y += 1)
          if (!(E + y < 0 || f <= E + y))
            for (let z = -1; z <= 1; z += 1)
              w + z < 0 || f <= w + z || y == 0 && z == 0 || S == m.isDark(E + y, w + z) && (N += 1);
        N > 5 && (p += 3 + N - 5);
      }
    for (let E = 0; E < f - 1; E += 1)
      for (let w = 0; w < f - 1; w += 1) {
        let N = 0;
        m.isDark(E, w) && (N += 1), m.isDark(E + 1, w) && (N += 1), m.isDark(E, w + 1) && (N += 1), m.isDark(E + 1, w + 1) && (N += 1), (N == 0 || N == 4) && (p += 3);
      }
    for (let E = 0; E < f; E += 1)
      for (let w = 0; w < f - 6; w += 1)
        m.isDark(E, w) && !m.isDark(E, w + 1) && m.isDark(E, w + 2) && m.isDark(E, w + 3) && m.isDark(E, w + 4) && !m.isDark(E, w + 5) && m.isDark(E, w + 6) && (p += 40);
    for (let E = 0; E < f; E += 1)
      for (let w = 0; w < f - 6; w += 1)
        m.isDark(w, E) && !m.isDark(w + 1, E) && m.isDark(w + 2, E) && m.isDark(w + 3, E) && m.isDark(w + 4, E) && !m.isDark(w + 5, E) && m.isDark(w + 6, E) && (p += 40);
    let x = 0;
    for (let E = 0; E < f; E += 1)
      for (let w = 0; w < f; w += 1)
        m.isDark(w, E) && (x += 1);
    const k = Math.abs(100 * x / f / f - 50) / 5;
    return p += k * 10, p;
  }, o;
})(), Hn = (function() {
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
        d[m + f] ^= Hn.gexp(Hn.glog(i.getAt(m)) + Hn.glog(o.getAt(f)));
    return zl(d, 0);
  }, i.mod = function(o) {
    if (i.getLength() - o.getLength() < 0)
      return i;
    const d = Hn.glog(i.getAt(0)) - Hn.glog(o.getAt(0)), m = new Array(i.getLength());
    for (let f = 0; f < i.getLength(); f += 1)
      m[f] = i.getAt(f);
    for (let f = 0; f < o.getLength(); f += 1)
      m[f] ^= Hn.gexp(Hn.glog(o.getAt(f)) + d);
    return zl(m, 0).mod(o);
  }, i;
}, cf = (function() {
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
    const f = m.length / 3, p = [];
    for (let x = 0; x < f; x += 1) {
      const k = m[x * 3 + 0], E = m[x * 3 + 1], w = m[x * 3 + 2];
      for (let N = 0; N < k; N += 1)
        p.push(l(E, w));
    }
    return p;
  }, s;
})(), uf = function() {
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
}, bv = function(a) {
  const l = ce.MODE_NUMBER, s = a, i = {};
  i.getMode = function() {
    return l;
  }, i.getLength = function(m) {
    return s.length;
  }, i.write = function(m) {
    const f = s;
    let p = 0;
    for (; p + 2 < f.length; )
      m.put(o(f.substring(p, p + 3)), 10), p += 3;
    p < f.length && (f.length - p == 1 ? m.put(o(f.substring(p, p + 1)), 4) : f.length - p == 2 && m.put(o(f.substring(p, p + 2)), 7));
  };
  const o = function(m) {
    let f = 0;
    for (let p = 0; p < m.length; p += 1)
      f = f * 10 + d(m.charAt(p));
    return f;
  }, d = function(m) {
    if ("0" <= m && m <= "9")
      return m.charCodeAt(0) - 48;
    throw "illegal char :" + m;
  };
  return i;
}, vv = function(a) {
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
}, yv = function(a) {
  const l = ce.MODE_8BIT_BYTE, s = Ya.stringToBytes(a), i = {};
  return i.getMode = function() {
    return l;
  }, i.getLength = function(o) {
    return s.length;
  }, i.write = function(o) {
    for (let d = 0; d < s.length; d += 1)
      o.put(s[d], 8);
  }, i;
}, xv = function(a) {
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
  }, o;
}, um = function() {
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
}, wv = function() {
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
      for (let p = 0; p < f; p += 1)
        i += "=";
    }
  }, o.toString = function() {
    return i;
  }, o;
}, _v = function(a) {
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
      const p = l.charAt(s);
      if (s += 1, p == "=")
        return o = 0, -1;
      if (p.match(/^\s$/))
        continue;
      i = i << 6 | m(p.charCodeAt(0)), o += 6;
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
}, Sv = function(a, l) {
  const s = a, i = l, o = new Array(a * l), d = {};
  d.setPixel = function(x, k, E) {
    o[k * s + x] = E;
  }, d.write = function(x) {
    x.writeString("GIF87a"), x.writeShort(s), x.writeShort(i), x.writeByte(128), x.writeByte(0), x.writeByte(0), x.writeByte(0), x.writeByte(0), x.writeByte(0), x.writeByte(255), x.writeByte(255), x.writeByte(255), x.writeString(","), x.writeShort(0), x.writeShort(0), x.writeShort(s), x.writeShort(i), x.writeByte(0);
    const k = 2, E = f(k);
    x.writeByte(k);
    let w = 0;
    for (; E.length - w > 255; )
      x.writeByte(255), x.writeBytes(E, w, 255), w += 255;
    x.writeByte(E.length - w), x.writeBytes(E, w, E.length - w), x.writeByte(0), x.writeString(";");
  };
  const m = function(x) {
    const k = x;
    let E = 0, w = 0;
    const N = {};
    return N.write = function(S, y) {
      if (S >>> y)
        throw "length over";
      for (; E + y >= 8; )
        k.writeByte(255 & (S << E | w)), y -= 8 - E, S >>>= 8 - E, w = 0, E = 0;
      w = S << E | w, E = E + y;
    }, N.flush = function() {
      E > 0 && k.writeByte(w);
    }, N;
  }, f = function(x) {
    const k = 1 << x, E = (1 << x) + 1;
    let w = x + 1;
    const N = p();
    for (let D = 0; D < k; D += 1)
      N.add(String.fromCharCode(D));
    N.add(String.fromCharCode(k)), N.add(String.fromCharCode(E));
    const S = um(), y = m(S);
    y.write(k, w);
    let z = 0, O = String.fromCharCode(o[z]);
    for (z += 1; z < o.length; ) {
      const D = String.fromCharCode(o[z]);
      z += 1, N.contains(O + D) ? O = O + D : (y.write(N.indexOf(O), w), N.size() < 4095 && (N.size() == 1 << w && (w += 1), N.add(O + D)), O = D);
    }
    return y.write(N.indexOf(O), w), y.write(E, w), y.flush(), S.toByteArray();
  }, p = function() {
    const x = {};
    let k = 0;
    const E = {};
    return E.add = function(w) {
      if (E.contains(w))
        throw "dup key:" + w;
      x[w] = k, k += 1;
    }, E.size = function() {
      return k;
    }, E.indexOf = function(w) {
      return x[w];
    }, E.contains = function(w) {
      return typeof x[w] < "u";
    }, E;
  };
  return d;
}, kv = function(a, l, s) {
  const i = Sv(a, l);
  for (let f = 0; f < l; f += 1)
    for (let p = 0; p < a; p += 1)
      i.setPixel(p, f, s(p, f));
  const o = um();
  i.write(o);
  const d = wv(), m = o.toByteArray();
  for (let f = 0; f < m.length; f += 1)
    d.writeByte(m[f]);
  return d.flush(), "data:image/gif;base64," + d;
};
Ya.stringToBytes;
function Ev({ text: a }) {
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
const Nl = dt.createContext(""), us = (a, l) => typeof a == "string" && a.toLowerCase().includes(l);
function zv({ title: a, children: l, testId: s, ariaLabel: i }) {
  const o = dt.useContext(Nl), d = o !== "" && us(a, o);
  return (
    // While searching, a group with no matching row (and no matching title) hides itself.
    /* @__PURE__ */ ft.jsxs("section", { className: o && !d ? "mb-8 not-has-[[data-setting-row]]:hidden" : "mb-8", "data-testid": s, "aria-label": i, children: [
      a && /* @__PURE__ */ ft.jsx("h3", { className: "m-0 mb-3 text-[0.9rem] font-medium text-fg", children: a }),
      /* @__PURE__ */ ft.jsx("div", { className: "rounded-ui bg-surface-0 px-4", children: /* @__PURE__ */ ft.jsx(Nl.Provider, { value: d ? "" : o, children: l }) })
    ] })
  );
}
function Nv({ title: a, description: l, children: s, testId: i }) {
  const o = dt.useContext(Nl);
  return o && !us(a, o) && !us(l, o) ? null : /* @__PURE__ */ ft.jsxs("div", { "data-setting-row": !0, "data-testid": i, className: "flex items-center justify-between gap-6 py-[0.8rem] max-[700px]:flex-wrap max-[700px]:gap-y-2", children: [
    /* @__PURE__ */ ft.jsxs("div", { className: "min-w-0 max-[700px]:flex-1 max-[700px]:basis-56", children: [
      /* @__PURE__ */ ft.jsx("div", { className: "text-[0.85rem] text-fg", children: a }),
      l && /* @__PURE__ */ ft.jsx("div", { className: "mt-[0.15rem] text-[0.75rem] text-subtext-0", children: l })
    ] }),
    s && /* @__PURE__ */ ft.jsx("div", { className: "flex shrink-0 items-center gap-2", children: s })
  ] });
}
function Tv({ checked: a, onChange: l, testId: s, label: i }) {
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
const Cv = () => dt.useContext(Nl), Mv = {
  select: _s,
  selectHost: Wb,
  input: Fb,
  inputPort: Ib,
  inputWide: $b,
  addRow: Pb,
  list: tv,
  hostRow: nv,
  name: av,
  addr: lv,
  muted: Zb,
  empty: Jb,
  primary: rv,
  danger: iv,
  catalogToggle: Lb
};
//! State the host keeps for a resource rather than for one view of it (`useResourceState`, `@perch/sdk` 1.4): a
//! review's unsent commit message and comment, its pending batch and its operation id, keyed by the screen's
//! own name for the resource (`review:<workspace>:commit`). Every view and copy that names the same key shares the
//! value, and it outlives a reload or swap of the screen's code, a released hidden copy and the phone/desktop
//! layouts trading places. In memory: a page reload starts empty (durable drafts live in their own services).
const Av = 512, We = /* @__PURE__ */ new Map(), Sl = /* @__PURE__ */ new Map();
function dm(a, l) {
  We.delete(a), We.set(a, l);
  for (const s of We.keys()) {
    if (We.size <= Av) break;
    Sl.get(s)?.size || We.delete(s);
  }
}
function jv(a, l) {
  return We.has(a) ? We.get(a) : l;
}
function Ov(a, l, s) {
  const i = jv(a, s), o = typeof l == "function" ? l(i) : l;
  if (!(We.has(a) && Object.is(o, i))) {
    dm(a, o);
    for (const d of [...Sl.get(a) ?? []]) d();
  }
}
function Rv(a, l) {
  if (typeof a != "string" || !a) throw new Error("useResourceState needs a non-empty key.");
  We.has(a) || dm(a, l);
  const s = dt.useCallback((d) => {
    const m = Sl.get(a) ?? /* @__PURE__ */ new Set();
    return Sl.set(a, m), m.add(d), () => {
      m.delete(d), m.size || Sl.delete(a);
    };
  }, [a]), i = dt.useSyncExternalStore(s, () => We.get(a)), o = dt.useCallback((d) => Ov(a, d, l), [a]);
  return [i, o];
}
const Dv = "[--radius:var(--radius-pane)] rounded-soft bg-surface-1/70 shadow-[0_6px_20px_rgba(0,0,0,0.3)] backdrop-blur-xl backdrop-saturate-150", Bv = "hover:bg-transparent hover:text-subtext-0 active:bg-surface-1 active:text-fg";
//! `@perch/sdk` for the native client: the surface a stock screen imports (the navigation part, 1.3), with every
//! call going to one abstract host object, `globalThis.perch`, read when called (so a host or a test sets it before
//! mounting). Class helpers, icons, `cn`, `keyLabel` and the host dot are the app's own modules, compiled in, so the
//! classes are the web's to the character. Data hooks subscribe to `perch.subscribe` and read the host's snapshots
//! (`perch.navigation(options)`, `perch.hosts()`, ...), which must return the same object until the data changes.
//! Menus and dialogs Perch draws itself (session menu, new session menu, confirm, select, folder browser,
//! instructions, memory) open through `perch.openOverlay(kind, props)`; their callbacks are plain functions.
const Hv = "1.3.0";
let Gr = null;
const Uv = (a) => {
  Gr = a;
};
function Tt() {
  const a = (typeof Gr == "function" ? Gr() : Gr) ?? globalThis.perch;
  if (!a) throw new Error("@perch/sdk: no perch host (globalThis.perch) is set");
  return a;
}
const qv = (a) => Tt().subscribe?.(a) ?? (() => {
}), Yv = cv;
function Gv() {
  return typeof globalThis.crypto?.randomUUID == "function" ? globalThis.crypto.randomUUID() : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (a) => {
    const l = Math.floor(Math.random() * 16);
    return (a === "x" ? l : l & 3 | 8).toString(16);
  });
}
const Kv = globalThis.perch?.isMac !== !1, Qv = (a) => Mb(a, Tt().isMac !== !1), Vv = (a) => jb(a), Xv = ({ className: a, ...l } = {}) => ue(Rb(l), a), Lv = Bb, Zv = (a) => Hb(a), Jv = Ub, Wv = nm, Fv = em, Iv = (a) => ss[a].color, $v = (a, l) => Tt().shortcutFor?.(a, l) ?? null, Pv = (a) => Tt().shortcutLabel?.(a) ?? null, ei = (a, l) => Tt().command(a, l ?? {}) !== !1, t1 = (a, l, s) => Tt().startSession?.(a, l, s), e1 = globalThis.perch?.pickFolder ? (a) => Tt().pickFolder(a) : null;
function re(a) {
  const l = dt.useRef(a);
  return l.current = a, dt.useSyncExternalStore(qv, () => l.current(Tt()));
}
const fm = (a = {}) => re((l) => l.navigation({ showTerminals: !!a.showTerminals, sortByAttention: !!a.sortByAttention })), n1 = () => re((a) => a.hosts()), a1 = () => re((a) => a.sessionFolders());
function l1() {
  const a = re((l) => l.addProject?.() ?? r1);
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
const r1 = Object.freeze({ status: "idle" }), mm = "perch.lastAgentChoice", i1 = Object.freeze({ connected: !1, discovery: !1, state: "ready", choices: [] }), o1 = () => {
  const a = Tt().storage?.getItem(mm);
  return a === "claude" || a === "codex" ? a : "claude";
}, s1 = Object.freeze({ items: [] });
function c1() {
  const a = re((l) => l.notifications?.() ?? s1);
  return dt.useMemo(() => ({
    items: a.items ?? [],
    open: (l) => Tt().command("notification.open", { id: l }),
    dismiss: (l) => Tt().command("notification.dismiss", { id: l })
  }), [a]);
}
function u1(a) {
  const l = re((o) => o.agentChoices?.(a) ?? i1), [s, i] = dt.useState(o1);
  return dt.useMemo(() => ({
    connected: !!l.connected,
    discovery: !!l.discovery,
    choices: l.choices ?? [],
    lastChoice: s,
    state: l.state ?? "ready",
    error: l.state === "error" ? l.error : void 0,
    rememberChoice: (o) => {
      o !== "claude" && o !== "codex" || (Tt().storage?.setItem(mm, o), i(o));
    },
    manage: () => Tt().command("agents.manage", {})
  }), [l, s]);
}
function d1(a) {
  Fe(() => Tt().onRequest?.("add-project", a) ?? void 0, [a]);
}
function f1(a) {
  const l = a.map((s) => ({ id: s.id, parentSessionId: s.parentId, session: s }));
  return sv(l).map((s) => ({ session: s.session, nested: cs(s, l) }));
}
function m1({ id: a, plain: l, className: s }) {
  const i = re((x) => x.session(a));
  if (!i) return null;
  const o = i.state ?? ov(i), d = ss[o]?.color ?? ss.unknown.color, m = i.provider, f = m === "claude" || m === "claude-agent-teams" || m === "omp", p = l ? ue("agent-mark", "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full leading-none", s) : ue("agent-status-dot", `agent-status-dot--${o}`, "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-[1.5px] bg-panel-bg leading-none", s);
  return dt.createElement(
    "span",
    { className: p, style: l ? void 0 : { borderColor: d }, "data-provider": m ?? "unknown", title: l ? m ?? "Agent" : `${m ?? "Agent"} · ${o}`, "aria-hidden": "true" },
    dt.createElement("span", { className: ue("inline-flex text-fg", f && "rounded-full bg-[#161616]") }, dt.createElement(pm, { provider: m, size: 14 }))
  );
}
function pm({ provider: a, size: l = 14 }) {
  const s = Tt().agentIcon?.(a, l) ?? null, i = s?.markup ?? '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><circle cx="8" cy="8" r="5" fill="currentColor"/></svg>';
  return dt.createElement("svg", { width: l, height: l, "aria-hidden": "true", "data-agent-icon": a ?? "unknown", "data-perch-markup": i, ...s && s.tint === !1 ? { "data-perch-image": "true" } : {} });
}
const p1 = ({ children: a }) => dt.createElement(dt.Fragment, null, a);
function h1(a, l) {
  const s = dt.useRef(l);
  return s.current = l, Fe(() => {
    const i = Tt();
    if (!i.openOverlay) throw new Error(`@perch/sdk: the host draws no overlays (perch.openOverlay), so ${a} cannot open`);
    const o = {};
    for (const [m, f] of Object.entries(s.current))
      o[m] = typeof f == "function" ? (...p) => s.current[m]?.(...p) : f;
    const d = i.openOverlay(a, o);
    return () => i.closeOverlay?.(d);
  }, [a]), null;
}
const da = (a) => function(s) {
  return h1(a, s);
}, g1 = da("session-menu"), b1 = da("new-session-menu"), v1 = da("confirm");
let hm = null;
const y1 = (a) => {
  hm = a;
};
function x1(a) {
  return dt.createElement(hm ?? v1, a);
}
function w1({ className: a = _s, ...l }) {
  return dt.createElement(Xb, { ...l, className: a });
}
let ds = null;
const _1 = (a) => {
  ds = a;
}, S1 = da("folder-browser");
function k1(a) {
  return ds ? dt.createElement(ds, { ...a, browse: (l) => Tt().browse(a.hostId, l) }) : dt.createElement(S1, a);
}
const E1 = da("instructions"), z1 = da("memory"), N1 = Qb;
let ks = null;
const T1 = (a) => {
  ks = a;
};
function C1(a) {
  if (ks) return dt.createElement(A1, a);
  const { hostId: l, path: s, className: i } = a, o = dt.useRef(null);
  return dt.createElement(
    "button",
    {
      type: "button",
      ref: o,
      className: ue("worktree-menu__btn", em, i),
      "data-testid": `worktree-menu-${l}-${s}`,
      title: "New workspace (a git worktree)",
      "aria-label": "New workspace",
      "aria-expanded": !1,
      onClick: () => Tt().openOverlay?.("worktree", { hostId: l, cwd: s, anchor: o.current?.getBoundingClientRect() })
    },
    dt.createElement(lm, null)
  );
}
const gm = "Perch did not answer.";
function Dr(a) {
  return a ? a.type === "worktree.error" ? { error: a.message, dirty: !!a.dirty } : a.error ? { error: String(a.error) } : {} : { error: gm };
}
function M1(a, l, s = Tt()) {
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
const df = 5 * 6e4;
function bm(a, l, s, i = Tt()) {
  const o = Date.now() + df;
  let d = !1, m = () => {
  };
  const f = () => {
    d = !0, m(), clearTimeout(x);
  }, p = () => {
    if (!d) {
      if (Date.now() >= o) return f();
      M1(a, l, i) && (f(), i.startSession?.(a, l, s));
    }
  }, x = setTimeout(f, df);
  m = i.subscribe?.(p) ?? (() => {
  }), p();
}
function A1({ hostId: a, path: l, className: s, worktrees: i, request: o, parentChoices: d, emptyAgent: m, ...f }) {
  const [p, x] = dt.useState(i), k = (_) => !!Tt().coreCan?.(_, a), E = fm(), w = `${a}:${l}`, N = dt.useMemo(() => {
    if (Array.isArray(d)) return d;
    if (!k("workspace.nest")) return [];
    const _ = E?.projects?.find((L) => L.hostId === a && L.repoPath === l), M = [], B = (L, I) => {
      for (const $ of L ?? [])
        I && M.push({ id: $.id, name: $.name, path: $.path }), B($.children, !0);
    };
    return B(_?.workspaces, !1), M;
  }, [d, E, a, l]), S = a === "local" && k("worktree.job"), y = f.deleteSupported ?? k("worktree.delete"), z = f.startFromSupported ?? k("worktree.startFrom"), O = re((_) => _.emptyWorkspaceAgent?.() ?? void 0), D = m ?? O ?? void 0, A = re((_) => _.worktreeMenuRequest?.() ?? null), X = A?.projectKey === w ? A.nonce : null, U = dt.useMemo(() => o ?? (X == null ? null : A), [o, X]), [R, g] = dt.useState(U);
  Fe(() => {
    U && g(U);
  }, [U]);
  const v = dt.useRef({});
  v.current = { background: S, deleteSupported: y };
  const h = dt.useMemo(() => {
    const _ = (M, B) => Tt().ask(M, { hostId: a, repoPath: l, ...B });
    return {
      list: async () => {
        const M = await _("worktree.list", {});
        return M?.type === "worktree.list.result" && x({ worktrees: M.worktrees ?? [], defaultRoot: M.defaultRoot ?? "", baseRef: M.baseRef, refs: M.refs ?? [] }), Dr(M);
      },
      create: async ({ branch: M, newBranch: B, path: L, extra: I, agent: $ }) => {
        const Q = { branch: M, newBranch: !!B, path: L ?? null, name: I?.name ?? null, startFrom: I?.startFrom ?? null, parentWorkspaceId: I?.parentWorkspaceId ?? null }, { background: Z } = v.current, P = await _(Z ? "worktree.job.start" : "worktree.create", Q), G = Z ? "worktree.job.started" : "worktree.done";
        if (P?.type !== G) return { error: Dr(P).error ?? gm };
        const K = Z ? P.job?.path : P.path;
        return $ && K && bm(a, K, $), { background: Z };
      },
      remove: async (M, B) => {
        const L = await _("worktree.remove", { path: M, force: !!B, deleteBranch: v.current.deleteSupported });
        return { ...Dr(L), preservedBranch: L?.type === "worktree.done" ? L.preservedBranch ?? void 0 : void 0 };
      },
      deleteBranch: async (M, B) => Dr(await _("worktree.branch.delete", { branch: M, expectedHead: B })),
      open: (M) => Tt().startSession?.(a, M, "terminal"),
      // The window forgets the request; the screen keeps it until a newer one, as clearing it would re-run (and so
      // cancel) the screen's effect that a measurement put off until the next frame (`measured`).
      takeRequest: () => Tt().takeWorktreeRequest?.()
    };
  }, [a, l]);
  return dt.createElement(ks, {
    hostId: a,
    cwd: l,
    projectKey: w,
    className: s,
    worktrees: p,
    background: S,
    startFromSupported: z,
    deleteSupported: y,
    parentChoices: N,
    emptyAgent: D,
    request: R,
    actions: h
  });
}
const j1 = (a, l) => {
  if (!Tt().followPointer?.(a)) return;
  const s = l.items();
  for (const i of s) i.getBoundingClientRect();
  s[0]?.parentElement?.getBoundingClientRect(), zb(a, l);
}, O1 = () => re((a) => a.workspaceTabs()), R1 = () => re((a) => a.statusLine()), D1 = () => re((a) => a.zoom()), B1 = () => re((a) => a.paneLook()), H1 = () => re((a) => a.keybindings?.() ?? []), U1 = Object.freeze({ usage: Object.freeze([]), updatedAt: 0, spend: null, redeemResult: null });
function q1(a) {
  const l = !!a?.keepFresh, s = re((o) => o.statusLine?.().connected ?? !1), i = re((o) => o.planUsage?.() ?? U1);
  return Fe(() => {
    if (!l || !s) return;
    let o;
    const d = () => {
      Tt().command("usage.get"), o = setTimeout(d, 18e4);
    };
    return d(), () => clearTimeout(o);
  }, [l, s]), i;
}
const Y1 = () => Tt().command("usage.get", { force: !0 }), G1 = (a) => Tt().command("usage.redeemReset", { accountId: a }), K1 = () => ei("app.zoom_reset"), Q1 = {
  focused: "bg-[color-mix(in_srgb,var(--text)_10%,var(--panel-bg))] hover:bg-[color-mix(in_srgb,var(--text)_10%,var(--panel-bg))] text-fg font-semibold",
  visible: "bg-transparent text-subtext-0 hover:bg-surface-0 hover:text-fg",
  hidden: "bg-transparent text-subtext-0 hover:bg-surface-0 hover:text-fg"
}, V1 = (a, l, s) => Tt().beginTabDrag?.(a, l, s);
function X1(a) {
  Fe(() => Tt().onRequest?.("new-tab", a) ?? void 0, [a]);
}
const L1 = (a) => ei("browser.open", { workspaceId: a }), Z1 = (a, l) => ei("file.open", { workspaceId: a, path: l }), J1 = () => null, W1 = () => null, F1 = da("new-file"), uy = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  AgentIcon: pm,
  Chevron: om,
  CloseIcon: Gb,
  ConfirmDialog: x1,
  Dialog: N1,
  EllipsisIcon: qb,
  FolderBrowser: k1,
  GearIcon: Yb,
  HostStateDot: Kb,
  InstructionsDialog: E1,
  MemoryDialog: z1,
  ModeSwitch: gv,
  NewFilePrompt: F1,
  NewSessionMenu: b1,
  PageIcon: uv,
  PlusIcon: lm,
  QrCode: Ev,
  Select: w1,
  SessionDot: m1,
  SessionMenu: g1,
  SettingRow: Nv,
  SettingsGroup: zv,
  SettingsQuery: Nl,
  Slot: p1,
  Switch: Tv,
  TabDragLayer: W1,
  TabMenu: J1,
  WorktreeMenu: C1,
  agentStateColor: Iv,
  anchoredPopoverStyle: Yv,
  beginReorderDrag: j1,
  beginTabDrag: V1,
  bindHost: Uv,
  buttonClass: Lv,
  cn: ue,
  drawConfirmationsInPlace: y1,
  drawFolderBrowserInPlace: _1,
  drawWorktreeInPlace: T1,
  ghostButton: Wv,
  glassClass: Dv,
  iconButton: Fv,
  isMac: Kv,
  keyLabel: Qv,
  menuDividerClass: Jv,
  menuItemClass: Zv,
  menuPanel: am,
  nestSessions: f1,
  newId: Gv,
  openBrowserTab: L1,
  openFileTab: Z1,
  pickFolder: e1,
  redeemUsageReset: G1,
  refreshUsage: Y1,
  resetZoom: K1,
  rowActionClass: Xv,
  runCommand: ei,
  segmentClass: Vv,
  settingsClass: Mv,
  shortcutFor: $v,
  shortcutLabel: Pv,
  startPaneWhenReady: bm,
  startSession: t1,
  tabStateClass: Q1,
  tapButtonClass: Bv,
  useAddProject: l1,
  useAddProjectRequest: d1,
  useAgentChoices: u1,
  useDismissOnOutsideClick: sm,
  useHostSnapshot: re,
  useHosts: n1,
  useKeybindings: H1,
  useNavigation: fm,
  useNewTabRequest: X1,
  useNotifications: c1,
  usePaneLook: B1,
  usePlanUsage: q1,
  useResourceState: Rv,
  useSessionFolders: a1,
  useSettingsQuery: Cv,
  useStatusLine: R1,
  useWorkspaceTabs: O1,
  useZoom: D1,
  version: Hv
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
const Es = {
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
  Es[a] = (l, s) => l[a](s);
const dy = Object.keys(Es);
function Wo(a, l) {
  for (const [s, i] of Object.entries(l)) {
    const o = Es[s];
    if (!o) throw new Error(`the description key ${s} has no GPUI builder`);
    i != null && (a = o(a, i));
  }
  return a;
}
const Un = (a) => ({ clientX: a?.position?.x ?? 0, clientY: a?.position?.y ?? 0 }), ff = /* @__PURE__ */ new WeakSet(), Fo = /* @__PURE__ */ new WeakSet();
function mf(a, l, s) {
  const i = a.pressed, o = Un(s);
  return i && i.x === o.clientX && i.y === o.clientY ? i.id : l;
}
function I1(a, l, s) {
  if (a.name) return a.name;
  if (!(l.size || a.hover || a.focus || a.active || a.track_hover && Wr.has(a.group) || s)) return null;
  const i = a.meta?.attrs["data-testid"];
  return i ? `~${a.id}:${i}` : `~${a.id}`;
}
const vm = (a, l = !1) => (a.children ?? []).some((s) => s.kind === "text" ? !l || /\s/.test(String(s.text ?? "").trim()) : s.kind === "div" && s.style?.flex_direction !== "row" && s.style?.whitespace !== "nowrap" && vm(s, !0)), Ne = (a) => a.style?.display !== "hidden";
let Wr = /* @__PURE__ */ new Set();
function ym(a, l = /* @__PURE__ */ new Set()) {
  for (const { group: s, style: i } of a.group_hover ?? []) "display" in i && l.add(s);
  for (const s of a.children ?? []) s.kind !== "text" && ym(s, l);
  return l;
}
function fs(a, l, s, i, o = !1, d = !1, m = null, f = {}, p = !1, x = /* @__PURE__ */ new Map(), k = null) {
  if (a.kind === "text") return x.get(a)?.text ?? a.text;
  const E = ff.has(a);
  d ||= a.style.opacity === 0 || a.style.visibility === "invisible" || a.style.display === "hidden", d && (a.name || a.range_name) && (a = { ...a, name: void 0, range_name: void 0, also: void 0 }), a.style.text_color !== void 0 && (k = null), m = a.style.text_color ?? m;
  const w = !!a.hover?.text_color && Sm(a), N = a.group ?? (w ? `~g${a.id}` : null);
  w && (k = { group: N, color: a.hover.text_color }), f = { ...f };
  for (const h of ["text_size", "line_height", "whitespace", "text_ellipsis"]) a.style[h] !== void 0 && (f[h] = a.style[h]);
  const S = new Set(a.events ?? []);
  let y;
  if (a.kind === "image" && !a.markup ? y = l.image(a.src) : y = l.div(), a.kind === "engine" && (y = y.child(i.engine ? i.engine(a.engine, a.key) : l.div())), a.markup && a.kind === "svg" && k && k.color !== m) {
    const { group: h, color: _ } = k, M = () => l.div().absolute().top(0).left(0).size_full();
    y = y.child(M().group_hover(h, (B) => B.invisible()).child(i.icon(`~icon-${a.id}`, a.markup, m))).child(M().invisible().group_hover(h, (B) => B.visible()).child(i.icon(`~icon-${a.id}-hover`, a.markup, _)));
  } else a.markup && (y = y.child(i.icon(`~icon-${a.id}`, a.markup, a.kind === "svg" ? m : "")));
  const z = I1(a, S, o);
  if (z && (y = y.id(z)), a.measure && (y = y.measure(a.measure)), a.name && y.also_named) for (const h of a.also ?? []) y = y.also_named(h);
  y = Wo(y, { ...a.style, ...x.get(a) });
  const O = f.whitespace !== "nowrap" && !f.text_ellipsis;
  p && O && a.style.flex_shrink !== 0 && a.style.min_w === void 0 && vm(a) && (y = y.min_w(0));
  for (const h of ["hover", "focus", "active"]) a[h] && (y = y[h]((_) => Wo(_, a[h])));
  N && (y = y.group(N));
  for (const { group: h, style: _ } of a.group_hover ?? []) {
    const { display: M, ...B } = _;
    Object.keys(B).length && (y = y.group_hover(h, (L) => Wo(L, B)));
  }
  if (l.scroll && (a.style.overflow_x === "scroll" || a.style.overflow_y === "scroll")) {
    const h = s.document?.scrollTarget, _ = h ? (a.children ?? []).filter(Ne).findIndex((M) => _m(M, h.id)) : -1;
    if (_ >= 0 && (s.scroller ?? a.id) === a.id && (s.document.scrollTarget = null, s.scroller = a.id, l.scroll.scroll_to_item(_)), s.scroller ??= a.id, s.scroller === a.id && s.document) {
      y = y.track_scroll(l.scroll);
      const M = (a.children ?? []).filter(Ne).map((B) => B.id);
      s.document.itemBounds = (B) => M.includes(B) ? l.scroll.item_bounds?.(M.indexOf(B)) ?? null : null;
    }
  }
  const D = a.style.overflow_x === "scroll" || a.style.overflow_y === "scroll";
  if (D && Fo.has(a) && (y = y.on_scroll_wheel((h, _) => _.stop_propagation?.())), D || Fo.has(a)) for (const h of a.children ?? []) h.kind !== "text" && Fo.add(h);
  a.kind === "input" && !a.disabled && (y = y.on_mouse_down("left", (h, _) => {
    h.bounds && s.setBounds(a.id, h.bounds), s.focus(a.id), _.notify();
  }));
  const A = a.kind === "input" ? a : a.meta?.tag === "label" ? wm(a) : null;
  A && !A.disabled && /^(checkbox|radio)$/.test(A.input_type) && (y = y.on_click((h, _) => {
    _.stop_propagation?.(), s.toggle(A.id), _.notify();
  }));
  const X = ["click", "double_click", "context_menu", "mouse_down", "mouse_up"].some((h) => S.has(h));
  if (X || E) for (const h of a.children ?? []) h.kind !== "text" && ff.add(h);
  if (X && (y = y.on_mouse_down("left", (h, _) => {
    _.stop_propagation?.(), h.bounds && s.setBounds(a.id, h.bounds);
    const M = { ...Un(h), button: 0, buttons: 1, detail: h.click_count }, B = mf(s, a.id, h);
    s.pressed = null, s.dispatch(B, "pointerdown", { ...M, pointerType: "mouse" }), s.dispatch(B, "mousedown", M) && s.pressFocus?.(B), _.notify();
  }), y = y.on_mouse_down("right", (h, _) => {
    _.stop_propagation?.(), h.bounds && s.setBounds(a.id, h.bounds);
    const M = mf(s, a.id, h);
    s.pressed = null, s.dispatch(M, "contextmenu", { ...Un(h), button: 2 }), _.notify();
  }), y = y.on_mouse_up("left", (h, _) => {
    _.stop_propagation?.();
    const M = { ...Un(h), button: 0 };
    s.dispatch(a.id, "pointerup", { ...M, pointerType: "mouse" }), s.dispatch(a.id, "mouseup", M), _.notify();
  }), y = y.on_click((h, _) => {
    s.dispatch(a.id, h.click_count === 2 && S.has("double_click") ? "dblclick" : "click", { detail: h.click_count, button: 0 }), _.notify();
  })), a.blocks_pointer && !X)
    for (const h of ["left", "right"]) y = y.on_mouse_down(h, (_, M) => M.stop_propagation?.());
  else if (E && !X)
    for (const h of ["left", "right"])
      y = y.on_mouse_down(h, (_) => {
        const M = Un(_);
        (s.pressed?.x !== M.clientX || s.pressed?.y !== M.clientY) && (s.pressed = { id: a.id, x: M.clientX, y: M.clientY });
      });
  if (S.has("mouse_move") && (y = y.on_mouse_move((h) => {
    s.dispatch(a.id, "pointermove", { ...Un(h), pointerType: "mouse" });
  })), a.track_hover && Wr.has(a.group) && (y = y.on_hover((h, _) => {
    s.hover(a.id, h), _.notify();
  })), o && (y = y.on_mouse_down_out((h, _) => {
    s.dispatch(s.document.body.id, "pointerdown", { ...Un(h), pointerType: "mouse" }), s.dispatch(s.document.body.id, "mousedown", Un(h)), _.notify();
  })), a.kind === "input" && !/^(checkbox|radio|range|color|file|select)$/.test(a.input_type)) {
    const h = a.value ? String(a.value) : String(a.placeholder ?? "");
    let _ = l.div().whitespace_nowrap().overflow_x_hidden();
    const M = ca(f);
    M && (_ = _.h(M)), !a.value && m && (_ = _.text_color(P1(m))), h && (y = y.child(_.child(a.input_type === "password" && a.value ? "•".repeat([...h].length) : h))), a.field_w && (y = y.child(l.div().w(a.field_w).h(0)));
  }
  const U = f.whitespace === "nowrap" ? ca(f) : null, R = a.style.display === "flex" && !String(a.style.flex_direction ?? "row").startsWith("col");
  let g = !a.range_name;
  const v = a.style.display === "flex" && String(a.style.flex_direction ?? "row").startsWith("col") && (a.style.h === void 0 || a.style.h === "auto") && typeof a.style.max_h == "number";
  for (const h of (a.children ?? []).filter(Ne)) {
    const _ = h.style?.flex_basis;
    v && h.style.flex_grow > 0 && (_ === 0 || typeof _ == "string" && _.endsWith("%")) && x.set(h, { ...x.get(h), flex_basis: "auto" });
    let M = fs(h, l, s, i, !1, d, m, f, R && h.style?.position !== "absolute", x, k);
    const B = !g && (h.kind === "text" || !h.meta), L = h.kind === "text" ? x.get(h)?.h ?? U : null, I = h.kind === "text" ? x.get(h)?.w : void 0;
    if (B || L || I !== void 0) {
      let $ = l.div();
      B && ($ = $.id(a.range_name)), B && !R && a.style.display === "flex" && ($ = $[`self_${$1[f.text_align] ?? "start"}`]().max_w("100%")), L && ($ = $.h(L)), I !== void 0 && ($ = $.w(I).flex_none().whitespace_nowrap()), M = $.child(M), g ||= B;
    }
    y = y.child(M);
  }
  return y;
}
const $1 = { center: "center", right: "end", end: "end" };
function P1(a) {
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
function fy(a, l, s, i, o = 0, d = !1) {
  const m = [a.root, ...a.overlays];
  Wr = /* @__PURE__ */ new Set();
  for (const k of m) ym(k, Wr);
  const f = o > 0 ? iy(m, o) : /* @__PURE__ */ new Map();
  o > 0 && i.measure && ty(m, o, i.measure, f), ly(m, f), ay(m, f), i.measure && ny(m, i.measure, f);
  let p = l.div().relative().size_full().child(fs(a.root, l, s, i, !1, !1, null, {}, !1, f)), x = d && a.overlays.length ? l.div().relative().size_full().window_layer() : p;
  for (const k of a.overlays) x = x.child(fs(k, l, s, i, !0, !1, null, {}, !1, f));
  return x === p ? p : p.child(x);
}
function ty(a, l, s, i) {
  const o = (S, y) => i.set(S, { ...i.get(S), ...y }), d = /* @__PURE__ */ new Map(), m = /* @__PURE__ */ new Map(), f = ["text_size", "font_weight", "font_family", "italic", "whitespace", "text_ellipsis"];
  function p(S, y, z) {
    if (S.kind === "text") {
      if (!(y.whitespace === "nowrap" || xm.test(S.text)) || y.text_ellipsis || z || typeof y.text_size != "number") return NaN;
      const g = s(S.text, { size: y.text_size, weight: y.font_weight ?? 400, family: y.font_family ?? ".SystemUIFont", italic: !!y.italic });
      return Number.isFinite(g) ? g : NaN;
    }
    if (!Ne(S) || S.kind === "input" || S.kind === "engine" || S.markup) return x(S);
    const O = { ...y };
    for (const R of f) S.style[R] !== void 0 && (O[R] = S.style[R]);
    O.text_ellipsis = !!S.style.text_ellipsis, m.set(S, O);
    const D = S.style, A = (S.children ?? []).filter(Ge), X = A.map((R) => p(R, O, z || !!S.tabular));
    let U = x(S);
    if (!Number.isFinite(U) && D.w === void 0) {
      const R = A.map((v, h) => X[h] + (v.kind === "text" ? 0 : rt(v.style.ml) + rt(v.style.mr)));
      let g;
      A.length ? Oe(S) ? g = A.some((v) => v.kind !== "text" && v.style.flex_grow > 0) || D.flex_wrap === "wrap" ? NaN : R.reduce((v, h) => v + h, 0) + rt(D.gap_x) * (A.length - 1) : g = Math.max(...R) : g = 0, U = g + rt(D.pl) + rt(D.pr) + rt(D.border_l) + rt(D.border_r), typeof D.min_w == "number" && (U = Math.max(U, D.min_w)), typeof D.max_w == "number" && (U = Math.min(U, D.max_w));
    }
    return d.set(S, U), U;
  }
  const x = (S) => typeof S.style?.w == "number" ? S.style.w : NaN, k = () => ({ exact: 0, laid: 0 }), E = (S, y) => {
    if (!Number.isFinite(y))
      return Object.assign(S, k()), NaN;
    S.exact += y;
    const z = Math.round(S.exact * l + 1e-9) / l, O = z - S.laid;
    return S.laid = z, O;
  }, w = (S) => Oe(S) && S.style.flex_wrap !== "wrap" && (S.style.justify ?? "start") === "start";
  function N(S) {
    if (!S || S.kind === "text" || !Ne(S)) return;
    const y = (S.children ?? []).filter(Ge);
    if (w(S) && y.length > 1) {
      const z = rt(S.style.gap_x), O = k(), D = !(z && y.some((A) => A.kind === "text" || !Number.isFinite(rt(A.style.ml))));
      o(S, { border_l: E(O, rt(S.style.border_l)), pl: E(O, rt(S.style.pl)) }), D && z && o(S, { gap_x: 0 }), y.forEach((A, X) => {
        const U = (X && D ? z : 0) + (A.kind === "text" ? 0 : rt(A.style.ml));
        if (A.kind === "text")
          U && Object.assign(O, k());
        else {
          const h = E(O, U);
          Number.isFinite(h) && o(A, { ml: h });
        }
        const R = A.kind === "text" ? m.get(S) ?? {} : null, g = A.kind === "text" ? p(A, R, !!S.tabular) : d.get(A);
        if ((A.kind === "text" || !(A.style.flex_grow > 0)) && Number.isFinite(g)) {
          const h = { w: E(O, g) };
          A.kind !== "text" && typeof A.style.w != "number" && A.style.min_w === void 0 && (h.whitespace = "nowrap", h.flex_shrink = 0), o(A, h);
        } else Object.assign(O, k());
        if (A.kind !== "text") {
          const h = E(O, rt(A.style.mr));
          Number.isFinite(h) && o(A, { mr: h });
        }
      });
    }
    for (const z of S.children ?? []) z.kind !== "text" && N(z);
  }
  for (const S of a)
    S && (p(S, {}, !1), N(S));
}
const ey = /(?<= +)(?=[^ ])|(?<=[\p{L}\p{N}]-)(?=[\p{L}\p{N}])/u;
function ny(a, l, s) {
  const i = ["text_size", "font_weight", "font_family", "italic", "line_height"], o = (f) => typeof f == "number" ? f : 0, d = (f, p) => p && Fr(p) && !Oe(p) && f.style.position !== "absolute" && !["start", "center", "end"].includes(f.style.self) && !["start", "center", "end"].includes(p.style.items), m = (f, p, x, k) => {
    if (!f || f.kind === "text" || !Ne(f)) return;
    const E = f.style;
    let w = typeof E.w == "number" ? E.w : E.w === "100%" ? x : d(f, p) ? x - o(E.ml) - o(E.mr) : NaN;
    typeof E.max_w == "number" && (w = Math.min(w, E.max_w));
    const N = w - o(E.pl) - o(E.pr) - o(E.border_l) - o(E.border_r), S = { ...k };
    for (const z of i) E[z] !== void 0 && (S[z] = E[z]);
    const y = f.children ?? [];
    if (f.break_anywhere && Number.isFinite(N) && N > 0 && typeof S.text_size == "number" && y.length && y.every((z) => z.kind === "text")) {
      const z = { size: S.text_size, weight: S.font_weight ?? 400, family: S.font_family ?? ".SystemUIFont", italic: !!S.italic }, O = (X) => l(X.trimEnd(), z) <= N + 0.01;
      let D = 0;
      for (const X of y) {
        const U = [];
        for (const g of X.text.split(`
`)) {
          let v = "";
          for (const h of g.split(ey)) {
            if (O(v + h)) {
              v += h;
              continue;
            }
            v && U.push(v.trimEnd()), v = "";
            for (const _ of h)
              v && !O(v + _) && (U.push(v), v = ""), v += _;
          }
          U.push(v.trimEnd());
        }
        const R = U.join(`
`);
        U.every((g) => !g || O(g)) ? R !== X.text && s.set(X, { ...s.get(X), text: R }) : D = NaN, D += U.length;
      }
      const A = ca(S);
      Number.isFinite(D) && A && E.h === void 0 && y.length === 1 && s.set(f, { ...s.get(f), h: D * A + o(E.pt) + o(E.pb) + o(E.border_t) + o(E.border_b) });
    }
    for (const z of y) m(z, f, Oe(f) ? NaN : N, S);
  };
  for (const f of a) m(f, null, NaN, {});
}
function ay(a, l) {
  const s = (i, o) => {
    if (!i || i.kind === "text" || !Ne(i)) return;
    const d = i.style, m = d.position === "absolute" ? d.w === void 0 && (d.left === void 0 || d.right === void 0) : o && typeof d.w != "number";
    if (m && Oe(i))
      for (const f of i.children ?? []) {
        const p = f.kind === "text" ? void 0 : f.style.flex_basis;
        f.kind !== "text" && f.style.flex_grow > 0 && (p === 0 || typeof p == "string" && p.endsWith("%")) && l.set(f, { ...l.get(f), flex_basis: "auto" });
      }
    for (const f of i.children ?? []) s(f, m);
  };
  for (const i of a) s(i, !1);
}
function ly(a, l) {
  const s = l.heights ?? /* @__PURE__ */ new Map(), i = (p) => s.get(p), o = (p) => {
    const x = i(p);
    if (Number.isFinite(x)) return x;
    if (p.kind === "text" || !Ne(p)) return 0;
    const k = p.style, E = typeof k.min_h == "number" ? k.min_h : 0, w = (p.children ?? []).filter(Ge), N = w.map((z) => o(z) + (z.kind === "text" ? 0 : Math.max(0, rt(z.style.mt) || 0) + Math.max(0, rt(z.style.mb) || 0))), S = w.length ? Oe(p) ? Math.max(...N) : N.reduce((z, O) => z + O, 0) + (k.display === "flex" ? (rt(k.gap_y) || 0) * (w.length - 1) : 0) : 0, y = [k.pt, k.pb, k.border_t, k.border_b].reduce((z, O) => z + (rt(O) || 0), 0);
    return Math.max(E, S + y);
  }, d = (p) => !(p.children ?? []).filter(Ge).length || Oe(p) ? NaN : o({ ...p, style: { ...p.style, h: void 0, max_h: void 0, min_h: void 0 } }), m = (p, x) => {
    const k = p.style;
    if (typeof k.h == "number") return k.h;
    if (typeof k.max_h == "number") return k.max_h;
    if (!x || !Fr(x) || Oe(x)) return NaN;
    const E = x.style, w = typeof E.h == "number" ? E.h : typeof E.max_h == "number" ? E.max_h : NaN, N = (x.children ?? []).filter(Ge);
    let S = 0;
    for (const z of N) {
      if (z === p) continue;
      const O = i(z);
      if (!Number.isFinite(O)) return NaN;
      S += O + (z.kind === "text" ? 0 : rt(z.style.mt) + rt(z.style.mb));
    }
    const y = E.display === "flex" ? rt(E.gap_y) * Math.max(0, N.length - 1) : 0;
    return w - rt(E.pt) - rt(E.pb) - rt(E.border_t) - rt(E.border_b) - S - y - rt(k.mt) - rt(k.mb);
  }, f = (p, x) => {
    if (!(!p || p.kind === "text" || !Ne(p))) {
      if (p.scrollbar > 0 && p.style.overflow_y === "scroll") {
        const k = d(p), E = m(p, x);
        Number.isFinite(k) && Number.isFinite(E) && k > E + 0.01 && l.set(p, { ...l.get(p), pr: rt(p.style.pr) + p.scrollbar });
      }
      for (const k of p.children ?? []) f(k, p);
    }
  };
  for (const p of a) f(p, null);
}
const ry = ["text_size", "line_height", "whitespace", "text_ellipsis"], rt = (a) => a == null ? 0 : typeof a == "number" ? a : NaN, Fr = (a) => a.style.display === "flex" ? a.style.flex_direction === "col" : !0, Oe = (a) => a.style.display === "flex" && (a.style.flex_direction ?? "row") === "row", Ge = (a) => a.kind === "text" || Ne(a) && a.style.position !== "absolute";
function iy(a, l) {
  const s = /* @__PURE__ */ new Map(), i = (y, z) => s.set(y, { ...s.get(y), ...Object.fromEntries(Object.entries(z).filter(([, O]) => Number.isFinite(O))) }), o = /* @__PURE__ */ new Map(), d = /* @__PURE__ */ new Map();
  function m(y, z) {
    if (y.kind === "text") return z.whitespace === "nowrap" || xm.test(y.text) ? ca(z) ?? NaN : NaN;
    const O = { ...z };
    for (const R of ry) y.style[R] !== void 0 && (O[R] = y.style[R]);
    d.set(y, O);
    const D = y.style, A = (y.children ?? []).filter(Ge), X = A.map((R) => m(R, O));
    let U;
    if (D.h !== void 0 && D.h !== "auto") U = rt(D.h);
    else if (y.kind === "engine") U = NaN;
    else if (y.kind === "input")
      U = (y.input_type === "textarea" || y.input_type === "select" ? NaN : ca(O) ?? NaN) + rt(D.pt) + rt(D.pb) + rt(D.border_t) + rt(D.border_b), D.min_h !== void 0 && (U = Math.max(U, rt(D.min_h)));
    else {
      const R = A.map((v, h) => (v.kind === "text" ? 0 : rt(v.style.mt) + rt(v.style.mb)) + X[h]);
      let g;
      if (Oe(y)) g = D.flex_wrap === "wrap" ? NaN : D.items === "baseline" ? p(A, X, O) : Math.max(0, ...R);
      else if (Fr(y)) {
        const v = A.some((_) => _.kind !== "text" && (_.style.flex_grow > 0 || _.style.flex_basis !== void 0)), h = D.display !== "flex" && A.some((_) => _.kind !== "text" && (rt(_.style.mt) || rt(_.style.mb)));
        g = v || h ? NaN : R.reduce((_, M) => _ + M, 0) + (D.display === "flex" ? rt(D.gap_y) * Math.max(0, A.length - 1) : 0);
      } else g = NaN;
      U = g + rt(D.pt) + rt(D.pb) + rt(D.border_t) + rt(D.border_b), D.min_h !== void 0 && (U = Math.max(U, rt(D.min_h))), D.max_h !== void 0 && (U = Math.min(U, rt(D.max_h)));
    }
    return o.set(y, U), U;
  }
  const f = (y) => (ca(y) - (Xr + Rf) * y.text_size) / 2 + Xr * y.text_size;
  function p(y, z, O) {
    let D = 0, A = 0;
    for (const [X, U] of y.entries()) {
      const R = U.kind === "text" ? O : d.get(U);
      if (!(U.kind === "text" || (U.children ?? []).filter(Ge).every((_) => _.kind === "text")) || !Number.isFinite(z[X]) || typeof R.text_size != "number") return NaN;
      const v = U.kind === "text" ? {} : U.style, h = rt(v.mt) + rt(v.border_t) + rt(v.pt) + f(R);
      D = Math.max(D, h), A = Math.max(A, rt(v.mt) + z[X] + rt(v.mb) - h);
    }
    return D + A;
  }
  const x = () => ({ exact: 0, laid: 0 }), k = (y, z) => {
    if (!Number.isFinite(z))
      return Object.assign(y, x()), NaN;
    y.exact += z;
    const O = Math.round(y.exact * l + 1e-9) / l, D = O - y.laid;
    return y.laid = O, D;
  };
  function E(y) {
    if (!(y.kind === "text" || !Ne(y))) {
      for (const z of (y.children ?? []).filter((O) => O.kind !== "text" && Ne(O) && O.style.position === "absolute")) E(z);
      if (Fr(y) && !Oe(y)) {
        const z = x();
        i(y, { border_t: k(z, rt(y.style.border_t)), pt: k(z, rt(y.style.pt)) }), w(y, z);
      } else for (const z of (y.children ?? []).filter(Ge)) z.kind !== "text" && E(z);
    }
  }
  function w(y, z) {
    const O = (y.children ?? []).filter(Ge), D = y.style.display === "flex" ? rt(y.style.gap_y) : 0;
    if (D && O.some((A) => A.kind === "text")) {
      for (const A of O) A.kind !== "text" && E(A);
      return !1;
    }
    return D && i(y, { gap_y: 0 }), O.forEach((A, X) => {
      if (A.kind === "text") {
        const U = o.get(A) ?? m(A, d.get(y) ?? {});
        Number.isFinite(U) ? i(A, { h: k(z, U) }) : Object.assign(z, x());
        return;
      }
      if (i(A, { mt: k(z, (X ? D : 0) + rt(A.style.mt)) }), Number.isFinite(o.get(A))) S(A, z);
      else if (N(A)) {
        const U = A.style;
        i(A, { border_t: k(z, rt(U.border_t)), pt: k(z, rt(U.pt)) }), i(A, { pb: k(z, rt(U.pb)), border_b: k(z, rt(U.border_b)) });
      } else
        E(A), Object.assign(z, x());
      i(A, { mb: k(z, rt(A.style.mb)) });
    }), !0;
  }
  function N(y) {
    const z = y.style, O = (y.children ?? []).filter(Ge), D = ca(d.get(y) ?? {});
    return y.kind === "div" && !Oe(y) && O.length > 0 && O.every((A) => A.kind === "text") && Number.isInteger(D) && [z.h, z.min_h, z.max_h].every((A) => A === void 0 || A === "auto");
  }
  function S(y, z) {
    const O = y.style;
    for (const R of (y.children ?? []).filter((g) => g.kind !== "text" && Ne(g) && g.style.position === "absolute")) E(R);
    const D = z.laid, A = z.exact;
    i(y, { border_t: k(z, rt(O.border_t)), pt: k(z, rt(O.pt)) });
    const X = O.h !== void 0 && O.h !== "auto", U = o.get(y) - rt(O.pt) - rt(O.pb) - rt(O.border_t) - rt(O.border_b);
    if (y.kind === "input")
      X || k(z, U);
    else if (Oe(y) || X && (O.justify ?? "start") !== "start") {
      for (const R of (y.children ?? []).filter(Ge)) R.kind !== "text" && E(R);
      X || k(z, U);
    } else !w(y, z) && !X && k(z, U);
    if (X) {
      z.exact = A + o.get(y), z.laid = Math.round(z.exact * l + 1e-9) / l, i(y, { h: z.laid - D });
      return;
    }
    i(y, { pb: k(z, rt(O.pb)), border_b: k(z, rt(O.border_b)) }), i(y, { h: z.laid - D });
  }
  for (const y of a)
    m(y, {}), E(y);
  return Object.defineProperty(s, "heights", { value: o }), s;
}
const my = { sidebar: [{ name: "sidebar-root", selector: "aside.sidebar" }, { name: "sidebar-content", selector: "aside.sidebar > div:first-child" }, { name: "host-switcher", selector: '[data-testid="host-switcher"]' }, { name: "host-chip", selector: '[data-testid="host-switcher"] > div' }, { name: "host-badge", selector: ".sidebar__env-badge" }, { name: "host-name", selector: ".sidebar__env-host" }, { name: "host-meta", selector: '[data-testid="host-switcher"] > div > div:first-child > span:nth-child(3)' }, { name: "host-line", selector: ".sidebar__env-cwd" }, { name: "host-caret", selector: '[data-testid="host-switcher"] > span[aria-hidden="true"]' }, { name: "new-session-button", selector: 'button[data-testid^="new-session-"]', key: { self: !0, attr: "data-testid", strip: "new-session-" } }, { name: "new-session-icon", selector: 'button[data-testid^="new-session-"] > svg' }, { name: "new-session-label", selector: 'button[data-testid^="new-session-"]', textRange: !0 }, { name: "new-session-shortcut", selector: 'button[data-testid^="new-session-"] > span' }, { name: "overview", selector: '[data-testid="workspace-overview"]' }, { name: "overview-header", selector: '[data-testid="workspace-overview"] > div:first-child' }, { name: "overview-title", selector: '[data-testid="workspace-overview"] > div:first-child > div:first-child > span:first-child' }, { name: "needs-you-button", selector: '[data-testid="workspace-needs-you"]' }, { name: "organize-button", selector: '[data-testid="workspace-organize"]' }, { name: "organize-icon", selector: '[data-testid="workspace-organize"] > svg' }, { name: "add-project-button", selector: '[data-testid="workspace-add-project"]' }, { name: "add-project-icon", selector: '[data-testid="workspace-add-project"] > svg' }, { name: "add-project-label", selector: '[data-testid="workspace-add-project"]', textRange: !0 }, { name: "project-list", selector: '[data-testid="project-list"]' }, { name: "project", selector: ".workspace-project", key: { self: !0, attr: "data-testid", strip: "workspace-project-" } }, { name: "project-header", selector: ".workspace-project > div:first-child", key: { closest: ".workspace-project", attr: "data-testid", strip: "workspace-project-" } }, { name: "project-toggle", selector: '[data-testid^="project-toggle-"]', key: { self: !0, attr: "data-testid", strip: "project-toggle-" } }, { name: "project-chevron", selector: '[data-testid^="project-toggle-"] > svg:not([data-testid])', key: { closest: '[data-testid^="project-toggle-"]', attr: "data-testid", strip: "project-toggle-" } }, { name: "project-folder-icon", selector: '[data-testid="project-folder-icon"]', key: { closest: '[data-testid^="project-toggle-"]', attr: "data-testid", strip: "project-toggle-" } }, { name: "project-name", selector: '[data-testid^="project-toggle-"] strong', key: { closest: '[data-testid^="project-toggle-"]', attr: "data-testid", strip: "project-toggle-" } }, { name: "project-branch", selector: '[data-testid^="project-toggle-"] > span.whitespace-nowrap', key: { closest: '[data-testid^="project-toggle-"]', attr: "data-testid", strip: "project-toggle-" } }, { name: "project-dirty-mark", selector: '[data-testid^="project-toggle-"] > span[title="Uncommitted changes"]', key: { closest: '[data-testid^="project-toggle-"]', attr: "data-testid", strip: "project-toggle-" } }, { name: "project-rollup", selector: '[data-testid^="project-rollup-"]', key: { self: !0, attr: "data-testid", strip: "project-rollup-" } }, { name: "project-rollup-badge", selector: '[data-testid^="project-rollup-"] > span', key: { closest: '[data-testid^="project-rollup-"]', attr: "data-testid", strip: "project-rollup-" } }, { name: "project-menu-button", selector: '[data-testid^="workspace-project-menu-"]', key: { self: !0, attr: "data-testid", strip: "workspace-project-menu-" } }, { name: "project-add-button", selector: ".workspace-project > div:first-child .worktree-menu__btn", key: { closest: ".workspace-project", attr: "data-testid", strip: "workspace-project-" } }, { name: "project-workspaces", selector: ".workspace-project__workspaces", key: { closest: ".workspace-project", attr: "data-testid", strip: "workspace-project-" } }, { name: "workspace", selector: '[data-testid="workspace-tree-root"] [data-testid^="workspace-entry-"]', key: { self: !0, attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-button", selector: '[data-testid="workspace-tree-root"] button.workspace-entry__button', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-icon", selector: '[data-testid="workspace-tree-root"] [data-testid="workspace-checkout-icon"]', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-name", selector: '[data-testid="workspace-tree-root"] strong[title="Double-click to rename"]', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-branch", selector: '[data-testid="workspace-tree-root"] button.workspace-entry__button > span.items-baseline > span', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-dirty-mark", selector: '[data-testid="workspace-tree-root"] button.workspace-entry__button > span[title="Uncommitted changes"]', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-pinned-label", selector: '[data-testid="workspace-tree-root"] button.workspace-entry__button > span.shrink-0:not([title])', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "hidden-worktrees-button", selector: '[data-testid^="workspace-hidden-"]', key: { self: !0, attr: "data-testid", strip: "workspace-hidden-" } }, { name: "session-row", selector: 'div[class~="group/row"]', key: { find: 'button[data-testid^="workspace-session-"]:not([data-testid^="workspace-session-close-"])', attr: "data-testid", strip: "workspace-session-" } }, { name: "session-button", selector: 'button[data-testid^="workspace-session-"]:not([data-testid^="workspace-session-close-"])', key: { self: !0, attr: "data-testid", strip: "workspace-session-" } }, { name: "session-mark", selector: ".agent-mark", key: { closest: 'button[data-testid^="workspace-session-"]', attr: "data-testid", strip: "workspace-session-" } }, { name: "session-mark-icon", selector: ".agent-mark > span > *", key: { closest: 'button[data-testid^="workspace-session-"]', attr: "data-testid", strip: "workspace-session-" } }, { name: "session-title", selector: 'button[data-testid^="workspace-session-"] > span.whitespace-nowrap', key: { closest: 'button[data-testid^="workspace-session-"]', attr: "data-testid", strip: "workspace-session-" } }, { name: "status-row-title", selector: "button[data-session] span.truncate:not([data-testid])", key: { closest: 'button[data-testid^="workspace-session-"]', attr: "data-testid", strip: "workspace-session-" } }, { name: "status-row-detail", selector: '[data-testid="status-row-detail"]', key: { closest: 'button[data-testid^="workspace-session-"]', attr: "data-testid", strip: "workspace-session-" } }, { name: "session-state-badge", selector: '[data-testid^="session-state-"]', key: { self: !0, attr: "data-testid", strip: "session-state-" } }, { name: "session-menu-button", selector: '[data-testid^="session-menu-button-"]', key: { self: !0, attr: "data-testid", strip: "session-menu-button-" } }, { name: "session-fold-button", selector: '[data-testid^="session-fold-"]', key: { self: !0, attr: "data-testid", strip: "session-fold-" } }, { name: "session-elbow", selector: '[data-testid^="session-elbow-"]', key: { self: !0, attr: "data-testid", strip: "session-elbow-" } }, { name: "session-rollup", selector: '[data-testid^="session-rollup-"]', key: { self: !0, attr: "data-testid", strip: "session-rollup-" } }, { name: "chats", selector: '[data-testid="workspace-chats"]' }, { name: "chats-header", selector: '[data-testid="workspace-chats"] > div:first-child' }, { name: "chats-toggle", selector: '[data-testid="workspace-chats-collapse"]' }, { name: "chats-label", selector: '[data-testid="workspace-chats-collapse"]', textRange: !0 }, { name: "chats-chevron", selector: '[data-testid="workspace-chats-collapse"] > svg' }, { name: "chats-menu-button", selector: '[data-testid="workspace-chats-menu"]' }, { name: "chats-new-button", selector: '[data-testid="workspace-chats-new"]' }, { name: "chats-new-icon", selector: '[data-testid="workspace-chats-new"] > svg' }, { name: "status-view", selector: '[data-testid="workspace-status-view"]' }, { name: "status-section", selector: '[data-testid^="status-section-"]:not([data-testid^="status-section-title-"])', key: { self: !0, attr: "data-testid", strip: "status-section-" } }, { name: "status-heading", selector: '[data-testid^="status-section-title-"], [data-testid="status-no-sessions-title"]', key: { self: !0, attr: "data-testid" } }, { name: "status-heading-dot", selector: '[data-testid^="status-section-title-"] > span:first-child, [data-testid="status-no-sessions-title"] > span:first-child', key: { closest: '[data-testid^="status-section-title-"], [data-testid="status-no-sessions-title"]', attr: "data-testid" } }, { name: "status-heading-label", selector: '[data-testid^="status-section-title-"] > span:nth-child(2), [data-testid="status-no-sessions-title"] > span:nth-child(2)', key: { closest: '[data-testid^="status-section-title-"], [data-testid="status-no-sessions-title"]', attr: "data-testid" } }, { name: "status-heading-count", selector: '[data-testid^="status-section-title-"] > span[aria-label], [data-testid="status-no-sessions-title"] > span[aria-label]', key: { closest: '[data-testid^="status-section-title-"], [data-testid="status-no-sessions-title"]', attr: "data-testid" } }, { name: "status-heading-note", selector: '[data-testid^="status-section-title-"] > span.truncate, [data-testid="status-no-sessions-title"] > span.truncate', key: { closest: '[data-testid^="status-section-title-"], [data-testid="status-no-sessions-title"]', attr: "data-testid" } }, { name: "status-project", selector: 'div[data-testid^="status-project-"]', key: { self: !0, attr: "data-testid", strip: "status-project-" } }, { name: "status-project-header", selector: 'div[data-testid^="status-project-"] > div:first-child', key: { closest: 'div[data-testid^="status-project-"]', attr: "data-testid", strip: "status-project-" } }, { name: "status-project-icon", selector: 'div[data-testid^="status-project-"] > div:first-child > svg', key: { closest: 'div[data-testid^="status-project-"]', attr: "data-testid", strip: "status-project-" } }, { name: "status-project-title", selector: '[data-testid="status-project-title"]', key: { closest: 'div[data-testid^="status-project-"]', attr: "data-testid", strip: "status-project-" } }, { name: "status-empty-project", selector: '[data-testid^="status-empty-project-"]', key: { self: !0, attr: "data-testid", strip: "status-empty-project-" } }, { name: "status-empty-project-icon", selector: '[data-testid^="status-empty-project-"] > button:first-child > svg', key: { closest: '[data-testid^="status-empty-project-"]', attr: "data-testid", strip: "status-empty-project-" } }, { name: "status-empty-project-title", selector: '[data-testid^="status-empty-project-"] > button > span.whitespace-nowrap', key: { closest: '[data-testid^="status-empty-project-"]', attr: "data-testid", strip: "status-empty-project-" } }, { name: "settings-bar", selector: "aside.sidebar > div:last-child" }, { name: "settings-gear", selector: '[data-testid="settings-gear"]' }, { name: "settings-gear-icon", selector: '[data-testid="settings-gear"] > svg' }], tabs: [{ name: "tab-strip", selector: '[data-testid="tab-bar"]' }, { name: "tab-slot", selector: "[data-tab-entry]", key: { self: !0, attr: "data-tab-entry" } }, { name: "tab-separator", selector: '[data-testid="tab-separator"]', key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab", selector: "button.tab-bar__tab", key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-icon", selector: 'button.tab-bar__tab > span[aria-hidden="true"]', key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-icon-glyph", selector: 'button.tab-bar__tab > span[aria-hidden="true"] > *', key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-label", selector: "button.tab-bar__tab > span.truncate", key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-dirty", selector: 'button.tab-bar__tab > span[aria-label="unsaved changes"]', key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-close", selector: '[data-tab-entry] > button[aria-label^="Close"]', key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-close-glyph", selector: '[data-tab-entry] > button[aria-label^="Close"] > svg', key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-new", selector: '[data-testid="tab-new"]' }, { name: "tab-new-glyph", selector: '[data-testid="tab-new"] > svg' }], status: [{ name: "status-bar", selector: "footer.status-bar" }, { name: "status-location", selector: ".status-bar__location" }, { name: "status-dot", selector: ".status-bar__location > span:first-child" }, { name: "status-host", selector: '[data-testid="status-host"]' }, { name: "status-cwd", selector: ".status-item--cwd" }, { name: "status-branch", selector: ".status-bar__branch" }, { name: "status-branch-icon", selector: ".status-bar__branch > svg" }, { name: "status-branch-name", selector: ".status-bar__branch > span" }, { name: "status-details", selector: ".status-bar__details" }, { name: "zoom-indicator", selector: '[data-testid="zoom-indicator"]' }, { name: "status-detail", selector: ".status-bar__details > span" }, { name: "status-usage", selector: ".status-bar__usage" }, { name: "usage-summary", selector: '[data-testid="usage-summary"]' }, { name: "usage-unavailable", selector: '[data-testid="usage-summary"] > span:only-child' }, { name: "usage-account", selector: '[data-testid="usage-summary"] > span.flex' }, { name: "usage-account-name", selector: '[data-testid="usage-summary"] > span.flex > span:first-child' }, { name: "usage-window", selector: '[data-testid="usage-summary"] > span.flex > span:not(:first-child)' }, { name: "status-connection", selector: '[data-testid="status-connection"]' }, { name: "status-connection-glyph", selector: '[data-testid="status-connection"] > svg' }], navigator: [{ name: "navigator-scrim", selector: "body > div.fixed.inset-0" }, { name: "navigator-panel", selector: '[data-testid="navigator"]' }, { name: "navigator-input", selector: '[data-testid="navigator-input"]' }, { name: "navigator-chips", selector: '[data-testid="navigator"] > div:nth-child(2)' }, { name: "navigator-chip", selector: '[data-testid^="navigator-filter-"]', key: { self: !0, attr: "data-testid", strip: "navigator-filter-" } }, { name: "navigator-list", selector: '[data-testid="navigator"] > div:nth-child(3)' }, { name: "navigator-notice", selector: '[data-testid="navigator"] > div:nth-child(3) > p[role]' }, { name: "navigator-empty", selector: '[data-testid="navigator"] div.text-center' }, { name: "navigator-command", selector: '[data-testid^="navigator-command-"]', key: { self: !0, attr: "data-testid", strip: "navigator-command-" } }, { name: "navigator-command-title", selector: '[data-testid^="navigator-command-"] > span:first-child', key: { closest: '[data-testid^="navigator-command-"]', attr: "data-testid", strip: "navigator-command-" } }, { name: "navigator-command-detail", selector: '[data-testid^="navigator-command-"] > span:last-child', key: { closest: '[data-testid^="navigator-command-"]', attr: "data-testid", strip: "navigator-command-" } }, { name: "navigator-row", selector: '[data-testid^="navigator-row-"]', key: { self: !0, attr: "data-testid", strip: "navigator-row-" } }, { name: "navigator-row-dot", selector: '[data-testid^="navigator-row-"] > :first-child', key: { closest: '[data-testid^="navigator-row-"]', attr: "data-testid", strip: "navigator-row-" } }, { name: "navigator-row-title", selector: '[data-testid^="navigator-row-"] > span:nth-child(2)', key: { closest: '[data-testid^="navigator-row-"]', attr: "data-testid", strip: "navigator-row-" } }, { name: "navigator-row-detail", selector: '[data-testid^="navigator-row-"] > span:last-child', key: { closest: '[data-testid^="navigator-row-"]', attr: "data-testid", strip: "navigator-row-" } }, { name: "navigator-note", selector: '[data-testid="navigator"] > p:last-child' }], "pane-menu": [{ name: "pane-menu", selector: '[data-testid="pane-context-menu"]' }, { name: "pane-menu-item", selector: '[data-testid="pane-context-menu"] > button', key: { self: !0, attr: "data-testid", strip: "pane-menu-" } }, { name: "pane-menu-divider", selector: '[data-testid="pane-context-menu"] > div.h-px' }, { name: "pane-menu-rename-row", selector: '[data-testid="pane-context-menu"] > div.flex' }, { name: "pane-menu-rename-input", selector: '[data-testid="pane-menu-rename-input"]' }, { name: "pane-menu-rename-confirm", selector: '[data-testid="pane-menu-rename-confirm"]' }], confirm: [{ name: "confirm-scrim", selector: "body > div.fixed.inset-0" }, { name: "confirm-panel", selector: '[data-testid="confirm-dialog"]' }, { name: "confirm-message", selector: ".confirm-dialog__message" }, { name: "confirm-extra", selector: '[data-testid="confirm-dialog"] > :not(.confirm-dialog__message):not(div.flex)' }, { name: "confirm-buttons", selector: '[data-testid="confirm-dialog"] > div.flex' }, { name: "confirm-cancel", selector: '[data-testid="confirm-cancel"]' }, { name: "confirm-accept", selector: '[data-testid="confirm-accept"]' }], dialog: [{ name: "dialog-scrim", selector: "body > div.fixed.inset-0" }, { name: "dialog-panel", selector: '[data-testid="file-name-dialog"]' }, { name: "dialog-title", selector: '[data-testid="file-name-dialog"] > h2' }, { name: "dialog-input", selector: '[data-testid="file-name-input"]' }, { name: "dialog-hint", selector: '[data-testid="file-name-dialog"] > p:not([role])' }, { name: "dialog-error", selector: '[data-testid="file-name-dialog"] > p[role="alert"]' }, { name: "dialog-buttons", selector: '[data-testid="file-name-dialog"] > div.flex' }, { name: "dialog-cancel", selector: '[data-testid="file-name-dialog"] > div.flex > button:first-child' }, { name: "dialog-confirm", selector: '[data-testid="file-name-confirm"]' }], toast: [{ name: "toast-stack", selector: '[data-testid="toast"]' }, { name: "toast-card", selector: '[data-testid="toast"] .animate-toast-in' }, { name: "toast-open", selector: '[data-testid^="toast-"]:not([data-testid^="toast-dismiss-"])' }, { name: "toast-mark", selector: '[data-testid^="toast-"]:not([data-testid^="toast-dismiss-"]) > :first-child' }, { name: "toast-heading", selector: '[data-testid^="toast-"]:not([data-testid^="toast-dismiss-"]) > span.min-w-0 > span:first-child' }, { name: "toast-detail", selector: '[data-testid^="toast-"]:not([data-testid^="toast-dismiss-"]) > span.min-w-0 > span:nth-child(2)' }, { name: "toast-dismiss", selector: '[data-testid^="toast-dismiss-"]' }, { name: "toast-dismiss-glyph", selector: '[data-testid^="toast-dismiss-"] > svg' }], "pane-header": [{ name: "pane-header", selector: '[data-testid^="pane-header-"]', key: { self: !0, attr: "data-testid", strip: "pane-header-" } }, { name: "pane-header-icon", selector: '[data-testid^="pane-header-"] > span.shrink-0:not([data-testid])', key: { closest: '[data-testid^="pane-header-"]', attr: "data-testid", strip: "pane-header-" } }, { name: "pane-header-icon-glyph", selector: '[data-testid^="pane-header-"] > span.shrink-0:not([data-testid]) > *', key: { closest: '[data-testid^="pane-header-"]', attr: "data-testid", strip: "pane-header-" } }, { name: "pane-header-name", selector: '[data-testid^="pane-header-"] > span.truncate', key: { closest: '[data-testid^="pane-header-"]', attr: "data-testid", strip: "pane-header-" } }, { name: "pane-header-state", selector: '[data-testid^="pane-header-"] > span.flex[title]', key: { closest: '[data-testid^="pane-header-"]', attr: "data-testid", strip: "pane-header-" } }, { name: "pane-header-state-dot", selector: '[data-testid^="pane-header-"] > span.flex[title] > span.rounded-full', key: { closest: '[data-testid^="pane-header-"]', attr: "data-testid", strip: "pane-header-" } }, { name: "pane-header-state-word", selector: '[data-testid^="pane-header-"] > span.flex[title] > span.truncate', key: { closest: '[data-testid^="pane-header-"]', attr: "data-testid", strip: "pane-header-" } }, { name: "pane-controls", selector: '[data-testid^="tile-controls-"]', key: { self: !0, attr: "data-testid", strip: "tile-controls-" } }, { name: "pane-expand", selector: '[data-testid^="tile-expand-"]', key: { self: !0, attr: "data-testid", strip: "tile-expand-" } }, { name: "pane-expand-glyph", selector: '[data-testid^="tile-expand-"] > svg', key: { closest: '[data-testid^="tile-expand-"]', attr: "data-testid", strip: "tile-expand-" } }, { name: "pane-close", selector: '[data-testid^="tile-close-"]', key: { self: !0, attr: "data-testid", strip: "tile-close-" } }, { name: "pane-close-glyph", selector: '[data-testid^="tile-close-"] > svg', key: { closest: '[data-testid^="tile-close-"]', attr: "data-testid", strip: "tile-close-" } }, { name: "pane-corner", selector: "div.pointer-events-auto.absolute" }], "new-session": [{ name: "launcher", selector: ".new-session-popover" }, { name: "launcher-filter", selector: '[data-testid="new-tab-filter"]' }, { name: "launcher-list", selector: "#new-tab-launcher-list" }, { name: "launcher-option", selector: '[role="option"]', key: { self: !0, attr: "data-testid" } }, { name: "launcher-option-icon", selector: '[role="option"] > :first-child:not(span.flex-1):not(kbd)', key: { closest: '[role="option"]', attr: "data-testid" } }, { name: "launcher-option-label", selector: '[role="option"] > span.flex-1', key: { closest: '[role="option"]', attr: "data-testid" } }, { name: "launcher-option-key", selector: '[role="option"] > kbd', key: { closest: '[role="option"]', attr: "data-testid" } }, { name: "launcher-note", selector: ".new-session-popover p[role]" }, { name: "agent-select", selector: '[data-testid="new-session-popover-agent"]' }, { name: "agent-manage", selector: ".new-session-popover > div:first-child > button:not([data-testid])" }, { name: "project-option", selector: '[data-testid^="project-option-"]', key: { self: !0, attr: "data-testid", strip: "project-option-" } }, { name: "project-option-name", selector: '[data-testid^="project-option-"]', key: { closest: '[data-testid^="project-option-"]', attr: "data-testid", strip: "project-option-" }, textRange: !0 }, { name: "project-option-path", selector: '[data-testid^="project-option-"] > span', key: { closest: '[data-testid^="project-option-"]', attr: "data-testid", strip: "project-option-" } }], "tab-menu": [{ name: "tab-menu", selector: '[data-testid="tab-split-menu"]' }, { name: "tab-menu-item", selector: '[data-testid="tab-split-menu"] > button', key: { self: !0, attr: "data-testid" } }, { name: "tab-menu-item-label", selector: '[data-testid="tab-split-menu"] > button > span.block', key: { closest: '[data-testid="tab-split-menu"] > button', attr: "data-testid" } }, { name: "tab-menu-heading", selector: '[data-testid="tab-split-menu"] > p' }, { name: "tab-menu-empty", selector: '[data-testid="tab-split-menu"] > div:not(.h-px)' }, { name: "tab-menu-divider", selector: '[data-testid="tab-split-menu"] > div.h-px' }, { name: "tab-menu-rename-form", selector: '[data-testid="tab-split-menu"] > form' }, { name: "tab-menu-rename-input", selector: '[data-testid="tab-menu-rename-input"]' }, { name: "tab-menu-rename-save", selector: '[data-testid="tab-split-menu"] > form > button' }], select: [{ name: "select-field", selector: '[data-testid="select-demo"]' }, { name: "select-field-label", selector: '[data-testid="select-demo"] > span.truncate' }, { name: "select-chevron", selector: '[data-testid="select-demo"] > svg' }, { name: "select-list", selector: '[role="listbox"]' }, { name: "select-option", selector: '[role="listbox"] > [role="option"]', key: { self: !0, attr: "data-value" } }, { name: "select-option-label", selector: '[role="listbox"] > [role="option"] > span.truncate', key: { closest: '[role="option"]', attr: "data-value" } }, { name: "select-option-check", selector: '[role="listbox"] > [role="option"] > span[aria-hidden]', key: { closest: '[role="option"]', attr: "data-value" } }], "keybind-help": [{ name: "keybind-help-scrim", selector: "body > div.fixed.inset-0" }, { name: "keybind-help-panel", selector: '[data-testid="keybind-help"]' }, { name: "keybind-help-header", selector: '[data-testid="keybind-help"] > div:first-child' }, { name: "keybind-help-title", selector: '[data-testid="keybind-help"] h2' }, { name: "keybind-help-close", selector: '[aria-label="Close keybind help"]' }, { name: "keybind-help-close-glyph", selector: '[aria-label="Close keybind help"] > svg' }, { name: "keybind-help-search", selector: '[data-testid="keybind-help-search"]' }, { name: "keybind-help-list", selector: '[data-testid="keybind-help"] > div:last-child' }, { name: "keybind-help-empty", selector: '[data-testid="keybind-help"] div.text-center' }, { name: "keybind-help-group", selector: '[data-testid="keybind-help"] section' }, { name: "keybind-help-group-title", selector: '[data-testid="keybind-help"] section > h3' }, { name: "keybind-help-row", selector: '[data-testid="keybind-help"] li' }, { name: "keybind-help-keys", selector: '[data-testid="keybind-help"] li > kbd' }, { name: "keybind-help-description", selector: '[data-testid="keybind-help"] li > span' }], launcher: [{ name: "launcher-scrim", selector: "body > div.fixed.inset-0" }, { name: "launcher-panel", selector: '[data-testid="new-session-dialog"]' }, { name: "launcher-title", selector: '[data-testid="new-session-dialog"] > p' }, { name: "launcher-filter", selector: '[data-testid="new-session-filter"]' }, { name: "launcher-list", selector: "#new-session-list" }, { name: "launcher-row", selector: '[data-testid^="new-session-row-"]', key: { self: !0, attr: "data-testid", strip: "new-session-row-" } }, { name: "launcher-row-icon", selector: '[data-testid^="new-session-row-"] > :first-child:not(span):not(kbd)', key: { closest: '[data-testid^="new-session-row-"]', attr: "data-testid", strip: "new-session-row-" } }, { name: "launcher-row-label", selector: '[data-testid^="new-session-row-"] > span.shrink-0', key: { closest: '[data-testid^="new-session-row-"]', attr: "data-testid", strip: "new-session-row-" } }, { name: "launcher-row-detail", selector: '[data-testid^="new-session-row-"] > span.ml-auto', key: { closest: '[data-testid^="new-session-row-"]', attr: "data-testid", strip: "new-session-row-" } }, { name: "launcher-row-key", selector: '[data-testid^="new-session-row-"] > kbd', key: { closest: '[data-testid^="new-session-row-"]', attr: "data-testid", strip: "new-session-row-" } }, { name: "launcher-note", selector: "#new-session-list > p" }], "session-menu": [{ name: "tab-menu", selector: '[data-testid="tab-split-menu"]' }, { name: "tab-menu-item", selector: '[data-testid="tab-split-menu"] > button', key: { self: !0, attr: "data-testid" } }, { name: "tab-menu-item-label", selector: '[data-testid="tab-split-menu"] > button > span.block', key: { closest: '[data-testid="tab-split-menu"] > button', attr: "data-testid" } }, { name: "tab-menu-heading", selector: '[data-testid="tab-split-menu"] > p' }, { name: "tab-menu-empty", selector: '[data-testid="tab-split-menu"] > div:not(.h-px)' }, { name: "tab-menu-divider", selector: '[data-testid="tab-split-menu"] > div.h-px' }], "tab-drag": [{ name: "tab-drag-layer", selector: '[data-testid="tab-drag-layer"]' }, { name: "tab-drag-pane", selector: '[data-testid="tab-drag-layer"] > div.bg-surface-1\\/30' }, { name: "tab-drop-zone", selector: '[data-testid="tab-drop-zone"]', key: { self: !0, attr: "data-zone" } }, { name: "tab-drop-label", selector: '[data-testid="tab-drop-zone"] > span' }, { name: "tab-drag-ghost", selector: '[data-testid="tab-drag-ghost"]' }], start: [{ name: "start-panel", selector: '[data-testid="no-session-panel"], [data-testid="cli-start-panel"]' }, { name: "start-column", selector: '[data-testid$="-panel"] > div' }, { name: "start-logo", selector: '[data-testid="no-session-panel"] img' }, { name: "start-name", selector: '[data-testid$="-panel"] h1, [data-testid="no-session-panel"] h1, [data-testid="no-session-panel"] h2' }, { name: "start-hint", selector: '[data-testid$="-panel"] p' }, { name: "start-target", selector: '[data-testid="workspace-start-target"], [data-testid="cli-start-target"]' }, { name: "start-action", selector: '[data-testid="home-add-project"], [data-testid="no-session-create"], [data-testid^="workspace-start-"]:not([data-testid="workspace-start-target"]), [data-testid^="cli-start-agent-"]', key: { self: !0, attr: "data-testid" } }, { name: "start-status", selector: '[role="status"], [role="alert"]' }, { name: "start-status-action", selector: '[role="status"] > button, [role="alert"] > button' }, { name: "start-link", selector: '[data-testid$="-panel"] button.text-subtext-0' }, { name: "start-shortcut-row", selector: '[data-testid="no-session-panel"] dl > div' }, { name: "start-shortcut-label", selector: '[data-testid="no-session-panel"] dl dt' }, { name: "start-shortcut-key", selector: '[data-testid="no-session-panel"] dl kbd' }], "folder-browser": [{ name: "folder-browser", selector: '[data-testid="dir-browser"]' }, { name: "folder-browser-mode-toggle", selector: '[data-testid="dir-browser-mode-toggle"]' }, { name: "folder-browser-up", selector: '[data-testid="dir-browser-up"]' }, { name: "folder-browser-crumbs", selector: '[data-testid="dir-browser"] span.min-w-0.flex-1' }, { name: "folder-browser-crumb", selector: '[data-testid="dir-browser"] span.min-w-0.flex-1 button' }, { name: "folder-browser-filter", selector: '[data-testid="dir-browser-filter"]' }, { name: "folder-browser-list", selector: '[data-testid="dir-browser"] div.overflow-y-auto' }, { name: "folder-browser-entry", selector: '[data-testid^="dir-browser-entry-"]', key: { self: !0, attr: "data-testid", strip: "dir-browser-entry-" } }, { name: "folder-browser-entry-name", selector: '[data-testid^="dir-browser-entry-"] > span:first-child', key: { closest: '[data-testid^="dir-browser-entry-"]', attr: "data-testid", strip: "dir-browser-entry-" } }, { name: "folder-browser-git", selector: '[data-testid^="dir-browser-entry-"] > span:last-child:not(:first-child)', key: { closest: '[data-testid^="dir-browser-entry-"]', attr: "data-testid", strip: "dir-browser-entry-" } }, { name: "folder-browser-note", selector: '[data-testid="dir-browser"] div.overflow-y-auto > div' }, { name: "folder-browser-use", selector: '[data-testid="dir-browser-use"]' }, { name: "folder-browser-path-input", selector: '[data-testid="project-path-input"]' }], instructions: [{ name: "instructions-scrim", selector: "body > div.fixed.inset-0" }, { name: "instructions-panel", selector: '[data-testid="instructions-dialog"]' }, { name: "instructions-title", selector: '[data-testid="instructions-dialog"] > h2' }, { name: "instructions-intro", selector: '[data-testid="instructions-dialog"] > p' }, { name: "instructions-label", selector: '[data-testid="instructions-dialog"] > label > span:first-child' }, { name: "instructions-count", selector: '[data-testid="instructions-count"]' }, { name: "instructions-text", selector: '[data-testid="instructions-text"]' }, { name: "instructions-folders", selector: '[data-testid="instructions-folders"]' }, { name: "instructions-error", selector: '[data-testid="instructions-error"]' }, { name: "instructions-cancel", selector: '[data-testid="instructions-dialog"] > div.flex.justify-end > button:first-child' }, { name: "instructions-save", selector: '[data-testid="instructions-save"]' }], memory: [{ name: "memory-scrim", selector: "body > div.fixed.inset-0", key: { self: !0, attr: "data-testid" } }, { name: "memory-panel", selector: '[data-testid="memory-dialog"]' }, { name: "memory-title", selector: '[data-testid="memory-dialog"] > h2' }, { name: "memory-intro", selector: '[data-testid="memory-dialog"] > p' }, { name: "memory-caps", selector: '[data-testid="memory-caps"]' }, { name: "memory-new", selector: '[data-testid="memory-new"]' }, { name: "memory-enabled", selector: '[data-testid="memory-enabled"]' }, { name: "memory-enabled-label", selector: '[data-testid="memory-dialog"] > label.flex > span' }, { name: "memory-note", selector: '[data-testid="memory-dialog"] > span.text-subtext-0' }, { name: "memory-row", selector: '[data-testid^="memory-row-"]', key: { self: !0, attr: "data-testid", strip: "memory-row-" } }, { name: "memory-open", selector: '[data-testid^="memory-open-"]', key: { self: !0, attr: "data-testid", strip: "memory-open-" } }, { name: "memory-file-title", selector: '[data-testid^="memory-row-"] button > span:first-child', key: { closest: '[data-testid^="memory-row-"]', attr: "data-testid", strip: "memory-row-" } }, { name: "memory-file-summary", selector: '[data-testid^="memory-row-"] button > span.truncate', key: { closest: '[data-testid^="memory-row-"]', attr: "data-testid", strip: "memory-row-" } }, { name: "memory-file-meta", selector: '[data-testid^="memory-row-"] button > span:last-child', key: { closest: '[data-testid^="memory-row-"]', attr: "data-testid", strip: "memory-row-" } }, { name: "memory-delete", selector: '[data-testid^="memory-delete-"]', key: { self: !0, attr: "data-testid", strip: "memory-delete-" } }, { name: "memory-error", selector: '[data-testid="memory-error"]' }, { name: "memory-close", selector: '[data-testid="memory-dialog"] > div.flex.justify-end > button' }, { name: "memory-file-name", selector: '[data-testid="memory-file-name"]' }, { name: "memory-name", selector: '[data-testid="memory-name"]' }, { name: "memory-count", selector: '[data-testid="memory-count"]' }, { name: "memory-text", selector: '[data-testid="memory-text"]' }, { name: "memory-conflict", selector: '[data-testid="memory-conflict"]' }, { name: "memory-reload", selector: '[data-testid="memory-reload"]' }, { name: "memory-back", selector: '[data-testid="memory-back"]' }, { name: "memory-save", selector: '[data-testid="memory-save"]' }, { name: "memory-confirm", selector: '[data-testid="confirm-dialog"]' }, { name: "memory-confirm-message", selector: ".confirm-dialog__message" }], worktree: [{ name: "worktree-plus", selector: '[data-testid^="worktree-menu-"]' }, { name: "worktree-popover", selector: '[role="dialog"][aria-label="Git worktrees"]' }, { name: "worktree-heading", selector: '[role="dialog"][aria-label="Git worktrees"] > div:first-child > span:first-child' }, { name: "worktree-project", selector: '[role="dialog"][aria-label="Git worktrees"] > div:first-child > span:last-child' }, { name: "worktree-list", selector: '[role="dialog"][aria-label="Git worktrees"] > div.overflow-y-auto' }, { name: "worktree-note", selector: '[role="dialog"][aria-label="Git worktrees"] > div.overflow-y-auto > div:not(.worktree-menu__entry)' }, { name: "worktree-entry", selector: '[data-testid^="worktree-entry-"]', key: { self: !0, attr: "data-testid", strip: "worktree-entry-" } }, { name: "worktree-entry-branch", selector: ".worktree-menu__entry-branch", key: { closest: '[data-testid^="worktree-entry-"]', attr: "data-testid", strip: "worktree-entry-" } }, { name: "worktree-badge", selector: '[data-testid^="worktree-entry-"] .worktree-menu__entry-branch > span', key: { closest: '[data-testid^="worktree-entry-"]', attr: "data-testid", strip: "worktree-entry-" } }, { name: "worktree-entry-path", selector: ".worktree-menu__entry-path", key: { closest: '[data-testid^="worktree-entry-"]', attr: "data-testid", strip: "worktree-entry-" } }, { name: "worktree-open", selector: '[data-testid^="worktree-open-"]', key: { self: !0, attr: "data-testid", strip: "worktree-open-" } }, { name: "worktree-remove", selector: '[data-testid^="worktree-remove-"]', key: { self: !0, attr: "data-testid", strip: "worktree-remove-" } }, { name: "worktree-error", selector: '[data-testid="worktree-error"]' }, { name: "worktree-new", selector: '[data-testid="worktree-new"]' }, { name: "worktree-name-input", selector: '[data-testid="worktree-name-input"]' }, { name: "worktree-start-input", selector: '[data-testid="worktree-start-input"]' }, { name: "worktree-branch-input", selector: '[data-testid="worktree-branch-input"]' }, { name: "worktree-parent-select", selector: '[data-testid="worktree-parent-select"]' }, { name: "worktree-new-branch", selector: '[data-testid="worktree-new-branch"]' }, { name: "worktree-path-input", selector: '[data-testid="worktree-path-input"]' }, { name: "worktree-agent-select", selector: '[data-testid="worktree-agent-select"]' }, { name: "worktree-create-cancel", selector: '[data-testid="worktree-create-cancel"]' }, { name: "worktree-create-submit", selector: '[data-testid="worktree-create-submit"]' }, { name: "worktree-confirm", selector: '[data-testid="confirm-dialog"]' }, { name: "worktree-confirm-message", selector: ".confirm-dialog__message" }, { name: "worktree-confirm-accept", selector: '[data-testid="confirm-accept"]' }, { name: "worktree-confirm-cancel", selector: '[data-testid="confirm-cancel"]' }], "terminal-search": [{ name: "terminal-frame", selector: '[data-testid="persistent-agent-terminal"]' }, { name: "term-search", selector: '[data-testid="term-search"]' }, { name: "term-search-input", selector: '[data-testid="term-search-input"]' }, { name: "term-search-button", selector: '[data-testid="term-search"] > button', key: { self: !0, attr: "title" } }], "agent-control": [{ name: "terminal-frame", selector: '[data-testid="persistent-agent-terminal"]' }, { name: "agent-control-chip", selector: '[data-testid="agent-control-chip"]' }, { name: "agent-control-label", selector: '[data-testid="agent-control-chip"] > span' }, { name: "agent-control-button", selector: '[data-testid="agent-control-chip"] > button' }, { name: "agent-control-error", selector: ".terminal__cli-error" }, { name: "agent-control-ended", selector: ".terminal__exited", key: { self: !0, attr: "data-testid" } }, { name: "agent-control-ended-text", selector: ".terminal__exited-text" }, { name: "agent-control-ended-button", selector: ".terminal__exited-actions > button", key: { self: !0, attr: "data-testid" } }], "phone-size": [{ name: "terminal-frame", selector: '[data-testid="persistent-agent-terminal"]' }, { name: "phone-size-notice", selector: '[data-testid="phone-size-notice"]' }, { name: "phone-size-chip", selector: '[data-testid="phone-size-chip"]' }, { name: "phone-size-heading", selector: '[data-testid="phone-size-notice"] span.font-semibold' }, { name: "phone-size-text", selector: '[data-testid="phone-size-notice"] span:not(.font-semibold)' }, { name: "phone-size-fold", selector: '[aria-label="Keep phone size and hide this"]' }, { name: "phone-size-button", selector: '[data-testid="phone-size-notice"] div.flex.flex-wrap > button, [data-testid="phone-size-chip"] > button' }], window: [{ name: "sidebar-card", selector: '[data-testid="sidebar-card"]' }, { name: "main-card", selector: '[data-testid="main-card"]' }, { name: "tools-card", selector: '[data-testid="tools-card"]' }, { name: "sidebar-toggle", selector: '[data-testid="sidebar-collapse-toggle"]' }, { name: "drawer-toggle", selector: '[data-testid="workspace-tools-toggle"]' }, { name: "resize-sidebar", selector: '[data-testid="resize-sidebar"]' }, { name: "resize-tools", selector: '[data-testid="resize-tools"]' }, { name: "tools-tab", selector: 'nav[aria-label="Files, Git and Browser"] > button' }, { name: "status-bar", selector: "footer.status-bar" }], settings: [{ name: "settings-modal", selector: '[data-testid="settings-modal"]' }, { name: "settings-nav-card", selector: '[data-testid="settings-modal"] > nav' }, { name: "settings-close", selector: '[data-testid="settings-close"]' }, { name: "settings-nav", selector: 'nav [data-testid^="settings-nav-"]', key: { self: !0, attr: "data-testid", strip: "settings-nav-" } }, { name: "settings-main-card", selector: '[data-testid="settings-modal"] > main' }, { name: "settings-search", selector: '[data-testid="settings-search"]' }, { name: "settings-title", selector: '[data-testid="settings-modal"] > main h1' }, { name: "settings-body", selector: '[data-testid="settings-modal"] .settings-modal__body' }, { name: "settings-group-title", selector: '[data-testid="settings-modal"] > main h3' }, { name: "settings-group-card", selector: '[data-testid="settings-modal"] > main section > div.rounded-ui' }, { name: "settings-row", selector: '[data-testid="settings-modal"] [data-setting-row]' }, { name: "settings-row-title", selector: '[data-testid="settings-modal"] [data-setting-row] > div:first-child > div:first-child' }, { name: "settings-row-description", selector: '[data-testid="settings-modal"] [data-setting-row] > div:first-child > div:nth-child(2)' }, { name: "settings-result-title", selector: '[data-testid^="settings-result-"] > h2' }] };
export {
  my as NAMED_ELEMENTS,
  d0 as React,
  V0 as SCHEMA,
  dy as STYLE_KEYS,
  fy as describeToGpui,
  oy as jsxRuntime,
  sy as mount,
  cy as reactDom,
  uy as sdk
};
