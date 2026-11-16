function bs(n, l) {
  for (var o = 0; o < l.length; o++) {
    const i = l[o];
    if (typeof i != "string" && !Array.isArray(i)) {
      for (const s in i)
        if (s !== "default" && !(s in n)) {
          const f = Object.getOwnPropertyDescriptor(i, s);
          f && Object.defineProperty(n, s, f.get ? f : {
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
class re extends Error {
}
const Fh = /* @__PURE__ */ new Set(["hover", "focus", "focus-visible", "focus-within", "active", "disabled", "enabled", "checked"]), Ih = /* @__PURE__ */ new Set(["not", "is", "where", "has", "nth-child"]), $h = /* @__PURE__ */ new Set(["first-child", "last-child", "only-child", "root", ...Fh]);
function es(n) {
  return n.replace(/\\(?:([0-9a-fA-F]{1,6})\s?|([\s\S]))/g, (l, o, i) => o ? String.fromCodePoint(parseInt(o, 16)) : i);
}
function vl(n, l) {
  let o = l;
  for (; o < n.length; ) {
    const i = n[o];
    if (i === "\\") {
      o += 2;
      continue;
    }
    if (/[A-Za-z0-9_\- -￿]/.test(i)) {
      o++;
      continue;
    }
    break;
  }
  if (o === l) throw new re(`expected a name at ${l} in ${JSON.stringify(n)}`);
  return [es(n.slice(l, o)), o];
}
function Ph(n, l) {
  let o = 1;
  for (let i = l; i < n.length; i++) {
    const s = n[i];
    if (s === "\\") {
      i++;
      continue;
    }
    if (s === '"' || s === "'") {
      if (i = n.indexOf(s, i + 1), i < 0) break;
      continue;
    }
    if (s === "(") o++;
    else if (s === ")" && --o === 0) return i;
  }
  throw new re(`unbalanced parenthesis in ${JSON.stringify(n)}`);
}
function vs(n) {
  const l = [];
  let o = 0, i = 0;
  for (let s = 0; s < n.length; s++) {
    const f = n[s];
    if (f === "\\") {
      s++;
      continue;
    }
    if (f === '"' || f === "'") {
      if (s = n.indexOf(f, s + 1), s < 0) break;
      continue;
    }
    f === "(" || f === "[" ? o++ : f === ")" || f === "]" ? o-- : f === "," && o === 0 && (l.push(n.slice(i, s).trim()), i = s + 1);
  }
  return l.push(n.slice(i).trim()), l.filter(Boolean);
}
function t0(n, l) {
  const o = { tag: null, id: null, classes: [], attrs: [], pseudos: [], pseudoElement: null };
  let i = !1;
  for (; l < n.length; ) {
    const s = n[l];
    if (s === "*") {
      o.tag = "*", l++, i = !0;
      continue;
    }
    if (s === ".") {
      const [f, m] = vl(n, l + 1);
      o.classes.push(f), l = m, i = !0;
      continue;
    }
    if (s === "#") {
      const [f, m] = vl(n, l + 1);
      o.id = f, l = m, i = !0;
      continue;
    }
    if (s === "[") {
      const f = n.indexOf("]", l);
      if (f < 0) throw new re(`unclosed [ in ${JSON.stringify(n)}`);
      const m = n.slice(l + 1, f).trim(), d = /^([^\s~^$*|=]+)\s*(?:([~^$*|]?=)\s*(?:"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'|([^\s"'\]]+)))?\s*(i)?$/.exec(m);
      if (!d) throw new re(`cannot read the attribute selector [${m}]`);
      const p = d[3] ?? d[4] ?? d[5];
      o.attrs.push({ name: es(d[1]).toLowerCase(), op: d[2] ?? null, value: p === void 0 ? null : es(p) }), l = f + 1, i = !0;
      continue;
    }
    if (s === ":") {
      if (n[l + 1] === ":") {
        const [p, y] = vl(n, l + 2), E = p.toLowerCase();
        if (E !== "before" && E !== "after") throw new re(`::${E} is not supported`);
        if (o.pseudoElement = E, l = y, i = !0, l < n.length && !/[\s>]/.test(n[l])) throw new re(`nothing may follow ::${E} in ${JSON.stringify(n)}`);
        break;
      }
      const [f, m] = vl(n, l + 1);
      l = m;
      const d = f.toLowerCase();
      if ((d === "before" || d === "after") && n[l] !== "(") {
        if (o.pseudoElement = d, i = !0, l < n.length && !/[\s>]/.test(n[l])) throw new re(`nothing may follow :${d} in ${JSON.stringify(n)}`);
        break;
      }
      if (n[l] === "(") {
        if (!Ih.has(d)) throw new re(`:${d}() is not supported`);
        const p = Ph(n, l + 1), y = n.slice(l + 1, p).trim();
        if (l = p + 1, d === "nth-child") {
          if (!/^\d+$/.test(y)) throw new re(`:nth-child(${y}) is not supported (only a number)`);
          o.pseudos.push({ name: d, n: Number(y) });
        } else {
          const E = vs(y).map(ys);
          if (d === "has" && E.some((_) => _.length !== 1)) throw new re(`:has(${y}) is not supported (only a compound selector)`);
          o.pseudos.push({ name: d, list: E });
        }
      } else {
        if (!$h.has(d)) throw new re(`:${d} is not supported`);
        o.pseudos.push({ name: d });
      }
      i = !0;
      continue;
    }
    if (/[A-Za-z_\-\\]/.test(s) && !i) {
      const [f, m] = vl(n, l);
      o.tag = f.toLowerCase(), l = m, i = !0;
      continue;
    }
    break;
  }
  if (!i) throw new re(`empty compound selector at ${l} in ${JSON.stringify(n)}`);
  return [o, l];
}
function ys(n) {
  const l = [];
  let o = 0, i = null;
  for (n = n.trim(); o < n.length; ) {
    const [s, f] = t0(n, o);
    if (l.at(-1)?.compound.pseudoElement) throw new re(`::${l.at(-1).compound.pseudoElement} must end ${JSON.stringify(n)}`);
    l.push({ compound: s, combinator: i }), o = f;
    let m = !1;
    for (; n[o] === " " || n[o] === `
` || n[o] === "	"; )
      o++, m = !0;
    if (o >= n.length) break;
    const d = n[o];
    if (d === ">")
      for (i = ">", o++; n[o] === " "; ) o++;
    else {
      if (d === "+" || d === "~") throw new re(`the ${d} combinator is not supported`);
      if (m) i = " ";
      else throw new re(`unexpected ${JSON.stringify(d)} in ${JSON.stringify(n)}`);
    }
  }
  if (!l.length) throw new re("empty selector");
  return l;
}
const zd = /* @__PURE__ */ new Map();
function ni(n) {
  let l = zd.get(n);
  return l || (l = vs(n).map(ys), zd.set(n, l)), l;
}
function wf(n) {
  const l = [0, 0, 0], o = (i) => {
    l[0] += i[0], l[1] += i[1], l[2] += i[2];
  };
  for (const { compound: i } of n) {
    i.id && l[0]++, l[1] += i.classes.length + i.attrs.length, i.tag && i.tag !== "*" && l[2]++, i.pseudoElement && l[2]++;
    for (const s of i.pseudos)
      if (s.name !== "where")
        if (s.list) {
          const f = s.list.map(wf).sort((m, d) => d[0] - m[0] || d[1] - m[1] || d[2] - m[2])[0];
          o(f);
        } else l[1]++;
  }
  return l;
}
function e0(n, { name: l, op: o, value: i }) {
  const s = n.getAttribute(l);
  if (s == null) return !1;
  if (o === null) return !0;
  switch (o) {
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
function Cr(n) {
  return n.parentElement ? n.parentElement.children : [n];
}
function _f(n, l) {
  for (const o of n.children) if (l(o) || _f(o, l)) return !0;
  return !1;
}
function kf(n, l, o, i) {
  if ((l.pseudoElement ?? null) !== (i ? o.pseudo ?? null : null) || l.tag && l.tag !== "*" && n.tagName !== l.tag || l.id && n.getAttribute("id") !== l.id) return !1;
  if (l.classes.length) {
    const s = n.classList ?? [];
    for (const f of l.classes) if (!s.includes(f)) return !1;
  }
  for (const s of l.attrs) if (!e0(n, s)) return !1;
  for (const s of l.pseudos)
    switch (s.name) {
      case "first-child":
        if (Cr(n)[0] !== n) return !1;
        break;
      case "only-child":
        if (Cr(n).length !== 1) return !1;
        break;
      case "last-child": {
        const f = Cr(n);
        if (f[f.length - 1] !== n) return !1;
        break;
      }
      case "nth-child":
        if (Cr(n).indexOf(n) !== s.n - 1) return !1;
        break;
      case "root":
        if (!n.isDocumentRoot) return !1;
        break;
      case "not":
        if (s.list.some((f) => Ya(n, f, o, i))) return !1;
        break;
      case "has":
        if (n.watchesDescendants = !0, !s.list.some(([{ compound: f }]) => _f(n, (m) => kf(m, f, o, !1)))) return !1;
        break;
      case "is":
      case "where":
        if (!s.list.some((f) => Ya(n, f, o, i))) return !1;
        break;
      default:
        if (!o.state || !o.state(n, s.name, i)) return !1;
    }
  return !0;
}
function Ya(n, l, o, i = !0) {
  const s = (f, m, d) => {
    const { compound: p, combinator: y } = l[m];
    if (!kf(f, p, o, d)) return !1;
    if (m === 0) return !0;
    if (y === ">") return !!f.parentElement && s(f.parentElement, m - 1, !1);
    for (let E = f.parentElement; E; E = E.parentElement) if (s(E, m - 1, !1)) return !0;
    return !1;
  };
  return s(n, l.length - 1, i);
}
function n0(n, l, o = {}) {
  return (typeof l == "string" ? ni(l) : l).some((s) => Ya(n, s, o));
}
function Sf(n, l, o = {}) {
  return Ya(n, l, o);
}
function El(n, l, o = {}) {
  const i = ni(l), s = [], f = (m) => {
    for (const d of m.children)
      i.some((p) => Ya(d, p, o)) && s.push(d), f(d);
  };
  return f(n), s;
}
function Ef(n, l, o = {}) {
  const i = ni(l);
  for (let s = n; s; s = s.parentElement) if (i.some((f) => Ya(s, f, o))) return s;
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
let a0 = 1;
class ns {
  constructor(l = 0, o = 0, i = 0, s = 0) {
    this.x = l, this.y = o, this.width = i, this.height = s;
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
class xs {
  constructor() {
    this.listeners = [];
  }
  addEventListener(l, o, i) {
    const s = i === !0 || !!i?.capture;
    this.listeners.some((f) => f.type === l && f.listener === o && f.capture === s) || this.listeners.push({ type: l, listener: o, capture: s });
  }
  removeEventListener(l, o, i) {
    const s = i === !0 || !!i?.capture;
    this.listeners = this.listeners.filter((f) => !(f.type === l && f.listener === o && f.capture === s));
  }
}
class ai {
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
class $t extends xs {
  constructor(l, o = {}, i = null) {
    super(), this.nodeType = 1, this.id = `n${a0++}`, this.tagName = l.toLowerCase(), this.props = o, this.childNodes = [], this.parentNode = null, this.ownerDocument = i, this.hidden = !1, this.state = { hover: !1, focus: !1, active: !1 }, this.bounds = null, this.version = 0;
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
    return this.parentNode instanceof $t ? this.parentNode : null;
  }
  get children() {
    return this.childNodes.filter((l) => l instanceof $t);
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
    for (const [o, i] of Object.entries(this.props))
      o.startsWith("data-") && i != null && i !== !1 && (l[o.slice(5).replace(/-([a-z])/g, (s, f) => f.toUpperCase())] = String(i));
    return l;
  }
  /** The DOM attribute React would write for `name`, or null. */
  getAttribute(l) {
    const o = this.props;
    if (l === "class") return this.className || null;
    if (l === "id") return o.id != null ? String(o.id) : null;
    if (l === "style") return null;
    let s = o[l === "for" ? "htmlFor" : l === "tabindex" ? "tabIndex" : l];
    if (s === void 0 && !l.includes("-")) {
      const f = l.replace(/-([a-z])/g, (m, d) => d.toUpperCase());
      s = o[f];
    }
    return s == null || typeof s == "function" ? null : typeof s == "boolean" ? l.startsWith("aria-") || l.startsWith("data-") ? String(s) : s ? "" : null : String(s);
  }
  hasAttribute(l) {
    return this.getAttribute(l) !== null;
  }
  appendChild(l) {
    return l.parentNode && l.parentNode.removeChild(l), l.parentNode = this, this.childNodes.push(l), this.touchWatchers(), l;
  }
  insertBefore(l, o) {
    l.parentNode && l.parentNode.removeChild(l);
    const i = this.childNodes.indexOf(o);
    return l.parentNode = this, i < 0 ? this.childNodes.push(l) : this.childNodes.splice(i, 0, l), this.touchWatchers(), l;
  }
  removeChild(l) {
    const o = this.childNodes.indexOf(l);
    return o >= 0 && this.childNodes.splice(o, 1), l.parentNode = null, this.touchWatchers(), l;
  }
  contains(l) {
    for (let o = l; o; o = o.parentNode) if (o === this) return !0;
    return !1;
  }
  matches(l) {
    return n0(this, l);
  }
  closest(l) {
    return Ef(this, l);
  }
  querySelectorAll(l) {
    return El(this, l);
  }
  querySelector(l) {
    return El(this, l)[0] ?? null;
  }
  /** Where the engine last laid this element out (`HostDocument.measure`); else, before its first layout, a box the
   * engine reported another way (the direct children of a scroll area, a pressed element); else a zero box. */
  getBoundingClientRect() {
    const l = this.ownerDocument?.measure?.(this) ?? this.ownerDocument?.itemBounds?.(this.id) ?? this.bounds;
    return l ? new ns(l.x, l.y, l.width, l.height) : new ns();
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
  setSelectionRange(l, o) {
    this.selectedAll = l === 0 && o >= this.value.length && o > 0;
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
    const l = this, o = (m) => String(m).startsWith("--") ? String(m) : String(m).replace(/-([a-z])/g, (d, p) => p.toUpperCase()), i = (m) => {
      const d = l.props.style?.[m];
      return d == null || typeof d == "boolean" ? "" : typeof d == "number" && d !== 0 ? `${d}px` : String(d);
    }, s = (m) => l.inline && m in l.inline ? l.inline[m] : i(m), f = (m, d) => {
      const p = d == null ? "" : String(d);
      s(m) !== p && (l.inline ??= {}, p === i(m) ? delete l.inline[m] : l.inline[m] = p, l.touch(), l.ownerDocument?.restyled());
    };
    return this.styleView = new Proxy({}, {
      get: (m, d) => {
        if (typeof d == "string")
          return d === "setProperty" ? (p, y) => f(o(p), y) : d === "removeProperty" ? (p) => {
            const y = s(o(p));
            return f(o(p), ""), y;
          } : d === "getPropertyValue" ? (p) => s(o(p)) : s(d);
      },
      set: (m, d, p) => (typeof d == "string" && f(d, p), !0)
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
const zf = Symbol("perch.stale-layout"), Nf = 3;
let qr = !1;
function Tf(n) {
  return () => {
    let l, o = !1;
    const i = (s) => {
      const f = qr;
      qr = s < Nf;
      try {
        l = n();
      } catch (m) {
        const d = m?.[zf];
        if (!d) throw m;
        d.retries.push(() => {
          o || i(s + 1);
        });
      } finally {
        qr = f;
      }
    };
    return i(0), () => {
      o = !0, typeof l == "function" && l();
    };
  };
}
const as = "perch-dom:", l0 = /* @__PURE__ */ new Set(["children", "key", "ref", "dangerouslySetInnerHTML"]), r0 = { class: "className", for: "htmlFor", tabindex: "tabIndex" };
function Nd(n, l = []) {
  const o = new Set(l.map((s) => r0[s] ?? s)), i = (s) => {
    if (!(s instanceof $t)) return { x: s.data, ...s.hidden ? { h: 1 } : {} };
    const f = {};
    for (const [m, d] of Object.entries(s.props))
      l0.has(m) || o.has(m) || d == null || typeof d == "function" || typeof d == "symbol" || (f[m] = d);
    return { t: s.tagName, p: f, c: s.childNodes.map(i), ...s.hidden ? { h: 1 } : {} };
  };
  return as + JSON.stringify(i(n));
}
function i0(n, l) {
  if (typeof n != "string" || !n.startsWith(as)) return null;
  let o;
  try {
    o = JSON.parse(n.slice(as.length));
  } catch {
    return null;
  }
  const i = (f) => !!f && typeof f == "object" && !Array.isArray(f), s = (f) => {
    if (!i(f)) throw new Error("not a node");
    let m;
    if (typeof f.x == "string") m = new ai(f.x);
    else {
      if (typeof f.t != "string" || !/^[a-z][a-z0-9-]*$/i.test(f.t) || !i(f.p) || !Array.isArray(f.c)) throw new Error("not an element");
      m = new $t(f.t, f.p, l);
      for (const d of f.c) m.appendChild(s(d));
    }
    return m.hidden = f.h === 1, m;
  };
  try {
    return [s(o)];
  } catch {
    return null;
  }
}
class o0 {
  observe() {
  }
  unobserve() {
  }
  disconnect() {
  }
}
class s0 {
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
  setItem(l, o) {
    this.map.set(l, String(o));
  }
  removeItem(l) {
    this.map.delete(l);
  }
  clear() {
    this.map.clear();
  }
}
function Td(n) {
  for (let l = n; l instanceof $t; l = l.parentElement) l.touch();
}
class c0 extends xs {
  constructor(l) {
    super(), this.perch = l, this.documentElement = new $t("html", {}, this), this.body = new $t("body", {}, this), this.documentElement.appendChild(this.body), this.activeElement = this.body, this.retries = [];
  }
  createElement(l) {
    return new $t(l, {}, this);
  }
  /** `element`'s box as the engine last laid it out, or null before its first layout or without an engine that
   * reports boxes (`perch.bounds`). The first ask marks the element to be measured from the next frame on. Inside an
   * effect (`measured`) a box older than the tree, or none yet, puts the effect off until the next frame. */
  measure(l) {
    const o = this.perch?.bounds;
    if (typeof o != "function" || !this.measureKey) return null;
    l.measured || (l.measured = !0, l.touch(), this.restyled());
    const i = o(this.measureKey(l));
    if (qr && (!i || this.stale?.())) throw { [zf]: this };
    return i ?? null;
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
    return El(this.documentElement, l);
  }
  querySelector(l) {
    return this.querySelectorAll(l)[0] ?? null;
  }
  /** The element whose `id` prop is `id` (React's `useId` ids are not selectors). */
  getElementById(l) {
    return El(this.documentElement, "*").find((o) => o.props?.id === l) ?? null;
  }
}
class u0 extends xs {
  constructor(l, o) {
    super(), this.perch = l, this.document = o, this.location = { get hostname() {
      return l.hostname ?? "localhost";
    } };
  }
  get innerWidth() {
    return this.perch.viewport?.().width ?? 1e3;
  }
  get innerHeight() {
    return this.perch.viewport?.().height ?? 800;
  }
  setTimeout(l, o, ...i) {
    return globalThis.setTimeout(l, o, ...i);
  }
  clearTimeout(l) {
    return globalThis.clearTimeout(l);
  }
}
function Cf(n) {
  return {
    setTimeout: (l, o = 0, ...i) => n.setTimeout(() => l(...i), Math.max(0, Number(o) || 0)),
    clearTimeout: (l) => {
      l != null && n.clearTimeout(l);
    }
  };
}
const Cd = Symbol.for("perch.react.globals");
function Je(n, l, o) {
  Object.defineProperty(n, l, { value: o, configurable: !0, writable: !0, enumerable: !1 });
}
function d0(n, l = globalThis) {
  const o = new c0(n), i = new u0(n, o);
  o.defaultView = i;
  const s = n.storage ?? new s0();
  if (typeof l.setTimeout != "function") {
    if (typeof n.setTimeout != "function") throw new Error("the engine has no setTimeout and the perch host gives none (perch.setTimeout)");
    const d = Cf(n);
    Je(l, "setTimeout", d.setTimeout), Je(l, "clearTimeout", d.clearTimeout);
  }
  typeof l.queueMicrotask != "function" && Je(l, "queueMicrotask", (d) => {
    Promise.resolve().then(d);
  }), Je(l, "requestAnimationFrame", (d) => l.setTimeout(() => d(Date.now()), 0)), Je(l, "cancelAnimationFrame", (d) => l.clearTimeout(d));
  const f = { document: o, window: i, localStorage: s, HTMLElement: $t, Element: $t };
  for (const d of Object.keys(f))
    Object.defineProperty(l, d, { get: () => l[Cd]?.[d], configurable: !0, enumerable: !1 });
  l[Cd] = f, Je(l, "DOMRect", ns), Je(l, "getComputedStyle", f0), typeof l.ResizeObserver != "function" && Je(l, "ResizeObserver", o0);
  const m = l.navigator && typeof l.navigator == "object" ? l.navigator : {};
  if (!m.clipboard && n.clipboard)
    try {
      Je(m, "clipboard", n.clipboard);
    } catch {
    }
  return l.navigator || Je(l, "navigator", m), { document: o, window: i, globals: f };
}
function f0(n) {
  const l = n?.ownerDocument?.computed?.(n) ?? {}, o = (i) => {
    const s = l[i];
    return typeof s == "string" || typeof s == "number" ? String(s) : "";
  };
  return new Proxy({}, {
    get: (i, s) => {
      if (typeof s == "string")
        return s === "getPropertyValue" ? (f) => o(String(f)) : o(s.replace(/[A-Z]/g, (f) => `-${f.toLowerCase()}`));
    }
  });
}
function ls(n, l = !1) {
  if (!(l ? n?.tagName === "input" && Mf(n) : n?.tagName === "button" && !/^(button|reset)$/.test(String(n.props.type ?? "submit")) && !n.props.disabled)) return null;
  for (let i = n.parentElement; i; i = i.parentElement) if (i.tagName === "form") return i;
  return null;
}
const Mf = (n) => n?.tagName === "textarea" || n?.tagName === "input" && /^(text|search|url|email|tel|password|number|)$/.test(String(n.props.type ?? ""));
//! Evaluated before anything else in the runtime bundle: React's scheduler reads `setTimeout` and `queueMicrotask`
//! once, when it loads, so an engine without them (QuickJS) gets the host's (`perch.setTimeout`) first.
const Md = globalThis.perch;
if (typeof globalThis.setTimeout != "function" && typeof Md?.setTimeout == "function") {
  const n = Cf(Md);
  globalThis.setTimeout = n.setTimeout, globalThis.clearTimeout = n.clearTimeout;
}
typeof globalThis.queueMicrotask != "function" && (globalThis.queueMicrotask = (n) => {
  Promise.resolve().then(n);
});
function ws(n) {
  return n && n.__esModule && Object.prototype.hasOwnProperty.call(n, "default") ? n.default : n;
}
function m0(n) {
  if (Object.prototype.hasOwnProperty.call(n, "__esModule")) return n;
  var l = n.default;
  if (typeof l == "function") {
    var o = function i() {
      return this instanceof i ? Reflect.construct(l, arguments, this.constructor) : l.apply(this, arguments);
    };
    o.prototype = l.prototype;
  } else o = {};
  return Object.defineProperty(o, "__esModule", { value: !0 }), Object.keys(n).forEach(function(i) {
    var s = Object.getOwnPropertyDescriptor(n, i);
    Object.defineProperty(o, i, s.get ? s : {
      enumerable: !0,
      get: function() {
        return n[i];
      }
    });
  }), o;
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
var Ad;
function p0() {
  if (Ad) return pt;
  Ad = 1;
  var n = Symbol.for("react.transitional.element"), l = Symbol.for("react.portal"), o = Symbol.for("react.fragment"), i = Symbol.for("react.strict_mode"), s = Symbol.for("react.profiler"), f = Symbol.for("react.consumer"), m = Symbol.for("react.context"), d = Symbol.for("react.forward_ref"), p = Symbol.for("react.suspense"), y = Symbol.for("react.memo"), E = Symbol.for("react.lazy"), _ = Symbol.for("react.activity"), x = Symbol.iterator;
  function z(C) {
    return C === null || typeof C != "object" ? null : (C = x && C[x] || C["@@iterator"], typeof C == "function" ? C : null);
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
  }, b = Object.assign, N = {};
  function j(C, X, nt) {
    this.props = C, this.context = X, this.refs = N, this.updater = nt || k;
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
  function R() {
  }
  R.prototype = j.prototype;
  function A(C, X, nt) {
    this.props = C, this.context = X, this.refs = N, this.updater = nt || k;
  }
  var K = A.prototype = new R();
  K.constructor = A, b(K, j.prototype), K.isPureReactComponent = !0;
  var H = Array.isArray;
  function D() {
  }
  var h = { H: null, A: null, T: null, S: null }, v = Object.prototype.hasOwnProperty;
  function w(C, X, nt) {
    var ot = nt.ref;
    return {
      $$typeof: n,
      type: C,
      key: X,
      ref: ot !== void 0 ? ot : null,
      props: nt
    };
  }
  function S(C, X) {
    return w(C.type, X, C.props);
  }
  function T(C) {
    return typeof C == "object" && C !== null && C.$$typeof === n;
  }
  function B(C) {
    var X = { "=": "=0", ":": "=2" };
    return "$" + C.replace(/[=:]/g, function(nt) {
      return X[nt];
    });
  }
  var L = /\/+/g;
  function $(C, X) {
    return typeof C == "object" && C !== null && C.key != null ? B("" + C.key) : X.toString(36);
  }
  function et(C) {
    switch (C.status) {
      case "fulfilled":
        return C.value;
      case "rejected":
        throw C.reason;
      default:
        switch (typeof C.status == "string" ? C.then(D, D) : (C.status = "pending", C.then(
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
  function Q(C, X, nt, ot, st) {
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
            case l:
              Et = !0;
              break;
            case E:
              return Et = C._init, Q(
                Et(C._payload),
                X,
                nt,
                ot,
                st
              );
          }
      }
    if (Et)
      return st = st(C), Et = ot === "" ? "." + $(C, 0) : ot, H(st) ? (nt = "", Et != null && (nt = Et.replace(L, "$&/") + "/"), Q(st, X, nt, "", function(Qn) {
        return Qn;
      })) : st != null && (T(st) && (st = S(
        st,
        nt + (st.key == null || C && C.key === st.key ? "" : ("" + st.key).replace(
          L,
          "$&/"
        ) + "/") + Et
      )), X.push(st)), 1;
    Et = 0;
    var Jt = ot === "" ? "." : ot + ":";
    if (H(C))
      for (var ht = 0; ht < C.length; ht++)
        ot = C[ht], ut = Jt + $(ot, ht), Et += Q(
          ot,
          X,
          nt,
          ut,
          st
        );
    else if (ht = z(C), typeof ht == "function")
      for (C = ht.call(C), ht = 0; !(ot = C.next()).done; )
        ot = ot.value, ut = Jt + $(ot, ht++), Et += Q(
          ot,
          X,
          nt,
          ut,
          st
        );
    else if (ut === "object") {
      if (typeof C.then == "function")
        return Q(
          et(C),
          X,
          nt,
          ot,
          st
        );
      throw X = String(C), Error(
        "Objects are not valid as a React child (found: " + (X === "[object Object]" ? "object with keys {" + Object.keys(C).join(", ") + "}" : X) + "). If you meant to render a collection of children, use an array instead."
      );
    }
    return Et;
  }
  function Z(C, X, nt) {
    if (C == null) return C;
    var ot = [], st = 0;
    return Q(C, ot, "", "", function(ut) {
      return X.call(nt, ut, st++);
    }), ot;
  }
  function P(C) {
    if (C._status === -1) {
      var X = C._result;
      X = X(), X.then(
        function(nt) {
          (C._status === 0 || C._status === -1) && (C._status = 1, C._result = nt);
        },
        function(nt) {
          (C._status === 0 || C._status === -1) && (C._status = 2, C._result = nt);
        }
      ), C._status === -1 && (C._status = 0, C._result = X);
    }
    if (C._status === 1) return C._result.default;
    throw C._result;
  }
  var G = typeof reportError == "function" ? reportError : function(C) {
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
    forEach: function(C, X, nt) {
      Z(
        C,
        function() {
          X.apply(this, arguments);
        },
        nt
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
  return pt.Activity = _, pt.Children = V, pt.Component = j, pt.Fragment = o, pt.Profiler = s, pt.PureComponent = A, pt.StrictMode = i, pt.Suspense = p, pt.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE = h, pt.__COMPILER_RUNTIME = {
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
  }, pt.cloneElement = function(C, X, nt) {
    if (C == null)
      throw Error(
        "The argument must be a React element, but you passed " + C + "."
      );
    var ot = b({}, C.props), st = C.key;
    if (X != null)
      for (ut in X.key !== void 0 && (st = "" + X.key), X)
        !v.call(X, ut) || ut === "key" || ut === "__self" || ut === "__source" || ut === "ref" && X.ref === void 0 || (ot[ut] = X[ut]);
    var ut = arguments.length - 2;
    if (ut === 1) ot.children = nt;
    else if (1 < ut) {
      for (var Et = Array(ut), Jt = 0; Jt < ut; Jt++)
        Et[Jt] = arguments[Jt + 2];
      ot.children = Et;
    }
    return w(C.type, st, ot);
  }, pt.createContext = function(C) {
    return C = {
      $$typeof: m,
      _currentValue: C,
      _currentValue2: C,
      _threadCount: 0,
      Provider: null,
      Consumer: null
    }, C.Provider = C, C.Consumer = {
      $$typeof: f,
      _context: C
    }, C;
  }, pt.createElement = function(C, X, nt) {
    var ot, st = {}, ut = null;
    if (X != null)
      for (ot in X.key !== void 0 && (ut = "" + X.key), X)
        v.call(X, ot) && ot !== "key" && ot !== "__self" && ot !== "__source" && (st[ot] = X[ot]);
    var Et = arguments.length - 2;
    if (Et === 1) st.children = nt;
    else if (1 < Et) {
      for (var Jt = Array(Et), ht = 0; ht < Et; ht++)
        Jt[ht] = arguments[ht + 2];
      st.children = Jt;
    }
    if (C && C.defaultProps)
      for (ot in Et = C.defaultProps, Et)
        st[ot] === void 0 && (st[ot] = Et[ot]);
    return w(C, ut, st);
  }, pt.createRef = function() {
    return { current: null };
  }, pt.forwardRef = function(C) {
    return { $$typeof: d, render: C };
  }, pt.isValidElement = T, pt.lazy = function(C) {
    return {
      $$typeof: E,
      _payload: { _status: -1, _result: C },
      _init: P
    };
  }, pt.memo = function(C, X) {
    return {
      $$typeof: y,
      type: C,
      compare: X === void 0 ? null : X
    };
  }, pt.startTransition = function(C) {
    var X = h.T, nt = {};
    h.T = nt;
    try {
      var ot = C(), st = h.S;
      st !== null && st(nt, ot), typeof ot == "object" && ot !== null && typeof ot.then == "function" && ot.then(D, G);
    } catch (ut) {
      G(ut);
    } finally {
      X !== null && nt.types !== null && (X.types = nt.types), h.T = X;
    }
  }, pt.unstable_useCacheRefresh = function() {
    return h.H.useCacheRefresh();
  }, pt.use = function(C) {
    return h.H.use(C);
  }, pt.useActionState = function(C, X, nt) {
    return h.H.useActionState(C, X, nt);
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
  }, pt.useImperativeHandle = function(C, X, nt) {
    return h.H.useImperativeHandle(C, X, nt);
  }, pt.useInsertionEffect = function(C, X) {
    return h.H.useInsertionEffect(C, X);
  }, pt.useLayoutEffect = function(C, X) {
    return h.H.useLayoutEffect(C, X);
  }, pt.useMemo = function(C, X) {
    return h.H.useMemo(C, X);
  }, pt.useOptimistic = function(C, X) {
    return h.H.useOptimistic(C, X);
  }, pt.useReducer = function(C, X, nt) {
    return h.H.useReducer(C, X, nt);
  }, pt.useRef = function(C) {
    return h.H.useRef(C);
  }, pt.useState = function(C) {
    return h.H.useState(C);
  }, pt.useSyncExternalStore = function(C, X, nt) {
    return h.H.useSyncExternalStore(
      C,
      X,
      nt
    );
  }, pt.useTransition = function() {
    return h.H.useTransition();
  }, pt.version = "19.2.8", pt;
}
var jd;
function h0() {
  return jd || (jd = 1, Vo.exports = p0()), Vo.exports;
}
var W = h0();
const Af = /* @__PURE__ */ ws(W), g0 = /* @__PURE__ */ bs({
  __proto__: null,
  default: Af
}, [W]);
//! "react" as the runtime bundles it, for its own code, the stock screens and every screen's `react` import: React
//! itself, with `useEffect` and `useLayoutEffect` run through `measured` (`dom.mjs`), so an effect that measures a
//! box the engine has not laid out yet runs again once it has (layout readback).
const b0 = Af ?? g0;
function oe(n, l) {
  return W.useEffect(Tf(n), l);
}
function Xr(n, l) {
  return W.useLayoutEffect(Tf(n), l);
}
const v0 = /* @__PURE__ */ bs({
  __proto__: null,
  default: b0,
  useEffect: oe,
  useLayoutEffect: Xr
}, [W]);
var Ko = { exports: {} }, yl = {};
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
function y0() {
  if (Od) return yl;
  Od = 1;
  var n = Symbol.for("react.transitional.element"), l = Symbol.for("react.fragment");
  function o(i, s, f) {
    var m = null;
    if (f !== void 0 && (m = "" + f), s.key !== void 0 && (m = "" + s.key), "key" in s) {
      f = {};
      for (var d in s)
        d !== "key" && (f[d] = s[d]);
    } else f = s;
    return s = f.ref, {
      $$typeof: n,
      type: i,
      key: m,
      ref: s !== void 0 ? s : null,
      props: f
    };
  }
  return yl.Fragment = l, yl.jsx = o, yl.jsxs = o, yl;
}
var Rd;
function x0() {
  return Rd || (Rd = 1, Ko.exports = y0()), Ko.exports;
}
var ct = x0();
const w0 = /* @__PURE__ */ ws(ct), Ay = /* @__PURE__ */ bs({
  __proto__: null,
  default: w0
}, [ct]);
var Xo = { exports: {} }, Zo = { exports: {} };
const _0 = /* @__PURE__ */ m0(v0);
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
var Dd;
function k0() {
  return Dd || (Dd = 1, (function(n) {
    function l(Q, Z) {
      var P = Q.length;
      Q.push(Z);
      t: for (; 0 < P; ) {
        var G = P - 1 >>> 1, V = Q[G];
        if (0 < s(V, Z))
          Q[G] = Z, Q[P] = V, P = G;
        else break t;
      }
    }
    function o(Q) {
      return Q.length === 0 ? null : Q[0];
    }
    function i(Q) {
      if (Q.length === 0) return null;
      var Z = Q[0], P = Q.pop();
      if (P !== Z) {
        Q[0] = P;
        t: for (var G = 0, V = Q.length, C = V >>> 1; G < C; ) {
          var X = 2 * (G + 1) - 1, nt = Q[X], ot = X + 1, st = Q[ot];
          if (0 > s(nt, P))
            ot < V && 0 > s(st, nt) ? (Q[G] = st, Q[ot] = P, G = ot) : (Q[G] = nt, Q[X] = P, G = X);
          else if (ot < V && 0 > s(st, P))
            Q[G] = st, Q[ot] = P, G = ot;
          else break t;
        }
      }
      return Z;
    }
    function s(Q, Z) {
      var P = Q.sortIndex - Z.sortIndex;
      return P !== 0 ? P : Q.id - Z.id;
    }
    if (n.unstable_now = void 0, typeof performance == "object" && typeof performance.now == "function") {
      var f = performance;
      n.unstable_now = function() {
        return f.now();
      };
    } else {
      var m = Date, d = m.now();
      n.unstable_now = function() {
        return m.now() - d;
      };
    }
    var p = [], y = [], E = 1, _ = null, x = 3, z = !1, k = !1, b = !1, N = !1, j = typeof setTimeout == "function" ? setTimeout : null, R = typeof clearTimeout == "function" ? clearTimeout : null, A = typeof setImmediate < "u" ? setImmediate : null;
    function K(Q) {
      for (var Z = o(y); Z !== null; ) {
        if (Z.callback === null) i(y);
        else if (Z.startTime <= Q)
          i(y), Z.sortIndex = Z.expirationTime, l(p, Z);
        else break;
        Z = o(y);
      }
    }
    function H(Q) {
      if (b = !1, K(Q), !k)
        if (o(p) !== null)
          k = !0, D || (D = !0, B());
        else {
          var Z = o(y);
          Z !== null && et(H, Z.startTime - Q);
        }
    }
    var D = !1, h = -1, v = 5, w = -1;
    function S() {
      return N ? !0 : !(n.unstable_now() - w < v);
    }
    function T() {
      if (N = !1, D) {
        var Q = n.unstable_now();
        w = Q;
        var Z = !0;
        try {
          t: {
            k = !1, b && (b = !1, R(h), h = -1), z = !0;
            var P = x;
            try {
              e: {
                for (K(Q), _ = o(p); _ !== null && !(_.expirationTime > Q && S()); ) {
                  var G = _.callback;
                  if (typeof G == "function") {
                    _.callback = null, x = _.priorityLevel;
                    var V = G(
                      _.expirationTime <= Q
                    );
                    if (Q = n.unstable_now(), typeof V == "function") {
                      _.callback = V, K(Q), Z = !0;
                      break e;
                    }
                    _ === o(p) && i(p), K(Q);
                  } else i(p);
                  _ = o(p);
                }
                if (_ !== null) Z = !0;
                else {
                  var C = o(y);
                  C !== null && et(
                    H,
                    C.startTime - Q
                  ), Z = !1;
                }
              }
              break t;
            } finally {
              _ = null, x = P, z = !1;
            }
            Z = void 0;
          }
        } finally {
          Z ? B() : D = !1;
        }
      }
    }
    var B;
    if (typeof A == "function")
      B = function() {
        A(T);
      };
    else if (typeof MessageChannel < "u") {
      var L = new MessageChannel(), $ = L.port2;
      L.port1.onmessage = T, B = function() {
        $.postMessage(null);
      };
    } else
      B = function() {
        j(T, 0);
      };
    function et(Q, Z) {
      h = j(function() {
        Q(n.unstable_now());
      }, Z);
    }
    n.unstable_IdlePriority = 5, n.unstable_ImmediatePriority = 1, n.unstable_LowPriority = 4, n.unstable_NormalPriority = 3, n.unstable_Profiling = null, n.unstable_UserBlockingPriority = 2, n.unstable_cancelCallback = function(Q) {
      Q.callback = null;
    }, n.unstable_forceFrameRate = function(Q) {
      0 > Q || 125 < Q ? console.error(
        "forceFrameRate takes a positive int between 0 and 125, forcing frame rates higher than 125 fps is not supported"
      ) : v = 0 < Q ? Math.floor(1e3 / Q) : 5;
    }, n.unstable_getCurrentPriorityLevel = function() {
      return x;
    }, n.unstable_next = function(Q) {
      switch (x) {
        case 1:
        case 2:
        case 3:
          var Z = 3;
          break;
        default:
          Z = x;
      }
      var P = x;
      x = Z;
      try {
        return Q();
      } finally {
        x = P;
      }
    }, n.unstable_requestPaint = function() {
      N = !0;
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
      var P = x;
      x = Q;
      try {
        return Z();
      } finally {
        x = P;
      }
    }, n.unstable_scheduleCallback = function(Q, Z, P) {
      var G = n.unstable_now();
      switch (typeof P == "object" && P !== null ? (P = P.delay, P = typeof P == "number" && 0 < P ? G + P : G) : P = G, Q) {
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
      return V = P + V, Q = {
        id: E++,
        callback: Z,
        priorityLevel: Q,
        startTime: P,
        expirationTime: V,
        sortIndex: -1
      }, P > G ? (Q.sortIndex = P, l(y, Q), o(p) === null && Q === o(y) && (b ? (R(h), h = -1) : b = !0, et(H, P - G))) : (Q.sortIndex = V, l(p, Q), k || z || (k = !0, D || (D = !0, B()))), Q;
    }, n.unstable_shouldYield = S, n.unstable_wrapCallback = function(Q) {
      var Z = x;
      return function() {
        var P = x;
        x = Z;
        try {
          return Q.apply(this, arguments);
        } finally {
          x = P;
        }
      };
    };
  })(Wo)), Wo;
}
var Bd;
function S0() {
  return Bd || (Bd = 1, Jo.exports = k0()), Jo.exports;
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
var Hd;
function E0() {
  return Hd || (Hd = 1, (function(n) {
    n.exports = function(l) {
      function o(t, e, a, r) {
        return new ep(t, e, a, r);
      }
      function i() {
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
      function f(t) {
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
        if (f(t) !== t)
          throw Error(s(188));
      }
      function d(t) {
        var e = t.alternate;
        if (!e) {
          if (e = f(t), e === null) throw Error(s(188));
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
        return t === null || typeof t != "object" ? null : (t = Ku && t[Ku] || t["@@iterator"], typeof t == "function" ? t : null);
      }
      function _(t) {
        if (t == null) return null;
        if (typeof t == "function")
          return t.$$typeof === ip ? null : t.displayName || t.name || null;
        if (typeof t == "string") return t;
        switch (t) {
          case xa:
            return "Fragment";
          case co:
            return "Profiler";
          case Lu:
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
            case ya:
              return "Portal";
            case _n:
              return t.displayName || "Context";
            case Vu:
              return (t._context.displayName || "Context") + ".Consumer";
            case uo:
              var e = t.render;
              return t = t.displayName, t || (t = e.displayName || e.name || "", t = t !== "" ? "ForwardRef(" + t + ")" : "ForwardRef"), t;
            case po:
              return e = t.displayName || null, e !== null ? e : _(t.type) || "Memo";
            case kn:
              e = t._payload, t = t._init;
              try {
                return _(t(e));
              } catch {
              }
          }
        return null;
      }
      function x(t) {
        return { current: t };
      }
      function z(t) {
        0 > ka || (t.current = wo[ka], wo[ka] = null, ka--);
      }
      function k(t, e) {
        ka++, wo[ka] = t.current, t.current = e;
      }
      function b(t) {
        return t >>>= 0, t === 0 ? 32 : 31 - (Rh(t) / Dh | 0) | 0;
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
      function j(t, e, a) {
        var r = t.pendingLanes;
        if (r === 0) return 0;
        var c = 0, u = t.suspendedLanes, g = t.pingedLanes;
        t = t.warmLanes;
        var M = r & 134217727;
        return M !== 0 ? (r = M & ~u, r !== 0 ? c = N(r) : (g &= M, g !== 0 ? c = N(g) : a || (a = M & ~t, a !== 0 && (c = N(a))))) : (M = r & ~u, M !== 0 ? c = N(M) : g !== 0 ? c = N(g) : a || (a = r & ~t, a !== 0 && (c = N(a)))), c === 0 ? 0 : e !== 0 && e !== c && (e & u) === 0 && (u = c & -c, a = e & -e, u >= a || u === 32 && (a & 4194048) !== 0) ? e : c;
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
      function K() {
        var t = ur;
        return ur <<= 1, (ur & 62914560) === 0 && (ur = 4194304), t;
      }
      function H(t) {
        for (var e = [], a = 0; 31 > a; a++) e.push(t);
        return e;
      }
      function D(t, e) {
        t.pendingLanes |= e, e !== 268435456 && (t.suspendedLanes = 0, t.pingedLanes = 0, t.warmLanes = 0);
      }
      function h(t, e, a, r, c, u) {
        var g = t.pendingLanes;
        t.pendingLanes = a, t.suspendedLanes = 0, t.pingedLanes = 0, t.warmLanes = 0, t.expiredLanes &= a, t.entangledLanes &= a, t.errorRecoveryDisabledLanes &= a, t.shellSuspendCounter = 0;
        var M = t.entanglements, Y = t.expirationTimes, J = t.hiddenUpdates;
        for (a = g & ~a; 0 < a; ) {
          var tt = 31 - we(a), F = 1 << tt;
          M[tt] = 0, Y[tt] = -1;
          var at = J[tt];
          if (at !== null)
            for (J[tt] = null, tt = 0; tt < at.length; tt++) {
              var gt = at[tt];
              gt !== null && (gt.lane &= -536870913);
            }
          a &= ~F;
        }
        r !== 0 && v(t, r, 0), u !== 0 && c === 0 && t.tag !== 0 && (t.suspendedLanes |= u & ~(g & ~e));
      }
      function v(t, e, a) {
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
      function S(t, e) {
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
      function B(t) {
        return t &= -t, 2 < t ? 8 < t ? (t & 134217727) !== 0 ? 32 : 268435456 : 8 : 2;
      }
      function L(t) {
        if (typeof Yh == "function" && Gh(t), _e && typeof _e.setStrictMode == "function")
          try {
            _e.setStrictMode(il, t);
          } catch {
          }
      }
      function $(t, e) {
        return t === e && (t !== 0 || 1 / t === 1 / e) || t !== t && e !== e;
      }
      function et(t) {
        if (So === void 0)
          try {
            throw Error();
          } catch (a) {
            var e = a.stack.trim().match(/\n( *(at )?)/);
            So = e && e[1] || "", bd = -1 < a.stack.indexOf(`
    at`) ? " (<anonymous>)" : -1 < a.stack.indexOf("@") ? "@unknown:0:0" : "";
          }
        return `
` + So + t + bd;
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
                  var F = function() {
                    throw Error();
                  };
                  if (Object.defineProperty(F.prototype, "props", {
                    set: function() {
                      throw Error();
                    }
                  }), typeof Reflect == "object" && Reflect.construct) {
                    try {
                      Reflect.construct(F, []);
                    } catch (gt) {
                      var at = gt;
                    }
                    Reflect.construct(t, [], F);
                  } else {
                    try {
                      F.call();
                    } catch (gt) {
                      at = gt;
                    }
                    t.call(F.prototype);
                  }
                } else {
                  try {
                    throw Error();
                  } catch (gt) {
                    at = gt;
                  }
                  (F = t()) && typeof F.catch == "function" && F.catch(function() {
                  });
                }
              } catch (gt) {
                if (gt && at && typeof gt.stack == "string")
                  return [gt.stack, at.stack];
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
                      var tt = `
` + Y[r].replace(" at new ", " at ");
                      return t.displayName && tt.includes("<anonymous>") && (tt = tt.replace("<anonymous>", t.displayName)), tt;
                    }
                  while (1 <= r && 0 <= c);
                break;
              }
          }
        } finally {
          Eo = !1, Error.prepareStackTrace = a;
        }
        return (a = t ? t.displayName || t.name : "") ? et(a) : "";
      }
      function Z(t, e) {
        switch (t.tag) {
          case 26:
          case 27:
          case 5:
            return et(t.type);
          case 16:
            return et("Lazy");
          case 13:
            return t.child !== e && e !== null ? et("Suspense Fallback") : et("Suspense");
          case 19:
            return et("SuspenseList");
          case 0:
          case 15:
            return Q(t.type, !1);
          case 11:
            return Q(t.type.render, !1);
          case 1:
            return Q(t.type, !0);
          case 31:
            return et("Activity");
          default:
            return "";
        }
      }
      function P(t) {
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
      function G(t, e) {
        if (typeof t == "object" && t !== null) {
          var a = vd.get(t);
          return a !== void 0 ? a : (e = {
            value: t,
            source: e,
            stack: P(e)
          }, vd.set(t, e), e);
        }
        return {
          value: t,
          source: e,
          stack: P(e)
        };
      }
      function V(t, e) {
        Ea[za++] = ol, Ea[za++] = fr, fr = t, ol = e;
      }
      function C(t, e, a) {
        Ce[Me++] = Xe, Ce[Me++] = Ze, Ce[Me++] = Sn, Sn = t;
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
      function X(t) {
        t.return !== null && (V(t, 1), C(t, 1, 0));
      }
      function nt(t) {
        for (; t === fr; )
          fr = Ea[--za], Ea[za] = null, ol = Ea[--za], Ea[za] = null;
        for (; t === Sn; )
          Sn = Ce[--Me], Ce[Me] = null, Ze = Ce[--Me], Ce[Me] = null, Xe = Ce[--Me], Ce[Me] = null;
      }
      function ot(t, e) {
        Ce[Me++] = Xe, Ce[Me++] = Ze, Ce[Me++] = Sn, Xe = e.id, Ze = e.overflow, Sn = t;
      }
      function st(t, e) {
        k(En, e), k(sl, t), k(ne, null), t = cp(e), z(ne), k(ne, t);
      }
      function ut() {
        z(ne), z(sl), z(En);
      }
      function Et(t) {
        t.memoizedState !== null && k(mr, t);
        var e = ne.current, a = up(e, t.type);
        e !== a && (k(sl, t), k(ne, a));
      }
      function Jt(t) {
        sl.current === t && (z(ne), z(sl)), mr.current === t && (z(mr), an ? $n._currentValue = wa : $n._currentValue2 = wa);
      }
      function ht(t) {
        var e = Error(
          s(
            418,
            1 < arguments.length && arguments[1] !== void 0 && arguments[1] ? "text" : "HTML",
            ""
          )
        );
        throw Qa(G(e, t)), zo;
      }
      function Qn(t, e) {
        if (!ue) throw Error(s(175));
        uh(
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
        if (Kt ? e !== 3 && e !== 27 && (e !== 5 || ld(t.type) && !or(t.type, t.memoizedProps)) && Ot && ht(t) : e !== 3 && (e !== 5 || ld(t.type) && !or(t.type, t.memoizedProps)) && Ot && ht(t), Ln(t), e === 13) {
          if (!ue) throw Error(s(316));
          if (t = t.memoizedState, t = t !== null ? t.dehydrated : null, !t) throw Error(s(317));
          Ot = hh(t);
        } else if (e === 31) {
          if (t = t.memoizedState, t = t !== null ? t.dehydrated : null, !t) throw Error(s(317));
          Ot = ph(t);
        } else
          Ot = Kt && e === 27 ? th(
            t.type,
            Ot
          ) : ae ? ad(t.stateNode) : null;
        return !0;
      }
      function Be() {
        ue && (Ot = ae = null, St = !1);
      }
      function pn() {
        var t = zn;
        return t !== null && (be === null ? be = t : be.push.apply(
          be,
          t
        ), zn = null), t;
      }
      function Qa(t) {
        zn === null ? zn = [t] : zn.push(t);
      }
      function hn(t, e, a) {
        an ? (k(pr, e._currentValue), e._currentValue = a) : (k(pr, e._currentValue2), e._currentValue2 = a);
      }
      function Ie(t) {
        var e = pr.current;
        an ? t._currentValue = e : t._currentValue2 = e, z(pr);
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
              var M = u;
              u = c;
              for (var Y = 0; Y < e.length; Y++)
                if (M.context === e[Y]) {
                  u.lanes |= a, M = u.alternate, M !== null && (M.lanes |= a), ii(
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
      function ma(t, e, a, r) {
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
            g.memoizedState.memoizedState !== c.memoizedState.memoizedState && (t !== null ? t.push($n) : t = [$n]);
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
      function Ml(t) {
        for (t = t.firstContext; t !== null; ) {
          var e = t.context;
          if (!ke(
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
      function te(t) {
        return As(Pn, t);
      }
      function Al(t, e) {
        return Pn === null && Vn(t), As(t, e);
      }
      function As(t, e) {
        var a = an ? e._currentValue : e._currentValue2;
        if (e = { context: e, memoizedValue: a, next: null }, rn === null) {
          if (t === null) throw Error(s(308));
          rn = e, t.dependencies = { lanes: 0, firstContext: e }, t.flags |= 524288;
        } else rn = rn.next = e;
        return a;
      }
      function si() {
        return {
          controller: new Lh(),
          data: /* @__PURE__ */ new Map(),
          refCount: 0
        };
      }
      function La(t) {
        t.refCount--, t.refCount === 0 && Vh(Kh, function() {
          t.controller.abort();
        });
      }
      function jl() {
      }
      function Le(t) {
        t !== Na && t.next === null && (Na === null ? hr = Na = t : Na = Na.next = t), gr = !0, No || (No = !0, Am());
      }
      function pa(t, e) {
        if (!To && gr) {
          To = !0;
          do
            for (var a = !1, r = hr; r !== null; ) {
              if (t !== 0) {
                var c = r.pendingLanes;
                if (c === 0) var u = 0;
                else {
                  var g = r.suspendedLanes, M = r.pingedLanes;
                  u = (1 << 31 - we(42 | t) + 1) - 1, u &= c & ~(g & ~M), u = u & 201326741 ? u & 201326741 | 1 : u ? u | 2 : 0;
                }
                u !== 0 && (a = !0, Bs(r, u));
              } else
                u = _t, u = j(
                  r,
                  r === At ? u : 0,
                  r.cancelPendingCommit !== null || r.timeoutHandle !== In
                ), (u & 3) === 0 || R(r, u) || (a = !0, Bs(r, u));
              r = r.next;
            }
          while (a);
          To = !1;
        }
      }
      function js() {
        Os();
      }
      function Os() {
        gr = No = !1;
        var t = 0;
        ta !== 0 && yp() && (t = ta);
        for (var e = he(), a = null, r = hr; r !== null; ) {
          var c = r.next, u = Rs(r, e);
          u === 0 ? (r.next = null, a === null ? hr = c : a.next = c, c === null && (Na = a)) : (a = r, (t !== 0 || (u & 3) !== 0) && (gr = !0)), r = c;
        }
        Xt !== 0 && Xt !== 5 || pa(t), ta !== 0 && (ta = 0);
      }
      function Rs(t, e) {
        for (var a = t.suspendedLanes, r = t.pingedLanes, c = t.expirationTimes, u = t.pendingLanes & -62914561; 0 < u; ) {
          var g = 31 - we(u), M = 1 << g, Y = c[g];
          Y === -1 ? ((M & a) === 0 || (M & r) !== 0) && (c[g] = A(M, e)) : Y <= e && (t.expiredLanes |= M), u &= ~M;
        }
        if (e = At, a = _t, a = j(
          t,
          t === e ? a : 0,
          t.cancelPendingCommit !== null || t.timeoutHandle !== In
        ), r = t.callbackNode, a === 0 || t === e && (Ct === 2 || Ct === 9) || t.cancelPendingCommit !== null)
          return r !== null && r !== null && _o(r), t.callbackNode = null, t.callbackPriority = 0;
        if ((a & 3) === 0 || R(t, a)) {
          if (e = a & -a, e === t.callbackPriority) return e;
          switch (r !== null && _o(r), B(a)) {
            case 2:
            case 8:
              a = Uh;
              break;
            case 32:
              a = ko;
              break;
            case 268435456:
              a = qh;
              break;
            default:
              a = ko;
          }
          return r = Ds.bind(null, t), a = dr(a, r), t.callbackPriority = e, t.callbackNode = a, e;
        }
        return r !== null && r !== null && _o(r), t.callbackPriority = 2, t.callbackNode = null, 2;
      }
      function Ds(t, e) {
        if (Xt !== 0 && Xt !== 5)
          return t.callbackNode = null, t.callbackPriority = 0, null;
        var a = t.callbackNode;
        if (nl() && t.callbackNode !== a)
          return null;
        var r = _t;
        return r = j(
          t,
          t === At ? r : 0,
          t.cancelPendingCommit !== null || t.timeoutHandle !== In
        ), r === 0 ? null : (vu(t, r, e), Rs(t, he()), t.callbackNode != null && t.callbackNode === a ? Ds.bind(null, t) : null);
      }
      function Bs(t, e) {
        if (nl()) return null;
        vu(t, e, !0);
      }
      function Am() {
        zp ? Np(function() {
          (xt & 6) !== 0 ? dr(
            hd,
            js
          ) : Os();
        }) : dr(
          hd,
          js
        );
      }
      function ci() {
        if (ta === 0) {
          var t = Ta;
          t === 0 && (t = sr, sr <<= 1, (sr & 261888) === 0 && (sr = 256)), ta = t;
        }
        return ta;
      }
      function jm(t, e) {
        if (cl === null) {
          var a = cl = [];
          Co = 0, Ta = ci(), Ca = {
            status: "pending",
            value: void 0,
            then: function(r) {
              a.push(r);
            }
          };
        }
        return Co++, e.then(Hs, Hs), e;
      }
      function Hs() {
        if (--Co === 0 && cl !== null) {
          Ca !== null && (Ca.status = "fulfilled");
          var t = cl;
          cl = null, Ta = 0, Ca = null;
          for (var e = 0; e < t.length; e++) (0, t[e])();
        }
      }
      function Om(t, e) {
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
        var t = ea.current;
        return t !== null ? t : At.pooledCache;
      }
      function Ol(t, e) {
        e === null ? k(ea, ea.current) : k(ea, e.pool);
      }
      function Us() {
        var t = ui();
        return t === null ? null : {
          parent: an ? Rt._currentValue : Rt._currentValue2,
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
          if (!Qh.call(e, c) || !ke(t[c], e[c]))
            return !1;
        }
        return !0;
      }
      function qs(t) {
        return t = t.status, t === "fulfilled" || t === "rejected";
      }
      function Ys(t, e, a) {
        switch (a = t[a], a === void 0 ? t.push(e) : a !== e && (e.then(jl, jl), e = a), e.status) {
          case "fulfilled":
            return e.value;
          case "rejected":
            throw t = e.reason, Qs(t), t;
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
                throw t = e.reason, Qs(t), t;
            }
            throw na = e, Ma;
        }
      }
      function Kn(t) {
        try {
          var e = t._init;
          return e(t._payload);
        } catch (a) {
          throw a !== null && typeof a == "object" && typeof a.then == "function" ? (na = a, Ma) : a;
        }
      }
      function Gs() {
        if (na === null) throw Error(s(459));
        var t = na;
        return na = null, t;
      }
      function Qs(t) {
        if (t === Ma || t === br)
          throw Error(s(483));
      }
      function Dl(t) {
        var e = ul;
        return ul += 1, Aa === null && (Aa = []), Ys(Aa, t, e);
      }
      function Va(t, e) {
        e = e.props.ref, t.ref = e !== void 0 ? e : null;
      }
      function Bl(t, e) {
        throw e.$$typeof === lp ? Error(s(525)) : (t = Object.prototype.toString.call(e), Error(
          s(
            31,
            t === "[object Object]" ? "object with keys {" + Object.keys(e).join(", ") + "}" : t
          )
        ));
      }
      function Ls(t) {
        function e(U, O) {
          if (t) {
            var q = U.deletions;
            q === null ? (U.deletions = [O], U.flags |= 16) : q.push(O);
          }
        }
        function a(U, O) {
          if (!t) return null;
          for (; O !== null; )
            e(U, O), O = O.sibling;
          return null;
        }
        function r(U) {
          for (var O = /* @__PURE__ */ new Map(); U !== null; )
            U.key !== null ? O.set(U.key, U) : O.set(U.index, U), U = U.sibling;
          return O;
        }
        function c(U, O) {
          return U = nn(U, O), U.index = 0, U.sibling = null, U;
        }
        function u(U, O, q) {
          return U.index = q, t ? (q = U.alternate, q !== null ? (q = q.index, q < O ? (U.flags |= 67108866, O) : q) : (U.flags |= 67108866, O)) : (U.flags |= 1048576, O);
        }
        function g(U) {
          return t && U.alternate === null && (U.flags |= 67108866), U;
        }
        function M(U, O, q, I) {
          return O === null || O.tag !== 6 ? (O = ro(q, U.mode, I), O.return = U, O) : (O = c(O, q), O.return = U, O);
        }
        function Y(U, O, q, I) {
          var ft = q.type;
          return ft === xa ? tt(
            U,
            O,
            q.props.children,
            I,
            q.key
          ) : O !== null && (O.elementType === ft || typeof ft == "object" && ft !== null && ft.$$typeof === kn && Kn(ft) === O.type) ? (O = c(O, q.props), Va(O, q), O.return = U, O) : (O = lr(
            q.type,
            q.key,
            q.props,
            null,
            U.mode,
            I
          ), Va(O, q), O.return = U, O);
        }
        function J(U, O, q, I) {
          return O === null || O.tag !== 4 || O.stateNode.containerInfo !== q.containerInfo || O.stateNode.implementation !== q.implementation ? (O = io(q, U.mode, I), O.return = U, O) : (O = c(O, q.children || []), O.return = U, O);
        }
        function tt(U, O, q, I, ft) {
          return O === null || O.tag !== 7 ? (O = Fn(
            q,
            U.mode,
            I,
            ft
          ), O.return = U, O) : (O = c(O, q), O.return = U, O);
        }
        function F(U, O, q) {
          if (typeof O == "string" && O !== "" || typeof O == "number" || typeof O == "bigint")
            return O = ro(
              "" + O,
              U.mode,
              q
            ), O.return = U, O;
          if (typeof O == "object" && O !== null) {
            switch (O.$$typeof) {
              case rr:
                return q = lr(
                  O.type,
                  O.key,
                  O.props,
                  null,
                  U.mode,
                  q
                ), Va(q, O), q.return = U, q;
              case ya:
                return O = io(
                  O,
                  U.mode,
                  q
                ), O.return = U, O;
              case kn:
                return O = Kn(O), F(U, O, q);
            }
            if (ir(O) || E(O))
              return O = Fn(
                O,
                U.mode,
                q,
                null
              ), O.return = U, O;
            if (typeof O.then == "function")
              return F(U, Dl(O), q);
            if (O.$$typeof === _n)
              return F(
                U,
                Al(U, O),
                q
              );
            Bl(U, O);
          }
          return null;
        }
        function at(U, O, q, I) {
          var ft = O !== null ? O.key : null;
          if (typeof q == "string" && q !== "" || typeof q == "number" || typeof q == "bigint")
            return ft !== null ? null : M(U, O, "" + q, I);
          if (typeof q == "object" && q !== null) {
            switch (q.$$typeof) {
              case rr:
                return q.key === ft ? Y(U, O, q, I) : null;
              case ya:
                return q.key === ft ? J(U, O, q, I) : null;
              case kn:
                return q = Kn(q), at(U, O, q, I);
            }
            if (ir(q) || E(q))
              return ft !== null ? null : tt(U, O, q, I, null);
            if (typeof q.then == "function")
              return at(
                U,
                O,
                Dl(q),
                I
              );
            if (q.$$typeof === _n)
              return at(
                U,
                O,
                Al(U, q),
                I
              );
            Bl(U, q);
          }
          return null;
        }
        function gt(U, O, q, I, ft) {
          if (typeof I == "string" && I !== "" || typeof I == "number" || typeof I == "bigint")
            return U = U.get(q) || null, M(O, U, "" + I, ft);
          if (typeof I == "object" && I !== null) {
            switch (I.$$typeof) {
              case rr:
                return U = U.get(
                  I.key === null ? q : I.key
                ) || null, Y(O, U, I, ft);
              case ya:
                return U = U.get(
                  I.key === null ? q : I.key
                ) || null, J(O, U, I, ft);
              case kn:
                return I = Kn(I), gt(
                  U,
                  O,
                  q,
                  I,
                  ft
                );
            }
            if (ir(I) || E(I))
              return U = U.get(q) || null, tt(O, U, I, ft, null);
            if (typeof I.then == "function")
              return gt(
                U,
                O,
                q,
                Dl(I),
                ft
              );
            if (I.$$typeof === _n)
              return gt(
                U,
                O,
                q,
                Al(O, I),
                ft
              );
            Bl(O, I);
          }
          return null;
        }
        function le(U, O, q, I) {
          for (var ft = null, Dt = null, mt = O, Nt = O = 0, It = null; mt !== null && Nt < q.length; Nt++) {
            mt.index > Nt ? (It = mt, mt = null) : It = mt.sibling;
            var Tt = at(
              U,
              mt,
              q[Nt],
              I
            );
            if (Tt === null) {
              mt === null && (mt = It);
              break;
            }
            t && mt && Tt.alternate === null && e(U, mt), O = u(Tt, O, Nt), Dt === null ? ft = Tt : Dt.sibling = Tt, Dt = Tt, mt = It;
          }
          if (Nt === q.length)
            return a(U, mt), St && V(U, Nt), ft;
          if (mt === null) {
            for (; Nt < q.length; Nt++)
              mt = F(U, q[Nt], I), mt !== null && (O = u(
                mt,
                O,
                Nt
              ), Dt === null ? ft = mt : Dt.sibling = mt, Dt = mt);
            return St && V(U, Nt), ft;
          }
          for (mt = r(mt); Nt < q.length; Nt++)
            It = gt(
              mt,
              U,
              Nt,
              q[Nt],
              I
            ), It !== null && (t && It.alternate !== null && mt.delete(
              It.key === null ? Nt : It.key
            ), O = u(
              It,
              O,
              Nt
            ), Dt === null ? ft = It : Dt.sibling = It, Dt = It);
          return t && mt.forEach(function(jn) {
            return e(U, jn);
          }), St && V(U, Nt), ft;
        }
        function bl(U, O, q, I) {
          if (q == null) throw Error(s(151));
          for (var ft = null, Dt = null, mt = O, Nt = O = 0, It = null, Tt = q.next(); mt !== null && !Tt.done; Nt++, Tt = q.next()) {
            mt.index > Nt ? (It = mt, mt = null) : It = mt.sibling;
            var jn = at(U, mt, Tt.value, I);
            if (jn === null) {
              mt === null && (mt = It);
              break;
            }
            t && mt && jn.alternate === null && e(U, mt), O = u(jn, O, Nt), Dt === null ? ft = jn : Dt.sibling = jn, Dt = jn, mt = It;
          }
          if (Tt.done)
            return a(U, mt), St && V(U, Nt), ft;
          if (mt === null) {
            for (; !Tt.done; Nt++, Tt = q.next())
              Tt = F(U, Tt.value, I), Tt !== null && (O = u(
                Tt,
                O,
                Nt
              ), Dt === null ? ft = Tt : Dt.sibling = Tt, Dt = Tt);
            return St && V(U, Nt), ft;
          }
          for (mt = r(mt); !Tt.done; Nt++, Tt = q.next())
            Tt = gt(
              mt,
              U,
              Nt,
              Tt.value,
              I
            ), Tt !== null && (t && Tt.alternate !== null && mt.delete(Tt.key === null ? Nt : Tt.key), O = u(Tt, O, Nt), Dt === null ? ft = Tt : Dt.sibling = Tt, Dt = Tt);
          return t && mt.forEach(function(Wh) {
            return e(U, Wh);
          }), St && V(U, Nt), ft;
        }
        function ia(U, O, q, I) {
          if (typeof q == "object" && q !== null && q.type === xa && q.key === null && (q = q.props.children), typeof q == "object" && q !== null) {
            switch (q.$$typeof) {
              case rr:
                t: {
                  for (var ft = q.key; O !== null; ) {
                    if (O.key === ft) {
                      if (ft = q.type, ft === xa) {
                        if (O.tag === 7) {
                          a(
                            U,
                            O.sibling
                          ), I = c(
                            O,
                            q.props.children
                          ), I.return = U, U = I;
                          break t;
                        }
                      } else if (O.elementType === ft || typeof ft == "object" && ft !== null && ft.$$typeof === kn && Kn(ft) === O.type) {
                        a(
                          U,
                          O.sibling
                        ), I = c(O, q.props), Va(I, q), I.return = U, U = I;
                        break t;
                      }
                      a(U, O);
                      break;
                    } else e(U, O);
                    O = O.sibling;
                  }
                  q.type === xa ? (I = Fn(
                    q.props.children,
                    U.mode,
                    I,
                    q.key
                  ), I.return = U, U = I) : (I = lr(
                    q.type,
                    q.key,
                    q.props,
                    null,
                    U.mode,
                    I
                  ), Va(I, q), I.return = U, U = I);
                }
                return g(U);
              case ya:
                t: {
                  for (ft = q.key; O !== null; ) {
                    if (O.key === ft)
                      if (O.tag === 4 && O.stateNode.containerInfo === q.containerInfo && O.stateNode.implementation === q.implementation) {
                        a(
                          U,
                          O.sibling
                        ), I = c(
                          O,
                          q.children || []
                        ), I.return = U, U = I;
                        break t;
                      } else {
                        a(U, O);
                        break;
                      }
                    else e(U, O);
                    O = O.sibling;
                  }
                  I = io(q, U.mode, I), I.return = U, U = I;
                }
                return g(U);
              case kn:
                return q = Kn(q), ia(
                  U,
                  O,
                  q,
                  I
                );
            }
            if (ir(q))
              return le(
                U,
                O,
                q,
                I
              );
            if (E(q)) {
              if (ft = E(q), typeof ft != "function")
                throw Error(s(150));
              return q = ft.call(q), bl(
                U,
                O,
                q,
                I
              );
            }
            if (typeof q.then == "function")
              return ia(
                U,
                O,
                Dl(q),
                I
              );
            if (q.$$typeof === _n)
              return ia(
                U,
                O,
                Al(U, q),
                I
              );
            Bl(U, q);
          }
          return typeof q == "string" && q !== "" || typeof q == "number" || typeof q == "bigint" ? (q = "" + q, O !== null && O.tag === 6 ? (a(U, O.sibling), I = c(O, q), I.return = U, U = I) : (a(U, O), I = ro(q, U.mode, I), I.return = U, U = I), g(U)) : a(U, O);
        }
        return function(U, O, q, I) {
          try {
            ul = 0;
            var ft = ia(
              U,
              O,
              q,
              I
            );
            return Aa = null, ft;
          } catch (mt) {
            if (mt === Ma || mt === br) throw mt;
            var Dt = o(29, mt, null, U.mode);
            return Dt.lanes = I, Dt.return = U, Dt;
          } finally {
          }
        };
      }
      function Hl() {
        for (var t = ja, e = Ao = ja = 0; e < t; ) {
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
          u !== 0 && Vs(a, c, u);
        }
      }
      function Ul(t, e, a, r) {
        je[ja++] = t, je[ja++] = e, je[ja++] = a, je[ja++] = r, Ao |= r, t.lanes |= r, t = t.alternate, t !== null && (t.lanes |= r);
      }
      function di(t, e, a, r) {
        return Ul(t, e, a, r), ql(t);
      }
      function Xn(t, e) {
        return Ul(t, null, null, e), ql(t);
      }
      function Vs(t, e, a) {
        t.lanes |= a;
        var r = t.alternate;
        r !== null && (r.lanes |= a);
        for (var c = !1, u = t.return; u !== null; )
          u.childLanes |= a, r = u.alternate, r !== null && (r.childLanes |= a), u.tag === 22 && (t = u.stateNode, t === null || t._visibility & 1 || (c = !0)), t = u, u = u.return;
        return t.tag === 3 ? (u = t.stateNode, c && e !== null && (c = 31 - we(a), t = u.hiddenUpdates, r = t[c], r === null ? t[c] = [e] : r.push(e), e.lane = a | 536870912), u) : null;
      }
      function ql(t) {
        if (50 < gl)
          throw gl = 0, Lo = null, Error(s(185));
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
      function gn(t) {
        return { lane: t, tag: 0, payload: null, callback: null, next: null };
      }
      function bn(t, e, a) {
        var r = t.updateQueue;
        if (r === null) return null;
        if (r = r.shared, (xt & 2) !== 0) {
          var c = r.pending;
          return c === null ? e.next = e : (e.next = c.next, c.next = e), r.pending = e, e = ql(t), Vs(t, null, a), e;
        }
        return Ul(t, r, e, a), ql(t);
      }
      function Ka(t, e, a) {
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
      function Xa() {
        if (jo) {
          var t = Ca;
          if (t !== null) throw t;
        }
      }
      function Za(t, e, a, r) {
        jo = !1;
        var c = t.updateQueue;
        Nn = !1;
        var u = c.firstBaseUpdate, g = c.lastBaseUpdate, M = c.shared.pending;
        if (M !== null) {
          c.shared.pending = null;
          var Y = M, J = Y.next;
          Y.next = null, g === null ? u = J : g.next = J, g = Y;
          var tt = t.alternate;
          tt !== null && (tt = tt.updateQueue, M = tt.lastBaseUpdate, M !== g && (M === null ? tt.firstBaseUpdate = J : M.next = J, tt.lastBaseUpdate = Y));
        }
        if (u !== null) {
          var F = c.baseState;
          g = 0, tt = J = Y = null, M = u;
          do {
            var at = M.lane & -536870913, gt = at !== M.lane;
            if (gt ? (_t & at) === at : (r & at) === at) {
              at !== 0 && at === Ta && (jo = !0), tt !== null && (tt = tt.next = {
                lane: 0,
                tag: M.tag,
                payload: M.payload,
                callback: null,
                next: null
              });
              t: {
                var le = t, bl = M;
                at = e;
                var ia = a;
                switch (bl.tag) {
                  case 1:
                    if (le = bl.payload, typeof le == "function") {
                      F = le.call(
                        ia,
                        F,
                        at
                      );
                      break t;
                    }
                    F = le;
                    break t;
                  case 3:
                    le.flags = le.flags & -65537 | 128;
                  case 0:
                    if (le = bl.payload, at = typeof le == "function" ? le.call(ia, F, at) : le, at == null) break t;
                    F = so({}, F, at);
                    break t;
                  case 2:
                    Nn = !0;
                }
              }
              at = M.callback, at !== null && (t.flags |= 64, gt && (t.flags |= 8192), gt = c.callbacks, gt === null ? c.callbacks = [at] : gt.push(at));
            } else
              gt = {
                lane: at,
                tag: M.tag,
                payload: M.payload,
                callback: M.callback,
                next: null
              }, tt === null ? (J = tt = gt, Y = F) : tt = tt.next = gt, g |= at;
            if (M = M.next, M === null) {
              if (M = c.shared.pending, M === null)
                break;
              gt = M, M = gt.next, gt.next = null, c.lastBaseUpdate = gt, c.shared.pending = null;
            }
          } while (!0);
          tt === null && (Y = F), c.baseState = Y, c.firstBaseUpdate = J, c.lastBaseUpdate = tt, u === null && (c.shared.lanes = 0), Cn |= g, t.lanes = g, t.memoizedState = F;
        }
      }
      function Ks(t, e) {
        if (typeof t != "function")
          throw Error(s(191, t));
        t.call(e);
      }
      function Xs(t, e) {
        var a = t.callbacks;
        if (a !== null)
          for (t.callbacks = null, t = 0; t < a.length; t++)
            Ks(a[t], e);
      }
      function Zs(t, e) {
        t = cn, k(yr, t), k(Oa, e), cn = t | e.baseLanes;
      }
      function hi() {
        k(yr, cn), k(Oa, Oa.current);
      }
      function gi() {
        cn = yr.current, z(Oa), z(yr);
      }
      function vn(t) {
        var e = t.alternate;
        k(Yt, Yt.current & 1), k(Se, t), Oe === null && (e === null || Oa.current !== null || e.memoizedState !== null) && (Oe = t);
      }
      function bi(t) {
        k(Yt, Yt.current), k(Se, t), Oe === null && (Oe = t);
      }
      function Js(t) {
        t.tag === 22 ? (k(Yt, Yt.current), k(Se, t), Oe === null && (Oe = t)) : yn();
      }
      function yn() {
        k(Yt, Yt.current), k(Se, Se.current);
      }
      function ve(t) {
        z(Se), Oe === t && (Oe = null), z(Yt);
      }
      function Yl(t) {
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
        return on = u, bt = e, e.memoizedState = null, e.updateQueue = null, e.lanes = 0, dt.H = t === null || t.memoizedState === null ? wd : Oo, la = !1, u = a(r, c), la = !1, Ra && (u = Fs(
          e,
          a,
          r,
          c
        )), Ws(t), u;
      }
      function Ws(t) {
        dt.H = fl;
        var e = Mt !== null && Mt.next !== null;
        if (on = 0, Gt = Mt = bt = null, xr = !1, dl = 0, Da = null, e) throw Error(s(300));
        t === null || Qt || (t = t.dependencies, t !== null && Ml(t) && (Qt = !0));
      }
      function Fs(t, e, a, r) {
        bt = t;
        var c = 0;
        do {
          if (Ra && (Da = null), dl = 0, Ra = !1, 25 <= c) throw Error(s(301));
          if (c += 1, Gt = Mt = null, t.updateQueue != null) {
            var u = t.updateQueue;
            u.lastEffect = null, u.events = null, u.stores = null, u.memoCache != null && (u.memoCache.index = 0);
          }
          dt.H = _d, u = e(a, r);
        } while (Ra);
        return u;
      }
      function Rm() {
        var t = dt.H, e = t.useState()[0];
        return e = typeof e.then == "function" ? Ja(e) : e, t = t.useState()[0], (Mt !== null ? Mt.memoizedState : null) !== t && (bt.flags |= 1024), e;
      }
      function xi() {
        var t = wr !== 0;
        return wr = 0, t;
      }
      function wi(t, e, a) {
        e.updateQueue = t.updateQueue, e.flags &= -2053, t.lanes &= ~a;
      }
      function _i(t) {
        if (xr) {
          for (t = t.memoizedState; t !== null; ) {
            var e = t.queue;
            e !== null && (e.pending = null), t = t.next;
          }
          xr = !1;
        }
        on = 0, Gt = Mt = bt = null, Ra = !1, dl = wr = 0, Da = null;
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
      function Ja(t) {
        var e = dl;
        return dl += 1, Da === null && (Da = []), t = Ys(Da, t, e), e = bt, (Gt === null ? e.memoizedState : Gt.next) === null && (e = e.alternate, dt.H = e === null || e.memoizedState === null ? wd : Oo), t;
      }
      function Ql(t) {
        if (t !== null && typeof t == "object") {
          if (typeof t.then == "function") return Ja(t);
          if (t.$$typeof === _n) return te(t);
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
            a[r] = rp;
        return e.index++, a;
      }
      function $e(t, e) {
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
          var M = g = null, Y = null, J = e, tt = !1;
          do {
            var F = J.lane & -536870913;
            if (F !== J.lane ? (_t & F) === F : (on & F) === F) {
              var at = J.revertLane;
              if (at === 0)
                Y !== null && (Y = Y.next = {
                  lane: 0,
                  revertLane: 0,
                  gesture: null,
                  action: J.action,
                  hasEagerState: J.hasEagerState,
                  eagerState: J.eagerState,
                  next: null
                }), F === Ta && (tt = !0);
              else if ((on & at) === at) {
                J = J.next, at === Ta && (tt = !0);
                continue;
              } else
                F = {
                  lane: 0,
                  revertLane: J.revertLane,
                  gesture: null,
                  action: J.action,
                  hasEagerState: J.hasEagerState,
                  eagerState: J.eagerState,
                  next: null
                }, Y === null ? (M = Y = F, g = u) : Y = Y.next = F, bt.lanes |= at, Cn |= at;
              F = J.action, la && a(u, F), u = J.hasEagerState ? J.eagerState : a(u, F);
            } else
              at = {
                lane: F,
                revertLane: J.revertLane,
                gesture: J.gesture,
                action: J.action,
                hasEagerState: J.hasEagerState,
                eagerState: J.eagerState,
                next: null
              }, Y === null ? (M = Y = at, g = u) : Y = Y.next = at, bt.lanes |= F, Cn |= F;
            J = J.next;
          } while (J !== null && J !== e);
          if (Y === null ? g = u : Y.next = M, !ke(u, t.memoizedState) && (Qt = !0, tt && (a = Ca, a !== null)))
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
          ke(u, e.memoizedState) || (Qt = !0), e.memoizedState = u, e.baseQueue === null && (e.baseState = u), a.lastRenderedState = u;
        }
        return [u, r];
      }
      function Is(t, e, a) {
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
        if (g && (c.memoizedState = a, Qt = !0), c = c.queue, Ti(tc.bind(null, r, c, t), [
          t
        ]), c.getSnapshot !== e || g || Gt !== null && Gt.memoizedState.tag & 1) {
          if (r.flags |= 2048, ha(
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
          u || (on & 127) !== 0 || $s(r, e, a);
        }
        return a;
      }
      function $s(t, e, a) {
        t.flags |= 16384, t = { getSnapshot: e, value: a }, e = bt.updateQueue, e === null ? (e = Gl(), bt.updateQueue = e, e.stores = [t]) : (a = e.stores, a === null ? e.stores = [t] : a.push(t));
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
          return !ke(t, a);
        } catch {
          return !0;
        }
      }
      function nc(t) {
        var e = Xn(t, 2);
        e !== null && pe(e, t, 2);
      }
      function zi(t) {
        var e = fe();
        if (typeof t == "function") {
          var a = t;
          if (t = a(), la) {
            L(!0);
            try {
              a();
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
      function ac(t, e, a, r) {
        return t.baseState = a, Si(
          t,
          Mt,
          typeof r == "function" ? r : $e
        );
      }
      function Dm(t, e, a, r, c) {
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
          dt.T !== null ? a(!0) : u.isTransition = !1, r(u), a = e.pending, a === null ? (u.next = e.pending = u, lc(e, u)) : (u.next = a.next, e.pending = a.next = u);
        }
      }
      function lc(t, e) {
        var a = e.action, r = e.payload, c = t.state;
        if (e.isTransition) {
          var u = dt.T, g = {};
          dt.T = g;
          try {
            var M = a(c, r), Y = dt.S;
            Y !== null && Y(g, M), rc(t, e, M);
          } catch (J) {
            Ni(t, e, J);
          } finally {
            u !== null && g.types !== null && (u.types = g.types), dt.T = u;
          }
        } else
          try {
            u = a(c, r), rc(t, e, u);
          } catch (J) {
            Ni(t, e, J);
          }
      }
      function rc(t, e, a) {
        a !== null && typeof a == "object" && typeof a.then == "function" ? a.then(
          function(r) {
            ic(t, e, r);
          },
          function(r) {
            return Ni(t, e, r);
          }
        ) : ic(t, e, a);
      }
      function ic(t, e, a) {
        e.status = "fulfilled", e.value = a, oc(e), t.state = a, e = t.pending, e !== null && (a = e.next, a === e ? t.pending = null : (a = a.next, e.next = a, lc(t, a)));
      }
      function Ni(t, e, a) {
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
                  var c = $p(
                    Ot,
                    Ae
                  );
                  if (c) {
                    Ot = ad(c), r = Pp(c);
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
          lastRenderedReducer: sc,
          lastRenderedState: e
        }, a.queue = r, a = Nc.bind(
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
        }, r.queue = c, a = Dm.bind(
          null,
          bt,
          c,
          u,
          a
        ), c.dispatch = a, r.memoizedState = t, [e, a, !1];
      }
      function uc(t) {
        var e = qt();
        return dc(e, Mt, t);
      }
      function dc(t, e, a) {
        if (e = Si(
          t,
          e,
          sc
        )[0], t = Ll($e)[0], typeof e == "object" && e !== null && typeof e.then == "function")
          try {
            var r = Ja(e);
          } catch (g) {
            throw g === Ma ? br : g;
          }
        else r = e;
        e = qt();
        var c = e.queue, u = c.dispatch;
        return a !== e.memoizedState && (bt.flags |= 2048, ha(
          9,
          { destroy: void 0 },
          Bm.bind(null, c, a),
          null
        )), [r, u, t];
      }
      function Bm(t, e) {
        t.action = e;
      }
      function fc(t) {
        var e = qt(), a = Mt;
        if (a !== null)
          return dc(e, a, t);
        qt(), e = e.memoizedState, a = qt();
        var r = a.queue.dispatch;
        return a.memoizedState = t, [e, r, !1];
      }
      function ha(t, e, a, r) {
        return t = { tag: t, create: a, deps: r, inst: e, next: null }, e = bt.updateQueue, e === null && (e = Gl(), bt.updateQueue = e), a = e.lastEffect, a === null ? e.lastEffect = t.next = t : (r = a.next, a.next = t, t.next = r, e.lastEffect = t), t;
      }
      function mc() {
        return qt().memoizedState;
      }
      function Vl(t, e, a, r) {
        var c = fe();
        bt.flags |= t, c.memoizedState = ha(
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
        Mt !== null && r !== null && vi(r, Mt.memoizedState.deps) ? c.memoizedState = ha(e, u, a, r) : (bt.flags |= t, c.memoizedState = ha(
          1 | e,
          u,
          a,
          r
        ));
      }
      function pc(t, e) {
        Vl(8390656, 8, t, e);
      }
      function Ti(t, e) {
        Kl(2048, 8, t, e);
      }
      function Hm(t) {
        bt.flags |= 4;
        var e = bt.updateQueue;
        if (e === null)
          e = Gl(), bt.updateQueue = e, e.events = [t];
        else {
          var a = e.events;
          a === null ? e.events = [t] : a.push(t);
        }
      }
      function hc(t) {
        var e = qt().memoizedState;
        return Hm({ ref: e, nextImpl: t }), function() {
          if ((xt & 2) !== 0)
            throw Error(s(440));
          return e.impl.apply(void 0, arguments);
        };
      }
      function gc(t, e) {
        return Kl(4, 2, t, e);
      }
      function bc(t, e) {
        return Kl(4, 4, t, e);
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
        a = a != null ? a.concat([t]) : null, Kl(
          4,
          4,
          vc.bind(null, e, t),
          a
        );
      }
      function Ci() {
      }
      function xc(t, e) {
        var a = qt();
        e = e === void 0 ? null : e;
        var r = a.memoizedState;
        return e !== null && vi(e, r[1]) ? r[0] : (a.memoizedState = [t, e], t);
      }
      function wc(t, e) {
        var a = qt();
        e = e === void 0 ? null : e;
        var r = a.memoizedState;
        if (e !== null && vi(e, r[1]))
          return r[0];
        if (r = t(), la) {
          L(!0);
          try {
            t();
          } finally {
            L(!1);
          }
        }
        return a.memoizedState = [r, e], r;
      }
      function Mi(t, e, a) {
        return a === void 0 || (on & 1073741824) !== 0 && (_t & 261930) === 0 ? t.memoizedState = e : (t.memoizedState = a, t = bu(), bt.lanes |= t, Cn |= t, a);
      }
      function _c(t, e, a, r) {
        return ke(a, e) ? a : Oa.current !== null ? (t = Mi(t, a, r), ke(t, e) || (Qt = !0), t) : (on & 42) === 0 || (on & 1073741824) !== 0 && (_t & 261930) === 0 ? (Qt = !0, t.memoizedState = a) : (t = bu(), bt.lanes |= t, Cn |= t, e);
      }
      function kc(t, e, a, r, c) {
        var u = ln();
        Wt(
          u !== 0 && 8 > u ? u : 8
        );
        var g = dt.T, M = {};
        dt.T = M, ji(t, !1, e, a);
        try {
          var Y = c(), J = dt.S;
          if (J !== null && J(M, Y), Y !== null && typeof Y == "object" && typeof Y.then == "function") {
            var tt = Om(
              Y,
              r
            );
            Wa(
              t,
              e,
              tt,
              ye(t)
            );
          } else
            Wa(
              t,
              e,
              r,
              ye(t)
            );
        } catch (F) {
          Wa(
            t,
            e,
            { then: function() {
            }, status: "rejected", reason: F },
            ye()
          );
        } finally {
          Wt(u), g !== null && M.types !== null && (g.types = M.types), dt.T = g;
        }
      }
      function Sc(t) {
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
            lastRenderedReducer: $e,
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
            lastRenderedReducer: $e,
            lastRenderedState: a
          },
          next: null
        }, t.memoizedState = e, t = t.alternate, t !== null && (t.memoizedState = e), e;
      }
      function Ai() {
        return te($n);
      }
      function Ec() {
        return qt().memoizedState;
      }
      function zc() {
        return qt().memoizedState;
      }
      function Um(t) {
        for (var e = t.return; e !== null; ) {
          switch (e.tag) {
            case 24:
            case 3:
              var a = ye();
              t = gn(a);
              var r = bn(e, t, a);
              r !== null && (pe(r, e, a), Ka(r, e, a)), e = { cache: si() }, t.payload = e;
              return;
          }
          e = e.return;
        }
      }
      function qm(t, e, a) {
        var r = ye();
        a = {
          lane: r,
          revertLane: 0,
          gesture: null,
          action: a,
          hasEagerState: !1,
          eagerState: null,
          next: null
        }, Xl(t) ? Tc(e, a) : (a = di(t, e, a, r), a !== null && (pe(a, t, r), Cc(a, e, r)));
      }
      function Nc(t, e, a) {
        var r = ye();
        Wa(t, e, a, r);
      }
      function Wa(t, e, a, r) {
        var c = {
          lane: r,
          revertLane: 0,
          gesture: null,
          action: a,
          hasEagerState: !1,
          eagerState: null,
          next: null
        };
        if (Xl(t)) Tc(e, c);
        else {
          var u = t.alternate;
          if (t.lanes === 0 && (u === null || u.lanes === 0) && (u = e.lastRenderedReducer, u !== null))
            try {
              var g = e.lastRenderedState, M = u(g, a);
              if (c.hasEagerState = !0, c.eagerState = M, ke(M, g))
                return Ul(t, e, c, 0), At === null && Hl(), !1;
            } catch {
            } finally {
            }
          if (a = di(t, e, c, r), a !== null)
            return pe(a, t, r), Cc(a, e, r), !0;
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
        }, Xl(t)) {
          if (e) throw Error(s(479));
        } else
          e = di(
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
      function Tc(t, e) {
        Ra = xr = !0;
        var a = t.pending;
        a === null ? e.next = e : (e.next = a.next, a.next = e), t.pending = e;
      }
      function Cc(t, e, a) {
        if ((a & 4194048) !== 0) {
          var r = e.lanes;
          r &= t.pendingLanes, a |= r, e.lanes = a, w(t, a);
        }
      }
      function Oi(t, e, a, r) {
        e = t.memoizedState, a = a(r, e), a = a == null ? e : so({}, e, a), t.memoizedState = a, t.lanes === 0 && (t.updateQueue.baseState = a);
      }
      function Mc(t, e, a, r, c, u, g) {
        return t = t.stateNode, typeof t.shouldComponentUpdate == "function" ? t.shouldComponentUpdate(r, u, g) : e.prototype && e.prototype.isPureReactComponent ? !Rl(a, r) || !Rl(c, u) : !0;
      }
      function Ac(t, e, a, r) {
        t = e.state, typeof e.componentWillReceiveProps == "function" && e.componentWillReceiveProps(a, r), typeof e.UNSAFE_componentWillReceiveProps == "function" && e.UNSAFE_componentWillReceiveProps(a, r), e.state !== t && Ro.enqueueReplaceState(e, e.state, null);
      }
      function Zn(t, e) {
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
      function Ri(t, e, a) {
        return a = gn(a), a.tag = 3, a.payload = { element: null }, a.callback = function() {
          Zl(t, e);
        }, a;
      }
      function Oc(t) {
        return t = gn(t), t.tag = 3, t;
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
          jc(e, a, r), typeof c != "function" && (Mn === null ? Mn = /* @__PURE__ */ new Set([this]) : Mn.add(this));
          var M = r.stack;
          this.componentDidCatch(r.value, {
            componentStack: M !== null ? M : ""
          });
        });
      }
      function Ym(t, e, a, r, c) {
        if (a.flags |= 32768, r !== null && typeof r == "object" && typeof r.then == "function") {
          if (e = a.alternate, e !== null && ma(
            e,
            a,
            c,
            !0
          ), a = Se.current, a !== null) {
            switch (a.tag) {
              case 31:
              case 13:
                return Oe === null ? nr() : a.alternate === null && Ut === 0 && (Ut = 3), a.flags &= -257, a.flags |= 65536, a.lanes = c, r === vr ? a.flags |= 16384 : (e = a.updateQueue, e === null ? a.updateQueue = /* @__PURE__ */ new Set([r]) : e.add(r), ao(t, r, c)), !1;
              case 22:
                return a.flags |= 65536, r === vr ? a.flags |= 16384 : (e = a.updateQueue, e === null ? (e = {
                  transitions: null,
                  markerInstances: null,
                  retryQueue: /* @__PURE__ */ new Set([r])
                }, a.updateQueue = e) : (a = e.retryQueue, a === null ? e.retryQueue = /* @__PURE__ */ new Set([r]) : a.add(r)), ao(t, r, c)), !1;
            }
            throw Error(s(435, a.tag));
          }
          return ao(t, r, c), nr(), !1;
        }
        if (St)
          return e = Se.current, e !== null ? ((e.flags & 65536) === 0 && (e.flags |= 256), e.flags |= 65536, e.lanes = c, r !== zo && (t = Error(s(422), { cause: r }), Qa(
            G(t, a)
          ))) : (r !== zo && (e = Error(s(423), {
            cause: r
          }), Qa(
            G(e, a)
          )), t = t.current.alternate, t.flags |= 65536, c &= -c, t.lanes |= c, r = G(r, a), c = Ri(
            t.stateNode,
            r,
            c
          ), pi(t, c), Ut !== 4 && (Ut = 2)), !1;
        var u = Error(s(520), { cause: r });
        if (u = G(u, a), pl === null ? pl = [u] : pl.push(u), Ut !== 4 && (Ut = 2), e === null) return !0;
        r = G(r, a), a = e;
        do {
          switch (a.tag) {
            case 3:
              return a.flags |= 65536, t = c & -c, a.lanes |= t, t = Ri(a.stateNode, r, t), pi(a, t), !1;
            case 1:
              if (e = a.type, u = a.stateNode, (a.flags & 128) === 0 && (typeof e.getDerivedStateFromError == "function" || u !== null && typeof u.componentDidCatch == "function" && (Mn === null || !Mn.has(
                u
              ))))
                return a.flags |= 65536, c &= -c, a.lanes |= c, c = Oc(c), Rc(
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
        return Vn(e), r = yi(
          t,
          e,
          a,
          g,
          u,
          c
        ), M = xi(), t !== null && !Qt ? (wi(t, e, c), Pe(t, e, c)) : (St && M && X(e), e.flags |= 1, ee(t, e, r, c), e.child);
      }
      function Bc(t, e, a, r, c) {
        if (t === null) {
          var u = a.type;
          return typeof u == "function" && !lo(u) && u.defaultProps === void 0 && a.compare === null ? (e.tag = 15, e.type = u, Hc(
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
        if (u = t.child, !Gi(t, c)) {
          var g = u.memoizedProps;
          if (a = a.compare, a = a !== null ? a : Rl, a(g, r) && t.ref === e.ref)
            return Pe(
              t,
              e,
              c
            );
        }
        return e.flags |= 1, t = nn(u, r), t.ref = e.ref, t.return = e, e.child = t;
      }
      function Hc(t, e, a, r, c) {
        if (t !== null) {
          var u = t.memoizedProps;
          if (Rl(u, r) && t.ref === e.ref)
            if (Qt = !1, e.pendingProps = r = u, Gi(t, c))
              (t.flags & 131072) !== 0 && (Qt = !0);
            else
              return e.lanes = t.lanes, Pe(t, e, c);
        }
        return Di(
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
            e.memoizedState = { baseLanes: 0, cachePool: null }, t !== null && Ol(
              e,
              u !== null ? u.cachePool : null
            ), u !== null ? Zs(e, u) : hi(), Js(e);
          else
            return r = e.lanes = 536870912, qc(
              t,
              e,
              u !== null ? u.baseLanes | a : a,
              a,
              r
            );
        } else
          u !== null ? (Ol(e, u.cachePool), Zs(e, u), yn(), e.memoizedState = null) : (t !== null && Ol(e, null), hi(), yn());
        return ee(t, e, c, a), e.child;
      }
      function Fa(t, e) {
        return t !== null && t.tag === 22 || e.stateNode !== null || (e.stateNode = {
          _visibility: 1,
          _pendingMarkers: null,
          _retryCache: null,
          _transitions: null
        }), e.sibling;
      }
      function qc(t, e, a, r, c) {
        var u = ui();
        return u = u === null ? null : {
          parent: an ? Rt._currentValue : Rt._currentValue2,
          pool: u
        }, e.memoizedState = {
          baseLanes: a,
          cachePool: u
        }, t !== null && Ol(e, null), hi(), Js(e), t !== null && ma(t, e, r, !0), e.childLanes = c, null;
      }
      function Jl(t, e) {
        return e = Fl(
          { mode: e.mode, children: e.children },
          t.mode
        ), e.ref = t.ref, t.child = e, e.return = t, e;
      }
      function Yc(t, e, a) {
        return aa(e, t.child, null, a), t = Jl(
          e,
          e.pendingProps
        ), t.flags |= 2, ve(e), e.memoizedState = null, t;
      }
      function Gm(t, e, a) {
        var r = e.pendingProps, c = (e.flags & 128) !== 0;
        if (e.flags &= -129, t === null) {
          if (St) {
            if (r.mode === "hidden")
              return t = Jl(e, r), e.lanes = 536870912, Fa(null, t);
            if (bi(e), (t = Ot) ? (t = sh(
              t,
              Ae
            ), t !== null && (e.memoizedState = {
              dehydrated: t,
              treeContext: Sn !== null ? { id: Xe, overflow: Ze } : null,
              retryLane: 536870912,
              hydrationErrors: null
            }, a = Hu(t), a.return = e, e.child = a, ae = e, Ot = null)) : t = null, t === null) throw ht(e);
            return e.lanes = 536870912, null;
          }
          return Jl(e, r);
        }
        var u = t.memoizedState;
        if (u !== null) {
          var g = u.dehydrated;
          if (bi(e), c)
            if (e.flags & 256)
              e.flags &= -257, e = Yc(
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
            if (r = At, r !== null && (g = S(r, a), g !== 0 && g !== u.retryLane))
              throw u.retryLane = g, Xn(t, g), pe(r, t, g), Do;
            nr(), e = Yc(
              t,
              e,
              a
            );
          } else
            t = u.treeContext, ue && (Ot = ah(g), ae = e, St = !0, zn = null, Ae = !1, t !== null && ot(e, t)), e = Jl(e, r), e.flags |= 4096;
          return e;
        }
        return t = nn(t.child, {
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
      function Di(t, e, a, r, c) {
        return Vn(e), a = yi(
          t,
          e,
          a,
          r,
          void 0,
          c
        ), r = xi(), t !== null && !Qt ? (wi(t, e, c), Pe(t, e, c)) : (St && r && X(e), e.flags |= 1, ee(t, e, a, c), e.child);
      }
      function Gc(t, e, a, r, c, u) {
        return Vn(e), e.updateQueue = null, a = Fs(
          e,
          r,
          a,
          c
        ), Ws(t), r = xi(), t !== null && !Qt ? (wi(t, e, u), Pe(t, e, u)) : (St && r && X(e), e.flags |= 1, ee(t, e, a, u), e.child);
      }
      function Qc(t, e, a, r, c) {
        if (Vn(e), e.stateNode === null) {
          var u = Sa, g = a.contextType;
          typeof g == "object" && g !== null && (u = te(g)), u = new a(r, u), e.memoizedState = u.state !== null && u.state !== void 0 ? u.state : null, u.updater = Ro, e.stateNode = u, u._reactInternals = e, u = e.stateNode, u.props = r, u.state = e.memoizedState, u.refs = {}, fi(e), g = a.contextType, u.context = typeof g == "object" && g !== null ? te(g) : Sa, u.state = e.memoizedState, g = a.getDerivedStateFromProps, typeof g == "function" && (Oi(
            e,
            a,
            g,
            r
          ), u.state = e.memoizedState), typeof a.getDerivedStateFromProps == "function" || typeof u.getSnapshotBeforeUpdate == "function" || typeof u.UNSAFE_componentWillMount != "function" && typeof u.componentWillMount != "function" || (g = u.state, typeof u.componentWillMount == "function" && u.componentWillMount(), typeof u.UNSAFE_componentWillMount == "function" && u.UNSAFE_componentWillMount(), g !== u.state && Ro.enqueueReplaceState(
            u,
            u.state,
            null
          ), Za(e, r, u, c), Xa(), u.state = e.memoizedState), typeof u.componentDidMount == "function" && (e.flags |= 4194308), r = !0;
        } else if (t === null) {
          u = e.stateNode;
          var M = e.memoizedProps, Y = Zn(a, M);
          u.props = Y;
          var J = u.context, tt = a.contextType;
          g = Sa, typeof tt == "object" && tt !== null && (g = te(tt));
          var F = a.getDerivedStateFromProps;
          tt = typeof F == "function" || typeof u.getSnapshotBeforeUpdate == "function", M = e.pendingProps !== M, tt || typeof u.UNSAFE_componentWillReceiveProps != "function" && typeof u.componentWillReceiveProps != "function" || (M || J !== g) && Ac(
            e,
            u,
            r,
            g
          ), Nn = !1;
          var at = e.memoizedState;
          u.state = at, Za(e, r, u, c), Xa(), J = e.memoizedState, M || at !== J || Nn ? (typeof F == "function" && (Oi(
            e,
            a,
            F,
            r
          ), J = e.memoizedState), (Y = Nn || Mc(
            e,
            a,
            Y,
            r,
            at,
            J,
            g
          )) ? (tt || typeof u.UNSAFE_componentWillMount != "function" && typeof u.componentWillMount != "function" || (typeof u.componentWillMount == "function" && u.componentWillMount(), typeof u.UNSAFE_componentWillMount == "function" && u.UNSAFE_componentWillMount()), typeof u.componentDidMount == "function" && (e.flags |= 4194308)) : (typeof u.componentDidMount == "function" && (e.flags |= 4194308), e.memoizedProps = r, e.memoizedState = J), u.props = r, u.state = J, u.context = g, r = Y) : (typeof u.componentDidMount == "function" && (e.flags |= 4194308), r = !1);
        } else {
          u = e.stateNode, mi(t, e), g = e.memoizedProps, tt = Zn(a, g), u.props = tt, F = e.pendingProps, at = u.context, J = a.contextType, Y = Sa, typeof J == "object" && J !== null && (Y = te(J)), M = a.getDerivedStateFromProps, (J = typeof M == "function" || typeof u.getSnapshotBeforeUpdate == "function") || typeof u.UNSAFE_componentWillReceiveProps != "function" && typeof u.componentWillReceiveProps != "function" || (g !== F || at !== Y) && Ac(
            e,
            u,
            r,
            Y
          ), Nn = !1, at = e.memoizedState, u.state = at, Za(e, r, u, c), Xa();
          var gt = e.memoizedState;
          g !== F || at !== gt || Nn || t !== null && t.dependencies !== null && Ml(t.dependencies) ? (typeof M == "function" && (Oi(
            e,
            a,
            M,
            r
          ), gt = e.memoizedState), (tt = Nn || Mc(
            e,
            a,
            tt,
            r,
            at,
            gt,
            Y
          ) || t !== null && t.dependencies !== null && Ml(t.dependencies)) ? (J || typeof u.UNSAFE_componentWillUpdate != "function" && typeof u.componentWillUpdate != "function" || (typeof u.componentWillUpdate == "function" && u.componentWillUpdate(r, gt, Y), typeof u.UNSAFE_componentWillUpdate == "function" && u.UNSAFE_componentWillUpdate(
            r,
            gt,
            Y
          )), typeof u.componentDidUpdate == "function" && (e.flags |= 4), typeof u.getSnapshotBeforeUpdate == "function" && (e.flags |= 1024)) : (typeof u.componentDidUpdate != "function" || g === t.memoizedProps && at === t.memoizedState || (e.flags |= 4), typeof u.getSnapshotBeforeUpdate != "function" || g === t.memoizedProps && at === t.memoizedState || (e.flags |= 1024), e.memoizedProps = r, e.memoizedState = gt), u.props = r, u.state = gt, u.context = Y, r = tt) : (typeof u.componentDidUpdate != "function" || g === t.memoizedProps && at === t.memoizedState || (e.flags |= 4), typeof u.getSnapshotBeforeUpdate != "function" || g === t.memoizedProps && at === t.memoizedState || (e.flags |= 1024), r = !1);
        }
        return u = r, Wl(t, e), r = (e.flags & 128) !== 0, u || r ? (u = e.stateNode, a = r && typeof a.getDerivedStateFromError != "function" ? null : u.render(), e.flags |= 1, t !== null && r ? (e.child = aa(
          e,
          t.child,
          null,
          c
        ), e.child = aa(
          e,
          null,
          a,
          c
        )) : ee(t, e, a, c), e.memoizedState = u.state, t = e.child) : t = Pe(
          t,
          e,
          c
        ), t;
      }
      function Lc(t, e, a, r) {
        return Be(), e.flags |= 256, ee(t, e, a, r), e.child;
      }
      function Bi(t) {
        return { baseLanes: t, cachePool: Us() };
      }
      function Hi(t, e, a) {
        return t = t !== null ? t.childLanes & ~a : 0, e && (t |= ze), t;
      }
      function Vc(t, e, a) {
        var r = e.pendingProps, c = !1, u = (e.flags & 128) !== 0, g;
        if ((g = u) || (g = t !== null && t.memoizedState === null ? !1 : (Yt.current & 2) !== 0), g && (c = !0, e.flags &= -129), g = (e.flags & 32) !== 0, e.flags &= -33, t === null) {
          if (St) {
            if (c ? vn(e) : yn(), (t = Ot) ? (t = ch(
              t,
              Ae
            ), t !== null && (e.memoizedState = {
              dehydrated: t,
              treeContext: Sn !== null ? { id: Xe, overflow: Ze } : null,
              retryLane: 536870912,
              hydrationErrors: null
            }, a = Hu(t), a.return = e, e.child = a, ae = e, Ot = null)) : t = null, t === null) throw ht(e);
            return yo(t) ? e.lanes = 32 : e.lanes = 536870912, null;
          }
          var M = r.children;
          return r = r.fallback, c ? (yn(), c = e.mode, M = Fl(
            { mode: "hidden", children: M },
            c
          ), r = Fn(
            r,
            c,
            a,
            null
          ), M.return = e, r.return = e, M.sibling = r, e.child = M, r = e.child, r.memoizedState = Bi(a), r.childLanes = Hi(
            t,
            g,
            a
          ), e.memoizedState = Bo, Fa(null, r)) : (vn(e), Ui(e, M));
        }
        var Y = t.memoizedState;
        if (Y !== null && (M = Y.dehydrated, M !== null)) {
          if (u)
            e.flags & 256 ? (vn(e), e.flags &= -257, e = qi(
              t,
              e,
              a
            )) : e.memoizedState !== null ? (yn(), e.child = t.child, e.flags |= 128, e = null) : (yn(), M = r.fallback, c = e.mode, r = Fl(
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
            ), r = e.child, r.memoizedState = Bi(a), r.childLanes = Hi(
              t,
              g,
              a
            ), e.memoizedState = Bo, e = Fa(null, r));
          else if (vn(e), yo(M))
            g = Fp(M).digest, r = Error(s(419)), r.stack = "", r.digest = g, Qa({ value: r, source: null, stack: null }), e = qi(
              t,
              e,
              a
            );
          else if (Qt || ma(
            t,
            e,
            a,
            !1
          ), g = (a & t.childLanes) !== 0, Qt || g) {
            if (g = At, g !== null && (r = S(
              g,
              a
            ), r !== 0 && r !== Y.retryLane))
              throw Y.retryLane = r, Xn(t, r), pe(g, t, r), Do;
            vo(M) || nr(), e = qi(
              t,
              e,
              a
            );
          } else
            vo(M) ? (e.flags |= 192, e.child = t.child, e = null) : (t = Y.treeContext, ue && (Ot = lh(
              M
            ), ae = e, St = !0, zn = null, Ae = !1, t !== null && ot(e, t)), e = Ui(
              e,
              r.children
            ), e.flags |= 4096);
          return e;
        }
        return c ? (yn(), M = r.fallback, c = e.mode, Y = t.child, u = Y.sibling, r = nn(Y, {
          mode: "hidden",
          children: r.children
        }), r.subtreeFlags = Y.subtreeFlags & 65011712, u !== null ? M = nn(
          u,
          M
        ) : (M = Fn(
          M,
          c,
          a,
          null
        ), M.flags |= 2), M.return = e, r.return = e, r.sibling = M, e.child = r, Fa(null, r), r = e.child, M = t.child.memoizedState, M === null ? M = Bi(a) : (c = M.cachePool, c !== null ? (Y = an ? Rt._currentValue : Rt._currentValue2, c = c.parent !== Y ? { parent: Y, pool: Y } : c) : c = Us(), M = {
          baseLanes: M.baseLanes | a,
          cachePool: c
        }), r.memoizedState = M, r.childLanes = Hi(
          t,
          g,
          a
        ), e.memoizedState = Bo, Fa(t.child, r)) : (vn(e), a = t.child, t = a.sibling, a = nn(a, {
          mode: "visible",
          children: r.children
        }), a.return = e, a.sibling = null, t !== null && (g = e.deletions, g === null ? (e.deletions = [t], e.flags |= 16) : g.push(t)), e.child = a, e.memoizedState = null, a);
      }
      function Ui(t, e) {
        return e = Fl(
          { mode: "visible", children: e },
          t.mode
        ), e.return = t, t.child = e;
      }
      function Fl(t, e) {
        return t = o(22, t, null, e), t.lanes = 0, t;
      }
      function qi(t, e, a) {
        return aa(e, t.child, null, a), t = Ui(
          e,
          e.pendingProps.children
        ), t.flags |= 2, e.memoizedState = null, t;
      }
      function Kc(t, e, a) {
        t.lanes |= e;
        var r = t.alternate;
        r !== null && (r.lanes |= e), ii(t.return, e, a);
      }
      function Yi(t, e, a, r, c, u) {
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
        var g = Yt.current, M = (g & 2) !== 0;
        if (M ? (g = g & 1 | 2, e.flags |= 128) : g &= 1, k(Yt, g), ee(t, e, r, a), r = St ? ol : 0, !M && t !== null && (t.flags & 128) !== 0)
          t: for (t = e.child; t !== null; ) {
            if (t.tag === 13)
              t.memoizedState !== null && Kc(t, a, e);
            else if (t.tag === 19)
              Kc(t, a, e);
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
            a = c, a === null ? (c = e.child, e.child = null) : (c = a.sibling, a.sibling = null), Yi(
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
            Yi(
              e,
              !0,
              a,
              null,
              u,
              r
            );
            break;
          case "together":
            Yi(
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
      function Pe(t, e, a) {
        if (t !== null && (e.dependencies = t.dependencies), Cn |= e.lanes, (a & e.childLanes) === 0)
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
          for (t = e.child, a = nn(t, t.pendingProps), e.child = a, a.return = e; t.sibling !== null; )
            t = t.sibling, a = a.sibling = nn(t, t.pendingProps), a.return = e;
          a.sibling = null;
        }
        return e.child;
      }
      function Gi(t, e) {
        return (t.lanes & e) !== 0 ? !0 : (t = t.dependencies, !!(t !== null && Ml(t)));
      }
      function Qm(t, e, a) {
        switch (e.tag) {
          case 3:
            st(
              e,
              e.stateNode.containerInfo
            ), hn(e, Rt, t.memoizedState.cache), Be();
            break;
          case 27:
          case 5:
            Et(e);
            break;
          case 4:
            st(
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
              return e.flags |= 128, bi(e), null;
            break;
          case 13:
            var r = e.memoizedState;
            if (r !== null)
              return r.dehydrated !== null ? (vn(e), e.flags |= 128, null) : (a & e.child.childLanes) !== 0 ? Vc(
                t,
                e,
                a
              ) : (vn(e), t = Pe(
                t,
                e,
                a
              ), t !== null ? t.sibling : null);
            vn(e);
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
                return Xc(
                  t,
                  e,
                  a
                );
              e.flags |= 128;
            }
            if (c = e.memoizedState, c !== null && (c.rendering = null, c.tail = null, c.lastEffect = null), k(Yt, Yt.current), r) break;
            return null;
          case 22:
            return e.lanes = 0, Uc(
              t,
              e,
              a,
              e.pendingProps
            );
          case 24:
            hn(e, Rt, t.memoizedState.cache);
        }
        return Pe(t, e, a);
      }
      function Zc(t, e, a) {
        if (t !== null)
          if (t.memoizedProps !== e.pendingProps)
            Qt = !0;
          else {
            if (!Gi(t, a) && (e.flags & 128) === 0)
              return Qt = !1, Qm(
                t,
                e,
                a
              );
            Qt = (t.flags & 131072) !== 0;
          }
        else
          Qt = !1, St && (e.flags & 1048576) !== 0 && C(e, ol, e.index);
        switch (e.lanes = 0, e.tag) {
          case 16:
            t: {
              var r = e.pendingProps;
              if (t = Kn(e.elementType), e.type = t, typeof t == "function")
                lo(t) ? (r = Zn(t, r), e.tag = 1, e = Qc(
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
                    e.tag = 11, e = Dc(
                      null,
                      e,
                      t,
                      r,
                      a
                    );
                    break t;
                  } else if (c === po) {
                    e.tag = 14, e = Bc(
                      null,
                      e,
                      t,
                      r,
                      a
                    );
                    break t;
                  }
                }
                throw e = _(t) || t, Error(s(306, e, ""));
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
            return r = e.type, c = Zn(
              r,
              e.pendingProps
            ), Qc(
              t,
              e,
              r,
              c,
              a
            );
          case 3:
            t: {
              if (st(
                e,
                e.stateNode.containerInfo
              ), t === null) throw Error(s(387));
              var u = e.pendingProps;
              c = e.memoizedState, r = c.element, mi(t, e), Za(e, u, null, a);
              var g = e.memoizedState;
              if (u = g.cache, hn(e, Rt, u), u !== c.cache && oi(
                e,
                [Rt],
                a,
                !0
              ), Xa(), u = g.element, ue && c.isDehydrated)
                if (c = {
                  element: u,
                  isDehydrated: !1,
                  cache: g.cache
                }, e.updateQueue.baseState = c, e.memoizedState = c, e.flags & 256) {
                  e = Lc(
                    t,
                    e,
                    u,
                    a
                  );
                  break t;
                } else if (u !== r) {
                  r = G(
                    Error(s(424)),
                    e
                  ), Qa(r), e = Lc(
                    t,
                    e,
                    u,
                    a
                  );
                  break t;
                } else
                  for (ue && (Ot = nh(
                    e.stateNode.containerInfo
                  ), ae = e, St = !0, zn = null, Ae = !0), a = xd(
                    e,
                    null,
                    u,
                    a
                  ), e.child = a; a; )
                    a.flags = a.flags & -3 | 4096, a = a.sibling;
              else {
                if (Be(), u === r) {
                  e = Pe(
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
            if (Ye)
              return Wl(t, e), t === null ? (a = id(
                e.type,
                null,
                e.pendingProps,
                null
              )) ? e.memoizedState = a : St || (e.stateNode = Ch(
                e.type,
                e.pendingProps,
                En.current,
                e
              )) : e.memoizedState = id(
                e.type,
                t.memoizedProps,
                e.pendingProps,
                t.memoizedState
              ), null;
          case 27:
            if (Kt)
              return Et(e), t === null && Kt && St && (r = e.stateNode = fd(
                e.type,
                e.pendingProps,
                En.current,
                ne.current,
                !1
              ), ae = e, Ae = !0, Ot = rh(
                e.type,
                r,
                Ot
              )), ee(
                t,
                e,
                e.pendingProps.children,
                a
              ), Wl(t, e), t === null && (e.flags |= 4194304), e.child;
          case 5:
            return t === null && St && (zh(
              e.type,
              e.pendingProps,
              ne.current
            ), (c = r = Ot) && (r = ih(
              r,
              e.type,
              e.pendingProps,
              Ae
            ), r !== null ? (e.stateNode = r, ae = e, Ot = eh(r), Ae = !1, c = !0) : c = !1), c || ht(e)), Et(e), c = e.type, u = e.pendingProps, g = t !== null ? t.memoizedProps : null, r = u.children, or(c, u) ? r = null : g !== null && or(c, g) && (e.flags |= 32), e.memoizedState !== null && (c = yi(
              t,
              e,
              Rm,
              null,
              null,
              a
            ), an ? $n._currentValue = c : $n._currentValue2 = c), Wl(t, e), ee(t, e, r, a), e.child;
          case 6:
            return t === null && St && (Nh(
              e.pendingProps,
              ne.current
            ), (t = a = Ot) && (a = oh(
              a,
              e.pendingProps,
              Ae
            ), a !== null ? (e.stateNode = a, ae = e, Ot = null, t = !0) : t = !1), t || ht(e)), null;
          case 13:
            return Vc(t, e, a);
          case 4:
            return st(
              e,
              e.stateNode.containerInfo
            ), r = e.pendingProps, t === null ? e.child = aa(
              e,
              null,
              r,
              a
            ) : ee(t, e, r, a), e.child;
          case 11:
            return Dc(
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
            return r = e.pendingProps, hn(e, e.type, r.value), ee(
              t,
              e,
              r.children,
              a
            ), e.child;
          case 9:
            return c = e.type._context, r = e.pendingProps.children, Vn(e), c = te(c), r = r(c), e.flags |= 1, ee(t, e, r, a), e.child;
          case 14:
            return Bc(
              t,
              e,
              e.type,
              e.pendingProps,
              a
            );
          case 15:
            return Hc(
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
            return Gm(t, e, a);
          case 22:
            return Uc(
              t,
              e,
              a,
              e.pendingProps
            );
          case 24:
            return Vn(e), r = te(Rt), t === null ? (c = ui(), c === null && (c = At, u = si(), c.pooledCache = u, u.refCount++, u !== null && (c.pooledCacheLanes |= a), c = u), e.memoizedState = {
              parent: r,
              cache: c
            }, fi(e), hn(e, Rt, c)) : ((t.lanes & a) !== 0 && (mi(t, e), Za(e, null, null, a), Xa()), c = t.memoizedState, u = e.memoizedState, c.parent !== r ? (c = { parent: r, cache: r }, e.memoizedState = c, e.lanes === 0 && (e.memoizedState = e.updateQueue.baseState = c), hn(e, Rt, r)) : (r = u.cache, hn(e, Rt, r), r !== c.cache && oi(
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
      function He(t) {
        t.flags |= 4;
      }
      function Il(t) {
        Ke && (t.flags |= 8);
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
      function Qi(t, e, a, r) {
        if (ce)
          for (a = e.child; a !== null; ) {
            if (a.tag === 5 || a.tag === 6)
              go(t, a.stateNode);
            else if (!(a.tag === 4 || Kt && a.tag === 27) && a.child !== null) {
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
              a && r && (u = ed(
                u,
                c.type,
                c.memoizedProps
              )), go(t, u);
            } else if (c.tag === 6)
              u = c.stateNode, a && r && (u = nd(
                u,
                c.memoizedProps
              )), go(t, u);
            else if (c.tag !== 4) {
              if (c.tag === 22 && c.memoizedState !== null)
                u = c.child, u !== null && (u.return = c), Qi(t, c, !0, !0);
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
        if (Ke)
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
        if (Ke && Jc(t, e)) {
          t = e.stateNode;
          var a = t.containerInfo, r = $u();
          Wc(r, e, !1, !1), t.pendingChildren = r, He(e), Wp(a, r);
        }
      }
      function Li(t, e, a, r) {
        if (ce)
          t.memoizedProps !== r && He(e);
        else if (Ke) {
          var c = t.stateNode, u = t.memoizedProps;
          if ((t = Jc(t, e)) || u !== r) {
            var g = ne.current;
            u = Jp(
              c,
              a,
              u,
              r,
              !t,
              null
            ), u === c ? e.stateNode = c : (Il(e), Zu(
              u,
              a,
              r,
              g
            ) && He(e), e.stateNode = u, t && Qi(u, e, !1, !1));
          } else e.stateNode = c;
        }
      }
      function Vi(t, e, a, r, c) {
        if ((t.mode & 32) !== 0 && (a === null ? wp(e, r) : _p(e, a, r))) {
          if (t.flags |= 16777216, (c & 335544128) === c || bo(e, r))
            if (Wu(t.stateNode, e, r))
              t.flags |= 8192;
            else if (_u()) t.flags |= 8192;
            else
              throw na = vr, Mo;
        } else t.flags &= -16777217;
      }
      function Ic(t, e) {
        if (Ah(e)) {
          if (t.flags |= 16777216, !dd(e))
            if (_u()) t.flags |= 8192;
            else
              throw na = vr, Mo;
        } else t.flags &= -16777217;
      }
      function $l(t, e) {
        e !== null && (t.flags |= 4), t.flags & 16384 && (e = t.tag !== 22 ? K() : 536870912, t.lanes |= e, Ua |= e);
      }
      function Ia(t, e) {
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
      function Lm(t, e, a) {
        var r = e.pendingProps;
        switch (nt(e), e.tag) {
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
            return a = e.stateNode, r = null, t !== null && (r = t.memoizedState.cache), e.memoizedState.cache !== r && (e.flags |= 2048), Ie(Rt), ut(), a.pendingContext && (a.context = a.pendingContext, a.pendingContext = null), (t === null || t.child === null) && (De(e) ? He(e) : t === null || t.memoizedState.isDehydrated && (e.flags & 256) === 0 || (e.flags |= 1024, pn())), Fc(t, e), jt(e), null;
          case 26:
            if (Ye) {
              var c = e.type, u = e.memoizedState;
              return t === null ? (He(e), u !== null ? (jt(e), Ic(
                e,
                u
              )) : (jt(e), Vi(
                e,
                c,
                null,
                r,
                a
              ))) : u ? u !== t.memoizedState ? (He(e), jt(e), Ic(
                e,
                u
              )) : (jt(e), e.flags &= -16777217) : (u = t.memoizedProps, ce ? u !== r && He(e) : Li(
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
            if (Kt) {
              if (Jt(e), a = En.current, c = e.type, t !== null && e.stateNode != null)
                ce ? t.memoizedProps !== r && He(e) : Li(t, e, c, r);
              else {
                if (!r) {
                  if (e.stateNode === null)
                    throw Error(s(166));
                  return jt(e), null;
                }
                t = ne.current, De(e) ? Qn(e, t) : (t = fd(
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
              Li(t, e, c, r);
            else {
              if (!r) {
                if (e.stateNode === null)
                  throw Error(s(166));
                return jt(e), null;
              }
              if (u = ne.current, De(e))
                Qn(e, u), xh(
                  e.stateNode,
                  c,
                  r,
                  u
                ) && (e.flags |= 64);
              else {
                var g = mp(
                  c,
                  r,
                  En.current,
                  u,
                  e
                );
                Il(e), Qi(g, e, !1, !1), e.stateNode = g, Zu(
                  g,
                  c,
                  r,
                  u
                ) && He(e);
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
              a = t.memoizedProps, ce ? a !== r && He(e) : Ke && (a !== r ? (t = En.current, a = ne.current, Il(e), e.stateNode = Ju(
                r,
                t,
                a,
                e
              )) : e.stateNode = t.stateNode);
            else {
              if (typeof r != "string" && e.stateNode === null)
                throw Error(s(166));
              if (t = En.current, a = ne.current, De(e)) {
                if (!ue) throw Error(s(176));
                if (t = e.stateNode, a = e.memoizedProps, r = null, c = ae, c !== null)
                  switch (c.tag) {
                    case 27:
                    case 5:
                      r = c.memoizedProps;
                  }
                dh(
                  t,
                  a,
                  e,
                  r
                ) || ht(e, !0);
              } else
                Il(e), e.stateNode = Ju(
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
                  fh(t, e);
                } else
                  Be(), (e.flags & 128) === 0 && (e.memoizedState = null), e.flags |= 4;
                jt(e), t = !1;
              } else
                a = pn(), t !== null && t.memoizedState !== null && (t.memoizedState.hydrationErrors = a), t = !0;
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
                  mh(c, e);
                } else
                  Be(), (e.flags & 128) === 0 && (e.memoizedState = null), e.flags |= 4;
                jt(e), c = !1;
              } else
                c = pn(), t !== null && t.memoizedState !== null && (t.memoizedState.hydrationErrors = c), c = !0;
              if (!c)
                return e.flags & 256 ? (ve(e), e) : (ve(e), null);
            }
            return ve(e), (e.flags & 128) !== 0 ? (e.lanes = a, e) : (a = r !== null, t = t !== null && t.memoizedState !== null, a && (r = e.child, c = null, r.alternate !== null && r.alternate.memoizedState !== null && r.alternate.memoizedState.cachePool !== null && (c = r.alternate.memoizedState.cachePool.pool), u = null, r.memoizedState !== null && r.memoizedState.cachePool !== null && (u = r.memoizedState.cachePool.pool), u !== c && (r.flags |= 2048)), a !== t && a && (e.child.flags |= 8192), $l(e, e.updateQueue), jt(e), null);
          case 4:
            return ut(), Fc(t, e), t === null && bp(e.stateNode.containerInfo), jt(e), null;
          case 10:
            return Ie(e.type), jt(e), null;
          case 19:
            if (z(Yt), r = e.memoizedState, r === null) return jt(e), null;
            if (c = (e.flags & 128) !== 0, u = r.rendering, u === null)
              if (c) Ia(r, !1);
              else {
                if (Ut !== 0 || t !== null && (t.flags & 128) !== 0)
                  for (t = e.child; t !== null; ) {
                    if (u = Yl(t), u !== null) {
                      for (e.flags |= 128, Ia(r, !1), t = u.updateQueue, e.updateQueue = t, $l(e, t), e.subtreeFlags = 0, t = a, a = e.child; a !== null; )
                        Bu(a, t), a = a.sibling;
                      return k(
                        Yt,
                        Yt.current & 1 | 2
                      ), St && V(e, r.treeForkCount), e.child;
                    }
                    t = t.sibling;
                  }
                r.tail !== null && he() > hl && (e.flags |= 128, c = !0, Ia(r, !1), e.lanes = 4194304);
              }
            else {
              if (!c)
                if (t = Yl(u), t !== null) {
                  if (e.flags |= 128, c = !0, t = t.updateQueue, e.updateQueue = t, $l(e, t), Ia(r, !0), r.tail === null && r.tailMode === "hidden" && !u.alternate && !St)
                    return jt(e), null;
                } else
                  2 * he() - r.renderingStartTime > hl && a !== 536870912 && (e.flags |= 128, c = !0, Ia(r, !1), e.lanes = 4194304);
              r.isBackwards ? (u.sibling = e.child, e.child = u) : (t = r.last, t !== null ? t.sibling = u : e.child = u, r.last = u);
            }
            return r.tail !== null ? (t = r.tail, r.rendering = t, r.tail = t.sibling, r.renderingStartTime = he(), t.sibling = null, a = Yt.current, k(
              Yt,
              c ? a & 1 | 2 : a & 1
            ), St && V(e, r.treeForkCount), t) : (jt(e), null);
          case 22:
          case 23:
            return ve(e), gi(), r = e.memoizedState !== null, t !== null ? t.memoizedState !== null !== r && (e.flags |= 8192) : r && (e.flags |= 8192), r ? (a & 536870912) !== 0 && (e.flags & 128) === 0 && (jt(e), e.subtreeFlags & 6 && (e.flags |= 8192)) : jt(e), a = e.updateQueue, a !== null && $l(e, a.retryQueue), a = null, t !== null && t.memoizedState !== null && t.memoizedState.cachePool !== null && (a = t.memoizedState.cachePool.pool), r = null, e.memoizedState !== null && e.memoizedState.cachePool !== null && (r = e.memoizedState.cachePool.pool), r !== a && (e.flags |= 2048), t !== null && z(ea), null;
          case 24:
            return a = null, t !== null && (a = t.memoizedState.cache), e.memoizedState.cache !== a && (e.flags |= 2048), Ie(Rt), jt(e), null;
          case 25:
            return null;
          case 30:
            return null;
        }
        throw Error(s(156, e.tag));
      }
      function Vm(t, e) {
        switch (nt(e), e.tag) {
          case 1:
            return t = e.flags, t & 65536 ? (e.flags = t & -65537 | 128, e) : null;
          case 3:
            return Ie(Rt), ut(), t = e.flags, (t & 65536) !== 0 && (t & 128) === 0 ? (e.flags = t & -65537 | 128, e) : null;
          case 26:
          case 27:
          case 5:
            return Jt(e), null;
          case 31:
            if (e.memoizedState !== null) {
              if (ve(e), e.alternate === null)
                throw Error(s(340));
              Be();
            }
            return t = e.flags, t & 65536 ? (e.flags = t & -65537 | 128, e) : null;
          case 13:
            if (ve(e), t = e.memoizedState, t !== null && t.dehydrated !== null) {
              if (e.alternate === null)
                throw Error(s(340));
              Be();
            }
            return t = e.flags, t & 65536 ? (e.flags = t & -65537 | 128, e) : null;
          case 19:
            return z(Yt), null;
          case 4:
            return ut(), null;
          case 10:
            return Ie(e.type), null;
          case 22:
          case 23:
            return ve(e), gi(), t !== null && z(ea), t = e.flags, t & 65536 ? (e.flags = t & -65537 | 128, e) : null;
          case 24:
            return Ie(Rt), null;
          case 25:
            return null;
          default:
            return null;
        }
      }
      function $c(t, e) {
        switch (nt(e), e.tag) {
          case 3:
            Ie(Rt), ut();
            break;
          case 26:
          case 27:
          case 5:
            Jt(e);
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
            z(Yt);
            break;
          case 10:
            Ie(e.type);
            break;
          case 22:
          case 23:
            ve(e), gi(), t !== null && z(ea);
            break;
          case 24:
            Ie(Rt);
        }
      }
      function $a(t, e) {
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
      function xn(t, e, a) {
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
                  } catch (tt) {
                    zt(
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
          zt(e, e.return, tt);
        }
      }
      function Pc(t) {
        var e = t.updateQueue;
        if (e !== null) {
          var a = t.stateNode;
          try {
            Xs(e, a);
          } catch (r) {
            zt(t, t.return, r);
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
          zt(t, e, r);
        }
      }
      function Pa(t, e) {
        try {
          var a = t.ref;
          if (a !== null) {
            switch (t.tag) {
              case 26:
              case 27:
              case 5:
                var r = al(t.stateNode);
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
      function eu(t) {
        var e = t.type, a = t.memoizedProps, r = t.stateNode;
        try {
          Hp(r, e, a, t);
        } catch (c) {
          zt(t, t.return, c);
        }
      }
      function Ki(t, e, a) {
        try {
          Up(
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
      function nu(t) {
        return t.tag === 5 || t.tag === 3 || (Ye ? t.tag === 26 : !1) || (Kt ? t.tag === 27 && _a(t.type) : !1) || t.tag === 4;
      }
      function Xi(t) {
        t: for (; ; ) {
          for (; t.sibling === null; ) {
            if (t.return === null || nu(t.return)) return null;
            t = t.return;
          }
          for (t.sibling.return = t.return, t = t.sibling; t.tag !== 5 && t.tag !== 6 && t.tag !== 18; ) {
            if (Kt && t.tag === 27 && _a(t.type) || t.flags & 2 || t.child === null || t.tag === 4) continue t;
            t.child.return = t, t = t.child;
          }
          if (!(t.flags & 2)) return t.stateNode;
        }
      }
      function Zi(t, e, a) {
        var r = t.tag;
        if (r === 5 || r === 6)
          t = t.stateNode, e ? Yp(a, t, e) : Dp(a, t);
        else if (r !== 4 && (Kt && r === 27 && _a(t.type) && (a = t.stateNode, e = null), t = t.child, t !== null))
          for (Zi(t, e, a), t = t.sibling; t !== null; )
            Zi(t, e, a), t = t.sibling;
      }
      function Pl(t, e, a) {
        var r = t.tag;
        if (r === 5 || r === 6)
          t = t.stateNode, e ? qp(a, t, e) : Rp(a, t);
        else if (r !== 4 && (Kt && r === 27 && _a(t.type) && (a = t.stateNode), t = t.child, t !== null))
          for (Pl(t, e, a), t = t.sibling; t !== null; )
            Pl(t, e, a), t = t.sibling;
      }
      function au(t, e, a) {
        t = t.containerInfo;
        try {
          td(t, a);
        } catch (r) {
          zt(e, e.return, r);
        }
      }
      function lu(t) {
        var e = t.stateNode, a = t.memoizedProps;
        try {
          Oh(
            t.type,
            a,
            e,
            t
          );
        } catch (r) {
          zt(t, t.return, r);
        }
      }
      function Km(t, e) {
        for (dp(t.containerInfo), Ft = e; Ft !== null; )
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
                      zt(r, r.return, M);
                    }
                  }
                  break;
                case 3:
                  (e & 1024) !== 0 && ce && Zp(t.stateNode.containerInfo);
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
            tn(t, a), r & 4 && $a(5, a);
            break;
          case 1:
            if (tn(t, a), r & 4)
              if (t = a.stateNode, e === null)
                try {
                  t.componentDidMount();
                } catch (g) {
                  zt(a, a.return, g);
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
                  zt(
                    a,
                    a.return,
                    g
                  );
                }
              }
            r & 64 && Pc(a), r & 512 && Pa(a, a.return);
            break;
          case 3:
            if (tn(t, a), r & 64 && (r = a.updateQueue, r !== null)) {
              if (t = null, a.child !== null)
                switch (a.child.tag) {
                  case 27:
                  case 5:
                    t = al(a.child.stateNode);
                    break;
                  case 1:
                    t = a.child.stateNode;
                }
              try {
                Xs(r, t);
              } catch (g) {
                zt(a, a.return, g);
              }
            }
            break;
          case 27:
            Kt && e === null && r & 4 && lu(a);
          case 26:
          case 5:
            if (tn(t, a), e === null) {
              if (r & 4) eu(a);
              else if (r & 64) {
                t = a.type, e = a.memoizedProps, c = a.stateNode;
                try {
                  gh(
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
            r & 512 && Pa(a, a.return);
            break;
          case 12:
            tn(t, a);
            break;
          case 31:
            tn(t, a), r & 4 && ou(t, a);
            break;
          case 13:
            tn(t, a), r & 4 && su(t, a), r & 64 && (r = a.memoizedState, r !== null && (r = r.dehydrated, r !== null && (a = $m.bind(
              null,
              a
            ), Ip(r, a))));
            break;
          case 22:
            if (r = a.memoizedState !== null || sn, !r) {
              e = e !== null && e.memoizedState !== null || Lt, c = sn;
              var u = Lt;
              sn = r, (Lt = e) && !u ? en(
                t,
                a,
                (a.subtreeFlags & 8772) !== 0
              ) : tn(t, a), sn = c, Lt = u;
            }
            break;
          case 30:
            break;
          default:
            tn(t, a);
        }
      }
      function iu(t) {
        var e = t.alternate;
        e !== null && (t.alternate = null, iu(e)), t.child = null, t.deletions = null, t.sibling = null, t.tag === 5 && (e = t.stateNode, e !== null && xp(e)), t.stateNode = null, t.return = null, t.dependencies = null, t.memoizedProps = null, t.memoizedState = null, t.pendingProps = null, t.stateNode = null, t.updateQueue = null;
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
            _e.onCommitFiberUnmount(il, a);
          } catch {
          }
        switch (a.tag) {
          case 26:
            if (Ye) {
              Lt || Ve(a, e), Ue(
                t,
                e,
                a
              ), a.memoizedState ? sd(a.memoizedState) : a.stateNode && ud(a.stateNode);
              break;
            }
          case 27:
            if (Kt) {
              Lt || Ve(a, e);
              var r = Vt, c = ge;
              _a(a.type) && (Vt = a.stateNode, ge = !1), Ue(
                t,
                e,
                a
              ), md(a.stateNode), Vt = r, ge = c;
              break;
            }
          case 5:
            Lt || Ve(a, e);
          case 6:
            if (ce) {
              if (r = Vt, c = ge, Vt = null, Ue(
                t,
                e,
                a
              ), Vt = r, ge = c, Vt !== null)
                if (ge)
                  try {
                    Qp(Vt, a.stateNode);
                  } catch (u) {
                    zt(
                      a,
                      e,
                      u
                    );
                  }
                else
                  try {
                    Gp(Vt, a.stateNode);
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
            ce && Vt !== null && (ge ? kh(
              Vt,
              a.stateNode
            ) : _h(Vt, a.stateNode));
            break;
          case 4:
            ce ? (r = Vt, c = ge, Vt = a.stateNode.containerInfo, ge = !0, Ue(
              t,
              e,
              a
            ), Vt = r, ge = c) : (Ke && au(
              a.stateNode,
              a,
              $u()
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
            xn(2, a, e), Lt || xn(4, a, e), Ue(
              t,
              e,
              a
            );
            break;
          case 1:
            Lt || (Ve(a, e), r = a.stateNode, typeof r.componentWillUnmount == "function" && tu(
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
            Lt = (r = Lt) || a.memoizedState !== null, Ue(
              t,
              e,
              a
            ), Lt = r;
            break;
          default:
            Ue(
              t,
              e,
              a
            );
        }
      }
      function ou(t, e) {
        if (ue && e.memoizedState === null && (t = e.alternate, t !== null && (t = t.memoizedState, t !== null))) {
          t = t.dehydrated;
          try {
            vh(t);
          } catch (a) {
            zt(e, e.return, a);
          }
        }
      }
      function su(t, e) {
        if (ue && e.memoizedState === null && (t = e.alternate, t !== null && (t = t.memoizedState, t !== null && (t = t.dehydrated, t !== null))))
          try {
            yh(t);
          } catch (a) {
            zt(e, e.return, a);
          }
      }
      function Xm(t) {
        switch (t.tag) {
          case 31:
          case 13:
          case 19:
            var e = t.stateNode;
            return e === null && (e = t.stateNode = new kd()), e;
          case 22:
            return t = t.stateNode, e = t._retryCache, e === null && (e = t._retryCache = new kd()), e;
          default:
            throw Error(s(435, t.tag));
        }
      }
      function tr(t, e) {
        var a = Xm(t);
        e.forEach(function(r) {
          if (!a.has(r)) {
            a.add(r);
            var c = Pm.bind(null, t, r);
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
                    if (Kt) {
                      if (_a(M.type)) {
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
              Ji(u, g, c), Vt = null, ge = !1;
            } else Ji(u, g, c);
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
            se(e, t), me(t), r & 4 && (xn(3, t, t.return), $a(3, t), xn(5, t, t.return));
            break;
          case 1:
            se(e, t), me(t), r & 512 && (Lt || a === null || Ve(a, a.return)), r & 64 && sn && (t = t.updateQueue, t !== null && (r = t.callbacks, r !== null && (a = t.shared.hiddenCallbacks, t.shared.hiddenCallbacks = a === null ? r : a.concat(r))));
            break;
          case 26:
            if (Ye) {
              var c = Ge;
              if (se(e, t), me(t), r & 512 && (Lt || a === null || Ve(a, a.return)), r & 4) {
                r = a !== null ? a.memoizedState : null;
                var u = t.memoizedState;
                a === null ? u === null ? t.stateNode === null ? t.stateNode = Th(
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
            if (Kt) {
              se(e, t), me(t), r & 512 && (Lt || a === null || Ve(a, a.return)), a !== null && r & 4 && Ki(
                t,
                t.memoizedProps,
                a.memoizedProps
              );
              break;
            }
          case 5:
            if (se(e, t), me(t), r & 512 && (Lt || a === null || Ve(a, a.return)), ce) {
              if (t.flags & 32) {
                c = t.stateNode;
                try {
                  Iu(c);
                } catch (F) {
                  zt(t, t.return, F);
                }
              }
              r & 4 && t.stateNode != null && (c = t.memoizedProps, Ki(
                t,
                c,
                a !== null ? a.memoizedProps : c
              )), r & 1024 && (Ho = !0);
            } else
              Ke && t.alternate !== null && (t.alternate.stateNode = t.stateNode);
            break;
          case 6:
            if (se(e, t), me(t), r & 4 && ce) {
              if (t.stateNode === null)
                throw Error(s(162));
              r = t.memoizedProps, a = a !== null ? a.memoizedProps : r, c = t.stateNode;
              try {
                Bp(c, a, r);
              } catch (F) {
                zt(t, t.return, F);
              }
            }
            break;
          case 3:
            if (Ye ? (Mh(), c = Ge, Ge = xo(e.containerInfo), se(e, t), Ge = c) : se(e, t), me(t), r & 4) {
              if (ce && ue && a !== null && a.memoizedState.isDehydrated)
                try {
                  bh(e.containerInfo);
                } catch (F) {
                  zt(t, t.return, F);
                }
              if (Ke) {
                r = e.containerInfo, a = e.pendingChildren;
                try {
                  td(r, a);
                } catch (F) {
                  zt(t, t.return, F);
                }
              }
            }
            Ho && (Ho = !1, uu(t));
            break;
          case 4:
            Ye ? (a = Ge, Ge = xo(
              t.stateNode.containerInfo
            ), se(e, t), me(t), Ge = a) : (se(e, t), me(t)), r & 4 && Ke && au(
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
            var g = a !== null && a.memoizedState !== null, M = sn, Y = Lt;
            if (sn = M || c, Lt = Y || g, se(e, t), Lt = Y, sn = M, me(t), r & 8192 && (e = t.stateNode, e._visibility = c ? e._visibility & -2 : e._visibility | 1, c && (a === null || g || sn || Lt || Jn(t)), ce)) {
              t: if (a = null, ce)
                for (e = t; ; ) {
                  if (e.tag === 5 || Ye && e.tag === 26) {
                    if (a === null) {
                      g = a = e;
                      try {
                        u = g.stateNode, c ? Lp(u) : Kp(
                          g.stateNode,
                          g.memoizedProps
                        );
                      } catch (F) {
                        zt(g, g.return, F);
                      }
                    }
                  } else if (e.tag === 6) {
                    if (a === null) {
                      g = e;
                      try {
                        var J = g.stateNode;
                        c ? Vp(J) : Xp(J, g.memoizedProps);
                      } catch (F) {
                        zt(g, g.return, F);
                      }
                    }
                  } else if (e.tag === 18) {
                    if (a === null) {
                      g = e;
                      try {
                        var tt = g.stateNode;
                        c ? Sh(tt) : Eh(g.stateNode);
                      } catch (F) {
                        zt(g, g.return, F);
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
              if (nu(r)) {
                a = r;
                break;
              }
              r = r.return;
            }
            if (ce) {
              if (a == null) throw Error(s(160));
              switch (a.tag) {
                case 27:
                  if (Kt) {
                    var c = a.stateNode, u = Xi(t);
                    Pl(t, u, c);
                    break;
                  }
                case 5:
                  var g = a.stateNode;
                  a.flags & 32 && (Iu(g), a.flags &= -33);
                  var M = Xi(t);
                  Pl(t, M, g);
                  break;
                case 3:
                case 4:
                  var Y = a.stateNode.containerInfo, J = Xi(t);
                  Zi(
                    t,
                    J,
                    Y
                  );
                  break;
                default:
                  throw Error(s(161));
              }
            }
          } catch (tt) {
            zt(t, t.return, tt);
          }
          t.flags &= -3;
        }
        e & 4096 && (t.flags &= -4097);
      }
      function uu(t) {
        if (t.subtreeFlags & 1024)
          for (t = t.child; t !== null; ) {
            var e = t;
            uu(e), e.tag === 5 && e.flags & 1024 && Ep(e.stateNode), t = t.sibling;
          }
      }
      function tn(t, e) {
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
              xn(4, e, e.return), Jn(e);
              break;
            case 1:
              Ve(e, e.return);
              var a = e.stateNode;
              typeof a.componentWillUnmount == "function" && tu(
                e,
                e.return,
                a
              ), Jn(e);
              break;
            case 27:
              Kt && md(e.stateNode);
            case 26:
            case 5:
              Ve(e, e.return), Jn(e);
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
      function en(t, e, a) {
        for (a = a && (e.subtreeFlags & 8772) !== 0, e = e.child; e !== null; ) {
          var r = e.alternate, c = t, u = e, g = u.flags;
          switch (u.tag) {
            case 0:
            case 11:
            case 15:
              en(
                c,
                u,
                a
              ), $a(4, u);
              break;
            case 1:
              if (en(
                c,
                u,
                a
              ), r = u, c = r.stateNode, typeof c.componentDidMount == "function")
                try {
                  c.componentDidMount();
                } catch (J) {
                  zt(r, r.return, J);
                }
              if (r = u, c = r.updateQueue, c !== null) {
                var M = r.stateNode;
                try {
                  var Y = c.shared.hiddenCallbacks;
                  if (Y !== null)
                    for (c.shared.hiddenCallbacks = null, c = 0; c < Y.length; c++)
                      Ks(Y[c], M);
                } catch (J) {
                  zt(r, r.return, J);
                }
              }
              a && g & 64 && Pc(u), Pa(u, u.return);
              break;
            case 27:
              Kt && lu(u);
            case 26:
            case 5:
              en(
                c,
                u,
                a
              ), a && r === null && g & 4 && eu(u), Pa(u, u.return);
              break;
            case 12:
              en(
                c,
                u,
                a
              );
              break;
            case 31:
              en(
                c,
                u,
                a
              ), a && g & 4 && ou(c, u);
              break;
            case 13:
              en(
                c,
                u,
                a
              ), a && g & 4 && su(c, u);
              break;
            case 22:
              u.memoizedState === null && en(
                c,
                u,
                a
              ), Pa(u, u.return);
              break;
            case 30:
              break;
            default:
              en(
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
            qe(
              t,
              e,
              a,
              r
            ), c & 2048 && $a(9, e);
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
            ) : tl(
              t,
              e
            ) : u._visibility & 2 ? qe(
              t,
              e,
              a,
              r
            ) : (u._visibility |= 2, ga(
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
      function ga(t, e, a, r, c) {
        for (c = c && ((e.subtreeFlags & 10256) !== 0 || !1), e = e.child; e !== null; ) {
          var u = t, g = e, M = a, Y = r, J = g.flags;
          switch (g.tag) {
            case 0:
            case 11:
            case 15:
              ga(
                u,
                g,
                M,
                Y,
                c
              ), $a(8, g);
              break;
            case 23:
              break;
            case 22:
              var tt = g.stateNode;
              g.memoizedState !== null ? tt._visibility & 2 ? ga(
                u,
                g,
                M,
                Y,
                c
              ) : tl(
                u,
                g
              ) : (tt._visibility |= 2, ga(
                u,
                g,
                M,
                Y,
                c
              )), c && J & 2048 && Wi(
                g.alternate,
                g
              );
              break;
            case 24:
              ga(
                u,
                g,
                M,
                Y,
                c
              ), c && J & 2048 && Fi(g.alternate, g);
              break;
            default:
              ga(
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
      function tl(t, e) {
        if (e.subtreeFlags & 10256)
          for (e = e.child; e !== null; ) {
            var a = t, r = e, c = r.flags;
            switch (r.tag) {
              case 22:
                tl(a, r), c & 2048 && Wi(
                  r.alternate,
                  r
                );
                break;
              case 24:
                tl(a, r), c & 2048 && Fi(
                  r.alternate,
                  r
                );
                break;
              default:
                tl(a, r);
            }
            e = e.sibling;
          }
      }
      function Wn(t, e, a) {
        if (t.subtreeFlags & Ba)
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
            ), t.flags & Ba)
              if (t.memoizedState !== null)
                jh(
                  a,
                  Ge,
                  t.memoizedState,
                  t.memoizedProps
                );
              else {
                var r = t.stateNode, c = t.type;
                t = t.memoizedProps, ((e & 335544128) === e || bo(c, t)) && Fu(a, r, c, t);
              }
            break;
          case 5:
            Wn(
              t,
              e,
              a
            ), t.flags & Ba && (r = t.stateNode, c = t.type, t = t.memoizedProps, ((e & 335544128) === e || bo(c, t)) && Fu(a, r, c, t));
            break;
          case 3:
          case 4:
            Ye ? (r = Ge, Ge = xo(
              t.stateNode.containerInfo
            ), Wn(
              t,
              e,
              a
            ), Ge = r) : Wn(
              t,
              e,
              a
            );
            break;
          case 22:
            t.memoizedState === null && (r = t.alternate, r !== null && r.memoizedState !== null ? (r = Ba, Ba = 16777216, Wn(
              t,
              e,
              a
            ), Ba = r) : Wn(
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
      function el(t) {
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
            el(t), t.flags & 2048 && xn(9, t, t.return);
            break;
          case 3:
            el(t);
            break;
          case 12:
            el(t);
            break;
          case 22:
            var e = t.stateNode;
            t.memoizedState !== null && e._visibility & 2 && (t.return === null || t.return.tag !== 13) ? (e._visibility &= -3, er(t)) : el(t);
            break;
          default:
            el(t);
        }
      }
      function er(t) {
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
              xn(8, e, e.return), er(e);
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
      function hu(t, e) {
        for (; Ft !== null; ) {
          var a = Ft;
          switch (a.tag) {
            case 0:
            case 11:
            case 15:
              xn(8, a, e);
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
      function Ii(t) {
        var e = gp(t);
        if (e != null) {
          if (typeof e.memoizedProps["data-testname"] != "string")
            throw Error(s(364));
          return e;
        }
        if (t = Tp(t), t === null) throw Error(s(362));
        return t.stateNode.current;
      }
      function $i(t, e) {
        var a = t.tag;
        switch (e.$$typeof) {
          case _r:
            if (t.type === e.value) return !0;
            break;
          case kr:
            t: {
              for (e = e.value, t = [t, 0], a = 0; a < t.length; ) {
                var r = t[a++], c = r.tag, u = t[a++], g = e[u];
                if (c !== 5 && c !== 26 && c !== 27 || !rl(r)) {
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
          case Sr:
            if ((a === 5 || a === 26 || a === 27) && Ap(t.stateNode, e.value))
              return !0;
            break;
          case zr:
            if ((a === 5 || a === 6 || a === 26 || a === 27) && (t = Mp(t), t !== null && 0 <= t.indexOf(e.value)))
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
      function Pi(t) {
        switch (t.$$typeof) {
          case _r:
            return "<" + (_(t.value) || "Unknown") + ">";
          case kr:
            return ":has(" + (Pi(t) || "") + ")";
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
      function gu(t, e) {
        var a = [];
        t = [t, 0];
        for (var r = 0; r < t.length; ) {
          var c = t[r++], u = c.tag, g = t[r++], M = e[g];
          if (u !== 5 && u !== 26 && u !== 27 || !rl(c)) {
            for (; M != null && $i(c, M); )
              g++, M = e[g];
            if (g === e.length) a.push(c);
            else
              for (c = c.child; c !== null; )
                t.push(c, g), c = c.sibling;
          }
        }
        return a;
      }
      function to(t, e) {
        if (!ll) throw Error(s(363));
        t = Ii(t), t = gu(t, e), e = [], t = Array.from(t);
        for (var a = 0; a < t.length; ) {
          var r = t[a++], c = r.tag;
          if (c === 5 || c === 26 || c === 27)
            rl(r) || e.push(r.stateNode);
          else
            for (r = r.child; r !== null; )
              t.push(r), r = r.sibling;
        }
        return e;
      }
      function ye() {
        return (xt & 2) !== 0 && _t !== 0 ? _t & -_t : dt.T !== null ? ci() : vp();
      }
      function bu() {
        if (ze === 0)
          if ((_t & 536870912) === 0 || St) {
            var t = cr;
            cr <<= 1, (cr & 3932160) === 0 && (cr = 262144), ze = t;
          } else ze = 536870912;
        return t = Se.current, t !== null && (t.flags |= 32), ze;
      }
      function pe(t, e, a) {
        (t === At && (Ct === 2 || Ct === 9) || t.cancelPendingCommit !== null) && (ba(t, 0), wn(
          t,
          _t,
          ze,
          !1
        )), D(t, a), ((xt & 2) === 0 || t !== At) && (t === At && ((xt & 2) === 0 && (ra |= a), Ut === 4 && wn(
          t,
          _t,
          ze,
          !1
        )), Le(t));
      }
      function vu(t, e, a) {
        if ((xt & 6) !== 0) throw Error(s(327));
        var r = !a && (e & 127) === 0 && (e & t.expiredLanes) === 0 || R(t, e), c = r ? Wm(t, e) : no(t, e, !0), u = r;
        do {
          if (c === 0) {
            Ha && !r && wn(t, e, 0, !1);
            break;
          } else {
            if (a = t.current.alternate, u && !Zm(a)) {
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
                  var M = t;
                  c = pl;
                  var Y = ue && M.current.memoizedState.isDehydrated;
                  if (Y && (ba(M, g).flags |= 256), g = no(
                    M,
                    g,
                    !1
                  ), g !== 2) {
                    if (Uo && !Y) {
                      M.errorRecoveryDisabledLanes |= u, ra |= u, c = 4;
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
              ba(t, 0), wn(t, e, 0, !0);
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
                  wn(
                    r,
                    e,
                    ze,
                    !Tn
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
                if (wn(
                  r,
                  e,
                  ze,
                  !Tn
                ), j(r, 0, !0) !== 0) break t;
                un = e, r.timeoutHandle = pp(
                  yu.bind(
                    null,
                    r,
                    a,
                    be,
                    Tr,
                    Yo,
                    e,
                    ze,
                    ra,
                    Ua,
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
              yu(
                r,
                a,
                be,
                Tr,
                Yo,
                e,
                ze,
                ra,
                Ua,
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
        Le(t);
      }
      function yu(t, e, a, r, c, u, g, M, Y, J, tt, F, at, gt) {
        if (t.timeoutHandle = In, F = e.subtreeFlags, F & 8192 || (F & 16785408) === 16785408) {
          F = kp(), fu(
            e,
            u,
            F
          );
          var le = (u & 62914560) === u ? Nr - he() : (u & 4194048) === u ? Sd - he() : 0;
          if (le = Sp(
            F,
            le
          ), le !== null) {
            un = u, t.cancelPendingCommit = le(
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
                tt,
                F,
                null,
                at,
                gt
              )
            ), wn(t, u, g, !J);
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
      function Zm(t) {
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
      function wn(t, e, a, r) {
        e &= ~qo, e &= ~ra, t.suspendedLanes |= e, t.pingedLanes &= ~e, r && (t.warmLanes |= e), r = t.expirationTimes;
        for (var c = e; 0 < c; ) {
          var u = 31 - we(c), g = 1 << u;
          r[u] = -1, c &= ~g;
        }
        a !== 0 && v(t, a, e);
      }
      function xu() {
        return (xt & 6) === 0 ? (pa(0), !1) : !0;
      }
      function eo() {
        if (wt !== null) {
          if (Ct === 0)
            var t = wt.return;
          else
            t = wt, rn = Pn = null, _i(t), Aa = null, ul = 0, t = wt;
          for (; t !== null; )
            $c(t.alternate, t), t = t.return;
          wt = null;
        }
      }
      function ba(t, e) {
        var a = t.timeoutHandle;
        a !== In && (t.timeoutHandle = In, hp(a)), a = t.cancelPendingCommit, a !== null && (t.cancelPendingCommit = null, a()), un = 0, eo(), At = t, wt = a = nn(t.current, null), _t = e, Ct = 0, Ee = null, Tn = !1, Ha = R(t, e), Uo = !1, Ua = ze = qo = ra = Cn = Ut = 0, be = pl = null, Yo = !1, (e & 8) !== 0 && (e |= e & 32);
        var r = t.entangledLanes;
        if (r !== 0)
          for (t = t.entanglements, r &= e; 0 < r; ) {
            var c = 31 - we(r), u = 1 << c;
            e |= t[c], r &= ~u;
          }
        return cn = e, Hl(), a;
      }
      function wu(t, e) {
        bt = null, dt.H = fl, e === Ma || e === br ? (e = Gs(), Ct = 3) : e === Mo ? (e = Gs(), Ct = 4) : Ct = e === Do ? 8 : e !== null && typeof e == "object" && typeof e.then == "function" ? 6 : 1, Ee = e, wt === null && (Ut = 1, Zl(
          t,
          G(e, t.current)
        ));
      }
      function _u() {
        var t = Se.current;
        return t === null ? !0 : (_t & 4194048) === _t ? Oe === null : (_t & 62914560) === _t || (_t & 536870912) !== 0 ? t === Oe : !1;
      }
      function ku() {
        var t = dt.H;
        return dt.H = fl, t === null ? fl : t;
      }
      function Su() {
        var t = dt.A;
        return dt.A = Zh, t;
      }
      function nr() {
        Ut = 4, Tn || (_t & 4194048) !== _t && Se.current !== null || (Ha = !0), (Cn & 134217727) === 0 && (ra & 134217727) === 0 || At === null || wn(
          At,
          _t,
          ze,
          !1
        );
      }
      function no(t, e, a) {
        var r = xt;
        xt |= 2;
        var c = ku(), u = Su();
        (At !== t || _t !== e) && (Tr = null, ba(t, e)), e = !1;
        var g = Ut;
        t: do
          try {
            if (Ct !== 0 && wt !== null) {
              var M = wt, Y = Ee;
              switch (Ct) {
                case 8:
                  eo(), g = 6;
                  break t;
                case 3:
                case 2:
                case 9:
                case 6:
                  Se.current === null && (e = !0);
                  var J = Ct;
                  if (Ct = 0, Ee = null, va(t, M, Y, J), a && Ha) {
                    g = 0;
                    break t;
                  }
                  break;
                default:
                  J = Ct, Ct = 0, Ee = null, va(t, M, Y, J);
              }
            }
            Jm(), g = Ut;
            break;
          } catch (tt) {
            wu(t, tt);
          }
        while (!0);
        return e && t.shellSuspendCounter++, rn = Pn = null, xt = r, dt.H = c, dt.A = u, wt === null && (At = null, _t = 0, Hl()), g;
      }
      function Jm() {
        for (; wt !== null; ) Eu(wt);
      }
      function Wm(t, e) {
        var a = xt;
        xt |= 2;
        var r = ku(), c = Su();
        At !== t || _t !== e ? (Tr = null, hl = he() + 500, ba(t, e)) : Ha = R(
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
                  Ct = 0, Ee = null, va(t, e, u, 1);
                  break;
                case 2:
                case 9:
                  if (qs(u)) {
                    Ct = 0, Ee = null, zu(e);
                    break;
                  }
                  e = function() {
                    Ct !== 2 && Ct !== 9 || At !== t || (Ct = 7), Le(t);
                  }, u.then(e, e);
                  break t;
                case 3:
                  Ct = 7;
                  break t;
                case 4:
                  Ct = 5;
                  break t;
                case 7:
                  qs(u) ? (Ct = 0, Ee = null, zu(e)) : (Ct = 0, Ee = null, va(t, e, u, 7));
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
                        Ct = 0, Ee = null;
                        var tt = M.sibling;
                        if (tt !== null) wt = tt;
                        else {
                          var F = M.return;
                          F !== null ? (wt = F, ar(F)) : wt = null;
                        }
                        break e;
                      }
                  }
                  Ct = 0, Ee = null, va(t, e, u, 5);
                  break;
                case 6:
                  Ct = 0, Ee = null, va(t, e, u, 6);
                  break;
                case 8:
                  eo(), Ut = 6;
                  break t;
                default:
                  throw Error(s(462));
              }
            }
            Fm();
            break;
          } catch (at) {
            wu(t, at);
          }
        while (!0);
        return rn = Pn = null, dt.H = r, dt.A = c, xt = a, wt !== null ? 0 : (At = null, _t = 0, Hl(), Ut);
      }
      function Fm() {
        for (; wt !== null && !Bh(); )
          Eu(wt);
      }
      function Eu(t) {
        var e = Zc(
          t.alternate,
          t,
          cn
        );
        t.memoizedProps = t.pendingProps, e === null ? ar(t) : wt = e;
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
            _i(e);
          default:
            $c(a, e), e = wt = Bu(e, cn), e = Zc(a, e, cn);
        }
        t.memoizedProps = t.pendingProps, e === null ? ar(t) : wt = e;
      }
      function va(t, e, a, r) {
        rn = Pn = null, _i(e), Aa = null, ul = 0;
        var c = e.return;
        try {
          if (Ym(
            t,
            c,
            e,
            a,
            _t
          )) {
            Ut = 1, Zl(
              t,
              G(a, t.current)
            ), wt = null;
            return;
          }
        } catch (u) {
          if (c !== null) throw wt = c, u;
          Ut = 1, Zl(
            t,
            G(a, t.current)
          ), wt = null;
          return;
        }
        e.flags & 32768 ? (St || r === 1 ? t = !0 : Ha || (_t & 536870912) !== 0 ? t = !1 : (Tn = t = !0, (r === 2 || r === 9 || r === 3 || r === 6) && (r = Se.current, r !== null && r.tag === 13 && (r.flags |= 16384))), Nu(e, t)) : ar(e);
      }
      function ar(t) {
        var e = t;
        do {
          if ((e.flags & 32768) !== 0) {
            Nu(
              e,
              Tn
            );
            return;
          }
          t = e.return;
          var a = Lm(
            e.alternate,
            e,
            cn
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
      function Nu(t, e) {
        do {
          var a = Vm(t.alternate, t);
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
      function Tu(t, e, a, r, c, u, g, M, Y) {
        t.cancelPendingCommit = null;
        do
          nl();
        while (Xt !== 0);
        if ((xt & 6) !== 0) throw Error(s(327));
        if (e !== null) {
          if (e === t.current)
            throw Error(s(177));
          if (u = e.lanes | e.childLanes, u |= Ao, h(
            t,
            a,
            u,
            g,
            M,
            Y
          ), t === At && (wt = At = null, _t = 0), qa = e, An = t, un = a, Go = u, Qo = c, Ed = r, (e.subtreeFlags & 10256) !== 0 || (e.flags & 10256) !== 0 ? (t.callbackNode = null, t.callbackPriority = 0, tp(ko, function() {
            return Ou(), null;
          })) : (t.callbackNode = null, t.callbackPriority = 0), r = (e.flags & 13878) !== 0, (e.subtreeFlags & 13878) !== 0 || r) {
            r = dt.T, dt.T = null, c = ln(), Wt(2), g = xt, xt |= 4;
            try {
              Km(t, e, a);
            } finally {
              xt = g, Wt(c), dt.T = r;
            }
          }
          Xt = 1, Cu(), Mu(), Au();
        }
      }
      function Cu() {
        if (Xt === 1) {
          Xt = 0;
          var t = An, e = qa, a = (e.flags & 13878) !== 0;
          if ((e.subtreeFlags & 13878) !== 0 || a) {
            a = dt.T, dt.T = null;
            var r = ln();
            Wt(2);
            var c = xt;
            xt |= 4;
            try {
              cu(e, t), fp(t.containerInfo);
            } finally {
              xt = c, Wt(r), dt.T = a;
            }
          }
          t.current = e, Xt = 2;
        }
      }
      function Mu() {
        if (Xt === 2) {
          Xt = 0;
          var t = An, e = qa, a = (e.flags & 8772) !== 0;
          if ((e.subtreeFlags & 8772) !== 0 || a) {
            a = dt.T, dt.T = null;
            var r = ln();
            Wt(2);
            var c = xt;
            xt |= 4;
            try {
              ru(t, e.alternate, e);
            } finally {
              xt = c, Wt(r), dt.T = a;
            }
          }
          Xt = 3;
        }
      }
      function Au() {
        if (Xt === 4 || Xt === 3) {
          Xt = 0, Hh();
          var t = An, e = qa, a = un, r = Ed;
          (e.subtreeFlags & 10256) !== 0 || (e.flags & 10256) !== 0 ? Xt = 5 : (Xt = 0, qa = An = null, ju(t, t.pendingLanes));
          var c = t.pendingLanes;
          if (c === 0 && (Mn = null), B(a), e = e.stateNode, _e && typeof _e.onCommitFiberRoot == "function")
            try {
              _e.onCommitFiberRoot(
                il,
                e,
                void 0,
                (e.current.flags & 128) === 128
              );
            } catch {
            }
          if (r !== null) {
            e = dt.T, c = ln(), Wt(2), dt.T = null;
            try {
              for (var u = t.onRecoverableError, g = 0; g < r.length; g++) {
                var M = r[g];
                u(M.value, {
                  componentStack: M.stack
                });
              }
            } finally {
              dt.T = e, Wt(c);
            }
          }
          (un & 3) !== 0 && nl(), Le(t), c = t.pendingLanes, (a & 261930) !== 0 && (c & 42) !== 0 ? t === Lo ? gl++ : (gl = 0, Lo = t) : gl = 0, ue && wh(), pa(0);
        }
      }
      function ju(t, e) {
        (t.pooledCacheLanes &= e) === 0 && (e = t.pooledCache, e != null && (t.pooledCache = null, La(e)));
      }
      function nl() {
        return Cu(), Mu(), Au(), Ou();
      }
      function Ou() {
        if (Xt !== 5) return !1;
        var t = An, e = Go;
        Go = 0;
        var a = B(un), r = 32 > a ? 32 : a;
        a = dt.T;
        var c = ln();
        try {
          Wt(r), dt.T = null, r = Qo, Qo = null;
          var u = An, g = un;
          if (Xt = 0, qa = An = null, un = 0, (xt & 6) !== 0)
            throw Error(s(331));
          var M = xt;
          if (xt |= 4, pu(u.current), du(
            u,
            u.current,
            g,
            r
          ), xt = M, pa(0, !1), _e && typeof _e.onPostCommitFiberRoot == "function")
            try {
              _e.onPostCommitFiberRoot(il, u);
            } catch {
            }
          return !0;
        } finally {
          Wt(c), dt.T = a, ju(t, e);
        }
      }
      function Ru(t, e, a) {
        e = G(a, e), e = Ri(t.stateNode, e, 2), t = bn(t, e, 2), t !== null && (D(t, 2), Le(t));
      }
      function zt(t, e, a) {
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
              if (typeof e.type.getDerivedStateFromError == "function" || typeof r.componentDidCatch == "function" && (Mn === null || !Mn.has(r))) {
                t = G(a, t), a = Oc(2), r = bn(e, a, 2), r !== null && (Rc(
                  a,
                  r,
                  e,
                  t
                ), D(r, 2), Le(r));
                break;
              }
            }
            e = e.return;
          }
      }
      function ao(t, e, a) {
        var r = t.pingCache;
        if (r === null) {
          r = t.pingCache = new Jh();
          var c = /* @__PURE__ */ new Set();
          r.set(e, c);
        } else
          c = r.get(e), c === void 0 && (c = /* @__PURE__ */ new Set(), r.set(e, c));
        c.has(a) || (Uo = !0, c.add(a), t = Im.bind(null, t, e, a), e.then(t, t));
      }
      function Im(t, e, a) {
        var r = t.pingCache;
        r !== null && r.delete(e), t.pingedLanes |= t.suspendedLanes & a, t.warmLanes &= ~a, At === t && (_t & a) === a && (Ut === 4 || Ut === 3 && (_t & 62914560) === _t && 300 > he() - Nr ? (xt & 2) === 0 && ba(t, 0) : qo |= a, Ua === _t && (Ua = 0)), Le(t);
      }
      function Du(t, e) {
        e === 0 && (e = K()), t = Xn(t, e), t !== null && (D(t, e), Le(t));
      }
      function $m(t) {
        var e = t.memoizedState, a = 0;
        e !== null && (a = e.retryLane), Du(t, a);
      }
      function Pm(t, e) {
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
      function tp(t, e) {
        return dr(t, e);
      }
      function ep(t, e, a, r) {
        this.tag = t, this.key = a, this.sibling = this.child = this.return = this.stateNode = this.type = this.elementType = null, this.index = 0, this.refCleanup = this.ref = null, this.pendingProps = e, this.dependencies = this.memoizedState = this.updateQueue = this.memoizedProps = null, this.mode = r, this.subtreeFlags = this.flags = 0, this.deletions = null, this.childLanes = this.lanes = 0, this.alternate = null;
      }
      function lo(t) {
        return t = t.prototype, !(!t || !t.isReactComponent);
      }
      function nn(t, e) {
        var a = t.alternate;
        return a === null ? (a = o(
          t.tag,
          e,
          t.key,
          t.mode
        ), a.elementType = t.elementType, a.type = t.type, a.stateNode = t.stateNode, a.alternate = t, t.alternate = a) : (a.pendingProps = e, a.type = t.type, a.flags = 0, a.subtreeFlags = 0, a.deletions = null), a.flags = t.flags & 65011712, a.childLanes = t.childLanes, a.lanes = t.lanes, a.child = t.child, a.memoizedProps = t.memoizedProps, a.memoizedState = t.memoizedState, a.updateQueue = t.updateQueue, e = t.dependencies, a.dependencies = e === null ? null : {
          lanes: e.lanes,
          firstContext: e.firstContext
        }, a.sibling = t.sibling, a.index = t.index, a.ref = t.ref, a.refCleanup = t.refCleanup, a;
      }
      function Bu(t, e) {
        t.flags &= 65011714;
        var a = t.alternate;
        return a === null ? (t.childLanes = 0, t.lanes = e, t.child = null, t.subtreeFlags = 0, t.memoizedProps = null, t.memoizedState = null, t.updateQueue = null, t.dependencies = null, t.stateNode = null) : (t.childLanes = a.childLanes, t.lanes = a.lanes, t.child = a.child, t.subtreeFlags = 0, t.deletions = null, t.memoizedProps = a.memoizedProps, t.memoizedState = a.memoizedState, t.updateQueue = a.updateQueue, t.type = a.type, e = a.dependencies, t.dependencies = e === null ? null : {
          lanes: e.lanes,
          firstContext: e.firstContext
        }), t;
      }
      function lr(t, e, a, r, c, u) {
        var g = 0;
        if (r = t, typeof t == "function") lo(t) && (g = 1);
        else if (typeof t == "string")
          g = Ye && Kt ? rd(t, a, ne.current) ? 26 : pd(t) ? 27 : 5 : Ye ? rd(
            t,
            a,
            ne.current
          ) ? 26 : 5 : Kt && pd(t) ? 27 : 5;
        else
          t: switch (t) {
            case ho:
              return t = o(31, a, e, c), t.elementType = ho, t.lanes = u, t;
            case xa:
              return Fn(
                a.children,
                c,
                u,
                e
              );
            case Lu:
              g = 8, c |= 24;
              break;
            case co:
              return t = o(12, a, e, c | 2), t.elementType = co, t.lanes = u, t;
            case fo:
              return t = o(13, a, e, c), t.elementType = fo, t.lanes = u, t;
            case mo:
              return t = o(19, a, e, c), t.elementType = mo, t.lanes = u, t;
            default:
              if (typeof t == "object" && t !== null)
                switch (t.$$typeof) {
                  case _n:
                    g = 10;
                    break t;
                  case Vu:
                    g = 9;
                    break t;
                  case uo:
                    g = 11;
                    break t;
                  case po:
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
        return e = o(g, a, e, c), e.elementType = t, e.type = r, e.lanes = u, e;
      }
      function Fn(t, e, a, r) {
        return t = o(7, t, r, e), t.lanes = a, t;
      }
      function ro(t, e, a) {
        return t = o(6, t, null, e), t.lanes = a, t;
      }
      function Hu(t) {
        var e = o(18, null, null, 0);
        return e.stateNode = t, e;
      }
      function io(t, e, a) {
        return e = o(
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
      function np(t, e, a, r, c, u, g, M, Y) {
        this.tag = 1, this.containerInfo = t, this.pingCache = this.current = this.pendingChildren = null, this.timeoutHandle = In, this.callbackNode = this.next = this.pendingContext = this.context = this.cancelPendingCommit = null, this.callbackPriority = 0, this.expirationTimes = H(-1), this.entangledLanes = this.shellSuspendCounter = this.errorRecoveryDisabledLanes = this.expiredLanes = this.warmLanes = this.pingedLanes = this.suspendedLanes = this.pendingLanes = 0, this.entanglements = H(0), this.hiddenUpdates = H(null), this.identifierPrefix = r, this.onUncaughtError = c, this.onCaughtError = u, this.onRecoverableError = g, this.pooledCache = null, this.pooledCacheLanes = 0, this.formState = Y, this.incompleteTransitions = /* @__PURE__ */ new Map();
      }
      function Uu(t, e, a, r, c, u, g, M, Y, J, tt, F) {
        return t = new np(
          t,
          e,
          a,
          g,
          Y,
          J,
          tt,
          F,
          M
        ), e = 1, u === !0 && (e |= 24), u = o(3, null, null, e), t.current = u, u.stateNode = t, e = si(), e.refCount++, t.pooledCache = e, e.refCount++, u.memoizedState = {
          element: r,
          isDehydrated: a,
          cache: e
        }, fi(u), t;
      }
      function qu(t) {
        return t ? (t = Sa, t) : Sa;
      }
      function Yu(t) {
        var e = t._reactInternals;
        if (e === void 0)
          throw typeof t.render == "function" ? Error(s(188)) : (t = Object.keys(t).join(","), Error(s(268, t)));
        return t = d(e), t = t !== null ? p(t) : null, t === null ? null : al(t.stateNode);
      }
      function Gu(t, e, a, r, c, u) {
        c = qu(c), r.context === null ? r.context = c : r.pendingContext = c, r = gn(e), r.payload = { element: a }, u = u === void 0 ? null : u, u !== null && (r.callback = u), a = bn(t, r, e), a !== null && (pe(a, t, e), Ka(a, t, e));
      }
      function Qu(t, e) {
        if (t = t.memoizedState, t !== null && t.dehydrated !== null) {
          var a = t.retryLane;
          t.retryLane = a !== 0 && a < e ? a : e;
        }
      }
      function oo(t, e) {
        Qu(t, e), (t = t.alternate) && Qu(t, e);
      }
      var yt = {}, ap = _0, xe = S0(), so = Object.assign, lp = Symbol.for("react.element"), rr = Symbol.for("react.transitional.element"), ya = Symbol.for("react.portal"), xa = Symbol.for("react.fragment"), Lu = Symbol.for("react.strict_mode"), co = Symbol.for("react.profiler"), Vu = Symbol.for("react.consumer"), _n = Symbol.for("react.context"), uo = Symbol.for("react.forward_ref"), fo = Symbol.for("react.suspense"), mo = Symbol.for("react.suspense_list"), po = Symbol.for("react.memo"), kn = Symbol.for("react.lazy"), ho = Symbol.for("react.activity"), rp = Symbol.for("react.memo_cache_sentinel"), Ku = Symbol.iterator, ip = Symbol.for("react.client.reference"), ir = Array.isArray, dt = ap.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE, op = l.rendererVersion, sp = l.rendererPackageName, Xu = l.extraDevToolsConfig, al = l.getPublicInstance, cp = l.getRootHostContext, up = l.getChildHostContext, dp = l.prepareForCommit, fp = l.resetAfterCommit, mp = l.createInstance;
      l.cloneMutableInstance;
      var go = l.appendInitialChild, Zu = l.finalizeInitialChildren, or = l.shouldSetTextContent, Ju = l.createTextInstance;
      l.cloneMutableTextInstance;
      var pp = l.scheduleTimeout, hp = l.cancelTimeout, In = l.noTimeout, an = l.isPrimaryRenderer;
      l.warnsIfNotActing;
      var ce = l.supportsMutation, Ke = l.supportsPersistence, ue = l.supportsHydration, gp = l.getInstanceFromNode;
      l.beforeActiveInstanceBlur;
      var bp = l.preparePortalMount;
      l.prepareScopeUpdate, l.getInstanceFromScope;
      var Wt = l.setCurrentUpdatePriority, ln = l.getCurrentUpdatePriority, vp = l.resolveUpdatePriority;
      l.trackSchedulerEvent, l.resolveEventType, l.resolveEventTimeStamp;
      var yp = l.shouldAttemptEagerTransition, xp = l.detachDeletedInstance;
      l.requestPostPaintCallback;
      var wp = l.maySuspendCommit, _p = l.maySuspendCommitOnUpdate, bo = l.maySuspendCommitInSyncRender, Wu = l.preloadInstance, kp = l.startSuspendingCommit, Fu = l.suspendInstance;
      l.suspendOnActiveViewTransition;
      var Sp = l.waitForCommitToBeReady;
      l.getSuspendedCommitReason;
      var wa = l.NotPendingTransition, $n = l.HostTransitionContext, Ep = l.resetFormInstance;
      l.bindToConsole;
      var zp = l.supportsMicrotasks, Np = l.scheduleMicrotask, ll = l.supportsTestSelectors, Tp = l.findFiberRoot, Cp = l.getBoundingRect, Mp = l.getTextContent, rl = l.isHiddenSubtree, Ap = l.matchAccessibilityRole, jp = l.setFocusIfFocusable, Op = l.setupIntersectionObserver, Rp = l.appendChild, Dp = l.appendChildToContainer, Bp = l.commitTextUpdate, Hp = l.commitMount, Up = l.commitUpdate, qp = l.insertBefore, Yp = l.insertInContainerBefore, Gp = l.removeChild, Qp = l.removeChildFromContainer, Iu = l.resetTextContent, Lp = l.hideInstance, Vp = l.hideTextInstance, Kp = l.unhideInstance, Xp = l.unhideTextInstance;
      l.cancelViewTransitionName, l.cancelRootViewTransitionName, l.restoreRootViewTransitionName, l.cloneRootViewTransitionContainer, l.removeRootViewTransitionClone, l.measureClonedInstance, l.hasInstanceChanged, l.hasInstanceAffectedParent, l.startViewTransition, l.startGestureTransition, l.stopViewTransition, l.getCurrentGestureOffset, l.createViewTransitionInstance;
      var Zp = l.clearContainer;
      l.createFragmentInstance, l.updateFragmentInstanceFiber, l.commitNewChildToFragmentInstance, l.deleteChildFromFragmentInstance;
      var Jp = l.cloneInstance, $u = l.createContainerChildSet, Pu = l.appendChildToContainerChildSet, Wp = l.finalizeContainerChildren, td = l.replaceContainerChildren, ed = l.cloneHiddenInstance, nd = l.cloneHiddenTextInstance, vo = l.isSuspenseInstancePending, yo = l.isSuspenseInstanceFallback, Fp = l.getSuspenseInstanceFallbackErrorDetails, Ip = l.registerSuspenseInstanceRetry, $p = l.canHydrateFormStateMarker, Pp = l.isFormStateMarkerMatching, ad = l.getNextHydratableSibling, th = l.getNextHydratableSiblingAfterSingleton, eh = l.getFirstHydratableChild, nh = l.getFirstHydratableChildWithinContainer, ah = l.getFirstHydratableChildWithinActivityInstance, lh = l.getFirstHydratableChildWithinSuspenseInstance, rh = l.getFirstHydratableChildWithinSingleton, ih = l.canHydrateInstance, oh = l.canHydrateTextInstance, sh = l.canHydrateActivityInstance, ch = l.canHydrateSuspenseInstance, uh = l.hydrateInstance, dh = l.hydrateTextInstance, fh = l.hydrateActivityInstance, mh = l.hydrateSuspenseInstance, ph = l.getNextHydratableInstanceAfterActivityInstance, hh = l.getNextHydratableInstanceAfterSuspenseInstance, gh = l.commitHydratedInstance, bh = l.commitHydratedContainer, vh = l.commitHydratedActivityInstance, yh = l.commitHydratedSuspenseInstance, xh = l.finalizeHydratedChildren, wh = l.flushHydrationEvents;
      l.clearActivityBoundary;
      var _h = l.clearSuspenseBoundary;
      l.clearActivityBoundaryFromContainer;
      var kh = l.clearSuspenseBoundaryFromContainer, Sh = l.hideDehydratedBoundary, Eh = l.unhideDehydratedBoundary, ld = l.shouldDeleteUnhydratedTailInstances;
      l.diffHydratedPropsForDevWarnings, l.diffHydratedTextForDevWarnings, l.describeHydratableInstanceForDevWarnings;
      var zh = l.validateHydratableInstance, Nh = l.validateHydratableTextInstance, Ye = l.supportsResources, rd = l.isHostHoistableType, xo = l.getHoistableRoot, id = l.getResource, od = l.acquireResource, sd = l.releaseResource, Th = l.hydrateHoistable, cd = l.mountHoistable, ud = l.unmountHoistable, Ch = l.createHoistableInstance, Mh = l.prepareToCommitHoistables, Ah = l.mayResourceSuspendCommit, dd = l.preloadResource, jh = l.suspendResource, Kt = l.supportsSingletons, fd = l.resolveSingletonInstance, Oh = l.acquireSingletonInstance, md = l.releaseSingletonInstance, pd = l.isHostSingletonType, _a = l.isSingletonScope, wo = [], ka = -1, Sa = {}, we = Math.clz32 ? Math.clz32 : b, Rh = Math.log, Dh = Math.LN2, sr = 256, cr = 262144, ur = 4194304, dr = xe.unstable_scheduleCallback, _o = xe.unstable_cancelCallback, Bh = xe.unstable_shouldYield, Hh = xe.unstable_requestPaint, he = xe.unstable_now, hd = xe.unstable_ImmediatePriority, Uh = xe.unstable_UserBlockingPriority, ko = xe.unstable_NormalPriority, qh = xe.unstable_IdlePriority, Yh = xe.log, Gh = xe.unstable_setDisableYieldValue, il = null, _e = null, ke = typeof Object.is == "function" ? Object.is : $, gd = typeof reportError == "function" ? reportError : function(t) {
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
      }, Qh = Object.prototype.hasOwnProperty, So, bd, Eo = !1, vd = /* @__PURE__ */ new WeakMap(), Ea = [], za = 0, fr = null, ol = 0, Ce = [], Me = 0, Sn = null, Xe = 1, Ze = "", ne = x(null), sl = x(null), En = x(null), mr = x(null), ae = null, Ot = null, St = !1, zn = null, Ae = !1, zo = Error(s(519)), pr = x(null), Pn = null, rn = null, Lh = typeof AbortController < "u" ? AbortController : function() {
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
      }, Vh = xe.unstable_scheduleCallback, Kh = xe.unstable_NormalPriority, Rt = {
        $$typeof: _n,
        Consumer: null,
        Provider: null,
        _currentValue: null,
        _currentValue2: null,
        _threadCount: 0
      }, hr = null, Na = null, No = !1, gr = !1, To = !1, ta = 0, cl = null, Co = 0, Ta = 0, Ca = null, yd = dt.S;
      dt.S = function(t, e) {
        Sd = he(), typeof e == "object" && e !== null && typeof e.then == "function" && jm(t, e), yd !== null && yd(t, e);
      };
      var ea = x(null), Ma = Error(s(460)), Mo = Error(s(474)), br = Error(s(542)), vr = { then: function() {
      } }, na = null, Aa = null, ul = 0, aa = Ls(!0), xd = Ls(!1), je = [], ja = 0, Ao = 0, Nn = !1, jo = !1, Oa = x(null), yr = x(0), Se = x(null), Oe = null, Yt = x(0), on = 0, bt = null, Mt = null, Gt = null, xr = !1, Ra = !1, la = !1, wr = 0, dl = 0, Da = null, Xh = 0, fl = {
        readContext: te,
        use: Ql,
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
      fl.useEffectEvent = Ht;
      var wd = {
        readContext: te,
        use: Ql,
        useCallback: function(t, e) {
          return fe().memoizedState = [
            t,
            e === void 0 ? null : e
          ], t;
        },
        useContext: te,
        useEffect: pc,
        useImperativeHandle: function(t, e, a) {
          a = a != null ? a.concat([t]) : null, Vl(
            4194308,
            4,
            vc.bind(null, e, t),
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
          if (la) {
            L(!0);
            try {
              t();
            } finally {
              L(!1);
            }
          }
          return a.memoizedState = [r, e], r;
        },
        useReducer: function(t, e, a) {
          var r = fe();
          if (a !== void 0) {
            var c = a(e);
            if (la) {
              L(!0);
              try {
                a(e);
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
          }, r.queue = t, t = t.dispatch = qm.bind(
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
          var e = t.queue, a = Nc.bind(
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
          return t = kc.bind(
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
            (_t & 127) !== 0 || $s(r, e, a);
          }
          c.memoizedState = a;
          var u = { value: a, getSnapshot: e };
          return c.queue = u, pc(tc.bind(null, r, u, t), [
            t
          ]), r.flags |= 2048, ha(
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
          var t = fe(), e = At.identifierPrefix;
          if (St) {
            var a = Ze, r = Xe;
            a = (r & ~(1 << 32 - we(r) - 1)).toString(32) + a, e = "_" + e + "R_" + a, a = wr++, 0 < a && (e += "H" + a.toString(32)), e += "_";
          } else
            a = Xh++, e = "_" + e + "r_" + a.toString(32) + "_";
          return t.memoizedState = e;
        },
        useHostTransitionStatus: Ai,
        useFormState: cc,
        useActionState: cc,
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
          return fe().memoizedState = Um.bind(
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
        use: Ql,
        useCallback: xc,
        useContext: te,
        useEffect: Ti,
        useImperativeHandle: yc,
        useInsertionEffect: gc,
        useLayoutEffect: bc,
        useMemo: wc,
        useReducer: Ll,
        useRef: mc,
        useState: function() {
          return Ll($e);
        },
        useDebugValue: Ci,
        useDeferredValue: function(t, e) {
          var a = qt();
          return _c(
            a,
            Mt.memoizedState,
            t,
            e
          );
        },
        useTransition: function() {
          var t = Ll($e)[0], e = qt().memoizedState;
          return [
            typeof t == "boolean" ? t : Ja(t),
            e
          ];
        },
        useSyncExternalStore: Is,
        useId: Ec,
        useHostTransitionStatus: Ai,
        useFormState: uc,
        useActionState: uc,
        useOptimistic: function(t, e) {
          var a = qt();
          return ac(a, Mt, t, e);
        },
        useMemoCache: ki,
        useCacheRefresh: zc
      };
      Oo.useEffectEvent = hc;
      var _d = {
        readContext: te,
        use: Ql,
        useCallback: xc,
        useContext: te,
        useEffect: Ti,
        useImperativeHandle: yc,
        useInsertionEffect: gc,
        useLayoutEffect: bc,
        useMemo: wc,
        useReducer: Ei,
        useRef: mc,
        useState: function() {
          return Ei($e);
        },
        useDebugValue: Ci,
        useDeferredValue: function(t, e) {
          var a = qt();
          return Mt === null ? Mi(a, t, e) : _c(
            a,
            Mt.memoizedState,
            t,
            e
          );
        },
        useTransition: function() {
          var t = Ei($e)[0], e = qt().memoizedState;
          return [
            typeof t == "boolean" ? t : Ja(t),
            e
          ];
        },
        useSyncExternalStore: Is,
        useId: Ec,
        useHostTransitionStatus: Ai,
        useFormState: fc,
        useActionState: fc,
        useOptimistic: function(t, e) {
          var a = qt();
          return Mt !== null ? ac(a, Mt, t, e) : (a.baseState = t, [t, a.queue.dispatch]);
        },
        useMemoCache: ki,
        useCacheRefresh: zc
      };
      _d.useEffectEvent = hc;
      var Ro = {
        enqueueSetState: function(t, e, a) {
          t = t._reactInternals;
          var r = ye(), c = gn(r);
          c.payload = e, a != null && (c.callback = a), e = bn(t, c, r), e !== null && (pe(e, t, r), Ka(e, t, r));
        },
        enqueueReplaceState: function(t, e, a) {
          t = t._reactInternals;
          var r = ye(), c = gn(r);
          c.tag = 1, c.payload = e, a != null && (c.callback = a), e = bn(t, c, r), e !== null && (pe(e, t, r), Ka(e, t, r));
        },
        enqueueForceUpdate: function(t, e) {
          t = t._reactInternals;
          var a = ye(), r = gn(a);
          r.tag = 2, e != null && (r.callback = e), e = bn(t, r, a), e !== null && (pe(e, t, a), Ka(e, t, a));
        }
      }, Do = Error(s(461)), Qt = !1, Bo = {
        dehydrated: null,
        treeContext: null,
        retryLane: 0,
        hydrationErrors: null
      }, sn = !1, Lt = !1, Ho = !1, kd = typeof WeakSet == "function" ? WeakSet : Set, Ft = null, Vt = null, ge = !1, Ge = null, Ba = 8192, Zh = {
        getCacheForType: function(t) {
          var e = te(Rt), a = e.data.get(t);
          return a === void 0 && (a = t(), e.data.set(t, a)), a;
        },
        cacheSignal: function() {
          return te(Rt).controller.signal;
        }
      }, _r = 0, kr = 1, Sr = 2, Er = 3, zr = 4;
      if (typeof Symbol == "function" && Symbol.for) {
        var ml = Symbol.for;
        _r = ml("selector.component"), kr = ml("selector.has_pseudo_class"), Sr = ml("selector.role"), Er = ml("selector.test_id"), zr = ml("selector.text");
      }
      var Jh = typeof WeakMap == "function" ? WeakMap : Map, xt = 0, At = null, wt = null, _t = 0, Ct = 0, Ee = null, Tn = !1, Ha = !1, Uo = !1, cn = 0, Ut = 0, Cn = 0, ra = 0, qo = 0, ze = 0, Ua = 0, pl = null, be = null, Yo = !1, Nr = 0, Sd = 0, hl = 1 / 0, Tr = null, Mn = null, Xt = 0, An = null, qa = null, un = 0, Go = 0, Qo = null, Ed = null, gl = 0, Lo = null;
      return yt.attemptContinuousHydration = function(t) {
        if (t.tag === 13 || t.tag === 31) {
          var e = Xn(t, 67108864);
          e !== null && pe(e, t, 67108864), oo(t, 67108864);
        }
      }, yt.attemptHydrationAtCurrentPriority = function(t) {
        if (t.tag === 13 || t.tag === 31) {
          var e = ye();
          e = T(e);
          var a = Xn(t, e);
          a !== null && pe(a, t, e), oo(t, e);
        }
      }, yt.attemptSynchronousHydration = function(t) {
        switch (t.tag) {
          case 3:
            if (t = t.stateNode, t.current.memoizedState.isDehydrated) {
              var e = N(t.pendingLanes);
              if (e !== 0) {
                for (t.pendingLanes |= 2, t.entangledLanes |= 2; e; ) {
                  var a = 1 << 31 - we(e);
                  t.entanglements[1] |= a, e &= ~a;
                }
                Le(t), (xt & 6) === 0 && (hl = he() + 500, pa(0));
              }
            }
            break;
          case 31:
          case 13:
            e = Xn(t, 2), e !== null && pe(e, t, 2), xu(), oo(t, 2);
        }
      }, yt.batchedUpdates = function(t, e) {
        return t(e);
      }, yt.createComponentSelector = function(t) {
        return { $$typeof: _r, value: t };
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
        return { $$typeof: kr, value: t };
      }, yt.createHydrationContainer = function(t, e, a, r, c, u, g, M, Y, J, tt, F, at, gt) {
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
          tt,
          F
        ), t.context = qu(null), a = t.current, r = ye(), r = T(r), c = gn(r), c.callback = e ?? null, bn(a, c, r), e = r, t.current.lanes = e, D(t, e), Le(t), t;
      }, yt.createPortal = function(t, e, a) {
        var r = 3 < arguments.length && arguments[3] !== void 0 ? arguments[3] : null;
        return {
          $$typeof: ya,
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
        gd(t);
      }, yt.defaultOnUncaughtError = function(t) {
        gd(t);
      }, yt.deferredUpdates = function(t) {
        var e = dt.T, a = ln();
        try {
          return Wt(32), dt.T = null, t();
        } finally {
          Wt(a), dt.T = e;
        }
      }, yt.discreteUpdates = function(t, e, a, r, c) {
        var u = dt.T, g = ln();
        try {
          return Wt(2), dt.T = null, t(e, a, r, c);
        } finally {
          Wt(g), dt.T = u, xt === 0 && (hl = he() + 500);
        }
      }, yt.findAllNodes = to, yt.findBoundingRects = function(t, e) {
        if (!ll) throw Error(s(363));
        e = to(t, e), t = [];
        for (var a = 0; a < e.length; a++)
          t.push(Cp(e[a]));
        for (e = t.length - 1; 0 < e; e--) {
          a = t[e];
          for (var r = a.x, c = r + a.width, u = a.y, g = u + a.height, M = e - 1; 0 <= M; M--)
            if (e !== M) {
              var Y = t[M], J = Y.x, tt = J + Y.width, F = Y.y, at = F + Y.height;
              if (r >= J && u >= F && c <= tt && g <= at) {
                t.splice(e, 1);
                break;
              } else if (r !== J || a.width !== Y.width || at < u || F > g) {
                if (!(u !== F || a.height !== Y.height || tt < r || J > c)) {
                  J > r && (Y.width += J - r, Y.x = r), tt < c && (Y.width = c - J), t.splice(e, 1);
                  break;
                }
              } else {
                F > u && (Y.height += F - u, Y.y = u), at < g && (Y.height = g - F), t.splice(e, 1);
                break;
              }
            }
        }
        return t;
      }, yt.findHostInstance = Yu, yt.findHostInstanceWithNoPortals = function(t) {
        return t = d(t), t = t !== null ? y(t) : null, t === null ? null : al(t.stateNode);
      }, yt.findHostInstanceWithWarning = function(t) {
        return Yu(t);
      }, yt.flushPassiveEffects = nl, yt.flushSyncFromReconciler = function(t) {
        var e = xt;
        xt |= 1;
        var a = dt.T, r = ln();
        try {
          if (Wt(2), dt.T = null, t)
            return t();
        } finally {
          Wt(r), dt.T = a, xt = e, (xt & 6) === 0 && pa(0);
        }
      }, yt.flushSyncWork = xu, yt.focusWithin = function(t, e) {
        if (!ll) throw Error(s(363));
        for (t = Ii(t), e = gu(t, e), e = Array.from(e), t = 0; t < e.length; ) {
          var a = e[t++], r = a.tag;
          if (!rl(a)) {
            if ((r === 5 || r === 26 || r === 27) && jp(a.stateNode))
              return !0;
            for (a = a.child; a !== null; )
              e.push(a), a = a.sibling;
          }
        }
        return !1;
      }, yt.getFindAllNodesFailureDescription = function(t, e) {
        if (!ll) throw Error(s(363));
        var a = 0, r = [];
        t = [Ii(t), 0];
        for (var c = 0; c < t.length; ) {
          var u = t[c++], g = u.tag, M = t[c++], Y = e[M];
          if ((g !== 5 && g !== 26 && g !== 27 || !rl(u)) && ($i(u, Y) && (r.push(Pi(Y)), M++, M > a && (a = M)), M < e.length))
            for (u = u.child; u !== null; )
              t.push(u, M), u = u.sibling;
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
            return al(t.child.stateNode);
          default:
            return t.child.stateNode;
        }
      }, yt.injectIntoDevTools = function() {
        var t = {
          bundleType: 0,
          version: op,
          rendererPackageName: sp,
          currentDispatcherRef: dt,
          reconcilerVersion: "19.2.0"
        };
        if (Xu !== null && (t.rendererConfig = Xu), typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ > "u") t = !1;
        else {
          var e = __REACT_DEVTOOLS_GLOBAL_HOOK__;
          if (e.isDisabled || !e.supportsFiber) t = !0;
          else {
            try {
              il = e.inject(t), _e = e;
            } catch {
            }
            t = !!e.checkDCE;
          }
        }
        return t;
      }, yt.isAlreadyRendering = function() {
        return (xt & 6) !== 0;
      }, yt.observeVisibleRects = function(t, e, a, r) {
        if (!ll) throw Error(s(363));
        t = to(t, e);
        var c = Op(
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
        var c = Sc(t).queue;
        kc(
          t,
          c,
          e,
          wa,
          a === null ? i : function() {
            var u = Sc(t);
            return u.next === null && (u = t.alternate.memoizedState), Wa(
              t,
              u.next.queue,
              {},
              ye()
            ), a(r);
          }
        );
      }, yt.updateContainer = function(t, e, a, r) {
        var c = e.current, u = ye();
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
  })(Zo)), Zo.exports;
}
var Ud;
function z0() {
  return Ud || (Ud = 1, Xo.exports = E0()), Xo.exports;
}
var N0 = z0();
const T0 = /* @__PURE__ */ ws(N0);
var Fo = { exports: {} }, dn = {};
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
function C0() {
  return qd || (qd = 1, dn.ConcurrentRoot = 1, dn.ContinuousEventPriority = 8, dn.DefaultEventPriority = 32, dn.DiscreteEventPriority = 2, dn.IdleEventPriority = 268435456, dn.LegacyRoot = 0, dn.NoEventPriority = 0), dn;
}
var Yd;
function M0() {
  return Yd || (Yd = 1, Fo.exports = C0()), Fo.exports;
}
var zl = M0();
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
const jf = ["accent", "panel-bg", "surface-0", "surface-1", "surface-dim", "overlay-0", "overlay-1", "text", "subtext-0", "mauve", "green", "yellow", "red", "blue", "teal", "peach", "backdrop", "card-bg"], rs = 16, Of = /* @__PURE__ */ new Set(["hover", "focus", "focus-visible", "focus-within", "active"]), A0 = [
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
}, j0 = /* @__PURE__ */ new Set([
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
]), Rf = {
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
}, Df = {
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
}, is = ["font-size", "color", ...new Set([...Object.keys(Rf), ...Object.keys(Df)].filter((n) => n !== "font-size" && n !== "color"))], O0 = new Set(is);
function ie(n, l = " ") {
  const o = [];
  let i = 0, s = "";
  for (let f = 0; f < n.length; f++) {
    const m = n[f];
    if (m === "(" ? i++ : m === ")" && i--, i === 0 && (l === " " ? /\s/.test(m) : m === l)) {
      (s.trim() || l !== " ") && o.push(s.trim()), s = "";
      continue;
    }
    s += m;
  }
  return (s.trim() || l !== " " && o.length) && o.push(s.trim()), o;
}
function os(n, l, o = 0) {
  if (o > 32) return null;
  let i = "", s = 0;
  for (; ; ) {
    const f = n.indexOf("var(", s);
    if (f < 0)
      return i += n.slice(s), i;
    i += n.slice(s, f);
    let m = 1, d = f + 4;
    for (; d < n.length && m; d++)
      n[d] === "(" ? m++ : n[d] === ")" && m--;
    const p = n.slice(f + 4, d - 1), y = ie(p, ","), E = y[0].trim(), _ = y.length > 1 ? p.slice(p.indexOf(",") + 1).trim() : null;
    let x = l(E);
    if ((x == null || x === "initial") && (x = _), x == null) return null;
    const z = os(x, l, o + 1);
    if (z === null) return null;
    i += z, s = d;
  }
}
function R0(n) {
  const l = [], o = /\s*(?:(-?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)(%|[a-z]+)?|([a-z-]+)\(|(infinity)|([()+*/,])|(-)(?=\s))/giy;
  let i, s = 0;
  for (; s < n.length; ) {
    if (o.lastIndex = s, i = o.exec(n), !i || i.index !== s) {
      if (/^\s+$/.test(n.slice(s))) break;
      return null;
    }
    s = o.lastIndex, i[1] !== void 0 ? l.push({ num: parseFloat(i[1]), unit: (i[2] ?? "").toLowerCase() }) : i[3] ? l.push({ fn: i[3].toLowerCase() }) : i[4] ? l.push({ num: 1 / 0, unit: "" }) : l.push({ op: i[5] ?? i[6] });
  }
  return l;
}
function Yn(n, l) {
  const o = R0(n.trim().replace(/env\(\s*safe-area-inset-(?:top|right|bottom|left)\s*(?:,[^()]*)?\)/gi, "0px"));
  if (!o) return null;
  let i = 0;
  const s = ({ num: x, unit: z }) => {
    switch (z) {
      case "":
        return { px: 0, pct: 0, num: x, unitless: !0 };
      case "px":
        return { px: x, pct: 0, num: 0 };
      case "rem":
        return { px: x * rs, pct: 0, num: 0 };
      case "em":
        return { px: x * (l.fontSize ?? rs), pct: 0, num: 0 };
      case "%":
        return { px: 0, pct: x, num: 0 };
      case "vh":
      case "dvh":
      case "svh":
      case "lvh":
        return { px: x / 100 * (l.viewport?.height ?? 800), pct: 0, num: 0 };
      case "vw":
      case "dvw":
      case "svw":
      case "lvw":
        return { px: x / 100 * (l.viewport?.width ?? 1e3), pct: 0, num: 0 };
      case "pt":
        return { px: x * (4 / 3), pct: 0, num: 0 };
      default:
        return null;
    }
  }, f = (x, z, k) => x && z ? { px: x.px + k * z.px, pct: x.pct + k * z.pct, num: x.num + k * z.num, unitless: x.unitless && z.unitless } : null, m = (x, z) => x ? { px: x.px * z, pct: x.pct * z, num: x.num * z, unitless: x.unitless } : null, d = (x) => x && x.unitless;
  function p() {
    const x = o[i++];
    if (!x) return null;
    if (x.num !== void 0) return s(x);
    if (x.op === "(") {
      const z = E();
      return o[i]?.op !== ")" ? null : (i++, z);
    }
    if (x.op === "-" || x.op === "+") {
      const z = p();
      return x.op === "-" ? m(z, -1) : z;
    }
    if (x.fn) {
      const z = [];
      for (; ; ) {
        z.push(E());
        const N = o[i++];
        if (!N) return null;
        if (N.op === ")") break;
        if (N.op !== ",") return null;
      }
      if (z.some((N) => !N)) return null;
      if (x.fn === "calc") return z[0];
      if (!(z.every((N) => !N.pct) || z.every((N) => !N.px && !N.num))) return null;
      const b = (N) => N.px + N.pct + N.num;
      return x.fn === "min" ? z.reduce((N, j) => b(j) < b(N) ? j : N) : x.fn === "max" ? z.reduce((N, j) => b(j) > b(N) ? j : N) : x.fn === "clamp" && z.length === 3 ? b(z[1]) < b(z[0]) ? z[0] : b(z[1]) > b(z[2]) ? z[2] : z[1] : null;
    }
    return null;
  }
  function y() {
    let x = p();
    for (; o[i] && (o[i].op === "*" || o[i].op === "/"); ) {
      const z = o[i++].op, k = p();
      if (!x || !k) return null;
      z === "*" ? x = d(k) ? m(x, k.num) : d(x) ? m(k, x.num) : null : x = d(k) && k.num !== 0 ? m(x, 1 / k.num) : null;
    }
    return x;
  }
  function E() {
    let x = y();
    for (; o[i] && (o[i].op === "+" || o[i].op === "-"); ) {
      const z = o[i++].op;
      x = f(x, y(), z === "-" ? -1 : 1);
    }
    return x;
  }
  const _ = E();
  return i !== o.length || !_ ? null : _;
}
function ss(n, l) {
  const o = n.trim().toLowerCase();
  if (/^(auto|none|normal|fit-content|max-content|min-content|medium|thin|thick)$/.test(o))
    return o === "thin" ? { px: 1 } : o === "medium" ? { px: 3 } : o === "thick" ? { px: 5 } : o;
  const i = Yn(o, l);
  return i ? i.unitless ? i.num === 0 ? { px: 0 } : { expr: n.trim() } : i.pct && (i.px || i.num) ? { expr: n.trim() } : i.pct ? { pct: i.pct } : { px: D0(i.px) } : { expr: n.trim() };
}
const D0 = (n) => Number.isFinite(n) ? n : n > 0 ? 34e37 : -34e37, Mr = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0"), B0 = ([n, l, o, i]) => `#${Mr(n)}${Mr(l)}${Mr(o)}${Mr(i * 255)}`;
function Qd(n) {
  const l = n.slice(1), o = l.length <= 4 ? l.split("").map((s) => s + s).join("") : l;
  if (!/^[0-9a-f]{6}([0-9a-f]{2})?$/i.test(o)) return null;
  const i = (s) => parseInt(o.slice(s, s + 2), 16);
  return [i(0), i(2), i(4), o.length === 8 ? i(6) / 255 : 1];
}
function Zr(n, l) {
  const o = n.trim().toLowerCase();
  if (o === "currentcolor") return "currentcolor";
  const i = /^perchtoken\(([a-z0-9-]+)\)$/.exec(o);
  if (i) {
    const y = l(i[1]), E = y && Qd(y);
    return E ? { rgba: E, token: i[1] } : null;
  }
  if (o.startsWith("#")) {
    const y = Qd(o);
    return y ? { rgba: y, token: null } : null;
  }
  if (Gd[o]) return { rgba: [...Gd[o]], token: null };
  const s = /^(rgba?|color-mix)\((.*)\)$/s.exec(o);
  if (!s) return null;
  if (s[1] === "color-mix") {
    const y = ie(s[2], ",");
    if (y.length !== 3 || !/^in\s+(srgb|srgb-linear|oklab|lab|oklch|lch|hsl|xyz)/.test(y[0])) return null;
    const E = (L) => {
      const $ = ie(L), et = $.findIndex((P) => /%$/.test(P)), Q = et >= 0 ? parseFloat($[et]) / 100 : null;
      return { color: Zr($.filter((P, G) => G !== et).join(" "), l), pct: Q };
    }, _ = E(y[1]), x = E(y[2]);
    if (!_.color || !x.color || _.color === "currentcolor" || x.color === "currentcolor") return null;
    let z = _.pct, k = x.pct;
    z === null && k === null ? (z = 0.5, k = 0.5) : z === null ? z = 1 - k : k === null && (k = 1 - z);
    const b = z + k, N = b < 1 ? b : 1;
    z /= b, k /= b;
    const [j, R, A, K] = _.color.rgba, [H, D, h, v] = x.color.rgba, w = K * z + v * k, S = (L, $) => w === 0 ? 0 : (L * K * z + $ * v * k) / w, T = [S(j, H), S(R, D), S(A, h), w * N], B = v === 0 ? _.color.token : K === 0 ? x.color.token : null;
    return { rgba: T, token: B };
  }
  const f = s[2].includes(",") ? ie(s[2], ",") : ie(s[2].replace("/", " / ")).filter((y) => y !== "/");
  if (f.length < 3) return null;
  const m = (y) => y.endsWith("%") ? parseFloat(y) / 100 * 255 : parseFloat(y), d = f[3] === void 0 ? 1 : f[3].endsWith("%") ? parseFloat(f[3]) / 100 : parseFloat(f[3]), p = [m(f[0]), m(f[1]), m(f[2]), d];
  return p.some((y) => Number.isNaN(y)) ? null : { rgba: p, token: null };
}
const wl = ["top", "right", "bottom", "left"], H0 = ["top-left", "top-right", "bottom-right", "bottom-left"], Ar = (n) => [n[0], n[1] ?? n[0], n[2] ?? n[0], n[3] ?? n[1] ?? n[0]], Ld = /* @__PURE__ */ new Set(["none", "hidden", "solid", "dashed", "dotted", "double", "groove", "ridge", "inset", "outset"]);
function cs(n, l) {
  const o = l.trim(), i = () => ie(o);
  switch (n) {
    case "padding":
    case "margin": {
      const s = Ar(i());
      return wl.map((f, m) => [`${n}-${f}`, s[m]]);
    }
    case "padding-inline":
    case "margin-inline": {
      const s = i(), f = n.split("-")[0];
      return [[`${f}-left`, s[0]], [`${f}-right`, s[1] ?? s[0]]];
    }
    case "padding-block":
    case "margin-block": {
      const s = i(), f = n.split("-")[0];
      return [[`${f}-top`, s[0]], [`${f}-bottom`, s[1] ?? s[0]]];
    }
    case "padding-inline-start":
    case "margin-inline-start":
      return [[`${n.split("-")[0]}-left`, o]];
    case "padding-inline-end":
    case "margin-inline-end":
      return [[`${n.split("-")[0]}-right`, o]];
    case "padding-block-start":
    case "margin-block-start":
      return [[`${n.split("-")[0]}-top`, o]];
    case "padding-block-end":
    case "margin-block-end":
      return [[`${n.split("-")[0]}-bottom`, o]];
    case "inset": {
      const s = Ar(i());
      return wl.map((f, m) => [f, s[m]]);
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
      return [["left", o]];
    case "inset-inline-end":
      return [["right", o]];
    case "border-width":
    case "border-style":
    case "border-color": {
      const s = n.split("-")[1], f = Ar(i());
      return wl.map((m, d) => [`border-${m}-${s}`, f[d]]);
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
      const s = n === "border" ? wl : n === "border-inline" ? ["left", "right"] : n === "border-block" ? ["top", "bottom"] : n === "border-inline-start" ? ["left"] : n === "border-inline-end" ? ["right"] : [n.slice(7)];
      let f = "medium", m = "none", d = "currentcolor";
      if (o !== "none" && o !== "0")
        for (const p of i())
          Ld.has(p) ? m = p : /^(thin|medium|thick|-?[\d.]|calc\()/.test(p) ? f = p : d = p;
      else o === "0" && (f = "0");
      return s.flatMap((p) => [[`border-${p}-width`, f], [`border-${p}-style`, m], [`border-${p}-color`, d]]);
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
      const s = Ar(ie(o.split("/")[0]));
      return H0.map((f, m) => [`border-${f}-radius`, s[m]]);
    }
    case "border-start-start-radius":
      return [["border-top-left-radius", o]];
    case "border-start-end-radius":
      return [["border-top-right-radius", o]];
    case "border-end-start-radius":
      return [["border-bottom-left-radius", o]];
    case "border-end-end-radius":
      return [["border-bottom-right-radius", o]];
    case "background":
      return o === "none" ? [["background-color", "transparent"], ["background-image", "none"]] : Zr(o, () => "#000000") ? [["background-color", o], ["background-image", "none"]] : [["background-color", "transparent"], ["background-image", o]];
    // ponytail: only the CSS-wide keywords (`[font:inherit]` on a button); a full `font` value is kept unexpanded.
    case "font":
      return /^(inherit|initial|unset|revert|revert-layer)$/.test(o) ? ["font-family", "font-size", "font-weight", "font-style", "line-height"].map((s) => [s, o]) : [[n, o]];
    case "overflow": {
      const s = i();
      return [["overflow-x", s[0]], ["overflow-y", s[1] ?? s[0]]];
    }
    case "gap": {
      const s = i();
      return [["row-gap", s[0]], ["column-gap", s[1] ?? s[0]]];
    }
    case "grid-gap":
      return cs("gap", o);
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
      if (o === "none") return [["flex-grow", "0"], ["flex-shrink", "0"], ["flex-basis", "auto"]];
      if (o === "auto") return [["flex-grow", "1"], ["flex-shrink", "1"], ["flex-basis", "auto"]];
      if (o === "initial") return [["flex-grow", "0"], ["flex-shrink", "1"], ["flex-basis", "auto"]];
      const s = i(), f = s.filter((d) => /^[\d.]+$/.test(d)), m = s.find((d) => !/^[\d.]+$/.test(d));
      return [["flex-grow", f[0] ?? "1"], ["flex-shrink", f[1] ?? "1"], ["flex-basis", m ?? (f.length ? "0%" : "auto")]];
    }
    case "flex-flow": {
      const s = [];
      for (const f of i()) s.push(/wrap/.test(f) ? ["flex-wrap", f] : ["flex-direction", f]);
      return s;
    }
    case "outline": {
      if (o === "none" || o === "0") return [["outline-style", "none"], ["outline-width", "medium"], ["outline-color", "currentcolor"]];
      let s = "medium", f = "none", m = "currentcolor";
      for (const d of i())
        Ld.has(d) || d === "auto" ? f = d : /^(thin|medium|thick|-?[\d.]|calc\()/.test(d) ? s = d : m = d;
      return [["outline-width", s], ["outline-style", f], ["outline-color", m]];
    }
    case "transition": {
      if (o === "none") return [["transition-property", "none"], ["transition-duration", "0s"]];
      const s = ie(o, ","), f = s.map((d) => ie(d).find((p) => !/^[\d.]+m?s$/.test(p) && !/^(ease|linear|step|cubic)/.test(p)) ?? "all"), m = s.map((d) => ie(d).find((p) => /^[\d.]+m?s$/.test(p)) ?? "0s");
      return [["transition-property", f.join(", ")], ["transition-duration", m.join(", ")]];
    }
    case "text-decoration":
      return [["text-decoration-line", i()[0] ?? "none"]];
    case "-webkit-user-select":
      return [["user-select", o]];
    case "word-wrap":
      return [["overflow-wrap", o]];
    default:
      return [[n, o]];
  }
}
function U0(n, l) {
  return n ? ie(n, ",").some((o) => {
    let i = o.trim().toLowerCase(), s = !1;
    i.startsWith("not ") && (s = !0, i = i.slice(4)), i.startsWith("only ") && (i = i.slice(5));
    const f = i.split(/\s+and\s+/).every((m) => {
      if (m = m.trim(), m === "all" || m === "screen") return !0;
      if (m === "print") return !1;
      const d = /^\((.+)\)$/.exec(m);
      if (!d) return !1;
      const p = d[1].trim(), y = /^([a-z-]+)\s*:\s*(.+)$/.exec(p);
      if (y) {
        const [, _, x] = y, z = (k) => {
          const b = ss(k, { viewport: l });
          return typeof b == "object" && "px" in b ? b.px : NaN;
        };
        switch (_) {
          case "min-width":
            return l.width >= z(x);
          case "max-width":
            return l.width <= z(x);
          case "min-height":
            return l.height >= z(x);
          case "max-height":
            return l.height <= z(x);
          case "hover":
          case "any-hover":
            return x.trim() === "hover";
          case "pointer":
          case "any-pointer":
            return x.trim() === "fine";
          case "prefers-reduced-motion":
            return x.trim() === "no-preference";
          case "prefers-color-scheme":
            return x.trim() === (l.dark === !1 ? "light" : "dark");
          default:
            return !1;
        }
      }
      const E = /^(width|height)\s*(>=|<=|>|<|=)\s*(.+)$/.exec(p);
      if (E) {
        const _ = E[1] === "width" ? l.width : l.height, x = ss(E[3], { viewport: l }), z = typeof x == "object" && "px" in x ? x.px : NaN;
        switch (E[2]) {
          case ">=":
            return _ >= z;
          case "<=":
            return _ <= z;
          case ">":
            return _ > z;
          case "<":
            return _ < z;
          default:
            return _ === z;
        }
      }
      return !1;
    });
    return s ? !f : f;
  }) : !0;
}
function q0(n, l) {
  const o = l[l.length - 1].compound;
  return _s(o)[0] ?? n;
}
function Y0(n) {
  const l = /* @__PURE__ */ new Set(), o = /* @__PURE__ */ new Set(), i = (s, f) => {
    s.forEach(({ compound: m }, d) => {
      const p = f && d === s.length - 1;
      for (const y of m.pseudos)
        if (Of.has(y.name) && (p ? l : o).add(y.name), y.list && y.name !== "not") for (const E of y.list) i(E, p);
    });
  };
  return i(n, !0), { subject: l, ancestor: o };
}
function _s(n) {
  const l = [...n.classes];
  for (const o of n.pseudos)
    if (!(o.name !== "is" && o.name !== "where"))
      for (const i of o.list) i.length === 1 && l.push(..._s(i[0].compound));
  return l;
}
function G0(n, l) {
  const o = (i, s) => {
    i.forEach(({ compound: f }, m) => {
      const d = s && m === i.length - 1, p = f.pseudos.filter((y) => Of.has(y.name)).map((y) => y.name);
      if (!d) for (const y of p) for (const E of _s(f)) l.add(`${y}:${E}`);
      for (const y of f.pseudos) if (y.list && y.name !== "not") for (const E of y.list) o(E, d);
    });
  };
  o(n, !0);
}
class Q0 {
  constructor(l) {
    this.properties = l.properties ?? {}, this.rules = [], this.skipped = 0, this.index = /* @__PURE__ */ new Map(), this.trackedStates = /* @__PURE__ */ new Set();
    const o = (f, m) => {
      const d = m[m.length - 1].compound, p = d.classes.length ? `.${d.classes[0]}` : d.tag && d.tag !== "*" ? d.tag : "*";
      this.index.has(p) || this.index.set(p, []), this.index.get(p).push(f);
    };
    let i = 0;
    const s = (f, m) => {
      for (const [d, p, y, E] of f)
        for (const _ of vs(d)) {
          let x;
          try {
            x = ys(_);
          } catch (N) {
            if (N instanceof re) {
              this.skipped++;
              continue;
            }
            throw N;
          }
          const z = Y0(x);
          G0(x, this.trackedStates);
          const k = x[x.length - 1].compound.pseudoElement, b = { steps: x, media: p, layer: y, origin: m, order: i++, specificity: wf(x), decls: E, states: z, pseudo: k, source: m === 0 ? `ua:${x[x.length - 1].compound.tag ?? "*"}` : q0(_, x) };
          this.rules.push(b), o(b, x);
        }
    };
    s(A0.map(([f, m]) => [f, null, 0, Object.entries(m)]), 0), s(l.rules, 1);
  }
  /** Rules that may match `element` (by its classes, its tag, and the universal ones), or its `pseudo` box
   * (`before`, `after`). */
  candidates(l, o = null) {
    const i = [], s = /* @__PURE__ */ new Set(), f = (m) => {
      if (m) for (const d of m) !s.has(d) && d.pseudo === o && (s.add(d), i.push(d));
    };
    for (const m of l.classList) f(this.index.get(`.${m}`));
    return f(this.index.get(l.tagName)), f(this.index.get("*")), i;
  }
  /** Whether a rule that may match `element` reads interaction `state` on one of its ancestors (`group-hover:`). */
  readsAncestor(l, o) {
    return this.candidates(l).some((i) => i.states.ancestor.has(o));
  }
  /** Whether `element` carries a class whose interaction state some rule reads on an ancestor. */
  tracks(l, o) {
    for (const i of l.classList) if (this.trackedStates.has(`${o}:${i}`)) return !0;
    return !1;
  }
}
const L0 = /* @__PURE__ */ new Set(["opacity", "z-index", "flex-grow", "flex-shrink", "font-weight", "line-height", "flex", "order", "-webkit-line-clamp", "zoom"]);
function V0(n) {
  if (!n || typeof n != "object") return [];
  const l = [];
  for (const [o, i] of Object.entries(n)) {
    if (i == null || i === "" || typeof i == "boolean") continue;
    const s = o.startsWith("--") ? o : o.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`).replace(/^(webkit|moz|ms)-/, "-$1-"), f = typeof i == "number" && i !== 0 && !L0.has(s) && !s.startsWith("--") ? `${i}px` : String(i);
    l.push([s, f]);
  }
  return l;
}
function K0(n) {
  if (n.tagName !== "svg") return [];
  const l = [];
  for (const o of ["width", "height"]) {
    const i = n.getAttribute(o);
    i !== null && l.push([o, /^[\d.]+$/.test(i) ? `${i}px` : i]);
  }
  return l;
}
const X0 = (n, l) => n.important - l.important || n.origin - l.origin || n.layer - l.layer || n.specificity[0] - l.specificity[0] || n.specificity[1] - l.specificity[1] || n.specificity[2] - l.specificity[2] || n.order - l.order;
class Z0 {
  constructor(l, { theme: o, viewport: i }) {
    this.sheet = l, this.theme = o, this.viewport = i, this.parsed = /* @__PURE__ */ new Map(), this.computed = /* @__PURE__ */ new WeakMap(), this.rootComputed = /* @__PURE__ */ new Map();
  }
  themeHex(l) {
    return this.theme?.[l] ?? null;
  }
  /** Rules matching `element`; `assume` is the set of interaction states assumed on the element itself
   * (`"*"`: any, for finding variant rules). Ancestors use their real state. */
  matching(l, o, i = null) {
    const s = (f, m, d) => {
      if (m === "disabled") return !!f.props?.disabled && ["button", "input", "select", "textarea", "fieldset"].includes(f.tagName);
      if (m === "enabled") return !f.props?.disabled && ["button", "input", "select", "textarea"].includes(f.tagName);
      if (m === "checked") return !!f.props?.checked;
      if (o === "*") return !0;
      if (m === "focus-within") {
        const p = f.ownerDocument?.activeElement;
        return !!p && p !== f.ownerDocument.body && typeof f.contains == "function" && f.contains(p);
      }
      return d ? o.has(m) : m === "focus-visible" ? !!f.state?.focus && !f.state?.pointerFocus : !!f.state?.[m];
    };
    return this.sheet.candidates(l, i).filter((f) => (!f.media || f.media.every((m) => U0(m, this.viewport))) && Sf(l, f.steps, { state: s, pseudo: i }));
  }
  /** `element`'s computed style, or with `pseudo` (`before`, `after`) that of its pseudo-element's box, whose parent
   * is the element (pass the element's own computed style as `parent`). */
  compute(l, o, i = /* @__PURE__ */ new Set(), s = null) {
    const f = this.matching(l, i, s), m = s ? [] : K0(l), d = s ? [] : V0(l.inlineStyle ?? l.props?.style);
    let p = this.rootComputed;
    o && (p = this.computed.get(o.values), p || this.computed.set(o.values, p = /* @__PURE__ */ new Map()));
    const y = `${f.map((_) => _.order).join(",")}|${m.length ? JSON.stringify(m) : ""}|${d.length ? JSON.stringify(d) : ""}`;
    let E = p.get(y);
    return E || p.set(y, E = this.cascade(f, m, d, o)), { ...E, rules: f, element: l };
  }
  /** The computed style from the matched `rules`, presentational `attrs`, `inline` declarations and the parent's. */
  cascade(l, o, i, s) {
    const f = [];
    for (const h of l)
      for (const [v, w, S] of h.decls) f.push({ prop: v, value: w, important: S ? 1 : 0, origin: h.origin === 0 ? 0 : 2, layer: h.layer, specificity: h.specificity, order: h.order, source: h.source });
    for (const [h, v] of o) f.push({ prop: h, value: v, important: 0, origin: 1, layer: 0, specificity: [0, 0, 0], order: 0, source: `attr:${h}` });
    for (const [h, v] of i) f.push({ prop: h, value: v, important: 0, origin: 3, layer: 0, specificity: [1, 0, 0], order: 0, source: "style" });
    f.sort(X0);
    const m = this.sheet.properties, d = Object.create(s?.customs ?? null), p = /* @__PURE__ */ new Map(), y = /* @__PURE__ */ new Map();
    for (const h of f) h.prop.startsWith("--") && y.set(h.prop, h.value);
    if (!s && this.theme) for (const h of jf) this.theme[h] && y.set(`--${h}`, `perchtoken(${h})`);
    const E = (h) => {
      if (p.has(h)) return p.get(h);
      const v = m[h];
      return v && !v.inherits ? v.initial ?? null : h in d ? d[h] : v?.initial ?? null;
    }, _ = /* @__PURE__ */ new Set(), x = (h) => {
      if (!y.has(h)) return E(h);
      if (_.has(h)) return null;
      _.add(h);
      const v = os(y.get(h), x);
      return _.delete(h), y.delete(h), p.set(h, v), (!m[h] || m[h].inherits) && (d[h] = v), v;
    };
    for (const h of [...y.keys()]) x(h);
    const z = /* @__PURE__ */ new Map();
    for (const h of f) {
      if (h.prop.startsWith("--")) continue;
      const v = os(h.value, E);
      if (v === null) {
        for (const [w] of cs(h.prop, "unset")) z.set(w, { value: "unset", source: h.source, origin: h.origin });
        continue;
      }
      for (const [w, S] of cs(h.prop, v)) z.set(w, { value: S, source: h.source, origin: h.origin });
    }
    const k = {}, b = {}, N = /* @__PURE__ */ new Set(), j = /* @__PURE__ */ new Set(), R = s?.values, A = { fontSize: R?.["font-size"] ?? rs, viewport: this.viewport }, K = (h, v) => {
      if (/currentcolor/i.test(v)) return this.parseValue(h, v, A, k, R);
      const w = `${h}\0${v}\0${A.fontSize}`;
      let S = this.parsed.get(w);
      return S === void 0 && this.parsed.set(w, S = this.parseValue(h, v, A, k, R)), S;
    }, H = z.size ? [...is, ...[...z.keys()].filter((h) => !O0.has(h))] : is;
    for (const h of H) {
      const v = z.get(h);
      let w = v?.value;
      const S = j0.has(h);
      if ((w === void 0 || w === "unset" || w === "revert" || w === "revert-layer") && (w = S ? "inherit" : "initial"), v && (b[h] = v.source, v.origin !== 0 && N.add(h)), w === "inherit" && R && h in R) {
        k[h] = R[h], j.add(h);
        continue;
      }
      (w === "inherit" || w === "initial") && (w = S ? Df[h] : Rf[h]), k[h] = K(h, w), h === "font-size" && (A.fontSize = k["font-size"]);
    }
    for (const h of wl) {
      const v = k[`border-${h}-style`];
      (v === "none" || v === "hidden") && (k[`border-${h}-width`] = { px: 0 });
    }
    k["outline-style"] === "none" && (k["outline-width"] = { px: 0 });
    const D = R?.display;
    return (D === "flex" || D === "inline-flex" || D === "grid" || D === "inline-grid") && k.position !== "absolute" && k.position !== "fixed" && (k.display = Vd(k.display)), (k.position === "absolute" || k.position === "fixed") && (k.display = Vd(k.display)), { values: k, sources: b, own: N, inherited: j, customs: d };
  }
  parseValue(l, o, i, s, f) {
    const m = String(o).trim();
    switch (l) {
      case "font-size": {
        const d = m.toLowerCase(), p = { "xx-small": 9, "x-small": 10, small: 13, medium: 16, large: 18, "x-large": 24, "xx-large": 32 };
        if (p[d]) return p[d];
        if (d === "smaller") return i.fontSize / 1.2;
        if (d === "larger") return i.fontSize * 1.2;
        const y = Yn(d, { fontSize: i.fontSize, viewport: i.viewport });
        return !y || y.num ? i.fontSize : y.px + y.pct / 100 * i.fontSize;
      }
      case "font-weight": {
        const d = m.toLowerCase();
        if (d === "normal") return 400;
        if (d === "bold") return 700;
        if (d === "bolder") return (f?.["font-weight"] ?? 400) >= 600 ? 900 : 700;
        if (d === "lighter") return (f?.["font-weight"] ?? 400) >= 600 ? 400 : 100;
        const p = parseFloat(d);
        return Number.isFinite(p) ? p : 400;
      }
      case "line-height": {
        const d = m.toLowerCase();
        if (d === "normal") return { normal: !0 };
        const p = Yn(d, { fontSize: i.fontSize, viewport: i.viewport });
        return p ? p.unitless ? { factor: p.num } : { px: p.px + p.pct / 100 * i.fontSize } : { normal: !0 };
      }
      case "font-family":
        return m;
      case "opacity":
      case "flex-grow":
      case "flex-shrink": {
        const d = m.endsWith("%") ? parseFloat(m) / 100 : parseFloat(m);
        return Number.isFinite(d) ? d : parseFloat(l === "flex-shrink" || l === "opacity" ? 1 : 0);
      }
      case "color": {
        const d = Zr(m, (p) => this.themeHex(p));
        return d === "currentcolor" || !d ? f?.color ?? { rgba: [0, 0, 0, 1], token: null } : d;
      }
      case "background-color":
      case "border-top-color":
      case "border-right-color":
      case "border-bottom-color":
      case "border-left-color":
      case "outline-color": {
        const d = Zr(m, (p) => this.themeHex(p));
        return d === "currentcolor" ? s.color : d ?? { rgba: [0, 0, 0, 0], token: null, unreadable: m };
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
        return ss(m, i);
      default:
        return m.toLowerCase().startsWith("var(") ? m : /^[a-z-]+$/i.test(m) ? m.toLowerCase() : m;
    }
  }
}
function Vd(n) {
  return n === "inline" || n === "inline-block" || n === "contents" ? "block" : n === "inline-flex" ? "flex" : n === "inline-grid" ? "grid" : n;
}
const Jr = (n) => n && n.rgba ? { value: B0(n.rgba), token: n.token ?? null } : null, J0 = { 9.28: 11, 9.92: 12, 10.4: 12, 10.88: 13, 11: 13, 11.2: 13, 11.52: 13, 12: 15, 12.5: 15, 13: 16, 14: 17, 16: 19 };
function W0(n, l) {
  const o = l?.(n);
  if (Number.isFinite(o)) return o;
  const i = Math.round(n * 100) / 100;
  return J0[i] ?? Math.round(n * 1.2);
}
function kl(n, l) {
  const o = n["line-height"], i = n["font-size"];
  return o.normal ? W0(i, l) : o.factor !== void 0 ? o.factor * i : o.px;
}
const F0 = (n) => ie(n, ",").map((l) => l.trim().replace(/^["']|["']$/g, "")).join(", ");
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
const I0 = "perch-native-description/1", qn = Symbol("display"), Wr = {
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
for (const n of $0) Wr[n] = /^(w|h|min_|max_|top|right|bottom|left)/.test(n) ? "auto" : 0;
Wr.rounded = 0;
const P0 = /* @__PURE__ */ new Set([
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
]), tg = /(-apple-system|blinkmacsystemfont|system-ui|segoe ui|sans-serif|times)/i, eg = /(ui-monospace|sfmono|sf mono|menlo|monospace)/i, ng = (n) => eg.test(n) ? "Menlo" : /^\s*system-ui\s*$/i.test(n ?? "") ? ".AppleSystemUIFont" : tg.test(n) ? ".SystemUIFont" : F0(n).split(",")[0].trim(), ag = {
  click: ["onClick", "onClickCapture"],
  double_click: ["onDoubleClick"],
  context_menu: ["onContextMenu"],
  mouse_down: ["onPointerDown", "onMouseDown", "onPointerDownCapture", "onMouseDownCapture"],
  mouse_up: ["onPointerUp", "onMouseUp", "onPointerCancel"],
  mouse_move: ["onPointerMove", "onMouseMove"],
  key_down: ["onKeyDown", "onKeyUp"],
  focus: ["onFocus", "onBlur"],
  input: ["onChange", "onInput"]
}, Kd = { pointerdown: "mouse_down", mousedown: "mouse_down", click: "click", keydown: "key_down", pointerup: "mouse_up", mouseup: "mouse_up" }, ks = (n) => {
  const l = n.props["data-testid"];
  if (l) return `${n.tagName}[data-testid="${l}"]`;
  if (n.props.id) return `${n.tagName}#${n.props.id}`;
  const o = n.classList.find((s) => !s.includes(":") && !s.includes("[")) ?? n.classList[0];
  if (o) return `${n.tagName}.${o}`;
  const i = n.parentElement;
  return i && i.tagName !== "body" ? `${ks(i)} > ${n.tagName}` : n.tagName;
};
class lg {
  constructor() {
    this.map = /* @__PURE__ */ new Map();
  }
  add(l, o, i, s, f, m = "") {
    const d = `${l}|${o}|${i}|${s}`, p = this.map.get(d);
    if (p) {
      !p.elements.includes(f) && p.elements.length < 4 && p.elements.push(f), p.count++;
      return;
    }
    this.map.set(d, { kind: l, property: o, value: String(i), class: s ?? null, elements: [f], count: 1, ...m ? { note: m } : {} });
  }
  list() {
    return [...this.map.values()].sort((l, o) => l.kind < o.kind ? -1 : l.kind > o.kind ? 1 : l.property < o.property ? -1 : l.property > o.property ? 1 : 0);
  }
}
const mn = (n) => {
  if (n != null) {
    if (typeof n == "string") return n === "auto" || n === "none" || n === "normal" ? "auto" : void 0;
    if ("px" in n) return Math.round(Math.min(Math.max(n.px, -9999), 9999) * 100) / 100;
    if ("pct" in n) return `${Math.round(n.pct * 1e3) / 1e3}%`;
  }
}, rg = /^(text|search|url|email|tel|password|number)$/, ig = 162.13 / 12.8;
function og(n, l) {
  const o = typeof n == "object" && /^min\((.*)\)$/.exec(String(n?.expr ?? "").trim());
  if (!o) return;
  const i = ie(o[1], ",").map((s) => Yn(s.trim(), { fontSize: l })).filter((s) => s && !s.pct && !s.num).map((s) => s.px);
  return i.length ? Math.min(...i) : void 0;
}
function sg(n, l) {
  if (typeof n != "object" || !n?.expr) return !1;
  const o = Yn(n.expr, { fontSize: l["font-size"] }), i = (l["margin-left"]?.px ?? NaN) + (l["margin-right"]?.px ?? NaN);
  return !!o && !o.num && o.pct === 100 && Math.abs(o.px + i) < 0.01;
}
function Bf(n) {
  const l = n.transform;
  if (l && l !== "none") {
    const i = /^\s*translate(X|Y)?\(([^]*)\)\s*$/.exec(l), s = i && ie(i[2], ",").map((f) => f.trim());
    return !s || s.length > (i[1] ? 1 : 2) ? null : i[1] === "X" ? [s[0], "0"] : i[1] === "Y" ? ["0", s[0]] : [s[0], s[1] ?? "0"];
  }
  const o = n.translate;
  if (o && o !== "none") {
    const i = ie(String(o).trim(), " ").filter(Boolean);
    return i.length > 3 || i[2] !== void 0 && Yn(i[2], {})?.px ? null : [i[0], i[1] ?? "0"];
  }
  return [];
}
function Xd(n, l, o, i = !1) {
  const s = n.values, f = Bf(s);
  if (f?.length === 0) return;
  const m = s.transform && s.transform !== "none" ? "transform" : "translate", d = { fontSize: s["font-size"] }, p = (_, x) => {
    const z = Yn(_, d);
    if (!(!z || z.unitless && z.num))
      return z.pct ? typeof x == "number" ? z.px + z.pct / 100 * x : void 0 : z.px;
  }, y = f ? p(f[0], l.w) : void 0, E = f ? p(f[1], l.h) : void 0;
  if (y === void 0 || E === void 0) {
    const _ = !i && f ? f.map((x) => Yn(x, d)) : null;
    if (_?.every((x) => x && !(x.unitless && x.num))) {
      l[Hf] = _.map((x) => [x.px, x.pct ?? 0]);
      return;
    }
    o("unsupported", m, s[m], n.sources[m]);
    return;
  }
  if (i) {
    y && (l.left = y), E && (l.top = E);
    return;
  }
  y && (l.ml = (l.ml ?? 0) + y), E && (l.mt = (l.mt ?? 0) + E);
}
const Hf = Symbol("perch.shift");
function cg(n, l, o) {
  const i = n.ownerDocument, s = i?.measure?.(n) ?? null;
  if (s) {
    const [[m, d], [p, y]] = o, E = m + d / 100 * s.width, _ = p + y / 100 * s.height;
    E && (l.ml = (typeof l.ml == "number" ? l.ml : 0) + E), _ && (l.mt = (typeof l.mt == "number" ? l.mt : 0) + _);
  }
  const f = s ? `${s.width}x${s.height}` : "";
  f === n.shiftSeen ? n.shiftTries = 0 : (n.shiftTries ?? 0) < Nf && i?.retries && (n.shiftSeen = f, n.shiftTries = (n.shiftTries ?? 0) + 1, i.retries.push(() => i.afterCommit?.()));
}
function Yr(n, l, o = null) {
  const i = n.values, s = {}, f = (A) => n.sources[A], m = (A) => n.sources[A] !== void 0, d = i.display;
  d === "none" ? s.display = "hidden" : d === "flex" || d === "inline-flex" ? s.display = "flex" : (d === "grid" || d === "inline-grid") && (s.display = "flex", s.flex_direction = "col", l("approximated", "display", d, f("display"), "one-column flex column"), i["grid-template-columns"] && i["grid-template-columns"] !== "none" && l("unsupported", "grid-template-columns", i["grid-template-columns"], f("grid-template-columns"))), n.element.hidden && (s.display = "hidden");
  const p = s.display === "flex";
  if (p && s.flex_direction !== "col") {
    const A = { row: "row", column: "col", "row-reverse": "row_reverse", "column-reverse": "col_reverse" }[i["flex-direction"]] ?? "row";
    s.flex_direction = A;
  }
  if (p) {
    (i["flex-wrap"] === "wrap" || i["flex-wrap"] === "wrap-reverse") && (s.flex_wrap = "wrap");
    const A = d === "grid" || d === "inline-grid", K = { "flex-start": "start", start: "start", "self-start": "start", "flex-end": "end", end: "end", "self-end": "end", center: "center", baseline: "baseline", "first baseline": "baseline" }[i["align-items"]];
    K && (s.items = K);
    let H = { "flex-start": "start", start: "start", "flex-end": "end", end: "end", center: "center", "space-between": "between", "space-around": "around", "space-evenly": "evenly" }[i["justify-content"]];
    if (A) {
      const v = { center: "center", end: "end", "flex-end": "end", start: "start", "flex-start": "start" }[i["justify-items"]];
      v && (s.items = v), i["align-items"] === "center" && (H = "center");
    }
    H && (s.justify = H);
    const D = mn(i["row-gap"]), h = mn(i["column-gap"]);
    typeof D == "number" && D && (s.gap_y = D), typeof h == "number" && h && !A && (s.gap_x = h);
  }
  i["flex-grow"] && (s.flex_grow = i["flex-grow"]), i["flex-shrink"] !== 1 && (s.flex_shrink = i["flex-shrink"]);
  const y = mn(i["flex-basis"]);
  y !== void 0 && y !== "auto" && (s.flex_basis = y);
  const E = { "flex-start": "start", start: "start", "flex-end": "end", end: "end", center: "center", baseline: "baseline", stretch: "stretch" }[i["align-self"]];
  E && (s.self = E);
  for (const [A, K] of [["w", "width"], ["h", "height"], ["min_w", "min-width"], ["min_h", "min-height"], ["max_w", "max-width"], ["max_h", "max-height"]]) {
    const H = i[K], D = mn(H);
    if (D === void 0 && K === "width" && sg(H, i)) {
      s.self = "stretch", l("approximated", K, H.expr, f(K), "stretched across its parent, inside its margins");
      continue;
    }
    const h = D === void 0 && /^max-/.test(K) ? og(H, i["font-size"]) : void 0;
    if (h !== void 0) {
      s[A] = h, l("approximated", K, H.expr, f(K), "the fixed bound of min()");
      continue;
    }
    if (D === void 0) {
      typeof H == "object" && H.expr ? l("unsupported", K, H.expr, f(K), "no calc() in the engine") : typeof H == "string" && !["auto", "none"].includes(H) && l("unsupported", K, H, f(K));
      continue;
    }
    D !== "auto" && (s[A] = D);
  }
  const _ = ["top", "right", "bottom", "left"];
  for (const A of _) {
    const K = A[0];
    for (const [H, D] of [["p", "padding"], ["m", "margin"]]) {
      const h = i[`${D}-${A}`], v = mn(h);
      if (v === void 0) {
        h?.expr && l("unsupported", `${D}-${A}`, h.expr, f(`${D}-${A}`), "no calc() in the engine");
        continue;
      }
      v !== 0 && (s[`${H}${K}`] = v);
    }
  }
  const x = i.position;
  if (x === "absolute" || x === "fixed") {
    s.position = "absolute", x === "fixed" && l("approximated", "position", "fixed", f("position"), "absolute in the overlay layer");
    for (const A of _) {
      const K = mn(i[A]);
      K !== void 0 && K !== "auto" && (s[A] = K);
    }
    if (x === "fixed" && o && s.w === void 0 && s.right === void 0 && typeof s.left == "number") {
      const A = o.width - s.left - (typeof s.ml == "number" ? s.ml : 0) - (typeof s.mr == "number" ? s.mr : 0);
      s.max_w = typeof s.max_w == "number" ? Math.min(s.max_w, A) : A;
    }
    Xd(n, s, l);
  } else x === "sticky" ? l("unsupported", "position", "sticky", f("position")) : Bf(i)?.length !== 0 && (s.position = "relative", Xd(n, s, l, !0));
  i["z-index"] !== "auto" && m("z-index") && l("unsupported", "z-index", i["z-index"], f("z-index"), "paint order is tree order");
  for (const [A, K] of [["overflow_x", "overflow-x"], ["overflow_y", "overflow-y"]]) {
    const H = i[K];
    H === "hidden" || H === "clip" ? s[A] = "hidden" : (H === "auto" || H === "scroll") && (s[A] = "scroll");
  }
  (i.visibility === "hidden" || i.visibility === "collapse") && (s.visibility = "invisible");
  const z = i["background-color"];
  z?.unreadable ? l("unsupported", "background-color", z.unreadable, f("background-color")) : z?.rgba && z.rgba[3] > 0 && (s.bg = Jr(z)), i["background-image"] && i["background-image"] !== "none" && l("unsupported", "background-image", i["background-image"], f("background-image"));
  const k = _.map((A) => mn(i[`border-${A}-width`]) || 0), b = [];
  _.forEach((A, K) => {
    if (!k[K]) return;
    s[`border_${A[0]}`] = k[K];
    const H = i[`border-${A}-style`];
    H !== "solid" && l("approximated", `border-${A}-style`, H, f(`border-${A}-style`), "drawn solid");
    const D = Jr(i[`border-${A}-color`]);
    D && b.push(D);
  }), b.length && (s.border_color = b[0], b.some((A) => A.value !== b[0].value) && l("approximated", "border-color", b.map((A) => A.value).join(" "), f("border-top-color"), "one border colour"));
  const N = (A) => {
    const K = mn(i[`border-${A}-radius`]) || 0;
    if (typeof K != "string") return K;
    const H = parseFloat(K) / 100, D = [s.w, s.h].filter((h) => typeof h == "number");
    return K === "auto" || !(H > 0) ? 0 : D.length ? Math.round(Math.min(H, 0.5) * Math.min(...D) * 100) / 100 : 9999;
  }, j = ["top-left", "top-right", "bottom-right", "bottom-left"].map(N);
  j.every((A) => A === j[0]) ? j[0] && (s.rounded = j[0]) : ["tl", "tr", "br", "bl"].forEach((A, K) => {
    j[K] && (s[`rounded_${A}`] = j[K]);
  }), i.opacity !== 1 && (s.opacity = Math.round(i.opacity * 1e3) / 1e3);
  const R = i["box-shadow"];
  if (R && R !== "none" && ie(R, ",").some((A) => !/^0(px)?\s+0(px)?\s+(0(px)?\s+)?(0(px)?\s+)?(#0000|transparent|rgba?\(0,\s*0,\s*0,\s*0\))/.test(A.trim())) && (s.shadow = "lg", l("approximated", "box-shadow", R, f("box-shadow"), "the engine's large shadow preset")), i.cursor && i.cursor !== "auto" && !n.inherited.has("cursor")) {
    const A = { pointer: "pointer", default: "default", text: "text", move: "move", "not-allowed": "not_allowed", grab: "move", grabbing: "move" }[i.cursor];
    A ? s.cursor = A : l("unsupported", "cursor", i.cursor, f("cursor"));
  }
  return i["text-overflow"] === "ellipsis" && (s.text_ellipsis = !0), i["text-decoration-line"] === "underline" ? s.underline = !0 : i["text-decoration-line"] && i["text-decoration-line"] !== "none" && l("unsupported", "text-decoration-line", i["text-decoration-line"], f("text-decoration-line")), s;
}
const ug = { "tabular-nums": "tnum", "proportional-nums": "pnum", "lining-nums": "lnum", "oldstyle-nums": "onum", "slashed-zero": "zero", "diagonal-fractions": "frac", "stacked-fractions": "afrc", ordinal: "ordn" };
function Uf(n) {
  if (!n || n === "normal") return "";
  const l = String(n).trim().split(/\s+/).map((o) => ug[o]);
  return l.every(Boolean) ? l.join(",") : null;
}
function Gr(n, l) {
  const o = n.values, i = o["line-height"];
  return {
    text_color: Jr(o.color),
    text_size: Math.round(o["font-size"] * 1e3) / 1e3,
    font_features: Uf(o["font-variant-numeric"]) ?? "",
    font_weight: o["font-weight"],
    line_height: i.factor !== void 0 ? { factor: i.factor } : { px: Math.round(kl(o, l) * 1e3) / 1e3 },
    font_family: ng(o["font-family"]),
    italic: o["font-style"] === "italic" || o["font-style"] === "oblique",
    whitespace: o["white-space"] === "nowrap" || o["white-space"] === "pre" ? "nowrap" : "normal",
    text_align: { center: "center", right: "right", end: "right" }[o["text-align"]] ?? "left"
  };
}
const Zd = (n, l) => n.factor !== void 0 ? n.factor * l : n.px, qf = (n, l) => JSON.stringify(n) === JSON.stringify(l);
function Qr(n, l, o) {
  const i = {}, s = (d, p) => p.some((y) => !n.inherited.has(y));
  for (const [d, p] of [["text_color", ["color"]], ["text_size", ["font-size"]], ["font_weight", ["font-weight"]], ["font_family", ["font-family"]], ["italic", ["font-style"]], ["whitespace", ["white-space"]], ["text_align", ["text-align"]], ["font_features", ["font-variant-numeric"]]])
    (s(d, p) || !qf(l[d], o[d])) && (i[d] = l[d]);
  const f = Zd(l.line_height, l.text_size), m = o.line_height ? Zd(o.line_height, l.text_size) : NaN;
  return (s("line_height", ["line-height"]) || !(Math.abs(f - m) <= 1e-3)) && (i.line_height = l.line_height), i;
}
const dg = (n, l) => ({ ...n, ...l });
function Lr(n, l) {
  const o = {};
  for (const [i, s] of Object.entries(n))
    s && typeof s == "object" && "value" in s ? (o[i] = s.value, s.token && (l[i] = s.token)) : i === "line_height" ? o[i] = s.factor !== void 0 ? Math.round(s.factor * 1e3) / 1e3 : `${s.px}px` : i === "italic" ? s && (o.italic = !0) : o[i] = s;
  return o.italic === !1 && delete o.italic, o;
}
function Jd(n, l) {
  const o = {};
  for (const i of /* @__PURE__ */ new Set([...Object.keys(n), ...Object.keys(l)])) {
    const s = n[i], f = l[i];
    qf(s, f) || (o[i] = f === void 0 ? i in Wr ? Wr[i] : null : f);
  }
  return o;
}
function Wd(n, l) {
  const o = n.values;
  for (const [i, s] of Object.entries(n.sources)) {
    if (i.startsWith("--") || P0.has(i) || s.startsWith("ua:")) continue;
    const f = o[i];
    switch (i) {
      case "letter-spacing":
        f !== "normal" && f?.px !== 0 && l("approximated", i, f?.px !== void 0 ? `${Math.round(f.px * 1e3) / 1e3}px` : f, s, f?.px < 0 ? "the run's box is as wide as with the spacing (the glyphs reach past it; where the element clips, the run is drawn smaller to fit)" : "the run is as wide as with the spacing (room after it), the letters are not spread");
        break;
      case "font-variant-numeric":
        f !== "normal" && Uf(f) === null && l("unsupported", i, f, s);
        break;
      case "text-transform":
        f !== "none" && l("approximated", i, f, s, "applied to the text in JS");
        break;
      case "transition-property":
      case "transition-duration": {
        const m = o["transition-duration"];
        i === "transition-property" && m && ie(m, ",").some((d) => parseFloat(d) > 0) && o["transition-property"] !== "none" && l("unsupported", "transition", `${o["transition-property"]} ${m}`, s, "changes are instant (the engine animates only opacity and size)");
        break;
      }
      case "-webkit-line-clamp":
        f !== "none" && l("unsupported", i, f, s, "no line clamp in the engine");
        break;
      case "-webkit-box-orient":
      case "overflow-wrap":
        i === "overflow-wrap" && f !== "normal" && l("approximated", i, f, s, "lines broken by the translator where the box's width is known (`break_anywhere`)");
        break;
      case "outline-style":
      case "outline-width":
      case "outline-color":
        o["outline-style"] !== "none" && i === "outline-style" && l("unsupported", "outline", `${mn(o["outline-width"])}px ${o["outline-style"]} ${Jr(o["outline-color"])?.value ?? ""}`.trim(), s, "no outline in the engine (no focus ring)");
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
        f && f !== "none" && f !== "auto" && f !== "normal" && f !== "initial" && l("unsupported", i, f, s);
        break;
    }
  }
}
function fg(n, l, o, i) {
  const s = ks(n), f = [], m = (j, R, A, K, H) => f.push([j, R, A, K ?? "(user agent)", s, H]), d = i.cascade.compute(n, l), p = {}, y = Yr(d, m, i.viewport), E = y[Hf];
  Wd(d, m);
  const _ = Gr(d, i.measure), x = Qr(d, _, o), z = Lr({ ...y, ...x }, p), k = {}, b = i.cascade.matching(n, "*").filter((j) => j.states.subject.size);
  for (const [j, R] of [["hover", ["hover"]], ["focus", ["focus", "focus-visible"]], ["active", ["active", "hover"]]]) {
    if (!b.some((h) => R.some((v) => h.states.subject.has(v)))) continue;
    const A = i.cascade.compute(n, l, new Set(R)), K = {}, H = Lr({ ...Yr(A, () => {
    }), ...Qr(A, Gr(A, i.measure), o) }, K);
    j === "focus" && Wd(A, m);
    const D = Jd(z, H);
    if (Object.keys(D).length) {
      k[j] = D;
      const h = Object.fromEntries(Object.entries(K).filter(([v]) => v in D));
      Object.keys(h).length && (k[`${j}_tokens`] = h);
    }
  }
  if (i.cascade.sheet.tracks(n, "hover") && (k.group = Fd(n), k.track_hover = !0), i.cascade.sheet.readsAncestor(n, "hover"))
    for (let j = n.parentNode; j?.state; j = j.parentNode) {
      if (!i.cascade.sheet.tracks(j, "hover")) continue;
      const R = j.state.hover;
      j.state.hover = !0;
      let A;
      try {
        A = i.cascade.compute(n, l);
      } finally {
        j.state.hover = R;
      }
      const K = {}, H = Lr({ ...Yr(A, () => {
      }), ...Qr(A, Gr(A, i.measure), o) }, K), D = Jd(z, H);
      if (!Object.keys(D).length) continue;
      const h = Object.fromEntries(Object.entries(K).filter(([v]) => v in D));
      (k.group_hover ??= []).push({ group: Fd(j), style: D, ...Object.keys(h).length ? { tokens: h } : {} });
    }
  if (/tabular/.test(String(d.values["font-variant-numeric"] ?? "")) && (k.tabular = !0), /^(anywhere|break-word)$/.test(String(d.values["overflow-wrap"] ?? "")) && (k.break_anywhere = !0), y.overflow_y === "scroll") {
    const j = Number.parseFloat(d.customs?.["--scrollbar-size"] ?? "");
    j > 0 && (k.scrollbar = j);
  }
  d.values["pointer-events"] !== "none" && l?.values["pointer-events"] === "none" && (k.blocks_pointer = !0), d.values["pointer-events"] === "none" && (k.pointer_none = !0);
  const N = Object.entries(ag).filter(([, j]) => j.some((R) => typeof n.props[R] == "function")).map(([j]) => j);
  return !N.includes("click") && ls(n) && N.push("click"), N.length && (k.events = N), { computed: d, style: z, tokens: p, extra: k, meta: yg(n), reports: f, childText: dg(o, x), where: s, shift: E };
}
function mg(n, l, o, i) {
  const s = { before: null, after: null };
  for (const f of ["before", "after"]) {
    if (!i.cascade.matching(n, /* @__PURE__ */ new Set(), f).length) continue;
    const m = i.cascade.compute(n, l, /* @__PURE__ */ new Set(), f), d = String(m.values.content ?? "none").trim();
    if (d === "none" || d === "normal") continue;
    const p = /^(["'])(.*)\1$/.exec(d)?.[2] ?? "", y = (k, b, N, j, R) => i.findings.add(k, b, N, j ?? "(user agent)", `${ks(n)}::${f}`, R), E = {}, _ = Yr(m, y, i.viewport), z = { kind: "div", style: Lr({ ..._, ...Qr(m, Gr(m, i.measure), o) }, E), tokens: E, children: p ? [{ kind: "text", text: p }] : [] };
    Object.defineProperty(z, qn, { value: m.values.display }), s[f] = z;
  }
  return s;
}
const Fd = (n) => `~g${n.id}`, pg = ["pt", "pr", "pb", "pl", "mt", "mr", "mb", "ml", "border_t", "border_r", "border_b", "border_l", "bg"];
function hg(n) {
  return n.kind === "div" && n[qn] === "inline" && !n.events?.length && !n.meta?.attrs?.["data-testid"] && !pg.some((l) => n.style?.[l]) && n.children?.every((l) => l.kind === "text");
}
function Yf(n, l, o, i, s = "") {
  const f = `${s}/${n.id}.${n.version}`;
  let m = i.cache.get(n);
  (!m || m.key !== f) && i.cache.set(n, m = { key: f, part: fg(n, l, o, i) });
  const { computed: d, tokens: p, extra: y, reports: E, childText: _, where: x } = m.part;
  for (const w of E) i.findings.add(...w);
  const z = (w, S, T, B, L) => i.findings.add(w, S, T, B, x, L), k = { ...m.part.style };
  m.part.shift && cg(n, k, m.part.shift);
  const b = { kind: "div", id: n.id, style: k, tokens: p, meta: m.part.meta, ...y };
  Object.defineProperty(b, qn, { value: d.values.display }), n.measured && n.ownerDocument?.measureKey && (b.measure = n.ownerDocument.measureKey(n));
  const N = n.tagName;
  if (n.props["data-perch-engine"] != null)
    return b.kind = "engine", b.engine = String(n.props["data-perch-engine"]), b.key = String(n.props["data-perch-key"] ?? ""), b;
  if (N === "svg")
    return b.kind = n.props["data-perch-image"] ? "image" : "svg", b.markup = wg(n), b;
  if (N === "input" || N === "textarea" || N === "select") {
    b.kind = "input", b.input_type = N === "input" ? String(n.props.type ?? "text") : N;
    for (const T of ["placeholder", "checked", "disabled"]) n.props[T] !== void 0 && (b[T] = n.props[T]);
    if (/^(checkbox|radio)$/.test(b.input_type) && (b.checked = n.checked), N !== "select" && (b.value = n.value), N === "input" && rg.test(b.input_type) && (b.field_w = ig * d.values["font-size"]), N === "textarea" && k.h === void 0) {
      const T = d.values, B = (et) => et && typeof et == "object" && "px" in et ? et.px : 0, L = (et) => T[`border-${et}-style`] === "none" ? 0 : B(T[`border-${et}-width`]), $ = Number(n.props.rows) > 0 ? Math.floor(Number(n.props.rows)) : 2;
      k.h = $ * kl(T, i.measure) + B(T["padding-top"]) + B(T["padding-bottom"]) + L("top") + L("bottom");
    }
    const { before: w, after: S } = mg(n, d, _, i);
    return (w || S) && (b.children = [w, S].filter(Boolean)), b;
  }
  if (N === "img") {
    b.kind = "image", b.src = n.props.src ?? null;
    for (const [w, S] of [["width", "w"], ["height", "h"]]) {
      const T = Number(n.props[w]);
      k[S] === void 0 && n.props[w] != null && Number.isFinite(T) && (k[S] = T);
    }
    return b;
  }
  const j = d.values["text-transform"], R = [];
  let A = !1, K = !1;
  for (const w of n.childNodes) {
    if (w instanceof ai) {
      if (w.hidden || w.data === "") continue;
      A = !0;
      const B = R[R.length - 1];
      if (B?.kind === "text")
        B.source = (B.source ?? B.text) + w.data, B.text = Id(B.source, j), B.text === B.source && delete B.source;
      else {
        const L = Id(w.data, j);
        R.push(L === w.data ? { kind: "text", text: L } : { kind: "text", text: L, source: w.data });
      }
      continue;
    }
    if (!(w instanceof $t)) continue;
    const S = Yf(w, d, _, i, f), T = S[qn];
    T === "inline" || T === "inline-block" || T === "inline-flex" ? A = !0 : T !== "none" && (K = !0), R.push(S);
  }
  if (/(^|\s)inline-flex(\s|$)/.test(String(n.props?.className ?? "")) && k.w === void 0)
    for (const w of R)
      w.style?.flex_grow && w.style.min_w === 0 && w.style.overflow_x === "hidden" && (delete w.style.min_w, delete w.style.flex_grow, delete w.style.flex_basis, delete w.style.overflow_x, delete w.style.overflow_y);
  if (!k.display && A && R.some((w) => w.kind !== "text") && R.every((w) => w.kind === "text" || hg(w))) {
    const w = R.map((S) => S.kind === "text" ? S.text : S.children.map((T) => T.text).join("")).join("");
    z("approximated", "display", "inline text elements in a line of text", "(inline formatting)", "their text joined to the line, in its font"), R.splice(0, R.length, { kind: "text", text: w });
  }
  const H = R.some((w) => w.kind !== "text"), D = R.length === 1 && R[0].kind !== "text" && /^inline-(block|flex)$/.test(R[0][qn]) ? R[0] : null;
  if (!k.display && D) {
    const w = i.cache.get(n.childNodes.find((T) => T.id === D.id))?.part.computed, S = w ? Ir(d.values, i.measure) - vg(w.values, i.measure, D) : 0;
    k.display = "flex", k.flex_direction = "col", k.items = "start", S > 0 && (D.style.mt = Math.round(((D.style.mt ?? 0) + S) * 100) / 100), z("approximated", "display", `${d.values.display} holding one ${D[qn]} box`, "(inline formatting)", "a column, the box lowered to the line's baseline");
  } else if (!k.display && R.length === 1 && (R[0].kind === "svg" || R[0].kind === "image") && R[0][qn] === "inline" && typeof R[0].style.h == "number") {
    const w = R[0], S = Ir(d.values, i.measure), T = kl(d.values, i.measure) - S, B = (L) => Math.round(L * 100) / 100;
    k.display = "flex", k.flex_direction = "col", k.items = "start", S > w.style.h && (w.style.mt = B((w.style.mt ?? 0) + S - w.style.h)), T > 0 && (w.style.mb = B((w.style.mb ?? 0) + T)), z("approximated", "display", `${d.values.display} holding one inline image`, "(inline formatting)", "a column, the image on the line's baseline");
  } else if (!k.display && A && H) {
    if (k.display = "flex", k.flex_direction = K ? "col" : "row", !K) k.items = "baseline";
    else for (const w of R) w.kind !== "text" && /^inline-(block|flex)$/.test(w[qn]) && !w.style.self && (w.style.self = "start");
    z("approximated", "display", `${d.values.display} with inline content`, "(inline formatting)", K ? "a column of its children" : "a row on the text baseline");
  }
  const h = d.values["letter-spacing"]?.px, v = d.values["overflow-x"] !== "visible";
  if (h)
    for (let w = 0; w < R.length; w++) {
      const S = R[w];
      if (S.kind !== "text") continue;
      const T = Math.round(h * [...S.text].length * 1e3) / 1e3;
      if (h > 0 || !v) {
        R[w] = { kind: "div", style: { pr: T }, tokens: {}, children: [S] };
        continue;
      }
      const B = d.values["font-size"], L = Math.max(0.8, 1 + h / (0.55 * B)), $ = Math.round(kl(d.values, i.measure) * 1e3) / 1e3;
      R[w] = { kind: "div", style: { text_size: Math.round(B * L * 1e3) / 1e3, line_height: `${$}px` }, tokens: {}, children: [S] };
    }
  return b.children = R, b;
}
function gg(n, l) {
  if (!l) return null;
  let i = (l.self ? n : l.closest ? Ef(n, l.closest) : l.find ? El(n, l.find)[0] : null)?.getAttribute(l.attr) ?? null;
  return i && l.strip && i.startsWith(l.strip) && (i = i.slice(l.strip.length)), i;
}
function bg(n, l, o) {
  const i = l.map((m) => [m, ni(m.selector)]), s = /* @__PURE__ */ new Map(), f = (m) => {
    for (const d of m.children) {
      const p = o.get(d.id);
      if (p)
        for (const [y, E] of i) {
          const _ = y.textRange ? "range_name" : "name";
          if (y.textRange && p[_] != null || !E.some((b) => Sf(d, b))) continue;
          const x = gg(d, y.key), z = x == null ? s.get(y.name) ?? 0 : 0;
          x == null && s.set(y.name, z + 1);
          const k = x != null ? `${y.name}:${x}` : z ? `${y.name}@${z}` : y.name;
          p[_] == null ? p[_] = k : (p.also ??= []).push(k);
        }
      f(d);
    }
  };
  f(n.documentElement);
}
const Fr = 0.9521, Gf = 0.2256, Ir = (n, l) => (kl(n, l) - (Fr + Gf) * n["font-size"]) / 2 + Fr * n["font-size"];
function vg(n, l, o) {
  const i = (p) => p && typeof p == "object" && "px" in p ? p.px : 0, s = n["border-top-style"] === "none" ? 0 : i(n["border-top-width"]), f = o?.children ?? [], m = f.length === 1 && (f[0].kind === "svg" || f[0].kind === "image") && typeof f[0].style.h == "number" ? f[0] : null, d = m ? Math.max(Ir(n, l), (m.style.mt ?? 0) + m.style.h) : Ir(n, l);
  return i(n["padding-top"]) + s + d;
}
const Id = (n, l) => l === "uppercase" ? n.toUpperCase() : l === "lowercase" ? n.toLowerCase() : l === "capitalize" ? n.replace(/\b\p{L}/gu, (o) => o.toUpperCase()) : n, Qf = /* @__PURE__ */ new Set(["children", "style", "className", "key", "ref", "dangerouslySetInnerHTML"]);
function yg(n) {
  const l = {};
  for (const [o, i] of Object.entries(n.props)) {
    if (Qf.has(o) || typeof i == "function" || i === void 0 || i === null || typeof i == "object") continue;
    const s = o.startsWith("aria-") || o.startsWith("data-");
    if (i === !1 && !s) continue;
    const f = o === "htmlFor" ? "for" : o === "tabIndex" ? "tabindex" : o;
    l[f] = typeof i == "boolean" ? s ? String(i) : "" : String(i);
  }
  return { tag: n.tagName, classes: n.classList, attrs: l };
}
const xg = (n) => n === "className" ? "class" : /^(viewBox|preserveAspectRatio|gradientUnits|gradientTransform|patternUnits|xmlns)$/.test(n) ? n : n.replace(/[A-Z]/g, (l) => `-${l.toLowerCase()}`), $d = (n) => String(n).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
function wg(n) {
  if (n.props["data-perch-markup"]) return String(n.props["data-perch-markup"]);
  const l = (o) => {
    const i = [];
    for (const [f, m] of Object.entries(o.props))
      Qf.has(f) || typeof m == "function" || m === void 0 || m === null || m === !1 || typeof m == "object" || f.startsWith("data-") || f.startsWith("aria-") || f === "focusable" || f === "role" || f === "title" || i.push(`${xg(f)}="${$d(m === !0 ? "" : m)}"`);
    o.tagName === "svg" && !o.props.xmlns && i.unshift('xmlns="http://www.w3.org/2000/svg"');
    const s = o.childNodes.map((f) => f instanceof ai ? $d(f.data) : l(f)).join("");
    return `<${o.tagName}${i.length ? ` ${i.join(" ")}` : ""}>${s}</${o.tagName}>`;
  };
  return l(n);
}
function _g(n) {
  const l = n.theme?.() ?? {}, o = {};
  for (const i of jf) l[i] && (o[i] = l[i]);
  return o;
}
const kg = { font_features: "" };
function Sg(n, l, o, i = {}, s = null) {
  const f = _g(l), m = l.viewport?.() ?? { width: 1e3, height: 800 }, d = JSON.stringify([f, m]);
  (i.look !== d || i.sheet !== o) && Object.assign(i, { look: d, sheet: o, cache: /* @__PURE__ */ new WeakMap(), cascade: new Z0(o, { theme: f, viewport: m }), top: null });
  const { cascade: p, cache: y } = i, E = { cascade: p, cache: y, viewport: m, findings: new lg(), measure: l.lineHeight ? (z) => l.lineHeight(z) : null };
  i.top ??= p.compute(n.body, p.compute(n.documentElement, null));
  const _ = n.body.children.map((z) => Yf(z, i.top, kg, E));
  if (s?.length) {
    const z = /* @__PURE__ */ new Map(), k = (b) => {
      b.id && z.set(b.id, b);
      for (const N of b.children ?? []) k(N);
    };
    _.forEach(k), bg(n, s, z);
  }
  const x = /* @__PURE__ */ new Set();
  for (const z of [n, n.defaultView])
    for (const { type: k } of z?.listeners ?? []) Kd[k] && x.add(Kd[k]);
  return { schema: I0, root: _[0] ?? null, overlays: _.slice(1), document_events: [...x].sort(), unsupported: E.findings.list() };
}
const Eg = { layers: ["properties", "theme", "base", "utilities"], properties: { "--tw-translate-x": { inherits: !1, initial: "0" }, "--tw-translate-y": { inherits: !1, initial: "0" }, "--tw-translate-z": { inherits: !1, initial: "0" }, "--tw-rotate-x": { inherits: !1, initial: null }, "--tw-rotate-y": { inherits: !1, initial: null }, "--tw-rotate-z": { inherits: !1, initial: null }, "--tw-skew-x": { inherits: !1, initial: null }, "--tw-skew-y": { inherits: !1, initial: null }, "--tw-space-y-reverse": { inherits: !1, initial: "0" }, "--tw-border-style": { inherits: !1, initial: "solid" }, "--tw-leading": { inherits: !1, initial: null }, "--tw-font-weight": { inherits: !1, initial: null }, "--tw-tracking": { inherits: !1, initial: null }, "--tw-ordinal": { inherits: !1, initial: null }, "--tw-slashed-zero": { inherits: !1, initial: null }, "--tw-numeric-figure": { inherits: !1, initial: null }, "--tw-numeric-spacing": { inherits: !1, initial: null }, "--tw-numeric-fraction": { inherits: !1, initial: null }, "--tw-shadow": { inherits: !1, initial: "0 0 #0000" }, "--tw-shadow-color": { inherits: !1, initial: null }, "--tw-shadow-alpha": { inherits: !1, initial: "100%" }, "--tw-inset-shadow": { inherits: !1, initial: "0 0 #0000" }, "--tw-inset-shadow-color": { inherits: !1, initial: null }, "--tw-inset-shadow-alpha": { inherits: !1, initial: "100%" }, "--tw-ring-color": { inherits: !1, initial: null }, "--tw-ring-shadow": { inherits: !1, initial: "0 0 #0000" }, "--tw-inset-ring-color": { inherits: !1, initial: null }, "--tw-inset-ring-shadow": { inherits: !1, initial: "0 0 #0000" }, "--tw-ring-inset": { inherits: !1, initial: null }, "--tw-ring-offset-width": { inherits: !1, initial: "0" }, "--tw-ring-offset-color": { inherits: !1, initial: "#fff" }, "--tw-ring-offset-shadow": { inherits: !1, initial: "0 0 #0000" }, "--tw-outline-style": { inherits: !1, initial: "solid" }, "--tw-blur": { inherits: !1, initial: null }, "--tw-brightness": { inherits: !1, initial: null }, "--tw-contrast": { inherits: !1, initial: null }, "--tw-grayscale": { inherits: !1, initial: null }, "--tw-hue-rotate": { inherits: !1, initial: null }, "--tw-invert": { inherits: !1, initial: null }, "--tw-opacity": { inherits: !1, initial: null }, "--tw-saturate": { inherits: !1, initial: null }, "--tw-sepia": { inherits: !1, initial: null }, "--tw-drop-shadow": { inherits: !1, initial: null }, "--tw-drop-shadow-color": { inherits: !1, initial: null }, "--tw-drop-shadow-alpha": { inherits: !1, initial: "100%" }, "--tw-drop-shadow-size": { inherits: !1, initial: null }, "--tw-backdrop-blur": { inherits: !1, initial: null }, "--tw-backdrop-brightness": { inherits: !1, initial: null }, "--tw-backdrop-contrast": { inherits: !1, initial: null }, "--tw-backdrop-grayscale": { inherits: !1, initial: null }, "--tw-backdrop-hue-rotate": { inherits: !1, initial: null }, "--tw-backdrop-invert": { inherits: !1, initial: null }, "--tw-backdrop-opacity": { inherits: !1, initial: null }, "--tw-backdrop-saturate": { inherits: !1, initial: null }, "--tw-backdrop-sepia": { inherits: !1, initial: null }, "--tw-duration": { inherits: !1, initial: null }, "--tw-ease": { inherits: !1, initial: null }, "--tw-content": { inherits: !1, initial: '""' } }, rules: [[":root, :host", null, 2, [["--spacing", ".25rem"], ["--text-xs", ".75rem"], ["--text-xs--line-height", "calc(1 / .75)"], ["--text-sm", ".875rem"], ["--text-sm--line-height", "calc(1.25 / .875)"], ["--font-weight-normal", "400"], ["--font-weight-medium", "500"], ["--font-weight-semibold", "600"], ["--font-weight-bold", "700"], ["--tracking-normal", "0em"], ["--tracking-wide", ".025em"], ["--leading-tight", "1.25"], ["--leading-relaxed", "1.625"], ["--ease-out", "cubic-bezier(0, 0, .2, 1)"], ["--animate-pulse", "pulse 2s cubic-bezier(.4, 0, .6, 1) infinite"], ["--blur-xl", "24px"], ["--default-transition-duration", ".15s"], ["--default-transition-timing-function", "cubic-bezier(.4, 0, .2, 1)"], ["--animate-toast-in", "toast-in .2s cubic-bezier(.22, 1, .36, 1)"], ["--animate-host-pulse", "host-connecting-pulse 1.4s ease-in-out infinite"], ["--animate-drop-zone", "drop-zone-in .14s ease-out, drop-zone-pulse 1.2s ease-in-out .14s infinite"]]], ["::selection", null, 3, [["background", "var(--accent)"], ["color", "var(--panel-bg)"]]], [":where(input, textarea)::placeholder", null, 3, [["color", "var(--subtext-0)"], ["opacity", "1"]]], [":where(button, input, select, textarea)", null, 3, [["border", "0"]]], [':where(button, a[href], select, summary, [role="button"], [role="menuitem"]):focus-visible', null, 3, [["outline", "2px solid var(--accent)"], ["outline-offset", "-2px"]]], ["::-webkit-scrollbar", null, 3, [["width", "var(--scrollbar-size)"], ["height", "var(--scrollbar-size)"]]], ["::-webkit-scrollbar-track", null, 3, [["background", "none"]]], ["::-webkit-scrollbar-corner", null, 3, [["background", "none"]]], ["::-webkit-scrollbar-thumb", null, 3, [["background", "var(--text)"]]], ["::-webkit-scrollbar-thumb", null, 3, [["background", "color-mix(in srgb, var(--text) 20%, transparent)"]]], ["::-webkit-scrollbar-thumb", null, 3, [["border-radius", "var(--scrollbar-size)"]]], ["::-webkit-scrollbar-thumb:hover", null, 3, [["background", "var(--text)"]]], ["::-webkit-scrollbar-thumb:hover", null, 3, [["background", "color-mix(in srgb, var(--text) 40%, transparent)"]]], [".xterm .xterm-scrollable-element > .xterm-scrollbar > .xterm-slider", null, 3, [["border-radius", "var(--scrollbar-size)"]]], [".\\@container, .\\[container-type\\:inline-size\\]", null, 4, [["container-type", "inline-size"]]], [".pointer-events-auto", null, 4, [["pointer-events", "auto"]]], [".pointer-events-none", null, 4, [["pointer-events", "none"]]], [".collapse", null, 4, [["visibility", "collapse"]]], [".invisible", null, 4, [["visibility", "hidden"]]], [".visible", null, 4, [["visibility", "visible"]]], [".sr-only", null, 4, [["clip-path", "inset(50%)"], ["white-space", "nowrap"], ["border-width", "0"], ["width", "1px"], ["height", "1px"], ["margin", "-1px"], ["padding", "0"], ["position", "absolute"], ["overflow", "hidden"]]], [".absolute", null, 4, [["position", "absolute"]]], [".fixed", null, 4, [["position", "fixed"]]], [".relative", null, 4, [["position", "relative"]]], [".static", null, 4, [["position", "static"]]], [".sticky", null, 4, [["position", "sticky"]]], [".inset-0", null, 4, [["inset", "0"]]], [".inset-x-0", null, 4, [["inset-inline", "0"]]], [".inset-x-2", null, 4, [["inset-inline", "calc(var(--spacing) * 2)"]]], [".-top-1", null, 4, [["top", "calc(var(--spacing) * -1)"]]], [".-top-1\\.5", null, 4, [["top", "calc(var(--spacing) * -1.5)"]]], [".top-0", null, 4, [["top", "0"]]], [".top-1", null, 4, [["top", "var(--spacing)"]]], [".top-1\\.5", null, 4, [["top", "calc(var(--spacing) * 1.5)"]]], [".top-1\\/2", null, 4, [["top", "50%"]]], [".top-2", null, 4, [["top", "calc(var(--spacing) * 2)"]]], [".top-4", null, 4, [["top", "calc(var(--spacing) * 4)"]]], [".top-\\[0\\.1rem\\]", null, 4, [["top", ".1rem"]]], [".top-\\[7px\\]", null, 4, [["top", "7px"]]], [".top-\\[max\\(0\\.75rem\\,env\\(safe-area-inset-top\\)\\)\\]", null, 4, [["top", "max(.75rem, env(safe-area-inset-top))"]]], [".top-full", null, 4, [["top", "100%"]]], [".top-px", null, 4, [["top", "1px"]]], [".-right-1", null, 4, [["right", "calc(var(--spacing) * -1)"]]], [".-right-1\\.5", null, 4, [["right", "calc(var(--spacing) * -1.5)"]]], [".right-0", null, 4, [["right", "0"]]], [".right-1", null, 4, [["right", "var(--spacing)"]]], [".right-3", null, 4, [["right", "calc(var(--spacing) * 3)"]]], [".right-4", null, 4, [["right", "calc(var(--spacing) * 4)"]]], [".right-\\[0\\.8rem\\]", null, 4, [["right", ".8rem"]]], [".right-\\[0\\.25rem\\]", null, 4, [["right", ".25rem"]]], [".right-\\[max\\(0\\.75rem\\,env\\(safe-area-inset-right\\)\\)\\]", null, 4, [["right", "max(.75rem, env(safe-area-inset-right))"]]], [".bottom-0", null, 4, [["bottom", "0"]]], [".bottom-2", null, 4, [["bottom", "calc(var(--spacing) * 2)"]]], [".bottom-3", null, 4, [["bottom", "calc(var(--spacing) * 3)"]]], [".bottom-\\[0\\.8rem\\]", null, 4, [["bottom", ".8rem"]]], [".bottom-full", null, 4, [["bottom", "100%"]]], [".-left-8", null, 4, [["left", "calc(var(--spacing) * -8)"]]], [".-left-\\[2px\\]", null, 4, [["left", "-2px"]]], [".left-0", null, 4, [["left", "0"]]], [".left-2", null, 4, [["left", "calc(var(--spacing) * 2)"]]], [".left-\\[0\\.1rem\\]", null, 4, [["left", ".1rem"]]], [".left-\\[max\\(0\\.75rem\\,env\\(safe-area-inset-left\\)\\)\\]", null, 4, [["left", "max(.75rem, env(safe-area-inset-left))"]]], [".left-px", null, 4, [["left", "1px"]]], [".isolate", null, 4, [["isolation", "isolate"]]], [".z-4", null, 4, [["z-index", "4"]]], [".z-5", null, 4, [["z-index", "5"]]], [".z-10", null, 4, [["z-index", "10"]]], [".z-20", null, 4, [["z-index", "20"]]], [".z-30", null, 4, [["z-index", "30"]]], [".z-40", null, 4, [["z-index", "40"]]], [".z-50", null, 4, [["z-index", "50"]]], [".z-\\[2\\]", null, 4, [["z-index", "2"]]], [".z-\\[3\\]", null, 4, [["z-index", "3"]]], [".z-\\[5\\]", null, 4, [["z-index", "5"]]], [".z-\\[1000\\]", null, 4, [["z-index", "1000"]]], [".z-\\[2000\\]", null, 4, [["z-index", "2000"]]], [".z-\\[2100\\]", null, 4, [["z-index", "2100"]]], [".z-\\[2200\\]", null, 4, [["z-index", "2200"]]], [".z-\\[3000\\]", null, 4, [["z-index", "3000"]]], [".z-\\[3100\\]", null, 4, [["z-index", "3100"]]], [".z-\\[4000\\]", null, 4, [["z-index", "4000"]]], [".z-\\[9998\\]", null, 4, [["z-index", "9998"]]], [".z-\\[9999\\]", null, 4, [["z-index", "9999"]]], [".z-\\[10000\\]", null, 4, [["z-index", "10000"]]], [".z-auto", null, 4, [["z-index", "auto"]]], [".order-last", null, 4, [["order", "9999"]]], [".col-\\[1\\/-1\\]", null, 4, [["grid-column", "1 / -1"]]], [".container", null, 4, [["width", "100%"]]], [".container", ["(min-width: 40rem)"], 4, [["max-width", "40rem"]]], [".container", ["(min-width: 48rem)"], 4, [["max-width", "48rem"]]], [".container", ["(min-width: 64rem)"], 4, [["max-width", "64rem"]]], [".container", ["(min-width: 80rem)"], 4, [["max-width", "80rem"]]], [".container", ["(min-width: 96rem)"], 4, [["max-width", "96rem"]]], [".m-0", null, 4, [["margin", "0"]]], [".m-2", null, 4, [["margin", "calc(var(--spacing) * 2)"]]], [".m-\\[0\\.7rem\\]", null, 4, [["margin", ".7rem"]]], [".m-auto", null, 4, [["margin", "auto"]]], [".mx-0", null, 4, [["margin-inline", "0"]]], [".mx-0\\.5", null, 4, [["margin-inline", "calc(var(--spacing) * .5)"]]], [".mx-2", null, 4, [["margin-inline", "calc(var(--spacing) * 2)"]]], [".mx-3", null, 4, [["margin-inline", "calc(var(--spacing) * 3)"]]], [".mx-4", null, 4, [["margin-inline", "calc(var(--spacing) * 4)"]]], [".mx-\\[0\\.3rem\\]", null, 4, [["margin-inline", ".3rem"]]], [".mx-\\[0\\.7rem\\]", null, 4, [["margin-inline", ".7rem"]]], [".mx-\\[0\\.65rem\\]", null, 4, [["margin-inline", ".65rem"]]], [".mx-\\[3px\\]", null, 4, [["margin-inline", "3px"]]], [".mx-\\[11px\\]", null, 4, [["margin-inline", "11px"]]], [".mx-auto", null, 4, [["margin-inline", "auto"]]], [".my-0\\.5", null, 4, [["margin-block", "calc(var(--spacing) * .5)"]]], [".my-1", null, 4, [["margin-block", "var(--spacing)"]]], [".my-2", null, 4, [["margin-block", "calc(var(--spacing) * 2)"]]], [".my-\\[0\\.2rem\\]", null, 4, [["margin-block", ".2rem"]]], [".my-\\[0\\.3rem\\]", null, 4, [["margin-block", ".3rem"]]], [".my-\\[0\\.6rem\\]", null, 4, [["margin-block", ".6rem"]]], [".my-\\[0\\.28rem\\]", null, 4, [["margin-block", ".28rem"]]], [".my-\\[0\\.45rem\\]", null, 4, [["margin-block", ".45rem"]]], [".my-\\[0\\.55rem\\]", null, 4, [["margin-block", ".55rem"]]], [".my-\\[3px\\]", null, 4, [["margin-block", "3px"]]], [".-mt-\\[2px\\]", null, 4, [["margin-top", "-2px"]]], [".mt-0", null, 4, [["margin-top", "0"]]], [".mt-0\\.5", null, 4, [["margin-top", "calc(var(--spacing) * .5)"]]], [".mt-1", null, 4, [["margin-top", "var(--spacing)"]]], [".mt-1\\.5", null, 4, [["margin-top", "calc(var(--spacing) * 1.5)"]]], [".mt-2", null, 4, [["margin-top", "calc(var(--spacing) * 2)"]]], [".mt-3", null, 4, [["margin-top", "calc(var(--spacing) * 3)"]]], [".mt-4", null, 4, [["margin-top", "calc(var(--spacing) * 4)"]]], [".mt-\\[0\\.1rem\\]", null, 4, [["margin-top", ".1rem"]]], [".mt-\\[0\\.2rem\\]", null, 4, [["margin-top", ".2rem"]]], [".mt-\\[0\\.3rem\\]", null, 4, [["margin-top", ".3rem"]]], [".mt-\\[0\\.4rem\\]", null, 4, [["margin-top", ".4rem"]]], [".mt-\\[0\\.5rem\\]", null, 4, [["margin-top", ".5rem"]]], [".mt-\\[0\\.15rem\\]", null, 4, [["margin-top", ".15rem"]]], [".mt-\\[0\\.35rem\\]", null, 4, [["margin-top", ".35rem"]]], [".mr-1", null, 4, [["margin-right", "var(--spacing)"]]], [".mr-1\\.5", null, 4, [["margin-right", "calc(var(--spacing) * 1.5)"]]], [".mr-\\[0\\.3rem\\]", null, 4, [["margin-right", ".3rem"]]], [".mr-\\[0\\.7rem\\]", null, 4, [["margin-right", ".7rem"]]], [".mr-auto", null, 4, [["margin-right", "auto"]]], [".mb-0", null, 4, [["margin-bottom", "0"]]], [".mb-0\\.5", null, 4, [["margin-bottom", "calc(var(--spacing) * .5)"]]], [".mb-1", null, 4, [["margin-bottom", "var(--spacing)"]]], [".mb-2", null, 4, [["margin-bottom", "calc(var(--spacing) * 2)"]]], [".mb-3", null, 4, [["margin-bottom", "calc(var(--spacing) * 3)"]]], [".mb-4", null, 4, [["margin-bottom", "calc(var(--spacing) * 4)"]]], [".mb-8", null, 4, [["margin-bottom", "calc(var(--spacing) * 8)"]]], [".mb-\\[0\\.2rem\\]", null, 4, [["margin-bottom", ".2rem"]]], [".mb-\\[0\\.3rem\\]", null, 4, [["margin-bottom", ".3rem"]]], [".mb-\\[0\\.4rem\\]", null, 4, [["margin-bottom", ".4rem"]]], [".mb-\\[0\\.6rem\\]", null, 4, [["margin-bottom", ".6rem"]]], [".mb-\\[0\\.7rem\\]", null, 4, [["margin-bottom", ".7rem"]]], [".mb-\\[0\\.9rem\\]", null, 4, [["margin-bottom", ".9rem"]]], [".mb-\\[0\\.15rem\\]", null, 4, [["margin-bottom", ".15rem"]]], [".mb-\\[0\\.35rem\\]", null, 4, [["margin-bottom", ".35rem"]]], [".mb-\\[0\\.55rem\\]", null, 4, [["margin-bottom", ".55rem"]]], [".mb-\\[1\\.1rem\\]", null, 4, [["margin-bottom", "1.1rem"]]], [".-ml-0\\.5", null, 4, [["margin-left", "calc(var(--spacing) * -.5)"]]], [".-ml-1", null, 4, [["margin-left", "calc(var(--spacing) * -1)"]]], [".-ml-2", null, 4, [["margin-left", "calc(var(--spacing) * -2)"]]], [".ml-1", null, 4, [["margin-left", "var(--spacing)"]]], [".ml-2", null, 4, [["margin-left", "calc(var(--spacing) * 2)"]]], [".ml-\\[0\\.4rem\\]", null, 4, [["margin-left", ".4rem"]]], [".ml-\\[0\\.5rem\\]", null, 4, [["margin-left", ".5rem"]]], [".ml-\\[0\\.9rem\\]", null, 4, [["margin-left", ".9rem"]]], [".ml-\\[0\\.35rem\\]", null, 4, [["margin-left", ".35rem"]]], [".ml-\\[0\\.55rem\\]", null, 4, [["margin-left", ".55rem"]]], [".ml-\\[1\\.15rem\\]", null, 4, [["margin-left", "1.15rem"]]], [".ml-\\[1\\.45rem\\]", null, 4, [["margin-left", "1.45rem"]]], [".ml-\\[2\\.025rem\\]", null, 4, [["margin-left", "2.025rem"]]], [".ml-\\[2\\.375rem\\]", null, 4, [["margin-left", "2.375rem"]]], [".ml-\\[6\\.1rem\\]", null, 4, [["margin-left", "6.1rem"]]], [".ml-auto", null, 4, [["margin-left", "auto"]]], [".box-border", null, 4, [["box-sizing", "border-box"]]], [".\\!hidden", null, 4, [["display", "none", 1]]], [".\\[display\\:-webkit-box\\]", null, 4, [["display", "-webkit-box"]]], [".\\[display\\:var\\(--pane-grip\\,flex\\)\\]", null, 4, [["display", "var(--pane-grip, flex)"]]], [".block", null, 4, [["display", "block"]]], [".contents", null, 4, [["display", "contents"]]], [".flex", null, 4, [["display", "flex"]]], [".grid", null, 4, [["display", "grid"]]], [".hidden", null, 4, [["display", "none"]]], [".inline", null, 4, [["display", "inline"]]], [".inline-block", null, 4, [["display", "inline-block"]]], [".inline-flex", null, 4, [["display", "inline-flex"]]], [".table", null, 4, [["display", "table"]]], [".size-1", null, 4, [["width", "var(--spacing)"], ["height", "var(--spacing)"]]], [".size-1\\.5", null, 4, [["width", "calc(var(--spacing) * 1.5)"], ["height", "calc(var(--spacing) * 1.5)"]]], [".size-2", null, 4, [["width", "calc(var(--spacing) * 2)"], ["height", "calc(var(--spacing) * 2)"]]], [".size-3", null, 4, [["width", "calc(var(--spacing) * 3)"], ["height", "calc(var(--spacing) * 3)"]]], [".size-5", null, 4, [["width", "calc(var(--spacing) * 5)"], ["height", "calc(var(--spacing) * 5)"]]], [".size-6", null, 4, [["width", "calc(var(--spacing) * 6)"], ["height", "calc(var(--spacing) * 6)"]]], [".size-7", null, 4, [["width", "calc(var(--spacing) * 7)"], ["height", "calc(var(--spacing) * 7)"]]], [".size-8", null, 4, [["width", "calc(var(--spacing) * 8)"], ["height", "calc(var(--spacing) * 8)"]]], [".size-11", null, 4, [["width", "calc(var(--spacing) * 11)"], ["height", "calc(var(--spacing) * 11)"]]], [".size-14", null, 4, [["width", "calc(var(--spacing) * 14)"], ["height", "calc(var(--spacing) * 14)"]]], [".size-\\[0\\.6rem\\]", null, 4, [["width", ".6rem"], ["height", ".6rem"]]], [".size-\\[1\\.2rem\\]", null, 4, [["width", "1.2rem"], ["height", "1.2rem"]]], [".size-\\[5px\\]", null, 4, [["width", "5px"], ["height", "5px"]]], [".size-\\[14px\\]", null, 4, [["width", "14px"], ["height", "14px"]]], [".size-\\[calc\\(14px\\*var\\(--zoom\\,1\\)\\)\\]", null, 4, [["width", "calc(14px * var(--zoom, 1))"], ["height", "calc(14px * var(--zoom, 1))"]]], [".size-full", null, 4, [["width", "100%"], ["height", "100%"]]], [".h-1", null, 4, [["height", "var(--spacing)"]]], [".h-1\\.5", null, 4, [["height", "calc(var(--spacing) * 1.5)"]]], [".h-2", null, 4, [["height", "calc(var(--spacing) * 2)"]]], [".h-3", null, 4, [["height", "calc(var(--spacing) * 3)"]]], [".h-4", null, 4, [["height", "calc(var(--spacing) * 4)"]]], [".h-5", null, 4, [["height", "calc(var(--spacing) * 5)"]]], [".h-6", null, 4, [["height", "calc(var(--spacing) * 6)"]]], [".h-7", null, 4, [["height", "calc(var(--spacing) * 7)"]]], [".h-8", null, 4, [["height", "calc(var(--spacing) * 8)"]]], [".h-9", null, 4, [["height", "calc(var(--spacing) * 9)"]]], [".h-11", null, 4, [["height", "calc(var(--spacing) * 11)"]]], [".h-12", null, 4, [["height", "calc(var(--spacing) * 12)"]]], [".h-44", null, 4, [["height", "calc(var(--spacing) * 44)"]]], [".h-\\[1\\.1rem\\]", null, 4, [["height", "1.1rem"]]], [".h-\\[1\\.3rem\\]", null, 4, [["height", "1.3rem"]]], [".h-\\[1\\.4rem\\]", null, 4, [["height", "1.4rem"]]], [".h-\\[1\\.25rem\\]", null, 4, [["height", "1.25rem"]]], [".h-\\[2px\\]", null, 4, [["height", "2px"]]], [".h-\\[14px\\]", null, 4, [["height", "14px"]]], [".h-\\[18px\\]", null, 4, [["height", "18px"]]], [".h-\\[43px\\]", null, 4, [["height", "43px"]]], [".h-\\[calc\\(100\\%-max\\(0\\.5rem\\,env\\(safe-area-inset-top\\)\\)\\)\\]", null, 4, [["height", "calc(100% - max(.5rem, env(safe-area-inset-top)))"]]], [".h-full", null, 4, [["height", "100%"]]], [".h-px", null, 4, [["height", "1px"]]], [".max-h-40", null, 4, [["max-height", "calc(var(--spacing) * 40)"]]], [".max-h-56", null, 4, [["max-height", "calc(var(--spacing) * 56)"]]], [".max-h-72", null, 4, [["max-height", "calc(var(--spacing) * 72)"]]], [".max-h-\\[8rem\\]", null, 4, [["max-height", "8rem"]]], [".max-h-\\[13rem\\]", null, 4, [["max-height", "13rem"]]], [".max-h-\\[30\\%\\]", null, 4, [["max-height", "30%"]]], [".max-h-\\[30vh\\]", null, 4, [["max-height", "30vh"]]], [".max-h-\\[35vh\\]", null, 4, [["max-height", "35vh"]]], [".max-h-\\[40\\%\\]", null, 4, [["max-height", "40%"]]], [".max-h-\\[50dvh\\]", null, 4, [["max-height", "50dvh"]]], [".max-h-\\[60\\%\\]", null, 4, [["max-height", "60%"]]], [".max-h-\\[70\\%\\]", null, 4, [["max-height", "70%"]]], [".max-h-\\[85vh\\]", null, 4, [["max-height", "85vh"]]], [".max-h-\\[90\\%\\]", null, 4, [["max-height", "90%"]]], [".max-h-\\[190px\\]", null, 4, [["max-height", "190px"]]], [".max-h-\\[240px\\]", null, 4, [["max-height", "240px"]]], [".max-h-\\[260px\\]", null, 4, [["max-height", "260px"]]], [".max-h-\\[calc\\(85vh-4rem\\)\\]", null, 4, [["max-height", "calc(85vh - 4rem)"]]], [".max-h-\\[calc\\(100dvh_-_4rem\\)\\]", null, 4, [["max-height", "calc(100dvh - 4rem)"]]], [".max-h-\\[min\\(420px\\,calc\\(100dvh_-_16vh_-_2rem\\)\\)\\]", null, 4, [["max-height", "min(420px, 100dvh - 16vh - 2rem)"]]], [".max-h-\\[min\\(480px\\,calc\\(100dvh_-_16vh_-_2rem\\)\\)\\]", null, 4, [["max-height", "min(480px, 100dvh - 16vh - 2rem)"]]], [".max-h-full", null, 4, [["max-height", "100%"]]], [".min-h-0", null, 4, [["min-height", "0"]]], [".min-h-6", null, 4, [["min-height", "calc(var(--spacing) * 6)"]]], [".min-h-7", null, 4, [["min-height", "calc(var(--spacing) * 7)"]]], [".min-h-8", null, 4, [["min-height", "calc(var(--spacing) * 8)"]]], [".min-h-9", null, 4, [["min-height", "calc(var(--spacing) * 9)"]]], [".min-h-10", null, 4, [["min-height", "calc(var(--spacing) * 10)"]]], [".min-h-11", null, 4, [["min-height", "calc(var(--spacing) * 11)"]]], [".min-h-20", null, 4, [["min-height", "calc(var(--spacing) * 20)"]]], [".min-h-40", null, 4, [["min-height", "calc(var(--spacing) * 40)"]]], [".min-h-\\[1\\.5em\\]", null, 4, [["min-height", "1.5em"]]], [".min-h-\\[1\\.8rem\\]", null, 4, [["min-height", "1.8rem"]]], [".min-h-\\[2\\.5rem\\]", null, 4, [["min-height", "2.5rem"]]], [".min-h-\\[3\\.2rem\\]", null, 4, [["min-height", "3.2rem"]]], [".min-h-\\[3\\.25rem\\]", null, 4, [["min-height", "3.25rem"]]], [".min-h-\\[6rem\\]", null, 4, [["min-height", "6rem"]]], [".min-h-\\[8rem\\]", null, 4, [["min-height", "8rem"]]], [".min-h-\\[10rem\\]", null, 4, [["min-height", "10rem"]]], [".min-h-\\[12rem\\]", null, 4, [["min-height", "12rem"]]], [".min-h-\\[13rem\\]", null, 4, [["min-height", "13rem"]]], [".min-h-\\[32px\\]", null, 4, [["min-height", "32px"]]], [".min-h-\\[44px\\]", null, 4, [["min-height", "44px"]]], [".min-h-\\[60px\\]", null, 4, [["min-height", "60px"]]], [".min-h-\\[100dvh\\]", null, 4, [["min-height", "100dvh"]]], [".min-h-\\[calc\\(22px\\*var\\(--zoom\\,1\\)\\)\\]", null, 4, [["min-height", "calc(22px * var(--zoom, 1))"]]], [".min-h-full", null, 4, [["min-height", "100%"]]], [".w-2", null, 4, [["width", "calc(var(--spacing) * 2)"]]], [".w-2\\.5", null, 4, [["width", "calc(var(--spacing) * 2.5)"]]], [".w-3", null, 4, [["width", "calc(var(--spacing) * 3)"]]], [".w-4", null, 4, [["width", "calc(var(--spacing) * 4)"]]], [".w-5", null, 4, [["width", "calc(var(--spacing) * 5)"]]], [".w-7", null, 4, [["width", "calc(var(--spacing) * 7)"]]], [".w-8", null, 4, [["width", "calc(var(--spacing) * 8)"]]], [".w-9", null, 4, [["width", "calc(var(--spacing) * 9)"]]], [".w-10", null, 4, [["width", "calc(var(--spacing) * 10)"]]], [".w-20", null, 4, [["width", "calc(var(--spacing) * 20)"]]], [".w-40", null, 4, [["width", "calc(var(--spacing) * 40)"]]], [".w-44", null, 4, [["width", "calc(var(--spacing) * 44)"]]], [".w-\\[1\\.1rem\\]", null, 4, [["width", "1.1rem"]]], [".w-\\[1\\.4rem\\]", null, 4, [["width", "1.4rem"]]], [".w-\\[1\\.6rem\\]", null, 4, [["width", "1.6rem"]]], [".w-\\[1\\.25rem\\]", null, 4, [["width", "1.25rem"]]], [".w-\\[2\\.4rem\\]", null, 4, [["width", "2.4rem"]]], [".w-\\[2\\.25rem\\]", null, 4, [["width", "2.25rem"]]], [".w-\\[6rem\\]", null, 4, [["width", "6rem"]]], [".w-\\[7rem\\]", null, 4, [["width", "7rem"]]], [".w-\\[11rem\\]", null, 4, [["width", "11rem"]]], [".w-\\[15rem\\]", null, 4, [["width", "15rem"]]], [".w-\\[16rem\\]", null, 4, [["width", "16rem"]]], [".w-\\[18px\\]", null, 4, [["width", "18px"]]], [".w-\\[100cqi\\]", null, 4, [["width", "100cqi"]]], [".w-\\[calc\\(\\(100\\%-0\\.875rem\\)\\/8\\)\\]", null, 4, [["width", "calc(12.5% - .109375rem)"]]], [".w-\\[calc\\(100\\%_-_0\\.6rem\\)\\]", null, 4, [["width", "calc(100% - .6rem)"]]], [".w-\\[calc\\(100\\%_-_1rem\\)\\]", null, 4, [["width", "calc(100% - 1rem)"]]], [".w-\\[min\\(22rem\\,calc\\(100vw-3rem\\)\\)\\]", null, 4, [["width", "min(22rem, 100vw - 3rem)"]]], [".w-\\[min\\(26rem\\,100\\%\\)\\]", null, 4, [["width", "min(26rem, 100%)"]]], [".w-\\[min\\(28rem\\,calc\\(100vw-2\\.5rem\\)\\)\\]", null, 4, [["width", "min(28rem, 100vw - 2.5rem)"]]], [".w-\\[min\\(30rem\\,92vw\\)\\]", null, 4, [["width", "min(30rem, 92vw)"]]], [".w-\\[min\\(32rem\\,100\\%\\)\\]", null, 4, [["width", "min(32rem, 100%)"]]], [".w-\\[min\\(340px\\,calc\\(100vw-16px\\)\\)\\]", null, 4, [["width", "min(340px, 100vw - 16px)"]]], [".w-\\[min\\(360px\\,calc\\(100vw_-_2rem\\)\\)\\]", null, 4, [["width", "min(360px, 100vw - 2rem)"]]], [".w-\\[min\\(420px\\,calc\\(100vw_-_16px\\)\\)\\]", null, 4, [["width", "min(420px, 100vw - 16px)"]]], [".w-\\[min\\(480px\\,calc\\(100vw_-_2rem\\)\\)\\]", null, 4, [["width", "min(480px, 100vw - 2rem)"]]], [".w-\\[min\\(560px\\,calc\\(100vw_-_2rem\\)\\)\\]", null, 4, [["width", "min(560px, 100vw - 2rem)"]]], [".w-\\[var\\(--sidebar-width\\,240px\\)\\]", null, 4, [["width", "var(--sidebar-width, 240px)"]]], [".w-\\[var\\(--tools-width\\)\\]", null, 4, [["width", "var(--tools-width)"]]], [".w-auto", null, 4, [["width", "auto"]]], [".w-full", null, 4, [["width", "100%"]]], [".w-px", null, 4, [["width", "1px"]]], [".max-w-24", null, 4, [["max-width", "calc(var(--spacing) * 24)"]]], [".max-w-32", null, 4, [["max-width", "calc(var(--spacing) * 32)"]]], [".max-w-\\[9rem\\]", null, 4, [["max-width", "9rem"]]], [".max-w-\\[10rem\\]", null, 4, [["max-width", "10rem"]]], [".max-w-\\[14rem\\]", null, 4, [["max-width", "14rem"]]], [".max-w-\\[16rem\\]", null, 4, [["max-width", "16rem"]]], [".max-w-\\[24rem\\]", null, 4, [["max-width", "24rem"]]], [".max-w-\\[25\\%\\]", null, 4, [["max-width", "25%"]]], [".max-w-\\[26rem\\]", null, 4, [["max-width", "26rem"]]], [".max-w-\\[28rem\\]", null, 4, [["max-width", "28rem"]]], [".max-w-\\[35\\%\\]", null, 4, [["max-width", "35%"]]], [".max-w-\\[38\\%\\]", null, 4, [["max-width", "38%"]]], [".max-w-\\[45\\%\\]", null, 4, [["max-width", "45%"]]], [".max-w-\\[46rem\\]", null, 4, [["max-width", "46rem"]]], [".max-w-\\[55\\%\\]", null, 4, [["max-width", "55%"]]], [".max-w-\\[56rem\\]", null, 4, [["max-width", "56rem"]]], [".max-w-\\[85\\%\\]", null, 4, [["max-width", "85%"]]], [".max-w-\\[140px\\]", null, 4, [["max-width", "140px"]]], [".max-w-\\[320px\\]", null, 4, [["max-width", "320px"]]], [".max-w-\\[min\\(22rem\\,calc\\(100\\%-1\\.5rem\\)\\)\\]", null, 4, [["max-width", "min(22rem, 100% - 1.5rem)"]]], [".max-w-\\[min\\(30rem\\,calc\\(100\\%-1\\.6rem\\)\\)\\]", null, 4, [["max-width", "min(30rem, 100% - 1.6rem)"]]], [".max-w-\\[min\\(34rem\\,calc\\(100\\%-1\\.5rem\\)\\)\\]", null, 4, [["max-width", "min(34rem, 100% - 1.5rem)"]]], [".max-w-\\[min\\(320px\\,calc\\(100vw_-_24px\\)\\)\\]", null, 4, [["max-width", "min(320px, 100vw - 24px)"]]], [".max-w-full", null, 4, [["max-width", "100%"]]], [".max-w-none", null, 4, [["max-width", "none"]]], [".min-w-0", null, 4, [["min-width", "0"]]], [".min-w-6", null, 4, [["min-width", "calc(var(--spacing) * 6)"]]], [".min-w-8", null, 4, [["min-width", "calc(var(--spacing) * 8)"]]], [".min-w-12", null, 4, [["min-width", "calc(var(--spacing) * 12)"]]], [".min-w-24", null, 4, [["min-width", "calc(var(--spacing) * 24)"]]], [".min-w-36", null, 4, [["min-width", "calc(var(--spacing) * 36)"]]], [".min-w-56", null, 4, [["min-width", "calc(var(--spacing) * 56)"]]], [".min-w-\\[5\\.5rem\\]", null, 4, [["min-width", "5.5rem"]]], [".min-w-\\[7rem\\]", null, 4, [["min-width", "7rem"]]], [".min-w-\\[12rem\\]", null, 4, [["min-width", "12rem"]]], [".min-w-\\[14px\\]", null, 4, [["min-width", "14px"]]], [".min-w-\\[200px\\]", null, 4, [["min-width", "200px"]]], [".min-w-fit", null, 4, [["min-width", "fit-content"]]], [".min-w-max", null, 4, [["min-width", "max-content"]]], [".flex-1", null, 4, [["flex", "1"]]], [".flex-\\[0_0_5rem\\]", null, 4, [["flex", "0 0 5rem"]]], [".flex-\\[0_0_8px\\]", null, 4, [["flex", "0 0 8px"]]], [".flex-\\[0_1_40\\%\\]", null, 4, [["flex", "0 40%"]]], [".flex-\\[1_1_100\\%\\]", null, 4, [["flex", "100%"]]], [".flex-\\[2\\]", null, 4, [["flex", "2"]]], [".flex-initial", null, 4, [["flex", "0 auto"]]], [".flex-none", null, 4, [["flex", "none"]]], [".shrink", null, 4, [["flex-shrink", "1"]]], [".shrink-0", null, 4, [["flex-shrink", "0"]]], [".shrink-\\[0\\.001\\]", null, 4, [["flex-shrink", ".001"]]], [".shrink-\\[2\\]", null, 4, [["flex-shrink", "2"]]], [".shrink-\\[3\\]", null, 4, [["flex-shrink", "3"]]], [".grow", null, 4, [["flex-grow", "1"]]], [".basis-0", null, 4, [["flex-basis", "0"]]], [".basis-\\[14rem\\]", null, 4, [["flex-basis", "14rem"]]], [".-translate-y-1\\/2", null, 4, [["--tw-translate-y", "calc(calc(1 / 2 * 100%) * -1)"], ["translate", "var(--tw-translate-x) var(--tw-translate-y)"]]], [".\\[transform\\:translateY\\(-50\\%\\)\\]", null, 4, [["transform", "translateY(-50%)"]]], [".transform", null, 4, [["transform", "var(--tw-rotate-x, ) var(--tw-rotate-y, ) var(--tw-rotate-z, ) var(--tw-skew-x, ) var(--tw-skew-y, )"]]], [".animate-drop-zone", null, 4, [["animation", "var(--animate-drop-zone)"]]], [".animate-host-pulse", null, 4, [["animation", "var(--animate-host-pulse)"]]], [".animate-pulse", null, 4, [["animation", "var(--animate-pulse)"]]], [".animate-toast-in", null, 4, [["animation", "var(--animate-toast-in)"]]], [".cursor-col-resize", null, 4, [["cursor", "col-resize"]]], [".cursor-default", null, 4, [["cursor", "default"]]], [".cursor-grab", null, 4, [["cursor", "grab"]]], [".cursor-grabbing", null, 4, [["cursor", "grabbing"]]], [".cursor-pointer", null, 4, [["cursor", "pointer"]]], [".cursor-row-resize", null, 4, [["cursor", "row-resize"]]], [".touch-none", null, 4, [["touch-action", "none"]]], [".resize", null, 4, [["resize", "both"]]], [".resize-none", null, 4, [["resize", "none"]]], [".resize-y", null, 4, [["resize", "vertical"]]], [".\\[scrollbar-width\\:none\\]", null, 4, [["scrollbar-width", "none"]]], [".list-disc", null, 4, [["list-style-type", "disc"]]], [".list-none", null, 4, [["list-style-type", "none"]]], [".appearance-none", null, 4, [["appearance", "none"]]], [".grid-cols-8", null, 4, [["grid-template-columns", "repeat(8, minmax(0, 1fr))"]]], [".grid-cols-\\[1fr_auto_1fr\\]", null, 4, [["grid-template-columns", "1fr auto 1fr"]]], [".grid-cols-\\[2\\.5rem_2\\.5rem_0\\.9rem_minmax\\(0\\,1fr\\)\\]", null, 4, [["grid-template-columns", "2.5rem 2.5rem .9rem minmax(0, 1fr)"]]], [".grid-cols-\\[auto_minmax\\(0\\,1fr\\)\\]", null, 4, [["grid-template-columns", "auto minmax(0, 1fr)"]]], [".grid-cols-\\[minmax\\(4rem\\,10rem\\)_1fr_auto\\]", null, 4, [["grid-template-columns", "minmax(4rem, 10rem) 1fr auto"]]], [".grid-cols-\\[repeat\\(2\\,minmax\\(0\\,1fr\\)\\)\\]", null, 4, [["grid-template-columns", "repeat(2, minmax(0, 1fr))"]]], [".grid-cols-\\[repeat\\(auto-fit\\,minmax\\(8rem\\,1fr\\)\\)\\]", null, 4, [["grid-template-columns", "repeat(auto-fit, minmax(8rem, 1fr))"]]], [".flex-col", null, 4, [["flex-direction", "column"]]], [".flex-row", null, 4, [["flex-direction", "row"]]], [".flex-wrap", null, 4, [["flex-wrap", "wrap"]]], [".place-items-center", null, 4, [["place-items", "center"]]], [".content-center", null, 4, [["align-content", "center"]]], [".items-baseline", null, 4, [["align-items", "baseline"]]], [".items-center", null, 4, [["align-items", "center"]]], [".items-end", null, 4, [["align-items", "flex-end"]]], [".items-start", null, 4, [["align-items", "flex-start"]]], [".items-stretch", null, 4, [["align-items", "stretch"]]], [".justify-between", null, 4, [["justify-content", "space-between"]]], [".justify-center", null, 4, [["justify-content", "center"]]], [".justify-end", null, 4, [["justify-content", "flex-end"]]], [".justify-start", null, 4, [["justify-content", "flex-start"]]], [".justify-items-center", null, 4, [["justify-items", "center"]]], [".justify-items-start", null, 4, [["justify-items", "start"]]], [".gap-0", null, 4, [["gap", "0"]]], [".gap-0\\.5", null, 4, [["gap", "calc(var(--spacing) * .5)"]]], [".gap-1", null, 4, [["gap", "var(--spacing)"]]], [".gap-1\\.5", null, 4, [["gap", "calc(var(--spacing) * 1.5)"]]], [".gap-2", null, 4, [["gap", "calc(var(--spacing) * 2)"]]], [".gap-3", null, 4, [["gap", "calc(var(--spacing) * 3)"]]], [".gap-4", null, 4, [["gap", "calc(var(--spacing) * 4)"]]], [".gap-6", null, 4, [["gap", "calc(var(--spacing) * 6)"]]], [".gap-\\[0\\.1rem\\]", null, 4, [["gap", ".1rem"]]], [".gap-\\[0\\.3rem\\]", null, 4, [["gap", ".3rem"]]], [".gap-\\[0\\.4rem\\]", null, 4, [["gap", ".4rem"]]], [".gap-\\[0\\.05rem\\]", null, 4, [["gap", ".05rem"]]], [".gap-\\[0\\.6rem\\]", null, 4, [["gap", ".6rem"]]], [".gap-\\[0\\.8rem\\]", null, 4, [["gap", ".8rem"]]], [".gap-\\[0\\.16rem\\]", null, 4, [["gap", ".16rem"]]], [".gap-\\[0\\.32rem\\]", null, 4, [["gap", ".32rem"]]], [".gap-\\[0\\.35rem\\]", null, 4, [["gap", ".35rem"]]], [".gap-\\[0\\.45rem\\]", null, 4, [["gap", ".45rem"]]], [".gap-\\[0\\.55rem\\]", null, 4, [["gap", ".55rem"]]], [".gap-\\[0\\.65rem\\]", null, 4, [["gap", ".65rem"]]], [".gap-\\[0\\.85rem\\]", null, 4, [["gap", ".85rem"]]], [".gap-\\[1px\\]", null, 4, [["gap", "1px"]]], [".gap-\\[2px\\]", null, 4, [["gap", "2px"]]], [".gap-\\[3px\\]", null, 4, [["gap", "3px"]]], [".gap-\\[7px\\]", null, 4, [["gap", "7px"]]], [".gap-\\[13px\\]", null, 4, [["gap", "13px"]]], [":where(.space-y-0\\.5 > :not(:last-child))", null, 4, [["--tw-space-y-reverse", "0"], ["margin-block-start", "calc(calc(var(--spacing) * .5) * var(--tw-space-y-reverse))"], ["margin-block-end", "calc(calc(var(--spacing) * .5) * calc(1 - var(--tw-space-y-reverse)))"]]], [".gap-x-3", null, 4, [["column-gap", "calc(var(--spacing) * 3)"]]], [".gap-x-4", null, 4, [["column-gap", "calc(var(--spacing) * 4)"]]], [".gap-x-\\[0\\.7rem\\]", null, 4, [["column-gap", ".7rem"]]], [".gap-x-\\[0\\.9rem\\]", null, 4, [["column-gap", ".9rem"]]], [".gap-y-1", null, 4, [["row-gap", "var(--spacing)"]]], [".gap-y-\\[0\\.3rem\\]", null, 4, [["row-gap", ".3rem"]]], [".self-center", null, 4, [["align-self", "center"]]], [".self-end", null, 4, [["align-self", "flex-end"]]], [".self-start", null, 4, [["align-self", "flex-start"]]], [".self-stretch", null, 4, [["align-self", "stretch"]]], [".justify-self-start", null, 4, [["justify-self", "flex-start"]]], [".truncate", null, 4, [["text-overflow", "ellipsis"], ["white-space", "nowrap"], ["overflow", "hidden"]]], [".overflow-auto", null, 4, [["overflow", "auto"]]], [".overflow-hidden", null, 4, [["overflow", "hidden"]]], [".overflow-visible", null, 4, [["overflow", "visible"]]], [".overflow-x-auto", null, 4, [["overflow-x", "auto"]]], [".overflow-y-auto", null, 4, [["overflow-y", "auto"]]], [".overscroll-contain", null, 4, [["overscroll-behavior", "contain"]]], [".rounded, .rounded-\\[0\\.25rem\\]", null, 4, [["border-radius", ".25rem"]]], [".rounded-\\[1\\.5rem\\]", null, 4, [["border-radius", "1.5rem"]]], [".rounded-\\[2px\\]", null, 4, [["border-radius", "2px"]]], [".rounded-\\[3px\\]", null, 4, [["border-radius", "3px"]]], [".rounded-\\[12px\\]", null, 4, [["border-radius", "12px"]]], [".rounded-\\[50\\%\\]", null, 4, [["border-radius", "50%"]]], [".rounded-\\[999px\\]", null, 4, [["border-radius", "999px"]]], [".rounded-\\[calc\\(var\\(--radius\\)\\*2\\)\\]", null, 4, [["border-radius", "calc(var(--radius) * 2)"]]], [".rounded-\\[var\\(--card-radius\\,8px\\)\\]", null, 4, [["border-radius", "var(--card-radius, 8px)"]]], [".rounded-\\[var\\(--card-radius\\,12px\\)\\]", null, 4, [["border-radius", "var(--card-radius, 12px)"]]], [".rounded-full", null, 4, [["border-radius", "3.40282e38px"]]], [".rounded-none", null, 4, [["border-radius", "0"]]], [".rounded-soft", null, 4, [["border-radius", "var(--radius-pane)"]]], [".rounded-ui", null, 4, [["border-radius", "var(--radius)"]]], [".rounded-t-\\[12px\\]", null, 4, [["border-top-left-radius", "12px"], ["border-top-right-radius", "12px"]]], [".rounded-t-none", null, 4, [["border-top-left-radius", "0"], ["border-top-right-radius", "0"]]], [".rounded-bl-\\[6px\\]", null, 4, [["border-bottom-left-radius", "6px"]]], [".border", null, 4, [["border-style", "var(--tw-border-style)"], ["border-width", "1px"]]], [".border-0", null, 4, [["border-style", "var(--tw-border-style)"], ["border-width", "0"]]], [".border-\\[1\\.5px\\]", null, 4, [["border-style", "var(--tw-border-style)"], ["border-width", "1.5px"]]], [".border-b", null, 4, [["border-bottom-style", "var(--tw-border-style)"], ["border-bottom-width", "1px"]]], [".border-l", null, 4, [["border-left-style", "var(--tw-border-style)"], ["border-left-width", "1px"]]], [".border-l-\\[3px\\]", null, 4, [["border-left-style", "var(--tw-border-style)"], ["border-left-width", "3px"]]], [".border-solid", null, 4, [["--tw-border-style", "solid"], ["border-style", "solid"]]], [".border-accent", null, 4, [["border-color", "var(--accent)"]]], [".border-overlay-0", null, 4, [["border-color", "var(--overlay-0)"]]], [".border-overlay-1", null, 4, [["border-color", "var(--overlay-1)"]]], [".border-red", null, 4, [["border-color", "var(--red)"]]], [".border-subtext-0", null, 4, [["border-color", "var(--subtext-0)"]]], [".border-surface-1", null, 4, [["border-color", "var(--surface-1)"]]], [".border-teal", null, 4, [["border-color", "var(--teal)"]]], [".border-yellow", null, 4, [["border-color", "var(--yellow)"]]], [".border-l-accent", null, 4, [["border-left-color", "var(--accent)"]]], [".border-l-green", null, 4, [["border-left-color", "var(--green)"]]], [".border-l-red", null, 4, [["border-left-color", "var(--red)"]]], [".border-l-yellow", null, 4, [["border-left-color", "var(--yellow)"]]], [".bg-\\[\\#161616\\]", null, 4, [["background-color", "#161616"]]], [".bg-\\[\\#fff\\]", null, 4, [["background-color", "#fff"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_8\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "var(--accent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_8\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--accent) 8%,var(--panel-bg))"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_12\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--accent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_12\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--accent) 12%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--accent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--accent) 15%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--blue\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--blue)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--blue\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--blue) 15%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--green\\)_9\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--green)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--green\\)_9\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--green) 9%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--red\\)_7\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--red)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--red\\)_7\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--red) 7%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--red\\)_9\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--red)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--red\\)_9\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--red) 9%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--surface-1\\)_42\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--surface-1\\)_42\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--surface-1) 42%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--surface-1\\)_70\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--surface-1\\)_70\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--surface-1) 70%,var(--panel-bg))"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--text\\)_10\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "var(--text)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--text\\)_10\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--text) 10%,var(--panel-bg))"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--yellow\\)_8\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--yellow)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--yellow\\)_8\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--yellow) 8%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--yellow\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--yellow)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--yellow\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--yellow) 15%,transparent)"]]], [".bg-\\[rgba\\(0\\,0\\,0\\,0\\.5\\)\\]", null, 4, [["background-color", "#00000080"]]], [".bg-\\[rgba\\(0\\,0\\,0\\,0\\.7\\)\\]", null, 4, [["background-color", "#000000b3"]]], [".bg-\\[rgba\\(0\\,0\\,0\\,0\\.55\\)\\]", null, 4, [["background-color", "#0000008c"]]], [".bg-\\[rgba\\(0\\,0\\,0\\,0\\.62\\)\\]", null, 4, [["background-color", "#0000009e"]]], [".bg-\\[var\\(--accent\\)\\]", null, 4, [["background-color", "var(--accent)"]]], [".bg-\\[var\\(--backdrop\\)\\]", null, 4, [["background-color", "var(--backdrop)"]]], [".bg-\\[var\\(--bg\\)\\]", null, 4, [["background-color", "var(--bg)"]]], [".bg-\\[var\\(--card-bg\\)\\]", null, 4, [["background-color", "var(--card-bg)"]]], [".bg-\\[var\\(--picker-bg\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "var(--picker-bg, var(--panel-bg))"]]], [".bg-\\[var\\(--surface-1\\)\\]", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-\\[var\\(--workspace-tools-bg\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "var(--workspace-tools-bg, var(--panel-bg))"]]], [".bg-accent, .bg-accent\\/10", null, 4, [["background-color", "var(--accent)"]]], [".bg-accent\\/10", null, 4, [["background-color", "color-mix(in oklab, var(--accent) 10%, transparent)"]]], [".bg-accent\\/35", null, 4, [["background-color", "var(--accent)"]]], [".bg-accent\\/35", null, 4, [["background-color", "color-mix(in oklab, var(--accent) 35%, transparent)"]]], [".bg-fg", null, 4, [["background-color", "var(--text)"]]], [".bg-green, .bg-green\\/15", null, 4, [["background-color", "var(--green)"]]], [".bg-green\\/15", null, 4, [["background-color", "color-mix(in oklab, var(--green) 15%, transparent)"]]], [".bg-overlay-0", null, 4, [["background-color", "var(--overlay-0)"]]], [".bg-overlay-1", null, 4, [["background-color", "var(--overlay-1)"]]], [".bg-panel-bg", null, 4, [["background-color", "var(--panel-bg)"]]], [".bg-red, .bg-red\\/15", null, 4, [["background-color", "var(--red)"]]], [".bg-red\\/15", null, 4, [["background-color", "color-mix(in oklab, var(--red) 15%, transparent)"]]], [".bg-subtext-0", null, 4, [["background-color", "var(--subtext-0)"]]], [".bg-surface-0", null, 4, [["background-color", "var(--surface-0)"]]], [".bg-surface-1, .bg-surface-1\\/30", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-surface-1\\/30", null, 4, [["background-color", "color-mix(in oklab, var(--surface-1) 30%, transparent)"]]], [".bg-surface-1\\/60", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-surface-1\\/60", null, 4, [["background-color", "color-mix(in oklab, var(--surface-1) 60%, transparent)"]]], [".bg-surface-1\\/70", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-surface-1\\/70", null, 4, [["background-color", "color-mix(in oklab, var(--surface-1) 70%, transparent)"]]], [".bg-transparent", null, 4, [["background-color", "#0000"]]], [".bg-yellow", null, 4, [["background-color", "var(--yellow)"]]], [".object-contain", null, 4, [["object-fit", "contain"]]], [".object-cover", null, 4, [["object-fit", "cover"]]], [".p-0", null, 4, [["padding", "0"]]], [".p-0\\.5", null, 4, [["padding", "calc(var(--spacing) * .5)"]]], [".p-1", null, 4, [["padding", "var(--spacing)"]]], [".p-2", null, 4, [["padding", "calc(var(--spacing) * 2)"]]], [".p-3", null, 4, [["padding", "calc(var(--spacing) * 3)"]]], [".p-4", null, 4, [["padding", "calc(var(--spacing) * 4)"]]], [".p-5", null, 4, [["padding", "calc(var(--spacing) * 5)"]]], [".p-6", null, 4, [["padding", "calc(var(--spacing) * 6)"]]], [".p-\\[0\\.2rem\\]", null, 4, [["padding", ".2rem"]]], [".p-\\[0\\.4rem\\]", null, 4, [["padding", ".4rem"]]], [".p-\\[0\\.5rem\\]", null, 4, [["padding", ".5rem"]]], [".p-\\[0\\.9rem\\]", null, 4, [["padding", ".9rem"]]], [".p-\\[0\\.45rem\\]", null, 4, [["padding", ".45rem"]]], [".p-\\[0\\.55rem\\]", null, 4, [["padding", ".55rem"]]], [".p-\\[0\\.65rem\\]", null, 4, [["padding", ".65rem"]]], [".p-\\[2px\\]", null, 4, [["padding", "2px"]]], [".px-0", null, 4, [["padding-inline", "0"]]], [".px-1", null, 4, [["padding-inline", "var(--spacing)"]]], [".px-1\\.5", null, 4, [["padding-inline", "calc(var(--spacing) * 1.5)"]]], [".px-2", null, 4, [["padding-inline", "calc(var(--spacing) * 2)"]]], [".px-3", null, 4, [["padding-inline", "calc(var(--spacing) * 3)"]]], [".px-3\\.5", null, 4, [["padding-inline", "calc(var(--spacing) * 3.5)"]]], [".px-4", null, 4, [["padding-inline", "calc(var(--spacing) * 4)"]]], [".px-8", null, 4, [["padding-inline", "calc(var(--spacing) * 8)"]]], [".px-\\[0\\.2rem\\]", null, 4, [["padding-inline", ".2rem"]]], [".px-\\[0\\.3rem\\]", null, 4, [["padding-inline", ".3rem"]]], [".px-\\[0\\.4rem\\]", null, 4, [["padding-inline", ".4rem"]]], [".px-\\[0\\.5rem\\]", null, 4, [["padding-inline", ".5rem"]]], [".px-\\[0\\.6rem\\]", null, 4, [["padding-inline", ".6rem"]]], [".px-\\[0\\.7rem\\]", null, 4, [["padding-inline", ".7rem"]]], [".px-\\[0\\.8rem\\]", null, 4, [["padding-inline", ".8rem"]]], [".px-\\[0\\.9rem\\]", null, 4, [["padding-inline", ".9rem"]]], [".px-\\[0\\.26rem\\]", null, 4, [["padding-inline", ".26rem"]]], [".px-\\[0\\.28rem\\]", null, 4, [["padding-inline", ".28rem"]]], [".px-\\[0\\.35rem\\]", null, 4, [["padding-inline", ".35rem"]]], [".px-\\[0\\.42rem\\]", null, 4, [["padding-inline", ".42rem"]]], [".px-\\[0\\.45rem\\]", null, 4, [["padding-inline", ".45rem"]]], [".px-\\[0\\.48rem\\]", null, 4, [["padding-inline", ".48rem"]]], [".px-\\[0\\.55rem\\]", null, 4, [["padding-inline", ".55rem"]]], [".px-\\[0\\.65rem\\]", null, 4, [["padding-inline", ".65rem"]]], [".px-\\[0\\.75rem\\]", null, 4, [["padding-inline", ".75rem"]]], [".px-\\[0\\.85rem\\]", null, 4, [["padding-inline", ".85rem"]]], [".px-\\[1\\.4rem\\]", null, 4, [["padding-inline", "1.4rem"]]], [".px-\\[3px\\]", null, 4, [["padding-inline", "3px"]]], [".px-\\[10px\\]", null, 4, [["padding-inline", "10px"]]], [".py-0", null, 4, [["padding-block", "0"]]], [".py-0\\.5", null, 4, [["padding-block", "calc(var(--spacing) * .5)"]]], [".py-1", null, 4, [["padding-block", "var(--spacing)"]]], [".py-1\\.5", null, 4, [["padding-block", "calc(var(--spacing) * 1.5)"]]], [".py-2", null, 4, [["padding-block", "calc(var(--spacing) * 2)"]]], [".py-3", null, 4, [["padding-block", "calc(var(--spacing) * 3)"]]], [".py-4", null, 4, [["padding-block", "calc(var(--spacing) * 4)"]]], [".py-8", null, 4, [["padding-block", "calc(var(--spacing) * 8)"]]], [".py-\\[0\\.1rem\\]", null, 4, [["padding-block", ".1rem"]]], [".py-\\[0\\.2rem\\]", null, 4, [["padding-block", ".2rem"]]], [".py-\\[0\\.3rem\\]", null, 4, [["padding-block", ".3rem"]]], [".py-\\[0\\.4rem\\]", null, 4, [["padding-block", ".4rem"]]], [".py-\\[0\\.05rem\\]", null, 4, [["padding-block", ".05rem"]]], [".py-\\[0\\.6rem\\]", null, 4, [["padding-block", ".6rem"]]], [".py-\\[0\\.8rem\\]", null, 4, [["padding-block", ".8rem"]]], [".py-\\[0\\.12rem\\]", null, 4, [["padding-block", ".12rem"]]], [".py-\\[0\\.14rem\\]", null, 4, [["padding-block", ".14rem"]]], [".py-\\[0\\.15rem\\]", null, 4, [["padding-block", ".15rem"]]], [".py-\\[0\\.18rem\\]", null, 4, [["padding-block", ".18rem"]]], [".py-\\[0\\.25rem\\]", null, 4, [["padding-block", ".25rem"]]], [".py-\\[0\\.28rem\\]", null, 4, [["padding-block", ".28rem"]]], [".py-\\[0\\.32rem\\]", null, 4, [["padding-block", ".32rem"]]], [".py-\\[0\\.35rem\\]", null, 4, [["padding-block", ".35rem"]]], [".py-\\[0\\.42rem\\]", null, 4, [["padding-block", ".42rem"]]], [".py-\\[0\\.45rem\\]", null, 4, [["padding-block", ".45rem"]]], [".py-\\[0\\.55rem\\]", null, 4, [["padding-block", ".55rem"]]], [".py-\\[0\\.65rem\\]", null, 4, [["padding-block", ".65rem"]]], [".py-\\[2px\\]", null, 4, [["padding-block", "2px"]]], [".py-\\[3px\\]", null, 4, [["padding-block", "3px"]]], [".py-\\[6px\\]", null, 4, [["padding-block", "6px"]]], [".py-px", null, 4, [["padding-block", "1px"]]], [".pt-1", null, 4, [["padding-top", "var(--spacing)"]]], [".pt-2", null, 4, [["padding-top", "calc(var(--spacing) * 2)"]]], [".pt-2\\.5", null, 4, [["padding-top", "calc(var(--spacing) * 2.5)"]]], [".pt-3", null, 4, [["padding-top", "calc(var(--spacing) * 3)"]]], [".pt-4", null, 4, [["padding-top", "calc(var(--spacing) * 4)"]]], [".pt-5", null, 4, [["padding-top", "calc(var(--spacing) * 5)"]]], [".pt-\\[0\\.2rem\\]", null, 4, [["padding-top", ".2rem"]]], [".pt-\\[0\\.4rem\\]", null, 4, [["padding-top", ".4rem"]]], [".pt-\\[0\\.6rem\\]", null, 4, [["padding-top", ".6rem"]]], [".pt-\\[0\\.85rem\\]", null, 4, [["padding-top", ".85rem"]]], [".pt-\\[2px\\]", null, 4, [["padding-top", "2px"]]], [".pt-\\[12vh\\]", null, 4, [["padding-top", "12vh"]]], [".pt-\\[max\\(0\\.5rem\\,env\\(safe-area-inset-top\\)\\)\\]", null, 4, [["padding-top", "max(.5rem, env(safe-area-inset-top))"]]], [".pr-0\\.5", null, 4, [["padding-right", "calc(var(--spacing) * .5)"]]], [".pr-1", null, 4, [["padding-right", "var(--spacing)"]]], [".pr-1\\.5", null, 4, [["padding-right", "calc(var(--spacing) * 1.5)"]]], [".pr-2", null, 4, [["padding-right", "calc(var(--spacing) * 2)"]]], [".pr-3", null, 4, [["padding-right", "calc(var(--spacing) * 3)"]]], [".pr-12", null, 4, [["padding-right", "calc(var(--spacing) * 12)"]]], [".pr-\\[0\\.3rem\\]", null, 4, [["padding-right", ".3rem"]]], [".pr-\\[0\\.6rem\\]", null, 4, [["padding-right", ".6rem"]]], [".pr-\\[0\\.35rem\\]", null, 4, [["padding-right", ".35rem"]]], [".pr-\\[0\\.45rem\\]", null, 4, [["padding-right", ".45rem"]]], [".pr-\\[0\\.55rem\\]", null, 4, [["padding-right", ".55rem"]]], [".pr-\\[1\\.6rem\\]", null, 4, [["padding-right", "1.6rem"]]], [".pr-\\[3px\\]", null, 4, [["padding-right", "3px"]]], [".pr-\\[env\\(safe-area-inset-right\\)\\]", null, 4, [["padding-right", "env(safe-area-inset-right)"]]], [".pr-\\[max\\(0\\.5rem\\,env\\(safe-area-inset-right\\)\\)\\]", null, 4, [["padding-right", "max(.5rem, env(safe-area-inset-right))"]]], [".pb-1", null, 4, [["padding-bottom", "var(--spacing)"]]], [".pb-2", null, 4, [["padding-bottom", "calc(var(--spacing) * 2)"]]], [".pb-3", null, 4, [["padding-bottom", "calc(var(--spacing) * 3)"]]], [".pb-4", null, 4, [["padding-bottom", "calc(var(--spacing) * 4)"]]], [".pb-8", null, 4, [["padding-bottom", "calc(var(--spacing) * 8)"]]], [".pb-\\[0\\.3rem\\]", null, 4, [["padding-bottom", ".3rem"]]], [".pb-\\[0\\.4rem\\]", null, 4, [["padding-bottom", ".4rem"]]], [".pb-\\[0\\.25rem\\]", null, 4, [["padding-bottom", ".25rem"]]], [".pb-\\[0\\.55rem\\]", null, 4, [["padding-bottom", ".55rem"]]], [".pb-\\[1\\.4rem\\]", null, 4, [["padding-bottom", "1.4rem"]]], [".pb-\\[calc\\(1\\.5rem\\+env\\(safe-area-inset-bottom\\)\\)\\]", null, 4, [["padding-bottom", "calc(1.5rem + env(safe-area-inset-bottom))"]]], [".pb-\\[calc\\(1rem\\+env\\(safe-area-inset-bottom\\)\\)\\]", null, 4, [["padding-bottom", "calc(1rem + env(safe-area-inset-bottom))"]]], [".pb-\\[env\\(safe-area-inset-bottom\\)\\]", null, 4, [["padding-bottom", "env(safe-area-inset-bottom)"]]], [".pb-\\[max\\(0\\.5rem\\,env\\(safe-area-inset-bottom\\)\\)\\]", null, 4, [["padding-bottom", "max(.5rem, env(safe-area-inset-bottom))"]]], [".pl-1", null, 4, [["padding-left", "var(--spacing)"]]], [".pl-1\\.5", null, 4, [["padding-left", "calc(var(--spacing) * 1.5)"]]], [".pl-2", null, 4, [["padding-left", "calc(var(--spacing) * 2)"]]], [".pl-3", null, 4, [["padding-left", "calc(var(--spacing) * 3)"]]], [".pl-4", null, 4, [["padding-left", "calc(var(--spacing) * 4)"]]], [".pl-5", null, 4, [["padding-left", "calc(var(--spacing) * 5)"]]], [".pl-6", null, 4, [["padding-left", "calc(var(--spacing) * 6)"]]], [".pl-\\[0\\.4rem\\]", null, 4, [["padding-left", ".4rem"]]], [".pl-\\[0\\.45rem\\]", null, 4, [["padding-left", ".45rem"]]], [".pl-\\[0\\.75rem\\]", null, 4, [["padding-left", ".75rem"]]], [".pl-\\[0\\.85rem\\]", null, 4, [["padding-left", ".85rem"]]], [".pl-\\[1\\.2rem\\]", null, 4, [["padding-left", "1.2rem"]]], [".pl-\\[1\\.55rem\\]", null, 4, [["padding-left", "1.55rem"]]], [".pl-\\[1\\.075rem\\]", null, 4, [["padding-left", "1.075rem"]]], [".pl-\\[1\\.525rem\\]", null, 4, [["padding-left", "1.525rem"]]], [".pl-\\[1\\.875rem\\]", null, 4, [["padding-left", "1.875rem"]]], [".pl-\\[85px\\]", null, 4, [["padding-left", "85px"]]], [".pl-\\[max\\(0\\.5rem\\,env\\(safe-area-inset-left\\)\\)\\]", null, 4, [["padding-left", "max(.5rem, env(safe-area-inset-left))"]]], [".pl-\\[max\\(0\\.25rem\\,env\\(safe-area-inset-left\\)\\)\\]", null, 4, [["padding-left", "max(.25rem, env(safe-area-inset-left))"]]], [".text-center", null, 4, [["text-align", "center"]]], [".text-left", null, 4, [["text-align", "left"]]], [".text-right", null, 4, [["text-align", "right"]]], [".\\[font-family\\:inherit\\]", null, 4, [["font-family", "inherit"]]], [".\\[font-family\\:ui-monospace\\,SFMono-Regular\\,Menlo\\,monospace\\]", null, 4, [["font-family", "ui-monospace, SFMono-Regular, Menlo, monospace"]]], [".\\[font-family\\:var\\(--font-mono\\)\\]", null, 4, [["font-family", "var(--font-mono)"]]], [".text-sm", null, 4, [["font-size", "var(--text-sm)"], ["line-height", "var(--tw-leading, var(--text-sm--line-height))"]]], [".text-xs", null, 4, [["font-size", "var(--text-xs)"], ["line-height", "var(--tw-leading, var(--text-xs--line-height))"]]], [".\\[font-size\\:inherit\\]", null, 4, [["font-size", "inherit"]]], [".text-\\[0\\.6rem\\]", null, 4, [["font-size", ".6rem"]]], [".text-\\[0\\.7rem\\]", null, 4, [["font-size", ".7rem"]]], [".text-\\[0\\.8em\\]", null, 4, [["font-size", ".8em"]]], [".text-\\[0\\.8rem\\]", null, 4, [["font-size", ".8rem"]]], [".text-\\[0\\.9em\\]", null, 4, [["font-size", ".9em"]]], [".text-\\[0\\.9rem\\]", null, 4, [["font-size", ".9rem"]]], [".text-\\[0\\.54rem\\]", null, 4, [["font-size", ".54rem"]]], [".text-\\[0\\.58rem\\]", null, 4, [["font-size", ".58rem"]]], [".text-\\[0\\.62rem\\]", null, 4, [["font-size", ".62rem"]]], [".text-\\[0\\.63rem\\]", null, 4, [["font-size", ".63rem"]]], [".text-\\[0\\.64rem\\]", null, 4, [["font-size", ".64rem"]]], [".text-\\[0\\.65rem\\]", null, 4, [["font-size", ".65rem"]]], [".text-\\[0\\.66rem\\]", null, 4, [["font-size", ".66rem"]]], [".text-\\[0\\.66rem\\]\\!", null, 4, [["font-size", ".66rem", 1]]], [".text-\\[0\\.68rem\\]", null, 4, [["font-size", ".68rem"]]], [".text-\\[0\\.72rem\\]", null, 4, [["font-size", ".72rem"]]], [".text-\\[0\\.74rem\\]", null, 4, [["font-size", ".74rem"]]], [".text-\\[0\\.75rem\\]", null, 4, [["font-size", ".75rem"]]], [".text-\\[0\\.76rem\\]", null, 4, [["font-size", ".76rem"]]], [".text-\\[0\\.77rem\\]", null, 4, [["font-size", ".77rem"]]], [".text-\\[0\\.78rem\\]", null, 4, [["font-size", ".78rem"]]], [".text-\\[0\\.82rem\\]", null, 4, [["font-size", ".82rem"]]], [".text-\\[0\\.83rem\\]", null, 4, [["font-size", ".83rem"]]], [".text-\\[0\\.85rem\\]", null, 4, [["font-size", ".85rem"]]], [".text-\\[0\\.88rem\\]", null, 4, [["font-size", ".88rem"]]], [".text-\\[0\\.95rem\\]", null, 4, [["font-size", ".95rem"]]], [".text-\\[0\\.875rem\\]", null, 4, [["font-size", ".875rem"]]], [".text-\\[1\\.1rem\\]", null, 4, [["font-size", "1.1rem"]]], [".text-\\[1\\.4em\\]", null, 4, [["font-size", "1.4em"]]], [".text-\\[1\\.6rem\\]", null, 4, [["font-size", "1.6rem"]]], [".text-\\[1\\.15rem\\]", null, 4, [["font-size", "1.15rem"]]], [".text-\\[1rem\\]", null, 4, [["font-size", "1rem"]]], [".text-\\[2\\.4rem\\]", null, 4, [["font-size", "2.4rem"]]], [".text-\\[9px\\]", null, 4, [["font-size", "9px"]]], [".text-\\[10px\\]", null, 4, [["font-size", "10px"]]], [".text-\\[11px\\]", null, 4, [["font-size", "11px"]]], [".text-\\[12\\.5px\\]", null, 4, [["font-size", "12.5px"]]], [".text-\\[12px\\]", null, 4, [["font-size", "12px"]]], [".text-\\[13px\\]", null, 4, [["font-size", "13px"]]], [".text-\\[14px\\]", null, 4, [["font-size", "14px"]]], [".text-\\[calc\\(0\\.95rem\\*var\\(--chat-font-scale\\,1\\)\\)\\]", null, 4, [["font-size", "calc(.95rem * var(--chat-font-scale, 1))"]]], [".text-\\[length\\:calc\\(11px\\*var\\(--zoom\\,1\\)\\)\\]", null, 4, [["font-size", "calc(11px * var(--zoom, 1))"]]], [".text-\\[length\\:calc\\(13px\\*var\\(--zoom\\,1\\)\\)\\]", null, 4, [["font-size", "calc(13px * var(--zoom, 1))"]]], [".leading-4", null, 4, [["--tw-leading", "calc(var(--spacing) * 4)"], ["line-height", "calc(var(--spacing) * 4)"]]], [".leading-\\[1\\.1\\]", null, 4, [["--tw-leading", "1.1"], ["line-height", "1.1"]]], [".leading-\\[1\\.2\\]", null, 4, [["--tw-leading", "1.2"], ["line-height", "1.2"]]], [".leading-\\[1\\.3\\]", null, 4, [["--tw-leading", "1.3"], ["line-height", "1.3"]]], [".leading-\\[1\\.4\\]", null, 4, [["--tw-leading", "1.4"], ["line-height", "1.4"]]], [".leading-\\[1\\.5\\]", null, 4, [["--tw-leading", "1.5"], ["line-height", "1.5"]]], [".leading-\\[1\\.6\\]", null, 4, [["--tw-leading", "1.6"], ["line-height", "1.6"]]], [".leading-\\[1\\.45\\]", null, 4, [["--tw-leading", "1.45"], ["line-height", "1.45"]]], [".leading-\\[18px\\]", null, 4, [["--tw-leading", "18px"], ["line-height", "18px"]]], [".leading-none", null, 4, [["--tw-leading", "1"], ["line-height", "1"]]], [".leading-relaxed", null, 4, [["--tw-leading", "var(--leading-relaxed)"], ["line-height", "var(--leading-relaxed)"]]], [".leading-tight", null, 4, [["--tw-leading", "var(--leading-tight)"], ["line-height", "var(--leading-tight)"]]], [".\\[line-height\\:inherit\\]", null, 4, [["line-height", "inherit"]]], [".font-bold", null, 4, [["--tw-font-weight", "var(--font-weight-bold)"], ["font-weight", "var(--font-weight-bold)"]]], [".font-medium", null, 4, [["--tw-font-weight", "var(--font-weight-medium)"], ["font-weight", "var(--font-weight-medium)"]]], [".font-normal", null, 4, [["--tw-font-weight", "var(--font-weight-normal)"], ["font-weight", "var(--font-weight-normal)"]]], [".font-semibold", null, 4, [["--tw-font-weight", "var(--font-weight-semibold)"], ["font-weight", "var(--font-weight-semibold)"]]], [".\\[font-weight\\:inherit\\]", null, 4, [["font-weight", "inherit"]]], [".tracking-\\[-0\\.02em\\]", null, 4, [["--tw-tracking", "-.02em"], ["letter-spacing", "-.02em"]]], [".tracking-\\[0\\.03em\\]", null, 4, [["--tw-tracking", ".03em"], ["letter-spacing", ".03em"]]], [".tracking-\\[0\\.04em\\]", null, 4, [["--tw-tracking", ".04em"], ["letter-spacing", ".04em"]]], [".tracking-\\[0\\.06em\\]", null, 4, [["--tw-tracking", ".06em"], ["letter-spacing", ".06em"]]], [".tracking-\\[0\\.08em\\]", null, 4, [["--tw-tracking", ".08em"], ["letter-spacing", ".08em"]]], [".tracking-\\[0\\.09em\\]", null, 4, [["--tw-tracking", ".09em"], ["letter-spacing", ".09em"]]], [".tracking-\\[0\\.22em\\]", null, 4, [["--tw-tracking", ".22em"], ["letter-spacing", ".22em"]]], [".tracking-normal", null, 4, [["--tw-tracking", "var(--tracking-normal)"], ["letter-spacing", "var(--tracking-normal)"]]], [".tracking-wide", null, 4, [["--tw-tracking", "var(--tracking-wide)"], ["letter-spacing", "var(--tracking-wide)"]]], [".\\[overflow-wrap\\:anywhere\\]", null, 4, [["overflow-wrap", "anywhere"]]], [".break-words", null, 4, [["overflow-wrap", "break-word"]]], [".\\[word-break\\:break-word\\]", null, 4, [["word-break", "break-word"]]], [".text-ellipsis", null, 4, [["text-overflow", "ellipsis"]]], [".whitespace-normal", null, 4, [["white-space", "normal"]]], [".whitespace-nowrap", null, 4, [["white-space", "nowrap"]]], [".whitespace-pre", null, 4, [["white-space", "pre"]]], [".whitespace-pre-wrap", null, 4, [["white-space", "pre-wrap"]]], [".\\[tab-size\\:2\\]", null, 4, [["tab-size", "2"]]], [".text-\\[color\\:var\\(--git-muted\\)\\]", null, 4, [["color", "var(--git-muted)"]]], [".text-\\[var\\(--subtext-0\\)\\]", null, 4, [["color", "var(--subtext-0)"]]], [".text-\\[var\\(--text\\)\\]", null, 4, [["color", "var(--text)"]]], [".text-accent", null, 4, [["color", "var(--accent)"]]], [".text-blue", null, 4, [["color", "var(--blue)"]]], [".text-current", null, 4, [["color", "currentColor"]]], [".text-fg", null, 4, [["color", "var(--text)"]]], [".text-green", null, 4, [["color", "var(--green)"]]], [".text-inherit", null, 4, [["color", "inherit"]]], [".text-mauve", null, 4, [["color", "var(--mauve)"]]], [".text-overlay-0", null, 4, [["color", "var(--overlay-0)"]]], [".text-overlay-1", null, 4, [["color", "var(--overlay-1)"]]], [".text-panel-bg", null, 4, [["color", "var(--panel-bg)"]]], [".text-peach", null, 4, [["color", "var(--peach)"]]], [".text-red", null, 4, [["color", "var(--red)"]]], [".text-red\\!", null, 4, [["color", "var(--red)", 1]]], [".text-subtext-0", null, 4, [["color", "var(--subtext-0)"]]], [".text-yellow", null, 4, [["color", "var(--yellow)"]]], [".capitalize", null, 4, [["text-transform", "capitalize"]]], [".normal-case", null, 4, [["text-transform", "none"]]], [".uppercase", null, 4, [["text-transform", "uppercase"]]], [".italic", null, 4, [["font-style", "italic"]]], [".not-italic", null, 4, [["font-style", "normal"]]], [".tabular-nums", null, 4, [["--tw-numeric-spacing", "tabular-nums"], ["font-variant-numeric", "var(--tw-ordinal, ) var(--tw-slashed-zero, ) var(--tw-numeric-figure, ) var(--tw-numeric-spacing, ) var(--tw-numeric-fraction, )"]]], [".line-through", null, 4, [["text-decoration-line", "line-through"]]], [".no-underline", null, 4, [["text-decoration-line", "none"]]], [".underline", null, 4, [["text-decoration-line", "underline"]]], [".opacity-0", null, 4, [["opacity", "0"]]], [".opacity-40", null, 4, [["opacity", ".4"]]], [".opacity-60", null, 4, [["opacity", ".6"]]], [".opacity-70", null, 4, [["opacity", ".7"]]], [".opacity-75", null, 4, [["opacity", ".75"]]], [".opacity-80", null, 4, [["opacity", ".8"]]], [".opacity-100", null, 4, [["opacity", "1"]]], [".opacity-\\[0\\.72\\]", null, 4, [["opacity", ".72"]]], [".shadow", null, 4, [["--tw-shadow", "0 1px 3px 0 var(--tw-shadow-color, #0000001a), 0 1px 2px -1px var(--tw-shadow-color, #0000001a)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_1px_4px_rgba\\(0\\,0\\,0\\,0\\.4\\)\\]", null, 4, [["--tw-shadow", "0 1px 4px var(--tw-shadow-color, #0006)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_2px_8px_rgba\\(0\\,0\\,0\\,0\\.4\\)\\]", null, 4, [["--tw-shadow", "0 2px 8px var(--tw-shadow-color, #0006)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_2px_8px_rgba\\(0\\,0\\,0\\,0\\.35\\)\\]", null, 4, [["--tw-shadow", "0 2px 8px var(--tw-shadow-color, #00000059)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_6px_20px_rgba\\(0\\,0\\,0\\,0\\.3\\)\\]", null, 4, [["--tw-shadow", "0 6px 20px var(--tw-shadow-color, #0000004d)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_8px_24px_rgba\\(0\\,0\\,0\\,0\\.35\\)\\]", null, 4, [["--tw-shadow", "0 8px 24px var(--tw-shadow-color, #00000059)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_8px_24px_rgba\\(0\\,0\\,0\\,0\\.45\\)\\]", null, 4, [["--tw-shadow", "0 8px 24px var(--tw-shadow-color, #00000073)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_8px_32px_rgba\\(0\\,0\\,0\\,0\\.5\\)\\]", null, 4, [["--tw-shadow", "0 8px 32px var(--tw-shadow-color, #00000080)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_12px_32px_rgba\\(0\\,0\\,0\\,0\\.5\\)\\]", null, 4, [["--tw-shadow", "0 12px 32px var(--tw-shadow-color, #00000080)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_16px_48px_rgba\\(0\\,0\\,0\\,0\\.55\\)\\]", null, 4, [["--tw-shadow", "0 16px 48px var(--tw-shadow-color, #0000008c)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[inset_0_0_24px_var\\(--accent\\)\\]", null, 4, [["--tw-shadow", "inset 0 0 24px var(--tw-shadow-color, var(--accent))"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-lg", null, 4, [["--tw-shadow", "0 10px 15px -3px var(--tw-shadow-color, #0000001a), 0 4px 6px -4px var(--tw-shadow-color, #0000001a)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".ring", null, 4, [["--tw-ring-shadow", "var(--tw-ring-inset, ) 0 0 0 calc(1px + var(--tw-ring-offset-width)) var(--tw-ring-color, currentcolor)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".\\[box-shadow\\:0_1px_2px_rgba\\(0\\,0\\,0\\,0\\.3\\)\\]", null, 4, [["box-shadow", "0 1px 2px #0000004d"]]], [".\\[box-shadow\\:0_4px_14px_rgba\\(0\\,0\\,0\\,0\\.35\\)\\]", null, 4, [["box-shadow", "0 4px 14px #00000059"]]], [".\\[box-shadow\\:none\\]", null, 4, [["box-shadow", "none"]]], [".\\[outline\\:none\\]", null, 4, [["outline", "none"]]], [".outline, .outline-1", null, 4, [["outline-style", "var(--tw-outline-style)"], ["outline-width", "1px"]]], [".outline-2", null, 4, [["outline-style", "var(--tw-outline-style)"], ["outline-width", "2px"]]], [".outline-accent", null, 4, [["outline-color", "var(--accent)"]]], [".blur", null, 4, [["--tw-blur", "blur(8px)"], ["filter", "var(--tw-blur, ) var(--tw-brightness, ) var(--tw-contrast, ) var(--tw-grayscale, ) var(--tw-hue-rotate, ) var(--tw-invert, ) var(--tw-saturate, ) var(--tw-sepia, ) var(--tw-drop-shadow, )"]]], [".\\!filter", null, 4, [["filter", "var(--tw-blur, ) var(--tw-brightness, ) var(--tw-contrast, ) var(--tw-grayscale, ) var(--tw-hue-rotate, ) var(--tw-invert, ) var(--tw-saturate, ) var(--tw-sepia, ) var(--tw-drop-shadow, )", 1]]], [".\\[filter\\:drop-shadow\\(0_6px_10px_rgba\\(0\\,0\\,0\\,0\\.45\\)\\)\\]", null, 4, [["filter", "drop-shadow(0 6px 10px #00000073)"]]], [".filter", null, 4, [["filter", "var(--tw-blur, ) var(--tw-brightness, ) var(--tw-contrast, ) var(--tw-grayscale, ) var(--tw-hue-rotate, ) var(--tw-invert, ) var(--tw-saturate, ) var(--tw-sepia, ) var(--tw-drop-shadow, )"]]], [".backdrop-blur-xl", null, 4, [["--tw-backdrop-blur", "blur(var(--blur-xl))"], ["-webkit-backdrop-filter", "var(--tw-backdrop-blur, ) var(--tw-backdrop-brightness, ) var(--tw-backdrop-contrast, ) var(--tw-backdrop-grayscale, ) var(--tw-backdrop-hue-rotate, ) var(--tw-backdrop-invert, ) var(--tw-backdrop-opacity, ) var(--tw-backdrop-saturate, ) var(--tw-backdrop-sepia, )"], ["backdrop-filter", "var(--tw-backdrop-blur, ) var(--tw-backdrop-brightness, ) var(--tw-backdrop-contrast, ) var(--tw-backdrop-grayscale, ) var(--tw-backdrop-hue-rotate, ) var(--tw-backdrop-invert, ) var(--tw-backdrop-opacity, ) var(--tw-backdrop-saturate, ) var(--tw-backdrop-sepia, )"]]], [".backdrop-saturate-150", null, 4, [["--tw-backdrop-saturate", "saturate(150%)"], ["-webkit-backdrop-filter", "var(--tw-backdrop-blur, ) var(--tw-backdrop-brightness, ) var(--tw-backdrop-contrast, ) var(--tw-backdrop-grayscale, ) var(--tw-backdrop-hue-rotate, ) var(--tw-backdrop-invert, ) var(--tw-backdrop-opacity, ) var(--tw-backdrop-saturate, ) var(--tw-backdrop-sepia, )"], ["backdrop-filter", "var(--tw-backdrop-blur, ) var(--tw-backdrop-brightness, ) var(--tw-backdrop-contrast, ) var(--tw-backdrop-grayscale, ) var(--tw-backdrop-hue-rotate, ) var(--tw-backdrop-invert, ) var(--tw-backdrop-opacity, ) var(--tw-backdrop-saturate, ) var(--tw-backdrop-sepia, )"]]], [".transition", null, 4, [["transition-property", "color, background-color, border-color, outline-color, text-decoration-color, fill, stroke, --tw-gradient-from, --tw-gradient-via, --tw-gradient-to, opacity, box-shadow, transform, translate, scale, rotate, filter, -webkit-backdrop-filter, backdrop-filter, display, content-visibility, overlay, pointer-events"], ["transition-timing-function", "var(--tw-ease, var(--default-transition-timing-function))"], ["transition-duration", "var(--tw-duration, var(--default-transition-duration))"]]], [".transition-\\[left\\,top\\,width\\,height\\]", null, 4, [["transition-property", "left, top, width, height"], ["transition-timing-function", "var(--tw-ease, var(--default-transition-timing-function))"], ["transition-duration", "var(--tw-duration, var(--default-transition-duration))"]]], [".transition-opacity", null, 4, [["transition-property", "opacity"], ["transition-timing-function", "var(--tw-ease, var(--default-transition-timing-function))"], ["transition-duration", "var(--tw-duration, var(--default-transition-duration))"]]], [".duration-150", null, 4, [["--tw-duration", ".15s"], ["transition-duration", ".15s"]]], [".ease-out", null, 4, [["--tw-ease", "var(--ease-out)"], ["transition-timing-function", "var(--ease-out)"]]], [".outline-none", null, 4, [["--tw-outline-style", "none"], ["outline-style", "none"]]], [".outline-solid", null, 4, [["--tw-outline-style", "solid"], ["outline-style", "solid"]]], [".select-none", null, 4, [["-webkit-user-select", "none"], ["user-select", "none"]]], [".select-text", null, 4, [["-webkit-user-select", "text"], ["user-select", "text"]]], [".\\[--panel-bg\\:var\\(--surface-dim\\)\\]", null, 4, [["--panel-bg", "var(--surface-dim)"]]], [".\\[--picker-bg\\:var\\(--surface-0\\)\\]", null, 4, [["--picker-bg", "var(--surface-0)"]]], [".\\[--radius\\:var\\(--radius-pane\\)\\]", null, 4, [["--radius", "var(--radius-pane)"]]], [".\\[--workspace-tools-bg\\:transparent\\]", null, 4, [["--workspace-tools-bg", "transparent"]]], [".\\[-webkit-box-orient\\:vertical\\]", null, 4, [["-webkit-box-orient", "vertical"]]], [".\\[-webkit-line-clamp\\:3\\]", null, 4, [["-webkit-line-clamp", "3"]]], [".\\[-webkit-touch-callout\\:none\\]", null, 4, [["-webkit-touch-callout", "none"]]], [".\\[background\\:none\\]", null, 4, [["background", "none"]]], [".\\[border-right\\:1px_solid_var\\(--git-border\\)\\]", null, 4, [["border-right", "1px solid var(--git-border)"]]], [".\\[border-top\\:1px_solid_var\\(--git-border\\)\\]", null, 4, [["border-top", "1px solid var(--git-border)"]]], [".\\[border\\:0\\]", null, 4, [["border", "0"]]], [".\\[border\\:none\\]", null, 4, [["border", "none"]]], [".\\[font\\:1\\.15rem\\/1_var\\(--font-mono\\)\\]", null, 4, [["font", "1.15rem/1 var(--font-mono)"]]], [".\\[font\\:1rem\\/1\\.2_var\\(--font-mono\\)\\]", null, 4, [["font", "1rem/1.2 var(--font-mono)"]]], [".\\[font\\:inherit\\]", null, 4, [["font", "inherit"]]], [".\\[transition\\:background_0\\.1s_ease\\]", null, 4, [["transition", "background .1s"]]], [".\\[transition\\:background_0\\.12s_ease\\]", null, 4, [["transition", "background .12s"]]], [".\\[transition\\:background_0\\.15s_ease\\]", null, 4, [["transition", "background .15s"]]], [".\\[transition\\:color_0\\.1s_ease\\,background_0\\.1s_ease\\]", null, 4, [["transition", "color .1s, background .1s"]]], [".\\[transition\\:color_0\\.12s_ease\\,background_0\\.12s_ease\\]", null, 4, [["transition", "color .12s, background .12s"]]], [".\\[transition\\:color_0\\.15s_ease\\]", null, 4, [["transition", "color .15s"]]], [".\\[transition\\:opacity_0\\.12s_ease\\]", null, 4, [["transition", "opacity .12s"]]], [".\\[transition\\:transform_0\\.15s_ease\\,background_0\\.15s_ease\\]", null, 4, [["transition", "transform .15s, background .15s"]]], [".not-has-\\[\\[data-setting-row\\]\\]\\:hidden:not(:has([data-setting-row]))", null, 4, [["display", "none"]]], [".group-focus-within\\:flex:is(:where(.group):focus-within *)", null, 4, [["display", "flex"]]], [".group-focus-within\\/row\\:opacity-100:is(:where(.group\\/row):focus-within *)", null, 4, [["opacity", "1"]]], [".group-hover\\:flex:is(:where(.group):hover *)", null, 4, [["display", "flex"]]], [".group-hover\\:opacity-100:is(:where(.group):hover *)", null, 4, [["opacity", "1"]]], [".group-hover\\/line\\:opacity-90:is(:where(.group\\/line):hover *)", null, 4, [["opacity", ".9"]]], [".group-hover\\/ph\\:opacity-100:is(:where(.group\\/ph):hover *), .group-hover\\/row\\:opacity-100:is(:where(.group\\/row):hover *)", null, 4, [["opacity", "1"]]], [".group-focus\\/tree\\:ring-1:is(:where(.group\\/tree):focus *)", null, 4, [["--tw-ring-shadow", "var(--tw-ring-inset, ) 0 0 0 calc(1px + var(--tw-ring-offset-width)) var(--tw-ring-color, currentcolor)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".group-focus\\/tree\\:ring-overlay-1:is(:where(.group\\/tree):focus *)", null, 4, [["--tw-ring-color", "var(--overlay-1)"]]], [".group-focus\\/tree\\:ring-inset:is(:where(.group\\/tree):focus *)", null, 4, [["--tw-ring-inset", "inset"]]], ['.group-aria-checked\\:\\[transform\\:translateX\\(1\\.1rem\\)\\]:is(:where(.group)[aria-checked="true"] *)', null, 4, [["transform", "translateX(1.1rem)"]]], ['.group-aria-checked\\:border-accent:is(:where(.group)[aria-checked="true"] *)', null, 4, [["border-color", "var(--accent)"]]], ['.group-aria-checked\\:bg-accent:is(:where(.group)[aria-checked="true"] *)', null, 4, [["background-color", "var(--accent)"]]], ['.group-aria-checked\\:bg-panel-bg:is(:where(.group)[aria-checked="true"] *)', null, 4, [["background-color", "var(--panel-bg)"]]], ['.group-aria-checked\\:text-accent:is(:where(.group)[aria-checked="true"] *), .group-aria-\\[checked\\=false\\]\\:text-accent:is(:where(.group)[aria-checked="false"] *)', null, 4, [["color", "var(--accent)"]]], [".placeholder\\:text-subtext-0::placeholder", null, 4, [["color", "var(--subtext-0)"]]], [".before\\:absolute:before", null, 4, [["content", "var(--tw-content)"], ["position", "absolute"]]], [".before\\:top-\\[0\\.15rem\\]:before", null, 4, [["content", "var(--tw-content)"], ["top", ".15rem"]]], [".before\\:left-\\[0\\.15rem\\]:before", null, 4, [["content", "var(--tw-content)"], ["left", ".15rem"]]], [".before\\:h-\\[0\\.95rem\\]:before", null, 4, [["content", "var(--tw-content)"], ["height", ".95rem"]]], [".before\\:w-\\[0\\.95rem\\]:before", null, 4, [["content", "var(--tw-content)"], ["width", ".95rem"]]], [".before\\:rounded-full:before", null, 4, [["content", "var(--tw-content)"], ["border-radius", "3.40282e38px"]]], [".before\\:bg-fg:before", null, 4, [["content", "var(--tw-content)"], ["background-color", "var(--text)"]]], [".before\\:content-\\[\\'\\'\\]:before", null, 4, [["--tw-content", '""'], ["content", "var(--tw-content)"]]], [".before\\:\\[transition\\:transform_0\\.12s_ease\\]:before", null, 4, [["content", "var(--tw-content)"], ["transition", "transform .12s"]]], [".after\\:absolute:after", null, 4, [["content", "var(--tw-content)"], ["position", "absolute"]]], [".after\\:inset-0:after", null, 4, [["content", "var(--tw-content)"], ["inset", "0"]]], [".after\\:inset-x-0:after", null, 4, [["content", "var(--tw-content)"], ["inset-inline", "0"]]], [".after\\:-inset-y-2:after", null, 4, [["content", "var(--tw-content)"], ["inset-block", "calc(var(--spacing) * -2)"]]], [".after\\:m-auto:after", null, 4, [["content", "var(--tw-content)"], ["margin", "auto"]]], [".after\\:h-8:after", null, 4, [["content", "var(--tw-content)"], ["height", "calc(var(--spacing) * 8)"]]], [".after\\:h-12:after", null, 4, [["content", "var(--tw-content)"], ["height", "calc(var(--spacing) * 12)"]]], [".after\\:h-\\[3px\\]:after", null, 4, [["content", "var(--tw-content)"], ["height", "3px"]]], [".after\\:w-8:after", null, 4, [["content", "var(--tw-content)"], ["width", "calc(var(--spacing) * 8)"]]], [".after\\:w-\\[3px\\]:after", null, 4, [["content", "var(--tw-content)"], ["width", "3px"]]], [".after\\:rounded-full:after", null, 4, [["content", "var(--tw-content)"], ["border-radius", "3.40282e38px"]]], [".after\\:bg-transparent:after", null, 4, [["content", "var(--tw-content)"], ["background-color", "#0000"]]], [".after\\:content-\\[\\'\\'\\]:after", null, 4, [["--tw-content", '""'], ["content", "var(--tw-content)"]]], [".last\\:border-b-0:last-child", null, 4, [["border-bottom-style", "var(--tw-border-style)"], ["border-bottom-width", "0"]]], [".checked\\:bg-accent:checked", null, 4, [["background-color", "var(--accent)"]]], [".checked\\:before\\:translate-x-\\[1rem\\]:checked:before", null, 4, [["content", "var(--tw-content)"], ["--tw-translate-x", "1rem"], ["translate", "var(--tw-translate-x) var(--tw-translate-y)"]]], [".checked\\:before\\:bg-panel-bg:checked:before", null, 4, [["content", "var(--tw-content)"], ["background-color", "var(--panel-bg)"]]], [".focus-within\\:bg-surface-1:focus-within", null, 4, [["background-color", "var(--surface-1)"]]], [".focus-within\\:outline:focus-within, .focus-within\\:outline-1:focus-within", null, 4, [["outline-style", "var(--tw-outline-style)"], ["outline-width", "1px"]]], [".focus-within\\:outline-fg:focus-within", null, 4, [["outline-color", "var(--text)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_12\\%\\,transparent\\)\\]:hover", null, 4, [["background-color", "var(--accent)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_12\\%\\,transparent\\)\\]:hover", null, 4, [["background-color", "color-mix(in srgb,var(--accent) 12%,transparent)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_15\\%\\,transparent\\)\\]:hover", null, 4, [["background-color", "var(--accent)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_15\\%\\,transparent\\)\\]:hover", null, 4, [["background-color", "color-mix(in srgb,var(--accent) 15%,transparent)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--text\\)_10\\%\\,var\\(--panel-bg\\)\\)\\]:hover", null, 4, [["background-color", "var(--text)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--text\\)_10\\%\\,var\\(--panel-bg\\)\\)\\]:hover", null, 4, [["background-color", "color-mix(in srgb,var(--text) 10%,var(--panel-bg))"]]], [".hover\\:bg-\\[var\\(--surface-0\\)\\]:hover", null, 4, [["background-color", "var(--surface-0)"]]], [".hover\\:bg-accent:hover", null, 4, [["background-color", "var(--accent)"]]], [".hover\\:bg-overlay-0:hover", null, 4, [["background-color", "var(--overlay-0)"]]], [".hover\\:bg-panel-bg:hover", null, 4, [["background-color", "var(--panel-bg)"]]], [".hover\\:bg-surface-0:hover", null, 4, [["background-color", "var(--surface-0)"]]], [".hover\\:bg-surface-1:hover", null, 4, [["background-color", "var(--surface-1)"]]], [".hover\\:bg-transparent:hover", null, 4, [["background-color", "#0000"]]], [".hover\\:text-accent:hover", null, 4, [["color", "var(--accent)"]]], [".hover\\:text-fg:hover", null, 4, [["color", "var(--text)"]]], [".hover\\:text-inherit:hover", null, 4, [["color", "inherit"]]], [".hover\\:text-overlay-0:hover", null, 4, [["color", "var(--overlay-0)"]]], [".hover\\:text-panel-bg:hover", null, 4, [["color", "var(--panel-bg)"]]], [".hover\\:text-red:hover", null, 4, [["color", "var(--red)"]]], [".hover\\:text-subtext-0:hover", null, 4, [["color", "var(--subtext-0)"]]], [".hover\\:text-yellow:hover", null, 4, [["color", "var(--yellow)"]]], [".hover\\:underline:hover", null, 4, [["text-decoration-line", "underline"]]], [".hover\\:opacity-60:hover", null, 4, [["opacity", ".6"]]], [".hover\\:opacity-100\\!:hover", null, 4, [["opacity", "1", 1]]], [".hover\\:opacity-\\[0\\.85\\]:hover", null, 4, [["opacity", ".85"]]], [".hover\\:brightness-110:hover", null, 4, [["--tw-brightness", "brightness(110%)"], ["filter", "var(--tw-blur, ) var(--tw-brightness, ) var(--tw-contrast, ) var(--tw-grayscale, ) var(--tw-hue-rotate, ) var(--tw-invert, ) var(--tw-saturate, ) var(--tw-sepia, ) var(--tw-drop-shadow, )"]]], [".hover\\:\\[filter\\:brightness\\(1\\.08\\)\\]:hover", null, 4, [["filter", "brightness(1.08)"]]], [".hover\\:after\\:bg-overlay-1:hover:after", null, 4, [["content", "var(--tw-content)"], ["background-color", "var(--overlay-1)"]]], [".focus\\:\\[outline\\:1px_solid_var\\(--accent\\)\\]:focus", null, 4, [["outline", "1px solid var(--accent)"]]], [".focus\\:outline-2:focus", null, 4, [["outline-style", "var(--tw-outline-style)"], ["outline-width", "2px"]]], [".focus\\:outline-none:focus", null, 4, [["--tw-outline-style", "none"], ["outline-style", "none"]]], [".focus-visible\\:bg-accent:focus-visible", null, 4, [["background-color", "var(--accent)"]]], [".focus-visible\\:bg-surface-0:focus-visible", null, 4, [["background-color", "var(--surface-0)"]]], [".focus-visible\\:bg-surface-1:focus-visible", null, 4, [["background-color", "var(--surface-1)"]]], [".focus-visible\\:text-accent:focus-visible", null, 4, [["color", "var(--accent)"]]], [".focus-visible\\:text-fg:focus-visible", null, 4, [["color", "var(--text)"]]], [".focus-visible\\:text-panel-bg:focus-visible", null, 4, [["color", "var(--panel-bg)"]]], [".focus-visible\\:text-red:focus-visible", null, 4, [["color", "var(--red)"]]], [".focus-visible\\:text-yellow:focus-visible", null, 4, [["color", "var(--yellow)"]]], [".focus-visible\\:underline:focus-visible", null, 4, [["text-decoration-line", "underline"]]], [".focus-visible\\:opacity-100:focus-visible", null, 4, [["opacity", "1"]]], [".focus-visible\\:\\[outline\\:1px_solid_var\\(--accent\\)\\]:focus-visible", null, 4, [["outline", "1px solid var(--accent)"]]], [".focus-visible\\:\\[outline\\:1px_solid_var\\(--overlay-1\\)\\]:focus-visible", null, 4, [["outline", "1px solid var(--overlay-1)"]]], [".focus-visible\\:\\[outline\\:2px_solid_var\\(--accent\\)\\]:focus-visible", null, 4, [["outline", "2px solid var(--accent)"]]], [".focus-visible\\:outline:focus-visible, .focus-visible\\:outline-1:focus-visible", null, 4, [["outline-style", "var(--tw-outline-style)"], ["outline-width", "1px"]]], [".focus-visible\\:\\[outline-offset\\:-1px\\]:focus-visible", null, 4, [["outline-offset", "-1px"]]], [".focus-visible\\:\\[outline-offset\\:-2px\\]:focus-visible", null, 4, [["outline-offset", "-2px"]]], [".focus-visible\\:\\[outline-offset\\:2px\\]:focus-visible", null, 4, [["outline-offset", "2px"]]], [".focus-visible\\:outline-offset-1:focus-visible", null, 4, [["outline-offset", "1px"]]], [".focus-visible\\:outline-fg:focus-visible", null, 4, [["outline-color", "var(--text)"]]], [".focus-visible\\:after\\:bg-accent:focus-visible:after", null, 4, [["content", "var(--tw-content)"], ["background-color", "var(--accent)"]]], [".active\\:cursor-grabbing:active", null, 4, [["cursor", "grabbing"]]], [".active\\:bg-surface-1:active", null, 4, [["background-color", "var(--surface-1)"]]], [".active\\:text-fg:active", null, 4, [["color", "var(--text)"]]], [".active\\:after\\:bg-accent:active:after", null, 4, [["content", "var(--tw-content)"], ["background-color", "var(--accent)"]]], [".enabled\\:hover\\:bg-surface-1:enabled:hover", null, 4, [["background-color", "var(--surface-1)"]]], [".enabled\\:hover\\:text-fg:enabled:hover", null, 4, [["color", "var(--text)"]]], [".disabled\\:cursor-default:disabled", null, 4, [["cursor", "default"]]], [".disabled\\:cursor-not-allowed:disabled", null, 4, [["cursor", "not-allowed"]]], [".disabled\\:cursor-not-allowed\\!:disabled", null, 4, [["cursor", "not-allowed", 1]]], [".disabled\\:cursor-wait:disabled", null, 4, [["cursor", "wait"]]], [".disabled\\:bg-transparent:disabled", null, 4, [["background-color", "#0000"]]], [".disabled\\:text-fg:disabled", null, 4, [["color", "var(--text)"]]], [".disabled\\:opacity-40:disabled", null, 4, [["opacity", ".4"]]], [".disabled\\:opacity-50:disabled", null, 4, [["opacity", ".5"]]], [".disabled\\:opacity-\\[0\\.45\\]:disabled", null, 4, [["opacity", ".45"]]], [".disabled\\:opacity-\\[0\\.55\\]:disabled", null, 4, [["opacity", ".55"]]], [":where(.app--mac-desktop) .in-\\[\\.app--mac-desktop\\]\\:pl-\\[84px\\]", null, 4, [["padding-left", "84px"]]], [".has-\\[\\:checked\\]\\:bg-surface-0:has(:checked)", null, 4, [["background-color", "var(--surface-0)"]]], [".has-\\[\\:checked\\]\\:text-fg:has(:checked)", null, 4, [["color", "var(--text)"]]], [".has-\\[\\:focus-visible\\]\\:bg-surface-0:has(:focus-visible)", null, 4, [["background-color", "var(--surface-0)"]]], ['.aria-disabled\\:cursor-not-allowed[aria-disabled="true"]', null, 4, [["cursor", "not-allowed"]]], ['.aria-disabled\\:opacity-40[aria-disabled="true"]', null, 4, [["opacity", ".4"]]], ['.aria-expanded\\:opacity-100[aria-expanded="true"]', null, 4, [["opacity", "1"]]], ['.aria-pressed\\:bg-surface-0[aria-pressed="true"]', null, 4, [["background-color", "var(--surface-0)"]]], ['.aria-pressed\\:text-fg[aria-pressed="true"]', null, 4, [["color", "var(--text)"]]], [".motion-reduce\\:animate-none", ["(prefers-reduced-motion: reduce)"], 4, [["animation", "none"]]], [".max-\\[900px\\]\\:hidden", ["not all and (min-width: 900px)"], 4, [["display", "none"]]], [".max-\\[700px\\]\\:hidden", ["not all and (min-width: 700px)"], 4, [["display", "none"]]], [".max-\\[700px\\]\\:size-11", ["not all and (min-width: 700px)"], 4, [["width", "calc(var(--spacing) * 11)"], ["height", "calc(var(--spacing) * 11)"]]], [".max-\\[700px\\]\\:h-9", ["not all and (min-width: 700px)"], 4, [["height", "calc(var(--spacing) * 9)"]]], [".max-\\[700px\\]\\:h-12", ["not all and (min-width: 700px)"], 4, [["height", "calc(var(--spacing) * 12)"]]], [".max-\\[700px\\]\\:min-h-9", ["not all and (min-width: 700px)"], 4, [["min-height", "calc(var(--spacing) * 9)"]]], [".max-\\[700px\\]\\:min-h-11", ["not all and (min-width: 700px)"], 4, [["min-height", "calc(var(--spacing) * 11)"]]], [".max-\\[700px\\]\\:w-24", ["not all and (min-width: 700px)"], 4, [["width", "calc(var(--spacing) * 24)"]]], [".max-\\[700px\\]\\:min-w-11", ["not all and (min-width: 700px)"], 4, [["min-width", "calc(var(--spacing) * 11)"]]], [".max-\\[700px\\]\\:flex-1", ["not all and (min-width: 700px)"], 4, [["flex", "1"]]], [".max-\\[700px\\]\\:flex-\\[1_1_6rem\\]", ["not all and (min-width: 700px)"], 4, [["flex", "6rem"]]], [".max-\\[700px\\]\\:flex-\\[1_1_100\\%\\]", ["not all and (min-width: 700px)"], 4, [["flex", "100%"]]], [".max-\\[700px\\]\\:basis-56", ["not all and (min-width: 700px)"], 4, [["flex-basis", "calc(var(--spacing) * 56)"]]], [".max-\\[700px\\]\\:basis-full", ["not all and (min-width: 700px)"], 4, [["flex-basis", "100%"]]], [".max-\\[700px\\]\\:flex-wrap", ["not all and (min-width: 700px)"], 4, [["flex-wrap", "wrap"]]], [".max-\\[700px\\]\\:gap-y-2", ["not all and (min-width: 700px)"], 4, [["row-gap", "calc(var(--spacing) * 2)"]]], [".min-\\[701px\\]\\:left-auto", ["(min-width: 701px)"], 4, [["left", "auto"]]], [".min-\\[701px\\]\\:my-\\[3px\\]", ["(min-width: 701px)"], 4, [["margin-block", "3px"]]], [".min-\\[701px\\]\\:block", ["(min-width: 701px)"], 4, [["display", "block"]]], [".min-\\[701px\\]\\:hidden", ["(min-width: 701px)"], 4, [["display", "none"]]], [".min-\\[701px\\]\\:min-h-6", ["(min-width: 701px)"], 4, [["min-height", "calc(var(--spacing) * 6)"]]], [".min-\\[701px\\]\\:w-80", ["(min-width: 701px)"], 4, [["width", "calc(var(--spacing) * 80)"]]], [".min-\\[701px\\]\\:rounded-ui", ["(min-width: 701px)"], 4, [["border-radius", "var(--radius)"]]], [".min-\\[701px\\]\\:px-3", ["(min-width: 701px)"], 4, [["padding-inline", "calc(var(--spacing) * 3)"]]], [".min-\\[701px\\]\\:px-4", ["(min-width: 701px)"], 4, [["padding-inline", "calc(var(--spacing) * 4)"]]], [".min-\\[701px\\]\\:pr-\\[3px\\]", ["(min-width: 701px)"], 4, [["padding-right", "3px"]]], [".min-\\[701px\\]\\:pl-4", ["(min-width: 701px)"], 4, [["padding-left", "calc(var(--spacing) * 4)"]]], [".min-\\[701px\\]\\:text-\\[0\\.62rem\\]", ["(min-width: 701px)"], 4, [["font-size", ".62rem"]]], [".min-\\[701px\\]\\:text-\\[12\\.5px\\]", ["(min-width: 701px)"], 4, [["font-size", "12.5px"]]], [".min-\\[701px\\]\\:text-\\[12px\\]", ["(min-width: 701px)"], 4, [["font-size", "12px"]]], [".min-\\[701px\\]\\:font-medium", ["(min-width: 701px)"], 4, [["--tw-font-weight", "var(--font-weight-medium)"], ["font-weight", "var(--font-weight-medium)"]]], [".min-\\[701px\\]\\:font-semibold", ["(min-width: 701px)"], 4, [["--tw-font-weight", "var(--font-weight-semibold)"], ["font-weight", "var(--font-weight-semibold)"]]], [".min-\\[701px\\]\\:tracking-\\[0\\.045em\\]", ["(min-width: 701px)"], 4, [["--tw-tracking", ".045em"], ["letter-spacing", ".045em"]]], [".min-\\[701px\\]\\:text-subtext-0", ["(min-width: 701px)"], 4, [["color", "var(--subtext-0)"]]], [".min-\\[701px\\]\\:uppercase", ["(min-width: 701px)"], 4, [["text-transform", "uppercase"]]], [".min-\\[900px\\]\\:inline", ["(min-width: 900px)"], 4, [["display", "inline"]]], [".pointer-coarse\\:opacity-100", ["(pointer: coarse)"], 4, [["opacity", "1"]]], [".\\[\\&_\\.mode-switch\\]\\:ml-0 .mode-switch", null, 4, [["margin-left", "0"]]], [".max-\\[700px\\]\\:\\[\\&_button\\]\\:min-h-11 button", ["not all and (min-width: 700px)"], 4, [["min-height", "calc(var(--spacing) * 11)"]]], [".\\[\\&_pre\\]\\:m-\\[0\\.2rem_0_0\\.3rem_1\\.2rem\\] pre", null, 4, [["margin", ".2rem 0 .3rem 1.2rem"]]], [".\\[\\&_pre\\]\\:max-h-72 pre", null, 4, [["max-height", "calc(var(--spacing) * 72)"]]], [".\\[\\&_pre\\]\\:overflow-auto pre", null, 4, [["overflow", "auto"]]], [".\\[\\&_pre\\]\\:rounded-ui pre", null, 4, [["border-radius", "var(--radius)"]]], [".\\[\\&_pre\\]\\:bg-surface-0 pre", null, 4, [["background-color", "var(--surface-0)"]]], [".\\[\\&_pre\\]\\:p-2 pre", null, 4, [["padding", "calc(var(--spacing) * 2)"]]], [".\\[\\&_pre\\]\\:text-\\[0\\.78rem\\] pre", null, 4, [["font-size", ".78rem"]]], [".\\[\\&_pre\\]\\:\\[overflow-wrap\\:anywhere\\] pre", null, 4, [["overflow-wrap", "anywhere"]]], [".\\[\\&_pre\\]\\:whitespace-pre-wrap pre", null, 4, [["white-space", "pre-wrap"]]], [".\\[\\&_pre\\]\\:text-fg pre, .\\[\\&_strong\\]\\:text-fg strong", null, 4, [["color", "var(--text)"]]], [".\\[\\&_summary\\]\\:cursor-pointer summary", null, 4, [["cursor", "pointer"]]], [".\\[\\&\\:hover\\:not\\(\\:disabled\\)\\]\\:bg-surface-1:hover:not(:disabled)", null, 4, [["background-color", "var(--surface-1)"]]], [".\\[\\&\\:hover\\:not\\(\\:disabled\\)\\]\\:text-accent:hover:not(:disabled)", null, 4, [["color", "var(--accent)"]]], [".\\[\\&\\:hover\\:not\\(\\:disabled\\)\\]\\:text-red:hover:not(:disabled)", null, 4, [["color", "var(--red)"]]], [".\\[\\&\\:not\\(\\:has\\(\\[data-setting-row\\]\\)\\)\\>\\[data-none\\]\\]\\:block:not(:has([data-setting-row])) > [data-none]", null, 4, [["display", "block"]]], [".\\[\\&\\>\\*\\]\\:min-h-0 > *", null, 4, [["min-height", "0"]]], [".\\[\\&\\>\\*\\]\\:min-w-0 > *", null, 4, [["min-width", "0"]]], [".\\[\\&\\>\\*\\]\\:flex-1 > *", null, 4, [["flex", "1"]]], [".\\[\\&\\>\\*\\]\\:shrink-0 > *", null, 4, [["flex-shrink", "0"]]], [".\\[\\&\\>li\\]\\:text-\\[0\\.85rem\\] > li", null, 4, [["font-size", ".85rem"]]], [".\\[\\&\\>li\\]\\:leading-\\[1\\.5\\] > li", null, 4, [["--tw-leading", "1.5"], ["line-height", "1.5"]]], [".\\[\\&\\>li\\]\\:text-fg > li", null, 4, [["color", "var(--text)"]]], [".\\[\\&\\>summary\\]\\:flex > summary", null, 4, [["display", "flex"]]], [".\\[\\&\\>summary\\]\\:cursor-pointer > summary", null, 4, [["cursor", "pointer"]]], [".\\[\\&\\>summary\\]\\:list-none > summary", null, 4, [["list-style-type", "none"]]], [".\\[\\&\\>summary\\]\\:items-center > summary", null, 4, [["align-items", "center"]]], [".\\[\\&\\>summary\\]\\:gap-\\[0\\.4rem\\] > summary", null, 4, [["gap", ".4rem"]]], [".\\[\\&\\>summary\\]\\:rounded-ui > summary", null, 4, [["border-radius", "var(--radius)"]]], [".\\[\\&\\>summary\\]\\:px-\\[0\\.4rem\\] > summary", null, 4, [["padding-inline", ".4rem"]]], [".\\[\\&\\>summary\\]\\:py-\\[0\\.25rem\\] > summary", null, 4, [["padding-block", ".25rem"]]], [".\\[\\&\\>summary\\]\\:select-none > summary", null, 4, [["-webkit-user-select", "none"], ["user-select", "none"]]], [".\\[\\&\\>summary\\]\\:before\\:inline-block > summary:before", null, 4, [["content", "var(--tw-content)"], ["display", "inline-block"]]], [".\\[\\&\\>summary\\]\\:before\\:size-\\[0\\.4rem\\] > summary:before", null, 4, [["content", "var(--tw-content)"], ["width", ".4rem"], ["height", ".4rem"]]], [".\\[\\&\\>summary\\]\\:before\\:shrink-0 > summary:before", null, 4, [["content", "var(--tw-content)"], ["flex-shrink", "0"]]], [".\\[\\&\\>summary\\]\\:before\\:\\[transform\\:rotate\\(-45deg\\)\\] > summary:before", null, 4, [["content", "var(--tw-content)"], ["transform", "rotate(-45deg)"]]], [".\\[\\&\\>summary\\]\\:before\\:content-\\[\\'\\'\\] > summary:before", null, 4, [["--tw-content", '""'], ["content", "var(--tw-content)"]]], [".\\[\\&\\>summary\\]\\:before\\:\\[border-bottom\\:1\\.3px_solid_currentColor\\] > summary:before", null, 4, [["content", "var(--tw-content)"], ["border-bottom", "1.3px solid"]]], [".\\[\\&\\>summary\\]\\:before\\:\\[border-right\\:1\\.3px_solid_currentColor\\] > summary:before", null, 4, [["content", "var(--tw-content)"], ["border-right", "1.3px solid"]]], [".\\[\\&\\>summary\\]\\:before\\:\\[transition\\:transform_0\\.15s_ease\\] > summary:before", null, 4, [["content", "var(--tw-content)"], ["transition", "transform .15s"]]], [".\\[\\&\\>summary\\:hover\\]\\:bg-surface-1 > summary:hover", null, 4, [["background-color", "var(--surface-1)"]]], [".\\[\\&\\>summary\\:hover\\]\\:text-fg > summary:hover", null, 4, [["color", "var(--text)"]]], [".\\[\\&\\[open\\]\\>summary\\]\\:before\\:\\[transform\\:rotate\\(45deg\\)\\][open] > summary:before", null, 4, [["content", "var(--tw-content)"], ["transform", "rotate(45deg)"]]], [".app--mobile .\\[\\.app--mobile_\\&\\]\\:min-h-11", null, 4, [["min-height", "calc(var(--spacing) * 11)"]]], [".app--mobile .\\[\\.app--mobile_\\&\\]\\:min-h-\\[44px\\]", null, 4, [["min-height", "44px"]]], [".\\[\\@media\\(hover\\:none\\)\\]\\:opacity-60", ["(hover: none)"], 4, [["opacity", ".6"]]], [".\\[\\@media\\(hover\\:none\\)\\]\\:opacity-100", ["(hover: none)"], 4, [["opacity", "1"]]], [".\\[\\@media\\(max-width\\:700px\\)\\]\\:h-\\[2\\.75rem\\]", ["(max-width: 700px)"], 4, [["height", "2.75rem"]]], [".\\[\\@media\\(max-width\\:700px\\)\\]\\:min-h-\\[2\\.75rem\\]", ["(max-width: 700px)"], 4, [["min-height", "2.75rem"]]], [".\\[\\@media\\(max-width\\:700px\\)\\]\\:w-\\[2\\.75rem\\]", ["(max-width: 700px)"], 4, [["width", "2.75rem"]]], [".\\[\\@media\\(max-width\\:700px\\)\\]\\:min-w-\\[2\\.75rem\\]", ["(max-width: 700px)"], 4, [["min-width", "2.75rem"]]], [".\\[\\@media\\(max-width\\:700px\\)\\]\\:px-\\[0\\.65rem\\]", ["(max-width: 700px)"], 4, [["padding-inline", ".65rem"]]], ["div:hover > .\\[div\\:hover\\>\\&\\]\\:opacity-100", null, 4, [["opacity", "1"]]], [":root", null, 1e3, [["color-scheme", "dark"], ["--scrollbar-size", "6px"], ["--accent", "#c8c8c8"], ["--panel-bg", "#161616"], ["--surface-0", "#262626"], ["--surface-1", "#333"], ["--surface-dim", "#1c1c1c"], ["--backdrop", "#050505"], ["--overlay-0", "#3a3a3a"], ["--overlay-1", "#9b9b9b"], ["--text", "#d8d8d8"], ["--subtext-0", "#9b9b9b"], ["--mauve", "#a993c9"], ["--green", "#7fb685"], ["--yellow", "#d3b46a"], ["--red", "#df8c8c"], ["--blue", "#7aa2d7"], ["--teal", "#7fb8b8"], ["--peach", "#d39a6a"], ["--bg", "var(--panel-bg)"], ["--surface", "var(--surface-0)"], ["--surface-alt", "var(--surface-1)"], ["--border", "var(--overlay-0)"], ["--muted", "var(--subtext-0)"], ["--danger", "var(--red)"], ["--radius", "8px"], ["--radius-pane", "8px"], ["accent-color", "var(--accent)"], ["--font-ui", '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif'], ["--font-mono", `ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono",
    monospace`], ["font-family", "var(--font-ui)"]]], ["code, pre, kbd, samp", null, 1e3, [["font-family", "var(--font-mono)"]]], ["*", null, 1e3, [["box-sizing", "border-box"]]], ["html, body, #root", null, 1e3, [["height", "100%"], ["margin", "0"]]], ["html", null, 1e3, [["overscroll-behavior", "none"], ["--shell-bg", "var(--panel-bg)"]]], ["html[data-glass]", null, 1e3, [["--shell-bg", "var(--panel-bg)"]]], ["html[data-glass]", null, 1e3, [["--shell-bg", "color-mix(in srgb, var(--panel-bg) 86%, transparent)"]]], ["html", null, 1e3, [["--backdrop-bg", "var(--backdrop)"], ["--card-bg", "var(--panel-bg)"]]], ["html[data-glass]", null, 1e3, [["--backdrop-bg", "var(--backdrop)"]]], ["html[data-glass]", null, 1e3, [["--backdrop-bg", "color-mix(in srgb, var(--backdrop) 86%, transparent)"]]], ["html[data-glass]", null, 1e3, [["--card-bg", "var(--panel-bg)"]]], ["html[data-glass]", null, 1e3, [["--card-bg", "color-mix(in srgb, var(--panel-bg) 86%, transparent)"]]], ['body:has(.app--cards, .app--mobile), .app--cards .dock-area:has([data-testid="split-canvas"]:not([data-split="0"]))', null, 1e3, [["background", "var(--backdrop-bg)"]]], ["body", null, 1e3, [["background", "var(--shell-bg)"], ["color", "var(--text)"], ["overscroll-behavior", "none"], ["-webkit-tap-highlight-color", "transparent"], ["line-height", "1.3"]]], [".app", null, 1e3, [["flex-direction", "column"], ["height", "100dvh"], ["display", "flex"]]], [".app--mobile", null, 1e3, [["inset", "var(--visible-top, 0px) 0 auto 0"], ["height", "var(--visible-height, 100dvh)"], ["position", "fixed"]]], [".mobile-drawer-backdrop", null, 1e3, [["animation", ".15s ease-out mobile-fade"]]], [".mobile-drawer--left", null, 1e3, [["animation", ".2s cubic-bezier(.2, .8, .2, 1) mobile-slide-left"]]], [".mobile-drawer--right", null, 1e3, [["animation", ".2s cubic-bezier(.2, .8, .2, 1) mobile-slide-right"]]], [".mobile-sheet", null, 1e3, [["animation", ".22s cubic-bezier(.2, .8, .2, 1) mobile-rise"]]], [".mobile-drawer-backdrop, .mobile-drawer, .mobile-sheet", ["(prefers-reduced-motion: reduce)"], 1e3, [["animation", "none"]]], [".layout-drawer", null, 1e3, [["transform", "translateX(var(--float-hide, 0))"], ["transition", "transform .18s"]]], [".layout-drawer:hover, .layout-drawer:focus-within", null, 1e3, [["--float-hide", "0px"]]], [".dockview-theme-perch", null, 1e3, [["--dv-color-abyss-dark", "var(--panel-bg)"], ["--dv-color-abyss", "var(--surface-0)"], ["--dv-color-abyss-light", "var(--surface-1)"], ["--dv-color-abyss-lighter", "var(--overlay-0)"], ["--dv-color-abyss-accent", "var(--accent)"], ["--dv-color-abyss-primary-text", "var(--text)"], ["--dv-color-abyss-secondary-text", "var(--subtext-0)"], ["--dv-group-view-background-color", "var(--panel-bg)"], ["--dv-tabs-and-actions-container-background-color", "var(--surface-0)"], ["--dv-activegroup-visiblepanel-tab-background-color", "var(--panel-bg)"], ["--dv-activegroup-hiddenpanel-tab-background-color", "var(--surface-0)"], ["--dv-inactivegroup-visiblepanel-tab-background-color", "var(--panel-bg)"], ["--dv-inactivegroup-hiddenpanel-tab-background-color", "var(--surface-0)"], ["--dv-tab-divider-color", "var(--overlay-0)"], ["--dv-activegroup-visiblepanel-tab-color", "var(--text)"], ["--dv-activegroup-hiddenpanel-tab-color", "var(--subtext-0)"], ["--dv-inactivegroup-visiblepanel-tab-color", "var(--subtext-0)"], ["--dv-inactivegroup-hiddenpanel-tab-color", "var(--subtext-0)"], ["--dv-separator-border", "var(--overlay-0)"], ["--dv-paneview-header-border-color", "var(--overlay-0)"], ["--dv-tabs-and-actions-container-font-size", ".82rem"], ["--dv-tabs-and-actions-container-height", "2.1rem"]]], [".dockview-theme-perch .dv-tabs-and-actions-container", null, 1e3, [["z-index", "1"], ["position", "relative"]]], [".pane-tab", null, 1e3, [["align-items", "center"], ["width", "100%"], ["height", "100%"], ["display", "flex"]]], [".pane-tab__agent-badge", null, 1e3, [["color", "var(--subtext-0)"], ["white-space", "nowrap"], ["flex-shrink", "0"], ["margin-right", ".4rem"], ["font-size", ".78em"]]], ['.pane-tab[data-testid="pane-tab-chat"] .dv-default-tab-action', null, 1e3, [["display", "none"]]], [".dockview-group-action", null, 1e3, [["border-radius", "var(--radius)"], ["width", "1.5rem"], ["height", "1.5rem"], ["color", "var(--subtext-0)"], ["cursor", "pointer"], ["background", "none"], ["border", "none"], ["justify-content", "center"], ["align-self", "center"], ["align-items", "center"], ["margin", "0 .15rem"], ["font-size", "1rem"], ["line-height", "1"], ["transition", "color .1s, background .1s"], ["display", "flex"]]], [".dockview-group-action:hover", null, 1e3, [["color", "var(--text)"], ["background", "var(--surface-1)"]]], [".dockview-theme-perch .dv-view-container > .dv-view:has(.dv-inactive-group)", ["(max-width: 700px)"], 1e3, [["display", "none"]]], [".dockview-theme-perch .dv-view-container > .dv-view:has(.dv-active-group)", ["(max-width: 700px)"], 1e3, [["width", "100%", 1], ["left", "0", 1]]], [".chat", null, 1e3, [["isolation", "isolate"], ["flex-direction", "column"], ["flex", "1"], ["height", "100%"], ["min-height", "0"], ["display", "flex"]]], [".message__markdown p", null, 1e3, [["margin", "0 0 .5em"]]], [".message__markdown p:last-child", null, 1e3, [["margin-bottom", "0"]]], [".message__markdown h1, .message__markdown h2, .message__markdown h3, .message__markdown h4", null, 1e3, [["margin", ".6em 0 .3em"], ["line-height", "1.25"]]], [".message__markdown h1", null, 1e3, [["font-size", "1.25em"]]], [".message__markdown h2", null, 1e3, [["font-size", "1.12em"]]], [".message__markdown h3", null, 1e3, [["font-size", "1em"]]], [".message__markdown > * + *", null, 1e3, [["margin-top", ".5em"]]], [".message__markdown table, .md-table", null, 1e3, [["border-collapse", "separate"], ["border-spacing", "0"], ["background", "var(--surface-0)"], ["border-radius", "var(--radius)"], ["max-width", "100%"], ["margin", ".5em 0"], ["font-size", ".92em"], ["display", "block"], ["overflow-x", "auto"]]], [".md-table", null, 1e3, [["width", "100%"], ["margin", "0"], ["display", "table"]]], [".message__markdown th, .message__markdown td, .md-table th, .md-table td", null, 1e3, [["text-align", "left"], ["vertical-align", "top"], ["border-bottom", "1px solid var(--surface-1)"], ["padding", ".35em .75em"]]], [".message__markdown th, .md-table th", null, 1e3, [["color", "var(--subtext-0)"], ["white-space", "nowrap"], ["background", "var(--surface-1)"], ["font-weight", "600"]]], [".message__markdown tbody tr:last-child td, .md-table tbody tr:last-child td", null, 1e3, [["border-bottom", "0"]]], [".message__markdown tbody tr:hover td, .md-table tbody tr:hover td", null, 1e3, [["background", "var(--surface-1)"]]], [".md-table caption", null, 1e3, [["text-align", "left"], ["color", "var(--subtext-0)"], ["padding", ".4em .75em"]]], [".md-code", null, 1e3, [["background", "var(--surface-0)"], ["border-radius", "var(--radius)"], ["overflow", "hidden"]]], [".md-code__bar", null, 1e3, [["color", "var(--subtext-0)"], ["background", "var(--surface-1)"], ["justify-content", "space-between"], ["align-items", "center"], ["padding", ".1rem .4rem .1rem .75rem"], ["font-size", ".75em"], ["display", "flex"]]], [".message__markdown .md-code pre", null, 1e3, [["background", "none"], ["border-radius", "0"], ["margin", "0"]]], [".hl-keyword", null, 1e3, [["color", "var(--mauve)"]]], [".hl-string", null, 1e3, [["color", "var(--green)"]]], [".hl-number", null, 1e3, [["color", "var(--peach)"]]], [".hl-function", null, 1e3, [["color", "var(--blue)"]]], [".hl-type", null, 1e3, [["color", "var(--yellow)"]]], [".hl-tag", null, 1e3, [["color", "var(--teal)"]]], [".hl-comment", null, 1e3, [["color", "var(--overlay-1)"], ["font-style", "italic"]]], [".message__markdown ul, .message__markdown ol", null, 1e3, [["margin", ".3em 0 .5em 1.3em"], ["padding", "0"]]], [".message__markdown li", null, 1e3, [["margin-bottom", ".2em"]]], [".message__markdown code", null, 1e3, [["background", "var(--surface-0)"], ["border-radius", ".25rem"], ["padding", ".1em .35em"], ["font-family", "ui-monospace, SFMono-Regular, SF Mono, Menlo, Consolas, monospace"], ["font-size", ".88em"]]], [".message__markdown pre", null, 1e3, [["background", "var(--surface-0)"], ["border-radius", "var(--radius)"], ["margin", ".4em 0"], ["padding", ".6rem .75rem"], ["position", "relative"], ["overflow-x", "auto"]]], [".message__markdown pre code", null, 1e3, [["background", "none"], ["border", "none"], ["padding", "0"], ["font-size", ".85em"]]], [".message__markdown a", null, 1e3, [["color", "var(--accent)"], ["text-decoration", "underline"]]], [".message__markdown blockquote", null, 1e3, [["border-left", "3px solid var(--overlay-0)"], ["color", "var(--subtext-0)"], ["margin", ".4em 0"], ["padding", ".1em .6em"]]], [".message__markdown hr", null, 1e3, [["border", "none"], ["border-top", "1px solid var(--overlay-0)"], ["margin", ".75em 0"]]], [".file-markdown", null, 1e3, [["overflow-wrap", "anywhere"]]], [".file-markdown img", null, 1e3, [["max-width", "100%"]]], [".file-markdown table", null, 1e3, [["border-collapse", "collapse"], ["margin", ".4em 0"], ["display", "block"], ["overflow-x", "auto"]]], [".file-markdown th, .file-markdown td", null, 1e3, [["border", "1px solid var(--overlay-0)"], ["padding", ".2em .5em"]]], [".file-markdown .md-placeholder", null, 1e3, [["color", "var(--subtext-0)"], ["border", "1px dashed var(--overlay-0)"], ["border-radius", ".25rem"], ["padding", ".05em .35em"], ["font-size", ".9em"]]], [".terminal", null, 1e3, [["min-width", "0"], ["min-height", "0"], ["padding", "var(--terminal-padding, 0)"], ["opacity", "var(--terminal-opacity, 1)"], ["flex", "1"], ["display", "flex"], ["position", "relative"]]], [".terminal__surface", null, 1e3, [["flex", "1"], ["min-width", "0"], ["min-height", "0"], ["overflow", "hidden"]]], [".terminal__surface .xterm", null, 1e3, [["height", "100%"]]], [".terminal__surface .xterm:not(.allow-transparency) .xterm-viewport", null, 1e3, [["background-color", "#0000"]]], [".terminal__surface .xterm-scrollable-element", null, 1e3, [["position", "static", 1]]], [".terminal__surface .xterm-decoration-overview-ruler, .no-pane-scrollbars .terminal__surface .xterm-scrollable-element > .xterm-scrollbar", null, 1e3, [["display", "none"]]], [".terminal--persistent", null, 1e3, [["flex-direction", "column"]]], [".terminal__toolbar", null, 1e3, [["color", "var(--subtext-0)"], ["align-items", "center"], ["gap", ".5rem"], ["padding", ".25rem 1.5rem .25rem .5rem"], ["font-size", ".8rem"], ["display", "flex"]]], [".terminal__toolbar button", null, 1e3, [["border-radius", "var(--radius)"], ["min-height", "32px"], ["color", "var(--text)"], ["background", "var(--surface-0)"], ["border", "0"], ["padding", ".25rem .5rem"]]], [".terminal__toolbar--overlay", null, 1e3, [["z-index", "2"], ["border-radius", "var(--radius)"], ["background", "var(--surface-1)"], ["padding", ".2rem .3rem .2rem .6rem"], ["position", "absolute"], ["top", ".4rem"], ["right", ".9rem"], ["box-shadow", "0 2px 8px #00000040"]]], [".terminal__connection", null, 1e3, [["margin-right", "auto"]]], [".terminal__toolbar button:disabled", null, 1e3, [["opacity", ".5"]]], [".terminal__notice", null, 1e3, [["color", "var(--subtext-0)"], ["padding", ".75rem"], ["font-size", ".85rem"]]], [".app--mobile .terminal__toolbar button", null, 1e3, [["min-height", "44px"]]], [".app--mobile .terminal__connection", null, 1e3, [["display", "none"]]], [".app--mobile .terminal__toolbar", null, 1e3, [["padding-right", ".5rem"]]], [".terminal__exited", null, 1e3, [["background", "var(--surface-1)"], ["border-radius", "var(--radius)"], ["color", "var(--subtext-0)"], ["padding", ".35rem .75rem"], ["font-size", ".85rem"], ["position", "absolute"], ["bottom", ".75rem"], ["left", "50%"], ["transform", "translateX(-50%)"]]], [".terminal__exited--cli", null, 1e3, [["background", "var(--panel-bg)"], ["flex-direction", "column"], ["align-items", "center"], ["gap", ".6rem"], ["padding", ".9rem 1.1rem"], ["display", "flex"], ["top", "50%"], ["bottom", "auto"], ["transform", "translate(-50%, -50%)"], ["box-shadow", "0 6px 24px #00000059"]]], [".terminal__exited-actions", null, 1e3, [["gap", ".5rem"], ["display", "flex"]]], [".terminal__cli-error", null, 1e3, [["background", "var(--red)"], ["position", "absolute"], ["bottom", ".75rem"], ["left", "50%"], ["transform", "translateX(-50%)"]]], [".terminal__cli-error", null, 1e3, [["background", "color-mix(in srgb, var(--red) 20%, var(--panel-bg))"]]], [".terminal__cli-error", null, 1e3, [["border-radius", "var(--radius)"], ["color", "var(--red)"], ["text-align", "center"], ["white-space", "pre-wrap"], ["word-break", "break-word"], ["max-width", "90%"], ["padding", ".35rem .75rem"], ["font-size", ".85rem"]]], [".mobile-pane-shell__content > .chat, .mobile-pane-shell__content > .terminal, .mobile-pane-shell__content > .workspace-files, .mobile-pane-shell__content > .workspace-git", null, 1e3, [["flex", "1"], ["width", "100%"], ["min-width", "0"], ["height", "100%"], ["min-height", "0"]]], [".terminal__host", null, 1e3, [["width", "100%"], ["height", "100%"], ["overflow", "hidden"]]], [".workspace-git", null, 1e3, [["--git-border", "var(--overlay-0)"]]], [".workspace-git", null, 1e3, [["--git-border", "color-mix(in srgb, var(--overlay-0) 72%, transparent)"]]], [".workspace-git", null, 1e3, [["--git-muted", "var(--subtext-0)"], ["width", "100%"], ["min-width", "0"], ["height", "100%"], ["min-height", "0"], ["color", "var(--text)"], ["background", "var(--workspace-tools-bg, var(--panel-bg))"], ["flex-direction", "column"], ["font-size", ".78rem"], ["display", "flex"], ["position", "relative"], ["overflow", "hidden"], ["container-type", "inline-size"]]], [".workspace-git button, .workspace-git input, .workspace-git textarea", null, 1e3, [["font", "inherit"]]], [".workspace-git button", null, 1e3, [["cursor", "pointer"]]], ['.workspace-git button:focus-visible, .workspace-git input:focus-visible, .workspace-git textarea:focus-visible, .workspace-git [role="button"]:focus-visible', null, 1e3, [["outline", "2px solid var(--accent)"], ["outline-offset", "1px"]]], [".workspace-git__diff", null, 1e3, [["container-type", "inline-size"]]], [".workspace-git__line-comment-thread", null, 1e3, [["max-width", "max(0px, min(42rem, 100cqi - 6.9rem))"], ["position", "sticky"], ["left", "0"]]], [".workspace-git__comment-composer", null, 1e3, [["max-width", "max(0px, 100cqi - 1.4rem)"], ["position", "sticky"], ["left", "0"]]], [".dockview-group-action--split-session", null, 1e3, [["font-size", "13px"]]], [".session-split-popover", null, 1e3, [["display", "flex"], ["flex-direction", "column"], ["background", "var(--surface-1)"], ["border-radius", "var(--radius)"], ["box-shadow", "0 8px 24px rgba(0, 0, 0, 0.45)"], ["padding", "4px"], ["font-size", "12.5px"], ["color", "var(--text)"], ["overflow", "hidden"]]], [".session-split-popover__header", null, 1e3, [["padding", "6px 8px 4px"], ["font-size", "11px"], ["text-transform", "uppercase"], ["letter-spacing", "0.04em"], ["color", "var(--subtext-0)"]]], [".session-split-popover__empty", null, 1e3, [["padding", "8px"], ["color", "var(--subtext-0)"]]], [".session-split-popover__list", null, 1e3, [["overflow-y", "auto"]]], [".session-split-popover__item", null, 1e3, [["display", "flex"], ["flex-direction", "column"], ["align-items", "flex-start"], ["gap", "1px"], ["width", "100%"], ["padding", "6px 8px"], ["border", "none"], ["border-radius", "4px"], ["background", "transparent"], ["color", "inherit"], ["text-align", "left"], ["cursor", "grab"]]], [".session-split-popover__item:hover", null, 1e3, [["background", "var(--surface-0)"]]], [".session-split-popover__item-title", null, 1e3, [["font-weight", "500"], ["white-space", "nowrap"], ["overflow", "hidden"], ["text-overflow", "ellipsis"], ["max-width", "100%"]]], [".session-split-popover__item-cwd", null, 1e3, [["font-size", "11px"], ["color", "var(--subtext-0)"], ["white-space", "nowrap"], ["overflow", "hidden"], ["text-overflow", "ellipsis"], ["max-width", "100%"]]], [".session-split-popover__item-badge", null, 1e3, [["align-self", "flex-end"], ["font-size", "10px"], ["color", "var(--accent)"], ["margin-top", "-14px"]]], [".inactive-session-pane", null, 1e3, [["display", "flex"], ["flex-direction", "column"], ["align-items", "center"], ["justify-content", "center"], ["gap", "10px"], ["height", "100%"], ["padding", "24px"], ["text-align", "center"], ["color", "var(--subtext-0)"]]], [".inactive-session-pane__title", null, 1e3, [["font-size", "14px"], ["font-weight", "500"], ["color", "var(--text)"]]], [".inactive-session-pane__cwd", null, 1e3, [["font-size", "12px"], ["color", "var(--subtext-0)"], ["word-break", "break-all"]]], [".inactive-session-pane__note", null, 1e3, [["font-size", "12px"], ["max-width", "320px"], ["line-height", "1.5"]]], [".inactive-session-pane__switch", null, 1e3, [["margin-top", "4px"], ["padding", "6px 14px"], ["border-radius", "var(--radius)"], ["border", "0"], ["background", "var(--surface-0)"], ["color", "var(--text)"], ["cursor", "pointer"], ["font-size", "12.5px"]]], [".inactive-session-pane__switch:hover", null, 1e3, [["background", "var(--surface-1)"]]]], skipped: { "@supports evaluated false": 2, "@container": 6, "@keyframes": 9 } };
//! The app's compiled stylesheet as a table (`build.mjs` writes it from Vite + Tailwind's output and bundles it as
//! `virtual:perch-css-table`), parsed once on first use.
let zg = null;
const Ng = () => zg ??= new Q0(Eg);
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
let sa = zl.NoEventPriority;
function Tg(n, l) {
  const o = /* @__PURE__ */ new Set([...Object.keys(n), ...Object.keys(l)]);
  for (const i of o) {
    if (i === "children") continue;
    const s = n[i], f = l[i];
    if (!(s === f || typeof s == "function" && typeof f == "function") && !(i === "style" && s && f && typeof s == "object" && typeof f == "object" && [.../* @__PURE__ */ new Set([...Object.keys(s), ...Object.keys(f)])].every((d) => s[d] === f[d])))
      return !0;
  }
  return !1;
}
const Cg = (n) => !n.props.disabled && (/^(button|input|select|textarea)$/.test(n.tagName) || n.tagName === "a" && n.props.href != null || n.props.tabIndex != null);
function Pd(n, l) {
  for (const o of i0(l.dangerouslySetInnerHTML?.__html, n.ownerDocument) ?? []) n.appendChild(o);
  return n;
}
const Mg = {
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
  createInstance: (n, l, o) => Pd(new $t(n, l, o.ownerDocument), l),
  createTextInstance: (n, l) => new ai(n),
  appendInitialChild: (n, l) => {
    n.appendChild(l);
  },
  // `autoFocus` focuses the element once it is in the tree, as React DOM does.
  finalizeInitialChildren: (n, l, o) => !!o.autoFocus,
  shouldSetTextContent: () => !1,
  appendChild: (n, l) => {
    n.appendChild(l);
  },
  appendChildToContainer: (n, l) => {
    n.appendChild(l);
  },
  insertBefore: (n, l, o) => {
    n.insertBefore(l, o);
  },
  insertInContainerBefore: (n, l, o) => {
    n.insertBefore(l, o);
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
  commitUpdate: (n, l, o, i) => {
    if (n.props = i, n.inline) for (const s of Object.keys(n.inline)) o.style?.[s] !== i.style?.[s] && delete n.inline[s];
    if (o.dangerouslySetInnerHTML?.__html !== i.dangerouslySetInnerHTML?.__html) {
      for (const s of [...n.childNodes]) n.removeChild(s);
      Pd(n, i);
    }
    Tg(o, i) && n.touch();
  },
  commitTextUpdate: (n, l, o) => {
    n.data = String(o);
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
  resolveUpdatePriority: () => sa !== zl.NoEventPriority ? sa : zl.DefaultEventPriority,
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
}, Ne = T0(Mg), Cl = (n, l, o = null) => Ne.createPortal(n, l, null, o), Ag = {
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
}, jg = /* @__PURE__ */ new Set(["click", "dblclick", "mousedown", "mouseup"]), Og = /* @__PURE__ */ new Set(["button", "input", "select", "textarea", "fieldset"]), Rg = (n) => {
  for (let l = n; l instanceof $t; l = l.parentNode) if (l.props.disabled && Og.has(l.tagName)) return !0;
  return !1;
};
class Dg {
  constructor(l, o, i) {
    Object.assign(this, { clientX: 0, clientY: 0, button: 0, buttons: 0, pointerType: "mouse", key: "", code: "", shiftKey: !1, metaKey: !1, ctrlKey: !1, altKey: !1, repeat: !1, isComposing: !1, keyCode: 0 }, o), this.type = l, this.target = i, this.currentTarget = null, this.defaultPrevented = !1, this.propagationStopped = !1, this.timeStamp = Date.now();
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
function jr(n, l, o) {
  l.currentTarget = n;
  for (const { type: i, listener: s, capture: f } of [...n.listeners ?? []])
    i === l.type && f === o && s.call(n, l);
  if (n instanceof $t) {
    const i = Ag[l.type], s = i && n.props[o ? `${i}Capture` : i];
    typeof s == "function" && s(l);
  }
}
function jy(n, l, o = {}) {
  const { document: i, window: s, globals: f } = d0(n), m = new $t("div", { id: "root", style: o.container ?? {} }, i);
  i.body.appendChild(m);
  const d = [];
  let p = null;
  const y = () => [i, s].map((D) => D.listeners.map((h) => `${h.type}:${h.capture}`).sort().join(",")).join("|");
  let E = "";
  const _ = {}, x = `m${Math.random().toString(36).slice(2, 10)}:`;
  let z = 0, k = -1;
  i.measureKey = (D) => x + D.id, i.stale = () => k !== z, i.computed = (D) => {
    if (!_.cascade || !_.top) return null;
    const h = [];
    for (let w = D; w instanceof $t && w !== i.body; w = w.parentNode) h.unshift(w);
    let v = _.top;
    for (const w of h) v = _.cascade.compute(w, v);
    return v.values;
  };
  const b = () => (z += 1, p = Sg(i, n, Ng(), _, o.names), E = y(), n.render?.(p), p), N = () => {
    Ne.flushPassiveEffects(), Ne.flushSyncWork(), y() !== E && b();
  };
  i.afterCommit = b;
  const j = (D) => {
    d.push(D), n.error?.(D);
  }, R = Ne.createContainer(m, zl.ConcurrentRoot, null, !1, null, "", j, j, j, null);
  Ne.updateContainerSync(W.createElement(l, o.props ?? {}), R, null, null), Ne.flushSyncWork(), N();
  const A = (D) => {
    const h = (v) => {
      if (v.id === D) return v;
      for (const w of v.children) {
        const S = h(w);
        if (S) return S;
      }
      return null;
    };
    return h(i.documentElement);
  }, K = (D) => {
    const h = sa;
    sa = zl.DiscreteEventPriority;
    try {
      return D();
    } finally {
      sa = h, Ne.flushSyncWork(), N();
    }
  }, H = {
    document: i,
    window: s,
    /** What `window`, `document` and `localStorage` read while this screen runs (`dom.mjs`'s `GLOBALS`). */
    globals: f,
    container: m,
    errors: d,
    /** The latest description (after the last commit or state change). */
    get description() {
      return p;
    },
    describe: b,
    /** Runs a DOM event of `type` at node `id`; false when the node is gone. */
    dispatch(D, h, v = {}) {
      const w = typeof D == "string" ? A(D) : D;
      if (!w || jg.has(h) && Rg(w)) return !1;
      const S = new Dg(h, v, w), T = [];
      for (let $ = w; $; $ = $.parentNode) T.push($);
      const B = [...T, i, s];
      K(() => {
        for (let $ = B.length - 1; $ > 0 && !S.propagationStopped; $--) jr(B[$], S, !0);
        S.propagationStopped || (jr(w, S, !0), S.propagationStopped || jr(w, S, !1));
        for (let $ = 1; $ < B.length && !S.propagationStopped; $++) jr(B[$], S, !1);
      });
      const L = h === "click" && !S.defaultPrevented ? ls(w) : null;
      if (L && H.dispatch(L, "submit", {}), h === "click" && !S.defaultPrevented)
        for (let $ = w; $; $ = $.parentNode) {
          if ($.tagName !== "a") continue;
          const et = $.props?.href;
          typeof et == "string" && /^https:\/\/\S+$/.test(et) && n.openLink?.(et);
          break;
        }
      return !S.defaultPrevented;
    },
    /** Whether the source listens for `type` on `window` or `document` (a page recording a key press does). */
    listensFor: (D) => [i, s].some((h) => h.listeners.some((v) => v.type === D)),
    /** A key pressed while the screen has the keyboard (`init`: the DOM's `key`, modifiers, `repeat`), at the
     * focused element. When nothing prevented it and that element is a text field, the key edits the field as a
     * browser would: a character is typed at the end (or replaces the text when all of it is selected), Backspace
     * deletes the last one, and the field gets `input` and `change` events with its new `value`. Returns whether the
     * source took the key (prevented it, or a field changed). */
    key(D) {
      const h = i.activeElement && i.activeElement !== i.body ? i.activeElement : i.body;
      if (!H.dispatch(h, "keydown", D)) return !0;
      const w = D.key === "Enter" && !D.isComposing ? ls(h, !0) : null;
      if (w)
        return H.dispatch(w, "submit", {}), !0;
      if (!Mf(h) || h.props.disabled || h.props.readOnly) return !1;
      if ((D.ctrlKey || D.metaKey) && !D.altKey && !D.shiftKey && D.key.toLowerCase() === "a")
        return h.selectedAll = !0, !0;
      if (D.ctrlKey || D.metaKey) return !1;
      const S = h.selectedAll;
      h.selectedAll = !1;
      const T = h.value, L = D.key === "Backspace" || S && D.key === "Delete" ? S ? "" : T.slice(0, -1) : [...D.key].length === 1 ? (S ? "" : T) + D.key : T;
      return L === T ? !1 : (h.value = L, H.dispatch(h, "input", { data: D.key }), H.dispatch(h, "change", {}), h.props.value !== void 0 && delete h.edit, h.touch(), b(), !0);
    },
    /** The engine's box for node `id` (window coordinates, logical px), for `getBoundingClientRect`. */
    setBounds(D, h) {
      const v = A(D);
      v && (v.bounds = { x: h.x, y: h.y, width: h.width, height: h.height });
    },
    /** A click on a check box or radio button (`id`): the `click` event, then, unless the source prevented it, the
     * box ticked as a browser ticks it (a radio button only on), with `input` and `change` events. */
    toggle(D) {
      const h = A(D);
      if (!h || h.props.disabled || !H.dispatch(D, "click", { button: 0, detail: 1 })) return;
      const v = h.props.type === "radio";
      v && h.checked || (h.checked = v ? !0 : !h.checked, H.dispatch(D, "input", {}), H.dispatch(D, "change", {}), h.props.checked !== void 0 && delete h.ticked, h.touch(), b());
    },
    /** A left click as the engine reports one: press then release on the same node. */
    click(D, h = {}) {
      const v = { button: 0, buttons: 1, pointerType: "mouse", ...h };
      for (const w of ["pointerdown", "mousedown", "pointerup", "mouseup", "click"]) H.dispatch(D, w, v);
    },
    /** The pointer entered (`on`) or left node `id` (one the description marks `track_hover`): its `:hover` state,
     * which a descendant's group variant reads. The element's own `hover:` styles are the engine's hover style. */
    /** Whether the pointer is over node `id`, as `hover` last said. */
    hovered: (D) => !!A(D)?.state.hover,
    hover(D, h) {
      const v = A(D);
      !v || v.state.hover === h || (v.state.hover = h, v.touch(), b());
    },
    focus(D) {
      const h = A(D);
      h && (K(() => {
        const v = i.activeElement;
        v && v !== h && v !== i.body && H.dispatch(v, "blur"), i.focus(h), H.dispatch(h, "focus");
      }), b());
    },
    /** A press at node `id` that nothing prevented: the browser's default focuses the element pressed. Only an element
     * that listens for keys (`onKeyDown`) is focused, so a press elsewhere leaves the keyboard where it was; the focus
     * is not `:focus-visible`, as after a pointer press in a browser. */
    // ponytail: a browser focuses every focusable element pressed; here only one with its own key handler, so a
    // screen's ordinary buttons do not take the keyboard from a terminal.
    pressFocus(D) {
      let v = typeof D == "string" ? A(D) : D;
      for (; v && !(v instanceof $t && typeof v.props.onKeyDown == "function" && Cg(v)); ) v = v.parentNode;
      !v || v === i.activeElement || (H.focus(v.id), v.state.pointerFocus = !0, v.touch(), b());
    },
    /** The engine is drawing the latest description: the boxes measured in this frame's layout are the tree's.
     * Returns whether effects wait for that layout (`measured`); run them with `retry` once the frame is drawn. */
    drawing() {
      return k = z, i.retries.length > 0;
    },
    /** Runs the effects that waited for a fresh layout. */
    retry() {
      const D = i.retries.splice(0);
      for (const h of D) h();
    },
    /** Runs effects React has scheduled (the engine calls it after a frame). */
    flush: N,
    update(D) {
      Ne.updateContainerSync(W.createElement(l, D ?? {}), R, null, null), Ne.flushSyncWork(), N();
    },
    unmount() {
      Ne.updateContainerSync(null, R, null, null), Ne.flushSyncWork(), Ne.flushPassiveEffects(), i.afterCommit = null, i.retries.length = 0, n.forgetBounds?.(x);
    }
  };
  return H;
}
//! `react-dom` for a screen on the native renderer: `createPortal` (into `document.body`, the overlay layer) and
//! `flushSync`. Nothing of the browser renderer.
const Lf = (n) => Ne.flushSyncFromReconciler(n), Bg = { createPortal: Cl, flushSync: Lf }, Oy = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  createPortal: Cl,
  default: Bg,
  flushSync: Lf
}, Symbol.toStringTag, { value: "Module" }));
function Vf(n) {
  var l, o, i = "";
  if (typeof n == "string" || typeof n == "number") i += n;
  else if (typeof n == "object") if (Array.isArray(n)) {
    var s = n.length;
    for (l = 0; l < s; l++) n[l] && (o = Vf(n[l])) && (i && (i += " "), i += o);
  } else for (o in n) n[o] && (i && (i += " "), i += o);
  return i;
}
function Kf() {
  for (var n, l, o = 0, i = "", s = arguments.length; o < s; o++) (n = arguments[o]) && (l = Vf(n)) && (i && (i += " "), i += l);
  return i;
}
const Hg = (n, l) => {
  const o = new Array(n.length + l.length);
  for (let i = 0; i < n.length; i++)
    o[i] = n[i];
  for (let i = 0; i < l.length; i++)
    o[n.length + i] = l[i];
  return o;
}, Ug = (n, l) => ({
  classGroupId: n,
  validator: l
}), Xf = (n = /* @__PURE__ */ new Map(), l = null, o) => ({
  nextPart: n,
  validators: l,
  classGroupId: o
}), $r = "-", tf = [], qg = "arbitrary..", Yg = (n) => {
  const l = Qg(n), {
    conflictingClassGroups: o,
    conflictingClassGroupModifiers: i
  } = n;
  return {
    getClassGroupId: (m) => {
      if (m.startsWith("[") && m.endsWith("]"))
        return Gg(m);
      const d = m.split($r), p = d[0] === "" && d.length > 1 ? 1 : 0;
      return Zf(d, p, l);
    },
    getConflictingClassGroupIds: (m, d) => {
      if (d) {
        const p = i[m], y = o[m];
        return p ? y ? Hg(y, p) : p : y || tf;
      }
      return o[m] || tf;
    }
  };
}, Zf = (n, l, o) => {
  if (n.length - l === 0)
    return o.classGroupId;
  const s = n[l], f = o.nextPart.get(s);
  if (f) {
    const y = Zf(n, l + 1, f);
    if (y) return y;
  }
  const m = o.validators;
  if (m === null)
    return;
  const d = l === 0 ? n.join($r) : n.slice(l).join($r), p = m.length;
  for (let y = 0; y < p; y++) {
    const E = m[y];
    if (E.validator(d))
      return E.classGroupId;
  }
}, Gg = (n) => n.slice(1, -1).indexOf(":") === -1 ? void 0 : (() => {
  const l = n.slice(1, -1), o = l.indexOf(":"), i = l.slice(0, o);
  return i ? qg + i : void 0;
})(), Qg = (n) => {
  const {
    theme: l,
    classGroups: o
  } = n;
  return Lg(o, l);
}, Lg = (n, l) => {
  const o = Xf();
  for (const i in n) {
    const s = n[i];
    Ss(s, o, i, l);
  }
  return o;
}, Ss = (n, l, o, i) => {
  const s = n.length;
  for (let f = 0; f < s; f++) {
    const m = n[f];
    Vg(m, l, o, i);
  }
}, Vg = (n, l, o, i) => {
  if (typeof n == "string") {
    Kg(n, l, o);
    return;
  }
  if (typeof n == "function") {
    Xg(n, l, o, i);
    return;
  }
  Zg(n, l, o, i);
}, Kg = (n, l, o) => {
  const i = n === "" ? l : Jf(l, n);
  i.classGroupId = o;
}, Xg = (n, l, o, i) => {
  if (Jg(n)) {
    Ss(n(i), l, o, i);
    return;
  }
  l.validators === null && (l.validators = []), l.validators.push(Ug(o, n));
}, Zg = (n, l, o, i) => {
  const s = Object.entries(n), f = s.length;
  for (let m = 0; m < f; m++) {
    const [d, p] = s[m];
    Ss(p, Jf(l, d), o, i);
  }
}, Jf = (n, l) => {
  let o = n;
  const i = l.split($r), s = i.length;
  for (let f = 0; f < s; f++) {
    const m = i[f];
    let d = o.nextPart.get(m);
    d || (d = Xf(), o.nextPart.set(m, d)), o = d;
  }
  return o;
}, Jg = (n) => "isThemeGetter" in n && n.isThemeGetter === !0, Wg = (n) => {
  if (n < 1)
    return {
      get: () => {
      },
      set: () => {
      }
    };
  let l = 0, o = /* @__PURE__ */ Object.create(null), i = /* @__PURE__ */ Object.create(null);
  const s = (f, m) => {
    o[f] = m, l++, l > n && (l = 0, i = o, o = /* @__PURE__ */ Object.create(null));
  };
  return {
    get(f) {
      let m = o[f];
      if (m !== void 0)
        return m;
      if ((m = i[f]) !== void 0)
        return s(f, m), m;
    },
    set(f, m) {
      f in o ? o[f] = m : s(f, m);
    }
  };
}, us = "!", ef = ":", Fg = [], nf = (n, l, o, i, s) => ({
  modifiers: n,
  hasImportantModifier: l,
  baseClassName: o,
  maybePostfixModifierPosition: i,
  isExternal: s
}), Ig = (n) => {
  const {
    prefix: l,
    experimentalParseClassName: o
  } = n;
  let i = (s) => {
    const f = [];
    let m = 0, d = 0, p = 0, y;
    const E = s.length;
    for (let b = 0; b < E; b++) {
      const N = s[b];
      if (m === 0 && d === 0) {
        if (N === ef) {
          f.push(s.slice(p, b)), p = b + 1;
          continue;
        }
        if (N === "/") {
          y = b;
          continue;
        }
      }
      N === "[" ? m++ : N === "]" ? m-- : N === "(" ? d++ : N === ")" && d--;
    }
    const _ = f.length === 0 ? s : s.slice(p);
    let x = _, z = !1;
    _.endsWith(us) ? (x = _.slice(0, -1), z = !0) : (
      /**
       * In Tailwind CSS v3 the important modifier was at the start of the base class name. This is still supported for legacy reasons.
       * @see https://github.com/dcastil/tailwind-merge/issues/513#issuecomment-2614029864
       */
      _.startsWith(us) && (x = _.slice(1), z = !0)
    );
    const k = y && y > p ? y - p : void 0;
    return nf(f, z, x, k);
  };
  if (l) {
    const s = l + ef, f = i;
    i = (m) => m.startsWith(s) ? f(m.slice(s.length)) : nf(Fg, !1, m, void 0, !0);
  }
  if (o) {
    const s = i;
    i = (f) => o({
      className: f,
      parseClassName: s
    });
  }
  return i;
}, $g = (n) => {
  const l = /* @__PURE__ */ new Map();
  return n.orderSensitiveModifiers.forEach((o, i) => {
    l.set(o, 1e6 + i);
  }), (o) => {
    const i = [];
    let s = [];
    for (let f = 0; f < o.length; f++) {
      const m = o[f], d = m[0] === "[", p = l.has(m);
      d || p ? (s.length > 0 && (s.sort(), i.push(...s), s = []), i.push(m)) : s.push(m);
    }
    return s.length > 0 && (s.sort(), i.push(...s)), i;
  };
}, Pg = (n) => ({
  cache: Wg(n.cacheSize),
  parseClassName: Ig(n),
  sortModifiers: $g(n),
  postfixLookupClassGroupIds: tb(n),
  ...Yg(n)
}), tb = (n) => {
  const l = /* @__PURE__ */ Object.create(null), o = n.postfixLookupClassGroups;
  if (o)
    for (let i = 0; i < o.length; i++)
      l[o[i]] = !0;
  return l;
}, eb = /\s+/, nb = (n, l) => {
  const {
    parseClassName: o,
    getClassGroupId: i,
    getConflictingClassGroupIds: s,
    sortModifiers: f,
    postfixLookupClassGroupIds: m
  } = l, d = [], p = n.trim().split(eb);
  let y = "";
  for (let E = p.length - 1; E >= 0; E -= 1) {
    const _ = p[E], {
      isExternal: x,
      modifiers: z,
      hasImportantModifier: k,
      baseClassName: b,
      maybePostfixModifierPosition: N
    } = o(_);
    if (x) {
      y = _ + (y.length > 0 ? " " + y : y);
      continue;
    }
    let j = !!N, R;
    if (j) {
      const h = b.substring(0, N);
      R = i(h);
      const v = R && m[R] ? i(b) : void 0;
      v && v !== R && (R = v, j = !1);
    } else
      R = i(b);
    if (!R) {
      if (!j) {
        y = _ + (y.length > 0 ? " " + y : y);
        continue;
      }
      if (R = i(b), !R) {
        y = _ + (y.length > 0 ? " " + y : y);
        continue;
      }
      j = !1;
    }
    const A = z.length === 0 ? "" : z.length === 1 ? z[0] : f(z).join(":"), K = k ? A + us : A, H = K + R;
    if (d.indexOf(H) > -1)
      continue;
    d.push(H);
    const D = s(R, j);
    for (let h = 0; h < D.length; ++h) {
      const v = D[h];
      d.push(K + v);
    }
    y = _ + (y.length > 0 ? " " + y : y);
  }
  return y;
}, ab = (...n) => {
  let l = 0, o, i, s = "";
  for (; l < n.length; )
    (o = n[l++]) && (i = Wf(o)) && (s && (s += " "), s += i);
  return s;
}, Wf = (n) => {
  if (typeof n == "string")
    return n;
  let l, o = "";
  for (let i = 0; i < n.length; i++)
    n[i] && (l = Wf(n[i])) && (o && (o += " "), o += l);
  return o;
}, lb = (n, ...l) => {
  let o, i, s, f;
  const m = (p) => {
    const y = l.reduce((E, _) => _(E), n());
    return o = Pg(y), i = o.cache.get, s = o.cache.set, f = d, d(p);
  }, d = (p) => {
    const y = i(p);
    if (y)
      return y;
    const E = nb(p, o);
    return s(p, E), E;
  };
  return f = m, (...p) => f(ab(...p));
}, rb = [], Zt = (n) => {
  const l = (o) => o[n] || rb;
  return l.isThemeGetter = !0, l.themeKey = n, l;
}, Ff = /^\[(?:(\w[\w-]*):)?(.+)\]$/i, If = /^\((?:(\w[\w-]*):)?(.+)\)$/i, ib = /^\d+(?:\.\d+)?\/\d+(?:\.\d+)?$/, ob = /^(\d+(\.\d+)?)?(xs|sm|md|lg|xl)$/, sb = /\d+(%|px|r?em|[sdl]?v([hwib]|min|max)|pt|pc|in|cm|mm|cap|ch|ex|r?lh|cq(w|h|i|b|min|max))|\b(calc|min|max|clamp)\(.+\)|^0$/, cb = /^(rgba?|hsla?|hwb|(ok)?(lab|lch)|color-mix|color|light-dark)\(.+\)$/, ub = /^(inset_)?-?((\d+)?\.?(\d+)[a-z]+|0)_-?((\d+)?\.?(\d+)[a-z]+|0)/, db = /^(url|image|image-set|cross-fade|element|(repeating-)?(linear|radial|conic)-gradient)\(.+\)$/, On = (n) => ib.test(n), vt = (n) => !!n && !Number.isNaN(Number(n)), We = (n) => !!n && Number.isInteger(Number(n)), Io = (n) => n.endsWith("%") && vt(n.slice(0, -1)), fn = (n) => ob.test(n), $f = () => !0, fb = (n) => (
  // `colorFunctionRegex` check is necessary because color functions can have percentages in them which which would be incorrectly classified as lengths.
  // For example, `hsl(0 0% 0%)` would be classified as a length without this check.
  // I could also use lookbehind assertion in `lengthUnitRegex` but that isn't supported widely enough.
  sb.test(n) && !cb.test(n)
), Es = () => !1, mb = (n) => ub.test(n), pb = (n) => db.test(n), hb = (n) => !lt(n) && !rt(n), gb = (n) => n.startsWith("@container") && (n[10] === "/" && n[11] !== void 0 || n[11] === "s" && n[16] !== void 0 && n.startsWith("-size/", 10) || n[11] === "n" && n[18] !== void 0 && n.startsWith("-normal/", 10)), bb = (n) => Gn(n, em, Es), lt = (n) => Ff.test(n), oa = (n) => Gn(n, nm, fb), af = (n) => Gn(n, Eb, vt), vb = (n) => Gn(n, lm, $f), yb = (n) => Gn(n, am, Es), lf = (n) => Gn(n, Pf, Es), xb = (n) => Gn(n, tm, pb), Or = (n) => Gn(n, rm, mb), rt = (n) => If.test(n), xl = (n) => da(n, nm), wb = (n) => da(n, am), rf = (n) => da(n, Pf), _b = (n) => da(n, em), kb = (n) => da(n, tm), Rr = (n) => da(n, rm, !0), Sb = (n) => da(n, lm, !0), Gn = (n, l, o) => {
  const i = Ff.exec(n);
  return i ? i[1] ? l(i[1]) : o(i[2]) : !1;
}, da = (n, l, o = !1) => {
  const i = If.exec(n);
  return i ? i[1] ? l(i[1]) : o : !1;
}, Pf = (n) => n === "position" || n === "percentage", tm = (n) => n === "image" || n === "url", em = (n) => n === "length" || n === "size" || n === "bg-size", nm = (n) => n === "length", Eb = (n) => n === "number", am = (n) => n === "family-name", lm = (n) => n === "number" || n === "weight", rm = (n) => n === "shadow", zb = () => {
  const n = Zt("color"), l = Zt("font"), o = Zt("text"), i = Zt("font-weight"), s = Zt("tracking"), f = Zt("leading"), m = Zt("breakpoint"), d = Zt("container"), p = Zt("spacing"), y = Zt("radius"), E = Zt("shadow"), _ = Zt("inset-shadow"), x = Zt("text-shadow"), z = Zt("drop-shadow"), k = Zt("blur"), b = Zt("perspective"), N = Zt("aspect"), j = Zt("ease"), R = Zt("animate"), A = () => ["auto", "avoid", "all", "avoid-page", "page", "left", "right", "column"], K = () => [
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
  ], H = () => [...K(), rt, lt], D = () => ["auto", "hidden", "clip", "visible", "scroll"], h = () => ["auto", "contain", "none"], v = () => [rt, lt, p], w = () => [On, "full", "auto", ...v()], S = () => [We, "none", "subgrid", rt, lt], T = () => ["auto", {
    span: ["full", We, rt, lt]
  }, We, rt, lt], B = () => [We, "auto", rt, lt], L = () => ["auto", "min", "max", "fr", rt, lt], $ = () => ["start", "end", "center", "between", "around", "evenly", "stretch", "baseline", "center-safe", "end-safe"], et = () => ["start", "end", "center", "stretch", "center-safe", "end-safe"], Q = () => ["auto", ...v()], Z = () => [On, "auto", "full", "dvw", "dvh", "lvw", "lvh", "svw", "svh", "min", "max", "fit", ...v()], P = () => [d, On, "screen", "full", "dvw", "lvw", "svw", "min", "max", "fit", ...v()], G = () => [On, "screen", "full", "lh", "dvh", "lvh", "svh", "min", "max", "fit", ...v()], V = () => [n, rt, lt], C = () => [...K(), rf, lf, {
    position: [rt, lt]
  }], X = () => ["no-repeat", {
    repeat: ["", "x", "y", "space", "round"]
  }], nt = () => ["auto", "cover", "contain", _b, bb, {
    size: [rt, lt]
  }], ot = () => [Io, xl, oa], st = () => [
    // Deprecated since Tailwind CSS v4.0.0
    "",
    "none",
    "full",
    y,
    rt,
    lt
  ], ut = () => ["", vt, xl, oa], Et = () => ["solid", "dashed", "dotted", "double"], Jt = () => ["normal", "multiply", "screen", "overlay", "darken", "lighten", "color-dodge", "color-burn", "hard-light", "soft-light", "difference", "exclusion", "hue", "saturation", "color", "luminosity"], ht = () => [vt, Io, rf, lf], Qn = () => [
    // Deprecated since Tailwind CSS v4.0.0
    "",
    "none",
    k,
    rt,
    lt
  ], Ln = () => ["none", vt, rt, lt], De = () => ["none", vt, rt, lt], Be = () => [vt, rt, lt], pn = () => [On, "full", ...v()];
  return {
    cacheSize: 500,
    theme: {
      animate: ["spin", "ping", "pulse", "bounce"],
      aspect: ["video"],
      blur: [fn],
      breakpoint: [fn],
      color: [$f],
      container: [fn],
      "drop-shadow": [fn],
      ease: ["in", "out", "in-out"],
      font: [hb],
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
        aspect: ["auto", "square", On, lt, rt, N]
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
        "@container": ["", "normal", "size", rt, lt]
      }],
      /**
       * Container Name
       * @see https://tailwindcss.com/docs/responsive-design#named-containers
       */
      "container-named": [gb],
      /**
       * Columns
       * @see https://tailwindcss.com/docs/columns
       */
      columns: [{
        columns: [vt, "auto", lt, rt, d]
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
        object: H()
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
        z: [We, "auto", rt, lt]
      }],
      // ------------------------
      // --- Flexbox and Grid ---
      // ------------------------
      /**
       * Flex Basis
       * @see https://tailwindcss.com/docs/flex-basis
       */
      basis: [{
        basis: [On, "full", "auto", d, ...v()]
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
        flex: [vt, On, "auto", "initial", "none", lt]
      }],
      /**
       * Flex Grow
       * @see https://tailwindcss.com/docs/flex-grow
       */
      grow: [{
        grow: ["", vt, rt, lt]
      }],
      /**
       * Flex Shrink
       * @see https://tailwindcss.com/docs/flex-shrink
       */
      shrink: [{
        shrink: ["", vt, rt, lt]
      }],
      /**
       * Order
       * @see https://tailwindcss.com/docs/order
       */
      order: [{
        order: [We, "first", "last", "none", rt, lt]
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
        col: T()
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
        "grid-rows": S()
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
        justify: [...$(), "normal"]
      }],
      /**
       * Justify Items
       * @see https://tailwindcss.com/docs/justify-items
       */
      "justify-items": [{
        "justify-items": [...et(), "normal"]
      }],
      /**
       * Justify Self
       * @see https://tailwindcss.com/docs/justify-self
       */
      "justify-self": [{
        "justify-self": ["auto", ...et()]
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
        items: [...et(), {
          baseline: ["", "last"]
        }]
      }],
      /**
       * Align Self
       * @see https://tailwindcss.com/docs/align-self
       */
      "align-self": [{
        self: ["auto", ...et(), {
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
        "place-items": [...et(), "baseline"]
      }],
      /**
       * Place Self
       * @see https://tailwindcss.com/docs/place-self
       */
      "place-self": [{
        "place-self": ["auto", ...et()]
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
        text: ["base", o, xl, oa]
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
        font: [i, Sb, vb]
      }],
      /**
       * Font Stretch
       * @see https://tailwindcss.com/docs/font-stretch
       */
      "font-stretch": [{
        "font-stretch": ["ultra-condensed", "extra-condensed", "condensed", "semi-condensed", "normal", "semi-expanded", "expanded", "extra-expanded", "ultra-expanded", Io, lt]
      }],
      /**
       * Font Family
       * @see https://tailwindcss.com/docs/font-family
       */
      "font-family": [{
        font: [wb, yb, l]
      }],
      /**
       * Font Feature Settings
       * @see https://tailwindcss.com/docs/font-feature-settings
       */
      "font-features": [{
        "font-features": [lt]
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
        tracking: [s, rt, lt]
      }],
      /**
       * Line Clamp
       * @see https://tailwindcss.com/docs/line-clamp
       */
      "line-clamp": [{
        "line-clamp": [vt, "none", rt, af]
      }],
      /**
       * Line Height
       * @see https://tailwindcss.com/docs/line-height
       */
      leading: [{
        leading: [
          "none",
          /** Deprecated since Tailwind CSS v4.0.0. @see https://github.com/tailwindlabs/tailwindcss.com/issues/2027#issuecomment-2620152757 */
          f,
          ...v()
        ]
      }],
      /**
       * List Style Image
       * @see https://tailwindcss.com/docs/list-style-image
       */
      "list-image": [{
        "list-image": ["none", rt, lt]
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
        list: ["disc", "decimal", "none", rt, lt]
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
        decoration: [vt, "from-font", "auto", rt, oa]
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
        "underline-offset": [vt, "auto", rt, lt]
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
        tab: [We, rt, lt]
      }],
      /**
       * Vertical Alignment
       * @see https://tailwindcss.com/docs/vertical-align
       */
      "vertical-align": [{
        align: ["baseline", "top", "middle", "bottom", "text-top", "text-bottom", "sub", "super", rt, lt]
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
        content: ["none", rt, lt]
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
        bg: nt()
      }],
      /**
       * Background Image
       * @see https://tailwindcss.com/docs/background-image
       */
      "bg-image": [{
        bg: ["none", {
          linear: [{
            to: ["t", "tr", "r", "br", "b", "bl", "l", "tl"]
          }, We, rt, lt],
          radial: ["", rt, lt],
          conic: ["", We, rt, lt]
        }, kb, xb]
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
        from: ot()
      }],
      /**
       * Gradient Color Stops Via Position
       * @see https://tailwindcss.com/docs/gradient-color-stops
       */
      "gradient-via-pos": [{
        via: ot()
      }],
      /**
       * Gradient Color Stops To Position
       * @see https://tailwindcss.com/docs/gradient-color-stops
       */
      "gradient-to-pos": [{
        to: ot()
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
        rounded: st()
      }],
      /**
       * Border Radius Start
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-s": [{
        "rounded-s": st()
      }],
      /**
       * Border Radius End
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-e": [{
        "rounded-e": st()
      }],
      /**
       * Border Radius Top
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-t": [{
        "rounded-t": st()
      }],
      /**
       * Border Radius Right
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-r": [{
        "rounded-r": st()
      }],
      /**
       * Border Radius Bottom
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-b": [{
        "rounded-b": st()
      }],
      /**
       * Border Radius Left
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-l": [{
        "rounded-l": st()
      }],
      /**
       * Border Radius Start Start
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-ss": [{
        "rounded-ss": st()
      }],
      /**
       * Border Radius Start End
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-se": [{
        "rounded-se": st()
      }],
      /**
       * Border Radius End End
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-ee": [{
        "rounded-ee": st()
      }],
      /**
       * Border Radius End Start
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-es": [{
        "rounded-es": st()
      }],
      /**
       * Border Radius Top Left
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-tl": [{
        "rounded-tl": st()
      }],
      /**
       * Border Radius Top Right
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-tr": [{
        "rounded-tr": st()
      }],
      /**
       * Border Radius Bottom Right
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-br": [{
        "rounded-br": st()
      }],
      /**
       * Border Radius Bottom Left
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-bl": [{
        "rounded-bl": st()
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
        "outline-offset": [vt, rt, lt]
      }],
      /**
       * Outline Width
       * @see https://tailwindcss.com/docs/outline-width
       */
      "outline-w": [{
        outline: ["", vt, xl, oa]
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
        "inset-shadow": ["none", _, Rr, Or]
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
        "text-shadow": ["none", x, Rr, Or]
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
        opacity: [vt, rt, lt]
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
        "mask-radial": [rt, lt]
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
        "mask-radial-at": K()
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
        mask: nt()
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
        mask: ["none", rt, lt]
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
          lt
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
        brightness: [vt, rt, lt]
      }],
      /**
       * Contrast
       * @see https://tailwindcss.com/docs/contrast
       */
      contrast: [{
        contrast: [vt, rt, lt]
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
        grayscale: ["", vt, rt, lt]
      }],
      /**
       * Hue Rotate
       * @see https://tailwindcss.com/docs/hue-rotate
       */
      "hue-rotate": [{
        "hue-rotate": [vt, rt, lt]
      }],
      /**
       * Invert
       * @see https://tailwindcss.com/docs/invert
       */
      invert: [{
        invert: ["", vt, rt, lt]
      }],
      /**
       * Saturate
       * @see https://tailwindcss.com/docs/saturate
       */
      saturate: [{
        saturate: [vt, rt, lt]
      }],
      /**
       * Sepia
       * @see https://tailwindcss.com/docs/sepia
       */
      sepia: [{
        sepia: ["", vt, rt, lt]
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
          lt
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
        "backdrop-brightness": [vt, rt, lt]
      }],
      /**
       * Backdrop Contrast
       * @see https://tailwindcss.com/docs/backdrop-contrast
       */
      "backdrop-contrast": [{
        "backdrop-contrast": [vt, rt, lt]
      }],
      /**
       * Backdrop Grayscale
       * @see https://tailwindcss.com/docs/backdrop-grayscale
       */
      "backdrop-grayscale": [{
        "backdrop-grayscale": ["", vt, rt, lt]
      }],
      /**
       * Backdrop Hue Rotate
       * @see https://tailwindcss.com/docs/backdrop-hue-rotate
       */
      "backdrop-hue-rotate": [{
        "backdrop-hue-rotate": [vt, rt, lt]
      }],
      /**
       * Backdrop Invert
       * @see https://tailwindcss.com/docs/backdrop-invert
       */
      "backdrop-invert": [{
        "backdrop-invert": ["", vt, rt, lt]
      }],
      /**
       * Backdrop Opacity
       * @see https://tailwindcss.com/docs/backdrop-opacity
       */
      "backdrop-opacity": [{
        "backdrop-opacity": [vt, rt, lt]
      }],
      /**
       * Backdrop Saturate
       * @see https://tailwindcss.com/docs/backdrop-saturate
       */
      "backdrop-saturate": [{
        "backdrop-saturate": [vt, rt, lt]
      }],
      /**
       * Backdrop Sepia
       * @see https://tailwindcss.com/docs/backdrop-sepia
       */
      "backdrop-sepia": [{
        "backdrop-sepia": ["", vt, rt, lt]
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
        transition: ["", "all", "colors", "opacity", "shadow", "transform", "none", rt, lt]
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
        duration: [vt, "initial", rt, lt]
      }],
      /**
       * Transition Timing Function
       * @see https://tailwindcss.com/docs/transition-timing-function
       */
      ease: [{
        ease: ["linear", "initial", j, rt, lt]
      }],
      /**
       * Transition Delay
       * @see https://tailwindcss.com/docs/transition-delay
       */
      delay: [{
        delay: [vt, rt, lt]
      }],
      /**
       * Animation
       * @see https://tailwindcss.com/docs/animation
       */
      animate: [{
        animate: ["none", R, rt, lt]
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
        perspective: [b, rt, lt]
      }],
      /**
       * Perspective Origin
       * @see https://tailwindcss.com/docs/perspective-origin
       */
      "perspective-origin": [{
        "perspective-origin": H()
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
        transform: [rt, lt, "", "none", "gpu", "cpu"]
      }],
      /**
       * Transform Origin
       * @see https://tailwindcss.com/docs/transform-origin
       */
      "transform-origin": [{
        origin: H()
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
        zoom: [We, rt, lt]
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
        cursor: ["auto", "default", "pointer", "wait", "text", "move", "help", "not-allowed", "none", "context-menu", "progress", "cell", "crosshair", "vertical-text", "alias", "copy", "no-drop", "grab", "grabbing", "all-scroll", "col-resize", "row-resize", "n-resize", "e-resize", "s-resize", "w-resize", "ne-resize", "nw-resize", "se-resize", "sw-resize", "ew-resize", "ns-resize", "nesw-resize", "nwse-resize", "zoom-in", "zoom-out", rt, lt]
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
        "will-change": ["auto", "scroll", "contents", "transform", rt, lt]
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
        stroke: [vt, xl, oa, af]
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
}, Nb = /* @__PURE__ */ lb(zb);
function Bt(...n) {
  return Nb(Kf(n));
}
function Tb(n, l, o) {
  return n.filter((i, s) => s !== l && (i.start + i.end) / 2 < o).length;
}
function Cb(n, l, o, i) {
  const s = n.map(() => 0), f = n[l];
  if (!f) return s;
  const m = n[l + 1], d = n[l - 1], p = f.end - f.start + (m ? m.start - f.end : d ? f.start - d.end : 0);
  return n.forEach((y, E) => {
    l < o && E > l && E <= o ? s[E] = -p : o < l && E >= o && E < l && (s[E] = p);
  }), s[l] = Math.min(Math.max(i, n[0].start - f.start), n[n.length - 1].end - f.end), s;
}
const of = ["transform", "transition", "zIndex", "filter", "pointerEvents", "position"];
function Mb(n, l) {
  for (let o = n.parentElement; o; o = o.parentElement) {
    const i = getComputedStyle(o)[l === "x" ? "overflowX" : "overflowY"];
    if ((i === "auto" || i === "scroll") && (l === "x" ? o.scrollWidth > o.clientWidth : o.scrollHeight > o.clientHeight)) return o;
  }
  return null;
}
function Ab(n, l, o, i) {
  const s = n[l] ? Mb(n[l], o) : null, f = () => s ? o === "x" ? s.scrollLeft : s.scrollTop : 0, m = (N) => (o === "x" ? N.clientX : N.clientY) + f(), d = m(i), p = f(), y = n.map((N) => {
    const j = N.getBoundingClientRect();
    return o === "x" ? { start: j.left + p, end: j.right + p } : { start: j.top + p, end: j.bottom + p };
  }), E = n.map((N) => of.map((j) => N.style[j])), _ = typeof matchMedia == "function" && matchMedia("(prefers-reduced-motion: reduce)").matches, x = o === "x" ? "translateX" : "translateY";
  let z = !1;
  const k = { to: l };
  n.forEach((N, j) => {
    if (N.style.pointerEvents = "none", j !== l) {
      _ || (N.style.transition = "transform 160ms cubic-bezier(0.2, 0.8, 0.2, 1)");
      return;
    }
    getComputedStyle(N).position === "static" && (N.style.position = "relative"), N.style.zIndex = "30", N.style.filter = "drop-shadow(0 6px 10px rgba(0, 0, 0, 0.45))";
  });
  const b = (N, j) => {
    k.to = N, Cb(y, l, N, j).forEach((R, A) => {
      n[A].style.transform = R ? `${x}(${R}px)` : "";
    });
  };
  return {
    from: l,
    get to() {
      return k.to;
    },
    slot: (N) => Tb(y, l, m(N)),
    apply: (N, j) => {
      z || b(N, m(j) - d);
    },
    rest: () => {
      z || b(l, 0);
    },
    end: () => {
      z || (z = !0, n.forEach((N, j) => of.forEach((R, A) => {
        N.style[R] = E[j][A];
      })));
    }
  };
}
const jb = 5;
let $o = !1;
function Ob(n, l) {
  if (n.button !== 0 || $o) return;
  const o = { clientX: n.clientX, clientY: n.clientY }, i = n.currentTarget, s = n.pointerId;
  let f = null, m, d = !1;
  const p = { cursor: document.body.style.cursor, userSelect: document.body.style.userSelect }, y = (k) => {
    if (d) return;
    d = !0, window.removeEventListener("pointermove", E), window.removeEventListener("pointerup", _), window.removeEventListener("pointercancel", x), window.removeEventListener("keydown", z, !0), window.removeEventListener("blur", x), i.removeEventListener("lostpointercapture", x);
    try {
      i.releasePointerCapture(s);
    } catch {
    }
    if (!f) return;
    $o = !1, document.body.style.cursor = p.cursor, document.body.style.userSelect = p.userSelect, f.end();
    const b = (N) => N.stopPropagation();
    window.addEventListener("click", b, { capture: !0, once: !0 }), setTimeout(() => window.removeEventListener("click", b, !0), 0), m?.(), l.onEnd(k, f);
  }, E = (k) => {
    if (!f) {
      if (Math.hypot(k.clientX - o.clientX, k.clientY - o.clientY) < jb) return;
      const b = l.items();
      f = Ab(b, l.from(b), l.axis, o), $o = !0, document.body.style.cursor = "grabbing", document.body.style.userSelect = "none";
      try {
        i.setPointerCapture(s);
      } catch {
      }
      i.addEventListener("lostpointercapture", x);
      const N = l.onStart?.();
      m = typeof N == "function" ? N : void 0;
    }
    l.onMove(k, f);
  }, _ = () => y(!0), x = () => y(!1), z = (k) => {
    k.key === "Escape" && (k.stopPropagation(), y(!1));
  };
  window.addEventListener("pointermove", E), window.addEventListener("pointerup", _), window.addEventListener("pointercancel", x), window.addEventListener("keydown", z, !0), window.addEventListener("blur", x);
}
const im = typeof navigator < "u" && /Mac/i.test(navigator.platform), Pr = {
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
for (let n = 1; n <= 12; n++) Pr[`f${n}`] = `F${n}`;
const Rb = Object.fromEntries(Object.entries(Pr).map(([n, l]) => [l, n])), Db = {
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
function Bb(n) {
  const l = /^Key([A-Z])$/.exec(n) ?? /^Digit(\d)$/.exec(n);
  return l ? l[1].toLowerCase() : Rb[n];
}
const sf = /* @__PURE__ */ new Map();
function om(n, l = im) {
  const o = `${l}|${n}`, i = sf.get(o);
  if (i) return i;
  const s = { cmd: !1, ctrl: !1, shift: !1, alt: !1, code: "" };
  for (const f of n.split("+"))
    if (f === "mod")
      l ? s.cmd = !0 : (s.ctrl = !0, s.shift = !0);
    else if (f === "cmd" || f === "ctrl" || f === "shift" || f === "alt") s[f] = !0;
    else if (/^[a-z]$/.test(f))
      s.code = `Key${f.toUpperCase()}`, s.letter = f;
    else if (/^[0-9]$/.test(f)) s.code = `Digit${f}`;
    else if (Pr[f]) s.code = Pr[f];
    else throw new Error(`unknown key "${f}" in "${n}"`);
  if (!s.code) throw new Error(`no key in "${n}"`);
  return sf.set(o, s), s;
}
new Set(["cmd+q", "cmd+h", "cmd+alt+h", "cmd+m", "cmd+ctrl+f", "cmd+z", "cmd+shift+z", "cmd+x", "cmd+c", "cmd+v", "cmd+a"].map((n) => {
  const l = om(n, !0);
  return [l.cmd && "cmd", l.ctrl && "ctrl", l.alt && "alt", l.shift && "shift", l.code].filter(Boolean).join("+");
}));
function Hb(n, l = im) {
  const o = om(n, l), i = Ub(Bb(o.code) ?? "");
  return l ? `${o.ctrl ? "⌃" : ""}${o.alt ? "⌥" : ""}${o.shift ? "⇧" : ""}${o.cmd ? "⌘" : ""}${i}` : [o.ctrl && "Ctrl", o.alt && "Alt", o.shift && "Shift", i].filter(Boolean).join("+");
}
const Ub = (n) => Db[n] ?? n.toUpperCase(), cf = (n) => typeof n == "boolean" ? `${n}` : n === 0 ? "0" : n, uf = Kf, li = (n, l) => (o) => {
  var i;
  if (l?.variants == null) return uf(n, o?.class, o?.className);
  const { variants: s, defaultVariants: f } = l, m = Object.keys(s).map((y) => {
    const E = o?.[y], _ = f?.[y];
    if (E === null) return null;
    const x = cf(E) || cf(_);
    return s[y][x];
  }), d = o && Object.entries(o).reduce((y, E) => {
    let [_, x] = E;
    return x === void 0 || (y[_] = x), y;
  }, {}), p = l == null || (i = l.compoundVariants) === null || i === void 0 ? void 0 : i.reduce((y, E) => {
    let { class: _, className: x, ...z } = E;
    return Object.entries(z).every((k) => {
      let [b, N] = k;
      return Array.isArray(N) ? N.includes({
        ...f,
        ...d
      }[b]) : {
        ...f,
        ...d
      }[b] === N;
    }) ? [
      ...y,
      _,
      x
    ] : y;
  }, []);
  return uf(n, m, p, o?.class, o?.className);
}, qb = li(
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
), Yb = li(
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
function Gb({ className: n, ...l } = {}) {
  return Bt(Yb(l), n);
}
const sm = "shrink-0 cursor-pointer rounded-ui bg-transparent px-[0.2rem] py-[0.1rem] text-[0.8rem] leading-none text-subtext-0 [font-family:inherit] [border:none] [transition:color_0.1s_ease,background_0.1s_ease] hover:bg-surface-1 hover:text-accent", ua = "cursor-pointer rounded-ui bg-transparent text-subtext-0 [border:0] [font-family:inherit] [transition:color_0.1s_ease,background_0.1s_ease] hover:bg-surface-1 hover:text-fg focus-visible:bg-surface-1 focus-visible:text-fg disabled:cursor-not-allowed disabled:opacity-40", Qb = li(`${ua} shrink-0 focus-visible:[outline:2px_solid_var(--accent)] focus-visible:[outline-offset:-2px]`, {
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
function Lb({ className: n, ...l } = {}) {
  return Bt(Qb(l), n);
}
const zs = "overflow-hidden rounded-ui bg-surface-1 py-[0.3rem] shadow-[0_8px_24px_rgba(0,0,0,0.45)]", Vb = li(
  "pane-context-menu__item block w-full cursor-pointer bg-transparent px-[0.9rem] py-[0.45rem] text-left text-[0.82rem] [border:none] [font-family:inherit] [transition:background_0.1s_ease] hover:bg-surface-0 disabled:cursor-not-allowed disabled:bg-transparent disabled:opacity-40",
  { variants: { danger: { true: "text-red", false: "text-fg" } }, defaultVariants: { danger: !1 } }
), Kb = "my-1 h-px bg-overlay-0";
function Xb({ size: n = 14, className: l }) {
  return /* @__PURE__ */ ct.jsxs("svg", { className: l, width: n, height: n, viewBox: "0 0 16 16", fill: "currentColor", "aria-hidden": "true", children: [
    /* @__PURE__ */ ct.jsx("circle", { cx: "3.5", cy: "8", r: "1.1" }),
    /* @__PURE__ */ ct.jsx("circle", { cx: "8", cy: "8", r: "1.1" }),
    /* @__PURE__ */ ct.jsx("circle", { cx: "12.5", cy: "8", r: "1.1" })
  ] });
}
function Zb({ size: n = 16, className: l }) {
  return /* @__PURE__ */ ct.jsxs("svg", { className: l, width: n, height: n, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: "1.3", strokeLinejoin: "round", "aria-hidden": "true", children: [
    /* @__PURE__ */ ct.jsx("path", { d: "M6.6 1.8h2.8l.4 1.6 1.1.6 1.5-.6 1.4 2.4-1.2 1.1v1.3l1.2 1.1-1.4 2.4-1.5-.6-1.1.6-.4 1.6H6.6l-.4-1.6-1.1-.6-1.5.6-1.4-2.4 1.2-1.1V7.3L2.2 6.2l1.4-2.4 1.5.6 1.1-.6z" }),
    /* @__PURE__ */ ct.jsx("circle", { cx: "8", cy: "8", r: "2" })
  ] });
}
function Jb({ size: n = 14, className: l }) {
  return /* @__PURE__ */ ct.jsx("svg", { className: l, width: n, height: n, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round", "aria-hidden": "true", children: /* @__PURE__ */ ct.jsx("path", { d: "M3.5 3.5l9 9M12.5 3.5l-9 9" }) });
}
function cm({ size: n = 14, className: l }) {
  return /* @__PURE__ */ ct.jsx("svg", { className: l, width: n, height: n, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round", "aria-hidden": "true", children: /* @__PURE__ */ ct.jsx("path", { d: "M8 2.5v11M2.5 8h11" }) });
}
const df = {
  connected: "host-state--connected bg-accent",
  connecting: "host-state--connecting animate-host-pulse bg-yellow",
  error: "host-state--error bg-red",
  disabled: "host-state--disabled bg-subtext-0"
};
function Wb({ state: n, error: l }) {
  return /* @__PURE__ */ ct.jsx(
    "span",
    {
      className: Bt("host-state inline-block h-2 w-2 shrink-0 rounded-[50%]", df[n] ?? df.disabled),
      title: n === "error" && l ? l : n
    }
  );
}
function Fb({ title: n, onClose: l, children: o, testId: i }) {
  return Cl(
    /* @__PURE__ */ ct.jsx(
      "div",
      {
        className: "fixed inset-0 z-[2100] flex items-center justify-center bg-[rgba(0,0,0,0.55)]",
        onMouseDown: (s) => {
          s.target === s.currentTarget && l();
        },
        onKeyDown: (s) => {
          s.key === "Escape" && l();
        },
        children: /* @__PURE__ */ ct.jsxs(
          "div",
          {
            className: "grid max-h-[85vh] w-[min(30rem,92vw)] gap-[0.6rem] overflow-y-auto rounded-ui bg-panel-bg p-4 shadow-[0_8px_32px_rgba(0,0,0,0.5)]",
            role: "dialog",
            "aria-modal": "true",
            "aria-label": n,
            "data-testid": i,
            children: [
              /* @__PURE__ */ ct.jsx("h2", { className: "m-0 text-[0.9rem] font-semibold text-fg", children: n }),
              o
            ]
          }
        )
      }
    ),
    document.body
  );
}
const Dr = 4, Rn = 8, Ib = "flex w-full cursor-pointer items-center justify-between gap-3 px-[0.9rem] py-[0.4rem] text-left text-[0.82rem] text-fg max-[700px]:min-h-11 aria-disabled:cursor-not-allowed aria-disabled:opacity-40", ff = (n) => n.text ?? (typeof n.label == "string" ? n.label : n.value);
function $b({ value: n, onChange: l, options: o, className: i, ariaLabel: s, testId: f, id: m, title: d, disabled: p, placeholder: y, freeText: E, onKeyDown: _ }) {
  const x = W.useId(), [z, k] = W.useState(!1), [b, N] = W.useState(-1), [j, R] = W.useState(!1), A = W.useRef(null), K = W.useRef(null), [H, D] = W.useState({}), h = W.useRef({ text: "", at: 0 }), v = E && j && n ? o.filter((G) => ff(G).toLowerCase().includes(n.toLowerCase()) || G.value.toLowerCase().includes(n.toLowerCase())) : o, w = o.find((G) => G.value === n), S = (G) => `${x}-${G}`;
  function T(G) {
    p || (N(G), k(!0));
  }
  function B() {
    k(!1), R(!1), N(-1);
  }
  function L(G) {
    !G || G.disabled || (l(G.value), B());
  }
  function $(G, V) {
    for (let C = 1; C <= v.length; C++) {
      const X = (G + V * C + v.length * C) % v.length;
      if (!v[X].disabled) return X;
    }
    return G;
  }
  const et = () => v.findIndex((G) => !G.disabled), Q = () => v.length - 1 - [...v].reverse().findIndex((G) => !G.disabled);
  Xr(() => {
    if (!z || !A.current) {
      D((nt) => nt.left === void 0 ? nt : {});
      return;
    }
    const G = A.current.getBoundingClientRect(), V = window.innerHeight - G.bottom - Dr - Rn, C = G.top - Dr - Rn, X = V < 160 && C > V;
    D({
      position: "fixed",
      left: Math.min(Math.max(Rn, G.left), Math.max(Rn, window.innerWidth - G.width - Rn)),
      // As wide as its longest label (a session title, a path), never wider than the window.
      width: "max-content",
      minWidth: G.width,
      maxWidth: window.innerWidth - 2 * Rn,
      maxHeight: Math.min(X ? C : V, 320),
      ...X ? { bottom: window.innerHeight - G.top + Dr } : { top: G.bottom + Dr },
      overflowY: "auto"
    });
  }, [z, v.length]), Xr(() => {
    const G = K.current;
    if (!z || !G || H.left === void 0) return;
    const V = G.getBoundingClientRect().right, C = window.innerWidth - Rn;
    V > C && D((X) => ({ ...X, left: Math.max(Rn, Number(X.left) - (V - C)) }));
  }, [z, H]), oe(() => {
    if (!z) return;
    const G = (V) => {
      const C = V.target;
      (C === document || C instanceof Node && A.current && C.contains(A.current)) && B();
    };
    return window.addEventListener("resize", B), window.addEventListener("scroll", G, !0), () => {
      window.removeEventListener("resize", B), window.removeEventListener("scroll", G, !0);
    };
  }, [z]), oe(() => {
    const G = z && b >= 0 ? document.getElementById(S(b)) : null, V = K.current;
    !G || !V || (G.offsetTop < V.scrollTop ? V.scrollTop = G.offsetTop : G.offsetTop + G.offsetHeight > V.scrollTop + V.clientHeight && (V.scrollTop = G.offsetTop + G.offsetHeight - V.clientHeight));
  }, [z, b]), mm(z, (G) => {
    G || B();
  }, A, K);
  function Z(G) {
    if (G.nativeEvent.isComposing) return;
    const V = () => {
      G.preventDefault(), G.stopPropagation();
    }, { key: C } = G;
    if (z) {
      if (C === "Escape") {
        V(), B();
        return;
      } else if (C === "Tab")
        B();
      else if (C === "ArrowDown" || C === "ArrowUp") {
        V(), v.length && N(b < 0 ? C === "ArrowDown" ? et() : Q() : $(b, C === "ArrowDown" ? 1 : -1));
        return;
      } else if (C === "Home" && !E) {
        V(), N(et());
        return;
      } else if (C === "End" && !E) {
        V(), N(Q());
        return;
      } else if (C === "Enter" || C === " " && !E) {
        if (b >= 0 && v[b]) {
          V(), L(v[b]);
          return;
        }
        if (!E) {
          V(), B();
          return;
        }
      } else if (!E && C.length === 1 && !G.metaKey && !G.ctrlKey && !G.altKey) {
        const X = Date.now();
        h.current = { text: (X - h.current.at > 600 ? "" : h.current.text) + C.toLowerCase(), at: X };
        const nt = Math.max(b, 0), ot = [...v.slice(nt + (h.current.text.length === 1 ? 1 : 0)), ...v.slice(0, nt + 1)].find((st) => !st.disabled && ff(st).toLowerCase().startsWith(h.current.text));
        ot && (V(), N(v.indexOf(ot)));
        return;
      }
    } else if (C === "ArrowDown" || C === "ArrowUp" || !E && (C === "Enter" || C === " ")) {
      V(), T(Math.max(0, v.findIndex((X) => X.value === n)));
      return;
    }
    _?.(G);
  }
  const P = {
    ref: (G) => {
      A.current = G;
    },
    id: m,
    title: d,
    disabled: p,
    "aria-label": s,
    "aria-expanded": z,
    "aria-controls": z ? x : void 0,
    "aria-activedescendant": z && b >= 0 ? S(b) : void 0,
    "data-testid": f,
    onKeyDown: Z
  };
  return /* @__PURE__ */ ct.jsxs(ct.Fragment, { children: [
    E ? /* @__PURE__ */ ct.jsx(
      "input",
      {
        ...P,
        type: "text",
        role: "combobox",
        "aria-autocomplete": "list",
        autoComplete: "off",
        placeholder: y,
        className: i,
        value: n,
        onChange: (G) => {
          l(G.target.value), R(!0), z ? N(-1) : (N(-1), k(!0));
        },
        onBlur: () => B()
      }
    ) : /* @__PURE__ */ ct.jsxs(
      "button",
      {
        ...P,
        type: "button",
        role: "combobox",
        "aria-haspopup": "listbox",
        "data-value": n,
        className: Bt("inline-flex items-center justify-between gap-2 text-left [font-family:inherit] cursor-pointer disabled:cursor-not-allowed disabled:opacity-50", i),
        onClick: () => z ? B() : T(Math.max(0, v.findIndex((G) => G.value === n))),
        children: [
          /* @__PURE__ */ ct.jsx("span", { className: "min-w-0 flex-1 truncate", children: w ? w.label : y ?? "" }),
          /* @__PURE__ */ ct.jsx(fm, { open: !0, className: "shrink-0 text-subtext-0" })
        ]
      }
    ),
    z && v.length > 0 && Cl(
      /* @__PURE__ */ ct.jsx(
        "div",
        {
          ref: K,
          id: x,
          role: "listbox",
          "aria-label": s,
          className: Bt("z-[9999]", zs),
          style: H,
          onMouseDown: (G) => {
            G.preventDefault(), G.stopPropagation();
          },
          onClick: (G) => G.stopPropagation(),
          children: v.map((G, V) => /* @__PURE__ */ ct.jsxs(
            "div",
            {
              id: S(V),
              role: "option",
              "aria-selected": G.value === n,
              "aria-disabled": G.disabled || void 0,
              "data-value": G.value,
              className: Bt(Ib, V === b && !G.disabled && "bg-surface-0"),
              onMouseEnter: () => {
                G.disabled || N(V);
              },
              onClick: () => L(G),
              children: [
                /* @__PURE__ */ ct.jsx("span", { className: "min-w-0 truncate", children: G.label }),
                G.value === n && /* @__PURE__ */ ct.jsx("span", { "aria-hidden": "true", className: "shrink-0 text-accent", children: "✓" })
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
const mf = 230, Pb = 370;
function tv({ x: n, y: l, readOnly: o, canUndo: i, canRedo: s, hasSelection: f, onClose: m, actions: d }) {
  const p = W.useRef(null);
  oe(() => {
    const x = (k) => {
      p.current?.contains(k.target) || m();
    }, z = (k) => {
      k.key === "Escape" && (k.preventDefault(), m());
    };
    return document.addEventListener("mousedown", x), document.addEventListener("keydown", z), window.addEventListener("blur", m), window.addEventListener("resize", m), () => {
      document.removeEventListener("mousedown", x), document.removeEventListener("keydown", z), window.removeEventListener("blur", m), window.removeEventListener("resize", m);
    };
  }, [m]);
  const y = (x, z) => ps(bm ? x : z), E = (x, z, k, b, N = !1) => /* @__PURE__ */ ct.jsxs("button", { type: "button", className: Bt(vm(), "flex items-center justify-between gap-6"), "data-testid": k, disabled: N, onClick: z, children: [
    /* @__PURE__ */ ct.jsx("span", { children: x }),
    /* @__PURE__ */ ct.jsx("span", { className: "text-[0.72rem] text-subtext-0", children: b })
  ] }), _ = d.askAgent;
  return Cl(
    /* @__PURE__ */ ct.jsxs(
      "div",
      {
        ref: p,
        className: zs,
        "data-testid": "editor-context-menu",
        style: {
          position: "fixed",
          top: Math.max(8, Math.min(l, window.innerHeight - Pb - 8)),
          left: Math.max(8, Math.min(n, window.innerWidth - mf - 8)),
          zIndex: 9999,
          minWidth: mf
        },
        onContextMenu: (x) => x.preventDefault(),
        children: [
          _ && /* @__PURE__ */ ct.jsxs(ct.Fragment, { children: [
            E(f ? "Ask agent about selection…" : "Ask agent about file…", _, "editor-menu-ask-agent", ""),
            /* @__PURE__ */ ct.jsx("div", { className: Kr })
          ] }),
          E("Undo", d.undo, "editor-menu-undo", y("cmd+z", "ctrl+z"), o || !i),
          E("Redo", d.redo, "editor-menu-redo", y("cmd+shift+z", "ctrl+y"), o || !s),
          /* @__PURE__ */ ct.jsx("div", { className: Kr }),
          E("Cut", d.cut, "editor-menu-cut", y("cmd+x", "ctrl+x"), o || !f),
          E("Copy", d.copy, "editor-menu-copy", y("cmd+c", "ctrl+c"), !f),
          E("Paste", d.paste, "editor-menu-paste", y("cmd+v", "ctrl+v"), o),
          E("Select All", d.selectAll, "editor-menu-select-all", y("cmd+a", "ctrl+a")),
          /* @__PURE__ */ ct.jsx("div", { className: Kr }),
          E("Find…", d.find, "editor-menu-find", y("cmd+f", "ctrl+f")),
          !o && E("Replace…", d.replace, "editor-menu-replace", y("cmd+alt+f", "ctrl+h")),
          E("Go to Line…", d.gotoLine, "editor-menu-goto", ps("ctrl+g"))
        ]
      }
    ),
    document.body
  );
}
const ev = "box-border min-h-[44px] cursor-pointer rounded-ui bg-transparent px-[0.7rem] py-[0.45rem] text-subtext-0 no-underline [border:0] [font-family:inherit] [font-weight:inherit] [line-height:inherit] text-[0.85rem] hover:bg-surface-1 hover:text-fg focus-visible:[outline:2px_solid_var(--accent)] focus-visible:[outline-offset:2px] disabled:cursor-default disabled:opacity-[0.55]", nv = "m-0 mt-[0.4rem] text-[0.78rem] text-subtext-0", av = "m-0 mb-2 text-[0.82rem] text-subtext-0", um = "rounded-ui bg-surface-1 text-fg [font-family:inherit]", Ns = `${um} px-2 py-[0.3rem] text-[0.8rem] max-[700px]:min-h-11 focus:[outline:1px_solid_var(--accent)]`, lv = `${Ns} min-w-[5.5rem] shrink-0`, Ts = `${um} min-w-0 px-[0.55rem] py-[0.35rem] text-[0.82rem] max-[700px]:min-h-11 focus:[outline:1px_solid_var(--accent)]`, rv = `${Ts} flex-1 max-[700px]:flex-[1_1_100%]`, iv = `${Ts} w-20 flex-[0_0_5rem] max-[700px]:w-24 max-[700px]:flex-[1_1_6rem]`, ov = `${Ts} flex-[1_1_100%]`, sv = "flex flex-wrap items-center gap-[0.4rem]", cv = "m-0 mb-2 flex list-none flex-col gap-[0.3rem] p-0", uv = "flex items-center gap-2 max-[700px]:flex-wrap rounded-ui bg-surface-1 px-2 py-[0.35rem] text-[0.82rem]", dv = `settings-modal__host-row ${uv}`, fv = "min-w-0 overflow-hidden font-semibold text-ellipsis whitespace-nowrap text-fg", mv = "min-w-0 flex-1 max-[700px]:basis-full overflow-hidden text-[0.78rem] text-ellipsis whitespace-nowrap text-subtext-0", dm = "shrink-0 cursor-pointer rounded-ui px-[0.7rem] py-[0.35rem] max-[700px]:min-h-11 text-[0.82rem] font-semibold text-panel-bg [border:none] [font-family:inherit] [transition:opacity_0.12s_ease] hover:opacity-[0.85]", pv = `${dm} bg-accent`, hv = `${dm} ml-auto bg-red`;
function fm({ open: n, size: l = 12, className: o }) {
  return /* @__PURE__ */ ct.jsx("svg", { className: o, width: l, height: l, viewBox: "0 0 12 12", fill: "none", stroke: "currentColor", strokeWidth: "1.3", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true", children: /* @__PURE__ */ ct.jsx("path", { d: n ? "M2.5 4.5 6 8l3.5-3.5" : "M4.5 2.5 8 6l-3.5 3.5" }) });
}
function gv(n) {
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
  return !!n.parentSessionId && n.parentSessionId !== n.id && l.some((o) => o.id === n.parentSessionId);
}
function bv(n) {
  const l = /* @__PURE__ */ new Map();
  for (const o of n)
    fs(o, n) && l.set(o.parentSessionId, [...l.get(o.parentSessionId) ?? [], o]);
  return l.size ? n.filter((o) => !fs(o, n)).flatMap((o) => [o, ...l.get(o.id) ?? []]) : n;
}
const Br = 6, pf = 8;
function vv(n, l = {}) {
  const { minWidth: o = 220, align: i = "right", minSpaceAbove: s = 100 } = l, f = n.getBoundingClientRect(), m = window.innerWidth, d = window.innerHeight, p = i === "right" ? { right: Math.max(0, m - f.right) } : { left: Math.max(0, f.left) }, y = f.top - Br - pf, E = d - f.bottom - Br - pf;
  return y >= s ? {
    position: "fixed",
    bottom: d - f.top + Br,
    ...p,
    minWidth: o,
    maxHeight: Math.min(y, d * 0.75),
    overflowY: "auto"
  } : {
    position: "fixed",
    top: f.bottom + Br,
    ...p,
    minWidth: o,
    maxHeight: Math.min(E, d * 0.75),
    overflowY: "auto"
  };
}
function mm(n, l, o, i) {
  oe(() => {
    if (!n) return;
    function s(m) {
      const d = m.target, p = o.current?.contains(d) ?? !1, y = i.current?.contains(d) ?? !1;
      !p && !y && l(!1);
    }
    function f(m) {
      m.key === "Escape" && l(!1);
    }
    return document.addEventListener("mousedown", s), document.addEventListener("keydown", f), () => {
      document.removeEventListener("mousedown", s), document.removeEventListener("keydown", f);
    };
  }, [n]);
}
function yv({ icon: n, fallback: l }) {
  const [o, i] = W.useState(!1);
  return oe(() => i(!1), [n]), !n || o ? /* @__PURE__ */ ct.jsx(ct.Fragment, { children: l }) : /* @__PURE__ */ ct.jsx("img", { src: n, alt: "", width: 14, height: 14, className: "size-[14px] rounded-[2px] object-contain", referrerPolicy: "no-referrer", onError: () => i(!0) });
}
const xv = ["application/zip", "application/x-tar", "application/gzip"];
function wv(n) {
  const l = n ?? "";
  if (l.startsWith("image/")) return "image";
  if (l.startsWith("video/")) return "video";
  if (l.startsWith("audio/")) return "audio";
  if (l === "application/pdf") return "pdf";
  if (xv.includes(l)) return "archive";
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
const _v = 50 * 1024 * 1024, hf = 1.25, kv = 0.05, Sv = 16384, Hr = Bt(ua, "min-h-8 min-w-8 px-2 text-[0.75rem] max-[700px]:min-h-11 max-[700px]:min-w-11"), Ev = { pdf: "PDF document", audio: "Audio", video: "Video" };
let zv = 0;
function Nv(n) {
  return n < 1024 ? `${n} B` : n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
function Tv(n, l, o) {
  const i = l ? Math.min(8, Sv / Math.max(l.width, l.height)) : 1, s = o === "in" ? n * hf : o === "out" ? n / hf : 1;
  return Math.min(i, Math.max(Math.min(kv, i), s));
}
function Cv(n, l) {
  return typeof n != "string" || !n.startsWith("/") ? null : `${n.replace(/\/+$/, "")}/${l.replace(/^\/+/, "")}`;
}
function Mv({ media: n, workspaceId: l, metadata: o, onFail: i }) {
  const s = W.useMemo(() => `media-${++zv}`, []), [f, m] = W.useState(null), [d, p] = W.useState("fit");
  oe(() => {
    let k = !0;
    return n.open(s, { workspaceId: l, path: o.path, mediaType: o.mediaType ?? "", size: o.size }).then((b) => {
      k && m(b ?? { width: 0, height: 0 });
    }, (b) => {
      k && i(String(b?.message ?? b));
    }), () => {
      k = !1, n.release(s);
    };
  }, [s]), oe(() => {
    n.setZoom(s, d === "fit" ? null : d);
  }, [s, d]);
  const y = f !== null && f.width > 0 && f.height > 0, E = () => d !== "fit" ? d : n.fitScale(s) ?? 1, _ = (k) => p(Tv(E(), f, k)), x = (k) => {
    if (!(k.metaKey || k.ctrlKey || k.altKey || !y)) {
      if (k.key === "+" || k.key === "=") _("in");
      else if (k.key === "-") _("out");
      else if (k.key === "0") _("actual");
      else return;
      k.preventDefault();
    }
  }, z = d === "fit" ? "Fit" : `${Math.round(d * 100)}%`;
  return W.createElement(
    "div",
    { className: "flex min-h-0 min-w-0 flex-1 flex-col", "data-testid": "workspace-image-viewer" },
    W.createElement(
      "div",
      { className: "flex shrink-0 flex-wrap items-center gap-1 px-3 py-1 text-[0.72rem] text-subtext-0", role: "toolbar", "aria-label": "Image view" },
      W.createElement("button", { type: "button", className: Hr, "aria-label": "Zoom out", title: "Zoom out (-)", disabled: !y, onClick: () => _("out") }, "−"),
      W.createElement("button", { type: "button", className: Hr, "aria-label": "Zoom in", title: "Zoom in (+)", disabled: !y, onClick: () => _("in") }, "+"),
      W.createElement("button", { type: "button", className: Bt(Hr, d === "fit" && "text-fg"), "aria-pressed": d === "fit", onClick: () => p("fit") }, "Fit"),
      W.createElement("button", { type: "button", className: Bt(Hr, d === 1 && "text-fg"), "aria-pressed": d === 1, title: "Actual size (0)", disabled: !y, onClick: () => _("actual") }, "100%"),
      W.createElement("span", { role: "status", className: "px-1", "data-testid": "workspace-image-info" }, y ? `${f.width} × ${f.height} · ${z}` : "")
    ),
    W.createElement("div", {
      className: "flex min-h-0 min-w-0 flex-1",
      tabIndex: 0,
      "aria-label": `${o.name} image. Plus and minus zoom, 0 shows actual size, arrow keys pan.`,
      onKeyDown: x
    }, f === null ? W.createElement("span", { className: "m-auto text-[0.8rem] text-subtext-0", role: "status" }, "Loading…") : W.createElement("div", { className: "relative min-h-0 min-w-0 flex-1", "data-perch-engine": "image", "data-perch-key": s, "data-testid": "workspace-file-image" }))
  );
}
function Av({ workspaceId: n, metadata: l, perch: o }) {
  const [i, s] = W.useState(!1), f = o.mediaFile?.(n, l.path) ?? { root: null, extraction: null }, m = f.extraction, d = wv(l.mediaType), p = Cv(f.root, l.path), y = p === null, E = d === "archive", _ = d === "image" && l.size > _v, x = d !== void 0 && !E && !y && !_;
  let z = "Open this file in Quick Look or its default app.";
  y ? z = "Use your SSH tools to download this file. Perch will not open a remote path on this machine." : E && (z = "Extract into a new folder beside this archive. Existing files are never overwritten.");
  let k = "No preview for this file type";
  y ? k = "Remote media is not available yet" : E ? k = "Compressed archive" : _ ? (k = "Image too large to preview", z = `This image is ${Math.round(l.size / 1048576)} MB. Open it in Quick Look or its default app.`) : i && (k = "Preview unavailable", d === "image" && (z = "The image may be corrupt or in a format Perch cannot decode. Open it in Quick Look or its default app."));
  const b = (j) => {
    try {
      o.media[j](p);
    } catch (R) {
      console.error(`perch-media ${j}: ${R?.message ?? R}`);
    }
  }, N = d === "pdf" || d === "audio" || d === "video";
  return W.createElement(
    "section",
    { className: "flex min-h-0 min-w-0 flex-1 flex-col", "aria-label": `Previewing ${l.path}`, "data-testid": "workspace-file-asset" },
    W.createElement(
      "header",
      { className: "flex shrink-0 flex-wrap items-center gap-2 px-3 py-2 text-[0.75rem]" },
      W.createElement("strong", { className: "min-w-0 flex-1 truncate", title: l.path }, l.path),
      E && W.createElement(
        "button",
        { type: "button", className: Bt(ua, "min-h-8 px-2"), disabled: m?.state === "loading", onClick: () => o.command("files.extract", { workspaceId: n, path: l.path }) },
        m?.state === "loading" ? "Extracting…" : "Extract"
      ),
      !y && W.createElement("button", { type: "button", className: Bt(ua, "min-h-8 px-2"), onClick: () => b("quickLook") }, "Quick Look"),
      !y && W.createElement("button", { type: "button", className: Bt(ua, "min-h-8 px-2"), onClick: () => b("openDefault") }, "Open with Default App")
    ),
    m?.state === "ready" && W.createElement("p", { role: "status", className: "m-0 px-3 py-2 text-[0.75rem] text-subtext-0" }, `Extracted to ${m.destination}. Find it in the file tree.`),
    m?.state === "error" && W.createElement("p", { role: "alert", className: "m-0 px-3 py-2 text-[0.75rem] text-red" }, m.error),
    !x || i ? W.createElement(
      "div",
      { className: "grid flex-1 content-center justify-items-center gap-2 p-5 text-center text-[0.8rem] text-subtext-0" },
      W.createElement("strong", { className: "text-fg" }, k),
      W.createElement("span", null, z)
    ) : d === "image" ? W.createElement(Mv, { media: o.media, workspaceId: n, metadata: l, onFail: () => s(!0) }) : N && W.createElement(
      "div",
      { className: "grid flex-1 content-center justify-items-center gap-2 p-5 text-center text-[0.8rem] text-subtext-0", "data-testid": "workspace-file-card" },
      W.createElement("strong", { className: "text-fg" }, l.name),
      W.createElement("span", null, `${Ev[d]} · ${Nv(l.size)}`),
      W.createElement("span", null, "Perch does not play or render this file. Open it in Quick Look or its default app.")
    )
  );
}
const jv = "mode-switch group ml-auto flex items-center gap-[0.4rem] bg-transparent p-[0.2rem] [border:none] [font-family:inherit]", pm = "text-[0.72rem] font-semibold tracking-[0.03em] text-overlay-1 uppercase [transition:color_0.15s_ease]", Ov = `${pm} group-aria-[checked=false]:text-accent`, Rv = `${pm} group-aria-checked:text-accent`, Dv = "relative h-[1.3rem] w-[2.4rem] shrink-0 rounded-[999px] border border-overlay-0 bg-surface-1 [transition:background_0.15s_ease] group-aria-checked:border-accent group-aria-checked:bg-panel-bg", Bv = "absolute top-px left-px h-[1.1rem] w-[1.1rem] rounded-[50%] bg-fg [box-shadow:0_1px_2px_rgba(0,0,0,0.3)] [transition:transform_0.15s_ease,background_0.15s_ease] group-aria-checked:bg-accent group-aria-checked:[transform:translateX(1.1rem)]";
function Hv({
  mode: n,
  onChange: l,
  testId: o = "mode-switch",
  disabled: i = !1
}) {
  const s = n === "cli";
  return /* @__PURE__ */ ct.jsxs(
    "button",
    {
      type: "button",
      className: jv,
      "data-testid": o,
      role: "switch",
      "aria-checked": s,
      "aria-label": "Toggle UI / CLI mode",
      disabled: i,
      onClick: () => l(s ? "ui" : "cli"),
      children: [
        /* @__PURE__ */ ct.jsx("span", { className: Bt("mode-switch__label mode-switch__label--ui", Ov), children: "UI" }),
        /* @__PURE__ */ ct.jsx("span", { className: Bt("mode-switch__track", Dv), children: /* @__PURE__ */ ct.jsx("span", { className: Bt("mode-switch__thumb", Bv) }) }),
        /* @__PURE__ */ ct.jsx("span", { className: Bt("mode-switch__label mode-switch__label--cli", Rv), children: "CLI" })
      ]
    }
  );
}
const Ga = function(n, l) {
  let s = n;
  const f = _l[l];
  let m = null, d = 0, p = null;
  const y = [], E = {}, _ = function(h, v) {
    d = s * 4 + 17, m = (function(w) {
      const S = new Array(w);
      for (let T = 0; T < w; T += 1) {
        S[T] = new Array(w);
        for (let B = 0; B < w; B += 1)
          S[T][B] = null;
      }
      return S;
    })(d), x(0, 0), x(d - 7, 0), x(0, d - 7), b(), k(), j(h, v), s >= 7 && N(h), p == null && (p = K(s, f, y)), R(p, v);
  }, x = function(h, v) {
    for (let w = -1; w <= 7; w += 1)
      if (!(h + w <= -1 || d <= h + w))
        for (let S = -1; S <= 7; S += 1)
          v + S <= -1 || d <= v + S || (0 <= w && w <= 6 && (S == 0 || S == 6) || 0 <= S && S <= 6 && (w == 0 || w == 6) || 2 <= w && w <= 4 && 2 <= S && S <= 4 ? m[h + w][v + S] = !0 : m[h + w][v + S] = !1);
  }, z = function() {
    let h = 0, v = 0;
    for (let w = 0; w < 8; w += 1) {
      _(!0, w);
      const S = Bn.getLostPoint(E);
      (w == 0 || h > S) && (h = S, v = w);
    }
    return v;
  }, k = function() {
    for (let h = 8; h < d - 8; h += 1)
      m[h][6] == null && (m[h][6] = h % 2 == 0);
    for (let h = 8; h < d - 8; h += 1)
      m[6][h] == null && (m[6][h] = h % 2 == 0);
  }, b = function() {
    const h = Bn.getPatternPosition(s);
    for (let v = 0; v < h.length; v += 1)
      for (let w = 0; w < h.length; w += 1) {
        const S = h[v], T = h[w];
        if (m[S][T] == null)
          for (let B = -2; B <= 2; B += 1)
            for (let L = -2; L <= 2; L += 1)
              B == -2 || B == 2 || L == -2 || L == 2 || B == 0 && L == 0 ? m[S + B][T + L] = !0 : m[S + B][T + L] = !1;
      }
  }, N = function(h) {
    const v = Bn.getBCHTypeNumber(s);
    for (let w = 0; w < 18; w += 1) {
      const S = !h && (v >> w & 1) == 1;
      m[Math.floor(w / 3)][w % 3 + d - 8 - 3] = S;
    }
    for (let w = 0; w < 18; w += 1) {
      const S = !h && (v >> w & 1) == 1;
      m[w % 3 + d - 8 - 3][Math.floor(w / 3)] = S;
    }
  }, j = function(h, v) {
    const w = f << 3 | v, S = Bn.getBCHTypeInfo(w);
    for (let T = 0; T < 15; T += 1) {
      const B = !h && (S >> T & 1) == 1;
      T < 6 ? m[T][8] = B : T < 8 ? m[T + 1][8] = B : m[d - 15 + T][8] = B;
    }
    for (let T = 0; T < 15; T += 1) {
      const B = !h && (S >> T & 1) == 1;
      T < 8 ? m[8][d - T - 1] = B : T < 9 ? m[8][15 - T - 1 + 1] = B : m[8][15 - T - 1] = B;
    }
    m[d - 8][8] = !h;
  }, R = function(h, v) {
    let w = -1, S = d - 1, T = 7, B = 0;
    const L = Bn.getMaskFunction(v);
    for (let $ = d - 1; $ > 0; $ -= 2)
      for ($ == 6 && ($ -= 1); ; ) {
        for (let et = 0; et < 2; et += 1)
          if (m[S][$ - et] == null) {
            let Q = !1;
            B < h.length && (Q = (h[B] >>> T & 1) == 1), L(S, $ - et) && (Q = !Q), m[S][$ - et] = Q, T -= 1, T == -1 && (B += 1, T = 7);
          }
        if (S += w, S < 0 || d <= S) {
          S -= w, w = -w;
          break;
        }
      }
  }, A = function(h, v) {
    let w = 0, S = 0, T = 0;
    const B = new Array(v.length), L = new Array(v.length);
    for (let Z = 0; Z < v.length; Z += 1) {
      const P = v[Z].dataCount, G = v[Z].totalCount - P;
      S = Math.max(S, P), T = Math.max(T, G), B[Z] = new Array(P);
      for (let nt = 0; nt < B[Z].length; nt += 1)
        B[Z][nt] = 255 & h.getBuffer()[nt + w];
      w += P;
      const V = Bn.getErrorCorrectPolynomial(G), X = Nl(B[Z], V.getLength() - 1).mod(V);
      L[Z] = new Array(V.getLength() - 1);
      for (let nt = 0; nt < L[Z].length; nt += 1) {
        const ot = nt + X.getLength() - L[Z].length;
        L[Z][nt] = ot >= 0 ? X.getAt(ot) : 0;
      }
    }
    let $ = 0;
    for (let Z = 0; Z < v.length; Z += 1)
      $ += v[Z].totalCount;
    const et = new Array($);
    let Q = 0;
    for (let Z = 0; Z < S; Z += 1)
      for (let P = 0; P < v.length; P += 1)
        Z < B[P].length && (et[Q] = B[P][Z], Q += 1);
    for (let Z = 0; Z < T; Z += 1)
      for (let P = 0; P < v.length; P += 1)
        Z < L[P].length && (et[Q] = L[P][Z], Q += 1);
    return et;
  }, K = function(h, v, w) {
    const S = gf.getRSBlocks(h, v), T = bf();
    for (let L = 0; L < w.length; L += 1) {
      const $ = w[L];
      T.put($.getMode(), 4), T.put($.getLength(), Bn.getLengthInBits($.getMode(), h)), $.write(T);
    }
    let B = 0;
    for (let L = 0; L < S.length; L += 1)
      B += S[L].dataCount;
    if (T.getLengthInBits() > B * 8)
      throw "code length overflow. (" + T.getLengthInBits() + ">" + B * 8 + ")";
    for (T.getLengthInBits() + 4 <= B * 8 && T.put(0, 4); T.getLengthInBits() % 8 != 0; )
      T.putBit(!1);
    for (; !(T.getLengthInBits() >= B * 8 || (T.put(236, 8), T.getLengthInBits() >= B * 8)); )
      T.put(17, 8);
    return A(T, S);
  };
  E.addData = function(h, v) {
    v = v || "Byte";
    let w = null;
    switch (v) {
      case "Numeric":
        w = Uv(h);
        break;
      case "Alphanumeric":
        w = qv(h);
        break;
      case "Byte":
        w = Yv(h);
        break;
      case "Kanji":
        w = Gv(h);
        break;
      default:
        throw "mode:" + v;
    }
    y.push(w), p = null;
  }, E.isDark = function(h, v) {
    if (h < 0 || d <= h || v < 0 || d <= v)
      throw h + "," + v;
    return m[h][v];
  }, E.getModuleCount = function() {
    return d;
  }, E.make = function() {
    if (s < 1) {
      let h = 1;
      for (; h < 40; h++) {
        const v = gf.getRSBlocks(h, f), w = bf();
        for (let T = 0; T < y.length; T++) {
          const B = y[T];
          w.put(B.getMode(), 4), w.put(B.getLength(), Bn.getLengthInBits(B.getMode(), h)), B.write(w);
        }
        let S = 0;
        for (let T = 0; T < v.length; T++)
          S += v[T].dataCount;
        if (w.getLengthInBits() <= S * 8)
          break;
      }
      s = h;
    }
    _(!1, z());
  }, E.createTableTag = function(h, v) {
    h = h || 2, v = typeof v > "u" ? h * 4 : v;
    let w = "";
    w += '<table style="', w += " border-width: 0px; border-style: none;", w += " border-collapse: collapse;", w += " padding: 0px; margin: " + v + "px;", w += '">', w += "<tbody>";
    for (let S = 0; S < E.getModuleCount(); S += 1) {
      w += "<tr>";
      for (let T = 0; T < E.getModuleCount(); T += 1)
        w += '<td style="', w += " border-width: 0px; border-style: none;", w += " border-collapse: collapse;", w += " padding: 0px; margin: 0px;", w += " width: " + h + "px;", w += " height: " + h + "px;", w += " background-color: ", w += E.isDark(S, T) ? "#000000" : "#ffffff", w += ";", w += '"/>';
      w += "</tr>";
    }
    return w += "</tbody>", w += "</table>", w;
  }, E.createSvgTag = function(h, v, w, S) {
    let T = {};
    typeof arguments[0] == "object" && (T = arguments[0], h = T.cellSize, v = T.margin, w = T.alt, S = T.title), h = h || 2, v = typeof v > "u" ? h * 4 : v, w = typeof w == "string" ? { text: w } : w || {}, w.text = w.text || null, w.id = w.text ? w.id || "qrcode-description" : null, S = typeof S == "string" ? { text: S } : S || {}, S.text = S.text || null, S.id = S.text ? S.id || "qrcode-title" : null;
    const B = E.getModuleCount() * h + v * 2;
    let L, $, et, Q, Z = "", P;
    for (P = "l" + h + ",0 0," + h + " -" + h + ",0 0,-" + h + "z ", Z += '<svg version="1.1" xmlns="http://www.w3.org/2000/svg"', Z += T.scalable ? "" : ' width="' + B + 'px" height="' + B + 'px"', Z += ' viewBox="0 0 ' + B + " " + B + '" ', Z += ' preserveAspectRatio="xMinYMin meet"', Z += S.text || w.text ? ' role="img" aria-labelledby="' + H([S.id, w.id].join(" ").trim()) + '"' : "", Z += ">", Z += S.text ? '<title id="' + H(S.id) + '">' + H(S.text) + "</title>" : "", Z += w.text ? '<description id="' + H(w.id) + '">' + H(w.text) + "</description>" : "", Z += '<rect width="100%" height="100%" fill="white" cx="0" cy="0"/>', Z += '<path d="', et = 0; et < E.getModuleCount(); et += 1)
      for (Q = et * h + v, L = 0; L < E.getModuleCount(); L += 1)
        E.isDark(et, L) && ($ = L * h + v, Z += "M" + $ + "," + Q + P);
    return Z += '" stroke="transparent" fill="black"/>', Z += "</svg>", Z;
  }, E.createDataURL = function(h, v) {
    h = h || 2, v = typeof v > "u" ? h * 4 : v;
    const w = E.getModuleCount() * h + v * 2, S = v, T = w - v;
    return Kv(w, w, function(B, L) {
      if (S <= B && B < T && S <= L && L < T) {
        const $ = Math.floor((B - S) / h), et = Math.floor((L - S) / h);
        return E.isDark(et, $) ? 0 : 1;
      } else
        return 1;
    });
  }, E.createImgTag = function(h, v, w) {
    h = h || 2, v = typeof v > "u" ? h * 4 : v;
    const S = E.getModuleCount() * h + v * 2;
    let T = "";
    return T += "<img", T += ' src="', T += E.createDataURL(h, v), T += '"', T += ' width="', T += S, T += '"', T += ' height="', T += S, T += '"', w && (T += ' alt="', T += H(w), T += '"'), T += "/>", T;
  };
  const H = function(h) {
    let v = "";
    for (let w = 0; w < h.length; w += 1) {
      const S = h.charAt(w);
      switch (S) {
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
          v += S;
          break;
      }
    }
    return v;
  }, D = function(h) {
    h = typeof h > "u" ? 2 : h;
    const w = E.getModuleCount() * 1 + h * 2, S = h, T = w - h;
    let B, L, $, et, Q;
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
    for (B = 0; B < w; B += 2) {
      for ($ = Math.floor((B - S) / 1), et = Math.floor((B + 1 - S) / 1), L = 0; L < w; L += 1)
        Q = "█", S <= L && L < T && S <= B && B < T && E.isDark($, Math.floor((L - S) / 1)) && (Q = " "), S <= L && L < T && S <= B + 1 && B + 1 < T && E.isDark(et, Math.floor((L - S) / 1)) ? Q += " " : Q += "█", G += h < 1 && B + 1 >= T ? P[Q] : Z[Q];
      G += `
`;
    }
    return w % 2 && h > 0 ? G.substring(0, G.length - w - 1) + Array(w + 1).join("▀") : G.substring(0, G.length - 1);
  };
  return E.createASCII = function(h, v) {
    if (h = h || 1, h < 2)
      return D(v);
    h -= 1, v = typeof v > "u" ? h * 2 : v;
    const w = E.getModuleCount() * h + v * 2, S = v, T = w - v;
    let B, L, $, et;
    const Q = Array(h + 1).join("██"), Z = Array(h + 1).join("  ");
    let P = "", G = "";
    for (B = 0; B < w; B += 1) {
      for ($ = Math.floor((B - S) / h), G = "", L = 0; L < w; L += 1)
        et = 1, S <= L && L < T && S <= B && B < T && E.isDark($, Math.floor((L - S) / h)) && (et = 0), G += et ? Q : Z;
      for ($ = 0; $ < h; $ += 1)
        P += G + `
`;
    }
    return P.substring(0, P.length - 1);
  }, E.renderTo2dContext = function(h, v) {
    v = v || 2;
    const w = E.getModuleCount();
    for (let S = 0; S < w; S++)
      for (let T = 0; T < w; T++)
        h.fillStyle = E.isDark(S, T) ? "black" : "white", h.fillRect(T * v, S * v, v, v);
  }, E;
};
Ga.stringToBytes = function(n) {
  const l = [];
  for (let o = 0; o < n.length; o += 1) {
    const i = n.charCodeAt(o);
    l.push(i & 255);
  }
  return l;
};
Ga.createStringToBytes = function(n, l) {
  const o = (function() {
    const s = Lv(n), f = function() {
      const p = s.read();
      if (p == -1) throw "eof";
      return p;
    };
    let m = 0;
    const d = {};
    for (; ; ) {
      const p = s.read();
      if (p == -1) break;
      const y = f(), E = f(), _ = f(), x = String.fromCharCode(p << 8 | y), z = E << 8 | _;
      d[x] = z, m += 1;
    }
    if (m != l)
      throw m + " != " + l;
    return d;
  })(), i = 63;
  return function(s) {
    const f = [];
    for (let m = 0; m < s.length; m += 1) {
      const d = s.charCodeAt(m);
      if (d < 128)
        f.push(d);
      else {
        const p = o[s.charAt(m)];
        typeof p == "number" ? (p & 255) == p ? f.push(p) : (f.push(p >>> 8), f.push(p & 255)) : f.push(i);
      }
    }
    return f;
  };
};
const de = {
  MODE_NUMBER: 1,
  MODE_ALPHA_NUM: 2,
  MODE_8BIT_BYTE: 4,
  MODE_KANJI: 8
}, _l = {
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
  ], l = 1335, o = 7973, i = 21522, s = {}, f = function(m) {
    let d = 0;
    for (; m != 0; )
      d += 1, m >>>= 1;
    return d;
  };
  return s.getBCHTypeInfo = function(m) {
    let d = m << 10;
    for (; f(d) - f(l) >= 0; )
      d ^= l << f(d) - f(l);
    return (m << 10 | d) ^ i;
  }, s.getBCHTypeNumber = function(m) {
    let d = m << 12;
    for (; f(d) - f(o) >= 0; )
      d ^= o << f(d) - f(o);
    return m << 12 | d;
  }, s.getPatternPosition = function(m) {
    return n[m - 1];
  }, s.getMaskFunction = function(m) {
    switch (m) {
      case Dn.PATTERN000:
        return function(d, p) {
          return (d + p) % 2 == 0;
        };
      case Dn.PATTERN001:
        return function(d, p) {
          return d % 2 == 0;
        };
      case Dn.PATTERN010:
        return function(d, p) {
          return p % 3 == 0;
        };
      case Dn.PATTERN011:
        return function(d, p) {
          return (d + p) % 3 == 0;
        };
      case Dn.PATTERN100:
        return function(d, p) {
          return (Math.floor(d / 2) + Math.floor(p / 3)) % 2 == 0;
        };
      case Dn.PATTERN101:
        return function(d, p) {
          return d * p % 2 + d * p % 3 == 0;
        };
      case Dn.PATTERN110:
        return function(d, p) {
          return (d * p % 2 + d * p % 3) % 2 == 0;
        };
      case Dn.PATTERN111:
        return function(d, p) {
          return (d * p % 3 + (d + p) % 2) % 2 == 0;
        };
      default:
        throw "bad maskPattern:" + m;
    }
  }, s.getErrorCorrectPolynomial = function(m) {
    let d = Nl([1], 0);
    for (let p = 0; p < m; p += 1)
      d = d.multiply(Nl([1, Hn.gexp(p)], 0));
    return d;
  }, s.getLengthInBits = function(m, d) {
    if (1 <= d && d < 10)
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
    else if (d < 27)
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
    else if (d < 41)
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
      throw "type:" + d;
  }, s.getLostPoint = function(m) {
    const d = m.getModuleCount();
    let p = 0;
    for (let _ = 0; _ < d; _ += 1)
      for (let x = 0; x < d; x += 1) {
        let z = 0;
        const k = m.isDark(_, x);
        for (let b = -1; b <= 1; b += 1)
          if (!(_ + b < 0 || d <= _ + b))
            for (let N = -1; N <= 1; N += 1)
              x + N < 0 || d <= x + N || b == 0 && N == 0 || k == m.isDark(_ + b, x + N) && (z += 1);
        z > 5 && (p += 3 + z - 5);
      }
    for (let _ = 0; _ < d - 1; _ += 1)
      for (let x = 0; x < d - 1; x += 1) {
        let z = 0;
        m.isDark(_, x) && (z += 1), m.isDark(_ + 1, x) && (z += 1), m.isDark(_, x + 1) && (z += 1), m.isDark(_ + 1, x + 1) && (z += 1), (z == 0 || z == 4) && (p += 3);
      }
    for (let _ = 0; _ < d; _ += 1)
      for (let x = 0; x < d - 6; x += 1)
        m.isDark(_, x) && !m.isDark(_, x + 1) && m.isDark(_, x + 2) && m.isDark(_, x + 3) && m.isDark(_, x + 4) && !m.isDark(_, x + 5) && m.isDark(_, x + 6) && (p += 40);
    for (let _ = 0; _ < d; _ += 1)
      for (let x = 0; x < d - 6; x += 1)
        m.isDark(x, _) && !m.isDark(x + 1, _) && m.isDark(x + 2, _) && m.isDark(x + 3, _) && m.isDark(x + 4, _) && !m.isDark(x + 5, _) && m.isDark(x + 6, _) && (p += 40);
    let y = 0;
    for (let _ = 0; _ < d; _ += 1)
      for (let x = 0; x < d; x += 1)
        m.isDark(x, _) && (y += 1);
    const E = Math.abs(100 * y / d / d - 50) / 5;
    return p += E * 10, p;
  }, s;
})(), Hn = (function() {
  const n = new Array(256), l = new Array(256);
  for (let i = 0; i < 8; i += 1)
    n[i] = 1 << i;
  for (let i = 8; i < 256; i += 1)
    n[i] = n[i - 4] ^ n[i - 5] ^ n[i - 6] ^ n[i - 8];
  for (let i = 0; i < 255; i += 1)
    l[n[i]] = i;
  const o = {};
  return o.glog = function(i) {
    if (i < 1)
      throw "glog(" + i + ")";
    return l[i];
  }, o.gexp = function(i) {
    for (; i < 0; )
      i += 255;
    for (; i >= 256; )
      i -= 255;
    return n[i];
  }, o;
})(), Nl = function(n, l) {
  if (typeof n.length > "u")
    throw n.length + "/" + l;
  const o = (function() {
    let s = 0;
    for (; s < n.length && n[s] == 0; )
      s += 1;
    const f = new Array(n.length - s + l);
    for (let m = 0; m < n.length - s; m += 1)
      f[m] = n[m + s];
    return f;
  })(), i = {};
  return i.getAt = function(s) {
    return o[s];
  }, i.getLength = function() {
    return o.length;
  }, i.multiply = function(s) {
    const f = new Array(i.getLength() + s.getLength() - 1);
    for (let m = 0; m < i.getLength(); m += 1)
      for (let d = 0; d < s.getLength(); d += 1)
        f[m + d] ^= Hn.gexp(Hn.glog(i.getAt(m)) + Hn.glog(s.getAt(d)));
    return Nl(f, 0);
  }, i.mod = function(s) {
    if (i.getLength() - s.getLength() < 0)
      return i;
    const f = Hn.glog(i.getAt(0)) - Hn.glog(s.getAt(0)), m = new Array(i.getLength());
    for (let d = 0; d < i.getLength(); d += 1)
      m[d] = i.getAt(d);
    for (let d = 0; d < s.getLength(); d += 1)
      m[d] ^= Hn.gexp(Hn.glog(s.getAt(d)) + f);
    return Nl(m, 0).mod(s);
  }, i;
}, gf = (function() {
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
  ], l = function(s, f) {
    const m = {};
    return m.totalCount = s, m.dataCount = f, m;
  }, o = {}, i = function(s, f) {
    switch (f) {
      case _l.L:
        return n[(s - 1) * 4 + 0];
      case _l.M:
        return n[(s - 1) * 4 + 1];
      case _l.Q:
        return n[(s - 1) * 4 + 2];
      case _l.H:
        return n[(s - 1) * 4 + 3];
      default:
        return;
    }
  };
  return o.getRSBlocks = function(s, f) {
    const m = i(s, f);
    if (typeof m > "u")
      throw "bad rs block @ typeNumber:" + s + "/errorCorrectionLevel:" + f;
    const d = m.length / 3, p = [];
    for (let y = 0; y < d; y += 1) {
      const E = m[y * 3 + 0], _ = m[y * 3 + 1], x = m[y * 3 + 2];
      for (let z = 0; z < E; z += 1)
        p.push(l(_, x));
    }
    return p;
  }, o;
})(), bf = function() {
  const n = [];
  let l = 0;
  const o = {};
  return o.getBuffer = function() {
    return n;
  }, o.getAt = function(i) {
    const s = Math.floor(i / 8);
    return (n[s] >>> 7 - i % 8 & 1) == 1;
  }, o.put = function(i, s) {
    for (let f = 0; f < s; f += 1)
      o.putBit((i >>> s - f - 1 & 1) == 1);
  }, o.getLengthInBits = function() {
    return l;
  }, o.putBit = function(i) {
    const s = Math.floor(l / 8);
    n.length <= s && n.push(0), i && (n[s] |= 128 >>> l % 8), l += 1;
  }, o;
}, Uv = function(n) {
  const l = de.MODE_NUMBER, o = n, i = {};
  i.getMode = function() {
    return l;
  }, i.getLength = function(m) {
    return o.length;
  }, i.write = function(m) {
    const d = o;
    let p = 0;
    for (; p + 2 < d.length; )
      m.put(s(d.substring(p, p + 3)), 10), p += 3;
    p < d.length && (d.length - p == 1 ? m.put(s(d.substring(p, p + 1)), 4) : d.length - p == 2 && m.put(s(d.substring(p, p + 2)), 7));
  };
  const s = function(m) {
    let d = 0;
    for (let p = 0; p < m.length; p += 1)
      d = d * 10 + f(m.charAt(p));
    return d;
  }, f = function(m) {
    if ("0" <= m && m <= "9")
      return m.charCodeAt(0) - 48;
    throw "illegal char :" + m;
  };
  return i;
}, qv = function(n) {
  const l = de.MODE_ALPHA_NUM, o = n, i = {};
  i.getMode = function() {
    return l;
  }, i.getLength = function(f) {
    return o.length;
  }, i.write = function(f) {
    const m = o;
    let d = 0;
    for (; d + 1 < m.length; )
      f.put(
        s(m.charAt(d)) * 45 + s(m.charAt(d + 1)),
        11
      ), d += 2;
    d < m.length && f.put(s(m.charAt(d)), 6);
  };
  const s = function(f) {
    if ("0" <= f && f <= "9")
      return f.charCodeAt(0) - 48;
    if ("A" <= f && f <= "Z")
      return f.charCodeAt(0) - 65 + 10;
    switch (f) {
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
        throw "illegal char :" + f;
    }
  };
  return i;
}, Yv = function(n) {
  const l = de.MODE_8BIT_BYTE, o = Ga.stringToBytes(n), i = {};
  return i.getMode = function() {
    return l;
  }, i.getLength = function(s) {
    return o.length;
  }, i.write = function(s) {
    for (let f = 0; f < o.length; f += 1)
      s.put(o[f], 8);
  }, i;
}, Gv = function(n) {
  const l = de.MODE_KANJI, o = Ga.stringToBytes;
  (function(f, m) {
    const d = o(f);
    if (d.length != 2 || (d[0] << 8 | d[1]) != m)
      throw "sjis not supported.";
  })("友", 38726);
  const i = o(n), s = {};
  return s.getMode = function() {
    return l;
  }, s.getLength = function(f) {
    return ~~(i.length / 2);
  }, s.write = function(f) {
    const m = i;
    let d = 0;
    for (; d + 1 < m.length; ) {
      let p = (255 & m[d]) << 8 | 255 & m[d + 1];
      if (33088 <= p && p <= 40956)
        p -= 33088;
      else if (57408 <= p && p <= 60351)
        p -= 49472;
      else
        throw "illegal char at " + (d + 1) + "/" + p;
      p = (p >>> 8 & 255) * 192 + (p & 255), f.put(p, 13), d += 2;
    }
    if (d < m.length)
      throw "illegal char at " + (d + 1);
  }, s;
}, hm = function() {
  const n = [], l = {};
  return l.writeByte = function(o) {
    n.push(o & 255);
  }, l.writeShort = function(o) {
    l.writeByte(o), l.writeByte(o >>> 8);
  }, l.writeBytes = function(o, i, s) {
    i = i || 0, s = s || o.length;
    for (let f = 0; f < s; f += 1)
      l.writeByte(o[f + i]);
  }, l.writeString = function(o) {
    for (let i = 0; i < o.length; i += 1)
      l.writeByte(o.charCodeAt(i));
  }, l.toByteArray = function() {
    return n;
  }, l.toString = function() {
    let o = "";
    o += "[";
    for (let i = 0; i < n.length; i += 1)
      i > 0 && (o += ","), o += n[i];
    return o += "]", o;
  }, l;
}, Qv = function() {
  let n = 0, l = 0, o = 0, i = "";
  const s = {}, f = function(d) {
    i += String.fromCharCode(m(d & 63));
  }, m = function(d) {
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
    for (n = n << 8 | d & 255, l += 8, o += 1; l >= 6; )
      f(n >>> l - 6), l -= 6;
  }, s.flush = function() {
    if (l > 0 && (f(n << 6 - l), n = 0, l = 0), o % 3 != 0) {
      const d = 3 - o % 3;
      for (let p = 0; p < d; p += 1)
        i += "=";
    }
  }, s.toString = function() {
    return i;
  }, s;
}, Lv = function(n) {
  const l = n;
  let o = 0, i = 0, s = 0;
  const f = {};
  f.read = function() {
    for (; s < 8; ) {
      if (o >= l.length) {
        if (s == 0)
          return -1;
        throw "unexpected end of file./" + s;
      }
      const p = l.charAt(o);
      if (o += 1, p == "=")
        return s = 0, -1;
      if (p.match(/^\s$/))
        continue;
      i = i << 6 | m(p.charCodeAt(0)), s += 6;
    }
    const d = i >>> s - 8 & 255;
    return s -= 8, d;
  };
  const m = function(d) {
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
  return f;
}, Vv = function(n, l) {
  const o = n, i = l, s = new Array(n * l), f = {};
  f.setPixel = function(y, E, _) {
    s[E * o + y] = _;
  }, f.write = function(y) {
    y.writeString("GIF87a"), y.writeShort(o), y.writeShort(i), y.writeByte(128), y.writeByte(0), y.writeByte(0), y.writeByte(0), y.writeByte(0), y.writeByte(0), y.writeByte(255), y.writeByte(255), y.writeByte(255), y.writeString(","), y.writeShort(0), y.writeShort(0), y.writeShort(o), y.writeShort(i), y.writeByte(0);
    const E = 2, _ = d(E);
    y.writeByte(E);
    let x = 0;
    for (; _.length - x > 255; )
      y.writeByte(255), y.writeBytes(_, x, 255), x += 255;
    y.writeByte(_.length - x), y.writeBytes(_, x, _.length - x), y.writeByte(0), y.writeString(";");
  };
  const m = function(y) {
    const E = y;
    let _ = 0, x = 0;
    const z = {};
    return z.write = function(k, b) {
      if (k >>> b)
        throw "length over";
      for (; _ + b >= 8; )
        E.writeByte(255 & (k << _ | x)), b -= 8 - _, k >>>= 8 - _, x = 0, _ = 0;
      x = k << _ | x, _ = _ + b;
    }, z.flush = function() {
      _ > 0 && E.writeByte(x);
    }, z;
  }, d = function(y) {
    const E = 1 << y, _ = (1 << y) + 1;
    let x = y + 1;
    const z = p();
    for (let R = 0; R < E; R += 1)
      z.add(String.fromCharCode(R));
    z.add(String.fromCharCode(E)), z.add(String.fromCharCode(_));
    const k = hm(), b = m(k);
    b.write(E, x);
    let N = 0, j = String.fromCharCode(s[N]);
    for (N += 1; N < s.length; ) {
      const R = String.fromCharCode(s[N]);
      N += 1, z.contains(j + R) ? j = j + R : (b.write(z.indexOf(j), x), z.size() < 4095 && (z.size() == 1 << x && (x += 1), z.add(j + R)), j = R);
    }
    return b.write(z.indexOf(j), x), b.write(_, x), b.flush(), k.toByteArray();
  }, p = function() {
    const y = {};
    let E = 0;
    const _ = {};
    return _.add = function(x) {
      if (_.contains(x))
        throw "dup key:" + x;
      y[x] = E, E += 1;
    }, _.size = function() {
      return E;
    }, _.indexOf = function(x) {
      return y[x];
    }, _.contains = function(x) {
      return typeof y[x] < "u";
    }, _;
  };
  return f;
}, Kv = function(n, l, o) {
  const i = Vv(n, l);
  for (let d = 0; d < l; d += 1)
    for (let p = 0; p < n; p += 1)
      i.setPixel(p, d, o(p, d));
  const s = hm();
  i.write(s);
  const f = Qv(), m = s.toByteArray();
  for (let d = 0; d < m.length; d += 1)
    f.writeByte(m[d]);
  return f.flush(), "data:image/gif;base64," + f;
};
Ga.stringToBytes;
function Xv({ text: n }) {
  const { size: l, path: o } = W.useMemo(() => {
    const i = Ga(0, "M");
    i.addData(n), i.make();
    const s = i.getModuleCount();
    let f = "";
    for (let m = 0; m < s; m++)
      for (let d = 0; d < s; d++) i.isDark(m, d) && (f += `M${d} ${m}h1v1h-1z`);
    return { size: s, path: f };
  }, [n]);
  return /* @__PURE__ */ ct.jsxs(
    "svg",
    {
      viewBox: `-4 -4 ${l + 8} ${l + 8}`,
      shapeRendering: "crispEdges",
      role: "img",
      "aria-label": "Pairing QR code",
      "data-testid": "pair-qr",
      className: "h-44 w-44 shrink-0 rounded-ui",
      children: [
        /* @__PURE__ */ ct.jsx("rect", { x: -4, y: -4, width: l + 8, height: l + 8, fill: "#fff" }),
        /* @__PURE__ */ ct.jsx("path", { d: o, fill: "#000" })
      ]
    }
  );
}
const Tl = W.createContext(""), ms = (n, l) => typeof n == "string" && n.toLowerCase().includes(l);
function Zv({ title: n, children: l, testId: o, ariaLabel: i }) {
  const s = W.useContext(Tl), f = s !== "" && ms(n, s);
  return (
    // While searching, a group with no matching row (and no matching title) hides itself.
    /* @__PURE__ */ ct.jsxs("section", { className: s && !f ? "mb-8 not-has-[[data-setting-row]]:hidden" : "mb-8", "data-testid": o, "aria-label": i, children: [
      n && /* @__PURE__ */ ct.jsx("h3", { className: "m-0 mb-3 text-[0.9rem] font-medium text-fg", children: n }),
      /* @__PURE__ */ ct.jsx("div", { className: "rounded-ui bg-surface-0 px-4", children: /* @__PURE__ */ ct.jsx(Tl.Provider, { value: f ? "" : s, children: l }) })
    ] })
  );
}
function Jv({ title: n, description: l, children: o, testId: i }) {
  const s = W.useContext(Tl);
  return s && !ms(n, s) && !ms(l, s) ? null : /* @__PURE__ */ ct.jsxs("div", { "data-setting-row": !0, "data-testid": i, className: "flex items-center justify-between gap-6 py-[0.8rem] max-[700px]:flex-wrap max-[700px]:gap-y-2", children: [
    /* @__PURE__ */ ct.jsxs("div", { className: "min-w-0 max-[700px]:flex-1 max-[700px]:basis-56", children: [
      /* @__PURE__ */ ct.jsx("div", { className: "text-[0.85rem] text-fg", children: n }),
      l && /* @__PURE__ */ ct.jsx("div", { className: "mt-[0.15rem] text-[0.75rem] text-subtext-0", children: l })
    ] }),
    o && /* @__PURE__ */ ct.jsx("div", { className: "flex shrink-0 items-center gap-2", children: o })
  ] });
}
function Wv({ checked: n, onChange: l, testId: o, label: i }) {
  return /* @__PURE__ */ ct.jsx(
    "input",
    {
      type: "checkbox",
      role: "switch",
      "aria-label": i,
      "data-testid": o,
      checked: n,
      onChange: (s) => l(s.target.checked),
      className: "relative h-[1.25rem] w-[2.25rem] shrink-0 cursor-pointer appearance-none rounded-full bg-overlay-0 [transition:background_0.12s_ease] before:absolute before:top-[0.15rem] before:left-[0.15rem] before:h-[0.95rem] before:w-[0.95rem] before:rounded-full before:bg-fg before:content-[''] before:[transition:transform_0.12s_ease] checked:bg-accent checked:before:translate-x-[1rem] checked:before:bg-panel-bg focus-visible:[outline:2px_solid_var(--accent)] focus-visible:[outline-offset:2px]"
    }
  );
}
//! The Settings pages' shared parts for `@perch/sdk` 1.8 (`sdk.ts` re-exports and lists them). Each wraps the host
//! component or class string the pages are drawn with and owns no state. `SettingsGroup` and `SettingRow` are the
//! host's own, so the Settings search (`SettingsQuery`) filters a copy's rows exactly as it filters Perch's.
const Fv = () => W.useContext(Tl), Iv = {
  select: Ns,
  selectHost: lv,
  input: rv,
  inputPort: iv,
  inputWide: ov,
  addRow: sv,
  list: cv,
  hostRow: dv,
  name: fv,
  addr: mv,
  muted: nv,
  empty: av,
  primary: pv,
  danger: hv,
  catalogToggle: ev
};
//! State the host keeps for a resource rather than for one view of it (`useResourceState`, `@perch/sdk` 1.4): a
//! review's unsent commit message and comment, its pending batch and its operation id, keyed by the screen's
//! own name for the resource (`review:<workspace>:commit`). Every view and copy that names the same key shares the
//! value, and it outlives a reload or swap of the screen's code, a released hidden copy and the phone/desktop
//! layouts trading places. In memory: a page reload starts empty (durable drafts live in their own services).
const $v = 512, Fe = /* @__PURE__ */ new Map(), Sl = /* @__PURE__ */ new Map();
function gm(n, l) {
  Fe.delete(n), Fe.set(n, l);
  for (const o of Fe.keys()) {
    if (Fe.size <= $v) break;
    Sl.get(o)?.size || Fe.delete(o);
  }
}
function Pv(n, l) {
  return Fe.has(n) ? Fe.get(n) : l;
}
function t1(n, l, o) {
  const i = Pv(n, o), s = typeof l == "function" ? l(i) : l;
  if (!(Fe.has(n) && Object.is(s, i))) {
    gm(n, s);
    for (const f of [...Sl.get(n) ?? []]) f();
  }
}
function e1(n, l) {
  if (typeof n != "string" || !n) throw new Error("useResourceState needs a non-empty key.");
  Fe.has(n) || gm(n, l);
  const o = W.useCallback((f) => {
    const m = Sl.get(n) ?? /* @__PURE__ */ new Set();
    return Sl.set(n, m), m.add(f), () => {
      m.delete(f), m.size || Sl.delete(n);
    };
  }, [n]), i = W.useSyncExternalStore(o, () => Fe.get(n)), s = W.useCallback((f) => t1(n, f, l), [n]);
  return [i, s];
}
const n1 = "[--radius:var(--radius-pane)] rounded-soft bg-surface-1/70 shadow-[0_6px_20px_rgba(0,0,0,0.3)] backdrop-blur-xl backdrop-saturate-150", a1 = "hover:bg-transparent hover:text-subtext-0 active:bg-surface-1 active:text-fg";
//! `@perch/sdk` for the native client: the surface a stock screen imports (the navigation part, 1.3), with every
//! call going to one abstract host object, `globalThis.perch`, read when called (so a host or a test sets it before
//! mounting). Class helpers, icons, `cn`, `keyLabel` and the host dot are the app's own modules, compiled in, so the
//! classes are the web's to the character. Data hooks subscribe to `perch.subscribe` and read the host's snapshots
//! (`perch.navigation(options)`, `perch.hosts()`, ...), which must return the same object until the data changes.
//! Menus and dialogs Perch draws itself (session menu, new session menu, confirm, select, folder browser,
//! instructions, memory) open through `perch.openOverlay(kind, props)`; their callbacks are plain functions.
const l1 = "1.3.0";
let Vr = null;
const r1 = (n) => {
  Vr = n;
};
function kt() {
  const n = (typeof Vr == "function" ? Vr() : Vr) ?? globalThis.perch;
  if (!n) throw new Error("@perch/sdk: no perch host (globalThis.perch) is set");
  return n;
}
const i1 = (n) => kt().subscribe?.(n) ?? (() => {
}), o1 = vv;
function s1() {
  return typeof globalThis.crypto?.randomUUID == "function" ? globalThis.crypto.randomUUID() : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (n) => {
    const l = Math.floor(Math.random() * 16);
    return (n === "x" ? l : l & 3 | 8).toString(16);
  });
}
const bm = globalThis.perch?.isMac !== !1, ps = (n) => Hb(n, kt().isMac !== !1), c1 = (n) => qb(n), u1 = ({ className: n, ...l } = {}) => Bt(Gb(l), n), d1 = Lb, vm = (n) => Vb(n), Kr = Kb, f1 = ua, m1 = sm, p1 = (n) => ds[n].color, h1 = (n, l) => kt().shortcutFor?.(n, l) ?? null, g1 = (n) => kt().shortcutLabel?.(n) ?? null, ri = (n, l) => kt().command(n, l ?? {}) !== !1, b1 = (n, l, o) => kt().startSession?.(n, l, o), v1 = globalThis.perch?.pickFolder ? (n) => kt().pickFolder(n) : null;
function Pt(n) {
  const l = W.useRef(n);
  return l.current = n, W.useSyncExternalStore(i1, () => l.current(kt()));
}
const ym = (n = {}) => Pt((l) => l.navigation({ showTerminals: !!n.showTerminals, sortByAttention: !!n.sortByAttention })), y1 = () => Pt((n) => n.hosts()), x1 = () => Pt((n) => n.sessionFolders());
function w1() {
  const n = Pt((l) => l.addProject?.() ?? _1);
  return {
    status: n.status ?? "idle",
    error: n.error,
    hostId: n.hostId,
    add: (l, o, i) => {
      l.trim() && n.status !== "pending" && kt().addProjectFolder?.(l, o, i);
    },
    clear: () => kt().clearAddProject?.()
  };
}
const _1 = Object.freeze({ status: "idle" }), xm = "perch.lastAgentChoice", k1 = Object.freeze({ connected: !1, discovery: !1, state: "ready", choices: [] }), S1 = () => {
  const n = kt().storage?.getItem(xm);
  return n === "claude" || n === "codex" ? n : "claude";
}, E1 = Object.freeze({ items: [] });
function z1() {
  const n = Pt((l) => l.notifications?.() ?? E1);
  return W.useMemo(() => ({
    items: n.items ?? [],
    open: (l) => kt().command("notification.open", { id: l }),
    dismiss: (l) => kt().command("notification.dismiss", { id: l })
  }), [n]);
}
function N1(n) {
  const l = Pt((s) => s.agentChoices?.(n) ?? k1), [o, i] = W.useState(S1);
  return W.useMemo(() => ({
    connected: !!l.connected,
    discovery: !!l.discovery,
    choices: l.choices ?? [],
    lastChoice: o,
    state: l.state ?? "ready",
    error: l.state === "error" ? l.error : void 0,
    rememberChoice: (s) => {
      s !== "claude" && s !== "codex" || (kt().storage?.setItem(xm, s), i(s));
    },
    manage: () => kt().command("agents.manage", {})
  }), [l, o]);
}
function T1(n) {
  oe(() => kt().onRequest?.("add-project", n) ?? void 0, [n]);
}
function C1(n) {
  const l = n.map((o) => ({ id: o.id, parentSessionId: o.parentId, session: o }));
  return bv(l).map((o) => ({ session: o.session, nested: fs(o, l) }));
}
function M1({ id: n, plain: l, className: o }) {
  const i = Pt((y) => y.session(n));
  if (!i) return null;
  const s = i.state ?? gv(i), f = ds[s]?.color ?? ds.unknown.color, m = i.provider, d = m === "claude" || m === "claude-agent-teams" || m === "omp", p = l ? Bt("agent-mark", "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full leading-none", o) : Bt("agent-status-dot", `agent-status-dot--${s}`, "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-[1.5px] bg-panel-bg leading-none", o);
  return W.createElement(
    "span",
    { className: p, style: l ? void 0 : { borderColor: f }, "data-provider": m ?? "unknown", title: l ? m ?? "Agent" : `${m ?? "Agent"} · ${s}`, "aria-hidden": "true" },
    W.createElement("span", { className: Bt("inline-flex text-fg", d && "rounded-full bg-[#161616]") }, W.createElement(wm, { provider: m, size: 14 }))
  );
}
function wm({ provider: n, size: l = 14 }) {
  const o = kt().agentIcon?.(n, l) ?? null, i = o?.markup ?? '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><circle cx="8" cy="8" r="5" fill="currentColor"/></svg>';
  return W.createElement("svg", { width: l, height: l, "aria-hidden": "true", "data-agent-icon": n ?? "unknown", "data-perch-markup": i, ...o && o.tint === !1 ? { "data-perch-image": "true" } : {} });
}
const A1 = ({ children: n }) => W.createElement(W.Fragment, null, n);
function j1(n, l) {
  const o = W.useRef(l);
  return o.current = l, oe(() => {
    const i = kt();
    if (!i.openOverlay) throw new Error(`@perch/sdk: the host draws no overlays (perch.openOverlay), so ${n} cannot open`);
    const s = {};
    for (const [m, d] of Object.entries(o.current))
      s[m] = typeof d == "function" ? (...p) => o.current[m]?.(...p) : d;
    const f = i.openOverlay(n, s);
    return () => i.closeOverlay?.(f);
  }, [n]), null;
}
const fa = (n) => function(o) {
  return j1(n, o);
}, O1 = fa("session-menu"), R1 = fa("new-session-menu"), D1 = fa("confirm");
let _m = null;
const B1 = (n) => {
  _m = n;
};
function H1(n) {
  return W.createElement(_m ?? D1, n);
}
function U1({ className: n = Ns, ...l }) {
  return W.createElement($b, { ...l, className: n });
}
let hs = null;
const q1 = (n) => {
  hs = n;
}, Y1 = fa("folder-browser");
function G1(n) {
  return hs ? W.createElement(hs, { ...n, browse: (l) => kt().browse(n.hostId, l) }) : W.createElement(Y1, n);
}
const Q1 = fa("instructions"), L1 = fa("memory"), V1 = Fb;
let Cs = null;
const K1 = (n) => {
  Cs = n;
};
function X1(n) {
  if (Cs) return W.createElement(J1, n);
  const { hostId: l, path: o, className: i } = n, s = W.useRef(null);
  return W.createElement(
    "button",
    {
      type: "button",
      ref: s,
      className: Bt("worktree-menu__btn", sm, i),
      "data-testid": `worktree-menu-${l}-${o}`,
      title: "New workspace (a git worktree)",
      "aria-label": "New workspace",
      "aria-expanded": !1,
      onClick: () => kt().openOverlay?.("worktree", { hostId: l, cwd: o, anchor: s.current?.getBoundingClientRect() })
    },
    W.createElement(cm, null)
  );
}
const km = "Perch did not answer.";
function Ur(n) {
  return n ? n.type === "worktree.error" ? { error: n.message, dirty: !!n.dirty } : n.error ? { error: String(n.error) } : {} : { error: km };
}
function Z1(n, l, o = kt()) {
  const i = (s) => {
    for (const f of s ?? []) {
      if (f.path === l) return f;
      const m = i(f.children);
      if (m) return m;
    }
    return null;
  };
  for (const s of o.navigation({})?.projects ?? []) {
    if (s.hostId !== n) continue;
    const f = i(s.workspaces) ?? i(s.hidden);
    if (f) return f;
  }
  return null;
}
const vf = 5 * 6e4;
function Sm(n, l, o, i = kt()) {
  const s = Date.now() + vf;
  let f = !1, m = () => {
  };
  const d = () => {
    f = !0, m(), clearTimeout(y);
  }, p = () => {
    if (!f) {
      if (Date.now() >= s) return d();
      Z1(n, l, i) && (d(), i.startSession?.(n, l, o));
    }
  }, y = setTimeout(d, vf);
  m = i.subscribe?.(p) ?? (() => {
  }), p();
}
function J1({ hostId: n, path: l, className: o, worktrees: i, request: s, parentChoices: f, emptyAgent: m, ...d }) {
  const [p, y] = W.useState(i), E = (S) => !!kt().coreCan?.(S, n), _ = ym(), x = `${n}:${l}`, z = W.useMemo(() => {
    if (Array.isArray(f)) return f;
    if (!E("workspace.nest")) return [];
    const S = _?.projects?.find((L) => L.hostId === n && L.repoPath === l), T = [], B = (L, $) => {
      for (const et of L ?? [])
        $ && T.push({ id: et.id, name: et.name, path: et.path }), B(et.children, !0);
    };
    return B(S?.workspaces, !1), T;
  }, [f, _, n, l]), k = n === "local" && E("worktree.job"), b = d.deleteSupported ?? E("worktree.delete"), N = d.startFromSupported ?? E("worktree.startFrom"), j = Pt((S) => S.emptyWorkspaceAgent?.() ?? void 0), R = m ?? j ?? void 0, A = Pt((S) => S.worktreeMenuRequest?.() ?? null), K = A?.projectKey === x ? A.nonce : null, H = W.useMemo(() => s ?? (K == null ? null : A), [s, K]), [D, h] = W.useState(H);
  oe(() => {
    H && h(H);
  }, [H]);
  const v = W.useRef({});
  v.current = { background: k, deleteSupported: b };
  const w = W.useMemo(() => {
    const S = (T, B) => kt().ask(T, { hostId: n, repoPath: l, ...B });
    return {
      list: async () => {
        const T = await S("worktree.list", {});
        return T?.type === "worktree.list.result" && y({ worktrees: T.worktrees ?? [], defaultRoot: T.defaultRoot ?? "", baseRef: T.baseRef, refs: T.refs ?? [] }), Ur(T);
      },
      create: async ({ branch: T, newBranch: B, path: L, extra: $, agent: et }) => {
        const Q = { branch: T, newBranch: !!B, path: L ?? null, name: $?.name ?? null, startFrom: $?.startFrom ?? null, parentWorkspaceId: $?.parentWorkspaceId ?? null }, { background: Z } = v.current, P = await S(Z ? "worktree.job.start" : "worktree.create", Q), G = Z ? "worktree.job.started" : "worktree.done";
        if (P?.type !== G) return { error: Ur(P).error ?? km };
        const V = Z ? P.job?.path : P.path;
        return et && V && Sm(n, V, et), { background: Z };
      },
      remove: async (T, B) => {
        const L = await S("worktree.remove", { path: T, force: !!B, deleteBranch: v.current.deleteSupported });
        return { ...Ur(L), preservedBranch: L?.type === "worktree.done" ? L.preservedBranch ?? void 0 : void 0 };
      },
      deleteBranch: async (T, B) => Ur(await S("worktree.branch.delete", { branch: T, expectedHead: B })),
      open: (T) => kt().startSession?.(n, T, "terminal"),
      // The window forgets the request; the screen keeps it until a newer one, as clearing it would re-run (and so
      // cancel) the screen's effect that a measurement put off until the next frame (`measured`).
      takeRequest: () => kt().takeWorktreeRequest?.()
    };
  }, [n, l]);
  return W.createElement(Cs, {
    hostId: n,
    cwd: l,
    projectKey: x,
    className: o,
    worktrees: p,
    background: k,
    startFromSupported: N,
    deleteSupported: b,
    parentChoices: z,
    emptyAgent: R,
    request: D,
    actions: w
  });
}
const W1 = (n, l) => {
  if (!kt().followPointer?.(n)) return;
  const o = l.items();
  for (const i of o) i.getBoundingClientRect();
  o[0]?.parentElement?.getBoundingClientRect(), Ob(n, l);
}, F1 = () => Pt((n) => n.workspaceTabs()), I1 = () => Pt((n) => n.statusLine()), $1 = () => Pt((n) => n.zoom()), P1 = () => Pt((n) => n.paneLook()), ty = () => Pt((n) => n.keybindings?.() ?? []), ey = Object.freeze({ usage: Object.freeze([]), updatedAt: 0, spend: null, redeemResult: null });
function ny(n) {
  const l = !!n?.keepFresh, o = Pt((s) => s.statusLine?.().connected ?? !1), i = Pt((s) => s.planUsage?.() ?? ey);
  return oe(() => {
    if (!l || !o) return;
    let s;
    const f = () => {
      kt().command("usage.get"), s = setTimeout(f, 18e4);
    };
    return f(), () => clearTimeout(s);
  }, [l, o]), i;
}
const ay = () => kt().command("usage.get", { force: !0 }), ly = (n) => kt().command("usage.redeemReset", { accountId: n }), ry = () => ri("app.zoom_reset"), iy = {
  focused: "bg-[color-mix(in_srgb,var(--text)_10%,var(--panel-bg))] hover:bg-[color-mix(in_srgb,var(--text)_10%,var(--panel-bg))] text-fg font-semibold",
  visible: "bg-transparent text-subtext-0 hover:bg-surface-0 hover:text-fg",
  hidden: "bg-transparent text-subtext-0 hover:bg-surface-0 hover:text-fg"
}, oy = (n, l, o) => kt().beginTabDrag?.(n, l, o);
function sy(n) {
  oe(() => kt().onRequest?.("new-tab", n) ?? void 0, [n]);
}
const cy = (n) => ri("browser.open", { workspaceId: n }), uy = (n, l) => ri("file.open", { workspaceId: n, path: l }), dy = () => null, fy = () => null, my = fa("new-file");
function py(n) {
  return W.createElement(Av, { ...n, perch: kt() });
}
function hy(n, l) {
  const o = n.selection(l);
  if (o) return o;
  const i = n.value(l), s = i.split(`
`).length - (i.endsWith(`
`) && i.length ? 1 : 0);
  return { text: i, startLine: 1, endLine: Math.max(1, s) };
}
function gy({ onGo: n, onClose: l }) {
  const [o, i] = W.useState(""), s = (f) => {
    f?.preventDefault?.();
    const [m, d] = o.split(":").map((p) => Number.parseInt(p, 10));
    Number.isFinite(m) ? n(m, Number.isFinite(d) ? d : 1) : l();
  };
  return W.createElement(
    "div",
    { className: "flex shrink-0 items-center gap-2 border-b border-border px-3 py-1 text-[0.75rem] text-subtext-0", "data-testid": "editor-goto" },
    W.createElement("label", { htmlFor: "perch-editor-goto" }, "Go to line"),
    W.createElement("input", {
      id: "perch-editor-goto",
      "data-testid": "editor-goto-line",
      autoFocus: !0,
      value: o,
      className: "min-w-0 flex-1 rounded border border-border bg-transparent px-1 text-text",
      onChange: (f) => i(f.target.value),
      onKeyDown: (f) => {
        f.key === "Escape" ? (f.preventDefault(), l()) : f.key === "Enter" && s(f);
      }
    }),
    W.createElement("button", { type: "button", className: ua, onClick: s }, "OK")
  );
}
function by({ value: n, onChange: l, onSave: o, onCaret: i, readOnly: s, wrap: f, label: m, path: d, docKey: p, onAskAgent: y, ref: E }) {
  const _ = kt().editor, x = W.useRef(null);
  x.current = { onChange: l, onSave: o, onCaret: i, onAskAgent: y };
  const z = W.useRef(n), [k, b] = W.useState(null), [N, j] = W.useState(!1), R = () => {
    if (!_ || !x.current.onAskAgent) return;
    const { text: H, startLine: D, endLine: h } = hy(_, p);
    x.current.onAskAgent(H, D, h);
  };
  if (W.useImperativeHandle(E, () => ({
    openGoto: () => j(!0),
    focus: () => _?.focus(p),
    askAgent: R
  }), [p]), Xr(() => {
    if (!_) return;
    _.open(p, { path: d, value: n, readonly: !!s, wrap: !!f, label: m }), z.current = n;
    const H = _.watch(p, (D) => {
      for (const h of D)
        if (h.type === "change") {
          const v = _.value(p);
          z.current = v, x.current.onChange?.(v);
        } else h.type === "caret" ? x.current.onCaret?.({ line: h.line, col: h.col }) : h.type === "save" ? x.current.onSave?.() : h.type === "goto" ? j(!0) : h.type === "contextmenu" && b({ x: h.x, y: h.y });
    });
    return () => {
      H(), _.park(p);
    };
  }, [p]), oe(() => {
    !_ || n === z.current || (z.current = n, _.setValue(p, n, { external: !0 }));
  }, [p, n]), oe(() => {
    _?.setReadonly(p, !!s);
  }, [p, s]), oe(() => {
    _?.setWrap(p, !!f);
  }, [p, f]), !_)
    return W.createElement("textarea", { className: "h-full min-h-0 w-full flex-1 bg-transparent font-mono text-text", "aria-label": m, value: n, readOnly: s, onChange: (H) => l?.(H.target.value) });
  const A = (H) => () => {
    b(null), H(), _.focus(p);
  }, K = k ? !!_.selection(p) : !1;
  return W.createElement(
    "div",
    { className: "relative flex h-full min-h-0 min-w-0 flex-1 flex-col", "aria-label": m },
    N && W.createElement(gy, {
      onGo: (H, D) => {
        j(!1), _.goTo(p, H, D), _.focus(p);
      },
      onClose: () => {
        j(!1), _.focus(p);
      }
    }),
    W.createElement("div", { "data-perch-engine": "editor", "data-perch-key": p, className: "min-h-0 min-w-0 flex-1" }),
    k && W.createElement(tv, {
      x: k.x,
      y: k.y,
      readOnly: !!s,
      canUndo: _.canUndo(p),
      canRedo: _.canRedo(p),
      hasSelection: K,
      onClose: () => b(null),
      actions: {
        undo: A(() => _.undo(p)),
        redo: A(() => _.redo(p)),
        cut: A(() => _.cut(p)),
        copy: A(() => _.copy(p)),
        paste: A(() => _.paste(p)),
        selectAll: A(() => _.selectAll(p)),
        find: A(() => _.openSearch(p, !1)),
        replace: A(() => _.openSearch(p, !0)),
        gotoLine: () => {
          b(null), j(!0);
        },
        ...y ? { askAgent: () => {
          b(null), R();
        } } : {}
      }
    })
  );
}
const vy = Object.freeze({ pages: [], shownId: null, tabCount: 0 });
function yy(n) {
  const l = Pt((o) => o.browserPages?.(n) ?? vy);
  return W.useMemo(() => {
    const o = (i, s) => kt().command(i, { workspaceId: n, ...s });
    return {
      pages: l.pages ?? [],
      shownId: l.shownId ?? null,
      tabCount: l.tabCount ?? 0,
      open: () => {
        const i = `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
        return o("browser.drawer.open", { id: i }), i;
      },
      select: (i) => o("browser.drawer.select", { id: i }),
      close: (i) => o("browser.drawer.close", { id: i }),
      closeAll: () => o("browser.drawer.closeAll", {}),
      // The window follows the page itself; nothing to keep here.
      setUrl: () => {
      }
    };
  }, [l, n]);
}
function xy({ pageId: n, active: l }) {
  const o = `drawer
${n}`;
  return oe(() => {
    l && kt().command("browser.focus", { key: o });
  }, [l, o]), W.createElement("div", {
    "data-perch-engine": "browser",
    "data-perch-key": o,
    "data-testid": "browser-page",
    style: { display: "flex", flex: "1 1 0%", minHeight: 0, minWidth: 0 }
  });
}
const Ry = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  AgentIcon: wm,
  BrowserPage: xy,
  Chevron: fm,
  CloseIcon: Jb,
  CodeEditor: by,
  ConfirmDialog: H1,
  Dialog: V1,
  EllipsisIcon: Xb,
  FileAsset: py,
  FolderBrowser: G1,
  GearIcon: Zb,
  HostStateDot: Wb,
  InstructionsDialog: Q1,
  MemoryDialog: L1,
  ModeSwitch: Hv,
  NewFilePrompt: my,
  NewSessionMenu: R1,
  PageIcon: yv,
  PlusIcon: cm,
  QrCode: Xv,
  Select: U1,
  SessionDot: M1,
  SessionMenu: O1,
  SettingRow: Jv,
  SettingsGroup: Zv,
  SettingsQuery: Tl,
  Slot: A1,
  Switch: Wv,
  TabDragLayer: fy,
  TabMenu: dy,
  WorktreeMenu: X1,
  agentStateColor: p1,
  anchoredPopoverStyle: o1,
  beginReorderDrag: W1,
  beginTabDrag: oy,
  bindHost: r1,
  buttonClass: d1,
  cn: Bt,
  drawConfirmationsInPlace: B1,
  drawFolderBrowserInPlace: q1,
  drawWorktreeInPlace: K1,
  ghostButton: f1,
  glassClass: n1,
  iconButton: m1,
  isMac: bm,
  keyLabel: ps,
  menuDividerClass: Kr,
  menuItemClass: vm,
  menuPanel: zs,
  nestSessions: C1,
  newId: s1,
  openBrowserTab: cy,
  openFileTab: uy,
  pickFolder: v1,
  redeemUsageReset: ly,
  refreshUsage: ay,
  resetZoom: ry,
  rowActionClass: u1,
  runCommand: ri,
  segmentClass: c1,
  settingsClass: Iv,
  shortcutFor: h1,
  shortcutLabel: g1,
  startPaneWhenReady: Sm,
  startSession: b1,
  tabStateClass: iy,
  tapButtonClass: a1,
  useAddProject: w1,
  useAddProjectRequest: T1,
  useAgentChoices: N1,
  useBrowserPages: yy,
  useDismissOnOutsideClick: mm,
  useHostSnapshot: Pt,
  useHosts: y1,
  useKeybindings: ty,
  useNavigation: ym,
  useNewTabRequest: sy,
  useNotifications: z1,
  usePaneLook: P1,
  usePlanUsage: ny,
  useResourceState: e1,
  useSessionFolders: x1,
  useSettingsQuery: Fv,
  useStatusLine: I1,
  useWorkspaceTabs: F1,
  useZoom: $1,
  version: l1
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
  Ms[n] = (l, o) => l[n](o);
const Dy = Object.keys(Ms);
function Po(n, l) {
  for (const [o, i] of Object.entries(l)) {
    const s = Ms[o];
    if (!s) throw new Error(`the description key ${o} has no GPUI builder`);
    i != null && (n = s(n, i));
  }
  return n;
}
const Un = (n) => ({ clientX: n?.position?.x ?? 0, clientY: n?.position?.y ?? 0 }), yf = /* @__PURE__ */ new WeakSet(), ts = /* @__PURE__ */ new WeakSet();
function xf(n, l, o) {
  const i = n.pressed, s = Un(o);
  return i && i.x === s.clientX && i.y === s.clientY ? i.id : l;
}
function wy(n, l, o) {
  if (n.name) return n.name;
  if (!(l.size || n.hover || n.focus || n.active || n.track_hover && ti.has(n.group) || o)) return null;
  const i = n.meta?.attrs["data-testid"];
  return i ? `~${n.id}:${i}` : `~${n.id}`;
}
const Em = (n, l = !1) => (n.children ?? []).some((o) => o.kind === "text" ? !l || /\s/.test(String(o.text ?? "").trim()) : o.kind === "div" && o.style?.flex_direction !== "row" && o.style?.whitespace !== "nowrap" && Em(o, !0)), Te = (n) => n.style?.display !== "hidden";
let ti = /* @__PURE__ */ new Set();
function zm(n, l = /* @__PURE__ */ new Set()) {
  for (const { group: o, style: i } of n.group_hover ?? []) "display" in i && l.add(o);
  for (const o of n.children ?? []) o.kind !== "text" && zm(o, l);
  return l;
}
function gs(n, l, o, i, s = !1, f = !1, m = null, d = {}, p = !1, y = /* @__PURE__ */ new Map(), E = null) {
  if (n.kind === "text") return y.get(n)?.text ?? n.text;
  const _ = yf.has(n);
  f ||= n.style.opacity === 0 || n.style.visibility === "invisible" || n.style.display === "hidden", f && (n.name || n.range_name) && (n = { ...n, name: void 0, range_name: void 0, also: void 0 }), n.style.text_color !== void 0 && (E = null), m = n.style.text_color ?? m;
  const x = !!n.hover?.text_color && Mm(n), z = n.group ?? (x ? `~g${n.id}` : null);
  x && (E = { group: z, color: n.hover.text_color }), d = { ...d };
  for (const S of ["text_size", "line_height", "whitespace", "text_ellipsis"]) n.style[S] !== void 0 && (d[S] = n.style[S]);
  const k = new Set(n.events ?? []);
  let b;
  if (n.kind === "image" && !n.markup ? b = l.image(n.src) : b = l.div(), n.kind === "engine" && (b = b.child(i.engine ? i.engine(n.engine, n.key) : l.div())), n.markup && n.kind === "svg" && E && E.color !== m) {
    const { group: S, color: T } = E, B = () => l.div().absolute().top(0).left(0).size_full();
    b = b.child(B().group_hover(S, (L) => L.invisible()).child(i.icon(`~icon-${n.id}`, n.markup, m))).child(B().invisible().group_hover(S, (L) => L.visible()).child(i.icon(`~icon-${n.id}-hover`, n.markup, T)));
  } else n.markup && (b = b.child(i.icon(`~icon-${n.id}`, n.markup, n.kind === "svg" ? m : "")));
  const N = wy(n, k, s);
  if (N && (b = b.id(N)), n.measure && (b = b.measure(n.measure)), n.name && b.also_named) for (const S of n.also ?? []) b = b.also_named(S);
  b = Po(b, { ...n.style, ...y.get(n) });
  const j = d.whitespace !== "nowrap" && !d.text_ellipsis;
  p && j && n.style.flex_shrink !== 0 && n.style.min_w === void 0 && Em(n) && (b = b.min_w(0));
  for (const S of ["hover", "focus", "active"]) n[S] && (b = b[S]((T) => Po(T, n[S])));
  z && (b = b.group(z));
  for (const { group: S, style: T } of n.group_hover ?? []) {
    const { display: B, ...L } = T;
    Object.keys(L).length && (b = b.group_hover(S, ($) => Po($, L)));
  }
  if (l.scroll && (n.style.overflow_x === "scroll" || n.style.overflow_y === "scroll")) {
    const S = o.document?.scrollTarget, T = S ? (n.children ?? []).filter(Te).findIndex((B) => Cm(B, S.id)) : -1;
    if (T >= 0 && (o.scroller ?? n.id) === n.id && (o.document.scrollTarget = null, o.scroller = n.id, l.scroll.scroll_to_item(T)), o.scroller ??= n.id, o.scroller === n.id && o.document) {
      b = b.track_scroll(l.scroll);
      const B = (n.children ?? []).filter(Te).map((L) => L.id);
      o.document.itemBounds = (L) => B.includes(L) ? l.scroll.item_bounds?.(B.indexOf(L)) ?? null : null;
    }
  }
  const R = n.style.overflow_x === "scroll" || n.style.overflow_y === "scroll", A = s && !n.pointer_none || n.blocks_pointer;
  if ((R && ts.has(n) || A) && (b = b.on_scroll_wheel((S, T) => T.stop_propagation?.())), R || ts.has(n)) for (const S of n.children ?? []) S.kind !== "text" && ts.add(S);
  n.kind === "input" && !n.disabled && (b = b.on_mouse_down("left", (S, T) => {
    S.bounds && o.setBounds(n.id, S.bounds), o.focus(n.id), T.notify();
  }));
  const K = n.kind === "input" ? n : n.meta?.tag === "label" ? Tm(n) : null;
  K && !K.disabled && /^(checkbox|radio)$/.test(K.input_type) && (b = b.on_click((S, T) => {
    T.stop_propagation?.(), o.toggle(K.id), T.notify();
  }));
  const H = ["click", "double_click", "context_menu", "mouse_down", "mouse_up"].some((S) => k.has(S));
  if (H || _) for (const S of n.children ?? []) S.kind !== "text" && yf.add(S);
  if (H && (b = b.on_mouse_down("left", (S, T) => {
    T.stop_propagation?.(), S.bounds && o.setBounds(n.id, S.bounds);
    const B = { ...Un(S), button: 0, buttons: 1, detail: S.click_count }, L = xf(o, n.id, S);
    o.pressed = null, o.dispatch(L, "pointerdown", { ...B, pointerType: "mouse" }), o.dispatch(L, "mousedown", B) && o.pressFocus?.(L), T.notify();
  }), b = b.on_mouse_down("right", (S, T) => {
    T.stop_propagation?.(), S.bounds && o.setBounds(n.id, S.bounds);
    const B = xf(o, n.id, S);
    o.pressed = null, o.dispatch(B, "contextmenu", { ...Un(S), button: 2 }), T.notify();
  }), b = b.on_mouse_up("left", (S, T) => {
    T.stop_propagation?.();
    const B = { ...Un(S), button: 0 };
    o.dispatch(n.id, "pointerup", { ...B, pointerType: "mouse" }), o.dispatch(n.id, "mouseup", B), T.notify();
  }), b = b.on_click((S, T) => {
    o.dispatch(n.id, S.click_count === 2 && k.has("double_click") ? "dblclick" : "click", { detail: S.click_count, button: 0 }), T.notify();
  })), n.blocks_pointer && !H)
    for (const S of ["left", "right"]) b = b.on_mouse_down(S, (T, B) => B.stop_propagation?.());
  else if (_ && !H)
    for (const S of ["left", "right"])
      b = b.on_mouse_down(S, (T) => {
        const B = Un(T);
        (o.pressed?.x !== B.clientX || o.pressed?.y !== B.clientY) && (o.pressed = { id: n.id, x: B.clientX, y: B.clientY });
      });
  if (k.has("mouse_move") && (b = b.on_mouse_move((S) => {
    o.dispatch(n.id, "pointermove", { ...Un(S), pointerType: "mouse" });
  })), n.track_hover && ti.has(n.group) && (b = b.on_hover((S, T) => {
    o.hover(n.id, S), T.notify();
  })), s && (b = b.on_mouse_down_out((S, T) => {
    o.dispatch(o.document.body.id, "pointerdown", { ...Un(S), pointerType: "mouse" }), o.dispatch(o.document.body.id, "mousedown", Un(S)), T.notify();
  })), n.kind === "input" && !/^(checkbox|radio|range|color|file|select)$/.test(n.input_type)) {
    const S = n.value ? String(n.value) : String(n.placeholder ?? "");
    let T = l.div().whitespace_nowrap().overflow_x_hidden();
    const B = ca(d);
    B && (T = T.h(B)), !n.value && m && (T = T.text_color(ky(m))), S && (b = b.child(T.child(n.input_type === "password" && n.value ? "•".repeat([...S].length) : S))), n.field_w && (b = b.child(l.div().w(n.field_w).h(0)));
  }
  const D = d.whitespace === "nowrap" ? ca(d) : null, h = n.style.display === "flex" && !String(n.style.flex_direction ?? "row").startsWith("col");
  let v = !n.range_name;
  const w = n.style.display === "flex" && String(n.style.flex_direction ?? "row").startsWith("col") && (n.style.h === void 0 || n.style.h === "auto") && typeof n.style.max_h == "number";
  for (const S of (n.children ?? []).filter(Te)) {
    const T = S.style?.flex_basis;
    w && S.style.flex_grow > 0 && (T === 0 || typeof T == "string" && T.endsWith("%")) && y.set(S, { ...y.get(S), flex_basis: "auto" });
    let B = gs(S, l, o, i, !1, f, m, d, h && S.style?.position !== "absolute", y, E);
    const L = !v && (S.kind === "text" || !S.meta), $ = S.kind === "text" ? y.get(S)?.h ?? D : null, et = S.kind === "text" ? y.get(S)?.w : void 0;
    if (L || $ || et !== void 0) {
      let Q = l.div();
      L && (Q = Q.id(n.range_name)), L && !h && n.style.display === "flex" && (Q = Q[`self_${_y[d.text_align] ?? "start"}`]().max_w("100%")), $ && (Q = Q.h($)), et !== void 0 && (Q = Q.w(et).flex_none().whitespace_nowrap()), B = Q.child(B), v ||= L;
    }
    b = b.child(B);
  }
  return b;
}
const _y = { center: "center", right: "end", end: "end" };
function ky(n) {
  const l = String(n);
  if (!/^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(l)) return n;
  const o = l.length === 9 ? Number.parseInt(l.slice(7), 16) : 255;
  return `${l.slice(0, 7)}${Math.round(o / 2).toString(16).padStart(2, "0")}`;
}
const Nm = /^(?:[!-,.-~]+|\S)$/u, Tm = (n) => {
  for (const l of n.children ?? []) {
    if (l.kind === "input" && /^(checkbox|radio)$/.test(l.input_type)) return l;
    const o = l.kind === "text" ? null : Tm(l);
    if (o) return o;
  }
  return null;
}, Cm = (n, l) => n.id === l || (n.children ?? []).some((o) => o.kind !== "text" && Cm(o, l)), Mm = (n) => !!n.markup || (n.children ?? []).some((l) => l.kind !== "text" && Mm(l));
function ca(n) {
  const l = n.line_height;
  return typeof l == "string" && l.endsWith("px") ? Number.parseFloat(l) : typeof l == "number" && typeof n.text_size == "number" ? l * n.text_size : null;
}
function By(n, l, o, i, s = 0, f = !1) {
  const m = [n.root, ...n.overlays];
  ti = /* @__PURE__ */ new Set();
  for (const E of m) zm(E, ti);
  const d = s > 0 ? My(m, s) : /* @__PURE__ */ new Map();
  s > 0 && i.measure && Sy(m, s, i.measure, d), Ty(m, d), Ny(m, d), i.measure && zy(m, i.measure, d);
  let p = l.div().relative().size_full().child(gs(n.root, l, o, i, !1, !1, null, {}, !1, d)), y = f && n.overlays.length ? l.div().relative().size_full().window_layer() : p;
  for (const E of n.overlays) y = y.child(gs(E, l, o, i, !0, !1, null, {}, !1, d));
  return y === p ? p : p.child(y);
}
function Sy(n, l, o, i) {
  const s = (k, b) => i.set(k, { ...i.get(k), ...b }), f = /* @__PURE__ */ new Map(), m = /* @__PURE__ */ new Map(), d = ["text_size", "font_weight", "font_family", "italic", "whitespace", "text_ellipsis"];
  function p(k, b, N) {
    if (k.kind === "text") {
      if (!(b.whitespace === "nowrap" || Nm.test(k.text)) || b.text_ellipsis || N || typeof b.text_size != "number") return NaN;
      const h = o(k.text, { size: b.text_size, weight: b.font_weight ?? 400, family: b.font_family ?? ".SystemUIFont", italic: !!b.italic });
      return Number.isFinite(h) ? h : NaN;
    }
    if (!Te(k) || k.kind === "input" || k.kind === "engine" || k.markup) return y(k);
    const j = { ...b };
    for (const D of d) k.style[D] !== void 0 && (j[D] = k.style[D]);
    j.text_ellipsis = !!k.style.text_ellipsis, m.set(k, j);
    const R = k.style, A = (k.children ?? []).filter(Qe), K = A.map((D) => p(D, j, N || !!k.tabular));
    let H = y(k);
    if (!Number.isFinite(H) && R.w === void 0) {
      const D = A.map((v, w) => K[w] + (v.kind === "text" ? 0 : it(v.style.ml) + it(v.style.mr)));
      let h;
      A.length ? Re(k) ? h = A.some((v) => v.kind !== "text" && v.style.flex_grow > 0) || R.flex_wrap === "wrap" ? NaN : D.reduce((v, w) => v + w, 0) + it(R.gap_x) * (A.length - 1) : h = Math.max(...D) : h = 0, H = h + it(R.pl) + it(R.pr) + it(R.border_l) + it(R.border_r), typeof R.min_w == "number" && (H = Math.max(H, R.min_w)), typeof R.max_w == "number" && (H = Math.min(H, R.max_w));
    }
    return f.set(k, H), H;
  }
  const y = (k) => typeof k.style?.w == "number" ? k.style.w : NaN, E = () => ({ exact: 0, laid: 0 }), _ = (k, b) => {
    if (!Number.isFinite(b))
      return Object.assign(k, E()), NaN;
    k.exact += b;
    const N = Math.round(k.exact * l + 1e-9) / l, j = N - k.laid;
    return k.laid = N, j;
  }, x = (k) => Re(k) && k.style.flex_wrap !== "wrap" && (k.style.justify ?? "start") === "start";
  function z(k) {
    if (!k || k.kind === "text" || !Te(k)) return;
    const b = (k.children ?? []).filter(Qe);
    if (x(k) && b.length > 1) {
      const N = it(k.style.gap_x), j = E(), R = !(N && b.some((A) => A.kind === "text" || !Number.isFinite(it(A.style.ml))));
      s(k, { border_l: _(j, it(k.style.border_l)), pl: _(j, it(k.style.pl)) }), R && N && s(k, { gap_x: 0 }), b.forEach((A, K) => {
        const H = (K && R ? N : 0) + (A.kind === "text" ? 0 : it(A.style.ml));
        if (A.kind === "text")
          H && Object.assign(j, E());
        else {
          const w = _(j, H);
          Number.isFinite(w) && s(A, { ml: w });
        }
        const D = A.kind === "text" ? m.get(k) ?? {} : null, h = A.kind === "text" ? p(A, D, !!k.tabular) : f.get(A);
        if ((A.kind === "text" || !(A.style.flex_grow > 0)) && Number.isFinite(h)) {
          const w = { w: _(j, h) };
          A.kind !== "text" && typeof A.style.w != "number" && A.style.min_w === void 0 && (w.whitespace = "nowrap", w.flex_shrink = 0), s(A, w);
        } else Object.assign(j, E());
        if (A.kind !== "text") {
          const w = _(j, it(A.style.mr));
          Number.isFinite(w) && s(A, { mr: w });
        }
      });
    }
    for (const N of k.children ?? []) N.kind !== "text" && z(N);
  }
  for (const k of n)
    k && (p(k, {}, !1), z(k));
}
const Ey = /(?<= +)(?=[^ ])|(?<=[\p{L}\p{N}]-)(?=[\p{L}\p{N}])/u;
function zy(n, l, o) {
  const i = ["text_size", "font_weight", "font_family", "italic", "line_height"], s = (d) => typeof d == "number" ? d : 0, f = (d, p) => p && ei(p) && !Re(p) && d.style.position !== "absolute" && !["start", "center", "end"].includes(d.style.self) && !["start", "center", "end"].includes(p.style.items), m = (d, p, y, E) => {
    if (!d || d.kind === "text" || !Te(d)) return;
    const _ = d.style;
    let x = typeof _.w == "number" ? _.w : _.w === "100%" ? y : f(d, p) ? y - s(_.ml) - s(_.mr) : NaN;
    typeof _.max_w == "number" && (x = Math.min(x, _.max_w));
    const z = x - s(_.pl) - s(_.pr) - s(_.border_l) - s(_.border_r), k = { ...E };
    for (const N of i) _[N] !== void 0 && (k[N] = _[N]);
    const b = d.children ?? [];
    if (d.break_anywhere && Number.isFinite(z) && z > 0 && typeof k.text_size == "number" && b.length && b.every((N) => N.kind === "text")) {
      const N = { size: k.text_size, weight: k.font_weight ?? 400, family: k.font_family ?? ".SystemUIFont", italic: !!k.italic }, j = (K) => l(K.trimEnd(), N) <= z + 0.01;
      let R = 0;
      for (const K of b) {
        const H = [];
        for (const h of K.text.split(`
`)) {
          let v = "";
          for (const w of h.split(Ey)) {
            if (j(v + w)) {
              v += w;
              continue;
            }
            v && H.push(v.trimEnd()), v = "";
            for (const S of w)
              v && !j(v + S) && (H.push(v), v = ""), v += S;
          }
          H.push(v.trimEnd());
        }
        const D = H.join(`
`);
        H.every((h) => !h || j(h)) ? D !== K.text && o.set(K, { ...o.get(K), text: D }) : R = NaN, R += H.length;
      }
      const A = ca(k);
      Number.isFinite(R) && A && _.h === void 0 && b.length === 1 && o.set(d, { ...o.get(d), h: R * A + s(_.pt) + s(_.pb) + s(_.border_t) + s(_.border_b) });
    }
    for (const N of b) m(N, d, Re(d) ? NaN : z, k);
  };
  for (const d of n) m(d, null, NaN, {});
}
function Ny(n, l) {
  const o = (i, s) => {
    if (!i || i.kind === "text" || !Te(i)) return;
    const f = i.style, m = f.position === "absolute" ? f.w === void 0 && (f.left === void 0 || f.right === void 0) : s && typeof f.w != "number";
    if (m && Re(i))
      for (const d of i.children ?? []) {
        const p = d.kind === "text" ? void 0 : d.style.flex_basis;
        d.kind !== "text" && d.style.flex_grow > 0 && (p === 0 || typeof p == "string" && p.endsWith("%")) && l.set(d, { ...l.get(d), flex_basis: "auto" });
      }
    for (const d of i.children ?? []) o(d, m);
  };
  for (const i of n) o(i, !1);
}
function Ty(n, l) {
  const o = l.heights ?? /* @__PURE__ */ new Map(), i = (p) => o.get(p), s = (p) => {
    const y = i(p);
    if (Number.isFinite(y)) return y;
    if (p.kind === "text" || !Te(p)) return 0;
    const E = p.style, _ = typeof E.min_h == "number" ? E.min_h : 0, x = (p.children ?? []).filter(Qe), z = x.map((N) => s(N) + (N.kind === "text" ? 0 : Math.max(0, it(N.style.mt) || 0) + Math.max(0, it(N.style.mb) || 0))), k = x.length ? Re(p) ? Math.max(...z) : z.reduce((N, j) => N + j, 0) + (E.display === "flex" ? (it(E.gap_y) || 0) * (x.length - 1) : 0) : 0, b = [E.pt, E.pb, E.border_t, E.border_b].reduce((N, j) => N + (it(j) || 0), 0);
    return Math.max(_, k + b);
  }, f = (p) => !(p.children ?? []).filter(Qe).length || Re(p) ? NaN : s({ ...p, style: { ...p.style, h: void 0, max_h: void 0, min_h: void 0 } }), m = (p, y) => {
    const E = p.style;
    if (typeof E.h == "number") return E.h;
    if (typeof E.max_h == "number") return E.max_h;
    if (!y || !ei(y) || Re(y)) return NaN;
    const _ = y.style, x = typeof _.h == "number" ? _.h : typeof _.max_h == "number" ? _.max_h : NaN, z = (y.children ?? []).filter(Qe);
    let k = 0;
    for (const N of z) {
      if (N === p) continue;
      const j = i(N);
      if (!Number.isFinite(j)) return NaN;
      k += j + (N.kind === "text" ? 0 : it(N.style.mt) + it(N.style.mb));
    }
    const b = _.display === "flex" ? it(_.gap_y) * Math.max(0, z.length - 1) : 0;
    return x - it(_.pt) - it(_.pb) - it(_.border_t) - it(_.border_b) - k - b - it(E.mt) - it(E.mb);
  }, d = (p, y) => {
    if (!(!p || p.kind === "text" || !Te(p))) {
      if (p.scrollbar > 0 && p.style.overflow_y === "scroll") {
        const E = f(p), _ = m(p, y);
        Number.isFinite(E) && Number.isFinite(_) && E > _ + 0.01 && l.set(p, { ...l.get(p), pr: it(p.style.pr) + p.scrollbar });
      }
      for (const E of p.children ?? []) d(E, p);
    }
  };
  for (const p of n) d(p, null);
}
const Cy = ["text_size", "line_height", "whitespace", "text_ellipsis"], it = (n) => n == null ? 0 : typeof n == "number" ? n : NaN, ei = (n) => n.style.display === "flex" ? n.style.flex_direction === "col" : !0, Re = (n) => n.style.display === "flex" && (n.style.flex_direction ?? "row") === "row", Qe = (n) => n.kind === "text" || Te(n) && n.style.position !== "absolute";
function My(n, l) {
  const o = /* @__PURE__ */ new Map(), i = (b, N) => o.set(b, { ...o.get(b), ...Object.fromEntries(Object.entries(N).filter(([, j]) => Number.isFinite(j))) }), s = /* @__PURE__ */ new Map(), f = /* @__PURE__ */ new Map();
  function m(b, N) {
    if (b.kind === "text") return N.whitespace === "nowrap" || Nm.test(b.text) ? ca(N) ?? NaN : NaN;
    const j = { ...N };
    for (const D of Cy) b.style[D] !== void 0 && (j[D] = b.style[D]);
    f.set(b, j);
    const R = b.style, A = (b.children ?? []).filter(Qe), K = A.map((D) => m(D, j));
    let H;
    if (R.h !== void 0 && R.h !== "auto") H = it(R.h);
    else if (b.kind === "engine") H = NaN;
    else if (b.kind === "input")
      H = (b.input_type === "textarea" || b.input_type === "select" ? NaN : ca(j) ?? NaN) + it(R.pt) + it(R.pb) + it(R.border_t) + it(R.border_b), R.min_h !== void 0 && (H = Math.max(H, it(R.min_h)));
    else {
      const D = A.map((v, w) => (v.kind === "text" ? 0 : it(v.style.mt) + it(v.style.mb)) + K[w]);
      let h;
      if (Re(b)) h = R.flex_wrap === "wrap" ? NaN : R.items === "baseline" ? p(A, K, j) : Math.max(0, ...D);
      else if (ei(b)) {
        const v = A.some((S) => S.kind !== "text" && (S.style.flex_grow > 0 || S.style.flex_basis !== void 0)), w = R.display !== "flex" && A.some((S) => S.kind !== "text" && (it(S.style.mt) || it(S.style.mb)));
        h = v || w ? NaN : D.reduce((S, T) => S + T, 0) + (R.display === "flex" ? it(R.gap_y) * Math.max(0, A.length - 1) : 0);
      } else h = NaN;
      H = h + it(R.pt) + it(R.pb) + it(R.border_t) + it(R.border_b), R.min_h !== void 0 && (H = Math.max(H, it(R.min_h))), R.max_h !== void 0 && (H = Math.min(H, it(R.max_h)));
    }
    return s.set(b, H), H;
  }
  const d = (b) => (ca(b) - (Fr + Gf) * b.text_size) / 2 + Fr * b.text_size;
  function p(b, N, j) {
    let R = 0, A = 0;
    for (const [K, H] of b.entries()) {
      const D = H.kind === "text" ? j : f.get(H);
      if (!(H.kind === "text" || (H.children ?? []).filter(Qe).every((S) => S.kind === "text")) || !Number.isFinite(N[K]) || typeof D.text_size != "number") return NaN;
      const v = H.kind === "text" ? {} : H.style, w = it(v.mt) + it(v.border_t) + it(v.pt) + d(D);
      R = Math.max(R, w), A = Math.max(A, it(v.mt) + N[K] + it(v.mb) - w);
    }
    return R + A;
  }
  const y = () => ({ exact: 0, laid: 0 }), E = (b, N) => {
    if (!Number.isFinite(N))
      return Object.assign(b, y()), NaN;
    b.exact += N;
    const j = Math.round(b.exact * l + 1e-9) / l, R = j - b.laid;
    return b.laid = j, R;
  };
  function _(b) {
    if (!(b.kind === "text" || !Te(b))) {
      for (const N of (b.children ?? []).filter((j) => j.kind !== "text" && Te(j) && j.style.position === "absolute")) _(N);
      if (ei(b) && !Re(b)) {
        const N = y();
        i(b, { border_t: E(N, it(b.style.border_t)), pt: E(N, it(b.style.pt)) }), x(b, N);
      } else for (const N of (b.children ?? []).filter(Qe)) N.kind !== "text" && _(N);
    }
  }
  function x(b, N) {
    const j = (b.children ?? []).filter(Qe), R = b.style.display === "flex" ? it(b.style.gap_y) : 0;
    if (R && j.some((A) => A.kind === "text")) {
      for (const A of j) A.kind !== "text" && _(A);
      return !1;
    }
    return R && i(b, { gap_y: 0 }), j.forEach((A, K) => {
      if (A.kind === "text") {
        const H = s.get(A) ?? m(A, f.get(b) ?? {});
        Number.isFinite(H) ? i(A, { h: E(N, H) }) : Object.assign(N, y());
        return;
      }
      if (i(A, { mt: E(N, (K ? R : 0) + it(A.style.mt)) }), Number.isFinite(s.get(A))) k(A, N);
      else if (z(A)) {
        const H = A.style;
        i(A, { border_t: E(N, it(H.border_t)), pt: E(N, it(H.pt)) }), i(A, { pb: E(N, it(H.pb)), border_b: E(N, it(H.border_b)) });
      } else
        _(A), Object.assign(N, y());
      i(A, { mb: E(N, it(A.style.mb)) });
    }), !0;
  }
  function z(b) {
    const N = b.style, j = (b.children ?? []).filter(Qe), R = ca(f.get(b) ?? {});
    return b.kind === "div" && !Re(b) && j.length > 0 && j.every((A) => A.kind === "text") && Number.isInteger(R) && [N.h, N.min_h, N.max_h].every((A) => A === void 0 || A === "auto");
  }
  function k(b, N) {
    const j = b.style;
    for (const D of (b.children ?? []).filter((h) => h.kind !== "text" && Te(h) && h.style.position === "absolute")) _(D);
    const R = N.laid, A = N.exact;
    i(b, { border_t: E(N, it(j.border_t)), pt: E(N, it(j.pt)) });
    const K = j.h !== void 0 && j.h !== "auto", H = s.get(b) - it(j.pt) - it(j.pb) - it(j.border_t) - it(j.border_b);
    if (b.kind === "input")
      K || E(N, H);
    else if (Re(b) || K && (j.justify ?? "start") !== "start") {
      for (const D of (b.children ?? []).filter(Qe)) D.kind !== "text" && _(D);
      K || E(N, H);
    } else !x(b, N) && !K && E(N, H);
    if (K) {
      N.exact = A + s.get(b), N.laid = Math.round(N.exact * l + 1e-9) / l, i(b, { h: N.laid - R });
      return;
    }
    i(b, { pb: E(N, it(j.pb)), border_b: E(N, it(j.border_b)) }), i(b, { h: N.laid - R });
  }
  for (const b of n)
    m(b, {}), _(b);
  return Object.defineProperty(o, "heights", { value: s }), o;
}
const Hy = { sidebar: [{ name: "sidebar-root", selector: "aside.sidebar" }, { name: "sidebar-content", selector: "aside.sidebar > div:first-child" }, { name: "host-switcher", selector: '[data-testid="host-switcher"]' }, { name: "host-chip", selector: '[data-testid="host-switcher"] > div' }, { name: "host-badge", selector: ".sidebar__env-badge" }, { name: "host-name", selector: ".sidebar__env-host" }, { name: "host-meta", selector: '[data-testid="host-switcher"] > div > div:first-child > span:nth-child(3)' }, { name: "host-line", selector: ".sidebar__env-cwd" }, { name: "host-caret", selector: '[data-testid="host-switcher"] > span[aria-hidden="true"]' }, { name: "new-session-button", selector: 'button[data-testid^="new-session-"]', key: { self: !0, attr: "data-testid", strip: "new-session-" } }, { name: "new-session-icon", selector: 'button[data-testid^="new-session-"] > svg' }, { name: "new-session-label", selector: 'button[data-testid^="new-session-"]', textRange: !0 }, { name: "new-session-shortcut", selector: 'button[data-testid^="new-session-"] > span' }, { name: "overview", selector: '[data-testid="workspace-overview"]' }, { name: "overview-header", selector: '[data-testid="workspace-overview"] > div:first-child' }, { name: "overview-title", selector: '[data-testid="workspace-overview"] > div:first-child > div:first-child > span:first-child' }, { name: "needs-you-button", selector: '[data-testid="workspace-needs-you"]' }, { name: "organize-button", selector: '[data-testid="workspace-organize"]' }, { name: "organize-icon", selector: '[data-testid="workspace-organize"] > svg' }, { name: "add-project-button", selector: '[data-testid="workspace-add-project"]' }, { name: "add-project-icon", selector: '[data-testid="workspace-add-project"] > svg' }, { name: "add-project-label", selector: '[data-testid="workspace-add-project"]', textRange: !0 }, { name: "project-list", selector: '[data-testid="project-list"]' }, { name: "project", selector: ".workspace-project", key: { self: !0, attr: "data-testid", strip: "workspace-project-" } }, { name: "project-header", selector: ".workspace-project > div:first-child", key: { closest: ".workspace-project", attr: "data-testid", strip: "workspace-project-" } }, { name: "project-toggle", selector: '[data-testid^="project-toggle-"]', key: { self: !0, attr: "data-testid", strip: "project-toggle-" } }, { name: "project-chevron", selector: '[data-testid^="project-toggle-"] > svg:not([data-testid])', key: { closest: '[data-testid^="project-toggle-"]', attr: "data-testid", strip: "project-toggle-" } }, { name: "project-folder-icon", selector: '[data-testid="project-folder-icon"]', key: { closest: '[data-testid^="project-toggle-"]', attr: "data-testid", strip: "project-toggle-" } }, { name: "project-name", selector: '[data-testid^="project-toggle-"] strong', key: { closest: '[data-testid^="project-toggle-"]', attr: "data-testid", strip: "project-toggle-" } }, { name: "project-branch", selector: '[data-testid^="project-toggle-"] > span.whitespace-nowrap', key: { closest: '[data-testid^="project-toggle-"]', attr: "data-testid", strip: "project-toggle-" } }, { name: "project-dirty-mark", selector: '[data-testid^="project-toggle-"] > span[title="Uncommitted changes"]', key: { closest: '[data-testid^="project-toggle-"]', attr: "data-testid", strip: "project-toggle-" } }, { name: "project-rollup", selector: '[data-testid^="project-rollup-"]', key: { self: !0, attr: "data-testid", strip: "project-rollup-" } }, { name: "project-rollup-badge", selector: '[data-testid^="project-rollup-"] > span', key: { closest: '[data-testid^="project-rollup-"]', attr: "data-testid", strip: "project-rollup-" } }, { name: "project-menu-button", selector: '[data-testid^="workspace-project-menu-"]', key: { self: !0, attr: "data-testid", strip: "workspace-project-menu-" } }, { name: "project-add-button", selector: ".workspace-project > div:first-child .worktree-menu__btn", key: { closest: ".workspace-project", attr: "data-testid", strip: "workspace-project-" } }, { name: "project-workspaces", selector: ".workspace-project__workspaces", key: { closest: ".workspace-project", attr: "data-testid", strip: "workspace-project-" } }, { name: "workspace", selector: '[data-testid="workspace-tree-root"] [data-testid^="workspace-entry-"]', key: { self: !0, attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-button", selector: '[data-testid="workspace-tree-root"] button.workspace-entry__button', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-icon", selector: '[data-testid="workspace-tree-root"] [data-testid="workspace-checkout-icon"]', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-name", selector: '[data-testid="workspace-tree-root"] strong[title="Double-click to rename"]', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-branch", selector: '[data-testid="workspace-tree-root"] button.workspace-entry__button > span.items-baseline > span', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-dirty-mark", selector: '[data-testid="workspace-tree-root"] button.workspace-entry__button > span[title="Uncommitted changes"]', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-pinned-label", selector: '[data-testid="workspace-tree-root"] button.workspace-entry__button > span.shrink-0:not([title])', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "hidden-worktrees-button", selector: '[data-testid^="workspace-hidden-"]', key: { self: !0, attr: "data-testid", strip: "workspace-hidden-" } }, { name: "session-row", selector: 'div[class~="group/row"]', key: { find: 'button[data-testid^="workspace-session-"]:not([data-testid^="workspace-session-close-"])', attr: "data-testid", strip: "workspace-session-" } }, { name: "session-button", selector: 'button[data-testid^="workspace-session-"]:not([data-testid^="workspace-session-close-"])', key: { self: !0, attr: "data-testid", strip: "workspace-session-" } }, { name: "session-mark", selector: ".agent-mark", key: { closest: 'button[data-testid^="workspace-session-"]', attr: "data-testid", strip: "workspace-session-" } }, { name: "session-mark-icon", selector: ".agent-mark > span > *", key: { closest: 'button[data-testid^="workspace-session-"]', attr: "data-testid", strip: "workspace-session-" } }, { name: "session-title", selector: 'button[data-testid^="workspace-session-"] > span.whitespace-nowrap', key: { closest: 'button[data-testid^="workspace-session-"]', attr: "data-testid", strip: "workspace-session-" } }, { name: "status-row-title", selector: "button[data-session] span.truncate:not([data-testid])", key: { closest: 'button[data-testid^="workspace-session-"]', attr: "data-testid", strip: "workspace-session-" } }, { name: "status-row-detail", selector: '[data-testid="status-row-detail"]', key: { closest: 'button[data-testid^="workspace-session-"]', attr: "data-testid", strip: "workspace-session-" } }, { name: "session-state-badge", selector: '[data-testid^="session-state-"]', key: { self: !0, attr: "data-testid", strip: "session-state-" } }, { name: "session-menu-button", selector: '[data-testid^="session-menu-button-"]', key: { self: !0, attr: "data-testid", strip: "session-menu-button-" } }, { name: "session-fold-button", selector: '[data-testid^="session-fold-"]', key: { self: !0, attr: "data-testid", strip: "session-fold-" } }, { name: "session-elbow", selector: '[data-testid^="session-elbow-"]', key: { self: !0, attr: "data-testid", strip: "session-elbow-" } }, { name: "session-rollup", selector: '[data-testid^="session-rollup-"]', key: { self: !0, attr: "data-testid", strip: "session-rollup-" } }, { name: "chats", selector: '[data-testid="workspace-chats"]' }, { name: "chats-header", selector: '[data-testid="workspace-chats"] > div:first-child' }, { name: "chats-toggle", selector: '[data-testid="workspace-chats-collapse"]' }, { name: "chats-label", selector: '[data-testid="workspace-chats-collapse"]', textRange: !0 }, { name: "chats-chevron", selector: '[data-testid="workspace-chats-collapse"] > svg' }, { name: "chats-menu-button", selector: '[data-testid="workspace-chats-menu"]' }, { name: "chats-new-button", selector: '[data-testid="workspace-chats-new"]' }, { name: "chats-new-icon", selector: '[data-testid="workspace-chats-new"] > svg' }, { name: "status-view", selector: '[data-testid="workspace-status-view"]' }, { name: "status-section", selector: '[data-testid^="status-section-"]:not([data-testid^="status-section-title-"])', key: { self: !0, attr: "data-testid", strip: "status-section-" } }, { name: "status-heading", selector: '[data-testid^="status-section-title-"], [data-testid="status-no-sessions-title"]', key: { self: !0, attr: "data-testid" } }, { name: "status-heading-dot", selector: '[data-testid^="status-section-title-"] > span:first-child, [data-testid="status-no-sessions-title"] > span:first-child', key: { closest: '[data-testid^="status-section-title-"], [data-testid="status-no-sessions-title"]', attr: "data-testid" } }, { name: "status-heading-label", selector: '[data-testid^="status-section-title-"] > span:nth-child(2), [data-testid="status-no-sessions-title"] > span:nth-child(2)', key: { closest: '[data-testid^="status-section-title-"], [data-testid="status-no-sessions-title"]', attr: "data-testid" } }, { name: "status-heading-count", selector: '[data-testid^="status-section-title-"] > span[aria-label], [data-testid="status-no-sessions-title"] > span[aria-label]', key: { closest: '[data-testid^="status-section-title-"], [data-testid="status-no-sessions-title"]', attr: "data-testid" } }, { name: "status-heading-note", selector: '[data-testid^="status-section-title-"] > span.truncate, [data-testid="status-no-sessions-title"] > span.truncate', key: { closest: '[data-testid^="status-section-title-"], [data-testid="status-no-sessions-title"]', attr: "data-testid" } }, { name: "status-project", selector: 'div[data-testid^="status-project-"]', key: { self: !0, attr: "data-testid", strip: "status-project-" } }, { name: "status-project-header", selector: 'div[data-testid^="status-project-"] > div:first-child', key: { closest: 'div[data-testid^="status-project-"]', attr: "data-testid", strip: "status-project-" } }, { name: "status-project-icon", selector: 'div[data-testid^="status-project-"] > div:first-child > svg', key: { closest: 'div[data-testid^="status-project-"]', attr: "data-testid", strip: "status-project-" } }, { name: "status-project-title", selector: '[data-testid="status-project-title"]', key: { closest: 'div[data-testid^="status-project-"]', attr: "data-testid", strip: "status-project-" } }, { name: "status-empty-project", selector: '[data-testid^="status-empty-project-"]', key: { self: !0, attr: "data-testid", strip: "status-empty-project-" } }, { name: "status-empty-project-icon", selector: '[data-testid^="status-empty-project-"] > button:first-child > svg', key: { closest: '[data-testid^="status-empty-project-"]', attr: "data-testid", strip: "status-empty-project-" } }, { name: "status-empty-project-title", selector: '[data-testid^="status-empty-project-"] > button > span.whitespace-nowrap', key: { closest: '[data-testid^="status-empty-project-"]', attr: "data-testid", strip: "status-empty-project-" } }, { name: "settings-bar", selector: "aside.sidebar > div:last-child" }, { name: "settings-gear", selector: '[data-testid="settings-gear"]' }, { name: "settings-gear-icon", selector: '[data-testid="settings-gear"] > svg' }], tabs: [{ name: "tab-strip", selector: '[data-testid="tab-bar"]' }, { name: "tab-slot", selector: "[data-tab-entry]", key: { self: !0, attr: "data-tab-entry" } }, { name: "tab-separator", selector: '[data-testid="tab-separator"]', key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab", selector: "button.tab-bar__tab", key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-icon", selector: 'button.tab-bar__tab > span[aria-hidden="true"]', key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-icon-glyph", selector: 'button.tab-bar__tab > span[aria-hidden="true"] > *', key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-label", selector: "button.tab-bar__tab > span.truncate", key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-dirty", selector: 'button.tab-bar__tab > span[aria-label="unsaved changes"]', key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-close", selector: '[data-tab-entry] > button[aria-label^="Close"]', key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-close-glyph", selector: '[data-tab-entry] > button[aria-label^="Close"] > svg', key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-new", selector: '[data-testid="tab-new"]' }, { name: "tab-new-glyph", selector: '[data-testid="tab-new"] > svg' }], status: [{ name: "status-bar", selector: "footer.status-bar" }, { name: "status-location", selector: ".status-bar__location" }, { name: "status-dot", selector: ".status-bar__location > span:first-child" }, { name: "status-host", selector: '[data-testid="status-host"]' }, { name: "status-cwd", selector: ".status-item--cwd" }, { name: "status-branch", selector: ".status-bar__branch" }, { name: "status-branch-icon", selector: ".status-bar__branch > svg" }, { name: "status-branch-name", selector: ".status-bar__branch > span" }, { name: "status-details", selector: ".status-bar__details" }, { name: "zoom-indicator", selector: '[data-testid="zoom-indicator"]' }, { name: "status-detail", selector: ".status-bar__details > span" }, { name: "status-usage", selector: ".status-bar__usage" }, { name: "usage-summary", selector: '[data-testid="usage-summary"]' }, { name: "usage-unavailable", selector: '[data-testid="usage-summary"] > span:only-child' }, { name: "usage-account", selector: '[data-testid="usage-summary"] > span.flex' }, { name: "usage-account-name", selector: '[data-testid="usage-summary"] > span.flex > span:first-child' }, { name: "usage-window", selector: '[data-testid="usage-summary"] > span.flex > span:not(:first-child)' }, { name: "status-connection", selector: '[data-testid="status-connection"]' }, { name: "status-connection-glyph", selector: '[data-testid="status-connection"] > svg' }], navigator: [{ name: "navigator-scrim", selector: "body > div.fixed.inset-0" }, { name: "navigator-panel", selector: '[data-testid="navigator"]' }, { name: "navigator-input", selector: '[data-testid="navigator-input"]' }, { name: "navigator-chips", selector: '[data-testid="navigator"] > div:nth-child(2)' }, { name: "navigator-chip", selector: '[data-testid^="navigator-filter-"]', key: { self: !0, attr: "data-testid", strip: "navigator-filter-" } }, { name: "navigator-list", selector: '[data-testid="navigator"] > div:nth-child(3)' }, { name: "navigator-notice", selector: '[data-testid="navigator"] > div:nth-child(3) > p[role]' }, { name: "navigator-empty", selector: '[data-testid="navigator"] div.text-center' }, { name: "navigator-command", selector: '[data-testid^="navigator-command-"]', key: { self: !0, attr: "data-testid", strip: "navigator-command-" } }, { name: "navigator-command-title", selector: '[data-testid^="navigator-command-"] > span:first-child', key: { closest: '[data-testid^="navigator-command-"]', attr: "data-testid", strip: "navigator-command-" } }, { name: "navigator-command-detail", selector: '[data-testid^="navigator-command-"] > span:last-child', key: { closest: '[data-testid^="navigator-command-"]', attr: "data-testid", strip: "navigator-command-" } }, { name: "navigator-row", selector: '[data-testid^="navigator-row-"]', key: { self: !0, attr: "data-testid", strip: "navigator-row-" } }, { name: "navigator-row-dot", selector: '[data-testid^="navigator-row-"] > :first-child', key: { closest: '[data-testid^="navigator-row-"]', attr: "data-testid", strip: "navigator-row-" } }, { name: "navigator-row-title", selector: '[data-testid^="navigator-row-"] > span:nth-child(2)', key: { closest: '[data-testid^="navigator-row-"]', attr: "data-testid", strip: "navigator-row-" } }, { name: "navigator-row-detail", selector: '[data-testid^="navigator-row-"] > span:last-child', key: { closest: '[data-testid^="navigator-row-"]', attr: "data-testid", strip: "navigator-row-" } }, { name: "navigator-note", selector: '[data-testid="navigator"] > p:last-child' }], "pane-menu": [{ name: "pane-menu", selector: '[data-testid="pane-context-menu"]' }, { name: "pane-menu-item", selector: '[data-testid="pane-context-menu"] > button', key: { self: !0, attr: "data-testid", strip: "pane-menu-" } }, { name: "pane-menu-divider", selector: '[data-testid="pane-context-menu"] > div.h-px' }, { name: "pane-menu-rename-row", selector: '[data-testid="pane-context-menu"] > div.flex' }, { name: "pane-menu-rename-input", selector: '[data-testid="pane-menu-rename-input"]' }, { name: "pane-menu-rename-confirm", selector: '[data-testid="pane-menu-rename-confirm"]' }], confirm: [{ name: "confirm-scrim", selector: "body > div.fixed.inset-0" }, { name: "confirm-panel", selector: '[data-testid="confirm-dialog"]' }, { name: "confirm-message", selector: ".confirm-dialog__message" }, { name: "confirm-extra", selector: '[data-testid="confirm-dialog"] > :not(.confirm-dialog__message):not(div.flex)' }, { name: "confirm-buttons", selector: '[data-testid="confirm-dialog"] > div.flex' }, { name: "confirm-cancel", selector: '[data-testid="confirm-cancel"]' }, { name: "confirm-accept", selector: '[data-testid="confirm-accept"]' }], dialog: [{ name: "dialog-scrim", selector: "body > div.fixed.inset-0" }, { name: "dialog-panel", selector: '[data-testid="file-name-dialog"]' }, { name: "dialog-title", selector: '[data-testid="file-name-dialog"] > h2' }, { name: "dialog-input", selector: '[data-testid="file-name-input"]' }, { name: "dialog-hint", selector: '[data-testid="file-name-dialog"] > p:not([role])' }, { name: "dialog-error", selector: '[data-testid="file-name-dialog"] > p[role="alert"]' }, { name: "dialog-buttons", selector: '[data-testid="file-name-dialog"] > div.flex' }, { name: "dialog-cancel", selector: '[data-testid="file-name-dialog"] > div.flex > button:first-child' }, { name: "dialog-confirm", selector: '[data-testid="file-name-confirm"]' }], toast: [{ name: "toast-stack", selector: '[data-testid="toast"]' }, { name: "toast-card", selector: '[data-testid="toast"] .animate-toast-in' }, { name: "toast-open", selector: '[data-testid^="toast-"]:not([data-testid^="toast-dismiss-"])' }, { name: "toast-mark", selector: '[data-testid^="toast-"]:not([data-testid^="toast-dismiss-"]) > :first-child' }, { name: "toast-heading", selector: '[data-testid^="toast-"]:not([data-testid^="toast-dismiss-"]) > span.min-w-0 > span:first-child' }, { name: "toast-detail", selector: '[data-testid^="toast-"]:not([data-testid^="toast-dismiss-"]) > span.min-w-0 > span:nth-child(2)' }, { name: "toast-dismiss", selector: '[data-testid^="toast-dismiss-"]' }, { name: "toast-dismiss-glyph", selector: '[data-testid^="toast-dismiss-"] > svg' }], "pane-header": [{ name: "pane-header", selector: '[data-testid^="pane-header-"]', key: { self: !0, attr: "data-testid", strip: "pane-header-" } }, { name: "pane-header-icon", selector: '[data-testid^="pane-header-"] > span.shrink-0:not([data-testid])', key: { closest: '[data-testid^="pane-header-"]', attr: "data-testid", strip: "pane-header-" } }, { name: "pane-header-icon-glyph", selector: '[data-testid^="pane-header-"] > span.shrink-0:not([data-testid]) > *', key: { closest: '[data-testid^="pane-header-"]', attr: "data-testid", strip: "pane-header-" } }, { name: "pane-header-name", selector: '[data-testid^="pane-header-"] > span.truncate', key: { closest: '[data-testid^="pane-header-"]', attr: "data-testid", strip: "pane-header-" } }, { name: "pane-header-state", selector: '[data-testid^="pane-header-"] > span.flex[title]', key: { closest: '[data-testid^="pane-header-"]', attr: "data-testid", strip: "pane-header-" } }, { name: "pane-header-state-dot", selector: '[data-testid^="pane-header-"] > span.flex[title] > span.rounded-full', key: { closest: '[data-testid^="pane-header-"]', attr: "data-testid", strip: "pane-header-" } }, { name: "pane-header-state-word", selector: '[data-testid^="pane-header-"] > span.flex[title] > span.truncate', key: { closest: '[data-testid^="pane-header-"]', attr: "data-testid", strip: "pane-header-" } }, { name: "pane-controls", selector: '[data-testid^="tile-controls-"]', key: { self: !0, attr: "data-testid", strip: "tile-controls-" } }, { name: "pane-expand", selector: '[data-testid^="tile-expand-"]', key: { self: !0, attr: "data-testid", strip: "tile-expand-" } }, { name: "pane-expand-glyph", selector: '[data-testid^="tile-expand-"] > svg', key: { closest: '[data-testid^="tile-expand-"]', attr: "data-testid", strip: "tile-expand-" } }, { name: "pane-close", selector: '[data-testid^="tile-close-"]', key: { self: !0, attr: "data-testid", strip: "tile-close-" } }, { name: "pane-close-glyph", selector: '[data-testid^="tile-close-"] > svg', key: { closest: '[data-testid^="tile-close-"]', attr: "data-testid", strip: "tile-close-" } }, { name: "pane-corner", selector: "div.pointer-events-auto.absolute" }], "new-session": [{ name: "launcher", selector: ".new-session-popover" }, { name: "launcher-filter", selector: '[data-testid="new-tab-filter"]' }, { name: "launcher-list", selector: "#new-tab-launcher-list" }, { name: "launcher-option", selector: '[role="option"]', key: { self: !0, attr: "data-testid" } }, { name: "launcher-option-icon", selector: '[role="option"] > :first-child:not(span.flex-1):not(kbd)', key: { closest: '[role="option"]', attr: "data-testid" } }, { name: "launcher-option-label", selector: '[role="option"] > span.flex-1', key: { closest: '[role="option"]', attr: "data-testid" } }, { name: "launcher-option-key", selector: '[role="option"] > kbd', key: { closest: '[role="option"]', attr: "data-testid" } }, { name: "launcher-note", selector: ".new-session-popover p[role]" }, { name: "agent-select", selector: '[data-testid="new-session-popover-agent"]' }, { name: "agent-manage", selector: ".new-session-popover > div:first-child > button:not([data-testid])" }, { name: "project-option", selector: '[data-testid^="project-option-"]', key: { self: !0, attr: "data-testid", strip: "project-option-" } }, { name: "project-option-name", selector: '[data-testid^="project-option-"]', key: { closest: '[data-testid^="project-option-"]', attr: "data-testid", strip: "project-option-" }, textRange: !0 }, { name: "project-option-path", selector: '[data-testid^="project-option-"] > span', key: { closest: '[data-testid^="project-option-"]', attr: "data-testid", strip: "project-option-" } }], "tab-menu": [{ name: "tab-menu", selector: '[data-testid="tab-split-menu"]' }, { name: "tab-menu-item", selector: '[data-testid="tab-split-menu"] > button', key: { self: !0, attr: "data-testid" } }, { name: "tab-menu-item-label", selector: '[data-testid="tab-split-menu"] > button > span.block', key: { closest: '[data-testid="tab-split-menu"] > button', attr: "data-testid" } }, { name: "tab-menu-heading", selector: '[data-testid="tab-split-menu"] > p' }, { name: "tab-menu-empty", selector: '[data-testid="tab-split-menu"] > div:not(.h-px)' }, { name: "tab-menu-divider", selector: '[data-testid="tab-split-menu"] > div.h-px' }, { name: "tab-menu-rename-form", selector: '[data-testid="tab-split-menu"] > form' }, { name: "tab-menu-rename-input", selector: '[data-testid="tab-menu-rename-input"]' }, { name: "tab-menu-rename-save", selector: '[data-testid="tab-split-menu"] > form > button' }], select: [{ name: "select-field", selector: '[data-testid="select-demo"]' }, { name: "select-field-label", selector: '[data-testid="select-demo"] > span.truncate' }, { name: "select-chevron", selector: '[data-testid="select-demo"] > svg' }, { name: "select-list", selector: '[role="listbox"]' }, { name: "select-option", selector: '[role="listbox"] > [role="option"]', key: { self: !0, attr: "data-value" } }, { name: "select-option-label", selector: '[role="listbox"] > [role="option"] > span.truncate', key: { closest: '[role="option"]', attr: "data-value" } }, { name: "select-option-check", selector: '[role="listbox"] > [role="option"] > span[aria-hidden]', key: { closest: '[role="option"]', attr: "data-value" } }], "keybind-help": [{ name: "keybind-help-scrim", selector: "body > div.fixed.inset-0" }, { name: "keybind-help-panel", selector: '[data-testid="keybind-help"]' }, { name: "keybind-help-header", selector: '[data-testid="keybind-help"] > div:first-child' }, { name: "keybind-help-title", selector: '[data-testid="keybind-help"] h2' }, { name: "keybind-help-close", selector: '[aria-label="Close keybind help"]' }, { name: "keybind-help-close-glyph", selector: '[aria-label="Close keybind help"] > svg' }, { name: "keybind-help-search", selector: '[data-testid="keybind-help-search"]' }, { name: "keybind-help-list", selector: '[data-testid="keybind-help"] > div:last-child' }, { name: "keybind-help-empty", selector: '[data-testid="keybind-help"] div.text-center' }, { name: "keybind-help-group", selector: '[data-testid="keybind-help"] section' }, { name: "keybind-help-group-title", selector: '[data-testid="keybind-help"] section > h3' }, { name: "keybind-help-row", selector: '[data-testid="keybind-help"] li' }, { name: "keybind-help-keys", selector: '[data-testid="keybind-help"] li > kbd' }, { name: "keybind-help-description", selector: '[data-testid="keybind-help"] li > span' }], launcher: [{ name: "launcher-scrim", selector: "body > div.fixed.inset-0" }, { name: "launcher-panel", selector: '[data-testid="new-session-dialog"]' }, { name: "launcher-title", selector: '[data-testid="new-session-dialog"] > p' }, { name: "launcher-filter", selector: '[data-testid="new-session-filter"]' }, { name: "launcher-list", selector: "#new-session-list" }, { name: "launcher-row", selector: '[data-testid^="new-session-row-"]', key: { self: !0, attr: "data-testid", strip: "new-session-row-" } }, { name: "launcher-row-icon", selector: '[data-testid^="new-session-row-"] > :first-child:not(span):not(kbd)', key: { closest: '[data-testid^="new-session-row-"]', attr: "data-testid", strip: "new-session-row-" } }, { name: "launcher-row-label", selector: '[data-testid^="new-session-row-"] > span.shrink-0', key: { closest: '[data-testid^="new-session-row-"]', attr: "data-testid", strip: "new-session-row-" } }, { name: "launcher-row-detail", selector: '[data-testid^="new-session-row-"] > span.ml-auto', key: { closest: '[data-testid^="new-session-row-"]', attr: "data-testid", strip: "new-session-row-" } }, { name: "launcher-row-key", selector: '[data-testid^="new-session-row-"] > kbd', key: { closest: '[data-testid^="new-session-row-"]', attr: "data-testid", strip: "new-session-row-" } }, { name: "launcher-note", selector: "#new-session-list > p" }], "session-menu": [{ name: "tab-menu", selector: '[data-testid="tab-split-menu"]' }, { name: "tab-menu-item", selector: '[data-testid="tab-split-menu"] > button', key: { self: !0, attr: "data-testid" } }, { name: "tab-menu-item-label", selector: '[data-testid="tab-split-menu"] > button > span.block', key: { closest: '[data-testid="tab-split-menu"] > button', attr: "data-testid" } }, { name: "tab-menu-heading", selector: '[data-testid="tab-split-menu"] > p' }, { name: "tab-menu-empty", selector: '[data-testid="tab-split-menu"] > div:not(.h-px)' }, { name: "tab-menu-divider", selector: '[data-testid="tab-split-menu"] > div.h-px' }], "tab-drag": [{ name: "tab-drag-layer", selector: '[data-testid="tab-drag-layer"]' }, { name: "tab-drag-pane", selector: '[data-testid="tab-drag-layer"] > div.bg-surface-1\\/30' }, { name: "tab-drop-zone", selector: '[data-testid="tab-drop-zone"]', key: { self: !0, attr: "data-zone" } }, { name: "tab-drop-label", selector: '[data-testid="tab-drop-zone"] > span' }, { name: "tab-drag-ghost", selector: '[data-testid="tab-drag-ghost"]' }], start: [{ name: "start-panel", selector: '[data-testid="no-session-panel"], [data-testid="cli-start-panel"]' }, { name: "start-column", selector: '[data-testid$="-panel"] > div' }, { name: "start-logo", selector: '[data-testid="no-session-panel"] img' }, { name: "start-name", selector: '[data-testid$="-panel"] h1, [data-testid="no-session-panel"] h1, [data-testid="no-session-panel"] h2' }, { name: "start-hint", selector: '[data-testid$="-panel"] p' }, { name: "start-target", selector: '[data-testid="workspace-start-target"], [data-testid="cli-start-target"]' }, { name: "start-action", selector: '[data-testid="home-add-project"], [data-testid="no-session-create"], [data-testid^="workspace-start-"]:not([data-testid="workspace-start-target"]), [data-testid^="cli-start-agent-"]', key: { self: !0, attr: "data-testid" } }, { name: "start-status", selector: '[role="status"], [role="alert"]' }, { name: "start-status-action", selector: '[role="status"] > button, [role="alert"] > button' }, { name: "start-link", selector: '[data-testid$="-panel"] button.text-subtext-0' }, { name: "start-shortcut-row", selector: '[data-testid="no-session-panel"] dl > div' }, { name: "start-shortcut-label", selector: '[data-testid="no-session-panel"] dl dt' }, { name: "start-shortcut-key", selector: '[data-testid="no-session-panel"] dl kbd' }], "folder-browser": [{ name: "folder-browser", selector: '[data-testid="dir-browser"]' }, { name: "folder-browser-mode-toggle", selector: '[data-testid="dir-browser-mode-toggle"]' }, { name: "folder-browser-up", selector: '[data-testid="dir-browser-up"]' }, { name: "folder-browser-crumbs", selector: '[data-testid="dir-browser"] span.min-w-0.flex-1' }, { name: "folder-browser-crumb", selector: '[data-testid="dir-browser"] span.min-w-0.flex-1 button' }, { name: "folder-browser-filter", selector: '[data-testid="dir-browser-filter"]' }, { name: "folder-browser-list", selector: '[data-testid="dir-browser"] div.overflow-y-auto' }, { name: "folder-browser-entry", selector: '[data-testid^="dir-browser-entry-"]', key: { self: !0, attr: "data-testid", strip: "dir-browser-entry-" } }, { name: "folder-browser-entry-name", selector: '[data-testid^="dir-browser-entry-"] > span:first-child', key: { closest: '[data-testid^="dir-browser-entry-"]', attr: "data-testid", strip: "dir-browser-entry-" } }, { name: "folder-browser-git", selector: '[data-testid^="dir-browser-entry-"] > span:last-child:not(:first-child)', key: { closest: '[data-testid^="dir-browser-entry-"]', attr: "data-testid", strip: "dir-browser-entry-" } }, { name: "folder-browser-note", selector: '[data-testid="dir-browser"] div.overflow-y-auto > div' }, { name: "folder-browser-use", selector: '[data-testid="dir-browser-use"]' }, { name: "folder-browser-path-input", selector: '[data-testid="project-path-input"]' }], instructions: [{ name: "instructions-scrim", selector: "body > div.fixed.inset-0" }, { name: "instructions-panel", selector: '[data-testid="instructions-dialog"]' }, { name: "instructions-title", selector: '[data-testid="instructions-dialog"] > h2' }, { name: "instructions-intro", selector: '[data-testid="instructions-dialog"] > p' }, { name: "instructions-label", selector: '[data-testid="instructions-dialog"] > label > span:first-child' }, { name: "instructions-count", selector: '[data-testid="instructions-count"]' }, { name: "instructions-text", selector: '[data-testid="instructions-text"]' }, { name: "instructions-folders", selector: '[data-testid="instructions-folders"]' }, { name: "instructions-error", selector: '[data-testid="instructions-error"]' }, { name: "instructions-cancel", selector: '[data-testid="instructions-dialog"] > div.flex.justify-end > button:first-child' }, { name: "instructions-save", selector: '[data-testid="instructions-save"]' }], memory: [{ name: "memory-scrim", selector: "body > div.fixed.inset-0", key: { self: !0, attr: "data-testid" } }, { name: "memory-panel", selector: '[data-testid="memory-dialog"]' }, { name: "memory-title", selector: '[data-testid="memory-dialog"] > h2' }, { name: "memory-intro", selector: '[data-testid="memory-dialog"] > p' }, { name: "memory-caps", selector: '[data-testid="memory-caps"]' }, { name: "memory-new", selector: '[data-testid="memory-new"]' }, { name: "memory-enabled", selector: '[data-testid="memory-enabled"]' }, { name: "memory-enabled-label", selector: '[data-testid="memory-dialog"] > label.flex > span' }, { name: "memory-note", selector: '[data-testid="memory-dialog"] > span.text-subtext-0' }, { name: "memory-row", selector: '[data-testid^="memory-row-"]', key: { self: !0, attr: "data-testid", strip: "memory-row-" } }, { name: "memory-open", selector: '[data-testid^="memory-open-"]', key: { self: !0, attr: "data-testid", strip: "memory-open-" } }, { name: "memory-file-title", selector: '[data-testid^="memory-row-"] button > span:first-child', key: { closest: '[data-testid^="memory-row-"]', attr: "data-testid", strip: "memory-row-" } }, { name: "memory-file-summary", selector: '[data-testid^="memory-row-"] button > span.truncate', key: { closest: '[data-testid^="memory-row-"]', attr: "data-testid", strip: "memory-row-" } }, { name: "memory-file-meta", selector: '[data-testid^="memory-row-"] button > span:last-child', key: { closest: '[data-testid^="memory-row-"]', attr: "data-testid", strip: "memory-row-" } }, { name: "memory-delete", selector: '[data-testid^="memory-delete-"]', key: { self: !0, attr: "data-testid", strip: "memory-delete-" } }, { name: "memory-error", selector: '[data-testid="memory-error"]' }, { name: "memory-close", selector: '[data-testid="memory-dialog"] > div.flex.justify-end > button' }, { name: "memory-file-name", selector: '[data-testid="memory-file-name"]' }, { name: "memory-name", selector: '[data-testid="memory-name"]' }, { name: "memory-count", selector: '[data-testid="memory-count"]' }, { name: "memory-text", selector: '[data-testid="memory-text"]' }, { name: "memory-conflict", selector: '[data-testid="memory-conflict"]' }, { name: "memory-reload", selector: '[data-testid="memory-reload"]' }, { name: "memory-back", selector: '[data-testid="memory-back"]' }, { name: "memory-save", selector: '[data-testid="memory-save"]' }, { name: "memory-confirm", selector: '[data-testid="confirm-dialog"]' }, { name: "memory-confirm-message", selector: ".confirm-dialog__message" }], worktree: [{ name: "worktree-plus", selector: '[data-testid^="worktree-menu-"]' }, { name: "worktree-popover", selector: '[role="dialog"][aria-label="Git worktrees"]' }, { name: "worktree-heading", selector: '[role="dialog"][aria-label="Git worktrees"] > div:first-child > span:first-child' }, { name: "worktree-project", selector: '[role="dialog"][aria-label="Git worktrees"] > div:first-child > span:last-child' }, { name: "worktree-list", selector: '[role="dialog"][aria-label="Git worktrees"] > div.overflow-y-auto' }, { name: "worktree-note", selector: '[role="dialog"][aria-label="Git worktrees"] > div.overflow-y-auto > div:not(.worktree-menu__entry)' }, { name: "worktree-entry", selector: '[data-testid^="worktree-entry-"]', key: { self: !0, attr: "data-testid", strip: "worktree-entry-" } }, { name: "worktree-entry-branch", selector: ".worktree-menu__entry-branch", key: { closest: '[data-testid^="worktree-entry-"]', attr: "data-testid", strip: "worktree-entry-" } }, { name: "worktree-badge", selector: '[data-testid^="worktree-entry-"] .worktree-menu__entry-branch > span', key: { closest: '[data-testid^="worktree-entry-"]', attr: "data-testid", strip: "worktree-entry-" } }, { name: "worktree-entry-path", selector: ".worktree-menu__entry-path", key: { closest: '[data-testid^="worktree-entry-"]', attr: "data-testid", strip: "worktree-entry-" } }, { name: "worktree-open", selector: '[data-testid^="worktree-open-"]', key: { self: !0, attr: "data-testid", strip: "worktree-open-" } }, { name: "worktree-remove", selector: '[data-testid^="worktree-remove-"]', key: { self: !0, attr: "data-testid", strip: "worktree-remove-" } }, { name: "worktree-error", selector: '[data-testid="worktree-error"]' }, { name: "worktree-new", selector: '[data-testid="worktree-new"]' }, { name: "worktree-name-input", selector: '[data-testid="worktree-name-input"]' }, { name: "worktree-start-input", selector: '[data-testid="worktree-start-input"]' }, { name: "worktree-branch-input", selector: '[data-testid="worktree-branch-input"]' }, { name: "worktree-parent-select", selector: '[data-testid="worktree-parent-select"]' }, { name: "worktree-new-branch", selector: '[data-testid="worktree-new-branch"]' }, { name: "worktree-path-input", selector: '[data-testid="worktree-path-input"]' }, { name: "worktree-agent-select", selector: '[data-testid="worktree-agent-select"]' }, { name: "worktree-create-cancel", selector: '[data-testid="worktree-create-cancel"]' }, { name: "worktree-create-submit", selector: '[data-testid="worktree-create-submit"]' }, { name: "worktree-confirm", selector: '[data-testid="confirm-dialog"]' }, { name: "worktree-confirm-message", selector: ".confirm-dialog__message" }, { name: "worktree-confirm-accept", selector: '[data-testid="confirm-accept"]' }, { name: "worktree-confirm-cancel", selector: '[data-testid="confirm-cancel"]' }], "terminal-search": [{ name: "terminal-frame", selector: '[data-testid="persistent-agent-terminal"]' }, { name: "term-search", selector: '[data-testid="term-search"]' }, { name: "term-search-input", selector: '[data-testid="term-search-input"]' }, { name: "term-search-button", selector: '[data-testid="term-search"] > button', key: { self: !0, attr: "title" } }], "agent-control": [{ name: "terminal-frame", selector: '[data-testid="persistent-agent-terminal"]' }, { name: "agent-control-chip", selector: '[data-testid="agent-control-chip"]' }, { name: "agent-control-label", selector: '[data-testid="agent-control-chip"] > span' }, { name: "agent-control-button", selector: '[data-testid="agent-control-chip"] > button' }, { name: "agent-control-error", selector: ".terminal__cli-error" }, { name: "agent-control-ended", selector: ".terminal__exited", key: { self: !0, attr: "data-testid" } }, { name: "agent-control-ended-text", selector: ".terminal__exited-text" }, { name: "agent-control-ended-button", selector: ".terminal__exited-actions > button", key: { self: !0, attr: "data-testid" } }], "phone-size": [{ name: "terminal-frame", selector: '[data-testid="persistent-agent-terminal"]' }, { name: "phone-size-notice", selector: '[data-testid="phone-size-notice"]' }, { name: "phone-size-chip", selector: '[data-testid="phone-size-chip"]' }, { name: "phone-size-heading", selector: '[data-testid="phone-size-notice"] span.font-semibold' }, { name: "phone-size-text", selector: '[data-testid="phone-size-notice"] span:not(.font-semibold)' }, { name: "phone-size-fold", selector: '[aria-label="Keep phone size and hide this"]' }, { name: "phone-size-button", selector: '[data-testid="phone-size-notice"] div.flex.flex-wrap > button, [data-testid="phone-size-chip"] > button' }], window: [{ name: "sidebar-card", selector: '[data-testid="sidebar-card"]' }, { name: "main-card", selector: '[data-testid="main-card"]' }, { name: "tools-card", selector: '[data-testid="tools-card"]' }, { name: "sidebar-toggle", selector: '[data-testid="sidebar-collapse-toggle"]' }, { name: "drawer-toggle", selector: '[data-testid="workspace-tools-toggle"]' }, { name: "resize-sidebar", selector: '[data-testid="resize-sidebar"]' }, { name: "resize-tools", selector: '[data-testid="resize-tools"]' }, { name: "tools-tab", selector: 'nav[aria-label="Files, Git and Browser"] > button' }, { name: "status-bar", selector: "footer.status-bar" }], settings: [{ name: "settings-modal", selector: '[data-testid="settings-modal"]' }, { name: "settings-nav-card", selector: '[data-testid="settings-modal"] > nav' }, { name: "settings-close", selector: '[data-testid="settings-close"]' }, { name: "settings-nav", selector: 'nav [data-testid^="settings-nav-"]', key: { self: !0, attr: "data-testid", strip: "settings-nav-" } }, { name: "settings-main-card", selector: '[data-testid="settings-modal"] > main' }, { name: "settings-search", selector: '[data-testid="settings-search"]' }, { name: "settings-title", selector: '[data-testid="settings-modal"] > main h1' }, { name: "settings-body", selector: '[data-testid="settings-modal"] .settings-modal__body' }, { name: "settings-group-title", selector: '[data-testid="settings-modal"] > main h3' }, { name: "settings-group-card", selector: '[data-testid="settings-modal"] > main section > div.rounded-ui' }, { name: "settings-row", selector: '[data-testid="settings-modal"] [data-setting-row]' }, { name: "settings-row-title", selector: '[data-testid="settings-modal"] [data-setting-row] > div:first-child > div:first-child' }, { name: "settings-row-description", selector: '[data-testid="settings-modal"] [data-setting-row] > div:first-child > div:nth-child(2)' }, { name: "settings-result-title", selector: '[data-testid^="settings-result-"] > h2' }] };
export {
  Hy as NAMED_ELEMENTS,
  v0 as React,
  I0 as SCHEMA,
  Dy as STYLE_KEYS,
  By as describeToGpui,
  Ay as jsxRuntime,
  jy as mount,
  Oy as reactDom,
  Ry as sdk
};
