function hs(n, l) {
  for (var s = 0; s < l.length; s++) {
    const r = l[s];
    if (typeof r != "string" && !Array.isArray(r)) {
      for (const o in r)
        if (o !== "default" && !(o in n)) {
          const f = Object.getOwnPropertyDescriptor(r, o);
          f && Object.defineProperty(n, o, f.get ? f : {
            enumerable: !0,
            get: () => r[o]
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
const Lh = /* @__PURE__ */ new Set(["hover", "focus", "focus-visible", "focus-within", "active", "disabled", "enabled", "checked"]), Xh = /* @__PURE__ */ new Set(["not", "is", "where", "has", "nth-child"]), Zh = /* @__PURE__ */ new Set(["first-child", "last-child", "only-child", "root", ...Lh]);
function Po(n) {
  return n.replace(/\\(?:([0-9a-fA-F]{1,6})\s?|([\s\S]))/g, (l, s, r) => s ? String.fromCodePoint(parseInt(s, 16)) : r);
}
function vl(n, l) {
  let s = l;
  for (; s < n.length; ) {
    const r = n[s];
    if (r === "\\") {
      s += 2;
      continue;
    }
    if (/[A-Za-z0-9_\- -￿]/.test(r)) {
      s++;
      continue;
    }
    break;
  }
  if (s === l) throw new le(`expected a name at ${l} in ${JSON.stringify(n)}`);
  return [Po(n.slice(l, s)), s];
}
function Jh(n, l) {
  let s = 1;
  for (let r = l; r < n.length; r++) {
    const o = n[r];
    if (o === "\\") {
      r++;
      continue;
    }
    if (o === '"' || o === "'") {
      if (r = n.indexOf(o, r + 1), r < 0) break;
      continue;
    }
    if (o === "(") s++;
    else if (o === ")" && --s === 0) return r;
  }
  throw new le(`unbalanced parenthesis in ${JSON.stringify(n)}`);
}
function gs(n) {
  const l = [];
  let s = 0, r = 0;
  for (let o = 0; o < n.length; o++) {
    const f = n[o];
    if (f === "\\") {
      o++;
      continue;
    }
    if (f === '"' || f === "'") {
      if (o = n.indexOf(f, o + 1), o < 0) break;
      continue;
    }
    f === "(" || f === "[" ? s++ : f === ")" || f === "]" ? s-- : f === "," && s === 0 && (l.push(n.slice(r, o).trim()), r = o + 1);
  }
  return l.push(n.slice(r).trim()), l.filter(Boolean);
}
function Wh(n, l) {
  const s = { tag: null, id: null, classes: [], attrs: [], pseudos: [], pseudoElement: null };
  let r = !1;
  for (; l < n.length; ) {
    const o = n[l];
    if (o === "*") {
      s.tag = "*", l++, r = !0;
      continue;
    }
    if (o === ".") {
      const [f, m] = vl(n, l + 1);
      s.classes.push(f), l = m, r = !0;
      continue;
    }
    if (o === "#") {
      const [f, m] = vl(n, l + 1);
      s.id = f, l = m, r = !0;
      continue;
    }
    if (o === "[") {
      const f = n.indexOf("]", l);
      if (f < 0) throw new le(`unclosed [ in ${JSON.stringify(n)}`);
      const m = n.slice(l + 1, f).trim(), d = /^([^\s~^$*|=]+)\s*(?:([~^$*|]?=)\s*(?:"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'|([^\s"'\]]+)))?\s*(i)?$/.exec(m);
      if (!d) throw new le(`cannot read the attribute selector [${m}]`);
      const p = d[3] ?? d[4] ?? d[5];
      s.attrs.push({ name: Po(d[1]).toLowerCase(), op: d[2] ?? null, value: p === void 0 ? null : Po(p) }), l = f + 1, r = !0;
      continue;
    }
    if (o === ":") {
      if (n[l + 1] === ":") {
        const [p, x] = vl(n, l + 2), k = p.toLowerCase();
        if (k !== "before" && k !== "after") throw new le(`::${k} is not supported`);
        if (s.pseudoElement = k, l = x, r = !0, l < n.length && !/[\s>]/.test(n[l])) throw new le(`nothing may follow ::${k} in ${JSON.stringify(n)}`);
        break;
      }
      const [f, m] = vl(n, l + 1);
      l = m;
      const d = f.toLowerCase();
      if ((d === "before" || d === "after") && n[l] !== "(") {
        if (s.pseudoElement = d, r = !0, l < n.length && !/[\s>]/.test(n[l])) throw new le(`nothing may follow :${d} in ${JSON.stringify(n)}`);
        break;
      }
      if (n[l] === "(") {
        if (!Xh.has(d)) throw new le(`:${d}() is not supported`);
        const p = Jh(n, l + 1), x = n.slice(l + 1, p).trim();
        if (l = p + 1, d === "nth-child") {
          if (!/^\d+$/.test(x)) throw new le(`:nth-child(${x}) is not supported (only a number)`);
          s.pseudos.push({ name: d, n: Number(x) });
        } else {
          const k = gs(x).map(bs);
          if (d === "has" && k.some((S) => S.length !== 1)) throw new le(`:has(${x}) is not supported (only a compound selector)`);
          s.pseudos.push({ name: d, list: k });
        }
      } else {
        if (!Zh.has(d)) throw new le(`:${d} is not supported`);
        s.pseudos.push({ name: d });
      }
      r = !0;
      continue;
    }
    if (/[A-Za-z_\-\\]/.test(o) && !r) {
      const [f, m] = vl(n, l);
      s.tag = f.toLowerCase(), l = m, r = !0;
      continue;
    }
    break;
  }
  if (!r) throw new le(`empty compound selector at ${l} in ${JSON.stringify(n)}`);
  return [s, l];
}
function bs(n) {
  const l = [];
  let s = 0, r = null;
  for (n = n.trim(); s < n.length; ) {
    const [o, f] = Wh(n, s);
    if (l.at(-1)?.compound.pseudoElement) throw new le(`::${l.at(-1).compound.pseudoElement} must end ${JSON.stringify(n)}`);
    l.push({ compound: o, combinator: r }), s = f;
    let m = !1;
    for (; n[s] === " " || n[s] === `
` || n[s] === "	"; )
      s++, m = !0;
    if (s >= n.length) break;
    const d = n[s];
    if (d === ">")
      for (r = ">", s++; n[s] === " "; ) s++;
    else {
      if (d === "+" || d === "~") throw new le(`the ${d} combinator is not supported`);
      if (m) r = " ";
      else throw new le(`unexpected ${JSON.stringify(d)} in ${JSON.stringify(n)}`);
    }
  }
  if (!l.length) throw new le("empty selector");
  return l;
}
const kd = /* @__PURE__ */ new Map();
function Pi(n) {
  let l = kd.get(n);
  return l || (l = gs(n).map(bs), kd.set(n, l)), l;
}
function bf(n) {
  const l = [0, 0, 0], s = (r) => {
    l[0] += r[0], l[1] += r[1], l[2] += r[2];
  };
  for (const { compound: r } of n) {
    r.id && l[0]++, l[1] += r.classes.length + r.attrs.length, r.tag && r.tag !== "*" && l[2]++, r.pseudoElement && l[2]++;
    for (const o of r.pseudos)
      if (o.name !== "where")
        if (o.list) {
          const f = o.list.map(bf).sort((m, d) => d[0] - m[0] || d[1] - m[1] || d[2] - m[2])[0];
          s(f);
        } else l[1]++;
  }
  return l;
}
function Fh(n, { name: l, op: s, value: r }) {
  const o = n.getAttribute(l);
  if (o == null) return !1;
  if (s === null) return !0;
  switch (s) {
    case "=":
      return o === r;
    case "^=":
      return r !== "" && o.startsWith(r);
    case "$=":
      return r !== "" && o.endsWith(r);
    case "*=":
      return r !== "" && o.includes(r);
    case "~=":
      return o.split(/\s+/).includes(r);
    case "|=":
      return o === r || o.startsWith(`${r}-`);
    default:
      return !1;
  }
}
function Ti(n) {
  return n.parentElement ? n.parentElement.children : [n];
}
function vf(n, l) {
  for (const s of n.children) if (l(s) || vf(s, l)) return !0;
  return !1;
}
function yf(n, l, s, r) {
  if ((l.pseudoElement ?? null) !== (r ? s.pseudo ?? null : null) || l.tag && l.tag !== "*" && n.tagName !== l.tag || l.id && n.getAttribute("id") !== l.id) return !1;
  if (l.classes.length) {
    const o = n.classList ?? [];
    for (const f of l.classes) if (!o.includes(f)) return !1;
  }
  for (const o of l.attrs) if (!Fh(n, o)) return !1;
  for (const o of l.pseudos)
    switch (o.name) {
      case "first-child":
        if (Ti(n)[0] !== n) return !1;
        break;
      case "only-child":
        if (Ti(n).length !== 1) return !1;
        break;
      case "last-child": {
        const f = Ti(n);
        if (f[f.length - 1] !== n) return !1;
        break;
      }
      case "nth-child":
        if (Ti(n).indexOf(n) !== o.n - 1) return !1;
        break;
      case "root":
        if (!n.isDocumentRoot) return !1;
        break;
      case "not":
        if (o.list.some((f) => Ya(n, f, s, r))) return !1;
        break;
      case "has":
        if (n.watchesDescendants = !0, !o.list.some(([{ compound: f }]) => vf(n, (m) => yf(m, f, s, !1)))) return !1;
        break;
      case "is":
      case "where":
        if (!o.list.some((f) => Ya(n, f, s, r))) return !1;
        break;
      default:
        if (!s.state || !s.state(n, o.name, r)) return !1;
    }
  return !0;
}
function Ya(n, l, s, r = !0) {
  const o = (f, m, d) => {
    const { compound: p, combinator: x } = l[m];
    if (!yf(f, p, s, d)) return !1;
    if (m === 0) return !0;
    if (x === ">") return !!f.parentElement && o(f.parentElement, m - 1, !1);
    for (let k = f.parentElement; k; k = k.parentElement) if (o(k, m - 1, !1)) return !0;
    return !1;
  };
  return o(n, l.length - 1, r);
}
function Ih(n, l, s = {}) {
  return (typeof l == "string" ? Pi(l) : l).some((o) => Ya(n, o, s));
}
function xf(n, l, s = {}) {
  return Ya(n, l, s);
}
function El(n, l, s = {}) {
  const r = Pi(l), o = [], f = (m) => {
    for (const d of m.children)
      r.some((p) => Ya(d, p, s)) && o.push(d), f(d);
  };
  return f(n), o;
}
function wf(n, l, s = {}) {
  const r = Pi(l);
  for (let o = n; o; o = o.parentElement) if (r.some((f) => Ya(o, f, s))) return o;
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
class ts {
  constructor(l = 0, s = 0, r = 0, o = 0) {
    this.x = l, this.y = s, this.width = r, this.height = o;
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
  addEventListener(l, s, r) {
    const o = r === !0 || !!r?.capture;
    this.listeners.some((f) => f.type === l && f.listener === s && f.capture === o) || this.listeners.push({ type: l, listener: s, capture: o });
  }
  removeEventListener(l, s, r) {
    const o = r === !0 || !!r?.capture;
    this.listeners = this.listeners.filter((f) => !(f.type === l && f.listener === s && f.capture === o));
  }
}
class tr {
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
  constructor(l, s = {}, r = null) {
    super(), this.nodeType = 1, this.id = `n${$h++}`, this.tagName = l.toLowerCase(), this.props = s, this.childNodes = [], this.parentNode = null, this.ownerDocument = r, this.hidden = !1, this.state = { hover: !1, focus: !1, active: !1 }, this.bounds = null, this.version = 0;
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
    for (const [s, r] of Object.entries(this.props))
      s.startsWith("data-") && r != null && r !== !1 && (l[s.slice(5).replace(/-([a-z])/g, (o, f) => f.toUpperCase())] = String(r));
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
      const f = l.replace(/-([a-z])/g, (m, d) => d.toUpperCase());
      o = s[f];
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
    const r = this.childNodes.indexOf(s);
    return l.parentNode = this, r < 0 ? this.childNodes.push(l) : this.childNodes.splice(r, 0, l), this.touchWatchers(), l;
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
    return wf(this, l);
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
    const l = this, s = (m) => String(m).startsWith("--") ? String(m) : String(m).replace(/-([a-z])/g, (d, p) => p.toUpperCase()), r = (m) => {
      const d = l.props.style?.[m];
      return d == null || typeof d == "boolean" ? "" : typeof d == "number" && d !== 0 ? `${d}px` : String(d);
    }, o = (m) => l.inline && m in l.inline ? l.inline[m] : r(m), f = (m, d) => {
      const p = d == null ? "" : String(d);
      o(m) !== p && (l.inline ??= {}, p === r(m) ? delete l.inline[m] : l.inline[m] = p, l.touch(), l.ownerDocument?.restyled());
    };
    return this.styleView = new Proxy({}, {
      get: (m, d) => {
        if (typeof d == "string")
          return d === "setProperty" ? (p, x) => f(s(p), x) : d === "removeProperty" ? (p) => {
            const x = o(s(p));
            return f(s(p), ""), x;
          } : d === "getPropertyValue" ? (p) => o(s(p)) : o(d);
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
    return Sd(this);
  }
  /** `outerHTML` without the attributes named in `omit` (by their DOM names), as the web's drag strips its copy. */
  copyMarkup(l = []) {
    return Sd(this, l);
  }
}
const _f = Symbol("perch.stale-layout"), kf = 3;
let Ui = !1;
function Sf(n) {
  return () => {
    let l, s = !1;
    const r = (o) => {
      const f = Ui;
      Ui = o < kf;
      try {
        l = n();
      } catch (m) {
        const d = m?.[_f];
        if (!d) throw m;
        d.retries.push(() => {
          s || r(o + 1);
        });
      } finally {
        Ui = f;
      }
    };
    return r(0), () => {
      s = !0, typeof l == "function" && l();
    };
  };
}
const es = "perch-dom:", Ph = /* @__PURE__ */ new Set(["children", "key", "ref", "dangerouslySetInnerHTML"]), t0 = { class: "className", for: "htmlFor", tabindex: "tabIndex" };
function Sd(n, l = []) {
  const s = new Set(l.map((o) => t0[o] ?? o)), r = (o) => {
    if (!(o instanceof $t)) return { x: o.data, ...o.hidden ? { h: 1 } : {} };
    const f = {};
    for (const [m, d] of Object.entries(o.props))
      Ph.has(m) || s.has(m) || d == null || typeof d == "function" || typeof d == "symbol" || (f[m] = d);
    return { t: o.tagName, p: f, c: o.childNodes.map(r), ...o.hidden ? { h: 1 } : {} };
  };
  return es + JSON.stringify(r(n));
}
function e0(n, l) {
  if (typeof n != "string" || !n.startsWith(es)) return null;
  let s;
  try {
    s = JSON.parse(n.slice(es.length));
  } catch {
    return null;
  }
  const r = (f) => !!f && typeof f == "object" && !Array.isArray(f), o = (f) => {
    if (!r(f)) throw new Error("not a node");
    let m;
    if (typeof f.x == "string") m = new tr(f.x);
    else {
      if (typeof f.t != "string" || !/^[a-z][a-z0-9-]*$/i.test(f.t) || !r(f.p) || !Array.isArray(f.c)) throw new Error("not an element");
      m = new $t(f.t, f.p, l);
      for (const d of f.c) m.appendChild(o(d));
    }
    return m.hidden = f.h === 1, m;
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
function Ed(n) {
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
    const r = s(this.measureKey(l));
    if (Ui && (!r || this.stale?.())) throw { [_f]: this };
    return r ?? null;
  }
  /** An element's `style` was written: the tree is described again once the writing script is done. */
  restyled() {
    this.restyling || (this.restyling = !0, queueMicrotask(() => {
      this.restyling = !1, this.afterCommit?.();
    }));
  }
  focus(l) {
    this.activeElement && this.activeElement !== l && this.blur(this.activeElement), this.activeElement = l, l.state.focus = !0, l.state.pointerFocus = !1, Ed(l), this.perch?.focused?.(l);
  }
  blur(l) {
    l.state.focus = !1, Ed(l), this.activeElement === l && (this.activeElement = this.body);
  }
  querySelectorAll(l) {
    return El(this.documentElement, l);
  }
  querySelector(l) {
    return this.querySelectorAll(l)[0] ?? null;
  }
  /** The element whose `id` prop is `id` (React's `useId` ids are not selectors). */
  getElementById(l) {
    return El(this.documentElement, "*").find((s) => s.props?.id === l) ?? null;
  }
}
class i0 extends vs {
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
  setTimeout(l, s, ...r) {
    return globalThis.setTimeout(l, s, ...r);
  }
  clearTimeout(l) {
    return globalThis.clearTimeout(l);
  }
}
function Ef(n) {
  return {
    setTimeout: (l, s = 0, ...r) => n.setTimeout(() => l(...r), Math.max(0, Number(s) || 0)),
    clearTimeout: (l) => {
      l != null && n.clearTimeout(l);
    }
  };
}
const zd = Symbol.for("perch.react.globals");
function Je(n, l, s) {
  Object.defineProperty(n, l, { value: s, configurable: !0, writable: !0, enumerable: !1 });
}
function r0(n, l = globalThis) {
  const s = new l0(n), r = new i0(n, s);
  s.defaultView = r;
  const o = n.storage ?? new a0();
  if (typeof l.setTimeout != "function") {
    if (typeof n.setTimeout != "function") throw new Error("the engine has no setTimeout and the perch host gives none (perch.setTimeout)");
    const d = Ef(n);
    Je(l, "setTimeout", d.setTimeout), Je(l, "clearTimeout", d.clearTimeout);
  }
  typeof l.queueMicrotask != "function" && Je(l, "queueMicrotask", (d) => {
    Promise.resolve().then(d);
  }), Je(l, "requestAnimationFrame", (d) => l.setTimeout(() => d(Date.now()), 0)), Je(l, "cancelAnimationFrame", (d) => l.clearTimeout(d));
  const f = { document: s, window: r, localStorage: o, HTMLElement: $t, Element: $t };
  for (const d of Object.keys(f))
    Object.defineProperty(l, d, { get: () => l[zd]?.[d], configurable: !0, enumerable: !1 });
  l[zd] = f, Je(l, "DOMRect", ts), Je(l, "getComputedStyle", o0), typeof l.ResizeObserver != "function" && Je(l, "ResizeObserver", n0);
  const m = l.navigator && typeof l.navigator == "object" ? l.navigator : {};
  if (!m.clipboard && n.clipboard)
    try {
      Je(m, "clipboard", n.clipboard);
    } catch {
    }
  return l.navigator || Je(l, "navigator", m), { document: s, window: r, globals: f };
}
function o0(n) {
  const l = n?.ownerDocument?.computed?.(n) ?? {}, s = (r) => {
    const o = l[r];
    return typeof o == "string" || typeof o == "number" ? String(o) : "";
  };
  return new Proxy({}, {
    get: (r, o) => {
      if (typeof o == "string")
        return o === "getPropertyValue" ? (f) => s(String(f)) : s(o.replace(/[A-Z]/g, (f) => `-${f.toLowerCase()}`));
    }
  });
}
function ns(n, l = !1) {
  if (!(l ? n?.tagName === "input" && zf(n) : n?.tagName === "button" && !/^(button|reset)$/.test(String(n.props.type ?? "submit")) && !n.props.disabled)) return null;
  for (let r = n.parentElement; r; r = r.parentElement) if (r.tagName === "form") return r;
  return null;
}
const zf = (n) => n?.tagName === "textarea" || n?.tagName === "input" && /^(text|search|url|email|tel|password|number|)$/.test(String(n.props.type ?? ""));
//! Evaluated before anything else in the runtime bundle: React's scheduler reads `setTimeout` and `queueMicrotask`
//! once, when it loads, so an engine without them (QuickJS) gets the host's (`perch.setTimeout`) first.
const Nd = globalThis.perch;
if (typeof globalThis.setTimeout != "function" && typeof Nd?.setTimeout == "function") {
  const n = Ef(Nd);
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
    var s = function r() {
      return this instanceof r ? Reflect.construct(l, arguments, this.constructor) : l.apply(this, arguments);
    };
    s.prototype = l.prototype;
  } else s = {};
  return Object.defineProperty(s, "__esModule", { value: !0 }), Object.keys(n).forEach(function(r) {
    var o = Object.getOwnPropertyDescriptor(n, r);
    Object.defineProperty(s, r, o.get ? o : {
      enumerable: !0,
      get: function() {
        return n[r];
      }
    });
  }), s;
}
var Ko = { exports: {} }, pt = {};
/**
 * @license React
 * react.production.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var Td;
function c0() {
  if (Td) return pt;
  Td = 1;
  var n = Symbol.for("react.transitional.element"), l = Symbol.for("react.portal"), s = Symbol.for("react.fragment"), r = Symbol.for("react.strict_mode"), o = Symbol.for("react.profiler"), f = Symbol.for("react.consumer"), m = Symbol.for("react.context"), d = Symbol.for("react.forward_ref"), p = Symbol.for("react.suspense"), x = Symbol.for("react.memo"), k = Symbol.for("react.lazy"), S = Symbol.for("react.activity"), w = Symbol.iterator;
  function z(T) {
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
  }, y = Object.assign, N = {};
  function O(T, V, nt) {
    this.props = T, this.context = V, this.refs = N, this.updater = nt || _;
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
  function R() {
  }
  R.prototype = O.prototype;
  function A(T, V, nt) {
    this.props = T, this.context = V, this.refs = N, this.updater = nt || _;
  }
  var L = A.prototype = new R();
  L.constructor = A, y(L, O.prototype), L.isPureReactComponent = !0;
  var q = Array.isArray;
  function D() {
  }
  var g = { H: null, A: null, T: null, S: null }, v = Object.prototype.hasOwnProperty;
  function h(T, V, nt) {
    var ot = nt.ref;
    return {
      $$typeof: n,
      type: T,
      key: V,
      ref: ot !== void 0 ? ot : null,
      props: nt
    };
  }
  function E(T, V) {
    return h(T.type, V, T.props);
  }
  function M(T) {
    return typeof T == "object" && T !== null && T.$$typeof === n;
  }
  function B(T) {
    var V = { "=": "=0", ":": "=2" };
    return "$" + T.replace(/[=:]/g, function(nt) {
      return V[nt];
    });
  }
  var X = /\/+/g;
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
        switch (typeof T.status == "string" ? T.then(D, D) : (T.status = "pending", T.then(
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
  function Q(T, V, nt, ot, st) {
    var ct = typeof T;
    (ct === "undefined" || ct === "boolean") && (T = null);
    var St = !1;
    if (T === null) St = !0;
    else
      switch (ct) {
        case "bigint":
        case "string":
        case "number":
          St = !0;
          break;
        case "object":
          switch (T.$$typeof) {
            case n:
            case l:
              St = !0;
              break;
            case k:
              return St = T._init, Q(
                St(T._payload),
                V,
                nt,
                ot,
                st
              );
          }
      }
    if (St)
      return st = st(T), St = ot === "" ? "." + I(T, 0) : ot, q(st) ? (nt = "", St != null && (nt = St.replace(X, "$&/") + "/"), Q(st, V, nt, "", function(Kn) {
        return Kn;
      })) : st != null && (M(st) && (st = E(
        st,
        nt + (st.key == null || T && T.key === st.key ? "" : ("" + st.key).replace(
          X,
          "$&/"
        ) + "/") + St
      )), V.push(st)), 1;
    St = 0;
    var Jt = ot === "" ? "." : ot + ":";
    if (q(T))
      for (var ht = 0; ht < T.length; ht++)
        ot = T[ht], ct = Jt + I(ot, ht), St += Q(
          ot,
          V,
          nt,
          ct,
          st
        );
    else if (ht = z(T), typeof ht == "function")
      for (T = ht.call(T), ht = 0; !(ot = T.next()).done; )
        ot = ot.value, ct = Jt + I(ot, ht++), St += Q(
          ot,
          V,
          nt,
          ct,
          st
        );
    else if (ct === "object") {
      if (typeof T.then == "function")
        return Q(
          $(T),
          V,
          nt,
          ot,
          st
        );
      throw V = String(T), Error(
        "Objects are not valid as a React child (found: " + (V === "[object Object]" ? "object with keys {" + Object.keys(T).join(", ") + "}" : V) + "). If you meant to render a collection of children, use an array instead."
      );
    }
    return St;
  }
  function Z(T, V, nt) {
    if (T == null) return T;
    var ot = [], st = 0;
    return Q(T, ot, "", "", function(ct) {
      return V.call(nt, ct, st++);
    }), ot;
  }
  function P(T) {
    if (T._status === -1) {
      var V = T._result;
      V = V(), V.then(
        function(nt) {
          (T._status === 0 || T._status === -1) && (T._status = 1, T._result = nt);
        },
        function(nt) {
          (T._status === 0 || T._status === -1) && (T._status = 2, T._result = nt);
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
    forEach: function(T, V, nt) {
      Z(
        T,
        function() {
          V.apply(this, arguments);
        },
        nt
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
  return pt.Activity = S, pt.Children = K, pt.Component = O, pt.Fragment = s, pt.Profiler = o, pt.PureComponent = A, pt.StrictMode = r, pt.Suspense = p, pt.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE = g, pt.__COMPILER_RUNTIME = {
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
  }, pt.cloneElement = function(T, V, nt) {
    if (T == null)
      throw Error(
        "The argument must be a React element, but you passed " + T + "."
      );
    var ot = y({}, T.props), st = T.key;
    if (V != null)
      for (ct in V.key !== void 0 && (st = "" + V.key), V)
        !v.call(V, ct) || ct === "key" || ct === "__self" || ct === "__source" || ct === "ref" && V.ref === void 0 || (ot[ct] = V[ct]);
    var ct = arguments.length - 2;
    if (ct === 1) ot.children = nt;
    else if (1 < ct) {
      for (var St = Array(ct), Jt = 0; Jt < ct; Jt++)
        St[Jt] = arguments[Jt + 2];
      ot.children = St;
    }
    return h(T.type, st, ot);
  }, pt.createContext = function(T) {
    return T = {
      $$typeof: m,
      _currentValue: T,
      _currentValue2: T,
      _threadCount: 0,
      Provider: null,
      Consumer: null
    }, T.Provider = T, T.Consumer = {
      $$typeof: f,
      _context: T
    }, T;
  }, pt.createElement = function(T, V, nt) {
    var ot, st = {}, ct = null;
    if (V != null)
      for (ot in V.key !== void 0 && (ct = "" + V.key), V)
        v.call(V, ot) && ot !== "key" && ot !== "__self" && ot !== "__source" && (st[ot] = V[ot]);
    var St = arguments.length - 2;
    if (St === 1) st.children = nt;
    else if (1 < St) {
      for (var Jt = Array(St), ht = 0; ht < St; ht++)
        Jt[ht] = arguments[ht + 2];
      st.children = Jt;
    }
    if (T && T.defaultProps)
      for (ot in St = T.defaultProps, St)
        st[ot] === void 0 && (st[ot] = St[ot]);
    return h(T, ct, st);
  }, pt.createRef = function() {
    return { current: null };
  }, pt.forwardRef = function(T) {
    return { $$typeof: d, render: T };
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
    var V = g.T, nt = {};
    g.T = nt;
    try {
      var ot = T(), st = g.S;
      st !== null && st(nt, ot), typeof ot == "object" && ot !== null && typeof ot.then == "function" && ot.then(D, G);
    } catch (ct) {
      G(ct);
    } finally {
      V !== null && nt.types !== null && (V.types = nt.types), g.T = V;
    }
  }, pt.unstable_useCacheRefresh = function() {
    return g.H.useCacheRefresh();
  }, pt.use = function(T) {
    return g.H.use(T);
  }, pt.useActionState = function(T, V, nt) {
    return g.H.useActionState(T, V, nt);
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
  }, pt.useImperativeHandle = function(T, V, nt) {
    return g.H.useImperativeHandle(T, V, nt);
  }, pt.useInsertionEffect = function(T, V) {
    return g.H.useInsertionEffect(T, V);
  }, pt.useLayoutEffect = function(T, V) {
    return g.H.useLayoutEffect(T, V);
  }, pt.useMemo = function(T, V) {
    return g.H.useMemo(T, V);
  }, pt.useOptimistic = function(T, V) {
    return g.H.useOptimistic(T, V);
  }, pt.useReducer = function(T, V, nt) {
    return g.H.useReducer(T, V, nt);
  }, pt.useRef = function(T) {
    return g.H.useRef(T);
  }, pt.useState = function(T) {
    return g.H.useState(T);
  }, pt.useSyncExternalStore = function(T, V, nt) {
    return g.H.useSyncExternalStore(
      T,
      V,
      nt
    );
  }, pt.useTransition = function() {
    return g.H.useTransition();
  }, pt.version = "19.2.8", pt;
}
var Cd;
function u0() {
  return Cd || (Cd = 1, Ko.exports = c0()), Ko.exports;
}
var tt = u0();
const Nf = /* @__PURE__ */ ys(tt), d0 = /* @__PURE__ */ hs({
  __proto__: null,
  default: Nf
}, [tt]);
//! "react" as the runtime bundles it, for its own code, the stock screens and every screen's `react` import: React
//! itself, with `useEffect` and `useLayoutEffect` run through `measured` (`dom.mjs`), so an effect that measures a
//! box the engine has not laid out yet runs again once it has (layout readback).
const f0 = Nf ?? d0;
function Re(n, l) {
  return tt.useEffect(Sf(n), l);
}
function as(n, l) {
  return tt.useLayoutEffect(Sf(n), l);
}
const m0 = /* @__PURE__ */ hs({
  __proto__: null,
  default: f0,
  useEffect: Re,
  useLayoutEffect: as
}, [tt]);
var Qo = { exports: {} }, yl = {};
/**
 * @license React
 * react-jsx-runtime.production.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var Md;
function p0() {
  if (Md) return yl;
  Md = 1;
  var n = Symbol.for("react.transitional.element"), l = Symbol.for("react.fragment");
  function s(r, o, f) {
    var m = null;
    if (f !== void 0 && (m = "" + f), o.key !== void 0 && (m = "" + o.key), "key" in o) {
      f = {};
      for (var d in o)
        d !== "key" && (f[d] = o[d]);
    } else f = o;
    return o = f.ref, {
      $$typeof: n,
      type: r,
      key: m,
      ref: o !== void 0 ? o : null,
      props: f
    };
  }
  return yl.Fragment = l, yl.jsx = s, yl.jsxs = s, yl;
}
var Ad;
function h0() {
  return Ad || (Ad = 1, Qo.exports = p0()), Qo.exports;
}
var ft = h0();
const g0 = /* @__PURE__ */ ys(ft), xy = /* @__PURE__ */ hs({
  __proto__: null,
  default: g0
}, [ft]);
var Vo = { exports: {} }, Lo = { exports: {} };
const b0 = /* @__PURE__ */ s0(m0);
var Xo = { exports: {} }, Zo = {};
/**
 * @license React
 * scheduler.production.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var jd;
function v0() {
  return jd || (jd = 1, (function(n) {
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
    function r(Q) {
      if (Q.length === 0) return null;
      var Z = Q[0], P = Q.pop();
      if (P !== Z) {
        Q[0] = P;
        t: for (var G = 0, K = Q.length, T = K >>> 1; G < T; ) {
          var V = 2 * (G + 1) - 1, nt = Q[V], ot = V + 1, st = Q[ot];
          if (0 > o(nt, P))
            ot < K && 0 > o(st, nt) ? (Q[G] = st, Q[ot] = P, G = ot) : (Q[G] = nt, Q[V] = P, G = V);
          else if (ot < K && 0 > o(st, P))
            Q[G] = st, Q[ot] = P, G = ot;
          else break t;
        }
      }
      return Z;
    }
    function o(Q, Z) {
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
    var p = [], x = [], k = 1, S = null, w = 3, z = !1, _ = !1, y = !1, N = !1, O = typeof setTimeout == "function" ? setTimeout : null, R = typeof clearTimeout == "function" ? clearTimeout : null, A = typeof setImmediate < "u" ? setImmediate : null;
    function L(Q) {
      for (var Z = s(x); Z !== null; ) {
        if (Z.callback === null) r(x);
        else if (Z.startTime <= Q)
          r(x), Z.sortIndex = Z.expirationTime, l(p, Z);
        else break;
        Z = s(x);
      }
    }
    function q(Q) {
      if (y = !1, L(Q), !_)
        if (s(p) !== null)
          _ = !0, D || (D = !0, B());
        else {
          var Z = s(x);
          Z !== null && $(q, Z.startTime - Q);
        }
    }
    var D = !1, g = -1, v = 5, h = -1;
    function E() {
      return N ? !0 : !(n.unstable_now() - h < v);
    }
    function M() {
      if (N = !1, D) {
        var Q = n.unstable_now();
        h = Q;
        var Z = !0;
        try {
          t: {
            _ = !1, y && (y = !1, R(g), g = -1), z = !0;
            var P = w;
            try {
              e: {
                for (L(Q), S = s(p); S !== null && !(S.expirationTime > Q && E()); ) {
                  var G = S.callback;
                  if (typeof G == "function") {
                    S.callback = null, w = S.priorityLevel;
                    var K = G(
                      S.expirationTime <= Q
                    );
                    if (Q = n.unstable_now(), typeof K == "function") {
                      S.callback = K, L(Q), Z = !0;
                      break e;
                    }
                    S === s(p) && r(p), L(Q);
                  } else r(p);
                  S = s(p);
                }
                if (S !== null) Z = !0;
                else {
                  var T = s(x);
                  T !== null && $(
                    q,
                    T.startTime - Q
                  ), Z = !1;
                }
              }
              break t;
            } finally {
              S = null, w = P, z = !1;
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
        A(M);
      };
    else if (typeof MessageChannel < "u") {
      var X = new MessageChannel(), I = X.port2;
      X.port1.onmessage = M, B = function() {
        I.postMessage(null);
      };
    } else
      B = function() {
        O(M, 0);
      };
    function $(Q, Z) {
      g = O(function() {
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
      return w;
    }, n.unstable_next = function(Q) {
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
      var P = w;
      w = Q;
      try {
        return Z();
      } finally {
        w = P;
      }
    }, n.unstable_scheduleCallback = function(Q, Z, P) {
      var G = n.unstable_now();
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
      }, P > G ? (Q.sortIndex = P, l(x, Q), s(p) === null && Q === s(x) && (y ? (R(g), g = -1) : y = !0, $(q, P - G))) : (Q.sortIndex = K, l(p, Q), _ || z || (_ = !0, D || (D = !0, B()))), Q;
    }, n.unstable_shouldYield = E, n.unstable_wrapCallback = function(Q) {
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
  })(Zo)), Zo;
}
var Od;
function y0() {
  return Od || (Od = 1, Xo.exports = v0()), Xo.exports;
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
var Rd;
function x0() {
  return Rd || (Rd = 1, (function(n) {
    n.exports = function(l) {
      function s(t, e, a, i) {
        return new Fm(t, e, a, i);
      }
      function r() {
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
          throw Error(o(188));
      }
      function d(t) {
        var e = t.alternate;
        if (!e) {
          if (e = f(t), e === null) throw Error(o(188));
          return e !== t ? null : t;
        }
        for (var a = t, i = e; ; ) {
          var c = a.return;
          if (c === null) break;
          var u = c.alternate;
          if (u === null) {
            if (i = c.return, i !== null) {
              a = i;
              continue;
            }
            break;
          }
          if (c.child === u.child) {
            for (u = c.child; u; ) {
              if (u === a) return m(c), t;
              if (u === i) return m(c), e;
              u = u.sibling;
            }
            throw Error(o(188));
          }
          if (a.return !== i.return) a = c, i = u;
          else {
            for (var b = !1, C = c.child; C; ) {
              if (C === a) {
                b = !0, a = c, i = u;
                break;
              }
              if (C === i) {
                b = !0, i = c, a = u;
                break;
              }
              C = C.sibling;
            }
            if (!b) {
              for (C = u.child; C; ) {
                if (C === a) {
                  b = !0, a = u, i = c;
                  break;
                }
                if (C === i) {
                  b = !0, i = u, a = c;
                  break;
                }
                C = C.sibling;
              }
              if (!b) throw Error(o(189));
            }
          }
          if (a.alternate !== i) throw Error(o(190));
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
        return t === null || typeof t != "object" ? null : (t = Ku && t[Ku] || t["@@iterator"], typeof t == "function" ? t : null);
      }
      function S(t) {
        if (t == null) return null;
        if (typeof t == "function")
          return t.$$typeof === ep ? null : t.displayName || t.name || null;
        if (typeof t == "string") return t;
        switch (t) {
          case ya:
            return "Fragment";
          case oo:
            return "Profiler";
          case Yu:
            return "StrictMode";
          case co:
            return "Suspense";
          case uo:
            return "SuspenseList";
          case mo:
            return "Activity";
        }
        if (typeof t == "object")
          switch (t.$$typeof) {
            case va:
              return "Portal";
            case _n:
              return t.displayName || "Context";
            case Gu:
              return (t._context.displayName || "Context") + ".Consumer";
            case so:
              var e = t.render;
              return t = t.displayName, t || (t = e.displayName || e.name || "", t = t !== "" ? "ForwardRef(" + t + ")" : "ForwardRef"), t;
            case fo:
              return e = t.displayName || null, e !== null ? e : S(t.type) || "Memo";
            case kn:
              e = t._payload, t = t._init;
              try {
                return S(t(e));
              } catch {
              }
          }
        return null;
      }
      function w(t) {
        return { current: t };
      }
      function z(t) {
        0 > _a || (t.current = yo[_a], yo[_a] = null, _a--);
      }
      function _(t, e) {
        _a++, yo[_a] = t.current, t.current = e;
      }
      function y(t) {
        return t >>>= 0, t === 0 ? 32 : 31 - (Ch(t) / Mh | 0) | 0;
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
      function O(t, e, a) {
        var i = t.pendingLanes;
        if (i === 0) return 0;
        var c = 0, u = t.suspendedLanes, b = t.pingedLanes;
        t = t.warmLanes;
        var C = i & 134217727;
        return C !== 0 ? (i = C & ~u, i !== 0 ? c = N(i) : (b &= C, b !== 0 ? c = N(b) : a || (a = C & ~t, a !== 0 && (c = N(a))))) : (C = i & ~u, C !== 0 ? c = N(C) : b !== 0 ? c = N(b) : a || (a = i & ~t, a !== 0 && (c = N(a)))), c === 0 ? 0 : e !== 0 && e !== c && (e & u) === 0 && (u = c & -c, a = e & -e, u >= a || u === 32 && (a & 4194048) !== 0) ? e : c;
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
        var t = ci;
        return ci <<= 1, (ci & 62914560) === 0 && (ci = 4194304), t;
      }
      function q(t) {
        for (var e = [], a = 0; 31 > a; a++) e.push(t);
        return e;
      }
      function D(t, e) {
        t.pendingLanes |= e, e !== 268435456 && (t.suspendedLanes = 0, t.pingedLanes = 0, t.warmLanes = 0);
      }
      function g(t, e, a, i, c, u) {
        var b = t.pendingLanes;
        t.pendingLanes = a, t.suspendedLanes = 0, t.pingedLanes = 0, t.warmLanes = 0, t.expiredLanes &= a, t.entangledLanes &= a, t.errorRecoveryDisabledLanes &= a, t.shellSuspendCounter = 0;
        var C = t.entanglements, Y = t.expirationTimes, J = t.hiddenUpdates;
        for (a = b & ~a; 0 < a; ) {
          var et = 31 - xe(a), W = 1 << et;
          C[et] = 0, Y[et] = -1;
          var at = J[et];
          if (at !== null)
            for (J[et] = null, et = 0; et < at.length; et++) {
              var gt = at[et];
              gt !== null && (gt.lane &= -536870913);
            }
          a &= ~W;
        }
        i !== 0 && v(t, i, 0), u !== 0 && c === 0 && t.tag !== 0 && (t.suspendedLanes |= u & ~(b & ~e));
      }
      function v(t, e, a) {
        t.pendingLanes |= e, t.suspendedLanes &= ~e;
        var i = 31 - xe(e);
        t.entangledLanes |= e, t.entanglements[i] = t.entanglements[i] | 1073741824 | a & 261930;
      }
      function h(t, e) {
        var a = t.entangledLanes |= e;
        for (t = t.entanglements; a; ) {
          var i = 31 - xe(a), c = 1 << i;
          c & e | t[i] & e && (t[i] |= e), a &= ~c;
        }
      }
      function E(t, e) {
        var a = e & -e;
        return a = (a & 42) !== 0 ? 1 : M(a), (a & (t.suspendedLanes | e)) !== 0 ? 0 : a;
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
      function X(t) {
        if (typeof Dh == "function" && Bh(t), we && typeof we.setStrictMode == "function")
          try {
            we.setStrictMode(rl, t);
          } catch {
          }
      }
      function I(t, e) {
        return t === e && (t !== 0 || 1 / t === 1 / e) || t !== t && e !== e;
      }
      function $(t) {
        if (_o === void 0)
          try {
            throw Error();
          } catch (a) {
            var e = a.stack.trim().match(/\n( *(at )?)/);
            _o = e && e[1] || "", pd = -1 < a.stack.indexOf(`
    at`) ? " (<anonymous>)" : -1 < a.stack.indexOf("@") ? "@unknown:0:0" : "";
          }
        return `
` + _o + t + pd;
      }
      function Q(t, e) {
        if (!t || ko) return "";
        ko = !0;
        var a = Error.prepareStackTrace;
        Error.prepareStackTrace = void 0;
        try {
          var i = {
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
                      var at = gt;
                    }
                    Reflect.construct(t, [], W);
                  } else {
                    try {
                      W.call();
                    } catch (gt) {
                      at = gt;
                    }
                    t.call(W.prototype);
                  }
                } else {
                  try {
                    throw Error();
                  } catch (gt) {
                    at = gt;
                  }
                  (W = t()) && typeof W.catch == "function" && W.catch(function() {
                  });
                }
              } catch (gt) {
                if (gt && at && typeof gt.stack == "string")
                  return [gt.stack, at.stack];
              }
              return [null, null];
            }
          };
          i.DetermineComponentFrameRoot.displayName = "DetermineComponentFrameRoot";
          var c = Object.getOwnPropertyDescriptor(
            i.DetermineComponentFrameRoot,
            "name"
          );
          c && c.configurable && Object.defineProperty(
            i.DetermineComponentFrameRoot,
            "name",
            { value: "DetermineComponentFrameRoot" }
          );
          var u = i.DetermineComponentFrameRoot(), b = u[0], C = u[1];
          if (b && C) {
            var Y = b.split(`
`), J = C.split(`
`);
            for (c = i = 0; i < Y.length && !Y[i].includes("DetermineComponentFrameRoot"); )
              i++;
            for (; c < J.length && !J[c].includes(
              "DetermineComponentFrameRoot"
            ); )
              c++;
            if (i === Y.length || c === J.length)
              for (i = Y.length - 1, c = J.length - 1; 1 <= i && 0 <= c && Y[i] !== J[c]; )
                c--;
            for (; 1 <= i && 0 <= c; i--, c--)
              if (Y[i] !== J[c]) {
                if (i !== 1 || c !== 1)
                  do
                    if (i--, c--, 0 > c || Y[i] !== J[c]) {
                      var et = `
` + Y[i].replace(" at new ", " at ");
                      return t.displayName && et.includes("<anonymous>") && (et = et.replace("<anonymous>", t.displayName)), et;
                    }
                  while (1 <= i && 0 <= c);
                break;
              }
          }
        } finally {
          ko = !1, Error.prepareStackTrace = a;
        }
        return (a = t ? t.displayName || t.name : "") ? $(a) : "";
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
          var e = "", a = null;
          do
            e += Z(t, a), a = t, t = t.return;
          while (t);
          return e;
        } catch (i) {
          return `
Error generating stack: ` + i.message + `
` + i.stack;
        }
      }
      function G(t, e) {
        if (typeof t == "object" && t !== null) {
          var a = hd.get(t);
          return a !== void 0 ? a : (e = {
            value: t,
            source: e,
            stack: P(e)
          }, hd.set(t, e), e);
        }
        return {
          value: t,
          source: e,
          stack: P(e)
        };
      }
      function K(t, e) {
        Sa[Ea++] = ol, Sa[Ea++] = di, di = t, ol = e;
      }
      function T(t, e, a) {
        Te[Ce++] = Xe, Te[Ce++] = Ze, Te[Ce++] = Sn, Sn = t;
        var i = Xe;
        t = Ze;
        var c = 32 - xe(i) - 1;
        i &= ~(1 << c), a += 1;
        var u = 32 - xe(e) + c;
        if (30 < u) {
          var b = c - c % 5;
          u = (i & (1 << b) - 1).toString(32), i >>= b, c -= b, Xe = 1 << 32 - xe(e) + c | a << c | i, Ze = u + t;
        } else
          Xe = 1 << u | a << c | i, Ze = t;
      }
      function V(t) {
        t.return !== null && (K(t, 1), T(t, 1, 0));
      }
      function nt(t) {
        for (; t === di; )
          di = Sa[--Ea], Sa[Ea] = null, ol = Sa[--Ea], Sa[Ea] = null;
        for (; t === Sn; )
          Sn = Te[--Ce], Te[Ce] = null, Ze = Te[--Ce], Te[Ce] = null, Xe = Te[--Ce], Te[Ce] = null;
      }
      function ot(t, e) {
        Te[Ce++] = Xe, Te[Ce++] = Ze, Te[Ce++] = Sn, Xe = e.id, Ze = e.overflow, Sn = t;
      }
      function st(t, e) {
        _(En, e), _(sl, t), _(ee, null), t = lp(e), z(ee), _(ee, t);
      }
      function ct() {
        z(ee), z(sl), z(En);
      }
      function St(t) {
        t.memoizedState !== null && _(fi, t);
        var e = ee.current, a = ip(e, t.type);
        e !== a && (_(sl, t), _(ee, a));
      }
      function Jt(t) {
        sl.current === t && (z(ee), z(sl)), fi.current === t && (z(fi), an ? $n._currentValue = xa : $n._currentValue2 = xa);
      }
      function ht(t) {
        var e = Error(
          o(
            418,
            1 < arguments.length && arguments[1] !== void 0 && arguments[1] ? "text" : "HTML",
            ""
          )
        );
        throw Ka(G(e, t)), So;
      }
      function Kn(t, e) {
        if (!ce) throw Error(o(175));
        ih(
          t.stateNode,
          t.type,
          t.memoizedProps,
          e,
          t
        ) || ht(t, !0);
      }
      function Qn(t) {
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
      function De(t) {
        if (!ce || t !== ne) return !1;
        if (!kt) return Qn(t), kt = !0, !1;
        var e = t.tag;
        if (Lt ? e !== 3 && e !== 27 && (e !== 5 || ed(t.type) && !ri(t.type, t.memoizedProps)) && Ot && ht(t) : e !== 3 && (e !== 5 || ed(t.type) && !ri(t.type, t.memoizedProps)) && Ot && ht(t), Qn(t), e === 13) {
          if (!ce) throw Error(o(316));
          if (t = t.memoizedState, t = t !== null ? t.dehydrated : null, !t) throw Error(o(317));
          Ot = uh(t);
        } else if (e === 31) {
          if (t = t.memoizedState, t = t !== null ? t.dehydrated : null, !t) throw Error(o(317));
          Ot = ch(t);
        } else
          Ot = Lt && e === 27 ? Wp(
            t.type,
            Ot
          ) : ne ? td(t.stateNode) : null;
        return !0;
      }
      function Be() {
        ce && (Ot = ne = null, kt = !1);
      }
      function pn() {
        var t = zn;
        return t !== null && (ge === null ? ge = t : ge.push.apply(
          ge,
          t
        ), zn = null), t;
      }
      function Ka(t) {
        zn === null ? zn = [t] : zn.push(t);
      }
      function hn(t, e, a) {
        an ? (_(mi, e._currentValue), e._currentValue = a) : (_(mi, e._currentValue2), e._currentValue2 = a);
      }
      function Ie(t) {
        var e = mi.current;
        an ? t._currentValue = e : t._currentValue2 = e, z(mi);
      }
      function lr(t, e, a) {
        for (; t !== null; ) {
          var i = t.alternate;
          if ((t.childLanes & e) !== e ? (t.childLanes |= e, i !== null && (i.childLanes |= e)) : i !== null && (i.childLanes & e) !== e && (i.childLanes |= e), t === a) break;
          t = t.return;
        }
      }
      function ir(t, e, a, i) {
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
                  u.lanes |= a, C = u.alternate, C !== null && (C.lanes |= a), lr(
                    u.return,
                    a,
                    t
                  ), i || (b = null);
                  break t;
                }
              u = C.next;
            }
          } else if (c.tag === 18) {
            if (b = c.return, b === null) throw Error(o(341));
            b.lanes |= a, u = b.alternate, u !== null && (u.lanes |= a), lr(b, a, t), b = null;
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
      function fa(t, e, a, i) {
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
          } else if (c === fi.current) {
            if (b = c.alternate, b === null) throw Error(o(387));
            b.memoizedState.memoizedState !== c.memoizedState.memoizedState && (t !== null ? t.push($n) : t = [$n]);
          }
          c = c.return;
        }
        t !== null && ir(
          e,
          t,
          a,
          i
        ), e.flags |= 262144;
      }
      function Cl(t) {
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
      function Pt(t) {
        return Ts(Pn, t);
      }
      function Ml(t, e) {
        return Pn === null && Vn(t), Ts(t, e);
      }
      function Ts(t, e) {
        var a = an ? e._currentValue : e._currentValue2;
        if (e = { context: e, memoizedValue: a, next: null }, rn === null) {
          if (t === null) throw Error(o(308));
          rn = e, t.dependencies = { lanes: 0, firstContext: e }, t.flags |= 524288;
        } else rn = rn.next = e;
        return a;
      }
      function rr() {
        return {
          controller: new Uh(),
          data: /* @__PURE__ */ new Map(),
          refCount: 0
        };
      }
      function Qa(t) {
        t.refCount--, t.refCount === 0 && qh(Yh, function() {
          t.controller.abort();
        });
      }
      function Al() {
      }
      function Qe(t) {
        t !== za && t.next === null && (za === null ? pi = za = t : za = za.next = t), hi = !0, Eo || (Eo = !0, zm());
      }
      function ma(t, e) {
        if (!zo && hi) {
          zo = !0;
          do
            for (var a = !1, i = pi; i !== null; ) {
              if (t !== 0) {
                var c = i.pendingLanes;
                if (c === 0) var u = 0;
                else {
                  var b = i.suspendedLanes, C = i.pingedLanes;
                  u = (1 << 31 - xe(42 | t) + 1) - 1, u &= c & ~(b & ~C), u = u & 201326741 ? u & 201326741 | 1 : u ? u | 2 : 0;
                }
                u !== 0 && (a = !0, Os(i, u));
              } else
                u = _t, u = O(
                  i,
                  i === At ? u : 0,
                  i.cancelPendingCommit !== null || i.timeoutHandle !== In
                ), (u & 3) === 0 || R(i, u) || (a = !0, Os(i, u));
              i = i.next;
            }
          while (a);
          zo = !1;
        }
      }
      function Cs() {
        Ms();
      }
      function Ms() {
        hi = Eo = !1;
        var t = 0;
        ta !== 0 && pp() && (t = ta);
        for (var e = pe(), a = null, i = pi; i !== null; ) {
          var c = i.next, u = As(i, e);
          u === 0 ? (i.next = null, a === null ? pi = c : a.next = c, c === null && (za = a)) : (a = i, (t !== 0 || (u & 3) !== 0) && (hi = !0)), i = c;
        }
        Xt !== 0 && Xt !== 5 || ma(t), ta !== 0 && (ta = 0);
      }
      function As(t, e) {
        for (var a = t.suspendedLanes, i = t.pingedLanes, c = t.expirationTimes, u = t.pendingLanes & -62914561; 0 < u; ) {
          var b = 31 - xe(u), C = 1 << b, Y = c[b];
          Y === -1 ? ((C & a) === 0 || (C & i) !== 0) && (c[b] = A(C, e)) : Y <= e && (t.expiredLanes |= C), u &= ~C;
        }
        if (e = At, a = _t, a = O(
          t,
          t === e ? a : 0,
          t.cancelPendingCommit !== null || t.timeoutHandle !== In
        ), i = t.callbackNode, a === 0 || t === e && (Ct === 2 || Ct === 9) || t.cancelPendingCommit !== null)
          return i !== null && i !== null && xo(i), t.callbackNode = null, t.callbackPriority = 0;
        if ((a & 3) === 0 || R(t, a)) {
          if (e = a & -a, e === t.callbackPriority) return e;
          switch (i !== null && xo(i), B(a)) {
            case 2:
            case 8:
              a = Oh;
              break;
            case 32:
              a = wo;
              break;
            case 268435456:
              a = Rh;
              break;
            default:
              a = wo;
          }
          return i = js.bind(null, t), a = ui(a, i), t.callbackPriority = e, t.callbackNode = a, e;
        }
        return i !== null && i !== null && xo(i), t.callbackPriority = 2, t.callbackNode = null, 2;
      }
      function js(t, e) {
        if (Xt !== 0 && Xt !== 5)
          return t.callbackNode = null, t.callbackPriority = 0, null;
        var a = t.callbackNode;
        if (nl() && t.callbackNode !== a)
          return null;
        var i = _t;
        return i = O(
          t,
          t === At ? i : 0,
          t.cancelPendingCommit !== null || t.timeoutHandle !== In
        ), i === 0 ? null : (hu(t, i, e), As(t, pe()), t.callbackNode != null && t.callbackNode === a ? js.bind(null, t) : null);
      }
      function Os(t, e) {
        if (nl()) return null;
        hu(t, e, !0);
      }
      function zm() {
        wp ? _p(function() {
          (xt & 6) !== 0 ? ui(
            fd,
            Cs
          ) : Ms();
        }) : ui(
          fd,
          Cs
        );
      }
      function or() {
        if (ta === 0) {
          var t = Na;
          t === 0 && (t = oi, oi <<= 1, (oi & 261888) === 0 && (oi = 256)), ta = t;
        }
        return ta;
      }
      function Nm(t, e) {
        if (cl === null) {
          var a = cl = [];
          No = 0, Na = or(), Ta = {
            status: "pending",
            value: void 0,
            then: function(i) {
              a.push(i);
            }
          };
        }
        return No++, e.then(Rs, Rs), e;
      }
      function Rs() {
        if (--No === 0 && cl !== null) {
          Ta !== null && (Ta.status = "fulfilled");
          var t = cl;
          cl = null, Na = 0, Ta = null;
          for (var e = 0; e < t.length; e++) (0, t[e])();
        }
      }
      function Tm(t, e) {
        var a = [], i = {
          status: "pending",
          value: null,
          reason: null,
          then: function(c) {
            a.push(c);
          }
        };
        return t.then(
          function() {
            i.status = "fulfilled", i.value = e;
            for (var c = 0; c < a.length; c++) (0, a[c])(e);
          },
          function(c) {
            for (i.status = "rejected", i.reason = c, c = 0; c < a.length; c++)
              (0, a[c])(void 0);
          }
        ), i;
      }
      function sr() {
        var t = ea.current;
        return t !== null ? t : At.pooledCache;
      }
      function jl(t, e) {
        e === null ? _(ea, ea.current) : _(ea, e.pool);
      }
      function Ds() {
        var t = sr();
        return t === null ? null : {
          parent: an ? Rt._currentValue : Rt._currentValue2,
          pool: t
        };
      }
      function Ol(t, e) {
        if (_e(t, e)) return !0;
        if (typeof t != "object" || t === null || typeof e != "object" || e === null)
          return !1;
        var a = Object.keys(t), i = Object.keys(e);
        if (a.length !== i.length) return !1;
        for (i = 0; i < a.length; i++) {
          var c = a[i];
          if (!Hh.call(e, c) || !_e(t[c], e[c]))
            return !1;
        }
        return !0;
      }
      function Bs(t) {
        return t = t.status, t === "fulfilled" || t === "rejected";
      }
      function Hs(t, e, a) {
        switch (a = t[a], a === void 0 ? t.push(e) : a !== e && (e.then(Al, Al), e = a), e.status) {
          case "fulfilled":
            return e.value;
          case "rejected":
            throw t = e.reason, qs(t), t;
          default:
            if (typeof e.status == "string") e.then(Al, Al);
            else {
              if (t = At, t !== null && 100 < t.shellSuspendCounter)
                throw Error(o(482));
              t = e, t.status = "pending", t.then(
                function(i) {
                  if (e.status === "pending") {
                    var c = e;
                    c.status = "fulfilled", c.value = i;
                  }
                },
                function(i) {
                  if (e.status === "pending") {
                    var c = e;
                    c.status = "rejected", c.reason = i;
                  }
                }
              );
            }
            switch (e.status) {
              case "fulfilled":
                return e.value;
              case "rejected":
                throw t = e.reason, qs(t), t;
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
      function Us() {
        if (na === null) throw Error(o(459));
        var t = na;
        return na = null, t;
      }
      function qs(t) {
        if (t === Ca || t === gi)
          throw Error(o(483));
      }
      function Rl(t) {
        var e = ul;
        return ul += 1, Ma === null && (Ma = []), Hs(Ma, t, e);
      }
      function Va(t, e) {
        e = e.props.ref, t.ref = e !== void 0 ? e : null;
      }
      function Dl(t, e) {
        throw e.$$typeof === Pm ? Error(o(525)) : (t = Object.prototype.toString.call(e), Error(
          o(
            31,
            t === "[object Object]" ? "object with keys {" + Object.keys(e).join(", ") + "}" : t
          )
        ));
      }
      function Ys(t) {
        function e(H, j) {
          if (t) {
            var U = H.deletions;
            U === null ? (H.deletions = [j], H.flags |= 16) : U.push(j);
          }
        }
        function a(H, j) {
          if (!t) return null;
          for (; j !== null; )
            e(H, j), j = j.sibling;
          return null;
        }
        function i(H) {
          for (var j = /* @__PURE__ */ new Map(); H !== null; )
            H.key !== null ? j.set(H.key, H) : j.set(H.index, H), H = H.sibling;
          return j;
        }
        function c(H, j) {
          return H = nn(H, j), H.index = 0, H.sibling = null, H;
        }
        function u(H, j, U) {
          return H.index = U, t ? (U = H.alternate, U !== null ? (U = U.index, U < j ? (H.flags |= 67108866, j) : U) : (H.flags |= 67108866, j)) : (H.flags |= 1048576, j);
        }
        function b(H) {
          return t && H.alternate === null && (H.flags |= 67108866), H;
        }
        function C(H, j, U, F) {
          return j === null || j.tag !== 6 ? (j = ao(U, H.mode, F), j.return = H, j) : (j = c(j, U), j.return = H, j);
        }
        function Y(H, j, U, F) {
          var dt = U.type;
          return dt === ya ? et(
            H,
            j,
            U.props.children,
            F,
            U.key
          ) : j !== null && (j.elementType === dt || typeof dt == "object" && dt !== null && dt.$$typeof === kn && Ln(dt) === j.type) ? (j = c(j, U.props), Va(j, U), j.return = H, j) : (j = ai(
            U.type,
            U.key,
            U.props,
            null,
            H.mode,
            F
          ), Va(j, U), j.return = H, j);
        }
        function J(H, j, U, F) {
          return j === null || j.tag !== 4 || j.stateNode.containerInfo !== U.containerInfo || j.stateNode.implementation !== U.implementation ? (j = lo(U, H.mode, F), j.return = H, j) : (j = c(j, U.children || []), j.return = H, j);
        }
        function et(H, j, U, F, dt) {
          return j === null || j.tag !== 7 ? (j = Fn(
            U,
            H.mode,
            F,
            dt
          ), j.return = H, j) : (j = c(j, U), j.return = H, j);
        }
        function W(H, j, U) {
          if (typeof j == "string" && j !== "" || typeof j == "number" || typeof j == "bigint")
            return j = ao(
              "" + j,
              H.mode,
              U
            ), j.return = H, j;
          if (typeof j == "object" && j !== null) {
            switch (j.$$typeof) {
              case li:
                return U = ai(
                  j.type,
                  j.key,
                  j.props,
                  null,
                  H.mode,
                  U
                ), Va(U, j), U.return = H, U;
              case va:
                return j = lo(
                  j,
                  H.mode,
                  U
                ), j.return = H, j;
              case kn:
                return j = Ln(j), W(H, j, U);
            }
            if (ii(j) || k(j))
              return j = Fn(
                j,
                H.mode,
                U,
                null
              ), j.return = H, j;
            if (typeof j.then == "function")
              return W(H, Rl(j), U);
            if (j.$$typeof === _n)
              return W(
                H,
                Ml(H, j),
                U
              );
            Dl(H, j);
          }
          return null;
        }
        function at(H, j, U, F) {
          var dt = j !== null ? j.key : null;
          if (typeof U == "string" && U !== "" || typeof U == "number" || typeof U == "bigint")
            return dt !== null ? null : C(H, j, "" + U, F);
          if (typeof U == "object" && U !== null) {
            switch (U.$$typeof) {
              case li:
                return U.key === dt ? Y(H, j, U, F) : null;
              case va:
                return U.key === dt ? J(H, j, U, F) : null;
              case kn:
                return U = Ln(U), at(H, j, U, F);
            }
            if (ii(U) || k(U))
              return dt !== null ? null : et(H, j, U, F, null);
            if (typeof U.then == "function")
              return at(
                H,
                j,
                Rl(U),
                F
              );
            if (U.$$typeof === _n)
              return at(
                H,
                j,
                Ml(H, U),
                F
              );
            Dl(H, U);
          }
          return null;
        }
        function gt(H, j, U, F, dt) {
          if (typeof F == "string" && F !== "" || typeof F == "number" || typeof F == "bigint")
            return H = H.get(U) || null, C(j, H, "" + F, dt);
          if (typeof F == "object" && F !== null) {
            switch (F.$$typeof) {
              case li:
                return H = H.get(
                  F.key === null ? U : F.key
                ) || null, Y(j, H, F, dt);
              case va:
                return H = H.get(
                  F.key === null ? U : F.key
                ) || null, J(j, H, F, dt);
              case kn:
                return F = Ln(F), gt(
                  H,
                  j,
                  U,
                  F,
                  dt
                );
            }
            if (ii(F) || k(F))
              return H = H.get(U) || null, et(j, H, F, dt, null);
            if (typeof F.then == "function")
              return gt(
                H,
                j,
                U,
                Rl(F),
                dt
              );
            if (F.$$typeof === _n)
              return gt(
                H,
                j,
                U,
                Ml(j, F),
                dt
              );
            Dl(j, F);
          }
          return null;
        }
        function ae(H, j, U, F) {
          for (var dt = null, Dt = null, mt = j, Nt = j = 0, It = null; mt !== null && Nt < U.length; Nt++) {
            mt.index > Nt ? (It = mt, mt = null) : It = mt.sibling;
            var Tt = at(
              H,
              mt,
              U[Nt],
              F
            );
            if (Tt === null) {
              mt === null && (mt = It);
              break;
            }
            t && mt && Tt.alternate === null && e(H, mt), j = u(Tt, j, Nt), Dt === null ? dt = Tt : Dt.sibling = Tt, Dt = Tt, mt = It;
          }
          if (Nt === U.length)
            return a(H, mt), kt && K(H, Nt), dt;
          if (mt === null) {
            for (; Nt < U.length; Nt++)
              mt = W(H, U[Nt], F), mt !== null && (j = u(
                mt,
                j,
                Nt
              ), Dt === null ? dt = mt : Dt.sibling = mt, Dt = mt);
            return kt && K(H, Nt), dt;
          }
          for (mt = i(mt); Nt < U.length; Nt++)
            It = gt(
              mt,
              H,
              Nt,
              U[Nt],
              F
            ), It !== null && (t && It.alternate !== null && mt.delete(
              It.key === null ? Nt : It.key
            ), j = u(
              It,
              j,
              Nt
            ), Dt === null ? dt = It : Dt.sibling = It, Dt = It);
          return t && mt.forEach(function(jn) {
            return e(H, jn);
          }), kt && K(H, Nt), dt;
        }
        function bl(H, j, U, F) {
          if (U == null) throw Error(o(151));
          for (var dt = null, Dt = null, mt = j, Nt = j = 0, It = null, Tt = U.next(); mt !== null && !Tt.done; Nt++, Tt = U.next()) {
            mt.index > Nt ? (It = mt, mt = null) : It = mt.sibling;
            var jn = at(H, mt, Tt.value, F);
            if (jn === null) {
              mt === null && (mt = It);
              break;
            }
            t && mt && jn.alternate === null && e(H, mt), j = u(jn, j, Nt), Dt === null ? dt = jn : Dt.sibling = jn, Dt = jn, mt = It;
          }
          if (Tt.done)
            return a(H, mt), kt && K(H, Nt), dt;
          if (mt === null) {
            for (; !Tt.done; Nt++, Tt = U.next())
              Tt = W(H, Tt.value, F), Tt !== null && (j = u(
                Tt,
                j,
                Nt
              ), Dt === null ? dt = Tt : Dt.sibling = Tt, Dt = Tt);
            return kt && K(H, Nt), dt;
          }
          for (mt = i(mt); !Tt.done; Nt++, Tt = U.next())
            Tt = gt(
              mt,
              H,
              Nt,
              Tt.value,
              F
            ), Tt !== null && (t && Tt.alternate !== null && mt.delete(Tt.key === null ? Nt : Tt.key), j = u(Tt, j, Nt), Dt === null ? dt = Tt : Dt.sibling = Tt, Dt = Tt);
          return t && mt.forEach(function(Vh) {
            return e(H, Vh);
          }), kt && K(H, Nt), dt;
        }
        function ra(H, j, U, F) {
          if (typeof U == "object" && U !== null && U.type === ya && U.key === null && (U = U.props.children), typeof U == "object" && U !== null) {
            switch (U.$$typeof) {
              case li:
                t: {
                  for (var dt = U.key; j !== null; ) {
                    if (j.key === dt) {
                      if (dt = U.type, dt === ya) {
                        if (j.tag === 7) {
                          a(
                            H,
                            j.sibling
                          ), F = c(
                            j,
                            U.props.children
                          ), F.return = H, H = F;
                          break t;
                        }
                      } else if (j.elementType === dt || typeof dt == "object" && dt !== null && dt.$$typeof === kn && Ln(dt) === j.type) {
                        a(
                          H,
                          j.sibling
                        ), F = c(j, U.props), Va(F, U), F.return = H, H = F;
                        break t;
                      }
                      a(H, j);
                      break;
                    } else e(H, j);
                    j = j.sibling;
                  }
                  U.type === ya ? (F = Fn(
                    U.props.children,
                    H.mode,
                    F,
                    U.key
                  ), F.return = H, H = F) : (F = ai(
                    U.type,
                    U.key,
                    U.props,
                    null,
                    H.mode,
                    F
                  ), Va(F, U), F.return = H, H = F);
                }
                return b(H);
              case va:
                t: {
                  for (dt = U.key; j !== null; ) {
                    if (j.key === dt)
                      if (j.tag === 4 && j.stateNode.containerInfo === U.containerInfo && j.stateNode.implementation === U.implementation) {
                        a(
                          H,
                          j.sibling
                        ), F = c(
                          j,
                          U.children || []
                        ), F.return = H, H = F;
                        break t;
                      } else {
                        a(H, j);
                        break;
                      }
                    else e(H, j);
                    j = j.sibling;
                  }
                  F = lo(U, H.mode, F), F.return = H, H = F;
                }
                return b(H);
              case kn:
                return U = Ln(U), ra(
                  H,
                  j,
                  U,
                  F
                );
            }
            if (ii(U))
              return ae(
                H,
                j,
                U,
                F
              );
            if (k(U)) {
              if (dt = k(U), typeof dt != "function")
                throw Error(o(150));
              return U = dt.call(U), bl(
                H,
                j,
                U,
                F
              );
            }
            if (typeof U.then == "function")
              return ra(
                H,
                j,
                Rl(U),
                F
              );
            if (U.$$typeof === _n)
              return ra(
                H,
                j,
                Ml(H, U),
                F
              );
            Dl(H, U);
          }
          return typeof U == "string" && U !== "" || typeof U == "number" || typeof U == "bigint" ? (U = "" + U, j !== null && j.tag === 6 ? (a(H, j.sibling), F = c(j, U), F.return = H, H = F) : (a(H, j), F = ao(U, H.mode, F), F.return = H, H = F), b(H)) : a(H, j);
        }
        return function(H, j, U, F) {
          try {
            ul = 0;
            var dt = ra(
              H,
              j,
              U,
              F
            );
            return Ma = null, dt;
          } catch (mt) {
            if (mt === Ca || mt === gi) throw mt;
            var Dt = s(29, mt, null, H.mode);
            return Dt.lanes = F, Dt.return = H, Dt;
          } finally {
          }
        };
      }
      function Bl() {
        for (var t = Aa, e = Co = Aa = 0; e < t; ) {
          var a = Ae[e];
          Ae[e++] = null;
          var i = Ae[e];
          Ae[e++] = null;
          var c = Ae[e];
          Ae[e++] = null;
          var u = Ae[e];
          if (Ae[e++] = null, i !== null && c !== null) {
            var b = i.pending;
            b === null ? c.next = c : (c.next = b.next, b.next = c), i.pending = c;
          }
          u !== 0 && Gs(a, c, u);
        }
      }
      function Hl(t, e, a, i) {
        Ae[Aa++] = t, Ae[Aa++] = e, Ae[Aa++] = a, Ae[Aa++] = i, Co |= i, t.lanes |= i, t = t.alternate, t !== null && (t.lanes |= i);
      }
      function cr(t, e, a, i) {
        return Hl(t, e, a, i), Ul(t);
      }
      function Xn(t, e) {
        return Hl(t, null, null, e), Ul(t);
      }
      function Gs(t, e, a) {
        t.lanes |= a;
        var i = t.alternate;
        i !== null && (i.lanes |= a);
        for (var c = !1, u = t.return; u !== null; )
          u.childLanes |= a, i = u.alternate, i !== null && (i.childLanes |= a), u.tag === 22 && (t = u.stateNode, t === null || t._visibility & 1 || (c = !0)), t = u, u = u.return;
        return t.tag === 3 ? (u = t.stateNode, c && e !== null && (c = 31 - xe(a), t = u.hiddenUpdates, i = t[c], i === null ? t[c] = [e] : i.push(e), e.lane = a | 536870912), u) : null;
      }
      function Ul(t) {
        if (50 < gl)
          throw gl = 0, Go = null, Error(o(185));
        for (var e = t.return; e !== null; )
          t = e, e = t.return;
        return t.tag === 3 ? t.stateNode : null;
      }
      function ur(t) {
        t.updateQueue = {
          baseState: t.memoizedState,
          firstBaseUpdate: null,
          lastBaseUpdate: null,
          shared: { pending: null, lanes: 0, hiddenCallbacks: null },
          callbacks: null
        };
      }
      function dr(t, e) {
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
        var i = t.updateQueue;
        if (i === null) return null;
        if (i = i.shared, (xt & 2) !== 0) {
          var c = i.pending;
          return c === null ? e.next = e : (e.next = c.next, c.next = e), i.pending = e, e = Ul(t), Gs(t, null, a), e;
        }
        return Hl(t, i, e, a), Ul(t);
      }
      function La(t, e, a) {
        if (e = e.updateQueue, e !== null && (e = e.shared, (a & 4194048) !== 0)) {
          var i = e.lanes;
          i &= t.pendingLanes, a |= i, e.lanes = a, h(t, a);
        }
      }
      function fr(t, e) {
        var a = t.updateQueue, i = t.alternate;
        if (i !== null && (i = i.updateQueue, a === i)) {
          var c = null, u = null;
          if (a = a.firstBaseUpdate, a !== null) {
            do {
              var b = {
                lane: a.lane,
                tag: a.tag,
                payload: a.payload,
                callback: null,
                next: null
              };
              u === null ? c = u = b : u = u.next = b, a = a.next;
            } while (a !== null);
            u === null ? c = u = e : u = u.next = e;
          } else c = u = e;
          a = {
            baseState: i.baseState,
            firstBaseUpdate: c,
            lastBaseUpdate: u,
            shared: i.shared,
            callbacks: i.callbacks
          }, t.updateQueue = a;
          return;
        }
        t = a.lastBaseUpdate, t === null ? a.firstBaseUpdate = e : t.next = e, a.lastBaseUpdate = e;
      }
      function Xa() {
        if (Mo) {
          var t = Ta;
          if (t !== null) throw t;
        }
      }
      function Za(t, e, a, i) {
        Mo = !1;
        var c = t.updateQueue;
        Nn = !1;
        var u = c.firstBaseUpdate, b = c.lastBaseUpdate, C = c.shared.pending;
        if (C !== null) {
          c.shared.pending = null;
          var Y = C, J = Y.next;
          Y.next = null, b === null ? u = J : b.next = J, b = Y;
          var et = t.alternate;
          et !== null && (et = et.updateQueue, C = et.lastBaseUpdate, C !== b && (C === null ? et.firstBaseUpdate = J : C.next = J, et.lastBaseUpdate = Y));
        }
        if (u !== null) {
          var W = c.baseState;
          b = 0, et = J = Y = null, C = u;
          do {
            var at = C.lane & -536870913, gt = at !== C.lane;
            if (gt ? (_t & at) === at : (i & at) === at) {
              at !== 0 && at === Na && (Mo = !0), et !== null && (et = et.next = {
                lane: 0,
                tag: C.tag,
                payload: C.payload,
                callback: null,
                next: null
              });
              t: {
                var ae = t, bl = C;
                at = e;
                var ra = a;
                switch (bl.tag) {
                  case 1:
                    if (ae = bl.payload, typeof ae == "function") {
                      W = ae.call(
                        ra,
                        W,
                        at
                      );
                      break t;
                    }
                    W = ae;
                    break t;
                  case 3:
                    ae.flags = ae.flags & -65537 | 128;
                  case 0:
                    if (ae = bl.payload, at = typeof ae == "function" ? ae.call(ra, W, at) : ae, at == null) break t;
                    W = ro({}, W, at);
                    break t;
                  case 2:
                    Nn = !0;
                }
              }
              at = C.callback, at !== null && (t.flags |= 64, gt && (t.flags |= 8192), gt = c.callbacks, gt === null ? c.callbacks = [at] : gt.push(at));
            } else
              gt = {
                lane: at,
                tag: C.tag,
                payload: C.payload,
                callback: C.callback,
                next: null
              }, et === null ? (J = et = gt, Y = W) : et = et.next = gt, b |= at;
            if (C = C.next, C === null) {
              if (C = c.shared.pending, C === null)
                break;
              gt = C, C = gt.next, gt.next = null, c.lastBaseUpdate = gt, c.shared.pending = null;
            }
          } while (!0);
          et === null && (Y = W), c.baseState = Y, c.firstBaseUpdate = J, c.lastBaseUpdate = et, u === null && (c.shared.lanes = 0), Cn |= b, t.lanes = b, t.memoizedState = W;
        }
      }
      function Ks(t, e) {
        if (typeof t != "function")
          throw Error(o(191, t));
        t.call(e);
      }
      function Qs(t, e) {
        var a = t.callbacks;
        if (a !== null)
          for (t.callbacks = null, t = 0; t < a.length; t++)
            Ks(a[t], e);
      }
      function Vs(t, e) {
        t = cn, _(vi, t), _(ja, e), cn = t | e.baseLanes;
      }
      function mr() {
        _(vi, cn), _(ja, ja.current);
      }
      function pr() {
        cn = vi.current, z(ja), z(vi);
      }
      function vn(t) {
        var e = t.alternate;
        _(Yt, Yt.current & 1), _(ke, t), je === null && (e === null || ja.current !== null || e.memoizedState !== null) && (je = t);
      }
      function hr(t) {
        _(Yt, Yt.current), _(ke, t), je === null && (je = t);
      }
      function Ls(t) {
        t.tag === 22 ? (_(Yt, Yt.current), _(ke, t), je === null && (je = t)) : yn();
      }
      function yn() {
        _(Yt, Yt.current), _(ke, ke.current);
      }
      function be(t) {
        z(ke), je === t && (je = null), z(Yt);
      }
      function ql(t) {
        for (var e = t; e !== null; ) {
          if (e.tag === 13) {
            var a = e.memoizedState;
            if (a !== null && (a = a.dehydrated, a === null || go(a) || bo(a)))
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
      function gr(t, e) {
        if (e === null) return !1;
        for (var a = 0; a < e.length && a < t.length; a++)
          if (!_e(t[a], e[a])) return !1;
        return !0;
      }
      function br(t, e, a, i, c, u) {
        return on = u, bt = e, e.memoizedState = null, e.updateQueue = null, e.lanes = 0, ut.H = t === null || t.memoizedState === null ? vd : Ao, la = !1, u = a(i, c), la = !1, Oa && (u = Zs(
          e,
          a,
          i,
          c
        )), Xs(t), u;
      }
      function Xs(t) {
        ut.H = fl;
        var e = Mt !== null && Mt.next !== null;
        if (on = 0, Gt = Mt = bt = null, yi = !1, dl = 0, Ra = null, e) throw Error(o(300));
        t === null || Kt || (t = t.dependencies, t !== null && Cl(t) && (Kt = !0));
      }
      function Zs(t, e, a, i) {
        bt = t;
        var c = 0;
        do {
          if (Oa && (Ra = null), dl = 0, Oa = !1, 25 <= c) throw Error(o(301));
          if (c += 1, Gt = Mt = null, t.updateQueue != null) {
            var u = t.updateQueue;
            u.lastEffect = null, u.events = null, u.stores = null, u.memoCache != null && (u.memoCache.index = 0);
          }
          ut.H = yd, u = e(a, i);
        } while (Oa);
        return u;
      }
      function Cm() {
        var t = ut.H, e = t.useState()[0];
        return e = typeof e.then == "function" ? Ja(e) : e, t = t.useState()[0], (Mt !== null ? Mt.memoizedState : null) !== t && (bt.flags |= 1024), e;
      }
      function vr() {
        var t = xi !== 0;
        return xi = 0, t;
      }
      function yr(t, e, a) {
        e.updateQueue = t.updateQueue, e.flags &= -2053, t.lanes &= ~a;
      }
      function xr(t) {
        if (yi) {
          for (t = t.memoizedState; t !== null; ) {
            var e = t.queue;
            e !== null && (e.pending = null), t = t.next;
          }
          yi = !1;
        }
        on = 0, Gt = Mt = bt = null, Oa = !1, dl = xi = 0, Ra = null;
      }
      function de() {
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
            throw bt.alternate === null ? Error(o(467)) : Error(o(310));
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
      function Yl() {
        return { lastEffect: null, events: null, stores: null, memoCache: null };
      }
      function Ja(t) {
        var e = dl;
        return dl += 1, Ra === null && (Ra = []), t = Hs(Ra, t, e), e = bt, (Gt === null ? e.memoizedState : Gt.next) === null && (e = e.alternate, ut.H = e === null || e.memoizedState === null ? vd : Ao), t;
      }
      function Gl(t) {
        if (t !== null && typeof t == "object") {
          if (typeof t.then == "function") return Ja(t);
          if (t.$$typeof === _n) return Pt(t);
        }
        throw Error(o(438, String(t)));
      }
      function wr(t) {
        var e = null, a = bt.updateQueue;
        if (a !== null && (e = a.memoCache), e == null) {
          var i = bt.alternate;
          i !== null && (i = i.updateQueue, i !== null && (i = i.memoCache, i != null && (e = {
            data: i.data.map(function(c) {
              return c.slice();
            }),
            index: 0
          })));
        }
        if (e == null && (e = { data: [], index: 0 }), a === null && (a = Yl(), bt.updateQueue = a), a.memoCache = e, a = e.data[e.index], a === void 0)
          for (a = e.data[e.index] = Array(t), i = 0; i < t; i++)
            a[i] = tp;
        return e.index++, a;
      }
      function $e(t, e) {
        return typeof e == "function" ? e(t) : e;
      }
      function Kl(t) {
        var e = qt();
        return _r(e, Mt, t);
      }
      function _r(t, e, a) {
        var i = t.queue;
        if (i === null) throw Error(o(311));
        i.lastRenderedReducer = a;
        var c = t.baseQueue, u = i.pending;
        if (u !== null) {
          if (c !== null) {
            var b = c.next;
            c.next = u.next, u.next = b;
          }
          e.baseQueue = c = u, i.pending = null;
        }
        if (u = t.baseState, c === null) t.memoizedState = u;
        else {
          e = c.next;
          var C = b = null, Y = null, J = e, et = !1;
          do {
            var W = J.lane & -536870913;
            if (W !== J.lane ? (_t & W) === W : (on & W) === W) {
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
                }), W === Na && (et = !0);
              else if ((on & at) === at) {
                J = J.next, at === Na && (et = !0);
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
                }, Y === null ? (C = Y = W, b = u) : Y = Y.next = W, bt.lanes |= at, Cn |= at;
              W = J.action, la && a(u, W), u = J.hasEagerState ? J.eagerState : a(u, W);
            } else
              at = {
                lane: W,
                revertLane: J.revertLane,
                gesture: J.gesture,
                action: J.action,
                hasEagerState: J.hasEagerState,
                eagerState: J.eagerState,
                next: null
              }, Y === null ? (C = Y = at, b = u) : Y = Y.next = at, bt.lanes |= W, Cn |= W;
            J = J.next;
          } while (J !== null && J !== e);
          if (Y === null ? b = u : Y.next = C, !_e(u, t.memoizedState) && (Kt = !0, et && (a = Ta, a !== null)))
            throw a;
          t.memoizedState = u, t.baseState = b, t.baseQueue = Y, i.lastRenderedState = u;
        }
        return c === null && (i.lanes = 0), [t.memoizedState, i.dispatch];
      }
      function kr(t) {
        var e = qt(), a = e.queue;
        if (a === null) throw Error(o(311));
        a.lastRenderedReducer = t;
        var i = a.dispatch, c = a.pending, u = e.memoizedState;
        if (c !== null) {
          a.pending = null;
          var b = c = c.next;
          do
            u = t(u, b.action), b = b.next;
          while (b !== c);
          _e(u, e.memoizedState) || (Kt = !0), e.memoizedState = u, e.baseQueue === null && (e.baseState = u), a.lastRenderedState = u;
        }
        return [u, i];
      }
      function Js(t, e, a) {
        var i = bt, c = qt(), u = kt;
        if (u) {
          if (a === void 0)
            throw Error(o(407));
          a = a();
        } else a = e();
        var b = !_e(
          (Mt || c).memoizedState,
          a
        );
        if (b && (c.memoizedState = a, Kt = !0), c = c.queue, zr(Is.bind(null, i, c, t), [
          t
        ]), c.getSnapshot !== e || b || Gt !== null && Gt.memoizedState.tag & 1) {
          if (i.flags |= 2048, pa(
            9,
            { destroy: void 0 },
            Fs.bind(
              null,
              i,
              c,
              a,
              e
            ),
            null
          ), At === null) throw Error(o(349));
          u || (on & 127) !== 0 || Ws(i, e, a);
        }
        return a;
      }
      function Ws(t, e, a) {
        t.flags |= 16384, t = { getSnapshot: e, value: a }, e = bt.updateQueue, e === null ? (e = Yl(), bt.updateQueue = e, e.stores = [t]) : (a = e.stores, a === null ? e.stores = [t] : a.push(t));
      }
      function Fs(t, e, a, i) {
        e.value = a, e.getSnapshot = i, $s(e) && Ps(t);
      }
      function Is(t, e, a) {
        return a(function() {
          $s(e) && Ps(t);
        });
      }
      function $s(t) {
        var e = t.getSnapshot;
        t = t.value;
        try {
          var a = e();
          return !_e(t, a);
        } catch {
          return !0;
        }
      }
      function Ps(t) {
        var e = Xn(t, 2);
        e !== null && me(e, t, 2);
      }
      function Sr(t) {
        var e = de();
        if (typeof t == "function") {
          var a = t;
          if (t = a(), la) {
            X(!0);
            try {
              a();
            } finally {
              X(!1);
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
      function tc(t, e, a, i) {
        return t.baseState = a, _r(
          t,
          Mt,
          typeof i == "function" ? i : $e
        );
      }
      function Mm(t, e, a, i, c) {
        if (Ll(t)) throw Error(o(485));
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
          ut.T !== null ? a(!0) : u.isTransition = !1, i(u), a = e.pending, a === null ? (u.next = e.pending = u, ec(e, u)) : (u.next = a.next, e.pending = a.next = u);
        }
      }
      function ec(t, e) {
        var a = e.action, i = e.payload, c = t.state;
        if (e.isTransition) {
          var u = ut.T, b = {};
          ut.T = b;
          try {
            var C = a(c, i), Y = ut.S;
            Y !== null && Y(b, C), nc(t, e, C);
          } catch (J) {
            Er(t, e, J);
          } finally {
            u !== null && b.types !== null && (u.types = b.types), ut.T = u;
          }
        } else
          try {
            u = a(c, i), nc(t, e, u);
          } catch (J) {
            Er(t, e, J);
          }
      }
      function nc(t, e, a) {
        a !== null && typeof a == "object" && typeof a.then == "function" ? a.then(
          function(i) {
            ac(t, e, i);
          },
          function(i) {
            return Er(t, e, i);
          }
        ) : ac(t, e, a);
      }
      function ac(t, e, a) {
        e.status = "fulfilled", e.value = a, lc(e), t.state = a, e = t.pending, e !== null && (a = e.next, a === e ? t.pending = null : (a = a.next, e.next = a, ec(t, a)));
      }
      function Er(t, e, a) {
        var i = t.pending;
        if (t.pending = null, i !== null) {
          i = i.next;
          do
            e.status = "rejected", e.reason = a, lc(e), e = e.next;
          while (e !== i);
        }
        t.action = null;
      }
      function lc(t) {
        t = t.listeners;
        for (var e = 0; e < t.length; e++) (0, t[e])();
      }
      function ic(t, e) {
        return e;
      }
      function rc(t, e) {
        if (kt) {
          var a = At.formState;
          if (a !== null) {
            t: {
              var i = bt;
              if (kt) {
                if (Ot) {
                  var c = Zp(
                    Ot,
                    Me
                  );
                  if (c) {
                    Ot = td(c), i = Jp(c);
                    break t;
                  }
                }
                ht(i);
              }
              i = !1;
            }
            i && (e = a[0]);
          }
        }
        a = de(), a.memoizedState = a.baseState = e, i = {
          pending: null,
          lanes: 0,
          dispatch: null,
          lastRenderedReducer: ic,
          lastRenderedState: e
        }, a.queue = i, a = Sc.bind(
          null,
          bt,
          i
        ), i.dispatch = a, i = Sr(!1);
        var u = Mr.bind(
          null,
          bt,
          !1,
          i.queue
        );
        return i = de(), c = {
          state: e,
          dispatch: null,
          action: t,
          pending: null
        }, i.queue = c, a = Mm.bind(
          null,
          bt,
          c,
          u,
          a
        ), c.dispatch = a, i.memoizedState = t, [e, a, !1];
      }
      function oc(t) {
        var e = qt();
        return sc(e, Mt, t);
      }
      function sc(t, e, a) {
        if (e = _r(
          t,
          e,
          ic
        )[0], t = Kl($e)[0], typeof e == "object" && e !== null && typeof e.then == "function")
          try {
            var i = Ja(e);
          } catch (b) {
            throw b === Ca ? gi : b;
          }
        else i = e;
        e = qt();
        var c = e.queue, u = c.dispatch;
        return a !== e.memoizedState && (bt.flags |= 2048, pa(
          9,
          { destroy: void 0 },
          Am.bind(null, c, a),
          null
        )), [i, u, t];
      }
      function Am(t, e) {
        t.action = e;
      }
      function cc(t) {
        var e = qt(), a = Mt;
        if (a !== null)
          return sc(e, a, t);
        qt(), e = e.memoizedState, a = qt();
        var i = a.queue.dispatch;
        return a.memoizedState = t, [e, i, !1];
      }
      function pa(t, e, a, i) {
        return t = { tag: t, create: a, deps: i, inst: e, next: null }, e = bt.updateQueue, e === null && (e = Yl(), bt.updateQueue = e), a = e.lastEffect, a === null ? e.lastEffect = t.next = t : (i = a.next, a.next = t, t.next = i, e.lastEffect = t), t;
      }
      function uc() {
        return qt().memoizedState;
      }
      function Ql(t, e, a, i) {
        var c = de();
        bt.flags |= t, c.memoizedState = pa(
          1 | e,
          { destroy: void 0 },
          a,
          i === void 0 ? null : i
        );
      }
      function Vl(t, e, a, i) {
        var c = qt();
        i = i === void 0 ? null : i;
        var u = c.memoizedState.inst;
        Mt !== null && i !== null && gr(i, Mt.memoizedState.deps) ? c.memoizedState = pa(e, u, a, i) : (bt.flags |= t, c.memoizedState = pa(
          1 | e,
          u,
          a,
          i
        ));
      }
      function dc(t, e) {
        Ql(8390656, 8, t, e);
      }
      function zr(t, e) {
        Vl(2048, 8, t, e);
      }
      function jm(t) {
        bt.flags |= 4;
        var e = bt.updateQueue;
        if (e === null)
          e = Yl(), bt.updateQueue = e, e.events = [t];
        else {
          var a = e.events;
          a === null ? e.events = [t] : a.push(t);
        }
      }
      function fc(t) {
        var e = qt().memoizedState;
        return jm({ ref: e, nextImpl: t }), function() {
          if ((xt & 2) !== 0)
            throw Error(o(440));
          return e.impl.apply(void 0, arguments);
        };
      }
      function mc(t, e) {
        return Vl(4, 2, t, e);
      }
      function pc(t, e) {
        return Vl(4, 4, t, e);
      }
      function hc(t, e) {
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
      function gc(t, e, a) {
        a = a != null ? a.concat([t]) : null, Vl(
          4,
          4,
          hc.bind(null, e, t),
          a
        );
      }
      function Nr() {
      }
      function bc(t, e) {
        var a = qt();
        e = e === void 0 ? null : e;
        var i = a.memoizedState;
        return e !== null && gr(e, i[1]) ? i[0] : (a.memoizedState = [t, e], t);
      }
      function vc(t, e) {
        var a = qt();
        e = e === void 0 ? null : e;
        var i = a.memoizedState;
        if (e !== null && gr(e, i[1]))
          return i[0];
        if (i = t(), la) {
          X(!0);
          try {
            t();
          } finally {
            X(!1);
          }
        }
        return a.memoizedState = [i, e], i;
      }
      function Tr(t, e, a) {
        return a === void 0 || (on & 1073741824) !== 0 && (_t & 261930) === 0 ? t.memoizedState = e : (t.memoizedState = a, t = pu(), bt.lanes |= t, Cn |= t, a);
      }
      function yc(t, e, a, i) {
        return _e(a, e) ? a : ja.current !== null ? (t = Tr(t, a, i), _e(t, e) || (Kt = !0), t) : (on & 42) === 0 || (on & 1073741824) !== 0 && (_t & 261930) === 0 ? (Kt = !0, t.memoizedState = a) : (t = pu(), bt.lanes |= t, Cn |= t, e);
      }
      function xc(t, e, a, i, c) {
        var u = ln();
        Wt(
          u !== 0 && 8 > u ? u : 8
        );
        var b = ut.T, C = {};
        ut.T = C, Mr(t, !1, e, a);
        try {
          var Y = c(), J = ut.S;
          if (J !== null && J(C, Y), Y !== null && typeof Y == "object" && typeof Y.then == "function") {
            var et = Tm(
              Y,
              i
            );
            Wa(
              t,
              e,
              et,
              ve(t)
            );
          } else
            Wa(
              t,
              e,
              i,
              ve(t)
            );
        } catch (W) {
          Wa(
            t,
            e,
            { then: function() {
            }, status: "rejected", reason: W },
            ve()
          );
        } finally {
          Wt(u), b !== null && C.types !== null && (b.types = C.types), ut.T = b;
        }
      }
      function wc(t) {
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
      function Cr() {
        return Pt($n);
      }
      function _c() {
        return qt().memoizedState;
      }
      function kc() {
        return qt().memoizedState;
      }
      function Om(t) {
        for (var e = t.return; e !== null; ) {
          switch (e.tag) {
            case 24:
            case 3:
              var a = ve();
              t = gn(a);
              var i = bn(e, t, a);
              i !== null && (me(i, e, a), La(i, e, a)), e = { cache: rr() }, t.payload = e;
              return;
          }
          e = e.return;
        }
      }
      function Rm(t, e, a) {
        var i = ve();
        a = {
          lane: i,
          revertLane: 0,
          gesture: null,
          action: a,
          hasEagerState: !1,
          eagerState: null,
          next: null
        }, Ll(t) ? Ec(e, a) : (a = cr(t, e, a, i), a !== null && (me(a, t, i), zc(a, e, i)));
      }
      function Sc(t, e, a) {
        var i = ve();
        Wa(t, e, a, i);
      }
      function Wa(t, e, a, i) {
        var c = {
          lane: i,
          revertLane: 0,
          gesture: null,
          action: a,
          hasEagerState: !1,
          eagerState: null,
          next: null
        };
        if (Ll(t)) Ec(e, c);
        else {
          var u = t.alternate;
          if (t.lanes === 0 && (u === null || u.lanes === 0) && (u = e.lastRenderedReducer, u !== null))
            try {
              var b = e.lastRenderedState, C = u(b, a);
              if (c.hasEagerState = !0, c.eagerState = C, _e(C, b))
                return Hl(t, e, c, 0), At === null && Bl(), !1;
            } catch {
            } finally {
            }
          if (a = cr(t, e, c, i), a !== null)
            return me(a, t, i), zc(a, e, i), !0;
        }
        return !1;
      }
      function Mr(t, e, a, i) {
        if (i = {
          lane: 2,
          revertLane: or(),
          gesture: null,
          action: i,
          hasEagerState: !1,
          eagerState: null,
          next: null
        }, Ll(t)) {
          if (e) throw Error(o(479));
        } else
          e = cr(
            t,
            a,
            i,
            2
          ), e !== null && me(e, t, 2);
      }
      function Ll(t) {
        var e = t.alternate;
        return t === bt || e !== null && e === bt;
      }
      function Ec(t, e) {
        Oa = yi = !0;
        var a = t.pending;
        a === null ? e.next = e : (e.next = a.next, a.next = e), t.pending = e;
      }
      function zc(t, e, a) {
        if ((a & 4194048) !== 0) {
          var i = e.lanes;
          i &= t.pendingLanes, a |= i, e.lanes = a, h(t, a);
        }
      }
      function Ar(t, e, a, i) {
        e = t.memoizedState, a = a(i, e), a = a == null ? e : ro({}, e, a), t.memoizedState = a, t.lanes === 0 && (t.updateQueue.baseState = a);
      }
      function Nc(t, e, a, i, c, u, b) {
        return t = t.stateNode, typeof t.shouldComponentUpdate == "function" ? t.shouldComponentUpdate(i, u, b) : e.prototype && e.prototype.isPureReactComponent ? !Ol(a, i) || !Ol(c, u) : !0;
      }
      function Tc(t, e, a, i) {
        t = e.state, typeof e.componentWillReceiveProps == "function" && e.componentWillReceiveProps(a, i), typeof e.UNSAFE_componentWillReceiveProps == "function" && e.UNSAFE_componentWillReceiveProps(a, i), e.state !== t && jo.enqueueReplaceState(e, e.state, null);
      }
      function Zn(t, e) {
        var a = e;
        if ("ref" in e) {
          a = {};
          for (var i in e)
            i !== "ref" && (a[i] = e[i]);
        }
        if (t = t.defaultProps) {
          a === e && (a = ro({}, a));
          for (var c in t)
            a[c] === void 0 && (a[c] = t[c]);
        }
        return a;
      }
      function Xl(t, e) {
        try {
          var a = t.onUncaughtError;
          a(e.value, { componentStack: e.stack });
        } catch (i) {
          setTimeout(function() {
            throw i;
          });
        }
      }
      function Cc(t, e, a) {
        try {
          var i = t.onCaughtError;
          i(a.value, {
            componentStack: a.stack,
            errorBoundary: e.tag === 1 ? e.stateNode : null
          });
        } catch (c) {
          setTimeout(function() {
            throw c;
          });
        }
      }
      function jr(t, e, a) {
        return a = gn(a), a.tag = 3, a.payload = { element: null }, a.callback = function() {
          Xl(t, e);
        }, a;
      }
      function Mc(t) {
        return t = gn(t), t.tag = 3, t;
      }
      function Ac(t, e, a, i) {
        var c = a.type.getDerivedStateFromError;
        if (typeof c == "function") {
          var u = i.value;
          t.payload = function() {
            return c(u);
          }, t.callback = function() {
            Cc(e, a, i);
          };
        }
        var b = a.stateNode;
        b !== null && typeof b.componentDidCatch == "function" && (t.callback = function() {
          Cc(e, a, i), typeof c != "function" && (Mn === null ? Mn = /* @__PURE__ */ new Set([this]) : Mn.add(this));
          var C = i.stack;
          this.componentDidCatch(i.value, {
            componentStack: C !== null ? C : ""
          });
        });
      }
      function Dm(t, e, a, i, c) {
        if (a.flags |= 32768, i !== null && typeof i == "object" && typeof i.then == "function") {
          if (e = a.alternate, e !== null && fa(
            e,
            a,
            c,
            !0
          ), a = ke.current, a !== null) {
            switch (a.tag) {
              case 31:
              case 13:
                return je === null ? ei() : a.alternate === null && Ht === 0 && (Ht = 3), a.flags &= -257, a.flags |= 65536, a.lanes = c, i === bi ? a.flags |= 16384 : (e = a.updateQueue, e === null ? a.updateQueue = /* @__PURE__ */ new Set([i]) : e.add(i), eo(t, i, c)), !1;
              case 22:
                return a.flags |= 65536, i === bi ? a.flags |= 16384 : (e = a.updateQueue, e === null ? (e = {
                  transitions: null,
                  markerInstances: null,
                  retryQueue: /* @__PURE__ */ new Set([i])
                }, a.updateQueue = e) : (a = e.retryQueue, a === null ? e.retryQueue = /* @__PURE__ */ new Set([i]) : a.add(i)), eo(t, i, c)), !1;
            }
            throw Error(o(435, a.tag));
          }
          return eo(t, i, c), ei(), !1;
        }
        if (kt)
          return e = ke.current, e !== null ? ((e.flags & 65536) === 0 && (e.flags |= 256), e.flags |= 65536, e.lanes = c, i !== So && (t = Error(o(422), { cause: i }), Ka(
            G(t, a)
          ))) : (i !== So && (e = Error(o(423), {
            cause: i
          }), Ka(
            G(e, a)
          )), t = t.current.alternate, t.flags |= 65536, c &= -c, t.lanes |= c, i = G(i, a), c = jr(
            t.stateNode,
            i,
            c
          ), fr(t, c), Ht !== 4 && (Ht = 2)), !1;
        var u = Error(o(520), { cause: i });
        if (u = G(u, a), pl === null ? pl = [u] : pl.push(u), Ht !== 4 && (Ht = 2), e === null) return !0;
        i = G(i, a), a = e;
        do {
          switch (a.tag) {
            case 3:
              return a.flags |= 65536, t = c & -c, a.lanes |= t, t = jr(a.stateNode, i, t), fr(a, t), !1;
            case 1:
              if (e = a.type, u = a.stateNode, (a.flags & 128) === 0 && (typeof e.getDerivedStateFromError == "function" || u !== null && typeof u.componentDidCatch == "function" && (Mn === null || !Mn.has(
                u
              ))))
                return a.flags |= 65536, c &= -c, a.lanes |= c, c = Mc(c), Ac(
                  c,
                  t,
                  a,
                  i
                ), fr(a, c), !1;
          }
          a = a.return;
        } while (a !== null);
        return !1;
      }
      function te(t, e, a, i) {
        e.child = t === null ? bd(e, null, a, i) : aa(
          e,
          t.child,
          a,
          i
        );
      }
      function jc(t, e, a, i, c) {
        a = a.render;
        var u = e.ref;
        if ("ref" in i) {
          var b = {};
          for (var C in i)
            C !== "ref" && (b[C] = i[C]);
        } else b = i;
        return Vn(e), i = br(
          t,
          e,
          a,
          b,
          u,
          c
        ), C = vr(), t !== null && !Kt ? (yr(t, e, c), Pe(t, e, c)) : (kt && C && V(e), e.flags |= 1, te(t, e, i, c), e.child);
      }
      function Oc(t, e, a, i, c) {
        if (t === null) {
          var u = a.type;
          return typeof u == "function" && !no(u) && u.defaultProps === void 0 && a.compare === null ? (e.tag = 15, e.type = u, Rc(
            t,
            e,
            u,
            i,
            c
          )) : (t = ai(
            a.type,
            null,
            i,
            e,
            e.mode,
            c
          ), t.ref = e.ref, t.return = e, e.child = t);
        }
        if (u = t.child, !qr(t, c)) {
          var b = u.memoizedProps;
          if (a = a.compare, a = a !== null ? a : Ol, a(b, i) && t.ref === e.ref)
            return Pe(
              t,
              e,
              c
            );
        }
        return e.flags |= 1, t = nn(u, i), t.ref = e.ref, t.return = e, e.child = t;
      }
      function Rc(t, e, a, i, c) {
        if (t !== null) {
          var u = t.memoizedProps;
          if (Ol(u, i) && t.ref === e.ref)
            if (Kt = !1, e.pendingProps = i = u, qr(t, c))
              (t.flags & 131072) !== 0 && (Kt = !0);
            else
              return e.lanes = t.lanes, Pe(t, e, c);
        }
        return Or(
          t,
          e,
          a,
          i,
          c
        );
      }
      function Dc(t, e, a, i) {
        var c = i.children, u = t !== null ? t.memoizedState : null;
        if (t === null && e.stateNode === null && (e.stateNode = {
          _visibility: 1,
          _pendingMarkers: null,
          _retryCache: null,
          _transitions: null
        }), i.mode === "hidden") {
          if ((e.flags & 128) !== 0) {
            if (u = u !== null ? u.baseLanes | a : a, t !== null) {
              for (i = e.child = t.child, c = 0; i !== null; )
                c = c | i.lanes | i.childLanes, i = i.sibling;
              i = c & ~u;
            } else i = 0, e.child = null;
            return Bc(
              t,
              e,
              u,
              a,
              i
            );
          }
          if ((a & 536870912) !== 0)
            e.memoizedState = { baseLanes: 0, cachePool: null }, t !== null && jl(
              e,
              u !== null ? u.cachePool : null
            ), u !== null ? Vs(e, u) : mr(), Ls(e);
          else
            return i = e.lanes = 536870912, Bc(
              t,
              e,
              u !== null ? u.baseLanes | a : a,
              a,
              i
            );
        } else
          u !== null ? (jl(e, u.cachePool), Vs(e, u), yn(), e.memoizedState = null) : (t !== null && jl(e, null), mr(), yn());
        return te(t, e, c, a), e.child;
      }
      function Fa(t, e) {
        return t !== null && t.tag === 22 || e.stateNode !== null || (e.stateNode = {
          _visibility: 1,
          _pendingMarkers: null,
          _retryCache: null,
          _transitions: null
        }), e.sibling;
      }
      function Bc(t, e, a, i, c) {
        var u = sr();
        return u = u === null ? null : {
          parent: an ? Rt._currentValue : Rt._currentValue2,
          pool: u
        }, e.memoizedState = {
          baseLanes: a,
          cachePool: u
        }, t !== null && jl(e, null), mr(), Ls(e), t !== null && fa(t, e, i, !0), e.childLanes = c, null;
      }
      function Zl(t, e) {
        return e = Wl(
          { mode: e.mode, children: e.children },
          t.mode
        ), e.ref = t.ref, t.child = e, e.return = t, e;
      }
      function Hc(t, e, a) {
        return aa(e, t.child, null, a), t = Zl(
          e,
          e.pendingProps
        ), t.flags |= 2, be(e), e.memoizedState = null, t;
      }
      function Bm(t, e, a) {
        var i = e.pendingProps, c = (e.flags & 128) !== 0;
        if (e.flags &= -129, t === null) {
          if (kt) {
            if (i.mode === "hidden")
              return t = Zl(e, i), e.lanes = 536870912, Fa(null, t);
            if (hr(e), (t = Ot) ? (t = ah(
              t,
              Me
            ), t !== null && (e.memoizedState = {
              dehydrated: t,
              treeContext: Sn !== null ? { id: Xe, overflow: Ze } : null,
              retryLane: 536870912,
              hydrationErrors: null
            }, a = Ru(t), a.return = e, e.child = a, ne = e, Ot = null)) : t = null, t === null) throw ht(e);
            return e.lanes = 536870912, null;
          }
          return Zl(e, i);
        }
        var u = t.memoizedState;
        if (u !== null) {
          var b = u.dehydrated;
          if (hr(e), c)
            if (e.flags & 256)
              e.flags &= -257, e = Hc(
                t,
                e,
                a
              );
            else if (e.memoizedState !== null)
              e.child = t.child, e.flags |= 128, e = null;
            else throw Error(o(558));
          else if (Kt || fa(
            t,
            e,
            a,
            !1
          ), c = (a & t.childLanes) !== 0, Kt || c) {
            if (i = At, i !== null && (b = E(i, a), b !== 0 && b !== u.retryLane))
              throw u.retryLane = b, Xn(t, b), me(i, t, b), Oo;
            ei(), e = Hc(
              t,
              e,
              a
            );
          } else
            t = u.treeContext, ce && (Ot = $p(b), ne = e, kt = !0, zn = null, Me = !1, t !== null && ot(e, t)), e = Zl(e, i), e.flags |= 4096;
          return e;
        }
        return t = nn(t.child, {
          mode: i.mode,
          children: i.children
        }), t.ref = e.ref, e.child = t, t.return = e, t;
      }
      function Jl(t, e) {
        var a = e.ref;
        if (a === null)
          t !== null && t.ref !== null && (e.flags |= 4194816);
        else {
          if (typeof a != "function" && typeof a != "object")
            throw Error(o(284));
          (t === null || t.ref !== a) && (e.flags |= 4194816);
        }
      }
      function Or(t, e, a, i, c) {
        return Vn(e), a = br(
          t,
          e,
          a,
          i,
          void 0,
          c
        ), i = vr(), t !== null && !Kt ? (yr(t, e, c), Pe(t, e, c)) : (kt && i && V(e), e.flags |= 1, te(t, e, a, c), e.child);
      }
      function Uc(t, e, a, i, c, u) {
        return Vn(e), e.updateQueue = null, a = Zs(
          e,
          i,
          a,
          c
        ), Xs(t), i = vr(), t !== null && !Kt ? (yr(t, e, u), Pe(t, e, u)) : (kt && i && V(e), e.flags |= 1, te(t, e, a, u), e.child);
      }
      function qc(t, e, a, i, c) {
        if (Vn(e), e.stateNode === null) {
          var u = ka, b = a.contextType;
          typeof b == "object" && b !== null && (u = Pt(b)), u = new a(i, u), e.memoizedState = u.state !== null && u.state !== void 0 ? u.state : null, u.updater = jo, e.stateNode = u, u._reactInternals = e, u = e.stateNode, u.props = i, u.state = e.memoizedState, u.refs = {}, ur(e), b = a.contextType, u.context = typeof b == "object" && b !== null ? Pt(b) : ka, u.state = e.memoizedState, b = a.getDerivedStateFromProps, typeof b == "function" && (Ar(
            e,
            a,
            b,
            i
          ), u.state = e.memoizedState), typeof a.getDerivedStateFromProps == "function" || typeof u.getSnapshotBeforeUpdate == "function" || typeof u.UNSAFE_componentWillMount != "function" && typeof u.componentWillMount != "function" || (b = u.state, typeof u.componentWillMount == "function" && u.componentWillMount(), typeof u.UNSAFE_componentWillMount == "function" && u.UNSAFE_componentWillMount(), b !== u.state && jo.enqueueReplaceState(
            u,
            u.state,
            null
          ), Za(e, i, u, c), Xa(), u.state = e.memoizedState), typeof u.componentDidMount == "function" && (e.flags |= 4194308), i = !0;
        } else if (t === null) {
          u = e.stateNode;
          var C = e.memoizedProps, Y = Zn(a, C);
          u.props = Y;
          var J = u.context, et = a.contextType;
          b = ka, typeof et == "object" && et !== null && (b = Pt(et));
          var W = a.getDerivedStateFromProps;
          et = typeof W == "function" || typeof u.getSnapshotBeforeUpdate == "function", C = e.pendingProps !== C, et || typeof u.UNSAFE_componentWillReceiveProps != "function" && typeof u.componentWillReceiveProps != "function" || (C || J !== b) && Tc(
            e,
            u,
            i,
            b
          ), Nn = !1;
          var at = e.memoizedState;
          u.state = at, Za(e, i, u, c), Xa(), J = e.memoizedState, C || at !== J || Nn ? (typeof W == "function" && (Ar(
            e,
            a,
            W,
            i
          ), J = e.memoizedState), (Y = Nn || Nc(
            e,
            a,
            Y,
            i,
            at,
            J,
            b
          )) ? (et || typeof u.UNSAFE_componentWillMount != "function" && typeof u.componentWillMount != "function" || (typeof u.componentWillMount == "function" && u.componentWillMount(), typeof u.UNSAFE_componentWillMount == "function" && u.UNSAFE_componentWillMount()), typeof u.componentDidMount == "function" && (e.flags |= 4194308)) : (typeof u.componentDidMount == "function" && (e.flags |= 4194308), e.memoizedProps = i, e.memoizedState = J), u.props = i, u.state = J, u.context = b, i = Y) : (typeof u.componentDidMount == "function" && (e.flags |= 4194308), i = !1);
        } else {
          u = e.stateNode, dr(t, e), b = e.memoizedProps, et = Zn(a, b), u.props = et, W = e.pendingProps, at = u.context, J = a.contextType, Y = ka, typeof J == "object" && J !== null && (Y = Pt(J)), C = a.getDerivedStateFromProps, (J = typeof C == "function" || typeof u.getSnapshotBeforeUpdate == "function") || typeof u.UNSAFE_componentWillReceiveProps != "function" && typeof u.componentWillReceiveProps != "function" || (b !== W || at !== Y) && Tc(
            e,
            u,
            i,
            Y
          ), Nn = !1, at = e.memoizedState, u.state = at, Za(e, i, u, c), Xa();
          var gt = e.memoizedState;
          b !== W || at !== gt || Nn || t !== null && t.dependencies !== null && Cl(t.dependencies) ? (typeof C == "function" && (Ar(
            e,
            a,
            C,
            i
          ), gt = e.memoizedState), (et = Nn || Nc(
            e,
            a,
            et,
            i,
            at,
            gt,
            Y
          ) || t !== null && t.dependencies !== null && Cl(t.dependencies)) ? (J || typeof u.UNSAFE_componentWillUpdate != "function" && typeof u.componentWillUpdate != "function" || (typeof u.componentWillUpdate == "function" && u.componentWillUpdate(i, gt, Y), typeof u.UNSAFE_componentWillUpdate == "function" && u.UNSAFE_componentWillUpdate(
            i,
            gt,
            Y
          )), typeof u.componentDidUpdate == "function" && (e.flags |= 4), typeof u.getSnapshotBeforeUpdate == "function" && (e.flags |= 1024)) : (typeof u.componentDidUpdate != "function" || b === t.memoizedProps && at === t.memoizedState || (e.flags |= 4), typeof u.getSnapshotBeforeUpdate != "function" || b === t.memoizedProps && at === t.memoizedState || (e.flags |= 1024), e.memoizedProps = i, e.memoizedState = gt), u.props = i, u.state = gt, u.context = Y, i = et) : (typeof u.componentDidUpdate != "function" || b === t.memoizedProps && at === t.memoizedState || (e.flags |= 4), typeof u.getSnapshotBeforeUpdate != "function" || b === t.memoizedProps && at === t.memoizedState || (e.flags |= 1024), i = !1);
        }
        return u = i, Jl(t, e), i = (e.flags & 128) !== 0, u || i ? (u = e.stateNode, a = i && typeof a.getDerivedStateFromError != "function" ? null : u.render(), e.flags |= 1, t !== null && i ? (e.child = aa(
          e,
          t.child,
          null,
          c
        ), e.child = aa(
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
      function Yc(t, e, a, i) {
        return Be(), e.flags |= 256, te(t, e, a, i), e.child;
      }
      function Rr(t) {
        return { baseLanes: t, cachePool: Ds() };
      }
      function Dr(t, e, a) {
        return t = t !== null ? t.childLanes & ~a : 0, e && (t |= Ee), t;
      }
      function Gc(t, e, a) {
        var i = e.pendingProps, c = !1, u = (e.flags & 128) !== 0, b;
        if ((b = u) || (b = t !== null && t.memoizedState === null ? !1 : (Yt.current & 2) !== 0), b && (c = !0, e.flags &= -129), b = (e.flags & 32) !== 0, e.flags &= -33, t === null) {
          if (kt) {
            if (c ? vn(e) : yn(), (t = Ot) ? (t = lh(
              t,
              Me
            ), t !== null && (e.memoizedState = {
              dehydrated: t,
              treeContext: Sn !== null ? { id: Xe, overflow: Ze } : null,
              retryLane: 536870912,
              hydrationErrors: null
            }, a = Ru(t), a.return = e, e.child = a, ne = e, Ot = null)) : t = null, t === null) throw ht(e);
            return bo(t) ? e.lanes = 32 : e.lanes = 536870912, null;
          }
          var C = i.children;
          return i = i.fallback, c ? (yn(), c = e.mode, C = Wl(
            { mode: "hidden", children: C },
            c
          ), i = Fn(
            i,
            c,
            a,
            null
          ), C.return = e, i.return = e, C.sibling = i, e.child = C, i = e.child, i.memoizedState = Rr(a), i.childLanes = Dr(
            t,
            b,
            a
          ), e.memoizedState = Ro, Fa(null, i)) : (vn(e), Br(e, C));
        }
        var Y = t.memoizedState;
        if (Y !== null && (C = Y.dehydrated, C !== null)) {
          if (u)
            e.flags & 256 ? (vn(e), e.flags &= -257, e = Hr(
              t,
              e,
              a
            )) : e.memoizedState !== null ? (yn(), e.child = t.child, e.flags |= 128, e = null) : (yn(), C = i.fallback, c = e.mode, i = Wl(
              { mode: "visible", children: i.children },
              c
            ), C = Fn(
              C,
              c,
              a,
              null
            ), C.flags |= 2, i.return = e, C.return = e, i.sibling = C, e.child = i, aa(
              e,
              t.child,
              null,
              a
            ), i = e.child, i.memoizedState = Rr(a), i.childLanes = Dr(
              t,
              b,
              a
            ), e.memoizedState = Ro, e = Fa(null, i));
          else if (vn(e), bo(C))
            b = Lp(C).digest, i = Error(o(419)), i.stack = "", i.digest = b, Ka({ value: i, source: null, stack: null }), e = Hr(
              t,
              e,
              a
            );
          else if (Kt || fa(
            t,
            e,
            a,
            !1
          ), b = (a & t.childLanes) !== 0, Kt || b) {
            if (b = At, b !== null && (i = E(
              b,
              a
            ), i !== 0 && i !== Y.retryLane))
              throw Y.retryLane = i, Xn(t, i), me(b, t, i), Oo;
            go(C) || ei(), e = Hr(
              t,
              e,
              a
            );
          } else
            go(C) ? (e.flags |= 192, e.child = t.child, e = null) : (t = Y.treeContext, ce && (Ot = Pp(
              C
            ), ne = e, kt = !0, zn = null, Me = !1, t !== null && ot(e, t)), e = Br(
              e,
              i.children
            ), e.flags |= 4096);
          return e;
        }
        return c ? (yn(), C = i.fallback, c = e.mode, Y = t.child, u = Y.sibling, i = nn(Y, {
          mode: "hidden",
          children: i.children
        }), i.subtreeFlags = Y.subtreeFlags & 65011712, u !== null ? C = nn(
          u,
          C
        ) : (C = Fn(
          C,
          c,
          a,
          null
        ), C.flags |= 2), C.return = e, i.return = e, i.sibling = C, e.child = i, Fa(null, i), i = e.child, C = t.child.memoizedState, C === null ? C = Rr(a) : (c = C.cachePool, c !== null ? (Y = an ? Rt._currentValue : Rt._currentValue2, c = c.parent !== Y ? { parent: Y, pool: Y } : c) : c = Ds(), C = {
          baseLanes: C.baseLanes | a,
          cachePool: c
        }), i.memoizedState = C, i.childLanes = Dr(
          t,
          b,
          a
        ), e.memoizedState = Ro, Fa(t.child, i)) : (vn(e), a = t.child, t = a.sibling, a = nn(a, {
          mode: "visible",
          children: i.children
        }), a.return = e, a.sibling = null, t !== null && (b = e.deletions, b === null ? (e.deletions = [t], e.flags |= 16) : b.push(t)), e.child = a, e.memoizedState = null, a);
      }
      function Br(t, e) {
        return e = Wl(
          { mode: "visible", children: e },
          t.mode
        ), e.return = t, t.child = e;
      }
      function Wl(t, e) {
        return t = s(22, t, null, e), t.lanes = 0, t;
      }
      function Hr(t, e, a) {
        return aa(e, t.child, null, a), t = Br(
          e,
          e.pendingProps.children
        ), t.flags |= 2, e.memoizedState = null, t;
      }
      function Kc(t, e, a) {
        t.lanes |= e;
        var i = t.alternate;
        i !== null && (i.lanes |= e), lr(t.return, e, a);
      }
      function Ur(t, e, a, i, c, u) {
        var b = t.memoizedState;
        b === null ? t.memoizedState = {
          isBackwards: e,
          rendering: null,
          renderingStartTime: 0,
          last: i,
          tail: a,
          tailMode: c,
          treeForkCount: u
        } : (b.isBackwards = e, b.rendering = null, b.renderingStartTime = 0, b.last = i, b.tail = a, b.tailMode = c, b.treeForkCount = u);
      }
      function Qc(t, e, a) {
        var i = e.pendingProps, c = i.revealOrder, u = i.tail;
        i = i.children;
        var b = Yt.current, C = (b & 2) !== 0;
        if (C ? (b = b & 1 | 2, e.flags |= 128) : b &= 1, _(Yt, b), te(t, e, i, a), i = kt ? ol : 0, !C && t !== null && (t.flags & 128) !== 0)
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
              t = a.alternate, t !== null && ql(t) === null && (c = a), a = a.sibling;
            a = c, a === null ? (c = e.child, e.child = null) : (c = a.sibling, a.sibling = null), Ur(
              e,
              !1,
              c,
              a,
              u,
              i
            );
            break;
          case "backwards":
          case "unstable_legacy-backwards":
            for (a = null, c = e.child, e.child = null; c !== null; ) {
              if (t = c.alternate, t !== null && ql(t) === null) {
                e.child = c;
                break;
              }
              t = c.sibling, c.sibling = a, a = c, c = t;
            }
            Ur(
              e,
              !0,
              a,
              null,
              u,
              i
            );
            break;
          case "together":
            Ur(
              e,
              !1,
              null,
              null,
              void 0,
              i
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
      function qr(t, e) {
        return (t.lanes & e) !== 0 ? !0 : (t = t.dependencies, !!(t !== null && Cl(t)));
      }
      function Hm(t, e, a) {
        switch (e.tag) {
          case 3:
            st(
              e,
              e.stateNode.containerInfo
            ), hn(e, Rt, t.memoizedState.cache), Be();
            break;
          case 27:
          case 5:
            St(e);
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
              return e.flags |= 128, hr(e), null;
            break;
          case 13:
            var i = e.memoizedState;
            if (i !== null)
              return i.dehydrated !== null ? (vn(e), e.flags |= 128, null) : (a & e.child.childLanes) !== 0 ? Gc(
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
            if (i = (a & e.childLanes) !== 0, i || (fa(
              t,
              e,
              a,
              !1
            ), i = (a & e.childLanes) !== 0), c) {
              if (i)
                return Qc(
                  t,
                  e,
                  a
                );
              e.flags |= 128;
            }
            if (c = e.memoizedState, c !== null && (c.rendering = null, c.tail = null, c.lastEffect = null), _(Yt, Yt.current), i) break;
            return null;
          case 22:
            return e.lanes = 0, Dc(
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
      function Vc(t, e, a) {
        if (t !== null)
          if (t.memoizedProps !== e.pendingProps)
            Kt = !0;
          else {
            if (!qr(t, a) && (e.flags & 128) === 0)
              return Kt = !1, Hm(
                t,
                e,
                a
              );
            Kt = (t.flags & 131072) !== 0;
          }
        else
          Kt = !1, kt && (e.flags & 1048576) !== 0 && T(e, ol, e.index);
        switch (e.lanes = 0, e.tag) {
          case 16:
            t: {
              var i = e.pendingProps;
              if (t = Ln(e.elementType), e.type = t, typeof t == "function")
                no(t) ? (i = Zn(t, i), e.tag = 1, e = qc(
                  null,
                  e,
                  t,
                  i,
                  a
                )) : (e.tag = 0, e = Or(
                  null,
                  e,
                  t,
                  i,
                  a
                ));
              else {
                if (t != null) {
                  var c = t.$$typeof;
                  if (c === so) {
                    e.tag = 11, e = jc(
                      null,
                      e,
                      t,
                      i,
                      a
                    );
                    break t;
                  } else if (c === fo) {
                    e.tag = 14, e = Oc(
                      null,
                      e,
                      t,
                      i,
                      a
                    );
                    break t;
                  }
                }
                throw e = S(t) || t, Error(o(306, e, ""));
              }
            }
            return e;
          case 0:
            return Or(
              t,
              e,
              e.type,
              e.pendingProps,
              a
            );
          case 1:
            return i = e.type, c = Zn(
              i,
              e.pendingProps
            ), qc(
              t,
              e,
              i,
              c,
              a
            );
          case 3:
            t: {
              if (st(
                e,
                e.stateNode.containerInfo
              ), t === null) throw Error(o(387));
              var u = e.pendingProps;
              c = e.memoizedState, i = c.element, dr(t, e), Za(e, u, null, a);
              var b = e.memoizedState;
              if (u = b.cache, hn(e, Rt, u), u !== c.cache && ir(
                e,
                [Rt],
                a,
                !0
              ), Xa(), u = b.element, ce && c.isDehydrated)
                if (c = {
                  element: u,
                  isDehydrated: !1,
                  cache: b.cache
                }, e.updateQueue.baseState = c, e.memoizedState = c, e.flags & 256) {
                  e = Yc(
                    t,
                    e,
                    u,
                    a
                  );
                  break t;
                } else if (u !== i) {
                  i = G(
                    Error(o(424)),
                    e
                  ), Ka(i), e = Yc(
                    t,
                    e,
                    u,
                    a
                  );
                  break t;
                } else
                  for (ce && (Ot = Ip(
                    e.stateNode.containerInfo
                  ), ne = e, kt = !0, zn = null, Me = !0), a = bd(
                    e,
                    null,
                    u,
                    a
                  ), e.child = a; a; )
                    a.flags = a.flags & -3 | 4096, a = a.sibling;
              else {
                if (Be(), u === i) {
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
            if (Ye)
              return Jl(t, e), t === null ? (a = ad(
                e.type,
                null,
                e.pendingProps,
                null
              )) ? e.memoizedState = a : kt || (e.stateNode = Sh(
                e.type,
                e.pendingProps,
                En.current,
                e
              )) : e.memoizedState = ad(
                e.type,
                t.memoizedProps,
                e.pendingProps,
                t.memoizedState
              ), null;
          case 27:
            if (Lt)
              return St(e), t === null && Lt && kt && (i = e.stateNode = cd(
                e.type,
                e.pendingProps,
                En.current,
                ee.current,
                !1
              ), ne = e, Me = !0, Ot = th(
                e.type,
                i,
                Ot
              )), te(
                t,
                e,
                e.pendingProps.children,
                a
              ), Jl(t, e), t === null && (e.flags |= 4194304), e.child;
          case 5:
            return t === null && kt && (wh(
              e.type,
              e.pendingProps,
              ee.current
            ), (c = i = Ot) && (i = eh(
              i,
              e.type,
              e.pendingProps,
              Me
            ), i !== null ? (e.stateNode = i, ne = e, Ot = Fp(i), Me = !1, c = !0) : c = !1), c || ht(e)), St(e), c = e.type, u = e.pendingProps, b = t !== null ? t.memoizedProps : null, i = u.children, ri(c, u) ? i = null : b !== null && ri(c, b) && (e.flags |= 32), e.memoizedState !== null && (c = br(
              t,
              e,
              Cm,
              null,
              null,
              a
            ), an ? $n._currentValue = c : $n._currentValue2 = c), Jl(t, e), te(t, e, i, a), e.child;
          case 6:
            return t === null && kt && (_h(
              e.pendingProps,
              ee.current
            ), (t = a = Ot) && (a = nh(
              a,
              e.pendingProps,
              Me
            ), a !== null ? (e.stateNode = a, ne = e, Ot = null, t = !0) : t = !1), t || ht(e)), null;
          case 13:
            return Gc(t, e, a);
          case 4:
            return st(
              e,
              e.stateNode.containerInfo
            ), i = e.pendingProps, t === null ? e.child = aa(
              e,
              null,
              i,
              a
            ) : te(t, e, i, a), e.child;
          case 11:
            return jc(
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
            return i = e.pendingProps, hn(e, e.type, i.value), te(
              t,
              e,
              i.children,
              a
            ), e.child;
          case 9:
            return c = e.type._context, i = e.pendingProps.children, Vn(e), c = Pt(c), i = i(c), e.flags |= 1, te(t, e, i, a), e.child;
          case 14:
            return Oc(
              t,
              e,
              e.type,
              e.pendingProps,
              a
            );
          case 15:
            return Rc(
              t,
              e,
              e.type,
              e.pendingProps,
              a
            );
          case 19:
            return Qc(
              t,
              e,
              a
            );
          case 31:
            return Bm(t, e, a);
          case 22:
            return Dc(
              t,
              e,
              a,
              e.pendingProps
            );
          case 24:
            return Vn(e), i = Pt(Rt), t === null ? (c = sr(), c === null && (c = At, u = rr(), c.pooledCache = u, u.refCount++, u !== null && (c.pooledCacheLanes |= a), c = u), e.memoizedState = {
              parent: i,
              cache: c
            }, ur(e), hn(e, Rt, c)) : ((t.lanes & a) !== 0 && (dr(t, e), Za(e, null, null, a), Xa()), c = t.memoizedState, u = e.memoizedState, c.parent !== i ? (c = { parent: i, cache: i }, e.memoizedState = c, e.lanes === 0 && (e.memoizedState = e.updateQueue.baseState = c), hn(e, Rt, i)) : (i = u.cache, hn(e, Rt, i), i !== c.cache && ir(
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
      function He(t) {
        t.flags |= 4;
      }
      function Fl(t) {
        Le && (t.flags |= 8);
      }
      function Lc(t, e) {
        if (t !== null && t.child === e.child) return !1;
        if ((e.flags & 16) !== 0) return !0;
        for (t = e.child; t !== null; ) {
          if ((t.flags & 8218) !== 0 || (t.subtreeFlags & 8218) !== 0)
            return !0;
          t = t.sibling;
        }
        return !1;
      }
      function Yr(t, e, a, i) {
        if (se)
          for (a = e.child; a !== null; ) {
            if (a.tag === 5 || a.tag === 6)
              po(t, a.stateNode);
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
        else if (Le)
          for (var c = e.child; c !== null; ) {
            if (c.tag === 5) {
              var u = c.stateNode;
              a && i && (u = $u(
                u,
                c.type,
                c.memoizedProps
              )), po(t, u);
            } else if (c.tag === 6)
              u = c.stateNode, a && i && (u = Pu(
                u,
                c.memoizedProps
              )), po(t, u);
            else if (c.tag !== 4) {
              if (c.tag === 22 && c.memoizedState !== null)
                u = c.child, u !== null && (u.return = c), Yr(t, c, !0, !0);
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
      function Xc(t, e, a, i) {
        var c = !1;
        if (Le)
          for (var u = e.child; u !== null; ) {
            if (u.tag === 5) {
              var b = u.stateNode;
              a && i && (b = $u(
                b,
                u.type,
                u.memoizedProps
              )), Fu(t, b);
            } else if (u.tag === 6)
              b = u.stateNode, a && i && (b = Pu(
                b,
                u.memoizedProps
              )), Fu(t, b);
            else if (u.tag !== 4) {
              if (u.tag === 22 && u.memoizedState !== null)
                c = u.child, c !== null && (c.return = u), Xc(t, u, !0, !0), c = !0;
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
      function Zc(t, e) {
        if (Le && Lc(t, e)) {
          t = e.stateNode;
          var a = t.containerInfo, i = Wu();
          Xc(i, e, !1, !1), t.pendingChildren = i, He(e), Vp(a, i);
        }
      }
      function Gr(t, e, a, i) {
        if (se)
          t.memoizedProps !== i && He(e);
        else if (Le) {
          var c = t.stateNode, u = t.memoizedProps;
          if ((t = Lc(t, e)) || u !== i) {
            var b = ee.current;
            u = Qp(
              c,
              a,
              u,
              i,
              !t,
              null
            ), u === c ? e.stateNode = c : (Fl(e), Vu(
              u,
              a,
              i,
              b
            ) && He(e), e.stateNode = u, t && Yr(u, e, !1, !1));
          } else e.stateNode = c;
        }
      }
      function Kr(t, e, a, i, c) {
        if ((t.mode & 32) !== 0 && (a === null ? gp(e, i) : bp(e, a, i))) {
          if (t.flags |= 16777216, (c & 335544128) === c || ho(e, i))
            if (Xu(t.stateNode, e, i))
              t.flags |= 8192;
            else if (yu()) t.flags |= 8192;
            else
              throw na = bi, To;
        } else t.flags &= -16777217;
      }
      function Jc(t, e) {
        if (zh(e)) {
          if (t.flags |= 16777216, !sd(e))
            if (yu()) t.flags |= 8192;
            else
              throw na = bi, To;
        } else t.flags &= -16777217;
      }
      function Il(t, e) {
        e !== null && (t.flags |= 4), t.flags & 16384 && (e = t.tag !== 22 ? L() : 536870912, t.lanes |= e, Ha |= e);
      }
      function Ia(t, e) {
        if (!kt)
          switch (t.tailMode) {
            case "hidden":
              e = t.tail;
              for (var a = null; e !== null; )
                e.alternate !== null && (a = e), e = e.sibling;
              a === null ? t.tail = null : a.sibling = null;
              break;
            case "collapsed":
              a = t.tail;
              for (var i = null; a !== null; )
                a.alternate !== null && (i = a), a = a.sibling;
              i === null ? e || t.tail === null ? t.tail = null : t.tail.sibling = null : i.sibling = null;
          }
      }
      function jt(t) {
        var e = t.alternate !== null && t.alternate.child === t.child, a = 0, i = 0;
        if (e)
          for (var c = t.child; c !== null; )
            a |= c.lanes | c.childLanes, i |= c.subtreeFlags & 65011712, i |= c.flags & 65011712, c.return = t, c = c.sibling;
        else
          for (c = t.child; c !== null; )
            a |= c.lanes | c.childLanes, i |= c.subtreeFlags, i |= c.flags, c.return = t, c = c.sibling;
        return t.subtreeFlags |= i, t.childLanes = a, e;
      }
      function Um(t, e, a) {
        var i = e.pendingProps;
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
            return a = e.stateNode, i = null, t !== null && (i = t.memoizedState.cache), e.memoizedState.cache !== i && (e.flags |= 2048), Ie(Rt), ct(), a.pendingContext && (a.context = a.pendingContext, a.pendingContext = null), (t === null || t.child === null) && (De(e) ? He(e) : t === null || t.memoizedState.isDehydrated && (e.flags & 256) === 0 || (e.flags |= 1024, pn())), Zc(t, e), jt(e), null;
          case 26:
            if (Ye) {
              var c = e.type, u = e.memoizedState;
              return t === null ? (He(e), u !== null ? (jt(e), Jc(
                e,
                u
              )) : (jt(e), Kr(
                e,
                c,
                null,
                i,
                a
              ))) : u ? u !== t.memoizedState ? (He(e), jt(e), Jc(
                e,
                u
              )) : (jt(e), e.flags &= -16777217) : (u = t.memoizedProps, se ? u !== i && He(e) : Gr(
                t,
                e,
                c,
                i
              ), jt(e), Kr(
                e,
                c,
                u,
                i,
                a
              )), null;
            }
          case 27:
            if (Lt) {
              if (Jt(e), a = En.current, c = e.type, t !== null && e.stateNode != null)
                se ? t.memoizedProps !== i && He(e) : Gr(t, e, c, i);
              else {
                if (!i) {
                  if (e.stateNode === null)
                    throw Error(o(166));
                  return jt(e), null;
                }
                t = ee.current, De(e) ? Kn(e, t) : (t = cd(
                  c,
                  i,
                  a,
                  t,
                  !0
                ), e.stateNode = t, He(e));
              }
              return jt(e), null;
            }
          case 5:
            if (Jt(e), c = e.type, t !== null && e.stateNode != null)
              Gr(t, e, c, i);
            else {
              if (!i) {
                if (e.stateNode === null)
                  throw Error(o(166));
                return jt(e), null;
              }
              if (u = ee.current, De(e))
                Kn(e, u), hh(
                  e.stateNode,
                  c,
                  i,
                  u
                ) && (e.flags |= 64);
              else {
                var b = sp(
                  c,
                  i,
                  En.current,
                  u,
                  e
                );
                Fl(e), Yr(b, e, !1, !1), e.stateNode = b, Vu(
                  b,
                  c,
                  i,
                  u
                ) && He(e);
              }
            }
            return jt(e), Kr(
              e,
              e.type,
              t === null ? null : t.memoizedProps,
              e.pendingProps,
              a
            ), null;
          case 6:
            if (t && e.stateNode != null)
              a = t.memoizedProps, se ? a !== i && He(e) : Le && (a !== i ? (t = En.current, a = ee.current, Fl(e), e.stateNode = Lu(
                i,
                t,
                a,
                e
              )) : e.stateNode = t.stateNode);
            else {
              if (typeof i != "string" && e.stateNode === null)
                throw Error(o(166));
              if (t = En.current, a = ee.current, De(e)) {
                if (!ce) throw Error(o(176));
                if (t = e.stateNode, a = e.memoizedProps, i = null, c = ne, c !== null)
                  switch (c.tag) {
                    case 27:
                    case 5:
                      i = c.memoizedProps;
                  }
                rh(
                  t,
                  a,
                  e,
                  i
                ) || ht(e, !0);
              } else
                Fl(e), e.stateNode = Lu(
                  i,
                  t,
                  a,
                  e
                );
            }
            return jt(e), null;
          case 31:
            if (a = e.memoizedState, t === null || t.memoizedState !== null) {
              if (i = De(e), a !== null) {
                if (t === null) {
                  if (!i) throw Error(o(318));
                  if (!ce) throw Error(o(556));
                  if (t = e.memoizedState, t = t !== null ? t.dehydrated : null, !t) throw Error(o(557));
                  oh(t, e);
                } else
                  Be(), (e.flags & 128) === 0 && (e.memoizedState = null), e.flags |= 4;
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
            if (i = e.memoizedState, t === null || t.memoizedState !== null && t.memoizedState.dehydrated !== null) {
              if (c = De(e), i !== null && i.dehydrated !== null) {
                if (t === null) {
                  if (!c) throw Error(o(318));
                  if (!ce) throw Error(o(344));
                  if (c = e.memoizedState, c = c !== null ? c.dehydrated : null, !c) throw Error(o(317));
                  sh(c, e);
                } else
                  Be(), (e.flags & 128) === 0 && (e.memoizedState = null), e.flags |= 4;
                jt(e), c = !1;
              } else
                c = pn(), t !== null && t.memoizedState !== null && (t.memoizedState.hydrationErrors = c), c = !0;
              if (!c)
                return e.flags & 256 ? (be(e), e) : (be(e), null);
            }
            return be(e), (e.flags & 128) !== 0 ? (e.lanes = a, e) : (a = i !== null, t = t !== null && t.memoizedState !== null, a && (i = e.child, c = null, i.alternate !== null && i.alternate.memoizedState !== null && i.alternate.memoizedState.cachePool !== null && (c = i.alternate.memoizedState.cachePool.pool), u = null, i.memoizedState !== null && i.memoizedState.cachePool !== null && (u = i.memoizedState.cachePool.pool), u !== c && (i.flags |= 2048)), a !== t && a && (e.child.flags |= 8192), Il(e, e.updateQueue), jt(e), null);
          case 4:
            return ct(), Zc(t, e), t === null && fp(e.stateNode.containerInfo), jt(e), null;
          case 10:
            return Ie(e.type), jt(e), null;
          case 19:
            if (z(Yt), i = e.memoizedState, i === null) return jt(e), null;
            if (c = (e.flags & 128) !== 0, u = i.rendering, u === null)
              if (c) Ia(i, !1);
              else {
                if (Ht !== 0 || t !== null && (t.flags & 128) !== 0)
                  for (t = e.child; t !== null; ) {
                    if (u = ql(t), u !== null) {
                      for (e.flags |= 128, Ia(i, !1), t = u.updateQueue, e.updateQueue = t, Il(e, t), e.subtreeFlags = 0, t = a, a = e.child; a !== null; )
                        Ou(a, t), a = a.sibling;
                      return _(
                        Yt,
                        Yt.current & 1 | 2
                      ), kt && K(e, i.treeForkCount), e.child;
                    }
                    t = t.sibling;
                  }
                i.tail !== null && pe() > hl && (e.flags |= 128, c = !0, Ia(i, !1), e.lanes = 4194304);
              }
            else {
              if (!c)
                if (t = ql(u), t !== null) {
                  if (e.flags |= 128, c = !0, t = t.updateQueue, e.updateQueue = t, Il(e, t), Ia(i, !0), i.tail === null && i.tailMode === "hidden" && !u.alternate && !kt)
                    return jt(e), null;
                } else
                  2 * pe() - i.renderingStartTime > hl && a !== 536870912 && (e.flags |= 128, c = !0, Ia(i, !1), e.lanes = 4194304);
              i.isBackwards ? (u.sibling = e.child, e.child = u) : (t = i.last, t !== null ? t.sibling = u : e.child = u, i.last = u);
            }
            return i.tail !== null ? (t = i.tail, i.rendering = t, i.tail = t.sibling, i.renderingStartTime = pe(), t.sibling = null, a = Yt.current, _(
              Yt,
              c ? a & 1 | 2 : a & 1
            ), kt && K(e, i.treeForkCount), t) : (jt(e), null);
          case 22:
          case 23:
            return be(e), pr(), i = e.memoizedState !== null, t !== null ? t.memoizedState !== null !== i && (e.flags |= 8192) : i && (e.flags |= 8192), i ? (a & 536870912) !== 0 && (e.flags & 128) === 0 && (jt(e), e.subtreeFlags & 6 && (e.flags |= 8192)) : jt(e), a = e.updateQueue, a !== null && Il(e, a.retryQueue), a = null, t !== null && t.memoizedState !== null && t.memoizedState.cachePool !== null && (a = t.memoizedState.cachePool.pool), i = null, e.memoizedState !== null && e.memoizedState.cachePool !== null && (i = e.memoizedState.cachePool.pool), i !== a && (e.flags |= 2048), t !== null && z(ea), null;
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
        switch (nt(e), e.tag) {
          case 1:
            return t = e.flags, t & 65536 ? (e.flags = t & -65537 | 128, e) : null;
          case 3:
            return Ie(Rt), ct(), t = e.flags, (t & 65536) !== 0 && (t & 128) === 0 ? (e.flags = t & -65537 | 128, e) : null;
          case 26:
          case 27:
          case 5:
            return Jt(e), null;
          case 31:
            if (e.memoizedState !== null) {
              if (be(e), e.alternate === null)
                throw Error(o(340));
              Be();
            }
            return t = e.flags, t & 65536 ? (e.flags = t & -65537 | 128, e) : null;
          case 13:
            if (be(e), t = e.memoizedState, t !== null && t.dehydrated !== null) {
              if (e.alternate === null)
                throw Error(o(340));
              Be();
            }
            return t = e.flags, t & 65536 ? (e.flags = t & -65537 | 128, e) : null;
          case 19:
            return z(Yt), null;
          case 4:
            return ct(), null;
          case 10:
            return Ie(e.type), null;
          case 22:
          case 23:
            return be(e), pr(), t !== null && z(ea), t = e.flags, t & 65536 ? (e.flags = t & -65537 | 128, e) : null;
          case 24:
            return Ie(Rt), null;
          case 25:
            return null;
          default:
            return null;
        }
      }
      function Wc(t, e) {
        switch (nt(e), e.tag) {
          case 3:
            Ie(Rt), ct();
            break;
          case 26:
          case 27:
          case 5:
            Jt(e);
            break;
          case 4:
            ct();
            break;
          case 31:
            e.memoizedState !== null && be(e);
            break;
          case 13:
            be(e);
            break;
          case 19:
            z(Yt);
            break;
          case 10:
            Ie(e.type);
            break;
          case 22:
          case 23:
            be(e), pr(), t !== null && z(ea);
            break;
          case 24:
            Ie(Rt);
        }
      }
      function $a(t, e) {
        try {
          var a = e.updateQueue, i = a !== null ? a.lastEffect : null;
          if (i !== null) {
            var c = i.next;
            a = c;
            do {
              if ((a.tag & t) === t) {
                i = void 0;
                var u = a.create, b = a.inst;
                i = u(), b.destroy = i;
              }
              a = a.next;
            } while (a !== c);
          }
        } catch (C) {
          zt(e, e.return, C);
        }
      }
      function xn(t, e, a) {
        try {
          var i = e.updateQueue, c = i !== null ? i.lastEffect : null;
          if (c !== null) {
            var u = c.next;
            i = u;
            do {
              if ((i.tag & t) === t) {
                var b = i.inst, C = b.destroy;
                if (C !== void 0) {
                  b.destroy = void 0, c = e;
                  var Y = a, J = C;
                  try {
                    J();
                  } catch (et) {
                    zt(
                      c,
                      Y,
                      et
                    );
                  }
                }
              }
              i = i.next;
            } while (i !== u);
          }
        } catch (et) {
          zt(e, e.return, et);
        }
      }
      function Fc(t) {
        var e = t.updateQueue;
        if (e !== null) {
          var a = t.stateNode;
          try {
            Qs(e, a);
          } catch (i) {
            zt(t, t.return, i);
          }
        }
      }
      function Ic(t, e, a) {
        a.props = Zn(
          t.type,
          t.memoizedProps
        ), a.state = t.memoizedState;
        try {
          a.componentWillUnmount();
        } catch (i) {
          zt(t, e, i);
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
                var i = al(t.stateNode);
                break;
              case 30:
                i = t.stateNode;
                break;
              default:
                i = t.stateNode;
            }
            typeof a == "function" ? t.refCleanup = a(i) : a.current = i;
          }
        } catch (c) {
          zt(t, e, c);
        }
      }
      function Ve(t, e) {
        var a = t.ref, i = t.refCleanup;
        if (a !== null)
          if (typeof i == "function")
            try {
              i();
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
      function $c(t) {
        var e = t.type, a = t.memoizedProps, i = t.stateNode;
        try {
          jp(i, e, a, t);
        } catch (c) {
          zt(t, t.return, c);
        }
      }
      function Qr(t, e, a) {
        try {
          Op(
            t.stateNode,
            t.type,
            a,
            e,
            t
          );
        } catch (i) {
          zt(t, t.return, i);
        }
      }
      function Pc(t) {
        return t.tag === 5 || t.tag === 3 || (Ye ? t.tag === 26 : !1) || (Lt ? t.tag === 27 && wa(t.type) : !1) || t.tag === 4;
      }
      function Vr(t) {
        t: for (; ; ) {
          for (; t.sibling === null; ) {
            if (t.return === null || Pc(t.return)) return null;
            t = t.return;
          }
          for (t.sibling.return = t.return, t = t.sibling; t.tag !== 5 && t.tag !== 6 && t.tag !== 18; ) {
            if (Lt && t.tag === 27 && wa(t.type) || t.flags & 2 || t.child === null || t.tag === 4) continue t;
            t.child.return = t, t = t.child;
          }
          if (!(t.flags & 2)) return t.stateNode;
        }
      }
      function Lr(t, e, a) {
        var i = t.tag;
        if (i === 5 || i === 6)
          t = t.stateNode, e ? Dp(a, t, e) : Mp(a, t);
        else if (i !== 4 && (Lt && i === 27 && wa(t.type) && (a = t.stateNode, e = null), t = t.child, t !== null))
          for (Lr(t, e, a), t = t.sibling; t !== null; )
            Lr(t, e, a), t = t.sibling;
      }
      function $l(t, e, a) {
        var i = t.tag;
        if (i === 5 || i === 6)
          t = t.stateNode, e ? Rp(a, t, e) : Cp(a, t);
        else if (i !== 4 && (Lt && i === 27 && wa(t.type) && (a = t.stateNode), t = t.child, t !== null))
          for ($l(t, e, a), t = t.sibling; t !== null; )
            $l(t, e, a), t = t.sibling;
      }
      function tu(t, e, a) {
        t = t.containerInfo;
        try {
          Iu(t, a);
        } catch (i) {
          zt(e, e.return, i);
        }
      }
      function eu(t) {
        var e = t.stateNode, a = t.memoizedProps;
        try {
          Th(
            t.type,
            a,
            e,
            t
          );
        } catch (i) {
          zt(t, t.return, i);
        }
      }
      function Ym(t, e) {
        for (rp(t.containerInfo), Ft = e; Ft !== null; )
          if (t = Ft, e = t.child, (t.subtreeFlags & 1028) !== 0 && e !== null)
            e.return = t, Ft = e;
          else
            for (; Ft !== null; ) {
              t = Ft;
              var a = t.alternate;
              switch (e = t.flags, t.tag) {
                case 0:
                  if ((e & 4) !== 0 && (e = t.updateQueue, e = e !== null ? e.events : null, e !== null))
                    for (var i = 0; i < e.length; i++) {
                      var c = e[i];
                      c.ref.impl = c.nextImpl;
                    }
                  break;
                case 11:
                case 15:
                  break;
                case 1:
                  if ((e & 1024) !== 0 && a !== null) {
                    e = void 0, i = t, c = a.memoizedProps, a = a.memoizedState;
                    var u = i.stateNode;
                    try {
                      var b = Zn(
                        i.type,
                        c
                      );
                      e = u.getSnapshotBeforeUpdate(
                        b,
                        a
                      ), u.__reactInternalSnapshotBeforeUpdate = e;
                    } catch (C) {
                      zt(i, i.return, C);
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
                e.return = t.return, Ft = e;
                break;
              }
              Ft = t.return;
            }
      }
      function nu(t, e, a) {
        var i = a.flags;
        switch (a.tag) {
          case 0:
          case 11:
          case 15:
            tn(t, a), i & 4 && $a(5, a);
            break;
          case 1:
            if (tn(t, a), i & 4)
              if (t = a.stateNode, e === null)
                try {
                  t.componentDidMount();
                } catch (b) {
                  zt(a, a.return, b);
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
                } catch (b) {
                  zt(
                    a,
                    a.return,
                    b
                  );
                }
              }
            i & 64 && Fc(a), i & 512 && Pa(a, a.return);
            break;
          case 3:
            if (tn(t, a), i & 64 && (i = a.updateQueue, i !== null)) {
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
                Qs(i, t);
              } catch (b) {
                zt(a, a.return, b);
              }
            }
            break;
          case 27:
            Lt && e === null && i & 4 && eu(a);
          case 26:
          case 5:
            if (tn(t, a), e === null) {
              if (i & 4) $c(a);
              else if (i & 64) {
                t = a.type, e = a.memoizedProps, c = a.stateNode;
                try {
                  dh(
                    c,
                    t,
                    e,
                    a
                  );
                } catch (b) {
                  zt(a, a.return, b);
                }
              }
            }
            i & 512 && Pa(a, a.return);
            break;
          case 12:
            tn(t, a);
            break;
          case 31:
            tn(t, a), i & 4 && lu(t, a);
            break;
          case 13:
            tn(t, a), i & 4 && iu(t, a), i & 64 && (i = a.memoizedState, i !== null && (i = i.dehydrated, i !== null && (a = Zm.bind(
              null,
              a
            ), Xp(i, a))));
            break;
          case 22:
            if (i = a.memoizedState !== null || sn, !i) {
              e = e !== null && e.memoizedState !== null || Qt, c = sn;
              var u = Qt;
              sn = i, (Qt = e) && !u ? en(
                t,
                a,
                (a.subtreeFlags & 8772) !== 0
              ) : tn(t, a), sn = c, Qt = u;
            }
            break;
          case 30:
            break;
          default:
            tn(t, a);
        }
      }
      function au(t) {
        var e = t.alternate;
        e !== null && (t.alternate = null, au(e)), t.child = null, t.deletions = null, t.sibling = null, t.tag === 5 && (e = t.stateNode, e !== null && hp(e)), t.stateNode = null, t.return = null, t.dependencies = null, t.memoizedProps = null, t.memoizedState = null, t.pendingProps = null, t.stateNode = null, t.updateQueue = null;
      }
      function Ue(t, e, a) {
        for (a = a.child; a !== null; )
          Xr(
            t,
            e,
            a
          ), a = a.sibling;
      }
      function Xr(t, e, a) {
        if (we && typeof we.onCommitFiberUnmount == "function")
          try {
            we.onCommitFiberUnmount(rl, a);
          } catch {
          }
        switch (a.tag) {
          case 26:
            if (Ye) {
              Qt || Ve(a, e), Ue(
                t,
                e,
                a
              ), a.memoizedState ? id(a.memoizedState) : a.stateNode && od(a.stateNode);
              break;
            }
          case 27:
            if (Lt) {
              Qt || Ve(a, e);
              var i = Vt, c = he;
              wa(a.type) && (Vt = a.stateNode, he = !1), Ue(
                t,
                e,
                a
              ), ud(a.stateNode), Vt = i, he = c;
              break;
            }
          case 5:
            Qt || Ve(a, e);
          case 6:
            if (se) {
              if (i = Vt, c = he, Vt = null, Ue(
                t,
                e,
                a
              ), Vt = i, he = c, Vt !== null)
                if (he)
                  try {
                    Hp(Vt, a.stateNode);
                  } catch (u) {
                    zt(
                      a,
                      e,
                      u
                    );
                  }
                else
                  try {
                    Bp(Vt, a.stateNode);
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
            se && Vt !== null && (he ? vh(
              Vt,
              a.stateNode
            ) : bh(Vt, a.stateNode));
            break;
          case 4:
            se ? (i = Vt, c = he, Vt = a.stateNode.containerInfo, he = !0, Ue(
              t,
              e,
              a
            ), Vt = i, he = c) : (Le && tu(
              a.stateNode,
              a,
              Wu()
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
            xn(2, a, e), Qt || xn(4, a, e), Ue(
              t,
              e,
              a
            );
            break;
          case 1:
            Qt || (Ve(a, e), i = a.stateNode, typeof i.componentWillUnmount == "function" && Ic(
              a,
              e,
              i
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
            Qt = (i = Qt) || a.memoizedState !== null, Ue(
              t,
              e,
              a
            ), Qt = i;
            break;
          default:
            Ue(
              t,
              e,
              a
            );
        }
      }
      function lu(t, e) {
        if (ce && e.memoizedState === null && (t = e.alternate, t !== null && (t = t.memoizedState, t !== null))) {
          t = t.dehydrated;
          try {
            mh(t);
          } catch (a) {
            zt(e, e.return, a);
          }
        }
      }
      function iu(t, e) {
        if (ce && e.memoizedState === null && (t = e.alternate, t !== null && (t = t.memoizedState, t !== null && (t = t.dehydrated, t !== null))))
          try {
            ph(t);
          } catch (a) {
            zt(e, e.return, a);
          }
      }
      function Gm(t) {
        switch (t.tag) {
          case 31:
          case 13:
          case 19:
            var e = t.stateNode;
            return e === null && (e = t.stateNode = new xd()), e;
          case 22:
            return t = t.stateNode, e = t._retryCache, e === null && (e = t._retryCache = new xd()), e;
          default:
            throw Error(o(435, t.tag));
        }
      }
      function Pl(t, e) {
        var a = Gm(t);
        e.forEach(function(i) {
          if (!a.has(i)) {
            a.add(i);
            var c = Jm.bind(null, t, i);
            i.then(c, c);
          }
        });
      }
      function oe(t, e) {
        var a = e.deletions;
        if (a !== null)
          for (var i = 0; i < a.length; i++) {
            var c = a[i], u = t, b = e;
            if (se) {
              var C = b;
              t: for (; C !== null; ) {
                switch (C.tag) {
                  case 27:
                    if (Lt) {
                      if (wa(C.type)) {
                        Vt = C.stateNode, he = !1;
                        break t;
                      }
                      break;
                    }
                  case 5:
                    Vt = C.stateNode, he = !1;
                    break t;
                  case 3:
                  case 4:
                    Vt = C.stateNode.containerInfo, he = !0;
                    break t;
                }
                C = C.return;
              }
              if (Vt === null) throw Error(o(160));
              Xr(u, b, c), Vt = null, he = !1;
            } else Xr(u, b, c);
            u = c.alternate, u !== null && (u.return = null), c.return = null;
          }
        if (e.subtreeFlags & 13886)
          for (e = e.child; e !== null; )
            ru(e, t), e = e.sibling;
      }
      function ru(t, e) {
        var a = t.alternate, i = t.flags;
        switch (t.tag) {
          case 0:
          case 11:
          case 14:
          case 15:
            oe(e, t), fe(t), i & 4 && (xn(3, t, t.return), $a(3, t), xn(5, t, t.return));
            break;
          case 1:
            oe(e, t), fe(t), i & 512 && (Qt || a === null || Ve(a, a.return)), i & 64 && sn && (t = t.updateQueue, t !== null && (i = t.callbacks, i !== null && (a = t.shared.hiddenCallbacks, t.shared.hiddenCallbacks = a === null ? i : a.concat(i))));
            break;
          case 26:
            if (Ye) {
              var c = Ge;
              if (oe(e, t), fe(t), i & 512 && (Qt || a === null || Ve(a, a.return)), i & 4) {
                i = a !== null ? a.memoizedState : null;
                var u = t.memoizedState;
                a === null ? u === null ? t.stateNode === null ? t.stateNode = kh(
                  c,
                  t.type,
                  t.memoizedProps,
                  t
                ) : rd(
                  c,
                  t.type,
                  t.stateNode
                ) : t.stateNode = ld(
                  c,
                  u,
                  t.memoizedProps
                ) : i !== u ? (i === null ? a.stateNode !== null && od(a.stateNode) : id(i), u === null ? rd(
                  c,
                  t.type,
                  t.stateNode
                ) : ld(
                  c,
                  u,
                  t.memoizedProps
                )) : u === null && t.stateNode !== null && Qr(
                  t,
                  t.memoizedProps,
                  a.memoizedProps
                );
              }
              break;
            }
          case 27:
            if (Lt) {
              oe(e, t), fe(t), i & 512 && (Qt || a === null || Ve(a, a.return)), a !== null && i & 4 && Qr(
                t,
                t.memoizedProps,
                a.memoizedProps
              );
              break;
            }
          case 5:
            if (oe(e, t), fe(t), i & 512 && (Qt || a === null || Ve(a, a.return)), se) {
              if (t.flags & 32) {
                c = t.stateNode;
                try {
                  Ju(c);
                } catch (W) {
                  zt(t, t.return, W);
                }
              }
              i & 4 && t.stateNode != null && (c = t.memoizedProps, Qr(
                t,
                c,
                a !== null ? a.memoizedProps : c
              )), i & 1024 && (Do = !0);
            } else
              Le && t.alternate !== null && (t.alternate.stateNode = t.stateNode);
            break;
          case 6:
            if (oe(e, t), fe(t), i & 4 && se) {
              if (t.stateNode === null)
                throw Error(o(162));
              i = t.memoizedProps, a = a !== null ? a.memoizedProps : i, c = t.stateNode;
              try {
                Ap(c, a, i);
              } catch (W) {
                zt(t, t.return, W);
              }
            }
            break;
          case 3:
            if (Ye ? (Eh(), c = Ge, Ge = vo(e.containerInfo), oe(e, t), Ge = c) : oe(e, t), fe(t), i & 4) {
              if (se && ce && a !== null && a.memoizedState.isDehydrated)
                try {
                  fh(e.containerInfo);
                } catch (W) {
                  zt(t, t.return, W);
                }
              if (Le) {
                i = e.containerInfo, a = e.pendingChildren;
                try {
                  Iu(i, a);
                } catch (W) {
                  zt(t, t.return, W);
                }
              }
            }
            Do && (Do = !1, ou(t));
            break;
          case 4:
            Ye ? (a = Ge, Ge = vo(
              t.stateNode.containerInfo
            ), oe(e, t), fe(t), Ge = a) : (oe(e, t), fe(t)), i & 4 && Le && tu(
              t.stateNode,
              t,
              t.stateNode.pendingChildren
            );
            break;
          case 12:
            oe(e, t), fe(t);
            break;
          case 31:
            oe(e, t), fe(t), i & 4 && (i = t.updateQueue, i !== null && (t.updateQueue = null, Pl(t, i)));
            break;
          case 13:
            oe(e, t), fe(t), t.child.flags & 8192 && t.memoizedState !== null != (a !== null && a.memoizedState !== null) && (zi = pe()), i & 4 && (i = t.updateQueue, i !== null && (t.updateQueue = null, Pl(t, i)));
            break;
          case 22:
            c = t.memoizedState !== null;
            var b = a !== null && a.memoizedState !== null, C = sn, Y = Qt;
            if (sn = C || c, Qt = Y || b, oe(e, t), Qt = Y, sn = C, fe(t), i & 8192 && (e = t.stateNode, e._visibility = c ? e._visibility & -2 : e._visibility | 1, c && (a === null || b || sn || Qt || Jn(t)), se)) {
              t: if (a = null, se)
                for (e = t; ; ) {
                  if (e.tag === 5 || Ye && e.tag === 26) {
                    if (a === null) {
                      b = a = e;
                      try {
                        u = b.stateNode, c ? Up(u) : Yp(
                          b.stateNode,
                          b.memoizedProps
                        );
                      } catch (W) {
                        zt(b, b.return, W);
                      }
                    }
                  } else if (e.tag === 6) {
                    if (a === null) {
                      b = e;
                      try {
                        var J = b.stateNode;
                        c ? qp(J) : Gp(J, b.memoizedProps);
                      } catch (W) {
                        zt(b, b.return, W);
                      }
                    }
                  } else if (e.tag === 18) {
                    if (a === null) {
                      b = e;
                      try {
                        var et = b.stateNode;
                        c ? yh(et) : xh(b.stateNode);
                      } catch (W) {
                        zt(b, b.return, W);
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
            i & 4 && (i = t.updateQueue, i !== null && (a = i.retryQueue, a !== null && (i.retryQueue = null, Pl(t, a))));
            break;
          case 19:
            oe(e, t), fe(t), i & 4 && (i = t.updateQueue, i !== null && (t.updateQueue = null, Pl(t, i)));
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
            for (var a, i = t.return; i !== null; ) {
              if (Pc(i)) {
                a = i;
                break;
              }
              i = i.return;
            }
            if (se) {
              if (a == null) throw Error(o(160));
              switch (a.tag) {
                case 27:
                  if (Lt) {
                    var c = a.stateNode, u = Vr(t);
                    $l(t, u, c);
                    break;
                  }
                case 5:
                  var b = a.stateNode;
                  a.flags & 32 && (Ju(b), a.flags &= -33);
                  var C = Vr(t);
                  $l(t, C, b);
                  break;
                case 3:
                case 4:
                  var Y = a.stateNode.containerInfo, J = Vr(t);
                  Lr(
                    t,
                    J,
                    Y
                  );
                  break;
                default:
                  throw Error(o(161));
              }
            }
          } catch (et) {
            zt(t, t.return, et);
          }
          t.flags &= -3;
        }
        e & 4096 && (t.flags &= -4097);
      }
      function ou(t) {
        if (t.subtreeFlags & 1024)
          for (t = t.child; t !== null; ) {
            var e = t;
            ou(e), e.tag === 5 && e.flags & 1024 && xp(e.stateNode), t = t.sibling;
          }
      }
      function tn(t, e) {
        if (e.subtreeFlags & 8772)
          for (e = e.child; e !== null; )
            nu(t, e.alternate, e), e = e.sibling;
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
              typeof a.componentWillUnmount == "function" && Ic(
                e,
                e.return,
                a
              ), Jn(e);
              break;
            case 27:
              Lt && ud(e.stateNode);
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
          var i = e.alternate, c = t, u = e, b = u.flags;
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
              ), i = u, c = i.stateNode, typeof c.componentDidMount == "function")
                try {
                  c.componentDidMount();
                } catch (J) {
                  zt(i, i.return, J);
                }
              if (i = u, c = i.updateQueue, c !== null) {
                var C = i.stateNode;
                try {
                  var Y = c.shared.hiddenCallbacks;
                  if (Y !== null)
                    for (c.shared.hiddenCallbacks = null, c = 0; c < Y.length; c++)
                      Ks(Y[c], C);
                } catch (J) {
                  zt(i, i.return, J);
                }
              }
              a && b & 64 && Fc(u), Pa(u, u.return);
              break;
            case 27:
              Lt && eu(u);
            case 26:
            case 5:
              en(
                c,
                u,
                a
              ), a && i === null && b & 4 && $c(u), Pa(u, u.return);
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
              ), a && b & 4 && lu(c, u);
              break;
            case 13:
              en(
                c,
                u,
                a
              ), a && b & 4 && iu(c, u);
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
      function Zr(t, e) {
        var a = null;
        t !== null && t.memoizedState !== null && t.memoizedState.cachePool !== null && (a = t.memoizedState.cachePool.pool), t = null, e.memoizedState !== null && e.memoizedState.cachePool !== null && (t = e.memoizedState.cachePool.pool), t !== a && (t != null && t.refCount++, a != null && Qa(a));
      }
      function Jr(t, e) {
        t = null, e.alternate !== null && (t = e.alternate.memoizedState.cache), e = e.memoizedState.cache, e !== t && (e.refCount++, t != null && Qa(t));
      }
      function qe(t, e, a, i) {
        if (e.subtreeFlags & 10256)
          for (e = e.child; e !== null; )
            su(
              t,
              e,
              a,
              i
            ), e = e.sibling;
      }
      function su(t, e, a, i) {
        var c = e.flags;
        switch (e.tag) {
          case 0:
          case 11:
          case 15:
            qe(
              t,
              e,
              a,
              i
            ), c & 2048 && $a(9, e);
            break;
          case 1:
            qe(
              t,
              e,
              a,
              i
            );
            break;
          case 3:
            qe(
              t,
              e,
              a,
              i
            ), c & 2048 && (t = null, e.alternate !== null && (t = e.alternate.memoizedState.cache), e = e.memoizedState.cache, e !== t && (e.refCount++, t != null && Qa(t)));
            break;
          case 12:
            if (c & 2048) {
              qe(
                t,
                e,
                a,
                i
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
                zt(e, e.return, Y);
              }
            } else
              qe(
                t,
                e,
                a,
                i
              );
            break;
          case 31:
            qe(
              t,
              e,
              a,
              i
            );
            break;
          case 13:
            qe(
              t,
              e,
              a,
              i
            );
            break;
          case 23:
            break;
          case 22:
            u = e.stateNode, b = e.alternate, e.memoizedState !== null ? u._visibility & 2 ? qe(
              t,
              e,
              a,
              i
            ) : tl(
              t,
              e
            ) : u._visibility & 2 ? qe(
              t,
              e,
              a,
              i
            ) : (u._visibility |= 2, ha(
              t,
              e,
              a,
              i,
              (e.subtreeFlags & 10256) !== 0 || !1
            )), c & 2048 && Zr(b, e);
            break;
          case 24:
            qe(
              t,
              e,
              a,
              i
            ), c & 2048 && Jr(e.alternate, e);
            break;
          default:
            qe(
              t,
              e,
              a,
              i
            );
        }
      }
      function ha(t, e, a, i, c) {
        for (c = c && ((e.subtreeFlags & 10256) !== 0 || !1), e = e.child; e !== null; ) {
          var u = t, b = e, C = a, Y = i, J = b.flags;
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
              ), $a(8, b);
              break;
            case 23:
              break;
            case 22:
              var et = b.stateNode;
              b.memoizedState !== null ? et._visibility & 2 ? ha(
                u,
                b,
                C,
                Y,
                c
              ) : tl(
                u,
                b
              ) : (et._visibility |= 2, ha(
                u,
                b,
                C,
                Y,
                c
              )), c && J & 2048 && Zr(
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
              ), c && J & 2048 && Jr(b.alternate, b);
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
      function tl(t, e) {
        if (e.subtreeFlags & 10256)
          for (e = e.child; e !== null; ) {
            var a = t, i = e, c = i.flags;
            switch (i.tag) {
              case 22:
                tl(a, i), c & 2048 && Zr(
                  i.alternate,
                  i
                );
                break;
              case 24:
                tl(a, i), c & 2048 && Jr(
                  i.alternate,
                  i
                );
                break;
              default:
                tl(a, i);
            }
            e = e.sibling;
          }
      }
      function Wn(t, e, a) {
        if (t.subtreeFlags & Da)
          for (t = t.child; t !== null; )
            cu(
              t,
              e,
              a
            ), t = t.sibling;
      }
      function cu(t, e, a) {
        switch (t.tag) {
          case 26:
            if (Wn(
              t,
              e,
              a
            ), t.flags & Da)
              if (t.memoizedState !== null)
                Nh(
                  a,
                  Ge,
                  t.memoizedState,
                  t.memoizedProps
                );
              else {
                var i = t.stateNode, c = t.type;
                t = t.memoizedProps, ((e & 335544128) === e || ho(c, t)) && Zu(a, i, c, t);
              }
            break;
          case 5:
            Wn(
              t,
              e,
              a
            ), t.flags & Da && (i = t.stateNode, c = t.type, t = t.memoizedProps, ((e & 335544128) === e || ho(c, t)) && Zu(a, i, c, t));
            break;
          case 3:
          case 4:
            Ye ? (i = Ge, Ge = vo(
              t.stateNode.containerInfo
            ), Wn(
              t,
              e,
              a
            ), Ge = i) : Wn(
              t,
              e,
              a
            );
            break;
          case 22:
            t.memoizedState === null && (i = t.alternate, i !== null && i.memoizedState !== null ? (i = Da, Da = 16777216, Wn(
              t,
              e,
              a
            ), Da = i) : Wn(
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
      function uu(t) {
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
              var i = e[a];
              Ft = i, fu(
                i,
                t
              );
            }
          uu(t);
        }
        if (t.subtreeFlags & 10256)
          for (t = t.child; t !== null; )
            du(t), t = t.sibling;
      }
      function du(t) {
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
            t.memoizedState !== null && e._visibility & 2 && (t.return === null || t.return.tag !== 13) ? (e._visibility &= -3, ti(t)) : el(t);
            break;
          default:
            el(t);
        }
      }
      function ti(t) {
        var e = t.deletions;
        if ((t.flags & 16) !== 0) {
          if (e !== null)
            for (var a = 0; a < e.length; a++) {
              var i = e[a];
              Ft = i, fu(
                i,
                t
              );
            }
          uu(t);
        }
        for (t = t.child; t !== null; ) {
          switch (e = t, e.tag) {
            case 0:
            case 11:
            case 15:
              xn(8, e, e.return), ti(e);
              break;
            case 22:
              a = e.stateNode, a._visibility & 2 && (a._visibility &= -3, ti(e));
              break;
            default:
              ti(e);
          }
          t = t.sibling;
        }
      }
      function fu(t, e) {
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
                var i = a.memoizedState.cachePool.pool;
                i != null && i.refCount++;
              }
              break;
            case 24:
              Qa(a.memoizedState.cache);
          }
          if (i = a.child, i !== null) i.return = a, Ft = i;
          else
            t: for (a = t; Ft !== null; ) {
              i = Ft;
              var c = i.sibling, u = i.return;
              if (au(i), i === a) {
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
      function Wr(t) {
        var e = dp(t);
        if (e != null) {
          if (typeof e.memoizedProps["data-testname"] != "string")
            throw Error(o(364));
          return e;
        }
        if (t = kp(t), t === null) throw Error(o(362));
        return t.stateNode.current;
      }
      function Fr(t, e) {
        var a = t.tag;
        switch (e.$$typeof) {
          case wi:
            if (t.type === e.value) return !0;
            break;
          case _i:
            t: {
              for (e = e.value, t = [t, 0], a = 0; a < t.length; ) {
                var i = t[a++], c = i.tag, u = t[a++], b = e[u];
                if (c !== 5 && c !== 26 && c !== 27 || !il(i)) {
                  for (; b != null && Fr(i, b); )
                    u++, b = e[u];
                  if (u === e.length) {
                    e = !0;
                    break t;
                  } else
                    for (i = i.child; i !== null; )
                      t.push(i, u), i = i.sibling;
                }
              }
              e = !1;
            }
            return e;
          case ki:
            if ((a === 5 || a === 26 || a === 27) && zp(t.stateNode, e.value))
              return !0;
            break;
          case Ei:
            if ((a === 5 || a === 6 || a === 26 || a === 27) && (t = Ep(t), t !== null && 0 <= t.indexOf(e.value)))
              return !0;
            break;
          case Si:
            if ((a === 5 || a === 26 || a === 27) && (t = t.memoizedProps["data-testname"], typeof t == "string" && t.toLowerCase() === e.value.toLowerCase()))
              return !0;
            break;
          default:
            throw Error(o(365));
        }
        return !1;
      }
      function Ir(t) {
        switch (t.$$typeof) {
          case wi:
            return "<" + (S(t.value) || "Unknown") + ">";
          case _i:
            return ":has(" + (Ir(t) || "") + ")";
          case ki:
            return '[role="' + t.value + '"]';
          case Ei:
            return '"' + t.value + '"';
          case Si:
            return '[data-testname="' + t.value + '"]';
          default:
            throw Error(o(365));
        }
      }
      function mu(t, e) {
        var a = [];
        t = [t, 0];
        for (var i = 0; i < t.length; ) {
          var c = t[i++], u = c.tag, b = t[i++], C = e[b];
          if (u !== 5 && u !== 26 && u !== 27 || !il(c)) {
            for (; C != null && Fr(c, C); )
              b++, C = e[b];
            if (b === e.length) a.push(c);
            else
              for (c = c.child; c !== null; )
                t.push(c, b), c = c.sibling;
          }
        }
        return a;
      }
      function $r(t, e) {
        if (!ll) throw Error(o(363));
        t = Wr(t), t = mu(t, e), e = [], t = Array.from(t);
        for (var a = 0; a < t.length; ) {
          var i = t[a++], c = i.tag;
          if (c === 5 || c === 26 || c === 27)
            il(i) || e.push(i.stateNode);
          else
            for (i = i.child; i !== null; )
              t.push(i), i = i.sibling;
        }
        return e;
      }
      function ve() {
        return (xt & 2) !== 0 && _t !== 0 ? _t & -_t : ut.T !== null ? or() : mp();
      }
      function pu() {
        if (Ee === 0)
          if ((_t & 536870912) === 0 || kt) {
            var t = si;
            si <<= 1, (si & 3932160) === 0 && (si = 262144), Ee = t;
          } else Ee = 536870912;
        return t = ke.current, t !== null && (t.flags |= 32), Ee;
      }
      function me(t, e, a) {
        (t === At && (Ct === 2 || Ct === 9) || t.cancelPendingCommit !== null) && (ga(t, 0), wn(
          t,
          _t,
          Ee,
          !1
        )), D(t, a), ((xt & 2) === 0 || t !== At) && (t === At && ((xt & 2) === 0 && (ia |= a), Ht === 4 && wn(
          t,
          _t,
          Ee,
          !1
        )), Qe(t));
      }
      function hu(t, e, a) {
        if ((xt & 6) !== 0) throw Error(o(327));
        var i = !a && (e & 127) === 0 && (e & t.expiredLanes) === 0 || R(t, e), c = i ? Vm(t, e) : to(t, e, !0), u = i;
        do {
          if (c === 0) {
            Ba && !i && wn(t, e, 0, !1);
            break;
          } else {
            if (a = t.current.alternate, u && !Km(a)) {
              c = to(t, e, !1), u = !1;
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
                  c = pl;
                  var Y = ce && C.current.memoizedState.isDehydrated;
                  if (Y && (ga(C, b).flags |= 256), b = to(
                    C,
                    b,
                    !1
                  ), b !== 2) {
                    if (Bo && !Y) {
                      C.errorRecoveryDisabledLanes |= u, ia |= u, c = 4;
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
              switch (i = t, u = c, u) {
                case 0:
                case 1:
                  throw Error(o(345));
                case 4:
                  if ((e & 4194048) !== e) break;
                case 6:
                  wn(
                    i,
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
              if ((e & 62914560) === e && (c = zi + 300 - pe(), 10 < c)) {
                if (wn(
                  i,
                  e,
                  Ee,
                  !Tn
                ), O(i, 0, !0) !== 0) break t;
                un = e, i.timeoutHandle = cp(
                  gu.bind(
                    null,
                    i,
                    a,
                    ge,
                    Ni,
                    Uo,
                    e,
                    Ee,
                    ia,
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
              gu(
                i,
                a,
                ge,
                Ni,
                Uo,
                e,
                Ee,
                ia,
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
      function gu(t, e, a, i, c, u, b, C, Y, J, et, W, at, gt) {
        if (t.timeoutHandle = In, W = e.subtreeFlags, W & 8192 || (W & 16785408) === 16785408) {
          W = vp(), cu(
            e,
            u,
            W
          );
          var ae = (u & 62914560) === u ? zi - pe() : (u & 4194048) === u ? wd - pe() : 0;
          if (ae = yp(
            W,
            ae
          ), ae !== null) {
            un = u, t.cancelPendingCommit = ae(
              Eu.bind(
                null,
                t,
                e,
                u,
                a,
                i,
                c,
                b,
                C,
                Y,
                et,
                W,
                null,
                at,
                gt
              )
            ), wn(t, u, b, !J);
            return;
          }
        }
        Eu(
          t,
          e,
          u,
          a,
          i,
          c,
          b,
          C,
          Y
        );
      }
      function Km(t) {
        for (var e = t; ; ) {
          var a = e.tag;
          if ((a === 0 || a === 11 || a === 15) && e.flags & 16384 && (a = e.updateQueue, a !== null && (a = a.stores, a !== null)))
            for (var i = 0; i < a.length; i++) {
              var c = a[i], u = c.getSnapshot;
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
      function wn(t, e, a, i) {
        e &= ~Ho, e &= ~ia, t.suspendedLanes |= e, t.pingedLanes &= ~e, i && (t.warmLanes |= e), i = t.expirationTimes;
        for (var c = e; 0 < c; ) {
          var u = 31 - xe(c), b = 1 << u;
          i[u] = -1, c &= ~b;
        }
        a !== 0 && v(t, a, e);
      }
      function bu() {
        return (xt & 6) === 0 ? (ma(0), !1) : !0;
      }
      function Pr() {
        if (wt !== null) {
          if (Ct === 0)
            var t = wt.return;
          else
            t = wt, rn = Pn = null, xr(t), Ma = null, ul = 0, t = wt;
          for (; t !== null; )
            Wc(t.alternate, t), t = t.return;
          wt = null;
        }
      }
      function ga(t, e) {
        var a = t.timeoutHandle;
        a !== In && (t.timeoutHandle = In, up(a)), a = t.cancelPendingCommit, a !== null && (t.cancelPendingCommit = null, a()), un = 0, Pr(), At = t, wt = a = nn(t.current, null), _t = e, Ct = 0, Se = null, Tn = !1, Ba = R(t, e), Bo = !1, Ha = Ee = Ho = ia = Cn = Ht = 0, ge = pl = null, Uo = !1, (e & 8) !== 0 && (e |= e & 32);
        var i = t.entangledLanes;
        if (i !== 0)
          for (t = t.entanglements, i &= e; 0 < i; ) {
            var c = 31 - xe(i), u = 1 << c;
            e |= t[c], i &= ~u;
          }
        return cn = e, Bl(), a;
      }
      function vu(t, e) {
        bt = null, ut.H = fl, e === Ca || e === gi ? (e = Us(), Ct = 3) : e === To ? (e = Us(), Ct = 4) : Ct = e === Oo ? 8 : e !== null && typeof e == "object" && typeof e.then == "function" ? 6 : 1, Se = e, wt === null && (Ht = 1, Xl(
          t,
          G(e, t.current)
        ));
      }
      function yu() {
        var t = ke.current;
        return t === null ? !0 : (_t & 4194048) === _t ? je === null : (_t & 62914560) === _t || (_t & 536870912) !== 0 ? t === je : !1;
      }
      function xu() {
        var t = ut.H;
        return ut.H = fl, t === null ? fl : t;
      }
      function wu() {
        var t = ut.A;
        return ut.A = Kh, t;
      }
      function ei() {
        Ht = 4, Tn || (_t & 4194048) !== _t && ke.current !== null || (Ba = !0), (Cn & 134217727) === 0 && (ia & 134217727) === 0 || At === null || wn(
          At,
          _t,
          Ee,
          !1
        );
      }
      function to(t, e, a) {
        var i = xt;
        xt |= 2;
        var c = xu(), u = wu();
        (At !== t || _t !== e) && (Ni = null, ga(t, e)), e = !1;
        var b = Ht;
        t: do
          try {
            if (Ct !== 0 && wt !== null) {
              var C = wt, Y = Se;
              switch (Ct) {
                case 8:
                  Pr(), b = 6;
                  break t;
                case 3:
                case 2:
                case 9:
                case 6:
                  ke.current === null && (e = !0);
                  var J = Ct;
                  if (Ct = 0, Se = null, ba(t, C, Y, J), a && Ba) {
                    b = 0;
                    break t;
                  }
                  break;
                default:
                  J = Ct, Ct = 0, Se = null, ba(t, C, Y, J);
              }
            }
            Qm(), b = Ht;
            break;
          } catch (et) {
            vu(t, et);
          }
        while (!0);
        return e && t.shellSuspendCounter++, rn = Pn = null, xt = i, ut.H = c, ut.A = u, wt === null && (At = null, _t = 0, Bl()), b;
      }
      function Qm() {
        for (; wt !== null; ) _u(wt);
      }
      function Vm(t, e) {
        var a = xt;
        xt |= 2;
        var i = xu(), c = wu();
        At !== t || _t !== e ? (Ni = null, hl = pe() + 500, ga(t, e)) : Ba = R(
          t,
          e
        );
        t: do
          try {
            if (Ct !== 0 && wt !== null) {
              e = wt;
              var u = Se;
              e: switch (Ct) {
                case 1:
                  Ct = 0, Se = null, ba(t, e, u, 1);
                  break;
                case 2:
                case 9:
                  if (Bs(u)) {
                    Ct = 0, Se = null, ku(e);
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
                  Bs(u) ? (Ct = 0, Se = null, ku(e)) : (Ct = 0, Se = null, ba(t, e, u, 7));
                  break;
                case 5:
                  var b = null;
                  switch (wt.tag) {
                    case 26:
                      b = wt.memoizedState;
                    case 5:
                    case 27:
                      var C = wt, Y = C.type, J = C.pendingProps;
                      if (b ? sd(b) : Xu(C.stateNode, Y, J)) {
                        Ct = 0, Se = null;
                        var et = C.sibling;
                        if (et !== null) wt = et;
                        else {
                          var W = C.return;
                          W !== null ? (wt = W, ni(W)) : wt = null;
                        }
                        break e;
                      }
                  }
                  Ct = 0, Se = null, ba(t, e, u, 5);
                  break;
                case 6:
                  Ct = 0, Se = null, ba(t, e, u, 6);
                  break;
                case 8:
                  Pr(), Ht = 6;
                  break t;
                default:
                  throw Error(o(462));
              }
            }
            Lm();
            break;
          } catch (at) {
            vu(t, at);
          }
        while (!0);
        return rn = Pn = null, ut.H = i, ut.A = c, xt = a, wt !== null ? 0 : (At = null, _t = 0, Bl(), Ht);
      }
      function Lm() {
        for (; wt !== null && !Ah(); )
          _u(wt);
      }
      function _u(t) {
        var e = Vc(
          t.alternate,
          t,
          cn
        );
        t.memoizedProps = t.pendingProps, e === null ? ni(t) : wt = e;
      }
      function ku(t) {
        var e = t, a = e.alternate;
        switch (e.tag) {
          case 15:
          case 0:
            e = Uc(
              a,
              e,
              e.pendingProps,
              e.type,
              void 0,
              _t
            );
            break;
          case 11:
            e = Uc(
              a,
              e,
              e.pendingProps,
              e.type.render,
              e.ref,
              _t
            );
            break;
          case 5:
            xr(e);
          default:
            Wc(a, e), e = wt = Ou(e, cn), e = Vc(a, e, cn);
        }
        t.memoizedProps = t.pendingProps, e === null ? ni(t) : wt = e;
      }
      function ba(t, e, a, i) {
        rn = Pn = null, xr(e), Ma = null, ul = 0;
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
              G(a, t.current)
            ), wt = null;
            return;
          }
        } catch (u) {
          if (c !== null) throw wt = c, u;
          Ht = 1, Xl(
            t,
            G(a, t.current)
          ), wt = null;
          return;
        }
        e.flags & 32768 ? (kt || i === 1 ? t = !0 : Ba || (_t & 536870912) !== 0 ? t = !1 : (Tn = t = !0, (i === 2 || i === 9 || i === 3 || i === 6) && (i = ke.current, i !== null && i.tag === 13 && (i.flags |= 16384))), Su(e, t)) : ni(e);
      }
      function ni(t) {
        var e = t;
        do {
          if ((e.flags & 32768) !== 0) {
            Su(
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
      function Su(t, e) {
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
      function Eu(t, e, a, i, c, u, b, C, Y) {
        t.cancelPendingCommit = null;
        do
          nl();
        while (Xt !== 0);
        if ((xt & 6) !== 0) throw Error(o(327));
        if (e !== null) {
          if (e === t.current)
            throw Error(o(177));
          if (u = e.lanes | e.childLanes, u |= Co, g(
            t,
            a,
            u,
            b,
            C,
            Y
          ), t === At && (wt = At = null, _t = 0), Ua = e, An = t, un = a, qo = u, Yo = c, _d = i, (e.subtreeFlags & 10256) !== 0 || (e.flags & 10256) !== 0 ? (t.callbackNode = null, t.callbackPriority = 0, Wm(wo, function() {
            return Mu(), null;
          })) : (t.callbackNode = null, t.callbackPriority = 0), i = (e.flags & 13878) !== 0, (e.subtreeFlags & 13878) !== 0 || i) {
            i = ut.T, ut.T = null, c = ln(), Wt(2), b = xt, xt |= 4;
            try {
              Ym(t, e, a);
            } finally {
              xt = b, Wt(c), ut.T = i;
            }
          }
          Xt = 1, zu(), Nu(), Tu();
        }
      }
      function zu() {
        if (Xt === 1) {
          Xt = 0;
          var t = An, e = Ua, a = (e.flags & 13878) !== 0;
          if ((e.subtreeFlags & 13878) !== 0 || a) {
            a = ut.T, ut.T = null;
            var i = ln();
            Wt(2);
            var c = xt;
            xt |= 4;
            try {
              ru(e, t), op(t.containerInfo);
            } finally {
              xt = c, Wt(i), ut.T = a;
            }
          }
          t.current = e, Xt = 2;
        }
      }
      function Nu() {
        if (Xt === 2) {
          Xt = 0;
          var t = An, e = Ua, a = (e.flags & 8772) !== 0;
          if ((e.subtreeFlags & 8772) !== 0 || a) {
            a = ut.T, ut.T = null;
            var i = ln();
            Wt(2);
            var c = xt;
            xt |= 4;
            try {
              nu(t, e.alternate, e);
            } finally {
              xt = c, Wt(i), ut.T = a;
            }
          }
          Xt = 3;
        }
      }
      function Tu() {
        if (Xt === 4 || Xt === 3) {
          Xt = 0, jh();
          var t = An, e = Ua, a = un, i = _d;
          (e.subtreeFlags & 10256) !== 0 || (e.flags & 10256) !== 0 ? Xt = 5 : (Xt = 0, Ua = An = null, Cu(t, t.pendingLanes));
          var c = t.pendingLanes;
          if (c === 0 && (Mn = null), B(a), e = e.stateNode, we && typeof we.onCommitFiberRoot == "function")
            try {
              we.onCommitFiberRoot(
                rl,
                e,
                void 0,
                (e.current.flags & 128) === 128
              );
            } catch {
            }
          if (i !== null) {
            e = ut.T, c = ln(), Wt(2), ut.T = null;
            try {
              for (var u = t.onRecoverableError, b = 0; b < i.length; b++) {
                var C = i[b];
                u(C.value, {
                  componentStack: C.stack
                });
              }
            } finally {
              ut.T = e, Wt(c);
            }
          }
          (un & 3) !== 0 && nl(), Qe(t), c = t.pendingLanes, (a & 261930) !== 0 && (c & 42) !== 0 ? t === Go ? gl++ : (gl = 0, Go = t) : gl = 0, ce && gh(), ma(0);
        }
      }
      function Cu(t, e) {
        (t.pooledCacheLanes &= e) === 0 && (e = t.pooledCache, e != null && (t.pooledCache = null, Qa(e)));
      }
      function nl() {
        return zu(), Nu(), Tu(), Mu();
      }
      function Mu() {
        if (Xt !== 5) return !1;
        var t = An, e = qo;
        qo = 0;
        var a = B(un), i = 32 > a ? 32 : a;
        a = ut.T;
        var c = ln();
        try {
          Wt(i), ut.T = null, i = Yo, Yo = null;
          var u = An, b = un;
          if (Xt = 0, Ua = An = null, un = 0, (xt & 6) !== 0)
            throw Error(o(331));
          var C = xt;
          if (xt |= 4, du(u.current), su(
            u,
            u.current,
            b,
            i
          ), xt = C, ma(0, !1), we && typeof we.onPostCommitFiberRoot == "function")
            try {
              we.onPostCommitFiberRoot(rl, u);
            } catch {
            }
          return !0;
        } finally {
          Wt(c), ut.T = a, Cu(t, e);
        }
      }
      function Au(t, e, a) {
        e = G(a, e), e = jr(t.stateNode, e, 2), t = bn(t, e, 2), t !== null && (D(t, 2), Qe(t));
      }
      function zt(t, e, a) {
        if (t.tag === 3)
          Au(t, t, a);
        else
          for (; e !== null; ) {
            if (e.tag === 3) {
              Au(
                e,
                t,
                a
              );
              break;
            } else if (e.tag === 1) {
              var i = e.stateNode;
              if (typeof e.type.getDerivedStateFromError == "function" || typeof i.componentDidCatch == "function" && (Mn === null || !Mn.has(i))) {
                t = G(a, t), a = Mc(2), i = bn(e, a, 2), i !== null && (Ac(
                  a,
                  i,
                  e,
                  t
                ), D(i, 2), Qe(i));
                break;
              }
            }
            e = e.return;
          }
      }
      function eo(t, e, a) {
        var i = t.pingCache;
        if (i === null) {
          i = t.pingCache = new Qh();
          var c = /* @__PURE__ */ new Set();
          i.set(e, c);
        } else
          c = i.get(e), c === void 0 && (c = /* @__PURE__ */ new Set(), i.set(e, c));
        c.has(a) || (Bo = !0, c.add(a), t = Xm.bind(null, t, e, a), e.then(t, t));
      }
      function Xm(t, e, a) {
        var i = t.pingCache;
        i !== null && i.delete(e), t.pingedLanes |= t.suspendedLanes & a, t.warmLanes &= ~a, At === t && (_t & a) === a && (Ht === 4 || Ht === 3 && (_t & 62914560) === _t && 300 > pe() - zi ? (xt & 2) === 0 && ga(t, 0) : Ho |= a, Ha === _t && (Ha = 0)), Qe(t);
      }
      function ju(t, e) {
        e === 0 && (e = L()), t = Xn(t, e), t !== null && (D(t, e), Qe(t));
      }
      function Zm(t) {
        var e = t.memoizedState, a = 0;
        e !== null && (a = e.retryLane), ju(t, a);
      }
      function Jm(t, e) {
        var a = 0;
        switch (t.tag) {
          case 31:
          case 13:
            var i = t.stateNode, c = t.memoizedState;
            c !== null && (a = c.retryLane);
            break;
          case 19:
            i = t.stateNode;
            break;
          case 22:
            i = t.stateNode._retryCache;
            break;
          default:
            throw Error(o(314));
        }
        i !== null && i.delete(e), ju(t, a);
      }
      function Wm(t, e) {
        return ui(t, e);
      }
      function Fm(t, e, a, i) {
        this.tag = t, this.key = a, this.sibling = this.child = this.return = this.stateNode = this.type = this.elementType = null, this.index = 0, this.refCleanup = this.ref = null, this.pendingProps = e, this.dependencies = this.memoizedState = this.updateQueue = this.memoizedProps = null, this.mode = i, this.subtreeFlags = this.flags = 0, this.deletions = null, this.childLanes = this.lanes = 0, this.alternate = null;
      }
      function no(t) {
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
      function Ou(t, e) {
        t.flags &= 65011714;
        var a = t.alternate;
        return a === null ? (t.childLanes = 0, t.lanes = e, t.child = null, t.subtreeFlags = 0, t.memoizedProps = null, t.memoizedState = null, t.updateQueue = null, t.dependencies = null, t.stateNode = null) : (t.childLanes = a.childLanes, t.lanes = a.lanes, t.child = a.child, t.subtreeFlags = 0, t.deletions = null, t.memoizedProps = a.memoizedProps, t.memoizedState = a.memoizedState, t.updateQueue = a.updateQueue, t.type = a.type, e = a.dependencies, t.dependencies = e === null ? null : {
          lanes: e.lanes,
          firstContext: e.firstContext
        }), t;
      }
      function ai(t, e, a, i, c, u) {
        var b = 0;
        if (i = t, typeof t == "function") no(t) && (b = 1);
        else if (typeof t == "string")
          b = Ye && Lt ? nd(t, a, ee.current) ? 26 : dd(t) ? 27 : 5 : Ye ? nd(
            t,
            a,
            ee.current
          ) ? 26 : 5 : Lt && dd(t) ? 27 : 5;
        else
          t: switch (t) {
            case mo:
              return t = s(31, a, e, c), t.elementType = mo, t.lanes = u, t;
            case ya:
              return Fn(
                a.children,
                c,
                u,
                e
              );
            case Yu:
              b = 8, c |= 24;
              break;
            case oo:
              return t = s(12, a, e, c | 2), t.elementType = oo, t.lanes = u, t;
            case co:
              return t = s(13, a, e, c), t.elementType = co, t.lanes = u, t;
            case uo:
              return t = s(19, a, e, c), t.elementType = uo, t.lanes = u, t;
            default:
              if (typeof t == "object" && t !== null)
                switch (t.$$typeof) {
                  case _n:
                    b = 10;
                    break t;
                  case Gu:
                    b = 9;
                    break t;
                  case so:
                    b = 11;
                    break t;
                  case fo:
                    b = 14;
                    break t;
                  case kn:
                    b = 16, i = null;
                    break t;
                }
              b = 29, a = Error(
                o(
                  130,
                  t === null ? "null" : typeof t,
                  ""
                )
              ), i = null;
          }
        return e = s(b, a, e, c), e.elementType = t, e.type = i, e.lanes = u, e;
      }
      function Fn(t, e, a, i) {
        return t = s(7, t, i, e), t.lanes = a, t;
      }
      function ao(t, e, a) {
        return t = s(6, t, null, e), t.lanes = a, t;
      }
      function Ru(t) {
        var e = s(18, null, null, 0);
        return e.stateNode = t, e;
      }
      function lo(t, e, a) {
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
      function Im(t, e, a, i, c, u, b, C, Y) {
        this.tag = 1, this.containerInfo = t, this.pingCache = this.current = this.pendingChildren = null, this.timeoutHandle = In, this.callbackNode = this.next = this.pendingContext = this.context = this.cancelPendingCommit = null, this.callbackPriority = 0, this.expirationTimes = q(-1), this.entangledLanes = this.shellSuspendCounter = this.errorRecoveryDisabledLanes = this.expiredLanes = this.warmLanes = this.pingedLanes = this.suspendedLanes = this.pendingLanes = 0, this.entanglements = q(0), this.hiddenUpdates = q(null), this.identifierPrefix = i, this.onUncaughtError = c, this.onCaughtError = u, this.onRecoverableError = b, this.pooledCache = null, this.pooledCacheLanes = 0, this.formState = Y, this.incompleteTransitions = /* @__PURE__ */ new Map();
      }
      function Du(t, e, a, i, c, u, b, C, Y, J, et, W) {
        return t = new Im(
          t,
          e,
          a,
          b,
          Y,
          J,
          et,
          W,
          C
        ), e = 1, u === !0 && (e |= 24), u = s(3, null, null, e), t.current = u, u.stateNode = t, e = rr(), e.refCount++, t.pooledCache = e, e.refCount++, u.memoizedState = {
          element: i,
          isDehydrated: a,
          cache: e
        }, ur(u), t;
      }
      function Bu(t) {
        return t ? (t = ka, t) : ka;
      }
      function Hu(t) {
        var e = t._reactInternals;
        if (e === void 0)
          throw typeof t.render == "function" ? Error(o(188)) : (t = Object.keys(t).join(","), Error(o(268, t)));
        return t = d(e), t = t !== null ? p(t) : null, t === null ? null : al(t.stateNode);
      }
      function Uu(t, e, a, i, c, u) {
        c = Bu(c), i.context === null ? i.context = c : i.pendingContext = c, i = gn(e), i.payload = { element: a }, u = u === void 0 ? null : u, u !== null && (i.callback = u), a = bn(t, i, e), a !== null && (me(a, t, e), La(a, t, e));
      }
      function qu(t, e) {
        if (t = t.memoizedState, t !== null && t.dehydrated !== null) {
          var a = t.retryLane;
          t.retryLane = a !== 0 && a < e ? a : e;
        }
      }
      function io(t, e) {
        qu(t, e), (t = t.alternate) && qu(t, e);
      }
      var yt = {}, $m = b0, ye = y0(), ro = Object.assign, Pm = Symbol.for("react.element"), li = Symbol.for("react.transitional.element"), va = Symbol.for("react.portal"), ya = Symbol.for("react.fragment"), Yu = Symbol.for("react.strict_mode"), oo = Symbol.for("react.profiler"), Gu = Symbol.for("react.consumer"), _n = Symbol.for("react.context"), so = Symbol.for("react.forward_ref"), co = Symbol.for("react.suspense"), uo = Symbol.for("react.suspense_list"), fo = Symbol.for("react.memo"), kn = Symbol.for("react.lazy"), mo = Symbol.for("react.activity"), tp = Symbol.for("react.memo_cache_sentinel"), Ku = Symbol.iterator, ep = Symbol.for("react.client.reference"), ii = Array.isArray, ut = $m.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE, np = l.rendererVersion, ap = l.rendererPackageName, Qu = l.extraDevToolsConfig, al = l.getPublicInstance, lp = l.getRootHostContext, ip = l.getChildHostContext, rp = l.prepareForCommit, op = l.resetAfterCommit, sp = l.createInstance;
      l.cloneMutableInstance;
      var po = l.appendInitialChild, Vu = l.finalizeInitialChildren, ri = l.shouldSetTextContent, Lu = l.createTextInstance;
      l.cloneMutableTextInstance;
      var cp = l.scheduleTimeout, up = l.cancelTimeout, In = l.noTimeout, an = l.isPrimaryRenderer;
      l.warnsIfNotActing;
      var se = l.supportsMutation, Le = l.supportsPersistence, ce = l.supportsHydration, dp = l.getInstanceFromNode;
      l.beforeActiveInstanceBlur;
      var fp = l.preparePortalMount;
      l.prepareScopeUpdate, l.getInstanceFromScope;
      var Wt = l.setCurrentUpdatePriority, ln = l.getCurrentUpdatePriority, mp = l.resolveUpdatePriority;
      l.trackSchedulerEvent, l.resolveEventType, l.resolveEventTimeStamp;
      var pp = l.shouldAttemptEagerTransition, hp = l.detachDeletedInstance;
      l.requestPostPaintCallback;
      var gp = l.maySuspendCommit, bp = l.maySuspendCommitOnUpdate, ho = l.maySuspendCommitInSyncRender, Xu = l.preloadInstance, vp = l.startSuspendingCommit, Zu = l.suspendInstance;
      l.suspendOnActiveViewTransition;
      var yp = l.waitForCommitToBeReady;
      l.getSuspendedCommitReason;
      var xa = l.NotPendingTransition, $n = l.HostTransitionContext, xp = l.resetFormInstance;
      l.bindToConsole;
      var wp = l.supportsMicrotasks, _p = l.scheduleMicrotask, ll = l.supportsTestSelectors, kp = l.findFiberRoot, Sp = l.getBoundingRect, Ep = l.getTextContent, il = l.isHiddenSubtree, zp = l.matchAccessibilityRole, Np = l.setFocusIfFocusable, Tp = l.setupIntersectionObserver, Cp = l.appendChild, Mp = l.appendChildToContainer, Ap = l.commitTextUpdate, jp = l.commitMount, Op = l.commitUpdate, Rp = l.insertBefore, Dp = l.insertInContainerBefore, Bp = l.removeChild, Hp = l.removeChildFromContainer, Ju = l.resetTextContent, Up = l.hideInstance, qp = l.hideTextInstance, Yp = l.unhideInstance, Gp = l.unhideTextInstance;
      l.cancelViewTransitionName, l.cancelRootViewTransitionName, l.restoreRootViewTransitionName, l.cloneRootViewTransitionContainer, l.removeRootViewTransitionClone, l.measureClonedInstance, l.hasInstanceChanged, l.hasInstanceAffectedParent, l.startViewTransition, l.startGestureTransition, l.stopViewTransition, l.getCurrentGestureOffset, l.createViewTransitionInstance;
      var Kp = l.clearContainer;
      l.createFragmentInstance, l.updateFragmentInstanceFiber, l.commitNewChildToFragmentInstance, l.deleteChildFromFragmentInstance;
      var Qp = l.cloneInstance, Wu = l.createContainerChildSet, Fu = l.appendChildToContainerChildSet, Vp = l.finalizeContainerChildren, Iu = l.replaceContainerChildren, $u = l.cloneHiddenInstance, Pu = l.cloneHiddenTextInstance, go = l.isSuspenseInstancePending, bo = l.isSuspenseInstanceFallback, Lp = l.getSuspenseInstanceFallbackErrorDetails, Xp = l.registerSuspenseInstanceRetry, Zp = l.canHydrateFormStateMarker, Jp = l.isFormStateMarkerMatching, td = l.getNextHydratableSibling, Wp = l.getNextHydratableSiblingAfterSingleton, Fp = l.getFirstHydratableChild, Ip = l.getFirstHydratableChildWithinContainer, $p = l.getFirstHydratableChildWithinActivityInstance, Pp = l.getFirstHydratableChildWithinSuspenseInstance, th = l.getFirstHydratableChildWithinSingleton, eh = l.canHydrateInstance, nh = l.canHydrateTextInstance, ah = l.canHydrateActivityInstance, lh = l.canHydrateSuspenseInstance, ih = l.hydrateInstance, rh = l.hydrateTextInstance, oh = l.hydrateActivityInstance, sh = l.hydrateSuspenseInstance, ch = l.getNextHydratableInstanceAfterActivityInstance, uh = l.getNextHydratableInstanceAfterSuspenseInstance, dh = l.commitHydratedInstance, fh = l.commitHydratedContainer, mh = l.commitHydratedActivityInstance, ph = l.commitHydratedSuspenseInstance, hh = l.finalizeHydratedChildren, gh = l.flushHydrationEvents;
      l.clearActivityBoundary;
      var bh = l.clearSuspenseBoundary;
      l.clearActivityBoundaryFromContainer;
      var vh = l.clearSuspenseBoundaryFromContainer, yh = l.hideDehydratedBoundary, xh = l.unhideDehydratedBoundary, ed = l.shouldDeleteUnhydratedTailInstances;
      l.diffHydratedPropsForDevWarnings, l.diffHydratedTextForDevWarnings, l.describeHydratableInstanceForDevWarnings;
      var wh = l.validateHydratableInstance, _h = l.validateHydratableTextInstance, Ye = l.supportsResources, nd = l.isHostHoistableType, vo = l.getHoistableRoot, ad = l.getResource, ld = l.acquireResource, id = l.releaseResource, kh = l.hydrateHoistable, rd = l.mountHoistable, od = l.unmountHoistable, Sh = l.createHoistableInstance, Eh = l.prepareToCommitHoistables, zh = l.mayResourceSuspendCommit, sd = l.preloadResource, Nh = l.suspendResource, Lt = l.supportsSingletons, cd = l.resolveSingletonInstance, Th = l.acquireSingletonInstance, ud = l.releaseSingletonInstance, dd = l.isHostSingletonType, wa = l.isSingletonScope, yo = [], _a = -1, ka = {}, xe = Math.clz32 ? Math.clz32 : y, Ch = Math.log, Mh = Math.LN2, oi = 256, si = 262144, ci = 4194304, ui = ye.unstable_scheduleCallback, xo = ye.unstable_cancelCallback, Ah = ye.unstable_shouldYield, jh = ye.unstable_requestPaint, pe = ye.unstable_now, fd = ye.unstable_ImmediatePriority, Oh = ye.unstable_UserBlockingPriority, wo = ye.unstable_NormalPriority, Rh = ye.unstable_IdlePriority, Dh = ye.log, Bh = ye.unstable_setDisableYieldValue, rl = null, we = null, _e = typeof Object.is == "function" ? Object.is : I, md = typeof reportError == "function" ? reportError : function(t) {
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
      }, Hh = Object.prototype.hasOwnProperty, _o, pd, ko = !1, hd = /* @__PURE__ */ new WeakMap(), Sa = [], Ea = 0, di = null, ol = 0, Te = [], Ce = 0, Sn = null, Xe = 1, Ze = "", ee = w(null), sl = w(null), En = w(null), fi = w(null), ne = null, Ot = null, kt = !1, zn = null, Me = !1, So = Error(o(519)), mi = w(null), Pn = null, rn = null, Uh = typeof AbortController < "u" ? AbortController : function() {
        var t = [], e = this.signal = {
          aborted: !1,
          addEventListener: function(a, i) {
            t.push(i);
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
      }, pi = null, za = null, Eo = !1, hi = !1, zo = !1, ta = 0, cl = null, No = 0, Na = 0, Ta = null, gd = ut.S;
      ut.S = function(t, e) {
        wd = pe(), typeof e == "object" && e !== null && typeof e.then == "function" && Nm(t, e), gd !== null && gd(t, e);
      };
      var ea = w(null), Ca = Error(o(460)), To = Error(o(474)), gi = Error(o(542)), bi = { then: function() {
      } }, na = null, Ma = null, ul = 0, aa = Ys(!0), bd = Ys(!1), Ae = [], Aa = 0, Co = 0, Nn = !1, Mo = !1, ja = w(null), vi = w(0), ke = w(null), je = null, Yt = w(0), on = 0, bt = null, Mt = null, Gt = null, yi = !1, Oa = !1, la = !1, xi = 0, dl = 0, Ra = null, Gh = 0, fl = {
        readContext: Pt,
        use: Gl,
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
      fl.useEffectEvent = Bt;
      var vd = {
        readContext: Pt,
        use: Gl,
        useCallback: function(t, e) {
          return de().memoizedState = [
            t,
            e === void 0 ? null : e
          ], t;
        },
        useContext: Pt,
        useEffect: dc,
        useImperativeHandle: function(t, e, a) {
          a = a != null ? a.concat([t]) : null, Ql(
            4194308,
            4,
            hc.bind(null, e, t),
            a
          );
        },
        useLayoutEffect: function(t, e) {
          return Ql(4194308, 4, t, e);
        },
        useInsertionEffect: function(t, e) {
          Ql(4, 2, t, e);
        },
        useMemo: function(t, e) {
          var a = de();
          e = e === void 0 ? null : e;
          var i = t();
          if (la) {
            X(!0);
            try {
              t();
            } finally {
              X(!1);
            }
          }
          return a.memoizedState = [i, e], i;
        },
        useReducer: function(t, e, a) {
          var i = de();
          if (a !== void 0) {
            var c = a(e);
            if (la) {
              X(!0);
              try {
                a(e);
              } finally {
                X(!1);
              }
            }
          } else c = e;
          return i.memoizedState = i.baseState = c, t = {
            pending: null,
            lanes: 0,
            dispatch: null,
            lastRenderedReducer: t,
            lastRenderedState: c
          }, i.queue = t, t = t.dispatch = Rm.bind(
            null,
            bt,
            t
          ), [i.memoizedState, t];
        },
        useRef: function(t) {
          var e = de();
          return t = { current: t }, e.memoizedState = t;
        },
        useState: function(t) {
          t = Sr(t);
          var e = t.queue, a = Sc.bind(
            null,
            bt,
            e
          );
          return e.dispatch = a, [t.memoizedState, a];
        },
        useDebugValue: Nr,
        useDeferredValue: function(t, e) {
          var a = de();
          return Tr(a, t, e);
        },
        useTransition: function() {
          var t = Sr(!1);
          return t = xc.bind(
            null,
            bt,
            t.queue,
            !0,
            !1
          ), de().memoizedState = t, [!1, t];
        },
        useSyncExternalStore: function(t, e, a) {
          var i = bt, c = de();
          if (kt) {
            if (a === void 0)
              throw Error(o(407));
            a = a();
          } else {
            if (a = e(), At === null)
              throw Error(o(349));
            (_t & 127) !== 0 || Ws(i, e, a);
          }
          c.memoizedState = a;
          var u = { value: a, getSnapshot: e };
          return c.queue = u, dc(Is.bind(null, i, u, t), [
            t
          ]), i.flags |= 2048, pa(
            9,
            { destroy: void 0 },
            Fs.bind(
              null,
              i,
              u,
              a,
              e
            ),
            null
          ), a;
        },
        useId: function() {
          var t = de(), e = At.identifierPrefix;
          if (kt) {
            var a = Ze, i = Xe;
            a = (i & ~(1 << 32 - xe(i) - 1)).toString(32) + a, e = "_" + e + "R_" + a, a = xi++, 0 < a && (e += "H" + a.toString(32)), e += "_";
          } else
            a = Gh++, e = "_" + e + "r_" + a.toString(32) + "_";
          return t.memoizedState = e;
        },
        useHostTransitionStatus: Cr,
        useFormState: rc,
        useActionState: rc,
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
          return e.queue = a, e = Mr.bind(
            null,
            bt,
            !0,
            a
          ), a.dispatch = e, [t, e];
        },
        useMemoCache: wr,
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
      }, Ao = {
        readContext: Pt,
        use: Gl,
        useCallback: bc,
        useContext: Pt,
        useEffect: zr,
        useImperativeHandle: gc,
        useInsertionEffect: mc,
        useLayoutEffect: pc,
        useMemo: vc,
        useReducer: Kl,
        useRef: uc,
        useState: function() {
          return Kl($e);
        },
        useDebugValue: Nr,
        useDeferredValue: function(t, e) {
          var a = qt();
          return yc(
            a,
            Mt.memoizedState,
            t,
            e
          );
        },
        useTransition: function() {
          var t = Kl($e)[0], e = qt().memoizedState;
          return [
            typeof t == "boolean" ? t : Ja(t),
            e
          ];
        },
        useSyncExternalStore: Js,
        useId: _c,
        useHostTransitionStatus: Cr,
        useFormState: oc,
        useActionState: oc,
        useOptimistic: function(t, e) {
          var a = qt();
          return tc(a, Mt, t, e);
        },
        useMemoCache: wr,
        useCacheRefresh: kc
      };
      Ao.useEffectEvent = fc;
      var yd = {
        readContext: Pt,
        use: Gl,
        useCallback: bc,
        useContext: Pt,
        useEffect: zr,
        useImperativeHandle: gc,
        useInsertionEffect: mc,
        useLayoutEffect: pc,
        useMemo: vc,
        useReducer: kr,
        useRef: uc,
        useState: function() {
          return kr($e);
        },
        useDebugValue: Nr,
        useDeferredValue: function(t, e) {
          var a = qt();
          return Mt === null ? Tr(a, t, e) : yc(
            a,
            Mt.memoizedState,
            t,
            e
          );
        },
        useTransition: function() {
          var t = kr($e)[0], e = qt().memoizedState;
          return [
            typeof t == "boolean" ? t : Ja(t),
            e
          ];
        },
        useSyncExternalStore: Js,
        useId: _c,
        useHostTransitionStatus: Cr,
        useFormState: cc,
        useActionState: cc,
        useOptimistic: function(t, e) {
          var a = qt();
          return Mt !== null ? tc(a, Mt, t, e) : (a.baseState = t, [t, a.queue.dispatch]);
        },
        useMemoCache: wr,
        useCacheRefresh: kc
      };
      yd.useEffectEvent = fc;
      var jo = {
        enqueueSetState: function(t, e, a) {
          t = t._reactInternals;
          var i = ve(), c = gn(i);
          c.payload = e, a != null && (c.callback = a), e = bn(t, c, i), e !== null && (me(e, t, i), La(e, t, i));
        },
        enqueueReplaceState: function(t, e, a) {
          t = t._reactInternals;
          var i = ve(), c = gn(i);
          c.tag = 1, c.payload = e, a != null && (c.callback = a), e = bn(t, c, i), e !== null && (me(e, t, i), La(e, t, i));
        },
        enqueueForceUpdate: function(t, e) {
          t = t._reactInternals;
          var a = ve(), i = gn(a);
          i.tag = 2, e != null && (i.callback = e), e = bn(t, i, a), e !== null && (me(e, t, a), La(e, t, a));
        }
      }, Oo = Error(o(461)), Kt = !1, Ro = {
        dehydrated: null,
        treeContext: null,
        retryLane: 0,
        hydrationErrors: null
      }, sn = !1, Qt = !1, Do = !1, xd = typeof WeakSet == "function" ? WeakSet : Set, Ft = null, Vt = null, he = !1, Ge = null, Da = 8192, Kh = {
        getCacheForType: function(t) {
          var e = Pt(Rt), a = e.data.get(t);
          return a === void 0 && (a = t(), e.data.set(t, a)), a;
        },
        cacheSignal: function() {
          return Pt(Rt).controller.signal;
        }
      }, wi = 0, _i = 1, ki = 2, Si = 3, Ei = 4;
      if (typeof Symbol == "function" && Symbol.for) {
        var ml = Symbol.for;
        wi = ml("selector.component"), _i = ml("selector.has_pseudo_class"), ki = ml("selector.role"), Si = ml("selector.test_id"), Ei = ml("selector.text");
      }
      var Qh = typeof WeakMap == "function" ? WeakMap : Map, xt = 0, At = null, wt = null, _t = 0, Ct = 0, Se = null, Tn = !1, Ba = !1, Bo = !1, cn = 0, Ht = 0, Cn = 0, ia = 0, Ho = 0, Ee = 0, Ha = 0, pl = null, ge = null, Uo = !1, zi = 0, wd = 0, hl = 1 / 0, Ni = null, Mn = null, Xt = 0, An = null, Ua = null, un = 0, qo = 0, Yo = null, _d = null, gl = 0, Go = null;
      return yt.attemptContinuousHydration = function(t) {
        if (t.tag === 13 || t.tag === 31) {
          var e = Xn(t, 67108864);
          e !== null && me(e, t, 67108864), io(t, 67108864);
        }
      }, yt.attemptHydrationAtCurrentPriority = function(t) {
        if (t.tag === 13 || t.tag === 31) {
          var e = ve();
          e = M(e);
          var a = Xn(t, e);
          a !== null && me(a, t, e), io(t, e);
        }
      }, yt.attemptSynchronousHydration = function(t) {
        switch (t.tag) {
          case 3:
            if (t = t.stateNode, t.current.memoizedState.isDehydrated) {
              var e = N(t.pendingLanes);
              if (e !== 0) {
                for (t.pendingLanes |= 2, t.entangledLanes |= 2; e; ) {
                  var a = 1 << 31 - xe(e);
                  t.entanglements[1] |= a, e &= ~a;
                }
                Qe(t), (xt & 6) === 0 && (hl = pe() + 500, ma(0));
              }
            }
            break;
          case 31:
          case 13:
            e = Xn(t, 2), e !== null && me(e, t, 2), bu(), io(t, 2);
        }
      }, yt.batchedUpdates = function(t, e) {
        return t(e);
      }, yt.createComponentSelector = function(t) {
        return { $$typeof: wi, value: t };
      }, yt.createContainer = function(t, e, a, i, c, u, b, C, Y, J) {
        return Du(
          t,
          e,
          !1,
          null,
          a,
          i,
          u,
          null,
          b,
          C,
          Y,
          J
        );
      }, yt.createHasPseudoClassSelector = function(t) {
        return { $$typeof: _i, value: t };
      }, yt.createHydrationContainer = function(t, e, a, i, c, u, b, C, Y, J, et, W, at, gt) {
        return t = Du(
          a,
          i,
          !0,
          t,
          c,
          u,
          C,
          gt,
          Y,
          J,
          et,
          W
        ), t.context = Bu(null), a = t.current, i = ve(), i = M(i), c = gn(i), c.callback = e ?? null, bn(a, c, i), e = i, t.current.lanes = e, D(t, e), Qe(t), t;
      }, yt.createPortal = function(t, e, a) {
        var i = 3 < arguments.length && arguments[3] !== void 0 ? arguments[3] : null;
        return {
          $$typeof: va,
          key: i == null ? null : "" + i,
          children: t,
          containerInfo: e,
          implementation: a
        };
      }, yt.createRoleSelector = function(t) {
        return { $$typeof: ki, value: t };
      }, yt.createTestNameSelector = function(t) {
        return { $$typeof: Si, value: t };
      }, yt.createTextSelector = function(t) {
        return { $$typeof: Ei, value: t };
      }, yt.defaultOnCaughtError = function(t) {
        console.error(t);
      }, yt.defaultOnRecoverableError = function(t) {
        md(t);
      }, yt.defaultOnUncaughtError = function(t) {
        md(t);
      }, yt.deferredUpdates = function(t) {
        var e = ut.T, a = ln();
        try {
          return Wt(32), ut.T = null, t();
        } finally {
          Wt(a), ut.T = e;
        }
      }, yt.discreteUpdates = function(t, e, a, i, c) {
        var u = ut.T, b = ln();
        try {
          return Wt(2), ut.T = null, t(e, a, i, c);
        } finally {
          Wt(b), ut.T = u, xt === 0 && (hl = pe() + 500);
        }
      }, yt.findAllNodes = $r, yt.findBoundingRects = function(t, e) {
        if (!ll) throw Error(o(363));
        e = $r(t, e), t = [];
        for (var a = 0; a < e.length; a++)
          t.push(Sp(e[a]));
        for (e = t.length - 1; 0 < e; e--) {
          a = t[e];
          for (var i = a.x, c = i + a.width, u = a.y, b = u + a.height, C = e - 1; 0 <= C; C--)
            if (e !== C) {
              var Y = t[C], J = Y.x, et = J + Y.width, W = Y.y, at = W + Y.height;
              if (i >= J && u >= W && c <= et && b <= at) {
                t.splice(e, 1);
                break;
              } else if (i !== J || a.width !== Y.width || at < u || W > b) {
                if (!(u !== W || a.height !== Y.height || et < i || J > c)) {
                  J > i && (Y.width += J - i, Y.x = i), et < c && (Y.width = c - J), t.splice(e, 1);
                  break;
                }
              } else {
                W > u && (Y.height += W - u, Y.y = u), at < b && (Y.height = b - W), t.splice(e, 1);
                break;
              }
            }
        }
        return t;
      }, yt.findHostInstance = Hu, yt.findHostInstanceWithNoPortals = function(t) {
        return t = d(t), t = t !== null ? x(t) : null, t === null ? null : al(t.stateNode);
      }, yt.findHostInstanceWithWarning = function(t) {
        return Hu(t);
      }, yt.flushPassiveEffects = nl, yt.flushSyncFromReconciler = function(t) {
        var e = xt;
        xt |= 1;
        var a = ut.T, i = ln();
        try {
          if (Wt(2), ut.T = null, t)
            return t();
        } finally {
          Wt(i), ut.T = a, xt = e, (xt & 6) === 0 && ma(0);
        }
      }, yt.flushSyncWork = bu, yt.focusWithin = function(t, e) {
        if (!ll) throw Error(o(363));
        for (t = Wr(t), e = mu(t, e), e = Array.from(e), t = 0; t < e.length; ) {
          var a = e[t++], i = a.tag;
          if (!il(a)) {
            if ((i === 5 || i === 26 || i === 27) && Np(a.stateNode))
              return !0;
            for (a = a.child; a !== null; )
              e.push(a), a = a.sibling;
          }
        }
        return !1;
      }, yt.getFindAllNodesFailureDescription = function(t, e) {
        if (!ll) throw Error(o(363));
        var a = 0, i = [];
        t = [Wr(t), 0];
        for (var c = 0; c < t.length; ) {
          var u = t[c++], b = u.tag, C = t[c++], Y = e[C];
          if ((b !== 5 && b !== 26 && b !== 27 || !il(u)) && (Fr(u, Y) && (i.push(Ir(Y)), C++, C > a && (a = C)), C < e.length))
            for (u = u.child; u !== null; )
              t.push(u, C), u = u.sibling;
        }
        if (a < e.length) {
          for (t = []; a < e.length; a++)
            t.push(Ir(e[a]));
          return `findAllNodes was able to match part of the selector:
  ` + (i.join(" > ") + `

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
          version: np,
          rendererPackageName: ap,
          currentDispatcherRef: ut,
          reconcilerVersion: "19.2.0"
        };
        if (Qu !== null && (t.rendererConfig = Qu), typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ > "u") t = !1;
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
      }, yt.observeVisibleRects = function(t, e, a, i) {
        if (!ll) throw Error(o(363));
        t = $r(t, e);
        var c = Tp(
          t,
          a,
          i
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
      }, yt.startHostTransition = function(t, e, a, i) {
        if (t.tag !== 5) throw Error(o(476));
        var c = wc(t).queue;
        xc(
          t,
          c,
          e,
          xa,
          a === null ? r : function() {
            var u = wc(t);
            return u.next === null && (u = t.alternate.memoizedState), Wa(
              t,
              u.next.queue,
              {},
              ve()
            ), a(i);
          }
        );
      }, yt.updateContainer = function(t, e, a, i) {
        var c = e.current, u = ve();
        return Uu(
          c,
          u,
          t,
          e,
          a,
          i
        ), u;
      }, yt.updateContainerSync = function(t, e, a, i) {
        return Uu(
          e.current,
          2,
          t,
          e,
          a,
          i
        ), 2;
      }, yt;
    }, n.exports.default = n.exports, Object.defineProperty(n.exports, "__esModule", { value: !0 });
  })(Lo)), Lo.exports;
}
var Dd;
function w0() {
  return Dd || (Dd = 1, Vo.exports = x0()), Vo.exports;
}
var _0 = w0();
const k0 = /* @__PURE__ */ ys(_0);
var Jo = { exports: {} }, dn = {};
/**
 * @license React
 * react-reconciler-constants.production.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var Bd;
function S0() {
  return Bd || (Bd = 1, dn.ConcurrentRoot = 1, dn.ContinuousEventPriority = 8, dn.DefaultEventPriority = 32, dn.DiscreteEventPriority = 2, dn.IdleEventPriority = 268435456, dn.LegacyRoot = 0, dn.NoEventPriority = 0), dn;
}
var Hd;
function E0() {
  return Hd || (Hd = 1, Jo.exports = S0()), Jo.exports;
}
var zl = E0();
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
const Tf = ["accent", "panel-bg", "surface-0", "surface-1", "surface-dim", "overlay-0", "overlay-1", "text", "subtext-0", "mauve", "green", "yellow", "red", "blue", "teal", "peach", "backdrop", "card-bg"], ls = 16, Cf = /* @__PURE__ */ new Set(["hover", "focus", "focus-visible", "focus-within", "active"]), z0 = [
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
], Ud = {
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
}, is = ["font-size", "color", ...new Set([...Object.keys(Mf), ...Object.keys(Af)].filter((n) => n !== "font-size" && n !== "color"))], T0 = new Set(is);
function ie(n, l = " ") {
  const s = [];
  let r = 0, o = "";
  for (let f = 0; f < n.length; f++) {
    const m = n[f];
    if (m === "(" ? r++ : m === ")" && r--, r === 0 && (l === " " ? /\s/.test(m) : m === l)) {
      (o.trim() || l !== " ") && s.push(o.trim()), o = "";
      continue;
    }
    o += m;
  }
  return (o.trim() || l !== " " && s.length) && s.push(o.trim()), s;
}
function rs(n, l, s = 0) {
  if (s > 32) return null;
  let r = "", o = 0;
  for (; ; ) {
    const f = n.indexOf("var(", o);
    if (f < 0)
      return r += n.slice(o), r;
    r += n.slice(o, f);
    let m = 1, d = f + 4;
    for (; d < n.length && m; d++)
      n[d] === "(" ? m++ : n[d] === ")" && m--;
    const p = n.slice(f + 4, d - 1), x = ie(p, ","), k = x[0].trim(), S = x.length > 1 ? p.slice(p.indexOf(",") + 1).trim() : null;
    let w = l(k);
    if ((w == null || w === "initial") && (w = S), w == null) return null;
    const z = rs(w, l, s + 1);
    if (z === null) return null;
    r += z, o = d;
  }
}
function C0(n) {
  const l = [], s = /\s*(?:(-?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)(%|[a-z]+)?|([a-z-]+)\(|(infinity)|([()+*/,])|(-)(?=\s))/giy;
  let r, o = 0;
  for (; o < n.length; ) {
    if (s.lastIndex = o, r = s.exec(n), !r || r.index !== o) {
      if (/^\s+$/.test(n.slice(o))) break;
      return null;
    }
    o = s.lastIndex, r[1] !== void 0 ? l.push({ num: parseFloat(r[1]), unit: (r[2] ?? "").toLowerCase() }) : r[3] ? l.push({ fn: r[3].toLowerCase() }) : r[4] ? l.push({ num: 1 / 0, unit: "" }) : l.push({ op: r[5] ?? r[6] });
  }
  return l;
}
function Yn(n, l) {
  const s = C0(n.trim().replace(/env\(\s*safe-area-inset-(?:top|right|bottom|left)\s*(?:,[^()]*)?\)/gi, "0px"));
  if (!s) return null;
  let r = 0;
  const o = ({ num: w, unit: z }) => {
    switch (z) {
      case "":
        return { px: 0, pct: 0, num: w, unitless: !0 };
      case "px":
        return { px: w, pct: 0, num: 0 };
      case "rem":
        return { px: w * ls, pct: 0, num: 0 };
      case "em":
        return { px: w * (l.fontSize ?? ls), pct: 0, num: 0 };
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
  }, f = (w, z, _) => w && z ? { px: w.px + _ * z.px, pct: w.pct + _ * z.pct, num: w.num + _ * z.num, unitless: w.unitless && z.unitless } : null, m = (w, z) => w ? { px: w.px * z, pct: w.pct * z, num: w.num * z, unitless: w.unitless } : null, d = (w) => w && w.unitless;
  function p() {
    const w = s[r++];
    if (!w) return null;
    if (w.num !== void 0) return o(w);
    if (w.op === "(") {
      const z = k();
      return s[r]?.op !== ")" ? null : (r++, z);
    }
    if (w.op === "-" || w.op === "+") {
      const z = p();
      return w.op === "-" ? m(z, -1) : z;
    }
    if (w.fn) {
      const z = [];
      for (; ; ) {
        z.push(k());
        const N = s[r++];
        if (!N) return null;
        if (N.op === ")") break;
        if (N.op !== ",") return null;
      }
      if (z.some((N) => !N)) return null;
      if (w.fn === "calc") return z[0];
      if (!(z.every((N) => !N.pct) || z.every((N) => !N.px && !N.num))) return null;
      const y = (N) => N.px + N.pct + N.num;
      return w.fn === "min" ? z.reduce((N, O) => y(O) < y(N) ? O : N) : w.fn === "max" ? z.reduce((N, O) => y(O) > y(N) ? O : N) : w.fn === "clamp" && z.length === 3 ? y(z[1]) < y(z[0]) ? z[0] : y(z[1]) > y(z[2]) ? z[2] : z[1] : null;
    }
    return null;
  }
  function x() {
    let w = p();
    for (; s[r] && (s[r].op === "*" || s[r].op === "/"); ) {
      const z = s[r++].op, _ = p();
      if (!w || !_) return null;
      z === "*" ? w = d(_) ? m(w, _.num) : d(w) ? m(_, w.num) : null : w = d(_) && _.num !== 0 ? m(w, 1 / _.num) : null;
    }
    return w;
  }
  function k() {
    let w = x();
    for (; s[r] && (s[r].op === "+" || s[r].op === "-"); ) {
      const z = s[r++].op;
      w = f(w, x(), z === "-" ? -1 : 1);
    }
    return w;
  }
  const S = k();
  return r !== s.length || !S ? null : S;
}
function os(n, l) {
  const s = n.trim().toLowerCase();
  if (/^(auto|none|normal|fit-content|max-content|min-content|medium|thin|thick)$/.test(s))
    return s === "thin" ? { px: 1 } : s === "medium" ? { px: 3 } : s === "thick" ? { px: 5 } : s;
  const r = Yn(s, l);
  return r ? r.unitless ? r.num === 0 ? { px: 0 } : { expr: n.trim() } : r.pct && (r.px || r.num) ? { expr: n.trim() } : r.pct ? { pct: r.pct } : { px: M0(r.px) } : { expr: n.trim() };
}
const M0 = (n) => Number.isFinite(n) ? n : n > 0 ? 34e37 : -34e37, Ci = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0"), A0 = ([n, l, s, r]) => `#${Ci(n)}${Ci(l)}${Ci(s)}${Ci(r * 255)}`;
function qd(n) {
  const l = n.slice(1), s = l.length <= 4 ? l.split("").map((o) => o + o).join("") : l;
  if (!/^[0-9a-f]{6}([0-9a-f]{2})?$/i.test(s)) return null;
  const r = (o) => parseInt(s.slice(o, o + 2), 16);
  return [r(0), r(2), r(4), s.length === 8 ? r(6) / 255 : 1];
}
function Vi(n, l) {
  const s = n.trim().toLowerCase();
  if (s === "currentcolor") return "currentcolor";
  const r = /^perchtoken\(([a-z0-9-]+)\)$/.exec(s);
  if (r) {
    const x = l(r[1]), k = x && qd(x);
    return k ? { rgba: k, token: r[1] } : null;
  }
  if (s.startsWith("#")) {
    const x = qd(s);
    return x ? { rgba: x, token: null } : null;
  }
  if (Ud[s]) return { rgba: [...Ud[s]], token: null };
  const o = /^(rgba?|color-mix)\((.*)\)$/s.exec(s);
  if (!o) return null;
  if (o[1] === "color-mix") {
    const x = ie(o[2], ",");
    if (x.length !== 3 || !/^in\s+(srgb|srgb-linear|oklab|lab|oklch|lch|hsl|xyz)/.test(x[0])) return null;
    const k = (X) => {
      const I = ie(X), $ = I.findIndex((P) => /%$/.test(P)), Q = $ >= 0 ? parseFloat(I[$]) / 100 : null;
      return { color: Vi(I.filter((P, G) => G !== $).join(" "), l), pct: Q };
    }, S = k(x[1]), w = k(x[2]);
    if (!S.color || !w.color || S.color === "currentcolor" || w.color === "currentcolor") return null;
    let z = S.pct, _ = w.pct;
    z === null && _ === null ? (z = 0.5, _ = 0.5) : z === null ? z = 1 - _ : _ === null && (_ = 1 - z);
    const y = z + _, N = y < 1 ? y : 1;
    z /= y, _ /= y;
    const [O, R, A, L] = S.color.rgba, [q, D, g, v] = w.color.rgba, h = L * z + v * _, E = (X, I) => h === 0 ? 0 : (X * L * z + I * v * _) / h, M = [E(O, q), E(R, D), E(A, g), h * N], B = v === 0 ? S.color.token : L === 0 ? w.color.token : null;
    return { rgba: M, token: B };
  }
  const f = o[2].includes(",") ? ie(o[2], ",") : ie(o[2].replace("/", " / ")).filter((x) => x !== "/");
  if (f.length < 3) return null;
  const m = (x) => x.endsWith("%") ? parseFloat(x) / 100 * 255 : parseFloat(x), d = f[3] === void 0 ? 1 : f[3].endsWith("%") ? parseFloat(f[3]) / 100 : parseFloat(f[3]), p = [m(f[0]), m(f[1]), m(f[2]), d];
  return p.some((x) => Number.isNaN(x)) ? null : { rgba: p, token: null };
}
const wl = ["top", "right", "bottom", "left"], j0 = ["top-left", "top-right", "bottom-right", "bottom-left"], Mi = (n) => [n[0], n[1] ?? n[0], n[2] ?? n[0], n[3] ?? n[1] ?? n[0]], Yd = /* @__PURE__ */ new Set(["none", "hidden", "solid", "dashed", "dotted", "double", "groove", "ridge", "inset", "outset"]);
function ss(n, l) {
  const s = l.trim(), r = () => ie(s);
  switch (n) {
    case "padding":
    case "margin": {
      const o = Mi(r());
      return wl.map((f, m) => [`${n}-${f}`, o[m]]);
    }
    case "padding-inline":
    case "margin-inline": {
      const o = r(), f = n.split("-")[0];
      return [[`${f}-left`, o[0]], [`${f}-right`, o[1] ?? o[0]]];
    }
    case "padding-block":
    case "margin-block": {
      const o = r(), f = n.split("-")[0];
      return [[`${f}-top`, o[0]], [`${f}-bottom`, o[1] ?? o[0]]];
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
      const o = Mi(r());
      return wl.map((f, m) => [f, o[m]]);
    }
    case "inset-inline": {
      const o = r();
      return [["left", o[0]], ["right", o[1] ?? o[0]]];
    }
    case "inset-block": {
      const o = r();
      return [["top", o[0]], ["bottom", o[1] ?? o[0]]];
    }
    case "inset-inline-start":
      return [["left", s]];
    case "inset-inline-end":
      return [["right", s]];
    case "border-width":
    case "border-style":
    case "border-color": {
      const o = n.split("-")[1], f = Mi(r());
      return wl.map((m, d) => [`border-${m}-${o}`, f[d]]);
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
      const o = n === "border" ? wl : n === "border-inline" ? ["left", "right"] : n === "border-block" ? ["top", "bottom"] : n === "border-inline-start" ? ["left"] : n === "border-inline-end" ? ["right"] : [n.slice(7)];
      let f = "medium", m = "none", d = "currentcolor";
      if (s !== "none" && s !== "0")
        for (const p of r())
          Yd.has(p) ? m = p : /^(thin|medium|thick|-?[\d.]|calc\()/.test(p) ? f = p : d = p;
      else s === "0" && (f = "0");
      return o.flatMap((p) => [[`border-${p}-width`, f], [`border-${p}-style`, m], [`border-${p}-color`, d]]);
    }
    case "border-inline-width": {
      const o = r();
      return [["border-left-width", o[0]], ["border-right-width", o[1] ?? o[0]]];
    }
    case "border-block-width": {
      const o = r();
      return [["border-top-width", o[0]], ["border-bottom-width", o[1] ?? o[0]]];
    }
    case "border-inline-style": {
      const o = r();
      return [["border-left-style", o[0]], ["border-right-style", o[1] ?? o[0]]];
    }
    case "border-inline-color": {
      const o = r();
      return [["border-left-color", o[0]], ["border-right-color", o[1] ?? o[0]]];
    }
    case "border-radius": {
      const o = Mi(ie(s.split("/")[0]));
      return j0.map((f, m) => [`border-${f}-radius`, o[m]]);
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
      return s === "none" ? [["background-color", "transparent"], ["background-image", "none"]] : Vi(s, () => "#000000") ? [["background-color", s], ["background-image", "none"]] : [["background-color", "transparent"], ["background-image", s]];
    // ponytail: only the CSS-wide keywords (`[font:inherit]` on a button); a full `font` value is kept unexpanded.
    case "font":
      return /^(inherit|initial|unset|revert|revert-layer)$/.test(s) ? ["font-family", "font-size", "font-weight", "font-style", "line-height"].map((o) => [o, s]) : [[n, s]];
    case "overflow": {
      const o = r();
      return [["overflow-x", o[0]], ["overflow-y", o[1] ?? o[0]]];
    }
    case "gap": {
      const o = r();
      return [["row-gap", o[0]], ["column-gap", o[1] ?? o[0]]];
    }
    case "grid-gap":
      return ss("gap", s);
    case "place-items": {
      const o = r();
      return [["align-items", o[0]], ["justify-items", o[1] ?? o[0]]];
    }
    case "place-self": {
      const o = r();
      return [["align-self", o[0]], ["justify-self", o[1] ?? o[0]]];
    }
    case "place-content": {
      const o = r();
      return [["align-content", o[0]], ["justify-content", o[1] ?? o[0]]];
    }
    case "flex": {
      if (s === "none") return [["flex-grow", "0"], ["flex-shrink", "0"], ["flex-basis", "auto"]];
      if (s === "auto") return [["flex-grow", "1"], ["flex-shrink", "1"], ["flex-basis", "auto"]];
      if (s === "initial") return [["flex-grow", "0"], ["flex-shrink", "1"], ["flex-basis", "auto"]];
      const o = r(), f = o.filter((d) => /^[\d.]+$/.test(d)), m = o.find((d) => !/^[\d.]+$/.test(d));
      return [["flex-grow", f[0] ?? "1"], ["flex-shrink", f[1] ?? "1"], ["flex-basis", m ?? (f.length ? "0%" : "auto")]];
    }
    case "flex-flow": {
      const o = [];
      for (const f of r()) o.push(/wrap/.test(f) ? ["flex-wrap", f] : ["flex-direction", f]);
      return o;
    }
    case "outline": {
      if (s === "none" || s === "0") return [["outline-style", "none"], ["outline-width", "medium"], ["outline-color", "currentcolor"]];
      let o = "medium", f = "none", m = "currentcolor";
      for (const d of r())
        Yd.has(d) || d === "auto" ? f = d : /^(thin|medium|thick|-?[\d.]|calc\()/.test(d) ? o = d : m = d;
      return [["outline-width", o], ["outline-style", f], ["outline-color", m]];
    }
    case "transition": {
      if (s === "none") return [["transition-property", "none"], ["transition-duration", "0s"]];
      const o = ie(s, ","), f = o.map((d) => ie(d).find((p) => !/^[\d.]+m?s$/.test(p) && !/^(ease|linear|step|cubic)/.test(p)) ?? "all"), m = o.map((d) => ie(d).find((p) => /^[\d.]+m?s$/.test(p)) ?? "0s");
      return [["transition-property", f.join(", ")], ["transition-duration", m.join(", ")]];
    }
    case "text-decoration":
      return [["text-decoration-line", r()[0] ?? "none"]];
    case "-webkit-user-select":
      return [["user-select", s]];
    case "word-wrap":
      return [["overflow-wrap", s]];
    default:
      return [[n, s]];
  }
}
function O0(n, l) {
  return n ? ie(n, ",").some((s) => {
    let r = s.trim().toLowerCase(), o = !1;
    r.startsWith("not ") && (o = !0, r = r.slice(4)), r.startsWith("only ") && (r = r.slice(5));
    const f = r.split(/\s+and\s+/).every((m) => {
      if (m = m.trim(), m === "all" || m === "screen") return !0;
      if (m === "print") return !1;
      const d = /^\((.+)\)$/.exec(m);
      if (!d) return !1;
      const p = d[1].trim(), x = /^([a-z-]+)\s*:\s*(.+)$/.exec(p);
      if (x) {
        const [, S, w] = x, z = (_) => {
          const y = os(_, { viewport: l });
          return typeof y == "object" && "px" in y ? y.px : NaN;
        };
        switch (S) {
          case "min-width":
            return l.width >= z(w);
          case "max-width":
            return l.width <= z(w);
          case "min-height":
            return l.height >= z(w);
          case "max-height":
            return l.height <= z(w);
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
        const S = k[1] === "width" ? l.width : l.height, w = os(k[3], { viewport: l }), z = typeof w == "object" && "px" in w ? w.px : NaN;
        switch (k[2]) {
          case ">=":
            return S >= z;
          case "<=":
            return S <= z;
          case ">":
            return S > z;
          case "<":
            return S < z;
          default:
            return S === z;
        }
      }
      return !1;
    });
    return o ? !f : f;
  }) : !0;
}
function R0(n, l) {
  const s = l[l.length - 1].compound;
  return xs(s)[0] ?? n;
}
function D0(n) {
  const l = /* @__PURE__ */ new Set(), s = /* @__PURE__ */ new Set(), r = (o, f) => {
    o.forEach(({ compound: m }, d) => {
      const p = f && d === o.length - 1;
      for (const x of m.pseudos)
        if (Cf.has(x.name) && (p ? l : s).add(x.name), x.list && x.name !== "not") for (const k of x.list) r(k, p);
    });
  };
  return r(n, !0), { subject: l, ancestor: s };
}
function xs(n) {
  const l = [...n.classes];
  for (const s of n.pseudos)
    if (!(s.name !== "is" && s.name !== "where"))
      for (const r of s.list) r.length === 1 && l.push(...xs(r[0].compound));
  return l;
}
function B0(n, l) {
  const s = (r, o) => {
    r.forEach(({ compound: f }, m) => {
      const d = o && m === r.length - 1, p = f.pseudos.filter((x) => Cf.has(x.name)).map((x) => x.name);
      if (!d) for (const x of p) for (const k of xs(f)) l.add(`${x}:${k}`);
      for (const x of f.pseudos) if (x.list && x.name !== "not") for (const k of x.list) s(k, d);
    });
  };
  s(n, !0);
}
class H0 {
  constructor(l) {
    this.properties = l.properties ?? {}, this.rules = [], this.skipped = 0, this.index = /* @__PURE__ */ new Map(), this.trackedStates = /* @__PURE__ */ new Set();
    const s = (f, m) => {
      const d = m[m.length - 1].compound, p = d.classes.length ? `.${d.classes[0]}` : d.tag && d.tag !== "*" ? d.tag : "*";
      this.index.has(p) || this.index.set(p, []), this.index.get(p).push(f);
    };
    let r = 0;
    const o = (f, m) => {
      for (const [d, p, x, k] of f)
        for (const S of gs(d)) {
          let w;
          try {
            w = bs(S);
          } catch (N) {
            if (N instanceof le) {
              this.skipped++;
              continue;
            }
            throw N;
          }
          const z = D0(w);
          B0(w, this.trackedStates);
          const _ = w[w.length - 1].compound.pseudoElement, y = { steps: w, media: p, layer: x, origin: m, order: r++, specificity: bf(w), decls: k, states: z, pseudo: _, source: m === 0 ? `ua:${w[w.length - 1].compound.tag ?? "*"}` : R0(S, w) };
          this.rules.push(y), s(y, w);
        }
    };
    o(z0.map(([f, m]) => [f, null, 0, Object.entries(m)]), 0), o(l.rules, 1);
  }
  /** Rules that may match `element` (by its classes, its tag, and the universal ones), or its `pseudo` box
   * (`before`, `after`). */
  candidates(l, s = null) {
    const r = [], o = /* @__PURE__ */ new Set(), f = (m) => {
      if (m) for (const d of m) !o.has(d) && d.pseudo === s && (o.add(d), r.push(d));
    };
    for (const m of l.classList) f(this.index.get(`.${m}`));
    return f(this.index.get(l.tagName)), f(this.index.get("*")), r;
  }
  /** Whether a rule that may match `element` reads interaction `state` on one of its ancestors (`group-hover:`). */
  readsAncestor(l, s) {
    return this.candidates(l).some((r) => r.states.ancestor.has(s));
  }
  /** Whether `element` carries a class whose interaction state some rule reads on an ancestor. */
  tracks(l, s) {
    for (const r of l.classList) if (this.trackedStates.has(`${s}:${r}`)) return !0;
    return !1;
  }
}
const U0 = /* @__PURE__ */ new Set(["opacity", "z-index", "flex-grow", "flex-shrink", "font-weight", "line-height", "flex", "order", "-webkit-line-clamp", "zoom"]);
function q0(n) {
  if (!n || typeof n != "object") return [];
  const l = [];
  for (const [s, r] of Object.entries(n)) {
    if (r == null || r === "" || typeof r == "boolean") continue;
    const o = s.startsWith("--") ? s : s.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`).replace(/^(webkit|moz|ms)-/, "-$1-"), f = typeof r == "number" && r !== 0 && !U0.has(o) && !o.startsWith("--") ? `${r}px` : String(r);
    l.push([o, f]);
  }
  return l;
}
function Y0(n) {
  if (n.tagName !== "svg") return [];
  const l = [];
  for (const s of ["width", "height"]) {
    const r = n.getAttribute(s);
    r !== null && l.push([s, /^[\d.]+$/.test(r) ? `${r}px` : r]);
  }
  return l;
}
const G0 = (n, l) => n.important - l.important || n.origin - l.origin || n.layer - l.layer || n.specificity[0] - l.specificity[0] || n.specificity[1] - l.specificity[1] || n.specificity[2] - l.specificity[2] || n.order - l.order;
class K0 {
  constructor(l, { theme: s, viewport: r }) {
    this.sheet = l, this.theme = s, this.viewport = r, this.parsed = /* @__PURE__ */ new Map(), this.computed = /* @__PURE__ */ new WeakMap(), this.rootComputed = /* @__PURE__ */ new Map();
  }
  themeHex(l) {
    return this.theme?.[l] ?? null;
  }
  /** Rules matching `element`; `assume` is the set of interaction states assumed on the element itself
   * (`"*"`: any, for finding variant rules). Ancestors use their real state. */
  matching(l, s, r = null) {
    const o = (f, m, d) => {
      if (m === "disabled") return !!f.props?.disabled && ["button", "input", "select", "textarea", "fieldset"].includes(f.tagName);
      if (m === "enabled") return !f.props?.disabled && ["button", "input", "select", "textarea"].includes(f.tagName);
      if (m === "checked") return !!f.props?.checked;
      if (s === "*") return !0;
      if (m === "focus-within") {
        const p = f.ownerDocument?.activeElement;
        return !!p && p !== f.ownerDocument.body && typeof f.contains == "function" && f.contains(p);
      }
      return d ? s.has(m) : m === "focus-visible" ? !!f.state?.focus && !f.state?.pointerFocus : !!f.state?.[m];
    };
    return this.sheet.candidates(l, r).filter((f) => (!f.media || f.media.every((m) => O0(m, this.viewport))) && xf(l, f.steps, { state: o, pseudo: r }));
  }
  /** `element`'s computed style, or with `pseudo` (`before`, `after`) that of its pseudo-element's box, whose parent
   * is the element (pass the element's own computed style as `parent`). */
  compute(l, s, r = /* @__PURE__ */ new Set(), o = null) {
    const f = this.matching(l, r, o), m = o ? [] : Y0(l), d = o ? [] : q0(l.inlineStyle ?? l.props?.style);
    let p = this.rootComputed;
    s && (p = this.computed.get(s.values), p || this.computed.set(s.values, p = /* @__PURE__ */ new Map()));
    const x = `${f.map((S) => S.order).join(",")}|${m.length ? JSON.stringify(m) : ""}|${d.length ? JSON.stringify(d) : ""}`;
    let k = p.get(x);
    return k || p.set(x, k = this.cascade(f, m, d, s)), { ...k, rules: f, element: l };
  }
  /** The computed style from the matched `rules`, presentational `attrs`, `inline` declarations and the parent's. */
  cascade(l, s, r, o) {
    const f = [];
    for (const g of l)
      for (const [v, h, E] of g.decls) f.push({ prop: v, value: h, important: E ? 1 : 0, origin: g.origin === 0 ? 0 : 2, layer: g.layer, specificity: g.specificity, order: g.order, source: g.source });
    for (const [g, v] of s) f.push({ prop: g, value: v, important: 0, origin: 1, layer: 0, specificity: [0, 0, 0], order: 0, source: `attr:${g}` });
    for (const [g, v] of r) f.push({ prop: g, value: v, important: 0, origin: 3, layer: 0, specificity: [1, 0, 0], order: 0, source: "style" });
    f.sort(G0);
    const m = this.sheet.properties, d = Object.create(o?.customs ?? null), p = /* @__PURE__ */ new Map(), x = /* @__PURE__ */ new Map();
    for (const g of f) g.prop.startsWith("--") && x.set(g.prop, g.value);
    if (!o && this.theme) for (const g of Tf) this.theme[g] && x.set(`--${g}`, `perchtoken(${g})`);
    const k = (g) => {
      if (p.has(g)) return p.get(g);
      const v = m[g];
      return v && !v.inherits ? v.initial ?? null : g in d ? d[g] : v?.initial ?? null;
    }, S = /* @__PURE__ */ new Set(), w = (g) => {
      if (!x.has(g)) return k(g);
      if (S.has(g)) return null;
      S.add(g);
      const v = rs(x.get(g), w);
      return S.delete(g), x.delete(g), p.set(g, v), (!m[g] || m[g].inherits) && (d[g] = v), v;
    };
    for (const g of [...x.keys()]) w(g);
    const z = /* @__PURE__ */ new Map();
    for (const g of f) {
      if (g.prop.startsWith("--")) continue;
      const v = rs(g.value, k);
      if (v === null) {
        for (const [h] of ss(g.prop, "unset")) z.set(h, { value: "unset", source: g.source, origin: g.origin });
        continue;
      }
      for (const [h, E] of ss(g.prop, v)) z.set(h, { value: E, source: g.source, origin: g.origin });
    }
    const _ = {}, y = {}, N = /* @__PURE__ */ new Set(), O = /* @__PURE__ */ new Set(), R = o?.values, A = { fontSize: R?.["font-size"] ?? ls, viewport: this.viewport }, L = (g, v) => {
      if (/currentcolor/i.test(v)) return this.parseValue(g, v, A, _, R);
      const h = `${g}\0${v}\0${A.fontSize}`;
      let E = this.parsed.get(h);
      return E === void 0 && this.parsed.set(h, E = this.parseValue(g, v, A, _, R)), E;
    }, q = z.size ? [...is, ...[...z.keys()].filter((g) => !T0.has(g))] : is;
    for (const g of q) {
      const v = z.get(g);
      let h = v?.value;
      const E = N0.has(g);
      if ((h === void 0 || h === "unset" || h === "revert" || h === "revert-layer") && (h = E ? "inherit" : "initial"), v && (y[g] = v.source, v.origin !== 0 && N.add(g)), h === "inherit" && R && g in R) {
        _[g] = R[g], O.add(g);
        continue;
      }
      (h === "inherit" || h === "initial") && (h = E ? Af[g] : Mf[g]), _[g] = L(g, h), g === "font-size" && (A.fontSize = _["font-size"]);
    }
    for (const g of wl) {
      const v = _[`border-${g}-style`];
      (v === "none" || v === "hidden") && (_[`border-${g}-width`] = { px: 0 });
    }
    _["outline-style"] === "none" && (_["outline-width"] = { px: 0 });
    const D = R?.display;
    return (D === "flex" || D === "inline-flex" || D === "grid" || D === "inline-grid") && _.position !== "absolute" && _.position !== "fixed" && (_.display = Gd(_.display)), (_.position === "absolute" || _.position === "fixed") && (_.display = Gd(_.display)), { values: _, sources: y, own: N, inherited: O, customs: d };
  }
  parseValue(l, s, r, o, f) {
    const m = String(s).trim();
    switch (l) {
      case "font-size": {
        const d = m.toLowerCase(), p = { "xx-small": 9, "x-small": 10, small: 13, medium: 16, large: 18, "x-large": 24, "xx-large": 32 };
        if (p[d]) return p[d];
        if (d === "smaller") return r.fontSize / 1.2;
        if (d === "larger") return r.fontSize * 1.2;
        const x = Yn(d, { fontSize: r.fontSize, viewport: r.viewport });
        return !x || x.num ? r.fontSize : x.px + x.pct / 100 * r.fontSize;
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
        const p = Yn(d, { fontSize: r.fontSize, viewport: r.viewport });
        return p ? p.unitless ? { factor: p.num } : { px: p.px + p.pct / 100 * r.fontSize } : { normal: !0 };
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
        const d = Vi(m, (p) => this.themeHex(p));
        return d === "currentcolor" || !d ? f?.color ?? { rgba: [0, 0, 0, 1], token: null } : d;
      }
      case "background-color":
      case "border-top-color":
      case "border-right-color":
      case "border-bottom-color":
      case "border-left-color":
      case "outline-color": {
        const d = Vi(m, (p) => this.themeHex(p));
        return d === "currentcolor" ? o.color : d ?? { rgba: [0, 0, 0, 0], token: null, unreadable: m };
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
        return os(m, r);
      default:
        return m.toLowerCase().startsWith("var(") ? m : /^[a-z-]+$/i.test(m) ? m.toLowerCase() : m;
    }
  }
}
function Gd(n) {
  return n === "inline" || n === "inline-block" || n === "contents" ? "block" : n === "inline-flex" ? "flex" : n === "inline-grid" ? "grid" : n;
}
const Li = (n) => n && n.rgba ? { value: A0(n.rgba), token: n.token ?? null } : null, Q0 = { 9.28: 11, 9.92: 12, 10.4: 12, 10.88: 13, 11: 13, 11.2: 13, 11.52: 13, 12: 15, 12.5: 15, 13: 16, 14: 17, 16: 19 };
function V0(n, l) {
  const s = l?.(n);
  if (Number.isFinite(s)) return s;
  const r = Math.round(n * 100) / 100;
  return Q0[r] ?? Math.round(n * 1.2);
}
function kl(n, l) {
  const s = n["line-height"], r = n["font-size"];
  return s.normal ? V0(r, l) : s.factor !== void 0 ? s.factor * r : s.px;
}
const L0 = (n) => ie(n, ",").map((l) => l.trim().replace(/^["']|["']$/g, "")).join(", ");
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
const X0 = "perch-native-description/1", Hn = Symbol("display"), Xi = {
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
for (const n of Z0) Xi[n] = /^(w|h|min_|max_|top|right|bottom|left)/.test(n) ? "auto" : 0;
Xi.rounded = 0;
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
]), W0 = /(-apple-system|blinkmacsystemfont|system-ui|segoe ui|sans-serif|times)/i, F0 = /(ui-monospace|sfmono|sf mono|menlo|monospace)/i, I0 = (n) => F0.test(n) ? "Menlo" : /^\s*system-ui\s*$/i.test(n ?? "") ? ".AppleSystemUIFont" : W0.test(n) ? ".SystemUIFont" : L0(n).split(",")[0].trim(), $0 = {
  click: ["onClick", "onClickCapture"],
  double_click: ["onDoubleClick"],
  context_menu: ["onContextMenu"],
  mouse_down: ["onPointerDown", "onMouseDown", "onPointerDownCapture", "onMouseDownCapture"],
  mouse_up: ["onPointerUp", "onMouseUp", "onPointerCancel"],
  mouse_move: ["onPointerMove", "onMouseMove"],
  key_down: ["onKeyDown", "onKeyUp"],
  focus: ["onFocus", "onBlur"],
  input: ["onChange", "onInput"]
}, Kd = { pointerdown: "mouse_down", mousedown: "mouse_down", click: "click", keydown: "key_down", pointerup: "mouse_up", mouseup: "mouse_up" }, ws = (n) => {
  const l = n.props["data-testid"];
  if (l) return `${n.tagName}[data-testid="${l}"]`;
  if (n.props.id) return `${n.tagName}#${n.props.id}`;
  const s = n.classList.find((o) => !o.includes(":") && !o.includes("[")) ?? n.classList[0];
  if (s) return `${n.tagName}.${s}`;
  const r = n.parentElement;
  return r && r.tagName !== "body" ? `${ws(r)} > ${n.tagName}` : n.tagName;
};
class P0 {
  constructor() {
    this.map = /* @__PURE__ */ new Map();
  }
  add(l, s, r, o, f, m = "") {
    const d = `${l}|${s}|${r}|${o}`, p = this.map.get(d);
    if (p) {
      !p.elements.includes(f) && p.elements.length < 4 && p.elements.push(f), p.count++;
      return;
    }
    this.map.set(d, { kind: l, property: s, value: String(r), class: o ?? null, elements: [f], count: 1, ...m ? { note: m } : {} });
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
  const r = ie(s[1], ",").map((o) => Yn(o.trim(), { fontSize: l })).filter((o) => o && !o.pct && !o.num).map((o) => o.px);
  return r.length ? Math.min(...r) : void 0;
}
function ag(n, l) {
  if (typeof n != "object" || !n?.expr) return !1;
  const s = Yn(n.expr, { fontSize: l["font-size"] }), r = (l["margin-left"]?.px ?? NaN) + (l["margin-right"]?.px ?? NaN);
  return !!s && !s.num && s.pct === 100 && Math.abs(s.px + r) < 0.01;
}
function jf(n) {
  const l = n.transform;
  if (l && l !== "none") {
    const r = /^\s*translate(X|Y)?\(([^]*)\)\s*$/.exec(l), o = r && ie(r[2], ",").map((f) => f.trim());
    return !o || o.length > (r[1] ? 1 : 2) ? null : r[1] === "X" ? [o[0], "0"] : r[1] === "Y" ? ["0", o[0]] : [o[0], o[1] ?? "0"];
  }
  const s = n.translate;
  if (s && s !== "none") {
    const r = ie(String(s).trim(), " ").filter(Boolean);
    return r.length > 3 || r[2] !== void 0 && Yn(r[2], {})?.px ? null : [r[0], r[1] ?? "0"];
  }
  return [];
}
function Qd(n, l, s, r = !1) {
  const o = n.values, f = jf(o);
  if (f?.length === 0) return;
  const m = o.transform && o.transform !== "none" ? "transform" : "translate", d = { fontSize: o["font-size"] }, p = (S, w) => {
    const z = Yn(S, d);
    if (!(!z || z.unitless && z.num))
      return z.pct ? typeof w == "number" ? z.px + z.pct / 100 * w : void 0 : z.px;
  }, x = f ? p(f[0], l.w) : void 0, k = f ? p(f[1], l.h) : void 0;
  if (x === void 0 || k === void 0) {
    const S = !r && f ? f.map((w) => Yn(w, d)) : null;
    if (S?.every((w) => w && !(w.unitless && w.num))) {
      l[Of] = S.map((w) => [w.px, w.pct ?? 0]);
      return;
    }
    s("unsupported", m, o[m], n.sources[m]);
    return;
  }
  if (r) {
    x && (l.left = x), k && (l.top = k);
    return;
  }
  x && (l.ml = (l.ml ?? 0) + x), k && (l.mt = (l.mt ?? 0) + k);
}
const Of = Symbol("perch.shift");
function lg(n, l, s) {
  const r = n.ownerDocument, o = r?.measure?.(n) ?? null;
  if (o) {
    const [[m, d], [p, x]] = s, k = m + d / 100 * o.width, S = p + x / 100 * o.height;
    k && (l.ml = (typeof l.ml == "number" ? l.ml : 0) + k), S && (l.mt = (typeof l.mt == "number" ? l.mt : 0) + S);
  }
  const f = o ? `${o.width}x${o.height}` : "";
  f === n.shiftSeen ? n.shiftTries = 0 : (n.shiftTries ?? 0) < kf && r?.retries && (n.shiftSeen = f, n.shiftTries = (n.shiftTries ?? 0) + 1, r.retries.push(() => r.afterCommit?.()));
}
function qi(n, l, s = null) {
  const r = n.values, o = {}, f = (A) => n.sources[A], m = (A) => n.sources[A] !== void 0, d = r.display;
  d === "none" ? o.display = "hidden" : d === "flex" || d === "inline-flex" ? o.display = "flex" : (d === "grid" || d === "inline-grid") && (o.display = "flex", o.flex_direction = "col", l("approximated", "display", d, f("display"), "one-column flex column"), r["grid-template-columns"] && r["grid-template-columns"] !== "none" && l("unsupported", "grid-template-columns", r["grid-template-columns"], f("grid-template-columns"))), n.element.hidden && (o.display = "hidden");
  const p = o.display === "flex";
  if (p && o.flex_direction !== "col") {
    const A = { row: "row", column: "col", "row-reverse": "row_reverse", "column-reverse": "col_reverse" }[r["flex-direction"]] ?? "row";
    o.flex_direction = A;
  }
  if (p) {
    (r["flex-wrap"] === "wrap" || r["flex-wrap"] === "wrap-reverse") && (o.flex_wrap = "wrap");
    const A = d === "grid" || d === "inline-grid", L = { "flex-start": "start", start: "start", "self-start": "start", "flex-end": "end", end: "end", "self-end": "end", center: "center", baseline: "baseline", "first baseline": "baseline" }[r["align-items"]];
    L && (o.items = L);
    let q = { "flex-start": "start", start: "start", "flex-end": "end", end: "end", center: "center", "space-between": "between", "space-around": "around", "space-evenly": "evenly" }[r["justify-content"]];
    if (A) {
      const v = { center: "center", end: "end", "flex-end": "end", start: "start", "flex-start": "start" }[r["justify-items"]];
      v && (o.items = v), r["align-items"] === "center" && (q = "center");
    }
    q && (o.justify = q);
    const D = mn(r["row-gap"]), g = mn(r["column-gap"]);
    typeof D == "number" && D && (o.gap_y = D), typeof g == "number" && g && !A && (o.gap_x = g);
  }
  r["flex-grow"] && (o.flex_grow = r["flex-grow"]), r["flex-shrink"] !== 1 && (o.flex_shrink = r["flex-shrink"]);
  const x = mn(r["flex-basis"]);
  x !== void 0 && x !== "auto" && (o.flex_basis = x);
  const k = { "flex-start": "start", start: "start", "flex-end": "end", end: "end", center: "center", baseline: "baseline", stretch: "stretch" }[r["align-self"]];
  k && (o.self = k);
  for (const [A, L] of [["w", "width"], ["h", "height"], ["min_w", "min-width"], ["min_h", "min-height"], ["max_w", "max-width"], ["max_h", "max-height"]]) {
    const q = r[L], D = mn(q);
    if (D === void 0 && L === "width" && ag(q, r)) {
      o.self = "stretch", l("approximated", L, q.expr, f(L), "stretched across its parent, inside its margins");
      continue;
    }
    const g = D === void 0 && /^max-/.test(L) ? ng(q, r["font-size"]) : void 0;
    if (g !== void 0) {
      o[A] = g, l("approximated", L, q.expr, f(L), "the fixed bound of min()");
      continue;
    }
    if (D === void 0) {
      typeof q == "object" && q.expr ? l("unsupported", L, q.expr, f(L), "no calc() in the engine") : typeof q == "string" && !["auto", "none"].includes(q) && l("unsupported", L, q, f(L));
      continue;
    }
    D !== "auto" && (o[A] = D);
  }
  const S = ["top", "right", "bottom", "left"];
  for (const A of S) {
    const L = A[0];
    for (const [q, D] of [["p", "padding"], ["m", "margin"]]) {
      const g = r[`${D}-${A}`], v = mn(g);
      if (v === void 0) {
        g?.expr && l("unsupported", `${D}-${A}`, g.expr, f(`${D}-${A}`), "no calc() in the engine");
        continue;
      }
      v !== 0 && (o[`${q}${L}`] = v);
    }
  }
  const w = r.position;
  if (w === "absolute" || w === "fixed") {
    o.position = "absolute", w === "fixed" && l("approximated", "position", "fixed", f("position"), "absolute in the overlay layer");
    for (const A of S) {
      const L = mn(r[A]);
      L !== void 0 && L !== "auto" && (o[A] = L);
    }
    if (w === "fixed" && s && o.w === void 0 && o.right === void 0 && typeof o.left == "number") {
      const A = s.width - o.left - (typeof o.ml == "number" ? o.ml : 0) - (typeof o.mr == "number" ? o.mr : 0);
      o.max_w = typeof o.max_w == "number" ? Math.min(o.max_w, A) : A;
    }
    Qd(n, o, l);
  } else w === "sticky" ? l("unsupported", "position", "sticky", f("position")) : jf(r)?.length !== 0 && (o.position = "relative", Qd(n, o, l, !0));
  r["z-index"] !== "auto" && m("z-index") && l("unsupported", "z-index", r["z-index"], f("z-index"), "paint order is tree order");
  for (const [A, L] of [["overflow_x", "overflow-x"], ["overflow_y", "overflow-y"]]) {
    const q = r[L];
    q === "hidden" || q === "clip" ? o[A] = "hidden" : (q === "auto" || q === "scroll") && (o[A] = "scroll");
  }
  (r.visibility === "hidden" || r.visibility === "collapse") && (o.visibility = "invisible");
  const z = r["background-color"];
  z?.unreadable ? l("unsupported", "background-color", z.unreadable, f("background-color")) : z?.rgba && z.rgba[3] > 0 && (o.bg = Li(z)), r["background-image"] && r["background-image"] !== "none" && l("unsupported", "background-image", r["background-image"], f("background-image"));
  const _ = S.map((A) => mn(r[`border-${A}-width`]) || 0), y = [];
  S.forEach((A, L) => {
    if (!_[L]) return;
    o[`border_${A[0]}`] = _[L];
    const q = r[`border-${A}-style`];
    q !== "solid" && l("approximated", `border-${A}-style`, q, f(`border-${A}-style`), "drawn solid");
    const D = Li(r[`border-${A}-color`]);
    D && y.push(D);
  }), y.length && (o.border_color = y[0], y.some((A) => A.value !== y[0].value) && l("approximated", "border-color", y.map((A) => A.value).join(" "), f("border-top-color"), "one border colour"));
  const N = (A) => {
    const L = mn(r[`border-${A}-radius`]) || 0;
    if (typeof L != "string") return L;
    const q = parseFloat(L) / 100, D = [o.w, o.h].filter((g) => typeof g == "number");
    return L === "auto" || !(q > 0) ? 0 : D.length ? Math.round(Math.min(q, 0.5) * Math.min(...D) * 100) / 100 : 9999;
  }, O = ["top-left", "top-right", "bottom-right", "bottom-left"].map(N);
  O.every((A) => A === O[0]) ? O[0] && (o.rounded = O[0]) : ["tl", "tr", "br", "bl"].forEach((A, L) => {
    O[L] && (o[`rounded_${A}`] = O[L]);
  }), r.opacity !== 1 && (o.opacity = Math.round(r.opacity * 1e3) / 1e3);
  const R = r["box-shadow"];
  if (R && R !== "none" && ie(R, ",").some((A) => !/^0(px)?\s+0(px)?\s+(0(px)?\s+)?(0(px)?\s+)?(#0000|transparent|rgba?\(0,\s*0,\s*0,\s*0\))/.test(A.trim())) && (o.shadow = "lg", l("approximated", "box-shadow", R, f("box-shadow"), "the engine's large shadow preset")), r.cursor && r.cursor !== "auto" && !n.inherited.has("cursor")) {
    const A = { pointer: "pointer", default: "default", text: "text", move: "move", "not-allowed": "not_allowed", grab: "move", grabbing: "move" }[r.cursor];
    A ? o.cursor = A : l("unsupported", "cursor", r.cursor, f("cursor"));
  }
  return r["text-overflow"] === "ellipsis" && (o.text_ellipsis = !0), r["text-decoration-line"] === "underline" ? o.underline = !0 : r["text-decoration-line"] && r["text-decoration-line"] !== "none" && l("unsupported", "text-decoration-line", r["text-decoration-line"], f("text-decoration-line")), o;
}
const ig = { "tabular-nums": "tnum", "proportional-nums": "pnum", "lining-nums": "lnum", "oldstyle-nums": "onum", "slashed-zero": "zero", "diagonal-fractions": "frac", "stacked-fractions": "afrc", ordinal: "ordn" };
function Rf(n) {
  if (!n || n === "normal") return "";
  const l = String(n).trim().split(/\s+/).map((s) => ig[s]);
  return l.every(Boolean) ? l.join(",") : null;
}
function Yi(n, l) {
  const s = n.values, r = s["line-height"];
  return {
    text_color: Li(s.color),
    text_size: Math.round(s["font-size"] * 1e3) / 1e3,
    font_features: Rf(s["font-variant-numeric"]) ?? "",
    font_weight: s["font-weight"],
    line_height: r.factor !== void 0 ? { factor: r.factor } : { px: Math.round(kl(s, l) * 1e3) / 1e3 },
    font_family: I0(s["font-family"]),
    italic: s["font-style"] === "italic" || s["font-style"] === "oblique",
    whitespace: s["white-space"] === "nowrap" || s["white-space"] === "pre" ? "nowrap" : "normal",
    text_align: { center: "center", right: "right", end: "right" }[s["text-align"]] ?? "left"
  };
}
const Vd = (n, l) => n.factor !== void 0 ? n.factor * l : n.px, Df = (n, l) => JSON.stringify(n) === JSON.stringify(l);
function Gi(n, l, s) {
  const r = {}, o = (d, p) => p.some((x) => !n.inherited.has(x));
  for (const [d, p] of [["text_color", ["color"]], ["text_size", ["font-size"]], ["font_weight", ["font-weight"]], ["font_family", ["font-family"]], ["italic", ["font-style"]], ["whitespace", ["white-space"]], ["text_align", ["text-align"]], ["font_features", ["font-variant-numeric"]]])
    (o(d, p) || !Df(l[d], s[d])) && (r[d] = l[d]);
  const f = Vd(l.line_height, l.text_size), m = s.line_height ? Vd(s.line_height, l.text_size) : NaN;
  return (o("line_height", ["line-height"]) || !(Math.abs(f - m) <= 1e-3)) && (r.line_height = l.line_height), r;
}
const rg = (n, l) => ({ ...n, ...l });
function Ki(n, l) {
  const s = {};
  for (const [r, o] of Object.entries(n))
    o && typeof o == "object" && "value" in o ? (s[r] = o.value, o.token && (l[r] = o.token)) : r === "line_height" ? s[r] = o.factor !== void 0 ? Math.round(o.factor * 1e3) / 1e3 : `${o.px}px` : r === "italic" ? o && (s.italic = !0) : s[r] = o;
  return s.italic === !1 && delete s.italic, s;
}
function Ld(n, l) {
  const s = {};
  for (const r of /* @__PURE__ */ new Set([...Object.keys(n), ...Object.keys(l)])) {
    const o = n[r], f = l[r];
    Df(o, f) || (s[r] = f === void 0 ? r in Xi ? Xi[r] : null : f);
  }
  return s;
}
function Xd(n, l) {
  const s = n.values;
  for (const [r, o] of Object.entries(n.sources)) {
    if (r.startsWith("--") || J0.has(r) || o.startsWith("ua:")) continue;
    const f = s[r];
    switch (r) {
      case "letter-spacing":
        f !== "normal" && f?.px !== 0 && l("approximated", r, f?.px !== void 0 ? `${Math.round(f.px * 1e3) / 1e3}px` : f, o, f?.px < 0 ? "the run's box is as wide as with the spacing (the glyphs reach past it; where the element clips, the run is drawn smaller to fit)" : "the run is as wide as with the spacing (room after it), the letters are not spread");
        break;
      case "font-variant-numeric":
        f !== "normal" && Rf(f) === null && l("unsupported", r, f, o);
        break;
      case "text-transform":
        f !== "none" && l("approximated", r, f, o, "applied to the text in JS");
        break;
      case "transition-property":
      case "transition-duration": {
        const m = s["transition-duration"];
        r === "transition-property" && m && ie(m, ",").some((d) => parseFloat(d) > 0) && s["transition-property"] !== "none" && l("unsupported", "transition", `${s["transition-property"]} ${m}`, o, "changes are instant (the engine animates only opacity and size)");
        break;
      }
      case "-webkit-line-clamp":
        f !== "none" && l("unsupported", r, f, o, "no line clamp in the engine");
        break;
      case "-webkit-box-orient":
      case "overflow-wrap":
        r === "overflow-wrap" && f !== "normal" && l("approximated", r, f, o, "lines broken by the translator where the box's width is known (`break_anywhere`)");
        break;
      case "outline-style":
      case "outline-width":
      case "outline-color":
        s["outline-style"] !== "none" && r === "outline-style" && l("unsupported", "outline", `${mn(s["outline-width"])}px ${s["outline-style"]} ${Li(s["outline-color"])?.value ?? ""}`.trim(), o, "no outline in the engine (no focus ring)");
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
        f && f !== "none" && f !== "auto" && f !== "normal" && f !== "initial" && l("unsupported", r, f, o);
        break;
    }
  }
}
function og(n, l, s, r) {
  const o = ws(n), f = [], m = (O, R, A, L, q) => f.push([O, R, A, L ?? "(user agent)", o, q]), d = r.cascade.compute(n, l), p = {}, x = qi(d, m, r.viewport), k = x[Of];
  Xd(d, m);
  const S = Yi(d, r.measure), w = Gi(d, S, s), z = Ki({ ...x, ...w }, p), _ = {}, y = r.cascade.matching(n, "*").filter((O) => O.states.subject.size);
  for (const [O, R] of [["hover", ["hover"]], ["focus", ["focus", "focus-visible"]], ["active", ["active", "hover"]]]) {
    if (!y.some((g) => R.some((v) => g.states.subject.has(v)))) continue;
    const A = r.cascade.compute(n, l, new Set(R)), L = {}, q = Ki({ ...qi(A, () => {
    }), ...Gi(A, Yi(A, r.measure), s) }, L);
    O === "focus" && Xd(A, m);
    const D = Ld(z, q);
    if (Object.keys(D).length) {
      _[O] = D;
      const g = Object.fromEntries(Object.entries(L).filter(([v]) => v in D));
      Object.keys(g).length && (_[`${O}_tokens`] = g);
    }
  }
  if (r.cascade.sheet.tracks(n, "hover") && (_.group = Zd(n), _.track_hover = !0), r.cascade.sheet.readsAncestor(n, "hover"))
    for (let O = n.parentNode; O?.state; O = O.parentNode) {
      if (!r.cascade.sheet.tracks(O, "hover")) continue;
      const R = O.state.hover;
      O.state.hover = !0;
      let A;
      try {
        A = r.cascade.compute(n, l);
      } finally {
        O.state.hover = R;
      }
      const L = {}, q = Ki({ ...qi(A, () => {
      }), ...Gi(A, Yi(A, r.measure), s) }, L), D = Ld(z, q);
      if (!Object.keys(D).length) continue;
      const g = Object.fromEntries(Object.entries(L).filter(([v]) => v in D));
      (_.group_hover ??= []).push({ group: Zd(O), style: D, ...Object.keys(g).length ? { tokens: g } : {} });
    }
  if (/tabular/.test(String(d.values["font-variant-numeric"] ?? "")) && (_.tabular = !0), /^(anywhere|break-word)$/.test(String(d.values["overflow-wrap"] ?? "")) && (_.break_anywhere = !0), x.overflow_y === "scroll") {
    const O = Number.parseFloat(d.customs?.["--scrollbar-size"] ?? "");
    O > 0 && (_.scrollbar = O);
  }
  d.values["pointer-events"] !== "none" && l?.values["pointer-events"] === "none" && (_.blocks_pointer = !0);
  const N = Object.entries($0).filter(([, O]) => O.some((R) => typeof n.props[R] == "function")).map(([O]) => O);
  return !N.includes("click") && ns(n) && N.push("click"), N.length && (_.events = N), { computed: d, style: z, tokens: p, extra: _, meta: fg(n), reports: f, childText: rg(s, w), where: o, shift: k };
}
function sg(n, l, s, r) {
  const o = { before: null, after: null };
  for (const f of ["before", "after"]) {
    if (!r.cascade.matching(n, /* @__PURE__ */ new Set(), f).length) continue;
    const m = r.cascade.compute(n, l, /* @__PURE__ */ new Set(), f), d = String(m.values.content ?? "none").trim();
    if (d === "none" || d === "normal") continue;
    const p = /^(["'])(.*)\1$/.exec(d)?.[2] ?? "", x = (_, y, N, O, R) => r.findings.add(_, y, N, O ?? "(user agent)", `${ws(n)}::${f}`, R), k = {}, S = qi(m, x, r.viewport), z = { kind: "div", style: Ki({ ...S, ...Gi(m, Yi(m, r.measure), s) }, k), tokens: k, children: p ? [{ kind: "text", text: p }] : [] };
    Object.defineProperty(z, Hn, { value: m.values.display }), o[f] = z;
  }
  return o;
}
const Zd = (n) => `~g${n.id}`;
function Bf(n, l, s, r, o = "") {
  const f = `${o}/${n.id}.${n.version}`;
  let m = r.cache.get(n);
  (!m || m.key !== f) && r.cache.set(n, m = { key: f, part: og(n, l, s, r) });
  const { computed: d, tokens: p, extra: x, reports: k, childText: S, where: w } = m.part;
  for (const h of k) r.findings.add(...h);
  const z = (h, E, M, B, X) => r.findings.add(h, E, M, B, w, X), _ = { ...m.part.style };
  m.part.shift && lg(n, _, m.part.shift);
  const y = { kind: "div", id: n.id, style: _, tokens: p, meta: m.part.meta, ...x };
  Object.defineProperty(y, Hn, { value: d.values.display }), n.measured && n.ownerDocument?.measureKey && (y.measure = n.ownerDocument.measureKey(n));
  const N = n.tagName;
  if (N === "svg")
    return y.kind = n.props["data-perch-image"] ? "image" : "svg", y.markup = pg(n), y;
  if (N === "input" || N === "textarea" || N === "select") {
    y.kind = "input", y.input_type = N === "input" ? String(n.props.type ?? "text") : N;
    for (const M of ["placeholder", "checked", "disabled"]) n.props[M] !== void 0 && (y[M] = n.props[M]);
    if (/^(checkbox|radio)$/.test(y.input_type) && (y.checked = n.checked), N !== "select" && (y.value = n.value), N === "input" && tg.test(y.input_type) && (y.field_w = eg * d.values["font-size"]), N === "textarea" && _.h === void 0) {
      const M = d.values, B = ($) => $ && typeof $ == "object" && "px" in $ ? $.px : 0, X = ($) => M[`border-${$}-style`] === "none" ? 0 : B(M[`border-${$}-width`]), I = Number(n.props.rows) > 0 ? Math.floor(Number(n.props.rows)) : 2;
      _.h = I * kl(M, r.measure) + B(M["padding-top"]) + B(M["padding-bottom"]) + X("top") + X("bottom");
    }
    const { before: h, after: E } = sg(n, d, S, r);
    return (h || E) && (y.children = [h, E].filter(Boolean)), y;
  }
  if (N === "img") {
    y.kind = "image", y.src = n.props.src ?? null;
    for (const [h, E] of [["width", "w"], ["height", "h"]]) {
      const M = Number(n.props[h]);
      _[E] === void 0 && n.props[h] != null && Number.isFinite(M) && (_[E] = M);
    }
    return y;
  }
  const O = d.values["text-transform"], R = [];
  let A = !1, L = !1;
  for (const h of n.childNodes) {
    if (h instanceof tr) {
      if (h.hidden || h.data === "") continue;
      A = !0;
      const B = R[R.length - 1];
      if (B?.kind === "text")
        B.source = (B.source ?? B.text) + h.data, B.text = Jd(B.source, O), B.text === B.source && delete B.source;
      else {
        const X = Jd(h.data, O);
        R.push(X === h.data ? { kind: "text", text: X } : { kind: "text", text: X, source: h.data });
      }
      continue;
    }
    if (!(h instanceof $t)) continue;
    const E = Bf(h, d, S, r, f), M = E[Hn];
    M === "inline" || M === "inline-block" || M === "inline-flex" ? A = !0 : M !== "none" && (L = !0), R.push(E);
  }
  if (/(^|\s)inline-flex(\s|$)/.test(String(n.props?.className ?? "")) && _.w === void 0)
    for (const h of R)
      h.style?.flex_grow && h.style.min_w === 0 && h.style.overflow_x === "hidden" && (delete h.style.min_w, delete h.style.flex_grow, delete h.style.flex_basis, delete h.style.overflow_x, delete h.style.overflow_y);
  if (!_.display && A && R.some((h) => h.kind !== "text") && R.every((h) => h.kind === "text" || h.kind === "div" && h[Hn] === "inline" && !h.events?.length && h.children?.every((E) => E.kind === "text"))) {
    const h = R.map((E) => E.kind === "text" ? E.text : E.children.map((M) => M.text).join("")).join("");
    z("approximated", "display", "inline text elements in a line of text", "(inline formatting)", "their text joined to the line, in its font"), R.splice(0, R.length, { kind: "text", text: h });
  }
  const q = R.some((h) => h.kind !== "text"), D = R.length === 1 && R[0].kind !== "text" && /^inline-(block|flex)$/.test(R[0][Hn]) ? R[0] : null;
  if (!_.display && D) {
    const h = r.cache.get(n.childNodes.find((M) => M.id === D.id))?.part.computed, E = h ? Ji(d.values, r.measure) - dg(h.values, r.measure, D) : 0;
    _.display = "flex", _.flex_direction = "col", _.items = "start", E > 0 && (D.style.mt = Math.round(((D.style.mt ?? 0) + E) * 100) / 100), z("approximated", "display", `${d.values.display} holding one ${D[Hn]} box`, "(inline formatting)", "a column, the box lowered to the line's baseline");
  } else if (!_.display && R.length === 1 && (R[0].kind === "svg" || R[0].kind === "image") && R[0][Hn] === "inline" && typeof R[0].style.h == "number") {
    const h = R[0], E = Ji(d.values, r.measure), M = kl(d.values, r.measure) - E, B = (X) => Math.round(X * 100) / 100;
    _.display = "flex", _.flex_direction = "col", _.items = "start", E > h.style.h && (h.style.mt = B((h.style.mt ?? 0) + E - h.style.h)), M > 0 && (h.style.mb = B((h.style.mb ?? 0) + M)), z("approximated", "display", `${d.values.display} holding one inline image`, "(inline formatting)", "a column, the image on the line's baseline");
  } else if (!_.display && A && q) {
    if (_.display = "flex", _.flex_direction = L ? "col" : "row", !L) _.items = "baseline";
    else for (const h of R) h.kind !== "text" && /^inline-(block|flex)$/.test(h[Hn]) && !h.style.self && (h.style.self = "start");
    z("approximated", "display", `${d.values.display} with inline content`, "(inline formatting)", L ? "a column of its children" : "a row on the text baseline");
  }
  const g = d.values["letter-spacing"]?.px, v = d.values["overflow-x"] !== "visible";
  if (g)
    for (let h = 0; h < R.length; h++) {
      const E = R[h];
      if (E.kind !== "text") continue;
      const M = Math.round(g * [...E.text].length * 1e3) / 1e3;
      if (g > 0 || !v) {
        R[h] = { kind: "div", style: { pr: M }, tokens: {}, children: [E] };
        continue;
      }
      const B = d.values["font-size"], X = Math.max(0.8, 1 + g / (0.55 * B)), I = Math.round(kl(d.values, r.measure) * 1e3) / 1e3;
      R[h] = { kind: "div", style: { text_size: Math.round(B * X * 1e3) / 1e3, line_height: `${I}px` }, tokens: {}, children: [E] };
    }
  return y.children = R, y;
}
function cg(n, l) {
  if (!l) return null;
  let r = (l.self ? n : l.closest ? wf(n, l.closest) : l.find ? El(n, l.find)[0] : null)?.getAttribute(l.attr) ?? null;
  return r && l.strip && r.startsWith(l.strip) && (r = r.slice(l.strip.length)), r;
}
function ug(n, l, s) {
  const r = l.map((m) => [m, Pi(m.selector)]), o = /* @__PURE__ */ new Map(), f = (m) => {
    for (const d of m.children) {
      const p = s.get(d.id);
      if (p)
        for (const [x, k] of r) {
          const S = x.textRange ? "range_name" : "name";
          if (x.textRange && p[S] != null || !k.some((y) => xf(d, y))) continue;
          const w = cg(d, x.key), z = w == null ? o.get(x.name) ?? 0 : 0;
          w == null && o.set(x.name, z + 1);
          const _ = w != null ? `${x.name}:${w}` : z ? `${x.name}@${z}` : x.name;
          p[S] == null ? p[S] = _ : (p.also ??= []).push(_);
        }
      f(d);
    }
  };
  f(n.documentElement);
}
const Zi = 0.9521, Hf = 0.2256, Ji = (n, l) => (kl(n, l) - (Zi + Hf) * n["font-size"]) / 2 + Zi * n["font-size"];
function dg(n, l, s) {
  const r = (p) => p && typeof p == "object" && "px" in p ? p.px : 0, o = n["border-top-style"] === "none" ? 0 : r(n["border-top-width"]), f = s?.children ?? [], m = f.length === 1 && (f[0].kind === "svg" || f[0].kind === "image") && typeof f[0].style.h == "number" ? f[0] : null, d = m ? Math.max(Ji(n, l), (m.style.mt ?? 0) + m.style.h) : Ji(n, l);
  return r(n["padding-top"]) + o + d;
}
const Jd = (n, l) => l === "uppercase" ? n.toUpperCase() : l === "lowercase" ? n.toLowerCase() : l === "capitalize" ? n.replace(/\b\p{L}/gu, (s) => s.toUpperCase()) : n, Uf = /* @__PURE__ */ new Set(["children", "style", "className", "key", "ref", "dangerouslySetInnerHTML"]);
function fg(n) {
  const l = {};
  for (const [s, r] of Object.entries(n.props)) {
    if (Uf.has(s) || typeof r == "function" || r === void 0 || r === null || typeof r == "object") continue;
    const o = s.startsWith("aria-") || s.startsWith("data-");
    if (r === !1 && !o) continue;
    const f = s === "htmlFor" ? "for" : s === "tabIndex" ? "tabindex" : s;
    l[f] = typeof r == "boolean" ? o ? String(r) : "" : String(r);
  }
  return { tag: n.tagName, classes: n.classList, attrs: l };
}
const mg = (n) => n === "className" ? "class" : /^(viewBox|preserveAspectRatio|gradientUnits|gradientTransform|patternUnits|xmlns)$/.test(n) ? n : n.replace(/[A-Z]/g, (l) => `-${l.toLowerCase()}`), Wd = (n) => String(n).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
function pg(n) {
  if (n.props["data-perch-markup"]) return String(n.props["data-perch-markup"]);
  const l = (s) => {
    const r = [];
    for (const [f, m] of Object.entries(s.props))
      Uf.has(f) || typeof m == "function" || m === void 0 || m === null || m === !1 || typeof m == "object" || f.startsWith("data-") || f.startsWith("aria-") || f === "focusable" || f === "role" || f === "title" || r.push(`${mg(f)}="${Wd(m === !0 ? "" : m)}"`);
    s.tagName === "svg" && !s.props.xmlns && r.unshift('xmlns="http://www.w3.org/2000/svg"');
    const o = s.childNodes.map((f) => f instanceof tr ? Wd(f.data) : l(f)).join("");
    return `<${s.tagName}${r.length ? ` ${r.join(" ")}` : ""}>${o}</${s.tagName}>`;
  };
  return l(n);
}
function hg(n) {
  const l = n.theme?.() ?? {}, s = {};
  for (const r of Tf) l[r] && (s[r] = l[r]);
  return s;
}
const gg = { font_features: "" };
function bg(n, l, s, r = {}, o = null) {
  const f = hg(l), m = l.viewport?.() ?? { width: 1e3, height: 800 }, d = JSON.stringify([f, m]);
  (r.look !== d || r.sheet !== s) && Object.assign(r, { look: d, sheet: s, cache: /* @__PURE__ */ new WeakMap(), cascade: new K0(s, { theme: f, viewport: m }), top: null });
  const { cascade: p, cache: x } = r, k = { cascade: p, cache: x, viewport: m, findings: new P0(), measure: l.lineHeight ? (z) => l.lineHeight(z) : null };
  r.top ??= p.compute(n.body, p.compute(n.documentElement, null));
  const S = n.body.children.map((z) => Bf(z, r.top, gg, k));
  if (o?.length) {
    const z = /* @__PURE__ */ new Map(), _ = (y) => {
      y.id && z.set(y.id, y);
      for (const N of y.children ?? []) _(N);
    };
    S.forEach(_), ug(n, o, z);
  }
  const w = /* @__PURE__ */ new Set();
  for (const z of [n, n.defaultView])
    for (const { type: _ } of z?.listeners ?? []) Kd[_] && w.add(Kd[_]);
  return { schema: X0, root: S[0] ?? null, overlays: S.slice(1), document_events: [...w].sort(), unsupported: k.findings.list() };
}
const vg = { layers: ["properties", "theme", "base", "utilities"], properties: { "--tw-translate-x": { inherits: !1, initial: "0" }, "--tw-translate-y": { inherits: !1, initial: "0" }, "--tw-translate-z": { inherits: !1, initial: "0" }, "--tw-rotate-x": { inherits: !1, initial: null }, "--tw-rotate-y": { inherits: !1, initial: null }, "--tw-rotate-z": { inherits: !1, initial: null }, "--tw-skew-x": { inherits: !1, initial: null }, "--tw-skew-y": { inherits: !1, initial: null }, "--tw-space-y-reverse": { inherits: !1, initial: "0" }, "--tw-border-style": { inherits: !1, initial: "solid" }, "--tw-leading": { inherits: !1, initial: null }, "--tw-font-weight": { inherits: !1, initial: null }, "--tw-tracking": { inherits: !1, initial: null }, "--tw-ordinal": { inherits: !1, initial: null }, "--tw-slashed-zero": { inherits: !1, initial: null }, "--tw-numeric-figure": { inherits: !1, initial: null }, "--tw-numeric-spacing": { inherits: !1, initial: null }, "--tw-numeric-fraction": { inherits: !1, initial: null }, "--tw-shadow": { inherits: !1, initial: "0 0 #0000" }, "--tw-shadow-color": { inherits: !1, initial: null }, "--tw-shadow-alpha": { inherits: !1, initial: "100%" }, "--tw-inset-shadow": { inherits: !1, initial: "0 0 #0000" }, "--tw-inset-shadow-color": { inherits: !1, initial: null }, "--tw-inset-shadow-alpha": { inherits: !1, initial: "100%" }, "--tw-ring-color": { inherits: !1, initial: null }, "--tw-ring-shadow": { inherits: !1, initial: "0 0 #0000" }, "--tw-inset-ring-color": { inherits: !1, initial: null }, "--tw-inset-ring-shadow": { inherits: !1, initial: "0 0 #0000" }, "--tw-ring-inset": { inherits: !1, initial: null }, "--tw-ring-offset-width": { inherits: !1, initial: "0" }, "--tw-ring-offset-color": { inherits: !1, initial: "#fff" }, "--tw-ring-offset-shadow": { inherits: !1, initial: "0 0 #0000" }, "--tw-outline-style": { inherits: !1, initial: "solid" }, "--tw-blur": { inherits: !1, initial: null }, "--tw-brightness": { inherits: !1, initial: null }, "--tw-contrast": { inherits: !1, initial: null }, "--tw-grayscale": { inherits: !1, initial: null }, "--tw-hue-rotate": { inherits: !1, initial: null }, "--tw-invert": { inherits: !1, initial: null }, "--tw-opacity": { inherits: !1, initial: null }, "--tw-saturate": { inherits: !1, initial: null }, "--tw-sepia": { inherits: !1, initial: null }, "--tw-drop-shadow": { inherits: !1, initial: null }, "--tw-drop-shadow-color": { inherits: !1, initial: null }, "--tw-drop-shadow-alpha": { inherits: !1, initial: "100%" }, "--tw-drop-shadow-size": { inherits: !1, initial: null }, "--tw-backdrop-blur": { inherits: !1, initial: null }, "--tw-backdrop-brightness": { inherits: !1, initial: null }, "--tw-backdrop-contrast": { inherits: !1, initial: null }, "--tw-backdrop-grayscale": { inherits: !1, initial: null }, "--tw-backdrop-hue-rotate": { inherits: !1, initial: null }, "--tw-backdrop-invert": { inherits: !1, initial: null }, "--tw-backdrop-opacity": { inherits: !1, initial: null }, "--tw-backdrop-saturate": { inherits: !1, initial: null }, "--tw-backdrop-sepia": { inherits: !1, initial: null }, "--tw-duration": { inherits: !1, initial: null }, "--tw-ease": { inherits: !1, initial: null }, "--tw-content": { inherits: !1, initial: '""' } }, rules: [[":root, :host", null, 2, [["--spacing", ".25rem"], ["--text-xs", ".75rem"], ["--text-xs--line-height", "calc(1 / .75)"], ["--text-sm", ".875rem"], ["--text-sm--line-height", "calc(1.25 / .875)"], ["--font-weight-normal", "400"], ["--font-weight-medium", "500"], ["--font-weight-semibold", "600"], ["--font-weight-bold", "700"], ["--tracking-normal", "0em"], ["--tracking-wide", ".025em"], ["--leading-tight", "1.25"], ["--leading-relaxed", "1.625"], ["--ease-out", "cubic-bezier(0, 0, .2, 1)"], ["--animate-pulse", "pulse 2s cubic-bezier(.4, 0, .6, 1) infinite"], ["--blur-xl", "24px"], ["--default-transition-duration", ".15s"], ["--default-transition-timing-function", "cubic-bezier(.4, 0, .2, 1)"], ["--animate-toast-in", "toast-in .2s cubic-bezier(.22, 1, .36, 1)"], ["--animate-host-pulse", "host-connecting-pulse 1.4s ease-in-out infinite"], ["--animate-drop-zone", "drop-zone-in .14s ease-out, drop-zone-pulse 1.2s ease-in-out .14s infinite"]]], ["::selection", null, 3, [["background", "var(--accent)"], ["color", "var(--panel-bg)"]]], [":where(input, textarea)::placeholder", null, 3, [["color", "var(--subtext-0)"], ["opacity", "1"]]], [":where(button, input, select, textarea)", null, 3, [["border", "0"]]], [':where(button, a[href], select, summary, [role="button"], [role="menuitem"]):focus-visible', null, 3, [["outline", "2px solid var(--accent)"], ["outline-offset", "-2px"]]], ["::-webkit-scrollbar", null, 3, [["width", "var(--scrollbar-size)"], ["height", "var(--scrollbar-size)"]]], ["::-webkit-scrollbar-track", null, 3, [["background", "none"]]], ["::-webkit-scrollbar-corner", null, 3, [["background", "none"]]], ["::-webkit-scrollbar-thumb", null, 3, [["background", "var(--text)"]]], ["::-webkit-scrollbar-thumb", null, 3, [["background", "color-mix(in srgb, var(--text) 20%, transparent)"]]], ["::-webkit-scrollbar-thumb", null, 3, [["border-radius", "var(--scrollbar-size)"]]], ["::-webkit-scrollbar-thumb:hover", null, 3, [["background", "var(--text)"]]], ["::-webkit-scrollbar-thumb:hover", null, 3, [["background", "color-mix(in srgb, var(--text) 40%, transparent)"]]], [".xterm .xterm-scrollable-element > .xterm-scrollbar > .xterm-slider", null, 3, [["border-radius", "var(--scrollbar-size)"]]], [".\\@container, .\\[container-type\\:inline-size\\]", null, 4, [["container-type", "inline-size"]]], [".pointer-events-auto", null, 4, [["pointer-events", "auto"]]], [".pointer-events-none", null, 4, [["pointer-events", "none"]]], [".collapse", null, 4, [["visibility", "collapse"]]], [".invisible", null, 4, [["visibility", "hidden"]]], [".visible", null, 4, [["visibility", "visible"]]], [".sr-only", null, 4, [["clip-path", "inset(50%)"], ["white-space", "nowrap"], ["border-width", "0"], ["width", "1px"], ["height", "1px"], ["margin", "-1px"], ["padding", "0"], ["position", "absolute"], ["overflow", "hidden"]]], [".absolute", null, 4, [["position", "absolute"]]], [".fixed", null, 4, [["position", "fixed"]]], [".relative", null, 4, [["position", "relative"]]], [".static", null, 4, [["position", "static"]]], [".sticky", null, 4, [["position", "sticky"]]], [".inset-0", null, 4, [["inset", "0"]]], [".inset-x-0", null, 4, [["inset-inline", "0"]]], [".inset-x-2", null, 4, [["inset-inline", "calc(var(--spacing) * 2)"]]], [".-top-1", null, 4, [["top", "calc(var(--spacing) * -1)"]]], [".-top-1\\.5", null, 4, [["top", "calc(var(--spacing) * -1.5)"]]], [".top-0", null, 4, [["top", "0"]]], [".top-1", null, 4, [["top", "var(--spacing)"]]], [".top-1\\.5", null, 4, [["top", "calc(var(--spacing) * 1.5)"]]], [".top-1\\/2", null, 4, [["top", "50%"]]], [".top-2", null, 4, [["top", "calc(var(--spacing) * 2)"]]], [".top-4", null, 4, [["top", "calc(var(--spacing) * 4)"]]], [".top-\\[0\\.1rem\\]", null, 4, [["top", ".1rem"]]], [".top-\\[7px\\]", null, 4, [["top", "7px"]]], [".top-\\[max\\(0\\.75rem\\,env\\(safe-area-inset-top\\)\\)\\]", null, 4, [["top", "max(.75rem, env(safe-area-inset-top))"]]], [".top-full", null, 4, [["top", "100%"]]], [".top-px", null, 4, [["top", "1px"]]], [".-right-1", null, 4, [["right", "calc(var(--spacing) * -1)"]]], [".-right-1\\.5", null, 4, [["right", "calc(var(--spacing) * -1.5)"]]], [".right-0", null, 4, [["right", "0"]]], [".right-1", null, 4, [["right", "var(--spacing)"]]], [".right-3", null, 4, [["right", "calc(var(--spacing) * 3)"]]], [".right-4", null, 4, [["right", "calc(var(--spacing) * 4)"]]], [".right-\\[0\\.8rem\\]", null, 4, [["right", ".8rem"]]], [".right-\\[0\\.25rem\\]", null, 4, [["right", ".25rem"]]], [".right-\\[max\\(0\\.75rem\\,env\\(safe-area-inset-right\\)\\)\\]", null, 4, [["right", "max(.75rem, env(safe-area-inset-right))"]]], [".bottom-0", null, 4, [["bottom", "0"]]], [".bottom-2", null, 4, [["bottom", "calc(var(--spacing) * 2)"]]], [".bottom-3", null, 4, [["bottom", "calc(var(--spacing) * 3)"]]], [".bottom-\\[0\\.8rem\\]", null, 4, [["bottom", ".8rem"]]], [".bottom-full", null, 4, [["bottom", "100%"]]], [".-left-8", null, 4, [["left", "calc(var(--spacing) * -8)"]]], [".-left-\\[2px\\]", null, 4, [["left", "-2px"]]], [".left-0", null, 4, [["left", "0"]]], [".left-2", null, 4, [["left", "calc(var(--spacing) * 2)"]]], [".left-\\[0\\.1rem\\]", null, 4, [["left", ".1rem"]]], [".left-\\[max\\(0\\.75rem\\,env\\(safe-area-inset-left\\)\\)\\]", null, 4, [["left", "max(.75rem, env(safe-area-inset-left))"]]], [".left-px", null, 4, [["left", "1px"]]], [".isolate", null, 4, [["isolation", "isolate"]]], [".z-4", null, 4, [["z-index", "4"]]], [".z-5", null, 4, [["z-index", "5"]]], [".z-10", null, 4, [["z-index", "10"]]], [".z-20", null, 4, [["z-index", "20"]]], [".z-30", null, 4, [["z-index", "30"]]], [".z-40", null, 4, [["z-index", "40"]]], [".z-50", null, 4, [["z-index", "50"]]], [".z-\\[2\\]", null, 4, [["z-index", "2"]]], [".z-\\[3\\]", null, 4, [["z-index", "3"]]], [".z-\\[5\\]", null, 4, [["z-index", "5"]]], [".z-\\[1000\\]", null, 4, [["z-index", "1000"]]], [".z-\\[2000\\]", null, 4, [["z-index", "2000"]]], [".z-\\[2100\\]", null, 4, [["z-index", "2100"]]], [".z-\\[2200\\]", null, 4, [["z-index", "2200"]]], [".z-\\[3000\\]", null, 4, [["z-index", "3000"]]], [".z-\\[3100\\]", null, 4, [["z-index", "3100"]]], [".z-\\[4000\\]", null, 4, [["z-index", "4000"]]], [".z-\\[9998\\]", null, 4, [["z-index", "9998"]]], [".z-\\[9999\\]", null, 4, [["z-index", "9999"]]], [".z-\\[10000\\]", null, 4, [["z-index", "10000"]]], [".z-auto", null, 4, [["z-index", "auto"]]], [".order-last", null, 4, [["order", "9999"]]], [".col-\\[1\\/-1\\]", null, 4, [["grid-column", "1 / -1"]]], [".container", null, 4, [["width", "100%"]]], [".container", ["(min-width: 40rem)"], 4, [["max-width", "40rem"]]], [".container", ["(min-width: 48rem)"], 4, [["max-width", "48rem"]]], [".container", ["(min-width: 64rem)"], 4, [["max-width", "64rem"]]], [".container", ["(min-width: 80rem)"], 4, [["max-width", "80rem"]]], [".container", ["(min-width: 96rem)"], 4, [["max-width", "96rem"]]], [".m-0", null, 4, [["margin", "0"]]], [".m-2", null, 4, [["margin", "calc(var(--spacing) * 2)"]]], [".m-\\[0\\.7rem\\]", null, 4, [["margin", ".7rem"]]], [".m-auto", null, 4, [["margin", "auto"]]], [".mx-0", null, 4, [["margin-inline", "0"]]], [".mx-0\\.5", null, 4, [["margin-inline", "calc(var(--spacing) * .5)"]]], [".mx-2", null, 4, [["margin-inline", "calc(var(--spacing) * 2)"]]], [".mx-3", null, 4, [["margin-inline", "calc(var(--spacing) * 3)"]]], [".mx-4", null, 4, [["margin-inline", "calc(var(--spacing) * 4)"]]], [".mx-\\[0\\.3rem\\]", null, 4, [["margin-inline", ".3rem"]]], [".mx-\\[0\\.7rem\\]", null, 4, [["margin-inline", ".7rem"]]], [".mx-\\[0\\.65rem\\]", null, 4, [["margin-inline", ".65rem"]]], [".mx-\\[3px\\]", null, 4, [["margin-inline", "3px"]]], [".mx-\\[11px\\]", null, 4, [["margin-inline", "11px"]]], [".mx-auto", null, 4, [["margin-inline", "auto"]]], [".my-0\\.5", null, 4, [["margin-block", "calc(var(--spacing) * .5)"]]], [".my-1", null, 4, [["margin-block", "var(--spacing)"]]], [".my-2", null, 4, [["margin-block", "calc(var(--spacing) * 2)"]]], [".my-\\[0\\.2rem\\]", null, 4, [["margin-block", ".2rem"]]], [".my-\\[0\\.3rem\\]", null, 4, [["margin-block", ".3rem"]]], [".my-\\[0\\.6rem\\]", null, 4, [["margin-block", ".6rem"]]], [".my-\\[0\\.28rem\\]", null, 4, [["margin-block", ".28rem"]]], [".my-\\[0\\.45rem\\]", null, 4, [["margin-block", ".45rem"]]], [".my-\\[0\\.55rem\\]", null, 4, [["margin-block", ".55rem"]]], [".my-\\[3px\\]", null, 4, [["margin-block", "3px"]]], [".-mt-\\[2px\\]", null, 4, [["margin-top", "-2px"]]], [".mt-0", null, 4, [["margin-top", "0"]]], [".mt-0\\.5", null, 4, [["margin-top", "calc(var(--spacing) * .5)"]]], [".mt-1", null, 4, [["margin-top", "var(--spacing)"]]], [".mt-1\\.5", null, 4, [["margin-top", "calc(var(--spacing) * 1.5)"]]], [".mt-2", null, 4, [["margin-top", "calc(var(--spacing) * 2)"]]], [".mt-3", null, 4, [["margin-top", "calc(var(--spacing) * 3)"]]], [".mt-4", null, 4, [["margin-top", "calc(var(--spacing) * 4)"]]], [".mt-\\[0\\.1rem\\]", null, 4, [["margin-top", ".1rem"]]], [".mt-\\[0\\.2rem\\]", null, 4, [["margin-top", ".2rem"]]], [".mt-\\[0\\.3rem\\]", null, 4, [["margin-top", ".3rem"]]], [".mt-\\[0\\.4rem\\]", null, 4, [["margin-top", ".4rem"]]], [".mt-\\[0\\.5rem\\]", null, 4, [["margin-top", ".5rem"]]], [".mt-\\[0\\.15rem\\]", null, 4, [["margin-top", ".15rem"]]], [".mt-\\[0\\.35rem\\]", null, 4, [["margin-top", ".35rem"]]], [".mr-1", null, 4, [["margin-right", "var(--spacing)"]]], [".mr-1\\.5", null, 4, [["margin-right", "calc(var(--spacing) * 1.5)"]]], [".mr-\\[0\\.3rem\\]", null, 4, [["margin-right", ".3rem"]]], [".mr-\\[0\\.7rem\\]", null, 4, [["margin-right", ".7rem"]]], [".mr-auto", null, 4, [["margin-right", "auto"]]], [".mb-0", null, 4, [["margin-bottom", "0"]]], [".mb-0\\.5", null, 4, [["margin-bottom", "calc(var(--spacing) * .5)"]]], [".mb-1", null, 4, [["margin-bottom", "var(--spacing)"]]], [".mb-2", null, 4, [["margin-bottom", "calc(var(--spacing) * 2)"]]], [".mb-3", null, 4, [["margin-bottom", "calc(var(--spacing) * 3)"]]], [".mb-4", null, 4, [["margin-bottom", "calc(var(--spacing) * 4)"]]], [".mb-8", null, 4, [["margin-bottom", "calc(var(--spacing) * 8)"]]], [".mb-\\[0\\.2rem\\]", null, 4, [["margin-bottom", ".2rem"]]], [".mb-\\[0\\.3rem\\]", null, 4, [["margin-bottom", ".3rem"]]], [".mb-\\[0\\.4rem\\]", null, 4, [["margin-bottom", ".4rem"]]], [".mb-\\[0\\.6rem\\]", null, 4, [["margin-bottom", ".6rem"]]], [".mb-\\[0\\.7rem\\]", null, 4, [["margin-bottom", ".7rem"]]], [".mb-\\[0\\.9rem\\]", null, 4, [["margin-bottom", ".9rem"]]], [".mb-\\[0\\.15rem\\]", null, 4, [["margin-bottom", ".15rem"]]], [".mb-\\[0\\.35rem\\]", null, 4, [["margin-bottom", ".35rem"]]], [".mb-\\[0\\.55rem\\]", null, 4, [["margin-bottom", ".55rem"]]], [".mb-\\[1\\.1rem\\]", null, 4, [["margin-bottom", "1.1rem"]]], [".-ml-0\\.5", null, 4, [["margin-left", "calc(var(--spacing) * -.5)"]]], [".-ml-1", null, 4, [["margin-left", "calc(var(--spacing) * -1)"]]], [".-ml-2", null, 4, [["margin-left", "calc(var(--spacing) * -2)"]]], [".ml-1", null, 4, [["margin-left", "var(--spacing)"]]], [".ml-2", null, 4, [["margin-left", "calc(var(--spacing) * 2)"]]], [".ml-\\[0\\.4rem\\]", null, 4, [["margin-left", ".4rem"]]], [".ml-\\[0\\.5rem\\]", null, 4, [["margin-left", ".5rem"]]], [".ml-\\[0\\.9rem\\]", null, 4, [["margin-left", ".9rem"]]], [".ml-\\[0\\.35rem\\]", null, 4, [["margin-left", ".35rem"]]], [".ml-\\[0\\.55rem\\]", null, 4, [["margin-left", ".55rem"]]], [".ml-\\[1\\.15rem\\]", null, 4, [["margin-left", "1.15rem"]]], [".ml-\\[1\\.45rem\\]", null, 4, [["margin-left", "1.45rem"]]], [".ml-\\[2\\.025rem\\]", null, 4, [["margin-left", "2.025rem"]]], [".ml-\\[2\\.375rem\\]", null, 4, [["margin-left", "2.375rem"]]], [".ml-\\[6\\.1rem\\]", null, 4, [["margin-left", "6.1rem"]]], [".ml-auto", null, 4, [["margin-left", "auto"]]], [".box-border", null, 4, [["box-sizing", "border-box"]]], [".\\!hidden", null, 4, [["display", "none", 1]]], [".\\[display\\:-webkit-box\\]", null, 4, [["display", "-webkit-box"]]], [".\\[display\\:var\\(--pane-grip\\,flex\\)\\]", null, 4, [["display", "var(--pane-grip, flex)"]]], [".block", null, 4, [["display", "block"]]], [".contents", null, 4, [["display", "contents"]]], [".flex", null, 4, [["display", "flex"]]], [".grid", null, 4, [["display", "grid"]]], [".hidden", null, 4, [["display", "none"]]], [".inline", null, 4, [["display", "inline"]]], [".inline-block", null, 4, [["display", "inline-block"]]], [".inline-flex", null, 4, [["display", "inline-flex"]]], [".table", null, 4, [["display", "table"]]], [".size-1", null, 4, [["width", "var(--spacing)"], ["height", "var(--spacing)"]]], [".size-1\\.5", null, 4, [["width", "calc(var(--spacing) * 1.5)"], ["height", "calc(var(--spacing) * 1.5)"]]], [".size-2", null, 4, [["width", "calc(var(--spacing) * 2)"], ["height", "calc(var(--spacing) * 2)"]]], [".size-3", null, 4, [["width", "calc(var(--spacing) * 3)"], ["height", "calc(var(--spacing) * 3)"]]], [".size-5", null, 4, [["width", "calc(var(--spacing) * 5)"], ["height", "calc(var(--spacing) * 5)"]]], [".size-6", null, 4, [["width", "calc(var(--spacing) * 6)"], ["height", "calc(var(--spacing) * 6)"]]], [".size-7", null, 4, [["width", "calc(var(--spacing) * 7)"], ["height", "calc(var(--spacing) * 7)"]]], [".size-8", null, 4, [["width", "calc(var(--spacing) * 8)"], ["height", "calc(var(--spacing) * 8)"]]], [".size-11", null, 4, [["width", "calc(var(--spacing) * 11)"], ["height", "calc(var(--spacing) * 11)"]]], [".size-14", null, 4, [["width", "calc(var(--spacing) * 14)"], ["height", "calc(var(--spacing) * 14)"]]], [".size-\\[0\\.6rem\\]", null, 4, [["width", ".6rem"], ["height", ".6rem"]]], [".size-\\[1\\.2rem\\]", null, 4, [["width", "1.2rem"], ["height", "1.2rem"]]], [".size-\\[5px\\]", null, 4, [["width", "5px"], ["height", "5px"]]], [".size-\\[14px\\]", null, 4, [["width", "14px"], ["height", "14px"]]], [".size-\\[calc\\(14px\\*var\\(--zoom\\,1\\)\\)\\]", null, 4, [["width", "calc(14px * var(--zoom, 1))"], ["height", "calc(14px * var(--zoom, 1))"]]], [".size-full", null, 4, [["width", "100%"], ["height", "100%"]]], [".h-1", null, 4, [["height", "var(--spacing)"]]], [".h-1\\.5", null, 4, [["height", "calc(var(--spacing) * 1.5)"]]], [".h-2", null, 4, [["height", "calc(var(--spacing) * 2)"]]], [".h-3", null, 4, [["height", "calc(var(--spacing) * 3)"]]], [".h-4", null, 4, [["height", "calc(var(--spacing) * 4)"]]], [".h-5", null, 4, [["height", "calc(var(--spacing) * 5)"]]], [".h-6", null, 4, [["height", "calc(var(--spacing) * 6)"]]], [".h-7", null, 4, [["height", "calc(var(--spacing) * 7)"]]], [".h-8", null, 4, [["height", "calc(var(--spacing) * 8)"]]], [".h-9", null, 4, [["height", "calc(var(--spacing) * 9)"]]], [".h-11", null, 4, [["height", "calc(var(--spacing) * 11)"]]], [".h-12", null, 4, [["height", "calc(var(--spacing) * 12)"]]], [".h-44", null, 4, [["height", "calc(var(--spacing) * 44)"]]], [".h-\\[1\\.1rem\\]", null, 4, [["height", "1.1rem"]]], [".h-\\[1\\.3rem\\]", null, 4, [["height", "1.3rem"]]], [".h-\\[1\\.4rem\\]", null, 4, [["height", "1.4rem"]]], [".h-\\[1\\.25rem\\]", null, 4, [["height", "1.25rem"]]], [".h-\\[2px\\]", null, 4, [["height", "2px"]]], [".h-\\[14px\\]", null, 4, [["height", "14px"]]], [".h-\\[18px\\]", null, 4, [["height", "18px"]]], [".h-\\[43px\\]", null, 4, [["height", "43px"]]], [".h-\\[calc\\(100\\%-max\\(0\\.5rem\\,env\\(safe-area-inset-top\\)\\)\\)\\]", null, 4, [["height", "calc(100% - max(.5rem, env(safe-area-inset-top)))"]]], [".h-full", null, 4, [["height", "100%"]]], [".h-px", null, 4, [["height", "1px"]]], [".max-h-40", null, 4, [["max-height", "calc(var(--spacing) * 40)"]]], [".max-h-56", null, 4, [["max-height", "calc(var(--spacing) * 56)"]]], [".max-h-72", null, 4, [["max-height", "calc(var(--spacing) * 72)"]]], [".max-h-\\[8rem\\]", null, 4, [["max-height", "8rem"]]], [".max-h-\\[13rem\\]", null, 4, [["max-height", "13rem"]]], [".max-h-\\[30\\%\\]", null, 4, [["max-height", "30%"]]], [".max-h-\\[30vh\\]", null, 4, [["max-height", "30vh"]]], [".max-h-\\[35vh\\]", null, 4, [["max-height", "35vh"]]], [".max-h-\\[40\\%\\]", null, 4, [["max-height", "40%"]]], [".max-h-\\[50dvh\\]", null, 4, [["max-height", "50dvh"]]], [".max-h-\\[60\\%\\]", null, 4, [["max-height", "60%"]]], [".max-h-\\[70\\%\\]", null, 4, [["max-height", "70%"]]], [".max-h-\\[85vh\\]", null, 4, [["max-height", "85vh"]]], [".max-h-\\[90\\%\\]", null, 4, [["max-height", "90%"]]], [".max-h-\\[190px\\]", null, 4, [["max-height", "190px"]]], [".max-h-\\[240px\\]", null, 4, [["max-height", "240px"]]], [".max-h-\\[260px\\]", null, 4, [["max-height", "260px"]]], [".max-h-\\[calc\\(85vh-4rem\\)\\]", null, 4, [["max-height", "calc(85vh - 4rem)"]]], [".max-h-\\[calc\\(100dvh_-_4rem\\)\\]", null, 4, [["max-height", "calc(100dvh - 4rem)"]]], [".max-h-\\[min\\(420px\\,calc\\(100dvh_-_16vh_-_2rem\\)\\)\\]", null, 4, [["max-height", "min(420px, 100dvh - 16vh - 2rem)"]]], [".max-h-\\[min\\(480px\\,calc\\(100dvh_-_16vh_-_2rem\\)\\)\\]", null, 4, [["max-height", "min(480px, 100dvh - 16vh - 2rem)"]]], [".max-h-full", null, 4, [["max-height", "100%"]]], [".min-h-0", null, 4, [["min-height", "0"]]], [".min-h-6", null, 4, [["min-height", "calc(var(--spacing) * 6)"]]], [".min-h-7", null, 4, [["min-height", "calc(var(--spacing) * 7)"]]], [".min-h-8", null, 4, [["min-height", "calc(var(--spacing) * 8)"]]], [".min-h-9", null, 4, [["min-height", "calc(var(--spacing) * 9)"]]], [".min-h-10", null, 4, [["min-height", "calc(var(--spacing) * 10)"]]], [".min-h-11", null, 4, [["min-height", "calc(var(--spacing) * 11)"]]], [".min-h-20", null, 4, [["min-height", "calc(var(--spacing) * 20)"]]], [".min-h-40", null, 4, [["min-height", "calc(var(--spacing) * 40)"]]], [".min-h-\\[1\\.5em\\]", null, 4, [["min-height", "1.5em"]]], [".min-h-\\[1\\.8rem\\]", null, 4, [["min-height", "1.8rem"]]], [".min-h-\\[2\\.5rem\\]", null, 4, [["min-height", "2.5rem"]]], [".min-h-\\[3\\.2rem\\]", null, 4, [["min-height", "3.2rem"]]], [".min-h-\\[3\\.25rem\\]", null, 4, [["min-height", "3.25rem"]]], [".min-h-\\[6rem\\]", null, 4, [["min-height", "6rem"]]], [".min-h-\\[8rem\\]", null, 4, [["min-height", "8rem"]]], [".min-h-\\[10rem\\]", null, 4, [["min-height", "10rem"]]], [".min-h-\\[12rem\\]", null, 4, [["min-height", "12rem"]]], [".min-h-\\[13rem\\]", null, 4, [["min-height", "13rem"]]], [".min-h-\\[32px\\]", null, 4, [["min-height", "32px"]]], [".min-h-\\[44px\\]", null, 4, [["min-height", "44px"]]], [".min-h-\\[60px\\]", null, 4, [["min-height", "60px"]]], [".min-h-\\[100dvh\\]", null, 4, [["min-height", "100dvh"]]], [".min-h-\\[calc\\(22px\\*var\\(--zoom\\,1\\)\\)\\]", null, 4, [["min-height", "calc(22px * var(--zoom, 1))"]]], [".min-h-full", null, 4, [["min-height", "100%"]]], [".w-2", null, 4, [["width", "calc(var(--spacing) * 2)"]]], [".w-2\\.5", null, 4, [["width", "calc(var(--spacing) * 2.5)"]]], [".w-3", null, 4, [["width", "calc(var(--spacing) * 3)"]]], [".w-4", null, 4, [["width", "calc(var(--spacing) * 4)"]]], [".w-5", null, 4, [["width", "calc(var(--spacing) * 5)"]]], [".w-7", null, 4, [["width", "calc(var(--spacing) * 7)"]]], [".w-8", null, 4, [["width", "calc(var(--spacing) * 8)"]]], [".w-9", null, 4, [["width", "calc(var(--spacing) * 9)"]]], [".w-10", null, 4, [["width", "calc(var(--spacing) * 10)"]]], [".w-20", null, 4, [["width", "calc(var(--spacing) * 20)"]]], [".w-40", null, 4, [["width", "calc(var(--spacing) * 40)"]]], [".w-44", null, 4, [["width", "calc(var(--spacing) * 44)"]]], [".w-\\[1\\.1rem\\]", null, 4, [["width", "1.1rem"]]], [".w-\\[1\\.4rem\\]", null, 4, [["width", "1.4rem"]]], [".w-\\[1\\.6rem\\]", null, 4, [["width", "1.6rem"]]], [".w-\\[1\\.25rem\\]", null, 4, [["width", "1.25rem"]]], [".w-\\[2\\.4rem\\]", null, 4, [["width", "2.4rem"]]], [".w-\\[2\\.25rem\\]", null, 4, [["width", "2.25rem"]]], [".w-\\[6rem\\]", null, 4, [["width", "6rem"]]], [".w-\\[7rem\\]", null, 4, [["width", "7rem"]]], [".w-\\[11rem\\]", null, 4, [["width", "11rem"]]], [".w-\\[15rem\\]", null, 4, [["width", "15rem"]]], [".w-\\[16rem\\]", null, 4, [["width", "16rem"]]], [".w-\\[18px\\]", null, 4, [["width", "18px"]]], [".w-\\[100cqi\\]", null, 4, [["width", "100cqi"]]], [".w-\\[calc\\(\\(100\\%-0\\.875rem\\)\\/8\\)\\]", null, 4, [["width", "calc(12.5% - .109375rem)"]]], [".w-\\[calc\\(100\\%_-_0\\.6rem\\)\\]", null, 4, [["width", "calc(100% - .6rem)"]]], [".w-\\[calc\\(100\\%_-_1rem\\)\\]", null, 4, [["width", "calc(100% - 1rem)"]]], [".w-\\[min\\(22rem\\,calc\\(100vw-3rem\\)\\)\\]", null, 4, [["width", "min(22rem, 100vw - 3rem)"]]], [".w-\\[min\\(26rem\\,100\\%\\)\\]", null, 4, [["width", "min(26rem, 100%)"]]], [".w-\\[min\\(28rem\\,calc\\(100vw-2\\.5rem\\)\\)\\]", null, 4, [["width", "min(28rem, 100vw - 2.5rem)"]]], [".w-\\[min\\(30rem\\,92vw\\)\\]", null, 4, [["width", "min(30rem, 92vw)"]]], [".w-\\[min\\(32rem\\,100\\%\\)\\]", null, 4, [["width", "min(32rem, 100%)"]]], [".w-\\[min\\(340px\\,calc\\(100vw-16px\\)\\)\\]", null, 4, [["width", "min(340px, 100vw - 16px)"]]], [".w-\\[min\\(360px\\,calc\\(100vw_-_2rem\\)\\)\\]", null, 4, [["width", "min(360px, 100vw - 2rem)"]]], [".w-\\[min\\(420px\\,calc\\(100vw_-_16px\\)\\)\\]", null, 4, [["width", "min(420px, 100vw - 16px)"]]], [".w-\\[min\\(480px\\,calc\\(100vw_-_2rem\\)\\)\\]", null, 4, [["width", "min(480px, 100vw - 2rem)"]]], [".w-\\[min\\(560px\\,calc\\(100vw_-_2rem\\)\\)\\]", null, 4, [["width", "min(560px, 100vw - 2rem)"]]], [".w-\\[var\\(--sidebar-width\\,240px\\)\\]", null, 4, [["width", "var(--sidebar-width, 240px)"]]], [".w-\\[var\\(--tools-width\\)\\]", null, 4, [["width", "var(--tools-width)"]]], [".w-auto", null, 4, [["width", "auto"]]], [".w-full", null, 4, [["width", "100%"]]], [".w-px", null, 4, [["width", "1px"]]], [".max-w-24", null, 4, [["max-width", "calc(var(--spacing) * 24)"]]], [".max-w-32", null, 4, [["max-width", "calc(var(--spacing) * 32)"]]], [".max-w-\\[9rem\\]", null, 4, [["max-width", "9rem"]]], [".max-w-\\[10rem\\]", null, 4, [["max-width", "10rem"]]], [".max-w-\\[14rem\\]", null, 4, [["max-width", "14rem"]]], [".max-w-\\[16rem\\]", null, 4, [["max-width", "16rem"]]], [".max-w-\\[24rem\\]", null, 4, [["max-width", "24rem"]]], [".max-w-\\[25\\%\\]", null, 4, [["max-width", "25%"]]], [".max-w-\\[26rem\\]", null, 4, [["max-width", "26rem"]]], [".max-w-\\[28rem\\]", null, 4, [["max-width", "28rem"]]], [".max-w-\\[35\\%\\]", null, 4, [["max-width", "35%"]]], [".max-w-\\[38\\%\\]", null, 4, [["max-width", "38%"]]], [".max-w-\\[45\\%\\]", null, 4, [["max-width", "45%"]]], [".max-w-\\[46rem\\]", null, 4, [["max-width", "46rem"]]], [".max-w-\\[55\\%\\]", null, 4, [["max-width", "55%"]]], [".max-w-\\[56rem\\]", null, 4, [["max-width", "56rem"]]], [".max-w-\\[85\\%\\]", null, 4, [["max-width", "85%"]]], [".max-w-\\[140px\\]", null, 4, [["max-width", "140px"]]], [".max-w-\\[320px\\]", null, 4, [["max-width", "320px"]]], [".max-w-\\[min\\(22rem\\,calc\\(100\\%-1\\.5rem\\)\\)\\]", null, 4, [["max-width", "min(22rem, 100% - 1.5rem)"]]], [".max-w-\\[min\\(30rem\\,calc\\(100\\%-1\\.6rem\\)\\)\\]", null, 4, [["max-width", "min(30rem, 100% - 1.6rem)"]]], [".max-w-\\[min\\(34rem\\,calc\\(100\\%-1\\.5rem\\)\\)\\]", null, 4, [["max-width", "min(34rem, 100% - 1.5rem)"]]], [".max-w-\\[min\\(320px\\,calc\\(100vw_-_24px\\)\\)\\]", null, 4, [["max-width", "min(320px, 100vw - 24px)"]]], [".max-w-full", null, 4, [["max-width", "100%"]]], [".max-w-none", null, 4, [["max-width", "none"]]], [".min-w-0", null, 4, [["min-width", "0"]]], [".min-w-6", null, 4, [["min-width", "calc(var(--spacing) * 6)"]]], [".min-w-8", null, 4, [["min-width", "calc(var(--spacing) * 8)"]]], [".min-w-12", null, 4, [["min-width", "calc(var(--spacing) * 12)"]]], [".min-w-24", null, 4, [["min-width", "calc(var(--spacing) * 24)"]]], [".min-w-36", null, 4, [["min-width", "calc(var(--spacing) * 36)"]]], [".min-w-56", null, 4, [["min-width", "calc(var(--spacing) * 56)"]]], [".min-w-\\[5\\.5rem\\]", null, 4, [["min-width", "5.5rem"]]], [".min-w-\\[7rem\\]", null, 4, [["min-width", "7rem"]]], [".min-w-\\[12rem\\]", null, 4, [["min-width", "12rem"]]], [".min-w-\\[14px\\]", null, 4, [["min-width", "14px"]]], [".min-w-\\[200px\\]", null, 4, [["min-width", "200px"]]], [".min-w-fit", null, 4, [["min-width", "fit-content"]]], [".min-w-max", null, 4, [["min-width", "max-content"]]], [".flex-1", null, 4, [["flex", "1"]]], [".flex-\\[0_0_5rem\\]", null, 4, [["flex", "0 0 5rem"]]], [".flex-\\[0_0_8px\\]", null, 4, [["flex", "0 0 8px"]]], [".flex-\\[0_1_40\\%\\]", null, 4, [["flex", "0 40%"]]], [".flex-\\[1_1_100\\%\\]", null, 4, [["flex", "100%"]]], [".flex-\\[2\\]", null, 4, [["flex", "2"]]], [".flex-initial", null, 4, [["flex", "0 auto"]]], [".flex-none", null, 4, [["flex", "none"]]], [".shrink", null, 4, [["flex-shrink", "1"]]], [".shrink-0", null, 4, [["flex-shrink", "0"]]], [".shrink-\\[0\\.001\\]", null, 4, [["flex-shrink", ".001"]]], [".shrink-\\[2\\]", null, 4, [["flex-shrink", "2"]]], [".shrink-\\[3\\]", null, 4, [["flex-shrink", "3"]]], [".grow", null, 4, [["flex-grow", "1"]]], [".basis-0", null, 4, [["flex-basis", "0"]]], [".basis-\\[14rem\\]", null, 4, [["flex-basis", "14rem"]]], [".-translate-y-1\\/2", null, 4, [["--tw-translate-y", "calc(calc(1 / 2 * 100%) * -1)"], ["translate", "var(--tw-translate-x) var(--tw-translate-y)"]]], [".\\[transform\\:translateY\\(-50\\%\\)\\]", null, 4, [["transform", "translateY(-50%)"]]], [".transform", null, 4, [["transform", "var(--tw-rotate-x, ) var(--tw-rotate-y, ) var(--tw-rotate-z, ) var(--tw-skew-x, ) var(--tw-skew-y, )"]]], [".animate-drop-zone", null, 4, [["animation", "var(--animate-drop-zone)"]]], [".animate-host-pulse", null, 4, [["animation", "var(--animate-host-pulse)"]]], [".animate-pulse", null, 4, [["animation", "var(--animate-pulse)"]]], [".animate-toast-in", null, 4, [["animation", "var(--animate-toast-in)"]]], [".cursor-col-resize", null, 4, [["cursor", "col-resize"]]], [".cursor-default", null, 4, [["cursor", "default"]]], [".cursor-grab", null, 4, [["cursor", "grab"]]], [".cursor-grabbing", null, 4, [["cursor", "grabbing"]]], [".cursor-pointer", null, 4, [["cursor", "pointer"]]], [".cursor-row-resize", null, 4, [["cursor", "row-resize"]]], [".touch-none", null, 4, [["touch-action", "none"]]], [".resize", null, 4, [["resize", "both"]]], [".resize-none", null, 4, [["resize", "none"]]], [".resize-y", null, 4, [["resize", "vertical"]]], [".\\[scrollbar-width\\:none\\]", null, 4, [["scrollbar-width", "none"]]], [".list-disc", null, 4, [["list-style-type", "disc"]]], [".list-none", null, 4, [["list-style-type", "none"]]], [".appearance-none", null, 4, [["appearance", "none"]]], [".grid-cols-8", null, 4, [["grid-template-columns", "repeat(8, minmax(0, 1fr))"]]], [".grid-cols-\\[1fr_auto_1fr\\]", null, 4, [["grid-template-columns", "1fr auto 1fr"]]], [".grid-cols-\\[2\\.5rem_2\\.5rem_0\\.9rem_minmax\\(0\\,1fr\\)\\]", null, 4, [["grid-template-columns", "2.5rem 2.5rem .9rem minmax(0, 1fr)"]]], [".grid-cols-\\[auto_minmax\\(0\\,1fr\\)\\]", null, 4, [["grid-template-columns", "auto minmax(0, 1fr)"]]], [".grid-cols-\\[minmax\\(4rem\\,10rem\\)_1fr_auto\\]", null, 4, [["grid-template-columns", "minmax(4rem, 10rem) 1fr auto"]]], [".grid-cols-\\[repeat\\(2\\,minmax\\(0\\,1fr\\)\\)\\]", null, 4, [["grid-template-columns", "repeat(2, minmax(0, 1fr))"]]], [".grid-cols-\\[repeat\\(auto-fit\\,minmax\\(8rem\\,1fr\\)\\)\\]", null, 4, [["grid-template-columns", "repeat(auto-fit, minmax(8rem, 1fr))"]]], [".flex-col", null, 4, [["flex-direction", "column"]]], [".flex-row", null, 4, [["flex-direction", "row"]]], [".flex-wrap", null, 4, [["flex-wrap", "wrap"]]], [".place-items-center", null, 4, [["place-items", "center"]]], [".content-center", null, 4, [["align-content", "center"]]], [".items-baseline", null, 4, [["align-items", "baseline"]]], [".items-center", null, 4, [["align-items", "center"]]], [".items-end", null, 4, [["align-items", "flex-end"]]], [".items-start", null, 4, [["align-items", "flex-start"]]], [".items-stretch", null, 4, [["align-items", "stretch"]]], [".justify-between", null, 4, [["justify-content", "space-between"]]], [".justify-center", null, 4, [["justify-content", "center"]]], [".justify-end", null, 4, [["justify-content", "flex-end"]]], [".justify-start", null, 4, [["justify-content", "flex-start"]]], [".justify-items-center", null, 4, [["justify-items", "center"]]], [".justify-items-start", null, 4, [["justify-items", "start"]]], [".gap-0", null, 4, [["gap", "0"]]], [".gap-0\\.5", null, 4, [["gap", "calc(var(--spacing) * .5)"]]], [".gap-1", null, 4, [["gap", "var(--spacing)"]]], [".gap-1\\.5", null, 4, [["gap", "calc(var(--spacing) * 1.5)"]]], [".gap-2", null, 4, [["gap", "calc(var(--spacing) * 2)"]]], [".gap-3", null, 4, [["gap", "calc(var(--spacing) * 3)"]]], [".gap-4", null, 4, [["gap", "calc(var(--spacing) * 4)"]]], [".gap-6", null, 4, [["gap", "calc(var(--spacing) * 6)"]]], [".gap-\\[0\\.1rem\\]", null, 4, [["gap", ".1rem"]]], [".gap-\\[0\\.3rem\\]", null, 4, [["gap", ".3rem"]]], [".gap-\\[0\\.4rem\\]", null, 4, [["gap", ".4rem"]]], [".gap-\\[0\\.05rem\\]", null, 4, [["gap", ".05rem"]]], [".gap-\\[0\\.6rem\\]", null, 4, [["gap", ".6rem"]]], [".gap-\\[0\\.8rem\\]", null, 4, [["gap", ".8rem"]]], [".gap-\\[0\\.16rem\\]", null, 4, [["gap", ".16rem"]]], [".gap-\\[0\\.32rem\\]", null, 4, [["gap", ".32rem"]]], [".gap-\\[0\\.35rem\\]", null, 4, [["gap", ".35rem"]]], [".gap-\\[0\\.45rem\\]", null, 4, [["gap", ".45rem"]]], [".gap-\\[0\\.55rem\\]", null, 4, [["gap", ".55rem"]]], [".gap-\\[0\\.65rem\\]", null, 4, [["gap", ".65rem"]]], [".gap-\\[0\\.85rem\\]", null, 4, [["gap", ".85rem"]]], [".gap-\\[1px\\]", null, 4, [["gap", "1px"]]], [".gap-\\[2px\\]", null, 4, [["gap", "2px"]]], [".gap-\\[3px\\]", null, 4, [["gap", "3px"]]], [".gap-\\[7px\\]", null, 4, [["gap", "7px"]]], [".gap-\\[13px\\]", null, 4, [["gap", "13px"]]], [":where(.space-y-0\\.5 > :not(:last-child))", null, 4, [["--tw-space-y-reverse", "0"], ["margin-block-start", "calc(calc(var(--spacing) * .5) * var(--tw-space-y-reverse))"], ["margin-block-end", "calc(calc(var(--spacing) * .5) * calc(1 - var(--tw-space-y-reverse)))"]]], [".gap-x-3", null, 4, [["column-gap", "calc(var(--spacing) * 3)"]]], [".gap-x-4", null, 4, [["column-gap", "calc(var(--spacing) * 4)"]]], [".gap-x-\\[0\\.7rem\\]", null, 4, [["column-gap", ".7rem"]]], [".gap-x-\\[0\\.9rem\\]", null, 4, [["column-gap", ".9rem"]]], [".gap-y-1", null, 4, [["row-gap", "var(--spacing)"]]], [".gap-y-\\[0\\.3rem\\]", null, 4, [["row-gap", ".3rem"]]], [".self-center", null, 4, [["align-self", "center"]]], [".self-end", null, 4, [["align-self", "flex-end"]]], [".self-start", null, 4, [["align-self", "flex-start"]]], [".self-stretch", null, 4, [["align-self", "stretch"]]], [".justify-self-start", null, 4, [["justify-self", "flex-start"]]], [".truncate", null, 4, [["text-overflow", "ellipsis"], ["white-space", "nowrap"], ["overflow", "hidden"]]], [".overflow-auto", null, 4, [["overflow", "auto"]]], [".overflow-hidden", null, 4, [["overflow", "hidden"]]], [".overflow-visible", null, 4, [["overflow", "visible"]]], [".overflow-x-auto", null, 4, [["overflow-x", "auto"]]], [".overflow-y-auto", null, 4, [["overflow-y", "auto"]]], [".overscroll-contain", null, 4, [["overscroll-behavior", "contain"]]], [".rounded, .rounded-\\[0\\.25rem\\]", null, 4, [["border-radius", ".25rem"]]], [".rounded-\\[1\\.5rem\\]", null, 4, [["border-radius", "1.5rem"]]], [".rounded-\\[2px\\]", null, 4, [["border-radius", "2px"]]], [".rounded-\\[3px\\]", null, 4, [["border-radius", "3px"]]], [".rounded-\\[12px\\]", null, 4, [["border-radius", "12px"]]], [".rounded-\\[50\\%\\]", null, 4, [["border-radius", "50%"]]], [".rounded-\\[999px\\]", null, 4, [["border-radius", "999px"]]], [".rounded-\\[calc\\(var\\(--radius\\)\\*2\\)\\]", null, 4, [["border-radius", "calc(var(--radius) * 2)"]]], [".rounded-\\[var\\(--card-radius\\,8px\\)\\]", null, 4, [["border-radius", "var(--card-radius, 8px)"]]], [".rounded-\\[var\\(--card-radius\\,12px\\)\\]", null, 4, [["border-radius", "var(--card-radius, 12px)"]]], [".rounded-full", null, 4, [["border-radius", "3.40282e38px"]]], [".rounded-none", null, 4, [["border-radius", "0"]]], [".rounded-soft", null, 4, [["border-radius", "var(--radius-pane)"]]], [".rounded-ui", null, 4, [["border-radius", "var(--radius)"]]], [".rounded-t-\\[12px\\]", null, 4, [["border-top-left-radius", "12px"], ["border-top-right-radius", "12px"]]], [".rounded-t-none", null, 4, [["border-top-left-radius", "0"], ["border-top-right-radius", "0"]]], [".rounded-bl-\\[6px\\]", null, 4, [["border-bottom-left-radius", "6px"]]], [".border", null, 4, [["border-style", "var(--tw-border-style)"], ["border-width", "1px"]]], [".border-0", null, 4, [["border-style", "var(--tw-border-style)"], ["border-width", "0"]]], [".border-\\[1\\.5px\\]", null, 4, [["border-style", "var(--tw-border-style)"], ["border-width", "1.5px"]]], [".border-b", null, 4, [["border-bottom-style", "var(--tw-border-style)"], ["border-bottom-width", "1px"]]], [".border-l", null, 4, [["border-left-style", "var(--tw-border-style)"], ["border-left-width", "1px"]]], [".border-l-\\[3px\\]", null, 4, [["border-left-style", "var(--tw-border-style)"], ["border-left-width", "3px"]]], [".border-solid", null, 4, [["--tw-border-style", "solid"], ["border-style", "solid"]]], [".border-accent", null, 4, [["border-color", "var(--accent)"]]], [".border-overlay-0", null, 4, [["border-color", "var(--overlay-0)"]]], [".border-overlay-1", null, 4, [["border-color", "var(--overlay-1)"]]], [".border-red", null, 4, [["border-color", "var(--red)"]]], [".border-subtext-0", null, 4, [["border-color", "var(--subtext-0)"]]], [".border-surface-1", null, 4, [["border-color", "var(--surface-1)"]]], [".border-teal", null, 4, [["border-color", "var(--teal)"]]], [".border-yellow", null, 4, [["border-color", "var(--yellow)"]]], [".border-l-accent", null, 4, [["border-left-color", "var(--accent)"]]], [".border-l-green", null, 4, [["border-left-color", "var(--green)"]]], [".border-l-red", null, 4, [["border-left-color", "var(--red)"]]], [".border-l-yellow", null, 4, [["border-left-color", "var(--yellow)"]]], [".bg-\\[\\#161616\\]", null, 4, [["background-color", "#161616"]]], [".bg-\\[\\#fff\\]", null, 4, [["background-color", "#fff"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_8\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "var(--accent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_8\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--accent) 8%,var(--panel-bg))"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_12\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--accent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_12\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--accent) 12%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--accent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--accent) 15%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--blue\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--blue)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--blue\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--blue) 15%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--green\\)_9\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--green)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--green\\)_9\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--green) 9%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--red\\)_7\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--red)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--red\\)_7\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--red) 7%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--red\\)_9\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--red)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--red\\)_9\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--red) 9%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--surface-1\\)_42\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--surface-1\\)_42\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--surface-1) 42%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--surface-1\\)_70\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--surface-1\\)_70\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--surface-1) 70%,var(--panel-bg))"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--text\\)_10\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "var(--text)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--text\\)_10\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--text) 10%,var(--panel-bg))"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--yellow\\)_8\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--yellow)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--yellow\\)_8\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--yellow) 8%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--yellow\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--yellow)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--yellow\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--yellow) 15%,transparent)"]]], [".bg-\\[rgba\\(0\\,0\\,0\\,0\\.5\\)\\]", null, 4, [["background-color", "#00000080"]]], [".bg-\\[rgba\\(0\\,0\\,0\\,0\\.7\\)\\]", null, 4, [["background-color", "#000000b3"]]], [".bg-\\[rgba\\(0\\,0\\,0\\,0\\.55\\)\\]", null, 4, [["background-color", "#0000008c"]]], [".bg-\\[rgba\\(0\\,0\\,0\\,0\\.62\\)\\]", null, 4, [["background-color", "#0000009e"]]], [".bg-\\[var\\(--accent\\)\\]", null, 4, [["background-color", "var(--accent)"]]], [".bg-\\[var\\(--backdrop\\)\\]", null, 4, [["background-color", "var(--backdrop)"]]], [".bg-\\[var\\(--bg\\)\\]", null, 4, [["background-color", "var(--bg)"]]], [".bg-\\[var\\(--card-bg\\)\\]", null, 4, [["background-color", "var(--card-bg)"]]], [".bg-\\[var\\(--picker-bg\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "var(--picker-bg, var(--panel-bg))"]]], [".bg-\\[var\\(--surface-1\\)\\]", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-\\[var\\(--workspace-tools-bg\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "var(--workspace-tools-bg, var(--panel-bg))"]]], [".bg-accent, .bg-accent\\/10", null, 4, [["background-color", "var(--accent)"]]], [".bg-accent\\/10", null, 4, [["background-color", "color-mix(in oklab, var(--accent) 10%, transparent)"]]], [".bg-accent\\/35", null, 4, [["background-color", "var(--accent)"]]], [".bg-accent\\/35", null, 4, [["background-color", "color-mix(in oklab, var(--accent) 35%, transparent)"]]], [".bg-fg", null, 4, [["background-color", "var(--text)"]]], [".bg-green, .bg-green\\/15", null, 4, [["background-color", "var(--green)"]]], [".bg-green\\/15", null, 4, [["background-color", "color-mix(in oklab, var(--green) 15%, transparent)"]]], [".bg-overlay-0", null, 4, [["background-color", "var(--overlay-0)"]]], [".bg-overlay-1", null, 4, [["background-color", "var(--overlay-1)"]]], [".bg-panel-bg", null, 4, [["background-color", "var(--panel-bg)"]]], [".bg-red, .bg-red\\/15", null, 4, [["background-color", "var(--red)"]]], [".bg-red\\/15", null, 4, [["background-color", "color-mix(in oklab, var(--red) 15%, transparent)"]]], [".bg-subtext-0", null, 4, [["background-color", "var(--subtext-0)"]]], [".bg-surface-0", null, 4, [["background-color", "var(--surface-0)"]]], [".bg-surface-1, .bg-surface-1\\/30", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-surface-1\\/30", null, 4, [["background-color", "color-mix(in oklab, var(--surface-1) 30%, transparent)"]]], [".bg-surface-1\\/60", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-surface-1\\/60", null, 4, [["background-color", "color-mix(in oklab, var(--surface-1) 60%, transparent)"]]], [".bg-surface-1\\/70", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-surface-1\\/70", null, 4, [["background-color", "color-mix(in oklab, var(--surface-1) 70%, transparent)"]]], [".bg-transparent", null, 4, [["background-color", "#0000"]]], [".bg-yellow", null, 4, [["background-color", "var(--yellow)"]]], [".object-contain", null, 4, [["object-fit", "contain"]]], [".object-cover", null, 4, [["object-fit", "cover"]]], [".p-0", null, 4, [["padding", "0"]]], [".p-0\\.5", null, 4, [["padding", "calc(var(--spacing) * .5)"]]], [".p-1", null, 4, [["padding", "var(--spacing)"]]], [".p-2", null, 4, [["padding", "calc(var(--spacing) * 2)"]]], [".p-3", null, 4, [["padding", "calc(var(--spacing) * 3)"]]], [".p-4", null, 4, [["padding", "calc(var(--spacing) * 4)"]]], [".p-5", null, 4, [["padding", "calc(var(--spacing) * 5)"]]], [".p-6", null, 4, [["padding", "calc(var(--spacing) * 6)"]]], [".p-\\[0\\.2rem\\]", null, 4, [["padding", ".2rem"]]], [".p-\\[0\\.4rem\\]", null, 4, [["padding", ".4rem"]]], [".p-\\[0\\.5rem\\]", null, 4, [["padding", ".5rem"]]], [".p-\\[0\\.9rem\\]", null, 4, [["padding", ".9rem"]]], [".p-\\[0\\.45rem\\]", null, 4, [["padding", ".45rem"]]], [".p-\\[0\\.55rem\\]", null, 4, [["padding", ".55rem"]]], [".p-\\[0\\.65rem\\]", null, 4, [["padding", ".65rem"]]], [".p-\\[2px\\]", null, 4, [["padding", "2px"]]], [".px-0", null, 4, [["padding-inline", "0"]]], [".px-1", null, 4, [["padding-inline", "var(--spacing)"]]], [".px-1\\.5", null, 4, [["padding-inline", "calc(var(--spacing) * 1.5)"]]], [".px-2", null, 4, [["padding-inline", "calc(var(--spacing) * 2)"]]], [".px-3", null, 4, [["padding-inline", "calc(var(--spacing) * 3)"]]], [".px-3\\.5", null, 4, [["padding-inline", "calc(var(--spacing) * 3.5)"]]], [".px-4", null, 4, [["padding-inline", "calc(var(--spacing) * 4)"]]], [".px-8", null, 4, [["padding-inline", "calc(var(--spacing) * 8)"]]], [".px-\\[0\\.2rem\\]", null, 4, [["padding-inline", ".2rem"]]], [".px-\\[0\\.3rem\\]", null, 4, [["padding-inline", ".3rem"]]], [".px-\\[0\\.4rem\\]", null, 4, [["padding-inline", ".4rem"]]], [".px-\\[0\\.5rem\\]", null, 4, [["padding-inline", ".5rem"]]], [".px-\\[0\\.6rem\\]", null, 4, [["padding-inline", ".6rem"]]], [".px-\\[0\\.7rem\\]", null, 4, [["padding-inline", ".7rem"]]], [".px-\\[0\\.8rem\\]", null, 4, [["padding-inline", ".8rem"]]], [".px-\\[0\\.9rem\\]", null, 4, [["padding-inline", ".9rem"]]], [".px-\\[0\\.26rem\\]", null, 4, [["padding-inline", ".26rem"]]], [".px-\\[0\\.28rem\\]", null, 4, [["padding-inline", ".28rem"]]], [".px-\\[0\\.35rem\\]", null, 4, [["padding-inline", ".35rem"]]], [".px-\\[0\\.42rem\\]", null, 4, [["padding-inline", ".42rem"]]], [".px-\\[0\\.45rem\\]", null, 4, [["padding-inline", ".45rem"]]], [".px-\\[0\\.48rem\\]", null, 4, [["padding-inline", ".48rem"]]], [".px-\\[0\\.55rem\\]", null, 4, [["padding-inline", ".55rem"]]], [".px-\\[0\\.65rem\\]", null, 4, [["padding-inline", ".65rem"]]], [".px-\\[0\\.75rem\\]", null, 4, [["padding-inline", ".75rem"]]], [".px-\\[0\\.85rem\\]", null, 4, [["padding-inline", ".85rem"]]], [".px-\\[1\\.4rem\\]", null, 4, [["padding-inline", "1.4rem"]]], [".px-\\[3px\\]", null, 4, [["padding-inline", "3px"]]], [".px-\\[10px\\]", null, 4, [["padding-inline", "10px"]]], [".py-0", null, 4, [["padding-block", "0"]]], [".py-0\\.5", null, 4, [["padding-block", "calc(var(--spacing) * .5)"]]], [".py-1", null, 4, [["padding-block", "var(--spacing)"]]], [".py-1\\.5", null, 4, [["padding-block", "calc(var(--spacing) * 1.5)"]]], [".py-2", null, 4, [["padding-block", "calc(var(--spacing) * 2)"]]], [".py-3", null, 4, [["padding-block", "calc(var(--spacing) * 3)"]]], [".py-4", null, 4, [["padding-block", "calc(var(--spacing) * 4)"]]], [".py-8", null, 4, [["padding-block", "calc(var(--spacing) * 8)"]]], [".py-\\[0\\.1rem\\]", null, 4, [["padding-block", ".1rem"]]], [".py-\\[0\\.2rem\\]", null, 4, [["padding-block", ".2rem"]]], [".py-\\[0\\.3rem\\]", null, 4, [["padding-block", ".3rem"]]], [".py-\\[0\\.4rem\\]", null, 4, [["padding-block", ".4rem"]]], [".py-\\[0\\.05rem\\]", null, 4, [["padding-block", ".05rem"]]], [".py-\\[0\\.6rem\\]", null, 4, [["padding-block", ".6rem"]]], [".py-\\[0\\.8rem\\]", null, 4, [["padding-block", ".8rem"]]], [".py-\\[0\\.12rem\\]", null, 4, [["padding-block", ".12rem"]]], [".py-\\[0\\.14rem\\]", null, 4, [["padding-block", ".14rem"]]], [".py-\\[0\\.15rem\\]", null, 4, [["padding-block", ".15rem"]]], [".py-\\[0\\.18rem\\]", null, 4, [["padding-block", ".18rem"]]], [".py-\\[0\\.25rem\\]", null, 4, [["padding-block", ".25rem"]]], [".py-\\[0\\.28rem\\]", null, 4, [["padding-block", ".28rem"]]], [".py-\\[0\\.32rem\\]", null, 4, [["padding-block", ".32rem"]]], [".py-\\[0\\.35rem\\]", null, 4, [["padding-block", ".35rem"]]], [".py-\\[0\\.42rem\\]", null, 4, [["padding-block", ".42rem"]]], [".py-\\[0\\.45rem\\]", null, 4, [["padding-block", ".45rem"]]], [".py-\\[0\\.55rem\\]", null, 4, [["padding-block", ".55rem"]]], [".py-\\[0\\.65rem\\]", null, 4, [["padding-block", ".65rem"]]], [".py-\\[2px\\]", null, 4, [["padding-block", "2px"]]], [".py-\\[3px\\]", null, 4, [["padding-block", "3px"]]], [".py-\\[6px\\]", null, 4, [["padding-block", "6px"]]], [".py-px", null, 4, [["padding-block", "1px"]]], [".pt-1", null, 4, [["padding-top", "var(--spacing)"]]], [".pt-2", null, 4, [["padding-top", "calc(var(--spacing) * 2)"]]], [".pt-2\\.5", null, 4, [["padding-top", "calc(var(--spacing) * 2.5)"]]], [".pt-3", null, 4, [["padding-top", "calc(var(--spacing) * 3)"]]], [".pt-4", null, 4, [["padding-top", "calc(var(--spacing) * 4)"]]], [".pt-5", null, 4, [["padding-top", "calc(var(--spacing) * 5)"]]], [".pt-\\[0\\.2rem\\]", null, 4, [["padding-top", ".2rem"]]], [".pt-\\[0\\.4rem\\]", null, 4, [["padding-top", ".4rem"]]], [".pt-\\[0\\.6rem\\]", null, 4, [["padding-top", ".6rem"]]], [".pt-\\[0\\.85rem\\]", null, 4, [["padding-top", ".85rem"]]], [".pt-\\[2px\\]", null, 4, [["padding-top", "2px"]]], [".pt-\\[12vh\\]", null, 4, [["padding-top", "12vh"]]], [".pt-\\[max\\(0\\.5rem\\,env\\(safe-area-inset-top\\)\\)\\]", null, 4, [["padding-top", "max(.5rem, env(safe-area-inset-top))"]]], [".pr-0\\.5", null, 4, [["padding-right", "calc(var(--spacing) * .5)"]]], [".pr-1", null, 4, [["padding-right", "var(--spacing)"]]], [".pr-1\\.5", null, 4, [["padding-right", "calc(var(--spacing) * 1.5)"]]], [".pr-2", null, 4, [["padding-right", "calc(var(--spacing) * 2)"]]], [".pr-3", null, 4, [["padding-right", "calc(var(--spacing) * 3)"]]], [".pr-12", null, 4, [["padding-right", "calc(var(--spacing) * 12)"]]], [".pr-\\[0\\.3rem\\]", null, 4, [["padding-right", ".3rem"]]], [".pr-\\[0\\.6rem\\]", null, 4, [["padding-right", ".6rem"]]], [".pr-\\[0\\.35rem\\]", null, 4, [["padding-right", ".35rem"]]], [".pr-\\[0\\.45rem\\]", null, 4, [["padding-right", ".45rem"]]], [".pr-\\[0\\.55rem\\]", null, 4, [["padding-right", ".55rem"]]], [".pr-\\[1\\.6rem\\]", null, 4, [["padding-right", "1.6rem"]]], [".pr-\\[3px\\]", null, 4, [["padding-right", "3px"]]], [".pr-\\[env\\(safe-area-inset-right\\)\\]", null, 4, [["padding-right", "env(safe-area-inset-right)"]]], [".pr-\\[max\\(0\\.5rem\\,env\\(safe-area-inset-right\\)\\)\\]", null, 4, [["padding-right", "max(.5rem, env(safe-area-inset-right))"]]], [".pb-1", null, 4, [["padding-bottom", "var(--spacing)"]]], [".pb-2", null, 4, [["padding-bottom", "calc(var(--spacing) * 2)"]]], [".pb-3", null, 4, [["padding-bottom", "calc(var(--spacing) * 3)"]]], [".pb-4", null, 4, [["padding-bottom", "calc(var(--spacing) * 4)"]]], [".pb-8", null, 4, [["padding-bottom", "calc(var(--spacing) * 8)"]]], [".pb-\\[0\\.3rem\\]", null, 4, [["padding-bottom", ".3rem"]]], [".pb-\\[0\\.4rem\\]", null, 4, [["padding-bottom", ".4rem"]]], [".pb-\\[0\\.25rem\\]", null, 4, [["padding-bottom", ".25rem"]]], [".pb-\\[0\\.55rem\\]", null, 4, [["padding-bottom", ".55rem"]]], [".pb-\\[1\\.4rem\\]", null, 4, [["padding-bottom", "1.4rem"]]], [".pb-\\[calc\\(1\\.5rem\\+env\\(safe-area-inset-bottom\\)\\)\\]", null, 4, [["padding-bottom", "calc(1.5rem + env(safe-area-inset-bottom))"]]], [".pb-\\[calc\\(1rem\\+env\\(safe-area-inset-bottom\\)\\)\\]", null, 4, [["padding-bottom", "calc(1rem + env(safe-area-inset-bottom))"]]], [".pb-\\[env\\(safe-area-inset-bottom\\)\\]", null, 4, [["padding-bottom", "env(safe-area-inset-bottom)"]]], [".pb-\\[max\\(0\\.5rem\\,env\\(safe-area-inset-bottom\\)\\)\\]", null, 4, [["padding-bottom", "max(.5rem, env(safe-area-inset-bottom))"]]], [".pl-1", null, 4, [["padding-left", "var(--spacing)"]]], [".pl-1\\.5", null, 4, [["padding-left", "calc(var(--spacing) * 1.5)"]]], [".pl-2", null, 4, [["padding-left", "calc(var(--spacing) * 2)"]]], [".pl-3", null, 4, [["padding-left", "calc(var(--spacing) * 3)"]]], [".pl-4", null, 4, [["padding-left", "calc(var(--spacing) * 4)"]]], [".pl-5", null, 4, [["padding-left", "calc(var(--spacing) * 5)"]]], [".pl-6", null, 4, [["padding-left", "calc(var(--spacing) * 6)"]]], [".pl-\\[0\\.4rem\\]", null, 4, [["padding-left", ".4rem"]]], [".pl-\\[0\\.45rem\\]", null, 4, [["padding-left", ".45rem"]]], [".pl-\\[0\\.75rem\\]", null, 4, [["padding-left", ".75rem"]]], [".pl-\\[0\\.85rem\\]", null, 4, [["padding-left", ".85rem"]]], [".pl-\\[1\\.2rem\\]", null, 4, [["padding-left", "1.2rem"]]], [".pl-\\[1\\.55rem\\]", null, 4, [["padding-left", "1.55rem"]]], [".pl-\\[1\\.075rem\\]", null, 4, [["padding-left", "1.075rem"]]], [".pl-\\[1\\.525rem\\]", null, 4, [["padding-left", "1.525rem"]]], [".pl-\\[1\\.875rem\\]", null, 4, [["padding-left", "1.875rem"]]], [".pl-\\[85px\\]", null, 4, [["padding-left", "85px"]]], [".pl-\\[max\\(0\\.5rem\\,env\\(safe-area-inset-left\\)\\)\\]", null, 4, [["padding-left", "max(.5rem, env(safe-area-inset-left))"]]], [".pl-\\[max\\(0\\.25rem\\,env\\(safe-area-inset-left\\)\\)\\]", null, 4, [["padding-left", "max(.25rem, env(safe-area-inset-left))"]]], [".text-center", null, 4, [["text-align", "center"]]], [".text-left", null, 4, [["text-align", "left"]]], [".text-right", null, 4, [["text-align", "right"]]], [".\\[font-family\\:inherit\\]", null, 4, [["font-family", "inherit"]]], [".\\[font-family\\:ui-monospace\\,SFMono-Regular\\,Menlo\\,monospace\\]", null, 4, [["font-family", "ui-monospace, SFMono-Regular, Menlo, monospace"]]], [".\\[font-family\\:var\\(--font-mono\\)\\]", null, 4, [["font-family", "var(--font-mono)"]]], [".text-sm", null, 4, [["font-size", "var(--text-sm)"], ["line-height", "var(--tw-leading, var(--text-sm--line-height))"]]], [".text-xs", null, 4, [["font-size", "var(--text-xs)"], ["line-height", "var(--tw-leading, var(--text-xs--line-height))"]]], [".\\[font-size\\:inherit\\]", null, 4, [["font-size", "inherit"]]], [".text-\\[0\\.6rem\\]", null, 4, [["font-size", ".6rem"]]], [".text-\\[0\\.7rem\\]", null, 4, [["font-size", ".7rem"]]], [".text-\\[0\\.8em\\]", null, 4, [["font-size", ".8em"]]], [".text-\\[0\\.8rem\\]", null, 4, [["font-size", ".8rem"]]], [".text-\\[0\\.9em\\]", null, 4, [["font-size", ".9em"]]], [".text-\\[0\\.9rem\\]", null, 4, [["font-size", ".9rem"]]], [".text-\\[0\\.54rem\\]", null, 4, [["font-size", ".54rem"]]], [".text-\\[0\\.58rem\\]", null, 4, [["font-size", ".58rem"]]], [".text-\\[0\\.62rem\\]", null, 4, [["font-size", ".62rem"]]], [".text-\\[0\\.63rem\\]", null, 4, [["font-size", ".63rem"]]], [".text-\\[0\\.64rem\\]", null, 4, [["font-size", ".64rem"]]], [".text-\\[0\\.65rem\\]", null, 4, [["font-size", ".65rem"]]], [".text-\\[0\\.66rem\\]", null, 4, [["font-size", ".66rem"]]], [".text-\\[0\\.66rem\\]\\!", null, 4, [["font-size", ".66rem", 1]]], [".text-\\[0\\.68rem\\]", null, 4, [["font-size", ".68rem"]]], [".text-\\[0\\.72rem\\]", null, 4, [["font-size", ".72rem"]]], [".text-\\[0\\.74rem\\]", null, 4, [["font-size", ".74rem"]]], [".text-\\[0\\.75rem\\]", null, 4, [["font-size", ".75rem"]]], [".text-\\[0\\.76rem\\]", null, 4, [["font-size", ".76rem"]]], [".text-\\[0\\.77rem\\]", null, 4, [["font-size", ".77rem"]]], [".text-\\[0\\.78rem\\]", null, 4, [["font-size", ".78rem"]]], [".text-\\[0\\.82rem\\]", null, 4, [["font-size", ".82rem"]]], [".text-\\[0\\.83rem\\]", null, 4, [["font-size", ".83rem"]]], [".text-\\[0\\.85rem\\]", null, 4, [["font-size", ".85rem"]]], [".text-\\[0\\.88rem\\]", null, 4, [["font-size", ".88rem"]]], [".text-\\[0\\.95rem\\]", null, 4, [["font-size", ".95rem"]]], [".text-\\[0\\.875rem\\]", null, 4, [["font-size", ".875rem"]]], [".text-\\[1\\.1rem\\]", null, 4, [["font-size", "1.1rem"]]], [".text-\\[1\\.4em\\]", null, 4, [["font-size", "1.4em"]]], [".text-\\[1\\.6rem\\]", null, 4, [["font-size", "1.6rem"]]], [".text-\\[1\\.15rem\\]", null, 4, [["font-size", "1.15rem"]]], [".text-\\[1rem\\]", null, 4, [["font-size", "1rem"]]], [".text-\\[2\\.4rem\\]", null, 4, [["font-size", "2.4rem"]]], [".text-\\[9px\\]", null, 4, [["font-size", "9px"]]], [".text-\\[10px\\]", null, 4, [["font-size", "10px"]]], [".text-\\[11px\\]", null, 4, [["font-size", "11px"]]], [".text-\\[12\\.5px\\]", null, 4, [["font-size", "12.5px"]]], [".text-\\[12px\\]", null, 4, [["font-size", "12px"]]], [".text-\\[13px\\]", null, 4, [["font-size", "13px"]]], [".text-\\[14px\\]", null, 4, [["font-size", "14px"]]], [".text-\\[calc\\(0\\.95rem\\*var\\(--chat-font-scale\\,1\\)\\)\\]", null, 4, [["font-size", "calc(.95rem * var(--chat-font-scale, 1))"]]], [".text-\\[length\\:calc\\(11px\\*var\\(--zoom\\,1\\)\\)\\]", null, 4, [["font-size", "calc(11px * var(--zoom, 1))"]]], [".text-\\[length\\:calc\\(13px\\*var\\(--zoom\\,1\\)\\)\\]", null, 4, [["font-size", "calc(13px * var(--zoom, 1))"]]], [".leading-4", null, 4, [["--tw-leading", "calc(var(--spacing) * 4)"], ["line-height", "calc(var(--spacing) * 4)"]]], [".leading-\\[1\\.1\\]", null, 4, [["--tw-leading", "1.1"], ["line-height", "1.1"]]], [".leading-\\[1\\.2\\]", null, 4, [["--tw-leading", "1.2"], ["line-height", "1.2"]]], [".leading-\\[1\\.3\\]", null, 4, [["--tw-leading", "1.3"], ["line-height", "1.3"]]], [".leading-\\[1\\.4\\]", null, 4, [["--tw-leading", "1.4"], ["line-height", "1.4"]]], [".leading-\\[1\\.5\\]", null, 4, [["--tw-leading", "1.5"], ["line-height", "1.5"]]], [".leading-\\[1\\.6\\]", null, 4, [["--tw-leading", "1.6"], ["line-height", "1.6"]]], [".leading-\\[1\\.45\\]", null, 4, [["--tw-leading", "1.45"], ["line-height", "1.45"]]], [".leading-\\[18px\\]", null, 4, [["--tw-leading", "18px"], ["line-height", "18px"]]], [".leading-none", null, 4, [["--tw-leading", "1"], ["line-height", "1"]]], [".leading-relaxed", null, 4, [["--tw-leading", "var(--leading-relaxed)"], ["line-height", "var(--leading-relaxed)"]]], [".leading-tight", null, 4, [["--tw-leading", "var(--leading-tight)"], ["line-height", "var(--leading-tight)"]]], [".\\[line-height\\:inherit\\]", null, 4, [["line-height", "inherit"]]], [".font-bold", null, 4, [["--tw-font-weight", "var(--font-weight-bold)"], ["font-weight", "var(--font-weight-bold)"]]], [".font-medium", null, 4, [["--tw-font-weight", "var(--font-weight-medium)"], ["font-weight", "var(--font-weight-medium)"]]], [".font-normal", null, 4, [["--tw-font-weight", "var(--font-weight-normal)"], ["font-weight", "var(--font-weight-normal)"]]], [".font-semibold", null, 4, [["--tw-font-weight", "var(--font-weight-semibold)"], ["font-weight", "var(--font-weight-semibold)"]]], [".\\[font-weight\\:inherit\\]", null, 4, [["font-weight", "inherit"]]], [".tracking-\\[-0\\.02em\\]", null, 4, [["--tw-tracking", "-.02em"], ["letter-spacing", "-.02em"]]], [".tracking-\\[0\\.03em\\]", null, 4, [["--tw-tracking", ".03em"], ["letter-spacing", ".03em"]]], [".tracking-\\[0\\.04em\\]", null, 4, [["--tw-tracking", ".04em"], ["letter-spacing", ".04em"]]], [".tracking-\\[0\\.06em\\]", null, 4, [["--tw-tracking", ".06em"], ["letter-spacing", ".06em"]]], [".tracking-\\[0\\.08em\\]", null, 4, [["--tw-tracking", ".08em"], ["letter-spacing", ".08em"]]], [".tracking-\\[0\\.09em\\]", null, 4, [["--tw-tracking", ".09em"], ["letter-spacing", ".09em"]]], [".tracking-\\[0\\.22em\\]", null, 4, [["--tw-tracking", ".22em"], ["letter-spacing", ".22em"]]], [".tracking-normal", null, 4, [["--tw-tracking", "var(--tracking-normal)"], ["letter-spacing", "var(--tracking-normal)"]]], [".tracking-wide", null, 4, [["--tw-tracking", "var(--tracking-wide)"], ["letter-spacing", "var(--tracking-wide)"]]], [".\\[overflow-wrap\\:anywhere\\]", null, 4, [["overflow-wrap", "anywhere"]]], [".break-words", null, 4, [["overflow-wrap", "break-word"]]], [".\\[word-break\\:break-word\\]", null, 4, [["word-break", "break-word"]]], [".text-ellipsis", null, 4, [["text-overflow", "ellipsis"]]], [".whitespace-normal", null, 4, [["white-space", "normal"]]], [".whitespace-nowrap", null, 4, [["white-space", "nowrap"]]], [".whitespace-pre", null, 4, [["white-space", "pre"]]], [".whitespace-pre-wrap", null, 4, [["white-space", "pre-wrap"]]], [".\\[tab-size\\:2\\]", null, 4, [["tab-size", "2"]]], [".text-\\[color\\:var\\(--git-muted\\)\\]", null, 4, [["color", "var(--git-muted)"]]], [".text-\\[var\\(--subtext-0\\)\\]", null, 4, [["color", "var(--subtext-0)"]]], [".text-\\[var\\(--text\\)\\]", null, 4, [["color", "var(--text)"]]], [".text-accent", null, 4, [["color", "var(--accent)"]]], [".text-blue", null, 4, [["color", "var(--blue)"]]], [".text-current", null, 4, [["color", "currentColor"]]], [".text-fg", null, 4, [["color", "var(--text)"]]], [".text-green", null, 4, [["color", "var(--green)"]]], [".text-inherit", null, 4, [["color", "inherit"]]], [".text-mauve", null, 4, [["color", "var(--mauve)"]]], [".text-overlay-0", null, 4, [["color", "var(--overlay-0)"]]], [".text-overlay-1", null, 4, [["color", "var(--overlay-1)"]]], [".text-panel-bg", null, 4, [["color", "var(--panel-bg)"]]], [".text-peach", null, 4, [["color", "var(--peach)"]]], [".text-red", null, 4, [["color", "var(--red)"]]], [".text-red\\!", null, 4, [["color", "var(--red)", 1]]], [".text-subtext-0", null, 4, [["color", "var(--subtext-0)"]]], [".text-yellow", null, 4, [["color", "var(--yellow)"]]], [".capitalize", null, 4, [["text-transform", "capitalize"]]], [".normal-case", null, 4, [["text-transform", "none"]]], [".uppercase", null, 4, [["text-transform", "uppercase"]]], [".italic", null, 4, [["font-style", "italic"]]], [".not-italic", null, 4, [["font-style", "normal"]]], [".tabular-nums", null, 4, [["--tw-numeric-spacing", "tabular-nums"], ["font-variant-numeric", "var(--tw-ordinal, ) var(--tw-slashed-zero, ) var(--tw-numeric-figure, ) var(--tw-numeric-spacing, ) var(--tw-numeric-fraction, )"]]], [".line-through", null, 4, [["text-decoration-line", "line-through"]]], [".no-underline", null, 4, [["text-decoration-line", "none"]]], [".underline", null, 4, [["text-decoration-line", "underline"]]], [".opacity-0", null, 4, [["opacity", "0"]]], [".opacity-40", null, 4, [["opacity", ".4"]]], [".opacity-60", null, 4, [["opacity", ".6"]]], [".opacity-70", null, 4, [["opacity", ".7"]]], [".opacity-75", null, 4, [["opacity", ".75"]]], [".opacity-80", null, 4, [["opacity", ".8"]]], [".opacity-100", null, 4, [["opacity", "1"]]], [".opacity-\\[0\\.72\\]", null, 4, [["opacity", ".72"]]], [".shadow", null, 4, [["--tw-shadow", "0 1px 3px 0 var(--tw-shadow-color, #0000001a), 0 1px 2px -1px var(--tw-shadow-color, #0000001a)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_1px_4px_rgba\\(0\\,0\\,0\\,0\\.4\\)\\]", null, 4, [["--tw-shadow", "0 1px 4px var(--tw-shadow-color, #0006)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_2px_8px_rgba\\(0\\,0\\,0\\,0\\.4\\)\\]", null, 4, [["--tw-shadow", "0 2px 8px var(--tw-shadow-color, #0006)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_2px_8px_rgba\\(0\\,0\\,0\\,0\\.35\\)\\]", null, 4, [["--tw-shadow", "0 2px 8px var(--tw-shadow-color, #00000059)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_6px_20px_rgba\\(0\\,0\\,0\\,0\\.3\\)\\]", null, 4, [["--tw-shadow", "0 6px 20px var(--tw-shadow-color, #0000004d)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_8px_24px_rgba\\(0\\,0\\,0\\,0\\.35\\)\\]", null, 4, [["--tw-shadow", "0 8px 24px var(--tw-shadow-color, #00000059)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_8px_24px_rgba\\(0\\,0\\,0\\,0\\.45\\)\\]", null, 4, [["--tw-shadow", "0 8px 24px var(--tw-shadow-color, #00000073)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_8px_32px_rgba\\(0\\,0\\,0\\,0\\.5\\)\\]", null, 4, [["--tw-shadow", "0 8px 32px var(--tw-shadow-color, #00000080)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_12px_32px_rgba\\(0\\,0\\,0\\,0\\.5\\)\\]", null, 4, [["--tw-shadow", "0 12px 32px var(--tw-shadow-color, #00000080)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_16px_48px_rgba\\(0\\,0\\,0\\,0\\.55\\)\\]", null, 4, [["--tw-shadow", "0 16px 48px var(--tw-shadow-color, #0000008c)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[inset_0_0_24px_var\\(--accent\\)\\]", null, 4, [["--tw-shadow", "inset 0 0 24px var(--tw-shadow-color, var(--accent))"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-lg", null, 4, [["--tw-shadow", "0 10px 15px -3px var(--tw-shadow-color, #0000001a), 0 4px 6px -4px var(--tw-shadow-color, #0000001a)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".ring", null, 4, [["--tw-ring-shadow", "var(--tw-ring-inset, ) 0 0 0 calc(1px + var(--tw-ring-offset-width)) var(--tw-ring-color, currentcolor)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".\\[box-shadow\\:0_1px_2px_rgba\\(0\\,0\\,0\\,0\\.3\\)\\]", null, 4, [["box-shadow", "0 1px 2px #0000004d"]]], [".\\[box-shadow\\:0_4px_14px_rgba\\(0\\,0\\,0\\,0\\.35\\)\\]", null, 4, [["box-shadow", "0 4px 14px #00000059"]]], [".\\[box-shadow\\:none\\]", null, 4, [["box-shadow", "none"]]], [".\\[outline\\:none\\]", null, 4, [["outline", "none"]]], [".outline, .outline-1", null, 4, [["outline-style", "var(--tw-outline-style)"], ["outline-width", "1px"]]], [".outline-2", null, 4, [["outline-style", "var(--tw-outline-style)"], ["outline-width", "2px"]]], [".outline-accent", null, 4, [["outline-color", "var(--accent)"]]], [".blur", null, 4, [["--tw-blur", "blur(8px)"], ["filter", "var(--tw-blur, ) var(--tw-brightness, ) var(--tw-contrast, ) var(--tw-grayscale, ) var(--tw-hue-rotate, ) var(--tw-invert, ) var(--tw-saturate, ) var(--tw-sepia, ) var(--tw-drop-shadow, )"]]], [".\\!filter", null, 4, [["filter", "var(--tw-blur, ) var(--tw-brightness, ) var(--tw-contrast, ) var(--tw-grayscale, ) var(--tw-hue-rotate, ) var(--tw-invert, ) var(--tw-saturate, ) var(--tw-sepia, ) var(--tw-drop-shadow, )", 1]]], [".\\[filter\\:drop-shadow\\(0_6px_10px_rgba\\(0\\,0\\,0\\,0\\.45\\)\\)\\]", null, 4, [["filter", "drop-shadow(0 6px 10px #00000073)"]]], [".filter", null, 4, [["filter", "var(--tw-blur, ) var(--tw-brightness, ) var(--tw-contrast, ) var(--tw-grayscale, ) var(--tw-hue-rotate, ) var(--tw-invert, ) var(--tw-saturate, ) var(--tw-sepia, ) var(--tw-drop-shadow, )"]]], [".backdrop-blur-xl", null, 4, [["--tw-backdrop-blur", "blur(var(--blur-xl))"], ["-webkit-backdrop-filter", "var(--tw-backdrop-blur, ) var(--tw-backdrop-brightness, ) var(--tw-backdrop-contrast, ) var(--tw-backdrop-grayscale, ) var(--tw-backdrop-hue-rotate, ) var(--tw-backdrop-invert, ) var(--tw-backdrop-opacity, ) var(--tw-backdrop-saturate, ) var(--tw-backdrop-sepia, )"], ["backdrop-filter", "var(--tw-backdrop-blur, ) var(--tw-backdrop-brightness, ) var(--tw-backdrop-contrast, ) var(--tw-backdrop-grayscale, ) var(--tw-backdrop-hue-rotate, ) var(--tw-backdrop-invert, ) var(--tw-backdrop-opacity, ) var(--tw-backdrop-saturate, ) var(--tw-backdrop-sepia, )"]]], [".backdrop-saturate-150", null, 4, [["--tw-backdrop-saturate", "saturate(150%)"], ["-webkit-backdrop-filter", "var(--tw-backdrop-blur, ) var(--tw-backdrop-brightness, ) var(--tw-backdrop-contrast, ) var(--tw-backdrop-grayscale, ) var(--tw-backdrop-hue-rotate, ) var(--tw-backdrop-invert, ) var(--tw-backdrop-opacity, ) var(--tw-backdrop-saturate, ) var(--tw-backdrop-sepia, )"], ["backdrop-filter", "var(--tw-backdrop-blur, ) var(--tw-backdrop-brightness, ) var(--tw-backdrop-contrast, ) var(--tw-backdrop-grayscale, ) var(--tw-backdrop-hue-rotate, ) var(--tw-backdrop-invert, ) var(--tw-backdrop-opacity, ) var(--tw-backdrop-saturate, ) var(--tw-backdrop-sepia, )"]]], [".transition", null, 4, [["transition-property", "color, background-color, border-color, outline-color, text-decoration-color, fill, stroke, --tw-gradient-from, --tw-gradient-via, --tw-gradient-to, opacity, box-shadow, transform, translate, scale, rotate, filter, -webkit-backdrop-filter, backdrop-filter, display, content-visibility, overlay, pointer-events"], ["transition-timing-function", "var(--tw-ease, var(--default-transition-timing-function))"], ["transition-duration", "var(--tw-duration, var(--default-transition-duration))"]]], [".transition-\\[left\\,top\\,width\\,height\\]", null, 4, [["transition-property", "left, top, width, height"], ["transition-timing-function", "var(--tw-ease, var(--default-transition-timing-function))"], ["transition-duration", "var(--tw-duration, var(--default-transition-duration))"]]], [".transition-opacity", null, 4, [["transition-property", "opacity"], ["transition-timing-function", "var(--tw-ease, var(--default-transition-timing-function))"], ["transition-duration", "var(--tw-duration, var(--default-transition-duration))"]]], [".duration-150", null, 4, [["--tw-duration", ".15s"], ["transition-duration", ".15s"]]], [".ease-out", null, 4, [["--tw-ease", "var(--ease-out)"], ["transition-timing-function", "var(--ease-out)"]]], [".outline-none", null, 4, [["--tw-outline-style", "none"], ["outline-style", "none"]]], [".outline-solid", null, 4, [["--tw-outline-style", "solid"], ["outline-style", "solid"]]], [".select-none", null, 4, [["-webkit-user-select", "none"], ["user-select", "none"]]], [".select-text", null, 4, [["-webkit-user-select", "text"], ["user-select", "text"]]], [".\\[--panel-bg\\:var\\(--surface-dim\\)\\]", null, 4, [["--panel-bg", "var(--surface-dim)"]]], [".\\[--picker-bg\\:var\\(--surface-0\\)\\]", null, 4, [["--picker-bg", "var(--surface-0)"]]], [".\\[--radius\\:var\\(--radius-pane\\)\\]", null, 4, [["--radius", "var(--radius-pane)"]]], [".\\[--workspace-tools-bg\\:transparent\\]", null, 4, [["--workspace-tools-bg", "transparent"]]], [".\\[-webkit-box-orient\\:vertical\\]", null, 4, [["-webkit-box-orient", "vertical"]]], [".\\[-webkit-line-clamp\\:3\\]", null, 4, [["-webkit-line-clamp", "3"]]], [".\\[-webkit-touch-callout\\:none\\]", null, 4, [["-webkit-touch-callout", "none"]]], [".\\[background\\:none\\]", null, 4, [["background", "none"]]], [".\\[border-right\\:1px_solid_var\\(--git-border\\)\\]", null, 4, [["border-right", "1px solid var(--git-border)"]]], [".\\[border-top\\:1px_solid_var\\(--git-border\\)\\]", null, 4, [["border-top", "1px solid var(--git-border)"]]], [".\\[border\\:0\\]", null, 4, [["border", "0"]]], [".\\[border\\:none\\]", null, 4, [["border", "none"]]], [".\\[font\\:1\\.15rem\\/1_var\\(--font-mono\\)\\]", null, 4, [["font", "1.15rem/1 var(--font-mono)"]]], [".\\[font\\:1rem\\/1\\.2_var\\(--font-mono\\)\\]", null, 4, [["font", "1rem/1.2 var(--font-mono)"]]], [".\\[font\\:inherit\\]", null, 4, [["font", "inherit"]]], [".\\[transition\\:background_0\\.1s_ease\\]", null, 4, [["transition", "background .1s"]]], [".\\[transition\\:background_0\\.12s_ease\\]", null, 4, [["transition", "background .12s"]]], [".\\[transition\\:background_0\\.15s_ease\\]", null, 4, [["transition", "background .15s"]]], [".\\[transition\\:color_0\\.1s_ease\\,background_0\\.1s_ease\\]", null, 4, [["transition", "color .1s, background .1s"]]], [".\\[transition\\:color_0\\.12s_ease\\,background_0\\.12s_ease\\]", null, 4, [["transition", "color .12s, background .12s"]]], [".\\[transition\\:color_0\\.15s_ease\\]", null, 4, [["transition", "color .15s"]]], [".\\[transition\\:opacity_0\\.12s_ease\\]", null, 4, [["transition", "opacity .12s"]]], [".\\[transition\\:transform_0\\.15s_ease\\,background_0\\.15s_ease\\]", null, 4, [["transition", "transform .15s, background .15s"]]], [".not-has-\\[\\[data-setting-row\\]\\]\\:hidden:not(:has([data-setting-row]))", null, 4, [["display", "none"]]], [".group-focus-within\\:flex:is(:where(.group):focus-within *)", null, 4, [["display", "flex"]]], [".group-focus-within\\/row\\:opacity-100:is(:where(.group\\/row):focus-within *)", null, 4, [["opacity", "1"]]], [".group-hover\\:flex:is(:where(.group):hover *)", null, 4, [["display", "flex"]]], [".group-hover\\:opacity-100:is(:where(.group):hover *)", null, 4, [["opacity", "1"]]], [".group-hover\\/line\\:opacity-90:is(:where(.group\\/line):hover *)", null, 4, [["opacity", ".9"]]], [".group-hover\\/ph\\:opacity-100:is(:where(.group\\/ph):hover *), .group-hover\\/row\\:opacity-100:is(:where(.group\\/row):hover *)", null, 4, [["opacity", "1"]]], [".group-focus\\/tree\\:ring-1:is(:where(.group\\/tree):focus *)", null, 4, [["--tw-ring-shadow", "var(--tw-ring-inset, ) 0 0 0 calc(1px + var(--tw-ring-offset-width)) var(--tw-ring-color, currentcolor)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".group-focus\\/tree\\:ring-overlay-1:is(:where(.group\\/tree):focus *)", null, 4, [["--tw-ring-color", "var(--overlay-1)"]]], [".group-focus\\/tree\\:ring-inset:is(:where(.group\\/tree):focus *)", null, 4, [["--tw-ring-inset", "inset"]]], ['.group-aria-checked\\:\\[transform\\:translateX\\(1\\.1rem\\)\\]:is(:where(.group)[aria-checked="true"] *)', null, 4, [["transform", "translateX(1.1rem)"]]], ['.group-aria-checked\\:border-accent:is(:where(.group)[aria-checked="true"] *)', null, 4, [["border-color", "var(--accent)"]]], ['.group-aria-checked\\:bg-accent:is(:where(.group)[aria-checked="true"] *)', null, 4, [["background-color", "var(--accent)"]]], ['.group-aria-checked\\:bg-panel-bg:is(:where(.group)[aria-checked="true"] *)', null, 4, [["background-color", "var(--panel-bg)"]]], ['.group-aria-checked\\:text-accent:is(:where(.group)[aria-checked="true"] *), .group-aria-\\[checked\\=false\\]\\:text-accent:is(:where(.group)[aria-checked="false"] *)', null, 4, [["color", "var(--accent)"]]], [".placeholder\\:text-subtext-0::placeholder", null, 4, [["color", "var(--subtext-0)"]]], [".before\\:absolute:before", null, 4, [["content", "var(--tw-content)"], ["position", "absolute"]]], [".before\\:top-\\[0\\.15rem\\]:before", null, 4, [["content", "var(--tw-content)"], ["top", ".15rem"]]], [".before\\:left-\\[0\\.15rem\\]:before", null, 4, [["content", "var(--tw-content)"], ["left", ".15rem"]]], [".before\\:h-\\[0\\.95rem\\]:before", null, 4, [["content", "var(--tw-content)"], ["height", ".95rem"]]], [".before\\:w-\\[0\\.95rem\\]:before", null, 4, [["content", "var(--tw-content)"], ["width", ".95rem"]]], [".before\\:rounded-full:before", null, 4, [["content", "var(--tw-content)"], ["border-radius", "3.40282e38px"]]], [".before\\:bg-fg:before", null, 4, [["content", "var(--tw-content)"], ["background-color", "var(--text)"]]], [".before\\:content-\\[\\'\\'\\]:before", null, 4, [["--tw-content", '""'], ["content", "var(--tw-content)"]]], [".before\\:\\[transition\\:transform_0\\.12s_ease\\]:before", null, 4, [["content", "var(--tw-content)"], ["transition", "transform .12s"]]], [".after\\:absolute:after", null, 4, [["content", "var(--tw-content)"], ["position", "absolute"]]], [".after\\:inset-0:after", null, 4, [["content", "var(--tw-content)"], ["inset", "0"]]], [".after\\:inset-x-0:after", null, 4, [["content", "var(--tw-content)"], ["inset-inline", "0"]]], [".after\\:-inset-y-2:after", null, 4, [["content", "var(--tw-content)"], ["inset-block", "calc(var(--spacing) * -2)"]]], [".after\\:m-auto:after", null, 4, [["content", "var(--tw-content)"], ["margin", "auto"]]], [".after\\:h-8:after", null, 4, [["content", "var(--tw-content)"], ["height", "calc(var(--spacing) * 8)"]]], [".after\\:h-12:after", null, 4, [["content", "var(--tw-content)"], ["height", "calc(var(--spacing) * 12)"]]], [".after\\:h-\\[3px\\]:after", null, 4, [["content", "var(--tw-content)"], ["height", "3px"]]], [".after\\:w-8:after", null, 4, [["content", "var(--tw-content)"], ["width", "calc(var(--spacing) * 8)"]]], [".after\\:w-\\[3px\\]:after", null, 4, [["content", "var(--tw-content)"], ["width", "3px"]]], [".after\\:rounded-full:after", null, 4, [["content", "var(--tw-content)"], ["border-radius", "3.40282e38px"]]], [".after\\:bg-transparent:after", null, 4, [["content", "var(--tw-content)"], ["background-color", "#0000"]]], [".after\\:content-\\[\\'\\'\\]:after", null, 4, [["--tw-content", '""'], ["content", "var(--tw-content)"]]], [".last\\:border-b-0:last-child", null, 4, [["border-bottom-style", "var(--tw-border-style)"], ["border-bottom-width", "0"]]], [".checked\\:bg-accent:checked", null, 4, [["background-color", "var(--accent)"]]], [".checked\\:before\\:translate-x-\\[1rem\\]:checked:before", null, 4, [["content", "var(--tw-content)"], ["--tw-translate-x", "1rem"], ["translate", "var(--tw-translate-x) var(--tw-translate-y)"]]], [".checked\\:before\\:bg-panel-bg:checked:before", null, 4, [["content", "var(--tw-content)"], ["background-color", "var(--panel-bg)"]]], [".focus-within\\:bg-surface-1:focus-within", null, 4, [["background-color", "var(--surface-1)"]]], [".focus-within\\:outline:focus-within, .focus-within\\:outline-1:focus-within", null, 4, [["outline-style", "var(--tw-outline-style)"], ["outline-width", "1px"]]], [".focus-within\\:outline-fg:focus-within", null, 4, [["outline-color", "var(--text)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_12\\%\\,transparent\\)\\]:hover", null, 4, [["background-color", "var(--accent)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_12\\%\\,transparent\\)\\]:hover", null, 4, [["background-color", "color-mix(in srgb,var(--accent) 12%,transparent)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_15\\%\\,transparent\\)\\]:hover", null, 4, [["background-color", "var(--accent)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_15\\%\\,transparent\\)\\]:hover", null, 4, [["background-color", "color-mix(in srgb,var(--accent) 15%,transparent)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--text\\)_10\\%\\,var\\(--panel-bg\\)\\)\\]:hover", null, 4, [["background-color", "var(--text)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--text\\)_10\\%\\,var\\(--panel-bg\\)\\)\\]:hover", null, 4, [["background-color", "color-mix(in srgb,var(--text) 10%,var(--panel-bg))"]]], [".hover\\:bg-\\[var\\(--surface-0\\)\\]:hover", null, 4, [["background-color", "var(--surface-0)"]]], [".hover\\:bg-accent:hover", null, 4, [["background-color", "var(--accent)"]]], [".hover\\:bg-overlay-0:hover", null, 4, [["background-color", "var(--overlay-0)"]]], [".hover\\:bg-panel-bg:hover", null, 4, [["background-color", "var(--panel-bg)"]]], [".hover\\:bg-surface-0:hover", null, 4, [["background-color", "var(--surface-0)"]]], [".hover\\:bg-surface-1:hover", null, 4, [["background-color", "var(--surface-1)"]]], [".hover\\:bg-transparent:hover", null, 4, [["background-color", "#0000"]]], [".hover\\:text-accent:hover", null, 4, [["color", "var(--accent)"]]], [".hover\\:text-fg:hover", null, 4, [["color", "var(--text)"]]], [".hover\\:text-inherit:hover", null, 4, [["color", "inherit"]]], [".hover\\:text-overlay-0:hover", null, 4, [["color", "var(--overlay-0)"]]], [".hover\\:text-panel-bg:hover", null, 4, [["color", "var(--panel-bg)"]]], [".hover\\:text-red:hover", null, 4, [["color", "var(--red)"]]], [".hover\\:text-subtext-0:hover", null, 4, [["color", "var(--subtext-0)"]]], [".hover\\:text-yellow:hover", null, 4, [["color", "var(--yellow)"]]], [".hover\\:underline:hover", null, 4, [["text-decoration-line", "underline"]]], [".hover\\:opacity-60:hover", null, 4, [["opacity", ".6"]]], [".hover\\:opacity-100\\!:hover", null, 4, [["opacity", "1", 1]]], [".hover\\:opacity-\\[0\\.85\\]:hover", null, 4, [["opacity", ".85"]]], [".hover\\:brightness-110:hover", null, 4, [["--tw-brightness", "brightness(110%)"], ["filter", "var(--tw-blur, ) var(--tw-brightness, ) var(--tw-contrast, ) var(--tw-grayscale, ) var(--tw-hue-rotate, ) var(--tw-invert, ) var(--tw-saturate, ) var(--tw-sepia, ) var(--tw-drop-shadow, )"]]], [".hover\\:\\[filter\\:brightness\\(1\\.08\\)\\]:hover", null, 4, [["filter", "brightness(1.08)"]]], [".hover\\:after\\:bg-overlay-1:hover:after", null, 4, [["content", "var(--tw-content)"], ["background-color", "var(--overlay-1)"]]], [".focus\\:\\[outline\\:1px_solid_var\\(--accent\\)\\]:focus", null, 4, [["outline", "1px solid var(--accent)"]]], [".focus\\:outline-2:focus", null, 4, [["outline-style", "var(--tw-outline-style)"], ["outline-width", "2px"]]], [".focus\\:outline-none:focus", null, 4, [["--tw-outline-style", "none"], ["outline-style", "none"]]], [".focus-visible\\:bg-accent:focus-visible", null, 4, [["background-color", "var(--accent)"]]], [".focus-visible\\:bg-surface-0:focus-visible", null, 4, [["background-color", "var(--surface-0)"]]], [".focus-visible\\:bg-surface-1:focus-visible", null, 4, [["background-color", "var(--surface-1)"]]], [".focus-visible\\:text-accent:focus-visible", null, 4, [["color", "var(--accent)"]]], [".focus-visible\\:text-fg:focus-visible", null, 4, [["color", "var(--text)"]]], [".focus-visible\\:text-panel-bg:focus-visible", null, 4, [["color", "var(--panel-bg)"]]], [".focus-visible\\:text-red:focus-visible", null, 4, [["color", "var(--red)"]]], [".focus-visible\\:text-yellow:focus-visible", null, 4, [["color", "var(--yellow)"]]], [".focus-visible\\:underline:focus-visible", null, 4, [["text-decoration-line", "underline"]]], [".focus-visible\\:opacity-100:focus-visible", null, 4, [["opacity", "1"]]], [".focus-visible\\:\\[outline\\:1px_solid_var\\(--accent\\)\\]:focus-visible", null, 4, [["outline", "1px solid var(--accent)"]]], [".focus-visible\\:\\[outline\\:1px_solid_var\\(--overlay-1\\)\\]:focus-visible", null, 4, [["outline", "1px solid var(--overlay-1)"]]], [".focus-visible\\:\\[outline\\:2px_solid_var\\(--accent\\)\\]:focus-visible", null, 4, [["outline", "2px solid var(--accent)"]]], [".focus-visible\\:outline:focus-visible, .focus-visible\\:outline-1:focus-visible", null, 4, [["outline-style", "var(--tw-outline-style)"], ["outline-width", "1px"]]], [".focus-visible\\:\\[outline-offset\\:-1px\\]:focus-visible", null, 4, [["outline-offset", "-1px"]]], [".focus-visible\\:\\[outline-offset\\:-2px\\]:focus-visible", null, 4, [["outline-offset", "-2px"]]], [".focus-visible\\:\\[outline-offset\\:2px\\]:focus-visible", null, 4, [["outline-offset", "2px"]]], [".focus-visible\\:outline-offset-1:focus-visible", null, 4, [["outline-offset", "1px"]]], [".focus-visible\\:outline-fg:focus-visible", null, 4, [["outline-color", "var(--text)"]]], [".focus-visible\\:after\\:bg-accent:focus-visible:after", null, 4, [["content", "var(--tw-content)"], ["background-color", "var(--accent)"]]], [".active\\:cursor-grabbing:active", null, 4, [["cursor", "grabbing"]]], [".active\\:bg-surface-1:active", null, 4, [["background-color", "var(--surface-1)"]]], [".active\\:text-fg:active", null, 4, [["color", "var(--text)"]]], [".active\\:after\\:bg-accent:active:after", null, 4, [["content", "var(--tw-content)"], ["background-color", "var(--accent)"]]], [".enabled\\:hover\\:bg-surface-1:enabled:hover", null, 4, [["background-color", "var(--surface-1)"]]], [".enabled\\:hover\\:text-fg:enabled:hover", null, 4, [["color", "var(--text)"]]], [".disabled\\:cursor-default:disabled", null, 4, [["cursor", "default"]]], [".disabled\\:cursor-not-allowed:disabled", null, 4, [["cursor", "not-allowed"]]], [".disabled\\:cursor-not-allowed\\!:disabled", null, 4, [["cursor", "not-allowed", 1]]], [".disabled\\:cursor-wait:disabled", null, 4, [["cursor", "wait"]]], [".disabled\\:bg-transparent:disabled", null, 4, [["background-color", "#0000"]]], [".disabled\\:text-fg:disabled", null, 4, [["color", "var(--text)"]]], [".disabled\\:opacity-40:disabled", null, 4, [["opacity", ".4"]]], [".disabled\\:opacity-50:disabled", null, 4, [["opacity", ".5"]]], [".disabled\\:opacity-\\[0\\.45\\]:disabled", null, 4, [["opacity", ".45"]]], [".disabled\\:opacity-\\[0\\.55\\]:disabled", null, 4, [["opacity", ".55"]]], [":where(.app--mac-desktop) .in-\\[\\.app--mac-desktop\\]\\:pl-\\[84px\\]", null, 4, [["padding-left", "84px"]]], [".has-\\[\\:checked\\]\\:bg-surface-0:has(:checked)", null, 4, [["background-color", "var(--surface-0)"]]], [".has-\\[\\:checked\\]\\:text-fg:has(:checked)", null, 4, [["color", "var(--text)"]]], [".has-\\[\\:focus-visible\\]\\:bg-surface-0:has(:focus-visible)", null, 4, [["background-color", "var(--surface-0)"]]], ['.aria-disabled\\:cursor-not-allowed[aria-disabled="true"]', null, 4, [["cursor", "not-allowed"]]], ['.aria-disabled\\:opacity-40[aria-disabled="true"]', null, 4, [["opacity", ".4"]]], ['.aria-expanded\\:opacity-100[aria-expanded="true"]', null, 4, [["opacity", "1"]]], ['.aria-pressed\\:bg-surface-0[aria-pressed="true"]', null, 4, [["background-color", "var(--surface-0)"]]], ['.aria-pressed\\:text-fg[aria-pressed="true"]', null, 4, [["color", "var(--text)"]]], [".motion-reduce\\:animate-none", ["(prefers-reduced-motion: reduce)"], 4, [["animation", "none"]]], [".max-\\[900px\\]\\:hidden", ["not all and (min-width: 900px)"], 4, [["display", "none"]]], [".max-\\[700px\\]\\:hidden", ["not all and (min-width: 700px)"], 4, [["display", "none"]]], [".max-\\[700px\\]\\:size-11", ["not all and (min-width: 700px)"], 4, [["width", "calc(var(--spacing) * 11)"], ["height", "calc(var(--spacing) * 11)"]]], [".max-\\[700px\\]\\:h-9", ["not all and (min-width: 700px)"], 4, [["height", "calc(var(--spacing) * 9)"]]], [".max-\\[700px\\]\\:h-12", ["not all and (min-width: 700px)"], 4, [["height", "calc(var(--spacing) * 12)"]]], [".max-\\[700px\\]\\:min-h-9", ["not all and (min-width: 700px)"], 4, [["min-height", "calc(var(--spacing) * 9)"]]], [".max-\\[700px\\]\\:min-h-11", ["not all and (min-width: 700px)"], 4, [["min-height", "calc(var(--spacing) * 11)"]]], [".max-\\[700px\\]\\:w-24", ["not all and (min-width: 700px)"], 4, [["width", "calc(var(--spacing) * 24)"]]], [".max-\\[700px\\]\\:min-w-11", ["not all and (min-width: 700px)"], 4, [["min-width", "calc(var(--spacing) * 11)"]]], [".max-\\[700px\\]\\:flex-1", ["not all and (min-width: 700px)"], 4, [["flex", "1"]]], [".max-\\[700px\\]\\:flex-\\[1_1_6rem\\]", ["not all and (min-width: 700px)"], 4, [["flex", "6rem"]]], [".max-\\[700px\\]\\:flex-\\[1_1_100\\%\\]", ["not all and (min-width: 700px)"], 4, [["flex", "100%"]]], [".max-\\[700px\\]\\:basis-56", ["not all and (min-width: 700px)"], 4, [["flex-basis", "calc(var(--spacing) * 56)"]]], [".max-\\[700px\\]\\:basis-full", ["not all and (min-width: 700px)"], 4, [["flex-basis", "100%"]]], [".max-\\[700px\\]\\:flex-wrap", ["not all and (min-width: 700px)"], 4, [["flex-wrap", "wrap"]]], [".max-\\[700px\\]\\:gap-y-2", ["not all and (min-width: 700px)"], 4, [["row-gap", "calc(var(--spacing) * 2)"]]], [".min-\\[701px\\]\\:left-auto", ["(min-width: 701px)"], 4, [["left", "auto"]]], [".min-\\[701px\\]\\:my-\\[3px\\]", ["(min-width: 701px)"], 4, [["margin-block", "3px"]]], [".min-\\[701px\\]\\:block", ["(min-width: 701px)"], 4, [["display", "block"]]], [".min-\\[701px\\]\\:hidden", ["(min-width: 701px)"], 4, [["display", "none"]]], [".min-\\[701px\\]\\:min-h-6", ["(min-width: 701px)"], 4, [["min-height", "calc(var(--spacing) * 6)"]]], [".min-\\[701px\\]\\:w-80", ["(min-width: 701px)"], 4, [["width", "calc(var(--spacing) * 80)"]]], [".min-\\[701px\\]\\:rounded-ui", ["(min-width: 701px)"], 4, [["border-radius", "var(--radius)"]]], [".min-\\[701px\\]\\:px-3", ["(min-width: 701px)"], 4, [["padding-inline", "calc(var(--spacing) * 3)"]]], [".min-\\[701px\\]\\:px-4", ["(min-width: 701px)"], 4, [["padding-inline", "calc(var(--spacing) * 4)"]]], [".min-\\[701px\\]\\:pr-\\[3px\\]", ["(min-width: 701px)"], 4, [["padding-right", "3px"]]], [".min-\\[701px\\]\\:pl-4", ["(min-width: 701px)"], 4, [["padding-left", "calc(var(--spacing) * 4)"]]], [".min-\\[701px\\]\\:text-\\[0\\.62rem\\]", ["(min-width: 701px)"], 4, [["font-size", ".62rem"]]], [".min-\\[701px\\]\\:text-\\[12\\.5px\\]", ["(min-width: 701px)"], 4, [["font-size", "12.5px"]]], [".min-\\[701px\\]\\:text-\\[12px\\]", ["(min-width: 701px)"], 4, [["font-size", "12px"]]], [".min-\\[701px\\]\\:font-medium", ["(min-width: 701px)"], 4, [["--tw-font-weight", "var(--font-weight-medium)"], ["font-weight", "var(--font-weight-medium)"]]], [".min-\\[701px\\]\\:font-semibold", ["(min-width: 701px)"], 4, [["--tw-font-weight", "var(--font-weight-semibold)"], ["font-weight", "var(--font-weight-semibold)"]]], [".min-\\[701px\\]\\:tracking-\\[0\\.045em\\]", ["(min-width: 701px)"], 4, [["--tw-tracking", ".045em"], ["letter-spacing", ".045em"]]], [".min-\\[701px\\]\\:text-subtext-0", ["(min-width: 701px)"], 4, [["color", "var(--subtext-0)"]]], [".min-\\[701px\\]\\:uppercase", ["(min-width: 701px)"], 4, [["text-transform", "uppercase"]]], [".min-\\[900px\\]\\:inline", ["(min-width: 900px)"], 4, [["display", "inline"]]], [".pointer-coarse\\:opacity-100", ["(pointer: coarse)"], 4, [["opacity", "1"]]], [".\\[\\&_\\.mode-switch\\]\\:ml-0 .mode-switch", null, 4, [["margin-left", "0"]]], [".max-\\[700px\\]\\:\\[\\&_button\\]\\:min-h-11 button", ["not all and (min-width: 700px)"], 4, [["min-height", "calc(var(--spacing) * 11)"]]], [".\\[\\&_pre\\]\\:m-\\[0\\.2rem_0_0\\.3rem_1\\.2rem\\] pre", null, 4, [["margin", ".2rem 0 .3rem 1.2rem"]]], [".\\[\\&_pre\\]\\:max-h-72 pre", null, 4, [["max-height", "calc(var(--spacing) * 72)"]]], [".\\[\\&_pre\\]\\:overflow-auto pre", null, 4, [["overflow", "auto"]]], [".\\[\\&_pre\\]\\:rounded-ui pre", null, 4, [["border-radius", "var(--radius)"]]], [".\\[\\&_pre\\]\\:bg-surface-0 pre", null, 4, [["background-color", "var(--surface-0)"]]], [".\\[\\&_pre\\]\\:p-2 pre", null, 4, [["padding", "calc(var(--spacing) * 2)"]]], [".\\[\\&_pre\\]\\:text-\\[0\\.78rem\\] pre", null, 4, [["font-size", ".78rem"]]], [".\\[\\&_pre\\]\\:\\[overflow-wrap\\:anywhere\\] pre", null, 4, [["overflow-wrap", "anywhere"]]], [".\\[\\&_pre\\]\\:whitespace-pre-wrap pre", null, 4, [["white-space", "pre-wrap"]]], [".\\[\\&_pre\\]\\:text-fg pre, .\\[\\&_strong\\]\\:text-fg strong", null, 4, [["color", "var(--text)"]]], [".\\[\\&_summary\\]\\:cursor-pointer summary", null, 4, [["cursor", "pointer"]]], [".\\[\\&\\:hover\\:not\\(\\:disabled\\)\\]\\:bg-surface-1:hover:not(:disabled)", null, 4, [["background-color", "var(--surface-1)"]]], [".\\[\\&\\:hover\\:not\\(\\:disabled\\)\\]\\:text-accent:hover:not(:disabled)", null, 4, [["color", "var(--accent)"]]], [".\\[\\&\\:hover\\:not\\(\\:disabled\\)\\]\\:text-red:hover:not(:disabled)", null, 4, [["color", "var(--red)"]]], [".\\[\\&\\:not\\(\\:has\\(\\[data-setting-row\\]\\)\\)\\>\\[data-none\\]\\]\\:block:not(:has([data-setting-row])) > [data-none]", null, 4, [["display", "block"]]], [".\\[\\&\\>\\*\\]\\:min-h-0 > *", null, 4, [["min-height", "0"]]], [".\\[\\&\\>\\*\\]\\:min-w-0 > *", null, 4, [["min-width", "0"]]], [".\\[\\&\\>\\*\\]\\:flex-1 > *", null, 4, [["flex", "1"]]], [".\\[\\&\\>\\*\\]\\:shrink-0 > *", null, 4, [["flex-shrink", "0"]]], [".\\[\\&\\>li\\]\\:text-\\[0\\.85rem\\] > li", null, 4, [["font-size", ".85rem"]]], [".\\[\\&\\>li\\]\\:leading-\\[1\\.5\\] > li", null, 4, [["--tw-leading", "1.5"], ["line-height", "1.5"]]], [".\\[\\&\\>li\\]\\:text-fg > li", null, 4, [["color", "var(--text)"]]], [".\\[\\&\\>summary\\]\\:flex > summary", null, 4, [["display", "flex"]]], [".\\[\\&\\>summary\\]\\:cursor-pointer > summary", null, 4, [["cursor", "pointer"]]], [".\\[\\&\\>summary\\]\\:list-none > summary", null, 4, [["list-style-type", "none"]]], [".\\[\\&\\>summary\\]\\:items-center > summary", null, 4, [["align-items", "center"]]], [".\\[\\&\\>summary\\]\\:gap-\\[0\\.4rem\\] > summary", null, 4, [["gap", ".4rem"]]], [".\\[\\&\\>summary\\]\\:rounded-ui > summary", null, 4, [["border-radius", "var(--radius)"]]], [".\\[\\&\\>summary\\]\\:px-\\[0\\.4rem\\] > summary", null, 4, [["padding-inline", ".4rem"]]], [".\\[\\&\\>summary\\]\\:py-\\[0\\.25rem\\] > summary", null, 4, [["padding-block", ".25rem"]]], [".\\[\\&\\>summary\\]\\:select-none > summary", null, 4, [["-webkit-user-select", "none"], ["user-select", "none"]]], [".\\[\\&\\>summary\\]\\:before\\:inline-block > summary:before", null, 4, [["content", "var(--tw-content)"], ["display", "inline-block"]]], [".\\[\\&\\>summary\\]\\:before\\:size-\\[0\\.4rem\\] > summary:before", null, 4, [["content", "var(--tw-content)"], ["width", ".4rem"], ["height", ".4rem"]]], [".\\[\\&\\>summary\\]\\:before\\:shrink-0 > summary:before", null, 4, [["content", "var(--tw-content)"], ["flex-shrink", "0"]]], [".\\[\\&\\>summary\\]\\:before\\:\\[transform\\:rotate\\(-45deg\\)\\] > summary:before", null, 4, [["content", "var(--tw-content)"], ["transform", "rotate(-45deg)"]]], [".\\[\\&\\>summary\\]\\:before\\:content-\\[\\'\\'\\] > summary:before", null, 4, [["--tw-content", '""'], ["content", "var(--tw-content)"]]], [".\\[\\&\\>summary\\]\\:before\\:\\[border-bottom\\:1\\.3px_solid_currentColor\\] > summary:before", null, 4, [["content", "var(--tw-content)"], ["border-bottom", "1.3px solid"]]], [".\\[\\&\\>summary\\]\\:before\\:\\[border-right\\:1\\.3px_solid_currentColor\\] > summary:before", null, 4, [["content", "var(--tw-content)"], ["border-right", "1.3px solid"]]], [".\\[\\&\\>summary\\]\\:before\\:\\[transition\\:transform_0\\.15s_ease\\] > summary:before", null, 4, [["content", "var(--tw-content)"], ["transition", "transform .15s"]]], [".\\[\\&\\>summary\\:hover\\]\\:bg-surface-1 > summary:hover", null, 4, [["background-color", "var(--surface-1)"]]], [".\\[\\&\\>summary\\:hover\\]\\:text-fg > summary:hover", null, 4, [["color", "var(--text)"]]], [".\\[\\&\\[open\\]\\>summary\\]\\:before\\:\\[transform\\:rotate\\(45deg\\)\\][open] > summary:before", null, 4, [["content", "var(--tw-content)"], ["transform", "rotate(45deg)"]]], [".app--mobile .\\[\\.app--mobile_\\&\\]\\:min-h-11", null, 4, [["min-height", "calc(var(--spacing) * 11)"]]], [".app--mobile .\\[\\.app--mobile_\\&\\]\\:min-h-\\[44px\\]", null, 4, [["min-height", "44px"]]], [".\\[\\@media\\(hover\\:none\\)\\]\\:opacity-60", ["(hover: none)"], 4, [["opacity", ".6"]]], [".\\[\\@media\\(hover\\:none\\)\\]\\:opacity-100", ["(hover: none)"], 4, [["opacity", "1"]]], [".\\[\\@media\\(max-width\\:700px\\)\\]\\:h-\\[2\\.75rem\\]", ["(max-width: 700px)"], 4, [["height", "2.75rem"]]], [".\\[\\@media\\(max-width\\:700px\\)\\]\\:min-h-\\[2\\.75rem\\]", ["(max-width: 700px)"], 4, [["min-height", "2.75rem"]]], [".\\[\\@media\\(max-width\\:700px\\)\\]\\:w-\\[2\\.75rem\\]", ["(max-width: 700px)"], 4, [["width", "2.75rem"]]], [".\\[\\@media\\(max-width\\:700px\\)\\]\\:min-w-\\[2\\.75rem\\]", ["(max-width: 700px)"], 4, [["min-width", "2.75rem"]]], [".\\[\\@media\\(max-width\\:700px\\)\\]\\:px-\\[0\\.65rem\\]", ["(max-width: 700px)"], 4, [["padding-inline", ".65rem"]]], ["div:hover > .\\[div\\:hover\\>\\&\\]\\:opacity-100", null, 4, [["opacity", "1"]]], [":root", null, 1e3, [["color-scheme", "dark"], ["--scrollbar-size", "6px"], ["--accent", "#c8c8c8"], ["--panel-bg", "#161616"], ["--surface-0", "#262626"], ["--surface-1", "#333"], ["--surface-dim", "#1c1c1c"], ["--backdrop", "#050505"], ["--overlay-0", "#3a3a3a"], ["--overlay-1", "#9b9b9b"], ["--text", "#d8d8d8"], ["--subtext-0", "#9b9b9b"], ["--mauve", "#a993c9"], ["--green", "#7fb685"], ["--yellow", "#d3b46a"], ["--red", "#df8c8c"], ["--blue", "#7aa2d7"], ["--teal", "#7fb8b8"], ["--peach", "#d39a6a"], ["--bg", "var(--panel-bg)"], ["--surface", "var(--surface-0)"], ["--surface-alt", "var(--surface-1)"], ["--border", "var(--overlay-0)"], ["--muted", "var(--subtext-0)"], ["--danger", "var(--red)"], ["--radius", "8px"], ["--radius-pane", "8px"], ["accent-color", "var(--accent)"], ["--font-ui", '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif'], ["--font-mono", `ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono",
    monospace`], ["font-family", "var(--font-ui)"]]], ["code, pre, kbd, samp", null, 1e3, [["font-family", "var(--font-mono)"]]], ["*", null, 1e3, [["box-sizing", "border-box"]]], ["html, body, #root", null, 1e3, [["height", "100%"], ["margin", "0"]]], ["html", null, 1e3, [["overscroll-behavior", "none"], ["--shell-bg", "var(--panel-bg)"]]], ["html[data-glass]", null, 1e3, [["--shell-bg", "var(--panel-bg)"]]], ["html[data-glass]", null, 1e3, [["--shell-bg", "color-mix(in srgb, var(--panel-bg) 86%, transparent)"]]], ["html", null, 1e3, [["--backdrop-bg", "var(--backdrop)"], ["--card-bg", "var(--panel-bg)"]]], ["html[data-glass]", null, 1e3, [["--backdrop-bg", "var(--backdrop)"]]], ["html[data-glass]", null, 1e3, [["--backdrop-bg", "color-mix(in srgb, var(--backdrop) 86%, transparent)"]]], ["html[data-glass]", null, 1e3, [["--card-bg", "var(--panel-bg)"]]], ["html[data-glass]", null, 1e3, [["--card-bg", "color-mix(in srgb, var(--panel-bg) 86%, transparent)"]]], ['body:has(.app--cards, .app--mobile), .app--cards .dock-area:has([data-testid="split-canvas"]:not([data-split="0"]))', null, 1e3, [["background", "var(--backdrop-bg)"]]], ["body", null, 1e3, [["background", "var(--shell-bg)"], ["color", "var(--text)"], ["overscroll-behavior", "none"], ["-webkit-tap-highlight-color", "transparent"], ["line-height", "1.3"]]], [".app", null, 1e3, [["flex-direction", "column"], ["height", "100dvh"], ["display", "flex"]]], [".app--mobile", null, 1e3, [["inset", "var(--visible-top, 0px) 0 auto 0"], ["height", "var(--visible-height, 100dvh)"], ["position", "fixed"]]], [".mobile-drawer-backdrop", null, 1e3, [["animation", ".15s ease-out mobile-fade"]]], [".mobile-drawer--left", null, 1e3, [["animation", ".2s cubic-bezier(.2, .8, .2, 1) mobile-slide-left"]]], [".mobile-drawer--right", null, 1e3, [["animation", ".2s cubic-bezier(.2, .8, .2, 1) mobile-slide-right"]]], [".mobile-sheet", null, 1e3, [["animation", ".22s cubic-bezier(.2, .8, .2, 1) mobile-rise"]]], [".mobile-drawer-backdrop, .mobile-drawer, .mobile-sheet", ["(prefers-reduced-motion: reduce)"], 1e3, [["animation", "none"]]], [".layout-drawer", null, 1e3, [["transform", "translateX(var(--float-hide, 0))"], ["transition", "transform .18s"]]], [".layout-drawer:hover, .layout-drawer:focus-within", null, 1e3, [["--float-hide", "0px"]]], [".dockview-theme-perch", null, 1e3, [["--dv-color-abyss-dark", "var(--panel-bg)"], ["--dv-color-abyss", "var(--surface-0)"], ["--dv-color-abyss-light", "var(--surface-1)"], ["--dv-color-abyss-lighter", "var(--overlay-0)"], ["--dv-color-abyss-accent", "var(--accent)"], ["--dv-color-abyss-primary-text", "var(--text)"], ["--dv-color-abyss-secondary-text", "var(--subtext-0)"], ["--dv-group-view-background-color", "var(--panel-bg)"], ["--dv-tabs-and-actions-container-background-color", "var(--surface-0)"], ["--dv-activegroup-visiblepanel-tab-background-color", "var(--panel-bg)"], ["--dv-activegroup-hiddenpanel-tab-background-color", "var(--surface-0)"], ["--dv-inactivegroup-visiblepanel-tab-background-color", "var(--panel-bg)"], ["--dv-inactivegroup-hiddenpanel-tab-background-color", "var(--surface-0)"], ["--dv-tab-divider-color", "var(--overlay-0)"], ["--dv-activegroup-visiblepanel-tab-color", "var(--text)"], ["--dv-activegroup-hiddenpanel-tab-color", "var(--subtext-0)"], ["--dv-inactivegroup-visiblepanel-tab-color", "var(--subtext-0)"], ["--dv-inactivegroup-hiddenpanel-tab-color", "var(--subtext-0)"], ["--dv-separator-border", "var(--overlay-0)"], ["--dv-paneview-header-border-color", "var(--overlay-0)"], ["--dv-tabs-and-actions-container-font-size", ".82rem"], ["--dv-tabs-and-actions-container-height", "2.1rem"]]], [".dockview-theme-perch .dv-tabs-and-actions-container", null, 1e3, [["z-index", "1"], ["position", "relative"]]], [".pane-tab", null, 1e3, [["align-items", "center"], ["width", "100%"], ["height", "100%"], ["display", "flex"]]], [".pane-tab__agent-badge", null, 1e3, [["color", "var(--subtext-0)"], ["white-space", "nowrap"], ["flex-shrink", "0"], ["margin-right", ".4rem"], ["font-size", ".78em"]]], ['.pane-tab[data-testid="pane-tab-chat"] .dv-default-tab-action', null, 1e3, [["display", "none"]]], [".dockview-group-action", null, 1e3, [["border-radius", "var(--radius)"], ["width", "1.5rem"], ["height", "1.5rem"], ["color", "var(--subtext-0)"], ["cursor", "pointer"], ["background", "none"], ["border", "none"], ["justify-content", "center"], ["align-self", "center"], ["align-items", "center"], ["margin", "0 .15rem"], ["font-size", "1rem"], ["line-height", "1"], ["transition", "color .1s, background .1s"], ["display", "flex"]]], [".dockview-group-action:hover", null, 1e3, [["color", "var(--text)"], ["background", "var(--surface-1)"]]], [".dockview-theme-perch .dv-view-container > .dv-view:has(.dv-inactive-group)", ["(max-width: 700px)"], 1e3, [["display", "none"]]], [".dockview-theme-perch .dv-view-container > .dv-view:has(.dv-active-group)", ["(max-width: 700px)"], 1e3, [["width", "100%", 1], ["left", "0", 1]]], [".chat", null, 1e3, [["isolation", "isolate"], ["flex-direction", "column"], ["flex", "1"], ["height", "100%"], ["min-height", "0"], ["display", "flex"]]], [".message__markdown p", null, 1e3, [["margin", "0 0 .5em"]]], [".message__markdown p:last-child", null, 1e3, [["margin-bottom", "0"]]], [".message__markdown h1, .message__markdown h2, .message__markdown h3, .message__markdown h4", null, 1e3, [["margin", ".6em 0 .3em"], ["line-height", "1.25"]]], [".message__markdown h1", null, 1e3, [["font-size", "1.25em"]]], [".message__markdown h2", null, 1e3, [["font-size", "1.12em"]]], [".message__markdown h3", null, 1e3, [["font-size", "1em"]]], [".message__markdown > * + *", null, 1e3, [["margin-top", ".5em"]]], [".message__markdown table, .md-table", null, 1e3, [["border-collapse", "separate"], ["border-spacing", "0"], ["background", "var(--surface-0)"], ["border-radius", "var(--radius)"], ["max-width", "100%"], ["margin", ".5em 0"], ["font-size", ".92em"], ["display", "block"], ["overflow-x", "auto"]]], [".md-table", null, 1e3, [["width", "100%"], ["margin", "0"], ["display", "table"]]], [".message__markdown th, .message__markdown td, .md-table th, .md-table td", null, 1e3, [["text-align", "left"], ["vertical-align", "top"], ["border-bottom", "1px solid var(--surface-1)"], ["padding", ".35em .75em"]]], [".message__markdown th, .md-table th", null, 1e3, [["color", "var(--subtext-0)"], ["white-space", "nowrap"], ["background", "var(--surface-1)"], ["font-weight", "600"]]], [".message__markdown tbody tr:last-child td, .md-table tbody tr:last-child td", null, 1e3, [["border-bottom", "0"]]], [".message__markdown tbody tr:hover td, .md-table tbody tr:hover td", null, 1e3, [["background", "var(--surface-1)"]]], [".md-table caption", null, 1e3, [["text-align", "left"], ["color", "var(--subtext-0)"], ["padding", ".4em .75em"]]], [".md-code", null, 1e3, [["background", "var(--surface-0)"], ["border-radius", "var(--radius)"], ["overflow", "hidden"]]], [".md-code__bar", null, 1e3, [["color", "var(--subtext-0)"], ["background", "var(--surface-1)"], ["justify-content", "space-between"], ["align-items", "center"], ["padding", ".1rem .4rem .1rem .75rem"], ["font-size", ".75em"], ["display", "flex"]]], [".message__markdown .md-code pre", null, 1e3, [["background", "none"], ["border-radius", "0"], ["margin", "0"]]], [".hl-keyword", null, 1e3, [["color", "var(--mauve)"]]], [".hl-string", null, 1e3, [["color", "var(--green)"]]], [".hl-number", null, 1e3, [["color", "var(--peach)"]]], [".hl-function", null, 1e3, [["color", "var(--blue)"]]], [".hl-type", null, 1e3, [["color", "var(--yellow)"]]], [".hl-tag", null, 1e3, [["color", "var(--teal)"]]], [".hl-comment", null, 1e3, [["color", "var(--overlay-1)"], ["font-style", "italic"]]], [".message__markdown ul, .message__markdown ol", null, 1e3, [["margin", ".3em 0 .5em 1.3em"], ["padding", "0"]]], [".message__markdown li", null, 1e3, [["margin-bottom", ".2em"]]], [".message__markdown code", null, 1e3, [["background", "var(--surface-0)"], ["border-radius", ".25rem"], ["padding", ".1em .35em"], ["font-family", "ui-monospace, SFMono-Regular, SF Mono, Menlo, Consolas, monospace"], ["font-size", ".88em"]]], [".message__markdown pre", null, 1e3, [["background", "var(--surface-0)"], ["border-radius", "var(--radius)"], ["margin", ".4em 0"], ["padding", ".6rem .75rem"], ["position", "relative"], ["overflow-x", "auto"]]], [".message__markdown pre code", null, 1e3, [["background", "none"], ["border", "none"], ["padding", "0"], ["font-size", ".85em"]]], [".message__markdown a", null, 1e3, [["color", "var(--accent)"], ["text-decoration", "underline"]]], [".message__markdown blockquote", null, 1e3, [["border-left", "3px solid var(--overlay-0)"], ["color", "var(--subtext-0)"], ["margin", ".4em 0"], ["padding", ".1em .6em"]]], [".message__markdown hr", null, 1e3, [["border", "none"], ["border-top", "1px solid var(--overlay-0)"], ["margin", ".75em 0"]]], [".file-markdown", null, 1e3, [["overflow-wrap", "anywhere"]]], [".file-markdown img", null, 1e3, [["max-width", "100%"]]], [".file-markdown table", null, 1e3, [["border-collapse", "collapse"], ["margin", ".4em 0"], ["display", "block"], ["overflow-x", "auto"]]], [".file-markdown th, .file-markdown td", null, 1e3, [["border", "1px solid var(--overlay-0)"], ["padding", ".2em .5em"]]], [".file-markdown .md-placeholder", null, 1e3, [["color", "var(--subtext-0)"], ["border", "1px dashed var(--overlay-0)"], ["border-radius", ".25rem"], ["padding", ".05em .35em"], ["font-size", ".9em"]]], [".terminal", null, 1e3, [["min-width", "0"], ["min-height", "0"], ["padding", "var(--terminal-padding, 0)"], ["opacity", "var(--terminal-opacity, 1)"], ["flex", "1"], ["display", "flex"], ["position", "relative"]]], [".terminal__surface", null, 1e3, [["flex", "1"], ["min-width", "0"], ["min-height", "0"], ["overflow", "hidden"]]], [".terminal__surface .xterm", null, 1e3, [["height", "100%"]]], [".terminal__surface .xterm:not(.allow-transparency) .xterm-viewport", null, 1e3, [["background-color", "#0000"]]], [".terminal__surface .xterm-scrollable-element", null, 1e3, [["position", "static", 1]]], [".terminal__surface .xterm-decoration-overview-ruler, .no-pane-scrollbars .terminal__surface .xterm-scrollable-element > .xterm-scrollbar", null, 1e3, [["display", "none"]]], [".terminal--persistent", null, 1e3, [["flex-direction", "column"]]], [".terminal__toolbar", null, 1e3, [["color", "var(--subtext-0)"], ["align-items", "center"], ["gap", ".5rem"], ["padding", ".25rem 1.5rem .25rem .5rem"], ["font-size", ".8rem"], ["display", "flex"]]], [".terminal__toolbar button", null, 1e3, [["border-radius", "var(--radius)"], ["min-height", "32px"], ["color", "var(--text)"], ["background", "var(--surface-0)"], ["border", "0"], ["padding", ".25rem .5rem"]]], [".terminal__toolbar--overlay", null, 1e3, [["z-index", "2"], ["border-radius", "var(--radius)"], ["background", "var(--surface-1)"], ["padding", ".2rem .3rem .2rem .6rem"], ["position", "absolute"], ["top", ".4rem"], ["right", ".9rem"], ["box-shadow", "0 2px 8px #00000040"]]], [".terminal__connection", null, 1e3, [["margin-right", "auto"]]], [".terminal__toolbar button:disabled", null, 1e3, [["opacity", ".5"]]], [".terminal__notice", null, 1e3, [["color", "var(--subtext-0)"], ["padding", ".75rem"], ["font-size", ".85rem"]]], [".app--mobile .terminal__toolbar button", null, 1e3, [["min-height", "44px"]]], [".app--mobile .terminal__connection", null, 1e3, [["display", "none"]]], [".app--mobile .terminal__toolbar", null, 1e3, [["padding-right", ".5rem"]]], [".terminal__exited", null, 1e3, [["background", "var(--surface-1)"], ["border-radius", "var(--radius)"], ["color", "var(--subtext-0)"], ["padding", ".35rem .75rem"], ["font-size", ".85rem"], ["position", "absolute"], ["bottom", ".75rem"], ["left", "50%"], ["transform", "translateX(-50%)"]]], [".terminal__exited--cli", null, 1e3, [["background", "var(--panel-bg)"], ["flex-direction", "column"], ["align-items", "center"], ["gap", ".6rem"], ["padding", ".9rem 1.1rem"], ["display", "flex"], ["top", "50%"], ["bottom", "auto"], ["transform", "translate(-50%, -50%)"], ["box-shadow", "0 6px 24px #00000059"]]], [".terminal__exited-actions", null, 1e3, [["gap", ".5rem"], ["display", "flex"]]], [".terminal__cli-error", null, 1e3, [["background", "var(--red)"], ["position", "absolute"], ["bottom", ".75rem"], ["left", "50%"], ["transform", "translateX(-50%)"]]], [".terminal__cli-error", null, 1e3, [["background", "color-mix(in srgb, var(--red) 20%, var(--panel-bg))"]]], [".terminal__cli-error", null, 1e3, [["border-radius", "var(--radius)"], ["color", "var(--red)"], ["text-align", "center"], ["white-space", "pre-wrap"], ["word-break", "break-word"], ["max-width", "90%"], ["padding", ".35rem .75rem"], ["font-size", ".85rem"]]], [".mobile-pane-shell__content > .chat, .mobile-pane-shell__content > .terminal, .mobile-pane-shell__content > .workspace-files, .mobile-pane-shell__content > .workspace-git", null, 1e3, [["flex", "1"], ["width", "100%"], ["min-width", "0"], ["height", "100%"], ["min-height", "0"]]], [".terminal__host", null, 1e3, [["width", "100%"], ["height", "100%"], ["overflow", "hidden"]]], [".workspace-git", null, 1e3, [["--git-border", "var(--overlay-0)"]]], [".workspace-git", null, 1e3, [["--git-border", "color-mix(in srgb, var(--overlay-0) 72%, transparent)"]]], [".workspace-git", null, 1e3, [["--git-muted", "var(--subtext-0)"], ["width", "100%"], ["min-width", "0"], ["height", "100%"], ["min-height", "0"], ["color", "var(--text)"], ["background", "var(--workspace-tools-bg, var(--panel-bg))"], ["flex-direction", "column"], ["font-size", ".78rem"], ["display", "flex"], ["position", "relative"], ["overflow", "hidden"], ["container-type", "inline-size"]]], [".workspace-git button, .workspace-git input, .workspace-git textarea", null, 1e3, [["font", "inherit"]]], [".workspace-git button", null, 1e3, [["cursor", "pointer"]]], ['.workspace-git button:focus-visible, .workspace-git input:focus-visible, .workspace-git textarea:focus-visible, .workspace-git [role="button"]:focus-visible', null, 1e3, [["outline", "2px solid var(--accent)"], ["outline-offset", "1px"]]], [".workspace-git__diff", null, 1e3, [["container-type", "inline-size"]]], [".workspace-git__line-comment-thread", null, 1e3, [["max-width", "max(0px, min(42rem, 100cqi - 6.9rem))"], ["position", "sticky"], ["left", "0"]]], [".workspace-git__comment-composer", null, 1e3, [["max-width", "max(0px, 100cqi - 1.4rem)"], ["position", "sticky"], ["left", "0"]]], [".dockview-group-action--split-session", null, 1e3, [["font-size", "13px"]]], [".session-split-popover", null, 1e3, [["display", "flex"], ["flex-direction", "column"], ["background", "var(--surface-1)"], ["border-radius", "var(--radius)"], ["box-shadow", "0 8px 24px rgba(0, 0, 0, 0.45)"], ["padding", "4px"], ["font-size", "12.5px"], ["color", "var(--text)"], ["overflow", "hidden"]]], [".session-split-popover__header", null, 1e3, [["padding", "6px 8px 4px"], ["font-size", "11px"], ["text-transform", "uppercase"], ["letter-spacing", "0.04em"], ["color", "var(--subtext-0)"]]], [".session-split-popover__empty", null, 1e3, [["padding", "8px"], ["color", "var(--subtext-0)"]]], [".session-split-popover__list", null, 1e3, [["overflow-y", "auto"]]], [".session-split-popover__item", null, 1e3, [["display", "flex"], ["flex-direction", "column"], ["align-items", "flex-start"], ["gap", "1px"], ["width", "100%"], ["padding", "6px 8px"], ["border", "none"], ["border-radius", "4px"], ["background", "transparent"], ["color", "inherit"], ["text-align", "left"], ["cursor", "grab"]]], [".session-split-popover__item:hover", null, 1e3, [["background", "var(--surface-0)"]]], [".session-split-popover__item-title", null, 1e3, [["font-weight", "500"], ["white-space", "nowrap"], ["overflow", "hidden"], ["text-overflow", "ellipsis"], ["max-width", "100%"]]], [".session-split-popover__item-cwd", null, 1e3, [["font-size", "11px"], ["color", "var(--subtext-0)"], ["white-space", "nowrap"], ["overflow", "hidden"], ["text-overflow", "ellipsis"], ["max-width", "100%"]]], [".session-split-popover__item-badge", null, 1e3, [["align-self", "flex-end"], ["font-size", "10px"], ["color", "var(--accent)"], ["margin-top", "-14px"]]], [".inactive-session-pane", null, 1e3, [["display", "flex"], ["flex-direction", "column"], ["align-items", "center"], ["justify-content", "center"], ["gap", "10px"], ["height", "100%"], ["padding", "24px"], ["text-align", "center"], ["color", "var(--subtext-0)"]]], [".inactive-session-pane__title", null, 1e3, [["font-size", "14px"], ["font-weight", "500"], ["color", "var(--text)"]]], [".inactive-session-pane__cwd", null, 1e3, [["font-size", "12px"], ["color", "var(--subtext-0)"], ["word-break", "break-all"]]], [".inactive-session-pane__note", null, 1e3, [["font-size", "12px"], ["max-width", "320px"], ["line-height", "1.5"]]], [".inactive-session-pane__switch", null, 1e3, [["margin-top", "4px"], ["padding", "6px 14px"], ["border-radius", "var(--radius)"], ["border", "0"], ["background", "var(--surface-0)"], ["color", "var(--text)"], ["cursor", "pointer"], ["font-size", "12.5px"]]], [".inactive-session-pane__switch:hover", null, 1e3, [["background", "var(--surface-1)"]]]], skipped: { "@supports evaluated false": 2, "@container": 6, "@keyframes": 9 } };
//! The app's compiled stylesheet as a table (`build.mjs` writes it from Vite + Tailwind's output and bundles it as
//! `virtual:perch-css-table`), parsed once on first use.
let yg = null;
const xg = () => yg ??= new H0(vg);
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
function wg(n, l) {
  const s = /* @__PURE__ */ new Set([...Object.keys(n), ...Object.keys(l)]);
  for (const r of s) {
    if (r === "children") continue;
    const o = n[r], f = l[r];
    if (!(o === f || typeof o == "function" && typeof f == "function") && !(r === "style" && o && f && typeof o == "object" && typeof f == "object" && [.../* @__PURE__ */ new Set([...Object.keys(o), ...Object.keys(f)])].every((d) => o[d] === f[d])))
      return !0;
  }
  return !1;
}
const _g = (n) => !n.props.disabled && (/^(button|input|select|textarea)$/.test(n.tagName) || n.tagName === "a" && n.props.href != null || n.props.tabIndex != null);
function Fd(n, l) {
  for (const s of e0(l.dangerouslySetInnerHTML?.__html, n.ownerDocument) ?? []) n.appendChild(s);
  return n;
}
const kg = {
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
  createInstance: (n, l, s) => Fd(new $t(n, l, s.ownerDocument), l),
  createTextInstance: (n, l) => new tr(n),
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
  commitUpdate: (n, l, s, r) => {
    if (n.props = r, n.inline) for (const o of Object.keys(n.inline)) s.style?.[o] !== r.style?.[o] && delete n.inline[o];
    if (s.dangerouslySetInnerHTML?.__html !== r.dangerouslySetInnerHTML?.__html) {
      for (const o of [...n.childNodes]) n.removeChild(o);
      Fd(n, r);
    }
    wg(s, r) && n.touch();
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
}, ze = k0(kg), er = (n, l, s = null) => ze.createPortal(n, l, null, s), Sg = {
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
}, Eg = /* @__PURE__ */ new Set(["click", "dblclick", "mousedown", "mouseup"]), zg = /* @__PURE__ */ new Set(["button", "input", "select", "textarea", "fieldset"]), Ng = (n) => {
  for (let l = n; l instanceof $t; l = l.parentNode) if (l.props.disabled && zg.has(l.tagName)) return !0;
  return !1;
};
class Tg {
  constructor(l, s, r) {
    Object.assign(this, { clientX: 0, clientY: 0, button: 0, buttons: 0, pointerType: "mouse", key: "", code: "", shiftKey: !1, metaKey: !1, ctrlKey: !1, altKey: !1, repeat: !1, isComposing: !1, keyCode: 0 }, s), this.type = l, this.target = r, this.currentTarget = null, this.defaultPrevented = !1, this.propagationStopped = !1, this.timeStamp = Date.now();
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
function Ai(n, l, s) {
  l.currentTarget = n;
  for (const { type: r, listener: o, capture: f } of [...n.listeners ?? []])
    r === l.type && f === s && o.call(n, l);
  if (n instanceof $t) {
    const r = Sg[l.type], o = r && n.props[s ? `${r}Capture` : r];
    typeof o == "function" && o(l);
  }
}
function wy(n, l, s = {}) {
  const { document: r, window: o, globals: f } = r0(n), m = new $t("div", { id: "root", style: s.container ?? {} }, r);
  r.body.appendChild(m);
  const d = [];
  let p = null;
  const x = () => [r, o].map((D) => D.listeners.map((g) => `${g.type}:${g.capture}`).sort().join(",")).join("|");
  let k = "";
  const S = {}, w = `m${Math.random().toString(36).slice(2, 10)}:`;
  let z = 0, _ = -1;
  r.measureKey = (D) => w + D.id, r.stale = () => _ !== z, r.computed = (D) => {
    if (!S.cascade || !S.top) return null;
    const g = [];
    for (let h = D; h instanceof $t && h !== r.body; h = h.parentNode) g.unshift(h);
    let v = S.top;
    for (const h of g) v = S.cascade.compute(h, v);
    return v.values;
  };
  const y = () => (z += 1, p = bg(r, n, xg(), S, s.names), k = x(), n.render?.(p), p), N = () => {
    ze.flushPassiveEffects(), ze.flushSyncWork(), x() !== k && y();
  };
  r.afterCommit = y;
  const O = (D) => {
    d.push(D), n.error?.(D);
  }, R = ze.createContainer(m, zl.ConcurrentRoot, null, !1, null, "", O, O, O, null);
  ze.updateContainerSync(tt.createElement(l, s.props ?? {}), R, null, null), ze.flushSyncWork(), N();
  const A = (D) => {
    const g = (v) => {
      if (v.id === D) return v;
      for (const h of v.children) {
        const E = g(h);
        if (E) return E;
      }
      return null;
    };
    return g(r.documentElement);
  }, L = (D) => {
    const g = sa;
    sa = zl.DiscreteEventPriority;
    try {
      return D();
    } finally {
      sa = g, ze.flushSyncWork(), N();
    }
  }, q = {
    document: r,
    window: o,
    /** What `window`, `document` and `localStorage` read while this screen runs (`dom.mjs`'s `GLOBALS`). */
    globals: f,
    container: m,
    errors: d,
    /** The latest description (after the last commit or state change). */
    get description() {
      return p;
    },
    describe: y,
    /** Runs a DOM event of `type` at node `id`; false when the node is gone. */
    dispatch(D, g, v = {}) {
      const h = typeof D == "string" ? A(D) : D;
      if (!h || Eg.has(g) && Ng(h)) return !1;
      const E = new Tg(g, v, h), M = [];
      for (let I = h; I; I = I.parentNode) M.push(I);
      const B = [...M, r, o];
      L(() => {
        for (let I = B.length - 1; I > 0 && !E.propagationStopped; I--) Ai(B[I], E, !0);
        E.propagationStopped || (Ai(h, E, !0), E.propagationStopped || Ai(h, E, !1));
        for (let I = 1; I < B.length && !E.propagationStopped; I++) Ai(B[I], E, !1);
      });
      const X = g === "click" && !E.defaultPrevented ? ns(h) : null;
      if (X && q.dispatch(X, "submit", {}), g === "click" && !E.defaultPrevented)
        for (let I = h; I; I = I.parentNode) {
          if (I.tagName !== "a") continue;
          const $ = I.props?.href;
          typeof $ == "string" && /^https:\/\/\S+$/.test($) && n.openLink?.($);
          break;
        }
      return !E.defaultPrevented;
    },
    /** Whether the source listens for `type` on `window` or `document` (a page recording a key press does). */
    listensFor: (D) => [r, o].some((g) => g.listeners.some((v) => v.type === D)),
    /** A key pressed while the screen has the keyboard (`init`: the DOM's `key`, modifiers, `repeat`), at the
     * focused element. When nothing prevented it and that element is a text field, the key edits the field as a
     * browser would: a character is typed at the end (or replaces the text when all of it is selected), Backspace
     * deletes the last one, and the field gets `input` and `change` events with its new `value`. Returns whether the
     * source took the key (prevented it, or a field changed). */
    key(D) {
      const g = r.activeElement && r.activeElement !== r.body ? r.activeElement : r.body;
      if (!q.dispatch(g, "keydown", D)) return !0;
      const h = D.key === "Enter" && !D.isComposing ? ns(g, !0) : null;
      if (h)
        return q.dispatch(h, "submit", {}), !0;
      if (!zf(g) || g.props.disabled || g.props.readOnly) return !1;
      if ((D.ctrlKey || D.metaKey) && !D.altKey && !D.shiftKey && D.key.toLowerCase() === "a")
        return g.selectedAll = !0, !0;
      if (D.ctrlKey || D.metaKey) return !1;
      const E = g.selectedAll;
      g.selectedAll = !1;
      const M = g.value, X = D.key === "Backspace" || E && D.key === "Delete" ? E ? "" : M.slice(0, -1) : [...D.key].length === 1 ? (E ? "" : M) + D.key : M;
      return X === M ? !1 : (g.value = X, q.dispatch(g, "input", { data: D.key }), q.dispatch(g, "change", {}), g.props.value !== void 0 && delete g.edit, g.touch(), y(), !0);
    },
    /** The engine's box for node `id` (window coordinates, logical px), for `getBoundingClientRect`. */
    setBounds(D, g) {
      const v = A(D);
      v && (v.bounds = { x: g.x, y: g.y, width: g.width, height: g.height });
    },
    /** A click on a check box or radio button (`id`): the `click` event, then, unless the source prevented it, the
     * box ticked as a browser ticks it (a radio button only on), with `input` and `change` events. */
    toggle(D) {
      const g = A(D);
      if (!g || g.props.disabled || !q.dispatch(D, "click", { button: 0, detail: 1 })) return;
      const v = g.props.type === "radio";
      v && g.checked || (g.checked = v ? !0 : !g.checked, q.dispatch(D, "input", {}), q.dispatch(D, "change", {}), g.props.checked !== void 0 && delete g.ticked, g.touch(), y());
    },
    /** A left click as the engine reports one: press then release on the same node. */
    click(D, g = {}) {
      const v = { button: 0, buttons: 1, pointerType: "mouse", ...g };
      for (const h of ["pointerdown", "mousedown", "pointerup", "mouseup", "click"]) q.dispatch(D, h, v);
    },
    /** The pointer entered (`on`) or left node `id` (one the description marks `track_hover`): its `:hover` state,
     * which a descendant's group variant reads. The element's own `hover:` styles are the engine's hover style. */
    /** Whether the pointer is over node `id`, as `hover` last said. */
    hovered: (D) => !!A(D)?.state.hover,
    hover(D, g) {
      const v = A(D);
      !v || v.state.hover === g || (v.state.hover = g, v.touch(), y());
    },
    focus(D) {
      const g = A(D);
      g && (L(() => {
        const v = r.activeElement;
        v && v !== g && v !== r.body && q.dispatch(v, "blur"), r.focus(g), q.dispatch(g, "focus");
      }), y());
    },
    /** A press at node `id` that nothing prevented: the browser's default focuses the element pressed. Only an element
     * that listens for keys (`onKeyDown`) is focused, so a press elsewhere leaves the keyboard where it was; the focus
     * is not `:focus-visible`, as after a pointer press in a browser. */
    // ponytail: a browser focuses every focusable element pressed; here only one with its own key handler, so a
    // screen's ordinary buttons do not take the keyboard from a terminal.
    pressFocus(D) {
      let v = typeof D == "string" ? A(D) : D;
      for (; v && !(v instanceof $t && typeof v.props.onKeyDown == "function" && _g(v)); ) v = v.parentNode;
      !v || v === r.activeElement || (q.focus(v.id), v.state.pointerFocus = !0, v.touch(), y());
    },
    /** The engine is drawing the latest description: the boxes measured in this frame's layout are the tree's.
     * Returns whether effects wait for that layout (`measured`); run them with `retry` once the frame is drawn. */
    drawing() {
      return _ = z, r.retries.length > 0;
    },
    /** Runs the effects that waited for a fresh layout. */
    retry() {
      const D = r.retries.splice(0);
      for (const g of D) g();
    },
    /** Runs effects React has scheduled (the engine calls it after a frame). */
    flush: N,
    update(D) {
      ze.updateContainerSync(tt.createElement(l, D ?? {}), R, null, null), ze.flushSyncWork(), N();
    },
    unmount() {
      ze.updateContainerSync(null, R, null, null), ze.flushSyncWork(), ze.flushPassiveEffects(), r.afterCommit = null, r.retries.length = 0, n.forgetBounds?.(w);
    }
  };
  return q;
}
//! `react-dom` for a screen on the native renderer: `createPortal` (into `document.body`, the overlay layer) and
//! `flushSync`. Nothing of the browser renderer.
const qf = (n) => ze.flushSyncFromReconciler(n), Cg = { createPortal: er, flushSync: qf }, _y = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  createPortal: er,
  default: Cg,
  flushSync: qf
}, Symbol.toStringTag, { value: "Module" }));
function Yf(n) {
  var l, s, r = "";
  if (typeof n == "string" || typeof n == "number") r += n;
  else if (typeof n == "object") if (Array.isArray(n)) {
    var o = n.length;
    for (l = 0; l < o; l++) n[l] && (s = Yf(n[l])) && (r && (r += " "), r += s);
  } else for (s in n) n[s] && (r && (r += " "), r += s);
  return r;
}
function Gf() {
  for (var n, l, s = 0, r = "", o = arguments.length; s < o; s++) (n = arguments[s]) && (l = Yf(n)) && (r && (r += " "), r += l);
  return r;
}
const Mg = (n, l) => {
  const s = new Array(n.length + l.length);
  for (let r = 0; r < n.length; r++)
    s[r] = n[r];
  for (let r = 0; r < l.length; r++)
    s[n.length + r] = l[r];
  return s;
}, Ag = (n, l) => ({
  classGroupId: n,
  validator: l
}), Kf = (n = /* @__PURE__ */ new Map(), l = null, s) => ({
  nextPart: n,
  validators: l,
  classGroupId: s
}), Wi = "-", Id = [], jg = "arbitrary..", Og = (n) => {
  const l = Dg(n), {
    conflictingClassGroups: s,
    conflictingClassGroupModifiers: r
  } = n;
  return {
    getClassGroupId: (m) => {
      if (m.startsWith("[") && m.endsWith("]"))
        return Rg(m);
      const d = m.split(Wi), p = d[0] === "" && d.length > 1 ? 1 : 0;
      return Qf(d, p, l);
    },
    getConflictingClassGroupIds: (m, d) => {
      if (d) {
        const p = r[m], x = s[m];
        return p ? x ? Mg(x, p) : p : x || Id;
      }
      return s[m] || Id;
    }
  };
}, Qf = (n, l, s) => {
  if (n.length - l === 0)
    return s.classGroupId;
  const o = n[l], f = s.nextPart.get(o);
  if (f) {
    const x = Qf(n, l + 1, f);
    if (x) return x;
  }
  const m = s.validators;
  if (m === null)
    return;
  const d = l === 0 ? n.join(Wi) : n.slice(l).join(Wi), p = m.length;
  for (let x = 0; x < p; x++) {
    const k = m[x];
    if (k.validator(d))
      return k.classGroupId;
  }
}, Rg = (n) => n.slice(1, -1).indexOf(":") === -1 ? void 0 : (() => {
  const l = n.slice(1, -1), s = l.indexOf(":"), r = l.slice(0, s);
  return r ? jg + r : void 0;
})(), Dg = (n) => {
  const {
    theme: l,
    classGroups: s
  } = n;
  return Bg(s, l);
}, Bg = (n, l) => {
  const s = Kf();
  for (const r in n) {
    const o = n[r];
    _s(o, s, r, l);
  }
  return s;
}, _s = (n, l, s, r) => {
  const o = n.length;
  for (let f = 0; f < o; f++) {
    const m = n[f];
    Hg(m, l, s, r);
  }
}, Hg = (n, l, s, r) => {
  if (typeof n == "string") {
    Ug(n, l, s);
    return;
  }
  if (typeof n == "function") {
    qg(n, l, s, r);
    return;
  }
  Yg(n, l, s, r);
}, Ug = (n, l, s) => {
  const r = n === "" ? l : Vf(l, n);
  r.classGroupId = s;
}, qg = (n, l, s, r) => {
  if (Gg(n)) {
    _s(n(r), l, s, r);
    return;
  }
  l.validators === null && (l.validators = []), l.validators.push(Ag(s, n));
}, Yg = (n, l, s, r) => {
  const o = Object.entries(n), f = o.length;
  for (let m = 0; m < f; m++) {
    const [d, p] = o[m];
    _s(p, Vf(l, d), s, r);
  }
}, Vf = (n, l) => {
  let s = n;
  const r = l.split(Wi), o = r.length;
  for (let f = 0; f < o; f++) {
    const m = r[f];
    let d = s.nextPart.get(m);
    d || (d = Kf(), s.nextPart.set(m, d)), s = d;
  }
  return s;
}, Gg = (n) => "isThemeGetter" in n && n.isThemeGetter === !0, Kg = (n) => {
  if (n < 1)
    return {
      get: () => {
      },
      set: () => {
      }
    };
  let l = 0, s = /* @__PURE__ */ Object.create(null), r = /* @__PURE__ */ Object.create(null);
  const o = (f, m) => {
    s[f] = m, l++, l > n && (l = 0, r = s, s = /* @__PURE__ */ Object.create(null));
  };
  return {
    get(f) {
      let m = s[f];
      if (m !== void 0)
        return m;
      if ((m = r[f]) !== void 0)
        return o(f, m), m;
    },
    set(f, m) {
      f in s ? s[f] = m : o(f, m);
    }
  };
}, cs = "!", $d = ":", Qg = [], Pd = (n, l, s, r, o) => ({
  modifiers: n,
  hasImportantModifier: l,
  baseClassName: s,
  maybePostfixModifierPosition: r,
  isExternal: o
}), Vg = (n) => {
  const {
    prefix: l,
    experimentalParseClassName: s
  } = n;
  let r = (o) => {
    const f = [];
    let m = 0, d = 0, p = 0, x;
    const k = o.length;
    for (let y = 0; y < k; y++) {
      const N = o[y];
      if (m === 0 && d === 0) {
        if (N === $d) {
          f.push(o.slice(p, y)), p = y + 1;
          continue;
        }
        if (N === "/") {
          x = y;
          continue;
        }
      }
      N === "[" ? m++ : N === "]" ? m-- : N === "(" ? d++ : N === ")" && d--;
    }
    const S = f.length === 0 ? o : o.slice(p);
    let w = S, z = !1;
    S.endsWith(cs) ? (w = S.slice(0, -1), z = !0) : (
      /**
       * In Tailwind CSS v3 the important modifier was at the start of the base class name. This is still supported for legacy reasons.
       * @see https://github.com/dcastil/tailwind-merge/issues/513#issuecomment-2614029864
       */
      S.startsWith(cs) && (w = S.slice(1), z = !0)
    );
    const _ = x && x > p ? x - p : void 0;
    return Pd(f, z, w, _);
  };
  if (l) {
    const o = l + $d, f = r;
    r = (m) => m.startsWith(o) ? f(m.slice(o.length)) : Pd(Qg, !1, m, void 0, !0);
  }
  if (s) {
    const o = r;
    r = (f) => s({
      className: f,
      parseClassName: o
    });
  }
  return r;
}, Lg = (n) => {
  const l = /* @__PURE__ */ new Map();
  return n.orderSensitiveModifiers.forEach((s, r) => {
    l.set(s, 1e6 + r);
  }), (s) => {
    const r = [];
    let o = [];
    for (let f = 0; f < s.length; f++) {
      const m = s[f], d = m[0] === "[", p = l.has(m);
      d || p ? (o.length > 0 && (o.sort(), r.push(...o), o = []), r.push(m)) : o.push(m);
    }
    return o.length > 0 && (o.sort(), r.push(...o)), r;
  };
}, Xg = (n) => ({
  cache: Kg(n.cacheSize),
  parseClassName: Vg(n),
  sortModifiers: Lg(n),
  postfixLookupClassGroupIds: Zg(n),
  ...Og(n)
}), Zg = (n) => {
  const l = /* @__PURE__ */ Object.create(null), s = n.postfixLookupClassGroups;
  if (s)
    for (let r = 0; r < s.length; r++)
      l[s[r]] = !0;
  return l;
}, Jg = /\s+/, Wg = (n, l) => {
  const {
    parseClassName: s,
    getClassGroupId: r,
    getConflictingClassGroupIds: o,
    sortModifiers: f,
    postfixLookupClassGroupIds: m
  } = l, d = [], p = n.trim().split(Jg);
  let x = "";
  for (let k = p.length - 1; k >= 0; k -= 1) {
    const S = p[k], {
      isExternal: w,
      modifiers: z,
      hasImportantModifier: _,
      baseClassName: y,
      maybePostfixModifierPosition: N
    } = s(S);
    if (w) {
      x = S + (x.length > 0 ? " " + x : x);
      continue;
    }
    let O = !!N, R;
    if (O) {
      const g = y.substring(0, N);
      R = r(g);
      const v = R && m[R] ? r(y) : void 0;
      v && v !== R && (R = v, O = !1);
    } else
      R = r(y);
    if (!R) {
      if (!O) {
        x = S + (x.length > 0 ? " " + x : x);
        continue;
      }
      if (R = r(y), !R) {
        x = S + (x.length > 0 ? " " + x : x);
        continue;
      }
      O = !1;
    }
    const A = z.length === 0 ? "" : z.length === 1 ? z[0] : f(z).join(":"), L = _ ? A + cs : A, q = L + R;
    if (d.indexOf(q) > -1)
      continue;
    d.push(q);
    const D = o(R, O);
    for (let g = 0; g < D.length; ++g) {
      const v = D[g];
      d.push(L + v);
    }
    x = S + (x.length > 0 ? " " + x : x);
  }
  return x;
}, Fg = (...n) => {
  let l = 0, s, r, o = "";
  for (; l < n.length; )
    (s = n[l++]) && (r = Lf(s)) && (o && (o += " "), o += r);
  return o;
}, Lf = (n) => {
  if (typeof n == "string")
    return n;
  let l, s = "";
  for (let r = 0; r < n.length; r++)
    n[r] && (l = Lf(n[r])) && (s && (s += " "), s += l);
  return s;
}, Ig = (n, ...l) => {
  let s, r, o, f;
  const m = (p) => {
    const x = l.reduce((k, S) => S(k), n());
    return s = Xg(x), r = s.cache.get, o = s.cache.set, f = d, d(p);
  }, d = (p) => {
    const x = r(p);
    if (x)
      return x;
    const k = Wg(p, s);
    return o(p, k), k;
  };
  return f = m, (...p) => f(Fg(...p));
}, $g = [], Zt = (n) => {
  const l = (s) => s[n] || $g;
  return l.isThemeGetter = !0, l.themeKey = n, l;
}, Xf = /^\[(?:(\w[\w-]*):)?(.+)\]$/i, Zf = /^\((?:(\w[\w-]*):)?(.+)\)$/i, Pg = /^\d+(?:\.\d+)?\/\d+(?:\.\d+)?$/, tb = /^(\d+(\.\d+)?)?(xs|sm|md|lg|xl)$/, eb = /\d+(%|px|r?em|[sdl]?v([hwib]|min|max)|pt|pc|in|cm|mm|cap|ch|ex|r?lh|cq(w|h|i|b|min|max))|\b(calc|min|max|clamp)\(.+\)|^0$/, nb = /^(rgba?|hsla?|hwb|(ok)?(lab|lch)|color-mix|color|light-dark)\(.+\)$/, ab = /^(inset_)?-?((\d+)?\.?(\d+)[a-z]+|0)_-?((\d+)?\.?(\d+)[a-z]+|0)/, lb = /^(url|image|image-set|cross-fade|element|(repeating-)?(linear|radial|conic)-gradient)\(.+\)$/, On = (n) => Pg.test(n), vt = (n) => !!n && !Number.isNaN(Number(n)), We = (n) => !!n && Number.isInteger(Number(n)), Wo = (n) => n.endsWith("%") && vt(n.slice(0, -1)), fn = (n) => tb.test(n), Jf = () => !0, ib = (n) => (
  // `colorFunctionRegex` check is necessary because color functions can have percentages in them which which would be incorrectly classified as lengths.
  // For example, `hsl(0 0% 0%)` would be classified as a length without this check.
  // I could also use lookbehind assertion in `lengthUnitRegex` but that isn't supported widely enough.
  eb.test(n) && !nb.test(n)
), ks = () => !1, rb = (n) => ab.test(n), ob = (n) => lb.test(n), sb = (n) => !lt(n) && !it(n), cb = (n) => n.startsWith("@container") && (n[10] === "/" && n[11] !== void 0 || n[11] === "s" && n[16] !== void 0 && n.startsWith("-size/", 10) || n[11] === "n" && n[18] !== void 0 && n.startsWith("-normal/", 10)), ub = (n) => Gn(n, If, ks), lt = (n) => Xf.test(n), oa = (n) => Gn(n, $f, ib), tf = (n) => Gn(n, vb, vt), db = (n) => Gn(n, tm, Jf), fb = (n) => Gn(n, Pf, ks), ef = (n) => Gn(n, Wf, ks), mb = (n) => Gn(n, Ff, ob), ji = (n) => Gn(n, em, rb), it = (n) => Zf.test(n), xl = (n) => ua(n, $f), pb = (n) => ua(n, Pf), nf = (n) => ua(n, Wf), hb = (n) => ua(n, If), gb = (n) => ua(n, Ff), Oi = (n) => ua(n, em, !0), bb = (n) => ua(n, tm, !0), Gn = (n, l, s) => {
  const r = Xf.exec(n);
  return r ? r[1] ? l(r[1]) : s(r[2]) : !1;
}, ua = (n, l, s = !1) => {
  const r = Zf.exec(n);
  return r ? r[1] ? l(r[1]) : s : !1;
}, Wf = (n) => n === "position" || n === "percentage", Ff = (n) => n === "image" || n === "url", If = (n) => n === "length" || n === "size" || n === "bg-size", $f = (n) => n === "length", vb = (n) => n === "number", Pf = (n) => n === "family-name", tm = (n) => n === "number" || n === "weight", em = (n) => n === "shadow", yb = () => {
  const n = Zt("color"), l = Zt("font"), s = Zt("text"), r = Zt("font-weight"), o = Zt("tracking"), f = Zt("leading"), m = Zt("breakpoint"), d = Zt("container"), p = Zt("spacing"), x = Zt("radius"), k = Zt("shadow"), S = Zt("inset-shadow"), w = Zt("text-shadow"), z = Zt("drop-shadow"), _ = Zt("blur"), y = Zt("perspective"), N = Zt("aspect"), O = Zt("ease"), R = Zt("animate"), A = () => ["auto", "avoid", "all", "avoid-page", "page", "left", "right", "column"], L = () => [
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
  ], q = () => [...L(), it, lt], D = () => ["auto", "hidden", "clip", "visible", "scroll"], g = () => ["auto", "contain", "none"], v = () => [it, lt, p], h = () => [On, "full", "auto", ...v()], E = () => [We, "none", "subgrid", it, lt], M = () => ["auto", {
    span: ["full", We, it, lt]
  }, We, it, lt], B = () => [We, "auto", it, lt], X = () => ["auto", "min", "max", "fr", it, lt], I = () => ["start", "end", "center", "between", "around", "evenly", "stretch", "baseline", "center-safe", "end-safe"], $ = () => ["start", "end", "center", "stretch", "center-safe", "end-safe"], Q = () => ["auto", ...v()], Z = () => [On, "auto", "full", "dvw", "dvh", "lvw", "lvh", "svw", "svh", "min", "max", "fit", ...v()], P = () => [d, On, "screen", "full", "dvw", "lvw", "svw", "min", "max", "fit", ...v()], G = () => [On, "screen", "full", "lh", "dvh", "lvh", "svh", "min", "max", "fit", ...v()], K = () => [n, it, lt], T = () => [...L(), nf, ef, {
    position: [it, lt]
  }], V = () => ["no-repeat", {
    repeat: ["", "x", "y", "space", "round"]
  }], nt = () => ["auto", "cover", "contain", hb, ub, {
    size: [it, lt]
  }], ot = () => [Wo, xl, oa], st = () => [
    // Deprecated since Tailwind CSS v4.0.0
    "",
    "none",
    "full",
    x,
    it,
    lt
  ], ct = () => ["", vt, xl, oa], St = () => ["solid", "dashed", "dotted", "double"], Jt = () => ["normal", "multiply", "screen", "overlay", "darken", "lighten", "color-dodge", "color-burn", "hard-light", "soft-light", "difference", "exclusion", "hue", "saturation", "color", "luminosity"], ht = () => [vt, Wo, nf, ef], Kn = () => [
    // Deprecated since Tailwind CSS v4.0.0
    "",
    "none",
    _,
    it,
    lt
  ], Qn = () => ["none", vt, it, lt], De = () => ["none", vt, it, lt], Be = () => [vt, it, lt], pn = () => [On, "full", ...v()];
  return {
    cacheSize: 500,
    theme: {
      animate: ["spin", "ping", "pulse", "bounce"],
      aspect: ["video"],
      blur: [fn],
      breakpoint: [fn],
      color: [Jf],
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
        aspect: ["auto", "square", On, lt, it, N]
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
        "@container": ["", "normal", "size", it, lt]
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
        columns: [vt, "auto", lt, it, d]
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
        z: [We, "auto", it, lt]
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
        grow: ["", vt, it, lt]
      }],
      /**
       * Flex Shrink
       * @see https://tailwindcss.com/docs/flex-shrink
       */
      shrink: [{
        shrink: ["", vt, it, lt]
      }],
      /**
       * Order
       * @see https://tailwindcss.com/docs/order
       */
      order: [{
        order: [We, "first", "last", "none", it, lt]
      }],
      /**
       * Grid Template Columns
       * @see https://tailwindcss.com/docs/grid-template-columns
       */
      "grid-cols": [{
        "grid-cols": E()
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
        "grid-rows": E()
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
        "auto-cols": X()
      }],
      /**
       * Grid Auto Rows
       * @see https://tailwindcss.com/docs/grid-auto-rows
       */
      "auto-rows": [{
        "auto-rows": X()
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
        text: ["base", s, xl, oa]
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
        font: [r, bb, db]
      }],
      /**
       * Font Stretch
       * @see https://tailwindcss.com/docs/font-stretch
       */
      "font-stretch": [{
        "font-stretch": ["ultra-condensed", "extra-condensed", "condensed", "semi-condensed", "normal", "semi-expanded", "expanded", "extra-expanded", "ultra-expanded", Wo, lt]
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
        tracking: [o, it, lt]
      }],
      /**
       * Line Clamp
       * @see https://tailwindcss.com/docs/line-clamp
       */
      "line-clamp": [{
        "line-clamp": [vt, "none", it, tf]
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
        "list-image": ["none", it, lt]
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
        list: ["disc", "decimal", "none", it, lt]
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
        decoration: [...St(), "wavy"]
      }],
      /**
       * Text Decoration Thickness
       * @see https://tailwindcss.com/docs/text-decoration-thickness
       */
      "text-decoration-thickness": [{
        decoration: [vt, "from-font", "auto", it, oa]
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
        "underline-offset": [vt, "auto", it, lt]
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
        tab: [We, it, lt]
      }],
      /**
       * Vertical Alignment
       * @see https://tailwindcss.com/docs/vertical-align
       */
      "vertical-align": [{
        align: ["baseline", "top", "middle", "bottom", "text-top", "text-bottom", "sub", "super", it, lt]
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
        content: ["none", it, lt]
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
          }, We, it, lt],
          radial: ["", it, lt],
          conic: ["", We, it, lt]
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
        border: ct()
      }],
      /**
       * Border Width Inline
       * @see https://tailwindcss.com/docs/border-width
       */
      "border-w-x": [{
        "border-x": ct()
      }],
      /**
       * Border Width Block
       * @see https://tailwindcss.com/docs/border-width
       */
      "border-w-y": [{
        "border-y": ct()
      }],
      /**
       * Border Width Inline Start
       * @see https://tailwindcss.com/docs/border-width
       */
      "border-w-s": [{
        "border-s": ct()
      }],
      /**
       * Border Width Inline End
       * @see https://tailwindcss.com/docs/border-width
       */
      "border-w-e": [{
        "border-e": ct()
      }],
      /**
       * Border Width Block Start
       * @see https://tailwindcss.com/docs/border-width
       */
      "border-w-bs": [{
        "border-bs": ct()
      }],
      /**
       * Border Width Block End
       * @see https://tailwindcss.com/docs/border-width
       */
      "border-w-be": [{
        "border-be": ct()
      }],
      /**
       * Border Width Top
       * @see https://tailwindcss.com/docs/border-width
       */
      "border-w-t": [{
        "border-t": ct()
      }],
      /**
       * Border Width Right
       * @see https://tailwindcss.com/docs/border-width
       */
      "border-w-r": [{
        "border-r": ct()
      }],
      /**
       * Border Width Bottom
       * @see https://tailwindcss.com/docs/border-width
       */
      "border-w-b": [{
        "border-b": ct()
      }],
      /**
       * Border Width Left
       * @see https://tailwindcss.com/docs/border-width
       */
      "border-w-l": [{
        "border-l": ct()
      }],
      /**
       * Divide Width X
       * @see https://tailwindcss.com/docs/border-width#between-children
       */
      "divide-x": [{
        "divide-x": ct()
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
        "divide-y": ct()
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
        border: [...St(), "hidden", "none"]
      }],
      /**
       * Divide Style
       * @see https://tailwindcss.com/docs/border-style#setting-the-divider-style
       */
      "divide-style": [{
        divide: [...St(), "hidden", "none"]
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
        outline: [...St(), "none", "hidden"]
      }],
      /**
       * Outline Offset
       * @see https://tailwindcss.com/docs/outline-offset
       */
      "outline-offset": [{
        "outline-offset": [vt, it, lt]
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
          Oi,
          ji
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
        "inset-shadow": ["none", S, Oi, ji]
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
        ring: ct()
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
        "inset-ring": ct()
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
        "text-shadow": ["none", w, Oi, ji]
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
        opacity: [vt, it, lt]
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
        "mask-radial": [it, lt]
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
        mask: V()
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
        mask: ["none", it, lt]
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
          lt
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
        brightness: [vt, it, lt]
      }],
      /**
       * Contrast
       * @see https://tailwindcss.com/docs/contrast
       */
      contrast: [{
        contrast: [vt, it, lt]
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
          Oi,
          ji
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
        grayscale: ["", vt, it, lt]
      }],
      /**
       * Hue Rotate
       * @see https://tailwindcss.com/docs/hue-rotate
       */
      "hue-rotate": [{
        "hue-rotate": [vt, it, lt]
      }],
      /**
       * Invert
       * @see https://tailwindcss.com/docs/invert
       */
      invert: [{
        invert: ["", vt, it, lt]
      }],
      /**
       * Saturate
       * @see https://tailwindcss.com/docs/saturate
       */
      saturate: [{
        saturate: [vt, it, lt]
      }],
      /**
       * Sepia
       * @see https://tailwindcss.com/docs/sepia
       */
      sepia: [{
        sepia: ["", vt, it, lt]
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
          lt
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
        "backdrop-brightness": [vt, it, lt]
      }],
      /**
       * Backdrop Contrast
       * @see https://tailwindcss.com/docs/backdrop-contrast
       */
      "backdrop-contrast": [{
        "backdrop-contrast": [vt, it, lt]
      }],
      /**
       * Backdrop Grayscale
       * @see https://tailwindcss.com/docs/backdrop-grayscale
       */
      "backdrop-grayscale": [{
        "backdrop-grayscale": ["", vt, it, lt]
      }],
      /**
       * Backdrop Hue Rotate
       * @see https://tailwindcss.com/docs/backdrop-hue-rotate
       */
      "backdrop-hue-rotate": [{
        "backdrop-hue-rotate": [vt, it, lt]
      }],
      /**
       * Backdrop Invert
       * @see https://tailwindcss.com/docs/backdrop-invert
       */
      "backdrop-invert": [{
        "backdrop-invert": ["", vt, it, lt]
      }],
      /**
       * Backdrop Opacity
       * @see https://tailwindcss.com/docs/backdrop-opacity
       */
      "backdrop-opacity": [{
        "backdrop-opacity": [vt, it, lt]
      }],
      /**
       * Backdrop Saturate
       * @see https://tailwindcss.com/docs/backdrop-saturate
       */
      "backdrop-saturate": [{
        "backdrop-saturate": [vt, it, lt]
      }],
      /**
       * Backdrop Sepia
       * @see https://tailwindcss.com/docs/backdrop-sepia
       */
      "backdrop-sepia": [{
        "backdrop-sepia": ["", vt, it, lt]
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
        transition: ["", "all", "colors", "opacity", "shadow", "transform", "none", it, lt]
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
        duration: [vt, "initial", it, lt]
      }],
      /**
       * Transition Timing Function
       * @see https://tailwindcss.com/docs/transition-timing-function
       */
      ease: [{
        ease: ["linear", "initial", O, it, lt]
      }],
      /**
       * Transition Delay
       * @see https://tailwindcss.com/docs/transition-delay
       */
      delay: [{
        delay: [vt, it, lt]
      }],
      /**
       * Animation
       * @see https://tailwindcss.com/docs/animation
       */
      animate: [{
        animate: ["none", R, it, lt]
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
        perspective: [y, it, lt]
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
        transform: [it, lt, "", "none", "gpu", "cpu"]
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
        zoom: [We, it, lt]
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
        cursor: ["auto", "default", "pointer", "wait", "text", "move", "help", "not-allowed", "none", "context-menu", "progress", "cell", "crosshair", "vertical-text", "alias", "copy", "no-drop", "grab", "grabbing", "all-scroll", "col-resize", "row-resize", "n-resize", "e-resize", "s-resize", "w-resize", "ne-resize", "nw-resize", "se-resize", "sw-resize", "ew-resize", "ns-resize", "nesw-resize", "nwse-resize", "zoom-in", "zoom-out", it, lt]
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
        "will-change": ["auto", "scroll", "contents", "transform", it, lt]
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
        stroke: [vt, xl, oa, tf]
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
function Ut(...n) {
  return xb(Gf(n));
}
function wb(n, l, s) {
  return n.filter((r, o) => o !== l && (r.start + r.end) / 2 < s).length;
}
function _b(n, l, s, r) {
  const o = n.map(() => 0), f = n[l];
  if (!f) return o;
  const m = n[l + 1], d = n[l - 1], p = f.end - f.start + (m ? m.start - f.end : d ? f.start - d.end : 0);
  return n.forEach((x, k) => {
    l < s && k > l && k <= s ? o[k] = -p : s < l && k >= s && k < l && (o[k] = p);
  }), o[l] = Math.min(Math.max(r, n[0].start - f.start), n[n.length - 1].end - f.end), o;
}
const af = ["transform", "transition", "zIndex", "filter", "pointerEvents", "position"];
function kb(n, l) {
  for (let s = n.parentElement; s; s = s.parentElement) {
    const r = getComputedStyle(s)[l === "x" ? "overflowX" : "overflowY"];
    if ((r === "auto" || r === "scroll") && (l === "x" ? s.scrollWidth > s.clientWidth : s.scrollHeight > s.clientHeight)) return s;
  }
  return null;
}
function Sb(n, l, s, r) {
  const o = n[l] ? kb(n[l], s) : null, f = () => o ? s === "x" ? o.scrollLeft : o.scrollTop : 0, m = (N) => (s === "x" ? N.clientX : N.clientY) + f(), d = m(r), p = f(), x = n.map((N) => {
    const O = N.getBoundingClientRect();
    return s === "x" ? { start: O.left + p, end: O.right + p } : { start: O.top + p, end: O.bottom + p };
  }), k = n.map((N) => af.map((O) => N.style[O])), S = typeof matchMedia == "function" && matchMedia("(prefers-reduced-motion: reduce)").matches, w = s === "x" ? "translateX" : "translateY";
  let z = !1;
  const _ = { to: l };
  n.forEach((N, O) => {
    if (N.style.pointerEvents = "none", O !== l) {
      S || (N.style.transition = "transform 160ms cubic-bezier(0.2, 0.8, 0.2, 1)");
      return;
    }
    getComputedStyle(N).position === "static" && (N.style.position = "relative"), N.style.zIndex = "30", N.style.filter = "drop-shadow(0 6px 10px rgba(0, 0, 0, 0.45))";
  });
  const y = (N, O) => {
    _.to = N, _b(x, l, N, O).forEach((R, A) => {
      n[A].style.transform = R ? `${w}(${R}px)` : "";
    });
  };
  return {
    from: l,
    get to() {
      return _.to;
    },
    slot: (N) => wb(x, l, m(N)),
    apply: (N, O) => {
      z || y(N, m(O) - d);
    },
    rest: () => {
      z || y(l, 0);
    },
    end: () => {
      z || (z = !0, n.forEach((N, O) => af.forEach((R, A) => {
        N.style[R] = k[O][A];
      })));
    }
  };
}
const Eb = 5;
let Fo = !1;
function zb(n, l) {
  if (n.button !== 0 || Fo) return;
  const s = { clientX: n.clientX, clientY: n.clientY }, r = n.currentTarget, o = n.pointerId;
  let f = null, m, d = !1;
  const p = { cursor: document.body.style.cursor, userSelect: document.body.style.userSelect }, x = (_) => {
    if (d) return;
    d = !0, window.removeEventListener("pointermove", k), window.removeEventListener("pointerup", S), window.removeEventListener("pointercancel", w), window.removeEventListener("keydown", z, !0), window.removeEventListener("blur", w), r.removeEventListener("lostpointercapture", w);
    try {
      r.releasePointerCapture(o);
    } catch {
    }
    if (!f) return;
    Fo = !1, document.body.style.cursor = p.cursor, document.body.style.userSelect = p.userSelect, f.end();
    const y = (N) => N.stopPropagation();
    window.addEventListener("click", y, { capture: !0, once: !0 }), setTimeout(() => window.removeEventListener("click", y, !0), 0), m?.(), l.onEnd(_, f);
  }, k = (_) => {
    if (!f) {
      if (Math.hypot(_.clientX - s.clientX, _.clientY - s.clientY) < Eb) return;
      const y = l.items();
      f = Sb(y, l.from(y), l.axis, s), Fo = !0, document.body.style.cursor = "grabbing", document.body.style.userSelect = "none";
      try {
        r.setPointerCapture(o);
      } catch {
      }
      r.addEventListener("lostpointercapture", w);
      const N = l.onStart?.();
      m = typeof N == "function" ? N : void 0;
    }
    l.onMove(_, f);
  }, S = () => x(!0), w = () => x(!1), z = (_) => {
    _.key === "Escape" && (_.stopPropagation(), x(!1));
  };
  window.addEventListener("pointermove", k), window.addEventListener("pointerup", S), window.addEventListener("pointercancel", w), window.addEventListener("keydown", z, !0), window.addEventListener("blur", w);
}
const nm = typeof navigator < "u" && /Mac/i.test(navigator.platform), Fi = {
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
for (let n = 1; n <= 12; n++) Fi[`f${n}`] = `F${n}`;
const Nb = Object.fromEntries(Object.entries(Fi).map(([n, l]) => [l, n])), Tb = {
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
function Cb(n) {
  const l = /^Key([A-Z])$/.exec(n) ?? /^Digit(\d)$/.exec(n);
  return l ? l[1].toLowerCase() : Nb[n];
}
const lf = /* @__PURE__ */ new Map();
function am(n, l = nm) {
  const s = `${l}|${n}`, r = lf.get(s);
  if (r) return r;
  const o = { cmd: !1, ctrl: !1, shift: !1, alt: !1, code: "" };
  for (const f of n.split("+"))
    if (f === "mod")
      l ? o.cmd = !0 : (o.ctrl = !0, o.shift = !0);
    else if (f === "cmd" || f === "ctrl" || f === "shift" || f === "alt") o[f] = !0;
    else if (/^[a-z]$/.test(f))
      o.code = `Key${f.toUpperCase()}`, o.letter = f;
    else if (/^[0-9]$/.test(f)) o.code = `Digit${f}`;
    else if (Fi[f]) o.code = Fi[f];
    else throw new Error(`unknown key "${f}" in "${n}"`);
  if (!o.code) throw new Error(`no key in "${n}"`);
  return lf.set(s, o), o;
}
new Set(["cmd+q", "cmd+h", "cmd+alt+h", "cmd+m", "cmd+ctrl+f", "cmd+z", "cmd+shift+z", "cmd+x", "cmd+c", "cmd+v", "cmd+a"].map((n) => {
  const l = am(n, !0);
  return [l.cmd && "cmd", l.ctrl && "ctrl", l.alt && "alt", l.shift && "shift", l.code].filter(Boolean).join("+");
}));
function Mb(n, l = nm) {
  const s = am(n, l), r = Ab(Cb(s.code) ?? "");
  return l ? `${s.ctrl ? "⌃" : ""}${s.alt ? "⌥" : ""}${s.shift ? "⇧" : ""}${s.cmd ? "⌘" : ""}${r}` : [s.ctrl && "Ctrl", s.alt && "Alt", s.shift && "Shift", r].filter(Boolean).join("+");
}
const Ab = (n) => Tb[n] ?? n.toUpperCase(), rf = (n) => typeof n == "boolean" ? `${n}` : n === 0 ? "0" : n, of = Gf, nr = (n, l) => (s) => {
  var r;
  if (l?.variants == null) return of(n, s?.class, s?.className);
  const { variants: o, defaultVariants: f } = l, m = Object.keys(o).map((x) => {
    const k = s?.[x], S = f?.[x];
    if (k === null) return null;
    const w = rf(k) || rf(S);
    return o[x][w];
  }), d = s && Object.entries(s).reduce((x, k) => {
    let [S, w] = k;
    return w === void 0 || (x[S] = w), x;
  }, {}), p = l == null || (r = l.compoundVariants) === null || r === void 0 ? void 0 : r.reduce((x, k) => {
    let { class: S, className: w, ...z } = k;
    return Object.entries(z).every((_) => {
      let [y, N] = _;
      return Array.isArray(N) ? N.includes({
        ...f,
        ...d
      }[y]) : {
        ...f,
        ...d
      }[y] === N;
    }) ? [
      ...x,
      S,
      w
    ] : x;
  }, []);
  return of(n, m, p, s?.class, s?.className);
}, jb = nr(
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
), Ob = nr(
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
function Rb({ className: n, ...l } = {}) {
  return Ut(Ob(l), n);
}
const lm = "shrink-0 cursor-pointer rounded-ui bg-transparent px-[0.2rem] py-[0.1rem] text-[0.8rem] leading-none text-subtext-0 [font-family:inherit] [border:none] [transition:color_0.1s_ease,background_0.1s_ease] hover:bg-surface-1 hover:text-accent", qa = "cursor-pointer rounded-ui bg-transparent text-subtext-0 [border:0] [font-family:inherit] [transition:color_0.1s_ease,background_0.1s_ease] hover:bg-surface-1 hover:text-fg focus-visible:bg-surface-1 focus-visible:text-fg disabled:cursor-not-allowed disabled:opacity-40", Db = nr(`${qa} shrink-0 focus-visible:[outline:2px_solid_var(--accent)] focus-visible:[outline-offset:-2px]`, {
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
function Bb({ className: n, ...l } = {}) {
  return Ut(Db(l), n);
}
const im = "overflow-hidden rounded-ui bg-surface-1 py-[0.3rem] shadow-[0_8px_24px_rgba(0,0,0,0.45)]", Hb = nr(
  "pane-context-menu__item block w-full cursor-pointer bg-transparent px-[0.9rem] py-[0.45rem] text-left text-[0.82rem] [border:none] [font-family:inherit] [transition:background_0.1s_ease] hover:bg-surface-0 disabled:cursor-not-allowed disabled:bg-transparent disabled:opacity-40",
  { variants: { danger: { true: "text-red", false: "text-fg" } }, defaultVariants: { danger: !1 } }
), Ub = "my-1 h-px bg-overlay-0";
function qb({ size: n = 14, className: l }) {
  return /* @__PURE__ */ ft.jsxs("svg", { className: l, width: n, height: n, viewBox: "0 0 16 16", fill: "currentColor", "aria-hidden": "true", children: [
    /* @__PURE__ */ ft.jsx("circle", { cx: "3.5", cy: "8", r: "1.1" }),
    /* @__PURE__ */ ft.jsx("circle", { cx: "8", cy: "8", r: "1.1" }),
    /* @__PURE__ */ ft.jsx("circle", { cx: "12.5", cy: "8", r: "1.1" })
  ] });
}
function Yb({ size: n = 16, className: l }) {
  return /* @__PURE__ */ ft.jsxs("svg", { className: l, width: n, height: n, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: "1.3", strokeLinejoin: "round", "aria-hidden": "true", children: [
    /* @__PURE__ */ ft.jsx("path", { d: "M6.6 1.8h2.8l.4 1.6 1.1.6 1.5-.6 1.4 2.4-1.2 1.1v1.3l1.2 1.1-1.4 2.4-1.5-.6-1.1.6-.4 1.6H6.6l-.4-1.6-1.1-.6-1.5.6-1.4-2.4 1.2-1.1V7.3L2.2 6.2l1.4-2.4 1.5.6 1.1-.6z" }),
    /* @__PURE__ */ ft.jsx("circle", { cx: "8", cy: "8", r: "2" })
  ] });
}
function Gb({ size: n = 14, className: l }) {
  return /* @__PURE__ */ ft.jsx("svg", { className: l, width: n, height: n, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round", "aria-hidden": "true", children: /* @__PURE__ */ ft.jsx("path", { d: "M3.5 3.5l9 9M12.5 3.5l-9 9" }) });
}
function rm({ size: n = 14, className: l }) {
  return /* @__PURE__ */ ft.jsx("svg", { className: l, width: n, height: n, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round", "aria-hidden": "true", children: /* @__PURE__ */ ft.jsx("path", { d: "M8 2.5v11M2.5 8h11" }) });
}
const sf = {
  connected: "host-state--connected bg-accent",
  connecting: "host-state--connecting animate-host-pulse bg-yellow",
  error: "host-state--error bg-red",
  disabled: "host-state--disabled bg-subtext-0"
};
function Kb({ state: n, error: l }) {
  return /* @__PURE__ */ ft.jsx(
    "span",
    {
      className: Ut("host-state inline-block h-2 w-2 shrink-0 rounded-[50%]", sf[n] ?? sf.disabled),
      title: n === "error" && l ? l : n
    }
  );
}
function Qb({ title: n, onClose: l, children: s, testId: r }) {
  return er(
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
            "aria-label": n,
            "data-testid": r,
            children: [
              /* @__PURE__ */ ft.jsx("h2", { className: "m-0 text-[0.9rem] font-semibold text-fg", children: n }),
              s
            ]
          }
        )
      }
    ),
    document.body
  );
}
const Ri = 4, Rn = 8, Vb = "flex w-full cursor-pointer items-center justify-between gap-3 px-[0.9rem] py-[0.4rem] text-left text-[0.82rem] text-fg max-[700px]:min-h-11 aria-disabled:cursor-not-allowed aria-disabled:opacity-40", cf = (n) => n.text ?? (typeof n.label == "string" ? n.label : n.value);
function Lb({ value: n, onChange: l, options: s, className: r, ariaLabel: o, testId: f, id: m, title: d, disabled: p, placeholder: x, freeText: k, onKeyDown: S }) {
  const w = tt.useId(), [z, _] = tt.useState(!1), [y, N] = tt.useState(-1), [O, R] = tt.useState(!1), A = tt.useRef(null), L = tt.useRef(null), [q, D] = tt.useState({}), g = tt.useRef({ text: "", at: 0 }), v = k && O && n ? s.filter((G) => cf(G).toLowerCase().includes(n.toLowerCase()) || G.value.toLowerCase().includes(n.toLowerCase())) : s, h = s.find((G) => G.value === n), E = (G) => `${w}-${G}`;
  function M(G) {
    p || (N(G), _(!0));
  }
  function B() {
    _(!1), R(!1), N(-1);
  }
  function X(G) {
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
  as(() => {
    if (!z || !A.current) {
      D((nt) => nt.left === void 0 ? nt : {});
      return;
    }
    const G = A.current.getBoundingClientRect(), K = window.innerHeight - G.bottom - Ri - Rn, T = G.top - Ri - Rn, V = K < 160 && T > K;
    D({
      position: "fixed",
      left: Math.min(Math.max(Rn, G.left), Math.max(Rn, window.innerWidth - G.width - Rn)),
      // As wide as its longest label (a session title, a path), never wider than the window.
      width: "max-content",
      minWidth: G.width,
      maxWidth: window.innerWidth - 2 * Rn,
      maxHeight: Math.min(V ? T : K, 320),
      ...V ? { bottom: window.innerHeight - G.top + Ri } : { top: G.bottom + Ri },
      overflowY: "auto"
    });
  }, [z, v.length]), as(() => {
    const G = L.current;
    if (!z || !G || q.left === void 0) return;
    const K = G.getBoundingClientRect().right, T = window.innerWidth - Rn;
    K > T && D((V) => ({ ...V, left: Math.max(Rn, Number(V.left) - (K - T)) }));
  }, [z, q]), Re(() => {
    if (!z) return;
    const G = (K) => {
      const T = K.target;
      (T === document || T instanceof Node && A.current && T.contains(A.current)) && B();
    };
    return window.addEventListener("resize", B), window.addEventListener("scroll", G, !0), () => {
      window.removeEventListener("resize", B), window.removeEventListener("scroll", G, !0);
    };
  }, [z]), Re(() => {
    const G = z && y >= 0 ? document.getElementById(E(y)) : null, K = L.current;
    !G || !K || (G.offsetTop < K.scrollTop ? K.scrollTop = G.offsetTop : G.offsetTop + G.offsetHeight > K.scrollTop + K.clientHeight && (K.scrollTop = G.offsetTop + G.offsetHeight - K.clientHeight));
  }, [z, y]), um(z, (G) => {
    G || B();
  }, A, L);
  function Z(G) {
    if (G.nativeEvent.isComposing) return;
    const K = () => {
      G.preventDefault(), G.stopPropagation();
    }, { key: T } = G;
    if (z) {
      if (T === "Escape") {
        K(), B();
        return;
      } else if (T === "Tab")
        B();
      else if (T === "ArrowDown" || T === "ArrowUp") {
        K(), v.length && N(y < 0 ? T === "ArrowDown" ? $() : Q() : I(y, T === "ArrowDown" ? 1 : -1));
        return;
      } else if (T === "Home" && !k) {
        K(), N($());
        return;
      } else if (T === "End" && !k) {
        K(), N(Q());
        return;
      } else if (T === "Enter" || T === " " && !k) {
        if (y >= 0 && v[y]) {
          K(), X(v[y]);
          return;
        }
        if (!k) {
          K(), B();
          return;
        }
      } else if (!k && T.length === 1 && !G.metaKey && !G.ctrlKey && !G.altKey) {
        const V = Date.now();
        g.current = { text: (V - g.current.at > 600 ? "" : g.current.text) + T.toLowerCase(), at: V };
        const nt = Math.max(y, 0), ot = [...v.slice(nt + (g.current.text.length === 1 ? 1 : 0)), ...v.slice(0, nt + 1)].find((st) => !st.disabled && cf(st).toLowerCase().startsWith(g.current.text));
        ot && (K(), N(v.indexOf(ot)));
        return;
      }
    } else if (T === "ArrowDown" || T === "ArrowUp" || !k && (T === "Enter" || T === " ")) {
      K(), M(Math.max(0, v.findIndex((V) => V.value === n)));
      return;
    }
    S?.(G);
  }
  const P = {
    ref: (G) => {
      A.current = G;
    },
    id: m,
    title: d,
    disabled: p,
    "aria-label": o,
    "aria-expanded": z,
    "aria-controls": z ? w : void 0,
    "aria-activedescendant": z && y >= 0 ? E(y) : void 0,
    "data-testid": f,
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
        className: r,
        value: n,
        onChange: (G) => {
          l(G.target.value), R(!0), z ? N(-1) : (N(-1), _(!0));
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
        "data-value": n,
        className: Ut("inline-flex items-center justify-between gap-2 text-left [font-family:inherit] cursor-pointer disabled:cursor-not-allowed disabled:opacity-50", r),
        onClick: () => z ? B() : M(Math.max(0, v.findIndex((G) => G.value === n))),
        children: [
          /* @__PURE__ */ ft.jsx("span", { className: "min-w-0 flex-1 truncate", children: h ? h.label : x ?? "" }),
          /* @__PURE__ */ ft.jsx(cm, { open: !0, className: "shrink-0 text-subtext-0" })
        ]
      }
    ),
    z && v.length > 0 && er(
      /* @__PURE__ */ ft.jsx(
        "div",
        {
          ref: L,
          id: w,
          role: "listbox",
          "aria-label": o,
          className: Ut("z-[9999]", im),
          style: q,
          onMouseDown: (G) => {
            G.preventDefault(), G.stopPropagation();
          },
          onClick: (G) => G.stopPropagation(),
          children: v.map((G, K) => /* @__PURE__ */ ft.jsxs(
            "div",
            {
              id: E(K),
              role: "option",
              "aria-selected": G.value === n,
              "aria-disabled": G.disabled || void 0,
              "data-value": G.value,
              className: Ut(Vb, K === y && !G.disabled && "bg-surface-0"),
              onMouseEnter: () => {
                G.disabled || N(K);
              },
              onClick: () => X(G),
              children: [
                /* @__PURE__ */ ft.jsx("span", { className: "min-w-0 truncate", children: G.label }),
                G.value === n && /* @__PURE__ */ ft.jsx("span", { "aria-hidden": "true", className: "shrink-0 text-accent", children: "✓" })
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
const Xb = "box-border min-h-[44px] cursor-pointer rounded-ui bg-transparent px-[0.7rem] py-[0.45rem] text-subtext-0 no-underline [border:0] [font-family:inherit] [font-weight:inherit] [line-height:inherit] text-[0.85rem] hover:bg-surface-1 hover:text-fg focus-visible:[outline:2px_solid_var(--accent)] focus-visible:[outline-offset:2px] disabled:cursor-default disabled:opacity-[0.55]", Zb = "m-0 mt-[0.4rem] text-[0.78rem] text-subtext-0", Jb = "m-0 mb-2 text-[0.82rem] text-subtext-0", om = "rounded-ui bg-surface-1 text-fg [font-family:inherit]", Ss = `${om} px-2 py-[0.3rem] text-[0.8rem] max-[700px]:min-h-11 focus:[outline:1px_solid_var(--accent)]`, Wb = `${Ss} min-w-[5.5rem] shrink-0`, Es = `${om} min-w-0 px-[0.55rem] py-[0.35rem] text-[0.82rem] max-[700px]:min-h-11 focus:[outline:1px_solid_var(--accent)]`, Fb = `${Es} flex-1 max-[700px]:flex-[1_1_100%]`, Ib = `${Es} w-20 flex-[0_0_5rem] max-[700px]:w-24 max-[700px]:flex-[1_1_6rem]`, $b = `${Es} flex-[1_1_100%]`, Pb = "flex flex-wrap items-center gap-[0.4rem]", tv = "m-0 mb-2 flex list-none flex-col gap-[0.3rem] p-0", ev = "flex items-center gap-2 max-[700px]:flex-wrap rounded-ui bg-surface-1 px-2 py-[0.35rem] text-[0.82rem]", nv = `settings-modal__host-row ${ev}`, av = "min-w-0 overflow-hidden font-semibold text-ellipsis whitespace-nowrap text-fg", lv = "min-w-0 flex-1 max-[700px]:basis-full overflow-hidden text-[0.78rem] text-ellipsis whitespace-nowrap text-subtext-0", sm = "shrink-0 cursor-pointer rounded-ui px-[0.7rem] py-[0.35rem] max-[700px]:min-h-11 text-[0.82rem] font-semibold text-panel-bg [border:none] [font-family:inherit] [transition:opacity_0.12s_ease] hover:opacity-[0.85]", iv = `${sm} bg-accent`, rv = `${sm} ml-auto bg-red`;
function cm({ open: n, size: l = 12, className: s }) {
  return /* @__PURE__ */ ft.jsx("svg", { className: s, width: l, height: l, viewBox: "0 0 12 12", fill: "none", stroke: "currentColor", strokeWidth: "1.3", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true", children: /* @__PURE__ */ ft.jsx("path", { d: n ? "M2.5 4.5 6 8l3.5-3.5" : "M4.5 2.5 8 6l-3.5 3.5" }) });
}
function ov(n) {
  return n.blocked && !n.stale ? "blocked" : n.status === "running" && !n.stale ? "working" : n.unseen ? "done" : "idle";
}
const us = {
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
function ds(n, l) {
  return !!n.parentSessionId && n.parentSessionId !== n.id && l.some((s) => s.id === n.parentSessionId);
}
function sv(n) {
  const l = /* @__PURE__ */ new Map();
  for (const s of n)
    ds(s, n) && l.set(s.parentSessionId, [...l.get(s.parentSessionId) ?? [], s]);
  return l.size ? n.filter((s) => !ds(s, n)).flatMap((s) => [s, ...l.get(s.id) ?? []]) : n;
}
const Di = 6, uf = 8;
function cv(n, l = {}) {
  const { minWidth: s = 220, align: r = "right", minSpaceAbove: o = 100 } = l, f = n.getBoundingClientRect(), m = window.innerWidth, d = window.innerHeight, p = r === "right" ? { right: Math.max(0, m - f.right) } : { left: Math.max(0, f.left) }, x = f.top - Di - uf, k = d - f.bottom - Di - uf;
  return x >= o ? {
    position: "fixed",
    bottom: d - f.top + Di,
    ...p,
    minWidth: s,
    maxHeight: Math.min(x, d * 0.75),
    overflowY: "auto"
  } : {
    position: "fixed",
    top: f.bottom + Di,
    ...p,
    minWidth: s,
    maxHeight: Math.min(k, d * 0.75),
    overflowY: "auto"
  };
}
function um(n, l, s, r) {
  Re(() => {
    if (!n) return;
    function o(m) {
      const d = m.target, p = s.current?.contains(d) ?? !1, x = r.current?.contains(d) ?? !1;
      !p && !x && l(!1);
    }
    function f(m) {
      m.key === "Escape" && l(!1);
    }
    return document.addEventListener("mousedown", o), document.addEventListener("keydown", f), () => {
      document.removeEventListener("mousedown", o), document.removeEventListener("keydown", f);
    };
  }, [n]);
}
function uv({ icon: n, fallback: l }) {
  const [s, r] = tt.useState(!1);
  return Re(() => r(!1), [n]), !n || s ? /* @__PURE__ */ ft.jsx(ft.Fragment, { children: l }) : /* @__PURE__ */ ft.jsx("img", { src: n, alt: "", width: 14, height: 14, className: "size-[14px] rounded-[2px] object-contain", referrerPolicy: "no-referrer", onError: () => r(!0) });
}
const dv = ["application/zip", "application/x-tar", "application/gzip"];
function fv(n) {
  const l = n ?? "";
  if (l.startsWith("image/")) return "image";
  if (l.startsWith("video/")) return "video";
  if (l.startsWith("audio/")) return "audio";
  if (l === "application/pdf") return "pdf";
  if (dv.includes(l)) return "archive";
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
const mv = 50 * 1024 * 1024, df = 1.25, pv = 0.05, hv = 16384, Bi = Ut(qa, "min-h-8 min-w-8 px-2 text-[0.75rem] max-[700px]:min-h-11 max-[700px]:min-w-11"), gv = { pdf: "PDF document", audio: "Audio", video: "Video" };
let bv = 0;
function vv(n) {
  return n < 1024 ? `${n} B` : n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
function yv(n, l, s) {
  const r = l ? Math.min(8, hv / Math.max(l.width, l.height)) : 1, o = s === "in" ? n * df : s === "out" ? n / df : 1;
  return Math.min(r, Math.max(Math.min(pv, r), o));
}
function xv(n, l) {
  return typeof n != "string" || !n.startsWith("/") ? null : `${n.replace(/\/+$/, "")}/${l.replace(/^\/+/, "")}`;
}
function wv({ media: n, workspaceId: l, metadata: s, onFail: r }) {
  const o = tt.useMemo(() => `media-${++bv}`, []), [f, m] = tt.useState(null), [d, p] = tt.useState("fit");
  Re(() => {
    let _ = !0;
    return n.open(o, { workspaceId: l, path: s.path, mediaType: s.mediaType ?? "", size: s.size }).then((y) => {
      _ && m(y ?? { width: 0, height: 0 });
    }, (y) => {
      _ && r(String(y?.message ?? y));
    }), () => {
      _ = !1, n.release(o);
    };
  }, [o]), Re(() => {
    n.setZoom(o, d === "fit" ? null : d);
  }, [o, d]);
  const x = f !== null && f.width > 0 && f.height > 0, k = () => d !== "fit" ? d : n.fitScale(o) ?? 1, S = (_) => p(yv(k(), f, _)), w = (_) => {
    if (!(_.metaKey || _.ctrlKey || _.altKey || !x)) {
      if (_.key === "+" || _.key === "=") S("in");
      else if (_.key === "-") S("out");
      else if (_.key === "0") S("actual");
      else return;
      _.preventDefault();
    }
  }, z = d === "fit" ? "Fit" : `${Math.round(d * 100)}%`;
  return tt.createElement(
    "div",
    { className: "flex min-h-0 min-w-0 flex-1 flex-col", "data-testid": "workspace-image-viewer" },
    tt.createElement(
      "div",
      { className: "flex shrink-0 flex-wrap items-center gap-1 px-3 py-1 text-[0.72rem] text-subtext-0", role: "toolbar", "aria-label": "Image view" },
      tt.createElement("button", { type: "button", className: Bi, "aria-label": "Zoom out", title: "Zoom out (-)", disabled: !x, onClick: () => S("out") }, "−"),
      tt.createElement("button", { type: "button", className: Bi, "aria-label": "Zoom in", title: "Zoom in (+)", disabled: !x, onClick: () => S("in") }, "+"),
      tt.createElement("button", { type: "button", className: Ut(Bi, d === "fit" && "text-fg"), "aria-pressed": d === "fit", onClick: () => p("fit") }, "Fit"),
      tt.createElement("button", { type: "button", className: Ut(Bi, d === 1 && "text-fg"), "aria-pressed": d === 1, title: "Actual size (0)", disabled: !x, onClick: () => S("actual") }, "100%"),
      tt.createElement("span", { role: "status", className: "px-1", "data-testid": "workspace-image-info" }, x ? `${f.width} × ${f.height} · ${z}` : "")
    ),
    tt.createElement("div", {
      className: "flex min-h-0 min-w-0 flex-1",
      tabIndex: 0,
      "aria-label": `${s.name} image. Plus and minus zoom, 0 shows actual size, arrow keys pan.`,
      onKeyDown: w
    }, f === null ? tt.createElement("span", { className: "m-auto text-[0.8rem] text-subtext-0", role: "status" }, "Loading…") : tt.createElement("div", { className: "relative min-h-0 min-w-0 flex-1", "data-perch-engine": "image", "data-perch-key": o, "data-testid": "workspace-file-image" }))
  );
}
function _v({ workspaceId: n, metadata: l, perch: s }) {
  const [r, o] = tt.useState(!1), f = s.mediaFile?.(n, l.path) ?? { root: null, extraction: null }, m = f.extraction, d = fv(l.mediaType), p = xv(f.root, l.path), x = p === null, k = d === "archive", S = d === "image" && l.size > mv, w = d !== void 0 && !k && !x && !S;
  let z = "Open this file in Quick Look or its default app.";
  x ? z = "Use your SSH tools to download this file. Perch will not open a remote path on this machine." : k && (z = "Extract into a new folder beside this archive. Existing files are never overwritten.");
  let _ = "No preview for this file type";
  x ? _ = "Remote media is not available yet" : k ? _ = "Compressed archive" : S ? (_ = "Image too large to preview", z = `This image is ${Math.round(l.size / 1048576)} MB. Open it in Quick Look or its default app.`) : r && (_ = "Preview unavailable", d === "image" && (z = "The image may be corrupt or in a format Perch cannot decode. Open it in Quick Look or its default app."));
  const y = (O) => {
    try {
      s.media[O](p);
    } catch (R) {
      console.error(`perch-media ${O}: ${R?.message ?? R}`);
    }
  }, N = d === "pdf" || d === "audio" || d === "video";
  return tt.createElement(
    "section",
    { className: "flex min-h-0 min-w-0 flex-1 flex-col", "aria-label": `Previewing ${l.path}`, "data-testid": "workspace-file-asset" },
    tt.createElement(
      "header",
      { className: "flex shrink-0 flex-wrap items-center gap-2 px-3 py-2 text-[0.75rem]" },
      tt.createElement("strong", { className: "min-w-0 flex-1 truncate", title: l.path }, l.path),
      k && tt.createElement(
        "button",
        { type: "button", className: Ut(qa, "min-h-8 px-2"), disabled: m?.state === "loading", onClick: () => s.command("files.extract", { workspaceId: n, path: l.path }) },
        m?.state === "loading" ? "Extracting…" : "Extract"
      ),
      !x && tt.createElement("button", { type: "button", className: Ut(qa, "min-h-8 px-2"), onClick: () => y("quickLook") }, "Quick Look"),
      !x && tt.createElement("button", { type: "button", className: Ut(qa, "min-h-8 px-2"), onClick: () => y("openDefault") }, "Open with Default App")
    ),
    m?.state === "ready" && tt.createElement("p", { role: "status", className: "m-0 px-3 py-2 text-[0.75rem] text-subtext-0" }, `Extracted to ${m.destination}. Find it in the file tree.`),
    m?.state === "error" && tt.createElement("p", { role: "alert", className: "m-0 px-3 py-2 text-[0.75rem] text-red" }, m.error),
    !w || r ? tt.createElement(
      "div",
      { className: "grid flex-1 content-center justify-items-center gap-2 p-5 text-center text-[0.8rem] text-subtext-0" },
      tt.createElement("strong", { className: "text-fg" }, _),
      tt.createElement("span", null, z)
    ) : d === "image" ? tt.createElement(wv, { media: s.media, workspaceId: n, metadata: l, onFail: () => o(!0) }) : N && tt.createElement(
      "div",
      { className: "grid flex-1 content-center justify-items-center gap-2 p-5 text-center text-[0.8rem] text-subtext-0", "data-testid": "workspace-file-card" },
      tt.createElement("strong", { className: "text-fg" }, l.name),
      tt.createElement("span", null, `${gv[d]} · ${vv(l.size)}`),
      tt.createElement("span", null, "Perch does not play or render this file. Open it in Quick Look or its default app.")
    )
  );
}
const kv = "mode-switch group ml-auto flex items-center gap-[0.4rem] bg-transparent p-[0.2rem] [border:none] [font-family:inherit]", dm = "text-[0.72rem] font-semibold tracking-[0.03em] text-overlay-1 uppercase [transition:color_0.15s_ease]", Sv = `${dm} group-aria-[checked=false]:text-accent`, Ev = `${dm} group-aria-checked:text-accent`, zv = "relative h-[1.3rem] w-[2.4rem] shrink-0 rounded-[999px] border border-overlay-0 bg-surface-1 [transition:background_0.15s_ease] group-aria-checked:border-accent group-aria-checked:bg-panel-bg", Nv = "absolute top-px left-px h-[1.1rem] w-[1.1rem] rounded-[50%] bg-fg [box-shadow:0_1px_2px_rgba(0,0,0,0.3)] [transition:transform_0.15s_ease,background_0.15s_ease] group-aria-checked:bg-accent group-aria-checked:[transform:translateX(1.1rem)]";
function Tv({
  mode: n,
  onChange: l,
  testId: s = "mode-switch",
  disabled: r = !1
}) {
  const o = n === "cli";
  return /* @__PURE__ */ ft.jsxs(
    "button",
    {
      type: "button",
      className: kv,
      "data-testid": s,
      role: "switch",
      "aria-checked": o,
      "aria-label": "Toggle UI / CLI mode",
      disabled: r,
      onClick: () => l(o ? "ui" : "cli"),
      children: [
        /* @__PURE__ */ ft.jsx("span", { className: Ut("mode-switch__label mode-switch__label--ui", Sv), children: "UI" }),
        /* @__PURE__ */ ft.jsx("span", { className: Ut("mode-switch__track", zv), children: /* @__PURE__ */ ft.jsx("span", { className: Ut("mode-switch__thumb", Nv) }) }),
        /* @__PURE__ */ ft.jsx("span", { className: Ut("mode-switch__label mode-switch__label--cli", Ev), children: "CLI" })
      ]
    }
  );
}
const Ga = function(n, l) {
  let o = n;
  const f = _l[l];
  let m = null, d = 0, p = null;
  const x = [], k = {}, S = function(g, v) {
    d = o * 4 + 17, m = (function(h) {
      const E = new Array(h);
      for (let M = 0; M < h; M += 1) {
        E[M] = new Array(h);
        for (let B = 0; B < h; B += 1)
          E[M][B] = null;
      }
      return E;
    })(d), w(0, 0), w(d - 7, 0), w(0, d - 7), y(), _(), O(g, v), o >= 7 && N(g), p == null && (p = L(o, f, x)), R(p, v);
  }, w = function(g, v) {
    for (let h = -1; h <= 7; h += 1)
      if (!(g + h <= -1 || d <= g + h))
        for (let E = -1; E <= 7; E += 1)
          v + E <= -1 || d <= v + E || (0 <= h && h <= 6 && (E == 0 || E == 6) || 0 <= E && E <= 6 && (h == 0 || h == 6) || 2 <= h && h <= 4 && 2 <= E && E <= 4 ? m[g + h][v + E] = !0 : m[g + h][v + E] = !1);
  }, z = function() {
    let g = 0, v = 0;
    for (let h = 0; h < 8; h += 1) {
      S(!0, h);
      const E = Bn.getLostPoint(k);
      (h == 0 || g > E) && (g = E, v = h);
    }
    return v;
  }, _ = function() {
    for (let g = 8; g < d - 8; g += 1)
      m[g][6] == null && (m[g][6] = g % 2 == 0);
    for (let g = 8; g < d - 8; g += 1)
      m[6][g] == null && (m[6][g] = g % 2 == 0);
  }, y = function() {
    const g = Bn.getPatternPosition(o);
    for (let v = 0; v < g.length; v += 1)
      for (let h = 0; h < g.length; h += 1) {
        const E = g[v], M = g[h];
        if (m[E][M] == null)
          for (let B = -2; B <= 2; B += 1)
            for (let X = -2; X <= 2; X += 1)
              B == -2 || B == 2 || X == -2 || X == 2 || B == 0 && X == 0 ? m[E + B][M + X] = !0 : m[E + B][M + X] = !1;
      }
  }, N = function(g) {
    const v = Bn.getBCHTypeNumber(o);
    for (let h = 0; h < 18; h += 1) {
      const E = !g && (v >> h & 1) == 1;
      m[Math.floor(h / 3)][h % 3 + d - 8 - 3] = E;
    }
    for (let h = 0; h < 18; h += 1) {
      const E = !g && (v >> h & 1) == 1;
      m[h % 3 + d - 8 - 3][Math.floor(h / 3)] = E;
    }
  }, O = function(g, v) {
    const h = f << 3 | v, E = Bn.getBCHTypeInfo(h);
    for (let M = 0; M < 15; M += 1) {
      const B = !g && (E >> M & 1) == 1;
      M < 6 ? m[M][8] = B : M < 8 ? m[M + 1][8] = B : m[d - 15 + M][8] = B;
    }
    for (let M = 0; M < 15; M += 1) {
      const B = !g && (E >> M & 1) == 1;
      M < 8 ? m[8][d - M - 1] = B : M < 9 ? m[8][15 - M - 1 + 1] = B : m[8][15 - M - 1] = B;
    }
    m[d - 8][8] = !g;
  }, R = function(g, v) {
    let h = -1, E = d - 1, M = 7, B = 0;
    const X = Bn.getMaskFunction(v);
    for (let I = d - 1; I > 0; I -= 2)
      for (I == 6 && (I -= 1); ; ) {
        for (let $ = 0; $ < 2; $ += 1)
          if (m[E][I - $] == null) {
            let Q = !1;
            B < g.length && (Q = (g[B] >>> M & 1) == 1), X(E, I - $) && (Q = !Q), m[E][I - $] = Q, M -= 1, M == -1 && (B += 1, M = 7);
          }
        if (E += h, E < 0 || d <= E) {
          E -= h, h = -h;
          break;
        }
      }
  }, A = function(g, v) {
    let h = 0, E = 0, M = 0;
    const B = new Array(v.length), X = new Array(v.length);
    for (let Z = 0; Z < v.length; Z += 1) {
      const P = v[Z].dataCount, G = v[Z].totalCount - P;
      E = Math.max(E, P), M = Math.max(M, G), B[Z] = new Array(P);
      for (let nt = 0; nt < B[Z].length; nt += 1)
        B[Z][nt] = 255 & g.getBuffer()[nt + h];
      h += P;
      const K = Bn.getErrorCorrectPolynomial(G), V = Nl(B[Z], K.getLength() - 1).mod(K);
      X[Z] = new Array(K.getLength() - 1);
      for (let nt = 0; nt < X[Z].length; nt += 1) {
        const ot = nt + V.getLength() - X[Z].length;
        X[Z][nt] = ot >= 0 ? V.getAt(ot) : 0;
      }
    }
    let I = 0;
    for (let Z = 0; Z < v.length; Z += 1)
      I += v[Z].totalCount;
    const $ = new Array(I);
    let Q = 0;
    for (let Z = 0; Z < E; Z += 1)
      for (let P = 0; P < v.length; P += 1)
        Z < B[P].length && ($[Q] = B[P][Z], Q += 1);
    for (let Z = 0; Z < M; Z += 1)
      for (let P = 0; P < v.length; P += 1)
        Z < X[P].length && ($[Q] = X[P][Z], Q += 1);
    return $;
  }, L = function(g, v, h) {
    const E = ff.getRSBlocks(g, v), M = mf();
    for (let X = 0; X < h.length; X += 1) {
      const I = h[X];
      M.put(I.getMode(), 4), M.put(I.getLength(), Bn.getLengthInBits(I.getMode(), g)), I.write(M);
    }
    let B = 0;
    for (let X = 0; X < E.length; X += 1)
      B += E[X].dataCount;
    if (M.getLengthInBits() > B * 8)
      throw "code length overflow. (" + M.getLengthInBits() + ">" + B * 8 + ")";
    for (M.getLengthInBits() + 4 <= B * 8 && M.put(0, 4); M.getLengthInBits() % 8 != 0; )
      M.putBit(!1);
    for (; !(M.getLengthInBits() >= B * 8 || (M.put(236, 8), M.getLengthInBits() >= B * 8)); )
      M.put(17, 8);
    return A(M, E);
  };
  k.addData = function(g, v) {
    v = v || "Byte";
    let h = null;
    switch (v) {
      case "Numeric":
        h = Cv(g);
        break;
      case "Alphanumeric":
        h = Mv(g);
        break;
      case "Byte":
        h = Av(g);
        break;
      case "Kanji":
        h = jv(g);
        break;
      default:
        throw "mode:" + v;
    }
    x.push(h), p = null;
  }, k.isDark = function(g, v) {
    if (g < 0 || d <= g || v < 0 || d <= v)
      throw g + "," + v;
    return m[g][v];
  }, k.getModuleCount = function() {
    return d;
  }, k.make = function() {
    if (o < 1) {
      let g = 1;
      for (; g < 40; g++) {
        const v = ff.getRSBlocks(g, f), h = mf();
        for (let M = 0; M < x.length; M++) {
          const B = x[M];
          h.put(B.getMode(), 4), h.put(B.getLength(), Bn.getLengthInBits(B.getMode(), g)), B.write(h);
        }
        let E = 0;
        for (let M = 0; M < v.length; M++)
          E += v[M].dataCount;
        if (h.getLengthInBits() <= E * 8)
          break;
      }
      o = g;
    }
    S(!1, z());
  }, k.createTableTag = function(g, v) {
    g = g || 2, v = typeof v > "u" ? g * 4 : v;
    let h = "";
    h += '<table style="', h += " border-width: 0px; border-style: none;", h += " border-collapse: collapse;", h += " padding: 0px; margin: " + v + "px;", h += '">', h += "<tbody>";
    for (let E = 0; E < k.getModuleCount(); E += 1) {
      h += "<tr>";
      for (let M = 0; M < k.getModuleCount(); M += 1)
        h += '<td style="', h += " border-width: 0px; border-style: none;", h += " border-collapse: collapse;", h += " padding: 0px; margin: 0px;", h += " width: " + g + "px;", h += " height: " + g + "px;", h += " background-color: ", h += k.isDark(E, M) ? "#000000" : "#ffffff", h += ";", h += '"/>';
      h += "</tr>";
    }
    return h += "</tbody>", h += "</table>", h;
  }, k.createSvgTag = function(g, v, h, E) {
    let M = {};
    typeof arguments[0] == "object" && (M = arguments[0], g = M.cellSize, v = M.margin, h = M.alt, E = M.title), g = g || 2, v = typeof v > "u" ? g * 4 : v, h = typeof h == "string" ? { text: h } : h || {}, h.text = h.text || null, h.id = h.text ? h.id || "qrcode-description" : null, E = typeof E == "string" ? { text: E } : E || {}, E.text = E.text || null, E.id = E.text ? E.id || "qrcode-title" : null;
    const B = k.getModuleCount() * g + v * 2;
    let X, I, $, Q, Z = "", P;
    for (P = "l" + g + ",0 0," + g + " -" + g + ",0 0,-" + g + "z ", Z += '<svg version="1.1" xmlns="http://www.w3.org/2000/svg"', Z += M.scalable ? "" : ' width="' + B + 'px" height="' + B + 'px"', Z += ' viewBox="0 0 ' + B + " " + B + '" ', Z += ' preserveAspectRatio="xMinYMin meet"', Z += E.text || h.text ? ' role="img" aria-labelledby="' + q([E.id, h.id].join(" ").trim()) + '"' : "", Z += ">", Z += E.text ? '<title id="' + q(E.id) + '">' + q(E.text) + "</title>" : "", Z += h.text ? '<description id="' + q(h.id) + '">' + q(h.text) + "</description>" : "", Z += '<rect width="100%" height="100%" fill="white" cx="0" cy="0"/>', Z += '<path d="', $ = 0; $ < k.getModuleCount(); $ += 1)
      for (Q = $ * g + v, X = 0; X < k.getModuleCount(); X += 1)
        k.isDark($, X) && (I = X * g + v, Z += "M" + I + "," + Q + P);
    return Z += '" stroke="transparent" fill="black"/>', Z += "</svg>", Z;
  }, k.createDataURL = function(g, v) {
    g = g || 2, v = typeof v > "u" ? g * 4 : v;
    const h = k.getModuleCount() * g + v * 2, E = v, M = h - v;
    return Bv(h, h, function(B, X) {
      if (E <= B && B < M && E <= X && X < M) {
        const I = Math.floor((B - E) / g), $ = Math.floor((X - E) / g);
        return k.isDark($, I) ? 0 : 1;
      } else
        return 1;
    });
  }, k.createImgTag = function(g, v, h) {
    g = g || 2, v = typeof v > "u" ? g * 4 : v;
    const E = k.getModuleCount() * g + v * 2;
    let M = "";
    return M += "<img", M += ' src="', M += k.createDataURL(g, v), M += '"', M += ' width="', M += E, M += '"', M += ' height="', M += E, M += '"', h && (M += ' alt="', M += q(h), M += '"'), M += "/>", M;
  };
  const q = function(g) {
    let v = "";
    for (let h = 0; h < g.length; h += 1) {
      const E = g.charAt(h);
      switch (E) {
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
          v += E;
          break;
      }
    }
    return v;
  }, D = function(g) {
    g = typeof g > "u" ? 2 : g;
    const h = k.getModuleCount() * 1 + g * 2, E = g, M = h - g;
    let B, X, I, $, Q;
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
      for (I = Math.floor((B - E) / 1), $ = Math.floor((B + 1 - E) / 1), X = 0; X < h; X += 1)
        Q = "█", E <= X && X < M && E <= B && B < M && k.isDark(I, Math.floor((X - E) / 1)) && (Q = " "), E <= X && X < M && E <= B + 1 && B + 1 < M && k.isDark($, Math.floor((X - E) / 1)) ? Q += " " : Q += "█", G += g < 1 && B + 1 >= M ? P[Q] : Z[Q];
      G += `
`;
    }
    return h % 2 && g > 0 ? G.substring(0, G.length - h - 1) + Array(h + 1).join("▀") : G.substring(0, G.length - 1);
  };
  return k.createASCII = function(g, v) {
    if (g = g || 1, g < 2)
      return D(v);
    g -= 1, v = typeof v > "u" ? g * 2 : v;
    const h = k.getModuleCount() * g + v * 2, E = v, M = h - v;
    let B, X, I, $;
    const Q = Array(g + 1).join("██"), Z = Array(g + 1).join("  ");
    let P = "", G = "";
    for (B = 0; B < h; B += 1) {
      for (I = Math.floor((B - E) / g), G = "", X = 0; X < h; X += 1)
        $ = 1, E <= X && X < M && E <= B && B < M && k.isDark(I, Math.floor((X - E) / g)) && ($ = 0), G += $ ? Q : Z;
      for (I = 0; I < g; I += 1)
        P += G + `
`;
    }
    return P.substring(0, P.length - 1);
  }, k.renderTo2dContext = function(g, v) {
    v = v || 2;
    const h = k.getModuleCount();
    for (let E = 0; E < h; E++)
      for (let M = 0; M < h; M++)
        g.fillStyle = k.isDark(E, M) ? "black" : "white", g.fillRect(M * v, E * v, v, v);
  }, k;
};
Ga.stringToBytes = function(n) {
  const l = [];
  for (let s = 0; s < n.length; s += 1) {
    const r = n.charCodeAt(s);
    l.push(r & 255);
  }
  return l;
};
Ga.createStringToBytes = function(n, l) {
  const s = (function() {
    const o = Rv(n), f = function() {
      const p = o.read();
      if (p == -1) throw "eof";
      return p;
    };
    let m = 0;
    const d = {};
    for (; ; ) {
      const p = o.read();
      if (p == -1) break;
      const x = f(), k = f(), S = f(), w = String.fromCharCode(p << 8 | x), z = k << 8 | S;
      d[w] = z, m += 1;
    }
    if (m != l)
      throw m + " != " + l;
    return d;
  })(), r = 63;
  return function(o) {
    const f = [];
    for (let m = 0; m < o.length; m += 1) {
      const d = o.charCodeAt(m);
      if (d < 128)
        f.push(d);
      else {
        const p = s[o.charAt(m)];
        typeof p == "number" ? (p & 255) == p ? f.push(p) : (f.push(p >>> 8), f.push(p & 255)) : f.push(r);
      }
    }
    return f;
  };
};
const ue = {
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
  ], l = 1335, s = 7973, r = 21522, o = {}, f = function(m) {
    let d = 0;
    for (; m != 0; )
      d += 1, m >>>= 1;
    return d;
  };
  return o.getBCHTypeInfo = function(m) {
    let d = m << 10;
    for (; f(d) - f(l) >= 0; )
      d ^= l << f(d) - f(l);
    return (m << 10 | d) ^ r;
  }, o.getBCHTypeNumber = function(m) {
    let d = m << 12;
    for (; f(d) - f(s) >= 0; )
      d ^= s << f(d) - f(s);
    return m << 12 | d;
  }, o.getPatternPosition = function(m) {
    return n[m - 1];
  }, o.getMaskFunction = function(m) {
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
  }, o.getErrorCorrectPolynomial = function(m) {
    let d = Nl([1], 0);
    for (let p = 0; p < m; p += 1)
      d = d.multiply(Nl([1, Un.gexp(p)], 0));
    return d;
  }, o.getLengthInBits = function(m, d) {
    if (1 <= d && d < 10)
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
    else if (d < 27)
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
    else if (d < 41)
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
      throw "type:" + d;
  }, o.getLostPoint = function(m) {
    const d = m.getModuleCount();
    let p = 0;
    for (let S = 0; S < d; S += 1)
      for (let w = 0; w < d; w += 1) {
        let z = 0;
        const _ = m.isDark(S, w);
        for (let y = -1; y <= 1; y += 1)
          if (!(S + y < 0 || d <= S + y))
            for (let N = -1; N <= 1; N += 1)
              w + N < 0 || d <= w + N || y == 0 && N == 0 || _ == m.isDark(S + y, w + N) && (z += 1);
        z > 5 && (p += 3 + z - 5);
      }
    for (let S = 0; S < d - 1; S += 1)
      for (let w = 0; w < d - 1; w += 1) {
        let z = 0;
        m.isDark(S, w) && (z += 1), m.isDark(S + 1, w) && (z += 1), m.isDark(S, w + 1) && (z += 1), m.isDark(S + 1, w + 1) && (z += 1), (z == 0 || z == 4) && (p += 3);
      }
    for (let S = 0; S < d; S += 1)
      for (let w = 0; w < d - 6; w += 1)
        m.isDark(S, w) && !m.isDark(S, w + 1) && m.isDark(S, w + 2) && m.isDark(S, w + 3) && m.isDark(S, w + 4) && !m.isDark(S, w + 5) && m.isDark(S, w + 6) && (p += 40);
    for (let S = 0; S < d; S += 1)
      for (let w = 0; w < d - 6; w += 1)
        m.isDark(w, S) && !m.isDark(w + 1, S) && m.isDark(w + 2, S) && m.isDark(w + 3, S) && m.isDark(w + 4, S) && !m.isDark(w + 5, S) && m.isDark(w + 6, S) && (p += 40);
    let x = 0;
    for (let S = 0; S < d; S += 1)
      for (let w = 0; w < d; w += 1)
        m.isDark(w, S) && (x += 1);
    const k = Math.abs(100 * x / d / d - 50) / 5;
    return p += k * 10, p;
  }, o;
})(), Un = (function() {
  const n = new Array(256), l = new Array(256);
  for (let r = 0; r < 8; r += 1)
    n[r] = 1 << r;
  for (let r = 8; r < 256; r += 1)
    n[r] = n[r - 4] ^ n[r - 5] ^ n[r - 6] ^ n[r - 8];
  for (let r = 0; r < 255; r += 1)
    l[n[r]] = r;
  const s = {};
  return s.glog = function(r) {
    if (r < 1)
      throw "glog(" + r + ")";
    return l[r];
  }, s.gexp = function(r) {
    for (; r < 0; )
      r += 255;
    for (; r >= 256; )
      r -= 255;
    return n[r];
  }, s;
})(), Nl = function(n, l) {
  if (typeof n.length > "u")
    throw n.length + "/" + l;
  const s = (function() {
    let o = 0;
    for (; o < n.length && n[o] == 0; )
      o += 1;
    const f = new Array(n.length - o + l);
    for (let m = 0; m < n.length - o; m += 1)
      f[m] = n[m + o];
    return f;
  })(), r = {};
  return r.getAt = function(o) {
    return s[o];
  }, r.getLength = function() {
    return s.length;
  }, r.multiply = function(o) {
    const f = new Array(r.getLength() + o.getLength() - 1);
    for (let m = 0; m < r.getLength(); m += 1)
      for (let d = 0; d < o.getLength(); d += 1)
        f[m + d] ^= Un.gexp(Un.glog(r.getAt(m)) + Un.glog(o.getAt(d)));
    return Nl(f, 0);
  }, r.mod = function(o) {
    if (r.getLength() - o.getLength() < 0)
      return r;
    const f = Un.glog(r.getAt(0)) - Un.glog(o.getAt(0)), m = new Array(r.getLength());
    for (let d = 0; d < r.getLength(); d += 1)
      m[d] = r.getAt(d);
    for (let d = 0; d < o.getLength(); d += 1)
      m[d] ^= Un.gexp(Un.glog(o.getAt(d)) + f);
    return Nl(m, 0).mod(o);
  }, r;
}, ff = (function() {
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
  ], l = function(o, f) {
    const m = {};
    return m.totalCount = o, m.dataCount = f, m;
  }, s = {}, r = function(o, f) {
    switch (f) {
      case _l.L:
        return n[(o - 1) * 4 + 0];
      case _l.M:
        return n[(o - 1) * 4 + 1];
      case _l.Q:
        return n[(o - 1) * 4 + 2];
      case _l.H:
        return n[(o - 1) * 4 + 3];
      default:
        return;
    }
  };
  return s.getRSBlocks = function(o, f) {
    const m = r(o, f);
    if (typeof m > "u")
      throw "bad rs block @ typeNumber:" + o + "/errorCorrectionLevel:" + f;
    const d = m.length / 3, p = [];
    for (let x = 0; x < d; x += 1) {
      const k = m[x * 3 + 0], S = m[x * 3 + 1], w = m[x * 3 + 2];
      for (let z = 0; z < k; z += 1)
        p.push(l(S, w));
    }
    return p;
  }, s;
})(), mf = function() {
  const n = [];
  let l = 0;
  const s = {};
  return s.getBuffer = function() {
    return n;
  }, s.getAt = function(r) {
    const o = Math.floor(r / 8);
    return (n[o] >>> 7 - r % 8 & 1) == 1;
  }, s.put = function(r, o) {
    for (let f = 0; f < o; f += 1)
      s.putBit((r >>> o - f - 1 & 1) == 1);
  }, s.getLengthInBits = function() {
    return l;
  }, s.putBit = function(r) {
    const o = Math.floor(l / 8);
    n.length <= o && n.push(0), r && (n[o] |= 128 >>> l % 8), l += 1;
  }, s;
}, Cv = function(n) {
  const l = ue.MODE_NUMBER, s = n, r = {};
  r.getMode = function() {
    return l;
  }, r.getLength = function(m) {
    return s.length;
  }, r.write = function(m) {
    const d = s;
    let p = 0;
    for (; p + 2 < d.length; )
      m.put(o(d.substring(p, p + 3)), 10), p += 3;
    p < d.length && (d.length - p == 1 ? m.put(o(d.substring(p, p + 1)), 4) : d.length - p == 2 && m.put(o(d.substring(p, p + 2)), 7));
  };
  const o = function(m) {
    let d = 0;
    for (let p = 0; p < m.length; p += 1)
      d = d * 10 + f(m.charAt(p));
    return d;
  }, f = function(m) {
    if ("0" <= m && m <= "9")
      return m.charCodeAt(0) - 48;
    throw "illegal char :" + m;
  };
  return r;
}, Mv = function(n) {
  const l = ue.MODE_ALPHA_NUM, s = n, r = {};
  r.getMode = function() {
    return l;
  }, r.getLength = function(f) {
    return s.length;
  }, r.write = function(f) {
    const m = s;
    let d = 0;
    for (; d + 1 < m.length; )
      f.put(
        o(m.charAt(d)) * 45 + o(m.charAt(d + 1)),
        11
      ), d += 2;
    d < m.length && f.put(o(m.charAt(d)), 6);
  };
  const o = function(f) {
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
  return r;
}, Av = function(n) {
  const l = ue.MODE_8BIT_BYTE, s = Ga.stringToBytes(n), r = {};
  return r.getMode = function() {
    return l;
  }, r.getLength = function(o) {
    return s.length;
  }, r.write = function(o) {
    for (let f = 0; f < s.length; f += 1)
      o.put(s[f], 8);
  }, r;
}, jv = function(n) {
  const l = ue.MODE_KANJI, s = Ga.stringToBytes;
  (function(f, m) {
    const d = s(f);
    if (d.length != 2 || (d[0] << 8 | d[1]) != m)
      throw "sjis not supported.";
  })("友", 38726);
  const r = s(n), o = {};
  return o.getMode = function() {
    return l;
  }, o.getLength = function(f) {
    return ~~(r.length / 2);
  }, o.write = function(f) {
    const m = r;
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
  }, o;
}, fm = function() {
  const n = [], l = {};
  return l.writeByte = function(s) {
    n.push(s & 255);
  }, l.writeShort = function(s) {
    l.writeByte(s), l.writeByte(s >>> 8);
  }, l.writeBytes = function(s, r, o) {
    r = r || 0, o = o || s.length;
    for (let f = 0; f < o; f += 1)
      l.writeByte(s[f + r]);
  }, l.writeString = function(s) {
    for (let r = 0; r < s.length; r += 1)
      l.writeByte(s.charCodeAt(r));
  }, l.toByteArray = function() {
    return n;
  }, l.toString = function() {
    let s = "";
    s += "[";
    for (let r = 0; r < n.length; r += 1)
      r > 0 && (s += ","), s += n[r];
    return s += "]", s;
  }, l;
}, Ov = function() {
  let n = 0, l = 0, s = 0, r = "";
  const o = {}, f = function(d) {
    r += String.fromCharCode(m(d & 63));
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
  return o.writeByte = function(d) {
    for (n = n << 8 | d & 255, l += 8, s += 1; l >= 6; )
      f(n >>> l - 6), l -= 6;
  }, o.flush = function() {
    if (l > 0 && (f(n << 6 - l), n = 0, l = 0), s % 3 != 0) {
      const d = 3 - s % 3;
      for (let p = 0; p < d; p += 1)
        r += "=";
    }
  }, o.toString = function() {
    return r;
  }, o;
}, Rv = function(n) {
  const l = n;
  let s = 0, r = 0, o = 0;
  const f = {};
  f.read = function() {
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
      r = r << 6 | m(p.charCodeAt(0)), o += 6;
    }
    const d = r >>> o - 8 & 255;
    return o -= 8, d;
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
}, Dv = function(n, l) {
  const s = n, r = l, o = new Array(n * l), f = {};
  f.setPixel = function(x, k, S) {
    o[k * s + x] = S;
  }, f.write = function(x) {
    x.writeString("GIF87a"), x.writeShort(s), x.writeShort(r), x.writeByte(128), x.writeByte(0), x.writeByte(0), x.writeByte(0), x.writeByte(0), x.writeByte(0), x.writeByte(255), x.writeByte(255), x.writeByte(255), x.writeString(","), x.writeShort(0), x.writeShort(0), x.writeShort(s), x.writeShort(r), x.writeByte(0);
    const k = 2, S = d(k);
    x.writeByte(k);
    let w = 0;
    for (; S.length - w > 255; )
      x.writeByte(255), x.writeBytes(S, w, 255), w += 255;
    x.writeByte(S.length - w), x.writeBytes(S, w, S.length - w), x.writeByte(0), x.writeString(";");
  };
  const m = function(x) {
    const k = x;
    let S = 0, w = 0;
    const z = {};
    return z.write = function(_, y) {
      if (_ >>> y)
        throw "length over";
      for (; S + y >= 8; )
        k.writeByte(255 & (_ << S | w)), y -= 8 - S, _ >>>= 8 - S, w = 0, S = 0;
      w = _ << S | w, S = S + y;
    }, z.flush = function() {
      S > 0 && k.writeByte(w);
    }, z;
  }, d = function(x) {
    const k = 1 << x, S = (1 << x) + 1;
    let w = x + 1;
    const z = p();
    for (let R = 0; R < k; R += 1)
      z.add(String.fromCharCode(R));
    z.add(String.fromCharCode(k)), z.add(String.fromCharCode(S));
    const _ = fm(), y = m(_);
    y.write(k, w);
    let N = 0, O = String.fromCharCode(o[N]);
    for (N += 1; N < o.length; ) {
      const R = String.fromCharCode(o[N]);
      N += 1, z.contains(O + R) ? O = O + R : (y.write(z.indexOf(O), w), z.size() < 4095 && (z.size() == 1 << w && (w += 1), z.add(O + R)), O = R);
    }
    return y.write(z.indexOf(O), w), y.write(S, w), y.flush(), _.toByteArray();
  }, p = function() {
    const x = {};
    let k = 0;
    const S = {};
    return S.add = function(w) {
      if (S.contains(w))
        throw "dup key:" + w;
      x[w] = k, k += 1;
    }, S.size = function() {
      return k;
    }, S.indexOf = function(w) {
      return x[w];
    }, S.contains = function(w) {
      return typeof x[w] < "u";
    }, S;
  };
  return f;
}, Bv = function(n, l, s) {
  const r = Dv(n, l);
  for (let d = 0; d < l; d += 1)
    for (let p = 0; p < n; p += 1)
      r.setPixel(p, d, s(p, d));
  const o = fm();
  r.write(o);
  const f = Ov(), m = o.toByteArray();
  for (let d = 0; d < m.length; d += 1)
    f.writeByte(m[d]);
  return f.flush(), "data:image/gif;base64," + f;
};
Ga.stringToBytes;
function Hv({ text: n }) {
  const { size: l, path: s } = tt.useMemo(() => {
    const r = Ga(0, "M");
    r.addData(n), r.make();
    const o = r.getModuleCount();
    let f = "";
    for (let m = 0; m < o; m++)
      for (let d = 0; d < o; d++) r.isDark(m, d) && (f += `M${d} ${m}h1v1h-1z`);
    return { size: o, path: f };
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
        /* @__PURE__ */ ft.jsx("path", { d: s, fill: "#000" })
      ]
    }
  );
}
const Tl = tt.createContext(""), fs = (n, l) => typeof n == "string" && n.toLowerCase().includes(l);
function Uv({ title: n, children: l, testId: s, ariaLabel: r }) {
  const o = tt.useContext(Tl), f = o !== "" && fs(n, o);
  return (
    // While searching, a group with no matching row (and no matching title) hides itself.
    /* @__PURE__ */ ft.jsxs("section", { className: o && !f ? "mb-8 not-has-[[data-setting-row]]:hidden" : "mb-8", "data-testid": s, "aria-label": r, children: [
      n && /* @__PURE__ */ ft.jsx("h3", { className: "m-0 mb-3 text-[0.9rem] font-medium text-fg", children: n }),
      /* @__PURE__ */ ft.jsx("div", { className: "rounded-ui bg-surface-0 px-4", children: /* @__PURE__ */ ft.jsx(Tl.Provider, { value: f ? "" : o, children: l }) })
    ] })
  );
}
function qv({ title: n, description: l, children: s, testId: r }) {
  const o = tt.useContext(Tl);
  return o && !fs(n, o) && !fs(l, o) ? null : /* @__PURE__ */ ft.jsxs("div", { "data-setting-row": !0, "data-testid": r, className: "flex items-center justify-between gap-6 py-[0.8rem] max-[700px]:flex-wrap max-[700px]:gap-y-2", children: [
    /* @__PURE__ */ ft.jsxs("div", { className: "min-w-0 max-[700px]:flex-1 max-[700px]:basis-56", children: [
      /* @__PURE__ */ ft.jsx("div", { className: "text-[0.85rem] text-fg", children: n }),
      l && /* @__PURE__ */ ft.jsx("div", { className: "mt-[0.15rem] text-[0.75rem] text-subtext-0", children: l })
    ] }),
    s && /* @__PURE__ */ ft.jsx("div", { className: "flex shrink-0 items-center gap-2", children: s })
  ] });
}
function Yv({ checked: n, onChange: l, testId: s, label: r }) {
  return /* @__PURE__ */ ft.jsx(
    "input",
    {
      type: "checkbox",
      role: "switch",
      "aria-label": r,
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
const Gv = () => tt.useContext(Tl), Kv = {
  select: Ss,
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
  primary: iv,
  danger: rv,
  catalogToggle: Xb
};
//! State the host keeps for a resource rather than for one view of it (`useResourceState`, `@perch/sdk` 1.4): a
//! review's unsent commit message and comment, its pending batch and its operation id, keyed by the screen's
//! own name for the resource (`review:<workspace>:commit`). Every view and copy that names the same key shares the
//! value, and it outlives a reload or swap of the screen's code, a released hidden copy and the phone/desktop
//! layouts trading places. In memory: a page reload starts empty (durable drafts live in their own services).
const Qv = 512, Fe = /* @__PURE__ */ new Map(), Sl = /* @__PURE__ */ new Map();
function mm(n, l) {
  Fe.delete(n), Fe.set(n, l);
  for (const s of Fe.keys()) {
    if (Fe.size <= Qv) break;
    Sl.get(s)?.size || Fe.delete(s);
  }
}
function Vv(n, l) {
  return Fe.has(n) ? Fe.get(n) : l;
}
function Lv(n, l, s) {
  const r = Vv(n, s), o = typeof l == "function" ? l(r) : l;
  if (!(Fe.has(n) && Object.is(o, r))) {
    mm(n, o);
    for (const f of [...Sl.get(n) ?? []]) f();
  }
}
function Xv(n, l) {
  if (typeof n != "string" || !n) throw new Error("useResourceState needs a non-empty key.");
  Fe.has(n) || mm(n, l);
  const s = tt.useCallback((f) => {
    const m = Sl.get(n) ?? /* @__PURE__ */ new Set();
    return Sl.set(n, m), m.add(f), () => {
      m.delete(f), m.size || Sl.delete(n);
    };
  }, [n]), r = tt.useSyncExternalStore(s, () => Fe.get(n)), o = tt.useCallback((f) => Lv(n, f, l), [n]);
  return [r, o];
}
const Zv = "[--radius:var(--radius-pane)] rounded-soft bg-surface-1/70 shadow-[0_6px_20px_rgba(0,0,0,0.3)] backdrop-blur-xl backdrop-saturate-150", Jv = "hover:bg-transparent hover:text-subtext-0 active:bg-surface-1 active:text-fg";
//! `@perch/sdk` for the native client: the surface a stock screen imports (the navigation part, 1.3), with every
//! call going to one abstract host object, `globalThis.perch`, read when called (so a host or a test sets it before
//! mounting). Class helpers, icons, `cn`, `keyLabel` and the host dot are the app's own modules, compiled in, so the
//! classes are the web's to the character. Data hooks subscribe to `perch.subscribe` and read the host's snapshots
//! (`perch.navigation(options)`, `perch.hosts()`, ...), which must return the same object until the data changes.
//! Menus and dialogs Perch draws itself (session menu, new session menu, confirm, select, folder browser,
//! instructions, memory) open through `perch.openOverlay(kind, props)`; their callbacks are plain functions.
const Wv = "1.3.0";
let Qi = null;
const Fv = (n) => {
  Qi = n;
};
function Et() {
  const n = (typeof Qi == "function" ? Qi() : Qi) ?? globalThis.perch;
  if (!n) throw new Error("@perch/sdk: no perch host (globalThis.perch) is set");
  return n;
}
const Iv = (n) => Et().subscribe?.(n) ?? (() => {
}), $v = cv;
function Pv() {
  return typeof globalThis.crypto?.randomUUID == "function" ? globalThis.crypto.randomUUID() : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (n) => {
    const l = Math.floor(Math.random() * 16);
    return (n === "x" ? l : l & 3 | 8).toString(16);
  });
}
const t1 = globalThis.perch?.isMac !== !1, e1 = (n) => Mb(n, Et().isMac !== !1), n1 = (n) => jb(n), a1 = ({ className: n, ...l } = {}) => Ut(Rb(l), n), l1 = Bb, i1 = (n) => Hb(n), r1 = Ub, o1 = qa, s1 = lm, c1 = (n) => us[n].color, u1 = (n, l) => Et().shortcutFor?.(n, l) ?? null, d1 = (n) => Et().shortcutLabel?.(n) ?? null, ar = (n, l) => Et().command(n, l ?? {}) !== !1, f1 = (n, l, s) => Et().startSession?.(n, l, s), m1 = globalThis.perch?.pickFolder ? (n) => Et().pickFolder(n) : null;
function re(n) {
  const l = tt.useRef(n);
  return l.current = n, tt.useSyncExternalStore(Iv, () => l.current(Et()));
}
const pm = (n = {}) => re((l) => l.navigation({ showTerminals: !!n.showTerminals, sortByAttention: !!n.sortByAttention })), p1 = () => re((n) => n.hosts()), h1 = () => re((n) => n.sessionFolders());
function g1() {
  const n = re((l) => l.addProject?.() ?? b1);
  return {
    status: n.status ?? "idle",
    error: n.error,
    hostId: n.hostId,
    add: (l, s, r) => {
      l.trim() && n.status !== "pending" && Et().addProjectFolder?.(l, s, r);
    },
    clear: () => Et().clearAddProject?.()
  };
}
const b1 = Object.freeze({ status: "idle" }), hm = "perch.lastAgentChoice", v1 = Object.freeze({ connected: !1, discovery: !1, state: "ready", choices: [] }), y1 = () => {
  const n = Et().storage?.getItem(hm);
  return n === "claude" || n === "codex" ? n : "claude";
}, x1 = Object.freeze({ items: [] });
function w1() {
  const n = re((l) => l.notifications?.() ?? x1);
  return tt.useMemo(() => ({
    items: n.items ?? [],
    open: (l) => Et().command("notification.open", { id: l }),
    dismiss: (l) => Et().command("notification.dismiss", { id: l })
  }), [n]);
}
function _1(n) {
  const l = re((o) => o.agentChoices?.(n) ?? v1), [s, r] = tt.useState(y1);
  return tt.useMemo(() => ({
    connected: !!l.connected,
    discovery: !!l.discovery,
    choices: l.choices ?? [],
    lastChoice: s,
    state: l.state ?? "ready",
    error: l.state === "error" ? l.error : void 0,
    rememberChoice: (o) => {
      o !== "claude" && o !== "codex" || (Et().storage?.setItem(hm, o), r(o));
    },
    manage: () => Et().command("agents.manage", {})
  }), [l, s]);
}
function k1(n) {
  Re(() => Et().onRequest?.("add-project", n) ?? void 0, [n]);
}
function S1(n) {
  const l = n.map((s) => ({ id: s.id, parentSessionId: s.parentId, session: s }));
  return sv(l).map((s) => ({ session: s.session, nested: ds(s, l) }));
}
function E1({ id: n, plain: l, className: s }) {
  const r = re((x) => x.session(n));
  if (!r) return null;
  const o = r.state ?? ov(r), f = us[o]?.color ?? us.unknown.color, m = r.provider, d = m === "claude" || m === "claude-agent-teams" || m === "omp", p = l ? Ut("agent-mark", "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full leading-none", s) : Ut("agent-status-dot", `agent-status-dot--${o}`, "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-[1.5px] bg-panel-bg leading-none", s);
  return tt.createElement(
    "span",
    { className: p, style: l ? void 0 : { borderColor: f }, "data-provider": m ?? "unknown", title: l ? m ?? "Agent" : `${m ?? "Agent"} · ${o}`, "aria-hidden": "true" },
    tt.createElement("span", { className: Ut("inline-flex text-fg", d && "rounded-full bg-[#161616]") }, tt.createElement(gm, { provider: m, size: 14 }))
  );
}
function gm({ provider: n, size: l = 14 }) {
  const s = Et().agentIcon?.(n, l) ?? null, r = s?.markup ?? '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><circle cx="8" cy="8" r="5" fill="currentColor"/></svg>';
  return tt.createElement("svg", { width: l, height: l, "aria-hidden": "true", "data-agent-icon": n ?? "unknown", "data-perch-markup": r, ...s && s.tint === !1 ? { "data-perch-image": "true" } : {} });
}
const z1 = ({ children: n }) => tt.createElement(tt.Fragment, null, n);
function N1(n, l) {
  const s = tt.useRef(l);
  return s.current = l, Re(() => {
    const r = Et();
    if (!r.openOverlay) throw new Error(`@perch/sdk: the host draws no overlays (perch.openOverlay), so ${n} cannot open`);
    const o = {};
    for (const [m, d] of Object.entries(s.current))
      o[m] = typeof d == "function" ? (...p) => s.current[m]?.(...p) : d;
    const f = r.openOverlay(n, o);
    return () => r.closeOverlay?.(f);
  }, [n]), null;
}
const da = (n) => function(s) {
  return N1(n, s);
}, T1 = da("session-menu"), C1 = da("new-session-menu"), M1 = da("confirm");
let bm = null;
const A1 = (n) => {
  bm = n;
};
function j1(n) {
  return tt.createElement(bm ?? M1, n);
}
function O1({ className: n = Ss, ...l }) {
  return tt.createElement(Lb, { ...l, className: n });
}
let ms = null;
const R1 = (n) => {
  ms = n;
}, D1 = da("folder-browser");
function B1(n) {
  return ms ? tt.createElement(ms, { ...n, browse: (l) => Et().browse(n.hostId, l) }) : tt.createElement(D1, n);
}
const H1 = da("instructions"), U1 = da("memory"), q1 = Qb;
let zs = null;
const Y1 = (n) => {
  zs = n;
};
function G1(n) {
  if (zs) return tt.createElement(Q1, n);
  const { hostId: l, path: s, className: r } = n, o = tt.useRef(null);
  return tt.createElement(
    "button",
    {
      type: "button",
      ref: o,
      className: Ut("worktree-menu__btn", lm, r),
      "data-testid": `worktree-menu-${l}-${s}`,
      title: "New workspace (a git worktree)",
      "aria-label": "New workspace",
      "aria-expanded": !1,
      onClick: () => Et().openOverlay?.("worktree", { hostId: l, cwd: s, anchor: o.current?.getBoundingClientRect() })
    },
    tt.createElement(rm, null)
  );
}
const vm = "Perch did not answer.";
function Hi(n) {
  return n ? n.type === "worktree.error" ? { error: n.message, dirty: !!n.dirty } : n.error ? { error: String(n.error) } : {} : { error: vm };
}
function K1(n, l, s = Et()) {
  const r = (o) => {
    for (const f of o ?? []) {
      if (f.path === l) return f;
      const m = r(f.children);
      if (m) return m;
    }
    return null;
  };
  for (const o of s.navigation({})?.projects ?? []) {
    if (o.hostId !== n) continue;
    const f = r(o.workspaces) ?? r(o.hidden);
    if (f) return f;
  }
  return null;
}
const pf = 5 * 6e4;
function ym(n, l, s, r = Et()) {
  const o = Date.now() + pf;
  let f = !1, m = () => {
  };
  const d = () => {
    f = !0, m(), clearTimeout(x);
  }, p = () => {
    if (!f) {
      if (Date.now() >= o) return d();
      K1(n, l, r) && (d(), r.startSession?.(n, l, s));
    }
  }, x = setTimeout(d, pf);
  m = r.subscribe?.(p) ?? (() => {
  }), p();
}
function Q1({ hostId: n, path: l, className: s, worktrees: r, request: o, parentChoices: f, emptyAgent: m, ...d }) {
  const [p, x] = tt.useState(r), k = (E) => !!Et().coreCan?.(E, n), S = pm(), w = `${n}:${l}`, z = tt.useMemo(() => {
    if (Array.isArray(f)) return f;
    if (!k("workspace.nest")) return [];
    const E = S?.projects?.find((X) => X.hostId === n && X.repoPath === l), M = [], B = (X, I) => {
      for (const $ of X ?? [])
        I && M.push({ id: $.id, name: $.name, path: $.path }), B($.children, !0);
    };
    return B(E?.workspaces, !1), M;
  }, [f, S, n, l]), _ = n === "local" && k("worktree.job"), y = d.deleteSupported ?? k("worktree.delete"), N = d.startFromSupported ?? k("worktree.startFrom"), O = re((E) => E.emptyWorkspaceAgent?.() ?? void 0), R = m ?? O ?? void 0, A = re((E) => E.worktreeMenuRequest?.() ?? null), L = A?.projectKey === w ? A.nonce : null, q = tt.useMemo(() => o ?? (L == null ? null : A), [o, L]), [D, g] = tt.useState(q);
  Re(() => {
    q && g(q);
  }, [q]);
  const v = tt.useRef({});
  v.current = { background: _, deleteSupported: y };
  const h = tt.useMemo(() => {
    const E = (M, B) => Et().ask(M, { hostId: n, repoPath: l, ...B });
    return {
      list: async () => {
        const M = await E("worktree.list", {});
        return M?.type === "worktree.list.result" && x({ worktrees: M.worktrees ?? [], defaultRoot: M.defaultRoot ?? "", baseRef: M.baseRef, refs: M.refs ?? [] }), Hi(M);
      },
      create: async ({ branch: M, newBranch: B, path: X, extra: I, agent: $ }) => {
        const Q = { branch: M, newBranch: !!B, path: X ?? null, name: I?.name ?? null, startFrom: I?.startFrom ?? null, parentWorkspaceId: I?.parentWorkspaceId ?? null }, { background: Z } = v.current, P = await E(Z ? "worktree.job.start" : "worktree.create", Q), G = Z ? "worktree.job.started" : "worktree.done";
        if (P?.type !== G) return { error: Hi(P).error ?? vm };
        const K = Z ? P.job?.path : P.path;
        return $ && K && ym(n, K, $), { background: Z };
      },
      remove: async (M, B) => {
        const X = await E("worktree.remove", { path: M, force: !!B, deleteBranch: v.current.deleteSupported });
        return { ...Hi(X), preservedBranch: X?.type === "worktree.done" ? X.preservedBranch ?? void 0 : void 0 };
      },
      deleteBranch: async (M, B) => Hi(await E("worktree.branch.delete", { branch: M, expectedHead: B })),
      open: (M) => Et().startSession?.(n, M, "terminal"),
      // The window forgets the request; the screen keeps it until a newer one, as clearing it would re-run (and so
      // cancel) the screen's effect that a measurement put off until the next frame (`measured`).
      takeRequest: () => Et().takeWorktreeRequest?.()
    };
  }, [n, l]);
  return tt.createElement(zs, {
    hostId: n,
    cwd: l,
    projectKey: w,
    className: s,
    worktrees: p,
    background: _,
    startFromSupported: N,
    deleteSupported: y,
    parentChoices: z,
    emptyAgent: R,
    request: D,
    actions: h
  });
}
const V1 = (n, l) => {
  if (!Et().followPointer?.(n)) return;
  const s = l.items();
  for (const r of s) r.getBoundingClientRect();
  s[0]?.parentElement?.getBoundingClientRect(), zb(n, l);
}, L1 = () => re((n) => n.workspaceTabs()), X1 = () => re((n) => n.statusLine()), Z1 = () => re((n) => n.zoom()), J1 = () => re((n) => n.paneLook()), W1 = () => re((n) => n.keybindings?.() ?? []), F1 = Object.freeze({ usage: Object.freeze([]), updatedAt: 0, spend: null, redeemResult: null });
function I1(n) {
  const l = !!n?.keepFresh, s = re((o) => o.statusLine?.().connected ?? !1), r = re((o) => o.planUsage?.() ?? F1);
  return Re(() => {
    if (!l || !s) return;
    let o;
    const f = () => {
      Et().command("usage.get"), o = setTimeout(f, 18e4);
    };
    return f(), () => clearTimeout(o);
  }, [l, s]), r;
}
const $1 = () => Et().command("usage.get", { force: !0 }), P1 = (n) => Et().command("usage.redeemReset", { accountId: n }), ty = () => ar("app.zoom_reset"), ey = {
  focused: "bg-[color-mix(in_srgb,var(--text)_10%,var(--panel-bg))] hover:bg-[color-mix(in_srgb,var(--text)_10%,var(--panel-bg))] text-fg font-semibold",
  visible: "bg-transparent text-subtext-0 hover:bg-surface-0 hover:text-fg",
  hidden: "bg-transparent text-subtext-0 hover:bg-surface-0 hover:text-fg"
}, ny = (n, l, s) => Et().beginTabDrag?.(n, l, s);
function ay(n) {
  Re(() => Et().onRequest?.("new-tab", n) ?? void 0, [n]);
}
const ly = (n) => ar("browser.open", { workspaceId: n }), iy = (n, l) => ar("file.open", { workspaceId: n, path: l }), ry = () => null, oy = () => null, sy = da("new-file");
function cy(n) {
  return tt.createElement(_v, { ...n, perch: Et() });
}
const ky = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  AgentIcon: gm,
  Chevron: cm,
  CloseIcon: Gb,
  ConfirmDialog: j1,
  Dialog: q1,
  EllipsisIcon: qb,
  FileAsset: cy,
  FolderBrowser: B1,
  GearIcon: Yb,
  HostStateDot: Kb,
  InstructionsDialog: H1,
  MemoryDialog: U1,
  ModeSwitch: Tv,
  NewFilePrompt: sy,
  NewSessionMenu: C1,
  PageIcon: uv,
  PlusIcon: rm,
  QrCode: Hv,
  Select: O1,
  SessionDot: E1,
  SessionMenu: T1,
  SettingRow: qv,
  SettingsGroup: Uv,
  SettingsQuery: Tl,
  Slot: z1,
  Switch: Yv,
  TabDragLayer: oy,
  TabMenu: ry,
  WorktreeMenu: G1,
  agentStateColor: c1,
  anchoredPopoverStyle: $v,
  beginReorderDrag: V1,
  beginTabDrag: ny,
  bindHost: Fv,
  buttonClass: l1,
  cn: Ut,
  drawConfirmationsInPlace: A1,
  drawFolderBrowserInPlace: R1,
  drawWorktreeInPlace: Y1,
  ghostButton: o1,
  glassClass: Zv,
  iconButton: s1,
  isMac: t1,
  keyLabel: e1,
  menuDividerClass: r1,
  menuItemClass: i1,
  menuPanel: im,
  nestSessions: S1,
  newId: Pv,
  openBrowserTab: ly,
  openFileTab: iy,
  pickFolder: m1,
  redeemUsageReset: P1,
  refreshUsage: $1,
  resetZoom: ty,
  rowActionClass: a1,
  runCommand: ar,
  segmentClass: n1,
  settingsClass: Kv,
  shortcutFor: u1,
  shortcutLabel: d1,
  startPaneWhenReady: ym,
  startSession: f1,
  tabStateClass: ey,
  tapButtonClass: Jv,
  useAddProject: g1,
  useAddProjectRequest: k1,
  useAgentChoices: _1,
  useDismissOnOutsideClick: um,
  useHostSnapshot: re,
  useHosts: p1,
  useKeybindings: W1,
  useNavigation: pm,
  useNewTabRequest: ay,
  useNotifications: w1,
  usePaneLook: J1,
  usePlanUsage: I1,
  useResourceState: Xv,
  useSessionFolders: h1,
  useSettingsQuery: Gv,
  useStatusLine: X1,
  useWorkspaceTabs: L1,
  useZoom: Z1,
  version: Wv
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
const Ns = {
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
  Ns[n] = (l, s) => l[n](s);
const Sy = Object.keys(Ns);
function Io(n, l) {
  for (const [s, r] of Object.entries(l)) {
    const o = Ns[s];
    if (!o) throw new Error(`the description key ${s} has no GPUI builder`);
    r != null && (n = o(n, r));
  }
  return n;
}
const qn = (n) => ({ clientX: n?.position?.x ?? 0, clientY: n?.position?.y ?? 0 }), hf = /* @__PURE__ */ new WeakSet(), $o = /* @__PURE__ */ new WeakSet();
function gf(n, l, s) {
  const r = n.pressed, o = qn(s);
  return r && r.x === o.clientX && r.y === o.clientY ? r.id : l;
}
function uy(n, l, s) {
  if (n.name) return n.name;
  if (!(l.size || n.hover || n.focus || n.active || n.track_hover && Ii.has(n.group) || s)) return null;
  const r = n.meta?.attrs["data-testid"];
  return r ? `~${n.id}:${r}` : `~${n.id}`;
}
const xm = (n, l = !1) => (n.children ?? []).some((s) => s.kind === "text" ? !l || /\s/.test(String(s.text ?? "").trim()) : s.kind === "div" && s.style?.flex_direction !== "row" && s.style?.whitespace !== "nowrap" && xm(s, !0)), Ne = (n) => n.style?.display !== "hidden";
let Ii = /* @__PURE__ */ new Set();
function wm(n, l = /* @__PURE__ */ new Set()) {
  for (const { group: s, style: r } of n.group_hover ?? []) "display" in r && l.add(s);
  for (const s of n.children ?? []) s.kind !== "text" && wm(s, l);
  return l;
}
function ps(n, l, s, r, o = !1, f = !1, m = null, d = {}, p = !1, x = /* @__PURE__ */ new Map(), k = null) {
  if (n.kind === "text") return x.get(n)?.text ?? n.text;
  const S = hf.has(n);
  f ||= n.style.opacity === 0 || n.style.visibility === "invisible" || n.style.display === "hidden", f && (n.name || n.range_name) && (n = { ...n, name: void 0, range_name: void 0, also: void 0 }), n.style.text_color !== void 0 && (k = null), m = n.style.text_color ?? m;
  const w = !!n.hover?.text_color && Em(n), z = n.group ?? (w ? `~g${n.id}` : null);
  w && (k = { group: z, color: n.hover.text_color }), d = { ...d };
  for (const h of ["text_size", "line_height", "whitespace", "text_ellipsis"]) n.style[h] !== void 0 && (d[h] = n.style[h]);
  const _ = new Set(n.events ?? []);
  let y;
  if (n.kind === "image" && !n.markup ? y = l.image(n.src) : y = l.div(), n.markup && n.kind === "svg" && k && k.color !== m) {
    const { group: h, color: E } = k, M = () => l.div().absolute().top(0).left(0).size_full();
    y = y.child(M().group_hover(h, (B) => B.invisible()).child(r.icon(`~icon-${n.id}`, n.markup, m))).child(M().invisible().group_hover(h, (B) => B.visible()).child(r.icon(`~icon-${n.id}-hover`, n.markup, E)));
  } else n.markup && (y = y.child(r.icon(`~icon-${n.id}`, n.markup, n.kind === "svg" ? m : "")));
  const N = uy(n, _, o);
  if (N && (y = y.id(N)), n.measure && (y = y.measure(n.measure)), n.name && y.also_named) for (const h of n.also ?? []) y = y.also_named(h);
  y = Io(y, { ...n.style, ...x.get(n) });
  const O = d.whitespace !== "nowrap" && !d.text_ellipsis;
  p && O && n.style.flex_shrink !== 0 && n.style.min_w === void 0 && xm(n) && (y = y.min_w(0));
  for (const h of ["hover", "focus", "active"]) n[h] && (y = y[h]((E) => Io(E, n[h])));
  z && (y = y.group(z));
  for (const { group: h, style: E } of n.group_hover ?? []) {
    const { display: M, ...B } = E;
    Object.keys(B).length && (y = y.group_hover(h, (X) => Io(X, B)));
  }
  if (l.scroll && (n.style.overflow_x === "scroll" || n.style.overflow_y === "scroll")) {
    const h = s.document?.scrollTarget, E = h ? (n.children ?? []).filter(Ne).findIndex((M) => Sm(M, h.id)) : -1;
    if (E >= 0 && (s.scroller ?? n.id) === n.id && (s.document.scrollTarget = null, s.scroller = n.id, l.scroll.scroll_to_item(E)), s.scroller ??= n.id, s.scroller === n.id && s.document) {
      y = y.track_scroll(l.scroll);
      const M = (n.children ?? []).filter(Ne).map((B) => B.id);
      s.document.itemBounds = (B) => M.includes(B) ? l.scroll.item_bounds?.(M.indexOf(B)) ?? null : null;
    }
  }
  const R = n.style.overflow_x === "scroll" || n.style.overflow_y === "scroll";
  if (R && $o.has(n) && (y = y.on_scroll_wheel((h, E) => E.stop_propagation?.())), R || $o.has(n)) for (const h of n.children ?? []) h.kind !== "text" && $o.add(h);
  n.kind === "input" && !n.disabled && (y = y.on_mouse_down("left", (h, E) => {
    h.bounds && s.setBounds(n.id, h.bounds), s.focus(n.id), E.notify();
  }));
  const A = n.kind === "input" ? n : n.meta?.tag === "label" ? km(n) : null;
  A && !A.disabled && /^(checkbox|radio)$/.test(A.input_type) && (y = y.on_click((h, E) => {
    E.stop_propagation?.(), s.toggle(A.id), E.notify();
  }));
  const L = ["click", "double_click", "context_menu", "mouse_down", "mouse_up"].some((h) => _.has(h));
  if (L || S) for (const h of n.children ?? []) h.kind !== "text" && hf.add(h);
  if (L && (y = y.on_mouse_down("left", (h, E) => {
    E.stop_propagation?.(), h.bounds && s.setBounds(n.id, h.bounds);
    const M = { ...qn(h), button: 0, buttons: 1, detail: h.click_count }, B = gf(s, n.id, h);
    s.pressed = null, s.dispatch(B, "pointerdown", { ...M, pointerType: "mouse" }), s.dispatch(B, "mousedown", M) && s.pressFocus?.(B), E.notify();
  }), y = y.on_mouse_down("right", (h, E) => {
    E.stop_propagation?.(), h.bounds && s.setBounds(n.id, h.bounds);
    const M = gf(s, n.id, h);
    s.pressed = null, s.dispatch(M, "contextmenu", { ...qn(h), button: 2 }), E.notify();
  }), y = y.on_mouse_up("left", (h, E) => {
    E.stop_propagation?.();
    const M = { ...qn(h), button: 0 };
    s.dispatch(n.id, "pointerup", { ...M, pointerType: "mouse" }), s.dispatch(n.id, "mouseup", M), E.notify();
  }), y = y.on_click((h, E) => {
    s.dispatch(n.id, h.click_count === 2 && _.has("double_click") ? "dblclick" : "click", { detail: h.click_count, button: 0 }), E.notify();
  })), n.blocks_pointer && !L)
    for (const h of ["left", "right"]) y = y.on_mouse_down(h, (E, M) => M.stop_propagation?.());
  else if (S && !L)
    for (const h of ["left", "right"])
      y = y.on_mouse_down(h, (E) => {
        const M = qn(E);
        (s.pressed?.x !== M.clientX || s.pressed?.y !== M.clientY) && (s.pressed = { id: n.id, x: M.clientX, y: M.clientY });
      });
  if (_.has("mouse_move") && (y = y.on_mouse_move((h) => {
    s.dispatch(n.id, "pointermove", { ...qn(h), pointerType: "mouse" });
  })), n.track_hover && Ii.has(n.group) && (y = y.on_hover((h, E) => {
    s.hover(n.id, h), E.notify();
  })), o && (y = y.on_mouse_down_out((h, E) => {
    s.dispatch(s.document.body.id, "pointerdown", { ...qn(h), pointerType: "mouse" }), s.dispatch(s.document.body.id, "mousedown", qn(h)), E.notify();
  })), n.kind === "input" && !/^(checkbox|radio|range|color|file|select)$/.test(n.input_type)) {
    const h = n.value ? String(n.value) : String(n.placeholder ?? "");
    let E = l.div().whitespace_nowrap().overflow_x_hidden();
    const M = ca(d);
    M && (E = E.h(M)), !n.value && m && (E = E.text_color(fy(m))), h && (y = y.child(E.child(n.input_type === "password" && n.value ? "•".repeat([...h].length) : h))), n.field_w && (y = y.child(l.div().w(n.field_w).h(0)));
  }
  const q = d.whitespace === "nowrap" ? ca(d) : null, D = n.style.display === "flex" && !String(n.style.flex_direction ?? "row").startsWith("col");
  let g = !n.range_name;
  const v = n.style.display === "flex" && String(n.style.flex_direction ?? "row").startsWith("col") && (n.style.h === void 0 || n.style.h === "auto") && typeof n.style.max_h == "number";
  for (const h of (n.children ?? []).filter(Ne)) {
    const E = h.style?.flex_basis;
    v && h.style.flex_grow > 0 && (E === 0 || typeof E == "string" && E.endsWith("%")) && x.set(h, { ...x.get(h), flex_basis: "auto" });
    let M = ps(h, l, s, r, !1, f, m, d, D && h.style?.position !== "absolute", x, k);
    const B = !g && (h.kind === "text" || !h.meta), X = h.kind === "text" ? x.get(h)?.h ?? q : null, I = h.kind === "text" ? x.get(h)?.w : void 0;
    if (B || X || I !== void 0) {
      let $ = l.div();
      B && ($ = $.id(n.range_name)), B && !D && n.style.display === "flex" && ($ = $[`self_${dy[d.text_align] ?? "start"}`]().max_w("100%")), X && ($ = $.h(X)), I !== void 0 && ($ = $.w(I).flex_none().whitespace_nowrap()), M = $.child(M), g ||= B;
    }
    y = y.child(M);
  }
  return y;
}
const dy = { center: "center", right: "end", end: "end" };
function fy(n) {
  const l = String(n);
  if (!/^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(l)) return n;
  const s = l.length === 9 ? Number.parseInt(l.slice(7), 16) : 255;
  return `${l.slice(0, 7)}${Math.round(s / 2).toString(16).padStart(2, "0")}`;
}
const _m = /^(?:[!-,.-~]+|\S)$/u, km = (n) => {
  for (const l of n.children ?? []) {
    if (l.kind === "input" && /^(checkbox|radio)$/.test(l.input_type)) return l;
    const s = l.kind === "text" ? null : km(l);
    if (s) return s;
  }
  return null;
}, Sm = (n, l) => n.id === l || (n.children ?? []).some((s) => s.kind !== "text" && Sm(s, l)), Em = (n) => !!n.markup || (n.children ?? []).some((l) => l.kind !== "text" && Em(l));
function ca(n) {
  const l = n.line_height;
  return typeof l == "string" && l.endsWith("px") ? Number.parseFloat(l) : typeof l == "number" && typeof n.text_size == "number" ? l * n.text_size : null;
}
function Ey(n, l, s, r, o = 0, f = !1) {
  const m = [n.root, ...n.overlays];
  Ii = /* @__PURE__ */ new Set();
  for (const k of m) wm(k, Ii);
  const d = o > 0 ? yy(m, o) : /* @__PURE__ */ new Map();
  o > 0 && r.measure && my(m, o, r.measure, d), by(m, d), gy(m, d), r.measure && hy(m, r.measure, d);
  let p = l.div().relative().size_full().child(ps(n.root, l, s, r, !1, !1, null, {}, !1, d)), x = f && n.overlays.length ? l.div().relative().size_full().window_layer() : p;
  for (const k of n.overlays) x = x.child(ps(k, l, s, r, !0, !1, null, {}, !1, d));
  return x === p ? p : p.child(x);
}
function my(n, l, s, r) {
  const o = (_, y) => r.set(_, { ...r.get(_), ...y }), f = /* @__PURE__ */ new Map(), m = /* @__PURE__ */ new Map(), d = ["text_size", "font_weight", "font_family", "italic", "whitespace", "text_ellipsis"];
  function p(_, y, N) {
    if (_.kind === "text") {
      if (!(y.whitespace === "nowrap" || _m.test(_.text)) || y.text_ellipsis || N || typeof y.text_size != "number") return NaN;
      const g = s(_.text, { size: y.text_size, weight: y.font_weight ?? 400, family: y.font_family ?? ".SystemUIFont", italic: !!y.italic });
      return Number.isFinite(g) ? g : NaN;
    }
    if (!Ne(_) || _.kind === "input" || _.markup) return x(_);
    const O = { ...y };
    for (const D of d) _.style[D] !== void 0 && (O[D] = _.style[D]);
    O.text_ellipsis = !!_.style.text_ellipsis, m.set(_, O);
    const R = _.style, A = (_.children ?? []).filter(Ke), L = A.map((D) => p(D, O, N || !!_.tabular));
    let q = x(_);
    if (!Number.isFinite(q) && R.w === void 0) {
      const D = A.map((v, h) => L[h] + (v.kind === "text" ? 0 : rt(v.style.ml) + rt(v.style.mr)));
      let g;
      A.length ? Oe(_) ? g = A.some((v) => v.kind !== "text" && v.style.flex_grow > 0) || R.flex_wrap === "wrap" ? NaN : D.reduce((v, h) => v + h, 0) + rt(R.gap_x) * (A.length - 1) : g = Math.max(...D) : g = 0, q = g + rt(R.pl) + rt(R.pr) + rt(R.border_l) + rt(R.border_r), typeof R.min_w == "number" && (q = Math.max(q, R.min_w)), typeof R.max_w == "number" && (q = Math.min(q, R.max_w));
    }
    return f.set(_, q), q;
  }
  const x = (_) => typeof _.style?.w == "number" ? _.style.w : NaN, k = () => ({ exact: 0, laid: 0 }), S = (_, y) => {
    if (!Number.isFinite(y))
      return Object.assign(_, k()), NaN;
    _.exact += y;
    const N = Math.round(_.exact * l + 1e-9) / l, O = N - _.laid;
    return _.laid = N, O;
  }, w = (_) => Oe(_) && _.style.flex_wrap !== "wrap" && (_.style.justify ?? "start") === "start";
  function z(_) {
    if (!_ || _.kind === "text" || !Ne(_)) return;
    const y = (_.children ?? []).filter(Ke);
    if (w(_) && y.length > 1) {
      const N = rt(_.style.gap_x), O = k(), R = !(N && y.some((A) => A.kind === "text" || !Number.isFinite(rt(A.style.ml))));
      o(_, { border_l: S(O, rt(_.style.border_l)), pl: S(O, rt(_.style.pl)) }), R && N && o(_, { gap_x: 0 }), y.forEach((A, L) => {
        const q = (L && R ? N : 0) + (A.kind === "text" ? 0 : rt(A.style.ml));
        if (A.kind === "text")
          q && Object.assign(O, k());
        else {
          const h = S(O, q);
          Number.isFinite(h) && o(A, { ml: h });
        }
        const D = A.kind === "text" ? m.get(_) ?? {} : null, g = A.kind === "text" ? p(A, D, !!_.tabular) : f.get(A);
        if ((A.kind === "text" || !(A.style.flex_grow > 0)) && Number.isFinite(g)) {
          const h = { w: S(O, g) };
          A.kind !== "text" && typeof A.style.w != "number" && A.style.min_w === void 0 && (h.whitespace = "nowrap", h.flex_shrink = 0), o(A, h);
        } else Object.assign(O, k());
        if (A.kind !== "text") {
          const h = S(O, rt(A.style.mr));
          Number.isFinite(h) && o(A, { mr: h });
        }
      });
    }
    for (const N of _.children ?? []) N.kind !== "text" && z(N);
  }
  for (const _ of n)
    _ && (p(_, {}, !1), z(_));
}
const py = /(?<= +)(?=[^ ])|(?<=[\p{L}\p{N}]-)(?=[\p{L}\p{N}])/u;
function hy(n, l, s) {
  const r = ["text_size", "font_weight", "font_family", "italic", "line_height"], o = (d) => typeof d == "number" ? d : 0, f = (d, p) => p && $i(p) && !Oe(p) && d.style.position !== "absolute" && !["start", "center", "end"].includes(d.style.self) && !["start", "center", "end"].includes(p.style.items), m = (d, p, x, k) => {
    if (!d || d.kind === "text" || !Ne(d)) return;
    const S = d.style;
    let w = typeof S.w == "number" ? S.w : S.w === "100%" ? x : f(d, p) ? x - o(S.ml) - o(S.mr) : NaN;
    typeof S.max_w == "number" && (w = Math.min(w, S.max_w));
    const z = w - o(S.pl) - o(S.pr) - o(S.border_l) - o(S.border_r), _ = { ...k };
    for (const N of r) S[N] !== void 0 && (_[N] = S[N]);
    const y = d.children ?? [];
    if (d.break_anywhere && Number.isFinite(z) && z > 0 && typeof _.text_size == "number" && y.length && y.every((N) => N.kind === "text")) {
      const N = { size: _.text_size, weight: _.font_weight ?? 400, family: _.font_family ?? ".SystemUIFont", italic: !!_.italic }, O = (L) => l(L.trimEnd(), N) <= z + 0.01;
      let R = 0;
      for (const L of y) {
        const q = [];
        for (const g of L.text.split(`
`)) {
          let v = "";
          for (const h of g.split(py)) {
            if (O(v + h)) {
              v += h;
              continue;
            }
            v && q.push(v.trimEnd()), v = "";
            for (const E of h)
              v && !O(v + E) && (q.push(v), v = ""), v += E;
          }
          q.push(v.trimEnd());
        }
        const D = q.join(`
`);
        q.every((g) => !g || O(g)) ? D !== L.text && s.set(L, { ...s.get(L), text: D }) : R = NaN, R += q.length;
      }
      const A = ca(_);
      Number.isFinite(R) && A && S.h === void 0 && y.length === 1 && s.set(d, { ...s.get(d), h: R * A + o(S.pt) + o(S.pb) + o(S.border_t) + o(S.border_b) });
    }
    for (const N of y) m(N, d, Oe(d) ? NaN : z, _);
  };
  for (const d of n) m(d, null, NaN, {});
}
function gy(n, l) {
  const s = (r, o) => {
    if (!r || r.kind === "text" || !Ne(r)) return;
    const f = r.style, m = f.position === "absolute" ? f.w === void 0 && (f.left === void 0 || f.right === void 0) : o && typeof f.w != "number";
    if (m && Oe(r))
      for (const d of r.children ?? []) {
        const p = d.kind === "text" ? void 0 : d.style.flex_basis;
        d.kind !== "text" && d.style.flex_grow > 0 && (p === 0 || typeof p == "string" && p.endsWith("%")) && l.set(d, { ...l.get(d), flex_basis: "auto" });
      }
    for (const d of r.children ?? []) s(d, m);
  };
  for (const r of n) s(r, !1);
}
function by(n, l) {
  const s = l.heights ?? /* @__PURE__ */ new Map(), r = (p) => s.get(p), o = (p) => {
    const x = r(p);
    if (Number.isFinite(x)) return x;
    if (p.kind === "text" || !Ne(p)) return 0;
    const k = p.style, S = typeof k.min_h == "number" ? k.min_h : 0, w = (p.children ?? []).filter(Ke), z = w.map((N) => o(N) + (N.kind === "text" ? 0 : Math.max(0, rt(N.style.mt) || 0) + Math.max(0, rt(N.style.mb) || 0))), _ = w.length ? Oe(p) ? Math.max(...z) : z.reduce((N, O) => N + O, 0) + (k.display === "flex" ? (rt(k.gap_y) || 0) * (w.length - 1) : 0) : 0, y = [k.pt, k.pb, k.border_t, k.border_b].reduce((N, O) => N + (rt(O) || 0), 0);
    return Math.max(S, _ + y);
  }, f = (p) => !(p.children ?? []).filter(Ke).length || Oe(p) ? NaN : o({ ...p, style: { ...p.style, h: void 0, max_h: void 0, min_h: void 0 } }), m = (p, x) => {
    const k = p.style;
    if (typeof k.h == "number") return k.h;
    if (typeof k.max_h == "number") return k.max_h;
    if (!x || !$i(x) || Oe(x)) return NaN;
    const S = x.style, w = typeof S.h == "number" ? S.h : typeof S.max_h == "number" ? S.max_h : NaN, z = (x.children ?? []).filter(Ke);
    let _ = 0;
    for (const N of z) {
      if (N === p) continue;
      const O = r(N);
      if (!Number.isFinite(O)) return NaN;
      _ += O + (N.kind === "text" ? 0 : rt(N.style.mt) + rt(N.style.mb));
    }
    const y = S.display === "flex" ? rt(S.gap_y) * Math.max(0, z.length - 1) : 0;
    return w - rt(S.pt) - rt(S.pb) - rt(S.border_t) - rt(S.border_b) - _ - y - rt(k.mt) - rt(k.mb);
  }, d = (p, x) => {
    if (!(!p || p.kind === "text" || !Ne(p))) {
      if (p.scrollbar > 0 && p.style.overflow_y === "scroll") {
        const k = f(p), S = m(p, x);
        Number.isFinite(k) && Number.isFinite(S) && k > S + 0.01 && l.set(p, { ...l.get(p), pr: rt(p.style.pr) + p.scrollbar });
      }
      for (const k of p.children ?? []) d(k, p);
    }
  };
  for (const p of n) d(p, null);
}
const vy = ["text_size", "line_height", "whitespace", "text_ellipsis"], rt = (n) => n == null ? 0 : typeof n == "number" ? n : NaN, $i = (n) => n.style.display === "flex" ? n.style.flex_direction === "col" : !0, Oe = (n) => n.style.display === "flex" && (n.style.flex_direction ?? "row") === "row", Ke = (n) => n.kind === "text" || Ne(n) && n.style.position !== "absolute";
function yy(n, l) {
  const s = /* @__PURE__ */ new Map(), r = (y, N) => s.set(y, { ...s.get(y), ...Object.fromEntries(Object.entries(N).filter(([, O]) => Number.isFinite(O))) }), o = /* @__PURE__ */ new Map(), f = /* @__PURE__ */ new Map();
  function m(y, N) {
    if (y.kind === "text") return N.whitespace === "nowrap" || _m.test(y.text) ? ca(N) ?? NaN : NaN;
    const O = { ...N };
    for (const D of vy) y.style[D] !== void 0 && (O[D] = y.style[D]);
    f.set(y, O);
    const R = y.style, A = (y.children ?? []).filter(Ke), L = A.map((D) => m(D, O));
    let q;
    if (R.h !== void 0 && R.h !== "auto") q = rt(R.h);
    else if (y.kind === "input")
      q = (y.input_type === "textarea" || y.input_type === "select" ? NaN : ca(O) ?? NaN) + rt(R.pt) + rt(R.pb) + rt(R.border_t) + rt(R.border_b), R.min_h !== void 0 && (q = Math.max(q, rt(R.min_h)));
    else {
      const D = A.map((v, h) => (v.kind === "text" ? 0 : rt(v.style.mt) + rt(v.style.mb)) + L[h]);
      let g;
      if (Oe(y)) g = R.flex_wrap === "wrap" ? NaN : R.items === "baseline" ? p(A, L, O) : Math.max(0, ...D);
      else if ($i(y)) {
        const v = A.some((E) => E.kind !== "text" && (E.style.flex_grow > 0 || E.style.flex_basis !== void 0)), h = R.display !== "flex" && A.some((E) => E.kind !== "text" && (rt(E.style.mt) || rt(E.style.mb)));
        g = v || h ? NaN : D.reduce((E, M) => E + M, 0) + (R.display === "flex" ? rt(R.gap_y) * Math.max(0, A.length - 1) : 0);
      } else g = NaN;
      q = g + rt(R.pt) + rt(R.pb) + rt(R.border_t) + rt(R.border_b), R.min_h !== void 0 && (q = Math.max(q, rt(R.min_h))), R.max_h !== void 0 && (q = Math.min(q, rt(R.max_h)));
    }
    return o.set(y, q), q;
  }
  const d = (y) => (ca(y) - (Zi + Hf) * y.text_size) / 2 + Zi * y.text_size;
  function p(y, N, O) {
    let R = 0, A = 0;
    for (const [L, q] of y.entries()) {
      const D = q.kind === "text" ? O : f.get(q);
      if (!(q.kind === "text" || (q.children ?? []).filter(Ke).every((E) => E.kind === "text")) || !Number.isFinite(N[L]) || typeof D.text_size != "number") return NaN;
      const v = q.kind === "text" ? {} : q.style, h = rt(v.mt) + rt(v.border_t) + rt(v.pt) + d(D);
      R = Math.max(R, h), A = Math.max(A, rt(v.mt) + N[L] + rt(v.mb) - h);
    }
    return R + A;
  }
  const x = () => ({ exact: 0, laid: 0 }), k = (y, N) => {
    if (!Number.isFinite(N))
      return Object.assign(y, x()), NaN;
    y.exact += N;
    const O = Math.round(y.exact * l + 1e-9) / l, R = O - y.laid;
    return y.laid = O, R;
  };
  function S(y) {
    if (!(y.kind === "text" || !Ne(y))) {
      for (const N of (y.children ?? []).filter((O) => O.kind !== "text" && Ne(O) && O.style.position === "absolute")) S(N);
      if ($i(y) && !Oe(y)) {
        const N = x();
        r(y, { border_t: k(N, rt(y.style.border_t)), pt: k(N, rt(y.style.pt)) }), w(y, N);
      } else for (const N of (y.children ?? []).filter(Ke)) N.kind !== "text" && S(N);
    }
  }
  function w(y, N) {
    const O = (y.children ?? []).filter(Ke), R = y.style.display === "flex" ? rt(y.style.gap_y) : 0;
    if (R && O.some((A) => A.kind === "text")) {
      for (const A of O) A.kind !== "text" && S(A);
      return !1;
    }
    return R && r(y, { gap_y: 0 }), O.forEach((A, L) => {
      if (A.kind === "text") {
        const q = o.get(A) ?? m(A, f.get(y) ?? {});
        Number.isFinite(q) ? r(A, { h: k(N, q) }) : Object.assign(N, x());
        return;
      }
      if (r(A, { mt: k(N, (L ? R : 0) + rt(A.style.mt)) }), Number.isFinite(o.get(A))) _(A, N);
      else if (z(A)) {
        const q = A.style;
        r(A, { border_t: k(N, rt(q.border_t)), pt: k(N, rt(q.pt)) }), r(A, { pb: k(N, rt(q.pb)), border_b: k(N, rt(q.border_b)) });
      } else
        S(A), Object.assign(N, x());
      r(A, { mb: k(N, rt(A.style.mb)) });
    }), !0;
  }
  function z(y) {
    const N = y.style, O = (y.children ?? []).filter(Ke), R = ca(f.get(y) ?? {});
    return y.kind === "div" && !Oe(y) && O.length > 0 && O.every((A) => A.kind === "text") && Number.isInteger(R) && [N.h, N.min_h, N.max_h].every((A) => A === void 0 || A === "auto");
  }
  function _(y, N) {
    const O = y.style;
    for (const D of (y.children ?? []).filter((g) => g.kind !== "text" && Ne(g) && g.style.position === "absolute")) S(D);
    const R = N.laid, A = N.exact;
    r(y, { border_t: k(N, rt(O.border_t)), pt: k(N, rt(O.pt)) });
    const L = O.h !== void 0 && O.h !== "auto", q = o.get(y) - rt(O.pt) - rt(O.pb) - rt(O.border_t) - rt(O.border_b);
    if (y.kind === "input")
      L || k(N, q);
    else if (Oe(y) || L && (O.justify ?? "start") !== "start") {
      for (const D of (y.children ?? []).filter(Ke)) D.kind !== "text" && S(D);
      L || k(N, q);
    } else !w(y, N) && !L && k(N, q);
    if (L) {
      N.exact = A + o.get(y), N.laid = Math.round(N.exact * l + 1e-9) / l, r(y, { h: N.laid - R });
      return;
    }
    r(y, { pb: k(N, rt(O.pb)), border_b: k(N, rt(O.border_b)) }), r(y, { h: N.laid - R });
  }
  for (const y of n)
    m(y, {}), S(y);
  return Object.defineProperty(s, "heights", { value: o }), s;
}
const zy = { sidebar: [{ name: "sidebar-root", selector: "aside.sidebar" }, { name: "sidebar-content", selector: "aside.sidebar > div:first-child" }, { name: "host-switcher", selector: '[data-testid="host-switcher"]' }, { name: "host-chip", selector: '[data-testid="host-switcher"] > div' }, { name: "host-badge", selector: ".sidebar__env-badge" }, { name: "host-name", selector: ".sidebar__env-host" }, { name: "host-meta", selector: '[data-testid="host-switcher"] > div > div:first-child > span:nth-child(3)' }, { name: "host-line", selector: ".sidebar__env-cwd" }, { name: "host-caret", selector: '[data-testid="host-switcher"] > span[aria-hidden="true"]' }, { name: "new-session-button", selector: 'button[data-testid^="new-session-"]', key: { self: !0, attr: "data-testid", strip: "new-session-" } }, { name: "new-session-icon", selector: 'button[data-testid^="new-session-"] > svg' }, { name: "new-session-label", selector: 'button[data-testid^="new-session-"]', textRange: !0 }, { name: "new-session-shortcut", selector: 'button[data-testid^="new-session-"] > span' }, { name: "overview", selector: '[data-testid="workspace-overview"]' }, { name: "overview-header", selector: '[data-testid="workspace-overview"] > div:first-child' }, { name: "overview-title", selector: '[data-testid="workspace-overview"] > div:first-child > div:first-child > span:first-child' }, { name: "needs-you-button", selector: '[data-testid="workspace-needs-you"]' }, { name: "organize-button", selector: '[data-testid="workspace-organize"]' }, { name: "organize-icon", selector: '[data-testid="workspace-organize"] > svg' }, { name: "add-project-button", selector: '[data-testid="workspace-add-project"]' }, { name: "add-project-icon", selector: '[data-testid="workspace-add-project"] > svg' }, { name: "add-project-label", selector: '[data-testid="workspace-add-project"]', textRange: !0 }, { name: "project-list", selector: '[data-testid="project-list"]' }, { name: "project", selector: ".workspace-project", key: { self: !0, attr: "data-testid", strip: "workspace-project-" } }, { name: "project-header", selector: ".workspace-project > div:first-child", key: { closest: ".workspace-project", attr: "data-testid", strip: "workspace-project-" } }, { name: "project-toggle", selector: '[data-testid^="project-toggle-"]', key: { self: !0, attr: "data-testid", strip: "project-toggle-" } }, { name: "project-chevron", selector: '[data-testid^="project-toggle-"] > svg:not([data-testid])', key: { closest: '[data-testid^="project-toggle-"]', attr: "data-testid", strip: "project-toggle-" } }, { name: "project-folder-icon", selector: '[data-testid="project-folder-icon"]', key: { closest: '[data-testid^="project-toggle-"]', attr: "data-testid", strip: "project-toggle-" } }, { name: "project-name", selector: '[data-testid^="project-toggle-"] strong', key: { closest: '[data-testid^="project-toggle-"]', attr: "data-testid", strip: "project-toggle-" } }, { name: "project-branch", selector: '[data-testid^="project-toggle-"] > span.whitespace-nowrap', key: { closest: '[data-testid^="project-toggle-"]', attr: "data-testid", strip: "project-toggle-" } }, { name: "project-dirty-mark", selector: '[data-testid^="project-toggle-"] > span[title="Uncommitted changes"]', key: { closest: '[data-testid^="project-toggle-"]', attr: "data-testid", strip: "project-toggle-" } }, { name: "project-rollup", selector: '[data-testid^="project-rollup-"]', key: { self: !0, attr: "data-testid", strip: "project-rollup-" } }, { name: "project-rollup-badge", selector: '[data-testid^="project-rollup-"] > span', key: { closest: '[data-testid^="project-rollup-"]', attr: "data-testid", strip: "project-rollup-" } }, { name: "project-menu-button", selector: '[data-testid^="workspace-project-menu-"]', key: { self: !0, attr: "data-testid", strip: "workspace-project-menu-" } }, { name: "project-add-button", selector: ".workspace-project > div:first-child .worktree-menu__btn", key: { closest: ".workspace-project", attr: "data-testid", strip: "workspace-project-" } }, { name: "project-workspaces", selector: ".workspace-project__workspaces", key: { closest: ".workspace-project", attr: "data-testid", strip: "workspace-project-" } }, { name: "workspace", selector: '[data-testid="workspace-tree-root"] [data-testid^="workspace-entry-"]', key: { self: !0, attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-button", selector: '[data-testid="workspace-tree-root"] button.workspace-entry__button', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-icon", selector: '[data-testid="workspace-tree-root"] [data-testid="workspace-checkout-icon"]', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-name", selector: '[data-testid="workspace-tree-root"] strong[title="Double-click to rename"]', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-branch", selector: '[data-testid="workspace-tree-root"] button.workspace-entry__button > span.items-baseline > span', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-dirty-mark", selector: '[data-testid="workspace-tree-root"] button.workspace-entry__button > span[title="Uncommitted changes"]', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-pinned-label", selector: '[data-testid="workspace-tree-root"] button.workspace-entry__button > span.shrink-0:not([title])', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "hidden-worktrees-button", selector: '[data-testid^="workspace-hidden-"]', key: { self: !0, attr: "data-testid", strip: "workspace-hidden-" } }, { name: "session-row", selector: 'div[class~="group/row"]', key: { find: 'button[data-testid^="workspace-session-"]:not([data-testid^="workspace-session-close-"])', attr: "data-testid", strip: "workspace-session-" } }, { name: "session-button", selector: 'button[data-testid^="workspace-session-"]:not([data-testid^="workspace-session-close-"])', key: { self: !0, attr: "data-testid", strip: "workspace-session-" } }, { name: "session-mark", selector: ".agent-mark", key: { closest: 'button[data-testid^="workspace-session-"]', attr: "data-testid", strip: "workspace-session-" } }, { name: "session-mark-icon", selector: ".agent-mark > span > *", key: { closest: 'button[data-testid^="workspace-session-"]', attr: "data-testid", strip: "workspace-session-" } }, { name: "session-title", selector: 'button[data-testid^="workspace-session-"] > span.whitespace-nowrap', key: { closest: 'button[data-testid^="workspace-session-"]', attr: "data-testid", strip: "workspace-session-" } }, { name: "status-row-title", selector: "button[data-session] span.truncate:not([data-testid])", key: { closest: 'button[data-testid^="workspace-session-"]', attr: "data-testid", strip: "workspace-session-" } }, { name: "status-row-detail", selector: '[data-testid="status-row-detail"]', key: { closest: 'button[data-testid^="workspace-session-"]', attr: "data-testid", strip: "workspace-session-" } }, { name: "session-state-badge", selector: '[data-testid^="session-state-"]', key: { self: !0, attr: "data-testid", strip: "session-state-" } }, { name: "session-menu-button", selector: '[data-testid^="session-menu-button-"]', key: { self: !0, attr: "data-testid", strip: "session-menu-button-" } }, { name: "session-fold-button", selector: '[data-testid^="session-fold-"]', key: { self: !0, attr: "data-testid", strip: "session-fold-" } }, { name: "session-elbow", selector: '[data-testid^="session-elbow-"]', key: { self: !0, attr: "data-testid", strip: "session-elbow-" } }, { name: "session-rollup", selector: '[data-testid^="session-rollup-"]', key: { self: !0, attr: "data-testid", strip: "session-rollup-" } }, { name: "chats", selector: '[data-testid="workspace-chats"]' }, { name: "chats-header", selector: '[data-testid="workspace-chats"] > div:first-child' }, { name: "chats-toggle", selector: '[data-testid="workspace-chats-collapse"]' }, { name: "chats-label", selector: '[data-testid="workspace-chats-collapse"]', textRange: !0 }, { name: "chats-chevron", selector: '[data-testid="workspace-chats-collapse"] > svg' }, { name: "chats-menu-button", selector: '[data-testid="workspace-chats-menu"]' }, { name: "chats-new-button", selector: '[data-testid="workspace-chats-new"]' }, { name: "chats-new-icon", selector: '[data-testid="workspace-chats-new"] > svg' }, { name: "status-view", selector: '[data-testid="workspace-status-view"]' }, { name: "status-section", selector: '[data-testid^="status-section-"]:not([data-testid^="status-section-title-"])', key: { self: !0, attr: "data-testid", strip: "status-section-" } }, { name: "status-heading", selector: '[data-testid^="status-section-title-"], [data-testid="status-no-sessions-title"]', key: { self: !0, attr: "data-testid" } }, { name: "status-heading-dot", selector: '[data-testid^="status-section-title-"] > span:first-child, [data-testid="status-no-sessions-title"] > span:first-child', key: { closest: '[data-testid^="status-section-title-"], [data-testid="status-no-sessions-title"]', attr: "data-testid" } }, { name: "status-heading-label", selector: '[data-testid^="status-section-title-"] > span:nth-child(2), [data-testid="status-no-sessions-title"] > span:nth-child(2)', key: { closest: '[data-testid^="status-section-title-"], [data-testid="status-no-sessions-title"]', attr: "data-testid" } }, { name: "status-heading-count", selector: '[data-testid^="status-section-title-"] > span[aria-label], [data-testid="status-no-sessions-title"] > span[aria-label]', key: { closest: '[data-testid^="status-section-title-"], [data-testid="status-no-sessions-title"]', attr: "data-testid" } }, { name: "status-heading-note", selector: '[data-testid^="status-section-title-"] > span.truncate, [data-testid="status-no-sessions-title"] > span.truncate', key: { closest: '[data-testid^="status-section-title-"], [data-testid="status-no-sessions-title"]', attr: "data-testid" } }, { name: "status-project", selector: 'div[data-testid^="status-project-"]', key: { self: !0, attr: "data-testid", strip: "status-project-" } }, { name: "status-project-header", selector: 'div[data-testid^="status-project-"] > div:first-child', key: { closest: 'div[data-testid^="status-project-"]', attr: "data-testid", strip: "status-project-" } }, { name: "status-project-icon", selector: 'div[data-testid^="status-project-"] > div:first-child > svg', key: { closest: 'div[data-testid^="status-project-"]', attr: "data-testid", strip: "status-project-" } }, { name: "status-project-title", selector: '[data-testid="status-project-title"]', key: { closest: 'div[data-testid^="status-project-"]', attr: "data-testid", strip: "status-project-" } }, { name: "status-empty-project", selector: '[data-testid^="status-empty-project-"]', key: { self: !0, attr: "data-testid", strip: "status-empty-project-" } }, { name: "status-empty-project-icon", selector: '[data-testid^="status-empty-project-"] > button:first-child > svg', key: { closest: '[data-testid^="status-empty-project-"]', attr: "data-testid", strip: "status-empty-project-" } }, { name: "status-empty-project-title", selector: '[data-testid^="status-empty-project-"] > button > span.whitespace-nowrap', key: { closest: '[data-testid^="status-empty-project-"]', attr: "data-testid", strip: "status-empty-project-" } }, { name: "settings-bar", selector: "aside.sidebar > div:last-child" }, { name: "settings-gear", selector: '[data-testid="settings-gear"]' }, { name: "settings-gear-icon", selector: '[data-testid="settings-gear"] > svg' }], tabs: [{ name: "tab-strip", selector: '[data-testid="tab-bar"]' }, { name: "tab-slot", selector: "[data-tab-entry]", key: { self: !0, attr: "data-tab-entry" } }, { name: "tab-separator", selector: '[data-testid="tab-separator"]', key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab", selector: "button.tab-bar__tab", key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-icon", selector: 'button.tab-bar__tab > span[aria-hidden="true"]', key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-icon-glyph", selector: 'button.tab-bar__tab > span[aria-hidden="true"] > *', key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-label", selector: "button.tab-bar__tab > span.truncate", key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-dirty", selector: 'button.tab-bar__tab > span[aria-label="unsaved changes"]', key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-close", selector: '[data-tab-entry] > button[aria-label^="Close"]', key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-close-glyph", selector: '[data-tab-entry] > button[aria-label^="Close"] > svg', key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-new", selector: '[data-testid="tab-new"]' }, { name: "tab-new-glyph", selector: '[data-testid="tab-new"] > svg' }], status: [{ name: "status-bar", selector: "footer.status-bar" }, { name: "status-location", selector: ".status-bar__location" }, { name: "status-dot", selector: ".status-bar__location > span:first-child" }, { name: "status-host", selector: '[data-testid="status-host"]' }, { name: "status-cwd", selector: ".status-item--cwd" }, { name: "status-branch", selector: ".status-bar__branch" }, { name: "status-branch-icon", selector: ".status-bar__branch > svg" }, { name: "status-branch-name", selector: ".status-bar__branch > span" }, { name: "status-details", selector: ".status-bar__details" }, { name: "zoom-indicator", selector: '[data-testid="zoom-indicator"]' }, { name: "status-detail", selector: ".status-bar__details > span" }, { name: "status-usage", selector: ".status-bar__usage" }, { name: "usage-summary", selector: '[data-testid="usage-summary"]' }, { name: "usage-unavailable", selector: '[data-testid="usage-summary"] > span:only-child' }, { name: "usage-account", selector: '[data-testid="usage-summary"] > span.flex' }, { name: "usage-account-name", selector: '[data-testid="usage-summary"] > span.flex > span:first-child' }, { name: "usage-window", selector: '[data-testid="usage-summary"] > span.flex > span:not(:first-child)' }, { name: "status-connection", selector: '[data-testid="status-connection"]' }, { name: "status-connection-glyph", selector: '[data-testid="status-connection"] > svg' }], navigator: [{ name: "navigator-scrim", selector: "body > div.fixed.inset-0" }, { name: "navigator-panel", selector: '[data-testid="navigator"]' }, { name: "navigator-input", selector: '[data-testid="navigator-input"]' }, { name: "navigator-chips", selector: '[data-testid="navigator"] > div:nth-child(2)' }, { name: "navigator-chip", selector: '[data-testid^="navigator-filter-"]', key: { self: !0, attr: "data-testid", strip: "navigator-filter-" } }, { name: "navigator-list", selector: '[data-testid="navigator"] > div:nth-child(3)' }, { name: "navigator-notice", selector: '[data-testid="navigator"] > div:nth-child(3) > p[role]' }, { name: "navigator-empty", selector: '[data-testid="navigator"] div.text-center' }, { name: "navigator-command", selector: '[data-testid^="navigator-command-"]', key: { self: !0, attr: "data-testid", strip: "navigator-command-" } }, { name: "navigator-command-title", selector: '[data-testid^="navigator-command-"] > span:first-child', key: { closest: '[data-testid^="navigator-command-"]', attr: "data-testid", strip: "navigator-command-" } }, { name: "navigator-command-detail", selector: '[data-testid^="navigator-command-"] > span:last-child', key: { closest: '[data-testid^="navigator-command-"]', attr: "data-testid", strip: "navigator-command-" } }, { name: "navigator-row", selector: '[data-testid^="navigator-row-"]', key: { self: !0, attr: "data-testid", strip: "navigator-row-" } }, { name: "navigator-row-dot", selector: '[data-testid^="navigator-row-"] > :first-child', key: { closest: '[data-testid^="navigator-row-"]', attr: "data-testid", strip: "navigator-row-" } }, { name: "navigator-row-title", selector: '[data-testid^="navigator-row-"] > span:nth-child(2)', key: { closest: '[data-testid^="navigator-row-"]', attr: "data-testid", strip: "navigator-row-" } }, { name: "navigator-row-detail", selector: '[data-testid^="navigator-row-"] > span:last-child', key: { closest: '[data-testid^="navigator-row-"]', attr: "data-testid", strip: "navigator-row-" } }, { name: "navigator-note", selector: '[data-testid="navigator"] > p:last-child' }], "pane-menu": [{ name: "pane-menu", selector: '[data-testid="pane-context-menu"]' }, { name: "pane-menu-item", selector: '[data-testid="pane-context-menu"] > button', key: { self: !0, attr: "data-testid", strip: "pane-menu-" } }, { name: "pane-menu-divider", selector: '[data-testid="pane-context-menu"] > div.h-px' }, { name: "pane-menu-rename-row", selector: '[data-testid="pane-context-menu"] > div.flex' }, { name: "pane-menu-rename-input", selector: '[data-testid="pane-menu-rename-input"]' }, { name: "pane-menu-rename-confirm", selector: '[data-testid="pane-menu-rename-confirm"]' }], confirm: [{ name: "confirm-scrim", selector: "body > div.fixed.inset-0" }, { name: "confirm-panel", selector: '[data-testid="confirm-dialog"]' }, { name: "confirm-message", selector: ".confirm-dialog__message" }, { name: "confirm-extra", selector: '[data-testid="confirm-dialog"] > :not(.confirm-dialog__message):not(div.flex)' }, { name: "confirm-buttons", selector: '[data-testid="confirm-dialog"] > div.flex' }, { name: "confirm-cancel", selector: '[data-testid="confirm-cancel"]' }, { name: "confirm-accept", selector: '[data-testid="confirm-accept"]' }], dialog: [{ name: "dialog-scrim", selector: "body > div.fixed.inset-0" }, { name: "dialog-panel", selector: '[data-testid="file-name-dialog"]' }, { name: "dialog-title", selector: '[data-testid="file-name-dialog"] > h2' }, { name: "dialog-input", selector: '[data-testid="file-name-input"]' }, { name: "dialog-hint", selector: '[data-testid="file-name-dialog"] > p:not([role])' }, { name: "dialog-error", selector: '[data-testid="file-name-dialog"] > p[role="alert"]' }, { name: "dialog-buttons", selector: '[data-testid="file-name-dialog"] > div.flex' }, { name: "dialog-cancel", selector: '[data-testid="file-name-dialog"] > div.flex > button:first-child' }, { name: "dialog-confirm", selector: '[data-testid="file-name-confirm"]' }], toast: [{ name: "toast-stack", selector: '[data-testid="toast"]' }, { name: "toast-card", selector: '[data-testid="toast"] .animate-toast-in' }, { name: "toast-open", selector: '[data-testid^="toast-"]:not([data-testid^="toast-dismiss-"])' }, { name: "toast-mark", selector: '[data-testid^="toast-"]:not([data-testid^="toast-dismiss-"]) > :first-child' }, { name: "toast-heading", selector: '[data-testid^="toast-"]:not([data-testid^="toast-dismiss-"]) > span.min-w-0 > span:first-child' }, { name: "toast-detail", selector: '[data-testid^="toast-"]:not([data-testid^="toast-dismiss-"]) > span.min-w-0 > span:nth-child(2)' }, { name: "toast-dismiss", selector: '[data-testid^="toast-dismiss-"]' }, { name: "toast-dismiss-glyph", selector: '[data-testid^="toast-dismiss-"] > svg' }], "pane-header": [{ name: "pane-header", selector: '[data-testid^="pane-header-"]', key: { self: !0, attr: "data-testid", strip: "pane-header-" } }, { name: "pane-header-icon", selector: '[data-testid^="pane-header-"] > span.shrink-0:not([data-testid])', key: { closest: '[data-testid^="pane-header-"]', attr: "data-testid", strip: "pane-header-" } }, { name: "pane-header-icon-glyph", selector: '[data-testid^="pane-header-"] > span.shrink-0:not([data-testid]) > *', key: { closest: '[data-testid^="pane-header-"]', attr: "data-testid", strip: "pane-header-" } }, { name: "pane-header-name", selector: '[data-testid^="pane-header-"] > span.truncate', key: { closest: '[data-testid^="pane-header-"]', attr: "data-testid", strip: "pane-header-" } }, { name: "pane-header-state", selector: '[data-testid^="pane-header-"] > span.flex[title]', key: { closest: '[data-testid^="pane-header-"]', attr: "data-testid", strip: "pane-header-" } }, { name: "pane-header-state-dot", selector: '[data-testid^="pane-header-"] > span.flex[title] > span.rounded-full', key: { closest: '[data-testid^="pane-header-"]', attr: "data-testid", strip: "pane-header-" } }, { name: "pane-header-state-word", selector: '[data-testid^="pane-header-"] > span.flex[title] > span.truncate', key: { closest: '[data-testid^="pane-header-"]', attr: "data-testid", strip: "pane-header-" } }, { name: "pane-controls", selector: '[data-testid^="tile-controls-"]', key: { self: !0, attr: "data-testid", strip: "tile-controls-" } }, { name: "pane-expand", selector: '[data-testid^="tile-expand-"]', key: { self: !0, attr: "data-testid", strip: "tile-expand-" } }, { name: "pane-expand-glyph", selector: '[data-testid^="tile-expand-"] > svg', key: { closest: '[data-testid^="tile-expand-"]', attr: "data-testid", strip: "tile-expand-" } }, { name: "pane-close", selector: '[data-testid^="tile-close-"]', key: { self: !0, attr: "data-testid", strip: "tile-close-" } }, { name: "pane-close-glyph", selector: '[data-testid^="tile-close-"] > svg', key: { closest: '[data-testid^="tile-close-"]', attr: "data-testid", strip: "tile-close-" } }, { name: "pane-corner", selector: "div.pointer-events-auto.absolute" }], "new-session": [{ name: "launcher", selector: ".new-session-popover" }, { name: "launcher-filter", selector: '[data-testid="new-tab-filter"]' }, { name: "launcher-list", selector: "#new-tab-launcher-list" }, { name: "launcher-option", selector: '[role="option"]', key: { self: !0, attr: "data-testid" } }, { name: "launcher-option-icon", selector: '[role="option"] > :first-child:not(span.flex-1):not(kbd)', key: { closest: '[role="option"]', attr: "data-testid" } }, { name: "launcher-option-label", selector: '[role="option"] > span.flex-1', key: { closest: '[role="option"]', attr: "data-testid" } }, { name: "launcher-option-key", selector: '[role="option"] > kbd', key: { closest: '[role="option"]', attr: "data-testid" } }, { name: "launcher-note", selector: ".new-session-popover p[role]" }, { name: "agent-select", selector: '[data-testid="new-session-popover-agent"]' }, { name: "agent-manage", selector: ".new-session-popover > div:first-child > button:not([data-testid])" }, { name: "project-option", selector: '[data-testid^="project-option-"]', key: { self: !0, attr: "data-testid", strip: "project-option-" } }, { name: "project-option-name", selector: '[data-testid^="project-option-"]', key: { closest: '[data-testid^="project-option-"]', attr: "data-testid", strip: "project-option-" }, textRange: !0 }, { name: "project-option-path", selector: '[data-testid^="project-option-"] > span', key: { closest: '[data-testid^="project-option-"]', attr: "data-testid", strip: "project-option-" } }], "tab-menu": [{ name: "tab-menu", selector: '[data-testid="tab-split-menu"]' }, { name: "tab-menu-item", selector: '[data-testid="tab-split-menu"] > button', key: { self: !0, attr: "data-testid" } }, { name: "tab-menu-item-label", selector: '[data-testid="tab-split-menu"] > button > span.block', key: { closest: '[data-testid="tab-split-menu"] > button', attr: "data-testid" } }, { name: "tab-menu-heading", selector: '[data-testid="tab-split-menu"] > p' }, { name: "tab-menu-empty", selector: '[data-testid="tab-split-menu"] > div:not(.h-px)' }, { name: "tab-menu-divider", selector: '[data-testid="tab-split-menu"] > div.h-px' }, { name: "tab-menu-rename-form", selector: '[data-testid="tab-split-menu"] > form' }, { name: "tab-menu-rename-input", selector: '[data-testid="tab-menu-rename-input"]' }, { name: "tab-menu-rename-save", selector: '[data-testid="tab-split-menu"] > form > button' }], select: [{ name: "select-field", selector: '[data-testid="select-demo"]' }, { name: "select-field-label", selector: '[data-testid="select-demo"] > span.truncate' }, { name: "select-chevron", selector: '[data-testid="select-demo"] > svg' }, { name: "select-list", selector: '[role="listbox"]' }, { name: "select-option", selector: '[role="listbox"] > [role="option"]', key: { self: !0, attr: "data-value" } }, { name: "select-option-label", selector: '[role="listbox"] > [role="option"] > span.truncate', key: { closest: '[role="option"]', attr: "data-value" } }, { name: "select-option-check", selector: '[role="listbox"] > [role="option"] > span[aria-hidden]', key: { closest: '[role="option"]', attr: "data-value" } }], "keybind-help": [{ name: "keybind-help-scrim", selector: "body > div.fixed.inset-0" }, { name: "keybind-help-panel", selector: '[data-testid="keybind-help"]' }, { name: "keybind-help-header", selector: '[data-testid="keybind-help"] > div:first-child' }, { name: "keybind-help-title", selector: '[data-testid="keybind-help"] h2' }, { name: "keybind-help-close", selector: '[aria-label="Close keybind help"]' }, { name: "keybind-help-close-glyph", selector: '[aria-label="Close keybind help"] > svg' }, { name: "keybind-help-search", selector: '[data-testid="keybind-help-search"]' }, { name: "keybind-help-list", selector: '[data-testid="keybind-help"] > div:last-child' }, { name: "keybind-help-empty", selector: '[data-testid="keybind-help"] div.text-center' }, { name: "keybind-help-group", selector: '[data-testid="keybind-help"] section' }, { name: "keybind-help-group-title", selector: '[data-testid="keybind-help"] section > h3' }, { name: "keybind-help-row", selector: '[data-testid="keybind-help"] li' }, { name: "keybind-help-keys", selector: '[data-testid="keybind-help"] li > kbd' }, { name: "keybind-help-description", selector: '[data-testid="keybind-help"] li > span' }], launcher: [{ name: "launcher-scrim", selector: "body > div.fixed.inset-0" }, { name: "launcher-panel", selector: '[data-testid="new-session-dialog"]' }, { name: "launcher-title", selector: '[data-testid="new-session-dialog"] > p' }, { name: "launcher-filter", selector: '[data-testid="new-session-filter"]' }, { name: "launcher-list", selector: "#new-session-list" }, { name: "launcher-row", selector: '[data-testid^="new-session-row-"]', key: { self: !0, attr: "data-testid", strip: "new-session-row-" } }, { name: "launcher-row-icon", selector: '[data-testid^="new-session-row-"] > :first-child:not(span):not(kbd)', key: { closest: '[data-testid^="new-session-row-"]', attr: "data-testid", strip: "new-session-row-" } }, { name: "launcher-row-label", selector: '[data-testid^="new-session-row-"] > span.shrink-0', key: { closest: '[data-testid^="new-session-row-"]', attr: "data-testid", strip: "new-session-row-" } }, { name: "launcher-row-detail", selector: '[data-testid^="new-session-row-"] > span.ml-auto', key: { closest: '[data-testid^="new-session-row-"]', attr: "data-testid", strip: "new-session-row-" } }, { name: "launcher-row-key", selector: '[data-testid^="new-session-row-"] > kbd', key: { closest: '[data-testid^="new-session-row-"]', attr: "data-testid", strip: "new-session-row-" } }, { name: "launcher-note", selector: "#new-session-list > p" }], "session-menu": [{ name: "tab-menu", selector: '[data-testid="tab-split-menu"]' }, { name: "tab-menu-item", selector: '[data-testid="tab-split-menu"] > button', key: { self: !0, attr: "data-testid" } }, { name: "tab-menu-item-label", selector: '[data-testid="tab-split-menu"] > button > span.block', key: { closest: '[data-testid="tab-split-menu"] > button', attr: "data-testid" } }, { name: "tab-menu-heading", selector: '[data-testid="tab-split-menu"] > p' }, { name: "tab-menu-empty", selector: '[data-testid="tab-split-menu"] > div:not(.h-px)' }, { name: "tab-menu-divider", selector: '[data-testid="tab-split-menu"] > div.h-px' }], "tab-drag": [{ name: "tab-drag-layer", selector: '[data-testid="tab-drag-layer"]' }, { name: "tab-drag-pane", selector: '[data-testid="tab-drag-layer"] > div.bg-surface-1\\/30' }, { name: "tab-drop-zone", selector: '[data-testid="tab-drop-zone"]', key: { self: !0, attr: "data-zone" } }, { name: "tab-drop-label", selector: '[data-testid="tab-drop-zone"] > span' }, { name: "tab-drag-ghost", selector: '[data-testid="tab-drag-ghost"]' }], start: [{ name: "start-panel", selector: '[data-testid="no-session-panel"], [data-testid="cli-start-panel"]' }, { name: "start-column", selector: '[data-testid$="-panel"] > div' }, { name: "start-logo", selector: '[data-testid="no-session-panel"] img' }, { name: "start-name", selector: '[data-testid$="-panel"] h1, [data-testid="no-session-panel"] h1, [data-testid="no-session-panel"] h2' }, { name: "start-hint", selector: '[data-testid$="-panel"] p' }, { name: "start-target", selector: '[data-testid="workspace-start-target"], [data-testid="cli-start-target"]' }, { name: "start-action", selector: '[data-testid="home-add-project"], [data-testid="no-session-create"], [data-testid^="workspace-start-"]:not([data-testid="workspace-start-target"]), [data-testid^="cli-start-agent-"]', key: { self: !0, attr: "data-testid" } }, { name: "start-status", selector: '[role="status"], [role="alert"]' }, { name: "start-status-action", selector: '[role="status"] > button, [role="alert"] > button' }, { name: "start-link", selector: '[data-testid$="-panel"] button.text-subtext-0' }, { name: "start-shortcut-row", selector: '[data-testid="no-session-panel"] dl > div' }, { name: "start-shortcut-label", selector: '[data-testid="no-session-panel"] dl dt' }, { name: "start-shortcut-key", selector: '[data-testid="no-session-panel"] dl kbd' }], "folder-browser": [{ name: "folder-browser", selector: '[data-testid="dir-browser"]' }, { name: "folder-browser-mode-toggle", selector: '[data-testid="dir-browser-mode-toggle"]' }, { name: "folder-browser-up", selector: '[data-testid="dir-browser-up"]' }, { name: "folder-browser-crumbs", selector: '[data-testid="dir-browser"] span.min-w-0.flex-1' }, { name: "folder-browser-crumb", selector: '[data-testid="dir-browser"] span.min-w-0.flex-1 button' }, { name: "folder-browser-filter", selector: '[data-testid="dir-browser-filter"]' }, { name: "folder-browser-list", selector: '[data-testid="dir-browser"] div.overflow-y-auto' }, { name: "folder-browser-entry", selector: '[data-testid^="dir-browser-entry-"]', key: { self: !0, attr: "data-testid", strip: "dir-browser-entry-" } }, { name: "folder-browser-entry-name", selector: '[data-testid^="dir-browser-entry-"] > span:first-child', key: { closest: '[data-testid^="dir-browser-entry-"]', attr: "data-testid", strip: "dir-browser-entry-" } }, { name: "folder-browser-git", selector: '[data-testid^="dir-browser-entry-"] > span:last-child:not(:first-child)', key: { closest: '[data-testid^="dir-browser-entry-"]', attr: "data-testid", strip: "dir-browser-entry-" } }, { name: "folder-browser-note", selector: '[data-testid="dir-browser"] div.overflow-y-auto > div' }, { name: "folder-browser-use", selector: '[data-testid="dir-browser-use"]' }, { name: "folder-browser-path-input", selector: '[data-testid="project-path-input"]' }], instructions: [{ name: "instructions-scrim", selector: "body > div.fixed.inset-0" }, { name: "instructions-panel", selector: '[data-testid="instructions-dialog"]' }, { name: "instructions-title", selector: '[data-testid="instructions-dialog"] > h2' }, { name: "instructions-intro", selector: '[data-testid="instructions-dialog"] > p' }, { name: "instructions-label", selector: '[data-testid="instructions-dialog"] > label > span:first-child' }, { name: "instructions-count", selector: '[data-testid="instructions-count"]' }, { name: "instructions-text", selector: '[data-testid="instructions-text"]' }, { name: "instructions-folders", selector: '[data-testid="instructions-folders"]' }, { name: "instructions-error", selector: '[data-testid="instructions-error"]' }, { name: "instructions-cancel", selector: '[data-testid="instructions-dialog"] > div.flex.justify-end > button:first-child' }, { name: "instructions-save", selector: '[data-testid="instructions-save"]' }], memory: [{ name: "memory-scrim", selector: "body > div.fixed.inset-0", key: { self: !0, attr: "data-testid" } }, { name: "memory-panel", selector: '[data-testid="memory-dialog"]' }, { name: "memory-title", selector: '[data-testid="memory-dialog"] > h2' }, { name: "memory-intro", selector: '[data-testid="memory-dialog"] > p' }, { name: "memory-caps", selector: '[data-testid="memory-caps"]' }, { name: "memory-new", selector: '[data-testid="memory-new"]' }, { name: "memory-enabled", selector: '[data-testid="memory-enabled"]' }, { name: "memory-enabled-label", selector: '[data-testid="memory-dialog"] > label.flex > span' }, { name: "memory-note", selector: '[data-testid="memory-dialog"] > span.text-subtext-0' }, { name: "memory-row", selector: '[data-testid^="memory-row-"]', key: { self: !0, attr: "data-testid", strip: "memory-row-" } }, { name: "memory-open", selector: '[data-testid^="memory-open-"]', key: { self: !0, attr: "data-testid", strip: "memory-open-" } }, { name: "memory-file-title", selector: '[data-testid^="memory-row-"] button > span:first-child', key: { closest: '[data-testid^="memory-row-"]', attr: "data-testid", strip: "memory-row-" } }, { name: "memory-file-summary", selector: '[data-testid^="memory-row-"] button > span.truncate', key: { closest: '[data-testid^="memory-row-"]', attr: "data-testid", strip: "memory-row-" } }, { name: "memory-file-meta", selector: '[data-testid^="memory-row-"] button > span:last-child', key: { closest: '[data-testid^="memory-row-"]', attr: "data-testid", strip: "memory-row-" } }, { name: "memory-delete", selector: '[data-testid^="memory-delete-"]', key: { self: !0, attr: "data-testid", strip: "memory-delete-" } }, { name: "memory-error", selector: '[data-testid="memory-error"]' }, { name: "memory-close", selector: '[data-testid="memory-dialog"] > div.flex.justify-end > button' }, { name: "memory-file-name", selector: '[data-testid="memory-file-name"]' }, { name: "memory-name", selector: '[data-testid="memory-name"]' }, { name: "memory-count", selector: '[data-testid="memory-count"]' }, { name: "memory-text", selector: '[data-testid="memory-text"]' }, { name: "memory-conflict", selector: '[data-testid="memory-conflict"]' }, { name: "memory-reload", selector: '[data-testid="memory-reload"]' }, { name: "memory-back", selector: '[data-testid="memory-back"]' }, { name: "memory-save", selector: '[data-testid="memory-save"]' }, { name: "memory-confirm", selector: '[data-testid="confirm-dialog"]' }, { name: "memory-confirm-message", selector: ".confirm-dialog__message" }], worktree: [{ name: "worktree-plus", selector: '[data-testid^="worktree-menu-"]' }, { name: "worktree-popover", selector: '[role="dialog"][aria-label="Git worktrees"]' }, { name: "worktree-heading", selector: '[role="dialog"][aria-label="Git worktrees"] > div:first-child > span:first-child' }, { name: "worktree-project", selector: '[role="dialog"][aria-label="Git worktrees"] > div:first-child > span:last-child' }, { name: "worktree-list", selector: '[role="dialog"][aria-label="Git worktrees"] > div.overflow-y-auto' }, { name: "worktree-note", selector: '[role="dialog"][aria-label="Git worktrees"] > div.overflow-y-auto > div:not(.worktree-menu__entry)' }, { name: "worktree-entry", selector: '[data-testid^="worktree-entry-"]', key: { self: !0, attr: "data-testid", strip: "worktree-entry-" } }, { name: "worktree-entry-branch", selector: ".worktree-menu__entry-branch", key: { closest: '[data-testid^="worktree-entry-"]', attr: "data-testid", strip: "worktree-entry-" } }, { name: "worktree-badge", selector: '[data-testid^="worktree-entry-"] .worktree-menu__entry-branch > span', key: { closest: '[data-testid^="worktree-entry-"]', attr: "data-testid", strip: "worktree-entry-" } }, { name: "worktree-entry-path", selector: ".worktree-menu__entry-path", key: { closest: '[data-testid^="worktree-entry-"]', attr: "data-testid", strip: "worktree-entry-" } }, { name: "worktree-open", selector: '[data-testid^="worktree-open-"]', key: { self: !0, attr: "data-testid", strip: "worktree-open-" } }, { name: "worktree-remove", selector: '[data-testid^="worktree-remove-"]', key: { self: !0, attr: "data-testid", strip: "worktree-remove-" } }, { name: "worktree-error", selector: '[data-testid="worktree-error"]' }, { name: "worktree-new", selector: '[data-testid="worktree-new"]' }, { name: "worktree-name-input", selector: '[data-testid="worktree-name-input"]' }, { name: "worktree-start-input", selector: '[data-testid="worktree-start-input"]' }, { name: "worktree-branch-input", selector: '[data-testid="worktree-branch-input"]' }, { name: "worktree-parent-select", selector: '[data-testid="worktree-parent-select"]' }, { name: "worktree-new-branch", selector: '[data-testid="worktree-new-branch"]' }, { name: "worktree-path-input", selector: '[data-testid="worktree-path-input"]' }, { name: "worktree-agent-select", selector: '[data-testid="worktree-agent-select"]' }, { name: "worktree-create-cancel", selector: '[data-testid="worktree-create-cancel"]' }, { name: "worktree-create-submit", selector: '[data-testid="worktree-create-submit"]' }, { name: "worktree-confirm", selector: '[data-testid="confirm-dialog"]' }, { name: "worktree-confirm-message", selector: ".confirm-dialog__message" }, { name: "worktree-confirm-accept", selector: '[data-testid="confirm-accept"]' }, { name: "worktree-confirm-cancel", selector: '[data-testid="confirm-cancel"]' }], "terminal-search": [{ name: "terminal-frame", selector: '[data-testid="persistent-agent-terminal"]' }, { name: "term-search", selector: '[data-testid="term-search"]' }, { name: "term-search-input", selector: '[data-testid="term-search-input"]' }, { name: "term-search-button", selector: '[data-testid="term-search"] > button', key: { self: !0, attr: "title" } }], "agent-control": [{ name: "terminal-frame", selector: '[data-testid="persistent-agent-terminal"]' }, { name: "agent-control-chip", selector: '[data-testid="agent-control-chip"]' }, { name: "agent-control-label", selector: '[data-testid="agent-control-chip"] > span' }, { name: "agent-control-button", selector: '[data-testid="agent-control-chip"] > button' }, { name: "agent-control-error", selector: ".terminal__cli-error" }, { name: "agent-control-ended", selector: ".terminal__exited", key: { self: !0, attr: "data-testid" } }, { name: "agent-control-ended-text", selector: ".terminal__exited-text" }, { name: "agent-control-ended-button", selector: ".terminal__exited-actions > button", key: { self: !0, attr: "data-testid" } }], "phone-size": [{ name: "terminal-frame", selector: '[data-testid="persistent-agent-terminal"]' }, { name: "phone-size-notice", selector: '[data-testid="phone-size-notice"]' }, { name: "phone-size-chip", selector: '[data-testid="phone-size-chip"]' }, { name: "phone-size-heading", selector: '[data-testid="phone-size-notice"] span.font-semibold' }, { name: "phone-size-text", selector: '[data-testid="phone-size-notice"] span:not(.font-semibold)' }, { name: "phone-size-fold", selector: '[aria-label="Keep phone size and hide this"]' }, { name: "phone-size-button", selector: '[data-testid="phone-size-notice"] div.flex.flex-wrap > button, [data-testid="phone-size-chip"] > button' }], window: [{ name: "sidebar-card", selector: '[data-testid="sidebar-card"]' }, { name: "main-card", selector: '[data-testid="main-card"]' }, { name: "tools-card", selector: '[data-testid="tools-card"]' }, { name: "sidebar-toggle", selector: '[data-testid="sidebar-collapse-toggle"]' }, { name: "drawer-toggle", selector: '[data-testid="workspace-tools-toggle"]' }, { name: "resize-sidebar", selector: '[data-testid="resize-sidebar"]' }, { name: "resize-tools", selector: '[data-testid="resize-tools"]' }, { name: "tools-tab", selector: 'nav[aria-label="Files, Git and Browser"] > button' }, { name: "status-bar", selector: "footer.status-bar" }], settings: [{ name: "settings-modal", selector: '[data-testid="settings-modal"]' }, { name: "settings-nav-card", selector: '[data-testid="settings-modal"] > nav' }, { name: "settings-close", selector: '[data-testid="settings-close"]' }, { name: "settings-nav", selector: 'nav [data-testid^="settings-nav-"]', key: { self: !0, attr: "data-testid", strip: "settings-nav-" } }, { name: "settings-main-card", selector: '[data-testid="settings-modal"] > main' }, { name: "settings-search", selector: '[data-testid="settings-search"]' }, { name: "settings-title", selector: '[data-testid="settings-modal"] > main h1' }, { name: "settings-body", selector: '[data-testid="settings-modal"] .settings-modal__body' }, { name: "settings-group-title", selector: '[data-testid="settings-modal"] > main h3' }, { name: "settings-group-card", selector: '[data-testid="settings-modal"] > main section > div.rounded-ui' }, { name: "settings-row", selector: '[data-testid="settings-modal"] [data-setting-row]' }, { name: "settings-row-title", selector: '[data-testid="settings-modal"] [data-setting-row] > div:first-child > div:first-child' }, { name: "settings-row-description", selector: '[data-testid="settings-modal"] [data-setting-row] > div:first-child > div:nth-child(2)' }, { name: "settings-result-title", selector: '[data-testid^="settings-result-"] > h2' }] };
export {
  zy as NAMED_ELEMENTS,
  m0 as React,
  X0 as SCHEMA,
  Sy as STYLE_KEYS,
  Ey as describeToGpui,
  xy as jsxRuntime,
  wy as mount,
  _y as reactDom,
  ky as sdk
};
