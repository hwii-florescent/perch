function vs(n, l) {
  for (var o = 0; o < l.length; o++) {
    const i = l[o];
    if (typeof i != "string" && !Array.isArray(i)) {
      for (const s in i)
        if (s !== "default" && !(s in n)) {
          const d = Object.getOwnPropertyDescriptor(i, s);
          d && Object.defineProperty(n, s, d.get ? d : {
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
const $h = /* @__PURE__ */ new Set(["hover", "focus", "focus-visible", "focus-within", "active", "disabled", "enabled", "checked"]), Ph = /* @__PURE__ */ new Set(["not", "is", "where", "has", "nth-child"]), t0 = /* @__PURE__ */ new Set(["first-child", "last-child", "only-child", "root", ...$h]);
function ts(n) {
  return n.replace(/\\(?:([0-9a-fA-F]{1,6})\s?|([\s\S]))/g, (l, o, i) => o ? String.fromCodePoint(parseInt(o, 16)) : i);
}
function bl(n, l) {
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
  return [ts(n.slice(l, o)), o];
}
function e0(n, l) {
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
function ys(n) {
  const l = [];
  let o = 0, i = 0;
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
    d === "(" || d === "[" ? o++ : d === ")" || d === "]" ? o-- : d === "," && o === 0 && (l.push(n.slice(i, s).trim()), i = s + 1);
  }
  return l.push(n.slice(i).trim()), l.filter(Boolean);
}
function n0(n, l) {
  const o = { tag: null, id: null, classes: [], attrs: [], pseudos: [], pseudoElement: null };
  let i = !1;
  for (; l < n.length; ) {
    const s = n[l];
    if (s === "*") {
      o.tag = "*", l++, i = !0;
      continue;
    }
    if (s === ".") {
      const [d, m] = bl(n, l + 1);
      o.classes.push(d), l = m, i = !0;
      continue;
    }
    if (s === "#") {
      const [d, m] = bl(n, l + 1);
      o.id = d, l = m, i = !0;
      continue;
    }
    if (s === "[") {
      const d = n.indexOf("]", l);
      if (d < 0) throw new re(`unclosed [ in ${JSON.stringify(n)}`);
      const m = n.slice(l + 1, d).trim(), f = /^([^\s~^$*|=]+)\s*(?:([~^$*|]?=)\s*(?:"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'|([^\s"'\]]+)))?\s*(i)?$/.exec(m);
      if (!f) throw new re(`cannot read the attribute selector [${m}]`);
      const p = f[3] ?? f[4] ?? f[5];
      o.attrs.push({ name: ts(f[1]).toLowerCase(), op: f[2] ?? null, value: p === void 0 ? null : ts(p) }), l = d + 1, i = !0;
      continue;
    }
    if (s === ":") {
      if (n[l + 1] === ":") {
        const [p, v] = bl(n, l + 2), S = p.toLowerCase();
        if (S !== "before" && S !== "after") throw new re(`::${S} is not supported`);
        if (o.pseudoElement = S, l = v, i = !0, l < n.length && !/[\s>]/.test(n[l])) throw new re(`nothing may follow ::${S} in ${JSON.stringify(n)}`);
        break;
      }
      const [d, m] = bl(n, l + 1);
      l = m;
      const f = d.toLowerCase();
      if ((f === "before" || f === "after") && n[l] !== "(") {
        if (o.pseudoElement = f, i = !0, l < n.length && !/[\s>]/.test(n[l])) throw new re(`nothing may follow :${f} in ${JSON.stringify(n)}`);
        break;
      }
      if (n[l] === "(") {
        if (!Ph.has(f)) throw new re(`:${f}() is not supported`);
        const p = e0(n, l + 1), v = n.slice(l + 1, p).trim();
        if (l = p + 1, f === "nth-child") {
          if (!/^\d+$/.test(v)) throw new re(`:nth-child(${v}) is not supported (only a number)`);
          o.pseudos.push({ name: f, n: Number(v) });
        } else {
          const S = ys(v).map(xs);
          if (f === "has" && S.some((w) => w.length !== 1)) throw new re(`:has(${v}) is not supported (only a compound selector)`);
          o.pseudos.push({ name: f, list: S });
        }
      } else {
        if (!t0.has(f)) throw new re(`:${f} is not supported`);
        o.pseudos.push({ name: f });
      }
      i = !0;
      continue;
    }
    if (/[A-Za-z_\-\\]/.test(s) && !i) {
      const [d, m] = bl(n, l);
      o.tag = d.toLowerCase(), l = m, i = !0;
      continue;
    }
    break;
  }
  if (!i) throw new re(`empty compound selector at ${l} in ${JSON.stringify(n)}`);
  return [o, l];
}
function xs(n) {
  const l = [];
  let o = 0, i = null;
  for (n = n.trim(); o < n.length; ) {
    const [s, d] = n0(n, o);
    if (l.at(-1)?.compound.pseudoElement) throw new re(`::${l.at(-1).compound.pseudoElement} must end ${JSON.stringify(n)}`);
    l.push({ compound: s, combinator: i }), o = d;
    let m = !1;
    for (; n[o] === " " || n[o] === `
` || n[o] === "	"; )
      o++, m = !0;
    if (o >= n.length) break;
    const f = n[o];
    if (f === ">")
      for (i = ">", o++; n[o] === " "; ) o++;
    else {
      if (f === "+" || f === "~") throw new re(`the ${f} combinator is not supported`);
      if (m) i = " ";
      else throw new re(`unexpected ${JSON.stringify(f)} in ${JSON.stringify(n)}`);
    }
  }
  if (!l.length) throw new re("empty selector");
  return l;
}
const Td = /* @__PURE__ */ new Map();
function ti(n) {
  let l = Td.get(n);
  return l || (l = ys(n).map(xs), Td.set(n, l)), l;
}
function Sf(n) {
  const l = [0, 0, 0], o = (i) => {
    l[0] += i[0], l[1] += i[1], l[2] += i[2];
  };
  for (const { compound: i } of n) {
    i.id && l[0]++, l[1] += i.classes.length + i.attrs.length, i.tag && i.tag !== "*" && l[2]++, i.pseudoElement && l[2]++;
    for (const s of i.pseudos)
      if (s.name !== "where")
        if (s.list) {
          const d = s.list.map(Sf).sort((m, f) => f[0] - m[0] || f[1] - m[1] || f[2] - m[2])[0];
          o(d);
        } else l[1]++;
  }
  return l;
}
function a0(n, { name: l, op: o, value: i }) {
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
function Tr(n) {
  return n.parentElement ? n.parentElement.children : [n];
}
function Ef(n, l) {
  for (const o of n.children) if (l(o) || Ef(o, l)) return !0;
  return !1;
}
function zf(n, l, o, i) {
  if ((l.pseudoElement ?? null) !== (i ? o.pseudo ?? null : null) || l.tag && l.tag !== "*" && n.tagName !== l.tag || l.id && n.getAttribute("id") !== l.id) return !1;
  if (l.classes.length) {
    const s = n.classList ?? [];
    for (const d of l.classes) if (!s.includes(d)) return !1;
  }
  for (const s of l.attrs) if (!a0(n, s)) return !1;
  for (const s of l.pseudos)
    switch (s.name) {
      case "first-child":
        if (Tr(n)[0] !== n) return !1;
        break;
      case "only-child":
        if (Tr(n).length !== 1) return !1;
        break;
      case "last-child": {
        const d = Tr(n);
        if (d[d.length - 1] !== n) return !1;
        break;
      }
      case "nth-child":
        if (Tr(n).indexOf(n) !== s.n - 1) return !1;
        break;
      case "root":
        if (!n.isDocumentRoot) return !1;
        break;
      case "not":
        if (s.list.some((d) => qa(n, d, o, i))) return !1;
        break;
      case "has":
        if (n.watchesDescendants = !0, !s.list.some(([{ compound: d }]) => Ef(n, (m) => zf(m, d, o, !1)))) return !1;
        break;
      case "is":
      case "where":
        if (!s.list.some((d) => qa(n, d, o, i))) return !1;
        break;
      default:
        if (!o.state || !o.state(n, s.name, i)) return !1;
    }
  return !0;
}
function qa(n, l, o, i = !0) {
  const s = (d, m, f) => {
    const { compound: p, combinator: v } = l[m];
    if (!zf(d, p, o, f)) return !1;
    if (m === 0) return !0;
    if (v === ">") return !!d.parentElement && s(d.parentElement, m - 1, !1);
    for (let S = d.parentElement; S; S = S.parentElement) if (s(S, m - 1, !1)) return !0;
    return !1;
  };
  return s(n, l.length - 1, i);
}
function l0(n, l, o = {}) {
  return (typeof l == "string" ? ti(l) : l).some((s) => qa(n, s, o));
}
function Nf(n, l, o = {}) {
  return qa(n, l, o);
}
function Sl(n, l, o = {}) {
  const i = ti(l), s = [], d = (m) => {
    for (const f of m.children)
      i.some((p) => qa(f, p, o)) && s.push(f), d(f);
  };
  return d(n), s;
}
function Tf(n, l, o = {}) {
  const i = ti(l);
  for (let s = n; s; s = s.parentElement) if (i.some((d) => qa(s, d, o))) return s;
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
let r0 = 1;
class es {
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
class ws {
  constructor() {
    this.listeners = [];
  }
  addEventListener(l, o, i) {
    const s = i === !0 || !!i?.capture;
    this.listeners.some((d) => d.type === l && d.listener === o && d.capture === s) || this.listeners.push({ type: l, listener: o, capture: s });
  }
  removeEventListener(l, o, i) {
    const s = i === !0 || !!i?.capture;
    this.listeners = this.listeners.filter((d) => !(d.type === l && d.listener === o && d.capture === s));
  }
}
class ei {
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
class Pt extends ws {
  constructor(l, o = {}, i = null) {
    super(), this.nodeType = 1, this.id = `n${r0++}`, this.tagName = l.toLowerCase(), this.props = o, this.childNodes = [], this.parentNode = null, this.ownerDocument = i, this.hidden = !1, this.state = { hover: !1, focus: !1, active: !1 }, this.bounds = null, this.version = 0;
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
    return this.parentNode instanceof Pt ? this.parentNode : null;
  }
  get children() {
    return this.childNodes.filter((l) => l instanceof Pt);
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
      o.startsWith("data-") && i != null && i !== !1 && (l[o.slice(5).replace(/-([a-z])/g, (s, d) => d.toUpperCase())] = String(i));
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
      const d = l.replace(/-([a-z])/g, (m, f) => f.toUpperCase());
      s = o[d];
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
    return l0(this, l);
  }
  closest(l) {
    return Tf(this, l);
  }
  querySelectorAll(l) {
    return Sl(this, l);
  }
  querySelector(l) {
    return Sl(this, l)[0] ?? null;
  }
  /** Where the engine last laid this element out (`HostDocument.measure`); else, before its first layout, a box the
   * engine reported another way (the direct children of a scroll area, a pressed element); else a zero box. */
  getBoundingClientRect() {
    const l = this.ownerDocument?.measure?.(this) ?? this.ownerDocument?.itemBounds?.(this.id) ?? this.bounds;
    return l ? new es(l.x, l.y, l.width, l.height) : new es();
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
    const l = this, o = (m) => String(m).startsWith("--") ? String(m) : String(m).replace(/-([a-z])/g, (f, p) => p.toUpperCase()), i = (m) => {
      const f = l.props.style?.[m];
      return f == null || typeof f == "boolean" ? "" : typeof f == "number" && f !== 0 ? `${f}px` : String(f);
    }, s = (m) => l.inline && m in l.inline ? l.inline[m] : i(m), d = (m, f) => {
      const p = f == null ? "" : String(f);
      s(m) !== p && (l.inline ??= {}, p === i(m) ? delete l.inline[m] : l.inline[m] = p, l.touch(), l.ownerDocument?.restyled());
    };
    return this.styleView = new Proxy({}, {
      get: (m, f) => {
        if (typeof f == "string")
          return f === "setProperty" ? (p, v) => d(o(p), v) : f === "removeProperty" ? (p) => {
            const v = s(o(p));
            return d(o(p), ""), v;
          } : f === "getPropertyValue" ? (p) => s(o(p)) : s(f);
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
    return Cd(this);
  }
  /** `outerHTML` without the attributes named in `omit` (by their DOM names), as the web's drag strips its copy. */
  copyMarkup(l = []) {
    return Cd(this, l);
  }
}
const Cf = Symbol("perch.stale-layout"), Mf = 3;
let Br = !1;
function Af(n) {
  return () => {
    let l, o = !1;
    const i = (s) => {
      const d = Br;
      Br = s < Mf;
      try {
        l = n();
      } catch (m) {
        const f = m?.[Cf];
        if (!f) throw m;
        f.retries.push(() => {
          o || i(s + 1);
        });
      } finally {
        Br = d;
      }
    };
    return i(0), () => {
      o = !0, typeof l == "function" && l();
    };
  };
}
const ns = "perch-dom:", i0 = /* @__PURE__ */ new Set(["children", "key", "ref", "dangerouslySetInnerHTML"]), o0 = { class: "className", for: "htmlFor", tabindex: "tabIndex" };
function Cd(n, l = []) {
  const o = new Set(l.map((s) => o0[s] ?? s)), i = (s) => {
    if (!(s instanceof Pt)) return { x: s.data, ...s.hidden ? { h: 1 } : {} };
    const d = {};
    for (const [m, f] of Object.entries(s.props))
      i0.has(m) || o.has(m) || f == null || typeof f == "function" || typeof f == "symbol" || (d[m] = f);
    return { t: s.tagName, p: d, c: s.childNodes.map(i), ...s.hidden ? { h: 1 } : {} };
  };
  return ns + JSON.stringify(i(n));
}
function s0(n, l) {
  if (typeof n != "string" || !n.startsWith(ns)) return null;
  let o;
  try {
    o = JSON.parse(n.slice(ns.length));
  } catch {
    return null;
  }
  const i = (d) => !!d && typeof d == "object" && !Array.isArray(d), s = (d) => {
    if (!i(d)) throw new Error("not a node");
    let m;
    if (typeof d.x == "string") m = new ei(d.x);
    else {
      if (typeof d.t != "string" || !/^[a-z][a-z0-9-]*$/i.test(d.t) || !i(d.p) || !Array.isArray(d.c)) throw new Error("not an element");
      m = new Pt(d.t, d.p, l);
      for (const f of d.c) m.appendChild(s(f));
    }
    return m.hidden = d.h === 1, m;
  };
  try {
    return [s(o)];
  } catch {
    return null;
  }
}
class c0 {
  observe() {
  }
  unobserve() {
  }
  disconnect() {
  }
}
class u0 {
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
function Md(n) {
  for (let l = n; l instanceof Pt; l = l.parentElement) l.touch();
}
class d0 extends ws {
  constructor(l) {
    super(), this.perch = l, this.documentElement = new Pt("html", {}, this), this.body = new Pt("body", {}, this), this.documentElement.appendChild(this.body), this.activeElement = this.body, this.retries = [];
  }
  createElement(l) {
    return new Pt(l, {}, this);
  }
  /** `element`'s box as the engine last laid it out, or null before its first layout or without an engine that
   * reports boxes (`perch.bounds`). The first ask marks the element to be measured from the next frame on. Inside an
   * effect (`measured`) a box older than the tree, or none yet, puts the effect off until the next frame. */
  measure(l) {
    const o = this.perch?.bounds;
    if (typeof o != "function" || !this.measureKey) return null;
    l.measured || (l.measured = !0, l.touch(), this.restyled());
    const i = o(this.measureKey(l));
    if (Br && (!i || this.stale?.())) throw { [Cf]: this };
    return i ?? null;
  }
  /** An element's `style` was written: the tree is described again once the writing script is done. */
  restyled() {
    this.restyling || (this.restyling = !0, queueMicrotask(() => {
      this.restyling = !1, this.afterCommit?.();
    }));
  }
  focus(l) {
    this.activeElement && this.activeElement !== l && this.blur(this.activeElement), this.activeElement = l, l.state.focus = !0, l.state.pointerFocus = !1, Md(l), this.perch?.focused?.(l);
  }
  blur(l) {
    l.state.focus = !1, Md(l), this.activeElement === l && (this.activeElement = this.body);
  }
  querySelectorAll(l) {
    return Sl(this.documentElement, l);
  }
  querySelector(l) {
    return this.querySelectorAll(l)[0] ?? null;
  }
  /** The element whose `id` prop is `id` (React's `useId` ids are not selectors). */
  getElementById(l) {
    return Sl(this.documentElement, "*").find((o) => o.props?.id === l) ?? null;
  }
}
class f0 extends ws {
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
function jf(n) {
  return {
    setTimeout: (l, o = 0, ...i) => n.setTimeout(() => l(...i), Math.max(0, Number(o) || 0)),
    clearTimeout: (l) => {
      l != null && n.clearTimeout(l);
    }
  };
}
const Ad = Symbol.for("perch.react.globals");
function Je(n, l, o) {
  Object.defineProperty(n, l, { value: o, configurable: !0, writable: !0, enumerable: !1 });
}
function m0(n, l = globalThis) {
  const o = new d0(n), i = new f0(n, o);
  o.defaultView = i;
  const s = n.storage ?? new u0();
  if (typeof l.setTimeout != "function") {
    if (typeof n.setTimeout != "function") throw new Error("the engine has no setTimeout and the perch host gives none (perch.setTimeout)");
    const f = jf(n);
    Je(l, "setTimeout", f.setTimeout), Je(l, "clearTimeout", f.clearTimeout);
  }
  typeof l.queueMicrotask != "function" && Je(l, "queueMicrotask", (f) => {
    Promise.resolve().then(f);
  }), Je(l, "requestAnimationFrame", (f) => l.setTimeout(() => f(Date.now()), 0)), Je(l, "cancelAnimationFrame", (f) => l.clearTimeout(f));
  const d = { document: o, window: i, localStorage: s, HTMLElement: Pt, Element: Pt };
  for (const f of Object.keys(d))
    Object.defineProperty(l, f, { get: () => l[Ad]?.[f], configurable: !0, enumerable: !1 });
  l[Ad] = d, Je(l, "DOMRect", es), Je(l, "getComputedStyle", p0), typeof l.ResizeObserver != "function" && Je(l, "ResizeObserver", c0);
  const m = l.navigator && typeof l.navigator == "object" ? l.navigator : {};
  if (!m.clipboard && n.clipboard)
    try {
      Je(m, "clipboard", n.clipboard);
    } catch {
    }
  return l.navigator || Je(l, "navigator", m), { document: o, window: i, globals: d };
}
function p0(n) {
  const l = n?.ownerDocument?.computed?.(n) ?? {}, o = (i) => {
    const s = l[i];
    return typeof s == "string" || typeof s == "number" ? String(s) : "";
  };
  return new Proxy({}, {
    get: (i, s) => {
      if (typeof s == "string")
        return s === "getPropertyValue" ? (d) => o(String(d)) : o(s.replace(/[A-Z]/g, (d) => `-${d.toLowerCase()}`));
    }
  });
}
function as(n, l = !1) {
  if (!(l ? n?.tagName === "input" && Of(n) : n?.tagName === "button" && !/^(button|reset)$/.test(String(n.props.type ?? "submit")) && !n.props.disabled)) return null;
  for (let i = n.parentElement; i; i = i.parentElement) if (i.tagName === "form") return i;
  return null;
}
const Of = (n) => n?.tagName === "textarea" || n?.tagName === "input" && /^(text|search|url|email|tel|password|number|)$/.test(String(n.props.type ?? ""));
//! Evaluated before anything else in the runtime bundle: React's scheduler reads `setTimeout` and `queueMicrotask`
//! once, when it loads, so an engine without them (QuickJS) gets the host's (`perch.setTimeout`) first.
const jd = globalThis.perch;
if (typeof globalThis.setTimeout != "function" && typeof jd?.setTimeout == "function") {
  const n = jf(jd);
  globalThis.setTimeout = n.setTimeout, globalThis.clearTimeout = n.clearTimeout;
}
typeof globalThis.queueMicrotask != "function" && (globalThis.queueMicrotask = (n) => {
  Promise.resolve().then(n);
});
function _s(n) {
  return n && n.__esModule && Object.prototype.hasOwnProperty.call(n, "default") ? n.default : n;
}
function h0(n) {
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
var Qo = { exports: {} }, pt = {};
/**
 * @license React
 * react.production.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var Od;
function g0() {
  if (Od) return pt;
  Od = 1;
  var n = Symbol.for("react.transitional.element"), l = Symbol.for("react.portal"), o = Symbol.for("react.fragment"), i = Symbol.for("react.strict_mode"), s = Symbol.for("react.profiler"), d = Symbol.for("react.consumer"), m = Symbol.for("react.context"), f = Symbol.for("react.forward_ref"), p = Symbol.for("react.suspense"), v = Symbol.for("react.memo"), S = Symbol.for("react.lazy"), w = Symbol.for("react.activity"), x = Symbol.iterator;
  function z(T) {
    return T === null || typeof T != "object" ? null : (T = x && T[x] || T["@@iterator"], typeof T == "function" ? T : null);
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
  }, _ = Object.assign, k = {};
  function N(T, K, at) {
    this.props = T, this.context = K, this.refs = k, this.updater = at || E;
  }
  N.prototype.isReactComponent = {}, N.prototype.setState = function(T, K) {
    if (typeof T != "object" && typeof T != "function" && T != null)
      throw Error(
        "takes an object of state variables to update or a function which returns an object of state variables."
      );
    this.updater.enqueueSetState(this, T, K, "setState");
  }, N.prototype.forceUpdate = function(T) {
    this.updater.enqueueForceUpdate(this, T, "forceUpdate");
  };
  function D() {
  }
  D.prototype = N.prototype;
  function O(T, K, at) {
    this.props = T, this.context = K, this.refs = k, this.updater = at || E;
  }
  var X = O.prototype = new D();
  X.constructor = O, _(X, N.prototype), X.isPureReactComponent = !0;
  var q = Array.isArray;
  function H() {
  }
  var h = { H: null, A: null, T: null, S: null }, b = Object.prototype.hasOwnProperty;
  function y(T, K, at) {
    var st = at.ref;
    return {
      $$typeof: n,
      type: T,
      key: K,
      ref: st !== void 0 ? st : null,
      props: at
    };
  }
  function A(T, K) {
    return y(T.type, K, T.props);
  }
  function j(T) {
    return typeof T == "object" && T !== null && T.$$typeof === n;
  }
  function M(T) {
    var K = { "=": "=0", ":": "=2" };
    return "$" + T.replace(/[=:]/g, function(at) {
      return K[at];
    });
  }
  var U = /\/+/g;
  function Z(T, K) {
    return typeof T == "object" && T !== null && T.key != null ? M("" + T.key) : K.toString(36);
  }
  function F(T) {
    switch (T.status) {
      case "fulfilled":
        return T.value;
      case "rejected":
        throw T.reason;
      default:
        switch (typeof T.status == "string" ? T.then(H, H) : (T.status = "pending", T.then(
          function(K) {
            T.status === "pending" && (T.status = "fulfilled", T.value = K);
          },
          function(K) {
            T.status === "pending" && (T.status = "rejected", T.reason = K);
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
  function Q(T, K, at, st, ct) {
    var ut = typeof T;
    (ut === "undefined" || ut === "boolean") && (T = null);
    var Et = !1;
    if (T === null) Et = !0;
    else
      switch (ut) {
        case "bigint":
        case "string":
        case "number":
          Et = !0;
          break;
        case "object":
          switch (T.$$typeof) {
            case n:
            case l:
              Et = !0;
              break;
            case S:
              return Et = T._init, Q(
                Et(T._payload),
                K,
                at,
                st,
                ct
              );
          }
      }
    if (Et)
      return ct = ct(T), Et = st === "" ? "." + Z(T, 0) : st, q(ct) ? (at = "", Et != null && (at = Et.replace(U, "$&/") + "/"), Q(ct, K, at, "", function(Gn) {
        return Gn;
      })) : ct != null && (j(ct) && (ct = A(
        ct,
        at + (ct.key == null || T && T.key === ct.key ? "" : ("" + ct.key).replace(
          U,
          "$&/"
        ) + "/") + Et
      )), K.push(ct)), 1;
    Et = 0;
    var Wt = st === "" ? "." : st + ":";
    if (q(T))
      for (var ht = 0; ht < T.length; ht++)
        st = T[ht], ut = Wt + Z(st, ht), Et += Q(
          st,
          K,
          at,
          ut,
          ct
        );
    else if (ht = z(T), typeof ht == "function")
      for (T = ht.call(T), ht = 0; !(st = T.next()).done; )
        st = st.value, ut = Wt + Z(st, ht++), Et += Q(
          st,
          K,
          at,
          ut,
          ct
        );
    else if (ut === "object") {
      if (typeof T.then == "function")
        return Q(
          F(T),
          K,
          at,
          st,
          ct
        );
      throw K = String(T), Error(
        "Objects are not valid as a React child (found: " + (K === "[object Object]" ? "object with keys {" + Object.keys(T).join(", ") + "}" : K) + "). If you meant to render a collection of children, use an array instead."
      );
    }
    return Et;
  }
  function J(T, K, at) {
    if (T == null) return T;
    var st = [], ct = 0;
    return Q(T, st, "", "", function(ut) {
      return K.call(at, ut, ct++);
    }), st;
  }
  function I(T) {
    if (T._status === -1) {
      var K = T._result;
      K = K(), K.then(
        function(at) {
          (T._status === 0 || T._status === -1) && (T._status = 1, T._result = at);
        },
        function(at) {
          (T._status === 0 || T._status === -1) && (T._status = 2, T._result = at);
        }
      ), T._status === -1 && (T._status = 0, T._result = K);
    }
    if (T._status === 1) return T._result.default;
    throw T._result;
  }
  var L = typeof reportError == "function" ? reportError : function(T) {
    if (typeof window == "object" && typeof window.ErrorEvent == "function") {
      var K = new window.ErrorEvent("error", {
        bubbles: !0,
        cancelable: !0,
        message: typeof T == "object" && T !== null && typeof T.message == "string" ? String(T.message) : String(T),
        error: T
      });
      if (!window.dispatchEvent(K)) return;
    } else if (typeof process == "object" && typeof process.emit == "function") {
      process.emit("uncaughtException", T);
      return;
    }
    console.error(T);
  }, V = {
    map: J,
    forEach: function(T, K, at) {
      J(
        T,
        function() {
          K.apply(this, arguments);
        },
        at
      );
    },
    count: function(T) {
      var K = 0;
      return J(T, function() {
        K++;
      }), K;
    },
    toArray: function(T) {
      return J(T, function(K) {
        return K;
      }) || [];
    },
    only: function(T) {
      if (!j(T))
        throw Error(
          "React.Children.only expected to receive a single React element child."
        );
      return T;
    }
  };
  return pt.Activity = w, pt.Children = V, pt.Component = N, pt.Fragment = o, pt.Profiler = s, pt.PureComponent = O, pt.StrictMode = i, pt.Suspense = p, pt.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE = h, pt.__COMPILER_RUNTIME = {
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
  }, pt.cloneElement = function(T, K, at) {
    if (T == null)
      throw Error(
        "The argument must be a React element, but you passed " + T + "."
      );
    var st = _({}, T.props), ct = T.key;
    if (K != null)
      for (ut in K.key !== void 0 && (ct = "" + K.key), K)
        !b.call(K, ut) || ut === "key" || ut === "__self" || ut === "__source" || ut === "ref" && K.ref === void 0 || (st[ut] = K[ut]);
    var ut = arguments.length - 2;
    if (ut === 1) st.children = at;
    else if (1 < ut) {
      for (var Et = Array(ut), Wt = 0; Wt < ut; Wt++)
        Et[Wt] = arguments[Wt + 2];
      st.children = Et;
    }
    return y(T.type, ct, st);
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
  }, pt.createElement = function(T, K, at) {
    var st, ct = {}, ut = null;
    if (K != null)
      for (st in K.key !== void 0 && (ut = "" + K.key), K)
        b.call(K, st) && st !== "key" && st !== "__self" && st !== "__source" && (ct[st] = K[st]);
    var Et = arguments.length - 2;
    if (Et === 1) ct.children = at;
    else if (1 < Et) {
      for (var Wt = Array(Et), ht = 0; ht < Et; ht++)
        Wt[ht] = arguments[ht + 2];
      ct.children = Wt;
    }
    if (T && T.defaultProps)
      for (st in Et = T.defaultProps, Et)
        ct[st] === void 0 && (ct[st] = Et[st]);
    return y(T, ut, ct);
  }, pt.createRef = function() {
    return { current: null };
  }, pt.forwardRef = function(T) {
    return { $$typeof: f, render: T };
  }, pt.isValidElement = j, pt.lazy = function(T) {
    return {
      $$typeof: S,
      _payload: { _status: -1, _result: T },
      _init: I
    };
  }, pt.memo = function(T, K) {
    return {
      $$typeof: v,
      type: T,
      compare: K === void 0 ? null : K
    };
  }, pt.startTransition = function(T) {
    var K = h.T, at = {};
    h.T = at;
    try {
      var st = T(), ct = h.S;
      ct !== null && ct(at, st), typeof st == "object" && st !== null && typeof st.then == "function" && st.then(H, L);
    } catch (ut) {
      L(ut);
    } finally {
      K !== null && at.types !== null && (K.types = at.types), h.T = K;
    }
  }, pt.unstable_useCacheRefresh = function() {
    return h.H.useCacheRefresh();
  }, pt.use = function(T) {
    return h.H.use(T);
  }, pt.useActionState = function(T, K, at) {
    return h.H.useActionState(T, K, at);
  }, pt.useCallback = function(T, K) {
    return h.H.useCallback(T, K);
  }, pt.useContext = function(T) {
    return h.H.useContext(T);
  }, pt.useDebugValue = function() {
  }, pt.useDeferredValue = function(T, K) {
    return h.H.useDeferredValue(T, K);
  }, pt.useEffect = function(T, K) {
    return h.H.useEffect(T, K);
  }, pt.useEffectEvent = function(T) {
    return h.H.useEffectEvent(T);
  }, pt.useId = function() {
    return h.H.useId();
  }, pt.useImperativeHandle = function(T, K, at) {
    return h.H.useImperativeHandle(T, K, at);
  }, pt.useInsertionEffect = function(T, K) {
    return h.H.useInsertionEffect(T, K);
  }, pt.useLayoutEffect = function(T, K) {
    return h.H.useLayoutEffect(T, K);
  }, pt.useMemo = function(T, K) {
    return h.H.useMemo(T, K);
  }, pt.useOptimistic = function(T, K) {
    return h.H.useOptimistic(T, K);
  }, pt.useReducer = function(T, K, at) {
    return h.H.useReducer(T, K, at);
  }, pt.useRef = function(T) {
    return h.H.useRef(T);
  }, pt.useState = function(T) {
    return h.H.useState(T);
  }, pt.useSyncExternalStore = function(T, K, at) {
    return h.H.useSyncExternalStore(
      T,
      K,
      at
    );
  }, pt.useTransition = function() {
    return h.H.useTransition();
  }, pt.version = "19.2.8", pt;
}
var Rd;
function b0() {
  return Rd || (Rd = 1, Qo.exports = g0()), Qo.exports;
}
var et = b0();
const Rf = /* @__PURE__ */ _s(et), v0 = /* @__PURE__ */ vs({
  __proto__: null,
  default: Rf
}, [et]);
//! "react" as the runtime bundles it, for its own code, the stock screens and every screen's `react` import: React
//! itself, with `useEffect` and `useLayoutEffect` run through `measured` (`dom.mjs`), so an effect that measures a
//! box the engine has not laid out yet runs again once it has (layout readback).
const y0 = Rf ?? v0;
function oe(n, l) {
  return et.useEffect(Af(n), l);
}
function Vr(n, l) {
  return et.useLayoutEffect(Af(n), l);
}
const x0 = /* @__PURE__ */ vs({
  __proto__: null,
  default: y0,
  useEffect: oe,
  useLayoutEffect: Vr
}, [et]);
var Vo = { exports: {} }, vl = {};
/**
 * @license React
 * react-jsx-runtime.production.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var Dd;
function w0() {
  if (Dd) return vl;
  Dd = 1;
  var n = Symbol.for("react.transitional.element"), l = Symbol.for("react.fragment");
  function o(i, s, d) {
    var m = null;
    if (d !== void 0 && (m = "" + d), s.key !== void 0 && (m = "" + s.key), "key" in s) {
      d = {};
      for (var f in s)
        f !== "key" && (d[f] = s[f]);
    } else d = s;
    return s = d.ref, {
      $$typeof: n,
      type: i,
      key: m,
      ref: s !== void 0 ? s : null,
      props: d
    };
  }
  return vl.Fragment = l, vl.jsx = o, vl.jsxs = o, vl;
}
var Hd;
function _0() {
  return Hd || (Hd = 1, Vo.exports = w0()), Vo.exports;
}
var tt = _0();
const k0 = /* @__PURE__ */ _s(tt), Ry = /* @__PURE__ */ vs({
  __proto__: null,
  default: k0
}, [tt]);
var Ko = { exports: {} }, Xo = { exports: {} };
const S0 = /* @__PURE__ */ h0(x0);
var Zo = { exports: {} }, Jo = {};
/**
 * @license React
 * scheduler.production.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var Bd;
function E0() {
  return Bd || (Bd = 1, (function(n) {
    function l(Q, J) {
      var I = Q.length;
      Q.push(J);
      t: for (; 0 < I; ) {
        var L = I - 1 >>> 1, V = Q[L];
        if (0 < s(V, J))
          Q[L] = J, Q[I] = V, I = L;
        else break t;
      }
    }
    function o(Q) {
      return Q.length === 0 ? null : Q[0];
    }
    function i(Q) {
      if (Q.length === 0) return null;
      var J = Q[0], I = Q.pop();
      if (I !== J) {
        Q[0] = I;
        t: for (var L = 0, V = Q.length, T = V >>> 1; L < T; ) {
          var K = 2 * (L + 1) - 1, at = Q[K], st = K + 1, ct = Q[st];
          if (0 > s(at, I))
            st < V && 0 > s(ct, at) ? (Q[L] = ct, Q[st] = I, L = st) : (Q[L] = at, Q[K] = I, L = K);
          else if (st < V && 0 > s(ct, I))
            Q[L] = ct, Q[st] = I, L = st;
          else break t;
        }
      }
      return J;
    }
    function s(Q, J) {
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
    var p = [], v = [], S = 1, w = null, x = 3, z = !1, E = !1, _ = !1, k = !1, N = typeof setTimeout == "function" ? setTimeout : null, D = typeof clearTimeout == "function" ? clearTimeout : null, O = typeof setImmediate < "u" ? setImmediate : null;
    function X(Q) {
      for (var J = o(v); J !== null; ) {
        if (J.callback === null) i(v);
        else if (J.startTime <= Q)
          i(v), J.sortIndex = J.expirationTime, l(p, J);
        else break;
        J = o(v);
      }
    }
    function q(Q) {
      if (_ = !1, X(Q), !E)
        if (o(p) !== null)
          E = !0, H || (H = !0, M());
        else {
          var J = o(v);
          J !== null && F(q, J.startTime - Q);
        }
    }
    var H = !1, h = -1, b = 5, y = -1;
    function A() {
      return k ? !0 : !(n.unstable_now() - y < b);
    }
    function j() {
      if (k = !1, H) {
        var Q = n.unstable_now();
        y = Q;
        var J = !0;
        try {
          t: {
            E = !1, _ && (_ = !1, D(h), h = -1), z = !0;
            var I = x;
            try {
              e: {
                for (X(Q), w = o(p); w !== null && !(w.expirationTime > Q && A()); ) {
                  var L = w.callback;
                  if (typeof L == "function") {
                    w.callback = null, x = w.priorityLevel;
                    var V = L(
                      w.expirationTime <= Q
                    );
                    if (Q = n.unstable_now(), typeof V == "function") {
                      w.callback = V, X(Q), J = !0;
                      break e;
                    }
                    w === o(p) && i(p), X(Q);
                  } else i(p);
                  w = o(p);
                }
                if (w !== null) J = !0;
                else {
                  var T = o(v);
                  T !== null && F(
                    q,
                    T.startTime - Q
                  ), J = !1;
                }
              }
              break t;
            } finally {
              w = null, x = I, z = !1;
            }
            J = void 0;
          }
        } finally {
          J ? M() : H = !1;
        }
      }
    }
    var M;
    if (typeof O == "function")
      M = function() {
        O(j);
      };
    else if (typeof MessageChannel < "u") {
      var U = new MessageChannel(), Z = U.port2;
      U.port1.onmessage = j, M = function() {
        Z.postMessage(null);
      };
    } else
      M = function() {
        N(j, 0);
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
      k = !0;
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
      var L = n.unstable_now();
      switch (typeof I == "object" && I !== null ? (I = I.delay, I = typeof I == "number" && 0 < I ? L + I : L) : I = L, Q) {
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
        id: S++,
        callback: J,
        priorityLevel: Q,
        startTime: I,
        expirationTime: V,
        sortIndex: -1
      }, I > L ? (Q.sortIndex = I, l(v, Q), o(p) === null && Q === o(v) && (_ ? (D(h), h = -1) : _ = !0, F(q, I - L))) : (Q.sortIndex = V, l(p, Q), E || z || (E = !0, H || (H = !0, M()))), Q;
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
  })(Jo)), Jo;
}
var Ud;
function z0() {
  return Ud || (Ud = 1, Zo.exports = E0()), Zo.exports;
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
var qd;
function N0() {
  return qd || (qd = 1, (function(n) {
    n.exports = function(l) {
      function o(t, e, a, r) {
        return new ap(t, e, a, r);
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
      function S(t) {
        return t === null || typeof t != "object" ? null : (t = Zu && t[Zu] || t["@@iterator"], typeof t == "function" ? t : null);
      }
      function w(t) {
        if (t == null) return null;
        if (typeof t == "function")
          return t.$$typeof === sp ? null : t.displayName || t.name || null;
        if (typeof t == "string") return t;
        switch (t) {
          case ya:
            return "Fragment";
          case so:
            return "Profiler";
          case Ku:
            return "StrictMode";
          case uo:
            return "Suspense";
          case fo:
            return "SuspenseList";
          case po:
            return "Activity";
        }
        if (typeof t == "object")
          switch (t.$$typeof) {
            case va:
              return "Portal";
            case _n:
              return t.displayName || "Context";
            case Xu:
              return (t._context.displayName || "Context") + ".Consumer";
            case co:
              var e = t.render;
              return t = t.displayName, t || (t = e.displayName || e.name || "", t = t !== "" ? "ForwardRef(" + t + ")" : "ForwardRef"), t;
            case mo:
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
      function x(t) {
        return { current: t };
      }
      function z(t) {
        0 > _a || (t.current = xo[_a], xo[_a] = null, _a--);
      }
      function E(t, e) {
        _a++, xo[_a] = t.current, t.current = e;
      }
      function _(t) {
        return t >>>= 0, t === 0 ? 32 : 31 - (Hh(t) / Bh | 0) | 0;
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
      function N(t, e, a) {
        var r = t.pendingLanes;
        if (r === 0) return 0;
        var c = 0, u = t.suspendedLanes, g = t.pingedLanes;
        t = t.warmLanes;
        var C = r & 134217727;
        return C !== 0 ? (r = C & ~u, r !== 0 ? c = k(r) : (g &= C, g !== 0 ? c = k(g) : a || (a = C & ~t, a !== 0 && (c = k(a))))) : (C = r & ~u, C !== 0 ? c = k(C) : g !== 0 ? c = k(g) : a || (a = r & ~t, a !== 0 && (c = k(a)))), c === 0 ? 0 : e !== 0 && e !== c && (e & u) === 0 && (u = c & -c, a = e & -e, u >= a || u === 32 && (a & 4194048) !== 0) ? e : c;
      }
      function D(t, e) {
        return (t.pendingLanes & ~(t.suspendedLanes & ~t.pingedLanes) & e) === 0;
      }
      function O(t, e) {
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
        var t = cr;
        return cr <<= 1, (cr & 62914560) === 0 && (cr = 4194304), t;
      }
      function q(t) {
        for (var e = [], a = 0; 31 > a; a++) e.push(t);
        return e;
      }
      function H(t, e) {
        t.pendingLanes |= e, e !== 268435456 && (t.suspendedLanes = 0, t.pingedLanes = 0, t.warmLanes = 0);
      }
      function h(t, e, a, r, c, u) {
        var g = t.pendingLanes;
        t.pendingLanes = a, t.suspendedLanes = 0, t.pingedLanes = 0, t.warmLanes = 0, t.expiredLanes &= a, t.entangledLanes &= a, t.errorRecoveryDisabledLanes &= a, t.shellSuspendCounter = 0;
        var C = t.entanglements, G = t.expirationTimes, W = t.hiddenUpdates;
        for (a = g & ~a; 0 < a; ) {
          var nt = 31 - we(a), $ = 1 << nt;
          C[nt] = 0, G[nt] = -1;
          var lt = W[nt];
          if (lt !== null)
            for (W[nt] = null, nt = 0; nt < lt.length; nt++) {
              var gt = lt[nt];
              gt !== null && (gt.lane &= -536870913);
            }
          a &= ~$;
        }
        r !== 0 && b(t, r, 0), u !== 0 && c === 0 && t.tag !== 0 && (t.suspendedLanes |= u & ~(g & ~e));
      }
      function b(t, e, a) {
        t.pendingLanes |= e, t.suspendedLanes &= ~e;
        var r = 31 - we(e);
        t.entangledLanes |= e, t.entanglements[r] = t.entanglements[r] | 1073741824 | a & 261930;
      }
      function y(t, e) {
        var a = t.entangledLanes |= e;
        for (t = t.entanglements; a; ) {
          var r = 31 - we(a), c = 1 << r;
          c & e | t[r] & e && (t[r] |= e), a &= ~c;
        }
      }
      function A(t, e) {
        var a = e & -e;
        return a = (a & 42) !== 0 ? 1 : j(a), (a & (t.suspendedLanes | e)) !== 0 ? 0 : a;
      }
      function j(t) {
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
        if (typeof Lh == "function" && Qh(t), _e && typeof _e.setStrictMode == "function")
          try {
            _e.setStrictMode(rl, t);
          } catch {
          }
      }
      function Z(t, e) {
        return t === e && (t !== 0 || 1 / t === 1 / e) || t !== t && e !== e;
      }
      function F(t) {
        if (ko === void 0)
          try {
            throw Error();
          } catch (a) {
            var e = a.stack.trim().match(/\n( *(at )?)/);
            ko = e && e[1] || "", yd = -1 < a.stack.indexOf(`
    at`) ? " (<anonymous>)" : -1 < a.stack.indexOf("@") ? "@unknown:0:0" : "";
          }
        return `
` + ko + t + yd;
      }
      function Q(t, e) {
        if (!t || So) return "";
        So = !0;
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
                      var lt = gt;
                    }
                    Reflect.construct(t, [], $);
                  } else {
                    try {
                      $.call();
                    } catch (gt) {
                      lt = gt;
                    }
                    t.call($.prototype);
                  }
                } else {
                  try {
                    throw Error();
                  } catch (gt) {
                    lt = gt;
                  }
                  ($ = t()) && typeof $.catch == "function" && $.catch(function() {
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
                      var nt = `
` + G[r].replace(" at new ", " at ");
                      return t.displayName && nt.includes("<anonymous>") && (nt = nt.replace("<anonymous>", t.displayName)), nt;
                    }
                  while (1 <= r && 0 <= c);
                break;
              }
          }
        } finally {
          So = !1, Error.prepareStackTrace = a;
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
      function L(t, e) {
        if (typeof t == "object" && t !== null) {
          var a = xd.get(t);
          return a !== void 0 ? a : (e = {
            value: t,
            source: e,
            stack: I(e)
          }, xd.set(t, e), e);
        }
        return {
          value: t,
          source: e,
          stack: I(e)
        };
      }
      function V(t, e) {
        Sa[Ea++] = il, Sa[Ea++] = dr, dr = t, il = e;
      }
      function T(t, e, a) {
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
      function K(t) {
        t.return !== null && (V(t, 1), T(t, 1, 0));
      }
      function at(t) {
        for (; t === dr; )
          dr = Sa[--Ea], Sa[Ea] = null, il = Sa[--Ea], Sa[Ea] = null;
        for (; t === Sn; )
          Sn = Ce[--Me], Ce[Me] = null, Ze = Ce[--Me], Ce[Me] = null, Xe = Ce[--Me], Ce[Me] = null;
      }
      function st(t, e) {
        Ce[Me++] = Xe, Ce[Me++] = Ze, Ce[Me++] = Sn, Xe = e.id, Ze = e.overflow, Sn = t;
      }
      function ct(t, e) {
        E(En, e), E(ol, t), E(ne, null), t = dp(e), z(ne), E(ne, t);
      }
      function ut() {
        z(ne), z(ol), z(En);
      }
      function Et(t) {
        t.memoizedState !== null && E(fr, t);
        var e = ne.current, a = fp(e, t.type);
        e !== a && (E(ol, t), E(ne, a));
      }
      function Wt(t) {
        ol.current === t && (z(ne), z(ol)), fr.current === t && (z(fr), an ? In._currentValue = xa : In._currentValue2 = xa);
      }
      function ht(t) {
        var e = Error(
          s(
            418,
            1 < arguments.length && arguments[1] !== void 0 && arguments[1] ? "text" : "HTML",
            ""
          )
        );
        throw Ga(L(e, t)), Eo;
      }
      function Gn(t, e) {
        if (!ue) throw Error(s(175));
        fh(
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
        if (Xt ? e !== 3 && e !== 27 && (e !== 5 || id(t.type) && !ir(t.type, t.memoizedProps)) && Ot && ht(t) : e !== 3 && (e !== 5 || id(t.type) && !ir(t.type, t.memoizedProps)) && Ot && ht(t), Ln(t), e === 13) {
          if (!ue) throw Error(s(316));
          if (t = t.memoizedState, t = t !== null ? t.dehydrated : null, !t) throw Error(s(317));
          Ot = bh(t);
        } else if (e === 31) {
          if (t = t.memoizedState, t = t !== null ? t.dehydrated : null, !t) throw Error(s(317));
          Ot = gh(t);
        } else
          Ot = Xt && e === 27 ? nh(
            t.type,
            Ot
          ) : ae ? rd(t.stateNode) : null;
        return !0;
      }
      function He() {
        ue && (Ot = ae = null, St = !1);
      }
      function pn() {
        var t = zn;
        return t !== null && (be === null ? be = t : be.push.apply(
          be,
          t
        ), zn = null), t;
      }
      function Ga(t) {
        zn === null ? zn = [t] : zn.push(t);
      }
      function hn(t, e, a) {
        an ? (E(mr, e._currentValue), e._currentValue = a) : (E(mr, e._currentValue2), e._currentValue2 = a);
      }
      function Ie(t) {
        var e = mr.current;
        an ? t._currentValue = e : t._currentValue2 = e, z(mr);
      }
      function ri(t, e, a) {
        for (; t !== null; ) {
          var r = t.alternate;
          if ((t.childLanes & e) !== e ? (t.childLanes |= e, r !== null && (r.childLanes |= e)) : r !== null && (r.childLanes & e) !== e && (r.childLanes |= e), t === a) break;
          t = t.return;
        }
      }
      function ii(t, e, a, r) {
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
                  u.lanes |= a, C = u.alternate, C !== null && (C.lanes |= a), ri(
                    u.return,
                    a,
                    t
                  ), r || (g = null);
                  break t;
                }
              u = C.next;
            }
          } else if (c.tag === 18) {
            if (g = c.return, g === null) throw Error(s(341));
            g.lanes |= a, u = g.alternate, u !== null && (u.lanes |= a), ri(g, a, t), g = null;
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
              var C = c.type;
              ke(c.pendingProps.value, g.value) || (t !== null ? t.push(C) : t = [C]);
            }
          } else if (c === fr.current) {
            if (g = c.alternate, g === null) throw Error(s(387));
            g.memoizedState.memoizedState !== c.memoizedState.memoizedState && (t !== null ? t.push(In) : t = [In]);
          }
          c = c.return;
        }
        t !== null && ii(
          e,
          t,
          a,
          r
        ), e.flags |= 262144;
      }
      function Cl(t) {
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
      function Qn(t) {
        $n = t, rn = null, t = t.dependencies, t !== null && (t.firstContext = null);
      }
      function te(t) {
        return Os($n, t);
      }
      function Ml(t, e) {
        return $n === null && Qn(t), Os(t, e);
      }
      function Os(t, e) {
        var a = an ? e._currentValue : e._currentValue2;
        if (e = { context: e, memoizedValue: a, next: null }, rn === null) {
          if (t === null) throw Error(s(308));
          rn = e, t.dependencies = { lanes: 0, firstContext: e }, t.flags |= 524288;
        } else rn = rn.next = e;
        return a;
      }
      function oi() {
        return {
          controller: new Kh(),
          data: /* @__PURE__ */ new Map(),
          refCount: 0
        };
      }
      function La(t) {
        t.refCount--, t.refCount === 0 && Xh(Zh, function() {
          t.controller.abort();
        });
      }
      function Al() {
      }
      function Qe(t) {
        t !== za && t.next === null && (za === null ? pr = za = t : za = za.next = t), hr = !0, zo || (zo = !0, Om());
      }
      function ma(t, e) {
        if (!No && hr) {
          No = !0;
          do
            for (var a = !1, r = pr; r !== null; ) {
              if (t !== 0) {
                var c = r.pendingLanes;
                if (c === 0) var u = 0;
                else {
                  var g = r.suspendedLanes, C = r.pingedLanes;
                  u = (1 << 31 - we(42 | t) + 1) - 1, u &= c & ~(g & ~C), u = u & 201326741 ? u & 201326741 | 1 : u ? u | 2 : 0;
                }
                u !== 0 && (a = !0, Us(r, u));
              } else
                u = _t, u = N(
                  r,
                  r === At ? u : 0,
                  r.cancelPendingCommit !== null || r.timeoutHandle !== Fn
                ), (u & 3) === 0 || D(r, u) || (a = !0, Us(r, u));
              r = r.next;
            }
          while (a);
          No = !1;
        }
      }
      function Rs() {
        Ds();
      }
      function Ds() {
        hr = zo = !1;
        var t = 0;
        Pn !== 0 && wp() && (t = Pn);
        for (var e = he(), a = null, r = pr; r !== null; ) {
          var c = r.next, u = Hs(r, e);
          u === 0 ? (r.next = null, a === null ? pr = c : a.next = c, c === null && (za = a)) : (a = r, (t !== 0 || (u & 3) !== 0) && (hr = !0)), r = c;
        }
        Zt !== 0 && Zt !== 5 || ma(t), Pn !== 0 && (Pn = 0);
      }
      function Hs(t, e) {
        for (var a = t.suspendedLanes, r = t.pingedLanes, c = t.expirationTimes, u = t.pendingLanes & -62914561; 0 < u; ) {
          var g = 31 - we(u), C = 1 << g, G = c[g];
          G === -1 ? ((C & a) === 0 || (C & r) !== 0) && (c[g] = O(C, e)) : G <= e && (t.expiredLanes |= C), u &= ~C;
        }
        if (e = At, a = _t, a = N(
          t,
          t === e ? a : 0,
          t.cancelPendingCommit !== null || t.timeoutHandle !== Fn
        ), r = t.callbackNode, a === 0 || t === e && (Ct === 2 || Ct === 9) || t.cancelPendingCommit !== null)
          return r !== null && r !== null && wo(r), t.callbackNode = null, t.callbackPriority = 0;
        if ((a & 3) === 0 || D(t, a)) {
          if (e = a & -a, e === t.callbackPriority) return e;
          switch (r !== null && wo(r), M(a)) {
            case 2:
            case 8:
              a = Yh;
              break;
            case 32:
              a = _o;
              break;
            case 268435456:
              a = Gh;
              break;
            default:
              a = _o;
          }
          return r = Bs.bind(null, t), a = ur(a, r), t.callbackPriority = e, t.callbackNode = a, e;
        }
        return r !== null && r !== null && wo(r), t.callbackPriority = 2, t.callbackNode = null, 2;
      }
      function Bs(t, e) {
        if (Zt !== 0 && Zt !== 5)
          return t.callbackNode = null, t.callbackPriority = 0, null;
        var a = t.callbackNode;
        if (el() && t.callbackNode !== a)
          return null;
        var r = _t;
        return r = N(
          t,
          t === At ? r : 0,
          t.cancelPendingCommit !== null || t.timeoutHandle !== Fn
        ), r === 0 ? null : (xu(t, r, e), Hs(t, he()), t.callbackNode != null && t.callbackNode === a ? Bs.bind(null, t) : null);
      }
      function Us(t, e) {
        if (el()) return null;
        xu(t, e, !0);
      }
      function Om() {
        Tp ? Cp(function() {
          (xt & 6) !== 0 ? ur(
            bd,
            Rs
          ) : Ds();
        }) : ur(
          bd,
          Rs
        );
      }
      function si() {
        if (Pn === 0) {
          var t = Na;
          t === 0 && (t = or, or <<= 1, (or & 261888) === 0 && (or = 256)), Pn = t;
        }
        return Pn;
      }
      function Rm(t, e) {
        if (sl === null) {
          var a = sl = [];
          To = 0, Na = si(), Ta = {
            status: "pending",
            value: void 0,
            then: function(r) {
              a.push(r);
            }
          };
        }
        return To++, e.then(qs, qs), e;
      }
      function qs() {
        if (--To === 0 && sl !== null) {
          Ta !== null && (Ta.status = "fulfilled");
          var t = sl;
          sl = null, Na = 0, Ta = null;
          for (var e = 0; e < t.length; e++) (0, t[e])();
        }
      }
      function Dm(t, e) {
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
      function ci() {
        var t = ta.current;
        return t !== null ? t : At.pooledCache;
      }
      function jl(t, e) {
        e === null ? E(ta, ta.current) : E(ta, e.pool);
      }
      function Ys() {
        var t = ci();
        return t === null ? null : {
          parent: an ? Rt._currentValue : Rt._currentValue2,
          pool: t
        };
      }
      function Ol(t, e) {
        if (ke(t, e)) return !0;
        if (typeof t != "object" || t === null || typeof e != "object" || e === null)
          return !1;
        var a = Object.keys(t), r = Object.keys(e);
        if (a.length !== r.length) return !1;
        for (r = 0; r < a.length; r++) {
          var c = a[r];
          if (!Vh.call(e, c) || !ke(t[c], e[c]))
            return !1;
        }
        return !0;
      }
      function Gs(t) {
        return t = t.status, t === "fulfilled" || t === "rejected";
      }
      function Ls(t, e, a) {
        switch (a = t[a], a === void 0 ? t.push(e) : a !== e && (e.then(Al, Al), e = a), e.status) {
          case "fulfilled":
            return e.value;
          case "rejected":
            throw t = e.reason, Vs(t), t;
          default:
            if (typeof e.status == "string") e.then(Al, Al);
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
                throw t = e.reason, Vs(t), t;
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
      function Qs() {
        if (ea === null) throw Error(s(459));
        var t = ea;
        return ea = null, t;
      }
      function Vs(t) {
        if (t === Ca || t === gr)
          throw Error(s(483));
      }
      function Rl(t) {
        var e = cl;
        return cl += 1, Ma === null && (Ma = []), Ls(Ma, t, e);
      }
      function Qa(t, e) {
        e = e.props.ref, t.ref = e !== void 0 ? e : null;
      }
      function Dl(t, e) {
        throw e.$$typeof === ip ? Error(s(525)) : (t = Object.prototype.toString.call(e), Error(
          s(
            31,
            t === "[object Object]" ? "object with keys {" + Object.keys(e).join(", ") + "}" : t
          )
        ));
      }
      function Ks(t) {
        function e(B, R) {
          if (t) {
            var Y = B.deletions;
            Y === null ? (B.deletions = [R], B.flags |= 16) : Y.push(R);
          }
        }
        function a(B, R) {
          if (!t) return null;
          for (; R !== null; )
            e(B, R), R = R.sibling;
          return null;
        }
        function r(B) {
          for (var R = /* @__PURE__ */ new Map(); B !== null; )
            B.key !== null ? R.set(B.key, B) : R.set(B.index, B), B = B.sibling;
          return R;
        }
        function c(B, R) {
          return B = nn(B, R), B.index = 0, B.sibling = null, B;
        }
        function u(B, R, Y) {
          return B.index = Y, t ? (Y = B.alternate, Y !== null ? (Y = Y.index, Y < R ? (B.flags |= 67108866, R) : Y) : (B.flags |= 67108866, R)) : (B.flags |= 1048576, R);
        }
        function g(B) {
          return t && B.alternate === null && (B.flags |= 67108866), B;
        }
        function C(B, R, Y, P) {
          return R === null || R.tag !== 6 ? (R = lo(Y, B.mode, P), R.return = B, R) : (R = c(R, Y), R.return = B, R);
        }
        function G(B, R, Y, P) {
          var ft = Y.type;
          return ft === ya ? nt(
            B,
            R,
            Y.props.children,
            P,
            Y.key
          ) : R !== null && (R.elementType === ft || typeof ft == "object" && ft !== null && ft.$$typeof === kn && Vn(ft) === R.type) ? (R = c(R, Y.props), Qa(R, Y), R.return = B, R) : (R = ar(
            Y.type,
            Y.key,
            Y.props,
            null,
            B.mode,
            P
          ), Qa(R, Y), R.return = B, R);
        }
        function W(B, R, Y, P) {
          return R === null || R.tag !== 4 || R.stateNode.containerInfo !== Y.containerInfo || R.stateNode.implementation !== Y.implementation ? (R = ro(Y, B.mode, P), R.return = B, R) : (R = c(R, Y.children || []), R.return = B, R);
        }
        function nt(B, R, Y, P, ft) {
          return R === null || R.tag !== 7 ? (R = Wn(
            Y,
            B.mode,
            P,
            ft
          ), R.return = B, R) : (R = c(R, Y), R.return = B, R);
        }
        function $(B, R, Y) {
          if (typeof R == "string" && R !== "" || typeof R == "number" || typeof R == "bigint")
            return R = lo(
              "" + R,
              B.mode,
              Y
            ), R.return = B, R;
          if (typeof R == "object" && R !== null) {
            switch (R.$$typeof) {
              case lr:
                return Y = ar(
                  R.type,
                  R.key,
                  R.props,
                  null,
                  B.mode,
                  Y
                ), Qa(Y, R), Y.return = B, Y;
              case va:
                return R = ro(
                  R,
                  B.mode,
                  Y
                ), R.return = B, R;
              case kn:
                return R = Vn(R), $(B, R, Y);
            }
            if (rr(R) || S(R))
              return R = Wn(
                R,
                B.mode,
                Y,
                null
              ), R.return = B, R;
            if (typeof R.then == "function")
              return $(B, Rl(R), Y);
            if (R.$$typeof === _n)
              return $(
                B,
                Ml(B, R),
                Y
              );
            Dl(B, R);
          }
          return null;
        }
        function lt(B, R, Y, P) {
          var ft = R !== null ? R.key : null;
          if (typeof Y == "string" && Y !== "" || typeof Y == "number" || typeof Y == "bigint")
            return ft !== null ? null : C(B, R, "" + Y, P);
          if (typeof Y == "object" && Y !== null) {
            switch (Y.$$typeof) {
              case lr:
                return Y.key === ft ? G(B, R, Y, P) : null;
              case va:
                return Y.key === ft ? W(B, R, Y, P) : null;
              case kn:
                return Y = Vn(Y), lt(B, R, Y, P);
            }
            if (rr(Y) || S(Y))
              return ft !== null ? null : nt(B, R, Y, P, null);
            if (typeof Y.then == "function")
              return lt(
                B,
                R,
                Rl(Y),
                P
              );
            if (Y.$$typeof === _n)
              return lt(
                B,
                R,
                Ml(B, Y),
                P
              );
            Dl(B, Y);
          }
          return null;
        }
        function gt(B, R, Y, P, ft) {
          if (typeof P == "string" && P !== "" || typeof P == "number" || typeof P == "bigint")
            return B = B.get(Y) || null, C(R, B, "" + P, ft);
          if (typeof P == "object" && P !== null) {
            switch (P.$$typeof) {
              case lr:
                return B = B.get(
                  P.key === null ? Y : P.key
                ) || null, G(R, B, P, ft);
              case va:
                return B = B.get(
                  P.key === null ? Y : P.key
                ) || null, W(R, B, P, ft);
              case kn:
                return P = Vn(P), gt(
                  B,
                  R,
                  Y,
                  P,
                  ft
                );
            }
            if (rr(P) || S(P))
              return B = B.get(Y) || null, nt(R, B, P, ft, null);
            if (typeof P.then == "function")
              return gt(
                B,
                R,
                Y,
                Rl(P),
                ft
              );
            if (P.$$typeof === _n)
              return gt(
                B,
                R,
                Y,
                Ml(R, P),
                ft
              );
            Dl(R, P);
          }
          return null;
        }
        function le(B, R, Y, P) {
          for (var ft = null, Dt = null, mt = R, Nt = R = 0, $t = null; mt !== null && Nt < Y.length; Nt++) {
            mt.index > Nt ? ($t = mt, mt = null) : $t = mt.sibling;
            var Tt = lt(
              B,
              mt,
              Y[Nt],
              P
            );
            if (Tt === null) {
              mt === null && (mt = $t);
              break;
            }
            t && mt && Tt.alternate === null && e(B, mt), R = u(Tt, R, Nt), Dt === null ? ft = Tt : Dt.sibling = Tt, Dt = Tt, mt = $t;
          }
          if (Nt === Y.length)
            return a(B, mt), St && V(B, Nt), ft;
          if (mt === null) {
            for (; Nt < Y.length; Nt++)
              mt = $(B, Y[Nt], P), mt !== null && (R = u(
                mt,
                R,
                Nt
              ), Dt === null ? ft = mt : Dt.sibling = mt, Dt = mt);
            return St && V(B, Nt), ft;
          }
          for (mt = r(mt); Nt < Y.length; Nt++)
            $t = gt(
              mt,
              B,
              Nt,
              Y[Nt],
              P
            ), $t !== null && (t && $t.alternate !== null && mt.delete(
              $t.key === null ? Nt : $t.key
            ), R = u(
              $t,
              R,
              Nt
            ), Dt === null ? ft = $t : Dt.sibling = $t, Dt = $t);
          return t && mt.forEach(function(jn) {
            return e(B, jn);
          }), St && V(B, Nt), ft;
        }
        function gl(B, R, Y, P) {
          if (Y == null) throw Error(s(151));
          for (var ft = null, Dt = null, mt = R, Nt = R = 0, $t = null, Tt = Y.next(); mt !== null && !Tt.done; Nt++, Tt = Y.next()) {
            mt.index > Nt ? ($t = mt, mt = null) : $t = mt.sibling;
            var jn = lt(B, mt, Tt.value, P);
            if (jn === null) {
              mt === null && (mt = $t);
              break;
            }
            t && mt && jn.alternate === null && e(B, mt), R = u(jn, R, Nt), Dt === null ? ft = jn : Dt.sibling = jn, Dt = jn, mt = $t;
          }
          if (Tt.done)
            return a(B, mt), St && V(B, Nt), ft;
          if (mt === null) {
            for (; !Tt.done; Nt++, Tt = Y.next())
              Tt = $(B, Tt.value, P), Tt !== null && (R = u(
                Tt,
                R,
                Nt
              ), Dt === null ? ft = Tt : Dt.sibling = Tt, Dt = Tt);
            return St && V(B, Nt), ft;
          }
          for (mt = r(mt); !Tt.done; Nt++, Tt = Y.next())
            Tt = gt(
              mt,
              B,
              Nt,
              Tt.value,
              P
            ), Tt !== null && (t && Tt.alternate !== null && mt.delete(Tt.key === null ? Nt : Tt.key), R = u(Tt, R, Nt), Dt === null ? ft = Tt : Dt.sibling = Tt, Dt = Tt);
          return t && mt.forEach(function(Ih) {
            return e(B, Ih);
          }), St && V(B, Nt), ft;
        }
        function ra(B, R, Y, P) {
          if (typeof Y == "object" && Y !== null && Y.type === ya && Y.key === null && (Y = Y.props.children), typeof Y == "object" && Y !== null) {
            switch (Y.$$typeof) {
              case lr:
                t: {
                  for (var ft = Y.key; R !== null; ) {
                    if (R.key === ft) {
                      if (ft = Y.type, ft === ya) {
                        if (R.tag === 7) {
                          a(
                            B,
                            R.sibling
                          ), P = c(
                            R,
                            Y.props.children
                          ), P.return = B, B = P;
                          break t;
                        }
                      } else if (R.elementType === ft || typeof ft == "object" && ft !== null && ft.$$typeof === kn && Vn(ft) === R.type) {
                        a(
                          B,
                          R.sibling
                        ), P = c(R, Y.props), Qa(P, Y), P.return = B, B = P;
                        break t;
                      }
                      a(B, R);
                      break;
                    } else e(B, R);
                    R = R.sibling;
                  }
                  Y.type === ya ? (P = Wn(
                    Y.props.children,
                    B.mode,
                    P,
                    Y.key
                  ), P.return = B, B = P) : (P = ar(
                    Y.type,
                    Y.key,
                    Y.props,
                    null,
                    B.mode,
                    P
                  ), Qa(P, Y), P.return = B, B = P);
                }
                return g(B);
              case va:
                t: {
                  for (ft = Y.key; R !== null; ) {
                    if (R.key === ft)
                      if (R.tag === 4 && R.stateNode.containerInfo === Y.containerInfo && R.stateNode.implementation === Y.implementation) {
                        a(
                          B,
                          R.sibling
                        ), P = c(
                          R,
                          Y.children || []
                        ), P.return = B, B = P;
                        break t;
                      } else {
                        a(B, R);
                        break;
                      }
                    else e(B, R);
                    R = R.sibling;
                  }
                  P = ro(Y, B.mode, P), P.return = B, B = P;
                }
                return g(B);
              case kn:
                return Y = Vn(Y), ra(
                  B,
                  R,
                  Y,
                  P
                );
            }
            if (rr(Y))
              return le(
                B,
                R,
                Y,
                P
              );
            if (S(Y)) {
              if (ft = S(Y), typeof ft != "function")
                throw Error(s(150));
              return Y = ft.call(Y), gl(
                B,
                R,
                Y,
                P
              );
            }
            if (typeof Y.then == "function")
              return ra(
                B,
                R,
                Rl(Y),
                P
              );
            if (Y.$$typeof === _n)
              return ra(
                B,
                R,
                Ml(B, Y),
                P
              );
            Dl(B, Y);
          }
          return typeof Y == "string" && Y !== "" || typeof Y == "number" || typeof Y == "bigint" ? (Y = "" + Y, R !== null && R.tag === 6 ? (a(B, R.sibling), P = c(R, Y), P.return = B, B = P) : (a(B, R), P = lo(Y, B.mode, P), P.return = B, B = P), g(B)) : a(B, R);
        }
        return function(B, R, Y, P) {
          try {
            cl = 0;
            var ft = ra(
              B,
              R,
              Y,
              P
            );
            return Ma = null, ft;
          } catch (mt) {
            if (mt === Ca || mt === gr) throw mt;
            var Dt = o(29, mt, null, B.mode);
            return Dt.lanes = P, Dt.return = B, Dt;
          } finally {
          }
        };
      }
      function Hl() {
        for (var t = Aa, e = Mo = Aa = 0; e < t; ) {
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
          u !== 0 && Xs(a, c, u);
        }
      }
      function Bl(t, e, a, r) {
        je[Aa++] = t, je[Aa++] = e, je[Aa++] = a, je[Aa++] = r, Mo |= r, t.lanes |= r, t = t.alternate, t !== null && (t.lanes |= r);
      }
      function ui(t, e, a, r) {
        return Bl(t, e, a, r), Ul(t);
      }
      function Kn(t, e) {
        return Bl(t, null, null, e), Ul(t);
      }
      function Xs(t, e, a) {
        t.lanes |= a;
        var r = t.alternate;
        r !== null && (r.lanes |= a);
        for (var c = !1, u = t.return; u !== null; )
          u.childLanes |= a, r = u.alternate, r !== null && (r.childLanes |= a), u.tag === 22 && (t = u.stateNode, t === null || t._visibility & 1 || (c = !0)), t = u, u = u.return;
        return t.tag === 3 ? (u = t.stateNode, c && e !== null && (c = 31 - we(a), t = u.hiddenUpdates, r = t[c], r === null ? t[c] = [e] : r.push(e), e.lane = a | 536870912), u) : null;
      }
      function Ul(t) {
        if (50 < hl)
          throw hl = 0, Lo = null, Error(s(185));
        for (var e = t.return; e !== null; )
          t = e, e = t.return;
        return t.tag === 3 ? t.stateNode : null;
      }
      function di(t) {
        t.updateQueue = {
          baseState: t.memoizedState,
          firstBaseUpdate: null,
          lastBaseUpdate: null,
          shared: { pending: null, lanes: 0, hiddenCallbacks: null },
          callbacks: null
        };
      }
      function fi(t, e) {
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
          return c === null ? e.next = e : (e.next = c.next, c.next = e), r.pending = e, e = Ul(t), Xs(t, null, a), e;
        }
        return Bl(t, r, e, a), Ul(t);
      }
      function Va(t, e, a) {
        if (e = e.updateQueue, e !== null && (e = e.shared, (a & 4194048) !== 0)) {
          var r = e.lanes;
          r &= t.pendingLanes, a |= r, e.lanes = a, y(t, a);
        }
      }
      function mi(t, e) {
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
      function Ka() {
        if (Ao) {
          var t = Ta;
          if (t !== null) throw t;
        }
      }
      function Xa(t, e, a, r) {
        Ao = !1;
        var c = t.updateQueue;
        Nn = !1;
        var u = c.firstBaseUpdate, g = c.lastBaseUpdate, C = c.shared.pending;
        if (C !== null) {
          c.shared.pending = null;
          var G = C, W = G.next;
          G.next = null, g === null ? u = W : g.next = W, g = G;
          var nt = t.alternate;
          nt !== null && (nt = nt.updateQueue, C = nt.lastBaseUpdate, C !== g && (C === null ? nt.firstBaseUpdate = W : C.next = W, nt.lastBaseUpdate = G));
        }
        if (u !== null) {
          var $ = c.baseState;
          g = 0, nt = W = G = null, C = u;
          do {
            var lt = C.lane & -536870913, gt = lt !== C.lane;
            if (gt ? (_t & lt) === lt : (r & lt) === lt) {
              lt !== 0 && lt === Na && (Ao = !0), nt !== null && (nt = nt.next = {
                lane: 0,
                tag: C.tag,
                payload: C.payload,
                callback: null,
                next: null
              });
              t: {
                var le = t, gl = C;
                lt = e;
                var ra = a;
                switch (gl.tag) {
                  case 1:
                    if (le = gl.payload, typeof le == "function") {
                      $ = le.call(
                        ra,
                        $,
                        lt
                      );
                      break t;
                    }
                    $ = le;
                    break t;
                  case 3:
                    le.flags = le.flags & -65537 | 128;
                  case 0:
                    if (le = gl.payload, lt = typeof le == "function" ? le.call(ra, $, lt) : le, lt == null) break t;
                    $ = oo({}, $, lt);
                    break t;
                  case 2:
                    Nn = !0;
                }
              }
              lt = C.callback, lt !== null && (t.flags |= 64, gt && (t.flags |= 8192), gt = c.callbacks, gt === null ? c.callbacks = [lt] : gt.push(lt));
            } else
              gt = {
                lane: lt,
                tag: C.tag,
                payload: C.payload,
                callback: C.callback,
                next: null
              }, nt === null ? (W = nt = gt, G = $) : nt = nt.next = gt, g |= lt;
            if (C = C.next, C === null) {
              if (C = c.shared.pending, C === null)
                break;
              gt = C, C = gt.next, gt.next = null, c.lastBaseUpdate = gt, c.shared.pending = null;
            }
          } while (!0);
          nt === null && (G = $), c.baseState = G, c.firstBaseUpdate = W, c.lastBaseUpdate = nt, u === null && (c.shared.lanes = 0), Cn |= g, t.lanes = g, t.memoizedState = $;
        }
      }
      function Zs(t, e) {
        if (typeof t != "function")
          throw Error(s(191, t));
        t.call(e);
      }
      function Js(t, e) {
        var a = t.callbacks;
        if (a !== null)
          for (t.callbacks = null, t = 0; t < a.length; t++)
            Zs(a[t], e);
      }
      function Ws(t, e) {
        t = cn, E(vr, t), E(ja, e), cn = t | e.baseLanes;
      }
      function pi() {
        E(vr, cn), E(ja, ja.current);
      }
      function hi() {
        cn = vr.current, z(ja), z(vr);
      }
      function vn(t) {
        var e = t.alternate;
        E(Yt, Yt.current & 1), E(Se, t), Oe === null && (e === null || ja.current !== null || e.memoizedState !== null) && (Oe = t);
      }
      function gi(t) {
        E(Yt, Yt.current), E(Se, t), Oe === null && (Oe = t);
      }
      function Fs(t) {
        t.tag === 22 ? (E(Yt, Yt.current), E(Se, t), Oe === null && (Oe = t)) : yn();
      }
      function yn() {
        E(Yt, Yt.current), E(Se, Se.current);
      }
      function ve(t) {
        z(Se), Oe === t && (Oe = null), z(Yt);
      }
      function ql(t) {
        for (var e = t; e !== null; ) {
          if (e.tag === 13) {
            var a = e.memoizedState;
            if (a !== null && (a = a.dehydrated, a === null || bo(a) || vo(a)))
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
      function bi(t, e) {
        if (e === null) return !1;
        for (var a = 0; a < e.length && a < t.length; a++)
          if (!ke(t[a], e[a])) return !1;
        return !0;
      }
      function vi(t, e, a, r, c, u) {
        return on = u, bt = e, e.memoizedState = null, e.updateQueue = null, e.lanes = 0, dt.H = t === null || t.memoizedState === null ? kd : jo, aa = !1, u = a(r, c), aa = !1, Oa && (u = $s(
          e,
          a,
          r,
          c
        )), Is(t), u;
      }
      function Is(t) {
        dt.H = dl;
        var e = Mt !== null && Mt.next !== null;
        if (on = 0, Gt = Mt = bt = null, yr = !1, ul = 0, Ra = null, e) throw Error(s(300));
        t === null || Lt || (t = t.dependencies, t !== null && Cl(t) && (Lt = !0));
      }
      function $s(t, e, a, r) {
        bt = t;
        var c = 0;
        do {
          if (Oa && (Ra = null), ul = 0, Oa = !1, 25 <= c) throw Error(s(301));
          if (c += 1, Gt = Mt = null, t.updateQueue != null) {
            var u = t.updateQueue;
            u.lastEffect = null, u.events = null, u.stores = null, u.memoCache != null && (u.memoCache.index = 0);
          }
          dt.H = Sd, u = e(a, r);
        } while (Oa);
        return u;
      }
      function Hm() {
        var t = dt.H, e = t.useState()[0];
        return e = typeof e.then == "function" ? Za(e) : e, t = t.useState()[0], (Mt !== null ? Mt.memoizedState : null) !== t && (bt.flags |= 1024), e;
      }
      function yi() {
        var t = xr !== 0;
        return xr = 0, t;
      }
      function xi(t, e, a) {
        e.updateQueue = t.updateQueue, e.flags &= -2053, t.lanes &= ~a;
      }
      function wi(t) {
        if (yr) {
          for (t = t.memoizedState; t !== null; ) {
            var e = t.queue;
            e !== null && (e.pending = null), t = t.next;
          }
          yr = !1;
        }
        on = 0, Gt = Mt = bt = null, Oa = !1, ul = xr = 0, Ra = null;
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
      function Yl() {
        return { lastEffect: null, events: null, stores: null, memoCache: null };
      }
      function Za(t) {
        var e = ul;
        return ul += 1, Ra === null && (Ra = []), t = Ls(Ra, t, e), e = bt, (Gt === null ? e.memoizedState : Gt.next) === null && (e = e.alternate, dt.H = e === null || e.memoizedState === null ? kd : jo), t;
      }
      function Gl(t) {
        if (t !== null && typeof t == "object") {
          if (typeof t.then == "function") return Za(t);
          if (t.$$typeof === _n) return te(t);
        }
        throw Error(s(438, String(t)));
      }
      function _i(t) {
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
        if (e == null && (e = { data: [], index: 0 }), a === null && (a = Yl(), bt.updateQueue = a), a.memoCache = e, a = e.data[e.index], a === void 0)
          for (a = e.data[e.index] = Array(t), r = 0; r < t; r++)
            a[r] = op;
        return e.index++, a;
      }
      function $e(t, e) {
        return typeof e == "function" ? e(t) : e;
      }
      function Ll(t) {
        var e = qt();
        return ki(e, Mt, t);
      }
      function ki(t, e, a) {
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
          var C = g = null, G = null, W = e, nt = !1;
          do {
            var $ = W.lane & -536870913;
            if ($ !== W.lane ? (_t & $) === $ : (on & $) === $) {
              var lt = W.revertLane;
              if (lt === 0)
                G !== null && (G = G.next = {
                  lane: 0,
                  revertLane: 0,
                  gesture: null,
                  action: W.action,
                  hasEagerState: W.hasEagerState,
                  eagerState: W.eagerState,
                  next: null
                }), $ === Na && (nt = !0);
              else if ((on & lt) === lt) {
                W = W.next, lt === Na && (nt = !0);
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
                }, G === null ? (C = G = $, g = u) : G = G.next = $, bt.lanes |= lt, Cn |= lt;
              $ = W.action, aa && a(u, $), u = W.hasEagerState ? W.eagerState : a(u, $);
            } else
              lt = {
                lane: $,
                revertLane: W.revertLane,
                gesture: W.gesture,
                action: W.action,
                hasEagerState: W.hasEagerState,
                eagerState: W.eagerState,
                next: null
              }, G === null ? (C = G = lt, g = u) : G = G.next = lt, bt.lanes |= $, Cn |= $;
            W = W.next;
          } while (W !== null && W !== e);
          if (G === null ? g = u : G.next = C, !ke(u, t.memoizedState) && (Lt = !0, nt && (a = Ta, a !== null)))
            throw a;
          t.memoizedState = u, t.baseState = g, t.baseQueue = G, r.lastRenderedState = u;
        }
        return c === null && (r.lanes = 0), [t.memoizedState, r.dispatch];
      }
      function Si(t) {
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
          ke(u, e.memoizedState) || (Lt = !0), e.memoizedState = u, e.baseQueue === null && (e.baseState = u), a.lastRenderedState = u;
        }
        return [u, r];
      }
      function Ps(t, e, a) {
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
        if (g && (c.memoizedState = a, Lt = !0), c = c.queue, Ni(nc.bind(null, r, c, t), [
          t
        ]), c.getSnapshot !== e || g || Gt !== null && Gt.memoizedState.tag & 1) {
          if (r.flags |= 2048, pa(
            9,
            { destroy: void 0 },
            ec.bind(
              null,
              r,
              c,
              a,
              e
            ),
            null
          ), At === null) throw Error(s(349));
          u || (on & 127) !== 0 || tc(r, e, a);
        }
        return a;
      }
      function tc(t, e, a) {
        t.flags |= 16384, t = { getSnapshot: e, value: a }, e = bt.updateQueue, e === null ? (e = Yl(), bt.updateQueue = e, e.stores = [t]) : (a = e.stores, a === null ? e.stores = [t] : a.push(t));
      }
      function ec(t, e, a, r) {
        e.value = a, e.getSnapshot = r, ac(e) && lc(t);
      }
      function nc(t, e, a) {
        return a(function() {
          ac(e) && lc(t);
        });
      }
      function ac(t) {
        var e = t.getSnapshot;
        t = t.value;
        try {
          var a = e();
          return !ke(t, a);
        } catch {
          return !0;
        }
      }
      function lc(t) {
        var e = Kn(t, 2);
        e !== null && pe(e, t, 2);
      }
      function Ei(t) {
        var e = fe();
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
      function rc(t, e, a, r) {
        return t.baseState = a, ki(
          t,
          Mt,
          typeof r == "function" ? r : $e
        );
      }
      function Bm(t, e, a, r, c) {
        if (Kl(t)) throw Error(s(485));
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
          dt.T !== null ? a(!0) : u.isTransition = !1, r(u), a = e.pending, a === null ? (u.next = e.pending = u, ic(e, u)) : (u.next = a.next, e.pending = a.next = u);
        }
      }
      function ic(t, e) {
        var a = e.action, r = e.payload, c = t.state;
        if (e.isTransition) {
          var u = dt.T, g = {};
          dt.T = g;
          try {
            var C = a(c, r), G = dt.S;
            G !== null && G(g, C), oc(t, e, C);
          } catch (W) {
            zi(t, e, W);
          } finally {
            u !== null && g.types !== null && (u.types = g.types), dt.T = u;
          }
        } else
          try {
            u = a(c, r), oc(t, e, u);
          } catch (W) {
            zi(t, e, W);
          }
      }
      function oc(t, e, a) {
        a !== null && typeof a == "object" && typeof a.then == "function" ? a.then(
          function(r) {
            sc(t, e, r);
          },
          function(r) {
            return zi(t, e, r);
          }
        ) : sc(t, e, a);
      }
      function sc(t, e, a) {
        e.status = "fulfilled", e.value = a, cc(e), t.state = a, e = t.pending, e !== null && (a = e.next, a === e ? t.pending = null : (a = a.next, e.next = a, ic(t, a)));
      }
      function zi(t, e, a) {
        var r = t.pending;
        if (t.pending = null, r !== null) {
          r = r.next;
          do
            e.status = "rejected", e.reason = a, cc(e), e = e.next;
          while (e !== r);
        }
        t.action = null;
      }
      function cc(t) {
        t = t.listeners;
        for (var e = 0; e < t.length; e++) (0, t[e])();
      }
      function uc(t, e) {
        return e;
      }
      function dc(t, e) {
        if (St) {
          var a = At.formState;
          if (a !== null) {
            t: {
              var r = bt;
              if (St) {
                if (Ot) {
                  var c = th(
                    Ot,
                    Ae
                  );
                  if (c) {
                    Ot = rd(c), r = eh(c);
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
          lastRenderedReducer: uc,
          lastRenderedState: e
        }, a.queue = r, a = Cc.bind(
          null,
          bt,
          r
        ), r.dispatch = a, r = Ei(!1);
        var u = Ai.bind(
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
        }, r.queue = c, a = Bm.bind(
          null,
          bt,
          c,
          u,
          a
        ), c.dispatch = a, r.memoizedState = t, [e, a, !1];
      }
      function fc(t) {
        var e = qt();
        return mc(e, Mt, t);
      }
      function mc(t, e, a) {
        if (e = ki(
          t,
          e,
          uc
        )[0], t = Ll($e)[0], typeof e == "object" && e !== null && typeof e.then == "function")
          try {
            var r = Za(e);
          } catch (g) {
            throw g === Ca ? gr : g;
          }
        else r = e;
        e = qt();
        var c = e.queue, u = c.dispatch;
        return a !== e.memoizedState && (bt.flags |= 2048, pa(
          9,
          { destroy: void 0 },
          Um.bind(null, c, a),
          null
        )), [r, u, t];
      }
      function Um(t, e) {
        t.action = e;
      }
      function pc(t) {
        var e = qt(), a = Mt;
        if (a !== null)
          return mc(e, a, t);
        qt(), e = e.memoizedState, a = qt();
        var r = a.queue.dispatch;
        return a.memoizedState = t, [e, r, !1];
      }
      function pa(t, e, a, r) {
        return t = { tag: t, create: a, deps: r, inst: e, next: null }, e = bt.updateQueue, e === null && (e = Yl(), bt.updateQueue = e), a = e.lastEffect, a === null ? e.lastEffect = t.next = t : (r = a.next, a.next = t, t.next = r, e.lastEffect = t), t;
      }
      function hc() {
        return qt().memoizedState;
      }
      function Ql(t, e, a, r) {
        var c = fe();
        bt.flags |= t, c.memoizedState = pa(
          1 | e,
          { destroy: void 0 },
          a,
          r === void 0 ? null : r
        );
      }
      function Vl(t, e, a, r) {
        var c = qt();
        r = r === void 0 ? null : r;
        var u = c.memoizedState.inst;
        Mt !== null && r !== null && bi(r, Mt.memoizedState.deps) ? c.memoizedState = pa(e, u, a, r) : (bt.flags |= t, c.memoizedState = pa(
          1 | e,
          u,
          a,
          r
        ));
      }
      function gc(t, e) {
        Ql(8390656, 8, t, e);
      }
      function Ni(t, e) {
        Vl(2048, 8, t, e);
      }
      function qm(t) {
        bt.flags |= 4;
        var e = bt.updateQueue;
        if (e === null)
          e = Yl(), bt.updateQueue = e, e.events = [t];
        else {
          var a = e.events;
          a === null ? e.events = [t] : a.push(t);
        }
      }
      function bc(t) {
        var e = qt().memoizedState;
        return qm({ ref: e, nextImpl: t }), function() {
          if ((xt & 2) !== 0)
            throw Error(s(440));
          return e.impl.apply(void 0, arguments);
        };
      }
      function vc(t, e) {
        return Vl(4, 2, t, e);
      }
      function yc(t, e) {
        return Vl(4, 4, t, e);
      }
      function xc(t, e) {
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
      function wc(t, e, a) {
        a = a != null ? a.concat([t]) : null, Vl(
          4,
          4,
          xc.bind(null, e, t),
          a
        );
      }
      function Ti() {
      }
      function _c(t, e) {
        var a = qt();
        e = e === void 0 ? null : e;
        var r = a.memoizedState;
        return e !== null && bi(e, r[1]) ? r[0] : (a.memoizedState = [t, e], t);
      }
      function kc(t, e) {
        var a = qt();
        e = e === void 0 ? null : e;
        var r = a.memoizedState;
        if (e !== null && bi(e, r[1]))
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
      function Ci(t, e, a) {
        return a === void 0 || (on & 1073741824) !== 0 && (_t & 261930) === 0 ? t.memoizedState = e : (t.memoizedState = a, t = yu(), bt.lanes |= t, Cn |= t, a);
      }
      function Sc(t, e, a, r) {
        return ke(a, e) ? a : ja.current !== null ? (t = Ci(t, a, r), ke(t, e) || (Lt = !0), t) : (on & 42) === 0 || (on & 1073741824) !== 0 && (_t & 261930) === 0 ? (Lt = !0, t.memoizedState = a) : (t = yu(), bt.lanes |= t, Cn |= t, e);
      }
      function Ec(t, e, a, r, c) {
        var u = ln();
        Ft(
          u !== 0 && 8 > u ? u : 8
        );
        var g = dt.T, C = {};
        dt.T = C, Ai(t, !1, e, a);
        try {
          var G = c(), W = dt.S;
          if (W !== null && W(C, G), G !== null && typeof G == "object" && typeof G.then == "function") {
            var nt = Dm(
              G,
              r
            );
            Ja(
              t,
              e,
              nt,
              ye(t)
            );
          } else
            Ja(
              t,
              e,
              r,
              ye(t)
            );
        } catch ($) {
          Ja(
            t,
            e,
            { then: function() {
            }, status: "rejected", reason: $ },
            ye()
          );
        } finally {
          Ft(u), g !== null && C.types !== null && (g.types = C.types), dt.T = g;
        }
      }
      function zc(t) {
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
      function Mi() {
        return te(In);
      }
      function Nc() {
        return qt().memoizedState;
      }
      function Tc() {
        return qt().memoizedState;
      }
      function Ym(t) {
        for (var e = t.return; e !== null; ) {
          switch (e.tag) {
            case 24:
            case 3:
              var a = ye();
              t = gn(a);
              var r = bn(e, t, a);
              r !== null && (pe(r, e, a), Va(r, e, a)), e = { cache: oi() }, t.payload = e;
              return;
          }
          e = e.return;
        }
      }
      function Gm(t, e, a) {
        var r = ye();
        a = {
          lane: r,
          revertLane: 0,
          gesture: null,
          action: a,
          hasEagerState: !1,
          eagerState: null,
          next: null
        }, Kl(t) ? Mc(e, a) : (a = ui(t, e, a, r), a !== null && (pe(a, t, r), Ac(a, e, r)));
      }
      function Cc(t, e, a) {
        var r = ye();
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
        if (Kl(t)) Mc(e, c);
        else {
          var u = t.alternate;
          if (t.lanes === 0 && (u === null || u.lanes === 0) && (u = e.lastRenderedReducer, u !== null))
            try {
              var g = e.lastRenderedState, C = u(g, a);
              if (c.hasEagerState = !0, c.eagerState = C, ke(C, g))
                return Bl(t, e, c, 0), At === null && Hl(), !1;
            } catch {
            } finally {
            }
          if (a = ui(t, e, c, r), a !== null)
            return pe(a, t, r), Ac(a, e, r), !0;
        }
        return !1;
      }
      function Ai(t, e, a, r) {
        if (r = {
          lane: 2,
          revertLane: si(),
          gesture: null,
          action: r,
          hasEagerState: !1,
          eagerState: null,
          next: null
        }, Kl(t)) {
          if (e) throw Error(s(479));
        } else
          e = ui(
            t,
            a,
            r,
            2
          ), e !== null && pe(e, t, 2);
      }
      function Kl(t) {
        var e = t.alternate;
        return t === bt || e !== null && e === bt;
      }
      function Mc(t, e) {
        Oa = yr = !0;
        var a = t.pending;
        a === null ? e.next = e : (e.next = a.next, a.next = e), t.pending = e;
      }
      function Ac(t, e, a) {
        if ((a & 4194048) !== 0) {
          var r = e.lanes;
          r &= t.pendingLanes, a |= r, e.lanes = a, y(t, a);
        }
      }
      function ji(t, e, a, r) {
        e = t.memoizedState, a = a(r, e), a = a == null ? e : oo({}, e, a), t.memoizedState = a, t.lanes === 0 && (t.updateQueue.baseState = a);
      }
      function jc(t, e, a, r, c, u, g) {
        return t = t.stateNode, typeof t.shouldComponentUpdate == "function" ? t.shouldComponentUpdate(r, u, g) : e.prototype && e.prototype.isPureReactComponent ? !Ol(a, r) || !Ol(c, u) : !0;
      }
      function Oc(t, e, a, r) {
        t = e.state, typeof e.componentWillReceiveProps == "function" && e.componentWillReceiveProps(a, r), typeof e.UNSAFE_componentWillReceiveProps == "function" && e.UNSAFE_componentWillReceiveProps(a, r), e.state !== t && Oo.enqueueReplaceState(e, e.state, null);
      }
      function Xn(t, e) {
        var a = e;
        if ("ref" in e) {
          a = {};
          for (var r in e)
            r !== "ref" && (a[r] = e[r]);
        }
        if (t = t.defaultProps) {
          a === e && (a = oo({}, a));
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
      function Rc(t, e, a) {
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
      function Oi(t, e, a) {
        return a = gn(a), a.tag = 3, a.payload = { element: null }, a.callback = function() {
          Xl(t, e);
        }, a;
      }
      function Dc(t) {
        return t = gn(t), t.tag = 3, t;
      }
      function Hc(t, e, a, r) {
        var c = a.type.getDerivedStateFromError;
        if (typeof c == "function") {
          var u = r.value;
          t.payload = function() {
            return c(u);
          }, t.callback = function() {
            Rc(e, a, r);
          };
        }
        var g = a.stateNode;
        g !== null && typeof g.componentDidCatch == "function" && (t.callback = function() {
          Rc(e, a, r), typeof c != "function" && (Mn === null ? Mn = /* @__PURE__ */ new Set([this]) : Mn.add(this));
          var C = r.stack;
          this.componentDidCatch(r.value, {
            componentStack: C !== null ? C : ""
          });
        });
      }
      function Lm(t, e, a, r, c) {
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
                return Oe === null ? er() : a.alternate === null && Bt === 0 && (Bt = 3), a.flags &= -257, a.flags |= 65536, a.lanes = c, r === br ? a.flags |= 16384 : (e = a.updateQueue, e === null ? a.updateQueue = /* @__PURE__ */ new Set([r]) : e.add(r), no(t, r, c)), !1;
              case 22:
                return a.flags |= 65536, r === br ? a.flags |= 16384 : (e = a.updateQueue, e === null ? (e = {
                  transitions: null,
                  markerInstances: null,
                  retryQueue: /* @__PURE__ */ new Set([r])
                }, a.updateQueue = e) : (a = e.retryQueue, a === null ? e.retryQueue = /* @__PURE__ */ new Set([r]) : a.add(r)), no(t, r, c)), !1;
            }
            throw Error(s(435, a.tag));
          }
          return no(t, r, c), er(), !1;
        }
        if (St)
          return e = Se.current, e !== null ? ((e.flags & 65536) === 0 && (e.flags |= 256), e.flags |= 65536, e.lanes = c, r !== Eo && (t = Error(s(422), { cause: r }), Ga(
            L(t, a)
          ))) : (r !== Eo && (e = Error(s(423), {
            cause: r
          }), Ga(
            L(e, a)
          )), t = t.current.alternate, t.flags |= 65536, c &= -c, t.lanes |= c, r = L(r, a), c = Oi(
            t.stateNode,
            r,
            c
          ), mi(t, c), Bt !== 4 && (Bt = 2)), !1;
        var u = Error(s(520), { cause: r });
        if (u = L(u, a), ml === null ? ml = [u] : ml.push(u), Bt !== 4 && (Bt = 2), e === null) return !0;
        r = L(r, a), a = e;
        do {
          switch (a.tag) {
            case 3:
              return a.flags |= 65536, t = c & -c, a.lanes |= t, t = Oi(a.stateNode, r, t), mi(a, t), !1;
            case 1:
              if (e = a.type, u = a.stateNode, (a.flags & 128) === 0 && (typeof e.getDerivedStateFromError == "function" || u !== null && typeof u.componentDidCatch == "function" && (Mn === null || !Mn.has(
                u
              ))))
                return a.flags |= 65536, c &= -c, a.lanes |= c, c = Dc(c), Hc(
                  c,
                  t,
                  a,
                  r
                ), mi(a, c), !1;
          }
          a = a.return;
        } while (a !== null);
        return !1;
      }
      function ee(t, e, a, r) {
        e.child = t === null ? _d(e, null, a, r) : na(
          e,
          t.child,
          a,
          r
        );
      }
      function Bc(t, e, a, r, c) {
        a = a.render;
        var u = e.ref;
        if ("ref" in r) {
          var g = {};
          for (var C in r)
            C !== "ref" && (g[C] = r[C]);
        } else g = r;
        return Qn(e), r = vi(
          t,
          e,
          a,
          g,
          u,
          c
        ), C = yi(), t !== null && !Lt ? (xi(t, e, c), Pe(t, e, c)) : (St && C && K(e), e.flags |= 1, ee(t, e, r, c), e.child);
      }
      function Uc(t, e, a, r, c) {
        if (t === null) {
          var u = a.type;
          return typeof u == "function" && !ao(u) && u.defaultProps === void 0 && a.compare === null ? (e.tag = 15, e.type = u, qc(
            t,
            e,
            u,
            r,
            c
          )) : (t = ar(
            a.type,
            null,
            r,
            e,
            e.mode,
            c
          ), t.ref = e.ref, t.return = e, e.child = t);
        }
        if (u = t.child, !Yi(t, c)) {
          var g = u.memoizedProps;
          if (a = a.compare, a = a !== null ? a : Ol, a(g, r) && t.ref === e.ref)
            return Pe(
              t,
              e,
              c
            );
        }
        return e.flags |= 1, t = nn(u, r), t.ref = e.ref, t.return = e, e.child = t;
      }
      function qc(t, e, a, r, c) {
        if (t !== null) {
          var u = t.memoizedProps;
          if (Ol(u, r) && t.ref === e.ref)
            if (Lt = !1, e.pendingProps = r = u, Yi(t, c))
              (t.flags & 131072) !== 0 && (Lt = !0);
            else
              return e.lanes = t.lanes, Pe(t, e, c);
        }
        return Ri(
          t,
          e,
          a,
          r,
          c
        );
      }
      function Yc(t, e, a, r) {
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
            return Gc(
              t,
              e,
              u,
              a,
              r
            );
          }
          if ((a & 536870912) !== 0)
            e.memoizedState = { baseLanes: 0, cachePool: null }, t !== null && jl(
              e,
              u !== null ? u.cachePool : null
            ), u !== null ? Ws(e, u) : pi(), Fs(e);
          else
            return r = e.lanes = 536870912, Gc(
              t,
              e,
              u !== null ? u.baseLanes | a : a,
              a,
              r
            );
        } else
          u !== null ? (jl(e, u.cachePool), Ws(e, u), yn(), e.memoizedState = null) : (t !== null && jl(e, null), pi(), yn());
        return ee(t, e, c, a), e.child;
      }
      function Wa(t, e) {
        return t !== null && t.tag === 22 || e.stateNode !== null || (e.stateNode = {
          _visibility: 1,
          _pendingMarkers: null,
          _retryCache: null,
          _transitions: null
        }), e.sibling;
      }
      function Gc(t, e, a, r, c) {
        var u = ci();
        return u = u === null ? null : {
          parent: an ? Rt._currentValue : Rt._currentValue2,
          pool: u
        }, e.memoizedState = {
          baseLanes: a,
          cachePool: u
        }, t !== null && jl(e, null), pi(), Fs(e), t !== null && fa(t, e, r, !0), e.childLanes = c, null;
      }
      function Zl(t, e) {
        return e = Wl(
          { mode: e.mode, children: e.children },
          t.mode
        ), e.ref = t.ref, t.child = e, e.return = t, e;
      }
      function Lc(t, e, a) {
        return na(e, t.child, null, a), t = Zl(
          e,
          e.pendingProps
        ), t.flags |= 2, ve(e), e.memoizedState = null, t;
      }
      function Qm(t, e, a) {
        var r = e.pendingProps, c = (e.flags & 128) !== 0;
        if (e.flags &= -129, t === null) {
          if (St) {
            if (r.mode === "hidden")
              return t = Zl(e, r), e.lanes = 536870912, Wa(null, t);
            if (gi(e), (t = Ot) ? (t = uh(
              t,
              Ae
            ), t !== null && (e.memoizedState = {
              dehydrated: t,
              treeContext: Sn !== null ? { id: Xe, overflow: Ze } : null,
              retryLane: 536870912,
              hydrationErrors: null
            }, a = qu(t), a.return = e, e.child = a, ae = e, Ot = null)) : t = null, t === null) throw ht(e);
            return e.lanes = 536870912, null;
          }
          return Zl(e, r);
        }
        var u = t.memoizedState;
        if (u !== null) {
          var g = u.dehydrated;
          if (gi(e), c)
            if (e.flags & 256)
              e.flags &= -257, e = Lc(
                t,
                e,
                a
              );
            else if (e.memoizedState !== null)
              e.child = t.child, e.flags |= 128, e = null;
            else throw Error(s(558));
          else if (Lt || fa(
            t,
            e,
            a,
            !1
          ), c = (a & t.childLanes) !== 0, Lt || c) {
            if (r = At, r !== null && (g = A(r, a), g !== 0 && g !== u.retryLane))
              throw u.retryLane = g, Kn(t, g), pe(r, t, g), Ro;
            er(), e = Lc(
              t,
              e,
              a
            );
          } else
            t = u.treeContext, ue && (Ot = rh(g), ae = e, St = !0, zn = null, Ae = !1, t !== null && st(e, t)), e = Zl(e, r), e.flags |= 4096;
          return e;
        }
        return t = nn(t.child, {
          mode: r.mode,
          children: r.children
        }), t.ref = e.ref, e.child = t, t.return = e, t;
      }
      function Jl(t, e) {
        var a = e.ref;
        if (a === null)
          t !== null && t.ref !== null && (e.flags |= 4194816);
        else {
          if (typeof a != "function" && typeof a != "object")
            throw Error(s(284));
          (t === null || t.ref !== a) && (e.flags |= 4194816);
        }
      }
      function Ri(t, e, a, r, c) {
        return Qn(e), a = vi(
          t,
          e,
          a,
          r,
          void 0,
          c
        ), r = yi(), t !== null && !Lt ? (xi(t, e, c), Pe(t, e, c)) : (St && r && K(e), e.flags |= 1, ee(t, e, a, c), e.child);
      }
      function Qc(t, e, a, r, c, u) {
        return Qn(e), e.updateQueue = null, a = $s(
          e,
          r,
          a,
          c
        ), Is(t), r = yi(), t !== null && !Lt ? (xi(t, e, u), Pe(t, e, u)) : (St && r && K(e), e.flags |= 1, ee(t, e, a, u), e.child);
      }
      function Vc(t, e, a, r, c) {
        if (Qn(e), e.stateNode === null) {
          var u = ka, g = a.contextType;
          typeof g == "object" && g !== null && (u = te(g)), u = new a(r, u), e.memoizedState = u.state !== null && u.state !== void 0 ? u.state : null, u.updater = Oo, e.stateNode = u, u._reactInternals = e, u = e.stateNode, u.props = r, u.state = e.memoizedState, u.refs = {}, di(e), g = a.contextType, u.context = typeof g == "object" && g !== null ? te(g) : ka, u.state = e.memoizedState, g = a.getDerivedStateFromProps, typeof g == "function" && (ji(
            e,
            a,
            g,
            r
          ), u.state = e.memoizedState), typeof a.getDerivedStateFromProps == "function" || typeof u.getSnapshotBeforeUpdate == "function" || typeof u.UNSAFE_componentWillMount != "function" && typeof u.componentWillMount != "function" || (g = u.state, typeof u.componentWillMount == "function" && u.componentWillMount(), typeof u.UNSAFE_componentWillMount == "function" && u.UNSAFE_componentWillMount(), g !== u.state && Oo.enqueueReplaceState(
            u,
            u.state,
            null
          ), Xa(e, r, u, c), Ka(), u.state = e.memoizedState), typeof u.componentDidMount == "function" && (e.flags |= 4194308), r = !0;
        } else if (t === null) {
          u = e.stateNode;
          var C = e.memoizedProps, G = Xn(a, C);
          u.props = G;
          var W = u.context, nt = a.contextType;
          g = ka, typeof nt == "object" && nt !== null && (g = te(nt));
          var $ = a.getDerivedStateFromProps;
          nt = typeof $ == "function" || typeof u.getSnapshotBeforeUpdate == "function", C = e.pendingProps !== C, nt || typeof u.UNSAFE_componentWillReceiveProps != "function" && typeof u.componentWillReceiveProps != "function" || (C || W !== g) && Oc(
            e,
            u,
            r,
            g
          ), Nn = !1;
          var lt = e.memoizedState;
          u.state = lt, Xa(e, r, u, c), Ka(), W = e.memoizedState, C || lt !== W || Nn ? (typeof $ == "function" && (ji(
            e,
            a,
            $,
            r
          ), W = e.memoizedState), (G = Nn || jc(
            e,
            a,
            G,
            r,
            lt,
            W,
            g
          )) ? (nt || typeof u.UNSAFE_componentWillMount != "function" && typeof u.componentWillMount != "function" || (typeof u.componentWillMount == "function" && u.componentWillMount(), typeof u.UNSAFE_componentWillMount == "function" && u.UNSAFE_componentWillMount()), typeof u.componentDidMount == "function" && (e.flags |= 4194308)) : (typeof u.componentDidMount == "function" && (e.flags |= 4194308), e.memoizedProps = r, e.memoizedState = W), u.props = r, u.state = W, u.context = g, r = G) : (typeof u.componentDidMount == "function" && (e.flags |= 4194308), r = !1);
        } else {
          u = e.stateNode, fi(t, e), g = e.memoizedProps, nt = Xn(a, g), u.props = nt, $ = e.pendingProps, lt = u.context, W = a.contextType, G = ka, typeof W == "object" && W !== null && (G = te(W)), C = a.getDerivedStateFromProps, (W = typeof C == "function" || typeof u.getSnapshotBeforeUpdate == "function") || typeof u.UNSAFE_componentWillReceiveProps != "function" && typeof u.componentWillReceiveProps != "function" || (g !== $ || lt !== G) && Oc(
            e,
            u,
            r,
            G
          ), Nn = !1, lt = e.memoizedState, u.state = lt, Xa(e, r, u, c), Ka();
          var gt = e.memoizedState;
          g !== $ || lt !== gt || Nn || t !== null && t.dependencies !== null && Cl(t.dependencies) ? (typeof C == "function" && (ji(
            e,
            a,
            C,
            r
          ), gt = e.memoizedState), (nt = Nn || jc(
            e,
            a,
            nt,
            r,
            lt,
            gt,
            G
          ) || t !== null && t.dependencies !== null && Cl(t.dependencies)) ? (W || typeof u.UNSAFE_componentWillUpdate != "function" && typeof u.componentWillUpdate != "function" || (typeof u.componentWillUpdate == "function" && u.componentWillUpdate(r, gt, G), typeof u.UNSAFE_componentWillUpdate == "function" && u.UNSAFE_componentWillUpdate(
            r,
            gt,
            G
          )), typeof u.componentDidUpdate == "function" && (e.flags |= 4), typeof u.getSnapshotBeforeUpdate == "function" && (e.flags |= 1024)) : (typeof u.componentDidUpdate != "function" || g === t.memoizedProps && lt === t.memoizedState || (e.flags |= 4), typeof u.getSnapshotBeforeUpdate != "function" || g === t.memoizedProps && lt === t.memoizedState || (e.flags |= 1024), e.memoizedProps = r, e.memoizedState = gt), u.props = r, u.state = gt, u.context = G, r = nt) : (typeof u.componentDidUpdate != "function" || g === t.memoizedProps && lt === t.memoizedState || (e.flags |= 4), typeof u.getSnapshotBeforeUpdate != "function" || g === t.memoizedProps && lt === t.memoizedState || (e.flags |= 1024), r = !1);
        }
        return u = r, Jl(t, e), r = (e.flags & 128) !== 0, u || r ? (u = e.stateNode, a = r && typeof a.getDerivedStateFromError != "function" ? null : u.render(), e.flags |= 1, t !== null && r ? (e.child = na(
          e,
          t.child,
          null,
          c
        ), e.child = na(
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
      function Kc(t, e, a, r) {
        return He(), e.flags |= 256, ee(t, e, a, r), e.child;
      }
      function Di(t) {
        return { baseLanes: t, cachePool: Ys() };
      }
      function Hi(t, e, a) {
        return t = t !== null ? t.childLanes & ~a : 0, e && (t |= ze), t;
      }
      function Xc(t, e, a) {
        var r = e.pendingProps, c = !1, u = (e.flags & 128) !== 0, g;
        if ((g = u) || (g = t !== null && t.memoizedState === null ? !1 : (Yt.current & 2) !== 0), g && (c = !0, e.flags &= -129), g = (e.flags & 32) !== 0, e.flags &= -33, t === null) {
          if (St) {
            if (c ? vn(e) : yn(), (t = Ot) ? (t = dh(
              t,
              Ae
            ), t !== null && (e.memoizedState = {
              dehydrated: t,
              treeContext: Sn !== null ? { id: Xe, overflow: Ze } : null,
              retryLane: 536870912,
              hydrationErrors: null
            }, a = qu(t), a.return = e, e.child = a, ae = e, Ot = null)) : t = null, t === null) throw ht(e);
            return vo(t) ? e.lanes = 32 : e.lanes = 536870912, null;
          }
          var C = r.children;
          return r = r.fallback, c ? (yn(), c = e.mode, C = Wl(
            { mode: "hidden", children: C },
            c
          ), r = Wn(
            r,
            c,
            a,
            null
          ), C.return = e, r.return = e, C.sibling = r, e.child = C, r = e.child, r.memoizedState = Di(a), r.childLanes = Hi(
            t,
            g,
            a
          ), e.memoizedState = Do, Wa(null, r)) : (vn(e), Bi(e, C));
        }
        var G = t.memoizedState;
        if (G !== null && (C = G.dehydrated, C !== null)) {
          if (u)
            e.flags & 256 ? (vn(e), e.flags &= -257, e = Ui(
              t,
              e,
              a
            )) : e.memoizedState !== null ? (yn(), e.child = t.child, e.flags |= 128, e = null) : (yn(), C = r.fallback, c = e.mode, r = Wl(
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
            ), r = e.child, r.memoizedState = Di(a), r.childLanes = Hi(
              t,
              g,
              a
            ), e.memoizedState = Do, e = Wa(null, r));
          else if (vn(e), vo(C))
            g = $p(C).digest, r = Error(s(419)), r.stack = "", r.digest = g, Ga({ value: r, source: null, stack: null }), e = Ui(
              t,
              e,
              a
            );
          else if (Lt || fa(
            t,
            e,
            a,
            !1
          ), g = (a & t.childLanes) !== 0, Lt || g) {
            if (g = At, g !== null && (r = A(
              g,
              a
            ), r !== 0 && r !== G.retryLane))
              throw G.retryLane = r, Kn(t, r), pe(g, t, r), Ro;
            bo(C) || er(), e = Ui(
              t,
              e,
              a
            );
          } else
            bo(C) ? (e.flags |= 192, e.child = t.child, e = null) : (t = G.treeContext, ue && (Ot = ih(
              C
            ), ae = e, St = !0, zn = null, Ae = !1, t !== null && st(e, t)), e = Bi(
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
        ), C.flags |= 2), C.return = e, r.return = e, r.sibling = C, e.child = r, Wa(null, r), r = e.child, C = t.child.memoizedState, C === null ? C = Di(a) : (c = C.cachePool, c !== null ? (G = an ? Rt._currentValue : Rt._currentValue2, c = c.parent !== G ? { parent: G, pool: G } : c) : c = Ys(), C = {
          baseLanes: C.baseLanes | a,
          cachePool: c
        }), r.memoizedState = C, r.childLanes = Hi(
          t,
          g,
          a
        ), e.memoizedState = Do, Wa(t.child, r)) : (vn(e), a = t.child, t = a.sibling, a = nn(a, {
          mode: "visible",
          children: r.children
        }), a.return = e, a.sibling = null, t !== null && (g = e.deletions, g === null ? (e.deletions = [t], e.flags |= 16) : g.push(t)), e.child = a, e.memoizedState = null, a);
      }
      function Bi(t, e) {
        return e = Wl(
          { mode: "visible", children: e },
          t.mode
        ), e.return = t, t.child = e;
      }
      function Wl(t, e) {
        return t = o(22, t, null, e), t.lanes = 0, t;
      }
      function Ui(t, e, a) {
        return na(e, t.child, null, a), t = Bi(
          e,
          e.pendingProps.children
        ), t.flags |= 2, e.memoizedState = null, t;
      }
      function Zc(t, e, a) {
        t.lanes |= e;
        var r = t.alternate;
        r !== null && (r.lanes |= e), ri(t.return, e, a);
      }
      function qi(t, e, a, r, c, u) {
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
      function Jc(t, e, a) {
        var r = e.pendingProps, c = r.revealOrder, u = r.tail;
        r = r.children;
        var g = Yt.current, C = (g & 2) !== 0;
        if (C ? (g = g & 1 | 2, e.flags |= 128) : g &= 1, E(Yt, g), ee(t, e, r, a), r = St ? il : 0, !C && t !== null && (t.flags & 128) !== 0)
          t: for (t = e.child; t !== null; ) {
            if (t.tag === 13)
              t.memoizedState !== null && Zc(t, a, e);
            else if (t.tag === 19)
              Zc(t, a, e);
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
            a = c, a === null ? (c = e.child, e.child = null) : (c = a.sibling, a.sibling = null), qi(
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
              if (t = c.alternate, t !== null && ql(t) === null) {
                e.child = c;
                break;
              }
              t = c.sibling, c.sibling = a, a = c, c = t;
            }
            qi(
              e,
              !0,
              a,
              null,
              u,
              r
            );
            break;
          case "together":
            qi(
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
          throw Error(s(153));
        if (e.child !== null) {
          for (t = e.child, a = nn(t, t.pendingProps), e.child = a, a.return = e; t.sibling !== null; )
            t = t.sibling, a = a.sibling = nn(t, t.pendingProps), a.return = e;
          a.sibling = null;
        }
        return e.child;
      }
      function Yi(t, e) {
        return (t.lanes & e) !== 0 ? !0 : (t = t.dependencies, !!(t !== null && Cl(t)));
      }
      function Vm(t, e, a) {
        switch (e.tag) {
          case 3:
            ct(
              e,
              e.stateNode.containerInfo
            ), hn(e, Rt, t.memoizedState.cache), He();
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
            hn(
              e,
              e.type,
              e.memoizedProps.value
            );
            break;
          case 31:
            if (e.memoizedState !== null)
              return e.flags |= 128, gi(e), null;
            break;
          case 13:
            var r = e.memoizedState;
            if (r !== null)
              return r.dehydrated !== null ? (vn(e), e.flags |= 128, null) : (a & e.child.childLanes) !== 0 ? Xc(
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
                return Jc(
                  t,
                  e,
                  a
                );
              e.flags |= 128;
            }
            if (c = e.memoizedState, c !== null && (c.rendering = null, c.tail = null, c.lastEffect = null), E(Yt, Yt.current), r) break;
            return null;
          case 22:
            return e.lanes = 0, Yc(
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
      function Wc(t, e, a) {
        if (t !== null)
          if (t.memoizedProps !== e.pendingProps)
            Lt = !0;
          else {
            if (!Yi(t, a) && (e.flags & 128) === 0)
              return Lt = !1, Vm(
                t,
                e,
                a
              );
            Lt = (t.flags & 131072) !== 0;
          }
        else
          Lt = !1, St && (e.flags & 1048576) !== 0 && T(e, il, e.index);
        switch (e.lanes = 0, e.tag) {
          case 16:
            t: {
              var r = e.pendingProps;
              if (t = Vn(e.elementType), e.type = t, typeof t == "function")
                ao(t) ? (r = Xn(t, r), e.tag = 1, e = Vc(
                  null,
                  e,
                  t,
                  r,
                  a
                )) : (e.tag = 0, e = Ri(
                  null,
                  e,
                  t,
                  r,
                  a
                ));
              else {
                if (t != null) {
                  var c = t.$$typeof;
                  if (c === co) {
                    e.tag = 11, e = Bc(
                      null,
                      e,
                      t,
                      r,
                      a
                    );
                    break t;
                  } else if (c === mo) {
                    e.tag = 14, e = Uc(
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
            return Ri(
              t,
              e,
              e.type,
              e.pendingProps,
              a
            );
          case 1:
            return r = e.type, c = Xn(
              r,
              e.pendingProps
            ), Vc(
              t,
              e,
              r,
              c,
              a
            );
          case 3:
            t: {
              if (ct(
                e,
                e.stateNode.containerInfo
              ), t === null) throw Error(s(387));
              var u = e.pendingProps;
              c = e.memoizedState, r = c.element, fi(t, e), Xa(e, u, null, a);
              var g = e.memoizedState;
              if (u = g.cache, hn(e, Rt, u), u !== c.cache && ii(
                e,
                [Rt],
                a,
                !0
              ), Ka(), u = g.element, ue && c.isDehydrated)
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
                  r = L(
                    Error(s(424)),
                    e
                  ), Ga(r), e = Kc(
                    t,
                    e,
                    u,
                    a
                  );
                  break t;
                } else
                  for (ue && (Ot = lh(
                    e.stateNode.containerInfo
                  ), ae = e, St = !0, zn = null, Ae = !0), a = _d(
                    e,
                    null,
                    u,
                    a
                  ), e.child = a; a; )
                    a.flags = a.flags & -3 | 4096, a = a.sibling;
              else {
                if (He(), u === r) {
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
              return Jl(t, e), t === null ? (a = sd(
                e.type,
                null,
                e.pendingProps,
                null
              )) ? e.memoizedState = a : St || (e.stateNode = Ah(
                e.type,
                e.pendingProps,
                En.current,
                e
              )) : e.memoizedState = sd(
                e.type,
                t.memoizedProps,
                e.pendingProps,
                t.memoizedState
              ), null;
          case 27:
            if (Xt)
              return Et(e), t === null && Xt && St && (r = e.stateNode = pd(
                e.type,
                e.pendingProps,
                En.current,
                ne.current,
                !1
              ), ae = e, Ae = !0, Ot = oh(
                e.type,
                r,
                Ot
              )), ee(
                t,
                e,
                e.pendingProps.children,
                a
              ), Jl(t, e), t === null && (e.flags |= 4194304), e.child;
          case 5:
            return t === null && St && (Th(
              e.type,
              e.pendingProps,
              ne.current
            ), (c = r = Ot) && (r = sh(
              r,
              e.type,
              e.pendingProps,
              Ae
            ), r !== null ? (e.stateNode = r, ae = e, Ot = ah(r), Ae = !1, c = !0) : c = !1), c || ht(e)), Et(e), c = e.type, u = e.pendingProps, g = t !== null ? t.memoizedProps : null, r = u.children, ir(c, u) ? r = null : g !== null && ir(c, g) && (e.flags |= 32), e.memoizedState !== null && (c = vi(
              t,
              e,
              Hm,
              null,
              null,
              a
            ), an ? In._currentValue = c : In._currentValue2 = c), Jl(t, e), ee(t, e, r, a), e.child;
          case 6:
            return t === null && St && (Ch(
              e.pendingProps,
              ne.current
            ), (t = a = Ot) && (a = ch(
              a,
              e.pendingProps,
              Ae
            ), a !== null ? (e.stateNode = a, ae = e, Ot = null, t = !0) : t = !1), t || ht(e)), null;
          case 13:
            return Xc(t, e, a);
          case 4:
            return ct(
              e,
              e.stateNode.containerInfo
            ), r = e.pendingProps, t === null ? e.child = na(
              e,
              null,
              r,
              a
            ) : ee(t, e, r, a), e.child;
          case 11:
            return Bc(
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
            return c = e.type._context, r = e.pendingProps.children, Qn(e), c = te(c), r = r(c), e.flags |= 1, ee(t, e, r, a), e.child;
          case 14:
            return Uc(
              t,
              e,
              e.type,
              e.pendingProps,
              a
            );
          case 15:
            return qc(
              t,
              e,
              e.type,
              e.pendingProps,
              a
            );
          case 19:
            return Jc(
              t,
              e,
              a
            );
          case 31:
            return Qm(t, e, a);
          case 22:
            return Yc(
              t,
              e,
              a,
              e.pendingProps
            );
          case 24:
            return Qn(e), r = te(Rt), t === null ? (c = ci(), c === null && (c = At, u = oi(), c.pooledCache = u, u.refCount++, u !== null && (c.pooledCacheLanes |= a), c = u), e.memoizedState = {
              parent: r,
              cache: c
            }, di(e), hn(e, Rt, c)) : ((t.lanes & a) !== 0 && (fi(t, e), Xa(e, null, null, a), Ka()), c = t.memoizedState, u = e.memoizedState, c.parent !== r ? (c = { parent: r, cache: r }, e.memoizedState = c, e.lanes === 0 && (e.memoizedState = e.updateQueue.baseState = c), hn(e, Rt, r)) : (r = u.cache, hn(e, Rt, r), r !== c.cache && ii(
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
      function Be(t) {
        t.flags |= 4;
      }
      function Fl(t) {
        Ke && (t.flags |= 8);
      }
      function Fc(t, e) {
        if (t !== null && t.child === e.child) return !1;
        if ((e.flags & 16) !== 0) return !0;
        for (t = e.child; t !== null; ) {
          if ((t.flags & 8218) !== 0 || (t.subtreeFlags & 8218) !== 0)
            return !0;
          t = t.sibling;
        }
        return !1;
      }
      function Gi(t, e, a, r) {
        if (ce)
          for (a = e.child; a !== null; ) {
            if (a.tag === 5 || a.tag === 6)
              ho(t, a.stateNode);
            else if (!(a.tag === 4 || Xt && a.tag === 27) && a.child !== null) {
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
              a && r && (u = ad(
                u,
                c.type,
                c.memoizedProps
              )), ho(t, u);
            } else if (c.tag === 6)
              u = c.stateNode, a && r && (u = ld(
                u,
                c.memoizedProps
              )), ho(t, u);
            else if (c.tag !== 4) {
              if (c.tag === 22 && c.memoizedState !== null)
                u = c.child, u !== null && (u.return = c), Gi(t, c, !0, !0);
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
      function Ic(t, e, a, r) {
        var c = !1;
        if (Ke)
          for (var u = e.child; u !== null; ) {
            if (u.tag === 5) {
              var g = u.stateNode;
              a && r && (g = ad(
                g,
                u.type,
                u.memoizedProps
              )), ed(t, g);
            } else if (u.tag === 6)
              g = u.stateNode, a && r && (g = ld(
                g,
                u.memoizedProps
              )), ed(t, g);
            else if (u.tag !== 4) {
              if (u.tag === 22 && u.memoizedState !== null)
                c = u.child, c !== null && (c.return = u), Ic(t, u, !0, !0), c = !0;
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
      function $c(t, e) {
        if (Ke && Fc(t, e)) {
          t = e.stateNode;
          var a = t.containerInfo, r = td();
          Ic(r, e, !1, !1), t.pendingChildren = r, Be(e), Ip(a, r);
        }
      }
      function Li(t, e, a, r) {
        if (ce)
          t.memoizedProps !== r && Be(e);
        else if (Ke) {
          var c = t.stateNode, u = t.memoizedProps;
          if ((t = Fc(t, e)) || u !== r) {
            var g = ne.current;
            u = Fp(
              c,
              a,
              u,
              r,
              !t,
              null
            ), u === c ? e.stateNode = c : (Fl(e), Wu(
              u,
              a,
              r,
              g
            ) && Be(e), e.stateNode = u, t && Gi(u, e, !1, !1));
          } else e.stateNode = c;
        }
      }
      function Qi(t, e, a, r, c) {
        if ((t.mode & 32) !== 0 && (a === null ? kp(e, r) : Sp(e, a, r))) {
          if (t.flags |= 16777216, (c & 335544128) === c || go(e, r))
            if (Iu(t.stateNode, e, r))
              t.flags |= 8192;
            else if (Su()) t.flags |= 8192;
            else
              throw ea = br, Co;
        } else t.flags &= -16777217;
      }
      function Pc(t, e) {
        if (Oh(e)) {
          if (t.flags |= 16777216, !md(e))
            if (Su()) t.flags |= 8192;
            else
              throw ea = br, Co;
        } else t.flags &= -16777217;
      }
      function Il(t, e) {
        e !== null && (t.flags |= 4), t.flags & 16384 && (e = t.tag !== 22 ? X() : 536870912, t.lanes |= e, Ba |= e);
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
      function Km(t, e, a) {
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
            return jt(e), null;
          case 1:
            return jt(e), null;
          case 3:
            return a = e.stateNode, r = null, t !== null && (r = t.memoizedState.cache), e.memoizedState.cache !== r && (e.flags |= 2048), Ie(Rt), ut(), a.pendingContext && (a.context = a.pendingContext, a.pendingContext = null), (t === null || t.child === null) && (De(e) ? Be(e) : t === null || t.memoizedState.isDehydrated && (e.flags & 256) === 0 || (e.flags |= 1024, pn())), $c(t, e), jt(e), null;
          case 26:
            if (Ye) {
              var c = e.type, u = e.memoizedState;
              return t === null ? (Be(e), u !== null ? (jt(e), Pc(
                e,
                u
              )) : (jt(e), Qi(
                e,
                c,
                null,
                r,
                a
              ))) : u ? u !== t.memoizedState ? (Be(e), jt(e), Pc(
                e,
                u
              )) : (jt(e), e.flags &= -16777217) : (u = t.memoizedProps, ce ? u !== r && Be(e) : Li(
                t,
                e,
                c,
                r
              ), jt(e), Qi(
                e,
                c,
                u,
                r,
                a
              )), null;
            }
          case 27:
            if (Xt) {
              if (Wt(e), a = En.current, c = e.type, t !== null && e.stateNode != null)
                ce ? t.memoizedProps !== r && Be(e) : Li(t, e, c, r);
              else {
                if (!r) {
                  if (e.stateNode === null)
                    throw Error(s(166));
                  return jt(e), null;
                }
                t = ne.current, De(e) ? Gn(e, t) : (t = pd(
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
            if (Wt(e), c = e.type, t !== null && e.stateNode != null)
              Li(t, e, c, r);
            else {
              if (!r) {
                if (e.stateNode === null)
                  throw Error(s(166));
                return jt(e), null;
              }
              if (u = ne.current, De(e))
                Gn(e, u), _h(
                  e.stateNode,
                  c,
                  r,
                  u
                ) && (e.flags |= 64);
              else {
                var g = hp(
                  c,
                  r,
                  En.current,
                  u,
                  e
                );
                Fl(e), Gi(g, e, !1, !1), e.stateNode = g, Wu(
                  g,
                  c,
                  r,
                  u
                ) && Be(e);
              }
            }
            return jt(e), Qi(
              e,
              e.type,
              t === null ? null : t.memoizedProps,
              e.pendingProps,
              a
            ), null;
          case 6:
            if (t && e.stateNode != null)
              a = t.memoizedProps, ce ? a !== r && Be(e) : Ke && (a !== r ? (t = En.current, a = ne.current, Fl(e), e.stateNode = Fu(
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
                mh(
                  t,
                  a,
                  e,
                  r
                ) || ht(e, !0);
              } else
                Fl(e), e.stateNode = Fu(
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
                  ph(t, e);
                } else
                  He(), (e.flags & 128) === 0 && (e.memoizedState = null), e.flags |= 4;
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
                  hh(c, e);
                } else
                  He(), (e.flags & 128) === 0 && (e.memoizedState = null), e.flags |= 4;
                jt(e), c = !1;
              } else
                c = pn(), t !== null && t.memoizedState !== null && (t.memoizedState.hydrationErrors = c), c = !0;
              if (!c)
                return e.flags & 256 ? (ve(e), e) : (ve(e), null);
            }
            return ve(e), (e.flags & 128) !== 0 ? (e.lanes = a, e) : (a = r !== null, t = t !== null && t.memoizedState !== null, a && (r = e.child, c = null, r.alternate !== null && r.alternate.memoizedState !== null && r.alternate.memoizedState.cachePool !== null && (c = r.alternate.memoizedState.cachePool.pool), u = null, r.memoizedState !== null && r.memoizedState.cachePool !== null && (u = r.memoizedState.cachePool.pool), u !== c && (r.flags |= 2048)), a !== t && a && (e.child.flags |= 8192), Il(e, e.updateQueue), jt(e), null);
          case 4:
            return ut(), $c(t, e), t === null && yp(e.stateNode.containerInfo), jt(e), null;
          case 10:
            return Ie(e.type), jt(e), null;
          case 19:
            if (z(Yt), r = e.memoizedState, r === null) return jt(e), null;
            if (c = (e.flags & 128) !== 0, u = r.rendering, u === null)
              if (c) Fa(r, !1);
              else {
                if (Bt !== 0 || t !== null && (t.flags & 128) !== 0)
                  for (t = e.child; t !== null; ) {
                    if (u = ql(t), u !== null) {
                      for (e.flags |= 128, Fa(r, !1), t = u.updateQueue, e.updateQueue = t, Il(e, t), e.subtreeFlags = 0, t = a, a = e.child; a !== null; )
                        Uu(a, t), a = a.sibling;
                      return E(
                        Yt,
                        Yt.current & 1 | 2
                      ), St && V(e, r.treeForkCount), e.child;
                    }
                    t = t.sibling;
                  }
                r.tail !== null && he() > pl && (e.flags |= 128, c = !0, Fa(r, !1), e.lanes = 4194304);
              }
            else {
              if (!c)
                if (t = ql(u), t !== null) {
                  if (e.flags |= 128, c = !0, t = t.updateQueue, e.updateQueue = t, Il(e, t), Fa(r, !0), r.tail === null && r.tailMode === "hidden" && !u.alternate && !St)
                    return jt(e), null;
                } else
                  2 * he() - r.renderingStartTime > pl && a !== 536870912 && (e.flags |= 128, c = !0, Fa(r, !1), e.lanes = 4194304);
              r.isBackwards ? (u.sibling = e.child, e.child = u) : (t = r.last, t !== null ? t.sibling = u : e.child = u, r.last = u);
            }
            return r.tail !== null ? (t = r.tail, r.rendering = t, r.tail = t.sibling, r.renderingStartTime = he(), t.sibling = null, a = Yt.current, E(
              Yt,
              c ? a & 1 | 2 : a & 1
            ), St && V(e, r.treeForkCount), t) : (jt(e), null);
          case 22:
          case 23:
            return ve(e), hi(), r = e.memoizedState !== null, t !== null ? t.memoizedState !== null !== r && (e.flags |= 8192) : r && (e.flags |= 8192), r ? (a & 536870912) !== 0 && (e.flags & 128) === 0 && (jt(e), e.subtreeFlags & 6 && (e.flags |= 8192)) : jt(e), a = e.updateQueue, a !== null && Il(e, a.retryQueue), a = null, t !== null && t.memoizedState !== null && t.memoizedState.cachePool !== null && (a = t.memoizedState.cachePool.pool), r = null, e.memoizedState !== null && e.memoizedState.cachePool !== null && (r = e.memoizedState.cachePool.pool), r !== a && (e.flags |= 2048), t !== null && z(ta), null;
          case 24:
            return a = null, t !== null && (a = t.memoizedState.cache), e.memoizedState.cache !== a && (e.flags |= 2048), Ie(Rt), jt(e), null;
          case 25:
            return null;
          case 30:
            return null;
        }
        throw Error(s(156, e.tag));
      }
      function Xm(t, e) {
        switch (at(e), e.tag) {
          case 1:
            return t = e.flags, t & 65536 ? (e.flags = t & -65537 | 128, e) : null;
          case 3:
            return Ie(Rt), ut(), t = e.flags, (t & 65536) !== 0 && (t & 128) === 0 ? (e.flags = t & -65537 | 128, e) : null;
          case 26:
          case 27:
          case 5:
            return Wt(e), null;
          case 31:
            if (e.memoizedState !== null) {
              if (ve(e), e.alternate === null)
                throw Error(s(340));
              He();
            }
            return t = e.flags, t & 65536 ? (e.flags = t & -65537 | 128, e) : null;
          case 13:
            if (ve(e), t = e.memoizedState, t !== null && t.dehydrated !== null) {
              if (e.alternate === null)
                throw Error(s(340));
              He();
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
            return ve(e), hi(), t !== null && z(ta), t = e.flags, t & 65536 ? (e.flags = t & -65537 | 128, e) : null;
          case 24:
            return Ie(Rt), null;
          case 25:
            return null;
          default:
            return null;
        }
      }
      function tu(t, e) {
        switch (at(e), e.tag) {
          case 3:
            Ie(Rt), ut();
            break;
          case 26:
          case 27:
          case 5:
            Wt(e);
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
            ve(e), hi(), t !== null && z(ta);
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
          zt(e, e.return, C);
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
                  } catch (nt) {
                    zt(
                      c,
                      G,
                      nt
                    );
                  }
                }
              }
              r = r.next;
            } while (r !== u);
          }
        } catch (nt) {
          zt(e, e.return, nt);
        }
      }
      function eu(t) {
        var e = t.updateQueue;
        if (e !== null) {
          var a = t.stateNode;
          try {
            Js(e, a);
          } catch (r) {
            zt(t, t.return, r);
          }
        }
      }
      function nu(t, e, a) {
        a.props = Xn(
          t.type,
          t.memoizedProps
        ), a.state = t.memoizedState;
        try {
          a.componentWillUnmount();
        } catch (r) {
          zt(t, e, r);
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
      function au(t) {
        var e = t.type, a = t.memoizedProps, r = t.stateNode;
        try {
          qp(r, e, a, t);
        } catch (c) {
          zt(t, t.return, c);
        }
      }
      function Vi(t, e, a) {
        try {
          Yp(
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
      function lu(t) {
        return t.tag === 5 || t.tag === 3 || (Ye ? t.tag === 26 : !1) || (Xt ? t.tag === 27 && wa(t.type) : !1) || t.tag === 4;
      }
      function Ki(t) {
        t: for (; ; ) {
          for (; t.sibling === null; ) {
            if (t.return === null || lu(t.return)) return null;
            t = t.return;
          }
          for (t.sibling.return = t.return, t = t.sibling; t.tag !== 5 && t.tag !== 6 && t.tag !== 18; ) {
            if (Xt && t.tag === 27 && wa(t.type) || t.flags & 2 || t.child === null || t.tag === 4) continue t;
            t.child.return = t, t = t.child;
          }
          if (!(t.flags & 2)) return t.stateNode;
        }
      }
      function Xi(t, e, a) {
        var r = t.tag;
        if (r === 5 || r === 6)
          t = t.stateNode, e ? Lp(a, t, e) : Bp(a, t);
        else if (r !== 4 && (Xt && r === 27 && wa(t.type) && (a = t.stateNode, e = null), t = t.child, t !== null))
          for (Xi(t, e, a), t = t.sibling; t !== null; )
            Xi(t, e, a), t = t.sibling;
      }
      function $l(t, e, a) {
        var r = t.tag;
        if (r === 5 || r === 6)
          t = t.stateNode, e ? Gp(a, t, e) : Hp(a, t);
        else if (r !== 4 && (Xt && r === 27 && wa(t.type) && (a = t.stateNode), t = t.child, t !== null))
          for ($l(t, e, a), t = t.sibling; t !== null; )
            $l(t, e, a), t = t.sibling;
      }
      function ru(t, e, a) {
        t = t.containerInfo;
        try {
          nd(t, a);
        } catch (r) {
          zt(e, e.return, r);
        }
      }
      function iu(t) {
        var e = t.stateNode, a = t.memoizedProps;
        try {
          Dh(
            t.type,
            a,
            e,
            t
          );
        } catch (r) {
          zt(t, t.return, r);
        }
      }
      function Zm(t, e) {
        for (mp(t.containerInfo), It = e; It !== null; )
          if (t = It, e = t.child, (t.subtreeFlags & 1028) !== 0 && e !== null)
            e.return = t, It = e;
          else
            for (; It !== null; ) {
              t = It;
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
                      var g = Xn(
                        r.type,
                        c
                      );
                      e = u.getSnapshotBeforeUpdate(
                        g,
                        a
                      ), u.__reactInternalSnapshotBeforeUpdate = e;
                    } catch (C) {
                      zt(r, r.return, C);
                    }
                  }
                  break;
                case 3:
                  (e & 1024) !== 0 && ce && Wp(t.stateNode.containerInfo);
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
                e.return = t.return, It = e;
                break;
              }
              It = t.return;
            }
      }
      function ou(t, e, a) {
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
                  zt(a, a.return, g);
                }
              else {
                var c = Xn(
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
            r & 64 && eu(a), r & 512 && $a(a, a.return);
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
                Js(r, t);
              } catch (g) {
                zt(a, a.return, g);
              }
            }
            break;
          case 27:
            Xt && e === null && r & 4 && iu(a);
          case 26:
          case 5:
            if (tn(t, a), e === null) {
              if (r & 4) au(a);
              else if (r & 64) {
                t = a.type, e = a.memoizedProps, c = a.stateNode;
                try {
                  vh(
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
            r & 512 && $a(a, a.return);
            break;
          case 12:
            tn(t, a);
            break;
          case 31:
            tn(t, a), r & 4 && cu(t, a);
            break;
          case 13:
            tn(t, a), r & 4 && uu(t, a), r & 64 && (r = a.memoizedState, r !== null && (r = r.dehydrated, r !== null && (a = tp.bind(
              null,
              a
            ), Pp(r, a))));
            break;
          case 22:
            if (r = a.memoizedState !== null || sn, !r) {
              e = e !== null && e.memoizedState !== null || Qt, c = sn;
              var u = Qt;
              sn = r, (Qt = e) && !u ? en(
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
      function su(t) {
        var e = t.alternate;
        e !== null && (t.alternate = null, su(e)), t.child = null, t.deletions = null, t.sibling = null, t.tag === 5 && (e = t.stateNode, e !== null && _p(e)), t.stateNode = null, t.return = null, t.dependencies = null, t.memoizedProps = null, t.memoizedState = null, t.pendingProps = null, t.stateNode = null, t.updateQueue = null;
      }
      function Ue(t, e, a) {
        for (a = a.child; a !== null; )
          Zi(
            t,
            e,
            a
          ), a = a.sibling;
      }
      function Zi(t, e, a) {
        if (_e && typeof _e.onCommitFiberUnmount == "function")
          try {
            _e.onCommitFiberUnmount(rl, a);
          } catch {
          }
        switch (a.tag) {
          case 26:
            if (Ye) {
              Qt || Ve(a, e), Ue(
                t,
                e,
                a
              ), a.memoizedState ? ud(a.memoizedState) : a.stateNode && fd(a.stateNode);
              break;
            }
          case 27:
            if (Xt) {
              Qt || Ve(a, e);
              var r = Vt, c = ge;
              wa(a.type) && (Vt = a.stateNode, ge = !1), Ue(
                t,
                e,
                a
              ), hd(a.stateNode), Vt = r, ge = c;
              break;
            }
          case 5:
            Qt || Ve(a, e);
          case 6:
            if (ce) {
              if (r = Vt, c = ge, Vt = null, Ue(
                t,
                e,
                a
              ), Vt = r, ge = c, Vt !== null)
                if (ge)
                  try {
                    Vp(Vt, a.stateNode);
                  } catch (u) {
                    zt(
                      a,
                      e,
                      u
                    );
                  }
                else
                  try {
                    Qp(Vt, a.stateNode);
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
            ce && Vt !== null && (ge ? Eh(
              Vt,
              a.stateNode
            ) : Sh(Vt, a.stateNode));
            break;
          case 4:
            ce ? (r = Vt, c = ge, Vt = a.stateNode.containerInfo, ge = !0, Ue(
              t,
              e,
              a
            ), Vt = r, ge = c) : (Ke && ru(
              a.stateNode,
              a,
              td()
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
            Qt || (Ve(a, e), r = a.stateNode, typeof r.componentWillUnmount == "function" && nu(
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
            Qt = (r = Qt) || a.memoizedState !== null, Ue(
              t,
              e,
              a
            ), Qt = r;
            break;
          default:
            Ue(
              t,
              e,
              a
            );
        }
      }
      function cu(t, e) {
        if (ue && e.memoizedState === null && (t = e.alternate, t !== null && (t = t.memoizedState, t !== null))) {
          t = t.dehydrated;
          try {
            xh(t);
          } catch (a) {
            zt(e, e.return, a);
          }
        }
      }
      function uu(t, e) {
        if (ue && e.memoizedState === null && (t = e.alternate, t !== null && (t = t.memoizedState, t !== null && (t = t.dehydrated, t !== null))))
          try {
            wh(t);
          } catch (a) {
            zt(e, e.return, a);
          }
      }
      function Jm(t) {
        switch (t.tag) {
          case 31:
          case 13:
          case 19:
            var e = t.stateNode;
            return e === null && (e = t.stateNode = new Ed()), e;
          case 22:
            return t = t.stateNode, e = t._retryCache, e === null && (e = t._retryCache = new Ed()), e;
          default:
            throw Error(s(435, t.tag));
        }
      }
      function Pl(t, e) {
        var a = Jm(t);
        e.forEach(function(r) {
          if (!a.has(r)) {
            a.add(r);
            var c = ep.bind(null, t, r);
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
              var C = g;
              t: for (; C !== null; ) {
                switch (C.tag) {
                  case 27:
                    if (Xt) {
                      if (wa(C.type)) {
                        Vt = C.stateNode, ge = !1;
                        break t;
                      }
                      break;
                    }
                  case 5:
                    Vt = C.stateNode, ge = !1;
                    break t;
                  case 3:
                  case 4:
                    Vt = C.stateNode.containerInfo, ge = !0;
                    break t;
                }
                C = C.return;
              }
              if (Vt === null) throw Error(s(160));
              Zi(u, g, c), Vt = null, ge = !1;
            } else Zi(u, g, c);
            u = c.alternate, u !== null && (u.return = null), c.return = null;
          }
        if (e.subtreeFlags & 13886)
          for (e = e.child; e !== null; )
            du(e, t), e = e.sibling;
      }
      function du(t, e) {
        var a = t.alternate, r = t.flags;
        switch (t.tag) {
          case 0:
          case 11:
          case 14:
          case 15:
            se(e, t), me(t), r & 4 && (xn(3, t, t.return), Ia(3, t), xn(5, t, t.return));
            break;
          case 1:
            se(e, t), me(t), r & 512 && (Qt || a === null || Ve(a, a.return)), r & 64 && sn && (t = t.updateQueue, t !== null && (r = t.callbacks, r !== null && (a = t.shared.hiddenCallbacks, t.shared.hiddenCallbacks = a === null ? r : a.concat(r))));
            break;
          case 26:
            if (Ye) {
              var c = Ge;
              if (se(e, t), me(t), r & 512 && (Qt || a === null || Ve(a, a.return)), r & 4) {
                r = a !== null ? a.memoizedState : null;
                var u = t.memoizedState;
                a === null ? u === null ? t.stateNode === null ? t.stateNode = Mh(
                  c,
                  t.type,
                  t.memoizedProps,
                  t
                ) : dd(
                  c,
                  t.type,
                  t.stateNode
                ) : t.stateNode = cd(
                  c,
                  u,
                  t.memoizedProps
                ) : r !== u ? (r === null ? a.stateNode !== null && fd(a.stateNode) : ud(r), u === null ? dd(
                  c,
                  t.type,
                  t.stateNode
                ) : cd(
                  c,
                  u,
                  t.memoizedProps
                )) : u === null && t.stateNode !== null && Vi(
                  t,
                  t.memoizedProps,
                  a.memoizedProps
                );
              }
              break;
            }
          case 27:
            if (Xt) {
              se(e, t), me(t), r & 512 && (Qt || a === null || Ve(a, a.return)), a !== null && r & 4 && Vi(
                t,
                t.memoizedProps,
                a.memoizedProps
              );
              break;
            }
          case 5:
            if (se(e, t), me(t), r & 512 && (Qt || a === null || Ve(a, a.return)), ce) {
              if (t.flags & 32) {
                c = t.stateNode;
                try {
                  Pu(c);
                } catch ($) {
                  zt(t, t.return, $);
                }
              }
              r & 4 && t.stateNode != null && (c = t.memoizedProps, Vi(
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
                Up(c, a, r);
              } catch ($) {
                zt(t, t.return, $);
              }
            }
            break;
          case 3:
            if (Ye ? (jh(), c = Ge, Ge = yo(e.containerInfo), se(e, t), Ge = c) : se(e, t), me(t), r & 4) {
              if (ce && ue && a !== null && a.memoizedState.isDehydrated)
                try {
                  yh(e.containerInfo);
                } catch ($) {
                  zt(t, t.return, $);
                }
              if (Ke) {
                r = e.containerInfo, a = e.pendingChildren;
                try {
                  nd(r, a);
                } catch ($) {
                  zt(t, t.return, $);
                }
              }
            }
            Ho && (Ho = !1, fu(t));
            break;
          case 4:
            Ye ? (a = Ge, Ge = yo(
              t.stateNode.containerInfo
            ), se(e, t), me(t), Ge = a) : (se(e, t), me(t)), r & 4 && Ke && ru(
              t.stateNode,
              t,
              t.stateNode.pendingChildren
            );
            break;
          case 12:
            se(e, t), me(t);
            break;
          case 31:
            se(e, t), me(t), r & 4 && (r = t.updateQueue, r !== null && (t.updateQueue = null, Pl(t, r)));
            break;
          case 13:
            se(e, t), me(t), t.child.flags & 8192 && t.memoizedState !== null != (a !== null && a.memoizedState !== null) && (zr = he()), r & 4 && (r = t.updateQueue, r !== null && (t.updateQueue = null, Pl(t, r)));
            break;
          case 22:
            c = t.memoizedState !== null;
            var g = a !== null && a.memoizedState !== null, C = sn, G = Qt;
            if (sn = C || c, Qt = G || g, se(e, t), Qt = G, sn = C, me(t), r & 8192 && (e = t.stateNode, e._visibility = c ? e._visibility & -2 : e._visibility | 1, c && (a === null || g || sn || Qt || Zn(t)), ce)) {
              t: if (a = null, ce)
                for (e = t; ; ) {
                  if (e.tag === 5 || Ye && e.tag === 26) {
                    if (a === null) {
                      g = a = e;
                      try {
                        u = g.stateNode, c ? Kp(u) : Zp(
                          g.stateNode,
                          g.memoizedProps
                        );
                      } catch ($) {
                        zt(g, g.return, $);
                      }
                    }
                  } else if (e.tag === 6) {
                    if (a === null) {
                      g = e;
                      try {
                        var W = g.stateNode;
                        c ? Xp(W) : Jp(W, g.memoizedProps);
                      } catch ($) {
                        zt(g, g.return, $);
                      }
                    }
                  } else if (e.tag === 18) {
                    if (a === null) {
                      g = e;
                      try {
                        var nt = g.stateNode;
                        c ? zh(nt) : Nh(g.stateNode);
                      } catch ($) {
                        zt(g, g.return, $);
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
            r & 4 && (r = t.updateQueue, r !== null && (a = r.retryQueue, a !== null && (r.retryQueue = null, Pl(t, a))));
            break;
          case 19:
            se(e, t), me(t), r & 4 && (r = t.updateQueue, r !== null && (t.updateQueue = null, Pl(t, r)));
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
              if (lu(r)) {
                a = r;
                break;
              }
              r = r.return;
            }
            if (ce) {
              if (a == null) throw Error(s(160));
              switch (a.tag) {
                case 27:
                  if (Xt) {
                    var c = a.stateNode, u = Ki(t);
                    $l(t, u, c);
                    break;
                  }
                case 5:
                  var g = a.stateNode;
                  a.flags & 32 && (Pu(g), a.flags &= -33);
                  var C = Ki(t);
                  $l(t, C, g);
                  break;
                case 3:
                case 4:
                  var G = a.stateNode.containerInfo, W = Ki(t);
                  Xi(
                    t,
                    W,
                    G
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
      function fu(t) {
        if (t.subtreeFlags & 1024)
          for (t = t.child; t !== null; ) {
            var e = t;
            fu(e), e.tag === 5 && e.flags & 1024 && Np(e.stateNode), t = t.sibling;
          }
      }
      function tn(t, e) {
        if (e.subtreeFlags & 8772)
          for (e = e.child; e !== null; )
            ou(t, e.alternate, e), e = e.sibling;
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
              typeof a.componentWillUnmount == "function" && nu(
                e,
                e.return,
                a
              ), Zn(e);
              break;
            case 27:
              Xt && hd(e.stateNode);
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
                  zt(r, r.return, W);
                }
              if (r = u, c = r.updateQueue, c !== null) {
                var C = r.stateNode;
                try {
                  var G = c.shared.hiddenCallbacks;
                  if (G !== null)
                    for (c.shared.hiddenCallbacks = null, c = 0; c < G.length; c++)
                      Zs(G[c], C);
                } catch (W) {
                  zt(r, r.return, W);
                }
              }
              a && g & 64 && eu(u), $a(u, u.return);
              break;
            case 27:
              Xt && iu(u);
            case 26:
            case 5:
              en(
                c,
                u,
                a
              ), a && r === null && g & 4 && au(u), $a(u, u.return);
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
              ), a && g & 4 && cu(c, u);
              break;
            case 13:
              en(
                c,
                u,
                a
              ), a && g & 4 && uu(c, u);
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
      function Ji(t, e) {
        var a = null;
        t !== null && t.memoizedState !== null && t.memoizedState.cachePool !== null && (a = t.memoizedState.cachePool.pool), t = null, e.memoizedState !== null && e.memoizedState.cachePool !== null && (t = e.memoizedState.cachePool.pool), t !== a && (t != null && t.refCount++, a != null && La(a));
      }
      function Wi(t, e) {
        t = null, e.alternate !== null && (t = e.alternate.memoizedState.cache), e = e.memoizedState.cache, e !== t && (e.refCount++, t != null && La(t));
      }
      function qe(t, e, a, r) {
        if (e.subtreeFlags & 10256)
          for (e = e.child; e !== null; )
            mu(
              t,
              e,
              a,
              r
            ), e = e.sibling;
      }
      function mu(t, e, a, r) {
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
            ), c & 2048 && Ia(9, e);
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
                var u = e.memoizedProps, g = u.id, C = u.onPostCommit;
                typeof C == "function" && C(
                  g,
                  e.alternate === null ? "mount" : "update",
                  t.passiveEffectDuration,
                  -0
                );
              } catch (G) {
                zt(e, e.return, G);
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
            ) : Pa(
              t,
              e
            ) : u._visibility & 2 ? qe(
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
            )), c & 2048 && Ji(g, e);
            break;
          case 24:
            qe(
              t,
              e,
              a,
              r
            ), c & 2048 && Wi(e.alternate, e);
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
              var nt = g.stateNode;
              g.memoizedState !== null ? nt._visibility & 2 ? ha(
                u,
                g,
                C,
                G,
                c
              ) : Pa(
                u,
                g
              ) : (nt._visibility |= 2, ha(
                u,
                g,
                C,
                G,
                c
              )), c && W & 2048 && Ji(
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
              ), c && W & 2048 && Wi(g.alternate, g);
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
                Pa(a, r), c & 2048 && Ji(
                  r.alternate,
                  r
                );
                break;
              case 24:
                Pa(a, r), c & 2048 && Wi(
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
            pu(
              t,
              e,
              a
            ), t = t.sibling;
      }
      function pu(t, e, a) {
        switch (t.tag) {
          case 26:
            if (Jn(
              t,
              e,
              a
            ), t.flags & Da)
              if (t.memoizedState !== null)
                Rh(
                  a,
                  Ge,
                  t.memoizedState,
                  t.memoizedProps
                );
              else {
                var r = t.stateNode, c = t.type;
                t = t.memoizedProps, ((e & 335544128) === e || go(c, t)) && $u(a, r, c, t);
              }
            break;
          case 5:
            Jn(
              t,
              e,
              a
            ), t.flags & Da && (r = t.stateNode, c = t.type, t = t.memoizedProps, ((e & 335544128) === e || go(c, t)) && $u(a, r, c, t));
            break;
          case 3:
          case 4:
            Ye ? (r = Ge, Ge = yo(
              t.stateNode.containerInfo
            ), Jn(
              t,
              e,
              a
            ), Ge = r) : Jn(
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
      function hu(t) {
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
              It = r, bu(
                r,
                t
              );
            }
          hu(t);
        }
        if (t.subtreeFlags & 10256)
          for (t = t.child; t !== null; )
            gu(t), t = t.sibling;
      }
      function gu(t) {
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
            t.memoizedState !== null && e._visibility & 2 && (t.return === null || t.return.tag !== 13) ? (e._visibility &= -3, tr(t)) : tl(t);
            break;
          default:
            tl(t);
        }
      }
      function tr(t) {
        var e = t.deletions;
        if ((t.flags & 16) !== 0) {
          if (e !== null)
            for (var a = 0; a < e.length; a++) {
              var r = e[a];
              It = r, bu(
                r,
                t
              );
            }
          hu(t);
        }
        for (t = t.child; t !== null; ) {
          switch (e = t, e.tag) {
            case 0:
            case 11:
            case 15:
              xn(8, e, e.return), tr(e);
              break;
            case 22:
              a = e.stateNode, a._visibility & 2 && (a._visibility &= -3, tr(e));
              break;
            default:
              tr(e);
          }
          t = t.sibling;
        }
      }
      function bu(t, e) {
        for (; It !== null; ) {
          var a = It;
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
          if (r = a.child, r !== null) r.return = a, It = r;
          else
            t: for (a = t; It !== null; ) {
              r = It;
              var c = r.sibling, u = r.return;
              if (su(r), r === a) {
                It = null;
                break t;
              }
              if (c !== null) {
                c.return = u, It = c;
                break t;
              }
              It = u;
            }
        }
      }
      function Fi(t) {
        var e = vp(t);
        if (e != null) {
          if (typeof e.memoizedProps["data-testname"] != "string")
            throw Error(s(364));
          return e;
        }
        if (t = Mp(t), t === null) throw Error(s(362));
        return t.stateNode.current;
      }
      function Ii(t, e) {
        var a = t.tag;
        switch (e.$$typeof) {
          case wr:
            if (t.type === e.value) return !0;
            break;
          case _r:
            t: {
              for (e = e.value, t = [t, 0], a = 0; a < t.length; ) {
                var r = t[a++], c = r.tag, u = t[a++], g = e[u];
                if (c !== 5 && c !== 26 && c !== 27 || !ll(r)) {
                  for (; g != null && Ii(r, g); )
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
          case kr:
            if ((a === 5 || a === 26 || a === 27) && Op(t.stateNode, e.value))
              return !0;
            break;
          case Er:
            if ((a === 5 || a === 6 || a === 26 || a === 27) && (t = jp(t), t !== null && 0 <= t.indexOf(e.value)))
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
      function $i(t) {
        switch (t.$$typeof) {
          case wr:
            return "<" + (w(t.value) || "Unknown") + ">";
          case _r:
            return ":has(" + ($i(t) || "") + ")";
          case kr:
            return '[role="' + t.value + '"]';
          case Er:
            return '"' + t.value + '"';
          case Sr:
            return '[data-testname="' + t.value + '"]';
          default:
            throw Error(s(365));
        }
      }
      function vu(t, e) {
        var a = [];
        t = [t, 0];
        for (var r = 0; r < t.length; ) {
          var c = t[r++], u = c.tag, g = t[r++], C = e[g];
          if (u !== 5 && u !== 26 && u !== 27 || !ll(c)) {
            for (; C != null && Ii(c, C); )
              g++, C = e[g];
            if (g === e.length) a.push(c);
            else
              for (c = c.child; c !== null; )
                t.push(c, g), c = c.sibling;
          }
        }
        return a;
      }
      function Pi(t, e) {
        if (!al) throw Error(s(363));
        t = Fi(t), t = vu(t, e), e = [], t = Array.from(t);
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
      function ye() {
        return (xt & 2) !== 0 && _t !== 0 ? _t & -_t : dt.T !== null ? si() : xp();
      }
      function yu() {
        if (ze === 0)
          if ((_t & 536870912) === 0 || St) {
            var t = sr;
            sr <<= 1, (sr & 3932160) === 0 && (sr = 262144), ze = t;
          } else ze = 536870912;
        return t = Se.current, t !== null && (t.flags |= 32), ze;
      }
      function pe(t, e, a) {
        (t === At && (Ct === 2 || Ct === 9) || t.cancelPendingCommit !== null) && (ga(t, 0), wn(
          t,
          _t,
          ze,
          !1
        )), H(t, a), ((xt & 2) === 0 || t !== At) && (t === At && ((xt & 2) === 0 && (la |= a), Bt === 4 && wn(
          t,
          _t,
          ze,
          !1
        )), Qe(t));
      }
      function xu(t, e, a) {
        if ((xt & 6) !== 0) throw Error(s(327));
        var r = !a && (e & 127) === 0 && (e & t.expiredLanes) === 0 || D(t, e), c = r ? Im(t, e) : eo(t, e, !0), u = r;
        do {
          if (c === 0) {
            Ha && !r && wn(t, e, 0, !1);
            break;
          } else {
            if (a = t.current.alternate, u && !Wm(a)) {
              c = eo(t, e, !1), u = !1;
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
                  var G = ue && C.current.memoizedState.isDehydrated;
                  if (G && (ga(C, g).flags |= 256), g = eo(
                    C,
                    g,
                    !1
                  ), g !== 2) {
                    if (Bo && !G) {
                      C.errorRecoveryDisabledLanes |= u, la |= u, c = 4;
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
              ga(t, 0), wn(t, e, 0, !0);
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
              if ((e & 62914560) === e && (c = zr + 300 - he(), 10 < c)) {
                if (wn(
                  r,
                  e,
                  ze,
                  !Tn
                ), N(r, 0, !0) !== 0) break t;
                un = e, r.timeoutHandle = gp(
                  wu.bind(
                    null,
                    r,
                    a,
                    be,
                    Nr,
                    qo,
                    e,
                    ze,
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
              wu(
                r,
                a,
                be,
                Nr,
                qo,
                e,
                ze,
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
        Qe(t);
      }
      function wu(t, e, a, r, c, u, g, C, G, W, nt, $, lt, gt) {
        if (t.timeoutHandle = Fn, $ = e.subtreeFlags, $ & 8192 || ($ & 16785408) === 16785408) {
          $ = Ep(), pu(
            e,
            u,
            $
          );
          var le = (u & 62914560) === u ? zr - he() : (u & 4194048) === u ? zd - he() : 0;
          if (le = zp(
            $,
            le
          ), le !== null) {
            un = u, t.cancelPendingCommit = le(
              Mu.bind(
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
                nt,
                $,
                null,
                lt,
                gt
              )
            ), wn(t, u, g, !W);
            return;
          }
        }
        Mu(
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
      function Wm(t) {
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
        e &= ~Uo, e &= ~la, t.suspendedLanes |= e, t.pingedLanes &= ~e, r && (t.warmLanes |= e), r = t.expirationTimes;
        for (var c = e; 0 < c; ) {
          var u = 31 - we(c), g = 1 << u;
          r[u] = -1, c &= ~g;
        }
        a !== 0 && b(t, a, e);
      }
      function _u() {
        return (xt & 6) === 0 ? (ma(0), !1) : !0;
      }
      function to() {
        if (wt !== null) {
          if (Ct === 0)
            var t = wt.return;
          else
            t = wt, rn = $n = null, wi(t), Ma = null, cl = 0, t = wt;
          for (; t !== null; )
            tu(t.alternate, t), t = t.return;
          wt = null;
        }
      }
      function ga(t, e) {
        var a = t.timeoutHandle;
        a !== Fn && (t.timeoutHandle = Fn, bp(a)), a = t.cancelPendingCommit, a !== null && (t.cancelPendingCommit = null, a()), un = 0, to(), At = t, wt = a = nn(t.current, null), _t = e, Ct = 0, Ee = null, Tn = !1, Ha = D(t, e), Bo = !1, Ba = ze = Uo = la = Cn = Bt = 0, be = ml = null, qo = !1, (e & 8) !== 0 && (e |= e & 32);
        var r = t.entangledLanes;
        if (r !== 0)
          for (t = t.entanglements, r &= e; 0 < r; ) {
            var c = 31 - we(r), u = 1 << c;
            e |= t[c], r &= ~u;
          }
        return cn = e, Hl(), a;
      }
      function ku(t, e) {
        bt = null, dt.H = dl, e === Ca || e === gr ? (e = Qs(), Ct = 3) : e === Co ? (e = Qs(), Ct = 4) : Ct = e === Ro ? 8 : e !== null && typeof e == "object" && typeof e.then == "function" ? 6 : 1, Ee = e, wt === null && (Bt = 1, Xl(
          t,
          L(e, t.current)
        ));
      }
      function Su() {
        var t = Se.current;
        return t === null ? !0 : (_t & 4194048) === _t ? Oe === null : (_t & 62914560) === _t || (_t & 536870912) !== 0 ? t === Oe : !1;
      }
      function Eu() {
        var t = dt.H;
        return dt.H = dl, t === null ? dl : t;
      }
      function zu() {
        var t = dt.A;
        return dt.A = Wh, t;
      }
      function er() {
        Bt = 4, Tn || (_t & 4194048) !== _t && Se.current !== null || (Ha = !0), (Cn & 134217727) === 0 && (la & 134217727) === 0 || At === null || wn(
          At,
          _t,
          ze,
          !1
        );
      }
      function eo(t, e, a) {
        var r = xt;
        xt |= 2;
        var c = Eu(), u = zu();
        (At !== t || _t !== e) && (Nr = null, ga(t, e)), e = !1;
        var g = Bt;
        t: do
          try {
            if (Ct !== 0 && wt !== null) {
              var C = wt, G = Ee;
              switch (Ct) {
                case 8:
                  to(), g = 6;
                  break t;
                case 3:
                case 2:
                case 9:
                case 6:
                  Se.current === null && (e = !0);
                  var W = Ct;
                  if (Ct = 0, Ee = null, ba(t, C, G, W), a && Ha) {
                    g = 0;
                    break t;
                  }
                  break;
                default:
                  W = Ct, Ct = 0, Ee = null, ba(t, C, G, W);
              }
            }
            Fm(), g = Bt;
            break;
          } catch (nt) {
            ku(t, nt);
          }
        while (!0);
        return e && t.shellSuspendCounter++, rn = $n = null, xt = r, dt.H = c, dt.A = u, wt === null && (At = null, _t = 0, Hl()), g;
      }
      function Fm() {
        for (; wt !== null; ) Nu(wt);
      }
      function Im(t, e) {
        var a = xt;
        xt |= 2;
        var r = Eu(), c = zu();
        At !== t || _t !== e ? (Nr = null, pl = he() + 500, ga(t, e)) : Ha = D(
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
                  Ct = 0, Ee = null, ba(t, e, u, 1);
                  break;
                case 2:
                case 9:
                  if (Gs(u)) {
                    Ct = 0, Ee = null, Tu(e);
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
                  Gs(u) ? (Ct = 0, Ee = null, Tu(e)) : (Ct = 0, Ee = null, ba(t, e, u, 7));
                  break;
                case 5:
                  var g = null;
                  switch (wt.tag) {
                    case 26:
                      g = wt.memoizedState;
                    case 5:
                    case 27:
                      var C = wt, G = C.type, W = C.pendingProps;
                      if (g ? md(g) : Iu(C.stateNode, G, W)) {
                        Ct = 0, Ee = null;
                        var nt = C.sibling;
                        if (nt !== null) wt = nt;
                        else {
                          var $ = C.return;
                          $ !== null ? (wt = $, nr($)) : wt = null;
                        }
                        break e;
                      }
                  }
                  Ct = 0, Ee = null, ba(t, e, u, 5);
                  break;
                case 6:
                  Ct = 0, Ee = null, ba(t, e, u, 6);
                  break;
                case 8:
                  to(), Bt = 6;
                  break t;
                default:
                  throw Error(s(462));
              }
            }
            $m();
            break;
          } catch (lt) {
            ku(t, lt);
          }
        while (!0);
        return rn = $n = null, dt.H = r, dt.A = c, xt = a, wt !== null ? 0 : (At = null, _t = 0, Hl(), Bt);
      }
      function $m() {
        for (; wt !== null && !Uh(); )
          Nu(wt);
      }
      function Nu(t) {
        var e = Wc(
          t.alternate,
          t,
          cn
        );
        t.memoizedProps = t.pendingProps, e === null ? nr(t) : wt = e;
      }
      function Tu(t) {
        var e = t, a = e.alternate;
        switch (e.tag) {
          case 15:
          case 0:
            e = Qc(
              a,
              e,
              e.pendingProps,
              e.type,
              void 0,
              _t
            );
            break;
          case 11:
            e = Qc(
              a,
              e,
              e.pendingProps,
              e.type.render,
              e.ref,
              _t
            );
            break;
          case 5:
            wi(e);
          default:
            tu(a, e), e = wt = Uu(e, cn), e = Wc(a, e, cn);
        }
        t.memoizedProps = t.pendingProps, e === null ? nr(t) : wt = e;
      }
      function ba(t, e, a, r) {
        rn = $n = null, wi(e), Ma = null, cl = 0;
        var c = e.return;
        try {
          if (Lm(
            t,
            c,
            e,
            a,
            _t
          )) {
            Bt = 1, Xl(
              t,
              L(a, t.current)
            ), wt = null;
            return;
          }
        } catch (u) {
          if (c !== null) throw wt = c, u;
          Bt = 1, Xl(
            t,
            L(a, t.current)
          ), wt = null;
          return;
        }
        e.flags & 32768 ? (St || r === 1 ? t = !0 : Ha || (_t & 536870912) !== 0 ? t = !1 : (Tn = t = !0, (r === 2 || r === 9 || r === 3 || r === 6) && (r = Se.current, r !== null && r.tag === 13 && (r.flags |= 16384))), Cu(e, t)) : nr(e);
      }
      function nr(t) {
        var e = t;
        do {
          if ((e.flags & 32768) !== 0) {
            Cu(
              e,
              Tn
            );
            return;
          }
          t = e.return;
          var a = Km(
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
        Bt === 0 && (Bt = 5);
      }
      function Cu(t, e) {
        do {
          var a = Xm(t.alternate, t);
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
      function Mu(t, e, a, r, c, u, g, C, G) {
        t.cancelPendingCommit = null;
        do
          el();
        while (Zt !== 0);
        if ((xt & 6) !== 0) throw Error(s(327));
        if (e !== null) {
          if (e === t.current)
            throw Error(s(177));
          if (u = e.lanes | e.childLanes, u |= Mo, h(
            t,
            a,
            u,
            g,
            C,
            G
          ), t === At && (wt = At = null, _t = 0), Ua = e, An = t, un = a, Yo = u, Go = c, Nd = r, (e.subtreeFlags & 10256) !== 0 || (e.flags & 10256) !== 0 ? (t.callbackNode = null, t.callbackPriority = 0, np(_o, function() {
            return Du(), null;
          })) : (t.callbackNode = null, t.callbackPriority = 0), r = (e.flags & 13878) !== 0, (e.subtreeFlags & 13878) !== 0 || r) {
            r = dt.T, dt.T = null, c = ln(), Ft(2), g = xt, xt |= 4;
            try {
              Zm(t, e, a);
            } finally {
              xt = g, Ft(c), dt.T = r;
            }
          }
          Zt = 1, Au(), ju(), Ou();
        }
      }
      function Au() {
        if (Zt === 1) {
          Zt = 0;
          var t = An, e = Ua, a = (e.flags & 13878) !== 0;
          if ((e.subtreeFlags & 13878) !== 0 || a) {
            a = dt.T, dt.T = null;
            var r = ln();
            Ft(2);
            var c = xt;
            xt |= 4;
            try {
              du(e, t), pp(t.containerInfo);
            } finally {
              xt = c, Ft(r), dt.T = a;
            }
          }
          t.current = e, Zt = 2;
        }
      }
      function ju() {
        if (Zt === 2) {
          Zt = 0;
          var t = An, e = Ua, a = (e.flags & 8772) !== 0;
          if ((e.subtreeFlags & 8772) !== 0 || a) {
            a = dt.T, dt.T = null;
            var r = ln();
            Ft(2);
            var c = xt;
            xt |= 4;
            try {
              ou(t, e.alternate, e);
            } finally {
              xt = c, Ft(r), dt.T = a;
            }
          }
          Zt = 3;
        }
      }
      function Ou() {
        if (Zt === 4 || Zt === 3) {
          Zt = 0, qh();
          var t = An, e = Ua, a = un, r = Nd;
          (e.subtreeFlags & 10256) !== 0 || (e.flags & 10256) !== 0 ? Zt = 5 : (Zt = 0, Ua = An = null, Ru(t, t.pendingLanes));
          var c = t.pendingLanes;
          if (c === 0 && (Mn = null), M(a), e = e.stateNode, _e && typeof _e.onCommitFiberRoot == "function")
            try {
              _e.onCommitFiberRoot(
                rl,
                e,
                void 0,
                (e.current.flags & 128) === 128
              );
            } catch {
            }
          if (r !== null) {
            e = dt.T, c = ln(), Ft(2), dt.T = null;
            try {
              for (var u = t.onRecoverableError, g = 0; g < r.length; g++) {
                var C = r[g];
                u(C.value, {
                  componentStack: C.stack
                });
              }
            } finally {
              dt.T = e, Ft(c);
            }
          }
          (un & 3) !== 0 && el(), Qe(t), c = t.pendingLanes, (a & 261930) !== 0 && (c & 42) !== 0 ? t === Lo ? hl++ : (hl = 0, Lo = t) : hl = 0, ue && kh(), ma(0);
        }
      }
      function Ru(t, e) {
        (t.pooledCacheLanes &= e) === 0 && (e = t.pooledCache, e != null && (t.pooledCache = null, La(e)));
      }
      function el() {
        return Au(), ju(), Ou(), Du();
      }
      function Du() {
        if (Zt !== 5) return !1;
        var t = An, e = Yo;
        Yo = 0;
        var a = M(un), r = 32 > a ? 32 : a;
        a = dt.T;
        var c = ln();
        try {
          Ft(r), dt.T = null, r = Go, Go = null;
          var u = An, g = un;
          if (Zt = 0, Ua = An = null, un = 0, (xt & 6) !== 0)
            throw Error(s(331));
          var C = xt;
          if (xt |= 4, gu(u.current), mu(
            u,
            u.current,
            g,
            r
          ), xt = C, ma(0, !1), _e && typeof _e.onPostCommitFiberRoot == "function")
            try {
              _e.onPostCommitFiberRoot(rl, u);
            } catch {
            }
          return !0;
        } finally {
          Ft(c), dt.T = a, Ru(t, e);
        }
      }
      function Hu(t, e, a) {
        e = L(a, e), e = Oi(t.stateNode, e, 2), t = bn(t, e, 2), t !== null && (H(t, 2), Qe(t));
      }
      function zt(t, e, a) {
        if (t.tag === 3)
          Hu(t, t, a);
        else
          for (; e !== null; ) {
            if (e.tag === 3) {
              Hu(
                e,
                t,
                a
              );
              break;
            } else if (e.tag === 1) {
              var r = e.stateNode;
              if (typeof e.type.getDerivedStateFromError == "function" || typeof r.componentDidCatch == "function" && (Mn === null || !Mn.has(r))) {
                t = L(a, t), a = Dc(2), r = bn(e, a, 2), r !== null && (Hc(
                  a,
                  r,
                  e,
                  t
                ), H(r, 2), Qe(r));
                break;
              }
            }
            e = e.return;
          }
      }
      function no(t, e, a) {
        var r = t.pingCache;
        if (r === null) {
          r = t.pingCache = new Fh();
          var c = /* @__PURE__ */ new Set();
          r.set(e, c);
        } else
          c = r.get(e), c === void 0 && (c = /* @__PURE__ */ new Set(), r.set(e, c));
        c.has(a) || (Bo = !0, c.add(a), t = Pm.bind(null, t, e, a), e.then(t, t));
      }
      function Pm(t, e, a) {
        var r = t.pingCache;
        r !== null && r.delete(e), t.pingedLanes |= t.suspendedLanes & a, t.warmLanes &= ~a, At === t && (_t & a) === a && (Bt === 4 || Bt === 3 && (_t & 62914560) === _t && 300 > he() - zr ? (xt & 2) === 0 && ga(t, 0) : Uo |= a, Ba === _t && (Ba = 0)), Qe(t);
      }
      function Bu(t, e) {
        e === 0 && (e = X()), t = Kn(t, e), t !== null && (H(t, e), Qe(t));
      }
      function tp(t) {
        var e = t.memoizedState, a = 0;
        e !== null && (a = e.retryLane), Bu(t, a);
      }
      function ep(t, e) {
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
        r !== null && r.delete(e), Bu(t, a);
      }
      function np(t, e) {
        return ur(t, e);
      }
      function ap(t, e, a, r) {
        this.tag = t, this.key = a, this.sibling = this.child = this.return = this.stateNode = this.type = this.elementType = null, this.index = 0, this.refCleanup = this.ref = null, this.pendingProps = e, this.dependencies = this.memoizedState = this.updateQueue = this.memoizedProps = null, this.mode = r, this.subtreeFlags = this.flags = 0, this.deletions = null, this.childLanes = this.lanes = 0, this.alternate = null;
      }
      function ao(t) {
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
      function Uu(t, e) {
        t.flags &= 65011714;
        var a = t.alternate;
        return a === null ? (t.childLanes = 0, t.lanes = e, t.child = null, t.subtreeFlags = 0, t.memoizedProps = null, t.memoizedState = null, t.updateQueue = null, t.dependencies = null, t.stateNode = null) : (t.childLanes = a.childLanes, t.lanes = a.lanes, t.child = a.child, t.subtreeFlags = 0, t.deletions = null, t.memoizedProps = a.memoizedProps, t.memoizedState = a.memoizedState, t.updateQueue = a.updateQueue, t.type = a.type, e = a.dependencies, t.dependencies = e === null ? null : {
          lanes: e.lanes,
          firstContext: e.firstContext
        }), t;
      }
      function ar(t, e, a, r, c, u) {
        var g = 0;
        if (r = t, typeof t == "function") ao(t) && (g = 1);
        else if (typeof t == "string")
          g = Ye && Xt ? od(t, a, ne.current) ? 26 : gd(t) ? 27 : 5 : Ye ? od(
            t,
            a,
            ne.current
          ) ? 26 : 5 : Xt && gd(t) ? 27 : 5;
        else
          t: switch (t) {
            case po:
              return t = o(31, a, e, c), t.elementType = po, t.lanes = u, t;
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
            case so:
              return t = o(12, a, e, c | 2), t.elementType = so, t.lanes = u, t;
            case uo:
              return t = o(13, a, e, c), t.elementType = uo, t.lanes = u, t;
            case fo:
              return t = o(19, a, e, c), t.elementType = fo, t.lanes = u, t;
            default:
              if (typeof t == "object" && t !== null)
                switch (t.$$typeof) {
                  case _n:
                    g = 10;
                    break t;
                  case Xu:
                    g = 9;
                    break t;
                  case co:
                    g = 11;
                    break t;
                  case mo:
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
      function Wn(t, e, a, r) {
        return t = o(7, t, r, e), t.lanes = a, t;
      }
      function lo(t, e, a) {
        return t = o(6, t, null, e), t.lanes = a, t;
      }
      function qu(t) {
        var e = o(18, null, null, 0);
        return e.stateNode = t, e;
      }
      function ro(t, e, a) {
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
      function lp(t, e, a, r, c, u, g, C, G) {
        this.tag = 1, this.containerInfo = t, this.pingCache = this.current = this.pendingChildren = null, this.timeoutHandle = Fn, this.callbackNode = this.next = this.pendingContext = this.context = this.cancelPendingCommit = null, this.callbackPriority = 0, this.expirationTimes = q(-1), this.entangledLanes = this.shellSuspendCounter = this.errorRecoveryDisabledLanes = this.expiredLanes = this.warmLanes = this.pingedLanes = this.suspendedLanes = this.pendingLanes = 0, this.entanglements = q(0), this.hiddenUpdates = q(null), this.identifierPrefix = r, this.onUncaughtError = c, this.onCaughtError = u, this.onRecoverableError = g, this.pooledCache = null, this.pooledCacheLanes = 0, this.formState = G, this.incompleteTransitions = /* @__PURE__ */ new Map();
      }
      function Yu(t, e, a, r, c, u, g, C, G, W, nt, $) {
        return t = new lp(
          t,
          e,
          a,
          g,
          G,
          W,
          nt,
          $,
          C
        ), e = 1, u === !0 && (e |= 24), u = o(3, null, null, e), t.current = u, u.stateNode = t, e = oi(), e.refCount++, t.pooledCache = e, e.refCount++, u.memoizedState = {
          element: r,
          isDehydrated: a,
          cache: e
        }, di(u), t;
      }
      function Gu(t) {
        return t ? (t = ka, t) : ka;
      }
      function Lu(t) {
        var e = t._reactInternals;
        if (e === void 0)
          throw typeof t.render == "function" ? Error(s(188)) : (t = Object.keys(t).join(","), Error(s(268, t)));
        return t = f(e), t = t !== null ? p(t) : null, t === null ? null : nl(t.stateNode);
      }
      function Qu(t, e, a, r, c, u) {
        c = Gu(c), r.context === null ? r.context = c : r.pendingContext = c, r = gn(e), r.payload = { element: a }, u = u === void 0 ? null : u, u !== null && (r.callback = u), a = bn(t, r, e), a !== null && (pe(a, t, e), Va(a, t, e));
      }
      function Vu(t, e) {
        if (t = t.memoizedState, t !== null && t.dehydrated !== null) {
          var a = t.retryLane;
          t.retryLane = a !== 0 && a < e ? a : e;
        }
      }
      function io(t, e) {
        Vu(t, e), (t = t.alternate) && Vu(t, e);
      }
      var yt = {}, rp = S0, xe = z0(), oo = Object.assign, ip = Symbol.for("react.element"), lr = Symbol.for("react.transitional.element"), va = Symbol.for("react.portal"), ya = Symbol.for("react.fragment"), Ku = Symbol.for("react.strict_mode"), so = Symbol.for("react.profiler"), Xu = Symbol.for("react.consumer"), _n = Symbol.for("react.context"), co = Symbol.for("react.forward_ref"), uo = Symbol.for("react.suspense"), fo = Symbol.for("react.suspense_list"), mo = Symbol.for("react.memo"), kn = Symbol.for("react.lazy"), po = Symbol.for("react.activity"), op = Symbol.for("react.memo_cache_sentinel"), Zu = Symbol.iterator, sp = Symbol.for("react.client.reference"), rr = Array.isArray, dt = rp.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE, cp = l.rendererVersion, up = l.rendererPackageName, Ju = l.extraDevToolsConfig, nl = l.getPublicInstance, dp = l.getRootHostContext, fp = l.getChildHostContext, mp = l.prepareForCommit, pp = l.resetAfterCommit, hp = l.createInstance;
      l.cloneMutableInstance;
      var ho = l.appendInitialChild, Wu = l.finalizeInitialChildren, ir = l.shouldSetTextContent, Fu = l.createTextInstance;
      l.cloneMutableTextInstance;
      var gp = l.scheduleTimeout, bp = l.cancelTimeout, Fn = l.noTimeout, an = l.isPrimaryRenderer;
      l.warnsIfNotActing;
      var ce = l.supportsMutation, Ke = l.supportsPersistence, ue = l.supportsHydration, vp = l.getInstanceFromNode;
      l.beforeActiveInstanceBlur;
      var yp = l.preparePortalMount;
      l.prepareScopeUpdate, l.getInstanceFromScope;
      var Ft = l.setCurrentUpdatePriority, ln = l.getCurrentUpdatePriority, xp = l.resolveUpdatePriority;
      l.trackSchedulerEvent, l.resolveEventType, l.resolveEventTimeStamp;
      var wp = l.shouldAttemptEagerTransition, _p = l.detachDeletedInstance;
      l.requestPostPaintCallback;
      var kp = l.maySuspendCommit, Sp = l.maySuspendCommitOnUpdate, go = l.maySuspendCommitInSyncRender, Iu = l.preloadInstance, Ep = l.startSuspendingCommit, $u = l.suspendInstance;
      l.suspendOnActiveViewTransition;
      var zp = l.waitForCommitToBeReady;
      l.getSuspendedCommitReason;
      var xa = l.NotPendingTransition, In = l.HostTransitionContext, Np = l.resetFormInstance;
      l.bindToConsole;
      var Tp = l.supportsMicrotasks, Cp = l.scheduleMicrotask, al = l.supportsTestSelectors, Mp = l.findFiberRoot, Ap = l.getBoundingRect, jp = l.getTextContent, ll = l.isHiddenSubtree, Op = l.matchAccessibilityRole, Rp = l.setFocusIfFocusable, Dp = l.setupIntersectionObserver, Hp = l.appendChild, Bp = l.appendChildToContainer, Up = l.commitTextUpdate, qp = l.commitMount, Yp = l.commitUpdate, Gp = l.insertBefore, Lp = l.insertInContainerBefore, Qp = l.removeChild, Vp = l.removeChildFromContainer, Pu = l.resetTextContent, Kp = l.hideInstance, Xp = l.hideTextInstance, Zp = l.unhideInstance, Jp = l.unhideTextInstance;
      l.cancelViewTransitionName, l.cancelRootViewTransitionName, l.restoreRootViewTransitionName, l.cloneRootViewTransitionContainer, l.removeRootViewTransitionClone, l.measureClonedInstance, l.hasInstanceChanged, l.hasInstanceAffectedParent, l.startViewTransition, l.startGestureTransition, l.stopViewTransition, l.getCurrentGestureOffset, l.createViewTransitionInstance;
      var Wp = l.clearContainer;
      l.createFragmentInstance, l.updateFragmentInstanceFiber, l.commitNewChildToFragmentInstance, l.deleteChildFromFragmentInstance;
      var Fp = l.cloneInstance, td = l.createContainerChildSet, ed = l.appendChildToContainerChildSet, Ip = l.finalizeContainerChildren, nd = l.replaceContainerChildren, ad = l.cloneHiddenInstance, ld = l.cloneHiddenTextInstance, bo = l.isSuspenseInstancePending, vo = l.isSuspenseInstanceFallback, $p = l.getSuspenseInstanceFallbackErrorDetails, Pp = l.registerSuspenseInstanceRetry, th = l.canHydrateFormStateMarker, eh = l.isFormStateMarkerMatching, rd = l.getNextHydratableSibling, nh = l.getNextHydratableSiblingAfterSingleton, ah = l.getFirstHydratableChild, lh = l.getFirstHydratableChildWithinContainer, rh = l.getFirstHydratableChildWithinActivityInstance, ih = l.getFirstHydratableChildWithinSuspenseInstance, oh = l.getFirstHydratableChildWithinSingleton, sh = l.canHydrateInstance, ch = l.canHydrateTextInstance, uh = l.canHydrateActivityInstance, dh = l.canHydrateSuspenseInstance, fh = l.hydrateInstance, mh = l.hydrateTextInstance, ph = l.hydrateActivityInstance, hh = l.hydrateSuspenseInstance, gh = l.getNextHydratableInstanceAfterActivityInstance, bh = l.getNextHydratableInstanceAfterSuspenseInstance, vh = l.commitHydratedInstance, yh = l.commitHydratedContainer, xh = l.commitHydratedActivityInstance, wh = l.commitHydratedSuspenseInstance, _h = l.finalizeHydratedChildren, kh = l.flushHydrationEvents;
      l.clearActivityBoundary;
      var Sh = l.clearSuspenseBoundary;
      l.clearActivityBoundaryFromContainer;
      var Eh = l.clearSuspenseBoundaryFromContainer, zh = l.hideDehydratedBoundary, Nh = l.unhideDehydratedBoundary, id = l.shouldDeleteUnhydratedTailInstances;
      l.diffHydratedPropsForDevWarnings, l.diffHydratedTextForDevWarnings, l.describeHydratableInstanceForDevWarnings;
      var Th = l.validateHydratableInstance, Ch = l.validateHydratableTextInstance, Ye = l.supportsResources, od = l.isHostHoistableType, yo = l.getHoistableRoot, sd = l.getResource, cd = l.acquireResource, ud = l.releaseResource, Mh = l.hydrateHoistable, dd = l.mountHoistable, fd = l.unmountHoistable, Ah = l.createHoistableInstance, jh = l.prepareToCommitHoistables, Oh = l.mayResourceSuspendCommit, md = l.preloadResource, Rh = l.suspendResource, Xt = l.supportsSingletons, pd = l.resolveSingletonInstance, Dh = l.acquireSingletonInstance, hd = l.releaseSingletonInstance, gd = l.isHostSingletonType, wa = l.isSingletonScope, xo = [], _a = -1, ka = {}, we = Math.clz32 ? Math.clz32 : _, Hh = Math.log, Bh = Math.LN2, or = 256, sr = 262144, cr = 4194304, ur = xe.unstable_scheduleCallback, wo = xe.unstable_cancelCallback, Uh = xe.unstable_shouldYield, qh = xe.unstable_requestPaint, he = xe.unstable_now, bd = xe.unstable_ImmediatePriority, Yh = xe.unstable_UserBlockingPriority, _o = xe.unstable_NormalPriority, Gh = xe.unstable_IdlePriority, Lh = xe.log, Qh = xe.unstable_setDisableYieldValue, rl = null, _e = null, ke = typeof Object.is == "function" ? Object.is : Z, vd = typeof reportError == "function" ? reportError : function(t) {
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
      }, Vh = Object.prototype.hasOwnProperty, ko, yd, So = !1, xd = /* @__PURE__ */ new WeakMap(), Sa = [], Ea = 0, dr = null, il = 0, Ce = [], Me = 0, Sn = null, Xe = 1, Ze = "", ne = x(null), ol = x(null), En = x(null), fr = x(null), ae = null, Ot = null, St = !1, zn = null, Ae = !1, Eo = Error(s(519)), mr = x(null), $n = null, rn = null, Kh = typeof AbortController < "u" ? AbortController : function() {
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
      }, Xh = xe.unstable_scheduleCallback, Zh = xe.unstable_NormalPriority, Rt = {
        $$typeof: _n,
        Consumer: null,
        Provider: null,
        _currentValue: null,
        _currentValue2: null,
        _threadCount: 0
      }, pr = null, za = null, zo = !1, hr = !1, No = !1, Pn = 0, sl = null, To = 0, Na = 0, Ta = null, wd = dt.S;
      dt.S = function(t, e) {
        zd = he(), typeof e == "object" && e !== null && typeof e.then == "function" && Rm(t, e), wd !== null && wd(t, e);
      };
      var ta = x(null), Ca = Error(s(460)), Co = Error(s(474)), gr = Error(s(542)), br = { then: function() {
      } }, ea = null, Ma = null, cl = 0, na = Ks(!0), _d = Ks(!1), je = [], Aa = 0, Mo = 0, Nn = !1, Ao = !1, ja = x(null), vr = x(0), Se = x(null), Oe = null, Yt = x(0), on = 0, bt = null, Mt = null, Gt = null, yr = !1, Oa = !1, aa = !1, xr = 0, ul = 0, Ra = null, Jh = 0, dl = {
        readContext: te,
        use: Gl,
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
      var kd = {
        readContext: te,
        use: Gl,
        useCallback: function(t, e) {
          return fe().memoizedState = [
            t,
            e === void 0 ? null : e
          ], t;
        },
        useContext: te,
        useEffect: gc,
        useImperativeHandle: function(t, e, a) {
          a = a != null ? a.concat([t]) : null, Ql(
            4194308,
            4,
            xc.bind(null, e, t),
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
          var a = fe();
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
          var r = fe();
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
          }, r.queue = t, t = t.dispatch = Gm.bind(
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
          t = Ei(t);
          var e = t.queue, a = Cc.bind(
            null,
            bt,
            e
          );
          return e.dispatch = a, [t.memoizedState, a];
        },
        useDebugValue: Ti,
        useDeferredValue: function(t, e) {
          var a = fe();
          return Ci(a, t, e);
        },
        useTransition: function() {
          var t = Ei(!1);
          return t = Ec.bind(
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
            (_t & 127) !== 0 || tc(r, e, a);
          }
          c.memoizedState = a;
          var u = { value: a, getSnapshot: e };
          return c.queue = u, gc(nc.bind(null, r, u, t), [
            t
          ]), r.flags |= 2048, pa(
            9,
            { destroy: void 0 },
            ec.bind(
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
            a = (r & ~(1 << 32 - we(r) - 1)).toString(32) + a, e = "_" + e + "R_" + a, a = xr++, 0 < a && (e += "H" + a.toString(32)), e += "_";
          } else
            a = Jh++, e = "_" + e + "r_" + a.toString(32) + "_";
          return t.memoizedState = e;
        },
        useHostTransitionStatus: Mi,
        useFormState: dc,
        useActionState: dc,
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
          return e.queue = a, e = Ai.bind(
            null,
            bt,
            !0,
            a
          ), a.dispatch = e, [t, e];
        },
        useMemoCache: _i,
        useCacheRefresh: function() {
          return fe().memoizedState = Ym.bind(
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
      }, jo = {
        readContext: te,
        use: Gl,
        useCallback: _c,
        useContext: te,
        useEffect: Ni,
        useImperativeHandle: wc,
        useInsertionEffect: vc,
        useLayoutEffect: yc,
        useMemo: kc,
        useReducer: Ll,
        useRef: hc,
        useState: function() {
          return Ll($e);
        },
        useDebugValue: Ti,
        useDeferredValue: function(t, e) {
          var a = qt();
          return Sc(
            a,
            Mt.memoizedState,
            t,
            e
          );
        },
        useTransition: function() {
          var t = Ll($e)[0], e = qt().memoizedState;
          return [
            typeof t == "boolean" ? t : Za(t),
            e
          ];
        },
        useSyncExternalStore: Ps,
        useId: Nc,
        useHostTransitionStatus: Mi,
        useFormState: fc,
        useActionState: fc,
        useOptimistic: function(t, e) {
          var a = qt();
          return rc(a, Mt, t, e);
        },
        useMemoCache: _i,
        useCacheRefresh: Tc
      };
      jo.useEffectEvent = bc;
      var Sd = {
        readContext: te,
        use: Gl,
        useCallback: _c,
        useContext: te,
        useEffect: Ni,
        useImperativeHandle: wc,
        useInsertionEffect: vc,
        useLayoutEffect: yc,
        useMemo: kc,
        useReducer: Si,
        useRef: hc,
        useState: function() {
          return Si($e);
        },
        useDebugValue: Ti,
        useDeferredValue: function(t, e) {
          var a = qt();
          return Mt === null ? Ci(a, t, e) : Sc(
            a,
            Mt.memoizedState,
            t,
            e
          );
        },
        useTransition: function() {
          var t = Si($e)[0], e = qt().memoizedState;
          return [
            typeof t == "boolean" ? t : Za(t),
            e
          ];
        },
        useSyncExternalStore: Ps,
        useId: Nc,
        useHostTransitionStatus: Mi,
        useFormState: pc,
        useActionState: pc,
        useOptimistic: function(t, e) {
          var a = qt();
          return Mt !== null ? rc(a, Mt, t, e) : (a.baseState = t, [t, a.queue.dispatch]);
        },
        useMemoCache: _i,
        useCacheRefresh: Tc
      };
      Sd.useEffectEvent = bc;
      var Oo = {
        enqueueSetState: function(t, e, a) {
          t = t._reactInternals;
          var r = ye(), c = gn(r);
          c.payload = e, a != null && (c.callback = a), e = bn(t, c, r), e !== null && (pe(e, t, r), Va(e, t, r));
        },
        enqueueReplaceState: function(t, e, a) {
          t = t._reactInternals;
          var r = ye(), c = gn(r);
          c.tag = 1, c.payload = e, a != null && (c.callback = a), e = bn(t, c, r), e !== null && (pe(e, t, r), Va(e, t, r));
        },
        enqueueForceUpdate: function(t, e) {
          t = t._reactInternals;
          var a = ye(), r = gn(a);
          r.tag = 2, e != null && (r.callback = e), e = bn(t, r, a), e !== null && (pe(e, t, a), Va(e, t, a));
        }
      }, Ro = Error(s(461)), Lt = !1, Do = {
        dehydrated: null,
        treeContext: null,
        retryLane: 0,
        hydrationErrors: null
      }, sn = !1, Qt = !1, Ho = !1, Ed = typeof WeakSet == "function" ? WeakSet : Set, It = null, Vt = null, ge = !1, Ge = null, Da = 8192, Wh = {
        getCacheForType: function(t) {
          var e = te(Rt), a = e.data.get(t);
          return a === void 0 && (a = t(), e.data.set(t, a)), a;
        },
        cacheSignal: function() {
          return te(Rt).controller.signal;
        }
      }, wr = 0, _r = 1, kr = 2, Sr = 3, Er = 4;
      if (typeof Symbol == "function" && Symbol.for) {
        var fl = Symbol.for;
        wr = fl("selector.component"), _r = fl("selector.has_pseudo_class"), kr = fl("selector.role"), Sr = fl("selector.test_id"), Er = fl("selector.text");
      }
      var Fh = typeof WeakMap == "function" ? WeakMap : Map, xt = 0, At = null, wt = null, _t = 0, Ct = 0, Ee = null, Tn = !1, Ha = !1, Bo = !1, cn = 0, Bt = 0, Cn = 0, la = 0, Uo = 0, ze = 0, Ba = 0, ml = null, be = null, qo = !1, zr = 0, zd = 0, pl = 1 / 0, Nr = null, Mn = null, Zt = 0, An = null, Ua = null, un = 0, Yo = 0, Go = null, Nd = null, hl = 0, Lo = null;
      return yt.attemptContinuousHydration = function(t) {
        if (t.tag === 13 || t.tag === 31) {
          var e = Kn(t, 67108864);
          e !== null && pe(e, t, 67108864), io(t, 67108864);
        }
      }, yt.attemptHydrationAtCurrentPriority = function(t) {
        if (t.tag === 13 || t.tag === 31) {
          var e = ye();
          e = j(e);
          var a = Kn(t, e);
          a !== null && pe(a, t, e), io(t, e);
        }
      }, yt.attemptSynchronousHydration = function(t) {
        switch (t.tag) {
          case 3:
            if (t = t.stateNode, t.current.memoizedState.isDehydrated) {
              var e = k(t.pendingLanes);
              if (e !== 0) {
                for (t.pendingLanes |= 2, t.entangledLanes |= 2; e; ) {
                  var a = 1 << 31 - we(e);
                  t.entanglements[1] |= a, e &= ~a;
                }
                Qe(t), (xt & 6) === 0 && (pl = he() + 500, ma(0));
              }
            }
            break;
          case 31:
          case 13:
            e = Kn(t, 2), e !== null && pe(e, t, 2), _u(), io(t, 2);
        }
      }, yt.batchedUpdates = function(t, e) {
        return t(e);
      }, yt.createComponentSelector = function(t) {
        return { $$typeof: wr, value: t };
      }, yt.createContainer = function(t, e, a, r, c, u, g, C, G, W) {
        return Yu(
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
        return { $$typeof: _r, value: t };
      }, yt.createHydrationContainer = function(t, e, a, r, c, u, g, C, G, W, nt, $, lt, gt) {
        return t = Yu(
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
          nt,
          $
        ), t.context = Gu(null), a = t.current, r = ye(), r = j(r), c = gn(r), c.callback = e ?? null, bn(a, c, r), e = r, t.current.lanes = e, H(t, e), Qe(t), t;
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
        return { $$typeof: kr, value: t };
      }, yt.createTestNameSelector = function(t) {
        return { $$typeof: Sr, value: t };
      }, yt.createTextSelector = function(t) {
        return { $$typeof: Er, value: t };
      }, yt.defaultOnCaughtError = function(t) {
        console.error(t);
      }, yt.defaultOnRecoverableError = function(t) {
        vd(t);
      }, yt.defaultOnUncaughtError = function(t) {
        vd(t);
      }, yt.deferredUpdates = function(t) {
        var e = dt.T, a = ln();
        try {
          return Ft(32), dt.T = null, t();
        } finally {
          Ft(a), dt.T = e;
        }
      }, yt.discreteUpdates = function(t, e, a, r, c) {
        var u = dt.T, g = ln();
        try {
          return Ft(2), dt.T = null, t(e, a, r, c);
        } finally {
          Ft(g), dt.T = u, xt === 0 && (pl = he() + 500);
        }
      }, yt.findAllNodes = Pi, yt.findBoundingRects = function(t, e) {
        if (!al) throw Error(s(363));
        e = Pi(t, e), t = [];
        for (var a = 0; a < e.length; a++)
          t.push(Ap(e[a]));
        for (e = t.length - 1; 0 < e; e--) {
          a = t[e];
          for (var r = a.x, c = r + a.width, u = a.y, g = u + a.height, C = e - 1; 0 <= C; C--)
            if (e !== C) {
              var G = t[C], W = G.x, nt = W + G.width, $ = G.y, lt = $ + G.height;
              if (r >= W && u >= $ && c <= nt && g <= lt) {
                t.splice(e, 1);
                break;
              } else if (r !== W || a.width !== G.width || lt < u || $ > g) {
                if (!(u !== $ || a.height !== G.height || nt < r || W > c)) {
                  W > r && (G.width += W - r, G.x = r), nt < c && (G.width = c - W), t.splice(e, 1);
                  break;
                }
              } else {
                $ > u && (G.height += $ - u, G.y = u), lt < g && (G.height = g - $), t.splice(e, 1);
                break;
              }
            }
        }
        return t;
      }, yt.findHostInstance = Lu, yt.findHostInstanceWithNoPortals = function(t) {
        return t = f(t), t = t !== null ? v(t) : null, t === null ? null : nl(t.stateNode);
      }, yt.findHostInstanceWithWarning = function(t) {
        return Lu(t);
      }, yt.flushPassiveEffects = el, yt.flushSyncFromReconciler = function(t) {
        var e = xt;
        xt |= 1;
        var a = dt.T, r = ln();
        try {
          if (Ft(2), dt.T = null, t)
            return t();
        } finally {
          Ft(r), dt.T = a, xt = e, (xt & 6) === 0 && ma(0);
        }
      }, yt.flushSyncWork = _u, yt.focusWithin = function(t, e) {
        if (!al) throw Error(s(363));
        for (t = Fi(t), e = vu(t, e), e = Array.from(e), t = 0; t < e.length; ) {
          var a = e[t++], r = a.tag;
          if (!ll(a)) {
            if ((r === 5 || r === 26 || r === 27) && Rp(a.stateNode))
              return !0;
            for (a = a.child; a !== null; )
              e.push(a), a = a.sibling;
          }
        }
        return !1;
      }, yt.getFindAllNodesFailureDescription = function(t, e) {
        if (!al) throw Error(s(363));
        var a = 0, r = [];
        t = [Fi(t), 0];
        for (var c = 0; c < t.length; ) {
          var u = t[c++], g = u.tag, C = t[c++], G = e[C];
          if ((g !== 5 && g !== 26 && g !== 27 || !ll(u)) && (Ii(u, G) && (r.push($i(G)), C++, C > a && (a = C)), C < e.length))
            for (u = u.child; u !== null; )
              t.push(u, C), u = u.sibling;
        }
        if (a < e.length) {
          for (t = []; a < e.length; a++)
            t.push($i(e[a]));
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
          version: cp,
          rendererPackageName: up,
          currentDispatcherRef: dt,
          reconcilerVersion: "19.2.0"
        };
        if (Ju !== null && (t.rendererConfig = Ju), typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ > "u") t = !1;
        else {
          var e = __REACT_DEVTOOLS_GLOBAL_HOOK__;
          if (e.isDisabled || !e.supportsFiber) t = !0;
          else {
            try {
              rl = e.inject(t), _e = e;
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
        t = Pi(t, e);
        var c = Dp(
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
        var c = zc(t).queue;
        Ec(
          t,
          c,
          e,
          xa,
          a === null ? i : function() {
            var u = zc(t);
            return u.next === null && (u = t.alternate.memoizedState), Ja(
              t,
              u.next.queue,
              {},
              ye()
            ), a(r);
          }
        );
      }, yt.updateContainer = function(t, e, a, r) {
        var c = e.current, u = ye();
        return Qu(
          c,
          u,
          t,
          e,
          a,
          r
        ), u;
      }, yt.updateContainerSync = function(t, e, a, r) {
        return Qu(
          e.current,
          2,
          t,
          e,
          a,
          r
        ), 2;
      }, yt;
    }, n.exports.default = n.exports, Object.defineProperty(n.exports, "__esModule", { value: !0 });
  })(Xo)), Xo.exports;
}
var Yd;
function T0() {
  return Yd || (Yd = 1, Ko.exports = N0()), Ko.exports;
}
var C0 = T0();
const M0 = /* @__PURE__ */ _s(C0);
var Wo = { exports: {} }, dn = {};
/**
 * @license React
 * react-reconciler-constants.production.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var Gd;
function A0() {
  return Gd || (Gd = 1, dn.ConcurrentRoot = 1, dn.ContinuousEventPriority = 8, dn.DefaultEventPriority = 32, dn.DiscreteEventPriority = 2, dn.IdleEventPriority = 268435456, dn.LegacyRoot = 0, dn.NoEventPriority = 0), dn;
}
var Ld;
function j0() {
  return Ld || (Ld = 1, Wo.exports = A0()), Wo.exports;
}
var El = j0();
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
const Df = ["accent", "panel-bg", "surface-0", "surface-1", "surface-dim", "overlay-0", "overlay-1", "text", "subtext-0", "mauve", "green", "yellow", "red", "blue", "teal", "peach", "backdrop", "card-bg"], ls = 16, Hf = /* @__PURE__ */ new Set(["hover", "focus", "focus-visible", "focus-within", "active"]), O0 = [
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
], Qd = {
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
}, R0 = /* @__PURE__ */ new Set([
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
]), Bf = {
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
}, Uf = {
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
}, rs = ["font-size", "color", ...new Set([...Object.keys(Bf), ...Object.keys(Uf)].filter((n) => n !== "font-size" && n !== "color"))], D0 = new Set(rs);
function ie(n, l = " ") {
  const o = [];
  let i = 0, s = "";
  for (let d = 0; d < n.length; d++) {
    const m = n[d];
    if (m === "(" ? i++ : m === ")" && i--, i === 0 && (l === " " ? /\s/.test(m) : m === l)) {
      (s.trim() || l !== " ") && o.push(s.trim()), s = "";
      continue;
    }
    s += m;
  }
  return (s.trim() || l !== " " && o.length) && o.push(s.trim()), o;
}
function is(n, l, o = 0) {
  if (o > 32) return null;
  let i = "", s = 0;
  for (; ; ) {
    const d = n.indexOf("var(", s);
    if (d < 0)
      return i += n.slice(s), i;
    i += n.slice(s, d);
    let m = 1, f = d + 4;
    for (; f < n.length && m; f++)
      n[f] === "(" ? m++ : n[f] === ")" && m--;
    const p = n.slice(d + 4, f - 1), v = ie(p, ","), S = v[0].trim(), w = v.length > 1 ? p.slice(p.indexOf(",") + 1).trim() : null;
    let x = l(S);
    if ((x == null || x === "initial") && (x = w), x == null) return null;
    const z = is(x, l, o + 1);
    if (z === null) return null;
    i += z, s = f;
  }
}
function H0(n) {
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
function qn(n, l) {
  const o = H0(n.trim().replace(/env\(\s*safe-area-inset-(?:top|right|bottom|left)\s*(?:,[^()]*)?\)/gi, "0px"));
  if (!o) return null;
  let i = 0;
  const s = ({ num: x, unit: z }) => {
    switch (z) {
      case "":
        return { px: 0, pct: 0, num: x, unitless: !0 };
      case "px":
        return { px: x, pct: 0, num: 0 };
      case "rem":
        return { px: x * ls, pct: 0, num: 0 };
      case "em":
        return { px: x * (l.fontSize ?? ls), pct: 0, num: 0 };
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
  }, d = (x, z, E) => x && z ? { px: x.px + E * z.px, pct: x.pct + E * z.pct, num: x.num + E * z.num, unitless: x.unitless && z.unitless } : null, m = (x, z) => x ? { px: x.px * z, pct: x.pct * z, num: x.num * z, unitless: x.unitless } : null, f = (x) => x && x.unitless;
  function p() {
    const x = o[i++];
    if (!x) return null;
    if (x.num !== void 0) return s(x);
    if (x.op === "(") {
      const z = S();
      return o[i]?.op !== ")" ? null : (i++, z);
    }
    if (x.op === "-" || x.op === "+") {
      const z = p();
      return x.op === "-" ? m(z, -1) : z;
    }
    if (x.fn) {
      const z = [];
      for (; ; ) {
        z.push(S());
        const k = o[i++];
        if (!k) return null;
        if (k.op === ")") break;
        if (k.op !== ",") return null;
      }
      if (z.some((k) => !k)) return null;
      if (x.fn === "calc") return z[0];
      if (!(z.every((k) => !k.pct) || z.every((k) => !k.px && !k.num))) return null;
      const _ = (k) => k.px + k.pct + k.num;
      return x.fn === "min" ? z.reduce((k, N) => _(N) < _(k) ? N : k) : x.fn === "max" ? z.reduce((k, N) => _(N) > _(k) ? N : k) : x.fn === "clamp" && z.length === 3 ? _(z[1]) < _(z[0]) ? z[0] : _(z[1]) > _(z[2]) ? z[2] : z[1] : null;
    }
    return null;
  }
  function v() {
    let x = p();
    for (; o[i] && (o[i].op === "*" || o[i].op === "/"); ) {
      const z = o[i++].op, E = p();
      if (!x || !E) return null;
      z === "*" ? x = f(E) ? m(x, E.num) : f(x) ? m(E, x.num) : null : x = f(E) && E.num !== 0 ? m(x, 1 / E.num) : null;
    }
    return x;
  }
  function S() {
    let x = v();
    for (; o[i] && (o[i].op === "+" || o[i].op === "-"); ) {
      const z = o[i++].op;
      x = d(x, v(), z === "-" ? -1 : 1);
    }
    return x;
  }
  const w = S();
  return i !== o.length || !w ? null : w;
}
function os(n, l) {
  const o = n.trim().toLowerCase();
  if (/^(auto|none|normal|fit-content|max-content|min-content|medium|thin|thick)$/.test(o))
    return o === "thin" ? { px: 1 } : o === "medium" ? { px: 3 } : o === "thick" ? { px: 5 } : o;
  const i = qn(o, l);
  return i ? i.unitless ? i.num === 0 ? { px: 0 } : { expr: n.trim() } : i.pct && (i.px || i.num) ? { expr: n.trim() } : i.pct ? { pct: i.pct } : { px: B0(i.px) } : { expr: n.trim() };
}
const B0 = (n) => Number.isFinite(n) ? n : n > 0 ? 34e37 : -34e37, Cr = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0"), U0 = ([n, l, o, i]) => `#${Cr(n)}${Cr(l)}${Cr(o)}${Cr(i * 255)}`;
function Vd(n) {
  const l = n.slice(1), o = l.length <= 4 ? l.split("").map((s) => s + s).join("") : l;
  if (!/^[0-9a-f]{6}([0-9a-f]{2})?$/i.test(o)) return null;
  const i = (s) => parseInt(o.slice(s, s + 2), 16);
  return [i(0), i(2), i(4), o.length === 8 ? i(6) / 255 : 1];
}
function Kr(n, l) {
  const o = n.trim().toLowerCase();
  if (o === "currentcolor") return "currentcolor";
  const i = /^perchtoken\(([a-z0-9-]+)\)$/.exec(o);
  if (i) {
    const v = l(i[1]), S = v && Vd(v);
    return S ? { rgba: S, token: i[1] } : null;
  }
  if (o.startsWith("#")) {
    const v = Vd(o);
    return v ? { rgba: v, token: null } : null;
  }
  if (Qd[o]) return { rgba: [...Qd[o]], token: null };
  const s = /^(rgba?|color-mix)\((.*)\)$/s.exec(o);
  if (!s) return null;
  if (s[1] === "color-mix") {
    const v = ie(s[2], ",");
    if (v.length !== 3 || !/^in\s+(srgb|srgb-linear|oklab|lab|oklch|lch|hsl|xyz)/.test(v[0])) return null;
    const S = (U) => {
      const Z = ie(U), F = Z.findIndex((I) => /%$/.test(I)), Q = F >= 0 ? parseFloat(Z[F]) / 100 : null;
      return { color: Kr(Z.filter((I, L) => L !== F).join(" "), l), pct: Q };
    }, w = S(v[1]), x = S(v[2]);
    if (!w.color || !x.color || w.color === "currentcolor" || x.color === "currentcolor") return null;
    let z = w.pct, E = x.pct;
    z === null && E === null ? (z = 0.5, E = 0.5) : z === null ? z = 1 - E : E === null && (E = 1 - z);
    const _ = z + E, k = _ < 1 ? _ : 1;
    z /= _, E /= _;
    const [N, D, O, X] = w.color.rgba, [q, H, h, b] = x.color.rgba, y = X * z + b * E, A = (U, Z) => y === 0 ? 0 : (U * X * z + Z * b * E) / y, j = [A(N, q), A(D, H), A(O, h), y * k], M = b === 0 ? w.color.token : X === 0 ? x.color.token : null;
    return { rgba: j, token: M };
  }
  const d = s[2].includes(",") ? ie(s[2], ",") : ie(s[2].replace("/", " / ")).filter((v) => v !== "/");
  if (d.length < 3) return null;
  const m = (v) => v.endsWith("%") ? parseFloat(v) / 100 * 255 : parseFloat(v), f = d[3] === void 0 ? 1 : d[3].endsWith("%") ? parseFloat(d[3]) / 100 : parseFloat(d[3]), p = [m(d[0]), m(d[1]), m(d[2]), f];
  return p.some((v) => Number.isNaN(v)) ? null : { rgba: p, token: null };
}
const xl = ["top", "right", "bottom", "left"], q0 = ["top-left", "top-right", "bottom-right", "bottom-left"], Mr = (n) => [n[0], n[1] ?? n[0], n[2] ?? n[0], n[3] ?? n[1] ?? n[0]], Kd = /* @__PURE__ */ new Set(["none", "hidden", "solid", "dashed", "dotted", "double", "groove", "ridge", "inset", "outset"]);
function ss(n, l) {
  const o = l.trim(), i = () => ie(o);
  switch (n) {
    case "padding":
    case "margin": {
      const s = Mr(i());
      return xl.map((d, m) => [`${n}-${d}`, s[m]]);
    }
    case "padding-inline":
    case "margin-inline": {
      const s = i(), d = n.split("-")[0];
      return [[`${d}-left`, s[0]], [`${d}-right`, s[1] ?? s[0]]];
    }
    case "padding-block":
    case "margin-block": {
      const s = i(), d = n.split("-")[0];
      return [[`${d}-top`, s[0]], [`${d}-bottom`, s[1] ?? s[0]]];
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
      const s = Mr(i());
      return xl.map((d, m) => [d, s[m]]);
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
      const s = n.split("-")[1], d = Mr(i());
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
      if (o !== "none" && o !== "0")
        for (const p of i())
          Kd.has(p) ? m = p : /^(thin|medium|thick|-?[\d.]|calc\()/.test(p) ? d = p : f = p;
      else o === "0" && (d = "0");
      return s.flatMap((p) => [[`border-${p}-width`, d], [`border-${p}-style`, m], [`border-${p}-color`, f]]);
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
      const s = Mr(ie(o.split("/")[0]));
      return q0.map((d, m) => [`border-${d}-radius`, s[m]]);
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
      return o === "none" ? [["background-color", "transparent"], ["background-image", "none"]] : Kr(o, () => "#000000") ? [["background-color", o], ["background-image", "none"]] : [["background-color", "transparent"], ["background-image", o]];
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
      return ss("gap", o);
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
      const s = i(), d = s.filter((f) => /^[\d.]+$/.test(f)), m = s.find((f) => !/^[\d.]+$/.test(f));
      return [["flex-grow", d[0] ?? "1"], ["flex-shrink", d[1] ?? "1"], ["flex-basis", m ?? (d.length ? "0%" : "auto")]];
    }
    case "flex-flow": {
      const s = [];
      for (const d of i()) s.push(/wrap/.test(d) ? ["flex-wrap", d] : ["flex-direction", d]);
      return s;
    }
    case "outline": {
      if (o === "none" || o === "0") return [["outline-style", "none"], ["outline-width", "medium"], ["outline-color", "currentcolor"]];
      let s = "medium", d = "none", m = "currentcolor";
      for (const f of i())
        Kd.has(f) || f === "auto" ? d = f : /^(thin|medium|thick|-?[\d.]|calc\()/.test(f) ? s = f : m = f;
      return [["outline-width", s], ["outline-style", d], ["outline-color", m]];
    }
    case "transition": {
      if (o === "none") return [["transition-property", "none"], ["transition-duration", "0s"]];
      const s = ie(o, ","), d = s.map((f) => ie(f).find((p) => !/^[\d.]+m?s$/.test(p) && !/^(ease|linear|step|cubic)/.test(p)) ?? "all"), m = s.map((f) => ie(f).find((p) => /^[\d.]+m?s$/.test(p)) ?? "0s");
      return [["transition-property", d.join(", ")], ["transition-duration", m.join(", ")]];
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
function Y0(n, l) {
  return n ? ie(n, ",").some((o) => {
    let i = o.trim().toLowerCase(), s = !1;
    i.startsWith("not ") && (s = !0, i = i.slice(4)), i.startsWith("only ") && (i = i.slice(5));
    const d = i.split(/\s+and\s+/).every((m) => {
      if (m = m.trim(), m === "all" || m === "screen") return !0;
      if (m === "print") return !1;
      const f = /^\((.+)\)$/.exec(m);
      if (!f) return !1;
      const p = f[1].trim(), v = /^([a-z-]+)\s*:\s*(.+)$/.exec(p);
      if (v) {
        const [, w, x] = v, z = (E) => {
          const _ = os(E, { viewport: l });
          return typeof _ == "object" && "px" in _ ? _.px : NaN;
        };
        switch (w) {
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
      const S = /^(width|height)\s*(>=|<=|>|<|=)\s*(.+)$/.exec(p);
      if (S) {
        const w = S[1] === "width" ? l.width : l.height, x = os(S[3], { viewport: l }), z = typeof x == "object" && "px" in x ? x.px : NaN;
        switch (S[2]) {
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
function G0(n, l) {
  const o = l[l.length - 1].compound;
  return ks(o)[0] ?? n;
}
function L0(n) {
  const l = /* @__PURE__ */ new Set(), o = /* @__PURE__ */ new Set(), i = (s, d) => {
    s.forEach(({ compound: m }, f) => {
      const p = d && f === s.length - 1;
      for (const v of m.pseudos)
        if (Hf.has(v.name) && (p ? l : o).add(v.name), v.list && v.name !== "not") for (const S of v.list) i(S, p);
    });
  };
  return i(n, !0), { subject: l, ancestor: o };
}
function ks(n) {
  const l = [...n.classes];
  for (const o of n.pseudos)
    if (!(o.name !== "is" && o.name !== "where"))
      for (const i of o.list) i.length === 1 && l.push(...ks(i[0].compound));
  return l;
}
function Q0(n, l) {
  const o = (i, s) => {
    i.forEach(({ compound: d }, m) => {
      const f = s && m === i.length - 1, p = d.pseudos.filter((v) => Hf.has(v.name)).map((v) => v.name);
      if (!f) for (const v of p) for (const S of ks(d)) l.add(`${v}:${S}`);
      for (const v of d.pseudos) if (v.list && v.name !== "not") for (const S of v.list) o(S, f);
    });
  };
  o(n, !0);
}
class V0 {
  constructor(l) {
    this.properties = l.properties ?? {}, this.rules = [], this.skipped = 0, this.index = /* @__PURE__ */ new Map(), this.trackedStates = /* @__PURE__ */ new Set();
    const o = (d, m) => {
      const f = m[m.length - 1].compound, p = f.classes.length ? `.${f.classes[0]}` : f.tag && f.tag !== "*" ? f.tag : "*";
      this.index.has(p) || this.index.set(p, []), this.index.get(p).push(d);
    };
    let i = 0;
    const s = (d, m) => {
      for (const [f, p, v, S] of d)
        for (const w of ys(f)) {
          let x;
          try {
            x = xs(w);
          } catch (k) {
            if (k instanceof re) {
              this.skipped++;
              continue;
            }
            throw k;
          }
          const z = L0(x);
          Q0(x, this.trackedStates);
          const E = x[x.length - 1].compound.pseudoElement, _ = { steps: x, media: p, layer: v, origin: m, order: i++, specificity: Sf(x), decls: S, states: z, pseudo: E, source: m === 0 ? `ua:${x[x.length - 1].compound.tag ?? "*"}` : G0(w, x) };
          this.rules.push(_), o(_, x);
        }
    };
    s(O0.map(([d, m]) => [d, null, 0, Object.entries(m)]), 0), s(l.rules, 1);
  }
  /** Rules that may match `element` (by its classes, its tag, and the universal ones), or its `pseudo` box
   * (`before`, `after`). */
  candidates(l, o = null) {
    const i = [], s = /* @__PURE__ */ new Set(), d = (m) => {
      if (m) for (const f of m) !s.has(f) && f.pseudo === o && (s.add(f), i.push(f));
    };
    for (const m of l.classList) d(this.index.get(`.${m}`));
    return d(this.index.get(l.tagName)), d(this.index.get("*")), i;
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
const K0 = /* @__PURE__ */ new Set(["opacity", "z-index", "flex-grow", "flex-shrink", "font-weight", "line-height", "flex", "order", "-webkit-line-clamp", "zoom"]);
function X0(n) {
  if (!n || typeof n != "object") return [];
  const l = [];
  for (const [o, i] of Object.entries(n)) {
    if (i == null || i === "" || typeof i == "boolean") continue;
    const s = o.startsWith("--") ? o : o.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`).replace(/^(webkit|moz|ms)-/, "-$1-"), d = typeof i == "number" && i !== 0 && !K0.has(s) && !s.startsWith("--") ? `${i}px` : String(i);
    l.push([s, d]);
  }
  return l;
}
function Z0(n) {
  if (n.tagName !== "svg") return [];
  const l = [];
  for (const o of ["width", "height"]) {
    const i = n.getAttribute(o);
    i !== null && l.push([o, /^[\d.]+$/.test(i) ? `${i}px` : i]);
  }
  return l;
}
const J0 = (n, l) => n.important - l.important || n.origin - l.origin || n.layer - l.layer || n.specificity[0] - l.specificity[0] || n.specificity[1] - l.specificity[1] || n.specificity[2] - l.specificity[2] || n.order - l.order;
class W0 {
  constructor(l, { theme: o, viewport: i }) {
    this.sheet = l, this.theme = o, this.viewport = i, this.parsed = /* @__PURE__ */ new Map(), this.computed = /* @__PURE__ */ new WeakMap(), this.rootComputed = /* @__PURE__ */ new Map();
  }
  themeHex(l) {
    return this.theme?.[l] ?? null;
  }
  /** Rules matching `element`; `assume` is the set of interaction states assumed on the element itself
   * (`"*"`: any, for finding variant rules). Ancestors use their real state. */
  matching(l, o, i = null) {
    const s = (d, m, f) => {
      if (m === "disabled") return !!d.props?.disabled && ["button", "input", "select", "textarea", "fieldset"].includes(d.tagName);
      if (m === "enabled") return !d.props?.disabled && ["button", "input", "select", "textarea"].includes(d.tagName);
      if (m === "checked") return !!d.props?.checked;
      if (o === "*") return !0;
      if (m === "focus-within") {
        const p = d.ownerDocument?.activeElement;
        return !!p && p !== d.ownerDocument.body && typeof d.contains == "function" && d.contains(p);
      }
      return f ? o.has(m) : m === "focus-visible" ? !!d.state?.focus && !d.state?.pointerFocus : !!d.state?.[m];
    };
    return this.sheet.candidates(l, i).filter((d) => (!d.media || d.media.every((m) => Y0(m, this.viewport))) && Nf(l, d.steps, { state: s, pseudo: i }));
  }
  /** `element`'s computed style, or with `pseudo` (`before`, `after`) that of its pseudo-element's box, whose parent
   * is the element (pass the element's own computed style as `parent`). */
  compute(l, o, i = /* @__PURE__ */ new Set(), s = null) {
    const d = this.matching(l, i, s), m = s ? [] : Z0(l), f = s ? [] : X0(l.inlineStyle ?? l.props?.style);
    let p = this.rootComputed;
    o && (p = this.computed.get(o.values), p || this.computed.set(o.values, p = /* @__PURE__ */ new Map()));
    const v = `${d.map((w) => w.order).join(",")}|${m.length ? JSON.stringify(m) : ""}|${f.length ? JSON.stringify(f) : ""}`;
    let S = p.get(v);
    return S || p.set(v, S = this.cascade(d, m, f, o)), { ...S, rules: d, element: l };
  }
  /** The computed style from the matched `rules`, presentational `attrs`, `inline` declarations and the parent's. */
  cascade(l, o, i, s) {
    const d = [];
    for (const h of l)
      for (const [b, y, A] of h.decls) d.push({ prop: b, value: y, important: A ? 1 : 0, origin: h.origin === 0 ? 0 : 2, layer: h.layer, specificity: h.specificity, order: h.order, source: h.source });
    for (const [h, b] of o) d.push({ prop: h, value: b, important: 0, origin: 1, layer: 0, specificity: [0, 0, 0], order: 0, source: `attr:${h}` });
    for (const [h, b] of i) d.push({ prop: h, value: b, important: 0, origin: 3, layer: 0, specificity: [1, 0, 0], order: 0, source: "style" });
    d.sort(J0);
    const m = this.sheet.properties, f = Object.create(s?.customs ?? null), p = /* @__PURE__ */ new Map(), v = /* @__PURE__ */ new Map();
    for (const h of d) h.prop.startsWith("--") && v.set(h.prop, h.value);
    if (!s && this.theme) for (const h of Df) this.theme[h] && v.set(`--${h}`, `perchtoken(${h})`);
    const S = (h) => {
      if (p.has(h)) return p.get(h);
      const b = m[h];
      return b && !b.inherits ? b.initial ?? null : h in f ? f[h] : b?.initial ?? null;
    }, w = /* @__PURE__ */ new Set(), x = (h) => {
      if (!v.has(h)) return S(h);
      if (w.has(h)) return null;
      w.add(h);
      const b = is(v.get(h), x);
      return w.delete(h), v.delete(h), p.set(h, b), (!m[h] || m[h].inherits) && (f[h] = b), b;
    };
    for (const h of [...v.keys()]) x(h);
    const z = /* @__PURE__ */ new Map();
    for (const h of d) {
      if (h.prop.startsWith("--")) continue;
      const b = is(h.value, S);
      if (b === null) {
        for (const [y] of ss(h.prop, "unset")) z.set(y, { value: "unset", source: h.source, origin: h.origin });
        continue;
      }
      for (const [y, A] of ss(h.prop, b)) z.set(y, { value: A, source: h.source, origin: h.origin });
    }
    const E = {}, _ = {}, k = /* @__PURE__ */ new Set(), N = /* @__PURE__ */ new Set(), D = s?.values, O = { fontSize: D?.["font-size"] ?? ls, viewport: this.viewport }, X = (h, b) => {
      if (/currentcolor/i.test(b)) return this.parseValue(h, b, O, E, D);
      const y = `${h}\0${b}\0${O.fontSize}`;
      let A = this.parsed.get(y);
      return A === void 0 && this.parsed.set(y, A = this.parseValue(h, b, O, E, D)), A;
    }, q = z.size ? [...rs, ...[...z.keys()].filter((h) => !D0.has(h))] : rs;
    for (const h of q) {
      const b = z.get(h);
      let y = b?.value;
      const A = R0.has(h);
      if ((y === void 0 || y === "unset" || y === "revert" || y === "revert-layer") && (y = A ? "inherit" : "initial"), b && (_[h] = b.source, b.origin !== 0 && k.add(h)), y === "inherit" && D && h in D) {
        E[h] = D[h], N.add(h);
        continue;
      }
      (y === "inherit" || y === "initial") && (y = A ? Uf[h] : Bf[h]), E[h] = X(h, y), h === "font-size" && (O.fontSize = E["font-size"]);
    }
    for (const h of xl) {
      const b = E[`border-${h}-style`];
      (b === "none" || b === "hidden") && (E[`border-${h}-width`] = { px: 0 });
    }
    E["outline-style"] === "none" && (E["outline-width"] = { px: 0 });
    const H = D?.display;
    return (H === "flex" || H === "inline-flex" || H === "grid" || H === "inline-grid") && E.position !== "absolute" && E.position !== "fixed" && (E.display = Xd(E.display)), (E.position === "absolute" || E.position === "fixed") && (E.display = Xd(E.display)), { values: E, sources: _, own: k, inherited: N, customs: f };
  }
  parseValue(l, o, i, s, d) {
    const m = String(o).trim();
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
        return os(m, i);
      default:
        return m.toLowerCase().startsWith("var(") ? m : /^[a-z-]+$/i.test(m) ? m.toLowerCase() : m;
    }
  }
}
function Xd(n) {
  return n === "inline" || n === "inline-block" || n === "contents" ? "block" : n === "inline-flex" ? "flex" : n === "inline-grid" ? "grid" : n;
}
const Xr = (n) => n && n.rgba ? { value: U0(n.rgba), token: n.token ?? null } : null, F0 = { 9.28: 11, 9.92: 12, 10.4: 12, 10.88: 13, 11: 13, 11.2: 13, 11.52: 13, 12: 15, 12.5: 15, 13: 16, 14: 17, 16: 19 };
function I0(n, l) {
  const o = l?.(n);
  if (Number.isFinite(o)) return o;
  const i = Math.round(n * 100) / 100;
  return F0[i] ?? Math.round(n * 1.2);
}
function _l(n, l) {
  const o = n["line-height"], i = n["font-size"];
  return o.normal ? I0(i, l) : o.factor !== void 0 ? o.factor * i : o.px;
}
const $0 = (n) => ie(n, ",").map((l) => l.trim().replace(/^["']|["']$/g, "")).join(", ");
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
const P0 = "perch-native-description/1", Un = Symbol("display"), Zr = {
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
for (const n of tg) Zr[n] = /^(w|h|min_|max_|top|right|bottom|left)/.test(n) ? "auto" : 0;
Zr.rounded = 0;
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
  input: ["onChange", "onInput"],
  scroll: ["onScroll"]
}, Zd = { pointerdown: "mouse_down", mousedown: "mouse_down", click: "click", keydown: "key_down", pointerup: "mouse_up", mouseup: "mouse_up" }, Ss = (n) => {
  const l = n.props["data-testid"];
  if (l) return `${n.tagName}[data-testid="${l}"]`;
  if (n.props.id) return `${n.tagName}#${n.props.id}`;
  const o = n.classList.find((s) => !s.includes(":") && !s.includes("[")) ?? n.classList[0];
  if (o) return `${n.tagName}.${o}`;
  const i = n.parentElement;
  return i && i.tagName !== "body" ? `${Ss(i)} > ${n.tagName}` : n.tagName;
};
class ig {
  constructor() {
    this.map = /* @__PURE__ */ new Map();
  }
  add(l, o, i, s, d, m = "") {
    const f = `${l}|${o}|${i}|${s}`, p = this.map.get(f);
    if (p) {
      !p.elements.includes(d) && p.elements.length < 4 && p.elements.push(d), p.count++;
      return;
    }
    this.map.set(f, { kind: l, property: o, value: String(i), class: s ?? null, elements: [d], count: 1, ...m ? { note: m } : {} });
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
}, og = /^(text|search|url|email|tel|password|number)$/, sg = 162.13 / 12.8;
function cg(n, l) {
  const o = typeof n == "object" && /^min\((.*)\)$/.exec(String(n?.expr ?? "").trim());
  if (!o) return;
  const i = ie(o[1], ",").map((s) => qn(s.trim(), { fontSize: l })).filter((s) => s && !s.pct && !s.num).map((s) => s.px);
  return i.length ? Math.min(...i) : void 0;
}
function ug(n, l) {
  if (typeof n != "object" || !n?.expr) return !1;
  const o = qn(n.expr, { fontSize: l["font-size"] }), i = (l["margin-left"]?.px ?? NaN) + (l["margin-right"]?.px ?? NaN);
  return !!o && !o.num && o.pct === 100 && Math.abs(o.px + i) < 0.01;
}
function qf(n) {
  const l = n.transform;
  if (l && l !== "none") {
    const i = /^\s*translate(X|Y)?\(([^]*)\)\s*$/.exec(l), s = i && ie(i[2], ",").map((d) => d.trim());
    return !s || s.length > (i[1] ? 1 : 2) ? null : i[1] === "X" ? [s[0], "0"] : i[1] === "Y" ? ["0", s[0]] : [s[0], s[1] ?? "0"];
  }
  const o = n.translate;
  if (o && o !== "none") {
    const i = ie(String(o).trim(), " ").filter(Boolean);
    return i.length > 3 || i[2] !== void 0 && qn(i[2], {})?.px ? null : [i[0], i[1] ?? "0"];
  }
  return [];
}
function Jd(n, l, o, i = !1) {
  const s = n.values, d = qf(s);
  if (d?.length === 0) return;
  const m = s.transform && s.transform !== "none" ? "transform" : "translate", f = { fontSize: s["font-size"] }, p = (w, x) => {
    const z = qn(w, f);
    if (!(!z || z.unitless && z.num))
      return z.pct ? typeof x == "number" ? z.px + z.pct / 100 * x : void 0 : z.px;
  }, v = d ? p(d[0], l.w) : void 0, S = d ? p(d[1], l.h) : void 0;
  if (v === void 0 || S === void 0) {
    const w = !i && d ? d.map((x) => qn(x, f)) : null;
    if (w?.every((x) => x && !(x.unitless && x.num))) {
      l[Yf] = w.map((x) => [x.px, x.pct ?? 0]);
      return;
    }
    o("unsupported", m, s[m], n.sources[m]);
    return;
  }
  if (i) {
    v && (l.left = v), S && (l.top = S);
    return;
  }
  v && (l.ml = (l.ml ?? 0) + v), S && (l.mt = (l.mt ?? 0) + S);
}
const Yf = Symbol("perch.shift");
function dg(n, l, o) {
  const i = n.ownerDocument, s = i?.measure?.(n) ?? null;
  if (s) {
    const [[m, f], [p, v]] = o, S = m + f / 100 * s.width, w = p + v / 100 * s.height;
    S && (l.ml = (typeof l.ml == "number" ? l.ml : 0) + S), w && (l.mt = (typeof l.mt == "number" ? l.mt : 0) + w);
  }
  const d = s ? `${s.width}x${s.height}` : "";
  d === n.shiftSeen ? n.shiftTries = 0 : (n.shiftTries ?? 0) < Mf && i?.retries && (n.shiftSeen = d, n.shiftTries = (n.shiftTries ?? 0) + 1, i.retries.push(() => i.afterCommit?.()));
}
function Ur(n, l, o = null) {
  const i = n.values, s = {}, d = (O) => n.sources[O], m = (O) => n.sources[O] !== void 0, f = i.display;
  f === "none" ? s.display = "hidden" : f === "flex" || f === "inline-flex" ? s.display = "flex" : (f === "grid" || f === "inline-grid") && (s.display = "flex", s.flex_direction = "col", l("approximated", "display", f, d("display"), "one-column flex column"), i["grid-template-columns"] && i["grid-template-columns"] !== "none" && l("unsupported", "grid-template-columns", i["grid-template-columns"], d("grid-template-columns"))), n.element.hidden && (s.display = "hidden");
  const p = s.display === "flex";
  if (p && s.flex_direction !== "col") {
    const O = { row: "row", column: "col", "row-reverse": "row_reverse", "column-reverse": "col_reverse" }[i["flex-direction"]] ?? "row";
    s.flex_direction = O;
  }
  if (p) {
    (i["flex-wrap"] === "wrap" || i["flex-wrap"] === "wrap-reverse") && (s.flex_wrap = "wrap");
    const O = f === "grid" || f === "inline-grid", X = { "flex-start": "start", start: "start", "self-start": "start", "flex-end": "end", end: "end", "self-end": "end", center: "center", baseline: "baseline", "first baseline": "baseline" }[i["align-items"]];
    X && (s.items = X);
    let q = { "flex-start": "start", start: "start", "flex-end": "end", end: "end", center: "center", "space-between": "between", "space-around": "around", "space-evenly": "evenly" }[i["justify-content"]];
    if (O) {
      const b = { center: "center", end: "end", "flex-end": "end", start: "start", "flex-start": "start" }[i["justify-items"]];
      b && (s.items = b), i["align-items"] === "center" && (q = "center");
    }
    q && (s.justify = q);
    const H = mn(i["row-gap"]), h = mn(i["column-gap"]);
    typeof H == "number" && H && (s.gap_y = H), typeof h == "number" && h && !O && (s.gap_x = h);
  }
  i["flex-grow"] && (s.flex_grow = i["flex-grow"]), i["flex-shrink"] !== 1 && (s.flex_shrink = i["flex-shrink"]);
  const v = mn(i["flex-basis"]);
  v !== void 0 && v !== "auto" && (s.flex_basis = v);
  const S = { "flex-start": "start", start: "start", "flex-end": "end", end: "end", center: "center", baseline: "baseline", stretch: "stretch" }[i["align-self"]];
  S && (s.self = S);
  for (const [O, X] of [["w", "width"], ["h", "height"], ["min_w", "min-width"], ["min_h", "min-height"], ["max_w", "max-width"], ["max_h", "max-height"]]) {
    const q = i[X], H = mn(q);
    if (H === void 0 && X === "width" && ug(q, i)) {
      s.self = "stretch", l("approximated", X, q.expr, d(X), "stretched across its parent, inside its margins");
      continue;
    }
    const h = H === void 0 && /^max-/.test(X) ? cg(q, i["font-size"]) : void 0;
    if (h !== void 0) {
      s[O] = h, l("approximated", X, q.expr, d(X), "the fixed bound of min()");
      continue;
    }
    if (H === void 0) {
      typeof q == "object" && q.expr ? l("unsupported", X, q.expr, d(X), "no calc() in the engine") : typeof q == "string" && !["auto", "none"].includes(q) && l("unsupported", X, q, d(X));
      continue;
    }
    H !== "auto" && (s[O] = H);
  }
  const w = ["top", "right", "bottom", "left"];
  for (const O of w) {
    const X = O[0];
    for (const [q, H] of [["p", "padding"], ["m", "margin"]]) {
      const h = i[`${H}-${O}`], b = mn(h);
      if (b === void 0) {
        h?.expr && l("unsupported", `${H}-${O}`, h.expr, d(`${H}-${O}`), "no calc() in the engine");
        continue;
      }
      b !== 0 && (s[`${q}${X}`] = b);
    }
  }
  const x = i.position;
  if (x === "absolute" || x === "fixed") {
    s.position = "absolute", x === "fixed" && l("approximated", "position", "fixed", d("position"), "absolute in the overlay layer");
    for (const O of w) {
      const X = mn(i[O]);
      X !== void 0 && X !== "auto" && (s[O] = X);
    }
    if (x === "fixed" && o && s.w === void 0 && s.right === void 0 && typeof s.left == "number") {
      const O = o.width - s.left - (typeof s.ml == "number" ? s.ml : 0) - (typeof s.mr == "number" ? s.mr : 0);
      s.max_w = typeof s.max_w == "number" ? Math.min(s.max_w, O) : O;
    }
    Jd(n, s, l);
  } else x === "sticky" ? l("unsupported", "position", "sticky", d("position")) : qf(i)?.length !== 0 && (s.position = "relative", Jd(n, s, l, !0));
  i["z-index"] !== "auto" && m("z-index") && l("unsupported", "z-index", i["z-index"], d("z-index"), "paint order is tree order");
  for (const [O, X] of [["overflow_x", "overflow-x"], ["overflow_y", "overflow-y"]]) {
    const q = i[X];
    q === "hidden" || q === "clip" ? s[O] = "hidden" : (q === "auto" || q === "scroll") && (s[O] = "scroll");
  }
  (i.visibility === "hidden" || i.visibility === "collapse") && (s.visibility = "invisible");
  const z = i["background-color"];
  z?.unreadable ? l("unsupported", "background-color", z.unreadable, d("background-color")) : z?.rgba && z.rgba[3] > 0 && (s.bg = Xr(z)), i["background-image"] && i["background-image"] !== "none" && l("unsupported", "background-image", i["background-image"], d("background-image"));
  const E = w.map((O) => mn(i[`border-${O}-width`]) || 0), _ = [];
  w.forEach((O, X) => {
    if (!E[X]) return;
    s[`border_${O[0]}`] = E[X];
    const q = i[`border-${O}-style`];
    q !== "solid" && l("approximated", `border-${O}-style`, q, d(`border-${O}-style`), "drawn solid");
    const H = Xr(i[`border-${O}-color`]);
    H && _.push(H);
  }), _.length && (s.border_color = _[0], _.some((O) => O.value !== _[0].value) && l("approximated", "border-color", _.map((O) => O.value).join(" "), d("border-top-color"), "one border colour"));
  const k = (O) => {
    const X = mn(i[`border-${O}-radius`]) || 0;
    if (typeof X != "string") return X;
    const q = parseFloat(X) / 100, H = [s.w, s.h].filter((h) => typeof h == "number");
    return X === "auto" || !(q > 0) ? 0 : H.length ? Math.round(Math.min(q, 0.5) * Math.min(...H) * 100) / 100 : 9999;
  }, N = ["top-left", "top-right", "bottom-right", "bottom-left"].map(k);
  N.every((O) => O === N[0]) ? N[0] && (s.rounded = N[0]) : ["tl", "tr", "br", "bl"].forEach((O, X) => {
    N[X] && (s[`rounded_${O}`] = N[X]);
  }), i.opacity !== 1 && (s.opacity = Math.round(i.opacity * 1e3) / 1e3);
  const D = i["box-shadow"];
  if (D && D !== "none" && ie(D, ",").some((O) => !/^0(px)?\s+0(px)?\s+(0(px)?\s+)?(0(px)?\s+)?(#0000|transparent|rgba?\(0,\s*0,\s*0,\s*0\))/.test(O.trim())) && (s.shadow = "lg", l("approximated", "box-shadow", D, d("box-shadow"), "the engine's large shadow preset")), i.cursor && i.cursor !== "auto" && !n.inherited.has("cursor")) {
    const O = { pointer: "pointer", default: "default", text: "text", move: "move", "not-allowed": "not_allowed", grab: "move", grabbing: "move" }[i.cursor];
    O ? s.cursor = O : l("unsupported", "cursor", i.cursor, d("cursor"));
  }
  return i["text-overflow"] === "ellipsis" && (s.text_ellipsis = !0), i["text-decoration-line"] === "underline" ? s.underline = !0 : i["text-decoration-line"] && i["text-decoration-line"] !== "none" && l("unsupported", "text-decoration-line", i["text-decoration-line"], d("text-decoration-line")), s;
}
const fg = { "tabular-nums": "tnum", "proportional-nums": "pnum", "lining-nums": "lnum", "oldstyle-nums": "onum", "slashed-zero": "zero", "diagonal-fractions": "frac", "stacked-fractions": "afrc", ordinal: "ordn" };
function Gf(n) {
  if (!n || n === "normal") return "";
  const l = String(n).trim().split(/\s+/).map((o) => fg[o]);
  return l.every(Boolean) ? l.join(",") : null;
}
function qr(n, l) {
  const o = n.values, i = o["line-height"];
  return {
    text_color: Xr(o.color),
    text_size: Math.round(o["font-size"] * 1e3) / 1e3,
    font_features: Gf(o["font-variant-numeric"]) ?? "",
    font_weight: o["font-weight"],
    line_height: i.factor !== void 0 ? { factor: i.factor } : { px: Math.round(_l(o, l) * 1e3) / 1e3 },
    font_family: lg(o["font-family"]),
    italic: o["font-style"] === "italic" || o["font-style"] === "oblique",
    whitespace: o["white-space"] === "nowrap" || o["white-space"] === "pre" ? "nowrap" : "normal",
    text_align: { center: "center", right: "right", end: "right" }[o["text-align"]] ?? "left"
  };
}
const Wd = (n, l) => n.factor !== void 0 ? n.factor * l : n.px, Lf = (n, l) => JSON.stringify(n) === JSON.stringify(l);
function Yr(n, l, o) {
  const i = {}, s = (f, p) => p.some((v) => !n.inherited.has(v));
  for (const [f, p] of [["text_color", ["color"]], ["text_size", ["font-size"]], ["font_weight", ["font-weight"]], ["font_family", ["font-family"]], ["italic", ["font-style"]], ["whitespace", ["white-space"]], ["text_align", ["text-align"]], ["font_features", ["font-variant-numeric"]]])
    (s(f, p) || !Lf(l[f], o[f])) && (i[f] = l[f]);
  const d = Wd(l.line_height, l.text_size), m = o.line_height ? Wd(o.line_height, l.text_size) : NaN;
  return (s("line_height", ["line-height"]) || !(Math.abs(d - m) <= 1e-3)) && (i.line_height = l.line_height), i;
}
const mg = (n, l) => ({ ...n, ...l });
function Gr(n, l) {
  const o = {};
  for (const [i, s] of Object.entries(n))
    s && typeof s == "object" && "value" in s ? (o[i] = s.value, s.token && (l[i] = s.token)) : i === "line_height" ? o[i] = s.factor !== void 0 ? Math.round(s.factor * 1e3) / 1e3 : `${s.px}px` : i === "italic" ? s && (o.italic = !0) : o[i] = s;
  return o.italic === !1 && delete o.italic, o;
}
function Fd(n, l) {
  const o = {};
  for (const i of /* @__PURE__ */ new Set([...Object.keys(n), ...Object.keys(l)])) {
    const s = n[i], d = l[i];
    Lf(s, d) || (o[i] = d === void 0 ? i in Zr ? Zr[i] : null : d);
  }
  return o;
}
function Id(n, l) {
  const o = n.values;
  for (const [i, s] of Object.entries(n.sources)) {
    if (i.startsWith("--") || eg.has(i) || s.startsWith("ua:")) continue;
    const d = o[i];
    switch (i) {
      case "letter-spacing":
        d !== "normal" && d?.px !== 0 && l("approximated", i, d?.px !== void 0 ? `${Math.round(d.px * 1e3) / 1e3}px` : d, s, d?.px < 0 ? "the run's box is as wide as with the spacing (the glyphs reach past it; where the element clips, the run is drawn smaller to fit)" : "the run is as wide as with the spacing (room after it), the letters are not spread");
        break;
      case "font-variant-numeric":
        d !== "normal" && Gf(d) === null && l("unsupported", i, d, s);
        break;
      case "text-transform":
        d !== "none" && l("approximated", i, d, s, "applied to the text in JS");
        break;
      case "transition-property":
      case "transition-duration": {
        const m = o["transition-duration"];
        i === "transition-property" && m && ie(m, ",").some((f) => parseFloat(f) > 0) && o["transition-property"] !== "none" && l("unsupported", "transition", `${o["transition-property"]} ${m}`, s, "changes are instant (the engine animates only opacity and size)");
        break;
      }
      case "-webkit-line-clamp":
        d !== "none" && l("unsupported", i, d, s, "no line clamp in the engine");
        break;
      case "-webkit-box-orient":
      case "overflow-wrap":
        i === "overflow-wrap" && d !== "normal" && l("approximated", i, d, s, "lines broken by the translator where the box's width is known (`break_anywhere`)");
        break;
      case "outline-style":
      case "outline-width":
      case "outline-color":
        o["outline-style"] !== "none" && i === "outline-style" && l("unsupported", "outline", `${mn(o["outline-width"])}px ${o["outline-style"]} ${Xr(o["outline-color"])?.value ?? ""}`.trim(), s, "no outline in the engine (no focus ring)");
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
        d && d !== "none" && d !== "auto" && d !== "normal" && d !== "initial" && l("unsupported", i, d, s);
        break;
    }
  }
}
function pg(n, l, o, i) {
  const s = Ss(n), d = [], m = (N, D, O, X, q) => d.push([N, D, O, X ?? "(user agent)", s, q]), f = i.cascade.compute(n, l), p = {}, v = Ur(f, m, i.viewport), S = v[Yf];
  Id(f, m);
  const w = qr(f, i.measure), x = Yr(f, w, o), z = Gr({ ...v, ...x }, p), E = {}, _ = i.cascade.matching(n, "*").filter((N) => N.states.subject.size);
  for (const [N, D] of [["hover", ["hover"]], ["focus", ["focus", "focus-visible"]], ["active", ["active", "hover"]]]) {
    if (!_.some((h) => D.some((b) => h.states.subject.has(b)))) continue;
    const O = i.cascade.compute(n, l, new Set(D)), X = {}, q = Gr({ ...Ur(O, () => {
    }), ...Yr(O, qr(O, i.measure), o) }, X);
    N === "focus" && Id(O, m);
    const H = Fd(z, q);
    if (Object.keys(H).length) {
      E[N] = H;
      const h = Object.fromEntries(Object.entries(X).filter(([b]) => b in H));
      Object.keys(h).length && (E[`${N}_tokens`] = h);
    }
  }
  if (i.cascade.sheet.tracks(n, "hover") && (E.group = $d(n), E.track_hover = !0), i.cascade.sheet.readsAncestor(n, "hover"))
    for (let N = n.parentNode; N?.state; N = N.parentNode) {
      if (!i.cascade.sheet.tracks(N, "hover")) continue;
      const D = N.state.hover;
      N.state.hover = !0;
      let O;
      try {
        O = i.cascade.compute(n, l);
      } finally {
        N.state.hover = D;
      }
      const X = {}, q = Gr({ ...Ur(O, () => {
      }), ...Yr(O, qr(O, i.measure), o) }, X), H = Fd(z, q);
      if (!Object.keys(H).length) continue;
      const h = Object.fromEntries(Object.entries(X).filter(([b]) => b in H));
      (E.group_hover ??= []).push({ group: $d(N), style: H, ...Object.keys(h).length ? { tokens: h } : {} });
    }
  if (/tabular/.test(String(f.values["font-variant-numeric"] ?? "")) && (E.tabular = !0), /^(anywhere|break-word)$/.test(String(f.values["overflow-wrap"] ?? "")) && (E.break_anywhere = !0), v.overflow_y === "scroll") {
    const N = Number.parseFloat(f.customs?.["--scrollbar-size"] ?? "");
    N > 0 && (E.scrollbar = N);
  }
  f.values["pointer-events"] !== "none" && l?.values["pointer-events"] === "none" && (E.blocks_pointer = !0), f.values["pointer-events"] === "none" && (E.pointer_none = !0);
  const k = Object.entries(rg).filter(([, N]) => N.some((D) => typeof n.props[D] == "function")).map(([N]) => N);
  return !k.includes("click") && as(n) && k.push("click"), k.length && (E.events = k), { computed: f, style: z, tokens: p, extra: E, meta: wg(n), reports: d, childText: mg(o, x), where: s, shift: S };
}
function hg(n, l, o, i) {
  const s = { before: null, after: null };
  for (const d of ["before", "after"]) {
    if (!i.cascade.matching(n, /* @__PURE__ */ new Set(), d).length) continue;
    const m = i.cascade.compute(n, l, /* @__PURE__ */ new Set(), d), f = String(m.values.content ?? "none").trim();
    if (f === "none" || f === "normal") continue;
    const p = /^(["'])(.*)\1$/.exec(f)?.[2] ?? "", v = (E, _, k, N, D) => i.findings.add(E, _, k, N ?? "(user agent)", `${Ss(n)}::${d}`, D), S = {}, w = Ur(m, v, i.viewport), z = { kind: "div", style: Gr({ ...w, ...Yr(m, qr(m, i.measure), o) }, S), tokens: S, children: p ? [{ kind: "text", text: p }] : [] };
    Object.defineProperty(z, Un, { value: m.values.display }), s[d] = z;
  }
  return s;
}
const $d = (n) => `~g${n.id}`, gg = ["pt", "pr", "pb", "pl", "mt", "mr", "mb", "ml", "border_t", "border_r", "border_b", "border_l", "bg"];
function bg(n) {
  return n.kind === "div" && n[Un] === "inline" && !n.events?.length && !n.meta?.attrs?.["data-testid"] && !gg.some((l) => n.style?.[l]) && n.children?.every((l) => l.kind === "text");
}
function Qf(n, l, o, i, s = "") {
  const d = `${s}/${n.id}.${n.version}`;
  let m = i.cache.get(n);
  (!m || m.key !== d) && i.cache.set(n, m = { key: d, part: pg(n, l, o, i) });
  const { computed: f, tokens: p, extra: v, reports: S, childText: w, where: x } = m.part;
  for (const y of S) i.findings.add(...y);
  const z = (y, A, j, M, U) => i.findings.add(y, A, j, M, x, U), E = { ...m.part.style };
  m.part.shift && dg(n, E, m.part.shift);
  const _ = { kind: "div", id: n.id, style: E, tokens: p, meta: m.part.meta, ...v };
  Object.defineProperty(_, Un, { value: f.values.display }), n.measured && n.ownerDocument?.measureKey && (_.measure = n.ownerDocument.measureKey(n));
  const k = n.tagName;
  if (n.props["data-perch-engine"] != null)
    return _.kind = "engine", _.engine = String(n.props["data-perch-engine"]), _.key = String(n.props["data-perch-key"] ?? ""), _;
  if (k === "svg")
    return _.kind = n.props["data-perch-image"] ? "image" : "svg", _.markup = kg(n), _;
  if (k === "input" || k === "textarea" || k === "select") {
    _.kind = "input", _.input_type = k === "input" ? String(n.props.type ?? "text") : k;
    for (const j of ["placeholder", "checked", "disabled"]) n.props[j] !== void 0 && (_[j] = n.props[j]);
    if (/^(checkbox|radio)$/.test(_.input_type) && (_.checked = n.checked), k !== "select" && (_.value = n.value), k === "input" && og.test(_.input_type) && (_.field_w = sg * f.values["font-size"]), k === "textarea" && E.h === void 0) {
      const j = f.values, M = (F) => F && typeof F == "object" && "px" in F ? F.px : 0, U = (F) => j[`border-${F}-style`] === "none" ? 0 : M(j[`border-${F}-width`]), Z = Number(n.props.rows) > 0 ? Math.floor(Number(n.props.rows)) : 2;
      E.h = Z * _l(j, i.measure) + M(j["padding-top"]) + M(j["padding-bottom"]) + U("top") + U("bottom");
    }
    const { before: y, after: A } = hg(n, f, w, i);
    return (y || A) && (_.children = [y, A].filter(Boolean)), _;
  }
  if (k === "img") {
    _.kind = "image", _.src = n.props.src ?? null;
    for (const [y, A] of [["width", "w"], ["height", "h"]]) {
      const j = Number(n.props[y]);
      E[A] === void 0 && n.props[y] != null && Number.isFinite(j) && (E[A] = j);
    }
    return _;
  }
  const N = f.values["text-transform"], D = [];
  let O = !1, X = !1;
  for (const y of n.childNodes) {
    if (y instanceof ei) {
      if (y.hidden || y.data === "") continue;
      O = !0;
      const M = D[D.length - 1];
      if (M?.kind === "text")
        M.source = (M.source ?? M.text) + y.data, M.text = Pd(M.source, N), M.text === M.source && delete M.source;
      else {
        const U = Pd(y.data, N);
        D.push(U === y.data ? { kind: "text", text: U } : { kind: "text", text: U, source: y.data });
      }
      continue;
    }
    if (!(y instanceof Pt)) continue;
    const A = Qf(y, f, w, i, d), j = A[Un];
    j === "inline" || j === "inline-block" || j === "inline-flex" ? O = !0 : j !== "none" && (X = !0), D.push(A);
  }
  if (/(^|\s)inline-flex(\s|$)/.test(String(n.props?.className ?? "")) && E.w === void 0)
    for (const y of D)
      y.style?.flex_grow && y.style.min_w === 0 && y.style.overflow_x === "hidden" && (delete y.style.min_w, delete y.style.flex_grow, delete y.style.flex_basis, delete y.style.overflow_x, delete y.style.overflow_y);
  if (!E.display && O && D.some((y) => y.kind !== "text") && D.every((y) => y.kind === "text" || bg(y))) {
    const y = D.map((A) => A.kind === "text" ? A.text : A.children.map((j) => j.text).join("")).join("");
    z("approximated", "display", "inline text elements in a line of text", "(inline formatting)", "their text joined to the line, in its font"), D.splice(0, D.length, { kind: "text", text: y });
  }
  const q = D.some((y) => y.kind !== "text"), H = D.length === 1 && D[0].kind !== "text" && /^inline-(block|flex)$/.test(D[0][Un]) ? D[0] : null;
  if (!E.display && H) {
    const y = i.cache.get(n.childNodes.find((j) => j.id === H.id))?.part.computed, A = y ? Wr(f.values, i.measure) - xg(y.values, i.measure, H) : 0;
    E.display = "flex", E.flex_direction = "col", E.items = "start", A > 0 && (H.style.mt = Math.round(((H.style.mt ?? 0) + A) * 100) / 100), z("approximated", "display", `${f.values.display} holding one ${H[Un]} box`, "(inline formatting)", "a column, the box lowered to the line's baseline");
  } else if (!E.display && D.length === 1 && (D[0].kind === "svg" || D[0].kind === "image") && D[0][Un] === "inline" && typeof D[0].style.h == "number") {
    const y = D[0], A = Wr(f.values, i.measure), j = _l(f.values, i.measure) - A, M = (U) => Math.round(U * 100) / 100;
    E.display = "flex", E.flex_direction = "col", E.items = "start", A > y.style.h && (y.style.mt = M((y.style.mt ?? 0) + A - y.style.h)), j > 0 && (y.style.mb = M((y.style.mb ?? 0) + j)), z("approximated", "display", `${f.values.display} holding one inline image`, "(inline formatting)", "a column, the image on the line's baseline");
  } else if (!E.display && O && q) {
    if (E.display = "flex", E.flex_direction = X ? "col" : "row", !X) E.items = "baseline";
    else for (const y of D) y.kind !== "text" && /^inline-(block|flex)$/.test(y[Un]) && !y.style.self && (y.style.self = "start");
    z("approximated", "display", `${f.values.display} with inline content`, "(inline formatting)", X ? "a column of its children" : "a row on the text baseline");
  }
  const h = f.values["letter-spacing"]?.px, b = f.values["overflow-x"] !== "visible";
  if (h)
    for (let y = 0; y < D.length; y++) {
      const A = D[y];
      if (A.kind !== "text") continue;
      const j = Math.round(h * [...A.text].length * 1e3) / 1e3;
      if (h > 0 || !b) {
        D[y] = { kind: "div", style: { pr: j }, tokens: {}, children: [A] };
        continue;
      }
      const M = f.values["font-size"], U = Math.max(0.8, 1 + h / (0.55 * M)), Z = Math.round(_l(f.values, i.measure) * 1e3) / 1e3;
      D[y] = { kind: "div", style: { text_size: Math.round(M * U * 1e3) / 1e3, line_height: `${Z}px` }, tokens: {}, children: [A] };
    }
  return _.children = D, _;
}
function vg(n, l) {
  if (!l) return null;
  let i = (l.self ? n : l.closest ? Tf(n, l.closest) : l.find ? Sl(n, l.find)[0] : null)?.getAttribute(l.attr) ?? null;
  return i && l.strip && i.startsWith(l.strip) && (i = i.slice(l.strip.length)), i;
}
function yg(n, l, o) {
  const i = l.map((m) => [m, ti(m.selector)]), s = /* @__PURE__ */ new Map(), d = (m) => {
    for (const f of m.children) {
      const p = o.get(f.id);
      if (p)
        for (const [v, S] of i) {
          const w = v.textRange ? "range_name" : "name";
          if (v.textRange && p[w] != null || !S.some((_) => Nf(f, _))) continue;
          const x = vg(f, v.key), z = x == null ? s.get(v.name) ?? 0 : 0;
          x == null && s.set(v.name, z + 1);
          const E = x != null ? `${v.name}:${x}` : z ? `${v.name}@${z}` : v.name;
          p[w] == null ? p[w] = E : (p.also ??= []).push(E);
        }
      d(f);
    }
  };
  d(n.documentElement);
}
const Jr = 0.9521, Vf = 0.2256, Wr = (n, l) => (_l(n, l) - (Jr + Vf) * n["font-size"]) / 2 + Jr * n["font-size"];
function xg(n, l, o) {
  const i = (p) => p && typeof p == "object" && "px" in p ? p.px : 0, s = n["border-top-style"] === "none" ? 0 : i(n["border-top-width"]), d = o?.children ?? [], m = d.length === 1 && (d[0].kind === "svg" || d[0].kind === "image") && typeof d[0].style.h == "number" ? d[0] : null, f = m ? Math.max(Wr(n, l), (m.style.mt ?? 0) + m.style.h) : Wr(n, l);
  return i(n["padding-top"]) + s + f;
}
const Pd = (n, l) => l === "uppercase" ? n.toUpperCase() : l === "lowercase" ? n.toLowerCase() : l === "capitalize" ? n.replace(/\b\p{L}/gu, (o) => o.toUpperCase()) : n, Kf = /* @__PURE__ */ new Set(["children", "style", "className", "key", "ref", "dangerouslySetInnerHTML"]);
function wg(n) {
  const l = {};
  for (const [o, i] of Object.entries(n.props)) {
    if (Kf.has(o) || typeof i == "function" || i === void 0 || i === null || typeof i == "object") continue;
    const s = o.startsWith("aria-") || o.startsWith("data-");
    if (i === !1 && !s) continue;
    const d = o === "htmlFor" ? "for" : o === "tabIndex" ? "tabindex" : o;
    l[d] = typeof i == "boolean" ? s ? String(i) : "" : String(i);
  }
  return { tag: n.tagName, classes: n.classList, attrs: l };
}
const _g = (n) => n === "className" ? "class" : /^(viewBox|preserveAspectRatio|gradientUnits|gradientTransform|patternUnits|xmlns)$/.test(n) ? n : n.replace(/[A-Z]/g, (l) => `-${l.toLowerCase()}`), tf = (n) => String(n).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
function kg(n) {
  if (n.props["data-perch-markup"]) return String(n.props["data-perch-markup"]);
  const l = (o) => {
    const i = [];
    for (const [d, m] of Object.entries(o.props))
      Kf.has(d) || typeof m == "function" || m === void 0 || m === null || m === !1 || typeof m == "object" || d.startsWith("data-") || d.startsWith("aria-") || d === "focusable" || d === "role" || d === "title" || i.push(`${_g(d)}="${tf(m === !0 ? "" : m)}"`);
    o.tagName === "svg" && !o.props.xmlns && i.unshift('xmlns="http://www.w3.org/2000/svg"');
    const s = o.childNodes.map((d) => d instanceof ei ? tf(d.data) : l(d)).join("");
    return `<${o.tagName}${i.length ? ` ${i.join(" ")}` : ""}>${s}</${o.tagName}>`;
  };
  return l(n);
}
function Sg(n) {
  const l = n.theme?.() ?? {}, o = {};
  for (const i of Df) l[i] && (o[i] = l[i]);
  return o;
}
const Eg = { font_features: "" };
function zg(n, l, o, i = {}, s = null) {
  const d = Sg(l), m = l.viewport?.() ?? { width: 1e3, height: 800 }, f = JSON.stringify([d, m]);
  (i.look !== f || i.sheet !== o) && Object.assign(i, { look: f, sheet: o, cache: /* @__PURE__ */ new WeakMap(), cascade: new W0(o, { theme: d, viewport: m }), top: null });
  const { cascade: p, cache: v } = i, S = { cascade: p, cache: v, viewport: m, findings: new ig(), measure: l.lineHeight ? (z) => l.lineHeight(z) : null };
  i.top ??= p.compute(n.body, p.compute(n.documentElement, null));
  const w = n.body.children.map((z) => Qf(z, i.top, Eg, S));
  if (s?.length) {
    const z = /* @__PURE__ */ new Map(), E = (_) => {
      _.id && z.set(_.id, _);
      for (const k of _.children ?? []) E(k);
    };
    w.forEach(E), yg(n, s, z);
  }
  const x = /* @__PURE__ */ new Set();
  for (const z of [n, n.defaultView])
    for (const { type: E } of z?.listeners ?? []) Zd[E] && x.add(Zd[E]);
  return { schema: P0, root: w[0] ?? null, overlays: w.slice(1), document_events: [...x].sort(), unsupported: S.findings.list() };
}
const Ng = { layers: ["properties", "theme", "base", "utilities"], properties: { "--tw-translate-x": { inherits: !1, initial: "0" }, "--tw-translate-y": { inherits: !1, initial: "0" }, "--tw-translate-z": { inherits: !1, initial: "0" }, "--tw-rotate-x": { inherits: !1, initial: null }, "--tw-rotate-y": { inherits: !1, initial: null }, "--tw-rotate-z": { inherits: !1, initial: null }, "--tw-skew-x": { inherits: !1, initial: null }, "--tw-skew-y": { inherits: !1, initial: null }, "--tw-space-y-reverse": { inherits: !1, initial: "0" }, "--tw-border-style": { inherits: !1, initial: "solid" }, "--tw-leading": { inherits: !1, initial: null }, "--tw-font-weight": { inherits: !1, initial: null }, "--tw-tracking": { inherits: !1, initial: null }, "--tw-ordinal": { inherits: !1, initial: null }, "--tw-slashed-zero": { inherits: !1, initial: null }, "--tw-numeric-figure": { inherits: !1, initial: null }, "--tw-numeric-spacing": { inherits: !1, initial: null }, "--tw-numeric-fraction": { inherits: !1, initial: null }, "--tw-shadow": { inherits: !1, initial: "0 0 #0000" }, "--tw-shadow-color": { inherits: !1, initial: null }, "--tw-shadow-alpha": { inherits: !1, initial: "100%" }, "--tw-inset-shadow": { inherits: !1, initial: "0 0 #0000" }, "--tw-inset-shadow-color": { inherits: !1, initial: null }, "--tw-inset-shadow-alpha": { inherits: !1, initial: "100%" }, "--tw-ring-color": { inherits: !1, initial: null }, "--tw-ring-shadow": { inherits: !1, initial: "0 0 #0000" }, "--tw-inset-ring-color": { inherits: !1, initial: null }, "--tw-inset-ring-shadow": { inherits: !1, initial: "0 0 #0000" }, "--tw-ring-inset": { inherits: !1, initial: null }, "--tw-ring-offset-width": { inherits: !1, initial: "0" }, "--tw-ring-offset-color": { inherits: !1, initial: "#fff" }, "--tw-ring-offset-shadow": { inherits: !1, initial: "0 0 #0000" }, "--tw-outline-style": { inherits: !1, initial: "solid" }, "--tw-blur": { inherits: !1, initial: null }, "--tw-brightness": { inherits: !1, initial: null }, "--tw-contrast": { inherits: !1, initial: null }, "--tw-grayscale": { inherits: !1, initial: null }, "--tw-hue-rotate": { inherits: !1, initial: null }, "--tw-invert": { inherits: !1, initial: null }, "--tw-opacity": { inherits: !1, initial: null }, "--tw-saturate": { inherits: !1, initial: null }, "--tw-sepia": { inherits: !1, initial: null }, "--tw-drop-shadow": { inherits: !1, initial: null }, "--tw-drop-shadow-color": { inherits: !1, initial: null }, "--tw-drop-shadow-alpha": { inherits: !1, initial: "100%" }, "--tw-drop-shadow-size": { inherits: !1, initial: null }, "--tw-backdrop-blur": { inherits: !1, initial: null }, "--tw-backdrop-brightness": { inherits: !1, initial: null }, "--tw-backdrop-contrast": { inherits: !1, initial: null }, "--tw-backdrop-grayscale": { inherits: !1, initial: null }, "--tw-backdrop-hue-rotate": { inherits: !1, initial: null }, "--tw-backdrop-invert": { inherits: !1, initial: null }, "--tw-backdrop-opacity": { inherits: !1, initial: null }, "--tw-backdrop-saturate": { inherits: !1, initial: null }, "--tw-backdrop-sepia": { inherits: !1, initial: null }, "--tw-duration": { inherits: !1, initial: null }, "--tw-ease": { inherits: !1, initial: null }, "--tw-content": { inherits: !1, initial: '""' } }, rules: [[":root, :host", null, 2, [["--spacing", ".25rem"], ["--text-xs", ".75rem"], ["--text-xs--line-height", "calc(1 / .75)"], ["--text-sm", ".875rem"], ["--text-sm--line-height", "calc(1.25 / .875)"], ["--font-weight-normal", "400"], ["--font-weight-medium", "500"], ["--font-weight-semibold", "600"], ["--font-weight-bold", "700"], ["--tracking-normal", "0em"], ["--tracking-wide", ".025em"], ["--leading-tight", "1.25"], ["--leading-relaxed", "1.625"], ["--ease-out", "cubic-bezier(0, 0, .2, 1)"], ["--animate-pulse", "pulse 2s cubic-bezier(.4, 0, .6, 1) infinite"], ["--blur-xl", "24px"], ["--default-transition-duration", ".15s"], ["--default-transition-timing-function", "cubic-bezier(.4, 0, .2, 1)"], ["--animate-toast-in", "toast-in .2s cubic-bezier(.22, 1, .36, 1)"], ["--animate-host-pulse", "host-connecting-pulse 1.4s ease-in-out infinite"], ["--animate-drop-zone", "drop-zone-in .14s ease-out, drop-zone-pulse 1.2s ease-in-out .14s infinite"]]], ["::selection", null, 3, [["background", "var(--accent)"], ["color", "var(--panel-bg)"]]], [":where(input, textarea)::placeholder", null, 3, [["color", "var(--subtext-0)"], ["opacity", "1"]]], [":where(button, input, select, textarea)", null, 3, [["border", "0"]]], [':where(button, a[href], select, summary, [role="button"], [role="menuitem"]):focus-visible', null, 3, [["outline", "2px solid var(--accent)"], ["outline-offset", "-2px"]]], ["::-webkit-scrollbar", null, 3, [["width", "var(--scrollbar-size)"], ["height", "var(--scrollbar-size)"]]], ["::-webkit-scrollbar-track", null, 3, [["background", "none"]]], ["::-webkit-scrollbar-corner", null, 3, [["background", "none"]]], ["::-webkit-scrollbar-thumb", null, 3, [["background", "var(--text)"]]], ["::-webkit-scrollbar-thumb", null, 3, [["background", "color-mix(in srgb, var(--text) 20%, transparent)"]]], ["::-webkit-scrollbar-thumb", null, 3, [["border-radius", "var(--scrollbar-size)"]]], ["::-webkit-scrollbar-thumb:hover", null, 3, [["background", "var(--text)"]]], ["::-webkit-scrollbar-thumb:hover", null, 3, [["background", "color-mix(in srgb, var(--text) 40%, transparent)"]]], [".xterm .xterm-scrollable-element > .xterm-scrollbar > .xterm-slider", null, 3, [["border-radius", "var(--scrollbar-size)"]]], [".\\@container, .\\[container-type\\:inline-size\\]", null, 4, [["container-type", "inline-size"]]], [".pointer-events-auto", null, 4, [["pointer-events", "auto"]]], [".pointer-events-none", null, 4, [["pointer-events", "none"]]], [".collapse", null, 4, [["visibility", "collapse"]]], [".invisible", null, 4, [["visibility", "hidden"]]], [".visible", null, 4, [["visibility", "visible"]]], [".sr-only", null, 4, [["clip-path", "inset(50%)"], ["white-space", "nowrap"], ["border-width", "0"], ["width", "1px"], ["height", "1px"], ["margin", "-1px"], ["padding", "0"], ["position", "absolute"], ["overflow", "hidden"]]], [".absolute", null, 4, [["position", "absolute"]]], [".fixed", null, 4, [["position", "fixed"]]], [".relative", null, 4, [["position", "relative"]]], [".static", null, 4, [["position", "static"]]], [".sticky", null, 4, [["position", "sticky"]]], [".inset-0", null, 4, [["inset", "0"]]], [".inset-x-0", null, 4, [["inset-inline", "0"]]], [".inset-x-2", null, 4, [["inset-inline", "calc(var(--spacing) * 2)"]]], [".-top-1", null, 4, [["top", "calc(var(--spacing) * -1)"]]], [".-top-1\\.5", null, 4, [["top", "calc(var(--spacing) * -1.5)"]]], [".top-0", null, 4, [["top", "0"]]], [".top-1", null, 4, [["top", "var(--spacing)"]]], [".top-1\\.5", null, 4, [["top", "calc(var(--spacing) * 1.5)"]]], [".top-1\\/2", null, 4, [["top", "50%"]]], [".top-2", null, 4, [["top", "calc(var(--spacing) * 2)"]]], [".top-4", null, 4, [["top", "calc(var(--spacing) * 4)"]]], [".top-\\[0\\.1rem\\]", null, 4, [["top", ".1rem"]]], [".top-\\[7px\\]", null, 4, [["top", "7px"]]], [".top-\\[max\\(0\\.75rem\\,env\\(safe-area-inset-top\\)\\)\\]", null, 4, [["top", "max(.75rem, env(safe-area-inset-top))"]]], [".top-full", null, 4, [["top", "100%"]]], [".top-px", null, 4, [["top", "1px"]]], [".-right-1", null, 4, [["right", "calc(var(--spacing) * -1)"]]], [".-right-1\\.5", null, 4, [["right", "calc(var(--spacing) * -1.5)"]]], [".right-0", null, 4, [["right", "0"]]], [".right-1", null, 4, [["right", "var(--spacing)"]]], [".right-3", null, 4, [["right", "calc(var(--spacing) * 3)"]]], [".right-4", null, 4, [["right", "calc(var(--spacing) * 4)"]]], [".right-\\[0\\.8rem\\]", null, 4, [["right", ".8rem"]]], [".right-\\[0\\.25rem\\]", null, 4, [["right", ".25rem"]]], [".right-\\[max\\(0\\.75rem\\,env\\(safe-area-inset-right\\)\\)\\]", null, 4, [["right", "max(.75rem, env(safe-area-inset-right))"]]], [".right-full", null, 4, [["right", "100%"]]], [".bottom-0", null, 4, [["bottom", "0"]]], [".bottom-2", null, 4, [["bottom", "calc(var(--spacing) * 2)"]]], [".bottom-3", null, 4, [["bottom", "calc(var(--spacing) * 3)"]]], [".bottom-\\[0\\.8rem\\]", null, 4, [["bottom", ".8rem"]]], [".bottom-full", null, 4, [["bottom", "100%"]]], [".-left-8", null, 4, [["left", "calc(var(--spacing) * -8)"]]], [".-left-\\[2px\\]", null, 4, [["left", "-2px"]]], [".left-0", null, 4, [["left", "0"]]], [".left-2", null, 4, [["left", "calc(var(--spacing) * 2)"]]], [".left-\\[0\\.1rem\\]", null, 4, [["left", ".1rem"]]], [".left-\\[max\\(0\\.75rem\\,env\\(safe-area-inset-left\\)\\)\\]", null, 4, [["left", "max(.75rem, env(safe-area-inset-left))"]]], [".left-full", null, 4, [["left", "100%"]]], [".left-px", null, 4, [["left", "1px"]]], [".isolate", null, 4, [["isolation", "isolate"]]], [".z-4", null, 4, [["z-index", "4"]]], [".z-5", null, 4, [["z-index", "5"]]], [".z-10", null, 4, [["z-index", "10"]]], [".z-20", null, 4, [["z-index", "20"]]], [".z-30", null, 4, [["z-index", "30"]]], [".z-40", null, 4, [["z-index", "40"]]], [".z-50", null, 4, [["z-index", "50"]]], [".z-\\[2\\]", null, 4, [["z-index", "2"]]], [".z-\\[3\\]", null, 4, [["z-index", "3"]]], [".z-\\[5\\]", null, 4, [["z-index", "5"]]], [".z-\\[1000\\]", null, 4, [["z-index", "1000"]]], [".z-\\[2000\\]", null, 4, [["z-index", "2000"]]], [".z-\\[2100\\]", null, 4, [["z-index", "2100"]]], [".z-\\[2200\\]", null, 4, [["z-index", "2200"]]], [".z-\\[3000\\]", null, 4, [["z-index", "3000"]]], [".z-\\[3100\\]", null, 4, [["z-index", "3100"]]], [".z-\\[4000\\]", null, 4, [["z-index", "4000"]]], [".z-\\[9998\\]", null, 4, [["z-index", "9998"]]], [".z-\\[9999\\]", null, 4, [["z-index", "9999"]]], [".z-\\[10000\\]", null, 4, [["z-index", "10000"]]], [".z-auto", null, 4, [["z-index", "auto"]]], [".order-last", null, 4, [["order", "9999"]]], [".col-\\[1\\/-1\\]", null, 4, [["grid-column", "1 / -1"]]], [".container", null, 4, [["width", "100%"]]], [".container", ["(min-width: 40rem)"], 4, [["max-width", "40rem"]]], [".container", ["(min-width: 48rem)"], 4, [["max-width", "48rem"]]], [".container", ["(min-width: 64rem)"], 4, [["max-width", "64rem"]]], [".container", ["(min-width: 80rem)"], 4, [["max-width", "80rem"]]], [".container", ["(min-width: 96rem)"], 4, [["max-width", "96rem"]]], [".m-0", null, 4, [["margin", "0"]]], [".m-2", null, 4, [["margin", "calc(var(--spacing) * 2)"]]], [".m-\\[0\\.7rem\\]", null, 4, [["margin", ".7rem"]]], [".m-auto", null, 4, [["margin", "auto"]]], [".mx-0", null, 4, [["margin-inline", "0"]]], [".mx-0\\.5", null, 4, [["margin-inline", "calc(var(--spacing) * .5)"]]], [".mx-2", null, 4, [["margin-inline", "calc(var(--spacing) * 2)"]]], [".mx-3", null, 4, [["margin-inline", "calc(var(--spacing) * 3)"]]], [".mx-4", null, 4, [["margin-inline", "calc(var(--spacing) * 4)"]]], [".mx-\\[0\\.3rem\\]", null, 4, [["margin-inline", ".3rem"]]], [".mx-\\[0\\.7rem\\]", null, 4, [["margin-inline", ".7rem"]]], [".mx-\\[0\\.65rem\\]", null, 4, [["margin-inline", ".65rem"]]], [".mx-\\[3px\\]", null, 4, [["margin-inline", "3px"]]], [".mx-\\[11px\\]", null, 4, [["margin-inline", "11px"]]], [".mx-auto", null, 4, [["margin-inline", "auto"]]], [".my-0\\.5", null, 4, [["margin-block", "calc(var(--spacing) * .5)"]]], [".my-1", null, 4, [["margin-block", "var(--spacing)"]]], [".my-2", null, 4, [["margin-block", "calc(var(--spacing) * 2)"]]], [".my-\\[0\\.2rem\\]", null, 4, [["margin-block", ".2rem"]]], [".my-\\[0\\.3rem\\]", null, 4, [["margin-block", ".3rem"]]], [".my-\\[0\\.6rem\\]", null, 4, [["margin-block", ".6rem"]]], [".my-\\[0\\.28rem\\]", null, 4, [["margin-block", ".28rem"]]], [".my-\\[0\\.45rem\\]", null, 4, [["margin-block", ".45rem"]]], [".my-\\[0\\.55rem\\]", null, 4, [["margin-block", ".55rem"]]], [".my-\\[3px\\]", null, 4, [["margin-block", "3px"]]], [".-mt-\\[2px\\]", null, 4, [["margin-top", "-2px"]]], [".mt-0", null, 4, [["margin-top", "0"]]], [".mt-0\\.5", null, 4, [["margin-top", "calc(var(--spacing) * .5)"]]], [".mt-1", null, 4, [["margin-top", "var(--spacing)"]]], [".mt-1\\.5", null, 4, [["margin-top", "calc(var(--spacing) * 1.5)"]]], [".mt-2", null, 4, [["margin-top", "calc(var(--spacing) * 2)"]]], [".mt-3", null, 4, [["margin-top", "calc(var(--spacing) * 3)"]]], [".mt-4", null, 4, [["margin-top", "calc(var(--spacing) * 4)"]]], [".mt-\\[0\\.1rem\\]", null, 4, [["margin-top", ".1rem"]]], [".mt-\\[0\\.2rem\\]", null, 4, [["margin-top", ".2rem"]]], [".mt-\\[0\\.3rem\\]", null, 4, [["margin-top", ".3rem"]]], [".mt-\\[0\\.4rem\\]", null, 4, [["margin-top", ".4rem"]]], [".mt-\\[0\\.5rem\\]", null, 4, [["margin-top", ".5rem"]]], [".mt-\\[0\\.15rem\\]", null, 4, [["margin-top", ".15rem"]]], [".mt-\\[0\\.35rem\\]", null, 4, [["margin-top", ".35rem"]]], [".mr-1", null, 4, [["margin-right", "var(--spacing)"]]], [".mr-1\\.5", null, 4, [["margin-right", "calc(var(--spacing) * 1.5)"]]], [".mr-\\[0\\.3rem\\]", null, 4, [["margin-right", ".3rem"]]], [".mr-\\[0\\.7rem\\]", null, 4, [["margin-right", ".7rem"]]], [".mr-auto", null, 4, [["margin-right", "auto"]]], [".mb-0", null, 4, [["margin-bottom", "0"]]], [".mb-0\\.5", null, 4, [["margin-bottom", "calc(var(--spacing) * .5)"]]], [".mb-1", null, 4, [["margin-bottom", "var(--spacing)"]]], [".mb-2", null, 4, [["margin-bottom", "calc(var(--spacing) * 2)"]]], [".mb-3", null, 4, [["margin-bottom", "calc(var(--spacing) * 3)"]]], [".mb-4", null, 4, [["margin-bottom", "calc(var(--spacing) * 4)"]]], [".mb-8", null, 4, [["margin-bottom", "calc(var(--spacing) * 8)"]]], [".mb-\\[0\\.2rem\\]", null, 4, [["margin-bottom", ".2rem"]]], [".mb-\\[0\\.3rem\\]", null, 4, [["margin-bottom", ".3rem"]]], [".mb-\\[0\\.4rem\\]", null, 4, [["margin-bottom", ".4rem"]]], [".mb-\\[0\\.6rem\\]", null, 4, [["margin-bottom", ".6rem"]]], [".mb-\\[0\\.7rem\\]", null, 4, [["margin-bottom", ".7rem"]]], [".mb-\\[0\\.9rem\\]", null, 4, [["margin-bottom", ".9rem"]]], [".mb-\\[0\\.15rem\\]", null, 4, [["margin-bottom", ".15rem"]]], [".mb-\\[0\\.35rem\\]", null, 4, [["margin-bottom", ".35rem"]]], [".mb-\\[0\\.55rem\\]", null, 4, [["margin-bottom", ".55rem"]]], [".mb-\\[1\\.1rem\\]", null, 4, [["margin-bottom", "1.1rem"]]], [".-ml-0\\.5", null, 4, [["margin-left", "calc(var(--spacing) * -.5)"]]], [".-ml-1", null, 4, [["margin-left", "calc(var(--spacing) * -1)"]]], [".-ml-2", null, 4, [["margin-left", "calc(var(--spacing) * -2)"]]], [".ml-1", null, 4, [["margin-left", "var(--spacing)"]]], [".ml-2", null, 4, [["margin-left", "calc(var(--spacing) * 2)"]]], [".ml-\\[0\\.4rem\\]", null, 4, [["margin-left", ".4rem"]]], [".ml-\\[0\\.5rem\\]", null, 4, [["margin-left", ".5rem"]]], [".ml-\\[0\\.9rem\\]", null, 4, [["margin-left", ".9rem"]]], [".ml-\\[0\\.35rem\\]", null, 4, [["margin-left", ".35rem"]]], [".ml-\\[0\\.55rem\\]", null, 4, [["margin-left", ".55rem"]]], [".ml-\\[1\\.15rem\\]", null, 4, [["margin-left", "1.15rem"]]], [".ml-\\[1\\.45rem\\]", null, 4, [["margin-left", "1.45rem"]]], [".ml-\\[2\\.025rem\\]", null, 4, [["margin-left", "2.025rem"]]], [".ml-\\[2\\.375rem\\]", null, 4, [["margin-left", "2.375rem"]]], [".ml-\\[6\\.1rem\\]", null, 4, [["margin-left", "6.1rem"]]], [".ml-auto", null, 4, [["margin-left", "auto"]]], [".box-border", null, 4, [["box-sizing", "border-box"]]], [".\\!hidden", null, 4, [["display", "none", 1]]], [".\\[display\\:-webkit-box\\]", null, 4, [["display", "-webkit-box"]]], [".\\[display\\:var\\(--pane-grip\\,flex\\)\\]", null, 4, [["display", "var(--pane-grip, flex)"]]], [".block", null, 4, [["display", "block"]]], [".contents", null, 4, [["display", "contents"]]], [".flex", null, 4, [["display", "flex"]]], [".grid", null, 4, [["display", "grid"]]], [".hidden", null, 4, [["display", "none"]]], [".inline", null, 4, [["display", "inline"]]], [".inline-block", null, 4, [["display", "inline-block"]]], [".inline-flex", null, 4, [["display", "inline-flex"]]], [".table", null, 4, [["display", "table"]]], [".size-1", null, 4, [["width", "var(--spacing)"], ["height", "var(--spacing)"]]], [".size-1\\.5", null, 4, [["width", "calc(var(--spacing) * 1.5)"], ["height", "calc(var(--spacing) * 1.5)"]]], [".size-2", null, 4, [["width", "calc(var(--spacing) * 2)"], ["height", "calc(var(--spacing) * 2)"]]], [".size-3", null, 4, [["width", "calc(var(--spacing) * 3)"], ["height", "calc(var(--spacing) * 3)"]]], [".size-5", null, 4, [["width", "calc(var(--spacing) * 5)"], ["height", "calc(var(--spacing) * 5)"]]], [".size-6", null, 4, [["width", "calc(var(--spacing) * 6)"], ["height", "calc(var(--spacing) * 6)"]]], [".size-7", null, 4, [["width", "calc(var(--spacing) * 7)"], ["height", "calc(var(--spacing) * 7)"]]], [".size-8", null, 4, [["width", "calc(var(--spacing) * 8)"], ["height", "calc(var(--spacing) * 8)"]]], [".size-11", null, 4, [["width", "calc(var(--spacing) * 11)"], ["height", "calc(var(--spacing) * 11)"]]], [".size-14", null, 4, [["width", "calc(var(--spacing) * 14)"], ["height", "calc(var(--spacing) * 14)"]]], [".size-\\[0\\.6rem\\]", null, 4, [["width", ".6rem"], ["height", ".6rem"]]], [".size-\\[1\\.2rem\\]", null, 4, [["width", "1.2rem"], ["height", "1.2rem"]]], [".size-\\[5px\\]", null, 4, [["width", "5px"], ["height", "5px"]]], [".size-\\[14px\\]", null, 4, [["width", "14px"], ["height", "14px"]]], [".size-\\[calc\\(14px\\*var\\(--zoom\\,1\\)\\)\\]", null, 4, [["width", "calc(14px * var(--zoom, 1))"], ["height", "calc(14px * var(--zoom, 1))"]]], [".size-full", null, 4, [["width", "100%"], ["height", "100%"]]], [".h-1", null, 4, [["height", "var(--spacing)"]]], [".h-1\\.5", null, 4, [["height", "calc(var(--spacing) * 1.5)"]]], [".h-2", null, 4, [["height", "calc(var(--spacing) * 2)"]]], [".h-3", null, 4, [["height", "calc(var(--spacing) * 3)"]]], [".h-4", null, 4, [["height", "calc(var(--spacing) * 4)"]]], [".h-5", null, 4, [["height", "calc(var(--spacing) * 5)"]]], [".h-6", null, 4, [["height", "calc(var(--spacing) * 6)"]]], [".h-7", null, 4, [["height", "calc(var(--spacing) * 7)"]]], [".h-8", null, 4, [["height", "calc(var(--spacing) * 8)"]]], [".h-9", null, 4, [["height", "calc(var(--spacing) * 9)"]]], [".h-11", null, 4, [["height", "calc(var(--spacing) * 11)"]]], [".h-12", null, 4, [["height", "calc(var(--spacing) * 12)"]]], [".h-44", null, 4, [["height", "calc(var(--spacing) * 44)"]]], [".h-\\[1\\.1rem\\]", null, 4, [["height", "1.1rem"]]], [".h-\\[1\\.3rem\\]", null, 4, [["height", "1.3rem"]]], [".h-\\[1\\.4rem\\]", null, 4, [["height", "1.4rem"]]], [".h-\\[1\\.25rem\\]", null, 4, [["height", "1.25rem"]]], [".h-\\[2px\\]", null, 4, [["height", "2px"]]], [".h-\\[14px\\]", null, 4, [["height", "14px"]]], [".h-\\[18px\\]", null, 4, [["height", "18px"]]], [".h-\\[43px\\]", null, 4, [["height", "43px"]]], [".h-\\[calc\\(100\\%-max\\(0\\.5rem\\,env\\(safe-area-inset-top\\)\\)\\)\\]", null, 4, [["height", "calc(100% - max(.5rem, env(safe-area-inset-top)))"]]], [".h-full", null, 4, [["height", "100%"]]], [".h-px", null, 4, [["height", "1px"]]], [".max-h-40", null, 4, [["max-height", "calc(var(--spacing) * 40)"]]], [".max-h-56", null, 4, [["max-height", "calc(var(--spacing) * 56)"]]], [".max-h-72", null, 4, [["max-height", "calc(var(--spacing) * 72)"]]], [".max-h-\\[8rem\\]", null, 4, [["max-height", "8rem"]]], [".max-h-\\[13rem\\]", null, 4, [["max-height", "13rem"]]], [".max-h-\\[30\\%\\]", null, 4, [["max-height", "30%"]]], [".max-h-\\[30vh\\]", null, 4, [["max-height", "30vh"]]], [".max-h-\\[35vh\\]", null, 4, [["max-height", "35vh"]]], [".max-h-\\[40\\%\\]", null, 4, [["max-height", "40%"]]], [".max-h-\\[50dvh\\]", null, 4, [["max-height", "50dvh"]]], [".max-h-\\[60\\%\\]", null, 4, [["max-height", "60%"]]], [".max-h-\\[70\\%\\]", null, 4, [["max-height", "70%"]]], [".max-h-\\[85vh\\]", null, 4, [["max-height", "85vh"]]], [".max-h-\\[90\\%\\]", null, 4, [["max-height", "90%"]]], [".max-h-\\[190px\\]", null, 4, [["max-height", "190px"]]], [".max-h-\\[240px\\]", null, 4, [["max-height", "240px"]]], [".max-h-\\[260px\\]", null, 4, [["max-height", "260px"]]], [".max-h-\\[calc\\(85vh-4rem\\)\\]", null, 4, [["max-height", "calc(85vh - 4rem)"]]], [".max-h-\\[calc\\(100dvh_-_4rem\\)\\]", null, 4, [["max-height", "calc(100dvh - 4rem)"]]], [".max-h-\\[min\\(420px\\,calc\\(100dvh_-_16vh_-_2rem\\)\\)\\]", null, 4, [["max-height", "min(420px, 100dvh - 16vh - 2rem)"]]], [".max-h-\\[min\\(480px\\,calc\\(100dvh_-_16vh_-_2rem\\)\\)\\]", null, 4, [["max-height", "min(480px, 100dvh - 16vh - 2rem)"]]], [".max-h-full", null, 4, [["max-height", "100%"]]], [".min-h-0", null, 4, [["min-height", "0"]]], [".min-h-6", null, 4, [["min-height", "calc(var(--spacing) * 6)"]]], [".min-h-7", null, 4, [["min-height", "calc(var(--spacing) * 7)"]]], [".min-h-8", null, 4, [["min-height", "calc(var(--spacing) * 8)"]]], [".min-h-9", null, 4, [["min-height", "calc(var(--spacing) * 9)"]]], [".min-h-10", null, 4, [["min-height", "calc(var(--spacing) * 10)"]]], [".min-h-11", null, 4, [["min-height", "calc(var(--spacing) * 11)"]]], [".min-h-20", null, 4, [["min-height", "calc(var(--spacing) * 20)"]]], [".min-h-40", null, 4, [["min-height", "calc(var(--spacing) * 40)"]]], [".min-h-\\[1\\.5em\\]", null, 4, [["min-height", "1.5em"]]], [".min-h-\\[1\\.8rem\\]", null, 4, [["min-height", "1.8rem"]]], [".min-h-\\[2\\.5rem\\]", null, 4, [["min-height", "2.5rem"]]], [".min-h-\\[3\\.2rem\\]", null, 4, [["min-height", "3.2rem"]]], [".min-h-\\[3\\.25rem\\]", null, 4, [["min-height", "3.25rem"]]], [".min-h-\\[6rem\\]", null, 4, [["min-height", "6rem"]]], [".min-h-\\[8rem\\]", null, 4, [["min-height", "8rem"]]], [".min-h-\\[10rem\\]", null, 4, [["min-height", "10rem"]]], [".min-h-\\[12rem\\]", null, 4, [["min-height", "12rem"]]], [".min-h-\\[13rem\\]", null, 4, [["min-height", "13rem"]]], [".min-h-\\[32px\\]", null, 4, [["min-height", "32px"]]], [".min-h-\\[44px\\]", null, 4, [["min-height", "44px"]]], [".min-h-\\[60px\\]", null, 4, [["min-height", "60px"]]], [".min-h-\\[100dvh\\]", null, 4, [["min-height", "100dvh"]]], [".min-h-\\[calc\\(22px\\*var\\(--zoom\\,1\\)\\)\\]", null, 4, [["min-height", "calc(22px * var(--zoom, 1))"]]], [".min-h-full", null, 4, [["min-height", "100%"]]], [".w-2", null, 4, [["width", "calc(var(--spacing) * 2)"]]], [".w-2\\.5", null, 4, [["width", "calc(var(--spacing) * 2.5)"]]], [".w-3", null, 4, [["width", "calc(var(--spacing) * 3)"]]], [".w-4", null, 4, [["width", "calc(var(--spacing) * 4)"]]], [".w-5", null, 4, [["width", "calc(var(--spacing) * 5)"]]], [".w-7", null, 4, [["width", "calc(var(--spacing) * 7)"]]], [".w-8", null, 4, [["width", "calc(var(--spacing) * 8)"]]], [".w-9", null, 4, [["width", "calc(var(--spacing) * 9)"]]], [".w-10", null, 4, [["width", "calc(var(--spacing) * 10)"]]], [".w-20", null, 4, [["width", "calc(var(--spacing) * 20)"]]], [".w-40", null, 4, [["width", "calc(var(--spacing) * 40)"]]], [".w-44", null, 4, [["width", "calc(var(--spacing) * 44)"]]], [".w-60", null, 4, [["width", "calc(var(--spacing) * 60)"]]], [".w-\\[1\\.1rem\\]", null, 4, [["width", "1.1rem"]]], [".w-\\[1\\.4rem\\]", null, 4, [["width", "1.4rem"]]], [".w-\\[1\\.6rem\\]", null, 4, [["width", "1.6rem"]]], [".w-\\[1\\.25rem\\]", null, 4, [["width", "1.25rem"]]], [".w-\\[2\\.4rem\\]", null, 4, [["width", "2.4rem"]]], [".w-\\[2\\.25rem\\]", null, 4, [["width", "2.25rem"]]], [".w-\\[6rem\\]", null, 4, [["width", "6rem"]]], [".w-\\[7rem\\]", null, 4, [["width", "7rem"]]], [".w-\\[11rem\\]", null, 4, [["width", "11rem"]]], [".w-\\[15rem\\]", null, 4, [["width", "15rem"]]], [".w-\\[16rem\\]", null, 4, [["width", "16rem"]]], [".w-\\[18px\\]", null, 4, [["width", "18px"]]], [".w-\\[100cqi\\]", null, 4, [["width", "100cqi"]]], [".w-\\[calc\\(\\(100\\%-0\\.875rem\\)\\/8\\)\\]", null, 4, [["width", "calc(12.5% - .109375rem)"]]], [".w-\\[calc\\(100\\%_-_0\\.6rem\\)\\]", null, 4, [["width", "calc(100% - .6rem)"]]], [".w-\\[calc\\(100\\%_-_1rem\\)\\]", null, 4, [["width", "calc(100% - 1rem)"]]], [".w-\\[min\\(22rem\\,calc\\(100vw-3rem\\)\\)\\]", null, 4, [["width", "min(22rem, 100vw - 3rem)"]]], [".w-\\[min\\(26rem\\,100\\%\\)\\]", null, 4, [["width", "min(26rem, 100%)"]]], [".w-\\[min\\(28rem\\,calc\\(100vw-2\\.5rem\\)\\)\\]", null, 4, [["width", "min(28rem, 100vw - 2.5rem)"]]], [".w-\\[min\\(30rem\\,92vw\\)\\]", null, 4, [["width", "min(30rem, 92vw)"]]], [".w-\\[min\\(32rem\\,100\\%\\)\\]", null, 4, [["width", "min(32rem, 100%)"]]], [".w-\\[min\\(340px\\,calc\\(100vw-16px\\)\\)\\]", null, 4, [["width", "min(340px, 100vw - 16px)"]]], [".w-\\[min\\(360px\\,calc\\(100vw_-_2rem\\)\\)\\]", null, 4, [["width", "min(360px, 100vw - 2rem)"]]], [".w-\\[min\\(420px\\,calc\\(100vw_-_16px\\)\\)\\]", null, 4, [["width", "min(420px, 100vw - 16px)"]]], [".w-\\[min\\(480px\\,calc\\(100vw_-_2rem\\)\\)\\]", null, 4, [["width", "min(480px, 100vw - 2rem)"]]], [".w-\\[min\\(560px\\,calc\\(100vw_-_2rem\\)\\)\\]", null, 4, [["width", "min(560px, 100vw - 2rem)"]]], [".w-\\[var\\(--sidebar-width\\,240px\\)\\]", null, 4, [["width", "var(--sidebar-width, 240px)"]]], [".w-\\[var\\(--tools-width\\)\\]", null, 4, [["width", "var(--tools-width)"]]], [".w-auto", null, 4, [["width", "auto"]]], [".w-full", null, 4, [["width", "100%"]]], [".w-px", null, 4, [["width", "1px"]]], [".max-w-24", null, 4, [["max-width", "calc(var(--spacing) * 24)"]]], [".max-w-32", null, 4, [["max-width", "calc(var(--spacing) * 32)"]]], [".max-w-\\[9rem\\]", null, 4, [["max-width", "9rem"]]], [".max-w-\\[10rem\\]", null, 4, [["max-width", "10rem"]]], [".max-w-\\[14rem\\]", null, 4, [["max-width", "14rem"]]], [".max-w-\\[16rem\\]", null, 4, [["max-width", "16rem"]]], [".max-w-\\[24rem\\]", null, 4, [["max-width", "24rem"]]], [".max-w-\\[25\\%\\]", null, 4, [["max-width", "25%"]]], [".max-w-\\[26rem\\]", null, 4, [["max-width", "26rem"]]], [".max-w-\\[28rem\\]", null, 4, [["max-width", "28rem"]]], [".max-w-\\[35\\%\\]", null, 4, [["max-width", "35%"]]], [".max-w-\\[38\\%\\]", null, 4, [["max-width", "38%"]]], [".max-w-\\[45\\%\\]", null, 4, [["max-width", "45%"]]], [".max-w-\\[46rem\\]", null, 4, [["max-width", "46rem"]]], [".max-w-\\[55\\%\\]", null, 4, [["max-width", "55%"]]], [".max-w-\\[56rem\\]", null, 4, [["max-width", "56rem"]]], [".max-w-\\[85\\%\\]", null, 4, [["max-width", "85%"]]], [".max-w-\\[140px\\]", null, 4, [["max-width", "140px"]]], [".max-w-\\[320px\\]", null, 4, [["max-width", "320px"]]], [".max-w-\\[min\\(22rem\\,calc\\(100\\%-1\\.5rem\\)\\)\\]", null, 4, [["max-width", "min(22rem, 100% - 1.5rem)"]]], [".max-w-\\[min\\(30rem\\,calc\\(100\\%-1\\.6rem\\)\\)\\]", null, 4, [["max-width", "min(30rem, 100% - 1.6rem)"]]], [".max-w-\\[min\\(34rem\\,calc\\(100\\%-1\\.5rem\\)\\)\\]", null, 4, [["max-width", "min(34rem, 100% - 1.5rem)"]]], [".max-w-\\[min\\(320px\\,calc\\(100vw_-_24px\\)\\)\\]", null, 4, [["max-width", "min(320px, 100vw - 24px)"]]], [".max-w-full", null, 4, [["max-width", "100%"]]], [".max-w-none", null, 4, [["max-width", "none"]]], [".min-w-0", null, 4, [["min-width", "0"]]], [".min-w-6", null, 4, [["min-width", "calc(var(--spacing) * 6)"]]], [".min-w-8", null, 4, [["min-width", "calc(var(--spacing) * 8)"]]], [".min-w-12", null, 4, [["min-width", "calc(var(--spacing) * 12)"]]], [".min-w-24", null, 4, [["min-width", "calc(var(--spacing) * 24)"]]], [".min-w-36", null, 4, [["min-width", "calc(var(--spacing) * 36)"]]], [".min-w-56", null, 4, [["min-width", "calc(var(--spacing) * 56)"]]], [".min-w-\\[5\\.5rem\\]", null, 4, [["min-width", "5.5rem"]]], [".min-w-\\[7rem\\]", null, 4, [["min-width", "7rem"]]], [".min-w-\\[12rem\\]", null, 4, [["min-width", "12rem"]]], [".min-w-\\[14px\\]", null, 4, [["min-width", "14px"]]], [".min-w-\\[200px\\]", null, 4, [["min-width", "200px"]]], [".min-w-fit", null, 4, [["min-width", "fit-content"]]], [".min-w-max", null, 4, [["min-width", "max-content"]]], [".flex-1", null, 4, [["flex", "1"]]], [".flex-\\[0_0_5rem\\]", null, 4, [["flex", "0 0 5rem"]]], [".flex-\\[0_0_8px\\]", null, 4, [["flex", "0 0 8px"]]], [".flex-\\[0_1_40\\%\\]", null, 4, [["flex", "0 40%"]]], [".flex-\\[1_1_100\\%\\]", null, 4, [["flex", "100%"]]], [".flex-\\[2\\]", null, 4, [["flex", "2"]]], [".flex-initial", null, 4, [["flex", "0 auto"]]], [".flex-none", null, 4, [["flex", "none"]]], [".shrink", null, 4, [["flex-shrink", "1"]]], [".shrink-0", null, 4, [["flex-shrink", "0"]]], [".shrink-\\[0\\.001\\]", null, 4, [["flex-shrink", ".001"]]], [".shrink-\\[2\\]", null, 4, [["flex-shrink", "2"]]], [".shrink-\\[3\\]", null, 4, [["flex-shrink", "3"]]], [".grow", null, 4, [["flex-grow", "1"]]], [".basis-0", null, 4, [["flex-basis", "0"]]], [".basis-\\[14rem\\]", null, 4, [["flex-basis", "14rem"]]], [".-translate-y-1\\/2", null, 4, [["--tw-translate-y", "calc(calc(1 / 2 * 100%) * -1)"], ["translate", "var(--tw-translate-x) var(--tw-translate-y)"]]], [".\\[transform\\:translateY\\(-50\\%\\)\\]", null, 4, [["transform", "translateY(-50%)"]]], [".transform", null, 4, [["transform", "var(--tw-rotate-x, ) var(--tw-rotate-y, ) var(--tw-rotate-z, ) var(--tw-skew-x, ) var(--tw-skew-y, )"]]], [".animate-drop-zone", null, 4, [["animation", "var(--animate-drop-zone)"]]], [".animate-host-pulse", null, 4, [["animation", "var(--animate-host-pulse)"]]], [".animate-pulse", null, 4, [["animation", "var(--animate-pulse)"]]], [".animate-toast-in", null, 4, [["animation", "var(--animate-toast-in)"]]], [".cursor-col-resize", null, 4, [["cursor", "col-resize"]]], [".cursor-default", null, 4, [["cursor", "default"]]], [".cursor-grab", null, 4, [["cursor", "grab"]]], [".cursor-grabbing", null, 4, [["cursor", "grabbing"]]], [".cursor-pointer", null, 4, [["cursor", "pointer"]]], [".cursor-row-resize", null, 4, [["cursor", "row-resize"]]], [".touch-none", null, 4, [["touch-action", "none"]]], [".resize", null, 4, [["resize", "both"]]], [".resize-none", null, 4, [["resize", "none"]]], [".resize-y", null, 4, [["resize", "vertical"]]], [".\\[scrollbar-width\\:none\\]", null, 4, [["scrollbar-width", "none"]]], [".list-disc", null, 4, [["list-style-type", "disc"]]], [".list-none", null, 4, [["list-style-type", "none"]]], [".appearance-none", null, 4, [["appearance", "none"]]], [".grid-cols-8", null, 4, [["grid-template-columns", "repeat(8, minmax(0, 1fr))"]]], [".grid-cols-\\[1fr_auto_1fr\\]", null, 4, [["grid-template-columns", "1fr auto 1fr"]]], [".grid-cols-\\[2\\.5rem_2\\.5rem_0\\.9rem_minmax\\(0\\,1fr\\)\\]", null, 4, [["grid-template-columns", "2.5rem 2.5rem .9rem minmax(0, 1fr)"]]], [".grid-cols-\\[auto_minmax\\(0\\,1fr\\)\\]", null, 4, [["grid-template-columns", "auto minmax(0, 1fr)"]]], [".grid-cols-\\[minmax\\(4rem\\,10rem\\)_1fr_auto\\]", null, 4, [["grid-template-columns", "minmax(4rem, 10rem) 1fr auto"]]], [".grid-cols-\\[repeat\\(2\\,minmax\\(0\\,1fr\\)\\)\\]", null, 4, [["grid-template-columns", "repeat(2, minmax(0, 1fr))"]]], [".grid-cols-\\[repeat\\(auto-fit\\,minmax\\(8rem\\,1fr\\)\\)\\]", null, 4, [["grid-template-columns", "repeat(auto-fit, minmax(8rem, 1fr))"]]], [".flex-col", null, 4, [["flex-direction", "column"]]], [".flex-row", null, 4, [["flex-direction", "row"]]], [".flex-wrap", null, 4, [["flex-wrap", "wrap"]]], [".place-items-center", null, 4, [["place-items", "center"]]], [".content-center", null, 4, [["align-content", "center"]]], [".items-baseline", null, 4, [["align-items", "baseline"]]], [".items-center", null, 4, [["align-items", "center"]]], [".items-end", null, 4, [["align-items", "flex-end"]]], [".items-start", null, 4, [["align-items", "flex-start"]]], [".items-stretch", null, 4, [["align-items", "stretch"]]], [".justify-between", null, 4, [["justify-content", "space-between"]]], [".justify-center", null, 4, [["justify-content", "center"]]], [".justify-end", null, 4, [["justify-content", "flex-end"]]], [".justify-start", null, 4, [["justify-content", "flex-start"]]], [".justify-items-center", null, 4, [["justify-items", "center"]]], [".justify-items-start", null, 4, [["justify-items", "start"]]], [".gap-0", null, 4, [["gap", "0"]]], [".gap-0\\.5", null, 4, [["gap", "calc(var(--spacing) * .5)"]]], [".gap-1", null, 4, [["gap", "var(--spacing)"]]], [".gap-1\\.5", null, 4, [["gap", "calc(var(--spacing) * 1.5)"]]], [".gap-2", null, 4, [["gap", "calc(var(--spacing) * 2)"]]], [".gap-3", null, 4, [["gap", "calc(var(--spacing) * 3)"]]], [".gap-4", null, 4, [["gap", "calc(var(--spacing) * 4)"]]], [".gap-6", null, 4, [["gap", "calc(var(--spacing) * 6)"]]], [".gap-\\[0\\.1rem\\]", null, 4, [["gap", ".1rem"]]], [".gap-\\[0\\.3rem\\]", null, 4, [["gap", ".3rem"]]], [".gap-\\[0\\.4rem\\]", null, 4, [["gap", ".4rem"]]], [".gap-\\[0\\.05rem\\]", null, 4, [["gap", ".05rem"]]], [".gap-\\[0\\.6rem\\]", null, 4, [["gap", ".6rem"]]], [".gap-\\[0\\.8rem\\]", null, 4, [["gap", ".8rem"]]], [".gap-\\[0\\.16rem\\]", null, 4, [["gap", ".16rem"]]], [".gap-\\[0\\.32rem\\]", null, 4, [["gap", ".32rem"]]], [".gap-\\[0\\.35rem\\]", null, 4, [["gap", ".35rem"]]], [".gap-\\[0\\.45rem\\]", null, 4, [["gap", ".45rem"]]], [".gap-\\[0\\.55rem\\]", null, 4, [["gap", ".55rem"]]], [".gap-\\[0\\.65rem\\]", null, 4, [["gap", ".65rem"]]], [".gap-\\[0\\.85rem\\]", null, 4, [["gap", ".85rem"]]], [".gap-\\[1px\\]", null, 4, [["gap", "1px"]]], [".gap-\\[2px\\]", null, 4, [["gap", "2px"]]], [".gap-\\[3px\\]", null, 4, [["gap", "3px"]]], [".gap-\\[7px\\]", null, 4, [["gap", "7px"]]], [".gap-\\[13px\\]", null, 4, [["gap", "13px"]]], [":where(.space-y-0\\.5 > :not(:last-child))", null, 4, [["--tw-space-y-reverse", "0"], ["margin-block-start", "calc(calc(var(--spacing) * .5) * var(--tw-space-y-reverse))"], ["margin-block-end", "calc(calc(var(--spacing) * .5) * calc(1 - var(--tw-space-y-reverse)))"]]], [".gap-x-3", null, 4, [["column-gap", "calc(var(--spacing) * 3)"]]], [".gap-x-4", null, 4, [["column-gap", "calc(var(--spacing) * 4)"]]], [".gap-x-\\[0\\.7rem\\]", null, 4, [["column-gap", ".7rem"]]], [".gap-x-\\[0\\.9rem\\]", null, 4, [["column-gap", ".9rem"]]], [".gap-y-1", null, 4, [["row-gap", "var(--spacing)"]]], [".gap-y-\\[0\\.3rem\\]", null, 4, [["row-gap", ".3rem"]]], [".self-center", null, 4, [["align-self", "center"]]], [".self-end", null, 4, [["align-self", "flex-end"]]], [".self-start", null, 4, [["align-self", "flex-start"]]], [".self-stretch", null, 4, [["align-self", "stretch"]]], [".justify-self-start", null, 4, [["justify-self", "flex-start"]]], [".truncate", null, 4, [["text-overflow", "ellipsis"], ["white-space", "nowrap"], ["overflow", "hidden"]]], [".overflow-auto", null, 4, [["overflow", "auto"]]], [".overflow-hidden", null, 4, [["overflow", "hidden"]]], [".overflow-visible", null, 4, [["overflow", "visible"]]], [".overflow-x-auto", null, 4, [["overflow-x", "auto"]]], [".overflow-y-auto", null, 4, [["overflow-y", "auto"]]], [".overscroll-contain", null, 4, [["overscroll-behavior", "contain"]]], [".rounded, .rounded-\\[0\\.25rem\\]", null, 4, [["border-radius", ".25rem"]]], [".rounded-\\[1\\.5rem\\]", null, 4, [["border-radius", "1.5rem"]]], [".rounded-\\[2px\\]", null, 4, [["border-radius", "2px"]]], [".rounded-\\[3px\\]", null, 4, [["border-radius", "3px"]]], [".rounded-\\[12px\\]", null, 4, [["border-radius", "12px"]]], [".rounded-\\[50\\%\\]", null, 4, [["border-radius", "50%"]]], [".rounded-\\[999px\\]", null, 4, [["border-radius", "999px"]]], [".rounded-\\[calc\\(var\\(--radius\\)\\*2\\)\\]", null, 4, [["border-radius", "calc(var(--radius) * 2)"]]], [".rounded-\\[var\\(--card-radius\\,8px\\)\\]", null, 4, [["border-radius", "var(--card-radius, 8px)"]]], [".rounded-\\[var\\(--card-radius\\,12px\\)\\]", null, 4, [["border-radius", "var(--card-radius, 12px)"]]], [".rounded-full", null, 4, [["border-radius", "3.40282e38px"]]], [".rounded-none", null, 4, [["border-radius", "0"]]], [".rounded-soft", null, 4, [["border-radius", "var(--radius-pane)"]]], [".rounded-ui", null, 4, [["border-radius", "var(--radius)"]]], [".rounded-t-\\[12px\\]", null, 4, [["border-top-left-radius", "12px"], ["border-top-right-radius", "12px"]]], [".rounded-t-none", null, 4, [["border-top-left-radius", "0"], ["border-top-right-radius", "0"]]], [".rounded-bl-\\[6px\\]", null, 4, [["border-bottom-left-radius", "6px"]]], [".border", null, 4, [["border-style", "var(--tw-border-style)"], ["border-width", "1px"]]], [".border-0", null, 4, [["border-style", "var(--tw-border-style)"], ["border-width", "0"]]], [".border-\\[1\\.5px\\]", null, 4, [["border-style", "var(--tw-border-style)"], ["border-width", "1.5px"]]], [".border-b", null, 4, [["border-bottom-style", "var(--tw-border-style)"], ["border-bottom-width", "1px"]]], [".border-l", null, 4, [["border-left-style", "var(--tw-border-style)"], ["border-left-width", "1px"]]], [".border-l-\\[3px\\]", null, 4, [["border-left-style", "var(--tw-border-style)"], ["border-left-width", "3px"]]], [".border-solid", null, 4, [["--tw-border-style", "solid"], ["border-style", "solid"]]], [".border-accent", null, 4, [["border-color", "var(--accent)"]]], [".border-overlay-0", null, 4, [["border-color", "var(--overlay-0)"]]], [".border-overlay-1", null, 4, [["border-color", "var(--overlay-1)"]]], [".border-red", null, 4, [["border-color", "var(--red)"]]], [".border-subtext-0", null, 4, [["border-color", "var(--subtext-0)"]]], [".border-surface-1", null, 4, [["border-color", "var(--surface-1)"]]], [".border-teal", null, 4, [["border-color", "var(--teal)"]]], [".border-yellow", null, 4, [["border-color", "var(--yellow)"]]], [".border-l-accent", null, 4, [["border-left-color", "var(--accent)"]]], [".border-l-green", null, 4, [["border-left-color", "var(--green)"]]], [".border-l-red", null, 4, [["border-left-color", "var(--red)"]]], [".border-l-yellow", null, 4, [["border-left-color", "var(--yellow)"]]], [".bg-\\[\\#161616\\]", null, 4, [["background-color", "#161616"]]], [".bg-\\[\\#fff\\]", null, 4, [["background-color", "#fff"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_8\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "var(--accent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_8\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--accent) 8%,var(--panel-bg))"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_12\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--accent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_12\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--accent) 12%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--accent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--accent) 15%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--blue\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--blue)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--blue\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--blue) 15%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--green\\)_9\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--green)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--green\\)_9\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--green) 9%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--red\\)_7\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--red)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--red\\)_7\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--red) 7%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--red\\)_9\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--red)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--red\\)_9\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--red) 9%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--surface-1\\)_42\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--surface-1\\)_42\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--surface-1) 42%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--surface-1\\)_70\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--surface-1\\)_70\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--surface-1) 70%,var(--panel-bg))"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--text\\)_10\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "var(--text)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--text\\)_10\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--text) 10%,var(--panel-bg))"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--yellow\\)_8\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--yellow)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--yellow\\)_8\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--yellow) 8%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--yellow\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--yellow)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--yellow\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--yellow) 15%,transparent)"]]], [".bg-\\[rgba\\(0\\,0\\,0\\,0\\.5\\)\\]", null, 4, [["background-color", "#00000080"]]], [".bg-\\[rgba\\(0\\,0\\,0\\,0\\.7\\)\\]", null, 4, [["background-color", "#000000b3"]]], [".bg-\\[rgba\\(0\\,0\\,0\\,0\\.55\\)\\]", null, 4, [["background-color", "#0000008c"]]], [".bg-\\[rgba\\(0\\,0\\,0\\,0\\.62\\)\\]", null, 4, [["background-color", "#0000009e"]]], [".bg-\\[var\\(--accent\\)\\]", null, 4, [["background-color", "var(--accent)"]]], [".bg-\\[var\\(--backdrop\\)\\]", null, 4, [["background-color", "var(--backdrop)"]]], [".bg-\\[var\\(--bg\\)\\]", null, 4, [["background-color", "var(--bg)"]]], [".bg-\\[var\\(--card-bg\\)\\]", null, 4, [["background-color", "var(--card-bg)"]]], [".bg-\\[var\\(--picker-bg\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "var(--picker-bg, var(--panel-bg))"]]], [".bg-\\[var\\(--surface-1\\)\\]", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-\\[var\\(--workspace-tools-bg\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "var(--workspace-tools-bg, var(--panel-bg))"]]], [".bg-accent, .bg-accent\\/10", null, 4, [["background-color", "var(--accent)"]]], [".bg-accent\\/10", null, 4, [["background-color", "color-mix(in oklab, var(--accent) 10%, transparent)"]]], [".bg-accent\\/35", null, 4, [["background-color", "var(--accent)"]]], [".bg-accent\\/35", null, 4, [["background-color", "color-mix(in oklab, var(--accent) 35%, transparent)"]]], [".bg-fg", null, 4, [["background-color", "var(--text)"]]], [".bg-green, .bg-green\\/15", null, 4, [["background-color", "var(--green)"]]], [".bg-green\\/15", null, 4, [["background-color", "color-mix(in oklab, var(--green) 15%, transparent)"]]], [".bg-overlay-0", null, 4, [["background-color", "var(--overlay-0)"]]], [".bg-overlay-1", null, 4, [["background-color", "var(--overlay-1)"]]], [".bg-panel-bg", null, 4, [["background-color", "var(--panel-bg)"]]], [".bg-red, .bg-red\\/15", null, 4, [["background-color", "var(--red)"]]], [".bg-red\\/15", null, 4, [["background-color", "color-mix(in oklab, var(--red) 15%, transparent)"]]], [".bg-subtext-0", null, 4, [["background-color", "var(--subtext-0)"]]], [".bg-surface-0", null, 4, [["background-color", "var(--surface-0)"]]], [".bg-surface-1, .bg-surface-1\\/30", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-surface-1\\/30", null, 4, [["background-color", "color-mix(in oklab, var(--surface-1) 30%, transparent)"]]], [".bg-surface-1\\/60", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-surface-1\\/60", null, 4, [["background-color", "color-mix(in oklab, var(--surface-1) 60%, transparent)"]]], [".bg-surface-1\\/70", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-surface-1\\/70", null, 4, [["background-color", "color-mix(in oklab, var(--surface-1) 70%, transparent)"]]], [".bg-transparent", null, 4, [["background-color", "#0000"]]], [".bg-yellow", null, 4, [["background-color", "var(--yellow)"]]], [".object-contain", null, 4, [["object-fit", "contain"]]], [".object-cover", null, 4, [["object-fit", "cover"]]], [".p-0", null, 4, [["padding", "0"]]], [".p-0\\.5", null, 4, [["padding", "calc(var(--spacing) * .5)"]]], [".p-1", null, 4, [["padding", "var(--spacing)"]]], [".p-2", null, 4, [["padding", "calc(var(--spacing) * 2)"]]], [".p-3", null, 4, [["padding", "calc(var(--spacing) * 3)"]]], [".p-4", null, 4, [["padding", "calc(var(--spacing) * 4)"]]], [".p-5", null, 4, [["padding", "calc(var(--spacing) * 5)"]]], [".p-6", null, 4, [["padding", "calc(var(--spacing) * 6)"]]], [".p-\\[0\\.2rem\\]", null, 4, [["padding", ".2rem"]]], [".p-\\[0\\.4rem\\]", null, 4, [["padding", ".4rem"]]], [".p-\\[0\\.5rem\\]", null, 4, [["padding", ".5rem"]]], [".p-\\[0\\.9rem\\]", null, 4, [["padding", ".9rem"]]], [".p-\\[0\\.45rem\\]", null, 4, [["padding", ".45rem"]]], [".p-\\[0\\.55rem\\]", null, 4, [["padding", ".55rem"]]], [".p-\\[0\\.65rem\\]", null, 4, [["padding", ".65rem"]]], [".p-\\[2px\\]", null, 4, [["padding", "2px"]]], [".px-0", null, 4, [["padding-inline", "0"]]], [".px-1", null, 4, [["padding-inline", "var(--spacing)"]]], [".px-1\\.5", null, 4, [["padding-inline", "calc(var(--spacing) * 1.5)"]]], [".px-2", null, 4, [["padding-inline", "calc(var(--spacing) * 2)"]]], [".px-3", null, 4, [["padding-inline", "calc(var(--spacing) * 3)"]]], [".px-3\\.5", null, 4, [["padding-inline", "calc(var(--spacing) * 3.5)"]]], [".px-4", null, 4, [["padding-inline", "calc(var(--spacing) * 4)"]]], [".px-8", null, 4, [["padding-inline", "calc(var(--spacing) * 8)"]]], [".px-\\[0\\.2rem\\]", null, 4, [["padding-inline", ".2rem"]]], [".px-\\[0\\.3rem\\]", null, 4, [["padding-inline", ".3rem"]]], [".px-\\[0\\.4rem\\]", null, 4, [["padding-inline", ".4rem"]]], [".px-\\[0\\.5rem\\]", null, 4, [["padding-inline", ".5rem"]]], [".px-\\[0\\.6rem\\]", null, 4, [["padding-inline", ".6rem"]]], [".px-\\[0\\.7rem\\]", null, 4, [["padding-inline", ".7rem"]]], [".px-\\[0\\.8rem\\]", null, 4, [["padding-inline", ".8rem"]]], [".px-\\[0\\.9rem\\]", null, 4, [["padding-inline", ".9rem"]]], [".px-\\[0\\.26rem\\]", null, 4, [["padding-inline", ".26rem"]]], [".px-\\[0\\.28rem\\]", null, 4, [["padding-inline", ".28rem"]]], [".px-\\[0\\.35rem\\]", null, 4, [["padding-inline", ".35rem"]]], [".px-\\[0\\.42rem\\]", null, 4, [["padding-inline", ".42rem"]]], [".px-\\[0\\.45rem\\]", null, 4, [["padding-inline", ".45rem"]]], [".px-\\[0\\.48rem\\]", null, 4, [["padding-inline", ".48rem"]]], [".px-\\[0\\.55rem\\]", null, 4, [["padding-inline", ".55rem"]]], [".px-\\[0\\.65rem\\]", null, 4, [["padding-inline", ".65rem"]]], [".px-\\[0\\.75rem\\]", null, 4, [["padding-inline", ".75rem"]]], [".px-\\[0\\.85rem\\]", null, 4, [["padding-inline", ".85rem"]]], [".px-\\[1\\.4rem\\]", null, 4, [["padding-inline", "1.4rem"]]], [".px-\\[3px\\]", null, 4, [["padding-inline", "3px"]]], [".px-\\[10px\\]", null, 4, [["padding-inline", "10px"]]], [".py-0", null, 4, [["padding-block", "0"]]], [".py-0\\.5", null, 4, [["padding-block", "calc(var(--spacing) * .5)"]]], [".py-1", null, 4, [["padding-block", "var(--spacing)"]]], [".py-1\\.5", null, 4, [["padding-block", "calc(var(--spacing) * 1.5)"]]], [".py-2", null, 4, [["padding-block", "calc(var(--spacing) * 2)"]]], [".py-3", null, 4, [["padding-block", "calc(var(--spacing) * 3)"]]], [".py-4", null, 4, [["padding-block", "calc(var(--spacing) * 4)"]]], [".py-8", null, 4, [["padding-block", "calc(var(--spacing) * 8)"]]], [".py-\\[0\\.1rem\\]", null, 4, [["padding-block", ".1rem"]]], [".py-\\[0\\.2rem\\]", null, 4, [["padding-block", ".2rem"]]], [".py-\\[0\\.3rem\\]", null, 4, [["padding-block", ".3rem"]]], [".py-\\[0\\.4rem\\]", null, 4, [["padding-block", ".4rem"]]], [".py-\\[0\\.05rem\\]", null, 4, [["padding-block", ".05rem"]]], [".py-\\[0\\.6rem\\]", null, 4, [["padding-block", ".6rem"]]], [".py-\\[0\\.8rem\\]", null, 4, [["padding-block", ".8rem"]]], [".py-\\[0\\.12rem\\]", null, 4, [["padding-block", ".12rem"]]], [".py-\\[0\\.14rem\\]", null, 4, [["padding-block", ".14rem"]]], [".py-\\[0\\.15rem\\]", null, 4, [["padding-block", ".15rem"]]], [".py-\\[0\\.18rem\\]", null, 4, [["padding-block", ".18rem"]]], [".py-\\[0\\.25rem\\]", null, 4, [["padding-block", ".25rem"]]], [".py-\\[0\\.28rem\\]", null, 4, [["padding-block", ".28rem"]]], [".py-\\[0\\.32rem\\]", null, 4, [["padding-block", ".32rem"]]], [".py-\\[0\\.35rem\\]", null, 4, [["padding-block", ".35rem"]]], [".py-\\[0\\.42rem\\]", null, 4, [["padding-block", ".42rem"]]], [".py-\\[0\\.45rem\\]", null, 4, [["padding-block", ".45rem"]]], [".py-\\[0\\.55rem\\]", null, 4, [["padding-block", ".55rem"]]], [".py-\\[0\\.65rem\\]", null, 4, [["padding-block", ".65rem"]]], [".py-\\[2px\\]", null, 4, [["padding-block", "2px"]]], [".py-\\[3px\\]", null, 4, [["padding-block", "3px"]]], [".py-\\[6px\\]", null, 4, [["padding-block", "6px"]]], [".py-px", null, 4, [["padding-block", "1px"]]], [".pt-1", null, 4, [["padding-top", "var(--spacing)"]]], [".pt-2", null, 4, [["padding-top", "calc(var(--spacing) * 2)"]]], [".pt-2\\.5", null, 4, [["padding-top", "calc(var(--spacing) * 2.5)"]]], [".pt-3", null, 4, [["padding-top", "calc(var(--spacing) * 3)"]]], [".pt-4", null, 4, [["padding-top", "calc(var(--spacing) * 4)"]]], [".pt-5", null, 4, [["padding-top", "calc(var(--spacing) * 5)"]]], [".pt-\\[0\\.2rem\\]", null, 4, [["padding-top", ".2rem"]]], [".pt-\\[0\\.4rem\\]", null, 4, [["padding-top", ".4rem"]]], [".pt-\\[0\\.6rem\\]", null, 4, [["padding-top", ".6rem"]]], [".pt-\\[0\\.85rem\\]", null, 4, [["padding-top", ".85rem"]]], [".pt-\\[2px\\]", null, 4, [["padding-top", "2px"]]], [".pt-\\[12vh\\]", null, 4, [["padding-top", "12vh"]]], [".pt-\\[max\\(0\\.5rem\\,env\\(safe-area-inset-top\\)\\)\\]", null, 4, [["padding-top", "max(.5rem, env(safe-area-inset-top))"]]], [".pr-0\\.5", null, 4, [["padding-right", "calc(var(--spacing) * .5)"]]], [".pr-1", null, 4, [["padding-right", "var(--spacing)"]]], [".pr-1\\.5", null, 4, [["padding-right", "calc(var(--spacing) * 1.5)"]]], [".pr-2", null, 4, [["padding-right", "calc(var(--spacing) * 2)"]]], [".pr-3", null, 4, [["padding-right", "calc(var(--spacing) * 3)"]]], [".pr-12", null, 4, [["padding-right", "calc(var(--spacing) * 12)"]]], [".pr-\\[0\\.3rem\\]", null, 4, [["padding-right", ".3rem"]]], [".pr-\\[0\\.6rem\\]", null, 4, [["padding-right", ".6rem"]]], [".pr-\\[0\\.35rem\\]", null, 4, [["padding-right", ".35rem"]]], [".pr-\\[0\\.45rem\\]", null, 4, [["padding-right", ".45rem"]]], [".pr-\\[0\\.55rem\\]", null, 4, [["padding-right", ".55rem"]]], [".pr-\\[1\\.6rem\\]", null, 4, [["padding-right", "1.6rem"]]], [".pr-\\[3px\\]", null, 4, [["padding-right", "3px"]]], [".pr-\\[env\\(safe-area-inset-right\\)\\]", null, 4, [["padding-right", "env(safe-area-inset-right)"]]], [".pr-\\[max\\(0\\.5rem\\,env\\(safe-area-inset-right\\)\\)\\]", null, 4, [["padding-right", "max(.5rem, env(safe-area-inset-right))"]]], [".pb-1", null, 4, [["padding-bottom", "var(--spacing)"]]], [".pb-2", null, 4, [["padding-bottom", "calc(var(--spacing) * 2)"]]], [".pb-3", null, 4, [["padding-bottom", "calc(var(--spacing) * 3)"]]], [".pb-4", null, 4, [["padding-bottom", "calc(var(--spacing) * 4)"]]], [".pb-8", null, 4, [["padding-bottom", "calc(var(--spacing) * 8)"]]], [".pb-\\[0\\.3rem\\]", null, 4, [["padding-bottom", ".3rem"]]], [".pb-\\[0\\.4rem\\]", null, 4, [["padding-bottom", ".4rem"]]], [".pb-\\[0\\.25rem\\]", null, 4, [["padding-bottom", ".25rem"]]], [".pb-\\[0\\.55rem\\]", null, 4, [["padding-bottom", ".55rem"]]], [".pb-\\[1\\.4rem\\]", null, 4, [["padding-bottom", "1.4rem"]]], [".pb-\\[calc\\(1\\.5rem\\+env\\(safe-area-inset-bottom\\)\\)\\]", null, 4, [["padding-bottom", "calc(1.5rem + env(safe-area-inset-bottom))"]]], [".pb-\\[calc\\(1rem\\+env\\(safe-area-inset-bottom\\)\\)\\]", null, 4, [["padding-bottom", "calc(1rem + env(safe-area-inset-bottom))"]]], [".pb-\\[env\\(safe-area-inset-bottom\\)\\]", null, 4, [["padding-bottom", "env(safe-area-inset-bottom)"]]], [".pb-\\[max\\(0\\.5rem\\,env\\(safe-area-inset-bottom\\)\\)\\]", null, 4, [["padding-bottom", "max(.5rem, env(safe-area-inset-bottom))"]]], [".pl-1", null, 4, [["padding-left", "var(--spacing)"]]], [".pl-1\\.5", null, 4, [["padding-left", "calc(var(--spacing) * 1.5)"]]], [".pl-2", null, 4, [["padding-left", "calc(var(--spacing) * 2)"]]], [".pl-3", null, 4, [["padding-left", "calc(var(--spacing) * 3)"]]], [".pl-4", null, 4, [["padding-left", "calc(var(--spacing) * 4)"]]], [".pl-5", null, 4, [["padding-left", "calc(var(--spacing) * 5)"]]], [".pl-6", null, 4, [["padding-left", "calc(var(--spacing) * 6)"]]], [".pl-\\[0\\.4rem\\]", null, 4, [["padding-left", ".4rem"]]], [".pl-\\[0\\.45rem\\]", null, 4, [["padding-left", ".45rem"]]], [".pl-\\[0\\.75rem\\]", null, 4, [["padding-left", ".75rem"]]], [".pl-\\[0\\.85rem\\]", null, 4, [["padding-left", ".85rem"]]], [".pl-\\[1\\.2rem\\]", null, 4, [["padding-left", "1.2rem"]]], [".pl-\\[1\\.55rem\\]", null, 4, [["padding-left", "1.55rem"]]], [".pl-\\[1\\.075rem\\]", null, 4, [["padding-left", "1.075rem"]]], [".pl-\\[1\\.525rem\\]", null, 4, [["padding-left", "1.525rem"]]], [".pl-\\[1\\.875rem\\]", null, 4, [["padding-left", "1.875rem"]]], [".pl-\\[85px\\]", null, 4, [["padding-left", "85px"]]], [".pl-\\[max\\(0\\.5rem\\,env\\(safe-area-inset-left\\)\\)\\]", null, 4, [["padding-left", "max(.5rem, env(safe-area-inset-left))"]]], [".pl-\\[max\\(0\\.25rem\\,env\\(safe-area-inset-left\\)\\)\\]", null, 4, [["padding-left", "max(.25rem, env(safe-area-inset-left))"]]], [".text-center", null, 4, [["text-align", "center"]]], [".text-left", null, 4, [["text-align", "left"]]], [".text-right", null, 4, [["text-align", "right"]]], [".\\[font-family\\:inherit\\]", null, 4, [["font-family", "inherit"]]], [".\\[font-family\\:ui-monospace\\,SFMono-Regular\\,Menlo\\,monospace\\]", null, 4, [["font-family", "ui-monospace, SFMono-Regular, Menlo, monospace"]]], [".\\[font-family\\:var\\(--font-mono\\)\\]", null, 4, [["font-family", "var(--font-mono)"]]], [".text-sm", null, 4, [["font-size", "var(--text-sm)"], ["line-height", "var(--tw-leading, var(--text-sm--line-height))"]]], [".text-xs", null, 4, [["font-size", "var(--text-xs)"], ["line-height", "var(--tw-leading, var(--text-xs--line-height))"]]], [".\\[font-size\\:inherit\\]", null, 4, [["font-size", "inherit"]]], [".text-\\[0\\.6rem\\]", null, 4, [["font-size", ".6rem"]]], [".text-\\[0\\.7rem\\]", null, 4, [["font-size", ".7rem"]]], [".text-\\[0\\.8em\\]", null, 4, [["font-size", ".8em"]]], [".text-\\[0\\.8rem\\]", null, 4, [["font-size", ".8rem"]]], [".text-\\[0\\.9em\\]", null, 4, [["font-size", ".9em"]]], [".text-\\[0\\.9rem\\]", null, 4, [["font-size", ".9rem"]]], [".text-\\[0\\.54rem\\]", null, 4, [["font-size", ".54rem"]]], [".text-\\[0\\.58rem\\]", null, 4, [["font-size", ".58rem"]]], [".text-\\[0\\.62rem\\]", null, 4, [["font-size", ".62rem"]]], [".text-\\[0\\.63rem\\]", null, 4, [["font-size", ".63rem"]]], [".text-\\[0\\.64rem\\]", null, 4, [["font-size", ".64rem"]]], [".text-\\[0\\.65rem\\]", null, 4, [["font-size", ".65rem"]]], [".text-\\[0\\.66rem\\]", null, 4, [["font-size", ".66rem"]]], [".text-\\[0\\.66rem\\]\\!", null, 4, [["font-size", ".66rem", 1]]], [".text-\\[0\\.68rem\\]", null, 4, [["font-size", ".68rem"]]], [".text-\\[0\\.72rem\\]", null, 4, [["font-size", ".72rem"]]], [".text-\\[0\\.74rem\\]", null, 4, [["font-size", ".74rem"]]], [".text-\\[0\\.75rem\\]", null, 4, [["font-size", ".75rem"]]], [".text-\\[0\\.76rem\\]", null, 4, [["font-size", ".76rem"]]], [".text-\\[0\\.77rem\\]", null, 4, [["font-size", ".77rem"]]], [".text-\\[0\\.78rem\\]", null, 4, [["font-size", ".78rem"]]], [".text-\\[0\\.82rem\\]", null, 4, [["font-size", ".82rem"]]], [".text-\\[0\\.83rem\\]", null, 4, [["font-size", ".83rem"]]], [".text-\\[0\\.85rem\\]", null, 4, [["font-size", ".85rem"]]], [".text-\\[0\\.88rem\\]", null, 4, [["font-size", ".88rem"]]], [".text-\\[0\\.95rem\\]", null, 4, [["font-size", ".95rem"]]], [".text-\\[0\\.875rem\\]", null, 4, [["font-size", ".875rem"]]], [".text-\\[1\\.1rem\\]", null, 4, [["font-size", "1.1rem"]]], [".text-\\[1\\.4em\\]", null, 4, [["font-size", "1.4em"]]], [".text-\\[1\\.6rem\\]", null, 4, [["font-size", "1.6rem"]]], [".text-\\[1\\.15rem\\]", null, 4, [["font-size", "1.15rem"]]], [".text-\\[1rem\\]", null, 4, [["font-size", "1rem"]]], [".text-\\[2\\.4rem\\]", null, 4, [["font-size", "2.4rem"]]], [".text-\\[9px\\]", null, 4, [["font-size", "9px"]]], [".text-\\[10px\\]", null, 4, [["font-size", "10px"]]], [".text-\\[11px\\]", null, 4, [["font-size", "11px"]]], [".text-\\[12\\.5px\\]", null, 4, [["font-size", "12.5px"]]], [".text-\\[12px\\]", null, 4, [["font-size", "12px"]]], [".text-\\[13px\\]", null, 4, [["font-size", "13px"]]], [".text-\\[14px\\]", null, 4, [["font-size", "14px"]]], [".text-\\[calc\\(0\\.95rem\\*var\\(--chat-font-scale\\,1\\)\\)\\]", null, 4, [["font-size", "calc(.95rem * var(--chat-font-scale, 1))"]]], [".text-\\[length\\:calc\\(11px\\*var\\(--zoom\\,1\\)\\)\\]", null, 4, [["font-size", "calc(11px * var(--zoom, 1))"]]], [".text-\\[length\\:calc\\(13px\\*var\\(--zoom\\,1\\)\\)\\]", null, 4, [["font-size", "calc(13px * var(--zoom, 1))"]]], [".leading-4", null, 4, [["--tw-leading", "calc(var(--spacing) * 4)"], ["line-height", "calc(var(--spacing) * 4)"]]], [".leading-\\[1\\.1\\]", null, 4, [["--tw-leading", "1.1"], ["line-height", "1.1"]]], [".leading-\\[1\\.2\\]", null, 4, [["--tw-leading", "1.2"], ["line-height", "1.2"]]], [".leading-\\[1\\.3\\]", null, 4, [["--tw-leading", "1.3"], ["line-height", "1.3"]]], [".leading-\\[1\\.4\\]", null, 4, [["--tw-leading", "1.4"], ["line-height", "1.4"]]], [".leading-\\[1\\.5\\]", null, 4, [["--tw-leading", "1.5"], ["line-height", "1.5"]]], [".leading-\\[1\\.6\\]", null, 4, [["--tw-leading", "1.6"], ["line-height", "1.6"]]], [".leading-\\[1\\.45\\]", null, 4, [["--tw-leading", "1.45"], ["line-height", "1.45"]]], [".leading-\\[18px\\]", null, 4, [["--tw-leading", "18px"], ["line-height", "18px"]]], [".leading-none", null, 4, [["--tw-leading", "1"], ["line-height", "1"]]], [".leading-relaxed", null, 4, [["--tw-leading", "var(--leading-relaxed)"], ["line-height", "var(--leading-relaxed)"]]], [".leading-tight", null, 4, [["--tw-leading", "var(--leading-tight)"], ["line-height", "var(--leading-tight)"]]], [".\\[line-height\\:inherit\\]", null, 4, [["line-height", "inherit"]]], [".font-bold", null, 4, [["--tw-font-weight", "var(--font-weight-bold)"], ["font-weight", "var(--font-weight-bold)"]]], [".font-medium", null, 4, [["--tw-font-weight", "var(--font-weight-medium)"], ["font-weight", "var(--font-weight-medium)"]]], [".font-normal", null, 4, [["--tw-font-weight", "var(--font-weight-normal)"], ["font-weight", "var(--font-weight-normal)"]]], [".font-semibold", null, 4, [["--tw-font-weight", "var(--font-weight-semibold)"], ["font-weight", "var(--font-weight-semibold)"]]], [".\\[font-weight\\:inherit\\]", null, 4, [["font-weight", "inherit"]]], [".tracking-\\[-0\\.02em\\]", null, 4, [["--tw-tracking", "-.02em"], ["letter-spacing", "-.02em"]]], [".tracking-\\[0\\.03em\\]", null, 4, [["--tw-tracking", ".03em"], ["letter-spacing", ".03em"]]], [".tracking-\\[0\\.04em\\]", null, 4, [["--tw-tracking", ".04em"], ["letter-spacing", ".04em"]]], [".tracking-\\[0\\.06em\\]", null, 4, [["--tw-tracking", ".06em"], ["letter-spacing", ".06em"]]], [".tracking-\\[0\\.08em\\]", null, 4, [["--tw-tracking", ".08em"], ["letter-spacing", ".08em"]]], [".tracking-\\[0\\.09em\\]", null, 4, [["--tw-tracking", ".09em"], ["letter-spacing", ".09em"]]], [".tracking-\\[0\\.22em\\]", null, 4, [["--tw-tracking", ".22em"], ["letter-spacing", ".22em"]]], [".tracking-normal", null, 4, [["--tw-tracking", "var(--tracking-normal)"], ["letter-spacing", "var(--tracking-normal)"]]], [".tracking-wide", null, 4, [["--tw-tracking", "var(--tracking-wide)"], ["letter-spacing", "var(--tracking-wide)"]]], [".\\[overflow-wrap\\:anywhere\\]", null, 4, [["overflow-wrap", "anywhere"]]], [".break-words", null, 4, [["overflow-wrap", "break-word"]]], [".\\[word-break\\:break-word\\]", null, 4, [["word-break", "break-word"]]], [".text-ellipsis", null, 4, [["text-overflow", "ellipsis"]]], [".whitespace-normal", null, 4, [["white-space", "normal"]]], [".whitespace-nowrap", null, 4, [["white-space", "nowrap"]]], [".whitespace-pre", null, 4, [["white-space", "pre"]]], [".whitespace-pre-wrap", null, 4, [["white-space", "pre-wrap"]]], [".\\[tab-size\\:2\\]", null, 4, [["tab-size", "2"]]], [".text-\\[color\\:var\\(--git-muted\\)\\]", null, 4, [["color", "var(--git-muted)"]]], [".text-\\[var\\(--subtext-0\\)\\]", null, 4, [["color", "var(--subtext-0)"]]], [".text-\\[var\\(--text\\)\\]", null, 4, [["color", "var(--text)"]]], [".text-accent", null, 4, [["color", "var(--accent)"]]], [".text-blue", null, 4, [["color", "var(--blue)"]]], [".text-current", null, 4, [["color", "currentColor"]]], [".text-fg", null, 4, [["color", "var(--text)"]]], [".text-green", null, 4, [["color", "var(--green)"]]], [".text-inherit", null, 4, [["color", "inherit"]]], [".text-mauve", null, 4, [["color", "var(--mauve)"]]], [".text-overlay-0", null, 4, [["color", "var(--overlay-0)"]]], [".text-overlay-1", null, 4, [["color", "var(--overlay-1)"]]], [".text-panel-bg", null, 4, [["color", "var(--panel-bg)"]]], [".text-peach", null, 4, [["color", "var(--peach)"]]], [".text-red", null, 4, [["color", "var(--red)"]]], [".text-red\\!", null, 4, [["color", "var(--red)", 1]]], [".text-subtext-0", null, 4, [["color", "var(--subtext-0)"]]], [".text-yellow", null, 4, [["color", "var(--yellow)"]]], [".capitalize", null, 4, [["text-transform", "capitalize"]]], [".normal-case", null, 4, [["text-transform", "none"]]], [".uppercase", null, 4, [["text-transform", "uppercase"]]], [".italic", null, 4, [["font-style", "italic"]]], [".not-italic", null, 4, [["font-style", "normal"]]], [".tabular-nums", null, 4, [["--tw-numeric-spacing", "tabular-nums"], ["font-variant-numeric", "var(--tw-ordinal, ) var(--tw-slashed-zero, ) var(--tw-numeric-figure, ) var(--tw-numeric-spacing, ) var(--tw-numeric-fraction, )"]]], [".line-through", null, 4, [["text-decoration-line", "line-through"]]], [".no-underline", null, 4, [["text-decoration-line", "none"]]], [".underline", null, 4, [["text-decoration-line", "underline"]]], [".opacity-0", null, 4, [["opacity", "0"]]], [".opacity-40", null, 4, [["opacity", ".4"]]], [".opacity-60", null, 4, [["opacity", ".6"]]], [".opacity-70", null, 4, [["opacity", ".7"]]], [".opacity-75", null, 4, [["opacity", ".75"]]], [".opacity-80", null, 4, [["opacity", ".8"]]], [".opacity-100", null, 4, [["opacity", "1"]]], [".opacity-\\[0\\.72\\]", null, 4, [["opacity", ".72"]]], [".shadow", null, 4, [["--tw-shadow", "0 1px 3px 0 var(--tw-shadow-color, #0000001a), 0 1px 2px -1px var(--tw-shadow-color, #0000001a)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_1px_4px_rgba\\(0\\,0\\,0\\,0\\.4\\)\\]", null, 4, [["--tw-shadow", "0 1px 4px var(--tw-shadow-color, #0006)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_2px_8px_rgba\\(0\\,0\\,0\\,0\\.4\\)\\]", null, 4, [["--tw-shadow", "0 2px 8px var(--tw-shadow-color, #0006)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_2px_8px_rgba\\(0\\,0\\,0\\,0\\.35\\)\\]", null, 4, [["--tw-shadow", "0 2px 8px var(--tw-shadow-color, #00000059)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_6px_20px_rgba\\(0\\,0\\,0\\,0\\.3\\)\\]", null, 4, [["--tw-shadow", "0 6px 20px var(--tw-shadow-color, #0000004d)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_8px_24px_rgba\\(0\\,0\\,0\\,0\\.35\\)\\]", null, 4, [["--tw-shadow", "0 8px 24px var(--tw-shadow-color, #00000059)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_8px_24px_rgba\\(0\\,0\\,0\\,0\\.45\\)\\]", null, 4, [["--tw-shadow", "0 8px 24px var(--tw-shadow-color, #00000073)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_8px_32px_rgba\\(0\\,0\\,0\\,0\\.5\\)\\]", null, 4, [["--tw-shadow", "0 8px 32px var(--tw-shadow-color, #00000080)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_12px_32px_rgba\\(0\\,0\\,0\\,0\\.5\\)\\]", null, 4, [["--tw-shadow", "0 12px 32px var(--tw-shadow-color, #00000080)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_16px_48px_rgba\\(0\\,0\\,0\\,0\\.55\\)\\]", null, 4, [["--tw-shadow", "0 16px 48px var(--tw-shadow-color, #0000008c)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[inset_0_0_24px_var\\(--accent\\)\\]", null, 4, [["--tw-shadow", "inset 0 0 24px var(--tw-shadow-color, var(--accent))"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-lg", null, 4, [["--tw-shadow", "0 10px 15px -3px var(--tw-shadow-color, #0000001a), 0 4px 6px -4px var(--tw-shadow-color, #0000001a)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".ring", null, 4, [["--tw-ring-shadow", "var(--tw-ring-inset, ) 0 0 0 calc(1px + var(--tw-ring-offset-width)) var(--tw-ring-color, currentcolor)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".\\[box-shadow\\:0_1px_2px_rgba\\(0\\,0\\,0\\,0\\.3\\)\\]", null, 4, [["box-shadow", "0 1px 2px #0000004d"]]], [".\\[box-shadow\\:0_4px_14px_rgba\\(0\\,0\\,0\\,0\\.35\\)\\]", null, 4, [["box-shadow", "0 4px 14px #00000059"]]], [".\\[box-shadow\\:none\\]", null, 4, [["box-shadow", "none"]]], [".\\[outline\\:none\\]", null, 4, [["outline", "none"]]], [".outline, .outline-1", null, 4, [["outline-style", "var(--tw-outline-style)"], ["outline-width", "1px"]]], [".outline-2", null, 4, [["outline-style", "var(--tw-outline-style)"], ["outline-width", "2px"]]], [".outline-accent", null, 4, [["outline-color", "var(--accent)"]]], [".blur", null, 4, [["--tw-blur", "blur(8px)"], ["filter", "var(--tw-blur, ) var(--tw-brightness, ) var(--tw-contrast, ) var(--tw-grayscale, ) var(--tw-hue-rotate, ) var(--tw-invert, ) var(--tw-saturate, ) var(--tw-sepia, ) var(--tw-drop-shadow, )"]]], [".\\!filter", null, 4, [["filter", "var(--tw-blur, ) var(--tw-brightness, ) var(--tw-contrast, ) var(--tw-grayscale, ) var(--tw-hue-rotate, ) var(--tw-invert, ) var(--tw-saturate, ) var(--tw-sepia, ) var(--tw-drop-shadow, )", 1]]], [".\\[filter\\:drop-shadow\\(0_6px_10px_rgba\\(0\\,0\\,0\\,0\\.45\\)\\)\\]", null, 4, [["filter", "drop-shadow(0 6px 10px #00000073)"]]], [".filter", null, 4, [["filter", "var(--tw-blur, ) var(--tw-brightness, ) var(--tw-contrast, ) var(--tw-grayscale, ) var(--tw-hue-rotate, ) var(--tw-invert, ) var(--tw-saturate, ) var(--tw-sepia, ) var(--tw-drop-shadow, )"]]], [".backdrop-blur-xl", null, 4, [["--tw-backdrop-blur", "blur(var(--blur-xl))"], ["-webkit-backdrop-filter", "var(--tw-backdrop-blur, ) var(--tw-backdrop-brightness, ) var(--tw-backdrop-contrast, ) var(--tw-backdrop-grayscale, ) var(--tw-backdrop-hue-rotate, ) var(--tw-backdrop-invert, ) var(--tw-backdrop-opacity, ) var(--tw-backdrop-saturate, ) var(--tw-backdrop-sepia, )"], ["backdrop-filter", "var(--tw-backdrop-blur, ) var(--tw-backdrop-brightness, ) var(--tw-backdrop-contrast, ) var(--tw-backdrop-grayscale, ) var(--tw-backdrop-hue-rotate, ) var(--tw-backdrop-invert, ) var(--tw-backdrop-opacity, ) var(--tw-backdrop-saturate, ) var(--tw-backdrop-sepia, )"]]], [".backdrop-saturate-150", null, 4, [["--tw-backdrop-saturate", "saturate(150%)"], ["-webkit-backdrop-filter", "var(--tw-backdrop-blur, ) var(--tw-backdrop-brightness, ) var(--tw-backdrop-contrast, ) var(--tw-backdrop-grayscale, ) var(--tw-backdrop-hue-rotate, ) var(--tw-backdrop-invert, ) var(--tw-backdrop-opacity, ) var(--tw-backdrop-saturate, ) var(--tw-backdrop-sepia, )"], ["backdrop-filter", "var(--tw-backdrop-blur, ) var(--tw-backdrop-brightness, ) var(--tw-backdrop-contrast, ) var(--tw-backdrop-grayscale, ) var(--tw-backdrop-hue-rotate, ) var(--tw-backdrop-invert, ) var(--tw-backdrop-opacity, ) var(--tw-backdrop-saturate, ) var(--tw-backdrop-sepia, )"]]], [".transition", null, 4, [["transition-property", "color, background-color, border-color, outline-color, text-decoration-color, fill, stroke, --tw-gradient-from, --tw-gradient-via, --tw-gradient-to, opacity, box-shadow, transform, translate, scale, rotate, filter, -webkit-backdrop-filter, backdrop-filter, display, content-visibility, overlay, pointer-events"], ["transition-timing-function", "var(--tw-ease, var(--default-transition-timing-function))"], ["transition-duration", "var(--tw-duration, var(--default-transition-duration))"]]], [".transition-\\[left\\,top\\,width\\,height\\]", null, 4, [["transition-property", "left, top, width, height"], ["transition-timing-function", "var(--tw-ease, var(--default-transition-timing-function))"], ["transition-duration", "var(--tw-duration, var(--default-transition-duration))"]]], [".transition-opacity", null, 4, [["transition-property", "opacity"], ["transition-timing-function", "var(--tw-ease, var(--default-transition-timing-function))"], ["transition-duration", "var(--tw-duration, var(--default-transition-duration))"]]], [".duration-150", null, 4, [["--tw-duration", ".15s"], ["transition-duration", ".15s"]]], [".ease-out", null, 4, [["--tw-ease", "var(--ease-out)"], ["transition-timing-function", "var(--ease-out)"]]], [".outline-none", null, 4, [["--tw-outline-style", "none"], ["outline-style", "none"]]], [".outline-solid", null, 4, [["--tw-outline-style", "solid"], ["outline-style", "solid"]]], [".select-none", null, 4, [["-webkit-user-select", "none"], ["user-select", "none"]]], [".select-text", null, 4, [["-webkit-user-select", "text"], ["user-select", "text"]]], [".\\[--panel-bg\\:var\\(--surface-dim\\)\\]", null, 4, [["--panel-bg", "var(--surface-dim)"]]], [".\\[--picker-bg\\:var\\(--surface-0\\)\\]", null, 4, [["--picker-bg", "var(--surface-0)"]]], [".\\[--radius\\:var\\(--radius-pane\\)\\]", null, 4, [["--radius", "var(--radius-pane)"]]], [".\\[--workspace-tools-bg\\:transparent\\]", null, 4, [["--workspace-tools-bg", "transparent"]]], [".\\[-webkit-box-orient\\:vertical\\]", null, 4, [["-webkit-box-orient", "vertical"]]], [".\\[-webkit-line-clamp\\:3\\]", null, 4, [["-webkit-line-clamp", "3"]]], [".\\[-webkit-touch-callout\\:none\\]", null, 4, [["-webkit-touch-callout", "none"]]], [".\\[background\\:none\\]", null, 4, [["background", "none"]]], [".\\[border-right\\:1px_solid_var\\(--git-border\\)\\]", null, 4, [["border-right", "1px solid var(--git-border)"]]], [".\\[border-top\\:1px_solid_var\\(--git-border\\)\\]", null, 4, [["border-top", "1px solid var(--git-border)"]]], [".\\[border\\:0\\]", null, 4, [["border", "0"]]], [".\\[border\\:none\\]", null, 4, [["border", "none"]]], [".\\[font\\:1\\.15rem\\/1_var\\(--font-mono\\)\\]", null, 4, [["font", "1.15rem/1 var(--font-mono)"]]], [".\\[font\\:1rem\\/1\\.2_var\\(--font-mono\\)\\]", null, 4, [["font", "1rem/1.2 var(--font-mono)"]]], [".\\[font\\:inherit\\]", null, 4, [["font", "inherit"]]], [".\\[transition\\:background_0\\.1s_ease\\]", null, 4, [["transition", "background .1s"]]], [".\\[transition\\:background_0\\.12s_ease\\]", null, 4, [["transition", "background .12s"]]], [".\\[transition\\:background_0\\.15s_ease\\]", null, 4, [["transition", "background .15s"]]], [".\\[transition\\:color_0\\.1s_ease\\,background_0\\.1s_ease\\]", null, 4, [["transition", "color .1s, background .1s"]]], [".\\[transition\\:color_0\\.12s_ease\\,background_0\\.12s_ease\\]", null, 4, [["transition", "color .12s, background .12s"]]], [".\\[transition\\:color_0\\.15s_ease\\]", null, 4, [["transition", "color .15s"]]], [".\\[transition\\:opacity_0\\.12s_ease\\]", null, 4, [["transition", "opacity .12s"]]], [".\\[transition\\:transform_0\\.15s_ease\\,background_0\\.15s_ease\\]", null, 4, [["transition", "transform .15s, background .15s"]]], [".not-has-\\[\\[data-setting-row\\]\\]\\:hidden:not(:has([data-setting-row]))", null, 4, [["display", "none"]]], [".group-focus-within\\:flex:is(:where(.group):focus-within *)", null, 4, [["display", "flex"]]], [".group-focus-within\\/row\\:opacity-100:is(:where(.group\\/row):focus-within *)", null, 4, [["opacity", "1"]]], [".group-hover\\:flex:is(:where(.group):hover *)", null, 4, [["display", "flex"]]], [".group-hover\\:opacity-100:is(:where(.group):hover *)", null, 4, [["opacity", "1"]]], [".group-hover\\/line\\:opacity-90:is(:where(.group\\/line):hover *)", null, 4, [["opacity", ".9"]]], [".group-hover\\/ph\\:opacity-100:is(:where(.group\\/ph):hover *), .group-hover\\/row\\:opacity-100:is(:where(.group\\/row):hover *)", null, 4, [["opacity", "1"]]], [".group-hover\\/submenu\\:block:is(:where(.group\\/submenu):hover *)", null, 4, [["display", "block"]]], [".group-focus\\/tree\\:ring-1:is(:where(.group\\/tree):focus *)", null, 4, [["--tw-ring-shadow", "var(--tw-ring-inset, ) 0 0 0 calc(1px + var(--tw-ring-offset-width)) var(--tw-ring-color, currentcolor)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".group-focus\\/tree\\:ring-overlay-1:is(:where(.group\\/tree):focus *)", null, 4, [["--tw-ring-color", "var(--overlay-1)"]]], [".group-focus\\/tree\\:ring-inset:is(:where(.group\\/tree):focus *)", null, 4, [["--tw-ring-inset", "inset"]]], ['.group-aria-checked\\:\\[transform\\:translateX\\(1\\.1rem\\)\\]:is(:where(.group)[aria-checked="true"] *)', null, 4, [["transform", "translateX(1.1rem)"]]], ['.group-aria-checked\\:border-accent:is(:where(.group)[aria-checked="true"] *)', null, 4, [["border-color", "var(--accent)"]]], ['.group-aria-checked\\:bg-accent:is(:where(.group)[aria-checked="true"] *)', null, 4, [["background-color", "var(--accent)"]]], ['.group-aria-checked\\:bg-panel-bg:is(:where(.group)[aria-checked="true"] *)', null, 4, [["background-color", "var(--panel-bg)"]]], ['.group-aria-checked\\:text-accent:is(:where(.group)[aria-checked="true"] *), .group-aria-\\[checked\\=false\\]\\:text-accent:is(:where(.group)[aria-checked="false"] *)', null, 4, [["color", "var(--accent)"]]], [".placeholder\\:text-subtext-0::placeholder", null, 4, [["color", "var(--subtext-0)"]]], [".before\\:absolute:before", null, 4, [["content", "var(--tw-content)"], ["position", "absolute"]]], [".before\\:top-\\[0\\.15rem\\]:before", null, 4, [["content", "var(--tw-content)"], ["top", ".15rem"]]], [".before\\:left-\\[0\\.15rem\\]:before", null, 4, [["content", "var(--tw-content)"], ["left", ".15rem"]]], [".before\\:h-\\[0\\.95rem\\]:before", null, 4, [["content", "var(--tw-content)"], ["height", ".95rem"]]], [".before\\:w-\\[0\\.95rem\\]:before", null, 4, [["content", "var(--tw-content)"], ["width", ".95rem"]]], [".before\\:rounded-full:before", null, 4, [["content", "var(--tw-content)"], ["border-radius", "3.40282e38px"]]], [".before\\:bg-fg:before", null, 4, [["content", "var(--tw-content)"], ["background-color", "var(--text)"]]], [".before\\:content-\\[\\'\\'\\]:before", null, 4, [["--tw-content", '""'], ["content", "var(--tw-content)"]]], [".before\\:\\[transition\\:transform_0\\.12s_ease\\]:before", null, 4, [["content", "var(--tw-content)"], ["transition", "transform .12s"]]], [".after\\:absolute:after", null, 4, [["content", "var(--tw-content)"], ["position", "absolute"]]], [".after\\:inset-0:after", null, 4, [["content", "var(--tw-content)"], ["inset", "0"]]], [".after\\:inset-x-0:after", null, 4, [["content", "var(--tw-content)"], ["inset-inline", "0"]]], [".after\\:-inset-y-2:after", null, 4, [["content", "var(--tw-content)"], ["inset-block", "calc(var(--spacing) * -2)"]]], [".after\\:m-auto:after", null, 4, [["content", "var(--tw-content)"], ["margin", "auto"]]], [".after\\:h-8:after", null, 4, [["content", "var(--tw-content)"], ["height", "calc(var(--spacing) * 8)"]]], [".after\\:h-12:after", null, 4, [["content", "var(--tw-content)"], ["height", "calc(var(--spacing) * 12)"]]], [".after\\:h-\\[3px\\]:after", null, 4, [["content", "var(--tw-content)"], ["height", "3px"]]], [".after\\:w-8:after", null, 4, [["content", "var(--tw-content)"], ["width", "calc(var(--spacing) * 8)"]]], [".after\\:w-\\[3px\\]:after", null, 4, [["content", "var(--tw-content)"], ["width", "3px"]]], [".after\\:rounded-full:after", null, 4, [["content", "var(--tw-content)"], ["border-radius", "3.40282e38px"]]], [".after\\:bg-transparent:after", null, 4, [["content", "var(--tw-content)"], ["background-color", "#0000"]]], [".after\\:content-\\[\\'\\'\\]:after", null, 4, [["--tw-content", '""'], ["content", "var(--tw-content)"]]], [".last\\:border-b-0:last-child", null, 4, [["border-bottom-style", "var(--tw-border-style)"], ["border-bottom-width", "0"]]], [".checked\\:bg-accent:checked", null, 4, [["background-color", "var(--accent)"]]], [".checked\\:before\\:translate-x-\\[1rem\\]:checked:before", null, 4, [["content", "var(--tw-content)"], ["--tw-translate-x", "1rem"], ["translate", "var(--tw-translate-x) var(--tw-translate-y)"]]], [".checked\\:before\\:bg-panel-bg:checked:before", null, 4, [["content", "var(--tw-content)"], ["background-color", "var(--panel-bg)"]]], [".focus-within\\:bg-surface-1:focus-within", null, 4, [["background-color", "var(--surface-1)"]]], [".focus-within\\:outline:focus-within, .focus-within\\:outline-1:focus-within", null, 4, [["outline-style", "var(--tw-outline-style)"], ["outline-width", "1px"]]], [".focus-within\\:outline-fg:focus-within", null, 4, [["outline-color", "var(--text)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_12\\%\\,transparent\\)\\]:hover", null, 4, [["background-color", "var(--accent)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_12\\%\\,transparent\\)\\]:hover", null, 4, [["background-color", "color-mix(in srgb,var(--accent) 12%,transparent)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_15\\%\\,transparent\\)\\]:hover", null, 4, [["background-color", "var(--accent)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_15\\%\\,transparent\\)\\]:hover", null, 4, [["background-color", "color-mix(in srgb,var(--accent) 15%,transparent)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--text\\)_10\\%\\,var\\(--panel-bg\\)\\)\\]:hover", null, 4, [["background-color", "var(--text)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--text\\)_10\\%\\,var\\(--panel-bg\\)\\)\\]:hover", null, 4, [["background-color", "color-mix(in srgb,var(--text) 10%,var(--panel-bg))"]]], [".hover\\:bg-\\[var\\(--surface-0\\)\\]:hover", null, 4, [["background-color", "var(--surface-0)"]]], [".hover\\:bg-accent:hover", null, 4, [["background-color", "var(--accent)"]]], [".hover\\:bg-overlay-0:hover", null, 4, [["background-color", "var(--overlay-0)"]]], [".hover\\:bg-panel-bg:hover", null, 4, [["background-color", "var(--panel-bg)"]]], [".hover\\:bg-surface-0:hover", null, 4, [["background-color", "var(--surface-0)"]]], [".hover\\:bg-surface-1:hover", null, 4, [["background-color", "var(--surface-1)"]]], [".hover\\:bg-transparent:hover", null, 4, [["background-color", "#0000"]]], [".hover\\:text-accent:hover", null, 4, [["color", "var(--accent)"]]], [".hover\\:text-fg:hover", null, 4, [["color", "var(--text)"]]], [".hover\\:text-inherit:hover", null, 4, [["color", "inherit"]]], [".hover\\:text-overlay-0:hover", null, 4, [["color", "var(--overlay-0)"]]], [".hover\\:text-panel-bg:hover", null, 4, [["color", "var(--panel-bg)"]]], [".hover\\:text-red:hover", null, 4, [["color", "var(--red)"]]], [".hover\\:text-subtext-0:hover", null, 4, [["color", "var(--subtext-0)"]]], [".hover\\:text-yellow:hover", null, 4, [["color", "var(--yellow)"]]], [".hover\\:underline:hover", null, 4, [["text-decoration-line", "underline"]]], [".hover\\:opacity-60:hover", null, 4, [["opacity", ".6"]]], [".hover\\:opacity-100\\!:hover", null, 4, [["opacity", "1", 1]]], [".hover\\:opacity-\\[0\\.85\\]:hover", null, 4, [["opacity", ".85"]]], [".hover\\:brightness-110:hover", null, 4, [["--tw-brightness", "brightness(110%)"], ["filter", "var(--tw-blur, ) var(--tw-brightness, ) var(--tw-contrast, ) var(--tw-grayscale, ) var(--tw-hue-rotate, ) var(--tw-invert, ) var(--tw-saturate, ) var(--tw-sepia, ) var(--tw-drop-shadow, )"]]], [".hover\\:\\[filter\\:brightness\\(1\\.08\\)\\]:hover", null, 4, [["filter", "brightness(1.08)"]]], [".hover\\:after\\:bg-overlay-1:hover:after", null, 4, [["content", "var(--tw-content)"], ["background-color", "var(--overlay-1)"]]], [".focus\\:\\[outline\\:1px_solid_var\\(--accent\\)\\]:focus", null, 4, [["outline", "1px solid var(--accent)"]]], [".focus\\:outline-2:focus", null, 4, [["outline-style", "var(--tw-outline-style)"], ["outline-width", "2px"]]], [".focus\\:outline-none:focus", null, 4, [["--tw-outline-style", "none"], ["outline-style", "none"]]], [".focus-visible\\:bg-accent:focus-visible", null, 4, [["background-color", "var(--accent)"]]], [".focus-visible\\:bg-surface-0:focus-visible", null, 4, [["background-color", "var(--surface-0)"]]], [".focus-visible\\:bg-surface-1:focus-visible", null, 4, [["background-color", "var(--surface-1)"]]], [".focus-visible\\:text-accent:focus-visible", null, 4, [["color", "var(--accent)"]]], [".focus-visible\\:text-fg:focus-visible", null, 4, [["color", "var(--text)"]]], [".focus-visible\\:text-panel-bg:focus-visible", null, 4, [["color", "var(--panel-bg)"]]], [".focus-visible\\:text-red:focus-visible", null, 4, [["color", "var(--red)"]]], [".focus-visible\\:text-yellow:focus-visible", null, 4, [["color", "var(--yellow)"]]], [".focus-visible\\:underline:focus-visible", null, 4, [["text-decoration-line", "underline"]]], [".focus-visible\\:opacity-100:focus-visible", null, 4, [["opacity", "1"]]], [".focus-visible\\:\\[outline\\:1px_solid_var\\(--accent\\)\\]:focus-visible", null, 4, [["outline", "1px solid var(--accent)"]]], [".focus-visible\\:\\[outline\\:1px_solid_var\\(--overlay-1\\)\\]:focus-visible", null, 4, [["outline", "1px solid var(--overlay-1)"]]], [".focus-visible\\:\\[outline\\:2px_solid_var\\(--accent\\)\\]:focus-visible", null, 4, [["outline", "2px solid var(--accent)"]]], [".focus-visible\\:outline:focus-visible, .focus-visible\\:outline-1:focus-visible", null, 4, [["outline-style", "var(--tw-outline-style)"], ["outline-width", "1px"]]], [".focus-visible\\:\\[outline-offset\\:-1px\\]:focus-visible", null, 4, [["outline-offset", "-1px"]]], [".focus-visible\\:\\[outline-offset\\:-2px\\]:focus-visible", null, 4, [["outline-offset", "-2px"]]], [".focus-visible\\:\\[outline-offset\\:2px\\]:focus-visible", null, 4, [["outline-offset", "2px"]]], [".focus-visible\\:outline-offset-1:focus-visible", null, 4, [["outline-offset", "1px"]]], [".focus-visible\\:outline-fg:focus-visible", null, 4, [["outline-color", "var(--text)"]]], [".focus-visible\\:after\\:bg-accent:focus-visible:after", null, 4, [["content", "var(--tw-content)"], ["background-color", "var(--accent)"]]], [".active\\:cursor-grabbing:active", null, 4, [["cursor", "grabbing"]]], [".active\\:bg-surface-1:active", null, 4, [["background-color", "var(--surface-1)"]]], [".active\\:text-fg:active", null, 4, [["color", "var(--text)"]]], [".active\\:after\\:bg-accent:active:after", null, 4, [["content", "var(--tw-content)"], ["background-color", "var(--accent)"]]], [".enabled\\:hover\\:bg-surface-1:enabled:hover", null, 4, [["background-color", "var(--surface-1)"]]], [".enabled\\:hover\\:text-fg:enabled:hover", null, 4, [["color", "var(--text)"]]], [".disabled\\:cursor-default:disabled", null, 4, [["cursor", "default"]]], [".disabled\\:cursor-not-allowed:disabled", null, 4, [["cursor", "not-allowed"]]], [".disabled\\:cursor-not-allowed\\!:disabled", null, 4, [["cursor", "not-allowed", 1]]], [".disabled\\:cursor-wait:disabled", null, 4, [["cursor", "wait"]]], [".disabled\\:bg-transparent:disabled", null, 4, [["background-color", "#0000"]]], [".disabled\\:text-fg:disabled", null, 4, [["color", "var(--text)"]]], [".disabled\\:opacity-40:disabled", null, 4, [["opacity", ".4"]]], [".disabled\\:opacity-50:disabled", null, 4, [["opacity", ".5"]]], [".disabled\\:opacity-\\[0\\.45\\]:disabled", null, 4, [["opacity", ".45"]]], [".disabled\\:opacity-\\[0\\.55\\]:disabled", null, 4, [["opacity", ".55"]]], [":where(.app--mac-desktop) .in-\\[\\.app--mac-desktop\\]\\:pl-\\[84px\\]", null, 4, [["padding-left", "84px"]]], [".has-\\[\\:checked\\]\\:bg-surface-0:has(:checked)", null, 4, [["background-color", "var(--surface-0)"]]], [".has-\\[\\:checked\\]\\:text-fg:has(:checked)", null, 4, [["color", "var(--text)"]]], [".has-\\[\\:focus-visible\\]\\:bg-surface-0:has(:focus-visible)", null, 4, [["background-color", "var(--surface-0)"]]], ['.aria-disabled\\:cursor-not-allowed[aria-disabled="true"]', null, 4, [["cursor", "not-allowed"]]], ['.aria-disabled\\:opacity-40[aria-disabled="true"]', null, 4, [["opacity", ".4"]]], ['.aria-expanded\\:opacity-100[aria-expanded="true"]', null, 4, [["opacity", "1"]]], ['.aria-pressed\\:bg-surface-0[aria-pressed="true"]', null, 4, [["background-color", "var(--surface-0)"]]], ['.aria-pressed\\:text-fg[aria-pressed="true"]', null, 4, [["color", "var(--text)"]]], [".motion-reduce\\:animate-none", ["(prefers-reduced-motion: reduce)"], 4, [["animation", "none"]]], [".max-\\[900px\\]\\:hidden", ["not all and (min-width: 900px)"], 4, [["display", "none"]]], [".max-\\[700px\\]\\:hidden", ["not all and (min-width: 700px)"], 4, [["display", "none"]]], [".max-\\[700px\\]\\:size-11", ["not all and (min-width: 700px)"], 4, [["width", "calc(var(--spacing) * 11)"], ["height", "calc(var(--spacing) * 11)"]]], [".max-\\[700px\\]\\:h-9", ["not all and (min-width: 700px)"], 4, [["height", "calc(var(--spacing) * 9)"]]], [".max-\\[700px\\]\\:h-12", ["not all and (min-width: 700px)"], 4, [["height", "calc(var(--spacing) * 12)"]]], [".max-\\[700px\\]\\:min-h-9", ["not all and (min-width: 700px)"], 4, [["min-height", "calc(var(--spacing) * 9)"]]], [".max-\\[700px\\]\\:min-h-11", ["not all and (min-width: 700px)"], 4, [["min-height", "calc(var(--spacing) * 11)"]]], [".max-\\[700px\\]\\:w-24", ["not all and (min-width: 700px)"], 4, [["width", "calc(var(--spacing) * 24)"]]], [".max-\\[700px\\]\\:min-w-11", ["not all and (min-width: 700px)"], 4, [["min-width", "calc(var(--spacing) * 11)"]]], [".max-\\[700px\\]\\:flex-1", ["not all and (min-width: 700px)"], 4, [["flex", "1"]]], [".max-\\[700px\\]\\:flex-\\[1_1_6rem\\]", ["not all and (min-width: 700px)"], 4, [["flex", "6rem"]]], [".max-\\[700px\\]\\:flex-\\[1_1_100\\%\\]", ["not all and (min-width: 700px)"], 4, [["flex", "100%"]]], [".max-\\[700px\\]\\:basis-56", ["not all and (min-width: 700px)"], 4, [["flex-basis", "calc(var(--spacing) * 56)"]]], [".max-\\[700px\\]\\:basis-full", ["not all and (min-width: 700px)"], 4, [["flex-basis", "100%"]]], [".max-\\[700px\\]\\:flex-wrap", ["not all and (min-width: 700px)"], 4, [["flex-wrap", "wrap"]]], [".max-\\[700px\\]\\:gap-y-2", ["not all and (min-width: 700px)"], 4, [["row-gap", "calc(var(--spacing) * 2)"]]], [".min-\\[701px\\]\\:left-auto", ["(min-width: 701px)"], 4, [["left", "auto"]]], [".min-\\[701px\\]\\:my-\\[3px\\]", ["(min-width: 701px)"], 4, [["margin-block", "3px"]]], [".min-\\[701px\\]\\:block", ["(min-width: 701px)"], 4, [["display", "block"]]], [".min-\\[701px\\]\\:hidden", ["(min-width: 701px)"], 4, [["display", "none"]]], [".min-\\[701px\\]\\:min-h-6", ["(min-width: 701px)"], 4, [["min-height", "calc(var(--spacing) * 6)"]]], [".min-\\[701px\\]\\:w-80", ["(min-width: 701px)"], 4, [["width", "calc(var(--spacing) * 80)"]]], [".min-\\[701px\\]\\:rounded-ui", ["(min-width: 701px)"], 4, [["border-radius", "var(--radius)"]]], [".min-\\[701px\\]\\:px-3", ["(min-width: 701px)"], 4, [["padding-inline", "calc(var(--spacing) * 3)"]]], [".min-\\[701px\\]\\:px-4", ["(min-width: 701px)"], 4, [["padding-inline", "calc(var(--spacing) * 4)"]]], [".min-\\[701px\\]\\:pr-\\[3px\\]", ["(min-width: 701px)"], 4, [["padding-right", "3px"]]], [".min-\\[701px\\]\\:pl-4", ["(min-width: 701px)"], 4, [["padding-left", "calc(var(--spacing) * 4)"]]], [".min-\\[701px\\]\\:text-\\[0\\.62rem\\]", ["(min-width: 701px)"], 4, [["font-size", ".62rem"]]], [".min-\\[701px\\]\\:text-\\[12\\.5px\\]", ["(min-width: 701px)"], 4, [["font-size", "12.5px"]]], [".min-\\[701px\\]\\:text-\\[12px\\]", ["(min-width: 701px)"], 4, [["font-size", "12px"]]], [".min-\\[701px\\]\\:font-medium", ["(min-width: 701px)"], 4, [["--tw-font-weight", "var(--font-weight-medium)"], ["font-weight", "var(--font-weight-medium)"]]], [".min-\\[701px\\]\\:font-semibold", ["(min-width: 701px)"], 4, [["--tw-font-weight", "var(--font-weight-semibold)"], ["font-weight", "var(--font-weight-semibold)"]]], [".min-\\[701px\\]\\:tracking-\\[0\\.045em\\]", ["(min-width: 701px)"], 4, [["--tw-tracking", ".045em"], ["letter-spacing", ".045em"]]], [".min-\\[701px\\]\\:text-subtext-0", ["(min-width: 701px)"], 4, [["color", "var(--subtext-0)"]]], [".min-\\[701px\\]\\:uppercase", ["(min-width: 701px)"], 4, [["text-transform", "uppercase"]]], [".min-\\[900px\\]\\:inline", ["(min-width: 900px)"], 4, [["display", "inline"]]], [".pointer-coarse\\:opacity-100", ["(pointer: coarse)"], 4, [["opacity", "1"]]], [".\\[\\&_\\.mode-switch\\]\\:ml-0 .mode-switch", null, 4, [["margin-left", "0"]]], [".max-\\[700px\\]\\:\\[\\&_button\\]\\:min-h-11 button", ["not all and (min-width: 700px)"], 4, [["min-height", "calc(var(--spacing) * 11)"]]], [".\\[\\&_pre\\]\\:m-\\[0\\.2rem_0_0\\.3rem_1\\.2rem\\] pre", null, 4, [["margin", ".2rem 0 .3rem 1.2rem"]]], [".\\[\\&_pre\\]\\:max-h-72 pre", null, 4, [["max-height", "calc(var(--spacing) * 72)"]]], [".\\[\\&_pre\\]\\:overflow-auto pre", null, 4, [["overflow", "auto"]]], [".\\[\\&_pre\\]\\:rounded-ui pre", null, 4, [["border-radius", "var(--radius)"]]], [".\\[\\&_pre\\]\\:bg-surface-0 pre", null, 4, [["background-color", "var(--surface-0)"]]], [".\\[\\&_pre\\]\\:p-2 pre", null, 4, [["padding", "calc(var(--spacing) * 2)"]]], [".\\[\\&_pre\\]\\:text-\\[0\\.78rem\\] pre", null, 4, [["font-size", ".78rem"]]], [".\\[\\&_pre\\]\\:\\[overflow-wrap\\:anywhere\\] pre", null, 4, [["overflow-wrap", "anywhere"]]], [".\\[\\&_pre\\]\\:whitespace-pre-wrap pre", null, 4, [["white-space", "pre-wrap"]]], [".\\[\\&_pre\\]\\:text-fg pre, .\\[\\&_strong\\]\\:text-fg strong", null, 4, [["color", "var(--text)"]]], [".\\[\\&_summary\\]\\:cursor-pointer summary", null, 4, [["cursor", "pointer"]]], [".\\[\\&\\:hover\\:not\\(\\:disabled\\)\\]\\:bg-surface-1:hover:not(:disabled)", null, 4, [["background-color", "var(--surface-1)"]]], [".\\[\\&\\:hover\\:not\\(\\:disabled\\)\\]\\:text-accent:hover:not(:disabled)", null, 4, [["color", "var(--accent)"]]], [".\\[\\&\\:hover\\:not\\(\\:disabled\\)\\]\\:text-red:hover:not(:disabled)", null, 4, [["color", "var(--red)"]]], [".\\[\\&\\:not\\(\\:has\\(\\[data-setting-row\\]\\)\\)\\>\\[data-none\\]\\]\\:block:not(:has([data-setting-row])) > [data-none]", null, 4, [["display", "block"]]], [".\\[\\&\\>\\*\\]\\:min-h-0 > *", null, 4, [["min-height", "0"]]], [".\\[\\&\\>\\*\\]\\:min-w-0 > *", null, 4, [["min-width", "0"]]], [".\\[\\&\\>\\*\\]\\:flex-1 > *", null, 4, [["flex", "1"]]], [".\\[\\&\\>\\*\\]\\:shrink-0 > *", null, 4, [["flex-shrink", "0"]]], [".\\[\\&\\>li\\]\\:text-\\[0\\.85rem\\] > li", null, 4, [["font-size", ".85rem"]]], [".\\[\\&\\>li\\]\\:leading-\\[1\\.5\\] > li", null, 4, [["--tw-leading", "1.5"], ["line-height", "1.5"]]], [".\\[\\&\\>li\\]\\:text-fg > li", null, 4, [["color", "var(--text)"]]], [".\\[\\&\\>summary\\]\\:flex > summary", null, 4, [["display", "flex"]]], [".\\[\\&\\>summary\\]\\:cursor-pointer > summary", null, 4, [["cursor", "pointer"]]], [".\\[\\&\\>summary\\]\\:list-none > summary", null, 4, [["list-style-type", "none"]]], [".\\[\\&\\>summary\\]\\:items-center > summary", null, 4, [["align-items", "center"]]], [".\\[\\&\\>summary\\]\\:gap-\\[0\\.4rem\\] > summary", null, 4, [["gap", ".4rem"]]], [".\\[\\&\\>summary\\]\\:rounded-ui > summary", null, 4, [["border-radius", "var(--radius)"]]], [".\\[\\&\\>summary\\]\\:px-\\[0\\.4rem\\] > summary", null, 4, [["padding-inline", ".4rem"]]], [".\\[\\&\\>summary\\]\\:py-\\[0\\.25rem\\] > summary", null, 4, [["padding-block", ".25rem"]]], [".\\[\\&\\>summary\\]\\:select-none > summary", null, 4, [["-webkit-user-select", "none"], ["user-select", "none"]]], [".\\[\\&\\>summary\\]\\:before\\:inline-block > summary:before", null, 4, [["content", "var(--tw-content)"], ["display", "inline-block"]]], [".\\[\\&\\>summary\\]\\:before\\:size-\\[0\\.4rem\\] > summary:before", null, 4, [["content", "var(--tw-content)"], ["width", ".4rem"], ["height", ".4rem"]]], [".\\[\\&\\>summary\\]\\:before\\:shrink-0 > summary:before", null, 4, [["content", "var(--tw-content)"], ["flex-shrink", "0"]]], [".\\[\\&\\>summary\\]\\:before\\:\\[transform\\:rotate\\(-45deg\\)\\] > summary:before", null, 4, [["content", "var(--tw-content)"], ["transform", "rotate(-45deg)"]]], [".\\[\\&\\>summary\\]\\:before\\:content-\\[\\'\\'\\] > summary:before", null, 4, [["--tw-content", '""'], ["content", "var(--tw-content)"]]], [".\\[\\&\\>summary\\]\\:before\\:\\[border-bottom\\:1\\.3px_solid_currentColor\\] > summary:before", null, 4, [["content", "var(--tw-content)"], ["border-bottom", "1.3px solid"]]], [".\\[\\&\\>summary\\]\\:before\\:\\[border-right\\:1\\.3px_solid_currentColor\\] > summary:before", null, 4, [["content", "var(--tw-content)"], ["border-right", "1.3px solid"]]], [".\\[\\&\\>summary\\]\\:before\\:\\[transition\\:transform_0\\.15s_ease\\] > summary:before", null, 4, [["content", "var(--tw-content)"], ["transition", "transform .15s"]]], [".\\[\\&\\>summary\\:hover\\]\\:bg-surface-1 > summary:hover", null, 4, [["background-color", "var(--surface-1)"]]], [".\\[\\&\\>summary\\:hover\\]\\:text-fg > summary:hover", null, 4, [["color", "var(--text)"]]], [".\\[\\&\\[open\\]\\>summary\\]\\:before\\:\\[transform\\:rotate\\(45deg\\)\\][open] > summary:before", null, 4, [["content", "var(--tw-content)"], ["transform", "rotate(45deg)"]]], [".app--mobile .\\[\\.app--mobile_\\&\\]\\:min-h-11", null, 4, [["min-height", "calc(var(--spacing) * 11)"]]], [".app--mobile .\\[\\.app--mobile_\\&\\]\\:min-h-\\[44px\\]", null, 4, [["min-height", "44px"]]], [".\\[\\@media\\(hover\\:none\\)\\]\\:opacity-60", ["(hover: none)"], 4, [["opacity", ".6"]]], [".\\[\\@media\\(hover\\:none\\)\\]\\:opacity-100", ["(hover: none)"], 4, [["opacity", "1"]]], [".\\[\\@media\\(max-width\\:700px\\)\\]\\:h-\\[2\\.75rem\\]", ["(max-width: 700px)"], 4, [["height", "2.75rem"]]], [".\\[\\@media\\(max-width\\:700px\\)\\]\\:min-h-\\[2\\.75rem\\]", ["(max-width: 700px)"], 4, [["min-height", "2.75rem"]]], [".\\[\\@media\\(max-width\\:700px\\)\\]\\:w-\\[2\\.75rem\\]", ["(max-width: 700px)"], 4, [["width", "2.75rem"]]], [".\\[\\@media\\(max-width\\:700px\\)\\]\\:min-w-\\[2\\.75rem\\]", ["(max-width: 700px)"], 4, [["min-width", "2.75rem"]]], [".\\[\\@media\\(max-width\\:700px\\)\\]\\:px-\\[0\\.65rem\\]", ["(max-width: 700px)"], 4, [["padding-inline", ".65rem"]]], ["div:hover > .\\[div\\:hover\\>\\&\\]\\:opacity-100", null, 4, [["opacity", "1"]]], [":root", null, 1e3, [["color-scheme", "dark"], ["--scrollbar-size", "6px"], ["--accent", "#c8c8c8"], ["--panel-bg", "#161616"], ["--surface-0", "#262626"], ["--surface-1", "#333"], ["--surface-dim", "#1c1c1c"], ["--backdrop", "#050505"], ["--overlay-0", "#3a3a3a"], ["--overlay-1", "#9b9b9b"], ["--text", "#d8d8d8"], ["--subtext-0", "#9b9b9b"], ["--mauve", "#a993c9"], ["--green", "#7fb685"], ["--yellow", "#d3b46a"], ["--red", "#df8c8c"], ["--blue", "#7aa2d7"], ["--teal", "#7fb8b8"], ["--peach", "#d39a6a"], ["--bg", "var(--panel-bg)"], ["--surface", "var(--surface-0)"], ["--surface-alt", "var(--surface-1)"], ["--border", "var(--overlay-0)"], ["--muted", "var(--subtext-0)"], ["--danger", "var(--red)"], ["--radius", "8px"], ["--radius-pane", "8px"], ["accent-color", "var(--accent)"], ["--font-ui", '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif'], ["--font-mono", `ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono",
    monospace`], ["font-family", "var(--font-ui)"]]], ["code, pre, kbd, samp", null, 1e3, [["font-family", "var(--font-mono)"]]], ["*", null, 1e3, [["box-sizing", "border-box"]]], ["html, body, #root", null, 1e3, [["height", "100%"], ["margin", "0"]]], ["html", null, 1e3, [["overscroll-behavior", "none"], ["--shell-bg", "var(--panel-bg)"]]], ["html[data-glass]", null, 1e3, [["--shell-bg", "var(--panel-bg)"]]], ["html[data-glass]", null, 1e3, [["--shell-bg", "color-mix(in srgb, var(--panel-bg) 86%, transparent)"]]], ["html", null, 1e3, [["--backdrop-bg", "var(--backdrop)"], ["--card-bg", "var(--panel-bg)"]]], ["html[data-glass]", null, 1e3, [["--backdrop-bg", "var(--backdrop)"]]], ["html[data-glass]", null, 1e3, [["--backdrop-bg", "color-mix(in srgb, var(--backdrop) 86%, transparent)"]]], ["html[data-glass]", null, 1e3, [["--card-bg", "var(--panel-bg)"]]], ["html[data-glass]", null, 1e3, [["--card-bg", "color-mix(in srgb, var(--panel-bg) 86%, transparent)"]]], ['body:has(.app--cards, .app--mobile), .app--cards .dock-area:has([data-testid="split-canvas"]:not([data-split="0"]))', null, 1e3, [["background", "var(--backdrop-bg)"]]], ["body", null, 1e3, [["background", "var(--shell-bg)"], ["color", "var(--text)"], ["overscroll-behavior", "none"], ["-webkit-tap-highlight-color", "transparent"], ["line-height", "1.3"]]], [".app", null, 1e3, [["flex-direction", "column"], ["height", "100dvh"], ["display", "flex"]]], [".app--mobile", null, 1e3, [["inset", "var(--visible-top, 0px) 0 auto 0"], ["height", "var(--visible-height, 100dvh)"], ["position", "fixed"]]], [".mobile-drawer-backdrop", null, 1e3, [["animation", ".15s ease-out mobile-fade"]]], [".mobile-drawer--left", null, 1e3, [["animation", ".2s cubic-bezier(.2, .8, .2, 1) mobile-slide-left"]]], [".mobile-drawer--right", null, 1e3, [["animation", ".2s cubic-bezier(.2, .8, .2, 1) mobile-slide-right"]]], [".mobile-sheet", null, 1e3, [["animation", ".22s cubic-bezier(.2, .8, .2, 1) mobile-rise"]]], [".mobile-drawer-backdrop, .mobile-drawer, .mobile-sheet", ["(prefers-reduced-motion: reduce)"], 1e3, [["animation", "none"]]], [".layout-drawer", null, 1e3, [["transform", "translateX(var(--float-hide, 0))"], ["transition", "transform .18s"]]], [".layout-drawer:hover, .layout-drawer:focus-within", null, 1e3, [["--float-hide", "0px"]]], [".dockview-theme-perch", null, 1e3, [["--dv-color-abyss-dark", "var(--panel-bg)"], ["--dv-color-abyss", "var(--surface-0)"], ["--dv-color-abyss-light", "var(--surface-1)"], ["--dv-color-abyss-lighter", "var(--overlay-0)"], ["--dv-color-abyss-accent", "var(--accent)"], ["--dv-color-abyss-primary-text", "var(--text)"], ["--dv-color-abyss-secondary-text", "var(--subtext-0)"], ["--dv-group-view-background-color", "var(--panel-bg)"], ["--dv-tabs-and-actions-container-background-color", "var(--surface-0)"], ["--dv-activegroup-visiblepanel-tab-background-color", "var(--panel-bg)"], ["--dv-activegroup-hiddenpanel-tab-background-color", "var(--surface-0)"], ["--dv-inactivegroup-visiblepanel-tab-background-color", "var(--panel-bg)"], ["--dv-inactivegroup-hiddenpanel-tab-background-color", "var(--surface-0)"], ["--dv-tab-divider-color", "var(--overlay-0)"], ["--dv-activegroup-visiblepanel-tab-color", "var(--text)"], ["--dv-activegroup-hiddenpanel-tab-color", "var(--subtext-0)"], ["--dv-inactivegroup-visiblepanel-tab-color", "var(--subtext-0)"], ["--dv-inactivegroup-hiddenpanel-tab-color", "var(--subtext-0)"], ["--dv-separator-border", "var(--overlay-0)"], ["--dv-paneview-header-border-color", "var(--overlay-0)"], ["--dv-tabs-and-actions-container-font-size", ".82rem"], ["--dv-tabs-and-actions-container-height", "2.1rem"]]], [".dockview-theme-perch .dv-tabs-and-actions-container", null, 1e3, [["z-index", "1"], ["position", "relative"]]], [".pane-tab", null, 1e3, [["align-items", "center"], ["width", "100%"], ["height", "100%"], ["display", "flex"]]], [".pane-tab__agent-badge", null, 1e3, [["color", "var(--subtext-0)"], ["white-space", "nowrap"], ["flex-shrink", "0"], ["margin-right", ".4rem"], ["font-size", ".78em"]]], ['.pane-tab[data-testid="pane-tab-chat"] .dv-default-tab-action', null, 1e3, [["display", "none"]]], [".dockview-group-action", null, 1e3, [["border-radius", "var(--radius)"], ["width", "1.5rem"], ["height", "1.5rem"], ["color", "var(--subtext-0)"], ["cursor", "pointer"], ["background", "none"], ["border", "none"], ["justify-content", "center"], ["align-self", "center"], ["align-items", "center"], ["margin", "0 .15rem"], ["font-size", "1rem"], ["line-height", "1"], ["transition", "color .1s, background .1s"], ["display", "flex"]]], [".dockview-group-action:hover", null, 1e3, [["color", "var(--text)"], ["background", "var(--surface-1)"]]], [".dockview-theme-perch .dv-view-container > .dv-view:has(.dv-inactive-group)", ["(max-width: 700px)"], 1e3, [["display", "none"]]], [".dockview-theme-perch .dv-view-container > .dv-view:has(.dv-active-group)", ["(max-width: 700px)"], 1e3, [["width", "100%", 1], ["left", "0", 1]]], [".chat", null, 1e3, [["isolation", "isolate"], ["flex-direction", "column"], ["flex", "1"], ["height", "100%"], ["min-height", "0"], ["display", "flex"]]], [".message__markdown p", null, 1e3, [["margin", "0 0 .5em"]]], [".message__markdown p:last-child", null, 1e3, [["margin-bottom", "0"]]], [".message__markdown h1, .message__markdown h2, .message__markdown h3, .message__markdown h4", null, 1e3, [["margin", ".6em 0 .3em"], ["line-height", "1.25"]]], [".message__markdown h1", null, 1e3, [["font-size", "1.25em"]]], [".message__markdown h2", null, 1e3, [["font-size", "1.12em"]]], [".message__markdown h3", null, 1e3, [["font-size", "1em"]]], [".message__markdown > * + *", null, 1e3, [["margin-top", ".5em"]]], [".message__markdown table, .md-table", null, 1e3, [["border-collapse", "separate"], ["border-spacing", "0"], ["background", "var(--surface-0)"], ["border-radius", "var(--radius)"], ["max-width", "100%"], ["margin", ".5em 0"], ["font-size", ".92em"], ["display", "block"], ["overflow-x", "auto"]]], [".md-table", null, 1e3, [["width", "100%"], ["margin", "0"], ["display", "table"]]], [".message__markdown th, .message__markdown td, .md-table th, .md-table td", null, 1e3, [["text-align", "left"], ["vertical-align", "top"], ["border-bottom", "1px solid var(--surface-1)"], ["padding", ".35em .75em"]]], [".message__markdown th, .md-table th", null, 1e3, [["color", "var(--subtext-0)"], ["white-space", "nowrap"], ["background", "var(--surface-1)"], ["font-weight", "600"]]], [".message__markdown tbody tr:last-child td, .md-table tbody tr:last-child td", null, 1e3, [["border-bottom", "0"]]], [".message__markdown tbody tr:hover td, .md-table tbody tr:hover td", null, 1e3, [["background", "var(--surface-1)"]]], [".md-table caption", null, 1e3, [["text-align", "left"], ["color", "var(--subtext-0)"], ["padding", ".4em .75em"]]], [".md-code", null, 1e3, [["background", "var(--surface-0)"], ["border-radius", "var(--radius)"], ["overflow", "hidden"]]], [".md-code__bar", null, 1e3, [["color", "var(--subtext-0)"], ["background", "var(--surface-1)"], ["justify-content", "space-between"], ["align-items", "center"], ["padding", ".1rem .4rem .1rem .75rem"], ["font-size", ".75em"], ["display", "flex"]]], [".message__markdown .md-code pre", null, 1e3, [["background", "none"], ["border-radius", "0"], ["margin", "0"]]], [".hl-keyword", null, 1e3, [["color", "var(--mauve)"]]], [".hl-string", null, 1e3, [["color", "var(--green)"]]], [".hl-number", null, 1e3, [["color", "var(--peach)"]]], [".hl-function", null, 1e3, [["color", "var(--blue)"]]], [".hl-type", null, 1e3, [["color", "var(--yellow)"]]], [".hl-tag", null, 1e3, [["color", "var(--teal)"]]], [".hl-comment", null, 1e3, [["color", "var(--overlay-1)"], ["font-style", "italic"]]], [".message__markdown ul, .message__markdown ol", null, 1e3, [["margin", ".3em 0 .5em 1.3em"], ["padding", "0"]]], [".message__markdown li", null, 1e3, [["margin-bottom", ".2em"]]], [".message__markdown code", null, 1e3, [["background", "var(--surface-0)"], ["border-radius", ".25rem"], ["padding", ".1em .35em"], ["font-family", "ui-monospace, SFMono-Regular, SF Mono, Menlo, Consolas, monospace"], ["font-size", ".88em"]]], [".message__markdown pre", null, 1e3, [["background", "var(--surface-0)"], ["border-radius", "var(--radius)"], ["margin", ".4em 0"], ["padding", ".6rem .75rem"], ["position", "relative"], ["overflow-x", "auto"]]], [".message__markdown pre code", null, 1e3, [["background", "none"], ["border", "none"], ["padding", "0"], ["font-size", ".85em"]]], [".message__markdown a", null, 1e3, [["color", "var(--accent)"], ["text-decoration", "underline"]]], [".message__markdown blockquote", null, 1e3, [["border-left", "3px solid var(--overlay-0)"], ["color", "var(--subtext-0)"], ["margin", ".4em 0"], ["padding", ".1em .6em"]]], [".message__markdown hr", null, 1e3, [["border", "none"], ["border-top", "1px solid var(--overlay-0)"], ["margin", ".75em 0"]]], [".file-markdown", null, 1e3, [["overflow-wrap", "anywhere"]]], [".file-markdown img", null, 1e3, [["max-width", "100%"]]], [".file-markdown table", null, 1e3, [["border-collapse", "collapse"], ["margin", ".4em 0"], ["display", "block"], ["overflow-x", "auto"]]], [".file-markdown th, .file-markdown td", null, 1e3, [["border", "1px solid var(--overlay-0)"], ["padding", ".2em .5em"]]], [".file-markdown .md-placeholder", null, 1e3, [["color", "var(--subtext-0)"], ["border", "1px dashed var(--overlay-0)"], ["border-radius", ".25rem"], ["padding", ".05em .35em"], ["font-size", ".9em"]]], [".terminal", null, 1e3, [["min-width", "0"], ["min-height", "0"], ["padding", "var(--terminal-padding, 0)"], ["opacity", "var(--terminal-opacity, 1)"], ["flex", "1"], ["display", "flex"], ["position", "relative"]]], [".terminal__surface", null, 1e3, [["flex", "1"], ["min-width", "0"], ["min-height", "0"], ["overflow", "hidden"]]], [".terminal__surface .xterm", null, 1e3, [["height", "100%"]]], [".terminal__surface .xterm:not(.allow-transparency) .xterm-viewport", null, 1e3, [["background-color", "#0000"]]], [".terminal__surface .xterm-scrollable-element", null, 1e3, [["position", "static", 1]]], [".terminal__surface .xterm-decoration-overview-ruler, .no-pane-scrollbars .terminal__surface .xterm-scrollable-element > .xterm-scrollbar", null, 1e3, [["display", "none"]]], [".terminal--persistent", null, 1e3, [["flex-direction", "column"]]], [".terminal__toolbar", null, 1e3, [["color", "var(--subtext-0)"], ["align-items", "center"], ["gap", ".5rem"], ["padding", ".25rem 1.5rem .25rem .5rem"], ["font-size", ".8rem"], ["display", "flex"]]], [".terminal__toolbar button", null, 1e3, [["border-radius", "var(--radius)"], ["min-height", "32px"], ["color", "var(--text)"], ["background", "var(--surface-0)"], ["border", "0"], ["padding", ".25rem .5rem"]]], [".terminal__toolbar--overlay", null, 1e3, [["z-index", "2"], ["border-radius", "var(--radius)"], ["background", "var(--surface-1)"], ["padding", ".2rem .3rem .2rem .6rem"], ["position", "absolute"], ["top", ".4rem"], ["right", ".9rem"], ["box-shadow", "0 2px 8px #00000040"]]], [".terminal__connection", null, 1e3, [["margin-right", "auto"]]], [".terminal__toolbar button:disabled", null, 1e3, [["opacity", ".5"]]], [".terminal__notice", null, 1e3, [["color", "var(--subtext-0)"], ["padding", ".75rem"], ["font-size", ".85rem"]]], [".app--mobile .terminal__toolbar button", null, 1e3, [["min-height", "44px"]]], [".app--mobile .terminal__connection", null, 1e3, [["display", "none"]]], [".app--mobile .terminal__toolbar", null, 1e3, [["padding-right", ".5rem"]]], [".terminal__exited", null, 1e3, [["background", "var(--surface-1)"], ["border-radius", "var(--radius)"], ["color", "var(--subtext-0)"], ["padding", ".35rem .75rem"], ["font-size", ".85rem"], ["position", "absolute"], ["bottom", ".75rem"], ["left", "50%"], ["transform", "translateX(-50%)"]]], [".terminal__exited--cli", null, 1e3, [["background", "var(--panel-bg)"], ["flex-direction", "column"], ["align-items", "center"], ["gap", ".6rem"], ["padding", ".9rem 1.1rem"], ["display", "flex"], ["top", "50%"], ["bottom", "auto"], ["transform", "translate(-50%, -50%)"], ["box-shadow", "0 6px 24px #00000059"]]], [".terminal__exited-actions", null, 1e3, [["gap", ".5rem"], ["display", "flex"]]], [".terminal__cli-error", null, 1e3, [["background", "var(--red)"], ["position", "absolute"], ["bottom", ".75rem"], ["left", "50%"], ["transform", "translateX(-50%)"]]], [".terminal__cli-error", null, 1e3, [["background", "color-mix(in srgb, var(--red) 20%, var(--panel-bg))"]]], [".terminal__cli-error", null, 1e3, [["border-radius", "var(--radius)"], ["color", "var(--red)"], ["text-align", "center"], ["white-space", "pre-wrap"], ["word-break", "break-word"], ["max-width", "90%"], ["padding", ".35rem .75rem"], ["font-size", ".85rem"]]], [".mobile-pane-shell__content > .chat, .mobile-pane-shell__content > .terminal, .mobile-pane-shell__content > .workspace-files, .mobile-pane-shell__content > .workspace-git", null, 1e3, [["flex", "1"], ["width", "100%"], ["min-width", "0"], ["height", "100%"], ["min-height", "0"]]], [".terminal__host", null, 1e3, [["width", "100%"], ["height", "100%"], ["overflow", "hidden"]]], [".workspace-git", null, 1e3, [["--git-border", "var(--overlay-0)"]]], [".workspace-git", null, 1e3, [["--git-border", "color-mix(in srgb, var(--overlay-0) 72%, transparent)"]]], [".workspace-git", null, 1e3, [["--git-muted", "var(--subtext-0)"], ["width", "100%"], ["min-width", "0"], ["height", "100%"], ["min-height", "0"], ["color", "var(--text)"], ["background", "var(--workspace-tools-bg, var(--panel-bg))"], ["flex-direction", "column"], ["font-size", ".78rem"], ["display", "flex"], ["position", "relative"], ["overflow", "hidden"], ["container-type", "inline-size"]]], [".workspace-git button, .workspace-git input, .workspace-git textarea", null, 1e3, [["font", "inherit"]]], [".workspace-git button", null, 1e3, [["cursor", "pointer"]]], ['.workspace-git button:focus-visible, .workspace-git input:focus-visible, .workspace-git textarea:focus-visible, .workspace-git [role="button"]:focus-visible', null, 1e3, [["outline", "2px solid var(--accent)"], ["outline-offset", "1px"]]], [".workspace-git__diff", null, 1e3, [["container-type", "inline-size"]]], [".workspace-git__line-comment-thread", null, 1e3, [["max-width", "max(0px, min(42rem, 100cqi - 6.9rem))"], ["position", "sticky"], ["left", "0"]]], [".workspace-git__comment-composer", null, 1e3, [["max-width", "max(0px, 100cqi - 1.4rem)"], ["position", "sticky"], ["left", "0"]]], [".dockview-group-action--split-session", null, 1e3, [["font-size", "13px"]]], [".session-split-popover", null, 1e3, [["display", "flex"], ["flex-direction", "column"], ["background", "var(--surface-1)"], ["border-radius", "var(--radius)"], ["box-shadow", "0 8px 24px rgba(0, 0, 0, 0.45)"], ["padding", "4px"], ["font-size", "12.5px"], ["color", "var(--text)"], ["overflow", "hidden"]]], [".session-split-popover__header", null, 1e3, [["padding", "6px 8px 4px"], ["font-size", "11px"], ["text-transform", "uppercase"], ["letter-spacing", "0.04em"], ["color", "var(--subtext-0)"]]], [".session-split-popover__empty", null, 1e3, [["padding", "8px"], ["color", "var(--subtext-0)"]]], [".session-split-popover__list", null, 1e3, [["overflow-y", "auto"]]], [".session-split-popover__item", null, 1e3, [["display", "flex"], ["flex-direction", "column"], ["align-items", "flex-start"], ["gap", "1px"], ["width", "100%"], ["padding", "6px 8px"], ["border", "none"], ["border-radius", "4px"], ["background", "transparent"], ["color", "inherit"], ["text-align", "left"], ["cursor", "grab"]]], [".session-split-popover__item:hover", null, 1e3, [["background", "var(--surface-0)"]]], [".session-split-popover__item-title", null, 1e3, [["font-weight", "500"], ["white-space", "nowrap"], ["overflow", "hidden"], ["text-overflow", "ellipsis"], ["max-width", "100%"]]], [".session-split-popover__item-cwd", null, 1e3, [["font-size", "11px"], ["color", "var(--subtext-0)"], ["white-space", "nowrap"], ["overflow", "hidden"], ["text-overflow", "ellipsis"], ["max-width", "100%"]]], [".session-split-popover__item-badge", null, 1e3, [["align-self", "flex-end"], ["font-size", "10px"], ["color", "var(--accent)"], ["margin-top", "-14px"]]], [".inactive-session-pane", null, 1e3, [["display", "flex"], ["flex-direction", "column"], ["align-items", "center"], ["justify-content", "center"], ["gap", "10px"], ["height", "100%"], ["padding", "24px"], ["text-align", "center"], ["color", "var(--subtext-0)"]]], [".inactive-session-pane__title", null, 1e3, [["font-size", "14px"], ["font-weight", "500"], ["color", "var(--text)"]]], [".inactive-session-pane__cwd", null, 1e3, [["font-size", "12px"], ["color", "var(--subtext-0)"], ["word-break", "break-all"]]], [".inactive-session-pane__note", null, 1e3, [["font-size", "12px"], ["max-width", "320px"], ["line-height", "1.5"]]], [".inactive-session-pane__switch", null, 1e3, [["margin-top", "4px"], ["padding", "6px 14px"], ["border-radius", "var(--radius)"], ["border", "0"], ["background", "var(--surface-0)"], ["color", "var(--text)"], ["cursor", "pointer"], ["font-size", "12.5px"]]], [".inactive-session-pane__switch:hover", null, 1e3, [["background", "var(--surface-1)"]]]], skipped: { "@supports evaluated false": 2, "@container": 6, "@keyframes": 9 } };
//! The app's compiled stylesheet as a table (`build.mjs` writes it from Vite + Tailwind's output and bundles it as
//! `virtual:perch-css-table`), parsed once on first use.
let Tg = null;
const Cg = () => Tg ??= new V0(Ng);
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
function Mg(n, l) {
  const o = /* @__PURE__ */ new Set([...Object.keys(n), ...Object.keys(l)]);
  for (const i of o) {
    if (i === "children") continue;
    const s = n[i], d = l[i];
    if (!(s === d || typeof s == "function" && typeof d == "function") && !(i === "style" && s && d && typeof s == "object" && typeof d == "object" && [.../* @__PURE__ */ new Set([...Object.keys(s), ...Object.keys(d)])].every((f) => s[f] === d[f])))
      return !0;
  }
  return !1;
}
const Ag = (n) => !n.props.disabled && (/^(button|input|select|textarea)$/.test(n.tagName) || n.tagName === "a" && n.props.href != null || n.props.tabIndex != null);
function ef(n, l) {
  for (const o of s0(l.dangerouslySetInnerHTML?.__html, n.ownerDocument) ?? []) n.appendChild(o);
  return n;
}
const jg = {
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
  createInstance: (n, l, o) => ef(new Pt(n, l, o.ownerDocument), l),
  createTextInstance: (n, l) => new ei(n),
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
      ef(n, i);
    }
    Mg(o, i) && n.touch();
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
}, Ne = M0(jg), Tl = (n, l, o = null) => Ne.createPortal(n, l, null, o), Og = {
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
}, Rg = /* @__PURE__ */ new Set(["click", "dblclick", "mousedown", "mouseup"]), Dg = /* @__PURE__ */ new Set(["button", "input", "select", "textarea", "fieldset"]), Hg = (n) => {
  for (let l = n; l instanceof Pt; l = l.parentNode) if (l.props.disabled && Dg.has(l.tagName)) return !0;
  return !1;
};
class Bg {
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
function Ar(n, l, o) {
  l.currentTarget = n;
  for (const { type: i, listener: s, capture: d } of [...n.listeners ?? []])
    i === l.type && d === o && s.call(n, l);
  if (n instanceof Pt) {
    const i = Og[l.type], s = i && n.props[o ? `${i}Capture` : i];
    typeof s == "function" && s(l);
  }
}
function Dy(n, l, o = {}) {
  const { document: i, window: s, globals: d } = m0(n), m = new Pt("div", { id: "root", style: o.container ?? {} }, i);
  i.body.appendChild(m);
  const f = [];
  let p = null;
  const v = () => [i, s].map((H) => H.listeners.map((h) => `${h.type}:${h.capture}`).sort().join(",")).join("|");
  let S = "";
  const w = {}, x = `m${Math.random().toString(36).slice(2, 10)}:`;
  let z = 0, E = -1;
  i.measureKey = (H) => x + H.id, i.stale = () => E !== z, i.computed = (H) => {
    if (!w.cascade || !w.top) return null;
    const h = [];
    for (let y = H; y instanceof Pt && y !== i.body; y = y.parentNode) h.unshift(y);
    let b = w.top;
    for (const y of h) b = w.cascade.compute(y, b);
    return b.values;
  };
  const _ = () => (z += 1, p = zg(i, n, Cg(), w, o.names), S = v(), n.render?.(p), p), k = () => {
    Ne.flushPassiveEffects(), Ne.flushSyncWork(), v() !== S && _();
  };
  i.afterCommit = _;
  const N = (H) => {
    f.push(H), n.error?.(H);
  }, D = Ne.createContainer(m, El.ConcurrentRoot, null, !1, null, "", N, N, N, null);
  Ne.updateContainerSync(et.createElement(l, o.props ?? {}), D, null, null), Ne.flushSyncWork(), k();
  const O = (H) => {
    const h = (b) => {
      if (b.id === H) return b;
      for (const y of b.children) {
        const A = h(y);
        if (A) return A;
      }
      return null;
    };
    return h(i.documentElement);
  }, X = (H) => {
    const h = sa;
    sa = El.DiscreteEventPriority;
    try {
      return H();
    } finally {
      sa = h, Ne.flushSyncWork(), k();
    }
  }, q = {
    document: i,
    window: s,
    /** What `window`, `document` and `localStorage` read while this screen runs (`dom.mjs`'s `GLOBALS`). */
    globals: d,
    container: m,
    errors: f,
    /** The latest description (after the last commit or state change). */
    get description() {
      return p;
    },
    describe: _,
    /** Runs a DOM event of `type` at node `id`; false when the node is gone. */
    dispatch(H, h, b = {}) {
      const y = typeof H == "string" ? O(H) : H;
      if (!y || Rg.has(h) && Hg(y)) return !1;
      const A = new Bg(h, b, y), j = [];
      for (let Z = y; Z; Z = h === "scroll" ? null : Z.parentNode) j.push(Z);
      const M = [...j, i, s];
      X(() => {
        for (let Z = M.length - 1; Z > 0 && !A.propagationStopped; Z--) Ar(M[Z], A, !0);
        A.propagationStopped || (Ar(y, A, !0), A.propagationStopped || Ar(y, A, !1));
        for (let Z = 1; Z < M.length && !A.propagationStopped; Z++) Ar(M[Z], A, !1);
      });
      const U = h === "click" && !A.defaultPrevented ? as(y) : null;
      if (U && q.dispatch(U, "submit", {}), h === "click" && !A.defaultPrevented)
        for (let Z = y; Z; Z = Z.parentNode) {
          if (Z.tagName !== "a") continue;
          const F = Z.props?.href;
          typeof F == "string" && /^https:\/\/\S+$/.test(F) && n.openLink?.(F);
          break;
        }
      return !A.defaultPrevented;
    },
    /** Whether the source listens for `type` on `window` or `document` (a page recording a key press does). */
    listensFor: (H) => [i, s].some((h) => h.listeners.some((b) => b.type === H)),
    /** A key pressed while the screen has the keyboard (`init`: the DOM's `key`, modifiers, `repeat`), at the
     * focused element. When nothing prevented it and that element is a text field, the key edits the field as a
     * browser would: a character is typed at the end (or replaces the text when all of it is selected), Backspace
     * deletes the last one, and the field gets `input` and `change` events with its new `value`. Returns whether the
     * source took the key (prevented it, or a field changed). */
    key(H) {
      const h = i.activeElement && i.activeElement !== i.body ? i.activeElement : i.body;
      if (!q.dispatch(h, "keydown", H)) return !0;
      const y = H.key === "Enter" && !H.isComposing ? as(h, !0) : null;
      if (y)
        return q.dispatch(y, "submit", {}), !0;
      if (!Of(h) || h.props.disabled || h.props.readOnly) return !1;
      if ((H.ctrlKey || H.metaKey) && !H.altKey && !H.shiftKey && H.key.toLowerCase() === "a")
        return h.selectedAll = !0, !0;
      if (H.ctrlKey || H.metaKey) return !1;
      const A = h.selectedAll;
      h.selectedAll = !1;
      const j = h.value, U = H.key === "Backspace" || A && H.key === "Delete" ? A ? "" : j.slice(0, -1) : [...H.key].length === 1 ? (A ? "" : j) + H.key : j;
      return U === j ? !1 : (h.value = U, q.dispatch(h, "input", { data: H.key }), q.dispatch(h, "change", {}), h.props.value !== void 0 && delete h.edit, h.touch(), _(), !0);
    },
    /** The engine's box for node `id` (window coordinates, logical px), for `getBoundingClientRect`. */
    setBounds(H, h) {
      const b = O(H);
      b && (b.bounds = { x: h.x, y: h.y, width: h.width, height: h.height });
    },
    /** A click on a check box or radio button (`id`): the `click` event, then, unless the source prevented it, the
     * box ticked as a browser ticks it (a radio button only on), with `input` and `change` events. */
    toggle(H) {
      const h = O(H);
      if (!h || h.props.disabled || !q.dispatch(H, "click", { button: 0, detail: 1 })) return;
      const b = h.props.type === "radio";
      b && h.checked || (h.checked = b ? !0 : !h.checked, q.dispatch(H, "input", {}), q.dispatch(H, "change", {}), h.props.checked !== void 0 && delete h.ticked, h.touch(), _());
    },
    /** A left click as the engine reports one: press then release on the same node. */
    click(H, h = {}) {
      const b = { button: 0, buttons: 1, pointerType: "mouse", ...h };
      for (const y of ["pointerdown", "mousedown", "pointerup", "mouseup", "click"]) q.dispatch(H, y, b);
    },
    /** The pointer entered (`on`) or left node `id` (one the description marks `track_hover`): its `:hover` state,
     * which a descendant's group variant reads. The element's own `hover:` styles are the engine's hover style. */
    /** Whether the pointer is over node `id`, as `hover` last said. */
    hovered: (H) => !!O(H)?.state.hover,
    hover(H, h) {
      const b = O(H);
      !b || b.state.hover === h || (b.state.hover = h, b.touch(), _());
    },
    focus(H) {
      const h = O(H);
      h && (X(() => {
        const b = i.activeElement;
        b && b !== h && b !== i.body && q.dispatch(b, "blur"), i.focus(h), q.dispatch(h, "focus");
      }), _());
    },
    /** A press at node `id` that nothing prevented: the browser's default focuses the element pressed. Only an element
     * that listens for keys (`onKeyDown`) is focused, so a press elsewhere leaves the keyboard where it was; the focus
     * is not `:focus-visible`, as after a pointer press in a browser. */
    // ponytail: a browser focuses every focusable element pressed; here only one with its own key handler, so a
    // screen's ordinary buttons do not take the keyboard from a terminal.
    pressFocus(H) {
      let b = typeof H == "string" ? O(H) : H;
      for (; b && !(b instanceof Pt && typeof b.props.onKeyDown == "function" && Ag(b)); ) b = b.parentNode;
      !b || b === i.activeElement || (q.focus(b.id), b.state.pointerFocus = !0, b.touch(), _());
    },
    /** The engine is drawing the latest description: the boxes measured in this frame's layout are the tree's.
     * Returns whether effects wait for that layout (`measured`); run them with `retry` once the frame is drawn. */
    drawing() {
      return E = z, i.retries.length > 0;
    },
    /** Runs the effects that waited for a fresh layout. */
    retry() {
      const H = i.retries.splice(0);
      for (const h of H) h();
    },
    /** Runs effects React has scheduled (the engine calls it after a frame). */
    flush: k,
    update(H) {
      Ne.updateContainerSync(et.createElement(l, H ?? {}), D, null, null), Ne.flushSyncWork(), k();
    },
    unmount() {
      Ne.updateContainerSync(null, D, null, null), Ne.flushSyncWork(), Ne.flushPassiveEffects(), i.afterCommit = null, i.retries.length = 0, n.forgetBounds?.(x);
    }
  };
  return q;
}
//! `react-dom` for a screen on the native renderer: `createPortal` (into `document.body`, the overlay layer) and
//! `flushSync`. Nothing of the browser renderer.
const Xf = (n) => Ne.flushSyncFromReconciler(n), Ug = { createPortal: Tl, flushSync: Xf }, Hy = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  createPortal: Tl,
  default: Ug,
  flushSync: Xf
}, Symbol.toStringTag, { value: "Module" }));
function Zf(n) {
  var l, o, i = "";
  if (typeof n == "string" || typeof n == "number") i += n;
  else if (typeof n == "object") if (Array.isArray(n)) {
    var s = n.length;
    for (l = 0; l < s; l++) n[l] && (o = Zf(n[l])) && (i && (i += " "), i += o);
  } else for (o in n) n[o] && (i && (i += " "), i += o);
  return i;
}
function Jf() {
  for (var n, l, o = 0, i = "", s = arguments.length; o < s; o++) (n = arguments[o]) && (l = Zf(n)) && (i && (i += " "), i += l);
  return i;
}
const qg = (n, l) => {
  const o = new Array(n.length + l.length);
  for (let i = 0; i < n.length; i++)
    o[i] = n[i];
  for (let i = 0; i < l.length; i++)
    o[n.length + i] = l[i];
  return o;
}, Yg = (n, l) => ({
  classGroupId: n,
  validator: l
}), Wf = (n = /* @__PURE__ */ new Map(), l = null, o) => ({
  nextPart: n,
  validators: l,
  classGroupId: o
}), Fr = "-", nf = [], Gg = "arbitrary..", Lg = (n) => {
  const l = Vg(n), {
    conflictingClassGroups: o,
    conflictingClassGroupModifiers: i
  } = n;
  return {
    getClassGroupId: (m) => {
      if (m.startsWith("[") && m.endsWith("]"))
        return Qg(m);
      const f = m.split(Fr), p = f[0] === "" && f.length > 1 ? 1 : 0;
      return Ff(f, p, l);
    },
    getConflictingClassGroupIds: (m, f) => {
      if (f) {
        const p = i[m], v = o[m];
        return p ? v ? qg(v, p) : p : v || nf;
      }
      return o[m] || nf;
    }
  };
}, Ff = (n, l, o) => {
  if (n.length - l === 0)
    return o.classGroupId;
  const s = n[l], d = o.nextPart.get(s);
  if (d) {
    const v = Ff(n, l + 1, d);
    if (v) return v;
  }
  const m = o.validators;
  if (m === null)
    return;
  const f = l === 0 ? n.join(Fr) : n.slice(l).join(Fr), p = m.length;
  for (let v = 0; v < p; v++) {
    const S = m[v];
    if (S.validator(f))
      return S.classGroupId;
  }
}, Qg = (n) => n.slice(1, -1).indexOf(":") === -1 ? void 0 : (() => {
  const l = n.slice(1, -1), o = l.indexOf(":"), i = l.slice(0, o);
  return i ? Gg + i : void 0;
})(), Vg = (n) => {
  const {
    theme: l,
    classGroups: o
  } = n;
  return Kg(o, l);
}, Kg = (n, l) => {
  const o = Wf();
  for (const i in n) {
    const s = n[i];
    Es(s, o, i, l);
  }
  return o;
}, Es = (n, l, o, i) => {
  const s = n.length;
  for (let d = 0; d < s; d++) {
    const m = n[d];
    Xg(m, l, o, i);
  }
}, Xg = (n, l, o, i) => {
  if (typeof n == "string") {
    Zg(n, l, o);
    return;
  }
  if (typeof n == "function") {
    Jg(n, l, o, i);
    return;
  }
  Wg(n, l, o, i);
}, Zg = (n, l, o) => {
  const i = n === "" ? l : If(l, n);
  i.classGroupId = o;
}, Jg = (n, l, o, i) => {
  if (Fg(n)) {
    Es(n(i), l, o, i);
    return;
  }
  l.validators === null && (l.validators = []), l.validators.push(Yg(o, n));
}, Wg = (n, l, o, i) => {
  const s = Object.entries(n), d = s.length;
  for (let m = 0; m < d; m++) {
    const [f, p] = s[m];
    Es(p, If(l, f), o, i);
  }
}, If = (n, l) => {
  let o = n;
  const i = l.split(Fr), s = i.length;
  for (let d = 0; d < s; d++) {
    const m = i[d];
    let f = o.nextPart.get(m);
    f || (f = Wf(), o.nextPart.set(m, f)), o = f;
  }
  return o;
}, Fg = (n) => "isThemeGetter" in n && n.isThemeGetter === !0, Ig = (n) => {
  if (n < 1)
    return {
      get: () => {
      },
      set: () => {
      }
    };
  let l = 0, o = /* @__PURE__ */ Object.create(null), i = /* @__PURE__ */ Object.create(null);
  const s = (d, m) => {
    o[d] = m, l++, l > n && (l = 0, i = o, o = /* @__PURE__ */ Object.create(null));
  };
  return {
    get(d) {
      let m = o[d];
      if (m !== void 0)
        return m;
      if ((m = i[d]) !== void 0)
        return s(d, m), m;
    },
    set(d, m) {
      d in o ? o[d] = m : s(d, m);
    }
  };
}, cs = "!", af = ":", $g = [], lf = (n, l, o, i, s) => ({
  modifiers: n,
  hasImportantModifier: l,
  baseClassName: o,
  maybePostfixModifierPosition: i,
  isExternal: s
}), Pg = (n) => {
  const {
    prefix: l,
    experimentalParseClassName: o
  } = n;
  let i = (s) => {
    const d = [];
    let m = 0, f = 0, p = 0, v;
    const S = s.length;
    for (let _ = 0; _ < S; _++) {
      const k = s[_];
      if (m === 0 && f === 0) {
        if (k === af) {
          d.push(s.slice(p, _)), p = _ + 1;
          continue;
        }
        if (k === "/") {
          v = _;
          continue;
        }
      }
      k === "[" ? m++ : k === "]" ? m-- : k === "(" ? f++ : k === ")" && f--;
    }
    const w = d.length === 0 ? s : s.slice(p);
    let x = w, z = !1;
    w.endsWith(cs) ? (x = w.slice(0, -1), z = !0) : (
      /**
       * In Tailwind CSS v3 the important modifier was at the start of the base class name. This is still supported for legacy reasons.
       * @see https://github.com/dcastil/tailwind-merge/issues/513#issuecomment-2614029864
       */
      w.startsWith(cs) && (x = w.slice(1), z = !0)
    );
    const E = v && v > p ? v - p : void 0;
    return lf(d, z, x, E);
  };
  if (l) {
    const s = l + af, d = i;
    i = (m) => m.startsWith(s) ? d(m.slice(s.length)) : lf($g, !1, m, void 0, !0);
  }
  if (o) {
    const s = i;
    i = (d) => o({
      className: d,
      parseClassName: s
    });
  }
  return i;
}, tb = (n) => {
  const l = /* @__PURE__ */ new Map();
  return n.orderSensitiveModifiers.forEach((o, i) => {
    l.set(o, 1e6 + i);
  }), (o) => {
    const i = [];
    let s = [];
    for (let d = 0; d < o.length; d++) {
      const m = o[d], f = m[0] === "[", p = l.has(m);
      f || p ? (s.length > 0 && (s.sort(), i.push(...s), s = []), i.push(m)) : s.push(m);
    }
    return s.length > 0 && (s.sort(), i.push(...s)), i;
  };
}, eb = (n) => ({
  cache: Ig(n.cacheSize),
  parseClassName: Pg(n),
  sortModifiers: tb(n),
  postfixLookupClassGroupIds: nb(n),
  ...Lg(n)
}), nb = (n) => {
  const l = /* @__PURE__ */ Object.create(null), o = n.postfixLookupClassGroups;
  if (o)
    for (let i = 0; i < o.length; i++)
      l[o[i]] = !0;
  return l;
}, ab = /\s+/, lb = (n, l) => {
  const {
    parseClassName: o,
    getClassGroupId: i,
    getConflictingClassGroupIds: s,
    sortModifiers: d,
    postfixLookupClassGroupIds: m
  } = l, f = [], p = n.trim().split(ab);
  let v = "";
  for (let S = p.length - 1; S >= 0; S -= 1) {
    const w = p[S], {
      isExternal: x,
      modifiers: z,
      hasImportantModifier: E,
      baseClassName: _,
      maybePostfixModifierPosition: k
    } = o(w);
    if (x) {
      v = w + (v.length > 0 ? " " + v : v);
      continue;
    }
    let N = !!k, D;
    if (N) {
      const h = _.substring(0, k);
      D = i(h);
      const b = D && m[D] ? i(_) : void 0;
      b && b !== D && (D = b, N = !1);
    } else
      D = i(_);
    if (!D) {
      if (!N) {
        v = w + (v.length > 0 ? " " + v : v);
        continue;
      }
      if (D = i(_), !D) {
        v = w + (v.length > 0 ? " " + v : v);
        continue;
      }
      N = !1;
    }
    const O = z.length === 0 ? "" : z.length === 1 ? z[0] : d(z).join(":"), X = E ? O + cs : O, q = X + D;
    if (f.indexOf(q) > -1)
      continue;
    f.push(q);
    const H = s(D, N);
    for (let h = 0; h < H.length; ++h) {
      const b = H[h];
      f.push(X + b);
    }
    v = w + (v.length > 0 ? " " + v : v);
  }
  return v;
}, rb = (...n) => {
  let l = 0, o, i, s = "";
  for (; l < n.length; )
    (o = n[l++]) && (i = $f(o)) && (s && (s += " "), s += i);
  return s;
}, $f = (n) => {
  if (typeof n == "string")
    return n;
  let l, o = "";
  for (let i = 0; i < n.length; i++)
    n[i] && (l = $f(n[i])) && (o && (o += " "), o += l);
  return o;
}, ib = (n, ...l) => {
  let o, i, s, d;
  const m = (p) => {
    const v = l.reduce((S, w) => w(S), n());
    return o = eb(v), i = o.cache.get, s = o.cache.set, d = f, f(p);
  }, f = (p) => {
    const v = i(p);
    if (v)
      return v;
    const S = lb(p, o);
    return s(p, S), S;
  };
  return d = m, (...p) => d(rb(...p));
}, ob = [], Jt = (n) => {
  const l = (o) => o[n] || ob;
  return l.isThemeGetter = !0, l.themeKey = n, l;
}, Pf = /^\[(?:(\w[\w-]*):)?(.+)\]$/i, tm = /^\((?:(\w[\w-]*):)?(.+)\)$/i, sb = /^\d+(?:\.\d+)?\/\d+(?:\.\d+)?$/, cb = /^(\d+(\.\d+)?)?(xs|sm|md|lg|xl)$/, ub = /\d+(%|px|r?em|[sdl]?v([hwib]|min|max)|pt|pc|in|cm|mm|cap|ch|ex|r?lh|cq(w|h|i|b|min|max))|\b(calc|min|max|clamp)\(.+\)|^0$/, db = /^(rgba?|hsla?|hwb|(ok)?(lab|lch)|color-mix|color|light-dark)\(.+\)$/, fb = /^(inset_)?-?((\d+)?\.?(\d+)[a-z]+|0)_-?((\d+)?\.?(\d+)[a-z]+|0)/, mb = /^(url|image|image-set|cross-fade|element|(repeating-)?(linear|radial|conic)-gradient)\(.+\)$/, On = (n) => sb.test(n), vt = (n) => !!n && !Number.isNaN(Number(n)), We = (n) => !!n && Number.isInteger(Number(n)), Fo = (n) => n.endsWith("%") && vt(n.slice(0, -1)), fn = (n) => cb.test(n), em = () => !0, pb = (n) => (
  // `colorFunctionRegex` check is necessary because color functions can have percentages in them which which would be incorrectly classified as lengths.
  // For example, `hsl(0 0% 0%)` would be classified as a length without this check.
  // I could also use lookbehind assertion in `lengthUnitRegex` but that isn't supported widely enough.
  ub.test(n) && !db.test(n)
), zs = () => !1, hb = (n) => fb.test(n), gb = (n) => mb.test(n), bb = (n) => !rt(n) && !it(n), vb = (n) => n.startsWith("@container") && (n[10] === "/" && n[11] !== void 0 || n[11] === "s" && n[16] !== void 0 && n.startsWith("-size/", 10) || n[11] === "n" && n[18] !== void 0 && n.startsWith("-normal/", 10)), yb = (n) => Yn(n, lm, zs), rt = (n) => Pf.test(n), ia = (n) => Yn(n, rm, pb), rf = (n) => Yn(n, Nb, vt), xb = (n) => Yn(n, om, em), wb = (n) => Yn(n, im, zs), of = (n) => Yn(n, nm, zs), _b = (n) => Yn(n, am, gb), jr = (n) => Yn(n, sm, hb), it = (n) => tm.test(n), yl = (n) => ua(n, rm), kb = (n) => ua(n, im), sf = (n) => ua(n, nm), Sb = (n) => ua(n, lm), Eb = (n) => ua(n, am), Or = (n) => ua(n, sm, !0), zb = (n) => ua(n, om, !0), Yn = (n, l, o) => {
  const i = Pf.exec(n);
  return i ? i[1] ? l(i[1]) : o(i[2]) : !1;
}, ua = (n, l, o = !1) => {
  const i = tm.exec(n);
  return i ? i[1] ? l(i[1]) : o : !1;
}, nm = (n) => n === "position" || n === "percentage", am = (n) => n === "image" || n === "url", lm = (n) => n === "length" || n === "size" || n === "bg-size", rm = (n) => n === "length", Nb = (n) => n === "number", im = (n) => n === "family-name", om = (n) => n === "number" || n === "weight", sm = (n) => n === "shadow", Tb = () => {
  const n = Jt("color"), l = Jt("font"), o = Jt("text"), i = Jt("font-weight"), s = Jt("tracking"), d = Jt("leading"), m = Jt("breakpoint"), f = Jt("container"), p = Jt("spacing"), v = Jt("radius"), S = Jt("shadow"), w = Jt("inset-shadow"), x = Jt("text-shadow"), z = Jt("drop-shadow"), E = Jt("blur"), _ = Jt("perspective"), k = Jt("aspect"), N = Jt("ease"), D = Jt("animate"), O = () => ["auto", "avoid", "all", "avoid-page", "page", "left", "right", "column"], X = () => [
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
  ], q = () => [...X(), it, rt], H = () => ["auto", "hidden", "clip", "visible", "scroll"], h = () => ["auto", "contain", "none"], b = () => [it, rt, p], y = () => [On, "full", "auto", ...b()], A = () => [We, "none", "subgrid", it, rt], j = () => ["auto", {
    span: ["full", We, it, rt]
  }, We, it, rt], M = () => [We, "auto", it, rt], U = () => ["auto", "min", "max", "fr", it, rt], Z = () => ["start", "end", "center", "between", "around", "evenly", "stretch", "baseline", "center-safe", "end-safe"], F = () => ["start", "end", "center", "stretch", "center-safe", "end-safe"], Q = () => ["auto", ...b()], J = () => [On, "auto", "full", "dvw", "dvh", "lvw", "lvh", "svw", "svh", "min", "max", "fit", ...b()], I = () => [f, On, "screen", "full", "dvw", "lvw", "svw", "min", "max", "fit", ...b()], L = () => [On, "screen", "full", "lh", "dvh", "lvh", "svh", "min", "max", "fit", ...b()], V = () => [n, it, rt], T = () => [...X(), sf, of, {
    position: [it, rt]
  }], K = () => ["no-repeat", {
    repeat: ["", "x", "y", "space", "round"]
  }], at = () => ["auto", "cover", "contain", Sb, yb, {
    size: [it, rt]
  }], st = () => [Fo, yl, ia], ct = () => [
    // Deprecated since Tailwind CSS v4.0.0
    "",
    "none",
    "full",
    v,
    it,
    rt
  ], ut = () => ["", vt, yl, ia], Et = () => ["solid", "dashed", "dotted", "double"], Wt = () => ["normal", "multiply", "screen", "overlay", "darken", "lighten", "color-dodge", "color-burn", "hard-light", "soft-light", "difference", "exclusion", "hue", "saturation", "color", "luminosity"], ht = () => [vt, Fo, sf, of], Gn = () => [
    // Deprecated since Tailwind CSS v4.0.0
    "",
    "none",
    E,
    it,
    rt
  ], Ln = () => ["none", vt, it, rt], De = () => ["none", vt, it, rt], He = () => [vt, it, rt], pn = () => [On, "full", ...b()];
  return {
    cacheSize: 500,
    theme: {
      animate: ["spin", "ping", "pulse", "bounce"],
      aspect: ["video"],
      blur: [fn],
      breakpoint: [fn],
      color: [em],
      container: [fn],
      "drop-shadow": [fn],
      ease: ["in", "out", "in-out"],
      font: [bb],
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
        aspect: ["auto", "square", On, rt, it, k]
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
        "@container": ["", "normal", "size", it, rt]
      }],
      /**
       * Container Name
       * @see https://tailwindcss.com/docs/responsive-design#named-containers
       */
      "container-named": [vb],
      /**
       * Columns
       * @see https://tailwindcss.com/docs/columns
       */
      columns: [{
        columns: [vt, "auto", rt, it, f]
      }],
      /**
       * Break After
       * @see https://tailwindcss.com/docs/break-after
       */
      "break-after": [{
        "break-after": O()
      }],
      /**
       * Break Before
       * @see https://tailwindcss.com/docs/break-before
       */
      "break-before": [{
        "break-before": O()
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
        overflow: H()
      }],
      /**
       * Overflow X
       * @see https://tailwindcss.com/docs/overflow
       */
      "overflow-x": [{
        "overflow-x": H()
      }],
      /**
       * Overflow Y
       * @see https://tailwindcss.com/docs/overflow
       */
      "overflow-y": [{
        "overflow-y": H()
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
        z: [We, "auto", it, rt]
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
        flex: [vt, On, "auto", "initial", "none", rt]
      }],
      /**
       * Flex Grow
       * @see https://tailwindcss.com/docs/flex-grow
       */
      grow: [{
        grow: ["", vt, it, rt]
      }],
      /**
       * Flex Shrink
       * @see https://tailwindcss.com/docs/flex-shrink
       */
      shrink: [{
        shrink: ["", vt, it, rt]
      }],
      /**
       * Order
       * @see https://tailwindcss.com/docs/order
       */
      order: [{
        order: [We, "first", "last", "none", it, rt]
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
        col: j()
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
        row: j()
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
        justify: [...Z(), "normal"]
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
        content: ["normal", ...Z()]
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
        "place-content": Z()
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
        block: ["auto", ...L()]
      }],
      /**
       * Min-Block Size
       * @see https://tailwindcss.com/docs/min-block-size
       */
      "min-block-size": [{
        "min-block": ["auto", ...L()]
      }],
      /**
       * Max-Block Size
       * @see https://tailwindcss.com/docs/max-block-size
       */
      "max-block-size": [{
        "max-block": ["none", ...L()]
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
        text: ["base", o, yl, ia]
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
        font: [i, zb, xb]
      }],
      /**
       * Font Stretch
       * @see https://tailwindcss.com/docs/font-stretch
       */
      "font-stretch": [{
        "font-stretch": ["ultra-condensed", "extra-condensed", "condensed", "semi-condensed", "normal", "semi-expanded", "expanded", "extra-expanded", "ultra-expanded", Fo, rt]
      }],
      /**
       * Font Family
       * @see https://tailwindcss.com/docs/font-family
       */
      "font-family": [{
        font: [kb, wb, l]
      }],
      /**
       * Font Feature Settings
       * @see https://tailwindcss.com/docs/font-feature-settings
       */
      "font-features": [{
        "font-features": [rt]
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
        tracking: [s, it, rt]
      }],
      /**
       * Line Clamp
       * @see https://tailwindcss.com/docs/line-clamp
       */
      "line-clamp": [{
        "line-clamp": [vt, "none", it, rf]
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
        "list-image": ["none", it, rt]
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
        list: ["disc", "decimal", "none", it, rt]
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
        decoration: [vt, "from-font", "auto", it, ia]
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
        "underline-offset": [vt, "auto", it, rt]
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
        tab: [We, it, rt]
      }],
      /**
       * Vertical Alignment
       * @see https://tailwindcss.com/docs/vertical-align
       */
      "vertical-align": [{
        align: ["baseline", "top", "middle", "bottom", "text-top", "text-bottom", "sub", "super", it, rt]
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
        content: ["none", it, rt]
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
        bg: K()
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
          }, We, it, rt],
          radial: ["", it, rt],
          conic: ["", We, it, rt]
        }, Eb, _b]
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
        "outline-offset": [vt, it, rt]
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
          S,
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
        "text-shadow": ["none", x, Or, jr]
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
        opacity: [vt, it, rt]
      }],
      /**
       * Mix Blend Mode
       * @see https://tailwindcss.com/docs/mix-blend-mode
       */
      "mix-blend": [{
        "mix-blend": [...Wt(), "plus-darker", "plus-lighter"]
      }],
      /**
       * Background Blend Mode
       * @see https://tailwindcss.com/docs/background-blend-mode
       */
      "bg-blend": [{
        "bg-blend": Wt()
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
        "mask-radial": [it, rt]
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
        mask: K()
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
        mask: ["none", it, rt]
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
          rt
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
        brightness: [vt, it, rt]
      }],
      /**
       * Contrast
       * @see https://tailwindcss.com/docs/contrast
       */
      contrast: [{
        contrast: [vt, it, rt]
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
        grayscale: ["", vt, it, rt]
      }],
      /**
       * Hue Rotate
       * @see https://tailwindcss.com/docs/hue-rotate
       */
      "hue-rotate": [{
        "hue-rotate": [vt, it, rt]
      }],
      /**
       * Invert
       * @see https://tailwindcss.com/docs/invert
       */
      invert: [{
        invert: ["", vt, it, rt]
      }],
      /**
       * Saturate
       * @see https://tailwindcss.com/docs/saturate
       */
      saturate: [{
        saturate: [vt, it, rt]
      }],
      /**
       * Sepia
       * @see https://tailwindcss.com/docs/sepia
       */
      sepia: [{
        sepia: ["", vt, it, rt]
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
          rt
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
        "backdrop-brightness": [vt, it, rt]
      }],
      /**
       * Backdrop Contrast
       * @see https://tailwindcss.com/docs/backdrop-contrast
       */
      "backdrop-contrast": [{
        "backdrop-contrast": [vt, it, rt]
      }],
      /**
       * Backdrop Grayscale
       * @see https://tailwindcss.com/docs/backdrop-grayscale
       */
      "backdrop-grayscale": [{
        "backdrop-grayscale": ["", vt, it, rt]
      }],
      /**
       * Backdrop Hue Rotate
       * @see https://tailwindcss.com/docs/backdrop-hue-rotate
       */
      "backdrop-hue-rotate": [{
        "backdrop-hue-rotate": [vt, it, rt]
      }],
      /**
       * Backdrop Invert
       * @see https://tailwindcss.com/docs/backdrop-invert
       */
      "backdrop-invert": [{
        "backdrop-invert": ["", vt, it, rt]
      }],
      /**
       * Backdrop Opacity
       * @see https://tailwindcss.com/docs/backdrop-opacity
       */
      "backdrop-opacity": [{
        "backdrop-opacity": [vt, it, rt]
      }],
      /**
       * Backdrop Saturate
       * @see https://tailwindcss.com/docs/backdrop-saturate
       */
      "backdrop-saturate": [{
        "backdrop-saturate": [vt, it, rt]
      }],
      /**
       * Backdrop Sepia
       * @see https://tailwindcss.com/docs/backdrop-sepia
       */
      "backdrop-sepia": [{
        "backdrop-sepia": ["", vt, it, rt]
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
        transition: ["", "all", "colors", "opacity", "shadow", "transform", "none", it, rt]
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
        duration: [vt, "initial", it, rt]
      }],
      /**
       * Transition Timing Function
       * @see https://tailwindcss.com/docs/transition-timing-function
       */
      ease: [{
        ease: ["linear", "initial", N, it, rt]
      }],
      /**
       * Transition Delay
       * @see https://tailwindcss.com/docs/transition-delay
       */
      delay: [{
        delay: [vt, it, rt]
      }],
      /**
       * Animation
       * @see https://tailwindcss.com/docs/animation
       */
      animate: [{
        animate: ["none", D, it, rt]
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
        perspective: [_, it, rt]
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
        skew: He()
      }],
      /**
       * Skew X
       * @see https://tailwindcss.com/docs/skew
       */
      "skew-x": [{
        "skew-x": He()
      }],
      /**
       * Skew Y
       * @see https://tailwindcss.com/docs/skew
       */
      "skew-y": [{
        "skew-y": He()
      }],
      /**
       * Transform
       * @see https://tailwindcss.com/docs/transform
       */
      transform: [{
        transform: [it, rt, "", "none", "gpu", "cpu"]
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
        zoom: [We, it, rt]
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
        cursor: ["auto", "default", "pointer", "wait", "text", "move", "help", "not-allowed", "none", "context-menu", "progress", "cell", "crosshair", "vertical-text", "alias", "copy", "no-drop", "grab", "grabbing", "all-scroll", "col-resize", "row-resize", "n-resize", "e-resize", "s-resize", "w-resize", "ne-resize", "nw-resize", "se-resize", "sw-resize", "ew-resize", "ns-resize", "nesw-resize", "nwse-resize", "zoom-in", "zoom-out", it, rt]
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
        "will-change": ["auto", "scroll", "contents", "transform", it, rt]
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
        stroke: [vt, yl, ia, rf]
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
}, Cb = /* @__PURE__ */ ib(Tb);
function Ut(...n) {
  return Cb(Jf(n));
}
function Mb(n, l, o) {
  return n.filter((i, s) => s !== l && (i.start + i.end) / 2 < o).length;
}
function Ab(n, l, o, i) {
  const s = n.map(() => 0), d = n[l];
  if (!d) return s;
  const m = n[l + 1], f = n[l - 1], p = d.end - d.start + (m ? m.start - d.end : f ? d.start - f.end : 0);
  return n.forEach((v, S) => {
    l < o && S > l && S <= o ? s[S] = -p : o < l && S >= o && S < l && (s[S] = p);
  }), s[l] = Math.min(Math.max(i, n[0].start - d.start), n[n.length - 1].end - d.end), s;
}
const cf = ["transform", "transition", "zIndex", "filter", "pointerEvents", "position"];
function jb(n, l) {
  for (let o = n.parentElement; o; o = o.parentElement) {
    const i = getComputedStyle(o)[l === "x" ? "overflowX" : "overflowY"];
    if ((i === "auto" || i === "scroll") && (l === "x" ? o.scrollWidth > o.clientWidth : o.scrollHeight > o.clientHeight)) return o;
  }
  return null;
}
function Ob(n, l, o, i) {
  const s = n[l] ? jb(n[l], o) : null, d = () => s ? o === "x" ? s.scrollLeft : s.scrollTop : 0, m = (k) => (o === "x" ? k.clientX : k.clientY) + d(), f = m(i), p = d(), v = n.map((k) => {
    const N = k.getBoundingClientRect();
    return o === "x" ? { start: N.left + p, end: N.right + p } : { start: N.top + p, end: N.bottom + p };
  }), S = n.map((k) => cf.map((N) => k.style[N])), w = typeof matchMedia == "function" && matchMedia("(prefers-reduced-motion: reduce)").matches, x = o === "x" ? "translateX" : "translateY";
  let z = !1;
  const E = { to: l };
  n.forEach((k, N) => {
    if (k.style.pointerEvents = "none", N !== l) {
      w || (k.style.transition = "transform 160ms cubic-bezier(0.2, 0.8, 0.2, 1)");
      return;
    }
    getComputedStyle(k).position === "static" && (k.style.position = "relative"), k.style.zIndex = "30", k.style.filter = "drop-shadow(0 6px 10px rgba(0, 0, 0, 0.45))";
  });
  const _ = (k, N) => {
    E.to = k, Ab(v, l, k, N).forEach((D, O) => {
      n[O].style.transform = D ? `${x}(${D}px)` : "";
    });
  };
  return {
    from: l,
    get to() {
      return E.to;
    },
    slot: (k) => Mb(v, l, m(k)),
    apply: (k, N) => {
      z || _(k, m(N) - f);
    },
    rest: () => {
      z || _(l, 0);
    },
    end: () => {
      z || (z = !0, n.forEach((k, N) => cf.forEach((D, O) => {
        k.style[D] = S[N][O];
      })));
    }
  };
}
const Rb = 5;
let Io = !1;
function Db(n, l) {
  if (n.button !== 0 || Io) return;
  const o = { clientX: n.clientX, clientY: n.clientY }, i = n.currentTarget, s = n.pointerId;
  let d = null, m, f = !1;
  const p = { cursor: document.body.style.cursor, userSelect: document.body.style.userSelect }, v = (E) => {
    if (f) return;
    f = !0, window.removeEventListener("pointermove", S), window.removeEventListener("pointerup", w), window.removeEventListener("pointercancel", x), window.removeEventListener("keydown", z, !0), window.removeEventListener("blur", x), i.removeEventListener("lostpointercapture", x);
    try {
      i.releasePointerCapture(s);
    } catch {
    }
    if (!d) return;
    Io = !1, document.body.style.cursor = p.cursor, document.body.style.userSelect = p.userSelect, d.end();
    const _ = (k) => k.stopPropagation();
    window.addEventListener("click", _, { capture: !0, once: !0 }), setTimeout(() => window.removeEventListener("click", _, !0), 0), m?.(), l.onEnd(E, d);
  }, S = (E) => {
    if (!d) {
      if (Math.hypot(E.clientX - o.clientX, E.clientY - o.clientY) < Rb) return;
      const _ = l.items();
      d = Ob(_, l.from(_), l.axis, o), Io = !0, document.body.style.cursor = "grabbing", document.body.style.userSelect = "none";
      try {
        i.setPointerCapture(s);
      } catch {
      }
      i.addEventListener("lostpointercapture", x);
      const k = l.onStart?.();
      m = typeof k == "function" ? k : void 0;
    }
    l.onMove(E, d);
  }, w = () => v(!0), x = () => v(!1), z = (E) => {
    E.key === "Escape" && (E.stopPropagation(), v(!1));
  };
  window.addEventListener("pointermove", S), window.addEventListener("pointerup", w), window.addEventListener("pointercancel", x), window.addEventListener("keydown", z, !0), window.addEventListener("blur", x);
}
const cm = typeof navigator < "u" && /Mac/i.test(navigator.platform), Ir = {
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
for (let n = 1; n <= 12; n++) Ir[`f${n}`] = `F${n}`;
const Hb = Object.fromEntries(Object.entries(Ir).map(([n, l]) => [l, n])), Bb = {
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
function Ub(n) {
  const l = /^Key([A-Z])$/.exec(n) ?? /^Digit(\d)$/.exec(n);
  return l ? l[1].toLowerCase() : Hb[n];
}
const uf = /* @__PURE__ */ new Map();
function um(n, l = cm) {
  const o = `${l}|${n}`, i = uf.get(o);
  if (i) return i;
  const s = { cmd: !1, ctrl: !1, shift: !1, alt: !1, code: "" };
  for (const d of n.split("+"))
    if (d === "mod")
      l ? s.cmd = !0 : (s.ctrl = !0, s.shift = !0);
    else if (d === "cmd" || d === "ctrl" || d === "shift" || d === "alt") s[d] = !0;
    else if (/^[a-z]$/.test(d))
      s.code = `Key${d.toUpperCase()}`, s.letter = d;
    else if (/^[0-9]$/.test(d)) s.code = `Digit${d}`;
    else if (Ir[d]) s.code = Ir[d];
    else throw new Error(`unknown key "${d}" in "${n}"`);
  if (!s.code) throw new Error(`no key in "${n}"`);
  return uf.set(o, s), s;
}
new Set(["cmd+q", "cmd+h", "cmd+alt+h", "cmd+m", "cmd+ctrl+f", "cmd+z", "cmd+shift+z", "cmd+x", "cmd+c", "cmd+v", "cmd+a"].map((n) => {
  const l = um(n, !0);
  return [l.cmd && "cmd", l.ctrl && "ctrl", l.alt && "alt", l.shift && "shift", l.code].filter(Boolean).join("+");
}));
function qb(n, l = cm) {
  const o = um(n, l), i = Yb(Ub(o.code) ?? "");
  return l ? `${o.ctrl ? "⌃" : ""}${o.alt ? "⌥" : ""}${o.shift ? "⇧" : ""}${o.cmd ? "⌘" : ""}${i}` : [o.ctrl && "Ctrl", o.alt && "Alt", o.shift && "Shift", i].filter(Boolean).join("+");
}
const Yb = (n) => Bb[n] ?? n.toUpperCase(), df = (n) => typeof n == "boolean" ? `${n}` : n === 0 ? "0" : n, ff = Jf, ni = (n, l) => (o) => {
  var i;
  if (l?.variants == null) return ff(n, o?.class, o?.className);
  const { variants: s, defaultVariants: d } = l, m = Object.keys(s).map((v) => {
    const S = o?.[v], w = d?.[v];
    if (S === null) return null;
    const x = df(S) || df(w);
    return s[v][x];
  }), f = o && Object.entries(o).reduce((v, S) => {
    let [w, x] = S;
    return x === void 0 || (v[w] = x), v;
  }, {}), p = l == null || (i = l.compoundVariants) === null || i === void 0 ? void 0 : i.reduce((v, S) => {
    let { class: w, className: x, ...z } = S;
    return Object.entries(z).every((E) => {
      let [_, k] = E;
      return Array.isArray(k) ? k.includes({
        ...d,
        ...f
      }[_]) : {
        ...d,
        ...f
      }[_] === k;
    }) ? [
      ...v,
      w,
      x
    ] : v;
  }, []);
  return ff(n, m, p, o?.class, o?.className);
}, Gb = ni(
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
), Lb = ni(
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
function Qb({ className: n, ...l } = {}) {
  return Ut(Lb(l), n);
}
const dm = "shrink-0 cursor-pointer rounded-ui bg-transparent px-[0.2rem] py-[0.1rem] text-[0.8rem] leading-none text-subtext-0 [font-family:inherit] [border:none] [transition:color_0.1s_ease,background_0.1s_ease] hover:bg-surface-1 hover:text-accent", Ns = "cursor-pointer rounded-ui bg-transparent text-subtext-0 [border:0] [font-family:inherit] [transition:color_0.1s_ease,background_0.1s_ease] hover:bg-surface-1 hover:text-fg focus-visible:bg-surface-1 focus-visible:text-fg disabled:cursor-not-allowed disabled:opacity-40", Vb = ni(`${Ns} shrink-0 focus-visible:[outline:2px_solid_var(--accent)] focus-visible:[outline-offset:-2px]`, {
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
function Kb({ className: n, ...l } = {}) {
  return Ut(Vb(l), n);
}
const ai = "overflow-hidden rounded-ui bg-surface-1 py-[0.3rem] shadow-[0_8px_24px_rgba(0,0,0,0.45)]", us = ni(
  "pane-context-menu__item block w-full cursor-pointer bg-transparent px-[0.9rem] py-[0.45rem] text-left text-[0.82rem] [border:none] [font-family:inherit] [transition:background_0.1s_ease] hover:bg-surface-0 disabled:cursor-not-allowed disabled:bg-transparent disabled:opacity-40",
  { variants: { danger: { true: "text-red", false: "text-fg" } }, defaultVariants: { danger: !1 } }
), Xb = "my-1 h-px bg-overlay-0";
function Zb({ size: n = 14, className: l }) {
  return /* @__PURE__ */ tt.jsxs("svg", { className: l, width: n, height: n, viewBox: "0 0 16 16", fill: "currentColor", "aria-hidden": "true", children: [
    /* @__PURE__ */ tt.jsx("circle", { cx: "3.5", cy: "8", r: "1.1" }),
    /* @__PURE__ */ tt.jsx("circle", { cx: "8", cy: "8", r: "1.1" }),
    /* @__PURE__ */ tt.jsx("circle", { cx: "12.5", cy: "8", r: "1.1" })
  ] });
}
function Jb({ size: n = 16, className: l }) {
  return /* @__PURE__ */ tt.jsxs("svg", { className: l, width: n, height: n, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: "1.3", strokeLinejoin: "round", "aria-hidden": "true", children: [
    /* @__PURE__ */ tt.jsx("path", { d: "M6.6 1.8h2.8l.4 1.6 1.1.6 1.5-.6 1.4 2.4-1.2 1.1v1.3l1.2 1.1-1.4 2.4-1.5-.6-1.1.6-.4 1.6H6.6l-.4-1.6-1.1-.6-1.5.6-1.4-2.4 1.2-1.1V7.3L2.2 6.2l1.4-2.4 1.5.6 1.1-.6z" }),
    /* @__PURE__ */ tt.jsx("circle", { cx: "8", cy: "8", r: "2" })
  ] });
}
function Wb({ size: n = 14, className: l }) {
  return /* @__PURE__ */ tt.jsx("svg", { className: l, width: n, height: n, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round", "aria-hidden": "true", children: /* @__PURE__ */ tt.jsx("path", { d: "M3.5 3.5l9 9M12.5 3.5l-9 9" }) });
}
function fm({ size: n = 14, className: l }) {
  return /* @__PURE__ */ tt.jsx("svg", { className: l, width: n, height: n, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round", "aria-hidden": "true", children: /* @__PURE__ */ tt.jsx("path", { d: "M8 2.5v11M2.5 8h11" }) });
}
const mf = {
  connected: "host-state--connected bg-accent",
  connecting: "host-state--connecting animate-host-pulse bg-yellow",
  error: "host-state--error bg-red",
  disabled: "host-state--disabled bg-subtext-0"
};
function Fb({ state: n, error: l }) {
  return /* @__PURE__ */ tt.jsx(
    "span",
    {
      className: Ut("host-state inline-block h-2 w-2 shrink-0 rounded-[50%]", mf[n] ?? mf.disabled),
      title: n === "error" && l ? l : n
    }
  );
}
function Ib({ title: n, onClose: l, children: o, testId: i }) {
  return Tl(
    /* @__PURE__ */ tt.jsx(
      "div",
      {
        className: "fixed inset-0 z-[2100] flex items-center justify-center bg-[rgba(0,0,0,0.55)]",
        onMouseDown: (s) => {
          s.target === s.currentTarget && l();
        },
        onKeyDown: (s) => {
          s.key === "Escape" && l();
        },
        children: /* @__PURE__ */ tt.jsxs(
          "div",
          {
            className: "grid max-h-[85vh] w-[min(30rem,92vw)] gap-[0.6rem] overflow-y-auto rounded-ui bg-panel-bg p-4 shadow-[0_8px_32px_rgba(0,0,0,0.5)]",
            role: "dialog",
            "aria-modal": "true",
            "aria-label": n,
            "data-testid": i,
            children: [
              /* @__PURE__ */ tt.jsx("h2", { className: "m-0 text-[0.9rem] font-semibold text-fg", children: n }),
              o
            ]
          }
        )
      }
    ),
    document.body
  );
}
const Rr = 4, Rn = 8, $b = "flex w-full cursor-pointer items-center justify-between gap-3 px-[0.9rem] py-[0.4rem] text-left text-[0.82rem] text-fg max-[700px]:min-h-11 aria-disabled:cursor-not-allowed aria-disabled:opacity-40", pf = (n) => n.text ?? (typeof n.label == "string" ? n.label : n.value);
function Pb({ value: n, onChange: l, options: o, className: i, ariaLabel: s, testId: d, id: m, title: f, disabled: p, placeholder: v, freeText: S, onKeyDown: w }) {
  const x = et.useId(), [z, E] = et.useState(!1), [_, k] = et.useState(-1), [N, D] = et.useState(!1), O = et.useRef(null), X = et.useRef(null), [q, H] = et.useState({}), h = et.useRef({ text: "", at: 0 }), b = S && N && n ? o.filter((L) => pf(L).toLowerCase().includes(n.toLowerCase()) || L.value.toLowerCase().includes(n.toLowerCase())) : o, y = o.find((L) => L.value === n), A = (L) => `${x}-${L}`;
  function j(L) {
    p || (k(L), E(!0));
  }
  function M() {
    E(!1), D(!1), k(-1);
  }
  function U(L) {
    !L || L.disabled || (l(L.value), M());
  }
  function Z(L, V) {
    for (let T = 1; T <= b.length; T++) {
      const K = (L + V * T + b.length * T) % b.length;
      if (!b[K].disabled) return K;
    }
    return L;
  }
  const F = () => b.findIndex((L) => !L.disabled), Q = () => b.length - 1 - [...b].reverse().findIndex((L) => !L.disabled);
  Vr(() => {
    if (!z || !O.current) {
      H((at) => at.left === void 0 ? at : {});
      return;
    }
    const L = O.current.getBoundingClientRect(), V = window.innerHeight - L.bottom - Rr - Rn, T = L.top - Rr - Rn, K = V < 160 && T > V;
    H({
      position: "fixed",
      left: Math.min(Math.max(Rn, L.left), Math.max(Rn, window.innerWidth - L.width - Rn)),
      // As wide as its longest label (a session title, a path), never wider than the window.
      width: "max-content",
      minWidth: L.width,
      maxWidth: window.innerWidth - 2 * Rn,
      maxHeight: Math.min(K ? T : V, 320),
      ...K ? { bottom: window.innerHeight - L.top + Rr } : { top: L.bottom + Rr },
      overflowY: "auto"
    });
  }, [z, b.length]), Vr(() => {
    const L = X.current;
    if (!z || !L || q.left === void 0) return;
    const V = L.getBoundingClientRect().right, T = window.innerWidth - Rn;
    V > T && H((K) => ({ ...K, left: Math.max(Rn, Number(K.left) - (V - T)) }));
  }, [z, q]), oe(() => {
    if (!z) return;
    const L = (V) => {
      const T = V.target;
      (T === document || T instanceof Node && O.current && T.contains(O.current)) && M();
    };
    return window.addEventListener("resize", M), window.addEventListener("scroll", L, !0), () => {
      window.removeEventListener("resize", M), window.removeEventListener("scroll", L, !0);
    };
  }, [z]), oe(() => {
    const L = z && _ >= 0 ? document.getElementById(A(_)) : null, V = X.current;
    !L || !V || (L.offsetTop < V.scrollTop ? V.scrollTop = L.offsetTop : L.offsetTop + L.offsetHeight > V.scrollTop + V.clientHeight && (V.scrollTop = L.offsetTop + L.offsetHeight - V.clientHeight));
  }, [z, _]), hm(z, (L) => {
    L || M();
  }, O, X);
  function J(L) {
    if (L.nativeEvent.isComposing) return;
    const V = () => {
      L.preventDefault(), L.stopPropagation();
    }, { key: T } = L;
    if (z) {
      if (T === "Escape") {
        V(), M();
        return;
      } else if (T === "Tab")
        M();
      else if (T === "ArrowDown" || T === "ArrowUp") {
        V(), b.length && k(_ < 0 ? T === "ArrowDown" ? F() : Q() : Z(_, T === "ArrowDown" ? 1 : -1));
        return;
      } else if (T === "Home" && !S) {
        V(), k(F());
        return;
      } else if (T === "End" && !S) {
        V(), k(Q());
        return;
      } else if (T === "Enter" || T === " " && !S) {
        if (_ >= 0 && b[_]) {
          V(), U(b[_]);
          return;
        }
        if (!S) {
          V(), M();
          return;
        }
      } else if (!S && T.length === 1 && !L.metaKey && !L.ctrlKey && !L.altKey) {
        const K = Date.now();
        h.current = { text: (K - h.current.at > 600 ? "" : h.current.text) + T.toLowerCase(), at: K };
        const at = Math.max(_, 0), st = [...b.slice(at + (h.current.text.length === 1 ? 1 : 0)), ...b.slice(0, at + 1)].find((ct) => !ct.disabled && pf(ct).toLowerCase().startsWith(h.current.text));
        st && (V(), k(b.indexOf(st)));
        return;
      }
    } else if (T === "ArrowDown" || T === "ArrowUp" || !S && (T === "Enter" || T === " ")) {
      V(), j(Math.max(0, b.findIndex((K) => K.value === n)));
      return;
    }
    w?.(L);
  }
  const I = {
    ref: (L) => {
      O.current = L;
    },
    id: m,
    title: f,
    disabled: p,
    "aria-label": s,
    "aria-expanded": z,
    "aria-controls": z ? x : void 0,
    "aria-activedescendant": z && _ >= 0 ? A(_) : void 0,
    "data-testid": d,
    onKeyDown: J
  };
  return /* @__PURE__ */ tt.jsxs(tt.Fragment, { children: [
    S ? /* @__PURE__ */ tt.jsx(
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
        onChange: (L) => {
          l(L.target.value), D(!0), z ? k(-1) : (k(-1), E(!0));
        },
        onBlur: () => M()
      }
    ) : /* @__PURE__ */ tt.jsxs(
      "button",
      {
        ...I,
        type: "button",
        role: "combobox",
        "aria-haspopup": "listbox",
        "data-value": n,
        className: Ut("inline-flex items-center justify-between gap-2 text-left [font-family:inherit] cursor-pointer disabled:cursor-not-allowed disabled:opacity-50", i),
        onClick: () => z ? M() : j(Math.max(0, b.findIndex((L) => L.value === n))),
        children: [
          /* @__PURE__ */ tt.jsx("span", { className: "min-w-0 flex-1 truncate", children: y ? y.label : v ?? "" }),
          /* @__PURE__ */ tt.jsx(Ms, { open: !0, className: "shrink-0 text-subtext-0" })
        ]
      }
    ),
    z && b.length > 0 && Tl(
      /* @__PURE__ */ tt.jsx(
        "div",
        {
          ref: X,
          id: x,
          role: "listbox",
          "aria-label": s,
          className: Ut("z-[9999]", ai),
          style: q,
          onMouseDown: (L) => {
            L.preventDefault(), L.stopPropagation();
          },
          onClick: (L) => L.stopPropagation(),
          children: b.map((L, V) => /* @__PURE__ */ tt.jsxs(
            "div",
            {
              id: A(V),
              role: "option",
              "aria-selected": L.value === n,
              "aria-disabled": L.disabled || void 0,
              "data-value": L.value,
              className: Ut($b, V === _ && !L.disabled && "bg-surface-0"),
              onMouseEnter: () => {
                L.disabled || k(V);
              },
              onClick: () => U(L),
              children: [
                /* @__PURE__ */ tt.jsx("span", { className: "min-w-0 truncate", children: L.label }),
                L.value === n && /* @__PURE__ */ tt.jsx("span", { "aria-hidden": "true", className: "shrink-0 text-accent", children: "✓" })
              ]
            },
            L.value
          ))
        }
      ),
      document.body
    )
  ] });
}
const hf = 230, tv = 370;
function ev({ x: n, y: l, readOnly: o, canUndo: i, canRedo: s, hasSelection: d, onClose: m, actions: f }) {
  const p = et.useRef(null);
  oe(() => {
    const x = (E) => {
      p.current?.contains(E.target) || m();
    }, z = (E) => {
      E.key === "Escape" && (E.preventDefault(), m());
    };
    return document.addEventListener("mousedown", x), document.addEventListener("keydown", z), window.addEventListener("blur", m), window.addEventListener("resize", m), () => {
      document.removeEventListener("mousedown", x), document.removeEventListener("keydown", z), window.removeEventListener("blur", m), window.removeEventListener("resize", m);
    };
  }, [m]);
  const v = (x, z) => ps(ym ? x : z), S = (x, z, E, _, k = !1) => /* @__PURE__ */ tt.jsxs("button", { type: "button", className: Ut(xm(), "flex items-center justify-between gap-6"), "data-testid": E, disabled: k, onClick: z, children: [
    /* @__PURE__ */ tt.jsx("span", { children: x }),
    /* @__PURE__ */ tt.jsx("span", { className: "text-[0.72rem] text-subtext-0", children: _ })
  ] }), w = f.askAgent;
  return Tl(
    /* @__PURE__ */ tt.jsxs(
      "div",
      {
        ref: p,
        className: ai,
        "data-testid": "editor-context-menu",
        style: {
          position: "fixed",
          top: Math.max(8, Math.min(l, window.innerHeight - tv - 8)),
          left: Math.max(8, Math.min(n, window.innerWidth - hf - 8)),
          zIndex: 9999,
          minWidth: hf
        },
        onContextMenu: (x) => x.preventDefault(),
        children: [
          w && /* @__PURE__ */ tt.jsxs(tt.Fragment, { children: [
            S(d ? "Ask agent about selection…" : "Ask agent about file…", w, "editor-menu-ask-agent", ""),
            /* @__PURE__ */ tt.jsx("div", { className: Qr })
          ] }),
          S("Undo", f.undo, "editor-menu-undo", v("cmd+z", "ctrl+z"), o || !i),
          S("Redo", f.redo, "editor-menu-redo", v("cmd+shift+z", "ctrl+y"), o || !s),
          /* @__PURE__ */ tt.jsx("div", { className: Qr }),
          S("Cut", f.cut, "editor-menu-cut", v("cmd+x", "ctrl+x"), o || !d),
          S("Copy", f.copy, "editor-menu-copy", v("cmd+c", "ctrl+c"), !d),
          S("Paste", f.paste, "editor-menu-paste", v("cmd+v", "ctrl+v"), o),
          S("Select All", f.selectAll, "editor-menu-select-all", v("cmd+a", "ctrl+a")),
          /* @__PURE__ */ tt.jsx("div", { className: Qr }),
          S("Find…", f.find, "editor-menu-find", v("cmd+f", "ctrl+f")),
          !o && S("Replace…", f.replace, "editor-menu-replace", v("cmd+alt+f", "ctrl+h")),
          S("Go to Line…", f.gotoLine, "editor-menu-goto", ps("ctrl+g"))
        ]
      }
    ),
    document.body
  );
}
const nv = "box-border min-h-[44px] cursor-pointer rounded-ui bg-transparent px-[0.7rem] py-[0.45rem] text-subtext-0 no-underline [border:0] [font-family:inherit] [font-weight:inherit] [line-height:inherit] text-[0.85rem] hover:bg-surface-1 hover:text-fg focus-visible:[outline:2px_solid_var(--accent)] focus-visible:[outline-offset:2px] disabled:cursor-default disabled:opacity-[0.55]", av = "m-0 mt-[0.4rem] text-[0.78rem] text-subtext-0", lv = "m-0 mb-2 text-[0.82rem] text-subtext-0", mm = "rounded-ui bg-surface-1 text-fg [font-family:inherit]", Ts = `${mm} px-2 py-[0.3rem] text-[0.8rem] max-[700px]:min-h-11 focus:[outline:1px_solid_var(--accent)]`, rv = `${Ts} min-w-[5.5rem] shrink-0`, Cs = `${mm} min-w-0 px-[0.55rem] py-[0.35rem] text-[0.82rem] max-[700px]:min-h-11 focus:[outline:1px_solid_var(--accent)]`, iv = `${Cs} flex-1 max-[700px]:flex-[1_1_100%]`, ov = `${Cs} w-20 flex-[0_0_5rem] max-[700px]:w-24 max-[700px]:flex-[1_1_6rem]`, sv = `${Cs} flex-[1_1_100%]`, cv = "flex flex-wrap items-center gap-[0.4rem]", uv = "m-0 mb-2 flex list-none flex-col gap-[0.3rem] p-0", dv = "flex items-center gap-2 max-[700px]:flex-wrap rounded-ui bg-surface-1 px-2 py-[0.35rem] text-[0.82rem]", fv = `settings-modal__host-row ${dv}`, mv = "min-w-0 overflow-hidden font-semibold text-ellipsis whitespace-nowrap text-fg", pv = "min-w-0 flex-1 max-[700px]:basis-full overflow-hidden text-[0.78rem] text-ellipsis whitespace-nowrap text-subtext-0", pm = "shrink-0 cursor-pointer rounded-ui px-[0.7rem] py-[0.35rem] max-[700px]:min-h-11 text-[0.82rem] font-semibold text-panel-bg [border:none] [font-family:inherit] [transition:opacity_0.12s_ease] hover:opacity-[0.85]", hv = `${pm} bg-accent`, gv = `${pm} ml-auto bg-red`;
function Ms({ open: n, size: l = 12, className: o }) {
  return /* @__PURE__ */ tt.jsx("svg", { className: o, width: l, height: l, viewBox: "0 0 12 12", fill: "none", stroke: "currentColor", strokeWidth: "1.3", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true", children: /* @__PURE__ */ tt.jsx("path", { d: n ? "M2.5 4.5 6 8l3.5-3.5" : "M4.5 2.5 8 6l-3.5 3.5" }) });
}
function bv({ label: n, items: l, testId: o, side: i = "right", up: s = !1, maxHeight: d = 320 }) {
  const [m, f] = et.useState(!1), [p, v] = et.useState(!1), S = et.useRef(null), w = et.useRef(null), x = () => [...w.current?.querySelectorAll('[role="menuitem"]') ?? []];
  oe(() => {
    m && p && (x()[0]?.focus(), v(!1));
  }, [m, p]);
  const z = () => {
    f(!0), v(!0);
  }, E = (k) => {
    (k.key === "ArrowRight" || k.key === "Enter" || k.key === " ") && (k.preventDefault(), z());
  }, _ = (k) => {
    const N = x(), D = N.findIndex((O) => O === document.activeElement);
    k.key === "ArrowDown" || k.key === "ArrowUp" ? (k.preventDefault(), N[(D + (k.key === "ArrowDown" ? 1 : N.length - 1)) % N.length]?.focus()) : (k.key === "ArrowLeft" || k.key === "Escape") && (k.preventDefault(), k.stopPropagation(), f(!1), S.current?.focus());
  };
  return /* @__PURE__ */ tt.jsxs("div", { className: "group/submenu relative", children: [
    /* @__PURE__ */ tt.jsxs(
      "button",
      {
        ref: S,
        type: "button",
        role: "menuitem",
        "aria-haspopup": "menu",
        "aria-expanded": m,
        className: Ut(us(), "flex items-center justify-between gap-2"),
        "data-testid": o,
        onClick: () => m ? f(!1) : z(),
        onKeyDown: E,
        children: [
          /* @__PURE__ */ tt.jsx("span", { className: "truncate", children: n }),
          /* @__PURE__ */ tt.jsx(Ms, { open: !1, size: 10 })
        ]
      }
    ),
    /* @__PURE__ */ tt.jsx(
      "div",
      {
        ref: w,
        role: "menu",
        "aria-label": n,
        className: Ut(
          ai,
          "absolute z-10 w-60 overflow-y-auto",
          i === "right" ? "left-full" : "right-full",
          s ? "bottom-0" : "top-0",
          m ? "block" : "hidden group-hover/submenu:block"
        ),
        style: { maxHeight: d },
        onKeyDown: _,
        children: l.map((k) => /* @__PURE__ */ tt.jsx("button", { type: "button", role: "menuitem", className: us(), "data-testid": k.testId, onClick: k.onSelect, children: /* @__PURE__ */ tt.jsx("span", { className: "block truncate", children: k.label }) }, k.key))
      }
    )
  ] });
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
  return !!n.parentSessionId && n.parentSessionId !== n.id && l.some((o) => o.id === n.parentSessionId);
}
function yv(n) {
  const l = /* @__PURE__ */ new Map();
  for (const o of n)
    fs(o, n) && l.set(o.parentSessionId, [...l.get(o.parentSessionId) ?? [], o]);
  return l.size ? n.filter((o) => !fs(o, n)).flatMap((o) => [o, ...l.get(o.id) ?? []]) : n;
}
const Dr = 6, gf = 8;
function xv(n, l = {}) {
  const { minWidth: o = 220, align: i = "right", minSpaceAbove: s = 100 } = l, d = n.getBoundingClientRect(), m = window.innerWidth, f = window.innerHeight, p = i === "right" ? { right: Math.max(0, m - d.right) } : { left: Math.max(0, d.left) }, v = d.top - Dr - gf, S = f - d.bottom - Dr - gf;
  return v >= s ? {
    position: "fixed",
    bottom: f - d.top + Dr,
    ...p,
    minWidth: o,
    maxHeight: Math.min(v, f * 0.75),
    overflowY: "auto"
  } : {
    position: "fixed",
    top: d.bottom + Dr,
    ...p,
    minWidth: o,
    maxHeight: Math.min(S, f * 0.75),
    overflowY: "auto"
  };
}
function hm(n, l, o, i) {
  oe(() => {
    if (!n) return;
    function s(m) {
      const f = m.target, p = o.current?.contains(f) ?? !1, v = i.current?.contains(f) ?? !1;
      !p && !v && l(!1);
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
  const [o, i] = et.useState(!1);
  return oe(() => i(!1), [n]), !n || o ? /* @__PURE__ */ tt.jsx(tt.Fragment, { children: l }) : /* @__PURE__ */ tt.jsx("img", { src: n, alt: "", width: 14, height: 14, className: "size-[14px] rounded-[2px] object-contain", referrerPolicy: "no-referrer", onError: () => i(!0) });
}
function _v(n, l = !1) {
  const o = n.toLowerCase();
  if (l) return { kind: /^(node_modules|packages|crates|vendor)$/.test(o) ? "package" : o === "lib" ? "library" : "folder", tone: "text-subtext-0" };
  if (/^(package\.json|cargo\.toml|go\.mod|pyproject\.toml|gemfile|composer\.json)$/.test(o)) return { kind: "package", tone: "text-peach" };
  if (/^(dockerfile|containerfile)(\.|$)/.test(o)) return { kind: "package", tone: "text-blue" };
  if (/^(\.gitignore|\.gitattributes|\.gitmodules)$/.test(o)) return { kind: "branch", tone: "text-subtext-0" };
  if (/\.(tsx|jsx)$/.test(o)) return { kind: "react", tone: "text-blue" };
  if (/\.(css|scss|sass|less)$/.test(o)) return { kind: "style", tone: "text-mauve" };
  if (/\.(md|mdx|txt|rst)$/.test(o) || /^(readme|license|copying)(\.|$)/.test(o)) return { kind: "book", tone: "text-subtext-0" };
  if (/\.(json|jsonc|ya?ml|toml|lock|ini|conf)$/.test(o) || /^\.env(\.|$)/.test(o)) return { kind: "config", tone: "text-yellow" };
  if (/\.(png|jpe?g|gif|webp|svg|ico|avif)$/.test(o)) return { kind: "image", tone: "text-mauve" };
  const i = o.split(".").at(-1) ?? "", s = {
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
  }, d = n.includes(".") && Object.hasOwn(s, i) ? s[i] : void 0;
  return d ? { kind: "language", tone: d[1], text: d[0] } : /\.(html?|vue|svelte)$/.test(o) ? { kind: "code", tone: "text-peach" } : { kind: "file", tone: "text-subtext-0" };
}
const kv = {
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
function Sv({ name: n, directory: l = !1, open: o = !1 }) {
  const { kind: i, tone: s, text: d } = _v(n, l);
  return /* @__PURE__ */ tt.jsxs("svg", { className: Ut("size-[calc(14px*var(--zoom,1))] shrink-0", s), "data-file-icon": i, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: "1.25", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true", children: [
    i === "react" ? /* @__PURE__ */ tt.jsxs(tt.Fragment, { children: [
      /* @__PURE__ */ tt.jsx("ellipse", { cx: "8", cy: "8", rx: "7", ry: "2.5" }),
      /* @__PURE__ */ tt.jsx("ellipse", { cx: "8", cy: "8", rx: "7", ry: "2.5", transform: "rotate(60 8 8)" }),
      /* @__PURE__ */ tt.jsx("ellipse", { cx: "8", cy: "8", rx: "7", ry: "2.5", transform: "rotate(120 8 8)" }),
      /* @__PURE__ */ tt.jsx("circle", { cx: "8", cy: "8", r: "1" })
    ] }) : d ? /* @__PURE__ */ tt.jsx("text", { x: "8", y: "11", textAnchor: "middle", fill: "currentColor", stroke: "none", fontSize: "8", fontWeight: "600", fontFamily: "var(--font-mono)", children: d }) : /* @__PURE__ */ tt.jsx("path", { d: i === "folder" && o ? "M2 5V3h4l2 2h5v2M2 7h13l-2 6H2z" : kv[i] }),
    i === "branch" && /* @__PURE__ */ tt.jsxs(tt.Fragment, { children: [
      /* @__PURE__ */ tt.jsx("circle", { cx: "4", cy: "3", r: "1.5" }),
      /* @__PURE__ */ tt.jsx("circle", { cx: "4", cy: "13", r: "1.5" }),
      /* @__PURE__ */ tt.jsx("circle", { cx: "12", cy: "3", r: "1.5" })
    ] }),
    i === "image" && /* @__PURE__ */ tt.jsx("circle", { cx: "10.5", cy: "5", r: "1" })
  ] });
}
const Ev = { unmodified: "", modified: "M", added: "A", deleted: "D", renamed: "R", copied: "C", typeChanged: "T", untracked: "U", ignored: "I", conflicted: "!" }, bf = (n) => typeof n == "string" ? Ev[n] ?? "?" : "?", vf = (n) => typeof n == "string" ? n === "unmodified" ? "unmodified" : n === "typeChanged" ? "type changed" : n : `unknown (${n.unknown})`;
function zv(n) {
  const l = bf(n.index), o = bf(n.worktree), i = l === "!" || o === "!", s = i ? "!" : n.staged && n.unstaged ? `${l || "?"}/${o || "?"}` : n.staged ? l : o || l, d = `Git · Index: ${vf(n.index)}; working tree: ${vf(n.worktree)}${n.originalPath ? `; from ${n.originalPath}` : ""}`, m = i || s.includes("D") ? "text-red" : s === "U" || s === "A" || s === "C" ? "text-green" : s.includes("?") || s === "I" ? "text-subtext-0" : "text-yellow";
  return { label: s, title: d, tone: m };
}
function Nv({ decoration: n, directory: l = !1 }) {
  if (!n) return null;
  if (l && n.containsChanges) return /* @__PURE__ */ tt.jsx("span", { className: Ut("ml-1 size-1 shrink-0 rounded-full", n.conflicted ? "bg-red" : "bg-yellow"), role: "img", "aria-label": n.conflicted ? "Contains Git conflicts" : "Contains Git changes", title: n.conflicted ? "Contains Git conflicts" : "Contains Git changes", "data-testid": "file-git-summary" });
  if (!n.entry) return null;
  const { label: o, title: i, tone: s } = zv(n.entry);
  return o ? /* @__PURE__ */ tt.jsx("span", { className: Ut("ml-1 shrink-0 text-[10px] tabular-nums [font-family:var(--font-mono)]", s), "aria-label": i, title: i, "data-testid": "file-git-marker", children: o }) : null;
}
const Tv = ["application/zip", "application/x-tar", "application/gzip"];
function Cv(n) {
  const l = n ?? "";
  if (l.startsWith("image/")) return "image";
  if (l.startsWith("video/")) return "video";
  if (l.startsWith("audio/")) return "audio";
  if (l === "application/pdf") return "pdf";
  if (Tv.includes(l)) return "archive";
}
const Mv = "mode-switch group ml-auto flex items-center gap-[0.4rem] bg-transparent p-[0.2rem] [border:none] [font-family:inherit]", gm = "text-[0.72rem] font-semibold tracking-[0.03em] text-overlay-1 uppercase [transition:color_0.15s_ease]", Av = `${gm} group-aria-[checked=false]:text-accent`, jv = `${gm} group-aria-checked:text-accent`, Ov = "relative h-[1.3rem] w-[2.4rem] shrink-0 rounded-[999px] border border-overlay-0 bg-surface-1 [transition:background_0.15s_ease] group-aria-checked:border-accent group-aria-checked:bg-panel-bg", Rv = "absolute top-px left-px h-[1.1rem] w-[1.1rem] rounded-[50%] bg-fg [box-shadow:0_1px_2px_rgba(0,0,0,0.3)] [transition:transform_0.15s_ease,background_0.15s_ease] group-aria-checked:bg-accent group-aria-checked:[transform:translateX(1.1rem)]";
function Dv({
  mode: n,
  onChange: l,
  testId: o = "mode-switch",
  disabled: i = !1
}) {
  const s = n === "cli";
  return /* @__PURE__ */ tt.jsxs(
    "button",
    {
      type: "button",
      className: Mv,
      "data-testid": o,
      role: "switch",
      "aria-checked": s,
      "aria-label": "Toggle UI / CLI mode",
      disabled: i,
      onClick: () => l(s ? "ui" : "cli"),
      children: [
        /* @__PURE__ */ tt.jsx("span", { className: Ut("mode-switch__label mode-switch__label--ui", Av), children: "UI" }),
        /* @__PURE__ */ tt.jsx("span", { className: Ut("mode-switch__track", Ov), children: /* @__PURE__ */ tt.jsx("span", { className: Ut("mode-switch__thumb", Rv) }) }),
        /* @__PURE__ */ tt.jsx("span", { className: Ut("mode-switch__label mode-switch__label--cli", jv), children: "CLI" })
      ]
    }
  );
}
const Ya = function(n, l) {
  let s = n;
  const d = wl[l];
  let m = null, f = 0, p = null;
  const v = [], S = {}, w = function(h, b) {
    f = s * 4 + 17, m = (function(y) {
      const A = new Array(y);
      for (let j = 0; j < y; j += 1) {
        A[j] = new Array(y);
        for (let M = 0; M < y; M += 1)
          A[j][M] = null;
      }
      return A;
    })(f), x(0, 0), x(f - 7, 0), x(0, f - 7), _(), E(), N(h, b), s >= 7 && k(h), p == null && (p = X(s, d, v)), D(p, b);
  }, x = function(h, b) {
    for (let y = -1; y <= 7; y += 1)
      if (!(h + y <= -1 || f <= h + y))
        for (let A = -1; A <= 7; A += 1)
          b + A <= -1 || f <= b + A || (0 <= y && y <= 6 && (A == 0 || A == 6) || 0 <= A && A <= 6 && (y == 0 || y == 6) || 2 <= y && y <= 4 && 2 <= A && A <= 4 ? m[h + y][b + A] = !0 : m[h + y][b + A] = !1);
  }, z = function() {
    let h = 0, b = 0;
    for (let y = 0; y < 8; y += 1) {
      w(!0, y);
      const A = Hn.getLostPoint(S);
      (y == 0 || h > A) && (h = A, b = y);
    }
    return b;
  }, E = function() {
    for (let h = 8; h < f - 8; h += 1)
      m[h][6] == null && (m[h][6] = h % 2 == 0);
    for (let h = 8; h < f - 8; h += 1)
      m[6][h] == null && (m[6][h] = h % 2 == 0);
  }, _ = function() {
    const h = Hn.getPatternPosition(s);
    for (let b = 0; b < h.length; b += 1)
      for (let y = 0; y < h.length; y += 1) {
        const A = h[b], j = h[y];
        if (m[A][j] == null)
          for (let M = -2; M <= 2; M += 1)
            for (let U = -2; U <= 2; U += 1)
              M == -2 || M == 2 || U == -2 || U == 2 || M == 0 && U == 0 ? m[A + M][j + U] = !0 : m[A + M][j + U] = !1;
      }
  }, k = function(h) {
    const b = Hn.getBCHTypeNumber(s);
    for (let y = 0; y < 18; y += 1) {
      const A = !h && (b >> y & 1) == 1;
      m[Math.floor(y / 3)][y % 3 + f - 8 - 3] = A;
    }
    for (let y = 0; y < 18; y += 1) {
      const A = !h && (b >> y & 1) == 1;
      m[y % 3 + f - 8 - 3][Math.floor(y / 3)] = A;
    }
  }, N = function(h, b) {
    const y = d << 3 | b, A = Hn.getBCHTypeInfo(y);
    for (let j = 0; j < 15; j += 1) {
      const M = !h && (A >> j & 1) == 1;
      j < 6 ? m[j][8] = M : j < 8 ? m[j + 1][8] = M : m[f - 15 + j][8] = M;
    }
    for (let j = 0; j < 15; j += 1) {
      const M = !h && (A >> j & 1) == 1;
      j < 8 ? m[8][f - j - 1] = M : j < 9 ? m[8][15 - j - 1 + 1] = M : m[8][15 - j - 1] = M;
    }
    m[f - 8][8] = !h;
  }, D = function(h, b) {
    let y = -1, A = f - 1, j = 7, M = 0;
    const U = Hn.getMaskFunction(b);
    for (let Z = f - 1; Z > 0; Z -= 2)
      for (Z == 6 && (Z -= 1); ; ) {
        for (let F = 0; F < 2; F += 1)
          if (m[A][Z - F] == null) {
            let Q = !1;
            M < h.length && (Q = (h[M] >>> j & 1) == 1), U(A, Z - F) && (Q = !Q), m[A][Z - F] = Q, j -= 1, j == -1 && (M += 1, j = 7);
          }
        if (A += y, A < 0 || f <= A) {
          A -= y, y = -y;
          break;
        }
      }
  }, O = function(h, b) {
    let y = 0, A = 0, j = 0;
    const M = new Array(b.length), U = new Array(b.length);
    for (let J = 0; J < b.length; J += 1) {
      const I = b[J].dataCount, L = b[J].totalCount - I;
      A = Math.max(A, I), j = Math.max(j, L), M[J] = new Array(I);
      for (let at = 0; at < M[J].length; at += 1)
        M[J][at] = 255 & h.getBuffer()[at + y];
      y += I;
      const V = Hn.getErrorCorrectPolynomial(L), K = zl(M[J], V.getLength() - 1).mod(V);
      U[J] = new Array(V.getLength() - 1);
      for (let at = 0; at < U[J].length; at += 1) {
        const st = at + K.getLength() - U[J].length;
        U[J][at] = st >= 0 ? K.getAt(st) : 0;
      }
    }
    let Z = 0;
    for (let J = 0; J < b.length; J += 1)
      Z += b[J].totalCount;
    const F = new Array(Z);
    let Q = 0;
    for (let J = 0; J < A; J += 1)
      for (let I = 0; I < b.length; I += 1)
        J < M[I].length && (F[Q] = M[I][J], Q += 1);
    for (let J = 0; J < j; J += 1)
      for (let I = 0; I < b.length; I += 1)
        J < U[I].length && (F[Q] = U[I][J], Q += 1);
    return F;
  }, X = function(h, b, y) {
    const A = yf.getRSBlocks(h, b), j = xf();
    for (let U = 0; U < y.length; U += 1) {
      const Z = y[U];
      j.put(Z.getMode(), 4), j.put(Z.getLength(), Hn.getLengthInBits(Z.getMode(), h)), Z.write(j);
    }
    let M = 0;
    for (let U = 0; U < A.length; U += 1)
      M += A[U].dataCount;
    if (j.getLengthInBits() > M * 8)
      throw "code length overflow. (" + j.getLengthInBits() + ">" + M * 8 + ")";
    for (j.getLengthInBits() + 4 <= M * 8 && j.put(0, 4); j.getLengthInBits() % 8 != 0; )
      j.putBit(!1);
    for (; !(j.getLengthInBits() >= M * 8 || (j.put(236, 8), j.getLengthInBits() >= M * 8)); )
      j.put(17, 8);
    return O(j, A);
  };
  S.addData = function(h, b) {
    b = b || "Byte";
    let y = null;
    switch (b) {
      case "Numeric":
        y = Hv(h);
        break;
      case "Alphanumeric":
        y = Bv(h);
        break;
      case "Byte":
        y = Uv(h);
        break;
      case "Kanji":
        y = qv(h);
        break;
      default:
        throw "mode:" + b;
    }
    v.push(y), p = null;
  }, S.isDark = function(h, b) {
    if (h < 0 || f <= h || b < 0 || f <= b)
      throw h + "," + b;
    return m[h][b];
  }, S.getModuleCount = function() {
    return f;
  }, S.make = function() {
    if (s < 1) {
      let h = 1;
      for (; h < 40; h++) {
        const b = yf.getRSBlocks(h, d), y = xf();
        for (let j = 0; j < v.length; j++) {
          const M = v[j];
          y.put(M.getMode(), 4), y.put(M.getLength(), Hn.getLengthInBits(M.getMode(), h)), M.write(y);
        }
        let A = 0;
        for (let j = 0; j < b.length; j++)
          A += b[j].dataCount;
        if (y.getLengthInBits() <= A * 8)
          break;
      }
      s = h;
    }
    w(!1, z());
  }, S.createTableTag = function(h, b) {
    h = h || 2, b = typeof b > "u" ? h * 4 : b;
    let y = "";
    y += '<table style="', y += " border-width: 0px; border-style: none;", y += " border-collapse: collapse;", y += " padding: 0px; margin: " + b + "px;", y += '">', y += "<tbody>";
    for (let A = 0; A < S.getModuleCount(); A += 1) {
      y += "<tr>";
      for (let j = 0; j < S.getModuleCount(); j += 1)
        y += '<td style="', y += " border-width: 0px; border-style: none;", y += " border-collapse: collapse;", y += " padding: 0px; margin: 0px;", y += " width: " + h + "px;", y += " height: " + h + "px;", y += " background-color: ", y += S.isDark(A, j) ? "#000000" : "#ffffff", y += ";", y += '"/>';
      y += "</tr>";
    }
    return y += "</tbody>", y += "</table>", y;
  }, S.createSvgTag = function(h, b, y, A) {
    let j = {};
    typeof arguments[0] == "object" && (j = arguments[0], h = j.cellSize, b = j.margin, y = j.alt, A = j.title), h = h || 2, b = typeof b > "u" ? h * 4 : b, y = typeof y == "string" ? { text: y } : y || {}, y.text = y.text || null, y.id = y.text ? y.id || "qrcode-description" : null, A = typeof A == "string" ? { text: A } : A || {}, A.text = A.text || null, A.id = A.text ? A.id || "qrcode-title" : null;
    const M = S.getModuleCount() * h + b * 2;
    let U, Z, F, Q, J = "", I;
    for (I = "l" + h + ",0 0," + h + " -" + h + ",0 0,-" + h + "z ", J += '<svg version="1.1" xmlns="http://www.w3.org/2000/svg"', J += j.scalable ? "" : ' width="' + M + 'px" height="' + M + 'px"', J += ' viewBox="0 0 ' + M + " " + M + '" ', J += ' preserveAspectRatio="xMinYMin meet"', J += A.text || y.text ? ' role="img" aria-labelledby="' + q([A.id, y.id].join(" ").trim()) + '"' : "", J += ">", J += A.text ? '<title id="' + q(A.id) + '">' + q(A.text) + "</title>" : "", J += y.text ? '<description id="' + q(y.id) + '">' + q(y.text) + "</description>" : "", J += '<rect width="100%" height="100%" fill="white" cx="0" cy="0"/>', J += '<path d="', F = 0; F < S.getModuleCount(); F += 1)
      for (Q = F * h + b, U = 0; U < S.getModuleCount(); U += 1)
        S.isDark(F, U) && (Z = U * h + b, J += "M" + Z + "," + Q + I);
    return J += '" stroke="transparent" fill="black"/>', J += "</svg>", J;
  }, S.createDataURL = function(h, b) {
    h = h || 2, b = typeof b > "u" ? h * 4 : b;
    const y = S.getModuleCount() * h + b * 2, A = b, j = y - b;
    return Qv(y, y, function(M, U) {
      if (A <= M && M < j && A <= U && U < j) {
        const Z = Math.floor((M - A) / h), F = Math.floor((U - A) / h);
        return S.isDark(F, Z) ? 0 : 1;
      } else
        return 1;
    });
  }, S.createImgTag = function(h, b, y) {
    h = h || 2, b = typeof b > "u" ? h * 4 : b;
    const A = S.getModuleCount() * h + b * 2;
    let j = "";
    return j += "<img", j += ' src="', j += S.createDataURL(h, b), j += '"', j += ' width="', j += A, j += '"', j += ' height="', j += A, j += '"', y && (j += ' alt="', j += q(y), j += '"'), j += "/>", j;
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
  }, H = function(h) {
    h = typeof h > "u" ? 2 : h;
    const y = S.getModuleCount() * 1 + h * 2, A = h, j = y - h;
    let M, U, Z, F, Q;
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
    let L = "";
    for (M = 0; M < y; M += 2) {
      for (Z = Math.floor((M - A) / 1), F = Math.floor((M + 1 - A) / 1), U = 0; U < y; U += 1)
        Q = "█", A <= U && U < j && A <= M && M < j && S.isDark(Z, Math.floor((U - A) / 1)) && (Q = " "), A <= U && U < j && A <= M + 1 && M + 1 < j && S.isDark(F, Math.floor((U - A) / 1)) ? Q += " " : Q += "█", L += h < 1 && M + 1 >= j ? I[Q] : J[Q];
      L += `
`;
    }
    return y % 2 && h > 0 ? L.substring(0, L.length - y - 1) + Array(y + 1).join("▀") : L.substring(0, L.length - 1);
  };
  return S.createASCII = function(h, b) {
    if (h = h || 1, h < 2)
      return H(b);
    h -= 1, b = typeof b > "u" ? h * 2 : b;
    const y = S.getModuleCount() * h + b * 2, A = b, j = y - b;
    let M, U, Z, F;
    const Q = Array(h + 1).join("██"), J = Array(h + 1).join("  ");
    let I = "", L = "";
    for (M = 0; M < y; M += 1) {
      for (Z = Math.floor((M - A) / h), L = "", U = 0; U < y; U += 1)
        F = 1, A <= U && U < j && A <= M && M < j && S.isDark(Z, Math.floor((U - A) / h)) && (F = 0), L += F ? Q : J;
      for (Z = 0; Z < h; Z += 1)
        I += L + `
`;
    }
    return I.substring(0, I.length - 1);
  }, S.renderTo2dContext = function(h, b) {
    b = b || 2;
    const y = S.getModuleCount();
    for (let A = 0; A < y; A++)
      for (let j = 0; j < y; j++)
        h.fillStyle = S.isDark(A, j) ? "black" : "white", h.fillRect(j * b, A * b, b, b);
  }, S;
};
Ya.stringToBytes = function(n) {
  const l = [];
  for (let o = 0; o < n.length; o += 1) {
    const i = n.charCodeAt(o);
    l.push(i & 255);
  }
  return l;
};
Ya.createStringToBytes = function(n, l) {
  const o = (function() {
    const s = Gv(n), d = function() {
      const p = s.read();
      if (p == -1) throw "eof";
      return p;
    };
    let m = 0;
    const f = {};
    for (; ; ) {
      const p = s.read();
      if (p == -1) break;
      const v = d(), S = d(), w = d(), x = String.fromCharCode(p << 8 | v), z = S << 8 | w;
      f[x] = z, m += 1;
    }
    if (m != l)
      throw m + " != " + l;
    return f;
  })(), i = 63;
  return function(s) {
    const d = [];
    for (let m = 0; m < s.length; m += 1) {
      const f = s.charCodeAt(m);
      if (f < 128)
        d.push(f);
      else {
        const p = o[s.charAt(m)];
        typeof p == "number" ? (p & 255) == p ? d.push(p) : (d.push(p >>> 8), d.push(p & 255)) : d.push(i);
      }
    }
    return d;
  };
};
const de = {
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
}, Hn = (function() {
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
  ], l = 1335, o = 7973, i = 21522, s = {}, d = function(m) {
    let f = 0;
    for (; m != 0; )
      f += 1, m >>>= 1;
    return f;
  };
  return s.getBCHTypeInfo = function(m) {
    let f = m << 10;
    for (; d(f) - d(l) >= 0; )
      f ^= l << d(f) - d(l);
    return (m << 10 | f) ^ i;
  }, s.getBCHTypeNumber = function(m) {
    let f = m << 12;
    for (; d(f) - d(o) >= 0; )
      f ^= o << d(f) - d(o);
    return m << 12 | f;
  }, s.getPatternPosition = function(m) {
    return n[m - 1];
  }, s.getMaskFunction = function(m) {
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
  }, s.getErrorCorrectPolynomial = function(m) {
    let f = zl([1], 0);
    for (let p = 0; p < m; p += 1)
      f = f.multiply(zl([1, Bn.gexp(p)], 0));
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
    for (let w = 0; w < f; w += 1)
      for (let x = 0; x < f; x += 1) {
        let z = 0;
        const E = m.isDark(w, x);
        for (let _ = -1; _ <= 1; _ += 1)
          if (!(w + _ < 0 || f <= w + _))
            for (let k = -1; k <= 1; k += 1)
              x + k < 0 || f <= x + k || _ == 0 && k == 0 || E == m.isDark(w + _, x + k) && (z += 1);
        z > 5 && (p += 3 + z - 5);
      }
    for (let w = 0; w < f - 1; w += 1)
      for (let x = 0; x < f - 1; x += 1) {
        let z = 0;
        m.isDark(w, x) && (z += 1), m.isDark(w + 1, x) && (z += 1), m.isDark(w, x + 1) && (z += 1), m.isDark(w + 1, x + 1) && (z += 1), (z == 0 || z == 4) && (p += 3);
      }
    for (let w = 0; w < f; w += 1)
      for (let x = 0; x < f - 6; x += 1)
        m.isDark(w, x) && !m.isDark(w, x + 1) && m.isDark(w, x + 2) && m.isDark(w, x + 3) && m.isDark(w, x + 4) && !m.isDark(w, x + 5) && m.isDark(w, x + 6) && (p += 40);
    for (let w = 0; w < f; w += 1)
      for (let x = 0; x < f - 6; x += 1)
        m.isDark(x, w) && !m.isDark(x + 1, w) && m.isDark(x + 2, w) && m.isDark(x + 3, w) && m.isDark(x + 4, w) && !m.isDark(x + 5, w) && m.isDark(x + 6, w) && (p += 40);
    let v = 0;
    for (let w = 0; w < f; w += 1)
      for (let x = 0; x < f; x += 1)
        m.isDark(x, w) && (v += 1);
    const S = Math.abs(100 * v / f / f - 50) / 5;
    return p += S * 10, p;
  }, s;
})(), Bn = (function() {
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
})(), zl = function(n, l) {
  if (typeof n.length > "u")
    throw n.length + "/" + l;
  const o = (function() {
    let s = 0;
    for (; s < n.length && n[s] == 0; )
      s += 1;
    const d = new Array(n.length - s + l);
    for (let m = 0; m < n.length - s; m += 1)
      d[m] = n[m + s];
    return d;
  })(), i = {};
  return i.getAt = function(s) {
    return o[s];
  }, i.getLength = function() {
    return o.length;
  }, i.multiply = function(s) {
    const d = new Array(i.getLength() + s.getLength() - 1);
    for (let m = 0; m < i.getLength(); m += 1)
      for (let f = 0; f < s.getLength(); f += 1)
        d[m + f] ^= Bn.gexp(Bn.glog(i.getAt(m)) + Bn.glog(s.getAt(f)));
    return zl(d, 0);
  }, i.mod = function(s) {
    if (i.getLength() - s.getLength() < 0)
      return i;
    const d = Bn.glog(i.getAt(0)) - Bn.glog(s.getAt(0)), m = new Array(i.getLength());
    for (let f = 0; f < i.getLength(); f += 1)
      m[f] = i.getAt(f);
    for (let f = 0; f < s.getLength(); f += 1)
      m[f] ^= Bn.gexp(Bn.glog(s.getAt(f)) + d);
    return zl(m, 0).mod(s);
  }, i;
}, yf = (function() {
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
  }, o = {}, i = function(s, d) {
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
  return o.getRSBlocks = function(s, d) {
    const m = i(s, d);
    if (typeof m > "u")
      throw "bad rs block @ typeNumber:" + s + "/errorCorrectionLevel:" + d;
    const f = m.length / 3, p = [];
    for (let v = 0; v < f; v += 1) {
      const S = m[v * 3 + 0], w = m[v * 3 + 1], x = m[v * 3 + 2];
      for (let z = 0; z < S; z += 1)
        p.push(l(w, x));
    }
    return p;
  }, o;
})(), xf = function() {
  const n = [];
  let l = 0;
  const o = {};
  return o.getBuffer = function() {
    return n;
  }, o.getAt = function(i) {
    const s = Math.floor(i / 8);
    return (n[s] >>> 7 - i % 8 & 1) == 1;
  }, o.put = function(i, s) {
    for (let d = 0; d < s; d += 1)
      o.putBit((i >>> s - d - 1 & 1) == 1);
  }, o.getLengthInBits = function() {
    return l;
  }, o.putBit = function(i) {
    const s = Math.floor(l / 8);
    n.length <= s && n.push(0), i && (n[s] |= 128 >>> l % 8), l += 1;
  }, o;
}, Hv = function(n) {
  const l = de.MODE_NUMBER, o = n, i = {};
  i.getMode = function() {
    return l;
  }, i.getLength = function(m) {
    return o.length;
  }, i.write = function(m) {
    const f = o;
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
  return i;
}, Bv = function(n) {
  const l = de.MODE_ALPHA_NUM, o = n, i = {};
  i.getMode = function() {
    return l;
  }, i.getLength = function(d) {
    return o.length;
  }, i.write = function(d) {
    const m = o;
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
  return i;
}, Uv = function(n) {
  const l = de.MODE_8BIT_BYTE, o = Ya.stringToBytes(n), i = {};
  return i.getMode = function() {
    return l;
  }, i.getLength = function(s) {
    return o.length;
  }, i.write = function(s) {
    for (let d = 0; d < o.length; d += 1)
      s.put(o[d], 8);
  }, i;
}, qv = function(n) {
  const l = de.MODE_KANJI, o = Ya.stringToBytes;
  (function(d, m) {
    const f = o(d);
    if (f.length != 2 || (f[0] << 8 | f[1]) != m)
      throw "sjis not supported.";
  })("友", 38726);
  const i = o(n), s = {};
  return s.getMode = function() {
    return l;
  }, s.getLength = function(d) {
    return ~~(i.length / 2);
  }, s.write = function(d) {
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
  }, s;
}, bm = function() {
  const n = [], l = {};
  return l.writeByte = function(o) {
    n.push(o & 255);
  }, l.writeShort = function(o) {
    l.writeByte(o), l.writeByte(o >>> 8);
  }, l.writeBytes = function(o, i, s) {
    i = i || 0, s = s || o.length;
    for (let d = 0; d < s; d += 1)
      l.writeByte(o[d + i]);
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
}, Yv = function() {
  let n = 0, l = 0, o = 0, i = "";
  const s = {}, d = function(f) {
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
  return s.writeByte = function(f) {
    for (n = n << 8 | f & 255, l += 8, o += 1; l >= 6; )
      d(n >>> l - 6), l -= 6;
  }, s.flush = function() {
    if (l > 0 && (d(n << 6 - l), n = 0, l = 0), o % 3 != 0) {
      const f = 3 - o % 3;
      for (let p = 0; p < f; p += 1)
        i += "=";
    }
  }, s.toString = function() {
    return i;
  }, s;
}, Gv = function(n) {
  const l = n;
  let o = 0, i = 0, s = 0;
  const d = {};
  d.read = function() {
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
    const f = i >>> s - 8 & 255;
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
}, Lv = function(n, l) {
  const o = n, i = l, s = new Array(n * l), d = {};
  d.setPixel = function(v, S, w) {
    s[S * o + v] = w;
  }, d.write = function(v) {
    v.writeString("GIF87a"), v.writeShort(o), v.writeShort(i), v.writeByte(128), v.writeByte(0), v.writeByte(0), v.writeByte(0), v.writeByte(0), v.writeByte(0), v.writeByte(255), v.writeByte(255), v.writeByte(255), v.writeString(","), v.writeShort(0), v.writeShort(0), v.writeShort(o), v.writeShort(i), v.writeByte(0);
    const S = 2, w = f(S);
    v.writeByte(S);
    let x = 0;
    for (; w.length - x > 255; )
      v.writeByte(255), v.writeBytes(w, x, 255), x += 255;
    v.writeByte(w.length - x), v.writeBytes(w, x, w.length - x), v.writeByte(0), v.writeString(";");
  };
  const m = function(v) {
    const S = v;
    let w = 0, x = 0;
    const z = {};
    return z.write = function(E, _) {
      if (E >>> _)
        throw "length over";
      for (; w + _ >= 8; )
        S.writeByte(255 & (E << w | x)), _ -= 8 - w, E >>>= 8 - w, x = 0, w = 0;
      x = E << w | x, w = w + _;
    }, z.flush = function() {
      w > 0 && S.writeByte(x);
    }, z;
  }, f = function(v) {
    const S = 1 << v, w = (1 << v) + 1;
    let x = v + 1;
    const z = p();
    for (let D = 0; D < S; D += 1)
      z.add(String.fromCharCode(D));
    z.add(String.fromCharCode(S)), z.add(String.fromCharCode(w));
    const E = bm(), _ = m(E);
    _.write(S, x);
    let k = 0, N = String.fromCharCode(s[k]);
    for (k += 1; k < s.length; ) {
      const D = String.fromCharCode(s[k]);
      k += 1, z.contains(N + D) ? N = N + D : (_.write(z.indexOf(N), x), z.size() < 4095 && (z.size() == 1 << x && (x += 1), z.add(N + D)), N = D);
    }
    return _.write(z.indexOf(N), x), _.write(w, x), _.flush(), E.toByteArray();
  }, p = function() {
    const v = {};
    let S = 0;
    const w = {};
    return w.add = function(x) {
      if (w.contains(x))
        throw "dup key:" + x;
      v[x] = S, S += 1;
    }, w.size = function() {
      return S;
    }, w.indexOf = function(x) {
      return v[x];
    }, w.contains = function(x) {
      return typeof v[x] < "u";
    }, w;
  };
  return d;
}, Qv = function(n, l, o) {
  const i = Lv(n, l);
  for (let f = 0; f < l; f += 1)
    for (let p = 0; p < n; p += 1)
      i.setPixel(p, f, o(p, f));
  const s = bm();
  i.write(s);
  const d = Yv(), m = s.toByteArray();
  for (let f = 0; f < m.length; f += 1)
    d.writeByte(m[f]);
  return d.flush(), "data:image/gif;base64," + d;
};
Ya.stringToBytes;
function Vv({ text: n }) {
  const { size: l, path: o } = et.useMemo(() => {
    const i = Ya(0, "M");
    i.addData(n), i.make();
    const s = i.getModuleCount();
    let d = "";
    for (let m = 0; m < s; m++)
      for (let f = 0; f < s; f++) i.isDark(m, f) && (d += `M${f} ${m}h1v1h-1z`);
    return { size: s, path: d };
  }, [n]);
  return /* @__PURE__ */ tt.jsxs(
    "svg",
    {
      viewBox: `-4 -4 ${l + 8} ${l + 8}`,
      shapeRendering: "crispEdges",
      role: "img",
      "aria-label": "Pairing QR code",
      "data-testid": "pair-qr",
      className: "h-44 w-44 shrink-0 rounded-ui",
      children: [
        /* @__PURE__ */ tt.jsx("rect", { x: -4, y: -4, width: l + 8, height: l + 8, fill: "#fff" }),
        /* @__PURE__ */ tt.jsx("path", { d: o, fill: "#000" })
      ]
    }
  );
}
const Nl = et.createContext(""), ms = (n, l) => typeof n == "string" && n.toLowerCase().includes(l);
function Kv({ title: n, children: l, testId: o, ariaLabel: i }) {
  const s = et.useContext(Nl), d = s !== "" && ms(n, s);
  return (
    // While searching, a group with no matching row (and no matching title) hides itself.
    /* @__PURE__ */ tt.jsxs("section", { className: s && !d ? "mb-8 not-has-[[data-setting-row]]:hidden" : "mb-8", "data-testid": o, "aria-label": i, children: [
      n && /* @__PURE__ */ tt.jsx("h3", { className: "m-0 mb-3 text-[0.9rem] font-medium text-fg", children: n }),
      /* @__PURE__ */ tt.jsx("div", { className: "rounded-ui bg-surface-0 px-4", children: /* @__PURE__ */ tt.jsx(Nl.Provider, { value: d ? "" : s, children: l }) })
    ] })
  );
}
function Xv({ title: n, description: l, children: o, testId: i }) {
  const s = et.useContext(Nl);
  return s && !ms(n, s) && !ms(l, s) ? null : /* @__PURE__ */ tt.jsxs("div", { "data-setting-row": !0, "data-testid": i, className: "flex items-center justify-between gap-6 py-[0.8rem] max-[700px]:flex-wrap max-[700px]:gap-y-2", children: [
    /* @__PURE__ */ tt.jsxs("div", { className: "min-w-0 max-[700px]:flex-1 max-[700px]:basis-56", children: [
      /* @__PURE__ */ tt.jsx("div", { className: "text-[0.85rem] text-fg", children: n }),
      l && /* @__PURE__ */ tt.jsx("div", { className: "mt-[0.15rem] text-[0.75rem] text-subtext-0", children: l })
    ] }),
    o && /* @__PURE__ */ tt.jsx("div", { className: "flex shrink-0 items-center gap-2", children: o })
  ] });
}
function Zv({ checked: n, onChange: l, testId: o, label: i }) {
  return /* @__PURE__ */ tt.jsx(
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
const Jv = () => et.useContext(Nl), Wv = {
  select: Ts,
  selectHost: rv,
  input: iv,
  inputPort: ov,
  inputWide: sv,
  addRow: cv,
  list: uv,
  hostRow: fv,
  name: mv,
  addr: pv,
  muted: av,
  empty: lv,
  primary: hv,
  danger: gv,
  catalogToggle: nv
};
//! State the host keeps for a resource rather than for one view of it (`useResourceState`, `@perch/sdk` 1.4): a
//! review's unsent commit message and comment, its pending batch and its operation id, keyed by the screen's
//! own name for the resource (`review:<workspace>:commit`). Every view and copy that names the same key shares the
//! value, and it outlives a reload or swap of the screen's code, a released hidden copy and the phone/desktop
//! layouts trading places. In memory: a page reload starts empty (durable drafts live in their own services).
const Fv = 512, Fe = /* @__PURE__ */ new Map(), kl = /* @__PURE__ */ new Map();
function vm(n, l) {
  Fe.delete(n), Fe.set(n, l);
  for (const o of Fe.keys()) {
    if (Fe.size <= Fv) break;
    kl.get(o)?.size || Fe.delete(o);
  }
}
function Iv(n, l) {
  return Fe.has(n) ? Fe.get(n) : l;
}
function $v(n, l, o) {
  const i = Iv(n, o), s = typeof l == "function" ? l(i) : l;
  if (!(Fe.has(n) && Object.is(s, i))) {
    vm(n, s);
    for (const d of [...kl.get(n) ?? []]) d();
  }
}
function Pv(n, l) {
  if (typeof n != "string" || !n) throw new Error("useResourceState needs a non-empty key.");
  Fe.has(n) || vm(n, l);
  const o = et.useCallback((d) => {
    const m = kl.get(n) ?? /* @__PURE__ */ new Set();
    return kl.set(n, m), m.add(d), () => {
      m.delete(d), m.size || kl.delete(n);
    };
  }, [n]), i = et.useSyncExternalStore(o, () => Fe.get(n)), s = et.useCallback((d) => $v(n, d, l), [n]);
  return [i, s];
}
const t1 = "[--radius:var(--radius-pane)] rounded-soft bg-surface-1/70 shadow-[0_6px_20px_rgba(0,0,0,0.3)] backdrop-blur-xl backdrop-saturate-150", e1 = "hover:bg-transparent hover:text-subtext-0 active:bg-surface-1 active:text-fg";
//! `@perch/sdk` for the native client: the surface a stock screen imports (the navigation part, 1.3), with every
//! call going to one abstract host object, `globalThis.perch`, read when called (so a host or a test sets it before
//! mounting). Class helpers, icons, `cn`, `keyLabel` and the host dot are the app's own modules, compiled in, so the
//! classes are the web's to the character. Data hooks subscribe to `perch.subscribe` and read the host's snapshots
//! (`perch.navigation(options)`, `perch.hosts()`, ...), which must return the same object until the data changes.
//! Menus and dialogs Perch draws itself (session menu, new session menu, confirm, select, folder browser,
//! instructions, memory) open through `perch.openOverlay(kind, props)`; their callbacks are plain functions.
const n1 = "1.3.0";
let Lr = null;
const a1 = (n) => {
  Lr = n;
};
function kt() {
  const n = (typeof Lr == "function" ? Lr() : Lr) ?? globalThis.perch;
  if (!n) throw new Error("@perch/sdk: no perch host (globalThis.perch) is set");
  return n;
}
const l1 = (n) => kt().subscribe?.(n) ?? (() => {
}), r1 = xv;
function i1() {
  return typeof globalThis.crypto?.randomUUID == "function" ? globalThis.crypto.randomUUID() : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (n) => {
    const l = Math.floor(Math.random() * 16);
    return (n === "x" ? l : l & 3 | 8).toString(16);
  });
}
const ym = globalThis.perch?.isMac !== !1, ps = (n) => qb(n, kt().isMac !== !1), o1 = (n) => Gb(n), s1 = ({ className: n, ...l } = {}) => Ut(Qb(l), n), c1 = Kb, xm = (n) => us(n), Qr = Xb, u1 = Ns, d1 = dm, f1 = (n) => ds[n].color, m1 = (n, l) => kt().shortcutFor?.(n, l) ?? null, p1 = (n) => kt().shortcutLabel?.(n) ?? null, li = (n, l) => kt().command(n, l ?? {}) !== !1, h1 = (n, l, o) => kt().startSession?.(n, l, o), g1 = globalThis.perch?.pickFolder ? (n) => kt().pickFolder(n) : null;
function Kt(n) {
  const l = et.useRef(n);
  return l.current = n, et.useSyncExternalStore(l1, () => l.current(kt()));
}
const wm = (n = {}) => Kt((l) => l.navigation({ showTerminals: !!n.showTerminals, sortByAttention: !!n.sortByAttention })), b1 = () => Kt((n) => n.hosts()), v1 = () => Kt((n) => n.sessionFolders());
function y1() {
  const n = Kt((l) => l.addProject?.() ?? x1);
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
const x1 = Object.freeze({ status: "idle" }), _m = "perch.lastAgentChoice", w1 = Object.freeze({ connected: !1, discovery: !1, state: "ready", choices: [] }), _1 = () => {
  const n = kt().storage?.getItem(_m);
  return n === "claude" || n === "codex" ? n : "claude";
}, k1 = Object.freeze({ items: [] });
function S1() {
  const n = Kt((l) => l.notifications?.() ?? k1);
  return et.useMemo(() => ({
    items: n.items ?? [],
    open: (l) => kt().command("notification.open", { id: l }),
    dismiss: (l) => kt().command("notification.dismiss", { id: l })
  }), [n]);
}
function E1(n) {
  const l = Kt((s) => s.agentChoices?.(n) ?? w1), [o, i] = et.useState(_1);
  return et.useMemo(() => ({
    connected: !!l.connected,
    discovery: !!l.discovery,
    choices: l.choices ?? [],
    lastChoice: o,
    state: l.state ?? "ready",
    error: l.state === "error" ? l.error : void 0,
    rememberChoice: (s) => {
      s !== "claude" && s !== "codex" || (kt().storage?.setItem(_m, s), i(s));
    },
    manage: () => kt().command("agents.manage", {})
  }), [l, o]);
}
function z1(n) {
  oe(() => kt().onRequest?.("add-project", n) ?? void 0, [n]);
}
function N1(n) {
  const l = n.map((o) => ({ id: o.id, parentSessionId: o.parentId, session: o }));
  return yv(l).map((o) => ({ session: o.session, nested: fs(o, l) }));
}
function T1({ id: n, plain: l, className: o }) {
  const i = Kt((v) => v.session(n));
  if (!i) return null;
  const s = i.state ?? vv(i), d = ds[s]?.color ?? ds.unknown.color, m = i.provider, f = m === "claude" || m === "claude-agent-teams" || m === "omp", p = l ? Ut("agent-mark", "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full leading-none", o) : Ut("agent-status-dot", `agent-status-dot--${s}`, "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-[1.5px] bg-panel-bg leading-none", o);
  return et.createElement(
    "span",
    { className: p, style: l ? void 0 : { borderColor: d }, "data-provider": m ?? "unknown", title: l ? m ?? "Agent" : `${m ?? "Agent"} · ${s}`, "aria-hidden": "true" },
    et.createElement("span", { className: Ut("inline-flex text-fg", f && "rounded-full bg-[#161616]") }, et.createElement(km, { provider: m, size: 14 }))
  );
}
function km({ provider: n, size: l = 14 }) {
  const o = kt().agentIcon?.(n, l) ?? null, i = o?.markup ?? '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><circle cx="8" cy="8" r="5" fill="currentColor"/></svg>';
  return et.createElement("svg", { width: l, height: l, "aria-hidden": "true", "data-agent-icon": n ?? "unknown", "data-perch-markup": i, ...o && o.tint === !1 ? { "data-perch-image": "true" } : {} });
}
const C1 = ({ children: n }) => et.createElement(et.Fragment, null, n);
function M1(n, l) {
  const o = et.useRef(l);
  return o.current = l, oe(() => {
    const i = kt();
    if (!i.openOverlay) throw new Error(`@perch/sdk: the host draws no overlays (perch.openOverlay), so ${n} cannot open`);
    const s = {};
    for (const [m, f] of Object.entries(o.current))
      s[m] = typeof f == "function" ? (...p) => o.current[m]?.(...p) : f;
    const d = i.openOverlay(n, s);
    return () => i.closeOverlay?.(d);
  }, [n]), null;
}
const da = (n) => function(o) {
  return M1(n, o);
}, A1 = da("session-menu"), j1 = da("new-session-menu"), O1 = da("confirm");
let Sm = null;
const R1 = (n) => {
  Sm = n;
};
function D1(n) {
  return et.createElement(Sm ?? O1, n);
}
function H1({ className: n = Ts, ...l }) {
  return et.createElement(Pb, { ...l, className: n });
}
let hs = null;
const B1 = (n) => {
  hs = n;
}, U1 = da("folder-browser");
function q1(n) {
  return hs ? et.createElement(hs, { ...n, browse: (l) => kt().browse(n.hostId, l) }) : et.createElement(U1, n);
}
const Y1 = da("instructions"), G1 = da("memory"), L1 = Ib;
let As = null;
const Q1 = (n) => {
  As = n;
};
function V1(n) {
  if (As) return et.createElement(X1, n);
  const { hostId: l, path: o, className: i } = n, s = et.useRef(null);
  return et.createElement(
    "button",
    {
      type: "button",
      ref: s,
      className: Ut("worktree-menu__btn", dm, i),
      "data-testid": `worktree-menu-${l}-${o}`,
      title: "New workspace (a git worktree)",
      "aria-label": "New workspace",
      "aria-expanded": !1,
      onClick: () => kt().openOverlay?.("worktree", { hostId: l, cwd: o, anchor: s.current?.getBoundingClientRect() })
    },
    et.createElement(fm, null)
  );
}
const Em = "Perch did not answer.";
function Hr(n) {
  return n ? n.type === "worktree.error" ? { error: n.message, dirty: !!n.dirty } : n.error ? { error: String(n.error) } : {} : { error: Em };
}
function K1(n, l, o = kt()) {
  const i = (s) => {
    for (const d of s ?? []) {
      if (d.path === l) return d;
      const m = i(d.children);
      if (m) return m;
    }
    return null;
  };
  for (const s of o.navigation({})?.projects ?? []) {
    if (s.hostId !== n) continue;
    const d = i(s.workspaces) ?? i(s.hidden);
    if (d) return d;
  }
  return null;
}
const wf = 5 * 6e4;
function zm(n, l, o, i = kt()) {
  const s = Date.now() + wf;
  let d = !1, m = () => {
  };
  const f = () => {
    d = !0, m(), clearTimeout(v);
  }, p = () => {
    if (!d) {
      if (Date.now() >= s) return f();
      K1(n, l, i) && (f(), i.startSession?.(n, l, o));
    }
  }, v = setTimeout(f, wf);
  m = i.subscribe?.(p) ?? (() => {
  }), p();
}
function X1({ hostId: n, path: l, className: o, worktrees: i, request: s, parentChoices: d, emptyAgent: m, ...f }) {
  const [p, v] = et.useState(i), S = (A) => !!kt().coreCan?.(A, n), w = wm(), x = `${n}:${l}`, z = et.useMemo(() => {
    if (Array.isArray(d)) return d;
    if (!S("workspace.nest")) return [];
    const A = w?.projects?.find((U) => U.hostId === n && U.repoPath === l), j = [], M = (U, Z) => {
      for (const F of U ?? [])
        Z && j.push({ id: F.id, name: F.name, path: F.path }), M(F.children, !0);
    };
    return M(A?.workspaces, !1), j;
  }, [d, w, n, l]), E = n === "local" && S("worktree.job"), _ = f.deleteSupported ?? S("worktree.delete"), k = f.startFromSupported ?? S("worktree.startFrom"), N = Kt((A) => A.emptyWorkspaceAgent?.() ?? void 0), D = m ?? N ?? void 0, O = Kt((A) => A.worktreeMenuRequest?.() ?? null), X = O?.projectKey === x ? O.nonce : null, q = et.useMemo(() => s ?? (X == null ? null : O), [s, X]), [H, h] = et.useState(q);
  oe(() => {
    q && h(q);
  }, [q]);
  const b = et.useRef({});
  b.current = { background: E, deleteSupported: _ };
  const y = et.useMemo(() => {
    const A = (j, M) => kt().ask(j, { hostId: n, repoPath: l, ...M });
    return {
      list: async () => {
        const j = await A("worktree.list", {});
        return j?.type === "worktree.list.result" && v({ worktrees: j.worktrees ?? [], defaultRoot: j.defaultRoot ?? "", baseRef: j.baseRef, refs: j.refs ?? [] }), Hr(j);
      },
      create: async ({ branch: j, newBranch: M, path: U, extra: Z, agent: F }) => {
        const Q = { branch: j, newBranch: !!M, path: U ?? null, name: Z?.name ?? null, startFrom: Z?.startFrom ?? null, parentWorkspaceId: Z?.parentWorkspaceId ?? null }, { background: J } = b.current, I = await A(J ? "worktree.job.start" : "worktree.create", Q), L = J ? "worktree.job.started" : "worktree.done";
        if (I?.type !== L) return { error: Hr(I).error ?? Em };
        const V = J ? I.job?.path : I.path;
        return F && V && zm(n, V, F), { background: J };
      },
      remove: async (j, M) => {
        const U = await A("worktree.remove", { path: j, force: !!M, deleteBranch: b.current.deleteSupported });
        return { ...Hr(U), preservedBranch: U?.type === "worktree.done" ? U.preservedBranch ?? void 0 : void 0 };
      },
      deleteBranch: async (j, M) => Hr(await A("worktree.branch.delete", { branch: j, expectedHead: M })),
      open: (j) => kt().startSession?.(n, j, "terminal"),
      // The window forgets the request; the screen keeps it until a newer one, as clearing it would re-run (and so
      // cancel) the screen's effect that a measurement put off until the next frame (`measured`).
      takeRequest: () => kt().takeWorktreeRequest?.()
    };
  }, [n, l]);
  return et.createElement(As, {
    hostId: n,
    cwd: l,
    projectKey: x,
    className: o,
    worktrees: p,
    background: E,
    startFromSupported: k,
    deleteSupported: _,
    parentChoices: z,
    emptyAgent: D,
    request: H,
    actions: y
  });
}
const Z1 = (n, l) => {
  if (!kt().followPointer?.(n)) return;
  const o = l.items();
  for (const i of o) i.getBoundingClientRect();
  o[0]?.parentElement?.getBoundingClientRect(), Db(n, l);
}, J1 = () => Kt((n) => n.workspaceTabs());
function W1({ metadata: n }) {
  return et.createElement(
    "div",
    { className: "grid content-center justify-items-center gap-1 p-5 text-[0.72rem] text-subtext-0" },
    et.createElement("strong", { className: "text-[0.9rem] text-fg" }, n?.name ?? ""),
    et.createElement("span", null, `${n?.mediaType ?? "file"} · ${n?.size ?? 0} bytes`)
  );
}
function F1({ content: n }) {
  return et.createElement("pre", { className: "m-0 min-h-0 flex-1 overflow-auto p-3 whitespace-pre-wrap text-fg" }, n);
}
const I1 = () => null, $1 = /* @__PURE__ */ new Map(), P1 = ["requestTree", "searchFiles", "openFile", "reloadFile", "requestPreview", "updateDraft", "saveFile", "overwriteFile", "setWrap"];
function ty(n, l = {}) {
  const o = Kt((f) => f.workspaceFiles(n)), i = !!l.git, s = o.git?.decorations, d = et.useMemo(() => i && s?.length ? new Map(s) : $1, [s, i]), m = et.useMemo(() => Object.fromEntries(P1.map((f) => [f, (...p) => (kt().filesDo(f, n, ...p), null)])), [n]);
  return et.useMemo(() => ({
    workspace: o.workspace,
    connected: o.connected,
    trees: o.trees,
    documents: o.documents,
    previews: o.previews,
    search: o.search ?? void 0,
    wrap: o.wrap,
    git: { ...o.git, decorations: d },
    actions: m
  }), [o, d, m]);
}
const ey = () => Kt((n) => n.statusLine()), ny = () => Kt((n) => n.zoom()), ay = () => Kt((n) => n.paneLook()), ly = () => Kt((n) => n.keybindings?.() ?? []), ry = Object.freeze({ usage: Object.freeze([]), updatedAt: 0, spend: null, redeemResult: null });
function iy(n) {
  const l = !!n?.keepFresh, o = Kt((s) => s.statusLine?.().connected ?? !1), i = Kt((s) => s.planUsage?.() ?? ry);
  return oe(() => {
    if (!l || !o) return;
    let s;
    const d = () => {
      kt().command("usage.get"), s = setTimeout(d, 18e4);
    };
    return d(), () => clearTimeout(s);
  }, [l, o]), i;
}
const oy = () => kt().command("usage.get", { force: !0 }), sy = (n) => kt().command("usage.redeemReset", { accountId: n }), cy = () => li("app.zoom_reset"), uy = {
  focused: "bg-[color-mix(in_srgb,var(--text)_10%,var(--panel-bg))] hover:bg-[color-mix(in_srgb,var(--text)_10%,var(--panel-bg))] text-fg font-semibold",
  visible: "bg-transparent text-subtext-0 hover:bg-surface-0 hover:text-fg",
  hidden: "bg-transparent text-subtext-0 hover:bg-surface-0 hover:text-fg"
}, dy = (n, l, o) => kt().beginTabDrag?.(n, l, o);
function fy(n) {
  oe(() => kt().onRequest?.("new-tab", n) ?? void 0, [n]);
}
const my = (n) => li("browser.open", { workspaceId: n }), py = (n, l) => li("file.open", { workspaceId: n, path: l }), hy = () => null, gy = () => null, by = da("new-file");
function vy(n, l) {
  const o = n.selection(l);
  if (o) return o;
  const i = n.value(l), s = i.split(`
`).length - (i.endsWith(`
`) && i.length ? 1 : 0);
  return { text: i, startLine: 1, endLine: Math.max(1, s) };
}
function yy({ onGo: n, onClose: l }) {
  const [o, i] = et.useState(""), s = (d) => {
    d?.preventDefault?.();
    const [m, f] = o.split(":").map((p) => Number.parseInt(p, 10));
    Number.isFinite(m) ? n(m, Number.isFinite(f) ? f : 1) : l();
  };
  return et.createElement(
    "div",
    { className: "flex shrink-0 items-center gap-2 border-b border-border px-3 py-1 text-[0.75rem] text-subtext-0", "data-testid": "editor-goto" },
    et.createElement("label", { htmlFor: "perch-editor-goto" }, "Go to line"),
    et.createElement("input", {
      id: "perch-editor-goto",
      "data-testid": "editor-goto-line",
      autoFocus: !0,
      value: o,
      className: "min-w-0 flex-1 rounded border border-border bg-transparent px-1 text-text",
      onChange: (d) => i(d.target.value),
      onKeyDown: (d) => {
        d.key === "Escape" ? (d.preventDefault(), l()) : d.key === "Enter" && s(d);
      }
    }),
    et.createElement("button", { type: "button", className: Ns, onClick: s }, "OK")
  );
}
function xy({ value: n, onChange: l, onSave: o, onCaret: i, readOnly: s, wrap: d, label: m, path: f, docKey: p, onAskAgent: v, ref: S }) {
  const w = kt().editor, x = et.useRef(null);
  x.current = { onChange: l, onSave: o, onCaret: i, onAskAgent: v };
  const [z, , E] = String(p).split("\0"), _ = !!w && E !== void 0 && /^\d+$/.test(E), k = Kt((y) => _ ? y.workspaceFiles(z)?.carets?.[p] ?? null : null);
  oe(() => {
    k && x.current.onCaret?.({ line: k.line, col: k.col });
  }, [k?.line, k?.col]);
  const N = et.useRef(n), [D, O] = et.useState(null), [X, q] = et.useState(!1), H = () => {
    if (!w || !x.current.onAskAgent) return;
    const { text: y, startLine: A, endLine: j } = vy(w, p);
    x.current.onAskAgent(y, A, j);
  };
  if (et.useImperativeHandle(S, () => ({
    openGoto: () => q(!0),
    focus: () => w?.focus(p),
    askAgent: H
  }), [p]), Vr(() => {
    if (!w) return;
    w.open(p, { path: f, value: n, readonly: !!s, wrap: !!d, label: m }), N.current = n;
    const y = w.watch(p, (A) => {
      for (const j of A)
        if (j.type === "change") {
          const M = w.value(p);
          N.current = M, x.current.onChange?.(M);
        } else j.type === "caret" ? x.current.onCaret?.({ line: j.line, col: j.col }) : j.type === "save" ? x.current.onSave?.() : j.type === "goto" ? q(!0) : j.type === "contextmenu" && O({ x: j.x, y: j.y });
    });
    return () => {
      y(), w.park(p);
    };
  }, [p]), oe(() => {
    !w || _ || n === N.current || (N.current = n, w.setValue(p, n, { external: !0 }));
  }, [p, n]), oe(() => {
    w?.setReadonly(p, !!s);
  }, [p, s]), oe(() => {
    w?.setWrap(p, !!d);
  }, [p, d]), !w)
    return et.createElement("textarea", { className: "h-full min-h-0 w-full flex-1 bg-transparent font-mono text-text", "aria-label": m, value: n, readOnly: s, onChange: (y) => l?.(y.target.value) });
  const h = (y) => () => {
    O(null), y(), w.focus(p);
  }, b = D ? !!w.selection(p) : !1;
  return et.createElement(
    "div",
    { className: "relative flex h-full min-h-0 min-w-0 flex-1 flex-col", "aria-label": m },
    X && et.createElement(yy, {
      onGo: (y, A) => {
        q(!1), w.goTo(p, y, A), w.focus(p);
      },
      onClose: () => {
        q(!1), w.focus(p);
      }
    }),
    et.createElement("div", { "data-perch-engine": "editor", "data-perch-key": p, className: "min-h-0 min-w-0 flex-1" }),
    D && et.createElement(ev, {
      x: D.x,
      y: D.y,
      readOnly: !!s,
      canUndo: w.canUndo(p),
      canRedo: w.canRedo(p),
      hasSelection: b,
      onClose: () => O(null),
      actions: {
        undo: h(() => w.undo(p)),
        redo: h(() => w.redo(p)),
        cut: h(() => w.cut(p)),
        copy: h(() => w.copy(p)),
        paste: h(() => w.paste(p)),
        selectAll: h(() => w.selectAll(p)),
        find: h(() => w.openSearch(p, !1)),
        replace: h(() => w.openSearch(p, !0)),
        gotoLine: () => {
          O(null), q(!0);
        },
        ...v ? { askAgent: () => {
          O(null), H();
        } } : {}
      }
    })
  );
}
const wy = Object.freeze({ pages: [], shownId: null, tabCount: 0 });
function _y(n) {
  const l = Kt((o) => o.browserPages?.(n) ?? wy);
  return et.useMemo(() => {
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
function ky({ pageId: n, active: l }) {
  const o = `drawer
${n}`;
  return oe(() => {
    l && kt().command("browser.focus", { key: o });
  }, [l, o]), et.createElement("div", {
    "data-perch-engine": "browser",
    "data-perch-key": o,
    "data-testid": "browser-page",
    style: { display: "flex", flex: "1 1 0%", minHeight: 0, minWidth: 0 }
  });
}
const By = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  AgentIcon: km,
  BrowserPage: ky,
  Chevron: Ms,
  CloseIcon: Wb,
  CodeEditor: xy,
  ConfirmDialog: D1,
  Dialog: L1,
  EllipsisIcon: Zb,
  FileAsset: W1,
  FileEntryMenu: I1,
  FileIcon: Sv,
  FolderBrowser: q1,
  GearIcon: Jb,
  GitMarker: Nv,
  HostStateDot: Fb,
  InstructionsDialog: Y1,
  MarkdownPreview: F1,
  MemoryDialog: G1,
  ModeSwitch: Dv,
  NewFilePrompt: by,
  NewSessionMenu: j1,
  PageIcon: wv,
  PlusIcon: fm,
  QrCode: Vv,
  Select: H1,
  SessionDot: T1,
  SessionMenu: A1,
  SettingRow: Xv,
  SettingsGroup: Kv,
  SettingsQuery: Nl,
  Slot: C1,
  Submenu: bv,
  Switch: Zv,
  TabDragLayer: gy,
  TabMenu: hy,
  WorktreeMenu: V1,
  agentStateColor: f1,
  anchoredPopoverStyle: r1,
  assetKind: Cv,
  beginReorderDrag: Z1,
  beginTabDrag: dy,
  bindHost: a1,
  buttonClass: c1,
  cn: Ut,
  drawConfirmationsInPlace: R1,
  drawFolderBrowserInPlace: B1,
  drawWorktreeInPlace: Q1,
  ghostButton: u1,
  glassClass: t1,
  iconButton: d1,
  isMac: ym,
  keyLabel: ps,
  menuDividerClass: Qr,
  menuItemClass: xm,
  menuPanel: ai,
  nestSessions: N1,
  newId: i1,
  openBrowserTab: my,
  openFileTab: py,
  pickFolder: g1,
  redeemUsageReset: sy,
  refreshUsage: oy,
  resetZoom: cy,
  rowActionClass: s1,
  runCommand: li,
  segmentClass: o1,
  settingsClass: Wv,
  shortcutFor: m1,
  shortcutLabel: p1,
  startPaneWhenReady: zm,
  startSession: h1,
  tabStateClass: uy,
  tapButtonClass: e1,
  useAddProject: y1,
  useAddProjectRequest: z1,
  useAgentChoices: E1,
  useBrowserPages: _y,
  useDismissOnOutsideClick: hm,
  useHostSnapshot: Kt,
  useHosts: b1,
  useKeybindings: ly,
  useNavigation: wm,
  useNewTabRequest: fy,
  useNotifications: S1,
  usePaneLook: ay,
  usePlanUsage: iy,
  useResourceState: Pv,
  useSessionFolders: v1,
  useSettingsQuery: Jv,
  useStatusLine: ey,
  useWorkspaceFiles: ty,
  useWorkspaceTabs: J1,
  useZoom: ny,
  version: n1
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
const js = {
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
  js[n] = (l, o) => l[n](o);
const Uy = Object.keys(js);
function $o(n, l) {
  for (const [o, i] of Object.entries(l)) {
    const s = js[o];
    if (!s) throw new Error(`the description key ${o} has no GPUI builder`);
    i != null && (n = s(n, i));
  }
  return n;
}
const oa = (n) => ({ clientX: n?.position?.x ?? 0, clientY: n?.position?.y ?? 0 }), _f = /* @__PURE__ */ new WeakSet(), Po = /* @__PURE__ */ new WeakSet();
function kf(n, l, o) {
  const i = n.pressed, s = oa(o);
  return i && i.x === s.clientX && i.y === s.clientY ? i.id : l;
}
function Sy(n, l, o) {
  if (n.name) return n.name;
  if (!(l.size || n.hover || n.focus || n.active || n.track_hover && $r.has(n.group) || o)) return null;
  const i = n.meta?.attrs["data-testid"];
  return i ? `~${n.id}:${i}` : `~${n.id}`;
}
const Nm = (n, l = !1) => (n.children ?? []).some((o) => o.kind === "text" ? !l || /\s/.test(String(o.text ?? "").trim()) : o.kind === "div" && o.style?.flex_direction !== "row" && o.style?.whitespace !== "nowrap" && Nm(o, !0)), Te = (n) => n.style?.display !== "hidden";
let $r = /* @__PURE__ */ new Set(), gs = null;
function Tm(n, l = /* @__PURE__ */ new Set()) {
  for (const { group: o, style: i } of n.group_hover ?? []) "display" in i && l.add(o);
  for (const o of n.children ?? []) o.kind !== "text" && Tm(o, l);
  return l;
}
function bs(n, l, o, i, s = !1, d = !1, m = null, f = {}, p = !1, v = /* @__PURE__ */ new Map(), S = null) {
  if (n.kind === "text") return v.get(n)?.text ?? n.text;
  const w = _f.has(n);
  d ||= n.style.opacity === 0 || n.style.visibility === "invisible" || n.style.display === "hidden", d && (n.name || n.range_name) && (n = { ...n, name: void 0, range_name: void 0, also: void 0 }), n.style.text_color !== void 0 && (S = null), m = n.style.text_color ?? m;
  const x = !!n.hover?.text_color && jm(n), z = n.group ?? (x ? `~g${n.id}` : null);
  x && (S = { group: z, color: n.hover.text_color }), f = { ...f };
  for (const M of ["text_size", "line_height", "whitespace", "text_ellipsis"]) n.style[M] !== void 0 && (f[M] = n.style[M]);
  const E = new Set(n.events ?? []), _ = s ? { count: 0, hits: /* @__PURE__ */ new Set(), at: null } : !d && !n.pointer_none && n.style.position === "absolute" ? gs : null, k = _ ? _.count++ : -1;
  s && (gs = _);
  let N;
  if (n.kind === "image" && !n.markup ? N = l.image(n.src) : N = l.div(), n.kind === "engine" && (N = N.child(i.engine ? i.engine(n.engine, n.key) : l.div())), n.markup && n.kind === "svg" && S && S.color !== m) {
    const { group: M, color: U } = S, Z = () => l.div().absolute().top(0).left(0).size_full();
    N = N.child(Z().group_hover(M, (F) => F.invisible()).child(i.icon(`~icon-${n.id}`, n.markup, m))).child(Z().invisible().group_hover(M, (F) => F.visible()).child(i.icon(`~icon-${n.id}-hover`, n.markup, U)));
  } else n.markup && (N = N.child(i.icon(`~icon-${n.id}`, n.markup, n.kind === "svg" ? m : "")));
  const D = Sy(n, E, !!_);
  if (D && (N = N.id(D)), n.measure && (N = N.measure(n.measure)), n.name && N.also_named) for (const M of n.also ?? []) N = N.also_named(M);
  N = $o(N, { ...n.style, ...v.get(n) });
  const O = f.whitespace !== "nowrap" && !f.text_ellipsis;
  p && O && n.style.flex_shrink !== 0 && n.style.min_w === void 0 && Nm(n) && (N = N.min_w(0));
  for (const M of ["hover", "focus", "active"]) n[M] && (N = N[M]((U) => $o(U, n[M])));
  z && (N = N.group(z));
  for (const { group: M, style: U } of n.group_hover ?? []) {
    const { display: Z, ...F } = U;
    Object.keys(F).length && (N = N.group_hover(M, (Q) => $o(Q, F)));
  }
  if (l.scroll && (n.style.overflow_x === "scroll" || n.style.overflow_y === "scroll")) {
    const M = o.document?.scrollTarget, U = M ? (n.children ?? []).filter(Te).findIndex((Z) => Am(Z, M.id)) : -1;
    if (U >= 0 && (o.scroller ?? n.id) === n.id && (o.document.scrollTarget = null, o.scroller = n.id, l.scroll.scroll_to_item(U)), o.scroller ??= n.id, o.scroller === n.id && o.document) {
      N = N.track_scroll(l.scroll);
      const Z = (n.children ?? []).filter(Te).map((F) => F.id);
      o.document.itemBounds = (F) => Z.includes(F) ? l.scroll.item_bounds?.(Z.indexOf(F)) ?? null : null;
    }
  }
  const X = n.style.overflow_x === "scroll" || n.style.overflow_y === "scroll", q = s && !n.pointer_none || n.blocks_pointer;
  if ((X && Po.has(n) || q) && (N = N.on_scroll_wheel((M, U) => U.stop_propagation?.())), X && E.has("scroll") && (N = N.on_scroll_wheel(() => {
    o.dispatch(n.id, "scroll", {});
  })), X || Po.has(n)) for (const M of n.children ?? []) M.kind !== "text" && Po.add(M);
  n.kind === "input" && !n.disabled && (N = N.on_mouse_down("left", (M, U) => {
    M.bounds && o.setBounds(n.id, M.bounds), o.focus(n.id), U.notify();
  }));
  const H = n.kind === "input" ? n : n.meta?.tag === "label" ? Mm(n) : null;
  H && !H.disabled && /^(checkbox|radio)$/.test(H.input_type) && (N = N.on_click((M, U) => {
    U.stop_propagation?.(), o.toggle(H.id), U.notify();
  }));
  const h = ["click", "double_click", "context_menu", "mouse_down", "mouse_up"].some((M) => E.has(M));
  if (h || w) for (const M of n.children ?? []) M.kind !== "text" && _f.add(M);
  if (h && (N = N.on_mouse_down("left", (M, U) => {
    U.stop_propagation?.(), M.bounds && o.setBounds(n.id, M.bounds);
    const Z = { ...oa(M), button: 0, buttons: 1, detail: M.click_count }, F = kf(o, n.id, M);
    o.pressed = null, o.dispatch(F, "pointerdown", { ...Z, pointerType: "mouse" }), o.dispatch(F, "mousedown", Z) && o.pressFocus?.(F), U.notify();
  }), N = N.on_mouse_down("right", (M, U) => {
    U.stop_propagation?.(), M.bounds && o.setBounds(n.id, M.bounds);
    const Z = kf(o, n.id, M);
    o.pressed = null, o.dispatch(Z, "contextmenu", { ...oa(M), button: 2 }), U.notify();
  }), N = N.on_mouse_up("left", (M, U) => {
    U.stop_propagation?.();
    const Z = { ...oa(M), button: 0 };
    o.dispatch(n.id, "pointerup", { ...Z, pointerType: "mouse" }), o.dispatch(n.id, "mouseup", Z), U.notify();
  }), N = N.on_click((M, U) => {
    o.dispatch(n.id, M.click_count === 2 && E.has("double_click") ? "dblclick" : "click", { detail: M.click_count, button: 0 }), U.notify();
  })), n.blocks_pointer && !h)
    for (const M of ["left", "right"]) N = N.on_mouse_down(M, (U, Z) => Z.stop_propagation?.());
  else if (w && !h)
    for (const M of ["left", "right"])
      N = N.on_mouse_down(M, (U) => {
        const Z = oa(U);
        (o.pressed?.x !== Z.clientX || o.pressed?.y !== Z.clientY) && (o.pressed = { id: n.id, x: Z.clientX, y: Z.clientY });
      });
  if (E.has("mouse_move") && (N = N.on_mouse_move((M) => {
    o.dispatch(n.id, "pointermove", { ...oa(M), pointerType: "mouse" });
  })), n.track_hover && $r.has(n.group) && (N = N.on_hover((M, U) => {
    o.hover(n.id, M), U.notify();
  })), _ && (N = N.on_mouse_down_out((M, U) => {
    const Z = oa(M), F = `${Z.clientX},${Z.clientY}`;
    _.at !== F && (_.at = F, _.hits = /* @__PURE__ */ new Set()), _.hits.add(k), !(_.hits.size < _.count) && (_.at = null, o.dispatch(o.document.body.id, "pointerdown", { ...Z, pointerType: "mouse" }), o.dispatch(o.document.body.id, "mousedown", Z), U.notify());
  })), n.kind === "input" && !/^(checkbox|radio|range|color|file|select)$/.test(n.input_type)) {
    const M = n.value ? String(n.value) : String(n.placeholder ?? "");
    let U = l.div().whitespace_nowrap().overflow_x_hidden();
    const Z = ca(f);
    Z && (U = U.h(Z)), !n.value && m && (U = U.text_color(zy(m))), M && (N = N.child(U.child(n.input_type === "password" && n.value ? "•".repeat([...M].length) : M))), n.field_w && (N = N.child(l.div().w(n.field_w).h(0)));
  }
  const b = f.whitespace === "nowrap" ? ca(f) : null, y = n.style.display === "flex" && !String(n.style.flex_direction ?? "row").startsWith("col");
  let A = !n.range_name;
  const j = n.style.display === "flex" && String(n.style.flex_direction ?? "row").startsWith("col") && (n.style.h === void 0 || n.style.h === "auto") && typeof n.style.max_h == "number";
  for (const M of (n.children ?? []).filter(Te)) {
    const U = M.style?.flex_basis;
    j && M.style.flex_grow > 0 && (U === 0 || typeof U == "string" && U.endsWith("%")) && v.set(M, { ...v.get(M), flex_basis: "auto" });
    let Z = bs(M, l, o, i, !1, d, m, f, y && M.style?.position !== "absolute", v, S);
    const F = !A && (M.kind === "text" || !M.meta), Q = M.kind === "text" ? v.get(M)?.h ?? b : null, J = M.kind === "text" ? v.get(M)?.w : void 0;
    if (F || Q || J !== void 0) {
      let I = l.div();
      F && (I = I.id(n.range_name)), F && !y && n.style.display === "flex" && (I = I[`self_${Ey[f.text_align] ?? "start"}`]().max_w("100%")), Q && (I = I.h(Q)), J !== void 0 && (I = I.w(J).flex_none().whitespace_nowrap()), Z = I.child(Z), A ||= F;
    }
    N = N.child(Z);
  }
  return N;
}
const Ey = { center: "center", right: "end", end: "end" };
function zy(n) {
  const l = String(n);
  if (!/^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(l)) return n;
  const o = l.length === 9 ? Number.parseInt(l.slice(7), 16) : 255;
  return `${l.slice(0, 7)}${Math.round(o / 2).toString(16).padStart(2, "0")}`;
}
const Cm = /^(?:[!-,.-~]+|\S)$/u, Mm = (n) => {
  for (const l of n.children ?? []) {
    if (l.kind === "input" && /^(checkbox|radio)$/.test(l.input_type)) return l;
    const o = l.kind === "text" ? null : Mm(l);
    if (o) return o;
  }
  return null;
}, Am = (n, l) => n.id === l || (n.children ?? []).some((o) => o.kind !== "text" && Am(o, l)), jm = (n) => !!n.markup || (n.children ?? []).some((l) => l.kind !== "text" && jm(l));
function ca(n) {
  const l = n.line_height;
  return typeof l == "string" && l.endsWith("px") ? Number.parseFloat(l) : typeof l == "number" && typeof n.text_size == "number" ? l * n.text_size : null;
}
function qy(n, l, o, i, s = 0, d = !1) {
  const m = [n.root, ...n.overlays];
  $r = /* @__PURE__ */ new Set(), gs = null;
  for (const S of m) Tm(S, $r);
  const f = s > 0 ? Oy(m, s) : /* @__PURE__ */ new Map();
  s > 0 && i.measure && Ny(m, s, i.measure, f), Ay(m, f), My(m, f), i.measure && Cy(m, i.measure, f);
  let p = l.div().relative().size_full().child(bs(n.root, l, o, i, !1, !1, null, {}, !1, f)), v = d && n.overlays.length ? l.div().relative().size_full().window_layer() : p;
  for (const S of n.overlays) v = v.child(bs(S, l, o, i, !0, !1, null, {}, !1, f));
  return v === p ? p : p.child(v);
}
function Ny(n, l, o, i) {
  const s = (E, _) => i.set(E, { ...i.get(E), ..._ }), d = /* @__PURE__ */ new Map(), m = /* @__PURE__ */ new Map(), f = ["text_size", "font_weight", "font_family", "italic", "whitespace", "text_ellipsis"];
  function p(E, _, k) {
    if (E.kind === "text") {
      if (!(_.whitespace === "nowrap" || Cm.test(E.text)) || _.text_ellipsis || k || typeof _.text_size != "number") return NaN;
      const h = o(E.text, { size: _.text_size, weight: _.font_weight ?? 400, family: _.font_family ?? ".SystemUIFont", italic: !!_.italic });
      return Number.isFinite(h) ? h : NaN;
    }
    if (!Te(E) || E.kind === "input" || E.kind === "engine" || E.markup) return v(E);
    const N = { ..._ };
    for (const H of f) E.style[H] !== void 0 && (N[H] = E.style[H]);
    N.text_ellipsis = !!E.style.text_ellipsis, m.set(E, N);
    const D = E.style, O = (E.children ?? []).filter(Le), X = O.map((H) => p(H, N, k || !!E.tabular));
    let q = v(E);
    if (!Number.isFinite(q) && D.w === void 0) {
      const H = O.map((b, y) => X[y] + (b.kind === "text" ? 0 : ot(b.style.ml) + ot(b.style.mr)));
      let h;
      O.length ? Re(E) ? h = O.some((b) => b.kind !== "text" && b.style.flex_grow > 0) || D.flex_wrap === "wrap" ? NaN : H.reduce((b, y) => b + y, 0) + ot(D.gap_x) * (O.length - 1) : h = Math.max(...H) : h = 0, q = h + ot(D.pl) + ot(D.pr) + ot(D.border_l) + ot(D.border_r), typeof D.min_w == "number" && (q = Math.max(q, D.min_w)), typeof D.max_w == "number" && (q = Math.min(q, D.max_w));
    }
    return d.set(E, q), q;
  }
  const v = (E) => typeof E.style?.w == "number" ? E.style.w : NaN, S = () => ({ exact: 0, laid: 0 }), w = (E, _) => {
    if (!Number.isFinite(_))
      return Object.assign(E, S()), NaN;
    E.exact += _;
    const k = Math.round(E.exact * l + 1e-9) / l, N = k - E.laid;
    return E.laid = k, N;
  }, x = (E) => Re(E) && E.style.flex_wrap !== "wrap" && (E.style.justify ?? "start") === "start";
  function z(E) {
    if (!E || E.kind === "text" || !Te(E)) return;
    const _ = (E.children ?? []).filter(Le);
    if (x(E) && _.length > 1) {
      const k = ot(E.style.gap_x), N = S(), D = !(k && _.some((O) => O.kind === "text" || !Number.isFinite(ot(O.style.ml))));
      s(E, { border_l: w(N, ot(E.style.border_l)), pl: w(N, ot(E.style.pl)) }), D && k && s(E, { gap_x: 0 }), _.forEach((O, X) => {
        const q = (X && D ? k : 0) + (O.kind === "text" ? 0 : ot(O.style.ml));
        if (O.kind === "text")
          q && Object.assign(N, S());
        else {
          const y = w(N, q);
          Number.isFinite(y) && s(O, { ml: y });
        }
        const H = O.kind === "text" ? m.get(E) ?? {} : null, h = O.kind === "text" ? p(O, H, !!E.tabular) : d.get(O);
        if ((O.kind === "text" || !(O.style.flex_grow > 0)) && Number.isFinite(h)) {
          const y = { w: w(N, h) };
          O.kind !== "text" && typeof O.style.w != "number" && O.style.min_w === void 0 && (y.whitespace = "nowrap", y.flex_shrink = 0), s(O, y);
        } else Object.assign(N, S());
        if (O.kind !== "text") {
          const y = w(N, ot(O.style.mr));
          Number.isFinite(y) && s(O, { mr: y });
        }
      });
    }
    for (const k of E.children ?? []) k.kind !== "text" && z(k);
  }
  for (const E of n)
    E && (p(E, {}, !1), z(E));
}
const Ty = /(?<= +)(?=[^ ])|(?<=[\p{L}\p{N}]-)(?=[\p{L}\p{N}])/u;
function Cy(n, l, o) {
  const i = ["text_size", "font_weight", "font_family", "italic", "line_height"], s = (f) => typeof f == "number" ? f : 0, d = (f, p) => p && Pr(p) && !Re(p) && f.style.position !== "absolute" && !["start", "center", "end"].includes(f.style.self) && !["start", "center", "end"].includes(p.style.items), m = (f, p, v, S) => {
    if (!f || f.kind === "text" || !Te(f)) return;
    const w = f.style;
    let x = typeof w.w == "number" ? w.w : w.w === "100%" ? v : d(f, p) ? v - s(w.ml) - s(w.mr) : NaN;
    typeof w.max_w == "number" && (x = Math.min(x, w.max_w));
    const z = x - s(w.pl) - s(w.pr) - s(w.border_l) - s(w.border_r), E = { ...S };
    for (const k of i) w[k] !== void 0 && (E[k] = w[k]);
    const _ = f.children ?? [];
    if (f.break_anywhere && Number.isFinite(z) && z > 0 && typeof E.text_size == "number" && _.length && _.every((k) => k.kind === "text")) {
      const k = { size: E.text_size, weight: E.font_weight ?? 400, family: E.font_family ?? ".SystemUIFont", italic: !!E.italic }, N = (X) => l(X.trimEnd(), k) <= z + 0.01;
      let D = 0;
      for (const X of _) {
        const q = [];
        for (const h of X.text.split(`
`)) {
          let b = "";
          for (const y of h.split(Ty)) {
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
        const H = q.join(`
`);
        q.every((h) => !h || N(h)) ? H !== X.text && o.set(X, { ...o.get(X), text: H }) : D = NaN, D += q.length;
      }
      const O = ca(E);
      Number.isFinite(D) && O && w.h === void 0 && _.length === 1 && o.set(f, { ...o.get(f), h: D * O + s(w.pt) + s(w.pb) + s(w.border_t) + s(w.border_b) });
    }
    for (const k of _) m(k, f, Re(f) ? NaN : z, E);
  };
  for (const f of n) m(f, null, NaN, {});
}
function My(n, l) {
  const o = (i, s) => {
    if (!i || i.kind === "text" || !Te(i)) return;
    const d = i.style, m = d.position === "absolute" ? d.w === void 0 && (d.left === void 0 || d.right === void 0) : s && typeof d.w != "number";
    if (m && Re(i))
      for (const f of i.children ?? []) {
        const p = f.kind === "text" ? void 0 : f.style.flex_basis;
        f.kind !== "text" && f.style.flex_grow > 0 && (p === 0 || typeof p == "string" && p.endsWith("%")) && l.set(f, { ...l.get(f), flex_basis: "auto" });
      }
    for (const f of i.children ?? []) o(f, m);
  };
  for (const i of n) o(i, !1);
}
function Ay(n, l) {
  const o = l.heights ?? /* @__PURE__ */ new Map(), i = (p) => o.get(p), s = (p) => {
    const v = i(p);
    if (Number.isFinite(v)) return v;
    if (p.kind === "text" || !Te(p)) return 0;
    const S = p.style, w = typeof S.min_h == "number" ? S.min_h : 0, x = (p.children ?? []).filter(Le), z = x.map((k) => s(k) + (k.kind === "text" ? 0 : Math.max(0, ot(k.style.mt) || 0) + Math.max(0, ot(k.style.mb) || 0))), E = x.length ? Re(p) ? Math.max(...z) : z.reduce((k, N) => k + N, 0) + (S.display === "flex" ? (ot(S.gap_y) || 0) * (x.length - 1) : 0) : 0, _ = [S.pt, S.pb, S.border_t, S.border_b].reduce((k, N) => k + (ot(N) || 0), 0);
    return Math.max(w, E + _);
  }, d = (p) => !(p.children ?? []).filter(Le).length || Re(p) ? NaN : s({ ...p, style: { ...p.style, h: void 0, max_h: void 0, min_h: void 0 } }), m = (p, v) => {
    const S = p.style;
    if (typeof S.h == "number") return S.h;
    if (typeof S.max_h == "number") return S.max_h;
    if (!v || !Pr(v) || Re(v)) return NaN;
    const w = v.style, x = typeof w.h == "number" ? w.h : typeof w.max_h == "number" ? w.max_h : NaN, z = (v.children ?? []).filter(Le);
    let E = 0;
    for (const k of z) {
      if (k === p) continue;
      const N = i(k);
      if (!Number.isFinite(N)) return NaN;
      E += N + (k.kind === "text" ? 0 : ot(k.style.mt) + ot(k.style.mb));
    }
    const _ = w.display === "flex" ? ot(w.gap_y) * Math.max(0, z.length - 1) : 0;
    return x - ot(w.pt) - ot(w.pb) - ot(w.border_t) - ot(w.border_b) - E - _ - ot(S.mt) - ot(S.mb);
  }, f = (p, v) => {
    if (!(!p || p.kind === "text" || !Te(p))) {
      if (p.scrollbar > 0 && p.style.overflow_y === "scroll") {
        const S = d(p), w = m(p, v);
        Number.isFinite(S) && Number.isFinite(w) && S > w + 0.01 && l.set(p, { ...l.get(p), pr: ot(p.style.pr) + p.scrollbar });
      }
      for (const S of p.children ?? []) f(S, p);
    }
  };
  for (const p of n) f(p, null);
}
const jy = ["text_size", "line_height", "whitespace", "text_ellipsis"], ot = (n) => n == null ? 0 : typeof n == "number" ? n : NaN, Pr = (n) => n.style.display === "flex" ? n.style.flex_direction === "col" : !0, Re = (n) => n.style.display === "flex" && (n.style.flex_direction ?? "row") === "row", Le = (n) => n.kind === "text" || Te(n) && n.style.position !== "absolute";
function Oy(n, l) {
  const o = /* @__PURE__ */ new Map(), i = (_, k) => o.set(_, { ...o.get(_), ...Object.fromEntries(Object.entries(k).filter(([, N]) => Number.isFinite(N))) }), s = /* @__PURE__ */ new Map(), d = /* @__PURE__ */ new Map();
  function m(_, k) {
    if (_.kind === "text") return k.whitespace === "nowrap" || Cm.test(_.text) ? ca(k) ?? NaN : NaN;
    const N = { ...k };
    for (const H of jy) _.style[H] !== void 0 && (N[H] = _.style[H]);
    d.set(_, N);
    const D = _.style, O = (_.children ?? []).filter(Le), X = O.map((H) => m(H, N));
    let q;
    if (D.h !== void 0 && D.h !== "auto") q = ot(D.h);
    else if (_.kind === "engine") q = NaN;
    else if (_.kind === "input")
      q = (_.input_type === "textarea" || _.input_type === "select" ? NaN : ca(N) ?? NaN) + ot(D.pt) + ot(D.pb) + ot(D.border_t) + ot(D.border_b), D.min_h !== void 0 && (q = Math.max(q, ot(D.min_h)));
    else {
      const H = O.map((b, y) => (b.kind === "text" ? 0 : ot(b.style.mt) + ot(b.style.mb)) + X[y]);
      let h;
      if (Re(_)) h = D.flex_wrap === "wrap" ? NaN : D.items === "baseline" ? p(O, X, N) : Math.max(0, ...H);
      else if (Pr(_)) {
        const b = O.some((A) => A.kind !== "text" && (A.style.flex_grow > 0 || A.style.flex_basis !== void 0)), y = D.display !== "flex" && O.some((A) => A.kind !== "text" && (ot(A.style.mt) || ot(A.style.mb)));
        h = b || y ? NaN : H.reduce((A, j) => A + j, 0) + (D.display === "flex" ? ot(D.gap_y) * Math.max(0, O.length - 1) : 0);
      } else h = NaN;
      q = h + ot(D.pt) + ot(D.pb) + ot(D.border_t) + ot(D.border_b), D.min_h !== void 0 && (q = Math.max(q, ot(D.min_h))), D.max_h !== void 0 && (q = Math.min(q, ot(D.max_h)));
    }
    return s.set(_, q), q;
  }
  const f = (_) => (ca(_) - (Jr + Vf) * _.text_size) / 2 + Jr * _.text_size;
  function p(_, k, N) {
    let D = 0, O = 0;
    for (const [X, q] of _.entries()) {
      const H = q.kind === "text" ? N : d.get(q);
      if (!(q.kind === "text" || (q.children ?? []).filter(Le).every((A) => A.kind === "text")) || !Number.isFinite(k[X]) || typeof H.text_size != "number") return NaN;
      const b = q.kind === "text" ? {} : q.style, y = ot(b.mt) + ot(b.border_t) + ot(b.pt) + f(H);
      D = Math.max(D, y), O = Math.max(O, ot(b.mt) + k[X] + ot(b.mb) - y);
    }
    return D + O;
  }
  const v = () => ({ exact: 0, laid: 0 }), S = (_, k) => {
    if (!Number.isFinite(k))
      return Object.assign(_, v()), NaN;
    _.exact += k;
    const N = Math.round(_.exact * l + 1e-9) / l, D = N - _.laid;
    return _.laid = N, D;
  };
  function w(_) {
    if (!(_.kind === "text" || !Te(_))) {
      for (const k of (_.children ?? []).filter((N) => N.kind !== "text" && Te(N) && N.style.position === "absolute")) w(k);
      if (Pr(_) && !Re(_)) {
        const k = v();
        i(_, { border_t: S(k, ot(_.style.border_t)), pt: S(k, ot(_.style.pt)) }), x(_, k);
      } else for (const k of (_.children ?? []).filter(Le)) k.kind !== "text" && w(k);
    }
  }
  function x(_, k) {
    const N = (_.children ?? []).filter(Le), D = _.style.display === "flex" ? ot(_.style.gap_y) : 0;
    if (D && N.some((O) => O.kind === "text")) {
      for (const O of N) O.kind !== "text" && w(O);
      return !1;
    }
    return D && i(_, { gap_y: 0 }), N.forEach((O, X) => {
      if (O.kind === "text") {
        const q = s.get(O) ?? m(O, d.get(_) ?? {});
        Number.isFinite(q) ? i(O, { h: S(k, q) }) : Object.assign(k, v());
        return;
      }
      if (i(O, { mt: S(k, (X ? D : 0) + ot(O.style.mt)) }), Number.isFinite(s.get(O))) E(O, k);
      else if (z(O)) {
        const q = O.style;
        i(O, { border_t: S(k, ot(q.border_t)), pt: S(k, ot(q.pt)) }), i(O, { pb: S(k, ot(q.pb)), border_b: S(k, ot(q.border_b)) });
      } else
        w(O), Object.assign(k, v());
      i(O, { mb: S(k, ot(O.style.mb)) });
    }), !0;
  }
  function z(_) {
    const k = _.style, N = (_.children ?? []).filter(Le), D = ca(d.get(_) ?? {});
    return _.kind === "div" && !Re(_) && N.length > 0 && N.every((O) => O.kind === "text") && Number.isInteger(D) && [k.h, k.min_h, k.max_h].every((O) => O === void 0 || O === "auto");
  }
  function E(_, k) {
    const N = _.style;
    for (const H of (_.children ?? []).filter((h) => h.kind !== "text" && Te(h) && h.style.position === "absolute")) w(H);
    const D = k.laid, O = k.exact;
    i(_, { border_t: S(k, ot(N.border_t)), pt: S(k, ot(N.pt)) });
    const X = N.h !== void 0 && N.h !== "auto", q = s.get(_) - ot(N.pt) - ot(N.pb) - ot(N.border_t) - ot(N.border_b);
    if (_.kind === "input")
      X || S(k, q);
    else if (Re(_) || X && (N.justify ?? "start") !== "start") {
      for (const H of (_.children ?? []).filter(Le)) H.kind !== "text" && w(H);
      X || S(k, q);
    } else !x(_, k) && !X && S(k, q);
    if (X) {
      k.exact = O + s.get(_), k.laid = Math.round(k.exact * l + 1e-9) / l, i(_, { h: k.laid - D });
      return;
    }
    i(_, { pb: S(k, ot(N.pb)), border_b: S(k, ot(N.border_b)) }), i(_, { h: k.laid - D });
  }
  for (const _ of n)
    m(_, {}), w(_);
  return Object.defineProperty(o, "heights", { value: s }), o;
}
const Yy = { sidebar: [{ name: "sidebar-root", selector: "aside.sidebar" }, { name: "sidebar-content", selector: "aside.sidebar > div:first-child" }, { name: "host-switcher", selector: '[data-testid="host-switcher"]' }, { name: "host-chip", selector: '[data-testid="host-switcher"] > div' }, { name: "host-badge", selector: ".sidebar__env-badge" }, { name: "host-name", selector: ".sidebar__env-host" }, { name: "host-meta", selector: '[data-testid="host-switcher"] > div > div:first-child > span:nth-child(3)' }, { name: "host-line", selector: ".sidebar__env-cwd" }, { name: "host-caret", selector: '[data-testid="host-switcher"] > span[aria-hidden="true"]' }, { name: "new-session-button", selector: 'button[data-testid^="new-session-"]', key: { self: !0, attr: "data-testid", strip: "new-session-" } }, { name: "new-session-icon", selector: 'button[data-testid^="new-session-"] > svg' }, { name: "new-session-label", selector: 'button[data-testid^="new-session-"]', textRange: !0 }, { name: "new-session-shortcut", selector: 'button[data-testid^="new-session-"] > span' }, { name: "overview", selector: '[data-testid="workspace-overview"]' }, { name: "overview-header", selector: '[data-testid="workspace-overview"] > div:first-child' }, { name: "overview-title", selector: '[data-testid="workspace-overview"] > div:first-child > div:first-child > span:first-child' }, { name: "needs-you-button", selector: '[data-testid="workspace-needs-you"]' }, { name: "organize-button", selector: '[data-testid="workspace-organize"]' }, { name: "organize-icon", selector: '[data-testid="workspace-organize"] > svg' }, { name: "add-project-button", selector: '[data-testid="workspace-add-project"]' }, { name: "add-project-icon", selector: '[data-testid="workspace-add-project"] > svg' }, { name: "add-project-label", selector: '[data-testid="workspace-add-project"]', textRange: !0 }, { name: "project-list", selector: '[data-testid="project-list"]' }, { name: "project", selector: ".workspace-project", key: { self: !0, attr: "data-testid", strip: "workspace-project-" } }, { name: "project-header", selector: ".workspace-project > div:first-child", key: { closest: ".workspace-project", attr: "data-testid", strip: "workspace-project-" } }, { name: "project-toggle", selector: '[data-testid^="project-toggle-"]', key: { self: !0, attr: "data-testid", strip: "project-toggle-" } }, { name: "project-chevron", selector: '[data-testid^="project-toggle-"] > svg:not([data-testid])', key: { closest: '[data-testid^="project-toggle-"]', attr: "data-testid", strip: "project-toggle-" } }, { name: "project-folder-icon", selector: '[data-testid="project-folder-icon"]', key: { closest: '[data-testid^="project-toggle-"]', attr: "data-testid", strip: "project-toggle-" } }, { name: "project-name", selector: '[data-testid^="project-toggle-"] strong', key: { closest: '[data-testid^="project-toggle-"]', attr: "data-testid", strip: "project-toggle-" } }, { name: "project-branch", selector: '[data-testid^="project-toggle-"] > span.whitespace-nowrap', key: { closest: '[data-testid^="project-toggle-"]', attr: "data-testid", strip: "project-toggle-" } }, { name: "project-dirty-mark", selector: '[data-testid^="project-toggle-"] > span[title="Uncommitted changes"]', key: { closest: '[data-testid^="project-toggle-"]', attr: "data-testid", strip: "project-toggle-" } }, { name: "project-rollup", selector: '[data-testid^="project-rollup-"]', key: { self: !0, attr: "data-testid", strip: "project-rollup-" } }, { name: "project-rollup-badge", selector: '[data-testid^="project-rollup-"] > span', key: { closest: '[data-testid^="project-rollup-"]', attr: "data-testid", strip: "project-rollup-" } }, { name: "project-menu-button", selector: '[data-testid^="workspace-project-menu-"]', key: { self: !0, attr: "data-testid", strip: "workspace-project-menu-" } }, { name: "project-add-button", selector: ".workspace-project > div:first-child .worktree-menu__btn", key: { closest: ".workspace-project", attr: "data-testid", strip: "workspace-project-" } }, { name: "project-workspaces", selector: ".workspace-project__workspaces", key: { closest: ".workspace-project", attr: "data-testid", strip: "workspace-project-" } }, { name: "workspace", selector: '[data-testid="workspace-tree-root"] [data-testid^="workspace-entry-"]', key: { self: !0, attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-button", selector: '[data-testid="workspace-tree-root"] button.workspace-entry__button', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-icon", selector: '[data-testid="workspace-tree-root"] [data-testid="workspace-checkout-icon"]', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-name", selector: '[data-testid="workspace-tree-root"] strong[title="Double-click to rename"]', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-branch", selector: '[data-testid="workspace-tree-root"] button.workspace-entry__button > span.items-baseline > span', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-dirty-mark", selector: '[data-testid="workspace-tree-root"] button.workspace-entry__button > span[title="Uncommitted changes"]', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-pinned-label", selector: '[data-testid="workspace-tree-root"] button.workspace-entry__button > span.shrink-0:not([title])', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "hidden-worktrees-button", selector: '[data-testid^="workspace-hidden-"]', key: { self: !0, attr: "data-testid", strip: "workspace-hidden-" } }, { name: "session-row", selector: 'div[class~="group/row"]', key: { find: 'button[data-testid^="workspace-session-"]:not([data-testid^="workspace-session-close-"])', attr: "data-testid", strip: "workspace-session-" } }, { name: "session-button", selector: 'button[data-testid^="workspace-session-"]:not([data-testid^="workspace-session-close-"])', key: { self: !0, attr: "data-testid", strip: "workspace-session-" } }, { name: "session-mark", selector: ".agent-mark", key: { closest: 'button[data-testid^="workspace-session-"]', attr: "data-testid", strip: "workspace-session-" } }, { name: "session-mark-icon", selector: ".agent-mark > span > *", key: { closest: 'button[data-testid^="workspace-session-"]', attr: "data-testid", strip: "workspace-session-" } }, { name: "session-title", selector: 'button[data-testid^="workspace-session-"] > span.whitespace-nowrap', key: { closest: 'button[data-testid^="workspace-session-"]', attr: "data-testid", strip: "workspace-session-" } }, { name: "status-row-title", selector: "button[data-session] span.truncate:not([data-testid])", key: { closest: 'button[data-testid^="workspace-session-"]', attr: "data-testid", strip: "workspace-session-" } }, { name: "status-row-detail", selector: '[data-testid="status-row-detail"]', key: { closest: 'button[data-testid^="workspace-session-"]', attr: "data-testid", strip: "workspace-session-" } }, { name: "session-state-badge", selector: '[data-testid^="session-state-"]', key: { self: !0, attr: "data-testid", strip: "session-state-" } }, { name: "session-menu-button", selector: '[data-testid^="session-menu-button-"]', key: { self: !0, attr: "data-testid", strip: "session-menu-button-" } }, { name: "session-fold-button", selector: '[data-testid^="session-fold-"]', key: { self: !0, attr: "data-testid", strip: "session-fold-" } }, { name: "session-elbow", selector: '[data-testid^="session-elbow-"]', key: { self: !0, attr: "data-testid", strip: "session-elbow-" } }, { name: "session-rollup", selector: '[data-testid^="session-rollup-"]', key: { self: !0, attr: "data-testid", strip: "session-rollup-" } }, { name: "chats", selector: '[data-testid="workspace-chats"]' }, { name: "chats-header", selector: '[data-testid="workspace-chats"] > div:first-child' }, { name: "chats-toggle", selector: '[data-testid="workspace-chats-collapse"]' }, { name: "chats-label", selector: '[data-testid="workspace-chats-collapse"]', textRange: !0 }, { name: "chats-chevron", selector: '[data-testid="workspace-chats-collapse"] > svg' }, { name: "chats-menu-button", selector: '[data-testid="workspace-chats-menu"]' }, { name: "chats-new-button", selector: '[data-testid="workspace-chats-new"]' }, { name: "chats-new-icon", selector: '[data-testid="workspace-chats-new"] > svg' }, { name: "status-view", selector: '[data-testid="workspace-status-view"]' }, { name: "status-section", selector: '[data-testid^="status-section-"]:not([data-testid^="status-section-title-"])', key: { self: !0, attr: "data-testid", strip: "status-section-" } }, { name: "status-heading", selector: '[data-testid^="status-section-title-"], [data-testid="status-no-sessions-title"]', key: { self: !0, attr: "data-testid" } }, { name: "status-heading-dot", selector: '[data-testid^="status-section-title-"] > span:first-child, [data-testid="status-no-sessions-title"] > span:first-child', key: { closest: '[data-testid^="status-section-title-"], [data-testid="status-no-sessions-title"]', attr: "data-testid" } }, { name: "status-heading-label", selector: '[data-testid^="status-section-title-"] > span:nth-child(2), [data-testid="status-no-sessions-title"] > span:nth-child(2)', key: { closest: '[data-testid^="status-section-title-"], [data-testid="status-no-sessions-title"]', attr: "data-testid" } }, { name: "status-heading-count", selector: '[data-testid^="status-section-title-"] > span[aria-label], [data-testid="status-no-sessions-title"] > span[aria-label]', key: { closest: '[data-testid^="status-section-title-"], [data-testid="status-no-sessions-title"]', attr: "data-testid" } }, { name: "status-heading-note", selector: '[data-testid^="status-section-title-"] > span.truncate, [data-testid="status-no-sessions-title"] > span.truncate', key: { closest: '[data-testid^="status-section-title-"], [data-testid="status-no-sessions-title"]', attr: "data-testid" } }, { name: "status-project", selector: 'div[data-testid^="status-project-"]', key: { self: !0, attr: "data-testid", strip: "status-project-" } }, { name: "status-project-header", selector: 'div[data-testid^="status-project-"] > div:first-child', key: { closest: 'div[data-testid^="status-project-"]', attr: "data-testid", strip: "status-project-" } }, { name: "status-project-icon", selector: 'div[data-testid^="status-project-"] > div:first-child > svg', key: { closest: 'div[data-testid^="status-project-"]', attr: "data-testid", strip: "status-project-" } }, { name: "status-project-title", selector: '[data-testid="status-project-title"]', key: { closest: 'div[data-testid^="status-project-"]', attr: "data-testid", strip: "status-project-" } }, { name: "status-empty-project", selector: '[data-testid^="status-empty-project-"]', key: { self: !0, attr: "data-testid", strip: "status-empty-project-" } }, { name: "status-empty-project-icon", selector: '[data-testid^="status-empty-project-"] > button:first-child > svg', key: { closest: '[data-testid^="status-empty-project-"]', attr: "data-testid", strip: "status-empty-project-" } }, { name: "status-empty-project-title", selector: '[data-testid^="status-empty-project-"] > button > span.whitespace-nowrap', key: { closest: '[data-testid^="status-empty-project-"]', attr: "data-testid", strip: "status-empty-project-" } }, { name: "settings-bar", selector: "aside.sidebar > div:last-child" }, { name: "settings-gear", selector: '[data-testid="settings-gear"]' }, { name: "settings-gear-icon", selector: '[data-testid="settings-gear"] > svg' }], tabs: [{ name: "tab-strip", selector: '[data-testid="tab-bar"]' }, { name: "tab-slot", selector: "[data-tab-entry]", key: { self: !0, attr: "data-tab-entry" } }, { name: "tab-separator", selector: '[data-testid="tab-separator"]', key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab", selector: "button.tab-bar__tab", key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-icon", selector: 'button.tab-bar__tab > span[aria-hidden="true"]', key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-icon-glyph", selector: 'button.tab-bar__tab > span[aria-hidden="true"] > *', key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-label", selector: "button.tab-bar__tab > span.truncate", key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-dirty", selector: 'button.tab-bar__tab > span[aria-label="unsaved changes"]', key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-close", selector: '[data-tab-entry] > button[aria-label^="Close"]', key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-close-glyph", selector: '[data-tab-entry] > button[aria-label^="Close"] > svg', key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-new", selector: '[data-testid="tab-new"]' }, { name: "tab-new-glyph", selector: '[data-testid="tab-new"] > svg' }], status: [{ name: "status-bar", selector: "footer.status-bar" }, { name: "status-location", selector: ".status-bar__location" }, { name: "status-dot", selector: ".status-bar__location > span:first-child" }, { name: "status-host", selector: '[data-testid="status-host"]' }, { name: "status-cwd", selector: ".status-item--cwd" }, { name: "status-branch", selector: ".status-bar__branch" }, { name: "status-branch-icon", selector: ".status-bar__branch > svg" }, { name: "status-branch-name", selector: ".status-bar__branch > span" }, { name: "status-details", selector: ".status-bar__details" }, { name: "zoom-indicator", selector: '[data-testid="zoom-indicator"]' }, { name: "status-detail", selector: ".status-bar__details > span" }, { name: "status-usage", selector: ".status-bar__usage" }, { name: "usage-summary", selector: '[data-testid="usage-summary"]' }, { name: "usage-unavailable", selector: '[data-testid="usage-summary"] > span:only-child' }, { name: "usage-account", selector: '[data-testid="usage-summary"] > span.flex' }, { name: "usage-account-name", selector: '[data-testid="usage-summary"] > span.flex > span:first-child' }, { name: "usage-window", selector: '[data-testid="usage-summary"] > span.flex > span:not(:first-child)' }, { name: "status-connection", selector: '[data-testid="status-connection"]' }, { name: "status-connection-glyph", selector: '[data-testid="status-connection"] > svg' }], navigator: [{ name: "navigator-scrim", selector: "body > div.fixed.inset-0" }, { name: "navigator-panel", selector: '[data-testid="navigator"]' }, { name: "navigator-input", selector: '[data-testid="navigator-input"]' }, { name: "navigator-chips", selector: '[data-testid="navigator"] > div:nth-child(2)' }, { name: "navigator-chip", selector: '[data-testid^="navigator-filter-"]', key: { self: !0, attr: "data-testid", strip: "navigator-filter-" } }, { name: "navigator-list", selector: '[data-testid="navigator"] > div:nth-child(3)' }, { name: "navigator-notice", selector: '[data-testid="navigator"] > div:nth-child(3) > p[role]' }, { name: "navigator-empty", selector: '[data-testid="navigator"] div.text-center' }, { name: "navigator-command", selector: '[data-testid^="navigator-command-"]', key: { self: !0, attr: "data-testid", strip: "navigator-command-" } }, { name: "navigator-command-title", selector: '[data-testid^="navigator-command-"] > span:first-child', key: { closest: '[data-testid^="navigator-command-"]', attr: "data-testid", strip: "navigator-command-" } }, { name: "navigator-command-detail", selector: '[data-testid^="navigator-command-"] > span:last-child', key: { closest: '[data-testid^="navigator-command-"]', attr: "data-testid", strip: "navigator-command-" } }, { name: "navigator-row", selector: '[data-testid^="navigator-row-"]', key: { self: !0, attr: "data-testid", strip: "navigator-row-" } }, { name: "navigator-row-dot", selector: '[data-testid^="navigator-row-"] > :first-child', key: { closest: '[data-testid^="navigator-row-"]', attr: "data-testid", strip: "navigator-row-" } }, { name: "navigator-row-title", selector: '[data-testid^="navigator-row-"] > span:nth-child(2)', key: { closest: '[data-testid^="navigator-row-"]', attr: "data-testid", strip: "navigator-row-" } }, { name: "navigator-row-detail", selector: '[data-testid^="navigator-row-"] > span:last-child', key: { closest: '[data-testid^="navigator-row-"]', attr: "data-testid", strip: "navigator-row-" } }, { name: "navigator-note", selector: '[data-testid="navigator"] > p:last-child' }], "pane-menu": [{ name: "pane-menu", selector: '[data-testid="pane-context-menu"]' }, { name: "pane-menu-item", selector: '[data-testid="pane-context-menu"] > button', key: { self: !0, attr: "data-testid", strip: "pane-menu-" } }, { name: "pane-menu-divider", selector: '[data-testid="pane-context-menu"] > div.h-px' }, { name: "pane-menu-rename-row", selector: '[data-testid="pane-context-menu"] > div.flex' }, { name: "pane-menu-rename-input", selector: '[data-testid="pane-menu-rename-input"]' }, { name: "pane-menu-rename-confirm", selector: '[data-testid="pane-menu-rename-confirm"]' }], confirm: [{ name: "confirm-scrim", selector: "body > div.fixed.inset-0" }, { name: "confirm-panel", selector: '[data-testid="confirm-dialog"]' }, { name: "confirm-message", selector: ".confirm-dialog__message" }, { name: "confirm-extra", selector: '[data-testid="confirm-dialog"] > :not(.confirm-dialog__message):not(div.flex)' }, { name: "confirm-buttons", selector: '[data-testid="confirm-dialog"] > div.flex' }, { name: "confirm-cancel", selector: '[data-testid="confirm-cancel"]' }, { name: "confirm-accept", selector: '[data-testid="confirm-accept"]' }], dialog: [{ name: "dialog-scrim", selector: "body > div.fixed.inset-0" }, { name: "dialog-panel", selector: '[data-testid="file-name-dialog"]' }, { name: "dialog-title", selector: '[data-testid="file-name-dialog"] > h2' }, { name: "dialog-input", selector: '[data-testid="file-name-input"]' }, { name: "dialog-hint", selector: '[data-testid="file-name-dialog"] > p:not([role])' }, { name: "dialog-error", selector: '[data-testid="file-name-dialog"] > p[role="alert"]' }, { name: "dialog-buttons", selector: '[data-testid="file-name-dialog"] > div.flex' }, { name: "dialog-cancel", selector: '[data-testid="file-name-dialog"] > div.flex > button:first-child' }, { name: "dialog-confirm", selector: '[data-testid="file-name-confirm"]' }], toast: [{ name: "toast-stack", selector: '[data-testid="toast"]' }, { name: "toast-card", selector: '[data-testid="toast"] .animate-toast-in' }, { name: "toast-open", selector: '[data-testid^="toast-"]:not([data-testid^="toast-dismiss-"])' }, { name: "toast-mark", selector: '[data-testid^="toast-"]:not([data-testid^="toast-dismiss-"]) > :first-child' }, { name: "toast-heading", selector: '[data-testid^="toast-"]:not([data-testid^="toast-dismiss-"]) > span.min-w-0 > span:first-child' }, { name: "toast-detail", selector: '[data-testid^="toast-"]:not([data-testid^="toast-dismiss-"]) > span.min-w-0 > span:nth-child(2)' }, { name: "toast-dismiss", selector: '[data-testid^="toast-dismiss-"]' }, { name: "toast-dismiss-glyph", selector: '[data-testid^="toast-dismiss-"] > svg' }], "pane-header": [{ name: "pane-header", selector: '[data-testid^="pane-header-"]', key: { self: !0, attr: "data-testid", strip: "pane-header-" } }, { name: "pane-header-icon", selector: '[data-testid^="pane-header-"] > span.shrink-0:not([data-testid])', key: { closest: '[data-testid^="pane-header-"]', attr: "data-testid", strip: "pane-header-" } }, { name: "pane-header-icon-glyph", selector: '[data-testid^="pane-header-"] > span.shrink-0:not([data-testid]) > *', key: { closest: '[data-testid^="pane-header-"]', attr: "data-testid", strip: "pane-header-" } }, { name: "pane-header-name", selector: '[data-testid^="pane-header-"] > span.truncate', key: { closest: '[data-testid^="pane-header-"]', attr: "data-testid", strip: "pane-header-" } }, { name: "pane-header-state", selector: '[data-testid^="pane-header-"] > span.flex[title]', key: { closest: '[data-testid^="pane-header-"]', attr: "data-testid", strip: "pane-header-" } }, { name: "pane-header-state-dot", selector: '[data-testid^="pane-header-"] > span.flex[title] > span.rounded-full', key: { closest: '[data-testid^="pane-header-"]', attr: "data-testid", strip: "pane-header-" } }, { name: "pane-header-state-word", selector: '[data-testid^="pane-header-"] > span.flex[title] > span.truncate', key: { closest: '[data-testid^="pane-header-"]', attr: "data-testid", strip: "pane-header-" } }, { name: "pane-controls", selector: '[data-testid^="tile-controls-"]', key: { self: !0, attr: "data-testid", strip: "tile-controls-" } }, { name: "pane-expand", selector: '[data-testid^="tile-expand-"]', key: { self: !0, attr: "data-testid", strip: "tile-expand-" } }, { name: "pane-expand-glyph", selector: '[data-testid^="tile-expand-"] > svg', key: { closest: '[data-testid^="tile-expand-"]', attr: "data-testid", strip: "tile-expand-" } }, { name: "pane-close", selector: '[data-testid^="tile-close-"]', key: { self: !0, attr: "data-testid", strip: "tile-close-" } }, { name: "pane-close-glyph", selector: '[data-testid^="tile-close-"] > svg', key: { closest: '[data-testid^="tile-close-"]', attr: "data-testid", strip: "tile-close-" } }, { name: "pane-corner", selector: "div.pointer-events-auto.absolute" }], "new-session": [{ name: "launcher", selector: ".new-session-popover" }, { name: "launcher-filter", selector: '[data-testid="new-tab-filter"]' }, { name: "launcher-list", selector: "#new-tab-launcher-list" }, { name: "launcher-option", selector: '[role="option"]', key: { self: !0, attr: "data-testid" } }, { name: "launcher-option-icon", selector: '[role="option"] > :first-child:not(span.flex-1):not(kbd)', key: { closest: '[role="option"]', attr: "data-testid" } }, { name: "launcher-option-label", selector: '[role="option"] > span.flex-1', key: { closest: '[role="option"]', attr: "data-testid" } }, { name: "launcher-option-key", selector: '[role="option"] > kbd', key: { closest: '[role="option"]', attr: "data-testid" } }, { name: "launcher-note", selector: ".new-session-popover p[role]" }, { name: "agent-select", selector: '[data-testid="new-session-popover-agent"]' }, { name: "agent-manage", selector: ".new-session-popover > div:first-child > button:not([data-testid])" }, { name: "project-option", selector: '[data-testid^="project-option-"]', key: { self: !0, attr: "data-testid", strip: "project-option-" } }, { name: "project-option-name", selector: '[data-testid^="project-option-"]', key: { closest: '[data-testid^="project-option-"]', attr: "data-testid", strip: "project-option-" }, textRange: !0 }, { name: "project-option-path", selector: '[data-testid^="project-option-"] > span', key: { closest: '[data-testid^="project-option-"]', attr: "data-testid", strip: "project-option-" } }], "tab-menu": [{ name: "tab-menu", selector: '[data-testid="tab-split-menu"]' }, { name: "tab-menu-item", selector: '[data-testid="tab-split-menu"] > button', key: { self: !0, attr: "data-testid" } }, { name: "tab-menu-show-beside", selector: '[data-testid="tab-menu-show-beside"]' }, { name: "tab-menu-beside-list", selector: '[data-testid="tab-split-menu"] [role="menu"]' }, { name: "tab-menu-beside-item", selector: '[data-testid="tab-split-menu"] [role="menu"] > button', key: { self: !0, attr: "data-testid" } }, { name: "tab-menu-item-label", selector: '[data-testid="tab-split-menu"] [role="menu"] > button > span.block', key: { closest: '[data-testid="tab-split-menu"] [role="menu"] > button', attr: "data-testid" } }, { name: "tab-menu-empty", selector: '[data-testid="tab-menu-empty"]' }, { name: "tab-menu-divider", selector: '[data-testid="tab-split-menu"] > div.h-px' }, { name: "tab-menu-rename-form", selector: '[data-testid="tab-split-menu"] > form' }, { name: "tab-menu-rename-input", selector: '[data-testid="tab-menu-rename-input"]' }, { name: "tab-menu-rename-save", selector: '[data-testid="tab-split-menu"] > form > button' }], select: [{ name: "select-field", selector: '[data-testid="select-demo"]' }, { name: "select-field-label", selector: '[data-testid="select-demo"] > span.truncate' }, { name: "select-chevron", selector: '[data-testid="select-demo"] > svg' }, { name: "select-list", selector: '[role="listbox"]' }, { name: "select-option", selector: '[role="listbox"] > [role="option"]', key: { self: !0, attr: "data-value" } }, { name: "select-option-label", selector: '[role="listbox"] > [role="option"] > span.truncate', key: { closest: '[role="option"]', attr: "data-value" } }, { name: "select-option-check", selector: '[role="listbox"] > [role="option"] > span[aria-hidden]', key: { closest: '[role="option"]', attr: "data-value" } }], "keybind-help": [{ name: "keybind-help-scrim", selector: "body > div.fixed.inset-0" }, { name: "keybind-help-panel", selector: '[data-testid="keybind-help"]' }, { name: "keybind-help-header", selector: '[data-testid="keybind-help"] > div:first-child' }, { name: "keybind-help-title", selector: '[data-testid="keybind-help"] h2' }, { name: "keybind-help-close", selector: '[aria-label="Close keybind help"]' }, { name: "keybind-help-close-glyph", selector: '[aria-label="Close keybind help"] > svg' }, { name: "keybind-help-search", selector: '[data-testid="keybind-help-search"]' }, { name: "keybind-help-list", selector: '[data-testid="keybind-help"] > div:last-child' }, { name: "keybind-help-empty", selector: '[data-testid="keybind-help"] div.text-center' }, { name: "keybind-help-group", selector: '[data-testid="keybind-help"] section' }, { name: "keybind-help-group-title", selector: '[data-testid="keybind-help"] section > h3' }, { name: "keybind-help-row", selector: '[data-testid="keybind-help"] li' }, { name: "keybind-help-keys", selector: '[data-testid="keybind-help"] li > kbd' }, { name: "keybind-help-description", selector: '[data-testid="keybind-help"] li > span' }], launcher: [{ name: "launcher-scrim", selector: "body > div.fixed.inset-0" }, { name: "launcher-panel", selector: '[data-testid="new-session-dialog"]' }, { name: "launcher-title", selector: '[data-testid="new-session-dialog"] > p' }, { name: "launcher-filter", selector: '[data-testid="new-session-filter"]' }, { name: "launcher-list", selector: "#new-session-list" }, { name: "launcher-row", selector: '[data-testid^="new-session-row-"]', key: { self: !0, attr: "data-testid", strip: "new-session-row-" } }, { name: "launcher-row-icon", selector: '[data-testid^="new-session-row-"] > :first-child:not(span):not(kbd)', key: { closest: '[data-testid^="new-session-row-"]', attr: "data-testid", strip: "new-session-row-" } }, { name: "launcher-row-label", selector: '[data-testid^="new-session-row-"] > span.shrink-0', key: { closest: '[data-testid^="new-session-row-"]', attr: "data-testid", strip: "new-session-row-" } }, { name: "launcher-row-detail", selector: '[data-testid^="new-session-row-"] > span.ml-auto', key: { closest: '[data-testid^="new-session-row-"]', attr: "data-testid", strip: "new-session-row-" } }, { name: "launcher-row-key", selector: '[data-testid^="new-session-row-"] > kbd', key: { closest: '[data-testid^="new-session-row-"]', attr: "data-testid", strip: "new-session-row-" } }, { name: "launcher-note", selector: "#new-session-list > p" }], "session-menu": [{ name: "tab-menu", selector: '[data-testid="tab-split-menu"]' }, { name: "tab-menu-item", selector: '[data-testid="tab-split-menu"] > button', key: { self: !0, attr: "data-testid" } }, { name: "tab-menu-show-beside", selector: '[data-testid="tab-menu-show-beside"]' }, { name: "tab-menu-beside-list", selector: '[data-testid="tab-split-menu"] [role="menu"]' }, { name: "tab-menu-beside-item", selector: '[data-testid="tab-split-menu"] [role="menu"] > button', key: { self: !0, attr: "data-testid" } }, { name: "tab-menu-item-label", selector: '[data-testid="tab-split-menu"] [role="menu"] > button > span.block', key: { closest: '[data-testid="tab-split-menu"] [role="menu"] > button', attr: "data-testid" } }, { name: "tab-menu-empty", selector: '[data-testid="tab-menu-empty"]' }, { name: "tab-menu-divider", selector: '[data-testid="tab-split-menu"] > div.h-px' }], "tab-drag": [{ name: "tab-drag-layer", selector: '[data-testid="tab-drag-layer"]' }, { name: "tab-drag-pane", selector: '[data-testid="tab-drag-layer"] > div.bg-surface-1\\/30' }, { name: "tab-drop-zone", selector: '[data-testid="tab-drop-zone"]', key: { self: !0, attr: "data-zone" } }, { name: "tab-drop-label", selector: '[data-testid="tab-drop-zone"] > span' }, { name: "tab-drag-ghost", selector: '[data-testid="tab-drag-ghost"]' }], start: [{ name: "start-panel", selector: '[data-testid="no-session-panel"], [data-testid="cli-start-panel"]' }, { name: "start-column", selector: '[data-testid$="-panel"] > div' }, { name: "start-logo", selector: '[data-testid="no-session-panel"] img' }, { name: "start-name", selector: '[data-testid$="-panel"] h1, [data-testid="no-session-panel"] h1, [data-testid="no-session-panel"] h2' }, { name: "start-hint", selector: '[data-testid$="-panel"] p' }, { name: "start-target", selector: '[data-testid="workspace-start-target"], [data-testid="cli-start-target"]' }, { name: "start-action", selector: '[data-testid="home-add-project"], [data-testid="no-session-create"], [data-testid^="workspace-start-"]:not([data-testid="workspace-start-target"]), [data-testid^="cli-start-agent-"]', key: { self: !0, attr: "data-testid" } }, { name: "start-status", selector: '[role="status"], [role="alert"]' }, { name: "start-status-action", selector: '[role="status"] > button, [role="alert"] > button' }, { name: "start-link", selector: '[data-testid$="-panel"] button.text-subtext-0' }, { name: "start-shortcut-row", selector: '[data-testid="no-session-panel"] dl > div' }, { name: "start-shortcut-label", selector: '[data-testid="no-session-panel"] dl dt' }, { name: "start-shortcut-key", selector: '[data-testid="no-session-panel"] dl kbd' }], "folder-browser": [{ name: "folder-browser", selector: '[data-testid="dir-browser"]' }, { name: "folder-browser-mode-toggle", selector: '[data-testid="dir-browser-mode-toggle"]' }, { name: "folder-browser-up", selector: '[data-testid="dir-browser-up"]' }, { name: "folder-browser-crumbs", selector: '[data-testid="dir-browser"] span.min-w-0.flex-1' }, { name: "folder-browser-crumb", selector: '[data-testid="dir-browser"] span.min-w-0.flex-1 button' }, { name: "folder-browser-filter", selector: '[data-testid="dir-browser-filter"]' }, { name: "folder-browser-list", selector: '[data-testid="dir-browser"] div.overflow-y-auto' }, { name: "folder-browser-entry", selector: '[data-testid^="dir-browser-entry-"]', key: { self: !0, attr: "data-testid", strip: "dir-browser-entry-" } }, { name: "folder-browser-entry-name", selector: '[data-testid^="dir-browser-entry-"] > span:first-child', key: { closest: '[data-testid^="dir-browser-entry-"]', attr: "data-testid", strip: "dir-browser-entry-" } }, { name: "folder-browser-git", selector: '[data-testid^="dir-browser-entry-"] > span:last-child:not(:first-child)', key: { closest: '[data-testid^="dir-browser-entry-"]', attr: "data-testid", strip: "dir-browser-entry-" } }, { name: "folder-browser-note", selector: '[data-testid="dir-browser"] div.overflow-y-auto > div' }, { name: "folder-browser-use", selector: '[data-testid="dir-browser-use"]' }, { name: "folder-browser-path-input", selector: '[data-testid="project-path-input"]' }], instructions: [{ name: "instructions-scrim", selector: "body > div.fixed.inset-0" }, { name: "instructions-panel", selector: '[data-testid="instructions-dialog"]' }, { name: "instructions-title", selector: '[data-testid="instructions-dialog"] > h2' }, { name: "instructions-intro", selector: '[data-testid="instructions-dialog"] > p' }, { name: "instructions-label", selector: '[data-testid="instructions-dialog"] > label > span:first-child' }, { name: "instructions-count", selector: '[data-testid="instructions-count"]' }, { name: "instructions-text", selector: '[data-testid="instructions-text"]' }, { name: "instructions-folders", selector: '[data-testid="instructions-folders"]' }, { name: "instructions-error", selector: '[data-testid="instructions-error"]' }, { name: "instructions-cancel", selector: '[data-testid="instructions-dialog"] > div.flex.justify-end > button:first-child' }, { name: "instructions-save", selector: '[data-testid="instructions-save"]' }], memory: [{ name: "memory-scrim", selector: "body > div.fixed.inset-0", key: { self: !0, attr: "data-testid" } }, { name: "memory-panel", selector: '[data-testid="memory-dialog"]' }, { name: "memory-title", selector: '[data-testid="memory-dialog"] > h2' }, { name: "memory-intro", selector: '[data-testid="memory-dialog"] > p' }, { name: "memory-caps", selector: '[data-testid="memory-caps"]' }, { name: "memory-new", selector: '[data-testid="memory-new"]' }, { name: "memory-enabled", selector: '[data-testid="memory-enabled"]' }, { name: "memory-enabled-label", selector: '[data-testid="memory-dialog"] > label.flex > span' }, { name: "memory-note", selector: '[data-testid="memory-dialog"] > span.text-subtext-0' }, { name: "memory-row", selector: '[data-testid^="memory-row-"]', key: { self: !0, attr: "data-testid", strip: "memory-row-" } }, { name: "memory-open", selector: '[data-testid^="memory-open-"]', key: { self: !0, attr: "data-testid", strip: "memory-open-" } }, { name: "memory-file-title", selector: '[data-testid^="memory-row-"] button > span:first-child', key: { closest: '[data-testid^="memory-row-"]', attr: "data-testid", strip: "memory-row-" } }, { name: "memory-file-summary", selector: '[data-testid^="memory-row-"] button > span.truncate', key: { closest: '[data-testid^="memory-row-"]', attr: "data-testid", strip: "memory-row-" } }, { name: "memory-file-meta", selector: '[data-testid^="memory-row-"] button > span:last-child', key: { closest: '[data-testid^="memory-row-"]', attr: "data-testid", strip: "memory-row-" } }, { name: "memory-delete", selector: '[data-testid^="memory-delete-"]', key: { self: !0, attr: "data-testid", strip: "memory-delete-" } }, { name: "memory-error", selector: '[data-testid="memory-error"]' }, { name: "memory-close", selector: '[data-testid="memory-dialog"] > div.flex.justify-end > button' }, { name: "memory-file-name", selector: '[data-testid="memory-file-name"]' }, { name: "memory-name", selector: '[data-testid="memory-name"]' }, { name: "memory-count", selector: '[data-testid="memory-count"]' }, { name: "memory-text", selector: '[data-testid="memory-text"]' }, { name: "memory-conflict", selector: '[data-testid="memory-conflict"]' }, { name: "memory-reload", selector: '[data-testid="memory-reload"]' }, { name: "memory-back", selector: '[data-testid="memory-back"]' }, { name: "memory-save", selector: '[data-testid="memory-save"]' }, { name: "memory-confirm", selector: '[data-testid="confirm-dialog"]' }, { name: "memory-confirm-message", selector: ".confirm-dialog__message" }], worktree: [{ name: "worktree-plus", selector: '[data-testid^="worktree-menu-"]' }, { name: "worktree-popover", selector: '[role="dialog"][aria-label="Git worktrees"]' }, { name: "worktree-heading", selector: '[role="dialog"][aria-label="Git worktrees"] > div:first-child > span:first-child' }, { name: "worktree-project", selector: '[role="dialog"][aria-label="Git worktrees"] > div:first-child > span:last-child' }, { name: "worktree-list", selector: '[role="dialog"][aria-label="Git worktrees"] > div.overflow-y-auto' }, { name: "worktree-note", selector: '[role="dialog"][aria-label="Git worktrees"] > div.overflow-y-auto > div:not(.worktree-menu__entry)' }, { name: "worktree-entry", selector: '[data-testid^="worktree-entry-"]', key: { self: !0, attr: "data-testid", strip: "worktree-entry-" } }, { name: "worktree-entry-branch", selector: ".worktree-menu__entry-branch", key: { closest: '[data-testid^="worktree-entry-"]', attr: "data-testid", strip: "worktree-entry-" } }, { name: "worktree-badge", selector: '[data-testid^="worktree-entry-"] .worktree-menu__entry-branch > span', key: { closest: '[data-testid^="worktree-entry-"]', attr: "data-testid", strip: "worktree-entry-" } }, { name: "worktree-entry-path", selector: ".worktree-menu__entry-path", key: { closest: '[data-testid^="worktree-entry-"]', attr: "data-testid", strip: "worktree-entry-" } }, { name: "worktree-open", selector: '[data-testid^="worktree-open-"]', key: { self: !0, attr: "data-testid", strip: "worktree-open-" } }, { name: "worktree-remove", selector: '[data-testid^="worktree-remove-"]', key: { self: !0, attr: "data-testid", strip: "worktree-remove-" } }, { name: "worktree-error", selector: '[data-testid="worktree-error"]' }, { name: "worktree-new", selector: '[data-testid="worktree-new"]' }, { name: "worktree-name-input", selector: '[data-testid="worktree-name-input"]' }, { name: "worktree-start-input", selector: '[data-testid="worktree-start-input"]' }, { name: "worktree-branch-input", selector: '[data-testid="worktree-branch-input"]' }, { name: "worktree-parent-select", selector: '[data-testid="worktree-parent-select"]' }, { name: "worktree-new-branch", selector: '[data-testid="worktree-new-branch"]' }, { name: "worktree-path-input", selector: '[data-testid="worktree-path-input"]' }, { name: "worktree-agent-select", selector: '[data-testid="worktree-agent-select"]' }, { name: "worktree-create-cancel", selector: '[data-testid="worktree-create-cancel"]' }, { name: "worktree-create-submit", selector: '[data-testid="worktree-create-submit"]' }, { name: "worktree-confirm", selector: '[data-testid="confirm-dialog"]' }, { name: "worktree-confirm-message", selector: ".confirm-dialog__message" }, { name: "worktree-confirm-accept", selector: '[data-testid="confirm-accept"]' }, { name: "worktree-confirm-cancel", selector: '[data-testid="confirm-cancel"]' }], "terminal-search": [{ name: "terminal-frame", selector: '[data-testid="persistent-agent-terminal"]' }, { name: "term-search", selector: '[data-testid="term-search"]' }, { name: "term-search-input", selector: '[data-testid="term-search-input"]' }, { name: "term-search-button", selector: '[data-testid="term-search"] > button', key: { self: !0, attr: "title" } }], "agent-control": [{ name: "terminal-frame", selector: '[data-testid="persistent-agent-terminal"]' }, { name: "agent-control-chip", selector: '[data-testid="agent-control-chip"]' }, { name: "agent-control-label", selector: '[data-testid="agent-control-chip"] > span' }, { name: "agent-control-button", selector: '[data-testid="agent-control-chip"] > button' }, { name: "agent-control-error", selector: ".terminal__cli-error" }, { name: "agent-control-ended", selector: ".terminal__exited", key: { self: !0, attr: "data-testid" } }, { name: "agent-control-ended-text", selector: ".terminal__exited-text" }, { name: "agent-control-ended-button", selector: ".terminal__exited-actions > button", key: { self: !0, attr: "data-testid" } }], "phone-size": [{ name: "terminal-frame", selector: '[data-testid="persistent-agent-terminal"]' }, { name: "phone-size-notice", selector: '[data-testid="phone-size-notice"]' }, { name: "phone-size-chip", selector: '[data-testid="phone-size-chip"]' }, { name: "phone-size-heading", selector: '[data-testid="phone-size-notice"] span.font-semibold' }, { name: "phone-size-text", selector: '[data-testid="phone-size-notice"] span:not(.font-semibold)' }, { name: "phone-size-fold", selector: '[aria-label="Keep phone size and hide this"]' }, { name: "phone-size-button", selector: '[data-testid="phone-size-notice"] div.flex.flex-wrap > button, [data-testid="phone-size-chip"] > button' }], window: [{ name: "sidebar-card", selector: '[data-testid="sidebar-card"]' }, { name: "main-card", selector: '[data-testid="main-card"]' }, { name: "tools-card", selector: '[data-testid="tools-card"]' }, { name: "sidebar-toggle", selector: '[data-testid="sidebar-collapse-toggle"]' }, { name: "drawer-toggle", selector: '[data-testid="workspace-tools-toggle"]' }, { name: "resize-sidebar", selector: '[data-testid="resize-sidebar"]' }, { name: "resize-tools", selector: '[data-testid="resize-tools"]' }, { name: "tools-tab", selector: 'nav[aria-label="Files, Git and Browser"] > button' }, { name: "status-bar", selector: "footer.status-bar" }], settings: [{ name: "settings-modal", selector: '[data-testid="settings-modal"]' }, { name: "settings-nav-card", selector: '[data-testid="settings-modal"] > nav' }, { name: "settings-close", selector: '[data-testid="settings-close"]' }, { name: "settings-nav", selector: 'nav [data-testid^="settings-nav-"]', key: { self: !0, attr: "data-testid", strip: "settings-nav-" } }, { name: "settings-main-card", selector: '[data-testid="settings-modal"] > main' }, { name: "settings-search", selector: '[data-testid="settings-search"]' }, { name: "settings-title", selector: '[data-testid="settings-modal"] > main h1' }, { name: "settings-body", selector: '[data-testid="settings-modal"] .settings-modal__body' }, { name: "settings-group-title", selector: '[data-testid="settings-modal"] > main h3' }, { name: "settings-group-card", selector: '[data-testid="settings-modal"] > main section > div.rounded-ui' }, { name: "settings-row", selector: '[data-testid="settings-modal"] [data-setting-row]' }, { name: "settings-row-title", selector: '[data-testid="settings-modal"] [data-setting-row] > div:first-child > div:first-child' }, { name: "settings-row-description", selector: '[data-testid="settings-modal"] [data-setting-row] > div:first-child > div:nth-child(2)' }, { name: "settings-result-title", selector: '[data-testid^="settings-result-"] > h2' }], files: [{ name: "files-explorer", selector: '[data-testid="workspace-files-view"]' }, { name: "files-tree", selector: '[data-testid="workspace-file-tree-scroll"]' }, { name: "files-entry", selector: '[data-testid^="workspace-file-entry-"]', key: { self: !0, attr: "data-testid", strip: "workspace-file-entry-" } }, { name: "files-entry-icon", selector: '[data-testid^="workspace-file-entry-"] > svg[data-file-icon]', key: { closest: '[data-testid^="workspace-file-entry-"]', attr: "data-testid", strip: "workspace-file-entry-" } }, { name: "files-entry-name", selector: '[data-testid^="workspace-file-entry-"] > span.flex-1', key: { closest: '[data-testid^="workspace-file-entry-"]', attr: "data-testid", strip: "workspace-file-entry-" } }, { name: "files-pane", selector: '[data-testid="workspace-file-pane"]' }, { name: "files-file-title", selector: ".workspace-files__file-title > span:first-child" }, { name: "files-dirty", selector: '.workspace-files__file-title > span[title="Unsaved changes"]' }, { name: "files-save", selector: ".workspace-files__save" }, { name: "files-conflict", selector: '[data-testid="workspace-file-conflict"]' }, { name: "files-conflict-title", selector: '[data-testid="workspace-file-conflict"] > strong' }, { name: "files-conflict-action", selector: '[data-testid="workspace-file-conflict"] button' }, { name: "files-editor", selector: '[data-testid="workspace-file-editor-area"]' }] };
export {
  Yy as NAMED_ELEMENTS,
  x0 as React,
  P0 as SCHEMA,
  Uy as STYLE_KEYS,
  qy as describeToGpui,
  Ry as jsxRuntime,
  Dy as mount,
  Hy as reactDom,
  By as sdk
};
