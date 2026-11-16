function hs(n, l) {
  for (var s = 0; s < l.length; s++) {
    const i = l[s];
    if (typeof i != "string" && !Array.isArray(i)) {
      for (const o in i)
        if (o !== "default" && !(o in n)) {
          const d = Object.getOwnPropertyDescriptor(i, o);
          d && Object.defineProperty(n, o, d.get ? d : {
            enumerable: !0,
            get: () => i[o]
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
class le extends Error {
}
const Xh = /* @__PURE__ */ new Set(["hover", "focus", "focus-visible", "focus-within", "active", "disabled", "enabled", "checked"]), Lh = /* @__PURE__ */ new Set(["not", "is", "where", "has", "nth-child"]), Zh = /* @__PURE__ */ new Set(["first-child", "last-child", "only-child", "root", ...Xh]);
function Io(n) {
  return n.replace(/\\(?:([0-9a-fA-F]{1,6})\s?|([\s\S]))/g, (l, s, i) => s ? String.fromCodePoint(parseInt(s, 16)) : i);
}
function bl(n, l) {
  let s = l;
  for (; s < n.length; ) {
    const i = n[s];
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
  if (s === l) throw new le(`expected a name at ${l} in ${JSON.stringify(n)}`);
  return [Io(n.slice(l, s)), s];
}
function Jh(n, l) {
  let s = 1;
  for (let i = l; i < n.length; i++) {
    const o = n[i];
    if (o === "\\") {
      i++;
      continue;
    }
    if (o === '"' || o === "'") {
      if (i = n.indexOf(o, i + 1), i < 0) break;
      continue;
    }
    if (o === "(") s++;
    else if (o === ")" && --s === 0) return i;
  }
  throw new le(`unbalanced parenthesis in ${JSON.stringify(n)}`);
}
function gs(n) {
  const l = [];
  let s = 0, i = 0;
  for (let o = 0; o < n.length; o++) {
    const d = n[o];
    if (d === "\\") {
      o++;
      continue;
    }
    if (d === '"' || d === "'") {
      if (o = n.indexOf(d, o + 1), o < 0) break;
      continue;
    }
    d === "(" || d === "[" ? s++ : d === ")" || d === "]" ? s-- : d === "," && s === 0 && (l.push(n.slice(i, o).trim()), i = o + 1);
  }
  return l.push(n.slice(i).trim()), l.filter(Boolean);
}
function Wh(n, l) {
  const s = { tag: null, id: null, classes: [], attrs: [], pseudos: [], pseudoElement: null };
  let i = !1;
  for (; l < n.length; ) {
    const o = n[l];
    if (o === "*") {
      s.tag = "*", l++, i = !0;
      continue;
    }
    if (o === ".") {
      const [d, m] = bl(n, l + 1);
      s.classes.push(d), l = m, i = !0;
      continue;
    }
    if (o === "#") {
      const [d, m] = bl(n, l + 1);
      s.id = d, l = m, i = !0;
      continue;
    }
    if (o === "[") {
      const d = n.indexOf("]", l);
      if (d < 0) throw new le(`unclosed [ in ${JSON.stringify(n)}`);
      const m = n.slice(l + 1, d).trim(), f = /^([^\s~^$*|=]+)\s*(?:([~^$*|]?=)\s*(?:"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'|([^\s"'\]]+)))?\s*(i)?$/.exec(m);
      if (!f) throw new le(`cannot read the attribute selector [${m}]`);
      const p = f[3] ?? f[4] ?? f[5];
      s.attrs.push({ name: Io(f[1]).toLowerCase(), op: f[2] ?? null, value: p === void 0 ? null : Io(p) }), l = d + 1, i = !0;
      continue;
    }
    if (o === ":") {
      if (n[l + 1] === ":") {
        const [p, v] = bl(n, l + 2), k = p.toLowerCase();
        if (k !== "before" && k !== "after") throw new le(`::${k} is not supported`);
        if (s.pseudoElement = k, l = v, i = !0, l < n.length && !/[\s>]/.test(n[l])) throw new le(`nothing may follow ::${k} in ${JSON.stringify(n)}`);
        break;
      }
      const [d, m] = bl(n, l + 1);
      l = m;
      const f = d.toLowerCase();
      if ((f === "before" || f === "after") && n[l] !== "(") {
        if (s.pseudoElement = f, i = !0, l < n.length && !/[\s>]/.test(n[l])) throw new le(`nothing may follow :${f} in ${JSON.stringify(n)}`);
        break;
      }
      if (n[l] === "(") {
        if (!Lh.has(f)) throw new le(`:${f}() is not supported`);
        const p = Jh(n, l + 1), v = n.slice(l + 1, p).trim();
        if (l = p + 1, f === "nth-child") {
          if (!/^\d+$/.test(v)) throw new le(`:nth-child(${v}) is not supported (only a number)`);
          s.pseudos.push({ name: f, n: Number(v) });
        } else {
          const k = gs(v).map(bs);
          if (f === "has" && k.some((E) => E.length !== 1)) throw new le(`:has(${v}) is not supported (only a compound selector)`);
          s.pseudos.push({ name: f, list: k });
        }
      } else {
        if (!Zh.has(f)) throw new le(`:${f} is not supported`);
        s.pseudos.push({ name: f });
      }
      i = !0;
      continue;
    }
    if (/[A-Za-z_\-\\]/.test(o) && !i) {
      const [d, m] = bl(n, l);
      s.tag = d.toLowerCase(), l = m, i = !0;
      continue;
    }
    break;
  }
  if (!i) throw new le(`empty compound selector at ${l} in ${JSON.stringify(n)}`);
  return [s, l];
}
function bs(n) {
  const l = [];
  let s = 0, i = null;
  for (n = n.trim(); s < n.length; ) {
    const [o, d] = Wh(n, s);
    if (l.at(-1)?.compound.pseudoElement) throw new le(`::${l.at(-1).compound.pseudoElement} must end ${JSON.stringify(n)}`);
    l.push({ compound: o, combinator: i }), s = d;
    let m = !1;
    for (; n[s] === " " || n[s] === `
` || n[s] === "	"; )
      s++, m = !0;
    if (s >= n.length) break;
    const f = n[s];
    if (f === ">")
      for (i = ">", s++; n[s] === " "; ) s++;
    else {
      if (f === "+" || f === "~") throw new le(`the ${f} combinator is not supported`);
      if (m) i = " ";
      else throw new le(`unexpected ${JSON.stringify(f)} in ${JSON.stringify(n)}`);
    }
  }
  if (!l.length) throw new le("empty selector");
  return l;
}
const Ed = /* @__PURE__ */ new Map();
function Ir(n) {
  let l = Ed.get(n);
  return l || (l = gs(n).map(bs), Ed.set(n, l)), l;
}
function vf(n) {
  const l = [0, 0, 0], s = (i) => {
    l[0] += i[0], l[1] += i[1], l[2] += i[2];
  };
  for (const { compound: i } of n) {
    i.id && l[0]++, l[1] += i.classes.length + i.attrs.length, i.tag && i.tag !== "*" && l[2]++, i.pseudoElement && l[2]++;
    for (const o of i.pseudos)
      if (o.name !== "where")
        if (o.list) {
          const d = o.list.map(vf).sort((m, f) => f[0] - m[0] || f[1] - m[1] || f[2] - m[2])[0];
          s(d);
        } else l[1]++;
  }
  return l;
}
function Fh(n, { name: l, op: s, value: i }) {
  const o = n.getAttribute(l);
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
function Nr(n) {
  return n.parentElement ? n.parentElement.children : [n];
}
function yf(n, l) {
  for (const s of n.children) if (l(s) || yf(s, l)) return !0;
  return !1;
}
function xf(n, l, s, i) {
  if ((l.pseudoElement ?? null) !== (i ? s.pseudo ?? null : null) || l.tag && l.tag !== "*" && n.tagName !== l.tag || l.id && n.getAttribute("id") !== l.id) return !1;
  if (l.classes.length) {
    const o = n.classList ?? [];
    for (const d of l.classes) if (!o.includes(d)) return !1;
  }
  for (const o of l.attrs) if (!Fh(n, o)) return !1;
  for (const o of l.pseudos)
    switch (o.name) {
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
        if (Nr(n).indexOf(n) !== o.n - 1) return !1;
        break;
      case "root":
        if (!n.isDocumentRoot) return !1;
        break;
      case "not":
        if (o.list.some((d) => qa(n, d, s, i))) return !1;
        break;
      case "has":
        if (n.watchesDescendants = !0, !o.list.some(([{ compound: d }]) => yf(n, (m) => xf(m, d, s, !1)))) return !1;
        break;
      case "is":
      case "where":
        if (!o.list.some((d) => qa(n, d, s, i))) return !1;
        break;
      default:
        if (!s.state || !s.state(n, o.name, i)) return !1;
    }
  return !0;
}
function qa(n, l, s, i = !0) {
  const o = (d, m, f) => {
    const { compound: p, combinator: v } = l[m];
    if (!xf(d, p, s, f)) return !1;
    if (m === 0) return !0;
    if (v === ">") return !!d.parentElement && o(d.parentElement, m - 1, !1);
    for (let k = d.parentElement; k; k = k.parentElement) if (o(k, m - 1, !1)) return !0;
    return !1;
  };
  return o(n, l.length - 1, i);
}
function Ih(n, l, s = {}) {
  return (typeof l == "string" ? Ir(l) : l).some((o) => qa(n, o, s));
}
function wf(n, l, s = {}) {
  return qa(n, l, s);
}
function kl(n, l, s = {}) {
  const i = Ir(l), o = [], d = (m) => {
    for (const f of m.children)
      i.some((p) => qa(f, p, s)) && o.push(f), d(f);
  };
  return d(n), o;
}
function _f(n, l, s = {}) {
  const i = Ir(l);
  for (let o = n; o; o = o.parentElement) if (i.some((d) => qa(o, d, s))) return o;
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
let $h = 1;
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
class vs {
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
class $t extends vs {
  constructor(l, s = {}, i = null) {
    super(), this.nodeType = 1, this.id = `n${$h++}`, this.tagName = l.toLowerCase(), this.props = s, this.childNodes = [], this.parentNode = null, this.ownerDocument = i, this.hidden = !1, this.state = { hover: !1, focus: !1, active: !1 }, this.bounds = null, this.version = 0;
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
    return Ih(this, l);
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
          return f === "setProperty" ? (p, v) => d(s(p), v) : f === "removeProperty" ? (p) => {
            const v = o(s(p));
            return d(s(p), ""), v;
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
    return zd(this);
  }
  /** `outerHTML` without the attributes named in `omit` (by their DOM names), as the web's drag strips its copy. */
  copyMarkup(l = []) {
    return zd(this, l);
  }
}
const Sf = Symbol("perch.stale-layout"), kf = 3;
let Br = !1;
function Ef(n) {
  return () => {
    let l, s = !1;
    const i = (o) => {
      const d = Br;
      Br = o < kf;
      try {
        l = n();
      } catch (m) {
        const f = m?.[Sf];
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
const Po = "perch-dom:", Ph = /* @__PURE__ */ new Set(["children", "key", "ref", "dangerouslySetInnerHTML"]), t0 = { class: "className", for: "htmlFor", tabindex: "tabIndex" };
function zd(n, l = []) {
  const s = new Set(l.map((o) => t0[o] ?? o)), i = (o) => {
    if (!(o instanceof $t)) return { x: o.data, ...o.hidden ? { h: 1 } : {} };
    const d = {};
    for (const [m, f] of Object.entries(o.props))
      Ph.has(m) || s.has(m) || f == null || typeof f == "function" || typeof f == "symbol" || (d[m] = f);
    return { t: o.tagName, p: d, c: o.childNodes.map(i), ...o.hidden ? { h: 1 } : {} };
  };
  return Po + JSON.stringify(i(n));
}
function e0(n, l) {
  if (typeof n != "string" || !n.startsWith(Po)) return null;
  let s;
  try {
    s = JSON.parse(n.slice(Po.length));
  } catch {
    return null;
  }
  const i = (d) => !!d && typeof d == "object" && !Array.isArray(d), o = (d) => {
    if (!i(d)) throw new Error("not a node");
    let m;
    if (typeof d.x == "string") m = new $r(d.x);
    else {
      if (typeof d.t != "string" || !/^[a-z][a-z0-9-]*$/i.test(d.t) || !i(d.p) || !Array.isArray(d.c)) throw new Error("not an element");
      m = new $t(d.t, d.p, l);
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
class n0 {
  observe() {
  }
  unobserve() {
  }
  disconnect() {
  }
}
class a0 {
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
function Nd(n) {
  for (let l = n; l instanceof $t; l = l.parentElement) l.touch();
}
class l0 extends vs {
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
    const s = this.perch?.bounds;
    if (typeof s != "function" || !this.measureKey) return null;
    l.measured || (l.measured = !0, l.touch(), this.restyled());
    const i = s(this.measureKey(l));
    if (Br && (!i || this.stale?.())) throw { [Sf]: this };
    return i ?? null;
  }
  /** An element's `style` was written: the tree is described again once the writing script is done. */
  restyled() {
    this.restyling || (this.restyling = !0, queueMicrotask(() => {
      this.restyling = !1, this.afterCommit?.();
    }));
  }
  focus(l) {
    this.activeElement && this.activeElement !== l && this.blur(this.activeElement), this.activeElement = l, l.state.focus = !0, l.state.pointerFocus = !1, Nd(l), this.perch?.focused?.(l);
  }
  blur(l) {
    l.state.focus = !1, Nd(l), this.activeElement === l && (this.activeElement = this.body);
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
class r0 extends vs {
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
function zf(n) {
  return {
    setTimeout: (l, s = 0, ...i) => n.setTimeout(() => l(...i), Math.max(0, Number(s) || 0)),
    clearTimeout: (l) => {
      l != null && n.clearTimeout(l);
    }
  };
}
const Td = Symbol.for("perch.react.globals");
function Je(n, l, s) {
  Object.defineProperty(n, l, { value: s, configurable: !0, writable: !0, enumerable: !1 });
}
function i0(n, l = globalThis) {
  const s = new l0(n), i = new r0(n, s);
  s.defaultView = i;
  const o = n.storage ?? new a0();
  if (typeof l.setTimeout != "function") {
    if (typeof n.setTimeout != "function") throw new Error("the engine has no setTimeout and the perch host gives none (perch.setTimeout)");
    const f = zf(n);
    Je(l, "setTimeout", f.setTimeout), Je(l, "clearTimeout", f.clearTimeout);
  }
  typeof l.queueMicrotask != "function" && Je(l, "queueMicrotask", (f) => {
    Promise.resolve().then(f);
  }), Je(l, "requestAnimationFrame", (f) => l.setTimeout(() => f(Date.now()), 0)), Je(l, "cancelAnimationFrame", (f) => l.clearTimeout(f));
  const d = { document: s, window: i, localStorage: o, HTMLElement: $t, Element: $t };
  for (const f of Object.keys(d))
    Object.defineProperty(l, f, { get: () => l[Td]?.[f], configurable: !0, enumerable: !1 });
  l[Td] = d, Je(l, "DOMRect", $o), Je(l, "getComputedStyle", o0), typeof l.ResizeObserver != "function" && Je(l, "ResizeObserver", n0);
  const m = l.navigator && typeof l.navigator == "object" ? l.navigator : {};
  if (!m.clipboard && n.clipboard)
    try {
      Je(m, "clipboard", n.clipboard);
    } catch {
    }
  return l.navigator || Je(l, "navigator", m), { document: s, window: i, globals: d };
}
function o0(n) {
  const l = n?.ownerDocument?.computed?.(n) ?? {}, s = (i) => {
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
function ts(n, l = !1) {
  if (!(l ? n?.tagName === "input" && Nf(n) : n?.tagName === "button" && !/^(button|reset)$/.test(String(n.props.type ?? "submit")) && !n.props.disabled)) return null;
  for (let i = n.parentElement; i; i = i.parentElement) if (i.tagName === "form") return i;
  return null;
}
const Nf = (n) => n?.tagName === "textarea" || n?.tagName === "input" && /^(text|search|url|email|tel|password|number|)$/.test(String(n.props.type ?? ""));
//! Evaluated before anything else in the runtime bundle: React's scheduler reads `setTimeout` and `queueMicrotask`
//! once, when it loads, so an engine without them (QuickJS) gets the host's (`perch.setTimeout`) first.
const Cd = globalThis.perch;
if (typeof globalThis.setTimeout != "function" && typeof Cd?.setTimeout == "function") {
  const n = zf(Cd);
  globalThis.setTimeout = n.setTimeout, globalThis.clearTimeout = n.clearTimeout;
}
typeof globalThis.queueMicrotask != "function" && (globalThis.queueMicrotask = (n) => {
  Promise.resolve().then(n);
});
function ys(n) {
  return n && n.__esModule && Object.prototype.hasOwnProperty.call(n, "default") ? n.default : n;
}
function s0(n) {
  if (Object.prototype.hasOwnProperty.call(n, "__esModule")) return n;
  var l = n.default;
  if (typeof l == "function") {
    var s = function i() {
      return this instanceof i ? Reflect.construct(l, arguments, this.constructor) : l.apply(this, arguments);
    };
    s.prototype = l.prototype;
  } else s = {};
  return Object.defineProperty(s, "__esModule", { value: !0 }), Object.keys(n).forEach(function(i) {
    var o = Object.getOwnPropertyDescriptor(n, i);
    Object.defineProperty(s, i, o.get ? o : {
      enumerable: !0,
      get: function() {
        return n[i];
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
var Md;
function c0() {
  if (Md) return pt;
  Md = 1;
  var n = Symbol.for("react.transitional.element"), l = Symbol.for("react.portal"), s = Symbol.for("react.fragment"), i = Symbol.for("react.strict_mode"), o = Symbol.for("react.profiler"), d = Symbol.for("react.consumer"), m = Symbol.for("react.context"), f = Symbol.for("react.forward_ref"), p = Symbol.for("react.suspense"), v = Symbol.for("react.memo"), k = Symbol.for("react.lazy"), E = Symbol.for("react.activity"), x = Symbol.iterator;
  function z(T) {
    return T === null || typeof T != "object" ? null : (T = x && T[x] || T["@@iterator"], typeof T == "function" ? T : null);
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
  }, w = Object.assign, _ = {};
  function N(T, X, et) {
    this.props = T, this.context = X, this.refs = _, this.updater = et || S;
  }
  N.prototype.isReactComponent = {}, N.prototype.setState = function(T, X) {
    if (typeof T != "object" && typeof T != "function" && T != null)
      throw Error(
        "takes an object of state variables to update or a function which returns an object of state variables."
      );
    this.updater.enqueueSetState(this, T, X, "setState");
  }, N.prototype.forceUpdate = function(T) {
    this.updater.enqueueForceUpdate(this, T, "forceUpdate");
  };
  function B() {
  }
  B.prototype = N.prototype;
  function j(T, X, et) {
    this.props = T, this.context = X, this.refs = _, this.updater = et || S;
  }
  var Z = j.prototype = new B();
  Z.constructor = j, w(Z, N.prototype), Z.isPureReactComponent = !0;
  var q = Array.isArray;
  function D() {
  }
  var h = { H: null, A: null, T: null, S: null }, b = Object.prototype.hasOwnProperty;
  function y(T, X, et) {
    var it = et.ref;
    return {
      $$typeof: n,
      type: T,
      key: X,
      ref: it !== void 0 ? it : null,
      props: et
    };
  }
  function A(T, X) {
    return y(T.type, X, T.props);
  }
  function O(T) {
    return typeof T == "object" && T !== null && T.$$typeof === n;
  }
  function M(T) {
    var X = { "=": "=0", ":": "=2" };
    return "$" + T.replace(/[=:]/g, function(et) {
      return X[et];
    });
  }
  var U = /\/+/g;
  function L(T, X) {
    return typeof T == "object" && T !== null && T.key != null ? M("" + T.key) : X.toString(36);
  }
  function F(T) {
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
    var ut = typeof T;
    (ut === "undefined" || ut === "boolean") && (T = null);
    var kt = !1;
    if (T === null) kt = !0;
    else
      switch (ut) {
        case "bigint":
        case "string":
        case "number":
          kt = !0;
          break;
        case "object":
          switch (T.$$typeof) {
            case n:
            case l:
              kt = !0;
              break;
            case k:
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
      return ot = ot(T), kt = it === "" ? "." + L(T, 0) : it, q(ot) ? (et = "", kt != null && (et = kt.replace(U, "$&/") + "/"), Q(ot, X, et, "", function(Gn) {
        return Gn;
      })) : ot != null && (O(ot) && (ot = A(
        ot,
        et + (ot.key == null || T && T.key === ot.key ? "" : ("" + ot.key).replace(
          U,
          "$&/"
        ) + "/") + kt
      )), X.push(ot)), 1;
    kt = 0;
    var Zt = it === "" ? "." : it + ":";
    if (q(T))
      for (var ht = 0; ht < T.length; ht++)
        it = T[ht], ut = Zt + L(it, ht), kt += Q(
          it,
          X,
          et,
          ut,
          ot
        );
    else if (ht = z(T), typeof ht == "function")
      for (T = ht.call(T), ht = 0; !(it = T.next()).done; )
        it = it.value, ut = Zt + L(it, ht++), kt += Q(
          it,
          X,
          et,
          ut,
          ot
        );
    else if (ut === "object") {
      if (typeof T.then == "function")
        return Q(
          F(T),
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
  function J(T, X, et) {
    if (T == null) return T;
    var it = [], ot = 0;
    return Q(T, it, "", "", function(ut) {
      return X.call(et, ut, ot++);
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
  var K = typeof reportError == "function" ? reportError : function(T) {
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
  }, V = {
    map: J,
    forEach: function(T, X, et) {
      J(
        T,
        function() {
          X.apply(this, arguments);
        },
        et
      );
    },
    count: function(T) {
      var X = 0;
      return J(T, function() {
        X++;
      }), X;
    },
    toArray: function(T) {
      return J(T, function(X) {
        return X;
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
  return pt.Activity = E, pt.Children = V, pt.Component = N, pt.Fragment = s, pt.Profiler = o, pt.PureComponent = j, pt.StrictMode = i, pt.Suspense = p, pt.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE = h, pt.__COMPILER_RUNTIME = {
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
  }, pt.cloneElement = function(T, X, et) {
    if (T == null)
      throw Error(
        "The argument must be a React element, but you passed " + T + "."
      );
    var it = w({}, T.props), ot = T.key;
    if (X != null)
      for (ut in X.key !== void 0 && (ot = "" + X.key), X)
        !b.call(X, ut) || ut === "key" || ut === "__self" || ut === "__source" || ut === "ref" && X.ref === void 0 || (it[ut] = X[ut]);
    var ut = arguments.length - 2;
    if (ut === 1) it.children = et;
    else if (1 < ut) {
      for (var kt = Array(ut), Zt = 0; Zt < ut; Zt++)
        kt[Zt] = arguments[Zt + 2];
      it.children = kt;
    }
    return y(T.type, ot, it);
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
    var it, ot = {}, ut = null;
    if (X != null)
      for (it in X.key !== void 0 && (ut = "" + X.key), X)
        b.call(X, it) && it !== "key" && it !== "__self" && it !== "__source" && (ot[it] = X[it]);
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
    return y(T, ut, ot);
  }, pt.createRef = function() {
    return { current: null };
  }, pt.forwardRef = function(T) {
    return { $$typeof: f, render: T };
  }, pt.isValidElement = O, pt.lazy = function(T) {
    return {
      $$typeof: k,
      _payload: { _status: -1, _result: T },
      _init: I
    };
  }, pt.memo = function(T, X) {
    return {
      $$typeof: v,
      type: T,
      compare: X === void 0 ? null : X
    };
  }, pt.startTransition = function(T) {
    var X = h.T, et = {};
    h.T = et;
    try {
      var it = T(), ot = h.S;
      ot !== null && ot(et, it), typeof it == "object" && it !== null && typeof it.then == "function" && it.then(D, K);
    } catch (ut) {
      K(ut);
    } finally {
      X !== null && et.types !== null && (X.types = et.types), h.T = X;
    }
  }, pt.unstable_useCacheRefresh = function() {
    return h.H.useCacheRefresh();
  }, pt.use = function(T) {
    return h.H.use(T);
  }, pt.useActionState = function(T, X, et) {
    return h.H.useActionState(T, X, et);
  }, pt.useCallback = function(T, X) {
    return h.H.useCallback(T, X);
  }, pt.useContext = function(T) {
    return h.H.useContext(T);
  }, pt.useDebugValue = function() {
  }, pt.useDeferredValue = function(T, X) {
    return h.H.useDeferredValue(T, X);
  }, pt.useEffect = function(T, X) {
    return h.H.useEffect(T, X);
  }, pt.useEffectEvent = function(T) {
    return h.H.useEffectEvent(T);
  }, pt.useId = function() {
    return h.H.useId();
  }, pt.useImperativeHandle = function(T, X, et) {
    return h.H.useImperativeHandle(T, X, et);
  }, pt.useInsertionEffect = function(T, X) {
    return h.H.useInsertionEffect(T, X);
  }, pt.useLayoutEffect = function(T, X) {
    return h.H.useLayoutEffect(T, X);
  }, pt.useMemo = function(T, X) {
    return h.H.useMemo(T, X);
  }, pt.useOptimistic = function(T, X) {
    return h.H.useOptimistic(T, X);
  }, pt.useReducer = function(T, X, et) {
    return h.H.useReducer(T, X, et);
  }, pt.useRef = function(T) {
    return h.H.useRef(T);
  }, pt.useState = function(T) {
    return h.H.useState(T);
  }, pt.useSyncExternalStore = function(T, X, et) {
    return h.H.useSyncExternalStore(
      T,
      X,
      et
    );
  }, pt.useTransition = function() {
    return h.H.useTransition();
  }, pt.version = "19.2.8", pt;
}
var Ad;
function u0() {
  return Ad || (Ad = 1, Yo.exports = c0()), Yo.exports;
}
var ct = u0();
const Tf = /* @__PURE__ */ ys(ct), d0 = /* @__PURE__ */ hs({
  __proto__: null,
  default: Tf
}, [ct]);
//! "react" as the runtime bundles it, for its own code, the stock screens and every screen's `react` import: React
//! itself, with `useEffect` and `useLayoutEffect` run through `measured` (`dom.mjs`), so an effect that measures a
//! box the engine has not laid out yet runs again once it has (layout readback).
const f0 = Tf ?? d0;
function Ke(n, l) {
  return ct.useEffect(Ef(n), l);
}
function es(n, l) {
  return ct.useLayoutEffect(Ef(n), l);
}
const m0 = /* @__PURE__ */ hs({
  __proto__: null,
  default: f0,
  useEffect: Ke,
  useLayoutEffect: es
}, [ct]);
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
var jd;
function p0() {
  if (jd) return vl;
  jd = 1;
  var n = Symbol.for("react.transitional.element"), l = Symbol.for("react.fragment");
  function s(i, o, d) {
    var m = null;
    if (d !== void 0 && (m = "" + d), o.key !== void 0 && (m = "" + o.key), "key" in o) {
      d = {};
      for (var f in o)
        f !== "key" && (d[f] = o[f]);
    } else d = o;
    return o = d.ref, {
      $$typeof: n,
      type: i,
      key: m,
      ref: o !== void 0 ? o : null,
      props: d
    };
  }
  return vl.Fragment = l, vl.jsx = s, vl.jsxs = s, vl;
}
var Od;
function h0() {
  return Od || (Od = 1, Go.exports = p0()), Go.exports;
}
var st = h0();
const g0 = /* @__PURE__ */ ys(st), cy = /* @__PURE__ */ hs({
  __proto__: null,
  default: g0
}, [st]);
var Ko = { exports: {} }, Qo = { exports: {} };
const b0 = /* @__PURE__ */ s0(m0);
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
var Rd;
function v0() {
  return Rd || (Rd = 1, (function(n) {
    function l(Q, J) {
      var I = Q.length;
      Q.push(J);
      t: for (; 0 < I; ) {
        var K = I - 1 >>> 1, V = Q[K];
        if (0 < o(V, J))
          Q[K] = J, Q[I] = V, I = K;
        else break t;
      }
    }
    function s(Q) {
      return Q.length === 0 ? null : Q[0];
    }
    function i(Q) {
      if (Q.length === 0) return null;
      var J = Q[0], I = Q.pop();
      if (I !== J) {
        Q[0] = I;
        t: for (var K = 0, V = Q.length, T = V >>> 1; K < T; ) {
          var X = 2 * (K + 1) - 1, et = Q[X], it = X + 1, ot = Q[it];
          if (0 > o(et, I))
            it < V && 0 > o(ot, et) ? (Q[K] = ot, Q[it] = I, K = it) : (Q[K] = et, Q[X] = I, K = X);
          else if (it < V && 0 > o(ot, I))
            Q[K] = ot, Q[it] = I, K = it;
          else break t;
        }
      }
      return J;
    }
    function o(Q, J) {
      var I = Q.sortIndex - J.sortIndex;
      return I !== 0 ? I : Q.id - J.id;
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
    var p = [], v = [], k = 1, E = null, x = 3, z = !1, S = !1, w = !1, _ = !1, N = typeof setTimeout == "function" ? setTimeout : null, B = typeof clearTimeout == "function" ? clearTimeout : null, j = typeof setImmediate < "u" ? setImmediate : null;
    function Z(Q) {
      for (var J = s(v); J !== null; ) {
        if (J.callback === null) i(v);
        else if (J.startTime <= Q)
          i(v), J.sortIndex = J.expirationTime, l(p, J);
        else break;
        J = s(v);
      }
    }
    function q(Q) {
      if (w = !1, Z(Q), !S)
        if (s(p) !== null)
          S = !0, D || (D = !0, M());
        else {
          var J = s(v);
          J !== null && F(q, J.startTime - Q);
        }
    }
    var D = !1, h = -1, b = 5, y = -1;
    function A() {
      return _ ? !0 : !(n.unstable_now() - y < b);
    }
    function O() {
      if (_ = !1, D) {
        var Q = n.unstable_now();
        y = Q;
        var J = !0;
        try {
          t: {
            S = !1, w && (w = !1, B(h), h = -1), z = !0;
            var I = x;
            try {
              e: {
                for (Z(Q), E = s(p); E !== null && !(E.expirationTime > Q && A()); ) {
                  var K = E.callback;
                  if (typeof K == "function") {
                    E.callback = null, x = E.priorityLevel;
                    var V = K(
                      E.expirationTime <= Q
                    );
                    if (Q = n.unstable_now(), typeof V == "function") {
                      E.callback = V, Z(Q), J = !0;
                      break e;
                    }
                    E === s(p) && i(p), Z(Q);
                  } else i(p);
                  E = s(p);
                }
                if (E !== null) J = !0;
                else {
                  var T = s(v);
                  T !== null && F(
                    q,
                    T.startTime - Q
                  ), J = !1;
                }
              }
              break t;
            } finally {
              E = null, x = I, z = !1;
            }
            J = void 0;
          }
        } finally {
          J ? M() : D = !1;
        }
      }
    }
    var M;
    if (typeof j == "function")
      M = function() {
        j(O);
      };
    else if (typeof MessageChannel < "u") {
      var U = new MessageChannel(), L = U.port2;
      U.port1.onmessage = O, M = function() {
        L.postMessage(null);
      };
    } else
      M = function() {
        N(O, 0);
      };
    function F(Q, J) {
      h = N(function() {
        Q(n.unstable_now());
      }, J);
    }
    n.unstable_IdlePriority = 5, n.unstable_ImmediatePriority = 1, n.unstable_LowPriority = 4, n.unstable_NormalPriority = 3, n.unstable_Profiling = null, n.unstable_UserBlockingPriority = 2, n.unstable_cancelCallback = function(Q) {
      Q.callback = null;
    }, n.unstable_forceFrameRate = function(Q) {
      0 > Q || 125 < Q ? console.error(
        "forceFrameRate takes a positive int between 0 and 125, forcing frame rates higher than 125 fps is not supported"
      ) : b = 0 < Q ? Math.floor(1e3 / Q) : 5;
    }, n.unstable_getCurrentPriorityLevel = function() {
      return x;
    }, n.unstable_next = function(Q) {
      switch (x) {
        case 1:
        case 2:
        case 3:
          var J = 3;
          break;
        default:
          J = x;
      }
      var I = x;
      x = J;
      try {
        return Q();
      } finally {
        x = I;
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
      var I = x;
      x = Q;
      try {
        return J();
      } finally {
        x = I;
      }
    }, n.unstable_scheduleCallback = function(Q, J, I) {
      var K = n.unstable_now();
      switch (typeof I == "object" && I !== null ? (I = I.delay, I = typeof I == "number" && 0 < I ? K + I : K) : I = K, Q) {
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
      return V = I + V, Q = {
        id: k++,
        callback: J,
        priorityLevel: Q,
        startTime: I,
        expirationTime: V,
        sortIndex: -1
      }, I > K ? (Q.sortIndex = I, l(v, Q), s(p) === null && Q === s(v) && (w ? (B(h), h = -1) : w = !0, F(q, I - K))) : (Q.sortIndex = V, l(p, Q), S || z || (S = !0, D || (D = !0, M()))), Q;
    }, n.unstable_shouldYield = A, n.unstable_wrapCallback = function(Q) {
      var J = x;
      return function() {
        var I = x;
        x = J;
        try {
          return Q.apply(this, arguments);
        } finally {
          x = I;
        }
      };
    };
  })(Xo)), Xo;
}
var Dd;
function y0() {
  return Dd || (Dd = 1, Vo.exports = v0()), Vo.exports;
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
function x0() {
  return Bd || (Bd = 1, (function(n) {
    n.exports = function(l) {
      function s(t, e, a, r) {
        return new Fm(t, e, a, r);
      }
      function i() {
      }
      function o(t) {
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
          throw Error(o(188));
      }
      function f(t) {
        var e = t.alternate;
        if (!e) {
          if (e = d(t), e === null) throw Error(o(188));
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
            throw Error(o(188));
          }
          if (a.return !== r.return) a = c, r = u;
          else {
            for (var g = !1, C = c.child; C; ) {
              if (C === a) {
                g = !0, a = c, r = u;
                break;
              }
              if (C === r) {
                g = !0, r = c, a = u;
                break;
              }
              C = C.sibling;
            }
            if (!g) {
              for (C = u.child; C; ) {
                if (C === a) {
                  g = !0, a = u, r = c;
                  break;
                }
                if (C === r) {
                  g = !0, r = u, a = c;
                  break;
                }
                C = C.sibling;
              }
              if (!g) throw Error(o(189));
            }
          }
          if (a.alternate !== r) throw Error(o(190));
        }
        if (a.tag !== 3) throw Error(o(188));
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
      function k(t) {
        return t === null || typeof t != "object" ? null : (t = Vu && t[Vu] || t["@@iterator"], typeof t == "function" ? t : null);
      }
      function E(t) {
        if (t == null) return null;
        if (typeof t == "function")
          return t.$$typeof === ep ? null : t.displayName || t.name || null;
        if (typeof t == "string") return t;
        switch (t) {
          case ya:
            return "Fragment";
          case ro:
            return "Profiler";
          case Ku:
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
            case Qu:
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
      function x(t) {
        return { current: t };
      }
      function z(t) {
        0 > _a || (t.current = bo[_a], bo[_a] = null, _a--);
      }
      function S(t, e) {
        _a++, bo[_a] = t.current, t.current = e;
      }
      function w(t) {
        return t >>>= 0, t === 0 ? 32 : 31 - (Ch(t) / Mh | 0) | 0;
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
        var C = r & 134217727;
        return C !== 0 ? (r = C & ~u, r !== 0 ? c = _(r) : (g &= C, g !== 0 ? c = _(g) : a || (a = C & ~t, a !== 0 && (c = _(a))))) : (C = r & ~u, C !== 0 ? c = _(C) : g !== 0 ? c = _(g) : a || (a = r & ~t, a !== 0 && (c = _(a)))), c === 0 ? 0 : e !== 0 && e !== c && (e & u) === 0 && (u = c & -c, a = e & -e, u >= a || u === 32 && (a & 4194048) !== 0) ? e : c;
      }
      function B(t, e) {
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
      function Z() {
        var t = sr;
        return sr <<= 1, (sr & 62914560) === 0 && (sr = 4194304), t;
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
        var C = t.entanglements, G = t.expirationTimes, W = t.hiddenUpdates;
        for (a = g & ~a; 0 < a; ) {
          var tt = 31 - xe(a), $ = 1 << tt;
          C[tt] = 0, G[tt] = -1;
          var nt = W[tt];
          if (nt !== null)
            for (W[tt] = null, tt = 0; tt < nt.length; tt++) {
              var gt = nt[tt];
              gt !== null && (gt.lane &= -536870913);
            }
          a &= ~$;
        }
        r !== 0 && b(t, r, 0), u !== 0 && c === 0 && t.tag !== 0 && (t.suspendedLanes |= u & ~(g & ~e));
      }
      function b(t, e, a) {
        t.pendingLanes |= e, t.suspendedLanes &= ~e;
        var r = 31 - xe(e);
        t.entangledLanes |= e, t.entanglements[r] = t.entanglements[r] | 1073741824 | a & 261930;
      }
      function y(t, e) {
        var a = t.entangledLanes |= e;
        for (t = t.entanglements; a; ) {
          var r = 31 - xe(a), c = 1 << r;
          c & e | t[r] & e && (t[r] |= e), a &= ~c;
        }
      }
      function A(t, e) {
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
      function M(t) {
        return t &= -t, 2 < t ? 8 < t ? (t & 134217727) !== 0 ? 32 : 268435456 : 8 : 2;
      }
      function U(t) {
        if (typeof Dh == "function" && Bh(t), we && typeof we.setStrictMode == "function")
          try {
            we.setStrictMode(rl, t);
          } catch {
          }
      }
      function L(t, e) {
        return t === e && (t !== 0 || 1 / t === 1 / e) || t !== t && e !== e;
      }
      function F(t) {
        if (xo === void 0)
          try {
            throw Error();
          } catch (a) {
            var e = a.stack.trim().match(/\n( *(at )?)/);
            xo = e && e[1] || "", gd = -1 < a.stack.indexOf(`
    at`) ? " (<anonymous>)" : -1 < a.stack.indexOf("@") ? "@unknown:0:0" : "";
          }
        return `
` + xo + t + gd;
      }
      function Q(t, e) {
        if (!t || wo) return "";
        wo = !0;
        var a = Error.prepareStackTrace;
        Error.prepareStackTrace = void 0;
        try {
          var r = {
            DetermineComponentFrameRoot: function() {
              try {
                if (e) {
                  var $ = function() {
                    throw Error();
                  };
                  if (Object.defineProperty($.prototype, "props", {
                    set: function() {
                      throw Error();
                    }
                  }), typeof Reflect == "object" && Reflect.construct) {
                    try {
                      Reflect.construct($, []);
                    } catch (gt) {
                      var nt = gt;
                    }
                    Reflect.construct(t, [], $);
                  } else {
                    try {
                      $.call();
                    } catch (gt) {
                      nt = gt;
                    }
                    t.call($.prototype);
                  }
                } else {
                  try {
                    throw Error();
                  } catch (gt) {
                    nt = gt;
                  }
                  ($ = t()) && typeof $.catch == "function" && $.catch(function() {
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
            var G = g.split(`
`), W = C.split(`
`);
            for (c = r = 0; r < G.length && !G[r].includes("DetermineComponentFrameRoot"); )
              r++;
            for (; c < W.length && !W[c].includes(
              "DetermineComponentFrameRoot"
            ); )
              c++;
            if (r === G.length || c === W.length)
              for (r = G.length - 1, c = W.length - 1; 1 <= r && 0 <= c && G[r] !== W[c]; )
                c--;
            for (; 1 <= r && 0 <= c; r--, c--)
              if (G[r] !== W[c]) {
                if (r !== 1 || c !== 1)
                  do
                    if (r--, c--, 0 > c || G[r] !== W[c]) {
                      var tt = `
` + G[r].replace(" at new ", " at ");
                      return t.displayName && tt.includes("<anonymous>") && (tt = tt.replace("<anonymous>", t.displayName)), tt;
                    }
                  while (1 <= r && 0 <= c);
                break;
              }
          }
        } finally {
          wo = !1, Error.prepareStackTrace = a;
        }
        return (a = t ? t.displayName || t.name : "") ? F(a) : "";
      }
      function J(t, e) {
        switch (t.tag) {
          case 26:
          case 27:
          case 5:
            return F(t.type);
          case 16:
            return F("Lazy");
          case 13:
            return t.child !== e && e !== null ? F("Suspense Fallback") : F("Suspense");
          case 19:
            return F("SuspenseList");
          case 0:
          case 15:
            return Q(t.type, !1);
          case 11:
            return Q(t.type.render, !1);
          case 1:
            return Q(t.type, !0);
          case 31:
            return F("Activity");
          default:
            return "";
        }
      }
      function I(t) {
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
      function K(t, e) {
        if (typeof t == "object" && t !== null) {
          var a = bd.get(t);
          return a !== void 0 ? a : (e = {
            value: t,
            source: e,
            stack: I(e)
          }, bd.set(t, e), e);
        }
        return {
          value: t,
          source: e,
          stack: I(e)
        };
      }
      function V(t, e) {
        ka[Ea++] = il, ka[Ea++] = ur, ur = t, il = e;
      }
      function T(t, e, a) {
        Te[Ce++] = Le, Te[Ce++] = Ze, Te[Ce++] = kn, kn = t;
        var r = Le;
        t = Ze;
        var c = 32 - xe(r) - 1;
        r &= ~(1 << c), a += 1;
        var u = 32 - xe(e) + c;
        if (30 < u) {
          var g = c - c % 5;
          u = (r & (1 << g) - 1).toString(32), r >>= g, c -= g, Le = 1 << 32 - xe(e) + c | a << c | r, Ze = u + t;
        } else
          Le = 1 << u | a << c | r, Ze = t;
      }
      function X(t) {
        t.return !== null && (V(t, 1), T(t, 1, 0));
      }
      function et(t) {
        for (; t === ur; )
          ur = ka[--Ea], ka[Ea] = null, il = ka[--Ea], ka[Ea] = null;
        for (; t === kn; )
          kn = Te[--Ce], Te[Ce] = null, Ze = Te[--Ce], Te[Ce] = null, Le = Te[--Ce], Te[Ce] = null;
      }
      function it(t, e) {
        Te[Ce++] = Le, Te[Ce++] = Ze, Te[Ce++] = kn, Le = e.id, Ze = e.overflow, kn = t;
      }
      function ot(t, e) {
        S(En, e), S(ol, t), S(ee, null), t = lp(e), z(ee), S(ee, t);
      }
      function ut() {
        z(ee), z(ol), z(En);
      }
      function kt(t) {
        t.memoizedState !== null && S(dr, t);
        var e = ee.current, a = rp(e, t.type);
        e !== a && (S(ol, t), S(ee, a));
      }
      function Zt(t) {
        ol.current === t && (z(ee), z(ol)), dr.current === t && (z(dr), an ? In._currentValue = xa : In._currentValue2 = xa);
      }
      function ht(t) {
        var e = Error(
          o(
            418,
            1 < arguments.length && arguments[1] !== void 0 && arguments[1] ? "text" : "HTML",
            ""
          )
        );
        throw Ga(K(e, t)), _o;
      }
      function Gn(t, e) {
        if (!ce) throw Error(o(175));
        rh(
          t.stateNode,
          t.type,
          t.memoizedProps,
          e,
          t
        ) || ht(t, !0);
      }
      function Kn(t) {
        for (ne = t.return; ne; )
          switch (ne.tag) {
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
              ne = ne.return;
          }
      }
      function Re(t) {
        if (!ce || t !== ne) return !1;
        if (!St) return Kn(t), St = !0, !1;
        var e = t.tag;
        if (Vt ? e !== 3 && e !== 27 && (e !== 5 || ad(t.type) && !rr(t.type, t.memoizedProps)) && Ot && ht(t) : e !== 3 && (e !== 5 || ad(t.type) && !rr(t.type, t.memoizedProps)) && Ot && ht(t), Kn(t), e === 13) {
          if (!ce) throw Error(o(316));
          if (t = t.memoizedState, t = t !== null ? t.dehydrated : null, !t) throw Error(o(317));
          Ot = uh(t);
        } else if (e === 31) {
          if (t = t.memoizedState, t = t !== null ? t.dehydrated : null, !t) throw Error(o(317));
          Ot = ch(t);
        } else
          Ot = Vt && e === 27 ? Wp(
            t.type,
            Ot
          ) : ne ? nd(t.stateNode) : null;
        return !0;
      }
      function De() {
        ce && (Ot = ne = null, St = !1);
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
      function hn(t, e, a) {
        an ? (S(fr, e._currentValue), e._currentValue = a) : (S(fr, e._currentValue2), e._currentValue2 = a);
      }
      function Ie(t) {
        var e = fr.current;
        an ? t._currentValue = e : t._currentValue2 = e, z(fr);
      }
      function ni(t, e, a) {
        for (; t !== null; ) {
          var r = t.alternate;
          if ((t.childLanes & e) !== e ? (t.childLanes |= e, r !== null && (r.childLanes |= e)) : r !== null && (r.childLanes & e) !== e && (r.childLanes |= e), t === a) break;
          t = t.return;
        }
      }
      function ai(t, e, a, r) {
        var c = t.child;
        for (c !== null && (c.return = t); c !== null; ) {
          var u = c.dependencies;
          if (u !== null) {
            var g = c.child;
            u = u.firstContext;
            t: for (; u !== null; ) {
              var C = u;
              u = c;
              for (var G = 0; G < e.length; G++)
                if (C.context === e[G]) {
                  u.lanes |= a, C = u.alternate, C !== null && (C.lanes |= a), ni(
                    u.return,
                    a,
                    t
                  ), r || (g = null);
                  break t;
                }
              u = C.next;
            }
          } else if (c.tag === 18) {
            if (g = c.return, g === null) throw Error(o(341));
            g.lanes |= a, u = g.alternate, u !== null && (u.lanes |= a), ni(g, a, t), g = null;
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
            if (g === null) throw Error(o(387));
            if (g = g.memoizedProps, g !== null) {
              var C = c.type;
              _e(c.pendingProps.value, g.value) || (t !== null ? t.push(C) : t = [C]);
            }
          } else if (c === dr.current) {
            if (g = c.alternate, g === null) throw Error(o(387));
            g.memoizedState.memoizedState !== c.memoizedState.memoizedState && (t !== null ? t.push(In) : t = [In]);
          }
          c = c.return;
        }
        t !== null && ai(
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
            an ? e._currentValue : e._currentValue2,
            t.memoizedValue
          ))
            return !0;
          t = t.next;
        }
        return !1;
      }
      function Qn(t) {
        $n = t, rn = null, t = t.dependencies, t !== null && (t.firstContext = null);
      }
      function Pt(t) {
        return Ms($n, t);
      }
      function Cl(t, e) {
        return $n === null && Qn(t), Ms(t, e);
      }
      function Ms(t, e) {
        var a = an ? e._currentValue : e._currentValue2;
        if (e = { context: e, memoizedValue: a, next: null }, rn === null) {
          if (t === null) throw Error(o(308));
          rn = e, t.dependencies = { lanes: 0, firstContext: e }, t.flags |= 524288;
        } else rn = rn.next = e;
        return a;
      }
      function li() {
        return {
          controller: new Uh(),
          data: /* @__PURE__ */ new Map(),
          refCount: 0
        };
      }
      function Ka(t) {
        t.refCount--, t.refCount === 0 && qh(Yh, function() {
          t.controller.abort();
        });
      }
      function Ml() {
      }
      function Qe(t) {
        t !== za && t.next === null && (za === null ? mr = za = t : za = za.next = t), pr = !0, So || (So = !0, zm());
      }
      function ma(t, e) {
        if (!ko && pr) {
          ko = !0;
          do
            for (var a = !1, r = mr; r !== null; ) {
              if (t !== 0) {
                var c = r.pendingLanes;
                if (c === 0) var u = 0;
                else {
                  var g = r.suspendedLanes, C = r.pingedLanes;
                  u = (1 << 31 - xe(42 | t) + 1) - 1, u &= c & ~(g & ~C), u = u & 201326741 ? u & 201326741 | 1 : u ? u | 2 : 0;
                }
                u !== 0 && (a = !0, Ds(r, u));
              } else
                u = _t, u = N(
                  r,
                  r === At ? u : 0,
                  r.cancelPendingCommit !== null || r.timeoutHandle !== Fn
                ), (u & 3) === 0 || B(r, u) || (a = !0, Ds(r, u));
              r = r.next;
            }
          while (a);
          ko = !1;
        }
      }
      function As() {
        js();
      }
      function js() {
        pr = So = !1;
        var t = 0;
        Pn !== 0 && pp() && (t = Pn);
        for (var e = pe(), a = null, r = mr; r !== null; ) {
          var c = r.next, u = Os(r, e);
          u === 0 ? (r.next = null, a === null ? mr = c : a.next = c, c === null && (za = a)) : (a = r, (t !== 0 || (u & 3) !== 0) && (pr = !0)), r = c;
        }
        Xt !== 0 && Xt !== 5 || ma(t), Pn !== 0 && (Pn = 0);
      }
      function Os(t, e) {
        for (var a = t.suspendedLanes, r = t.pingedLanes, c = t.expirationTimes, u = t.pendingLanes & -62914561; 0 < u; ) {
          var g = 31 - xe(u), C = 1 << g, G = c[g];
          G === -1 ? ((C & a) === 0 || (C & r) !== 0) && (c[g] = j(C, e)) : G <= e && (t.expiredLanes |= C), u &= ~C;
        }
        if (e = At, a = _t, a = N(
          t,
          t === e ? a : 0,
          t.cancelPendingCommit !== null || t.timeoutHandle !== Fn
        ), r = t.callbackNode, a === 0 || t === e && (Ct === 2 || Ct === 9) || t.cancelPendingCommit !== null)
          return r !== null && r !== null && vo(r), t.callbackNode = null, t.callbackPriority = 0;
        if ((a & 3) === 0 || B(t, a)) {
          if (e = a & -a, e === t.callbackPriority) return e;
          switch (r !== null && vo(r), M(a)) {
            case 2:
            case 8:
              a = Oh;
              break;
            case 32:
              a = yo;
              break;
            case 268435456:
              a = Rh;
              break;
            default:
              a = yo;
          }
          return r = Rs.bind(null, t), a = cr(a, r), t.callbackPriority = e, t.callbackNode = a, e;
        }
        return r !== null && r !== null && vo(r), t.callbackPriority = 2, t.callbackNode = null, 2;
      }
      function Rs(t, e) {
        if (Xt !== 0 && Xt !== 5)
          return t.callbackNode = null, t.callbackPriority = 0, null;
        var a = t.callbackNode;
        if (el() && t.callbackNode !== a)
          return null;
        var r = _t;
        return r = N(
          t,
          t === At ? r : 0,
          t.cancelPendingCommit !== null || t.timeoutHandle !== Fn
        ), r === 0 ? null : (bu(t, r, e), Os(t, pe()), t.callbackNode != null && t.callbackNode === a ? Rs.bind(null, t) : null);
      }
      function Ds(t, e) {
        if (el()) return null;
        bu(t, e, !0);
      }
      function zm() {
        wp ? _p(function() {
          (xt & 6) !== 0 ? cr(
            pd,
            As
          ) : js();
        }) : cr(
          pd,
          As
        );
      }
      function ri() {
        if (Pn === 0) {
          var t = Na;
          t === 0 && (t = ir, ir <<= 1, (ir & 261888) === 0 && (ir = 256)), Pn = t;
        }
        return Pn;
      }
      function Nm(t, e) {
        if (sl === null) {
          var a = sl = [];
          Eo = 0, Na = ri(), Ta = {
            status: "pending",
            value: void 0,
            then: function(r) {
              a.push(r);
            }
          };
        }
        return Eo++, e.then(Bs, Bs), e;
      }
      function Bs() {
        if (--Eo === 0 && sl !== null) {
          Ta !== null && (Ta.status = "fulfilled");
          var t = sl;
          sl = null, Na = 0, Ta = null;
          for (var e = 0; e < t.length; e++) (0, t[e])();
        }
      }
      function Tm(t, e) {
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
      function ii() {
        var t = ta.current;
        return t !== null ? t : At.pooledCache;
      }
      function Al(t, e) {
        e === null ? S(ta, ta.current) : S(ta, e.pool);
      }
      function Hs() {
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
        var a = Object.keys(t), r = Object.keys(e);
        if (a.length !== r.length) return !1;
        for (r = 0; r < a.length; r++) {
          var c = a[r];
          if (!Hh.call(e, c) || !_e(t[c], e[c]))
            return !1;
        }
        return !0;
      }
      function Us(t) {
        return t = t.status, t === "fulfilled" || t === "rejected";
      }
      function qs(t, e, a) {
        switch (a = t[a], a === void 0 ? t.push(e) : a !== e && (e.then(Ml, Ml), e = a), e.status) {
          case "fulfilled":
            return e.value;
          case "rejected":
            throw t = e.reason, Gs(t), t;
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
                throw t = e.reason, Gs(t), t;
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
      function Ys() {
        if (ea === null) throw Error(o(459));
        var t = ea;
        return ea = null, t;
      }
      function Gs(t) {
        if (t === Ca || t === hr)
          throw Error(o(483));
      }
      function Ol(t) {
        var e = cl;
        return cl += 1, Ma === null && (Ma = []), qs(Ma, t, e);
      }
      function Qa(t, e) {
        e = e.props.ref, t.ref = e !== void 0 ? e : null;
      }
      function Rl(t, e) {
        throw e.$$typeof === Pm ? Error(o(525)) : (t = Object.prototype.toString.call(e), Error(
          o(
            31,
            t === "[object Object]" ? "object with keys {" + Object.keys(e).join(", ") + "}" : t
          )
        ));
      }
      function Ks(t) {
        function e(H, R) {
          if (t) {
            var Y = H.deletions;
            Y === null ? (H.deletions = [R], H.flags |= 16) : Y.push(R);
          }
        }
        function a(H, R) {
          if (!t) return null;
          for (; R !== null; )
            e(H, R), R = R.sibling;
          return null;
        }
        function r(H) {
          for (var R = /* @__PURE__ */ new Map(); H !== null; )
            H.key !== null ? R.set(H.key, H) : R.set(H.index, H), H = H.sibling;
          return R;
        }
        function c(H, R) {
          return H = nn(H, R), H.index = 0, H.sibling = null, H;
        }
        function u(H, R, Y) {
          return H.index = Y, t ? (Y = H.alternate, Y !== null ? (Y = Y.index, Y < R ? (H.flags |= 67108866, R) : Y) : (H.flags |= 67108866, R)) : (H.flags |= 1048576, R);
        }
        function g(H) {
          return t && H.alternate === null && (H.flags |= 67108866), H;
        }
        function C(H, R, Y, P) {
          return R === null || R.tag !== 6 ? (R = eo(Y, H.mode, P), R.return = H, R) : (R = c(R, Y), R.return = H, R);
        }
        function G(H, R, Y, P) {
          var ft = Y.type;
          return ft === ya ? tt(
            H,
            R,
            Y.props.children,
            P,
            Y.key
          ) : R !== null && (R.elementType === ft || typeof ft == "object" && ft !== null && ft.$$typeof === Sn && Vn(ft) === R.type) ? (R = c(R, Y.props), Qa(R, Y), R.return = H, R) : (R = nr(
            Y.type,
            Y.key,
            Y.props,
            null,
            H.mode,
            P
          ), Qa(R, Y), R.return = H, R);
        }
        function W(H, R, Y, P) {
          return R === null || R.tag !== 4 || R.stateNode.containerInfo !== Y.containerInfo || R.stateNode.implementation !== Y.implementation ? (R = no(Y, H.mode, P), R.return = H, R) : (R = c(R, Y.children || []), R.return = H, R);
        }
        function tt(H, R, Y, P, ft) {
          return R === null || R.tag !== 7 ? (R = Wn(
            Y,
            H.mode,
            P,
            ft
          ), R.return = H, R) : (R = c(R, Y), R.return = H, R);
        }
        function $(H, R, Y) {
          if (typeof R == "string" && R !== "" || typeof R == "number" || typeof R == "bigint")
            return R = eo(
              "" + R,
              H.mode,
              Y
            ), R.return = H, R;
          if (typeof R == "object" && R !== null) {
            switch (R.$$typeof) {
              case ar:
                return Y = nr(
                  R.type,
                  R.key,
                  R.props,
                  null,
                  H.mode,
                  Y
                ), Qa(Y, R), Y.return = H, Y;
              case va:
                return R = no(
                  R,
                  H.mode,
                  Y
                ), R.return = H, R;
              case Sn:
                return R = Vn(R), $(H, R, Y);
            }
            if (lr(R) || k(R))
              return R = Wn(
                R,
                H.mode,
                Y,
                null
              ), R.return = H, R;
            if (typeof R.then == "function")
              return $(H, Ol(R), Y);
            if (R.$$typeof === _n)
              return $(
                H,
                Cl(H, R),
                Y
              );
            Rl(H, R);
          }
          return null;
        }
        function nt(H, R, Y, P) {
          var ft = R !== null ? R.key : null;
          if (typeof Y == "string" && Y !== "" || typeof Y == "number" || typeof Y == "bigint")
            return ft !== null ? null : C(H, R, "" + Y, P);
          if (typeof Y == "object" && Y !== null) {
            switch (Y.$$typeof) {
              case ar:
                return Y.key === ft ? G(H, R, Y, P) : null;
              case va:
                return Y.key === ft ? W(H, R, Y, P) : null;
              case Sn:
                return Y = Vn(Y), nt(H, R, Y, P);
            }
            if (lr(Y) || k(Y))
              return ft !== null ? null : tt(H, R, Y, P, null);
            if (typeof Y.then == "function")
              return nt(
                H,
                R,
                Ol(Y),
                P
              );
            if (Y.$$typeof === _n)
              return nt(
                H,
                R,
                Cl(H, Y),
                P
              );
            Rl(H, Y);
          }
          return null;
        }
        function gt(H, R, Y, P, ft) {
          if (typeof P == "string" && P !== "" || typeof P == "number" || typeof P == "bigint")
            return H = H.get(Y) || null, C(R, H, "" + P, ft);
          if (typeof P == "object" && P !== null) {
            switch (P.$$typeof) {
              case ar:
                return H = H.get(
                  P.key === null ? Y : P.key
                ) || null, G(R, H, P, ft);
              case va:
                return H = H.get(
                  P.key === null ? Y : P.key
                ) || null, W(R, H, P, ft);
              case Sn:
                return P = Vn(P), gt(
                  H,
                  R,
                  Y,
                  P,
                  ft
                );
            }
            if (lr(P) || k(P))
              return H = H.get(Y) || null, tt(R, H, P, ft, null);
            if (typeof P.then == "function")
              return gt(
                H,
                R,
                Y,
                Ol(P),
                ft
              );
            if (P.$$typeof === _n)
              return gt(
                H,
                R,
                Y,
                Cl(R, P),
                ft
              );
            Rl(R, P);
          }
          return null;
        }
        function ae(H, R, Y, P) {
          for (var ft = null, Dt = null, mt = R, zt = R = 0, Ft = null; mt !== null && zt < Y.length; zt++) {
            mt.index > zt ? (Ft = mt, mt = null) : Ft = mt.sibling;
            var Nt = nt(
              H,
              mt,
              Y[zt],
              P
            );
            if (Nt === null) {
              mt === null && (mt = Ft);
              break;
            }
            t && mt && Nt.alternate === null && e(H, mt), R = u(Nt, R, zt), Dt === null ? ft = Nt : Dt.sibling = Nt, Dt = Nt, mt = Ft;
          }
          if (zt === Y.length)
            return a(H, mt), St && V(H, zt), ft;
          if (mt === null) {
            for (; zt < Y.length; zt++)
              mt = $(H, Y[zt], P), mt !== null && (R = u(
                mt,
                R,
                zt
              ), Dt === null ? ft = mt : Dt.sibling = mt, Dt = mt);
            return St && V(H, zt), ft;
          }
          for (mt = r(mt); zt < Y.length; zt++)
            Ft = gt(
              mt,
              H,
              zt,
              Y[zt],
              P
            ), Ft !== null && (t && Ft.alternate !== null && mt.delete(
              Ft.key === null ? zt : Ft.key
            ), R = u(
              Ft,
              R,
              zt
            ), Dt === null ? ft = Ft : Dt.sibling = Ft, Dt = Ft);
          return t && mt.forEach(function(jn) {
            return e(H, jn);
          }), St && V(H, zt), ft;
        }
        function gl(H, R, Y, P) {
          if (Y == null) throw Error(o(151));
          for (var ft = null, Dt = null, mt = R, zt = R = 0, Ft = null, Nt = Y.next(); mt !== null && !Nt.done; zt++, Nt = Y.next()) {
            mt.index > zt ? (Ft = mt, mt = null) : Ft = mt.sibling;
            var jn = nt(H, mt, Nt.value, P);
            if (jn === null) {
              mt === null && (mt = Ft);
              break;
            }
            t && mt && jn.alternate === null && e(H, mt), R = u(jn, R, zt), Dt === null ? ft = jn : Dt.sibling = jn, Dt = jn, mt = Ft;
          }
          if (Nt.done)
            return a(H, mt), St && V(H, zt), ft;
          if (mt === null) {
            for (; !Nt.done; zt++, Nt = Y.next())
              Nt = $(H, Nt.value, P), Nt !== null && (R = u(
                Nt,
                R,
                zt
              ), Dt === null ? ft = Nt : Dt.sibling = Nt, Dt = Nt);
            return St && V(H, zt), ft;
          }
          for (mt = r(mt); !Nt.done; zt++, Nt = Y.next())
            Nt = gt(
              mt,
              H,
              zt,
              Nt.value,
              P
            ), Nt !== null && (t && Nt.alternate !== null && mt.delete(Nt.key === null ? zt : Nt.key), R = u(Nt, R, zt), Dt === null ? ft = Nt : Dt.sibling = Nt, Dt = Nt);
          return t && mt.forEach(function(Vh) {
            return e(H, Vh);
          }), St && V(H, zt), ft;
        }
        function ra(H, R, Y, P) {
          if (typeof Y == "object" && Y !== null && Y.type === ya && Y.key === null && (Y = Y.props.children), typeof Y == "object" && Y !== null) {
            switch (Y.$$typeof) {
              case ar:
                t: {
                  for (var ft = Y.key; R !== null; ) {
                    if (R.key === ft) {
                      if (ft = Y.type, ft === ya) {
                        if (R.tag === 7) {
                          a(
                            H,
                            R.sibling
                          ), P = c(
                            R,
                            Y.props.children
                          ), P.return = H, H = P;
                          break t;
                        }
                      } else if (R.elementType === ft || typeof ft == "object" && ft !== null && ft.$$typeof === Sn && Vn(ft) === R.type) {
                        a(
                          H,
                          R.sibling
                        ), P = c(R, Y.props), Qa(P, Y), P.return = H, H = P;
                        break t;
                      }
                      a(H, R);
                      break;
                    } else e(H, R);
                    R = R.sibling;
                  }
                  Y.type === ya ? (P = Wn(
                    Y.props.children,
                    H.mode,
                    P,
                    Y.key
                  ), P.return = H, H = P) : (P = nr(
                    Y.type,
                    Y.key,
                    Y.props,
                    null,
                    H.mode,
                    P
                  ), Qa(P, Y), P.return = H, H = P);
                }
                return g(H);
              case va:
                t: {
                  for (ft = Y.key; R !== null; ) {
                    if (R.key === ft)
                      if (R.tag === 4 && R.stateNode.containerInfo === Y.containerInfo && R.stateNode.implementation === Y.implementation) {
                        a(
                          H,
                          R.sibling
                        ), P = c(
                          R,
                          Y.children || []
                        ), P.return = H, H = P;
                        break t;
                      } else {
                        a(H, R);
                        break;
                      }
                    else e(H, R);
                    R = R.sibling;
                  }
                  P = no(Y, H.mode, P), P.return = H, H = P;
                }
                return g(H);
              case Sn:
                return Y = Vn(Y), ra(
                  H,
                  R,
                  Y,
                  P
                );
            }
            if (lr(Y))
              return ae(
                H,
                R,
                Y,
                P
              );
            if (k(Y)) {
              if (ft = k(Y), typeof ft != "function")
                throw Error(o(150));
              return Y = ft.call(Y), gl(
                H,
                R,
                Y,
                P
              );
            }
            if (typeof Y.then == "function")
              return ra(
                H,
                R,
                Ol(Y),
                P
              );
            if (Y.$$typeof === _n)
              return ra(
                H,
                R,
                Cl(H, Y),
                P
              );
            Rl(H, Y);
          }
          return typeof Y == "string" && Y !== "" || typeof Y == "number" || typeof Y == "bigint" ? (Y = "" + Y, R !== null && R.tag === 6 ? (a(H, R.sibling), P = c(R, Y), P.return = H, H = P) : (a(H, R), P = eo(Y, H.mode, P), P.return = H, H = P), g(H)) : a(H, R);
        }
        return function(H, R, Y, P) {
          try {
            cl = 0;
            var ft = ra(
              H,
              R,
              Y,
              P
            );
            return Ma = null, ft;
          } catch (mt) {
            if (mt === Ca || mt === hr) throw mt;
            var Dt = s(29, mt, null, H.mode);
            return Dt.lanes = P, Dt.return = H, Dt;
          } finally {
          }
        };
      }
      function Dl() {
        for (var t = Aa, e = No = Aa = 0; e < t; ) {
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
          u !== 0 && Qs(a, c, u);
        }
      }
      function Bl(t, e, a, r) {
        Ae[Aa++] = t, Ae[Aa++] = e, Ae[Aa++] = a, Ae[Aa++] = r, No |= r, t.lanes |= r, t = t.alternate, t !== null && (t.lanes |= r);
      }
      function oi(t, e, a, r) {
        return Bl(t, e, a, r), Hl(t);
      }
      function Xn(t, e) {
        return Bl(t, null, null, e), Hl(t);
      }
      function Qs(t, e, a) {
        t.lanes |= a;
        var r = t.alternate;
        r !== null && (r.lanes |= a);
        for (var c = !1, u = t.return; u !== null; )
          u.childLanes |= a, r = u.alternate, r !== null && (r.childLanes |= a), u.tag === 22 && (t = u.stateNode, t === null || t._visibility & 1 || (c = !0)), t = u, u = u.return;
        return t.tag === 3 ? (u = t.stateNode, c && e !== null && (c = 31 - xe(a), t = u.hiddenUpdates, r = t[c], r === null ? t[c] = [e] : r.push(e), e.lane = a | 536870912), u) : null;
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
      function bn(t, e, a) {
        var r = t.updateQueue;
        if (r === null) return null;
        if (r = r.shared, (xt & 2) !== 0) {
          var c = r.pending;
          return c === null ? e.next = e : (e.next = c.next, c.next = e), r.pending = e, e = Hl(t), Qs(t, null, a), e;
        }
        return Bl(t, r, e, a), Hl(t);
      }
      function Va(t, e, a) {
        if (e = e.updateQueue, e !== null && (e = e.shared, (a & 4194048) !== 0)) {
          var r = e.lanes;
          r &= t.pendingLanes, a |= r, e.lanes = a, y(t, a);
        }
      }
      function ui(t, e) {
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
        if (To) {
          var t = Ta;
          if (t !== null) throw t;
        }
      }
      function La(t, e, a, r) {
        To = !1;
        var c = t.updateQueue;
        Nn = !1;
        var u = c.firstBaseUpdate, g = c.lastBaseUpdate, C = c.shared.pending;
        if (C !== null) {
          c.shared.pending = null;
          var G = C, W = G.next;
          G.next = null, g === null ? u = W : g.next = W, g = G;
          var tt = t.alternate;
          tt !== null && (tt = tt.updateQueue, C = tt.lastBaseUpdate, C !== g && (C === null ? tt.firstBaseUpdate = W : C.next = W, tt.lastBaseUpdate = G));
        }
        if (u !== null) {
          var $ = c.baseState;
          g = 0, tt = W = G = null, C = u;
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
                var ae = t, gl = C;
                nt = e;
                var ra = a;
                switch (gl.tag) {
                  case 1:
                    if (ae = gl.payload, typeof ae == "function") {
                      $ = ae.call(
                        ra,
                        $,
                        nt
                      );
                      break t;
                    }
                    $ = ae;
                    break t;
                  case 3:
                    ae.flags = ae.flags & -65537 | 128;
                  case 0:
                    if (ae = gl.payload, nt = typeof ae == "function" ? ae.call(ra, $, nt) : ae, nt == null) break t;
                    $ = lo({}, $, nt);
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
              }, tt === null ? (W = tt = gt, G = $) : tt = tt.next = gt, g |= nt;
            if (C = C.next, C === null) {
              if (C = c.shared.pending, C === null)
                break;
              gt = C, C = gt.next, gt.next = null, c.lastBaseUpdate = gt, c.shared.pending = null;
            }
          } while (!0);
          tt === null && (G = $), c.baseState = G, c.firstBaseUpdate = W, c.lastBaseUpdate = tt, u === null && (c.shared.lanes = 0), Cn |= g, t.lanes = g, t.memoizedState = $;
        }
      }
      function Vs(t, e) {
        if (typeof t != "function")
          throw Error(o(191, t));
        t.call(e);
      }
      function Xs(t, e) {
        var a = t.callbacks;
        if (a !== null)
          for (t.callbacks = null, t = 0; t < a.length; t++)
            Vs(a[t], e);
      }
      function Ls(t, e) {
        t = cn, S(br, t), S(ja, e), cn = t | e.baseLanes;
      }
      function di() {
        S(br, cn), S(ja, ja.current);
      }
      function fi() {
        cn = br.current, z(ja), z(br);
      }
      function vn(t) {
        var e = t.alternate;
        S(qt, qt.current & 1), S(Se, t), je === null && (e === null || ja.current !== null || e.memoizedState !== null) && (je = t);
      }
      function mi(t) {
        S(qt, qt.current), S(Se, t), je === null && (je = t);
      }
      function Zs(t) {
        t.tag === 22 ? (S(qt, qt.current), S(Se, t), je === null && (je = t)) : yn();
      }
      function yn() {
        S(qt, qt.current), S(Se, Se.current);
      }
      function be(t) {
        z(Se), je === t && (je = null), z(qt);
      }
      function Ul(t) {
        for (var e = t; e !== null; ) {
          if (e.tag === 13) {
            var a = e.memoizedState;
            if (a !== null && (a = a.dehydrated, a === null || po(a) || ho(a)))
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
        for (var a = 0; a < e.length && a < t.length; a++)
          if (!_e(t[a], e[a])) return !1;
        return !0;
      }
      function hi(t, e, a, r, c, u) {
        return on = u, bt = e, e.memoizedState = null, e.updateQueue = null, e.lanes = 0, dt.H = t === null || t.memoizedState === null ? xd : Co, aa = !1, u = a(r, c), aa = !1, Oa && (u = Ws(
          e,
          a,
          r,
          c
        )), Js(t), u;
      }
      function Js(t) {
        dt.H = dl;
        var e = Mt !== null && Mt.next !== null;
        if (on = 0, Yt = Mt = bt = null, vr = !1, ul = 0, Ra = null, e) throw Error(o(300));
        t === null || Gt || (t = t.dependencies, t !== null && Tl(t) && (Gt = !0));
      }
      function Ws(t, e, a, r) {
        bt = t;
        var c = 0;
        do {
          if (Oa && (Ra = null), ul = 0, Oa = !1, 25 <= c) throw Error(o(301));
          if (c += 1, Yt = Mt = null, t.updateQueue != null) {
            var u = t.updateQueue;
            u.lastEffect = null, u.events = null, u.stores = null, u.memoCache != null && (u.memoCache.index = 0);
          }
          dt.H = wd, u = e(a, r);
        } while (Oa);
        return u;
      }
      function Cm() {
        var t = dt.H, e = t.useState()[0];
        return e = typeof e.then == "function" ? Za(e) : e, t = t.useState()[0], (Mt !== null ? Mt.memoizedState : null) !== t && (bt.flags |= 1024), e;
      }
      function gi() {
        var t = yr !== 0;
        return yr = 0, t;
      }
      function bi(t, e, a) {
        e.updateQueue = t.updateQueue, e.flags &= -2053, t.lanes &= ~a;
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
        return ul += 1, Ra === null && (Ra = []), t = qs(Ra, t, e), e = bt, (Yt === null ? e.memoizedState : Yt.next) === null && (e = e.alternate, dt.H = e === null || e.memoizedState === null ? xd : Co), t;
      }
      function Yl(t) {
        if (t !== null && typeof t == "object") {
          if (typeof t.then == "function") return Za(t);
          if (t.$$typeof === _n) return Pt(t);
        }
        throw Error(o(438, String(t)));
      }
      function yi(t) {
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
            a[r] = tp;
        return e.index++, a;
      }
      function $e(t, e) {
        return typeof e == "function" ? e(t) : e;
      }
      function Gl(t) {
        var e = Ut();
        return xi(e, Mt, t);
      }
      function xi(t, e, a) {
        var r = t.queue;
        if (r === null) throw Error(o(311));
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
          var C = g = null, G = null, W = e, tt = !1;
          do {
            var $ = W.lane & -536870913;
            if ($ !== W.lane ? (_t & $) === $ : (on & $) === $) {
              var nt = W.revertLane;
              if (nt === 0)
                G !== null && (G = G.next = {
                  lane: 0,
                  revertLane: 0,
                  gesture: null,
                  action: W.action,
                  hasEagerState: W.hasEagerState,
                  eagerState: W.eagerState,
                  next: null
                }), $ === Na && (tt = !0);
              else if ((on & nt) === nt) {
                W = W.next, nt === Na && (tt = !0);
                continue;
              } else
                $ = {
                  lane: 0,
                  revertLane: W.revertLane,
                  gesture: null,
                  action: W.action,
                  hasEagerState: W.hasEagerState,
                  eagerState: W.eagerState,
                  next: null
                }, G === null ? (C = G = $, g = u) : G = G.next = $, bt.lanes |= nt, Cn |= nt;
              $ = W.action, aa && a(u, $), u = W.hasEagerState ? W.eagerState : a(u, $);
            } else
              nt = {
                lane: $,
                revertLane: W.revertLane,
                gesture: W.gesture,
                action: W.action,
                hasEagerState: W.hasEagerState,
                eagerState: W.eagerState,
                next: null
              }, G === null ? (C = G = nt, g = u) : G = G.next = nt, bt.lanes |= $, Cn |= $;
            W = W.next;
          } while (W !== null && W !== e);
          if (G === null ? g = u : G.next = C, !_e(u, t.memoizedState) && (Gt = !0, tt && (a = Ta, a !== null)))
            throw a;
          t.memoizedState = u, t.baseState = g, t.baseQueue = G, r.lastRenderedState = u;
        }
        return c === null && (r.lanes = 0), [t.memoizedState, r.dispatch];
      }
      function wi(t) {
        var e = Ut(), a = e.queue;
        if (a === null) throw Error(o(311));
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
      function Fs(t, e, a) {
        var r = bt, c = Ut(), u = St;
        if (u) {
          if (a === void 0)
            throw Error(o(407));
          a = a();
        } else a = e();
        var g = !_e(
          (Mt || c).memoizedState,
          a
        );
        if (g && (c.memoizedState = a, Gt = !0), c = c.queue, ki(Ps.bind(null, r, c, t), [
          t
        ]), c.getSnapshot !== e || g || Yt !== null && Yt.memoizedState.tag & 1) {
          if (r.flags |= 2048, pa(
            9,
            { destroy: void 0 },
            $s.bind(
              null,
              r,
              c,
              a,
              e
            ),
            null
          ), At === null) throw Error(o(349));
          u || (on & 127) !== 0 || Is(r, e, a);
        }
        return a;
      }
      function Is(t, e, a) {
        t.flags |= 16384, t = { getSnapshot: e, value: a }, e = bt.updateQueue, e === null ? (e = ql(), bt.updateQueue = e, e.stores = [t]) : (a = e.stores, a === null ? e.stores = [t] : a.push(t));
      }
      function $s(t, e, a, r) {
        e.value = a, e.getSnapshot = r, tc(e) && ec(t);
      }
      function Ps(t, e, a) {
        return a(function() {
          tc(e) && ec(t);
        });
      }
      function tc(t) {
        var e = t.getSnapshot;
        t = t.value;
        try {
          var a = e();
          return !_e(t, a);
        } catch {
          return !0;
        }
      }
      function ec(t) {
        var e = Xn(t, 2);
        e !== null && me(e, t, 2);
      }
      function _i(t) {
        var e = de();
        if (typeof t == "function") {
          var a = t;
          if (t = a(), aa) {
            U(!0);
            try {
              a();
            } finally {
              U(!1);
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
      function nc(t, e, a, r) {
        return t.baseState = a, xi(
          t,
          Mt,
          typeof r == "function" ? r : $e
        );
      }
      function Mm(t, e, a, r, c) {
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
            then: function(g) {
              u.listeners.push(g);
            }
          };
          dt.T !== null ? a(!0) : u.isTransition = !1, r(u), a = e.pending, a === null ? (u.next = e.pending = u, ac(e, u)) : (u.next = a.next, e.pending = a.next = u);
        }
      }
      function ac(t, e) {
        var a = e.action, r = e.payload, c = t.state;
        if (e.isTransition) {
          var u = dt.T, g = {};
          dt.T = g;
          try {
            var C = a(c, r), G = dt.S;
            G !== null && G(g, C), lc(t, e, C);
          } catch (W) {
            Si(t, e, W);
          } finally {
            u !== null && g.types !== null && (u.types = g.types), dt.T = u;
          }
        } else
          try {
            u = a(c, r), lc(t, e, u);
          } catch (W) {
            Si(t, e, W);
          }
      }
      function lc(t, e, a) {
        a !== null && typeof a == "object" && typeof a.then == "function" ? a.then(
          function(r) {
            rc(t, e, r);
          },
          function(r) {
            return Si(t, e, r);
          }
        ) : rc(t, e, a);
      }
      function rc(t, e, a) {
        e.status = "fulfilled", e.value = a, ic(e), t.state = a, e = t.pending, e !== null && (a = e.next, a === e ? t.pending = null : (a = a.next, e.next = a, ac(t, a)));
      }
      function Si(t, e, a) {
        var r = t.pending;
        if (t.pending = null, r !== null) {
          r = r.next;
          do
            e.status = "rejected", e.reason = a, ic(e), e = e.next;
          while (e !== r);
        }
        t.action = null;
      }
      function ic(t) {
        t = t.listeners;
        for (var e = 0; e < t.length; e++) (0, t[e])();
      }
      function oc(t, e) {
        return e;
      }
      function sc(t, e) {
        if (St) {
          var a = At.formState;
          if (a !== null) {
            t: {
              var r = bt;
              if (St) {
                if (Ot) {
                  var c = Zp(
                    Ot,
                    Me
                  );
                  if (c) {
                    Ot = nd(c), r = Jp(c);
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
          lastRenderedReducer: oc,
          lastRenderedState: e
        }, a.queue = r, a = zc.bind(
          null,
          bt,
          r
        ), r.dispatch = a, r = _i(!1);
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
        }, r.queue = c, a = Mm.bind(
          null,
          bt,
          c,
          u,
          a
        ), c.dispatch = a, r.memoizedState = t, [e, a, !1];
      }
      function cc(t) {
        var e = Ut();
        return uc(e, Mt, t);
      }
      function uc(t, e, a) {
        if (e = xi(
          t,
          e,
          oc
        )[0], t = Gl($e)[0], typeof e == "object" && e !== null && typeof e.then == "function")
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
          Am.bind(null, c, a),
          null
        )), [r, u, t];
      }
      function Am(t, e) {
        t.action = e;
      }
      function dc(t) {
        var e = Ut(), a = Mt;
        if (a !== null)
          return uc(e, a, t);
        Ut(), e = e.memoizedState, a = Ut();
        var r = a.queue.dispatch;
        return a.memoizedState = t, [e, r, !1];
      }
      function pa(t, e, a, r) {
        return t = { tag: t, create: a, deps: r, inst: e, next: null }, e = bt.updateQueue, e === null && (e = ql(), bt.updateQueue = e), a = e.lastEffect, a === null ? e.lastEffect = t.next = t : (r = a.next, a.next = t, t.next = r, e.lastEffect = t), t;
      }
      function fc() {
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
        Mt !== null && r !== null && pi(r, Mt.memoizedState.deps) ? c.memoizedState = pa(e, u, a, r) : (bt.flags |= t, c.memoizedState = pa(
          1 | e,
          u,
          a,
          r
        ));
      }
      function mc(t, e) {
        Kl(8390656, 8, t, e);
      }
      function ki(t, e) {
        Ql(2048, 8, t, e);
      }
      function jm(t) {
        bt.flags |= 4;
        var e = bt.updateQueue;
        if (e === null)
          e = ql(), bt.updateQueue = e, e.events = [t];
        else {
          var a = e.events;
          a === null ? e.events = [t] : a.push(t);
        }
      }
      function pc(t) {
        var e = Ut().memoizedState;
        return jm({ ref: e, nextImpl: t }), function() {
          if ((xt & 2) !== 0)
            throw Error(o(440));
          return e.impl.apply(void 0, arguments);
        };
      }
      function hc(t, e) {
        return Ql(4, 2, t, e);
      }
      function gc(t, e) {
        return Ql(4, 4, t, e);
      }
      function bc(t, e) {
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
      function vc(t, e, a) {
        a = a != null ? a.concat([t]) : null, Ql(
          4,
          4,
          bc.bind(null, e, t),
          a
        );
      }
      function Ei() {
      }
      function yc(t, e) {
        var a = Ut();
        e = e === void 0 ? null : e;
        var r = a.memoizedState;
        return e !== null && pi(e, r[1]) ? r[0] : (a.memoizedState = [t, e], t);
      }
      function xc(t, e) {
        var a = Ut();
        e = e === void 0 ? null : e;
        var r = a.memoizedState;
        if (e !== null && pi(e, r[1]))
          return r[0];
        if (r = t(), aa) {
          U(!0);
          try {
            t();
          } finally {
            U(!1);
          }
        }
        return a.memoizedState = [r, e], r;
      }
      function zi(t, e, a) {
        return a === void 0 || (on & 1073741824) !== 0 && (_t & 261930) === 0 ? t.memoizedState = e : (t.memoizedState = a, t = gu(), bt.lanes |= t, Cn |= t, a);
      }
      function wc(t, e, a, r) {
        return _e(a, e) ? a : ja.current !== null ? (t = zi(t, a, r), _e(t, e) || (Gt = !0), t) : (on & 42) === 0 || (on & 1073741824) !== 0 && (_t & 261930) === 0 ? (Gt = !0, t.memoizedState = a) : (t = gu(), bt.lanes |= t, Cn |= t, e);
      }
      function _c(t, e, a, r, c) {
        var u = ln();
        Jt(
          u !== 0 && 8 > u ? u : 8
        );
        var g = dt.T, C = {};
        dt.T = C, Ti(t, !1, e, a);
        try {
          var G = c(), W = dt.S;
          if (W !== null && W(C, G), G !== null && typeof G == "object" && typeof G.then == "function") {
            var tt = Tm(
              G,
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
        } catch ($) {
          Ja(
            t,
            e,
            { then: function() {
            }, status: "rejected", reason: $ },
            ve()
          );
        } finally {
          Jt(u), g !== null && C.types !== null && (g.types = C.types), dt.T = g;
        }
      }
      function Sc(t) {
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
      function Ni() {
        return Pt(In);
      }
      function kc() {
        return Ut().memoizedState;
      }
      function Ec() {
        return Ut().memoizedState;
      }
      function Om(t) {
        for (var e = t.return; e !== null; ) {
          switch (e.tag) {
            case 24:
            case 3:
              var a = ve();
              t = gn(a);
              var r = bn(e, t, a);
              r !== null && (me(r, e, a), Va(r, e, a)), e = { cache: li() }, t.payload = e;
              return;
          }
          e = e.return;
        }
      }
      function Rm(t, e, a) {
        var r = ve();
        a = {
          lane: r,
          revertLane: 0,
          gesture: null,
          action: a,
          hasEagerState: !1,
          eagerState: null,
          next: null
        }, Vl(t) ? Nc(e, a) : (a = oi(t, e, a, r), a !== null && (me(a, t, r), Tc(a, e, r)));
      }
      function zc(t, e, a) {
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
        if (Vl(t)) Nc(e, c);
        else {
          var u = t.alternate;
          if (t.lanes === 0 && (u === null || u.lanes === 0) && (u = e.lastRenderedReducer, u !== null))
            try {
              var g = e.lastRenderedState, C = u(g, a);
              if (c.hasEagerState = !0, c.eagerState = C, _e(C, g))
                return Bl(t, e, c, 0), At === null && Dl(), !1;
            } catch {
            } finally {
            }
          if (a = oi(t, e, c, r), a !== null)
            return me(a, t, r), Tc(a, e, r), !0;
        }
        return !1;
      }
      function Ti(t, e, a, r) {
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
            a,
            r,
            2
          ), e !== null && me(e, t, 2);
      }
      function Vl(t) {
        var e = t.alternate;
        return t === bt || e !== null && e === bt;
      }
      function Nc(t, e) {
        Oa = vr = !0;
        var a = t.pending;
        a === null ? e.next = e : (e.next = a.next, a.next = e), t.pending = e;
      }
      function Tc(t, e, a) {
        if ((a & 4194048) !== 0) {
          var r = e.lanes;
          r &= t.pendingLanes, a |= r, e.lanes = a, y(t, a);
        }
      }
      function Ci(t, e, a, r) {
        e = t.memoizedState, a = a(r, e), a = a == null ? e : lo({}, e, a), t.memoizedState = a, t.lanes === 0 && (t.updateQueue.baseState = a);
      }
      function Cc(t, e, a, r, c, u, g) {
        return t = t.stateNode, typeof t.shouldComponentUpdate == "function" ? t.shouldComponentUpdate(r, u, g) : e.prototype && e.prototype.isPureReactComponent ? !jl(a, r) || !jl(c, u) : !0;
      }
      function Mc(t, e, a, r) {
        t = e.state, typeof e.componentWillReceiveProps == "function" && e.componentWillReceiveProps(a, r), typeof e.UNSAFE_componentWillReceiveProps == "function" && e.UNSAFE_componentWillReceiveProps(a, r), e.state !== t && Mo.enqueueReplaceState(e, e.state, null);
      }
      function Ln(t, e) {
        var a = e;
        if ("ref" in e) {
          a = {};
          for (var r in e)
            r !== "ref" && (a[r] = e[r]);
        }
        if (t = t.defaultProps) {
          a === e && (a = lo({}, a));
          for (var c in t)
            a[c] === void 0 && (a[c] = t[c]);
        }
        return a;
      }
      function Xl(t, e) {
        try {
          var a = t.onUncaughtError;
          a(e.value, { componentStack: e.stack });
        } catch (r) {
          setTimeout(function() {
            throw r;
          });
        }
      }
      function Ac(t, e, a) {
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
      function Mi(t, e, a) {
        return a = gn(a), a.tag = 3, a.payload = { element: null }, a.callback = function() {
          Xl(t, e);
        }, a;
      }
      function jc(t) {
        return t = gn(t), t.tag = 3, t;
      }
      function Oc(t, e, a, r) {
        var c = a.type.getDerivedStateFromError;
        if (typeof c == "function") {
          var u = r.value;
          t.payload = function() {
            return c(u);
          }, t.callback = function() {
            Ac(e, a, r);
          };
        }
        var g = a.stateNode;
        g !== null && typeof g.componentDidCatch == "function" && (t.callback = function() {
          Ac(e, a, r), typeof c != "function" && (Mn === null ? Mn = /* @__PURE__ */ new Set([this]) : Mn.add(this));
          var C = r.stack;
          this.componentDidCatch(r.value, {
            componentStack: C !== null ? C : ""
          });
        });
      }
      function Dm(t, e, a, r, c) {
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
                return je === null ? tr() : a.alternate === null && Ht === 0 && (Ht = 3), a.flags &= -257, a.flags |= 65536, a.lanes = c, r === gr ? a.flags |= 16384 : (e = a.updateQueue, e === null ? a.updateQueue = /* @__PURE__ */ new Set([r]) : e.add(r), Pi(t, r, c)), !1;
              case 22:
                return a.flags |= 65536, r === gr ? a.flags |= 16384 : (e = a.updateQueue, e === null ? (e = {
                  transitions: null,
                  markerInstances: null,
                  retryQueue: /* @__PURE__ */ new Set([r])
                }, a.updateQueue = e) : (a = e.retryQueue, a === null ? e.retryQueue = /* @__PURE__ */ new Set([r]) : a.add(r)), Pi(t, r, c)), !1;
            }
            throw Error(o(435, a.tag));
          }
          return Pi(t, r, c), tr(), !1;
        }
        if (St)
          return e = Se.current, e !== null ? ((e.flags & 65536) === 0 && (e.flags |= 256), e.flags |= 65536, e.lanes = c, r !== _o && (t = Error(o(422), { cause: r }), Ga(
            K(t, a)
          ))) : (r !== _o && (e = Error(o(423), {
            cause: r
          }), Ga(
            K(e, a)
          )), t = t.current.alternate, t.flags |= 65536, c &= -c, t.lanes |= c, r = K(r, a), c = Mi(
            t.stateNode,
            r,
            c
          ), ui(t, c), Ht !== 4 && (Ht = 2)), !1;
        var u = Error(o(520), { cause: r });
        if (u = K(u, a), ml === null ? ml = [u] : ml.push(u), Ht !== 4 && (Ht = 2), e === null) return !0;
        r = K(r, a), a = e;
        do {
          switch (a.tag) {
            case 3:
              return a.flags |= 65536, t = c & -c, a.lanes |= t, t = Mi(a.stateNode, r, t), ui(a, t), !1;
            case 1:
              if (e = a.type, u = a.stateNode, (a.flags & 128) === 0 && (typeof e.getDerivedStateFromError == "function" || u !== null && typeof u.componentDidCatch == "function" && (Mn === null || !Mn.has(
                u
              ))))
                return a.flags |= 65536, c &= -c, a.lanes |= c, c = jc(c), Oc(
                  c,
                  t,
                  a,
                  r
                ), ui(a, c), !1;
          }
          a = a.return;
        } while (a !== null);
        return !1;
      }
      function te(t, e, a, r) {
        e.child = t === null ? yd(e, null, a, r) : na(
          e,
          t.child,
          a,
          r
        );
      }
      function Rc(t, e, a, r, c) {
        a = a.render;
        var u = e.ref;
        if ("ref" in r) {
          var g = {};
          for (var C in r)
            C !== "ref" && (g[C] = r[C]);
        } else g = r;
        return Qn(e), r = hi(
          t,
          e,
          a,
          g,
          u,
          c
        ), C = gi(), t !== null && !Gt ? (bi(t, e, c), Pe(t, e, c)) : (St && C && X(e), e.flags |= 1, te(t, e, r, c), e.child);
      }
      function Dc(t, e, a, r, c) {
        if (t === null) {
          var u = a.type;
          return typeof u == "function" && !to(u) && u.defaultProps === void 0 && a.compare === null ? (e.tag = 15, e.type = u, Bc(
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
        if (u = t.child, !Hi(t, c)) {
          var g = u.memoizedProps;
          if (a = a.compare, a = a !== null ? a : jl, a(g, r) && t.ref === e.ref)
            return Pe(
              t,
              e,
              c
            );
        }
        return e.flags |= 1, t = nn(u, r), t.ref = e.ref, t.return = e, e.child = t;
      }
      function Bc(t, e, a, r, c) {
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
          a,
          r,
          c
        );
      }
      function Hc(t, e, a, r) {
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
            return Uc(
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
            ), u !== null ? Ls(e, u) : di(), Zs(e);
          else
            return r = e.lanes = 536870912, Uc(
              t,
              e,
              u !== null ? u.baseLanes | a : a,
              a,
              r
            );
        } else
          u !== null ? (Al(e, u.cachePool), Ls(e, u), yn(), e.memoizedState = null) : (t !== null && Al(e, null), di(), yn());
        return te(t, e, c, a), e.child;
      }
      function Wa(t, e) {
        return t !== null && t.tag === 22 || e.stateNode !== null || (e.stateNode = {
          _visibility: 1,
          _pendingMarkers: null,
          _retryCache: null,
          _transitions: null
        }), e.sibling;
      }
      function Uc(t, e, a, r, c) {
        var u = ii();
        return u = u === null ? null : {
          parent: an ? Rt._currentValue : Rt._currentValue2,
          pool: u
        }, e.memoizedState = {
          baseLanes: a,
          cachePool: u
        }, t !== null && Al(e, null), di(), Zs(e), t !== null && fa(t, e, r, !0), e.childLanes = c, null;
      }
      function Ll(t, e) {
        return e = Jl(
          { mode: e.mode, children: e.children },
          t.mode
        ), e.ref = t.ref, t.child = e, e.return = t, e;
      }
      function qc(t, e, a) {
        return na(e, t.child, null, a), t = Ll(
          e,
          e.pendingProps
        ), t.flags |= 2, be(e), e.memoizedState = null, t;
      }
      function Bm(t, e, a) {
        var r = e.pendingProps, c = (e.flags & 128) !== 0;
        if (e.flags &= -129, t === null) {
          if (St) {
            if (r.mode === "hidden")
              return t = Ll(e, r), e.lanes = 536870912, Wa(null, t);
            if (mi(e), (t = Ot) ? (t = ah(
              t,
              Me
            ), t !== null && (e.memoizedState = {
              dehydrated: t,
              treeContext: kn !== null ? { id: Le, overflow: Ze } : null,
              retryLane: 536870912,
              hydrationErrors: null
            }, a = Bu(t), a.return = e, e.child = a, ne = e, Ot = null)) : t = null, t === null) throw ht(e);
            return e.lanes = 536870912, null;
          }
          return Ll(e, r);
        }
        var u = t.memoizedState;
        if (u !== null) {
          var g = u.dehydrated;
          if (mi(e), c)
            if (e.flags & 256)
              e.flags &= -257, e = qc(
                t,
                e,
                a
              );
            else if (e.memoizedState !== null)
              e.child = t.child, e.flags |= 128, e = null;
            else throw Error(o(558));
          else if (Gt || fa(
            t,
            e,
            a,
            !1
          ), c = (a & t.childLanes) !== 0, Gt || c) {
            if (r = At, r !== null && (g = A(r, a), g !== 0 && g !== u.retryLane))
              throw u.retryLane = g, Xn(t, g), me(r, t, g), Ao;
            tr(), e = qc(
              t,
              e,
              a
            );
          } else
            t = u.treeContext, ce && (Ot = $p(g), ne = e, St = !0, zn = null, Me = !1, t !== null && it(e, t)), e = Ll(e, r), e.flags |= 4096;
          return e;
        }
        return t = nn(t.child, {
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
            throw Error(o(284));
          (t === null || t.ref !== a) && (e.flags |= 4194816);
        }
      }
      function Ai(t, e, a, r, c) {
        return Qn(e), a = hi(
          t,
          e,
          a,
          r,
          void 0,
          c
        ), r = gi(), t !== null && !Gt ? (bi(t, e, c), Pe(t, e, c)) : (St && r && X(e), e.flags |= 1, te(t, e, a, c), e.child);
      }
      function Yc(t, e, a, r, c, u) {
        return Qn(e), e.updateQueue = null, a = Ws(
          e,
          r,
          a,
          c
        ), Js(t), r = gi(), t !== null && !Gt ? (bi(t, e, u), Pe(t, e, u)) : (St && r && X(e), e.flags |= 1, te(t, e, a, u), e.child);
      }
      function Gc(t, e, a, r, c) {
        if (Qn(e), e.stateNode === null) {
          var u = Sa, g = a.contextType;
          typeof g == "object" && g !== null && (u = Pt(g)), u = new a(r, u), e.memoizedState = u.state !== null && u.state !== void 0 ? u.state : null, u.updater = Mo, e.stateNode = u, u._reactInternals = e, u = e.stateNode, u.props = r, u.state = e.memoizedState, u.refs = {}, si(e), g = a.contextType, u.context = typeof g == "object" && g !== null ? Pt(g) : Sa, u.state = e.memoizedState, g = a.getDerivedStateFromProps, typeof g == "function" && (Ci(
            e,
            a,
            g,
            r
          ), u.state = e.memoizedState), typeof a.getDerivedStateFromProps == "function" || typeof u.getSnapshotBeforeUpdate == "function" || typeof u.UNSAFE_componentWillMount != "function" && typeof u.componentWillMount != "function" || (g = u.state, typeof u.componentWillMount == "function" && u.componentWillMount(), typeof u.UNSAFE_componentWillMount == "function" && u.UNSAFE_componentWillMount(), g !== u.state && Mo.enqueueReplaceState(
            u,
            u.state,
            null
          ), La(e, r, u, c), Xa(), u.state = e.memoizedState), typeof u.componentDidMount == "function" && (e.flags |= 4194308), r = !0;
        } else if (t === null) {
          u = e.stateNode;
          var C = e.memoizedProps, G = Ln(a, C);
          u.props = G;
          var W = u.context, tt = a.contextType;
          g = Sa, typeof tt == "object" && tt !== null && (g = Pt(tt));
          var $ = a.getDerivedStateFromProps;
          tt = typeof $ == "function" || typeof u.getSnapshotBeforeUpdate == "function", C = e.pendingProps !== C, tt || typeof u.UNSAFE_componentWillReceiveProps != "function" && typeof u.componentWillReceiveProps != "function" || (C || W !== g) && Mc(
            e,
            u,
            r,
            g
          ), Nn = !1;
          var nt = e.memoizedState;
          u.state = nt, La(e, r, u, c), Xa(), W = e.memoizedState, C || nt !== W || Nn ? (typeof $ == "function" && (Ci(
            e,
            a,
            $,
            r
          ), W = e.memoizedState), (G = Nn || Cc(
            e,
            a,
            G,
            r,
            nt,
            W,
            g
          )) ? (tt || typeof u.UNSAFE_componentWillMount != "function" && typeof u.componentWillMount != "function" || (typeof u.componentWillMount == "function" && u.componentWillMount(), typeof u.UNSAFE_componentWillMount == "function" && u.UNSAFE_componentWillMount()), typeof u.componentDidMount == "function" && (e.flags |= 4194308)) : (typeof u.componentDidMount == "function" && (e.flags |= 4194308), e.memoizedProps = r, e.memoizedState = W), u.props = r, u.state = W, u.context = g, r = G) : (typeof u.componentDidMount == "function" && (e.flags |= 4194308), r = !1);
        } else {
          u = e.stateNode, ci(t, e), g = e.memoizedProps, tt = Ln(a, g), u.props = tt, $ = e.pendingProps, nt = u.context, W = a.contextType, G = Sa, typeof W == "object" && W !== null && (G = Pt(W)), C = a.getDerivedStateFromProps, (W = typeof C == "function" || typeof u.getSnapshotBeforeUpdate == "function") || typeof u.UNSAFE_componentWillReceiveProps != "function" && typeof u.componentWillReceiveProps != "function" || (g !== $ || nt !== G) && Mc(
            e,
            u,
            r,
            G
          ), Nn = !1, nt = e.memoizedState, u.state = nt, La(e, r, u, c), Xa();
          var gt = e.memoizedState;
          g !== $ || nt !== gt || Nn || t !== null && t.dependencies !== null && Tl(t.dependencies) ? (typeof C == "function" && (Ci(
            e,
            a,
            C,
            r
          ), gt = e.memoizedState), (tt = Nn || Cc(
            e,
            a,
            tt,
            r,
            nt,
            gt,
            G
          ) || t !== null && t.dependencies !== null && Tl(t.dependencies)) ? (W || typeof u.UNSAFE_componentWillUpdate != "function" && typeof u.componentWillUpdate != "function" || (typeof u.componentWillUpdate == "function" && u.componentWillUpdate(r, gt, G), typeof u.UNSAFE_componentWillUpdate == "function" && u.UNSAFE_componentWillUpdate(
            r,
            gt,
            G
          )), typeof u.componentDidUpdate == "function" && (e.flags |= 4), typeof u.getSnapshotBeforeUpdate == "function" && (e.flags |= 1024)) : (typeof u.componentDidUpdate != "function" || g === t.memoizedProps && nt === t.memoizedState || (e.flags |= 4), typeof u.getSnapshotBeforeUpdate != "function" || g === t.memoizedProps && nt === t.memoizedState || (e.flags |= 1024), e.memoizedProps = r, e.memoizedState = gt), u.props = r, u.state = gt, u.context = G, r = tt) : (typeof u.componentDidUpdate != "function" || g === t.memoizedProps && nt === t.memoizedState || (e.flags |= 4), typeof u.getSnapshotBeforeUpdate != "function" || g === t.memoizedProps && nt === t.memoizedState || (e.flags |= 1024), r = !1);
        }
        return u = r, Zl(t, e), r = (e.flags & 128) !== 0, u || r ? (u = e.stateNode, a = r && typeof a.getDerivedStateFromError != "function" ? null : u.render(), e.flags |= 1, t !== null && r ? (e.child = na(
          e,
          t.child,
          null,
          c
        ), e.child = na(
          e,
          null,
          a,
          c
        )) : te(t, e, a, c), e.memoizedState = u.state, t = e.child) : t = Pe(
          t,
          e,
          c
        ), t;
      }
      function Kc(t, e, a, r) {
        return De(), e.flags |= 256, te(t, e, a, r), e.child;
      }
      function ji(t) {
        return { baseLanes: t, cachePool: Hs() };
      }
      function Oi(t, e, a) {
        return t = t !== null ? t.childLanes & ~a : 0, e && (t |= Ee), t;
      }
      function Qc(t, e, a) {
        var r = e.pendingProps, c = !1, u = (e.flags & 128) !== 0, g;
        if ((g = u) || (g = t !== null && t.memoizedState === null ? !1 : (qt.current & 2) !== 0), g && (c = !0, e.flags &= -129), g = (e.flags & 32) !== 0, e.flags &= -33, t === null) {
          if (St) {
            if (c ? vn(e) : yn(), (t = Ot) ? (t = lh(
              t,
              Me
            ), t !== null && (e.memoizedState = {
              dehydrated: t,
              treeContext: kn !== null ? { id: Le, overflow: Ze } : null,
              retryLane: 536870912,
              hydrationErrors: null
            }, a = Bu(t), a.return = e, e.child = a, ne = e, Ot = null)) : t = null, t === null) throw ht(e);
            return ho(t) ? e.lanes = 32 : e.lanes = 536870912, null;
          }
          var C = r.children;
          return r = r.fallback, c ? (yn(), c = e.mode, C = Jl(
            { mode: "hidden", children: C },
            c
          ), r = Wn(
            r,
            c,
            a,
            null
          ), C.return = e, r.return = e, C.sibling = r, e.child = C, r = e.child, r.memoizedState = ji(a), r.childLanes = Oi(
            t,
            g,
            a
          ), e.memoizedState = jo, Wa(null, r)) : (vn(e), Ri(e, C));
        }
        var G = t.memoizedState;
        if (G !== null && (C = G.dehydrated, C !== null)) {
          if (u)
            e.flags & 256 ? (vn(e), e.flags &= -257, e = Di(
              t,
              e,
              a
            )) : e.memoizedState !== null ? (yn(), e.child = t.child, e.flags |= 128, e = null) : (yn(), C = r.fallback, c = e.mode, r = Jl(
              { mode: "visible", children: r.children },
              c
            ), C = Wn(
              C,
              c,
              a,
              null
            ), C.flags |= 2, r.return = e, C.return = e, r.sibling = C, e.child = r, na(
              e,
              t.child,
              null,
              a
            ), r = e.child, r.memoizedState = ji(a), r.childLanes = Oi(
              t,
              g,
              a
            ), e.memoizedState = jo, e = Wa(null, r));
          else if (vn(e), ho(C))
            g = Xp(C).digest, r = Error(o(419)), r.stack = "", r.digest = g, Ga({ value: r, source: null, stack: null }), e = Di(
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
            if (g = At, g !== null && (r = A(
              g,
              a
            ), r !== 0 && r !== G.retryLane))
              throw G.retryLane = r, Xn(t, r), me(g, t, r), Ao;
            po(C) || tr(), e = Di(
              t,
              e,
              a
            );
          } else
            po(C) ? (e.flags |= 192, e.child = t.child, e = null) : (t = G.treeContext, ce && (Ot = Pp(
              C
            ), ne = e, St = !0, zn = null, Me = !1, t !== null && it(e, t)), e = Ri(
              e,
              r.children
            ), e.flags |= 4096);
          return e;
        }
        return c ? (yn(), C = r.fallback, c = e.mode, G = t.child, u = G.sibling, r = nn(G, {
          mode: "hidden",
          children: r.children
        }), r.subtreeFlags = G.subtreeFlags & 65011712, u !== null ? C = nn(
          u,
          C
        ) : (C = Wn(
          C,
          c,
          a,
          null
        ), C.flags |= 2), C.return = e, r.return = e, r.sibling = C, e.child = r, Wa(null, r), r = e.child, C = t.child.memoizedState, C === null ? C = ji(a) : (c = C.cachePool, c !== null ? (G = an ? Rt._currentValue : Rt._currentValue2, c = c.parent !== G ? { parent: G, pool: G } : c) : c = Hs(), C = {
          baseLanes: C.baseLanes | a,
          cachePool: c
        }), r.memoizedState = C, r.childLanes = Oi(
          t,
          g,
          a
        ), e.memoizedState = jo, Wa(t.child, r)) : (vn(e), a = t.child, t = a.sibling, a = nn(a, {
          mode: "visible",
          children: r.children
        }), a.return = e, a.sibling = null, t !== null && (g = e.deletions, g === null ? (e.deletions = [t], e.flags |= 16) : g.push(t)), e.child = a, e.memoizedState = null, a);
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
      function Di(t, e, a) {
        return na(e, t.child, null, a), t = Ri(
          e,
          e.pendingProps.children
        ), t.flags |= 2, e.memoizedState = null, t;
      }
      function Vc(t, e, a) {
        t.lanes |= e;
        var r = t.alternate;
        r !== null && (r.lanes |= e), ni(t.return, e, a);
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
        var g = qt.current, C = (g & 2) !== 0;
        if (C ? (g = g & 1 | 2, e.flags |= 128) : g &= 1, S(qt, g), te(t, e, r, a), r = St ? il : 0, !C && t !== null && (t.flags & 128) !== 0)
          t: for (t = e.child; t !== null; ) {
            if (t.tag === 13)
              t.memoizedState !== null && Vc(t, a, e);
            else if (t.tag === 19)
              Vc(t, a, e);
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
      function Pe(t, e, a) {
        if (t !== null && (e.dependencies = t.dependencies), Cn |= e.lanes, (a & e.childLanes) === 0)
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
          throw Error(o(153));
        if (e.child !== null) {
          for (t = e.child, a = nn(t, t.pendingProps), e.child = a, a.return = e; t.sibling !== null; )
            t = t.sibling, a = a.sibling = nn(t, t.pendingProps), a.return = e;
          a.sibling = null;
        }
        return e.child;
      }
      function Hi(t, e) {
        return (t.lanes & e) !== 0 ? !0 : (t = t.dependencies, !!(t !== null && Tl(t)));
      }
      function Hm(t, e, a) {
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
              return r.dehydrated !== null ? (vn(e), e.flags |= 128, null) : (a & e.child.childLanes) !== 0 ? Qc(
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
            if (c = e.memoizedState, c !== null && (c.rendering = null, c.tail = null, c.lastEffect = null), S(qt, qt.current), r) break;
            return null;
          case 22:
            return e.lanes = 0, Hc(
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
      function Lc(t, e, a) {
        if (t !== null)
          if (t.memoizedProps !== e.pendingProps)
            Gt = !0;
          else {
            if (!Hi(t, a) && (e.flags & 128) === 0)
              return Gt = !1, Hm(
                t,
                e,
                a
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
                to(t) ? (r = Ln(t, r), e.tag = 1, e = Gc(
                  null,
                  e,
                  t,
                  r,
                  a
                )) : (e.tag = 0, e = Ai(
                  null,
                  e,
                  t,
                  r,
                  a
                ));
              else {
                if (t != null) {
                  var c = t.$$typeof;
                  if (c === io) {
                    e.tag = 11, e = Rc(
                      null,
                      e,
                      t,
                      r,
                      a
                    );
                    break t;
                  } else if (c === co) {
                    e.tag = 14, e = Dc(
                      null,
                      e,
                      t,
                      r,
                      a
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
              a
            );
          case 1:
            return r = e.type, c = Ln(
              r,
              e.pendingProps
            ), Gc(
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
              ), t === null) throw Error(o(387));
              var u = e.pendingProps;
              c = e.memoizedState, r = c.element, ci(t, e), La(e, u, null, a);
              var g = e.memoizedState;
              if (u = g.cache, hn(e, Rt, u), u !== c.cache && ai(
                e,
                [Rt],
                a,
                !0
              ), Xa(), u = g.element, ce && c.isDehydrated)
                if (c = {
                  element: u,
                  isDehydrated: !1,
                  cache: g.cache
                }, e.updateQueue.baseState = c, e.memoizedState = c, e.flags & 256) {
                  e = Kc(
                    t,
                    e,
                    u,
                    a
                  );
                  break t;
                } else if (u !== r) {
                  r = K(
                    Error(o(424)),
                    e
                  ), Ga(r), e = Kc(
                    t,
                    e,
                    u,
                    a
                  );
                  break t;
                } else
                  for (ce && (Ot = Ip(
                    e.stateNode.containerInfo
                  ), ne = e, St = !0, zn = null, Me = !0), a = yd(
                    e,
                    null,
                    u,
                    a
                  ), e.child = a; a; )
                    a.flags = a.flags & -3 | 4096, a = a.sibling;
              else {
                if (De(), u === r) {
                  e = Pe(
                    t,
                    e,
                    a
                  );
                  break t;
                }
                te(t, e, u, a);
              }
              e = e.child;
            }
            return e;
          case 26:
            if (qe)
              return Zl(t, e), t === null ? (a = rd(
                e.type,
                null,
                e.pendingProps,
                null
              )) ? e.memoizedState = a : St || (e.stateNode = kh(
                e.type,
                e.pendingProps,
                En.current,
                e
              )) : e.memoizedState = rd(
                e.type,
                t.memoizedProps,
                e.pendingProps,
                t.memoizedState
              ), null;
          case 27:
            if (Vt)
              return kt(e), t === null && Vt && St && (r = e.stateNode = dd(
                e.type,
                e.pendingProps,
                En.current,
                ee.current,
                !1
              ), ne = e, Me = !0, Ot = th(
                e.type,
                r,
                Ot
              )), te(
                t,
                e,
                e.pendingProps.children,
                a
              ), Zl(t, e), t === null && (e.flags |= 4194304), e.child;
          case 5:
            return t === null && St && (wh(
              e.type,
              e.pendingProps,
              ee.current
            ), (c = r = Ot) && (r = eh(
              r,
              e.type,
              e.pendingProps,
              Me
            ), r !== null ? (e.stateNode = r, ne = e, Ot = Fp(r), Me = !1, c = !0) : c = !1), c || ht(e)), kt(e), c = e.type, u = e.pendingProps, g = t !== null ? t.memoizedProps : null, r = u.children, rr(c, u) ? r = null : g !== null && rr(c, g) && (e.flags |= 32), e.memoizedState !== null && (c = hi(
              t,
              e,
              Cm,
              null,
              null,
              a
            ), an ? In._currentValue = c : In._currentValue2 = c), Zl(t, e), te(t, e, r, a), e.child;
          case 6:
            return t === null && St && (_h(
              e.pendingProps,
              ee.current
            ), (t = a = Ot) && (a = nh(
              a,
              e.pendingProps,
              Me
            ), a !== null ? (e.stateNode = a, ne = e, Ot = null, t = !0) : t = !1), t || ht(e)), null;
          case 13:
            return Qc(t, e, a);
          case 4:
            return ot(
              e,
              e.stateNode.containerInfo
            ), r = e.pendingProps, t === null ? e.child = na(
              e,
              null,
              r,
              a
            ) : te(t, e, r, a), e.child;
          case 11:
            return Rc(
              t,
              e,
              e.type,
              e.pendingProps,
              a
            );
          case 7:
            return te(
              t,
              e,
              e.pendingProps,
              a
            ), e.child;
          case 8:
            return te(
              t,
              e,
              e.pendingProps.children,
              a
            ), e.child;
          case 12:
            return te(
              t,
              e,
              e.pendingProps.children,
              a
            ), e.child;
          case 10:
            return r = e.pendingProps, hn(e, e.type, r.value), te(
              t,
              e,
              r.children,
              a
            ), e.child;
          case 9:
            return c = e.type._context, r = e.pendingProps.children, Qn(e), c = Pt(c), r = r(c), e.flags |= 1, te(t, e, r, a), e.child;
          case 14:
            return Dc(
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
            return Bm(t, e, a);
          case 22:
            return Hc(
              t,
              e,
              a,
              e.pendingProps
            );
          case 24:
            return Qn(e), r = Pt(Rt), t === null ? (c = ii(), c === null && (c = At, u = li(), c.pooledCache = u, u.refCount++, u !== null && (c.pooledCacheLanes |= a), c = u), e.memoizedState = {
              parent: r,
              cache: c
            }, si(e), hn(e, Rt, c)) : ((t.lanes & a) !== 0 && (ci(t, e), La(e, null, null, a), Xa()), c = t.memoizedState, u = e.memoizedState, c.parent !== r ? (c = { parent: r, cache: r }, e.memoizedState = c, e.lanes === 0 && (e.memoizedState = e.updateQueue.baseState = c), hn(e, Rt, r)) : (r = u.cache, hn(e, Rt, r), r !== c.cache && ai(
              e,
              [Rt],
              a,
              !0
            ))), te(
              t,
              e,
              e.pendingProps.children,
              a
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
        Xe && (t.flags |= 8);
      }
      function Zc(t, e) {
        if (t !== null && t.child === e.child) return !1;
        if ((e.flags & 16) !== 0) return !0;
        for (t = e.child; t !== null; ) {
          if ((t.flags & 8218) !== 0 || (t.subtreeFlags & 8218) !== 0)
            return !0;
          t = t.sibling;
        }
        return !1;
      }
      function Ui(t, e, a, r) {
        if (se)
          for (a = e.child; a !== null; ) {
            if (a.tag === 5 || a.tag === 6)
              fo(t, a.stateNode);
            else if (!(a.tag === 4 || Vt && a.tag === 27) && a.child !== null) {
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
              var u = c.stateNode;
              a && r && (u = td(
                u,
                c.type,
                c.memoizedProps
              )), fo(t, u);
            } else if (c.tag === 6)
              u = c.stateNode, a && r && (u = ed(
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
      function Jc(t, e, a, r) {
        var c = !1;
        if (Xe)
          for (var u = e.child; u !== null; ) {
            if (u.tag === 5) {
              var g = u.stateNode;
              a && r && (g = td(
                g,
                u.type,
                u.memoizedProps
              )), $u(t, g);
            } else if (u.tag === 6)
              g = u.stateNode, a && r && (g = ed(
                g,
                u.memoizedProps
              )), $u(t, g);
            else if (u.tag !== 4) {
              if (u.tag === 22 && u.memoizedState !== null)
                c = u.child, c !== null && (c.return = u), Jc(t, u, !0, !0), c = !0;
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
      function Wc(t, e) {
        if (Xe && Zc(t, e)) {
          t = e.stateNode;
          var a = t.containerInfo, r = Iu();
          Jc(r, e, !1, !1), t.pendingChildren = r, Be(e), Vp(a, r);
        }
      }
      function qi(t, e, a, r) {
        if (se)
          t.memoizedProps !== r && Be(e);
        else if (Xe) {
          var c = t.stateNode, u = t.memoizedProps;
          if ((t = Zc(t, e)) || u !== r) {
            var g = ee.current;
            u = Qp(
              c,
              a,
              u,
              r,
              !t,
              null
            ), u === c ? e.stateNode = c : (Wl(e), Lu(
              u,
              a,
              r,
              g
            ) && Be(e), e.stateNode = u, t && Ui(u, e, !1, !1));
          } else e.stateNode = c;
        }
      }
      function Yi(t, e, a, r, c) {
        if ((t.mode & 32) !== 0 && (a === null ? gp(e, r) : bp(e, a, r))) {
          if (t.flags |= 16777216, (c & 335544128) === c || mo(e, r))
            if (Ju(t.stateNode, e, r))
              t.flags |= 8192;
            else if (wu()) t.flags |= 8192;
            else
              throw ea = gr, zo;
        } else t.flags &= -16777217;
      }
      function Fc(t, e) {
        if (zh(e)) {
          if (t.flags |= 16777216, !ud(e))
            if (wu()) t.flags |= 8192;
            else
              throw ea = gr, zo;
        } else t.flags &= -16777217;
      }
      function Fl(t, e) {
        e !== null && (t.flags |= 4), t.flags & 16384 && (e = t.tag !== 22 ? Z() : 536870912, t.lanes |= e, Ha |= e);
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
      function Um(t, e, a) {
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
            return a = e.stateNode, r = null, t !== null && (r = t.memoizedState.cache), e.memoizedState.cache !== r && (e.flags |= 2048), Ie(Rt), ut(), a.pendingContext && (a.context = a.pendingContext, a.pendingContext = null), (t === null || t.child === null) && (Re(e) ? Be(e) : t === null || t.memoizedState.isDehydrated && (e.flags & 256) === 0 || (e.flags |= 1024, pn())), Wc(t, e), jt(e), null;
          case 26:
            if (qe) {
              var c = e.type, u = e.memoizedState;
              return t === null ? (Be(e), u !== null ? (jt(e), Fc(
                e,
                u
              )) : (jt(e), Yi(
                e,
                c,
                null,
                r,
                a
              ))) : u ? u !== t.memoizedState ? (Be(e), jt(e), Fc(
                e,
                u
              )) : (jt(e), e.flags &= -16777217) : (u = t.memoizedProps, se ? u !== r && Be(e) : qi(
                t,
                e,
                c,
                r
              ), jt(e), Yi(
                e,
                c,
                u,
                r,
                a
              )), null;
            }
          case 27:
            if (Vt) {
              if (Zt(e), a = En.current, c = e.type, t !== null && e.stateNode != null)
                se ? t.memoizedProps !== r && Be(e) : qi(t, e, c, r);
              else {
                if (!r) {
                  if (e.stateNode === null)
                    throw Error(o(166));
                  return jt(e), null;
                }
                t = ee.current, Re(e) ? Gn(e, t) : (t = dd(
                  c,
                  r,
                  a,
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
              if (u = ee.current, Re(e))
                Gn(e, u), hh(
                  e.stateNode,
                  c,
                  r,
                  u
                ) && (e.flags |= 64);
              else {
                var g = sp(
                  c,
                  r,
                  En.current,
                  u,
                  e
                );
                Wl(e), Ui(g, e, !1, !1), e.stateNode = g, Lu(
                  g,
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
              a
            ), null;
          case 6:
            if (t && e.stateNode != null)
              a = t.memoizedProps, se ? a !== r && Be(e) : Xe && (a !== r ? (t = En.current, a = ee.current, Wl(e), e.stateNode = Zu(
                r,
                t,
                a,
                e
              )) : e.stateNode = t.stateNode);
            else {
              if (typeof r != "string" && e.stateNode === null)
                throw Error(o(166));
              if (t = En.current, a = ee.current, Re(e)) {
                if (!ce) throw Error(o(176));
                if (t = e.stateNode, a = e.memoizedProps, r = null, c = ne, c !== null)
                  switch (c.tag) {
                    case 27:
                    case 5:
                      r = c.memoizedProps;
                  }
                ih(
                  t,
                  a,
                  e,
                  r
                ) || ht(e, !0);
              } else
                Wl(e), e.stateNode = Zu(
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
                  if (!r) throw Error(o(318));
                  if (!ce) throw Error(o(556));
                  if (t = e.memoizedState, t = t !== null ? t.dehydrated : null, !t) throw Error(o(557));
                  oh(t, e);
                } else
                  De(), (e.flags & 128) === 0 && (e.memoizedState = null), e.flags |= 4;
                jt(e), t = !1;
              } else
                a = pn(), t !== null && t.memoizedState !== null && (t.memoizedState.hydrationErrors = a), t = !0;
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
                  if (!ce) throw Error(o(344));
                  if (c = e.memoizedState, c = c !== null ? c.dehydrated : null, !c) throw Error(o(317));
                  sh(c, e);
                } else
                  De(), (e.flags & 128) === 0 && (e.memoizedState = null), e.flags |= 4;
                jt(e), c = !1;
              } else
                c = pn(), t !== null && t.memoizedState !== null && (t.memoizedState.hydrationErrors = c), c = !0;
              if (!c)
                return e.flags & 256 ? (be(e), e) : (be(e), null);
            }
            return be(e), (e.flags & 128) !== 0 ? (e.lanes = a, e) : (a = r !== null, t = t !== null && t.memoizedState !== null, a && (r = e.child, c = null, r.alternate !== null && r.alternate.memoizedState !== null && r.alternate.memoizedState.cachePool !== null && (c = r.alternate.memoizedState.cachePool.pool), u = null, r.memoizedState !== null && r.memoizedState.cachePool !== null && (u = r.memoizedState.cachePool.pool), u !== c && (r.flags |= 2048)), a !== t && a && (e.child.flags |= 8192), Fl(e, e.updateQueue), jt(e), null);
          case 4:
            return ut(), Wc(t, e), t === null && fp(e.stateNode.containerInfo), jt(e), null;
          case 10:
            return Ie(e.type), jt(e), null;
          case 19:
            if (z(qt), r = e.memoizedState, r === null) return jt(e), null;
            if (c = (e.flags & 128) !== 0, u = r.rendering, u === null)
              if (c) Fa(r, !1);
              else {
                if (Ht !== 0 || t !== null && (t.flags & 128) !== 0)
                  for (t = e.child; t !== null; ) {
                    if (u = Ul(t), u !== null) {
                      for (e.flags |= 128, Fa(r, !1), t = u.updateQueue, e.updateQueue = t, Fl(e, t), e.subtreeFlags = 0, t = a, a = e.child; a !== null; )
                        Du(a, t), a = a.sibling;
                      return S(
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
            return r.tail !== null ? (t = r.tail, r.rendering = t, r.tail = t.sibling, r.renderingStartTime = pe(), t.sibling = null, a = qt.current, S(
              qt,
              c ? a & 1 | 2 : a & 1
            ), St && V(e, r.treeForkCount), t) : (jt(e), null);
          case 22:
          case 23:
            return be(e), fi(), r = e.memoizedState !== null, t !== null ? t.memoizedState !== null !== r && (e.flags |= 8192) : r && (e.flags |= 8192), r ? (a & 536870912) !== 0 && (e.flags & 128) === 0 && (jt(e), e.subtreeFlags & 6 && (e.flags |= 8192)) : jt(e), a = e.updateQueue, a !== null && Fl(e, a.retryQueue), a = null, t !== null && t.memoizedState !== null && t.memoizedState.cachePool !== null && (a = t.memoizedState.cachePool.pool), r = null, e.memoizedState !== null && e.memoizedState.cachePool !== null && (r = e.memoizedState.cachePool.pool), r !== a && (e.flags |= 2048), t !== null && z(ta), null;
          case 24:
            return a = null, t !== null && (a = t.memoizedState.cache), e.memoizedState.cache !== a && (e.flags |= 2048), Ie(Rt), jt(e), null;
          case 25:
            return null;
          case 30:
            return null;
        }
        throw Error(o(156, e.tag));
      }
      function qm(t, e) {
        switch (et(e), e.tag) {
          case 1:
            return t = e.flags, t & 65536 ? (e.flags = t & -65537 | 128, e) : null;
          case 3:
            return Ie(Rt), ut(), t = e.flags, (t & 65536) !== 0 && (t & 128) === 0 ? (e.flags = t & -65537 | 128, e) : null;
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
            return z(qt), null;
          case 4:
            return ut(), null;
          case 10:
            return Ie(e.type), null;
          case 22:
          case 23:
            return be(e), fi(), t !== null && z(ta), t = e.flags, t & 65536 ? (e.flags = t & -65537 | 128, e) : null;
          case 24:
            return Ie(Rt), null;
          case 25:
            return null;
          default:
            return null;
        }
      }
      function Ic(t, e) {
        switch (et(e), e.tag) {
          case 3:
            Ie(Rt), ut();
            break;
          case 26:
          case 27:
          case 5:
            Zt(e);
            break;
          case 4:
            ut();
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
            Ie(e.type);
            break;
          case 22:
          case 23:
            be(e), fi(), t !== null && z(ta);
            break;
          case 24:
            Ie(Rt);
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
        } catch (C) {
          Et(e, e.return, C);
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
                var g = r.inst, C = g.destroy;
                if (C !== void 0) {
                  g.destroy = void 0, c = e;
                  var G = a, W = C;
                  try {
                    W();
                  } catch (tt) {
                    Et(
                      c,
                      G,
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
      function $c(t) {
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
      function Pc(t, e, a) {
        a.props = Ln(
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
      function Ve(t, e) {
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
      function tu(t) {
        var e = t.type, a = t.memoizedProps, r = t.stateNode;
        try {
          jp(r, e, a, t);
        } catch (c) {
          Et(t, t.return, c);
        }
      }
      function Gi(t, e, a) {
        try {
          Op(
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
      function eu(t) {
        return t.tag === 5 || t.tag === 3 || (qe ? t.tag === 26 : !1) || (Vt ? t.tag === 27 && wa(t.type) : !1) || t.tag === 4;
      }
      function Ki(t) {
        t: for (; ; ) {
          for (; t.sibling === null; ) {
            if (t.return === null || eu(t.return)) return null;
            t = t.return;
          }
          for (t.sibling.return = t.return, t = t.sibling; t.tag !== 5 && t.tag !== 6 && t.tag !== 18; ) {
            if (Vt && t.tag === 27 && wa(t.type) || t.flags & 2 || t.child === null || t.tag === 4) continue t;
            t.child.return = t, t = t.child;
          }
          if (!(t.flags & 2)) return t.stateNode;
        }
      }
      function Qi(t, e, a) {
        var r = t.tag;
        if (r === 5 || r === 6)
          t = t.stateNode, e ? Dp(a, t, e) : Mp(a, t);
        else if (r !== 4 && (Vt && r === 27 && wa(t.type) && (a = t.stateNode, e = null), t = t.child, t !== null))
          for (Qi(t, e, a), t = t.sibling; t !== null; )
            Qi(t, e, a), t = t.sibling;
      }
      function Il(t, e, a) {
        var r = t.tag;
        if (r === 5 || r === 6)
          t = t.stateNode, e ? Rp(a, t, e) : Cp(a, t);
        else if (r !== 4 && (Vt && r === 27 && wa(t.type) && (a = t.stateNode), t = t.child, t !== null))
          for (Il(t, e, a), t = t.sibling; t !== null; )
            Il(t, e, a), t = t.sibling;
      }
      function nu(t, e, a) {
        t = t.containerInfo;
        try {
          Pu(t, a);
        } catch (r) {
          Et(e, e.return, r);
        }
      }
      function au(t) {
        var e = t.stateNode, a = t.memoizedProps;
        try {
          Th(
            t.type,
            a,
            e,
            t
          );
        } catch (r) {
          Et(t, t.return, r);
        }
      }
      function Ym(t, e) {
        for (ip(t.containerInfo), Wt = e; Wt !== null; )
          if (t = Wt, e = t.child, (t.subtreeFlags & 1028) !== 0 && e !== null)
            e.return = t, Wt = e;
          else
            for (; Wt !== null; ) {
              t = Wt;
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
                      var g = Ln(
                        r.type,
                        c
                      );
                      e = u.getSnapshotBeforeUpdate(
                        g,
                        a
                      ), u.__reactInternalSnapshotBeforeUpdate = e;
                    } catch (C) {
                      Et(r, r.return, C);
                    }
                  }
                  break;
                case 3:
                  (e & 1024) !== 0 && se && Kp(t.stateNode.containerInfo);
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
      function lu(t, e, a) {
        var r = a.flags;
        switch (a.tag) {
          case 0:
          case 11:
          case 15:
            tn(t, a), r & 4 && Ia(5, a);
            break;
          case 1:
            if (tn(t, a), r & 4)
              if (t = a.stateNode, e === null)
                try {
                  t.componentDidMount();
                } catch (g) {
                  Et(a, a.return, g);
                }
              else {
                var c = Ln(
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
            r & 64 && $c(a), r & 512 && $a(a, a.return);
            break;
          case 3:
            if (tn(t, a), r & 64 && (r = a.updateQueue, r !== null)) {
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
            Vt && e === null && r & 4 && au(a);
          case 26:
          case 5:
            if (tn(t, a), e === null) {
              if (r & 4) tu(a);
              else if (r & 64) {
                t = a.type, e = a.memoizedProps, c = a.stateNode;
                try {
                  dh(
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
            tn(t, a);
            break;
          case 31:
            tn(t, a), r & 4 && iu(t, a);
            break;
          case 13:
            tn(t, a), r & 4 && ou(t, a), r & 64 && (r = a.memoizedState, r !== null && (r = r.dehydrated, r !== null && (a = Zm.bind(
              null,
              a
            ), Lp(r, a))));
            break;
          case 22:
            if (r = a.memoizedState !== null || sn, !r) {
              e = e !== null && e.memoizedState !== null || Kt, c = sn;
              var u = Kt;
              sn = r, (Kt = e) && !u ? en(
                t,
                a,
                (a.subtreeFlags & 8772) !== 0
              ) : tn(t, a), sn = c, Kt = u;
            }
            break;
          case 30:
            break;
          default:
            tn(t, a);
        }
      }
      function ru(t) {
        var e = t.alternate;
        e !== null && (t.alternate = null, ru(e)), t.child = null, t.deletions = null, t.sibling = null, t.tag === 5 && (e = t.stateNode, e !== null && hp(e)), t.stateNode = null, t.return = null, t.dependencies = null, t.memoizedProps = null, t.memoizedState = null, t.pendingProps = null, t.stateNode = null, t.updateQueue = null;
      }
      function He(t, e, a) {
        for (a = a.child; a !== null; )
          Vi(
            t,
            e,
            a
          ), a = a.sibling;
      }
      function Vi(t, e, a) {
        if (we && typeof we.onCommitFiberUnmount == "function")
          try {
            we.onCommitFiberUnmount(rl, a);
          } catch {
          }
        switch (a.tag) {
          case 26:
            if (qe) {
              Kt || Ve(a, e), He(
                t,
                e,
                a
              ), a.memoizedState ? od(a.memoizedState) : a.stateNode && cd(a.stateNode);
              break;
            }
          case 27:
            if (Vt) {
              Kt || Ve(a, e);
              var r = Qt, c = he;
              wa(a.type) && (Qt = a.stateNode, he = !1), He(
                t,
                e,
                a
              ), fd(a.stateNode), Qt = r, he = c;
              break;
            }
          case 5:
            Kt || Ve(a, e);
          case 6:
            if (se) {
              if (r = Qt, c = he, Qt = null, He(
                t,
                e,
                a
              ), Qt = r, he = c, Qt !== null)
                if (he)
                  try {
                    Hp(Qt, a.stateNode);
                  } catch (u) {
                    Et(
                      a,
                      e,
                      u
                    );
                  }
                else
                  try {
                    Bp(Qt, a.stateNode);
                  } catch (u) {
                    Et(
                      a,
                      e,
                      u
                    );
                  }
            } else
              He(
                t,
                e,
                a
              );
            break;
          case 18:
            se && Qt !== null && (he ? vh(
              Qt,
              a.stateNode
            ) : bh(Qt, a.stateNode));
            break;
          case 4:
            se ? (r = Qt, c = he, Qt = a.stateNode.containerInfo, he = !0, He(
              t,
              e,
              a
            ), Qt = r, he = c) : (Xe && nu(
              a.stateNode,
              a,
              Iu()
            ), He(
              t,
              e,
              a
            ));
            break;
          case 0:
          case 11:
          case 14:
          case 15:
            xn(2, a, e), Kt || xn(4, a, e), He(
              t,
              e,
              a
            );
            break;
          case 1:
            Kt || (Ve(a, e), r = a.stateNode, typeof r.componentWillUnmount == "function" && Pc(
              a,
              e,
              r
            )), He(
              t,
              e,
              a
            );
            break;
          case 21:
            He(
              t,
              e,
              a
            );
            break;
          case 22:
            Kt = (r = Kt) || a.memoizedState !== null, He(
              t,
              e,
              a
            ), Kt = r;
            break;
          default:
            He(
              t,
              e,
              a
            );
        }
      }
      function iu(t, e) {
        if (ce && e.memoizedState === null && (t = e.alternate, t !== null && (t = t.memoizedState, t !== null))) {
          t = t.dehydrated;
          try {
            mh(t);
          } catch (a) {
            Et(e, e.return, a);
          }
        }
      }
      function ou(t, e) {
        if (ce && e.memoizedState === null && (t = e.alternate, t !== null && (t = t.memoizedState, t !== null && (t = t.dehydrated, t !== null))))
          try {
            ph(t);
          } catch (a) {
            Et(e, e.return, a);
          }
      }
      function Gm(t) {
        switch (t.tag) {
          case 31:
          case 13:
          case 19:
            var e = t.stateNode;
            return e === null && (e = t.stateNode = new _d()), e;
          case 22:
            return t = t.stateNode, e = t._retryCache, e === null && (e = t._retryCache = new _d()), e;
          default:
            throw Error(o(435, t.tag));
        }
      }
      function $l(t, e) {
        var a = Gm(t);
        e.forEach(function(r) {
          if (!a.has(r)) {
            a.add(r);
            var c = Jm.bind(null, t, r);
            r.then(c, c);
          }
        });
      }
      function oe(t, e) {
        var a = e.deletions;
        if (a !== null)
          for (var r = 0; r < a.length; r++) {
            var c = a[r], u = t, g = e;
            if (se) {
              var C = g;
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
              Vi(u, g, c), Qt = null, he = !1;
            } else Vi(u, g, c);
            u = c.alternate, u !== null && (u.return = null), c.return = null;
          }
        if (e.subtreeFlags & 13886)
          for (e = e.child; e !== null; )
            su(e, t), e = e.sibling;
      }
      function su(t, e) {
        var a = t.alternate, r = t.flags;
        switch (t.tag) {
          case 0:
          case 11:
          case 14:
          case 15:
            oe(e, t), fe(t), r & 4 && (xn(3, t, t.return), Ia(3, t), xn(5, t, t.return));
            break;
          case 1:
            oe(e, t), fe(t), r & 512 && (Kt || a === null || Ve(a, a.return)), r & 64 && sn && (t = t.updateQueue, t !== null && (r = t.callbacks, r !== null && (a = t.shared.hiddenCallbacks, t.shared.hiddenCallbacks = a === null ? r : a.concat(r))));
            break;
          case 26:
            if (qe) {
              var c = Ye;
              if (oe(e, t), fe(t), r & 512 && (Kt || a === null || Ve(a, a.return)), r & 4) {
                r = a !== null ? a.memoizedState : null;
                var u = t.memoizedState;
                a === null ? u === null ? t.stateNode === null ? t.stateNode = Sh(
                  c,
                  t.type,
                  t.memoizedProps,
                  t
                ) : sd(
                  c,
                  t.type,
                  t.stateNode
                ) : t.stateNode = id(
                  c,
                  u,
                  t.memoizedProps
                ) : r !== u ? (r === null ? a.stateNode !== null && cd(a.stateNode) : od(r), u === null ? sd(
                  c,
                  t.type,
                  t.stateNode
                ) : id(
                  c,
                  u,
                  t.memoizedProps
                )) : u === null && t.stateNode !== null && Gi(
                  t,
                  t.memoizedProps,
                  a.memoizedProps
                );
              }
              break;
            }
          case 27:
            if (Vt) {
              oe(e, t), fe(t), r & 512 && (Kt || a === null || Ve(a, a.return)), a !== null && r & 4 && Gi(
                t,
                t.memoizedProps,
                a.memoizedProps
              );
              break;
            }
          case 5:
            if (oe(e, t), fe(t), r & 512 && (Kt || a === null || Ve(a, a.return)), se) {
              if (t.flags & 32) {
                c = t.stateNode;
                try {
                  Fu(c);
                } catch ($) {
                  Et(t, t.return, $);
                }
              }
              r & 4 && t.stateNode != null && (c = t.memoizedProps, Gi(
                t,
                c,
                a !== null ? a.memoizedProps : c
              )), r & 1024 && (Oo = !0);
            } else
              Xe && t.alternate !== null && (t.alternate.stateNode = t.stateNode);
            break;
          case 6:
            if (oe(e, t), fe(t), r & 4 && se) {
              if (t.stateNode === null)
                throw Error(o(162));
              r = t.memoizedProps, a = a !== null ? a.memoizedProps : r, c = t.stateNode;
              try {
                Ap(c, a, r);
              } catch ($) {
                Et(t, t.return, $);
              }
            }
            break;
          case 3:
            if (qe ? (Eh(), c = Ye, Ye = go(e.containerInfo), oe(e, t), Ye = c) : oe(e, t), fe(t), r & 4) {
              if (se && ce && a !== null && a.memoizedState.isDehydrated)
                try {
                  fh(e.containerInfo);
                } catch ($) {
                  Et(t, t.return, $);
                }
              if (Xe) {
                r = e.containerInfo, a = e.pendingChildren;
                try {
                  Pu(r, a);
                } catch ($) {
                  Et(t, t.return, $);
                }
              }
            }
            Oo && (Oo = !1, cu(t));
            break;
          case 4:
            qe ? (a = Ye, Ye = go(
              t.stateNode.containerInfo
            ), oe(e, t), fe(t), Ye = a) : (oe(e, t), fe(t)), r & 4 && Xe && nu(
              t.stateNode,
              t,
              t.stateNode.pendingChildren
            );
            break;
          case 12:
            oe(e, t), fe(t);
            break;
          case 31:
            oe(e, t), fe(t), r & 4 && (r = t.updateQueue, r !== null && (t.updateQueue = null, $l(t, r)));
            break;
          case 13:
            oe(e, t), fe(t), t.child.flags & 8192 && t.memoizedState !== null != (a !== null && a.memoizedState !== null) && (Er = pe()), r & 4 && (r = t.updateQueue, r !== null && (t.updateQueue = null, $l(t, r)));
            break;
          case 22:
            c = t.memoizedState !== null;
            var g = a !== null && a.memoizedState !== null, C = sn, G = Kt;
            if (sn = C || c, Kt = G || g, oe(e, t), Kt = G, sn = C, fe(t), r & 8192 && (e = t.stateNode, e._visibility = c ? e._visibility & -2 : e._visibility | 1, c && (a === null || g || sn || Kt || Zn(t)), se)) {
              t: if (a = null, se)
                for (e = t; ; ) {
                  if (e.tag === 5 || qe && e.tag === 26) {
                    if (a === null) {
                      g = a = e;
                      try {
                        u = g.stateNode, c ? Up(u) : Yp(
                          g.stateNode,
                          g.memoizedProps
                        );
                      } catch ($) {
                        Et(g, g.return, $);
                      }
                    }
                  } else if (e.tag === 6) {
                    if (a === null) {
                      g = e;
                      try {
                        var W = g.stateNode;
                        c ? qp(W) : Gp(W, g.memoizedProps);
                      } catch ($) {
                        Et(g, g.return, $);
                      }
                    }
                  } else if (e.tag === 18) {
                    if (a === null) {
                      g = e;
                      try {
                        var tt = g.stateNode;
                        c ? yh(tt) : xh(g.stateNode);
                      } catch ($) {
                        Et(g, g.return, $);
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
            oe(e, t), fe(t), r & 4 && (r = t.updateQueue, r !== null && (t.updateQueue = null, $l(t, r)));
            break;
          case 30:
            break;
          case 21:
            break;
          default:
            oe(e, t), fe(t);
        }
      }
      function fe(t) {
        var e = t.flags;
        if (e & 2) {
          try {
            for (var a, r = t.return; r !== null; ) {
              if (eu(r)) {
                a = r;
                break;
              }
              r = r.return;
            }
            if (se) {
              if (a == null) throw Error(o(160));
              switch (a.tag) {
                case 27:
                  if (Vt) {
                    var c = a.stateNode, u = Ki(t);
                    Il(t, u, c);
                    break;
                  }
                case 5:
                  var g = a.stateNode;
                  a.flags & 32 && (Fu(g), a.flags &= -33);
                  var C = Ki(t);
                  Il(t, C, g);
                  break;
                case 3:
                case 4:
                  var G = a.stateNode.containerInfo, W = Ki(t);
                  Qi(
                    t,
                    W,
                    G
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
      function cu(t) {
        if (t.subtreeFlags & 1024)
          for (t = t.child; t !== null; ) {
            var e = t;
            cu(e), e.tag === 5 && e.flags & 1024 && xp(e.stateNode), t = t.sibling;
          }
      }
      function tn(t, e) {
        if (e.subtreeFlags & 8772)
          for (e = e.child; e !== null; )
            lu(t, e.alternate, e), e = e.sibling;
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
              Ve(e, e.return);
              var a = e.stateNode;
              typeof a.componentWillUnmount == "function" && Pc(
                e,
                e.return,
                a
              ), Zn(e);
              break;
            case 27:
              Vt && fd(e.stateNode);
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
              ), Ia(4, u);
              break;
            case 1:
              if (en(
                c,
                u,
                a
              ), r = u, c = r.stateNode, typeof c.componentDidMount == "function")
                try {
                  c.componentDidMount();
                } catch (W) {
                  Et(r, r.return, W);
                }
              if (r = u, c = r.updateQueue, c !== null) {
                var C = r.stateNode;
                try {
                  var G = c.shared.hiddenCallbacks;
                  if (G !== null)
                    for (c.shared.hiddenCallbacks = null, c = 0; c < G.length; c++)
                      Vs(G[c], C);
                } catch (W) {
                  Et(r, r.return, W);
                }
              }
              a && g & 64 && $c(u), $a(u, u.return);
              break;
            case 27:
              Vt && au(u);
            case 26:
            case 5:
              en(
                c,
                u,
                a
              ), a && r === null && g & 4 && tu(u), $a(u, u.return);
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
              ), a && g & 4 && iu(c, u);
              break;
            case 13:
              en(
                c,
                u,
                a
              ), a && g & 4 && ou(c, u);
              break;
            case 22:
              u.memoizedState === null && en(
                c,
                u,
                a
              ), $a(u, u.return);
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
      function Xi(t, e) {
        var a = null;
        t !== null && t.memoizedState !== null && t.memoizedState.cachePool !== null && (a = t.memoizedState.cachePool.pool), t = null, e.memoizedState !== null && e.memoizedState.cachePool !== null && (t = e.memoizedState.cachePool.pool), t !== a && (t != null && t.refCount++, a != null && Ka(a));
      }
      function Li(t, e) {
        t = null, e.alternate !== null && (t = e.alternate.memoizedState.cache), e = e.memoizedState.cache, e !== t && (e.refCount++, t != null && Ka(t));
      }
      function Ue(t, e, a, r) {
        if (e.subtreeFlags & 10256)
          for (e = e.child; e !== null; )
            uu(
              t,
              e,
              a,
              r
            ), e = e.sibling;
      }
      function uu(t, e, a, r) {
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
                var u = e.memoizedProps, g = u.id, C = u.onPostCommit;
                typeof C == "function" && C(
                  g,
                  e.alternate === null ? "mount" : "update",
                  t.passiveEffectDuration,
                  -0
                );
              } catch (G) {
                Et(e, e.return, G);
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
            ), c & 2048 && Li(e.alternate, e);
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
          var u = t, g = e, C = a, G = r, W = g.flags;
          switch (g.tag) {
            case 0:
            case 11:
            case 15:
              ha(
                u,
                g,
                C,
                G,
                c
              ), Ia(8, g);
              break;
            case 23:
              break;
            case 22:
              var tt = g.stateNode;
              g.memoizedState !== null ? tt._visibility & 2 ? ha(
                u,
                g,
                C,
                G,
                c
              ) : Pa(
                u,
                g
              ) : (tt._visibility |= 2, ha(
                u,
                g,
                C,
                G,
                c
              )), c && W & 2048 && Xi(
                g.alternate,
                g
              );
              break;
            case 24:
              ha(
                u,
                g,
                C,
                G,
                c
              ), c && W & 2048 && Li(g.alternate, g);
              break;
            default:
              ha(
                u,
                g,
                C,
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
                Pa(a, r), c & 2048 && Xi(
                  r.alternate,
                  r
                );
                break;
              case 24:
                Pa(a, r), c & 2048 && Li(
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
            du(
              t,
              e,
              a
            ), t = t.sibling;
      }
      function du(t, e, a) {
        switch (t.tag) {
          case 26:
            if (Jn(
              t,
              e,
              a
            ), t.flags & Da)
              if (t.memoizedState !== null)
                Nh(
                  a,
                  Ye,
                  t.memoizedState,
                  t.memoizedProps
                );
              else {
                var r = t.stateNode, c = t.type;
                t = t.memoizedProps, ((e & 335544128) === e || mo(c, t)) && Wu(a, r, c, t);
              }
            break;
          case 5:
            Jn(
              t,
              e,
              a
            ), t.flags & Da && (r = t.stateNode, c = t.type, t = t.memoizedProps, ((e & 335544128) === e || mo(c, t)) && Wu(a, r, c, t));
            break;
          case 3:
          case 4:
            qe ? (r = Ye, Ye = go(
              t.stateNode.containerInfo
            ), Jn(
              t,
              e,
              a
            ), Ye = r) : Jn(
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
      function fu(t) {
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
              Wt = r, pu(
                r,
                t
              );
            }
          fu(t);
        }
        if (t.subtreeFlags & 10256)
          for (t = t.child; t !== null; )
            mu(t), t = t.sibling;
      }
      function mu(t) {
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
            for (var a = 0; a < e.length; a++) {
              var r = e[a];
              Wt = r, pu(
                r,
                t
              );
            }
          fu(t);
        }
        for (t = t.child; t !== null; ) {
          switch (e = t, e.tag) {
            case 0:
            case 11:
            case 15:
              xn(8, e, e.return), Pl(e);
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
      function pu(t, e) {
        for (; Wt !== null; ) {
          var a = Wt;
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
              Ka(a.memoizedState.cache);
          }
          if (r = a.child, r !== null) r.return = a, Wt = r;
          else
            t: for (a = t; Wt !== null; ) {
              r = Wt;
              var c = r.sibling, u = r.return;
              if (ru(r), r === a) {
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
        var e = dp(t);
        if (e != null) {
          if (typeof e.memoizedProps["data-testname"] != "string")
            throw Error(o(364));
          return e;
        }
        if (t = Sp(t), t === null) throw Error(o(362));
        return t.stateNode.current;
      }
      function Ji(t, e) {
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
                  for (; g != null && Ji(r, g); )
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
            if ((a === 5 || a === 26 || a === 27) && zp(t.stateNode, e.value))
              return !0;
            break;
          case kr:
            if ((a === 5 || a === 6 || a === 26 || a === 27) && (t = Ep(t), t !== null && 0 <= t.indexOf(e.value)))
              return !0;
            break;
          case Sr:
            if ((a === 5 || a === 26 || a === 27) && (t = t.memoizedProps["data-testname"], typeof t == "string" && t.toLowerCase() === e.value.toLowerCase()))
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
      function hu(t, e) {
        var a = [];
        t = [t, 0];
        for (var r = 0; r < t.length; ) {
          var c = t[r++], u = c.tag, g = t[r++], C = e[g];
          if (u !== 5 && u !== 26 && u !== 27 || !ll(c)) {
            for (; C != null && Ji(c, C); )
              g++, C = e[g];
            if (g === e.length) a.push(c);
            else
              for (c = c.child; c !== null; )
                t.push(c, g), c = c.sibling;
          }
        }
        return a;
      }
      function Fi(t, e) {
        if (!al) throw Error(o(363));
        t = Zi(t), t = hu(t, e), e = [], t = Array.from(t);
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
        return (xt & 2) !== 0 && _t !== 0 ? _t & -_t : dt.T !== null ? ri() : mp();
      }
      function gu() {
        if (Ee === 0)
          if ((_t & 536870912) === 0 || St) {
            var t = or;
            or <<= 1, (or & 3932160) === 0 && (or = 262144), Ee = t;
          } else Ee = 536870912;
        return t = Se.current, t !== null && (t.flags |= 32), Ee;
      }
      function me(t, e, a) {
        (t === At && (Ct === 2 || Ct === 9) || t.cancelPendingCommit !== null) && (ga(t, 0), wn(
          t,
          _t,
          Ee,
          !1
        )), D(t, a), ((xt & 2) === 0 || t !== At) && (t === At && ((xt & 2) === 0 && (la |= a), Ht === 4 && wn(
          t,
          _t,
          Ee,
          !1
        )), Qe(t));
      }
      function bu(t, e, a) {
        if ((xt & 6) !== 0) throw Error(o(327));
        var r = !a && (e & 127) === 0 && (e & t.expiredLanes) === 0 || B(t, e), c = r ? Vm(t, e) : $i(t, e, !0), u = r;
        do {
          if (c === 0) {
            Ba && !r && wn(t, e, 0, !1);
            break;
          } else {
            if (a = t.current.alternate, u && !Km(a)) {
              c = $i(t, e, !1), u = !1;
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
                  var G = ce && C.current.memoizedState.isDehydrated;
                  if (G && (ga(C, g).flags |= 256), g = $i(
                    C,
                    g,
                    !1
                  ), g !== 2) {
                    if (Ro && !G) {
                      C.errorRecoveryDisabledLanes |= u, la |= u, c = 4;
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
                ), N(r, 0, !0) !== 0) break t;
                un = e, r.timeoutHandle = cp(
                  vu.bind(
                    null,
                    r,
                    a,
                    ge,
                    zr,
                    Bo,
                    e,
                    Ee,
                    la,
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
              vu(
                r,
                a,
                ge,
                zr,
                Bo,
                e,
                Ee,
                la,
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
        Qe(t);
      }
      function vu(t, e, a, r, c, u, g, C, G, W, tt, $, nt, gt) {
        if (t.timeoutHandle = Fn, $ = e.subtreeFlags, $ & 8192 || ($ & 16785408) === 16785408) {
          $ = vp(), du(
            e,
            u,
            $
          );
          var ae = (u & 62914560) === u ? Er - pe() : (u & 4194048) === u ? Sd - pe() : 0;
          if (ae = yp(
            $,
            ae
          ), ae !== null) {
            un = u, t.cancelPendingCommit = ae(
              Nu.bind(
                null,
                t,
                e,
                u,
                a,
                r,
                c,
                g,
                C,
                G,
                tt,
                $,
                null,
                nt,
                gt
              )
            ), wn(t, u, g, !W);
            return;
          }
        }
        Nu(
          t,
          e,
          u,
          a,
          r,
          c,
          g,
          C,
          G
        );
      }
      function Km(t) {
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
      function wn(t, e, a, r) {
        e &= ~Do, e &= ~la, t.suspendedLanes |= e, t.pingedLanes &= ~e, r && (t.warmLanes |= e), r = t.expirationTimes;
        for (var c = e; 0 < c; ) {
          var u = 31 - xe(c), g = 1 << u;
          r[u] = -1, c &= ~g;
        }
        a !== 0 && b(t, a, e);
      }
      function yu() {
        return (xt & 6) === 0 ? (ma(0), !1) : !0;
      }
      function Ii() {
        if (wt !== null) {
          if (Ct === 0)
            var t = wt.return;
          else
            t = wt, rn = $n = null, vi(t), Ma = null, cl = 0, t = wt;
          for (; t !== null; )
            Ic(t.alternate, t), t = t.return;
          wt = null;
        }
      }
      function ga(t, e) {
        var a = t.timeoutHandle;
        a !== Fn && (t.timeoutHandle = Fn, up(a)), a = t.cancelPendingCommit, a !== null && (t.cancelPendingCommit = null, a()), un = 0, Ii(), At = t, wt = a = nn(t.current, null), _t = e, Ct = 0, ke = null, Tn = !1, Ba = B(t, e), Ro = !1, Ha = Ee = Do = la = Cn = Ht = 0, ge = ml = null, Bo = !1, (e & 8) !== 0 && (e |= e & 32);
        var r = t.entangledLanes;
        if (r !== 0)
          for (t = t.entanglements, r &= e; 0 < r; ) {
            var c = 31 - xe(r), u = 1 << c;
            e |= t[c], r &= ~u;
          }
        return cn = e, Dl(), a;
      }
      function xu(t, e) {
        bt = null, dt.H = dl, e === Ca || e === hr ? (e = Ys(), Ct = 3) : e === zo ? (e = Ys(), Ct = 4) : Ct = e === Ao ? 8 : e !== null && typeof e == "object" && typeof e.then == "function" ? 6 : 1, ke = e, wt === null && (Ht = 1, Xl(
          t,
          K(e, t.current)
        ));
      }
      function wu() {
        var t = Se.current;
        return t === null ? !0 : (_t & 4194048) === _t ? je === null : (_t & 62914560) === _t || (_t & 536870912) !== 0 ? t === je : !1;
      }
      function _u() {
        var t = dt.H;
        return dt.H = dl, t === null ? dl : t;
      }
      function Su() {
        var t = dt.A;
        return dt.A = Kh, t;
      }
      function tr() {
        Ht = 4, Tn || (_t & 4194048) !== _t && Se.current !== null || (Ba = !0), (Cn & 134217727) === 0 && (la & 134217727) === 0 || At === null || wn(
          At,
          _t,
          Ee,
          !1
        );
      }
      function $i(t, e, a) {
        var r = xt;
        xt |= 2;
        var c = _u(), u = Su();
        (At !== t || _t !== e) && (zr = null, ga(t, e)), e = !1;
        var g = Ht;
        t: do
          try {
            if (Ct !== 0 && wt !== null) {
              var C = wt, G = ke;
              switch (Ct) {
                case 8:
                  Ii(), g = 6;
                  break t;
                case 3:
                case 2:
                case 9:
                case 6:
                  Se.current === null && (e = !0);
                  var W = Ct;
                  if (Ct = 0, ke = null, ba(t, C, G, W), a && Ba) {
                    g = 0;
                    break t;
                  }
                  break;
                default:
                  W = Ct, Ct = 0, ke = null, ba(t, C, G, W);
              }
            }
            Qm(), g = Ht;
            break;
          } catch (tt) {
            xu(t, tt);
          }
        while (!0);
        return e && t.shellSuspendCounter++, rn = $n = null, xt = r, dt.H = c, dt.A = u, wt === null && (At = null, _t = 0, Dl()), g;
      }
      function Qm() {
        for (; wt !== null; ) ku(wt);
      }
      function Vm(t, e) {
        var a = xt;
        xt |= 2;
        var r = _u(), c = Su();
        At !== t || _t !== e ? (zr = null, pl = pe() + 500, ga(t, e)) : Ba = B(
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
                  if (Us(u)) {
                    Ct = 0, ke = null, Eu(e);
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
                  Us(u) ? (Ct = 0, ke = null, Eu(e)) : (Ct = 0, ke = null, ba(t, e, u, 7));
                  break;
                case 5:
                  var g = null;
                  switch (wt.tag) {
                    case 26:
                      g = wt.memoizedState;
                    case 5:
                    case 27:
                      var C = wt, G = C.type, W = C.pendingProps;
                      if (g ? ud(g) : Ju(C.stateNode, G, W)) {
                        Ct = 0, ke = null;
                        var tt = C.sibling;
                        if (tt !== null) wt = tt;
                        else {
                          var $ = C.return;
                          $ !== null ? (wt = $, er($)) : wt = null;
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
            Xm();
            break;
          } catch (nt) {
            xu(t, nt);
          }
        while (!0);
        return rn = $n = null, dt.H = r, dt.A = c, xt = a, wt !== null ? 0 : (At = null, _t = 0, Dl(), Ht);
      }
      function Xm() {
        for (; wt !== null && !Ah(); )
          ku(wt);
      }
      function ku(t) {
        var e = Lc(
          t.alternate,
          t,
          cn
        );
        t.memoizedProps = t.pendingProps, e === null ? er(t) : wt = e;
      }
      function Eu(t) {
        var e = t, a = e.alternate;
        switch (e.tag) {
          case 15:
          case 0:
            e = Yc(
              a,
              e,
              e.pendingProps,
              e.type,
              void 0,
              _t
            );
            break;
          case 11:
            e = Yc(
              a,
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
            Ic(a, e), e = wt = Du(e, cn), e = Lc(a, e, cn);
        }
        t.memoizedProps = t.pendingProps, e === null ? er(t) : wt = e;
      }
      function ba(t, e, a, r) {
        rn = $n = null, vi(e), Ma = null, cl = 0;
        var c = e.return;
        try {
          if (Dm(
            t,
            c,
            e,
            a,
            _t
          )) {
            Ht = 1, Xl(
              t,
              K(a, t.current)
            ), wt = null;
            return;
          }
        } catch (u) {
          if (c !== null) throw wt = c, u;
          Ht = 1, Xl(
            t,
            K(a, t.current)
          ), wt = null;
          return;
        }
        e.flags & 32768 ? (St || r === 1 ? t = !0 : Ba || (_t & 536870912) !== 0 ? t = !1 : (Tn = t = !0, (r === 2 || r === 9 || r === 3 || r === 6) && (r = Se.current, r !== null && r.tag === 13 && (r.flags |= 16384))), zu(e, t)) : er(e);
      }
      function er(t) {
        var e = t;
        do {
          if ((e.flags & 32768) !== 0) {
            zu(
              e,
              Tn
            );
            return;
          }
          t = e.return;
          var a = Um(
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
        Ht === 0 && (Ht = 5);
      }
      function zu(t, e) {
        do {
          var a = qm(t.alternate, t);
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
        Ht = 6, wt = null;
      }
      function Nu(t, e, a, r, c, u, g, C, G) {
        t.cancelPendingCommit = null;
        do
          el();
        while (Xt !== 0);
        if ((xt & 6) !== 0) throw Error(o(327));
        if (e !== null) {
          if (e === t.current)
            throw Error(o(177));
          if (u = e.lanes | e.childLanes, u |= No, h(
            t,
            a,
            u,
            g,
            C,
            G
          ), t === At && (wt = At = null, _t = 0), Ua = e, An = t, un = a, Ho = u, Uo = c, kd = r, (e.subtreeFlags & 10256) !== 0 || (e.flags & 10256) !== 0 ? (t.callbackNode = null, t.callbackPriority = 0, Wm(yo, function() {
            return ju(), null;
          })) : (t.callbackNode = null, t.callbackPriority = 0), r = (e.flags & 13878) !== 0, (e.subtreeFlags & 13878) !== 0 || r) {
            r = dt.T, dt.T = null, c = ln(), Jt(2), g = xt, xt |= 4;
            try {
              Ym(t, e, a);
            } finally {
              xt = g, Jt(c), dt.T = r;
            }
          }
          Xt = 1, Tu(), Cu(), Mu();
        }
      }
      function Tu() {
        if (Xt === 1) {
          Xt = 0;
          var t = An, e = Ua, a = (e.flags & 13878) !== 0;
          if ((e.subtreeFlags & 13878) !== 0 || a) {
            a = dt.T, dt.T = null;
            var r = ln();
            Jt(2);
            var c = xt;
            xt |= 4;
            try {
              su(e, t), op(t.containerInfo);
            } finally {
              xt = c, Jt(r), dt.T = a;
            }
          }
          t.current = e, Xt = 2;
        }
      }
      function Cu() {
        if (Xt === 2) {
          Xt = 0;
          var t = An, e = Ua, a = (e.flags & 8772) !== 0;
          if ((e.subtreeFlags & 8772) !== 0 || a) {
            a = dt.T, dt.T = null;
            var r = ln();
            Jt(2);
            var c = xt;
            xt |= 4;
            try {
              lu(t, e.alternate, e);
            } finally {
              xt = c, Jt(r), dt.T = a;
            }
          }
          Xt = 3;
        }
      }
      function Mu() {
        if (Xt === 4 || Xt === 3) {
          Xt = 0, jh();
          var t = An, e = Ua, a = un, r = kd;
          (e.subtreeFlags & 10256) !== 0 || (e.flags & 10256) !== 0 ? Xt = 5 : (Xt = 0, Ua = An = null, Au(t, t.pendingLanes));
          var c = t.pendingLanes;
          if (c === 0 && (Mn = null), M(a), e = e.stateNode, we && typeof we.onCommitFiberRoot == "function")
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
            e = dt.T, c = ln(), Jt(2), dt.T = null;
            try {
              for (var u = t.onRecoverableError, g = 0; g < r.length; g++) {
                var C = r[g];
                u(C.value, {
                  componentStack: C.stack
                });
              }
            } finally {
              dt.T = e, Jt(c);
            }
          }
          (un & 3) !== 0 && el(), Qe(t), c = t.pendingLanes, (a & 261930) !== 0 && (c & 42) !== 0 ? t === qo ? hl++ : (hl = 0, qo = t) : hl = 0, ce && gh(), ma(0);
        }
      }
      function Au(t, e) {
        (t.pooledCacheLanes &= e) === 0 && (e = t.pooledCache, e != null && (t.pooledCache = null, Ka(e)));
      }
      function el() {
        return Tu(), Cu(), Mu(), ju();
      }
      function ju() {
        if (Xt !== 5) return !1;
        var t = An, e = Ho;
        Ho = 0;
        var a = M(un), r = 32 > a ? 32 : a;
        a = dt.T;
        var c = ln();
        try {
          Jt(r), dt.T = null, r = Uo, Uo = null;
          var u = An, g = un;
          if (Xt = 0, Ua = An = null, un = 0, (xt & 6) !== 0)
            throw Error(o(331));
          var C = xt;
          if (xt |= 4, mu(u.current), uu(
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
          Jt(c), dt.T = a, Au(t, e);
        }
      }
      function Ou(t, e, a) {
        e = K(a, e), e = Mi(t.stateNode, e, 2), t = bn(t, e, 2), t !== null && (D(t, 2), Qe(t));
      }
      function Et(t, e, a) {
        if (t.tag === 3)
          Ou(t, t, a);
        else
          for (; e !== null; ) {
            if (e.tag === 3) {
              Ou(
                e,
                t,
                a
              );
              break;
            } else if (e.tag === 1) {
              var r = e.stateNode;
              if (typeof e.type.getDerivedStateFromError == "function" || typeof r.componentDidCatch == "function" && (Mn === null || !Mn.has(r))) {
                t = K(a, t), a = jc(2), r = bn(e, a, 2), r !== null && (Oc(
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
      function Pi(t, e, a) {
        var r = t.pingCache;
        if (r === null) {
          r = t.pingCache = new Qh();
          var c = /* @__PURE__ */ new Set();
          r.set(e, c);
        } else
          c = r.get(e), c === void 0 && (c = /* @__PURE__ */ new Set(), r.set(e, c));
        c.has(a) || (Ro = !0, c.add(a), t = Lm.bind(null, t, e, a), e.then(t, t));
      }
      function Lm(t, e, a) {
        var r = t.pingCache;
        r !== null && r.delete(e), t.pingedLanes |= t.suspendedLanes & a, t.warmLanes &= ~a, At === t && (_t & a) === a && (Ht === 4 || Ht === 3 && (_t & 62914560) === _t && 300 > pe() - Er ? (xt & 2) === 0 && ga(t, 0) : Do |= a, Ha === _t && (Ha = 0)), Qe(t);
      }
      function Ru(t, e) {
        e === 0 && (e = Z()), t = Xn(t, e), t !== null && (D(t, e), Qe(t));
      }
      function Zm(t) {
        var e = t.memoizedState, a = 0;
        e !== null && (a = e.retryLane), Ru(t, a);
      }
      function Jm(t, e) {
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
            throw Error(o(314));
        }
        r !== null && r.delete(e), Ru(t, a);
      }
      function Wm(t, e) {
        return cr(t, e);
      }
      function Fm(t, e, a, r) {
        this.tag = t, this.key = a, this.sibling = this.child = this.return = this.stateNode = this.type = this.elementType = null, this.index = 0, this.refCleanup = this.ref = null, this.pendingProps = e, this.dependencies = this.memoizedState = this.updateQueue = this.memoizedProps = null, this.mode = r, this.subtreeFlags = this.flags = 0, this.deletions = null, this.childLanes = this.lanes = 0, this.alternate = null;
      }
      function to(t) {
        return t = t.prototype, !(!t || !t.isReactComponent);
      }
      function nn(t, e) {
        var a = t.alternate;
        return a === null ? (a = s(
          t.tag,
          e,
          t.key,
          t.mode
        ), a.elementType = t.elementType, a.type = t.type, a.stateNode = t.stateNode, a.alternate = t, t.alternate = a) : (a.pendingProps = e, a.type = t.type, a.flags = 0, a.subtreeFlags = 0, a.deletions = null), a.flags = t.flags & 65011712, a.childLanes = t.childLanes, a.lanes = t.lanes, a.child = t.child, a.memoizedProps = t.memoizedProps, a.memoizedState = t.memoizedState, a.updateQueue = t.updateQueue, e = t.dependencies, a.dependencies = e === null ? null : {
          lanes: e.lanes,
          firstContext: e.firstContext
        }, a.sibling = t.sibling, a.index = t.index, a.ref = t.ref, a.refCleanup = t.refCleanup, a;
      }
      function Du(t, e) {
        t.flags &= 65011714;
        var a = t.alternate;
        return a === null ? (t.childLanes = 0, t.lanes = e, t.child = null, t.subtreeFlags = 0, t.memoizedProps = null, t.memoizedState = null, t.updateQueue = null, t.dependencies = null, t.stateNode = null) : (t.childLanes = a.childLanes, t.lanes = a.lanes, t.child = a.child, t.subtreeFlags = 0, t.deletions = null, t.memoizedProps = a.memoizedProps, t.memoizedState = a.memoizedState, t.updateQueue = a.updateQueue, t.type = a.type, e = a.dependencies, t.dependencies = e === null ? null : {
          lanes: e.lanes,
          firstContext: e.firstContext
        }), t;
      }
      function nr(t, e, a, r, c, u) {
        var g = 0;
        if (r = t, typeof t == "function") to(t) && (g = 1);
        else if (typeof t == "string")
          g = qe && Vt ? ld(t, a, ee.current) ? 26 : md(t) ? 27 : 5 : qe ? ld(
            t,
            a,
            ee.current
          ) ? 26 : 5 : Vt && md(t) ? 27 : 5;
        else
          t: switch (t) {
            case uo:
              return t = s(31, a, e, c), t.elementType = uo, t.lanes = u, t;
            case ya:
              return Wn(
                a.children,
                c,
                u,
                e
              );
            case Ku:
              g = 8, c |= 24;
              break;
            case ro:
              return t = s(12, a, e, c | 2), t.elementType = ro, t.lanes = u, t;
            case oo:
              return t = s(13, a, e, c), t.elementType = oo, t.lanes = u, t;
            case so:
              return t = s(19, a, e, c), t.elementType = so, t.lanes = u, t;
            default:
              if (typeof t == "object" && t !== null)
                switch (t.$$typeof) {
                  case _n:
                    g = 10;
                    break t;
                  case Qu:
                    g = 9;
                    break t;
                  case io:
                    g = 11;
                    break t;
                  case co:
                    g = 14;
                    break t;
                  case Sn:
                    g = 16, r = null;
                    break t;
                }
              g = 29, a = Error(
                o(
                  130,
                  t === null ? "null" : typeof t,
                  ""
                )
              ), r = null;
          }
        return e = s(g, a, e, c), e.elementType = t, e.type = r, e.lanes = u, e;
      }
      function Wn(t, e, a, r) {
        return t = s(7, t, r, e), t.lanes = a, t;
      }
      function eo(t, e, a) {
        return t = s(6, t, null, e), t.lanes = a, t;
      }
      function Bu(t) {
        var e = s(18, null, null, 0);
        return e.stateNode = t, e;
      }
      function no(t, e, a) {
        return e = s(
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
      function Im(t, e, a, r, c, u, g, C, G) {
        this.tag = 1, this.containerInfo = t, this.pingCache = this.current = this.pendingChildren = null, this.timeoutHandle = Fn, this.callbackNode = this.next = this.pendingContext = this.context = this.cancelPendingCommit = null, this.callbackPriority = 0, this.expirationTimes = q(-1), this.entangledLanes = this.shellSuspendCounter = this.errorRecoveryDisabledLanes = this.expiredLanes = this.warmLanes = this.pingedLanes = this.suspendedLanes = this.pendingLanes = 0, this.entanglements = q(0), this.hiddenUpdates = q(null), this.identifierPrefix = r, this.onUncaughtError = c, this.onCaughtError = u, this.onRecoverableError = g, this.pooledCache = null, this.pooledCacheLanes = 0, this.formState = G, this.incompleteTransitions = /* @__PURE__ */ new Map();
      }
      function Hu(t, e, a, r, c, u, g, C, G, W, tt, $) {
        return t = new Im(
          t,
          e,
          a,
          g,
          G,
          W,
          tt,
          $,
          C
        ), e = 1, u === !0 && (e |= 24), u = s(3, null, null, e), t.current = u, u.stateNode = t, e = li(), e.refCount++, t.pooledCache = e, e.refCount++, u.memoizedState = {
          element: r,
          isDehydrated: a,
          cache: e
        }, si(u), t;
      }
      function Uu(t) {
        return t ? (t = Sa, t) : Sa;
      }
      function qu(t) {
        var e = t._reactInternals;
        if (e === void 0)
          throw typeof t.render == "function" ? Error(o(188)) : (t = Object.keys(t).join(","), Error(o(268, t)));
        return t = f(e), t = t !== null ? p(t) : null, t === null ? null : nl(t.stateNode);
      }
      function Yu(t, e, a, r, c, u) {
        c = Uu(c), r.context === null ? r.context = c : r.pendingContext = c, r = gn(e), r.payload = { element: a }, u = u === void 0 ? null : u, u !== null && (r.callback = u), a = bn(t, r, e), a !== null && (me(a, t, e), Va(a, t, e));
      }
      function Gu(t, e) {
        if (t = t.memoizedState, t !== null && t.dehydrated !== null) {
          var a = t.retryLane;
          t.retryLane = a !== 0 && a < e ? a : e;
        }
      }
      function ao(t, e) {
        Gu(t, e), (t = t.alternate) && Gu(t, e);
      }
      var yt = {}, $m = b0, ye = y0(), lo = Object.assign, Pm = Symbol.for("react.element"), ar = Symbol.for("react.transitional.element"), va = Symbol.for("react.portal"), ya = Symbol.for("react.fragment"), Ku = Symbol.for("react.strict_mode"), ro = Symbol.for("react.profiler"), Qu = Symbol.for("react.consumer"), _n = Symbol.for("react.context"), io = Symbol.for("react.forward_ref"), oo = Symbol.for("react.suspense"), so = Symbol.for("react.suspense_list"), co = Symbol.for("react.memo"), Sn = Symbol.for("react.lazy"), uo = Symbol.for("react.activity"), tp = Symbol.for("react.memo_cache_sentinel"), Vu = Symbol.iterator, ep = Symbol.for("react.client.reference"), lr = Array.isArray, dt = $m.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE, np = l.rendererVersion, ap = l.rendererPackageName, Xu = l.extraDevToolsConfig, nl = l.getPublicInstance, lp = l.getRootHostContext, rp = l.getChildHostContext, ip = l.prepareForCommit, op = l.resetAfterCommit, sp = l.createInstance;
      l.cloneMutableInstance;
      var fo = l.appendInitialChild, Lu = l.finalizeInitialChildren, rr = l.shouldSetTextContent, Zu = l.createTextInstance;
      l.cloneMutableTextInstance;
      var cp = l.scheduleTimeout, up = l.cancelTimeout, Fn = l.noTimeout, an = l.isPrimaryRenderer;
      l.warnsIfNotActing;
      var se = l.supportsMutation, Xe = l.supportsPersistence, ce = l.supportsHydration, dp = l.getInstanceFromNode;
      l.beforeActiveInstanceBlur;
      var fp = l.preparePortalMount;
      l.prepareScopeUpdate, l.getInstanceFromScope;
      var Jt = l.setCurrentUpdatePriority, ln = l.getCurrentUpdatePriority, mp = l.resolveUpdatePriority;
      l.trackSchedulerEvent, l.resolveEventType, l.resolveEventTimeStamp;
      var pp = l.shouldAttemptEagerTransition, hp = l.detachDeletedInstance;
      l.requestPostPaintCallback;
      var gp = l.maySuspendCommit, bp = l.maySuspendCommitOnUpdate, mo = l.maySuspendCommitInSyncRender, Ju = l.preloadInstance, vp = l.startSuspendingCommit, Wu = l.suspendInstance;
      l.suspendOnActiveViewTransition;
      var yp = l.waitForCommitToBeReady;
      l.getSuspendedCommitReason;
      var xa = l.NotPendingTransition, In = l.HostTransitionContext, xp = l.resetFormInstance;
      l.bindToConsole;
      var wp = l.supportsMicrotasks, _p = l.scheduleMicrotask, al = l.supportsTestSelectors, Sp = l.findFiberRoot, kp = l.getBoundingRect, Ep = l.getTextContent, ll = l.isHiddenSubtree, zp = l.matchAccessibilityRole, Np = l.setFocusIfFocusable, Tp = l.setupIntersectionObserver, Cp = l.appendChild, Mp = l.appendChildToContainer, Ap = l.commitTextUpdate, jp = l.commitMount, Op = l.commitUpdate, Rp = l.insertBefore, Dp = l.insertInContainerBefore, Bp = l.removeChild, Hp = l.removeChildFromContainer, Fu = l.resetTextContent, Up = l.hideInstance, qp = l.hideTextInstance, Yp = l.unhideInstance, Gp = l.unhideTextInstance;
      l.cancelViewTransitionName, l.cancelRootViewTransitionName, l.restoreRootViewTransitionName, l.cloneRootViewTransitionContainer, l.removeRootViewTransitionClone, l.measureClonedInstance, l.hasInstanceChanged, l.hasInstanceAffectedParent, l.startViewTransition, l.startGestureTransition, l.stopViewTransition, l.getCurrentGestureOffset, l.createViewTransitionInstance;
      var Kp = l.clearContainer;
      l.createFragmentInstance, l.updateFragmentInstanceFiber, l.commitNewChildToFragmentInstance, l.deleteChildFromFragmentInstance;
      var Qp = l.cloneInstance, Iu = l.createContainerChildSet, $u = l.appendChildToContainerChildSet, Vp = l.finalizeContainerChildren, Pu = l.replaceContainerChildren, td = l.cloneHiddenInstance, ed = l.cloneHiddenTextInstance, po = l.isSuspenseInstancePending, ho = l.isSuspenseInstanceFallback, Xp = l.getSuspenseInstanceFallbackErrorDetails, Lp = l.registerSuspenseInstanceRetry, Zp = l.canHydrateFormStateMarker, Jp = l.isFormStateMarkerMatching, nd = l.getNextHydratableSibling, Wp = l.getNextHydratableSiblingAfterSingleton, Fp = l.getFirstHydratableChild, Ip = l.getFirstHydratableChildWithinContainer, $p = l.getFirstHydratableChildWithinActivityInstance, Pp = l.getFirstHydratableChildWithinSuspenseInstance, th = l.getFirstHydratableChildWithinSingleton, eh = l.canHydrateInstance, nh = l.canHydrateTextInstance, ah = l.canHydrateActivityInstance, lh = l.canHydrateSuspenseInstance, rh = l.hydrateInstance, ih = l.hydrateTextInstance, oh = l.hydrateActivityInstance, sh = l.hydrateSuspenseInstance, ch = l.getNextHydratableInstanceAfterActivityInstance, uh = l.getNextHydratableInstanceAfterSuspenseInstance, dh = l.commitHydratedInstance, fh = l.commitHydratedContainer, mh = l.commitHydratedActivityInstance, ph = l.commitHydratedSuspenseInstance, hh = l.finalizeHydratedChildren, gh = l.flushHydrationEvents;
      l.clearActivityBoundary;
      var bh = l.clearSuspenseBoundary;
      l.clearActivityBoundaryFromContainer;
      var vh = l.clearSuspenseBoundaryFromContainer, yh = l.hideDehydratedBoundary, xh = l.unhideDehydratedBoundary, ad = l.shouldDeleteUnhydratedTailInstances;
      l.diffHydratedPropsForDevWarnings, l.diffHydratedTextForDevWarnings, l.describeHydratableInstanceForDevWarnings;
      var wh = l.validateHydratableInstance, _h = l.validateHydratableTextInstance, qe = l.supportsResources, ld = l.isHostHoistableType, go = l.getHoistableRoot, rd = l.getResource, id = l.acquireResource, od = l.releaseResource, Sh = l.hydrateHoistable, sd = l.mountHoistable, cd = l.unmountHoistable, kh = l.createHoistableInstance, Eh = l.prepareToCommitHoistables, zh = l.mayResourceSuspendCommit, ud = l.preloadResource, Nh = l.suspendResource, Vt = l.supportsSingletons, dd = l.resolveSingletonInstance, Th = l.acquireSingletonInstance, fd = l.releaseSingletonInstance, md = l.isHostSingletonType, wa = l.isSingletonScope, bo = [], _a = -1, Sa = {}, xe = Math.clz32 ? Math.clz32 : w, Ch = Math.log, Mh = Math.LN2, ir = 256, or = 262144, sr = 4194304, cr = ye.unstable_scheduleCallback, vo = ye.unstable_cancelCallback, Ah = ye.unstable_shouldYield, jh = ye.unstable_requestPaint, pe = ye.unstable_now, pd = ye.unstable_ImmediatePriority, Oh = ye.unstable_UserBlockingPriority, yo = ye.unstable_NormalPriority, Rh = ye.unstable_IdlePriority, Dh = ye.log, Bh = ye.unstable_setDisableYieldValue, rl = null, we = null, _e = typeof Object.is == "function" ? Object.is : L, hd = typeof reportError == "function" ? reportError : function(t) {
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
      }, Hh = Object.prototype.hasOwnProperty, xo, gd, wo = !1, bd = /* @__PURE__ */ new WeakMap(), ka = [], Ea = 0, ur = null, il = 0, Te = [], Ce = 0, kn = null, Le = 1, Ze = "", ee = x(null), ol = x(null), En = x(null), dr = x(null), ne = null, Ot = null, St = !1, zn = null, Me = !1, _o = Error(o(519)), fr = x(null), $n = null, rn = null, Uh = typeof AbortController < "u" ? AbortController : function() {
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
      }, qh = ye.unstable_scheduleCallback, Yh = ye.unstable_NormalPriority, Rt = {
        $$typeof: _n,
        Consumer: null,
        Provider: null,
        _currentValue: null,
        _currentValue2: null,
        _threadCount: 0
      }, mr = null, za = null, So = !1, pr = !1, ko = !1, Pn = 0, sl = null, Eo = 0, Na = 0, Ta = null, vd = dt.S;
      dt.S = function(t, e) {
        Sd = pe(), typeof e == "object" && e !== null && typeof e.then == "function" && Nm(t, e), vd !== null && vd(t, e);
      };
      var ta = x(null), Ca = Error(o(460)), zo = Error(o(474)), hr = Error(o(542)), gr = { then: function() {
      } }, ea = null, Ma = null, cl = 0, na = Ks(!0), yd = Ks(!1), Ae = [], Aa = 0, No = 0, Nn = !1, To = !1, ja = x(null), br = x(0), Se = x(null), je = null, qt = x(0), on = 0, bt = null, Mt = null, Yt = null, vr = !1, Oa = !1, aa = !1, yr = 0, ul = 0, Ra = null, Gh = 0, dl = {
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
      var xd = {
        readContext: Pt,
        use: Yl,
        useCallback: function(t, e) {
          return de().memoizedState = [
            t,
            e === void 0 ? null : e
          ], t;
        },
        useContext: Pt,
        useEffect: mc,
        useImperativeHandle: function(t, e, a) {
          a = a != null ? a.concat([t]) : null, Kl(
            4194308,
            4,
            bc.bind(null, e, t),
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
          if (aa) {
            U(!0);
            try {
              t();
            } finally {
              U(!1);
            }
          }
          return a.memoizedState = [r, e], r;
        },
        useReducer: function(t, e, a) {
          var r = de();
          if (a !== void 0) {
            var c = a(e);
            if (aa) {
              U(!0);
              try {
                a(e);
              } finally {
                U(!1);
              }
            }
          } else c = e;
          return r.memoizedState = r.baseState = c, t = {
            pending: null,
            lanes: 0,
            dispatch: null,
            lastRenderedReducer: t,
            lastRenderedState: c
          }, r.queue = t, t = t.dispatch = Rm.bind(
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
          var e = t.queue, a = zc.bind(
            null,
            bt,
            e
          );
          return e.dispatch = a, [t.memoizedState, a];
        },
        useDebugValue: Ei,
        useDeferredValue: function(t, e) {
          var a = de();
          return zi(a, t, e);
        },
        useTransition: function() {
          var t = _i(!1);
          return t = _c.bind(
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
              throw Error(o(407));
            a = a();
          } else {
            if (a = e(), At === null)
              throw Error(o(349));
            (_t & 127) !== 0 || Is(r, e, a);
          }
          c.memoizedState = a;
          var u = { value: a, getSnapshot: e };
          return c.queue = u, mc(Ps.bind(null, r, u, t), [
            t
          ]), r.flags |= 2048, pa(
            9,
            { destroy: void 0 },
            $s.bind(
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
            var a = Ze, r = Le;
            a = (r & ~(1 << 32 - xe(r) - 1)).toString(32) + a, e = "_" + e + "R_" + a, a = yr++, 0 < a && (e += "H" + a.toString(32)), e += "_";
          } else
            a = Gh++, e = "_" + e + "r_" + a.toString(32) + "_";
          return t.memoizedState = e;
        },
        useHostTransitionStatus: Ni,
        useFormState: sc,
        useActionState: sc,
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
          return e.queue = a, e = Ti.bind(
            null,
            bt,
            !0,
            a
          ), a.dispatch = e, [t, e];
        },
        useMemoCache: yi,
        useCacheRefresh: function() {
          return de().memoizedState = Om.bind(
            null,
            bt
          );
        },
        useEffectEvent: function(t) {
          var e = de(), a = { impl: t };
          return e.memoizedState = a, function() {
            if ((xt & 2) !== 0)
              throw Error(o(440));
            return a.impl.apply(void 0, arguments);
          };
        }
      }, Co = {
        readContext: Pt,
        use: Yl,
        useCallback: yc,
        useContext: Pt,
        useEffect: ki,
        useImperativeHandle: vc,
        useInsertionEffect: hc,
        useLayoutEffect: gc,
        useMemo: xc,
        useReducer: Gl,
        useRef: fc,
        useState: function() {
          return Gl($e);
        },
        useDebugValue: Ei,
        useDeferredValue: function(t, e) {
          var a = Ut();
          return wc(
            a,
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
        useSyncExternalStore: Fs,
        useId: kc,
        useHostTransitionStatus: Ni,
        useFormState: cc,
        useActionState: cc,
        useOptimistic: function(t, e) {
          var a = Ut();
          return nc(a, Mt, t, e);
        },
        useMemoCache: yi,
        useCacheRefresh: Ec
      };
      Co.useEffectEvent = pc;
      var wd = {
        readContext: Pt,
        use: Yl,
        useCallback: yc,
        useContext: Pt,
        useEffect: ki,
        useImperativeHandle: vc,
        useInsertionEffect: hc,
        useLayoutEffect: gc,
        useMemo: xc,
        useReducer: wi,
        useRef: fc,
        useState: function() {
          return wi($e);
        },
        useDebugValue: Ei,
        useDeferredValue: function(t, e) {
          var a = Ut();
          return Mt === null ? zi(a, t, e) : wc(
            a,
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
        useSyncExternalStore: Fs,
        useId: kc,
        useHostTransitionStatus: Ni,
        useFormState: dc,
        useActionState: dc,
        useOptimistic: function(t, e) {
          var a = Ut();
          return Mt !== null ? nc(a, Mt, t, e) : (a.baseState = t, [t, a.queue.dispatch]);
        },
        useMemoCache: yi,
        useCacheRefresh: Ec
      };
      wd.useEffectEvent = pc;
      var Mo = {
        enqueueSetState: function(t, e, a) {
          t = t._reactInternals;
          var r = ve(), c = gn(r);
          c.payload = e, a != null && (c.callback = a), e = bn(t, c, r), e !== null && (me(e, t, r), Va(e, t, r));
        },
        enqueueReplaceState: function(t, e, a) {
          t = t._reactInternals;
          var r = ve(), c = gn(r);
          c.tag = 1, c.payload = e, a != null && (c.callback = a), e = bn(t, c, r), e !== null && (me(e, t, r), Va(e, t, r));
        },
        enqueueForceUpdate: function(t, e) {
          t = t._reactInternals;
          var a = ve(), r = gn(a);
          r.tag = 2, e != null && (r.callback = e), e = bn(t, r, a), e !== null && (me(e, t, a), Va(e, t, a));
        }
      }, Ao = Error(o(461)), Gt = !1, jo = {
        dehydrated: null,
        treeContext: null,
        retryLane: 0,
        hydrationErrors: null
      }, sn = !1, Kt = !1, Oo = !1, _d = typeof WeakSet == "function" ? WeakSet : Set, Wt = null, Qt = null, he = !1, Ye = null, Da = 8192, Kh = {
        getCacheForType: function(t) {
          var e = Pt(Rt), a = e.data.get(t);
          return a === void 0 && (a = t(), e.data.set(t, a)), a;
        },
        cacheSignal: function() {
          return Pt(Rt).controller.signal;
        }
      }, xr = 0, wr = 1, _r = 2, Sr = 3, kr = 4;
      if (typeof Symbol == "function" && Symbol.for) {
        var fl = Symbol.for;
        xr = fl("selector.component"), wr = fl("selector.has_pseudo_class"), _r = fl("selector.role"), Sr = fl("selector.test_id"), kr = fl("selector.text");
      }
      var Qh = typeof WeakMap == "function" ? WeakMap : Map, xt = 0, At = null, wt = null, _t = 0, Ct = 0, ke = null, Tn = !1, Ba = !1, Ro = !1, cn = 0, Ht = 0, Cn = 0, la = 0, Do = 0, Ee = 0, Ha = 0, ml = null, ge = null, Bo = !1, Er = 0, Sd = 0, pl = 1 / 0, zr = null, Mn = null, Xt = 0, An = null, Ua = null, un = 0, Ho = 0, Uo = null, kd = null, hl = 0, qo = null;
      return yt.attemptContinuousHydration = function(t) {
        if (t.tag === 13 || t.tag === 31) {
          var e = Xn(t, 67108864);
          e !== null && me(e, t, 67108864), ao(t, 67108864);
        }
      }, yt.attemptHydrationAtCurrentPriority = function(t) {
        if (t.tag === 13 || t.tag === 31) {
          var e = ve();
          e = O(e);
          var a = Xn(t, e);
          a !== null && me(a, t, e), ao(t, e);
        }
      }, yt.attemptSynchronousHydration = function(t) {
        switch (t.tag) {
          case 3:
            if (t = t.stateNode, t.current.memoizedState.isDehydrated) {
              var e = _(t.pendingLanes);
              if (e !== 0) {
                for (t.pendingLanes |= 2, t.entangledLanes |= 2; e; ) {
                  var a = 1 << 31 - xe(e);
                  t.entanglements[1] |= a, e &= ~a;
                }
                Qe(t), (xt & 6) === 0 && (pl = pe() + 500, ma(0));
              }
            }
            break;
          case 31:
          case 13:
            e = Xn(t, 2), e !== null && me(e, t, 2), yu(), ao(t, 2);
        }
      }, yt.batchedUpdates = function(t, e) {
        return t(e);
      }, yt.createComponentSelector = function(t) {
        return { $$typeof: xr, value: t };
      }, yt.createContainer = function(t, e, a, r, c, u, g, C, G, W) {
        return Hu(
          t,
          e,
          !1,
          null,
          a,
          r,
          u,
          null,
          g,
          C,
          G,
          W
        );
      }, yt.createHasPseudoClassSelector = function(t) {
        return { $$typeof: wr, value: t };
      }, yt.createHydrationContainer = function(t, e, a, r, c, u, g, C, G, W, tt, $, nt, gt) {
        return t = Hu(
          a,
          r,
          !0,
          t,
          c,
          u,
          C,
          gt,
          G,
          W,
          tt,
          $
        ), t.context = Uu(null), a = t.current, r = ve(), r = O(r), c = gn(r), c.callback = e ?? null, bn(a, c, r), e = r, t.current.lanes = e, D(t, e), Qe(t), t;
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
        hd(t);
      }, yt.defaultOnUncaughtError = function(t) {
        hd(t);
      }, yt.deferredUpdates = function(t) {
        var e = dt.T, a = ln();
        try {
          return Jt(32), dt.T = null, t();
        } finally {
          Jt(a), dt.T = e;
        }
      }, yt.discreteUpdates = function(t, e, a, r, c) {
        var u = dt.T, g = ln();
        try {
          return Jt(2), dt.T = null, t(e, a, r, c);
        } finally {
          Jt(g), dt.T = u, xt === 0 && (pl = pe() + 500);
        }
      }, yt.findAllNodes = Fi, yt.findBoundingRects = function(t, e) {
        if (!al) throw Error(o(363));
        e = Fi(t, e), t = [];
        for (var a = 0; a < e.length; a++)
          t.push(kp(e[a]));
        for (e = t.length - 1; 0 < e; e--) {
          a = t[e];
          for (var r = a.x, c = r + a.width, u = a.y, g = u + a.height, C = e - 1; 0 <= C; C--)
            if (e !== C) {
              var G = t[C], W = G.x, tt = W + G.width, $ = G.y, nt = $ + G.height;
              if (r >= W && u >= $ && c <= tt && g <= nt) {
                t.splice(e, 1);
                break;
              } else if (r !== W || a.width !== G.width || nt < u || $ > g) {
                if (!(u !== $ || a.height !== G.height || tt < r || W > c)) {
                  W > r && (G.width += W - r, G.x = r), tt < c && (G.width = c - W), t.splice(e, 1);
                  break;
                }
              } else {
                $ > u && (G.height += $ - u, G.y = u), nt < g && (G.height = g - $), t.splice(e, 1);
                break;
              }
            }
        }
        return t;
      }, yt.findHostInstance = qu, yt.findHostInstanceWithNoPortals = function(t) {
        return t = f(t), t = t !== null ? v(t) : null, t === null ? null : nl(t.stateNode);
      }, yt.findHostInstanceWithWarning = function(t) {
        return qu(t);
      }, yt.flushPassiveEffects = el, yt.flushSyncFromReconciler = function(t) {
        var e = xt;
        xt |= 1;
        var a = dt.T, r = ln();
        try {
          if (Jt(2), dt.T = null, t)
            return t();
        } finally {
          Jt(r), dt.T = a, xt = e, (xt & 6) === 0 && ma(0);
        }
      }, yt.flushSyncWork = yu, yt.focusWithin = function(t, e) {
        if (!al) throw Error(o(363));
        for (t = Zi(t), e = hu(t, e), e = Array.from(e), t = 0; t < e.length; ) {
          var a = e[t++], r = a.tag;
          if (!ll(a)) {
            if ((r === 5 || r === 26 || r === 27) && Np(a.stateNode))
              return !0;
            for (a = a.child; a !== null; )
              e.push(a), a = a.sibling;
          }
        }
        return !1;
      }, yt.getFindAllNodesFailureDescription = function(t, e) {
        if (!al) throw Error(o(363));
        var a = 0, r = [];
        t = [Zi(t), 0];
        for (var c = 0; c < t.length; ) {
          var u = t[c++], g = u.tag, C = t[c++], G = e[C];
          if ((g !== 5 && g !== 26 && g !== 27 || !ll(u)) && (Ji(u, G) && (r.push(Wi(G)), C++, C > a && (a = C)), C < e.length))
            for (u = u.child; u !== null; )
              t.push(u, C), u = u.sibling;
        }
        if (a < e.length) {
          for (t = []; a < e.length; a++)
            t.push(Wi(e[a]));
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
          version: np,
          rendererPackageName: ap,
          currentDispatcherRef: dt,
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
        if (!al) throw Error(o(363));
        t = Fi(t, e);
        var c = Tp(
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
        if (t.tag !== 5) throw Error(o(476));
        var c = Sc(t).queue;
        _c(
          t,
          c,
          e,
          xa,
          a === null ? i : function() {
            var u = Sc(t);
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
        return Yu(
          c,
          u,
          t,
          e,
          a,
          r
        ), u;
      }, yt.updateContainerSync = function(t, e, a, r) {
        return Yu(
          e.current,
          2,
          t,
          e,
          a,
          r
        ), 2;
      }, yt;
    }, n.exports.default = n.exports, Object.defineProperty(n.exports, "__esModule", { value: !0 });
  })(Qo)), Qo.exports;
}
var Hd;
function w0() {
  return Hd || (Hd = 1, Ko.exports = x0()), Ko.exports;
}
var _0 = w0();
const S0 = /* @__PURE__ */ ys(_0);
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
var Ud;
function k0() {
  return Ud || (Ud = 1, dn.ConcurrentRoot = 1, dn.ContinuousEventPriority = 8, dn.DefaultEventPriority = 32, dn.DiscreteEventPriority = 2, dn.IdleEventPriority = 268435456, dn.LegacyRoot = 0, dn.NoEventPriority = 0), dn;
}
var qd;
function E0() {
  return qd || (qd = 1, Lo.exports = k0()), Lo.exports;
}
var El = E0();
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
const Cf = ["accent", "panel-bg", "surface-0", "surface-1", "surface-dim", "overlay-0", "overlay-1", "text", "subtext-0", "mauve", "green", "yellow", "red", "blue", "teal", "peach", "backdrop", "card-bg"], ns = 16, Mf = /* @__PURE__ */ new Set(["hover", "focus", "focus-visible", "focus-within", "active"]), z0 = [
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
], Yd = {
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
]), Af = {
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
}, jf = {
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
}, as = ["font-size", "color", ...new Set([...Object.keys(Af), ...Object.keys(jf)].filter((n) => n !== "font-size" && n !== "color"))], T0 = new Set(as);
function re(n, l = " ") {
  const s = [];
  let i = 0, o = "";
  for (let d = 0; d < n.length; d++) {
    const m = n[d];
    if (m === "(" ? i++ : m === ")" && i--, i === 0 && (l === " " ? /\s/.test(m) : m === l)) {
      (o.trim() || l !== " ") && s.push(o.trim()), o = "";
      continue;
    }
    o += m;
  }
  return (o.trim() || l !== " " && s.length) && s.push(o.trim()), s;
}
function ls(n, l, s = 0) {
  if (s > 32) return null;
  let i = "", o = 0;
  for (; ; ) {
    const d = n.indexOf("var(", o);
    if (d < 0)
      return i += n.slice(o), i;
    i += n.slice(o, d);
    let m = 1, f = d + 4;
    for (; f < n.length && m; f++)
      n[f] === "(" ? m++ : n[f] === ")" && m--;
    const p = n.slice(d + 4, f - 1), v = re(p, ","), k = v[0].trim(), E = v.length > 1 ? p.slice(p.indexOf(",") + 1).trim() : null;
    let x = l(k);
    if ((x == null || x === "initial") && (x = E), x == null) return null;
    const z = ls(x, l, s + 1);
    if (z === null) return null;
    i += z, o = f;
  }
}
function C0(n) {
  const l = [], s = /\s*(?:(-?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)(%|[a-z]+)?|([a-z-]+)\(|(infinity)|([()+*/,])|(-)(?=\s))/giy;
  let i, o = 0;
  for (; o < n.length; ) {
    if (s.lastIndex = o, i = s.exec(n), !i || i.index !== o) {
      if (/^\s+$/.test(n.slice(o))) break;
      return null;
    }
    o = s.lastIndex, i[1] !== void 0 ? l.push({ num: parseFloat(i[1]), unit: (i[2] ?? "").toLowerCase() }) : i[3] ? l.push({ fn: i[3].toLowerCase() }) : i[4] ? l.push({ num: 1 / 0, unit: "" }) : l.push({ op: i[5] ?? i[6] });
  }
  return l;
}
function qn(n, l) {
  const s = C0(n.trim().replace(/env\(\s*safe-area-inset-(?:top|right|bottom|left)\s*(?:,[^()]*)?\)/gi, "0px"));
  if (!s) return null;
  let i = 0;
  const o = ({ num: x, unit: z }) => {
    switch (z) {
      case "":
        return { px: 0, pct: 0, num: x, unitless: !0 };
      case "px":
        return { px: x, pct: 0, num: 0 };
      case "rem":
        return { px: x * ns, pct: 0, num: 0 };
      case "em":
        return { px: x * (l.fontSize ?? ns), pct: 0, num: 0 };
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
  }, d = (x, z, S) => x && z ? { px: x.px + S * z.px, pct: x.pct + S * z.pct, num: x.num + S * z.num, unitless: x.unitless && z.unitless } : null, m = (x, z) => x ? { px: x.px * z, pct: x.pct * z, num: x.num * z, unitless: x.unitless } : null, f = (x) => x && x.unitless;
  function p() {
    const x = s[i++];
    if (!x) return null;
    if (x.num !== void 0) return o(x);
    if (x.op === "(") {
      const z = k();
      return s[i]?.op !== ")" ? null : (i++, z);
    }
    if (x.op === "-" || x.op === "+") {
      const z = p();
      return x.op === "-" ? m(z, -1) : z;
    }
    if (x.fn) {
      const z = [];
      for (; ; ) {
        z.push(k());
        const _ = s[i++];
        if (!_) return null;
        if (_.op === ")") break;
        if (_.op !== ",") return null;
      }
      if (z.some((_) => !_)) return null;
      if (x.fn === "calc") return z[0];
      if (!(z.every((_) => !_.pct) || z.every((_) => !_.px && !_.num))) return null;
      const w = (_) => _.px + _.pct + _.num;
      return x.fn === "min" ? z.reduce((_, N) => w(N) < w(_) ? N : _) : x.fn === "max" ? z.reduce((_, N) => w(N) > w(_) ? N : _) : x.fn === "clamp" && z.length === 3 ? w(z[1]) < w(z[0]) ? z[0] : w(z[1]) > w(z[2]) ? z[2] : z[1] : null;
    }
    return null;
  }
  function v() {
    let x = p();
    for (; s[i] && (s[i].op === "*" || s[i].op === "/"); ) {
      const z = s[i++].op, S = p();
      if (!x || !S) return null;
      z === "*" ? x = f(S) ? m(x, S.num) : f(x) ? m(S, x.num) : null : x = f(S) && S.num !== 0 ? m(x, 1 / S.num) : null;
    }
    return x;
  }
  function k() {
    let x = v();
    for (; s[i] && (s[i].op === "+" || s[i].op === "-"); ) {
      const z = s[i++].op;
      x = d(x, v(), z === "-" ? -1 : 1);
    }
    return x;
  }
  const E = k();
  return i !== s.length || !E ? null : E;
}
function rs(n, l) {
  const s = n.trim().toLowerCase();
  if (/^(auto|none|normal|fit-content|max-content|min-content|medium|thin|thick)$/.test(s))
    return s === "thin" ? { px: 1 } : s === "medium" ? { px: 3 } : s === "thick" ? { px: 5 } : s;
  const i = qn(s, l);
  return i ? i.unitless ? i.num === 0 ? { px: 0 } : { expr: n.trim() } : i.pct && (i.px || i.num) ? { expr: n.trim() } : i.pct ? { pct: i.pct } : { px: M0(i.px) } : { expr: n.trim() };
}
const M0 = (n) => Number.isFinite(n) ? n : n > 0 ? 34e37 : -34e37, Tr = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0"), A0 = ([n, l, s, i]) => `#${Tr(n)}${Tr(l)}${Tr(s)}${Tr(i * 255)}`;
function Gd(n) {
  const l = n.slice(1), s = l.length <= 4 ? l.split("").map((o) => o + o).join("") : l;
  if (!/^[0-9a-f]{6}([0-9a-f]{2})?$/i.test(s)) return null;
  const i = (o) => parseInt(s.slice(o, o + 2), 16);
  return [i(0), i(2), i(4), s.length === 8 ? i(6) / 255 : 1];
}
function Kr(n, l) {
  const s = n.trim().toLowerCase();
  if (s === "currentcolor") return "currentcolor";
  const i = /^perchtoken\(([a-z0-9-]+)\)$/.exec(s);
  if (i) {
    const v = l(i[1]), k = v && Gd(v);
    return k ? { rgba: k, token: i[1] } : null;
  }
  if (s.startsWith("#")) {
    const v = Gd(s);
    return v ? { rgba: v, token: null } : null;
  }
  if (Yd[s]) return { rgba: [...Yd[s]], token: null };
  const o = /^(rgba?|color-mix)\((.*)\)$/s.exec(s);
  if (!o) return null;
  if (o[1] === "color-mix") {
    const v = re(o[2], ",");
    if (v.length !== 3 || !/^in\s+(srgb|srgb-linear|oklab|lab|oklch|lch|hsl|xyz)/.test(v[0])) return null;
    const k = (U) => {
      const L = re(U), F = L.findIndex((I) => /%$/.test(I)), Q = F >= 0 ? parseFloat(L[F]) / 100 : null;
      return { color: Kr(L.filter((I, K) => K !== F).join(" "), l), pct: Q };
    }, E = k(v[1]), x = k(v[2]);
    if (!E.color || !x.color || E.color === "currentcolor" || x.color === "currentcolor") return null;
    let z = E.pct, S = x.pct;
    z === null && S === null ? (z = 0.5, S = 0.5) : z === null ? z = 1 - S : S === null && (S = 1 - z);
    const w = z + S, _ = w < 1 ? w : 1;
    z /= w, S /= w;
    const [N, B, j, Z] = E.color.rgba, [q, D, h, b] = x.color.rgba, y = Z * z + b * S, A = (U, L) => y === 0 ? 0 : (U * Z * z + L * b * S) / y, O = [A(N, q), A(B, D), A(j, h), y * _], M = b === 0 ? E.color.token : Z === 0 ? x.color.token : null;
    return { rgba: O, token: M };
  }
  const d = o[2].includes(",") ? re(o[2], ",") : re(o[2].replace("/", " / ")).filter((v) => v !== "/");
  if (d.length < 3) return null;
  const m = (v) => v.endsWith("%") ? parseFloat(v) / 100 * 255 : parseFloat(v), f = d[3] === void 0 ? 1 : d[3].endsWith("%") ? parseFloat(d[3]) / 100 : parseFloat(d[3]), p = [m(d[0]), m(d[1]), m(d[2]), f];
  return p.some((v) => Number.isNaN(v)) ? null : { rgba: p, token: null };
}
const xl = ["top", "right", "bottom", "left"], j0 = ["top-left", "top-right", "bottom-right", "bottom-left"], Cr = (n) => [n[0], n[1] ?? n[0], n[2] ?? n[0], n[3] ?? n[1] ?? n[0]], Kd = /* @__PURE__ */ new Set(["none", "hidden", "solid", "dashed", "dotted", "double", "groove", "ridge", "inset", "outset"]);
function is(n, l) {
  const s = l.trim(), i = () => re(s);
  switch (n) {
    case "padding":
    case "margin": {
      const o = Cr(i());
      return xl.map((d, m) => [`${n}-${d}`, o[m]]);
    }
    case "padding-inline":
    case "margin-inline": {
      const o = i(), d = n.split("-")[0];
      return [[`${d}-left`, o[0]], [`${d}-right`, o[1] ?? o[0]]];
    }
    case "padding-block":
    case "margin-block": {
      const o = i(), d = n.split("-")[0];
      return [[`${d}-top`, o[0]], [`${d}-bottom`, o[1] ?? o[0]]];
    }
    case "padding-inline-start":
    case "margin-inline-start":
      return [[`${n.split("-")[0]}-left`, s]];
    case "padding-inline-end":
    case "margin-inline-end":
      return [[`${n.split("-")[0]}-right`, s]];
    case "padding-block-start":
    case "margin-block-start":
      return [[`${n.split("-")[0]}-top`, s]];
    case "padding-block-end":
    case "margin-block-end":
      return [[`${n.split("-")[0]}-bottom`, s]];
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
      const o = n.split("-")[1], d = Cr(i());
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
      const o = n === "border" ? xl : n === "border-inline" ? ["left", "right"] : n === "border-block" ? ["top", "bottom"] : n === "border-inline-start" ? ["left"] : n === "border-inline-end" ? ["right"] : [n.slice(7)];
      let d = "medium", m = "none", f = "currentcolor";
      if (s !== "none" && s !== "0")
        for (const p of i())
          Kd.has(p) ? m = p : /^(thin|medium|thick|-?[\d.]|calc\()/.test(p) ? d = p : f = p;
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
      const o = Cr(re(s.split("/")[0]));
      return j0.map((d, m) => [`border-${d}-radius`, o[m]]);
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
      return /^(inherit|initial|unset|revert|revert-layer)$/.test(s) ? ["font-family", "font-size", "font-weight", "font-style", "line-height"].map((o) => [o, s]) : [[n, s]];
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
        Kd.has(f) || f === "auto" ? d = f : /^(thin|medium|thick|-?[\d.]|calc\()/.test(f) ? o = f : m = f;
      return [["outline-width", o], ["outline-style", d], ["outline-color", m]];
    }
    case "transition": {
      if (s === "none") return [["transition-property", "none"], ["transition-duration", "0s"]];
      const o = re(s, ","), d = o.map((f) => re(f).find((p) => !/^[\d.]+m?s$/.test(p) && !/^(ease|linear|step|cubic)/.test(p)) ?? "all"), m = o.map((f) => re(f).find((p) => /^[\d.]+m?s$/.test(p)) ?? "0s");
      return [["transition-property", d.join(", ")], ["transition-duration", m.join(", ")]];
    }
    case "text-decoration":
      return [["text-decoration-line", i()[0] ?? "none"]];
    case "-webkit-user-select":
      return [["user-select", s]];
    case "word-wrap":
      return [["overflow-wrap", s]];
    default:
      return [[n, s]];
  }
}
function O0(n, l) {
  return n ? re(n, ",").some((s) => {
    let i = s.trim().toLowerCase(), o = !1;
    i.startsWith("not ") && (o = !0, i = i.slice(4)), i.startsWith("only ") && (i = i.slice(5));
    const d = i.split(/\s+and\s+/).every((m) => {
      if (m = m.trim(), m === "all" || m === "screen") return !0;
      if (m === "print") return !1;
      const f = /^\((.+)\)$/.exec(m);
      if (!f) return !1;
      const p = f[1].trim(), v = /^([a-z-]+)\s*:\s*(.+)$/.exec(p);
      if (v) {
        const [, E, x] = v, z = (S) => {
          const w = rs(S, { viewport: l });
          return typeof w == "object" && "px" in w ? w.px : NaN;
        };
        switch (E) {
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
      const k = /^(width|height)\s*(>=|<=|>|<|=)\s*(.+)$/.exec(p);
      if (k) {
        const E = k[1] === "width" ? l.width : l.height, x = rs(k[3], { viewport: l }), z = typeof x == "object" && "px" in x ? x.px : NaN;
        switch (k[2]) {
          case ">=":
            return E >= z;
          case "<=":
            return E <= z;
          case ">":
            return E > z;
          case "<":
            return E < z;
          default:
            return E === z;
        }
      }
      return !1;
    });
    return o ? !d : d;
  }) : !0;
}
function R0(n, l) {
  const s = l[l.length - 1].compound;
  return xs(s)[0] ?? n;
}
function D0(n) {
  const l = /* @__PURE__ */ new Set(), s = /* @__PURE__ */ new Set(), i = (o, d) => {
    o.forEach(({ compound: m }, f) => {
      const p = d && f === o.length - 1;
      for (const v of m.pseudos)
        if (Mf.has(v.name) && (p ? l : s).add(v.name), v.list && v.name !== "not") for (const k of v.list) i(k, p);
    });
  };
  return i(n, !0), { subject: l, ancestor: s };
}
function xs(n) {
  const l = [...n.classes];
  for (const s of n.pseudos)
    if (!(s.name !== "is" && s.name !== "where"))
      for (const i of s.list) i.length === 1 && l.push(...xs(i[0].compound));
  return l;
}
function B0(n, l) {
  const s = (i, o) => {
    i.forEach(({ compound: d }, m) => {
      const f = o && m === i.length - 1, p = d.pseudos.filter((v) => Mf.has(v.name)).map((v) => v.name);
      if (!f) for (const v of p) for (const k of xs(d)) l.add(`${v}:${k}`);
      for (const v of d.pseudos) if (v.list && v.name !== "not") for (const k of v.list) s(k, f);
    });
  };
  s(n, !0);
}
class H0 {
  constructor(l) {
    this.properties = l.properties ?? {}, this.rules = [], this.skipped = 0, this.index = /* @__PURE__ */ new Map(), this.trackedStates = /* @__PURE__ */ new Set();
    const s = (d, m) => {
      const f = m[m.length - 1].compound, p = f.classes.length ? `.${f.classes[0]}` : f.tag && f.tag !== "*" ? f.tag : "*";
      this.index.has(p) || this.index.set(p, []), this.index.get(p).push(d);
    };
    let i = 0;
    const o = (d, m) => {
      for (const [f, p, v, k] of d)
        for (const E of gs(f)) {
          let x;
          try {
            x = bs(E);
          } catch (_) {
            if (_ instanceof le) {
              this.skipped++;
              continue;
            }
            throw _;
          }
          const z = D0(x);
          B0(x, this.trackedStates);
          const S = x[x.length - 1].compound.pseudoElement, w = { steps: x, media: p, layer: v, origin: m, order: i++, specificity: vf(x), decls: k, states: z, pseudo: S, source: m === 0 ? `ua:${x[x.length - 1].compound.tag ?? "*"}` : R0(E, x) };
          this.rules.push(w), s(w, x);
        }
    };
    o(z0.map(([d, m]) => [d, null, 0, Object.entries(m)]), 0), o(l.rules, 1);
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
const U0 = /* @__PURE__ */ new Set(["opacity", "z-index", "flex-grow", "flex-shrink", "font-weight", "line-height", "flex", "order", "-webkit-line-clamp", "zoom"]);
function q0(n) {
  if (!n || typeof n != "object") return [];
  const l = [];
  for (const [s, i] of Object.entries(n)) {
    if (i == null || i === "" || typeof i == "boolean") continue;
    const o = s.startsWith("--") ? s : s.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`).replace(/^(webkit|moz|ms)-/, "-$1-"), d = typeof i == "number" && i !== 0 && !U0.has(o) && !o.startsWith("--") ? `${i}px` : String(i);
    l.push([o, d]);
  }
  return l;
}
function Y0(n) {
  if (n.tagName !== "svg") return [];
  const l = [];
  for (const s of ["width", "height"]) {
    const i = n.getAttribute(s);
    i !== null && l.push([s, /^[\d.]+$/.test(i) ? `${i}px` : i]);
  }
  return l;
}
const G0 = (n, l) => n.important - l.important || n.origin - l.origin || n.layer - l.layer || n.specificity[0] - l.specificity[0] || n.specificity[1] - l.specificity[1] || n.specificity[2] - l.specificity[2] || n.order - l.order;
class K0 {
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
    return this.sheet.candidates(l, i).filter((d) => (!d.media || d.media.every((m) => O0(m, this.viewport))) && wf(l, d.steps, { state: o, pseudo: i }));
  }
  /** `element`'s computed style, or with `pseudo` (`before`, `after`) that of its pseudo-element's box, whose parent
   * is the element (pass the element's own computed style as `parent`). */
  compute(l, s, i = /* @__PURE__ */ new Set(), o = null) {
    const d = this.matching(l, i, o), m = o ? [] : Y0(l), f = o ? [] : q0(l.inlineStyle ?? l.props?.style);
    let p = this.rootComputed;
    s && (p = this.computed.get(s.values), p || this.computed.set(s.values, p = /* @__PURE__ */ new Map()));
    const v = `${d.map((E) => E.order).join(",")}|${m.length ? JSON.stringify(m) : ""}|${f.length ? JSON.stringify(f) : ""}`;
    let k = p.get(v);
    return k || p.set(v, k = this.cascade(d, m, f, s)), { ...k, rules: d, element: l };
  }
  /** The computed style from the matched `rules`, presentational `attrs`, `inline` declarations and the parent's. */
  cascade(l, s, i, o) {
    const d = [];
    for (const h of l)
      for (const [b, y, A] of h.decls) d.push({ prop: b, value: y, important: A ? 1 : 0, origin: h.origin === 0 ? 0 : 2, layer: h.layer, specificity: h.specificity, order: h.order, source: h.source });
    for (const [h, b] of s) d.push({ prop: h, value: b, important: 0, origin: 1, layer: 0, specificity: [0, 0, 0], order: 0, source: `attr:${h}` });
    for (const [h, b] of i) d.push({ prop: h, value: b, important: 0, origin: 3, layer: 0, specificity: [1, 0, 0], order: 0, source: "style" });
    d.sort(G0);
    const m = this.sheet.properties, f = Object.create(o?.customs ?? null), p = /* @__PURE__ */ new Map(), v = /* @__PURE__ */ new Map();
    for (const h of d) h.prop.startsWith("--") && v.set(h.prop, h.value);
    if (!o && this.theme) for (const h of Cf) this.theme[h] && v.set(`--${h}`, `perchtoken(${h})`);
    const k = (h) => {
      if (p.has(h)) return p.get(h);
      const b = m[h];
      return b && !b.inherits ? b.initial ?? null : h in f ? f[h] : b?.initial ?? null;
    }, E = /* @__PURE__ */ new Set(), x = (h) => {
      if (!v.has(h)) return k(h);
      if (E.has(h)) return null;
      E.add(h);
      const b = ls(v.get(h), x);
      return E.delete(h), v.delete(h), p.set(h, b), (!m[h] || m[h].inherits) && (f[h] = b), b;
    };
    for (const h of [...v.keys()]) x(h);
    const z = /* @__PURE__ */ new Map();
    for (const h of d) {
      if (h.prop.startsWith("--")) continue;
      const b = ls(h.value, k);
      if (b === null) {
        for (const [y] of is(h.prop, "unset")) z.set(y, { value: "unset", source: h.source, origin: h.origin });
        continue;
      }
      for (const [y, A] of is(h.prop, b)) z.set(y, { value: A, source: h.source, origin: h.origin });
    }
    const S = {}, w = {}, _ = /* @__PURE__ */ new Set(), N = /* @__PURE__ */ new Set(), B = o?.values, j = { fontSize: B?.["font-size"] ?? ns, viewport: this.viewport }, Z = (h, b) => {
      if (/currentcolor/i.test(b)) return this.parseValue(h, b, j, S, B);
      const y = `${h}\0${b}\0${j.fontSize}`;
      let A = this.parsed.get(y);
      return A === void 0 && this.parsed.set(y, A = this.parseValue(h, b, j, S, B)), A;
    }, q = z.size ? [...as, ...[...z.keys()].filter((h) => !T0.has(h))] : as;
    for (const h of q) {
      const b = z.get(h);
      let y = b?.value;
      const A = N0.has(h);
      if ((y === void 0 || y === "unset" || y === "revert" || y === "revert-layer") && (y = A ? "inherit" : "initial"), b && (w[h] = b.source, b.origin !== 0 && _.add(h)), y === "inherit" && B && h in B) {
        S[h] = B[h], N.add(h);
        continue;
      }
      (y === "inherit" || y === "initial") && (y = A ? jf[h] : Af[h]), S[h] = Z(h, y), h === "font-size" && (j.fontSize = S["font-size"]);
    }
    for (const h of xl) {
      const b = S[`border-${h}-style`];
      (b === "none" || b === "hidden") && (S[`border-${h}-width`] = { px: 0 });
    }
    S["outline-style"] === "none" && (S["outline-width"] = { px: 0 });
    const D = B?.display;
    return (D === "flex" || D === "inline-flex" || D === "grid" || D === "inline-grid") && S.position !== "absolute" && S.position !== "fixed" && (S.display = Qd(S.display)), (S.position === "absolute" || S.position === "fixed") && (S.display = Qd(S.display)), { values: S, sources: w, own: _, inherited: N, customs: f };
  }
  parseValue(l, s, i, o, d) {
    const m = String(s).trim();
    switch (l) {
      case "font-size": {
        const f = m.toLowerCase(), p = { "xx-small": 9, "x-small": 10, small: 13, medium: 16, large: 18, "x-large": 24, "xx-large": 32 };
        if (p[f]) return p[f];
        if (f === "smaller") return i.fontSize / 1.2;
        if (f === "larger") return i.fontSize * 1.2;
        const v = qn(f, { fontSize: i.fontSize, viewport: i.viewport });
        return !v || v.num ? i.fontSize : v.px + v.pct / 100 * i.fontSize;
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
        const p = qn(f, { fontSize: i.fontSize, viewport: i.viewport });
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
function Qd(n) {
  return n === "inline" || n === "inline-block" || n === "contents" ? "block" : n === "inline-flex" ? "flex" : n === "inline-grid" ? "grid" : n;
}
const Qr = (n) => n && n.rgba ? { value: A0(n.rgba), token: n.token ?? null } : null, Q0 = { 9.28: 11, 9.92: 12, 10.4: 12, 10.88: 13, 11: 13, 11.2: 13, 11.52: 13, 12: 15, 12.5: 15, 13: 16, 14: 17, 16: 19 };
function V0(n, l) {
  const s = l?.(n);
  if (Number.isFinite(s)) return s;
  const i = Math.round(n * 100) / 100;
  return Q0[i] ?? Math.round(n * 1.2);
}
function _l(n, l) {
  const s = n["line-height"], i = n["font-size"];
  return s.normal ? V0(i, l) : s.factor !== void 0 ? s.factor * i : s.px;
}
const X0 = (n) => re(n, ",").map((l) => l.trim().replace(/^["']|["']$/g, "")).join(", ");
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
const L0 = "perch-native-description/1", Un = Symbol("display"), Vr = {
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
}, Z0 = ["w", "h", "min_w", "min_h", "max_w", "max_h", "top", "right", "bottom", "left", "pt", "pr", "pb", "pl", "mt", "mr", "mb", "ml", "gap_x", "gap_y", "border_t", "border_r", "border_b", "border_l", "rounded_tl", "rounded_tr", "rounded_br", "rounded_bl"];
for (const n of Z0) Vr[n] = /^(w|h|min_|max_|top|right|bottom|left)/.test(n) ? "auto" : 0;
Vr.rounded = 0;
const J0 = /* @__PURE__ */ new Set([
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
]), W0 = /(-apple-system|blinkmacsystemfont|system-ui|segoe ui|sans-serif|times)/i, F0 = /(ui-monospace|sfmono|sf mono|menlo|monospace)/i, I0 = (n) => F0.test(n) ? "Menlo" : /^\s*system-ui\s*$/i.test(n ?? "") ? ".AppleSystemUIFont" : W0.test(n) ? ".SystemUIFont" : X0(n).split(",")[0].trim(), $0 = {
  click: ["onClick", "onClickCapture"],
  double_click: ["onDoubleClick"],
  context_menu: ["onContextMenu"],
  mouse_down: ["onPointerDown", "onMouseDown", "onPointerDownCapture", "onMouseDownCapture"],
  mouse_up: ["onPointerUp", "onMouseUp", "onPointerCancel"],
  mouse_move: ["onPointerMove", "onMouseMove"],
  key_down: ["onKeyDown", "onKeyUp"],
  focus: ["onFocus", "onBlur"],
  input: ["onChange", "onInput"]
}, Vd = { pointerdown: "mouse_down", mousedown: "mouse_down", click: "click", keydown: "key_down", pointerup: "mouse_up", mouseup: "mouse_up" }, ws = (n) => {
  const l = n.props["data-testid"];
  if (l) return `${n.tagName}[data-testid="${l}"]`;
  if (n.props.id) return `${n.tagName}#${n.props.id}`;
  const s = n.classList.find((o) => !o.includes(":") && !o.includes("[")) ?? n.classList[0];
  if (s) return `${n.tagName}.${s}`;
  const i = n.parentElement;
  return i && i.tagName !== "body" ? `${ws(i)} > ${n.tagName}` : n.tagName;
};
class P0 {
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
const mn = (n) => {
  if (n != null) {
    if (typeof n == "string") return n === "auto" || n === "none" || n === "normal" ? "auto" : void 0;
    if ("px" in n) return Math.round(Math.min(Math.max(n.px, -9999), 9999) * 100) / 100;
    if ("pct" in n) return `${Math.round(n.pct * 1e3) / 1e3}%`;
  }
}, tg = /^(text|search|url|email|tel|password|number)$/, eg = 162.13 / 12.8;
function ng(n, l) {
  const s = typeof n == "object" && /^min\((.*)\)$/.exec(String(n?.expr ?? "").trim());
  if (!s) return;
  const i = re(s[1], ",").map((o) => qn(o.trim(), { fontSize: l })).filter((o) => o && !o.pct && !o.num).map((o) => o.px);
  return i.length ? Math.min(...i) : void 0;
}
function ag(n, l) {
  if (typeof n != "object" || !n?.expr) return !1;
  const s = qn(n.expr, { fontSize: l["font-size"] }), i = (l["margin-left"]?.px ?? NaN) + (l["margin-right"]?.px ?? NaN);
  return !!s && !s.num && s.pct === 100 && Math.abs(s.px + i) < 0.01;
}
function Of(n) {
  const l = n.transform;
  if (l && l !== "none") {
    const i = /^\s*translate(X|Y)?\(([^]*)\)\s*$/.exec(l), o = i && re(i[2], ",").map((d) => d.trim());
    return !o || o.length > (i[1] ? 1 : 2) ? null : i[1] === "X" ? [o[0], "0"] : i[1] === "Y" ? ["0", o[0]] : [o[0], o[1] ?? "0"];
  }
  const s = n.translate;
  if (s && s !== "none") {
    const i = re(String(s).trim(), " ").filter(Boolean);
    return i.length > 3 || i[2] !== void 0 && qn(i[2], {})?.px ? null : [i[0], i[1] ?? "0"];
  }
  return [];
}
function Xd(n, l, s, i = !1) {
  const o = n.values, d = Of(o);
  if (d?.length === 0) return;
  const m = o.transform && o.transform !== "none" ? "transform" : "translate", f = { fontSize: o["font-size"] }, p = (E, x) => {
    const z = qn(E, f);
    if (!(!z || z.unitless && z.num))
      return z.pct ? typeof x == "number" ? z.px + z.pct / 100 * x : void 0 : z.px;
  }, v = d ? p(d[0], l.w) : void 0, k = d ? p(d[1], l.h) : void 0;
  if (v === void 0 || k === void 0) {
    const E = !i && d ? d.map((x) => qn(x, f)) : null;
    if (E?.every((x) => x && !(x.unitless && x.num))) {
      l[Rf] = E.map((x) => [x.px, x.pct ?? 0]);
      return;
    }
    s("unsupported", m, o[m], n.sources[m]);
    return;
  }
  if (i) {
    v && (l.left = v), k && (l.top = k);
    return;
  }
  v && (l.ml = (l.ml ?? 0) + v), k && (l.mt = (l.mt ?? 0) + k);
}
const Rf = Symbol("perch.shift");
function lg(n, l, s) {
  const i = n.ownerDocument, o = i?.measure?.(n) ?? null;
  if (o) {
    const [[m, f], [p, v]] = s, k = m + f / 100 * o.width, E = p + v / 100 * o.height;
    k && (l.ml = (typeof l.ml == "number" ? l.ml : 0) + k), E && (l.mt = (typeof l.mt == "number" ? l.mt : 0) + E);
  }
  const d = o ? `${o.width}x${o.height}` : "";
  d === n.shiftSeen ? n.shiftTries = 0 : (n.shiftTries ?? 0) < kf && i?.retries && (n.shiftSeen = d, n.shiftTries = (n.shiftTries ?? 0) + 1, i.retries.push(() => i.afterCommit?.()));
}
function Hr(n, l, s = null) {
  const i = n.values, o = {}, d = (j) => n.sources[j], m = (j) => n.sources[j] !== void 0, f = i.display;
  f === "none" ? o.display = "hidden" : f === "flex" || f === "inline-flex" ? o.display = "flex" : (f === "grid" || f === "inline-grid") && (o.display = "flex", o.flex_direction = "col", l("approximated", "display", f, d("display"), "one-column flex column"), i["grid-template-columns"] && i["grid-template-columns"] !== "none" && l("unsupported", "grid-template-columns", i["grid-template-columns"], d("grid-template-columns"))), n.element.hidden && (o.display = "hidden");
  const p = o.display === "flex";
  if (p && o.flex_direction !== "col") {
    const j = { row: "row", column: "col", "row-reverse": "row_reverse", "column-reverse": "col_reverse" }[i["flex-direction"]] ?? "row";
    o.flex_direction = j;
  }
  if (p) {
    (i["flex-wrap"] === "wrap" || i["flex-wrap"] === "wrap-reverse") && (o.flex_wrap = "wrap");
    const j = f === "grid" || f === "inline-grid", Z = { "flex-start": "start", start: "start", "self-start": "start", "flex-end": "end", end: "end", "self-end": "end", center: "center", baseline: "baseline", "first baseline": "baseline" }[i["align-items"]];
    Z && (o.items = Z);
    let q = { "flex-start": "start", start: "start", "flex-end": "end", end: "end", center: "center", "space-between": "between", "space-around": "around", "space-evenly": "evenly" }[i["justify-content"]];
    if (j) {
      const b = { center: "center", end: "end", "flex-end": "end", start: "start", "flex-start": "start" }[i["justify-items"]];
      b && (o.items = b), i["align-items"] === "center" && (q = "center");
    }
    q && (o.justify = q);
    const D = mn(i["row-gap"]), h = mn(i["column-gap"]);
    typeof D == "number" && D && (o.gap_y = D), typeof h == "number" && h && !j && (o.gap_x = h);
  }
  i["flex-grow"] && (o.flex_grow = i["flex-grow"]), i["flex-shrink"] !== 1 && (o.flex_shrink = i["flex-shrink"]);
  const v = mn(i["flex-basis"]);
  v !== void 0 && v !== "auto" && (o.flex_basis = v);
  const k = { "flex-start": "start", start: "start", "flex-end": "end", end: "end", center: "center", baseline: "baseline", stretch: "stretch" }[i["align-self"]];
  k && (o.self = k);
  for (const [j, Z] of [["w", "width"], ["h", "height"], ["min_w", "min-width"], ["min_h", "min-height"], ["max_w", "max-width"], ["max_h", "max-height"]]) {
    const q = i[Z], D = mn(q);
    if (D === void 0 && Z === "width" && ag(q, i)) {
      o.self = "stretch", l("approximated", Z, q.expr, d(Z), "stretched across its parent, inside its margins");
      continue;
    }
    const h = D === void 0 && /^max-/.test(Z) ? ng(q, i["font-size"]) : void 0;
    if (h !== void 0) {
      o[j] = h, l("approximated", Z, q.expr, d(Z), "the fixed bound of min()");
      continue;
    }
    if (D === void 0) {
      typeof q == "object" && q.expr ? l("unsupported", Z, q.expr, d(Z), "no calc() in the engine") : typeof q == "string" && !["auto", "none"].includes(q) && l("unsupported", Z, q, d(Z));
      continue;
    }
    D !== "auto" && (o[j] = D);
  }
  const E = ["top", "right", "bottom", "left"];
  for (const j of E) {
    const Z = j[0];
    for (const [q, D] of [["p", "padding"], ["m", "margin"]]) {
      const h = i[`${D}-${j}`], b = mn(h);
      if (b === void 0) {
        h?.expr && l("unsupported", `${D}-${j}`, h.expr, d(`${D}-${j}`), "no calc() in the engine");
        continue;
      }
      b !== 0 && (o[`${q}${Z}`] = b);
    }
  }
  const x = i.position;
  if (x === "absolute" || x === "fixed") {
    o.position = "absolute", x === "fixed" && l("approximated", "position", "fixed", d("position"), "absolute in the overlay layer");
    for (const j of E) {
      const Z = mn(i[j]);
      Z !== void 0 && Z !== "auto" && (o[j] = Z);
    }
    if (x === "fixed" && s && o.w === void 0 && o.right === void 0 && typeof o.left == "number") {
      const j = s.width - o.left - (typeof o.ml == "number" ? o.ml : 0) - (typeof o.mr == "number" ? o.mr : 0);
      o.max_w = typeof o.max_w == "number" ? Math.min(o.max_w, j) : j;
    }
    Xd(n, o, l);
  } else x === "sticky" ? l("unsupported", "position", "sticky", d("position")) : Of(i)?.length !== 0 && (o.position = "relative", Xd(n, o, l, !0));
  i["z-index"] !== "auto" && m("z-index") && l("unsupported", "z-index", i["z-index"], d("z-index"), "paint order is tree order");
  for (const [j, Z] of [["overflow_x", "overflow-x"], ["overflow_y", "overflow-y"]]) {
    const q = i[Z];
    q === "hidden" || q === "clip" ? o[j] = "hidden" : (q === "auto" || q === "scroll") && (o[j] = "scroll");
  }
  (i.visibility === "hidden" || i.visibility === "collapse") && (o.visibility = "invisible");
  const z = i["background-color"];
  z?.unreadable ? l("unsupported", "background-color", z.unreadable, d("background-color")) : z?.rgba && z.rgba[3] > 0 && (o.bg = Qr(z)), i["background-image"] && i["background-image"] !== "none" && l("unsupported", "background-image", i["background-image"], d("background-image"));
  const S = E.map((j) => mn(i[`border-${j}-width`]) || 0), w = [];
  E.forEach((j, Z) => {
    if (!S[Z]) return;
    o[`border_${j[0]}`] = S[Z];
    const q = i[`border-${j}-style`];
    q !== "solid" && l("approximated", `border-${j}-style`, q, d(`border-${j}-style`), "drawn solid");
    const D = Qr(i[`border-${j}-color`]);
    D && w.push(D);
  }), w.length && (o.border_color = w[0], w.some((j) => j.value !== w[0].value) && l("approximated", "border-color", w.map((j) => j.value).join(" "), d("border-top-color"), "one border colour"));
  const _ = (j) => {
    const Z = mn(i[`border-${j}-radius`]) || 0;
    if (typeof Z != "string") return Z;
    const q = parseFloat(Z) / 100, D = [o.w, o.h].filter((h) => typeof h == "number");
    return Z === "auto" || !(q > 0) ? 0 : D.length ? Math.round(Math.min(q, 0.5) * Math.min(...D) * 100) / 100 : 9999;
  }, N = ["top-left", "top-right", "bottom-right", "bottom-left"].map(_);
  N.every((j) => j === N[0]) ? N[0] && (o.rounded = N[0]) : ["tl", "tr", "br", "bl"].forEach((j, Z) => {
    N[Z] && (o[`rounded_${j}`] = N[Z]);
  }), i.opacity !== 1 && (o.opacity = Math.round(i.opacity * 1e3) / 1e3);
  const B = i["box-shadow"];
  if (B && B !== "none" && re(B, ",").some((j) => !/^0(px)?\s+0(px)?\s+(0(px)?\s+)?(0(px)?\s+)?(#0000|transparent|rgba?\(0,\s*0,\s*0,\s*0\))/.test(j.trim())) && (o.shadow = "lg", l("approximated", "box-shadow", B, d("box-shadow"), "the engine's large shadow preset")), i.cursor && i.cursor !== "auto" && !n.inherited.has("cursor")) {
    const j = { pointer: "pointer", default: "default", text: "text", move: "move", "not-allowed": "not_allowed", grab: "move", grabbing: "move" }[i.cursor];
    j ? o.cursor = j : l("unsupported", "cursor", i.cursor, d("cursor"));
  }
  return i["text-overflow"] === "ellipsis" && (o.text_ellipsis = !0), i["text-decoration-line"] === "underline" ? o.underline = !0 : i["text-decoration-line"] && i["text-decoration-line"] !== "none" && l("unsupported", "text-decoration-line", i["text-decoration-line"], d("text-decoration-line")), o;
}
const rg = { "tabular-nums": "tnum", "proportional-nums": "pnum", "lining-nums": "lnum", "oldstyle-nums": "onum", "slashed-zero": "zero", "diagonal-fractions": "frac", "stacked-fractions": "afrc", ordinal: "ordn" };
function Df(n) {
  if (!n || n === "normal") return "";
  const l = String(n).trim().split(/\s+/).map((s) => rg[s]);
  return l.every(Boolean) ? l.join(",") : null;
}
function Ur(n, l) {
  const s = n.values, i = s["line-height"];
  return {
    text_color: Qr(s.color),
    text_size: Math.round(s["font-size"] * 1e3) / 1e3,
    font_features: Df(s["font-variant-numeric"]) ?? "",
    font_weight: s["font-weight"],
    line_height: i.factor !== void 0 ? { factor: i.factor } : { px: Math.round(_l(s, l) * 1e3) / 1e3 },
    font_family: I0(s["font-family"]),
    italic: s["font-style"] === "italic" || s["font-style"] === "oblique",
    whitespace: s["white-space"] === "nowrap" || s["white-space"] === "pre" ? "nowrap" : "normal",
    text_align: { center: "center", right: "right", end: "right" }[s["text-align"]] ?? "left"
  };
}
const Ld = (n, l) => n.factor !== void 0 ? n.factor * l : n.px, Bf = (n, l) => JSON.stringify(n) === JSON.stringify(l);
function qr(n, l, s) {
  const i = {}, o = (f, p) => p.some((v) => !n.inherited.has(v));
  for (const [f, p] of [["text_color", ["color"]], ["text_size", ["font-size"]], ["font_weight", ["font-weight"]], ["font_family", ["font-family"]], ["italic", ["font-style"]], ["whitespace", ["white-space"]], ["text_align", ["text-align"]], ["font_features", ["font-variant-numeric"]]])
    (o(f, p) || !Bf(l[f], s[f])) && (i[f] = l[f]);
  const d = Ld(l.line_height, l.text_size), m = s.line_height ? Ld(s.line_height, l.text_size) : NaN;
  return (o("line_height", ["line-height"]) || !(Math.abs(d - m) <= 1e-3)) && (i.line_height = l.line_height), i;
}
const ig = (n, l) => ({ ...n, ...l });
function Yr(n, l) {
  const s = {};
  for (const [i, o] of Object.entries(n))
    o && typeof o == "object" && "value" in o ? (s[i] = o.value, o.token && (l[i] = o.token)) : i === "line_height" ? s[i] = o.factor !== void 0 ? Math.round(o.factor * 1e3) / 1e3 : `${o.px}px` : i === "italic" ? o && (s.italic = !0) : s[i] = o;
  return s.italic === !1 && delete s.italic, s;
}
function Zd(n, l) {
  const s = {};
  for (const i of /* @__PURE__ */ new Set([...Object.keys(n), ...Object.keys(l)])) {
    const o = n[i], d = l[i];
    Bf(o, d) || (s[i] = d === void 0 ? i in Vr ? Vr[i] : null : d);
  }
  return s;
}
function Jd(n, l) {
  const s = n.values;
  for (const [i, o] of Object.entries(n.sources)) {
    if (i.startsWith("--") || J0.has(i) || o.startsWith("ua:")) continue;
    const d = s[i];
    switch (i) {
      case "letter-spacing":
        d !== "normal" && d?.px !== 0 && l("approximated", i, d?.px !== void 0 ? `${Math.round(d.px * 1e3) / 1e3}px` : d, o, d?.px < 0 ? "the run's box is as wide as with the spacing (the glyphs reach past it; where the element clips, the run is drawn smaller to fit)" : "the run is as wide as with the spacing (room after it), the letters are not spread");
        break;
      case "font-variant-numeric":
        d !== "normal" && Df(d) === null && l("unsupported", i, d, o);
        break;
      case "text-transform":
        d !== "none" && l("approximated", i, d, o, "applied to the text in JS");
        break;
      case "transition-property":
      case "transition-duration": {
        const m = s["transition-duration"];
        i === "transition-property" && m && re(m, ",").some((f) => parseFloat(f) > 0) && s["transition-property"] !== "none" && l("unsupported", "transition", `${s["transition-property"]} ${m}`, o, "changes are instant (the engine animates only opacity and size)");
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
function og(n, l, s, i) {
  const o = ws(n), d = [], m = (N, B, j, Z, q) => d.push([N, B, j, Z ?? "(user agent)", o, q]), f = i.cascade.compute(n, l), p = {}, v = Hr(f, m, i.viewport), k = v[Rf];
  Jd(f, m);
  const E = Ur(f, i.measure), x = qr(f, E, s), z = Yr({ ...v, ...x }, p), S = {}, w = i.cascade.matching(n, "*").filter((N) => N.states.subject.size);
  for (const [N, B] of [["hover", ["hover"]], ["focus", ["focus", "focus-visible"]], ["active", ["active", "hover"]]]) {
    if (!w.some((h) => B.some((b) => h.states.subject.has(b)))) continue;
    const j = i.cascade.compute(n, l, new Set(B)), Z = {}, q = Yr({ ...Hr(j, () => {
    }), ...qr(j, Ur(j, i.measure), s) }, Z);
    N === "focus" && Jd(j, m);
    const D = Zd(z, q);
    if (Object.keys(D).length) {
      S[N] = D;
      const h = Object.fromEntries(Object.entries(Z).filter(([b]) => b in D));
      Object.keys(h).length && (S[`${N}_tokens`] = h);
    }
  }
  if (i.cascade.sheet.tracks(n, "hover") && (S.group = Wd(n), S.track_hover = !0), i.cascade.sheet.readsAncestor(n, "hover"))
    for (let N = n.parentNode; N?.state; N = N.parentNode) {
      if (!i.cascade.sheet.tracks(N, "hover")) continue;
      const B = N.state.hover;
      N.state.hover = !0;
      let j;
      try {
        j = i.cascade.compute(n, l);
      } finally {
        N.state.hover = B;
      }
      const Z = {}, q = Yr({ ...Hr(j, () => {
      }), ...qr(j, Ur(j, i.measure), s) }, Z), D = Zd(z, q);
      if (!Object.keys(D).length) continue;
      const h = Object.fromEntries(Object.entries(Z).filter(([b]) => b in D));
      (S.group_hover ??= []).push({ group: Wd(N), style: D, ...Object.keys(h).length ? { tokens: h } : {} });
    }
  if (/tabular/.test(String(f.values["font-variant-numeric"] ?? "")) && (S.tabular = !0), /^(anywhere|break-word)$/.test(String(f.values["overflow-wrap"] ?? "")) && (S.break_anywhere = !0), v.overflow_y === "scroll") {
    const N = Number.parseFloat(f.customs?.["--scrollbar-size"] ?? "");
    N > 0 && (S.scrollbar = N);
  }
  f.values["pointer-events"] !== "none" && l?.values["pointer-events"] === "none" && (S.blocks_pointer = !0), f.values["pointer-events"] === "none" && (S.pointer_none = !0);
  const _ = Object.entries($0).filter(([, N]) => N.some((B) => typeof n.props[B] == "function")).map(([N]) => N);
  return !_.includes("click") && ts(n) && _.push("click"), _.length && (S.events = _), { computed: f, style: z, tokens: p, extra: S, meta: pg(n), reports: d, childText: ig(s, x), where: o, shift: k };
}
function sg(n, l, s, i) {
  const o = { before: null, after: null };
  for (const d of ["before", "after"]) {
    if (!i.cascade.matching(n, /* @__PURE__ */ new Set(), d).length) continue;
    const m = i.cascade.compute(n, l, /* @__PURE__ */ new Set(), d), f = String(m.values.content ?? "none").trim();
    if (f === "none" || f === "normal") continue;
    const p = /^(["'])(.*)\1$/.exec(f)?.[2] ?? "", v = (S, w, _, N, B) => i.findings.add(S, w, _, N ?? "(user agent)", `${ws(n)}::${d}`, B), k = {}, E = Hr(m, v, i.viewport), z = { kind: "div", style: Yr({ ...E, ...qr(m, Ur(m, i.measure), s) }, k), tokens: k, children: p ? [{ kind: "text", text: p }] : [] };
    Object.defineProperty(z, Un, { value: m.values.display }), o[d] = z;
  }
  return o;
}
const Wd = (n) => `~g${n.id}`, cg = ["pt", "pr", "pb", "pl", "mt", "mr", "mb", "ml", "border_t", "border_r", "border_b", "border_l", "bg"];
function ug(n) {
  return n.kind === "div" && n[Un] === "inline" && !n.events?.length && !n.meta?.attrs?.["data-testid"] && !cg.some((l) => n.style?.[l]) && n.children?.every((l) => l.kind === "text");
}
function Hf(n, l, s, i, o = "") {
  const d = `${o}/${n.id}.${n.version}`;
  let m = i.cache.get(n);
  (!m || m.key !== d) && i.cache.set(n, m = { key: d, part: og(n, l, s, i) });
  const { computed: f, tokens: p, extra: v, reports: k, childText: E, where: x } = m.part;
  for (const y of k) i.findings.add(...y);
  const z = (y, A, O, M, U) => i.findings.add(y, A, O, M, x, U), S = { ...m.part.style };
  m.part.shift && lg(n, S, m.part.shift);
  const w = { kind: "div", id: n.id, style: S, tokens: p, meta: m.part.meta, ...v };
  Object.defineProperty(w, Un, { value: f.values.display }), n.measured && n.ownerDocument?.measureKey && (w.measure = n.ownerDocument.measureKey(n));
  const _ = n.tagName;
  if (n.props["data-perch-engine"] != null)
    return w.kind = "engine", w.engine = String(n.props["data-perch-engine"]), w.key = String(n.props["data-perch-key"] ?? ""), w;
  if (_ === "svg")
    return w.kind = n.props["data-perch-image"] ? "image" : "svg", w.markup = gg(n), w;
  if (_ === "input" || _ === "textarea" || _ === "select") {
    w.kind = "input", w.input_type = _ === "input" ? String(n.props.type ?? "text") : _;
    for (const O of ["placeholder", "checked", "disabled"]) n.props[O] !== void 0 && (w[O] = n.props[O]);
    if (/^(checkbox|radio)$/.test(w.input_type) && (w.checked = n.checked), _ !== "select" && (w.value = n.value), _ === "input" && tg.test(w.input_type) && (w.field_w = eg * f.values["font-size"]), _ === "textarea" && S.h === void 0) {
      const O = f.values, M = (F) => F && typeof F == "object" && "px" in F ? F.px : 0, U = (F) => O[`border-${F}-style`] === "none" ? 0 : M(O[`border-${F}-width`]), L = Number(n.props.rows) > 0 ? Math.floor(Number(n.props.rows)) : 2;
      S.h = L * _l(O, i.measure) + M(O["padding-top"]) + M(O["padding-bottom"]) + U("top") + U("bottom");
    }
    const { before: y, after: A } = sg(n, f, E, i);
    return (y || A) && (w.children = [y, A].filter(Boolean)), w;
  }
  if (_ === "img") {
    w.kind = "image", w.src = n.props.src ?? null;
    for (const [y, A] of [["width", "w"], ["height", "h"]]) {
      const O = Number(n.props[y]);
      S[A] === void 0 && n.props[y] != null && Number.isFinite(O) && (S[A] = O);
    }
    return w;
  }
  const N = f.values["text-transform"], B = [];
  let j = !1, Z = !1;
  for (const y of n.childNodes) {
    if (y instanceof $r) {
      if (y.hidden || y.data === "") continue;
      j = !0;
      const M = B[B.length - 1];
      if (M?.kind === "text")
        M.source = (M.source ?? M.text) + y.data, M.text = Fd(M.source, N), M.text === M.source && delete M.source;
      else {
        const U = Fd(y.data, N);
        B.push(U === y.data ? { kind: "text", text: U } : { kind: "text", text: U, source: y.data });
      }
      continue;
    }
    if (!(y instanceof $t)) continue;
    const A = Hf(y, f, E, i, d), O = A[Un];
    O === "inline" || O === "inline-block" || O === "inline-flex" ? j = !0 : O !== "none" && (Z = !0), B.push(A);
  }
  if (/(^|\s)inline-flex(\s|$)/.test(String(n.props?.className ?? "")) && S.w === void 0)
    for (const y of B)
      y.style?.flex_grow && y.style.min_w === 0 && y.style.overflow_x === "hidden" && (delete y.style.min_w, delete y.style.flex_grow, delete y.style.flex_basis, delete y.style.overflow_x, delete y.style.overflow_y);
  if (!S.display && j && B.some((y) => y.kind !== "text") && B.every((y) => y.kind === "text" || ug(y))) {
    const y = B.map((A) => A.kind === "text" ? A.text : A.children.map((O) => O.text).join("")).join("");
    z("approximated", "display", "inline text elements in a line of text", "(inline formatting)", "their text joined to the line, in its font"), B.splice(0, B.length, { kind: "text", text: y });
  }
  const q = B.some((y) => y.kind !== "text"), D = B.length === 1 && B[0].kind !== "text" && /^inline-(block|flex)$/.test(B[0][Un]) ? B[0] : null;
  if (!S.display && D) {
    const y = i.cache.get(n.childNodes.find((O) => O.id === D.id))?.part.computed, A = y ? Lr(f.values, i.measure) - mg(y.values, i.measure, D) : 0;
    S.display = "flex", S.flex_direction = "col", S.items = "start", A > 0 && (D.style.mt = Math.round(((D.style.mt ?? 0) + A) * 100) / 100), z("approximated", "display", `${f.values.display} holding one ${D[Un]} box`, "(inline formatting)", "a column, the box lowered to the line's baseline");
  } else if (!S.display && B.length === 1 && (B[0].kind === "svg" || B[0].kind === "image") && B[0][Un] === "inline" && typeof B[0].style.h == "number") {
    const y = B[0], A = Lr(f.values, i.measure), O = _l(f.values, i.measure) - A, M = (U) => Math.round(U * 100) / 100;
    S.display = "flex", S.flex_direction = "col", S.items = "start", A > y.style.h && (y.style.mt = M((y.style.mt ?? 0) + A - y.style.h)), O > 0 && (y.style.mb = M((y.style.mb ?? 0) + O)), z("approximated", "display", `${f.values.display} holding one inline image`, "(inline formatting)", "a column, the image on the line's baseline");
  } else if (!S.display && j && q) {
    if (S.display = "flex", S.flex_direction = Z ? "col" : "row", !Z) S.items = "baseline";
    else for (const y of B) y.kind !== "text" && /^inline-(block|flex)$/.test(y[Un]) && !y.style.self && (y.style.self = "start");
    z("approximated", "display", `${f.values.display} with inline content`, "(inline formatting)", Z ? "a column of its children" : "a row on the text baseline");
  }
  const h = f.values["letter-spacing"]?.px, b = f.values["overflow-x"] !== "visible";
  if (h)
    for (let y = 0; y < B.length; y++) {
      const A = B[y];
      if (A.kind !== "text") continue;
      const O = Math.round(h * [...A.text].length * 1e3) / 1e3;
      if (h > 0 || !b) {
        B[y] = { kind: "div", style: { pr: O }, tokens: {}, children: [A] };
        continue;
      }
      const M = f.values["font-size"], U = Math.max(0.8, 1 + h / (0.55 * M)), L = Math.round(_l(f.values, i.measure) * 1e3) / 1e3;
      B[y] = { kind: "div", style: { text_size: Math.round(M * U * 1e3) / 1e3, line_height: `${L}px` }, tokens: {}, children: [A] };
    }
  return w.children = B, w;
}
function dg(n, l) {
  if (!l) return null;
  let i = (l.self ? n : l.closest ? _f(n, l.closest) : l.find ? kl(n, l.find)[0] : null)?.getAttribute(l.attr) ?? null;
  return i && l.strip && i.startsWith(l.strip) && (i = i.slice(l.strip.length)), i;
}
function fg(n, l, s) {
  const i = l.map((m) => [m, Ir(m.selector)]), o = /* @__PURE__ */ new Map(), d = (m) => {
    for (const f of m.children) {
      const p = s.get(f.id);
      if (p)
        for (const [v, k] of i) {
          const E = v.textRange ? "range_name" : "name";
          if (v.textRange && p[E] != null || !k.some((w) => wf(f, w))) continue;
          const x = dg(f, v.key), z = x == null ? o.get(v.name) ?? 0 : 0;
          x == null && o.set(v.name, z + 1);
          const S = x != null ? `${v.name}:${x}` : z ? `${v.name}@${z}` : v.name;
          p[E] == null ? p[E] = S : (p.also ??= []).push(S);
        }
      d(f);
    }
  };
  d(n.documentElement);
}
const Xr = 0.9521, Uf = 0.2256, Lr = (n, l) => (_l(n, l) - (Xr + Uf) * n["font-size"]) / 2 + Xr * n["font-size"];
function mg(n, l, s) {
  const i = (p) => p && typeof p == "object" && "px" in p ? p.px : 0, o = n["border-top-style"] === "none" ? 0 : i(n["border-top-width"]), d = s?.children ?? [], m = d.length === 1 && (d[0].kind === "svg" || d[0].kind === "image") && typeof d[0].style.h == "number" ? d[0] : null, f = m ? Math.max(Lr(n, l), (m.style.mt ?? 0) + m.style.h) : Lr(n, l);
  return i(n["padding-top"]) + o + f;
}
const Fd = (n, l) => l === "uppercase" ? n.toUpperCase() : l === "lowercase" ? n.toLowerCase() : l === "capitalize" ? n.replace(/\b\p{L}/gu, (s) => s.toUpperCase()) : n, qf = /* @__PURE__ */ new Set(["children", "style", "className", "key", "ref", "dangerouslySetInnerHTML"]);
function pg(n) {
  const l = {};
  for (const [s, i] of Object.entries(n.props)) {
    if (qf.has(s) || typeof i == "function" || i === void 0 || i === null || typeof i == "object") continue;
    const o = s.startsWith("aria-") || s.startsWith("data-");
    if (i === !1 && !o) continue;
    const d = s === "htmlFor" ? "for" : s === "tabIndex" ? "tabindex" : s;
    l[d] = typeof i == "boolean" ? o ? String(i) : "" : String(i);
  }
  return { tag: n.tagName, classes: n.classList, attrs: l };
}
const hg = (n) => n === "className" ? "class" : /^(viewBox|preserveAspectRatio|gradientUnits|gradientTransform|patternUnits|xmlns)$/.test(n) ? n : n.replace(/[A-Z]/g, (l) => `-${l.toLowerCase()}`), Id = (n) => String(n).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
function gg(n) {
  if (n.props["data-perch-markup"]) return String(n.props["data-perch-markup"]);
  const l = (s) => {
    const i = [];
    for (const [d, m] of Object.entries(s.props))
      qf.has(d) || typeof m == "function" || m === void 0 || m === null || m === !1 || typeof m == "object" || d.startsWith("data-") || d.startsWith("aria-") || d === "focusable" || d === "role" || d === "title" || i.push(`${hg(d)}="${Id(m === !0 ? "" : m)}"`);
    s.tagName === "svg" && !s.props.xmlns && i.unshift('xmlns="http://www.w3.org/2000/svg"');
    const o = s.childNodes.map((d) => d instanceof $r ? Id(d.data) : l(d)).join("");
    return `<${s.tagName}${i.length ? ` ${i.join(" ")}` : ""}>${o}</${s.tagName}>`;
  };
  return l(n);
}
function bg(n) {
  const l = n.theme?.() ?? {}, s = {};
  for (const i of Cf) l[i] && (s[i] = l[i]);
  return s;
}
const vg = { font_features: "" };
function yg(n, l, s, i = {}, o = null) {
  const d = bg(l), m = l.viewport?.() ?? { width: 1e3, height: 800 }, f = JSON.stringify([d, m]);
  (i.look !== f || i.sheet !== s) && Object.assign(i, { look: f, sheet: s, cache: /* @__PURE__ */ new WeakMap(), cascade: new K0(s, { theme: d, viewport: m }), top: null });
  const { cascade: p, cache: v } = i, k = { cascade: p, cache: v, viewport: m, findings: new P0(), measure: l.lineHeight ? (z) => l.lineHeight(z) : null };
  i.top ??= p.compute(n.body, p.compute(n.documentElement, null));
  const E = n.body.children.map((z) => Hf(z, i.top, vg, k));
  if (o?.length) {
    const z = /* @__PURE__ */ new Map(), S = (w) => {
      w.id && z.set(w.id, w);
      for (const _ of w.children ?? []) S(_);
    };
    E.forEach(S), fg(n, o, z);
  }
  const x = /* @__PURE__ */ new Set();
  for (const z of [n, n.defaultView])
    for (const { type: S } of z?.listeners ?? []) Vd[S] && x.add(Vd[S]);
  return { schema: L0, root: E[0] ?? null, overlays: E.slice(1), document_events: [...x].sort(), unsupported: k.findings.list() };
}
const xg = { layers: ["properties", "theme", "base", "utilities"], properties: { "--tw-translate-x": { inherits: !1, initial: "0" }, "--tw-translate-y": { inherits: !1, initial: "0" }, "--tw-translate-z": { inherits: !1, initial: "0" }, "--tw-rotate-x": { inherits: !1, initial: null }, "--tw-rotate-y": { inherits: !1, initial: null }, "--tw-rotate-z": { inherits: !1, initial: null }, "--tw-skew-x": { inherits: !1, initial: null }, "--tw-skew-y": { inherits: !1, initial: null }, "--tw-space-y-reverse": { inherits: !1, initial: "0" }, "--tw-border-style": { inherits: !1, initial: "solid" }, "--tw-leading": { inherits: !1, initial: null }, "--tw-font-weight": { inherits: !1, initial: null }, "--tw-tracking": { inherits: !1, initial: null }, "--tw-ordinal": { inherits: !1, initial: null }, "--tw-slashed-zero": { inherits: !1, initial: null }, "--tw-numeric-figure": { inherits: !1, initial: null }, "--tw-numeric-spacing": { inherits: !1, initial: null }, "--tw-numeric-fraction": { inherits: !1, initial: null }, "--tw-shadow": { inherits: !1, initial: "0 0 #0000" }, "--tw-shadow-color": { inherits: !1, initial: null }, "--tw-shadow-alpha": { inherits: !1, initial: "100%" }, "--tw-inset-shadow": { inherits: !1, initial: "0 0 #0000" }, "--tw-inset-shadow-color": { inherits: !1, initial: null }, "--tw-inset-shadow-alpha": { inherits: !1, initial: "100%" }, "--tw-ring-color": { inherits: !1, initial: null }, "--tw-ring-shadow": { inherits: !1, initial: "0 0 #0000" }, "--tw-inset-ring-color": { inherits: !1, initial: null }, "--tw-inset-ring-shadow": { inherits: !1, initial: "0 0 #0000" }, "--tw-ring-inset": { inherits: !1, initial: null }, "--tw-ring-offset-width": { inherits: !1, initial: "0" }, "--tw-ring-offset-color": { inherits: !1, initial: "#fff" }, "--tw-ring-offset-shadow": { inherits: !1, initial: "0 0 #0000" }, "--tw-outline-style": { inherits: !1, initial: "solid" }, "--tw-blur": { inherits: !1, initial: null }, "--tw-brightness": { inherits: !1, initial: null }, "--tw-contrast": { inherits: !1, initial: null }, "--tw-grayscale": { inherits: !1, initial: null }, "--tw-hue-rotate": { inherits: !1, initial: null }, "--tw-invert": { inherits: !1, initial: null }, "--tw-opacity": { inherits: !1, initial: null }, "--tw-saturate": { inherits: !1, initial: null }, "--tw-sepia": { inherits: !1, initial: null }, "--tw-drop-shadow": { inherits: !1, initial: null }, "--tw-drop-shadow-color": { inherits: !1, initial: null }, "--tw-drop-shadow-alpha": { inherits: !1, initial: "100%" }, "--tw-drop-shadow-size": { inherits: !1, initial: null }, "--tw-backdrop-blur": { inherits: !1, initial: null }, "--tw-backdrop-brightness": { inherits: !1, initial: null }, "--tw-backdrop-contrast": { inherits: !1, initial: null }, "--tw-backdrop-grayscale": { inherits: !1, initial: null }, "--tw-backdrop-hue-rotate": { inherits: !1, initial: null }, "--tw-backdrop-invert": { inherits: !1, initial: null }, "--tw-backdrop-opacity": { inherits: !1, initial: null }, "--tw-backdrop-saturate": { inherits: !1, initial: null }, "--tw-backdrop-sepia": { inherits: !1, initial: null }, "--tw-duration": { inherits: !1, initial: null }, "--tw-ease": { inherits: !1, initial: null }, "--tw-content": { inherits: !1, initial: '""' } }, rules: [[":root, :host", null, 2, [["--spacing", ".25rem"], ["--text-xs", ".75rem"], ["--text-xs--line-height", "calc(1 / .75)"], ["--text-sm", ".875rem"], ["--text-sm--line-height", "calc(1.25 / .875)"], ["--font-weight-normal", "400"], ["--font-weight-medium", "500"], ["--font-weight-semibold", "600"], ["--font-weight-bold", "700"], ["--tracking-normal", "0em"], ["--tracking-wide", ".025em"], ["--leading-tight", "1.25"], ["--leading-relaxed", "1.625"], ["--ease-out", "cubic-bezier(0, 0, .2, 1)"], ["--animate-pulse", "pulse 2s cubic-bezier(.4, 0, .6, 1) infinite"], ["--blur-xl", "24px"], ["--default-transition-duration", ".15s"], ["--default-transition-timing-function", "cubic-bezier(.4, 0, .2, 1)"], ["--animate-toast-in", "toast-in .2s cubic-bezier(.22, 1, .36, 1)"], ["--animate-host-pulse", "host-connecting-pulse 1.4s ease-in-out infinite"], ["--animate-drop-zone", "drop-zone-in .14s ease-out, drop-zone-pulse 1.2s ease-in-out .14s infinite"]]], ["::selection", null, 3, [["background", "var(--accent)"], ["color", "var(--panel-bg)"]]], [":where(input, textarea)::placeholder", null, 3, [["color", "var(--subtext-0)"], ["opacity", "1"]]], [":where(button, input, select, textarea)", null, 3, [["border", "0"]]], [':where(button, a[href], select, summary, [role="button"], [role="menuitem"]):focus-visible', null, 3, [["outline", "2px solid var(--accent)"], ["outline-offset", "-2px"]]], ["::-webkit-scrollbar", null, 3, [["width", "var(--scrollbar-size)"], ["height", "var(--scrollbar-size)"]]], ["::-webkit-scrollbar-track", null, 3, [["background", "none"]]], ["::-webkit-scrollbar-corner", null, 3, [["background", "none"]]], ["::-webkit-scrollbar-thumb", null, 3, [["background", "var(--text)"]]], ["::-webkit-scrollbar-thumb", null, 3, [["background", "color-mix(in srgb, var(--text) 20%, transparent)"]]], ["::-webkit-scrollbar-thumb", null, 3, [["border-radius", "var(--scrollbar-size)"]]], ["::-webkit-scrollbar-thumb:hover", null, 3, [["background", "var(--text)"]]], ["::-webkit-scrollbar-thumb:hover", null, 3, [["background", "color-mix(in srgb, var(--text) 40%, transparent)"]]], [".xterm .xterm-scrollable-element > .xterm-scrollbar > .xterm-slider", null, 3, [["border-radius", "var(--scrollbar-size)"]]], [".\\@container, .\\[container-type\\:inline-size\\]", null, 4, [["container-type", "inline-size"]]], [".pointer-events-auto", null, 4, [["pointer-events", "auto"]]], [".pointer-events-none", null, 4, [["pointer-events", "none"]]], [".collapse", null, 4, [["visibility", "collapse"]]], [".invisible", null, 4, [["visibility", "hidden"]]], [".visible", null, 4, [["visibility", "visible"]]], [".sr-only", null, 4, [["clip-path", "inset(50%)"], ["white-space", "nowrap"], ["border-width", "0"], ["width", "1px"], ["height", "1px"], ["margin", "-1px"], ["padding", "0"], ["position", "absolute"], ["overflow", "hidden"]]], [".absolute", null, 4, [["position", "absolute"]]], [".fixed", null, 4, [["position", "fixed"]]], [".relative", null, 4, [["position", "relative"]]], [".static", null, 4, [["position", "static"]]], [".sticky", null, 4, [["position", "sticky"]]], [".inset-0", null, 4, [["inset", "0"]]], [".inset-x-0", null, 4, [["inset-inline", "0"]]], [".inset-x-2", null, 4, [["inset-inline", "calc(var(--spacing) * 2)"]]], [".-top-1", null, 4, [["top", "calc(var(--spacing) * -1)"]]], [".-top-1\\.5", null, 4, [["top", "calc(var(--spacing) * -1.5)"]]], [".top-0", null, 4, [["top", "0"]]], [".top-1", null, 4, [["top", "var(--spacing)"]]], [".top-1\\.5", null, 4, [["top", "calc(var(--spacing) * 1.5)"]]], [".top-1\\/2", null, 4, [["top", "50%"]]], [".top-2", null, 4, [["top", "calc(var(--spacing) * 2)"]]], [".top-4", null, 4, [["top", "calc(var(--spacing) * 4)"]]], [".top-\\[0\\.1rem\\]", null, 4, [["top", ".1rem"]]], [".top-\\[7px\\]", null, 4, [["top", "7px"]]], [".top-\\[max\\(0\\.75rem\\,env\\(safe-area-inset-top\\)\\)\\]", null, 4, [["top", "max(.75rem, env(safe-area-inset-top))"]]], [".top-full", null, 4, [["top", "100%"]]], [".top-px", null, 4, [["top", "1px"]]], [".-right-1", null, 4, [["right", "calc(var(--spacing) * -1)"]]], [".-right-1\\.5", null, 4, [["right", "calc(var(--spacing) * -1.5)"]]], [".right-0", null, 4, [["right", "0"]]], [".right-1", null, 4, [["right", "var(--spacing)"]]], [".right-3", null, 4, [["right", "calc(var(--spacing) * 3)"]]], [".right-4", null, 4, [["right", "calc(var(--spacing) * 4)"]]], [".right-\\[0\\.8rem\\]", null, 4, [["right", ".8rem"]]], [".right-\\[0\\.25rem\\]", null, 4, [["right", ".25rem"]]], [".right-\\[max\\(0\\.75rem\\,env\\(safe-area-inset-right\\)\\)\\]", null, 4, [["right", "max(.75rem, env(safe-area-inset-right))"]]], [".right-full", null, 4, [["right", "100%"]]], [".bottom-0", null, 4, [["bottom", "0"]]], [".bottom-2", null, 4, [["bottom", "calc(var(--spacing) * 2)"]]], [".bottom-3", null, 4, [["bottom", "calc(var(--spacing) * 3)"]]], [".bottom-\\[0\\.8rem\\]", null, 4, [["bottom", ".8rem"]]], [".bottom-full", null, 4, [["bottom", "100%"]]], [".-left-8", null, 4, [["left", "calc(var(--spacing) * -8)"]]], [".-left-\\[2px\\]", null, 4, [["left", "-2px"]]], [".left-0", null, 4, [["left", "0"]]], [".left-2", null, 4, [["left", "calc(var(--spacing) * 2)"]]], [".left-\\[0\\.1rem\\]", null, 4, [["left", ".1rem"]]], [".left-\\[max\\(0\\.75rem\\,env\\(safe-area-inset-left\\)\\)\\]", null, 4, [["left", "max(.75rem, env(safe-area-inset-left))"]]], [".left-full", null, 4, [["left", "100%"]]], [".left-px", null, 4, [["left", "1px"]]], [".isolate", null, 4, [["isolation", "isolate"]]], [".z-4", null, 4, [["z-index", "4"]]], [".z-5", null, 4, [["z-index", "5"]]], [".z-10", null, 4, [["z-index", "10"]]], [".z-20", null, 4, [["z-index", "20"]]], [".z-30", null, 4, [["z-index", "30"]]], [".z-40", null, 4, [["z-index", "40"]]], [".z-50", null, 4, [["z-index", "50"]]], [".z-\\[2\\]", null, 4, [["z-index", "2"]]], [".z-\\[3\\]", null, 4, [["z-index", "3"]]], [".z-\\[5\\]", null, 4, [["z-index", "5"]]], [".z-\\[1000\\]", null, 4, [["z-index", "1000"]]], [".z-\\[2000\\]", null, 4, [["z-index", "2000"]]], [".z-\\[2100\\]", null, 4, [["z-index", "2100"]]], [".z-\\[2200\\]", null, 4, [["z-index", "2200"]]], [".z-\\[3000\\]", null, 4, [["z-index", "3000"]]], [".z-\\[3100\\]", null, 4, [["z-index", "3100"]]], [".z-\\[4000\\]", null, 4, [["z-index", "4000"]]], [".z-\\[9998\\]", null, 4, [["z-index", "9998"]]], [".z-\\[9999\\]", null, 4, [["z-index", "9999"]]], [".z-\\[10000\\]", null, 4, [["z-index", "10000"]]], [".z-auto", null, 4, [["z-index", "auto"]]], [".order-last", null, 4, [["order", "9999"]]], [".col-\\[1\\/-1\\]", null, 4, [["grid-column", "1 / -1"]]], [".container", null, 4, [["width", "100%"]]], [".container", ["(min-width: 40rem)"], 4, [["max-width", "40rem"]]], [".container", ["(min-width: 48rem)"], 4, [["max-width", "48rem"]]], [".container", ["(min-width: 64rem)"], 4, [["max-width", "64rem"]]], [".container", ["(min-width: 80rem)"], 4, [["max-width", "80rem"]]], [".container", ["(min-width: 96rem)"], 4, [["max-width", "96rem"]]], [".m-0", null, 4, [["margin", "0"]]], [".m-2", null, 4, [["margin", "calc(var(--spacing) * 2)"]]], [".m-\\[0\\.7rem\\]", null, 4, [["margin", ".7rem"]]], [".m-auto", null, 4, [["margin", "auto"]]], [".mx-0", null, 4, [["margin-inline", "0"]]], [".mx-0\\.5", null, 4, [["margin-inline", "calc(var(--spacing) * .5)"]]], [".mx-2", null, 4, [["margin-inline", "calc(var(--spacing) * 2)"]]], [".mx-3", null, 4, [["margin-inline", "calc(var(--spacing) * 3)"]]], [".mx-4", null, 4, [["margin-inline", "calc(var(--spacing) * 4)"]]], [".mx-\\[0\\.3rem\\]", null, 4, [["margin-inline", ".3rem"]]], [".mx-\\[0\\.7rem\\]", null, 4, [["margin-inline", ".7rem"]]], [".mx-\\[0\\.65rem\\]", null, 4, [["margin-inline", ".65rem"]]], [".mx-\\[3px\\]", null, 4, [["margin-inline", "3px"]]], [".mx-\\[11px\\]", null, 4, [["margin-inline", "11px"]]], [".mx-auto", null, 4, [["margin-inline", "auto"]]], [".my-0\\.5", null, 4, [["margin-block", "calc(var(--spacing) * .5)"]]], [".my-1", null, 4, [["margin-block", "var(--spacing)"]]], [".my-2", null, 4, [["margin-block", "calc(var(--spacing) * 2)"]]], [".my-\\[0\\.2rem\\]", null, 4, [["margin-block", ".2rem"]]], [".my-\\[0\\.3rem\\]", null, 4, [["margin-block", ".3rem"]]], [".my-\\[0\\.6rem\\]", null, 4, [["margin-block", ".6rem"]]], [".my-\\[0\\.28rem\\]", null, 4, [["margin-block", ".28rem"]]], [".my-\\[0\\.45rem\\]", null, 4, [["margin-block", ".45rem"]]], [".my-\\[0\\.55rem\\]", null, 4, [["margin-block", ".55rem"]]], [".my-\\[3px\\]", null, 4, [["margin-block", "3px"]]], [".-mt-\\[2px\\]", null, 4, [["margin-top", "-2px"]]], [".mt-0", null, 4, [["margin-top", "0"]]], [".mt-0\\.5", null, 4, [["margin-top", "calc(var(--spacing) * .5)"]]], [".mt-1", null, 4, [["margin-top", "var(--spacing)"]]], [".mt-1\\.5", null, 4, [["margin-top", "calc(var(--spacing) * 1.5)"]]], [".mt-2", null, 4, [["margin-top", "calc(var(--spacing) * 2)"]]], [".mt-3", null, 4, [["margin-top", "calc(var(--spacing) * 3)"]]], [".mt-4", null, 4, [["margin-top", "calc(var(--spacing) * 4)"]]], [".mt-\\[0\\.1rem\\]", null, 4, [["margin-top", ".1rem"]]], [".mt-\\[0\\.2rem\\]", null, 4, [["margin-top", ".2rem"]]], [".mt-\\[0\\.3rem\\]", null, 4, [["margin-top", ".3rem"]]], [".mt-\\[0\\.4rem\\]", null, 4, [["margin-top", ".4rem"]]], [".mt-\\[0\\.5rem\\]", null, 4, [["margin-top", ".5rem"]]], [".mt-\\[0\\.15rem\\]", null, 4, [["margin-top", ".15rem"]]], [".mt-\\[0\\.35rem\\]", null, 4, [["margin-top", ".35rem"]]], [".mr-1", null, 4, [["margin-right", "var(--spacing)"]]], [".mr-1\\.5", null, 4, [["margin-right", "calc(var(--spacing) * 1.5)"]]], [".mr-\\[0\\.3rem\\]", null, 4, [["margin-right", ".3rem"]]], [".mr-\\[0\\.7rem\\]", null, 4, [["margin-right", ".7rem"]]], [".mr-auto", null, 4, [["margin-right", "auto"]]], [".mb-0", null, 4, [["margin-bottom", "0"]]], [".mb-0\\.5", null, 4, [["margin-bottom", "calc(var(--spacing) * .5)"]]], [".mb-1", null, 4, [["margin-bottom", "var(--spacing)"]]], [".mb-2", null, 4, [["margin-bottom", "calc(var(--spacing) * 2)"]]], [".mb-3", null, 4, [["margin-bottom", "calc(var(--spacing) * 3)"]]], [".mb-4", null, 4, [["margin-bottom", "calc(var(--spacing) * 4)"]]], [".mb-8", null, 4, [["margin-bottom", "calc(var(--spacing) * 8)"]]], [".mb-\\[0\\.2rem\\]", null, 4, [["margin-bottom", ".2rem"]]], [".mb-\\[0\\.3rem\\]", null, 4, [["margin-bottom", ".3rem"]]], [".mb-\\[0\\.4rem\\]", null, 4, [["margin-bottom", ".4rem"]]], [".mb-\\[0\\.6rem\\]", null, 4, [["margin-bottom", ".6rem"]]], [".mb-\\[0\\.7rem\\]", null, 4, [["margin-bottom", ".7rem"]]], [".mb-\\[0\\.9rem\\]", null, 4, [["margin-bottom", ".9rem"]]], [".mb-\\[0\\.15rem\\]", null, 4, [["margin-bottom", ".15rem"]]], [".mb-\\[0\\.35rem\\]", null, 4, [["margin-bottom", ".35rem"]]], [".mb-\\[0\\.55rem\\]", null, 4, [["margin-bottom", ".55rem"]]], [".mb-\\[1\\.1rem\\]", null, 4, [["margin-bottom", "1.1rem"]]], [".-ml-0\\.5", null, 4, [["margin-left", "calc(var(--spacing) * -.5)"]]], [".-ml-1", null, 4, [["margin-left", "calc(var(--spacing) * -1)"]]], [".-ml-2", null, 4, [["margin-left", "calc(var(--spacing) * -2)"]]], [".ml-1", null, 4, [["margin-left", "var(--spacing)"]]], [".ml-2", null, 4, [["margin-left", "calc(var(--spacing) * 2)"]]], [".ml-\\[0\\.4rem\\]", null, 4, [["margin-left", ".4rem"]]], [".ml-\\[0\\.5rem\\]", null, 4, [["margin-left", ".5rem"]]], [".ml-\\[0\\.9rem\\]", null, 4, [["margin-left", ".9rem"]]], [".ml-\\[0\\.35rem\\]", null, 4, [["margin-left", ".35rem"]]], [".ml-\\[0\\.55rem\\]", null, 4, [["margin-left", ".55rem"]]], [".ml-\\[1\\.15rem\\]", null, 4, [["margin-left", "1.15rem"]]], [".ml-\\[1\\.45rem\\]", null, 4, [["margin-left", "1.45rem"]]], [".ml-\\[2\\.025rem\\]", null, 4, [["margin-left", "2.025rem"]]], [".ml-\\[2\\.375rem\\]", null, 4, [["margin-left", "2.375rem"]]], [".ml-\\[6\\.1rem\\]", null, 4, [["margin-left", "6.1rem"]]], [".ml-auto", null, 4, [["margin-left", "auto"]]], [".box-border", null, 4, [["box-sizing", "border-box"]]], [".\\!hidden", null, 4, [["display", "none", 1]]], [".\\[display\\:-webkit-box\\]", null, 4, [["display", "-webkit-box"]]], [".\\[display\\:var\\(--pane-grip\\,flex\\)\\]", null, 4, [["display", "var(--pane-grip, flex)"]]], [".block", null, 4, [["display", "block"]]], [".contents", null, 4, [["display", "contents"]]], [".flex", null, 4, [["display", "flex"]]], [".grid", null, 4, [["display", "grid"]]], [".hidden", null, 4, [["display", "none"]]], [".inline", null, 4, [["display", "inline"]]], [".inline-block", null, 4, [["display", "inline-block"]]], [".inline-flex", null, 4, [["display", "inline-flex"]]], [".table", null, 4, [["display", "table"]]], [".size-1", null, 4, [["width", "var(--spacing)"], ["height", "var(--spacing)"]]], [".size-1\\.5", null, 4, [["width", "calc(var(--spacing) * 1.5)"], ["height", "calc(var(--spacing) * 1.5)"]]], [".size-2", null, 4, [["width", "calc(var(--spacing) * 2)"], ["height", "calc(var(--spacing) * 2)"]]], [".size-3", null, 4, [["width", "calc(var(--spacing) * 3)"], ["height", "calc(var(--spacing) * 3)"]]], [".size-5", null, 4, [["width", "calc(var(--spacing) * 5)"], ["height", "calc(var(--spacing) * 5)"]]], [".size-6", null, 4, [["width", "calc(var(--spacing) * 6)"], ["height", "calc(var(--spacing) * 6)"]]], [".size-7", null, 4, [["width", "calc(var(--spacing) * 7)"], ["height", "calc(var(--spacing) * 7)"]]], [".size-8", null, 4, [["width", "calc(var(--spacing) * 8)"], ["height", "calc(var(--spacing) * 8)"]]], [".size-11", null, 4, [["width", "calc(var(--spacing) * 11)"], ["height", "calc(var(--spacing) * 11)"]]], [".size-14", null, 4, [["width", "calc(var(--spacing) * 14)"], ["height", "calc(var(--spacing) * 14)"]]], [".size-\\[0\\.6rem\\]", null, 4, [["width", ".6rem"], ["height", ".6rem"]]], [".size-\\[1\\.2rem\\]", null, 4, [["width", "1.2rem"], ["height", "1.2rem"]]], [".size-\\[5px\\]", null, 4, [["width", "5px"], ["height", "5px"]]], [".size-\\[14px\\]", null, 4, [["width", "14px"], ["height", "14px"]]], [".size-\\[calc\\(14px\\*var\\(--zoom\\,1\\)\\)\\]", null, 4, [["width", "calc(14px * var(--zoom, 1))"], ["height", "calc(14px * var(--zoom, 1))"]]], [".size-full", null, 4, [["width", "100%"], ["height", "100%"]]], [".h-1", null, 4, [["height", "var(--spacing)"]]], [".h-1\\.5", null, 4, [["height", "calc(var(--spacing) * 1.5)"]]], [".h-2", null, 4, [["height", "calc(var(--spacing) * 2)"]]], [".h-3", null, 4, [["height", "calc(var(--spacing) * 3)"]]], [".h-4", null, 4, [["height", "calc(var(--spacing) * 4)"]]], [".h-5", null, 4, [["height", "calc(var(--spacing) * 5)"]]], [".h-6", null, 4, [["height", "calc(var(--spacing) * 6)"]]], [".h-7", null, 4, [["height", "calc(var(--spacing) * 7)"]]], [".h-8", null, 4, [["height", "calc(var(--spacing) * 8)"]]], [".h-9", null, 4, [["height", "calc(var(--spacing) * 9)"]]], [".h-11", null, 4, [["height", "calc(var(--spacing) * 11)"]]], [".h-12", null, 4, [["height", "calc(var(--spacing) * 12)"]]], [".h-44", null, 4, [["height", "calc(var(--spacing) * 44)"]]], [".h-\\[1\\.1rem\\]", null, 4, [["height", "1.1rem"]]], [".h-\\[1\\.3rem\\]", null, 4, [["height", "1.3rem"]]], [".h-\\[1\\.4rem\\]", null, 4, [["height", "1.4rem"]]], [".h-\\[1\\.25rem\\]", null, 4, [["height", "1.25rem"]]], [".h-\\[2px\\]", null, 4, [["height", "2px"]]], [".h-\\[14px\\]", null, 4, [["height", "14px"]]], [".h-\\[18px\\]", null, 4, [["height", "18px"]]], [".h-\\[43px\\]", null, 4, [["height", "43px"]]], [".h-\\[calc\\(100\\%-max\\(0\\.5rem\\,env\\(safe-area-inset-top\\)\\)\\)\\]", null, 4, [["height", "calc(100% - max(.5rem, env(safe-area-inset-top)))"]]], [".h-full", null, 4, [["height", "100%"]]], [".h-px", null, 4, [["height", "1px"]]], [".max-h-40", null, 4, [["max-height", "calc(var(--spacing) * 40)"]]], [".max-h-56", null, 4, [["max-height", "calc(var(--spacing) * 56)"]]], [".max-h-72", null, 4, [["max-height", "calc(var(--spacing) * 72)"]]], [".max-h-\\[8rem\\]", null, 4, [["max-height", "8rem"]]], [".max-h-\\[13rem\\]", null, 4, [["max-height", "13rem"]]], [".max-h-\\[30\\%\\]", null, 4, [["max-height", "30%"]]], [".max-h-\\[30vh\\]", null, 4, [["max-height", "30vh"]]], [".max-h-\\[35vh\\]", null, 4, [["max-height", "35vh"]]], [".max-h-\\[40\\%\\]", null, 4, [["max-height", "40%"]]], [".max-h-\\[50dvh\\]", null, 4, [["max-height", "50dvh"]]], [".max-h-\\[60\\%\\]", null, 4, [["max-height", "60%"]]], [".max-h-\\[70\\%\\]", null, 4, [["max-height", "70%"]]], [".max-h-\\[85vh\\]", null, 4, [["max-height", "85vh"]]], [".max-h-\\[90\\%\\]", null, 4, [["max-height", "90%"]]], [".max-h-\\[190px\\]", null, 4, [["max-height", "190px"]]], [".max-h-\\[240px\\]", null, 4, [["max-height", "240px"]]], [".max-h-\\[260px\\]", null, 4, [["max-height", "260px"]]], [".max-h-\\[calc\\(85vh-4rem\\)\\]", null, 4, [["max-height", "calc(85vh - 4rem)"]]], [".max-h-\\[calc\\(100dvh_-_4rem\\)\\]", null, 4, [["max-height", "calc(100dvh - 4rem)"]]], [".max-h-\\[min\\(420px\\,calc\\(100dvh_-_16vh_-_2rem\\)\\)\\]", null, 4, [["max-height", "min(420px, 100dvh - 16vh - 2rem)"]]], [".max-h-\\[min\\(480px\\,calc\\(100dvh_-_16vh_-_2rem\\)\\)\\]", null, 4, [["max-height", "min(480px, 100dvh - 16vh - 2rem)"]]], [".max-h-full", null, 4, [["max-height", "100%"]]], [".min-h-0", null, 4, [["min-height", "0"]]], [".min-h-6", null, 4, [["min-height", "calc(var(--spacing) * 6)"]]], [".min-h-7", null, 4, [["min-height", "calc(var(--spacing) * 7)"]]], [".min-h-8", null, 4, [["min-height", "calc(var(--spacing) * 8)"]]], [".min-h-9", null, 4, [["min-height", "calc(var(--spacing) * 9)"]]], [".min-h-10", null, 4, [["min-height", "calc(var(--spacing) * 10)"]]], [".min-h-11", null, 4, [["min-height", "calc(var(--spacing) * 11)"]]], [".min-h-20", null, 4, [["min-height", "calc(var(--spacing) * 20)"]]], [".min-h-40", null, 4, [["min-height", "calc(var(--spacing) * 40)"]]], [".min-h-\\[1\\.5em\\]", null, 4, [["min-height", "1.5em"]]], [".min-h-\\[1\\.8rem\\]", null, 4, [["min-height", "1.8rem"]]], [".min-h-\\[2\\.5rem\\]", null, 4, [["min-height", "2.5rem"]]], [".min-h-\\[3\\.2rem\\]", null, 4, [["min-height", "3.2rem"]]], [".min-h-\\[3\\.25rem\\]", null, 4, [["min-height", "3.25rem"]]], [".min-h-\\[6rem\\]", null, 4, [["min-height", "6rem"]]], [".min-h-\\[8rem\\]", null, 4, [["min-height", "8rem"]]], [".min-h-\\[10rem\\]", null, 4, [["min-height", "10rem"]]], [".min-h-\\[12rem\\]", null, 4, [["min-height", "12rem"]]], [".min-h-\\[13rem\\]", null, 4, [["min-height", "13rem"]]], [".min-h-\\[32px\\]", null, 4, [["min-height", "32px"]]], [".min-h-\\[44px\\]", null, 4, [["min-height", "44px"]]], [".min-h-\\[60px\\]", null, 4, [["min-height", "60px"]]], [".min-h-\\[100dvh\\]", null, 4, [["min-height", "100dvh"]]], [".min-h-\\[calc\\(22px\\*var\\(--zoom\\,1\\)\\)\\]", null, 4, [["min-height", "calc(22px * var(--zoom, 1))"]]], [".min-h-full", null, 4, [["min-height", "100%"]]], [".w-2", null, 4, [["width", "calc(var(--spacing) * 2)"]]], [".w-2\\.5", null, 4, [["width", "calc(var(--spacing) * 2.5)"]]], [".w-3", null, 4, [["width", "calc(var(--spacing) * 3)"]]], [".w-4", null, 4, [["width", "calc(var(--spacing) * 4)"]]], [".w-5", null, 4, [["width", "calc(var(--spacing) * 5)"]]], [".w-7", null, 4, [["width", "calc(var(--spacing) * 7)"]]], [".w-8", null, 4, [["width", "calc(var(--spacing) * 8)"]]], [".w-9", null, 4, [["width", "calc(var(--spacing) * 9)"]]], [".w-10", null, 4, [["width", "calc(var(--spacing) * 10)"]]], [".w-20", null, 4, [["width", "calc(var(--spacing) * 20)"]]], [".w-40", null, 4, [["width", "calc(var(--spacing) * 40)"]]], [".w-44", null, 4, [["width", "calc(var(--spacing) * 44)"]]], [".w-60", null, 4, [["width", "calc(var(--spacing) * 60)"]]], [".w-\\[1\\.1rem\\]", null, 4, [["width", "1.1rem"]]], [".w-\\[1\\.4rem\\]", null, 4, [["width", "1.4rem"]]], [".w-\\[1\\.6rem\\]", null, 4, [["width", "1.6rem"]]], [".w-\\[1\\.25rem\\]", null, 4, [["width", "1.25rem"]]], [".w-\\[2\\.4rem\\]", null, 4, [["width", "2.4rem"]]], [".w-\\[2\\.25rem\\]", null, 4, [["width", "2.25rem"]]], [".w-\\[6rem\\]", null, 4, [["width", "6rem"]]], [".w-\\[7rem\\]", null, 4, [["width", "7rem"]]], [".w-\\[11rem\\]", null, 4, [["width", "11rem"]]], [".w-\\[15rem\\]", null, 4, [["width", "15rem"]]], [".w-\\[16rem\\]", null, 4, [["width", "16rem"]]], [".w-\\[18px\\]", null, 4, [["width", "18px"]]], [".w-\\[100cqi\\]", null, 4, [["width", "100cqi"]]], [".w-\\[calc\\(\\(100\\%-0\\.875rem\\)\\/8\\)\\]", null, 4, [["width", "calc(12.5% - .109375rem)"]]], [".w-\\[calc\\(100\\%_-_0\\.6rem\\)\\]", null, 4, [["width", "calc(100% - .6rem)"]]], [".w-\\[calc\\(100\\%_-_1rem\\)\\]", null, 4, [["width", "calc(100% - 1rem)"]]], [".w-\\[min\\(22rem\\,calc\\(100vw-3rem\\)\\)\\]", null, 4, [["width", "min(22rem, 100vw - 3rem)"]]], [".w-\\[min\\(26rem\\,100\\%\\)\\]", null, 4, [["width", "min(26rem, 100%)"]]], [".w-\\[min\\(28rem\\,calc\\(100vw-2\\.5rem\\)\\)\\]", null, 4, [["width", "min(28rem, 100vw - 2.5rem)"]]], [".w-\\[min\\(30rem\\,92vw\\)\\]", null, 4, [["width", "min(30rem, 92vw)"]]], [".w-\\[min\\(32rem\\,100\\%\\)\\]", null, 4, [["width", "min(32rem, 100%)"]]], [".w-\\[min\\(340px\\,calc\\(100vw-16px\\)\\)\\]", null, 4, [["width", "min(340px, 100vw - 16px)"]]], [".w-\\[min\\(360px\\,calc\\(100vw_-_2rem\\)\\)\\]", null, 4, [["width", "min(360px, 100vw - 2rem)"]]], [".w-\\[min\\(420px\\,calc\\(100vw_-_16px\\)\\)\\]", null, 4, [["width", "min(420px, 100vw - 16px)"]]], [".w-\\[min\\(480px\\,calc\\(100vw_-_2rem\\)\\)\\]", null, 4, [["width", "min(480px, 100vw - 2rem)"]]], [".w-\\[min\\(560px\\,calc\\(100vw_-_2rem\\)\\)\\]", null, 4, [["width", "min(560px, 100vw - 2rem)"]]], [".w-\\[var\\(--sidebar-width\\,240px\\)\\]", null, 4, [["width", "var(--sidebar-width, 240px)"]]], [".w-\\[var\\(--tools-width\\)\\]", null, 4, [["width", "var(--tools-width)"]]], [".w-auto", null, 4, [["width", "auto"]]], [".w-full", null, 4, [["width", "100%"]]], [".w-px", null, 4, [["width", "1px"]]], [".max-w-24", null, 4, [["max-width", "calc(var(--spacing) * 24)"]]], [".max-w-32", null, 4, [["max-width", "calc(var(--spacing) * 32)"]]], [".max-w-\\[9rem\\]", null, 4, [["max-width", "9rem"]]], [".max-w-\\[10rem\\]", null, 4, [["max-width", "10rem"]]], [".max-w-\\[14rem\\]", null, 4, [["max-width", "14rem"]]], [".max-w-\\[16rem\\]", null, 4, [["max-width", "16rem"]]], [".max-w-\\[24rem\\]", null, 4, [["max-width", "24rem"]]], [".max-w-\\[25\\%\\]", null, 4, [["max-width", "25%"]]], [".max-w-\\[26rem\\]", null, 4, [["max-width", "26rem"]]], [".max-w-\\[28rem\\]", null, 4, [["max-width", "28rem"]]], [".max-w-\\[35\\%\\]", null, 4, [["max-width", "35%"]]], [".max-w-\\[38\\%\\]", null, 4, [["max-width", "38%"]]], [".max-w-\\[45\\%\\]", null, 4, [["max-width", "45%"]]], [".max-w-\\[46rem\\]", null, 4, [["max-width", "46rem"]]], [".max-w-\\[55\\%\\]", null, 4, [["max-width", "55%"]]], [".max-w-\\[56rem\\]", null, 4, [["max-width", "56rem"]]], [".max-w-\\[85\\%\\]", null, 4, [["max-width", "85%"]]], [".max-w-\\[140px\\]", null, 4, [["max-width", "140px"]]], [".max-w-\\[320px\\]", null, 4, [["max-width", "320px"]]], [".max-w-\\[min\\(22rem\\,calc\\(100\\%-1\\.5rem\\)\\)\\]", null, 4, [["max-width", "min(22rem, 100% - 1.5rem)"]]], [".max-w-\\[min\\(30rem\\,calc\\(100\\%-1\\.6rem\\)\\)\\]", null, 4, [["max-width", "min(30rem, 100% - 1.6rem)"]]], [".max-w-\\[min\\(34rem\\,calc\\(100\\%-1\\.5rem\\)\\)\\]", null, 4, [["max-width", "min(34rem, 100% - 1.5rem)"]]], [".max-w-\\[min\\(320px\\,calc\\(100vw_-_24px\\)\\)\\]", null, 4, [["max-width", "min(320px, 100vw - 24px)"]]], [".max-w-full", null, 4, [["max-width", "100%"]]], [".max-w-none", null, 4, [["max-width", "none"]]], [".min-w-0", null, 4, [["min-width", "0"]]], [".min-w-6", null, 4, [["min-width", "calc(var(--spacing) * 6)"]]], [".min-w-8", null, 4, [["min-width", "calc(var(--spacing) * 8)"]]], [".min-w-12", null, 4, [["min-width", "calc(var(--spacing) * 12)"]]], [".min-w-24", null, 4, [["min-width", "calc(var(--spacing) * 24)"]]], [".min-w-36", null, 4, [["min-width", "calc(var(--spacing) * 36)"]]], [".min-w-56", null, 4, [["min-width", "calc(var(--spacing) * 56)"]]], [".min-w-\\[5\\.5rem\\]", null, 4, [["min-width", "5.5rem"]]], [".min-w-\\[7rem\\]", null, 4, [["min-width", "7rem"]]], [".min-w-\\[12rem\\]", null, 4, [["min-width", "12rem"]]], [".min-w-\\[14px\\]", null, 4, [["min-width", "14px"]]], [".min-w-\\[200px\\]", null, 4, [["min-width", "200px"]]], [".min-w-fit", null, 4, [["min-width", "fit-content"]]], [".min-w-max", null, 4, [["min-width", "max-content"]]], [".flex-1", null, 4, [["flex", "1"]]], [".flex-\\[0_0_5rem\\]", null, 4, [["flex", "0 0 5rem"]]], [".flex-\\[0_0_8px\\]", null, 4, [["flex", "0 0 8px"]]], [".flex-\\[0_1_40\\%\\]", null, 4, [["flex", "0 40%"]]], [".flex-\\[1_1_100\\%\\]", null, 4, [["flex", "100%"]]], [".flex-\\[2\\]", null, 4, [["flex", "2"]]], [".flex-initial", null, 4, [["flex", "0 auto"]]], [".flex-none", null, 4, [["flex", "none"]]], [".shrink", null, 4, [["flex-shrink", "1"]]], [".shrink-0", null, 4, [["flex-shrink", "0"]]], [".shrink-\\[0\\.001\\]", null, 4, [["flex-shrink", ".001"]]], [".shrink-\\[2\\]", null, 4, [["flex-shrink", "2"]]], [".shrink-\\[3\\]", null, 4, [["flex-shrink", "3"]]], [".grow", null, 4, [["flex-grow", "1"]]], [".basis-0", null, 4, [["flex-basis", "0"]]], [".basis-\\[14rem\\]", null, 4, [["flex-basis", "14rem"]]], [".-translate-y-1\\/2", null, 4, [["--tw-translate-y", "calc(calc(1 / 2 * 100%) * -1)"], ["translate", "var(--tw-translate-x) var(--tw-translate-y)"]]], [".\\[transform\\:translateY\\(-50\\%\\)\\]", null, 4, [["transform", "translateY(-50%)"]]], [".transform", null, 4, [["transform", "var(--tw-rotate-x, ) var(--tw-rotate-y, ) var(--tw-rotate-z, ) var(--tw-skew-x, ) var(--tw-skew-y, )"]]], [".animate-drop-zone", null, 4, [["animation", "var(--animate-drop-zone)"]]], [".animate-host-pulse", null, 4, [["animation", "var(--animate-host-pulse)"]]], [".animate-pulse", null, 4, [["animation", "var(--animate-pulse)"]]], [".animate-toast-in", null, 4, [["animation", "var(--animate-toast-in)"]]], [".cursor-col-resize", null, 4, [["cursor", "col-resize"]]], [".cursor-default", null, 4, [["cursor", "default"]]], [".cursor-grab", null, 4, [["cursor", "grab"]]], [".cursor-grabbing", null, 4, [["cursor", "grabbing"]]], [".cursor-pointer", null, 4, [["cursor", "pointer"]]], [".cursor-row-resize", null, 4, [["cursor", "row-resize"]]], [".touch-none", null, 4, [["touch-action", "none"]]], [".resize", null, 4, [["resize", "both"]]], [".resize-none", null, 4, [["resize", "none"]]], [".resize-y", null, 4, [["resize", "vertical"]]], [".\\[scrollbar-width\\:none\\]", null, 4, [["scrollbar-width", "none"]]], [".list-disc", null, 4, [["list-style-type", "disc"]]], [".list-none", null, 4, [["list-style-type", "none"]]], [".appearance-none", null, 4, [["appearance", "none"]]], [".grid-cols-8", null, 4, [["grid-template-columns", "repeat(8, minmax(0, 1fr))"]]], [".grid-cols-\\[1fr_auto_1fr\\]", null, 4, [["grid-template-columns", "1fr auto 1fr"]]], [".grid-cols-\\[2\\.5rem_2\\.5rem_0\\.9rem_minmax\\(0\\,1fr\\)\\]", null, 4, [["grid-template-columns", "2.5rem 2.5rem .9rem minmax(0, 1fr)"]]], [".grid-cols-\\[auto_minmax\\(0\\,1fr\\)\\]", null, 4, [["grid-template-columns", "auto minmax(0, 1fr)"]]], [".grid-cols-\\[minmax\\(4rem\\,10rem\\)_1fr_auto\\]", null, 4, [["grid-template-columns", "minmax(4rem, 10rem) 1fr auto"]]], [".grid-cols-\\[repeat\\(2\\,minmax\\(0\\,1fr\\)\\)\\]", null, 4, [["grid-template-columns", "repeat(2, minmax(0, 1fr))"]]], [".grid-cols-\\[repeat\\(auto-fit\\,minmax\\(8rem\\,1fr\\)\\)\\]", null, 4, [["grid-template-columns", "repeat(auto-fit, minmax(8rem, 1fr))"]]], [".flex-col", null, 4, [["flex-direction", "column"]]], [".flex-row", null, 4, [["flex-direction", "row"]]], [".flex-wrap", null, 4, [["flex-wrap", "wrap"]]], [".place-items-center", null, 4, [["place-items", "center"]]], [".content-center", null, 4, [["align-content", "center"]]], [".items-baseline", null, 4, [["align-items", "baseline"]]], [".items-center", null, 4, [["align-items", "center"]]], [".items-end", null, 4, [["align-items", "flex-end"]]], [".items-start", null, 4, [["align-items", "flex-start"]]], [".items-stretch", null, 4, [["align-items", "stretch"]]], [".justify-between", null, 4, [["justify-content", "space-between"]]], [".justify-center", null, 4, [["justify-content", "center"]]], [".justify-end", null, 4, [["justify-content", "flex-end"]]], [".justify-start", null, 4, [["justify-content", "flex-start"]]], [".justify-items-center", null, 4, [["justify-items", "center"]]], [".justify-items-start", null, 4, [["justify-items", "start"]]], [".gap-0", null, 4, [["gap", "0"]]], [".gap-0\\.5", null, 4, [["gap", "calc(var(--spacing) * .5)"]]], [".gap-1", null, 4, [["gap", "var(--spacing)"]]], [".gap-1\\.5", null, 4, [["gap", "calc(var(--spacing) * 1.5)"]]], [".gap-2", null, 4, [["gap", "calc(var(--spacing) * 2)"]]], [".gap-3", null, 4, [["gap", "calc(var(--spacing) * 3)"]]], [".gap-4", null, 4, [["gap", "calc(var(--spacing) * 4)"]]], [".gap-6", null, 4, [["gap", "calc(var(--spacing) * 6)"]]], [".gap-\\[0\\.1rem\\]", null, 4, [["gap", ".1rem"]]], [".gap-\\[0\\.3rem\\]", null, 4, [["gap", ".3rem"]]], [".gap-\\[0\\.4rem\\]", null, 4, [["gap", ".4rem"]]], [".gap-\\[0\\.05rem\\]", null, 4, [["gap", ".05rem"]]], [".gap-\\[0\\.6rem\\]", null, 4, [["gap", ".6rem"]]], [".gap-\\[0\\.8rem\\]", null, 4, [["gap", ".8rem"]]], [".gap-\\[0\\.16rem\\]", null, 4, [["gap", ".16rem"]]], [".gap-\\[0\\.32rem\\]", null, 4, [["gap", ".32rem"]]], [".gap-\\[0\\.35rem\\]", null, 4, [["gap", ".35rem"]]], [".gap-\\[0\\.45rem\\]", null, 4, [["gap", ".45rem"]]], [".gap-\\[0\\.55rem\\]", null, 4, [["gap", ".55rem"]]], [".gap-\\[0\\.65rem\\]", null, 4, [["gap", ".65rem"]]], [".gap-\\[0\\.85rem\\]", null, 4, [["gap", ".85rem"]]], [".gap-\\[1px\\]", null, 4, [["gap", "1px"]]], [".gap-\\[2px\\]", null, 4, [["gap", "2px"]]], [".gap-\\[3px\\]", null, 4, [["gap", "3px"]]], [".gap-\\[7px\\]", null, 4, [["gap", "7px"]]], [".gap-\\[13px\\]", null, 4, [["gap", "13px"]]], [":where(.space-y-0\\.5 > :not(:last-child))", null, 4, [["--tw-space-y-reverse", "0"], ["margin-block-start", "calc(calc(var(--spacing) * .5) * var(--tw-space-y-reverse))"], ["margin-block-end", "calc(calc(var(--spacing) * .5) * calc(1 - var(--tw-space-y-reverse)))"]]], [".gap-x-3", null, 4, [["column-gap", "calc(var(--spacing) * 3)"]]], [".gap-x-4", null, 4, [["column-gap", "calc(var(--spacing) * 4)"]]], [".gap-x-\\[0\\.7rem\\]", null, 4, [["column-gap", ".7rem"]]], [".gap-x-\\[0\\.9rem\\]", null, 4, [["column-gap", ".9rem"]]], [".gap-y-1", null, 4, [["row-gap", "var(--spacing)"]]], [".gap-y-\\[0\\.3rem\\]", null, 4, [["row-gap", ".3rem"]]], [".self-center", null, 4, [["align-self", "center"]]], [".self-end", null, 4, [["align-self", "flex-end"]]], [".self-start", null, 4, [["align-self", "flex-start"]]], [".self-stretch", null, 4, [["align-self", "stretch"]]], [".justify-self-start", null, 4, [["justify-self", "flex-start"]]], [".truncate", null, 4, [["text-overflow", "ellipsis"], ["white-space", "nowrap"], ["overflow", "hidden"]]], [".overflow-auto", null, 4, [["overflow", "auto"]]], [".overflow-hidden", null, 4, [["overflow", "hidden"]]], [".overflow-visible", null, 4, [["overflow", "visible"]]], [".overflow-x-auto", null, 4, [["overflow-x", "auto"]]], [".overflow-y-auto", null, 4, [["overflow-y", "auto"]]], [".overscroll-contain", null, 4, [["overscroll-behavior", "contain"]]], [".rounded, .rounded-\\[0\\.25rem\\]", null, 4, [["border-radius", ".25rem"]]], [".rounded-\\[1\\.5rem\\]", null, 4, [["border-radius", "1.5rem"]]], [".rounded-\\[2px\\]", null, 4, [["border-radius", "2px"]]], [".rounded-\\[3px\\]", null, 4, [["border-radius", "3px"]]], [".rounded-\\[12px\\]", null, 4, [["border-radius", "12px"]]], [".rounded-\\[50\\%\\]", null, 4, [["border-radius", "50%"]]], [".rounded-\\[999px\\]", null, 4, [["border-radius", "999px"]]], [".rounded-\\[calc\\(var\\(--radius\\)\\*2\\)\\]", null, 4, [["border-radius", "calc(var(--radius) * 2)"]]], [".rounded-\\[var\\(--card-radius\\,8px\\)\\]", null, 4, [["border-radius", "var(--card-radius, 8px)"]]], [".rounded-\\[var\\(--card-radius\\,12px\\)\\]", null, 4, [["border-radius", "var(--card-radius, 12px)"]]], [".rounded-full", null, 4, [["border-radius", "3.40282e38px"]]], [".rounded-none", null, 4, [["border-radius", "0"]]], [".rounded-soft", null, 4, [["border-radius", "var(--radius-pane)"]]], [".rounded-ui", null, 4, [["border-radius", "var(--radius)"]]], [".rounded-t-\\[12px\\]", null, 4, [["border-top-left-radius", "12px"], ["border-top-right-radius", "12px"]]], [".rounded-t-none", null, 4, [["border-top-left-radius", "0"], ["border-top-right-radius", "0"]]], [".rounded-bl-\\[6px\\]", null, 4, [["border-bottom-left-radius", "6px"]]], [".border", null, 4, [["border-style", "var(--tw-border-style)"], ["border-width", "1px"]]], [".border-0", null, 4, [["border-style", "var(--tw-border-style)"], ["border-width", "0"]]], [".border-\\[1\\.5px\\]", null, 4, [["border-style", "var(--tw-border-style)"], ["border-width", "1.5px"]]], [".border-b", null, 4, [["border-bottom-style", "var(--tw-border-style)"], ["border-bottom-width", "1px"]]], [".border-l", null, 4, [["border-left-style", "var(--tw-border-style)"], ["border-left-width", "1px"]]], [".border-l-\\[3px\\]", null, 4, [["border-left-style", "var(--tw-border-style)"], ["border-left-width", "3px"]]], [".border-solid", null, 4, [["--tw-border-style", "solid"], ["border-style", "solid"]]], [".border-accent", null, 4, [["border-color", "var(--accent)"]]], [".border-overlay-0", null, 4, [["border-color", "var(--overlay-0)"]]], [".border-overlay-1", null, 4, [["border-color", "var(--overlay-1)"]]], [".border-red", null, 4, [["border-color", "var(--red)"]]], [".border-subtext-0", null, 4, [["border-color", "var(--subtext-0)"]]], [".border-surface-1", null, 4, [["border-color", "var(--surface-1)"]]], [".border-teal", null, 4, [["border-color", "var(--teal)"]]], [".border-yellow", null, 4, [["border-color", "var(--yellow)"]]], [".border-l-accent", null, 4, [["border-left-color", "var(--accent)"]]], [".border-l-green", null, 4, [["border-left-color", "var(--green)"]]], [".border-l-red", null, 4, [["border-left-color", "var(--red)"]]], [".border-l-yellow", null, 4, [["border-left-color", "var(--yellow)"]]], [".bg-\\[\\#161616\\]", null, 4, [["background-color", "#161616"]]], [".bg-\\[\\#fff\\]", null, 4, [["background-color", "#fff"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_8\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "var(--accent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_8\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--accent) 8%,var(--panel-bg))"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_12\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--accent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_12\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--accent) 12%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--accent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--accent) 15%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--blue\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--blue)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--blue\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--blue) 15%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--green\\)_9\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--green)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--green\\)_9\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--green) 9%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--red\\)_7\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--red)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--red\\)_7\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--red) 7%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--red\\)_9\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--red)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--red\\)_9\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--red) 9%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--surface-1\\)_42\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--surface-1\\)_42\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--surface-1) 42%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--surface-1\\)_70\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--surface-1\\)_70\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--surface-1) 70%,var(--panel-bg))"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--text\\)_10\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "var(--text)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--text\\)_10\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--text) 10%,var(--panel-bg))"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--yellow\\)_8\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--yellow)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--yellow\\)_8\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--yellow) 8%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--yellow\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--yellow)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--yellow\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--yellow) 15%,transparent)"]]], [".bg-\\[rgba\\(0\\,0\\,0\\,0\\.5\\)\\]", null, 4, [["background-color", "#00000080"]]], [".bg-\\[rgba\\(0\\,0\\,0\\,0\\.7\\)\\]", null, 4, [["background-color", "#000000b3"]]], [".bg-\\[rgba\\(0\\,0\\,0\\,0\\.55\\)\\]", null, 4, [["background-color", "#0000008c"]]], [".bg-\\[rgba\\(0\\,0\\,0\\,0\\.62\\)\\]", null, 4, [["background-color", "#0000009e"]]], [".bg-\\[var\\(--accent\\)\\]", null, 4, [["background-color", "var(--accent)"]]], [".bg-\\[var\\(--backdrop\\)\\]", null, 4, [["background-color", "var(--backdrop)"]]], [".bg-\\[var\\(--bg\\)\\]", null, 4, [["background-color", "var(--bg)"]]], [".bg-\\[var\\(--card-bg\\)\\]", null, 4, [["background-color", "var(--card-bg)"]]], [".bg-\\[var\\(--picker-bg\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "var(--picker-bg, var(--panel-bg))"]]], [".bg-\\[var\\(--surface-1\\)\\]", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-\\[var\\(--workspace-tools-bg\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "var(--workspace-tools-bg, var(--panel-bg))"]]], [".bg-accent, .bg-accent\\/10", null, 4, [["background-color", "var(--accent)"]]], [".bg-accent\\/10", null, 4, [["background-color", "color-mix(in oklab, var(--accent) 10%, transparent)"]]], [".bg-accent\\/35", null, 4, [["background-color", "var(--accent)"]]], [".bg-accent\\/35", null, 4, [["background-color", "color-mix(in oklab, var(--accent) 35%, transparent)"]]], [".bg-fg", null, 4, [["background-color", "var(--text)"]]], [".bg-green, .bg-green\\/15", null, 4, [["background-color", "var(--green)"]]], [".bg-green\\/15", null, 4, [["background-color", "color-mix(in oklab, var(--green) 15%, transparent)"]]], [".bg-overlay-0", null, 4, [["background-color", "var(--overlay-0)"]]], [".bg-overlay-1", null, 4, [["background-color", "var(--overlay-1)"]]], [".bg-panel-bg", null, 4, [["background-color", "var(--panel-bg)"]]], [".bg-red, .bg-red\\/15", null, 4, [["background-color", "var(--red)"]]], [".bg-red\\/15", null, 4, [["background-color", "color-mix(in oklab, var(--red) 15%, transparent)"]]], [".bg-subtext-0", null, 4, [["background-color", "var(--subtext-0)"]]], [".bg-surface-0", null, 4, [["background-color", "var(--surface-0)"]]], [".bg-surface-1, .bg-surface-1\\/30", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-surface-1\\/30", null, 4, [["background-color", "color-mix(in oklab, var(--surface-1) 30%, transparent)"]]], [".bg-surface-1\\/60", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-surface-1\\/60", null, 4, [["background-color", "color-mix(in oklab, var(--surface-1) 60%, transparent)"]]], [".bg-surface-1\\/70", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-surface-1\\/70", null, 4, [["background-color", "color-mix(in oklab, var(--surface-1) 70%, transparent)"]]], [".bg-transparent", null, 4, [["background-color", "#0000"]]], [".bg-yellow", null, 4, [["background-color", "var(--yellow)"]]], [".object-contain", null, 4, [["object-fit", "contain"]]], [".object-cover", null, 4, [["object-fit", "cover"]]], [".p-0", null, 4, [["padding", "0"]]], [".p-0\\.5", null, 4, [["padding", "calc(var(--spacing) * .5)"]]], [".p-1", null, 4, [["padding", "var(--spacing)"]]], [".p-2", null, 4, [["padding", "calc(var(--spacing) * 2)"]]], [".p-3", null, 4, [["padding", "calc(var(--spacing) * 3)"]]], [".p-4", null, 4, [["padding", "calc(var(--spacing) * 4)"]]], [".p-5", null, 4, [["padding", "calc(var(--spacing) * 5)"]]], [".p-6", null, 4, [["padding", "calc(var(--spacing) * 6)"]]], [".p-\\[0\\.2rem\\]", null, 4, [["padding", ".2rem"]]], [".p-\\[0\\.4rem\\]", null, 4, [["padding", ".4rem"]]], [".p-\\[0\\.5rem\\]", null, 4, [["padding", ".5rem"]]], [".p-\\[0\\.9rem\\]", null, 4, [["padding", ".9rem"]]], [".p-\\[0\\.45rem\\]", null, 4, [["padding", ".45rem"]]], [".p-\\[0\\.55rem\\]", null, 4, [["padding", ".55rem"]]], [".p-\\[0\\.65rem\\]", null, 4, [["padding", ".65rem"]]], [".p-\\[2px\\]", null, 4, [["padding", "2px"]]], [".px-0", null, 4, [["padding-inline", "0"]]], [".px-1", null, 4, [["padding-inline", "var(--spacing)"]]], [".px-1\\.5", null, 4, [["padding-inline", "calc(var(--spacing) * 1.5)"]]], [".px-2", null, 4, [["padding-inline", "calc(var(--spacing) * 2)"]]], [".px-3", null, 4, [["padding-inline", "calc(var(--spacing) * 3)"]]], [".px-3\\.5", null, 4, [["padding-inline", "calc(var(--spacing) * 3.5)"]]], [".px-4", null, 4, [["padding-inline", "calc(var(--spacing) * 4)"]]], [".px-8", null, 4, [["padding-inline", "calc(var(--spacing) * 8)"]]], [".px-\\[0\\.2rem\\]", null, 4, [["padding-inline", ".2rem"]]], [".px-\\[0\\.3rem\\]", null, 4, [["padding-inline", ".3rem"]]], [".px-\\[0\\.4rem\\]", null, 4, [["padding-inline", ".4rem"]]], [".px-\\[0\\.5rem\\]", null, 4, [["padding-inline", ".5rem"]]], [".px-\\[0\\.6rem\\]", null, 4, [["padding-inline", ".6rem"]]], [".px-\\[0\\.7rem\\]", null, 4, [["padding-inline", ".7rem"]]], [".px-\\[0\\.8rem\\]", null, 4, [["padding-inline", ".8rem"]]], [".px-\\[0\\.9rem\\]", null, 4, [["padding-inline", ".9rem"]]], [".px-\\[0\\.26rem\\]", null, 4, [["padding-inline", ".26rem"]]], [".px-\\[0\\.28rem\\]", null, 4, [["padding-inline", ".28rem"]]], [".px-\\[0\\.35rem\\]", null, 4, [["padding-inline", ".35rem"]]], [".px-\\[0\\.42rem\\]", null, 4, [["padding-inline", ".42rem"]]], [".px-\\[0\\.45rem\\]", null, 4, [["padding-inline", ".45rem"]]], [".px-\\[0\\.48rem\\]", null, 4, [["padding-inline", ".48rem"]]], [".px-\\[0\\.55rem\\]", null, 4, [["padding-inline", ".55rem"]]], [".px-\\[0\\.65rem\\]", null, 4, [["padding-inline", ".65rem"]]], [".px-\\[0\\.75rem\\]", null, 4, [["padding-inline", ".75rem"]]], [".px-\\[0\\.85rem\\]", null, 4, [["padding-inline", ".85rem"]]], [".px-\\[1\\.4rem\\]", null, 4, [["padding-inline", "1.4rem"]]], [".px-\\[3px\\]", null, 4, [["padding-inline", "3px"]]], [".px-\\[10px\\]", null, 4, [["padding-inline", "10px"]]], [".py-0", null, 4, [["padding-block", "0"]]], [".py-0\\.5", null, 4, [["padding-block", "calc(var(--spacing) * .5)"]]], [".py-1", null, 4, [["padding-block", "var(--spacing)"]]], [".py-1\\.5", null, 4, [["padding-block", "calc(var(--spacing) * 1.5)"]]], [".py-2", null, 4, [["padding-block", "calc(var(--spacing) * 2)"]]], [".py-3", null, 4, [["padding-block", "calc(var(--spacing) * 3)"]]], [".py-4", null, 4, [["padding-block", "calc(var(--spacing) * 4)"]]], [".py-8", null, 4, [["padding-block", "calc(var(--spacing) * 8)"]]], [".py-\\[0\\.1rem\\]", null, 4, [["padding-block", ".1rem"]]], [".py-\\[0\\.2rem\\]", null, 4, [["padding-block", ".2rem"]]], [".py-\\[0\\.3rem\\]", null, 4, [["padding-block", ".3rem"]]], [".py-\\[0\\.4rem\\]", null, 4, [["padding-block", ".4rem"]]], [".py-\\[0\\.05rem\\]", null, 4, [["padding-block", ".05rem"]]], [".py-\\[0\\.6rem\\]", null, 4, [["padding-block", ".6rem"]]], [".py-\\[0\\.8rem\\]", null, 4, [["padding-block", ".8rem"]]], [".py-\\[0\\.12rem\\]", null, 4, [["padding-block", ".12rem"]]], [".py-\\[0\\.14rem\\]", null, 4, [["padding-block", ".14rem"]]], [".py-\\[0\\.15rem\\]", null, 4, [["padding-block", ".15rem"]]], [".py-\\[0\\.18rem\\]", null, 4, [["padding-block", ".18rem"]]], [".py-\\[0\\.25rem\\]", null, 4, [["padding-block", ".25rem"]]], [".py-\\[0\\.28rem\\]", null, 4, [["padding-block", ".28rem"]]], [".py-\\[0\\.32rem\\]", null, 4, [["padding-block", ".32rem"]]], [".py-\\[0\\.35rem\\]", null, 4, [["padding-block", ".35rem"]]], [".py-\\[0\\.42rem\\]", null, 4, [["padding-block", ".42rem"]]], [".py-\\[0\\.45rem\\]", null, 4, [["padding-block", ".45rem"]]], [".py-\\[0\\.55rem\\]", null, 4, [["padding-block", ".55rem"]]], [".py-\\[0\\.65rem\\]", null, 4, [["padding-block", ".65rem"]]], [".py-\\[2px\\]", null, 4, [["padding-block", "2px"]]], [".py-\\[3px\\]", null, 4, [["padding-block", "3px"]]], [".py-\\[6px\\]", null, 4, [["padding-block", "6px"]]], [".py-px", null, 4, [["padding-block", "1px"]]], [".pt-1", null, 4, [["padding-top", "var(--spacing)"]]], [".pt-2", null, 4, [["padding-top", "calc(var(--spacing) * 2)"]]], [".pt-2\\.5", null, 4, [["padding-top", "calc(var(--spacing) * 2.5)"]]], [".pt-3", null, 4, [["padding-top", "calc(var(--spacing) * 3)"]]], [".pt-4", null, 4, [["padding-top", "calc(var(--spacing) * 4)"]]], [".pt-5", null, 4, [["padding-top", "calc(var(--spacing) * 5)"]]], [".pt-\\[0\\.2rem\\]", null, 4, [["padding-top", ".2rem"]]], [".pt-\\[0\\.4rem\\]", null, 4, [["padding-top", ".4rem"]]], [".pt-\\[0\\.6rem\\]", null, 4, [["padding-top", ".6rem"]]], [".pt-\\[0\\.85rem\\]", null, 4, [["padding-top", ".85rem"]]], [".pt-\\[2px\\]", null, 4, [["padding-top", "2px"]]], [".pt-\\[12vh\\]", null, 4, [["padding-top", "12vh"]]], [".pt-\\[max\\(0\\.5rem\\,env\\(safe-area-inset-top\\)\\)\\]", null, 4, [["padding-top", "max(.5rem, env(safe-area-inset-top))"]]], [".pr-0\\.5", null, 4, [["padding-right", "calc(var(--spacing) * .5)"]]], [".pr-1", null, 4, [["padding-right", "var(--spacing)"]]], [".pr-1\\.5", null, 4, [["padding-right", "calc(var(--spacing) * 1.5)"]]], [".pr-2", null, 4, [["padding-right", "calc(var(--spacing) * 2)"]]], [".pr-3", null, 4, [["padding-right", "calc(var(--spacing) * 3)"]]], [".pr-12", null, 4, [["padding-right", "calc(var(--spacing) * 12)"]]], [".pr-\\[0\\.3rem\\]", null, 4, [["padding-right", ".3rem"]]], [".pr-\\[0\\.6rem\\]", null, 4, [["padding-right", ".6rem"]]], [".pr-\\[0\\.35rem\\]", null, 4, [["padding-right", ".35rem"]]], [".pr-\\[0\\.45rem\\]", null, 4, [["padding-right", ".45rem"]]], [".pr-\\[0\\.55rem\\]", null, 4, [["padding-right", ".55rem"]]], [".pr-\\[1\\.6rem\\]", null, 4, [["padding-right", "1.6rem"]]], [".pr-\\[3px\\]", null, 4, [["padding-right", "3px"]]], [".pr-\\[env\\(safe-area-inset-right\\)\\]", null, 4, [["padding-right", "env(safe-area-inset-right)"]]], [".pr-\\[max\\(0\\.5rem\\,env\\(safe-area-inset-right\\)\\)\\]", null, 4, [["padding-right", "max(.5rem, env(safe-area-inset-right))"]]], [".pb-1", null, 4, [["padding-bottom", "var(--spacing)"]]], [".pb-2", null, 4, [["padding-bottom", "calc(var(--spacing) * 2)"]]], [".pb-3", null, 4, [["padding-bottom", "calc(var(--spacing) * 3)"]]], [".pb-4", null, 4, [["padding-bottom", "calc(var(--spacing) * 4)"]]], [".pb-8", null, 4, [["padding-bottom", "calc(var(--spacing) * 8)"]]], [".pb-\\[0\\.3rem\\]", null, 4, [["padding-bottom", ".3rem"]]], [".pb-\\[0\\.4rem\\]", null, 4, [["padding-bottom", ".4rem"]]], [".pb-\\[0\\.25rem\\]", null, 4, [["padding-bottom", ".25rem"]]], [".pb-\\[0\\.55rem\\]", null, 4, [["padding-bottom", ".55rem"]]], [".pb-\\[1\\.4rem\\]", null, 4, [["padding-bottom", "1.4rem"]]], [".pb-\\[calc\\(1\\.5rem\\+env\\(safe-area-inset-bottom\\)\\)\\]", null, 4, [["padding-bottom", "calc(1.5rem + env(safe-area-inset-bottom))"]]], [".pb-\\[calc\\(1rem\\+env\\(safe-area-inset-bottom\\)\\)\\]", null, 4, [["padding-bottom", "calc(1rem + env(safe-area-inset-bottom))"]]], [".pb-\\[env\\(safe-area-inset-bottom\\)\\]", null, 4, [["padding-bottom", "env(safe-area-inset-bottom)"]]], [".pb-\\[max\\(0\\.5rem\\,env\\(safe-area-inset-bottom\\)\\)\\]", null, 4, [["padding-bottom", "max(.5rem, env(safe-area-inset-bottom))"]]], [".pl-1", null, 4, [["padding-left", "var(--spacing)"]]], [".pl-1\\.5", null, 4, [["padding-left", "calc(var(--spacing) * 1.5)"]]], [".pl-2", null, 4, [["padding-left", "calc(var(--spacing) * 2)"]]], [".pl-3", null, 4, [["padding-left", "calc(var(--spacing) * 3)"]]], [".pl-4", null, 4, [["padding-left", "calc(var(--spacing) * 4)"]]], [".pl-5", null, 4, [["padding-left", "calc(var(--spacing) * 5)"]]], [".pl-6", null, 4, [["padding-left", "calc(var(--spacing) * 6)"]]], [".pl-\\[0\\.4rem\\]", null, 4, [["padding-left", ".4rem"]]], [".pl-\\[0\\.45rem\\]", null, 4, [["padding-left", ".45rem"]]], [".pl-\\[0\\.75rem\\]", null, 4, [["padding-left", ".75rem"]]], [".pl-\\[0\\.85rem\\]", null, 4, [["padding-left", ".85rem"]]], [".pl-\\[1\\.2rem\\]", null, 4, [["padding-left", "1.2rem"]]], [".pl-\\[1\\.55rem\\]", null, 4, [["padding-left", "1.55rem"]]], [".pl-\\[1\\.075rem\\]", null, 4, [["padding-left", "1.075rem"]]], [".pl-\\[1\\.525rem\\]", null, 4, [["padding-left", "1.525rem"]]], [".pl-\\[1\\.875rem\\]", null, 4, [["padding-left", "1.875rem"]]], [".pl-\\[85px\\]", null, 4, [["padding-left", "85px"]]], [".pl-\\[max\\(0\\.5rem\\,env\\(safe-area-inset-left\\)\\)\\]", null, 4, [["padding-left", "max(.5rem, env(safe-area-inset-left))"]]], [".pl-\\[max\\(0\\.25rem\\,env\\(safe-area-inset-left\\)\\)\\]", null, 4, [["padding-left", "max(.25rem, env(safe-area-inset-left))"]]], [".text-center", null, 4, [["text-align", "center"]]], [".text-left", null, 4, [["text-align", "left"]]], [".text-right", null, 4, [["text-align", "right"]]], [".\\[font-family\\:inherit\\]", null, 4, [["font-family", "inherit"]]], [".\\[font-family\\:ui-monospace\\,SFMono-Regular\\,Menlo\\,monospace\\]", null, 4, [["font-family", "ui-monospace, SFMono-Regular, Menlo, monospace"]]], [".\\[font-family\\:var\\(--font-mono\\)\\]", null, 4, [["font-family", "var(--font-mono)"]]], [".text-sm", null, 4, [["font-size", "var(--text-sm)"], ["line-height", "var(--tw-leading, var(--text-sm--line-height))"]]], [".text-xs", null, 4, [["font-size", "var(--text-xs)"], ["line-height", "var(--tw-leading, var(--text-xs--line-height))"]]], [".\\[font-size\\:inherit\\]", null, 4, [["font-size", "inherit"]]], [".text-\\[0\\.6rem\\]", null, 4, [["font-size", ".6rem"]]], [".text-\\[0\\.7rem\\]", null, 4, [["font-size", ".7rem"]]], [".text-\\[0\\.8em\\]", null, 4, [["font-size", ".8em"]]], [".text-\\[0\\.8rem\\]", null, 4, [["font-size", ".8rem"]]], [".text-\\[0\\.9em\\]", null, 4, [["font-size", ".9em"]]], [".text-\\[0\\.9rem\\]", null, 4, [["font-size", ".9rem"]]], [".text-\\[0\\.54rem\\]", null, 4, [["font-size", ".54rem"]]], [".text-\\[0\\.58rem\\]", null, 4, [["font-size", ".58rem"]]], [".text-\\[0\\.62rem\\]", null, 4, [["font-size", ".62rem"]]], [".text-\\[0\\.63rem\\]", null, 4, [["font-size", ".63rem"]]], [".text-\\[0\\.64rem\\]", null, 4, [["font-size", ".64rem"]]], [".text-\\[0\\.65rem\\]", null, 4, [["font-size", ".65rem"]]], [".text-\\[0\\.66rem\\]", null, 4, [["font-size", ".66rem"]]], [".text-\\[0\\.66rem\\]\\!", null, 4, [["font-size", ".66rem", 1]]], [".text-\\[0\\.68rem\\]", null, 4, [["font-size", ".68rem"]]], [".text-\\[0\\.72rem\\]", null, 4, [["font-size", ".72rem"]]], [".text-\\[0\\.74rem\\]", null, 4, [["font-size", ".74rem"]]], [".text-\\[0\\.75rem\\]", null, 4, [["font-size", ".75rem"]]], [".text-\\[0\\.76rem\\]", null, 4, [["font-size", ".76rem"]]], [".text-\\[0\\.77rem\\]", null, 4, [["font-size", ".77rem"]]], [".text-\\[0\\.78rem\\]", null, 4, [["font-size", ".78rem"]]], [".text-\\[0\\.82rem\\]", null, 4, [["font-size", ".82rem"]]], [".text-\\[0\\.83rem\\]", null, 4, [["font-size", ".83rem"]]], [".text-\\[0\\.85rem\\]", null, 4, [["font-size", ".85rem"]]], [".text-\\[0\\.88rem\\]", null, 4, [["font-size", ".88rem"]]], [".text-\\[0\\.95rem\\]", null, 4, [["font-size", ".95rem"]]], [".text-\\[0\\.875rem\\]", null, 4, [["font-size", ".875rem"]]], [".text-\\[1\\.1rem\\]", null, 4, [["font-size", "1.1rem"]]], [".text-\\[1\\.4em\\]", null, 4, [["font-size", "1.4em"]]], [".text-\\[1\\.6rem\\]", null, 4, [["font-size", "1.6rem"]]], [".text-\\[1\\.15rem\\]", null, 4, [["font-size", "1.15rem"]]], [".text-\\[1rem\\]", null, 4, [["font-size", "1rem"]]], [".text-\\[2\\.4rem\\]", null, 4, [["font-size", "2.4rem"]]], [".text-\\[9px\\]", null, 4, [["font-size", "9px"]]], [".text-\\[10px\\]", null, 4, [["font-size", "10px"]]], [".text-\\[11px\\]", null, 4, [["font-size", "11px"]]], [".text-\\[12\\.5px\\]", null, 4, [["font-size", "12.5px"]]], [".text-\\[12px\\]", null, 4, [["font-size", "12px"]]], [".text-\\[13px\\]", null, 4, [["font-size", "13px"]]], [".text-\\[14px\\]", null, 4, [["font-size", "14px"]]], [".text-\\[calc\\(0\\.95rem\\*var\\(--chat-font-scale\\,1\\)\\)\\]", null, 4, [["font-size", "calc(.95rem * var(--chat-font-scale, 1))"]]], [".text-\\[length\\:calc\\(11px\\*var\\(--zoom\\,1\\)\\)\\]", null, 4, [["font-size", "calc(11px * var(--zoom, 1))"]]], [".text-\\[length\\:calc\\(13px\\*var\\(--zoom\\,1\\)\\)\\]", null, 4, [["font-size", "calc(13px * var(--zoom, 1))"]]], [".leading-4", null, 4, [["--tw-leading", "calc(var(--spacing) * 4)"], ["line-height", "calc(var(--spacing) * 4)"]]], [".leading-\\[1\\.1\\]", null, 4, [["--tw-leading", "1.1"], ["line-height", "1.1"]]], [".leading-\\[1\\.2\\]", null, 4, [["--tw-leading", "1.2"], ["line-height", "1.2"]]], [".leading-\\[1\\.3\\]", null, 4, [["--tw-leading", "1.3"], ["line-height", "1.3"]]], [".leading-\\[1\\.4\\]", null, 4, [["--tw-leading", "1.4"], ["line-height", "1.4"]]], [".leading-\\[1\\.5\\]", null, 4, [["--tw-leading", "1.5"], ["line-height", "1.5"]]], [".leading-\\[1\\.6\\]", null, 4, [["--tw-leading", "1.6"], ["line-height", "1.6"]]], [".leading-\\[1\\.45\\]", null, 4, [["--tw-leading", "1.45"], ["line-height", "1.45"]]], [".leading-\\[18px\\]", null, 4, [["--tw-leading", "18px"], ["line-height", "18px"]]], [".leading-none", null, 4, [["--tw-leading", "1"], ["line-height", "1"]]], [".leading-relaxed", null, 4, [["--tw-leading", "var(--leading-relaxed)"], ["line-height", "var(--leading-relaxed)"]]], [".leading-tight", null, 4, [["--tw-leading", "var(--leading-tight)"], ["line-height", "var(--leading-tight)"]]], [".\\[line-height\\:inherit\\]", null, 4, [["line-height", "inherit"]]], [".font-bold", null, 4, [["--tw-font-weight", "var(--font-weight-bold)"], ["font-weight", "var(--font-weight-bold)"]]], [".font-medium", null, 4, [["--tw-font-weight", "var(--font-weight-medium)"], ["font-weight", "var(--font-weight-medium)"]]], [".font-normal", null, 4, [["--tw-font-weight", "var(--font-weight-normal)"], ["font-weight", "var(--font-weight-normal)"]]], [".font-semibold", null, 4, [["--tw-font-weight", "var(--font-weight-semibold)"], ["font-weight", "var(--font-weight-semibold)"]]], [".\\[font-weight\\:inherit\\]", null, 4, [["font-weight", "inherit"]]], [".tracking-\\[-0\\.02em\\]", null, 4, [["--tw-tracking", "-.02em"], ["letter-spacing", "-.02em"]]], [".tracking-\\[0\\.03em\\]", null, 4, [["--tw-tracking", ".03em"], ["letter-spacing", ".03em"]]], [".tracking-\\[0\\.04em\\]", null, 4, [["--tw-tracking", ".04em"], ["letter-spacing", ".04em"]]], [".tracking-\\[0\\.06em\\]", null, 4, [["--tw-tracking", ".06em"], ["letter-spacing", ".06em"]]], [".tracking-\\[0\\.08em\\]", null, 4, [["--tw-tracking", ".08em"], ["letter-spacing", ".08em"]]], [".tracking-\\[0\\.09em\\]", null, 4, [["--tw-tracking", ".09em"], ["letter-spacing", ".09em"]]], [".tracking-\\[0\\.22em\\]", null, 4, [["--tw-tracking", ".22em"], ["letter-spacing", ".22em"]]], [".tracking-normal", null, 4, [["--tw-tracking", "var(--tracking-normal)"], ["letter-spacing", "var(--tracking-normal)"]]], [".tracking-wide", null, 4, [["--tw-tracking", "var(--tracking-wide)"], ["letter-spacing", "var(--tracking-wide)"]]], [".\\[overflow-wrap\\:anywhere\\]", null, 4, [["overflow-wrap", "anywhere"]]], [".break-words", null, 4, [["overflow-wrap", "break-word"]]], [".\\[word-break\\:break-word\\]", null, 4, [["word-break", "break-word"]]], [".text-ellipsis", null, 4, [["text-overflow", "ellipsis"]]], [".whitespace-normal", null, 4, [["white-space", "normal"]]], [".whitespace-nowrap", null, 4, [["white-space", "nowrap"]]], [".whitespace-pre", null, 4, [["white-space", "pre"]]], [".whitespace-pre-wrap", null, 4, [["white-space", "pre-wrap"]]], [".\\[tab-size\\:2\\]", null, 4, [["tab-size", "2"]]], [".text-\\[color\\:var\\(--git-muted\\)\\]", null, 4, [["color", "var(--git-muted)"]]], [".text-\\[var\\(--subtext-0\\)\\]", null, 4, [["color", "var(--subtext-0)"]]], [".text-\\[var\\(--text\\)\\]", null, 4, [["color", "var(--text)"]]], [".text-accent", null, 4, [["color", "var(--accent)"]]], [".text-blue", null, 4, [["color", "var(--blue)"]]], [".text-current", null, 4, [["color", "currentColor"]]], [".text-fg", null, 4, [["color", "var(--text)"]]], [".text-green", null, 4, [["color", "var(--green)"]]], [".text-inherit", null, 4, [["color", "inherit"]]], [".text-mauve", null, 4, [["color", "var(--mauve)"]]], [".text-overlay-0", null, 4, [["color", "var(--overlay-0)"]]], [".text-overlay-1", null, 4, [["color", "var(--overlay-1)"]]], [".text-panel-bg", null, 4, [["color", "var(--panel-bg)"]]], [".text-peach", null, 4, [["color", "var(--peach)"]]], [".text-red", null, 4, [["color", "var(--red)"]]], [".text-red\\!", null, 4, [["color", "var(--red)", 1]]], [".text-subtext-0", null, 4, [["color", "var(--subtext-0)"]]], [".text-yellow", null, 4, [["color", "var(--yellow)"]]], [".capitalize", null, 4, [["text-transform", "capitalize"]]], [".normal-case", null, 4, [["text-transform", "none"]]], [".uppercase", null, 4, [["text-transform", "uppercase"]]], [".italic", null, 4, [["font-style", "italic"]]], [".not-italic", null, 4, [["font-style", "normal"]]], [".tabular-nums", null, 4, [["--tw-numeric-spacing", "tabular-nums"], ["font-variant-numeric", "var(--tw-ordinal, ) var(--tw-slashed-zero, ) var(--tw-numeric-figure, ) var(--tw-numeric-spacing, ) var(--tw-numeric-fraction, )"]]], [".line-through", null, 4, [["text-decoration-line", "line-through"]]], [".no-underline", null, 4, [["text-decoration-line", "none"]]], [".underline", null, 4, [["text-decoration-line", "underline"]]], [".opacity-0", null, 4, [["opacity", "0"]]], [".opacity-40", null, 4, [["opacity", ".4"]]], [".opacity-60", null, 4, [["opacity", ".6"]]], [".opacity-70", null, 4, [["opacity", ".7"]]], [".opacity-75", null, 4, [["opacity", ".75"]]], [".opacity-80", null, 4, [["opacity", ".8"]]], [".opacity-100", null, 4, [["opacity", "1"]]], [".opacity-\\[0\\.72\\]", null, 4, [["opacity", ".72"]]], [".shadow", null, 4, [["--tw-shadow", "0 1px 3px 0 var(--tw-shadow-color, #0000001a), 0 1px 2px -1px var(--tw-shadow-color, #0000001a)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_1px_4px_rgba\\(0\\,0\\,0\\,0\\.4\\)\\]", null, 4, [["--tw-shadow", "0 1px 4px var(--tw-shadow-color, #0006)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_2px_8px_rgba\\(0\\,0\\,0\\,0\\.4\\)\\]", null, 4, [["--tw-shadow", "0 2px 8px var(--tw-shadow-color, #0006)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_2px_8px_rgba\\(0\\,0\\,0\\,0\\.35\\)\\]", null, 4, [["--tw-shadow", "0 2px 8px var(--tw-shadow-color, #00000059)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_6px_20px_rgba\\(0\\,0\\,0\\,0\\.3\\)\\]", null, 4, [["--tw-shadow", "0 6px 20px var(--tw-shadow-color, #0000004d)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_8px_24px_rgba\\(0\\,0\\,0\\,0\\.35\\)\\]", null, 4, [["--tw-shadow", "0 8px 24px var(--tw-shadow-color, #00000059)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_8px_24px_rgba\\(0\\,0\\,0\\,0\\.45\\)\\]", null, 4, [["--tw-shadow", "0 8px 24px var(--tw-shadow-color, #00000073)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_8px_32px_rgba\\(0\\,0\\,0\\,0\\.5\\)\\]", null, 4, [["--tw-shadow", "0 8px 32px var(--tw-shadow-color, #00000080)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_12px_32px_rgba\\(0\\,0\\,0\\,0\\.5\\)\\]", null, 4, [["--tw-shadow", "0 12px 32px var(--tw-shadow-color, #00000080)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_16px_48px_rgba\\(0\\,0\\,0\\,0\\.55\\)\\]", null, 4, [["--tw-shadow", "0 16px 48px var(--tw-shadow-color, #0000008c)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[inset_0_0_24px_var\\(--accent\\)\\]", null, 4, [["--tw-shadow", "inset 0 0 24px var(--tw-shadow-color, var(--accent))"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-lg", null, 4, [["--tw-shadow", "0 10px 15px -3px var(--tw-shadow-color, #0000001a), 0 4px 6px -4px var(--tw-shadow-color, #0000001a)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".ring", null, 4, [["--tw-ring-shadow", "var(--tw-ring-inset, ) 0 0 0 calc(1px + var(--tw-ring-offset-width)) var(--tw-ring-color, currentcolor)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".\\[box-shadow\\:0_1px_2px_rgba\\(0\\,0\\,0\\,0\\.3\\)\\]", null, 4, [["box-shadow", "0 1px 2px #0000004d"]]], [".\\[box-shadow\\:0_4px_14px_rgba\\(0\\,0\\,0\\,0\\.35\\)\\]", null, 4, [["box-shadow", "0 4px 14px #00000059"]]], [".\\[box-shadow\\:none\\]", null, 4, [["box-shadow", "none"]]], [".\\[outline\\:none\\]", null, 4, [["outline", "none"]]], [".outline, .outline-1", null, 4, [["outline-style", "var(--tw-outline-style)"], ["outline-width", "1px"]]], [".outline-2", null, 4, [["outline-style", "var(--tw-outline-style)"], ["outline-width", "2px"]]], [".outline-accent", null, 4, [["outline-color", "var(--accent)"]]], [".blur", null, 4, [["--tw-blur", "blur(8px)"], ["filter", "var(--tw-blur, ) var(--tw-brightness, ) var(--tw-contrast, ) var(--tw-grayscale, ) var(--tw-hue-rotate, ) var(--tw-invert, ) var(--tw-saturate, ) var(--tw-sepia, ) var(--tw-drop-shadow, )"]]], [".\\!filter", null, 4, [["filter", "var(--tw-blur, ) var(--tw-brightness, ) var(--tw-contrast, ) var(--tw-grayscale, ) var(--tw-hue-rotate, ) var(--tw-invert, ) var(--tw-saturate, ) var(--tw-sepia, ) var(--tw-drop-shadow, )", 1]]], [".\\[filter\\:drop-shadow\\(0_6px_10px_rgba\\(0\\,0\\,0\\,0\\.45\\)\\)\\]", null, 4, [["filter", "drop-shadow(0 6px 10px #00000073)"]]], [".filter", null, 4, [["filter", "var(--tw-blur, ) var(--tw-brightness, ) var(--tw-contrast, ) var(--tw-grayscale, ) var(--tw-hue-rotate, ) var(--tw-invert, ) var(--tw-saturate, ) var(--tw-sepia, ) var(--tw-drop-shadow, )"]]], [".backdrop-blur-xl", null, 4, [["--tw-backdrop-blur", "blur(var(--blur-xl))"], ["-webkit-backdrop-filter", "var(--tw-backdrop-blur, ) var(--tw-backdrop-brightness, ) var(--tw-backdrop-contrast, ) var(--tw-backdrop-grayscale, ) var(--tw-backdrop-hue-rotate, ) var(--tw-backdrop-invert, ) var(--tw-backdrop-opacity, ) var(--tw-backdrop-saturate, ) var(--tw-backdrop-sepia, )"], ["backdrop-filter", "var(--tw-backdrop-blur, ) var(--tw-backdrop-brightness, ) var(--tw-backdrop-contrast, ) var(--tw-backdrop-grayscale, ) var(--tw-backdrop-hue-rotate, ) var(--tw-backdrop-invert, ) var(--tw-backdrop-opacity, ) var(--tw-backdrop-saturate, ) var(--tw-backdrop-sepia, )"]]], [".backdrop-saturate-150", null, 4, [["--tw-backdrop-saturate", "saturate(150%)"], ["-webkit-backdrop-filter", "var(--tw-backdrop-blur, ) var(--tw-backdrop-brightness, ) var(--tw-backdrop-contrast, ) var(--tw-backdrop-grayscale, ) var(--tw-backdrop-hue-rotate, ) var(--tw-backdrop-invert, ) var(--tw-backdrop-opacity, ) var(--tw-backdrop-saturate, ) var(--tw-backdrop-sepia, )"], ["backdrop-filter", "var(--tw-backdrop-blur, ) var(--tw-backdrop-brightness, ) var(--tw-backdrop-contrast, ) var(--tw-backdrop-grayscale, ) var(--tw-backdrop-hue-rotate, ) var(--tw-backdrop-invert, ) var(--tw-backdrop-opacity, ) var(--tw-backdrop-saturate, ) var(--tw-backdrop-sepia, )"]]], [".transition", null, 4, [["transition-property", "color, background-color, border-color, outline-color, text-decoration-color, fill, stroke, --tw-gradient-from, --tw-gradient-via, --tw-gradient-to, opacity, box-shadow, transform, translate, scale, rotate, filter, -webkit-backdrop-filter, backdrop-filter, display, content-visibility, overlay, pointer-events"], ["transition-timing-function", "var(--tw-ease, var(--default-transition-timing-function))"], ["transition-duration", "var(--tw-duration, var(--default-transition-duration))"]]], [".transition-\\[left\\,top\\,width\\,height\\]", null, 4, [["transition-property", "left, top, width, height"], ["transition-timing-function", "var(--tw-ease, var(--default-transition-timing-function))"], ["transition-duration", "var(--tw-duration, var(--default-transition-duration))"]]], [".transition-opacity", null, 4, [["transition-property", "opacity"], ["transition-timing-function", "var(--tw-ease, var(--default-transition-timing-function))"], ["transition-duration", "var(--tw-duration, var(--default-transition-duration))"]]], [".duration-150", null, 4, [["--tw-duration", ".15s"], ["transition-duration", ".15s"]]], [".ease-out", null, 4, [["--tw-ease", "var(--ease-out)"], ["transition-timing-function", "var(--ease-out)"]]], [".outline-none", null, 4, [["--tw-outline-style", "none"], ["outline-style", "none"]]], [".outline-solid", null, 4, [["--tw-outline-style", "solid"], ["outline-style", "solid"]]], [".select-none", null, 4, [["-webkit-user-select", "none"], ["user-select", "none"]]], [".select-text", null, 4, [["-webkit-user-select", "text"], ["user-select", "text"]]], [".\\[--panel-bg\\:var\\(--surface-dim\\)\\]", null, 4, [["--panel-bg", "var(--surface-dim)"]]], [".\\[--picker-bg\\:var\\(--surface-0\\)\\]", null, 4, [["--picker-bg", "var(--surface-0)"]]], [".\\[--radius\\:var\\(--radius-pane\\)\\]", null, 4, [["--radius", "var(--radius-pane)"]]], [".\\[--workspace-tools-bg\\:transparent\\]", null, 4, [["--workspace-tools-bg", "transparent"]]], [".\\[-webkit-box-orient\\:vertical\\]", null, 4, [["-webkit-box-orient", "vertical"]]], [".\\[-webkit-line-clamp\\:3\\]", null, 4, [["-webkit-line-clamp", "3"]]], [".\\[-webkit-touch-callout\\:none\\]", null, 4, [["-webkit-touch-callout", "none"]]], [".\\[background\\:none\\]", null, 4, [["background", "none"]]], [".\\[border-right\\:1px_solid_var\\(--git-border\\)\\]", null, 4, [["border-right", "1px solid var(--git-border)"]]], [".\\[border-top\\:1px_solid_var\\(--git-border\\)\\]", null, 4, [["border-top", "1px solid var(--git-border)"]]], [".\\[border\\:0\\]", null, 4, [["border", "0"]]], [".\\[border\\:none\\]", null, 4, [["border", "none"]]], [".\\[font\\:1\\.15rem\\/1_var\\(--font-mono\\)\\]", null, 4, [["font", "1.15rem/1 var(--font-mono)"]]], [".\\[font\\:1rem\\/1\\.2_var\\(--font-mono\\)\\]", null, 4, [["font", "1rem/1.2 var(--font-mono)"]]], [".\\[font\\:inherit\\]", null, 4, [["font", "inherit"]]], [".\\[transition\\:background_0\\.1s_ease\\]", null, 4, [["transition", "background .1s"]]], [".\\[transition\\:background_0\\.12s_ease\\]", null, 4, [["transition", "background .12s"]]], [".\\[transition\\:background_0\\.15s_ease\\]", null, 4, [["transition", "background .15s"]]], [".\\[transition\\:color_0\\.1s_ease\\,background_0\\.1s_ease\\]", null, 4, [["transition", "color .1s, background .1s"]]], [".\\[transition\\:color_0\\.12s_ease\\,background_0\\.12s_ease\\]", null, 4, [["transition", "color .12s, background .12s"]]], [".\\[transition\\:color_0\\.15s_ease\\]", null, 4, [["transition", "color .15s"]]], [".\\[transition\\:opacity_0\\.12s_ease\\]", null, 4, [["transition", "opacity .12s"]]], [".\\[transition\\:transform_0\\.15s_ease\\,background_0\\.15s_ease\\]", null, 4, [["transition", "transform .15s, background .15s"]]], [".not-has-\\[\\[data-setting-row\\]\\]\\:hidden:not(:has([data-setting-row]))", null, 4, [["display", "none"]]], [".group-focus-within\\:flex:is(:where(.group):focus-within *)", null, 4, [["display", "flex"]]], [".group-focus-within\\/row\\:opacity-100:is(:where(.group\\/row):focus-within *)", null, 4, [["opacity", "1"]]], [".group-hover\\:flex:is(:where(.group):hover *)", null, 4, [["display", "flex"]]], [".group-hover\\:opacity-100:is(:where(.group):hover *)", null, 4, [["opacity", "1"]]], [".group-hover\\/line\\:opacity-90:is(:where(.group\\/line):hover *)", null, 4, [["opacity", ".9"]]], [".group-hover\\/ph\\:opacity-100:is(:where(.group\\/ph):hover *), .group-hover\\/row\\:opacity-100:is(:where(.group\\/row):hover *)", null, 4, [["opacity", "1"]]], [".group-hover\\/submenu\\:block:is(:where(.group\\/submenu):hover *)", null, 4, [["display", "block"]]], [".group-focus\\/tree\\:ring-1:is(:where(.group\\/tree):focus *)", null, 4, [["--tw-ring-shadow", "var(--tw-ring-inset, ) 0 0 0 calc(1px + var(--tw-ring-offset-width)) var(--tw-ring-color, currentcolor)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".group-focus\\/tree\\:ring-overlay-1:is(:where(.group\\/tree):focus *)", null, 4, [["--tw-ring-color", "var(--overlay-1)"]]], [".group-focus\\/tree\\:ring-inset:is(:where(.group\\/tree):focus *)", null, 4, [["--tw-ring-inset", "inset"]]], ['.group-aria-checked\\:\\[transform\\:translateX\\(1\\.1rem\\)\\]:is(:where(.group)[aria-checked="true"] *)', null, 4, [["transform", "translateX(1.1rem)"]]], ['.group-aria-checked\\:border-accent:is(:where(.group)[aria-checked="true"] *)', null, 4, [["border-color", "var(--accent)"]]], ['.group-aria-checked\\:bg-accent:is(:where(.group)[aria-checked="true"] *)', null, 4, [["background-color", "var(--accent)"]]], ['.group-aria-checked\\:bg-panel-bg:is(:where(.group)[aria-checked="true"] *)', null, 4, [["background-color", "var(--panel-bg)"]]], ['.group-aria-checked\\:text-accent:is(:where(.group)[aria-checked="true"] *), .group-aria-\\[checked\\=false\\]\\:text-accent:is(:where(.group)[aria-checked="false"] *)', null, 4, [["color", "var(--accent)"]]], [".placeholder\\:text-subtext-0::placeholder", null, 4, [["color", "var(--subtext-0)"]]], [".before\\:absolute:before", null, 4, [["content", "var(--tw-content)"], ["position", "absolute"]]], [".before\\:top-\\[0\\.15rem\\]:before", null, 4, [["content", "var(--tw-content)"], ["top", ".15rem"]]], [".before\\:left-\\[0\\.15rem\\]:before", null, 4, [["content", "var(--tw-content)"], ["left", ".15rem"]]], [".before\\:h-\\[0\\.95rem\\]:before", null, 4, [["content", "var(--tw-content)"], ["height", ".95rem"]]], [".before\\:w-\\[0\\.95rem\\]:before", null, 4, [["content", "var(--tw-content)"], ["width", ".95rem"]]], [".before\\:rounded-full:before", null, 4, [["content", "var(--tw-content)"], ["border-radius", "3.40282e38px"]]], [".before\\:bg-fg:before", null, 4, [["content", "var(--tw-content)"], ["background-color", "var(--text)"]]], [".before\\:content-\\[\\'\\'\\]:before", null, 4, [["--tw-content", '""'], ["content", "var(--tw-content)"]]], [".before\\:\\[transition\\:transform_0\\.12s_ease\\]:before", null, 4, [["content", "var(--tw-content)"], ["transition", "transform .12s"]]], [".after\\:absolute:after", null, 4, [["content", "var(--tw-content)"], ["position", "absolute"]]], [".after\\:inset-0:after", null, 4, [["content", "var(--tw-content)"], ["inset", "0"]]], [".after\\:inset-x-0:after", null, 4, [["content", "var(--tw-content)"], ["inset-inline", "0"]]], [".after\\:-inset-y-2:after", null, 4, [["content", "var(--tw-content)"], ["inset-block", "calc(var(--spacing) * -2)"]]], [".after\\:m-auto:after", null, 4, [["content", "var(--tw-content)"], ["margin", "auto"]]], [".after\\:h-8:after", null, 4, [["content", "var(--tw-content)"], ["height", "calc(var(--spacing) * 8)"]]], [".after\\:h-12:after", null, 4, [["content", "var(--tw-content)"], ["height", "calc(var(--spacing) * 12)"]]], [".after\\:h-\\[3px\\]:after", null, 4, [["content", "var(--tw-content)"], ["height", "3px"]]], [".after\\:w-8:after", null, 4, [["content", "var(--tw-content)"], ["width", "calc(var(--spacing) * 8)"]]], [".after\\:w-\\[3px\\]:after", null, 4, [["content", "var(--tw-content)"], ["width", "3px"]]], [".after\\:rounded-full:after", null, 4, [["content", "var(--tw-content)"], ["border-radius", "3.40282e38px"]]], [".after\\:bg-transparent:after", null, 4, [["content", "var(--tw-content)"], ["background-color", "#0000"]]], [".after\\:content-\\[\\'\\'\\]:after", null, 4, [["--tw-content", '""'], ["content", "var(--tw-content)"]]], [".last\\:border-b-0:last-child", null, 4, [["border-bottom-style", "var(--tw-border-style)"], ["border-bottom-width", "0"]]], [".checked\\:bg-accent:checked", null, 4, [["background-color", "var(--accent)"]]], [".checked\\:before\\:translate-x-\\[1rem\\]:checked:before", null, 4, [["content", "var(--tw-content)"], ["--tw-translate-x", "1rem"], ["translate", "var(--tw-translate-x) var(--tw-translate-y)"]]], [".checked\\:before\\:bg-panel-bg:checked:before", null, 4, [["content", "var(--tw-content)"], ["background-color", "var(--panel-bg)"]]], [".focus-within\\:bg-surface-1:focus-within", null, 4, [["background-color", "var(--surface-1)"]]], [".focus-within\\:outline:focus-within, .focus-within\\:outline-1:focus-within", null, 4, [["outline-style", "var(--tw-outline-style)"], ["outline-width", "1px"]]], [".focus-within\\:outline-fg:focus-within", null, 4, [["outline-color", "var(--text)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_12\\%\\,transparent\\)\\]:hover", null, 4, [["background-color", "var(--accent)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_12\\%\\,transparent\\)\\]:hover", null, 4, [["background-color", "color-mix(in srgb,var(--accent) 12%,transparent)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_15\\%\\,transparent\\)\\]:hover", null, 4, [["background-color", "var(--accent)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_15\\%\\,transparent\\)\\]:hover", null, 4, [["background-color", "color-mix(in srgb,var(--accent) 15%,transparent)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--text\\)_10\\%\\,var\\(--panel-bg\\)\\)\\]:hover", null, 4, [["background-color", "var(--text)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--text\\)_10\\%\\,var\\(--panel-bg\\)\\)\\]:hover", null, 4, [["background-color", "color-mix(in srgb,var(--text) 10%,var(--panel-bg))"]]], [".hover\\:bg-\\[var\\(--surface-0\\)\\]:hover", null, 4, [["background-color", "var(--surface-0)"]]], [".hover\\:bg-accent:hover", null, 4, [["background-color", "var(--accent)"]]], [".hover\\:bg-overlay-0:hover", null, 4, [["background-color", "var(--overlay-0)"]]], [".hover\\:bg-panel-bg:hover", null, 4, [["background-color", "var(--panel-bg)"]]], [".hover\\:bg-surface-0:hover", null, 4, [["background-color", "var(--surface-0)"]]], [".hover\\:bg-surface-1:hover", null, 4, [["background-color", "var(--surface-1)"]]], [".hover\\:bg-transparent:hover", null, 4, [["background-color", "#0000"]]], [".hover\\:text-accent:hover", null, 4, [["color", "var(--accent)"]]], [".hover\\:text-fg:hover", null, 4, [["color", "var(--text)"]]], [".hover\\:text-inherit:hover", null, 4, [["color", "inherit"]]], [".hover\\:text-overlay-0:hover", null, 4, [["color", "var(--overlay-0)"]]], [".hover\\:text-panel-bg:hover", null, 4, [["color", "var(--panel-bg)"]]], [".hover\\:text-red:hover", null, 4, [["color", "var(--red)"]]], [".hover\\:text-subtext-0:hover", null, 4, [["color", "var(--subtext-0)"]]], [".hover\\:text-yellow:hover", null, 4, [["color", "var(--yellow)"]]], [".hover\\:underline:hover", null, 4, [["text-decoration-line", "underline"]]], [".hover\\:opacity-60:hover", null, 4, [["opacity", ".6"]]], [".hover\\:opacity-100\\!:hover", null, 4, [["opacity", "1", 1]]], [".hover\\:opacity-\\[0\\.85\\]:hover", null, 4, [["opacity", ".85"]]], [".hover\\:brightness-110:hover", null, 4, [["--tw-brightness", "brightness(110%)"], ["filter", "var(--tw-blur, ) var(--tw-brightness, ) var(--tw-contrast, ) var(--tw-grayscale, ) var(--tw-hue-rotate, ) var(--tw-invert, ) var(--tw-saturate, ) var(--tw-sepia, ) var(--tw-drop-shadow, )"]]], [".hover\\:\\[filter\\:brightness\\(1\\.08\\)\\]:hover", null, 4, [["filter", "brightness(1.08)"]]], [".hover\\:after\\:bg-overlay-1:hover:after", null, 4, [["content", "var(--tw-content)"], ["background-color", "var(--overlay-1)"]]], [".focus\\:\\[outline\\:1px_solid_var\\(--accent\\)\\]:focus", null, 4, [["outline", "1px solid var(--accent)"]]], [".focus\\:outline-2:focus", null, 4, [["outline-style", "var(--tw-outline-style)"], ["outline-width", "2px"]]], [".focus\\:outline-none:focus", null, 4, [["--tw-outline-style", "none"], ["outline-style", "none"]]], [".focus-visible\\:bg-accent:focus-visible", null, 4, [["background-color", "var(--accent)"]]], [".focus-visible\\:bg-surface-0:focus-visible", null, 4, [["background-color", "var(--surface-0)"]]], [".focus-visible\\:bg-surface-1:focus-visible", null, 4, [["background-color", "var(--surface-1)"]]], [".focus-visible\\:text-accent:focus-visible", null, 4, [["color", "var(--accent)"]]], [".focus-visible\\:text-fg:focus-visible", null, 4, [["color", "var(--text)"]]], [".focus-visible\\:text-panel-bg:focus-visible", null, 4, [["color", "var(--panel-bg)"]]], [".focus-visible\\:text-red:focus-visible", null, 4, [["color", "var(--red)"]]], [".focus-visible\\:text-yellow:focus-visible", null, 4, [["color", "var(--yellow)"]]], [".focus-visible\\:underline:focus-visible", null, 4, [["text-decoration-line", "underline"]]], [".focus-visible\\:opacity-100:focus-visible", null, 4, [["opacity", "1"]]], [".focus-visible\\:\\[outline\\:1px_solid_var\\(--accent\\)\\]:focus-visible", null, 4, [["outline", "1px solid var(--accent)"]]], [".focus-visible\\:\\[outline\\:1px_solid_var\\(--overlay-1\\)\\]:focus-visible", null, 4, [["outline", "1px solid var(--overlay-1)"]]], [".focus-visible\\:\\[outline\\:2px_solid_var\\(--accent\\)\\]:focus-visible", null, 4, [["outline", "2px solid var(--accent)"]]], [".focus-visible\\:outline:focus-visible, .focus-visible\\:outline-1:focus-visible", null, 4, [["outline-style", "var(--tw-outline-style)"], ["outline-width", "1px"]]], [".focus-visible\\:\\[outline-offset\\:-1px\\]:focus-visible", null, 4, [["outline-offset", "-1px"]]], [".focus-visible\\:\\[outline-offset\\:-2px\\]:focus-visible", null, 4, [["outline-offset", "-2px"]]], [".focus-visible\\:\\[outline-offset\\:2px\\]:focus-visible", null, 4, [["outline-offset", "2px"]]], [".focus-visible\\:outline-offset-1:focus-visible", null, 4, [["outline-offset", "1px"]]], [".focus-visible\\:outline-fg:focus-visible", null, 4, [["outline-color", "var(--text)"]]], [".focus-visible\\:after\\:bg-accent:focus-visible:after", null, 4, [["content", "var(--tw-content)"], ["background-color", "var(--accent)"]]], [".active\\:cursor-grabbing:active", null, 4, [["cursor", "grabbing"]]], [".active\\:bg-surface-1:active", null, 4, [["background-color", "var(--surface-1)"]]], [".active\\:text-fg:active", null, 4, [["color", "var(--text)"]]], [".active\\:after\\:bg-accent:active:after", null, 4, [["content", "var(--tw-content)"], ["background-color", "var(--accent)"]]], [".enabled\\:hover\\:bg-surface-1:enabled:hover", null, 4, [["background-color", "var(--surface-1)"]]], [".enabled\\:hover\\:text-fg:enabled:hover", null, 4, [["color", "var(--text)"]]], [".disabled\\:cursor-default:disabled", null, 4, [["cursor", "default"]]], [".disabled\\:cursor-not-allowed:disabled", null, 4, [["cursor", "not-allowed"]]], [".disabled\\:cursor-not-allowed\\!:disabled", null, 4, [["cursor", "not-allowed", 1]]], [".disabled\\:cursor-wait:disabled", null, 4, [["cursor", "wait"]]], [".disabled\\:bg-transparent:disabled", null, 4, [["background-color", "#0000"]]], [".disabled\\:text-fg:disabled", null, 4, [["color", "var(--text)"]]], [".disabled\\:opacity-40:disabled", null, 4, [["opacity", ".4"]]], [".disabled\\:opacity-50:disabled", null, 4, [["opacity", ".5"]]], [".disabled\\:opacity-\\[0\\.45\\]:disabled", null, 4, [["opacity", ".45"]]], [".disabled\\:opacity-\\[0\\.55\\]:disabled", null, 4, [["opacity", ".55"]]], [":where(.app--mac-desktop) .in-\\[\\.app--mac-desktop\\]\\:pl-\\[84px\\]", null, 4, [["padding-left", "84px"]]], [".has-\\[\\:checked\\]\\:bg-surface-0:has(:checked)", null, 4, [["background-color", "var(--surface-0)"]]], [".has-\\[\\:checked\\]\\:text-fg:has(:checked)", null, 4, [["color", "var(--text)"]]], [".has-\\[\\:focus-visible\\]\\:bg-surface-0:has(:focus-visible)", null, 4, [["background-color", "var(--surface-0)"]]], ['.aria-disabled\\:cursor-not-allowed[aria-disabled="true"]', null, 4, [["cursor", "not-allowed"]]], ['.aria-disabled\\:opacity-40[aria-disabled="true"]', null, 4, [["opacity", ".4"]]], ['.aria-expanded\\:opacity-100[aria-expanded="true"]', null, 4, [["opacity", "1"]]], ['.aria-pressed\\:bg-surface-0[aria-pressed="true"]', null, 4, [["background-color", "var(--surface-0)"]]], ['.aria-pressed\\:text-fg[aria-pressed="true"]', null, 4, [["color", "var(--text)"]]], [".motion-reduce\\:animate-none", ["(prefers-reduced-motion: reduce)"], 4, [["animation", "none"]]], [".max-\\[900px\\]\\:hidden", ["not all and (min-width: 900px)"], 4, [["display", "none"]]], [".max-\\[700px\\]\\:hidden", ["not all and (min-width: 700px)"], 4, [["display", "none"]]], [".max-\\[700px\\]\\:size-11", ["not all and (min-width: 700px)"], 4, [["width", "calc(var(--spacing) * 11)"], ["height", "calc(var(--spacing) * 11)"]]], [".max-\\[700px\\]\\:h-9", ["not all and (min-width: 700px)"], 4, [["height", "calc(var(--spacing) * 9)"]]], [".max-\\[700px\\]\\:h-12", ["not all and (min-width: 700px)"], 4, [["height", "calc(var(--spacing) * 12)"]]], [".max-\\[700px\\]\\:min-h-9", ["not all and (min-width: 700px)"], 4, [["min-height", "calc(var(--spacing) * 9)"]]], [".max-\\[700px\\]\\:min-h-11", ["not all and (min-width: 700px)"], 4, [["min-height", "calc(var(--spacing) * 11)"]]], [".max-\\[700px\\]\\:w-24", ["not all and (min-width: 700px)"], 4, [["width", "calc(var(--spacing) * 24)"]]], [".max-\\[700px\\]\\:min-w-11", ["not all and (min-width: 700px)"], 4, [["min-width", "calc(var(--spacing) * 11)"]]], [".max-\\[700px\\]\\:flex-1", ["not all and (min-width: 700px)"], 4, [["flex", "1"]]], [".max-\\[700px\\]\\:flex-\\[1_1_6rem\\]", ["not all and (min-width: 700px)"], 4, [["flex", "6rem"]]], [".max-\\[700px\\]\\:flex-\\[1_1_100\\%\\]", ["not all and (min-width: 700px)"], 4, [["flex", "100%"]]], [".max-\\[700px\\]\\:basis-56", ["not all and (min-width: 700px)"], 4, [["flex-basis", "calc(var(--spacing) * 56)"]]], [".max-\\[700px\\]\\:basis-full", ["not all and (min-width: 700px)"], 4, [["flex-basis", "100%"]]], [".max-\\[700px\\]\\:flex-wrap", ["not all and (min-width: 700px)"], 4, [["flex-wrap", "wrap"]]], [".max-\\[700px\\]\\:gap-y-2", ["not all and (min-width: 700px)"], 4, [["row-gap", "calc(var(--spacing) * 2)"]]], [".min-\\[701px\\]\\:left-auto", ["(min-width: 701px)"], 4, [["left", "auto"]]], [".min-\\[701px\\]\\:my-\\[3px\\]", ["(min-width: 701px)"], 4, [["margin-block", "3px"]]], [".min-\\[701px\\]\\:block", ["(min-width: 701px)"], 4, [["display", "block"]]], [".min-\\[701px\\]\\:hidden", ["(min-width: 701px)"], 4, [["display", "none"]]], [".min-\\[701px\\]\\:min-h-6", ["(min-width: 701px)"], 4, [["min-height", "calc(var(--spacing) * 6)"]]], [".min-\\[701px\\]\\:w-80", ["(min-width: 701px)"], 4, [["width", "calc(var(--spacing) * 80)"]]], [".min-\\[701px\\]\\:rounded-ui", ["(min-width: 701px)"], 4, [["border-radius", "var(--radius)"]]], [".min-\\[701px\\]\\:px-3", ["(min-width: 701px)"], 4, [["padding-inline", "calc(var(--spacing) * 3)"]]], [".min-\\[701px\\]\\:px-4", ["(min-width: 701px)"], 4, [["padding-inline", "calc(var(--spacing) * 4)"]]], [".min-\\[701px\\]\\:pr-\\[3px\\]", ["(min-width: 701px)"], 4, [["padding-right", "3px"]]], [".min-\\[701px\\]\\:pl-4", ["(min-width: 701px)"], 4, [["padding-left", "calc(var(--spacing) * 4)"]]], [".min-\\[701px\\]\\:text-\\[0\\.62rem\\]", ["(min-width: 701px)"], 4, [["font-size", ".62rem"]]], [".min-\\[701px\\]\\:text-\\[12\\.5px\\]", ["(min-width: 701px)"], 4, [["font-size", "12.5px"]]], [".min-\\[701px\\]\\:text-\\[12px\\]", ["(min-width: 701px)"], 4, [["font-size", "12px"]]], [".min-\\[701px\\]\\:font-medium", ["(min-width: 701px)"], 4, [["--tw-font-weight", "var(--font-weight-medium)"], ["font-weight", "var(--font-weight-medium)"]]], [".min-\\[701px\\]\\:font-semibold", ["(min-width: 701px)"], 4, [["--tw-font-weight", "var(--font-weight-semibold)"], ["font-weight", "var(--font-weight-semibold)"]]], [".min-\\[701px\\]\\:tracking-\\[0\\.045em\\]", ["(min-width: 701px)"], 4, [["--tw-tracking", ".045em"], ["letter-spacing", ".045em"]]], [".min-\\[701px\\]\\:text-subtext-0", ["(min-width: 701px)"], 4, [["color", "var(--subtext-0)"]]], [".min-\\[701px\\]\\:uppercase", ["(min-width: 701px)"], 4, [["text-transform", "uppercase"]]], [".min-\\[900px\\]\\:inline", ["(min-width: 900px)"], 4, [["display", "inline"]]], [".pointer-coarse\\:opacity-100", ["(pointer: coarse)"], 4, [["opacity", "1"]]], [".\\[\\&_\\.mode-switch\\]\\:ml-0 .mode-switch", null, 4, [["margin-left", "0"]]], [".max-\\[700px\\]\\:\\[\\&_button\\]\\:min-h-11 button", ["not all and (min-width: 700px)"], 4, [["min-height", "calc(var(--spacing) * 11)"]]], [".\\[\\&_pre\\]\\:m-\\[0\\.2rem_0_0\\.3rem_1\\.2rem\\] pre", null, 4, [["margin", ".2rem 0 .3rem 1.2rem"]]], [".\\[\\&_pre\\]\\:max-h-72 pre", null, 4, [["max-height", "calc(var(--spacing) * 72)"]]], [".\\[\\&_pre\\]\\:overflow-auto pre", null, 4, [["overflow", "auto"]]], [".\\[\\&_pre\\]\\:rounded-ui pre", null, 4, [["border-radius", "var(--radius)"]]], [".\\[\\&_pre\\]\\:bg-surface-0 pre", null, 4, [["background-color", "var(--surface-0)"]]], [".\\[\\&_pre\\]\\:p-2 pre", null, 4, [["padding", "calc(var(--spacing) * 2)"]]], [".\\[\\&_pre\\]\\:text-\\[0\\.78rem\\] pre", null, 4, [["font-size", ".78rem"]]], [".\\[\\&_pre\\]\\:\\[overflow-wrap\\:anywhere\\] pre", null, 4, [["overflow-wrap", "anywhere"]]], [".\\[\\&_pre\\]\\:whitespace-pre-wrap pre", null, 4, [["white-space", "pre-wrap"]]], [".\\[\\&_pre\\]\\:text-fg pre, .\\[\\&_strong\\]\\:text-fg strong", null, 4, [["color", "var(--text)"]]], [".\\[\\&_summary\\]\\:cursor-pointer summary", null, 4, [["cursor", "pointer"]]], [".\\[\\&\\:hover\\:not\\(\\:disabled\\)\\]\\:bg-surface-1:hover:not(:disabled)", null, 4, [["background-color", "var(--surface-1)"]]], [".\\[\\&\\:hover\\:not\\(\\:disabled\\)\\]\\:text-accent:hover:not(:disabled)", null, 4, [["color", "var(--accent)"]]], [".\\[\\&\\:hover\\:not\\(\\:disabled\\)\\]\\:text-red:hover:not(:disabled)", null, 4, [["color", "var(--red)"]]], [".\\[\\&\\:not\\(\\:has\\(\\[data-setting-row\\]\\)\\)\\>\\[data-none\\]\\]\\:block:not(:has([data-setting-row])) > [data-none]", null, 4, [["display", "block"]]], [".\\[\\&\\>\\*\\]\\:min-h-0 > *", null, 4, [["min-height", "0"]]], [".\\[\\&\\>\\*\\]\\:min-w-0 > *", null, 4, [["min-width", "0"]]], [".\\[\\&\\>\\*\\]\\:flex-1 > *", null, 4, [["flex", "1"]]], [".\\[\\&\\>\\*\\]\\:shrink-0 > *", null, 4, [["flex-shrink", "0"]]], [".\\[\\&\\>li\\]\\:text-\\[0\\.85rem\\] > li", null, 4, [["font-size", ".85rem"]]], [".\\[\\&\\>li\\]\\:leading-\\[1\\.5\\] > li", null, 4, [["--tw-leading", "1.5"], ["line-height", "1.5"]]], [".\\[\\&\\>li\\]\\:text-fg > li", null, 4, [["color", "var(--text)"]]], [".\\[\\&\\>summary\\]\\:flex > summary", null, 4, [["display", "flex"]]], [".\\[\\&\\>summary\\]\\:cursor-pointer > summary", null, 4, [["cursor", "pointer"]]], [".\\[\\&\\>summary\\]\\:list-none > summary", null, 4, [["list-style-type", "none"]]], [".\\[\\&\\>summary\\]\\:items-center > summary", null, 4, [["align-items", "center"]]], [".\\[\\&\\>summary\\]\\:gap-\\[0\\.4rem\\] > summary", null, 4, [["gap", ".4rem"]]], [".\\[\\&\\>summary\\]\\:rounded-ui > summary", null, 4, [["border-radius", "var(--radius)"]]], [".\\[\\&\\>summary\\]\\:px-\\[0\\.4rem\\] > summary", null, 4, [["padding-inline", ".4rem"]]], [".\\[\\&\\>summary\\]\\:py-\\[0\\.25rem\\] > summary", null, 4, [["padding-block", ".25rem"]]], [".\\[\\&\\>summary\\]\\:select-none > summary", null, 4, [["-webkit-user-select", "none"], ["user-select", "none"]]], [".\\[\\&\\>summary\\]\\:before\\:inline-block > summary:before", null, 4, [["content", "var(--tw-content)"], ["display", "inline-block"]]], [".\\[\\&\\>summary\\]\\:before\\:size-\\[0\\.4rem\\] > summary:before", null, 4, [["content", "var(--tw-content)"], ["width", ".4rem"], ["height", ".4rem"]]], [".\\[\\&\\>summary\\]\\:before\\:shrink-0 > summary:before", null, 4, [["content", "var(--tw-content)"], ["flex-shrink", "0"]]], [".\\[\\&\\>summary\\]\\:before\\:\\[transform\\:rotate\\(-45deg\\)\\] > summary:before", null, 4, [["content", "var(--tw-content)"], ["transform", "rotate(-45deg)"]]], [".\\[\\&\\>summary\\]\\:before\\:content-\\[\\'\\'\\] > summary:before", null, 4, [["--tw-content", '""'], ["content", "var(--tw-content)"]]], [".\\[\\&\\>summary\\]\\:before\\:\\[border-bottom\\:1\\.3px_solid_currentColor\\] > summary:before", null, 4, [["content", "var(--tw-content)"], ["border-bottom", "1.3px solid"]]], [".\\[\\&\\>summary\\]\\:before\\:\\[border-right\\:1\\.3px_solid_currentColor\\] > summary:before", null, 4, [["content", "var(--tw-content)"], ["border-right", "1.3px solid"]]], [".\\[\\&\\>summary\\]\\:before\\:\\[transition\\:transform_0\\.15s_ease\\] > summary:before", null, 4, [["content", "var(--tw-content)"], ["transition", "transform .15s"]]], [".\\[\\&\\>summary\\:hover\\]\\:bg-surface-1 > summary:hover", null, 4, [["background-color", "var(--surface-1)"]]], [".\\[\\&\\>summary\\:hover\\]\\:text-fg > summary:hover", null, 4, [["color", "var(--text)"]]], [".\\[\\&\\[open\\]\\>summary\\]\\:before\\:\\[transform\\:rotate\\(45deg\\)\\][open] > summary:before", null, 4, [["content", "var(--tw-content)"], ["transform", "rotate(45deg)"]]], [".app--mobile .\\[\\.app--mobile_\\&\\]\\:min-h-11", null, 4, [["min-height", "calc(var(--spacing) * 11)"]]], [".app--mobile .\\[\\.app--mobile_\\&\\]\\:min-h-\\[44px\\]", null, 4, [["min-height", "44px"]]], [".\\[\\@media\\(hover\\:none\\)\\]\\:opacity-60", ["(hover: none)"], 4, [["opacity", ".6"]]], [".\\[\\@media\\(hover\\:none\\)\\]\\:opacity-100", ["(hover: none)"], 4, [["opacity", "1"]]], [".\\[\\@media\\(max-width\\:700px\\)\\]\\:h-\\[2\\.75rem\\]", ["(max-width: 700px)"], 4, [["height", "2.75rem"]]], [".\\[\\@media\\(max-width\\:700px\\)\\]\\:min-h-\\[2\\.75rem\\]", ["(max-width: 700px)"], 4, [["min-height", "2.75rem"]]], [".\\[\\@media\\(max-width\\:700px\\)\\]\\:w-\\[2\\.75rem\\]", ["(max-width: 700px)"], 4, [["width", "2.75rem"]]], [".\\[\\@media\\(max-width\\:700px\\)\\]\\:min-w-\\[2\\.75rem\\]", ["(max-width: 700px)"], 4, [["min-width", "2.75rem"]]], [".\\[\\@media\\(max-width\\:700px\\)\\]\\:px-\\[0\\.65rem\\]", ["(max-width: 700px)"], 4, [["padding-inline", ".65rem"]]], ["div:hover > .\\[div\\:hover\\>\\&\\]\\:opacity-100", null, 4, [["opacity", "1"]]], [":root", null, 1e3, [["color-scheme", "dark"], ["--scrollbar-size", "6px"], ["--accent", "#c8c8c8"], ["--panel-bg", "#161616"], ["--surface-0", "#262626"], ["--surface-1", "#333"], ["--surface-dim", "#1c1c1c"], ["--backdrop", "#050505"], ["--overlay-0", "#3a3a3a"], ["--overlay-1", "#9b9b9b"], ["--text", "#d8d8d8"], ["--subtext-0", "#9b9b9b"], ["--mauve", "#a993c9"], ["--green", "#7fb685"], ["--yellow", "#d3b46a"], ["--red", "#df8c8c"], ["--blue", "#7aa2d7"], ["--teal", "#7fb8b8"], ["--peach", "#d39a6a"], ["--bg", "var(--panel-bg)"], ["--surface", "var(--surface-0)"], ["--surface-alt", "var(--surface-1)"], ["--border", "var(--overlay-0)"], ["--muted", "var(--subtext-0)"], ["--danger", "var(--red)"], ["--radius", "8px"], ["--radius-pane", "8px"], ["accent-color", "var(--accent)"], ["--font-ui", '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif'], ["--font-mono", `ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono",
    monospace`], ["font-family", "var(--font-ui)"]]], ["code, pre, kbd, samp", null, 1e3, [["font-family", "var(--font-mono)"]]], ["*", null, 1e3, [["box-sizing", "border-box"]]], ["html, body, #root", null, 1e3, [["height", "100%"], ["margin", "0"]]], ["html", null, 1e3, [["overscroll-behavior", "none"], ["--shell-bg", "var(--panel-bg)"]]], ["html[data-glass]", null, 1e3, [["--shell-bg", "var(--panel-bg)"]]], ["html[data-glass]", null, 1e3, [["--shell-bg", "color-mix(in srgb, var(--panel-bg) 86%, transparent)"]]], ["html", null, 1e3, [["--backdrop-bg", "var(--backdrop)"], ["--card-bg", "var(--panel-bg)"]]], ["html[data-glass]", null, 1e3, [["--backdrop-bg", "var(--backdrop)"]]], ["html[data-glass]", null, 1e3, [["--backdrop-bg", "color-mix(in srgb, var(--backdrop) 86%, transparent)"]]], ["html[data-glass]", null, 1e3, [["--card-bg", "var(--panel-bg)"]]], ["html[data-glass]", null, 1e3, [["--card-bg", "color-mix(in srgb, var(--panel-bg) 86%, transparent)"]]], ['body:has(.app--cards, .app--mobile), .app--cards .dock-area:has([data-testid="split-canvas"]:not([data-split="0"]))', null, 1e3, [["background", "var(--backdrop-bg)"]]], ["body", null, 1e3, [["background", "var(--shell-bg)"], ["color", "var(--text)"], ["overscroll-behavior", "none"], ["-webkit-tap-highlight-color", "transparent"], ["line-height", "1.3"]]], [".app", null, 1e3, [["flex-direction", "column"], ["height", "100dvh"], ["display", "flex"]]], [".app--mobile", null, 1e3, [["inset", "var(--visible-top, 0px) 0 auto 0"], ["height", "var(--visible-height, 100dvh)"], ["position", "fixed"]]], [".mobile-drawer-backdrop", null, 1e3, [["animation", ".15s ease-out mobile-fade"]]], [".mobile-drawer--left", null, 1e3, [["animation", ".2s cubic-bezier(.2, .8, .2, 1) mobile-slide-left"]]], [".mobile-drawer--right", null, 1e3, [["animation", ".2s cubic-bezier(.2, .8, .2, 1) mobile-slide-right"]]], [".mobile-sheet", null, 1e3, [["animation", ".22s cubic-bezier(.2, .8, .2, 1) mobile-rise"]]], [".mobile-drawer-backdrop, .mobile-drawer, .mobile-sheet", ["(prefers-reduced-motion: reduce)"], 1e3, [["animation", "none"]]], [".layout-drawer", null, 1e3, [["transform", "translateX(var(--float-hide, 0))"], ["transition", "transform .18s"]]], [".layout-drawer:hover, .layout-drawer:focus-within", null, 1e3, [["--float-hide", "0px"]]], [".dockview-theme-perch", null, 1e3, [["--dv-color-abyss-dark", "var(--panel-bg)"], ["--dv-color-abyss", "var(--surface-0)"], ["--dv-color-abyss-light", "var(--surface-1)"], ["--dv-color-abyss-lighter", "var(--overlay-0)"], ["--dv-color-abyss-accent", "var(--accent)"], ["--dv-color-abyss-primary-text", "var(--text)"], ["--dv-color-abyss-secondary-text", "var(--subtext-0)"], ["--dv-group-view-background-color", "var(--panel-bg)"], ["--dv-tabs-and-actions-container-background-color", "var(--surface-0)"], ["--dv-activegroup-visiblepanel-tab-background-color", "var(--panel-bg)"], ["--dv-activegroup-hiddenpanel-tab-background-color", "var(--surface-0)"], ["--dv-inactivegroup-visiblepanel-tab-background-color", "var(--panel-bg)"], ["--dv-inactivegroup-hiddenpanel-tab-background-color", "var(--surface-0)"], ["--dv-tab-divider-color", "var(--overlay-0)"], ["--dv-activegroup-visiblepanel-tab-color", "var(--text)"], ["--dv-activegroup-hiddenpanel-tab-color", "var(--subtext-0)"], ["--dv-inactivegroup-visiblepanel-tab-color", "var(--subtext-0)"], ["--dv-inactivegroup-hiddenpanel-tab-color", "var(--subtext-0)"], ["--dv-separator-border", "var(--overlay-0)"], ["--dv-paneview-header-border-color", "var(--overlay-0)"], ["--dv-tabs-and-actions-container-font-size", ".82rem"], ["--dv-tabs-and-actions-container-height", "2.1rem"]]], [".dockview-theme-perch .dv-tabs-and-actions-container", null, 1e3, [["z-index", "1"], ["position", "relative"]]], [".pane-tab", null, 1e3, [["align-items", "center"], ["width", "100%"], ["height", "100%"], ["display", "flex"]]], [".pane-tab__agent-badge", null, 1e3, [["color", "var(--subtext-0)"], ["white-space", "nowrap"], ["flex-shrink", "0"], ["margin-right", ".4rem"], ["font-size", ".78em"]]], ['.pane-tab[data-testid="pane-tab-chat"] .dv-default-tab-action', null, 1e3, [["display", "none"]]], [".dockview-group-action", null, 1e3, [["border-radius", "var(--radius)"], ["width", "1.5rem"], ["height", "1.5rem"], ["color", "var(--subtext-0)"], ["cursor", "pointer"], ["background", "none"], ["border", "none"], ["justify-content", "center"], ["align-self", "center"], ["align-items", "center"], ["margin", "0 .15rem"], ["font-size", "1rem"], ["line-height", "1"], ["transition", "color .1s, background .1s"], ["display", "flex"]]], [".dockview-group-action:hover", null, 1e3, [["color", "var(--text)"], ["background", "var(--surface-1)"]]], [".dockview-theme-perch .dv-view-container > .dv-view:has(.dv-inactive-group)", ["(max-width: 700px)"], 1e3, [["display", "none"]]], [".dockview-theme-perch .dv-view-container > .dv-view:has(.dv-active-group)", ["(max-width: 700px)"], 1e3, [["width", "100%", 1], ["left", "0", 1]]], [".chat", null, 1e3, [["isolation", "isolate"], ["flex-direction", "column"], ["flex", "1"], ["height", "100%"], ["min-height", "0"], ["display", "flex"]]], [".message__markdown p", null, 1e3, [["margin", "0 0 .5em"]]], [".message__markdown p:last-child", null, 1e3, [["margin-bottom", "0"]]], [".message__markdown h1, .message__markdown h2, .message__markdown h3, .message__markdown h4", null, 1e3, [["margin", ".6em 0 .3em"], ["line-height", "1.25"]]], [".message__markdown h1", null, 1e3, [["font-size", "1.25em"]]], [".message__markdown h2", null, 1e3, [["font-size", "1.12em"]]], [".message__markdown h3", null, 1e3, [["font-size", "1em"]]], [".message__markdown > * + *", null, 1e3, [["margin-top", ".5em"]]], [".message__markdown table, .md-table", null, 1e3, [["border-collapse", "separate"], ["border-spacing", "0"], ["background", "var(--surface-0)"], ["border-radius", "var(--radius)"], ["max-width", "100%"], ["margin", ".5em 0"], ["font-size", ".92em"], ["display", "block"], ["overflow-x", "auto"]]], [".md-table", null, 1e3, [["width", "100%"], ["margin", "0"], ["display", "table"]]], [".message__markdown th, .message__markdown td, .md-table th, .md-table td", null, 1e3, [["text-align", "left"], ["vertical-align", "top"], ["border-bottom", "1px solid var(--surface-1)"], ["padding", ".35em .75em"]]], [".message__markdown th, .md-table th", null, 1e3, [["color", "var(--subtext-0)"], ["white-space", "nowrap"], ["background", "var(--surface-1)"], ["font-weight", "600"]]], [".message__markdown tbody tr:last-child td, .md-table tbody tr:last-child td", null, 1e3, [["border-bottom", "0"]]], [".message__markdown tbody tr:hover td, .md-table tbody tr:hover td", null, 1e3, [["background", "var(--surface-1)"]]], [".md-table caption", null, 1e3, [["text-align", "left"], ["color", "var(--subtext-0)"], ["padding", ".4em .75em"]]], [".md-code", null, 1e3, [["background", "var(--surface-0)"], ["border-radius", "var(--radius)"], ["overflow", "hidden"]]], [".md-code__bar", null, 1e3, [["color", "var(--subtext-0)"], ["background", "var(--surface-1)"], ["justify-content", "space-between"], ["align-items", "center"], ["padding", ".1rem .4rem .1rem .75rem"], ["font-size", ".75em"], ["display", "flex"]]], [".message__markdown .md-code pre", null, 1e3, [["background", "none"], ["border-radius", "0"], ["margin", "0"]]], [".hl-keyword", null, 1e3, [["color", "var(--mauve)"]]], [".hl-string", null, 1e3, [["color", "var(--green)"]]], [".hl-number", null, 1e3, [["color", "var(--peach)"]]], [".hl-function", null, 1e3, [["color", "var(--blue)"]]], [".hl-type", null, 1e3, [["color", "var(--yellow)"]]], [".hl-tag", null, 1e3, [["color", "var(--teal)"]]], [".hl-comment", null, 1e3, [["color", "var(--overlay-1)"], ["font-style", "italic"]]], [".message__markdown ul, .message__markdown ol", null, 1e3, [["margin", ".3em 0 .5em 1.3em"], ["padding", "0"]]], [".message__markdown li", null, 1e3, [["margin-bottom", ".2em"]]], [".message__markdown code", null, 1e3, [["background", "var(--surface-0)"], ["border-radius", ".25rem"], ["padding", ".1em .35em"], ["font-family", "ui-monospace, SFMono-Regular, SF Mono, Menlo, Consolas, monospace"], ["font-size", ".88em"]]], [".message__markdown pre", null, 1e3, [["background", "var(--surface-0)"], ["border-radius", "var(--radius)"], ["margin", ".4em 0"], ["padding", ".6rem .75rem"], ["position", "relative"], ["overflow-x", "auto"]]], [".message__markdown pre code", null, 1e3, [["background", "none"], ["border", "none"], ["padding", "0"], ["font-size", ".85em"]]], [".message__markdown a", null, 1e3, [["color", "var(--accent)"], ["text-decoration", "underline"]]], [".message__markdown blockquote", null, 1e3, [["border-left", "3px solid var(--overlay-0)"], ["color", "var(--subtext-0)"], ["margin", ".4em 0"], ["padding", ".1em .6em"]]], [".message__markdown hr", null, 1e3, [["border", "none"], ["border-top", "1px solid var(--overlay-0)"], ["margin", ".75em 0"]]], [".file-markdown", null, 1e3, [["overflow-wrap", "anywhere"]]], [".file-markdown img", null, 1e3, [["max-width", "100%"]]], [".file-markdown table", null, 1e3, [["border-collapse", "collapse"], ["margin", ".4em 0"], ["display", "block"], ["overflow-x", "auto"]]], [".file-markdown th, .file-markdown td", null, 1e3, [["border", "1px solid var(--overlay-0)"], ["padding", ".2em .5em"]]], [".file-markdown .md-placeholder", null, 1e3, [["color", "var(--subtext-0)"], ["border", "1px dashed var(--overlay-0)"], ["border-radius", ".25rem"], ["padding", ".05em .35em"], ["font-size", ".9em"]]], [".terminal", null, 1e3, [["min-width", "0"], ["min-height", "0"], ["padding", "var(--terminal-padding, 0)"], ["opacity", "var(--terminal-opacity, 1)"], ["flex", "1"], ["display", "flex"], ["position", "relative"]]], [".terminal__surface", null, 1e3, [["flex", "1"], ["min-width", "0"], ["min-height", "0"], ["overflow", "hidden"]]], [".terminal__surface .xterm", null, 1e3, [["height", "100%"]]], [".terminal__surface .xterm:not(.allow-transparency) .xterm-viewport", null, 1e3, [["background-color", "#0000"]]], [".terminal__surface .xterm-scrollable-element", null, 1e3, [["position", "static", 1]]], [".terminal__surface .xterm-decoration-overview-ruler, .no-pane-scrollbars .terminal__surface .xterm-scrollable-element > .xterm-scrollbar", null, 1e3, [["display", "none"]]], [".terminal--persistent", null, 1e3, [["flex-direction", "column"]]], [".terminal__toolbar", null, 1e3, [["color", "var(--subtext-0)"], ["align-items", "center"], ["gap", ".5rem"], ["padding", ".25rem 1.5rem .25rem .5rem"], ["font-size", ".8rem"], ["display", "flex"]]], [".terminal__toolbar button", null, 1e3, [["border-radius", "var(--radius)"], ["min-height", "32px"], ["color", "var(--text)"], ["background", "var(--surface-0)"], ["border", "0"], ["padding", ".25rem .5rem"]]], [".terminal__toolbar--overlay", null, 1e3, [["z-index", "2"], ["border-radius", "var(--radius)"], ["background", "var(--surface-1)"], ["padding", ".2rem .3rem .2rem .6rem"], ["position", "absolute"], ["top", ".4rem"], ["right", ".9rem"], ["box-shadow", "0 2px 8px #00000040"]]], [".terminal__connection", null, 1e3, [["margin-right", "auto"]]], [".terminal__toolbar button:disabled", null, 1e3, [["opacity", ".5"]]], [".terminal__notice", null, 1e3, [["color", "var(--subtext-0)"], ["padding", ".75rem"], ["font-size", ".85rem"]]], [".app--mobile .terminal__toolbar button", null, 1e3, [["min-height", "44px"]]], [".app--mobile .terminal__connection", null, 1e3, [["display", "none"]]], [".app--mobile .terminal__toolbar", null, 1e3, [["padding-right", ".5rem"]]], [".terminal__exited", null, 1e3, [["background", "var(--surface-1)"], ["border-radius", "var(--radius)"], ["color", "var(--subtext-0)"], ["padding", ".35rem .75rem"], ["font-size", ".85rem"], ["position", "absolute"], ["bottom", ".75rem"], ["left", "50%"], ["transform", "translateX(-50%)"]]], [".terminal__exited--cli", null, 1e3, [["background", "var(--panel-bg)"], ["flex-direction", "column"], ["align-items", "center"], ["gap", ".6rem"], ["padding", ".9rem 1.1rem"], ["display", "flex"], ["top", "50%"], ["bottom", "auto"], ["transform", "translate(-50%, -50%)"], ["box-shadow", "0 6px 24px #00000059"]]], [".terminal__exited-actions", null, 1e3, [["gap", ".5rem"], ["display", "flex"]]], [".terminal__cli-error", null, 1e3, [["background", "var(--red)"], ["position", "absolute"], ["bottom", ".75rem"], ["left", "50%"], ["transform", "translateX(-50%)"]]], [".terminal__cli-error", null, 1e3, [["background", "color-mix(in srgb, var(--red) 20%, var(--panel-bg))"]]], [".terminal__cli-error", null, 1e3, [["border-radius", "var(--radius)"], ["color", "var(--red)"], ["text-align", "center"], ["white-space", "pre-wrap"], ["word-break", "break-word"], ["max-width", "90%"], ["padding", ".35rem .75rem"], ["font-size", ".85rem"]]], [".mobile-pane-shell__content > .chat, .mobile-pane-shell__content > .terminal, .mobile-pane-shell__content > .workspace-files, .mobile-pane-shell__content > .workspace-git", null, 1e3, [["flex", "1"], ["width", "100%"], ["min-width", "0"], ["height", "100%"], ["min-height", "0"]]], [".terminal__host", null, 1e3, [["width", "100%"], ["height", "100%"], ["overflow", "hidden"]]], [".workspace-git", null, 1e3, [["--git-border", "var(--overlay-0)"]]], [".workspace-git", null, 1e3, [["--git-border", "color-mix(in srgb, var(--overlay-0) 72%, transparent)"]]], [".workspace-git", null, 1e3, [["--git-muted", "var(--subtext-0)"], ["width", "100%"], ["min-width", "0"], ["height", "100%"], ["min-height", "0"], ["color", "var(--text)"], ["background", "var(--workspace-tools-bg, var(--panel-bg))"], ["flex-direction", "column"], ["font-size", ".78rem"], ["display", "flex"], ["position", "relative"], ["overflow", "hidden"], ["container-type", "inline-size"]]], [".workspace-git button, .workspace-git input, .workspace-git textarea", null, 1e3, [["font", "inherit"]]], [".workspace-git button", null, 1e3, [["cursor", "pointer"]]], ['.workspace-git button:focus-visible, .workspace-git input:focus-visible, .workspace-git textarea:focus-visible, .workspace-git [role="button"]:focus-visible', null, 1e3, [["outline", "2px solid var(--accent)"], ["outline-offset", "1px"]]], [".workspace-git__diff", null, 1e3, [["container-type", "inline-size"]]], [".workspace-git__line-comment-thread", null, 1e3, [["max-width", "max(0px, min(42rem, 100cqi - 6.9rem))"], ["position", "sticky"], ["left", "0"]]], [".workspace-git__comment-composer", null, 1e3, [["max-width", "max(0px, 100cqi - 1.4rem)"], ["position", "sticky"], ["left", "0"]]], [".dockview-group-action--split-session", null, 1e3, [["font-size", "13px"]]], [".session-split-popover", null, 1e3, [["display", "flex"], ["flex-direction", "column"], ["background", "var(--surface-1)"], ["border-radius", "var(--radius)"], ["box-shadow", "0 8px 24px rgba(0, 0, 0, 0.45)"], ["padding", "4px"], ["font-size", "12.5px"], ["color", "var(--text)"], ["overflow", "hidden"]]], [".session-split-popover__header", null, 1e3, [["padding", "6px 8px 4px"], ["font-size", "11px"], ["text-transform", "uppercase"], ["letter-spacing", "0.04em"], ["color", "var(--subtext-0)"]]], [".session-split-popover__empty", null, 1e3, [["padding", "8px"], ["color", "var(--subtext-0)"]]], [".session-split-popover__list", null, 1e3, [["overflow-y", "auto"]]], [".session-split-popover__item", null, 1e3, [["display", "flex"], ["flex-direction", "column"], ["align-items", "flex-start"], ["gap", "1px"], ["width", "100%"], ["padding", "6px 8px"], ["border", "none"], ["border-radius", "4px"], ["background", "transparent"], ["color", "inherit"], ["text-align", "left"], ["cursor", "grab"]]], [".session-split-popover__item:hover", null, 1e3, [["background", "var(--surface-0)"]]], [".session-split-popover__item-title", null, 1e3, [["font-weight", "500"], ["white-space", "nowrap"], ["overflow", "hidden"], ["text-overflow", "ellipsis"], ["max-width", "100%"]]], [".session-split-popover__item-cwd", null, 1e3, [["font-size", "11px"], ["color", "var(--subtext-0)"], ["white-space", "nowrap"], ["overflow", "hidden"], ["text-overflow", "ellipsis"], ["max-width", "100%"]]], [".session-split-popover__item-badge", null, 1e3, [["align-self", "flex-end"], ["font-size", "10px"], ["color", "var(--accent)"], ["margin-top", "-14px"]]], [".inactive-session-pane", null, 1e3, [["display", "flex"], ["flex-direction", "column"], ["align-items", "center"], ["justify-content", "center"], ["gap", "10px"], ["height", "100%"], ["padding", "24px"], ["text-align", "center"], ["color", "var(--subtext-0)"]]], [".inactive-session-pane__title", null, 1e3, [["font-size", "14px"], ["font-weight", "500"], ["color", "var(--text)"]]], [".inactive-session-pane__cwd", null, 1e3, [["font-size", "12px"], ["color", "var(--subtext-0)"], ["word-break", "break-all"]]], [".inactive-session-pane__note", null, 1e3, [["font-size", "12px"], ["max-width", "320px"], ["line-height", "1.5"]]], [".inactive-session-pane__switch", null, 1e3, [["margin-top", "4px"], ["padding", "6px 14px"], ["border-radius", "var(--radius)"], ["border", "0"], ["background", "var(--surface-0)"], ["color", "var(--text)"], ["cursor", "pointer"], ["font-size", "12.5px"]]], [".inactive-session-pane__switch:hover", null, 1e3, [["background", "var(--surface-1)"]]]], skipped: { "@supports evaluated false": 2, "@container": 6, "@keyframes": 9 } };
//! The app's compiled stylesheet as a table (`build.mjs` writes it from Vite + Tailwind's output and bundles it as
//! `virtual:perch-css-table`), parsed once on first use.
let wg = null;
const _g = () => wg ??= new H0(xg);
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
function Sg(n, l) {
  const s = /* @__PURE__ */ new Set([...Object.keys(n), ...Object.keys(l)]);
  for (const i of s) {
    if (i === "children") continue;
    const o = n[i], d = l[i];
    if (!(o === d || typeof o == "function" && typeof d == "function") && !(i === "style" && o && d && typeof o == "object" && typeof d == "object" && [.../* @__PURE__ */ new Set([...Object.keys(o), ...Object.keys(d)])].every((f) => o[f] === d[f])))
      return !0;
  }
  return !1;
}
const kg = (n) => !n.props.disabled && (/^(button|input|select|textarea)$/.test(n.tagName) || n.tagName === "a" && n.props.href != null || n.props.tabIndex != null);
function $d(n, l) {
  for (const s of e0(l.dangerouslySetInnerHTML?.__html, n.ownerDocument) ?? []) n.appendChild(s);
  return n;
}
const Eg = {
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
  createInstance: (n, l, s) => $d(new $t(n, l, s.ownerDocument), l),
  createTextInstance: (n, l) => new $r(n),
  appendInitialChild: (n, l) => {
    n.appendChild(l);
  },
  // `autoFocus` focuses the element once it is in the tree, as React DOM does.
  finalizeInitialChildren: (n, l, s) => !!s.autoFocus,
  shouldSetTextContent: () => !1,
  appendChild: (n, l) => {
    n.appendChild(l);
  },
  appendChildToContainer: (n, l) => {
    n.appendChild(l);
  },
  insertBefore: (n, l, s) => {
    n.insertBefore(l, s);
  },
  insertInContainerBefore: (n, l, s) => {
    n.insertBefore(l, s);
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
  commitUpdate: (n, l, s, i) => {
    if (n.props = i, n.inline) for (const o of Object.keys(n.inline)) s.style?.[o] !== i.style?.[o] && delete n.inline[o];
    if (s.dangerouslySetInnerHTML?.__html !== i.dangerouslySetInnerHTML?.__html) {
      for (const o of [...n.childNodes]) n.removeChild(o);
      $d(n, i);
    }
    Sg(s, i) && n.touch();
  },
  commitTextUpdate: (n, l, s) => {
    n.data = String(s);
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
}, ze = S0(Eg), Pr = (n, l, s = null) => ze.createPortal(n, l, null, s), zg = {
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
}, Ng = /* @__PURE__ */ new Set(["click", "dblclick", "mousedown", "mouseup"]), Tg = /* @__PURE__ */ new Set(["button", "input", "select", "textarea", "fieldset"]), Cg = (n) => {
  for (let l = n; l instanceof $t; l = l.parentNode) if (l.props.disabled && Tg.has(l.tagName)) return !0;
  return !1;
};
class Mg {
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
function Mr(n, l, s) {
  l.currentTarget = n;
  for (const { type: i, listener: o, capture: d } of [...n.listeners ?? []])
    i === l.type && d === s && o.call(n, l);
  if (n instanceof $t) {
    const i = zg[l.type], o = i && n.props[s ? `${i}Capture` : i];
    typeof o == "function" && o(l);
  }
}
function uy(n, l, s = {}) {
  const { document: i, window: o, globals: d } = i0(n), m = new $t("div", { id: "root", style: s.container ?? {} }, i);
  i.body.appendChild(m);
  const f = [];
  let p = null;
  const v = () => [i, o].map((D) => D.listeners.map((h) => `${h.type}:${h.capture}`).sort().join(",")).join("|");
  let k = "";
  const E = {}, x = `m${Math.random().toString(36).slice(2, 10)}:`;
  let z = 0, S = -1;
  i.measureKey = (D) => x + D.id, i.stale = () => S !== z, i.computed = (D) => {
    if (!E.cascade || !E.top) return null;
    const h = [];
    for (let y = D; y instanceof $t && y !== i.body; y = y.parentNode) h.unshift(y);
    let b = E.top;
    for (const y of h) b = E.cascade.compute(y, b);
    return b.values;
  };
  const w = () => (z += 1, p = yg(i, n, _g(), E, s.names), k = v(), n.render?.(p), p), _ = () => {
    ze.flushPassiveEffects(), ze.flushSyncWork(), v() !== k && w();
  };
  i.afterCommit = w;
  const N = (D) => {
    f.push(D), n.error?.(D);
  }, B = ze.createContainer(m, El.ConcurrentRoot, null, !1, null, "", N, N, N, null);
  ze.updateContainerSync(ct.createElement(l, s.props ?? {}), B, null, null), ze.flushSyncWork(), _();
  const j = (D) => {
    const h = (b) => {
      if (b.id === D) return b;
      for (const y of b.children) {
        const A = h(y);
        if (A) return A;
      }
      return null;
    };
    return h(i.documentElement);
  }, Z = (D) => {
    const h = sa;
    sa = El.DiscreteEventPriority;
    try {
      return D();
    } finally {
      sa = h, ze.flushSyncWork(), _();
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
      return p;
    },
    describe: w,
    /** Runs a DOM event of `type` at node `id`; false when the node is gone. */
    dispatch(D, h, b = {}) {
      const y = typeof D == "string" ? j(D) : D;
      if (!y || Ng.has(h) && Cg(y)) return !1;
      const A = new Mg(h, b, y), O = [];
      for (let L = y; L; L = L.parentNode) O.push(L);
      const M = [...O, i, o];
      Z(() => {
        for (let L = M.length - 1; L > 0 && !A.propagationStopped; L--) Mr(M[L], A, !0);
        A.propagationStopped || (Mr(y, A, !0), A.propagationStopped || Mr(y, A, !1));
        for (let L = 1; L < M.length && !A.propagationStopped; L++) Mr(M[L], A, !1);
      });
      const U = h === "click" && !A.defaultPrevented ? ts(y) : null;
      if (U && q.dispatch(U, "submit", {}), h === "click" && !A.defaultPrevented)
        for (let L = y; L; L = L.parentNode) {
          if (L.tagName !== "a") continue;
          const F = L.props?.href;
          typeof F == "string" && /^https:\/\/\S+$/.test(F) && n.openLink?.(F);
          break;
        }
      return !A.defaultPrevented;
    },
    /** Whether the source listens for `type` on `window` or `document` (a page recording a key press does). */
    listensFor: (D) => [i, o].some((h) => h.listeners.some((b) => b.type === D)),
    /** A key pressed while the screen has the keyboard (`init`: the DOM's `key`, modifiers, `repeat`), at the
     * focused element. When nothing prevented it and that element is a text field, the key edits the field as a
     * browser would: a character is typed at the end (or replaces the text when all of it is selected), Backspace
     * deletes the last one, and the field gets `input` and `change` events with its new `value`. Returns whether the
     * source took the key (prevented it, or a field changed). */
    key(D) {
      const h = i.activeElement && i.activeElement !== i.body ? i.activeElement : i.body;
      if (!q.dispatch(h, "keydown", D)) return !0;
      const y = D.key === "Enter" && !D.isComposing ? ts(h, !0) : null;
      if (y)
        return q.dispatch(y, "submit", {}), !0;
      if (!Nf(h) || h.props.disabled || h.props.readOnly) return !1;
      if ((D.ctrlKey || D.metaKey) && !D.altKey && !D.shiftKey && D.key.toLowerCase() === "a")
        return h.selectedAll = !0, !0;
      if (D.ctrlKey || D.metaKey) return !1;
      const A = h.selectedAll;
      h.selectedAll = !1;
      const O = h.value, U = D.key === "Backspace" || A && D.key === "Delete" ? A ? "" : O.slice(0, -1) : [...D.key].length === 1 ? (A ? "" : O) + D.key : O;
      return U === O ? !1 : (h.value = U, q.dispatch(h, "input", { data: D.key }), q.dispatch(h, "change", {}), h.props.value !== void 0 && delete h.edit, h.touch(), w(), !0);
    },
    /** The engine's box for node `id` (window coordinates, logical px), for `getBoundingClientRect`. */
    setBounds(D, h) {
      const b = j(D);
      b && (b.bounds = { x: h.x, y: h.y, width: h.width, height: h.height });
    },
    /** A click on a check box or radio button (`id`): the `click` event, then, unless the source prevented it, the
     * box ticked as a browser ticks it (a radio button only on), with `input` and `change` events. */
    toggle(D) {
      const h = j(D);
      if (!h || h.props.disabled || !q.dispatch(D, "click", { button: 0, detail: 1 })) return;
      const b = h.props.type === "radio";
      b && h.checked || (h.checked = b ? !0 : !h.checked, q.dispatch(D, "input", {}), q.dispatch(D, "change", {}), h.props.checked !== void 0 && delete h.ticked, h.touch(), w());
    },
    /** A left click as the engine reports one: press then release on the same node. */
    click(D, h = {}) {
      const b = { button: 0, buttons: 1, pointerType: "mouse", ...h };
      for (const y of ["pointerdown", "mousedown", "pointerup", "mouseup", "click"]) q.dispatch(D, y, b);
    },
    /** The pointer entered (`on`) or left node `id` (one the description marks `track_hover`): its `:hover` state,
     * which a descendant's group variant reads. The element's own `hover:` styles are the engine's hover style. */
    /** Whether the pointer is over node `id`, as `hover` last said. */
    hovered: (D) => !!j(D)?.state.hover,
    hover(D, h) {
      const b = j(D);
      !b || b.state.hover === h || (b.state.hover = h, b.touch(), w());
    },
    focus(D) {
      const h = j(D);
      h && (Z(() => {
        const b = i.activeElement;
        b && b !== h && b !== i.body && q.dispatch(b, "blur"), i.focus(h), q.dispatch(h, "focus");
      }), w());
    },
    /** A press at node `id` that nothing prevented: the browser's default focuses the element pressed. Only an element
     * that listens for keys (`onKeyDown`) is focused, so a press elsewhere leaves the keyboard where it was; the focus
     * is not `:focus-visible`, as after a pointer press in a browser. */
    // ponytail: a browser focuses every focusable element pressed; here only one with its own key handler, so a
    // screen's ordinary buttons do not take the keyboard from a terminal.
    pressFocus(D) {
      let b = typeof D == "string" ? j(D) : D;
      for (; b && !(b instanceof $t && typeof b.props.onKeyDown == "function" && kg(b)); ) b = b.parentNode;
      !b || b === i.activeElement || (q.focus(b.id), b.state.pointerFocus = !0, b.touch(), w());
    },
    /** The engine is drawing the latest description: the boxes measured in this frame's layout are the tree's.
     * Returns whether effects wait for that layout (`measured`); run them with `retry` once the frame is drawn. */
    drawing() {
      return S = z, i.retries.length > 0;
    },
    /** Runs the effects that waited for a fresh layout. */
    retry() {
      const D = i.retries.splice(0);
      for (const h of D) h();
    },
    /** Runs effects React has scheduled (the engine calls it after a frame). */
    flush: _,
    update(D) {
      ze.updateContainerSync(ct.createElement(l, D ?? {}), B, null, null), ze.flushSyncWork(), _();
    },
    unmount() {
      ze.updateContainerSync(null, B, null, null), ze.flushSyncWork(), ze.flushPassiveEffects(), i.afterCommit = null, i.retries.length = 0, n.forgetBounds?.(x);
    }
  };
  return q;
}
//! `react-dom` for a screen on the native renderer: `createPortal` (into `document.body`, the overlay layer) and
//! `flushSync`. Nothing of the browser renderer.
const Yf = (n) => ze.flushSyncFromReconciler(n), Ag = { createPortal: Pr, flushSync: Yf }, dy = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  createPortal: Pr,
  default: Ag,
  flushSync: Yf
}, Symbol.toStringTag, { value: "Module" }));
function Gf(n) {
  var l, s, i = "";
  if (typeof n == "string" || typeof n == "number") i += n;
  else if (typeof n == "object") if (Array.isArray(n)) {
    var o = n.length;
    for (l = 0; l < o; l++) n[l] && (s = Gf(n[l])) && (i && (i += " "), i += s);
  } else for (s in n) n[s] && (i && (i += " "), i += s);
  return i;
}
function Kf() {
  for (var n, l, s = 0, i = "", o = arguments.length; s < o; s++) (n = arguments[s]) && (l = Gf(n)) && (i && (i += " "), i += l);
  return i;
}
const jg = (n, l) => {
  const s = new Array(n.length + l.length);
  for (let i = 0; i < n.length; i++)
    s[i] = n[i];
  for (let i = 0; i < l.length; i++)
    s[n.length + i] = l[i];
  return s;
}, Og = (n, l) => ({
  classGroupId: n,
  validator: l
}), Qf = (n = /* @__PURE__ */ new Map(), l = null, s) => ({
  nextPart: n,
  validators: l,
  classGroupId: s
}), Zr = "-", Pd = [], Rg = "arbitrary..", Dg = (n) => {
  const l = Hg(n), {
    conflictingClassGroups: s,
    conflictingClassGroupModifiers: i
  } = n;
  return {
    getClassGroupId: (m) => {
      if (m.startsWith("[") && m.endsWith("]"))
        return Bg(m);
      const f = m.split(Zr), p = f[0] === "" && f.length > 1 ? 1 : 0;
      return Vf(f, p, l);
    },
    getConflictingClassGroupIds: (m, f) => {
      if (f) {
        const p = i[m], v = s[m];
        return p ? v ? jg(v, p) : p : v || Pd;
      }
      return s[m] || Pd;
    }
  };
}, Vf = (n, l, s) => {
  if (n.length - l === 0)
    return s.classGroupId;
  const o = n[l], d = s.nextPart.get(o);
  if (d) {
    const v = Vf(n, l + 1, d);
    if (v) return v;
  }
  const m = s.validators;
  if (m === null)
    return;
  const f = l === 0 ? n.join(Zr) : n.slice(l).join(Zr), p = m.length;
  for (let v = 0; v < p; v++) {
    const k = m[v];
    if (k.validator(f))
      return k.classGroupId;
  }
}, Bg = (n) => n.slice(1, -1).indexOf(":") === -1 ? void 0 : (() => {
  const l = n.slice(1, -1), s = l.indexOf(":"), i = l.slice(0, s);
  return i ? Rg + i : void 0;
})(), Hg = (n) => {
  const {
    theme: l,
    classGroups: s
  } = n;
  return Ug(s, l);
}, Ug = (n, l) => {
  const s = Qf();
  for (const i in n) {
    const o = n[i];
    _s(o, s, i, l);
  }
  return s;
}, _s = (n, l, s, i) => {
  const o = n.length;
  for (let d = 0; d < o; d++) {
    const m = n[d];
    qg(m, l, s, i);
  }
}, qg = (n, l, s, i) => {
  if (typeof n == "string") {
    Yg(n, l, s);
    return;
  }
  if (typeof n == "function") {
    Gg(n, l, s, i);
    return;
  }
  Kg(n, l, s, i);
}, Yg = (n, l, s) => {
  const i = n === "" ? l : Xf(l, n);
  i.classGroupId = s;
}, Gg = (n, l, s, i) => {
  if (Qg(n)) {
    _s(n(i), l, s, i);
    return;
  }
  l.validators === null && (l.validators = []), l.validators.push(Og(s, n));
}, Kg = (n, l, s, i) => {
  const o = Object.entries(n), d = o.length;
  for (let m = 0; m < d; m++) {
    const [f, p] = o[m];
    _s(p, Xf(l, f), s, i);
  }
}, Xf = (n, l) => {
  let s = n;
  const i = l.split(Zr), o = i.length;
  for (let d = 0; d < o; d++) {
    const m = i[d];
    let f = s.nextPart.get(m);
    f || (f = Qf(), s.nextPart.set(m, f)), s = f;
  }
  return s;
}, Qg = (n) => "isThemeGetter" in n && n.isThemeGetter === !0, Vg = (n) => {
  if (n < 1)
    return {
      get: () => {
      },
      set: () => {
      }
    };
  let l = 0, s = /* @__PURE__ */ Object.create(null), i = /* @__PURE__ */ Object.create(null);
  const o = (d, m) => {
    s[d] = m, l++, l > n && (l = 0, i = s, s = /* @__PURE__ */ Object.create(null));
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
}, os = "!", tf = ":", Xg = [], ef = (n, l, s, i, o) => ({
  modifiers: n,
  hasImportantModifier: l,
  baseClassName: s,
  maybePostfixModifierPosition: i,
  isExternal: o
}), Lg = (n) => {
  const {
    prefix: l,
    experimentalParseClassName: s
  } = n;
  let i = (o) => {
    const d = [];
    let m = 0, f = 0, p = 0, v;
    const k = o.length;
    for (let w = 0; w < k; w++) {
      const _ = o[w];
      if (m === 0 && f === 0) {
        if (_ === tf) {
          d.push(o.slice(p, w)), p = w + 1;
          continue;
        }
        if (_ === "/") {
          v = w;
          continue;
        }
      }
      _ === "[" ? m++ : _ === "]" ? m-- : _ === "(" ? f++ : _ === ")" && f--;
    }
    const E = d.length === 0 ? o : o.slice(p);
    let x = E, z = !1;
    E.endsWith(os) ? (x = E.slice(0, -1), z = !0) : (
      /**
       * In Tailwind CSS v3 the important modifier was at the start of the base class name. This is still supported for legacy reasons.
       * @see https://github.com/dcastil/tailwind-merge/issues/513#issuecomment-2614029864
       */
      E.startsWith(os) && (x = E.slice(1), z = !0)
    );
    const S = v && v > p ? v - p : void 0;
    return ef(d, z, x, S);
  };
  if (l) {
    const o = l + tf, d = i;
    i = (m) => m.startsWith(o) ? d(m.slice(o.length)) : ef(Xg, !1, m, void 0, !0);
  }
  if (s) {
    const o = i;
    i = (d) => s({
      className: d,
      parseClassName: o
    });
  }
  return i;
}, Zg = (n) => {
  const l = /* @__PURE__ */ new Map();
  return n.orderSensitiveModifiers.forEach((s, i) => {
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
}, Jg = (n) => ({
  cache: Vg(n.cacheSize),
  parseClassName: Lg(n),
  sortModifiers: Zg(n),
  postfixLookupClassGroupIds: Wg(n),
  ...Dg(n)
}), Wg = (n) => {
  const l = /* @__PURE__ */ Object.create(null), s = n.postfixLookupClassGroups;
  if (s)
    for (let i = 0; i < s.length; i++)
      l[s[i]] = !0;
  return l;
}, Fg = /\s+/, Ig = (n, l) => {
  const {
    parseClassName: s,
    getClassGroupId: i,
    getConflictingClassGroupIds: o,
    sortModifiers: d,
    postfixLookupClassGroupIds: m
  } = l, f = [], p = n.trim().split(Fg);
  let v = "";
  for (let k = p.length - 1; k >= 0; k -= 1) {
    const E = p[k], {
      isExternal: x,
      modifiers: z,
      hasImportantModifier: S,
      baseClassName: w,
      maybePostfixModifierPosition: _
    } = s(E);
    if (x) {
      v = E + (v.length > 0 ? " " + v : v);
      continue;
    }
    let N = !!_, B;
    if (N) {
      const h = w.substring(0, _);
      B = i(h);
      const b = B && m[B] ? i(w) : void 0;
      b && b !== B && (B = b, N = !1);
    } else
      B = i(w);
    if (!B) {
      if (!N) {
        v = E + (v.length > 0 ? " " + v : v);
        continue;
      }
      if (B = i(w), !B) {
        v = E + (v.length > 0 ? " " + v : v);
        continue;
      }
      N = !1;
    }
    const j = z.length === 0 ? "" : z.length === 1 ? z[0] : d(z).join(":"), Z = S ? j + os : j, q = Z + B;
    if (f.indexOf(q) > -1)
      continue;
    f.push(q);
    const D = o(B, N);
    for (let h = 0; h < D.length; ++h) {
      const b = D[h];
      f.push(Z + b);
    }
    v = E + (v.length > 0 ? " " + v : v);
  }
  return v;
}, $g = (...n) => {
  let l = 0, s, i, o = "";
  for (; l < n.length; )
    (s = n[l++]) && (i = Lf(s)) && (o && (o += " "), o += i);
  return o;
}, Lf = (n) => {
  if (typeof n == "string")
    return n;
  let l, s = "";
  for (let i = 0; i < n.length; i++)
    n[i] && (l = Lf(n[i])) && (s && (s += " "), s += l);
  return s;
}, Pg = (n, ...l) => {
  let s, i, o, d;
  const m = (p) => {
    const v = l.reduce((k, E) => E(k), n());
    return s = Jg(v), i = s.cache.get, o = s.cache.set, d = f, f(p);
  }, f = (p) => {
    const v = i(p);
    if (v)
      return v;
    const k = Ig(p, s);
    return o(p, k), k;
  };
  return d = m, (...p) => d($g(...p));
}, tb = [], Lt = (n) => {
  const l = (s) => s[n] || tb;
  return l.isThemeGetter = !0, l.themeKey = n, l;
}, Zf = /^\[(?:(\w[\w-]*):)?(.+)\]$/i, Jf = /^\((?:(\w[\w-]*):)?(.+)\)$/i, eb = /^\d+(?:\.\d+)?\/\d+(?:\.\d+)?$/, nb = /^(\d+(\.\d+)?)?(xs|sm|md|lg|xl)$/, ab = /\d+(%|px|r?em|[sdl]?v([hwib]|min|max)|pt|pc|in|cm|mm|cap|ch|ex|r?lh|cq(w|h|i|b|min|max))|\b(calc|min|max|clamp)\(.+\)|^0$/, lb = /^(rgba?|hsla?|hwb|(ok)?(lab|lch)|color-mix|color|light-dark)\(.+\)$/, rb = /^(inset_)?-?((\d+)?\.?(\d+)[a-z]+|0)_-?((\d+)?\.?(\d+)[a-z]+|0)/, ib = /^(url|image|image-set|cross-fade|element|(repeating-)?(linear|radial|conic)-gradient)\(.+\)$/, On = (n) => eb.test(n), vt = (n) => !!n && !Number.isNaN(Number(n)), We = (n) => !!n && Number.isInteger(Number(n)), Zo = (n) => n.endsWith("%") && vt(n.slice(0, -1)), fn = (n) => nb.test(n), Wf = () => !0, ob = (n) => (
  // `colorFunctionRegex` check is necessary because color functions can have percentages in them which which would be incorrectly classified as lengths.
  // For example, `hsl(0 0% 0%)` would be classified as a length without this check.
  // I could also use lookbehind assertion in `lengthUnitRegex` but that isn't supported widely enough.
  ab.test(n) && !lb.test(n)
), Ss = () => !1, sb = (n) => rb.test(n), cb = (n) => ib.test(n), ub = (n) => !at(n) && !lt(n), db = (n) => n.startsWith("@container") && (n[10] === "/" && n[11] !== void 0 || n[11] === "s" && n[16] !== void 0 && n.startsWith("-size/", 10) || n[11] === "n" && n[18] !== void 0 && n.startsWith("-normal/", 10)), fb = (n) => Yn(n, $f, Ss), at = (n) => Zf.test(n), ia = (n) => Yn(n, Pf, ob), nf = (n) => Yn(n, xb, vt), mb = (n) => Yn(n, em, Wf), pb = (n) => Yn(n, tm, Ss), af = (n) => Yn(n, Ff, Ss), hb = (n) => Yn(n, If, cb), Ar = (n) => Yn(n, nm, sb), lt = (n) => Jf.test(n), yl = (n) => ua(n, Pf), gb = (n) => ua(n, tm), lf = (n) => ua(n, Ff), bb = (n) => ua(n, $f), vb = (n) => ua(n, If), jr = (n) => ua(n, nm, !0), yb = (n) => ua(n, em, !0), Yn = (n, l, s) => {
  const i = Zf.exec(n);
  return i ? i[1] ? l(i[1]) : s(i[2]) : !1;
}, ua = (n, l, s = !1) => {
  const i = Jf.exec(n);
  return i ? i[1] ? l(i[1]) : s : !1;
}, Ff = (n) => n === "position" || n === "percentage", If = (n) => n === "image" || n === "url", $f = (n) => n === "length" || n === "size" || n === "bg-size", Pf = (n) => n === "length", xb = (n) => n === "number", tm = (n) => n === "family-name", em = (n) => n === "number" || n === "weight", nm = (n) => n === "shadow", wb = () => {
  const n = Lt("color"), l = Lt("font"), s = Lt("text"), i = Lt("font-weight"), o = Lt("tracking"), d = Lt("leading"), m = Lt("breakpoint"), f = Lt("container"), p = Lt("spacing"), v = Lt("radius"), k = Lt("shadow"), E = Lt("inset-shadow"), x = Lt("text-shadow"), z = Lt("drop-shadow"), S = Lt("blur"), w = Lt("perspective"), _ = Lt("aspect"), N = Lt("ease"), B = Lt("animate"), j = () => ["auto", "avoid", "all", "avoid-page", "page", "left", "right", "column"], Z = () => [
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
  ], q = () => [...Z(), lt, at], D = () => ["auto", "hidden", "clip", "visible", "scroll"], h = () => ["auto", "contain", "none"], b = () => [lt, at, p], y = () => [On, "full", "auto", ...b()], A = () => [We, "none", "subgrid", lt, at], O = () => ["auto", {
    span: ["full", We, lt, at]
  }, We, lt, at], M = () => [We, "auto", lt, at], U = () => ["auto", "min", "max", "fr", lt, at], L = () => ["start", "end", "center", "between", "around", "evenly", "stretch", "baseline", "center-safe", "end-safe"], F = () => ["start", "end", "center", "stretch", "center-safe", "end-safe"], Q = () => ["auto", ...b()], J = () => [On, "auto", "full", "dvw", "dvh", "lvw", "lvh", "svw", "svh", "min", "max", "fit", ...b()], I = () => [f, On, "screen", "full", "dvw", "lvw", "svw", "min", "max", "fit", ...b()], K = () => [On, "screen", "full", "lh", "dvh", "lvh", "svh", "min", "max", "fit", ...b()], V = () => [n, lt, at], T = () => [...Z(), lf, af, {
    position: [lt, at]
  }], X = () => ["no-repeat", {
    repeat: ["", "x", "y", "space", "round"]
  }], et = () => ["auto", "cover", "contain", bb, fb, {
    size: [lt, at]
  }], it = () => [Zo, yl, ia], ot = () => [
    // Deprecated since Tailwind CSS v4.0.0
    "",
    "none",
    "full",
    v,
    lt,
    at
  ], ut = () => ["", vt, yl, ia], kt = () => ["solid", "dashed", "dotted", "double"], Zt = () => ["normal", "multiply", "screen", "overlay", "darken", "lighten", "color-dodge", "color-burn", "hard-light", "soft-light", "difference", "exclusion", "hue", "saturation", "color", "luminosity"], ht = () => [vt, Zo, lf, af], Gn = () => [
    // Deprecated since Tailwind CSS v4.0.0
    "",
    "none",
    S,
    lt,
    at
  ], Kn = () => ["none", vt, lt, at], Re = () => ["none", vt, lt, at], De = () => [vt, lt, at], pn = () => [On, "full", ...b()];
  return {
    cacheSize: 500,
    theme: {
      animate: ["spin", "ping", "pulse", "bounce"],
      aspect: ["video"],
      blur: [fn],
      breakpoint: [fn],
      color: [Wf],
      container: [fn],
      "drop-shadow": [fn],
      ease: ["in", "out", "in-out"],
      font: [ub],
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
        aspect: ["auto", "square", On, at, lt, _]
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
      "container-named": [db],
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
        inset: y()
      }],
      /**
       * Inset Inline
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       */
      "inset-x": [{
        "inset-x": y()
      }],
      /**
       * Inset Block
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       */
      "inset-y": [{
        "inset-y": y()
      }],
      /**
       * Inset Inline Start
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       * @todo class group will be renamed to `inset-s` in next major release
       */
      start: [{
        "inset-s": y(),
        /**
         * @deprecated since Tailwind CSS v4.2.0 in favor of `inset-s-*` utilities.
         * @see https://github.com/tailwindlabs/tailwindcss/pull/19613
         */
        start: y()
      }],
      /**
       * Inset Inline End
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       * @todo class group will be renamed to `inset-e` in next major release
       */
      end: [{
        "inset-e": y(),
        /**
         * @deprecated since Tailwind CSS v4.2.0 in favor of `inset-e-*` utilities.
         * @see https://github.com/tailwindlabs/tailwindcss/pull/19613
         */
        end: y()
      }],
      /**
       * Inset Block Start
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       */
      "inset-bs": [{
        "inset-bs": y()
      }],
      /**
       * Inset Block End
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       */
      "inset-be": [{
        "inset-be": y()
      }],
      /**
       * Top
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       */
      top: [{
        top: y()
      }],
      /**
       * Right
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       */
      right: [{
        right: y()
      }],
      /**
       * Bottom
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       */
      bottom: [{
        bottom: y()
      }],
      /**
       * Left
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       */
      left: [{
        left: y()
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
        z: [We, "auto", lt, at]
      }],
      // ------------------------
      // --- Flexbox and Grid ---
      // ------------------------
      /**
       * Flex Basis
       * @see https://tailwindcss.com/docs/flex-basis
       */
      basis: [{
        basis: [On, "full", "auto", f, ...b()]
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
        order: [We, "first", "last", "none", lt, at]
      }],
      /**
       * Grid Template Columns
       * @see https://tailwindcss.com/docs/grid-template-columns
       */
      "grid-cols": [{
        "grid-cols": A()
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
        "col-start": M()
      }],
      /**
       * Grid Column End
       * @see https://tailwindcss.com/docs/grid-column
       */
      "col-end": [{
        "col-end": M()
      }],
      /**
       * Grid Template Rows
       * @see https://tailwindcss.com/docs/grid-template-rows
       */
      "grid-rows": [{
        "grid-rows": A()
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
        "row-start": M()
      }],
      /**
       * Grid Row End
       * @see https://tailwindcss.com/docs/grid-row
       */
      "row-end": [{
        "row-end": M()
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
        "auto-cols": U()
      }],
      /**
       * Grid Auto Rows
       * @see https://tailwindcss.com/docs/grid-auto-rows
       */
      "auto-rows": [{
        "auto-rows": U()
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
        justify: [...L(), "normal"]
      }],
      /**
       * Justify Items
       * @see https://tailwindcss.com/docs/justify-items
       */
      "justify-items": [{
        "justify-items": [...F(), "normal"]
      }],
      /**
       * Justify Self
       * @see https://tailwindcss.com/docs/justify-self
       */
      "justify-self": [{
        "justify-self": ["auto", ...F()]
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
        items: [...F(), {
          baseline: ["", "last"]
        }]
      }],
      /**
       * Align Self
       * @see https://tailwindcss.com/docs/align-self
       */
      "align-self": [{
        self: ["auto", ...F(), {
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
        "place-items": [...F(), "baseline"]
      }],
      /**
       * Place Self
       * @see https://tailwindcss.com/docs/place-self
       */
      "place-self": [{
        "place-self": ["auto", ...F()]
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
        size: J()
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
        text: ["base", s, yl, ia]
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
        font: [i, yb, mb]
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
        font: [gb, pb, l]
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
        "line-clamp": [vt, "none", lt, nf]
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
        decoration: [vt, "from-font", "auto", lt, ia]
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
        tab: [We, lt, at]
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
          }, We, lt, at],
          radial: ["", lt, at],
          conic: ["", We, lt, at]
        }, vb, hb]
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
        shadow: V()
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
        "text-shadow": ["none", x, jr, Ar]
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
        "mask-radial-at": Z()
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
          z,
          jr,
          Ar
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
        ease: ["linear", "initial", N, lt, at]
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
        animate: ["none", B, lt, at]
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
        perspective: [w, lt, at]
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
        zoom: [We, lt, at]
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
        stroke: [vt, yl, ia, nf]
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
}, _b = /* @__PURE__ */ Pg(wb);
function It(...n) {
  return _b(Kf(n));
}
function Sb(n, l, s) {
  return n.filter((i, o) => o !== l && (i.start + i.end) / 2 < s).length;
}
function kb(n, l, s, i) {
  const o = n.map(() => 0), d = n[l];
  if (!d) return o;
  const m = n[l + 1], f = n[l - 1], p = d.end - d.start + (m ? m.start - d.end : f ? d.start - f.end : 0);
  return n.forEach((v, k) => {
    l < s && k > l && k <= s ? o[k] = -p : s < l && k >= s && k < l && (o[k] = p);
  }), o[l] = Math.min(Math.max(i, n[0].start - d.start), n[n.length - 1].end - d.end), o;
}
const rf = ["transform", "transition", "zIndex", "filter", "pointerEvents", "position"];
function Eb(n, l) {
  for (let s = n.parentElement; s; s = s.parentElement) {
    const i = getComputedStyle(s)[l === "x" ? "overflowX" : "overflowY"];
    if ((i === "auto" || i === "scroll") && (l === "x" ? s.scrollWidth > s.clientWidth : s.scrollHeight > s.clientHeight)) return s;
  }
  return null;
}
function zb(n, l, s, i) {
  const o = n[l] ? Eb(n[l], s) : null, d = () => o ? s === "x" ? o.scrollLeft : o.scrollTop : 0, m = (_) => (s === "x" ? _.clientX : _.clientY) + d(), f = m(i), p = d(), v = n.map((_) => {
    const N = _.getBoundingClientRect();
    return s === "x" ? { start: N.left + p, end: N.right + p } : { start: N.top + p, end: N.bottom + p };
  }), k = n.map((_) => rf.map((N) => _.style[N])), E = typeof matchMedia == "function" && matchMedia("(prefers-reduced-motion: reduce)").matches, x = s === "x" ? "translateX" : "translateY";
  let z = !1;
  const S = { to: l };
  n.forEach((_, N) => {
    if (_.style.pointerEvents = "none", N !== l) {
      E || (_.style.transition = "transform 160ms cubic-bezier(0.2, 0.8, 0.2, 1)");
      return;
    }
    getComputedStyle(_).position === "static" && (_.style.position = "relative"), _.style.zIndex = "30", _.style.filter = "drop-shadow(0 6px 10px rgba(0, 0, 0, 0.45))";
  });
  const w = (_, N) => {
    S.to = _, kb(v, l, _, N).forEach((B, j) => {
      n[j].style.transform = B ? `${x}(${B}px)` : "";
    });
  };
  return {
    from: l,
    get to() {
      return S.to;
    },
    slot: (_) => Sb(v, l, m(_)),
    apply: (_, N) => {
      z || w(_, m(N) - f);
    },
    rest: () => {
      z || w(l, 0);
    },
    end: () => {
      z || (z = !0, n.forEach((_, N) => rf.forEach((B, j) => {
        _.style[B] = k[N][j];
      })));
    }
  };
}
const Nb = 5;
let Jo = !1;
function Tb(n, l) {
  if (n.button !== 0 || Jo) return;
  const s = { clientX: n.clientX, clientY: n.clientY }, i = n.currentTarget, o = n.pointerId;
  let d = null, m, f = !1;
  const p = { cursor: document.body.style.cursor, userSelect: document.body.style.userSelect }, v = (S) => {
    if (f) return;
    f = !0, window.removeEventListener("pointermove", k), window.removeEventListener("pointerup", E), window.removeEventListener("pointercancel", x), window.removeEventListener("keydown", z, !0), window.removeEventListener("blur", x), i.removeEventListener("lostpointercapture", x);
    try {
      i.releasePointerCapture(o);
    } catch {
    }
    if (!d) return;
    Jo = !1, document.body.style.cursor = p.cursor, document.body.style.userSelect = p.userSelect, d.end();
    const w = (_) => _.stopPropagation();
    window.addEventListener("click", w, { capture: !0, once: !0 }), setTimeout(() => window.removeEventListener("click", w, !0), 0), m?.(), l.onEnd(S, d);
  }, k = (S) => {
    if (!d) {
      if (Math.hypot(S.clientX - s.clientX, S.clientY - s.clientY) < Nb) return;
      const w = l.items();
      d = zb(w, l.from(w), l.axis, s), Jo = !0, document.body.style.cursor = "grabbing", document.body.style.userSelect = "none";
      try {
        i.setPointerCapture(o);
      } catch {
      }
      i.addEventListener("lostpointercapture", x);
      const _ = l.onStart?.();
      m = typeof _ == "function" ? _ : void 0;
    }
    l.onMove(S, d);
  }, E = () => v(!0), x = () => v(!1), z = (S) => {
    S.key === "Escape" && (S.stopPropagation(), v(!1));
  };
  window.addEventListener("pointermove", k), window.addEventListener("pointerup", E), window.addEventListener("pointercancel", x), window.addEventListener("keydown", z, !0), window.addEventListener("blur", x);
}
const am = typeof navigator < "u" && /Mac/i.test(navigator.platform), Jr = {
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
for (let n = 1; n <= 12; n++) Jr[`f${n}`] = `F${n}`;
const Cb = Object.fromEntries(Object.entries(Jr).map(([n, l]) => [l, n])), Mb = {
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
function Ab(n) {
  const l = /^Key([A-Z])$/.exec(n) ?? /^Digit(\d)$/.exec(n);
  return l ? l[1].toLowerCase() : Cb[n];
}
const of = /* @__PURE__ */ new Map();
function lm(n, l = am) {
  const s = `${l}|${n}`, i = of.get(s);
  if (i) return i;
  const o = { cmd: !1, ctrl: !1, shift: !1, alt: !1, code: "" };
  for (const d of n.split("+"))
    if (d === "mod")
      l ? o.cmd = !0 : (o.ctrl = !0, o.shift = !0);
    else if (d === "cmd" || d === "ctrl" || d === "shift" || d === "alt") o[d] = !0;
    else if (/^[a-z]$/.test(d))
      o.code = `Key${d.toUpperCase()}`, o.letter = d;
    else if (/^[0-9]$/.test(d)) o.code = `Digit${d}`;
    else if (Jr[d]) o.code = Jr[d];
    else throw new Error(`unknown key "${d}" in "${n}"`);
  if (!o.code) throw new Error(`no key in "${n}"`);
  return of.set(s, o), o;
}
new Set(["cmd+q", "cmd+h", "cmd+alt+h", "cmd+m", "cmd+ctrl+f", "cmd+z", "cmd+shift+z", "cmd+x", "cmd+c", "cmd+v", "cmd+a"].map((n) => {
  const l = lm(n, !0);
  return [l.cmd && "cmd", l.ctrl && "ctrl", l.alt && "alt", l.shift && "shift", l.code].filter(Boolean).join("+");
}));
function jb(n, l = am) {
  const s = lm(n, l), i = Ob(Ab(s.code) ?? "");
  return l ? `${s.ctrl ? "⌃" : ""}${s.alt ? "⌥" : ""}${s.shift ? "⇧" : ""}${s.cmd ? "⌘" : ""}${i}` : [s.ctrl && "Ctrl", s.alt && "Alt", s.shift && "Shift", i].filter(Boolean).join("+");
}
const Ob = (n) => Mb[n] ?? n.toUpperCase(), sf = (n) => typeof n == "boolean" ? `${n}` : n === 0 ? "0" : n, cf = Kf, ti = (n, l) => (s) => {
  var i;
  if (l?.variants == null) return cf(n, s?.class, s?.className);
  const { variants: o, defaultVariants: d } = l, m = Object.keys(o).map((v) => {
    const k = s?.[v], E = d?.[v];
    if (k === null) return null;
    const x = sf(k) || sf(E);
    return o[v][x];
  }), f = s && Object.entries(s).reduce((v, k) => {
    let [E, x] = k;
    return x === void 0 || (v[E] = x), v;
  }, {}), p = l == null || (i = l.compoundVariants) === null || i === void 0 ? void 0 : i.reduce((v, k) => {
    let { class: E, className: x, ...z } = k;
    return Object.entries(z).every((S) => {
      let [w, _] = S;
      return Array.isArray(_) ? _.includes({
        ...d,
        ...f
      }[w]) : {
        ...d,
        ...f
      }[w] === _;
    }) ? [
      ...v,
      E,
      x
    ] : v;
  }, []);
  return cf(n, m, p, s?.class, s?.className);
}, Rb = ti(
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
), Db = ti(
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
function Bb({ className: n, ...l } = {}) {
  return It(Db(l), n);
}
const rm = "shrink-0 cursor-pointer rounded-ui bg-transparent px-[0.2rem] py-[0.1rem] text-[0.8rem] leading-none text-subtext-0 [font-family:inherit] [border:none] [transition:color_0.1s_ease,background_0.1s_ease] hover:bg-surface-1 hover:text-accent", im = "cursor-pointer rounded-ui bg-transparent text-subtext-0 [border:0] [font-family:inherit] [transition:color_0.1s_ease,background_0.1s_ease] hover:bg-surface-1 hover:text-fg focus-visible:bg-surface-1 focus-visible:text-fg disabled:cursor-not-allowed disabled:opacity-40", Hb = ti(`${im} shrink-0 focus-visible:[outline:2px_solid_var(--accent)] focus-visible:[outline-offset:-2px]`, {
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
function Ub({ className: n, ...l } = {}) {
  return It(Hb(l), n);
}
const ks = "overflow-hidden rounded-ui bg-surface-1 py-[0.3rem] shadow-[0_8px_24px_rgba(0,0,0,0.45)]", ss = ti(
  "pane-context-menu__item block w-full cursor-pointer bg-transparent px-[0.9rem] py-[0.45rem] text-left text-[0.82rem] [border:none] [font-family:inherit] [transition:background_0.1s_ease] hover:bg-surface-0 disabled:cursor-not-allowed disabled:bg-transparent disabled:opacity-40",
  { variants: { danger: { true: "text-red", false: "text-fg" } }, defaultVariants: { danger: !1 } }
), qb = "my-1 h-px bg-overlay-0";
function Yb({ size: n = 14, className: l }) {
  return /* @__PURE__ */ st.jsxs("svg", { className: l, width: n, height: n, viewBox: "0 0 16 16", fill: "currentColor", "aria-hidden": "true", children: [
    /* @__PURE__ */ st.jsx("circle", { cx: "3.5", cy: "8", r: "1.1" }),
    /* @__PURE__ */ st.jsx("circle", { cx: "8", cy: "8", r: "1.1" }),
    /* @__PURE__ */ st.jsx("circle", { cx: "12.5", cy: "8", r: "1.1" })
  ] });
}
function Gb({ size: n = 16, className: l }) {
  return /* @__PURE__ */ st.jsxs("svg", { className: l, width: n, height: n, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: "1.3", strokeLinejoin: "round", "aria-hidden": "true", children: [
    /* @__PURE__ */ st.jsx("path", { d: "M6.6 1.8h2.8l.4 1.6 1.1.6 1.5-.6 1.4 2.4-1.2 1.1v1.3l1.2 1.1-1.4 2.4-1.5-.6-1.1.6-.4 1.6H6.6l-.4-1.6-1.1-.6-1.5.6-1.4-2.4 1.2-1.1V7.3L2.2 6.2l1.4-2.4 1.5.6 1.1-.6z" }),
    /* @__PURE__ */ st.jsx("circle", { cx: "8", cy: "8", r: "2" })
  ] });
}
function Kb({ size: n = 14, className: l }) {
  return /* @__PURE__ */ st.jsx("svg", { className: l, width: n, height: n, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round", "aria-hidden": "true", children: /* @__PURE__ */ st.jsx("path", { d: "M3.5 3.5l9 9M12.5 3.5l-9 9" }) });
}
function om({ size: n = 14, className: l }) {
  return /* @__PURE__ */ st.jsx("svg", { className: l, width: n, height: n, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round", "aria-hidden": "true", children: /* @__PURE__ */ st.jsx("path", { d: "M8 2.5v11M2.5 8h11" }) });
}
const uf = {
  connected: "host-state--connected bg-accent",
  connecting: "host-state--connecting animate-host-pulse bg-yellow",
  error: "host-state--error bg-red",
  disabled: "host-state--disabled bg-subtext-0"
};
function Qb({ state: n, error: l }) {
  return /* @__PURE__ */ st.jsx(
    "span",
    {
      className: It("host-state inline-block h-2 w-2 shrink-0 rounded-[50%]", uf[n] ?? uf.disabled),
      title: n === "error" && l ? l : n
    }
  );
}
function Vb({ title: n, onClose: l, children: s, testId: i }) {
  return Pr(
    /* @__PURE__ */ st.jsx(
      "div",
      {
        className: "fixed inset-0 z-[2100] flex items-center justify-center bg-[rgba(0,0,0,0.55)]",
        onMouseDown: (o) => {
          o.target === o.currentTarget && l();
        },
        onKeyDown: (o) => {
          o.key === "Escape" && l();
        },
        children: /* @__PURE__ */ st.jsxs(
          "div",
          {
            className: "grid max-h-[85vh] w-[min(30rem,92vw)] gap-[0.6rem] overflow-y-auto rounded-ui bg-panel-bg p-4 shadow-[0_8px_32px_rgba(0,0,0,0.5)]",
            role: "dialog",
            "aria-modal": "true",
            "aria-label": n,
            "data-testid": i,
            children: [
              /* @__PURE__ */ st.jsx("h2", { className: "m-0 text-[0.9rem] font-semibold text-fg", children: n }),
              s
            ]
          }
        )
      }
    ),
    document.body
  );
}
const Or = 4, Rn = 8, Xb = "flex w-full cursor-pointer items-center justify-between gap-3 px-[0.9rem] py-[0.4rem] text-left text-[0.82rem] text-fg max-[700px]:min-h-11 aria-disabled:cursor-not-allowed aria-disabled:opacity-40", df = (n) => n.text ?? (typeof n.label == "string" ? n.label : n.value);
function Lb({ value: n, onChange: l, options: s, className: i, ariaLabel: o, testId: d, id: m, title: f, disabled: p, placeholder: v, freeText: k, onKeyDown: E }) {
  const x = ct.useId(), [z, S] = ct.useState(!1), [w, _] = ct.useState(-1), [N, B] = ct.useState(!1), j = ct.useRef(null), Z = ct.useRef(null), [q, D] = ct.useState({}), h = ct.useRef({ text: "", at: 0 }), b = k && N && n ? s.filter((K) => df(K).toLowerCase().includes(n.toLowerCase()) || K.value.toLowerCase().includes(n.toLowerCase())) : s, y = s.find((K) => K.value === n), A = (K) => `${x}-${K}`;
  function O(K) {
    p || (_(K), S(!0));
  }
  function M() {
    S(!1), B(!1), _(-1);
  }
  function U(K) {
    !K || K.disabled || (l(K.value), M());
  }
  function L(K, V) {
    for (let T = 1; T <= b.length; T++) {
      const X = (K + V * T + b.length * T) % b.length;
      if (!b[X].disabled) return X;
    }
    return K;
  }
  const F = () => b.findIndex((K) => !K.disabled), Q = () => b.length - 1 - [...b].reverse().findIndex((K) => !K.disabled);
  es(() => {
    if (!z || !j.current) {
      D((et) => et.left === void 0 ? et : {});
      return;
    }
    const K = j.current.getBoundingClientRect(), V = window.innerHeight - K.bottom - Or - Rn, T = K.top - Or - Rn, X = V < 160 && T > V;
    D({
      position: "fixed",
      left: Math.min(Math.max(Rn, K.left), Math.max(Rn, window.innerWidth - K.width - Rn)),
      // As wide as its longest label (a session title, a path), never wider than the window.
      width: "max-content",
      minWidth: K.width,
      maxWidth: window.innerWidth - 2 * Rn,
      maxHeight: Math.min(X ? T : V, 320),
      ...X ? { bottom: window.innerHeight - K.top + Or } : { top: K.bottom + Or },
      overflowY: "auto"
    });
  }, [z, b.length]), es(() => {
    const K = Z.current;
    if (!z || !K || q.left === void 0) return;
    const V = K.getBoundingClientRect().right, T = window.innerWidth - Rn;
    V > T && D((X) => ({ ...X, left: Math.max(Rn, Number(X.left) - (V - T)) }));
  }, [z, q]), Ke(() => {
    if (!z) return;
    const K = (V) => {
      const T = V.target;
      (T === document || T instanceof Node && j.current && T.contains(j.current)) && M();
    };
    return window.addEventListener("resize", M), window.addEventListener("scroll", K, !0), () => {
      window.removeEventListener("resize", M), window.removeEventListener("scroll", K, !0);
    };
  }, [z]), Ke(() => {
    const K = z && w >= 0 ? document.getElementById(A(w)) : null, V = Z.current;
    !K || !V || (K.offsetTop < V.scrollTop ? V.scrollTop = K.offsetTop : K.offsetTop + K.offsetHeight > V.scrollTop + V.clientHeight && (V.scrollTop = K.offsetTop + K.offsetHeight - V.clientHeight));
  }, [z, w]), um(z, (K) => {
    K || M();
  }, j, Z);
  function J(K) {
    if (K.nativeEvent.isComposing) return;
    const V = () => {
      K.preventDefault(), K.stopPropagation();
    }, { key: T } = K;
    if (z) {
      if (T === "Escape") {
        V(), M();
        return;
      } else if (T === "Tab")
        M();
      else if (T === "ArrowDown" || T === "ArrowUp") {
        V(), b.length && _(w < 0 ? T === "ArrowDown" ? F() : Q() : L(w, T === "ArrowDown" ? 1 : -1));
        return;
      } else if (T === "Home" && !k) {
        V(), _(F());
        return;
      } else if (T === "End" && !k) {
        V(), _(Q());
        return;
      } else if (T === "Enter" || T === " " && !k) {
        if (w >= 0 && b[w]) {
          V(), U(b[w]);
          return;
        }
        if (!k) {
          V(), M();
          return;
        }
      } else if (!k && T.length === 1 && !K.metaKey && !K.ctrlKey && !K.altKey) {
        const X = Date.now();
        h.current = { text: (X - h.current.at > 600 ? "" : h.current.text) + T.toLowerCase(), at: X };
        const et = Math.max(w, 0), it = [...b.slice(et + (h.current.text.length === 1 ? 1 : 0)), ...b.slice(0, et + 1)].find((ot) => !ot.disabled && df(ot).toLowerCase().startsWith(h.current.text));
        it && (V(), _(b.indexOf(it)));
        return;
      }
    } else if (T === "ArrowDown" || T === "ArrowUp" || !k && (T === "Enter" || T === " ")) {
      V(), O(Math.max(0, b.findIndex((X) => X.value === n)));
      return;
    }
    E?.(K);
  }
  const I = {
    ref: (K) => {
      j.current = K;
    },
    id: m,
    title: f,
    disabled: p,
    "aria-label": o,
    "aria-expanded": z,
    "aria-controls": z ? x : void 0,
    "aria-activedescendant": z && w >= 0 ? A(w) : void 0,
    "data-testid": d,
    onKeyDown: J
  };
  return /* @__PURE__ */ st.jsxs(st.Fragment, { children: [
    k ? /* @__PURE__ */ st.jsx(
      "input",
      {
        ...I,
        type: "text",
        role: "combobox",
        "aria-autocomplete": "list",
        autoComplete: "off",
        placeholder: v,
        className: i,
        value: n,
        onChange: (K) => {
          l(K.target.value), B(!0), z ? _(-1) : (_(-1), S(!0));
        },
        onBlur: () => M()
      }
    ) : /* @__PURE__ */ st.jsxs(
      "button",
      {
        ...I,
        type: "button",
        role: "combobox",
        "aria-haspopup": "listbox",
        "data-value": n,
        className: It("inline-flex items-center justify-between gap-2 text-left [font-family:inherit] cursor-pointer disabled:cursor-not-allowed disabled:opacity-50", i),
        onClick: () => z ? M() : O(Math.max(0, b.findIndex((K) => K.value === n))),
        children: [
          /* @__PURE__ */ st.jsx("span", { className: "min-w-0 flex-1 truncate", children: y ? y.label : v ?? "" }),
          /* @__PURE__ */ st.jsx(Ns, { open: !0, className: "shrink-0 text-subtext-0" })
        ]
      }
    ),
    z && b.length > 0 && Pr(
      /* @__PURE__ */ st.jsx(
        "div",
        {
          ref: Z,
          id: x,
          role: "listbox",
          "aria-label": o,
          className: It("z-[9999]", ks),
          style: q,
          onMouseDown: (K) => {
            K.preventDefault(), K.stopPropagation();
          },
          onClick: (K) => K.stopPropagation(),
          children: b.map((K, V) => /* @__PURE__ */ st.jsxs(
            "div",
            {
              id: A(V),
              role: "option",
              "aria-selected": K.value === n,
              "aria-disabled": K.disabled || void 0,
              "data-value": K.value,
              className: It(Xb, V === w && !K.disabled && "bg-surface-0"),
              onMouseEnter: () => {
                K.disabled || _(V);
              },
              onClick: () => U(K),
              children: [
                /* @__PURE__ */ st.jsx("span", { className: "min-w-0 truncate", children: K.label }),
                K.value === n && /* @__PURE__ */ st.jsx("span", { "aria-hidden": "true", className: "shrink-0 text-accent", children: "✓" })
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
const Zb = "box-border min-h-[44px] cursor-pointer rounded-ui bg-transparent px-[0.7rem] py-[0.45rem] text-subtext-0 no-underline [border:0] [font-family:inherit] [font-weight:inherit] [line-height:inherit] text-[0.85rem] hover:bg-surface-1 hover:text-fg focus-visible:[outline:2px_solid_var(--accent)] focus-visible:[outline-offset:2px] disabled:cursor-default disabled:opacity-[0.55]", Jb = "m-0 mt-[0.4rem] text-[0.78rem] text-subtext-0", Wb = "m-0 mb-2 text-[0.82rem] text-subtext-0", sm = "rounded-ui bg-surface-1 text-fg [font-family:inherit]", Es = `${sm} px-2 py-[0.3rem] text-[0.8rem] max-[700px]:min-h-11 focus:[outline:1px_solid_var(--accent)]`, Fb = `${Es} min-w-[5.5rem] shrink-0`, zs = `${sm} min-w-0 px-[0.55rem] py-[0.35rem] text-[0.82rem] max-[700px]:min-h-11 focus:[outline:1px_solid_var(--accent)]`, Ib = `${zs} flex-1 max-[700px]:flex-[1_1_100%]`, $b = `${zs} w-20 flex-[0_0_5rem] max-[700px]:w-24 max-[700px]:flex-[1_1_6rem]`, Pb = `${zs} flex-[1_1_100%]`, tv = "flex flex-wrap items-center gap-[0.4rem]", ev = "m-0 mb-2 flex list-none flex-col gap-[0.3rem] p-0", nv = "flex items-center gap-2 max-[700px]:flex-wrap rounded-ui bg-surface-1 px-2 py-[0.35rem] text-[0.82rem]", av = `settings-modal__host-row ${nv}`, lv = "min-w-0 overflow-hidden font-semibold text-ellipsis whitespace-nowrap text-fg", rv = "min-w-0 flex-1 max-[700px]:basis-full overflow-hidden text-[0.78rem] text-ellipsis whitespace-nowrap text-subtext-0", cm = "shrink-0 cursor-pointer rounded-ui px-[0.7rem] py-[0.35rem] max-[700px]:min-h-11 text-[0.82rem] font-semibold text-panel-bg [border:none] [font-family:inherit] [transition:opacity_0.12s_ease] hover:opacity-[0.85]", iv = `${cm} bg-accent`, ov = `${cm} ml-auto bg-red`;
function Ns({ open: n, size: l = 12, className: s }) {
  return /* @__PURE__ */ st.jsx("svg", { className: s, width: l, height: l, viewBox: "0 0 12 12", fill: "none", stroke: "currentColor", strokeWidth: "1.3", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true", children: /* @__PURE__ */ st.jsx("path", { d: n ? "M2.5 4.5 6 8l3.5-3.5" : "M4.5 2.5 8 6l-3.5 3.5" }) });
}
function sv({ label: n, items: l, testId: s, side: i = "right", up: o = !1, maxHeight: d = 320 }) {
  const [m, f] = ct.useState(!1), [p, v] = ct.useState(!1), k = ct.useRef(null), E = ct.useRef(null), x = () => [...E.current?.querySelectorAll('[role="menuitem"]') ?? []];
  Ke(() => {
    m && p && (x()[0]?.focus(), v(!1));
  }, [m, p]);
  const z = () => {
    f(!0), v(!0);
  }, S = (_) => {
    (_.key === "ArrowRight" || _.key === "Enter" || _.key === " ") && (_.preventDefault(), z());
  }, w = (_) => {
    const N = x(), B = N.findIndex((j) => j === document.activeElement);
    _.key === "ArrowDown" || _.key === "ArrowUp" ? (_.preventDefault(), N[(B + (_.key === "ArrowDown" ? 1 : N.length - 1)) % N.length]?.focus()) : (_.key === "ArrowLeft" || _.key === "Escape") && (_.preventDefault(), _.stopPropagation(), f(!1), k.current?.focus());
  };
  return /* @__PURE__ */ st.jsxs("div", { className: "group/submenu relative", children: [
    /* @__PURE__ */ st.jsxs(
      "button",
      {
        ref: k,
        type: "button",
        role: "menuitem",
        "aria-haspopup": "menu",
        "aria-expanded": m,
        className: It(ss(), "flex items-center justify-between gap-2"),
        "data-testid": s,
        onClick: () => m ? f(!1) : z(),
        onKeyDown: S,
        children: [
          /* @__PURE__ */ st.jsx("span", { className: "truncate", children: n }),
          /* @__PURE__ */ st.jsx(Ns, { open: !1, size: 10 })
        ]
      }
    ),
    /* @__PURE__ */ st.jsx(
      "div",
      {
        ref: E,
        role: "menu",
        "aria-label": n,
        className: It(
          ks,
          "absolute z-10 w-60 overflow-y-auto",
          i === "right" ? "left-full" : "right-full",
          o ? "bottom-0" : "top-0",
          m ? "block" : "hidden group-hover/submenu:block"
        ),
        style: { maxHeight: d },
        onKeyDown: w,
        children: l.map((_) => /* @__PURE__ */ st.jsx("button", { type: "button", role: "menuitem", className: ss(), "data-testid": _.testId, onClick: _.onSelect, children: /* @__PURE__ */ st.jsx("span", { className: "block truncate", children: _.label }) }, _.key))
      }
    )
  ] });
}
function cv(n) {
  return n.blocked && !n.stale ? "blocked" : n.status === "running" && !n.stale ? "working" : n.unseen ? "done" : "idle";
}
const cs = {
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
function us(n, l) {
  return !!n.parentSessionId && n.parentSessionId !== n.id && l.some((s) => s.id === n.parentSessionId);
}
function uv(n) {
  const l = /* @__PURE__ */ new Map();
  for (const s of n)
    us(s, n) && l.set(s.parentSessionId, [...l.get(s.parentSessionId) ?? [], s]);
  return l.size ? n.filter((s) => !us(s, n)).flatMap((s) => [s, ...l.get(s.id) ?? []]) : n;
}
const Rr = 6, ff = 8;
function dv(n, l = {}) {
  const { minWidth: s = 220, align: i = "right", minSpaceAbove: o = 100 } = l, d = n.getBoundingClientRect(), m = window.innerWidth, f = window.innerHeight, p = i === "right" ? { right: Math.max(0, m - d.right) } : { left: Math.max(0, d.left) }, v = d.top - Rr - ff, k = f - d.bottom - Rr - ff;
  return v >= o ? {
    position: "fixed",
    bottom: f - d.top + Rr,
    ...p,
    minWidth: s,
    maxHeight: Math.min(v, f * 0.75),
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
function um(n, l, s, i) {
  Ke(() => {
    if (!n) return;
    function o(m) {
      const f = m.target, p = s.current?.contains(f) ?? !1, v = i.current?.contains(f) ?? !1;
      !p && !v && l(!1);
    }
    function d(m) {
      m.key === "Escape" && l(!1);
    }
    return document.addEventListener("mousedown", o), document.addEventListener("keydown", d), () => {
      document.removeEventListener("mousedown", o), document.removeEventListener("keydown", d);
    };
  }, [n]);
}
function fv({ icon: n, fallback: l }) {
  const [s, i] = ct.useState(!1);
  return Ke(() => i(!1), [n]), !n || s ? /* @__PURE__ */ st.jsx(st.Fragment, { children: l }) : /* @__PURE__ */ st.jsx("img", { src: n, alt: "", width: 14, height: 14, className: "size-[14px] rounded-[2px] object-contain", referrerPolicy: "no-referrer", onError: () => i(!0) });
}
const mv = "mode-switch group ml-auto flex items-center gap-[0.4rem] bg-transparent p-[0.2rem] [border:none] [font-family:inherit]", dm = "text-[0.72rem] font-semibold tracking-[0.03em] text-overlay-1 uppercase [transition:color_0.15s_ease]", pv = `${dm} group-aria-[checked=false]:text-accent`, hv = `${dm} group-aria-checked:text-accent`, gv = "relative h-[1.3rem] w-[2.4rem] shrink-0 rounded-[999px] border border-overlay-0 bg-surface-1 [transition:background_0.15s_ease] group-aria-checked:border-accent group-aria-checked:bg-panel-bg", bv = "absolute top-px left-px h-[1.1rem] w-[1.1rem] rounded-[50%] bg-fg [box-shadow:0_1px_2px_rgba(0,0,0,0.3)] [transition:transform_0.15s_ease,background_0.15s_ease] group-aria-checked:bg-accent group-aria-checked:[transform:translateX(1.1rem)]";
function vv({
  mode: n,
  onChange: l,
  testId: s = "mode-switch",
  disabled: i = !1
}) {
  const o = n === "cli";
  return /* @__PURE__ */ st.jsxs(
    "button",
    {
      type: "button",
      className: mv,
      "data-testid": s,
      role: "switch",
      "aria-checked": o,
      "aria-label": "Toggle UI / CLI mode",
      disabled: i,
      onClick: () => l(o ? "ui" : "cli"),
      children: [
        /* @__PURE__ */ st.jsx("span", { className: It("mode-switch__label mode-switch__label--ui", pv), children: "UI" }),
        /* @__PURE__ */ st.jsx("span", { className: It("mode-switch__track", gv), children: /* @__PURE__ */ st.jsx("span", { className: It("mode-switch__thumb", bv) }) }),
        /* @__PURE__ */ st.jsx("span", { className: It("mode-switch__label mode-switch__label--cli", hv), children: "CLI" })
      ]
    }
  );
}
const Ya = function(n, l) {
  let o = n;
  const d = wl[l];
  let m = null, f = 0, p = null;
  const v = [], k = {}, E = function(h, b) {
    f = o * 4 + 17, m = (function(y) {
      const A = new Array(y);
      for (let O = 0; O < y; O += 1) {
        A[O] = new Array(y);
        for (let M = 0; M < y; M += 1)
          A[O][M] = null;
      }
      return A;
    })(f), x(0, 0), x(f - 7, 0), x(0, f - 7), w(), S(), N(h, b), o >= 7 && _(h), p == null && (p = Z(o, d, v)), B(p, b);
  }, x = function(h, b) {
    for (let y = -1; y <= 7; y += 1)
      if (!(h + y <= -1 || f <= h + y))
        for (let A = -1; A <= 7; A += 1)
          b + A <= -1 || f <= b + A || (0 <= y && y <= 6 && (A == 0 || A == 6) || 0 <= A && A <= 6 && (y == 0 || y == 6) || 2 <= y && y <= 4 && 2 <= A && A <= 4 ? m[h + y][b + A] = !0 : m[h + y][b + A] = !1);
  }, z = function() {
    let h = 0, b = 0;
    for (let y = 0; y < 8; y += 1) {
      E(!0, y);
      const A = Bn.getLostPoint(k);
      (y == 0 || h > A) && (h = A, b = y);
    }
    return b;
  }, S = function() {
    for (let h = 8; h < f - 8; h += 1)
      m[h][6] == null && (m[h][6] = h % 2 == 0);
    for (let h = 8; h < f - 8; h += 1)
      m[6][h] == null && (m[6][h] = h % 2 == 0);
  }, w = function() {
    const h = Bn.getPatternPosition(o);
    for (let b = 0; b < h.length; b += 1)
      for (let y = 0; y < h.length; y += 1) {
        const A = h[b], O = h[y];
        if (m[A][O] == null)
          for (let M = -2; M <= 2; M += 1)
            for (let U = -2; U <= 2; U += 1)
              M == -2 || M == 2 || U == -2 || U == 2 || M == 0 && U == 0 ? m[A + M][O + U] = !0 : m[A + M][O + U] = !1;
      }
  }, _ = function(h) {
    const b = Bn.getBCHTypeNumber(o);
    for (let y = 0; y < 18; y += 1) {
      const A = !h && (b >> y & 1) == 1;
      m[Math.floor(y / 3)][y % 3 + f - 8 - 3] = A;
    }
    for (let y = 0; y < 18; y += 1) {
      const A = !h && (b >> y & 1) == 1;
      m[y % 3 + f - 8 - 3][Math.floor(y / 3)] = A;
    }
  }, N = function(h, b) {
    const y = d << 3 | b, A = Bn.getBCHTypeInfo(y);
    for (let O = 0; O < 15; O += 1) {
      const M = !h && (A >> O & 1) == 1;
      O < 6 ? m[O][8] = M : O < 8 ? m[O + 1][8] = M : m[f - 15 + O][8] = M;
    }
    for (let O = 0; O < 15; O += 1) {
      const M = !h && (A >> O & 1) == 1;
      O < 8 ? m[8][f - O - 1] = M : O < 9 ? m[8][15 - O - 1 + 1] = M : m[8][15 - O - 1] = M;
    }
    m[f - 8][8] = !h;
  }, B = function(h, b) {
    let y = -1, A = f - 1, O = 7, M = 0;
    const U = Bn.getMaskFunction(b);
    for (let L = f - 1; L > 0; L -= 2)
      for (L == 6 && (L -= 1); ; ) {
        for (let F = 0; F < 2; F += 1)
          if (m[A][L - F] == null) {
            let Q = !1;
            M < h.length && (Q = (h[M] >>> O & 1) == 1), U(A, L - F) && (Q = !Q), m[A][L - F] = Q, O -= 1, O == -1 && (M += 1, O = 7);
          }
        if (A += y, A < 0 || f <= A) {
          A -= y, y = -y;
          break;
        }
      }
  }, j = function(h, b) {
    let y = 0, A = 0, O = 0;
    const M = new Array(b.length), U = new Array(b.length);
    for (let J = 0; J < b.length; J += 1) {
      const I = b[J].dataCount, K = b[J].totalCount - I;
      A = Math.max(A, I), O = Math.max(O, K), M[J] = new Array(I);
      for (let et = 0; et < M[J].length; et += 1)
        M[J][et] = 255 & h.getBuffer()[et + y];
      y += I;
      const V = Bn.getErrorCorrectPolynomial(K), X = zl(M[J], V.getLength() - 1).mod(V);
      U[J] = new Array(V.getLength() - 1);
      for (let et = 0; et < U[J].length; et += 1) {
        const it = et + X.getLength() - U[J].length;
        U[J][et] = it >= 0 ? X.getAt(it) : 0;
      }
    }
    let L = 0;
    for (let J = 0; J < b.length; J += 1)
      L += b[J].totalCount;
    const F = new Array(L);
    let Q = 0;
    for (let J = 0; J < A; J += 1)
      for (let I = 0; I < b.length; I += 1)
        J < M[I].length && (F[Q] = M[I][J], Q += 1);
    for (let J = 0; J < O; J += 1)
      for (let I = 0; I < b.length; I += 1)
        J < U[I].length && (F[Q] = U[I][J], Q += 1);
    return F;
  }, Z = function(h, b, y) {
    const A = mf.getRSBlocks(h, b), O = pf();
    for (let U = 0; U < y.length; U += 1) {
      const L = y[U];
      O.put(L.getMode(), 4), O.put(L.getLength(), Bn.getLengthInBits(L.getMode(), h)), L.write(O);
    }
    let M = 0;
    for (let U = 0; U < A.length; U += 1)
      M += A[U].dataCount;
    if (O.getLengthInBits() > M * 8)
      throw "code length overflow. (" + O.getLengthInBits() + ">" + M * 8 + ")";
    for (O.getLengthInBits() + 4 <= M * 8 && O.put(0, 4); O.getLengthInBits() % 8 != 0; )
      O.putBit(!1);
    for (; !(O.getLengthInBits() >= M * 8 || (O.put(236, 8), O.getLengthInBits() >= M * 8)); )
      O.put(17, 8);
    return j(O, A);
  };
  k.addData = function(h, b) {
    b = b || "Byte";
    let y = null;
    switch (b) {
      case "Numeric":
        y = yv(h);
        break;
      case "Alphanumeric":
        y = xv(h);
        break;
      case "Byte":
        y = wv(h);
        break;
      case "Kanji":
        y = _v(h);
        break;
      default:
        throw "mode:" + b;
    }
    v.push(y), p = null;
  }, k.isDark = function(h, b) {
    if (h < 0 || f <= h || b < 0 || f <= b)
      throw h + "," + b;
    return m[h][b];
  }, k.getModuleCount = function() {
    return f;
  }, k.make = function() {
    if (o < 1) {
      let h = 1;
      for (; h < 40; h++) {
        const b = mf.getRSBlocks(h, d), y = pf();
        for (let O = 0; O < v.length; O++) {
          const M = v[O];
          y.put(M.getMode(), 4), y.put(M.getLength(), Bn.getLengthInBits(M.getMode(), h)), M.write(y);
        }
        let A = 0;
        for (let O = 0; O < b.length; O++)
          A += b[O].dataCount;
        if (y.getLengthInBits() <= A * 8)
          break;
      }
      o = h;
    }
    E(!1, z());
  }, k.createTableTag = function(h, b) {
    h = h || 2, b = typeof b > "u" ? h * 4 : b;
    let y = "";
    y += '<table style="', y += " border-width: 0px; border-style: none;", y += " border-collapse: collapse;", y += " padding: 0px; margin: " + b + "px;", y += '">', y += "<tbody>";
    for (let A = 0; A < k.getModuleCount(); A += 1) {
      y += "<tr>";
      for (let O = 0; O < k.getModuleCount(); O += 1)
        y += '<td style="', y += " border-width: 0px; border-style: none;", y += " border-collapse: collapse;", y += " padding: 0px; margin: 0px;", y += " width: " + h + "px;", y += " height: " + h + "px;", y += " background-color: ", y += k.isDark(A, O) ? "#000000" : "#ffffff", y += ";", y += '"/>';
      y += "</tr>";
    }
    return y += "</tbody>", y += "</table>", y;
  }, k.createSvgTag = function(h, b, y, A) {
    let O = {};
    typeof arguments[0] == "object" && (O = arguments[0], h = O.cellSize, b = O.margin, y = O.alt, A = O.title), h = h || 2, b = typeof b > "u" ? h * 4 : b, y = typeof y == "string" ? { text: y } : y || {}, y.text = y.text || null, y.id = y.text ? y.id || "qrcode-description" : null, A = typeof A == "string" ? { text: A } : A || {}, A.text = A.text || null, A.id = A.text ? A.id || "qrcode-title" : null;
    const M = k.getModuleCount() * h + b * 2;
    let U, L, F, Q, J = "", I;
    for (I = "l" + h + ",0 0," + h + " -" + h + ",0 0,-" + h + "z ", J += '<svg version="1.1" xmlns="http://www.w3.org/2000/svg"', J += O.scalable ? "" : ' width="' + M + 'px" height="' + M + 'px"', J += ' viewBox="0 0 ' + M + " " + M + '" ', J += ' preserveAspectRatio="xMinYMin meet"', J += A.text || y.text ? ' role="img" aria-labelledby="' + q([A.id, y.id].join(" ").trim()) + '"' : "", J += ">", J += A.text ? '<title id="' + q(A.id) + '">' + q(A.text) + "</title>" : "", J += y.text ? '<description id="' + q(y.id) + '">' + q(y.text) + "</description>" : "", J += '<rect width="100%" height="100%" fill="white" cx="0" cy="0"/>', J += '<path d="', F = 0; F < k.getModuleCount(); F += 1)
      for (Q = F * h + b, U = 0; U < k.getModuleCount(); U += 1)
        k.isDark(F, U) && (L = U * h + b, J += "M" + L + "," + Q + I);
    return J += '" stroke="transparent" fill="black"/>', J += "</svg>", J;
  }, k.createDataURL = function(h, b) {
    h = h || 2, b = typeof b > "u" ? h * 4 : b;
    const y = k.getModuleCount() * h + b * 2, A = b, O = y - b;
    return zv(y, y, function(M, U) {
      if (A <= M && M < O && A <= U && U < O) {
        const L = Math.floor((M - A) / h), F = Math.floor((U - A) / h);
        return k.isDark(F, L) ? 0 : 1;
      } else
        return 1;
    });
  }, k.createImgTag = function(h, b, y) {
    h = h || 2, b = typeof b > "u" ? h * 4 : b;
    const A = k.getModuleCount() * h + b * 2;
    let O = "";
    return O += "<img", O += ' src="', O += k.createDataURL(h, b), O += '"', O += ' width="', O += A, O += '"', O += ' height="', O += A, O += '"', y && (O += ' alt="', O += q(y), O += '"'), O += "/>", O;
  };
  const q = function(h) {
    let b = "";
    for (let y = 0; y < h.length; y += 1) {
      const A = h.charAt(y);
      switch (A) {
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
          b += A;
          break;
      }
    }
    return b;
  }, D = function(h) {
    h = typeof h > "u" ? 2 : h;
    const y = k.getModuleCount() * 1 + h * 2, A = h, O = y - h;
    let M, U, L, F, Q;
    const J = {
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
    let K = "";
    for (M = 0; M < y; M += 2) {
      for (L = Math.floor((M - A) / 1), F = Math.floor((M + 1 - A) / 1), U = 0; U < y; U += 1)
        Q = "█", A <= U && U < O && A <= M && M < O && k.isDark(L, Math.floor((U - A) / 1)) && (Q = " "), A <= U && U < O && A <= M + 1 && M + 1 < O && k.isDark(F, Math.floor((U - A) / 1)) ? Q += " " : Q += "█", K += h < 1 && M + 1 >= O ? I[Q] : J[Q];
      K += `
`;
    }
    return y % 2 && h > 0 ? K.substring(0, K.length - y - 1) + Array(y + 1).join("▀") : K.substring(0, K.length - 1);
  };
  return k.createASCII = function(h, b) {
    if (h = h || 1, h < 2)
      return D(b);
    h -= 1, b = typeof b > "u" ? h * 2 : b;
    const y = k.getModuleCount() * h + b * 2, A = b, O = y - b;
    let M, U, L, F;
    const Q = Array(h + 1).join("██"), J = Array(h + 1).join("  ");
    let I = "", K = "";
    for (M = 0; M < y; M += 1) {
      for (L = Math.floor((M - A) / h), K = "", U = 0; U < y; U += 1)
        F = 1, A <= U && U < O && A <= M && M < O && k.isDark(L, Math.floor((U - A) / h)) && (F = 0), K += F ? Q : J;
      for (L = 0; L < h; L += 1)
        I += K + `
`;
    }
    return I.substring(0, I.length - 1);
  }, k.renderTo2dContext = function(h, b) {
    b = b || 2;
    const y = k.getModuleCount();
    for (let A = 0; A < y; A++)
      for (let O = 0; O < y; O++)
        h.fillStyle = k.isDark(A, O) ? "black" : "white", h.fillRect(O * b, A * b, b, b);
  }, k;
};
Ya.stringToBytes = function(n) {
  const l = [];
  for (let s = 0; s < n.length; s += 1) {
    const i = n.charCodeAt(s);
    l.push(i & 255);
  }
  return l;
};
Ya.createStringToBytes = function(n, l) {
  const s = (function() {
    const o = kv(n), d = function() {
      const p = o.read();
      if (p == -1) throw "eof";
      return p;
    };
    let m = 0;
    const f = {};
    for (; ; ) {
      const p = o.read();
      if (p == -1) break;
      const v = d(), k = d(), E = d(), x = String.fromCharCode(p << 8 | v), z = k << 8 | E;
      f[x] = z, m += 1;
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
const ue = {
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
    return n[m - 1];
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
        case ue.MODE_NUMBER:
          return 10;
        case ue.MODE_ALPHA_NUM:
          return 9;
        case ue.MODE_8BIT_BYTE:
          return 8;
        case ue.MODE_KANJI:
          return 8;
        default:
          throw "mode:" + m;
      }
    else if (f < 27)
      switch (m) {
        case ue.MODE_NUMBER:
          return 12;
        case ue.MODE_ALPHA_NUM:
          return 11;
        case ue.MODE_8BIT_BYTE:
          return 16;
        case ue.MODE_KANJI:
          return 10;
        default:
          throw "mode:" + m;
      }
    else if (f < 41)
      switch (m) {
        case ue.MODE_NUMBER:
          return 14;
        case ue.MODE_ALPHA_NUM:
          return 13;
        case ue.MODE_8BIT_BYTE:
          return 16;
        case ue.MODE_KANJI:
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
      for (let x = 0; x < f; x += 1) {
        let z = 0;
        const S = m.isDark(E, x);
        for (let w = -1; w <= 1; w += 1)
          if (!(E + w < 0 || f <= E + w))
            for (let _ = -1; _ <= 1; _ += 1)
              x + _ < 0 || f <= x + _ || w == 0 && _ == 0 || S == m.isDark(E + w, x + _) && (z += 1);
        z > 5 && (p += 3 + z - 5);
      }
    for (let E = 0; E < f - 1; E += 1)
      for (let x = 0; x < f - 1; x += 1) {
        let z = 0;
        m.isDark(E, x) && (z += 1), m.isDark(E + 1, x) && (z += 1), m.isDark(E, x + 1) && (z += 1), m.isDark(E + 1, x + 1) && (z += 1), (z == 0 || z == 4) && (p += 3);
      }
    for (let E = 0; E < f; E += 1)
      for (let x = 0; x < f - 6; x += 1)
        m.isDark(E, x) && !m.isDark(E, x + 1) && m.isDark(E, x + 2) && m.isDark(E, x + 3) && m.isDark(E, x + 4) && !m.isDark(E, x + 5) && m.isDark(E, x + 6) && (p += 40);
    for (let E = 0; E < f; E += 1)
      for (let x = 0; x < f - 6; x += 1)
        m.isDark(x, E) && !m.isDark(x + 1, E) && m.isDark(x + 2, E) && m.isDark(x + 3, E) && m.isDark(x + 4, E) && !m.isDark(x + 5, E) && m.isDark(x + 6, E) && (p += 40);
    let v = 0;
    for (let E = 0; E < f; E += 1)
      for (let x = 0; x < f; x += 1)
        m.isDark(x, E) && (v += 1);
    const k = Math.abs(100 * v / f / f - 50) / 5;
    return p += k * 10, p;
  }, o;
})(), Hn = (function() {
  const n = new Array(256), l = new Array(256);
  for (let i = 0; i < 8; i += 1)
    n[i] = 1 << i;
  for (let i = 8; i < 256; i += 1)
    n[i] = n[i - 4] ^ n[i - 5] ^ n[i - 6] ^ n[i - 8];
  for (let i = 0; i < 255; i += 1)
    l[n[i]] = i;
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
    return n[i];
  }, s;
})(), zl = function(n, l) {
  if (typeof n.length > "u")
    throw n.length + "/" + l;
  const s = (function() {
    let o = 0;
    for (; o < n.length && n[o] == 0; )
      o += 1;
    const d = new Array(n.length - o + l);
    for (let m = 0; m < n.length - o; m += 1)
      d[m] = n[m + o];
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
}, mf = (function() {
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
  ], l = function(o, d) {
    const m = {};
    return m.totalCount = o, m.dataCount = d, m;
  }, s = {}, i = function(o, d) {
    switch (d) {
      case wl.L:
        return n[(o - 1) * 4 + 0];
      case wl.M:
        return n[(o - 1) * 4 + 1];
      case wl.Q:
        return n[(o - 1) * 4 + 2];
      case wl.H:
        return n[(o - 1) * 4 + 3];
      default:
        return;
    }
  };
  return s.getRSBlocks = function(o, d) {
    const m = i(o, d);
    if (typeof m > "u")
      throw "bad rs block @ typeNumber:" + o + "/errorCorrectionLevel:" + d;
    const f = m.length / 3, p = [];
    for (let v = 0; v < f; v += 1) {
      const k = m[v * 3 + 0], E = m[v * 3 + 1], x = m[v * 3 + 2];
      for (let z = 0; z < k; z += 1)
        p.push(l(E, x));
    }
    return p;
  }, s;
})(), pf = function() {
  const n = [];
  let l = 0;
  const s = {};
  return s.getBuffer = function() {
    return n;
  }, s.getAt = function(i) {
    const o = Math.floor(i / 8);
    return (n[o] >>> 7 - i % 8 & 1) == 1;
  }, s.put = function(i, o) {
    for (let d = 0; d < o; d += 1)
      s.putBit((i >>> o - d - 1 & 1) == 1);
  }, s.getLengthInBits = function() {
    return l;
  }, s.putBit = function(i) {
    const o = Math.floor(l / 8);
    n.length <= o && n.push(0), i && (n[o] |= 128 >>> l % 8), l += 1;
  }, s;
}, yv = function(n) {
  const l = ue.MODE_NUMBER, s = n, i = {};
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
}, xv = function(n) {
  const l = ue.MODE_ALPHA_NUM, s = n, i = {};
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
}, wv = function(n) {
  const l = ue.MODE_8BIT_BYTE, s = Ya.stringToBytes(n), i = {};
  return i.getMode = function() {
    return l;
  }, i.getLength = function(o) {
    return s.length;
  }, i.write = function(o) {
    for (let d = 0; d < s.length; d += 1)
      o.put(s[d], 8);
  }, i;
}, _v = function(n) {
  const l = ue.MODE_KANJI, s = Ya.stringToBytes;
  (function(d, m) {
    const f = s(d);
    if (f.length != 2 || (f[0] << 8 | f[1]) != m)
      throw "sjis not supported.";
  })("友", 38726);
  const i = s(n), o = {};
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
}, fm = function() {
  const n = [], l = {};
  return l.writeByte = function(s) {
    n.push(s & 255);
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
    return n;
  }, l.toString = function() {
    let s = "";
    s += "[";
    for (let i = 0; i < n.length; i += 1)
      i > 0 && (s += ","), s += n[i];
    return s += "]", s;
  }, l;
}, Sv = function() {
  let n = 0, l = 0, s = 0, i = "";
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
    for (n = n << 8 | f & 255, l += 8, s += 1; l >= 6; )
      d(n >>> l - 6), l -= 6;
  }, o.flush = function() {
    if (l > 0 && (d(n << 6 - l), n = 0, l = 0), s % 3 != 0) {
      const f = 3 - s % 3;
      for (let p = 0; p < f; p += 1)
        i += "=";
    }
  }, o.toString = function() {
    return i;
  }, o;
}, kv = function(n) {
  const l = n;
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
}, Ev = function(n, l) {
  const s = n, i = l, o = new Array(n * l), d = {};
  d.setPixel = function(v, k, E) {
    o[k * s + v] = E;
  }, d.write = function(v) {
    v.writeString("GIF87a"), v.writeShort(s), v.writeShort(i), v.writeByte(128), v.writeByte(0), v.writeByte(0), v.writeByte(0), v.writeByte(0), v.writeByte(0), v.writeByte(255), v.writeByte(255), v.writeByte(255), v.writeString(","), v.writeShort(0), v.writeShort(0), v.writeShort(s), v.writeShort(i), v.writeByte(0);
    const k = 2, E = f(k);
    v.writeByte(k);
    let x = 0;
    for (; E.length - x > 255; )
      v.writeByte(255), v.writeBytes(E, x, 255), x += 255;
    v.writeByte(E.length - x), v.writeBytes(E, x, E.length - x), v.writeByte(0), v.writeString(";");
  };
  const m = function(v) {
    const k = v;
    let E = 0, x = 0;
    const z = {};
    return z.write = function(S, w) {
      if (S >>> w)
        throw "length over";
      for (; E + w >= 8; )
        k.writeByte(255 & (S << E | x)), w -= 8 - E, S >>>= 8 - E, x = 0, E = 0;
      x = S << E | x, E = E + w;
    }, z.flush = function() {
      E > 0 && k.writeByte(x);
    }, z;
  }, f = function(v) {
    const k = 1 << v, E = (1 << v) + 1;
    let x = v + 1;
    const z = p();
    for (let B = 0; B < k; B += 1)
      z.add(String.fromCharCode(B));
    z.add(String.fromCharCode(k)), z.add(String.fromCharCode(E));
    const S = fm(), w = m(S);
    w.write(k, x);
    let _ = 0, N = String.fromCharCode(o[_]);
    for (_ += 1; _ < o.length; ) {
      const B = String.fromCharCode(o[_]);
      _ += 1, z.contains(N + B) ? N = N + B : (w.write(z.indexOf(N), x), z.size() < 4095 && (z.size() == 1 << x && (x += 1), z.add(N + B)), N = B);
    }
    return w.write(z.indexOf(N), x), w.write(E, x), w.flush(), S.toByteArray();
  }, p = function() {
    const v = {};
    let k = 0;
    const E = {};
    return E.add = function(x) {
      if (E.contains(x))
        throw "dup key:" + x;
      v[x] = k, k += 1;
    }, E.size = function() {
      return k;
    }, E.indexOf = function(x) {
      return v[x];
    }, E.contains = function(x) {
      return typeof v[x] < "u";
    }, E;
  };
  return d;
}, zv = function(n, l, s) {
  const i = Ev(n, l);
  for (let f = 0; f < l; f += 1)
    for (let p = 0; p < n; p += 1)
      i.setPixel(p, f, s(p, f));
  const o = fm();
  i.write(o);
  const d = Sv(), m = o.toByteArray();
  for (let f = 0; f < m.length; f += 1)
    d.writeByte(m[f]);
  return d.flush(), "data:image/gif;base64," + d;
};
Ya.stringToBytes;
function Nv({ text: n }) {
  const { size: l, path: s } = ct.useMemo(() => {
    const i = Ya(0, "M");
    i.addData(n), i.make();
    const o = i.getModuleCount();
    let d = "";
    for (let m = 0; m < o; m++)
      for (let f = 0; f < o; f++) i.isDark(m, f) && (d += `M${f} ${m}h1v1h-1z`);
    return { size: o, path: d };
  }, [n]);
  return /* @__PURE__ */ st.jsxs(
    "svg",
    {
      viewBox: `-4 -4 ${l + 8} ${l + 8}`,
      shapeRendering: "crispEdges",
      role: "img",
      "aria-label": "Pairing QR code",
      "data-testid": "pair-qr",
      className: "h-44 w-44 shrink-0 rounded-ui",
      children: [
        /* @__PURE__ */ st.jsx("rect", { x: -4, y: -4, width: l + 8, height: l + 8, fill: "#fff" }),
        /* @__PURE__ */ st.jsx("path", { d: s, fill: "#000" })
      ]
    }
  );
}
const Nl = ct.createContext(""), ds = (n, l) => typeof n == "string" && n.toLowerCase().includes(l);
function Tv({ title: n, children: l, testId: s, ariaLabel: i }) {
  const o = ct.useContext(Nl), d = o !== "" && ds(n, o);
  return (
    // While searching, a group with no matching row (and no matching title) hides itself.
    /* @__PURE__ */ st.jsxs("section", { className: o && !d ? "mb-8 not-has-[[data-setting-row]]:hidden" : "mb-8", "data-testid": s, "aria-label": i, children: [
      n && /* @__PURE__ */ st.jsx("h3", { className: "m-0 mb-3 text-[0.9rem] font-medium text-fg", children: n }),
      /* @__PURE__ */ st.jsx("div", { className: "rounded-ui bg-surface-0 px-4", children: /* @__PURE__ */ st.jsx(Nl.Provider, { value: d ? "" : o, children: l }) })
    ] })
  );
}
function Cv({ title: n, description: l, children: s, testId: i }) {
  const o = ct.useContext(Nl);
  return o && !ds(n, o) && !ds(l, o) ? null : /* @__PURE__ */ st.jsxs("div", { "data-setting-row": !0, "data-testid": i, className: "flex items-center justify-between gap-6 py-[0.8rem] max-[700px]:flex-wrap max-[700px]:gap-y-2", children: [
    /* @__PURE__ */ st.jsxs("div", { className: "min-w-0 max-[700px]:flex-1 max-[700px]:basis-56", children: [
      /* @__PURE__ */ st.jsx("div", { className: "text-[0.85rem] text-fg", children: n }),
      l && /* @__PURE__ */ st.jsx("div", { className: "mt-[0.15rem] text-[0.75rem] text-subtext-0", children: l })
    ] }),
    s && /* @__PURE__ */ st.jsx("div", { className: "flex shrink-0 items-center gap-2", children: s })
  ] });
}
function Mv({ checked: n, onChange: l, testId: s, label: i }) {
  return /* @__PURE__ */ st.jsx(
    "input",
    {
      type: "checkbox",
      role: "switch",
      "aria-label": i,
      "data-testid": s,
      checked: n,
      onChange: (o) => l(o.target.checked),
      className: "relative h-[1.25rem] w-[2.25rem] shrink-0 cursor-pointer appearance-none rounded-full bg-overlay-0 [transition:background_0.12s_ease] before:absolute before:top-[0.15rem] before:left-[0.15rem] before:h-[0.95rem] before:w-[0.95rem] before:rounded-full before:bg-fg before:content-[''] before:[transition:transform_0.12s_ease] checked:bg-accent checked:before:translate-x-[1rem] checked:before:bg-panel-bg focus-visible:[outline:2px_solid_var(--accent)] focus-visible:[outline-offset:2px]"
    }
  );
}
//! The Settings pages' shared parts for `@perch/sdk` 1.8 (`sdk.ts` re-exports and lists them). Each wraps the host
//! component or class string the pages are drawn with and owns no state. `SettingsGroup` and `SettingRow` are the
//! host's own, so the Settings search (`SettingsQuery`) filters a copy's rows exactly as it filters Perch's.
const Av = () => ct.useContext(Nl), jv = {
  select: Es,
  selectHost: Fb,
  input: Ib,
  inputPort: $b,
  inputWide: Pb,
  addRow: tv,
  list: ev,
  hostRow: av,
  name: lv,
  addr: rv,
  muted: Jb,
  empty: Wb,
  primary: iv,
  danger: ov,
  catalogToggle: Zb
};
//! State the host keeps for a resource rather than for one view of it (`useResourceState`, `@perch/sdk` 1.4): a
//! review's unsent commit message and comment, its pending batch and its operation id, keyed by the screen's
//! own name for the resource (`review:<workspace>:commit`). Every view and copy that names the same key shares the
//! value, and it outlives a reload or swap of the screen's code, a released hidden copy and the phone/desktop
//! layouts trading places. In memory: a page reload starts empty (durable drafts live in their own services).
const Ov = 512, Fe = /* @__PURE__ */ new Map(), Sl = /* @__PURE__ */ new Map();
function mm(n, l) {
  Fe.delete(n), Fe.set(n, l);
  for (const s of Fe.keys()) {
    if (Fe.size <= Ov) break;
    Sl.get(s)?.size || Fe.delete(s);
  }
}
function Rv(n, l) {
  return Fe.has(n) ? Fe.get(n) : l;
}
function Dv(n, l, s) {
  const i = Rv(n, s), o = typeof l == "function" ? l(i) : l;
  if (!(Fe.has(n) && Object.is(o, i))) {
    mm(n, o);
    for (const d of [...Sl.get(n) ?? []]) d();
  }
}
function Bv(n, l) {
  if (typeof n != "string" || !n) throw new Error("useResourceState needs a non-empty key.");
  Fe.has(n) || mm(n, l);
  const s = ct.useCallback((d) => {
    const m = Sl.get(n) ?? /* @__PURE__ */ new Set();
    return Sl.set(n, m), m.add(d), () => {
      m.delete(d), m.size || Sl.delete(n);
    };
  }, [n]), i = ct.useSyncExternalStore(s, () => Fe.get(n)), o = ct.useCallback((d) => Dv(n, d, l), [n]);
  return [i, o];
}
const Hv = "[--radius:var(--radius-pane)] rounded-soft bg-surface-1/70 shadow-[0_6px_20px_rgba(0,0,0,0.3)] backdrop-blur-xl backdrop-saturate-150", Uv = "hover:bg-transparent hover:text-subtext-0 active:bg-surface-1 active:text-fg";
//! `@perch/sdk` for the native client: the surface a stock screen imports (the navigation part, 1.3), with every
//! call going to one abstract host object, `globalThis.perch`, read when called (so a host or a test sets it before
//! mounting). Class helpers, icons, `cn`, `keyLabel` and the host dot are the app's own modules, compiled in, so the
//! classes are the web's to the character. Data hooks subscribe to `perch.subscribe` and read the host's snapshots
//! (`perch.navigation(options)`, `perch.hosts()`, ...), which must return the same object until the data changes.
//! Menus and dialogs Perch draws itself (session menu, new session menu, confirm, select, folder browser,
//! instructions, memory) open through `perch.openOverlay(kind, props)`; their callbacks are plain functions.
const qv = "1.3.0";
let Gr = null;
const Yv = (n) => {
  Gr = n;
};
function Tt() {
  const n = (typeof Gr == "function" ? Gr() : Gr) ?? globalThis.perch;
  if (!n) throw new Error("@perch/sdk: no perch host (globalThis.perch) is set");
  return n;
}
const Gv = (n) => Tt().subscribe?.(n) ?? (() => {
}), Kv = dv;
function Qv() {
  return typeof globalThis.crypto?.randomUUID == "function" ? globalThis.crypto.randomUUID() : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (n) => {
    const l = Math.floor(Math.random() * 16);
    return (n === "x" ? l : l & 3 | 8).toString(16);
  });
}
const Vv = globalThis.perch?.isMac !== !1, Xv = (n) => jb(n, Tt().isMac !== !1), Lv = (n) => Rb(n), Zv = ({ className: n, ...l } = {}) => It(Bb(l), n), Jv = Ub, Wv = (n) => ss(n), Fv = qb, Iv = im, $v = rm, Pv = (n) => cs[n].color, t1 = (n, l) => Tt().shortcutFor?.(n, l) ?? null, e1 = (n) => Tt().shortcutLabel?.(n) ?? null, ei = (n, l) => Tt().command(n, l ?? {}) !== !1, n1 = (n, l, s) => Tt().startSession?.(n, l, s), a1 = globalThis.perch?.pickFolder ? (n) => Tt().pickFolder(n) : null;
function ie(n) {
  const l = ct.useRef(n);
  return l.current = n, ct.useSyncExternalStore(Gv, () => l.current(Tt()));
}
const pm = (n = {}) => ie((l) => l.navigation({ showTerminals: !!n.showTerminals, sortByAttention: !!n.sortByAttention })), l1 = () => ie((n) => n.hosts()), r1 = () => ie((n) => n.sessionFolders());
function i1() {
  const n = ie((l) => l.addProject?.() ?? o1);
  return {
    status: n.status ?? "idle",
    error: n.error,
    hostId: n.hostId,
    add: (l, s, i) => {
      l.trim() && n.status !== "pending" && Tt().addProjectFolder?.(l, s, i);
    },
    clear: () => Tt().clearAddProject?.()
  };
}
const o1 = Object.freeze({ status: "idle" }), hm = "perch.lastAgentChoice", s1 = Object.freeze({ connected: !1, discovery: !1, state: "ready", choices: [] }), c1 = () => {
  const n = Tt().storage?.getItem(hm);
  return n === "claude" || n === "codex" ? n : "claude";
}, u1 = Object.freeze({ items: [] });
function d1() {
  const n = ie((l) => l.notifications?.() ?? u1);
  return ct.useMemo(() => ({
    items: n.items ?? [],
    open: (l) => Tt().command("notification.open", { id: l }),
    dismiss: (l) => Tt().command("notification.dismiss", { id: l })
  }), [n]);
}
function f1(n) {
  const l = ie((o) => o.agentChoices?.(n) ?? s1), [s, i] = ct.useState(c1);
  return ct.useMemo(() => ({
    connected: !!l.connected,
    discovery: !!l.discovery,
    choices: l.choices ?? [],
    lastChoice: s,
    state: l.state ?? "ready",
    error: l.state === "error" ? l.error : void 0,
    rememberChoice: (o) => {
      o !== "claude" && o !== "codex" || (Tt().storage?.setItem(hm, o), i(o));
    },
    manage: () => Tt().command("agents.manage", {})
  }), [l, s]);
}
function m1(n) {
  Ke(() => Tt().onRequest?.("add-project", n) ?? void 0, [n]);
}
function p1(n) {
  const l = n.map((s) => ({ id: s.id, parentSessionId: s.parentId, session: s }));
  return uv(l).map((s) => ({ session: s.session, nested: us(s, l) }));
}
function h1({ id: n, plain: l, className: s }) {
  const i = ie((v) => v.session(n));
  if (!i) return null;
  const o = i.state ?? cv(i), d = cs[o]?.color ?? cs.unknown.color, m = i.provider, f = m === "claude" || m === "claude-agent-teams" || m === "omp", p = l ? It("agent-mark", "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full leading-none", s) : It("agent-status-dot", `agent-status-dot--${o}`, "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-[1.5px] bg-panel-bg leading-none", s);
  return ct.createElement(
    "span",
    { className: p, style: l ? void 0 : { borderColor: d }, "data-provider": m ?? "unknown", title: l ? m ?? "Agent" : `${m ?? "Agent"} · ${o}`, "aria-hidden": "true" },
    ct.createElement("span", { className: It("inline-flex text-fg", f && "rounded-full bg-[#161616]") }, ct.createElement(gm, { provider: m, size: 14 }))
  );
}
function gm({ provider: n, size: l = 14 }) {
  const s = Tt().agentIcon?.(n, l) ?? null, i = s?.markup ?? '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><circle cx="8" cy="8" r="5" fill="currentColor"/></svg>';
  return ct.createElement("svg", { width: l, height: l, "aria-hidden": "true", "data-agent-icon": n ?? "unknown", "data-perch-markup": i, ...s && s.tint === !1 ? { "data-perch-image": "true" } : {} });
}
const g1 = ({ children: n }) => ct.createElement(ct.Fragment, null, n);
function b1(n, l) {
  const s = ct.useRef(l);
  return s.current = l, Ke(() => {
    const i = Tt();
    if (!i.openOverlay) throw new Error(`@perch/sdk: the host draws no overlays (perch.openOverlay), so ${n} cannot open`);
    const o = {};
    for (const [m, f] of Object.entries(s.current))
      o[m] = typeof f == "function" ? (...p) => s.current[m]?.(...p) : f;
    const d = i.openOverlay(n, o);
    return () => i.closeOverlay?.(d);
  }, [n]), null;
}
const da = (n) => function(s) {
  return b1(n, s);
}, v1 = da("session-menu"), y1 = da("new-session-menu"), x1 = da("confirm");
let bm = null;
const w1 = (n) => {
  bm = n;
};
function _1(n) {
  return ct.createElement(bm ?? x1, n);
}
function S1({ className: n = Es, ...l }) {
  return ct.createElement(Lb, { ...l, className: n });
}
let fs = null;
const k1 = (n) => {
  fs = n;
}, E1 = da("folder-browser");
function z1(n) {
  return fs ? ct.createElement(fs, { ...n, browse: (l) => Tt().browse(n.hostId, l) }) : ct.createElement(E1, n);
}
const N1 = da("instructions"), T1 = da("memory"), C1 = Vb;
let Ts = null;
const M1 = (n) => {
  Ts = n;
};
function A1(n) {
  if (Ts) return ct.createElement(O1, n);
  const { hostId: l, path: s, className: i } = n, o = ct.useRef(null);
  return ct.createElement(
    "button",
    {
      type: "button",
      ref: o,
      className: It("worktree-menu__btn", rm, i),
      "data-testid": `worktree-menu-${l}-${s}`,
      title: "New workspace (a git worktree)",
      "aria-label": "New workspace",
      "aria-expanded": !1,
      onClick: () => Tt().openOverlay?.("worktree", { hostId: l, cwd: s, anchor: o.current?.getBoundingClientRect() })
    },
    ct.createElement(om, null)
  );
}
const vm = "Perch did not answer.";
function Dr(n) {
  return n ? n.type === "worktree.error" ? { error: n.message, dirty: !!n.dirty } : n.error ? { error: String(n.error) } : {} : { error: vm };
}
function j1(n, l, s = Tt()) {
  const i = (o) => {
    for (const d of o ?? []) {
      if (d.path === l) return d;
      const m = i(d.children);
      if (m) return m;
    }
    return null;
  };
  for (const o of s.navigation({})?.projects ?? []) {
    if (o.hostId !== n) continue;
    const d = i(o.workspaces) ?? i(o.hidden);
    if (d) return d;
  }
  return null;
}
const hf = 5 * 6e4;
function ym(n, l, s, i = Tt()) {
  const o = Date.now() + hf;
  let d = !1, m = () => {
  };
  const f = () => {
    d = !0, m(), clearTimeout(v);
  }, p = () => {
    if (!d) {
      if (Date.now() >= o) return f();
      j1(n, l, i) && (f(), i.startSession?.(n, l, s));
    }
  }, v = setTimeout(f, hf);
  m = i.subscribe?.(p) ?? (() => {
  }), p();
}
function O1({ hostId: n, path: l, className: s, worktrees: i, request: o, parentChoices: d, emptyAgent: m, ...f }) {
  const [p, v] = ct.useState(i), k = (A) => !!Tt().coreCan?.(A, n), E = pm(), x = `${n}:${l}`, z = ct.useMemo(() => {
    if (Array.isArray(d)) return d;
    if (!k("workspace.nest")) return [];
    const A = E?.projects?.find((U) => U.hostId === n && U.repoPath === l), O = [], M = (U, L) => {
      for (const F of U ?? [])
        L && O.push({ id: F.id, name: F.name, path: F.path }), M(F.children, !0);
    };
    return M(A?.workspaces, !1), O;
  }, [d, E, n, l]), S = n === "local" && k("worktree.job"), w = f.deleteSupported ?? k("worktree.delete"), _ = f.startFromSupported ?? k("worktree.startFrom"), N = ie((A) => A.emptyWorkspaceAgent?.() ?? void 0), B = m ?? N ?? void 0, j = ie((A) => A.worktreeMenuRequest?.() ?? null), Z = j?.projectKey === x ? j.nonce : null, q = ct.useMemo(() => o ?? (Z == null ? null : j), [o, Z]), [D, h] = ct.useState(q);
  Ke(() => {
    q && h(q);
  }, [q]);
  const b = ct.useRef({});
  b.current = { background: S, deleteSupported: w };
  const y = ct.useMemo(() => {
    const A = (O, M) => Tt().ask(O, { hostId: n, repoPath: l, ...M });
    return {
      list: async () => {
        const O = await A("worktree.list", {});
        return O?.type === "worktree.list.result" && v({ worktrees: O.worktrees ?? [], defaultRoot: O.defaultRoot ?? "", baseRef: O.baseRef, refs: O.refs ?? [] }), Dr(O);
      },
      create: async ({ branch: O, newBranch: M, path: U, extra: L, agent: F }) => {
        const Q = { branch: O, newBranch: !!M, path: U ?? null, name: L?.name ?? null, startFrom: L?.startFrom ?? null, parentWorkspaceId: L?.parentWorkspaceId ?? null }, { background: J } = b.current, I = await A(J ? "worktree.job.start" : "worktree.create", Q), K = J ? "worktree.job.started" : "worktree.done";
        if (I?.type !== K) return { error: Dr(I).error ?? vm };
        const V = J ? I.job?.path : I.path;
        return F && V && ym(n, V, F), { background: J };
      },
      remove: async (O, M) => {
        const U = await A("worktree.remove", { path: O, force: !!M, deleteBranch: b.current.deleteSupported });
        return { ...Dr(U), preservedBranch: U?.type === "worktree.done" ? U.preservedBranch ?? void 0 : void 0 };
      },
      deleteBranch: async (O, M) => Dr(await A("worktree.branch.delete", { branch: O, expectedHead: M })),
      open: (O) => Tt().startSession?.(n, O, "terminal"),
      // The window forgets the request; the screen keeps it until a newer one, as clearing it would re-run (and so
      // cancel) the screen's effect that a measurement put off until the next frame (`measured`).
      takeRequest: () => Tt().takeWorktreeRequest?.()
    };
  }, [n, l]);
  return ct.createElement(Ts, {
    hostId: n,
    cwd: l,
    projectKey: x,
    className: s,
    worktrees: p,
    background: S,
    startFromSupported: _,
    deleteSupported: w,
    parentChoices: z,
    emptyAgent: B,
    request: D,
    actions: y
  });
}
const R1 = (n, l) => {
  if (!Tt().followPointer?.(n)) return;
  const s = l.items();
  for (const i of s) i.getBoundingClientRect();
  s[0]?.parentElement?.getBoundingClientRect(), Tb(n, l);
}, D1 = () => ie((n) => n.workspaceTabs()), B1 = () => ie((n) => n.statusLine()), H1 = () => ie((n) => n.zoom()), U1 = () => ie((n) => n.paneLook()), q1 = () => ie((n) => n.keybindings?.() ?? []), Y1 = Object.freeze({ usage: Object.freeze([]), updatedAt: 0, spend: null, redeemResult: null });
function G1(n) {
  const l = !!n?.keepFresh, s = ie((o) => o.statusLine?.().connected ?? !1), i = ie((o) => o.planUsage?.() ?? Y1);
  return Ke(() => {
    if (!l || !s) return;
    let o;
    const d = () => {
      Tt().command("usage.get"), o = setTimeout(d, 18e4);
    };
    return d(), () => clearTimeout(o);
  }, [l, s]), i;
}
const K1 = () => Tt().command("usage.get", { force: !0 }), Q1 = (n) => Tt().command("usage.redeemReset", { accountId: n }), V1 = () => ei("app.zoom_reset"), X1 = {
  focused: "bg-[color-mix(in_srgb,var(--text)_10%,var(--panel-bg))] hover:bg-[color-mix(in_srgb,var(--text)_10%,var(--panel-bg))] text-fg font-semibold",
  visible: "bg-transparent text-subtext-0 hover:bg-surface-0 hover:text-fg",
  hidden: "bg-transparent text-subtext-0 hover:bg-surface-0 hover:text-fg"
}, L1 = (n, l, s) => Tt().beginTabDrag?.(n, l, s);
function Z1(n) {
  Ke(() => Tt().onRequest?.("new-tab", n) ?? void 0, [n]);
}
const J1 = (n) => ei("browser.open", { workspaceId: n }), W1 = (n, l) => ei("file.open", { workspaceId: n, path: l }), F1 = () => null, I1 = () => null, $1 = da("new-file"), fy = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  AgentIcon: gm,
  Chevron: Ns,
  CloseIcon: Kb,
  ConfirmDialog: _1,
  Dialog: C1,
  EllipsisIcon: Yb,
  FolderBrowser: z1,
  GearIcon: Gb,
  HostStateDot: Qb,
  InstructionsDialog: N1,
  MemoryDialog: T1,
  ModeSwitch: vv,
  NewFilePrompt: $1,
  NewSessionMenu: y1,
  PageIcon: fv,
  PlusIcon: om,
  QrCode: Nv,
  Select: S1,
  SessionDot: h1,
  SessionMenu: v1,
  SettingRow: Cv,
  SettingsGroup: Tv,
  SettingsQuery: Nl,
  Slot: g1,
  Submenu: sv,
  Switch: Mv,
  TabDragLayer: I1,
  TabMenu: F1,
  WorktreeMenu: A1,
  agentStateColor: Pv,
  anchoredPopoverStyle: Kv,
  beginReorderDrag: R1,
  beginTabDrag: L1,
  bindHost: Yv,
  buttonClass: Jv,
  cn: It,
  drawConfirmationsInPlace: w1,
  drawFolderBrowserInPlace: k1,
  drawWorktreeInPlace: M1,
  ghostButton: Iv,
  glassClass: Hv,
  iconButton: $v,
  isMac: Vv,
  keyLabel: Xv,
  menuDividerClass: Fv,
  menuItemClass: Wv,
  menuPanel: ks,
  nestSessions: p1,
  newId: Qv,
  openBrowserTab: J1,
  openFileTab: W1,
  pickFolder: a1,
  redeemUsageReset: Q1,
  refreshUsage: K1,
  resetZoom: V1,
  rowActionClass: Zv,
  runCommand: ei,
  segmentClass: Lv,
  settingsClass: jv,
  shortcutFor: t1,
  shortcutLabel: e1,
  startPaneWhenReady: ym,
  startSession: n1,
  tabStateClass: X1,
  tapButtonClass: Uv,
  useAddProject: i1,
  useAddProjectRequest: m1,
  useAgentChoices: f1,
  useDismissOnOutsideClick: um,
  useHostSnapshot: ie,
  useHosts: l1,
  useKeybindings: q1,
  useNavigation: pm,
  useNewTabRequest: Z1,
  useNotifications: d1,
  usePaneLook: U1,
  usePlanUsage: G1,
  useResourceState: Bv,
  useSessionFolders: r1,
  useSettingsQuery: Av,
  useStatusLine: B1,
  useWorkspaceTabs: D1,
  useZoom: H1,
  version: qv
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
const Cs = {
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
  Cs[n] = (l, s) => l[n](s);
const my = Object.keys(Cs);
function Wo(n, l) {
  for (const [s, i] of Object.entries(l)) {
    const o = Cs[s];
    if (!o) throw new Error(`the description key ${s} has no GPUI builder`);
    i != null && (n = o(n, i));
  }
  return n;
}
const oa = (n) => ({ clientX: n?.position?.x ?? 0, clientY: n?.position?.y ?? 0 }), gf = /* @__PURE__ */ new WeakSet(), Fo = /* @__PURE__ */ new WeakSet();
function bf(n, l, s) {
  const i = n.pressed, o = oa(s);
  return i && i.x === o.clientX && i.y === o.clientY ? i.id : l;
}
function P1(n, l, s) {
  if (n.name) return n.name;
  if (!(l.size || n.hover || n.focus || n.active || n.track_hover && Wr.has(n.group) || s)) return null;
  const i = n.meta?.attrs["data-testid"];
  return i ? `~${n.id}:${i}` : `~${n.id}`;
}
const xm = (n, l = !1) => (n.children ?? []).some((s) => s.kind === "text" ? !l || /\s/.test(String(s.text ?? "").trim()) : s.kind === "div" && s.style?.flex_direction !== "row" && s.style?.whitespace !== "nowrap" && xm(s, !0)), Ne = (n) => n.style?.display !== "hidden";
let Wr = /* @__PURE__ */ new Set(), ms = null;
function wm(n, l = /* @__PURE__ */ new Set()) {
  for (const { group: s, style: i } of n.group_hover ?? []) "display" in i && l.add(s);
  for (const s of n.children ?? []) s.kind !== "text" && wm(s, l);
  return l;
}
function ps(n, l, s, i, o = !1, d = !1, m = null, f = {}, p = !1, v = /* @__PURE__ */ new Map(), k = null) {
  if (n.kind === "text") return v.get(n)?.text ?? n.text;
  const E = gf.has(n);
  d ||= n.style.opacity === 0 || n.style.visibility === "invisible" || n.style.display === "hidden", d && (n.name || n.range_name) && (n = { ...n, name: void 0, range_name: void 0, also: void 0 }), n.style.text_color !== void 0 && (k = null), m = n.style.text_color ?? m;
  const x = !!n.hover?.text_color && Em(n), z = n.group ?? (x ? `~g${n.id}` : null);
  x && (k = { group: z, color: n.hover.text_color }), f = { ...f };
  for (const M of ["text_size", "line_height", "whitespace", "text_ellipsis"]) n.style[M] !== void 0 && (f[M] = n.style[M]);
  const S = new Set(n.events ?? []), w = o ? { count: 0, hits: /* @__PURE__ */ new Set(), at: null } : !d && !n.pointer_none && n.style.position === "absolute" ? ms : null, _ = w ? w.count++ : -1;
  o && (ms = w);
  let N;
  if (n.kind === "image" && !n.markup ? N = l.image(n.src) : N = l.div(), n.kind === "engine" && (N = N.child(i.engine ? i.engine(n.engine, n.key) : l.div())), n.markup && n.kind === "svg" && k && k.color !== m) {
    const { group: M, color: U } = k, L = () => l.div().absolute().top(0).left(0).size_full();
    N = N.child(L().group_hover(M, (F) => F.invisible()).child(i.icon(`~icon-${n.id}`, n.markup, m))).child(L().invisible().group_hover(M, (F) => F.visible()).child(i.icon(`~icon-${n.id}-hover`, n.markup, U)));
  } else n.markup && (N = N.child(i.icon(`~icon-${n.id}`, n.markup, n.kind === "svg" ? m : "")));
  const B = P1(n, S, !!w);
  if (B && (N = N.id(B)), n.measure && (N = N.measure(n.measure)), n.name && N.also_named) for (const M of n.also ?? []) N = N.also_named(M);
  N = Wo(N, { ...n.style, ...v.get(n) });
  const j = f.whitespace !== "nowrap" && !f.text_ellipsis;
  p && j && n.style.flex_shrink !== 0 && n.style.min_w === void 0 && xm(n) && (N = N.min_w(0));
  for (const M of ["hover", "focus", "active"]) n[M] && (N = N[M]((U) => Wo(U, n[M])));
  z && (N = N.group(z));
  for (const { group: M, style: U } of n.group_hover ?? []) {
    const { display: L, ...F } = U;
    Object.keys(F).length && (N = N.group_hover(M, (Q) => Wo(Q, F)));
  }
  if (l.scroll && (n.style.overflow_x === "scroll" || n.style.overflow_y === "scroll")) {
    const M = s.document?.scrollTarget, U = M ? (n.children ?? []).filter(Ne).findIndex((L) => km(L, M.id)) : -1;
    if (U >= 0 && (s.scroller ?? n.id) === n.id && (s.document.scrollTarget = null, s.scroller = n.id, l.scroll.scroll_to_item(U)), s.scroller ??= n.id, s.scroller === n.id && s.document) {
      N = N.track_scroll(l.scroll);
      const L = (n.children ?? []).filter(Ne).map((F) => F.id);
      s.document.itemBounds = (F) => L.includes(F) ? l.scroll.item_bounds?.(L.indexOf(F)) ?? null : null;
    }
  }
  const Z = n.style.overflow_x === "scroll" || n.style.overflow_y === "scroll", q = o && !n.pointer_none || n.blocks_pointer;
  if ((Z && Fo.has(n) || q) && (N = N.on_scroll_wheel((M, U) => U.stop_propagation?.())), Z || Fo.has(n)) for (const M of n.children ?? []) M.kind !== "text" && Fo.add(M);
  n.kind === "input" && !n.disabled && (N = N.on_mouse_down("left", (M, U) => {
    M.bounds && s.setBounds(n.id, M.bounds), s.focus(n.id), U.notify();
  }));
  const D = n.kind === "input" ? n : n.meta?.tag === "label" ? Sm(n) : null;
  D && !D.disabled && /^(checkbox|radio)$/.test(D.input_type) && (N = N.on_click((M, U) => {
    U.stop_propagation?.(), s.toggle(D.id), U.notify();
  }));
  const h = ["click", "double_click", "context_menu", "mouse_down", "mouse_up"].some((M) => S.has(M));
  if (h || E) for (const M of n.children ?? []) M.kind !== "text" && gf.add(M);
  if (h && (N = N.on_mouse_down("left", (M, U) => {
    U.stop_propagation?.(), M.bounds && s.setBounds(n.id, M.bounds);
    const L = { ...oa(M), button: 0, buttons: 1, detail: M.click_count }, F = bf(s, n.id, M);
    s.pressed = null, s.dispatch(F, "pointerdown", { ...L, pointerType: "mouse" }), s.dispatch(F, "mousedown", L) && s.pressFocus?.(F), U.notify();
  }), N = N.on_mouse_down("right", (M, U) => {
    U.stop_propagation?.(), M.bounds && s.setBounds(n.id, M.bounds);
    const L = bf(s, n.id, M);
    s.pressed = null, s.dispatch(L, "contextmenu", { ...oa(M), button: 2 }), U.notify();
  }), N = N.on_mouse_up("left", (M, U) => {
    U.stop_propagation?.();
    const L = { ...oa(M), button: 0 };
    s.dispatch(n.id, "pointerup", { ...L, pointerType: "mouse" }), s.dispatch(n.id, "mouseup", L), U.notify();
  }), N = N.on_click((M, U) => {
    s.dispatch(n.id, M.click_count === 2 && S.has("double_click") ? "dblclick" : "click", { detail: M.click_count, button: 0 }), U.notify();
  })), n.blocks_pointer && !h)
    for (const M of ["left", "right"]) N = N.on_mouse_down(M, (U, L) => L.stop_propagation?.());
  else if (E && !h)
    for (const M of ["left", "right"])
      N = N.on_mouse_down(M, (U) => {
        const L = oa(U);
        (s.pressed?.x !== L.clientX || s.pressed?.y !== L.clientY) && (s.pressed = { id: n.id, x: L.clientX, y: L.clientY });
      });
  if (S.has("mouse_move") && (N = N.on_mouse_move((M) => {
    s.dispatch(n.id, "pointermove", { ...oa(M), pointerType: "mouse" });
  })), n.track_hover && Wr.has(n.group) && (N = N.on_hover((M, U) => {
    s.hover(n.id, M), U.notify();
  })), w && (N = N.on_mouse_down_out((M, U) => {
    const L = oa(M), F = `${L.clientX},${L.clientY}`;
    w.at !== F && (w.at = F, w.hits = /* @__PURE__ */ new Set()), w.hits.add(_), !(w.hits.size < w.count) && (w.at = null, s.dispatch(s.document.body.id, "pointerdown", { ...L, pointerType: "mouse" }), s.dispatch(s.document.body.id, "mousedown", L), U.notify());
  })), n.kind === "input" && !/^(checkbox|radio|range|color|file|select)$/.test(n.input_type)) {
    const M = n.value ? String(n.value) : String(n.placeholder ?? "");
    let U = l.div().whitespace_nowrap().overflow_x_hidden();
    const L = ca(f);
    L && (U = U.h(L)), !n.value && m && (U = U.text_color(ey(m))), M && (N = N.child(U.child(n.input_type === "password" && n.value ? "•".repeat([...M].length) : M))), n.field_w && (N = N.child(l.div().w(n.field_w).h(0)));
  }
  const b = f.whitespace === "nowrap" ? ca(f) : null, y = n.style.display === "flex" && !String(n.style.flex_direction ?? "row").startsWith("col");
  let A = !n.range_name;
  const O = n.style.display === "flex" && String(n.style.flex_direction ?? "row").startsWith("col") && (n.style.h === void 0 || n.style.h === "auto") && typeof n.style.max_h == "number";
  for (const M of (n.children ?? []).filter(Ne)) {
    const U = M.style?.flex_basis;
    O && M.style.flex_grow > 0 && (U === 0 || typeof U == "string" && U.endsWith("%")) && v.set(M, { ...v.get(M), flex_basis: "auto" });
    let L = ps(M, l, s, i, !1, d, m, f, y && M.style?.position !== "absolute", v, k);
    const F = !A && (M.kind === "text" || !M.meta), Q = M.kind === "text" ? v.get(M)?.h ?? b : null, J = M.kind === "text" ? v.get(M)?.w : void 0;
    if (F || Q || J !== void 0) {
      let I = l.div();
      F && (I = I.id(n.range_name)), F && !y && n.style.display === "flex" && (I = I[`self_${ty[f.text_align] ?? "start"}`]().max_w("100%")), Q && (I = I.h(Q)), J !== void 0 && (I = I.w(J).flex_none().whitespace_nowrap()), L = I.child(L), A ||= F;
    }
    N = N.child(L);
  }
  return N;
}
const ty = { center: "center", right: "end", end: "end" };
function ey(n) {
  const l = String(n);
  if (!/^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(l)) return n;
  const s = l.length === 9 ? Number.parseInt(l.slice(7), 16) : 255;
  return `${l.slice(0, 7)}${Math.round(s / 2).toString(16).padStart(2, "0")}`;
}
const _m = /^(?:[!-,.-~]+|\S)$/u, Sm = (n) => {
  for (const l of n.children ?? []) {
    if (l.kind === "input" && /^(checkbox|radio)$/.test(l.input_type)) return l;
    const s = l.kind === "text" ? null : Sm(l);
    if (s) return s;
  }
  return null;
}, km = (n, l) => n.id === l || (n.children ?? []).some((s) => s.kind !== "text" && km(s, l)), Em = (n) => !!n.markup || (n.children ?? []).some((l) => l.kind !== "text" && Em(l));
function ca(n) {
  const l = n.line_height;
  return typeof l == "string" && l.endsWith("px") ? Number.parseFloat(l) : typeof l == "number" && typeof n.text_size == "number" ? l * n.text_size : null;
}
function py(n, l, s, i, o = 0, d = !1) {
  const m = [n.root, ...n.overlays];
  Wr = /* @__PURE__ */ new Set(), ms = null;
  for (const k of m) wm(k, Wr);
  const f = o > 0 ? sy(m, o) : /* @__PURE__ */ new Map();
  o > 0 && i.measure && ny(m, o, i.measure, f), iy(m, f), ry(m, f), i.measure && ly(m, i.measure, f);
  let p = l.div().relative().size_full().child(ps(n.root, l, s, i, !1, !1, null, {}, !1, f)), v = d && n.overlays.length ? l.div().relative().size_full().window_layer() : p;
  for (const k of n.overlays) v = v.child(ps(k, l, s, i, !0, !1, null, {}, !1, f));
  return v === p ? p : p.child(v);
}
function ny(n, l, s, i) {
  const o = (S, w) => i.set(S, { ...i.get(S), ...w }), d = /* @__PURE__ */ new Map(), m = /* @__PURE__ */ new Map(), f = ["text_size", "font_weight", "font_family", "italic", "whitespace", "text_ellipsis"];
  function p(S, w, _) {
    if (S.kind === "text") {
      if (!(w.whitespace === "nowrap" || _m.test(S.text)) || w.text_ellipsis || _ || typeof w.text_size != "number") return NaN;
      const h = s(S.text, { size: w.text_size, weight: w.font_weight ?? 400, family: w.font_family ?? ".SystemUIFont", italic: !!w.italic });
      return Number.isFinite(h) ? h : NaN;
    }
    if (!Ne(S) || S.kind === "input" || S.kind === "engine" || S.markup) return v(S);
    const N = { ...w };
    for (const D of f) S.style[D] !== void 0 && (N[D] = S.style[D]);
    N.text_ellipsis = !!S.style.text_ellipsis, m.set(S, N);
    const B = S.style, j = (S.children ?? []).filter(Ge), Z = j.map((D) => p(D, N, _ || !!S.tabular));
    let q = v(S);
    if (!Number.isFinite(q) && B.w === void 0) {
      const D = j.map((b, y) => Z[y] + (b.kind === "text" ? 0 : rt(b.style.ml) + rt(b.style.mr)));
      let h;
      j.length ? Oe(S) ? h = j.some((b) => b.kind !== "text" && b.style.flex_grow > 0) || B.flex_wrap === "wrap" ? NaN : D.reduce((b, y) => b + y, 0) + rt(B.gap_x) * (j.length - 1) : h = Math.max(...D) : h = 0, q = h + rt(B.pl) + rt(B.pr) + rt(B.border_l) + rt(B.border_r), typeof B.min_w == "number" && (q = Math.max(q, B.min_w)), typeof B.max_w == "number" && (q = Math.min(q, B.max_w));
    }
    return d.set(S, q), q;
  }
  const v = (S) => typeof S.style?.w == "number" ? S.style.w : NaN, k = () => ({ exact: 0, laid: 0 }), E = (S, w) => {
    if (!Number.isFinite(w))
      return Object.assign(S, k()), NaN;
    S.exact += w;
    const _ = Math.round(S.exact * l + 1e-9) / l, N = _ - S.laid;
    return S.laid = _, N;
  }, x = (S) => Oe(S) && S.style.flex_wrap !== "wrap" && (S.style.justify ?? "start") === "start";
  function z(S) {
    if (!S || S.kind === "text" || !Ne(S)) return;
    const w = (S.children ?? []).filter(Ge);
    if (x(S) && w.length > 1) {
      const _ = rt(S.style.gap_x), N = k(), B = !(_ && w.some((j) => j.kind === "text" || !Number.isFinite(rt(j.style.ml))));
      o(S, { border_l: E(N, rt(S.style.border_l)), pl: E(N, rt(S.style.pl)) }), B && _ && o(S, { gap_x: 0 }), w.forEach((j, Z) => {
        const q = (Z && B ? _ : 0) + (j.kind === "text" ? 0 : rt(j.style.ml));
        if (j.kind === "text")
          q && Object.assign(N, k());
        else {
          const y = E(N, q);
          Number.isFinite(y) && o(j, { ml: y });
        }
        const D = j.kind === "text" ? m.get(S) ?? {} : null, h = j.kind === "text" ? p(j, D, !!S.tabular) : d.get(j);
        if ((j.kind === "text" || !(j.style.flex_grow > 0)) && Number.isFinite(h)) {
          const y = { w: E(N, h) };
          j.kind !== "text" && typeof j.style.w != "number" && j.style.min_w === void 0 && (y.whitespace = "nowrap", y.flex_shrink = 0), o(j, y);
        } else Object.assign(N, k());
        if (j.kind !== "text") {
          const y = E(N, rt(j.style.mr));
          Number.isFinite(y) && o(j, { mr: y });
        }
      });
    }
    for (const _ of S.children ?? []) _.kind !== "text" && z(_);
  }
  for (const S of n)
    S && (p(S, {}, !1), z(S));
}
const ay = /(?<= +)(?=[^ ])|(?<=[\p{L}\p{N}]-)(?=[\p{L}\p{N}])/u;
function ly(n, l, s) {
  const i = ["text_size", "font_weight", "font_family", "italic", "line_height"], o = (f) => typeof f == "number" ? f : 0, d = (f, p) => p && Fr(p) && !Oe(p) && f.style.position !== "absolute" && !["start", "center", "end"].includes(f.style.self) && !["start", "center", "end"].includes(p.style.items), m = (f, p, v, k) => {
    if (!f || f.kind === "text" || !Ne(f)) return;
    const E = f.style;
    let x = typeof E.w == "number" ? E.w : E.w === "100%" ? v : d(f, p) ? v - o(E.ml) - o(E.mr) : NaN;
    typeof E.max_w == "number" && (x = Math.min(x, E.max_w));
    const z = x - o(E.pl) - o(E.pr) - o(E.border_l) - o(E.border_r), S = { ...k };
    for (const _ of i) E[_] !== void 0 && (S[_] = E[_]);
    const w = f.children ?? [];
    if (f.break_anywhere && Number.isFinite(z) && z > 0 && typeof S.text_size == "number" && w.length && w.every((_) => _.kind === "text")) {
      const _ = { size: S.text_size, weight: S.font_weight ?? 400, family: S.font_family ?? ".SystemUIFont", italic: !!S.italic }, N = (Z) => l(Z.trimEnd(), _) <= z + 0.01;
      let B = 0;
      for (const Z of w) {
        const q = [];
        for (const h of Z.text.split(`
`)) {
          let b = "";
          for (const y of h.split(ay)) {
            if (N(b + y)) {
              b += y;
              continue;
            }
            b && q.push(b.trimEnd()), b = "";
            for (const A of y)
              b && !N(b + A) && (q.push(b), b = ""), b += A;
          }
          q.push(b.trimEnd());
        }
        const D = q.join(`
`);
        q.every((h) => !h || N(h)) ? D !== Z.text && s.set(Z, { ...s.get(Z), text: D }) : B = NaN, B += q.length;
      }
      const j = ca(S);
      Number.isFinite(B) && j && E.h === void 0 && w.length === 1 && s.set(f, { ...s.get(f), h: B * j + o(E.pt) + o(E.pb) + o(E.border_t) + o(E.border_b) });
    }
    for (const _ of w) m(_, f, Oe(f) ? NaN : z, S);
  };
  for (const f of n) m(f, null, NaN, {});
}
function ry(n, l) {
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
  for (const i of n) s(i, !1);
}
function iy(n, l) {
  const s = l.heights ?? /* @__PURE__ */ new Map(), i = (p) => s.get(p), o = (p) => {
    const v = i(p);
    if (Number.isFinite(v)) return v;
    if (p.kind === "text" || !Ne(p)) return 0;
    const k = p.style, E = typeof k.min_h == "number" ? k.min_h : 0, x = (p.children ?? []).filter(Ge), z = x.map((_) => o(_) + (_.kind === "text" ? 0 : Math.max(0, rt(_.style.mt) || 0) + Math.max(0, rt(_.style.mb) || 0))), S = x.length ? Oe(p) ? Math.max(...z) : z.reduce((_, N) => _ + N, 0) + (k.display === "flex" ? (rt(k.gap_y) || 0) * (x.length - 1) : 0) : 0, w = [k.pt, k.pb, k.border_t, k.border_b].reduce((_, N) => _ + (rt(N) || 0), 0);
    return Math.max(E, S + w);
  }, d = (p) => !(p.children ?? []).filter(Ge).length || Oe(p) ? NaN : o({ ...p, style: { ...p.style, h: void 0, max_h: void 0, min_h: void 0 } }), m = (p, v) => {
    const k = p.style;
    if (typeof k.h == "number") return k.h;
    if (typeof k.max_h == "number") return k.max_h;
    if (!v || !Fr(v) || Oe(v)) return NaN;
    const E = v.style, x = typeof E.h == "number" ? E.h : typeof E.max_h == "number" ? E.max_h : NaN, z = (v.children ?? []).filter(Ge);
    let S = 0;
    for (const _ of z) {
      if (_ === p) continue;
      const N = i(_);
      if (!Number.isFinite(N)) return NaN;
      S += N + (_.kind === "text" ? 0 : rt(_.style.mt) + rt(_.style.mb));
    }
    const w = E.display === "flex" ? rt(E.gap_y) * Math.max(0, z.length - 1) : 0;
    return x - rt(E.pt) - rt(E.pb) - rt(E.border_t) - rt(E.border_b) - S - w - rt(k.mt) - rt(k.mb);
  }, f = (p, v) => {
    if (!(!p || p.kind === "text" || !Ne(p))) {
      if (p.scrollbar > 0 && p.style.overflow_y === "scroll") {
        const k = d(p), E = m(p, v);
        Number.isFinite(k) && Number.isFinite(E) && k > E + 0.01 && l.set(p, { ...l.get(p), pr: rt(p.style.pr) + p.scrollbar });
      }
      for (const k of p.children ?? []) f(k, p);
    }
  };
  for (const p of n) f(p, null);
}
const oy = ["text_size", "line_height", "whitespace", "text_ellipsis"], rt = (n) => n == null ? 0 : typeof n == "number" ? n : NaN, Fr = (n) => n.style.display === "flex" ? n.style.flex_direction === "col" : !0, Oe = (n) => n.style.display === "flex" && (n.style.flex_direction ?? "row") === "row", Ge = (n) => n.kind === "text" || Ne(n) && n.style.position !== "absolute";
function sy(n, l) {
  const s = /* @__PURE__ */ new Map(), i = (w, _) => s.set(w, { ...s.get(w), ...Object.fromEntries(Object.entries(_).filter(([, N]) => Number.isFinite(N))) }), o = /* @__PURE__ */ new Map(), d = /* @__PURE__ */ new Map();
  function m(w, _) {
    if (w.kind === "text") return _.whitespace === "nowrap" || _m.test(w.text) ? ca(_) ?? NaN : NaN;
    const N = { ..._ };
    for (const D of oy) w.style[D] !== void 0 && (N[D] = w.style[D]);
    d.set(w, N);
    const B = w.style, j = (w.children ?? []).filter(Ge), Z = j.map((D) => m(D, N));
    let q;
    if (B.h !== void 0 && B.h !== "auto") q = rt(B.h);
    else if (w.kind === "engine") q = NaN;
    else if (w.kind === "input")
      q = (w.input_type === "textarea" || w.input_type === "select" ? NaN : ca(N) ?? NaN) + rt(B.pt) + rt(B.pb) + rt(B.border_t) + rt(B.border_b), B.min_h !== void 0 && (q = Math.max(q, rt(B.min_h)));
    else {
      const D = j.map((b, y) => (b.kind === "text" ? 0 : rt(b.style.mt) + rt(b.style.mb)) + Z[y]);
      let h;
      if (Oe(w)) h = B.flex_wrap === "wrap" ? NaN : B.items === "baseline" ? p(j, Z, N) : Math.max(0, ...D);
      else if (Fr(w)) {
        const b = j.some((A) => A.kind !== "text" && (A.style.flex_grow > 0 || A.style.flex_basis !== void 0)), y = B.display !== "flex" && j.some((A) => A.kind !== "text" && (rt(A.style.mt) || rt(A.style.mb)));
        h = b || y ? NaN : D.reduce((A, O) => A + O, 0) + (B.display === "flex" ? rt(B.gap_y) * Math.max(0, j.length - 1) : 0);
      } else h = NaN;
      q = h + rt(B.pt) + rt(B.pb) + rt(B.border_t) + rt(B.border_b), B.min_h !== void 0 && (q = Math.max(q, rt(B.min_h))), B.max_h !== void 0 && (q = Math.min(q, rt(B.max_h)));
    }
    return o.set(w, q), q;
  }
  const f = (w) => (ca(w) - (Xr + Uf) * w.text_size) / 2 + Xr * w.text_size;
  function p(w, _, N) {
    let B = 0, j = 0;
    for (const [Z, q] of w.entries()) {
      const D = q.kind === "text" ? N : d.get(q);
      if (!(q.kind === "text" || (q.children ?? []).filter(Ge).every((A) => A.kind === "text")) || !Number.isFinite(_[Z]) || typeof D.text_size != "number") return NaN;
      const b = q.kind === "text" ? {} : q.style, y = rt(b.mt) + rt(b.border_t) + rt(b.pt) + f(D);
      B = Math.max(B, y), j = Math.max(j, rt(b.mt) + _[Z] + rt(b.mb) - y);
    }
    return B + j;
  }
  const v = () => ({ exact: 0, laid: 0 }), k = (w, _) => {
    if (!Number.isFinite(_))
      return Object.assign(w, v()), NaN;
    w.exact += _;
    const N = Math.round(w.exact * l + 1e-9) / l, B = N - w.laid;
    return w.laid = N, B;
  };
  function E(w) {
    if (!(w.kind === "text" || !Ne(w))) {
      for (const _ of (w.children ?? []).filter((N) => N.kind !== "text" && Ne(N) && N.style.position === "absolute")) E(_);
      if (Fr(w) && !Oe(w)) {
        const _ = v();
        i(w, { border_t: k(_, rt(w.style.border_t)), pt: k(_, rt(w.style.pt)) }), x(w, _);
      } else for (const _ of (w.children ?? []).filter(Ge)) _.kind !== "text" && E(_);
    }
  }
  function x(w, _) {
    const N = (w.children ?? []).filter(Ge), B = w.style.display === "flex" ? rt(w.style.gap_y) : 0;
    if (B && N.some((j) => j.kind === "text")) {
      for (const j of N) j.kind !== "text" && E(j);
      return !1;
    }
    return B && i(w, { gap_y: 0 }), N.forEach((j, Z) => {
      if (j.kind === "text") {
        const q = o.get(j) ?? m(j, d.get(w) ?? {});
        Number.isFinite(q) ? i(j, { h: k(_, q) }) : Object.assign(_, v());
        return;
      }
      if (i(j, { mt: k(_, (Z ? B : 0) + rt(j.style.mt)) }), Number.isFinite(o.get(j))) S(j, _);
      else if (z(j)) {
        const q = j.style;
        i(j, { border_t: k(_, rt(q.border_t)), pt: k(_, rt(q.pt)) }), i(j, { pb: k(_, rt(q.pb)), border_b: k(_, rt(q.border_b)) });
      } else
        E(j), Object.assign(_, v());
      i(j, { mb: k(_, rt(j.style.mb)) });
    }), !0;
  }
  function z(w) {
    const _ = w.style, N = (w.children ?? []).filter(Ge), B = ca(d.get(w) ?? {});
    return w.kind === "div" && !Oe(w) && N.length > 0 && N.every((j) => j.kind === "text") && Number.isInteger(B) && [_.h, _.min_h, _.max_h].every((j) => j === void 0 || j === "auto");
  }
  function S(w, _) {
    const N = w.style;
    for (const D of (w.children ?? []).filter((h) => h.kind !== "text" && Ne(h) && h.style.position === "absolute")) E(D);
    const B = _.laid, j = _.exact;
    i(w, { border_t: k(_, rt(N.border_t)), pt: k(_, rt(N.pt)) });
    const Z = N.h !== void 0 && N.h !== "auto", q = o.get(w) - rt(N.pt) - rt(N.pb) - rt(N.border_t) - rt(N.border_b);
    if (w.kind === "input")
      Z || k(_, q);
    else if (Oe(w) || Z && (N.justify ?? "start") !== "start") {
      for (const D of (w.children ?? []).filter(Ge)) D.kind !== "text" && E(D);
      Z || k(_, q);
    } else !x(w, _) && !Z && k(_, q);
    if (Z) {
      _.exact = j + o.get(w), _.laid = Math.round(_.exact * l + 1e-9) / l, i(w, { h: _.laid - B });
      return;
    }
    i(w, { pb: k(_, rt(N.pb)), border_b: k(_, rt(N.border_b)) }), i(w, { h: _.laid - B });
  }
  for (const w of n)
    m(w, {}), E(w);
  return Object.defineProperty(s, "heights", { value: o }), s;
}
const hy = { sidebar: [{ name: "sidebar-root", selector: "aside.sidebar" }, { name: "sidebar-content", selector: "aside.sidebar > div:first-child" }, { name: "host-switcher", selector: '[data-testid="host-switcher"]' }, { name: "host-chip", selector: '[data-testid="host-switcher"] > div' }, { name: "host-badge", selector: ".sidebar__env-badge" }, { name: "host-name", selector: ".sidebar__env-host" }, { name: "host-meta", selector: '[data-testid="host-switcher"] > div > div:first-child > span:nth-child(3)' }, { name: "host-line", selector: ".sidebar__env-cwd" }, { name: "host-caret", selector: '[data-testid="host-switcher"] > span[aria-hidden="true"]' }, { name: "new-session-button", selector: 'button[data-testid^="new-session-"]', key: { self: !0, attr: "data-testid", strip: "new-session-" } }, { name: "new-session-icon", selector: 'button[data-testid^="new-session-"] > svg' }, { name: "new-session-label", selector: 'button[data-testid^="new-session-"]', textRange: !0 }, { name: "new-session-shortcut", selector: 'button[data-testid^="new-session-"] > span' }, { name: "overview", selector: '[data-testid="workspace-overview"]' }, { name: "overview-header", selector: '[data-testid="workspace-overview"] > div:first-child' }, { name: "overview-title", selector: '[data-testid="workspace-overview"] > div:first-child > div:first-child > span:first-child' }, { name: "needs-you-button", selector: '[data-testid="workspace-needs-you"]' }, { name: "organize-button", selector: '[data-testid="workspace-organize"]' }, { name: "organize-icon", selector: '[data-testid="workspace-organize"] > svg' }, { name: "add-project-button", selector: '[data-testid="workspace-add-project"]' }, { name: "add-project-icon", selector: '[data-testid="workspace-add-project"] > svg' }, { name: "add-project-label", selector: '[data-testid="workspace-add-project"]', textRange: !0 }, { name: "project-list", selector: '[data-testid="project-list"]' }, { name: "project", selector: ".workspace-project", key: { self: !0, attr: "data-testid", strip: "workspace-project-" } }, { name: "project-header", selector: ".workspace-project > div:first-child", key: { closest: ".workspace-project", attr: "data-testid", strip: "workspace-project-" } }, { name: "project-toggle", selector: '[data-testid^="project-toggle-"]', key: { self: !0, attr: "data-testid", strip: "project-toggle-" } }, { name: "project-chevron", selector: '[data-testid^="project-toggle-"] > svg:not([data-testid])', key: { closest: '[data-testid^="project-toggle-"]', attr: "data-testid", strip: "project-toggle-" } }, { name: "project-folder-icon", selector: '[data-testid="project-folder-icon"]', key: { closest: '[data-testid^="project-toggle-"]', attr: "data-testid", strip: "project-toggle-" } }, { name: "project-name", selector: '[data-testid^="project-toggle-"] strong', key: { closest: '[data-testid^="project-toggle-"]', attr: "data-testid", strip: "project-toggle-" } }, { name: "project-branch", selector: '[data-testid^="project-toggle-"] > span.whitespace-nowrap', key: { closest: '[data-testid^="project-toggle-"]', attr: "data-testid", strip: "project-toggle-" } }, { name: "project-dirty-mark", selector: '[data-testid^="project-toggle-"] > span[title="Uncommitted changes"]', key: { closest: '[data-testid^="project-toggle-"]', attr: "data-testid", strip: "project-toggle-" } }, { name: "project-rollup", selector: '[data-testid^="project-rollup-"]', key: { self: !0, attr: "data-testid", strip: "project-rollup-" } }, { name: "project-rollup-badge", selector: '[data-testid^="project-rollup-"] > span', key: { closest: '[data-testid^="project-rollup-"]', attr: "data-testid", strip: "project-rollup-" } }, { name: "project-menu-button", selector: '[data-testid^="workspace-project-menu-"]', key: { self: !0, attr: "data-testid", strip: "workspace-project-menu-" } }, { name: "project-add-button", selector: ".workspace-project > div:first-child .worktree-menu__btn", key: { closest: ".workspace-project", attr: "data-testid", strip: "workspace-project-" } }, { name: "project-workspaces", selector: ".workspace-project__workspaces", key: { closest: ".workspace-project", attr: "data-testid", strip: "workspace-project-" } }, { name: "workspace", selector: '[data-testid="workspace-tree-root"] [data-testid^="workspace-entry-"]', key: { self: !0, attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-button", selector: '[data-testid="workspace-tree-root"] button.workspace-entry__button', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-icon", selector: '[data-testid="workspace-tree-root"] [data-testid="workspace-checkout-icon"]', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-name", selector: '[data-testid="workspace-tree-root"] strong[title="Double-click to rename"]', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-branch", selector: '[data-testid="workspace-tree-root"] button.workspace-entry__button > span.items-baseline > span', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-dirty-mark", selector: '[data-testid="workspace-tree-root"] button.workspace-entry__button > span[title="Uncommitted changes"]', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-pinned-label", selector: '[data-testid="workspace-tree-root"] button.workspace-entry__button > span.shrink-0:not([title])', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "hidden-worktrees-button", selector: '[data-testid^="workspace-hidden-"]', key: { self: !0, attr: "data-testid", strip: "workspace-hidden-" } }, { name: "session-row", selector: 'div[class~="group/row"]', key: { find: 'button[data-testid^="workspace-session-"]:not([data-testid^="workspace-session-close-"])', attr: "data-testid", strip: "workspace-session-" } }, { name: "session-button", selector: 'button[data-testid^="workspace-session-"]:not([data-testid^="workspace-session-close-"])', key: { self: !0, attr: "data-testid", strip: "workspace-session-" } }, { name: "session-mark", selector: ".agent-mark", key: { closest: 'button[data-testid^="workspace-session-"]', attr: "data-testid", strip: "workspace-session-" } }, { name: "session-mark-icon", selector: ".agent-mark > span > *", key: { closest: 'button[data-testid^="workspace-session-"]', attr: "data-testid", strip: "workspace-session-" } }, { name: "session-title", selector: 'button[data-testid^="workspace-session-"] > span.whitespace-nowrap', key: { closest: 'button[data-testid^="workspace-session-"]', attr: "data-testid", strip: "workspace-session-" } }, { name: "status-row-title", selector: "button[data-session] span.truncate:not([data-testid])", key: { closest: 'button[data-testid^="workspace-session-"]', attr: "data-testid", strip: "workspace-session-" } }, { name: "status-row-detail", selector: '[data-testid="status-row-detail"]', key: { closest: 'button[data-testid^="workspace-session-"]', attr: "data-testid", strip: "workspace-session-" } }, { name: "session-state-badge", selector: '[data-testid^="session-state-"]', key: { self: !0, attr: "data-testid", strip: "session-state-" } }, { name: "session-menu-button", selector: '[data-testid^="session-menu-button-"]', key: { self: !0, attr: "data-testid", strip: "session-menu-button-" } }, { name: "session-fold-button", selector: '[data-testid^="session-fold-"]', key: { self: !0, attr: "data-testid", strip: "session-fold-" } }, { name: "session-elbow", selector: '[data-testid^="session-elbow-"]', key: { self: !0, attr: "data-testid", strip: "session-elbow-" } }, { name: "session-rollup", selector: '[data-testid^="session-rollup-"]', key: { self: !0, attr: "data-testid", strip: "session-rollup-" } }, { name: "chats", selector: '[data-testid="workspace-chats"]' }, { name: "chats-header", selector: '[data-testid="workspace-chats"] > div:first-child' }, { name: "chats-toggle", selector: '[data-testid="workspace-chats-collapse"]' }, { name: "chats-label", selector: '[data-testid="workspace-chats-collapse"]', textRange: !0 }, { name: "chats-chevron", selector: '[data-testid="workspace-chats-collapse"] > svg' }, { name: "chats-menu-button", selector: '[data-testid="workspace-chats-menu"]' }, { name: "chats-new-button", selector: '[data-testid="workspace-chats-new"]' }, { name: "chats-new-icon", selector: '[data-testid="workspace-chats-new"] > svg' }, { name: "status-view", selector: '[data-testid="workspace-status-view"]' }, { name: "status-section", selector: '[data-testid^="status-section-"]:not([data-testid^="status-section-title-"])', key: { self: !0, attr: "data-testid", strip: "status-section-" } }, { name: "status-heading", selector: '[data-testid^="status-section-title-"], [data-testid="status-no-sessions-title"]', key: { self: !0, attr: "data-testid" } }, { name: "status-heading-dot", selector: '[data-testid^="status-section-title-"] > span:first-child, [data-testid="status-no-sessions-title"] > span:first-child', key: { closest: '[data-testid^="status-section-title-"], [data-testid="status-no-sessions-title"]', attr: "data-testid" } }, { name: "status-heading-label", selector: '[data-testid^="status-section-title-"] > span:nth-child(2), [data-testid="status-no-sessions-title"] > span:nth-child(2)', key: { closest: '[data-testid^="status-section-title-"], [data-testid="status-no-sessions-title"]', attr: "data-testid" } }, { name: "status-heading-count", selector: '[data-testid^="status-section-title-"] > span[aria-label], [data-testid="status-no-sessions-title"] > span[aria-label]', key: { closest: '[data-testid^="status-section-title-"], [data-testid="status-no-sessions-title"]', attr: "data-testid" } }, { name: "status-heading-note", selector: '[data-testid^="status-section-title-"] > span.truncate, [data-testid="status-no-sessions-title"] > span.truncate', key: { closest: '[data-testid^="status-section-title-"], [data-testid="status-no-sessions-title"]', attr: "data-testid" } }, { name: "status-project", selector: 'div[data-testid^="status-project-"]', key: { self: !0, attr: "data-testid", strip: "status-project-" } }, { name: "status-project-header", selector: 'div[data-testid^="status-project-"] > div:first-child', key: { closest: 'div[data-testid^="status-project-"]', attr: "data-testid", strip: "status-project-" } }, { name: "status-project-icon", selector: 'div[data-testid^="status-project-"] > div:first-child > svg', key: { closest: 'div[data-testid^="status-project-"]', attr: "data-testid", strip: "status-project-" } }, { name: "status-project-title", selector: '[data-testid="status-project-title"]', key: { closest: 'div[data-testid^="status-project-"]', attr: "data-testid", strip: "status-project-" } }, { name: "status-empty-project", selector: '[data-testid^="status-empty-project-"]', key: { self: !0, attr: "data-testid", strip: "status-empty-project-" } }, { name: "status-empty-project-icon", selector: '[data-testid^="status-empty-project-"] > button:first-child > svg', key: { closest: '[data-testid^="status-empty-project-"]', attr: "data-testid", strip: "status-empty-project-" } }, { name: "status-empty-project-title", selector: '[data-testid^="status-empty-project-"] > button > span.whitespace-nowrap', key: { closest: '[data-testid^="status-empty-project-"]', attr: "data-testid", strip: "status-empty-project-" } }, { name: "settings-bar", selector: "aside.sidebar > div:last-child" }, { name: "settings-gear", selector: '[data-testid="settings-gear"]' }, { name: "settings-gear-icon", selector: '[data-testid="settings-gear"] > svg' }], tabs: [{ name: "tab-strip", selector: '[data-testid="tab-bar"]' }, { name: "tab-slot", selector: "[data-tab-entry]", key: { self: !0, attr: "data-tab-entry" } }, { name: "tab-separator", selector: '[data-testid="tab-separator"]', key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab", selector: "button.tab-bar__tab", key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-icon", selector: 'button.tab-bar__tab > span[aria-hidden="true"]', key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-icon-glyph", selector: 'button.tab-bar__tab > span[aria-hidden="true"] > *', key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-label", selector: "button.tab-bar__tab > span.truncate", key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-dirty", selector: 'button.tab-bar__tab > span[aria-label="unsaved changes"]', key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-close", selector: '[data-tab-entry] > button[aria-label^="Close"]', key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-close-glyph", selector: '[data-tab-entry] > button[aria-label^="Close"] > svg', key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-new", selector: '[data-testid="tab-new"]' }, { name: "tab-new-glyph", selector: '[data-testid="tab-new"] > svg' }], status: [{ name: "status-bar", selector: "footer.status-bar" }, { name: "status-location", selector: ".status-bar__location" }, { name: "status-dot", selector: ".status-bar__location > span:first-child" }, { name: "status-host", selector: '[data-testid="status-host"]' }, { name: "status-cwd", selector: ".status-item--cwd" }, { name: "status-branch", selector: ".status-bar__branch" }, { name: "status-branch-icon", selector: ".status-bar__branch > svg" }, { name: "status-branch-name", selector: ".status-bar__branch > span" }, { name: "status-details", selector: ".status-bar__details" }, { name: "zoom-indicator", selector: '[data-testid="zoom-indicator"]' }, { name: "status-detail", selector: ".status-bar__details > span" }, { name: "status-usage", selector: ".status-bar__usage" }, { name: "usage-summary", selector: '[data-testid="usage-summary"]' }, { name: "usage-unavailable", selector: '[data-testid="usage-summary"] > span:only-child' }, { name: "usage-account", selector: '[data-testid="usage-summary"] > span.flex' }, { name: "usage-account-name", selector: '[data-testid="usage-summary"] > span.flex > span:first-child' }, { name: "usage-window", selector: '[data-testid="usage-summary"] > span.flex > span:not(:first-child)' }, { name: "status-connection", selector: '[data-testid="status-connection"]' }, { name: "status-connection-glyph", selector: '[data-testid="status-connection"] > svg' }], navigator: [{ name: "navigator-scrim", selector: "body > div.fixed.inset-0" }, { name: "navigator-panel", selector: '[data-testid="navigator"]' }, { name: "navigator-input", selector: '[data-testid="navigator-input"]' }, { name: "navigator-chips", selector: '[data-testid="navigator"] > div:nth-child(2)' }, { name: "navigator-chip", selector: '[data-testid^="navigator-filter-"]', key: { self: !0, attr: "data-testid", strip: "navigator-filter-" } }, { name: "navigator-list", selector: '[data-testid="navigator"] > div:nth-child(3)' }, { name: "navigator-notice", selector: '[data-testid="navigator"] > div:nth-child(3) > p[role]' }, { name: "navigator-empty", selector: '[data-testid="navigator"] div.text-center' }, { name: "navigator-command", selector: '[data-testid^="navigator-command-"]', key: { self: !0, attr: "data-testid", strip: "navigator-command-" } }, { name: "navigator-command-title", selector: '[data-testid^="navigator-command-"] > span:first-child', key: { closest: '[data-testid^="navigator-command-"]', attr: "data-testid", strip: "navigator-command-" } }, { name: "navigator-command-detail", selector: '[data-testid^="navigator-command-"] > span:last-child', key: { closest: '[data-testid^="navigator-command-"]', attr: "data-testid", strip: "navigator-command-" } }, { name: "navigator-row", selector: '[data-testid^="navigator-row-"]', key: { self: !0, attr: "data-testid", strip: "navigator-row-" } }, { name: "navigator-row-dot", selector: '[data-testid^="navigator-row-"] > :first-child', key: { closest: '[data-testid^="navigator-row-"]', attr: "data-testid", strip: "navigator-row-" } }, { name: "navigator-row-title", selector: '[data-testid^="navigator-row-"] > span:nth-child(2)', key: { closest: '[data-testid^="navigator-row-"]', attr: "data-testid", strip: "navigator-row-" } }, { name: "navigator-row-detail", selector: '[data-testid^="navigator-row-"] > span:last-child', key: { closest: '[data-testid^="navigator-row-"]', attr: "data-testid", strip: "navigator-row-" } }, { name: "navigator-note", selector: '[data-testid="navigator"] > p:last-child' }], "pane-menu": [{ name: "pane-menu", selector: '[data-testid="pane-context-menu"]' }, { name: "pane-menu-item", selector: '[data-testid="pane-context-menu"] > button', key: { self: !0, attr: "data-testid", strip: "pane-menu-" } }, { name: "pane-menu-divider", selector: '[data-testid="pane-context-menu"] > div.h-px' }, { name: "pane-menu-rename-row", selector: '[data-testid="pane-context-menu"] > div.flex' }, { name: "pane-menu-rename-input", selector: '[data-testid="pane-menu-rename-input"]' }, { name: "pane-menu-rename-confirm", selector: '[data-testid="pane-menu-rename-confirm"]' }], confirm: [{ name: "confirm-scrim", selector: "body > div.fixed.inset-0" }, { name: "confirm-panel", selector: '[data-testid="confirm-dialog"]' }, { name: "confirm-message", selector: ".confirm-dialog__message" }, { name: "confirm-extra", selector: '[data-testid="confirm-dialog"] > :not(.confirm-dialog__message):not(div.flex)' }, { name: "confirm-buttons", selector: '[data-testid="confirm-dialog"] > div.flex' }, { name: "confirm-cancel", selector: '[data-testid="confirm-cancel"]' }, { name: "confirm-accept", selector: '[data-testid="confirm-accept"]' }], dialog: [{ name: "dialog-scrim", selector: "body > div.fixed.inset-0" }, { name: "dialog-panel", selector: '[data-testid="file-name-dialog"]' }, { name: "dialog-title", selector: '[data-testid="file-name-dialog"] > h2' }, { name: "dialog-input", selector: '[data-testid="file-name-input"]' }, { name: "dialog-hint", selector: '[data-testid="file-name-dialog"] > p:not([role])' }, { name: "dialog-error", selector: '[data-testid="file-name-dialog"] > p[role="alert"]' }, { name: "dialog-buttons", selector: '[data-testid="file-name-dialog"] > div.flex' }, { name: "dialog-cancel", selector: '[data-testid="file-name-dialog"] > div.flex > button:first-child' }, { name: "dialog-confirm", selector: '[data-testid="file-name-confirm"]' }], toast: [{ name: "toast-stack", selector: '[data-testid="toast"]' }, { name: "toast-card", selector: '[data-testid="toast"] .animate-toast-in' }, { name: "toast-open", selector: '[data-testid^="toast-"]:not([data-testid^="toast-dismiss-"])' }, { name: "toast-mark", selector: '[data-testid^="toast-"]:not([data-testid^="toast-dismiss-"]) > :first-child' }, { name: "toast-heading", selector: '[data-testid^="toast-"]:not([data-testid^="toast-dismiss-"]) > span.min-w-0 > span:first-child' }, { name: "toast-detail", selector: '[data-testid^="toast-"]:not([data-testid^="toast-dismiss-"]) > span.min-w-0 > span:nth-child(2)' }, { name: "toast-dismiss", selector: '[data-testid^="toast-dismiss-"]' }, { name: "toast-dismiss-glyph", selector: '[data-testid^="toast-dismiss-"] > svg' }], "pane-header": [{ name: "pane-header", selector: '[data-testid^="pane-header-"]', key: { self: !0, attr: "data-testid", strip: "pane-header-" } }, { name: "pane-header-icon", selector: '[data-testid^="pane-header-"] > span.shrink-0:not([data-testid])', key: { closest: '[data-testid^="pane-header-"]', attr: "data-testid", strip: "pane-header-" } }, { name: "pane-header-icon-glyph", selector: '[data-testid^="pane-header-"] > span.shrink-0:not([data-testid]) > *', key: { closest: '[data-testid^="pane-header-"]', attr: "data-testid", strip: "pane-header-" } }, { name: "pane-header-name", selector: '[data-testid^="pane-header-"] > span.truncate', key: { closest: '[data-testid^="pane-header-"]', attr: "data-testid", strip: "pane-header-" } }, { name: "pane-header-state", selector: '[data-testid^="pane-header-"] > span.flex[title]', key: { closest: '[data-testid^="pane-header-"]', attr: "data-testid", strip: "pane-header-" } }, { name: "pane-header-state-dot", selector: '[data-testid^="pane-header-"] > span.flex[title] > span.rounded-full', key: { closest: '[data-testid^="pane-header-"]', attr: "data-testid", strip: "pane-header-" } }, { name: "pane-header-state-word", selector: '[data-testid^="pane-header-"] > span.flex[title] > span.truncate', key: { closest: '[data-testid^="pane-header-"]', attr: "data-testid", strip: "pane-header-" } }, { name: "pane-controls", selector: '[data-testid^="tile-controls-"]', key: { self: !0, attr: "data-testid", strip: "tile-controls-" } }, { name: "pane-expand", selector: '[data-testid^="tile-expand-"]', key: { self: !0, attr: "data-testid", strip: "tile-expand-" } }, { name: "pane-expand-glyph", selector: '[data-testid^="tile-expand-"] > svg', key: { closest: '[data-testid^="tile-expand-"]', attr: "data-testid", strip: "tile-expand-" } }, { name: "pane-close", selector: '[data-testid^="tile-close-"]', key: { self: !0, attr: "data-testid", strip: "tile-close-" } }, { name: "pane-close-glyph", selector: '[data-testid^="tile-close-"] > svg', key: { closest: '[data-testid^="tile-close-"]', attr: "data-testid", strip: "tile-close-" } }, { name: "pane-corner", selector: "div.pointer-events-auto.absolute" }], "new-session": [{ name: "launcher", selector: ".new-session-popover" }, { name: "launcher-filter", selector: '[data-testid="new-tab-filter"]' }, { name: "launcher-list", selector: "#new-tab-launcher-list" }, { name: "launcher-option", selector: '[role="option"]', key: { self: !0, attr: "data-testid" } }, { name: "launcher-option-icon", selector: '[role="option"] > :first-child:not(span.flex-1):not(kbd)', key: { closest: '[role="option"]', attr: "data-testid" } }, { name: "launcher-option-label", selector: '[role="option"] > span.flex-1', key: { closest: '[role="option"]', attr: "data-testid" } }, { name: "launcher-option-key", selector: '[role="option"] > kbd', key: { closest: '[role="option"]', attr: "data-testid" } }, { name: "launcher-note", selector: ".new-session-popover p[role]" }, { name: "agent-select", selector: '[data-testid="new-session-popover-agent"]' }, { name: "agent-manage", selector: ".new-session-popover > div:first-child > button:not([data-testid])" }, { name: "project-option", selector: '[data-testid^="project-option-"]', key: { self: !0, attr: "data-testid", strip: "project-option-" } }, { name: "project-option-name", selector: '[data-testid^="project-option-"]', key: { closest: '[data-testid^="project-option-"]', attr: "data-testid", strip: "project-option-" }, textRange: !0 }, { name: "project-option-path", selector: '[data-testid^="project-option-"] > span', key: { closest: '[data-testid^="project-option-"]', attr: "data-testid", strip: "project-option-" } }], "tab-menu": [{ name: "tab-menu", selector: '[data-testid="tab-split-menu"]' }, { name: "tab-menu-item", selector: '[data-testid="tab-split-menu"] > button', key: { self: !0, attr: "data-testid" } }, { name: "tab-menu-show-beside", selector: '[data-testid="tab-menu-show-beside"]' }, { name: "tab-menu-beside-list", selector: '[data-testid="tab-split-menu"] [role="menu"]' }, { name: "tab-menu-beside-item", selector: '[data-testid="tab-split-menu"] [role="menu"] > button', key: { self: !0, attr: "data-testid" } }, { name: "tab-menu-item-label", selector: '[data-testid="tab-split-menu"] [role="menu"] > button > span.block', key: { closest: '[data-testid="tab-split-menu"] [role="menu"] > button', attr: "data-testid" } }, { name: "tab-menu-empty", selector: '[data-testid="tab-menu-empty"]' }, { name: "tab-menu-divider", selector: '[data-testid="tab-split-menu"] > div.h-px' }, { name: "tab-menu-rename-form", selector: '[data-testid="tab-split-menu"] > form' }, { name: "tab-menu-rename-input", selector: '[data-testid="tab-menu-rename-input"]' }, { name: "tab-menu-rename-save", selector: '[data-testid="tab-split-menu"] > form > button' }], select: [{ name: "select-field", selector: '[data-testid="select-demo"]' }, { name: "select-field-label", selector: '[data-testid="select-demo"] > span.truncate' }, { name: "select-chevron", selector: '[data-testid="select-demo"] > svg' }, { name: "select-list", selector: '[role="listbox"]' }, { name: "select-option", selector: '[role="listbox"] > [role="option"]', key: { self: !0, attr: "data-value" } }, { name: "select-option-label", selector: '[role="listbox"] > [role="option"] > span.truncate', key: { closest: '[role="option"]', attr: "data-value" } }, { name: "select-option-check", selector: '[role="listbox"] > [role="option"] > span[aria-hidden]', key: { closest: '[role="option"]', attr: "data-value" } }], "keybind-help": [{ name: "keybind-help-scrim", selector: "body > div.fixed.inset-0" }, { name: "keybind-help-panel", selector: '[data-testid="keybind-help"]' }, { name: "keybind-help-header", selector: '[data-testid="keybind-help"] > div:first-child' }, { name: "keybind-help-title", selector: '[data-testid="keybind-help"] h2' }, { name: "keybind-help-close", selector: '[aria-label="Close keybind help"]' }, { name: "keybind-help-close-glyph", selector: '[aria-label="Close keybind help"] > svg' }, { name: "keybind-help-search", selector: '[data-testid="keybind-help-search"]' }, { name: "keybind-help-list", selector: '[data-testid="keybind-help"] > div:last-child' }, { name: "keybind-help-empty", selector: '[data-testid="keybind-help"] div.text-center' }, { name: "keybind-help-group", selector: '[data-testid="keybind-help"] section' }, { name: "keybind-help-group-title", selector: '[data-testid="keybind-help"] section > h3' }, { name: "keybind-help-row", selector: '[data-testid="keybind-help"] li' }, { name: "keybind-help-keys", selector: '[data-testid="keybind-help"] li > kbd' }, { name: "keybind-help-description", selector: '[data-testid="keybind-help"] li > span' }], launcher: [{ name: "launcher-scrim", selector: "body > div.fixed.inset-0" }, { name: "launcher-panel", selector: '[data-testid="new-session-dialog"]' }, { name: "launcher-title", selector: '[data-testid="new-session-dialog"] > p' }, { name: "launcher-filter", selector: '[data-testid="new-session-filter"]' }, { name: "launcher-list", selector: "#new-session-list" }, { name: "launcher-row", selector: '[data-testid^="new-session-row-"]', key: { self: !0, attr: "data-testid", strip: "new-session-row-" } }, { name: "launcher-row-icon", selector: '[data-testid^="new-session-row-"] > :first-child:not(span):not(kbd)', key: { closest: '[data-testid^="new-session-row-"]', attr: "data-testid", strip: "new-session-row-" } }, { name: "launcher-row-label", selector: '[data-testid^="new-session-row-"] > span.shrink-0', key: { closest: '[data-testid^="new-session-row-"]', attr: "data-testid", strip: "new-session-row-" } }, { name: "launcher-row-detail", selector: '[data-testid^="new-session-row-"] > span.ml-auto', key: { closest: '[data-testid^="new-session-row-"]', attr: "data-testid", strip: "new-session-row-" } }, { name: "launcher-row-key", selector: '[data-testid^="new-session-row-"] > kbd', key: { closest: '[data-testid^="new-session-row-"]', attr: "data-testid", strip: "new-session-row-" } }, { name: "launcher-note", selector: "#new-session-list > p" }], "session-menu": [{ name: "tab-menu", selector: '[data-testid="tab-split-menu"]' }, { name: "tab-menu-item", selector: '[data-testid="tab-split-menu"] > button', key: { self: !0, attr: "data-testid" } }, { name: "tab-menu-show-beside", selector: '[data-testid="tab-menu-show-beside"]' }, { name: "tab-menu-beside-list", selector: '[data-testid="tab-split-menu"] [role="menu"]' }, { name: "tab-menu-beside-item", selector: '[data-testid="tab-split-menu"] [role="menu"] > button', key: { self: !0, attr: "data-testid" } }, { name: "tab-menu-item-label", selector: '[data-testid="tab-split-menu"] [role="menu"] > button > span.block', key: { closest: '[data-testid="tab-split-menu"] [role="menu"] > button', attr: "data-testid" } }, { name: "tab-menu-empty", selector: '[data-testid="tab-menu-empty"]' }, { name: "tab-menu-divider", selector: '[data-testid="tab-split-menu"] > div.h-px' }], "tab-drag": [{ name: "tab-drag-layer", selector: '[data-testid="tab-drag-layer"]' }, { name: "tab-drag-pane", selector: '[data-testid="tab-drag-layer"] > div.bg-surface-1\\/30' }, { name: "tab-drop-zone", selector: '[data-testid="tab-drop-zone"]', key: { self: !0, attr: "data-zone" } }, { name: "tab-drop-label", selector: '[data-testid="tab-drop-zone"] > span' }, { name: "tab-drag-ghost", selector: '[data-testid="tab-drag-ghost"]' }], start: [{ name: "start-panel", selector: '[data-testid="no-session-panel"], [data-testid="cli-start-panel"]' }, { name: "start-column", selector: '[data-testid$="-panel"] > div' }, { name: "start-logo", selector: '[data-testid="no-session-panel"] img' }, { name: "start-name", selector: '[data-testid$="-panel"] h1, [data-testid="no-session-panel"] h1, [data-testid="no-session-panel"] h2' }, { name: "start-hint", selector: '[data-testid$="-panel"] p' }, { name: "start-target", selector: '[data-testid="workspace-start-target"], [data-testid="cli-start-target"]' }, { name: "start-action", selector: '[data-testid="home-add-project"], [data-testid="no-session-create"], [data-testid^="workspace-start-"]:not([data-testid="workspace-start-target"]), [data-testid^="cli-start-agent-"]', key: { self: !0, attr: "data-testid" } }, { name: "start-status", selector: '[role="status"], [role="alert"]' }, { name: "start-status-action", selector: '[role="status"] > button, [role="alert"] > button' }, { name: "start-link", selector: '[data-testid$="-panel"] button.text-subtext-0' }, { name: "start-shortcut-row", selector: '[data-testid="no-session-panel"] dl > div' }, { name: "start-shortcut-label", selector: '[data-testid="no-session-panel"] dl dt' }, { name: "start-shortcut-key", selector: '[data-testid="no-session-panel"] dl kbd' }], "folder-browser": [{ name: "folder-browser", selector: '[data-testid="dir-browser"]' }, { name: "folder-browser-mode-toggle", selector: '[data-testid="dir-browser-mode-toggle"]' }, { name: "folder-browser-up", selector: '[data-testid="dir-browser-up"]' }, { name: "folder-browser-crumbs", selector: '[data-testid="dir-browser"] span.min-w-0.flex-1' }, { name: "folder-browser-crumb", selector: '[data-testid="dir-browser"] span.min-w-0.flex-1 button' }, { name: "folder-browser-filter", selector: '[data-testid="dir-browser-filter"]' }, { name: "folder-browser-list", selector: '[data-testid="dir-browser"] div.overflow-y-auto' }, { name: "folder-browser-entry", selector: '[data-testid^="dir-browser-entry-"]', key: { self: !0, attr: "data-testid", strip: "dir-browser-entry-" } }, { name: "folder-browser-entry-name", selector: '[data-testid^="dir-browser-entry-"] > span:first-child', key: { closest: '[data-testid^="dir-browser-entry-"]', attr: "data-testid", strip: "dir-browser-entry-" } }, { name: "folder-browser-git", selector: '[data-testid^="dir-browser-entry-"] > span:last-child:not(:first-child)', key: { closest: '[data-testid^="dir-browser-entry-"]', attr: "data-testid", strip: "dir-browser-entry-" } }, { name: "folder-browser-note", selector: '[data-testid="dir-browser"] div.overflow-y-auto > div' }, { name: "folder-browser-use", selector: '[data-testid="dir-browser-use"]' }, { name: "folder-browser-path-input", selector: '[data-testid="project-path-input"]' }], instructions: [{ name: "instructions-scrim", selector: "body > div.fixed.inset-0" }, { name: "instructions-panel", selector: '[data-testid="instructions-dialog"]' }, { name: "instructions-title", selector: '[data-testid="instructions-dialog"] > h2' }, { name: "instructions-intro", selector: '[data-testid="instructions-dialog"] > p' }, { name: "instructions-label", selector: '[data-testid="instructions-dialog"] > label > span:first-child' }, { name: "instructions-count", selector: '[data-testid="instructions-count"]' }, { name: "instructions-text", selector: '[data-testid="instructions-text"]' }, { name: "instructions-folders", selector: '[data-testid="instructions-folders"]' }, { name: "instructions-error", selector: '[data-testid="instructions-error"]' }, { name: "instructions-cancel", selector: '[data-testid="instructions-dialog"] > div.flex.justify-end > button:first-child' }, { name: "instructions-save", selector: '[data-testid="instructions-save"]' }], memory: [{ name: "memory-scrim", selector: "body > div.fixed.inset-0", key: { self: !0, attr: "data-testid" } }, { name: "memory-panel", selector: '[data-testid="memory-dialog"]' }, { name: "memory-title", selector: '[data-testid="memory-dialog"] > h2' }, { name: "memory-intro", selector: '[data-testid="memory-dialog"] > p' }, { name: "memory-caps", selector: '[data-testid="memory-caps"]' }, { name: "memory-new", selector: '[data-testid="memory-new"]' }, { name: "memory-enabled", selector: '[data-testid="memory-enabled"]' }, { name: "memory-enabled-label", selector: '[data-testid="memory-dialog"] > label.flex > span' }, { name: "memory-note", selector: '[data-testid="memory-dialog"] > span.text-subtext-0' }, { name: "memory-row", selector: '[data-testid^="memory-row-"]', key: { self: !0, attr: "data-testid", strip: "memory-row-" } }, { name: "memory-open", selector: '[data-testid^="memory-open-"]', key: { self: !0, attr: "data-testid", strip: "memory-open-" } }, { name: "memory-file-title", selector: '[data-testid^="memory-row-"] button > span:first-child', key: { closest: '[data-testid^="memory-row-"]', attr: "data-testid", strip: "memory-row-" } }, { name: "memory-file-summary", selector: '[data-testid^="memory-row-"] button > span.truncate', key: { closest: '[data-testid^="memory-row-"]', attr: "data-testid", strip: "memory-row-" } }, { name: "memory-file-meta", selector: '[data-testid^="memory-row-"] button > span:last-child', key: { closest: '[data-testid^="memory-row-"]', attr: "data-testid", strip: "memory-row-" } }, { name: "memory-delete", selector: '[data-testid^="memory-delete-"]', key: { self: !0, attr: "data-testid", strip: "memory-delete-" } }, { name: "memory-error", selector: '[data-testid="memory-error"]' }, { name: "memory-close", selector: '[data-testid="memory-dialog"] > div.flex.justify-end > button' }, { name: "memory-file-name", selector: '[data-testid="memory-file-name"]' }, { name: "memory-name", selector: '[data-testid="memory-name"]' }, { name: "memory-count", selector: '[data-testid="memory-count"]' }, { name: "memory-text", selector: '[data-testid="memory-text"]' }, { name: "memory-conflict", selector: '[data-testid="memory-conflict"]' }, { name: "memory-reload", selector: '[data-testid="memory-reload"]' }, { name: "memory-back", selector: '[data-testid="memory-back"]' }, { name: "memory-save", selector: '[data-testid="memory-save"]' }, { name: "memory-confirm", selector: '[data-testid="confirm-dialog"]' }, { name: "memory-confirm-message", selector: ".confirm-dialog__message" }], worktree: [{ name: "worktree-plus", selector: '[data-testid^="worktree-menu-"]' }, { name: "worktree-popover", selector: '[role="dialog"][aria-label="Git worktrees"]' }, { name: "worktree-heading", selector: '[role="dialog"][aria-label="Git worktrees"] > div:first-child > span:first-child' }, { name: "worktree-project", selector: '[role="dialog"][aria-label="Git worktrees"] > div:first-child > span:last-child' }, { name: "worktree-list", selector: '[role="dialog"][aria-label="Git worktrees"] > div.overflow-y-auto' }, { name: "worktree-note", selector: '[role="dialog"][aria-label="Git worktrees"] > div.overflow-y-auto > div:not(.worktree-menu__entry)' }, { name: "worktree-entry", selector: '[data-testid^="worktree-entry-"]', key: { self: !0, attr: "data-testid", strip: "worktree-entry-" } }, { name: "worktree-entry-branch", selector: ".worktree-menu__entry-branch", key: { closest: '[data-testid^="worktree-entry-"]', attr: "data-testid", strip: "worktree-entry-" } }, { name: "worktree-badge", selector: '[data-testid^="worktree-entry-"] .worktree-menu__entry-branch > span', key: { closest: '[data-testid^="worktree-entry-"]', attr: "data-testid", strip: "worktree-entry-" } }, { name: "worktree-entry-path", selector: ".worktree-menu__entry-path", key: { closest: '[data-testid^="worktree-entry-"]', attr: "data-testid", strip: "worktree-entry-" } }, { name: "worktree-open", selector: '[data-testid^="worktree-open-"]', key: { self: !0, attr: "data-testid", strip: "worktree-open-" } }, { name: "worktree-remove", selector: '[data-testid^="worktree-remove-"]', key: { self: !0, attr: "data-testid", strip: "worktree-remove-" } }, { name: "worktree-error", selector: '[data-testid="worktree-error"]' }, { name: "worktree-new", selector: '[data-testid="worktree-new"]' }, { name: "worktree-name-input", selector: '[data-testid="worktree-name-input"]' }, { name: "worktree-start-input", selector: '[data-testid="worktree-start-input"]' }, { name: "worktree-branch-input", selector: '[data-testid="worktree-branch-input"]' }, { name: "worktree-parent-select", selector: '[data-testid="worktree-parent-select"]' }, { name: "worktree-new-branch", selector: '[data-testid="worktree-new-branch"]' }, { name: "worktree-path-input", selector: '[data-testid="worktree-path-input"]' }, { name: "worktree-agent-select", selector: '[data-testid="worktree-agent-select"]' }, { name: "worktree-create-cancel", selector: '[data-testid="worktree-create-cancel"]' }, { name: "worktree-create-submit", selector: '[data-testid="worktree-create-submit"]' }, { name: "worktree-confirm", selector: '[data-testid="confirm-dialog"]' }, { name: "worktree-confirm-message", selector: ".confirm-dialog__message" }, { name: "worktree-confirm-accept", selector: '[data-testid="confirm-accept"]' }, { name: "worktree-confirm-cancel", selector: '[data-testid="confirm-cancel"]' }], "terminal-search": [{ name: "terminal-frame", selector: '[data-testid="persistent-agent-terminal"]' }, { name: "term-search", selector: '[data-testid="term-search"]' }, { name: "term-search-input", selector: '[data-testid="term-search-input"]' }, { name: "term-search-button", selector: '[data-testid="term-search"] > button', key: { self: !0, attr: "title" } }], "agent-control": [{ name: "terminal-frame", selector: '[data-testid="persistent-agent-terminal"]' }, { name: "agent-control-chip", selector: '[data-testid="agent-control-chip"]' }, { name: "agent-control-label", selector: '[data-testid="agent-control-chip"] > span' }, { name: "agent-control-button", selector: '[data-testid="agent-control-chip"] > button' }, { name: "agent-control-error", selector: ".terminal__cli-error" }, { name: "agent-control-ended", selector: ".terminal__exited", key: { self: !0, attr: "data-testid" } }, { name: "agent-control-ended-text", selector: ".terminal__exited-text" }, { name: "agent-control-ended-button", selector: ".terminal__exited-actions > button", key: { self: !0, attr: "data-testid" } }], "phone-size": [{ name: "terminal-frame", selector: '[data-testid="persistent-agent-terminal"]' }, { name: "phone-size-notice", selector: '[data-testid="phone-size-notice"]' }, { name: "phone-size-chip", selector: '[data-testid="phone-size-chip"]' }, { name: "phone-size-heading", selector: '[data-testid="phone-size-notice"] span.font-semibold' }, { name: "phone-size-text", selector: '[data-testid="phone-size-notice"] span:not(.font-semibold)' }, { name: "phone-size-fold", selector: '[aria-label="Keep phone size and hide this"]' }, { name: "phone-size-button", selector: '[data-testid="phone-size-notice"] div.flex.flex-wrap > button, [data-testid="phone-size-chip"] > button' }], window: [{ name: "sidebar-card", selector: '[data-testid="sidebar-card"]' }, { name: "main-card", selector: '[data-testid="main-card"]' }, { name: "tools-card", selector: '[data-testid="tools-card"]' }, { name: "sidebar-toggle", selector: '[data-testid="sidebar-collapse-toggle"]' }, { name: "drawer-toggle", selector: '[data-testid="workspace-tools-toggle"]' }, { name: "resize-sidebar", selector: '[data-testid="resize-sidebar"]' }, { name: "resize-tools", selector: '[data-testid="resize-tools"]' }, { name: "tools-tab", selector: 'nav[aria-label="Files, Git and Browser"] > button' }, { name: "status-bar", selector: "footer.status-bar" }], settings: [{ name: "settings-modal", selector: '[data-testid="settings-modal"]' }, { name: "settings-nav-card", selector: '[data-testid="settings-modal"] > nav' }, { name: "settings-close", selector: '[data-testid="settings-close"]' }, { name: "settings-nav", selector: 'nav [data-testid^="settings-nav-"]', key: { self: !0, attr: "data-testid", strip: "settings-nav-" } }, { name: "settings-main-card", selector: '[data-testid="settings-modal"] > main' }, { name: "settings-search", selector: '[data-testid="settings-search"]' }, { name: "settings-title", selector: '[data-testid="settings-modal"] > main h1' }, { name: "settings-body", selector: '[data-testid="settings-modal"] .settings-modal__body' }, { name: "settings-group-title", selector: '[data-testid="settings-modal"] > main h3' }, { name: "settings-group-card", selector: '[data-testid="settings-modal"] > main section > div.rounded-ui' }, { name: "settings-row", selector: '[data-testid="settings-modal"] [data-setting-row]' }, { name: "settings-row-title", selector: '[data-testid="settings-modal"] [data-setting-row] > div:first-child > div:first-child' }, { name: "settings-row-description", selector: '[data-testid="settings-modal"] [data-setting-row] > div:first-child > div:nth-child(2)' }, { name: "settings-result-title", selector: '[data-testid^="settings-result-"] > h2' }] };
export {
  hy as NAMED_ELEMENTS,
  m0 as React,
  L0 as SCHEMA,
  my as STYLE_KEYS,
  py as describeToGpui,
  cy as jsxRuntime,
  uy as mount,
  dy as reactDom,
  fy as sdk
};
